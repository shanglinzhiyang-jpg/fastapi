// 車の絵 (R16): a side view of the player's car for the 愛車の情報 screen (car_app.js) and the マップ app's ride (phone_apps.js).
// Plain rectangles and discs on the HD canvas, in the style of the taxi and the bus there. The car faces right.

import { shade } from './util.js';

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); c.fill(); };

// w: body length, bh: the lower body, cx/cw/ch: the cabin (x offset, width, height), wx: the wheel centres, wr: wheel radius
const SPEC = {
  kei: { w: 150, bh: 26, cx: 26, cw: 98, ch: 28, wx: [32, 116], wr: 11 },
  compact: { w: 172, bh: 26, cx: 36, cw: 102, ch: 23, wx: [38, 134], wr: 12 },
  wagon: { w: 198, bh: 28, cx: 30, cw: 140, ch: 24, wx: [40, 158], wr: 12 },
  sedan: { w: 206, bh: 28, cx: 46, cw: 104, ch: 20, wx: [42, 164], wr: 12 },
  suv: { w: 198, bh: 32, cx: 30, cw: 132, ch: 27, wx: [42, 156], wr: 14 },
  sports: { w: 198, bh: 24, cx: 62, cw: 78, ch: 17, wx: [42, 158], wr: 12 },
};

// (x, gy): the left of the car and the ground line. t: the frame (wheels turn). color: the paint. body: kei / compact / wagon / sedan / suv / sports.
export function drawCarSide(c, x, gy, t, color, body = 'compact') {
  const S = SPEC[body] || SPEC.compact;
  const bob = Math.round(Math.sin(t / 4) * 0.8);
  const top = gy - S.wr * 2 + 6 - S.bh - S.ch + bob; // the roof line
  const by = top + S.ch; // the lower body starts here
  const dark = shade(color, -0.55);
  R(c, x + 8, gy - 3, S.w - 16, 6, 'rgba(0,0,0,0.25)'); // shadow
  // the lower body and its highlight
  R(c, x, by, S.w, S.bh, dark); R(c, x + 1, by + 1, S.w - 2, S.bh - 2, color); R(c, x + 1, by + 1, S.w - 2, 3, shade(color, 0.3));
  R(c, x + 1, by + Math.round(S.bh * 0.58), S.w - 2, 2, shade(color, -0.25)); // the door line
  // the cabin
  if (body === 'sports') {
    // a low cabin: the rear slopes a little, the windscreen (right) a lot
    const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(Math.round(x + px), Math.round(top + py)) : c.moveTo(Math.round(x + px), Math.round(top + py)))); c.closePath(); c.fill(); };
    poly([[S.cx, S.ch], [S.cx + 14, 0], [S.cx + S.cw - 30, 0], [S.cx + S.cw, S.ch]], dark);
    poly([[S.cx + 2, S.ch], [S.cx + 15, 1], [S.cx + S.cw - 29, 1], [S.cx + S.cw - 2, S.ch]], color);
    poly([[S.cx + 7, S.ch - 1], [S.cx + 17, 3], [S.cx + S.cw - 31, 3], [S.cx + S.cw - 9, S.ch - 1]], '#9ac8e8');
    R(c, x + S.cx + 34, top + 3, 3, S.ch - 4, dark); // the pillar
  } else {
    R(c, x + S.cx, top, S.cw, S.ch, dark); R(c, x + S.cx + 1, top + 1, S.cw - 2, S.ch - 1, color);
    const gw = Math.floor((S.cw - 14) / 2) - 1;
    R(c, x + S.cx + 6, top + 4, gw, S.ch - 7, '#9ac8e8'); R(c, x + S.cx + 8 + gw, top + 4, gw, S.ch - 7, '#9ac8e8');
    R(c, x + S.cx + 6, top + 4, gw, 2, '#d8eefc'); R(c, x + S.cx + 8 + gw, top + 4, gw, 2, '#d8eefc');
    R(c, x + S.cx + 6 + gw, top + 3, 2, S.ch - 5, dark); // the pillar
    if (body === 'suv') R(c, x + S.cx + 10, top - 4, S.cw - 20, 3, '#3a3a44'); // the roof rail
    if (body === 'wagon') R(c, x + S.cx + 4, top - 3, S.cw - 8, 2, '#3a3a44');
  }
  // lights, bumper, grille
  R(c, x + S.w - 8, by + 5, 7, 6, '#fff6a8'); R(c, x + 1, by + 5, 5, 6, '#e8384f'); R(c, x + S.w - 3, by + S.bh - 8, 3, 6, shade(color, -0.3));
  R(c, x + S.w - 12, by + S.bh - 6, 11, 3, '#3a3a44');
  // wheels
  for (const wx of S.wx) {
    const cx = x + wx, cy = gy - S.wr;
    disc(c, cx, cy, S.wr, '#1e1e26'); disc(c, cx, cy, Math.round(S.wr / 2), '#a0a6b0');
    const a = t * 0.5;
    R(c, cx - 1 + Math.cos(a) * (S.wr / 3), cy - 1 + Math.sin(a) * (S.wr / 3), 2, 2, '#1e1e26');
  }
}
export const carWidth = (body) => (SPEC[body] || SPEC.compact).w;
