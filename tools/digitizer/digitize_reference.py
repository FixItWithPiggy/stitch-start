"""
Stitch Start auto-digitizer: PNG/JPG artwork -> DST embroidery file + stitch preview.

Works best on simple art: solid colors, clean edges, a transparent or plain background.

Pipeline:
  1. Separate the art from the background (transparency, or near-white pixels).
  2. Reduce to a small number of thread colors (k-means in Lab color space).
  3. Clean up specks too small to stitch and give their pixels to the neighboring color.
  4. Trace each color's shapes into polygons, in millimetres at the requested size.
  5. Thin shapes (outlines, small details) -> running stitch along their edges.
     Larger shapes -> underlay + tatami fill (alternating rows, brick-offset stitches).
  6. Order colors light to dark (outlines last), write DST, render a preview.

Usage: python digitize.py input.png out_dir --height-mm 140 --colors 8
"""
import argparse
import json
import math
import os

import cv2
import numpy as np
import pyembroidery as pe
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely import affinity
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import unary_union

# Stitch settings (millimetres)
FILL_SPACING = 0.42  # distance between fill rows
FILL_STITCH = 3.0  # stitch length inside fills
UNDERLAY_SPACING = 2.0
RUN_STITCH = 2.0  # running stitch length along outlines
PULL_COMP = 0.15  # widen fills slightly; thread pulls fabric inward
THIN_MM = 1.4  # shapes thinner than this get a running stitch, not a fill
MIN_AREA_MM2 = 1.5  # smaller specks are merged into neighbors
JUMP_TRIM_MM = 2.5  # moves longer than this jump with a trim
MAX_CONNECT = 1.6  # longest sideways step allowed when joining one fill row to the next
OUTLINE_GRAY = 70  # pixels darker than this are treated as outline
EDGE_CONTRAST = 28  # color difference (Lab) that counts as a real edge worth outlining


def load_art(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        a = np.array(im)
        rgb, mask = a[..., :3], a[..., 3] >= 128
    else:
        rgb = np.array(im.convert("RGB"))
        mask = ~np.all(rgb > 235, axis=2)  # treat near-white as background
    return rgb, mask


def quantize(rgb, mask, k):
    smooth = cv2.medianBlur(rgb, 5)
    lab = cv2.cvtColor(smooth, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    idx = np.flatnonzero(mask.reshape(-1))
    sample = lab[idx]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    cv2.setRNGSeed(7)
    _, lbl, centers = cv2.kmeans(sample, k, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    labels = np.full(mask.size, -1, np.int32)
    labels[idx] = lbl.ravel()
    labels = labels.reshape(mask.shape)
    centers_rgb = cv2.cvtColor(centers.reshape(1, -1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    return labels, centers_rgb, centers[:, 0]  # L channel for ordering


def clean_labels(labels, mask, min_px):
    """Drop specks smaller than min_px and hand their pixels to the nearest remaining color."""
    out = labels.copy()
    for c in range(labels.max() + 1):
        m = labels == c
        n, comp, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), connectivity=8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] < min_px:
                out[comp == i] = -1
    holes = (out == -1) & mask
    if holes.any():
        _, (iy, ix) = ndimage.distance_transform_edt(out == -1, return_indices=True)
        out[holes] = out[iy[holes], ix[holes]]
    out[~mask] = -1
    return out


def polygons_for(mask_c, mm_per_px, height_px):
    contours, hier = cv2.findContours(mask_c.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = []
    if hier is None:
        return polys
    hier = hier[0]

    def to_mm(cnt):
        pts = cnt.reshape(-1, 2).astype(float)
        # Image y grows downward; embroidery y also grows downward in pyembroidery, keep as is.
        return [(x * mm_per_px, y * mm_per_px) for x, y in pts]

    for i, cnt in enumerate(contours):
        if hier[i][3] != -1 or len(cnt) < 3:
            continue
        holes = []
        child = hier[i][2]
        while child != -1:
            if len(contours[child]) >= 3:
                holes.append(to_mm(contours[child]))
            child = hier[child][0]
        p = Polygon(to_mm(cnt), holes).buffer(0)
        p = p.simplify(mm_per_px * 0.6, preserve_topology=True)
        if not p.is_empty:
            polys.extend(list(p.geoms) if isinstance(p, MultiPolygon) else [p])
    return polys


def max_inscribed_width(mask_c, mm_per_px):
    if not mask_c.any():
        return 0
    d = cv2.distanceTransform(mask_c.astype(np.uint8), cv2.DIST_L2, 5)
    return 2 * d.max() * mm_per_px


def resample(coords, step):
    pts = []
    for (x0, y0), (x1, y1) in zip(coords[:-1], coords[1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(math.ceil(d / step)))
        for k in range(n):
            t = k / n
            pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    pts.append(coords[-1])
    return pts


def run_outline(poly):
    """Running stitch around every edge of a thin shape."""
    rings = [list(poly.exterior.coords)] + [list(r.coords) for r in poly.interiors]
    # Skip specks: rings shorter than 3 mm stitch as a blob, not a line.
    return [resample(r, RUN_STITCH) for r in rings if len(r) > 2 and LineString(r).length >= 3.0]


def tatami(poly, angle, spacing, stitch):
    """Fill a polygon with rows of stitches, grouped into continuous runs to limit jumps."""
    if poly.is_empty:
        return []
    rot = affinity.rotate(poly, -angle, origin=(0, 0))
    minx, miny, maxx, maxy = rot.bounds
    rows = []
    y = miny + spacing / 2
    while y < maxy:
        inter = rot.intersection(LineString([(minx - 1, y), (maxx + 1, y)]))
        segs = []
        for g in getattr(inter, "geoms", [inter]):
            if g.geom_type == "LineString" and g.length > 0.2:
                xs = [c[0] for c in g.coords]
                segs.append((min(xs), max(xs), y))
        rows.append(sorted(segs))
        y += spacing

    used = [[False] * len(r) for r in rows]
    runs = []
    for r0 in range(len(rows)):
        for s0 in range(len(rows[r0])):
            if used[r0][s0]:
                continue
            run, r, s, forward = [], r0, s0, True
            while True:
                used[r][s] = True
                x0, x1, yy = rows[r][s]
                row_i = r
                offset = (row_i % 3) * stitch / 3
                xs = [x0]
                x = x0 + stitch - offset if offset else x0 + stitch
                while x < x1 - 0.5:
                    xs.append(x)
                    x += stitch
                xs.append(x1)
                if not forward:
                    xs = xs[::-1]
                run.extend((xx, yy) for xx in xs)
                # Find an overlapping, unused segment in the next row.
                nxt = None
                end_x = x1 if forward else x0
                if r + 1 < len(rows):
                    for j, (a, b, _) in enumerate(rows[r + 1]):
                        if not used[r + 1][j] and a < x1 and b > x0:
                            # The next row runs the other way, so it starts at its far end.
                            start_x = b if forward else a
                            if abs(start_x - end_x) <= MAX_CONNECT:
                                nxt = j
                            break
                if nxt is None:
                    break
                r, s, forward = r + 1, nxt, not forward
            back = affinity.rotate(LineString(run) if len(run) > 1 else LineString(run * 2), angle, origin=(0, 0))
            runs.append(list(back.coords))
    return runs


def order_runs(runs, start):
    """Nearest-neighbour ordering so each run starts close to where the last one ended."""
    remaining = runs[:]
    out, cur = [], start
    while remaining:
        best, best_d, best_rev = 0, float("inf"), False
        for i, r in enumerate(remaining):
            for rev, p in ((False, r[0]), (True, r[-1])):
                d = math.hypot(p[0] - cur[0], p[1] - cur[1])
                if d < best_d:
                    best, best_d, best_rev = i, d, rev
        r = remaining.pop(best)
        if best_rev:
            r = r[::-1]
        out.append(r)
        cur = r[-1]
    return out, cur


def digitize(path, out_dir, height_mm=140.0, colors=8, max_width_mm=None, add_outlines=True):
    os.makedirs(out_dir, exist_ok=True)
    rgb, mask = load_art(path)
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb, mask = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    h_px, w_px = mask.shape
    mm_per_px = height_mm / h_px
    if max_width_mm and w_px * mm_per_px > max_width_mm:
        mm_per_px = max_width_mm / w_px
    width_mm, height_mm = w_px * mm_per_px, h_px * mm_per_px

    # Dark outlines are thin, so blurring for color reduction would erase them.
    # Pull them out first as their own thread color, then reduce the rest.
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    outline = (gray < OUTLINE_GRAY) & mask
    has_outline = outline.sum() * mm_per_px**2 > 5
    if has_outline:
        rest = mask & ~outline
        labels, centers, lightness = quantize(rgb, rest, colors - 1)
        labels[outline] = colors - 1
        dark_rgb = np.median(rgb[outline], axis=0).astype(np.uint8)
        centers = np.vstack([centers, dark_rgb])
        lightness = np.append(lightness, -1.0)  # always stitched last
    else:
        labels, centers, lightness = quantize(rgb, mask, colors)
    labels = clean_labels(labels, mask, max(4, int(MIN_AREA_MM2 / mm_per_px**2)))

    if add_outlines:
        # Cartoon look: a dark running-stitch outline around the whole design and wherever two
        # clearly different colors meet (not between two shades of the same color).
        L = np.append(lightness, 0)  # index -1 (background) -> dark, so the silhouette counts
        lab_c = cv2.cvtColor(np.clip(centers, 0, 255).astype(np.uint8).reshape(1, -1, 3), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(float)
        lab_c = np.vstack([lab_c, [0, 128, 128]])
        edge = np.zeros(mask.shape, bool)
        for dy, dx in ((0, 1), (1, 0)):
            a_ = labels[: labels.shape[0] - dy, : labels.shape[1] - dx]
            b_ = np.roll(np.roll(labels, -dy, 0), -dx, 1)[: labels.shape[0] - dy, : labels.shape[1] - dx]
            diff = np.linalg.norm(lab_c[a_] - lab_c[b_], axis=-1) > EDGE_CONTRAST
            diff &= (a_ != b_) & ((a_ >= 0) | (b_ >= 0))
            edge[: labels.shape[0] - dy, : labels.shape[1] - dx] |= diff
        edge &= mask
        # Don't outline thin colored details (like glasses frames): the outline would cover them.
        kk = max(3, int(round(THIN_MM / mm_per_px)))
        thin_any = np.zeros(mask.shape, bool)
        for c in range(len(centers)):
            if has_outline and c == len(centers) - 1:
                continue
            mc = (labels == c).astype(np.uint8)
            thin_any |= mc.astype(bool) & ~cv2.morphologyEx(mc, cv2.MORPH_OPEN, np.ones((kk, kk), np.uint8)).astype(bool)
        edge &= ~cv2.dilate(thin_any.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        n_lab = len(centers)
        outline_label = n_lab - 1 if has_outline else n_lab
        if not has_outline:
            centers = np.vstack([centers, [40, 30, 30]])
            lightness = np.append(lightness, -1.0)
            colors += 1
        # The outline is stitched on top of fills, so keep fills underneath it intact.
        # Thick dark areas (a phone screen, an open mouth) stay solid dark fills.
        dark = labels == outline_label
        k = max(3, int(round(THIN_MM / mm_per_px)))
        thick_dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((k, k), np.uint8)).astype(bool)
        outline_mask = edge | (dark & ~thick_dark)
        fills_labels = labels.copy()
        fills_labels[dark & ~thick_dark] = -1
        _, (iy, ix) = ndimage.distance_transform_edt(fills_labels == -1, return_indices=True)
        holes = (fills_labels == -1) & mask
        fills_labels[holes] = labels[iy[holes], ix[holes]]
        labels = fills_labels
        labels[thick_dark] = outline_label
        labels_outline = outline_mask
    else:
        labels_outline = None

    order = sorted(range(colors), key=lambda c: -lightness[c])  # light first, dark (outlines) last
    pattern = pe.EmbPattern()
    blocks = []  # for preview: (rgb, [runs])
    cur = (0.0, 0.0)
    angles = [45, 135, 0, 90, 30, 120, 60, 150]
    color_info = []
    first_color = True

    order = sorted(range(len(centers)), key=lambda c: -lightness[c])
    for n, c in enumerate(order):
        is_outline = labels_outline is not None and lightness[c] == -1.0
        m = labels == c
        polys = [(p, False) for p in polygons_for(m, mm_per_px, h_px)] if m.any() else []
        if is_outline and labels_outline.any():
            polys += [(p, True) for p in polygons_for(labels_outline, mm_per_px, h_px)]
        if not polys:
            continue
        block_runs = []
        for p, as_line in polys:
            if p.area < MIN_AREA_MM2 and not as_line:
                continue
            # How thick is this piece? Rasterise-free estimate: area / half-perimeter.
            thick = 2 * p.area / max(p.length, 1e-6)
            if as_line or thick < THIN_MM:
                block_runs.extend(run_outline(p))
            else:
                angle = angles[n % len(angles)]
                under = p.buffer(-0.4)
                if not under.is_empty:
                    for g in getattr(under, "geoms", [under]):
                        block_runs.extend(tatami(g, angle + 90, UNDERLAY_SPACING, FILL_STITCH))
                block_runs.extend(tatami(p.buffer(PULL_COMP), angle, FILL_SPACING, FILL_STITCH))
        if not block_runs:
            continue
        block_runs, end = order_runs(block_runs, cur)
        hexcol = "#%02x%02x%02x" % tuple(int(v) for v in centers[c])
        pattern.add_thread({"color": hexcol, "description": f"Color {len(color_info) + 1}"})
        if not first_color:
            pattern.add_command(pe.COLOR_CHANGE)
        first_color = False
        stitches = 0
        last = cur
        for run in block_runs:
            sx, sy = run[0]
            if math.hypot(sx - last[0], sy - last[1]) > JUMP_TRIM_MM:
                pattern.add_command(pe.TRIM)
                pattern.add_stitch_absolute(pe.JUMP, sx * 10, sy * 10)
            for x, y in run:
                pattern.add_stitch_absolute(pe.STITCH, x * 10, y * 10)
                stitches += 1
            last = run[-1]
        cur = end
        blocks.append((tuple(int(v) for v in centers[c]), block_runs))
        color_info.append({"order": len(color_info) + 1, "hex": hexcol, "stitches": stitches})
    pattern.add_command(pe.END)

    base = os.path.splitext(os.path.basename(path))[0]
    dst_path = os.path.join(out_dir, base + ".dst")
    pe.write_dst(
        pattern,
        dst_path,
        {"tie_on": pe.CONTINGENCY_TIE_ON_THREE_SMALL, "tie_off": pe.CONTINGENCY_TIE_OFF_THREE_SMALL},
    )

    # Read it back to check it is a valid file and get exact counts.
    check = pe.read_dst(dst_path)
    sx0, sy0, sx1, sy1 = check.bounds()
    stats = {
        "file": os.path.basename(dst_path),
        "width_mm": round((sx1 - sx0) / 10, 1),
        "height_mm": round((sy1 - sy0) / 10, 1),
        "width_in": round((sx1 - sx0) / 254, 2),
        "height_in": round((sy1 - sy0) / 254, 2),
        "stitches": sum(1 for s in check.stitches if s[2] == pe.STITCH),
        "color_changes": sum(1 for s in check.stitches if s[2] == pe.COLOR_CHANGE),
        "trims_or_jumps": sum(1 for s in check.stitches if s[2] in (pe.JUMP, pe.TRIM)),
        "colors": color_info,
    }
    stats["minutes_at_600spm"] = round(stats["stitches"] / 600 + stats["color_changes"] * 1.0, 1)

    # Stitch preview at 12 px/mm, on canvas-colored fabric.
    S = 12
    pad = 6
    img = Image.new("RGB", (int((width_mm + 2 * pad) * S), int((height_mm + 2 * pad) * S)), (236, 230, 216))
    d = ImageDraw.Draw(img)
    for col, runs in blocks:
        dark = tuple(max(0, v - 45) for v in col)
        for run in runs:
            pts = [((x + pad) * S, (y + pad) * S) for x, y in run]
            if len(pts) > 1:
                d.line(pts, fill=dark, width=6)
                d.line(pts, fill=col, width=4)
    preview_path = os.path.join(out_dir, base + "-stitch-preview.png")
    img.save(preview_path)
    with open(os.path.join(out_dir, base + "-info.json"), "w") as f:
        json.dump(stats, f, indent=2)
    return dst_path, preview_path, stats


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("out_dir")
    ap.add_argument("--height-mm", type=float, default=140)
    ap.add_argument("--max-width-mm", type=float, default=None)
    ap.add_argument("--colors", type=int, default=8)
    a = ap.parse_args()
    dst, prev, stats = digitize(a.input, a.out_dir, a.height_mm, a.colors, a.max_width_mm)
    print(json.dumps(stats, indent=2))
