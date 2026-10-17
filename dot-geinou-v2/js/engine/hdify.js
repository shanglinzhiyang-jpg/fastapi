// Scale2x (EPX) upscaling: turns 1x pixel art into 2x art with smoothed
// diagonals instead of plain doubled pixels. Used as the fallback for any
// tile, character or building that has no native HD drawing yet.

import { makeCanvas } from './util.js';

// Returns a new canvas twice the size of `src` (a canvas).
export function scale2x(src) {
  const w = src.width, h = src.height;
  const sx = src.getContext('2d');
  const inp = new Uint32Array(sx.getImageData(0, 0, w, h).data.buffer);
  const [cv, c] = makeCanvas(w * 2, h * 2);
  const outData = c.createImageData(w * 2, h * 2);
  const out = new Uint32Array(outData.data.buffer);
  const W2 = w * 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = inp[y * w + x];
      const a = y > 0 ? inp[(y - 1) * w + x] : p;
      const b = x < w - 1 ? inp[y * w + x + 1] : p;
      const cc = x > 0 ? inp[y * w + x - 1] : p;
      const d = y < h - 1 ? inp[(y + 1) * w + x] : p;
      let e0 = p, e1 = p, e2 = p, e3 = p;
      if (a !== d && cc !== b) {
        if (cc === a) e0 = a;
        if (a === b) e1 = b;
        if (d === cc) e2 = cc;
        if (b === d) e3 = d;
      }
      const o = y * 2 * W2 + x * 2;
      out[o] = e0; out[o + 1] = e1;
      out[o + W2] = e2; out[o + W2 + 1] = e3;
    }
  }
  c.putImageData(outData, 0, 0);
  return cv;
}
