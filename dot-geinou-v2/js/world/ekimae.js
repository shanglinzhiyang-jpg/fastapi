// 駅前の街 (owner: R9-B1) — a reusable builder for the 駅前 areas of the rail network (js/world/eki_net.js), plus the
// props they share. The areas themselves: js/world/ekimae_tokyo.js (渋谷・新宿・上野・浅草・秋葉原・下北沢・調布・府中)
// and js/world/ekimae_osaka.js (梅田・新世界).
//
//   ekimae(spec) registers a town place:
//     { id, name, station, region ('tokyo'|'osaka'), bgm, W, H, ground, plaza, rail ('ground'|'elevated'|'under'),
//       sx (the station building's x), look { wall, roof, sign, glass } (the station building), rotary: x | null,
//       paint(K) (tiles: K = { c, W, H, set, put, fill, hroad, vroad }), entities(K) → [...], events(K) → [...],
//       intro: [lines] (first visit), guide: { name, short, hint, lines } (てちょう), exitNote }
//   Frame of every area (rows): 0 trees, 1–4 the railway (on the ground behind a fence, on a 高架, or nothing for an
//   underground station), 4–8 the station building (door → the 駅構内 'eki' room of the station), 9–11 the station
//   plaza (arrival in front of the door), 12–15 the bus / taxi rotary, 16–20 the main road, 21– the blocks.
//   PLACES[id].ekiExit = { x, y, dir } (where a train arrives); the place's region is set for weather modules.
//   Props: trainBand, subwayEntrance, signpost, bigScreen, statueDog, lantern gate, tower, wheel, skyline, …

import { registerPlace, PLACES } from '../engine/map.js';
import { defineTile, R as TR, P as TP } from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { TILE, fmtMoney } from '../engine/util.js';
import { text } from '../engine/draw.js';
import { grid, set, put, fill, hroad, vroad, border, unstick } from './townkit.js';
import { taxi, busStop } from './props.js';
import * as NET from './eki_net.js';
import { GUIDE, GUIDE_ORDER } from './guide.js';

const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
export const yearOf = (g) => NET.dateOf(g).year;
export const ymOf = (g) => NET.ymOf(g);

// ---------------------------------------------------------------- tiles
defineTile('ekimae_viaduct', {
  solid: true,
  draw(c) { TR(c, 0, 0, 16, 16, '#a8acb4'); TR(c, 3, 5, 10, 11, '#4a4e58'); },
  hd(c) {
    TR(c, 0, 0, 32, 32, '#b4b8c0'); TR(c, 0, 0, 32, 3, '#d4d8de'); TR(c, 0, 3, 32, 1, '#8e929a');
    TR(c, 5, 9, 22, 23, '#4a4e58'); TR(c, 7, 7, 18, 2, '#4a4e58'); TR(c, 9, 6, 14, 1, '#4a4e58');
    TR(c, 6, 10, 2, 22, '#3a3e48'); TR(c, 0, 31, 32, 1, '#7e828a');
    for (const x of [1, 28]) TR(c, x, 6, 2, 26, '#9a9ea6');
  },
});
defineTile('ekimae_sky', {
  solid: true,
  draw(c) { TR(c, 0, 0, 16, 8, '#a8d4f4'); TR(c, 0, 8, 16, 8, '#c4e2f8'); },
  hd(c) { for (let y = 0; y < 32; y += 4) TR(c, 0, y, 32, 4, y < 12 ? '#a4d0f2' : y < 24 ? '#b6daf6' : '#c8e4f8'); },
});
defineTile('ekimae_crossing', {
  draw(c) { TR(c, 0, 0, 16, 16, '#5a5d66'); TR(c, 0, 5, 16, 1, '#c0c4cc'); TR(c, 0, 10, 16, 1, '#c0c4cc'); },
  hd(c) {
    TR(c, 0, 0, 32, 32, '#5f626b');
    for (let i = 0; i < 30; i++) TP(c, (i * 11) % 32, (i * 7) % 32, '#6a6d76');
    TR(c, 0, 8, 32, 16, '#3a3d44');
    for (const y of [10, 20]) { TR(c, 0, y, 32, 2, '#c8ccd4'); TR(c, 0, y + 2, 32, 1, '#5a5d66'); }
  },
});
defineTile('ekimae_paving', {
  draw(c) { TR(c, 0, 0, 16, 16, '#d8d2c4'); TR(c, 0, 15, 16, 1, '#c4bdae'); TR(c, 15, 0, 1, 16, '#c4bdae'); },
  hd(c) {
    TR(c, 0, 0, 32, 32, '#dcd6c8');
    TR(c, 0, 15, 32, 1, '#c6bfb0'); TR(c, 0, 31, 32, 1, '#c6bfb0'); TR(c, 15, 0, 1, 32, '#c6bfb0'); TR(c, 31, 0, 1, 32, '#c6bfb0');
    TR(c, 0, 16, 32, 1, '#e8e3d8'); TR(c, 16, 0, 1, 32, '#e8e3d8');
  },
});

// ---------------------------------------------------------------- props
// trains passing on the band (rows y..y+1), in the colours of the lines
export function trainBand(x, y, w, colors, extra = {}) {
  return {
    type: 'prop', x, y, w, h: 2, solid: false, z: -50,
    draw(ctx, sx, sy, g) {
      const per = 520;
      const f = (g.frame || 0) + (extra.phase || 0);
      const k = Math.floor(f / per) % colors.length;
      const t = f % per;
      if (t > 300) return;
      const dir = k % 2 ? -1 : 1;
      const len = 330, span = w * TILE;
      const off = dir > 0 ? -len + (t / 300) * (span + len * 2) - len * 0 : span + len - (t / 300) * (span + len * 2);
      const col = colors[k];
      ctx.save();
      ctx.beginPath(); ctx.rect(sx, sy - 10, span, 44); ctx.clip();
      for (let n = 0; n < 3; n++) {
        const cx = sx + off + n * 112;
        F(ctx, cx, sy - 2, 108, 26, '#4a4e58'); F(ctx, cx + 0.5, sy - 1.5, 107, 25, '#e4e7ec');
        F(ctx, cx + 0.5, sy + 14, 107, 3, col);
        for (let d = 0; d < 8; d++) F(ctx, cx + 5 + d * 13, sy + 2, 8, 8, '#3b4a6a');
        F(ctx, cx, sy + 24, 108, 2, '#20232a');
      }
      ctx.restore();
    },
    ...extra,
  };
}
// a 地下鉄の出入口 (3x2): roofed stairs going down; the middle of the front row is the way in (an event of the area)
export function subwayEntrance(x, y, color, label, extra = {}) {
  return {
    type: 'prop', x, y, w: 3, h: 2, solid: false,
    draw(ctx, sx, sy) {
      F(ctx, sx + 2, sy - 6, 44, 6, '#3b3f48'); F(ctx, sx + 2.5, sy - 5.5, 43, 5, color);
      text(ctx, label, sx + 24, sy - 6, { size: 4, align: 'center', color: '#ffffff', shadow: null });
      F(ctx, sx + 3, sy, 3, 30, '#5a5f6b'); F(ctx, sx + 42, sy, 3, 30, '#5a5f6b');
      F(ctx, sx + 6, sy + 2, 36, 28, '#2a2d36');
      for (let k = 0; k < 6; k++) F(ctx, sx + 8, sy + 6 + k * 4, 32, 2, k % 2 ? '#3b3f48' : '#4a4e58');
      F(ctx, sx + 6, sy + 28, 36, 2, '#e8c43a');
    },
    ...extra,
  };
}
// a sign board on a post: { label, lines }
export function postSign(x, y, label, lines, color = '#2a4a8a') {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true, text: lines,
    draw(ctx, sx, sy) {
      F(ctx, sx + 7, sy - 2, 2, 17, '#5a5f6b');
      const w = Math.max(18, label.length * 5 + 6);
      F(ctx, sx + 8 - w / 2, sy - 12, w, 10, '#20232a'); F(ctx, sx + 8.5 - w / 2, sy - 11.5, w - 1, 9, color);
      text(ctx, label, sx + 8, sy - 11, { size: 5, align: 'center', color: '#ffffff', shadow: null });
    },
  };
}
// a big outdoor screen on a wall: animated colour blocks and a ticker (content by year)
export function bigScreen(x, y, w, h, ticker, extra = {}) {
  return {
    type: 'prop', x, y, w, h, solid: false, z: 400,
    draw(ctx, sx, sy, g) {
      const W = w * TILE, Hh = h * TILE;
      F(ctx, sx, sy, W, Hh, '#20232a');
      const t = Math.floor((g.frame || 0) / 30);
      const pal = ['#ff4f8b', '#5fd7ff', '#ffd23f', '#7ae07a', '#c08aff'];
      F(ctx, sx + 1, sy + 1, W - 2, Hh - 8, pal[t % pal.length]);
      F(ctx, sx + 1 + ((t * 7) % (W - 12)), sy + 4, 10, Hh - 14, pal[(t + 2) % pal.length]);
      const msg = typeof ticker === 'function' ? ticker(g) : ticker;
      const off = ((g.frame || 0) * 0.4) % (W + msg.length * 6);
      ctx.save(); ctx.beginPath(); ctx.rect(sx + 1, sy + Hh - 7, W - 2, 6); ctx.clip();
      F(ctx, sx + 1, sy + Hh - 7, W - 2, 6, '#0b0d12');
      text(ctx, msg, sx + W - off, sy + Hh - 7.5, { size: 5, color: '#ffe48a', shadow: null });
      ctx.restore();
    },
    ...extra,
  };
}
// a dog statue on a pedestal (渋谷)
export function statueDog(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true,
    draw(ctx, sx, sy) {
      F(ctx, sx + 1, sy + 4, 14, 11, '#9aa0aa'); F(ctx, sx + 1, sy + 4, 14, 1.5, '#c8ccd4'); F(ctx, sx + 1, sy + 14, 14, 1, '#6a707c');
      // the dog (bronze), sitting
      F(ctx, sx + 4, sy - 4, 8, 8, '#6a5a3a'); F(ctx, sx + 9, sy - 9, 5, 6, '#6a5a3a'); F(ctx, sx + 13, sy - 7, 2, 2, '#6a5a3a');
      F(ctx, sx + 10, sy - 11, 1.5, 3, '#5a4a2a'); F(ctx, sx + 12, sy - 11, 1.5, 3, '#5a4a2a');
      F(ctx, sx + 4, sy - 4, 8, 1, '#8a7a5a'); F(ctx, sx + 9, sy - 9, 5, 1, '#8a7a5a'); F(ctx, sx + 2.5, sy, 2, 3, '#6a5a3a');
    },
    ...extra,
  };
}
// a tall tower drawn up from its footprint (通天閣, スカイツリー in the distance …)
export function tower(x, y, w, kind, extra = {}) {
  return {
    type: 'prop', x, y, w, h: 2, solid: true,
    draw(ctx, sx, sy, g) {
      const cx = sx + (w * TILE) / 2;
      if (kind === 'tsutenkaku') {
        // four legs over the street, the shaft with the lit sign, the observation deck, the spire with its weather lights
        const gy = sy + 30;
        for (const d of [-28, 22]) { F(ctx, cx + d, gy - 44, 6, 46, '#7d828c'); F(ctx, cx + d + 1, gy - 44, 2, 46, '#aeb3bc'); }
        for (let k = 0; k < 3; k++) F(ctx, cx - 24, gy - 40 + k * 14, 48, 2, '#8a8f99');
        for (let k = 0; k < 2; k++) for (let i = 0; i < 8; i++) F(ctx, cx - 22 + i * 6, gy - 34 + k * 14 + (i % 2) * 5, 3, 3, '#8a8f99');
        F(ctx, cx - 18, gy - 56, 36, 14, '#a8adb6'); F(ctx, cx - 18, gy - 56, 36, 2, '#d0d4da');
        F(ctx, cx - 11, gy - 112, 22, 58, '#b4b8c0'); F(ctx, cx - 11, gy - 112, 5, 58, '#d4d8de'); F(ctx, cx + 7, gy - 112, 4, 58, '#8e929a');
        const lit = Math.floor((g.frame || 0) / 40) % 2;
        F(ctx, cx - 14, gy - 104, 28, 44, '#20232a'); F(ctx, cx - 13, gy - 103, 26, 42, '#2a2d36');
        ['通', '天', '閣'].forEach((ch, i) => text(ctx, ch, cx, gy - 102 + i * 13, { size: 11, align: 'center', color: lit ? '#ffe48a' : '#ff8a3d', shadow: null }));
        F(ctx, cx - 24, gy - 138, 48, 26, '#c8ccd4'); F(ctx, cx - 24, gy - 138, 48, 3, '#e8ecf0'); F(ctx, cx - 22, gy - 131, 44, 10, '#3b4a6a');
        for (let k = 0; k < 6; k++) F(ctx, cx - 20 + k * 7, gy - 129, 4, 6, '#8fc0e8');
        F(ctx, cx - 18, gy - 144, 36, 6, '#b4b8c0');
        F(ctx, cx - 3, gy - 162, 6, 18, '#c8ccd4'); F(ctx, cx - 1, gy - 172, 2, 10, '#9a9ea6');
        for (const [dx, col] of [[-14, '#ff4f4f'], [-5, '#ffd23f'], [5, '#4fd04f'], [14, '#4f8fff']]) F(ctx, cx + dx - 2, gy - 143, 4, 4, col);
      }
    },
    ...extra,
  };
}
// the skyline behind the railway (rows 0..1 are sky): low buildings across the width, plus landmark parts
// parts: [{ x, w, h, col } | { cond, draw(ctx, sx, baseY, g) }] in units from the area's left edge; baseY = the bottom
export function skyline(W, parts = [], seed = 1, extra = {}) {
  const blocks = [];
  let x = 0, k = seed;
  while (x < W * TILE) { k = (k * 1103515245 + 12345) & 0x7fffffff; const w = 14 + (k % 22), h = 8 + ((k >> 5) % 18); blocks.push([x, w, h, ['#9aa6bc', '#a8b2c6', '#8e9ab2', '#b4bccc'][k % 4]]); x += w + (k % 4); }
  return {
    type: 'prop', x: 0, y: 0, w: W, h: 2, solid: false, z: -900,
    draw(ctx, sx, sy, g) {
      const base = sy + 31;
      for (const p of parts) if (p.back && (!p.cond || p.cond(g))) p.draw(ctx, sx, base, g);
      for (const [bx, bw, bh, col] of blocks) {
        F(ctx, sx + bx, base - bh, bw, bh, col);
        for (let wy = base - bh + 3; wy < base - 2; wy += 4) for (let wx = sx + bx + 2; wx < sx + bx + bw - 2; wx += 4) F(ctx, wx, wy, 1.5, 1.5, 'rgba(255,255,255,0.45)');
      }
      for (const p of parts) if (!p.back && (!p.cond || p.cond(g))) p.draw(ctx, sx, base, g);
    },
    ...extra,
  };
}
// a ferris wheel on a roof (梅田), drawn above its building
export function wheel(x, y, r, color, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, z: 300,
    draw(ctx, sx, sy, g) {
      const cx = sx + 8, cy = sy - r;
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      const a0 = (g.frame || 0) / 400;
      for (let k = 0; k < 12; k++) {
        const a = a0 + (k * Math.PI) / 6;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
        F(ctx, px - 1.5, py - 1, 3, 3, ['#ffd23f', '#5fd7ff', '#ffffff'][k % 3]);
      }
      F(ctx, cx - 1, cy - 1, 2, 2, '#ffffff');
    },
    ...extra,
  };
}
// a gate with a huge paper lantern (浅草), 5 wide: solid pillars at both ends, walk under the middle
export function lanternGate(x, y, label, extra = {}) {
  return {
    type: 'prop', x, y, w: 5, h: 1, solid: false, z: 500,
    draw(ctx, sx, sy) {
      for (const px of [sx + 2, sx + 70]) { F(ctx, px, sy - 30, 8, 46, '#a8202a'); F(ctx, px + 1, sy - 30, 2, 46, '#d84a4a'); }
      F(ctx, sx - 2, sy - 42, 84, 6, '#3a2a20'); F(ctx, sx - 4, sy - 46, 88, 5, '#5a4030'); F(ctx, sx, sy - 36, 80, 6, '#a8202a');
      // the lantern
      F(ctx, sx + 26, sy - 30, 28, 30, '#c8202a'); F(ctx, sx + 24, sy - 26, 32, 22, '#d8303a');
      F(ctx, sx + 26, sy - 32, 28, 3, '#20232a'); F(ctx, sx + 26, sy - 1, 28, 3, '#20232a');
      for (let k = 0; k < 5; k++) F(ctx, sx + 24, sy - 24 + k * 5, 32, 0.5, '#a8101a');
      text(ctx, label, sx + 40, sy - 24, { size: 9, align: 'center', color: '#20232a', shadow: null });
    },
    ...extra,
  };
}
export function lanternPillars(x, y) { return [{ type: 'sign', x, y, solid: true, text: '朱塗りの柱だ。' }, { type: 'sign', x: x + 4, y, solid: true, text: '朱塗りの柱だ。' }]; }
// a red-and-white crossing barrier with blinking lights (下北沢's 踏切, before the line went underground)
export function crossingBarrier(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true,
    draw(ctx, sx, sy, g) {
      const on = Math.floor((g.frame || 0) / 20) % 2;
      F(ctx, sx + 6, sy - 14, 3, 30, '#20232a');
      F(ctx, sx + 1, sy - 16, 13, 4, '#20232a');
      F(ctx, sx + 1.5, sy - 15.5, 4, 3, on ? '#ff3b3b' : '#5a1010'); F(ctx, sx + 9.5, sy - 15.5, 4, 3, on ? '#5a1010' : '#ff3b3b');
      F(ctx, sx + 3, sy - 10, 9, 6, '#ffd23f');
      for (let k = 0; k < 3; k++) F(ctx, sx + 3 + k * 3, sy - 10, 1.5, 6, '#20232a');
    },
    ...extra,
  };
}
// a car moving along a loop inside a rectangle (the 教習コース): the course itself is tiles
export function courseCar(x0, y0, x1, y1, color, phase = 0) {
  return {
    type: 'prop', x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, solid: false, z: 20,
    draw(ctx, sx, sy, g) {
      const W = (x1 - x0) * TILE, Hh = (y1 - y0) * TILE;
      const per = 2 * (W + Hh);
      let d = ((g.frame || 0) * 0.35 + phase) % per;
      let px, py, horiz;
      if (d < W) { px = d; py = 0; horiz = true; } else if (d < W + Hh) { px = W; py = d - W; horiz = false; } else if (d < 2 * W + Hh) { px = W - (d - W - Hh); py = Hh; horiz = true; } else { px = 0; py = Hh - (d - 2 * W - Hh); horiz = false; }
      const cx = sx + px + 8, cy = sy + py + 8;
      if (horiz) { F(ctx, cx - 11, cy - 6, 22, 11, '#3b3f48'); F(ctx, cx - 10.5, cy - 5.5, 21, 10, color); F(ctx, cx - 5, cy - 4.5, 10, 8, '#8fd0ff'); F(ctx, cx - 2, cy - 9, 4, 3, '#ffd23f'); }
      else { F(ctx, cx - 6, cy - 11, 11, 22, '#3b3f48'); F(ctx, cx - 5.5, cy - 10.5, 10, 21, color); F(ctx, cx - 4.5, cy - 5, 8, 10, '#8fd0ff'); F(ctx, cx - 1.5, cy - 2, 3, 4, '#ffd23f'); }
    },
  };
}
// a parked car seen from above (2x1)
export function parkedCar(x, y, color, extra = {}) {
  return {
    type: 'prop', x, y, w: 2, h: 1, solid: true, text: '駐車場に、車が停まっている。',
    draw(ctx, sx, sy) {
      F(ctx, sx + 3, sy + 13, 26, 2, 'rgba(0,0,0,0.25)');
      F(ctx, sx + 2, sy + 2, 28, 12, '#3b3f48'); F(ctx, sx + 2.5, sy + 2.5, 27, 11, color);
      F(ctx, sx + 9, sy + 3.5, 6, 9, '#8fd0ff'); F(ctx, sx + 20, sy + 3.5, 4, 9, '#8fd0ff'); F(ctx, sx + 15, sy + 3.5, 5, 9, color);
      F(ctx, sx + 28, sy + 4, 1.5, 2, '#fff6a8'); F(ctx, sx + 28, sy + 10, 1.5, 2, '#fff6a8');
    },
    ...extra,
  };
}
// a painted word on the ground (course marks: S字・クランク …)
export function groundMark(x, y, label, color = '#ffffff') {
  return {
    type: 'prop', x, y, w: 2, h: 1, solid: false, z: -800,
    draw(ctx, sx, sy) { text(ctx, label, sx + 16, sy + 3, { size: 6, align: 'center', color, shadow: 'rgba(0,0,0,0.35)' }); },
  };
}

// ---------------------------------------------------------------- facilities (talk-to buildings)
// eat on the spot: { greet, name, items: [{ name, price, heal, fill, stress, text }] }
export async function eatery(g, o, npc) {
  const its = o.items;
  const i = await g.ask(o.greet, [...its.map((it) => `${it.name} ${fmtMoney(it.price)}`), 'やめておく'], { cancel: its.length, name: o.name });
  if (i < 0 || i >= its.length) return;
  const it = its[i];
  if (it.fill && !g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。'); return; }
  if (!g.spend(it.price)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  const st = g.state.stamina;
  if (it.fill) g.eat(it.heal || 0, { silent: true, fill: it.fill });
  if (it.stress) g.relax({ stress: it.stress });
  if (it.minutes && typeof g.advanceTime === 'function') g.advanceTime(it.minutes, it.name);
  const got = g.state.stamina - st;
  await g.say([it.text, got > 0 ? `体力+${got}${it.stress ? `・ストレス-${it.stress}` : ''}` : it.stress ? `ストレス-${it.stress}` : 'ほっとひと息。']);
}
// buy a souvenir / item: { greet, items: [{ name, price, item (ITEMS id) }] }
export async function shop(g, o) {
  const its = o.items;
  const i = await g.ask(o.greet, [...its.map((it) => `${it.name} ${fmtMoney(it.price)}`), 'やめておく'], { cancel: its.length, name: o.name });
  if (i < 0 || i >= its.length) return;
  const it = its[i];
  if (!g.spend(it.price)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  if (it.item) g.giveItem(it.item);
  if (it.stress) g.relax({ stress: it.stress });
  await g.say(it.text || `${it.name}を買った。`);
}
// look at something nice once a day: a little less stress and a few minutes
export async function sight(g, key, lines, stress = 3, minutes = 15) {
  await g.say(lines);
  const k = `eki_sight_${key}`;
  if (g.flag(k) !== g.state.day) {
    g.setFlag(k, g.state.day);
    g.relax({ stress });
    if (typeof g.advanceTime === 'function') g.advanceTime(minutes, key);
    g.notify(`ストレス -${stress}`, { color: '#9ad0ff' });
  }
}
// a small stage job (talk to the venue): def for g.job
export async function stageJob(g, def) {
  return g.job({ confirm: true, ...def });
}

// ---------------------------------------------------------------- the builder
export function ekimae(spec) {
  const W = spec.W || 48, H = spec.H || 32;
  const sx = spec.sx ?? Math.floor(W / 2) - 6;
  const door = 6;
  const exit = { x: sx + door, y: 9, dir: 'down' };
  const st = spec.station;
  const lineCols = () => NET.LINE_ORDER.filter((l) => NET.LINES[l].stops.some((s) => s[0] === st) && l !== 'shinkansen').map((l) => NET.LINES[l].color);
  const enter = async (g) => {
    const api = PLACES.eki && PLACES.eki.api;
    if (api) await api.enterStation(g, st);
    else await g.say('（駅は工事中のようだ…）');
  };
  function generate() {
    const c = grid(W, H, spec.base || 'grass');
    const K = { c, W, H, sx, exit, set: (...a) => set(c, ...a), put: (...a) => put(c, ...a), fill: (...a) => fill(c, ...a), hroad: (...a) => hroad(c, ...a), vroad: (...a) => vroad(c, ...a) };
    fill(c, 1, 5, W - 2, H - 6, spec.ground || 'sidewalk');
    // the railway
    const rail = spec.rail || 'ground';
    if (rail === 'ground') {
      for (let x = 1; x < W - 1; x++) { set(c, x, 2, 'rail'); set(c, x, 3, 'rail'); put(c, x, 4, 'fence'); }
    } else if (rail === 'elevated') {
      for (let x = 1; x < W - 1; x++) { set(c, x, 2, 'eki_track'); set(c, x, 3, 'eki_track'); set(c, x, 4, 'ekimae_viaduct'); }
    } else {
      fill(c, 1, 2, W - 2, 3, spec.ground || 'sidewalk');
      for (let x = 1; x < W - 1; x++) put(c, x, 2, x % 3 ? 'hedge' : 'tree');
    }
    // the station plaza
    fill(c, 1, 5, W - 2, 7, spec.plaza || 'ekimae_paving');
    if (rail !== 'under') fill(c, sx, 4, 12, 5, spec.plaza || 'ekimae_paving');
    // the rotary (bus / taxi): a loop road with an island
    if (spec.rotary != null) {
      const rx = spec.rotary;
      for (let x = rx; x <= rx + 11; x++) { set(c, x, 12, 'road'); set(c, x, 15, 'road'); }
      for (let y = 12; y <= 15; y++) { set(c, rx, y, 'road'); set(c, rx + 11, y, 'road'); }
      fill(c, rx + 1, 13, 10, 2, 'grass');
      for (let x = rx + 1; x <= rx + 10; x++) if (x - rx !== 5) set(c, x, 14, 'flowers');
      put(c, rx + 2, 13, 'tree'); put(c, rx + 9, 13, 'tree'); put(c, rx + 5, 14, 'bush');
      for (const x of [rx + 4, rx + 7]) set(c, x, 16, 'road');
    }
    // the main road
    hroad(c, spec.roadY || 17, 1, W - 2);
    if (spec.paint) spec.paint(K);
    border(c, spec.border || 'tree');
    for (let x = 0; x < W; x++) { set(c, x, 0, 'ekimae_sky'); set(c, x, 1, 'ekimae_sky'); }
    K.c = c;
    const ents = [skyline(W, spec.skyline || [], spec.id.length * 7, { text: undefined })];
    if (rail === 'under') {
      ents.push(subwayEntrance(sx + 5, 7, lineCols()[0] || '#2a5ad0', `${NET.stName(st)}駅`, { text: undefined }));
      for (const x of [sx + 5, sx + 7]) ents.push({ type: 'sign', x, y: 8, solid: true, text: `地下鉄の出入口だ。「${NET.stName(st)}駅」` });
    } else {
      ents.push({ type: 'building', x: sx, y: 4, w: 12, h: 5, door, place: 'eki', enter, name: `${NET.stName(st)}駅`, kind: 'station', ...(spec.look || { wall: '#e8e4dc', roof: '#4a5a70' }), sign: { text: `${NET.stName(st)}駅`, bg: '#ffffff', ...((spec.look && spec.look.sign) || {}) } });
      if (rail !== 'none') ents.push(trainBand(1, 2, W - 2, lineCols().length ? lineCols() : ['#3fae49']));
    }
    if (spec.rotary != null) {
      const rx = spec.rotary;
      ents.push(taxi(rx + 1, 15), taxi(rx + 5, 12, '#2f9a4a'), busStop(rx + 10, 11, { text: ['バス停だ。', `「${NET.stName(st)}駅前」。路線バスが、街のあちこちへ出ている。`] }));
    }
    const sa = spec.signAt || [exit.x - 3, 10];
    ents.push(postSign(sa[0], sa[1], '駅前案内', spec.exitNote || [`${NET.stName(st)}駅前の案内板だ。`]));
    ents.push(...(spec.entities ? spec.entities(K) : []));
    ents.push(...crowd(spec, c, ents, exit));
    const events = spec.events ? spec.events(K) : [];
    if (rail === 'under') events.push({ x: sx + 6, y: 8, on: 'step', run: enter });
    return { w: W, h: H, cells: c, entities: ents, events };
  }
  const place = {
    id: spec.id, name: spec.name, kind: 'town', bgm: spec.bgm || (spec.region === 'osaka' ? 'osaka' : 'town'), region: spec.region || 'tokyo',
    start: { room: 'main', ...exit }, ekiExit: { ...exit }, station: st,
    rooms: {
      main: {
        generate, bg: '#62b35b',
        onEnter: async (g) => {
          unstick(g);
          const k = `${spec.id}_intro`;
          // the first visit: the arrival lines as toasts (never blocks a script that lands here)
          if (spec.intro && !g.flag(k)) {
            g.setFlag(k);
            const lines = [].concat(typeof spec.intro === 'function' ? spec.intro(g) : spec.intro).filter(Boolean);
            lines.slice(0, 3).forEach((t, i) => g.notify(t, { color: i ? '#ffffff' : '#ffd23f', life: 260 + i * 60 }));
          }
        },
      },
    },
  };
  registerPlace(place);
  if (spec.guide && !GUIDE[spec.id]) {
    GUIDE[spec.id] = { town: spec.region === 'osaka' ? 'namba' : 'tokyo', ...spec.guide };
    const after = spec.region === 'osaka' ? GUIDE_ORDER.indexOf('jikka') : GUIDE_ORDER.indexOf('tvtokyo');
    if (!GUIDE_ORDER.includes(spec.id)) GUIDE_ORDER.splice(after >= 0 ? after : GUIDE_ORDER.length, 0, spec.id);
  }
  return place;
}
// passers-by on the plaza and the sidewalks (spec.crowd: how many, default 4), on free tiles only
const CROWD_LOOKS = ['fan', 'salaryman', 'mom', 'kid', 'oldman', 'oldwoman', 'tourist', 'clerk', 'actress', 'comedian2'];
const TOPS = ['#ff9a3c', '#5fd7ff', '#ff7eb6', '#7ae07a', '#c08aff', '#ffd23f', '#6a7a8a', '#3a7ac0', '#a8743a'];
const CROWD_LINES = {
  tokyo: [
    () => ['駅前は、待ち合わせの人でいっぱいだね。'],
    (g) => [yearOf(g) < 1996 ? 'ポケベルが鳴った！　公衆電話をさがさなきゃ。' : yearOf(g) < 2009 ? 'ケータイの電波、ここだと入りにくいんだよね。' : 'スマホの地図がないと、もう東京は歩けないよ。'],
    () => ['電車、遅れてないといいけど…。'],
    () => ['あの人、テレビで見たことあるかも…。気のせいか。'],
    (g) => [yearOf(g) < 2001 ? 'きっぷを買う列が長くて、乗りおくれそう。' : 'ICカードの残高、足りるかな。'],
    () => ['東京って、駅ごとに街の顔がちがうよね。'],
  ],
  osaka: [
    () => ['ここ来たら、とりあえず何か食べなあかんで。'],
    () => ['きょうも人多いなあ。どこも行列や。'],
    () => ['エスカレーターは右に立つんが、大阪やで。'],
    (g) => [yearOf(g) < 2003 ? 'きっぷ買うのに、小銭が足らへん…。' : 'ICOCA、チャージしとかな。'],
    () => ['なんばまでは、地下鉄ですぐやで。'],
  ],
};
function crowd(spec, c, ents, exit) {
  const n = spec.crowd ?? 4;
  if (!n) return [];
  const W = c[0].length, H = c.length;
  const busy = new Set();
  const mark = (x, y) => busy.add(`${x},${y}`);
  for (const e of ents) {
    const w = Math.ceil(e.w || 1), h = Math.ceil(e.h || 1);
    for (let y = Math.floor(e.y); y < Math.floor(e.y) + h + (e.type === 'building' ? 1 : 0); y++) for (let x = Math.floor(e.x) - 1; x <= Math.floor(e.x) + w; x++) mark(x, y);
  }
  for (let y = exit.y - 1; y <= exit.y + 2; y++) for (let x = exit.x - 1; x <= exit.x + 1; x++) mark(x, y);
  const free = (x, y) => {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || busy.has(`${x},${y}`)) return false;
    const cell = c[y][x];
    return cell.length === 1 && ['ekimae_paving', 'sidewalk', 'stone', 'brick', 'path'].includes(cell[0]);
  };
  const out = [];
  let k = spec.id.length * 13;
  const rows = [10, 16, 20, 11, 9, 28];
  const lines = CROWD_LINES[spec.region] || CROWD_LINES.tokyo;
  for (let i = 0; i < 400 && out.length < n; i++) {
    k = (k * 1103515245 + 12345) & 0x7fffffff;
    const y = rows[(k >> 3) % rows.length], x = 2 + ((k >> 7) % (W - 4));
    if (!free(x, y)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) mark(x + dx, y + dy);
    const look = { ...LOOKS[CROWD_LOOKS[k % CROWD_LOOKS.length]], top: TOPS[(k >> 4) % TOPS.length] };
    const say = lines[(k >> 9) % lines.length];
    out.push({ type: 'npc', id: `crowd${out.length}`, x, y, dir: ['down', 'left', 'right', 'up'][(k >> 2) % 4], look, name: '通行人', wander: 2, talk: async (g, npc) => g.say(say(g), { name: npc.name, look: npc.look }) });
  }
  return out;
}
// an NPC shorthand
export const npc = (id, x, y, dir, look, name, lines, extra = {}) => ({ type: 'npc', id, x, y, dir, look, name, ...(typeof lines === 'function' ? { talk: async (g, n) => g.say(lines(g), { name: n.name, look: n.look }) } : { text: lines }), ...extra });
export { LOOKS };
