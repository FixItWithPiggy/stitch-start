// Stitch Start auto-digitizer: picture (RGBA pixels) -> embroidery stitches -> DST file.
// Runs entirely in the browser (or Node). No dependencies.
//
// Works best on simple artwork: solid colors, clean edges, transparent or plain background.
// Steps:
//   1. Separate the art from the background.
//   2. Pull dark outlines out as their own thread, then reduce the rest to a few colors (k-means in Lab).
//   3. Merge specks too small to stitch into the neighboring color.
//   4. Thin shapes -> running stitch along their edges. Bigger shapes -> underlay + tatami fill.
//   5. A dark running-stitch outline where clearly different colors meet (cartoon look).
//   6. Order colors light to dark (outlines last), add tie-in/tie-off stitches, write DST.

export const DEFAULTS = {
  fillSpacing: 0.42, // mm between fill rows
  fillStitch: 3.0, // mm stitch length in fills
  underlaySpacing: 2.0,
  runStitch: 2.0, // mm stitch length along outlines
  pullComp: 0.15, // mm; widen fills slightly because thread pulls fabric in
  thinMm: 1.4, // shapes thinner than this become running-stitch outlines
  minAreaMm2: 1.5, // smaller specks merge into neighbors
  jumpTrimMm: 2.5, // moves longer than this trim and jump
  maxConnectMm: 1.6, // longest sideways step when joining one fill row to the next
  outlineGray: 70, // pixels darker than this count as outline
  edgeContrast: 28, // Lab distance between colors that earns an outline
  maxStitchMm: 12.1, // DST limit per record
};

// ---------- Small helpers ----------

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
export function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Square min (erode) or max (dilate) filter of radius r on a 0/1 mask, separable. */
function morph(mask, w, h, r, dilate) {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = dilate ? 0 : 1;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) {
        const m = mask[y * w + k];
        if (dilate ? m : !m) { v = dilate ? 1 : 0; break; }
      }
      // pixels beyond the edge count as background for erosion
      if (!dilate && (x - r < 0 || x + r > w - 1)) v = 0;
      tmp[y * w + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = dilate ? 0 : 1;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) {
        const m = tmp[k * w + x];
        if (dilate ? m : !m) { v = dilate ? 1 : 0; break; }
      }
      if (!dilate && (y - r < 0 || y + r > h - 1)) v = 0;
      out[y * w + x] = v;
    }
  }
  return out;
}
const opening = (m, w, h, r) => morph(morph(m, w, h, r, false), w, h, r, true);

/** Connected components (8-way) of a 0/1 mask. Returns {comp: Int32Array, sizes: number[]}. */
function components(mask, w, h) {
  const comp = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || comp[i] !== -1) continue;
    const id = sizes.length;
    let sp = 0, n = 0;
    stack[sp++] = i;
    comp[i] = id;
    while (sp) {
      const p = stack[--sp];
      n++;
      const px = p % w, py = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = py + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = px + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] && comp[q] === -1) { comp[q] = id; stack[sp++] = q; }
        }
      }
    }
    sizes.push(n);
  }
  return { comp, sizes };
}

/** Give every unlabeled pixel inside `mask` the label of its nearest labeled pixel (BFS). */
function fillNearest(labels, mask, w, h) {
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (let i = 0; i < w * h; i++) if (labels[i] >= 0) queue[tail++] = i;
  while (head < tail) {
    const p = queue[head++];
    const px = p % w, py = (p / w) | 0;
    const nb = [p - 1, p + 1, p - w, p + w];
    const ok = [px > 0, px < w - 1, py > 0, py < h - 1];
    for (let k = 0; k < 4; k++) {
      if (!ok[k]) continue;
      const q = nb[k];
      if (mask[q] && labels[q] < 0) { labels[q] = labels[p]; queue[tail++] = q; }
    }
  }
}

// ---------- Contours (marching squares) ----------

/** Closed boundary loops of a 0/1 mask, in pixel coordinates. */
function contours(mask, w, h) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  const next = new Map(); // "x,y" -> [x,y] of the following point
  const add = (a, b) => { next.set(a[0] + ',' + a[1], b); };
  // Edge midpoints of cell (x,y) whose corners are pixel centers (x,y),(x+1,y),(x+1,y+1),(x,y+1)
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (c === 0 || c === 15) continue;
      const T = [x + 0.5, y], R = [x + 1, y + 0.5], B = [x + 0.5, y + 1], L = [x, y + 0.5];
      // Segments oriented with the inside on the left, so loops link head-to-tail.
      switch (c) {
        case 1: add(L, B); break;
        case 2: add(B, R); break;
        case 3: add(L, R); break;
        case 4: add(R, T); break;
        case 5: add(L, T); add(R, B); break;
        case 6: add(B, T); break;
        case 7: add(L, T); break;
        case 8: add(T, L); break;
        case 9: add(T, B); break;
        case 10: add(T, R); add(B, L); break;
        case 11: add(T, R); break;
        case 12: add(R, L); break;
        case 13: add(R, B); break;
        case 14: add(B, L); break;
      }
    }
  }
  const loops = [];
  const seen = new Set();
  for (const [key, first] of next) {
    if (seen.has(key)) continue;
    const loop = [];
    let k = key;
    let guard = 0;
    while (!seen.has(k) && guard++ < 1e7) {
      seen.add(k);
      const [sx, sy] = k.split(',').map(Number);
      loop.push([sx, sy]);
      const n = next.get(k);
      if (!n) break;
      k = n[0] + ',' + n[1];
    }
    if (loop.length > 2) loops.push(loop);
    void first;
  }
  return loops;
}

function resampleLoop(loop, step) {
  const pts = [...loop, loop[0]];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  // Thin out points closer than step, keeping corners roughly.
  const res = [out[0]];
  let acc = 0;
  for (let i = 1; i < out.length; i++) {
    acc += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]);
    if (acc >= step || i === out.length - 1) { res.push(out[i]); acc = 0; }
  }
  return res;
}

function loopLength(loop) {
  let L = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

// ---------- Fill (tatami) on the raster ----------

/** Rows of stitches across a 0/1 mask at `angleDeg`, chained into continuous runs. Points in px. */
function tatami(mask, w, h, bbox, angleDeg, spacingPx, stitchPx, maxConnectPx, minSegPx) {
  const a = (angleDeg * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a); // along the row
  const vx = -Math.sin(a), vy = Math.cos(a); // across rows
  const [x0, y0, x1, y1] = bbox;
  const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  const ts = corners.map(([x, y]) => x * vx + y * vy);
  const ss = corners.map(([x, y]) => x * ux + y * uy);
  const tmin = Math.min(...ts), tmax = Math.max(...ts), smin = Math.min(...ss) - 1, smax = Math.max(...ss) + 1;
  const inside = (s, t) => {
    const x = Math.round(s * ux + t * vx), y = Math.round(s * uy + t * vy);
    return x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  };
  const rows = [];
  for (let t = tmin + spacingPx / 2; t < tmax; t += spacingPx) {
    const segs = [];
    let start = null;
    const step = 0.5;
    for (let s = smin; s <= smax + step; s += step) {
      const inn = s <= smax && inside(s, t);
      if (inn && start === null) start = s;
      if (!inn && start !== null) {
        if (s - step - start >= minSegPx) segs.push([start, s - step, t]);
        start = null;
      }
    }
    rows.push(segs);
  }
  const used = rows.map((r) => r.map(() => false));
  const runs = [];
  const toXY = (s, t) => [s * ux + t * vx, s * uy + t * vy];
  for (let r0 = 0; r0 < rows.length; r0++) {
    for (let s0 = 0; s0 < rows[r0].length; s0++) {
      if (used[r0][s0]) continue;
      const run = [];
      let r = r0, s = s0, forward = true;
      for (;;) {
        used[r][s] = true;
        const [a0, a1, t] = rows[r][s];
        const offset = ((r % 3) * stitchPx) / 3;
        const xs = [a0];
        for (let x = a0 + stitchPx - offset; x < a1 - stitchPx * 0.17; x += stitchPx) if (x > a0) xs.push(x);
        xs.push(a1);
        if (!forward) xs.reverse();
        for (const sv of xs) run.push(toXY(sv, t));
        const endS = forward ? a1 : a0;
        let nxt = -1;
        if (r + 1 < rows.length) {
          for (let j = 0; j < rows[r + 1].length; j++) {
            const [b0, b1] = rows[r + 1][j];
            if (!used[r + 1][j] && b0 < a1 && b1 > a0) {
              const startS = forward ? b1 : b0; // next row runs the other way
              if (Math.abs(startS - endS) <= maxConnectPx) nxt = j;
              break;
            }
          }
        }
        if (nxt < 0) break;
        r = r + 1; s = nxt; forward = !forward;
      }
      runs.push(run);
    }
  }
  return runs;
}

function orderRuns(runs, start) {
  const remaining = runs.slice();
  const out = [];
  let cur = start;
  while (remaining.length) {
    let best = 0, bestD = Infinity, rev = false;
    for (let i = 0; i < remaining.length; i++) {
      const r = remaining[i];
      const d0 = Math.hypot(r[0][0] - cur[0], r[0][1] - cur[1]);
      const d1 = Math.hypot(r[r.length - 1][0] - cur[0], r[r.length - 1][1] - cur[1]);
      if (d0 < bestD) { best = i; bestD = d0; rev = false; }
      if (d1 < bestD) { best = i; bestD = d1; rev = true; }
    }
    let r = remaining.splice(best, 1)[0];
    if (rev) r = r.slice().reverse();
    out.push(r);
    cur = r[r.length - 1];
  }
  return { runs: out, end: cur };
}

// ---------- Main ----------

/**
 * @param {{width:number,height:number,data:Uint8ClampedArray}} image RGBA pixels
 * @param {{heightMm?:number, widthMm?:number, maxWidthMm?:number, maxHeightMm?:number, colors?:number, outlines?:boolean}} options
 */
export function digitize(image, options = {}) {
  const P = { ...DEFAULTS, ...(options.params || {}) };
  const nColors = Math.max(2, Math.min(12, options.colors ?? 8));
  const addOutlines = options.outlines ?? true;
  const { width: W0, height: H0, data } = image;

  // 1. Mask: transparency if present, otherwise anything that isn't near-white.
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { hasAlpha = true; break; }
  const mask0 = new Uint8Array(W0 * H0);
  for (let i = 0; i < W0 * H0; i++) {
    const r = data[4 * i], g = data[4 * i + 1], b = data[4 * i + 2], a = data[4 * i + 3];
    mask0[i] = hasAlpha ? (a >= 128 ? 1 : 0) : r > 235 && g > 235 && b > 235 ? 0 : 1;
  }
  let bx0 = W0, by0 = H0, bx1 = -1, by1 = -1;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) if (mask0[y * W0 + x]) {
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
  if (bx1 < 0) throw new Error('The picture looks empty. Use artwork on a transparent or white background.');
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
  const rgb = new Uint8Array(w * h * 3);
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y + by0) * W0 + (x + bx0), di = y * w + x;
    rgb[3 * di] = data[4 * si]; rgb[3 * di + 1] = data[4 * si + 1]; rgb[3 * di + 2] = data[4 * si + 2];
    mask[di] = mask0[si];
  }

  // Size in mm.
  let mmPerPx;
  if (options.widthMm) mmPerPx = options.widthMm / w;
  else mmPerPx = (options.heightMm ?? 100) / h;
  if (options.maxWidthMm && w * mmPerPx > options.maxWidthMm) mmPerPx = options.maxWidthMm / w;
  if (options.maxHeightMm && h * mmPerPx > options.maxHeightMm) mmPerPx = options.maxHeightMm / h;
  const px = (mm) => mm / mmPerPx;

  // 2. Outline pixels, then color reduction on a lightly smoothed copy.
  const gray = (i) => 0.299 * rgb[3 * i] + 0.587 * rgb[3 * i + 1] + 0.114 * rgb[3 * i + 2];
  const darkPx = new Uint8Array(w * h);
  let darkCount = 0;
  for (let i = 0; i < w * h; i++) if (mask[i] && gray(i) < P.outlineGray) { darkPx[i] = 1; darkCount++; }
  const hasDark = darkCount * mmPerPx * mmPerPx > 5;
  const k = hasDark ? nColors - 1 : nColors;

  const smooth = medianRGB(rgb, mask, w, h, 2);
  const lab = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const L = rgbToLab(smooth[3 * i], smooth[3 * i + 1], smooth[3 * i + 2]);
    lab[3 * i] = L[0]; lab[3 * i + 1] = L[1]; lab[3 * i + 2] = L[2];
  }
  const pool = [];
  for (let i = 0; i < w * h; i++) if (mask[i] && !(hasDark && darkPx[i])) pool.push(i);
  const centers = kmeans(lab, pool, k, 7);
  let labels = new Int32Array(w * h).fill(-1);
  for (const i of pool) labels[i] = nearestCenter(lab, i, centers);
  // Thread color for each cluster: the average color of its pixels.
  const sums = centers.map(() => [0, 0, 0, 0]);
  for (const i of pool) {
    const s = sums[labels[i]];
    s[0] += smooth[3 * i]; s[1] += smooth[3 * i + 1]; s[2] += smooth[3 * i + 2]; s[3]++;
  }
  const palette = sums.map((s) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : [128, 128, 128]));
  const lightness = centers.map((c) => c[0]);
  let outlineLabel = -1;
  if (hasDark) {
    outlineLabel = k;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < w * h; i++) if (darkPx[i]) { labels[i] = k; r += rgb[3 * i]; g += rgb[3 * i + 1]; b += rgb[3 * i + 2]; }
    palette.push([r / darkCount, g / darkCount, b / darkCount]);
    lightness.push(-1);
  }

  // 3. Merge specks.
  const minPx = Math.max(4, Math.round(P.minAreaMm2 / (mmPerPx * mmPerPx)));
  for (let c = 0; c < palette.length; c++) {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = labels[i] === c ? 1 : 0;
    const { comp, sizes } = components(m, w, h);
    for (let i = 0; i < w * h; i++) if (comp[i] >= 0 && sizes[comp[i]] < minPx) labels[i] = -1;
  }
  fillNearest(labels, mask, w, h);

  // 5 (prepared here). Outline band: silhouette + contrasting color borders, sparing thin details.
  let outlineBand = null;
  const kThin = Math.max(1, Math.round(px(P.thinMm) / 2));
  if (addOutlines) {
    const labC = palette.map((c) => rgbToLab(...c));
    const edge = new Uint8Array(w * h);
    const differs = (a, b) => {
      if (a === b) return false;
      if (a < 0 || b < 0) return true; // silhouette
      const A = labC[a], B = labC[b];
      return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) > P.edgeContrast;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      const a = labels[i];
      const right = x + 1 < w ? labels[i + 1] : -1;
      const down = y + 1 < h ? labels[i + w] : -1;
      const left = x > 0 ? labels[i - 1] : -1;
      const up = y > 0 ? labels[i - w] : -1;
      if (differs(a, right) || differs(a, down) || ((left < 0 || up < 0) && differs(a, -1))) edge[i] = 1;
    }
    // Thin colored details (glasses frames) would disappear under an outline: protect them.
    const thinAny = new Uint8Array(w * h);
    for (let c = 0; c < palette.length; c++) {
      if (c === outlineLabel) continue;
      const m = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) m[i] = labels[i] === c ? 1 : 0;
      const op = opening(m, w, h, kThin);
      for (let i = 0; i < w * h; i++) if (m[i] && !op[i]) thinAny[i] = 1;
    }
    const protect = morph(thinAny, w, h, 1, true);
    for (let i = 0; i < w * h; i++) if (protect[i]) edge[i] = 0;

    if (outlineLabel < 0) {
      outlineLabel = palette.length;
      palette.push([40, 30, 30]);
      lightness.push(-1);
    }
    // Thick dark areas (a phone screen, an open mouth) stay as solid dark fills.
    const dark = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) dark[i] = labels[i] === outlineLabel ? 1 : 0;
    const thickDark = opening(dark, w, h, kThin);
    outlineBand = new Uint8Array(w * h);
    const relabel = new Int32Array(labels);
    for (let i = 0; i < w * h; i++) {
      if (edge[i] || (dark[i] && !thickDark[i])) outlineBand[i] = 1;
      if (dark[i] && !thickDark[i]) relabel[i] = -1;
    }
    fillNearest(relabel, mask, w, h);
    for (let i = 0; i < w * h; i++) if (thickDark[i]) relabel[i] = outlineLabel;
    labels = relabel;
  }

  // 4. Stitches per color, light to dark.
  const order = palette.map((_, i) => i).sort((a, b) => lightness[b] - lightness[a]);
  const angles = [45, 135, 0, 90, 30, 120, 60, 150];
  const blocks = [];
  let cur = [w / 2, h / 2];
  order.forEach((c, n) => {
    const isOutline = addOutlines && c === outlineLabel;
    const m = new Uint8Array(w * h);
    let count = 0;
    for (let i = 0; i < w * h; i++) if (labels[i] === c) { m[i] = 1; count++; }
    const runs = [];
    if (count) {
      const { comp, sizes } = components(m, w, h);
      const boxes = sizes.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
      for (let i = 0; i < w * h; i++) {
        const id = comp[i];
        if (id < 0) continue;
        const x = i % w, y = (i / w) | 0, bb = boxes[id];
        if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y;
      }
      sizes.forEach((size, id) => {
        if (size * mmPerPx * mmPerPx < P.minAreaMm2) return;
        const cm = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) if (comp[i] === id) cm[i] = 1;
        const op = opening(cm, w, h, kThin);
        let kept = 0;
        for (let i = 0; i < w * h; i++) kept += op[i];
        const bb = boxes[id];
        if (kept < size * 0.3) {
          for (const loop of contours(cm, w, h)) if (loopLength(loop) * mmPerPx >= 3) runs.push(resampleLoop(loop, px(P.runStitch)));
        } else {
          const angle = angles[n % angles.length];
          const under = morph(cm, w, h, Math.max(1, Math.round(px(0.4))), false);
          runs.push(...tatami(under, w, h, bb, angle + 90, px(P.underlaySpacing), px(P.fillStitch), px(P.maxConnectMm), px(0.4)));
          const fill = morph(cm, w, h, Math.round(px(P.pullComp)), true);
          runs.push(...tatami(fill, w, h, [bb[0] - 2, bb[1] - 2, bb[2] + 2, bb[3] + 2], angle, px(P.fillSpacing), px(P.fillStitch), px(P.maxConnectMm), px(0.2)));
        }
      });
    }
    if (isOutline && outlineBand) {
      for (const loop of contours(outlineBand, w, h)) if (loopLength(loop) * mmPerPx >= 3) runs.push(resampleLoop(loop, px(P.runStitch)));
    }
    const cleaned = runs.filter((r) => r.length > 1);
    if (!cleaned.length) return;
    const ordered = orderRuns(cleaned, cur);
    cur = ordered.end;
    blocks.push({ label: c, rgb: palette[c].map(Math.round), hex: hex(palette[c]), runs: ordered.runs, isOutline });
  });

  // 6. Commands in 0.1 mm units, centered on the design, with ties.
  const cx = w / 2, cy = h / 2;
  const U = (p) => [Math.round((p[0] - cx) * mmPerPx * 10), Math.round((p[1] - cy) * mmPerPx * 10)];
  const records = []; // {x, y, cmd: 'stitch'|'jump'|'trim'|'color'|'end'}
  let last = [0, 0];
  const maxStep = Math.floor(P.maxStitchMm * 10);
  const moveTo = (to, cmd) => {
    let [x, y] = last;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(to[0] - x), Math.abs(to[1] - y)) / maxStep));
    for (let s = 1; s <= steps; s++) {
      records.push({ x: Math.round(x + ((to[0] - x) * s) / steps), y: Math.round(y + ((to[1] - y) * s) / steps), cmd });
    }
    last = to;
  };
  const tie = (a, b) => {
    // three tiny stitches back and forth toward b, to lock the thread
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = [Math.round(a[0] + ((b[0] - a[0]) / d) * 5), Math.round(a[1] + ((b[1] - a[1]) / d) * 5)];
    moveTo(t, 'stitch'); moveTo(a, 'stitch'); moveTo(t, 'stitch'); moveTo(a, 'stitch');
  };
  const colorStats = [];
  blocks.forEach((blk, bi) => {
    if (bi > 0) records.push({ x: last[0], y: last[1], cmd: 'color' });
    let stitches = 0;
    let first = true;
    for (const run of blk.runs) {
      const pts = run.map(U);
      const start = pts[0];
      const gap = Math.hypot(start[0] - last[0], start[1] - last[1]) / 10;
      if (first || gap > P.jumpTrimMm) {
        if (!first) {
          tie(last, pts.length > 1 ? last : start);
          records.push({ x: last[0], y: last[1], cmd: 'trim' });
        }
        moveTo(start, 'jump');
        if (pts.length > 1) tie(start, pts[1]);
      } else {
        moveTo(start, 'stitch');
      }
      for (let i = 1; i < pts.length; i++) { moveTo(pts[i], 'stitch'); stitches++; }
      first = false;
    }
    tie(last, last);
    colorStats.push({ order: bi + 1, hex: blk.hex, rgb: blk.rgb, stitches, isOutline: blk.isOutline });
  });
  records.push({ x: last[0], y: last[1], cmd: 'trim' });
  records.push({ x: last[0], y: last[1], cmd: 'end' });

  const stitchCount = records.filter((r) => r.cmd === 'stitch').length;
  const colorChanges = records.filter((r) => r.cmd === 'color').length;
  return {
    widthMm: w * mmPerPx,
    heightMm: h * mmPerPx,
    mmPerPx,
    pixelSize: [w, h],
    records,
    blocks,
    colors: colorStats,
    stitches: stitchCount,
    colorChanges,
    trims: records.filter((r) => r.cmd === 'trim').length,
    minutes: Math.round((stitchCount / 600 + colorChanges) * 10) / 10,
  };
}

function medianRGB(rgb, mask, w, h, r) {
  const out = new Uint8Array(rgb);
  const buf = [[], [], []];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!mask[i]) continue;
    buf[0].length = buf[1].length = buf[2].length = 0;
    for (let dy = -r; dy <= r; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const j = yy * w + xx;
        if (!mask[j]) continue;
        buf[0].push(rgb[3 * j]); buf[1].push(rgb[3 * j + 1]); buf[2].push(rgb[3 * j + 2]);
      }
    }
    for (let c = 0; c < 3; c++) {
      const b = buf[c].sort((p, q) => p - q);
      out[3 * i + c] = b[b.length >> 1];
    }
  }
  return out;
}

function nearestCenter(lab, i, centers) {
  let best = 0, bd = Infinity;
  const L = lab[3 * i], A = lab[3 * i + 1], B = lab[3 * i + 2];
  for (let c = 0; c < centers.length; c++) {
    const d = (L - centers[c][0]) ** 2 + (A - centers[c][1]) ** 2 + (B - centers[c][2]) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function kmeans(lab, pool, k, seed) {
  const rand = rng(seed);
  const sample = [];
  const step = Math.max(1, Math.floor(pool.length / 20000));
  for (let i = 0; i < pool.length; i += step) sample.push(pool[i]);
  const pt = (i) => [lab[3 * i], lab[3 * i + 1], lab[3 * i + 2]];
  // k-means++ start
  const centers = [pt(sample[Math.floor(rand() * sample.length)])];
  const d2 = new Float64Array(sample.length);
  while (centers.length < Math.min(k, sample.length)) {
    let sum = 0;
    sample.forEach((i, j) => {
      let m = Infinity;
      for (const c of centers) m = Math.min(m, (lab[3 * i] - c[0]) ** 2 + (lab[3 * i + 1] - c[1]) ** 2 + (lab[3 * i + 2] - c[2]) ** 2);
      d2[j] = m; sum += m;
    });
    let t = rand() * sum, j = 0;
    while (j < sample.length - 1 && (t -= d2[j]) > 0) j++;
    centers.push(pt(sample[j]));
  }
  for (let iter = 0; iter < 30; iter++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    for (const i of sample) {
      const c = nearestCenter(lab, i, centers);
      acc[c][0] += lab[3 * i]; acc[c][1] += lab[3 * i + 1]; acc[c][2] += lab[3 * i + 2]; acc[c][3]++;
    }
    let moved = 0;
    acc.forEach((a, c) => {
      if (!a[3]) return;
      const nc = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
      moved += Math.hypot(nc[0] - centers[c][0], nc[1] - centers[c][1], nc[2] - centers[c][2]);
      centers[c] = nc;
    });
    if (moved < 0.5) break;
  }
  return centers;
}

// ---------- DST writer ----------

function encodeRecord(dx, dy, kind) {
  let x = dx, y = -dy;
  let b0 = 0, b1 = 0, b2 = 0;
  if (kind === 'color') return [0, 0, 0xc3];
  if (kind === 'end') return [0, 0, 0xf3];
  if (kind === 'jump') b2 |= 0x80;
  b2 |= 0x03;
  if (x > 40) { b2 |= 0x04; x -= 81; }
  if (x < -40) { b2 |= 0x08; x += 81; }
  if (x > 13) { b1 |= 0x04; x -= 27; }
  if (x < -13) { b1 |= 0x08; x += 27; }
  if (x > 4) { b0 |= 0x04; x -= 9; }
  if (x < -4) { b0 |= 0x08; x += 9; }
  if (x > 1) { b1 |= 0x01; x -= 3; }
  if (x < -1) { b1 |= 0x02; x += 3; }
  if (x > 0) { b0 |= 0x01; x -= 1; }
  if (x < 0) { b0 |= 0x02; x += 1; }
  if (y > 40) { b2 |= 0x20; y -= 81; }
  if (y < -40) { b2 |= 0x10; y += 81; }
  if (y > 13) { b1 |= 0x20; y -= 27; }
  if (y < -13) { b1 |= 0x10; y += 27; }
  if (y > 4) { b0 |= 0x20; y -= 9; }
  if (y < -4) { b0 |= 0x10; y += 9; }
  if (y > 1) { b1 |= 0x80; y -= 3; }
  if (y < -1) { b1 |= 0x40; y += 3; }
  if (y > 0) { b0 |= 0x80; y -= 1; }
  if (y < 0) { b0 |= 0x40; y += 1; }
  if (x !== 0 || y !== 0) throw new Error('Stitch too long for DST');
  return [b0, b1, b2];
}

/** Builds the bytes of a .dst file from digitize() output. */
export function writeDST(result, name = 'StitchStart') {
  const recs = result.records;
  const bytes = [];
  let xx = 0, yy = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0, count = 0;
  for (const r of recs) {
    if (r.cmd === 'trim') {
      // DST has no trim command; machines read three small jumps as "trim here".
      for (const [dx, dy] of [[2, 2], [-4, -4], [2, 2]]) { bytes.push(...encodeRecord(dx, dy, 'jump')); count++; }
      continue;
    }
    const dx = r.x - xx, dy = r.y - yy;
    bytes.push(...encodeRecord(dx, dy, r.cmd === 'stitch' ? 'stitch' : r.cmd));
    count++;
    xx = r.x; yy = r.y;
    minX = Math.min(minX, xx); maxX = Math.max(maxX, xx); minY = Math.min(minY, yy); maxY = Math.max(maxY, yy);
  }
  const pad = (s, n) => String(s).padStart(n, ' ');
  const sign = (v) => (v >= 0 ? '+' : '-') + pad(Math.abs(v), 5);
  // DST's y axis points up, so the "+Y" extent is the top (our minimum y).
  const header =
    `LA:${String(name).slice(0, 16).padEnd(16, ' ')}\r` +
    `ST:${pad(count, 7)}\r` +
    `CO:${pad(result.colorChanges, 3)}\r` +
    `+X:${pad(Math.abs(maxX), 5)}\r` +
    `-X:${pad(Math.abs(minX), 5)}\r` +
    `+Y:${pad(Math.abs(minY), 5)}\r` +
    `-Y:${pad(Math.abs(maxY), 5)}\r` +
    `AX:${sign(xx)}\r` +
    `AY:${sign(-yy)}\r` +
    `MX:+${pad(0, 5)}\r` +
    `MY:+${pad(0, 5)}\r` +
    `PD:******\r`;
  const head = new Uint8Array(512).fill(0x20);
  for (let i = 0; i < header.length; i++) head[i] = header.charCodeAt(i) & 0xff;
  head[header.length] = 0x1a;
  const out = new Uint8Array(512 + bytes.length);
  out.set(head, 0);
  out.set(bytes, 512);
  return out;
}

/** Draws the stitches onto a 2D canvas context. */
export function drawPreview(ctx, result, { pxPerMm = 8, padMm = 4, background = '#ECE6D8' } = {}) {
  const W = Math.ceil((result.widthMm + padMm * 2) * pxPerMm);
  const H = Math.ceil((result.heightMm + padMm * 2) * pxPerMm);
  ctx.canvas.width = W;
  ctx.canvas.height = H;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const s = result.mmPerPx * pxPerMm;
  for (const blk of result.blocks) {
    const shade = `rgb(${blk.rgb.map((v) => Math.max(0, v - 45)).join(',')})`;
    const col = `rgb(${blk.rgb.join(',')})`;
    for (const [color, width] of [[shade, Math.max(1.5, pxPerMm * 0.5)], [col, Math.max(1, pxPerMm * 0.32)]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (const run of blk.runs) {
        run.forEach(([x, y], i) => {
          const X = x * s + padMm * pxPerMm, Y = y * s + padMm * pxPerMm;
          if (i === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        });
      }
      ctx.stroke();
    }
  }
  return { width: W, height: H };
}
