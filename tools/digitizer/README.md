# Picture-to-stitches digitizer

`digitizer.js` turns simple artwork (PNG/JPG, solid colors, transparent or white background) into embroidery stitches and writes a DST file. No dependencies; it runs in the browser or Node.

- `digitize(imageData, { heightMm, maxWidthMm, maxHeightMm, colors, outlines })` returns stitches, thread colors in order, and stats.
- `writeDST(result, name)` returns the bytes of a `.dst` file.
- `drawPreview(ctx, result)` draws the stitches on a canvas.

`digitize_reference.py` is the first Python version, kept for comparison (needs pyembroidery, opencv, shapely, scipy).

Works well for logos, clip art and lettering. Photos, gradients and fine detail still need a person to digitize them.
