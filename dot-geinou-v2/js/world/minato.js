// テレビ局エリア ('minato'): a big town east of 東京エリア where the TV stations stand.
//
// Town (92x64). The main boulevard 「テレビ通り」 (road rows 25..27) runs west-east; its
// west end walks back to Tokyo (Tokyo's east edge). Two avenues (x 30..32, 60..62)
// cut the town into six districts (all fictional names, loosely inspired by real areas):
//   NW あかね坂        a hill (retaining wall + stairs) with TBS on top
//   N  スターヒル広場   red-tiled plaza, open-air stage, street vision, a Japanese
//                      garden with a pond, テレビ朝日 and a skyscraper
//   NE 電波塔通り       office street with テレビ東京, a red-and-white radio tower,
//                      a cafe, a convenience store and a hotel
//   SW しおさい広場     plaza with 日本テレビ's tower, an office block, a karakuri clock
//   S  まんなか公園     food trucks, a street performer's stage, a park with a fountain,
//                      a TV crew, the bus stop (to 東京駅前 / ドット商店街)
//   SE うみかぜ埠頭     フジテレビ (lattice towers with a silver sphere), a Ferris wheel
// Under the monorail 「ベイライン」 (pillars on row 50) a promenade runs the whole width;
// two stations (しおさい広場駅 / うみかぜ埠頭駅) link west and east (¥190). South of it:
// a boardwalk, a beach, a pier and the sea (boats, gulls).
//
// Places entered from here (other modules): ntv, tbs, tvasahi, fujitv, tvtokyo.
// flags (all prefixed minato_): minato_intro, minato_treat (`${day}:${n}` drinks),
//   minato_wheel (`${day}:${n}`), minato_bench_day, minato_karakuri_day,
//   minato_performer_day, minato_performer_met, minato_interview.
// The companies are real and shown respectfully; every person, shop and program here is fictional.

import { registerPlace, PLACES } from '../engine/map.js';
import { defineTile, R, P, Rw, Pw, disc, oval, ring, line, outline, dither, shadowEllipse, blobs, ramp, speckle } from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { text } from '../engine/draw.js';
import { VIEW_W, VIEW_H, makeCanvas, shade, fmtMoney } from '../engine/util.js';
import { grid, set, put, fill, hroad, vroad } from './townkit.js';
import { fountain, busStop, streetStage, statue } from './props.js';

export const MINATO_W = 92;
export const MINATO_H = 64;
// Tokyo's main road (rows 19..23 at its east edge) arrives on rows 24..28 here.
export const MINATO_FROM_TOKYO = 5;
const MONO = 50;                                        // monorail pillar row
const PILLARS = [6, 14, 22, 38, 46, 54, 68, 76, 86];
const WEST_STATION = { x: 24, front: [25, 52] };
const EAST_STATION = { x: 78, front: [79, 52] };

// ====================================================================== small helpers
const OUT = '#22202a';
const RND = (r, n) => Math.floor(r() * n);
const who = (n) => ({ name: n.name, look: n.look });
const hu = (v) => Math.round(v * 2) / 2;
const U = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }; // unit-space rect
// Is a box (sx..sx+w, sy-up..sy+down) near the screen? (camera-relative units)
const onScreen = (sx, sy, w, up, down) => sx + w > -8 && sx < VIEW_W + 8 && sy + down > -8 && sy - up < VIEW_H + 8;

function dayCount(g, k) {
  const [d, n] = String(g.flag(k) || '').split(':').map(Number);
  return d === g.state.day ? n || 0 : 0;
}
function bumpDay(g, k) { const n = dayCount(g, k) + 1; g.setFlag(k, `${g.state.day}:${n}`); return n; }
const today = (g, k) => g.flag(k) === g.state.day;

function snap(g) { const L = g.state.life; return { st: g.state.stamina, hu: L.hunger, sr: L.stress, cl: L.clean }; }
function diffText(g, a) {
  const b = snap(g), out = [];
  if (b.st !== a.st) out.push(`体力${b.st > a.st ? '+' : ''}${b.st - a.st}`);
  if (b.hu !== a.hu) out.push(`満腹${b.hu > a.hu ? '+' : ''}${b.hu - a.hu}`);
  if (b.sr !== a.sr) out.push(`ストレス${b.sr > a.sr ? '+' : ''}${b.sr - a.sr}`);
  if (b.cl !== a.cl) out.push(`身だしなみ${b.cl > a.cl ? '+' : ''}${b.cl - a.cl}`);
  return out.join('　');
}

// Static art painted once on a 2x canvas (1 px = half a unit = 1 screen px).
const baked = new Map();
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (!cv) {
    const [c2, c] = makeCanvas(w * 2, h * 2);
    try { paint(c); } catch (e) { console.error('[minato] paint failed', key, e); }
    cv = c2;
    baked.set(key, cv);
  }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);
// thick (3px) line on a 2x canvas
function thick(c, x0, y0, x1, y1, col, k = 1) {
  for (let d = -k; d <= k; d++) line(c, Math.round(x0 + d), Math.round(y0), Math.round(x1 + d), Math.round(y1), col);
}

// ====================================================================== HD tiles
// Painted natively at 32x32 (hd); the 16px draw() is the same art sampled down.
function tile(id, def, hd) {
  defineTile(id, {
    ...def,
    hd,
    draw(c, r, f, v) {
      const [cv, c2] = makeCanvas(32, 32);
      hd(c2, r, f, v);
      c.drawImage(cv, 0, 0, 16, 16);
    },
  });
}

// ---- plaza paving: pale granite slabs in two tones, a brass survey marker now and then
tile('minato_plaza', { variants: 8 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#aba79e');
  for (let k = 0; k < 4; k++) {
    const x = (k % 2) * 16, y = (k >> 1) * 16;
    const col = ((k & 1) ^ (k >> 1)) ? '#d3cfc5' : '#e0dcd3';
    R(c, x + 1, y + 1, 15, 15, col);
    R(c, x + 1, y + 1, 15, 1, shade(col, 0.07)); R(c, x + 1, y + 2, 1, 13, shade(col, 0.04));
    R(c, x + 2, y + 15, 14, 1, shade(col, -0.09)); R(c, x + 15, y + 2, 1, 13, shade(col, -0.06));
    speckle(c, r, [shade(col, -0.05), shade(col, 0.05)], 7, x + 2, y + 2, 12, 12);
  }
  if (v === 7) { R(c, 14, 15, 4, 2, '#a89a7a'); R(c, 15, 14, 2, 4, '#a89a7a'); R(c, 15, 15, 2, 2, '#c8b88a'); P(c, 15, 15, '#e0d4b0'); }
});

// ---- red-tiled plaza (スターヒル広場): basket-weave terracotta pavers
tile('minato_redtile', { variants: 3 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#7a4a3a');
  const cols = ['#c8785a', '#b96c52', '#d48866'];
  for (let k = 0; k < 4; k++) {
    const x0 = (k % 2) * 16, y0 = (k >> 1) * 16, horiz = ((k & 1) ^ (k >> 1)) === 0;
    for (let i = 0; i < 2; i++) {
      const x = horiz ? x0 : x0 + i * 8, y = horiz ? y0 + i * 8 : y0, w = horiz ? 16 : 8, h = horiz ? 8 : 16;
      const col = v === 2 && k === 1 && i === 0 ? '#e6c49a' : cols[RND(r, 3)];
      R(c, x + 1, y + 1, w - 1, h - 1, col);
      R(c, x + 1, y + 1, w - 1, 1, shade(col, 0.12)); R(c, x + 1, y + 2, 1, h - 3, shade(col, 0.06));
      R(c, x + 2, y + h - 1, w - 2, 1, shade(col, -0.12));
      if (r() < 0.5) P(c, x + 2 + RND(r, w - 4), y + 2 + RND(r, h - 4), shade(col, -0.08));
    }
  }
});

// ---- boardwalk (waterfront): long planks, staggered joints, screws
tile('minato_deck', { variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#6a4630');
  for (let row = 0; row < 4; row++) {
    const y = row * 8, col = ['#b8875a', '#ad7e52', '#c08f62', '#b3825a'][(row + v) % 4];
    R(c, 0, y, 32, 7, col); R(c, 0, y, 32, 1, shade(col, 0.16)); R(c, 0, y + 6, 32, 1, shade(col, -0.16));
    for (let i = 0; i < 3; i++) Rw(c, RND(r, 32), y + 2 + RND(r, 3), 3 + RND(r, 6), 1, shade(col, -0.07));
    const jx = (row * 13 + v * 7) % 32;
    R(c, jx, y, 1, 7, '#6a4630');
    Pw(c, jx + 3, y + 3, '#5a3a24'); Pw(c, jx - 3, y + 3, '#5a3a24');
  }
});

// ---- sea: deep blue-green, drifting wave marks, a few glints
const SEA_WAVES = [[[3, 5], [19, 11], [9, 21], [24, 27]], [[12, 3], [27, 13], [4, 17], [17, 26]], [[22, 6], [7, 12], [21, 20], [10, 29]]];
tile('minato_sea', { solid: true, frames: 2, speed: 50, variants: 3 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2a68a6');
  for (let i = 0; i < 46; i++) Pw(c, RND(r, 32), RND(r, 32), ['#25609c', '#3072b2', '#2864a2'][i % 3]);
  const o = f * 7;
  for (const [x, y] of SEA_WAVES[v]) {
    Rw(c, x + o + 1, y, 5, 1, '#8cc0ee');
    Pw(c, x + o, y + 1, '#4a88c6'); Pw(c, x + o + 6, y + 1, '#4a88c6');
    Pw(c, x + o + 2, y, '#d8eeff');
  }
  if ((v + f) % 2 === 0) { Pw(c, 14 + v * 5, 15 - v * 3, '#ffffff'); Pw(c, 15 + v * 5, 15 - v * 3, '#cfe8ff'); }
});

// ---- quay edge: stone coping with mooring bitts, sea wall face, water below
tile('minato_quay', { solid: true, frames: 2, speed: 50, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 18, 32, 14, '#2a68a6');
  for (let i = 0; i < 16; i++) Pw(c, RND(r, 32), 21 + RND(r, 11), i & 1 ? '#25609c' : '#3072b2');
  R(c, 0, 18, 32, 2, '#1d4f84');
  Rw(c, f * 9 + v * 13, 21, 7, 1, '#cfe6fa'); Rw(c, f * 9 + v * 13 + 16, 22, 5, 1, '#9cc8ee');
  // wall face
  R(c, 0, 8, 32, 10, '#8a8e96');
  R(c, 0, 8, 32, 1, '#6e727a'); R(c, 0, 13, 32, 1, '#787c84');
  for (const [x, y] of [[7, 9], [23, 9], [15, 14], [31, 14]]) R(c, x, y, 1, 4, '#70747c');
  R(c, 0, 17, 32, 1, '#5e626a');
  speckle(c, r, ['#9a9ea6', '#7c8088'], 10, 0, 9, 32, 8);
  // coping
  R(c, 0, 0, 32, 8, '#cfcdc6'); R(c, 0, 0, 32, 1, '#ebe9e3'); R(c, 0, 6, 32, 1, '#b4b2ab'); R(c, 0, 7, 32, 1, '#8e8c86');
  R(c, 15, 0, 1, 7, '#b4b2ab');
  if (v === 0) {
    // mooring bitt
    R(c, 9, 0, 8, 6, '#3b3f48'); R(c, 8, -1 + 1, 10, 2, '#4a4e58'); R(c, 9, 0, 2, 5, '#6a6f7b'); R(c, 15, 1, 2, 5, '#2a2d36');
  }
});

// ---- beach shoreline: wet sand, a foam line that comes and goes, then water
tile('minato_shore', { solid: true, frames: 2, speed: 48, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2f74b4');
  for (let i = 0; i < 14; i++) Pw(c, RND(r, 32), 16 + RND(r, 16), i & 1 ? '#2a68a6' : '#3a80c0');
  const edge = 12 + f * 2;
  R(c, 0, 0, 32, edge, '#d9c48c');
  speckle(c, r, ['#cdb67c', '#e4d29e'], 26, 0, 0, 32, edge);
  R(c, 0, edge - 2, 32, 2, '#c4ac72');
  R(c, 0, edge, 32, 3, '#e8f4fb'); R(c, 0, edge + 3, 32, 1, '#a8d0f0');
  for (let x = (v * 5) % 8; x < 32; x += 8) { R(c, x, edge + 4, 4, 1, '#cfe6fa'); P(c, x + 1, edge - 1, '#f4f8fa'); }
});

// ---- retaining wall of あかね坂 (top course with a grass lip, and the lower courses)
function ashlar(c, r, y0, y1, k0) {
  R(c, 0, y0, 32, y1 - y0, '#857f72');
  for (let k = k0, y = y0; y < y1; y += 8, k++) {
    const off = k % 2 ? 8 : 0;
    for (let x = -off; x < 32; x += 16) {
      const col = ['#aaa395', '#a39c8e', '#b0a99b'][(k + Math.floor(x / 16) + 9) % 3];
      const top = Math.max(y0, y + 1), bot = Math.min(y1, y + 8);
      Rw(c, x + 1, top, 15, bot - top, col);
      if (y + 1 >= y0) Rw(c, x + 1, y + 1, 15, 1, shade(col, 0.12));
      if (y + 7 < y1) Rw(c, x + 1, y + 7, 15, 1, shade(col, -0.14));
    }
  }
  speckle(c, r, ['#9a9385', '#b8b1a3'], 12, 0, y0, 32, y1 - y0);
}
tile('minato_walltop', { solid: true }, (c, r) => {
  ashlar(c, r, 10, 32, 0);
  R(c, 0, 6, 32, 4, '#c8c2b4'); R(c, 0, 6, 32, 1, '#e0dacc'); R(c, 0, 9, 32, 1, '#8e887a');
  R(c, 0, 0, 32, 6, '#4f9a4a'); R(c, 0, 0, 32, 2, '#62b35b');
  for (let x = 0; x < 32; x += 3) { P(c, x, 6, '#4f9a4a'); if (x % 6 === 0) P(c, x + 1, 7, '#3f8a3a'); }
  for (let i = 0; i < 8; i++) Pw(c, RND(r, 32), RND(r, 4), '#79c76c');
});
tile('minato_wall', { solid: true }, (c, r) => {
  ashlar(c, r, 0, 26, 1);
  R(c, 0, 26, 32, 3, '#6e695e'); R(c, 0, 26, 32, 1, '#9a9486');
  R(c, 0, 29, 32, 3, '#8e8a84');
  R(c, 0, 29, 32, 1, '#5f5b54');
});
// ---- stone stairs down the hill
tile('minato_steps', {}, (c) => {
  R(c, 0, 0, 32, 32, '#9a9488');
  for (let k = 0; k < 4; k++) {
    const y = k * 8;
    R(c, 3, y, 26, 5, '#dcd7cc'); R(c, 3, y, 26, 1, '#eeeae0');
    R(c, 3, y + 5, 26, 3, '#a8a296'); R(c, 3, y + 7, 26, 1, '#8a8478');
  }
  for (const x of [0, 29]) { R(c, x, 0, 3, 32, '#b0aa9c'); R(c, x, 0, 1, 32, '#c8c2b4'); R(c, x + 2, 0, 1, 32, '#857f72'); }
});

// ---- footing of a monorail pillar (the column itself is drawn with the guideway)
tile('minato_pillar', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 26, 13, 3);
  R(c, 5, 10, 22, 16, '#b4b8c0'); R(c, 5, 10, 22, 2, '#dfe2e7'); R(c, 5, 12, 2, 14, '#cdd1d7'); R(c, 25, 12, 2, 14, '#8d939c');
  R(c, 5, 24, 22, 2, '#7d838c');
  R(c, 9, 0, 14, 10, '#c4c8cf'); R(c, 9, 0, 3, 10, '#e2e5ea'); R(c, 20, 0, 3, 10, '#9aa0aa');
  outline(c);
});

// ---- ginkgo (イチョウ): a tall fan-leaved tree, lime or golden
tile('minato_ginkgo', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 28, 10, 3);
  R(c, 14, 19, 4, 10, '#6e4a2c'); R(c, 14, 19, 1, 10, '#8e6440'); R(c, 17, 19, 1, 10, '#4e321c'); R(c, 13, 27, 6, 2, '#6e4a2c');
  const pal = v ? ['#9a6e14', '#c8961e', '#e8bc2e', '#f6d75a', '#fff0a0'] : ['#3f6a1e', '#5f8f2a', '#86b83a', '#aed456', '#d8ef8a'];
  blobs(c, [[16, 4.5, 4], [12, 9, 5], [20, 9, 5], [16, 11, 6], [10, 15, 5.5], [22, 15, 5.5], [16, 17, 7]], pal, { bias: -0.04 });
  outline(c);
  for (let i = 0; i < 7; i++) { const x = 9 + RND(r, 14), y = 4 + RND(r, 16); P(c, x, y, pal[4]); P(c, x + 1, y, pal[3]); }
});

// ---- palm tree (beach)
tile('minato_palm', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 10, 2);
  for (let i = 0; i < 22; i++) {
    const y = 29 - i, x = Math.round(14 + Math.sin(i / 9) * 3);
    R(c, x, y, 4, 1, i % 4 === 0 ? '#7a5a34' : '#9a7444'); P(c, x, y, '#b8905a'); P(c, x + 3, y, '#6a4a28');
  }
  const L = ['#2f7a3a', '#3f9a4a', '#5fb85a', '#86d070'];
  const frond = (pts) => { for (const [x, y, k] of pts) { R(c, x, y, 3, 2, L[k]); P(c, x, y, L[3]); } };
  frond([[17, 6, 2], [20, 5, 2], [23, 5, 1], [26, 6, 1], [28, 8, 0], [29, 10, 0]]);
  frond([[15, 6, 2], [12, 5, 2], [9, 5, 1], [6, 6, 1], [4, 8, 0], [3, 10, 0]]);
  frond([[18, 8, 1], [20, 10, 1], [22, 12, 0], [23, 14, 0]]);
  frond([[14, 8, 1], [12, 10, 1], [10, 12, 0], [9, 14, 0]]);
  frond([[16, 3, 3], [17, 1, 2], [15, 0, 2]]);
  disc(c, 15, 8, 1, '#7a4a20'); disc(c, 18, 8, 1, '#6a3e18');
  outline(c);
});

// ---- stone lantern (garden)
tile('minato_lantern', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 8, 2);
  const S = ['#7e7a72', '#9e9a90', '#bcb8ae', '#d6d2c8'];
  R(c, 10, 25, 12, 4, S[1]); R(c, 10, 25, 12, 1, S[3]); R(c, 21, 25, 1, 4, S[0]);
  R(c, 14, 17, 4, 8, S[2]); R(c, 14, 17, 1, 8, S[3]); R(c, 17, 17, 1, 8, S[0]);
  R(c, 11, 14, 10, 3, S[1]); R(c, 11, 14, 10, 1, S[3]);
  R(c, 12, 8, 8, 6, S[2]); R(c, 14, 9, 4, 4, '#ffe08a'); R(c, 14, 9, 4, 1, '#fff4c0'); R(c, 19, 8, 1, 6, S[0]);
  for (let i = 0; i < 4; i++) R(c, 9 + i, 7 - i, 14 - i * 2, 1, i ? S[1] : S[0]);
  R(c, 8, 7, 16, 1, S[2]); R(c, 15, 2, 2, 2, S[2]);
  outline(c);
});

// ---- bike-share dock (red bikes)
tile('minato_bikes', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 28, 14, 2);
  R(c, 2, 10, 4, 18, '#5a5f6b'); R(c, 2, 10, 1, 18, '#8d939e'); R(c, 1, 6, 6, 6, '#2a2d36'); R(c, 2, 7, 4, 3, '#5fd7ff');
  for (const x of [9, 20]) {
    ring(c, x + 2, 23, 3.2, 4.4, '#2a2d36'); ring(c, x + 9, 23, 3.2, 4.4, '#2a2d36');
    line(c, x + 2, 23, x + 5, 17, '#d62f2f'); line(c, x + 5, 17, x + 9, 23, '#d62f2f'); line(c, x + 5, 17, x + 9, 17, '#d62f2f'); line(c, x + 9, 17, x + 9, 23, '#d62f2f');
    R(c, x + 3, 15, 4, 1, '#20232a'); R(c, x + 9, 14, 2, 3, '#5a5f6b'); R(c, x + 10, 18, 3, 3, '#3b3f48');
  }
  R(c, 6, 26, 26, 2, '#7d8391');
  outline(c);
});

// ---- parasol table (food court / beach)
tile('minato_parasol', { solid: true, obj: true, variants: 3 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 28, 12, 3);
  const cols = [['#ff6f61', '#ffffff'], ['#2f9a4a', '#f4efe6'], ['#2f6fd0', '#ffd23f']][v];
  R(c, 15, 6, 2, 20, '#6a6f7b');
  oval(c, 8, 18, 16, 6, '#e8e4dc'); oval(c, 8, 17, 16, 5, '#f8f6f0'); R(c, 11, 23, 2, 5, '#9aa0aa'); R(c, 19, 23, 2, 5, '#9aa0aa');
  for (let i = 0; i < 9; i++) {
    const w = 2 + i * 1.6;
    for (let x = -w; x < w; x++) P(c, Math.round(16 + x), 1 + i, cols[Math.floor((x + 14) / 4) % 2]);
  }
  R(c, 2, 10, 28, 1, shade(cols[0], -0.3));
  P(c, 16, 0, '#6a6f7b');
  outline(c);
});

// ---- advertising pillar (広告塔): posters of programs
tile('minato_adtower', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 10, 2);
  R(c, 8, 4, 16, 25, '#e8e4dc');
  const posters = [['#d62f2f', '#ffd23f'], ['#2f6fd0', '#ffffff'], ['#2f9a4a', '#fff2a0']];
  posters.forEach(([bg, fg], i) => {
    const x = 8 + i * 5 + (i ? 1 : 0), w = i === 1 ? 5 : 5;
    R(c, x, 8, w, 18, bg); R(c, x, 10, w, 2, fg); R(c, x + 1, 14, w - 2, 1, fg); R(c, x + 1, 17, w - 2, 1, fg); R(c, x, 22, w, 2, shade(bg, 0.25));
  });
  R(c, 8, 4, 2, 25, 'rgba(255,255,255,0.35)'); R(c, 22, 4, 2, 25, 'rgba(0,0,0,0.18)');
  R(c, 6, 1, 20, 4, '#2a6a52'); R(c, 6, 1, 20, 1, '#4f9a74'); R(c, 13, 0, 6, 1, '#2a6a52');
  R(c, 7, 28, 18, 2, '#5a5f6b');
  outline(c);
});

// ---- bollards (avenue ends)
tile('minato_bollard', { solid: true, obj: true }, (c) => {
  for (const x of [7, 19]) {
    shadowEllipse(c, x + 3, 27, 4, 1);
    R(c, x, 14, 6, 13, '#9aa0aa'); R(c, x, 14, 2, 13, '#d5d9e0'); R(c, x + 5, 14, 1, 13, '#6d717b');
    oval(c, x, 12, 6, 4, '#c8ccd4'); R(c, x, 18, 6, 2, '#ffd23f');
  }
  outline(c);
});

// ---- coin-operated binoculars
tile('minato_scope', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 7, 2);
  R(c, 14, 14, 4, 15, '#4a7a9a'); R(c, 14, 14, 1, 15, '#7aaac8'); R(c, 11, 27, 10, 2, '#3a5a74');
  R(c, 9, 6, 14, 9, '#5a8aaa'); R(c, 9, 6, 14, 1, '#8ab8d6'); R(c, 7, 7, 3, 6, '#2a3a4a'); R(c, 22, 8, 2, 4, '#2a3a4a');
  P(c, 8, 8, '#9fd0ee'); R(c, 13, 10, 6, 2, '#ffd23f');
  outline(c);
});

// ====================================================================== props
// ---- monorail 「ベイライン」: guideway beam across the whole town, columns, a train
function paintBeam(c) {
  R(c, 0, 0, 32, 10, '#d8dce2'); R(c, 0, 1, 32, 1, '#f0f2f5'); R(c, 0, 4, 32, 2, '#aeb4bd'); R(c, 0, 4, 32, 1, '#c8cdd4');
  R(c, 0, 10, 32, 18, '#b9bec6'); R(c, 0, 10, 32, 1, '#8d939c'); R(c, 0, 18, 32, 1, '#c8ccd2');
  R(c, 31, 10, 1, 18, '#a0a6ae'); R(c, 0, 10, 1, 18, '#cfd3d9');
  R(c, 0, 28, 32, 3, '#7d838c');
  R(c, 0, 0, 32, 1, OUT); R(c, 0, 31, 32, 1, OUT);
}
function paintColumn(c) {
  for (let i = 0; i < 8; i++) R(c, 2 + i, i, 28 - i * 2, 1, i < 2 ? '#e2e5ea' : '#c8ccd2');
  R(c, 9, 8, 14, 52, '#c4c8cf'); R(c, 9, 8, 3, 52, '#e2e5ea'); R(c, 20, 8, 3, 52, '#9aa0aa');
  for (let y = 16; y < 56; y += 14) R(c, 9, y, 14, 1, '#b0b5bd');
  outline(c);
}
function paintCar(head) {
  return (c) => {
    const nose = (y) => (head ? Math.max(0, Math.round(10 - Math.sqrt(Math.max(0, 100 - (y - 18) * (y - 18) * 0.9)))) : 0);
    for (let y = 4; y < 30; y++) {
      const e = 78 - nose(y);
      const col = y < 6 ? '#ffffff' : y >= 20 && y < 24 ? '#2f6fd0' : y >= 26 ? '#8d939e' : '#f2f4f7';
      R(c, 2, y, e - 2, 1, col);
    }
    for (let x = 6; x < (head ? 60 : 74); x += 11) { R(c, x, 9, 9, 8, '#2a3a50'); R(c, x, 9, 9, 1, '#4a6a8a'); P(c, x + 1, 10, '#9fd0ee'); P(c, x + 2, 10, '#cfe8ff'); }
    if (head) { R(c, 62, 9, 10, 8, '#2a3a50'); R(c, 66, 10, 4, 2, '#9fd0ee'); R(c, 70, 22, 4, 2, '#ffe36e'); }
    R(c, 2, 24, head ? 70 : 76, 1, '#1e4a9a');
    R(c, 30, 8, 1, 16, '#c8ccd4');
    outline(c, { tint: 0.25 });
  };
}
function monorail(W) {
  const SPEED = 1.1, LEN = W * 16 + 360;
  return {
    type: 'prop', x: 0, y: MONO, w: W, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      const top = sy - 40;
      if (top + 66 < -8 || top - 20 > VIEW_H + 8) return;
      const x0 = Math.max(0, Math.floor(-sx / 16) - 1), x1 = Math.min(W - 1, Math.floor((VIEW_W - sx) / 16) + 1);
      // the player walking right behind the guideway (rows 47..50) sees it see-through
      const p = g.map && g.map.player;
      const under = p && !p.hidden && p.py >= (MONO - 3) * 16 && p.py <= MONO * 16;
      ctx.save();
      if (under) ctx.globalAlpha = 0.5;
      const col = bake('minato_column', 16, 30, paintColumn);
      for (const px of PILLARS) if (px >= x0 - 1 && px <= x1 + 1) blit(ctx, col, sx + px * 16, top + 14);
      const seg = bake('minato_beam', 16, 16, paintBeam);
      for (let x = x0; x <= x1; x++) blit(ctx, seg, sx + x * 16, top);
      // the train runs east, then comes round again from the west
      const head = (g.frame * SPEED) % LEN - 120;
      const cars = [bake('minato_car_head', 40, 16, paintCar(true)), bake('minato_car', 40, 16, paintCar(false)), bake('minato_car', 40, 16, paintCar(false))];
      cars.forEach((cv, i) => {
        const cx = hu(sx + head - i * 40);
        if (cx + 40 < -4 || cx > VIEW_W + 4) return;
        blit(ctx, cv, cx, top - 13);
      });
      // the tail car: a head turned round
      const tx = hu(sx + head - 3 * 40);
      if (tx + 40 > -4 && tx < VIEW_W + 4) {
        ctx.save(); ctx.translate(tx + 40, 0); ctx.scale(-1, 1);
        blit(ctx, cars[0], 0, top - 13);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

// ---- monorail station: escalator tower up to a platform on the guideway (3x2)
function paintStation(c) {
  // platform roof + posts (on top of the guideway: the beam is at canvas units 20..36)
  R(c, 0, 2, 96, 12, '#2f6fd0'); R(c, 0, 2, 96, 2, '#5f8fe6'); R(c, 0, 12, 96, 2, '#1e4a9a');
  for (const x of [6, 46, 86]) R(c, x, 14, 4, 18, '#9aa0aa');
  R(c, 0, 30, 96, 8, '#e8ebf0'); R(c, 0, 30, 96, 1, '#ffffff'); R(c, 0, 37, 96, 1, '#9aa0aa');
  for (let x = 2; x < 96; x += 6) R(c, x, 24, 1, 6, '#c8ccd4');
  R(c, 0, 24, 96, 1, '#d5d9e0');
  // escalator tower
  R(c, 20, 72, 56, 104, '#cfd8e2');
  R(c, 24, 76, 48, 80, '#8fc0e0'); R(c, 24, 76, 48, 3, '#b8dcf2');
  for (let i = 0; i < 40; i++) R(c, 28 + i, 150 - i * 2, 3, 2, '#5a6a7a');
  for (let x = 24; x < 72; x += 12) R(c, x, 76, 1, 80, '#a8c8e0');
  R(c, 20, 72, 56, 2, '#eef2f6'); R(c, 74, 72, 2, 104, '#9aa6b4');
  R(c, 18, 156, 60, 6, '#2f6fd0'); R(c, 18, 156, 60, 1, '#5f8fe6');
  // entrance
  R(c, 30, 162, 36, 22, '#3a4a5e'); R(c, 32, 164, 15, 20, '#9fd0ee'); R(c, 49, 164, 15, 20, '#9fd0ee');
  R(c, 32, 164, 15, 2, '#d8f0ff'); R(c, 49, 164, 15, 2, '#d8f0ff');
  R(c, 14, 182, 68, 2, '#9aa0aa');
  outline(c, { tint: 0.3 });
}
function monoStation(x, label, toEast) {
  return {
    type: 'prop', x, y: MONO, w: 3, h: 2,
    talk: (g) => rideMono(g, toEast, label),
    draw(ctx, sx, sy) {
      if (!onScreen(sx, sy, 48, 60, 34)) return;
      U(ctx, sx + 6, sy + 31, 38, 2, 'rgba(0,0,0,0.2)');
      blit(ctx, bake('minato_station', 48, 92, paintStation), sx, sy - 60);
      text(ctx, 'ベイライン', sx + 24, sy + 18.5, { size: 4, align: 'center', color: '#ffffff', shadow: null });
      text(ctx, label, sx + 24, sy - 52.5, { size: 4, align: 'center', color: '#ffffff', shadow: null });
    },
  };
}

// ---- radio tower (電波塔): red-and-white lattice, two decks, antenna (4x3 base)
function paintRadioTower(c) {
  const ORG = '#e4572e', WHT = '#f3f0ea';
  const band = (y) => (Math.floor((352 - y) / 36) % 2 === 0 ? ORG : WHT);
  const dk = (col, k = 0.28) => shade(col, -k);
  const BASE = 336, TOP = 72;
  const hw = (y) => 6 + 48 * Math.pow(Math.max(0, Math.min(1, (y - TOP) / (BASE - TOP))), 1.8);
  // back legs
  for (let y = TOP; y <= BASE; y++) { const w = Math.max(3, hw(y) - 9); R(c, Math.round(64 - w - 1), y, 3, 1, dk(band(y), 0.45)); R(c, Math.round(64 + w - 2), y, 3, 1, dk(band(y), 0.45)); }
  // bracing between levels
  const lv = [];
  for (let y = BASE - 30; y > TOP; y -= 22) lv.push(y);
  lv.push(TOP);
  for (let i = 0; i < lv.length - 1; i++) {
    const y0 = lv[i], y1 = lv[i + 1];
    const a0 = Math.round(64 - hw(y0)), b0 = Math.round(64 + hw(y0)), a1 = Math.round(64 - hw(y1)), b1 = Math.round(64 + hw(y1));
    const col = band((y0 + y1) / 2);
    line(c, a0, y0, b1, y1, dk(col)); line(c, b0, y0, a1, y1, dk(col));
    line(c, a0 + 1, y0, b1 + 1, y1, col); line(c, b0 - 1, y0, a1 - 1, y1, col);
    R(c, a0, y0, b0 - a0, 2, band(y0)); R(c, a0, y0 + 2, b0 - a0, 1, dk(band(y0)));
  }
  // the arch between the feet
  for (let x = 20; x <= 108; x++) {
    const t = (x - 64) / 44, y = Math.round(BASE - 34 + 30 * t * t);
    R(c, x, y, 1, 4, band(y)); P(c, x, y, shade(band(y), 0.2)); P(c, x, y + 3, dk(band(y)));
  }
  // front legs
  for (let y = TOP; y <= BASE; y++) {
    const col = band(y), a = Math.round(64 - hw(y)), b = Math.round(64 + hw(y));
    R(c, a - 2, y, 5, 1, col); P(c, a - 2, y, shade(col, 0.25)); P(c, a + 2, y, dk(col));
    R(c, b - 2, y, 5, 1, col); P(c, b - 2, y, shade(col, 0.15)); P(c, b + 2, y, dk(col));
  }
  // main deck
  R(c, 34, 184, 60, 6, '#e8e6e0'); R(c, 34, 184, 60, 1, '#ffffff');
  R(c, 32, 190, 64, 16, '#f4f2ee'); R(c, 34, 193, 60, 7, '#3a5878');
  for (let x = 36; x < 92; x += 5) { R(c, x, 194, 3, 5, x % 3 ? '#ffe9a0' : '#5a7c9e'); }
  R(c, 32, 204, 64, 3, '#c9c4ba'); R(c, 38, 207, 52, 3, '#9a948a');
  // upper deck
  R(c, 52, 100, 24, 4, '#e8e6e0'); R(c, 50, 104, 28, 9, '#f4f2ee'); R(c, 52, 106, 24, 4, '#3a5878');
  for (let x = 54; x < 74; x += 4) R(c, x, 107, 2, 2, '#ffe9a0');
  // top lattice mast and antenna
  for (let y = 30; y < TOP; y++) { const col = band(y + 8); R(c, 57, y, 3, 1, col); R(c, 68, y, 3, 1, col); }
  for (let y = 30; y < TOP; y += 8) { line(c, 58, y, 70, y + 8, dk(band(y))); line(c, 70, y, 58, y + 8, dk(band(y))); R(c, 57, y, 14, 1, band(y)); }
  for (let y = 0; y < 30; y++) R(c, 62, y, 4, 1, Math.floor(y / 6) % 2 ? WHT : ORG);
  R(c, 62, 0, 1, 30, 'rgba(255,255,255,0.4)');
  // footings
  for (const x of [0, 104]) { R(c, x, 336, 24, 16, '#9aa0aa'); R(c, x, 336, 24, 2, '#c8ccd4'); R(c, x + 22, 338, 2, 14, '#6d717b'); }
  outline(c, { tint: 0.3 });
}
function radioTower(x, y) {
  return {
    type: 'prop', x, y, w: 4, h: 3,
    text: ['赤と白の「電波塔」だ。', 'てっぺんのアンテナから、テレビやラジオの電波が\n街じゅうに届けられている…らしい。', '展望台は、今日は団体さんで満員だ。'],
    draw(ctx, sx, sy, g) {
      if (!onScreen(sx, sy, 64, 128, 50)) return;
      blit(ctx, bake('minato_radiotower', 64, 176, paintRadioTower), sx, sy + 48 - 176);
      const on = (g.frame % 80) < 40, top = sy + 48 - 176;
      U(ctx, sx + 31.5, top - 0.5, 1.5, 1.5, on ? '#ff3b3b' : '#7a1f1f');
      for (const [lx, ly] of [[17, 93], [46, 93], [25.5, 50]]) U(ctx, sx + lx, top + ly, 1, 1, on ? '#7a1f1f' : '#ff3b3b');
    },
  };
}

// ---- Ferris wheel (6x3 base), gondolas turn slowly
function paintWheel(c) {
  const cx = 96, cy = 92;
  thick(c, cx, cy, 64, 216, '#9aa0aa'); thick(c, cx, cy, 128, 216, '#9aa0aa');
  ring(c, cx, cy, 77, 82, '#e8ebf0'); ring(c, cx, cy, 78, 79, '#b8bec8'); ring(c, cx, cy, 69, 71, '#c8ccd4');
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    line(c, Math.round(cx + Math.cos(a) * 8), Math.round(cy + Math.sin(a) * 8), Math.round(cx + Math.cos(a) * 77), Math.round(cy + Math.sin(a) * 77), i % 2 ? '#c8ccd4' : '#e2e5ea');
  }
  const LIGHT = ['#ff7eb6', '#ffd23f', '#5fd7ff', '#7ee08a'];
  for (let i = 0; i < 48; i++) { const a = (i * Math.PI * 2) / 48; R(c, Math.round(cx + Math.cos(a) * 80) - 1, Math.round(cy + Math.sin(a) * 80) - 1, 2, 2, LIGHT[i % 4]); }
  disc(c, cx, cy, 9, '#c8ccd4'); disc(c, cx, cy, 6, '#8d939e'); disc(c, cx - 2, cy - 2, 2, '#f4f6f8');
  thick(c, cx - 3, cy + 7, 40, 214, '#f2f4f7'); thick(c, cx + 3, cy + 7, 152, 214, '#f2f4f7');
  line(c, 54, 180, 138, 180, '#d5d9e0'); line(c, 54, 181, 138, 181, '#9aa0aa');
  // boarding station
  R(c, 62, 186, 68, 8, '#d64545'); R(c, 62, 186, 68, 2, '#ff7a6a'); R(c, 60, 193, 72, 2, '#a83030');
  R(c, 66, 195, 60, 22, '#f4efe6'); R(c, 70, 199, 18, 14, '#9fd0ee'); R(c, 104, 199, 18, 14, '#9fd0ee'); R(c, 90, 199, 12, 18, '#5a3a20');
  R(c, 20, 216, 152, 8, '#b8bcc4'); R(c, 20, 216, 152, 2, '#dfe2e7');
  outline(c, { tint: 0.3 });
}
function ferrisWheel(x, y) {
  const COLS = ['#ff6f91', '#ffd23f', '#5fd7ff', '#7ee08a', '#b388ff', '#ff9a3c'];
  return {
    type: 'prop', x, y, w: 6, h: 3,
    talk: (g) => rideWheel(g),
    draw(ctx, sx, sy, g) {
      if (!onScreen(sx, sy, 96, 70, 50)) return;
      U(ctx, sx + 6, sy + 46, 86, 2, 'rgba(0,0,0,0.18)');
      blit(ctx, bake('minato_wheel', 96, 112, paintWheel), sx, sy - 64);
      const cx = sx + 48, cy = sy - 18, rad = 40, a0 = (g.frame * Math.PI * 2) / 2400;
      for (let i = 0; i < 16; i++) {
        const a = a0 + (i * Math.PI) / 8;
        const gx = hu(cx + Math.cos(a) * rad), gy = hu(cy + Math.sin(a) * rad);
        U(ctx, gx - 0.25, gy, 0.5, 1.5, '#5a5f6b');
        U(ctx, gx - 3, gy + 1, 6, 5.5, OUT);
        U(ctx, gx - 2.5, gy + 1.5, 5, 4.5, COLS[i % COLS.length]);
        U(ctx, gx - 2, gy + 2.5, 4, 1.5, '#dff2ff');
        U(ctx, gx - 2.5, gy + 1.5, 5, 0.5, '#ffffff');
      }
    },
  };
}

// ---- karakuri clock (からくり時計, 2x2): pendulum swings; every so often the doors
// open and a little band of dolls plays
function paintKarakuri(c) {
  R(c, 4, 146, 56, 14, '#9aa0aa'); R(c, 4, 146, 56, 2, '#c8ccd4'); R(c, 4, 158, 56, 2, '#6d717b');
  R(c, 10, 40, 44, 106, '#b8644a');
  for (let y = 44; y < 146; y += 6) for (let x = 10 + ((y / 6) % 2) * 5; x < 54; x += 10) R(c, x, y, 1, 5, '#9a4e38');
  for (let y = 46; y < 146; y += 6) R(c, 10, y, 44, 1, '#a45640');
  R(c, 10, 40, 3, 106, '#d07a5e'); R(c, 51, 40, 3, 106, '#8a4430');
  for (const y of [38, 72, 106]) { R(c, 6, y, 52, 4, '#8a6a3a'); R(c, 6, y, 52, 1, '#c9a24a'); }
  for (let i = 0; i < 34; i++) { const w = Math.round(3 + i * 0.82); R(c, 32 - w, 4 + i, w * 2, 1, i % 6 === 5 ? '#2e6a52' : i < 3 ? '#5fb08a' : '#3f8a6a'); }
  R(c, 31, 0, 2, 6, '#c9a227'); disc(c, 32, 1, 2, '#ffd23f');
  disc(c, 32, 56, 13, '#3a2a20'); disc(c, 32, 56, 11, '#f8f2e0'); disc(c, 30, 54, 3, '#ffffff');
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; P(c, Math.round(32 + Math.cos(a) * 9), Math.round(56 + Math.sin(a) * 9), i % 3 ? '#8a6a3a' : '#3a2a20'); }
  R(c, 16, 78, 32, 26, '#6a4428'); R(c, 16, 78, 32, 2, '#8a5a33'); R(c, 31, 80, 2, 24, '#4a2e18');
  for (let i = 0; i < 6; i++) R(c, 16 + i, 78 - i, 32 - i * 2, 1, '#8a6a3a');
  P(c, 28, 92, '#ffd23f'); P(c, 35, 92, '#ffd23f');
  R(c, 24, 112, 16, 28, '#2a3040'); R(c, 24, 112, 16, 2, '#4a5468'); R(c, 25, 114, 2, 24, 'rgba(255,255,255,0.12)');
  outline(c, { tint: 0.3 });
}
const karakuriShow = (t) => t % 1500 < 360;
function karakuri(x, y) {
  return {
    type: 'prop', x, y, w: 2, h: 2,
    talk: (g) => karakuriTalk(g),
    draw(ctx, sx, sy, g) {
      if (!onScreen(sx, sy, 32, 50, 34)) return;
      U(ctx, sx + 2, sy + 31, 28, 2, 'rgba(0,0,0,0.2)');
      const top = sy - 48, t = g.frame;
      blit(ctx, bake('minato_karakuri', 32, 80, paintKarakuri), sx, top);
      // hands
      const am = (t / 3600) * Math.PI * 2 - Math.PI / 2, ah = am / 12 - Math.PI / 3;
      for (let k = 0; k < 8; k++) U(ctx, hu(sx + 16 + Math.cos(am) * k * 0.9), hu(top + 28 + Math.sin(am) * k * 0.9), 0.5, 0.5, '#20232a');
      for (let k = 0; k < 5; k++) U(ctx, hu(sx + 16 + Math.cos(ah) * k * 0.9), hu(top + 28 + Math.sin(ah) * k * 0.9), 0.5, 0.5, '#20232a');
      U(ctx, sx + 15.5, top + 27.5, 1, 1, '#c9a227');
      // pendulum
      const pa = Math.sin(t / 30) * 0.35;
      for (let k = 0; k < 10; k++) U(ctx, hu(sx + 16 + Math.sin(pa) * k), hu(top + 57 + Math.cos(pa) * k), 0.5, 0.5, '#c9a227');
      U(ctx, hu(sx + 15 + Math.sin(pa) * 10), hu(top + 66 + Math.cos(pa) * 0.5), 2, 2, '#ffd23f');
      if (karakuriShow(t)) {
        const k = t % 1500, open = Math.min(1, k / 40, (360 - k) / 40);
        const ow = hu(7.5 * open);
        U(ctx, sx + 16 - ow, top + 39.5, ow * 2, 12, '#2a1a10');
        if (open >= 1) {
          const dolls = [['#d62f2f', '#ffd23f'], ['#2f6fd0', '#ffffff'], ['#2f9a4a', '#ffd23f']];
          dolls.forEach(([body, hat], i) => {
            const bob = hu(Math.abs(Math.sin(t / 10 + i * 1.3)) * 1.5);
            const dx = sx + 10 + i * 4.5, dy = top + 42 - bob;
            U(ctx, dx, dy + 3, 3.5, 5, body); U(ctx, dx + 0.5, dy + 0.5, 2.5, 2.5, '#f6d2b0'); U(ctx, dx, dy, 3.5, 1, hat);
            U(ctx, dx + 1, dy + 1.5, 0.5, 0.5, OUT); U(ctx, dx + 2, dy + 1.5, 0.5, 0.5, OUT);
          });
          if (Math.floor(t / 20) % 2) text(ctx, '♪', sx + 26, top + 30 - (t % 40) / 8, { size: 5, color: '#ffd23f', shadow: OUT });
        }
      }
    },
  };
}

// ---- food truck (3x2): label drawn live on the roof sign
const TRUCKS = {
  crepe: { body: '#ff9ac0', trim: '#fff6fa', ink: '#d6366e', awn: ['#ff6f91', '#ffffff'], label: 'クレープ' },
  curry: { body: '#ffb02a', trim: '#fff6e0', ink: '#8a4a10', awn: ['#d62f2f', '#ffd23f'], label: 'カレー' },
  coffee: { body: '#3f6a52', trim: '#f4efe6', ink: '#3a2c24', awn: ['#2f6b4f', '#f4efe6'], label: 'コーヒー' },
  soft: { body: '#7fc4f0', trim: '#ffffff', ink: '#2f6fd0', awn: ['#5fb8e8', '#ffffff'], label: 'ソフトクリーム' },
};
function paintTruck(k) {
  const T = TRUCKS[k];
  return (c) => {
    R(c, 6, 80, 86, 4, 'rgba(0,0,0,0.2)');
    R(c, 4, 24, 88, 50, T.body); R(c, 4, 24, 88, 2, shade(T.body, 0.3)); R(c, 4, 68, 88, 6, shade(T.body, -0.28));
    R(c, 4, 30, 22, 38, shade(T.body, -0.08)); R(c, 7, 33, 16, 14, '#9fd0ee'); R(c, 7, 33, 16, 2, '#d8f0ff'); R(c, 24, 30, 2, 38, shade(T.body, -0.25));
    R(c, 30, 34, 56, 24, '#3a3030'); R(c, 30, 34, 56, 2, '#20232a');
    for (let x = 34; x < 82; x += 8) R(c, x, 40, 5, 6, ['#ffd23f', '#ff6f91', '#ffffff', '#7ee08a'][(x / 8) % 4]);
    R(c, 28, 56, 60, 4, '#e8e4dc'); R(c, 28, 56, 60, 1, '#ffffff'); R(c, 28, 59, 60, 1, '#9aa0aa');
    for (let x = 28; x < 88; x += 6) { R(c, x, 26, 3, 8, T.awn[0]); R(c, x + 3, 26, 3, 8, T.awn[1]); }
    for (let x = 28; x < 88; x += 3) P(c, x + 1, 34, T.awn[0]);
    R(c, 26, 4, 64, 18, '#20232a'); R(c, 28, 6, 60, 14, T.trim); R(c, 28, 6, 60, 1, '#ffffff');
    for (const x of [22, 72]) { disc(c, x, 76, 8, '#2a2d36'); disc(c, x, 76, 4, '#9aa0aa'); P(c, x - 1, 75, '#dfe3ea'); }
    R(c, 88, 48, 4, 4, '#ffd23f');
    outline(c, { tint: 0.3 });
  };
}
function foodTruck(x, y, kind, talk) {
  const T = TRUCKS[kind];
  return {
    type: 'prop', x, y, w: 3, h: 2, talk,
    draw(ctx, sx, sy, g) {
      if (!onScreen(sx, sy, 48, 14, 34)) return;
      blit(ctx, bake('minato_truck_' + kind, 48, 44, paintTruck(kind)), sx, sy - 12);
      text(ctx, T.label, sx + 29, sy - 9, { size: T.label.length > 5 ? 4 : 5, align: 'center', color: T.ink, shadow: null });
      // steam from the hatch
      const s = (g.frame / 6) % 12;
      U(ctx, hu(sx + 40 + Math.sin(g.frame / 20) * 1.5), hu(sy + 2 - s), 2, 1, `rgba(255,255,255,${(0.6 * (1 - s / 12)).toFixed(2)})`);
    },
  };
}

// ---- street vision (街頭ビジョン): screen on two legs, slides about programs
const SLIDES = [
  { bg: '#d62f2f', fg: '#ffffff', a: 'バラエティ', b: '今夜も大笑い！' },
  { bg: '#2f6fd0', fg: '#ffffff', a: 'ドラマ', b: '涙と感動の最終回' },
  { bg: '#2a2d36', fg: '#ffd23f', a: 'ニュース', b: '毎日 夕方6時から' },
  { bg: '#2f9a4a', fg: '#ffffff', a: '音楽番組', b: '生放送でお届け' },
  { bg: '#8a5ac8', fg: '#ffffff', a: 'オーディション', b: '新人タレント募集中' },
];
function paintVision(w) {
  return (c) => {
    const W = w * 32;
    for (const x of [10, W - 16]) { R(c, x, 80, 6, 48, '#5a5f6b'); R(c, x, 80, 2, 48, '#8d939e'); R(c, x - 2, 124, 10, 4, '#3b3f48'); }
    R(c, 0, 0, W, 84, '#2a2d36'); R(c, 0, 0, W, 2, '#4a4e58'); R(c, 2, 2, 2, 80, '#3b3f48');
    R(c, 6, 6, W - 12, 70, '#0d0f14');
    R(c, 0, 82, W, 8, '#9aa0aa'); R(c, 0, 82, W, 2, '#c8ccd4');
    for (let x = 8; x < W - 8; x += 6) R(c, x, 85, 3, 3, '#5a5f6b');
    outline(c, { tint: 0.3 });
  };
}
function vision(x, y, w = 4, extra = {}) {
  return {
    type: 'prop', x, y, w, h: 1,
    text: ['街頭ビジョンだ。番組の宣伝が次々と流れている。', '「新番組、続々スタート！」\n…いつか自分の番組も、ここに映るのかな。'],
    draw(ctx, sx, sy, g) {
      const top = sy - 48;
      if (!onScreen(sx, sy, w * 16, 50, 18)) return;
      blit(ctx, bake('minato_vision' + w, w * 16, 64, paintVision(w)), sx, top);
      const t = g.frame, s = SLIDES[Math.floor(t / 240) % SLIDES.length];
      const X = sx + 3, Y = top + 3, Wd = w * 16 - 6, Hd = 35;
      U(ctx, X, Y, Wd, Hd, s.bg);
      U(ctx, X, Y, Wd, 1, 'rgba(255,255,255,0.25)');
      const k = t % 240, slide = k < 16 ? hu((16 - k) * 2) : 0;
      text(ctx, s.a, X + Wd / 2 + slide, Y + 7, { size: 7, align: 'center', color: s.fg, shadow: 'rgba(0,0,0,0.45)' });
      text(ctx, s.b, X + Wd / 2, Y + 18, { size: 4.5, align: 'center', color: s.fg, shadow: null });
      for (let i = 0; i < 3; i++) {
        const px = X + 4 + ((t / 2 + i * 21) % (Wd - 8)), py = Y + 4 + ((i * 11 + Math.floor(t / 30)) % 26);
        U(ctx, hu(px), py, 1, 1, 'rgba(255,255,255,0.7)');
      }
      U(ctx, X, Y + Hd - 6, Wd, 6, 'rgba(0,0,0,0.45)');
      text(ctx, 'ON AIR', X + 2 + ((t / 3) % (Wd + 20)) - 20, Y + Hd - 5.5, { size: 4, color: '#ff5d6c', shadow: null });
    },
    ...extra,
  };
}

// ---- area map board (2x1). here: the "you are here" dot on the little map (0..1)
function paintMapBoard(c) {
  for (const x of [8, 52]) { R(c, x, 36, 4, 20, '#5a5f6b'); R(c, x, 36, 1, 20, '#8d939e'); }
  R(c, 0, 0, 64, 38, '#2a3a5a'); R(c, 0, 0, 64, 1, '#4a5a7a');
  R(c, 3, 9, 58, 26, '#9ec98a');
  R(c, 3, 29, 58, 6, '#3d7fd1'); R(c, 3, 27, 58, 2, '#e0c890');
  R(c, 3, 17, 58, 2, '#f4f4f4'); R(c, 20, 9, 2, 18, '#f4f4f4'); R(c, 41, 9, 2, 18, '#f4f4f4');
  R(c, 3, 25, 58, 1, '#9aa0aa');
  for (const [x, y, col] of [[7, 11, '#2f6fd0'], [26, 11, '#ff4f9a'], [47, 11, '#3a5a9a'], [7, 20, '#d62f2f'], [47, 20, '#c8ccd4'], [56, 21, '#ffd23f']]) { R(c, x, y, 7, 5, col); R(c, x, y, 7, 1, shade(col, 0.4)); }
  R(c, 26, 20, 10, 5, '#5fb85a');
  R(c, 3, 2, 58, 6, '#ffffff');
  outline(c, { tint: 0.3 });
}
function mapBoard(x, y, here) {
  return {
    type: 'prop', x, y, w: 2, h: 1,
    talk: (g) => readMap(g),
    draw(ctx, sx, sy, g) {
      if (!onScreen(sx, sy, 32, 14, 18)) return;
      blit(ctx, bake('minato_mapboard', 32, 28, paintMapBoard), sx, sy - 12);
      text(ctx, 'テレビ局エリア', sx + 16, sy - 11.5, { size: 3, align: 'center', color: '#20232a', shadow: null });
      if (Math.floor(g.frame / 20) % 2) U(ctx, sx + 1.5 + here[0] * 28, sy - 7.5 + here[1] * 12, 1.5, 1.5, '#ff2b3a');
    },
  };
}

// ---- wooden signpost with an arrow board (label drawn live)
function signpost(x, y, label, dir, txt) {
  const F = (ctx, x0, y0, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x0, y0, w, h); };
  const left = dir === 'left';
  return {
    type: 'prop', x, y, w: 1, h: 1, text: txt,
    draw(ctx, sx, sy) {
      if (!onScreen(sx, sy, 32, 16, 18)) return;
      F(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      F(ctx, sx + 7, sy - 4, 2.5, 19, '#4a2e18'); F(ctx, sx + 7.5, sy - 4, 1, 19, '#8a5a33');
      const bx = left ? sx - 6 : sx - 5;
      F(ctx, bx - 0.5, sy - 9.5, 28, 9, '#3a2512');
      for (let k = 0; k < 4; k++) {
        if (left) F(ctx, bx - 4.5 + k, sy - 5.5 - k, 1, 1 + k * 2, '#3a2512');
        else F(ctx, bx + 27.5 - k, sy - 5.5 - k, 1, 1 + k * 2, '#3a2512');
      }
      F(ctx, bx, sy - 9, 27, 8, '#c48a52'); F(ctx, bx, sy - 9, 27, 1, '#e0b07a');
      for (let k = 0; k < 4; k++) {
        if (left) F(ctx, bx - 4 + k, sy - 5 - k + 0.5, 1, k * 2, '#c48a52');
        else F(ctx, bx + 27 - k, sy - 5 - k + 0.5, 1, k * 2, '#c48a52');
      }
      F(ctx, bx, sy - 1.5, 27, 0.5, '#8a5a33');
      text(ctx, label, bx + 13.5, sy - 7.5, { size: label.length > 6 ? 3.5 : 4, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

// ---- koi in the garden pond (non-solid, over the water)
function koi(x, y, w, h, n = 2) {
  return {
    type: 'prop', x, y, w, h, solid: false,
    draw(ctx, sx, sy, g) {
      if (!onScreen(sx, sy, w * 16, 4, h * 16)) return;
      for (let i = 0; i < n; i++) {
        const k = g.frame / (300 + i * 70) + i * 2.1;
        const cx = sx + (w * 16) / 2 + Math.cos(k * Math.PI * 2) * (w * 16 * 0.34);
        const cy = sy + (h * 16) / 2 + Math.sin(k * Math.PI * 2) * (h * 16 * 0.28);
        const right = -Math.sin(k * Math.PI * 2) > 0;
        const d = right ? 1 : -1;
        U(ctx, hu(cx - 3), hu(cy), 6, 2, i % 2 ? '#ffffff' : '#ff7a2a');
        U(ctx, hu(cx - 1), hu(cy), 2, 1, i % 2 ? '#ff4a2a' : '#ffffff');
        U(ctx, hu(cx - 3 * d - (right ? 1.5 : 0)), hu(cy - 0.5), 1.5, 3, i % 2 ? '#ffe0d0' : '#ffb070');
        U(ctx, hu(cx + 2.5 * d - (right ? 0 : 0.5)), hu(cy + 0.5), 0.5, 0.5, OUT);
      }
    },
  };
}

// ---- boats on the sea and gulls in the sky (non-solid)
function paintBoat(c) {
  R(c, 4, 22, 120, 10, '#ffffff'); R(c, 8, 32, 112, 6, '#2f6fd0'); R(c, 14, 38, 100, 2, '#1e4a9a');
  for (let i = 0; i < 8; i++) R(c, 124 + i, 22 + i, 1, 16 - i * 2, i < 6 ? '#ffffff' : '#2f6fd0');
  R(c, 24, 8, 80, 14, '#e8ebf0'); R(c, 24, 8, 80, 2, '#ffffff');
  for (let x = 28; x < 100; x += 10) R(c, x, 12, 7, 6, '#3a5878');
  R(c, 40, 2, 48, 6, '#d5d9e0'); R(c, 60, 0, 2, 4, '#5a5f6b'); R(c, 62, 0, 6, 3, '#d62f2f');
  outline(c, { tint: 0.3 });
}
function boats(W, y) {
  return {
    type: 'prop', x: 0, y, w: W, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      if (sy + 24 < -8 || sy - 16 > VIEW_H + 8) return;
      const len = W * 16 + 200;
      const bx = hu(sx + ((g.frame * 0.35) % len) - 100), by = sy - 6 + hu(Math.sin(g.frame / 40));
      if (bx + 64 > -4 && bx < VIEW_W + 4) {
        U(ctx, bx - 8, by + 16, 8, 1, '#cfe6fa'); U(ctx, bx - 16, by + 17, 10, 0.5, '#9cc8ee');
        blit(ctx, bake('minato_boat', 64, 20, paintBoat), bx, by);
      }
    },
  };
}
function gulls(x, y, cx, cy) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, z: 4000,
    draw(ctx, sx, sy, g) {
      const ox = sx - x * 16 + cx * 16, oy = sy - y * 16 + cy * 16;
      if (!onScreen(ox - 100, oy, 200, 60, 60)) return;
      for (let i = 0; i < 3; i++) {
        const a = g.frame / (220 + i * 40) + i * 2.2;
        const gx = hu(ox + Math.cos(a) * (70 + i * 18)), gy = hu(oy + Math.sin(a * 1.3) * 18 - 20 - i * 6);
        const flap = Math.floor(g.frame / 8 + i) % 2;
        U(ctx, gx - 3, gy + (flap ? -1 : 0), 2.5, 1, '#ffffff'); U(ctx, gx + 0.5, gy + (flap ? -1 : 0), 2.5, 1, '#ffffff');
        U(ctx, gx - 0.5, gy, 1.5, 1.5, '#f4f6f8'); U(ctx, gx + 1, gy + 0.5, 0.5, 0.5, '#ffb02a');
        U(ctx, gx - 3, gy + (flap ? 0 : 1), 1, 0.5, '#9aa0aa'); U(ctx, gx + 2.5, gy + (flap ? 0 : 1), 1, 0.5, '#9aa0aa');
      }
    },
  };
}

// ====================================================================== フジテレビ's facade
// The building entity keeps the footprint and the door; this paints the distinctive
// look over it: two lattice towers joined by sky corridors, a silver sphere between
// them, and a glass atrium with the entrance. Footprint 14x13 tiles, art 64 units taller.
const FUJI_UP = 64;
function paintSphere(rad) {
  const S = rad * 2, [cv, c] = makeCanvas(S * 2, S * 2);
  const img = c.createImageData(S * 2, S * 2), d = img.data;
  const tones = [[96, 104, 116], [128, 136, 148], [160, 167, 178], [190, 196, 205], [220, 224, 230], [246, 248, 250]];
  const L = [-0.5, -0.62, 0.6], LN = Math.hypot(...L);
  for (let j = 0; j < S * 2; j++) {
    for (let i = 0; i < S * 2; i++) {
      const nx = (i + 0.5 - S) / S, ny = (j + 0.5 - S) / S, rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      let l = (nx * L[0] + ny * L[1] + nz * L[2]) / LN;
      let ti = Math.max(0, Math.min(5, Math.floor((l + 0.45) * 4.2 + ((i + j) & 1 ? 0.12 : -0.12))));
      const lat = Math.asin(ny), lon = Math.atan2(nx, nz);
      const fl = Math.abs(lat / (Math.PI / 9) - Math.round(lat / (Math.PI / 9))), fo = Math.abs(lon / (Math.PI / 10) - Math.round(lon / (Math.PI / 10)));
      if (fl < 0.06 + 0.04 * (1 - nz) || fo < 0.05 + 0.06 * (1 - nz)) ti = Math.max(0, ti - 1);
      if (l > 0.93) ti = 5;
      if (rr > 0.9) ti = Math.max(0, ti - 1);
      const [r0, g0, b0] = tones[ti], k = (j * S * 2 + i) * 4;
      d[k] = r0; d[k + 1] = g0; d[k + 2] = b0; d[k + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}
function paintFuji(c) {
  // all coordinates in px (2 per unit); canvas 448 x 544, footprint top at y 128
  const FR = '#eef0f3', FRD = '#b8bec8', GL = '#3d5a78', GLL = '#5a7c9e', FACE = '#d4d8de';
  const tower = (x0, x1) => {
    R(c, x0, 32, x1 - x0, 16, '#f4f6f8'); R(c, x0, 32, x1 - x0, 2, '#ffffff'); R(c, x0, 46, x1 - x0, 2, FRD);
    R(c, x0, 48, x1 - x0, 484, FACE);
    for (let y = 56; y < 452; y += 28) {
      for (let x = x0 + 6; x + 20 <= x1 - 4; x += 28) {
        const lit = ((x * 7 + y * 3) % 11) === 0;
        R(c, x, y, 20, 20, lit ? '#ffe9a0' : GL); R(c, x, y, 20, 3, lit ? '#fff4c8' : GLL); R(c, x, y, 3, 20, lit ? '#fff0b8' : '#4a6a8c');
        R(c, x + 18, y + 3, 2, 17, '#2a4058');
      }
      R(c, x0, y + 22, x1 - x0, 6, FR); R(c, x0, y + 26, x1 - x0, 2, FRD);
    }
    for (let x = x0; x < x1; x += 28) { R(c, x, 48, 6, 404, FR); R(c, x + 5, 48, 1, 404, FRD); }
    R(c, x0, 48, 4, 484, '#ffffff'); R(c, x1 - 6, 48, 6, 484, '#a8aeb8');
    // lobby
    R(c, x0 + 4, 456, x1 - x0 - 10, 76, '#8fb8d8'); R(c, x0 + 4, 456, x1 - x0 - 10, 4, '#cfe6f6');
    for (let x = x0 + 10; x < x1 - 8; x += 14) R(c, x, 456, 2, 76, '#6a8aa8');
    R(c, x0, 452, x1 - x0, 6, '#c8ccd4');
  };
  tower(0, 172); tower(276, 448);
  // sky corridors (the lattice between the towers)
  R(c, 172, 60, 104, 280, '#56667a');
  for (let y = 60; y < 340; y += 56) for (let x = 172; x < 276; x += 52) {
    if (((x + y) / 4) % 3 !== 0) { R(c, x + 8, y + 10, 40, 40, '#9cc0dc'); R(c, x + 8, y + 10, 40, 6, '#c4dcef'); for (let k = x + 16; k < x + 48; k += 10) R(c, k, y + 10, 1, 40, '#7aa0c0'); }
  }
  for (let y = 60; y <= 340; y += 56) { R(c, 166, y, 116, 10, FR); R(c, 166, y + 8, 116, 2, FRD); }
  for (const x of [172, 220, 270]) { R(c, x, 60, 8, 290, FR); R(c, x + 6, 60, 2, 290, FRD); }
  // atrium with the entrance (door at units 112..128 = px 224..256, bottom row)
  R(c, 172, 340, 104, 192, '#7fa8c8'); R(c, 172, 340, 104, 6, '#cfe6f6');
  for (let x = 178; x < 276; x += 12) R(c, x, 346, 2, 186, '#5f86a8');
  for (let y = 380; y < 520; y += 34) R(c, 172, y, 104, 2, '#5f86a8');
  R(c, 182, 352, 84, 32, '#20232a'); R(c, 184, 354, 80, 28, '#ffffff');
  R(c, 208, 484, 72, 8, '#9aa0aa'); R(c, 208, 484, 72, 2, '#dfe2e7');
  R(c, 222, 492, 36, 40, '#3a4a5e'); R(c, 225, 495, 14, 37, '#9fd0ee'); R(c, 241, 495, 14, 37, '#9fd0ee');
  R(c, 225, 495, 14, 3, '#d8f0ff'); R(c, 241, 495, 14, 3, '#d8f0ff');
  // plinth
  R(c, 0, 532, 448, 12, '#b8bcc4'); R(c, 0, 532, 448, 2, '#dfe2e7'); R(c, 222, 532, 36, 12, '#9aa0aa');
  // the sphere
  const rad = 30;
  disc(c, 224, 176, rad * 2 + 2, '#3a4250');
  c.drawImage(paintSphere(rad), 224 - rad * 2, 176 - rad * 2);
  for (const x of [182, 262]) { R(c, x, 230, 6, 26, FR); R(c, x + 4, 230, 2, 26, FRD); }
  // rooftop masts
  for (const x of [40, 400]) { R(c, x, 4, 3, 30, '#9aa0aa'); R(c, x - 4, 12, 11, 2, '#8d939e'); R(c, x - 2, 22, 7, 2, '#8d939e'); }
  outline(c, { tint: 0.25 });
}
function fujiDecorate(ctx, px, py, t) {
  if (!onScreen(px, py, 224, FUJI_UP + 4, 212)) return;
  blit(ctx, bake('minato_fuji', 224, 272, paintFuji), px, py - FUJI_UP);
  text(ctx, 'フジテレビ', px + 112, py - FUJI_UP + 178.5, { size: 8, align: 'center', color: '#20232a', shadow: null });
  const on = (t % 90) < 45;
  for (const x of [21, 201]) U(ctx, px + x - 0.5, py - FUJI_UP + 1, 1.5, 1.5, on ? '#ff3b3b' : '#7a1f1f');
  // a glint sliding over the sphere now and then
  const k = t % 600;
  if (k < 40) U(ctx, hu(px + 98 + k * 0.5), hu(py - FUJI_UP + 70 + k * 0.25), 1, 1, '#ffffff');
}

// ---- テレビ朝日: a tall curved glass atrium in front of the lower-left facade
function paintAtrium(c) {
  // canvas 64 x 84 units (128 x 168 px); bottom = the footprint's bottom
  for (let x = 0; x < 128; x++) {
    const t = x / 127, top = Math.round(12 + 70 * t * t);
    R(c, x, top, 1, 160 - top, x % 12 === 0 ? '#4f7fa8' : x % 12 === 1 ? '#6a9cc4' : '#9ccbe8');
    R(c, x, top + Math.round((160 - top) * 0.6), 1, Math.round((160 - top) * 0.4), x % 12 < 2 ? '#4f7fa8' : '#86b8dc');
    R(c, x, top, 1, 3, '#ffffff'); R(c, x, top + 3, 1, 2, '#5f8fb8');
    for (let y = top + 16; y < 160; y += 16) P(c, x, y, '#5f8fb8');
    if ((x + 20) % 46 < 8) R(c, x, top + 6, 1, Math.max(0, 150 - top - 30), 'rgba(255,255,255,0.35)');
  }
  R(c, 0, 160, 128, 8, '#c8ccd4'); R(c, 0, 160, 128, 2, '#eef0f3');
  outline(c, { tint: 0.3 });
}
function asahiDecorate(ctx, px, py) {
  if (!onScreen(px, py, 80, 0, 150)) return;
  blit(ctx, bake('minato_atrium', 64, 84, paintAtrium), px + 8, py + 144 - 84);
}

// ====================================================================== interactions
async function readMap(g) {
  await g.say([
    '「テレビ局エリア 案内図」',
    '【北西・あかね坂】TBS\n【北・スターヒル広場】テレビ朝日\n【北東・電波塔通り】テレビ東京',
    '【南西・しおさい広場】日本テレビ\n【南東・うみかぜ埠頭】フジテレビ・観覧車\n【南・まんなか公園】キッチンカー・バス停',
    'モノレール「ベイライン」：しおさい広場駅 ⇔ うみかぜ埠頭駅（¥190）\n西の大通りを行くと、東京エリア。',
  ]);
}

// Drinks only relax fully twice a day (all stands share the count), food relieves as much
// as the stomach takes.
async function stall(g, { greet, items, host, thanks }) {
  const o = host ? { name: host.name, look: host.look } : {};
  const k = await g.ask(greet, [...items.map((i) => `${i.name} ${fmtMoney(i.price)}`), 'やめておく'], { ...o, cancel: items.length });
  if (k < 0 || k >= items.length) return;
  const it = items[k];
  if (it.fill && !g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。\n（おなかが空いたら、また来よう）'); return; }
  if (!g.spend(it.price)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  const a = snap(g);
  if (it.fill || it.heal) g.eat(it.heal || 0, { silent: true, fill: it.fill || 0 });
  let stress = it.stress || 0, tired = false;
  if (stress && !it.fill) {
    const n = bumpDay(g, 'minato_treat');
    if (n > 2) { stress = Math.max(1, Math.round(stress / 4)); tired = true; }
  } else if (stress) stress = Math.round(stress * (g.lastEatRatio ?? 1));
  g.relax({ stress });
  await g.say([it.text, (diffText(g, a) || 'ほっとひと息。') + (tired ? '\n（今日はもう何杯も飲んだ。効果は小さめ…）' : '')]);
  if (thanks) await g.say(thanks, o);
}
const COFFEE = [
  { name: 'カフェラテ', price: 450, stress: 6, text: 'ふわふわのミルクにラテアート。\nひと口飲んで、ほっとした。' },
  { name: 'アイスコーヒー', price: 350, stress: 5, text: 'キリッと冷たいアイスコーヒー。\n頭がすっきりした！' },
];
const coffeeStand = (g) => stall(g, { greet: 'いらっしゃいませ！\nテイクアウトのコーヒーはいかがですか？', items: COFFEE, host: { name: 'コーヒー屋さん', look: { ...LOOKS.clerk, top: '#2f6b4f', apron: '#3a2c24' } }, thanks: 'ありがとうございました！\n収録、がんばってくださいね。' });
const crepeTruck = (g) => stall(g, {
  greet: 'クレープのキッチンカーだ。\n甘いにおいがただよっている…。',
  items: [
    { name: 'いちごクレープ', price: 550, heal: 8, fill: 18, stress: 6, text: '生クリームたっぷりのいちごクレープ！\n甘ずっぱくて、しあわせ…。' },
    { name: 'チョコバナナ', price: 500, heal: 8, fill: 20, stress: 5, text: 'チョコとバナナの王道コンビ。\nもぐもぐ…元気が出てきた！' },
  ],
});
const curryTruck = (g) => stall(g, {
  greet: 'カレーのキッチンカーだ。\nスパイスのいい香り！',
  items: [
    { name: 'スパイスカレー', price: 900, heal: 28, fill: 50, stress: 4, text: 'ピリッと辛いスパイスカレー。\n汗をかきながら、ぺろりと平らげた！' },
    { name: 'ロコモコ丼', price: 850, heal: 25, fill: 45, stress: 3, text: 'ハンバーグと目玉焼きがのったロコモコ丼。\nボリューム満点！' },
  ],
});
const coffeeTruck = (g) => stall(g, { greet: 'コーヒーのキッチンカーだ。\n「スタッフさんにも人気です！」と書いてある。', items: COFFEE });
const softTruck = (g) => stall(g, {
  greet: 'ソフトクリームのキッチンカーだ。',
  items: [
    { name: 'ミルクソフト', price: 400, heal: 5, fill: 10, stress: 5, text: 'なめらかなミルクソフト。\n冷たくて、おいしい！' },
    { name: 'レモネード', price: 380, stress: 5, text: 'しゅわっとさわやかなレモネード。\n気分がすっきりした！' },
  ],
});

async function takeBus(g) {
  const i = await g.ask('バス停だ。\nどこ行きのバスに乗る？（¥210）', ['東京駅前', 'ドット商店街', 'やめておく'], { cancel: 2 });
  if (i !== 0 && i !== 1) return;
  if (i === 1 && !PLACES.machi) { await g.say('「ドット商店街」行きは、ただいま運休中のようだ。'); return; }
  if (!g.spend(210)) { await g.say('運賃が足りない…。\n歩いていこう。（西の大通りを行けば東京エリア）'); return; }
  g.sfx('coin');
  await g.fadeOut(16);
  g.sfx('door');
  await g.wait(600);
  if (i === 0) { await g.goto('tokyo', 'main', 53, 31, 'down'); await g.say('ブロロロ…。\n東京駅前でバスを降りた。'); }
  else { await g.goto('machi', 'main', 38, 20, 'down'); await g.say('ブロロロ…。\nドット商店街でバスを降りた。'); }
}

async function rideMono(g, toEast, here) {
  const dest = toEast ? 'うみかぜ埠頭駅' : 'しおさい広場駅';
  const i = await g.ask(`モノレール「ベイライン」の${here}だ。\n${dest}まで乗っていく？（¥190）`, ['乗る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(190)) { await g.say('運賃が足りない…。\n高架の下の遊歩道を歩いていこう。'); return; }
  g.sfx('coin');
  await g.fadeOut(16);
  g.sfx('door');
  await g.wait(500);
  const [x, y] = toEast ? EAST_STATION.front : WEST_STATION.front;
  await g.goto('minato', 'main', x, y, 'down');
  await g.say(toEast
    ? ['ベイラインに乗って、うみかぜ埠頭駅で降りた。', '窓の外に、海と観覧車が見えた！']
    : ['ベイラインに乗って、しおさい広場駅で降りた。', '高いビルの間を、すいすい走っていった。']);
}

async function rideWheel(g) {
  const i = await g.ask('観覧車「ドット・ベイホイール」だ。\n1周およそ15分。乗ってみる？（¥800）', ['乗る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(800)) { await g.say('お金が足りない…。\nまた今度にしよう。'); return; }
  g.sfx('coin');
  const n = bumpDay(g, 'minato_wheel');
  await g.fadeOut(20);
  g.sfx('chime');
  await g.wait(900);
  await g.fadeIn(20);
  const a = snap(g);
  g.relax({ stress: n === 1 ? 15 : 4 });
  await g.say([
    'ゴンドラがゆっくり上っていく…。',
    'てっぺんだ！\n海も、テレビ局のビルも、電波塔も…\n街じゅうが見わたせる！',
    n === 1 ? 'あのビルのどこかで、今日も番組が作られている。\n…よし、がんばろう！' : '2回目でも、やっぱりいい景色だ。',
    diffText(g, a) || 'いい気分転換になった。',
  ]);
}

async function restBench(g) {
  if (today(g, 'minato_bench_day')) { await g.say('ベンチに座って、海をながめた。\n…波の音が気持ちいい。'); return; }
  g.setFlag('minato_bench_day', g.state.day);
  const a = snap(g);
  g.relax({ stress: 4 });
  await g.say(['ベンチに座って、ひと休み。\n潮風が気持ちいい…。', diffText(g, a) || 'のんびりした。']);
}

async function karakuriTalk(g) {
  const playing = g.map && karakuriShow(g.frame);
  const lines = playing
    ? ['からくり時計の扉が開いて、人形たちが演奏している！\n♪ポロロン、トコトコ…', '見ていると、なんだか楽しくなってくる。']
    : ['からくり時計だ。', '「からくり演奏は、だいたい25秒ごと」と書いてある。\n…ちょっと待ってみようかな。'];
  if (playing && !today(g, 'minato_karakuri_day')) {
    g.setFlag('minato_karakuri_day', g.state.day);
    const a = snap(g);
    g.relax({ stress: 3 });
    lines.push(diffText(g, a) || 'ほっこりした。');
  }
  await g.say(lines);
}

const PERFORMER = { name: '大道芸人', look: { hair: 'spiky', hairColor: 'brown', skin: 'tan', top: '#ff8a3d', bottom: '#2a3560', hat: '#d62f2f' } };
async function performerTalk(g, npc) {
  const o = who(npc);
  if (!g.flag('minato_performer_met')) {
    g.setFlag('minato_performer_met');
    await g.say(['はい、いらっしゃい！\nジャグリングに一輪車、なんでもござれ！', 'ここでお客さんを笑顔にできたら、\nどこのステージでもやっていける。\n…って、師匠の受け売りだけどね！'], o);
  }
  const i = await g.ask('大道芸のパフォーマンス中だ。', ['見ていく', '投げ銭する（¥100）', 'やめておく'], { cancel: 2 });
  if (i === 0) {
    await g.emote(npc.id, '♪');
    const first = !today(g, 'minato_performer_day');
    const a = snap(g);
    if (first) { g.setFlag('minato_performer_day', g.state.day); g.relax({ stress: 4 }); }
    await g.say(['クラブが3本…4本…5本！\nくるくると宙を舞う！', 'ワッと拍手がわき起こった！' + (first ? '\n' + (diffText(g, a) || '') : '')]);
  } else if (i === 1) {
    if (!g.spend(100)) { await g.say('小銭がない…。'); return; }
    g.sfx('coin');
    await g.emote(npc.id, '♥');
    await g.say(['まいどあり！\nその気持ちが、いちばんのごほうびだよ！', '東京エリアの公園にも、だれでも使える\n小さなステージがあるんだ。\nキミも腕をみがいてみたら？'], o);
  }
}

async function interviewTalk(g, npc) {
  const o = who(npc);
  if (g.flag('minato_interview')) {
    await g.say(['街頭インタビューのご協力、ありがとうございました！', 'オンエアは来週の予定です。\n使われるかどうかは…編集しだいですけどね！'], o);
    return;
  }
  await g.say('すみませーん！\n情報番組の街頭インタビューなんですけど、\nちょっとだけいいですか？', o);
  const i = await g.ask('「テレビ局エリア、どんなところだと思いますか？」', ['夢が集まる場所！', '海がきれい！', 'ごはんがおいしい！', 'えんりょする'], { ...o, cancel: 3 });
  if (i === 3 || i < 0) { await g.say('そうですか…失礼しました！', o); return; }
  g.setFlag('minato_interview', true);
  const ans = ['いいですね〜！\nその目、本気ですね！', 'わかります！\n夕方の海、最高ですよね！', 'キッチンカー、どれもおいしいんですよ！'][i];
  await g.say([ans, 'ご協力ありがとうございました！\n…ちょっとだけ、テレビに映るかも？'], o);
  g.addFame(2);
}

// ====================================================================== the town
function generate() {
  const W = MINATO_W, H = MINATO_H;
  const c = grid(W, H, 'grass');
  const P2 = (x, y, obj) => put(c, x, y, obj);
  const trees = (x0, y0, x1, y1, k = 0) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(c, x, y, 'grass', (x * 3 + y * 5 + k) % 4 === 0 ? 'bush' : 'tree'); };

  // ---- back rows (rooftops / trees beyond the north edge)
  trees(1, 1, W - 2, 2);
  // ---- roads: テレビ通り (west-east) and two avenues
  hroad(c, 25, 1, W - 2);                 // sidewalk 24, road 25..27, sidewalk 28
  vroad(c, 30, 1, 48);
  vroad(c, 60, 1, 48);
  for (const x of [28, 34, 58, 64]) for (let y = 25; y <= 27; y++) set(c, x, y, 'crosswalk_h');
  for (const y of [21, 31]) for (const x0 of [30, 60]) for (let x = x0; x < x0 + 3; x++) set(c, x, y, 'crosswalk_v');

  // ================================================================ NW: あかね坂 (TBS on the hill)
  trees(5, 3, 21, 4, 1);
  fill(c, 6, 5, 1, 9, 'minato_plaza'); fill(c, 20, 5, 1, 9, 'minato_plaza');
  fill(c, 1, 14, 27, 3, 'minato_plaza');
  // groves either side
  for (const [x, y] of [[1, 3], [4, 3], [2, 6], [5, 9], [1, 11], [4, 12], [22, 3], [25, 3], [27, 5], [21, 8], [27, 9], [22, 12], [26, 12]]) P2(x, y, 'sakura');
  for (let y = 5; y <= 13; y++) set(c, 3, y, 'path');
  for (let x = 22; x <= 26; x++) set(c, x, 7, 'path');
  for (let y = 7; y <= 13; y++) set(c, 24, y, 'path');
  for (const [x, y] of [[2, 8], [4, 7], [1, 13], [5, 5], [23, 10], [25, 10], [26, 6]]) set(c, x, y, 'flowers');
  P2(22, 6, 'bench'); P2(26, 8, 'minato_lantern');
  for (let y = 3; y <= 16; y++) P2(28, y, 'hedge');
  for (const x of [2, 26]) P2(x, 15, 'planter');
  for (const x of [8, 18]) P2(x, 15, 'lamp');
  // retaining wall + two stairways
  for (let x = 1; x <= 28; x++) { set(c, x, 17, 'minato_walltop'); set(c, x, 18, 'minato_wall'); }
  for (const x0 of [12, 24]) for (let x = x0; x < x0 + 3; x++) for (const y of [17, 18]) set(c, x, y, 'minato_steps');
  // below the hill
  fill(c, 1, 19, 28, 5, 'minato_plaza');
  P2(8, 21, 'minato_adtower');
  for (const x of [7, 19, 22]) P2(x, 23, 'minato_ginkgo');
  P2(21, 21, 'bench'); P2(22, 21, 'bench');
  P2(10, 23, 'trash'); P2(11, 23, 'vending');

  // ================================================================ N: スターヒル広場 (テレビ朝日)
  trees(34, 3, 49, 4, 2);
  fill(c, 34, 5, 1, 9, 'minato_plaza'); fill(c, 49, 5, 1, 9, 'minato_plaza');
  // garden + pond with a plank bridge
  fill(c, 50, 3, 8, 7, 'stone');
  fill(c, 51, 4, 6, 5, 'water');
  for (let x = 51; x <= 56; x++) set(c, x, 6, 'bridge_h');
  for (let y = 3; y <= 10; y++) P2(58, y, y % 2 ? 'tree' : 'sakura');
  for (const x of [51, 56]) P2(x, 10, 'minato_lantern');
  for (const x of [53, 54]) set(c, x, 10, 'flowers');
  P2(50, 10, 'tree'); P2(57, 10, 'bush');
  trees(50, 11, 58, 13, 3);
  // red-tiled plaza
  fill(c, 34, 14, 25, 10, 'minato_redtile');
  trees(50, 11, 58, 14, 3);
  for (let x = 36; x <= 39; x++) P2(x, 19, 'bench');
  for (const x of [35, 41, 47, 53, 57]) P2(x, 23, 'minato_ginkgo');
  P2(48, 21, 'planter'); P2(34, 20, 'planter');
  P2(40, 14, 'lamp'); P2(45, 14, 'lamp');

  // ================================================================ NE: 電波塔通り (テレビ東京)
  trees(64, 3, 76, 4, 1); trees(84, 3, 84, 4, 2);
  fill(c, 64, 5, 1, 9, 'minato_plaza'); fill(c, 75, 5, 2, 9, 'minato_plaza');
  trees(84, 5, 90, 11, 0);
  for (const [x, y] of [[86, 6], [89, 8], [85, 10]]) P2(x, y, 'sakura');
  set(c, 64, 13, 'minato_plaza');
  fill(c, 75, 13, 10, 1, 'sidewalk');
  fill(c, 64, 14, 27, 3, 'sidewalk');
  fill(c, 89, 12, 2, 2, 'sidewalk');
  for (const x of [65, 68, 71, 74, 77, 80, 83, 87, 90]) P2(x, 16, 'minato_ginkgo');
  fill(c, 64, 17, 27, 7, 'minato_plaza');
  fill(c, 87, 17, 4, 6, 'grass');
  P2(87, 17, 'tree'); P2(90, 17, 'vending'); P2(89, 20, 'bench'); P2(90, 22, 'tree'); set(c, 87, 21, 'flowers'); set(c, 88, 22, 'flowers');
  P2(64, 18, 'minato_bikes'); P2(76, 18, 'trash');
  for (const x of [64, 70]) P2(x, 23, 'planter');
  P2(77, 22, 'lamp');

  // ================================================================ SW: しおさい広場 (日本テレビ)
  fill(c, 1, 29, 28, 20, 'minato_plaza');
  trees(1, 29, 28, 30, 1);
  fill(c, 2, 29, 2, 1, 'grass');
  fill(c, 1, 31, 2, 1, 'minato_plaza');
  for (const [x, y] of [[18, 39], [27, 39], [1, 44], [16, 47]]) P2(x, y, 'minato_ginkgo');
  for (const x of [5, 15]) P2(x, 45, 'planter');
  for (const x of [20, 23]) P2(x, 46, 'bench');
  P2(28, 42, 'minato_bikes'); P2(1, 41, 'vending');

  // ================================================================ S: まんなか公園 (food trucks, stage, park)
  fill(c, 34, 29, 25, 6, 'minato_plaza');
  for (const x of [36, 38, 40, 42, 44, 46]) P2(x, 33, 'minato_parasol');
  P2(48, 34, 'trash'); P2(58, 34, 'vending');
  for (let x = 34; x <= 58; x++) { if (![35, 46, 57].includes(x)) { P2(x, 35, 'hedge'); P2(x, 48, 'hedge'); } }
  for (let y = 36; y <= 47; y++) { P2(34, y, 'hedge'); P2(58, y, 'hedge'); }
  for (let x = 35; x <= 57; x++) { set(c, x, 36, 'path'); set(c, x, 47, 'path'); set(c, x, 42, 'path'); }
  for (let y = 36; y <= 47; y++) { set(c, 35, y, 'path'); set(c, 57, y, 'path'); set(c, 46, y, 'path'); }
  for (const x of [35, 46, 57]) { set(c, x, 35, 'path'); set(c, x, 48, 'path'); }
  for (const [x, y] of [[38, 38], [42, 37], [51, 38], [55, 39], [39, 45], [43, 44], [50, 45], [54, 44], [37, 40], [53, 40]]) P2(x, y, (x + y) % 3 ? 'tree' : 'sakura');
  for (const [x, y] of [[44, 38], [48, 38], [44, 41], [48, 41], [40, 39], [52, 43], [37, 44], [55, 46]]) set(c, x, y, 'flowers');
  for (const x of [44, 48]) P2(x, 43, 'bench');
  P2(40, 46, 'bench'); P2(52, 46, 'bench');

  // ================================================================ SE: うみかぜ埠頭 (フジテレビ, Ferris wheel)
  fill(c, 64, 29, 27, 20, 'minato_plaza');
  trees(64, 29, 81, 33, 2);
  trees(82, 29, 90, 33, 0);
  fill(c, 82, 34, 9, 10, 'grass');
  for (const [x, y] of [[83, 31], [87, 33], [90, 36], [82, 35], [90, 41]]) P2(x, y, 'sakura');
  for (const [x, y] of [[84, 35], [85, 35], [88, 36], [83, 38], [86, 38], [89, 38], [84, 41], [88, 41]]) set(c, x, y, 'flowers');
  fill(c, 80, 34, 2, 8, 'minato_plaza');
  for (const y of [36, 40]) P2(81, y, 'planter');
  P2(64, 40, 'minato_bikes'); P2(90, 46, 'vending');

  // ================================================================ promenade under the monorail
  fill(c, 1, 49, W - 2, 3, 'minato_plaza');
  for (const x of PILLARS) set(c, x, MONO, 'minato_plaza', 'minato_pillar');
  for (const x of [30, 32, 60, 62]) P2(x, 49, 'minato_bollard');
  for (const x of [10, 18, 42, 50, 72, 82]) P2(x, 49, 'lamp');

  // ================================================================ waterfront: boardwalk, beach, pier, sea
  fill(c, 1, 52, 75, 6, 'minato_deck');
  fill(c, 76, 52, 15, 6, 'sand');
  for (let x = 1; x <= 75; x++) set(c, x, 58, 'minato_quay');
  for (let x = 76; x <= 90; x++) set(c, x, 58, 'minato_shore');
  fill(c, 0, 59, W, H - 59, 'minato_sea');
  fill(c, 40, 58, 3, 4, 'minato_deck');
  P2(41, 61, 'minato_bollard');
  for (const x0 of [3, 23, 35, 59]) {
    fill(c, x0, 53, 3, 2, 'grass');
    set(c, x0, 53, 'flowers'); set(c, x0 + 2, 54, 'flowers');
    P2(x0 + 1, 53, x0 % 2 ? 'minato_palm' : 'minato_ginkgo');
  }
  for (const x of [12, 20, 32, 44, 52, 66, 72]) P2(x, 52, 'lamp');
  for (const x of [8, 9, 18, 19, 48, 49, 64, 65]) P2(x, 55, 'bench');
  for (const x of [14, 30, 56, 70]) P2(x, 57, 'minato_scope');
  for (const [x, y] of [[77, 53], [83, 52], [89, 53], [80, 56], [88, 56]]) P2(x, y, 'minato_palm');
  for (const x of [80, 86]) P2(x, 54, 'minato_parasol');

  // ---- edges: trees all round, the sea fills the bottom, the west end opens to Tokyo
  for (let x = 0; x < W; x++) c[0][x] = ['grass', 'tree'];
  for (let y = 0; y < 59; y++) { c[y][0] = ['grass', 'tree']; c[y][W - 1] = ['grass', 'tree']; }
  for (let y = 24; y <= 28; y++) set(c, 0, y, y === 24 || y === 28 ? 'sidewalk' : y === 26 ? 'road_line_h' : 'road');
  const warps = [];
  for (let y = 24; y <= 28; y++) warps.push({ x: 0, y, place: 'tokyo', room: 'main', tx: 74, ty: y - MINATO_FROM_TOKYO, dir: 'left' });

  const TV = { type: 'building', kind: 'tower', style: 'glass' };
  const entities = [
    // ---- the five TV stations
    { type: 'building', x: 7, y: 5, w: 13, h: 9, door: 6, place: 'tbs', name: 'TBS', kind: 'office', logo: 'tbs', rise: 2, wall: '#f4f5f7', roof: '#3d63c8', glass: '#8fc0e8', texture: 'tile', canopy: '#3d63c8', signW: 76, signH: 32, plants: true },
    { ...TV, x: 35, y: 5, w: 14, h: 9, door: 7, place: 'tvasahi', name: 'テレビ朝日', logo: 'tvasahi', rise: 2, wall: '#f6f4f6', roof: '#c8ccd6', glass: '#9fd0ea', signW: 66, signH: 36, decorate: asahiDecorate },
    { ...TV, x: 65, y: 5, w: 10, h: 9, door: 5, place: 'tvtokyo', name: 'テレビ東京', rise: 3, wall: '#dfe4ea', roof: '#3a4658', glass: '#4a7aa8', sign: { text: 'テレビ東京', bg: '#ffffff', color: '#1d3f8f' }, signH: 22, canopy: '#2a3a52' },
    { ...TV, x: 3, y: 31, w: 14, h: 11, door: 7, place: 'ntv', name: '日本テレビ', logo: 'ntv', wall: '#eef0f4', roof: '#9aa6b8', glass: '#5f9fd8', signW: 62, signH: 42 },
    { type: 'building', x: 66, y: 34, w: 14, h: 13, door: 7, place: 'fujitv', name: 'フジテレビ', kind: 'studio', onair: false, wall: '#d4d8de', roof: '#9aa2ae', sign: { text: 'フジテレビ' }, decorate: fujiDecorate },
    // ---- other buildings (not enterable)
    { type: 'building', x: 51, y: 15, w: 7, h: 7, door: 3, name: 'スターヒル タワー', kind: 'tower', style: 'glass', rise: 3, wall: '#dfe5ec', roof: '#4a5568', glass: '#5a8ec0', sign: { text: 'STAR HILL' }, signH: 16,
      text: ['超高層ビル「スターヒル タワー」。', '上のほうには展望台や美術館があるらしい。\n…今日は休館日だ。'] },
    { type: 'building', x: 77, y: 4, w: 7, h: 9, door: 3, name: 'みなとドットタワー', kind: 'tower', style: 'glass', rise: 2, wall: '#e4e8ee', roof: '#3f4a5c', glass: '#7aa6cc', sign: { text: 'MINATO DOT' }, signH: 16,
      text: ['オフィスタワーだ。', '番組の制作会社や、IT企業がたくさん入っているらしい。'] },
    { type: 'building', x: 19, y: 31, w: 8, h: 7, door: 4, name: 'しおかぜビル', kind: 'office', wall: '#e0e4ea', roof: '#5a6a80', sign: { text: 'しおかぜビル' },
      text: ['オフィスビル「しおかぜビル」。', '広告の会社や、番組の制作会社が入っているらしい。\n「関係者以外 立入禁止」の札がある。'] },
    { type: 'building', x: 2, y: 20, w: 4, h: 3, door: 2, name: 'コーヒースタンド', kind: 'small', wall: '#efe4d4', roof: '#3a2c24', sign: { text: 'コーヒー', bg: '#3a2c24', color: '#fff3dc' }, talk: coffeeStand },
    { type: 'building', x: 65, y: 19, w: 5, h: 4, door: 2, name: 'CAFE MINATO', kind: 'cafe', sign: { text: 'CAFE MINATO', bg: '#2f4a3a', color: '#f4efe6' }, talk: coffeeStand },
    { type: 'building', x: 71, y: 19, w: 5, h: 4, door: 2, name: 'ドットマート', kind: 'konbini', sign: { text: 'ドットマート' },
      text: ['コンビニ「ドットマート」。', 'お昼どきで、レジに長い行列ができている…。\n買い物は、東京エリアのローソンにしよう。'] },
    { type: 'building', x: 78, y: 17, w: 8, h: 6, door: 4, name: 'ホテル ドット港', kind: 'hotel', wall: '#ece6dc', roof: '#3a4a7a', sign: { text: 'HOTEL DOT MINATO', bg: '#1d2a5e', color: '#ffd23f' },
      text: ['ホテル「ドット港」。', '番組の出演者やスタッフが泊まることも多いらしい。\n…予約でいっぱいだ。'] },

    // ---- landmarks & props
    radioTower(85, 12),
    ferrisWheel(83, 44),
    karakuri(21, 43),
    monorail(W),
    monoStation(WEST_STATION.x, 'しおさい広場駅', true),
    monoStation(EAST_STATION.x, 'うみかぜ埠頭駅', false),
    vision(15, 21, 4),
    vision(43, 18, 4, { text: ['街頭ビジョンだ。', '「テレビ局では、番組のお仕事やオーディションも！\n　くわしくは各局の受付へ」…と流れている。'] }),
    streetStage(36, 16, 4, { z: -40 }),   // sorted before the people standing on it
    streetStage(50, 30, 4, { z: -40 }),
    fountain(45, 39, { text: ['まんなか公園の噴水だ。', '水しぶきの向こうで、テレビのロケ隊が\n撮影の準備をしている。'] }),
    statue(42, 21, { text: ['「星をつかむ人」という名前の像だ。', '台座に「夢は、つかみにいくもの」と刻まれている。'] }),
    koi(51, 4, 6, 2, 2),
    koi(51, 7, 6, 2, 1),
    foodTruck(44, 20, 'crepe', crepeTruck),
    foodTruck(36, 30, 'curry', curryTruck),
    foodTruck(40, 30, 'coffee', coffeeTruck),
    foodTruck(44, 30, 'soft', softTruck),
    busStop(34, 29, { text: undefined, talk: takeBus }),
    mapBoard(2, 29, [0.05, 0.45]),
    mapBoard(55, 29, [0.55, 0.6]),
    mapBoard(37, 22, [0.45, 0.3]),
    boats(W, 61),
    gulls(40, 54, 44, 54),
    signpost(1, 23, '東京エリア', 'left', ['道しるべだ。', '← 東京エリア\n（ドット荘・東京駅・NHK・事務所）\nこの大通りを西へまっすぐ。']),
    signpost(27, 20, 'あかね坂', 'left', ['「あかね坂」', '坂の上にはTBS。\n夕焼けの時間は、坂ぜんぶがあかね色に染まるという。']),
    signpost(63, 32, 'うみかぜ埠頭', 'right', ['道しるべだ。', '→ うみかぜ埠頭（フジテレビ・観覧車・ビーチ）\n↓ 高架の下の遊歩道、モノレール「ベイライン」']),
    { type: 'sign', x: 41, y: 61, text: ['桟橋の先の看板だ。', '「水上バス のりば\n　本日は貸切クルーズのため、運休します」', '…海の向こうに、大きな橋がかすんで見える。'] },
    { type: 'sign', x: 8, y: 21, text: ['広告塔だ。', 'ドラマ、バラエティ、音楽番組…\n新番組のポスターがぐるりと貼られている。'] },
    ...[[44, 43], [48, 43], [40, 46], [52, 46], [8, 55], [9, 55], [18, 55], [19, 55], [48, 55], [49, 55], [64, 55], [65, 55], [20, 46], [23, 46]].map(([x, y]) => ({ type: 'sign', x, y, talk: restBench })),
    ...[14, 30, 56, 70].map((x) => ({ type: 'sign', x, y: 57, text: ['観光用の双眼鏡だ。', 'のぞいてみると…\n海の上を、水上バスがすべっていく。\n遠くの島に、白い灯台が見える。'] })),

    // ---- people: あかね坂
    { type: 'npc', id: 'minato_tbs_fan', x: 12, y: 20, dir: 'up', look: { ...LOOKS.fan, top: '#5f8fe6' }, name: 'ドラマファン',
      text: ['坂の上のTBSで、ドラマの撮影があるんだって！\n出待ちしてるの。', 'TBSはドラマや音楽番組、情報番組で知られる\nテレビ局なんだよ。\n演技に自信があるなら、のぞいてみたら？'] },
    { type: 'npc', id: 'minato_tbs_fan2', x: 15, y: 20, dir: 'up', look: { ...LOOKS.fan, hairColor: 'black', top: '#ff9ac0' }, name: 'ファンの子',
      text: ['この階段の下が、いちばんよく見えるんだ〜。', '…あ、坂の上にある大きなビルがTBSだよ。\n階段をのぼればすぐ！'] },
    { type: 'npc', id: 'minato_tbs_ad', x: 24, y: 11, dir: 'down', look: { ...LOOKS.ad, top: '#2f6fd0' }, name: 'ADさん', wander: 1,
      text: ['ふう…収録の合間の休憩中です。', 'テレビの現場はチームワーク！\nあいさつと時間を守ることが、なにより大事ですよ。'] },
    { type: 'npc', id: 'minato_saka_oldman', x: 22, y: 20, dir: 'left', look: LOOKS.oldman, name: 'おじいさん', wander: 2,
      text: ['この坂は、昔から「あかね坂」と呼ばれとる。\n夕焼けがきれいでのう。', '坂の上には放送局。\n毎日たくさんの若い人が、夢を持ってのぼっていくんじゃ。'] },
    { type: 'npc', id: 'minato_tbs_guard', x: 16, y: 14, dir: 'down', look: LOOKS.guard, name: '警備員さん',
      text: ['こちらはTBSです。\n出演者や見学のかたは、正面の入口からどうぞ。'] },
    // ---- people: スターヒル広場
    { type: 'npc', id: 'minato_ex_guard', x: 44, y: 14, dir: 'down', look: LOOKS.guard, name: '警備員さん',
      text: ['テレビ朝日へようこそ。\n正面の入口からどうぞ。', '広場のステージでは、ときどき番組の\nイベントもやっていますよ。'] },
    { type: 'npc', id: 'minato_ex_tourist', x: 40, y: 20, dir: 'up', look: LOOKS.tourist, name: '観光客', wander: 2,
      text: ['この広場、ドラマのロケ地にもなってるんだって！', 'テレビ朝日は、ドラマにバラエティ、ニュース、\nスポーツ中継まで、いろんな番組を作ってるんだよ。'] },
    { type: 'npc', id: 'minato_dancer', x: 37, y: 16, dir: 'down', look: { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ff4f8b', bottom: '#20232a', skirt: true }, name: 'ダンサー', fixedDir: true,
      text: ['ワン・ツー・スリー・フォー！', '広場のステージでダンスの練習中！\nいつか歌番組のバックで踊るのが夢なんだ。'] },
    { type: 'npc', id: 'minato_dancer2', x: 39, y: 16, dir: 'down', look: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#5fd7ff', bottom: '#20232a' }, name: 'ダンサー', fixedDir: true,
      text: ['ダンスはリズムが命！\nステップを体で覚えるまで、何度も練習さ。', '歌や踊りのお仕事なら、\n東京エリアの事務所のレッスンもおすすめだよ。'] },
    { type: 'npc', id: 'minato_garden_kid', x: 53, y: 10, dir: 'up', look: { ...LOOKS.kid, top: '#ffd23f' }, name: 'こども',
      text: ['池のコイ、赤いのと白いのがいるよ！', 'エサをあげちゃダメなんだって。\n…見てるだけでも、たのしいね！'] },
    // ---- people: 電波塔通り
    { type: 'npc', id: 'minato_tx_salaryman', x: 67, y: 15, dir: 'down', look: { ...LOOKS.salaryman, tie: '#2f6fd0' }, name: '会社員', wander: 2,
      text: ['テレビ東京は、ひと味ちがう番組が多いんだよね。', '経済ニュースに旅番組、アニメも強い。\nほかの局がやらないことをやる…そこがいいのさ。'] },
    { type: 'npc', id: 'minato_tower_photo', x: 84, y: 15, dir: 'up', look: { hair: 'cap', hat: '#5a6f8a', hairColor: 'black', skin: 'fair', top: '#e8c058', bottom: '#3b3f48' }, name: 'カメラ好きの人',
      text: ['電波塔って、真下から見ると迫力あるなあ！', '赤と白のしましまは、飛行機から見えやすく\nするためなんだって。'] },
    { type: 'npc', id: 'minato_staff_break', x: 76, y: 20, dir: 'down', look: { ...LOOKS.staff, top: '#20232a' }, name: '番組スタッフ',
      text: ['編集作業で、ちょっと寝不足…。\nコーヒーが手放せないよ。', '番組は、企画・撮影・編集・音入れ…\nたくさんの人の手で作られてるんだ。\n出演者は、その顔なんだよ。'] },
    // ---- people: しおさい広場
    { type: 'npc', id: 'minato_ntv_fan', x: 7, y: 43, dir: 'up', look: { ...LOOKS.fan, top: '#d62f2f' }, name: 'ファンの子',
      text: ['日本テレビの前で、推しの出待ち中！', '日本テレビは、バラエティに情報番組、ドラマ、\nスポーツ中継…見ない日はないくらいだよね！'] },
    { type: 'npc', id: 'minato_ntv_fan2', x: 13, y: 43, dir: 'up', look: { ...LOOKS.fan, hairColor: 'blonde', top: '#ffd23f' }, name: 'ファンの子',
      text: ['うちわ、手作りしたんだ〜！', '出てくるまで、あと少し…\n…でもトイレに行きたい…！'] },
    { type: 'npc', id: 'minato_ntv_staff', x: 15, y: 45, dir: 'left', look: { ...LOOKS.staff, top: '#ff8a3d' }, name: '観覧スタッフ',
      text: ['番組観覧のお客さまは、こちらに並んでくださーい！\n…あ、ちがいました？', '観覧のお客さんの笑い声や拍手も、\n番組の大事な一部なんですよ。'] },
    { type: 'npc', id: 'minato_mom', x: 19, y: 44, dir: 'right', look: { ...LOOKS.mom, top: '#8a5ac8' }, name: 'お母さん',
      text: ['からくり時計の人形が動くのを、待ってるんです。', 'この広場は駅にも近くて便利なのよ。\nモノレールで、海のほうまで行けるの。'] },
    { type: 'npc', id: 'minato_karakuri_kid', x: 20, y: 45, dir: 'up', look: { ...LOOKS.kid, top: '#5fd7ff' }, name: 'こども',
      text: ['まだかなあ、まだかなあ…。', 'からくり時計がうごくと、\nお人形さんたちが楽器をひくんだよ！'] },
    // ---- people: まんなか公園
    { type: 'npc', id: 'minato_performer', x: 51, y: 30, dir: 'down', look: PERFORMER.look, name: PERFORMER.name, fixedDir: true, talk: performerTalk },
    { type: 'npc', id: 'minato_audience', x: 50, y: 33, dir: 'up', look: { ...LOOKS.kid, top: '#ff8a3d' }, name: 'こども',
      text: ['すごーい！\nボールが5つも宙に浮いてる！', 'ぼくも大きくなったら、\nテレビに出てジャグリングする！'] },
    { type: 'npc', id: 'minato_audience2', x: 53, y: 33, dir: 'up', look: { ...LOOKS.oldwoman, top: '#2f9a4a' }, name: 'おばあちゃん',
      text: ['いい芸ねえ。\nこういうのを見ると、元気が出るわ。', 'キッチンカーのカレーがおいしいのよ。\nあなたも、しっかり食べなさいね。'] },
    { type: 'npc', id: 'minato_reporter', x: 52, y: 40, dir: 'left', look: { ...LOOKS.announcer, top: '#ffd23f' }, name: 'リポーター', talk: interviewTalk },
    { type: 'npc', id: 'minato_cameraman', x: 50, y: 40, dir: 'right', look: LOOKS.cameraman, name: 'カメラマン',
      text: ['いま、街頭インタビューのロケ中なんです。', 'となりのリポーターさんに話しかけられたら、\n協力してあげてくださいね！'] },
    { type: 'npc', id: 'minato_jogger', x: 36, y: 41, dir: 'down', look: { hair: 'short', hairColor: 'brown', skin: 'tan', top: '#2f6fd0', bottom: '#20232a' }, name: 'ジョギング中の人', wander: 3,
      text: ['ハッ、ハッ…。\nお昼休みに、公園をひと走り！', 'ここは広いから、走りがいがあるよ。\n海ぞいの遊歩道も、気持ちいいんだ。'] },
    // ---- people: waterfront
    { type: 'npc', id: 'minato_fuji_fan', x: 70, y: 48, dir: 'up', look: { ...LOOKS.fan, top: '#c8ccd4' }, name: 'ファンの子',
      text: ['フジテレビの、あの銀色の球体！\nあそこから、海が見わたせるんだって！', 'フジテレビは、バラエティもドラマも\nずっと話題になってきたテレビ局なんだよ。'] },
    { type: 'npc', id: 'minato_wheel_staff', x: 89, y: 47, dir: 'left', look: { ...LOOKS.staff, top: '#d64545', hat: '#d64545' }, name: '観覧車の係員',
      text: ['観覧車「ドット・ベイホイール」へようこそ！', '1周およそ15分。てっぺんからは、\nテレビ局も電波塔も、ぜんぶ見えますよ！\n（乗り場の前で話しかけてね）'] },
    { type: 'npc', id: 'minato_painter', x: 30, y: 54, dir: 'down', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#5fb8a8', bottom: '#3b3f48', hat: '#e8c058' }, name: '絵をかく人',
      text: ['海と空を描いてるの。\n…青って、何色もあるのよね。', 'テレビの仕事も、絵と同じかも。\n見る人の心に、何が残るか…なのよね。'] },
    { type: 'npc', id: 'minato_beach_tourist', x: 84, y: 55, dir: 'down', look: { ...LOOKS.tourist, top: '#ff7eb6' }, name: '観光客', wander: 2,
      text: ['街のなかにビーチがあるなんて！', '観覧車に乗ったら、\nフジテレビの球体がすぐそこに見えたよ！'] },
    { type: 'npc', id: 'minato_boardwalk_jogger', x: 50, y: 53, dir: 'left', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#ff8a3d', bottom: '#20232a' }, name: 'ランナー', wander: 4,
      text: ['海ぞいの遊歩道は、ランナーに人気なの！', '高架のモノレール「ベイライン」に乗れば、\n広場と埠頭をすぐ行き来できるよ。'] },
    { type: 'npc', id: 'minato_pier_man', x: 40, y: 60, dir: 'down', look: { ...LOOKS.oldman, top: '#2f6b4f', hat: '#e8c058' }, name: '海を見ている人',
      text: ['ここは釣り禁止だからね。\n海をながめているだけさ。', 'テレビ局の灯りが海にうつる夜は、\nそりゃあきれいなもんだよ。'] },
    { type: 'npc', id: 'minato_star_fan', x: 36, y: 50, dir: 'down', look: { ...LOOKS.fan, top: '#ff7eb6', hairColor: 'brown' }, name: 'ファンの子', cond: (g) => g.state.fame >= 250,
      talk: async (g, npc) => {
        await g.emote(npc.id, '!');
        const lines = ['えっ…！{name}さんですよね！？\nこの前、テレビで見ました！', 'テレビ局エリアで会えるなんて…！\nこれからも応援してます！'];
        if (g.state.fame >= 2000) lines.push('どの局の番組にも出てて、すごいなあ…！');
        await g.say(lines, who(npc));
        g.emote(npc.id, '♥');
      } },
  ];

  const events = [];
  return { w: W, h: H, cells: c, entities, warps, events };
}

registerPlace({
  id: 'minato',
  name: 'テレビ局エリア',
  kind: 'town',
  bgm: 'town',
  start: { room: 'main', x: 2, y: 26, dir: 'right' },
  rooms: {
    main: {
      generate,
      bg: '#62b35b',
      onEnter: async (g) => {
        if (g.flag('minato_intro')) return;
        g.setFlag('minato_intro');
        await g.wait(250);
        await g.say([
          '大通りの先に、大きなビルが立ち並んでいる。\nここは「テレビ局エリア」だ！',
          '日本テレビ、TBS、テレビ朝日、フジテレビ、テレビ東京…。\nテレビ局が集まる、とても広い街だ。',
          '入口の案内図を見ておくと、迷わずにすみそうだ。',
        ]);
      },
    },
  },
});
