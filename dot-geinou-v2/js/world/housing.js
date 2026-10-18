// 住まい: where you live, moving, and furniture.
//
//   housing   ドット荘 (life.js; home.js) ¥8,000/週 → ドットレジデンス 'mansion' (★250)
//             → ドットタワー 'tower' (★1000). Weekly rent is charged by life.js on Monday mornings.
//   places    'fudousan' ドット不動産 (listings, 内見, moving), 'kagu' ドット家具 (showroom),
//             'mansion' / 'tower' (lobby + your apartment). Their town buildings are in machi.js;
//             leaving falls back to Tokyo when that building is missing.
//   furniture 13 pieces (registerFurniture): perks while owned (life.js furnitureEffects),
//             art + an action at home (home.js draws the slots), max housing().slots pieces.
//
// flags: housing_naiken (housing id being viewed, cleared on leaving), housing_arrived (last home
//        whose first-arrival lines were shown), housing_moves (times moved), housing_warnWeek
//        (week of the last "rent is heavy" hint), housing_offer_<id> (the agent's "you can move in"
//        message was sent), housing_delivered [furniture ids not yet seen at home],
//        mansion_viewDay / tower_viewDay (window bonus), fudousan_met / kagu_met (first talk),
//        housing_fit / housing_bathDay / housing_use_<id> (home.js).
//
// Exports for other modules: moveTo(g, id), buyFurniture(g, id), HOME_ORDER, FURNITURE_ORDER,
// MANSION_SLOTS / TOWER_SLOTS (furniture positions).

import { registerPlace, doorIndexFor } from '../engine/map.js';
import {
  defineTile, tileImageHD, R, P, outline, oval, bevel, inset, blobs, ramp, dither, shadowEllipse, line, WALL_THEMES,
} from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { makeCanvas, fmtMoney, shade, mix, mulberry32, pick, SW } from '../engine/util.js';
import { text, panel } from '../engine/draw.js';
import { registerSong } from '../engine/audio.js';
import { HOUSING, FURNITURE, PEOPLE, registerHousing, registerFurniture, onMorning } from '../engine/life.js';
import {
  lives, onceToday, openCloset, pcMenu, cook, takeBath, sleepInBed, closetProp, announceDelivery,
  drawFurniture, furnitureProps, ownedFurniture, bedPiece, fixMaxStamina, TV_TIPS, SELF_PRACTICE_TICK,
} from './home.js';
import { ITEMS, SKILL_MAX } from '../engine/state.js';

// ================================================================ housing
if (!HOUSING.dotsou) registerHousing('dotsou', { name: 'ドット荘', place: 'home', rent: 8000, sleepStress: 15, kitchen: true, bath: true, slots: 4 });
Object.assign(HOUSING.dotsou, {
  room: 'room', moveCost: 3000, short: 'ドット荘',
  plan: '1K・木造アパート2階',
  perks: ['寝るとストレス -15', 'ユニットバス（シャワー）', 'キッチン', '家具は4つまで', 'やさしい大家さん'],
});
registerHousing('mansion', {
  name: 'ドットレジデンス', short: 'レジデンス', place: 'mansion', room: 'apartment', plan: '1LDK・7階',
  rent: 30000, moveCost: 60000, requires: { fame: 250 }, sleepStress: 22, kitchen: true, bath: true, slots: 6,
  bathStress: 6,
  desc: '商店街のそばの、明るい1LDKマンション。\n湯船につかれるお風呂と、広いキッチンつき。',
  perks: ['寝るとストレス -22', 'お風呂（1日1回ストレス -6）', 'システムキッチン', '家具は6つまで', 'オートロック・管理人さん'],
});
registerHousing('tower', {
  name: 'ドットタワー', short: 'タワー', place: 'tower', room: 'apartment', plan: '2LDK・52階',
  rent: 90000, moveCost: 250000, requires: { fame: 1000 }, sleepStress: 30, kitchen: true, bath: true, slots: 8,
  bathStress: 10,
  desc: '街を見下ろすタワーマンションの最上階。\n夜景の見える大きな窓と、ジェットバスつき。',
  perks: ['寝るとストレス -30', 'ジェットバス（1日1回ストレス -10）', '夜景を一望できる大きな窓', '家具は8つまで', 'コンシェルジュ（食事・ギフト）'],
});
export const HOME_ORDER = ['dotsou', 'mansion', 'tower'];
const reqFame = (h) => (h.requires && h.requires.fame) || 0;
// What moving there costs right now (ドット荘 is free when you cannot afford it: never trapped).
const moveCostFor = (g, id) => (id === 'dotsou' && g.state.money < HOUSING.dotsou.moveCost ? 0 : HOUSING[id].moveCost || 0);

// ================================================================ furniture
// Every piece stands on a 2x1 tile footprint (beds: over the home's bed). Art is native
// 2x: 64 px wide, artH px tall, the bottom 32 px are the footprint (see home.js).
const half = (n) => Math.floor(n / 2 / 100) * 100; // sell-back price

function legs(c, xs, y, col = '#3b2a20', w = 3, h = 2) { for (const x of xs) R(c, x, y, w, h, col); }

function paintPlantSet(c) {
  shadowEllipse(c, 18, 61, 12, 2); shadowEllipse(c, 48, 61, 11, 2);
  // fiddle-leaf fig in a white pot
  R(c, 17, 30, 2, 16, '#6e4a2a'); P(c, 17, 30, '#8a5e3a');
  const leaves = [[18, 8, 7, 10], [9, 16, 7, 9], [26, 15, 7, 9], [12, 27, 7, 8], [24, 27, 7, 8], [18, 20, 6, 8]];
  for (const [x, y, w, h] of leaves) {
    oval(c, x - w / 2 - 0.5, y - h / 2, w + 1, h, '#2f6b34');
    oval(c, x - w / 2, y - h / 2 + 1, w, h - 2, '#4a9a4a');
    oval(c, x - w / 2 + 1, y - h / 2 + 1, w / 2, h / 2, '#6bbb62');
    R(c, x, y - h / 2 + 2, 1, h - 4, '#3d8a44');
  }
  bevel(c, 9, 44, 18, 16, '#f0ede6', '#ffffff', '#cfcac0'); R(c, 8, 43, 20, 3, '#ffffff'); R(c, 8, 45, 20, 1, '#dcd7cc');
  R(c, 11, 47, 2, 10, '#ffffff');
  // pothos on a little wooden stand
  bevel(c, 38, 42, 20, 3, '#c48a52', '#d6a06a', '#8a5a33');
  R(c, 39, 45, 2, 16, '#8a5a33'); R(c, 55, 45, 2, 16, '#8a5a33'); R(c, 39, 54, 18, 2, '#a87449');
  bevel(c, 42, 33, 12, 9, '#d8735a', '#e8907a', '#b05a44'); R(c, 41, 32, 14, 2, '#e8907a');
  blobs(c, [[48, 30, 6], [43, 28, 4], [53, 29, 4]], ramp('#4fa04a'));
  for (const [x0, len] of [[42, 14], [54, 18], [47, 9]]) {
    for (let k = 0; k < len; k++) { const x = x0 + Math.round(Math.sin(k / 3) * 1.5); P(c, x, 34 + k, '#3d8a44'); if (k % 4 === 2) { R(c, x - 1, 34 + k, 3, 2, '#5aa954'); P(c, x - 1, 34 + k, '#74c26a'); } }
  }
  outline(c);
}

function paintYogaMat(c) {
  shadowEllipse(c, 30, 29, 29, 2);
  const m = '#4fbfae';
  // the mat, seen from above, with its thickness at the front
  R(c, 2, 14, 44, 13, m); R(c, 2, 14, 44, 1, shade(m, 0.35)); R(c, 2, 27, 44, 2, shade(m, -0.35));
  for (let y = 17; y < 26; y += 3) for (let x = 5 + (y % 2) * 2; x < 44; x += 5) P(c, x, y, shade(m, 0.18));
  // the rolled end
  R(c, 43, 11, 12, 18, shade(m, -0.12)); R(c, 43, 11, 3, 18, shade(m, 0.15)); R(c, 52, 11, 3, 18, shade(m, -0.3));
  oval(c, 43, 7, 12, 8, shade(m, -0.2)); oval(c, 44, 8, 10, 6, m); oval(c, 46, 9, 6, 4, shade(m, -0.25)); P(c, 48, 10, shade(m, 0.3));
  // a towel and two dumbbells
  R(c, 8, 16, 12, 6, '#ffffff'); R(c, 8, 21, 12, 1, '#d5d9e0'); R(c, 8, 18, 12, 1, '#ff9ab8');
  for (const x of [57, 61]) { R(c, x, 19, 3, 2, '#3b3f48'); R(c, x + 1, 21, 1, 5, '#9aa0aa'); R(c, x, 26, 3, 2, '#3b3f48'); P(c, x, 19, '#5a5f6b'); }
  outline(c);
}

function paintBookshelf(c) {
  c.translate(0, -8);
  shadowEllipse(c, 32, 70, 28, 2);
  const wd = '#8a5a33';
  bevel(c, 4, 10, 56, 58, wd, '#a87449', '#5a3a20');
  R(c, 4, 10, 56, 3, '#b98552');
  const r = mulberry32(77);
  const cols = ['#d64161', '#3f6fd0', '#2f9a4a', '#ffd23f', '#9273bd', '#ff8a3d', '#f4f1ea', '#5fd7ff', '#3b3f48'];
  for (const [y0, h] of [[14, 11], [28, 11], [42, 9]]) {
    R(c, 7, y0, 50, h + 2, '#3e2814');
    let x = 8;
    while (x < 55) {
      const w = 2 + Math.floor(r() * 3), bh = h - Math.floor(r() * 4);
      if (r() < 0.12 && x < 48) { // a little ornament instead of a book
        if (y0 === 14) { bevel(c, x, y0 + h - 7, 6, 7, '#e8c43a', '#fff6a8', '#a8851c'); R(c, x + 1, y0 + h - 6, 4, 4, '#5fd7ff'); }
        else { oval(c, x, y0 + h - 6, 6, 6, '#3d8a44'); R(c, x + 1, y0 + h - 2, 4, 3, '#c9b48e'); }
        x += 8; continue;
      }
      const col = cols[Math.floor(r() * cols.length)];
      R(c, x, y0 + h - bh + 1, w, bh, col); R(c, x, y0 + h - bh + 1, 1, bh, shade(col, 0.25)); R(c, x, y0 + h - bh + 3, w, 1, shade(col, -0.25));
      x += w + (r() < 0.2 ? 1 : 0);
    }
    R(c, 7, y0 + h + 1, 50, 2, '#a87449'); R(c, 7, y0 + h + 1, 50, 1, '#c48f5c');
  }
  inset(c, 8, 55, 23, 11, '#7a4e2e', '#94643c', '#5a3a20'); inset(c, 33, 55, 23, 11, '#7a4e2e', '#94643c', '#5a3a20');
  R(c, 27, 59, 2, 2, '#c9a227'); R(c, 35, 59, 2, 2, '#c9a227');
  c.setTransform(1, 0, 0, 1, 0, 0);
  outline(c);
}

function paintSofa(c) {
  shadowEllipse(c, 32, 45, 30, 2);
  const [d2, d1, b, l1, l2] = ramp('#e3a23b');
  R(c, 7, 6, 50, 22, b); R(c, 8, 5, 48, 1, l1); R(c, 7, 6, 50, 3, l1); R(c, 8, 6, 48, 1, l2);
  R(c, 31, 9, 2, 18, d1);
  bevel(c, 11, 12, 12, 11, '#f4ead6', '#fffaf0', '#d8ccb0'); R(c, 15, 15, 4, 4, '#d86e5a'); P(c, 15, 15, '#e8907a');
  bevel(c, 41, 12, 12, 11, '#f4ead6', '#fffaf0', '#d8ccb0'); R(c, 44, 15, 6, 1, '#3f8fd0'); R(c, 44, 17, 6, 1, '#3f8fd0'); R(c, 44, 19, 6, 1, '#3f8fd0');
  R(c, 8, 26, 48, 9, l1); R(c, 8, 26, 48, 1, l2); R(c, 31, 27, 2, 8, b); R(c, 9, 33, 46, 2, b);
  R(c, 8, 35, 48, 6, d1); R(c, 8, 40, 48, 1, d2);
  for (const x of [1, 54]) {
    R(c, x, 18, 9, 23, b); R(c, x + 1, 17, 7, 1, l1); R(c, x, 18, 9, 3, l1); R(c, x + 1, 18, 7, 1, l2);
    R(c, x, 35, 9, 6, d1); R(c, x + 8, 21, 1, 14, d1);
  }
  legs(c, [4, 57], 41, '#5a3a20');
  outline(c);
}

function paintDresser(c) {
  shadowEllipse(c, 36, 61, 26, 2); shadowEllipse(c, 8, 61, 7, 1);
  // arched mirror on the wall
  oval(c, 20, 0, 28, 14, '#c9a227'); R(c, 20, 7, 28, 26, '#c9a227');
  oval(c, 22, 2, 24, 12, '#f4f0e8'); R(c, 22, 8, 24, 24, '#f4f0e8');
  oval(c, 24, 4, 20, 10, '#bfe3f2'); R(c, 24, 9, 20, 22, '#bfe3f2'); R(c, 24, 26, 20, 5, '#a8d4ea');
  for (let k = 0; k < 7; k++) { P(c, 27 + k, 16 - k, '#ffffff'); P(c, 28 + k, 16 - k, '#e8f6fc'); }
  for (let k = 0; k < 4; k++) P(c, 36 + k, 25 - k, '#ffffff');
  // table
  R(c, 13, 33, 50, 5, '#fbf8f2'); R(c, 13, 33, 50, 1, '#ffffff'); R(c, 13, 37, 50, 1, '#d8d2c6');
  bevel(c, 14, 38, 48, 16, '#f4f0e8', '#ffffff', '#cfc8ba');
  inset(c, 16, 40, 21, 6, '#ece6da'); inset(c, 39, 40, 21, 6, '#ece6da'); inset(c, 16, 47, 44, 6, '#ece6da');
  R(c, 25, 42, 4, 1, '#c9a227'); R(c, 48, 42, 4, 1, '#c9a227'); R(c, 36, 49, 4, 1, '#c9a227');
  legs(c, [15, 58], 54, '#cfc8ba', 3, 6);
  // bottles, brushes, a jewel box
  R(c, 16, 28, 4, 5, '#ff7eb6'); R(c, 17, 26, 2, 2, '#e8c43a'); P(c, 16, 28, '#ffc0dc');
  R(c, 22, 29, 3, 4, '#9273bd'); P(c, 23, 28, '#e8c43a');
  bevel(c, 50, 28, 9, 5, '#d64161', '#ff7eb6', '#a8304a'); R(c, 50, 30, 9, 1, '#e8c43a');
  R(c, 43, 27, 4, 6, '#f4f1ea'); R(c, 43, 24, 1, 3, '#8a5a33'); R(c, 45, 23, 1, 4, '#3b3f48'); P(c, 45, 23, '#ff7eb6');
  // stool
  oval(c, 1, 44, 14, 6, '#ff9ab8'); oval(c, 2, 44, 12, 4, '#ffc0d4'); R(c, 2, 47, 12, 2, '#e07a9a');
  R(c, 3, 49, 2, 11, '#f4f0e8'); R(c, 11, 49, 2, 11, '#f4f0e8');
  outline(c);
}

function paintKotatsu(c) {
  shadowEllipse(c, 32, 37, 31, 2);
  const f = '#d8573f';
  R(c, 2, 16, 60, 20, f); R(c, 1, 18, 62, 16, f);
  R(c, 2, 16, 60, 2, shade(f, 0.25)); R(c, 1, 32, 62, 3, shade(f, -0.25));
  for (let y = 20; y < 32; y += 4) for (let x = 4 + ((y / 4) % 2) * 4; x < 60; x += 8) { P(c, x, y, '#f4a07a'); P(c, x + 1, y, '#f4a07a'); }
  for (const x of [12, 32, 52]) R(c, x, 18, 1, 15, shade(f, -0.12));
  // table top
  R(c, 5, 8, 54, 9, '#8a5a33'); R(c, 5, 8, 54, 6, '#c48a52'); R(c, 5, 8, 54, 1, '#e0a870'); R(c, 5, 14, 54, 3, '#6e4428');
  // mandarins in a basket, a cup of tea
  oval(c, 15, 6, 18, 6, '#b98552'); oval(c, 16, 7, 16, 4, '#8a5a33');
  for (const [x, y] of [[17, 2], [22, 1], [27, 3], [20, 4]]) { oval(c, x, y, 6, 6, '#c8701a'); oval(c, x, y, 5, 5, '#f4a640'); P(c, x + 1, y + 1, '#ffd08a'); P(c, x + 3, y, '#5e9a3a'); }
  R(c, 42, 6, 6, 6, '#f4f1ea'); R(c, 42, 6, 6, 1, '#ffffff'); R(c, 43, 7, 4, 1, '#7aa040'); R(c, 48, 8, 2, 2, '#f4f1ea');
  outline(c);
}

function paintAquarium(c) {
  shadowEllipse(c, 32, 61, 30, 2);
  bevel(c, 3, 40, 58, 21, '#3b2a20', '#5a3a20', '#22180f'); R(c, 3, 40, 58, 2, '#6e4428');
  inset(c, 6, 44, 24, 14, '#2e2018', '#4a3020', '#1a120c'); inset(c, 34, 44, 24, 14, '#2e2018', '#4a3020', '#1a120c');
  R(c, 27, 50, 1, 3, '#c9a227'); R(c, 36, 50, 1, 3, '#c9a227');
  R(c, 4, 4, 56, 5, '#2a2d36'); R(c, 4, 4, 56, 1, '#4a4e58'); R(c, 8, 8, 48, 1, '#fff6a8');
  R(c, 4, 9, 56, 31, '#20232a');
  R(c, 6, 10, 52, 29, '#3a8fd0');
  R(c, 6, 10, 52, 3, '#7fc4f0'); dither(c, 6, 13, 52, 2, '#5aa8e4');
  dither(c, 6, 28, 52, 4, '#327cbc', 1);
  R(c, 6, 33, 52, 6, '#e6d194'); R(c, 6, 33, 52, 1, '#f5e6b8');
  for (const [x, y] of [[10, 35], [19, 36], [33, 35], [45, 36], [52, 34]]) { R(c, x, y, 2, 1, '#bfa86e'); P(c, x, y - 1, '#fff3d0'); }
  oval(c, 22, 27, 12, 8, '#8d939e'); oval(c, 23, 27, 8, 5, '#b8bec8'); oval(c, 38, 30, 7, 5, '#7d8391');
  for (const [x, h, col] of [[9, 18, '#3d8a44'], [11, 13, '#4fa04a'], [13, 20, '#3d8a44'], [48, 15, '#4fa04a'], [50, 21, '#3d8a44'], [53, 12, '#74c26a']]) {
    for (let k = 0; k < h; k++) P(c, x + (Math.floor(k / 4) % 2), 33 - k, col);
  }
  line(c, 28, 26, 40, 22, '#6e4428'); line(c, 28, 27, 40, 23, '#8a5a33');
  for (let k = 0; k < 8; k++) P(c, 8 + k, 22 - k, 'rgba(255,255,255,0.35)');
  outline(c);
}
function animAquarium(ctx, x, y, g) {
  const t = g.frame;
  const fish = [[0, 16, '#ff8a3d', 0.35], [1.7, 21, '#5fd7ff', 0.5], [3.1, 13.5, '#ffd23f', 0.28]];
  for (const [ph, fy, col, sp] of fish) {
    const u = (Math.sin(t * sp * 0.03 + ph) + 1) / 2;
    const fx = x + 5 + u * 20;
    const dir = Math.cos(t * sp * 0.03 + ph) > 0 ? 1 : -1;
    R(ctx, fx, y + fy / 2 + 0.5 * Math.sin(t / 20 + ph), 2.5, 1, col);
    R(ctx, dir > 0 ? fx - 1 : fx + 2.5, y + fy / 2 + 0.5 * Math.sin(t / 20 + ph), 1, 1, shade(col, -0.2));
    R(ctx, dir > 0 ? fx + 2 : fx, y + fy / 2 + 0.5 * Math.sin(t / 20 + ph), 0.5, 0.5, '#20232a');
  }
  for (let i = 0; i < 3; i++) {
    const k = ((t / 2 + i * 22) % 60) / 60;
    R(ctx, x + 26 + Math.sin(t / 10 + i) * 0.5, y + 16 - k * 10, 0.5, 0.5, '#e0f4ff');
  }
}

function paintTv(c) {
  shadowEllipse(c, 32, 57, 30, 2);
  bevel(c, 2, 40, 60, 16, '#5c3a22', '#7a5032', '#3e2614'); R(c, 2, 40, 60, 2, '#8a5e3a');
  for (const x of [6, 24, 42]) inset(c, x, 45, 16, 8, '#6e4428', '#84593a', '#4a2e18');
  for (const x of [12, 30, 48]) R(c, x, 48, 4, 1, '#c9a227');
  R(c, 28, 35, 8, 5, '#2a2d36');
  R(c, 3, 3, 58, 33, '#16181e'); R(c, 3, 3, 58, 1, '#3b3f48'); R(c, 3, 35, 58, 1, '#0c0d12');
  R(c, 5, 5, 54, 28, '#0f2a3a');
  R(c, 14, 37, 36, 3, '#2a2d36'); R(c, 14, 37, 36, 1, '#4a4e58'); for (let x = 16; x < 48; x += 2) P(c, x, 38, '#3b3f48');
  R(c, 6, 46, 1, 1, '#5ee07a');
  outline(c);
}
function animTv(ctx, x, y, g) {
  const f = Math.floor(g.frame / 70) % 3;
  const X = x + 2.5, Y = y + 2.5, W = 27, H = 14;
  if (f === 0) { R(ctx, X, Y, W, H, '#5fd7ff'); R(ctx, X, Y + 9, W, 5, '#5ee07a'); R(ctx, X + 19, Y + 1.5, 3.5, 3.5, '#ffd23f'); R(ctx, X + 3, Y + 7, 7, 3, '#3d8a44'); R(ctx, X + 1, Y + 1, 5, 0.5, '#c8f0ff'); }
  else if (f === 1) { R(ctx, X, Y, W, H, '#2a1f30'); R(ctx, X + 9, Y, 9, H, '#4a3a50'); R(ctx, X + 11, Y + 5.5, 4.5, 6, '#ff7eb6'); R(ctx, X + 11.5, Y + 2.5, 3.5, 3, '#f6c9a0'); R(ctx, X, Y + 11.5, W, 2.5, '#b8343c'); }
  else { R(ctx, X, Y, W, H, '#ffd23f'); for (const [a, b] of [[4, 3], [9, 9], [16, 4], [22, 10], [19, 1.5]]) { R(ctx, X + a - 1, Y + b, 2.5, 0.5, '#ffffff'); R(ctx, X + a, Y + b - 1, 0.5, 2.5, '#ffffff'); } R(ctx, X + 7, Y + 6, 13, 3, '#d64161'); }
  R(ctx, X, Y, W, 0.5, 'rgba(255,255,255,0.25)');
}

function paintTreadmill(c) {
  shadowEllipse(c, 30, 49, 28, 2);
  // deck and belt
  R(c, 3, 38, 50, 8, '#3b3f48'); R(c, 3, 38, 50, 1, '#5a5f6b'); R(c, 3, 45, 50, 1, '#22252c');
  R(c, 5, 35, 46, 4, '#22252c'); R(c, 5, 35, 46, 1, '#4a4e58');
  for (let x = 8; x < 50; x += 6) P(c, x, 37, '#3b3f48');
  oval(c, 1, 35, 7, 10, '#5a5f6b'); oval(c, 2, 36, 4, 6, '#8d939e');
  // motor cover with a stripe
  R(c, 47, 32, 12, 14, '#c8ccd4'); R(c, 47, 32, 12, 1, '#e4e6ea'); R(c, 47, 38, 12, 2, '#d64161'); R(c, 58, 33, 1, 13, '#9aa0aa');
  // upright, console, handrail
  R(c, 51, 10, 4, 23, '#9aa0aa'); R(c, 51, 10, 1, 23, '#c8ccd4');
  bevel(c, 40, 4, 22, 10, '#2a2d36', '#4a4e58', '#16181e');
  R(c, 43, 6, 12, 5, '#5fd7ff'); R(c, 43, 6, 12, 1, '#a8ecff'); R(c, 45, 8, 6, 1, '#1f6a8a');
  P(c, 57, 7, '#5ee07a'); P(c, 57, 10, '#ff5d6c');
  R(c, 34, 17, 18, 2, '#c8ccd4'); R(c, 34, 17, 18, 1, '#e4e6ea'); R(c, 33, 16, 6, 4, '#2a2d36');
  legs(c, [6, 50], 46, '#22252c', 4, 2);
  outline(c);
}

function paintBooth(c) {
  shadowEllipse(c, 32, 62, 30, 2);
  const p = '#c8ccd4';
  R(c, 4, 0, 56, 8, '#e4e6ea'); R(c, 4, 0, 56, 1, '#f4f6f8'); R(c, 4, 7, 56, 1, '#b8bcc6');
  R(c, 4, 8, 56, 52, p);
  for (let x = 18; x < 60; x += 14) { R(c, x, 8, 1, 49, shade(p, -0.15)); R(c, x + 1, 8, 1, 49, shade(p, 0.12)); }
  R(c, 4, 8, 2, 52, shade(p, 0.15)); R(c, 58, 8, 2, 52, shade(p, -0.18));
  R(c, 4, 57, 56, 4, '#8d939e'); R(c, 4, 57, 56, 1, '#a3a9b3');
  // door with a little window (foam and a mic inside)
  bevel(c, 9, 12, 24, 45, '#d8dbe0', '#eef0f4', '#a3a9b3');
  R(c, 13, 16, 16, 15, '#2a3040'); dither(c, 13, 16, 16, 15, '#3a4258');
  R(c, 20, 19, 3, 4, '#9aa0aa'); R(c, 20, 19, 3, 1, '#c8ccd4'); R(c, 21, 23, 1, 8, '#6d7380'); R(c, 19, 23, 5, 1, '#6d7380');
  R(c, 13, 16, 16, 1, '#1a1e2a'); P(c, 14, 17, '#5a6378');
  R(c, 28, 36, 2, 7, '#e4e6ea'); R(c, 28, 36, 1, 7, '#ffffff'); P(c, 29, 42, '#6d7380');
  // REC lamp box and a vent
  R(c, 39, 13, 15, 7, '#2a2d36'); R(c, 39, 13, 15, 1, '#4a4e58');
  for (let y = 44; y < 54; y += 3) R(c, 40, y, 14, 1, '#9aa0aa');
  outline(c);
}
const REC = ['###.###.###', '#.#.#...#..', '##..##..#..', '#.#.#...#..', '#.#.###.###'];
function animBooth(ctx, x, y, g) {
  const on = Math.floor(g.frame / 40) % 2 === 0;
  const col = on ? '#ff5d6c' : '#6a2a30';
  R(ctx, x + 20.5, y + 8, 1.5, 1.5, col);
  REC.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') R(ctx, x + 22.5 + i * 0.5, y + 7.5 + j * 0.5, 0.5, 0.5, col); });
}

function paintMassage(c) {
  shadowEllipse(c, 26, 53, 24, 2); shadowEllipse(c, 54, 53, 8, 1);
  const lt = '#6b4a3a', cr = '#efe2c8';
  oval(c, 9, 2, 30, 14, lt); R(c, 9, 9, 30, 25, lt);
  oval(c, 13, 5, 22, 10, cr); R(c, 13, 10, 22, 22, cr);
  R(c, 16, 6, 16, 7, '#fff6e6'); R(c, 16, 12, 16, 1, '#d8c8a8');
  for (let y = 16; y < 31; y += 5) R(c, 14, y, 20, 1, '#d8c8a8');
  R(c, 23, 14, 2, 17, '#e0d0b0');
  for (const x of [3, 34]) { R(c, x, 22, 11, 22, lt); R(c, x, 22, 11, 3, shade(lt, 0.2)); R(c, x + 1, 21, 9, 1, shade(lt, 0.3)); R(c, x, 40, 11, 4, shade(lt, -0.25)); }
  R(c, 37, 25, 5, 2, '#2a2d36'); P(c, 38, 25, '#5ee07a'); P(c, 40, 25, '#5fd7ff');
  R(c, 13, 31, 22, 8, cr); R(c, 13, 31, 22, 1, '#fff6e6'); R(c, 13, 38, 22, 1, '#d8c8a8');
  R(c, 13, 39, 22, 13, lt); R(c, 15, 41, 18, 9, shade(cr, -0.05)); R(c, 15, 41, 18, 1, '#fff6e6');
  // side table and lamp
  bevel(c, 47, 32, 14, 3, '#c48a52', '#d6a06a', '#8a5a33'); R(c, 49, 35, 2, 17, '#8a5a33'); R(c, 57, 35, 2, 17, '#8a5a33'); R(c, 49, 46, 10, 2, '#a87449');
  R(c, 53, 22, 2, 10, '#c9a227');
  R(c, 48, 12, 12, 10, '#fff0c8'); R(c, 47, 20, 14, 2, '#f0dca8'); R(c, 49, 11, 10, 1, '#fff6e0'); R(c, 48, 13, 2, 7, '#fffaf0');
  outline(c);
}

// Beds: (32 * w) x 76 px over a w x 2 tile bed (the top 12 px rise over the wall).
function bedFrame(c, w, frame, frameHi, frameLo) {
  const W = w * 32;
  R(c, 1, 64, W - 2, 10, frame); R(c, 1, 64, W - 2, 2, frameHi); R(c, 1, 72, W - 2, 2, frameLo);
  R(c, 2, 74, 3, 2, frameLo); R(c, W - 5, 74, 3, 2, frameLo);
}
function pillow(c, x, y, w, h, col = '#ffffff') {
  R(c, x + 1, y, w - 2, h, col); R(c, x, y + 1, w, h - 2, col);
  R(c, x + 1, y + h - 2, w - 2, 1, shade(col, -0.12)); R(c, x + 2, y + 1, w - 4, 1, shade(col, 0.5));
}
function paintBedGood(c, w) {
  const W = w * 32;
  shadowEllipse(c, W / 2, 74, W / 2 - 1, 2);
  // rounded wooden headboard
  oval(c, 1, 0, W - 2, 16, '#c48a52'); R(c, 1, 8, W - 2, 12, '#c48a52');
  oval(c, 3, 2, W - 6, 13, '#d6a06a'); R(c, 3, 9, W - 6, 9, '#d6a06a'); R(c, 6, 4, W - 12, 1, '#e8bc84');
  R(c, 1, 19, W - 2, 2, '#8a5a33');
  // mattress + pillows
  R(c, 2, 20, W - 4, 48, '#f6f6f8');
  if (w === 1) pillow(c, 5, 22, 22, 12); else { pillow(c, 5, 22, 25, 12); pillow(c, 34, 22, 25, 12); }
  // puffy quilted duvet
  const q = '#f4a6b8';
  R(c, 2, 36, W - 4, 32, q); R(c, 1, 38, W - 2, 28, q);
  R(c, 2, 36, W - 4, 3, '#ffd0dc'); R(c, 2, 39, W - 4, 1, '#ffe4ea');
  for (let y = 46; y < 66; y += 9) R(c, 2, y, W - 4, 1, shade(q, -0.15));
  for (let x = 2 + 8; x < W - 4; x += 10) for (let y = 40; y < 66; y += 9) { P(c, x, y + 2, shade(q, -0.15)); P(c, x + 1, y + 3, '#ffd0dc'); }
  R(c, 1, 64, W - 2, 3, shade(q, -0.28));
  bedFrame(c, w, '#c48a52', '#d6a06a', '#8a5a33');
  outline(c);
}
function paintBedKing(c, w) {
  const W = w * 32;
  shadowEllipse(c, W / 2, 74, W / 2 - 1, 2);
  // tufted headboard
  R(c, 0, 0, W, 21, '#3a2418'); R(c, 2, 2, W - 4, 17, '#2f3d6e'); R(c, 2, 2, W - 4, 2, '#4a5a90');
  for (let y = 6; y < 18; y += 5) for (let x = 5 + (y % 2) * 3; x < W - 4; x += 7) { P(c, x, y, '#1e2850'); P(c, x + 1, y + 1, '#4a5a90'); }
  R(c, 0, 0, W, 1, '#5a3a24');
  // linens
  R(c, 1, 20, W - 2, 48, '#fbfbfd');
  if (w === 1) { pillow(c, 4, 22, 24, 10, '#ffffff'); pillow(c, 6, 28, 20, 8, '#c9a24a'); }
  else { pillow(c, 4, 21, 27, 11); pillow(c, 33, 21, 27, 11); pillow(c, 9, 28, 20, 8, '#c9a24a'); pillow(c, 35, 28, 20, 8, '#c9a24a'); }
  R(c, 1, 38, W - 2, 30, '#eef0f6'); R(c, 1, 38, W - 2, 2, '#ffffff'); R(c, 1, 40, W - 2, 1, '#d8dce8');
  // gold throw at the foot
  R(c, 1, 52, W - 2, 12, '#c9a24a'); R(c, 1, 52, W - 2, 2, '#e8c46a'); R(c, 1, 62, W - 2, 2, '#a07c2a');
  for (let x = 4; x < W - 2; x += 4) P(c, x, 57, '#e8c46a');
  bedFrame(c, w, '#4a3020', '#6b4a32', '#2e1c12');
  outline(c);
}

// --- uses at home (once a day each unless stated)
async function dailyRelax(g, id, lines, gains = {}) {
  const today = onceToday(g, 'housing_use_' + id);
  if (today) g.relax({ stress: gains.stress, stamina: gains.stamina, clean: gains.clean });
  const what = [gains.stress && `ストレス -${gains.stress}`, gains.stamina && `体力 +${gains.stamina}`, gains.clean && `身だしなみ +${gains.clean}`].filter(Boolean).join('・');
  g.sfx(today ? 'good' : 'cursor');
  await g.say([...lines, today ? `（${what}）` : '（今日はもう十分。また明日にしよう）']);
}

const BOOTH_GAIN = 3;

const FURNITURE_LIST = [
  ['plant', {
    name: '観葉植物セット', price: 5000, stress: 1, tall: true, artH: 64, paint: paintPlantSet,
    desc: 'みずみずしい緑で、部屋の空気が明るくなる。', perk: '毎朝ストレス -1・水やりで -3',
    use: (g) => dailyRelax(g, 'plant', ['観葉植物に水をあげた。\n新しい葉っぱが、くるんと出てきている。'], { stress: 3 }),
  }],
  ['yogamat', {
    name: 'ストレッチマット', price: 8000, stamina: 2, artH: 32, paint: paintYogaMat,
    desc: 'ストレッチと筋トレのセット。体がほぐれて、体力もつく。', perk: '体力の最大値 +2（一度だけ）',
    use: (g) => dailyRelax(g, 'yogamat', ['マットの上で、じっくりストレッチ。\n体がのびて、頭もすっきりした。'], { stress: 4 }),
  }],
  ['bookshelf', {
    name: '本棚', price: 20000, tall: true, artH: 64, paint: paintBookshelf,
    desc: '話のネタになる本をずらりと並べた本棚。', perk: '1日1回 読書でトーク +1（体力 -5）',
    use: async (g) => {
      if (g.flag('housing_use_bookshelf') === g.state.day) { await g.say('本棚だ。\n今日はもうたっぷり読んだ。続きはまた明日。'); return; }
      const i = await g.ask('本棚だ。本を読む？\n（体力 -5・トーク +1・1日1回）', ['読む', 'やめておく'], { cancel: 1 });
      if (i !== 0) return;
      if (!g.useStamina(5)) { await g.say('体力が足りない…。目がしょぼしょぼする。'); return; }
      g.setFlag('housing_use_bookshelf', g.state.day);
      g.addSkill('talk', 1, true);
      g.sfx('good');
      await g.say([pick(['芸人さんのエッセイを読んだ。\n話の「つかみ」の大切さがよくわかる。', '雑学の本を読んだ。\nトークで使えそうなネタがいっぱいだ！', '昔の名司会者の本を読んだ。\n聞き上手は話し上手、か…。']), `（トーク +1：${g.state.skills.talk}）`]);
    },
  }],
  ['sofa', {
    name: 'ふかふかソファ', price: 25000, stress: 3, artH: 48, paint: paintSofa,
    desc: '体がしずみこむ、3人がけのソファ。', perk: '毎朝ストレス -3・ひと休みで -5',
    use: (g) => dailyRelax(g, 'sofa', ['ソファにどさっと座った。\nふかふか…。体がしずみこんでいく。'], { stress: 5 }),
  }],
  ['dresser', {
    name: 'ドレッサー', price: 30000, clean: 20, tall: true, artH: 64, paint: paintDresser,
    desc: '大きな鏡のついたドレッサー。身じたくも、表情の練習もはかどる。', perk: '毎朝 身だしなみ +20・鏡の前の練習で 演技 +1',
    use: async (g) => {
      // a quick brush-up any time; the expression practice (演技 +1) once a day, like the bookshelf
      g.bathe(40, true);
      if (g.flag('housing_use_dresser') === g.state.day) { await g.say('鏡の前で、髪をととのえた。\n…よし、今日もいい感じ！'); return; }
      const i = await g.ask('鏡の前で、表情の練習をする？\n（体力 -5・演技 +1・1日1回）', ['練習する', 'やめておく'], { cancel: 1 });
      if (i !== 0) { await g.say('鏡の前で、髪をととのえた。\n…よし、今日もいい感じ！'); return; }
      if (!g.useStamina(5)) { await g.say('体力が足りない…。顔がつかれている。'); return; }
      g.setFlag('housing_use_dresser', g.state.day);
      g.addSkill('engi', 1, true);
      g.sfx('good');
      await g.say([pick(['鏡の前で、喜怒哀楽の顔を順番に作ってみた。\n…表情筋が、ぴくぴくする。', '鏡に向かって、セリフを言ってみた。\n目の動きひとつで、印象が変わるんだな。', '「おどろいた顔」を研究した。\n…自分でも、ちょっとおかしい。']), `（演技 +1：${g.state.skills.engi}）`]);
    },
  }],
  ['kotatsu', {
    name: 'こたつ', price: 35000, stress: 3, artH: 40, paint: paintKotatsu,
    desc: 'みかんの似合う、ぬくぬくのこたつ。', perk: '毎朝ストレス -3・ぬくぬくで -6',
    use: (g) => dailyRelax(g, 'kotatsu', ['こたつに入って、みかんをひとつ。\n…あったかい。このまま寝てしまいそうだ。'], { stress: 6, stamina: 5 }),
  }],
  ['bed_good', {
    name: 'ふかふかベッド', price: 40000, bed: true, sleepStress: 6, artH: 76, paint: paintBedGood,
    desc: '羽毛ぶとんのふかふかベッド。いまのベッドと入れかえる。', perk: '寝るとストレス さらに -6',
    use: (g) => g.say('ふかふかのベッドだ。'),
  }],
  ['aquarium', {
    name: 'アクアリウム', price: 60000, stress: 5, tall: true, artH: 64, paint: paintAquarium, anim: animAquarium,
    desc: '熱帯魚が泳ぐ水槽。ながめているだけで癒やされる。', perk: '毎朝ストレス -5・ながめて -6',
    use: (g) => dailyRelax(g, 'aquarium', ['水槽の中を、熱帯魚がすいすい泳いでいる。\n…ぼーっと見ていると、心がしずかになる。'], { stress: 6 }),
  }],
  ['tv', {
    name: '大型テレビ', price: 80000, stress: 6, tall: true, artH: 60, paint: paintTv, anim: animTv,
    desc: '大画面のテレビ。自分の出た番組も見られる？', perk: '毎朝ストレス -6・番組を見て -8',
    use: async (g) => { await dailyRelax(g, 'tv', ['大画面のテレビをつけた。', pick(TV_TIPS)], { stress: 8 }); },
  }],
  ['treadmill', {
    name: 'ランニングマシン', price: 90000, stamina: 6, artH: 52, paint: paintTreadmill,
    desc: '家でトレーニングできる本格派。', perk: '体力の最大値 +6（一度だけ）・走って気分転換',
    use: async (g) => {
      if (g.flag('housing_use_treadmill') === g.state.day) { await g.say('ランニングマシンだ。\n今日はもう走った。足がパンパン…。'); return; }
      const i = await g.ask('ランニングマシンで走る？\n（体力 -10・ストレス -6・1日1回）', ['走る', 'やめておく'], { cancel: 1 });
      if (i !== 0) return;
      if (!g.useStamina(10)) { await g.say('体力が足りない…。いまは走れない。'); return; }
      g.setFlag('housing_use_treadmill', g.state.day);
      g.relax({ stress: 6 });
      g.sfx('drum');
      await g.say(['タッタッタッ…。30分しっかり走った！\n汗をかいたら、気分もすっきり。', '（体力 -10・ストレス -6）']);
    },
  }],
  ['massage', {
    name: 'マッサージチェア', price: 150000, stress: 6, artH: 56, paint: paintMassage,
    desc: 'もみ玉が全身をほぐしてくれる、高級マッサージチェア。', perk: '毎朝ストレス -6・マッサージで体力 +15',
    use: (g) => dailyRelax(g, 'massage', ['マッサージチェアに身をあずけた。\nウィーン…ぐりぐり…。あぁ、そこそこ…。'], { stress: 5, stamina: 15 }),
  }],
  ['booth', {
    name: '防音ブース', price: 180000, tall: true, artH: 64, paint: paintBooth, anim: animBooth,
    desc: '家で思いきり歌える防音室。夜でも気がねなく練習できる。', perk: '1日1回 歌の自主練で 歌 +3（体力 -10）',
    // once a day like the bookshelf and dresser (lessons and coaching stay the main way to grow)
    use: async (g) => {
      if (g.flag('housing_use_booth') === g.state.day) { await g.say('防音ブースだ。\n今日はもうたっぷり歌った。のどを休めよう。'); return; }
      if (g.state.skills.uta >= SKILL_MAX) { await g.say('防音ブースだ。\n歌はもう極めている！'); return; }
      const i = await g.ask(`防音ブースだ。思いきり歌の練習をする？\n（無料・体力 -10・歌 +${BOOTH_GAIN}・1日1回）`, ['練習する', 'やめておく'], { cancel: 1 });
      if (i !== 0) return;
      if (!g.useStamina(10)) { await g.say('体力が足りない…。のどを休めよう。'); return; }
      g.setFlag('housing_use_booth', g.state.day);
      g.lifeTick(SELF_PRACTICE_TICK);
      await g.fadeOut(10);
      g.sfx('success');
      await g.wait(500);
      await g.fadeIn(10);
      const before = g.state.skills.uta;
      g.addSkill('uta', BOOTH_GAIN, true);
      await g.say(`ブースの中で、思いっきり歌った！\n歌が${g.state.skills.uta - before}上がった。（${g.state.skills.uta}）`);
    },
  }],
  ['bed_king', {
    name: 'キングサイズベッド', price: 260000, bed: true, sleepStress: 12, artH: 76, paint: paintBedKing,
    desc: 'ホテルのスイートのような極上のベッド。いまのベッドと入れかえる。', perk: '寝るとストレス さらに -12',
    use: (g) => g.say('キングサイズの極上ベッドだ。'),
  }],
];
for (const [id, def] of FURNITURE_LIST) registerFurniture(id, def);
export const FURNITURE_ORDER = FURNITURE_LIST.map(([id]) => id);

// ================================================================ tiles (native 2x art)
const WHITE = WALL_THEMES.white || '#e9e5dc';
const TW = '#cdbfa6'; // tower wall (greige stone)

defineTile('housing_floor_oak', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#dcbc8c');
    for (let y = 0; y < 16; y += 4) { R(c, 0, y + 3, 16, 1, '#b08c5e'); R(c, (y * 5) % 16, y, 1, 3, '#b08c5e'); }
  },
  hd(c) {
    const tones = ['#dcbc8c', '#d5b483', '#e0c294', '#d8b888'];
    const joints = [6, 22, 14, 29];
    for (let row = 0; row < 4; row++) {
      const y = row * 8, t = tones[row];
      R(c, 0, y, 32, 8, t); R(c, 0, y, 32, 1, shade(t, 0.14)); R(c, 0, y + 7, 32, 1, '#b08c5e');
      const jx = joints[row];
      R(c, jx, y, 1, 7, '#b08c5e'); R(c, (jx + 1) % 32, y, 1, 7, shade(t, 0.12));
      R(c, (jx + 6) % 26, y + 3, 7, 1, shade(t, -0.06)); R(c, (jx + 17) % 26, y + 5, 5, 1, shade(t, -0.05));
    }
  },
});
defineTile('housing_floor_walnut', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#6b4a32');
    for (let i = 0; i < 16; i += 2) { R(c, 0, i, 8, 1, '#5c3f2a'); R(c, 8 + i / 2, 0, 1, 16, i % 4 ? '#5c3f2a' : '#6b4a32'); }
  },
  // basket-weave parquet: 16x16 blocks of four slats, alternating direction
  hd(c) {
    const tones = ['#7a5538', '#6b4a32', '#74503a', '#664630'];
    for (let by = 0; by < 2; by++) {
      for (let bx = 0; bx < 2; bx++) {
        const x0 = bx * 16, y0 = by * 16, horiz = (bx + by) % 2 === 0;
        for (let k = 0; k < 4; k++) {
          const t = tones[(k + bx + by * 2) % 4];
          if (horiz) { R(c, x0, y0 + k * 4, 16, 4, t); R(c, x0, y0 + k * 4, 16, 1, shade(t, 0.14)); R(c, x0, y0 + k * 4 + 3, 16, 1, '#4a3020'); }
          else { R(c, x0 + k * 4, y0, 4, 16, t); R(c, x0 + k * 4, y0, 1, 16, shade(t, 0.14)); R(c, x0 + k * 4 + 3, y0, 1, 16, '#4a3020'); }
        }
      }
    }
  },
});
defineTile('housing_floor_bath', {
  draw(c) { R(c, 0, 0, 16, 16, '#b8c4cc'); for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) R(c, x, y, 3, 3, (x + y) % 8 ? '#eef4f8' : '#dfeaf0'); },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#b8c4cc');
    for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) {
      const v = r();
      const col = v < 0.08 ? '#9fd0e8' : v < 0.35 ? '#dfeaf0' : '#eef4f8';
      R(c, x, y, 3, 3, col); P(c, x, y, shade(col, 0.4));
    }
  },
});
defineTile('housing_floor_genkan', {
  draw(c) { R(c, 0, 0, 16, 16, '#8d939e'); R(c, 0, 7, 16, 1, '#6d7380'); R(c, 7, 0, 1, 7, '#6d7380'); R(c, 3, 8, 1, 8, '#6d7380'); },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#6d7380');
    for (const [x, y, w, h] of [[0, 0, 15, 15], [16, 0, 16, 15], [0, 16, 7, 16], [8, 16, 24, 16]]) {
      const t = ['#8d939e', '#868c97', '#939aa5', '#8a909b'][Math.floor(r() * 4)];
      R(c, x, y, w, h, t); R(c, x, y, w, 1, shade(t, 0.2)); R(c, x, y, 1, h, shade(t, 0.12));
      P(c, x + 3 + Math.floor(r() * (w - 6)), y + 3 + Math.floor(r() * (h - 6)), shade(t, -0.12));
    }
  },
});
// Upper wall rows (no skirting) to stack above the wall face for taller rooms.
function wallHi(c, col, panels) {
  R(c, 0, 0, 32, 32, col);
  if (panels) { R(c, 15, 0, 1, 32, shade(col, -0.13)); R(c, 16, 0, 1, 32, shade(col, 0.1)); R(c, 31, 0, 1, 32, shade(col, -0.13)); R(c, 0, 0, 1, 32, shade(col, 0.1)); }
  else for (let x = 3; x < 32; x += 8) R(c, x, 0, 1, 32, shade(col, -0.035));
  R(c, 0, 0, 32, 2, shade(col, -0.12)); R(c, 0, 2, 32, 1, shade(col, -0.05));
}
defineTile('housing_wallhi_white', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, WHITE); R(c, 0, 0, 16, 1, shade(WHITE, -0.12)); },
  hd(c) { wallHi(c, WHITE, false); },
});
defineTile('housing_twall_hi', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, TW); R(c, 7, 0, 1, 16, shade(TW, -0.13)); R(c, 0, 0, 16, 1, shade(TW, -0.12)); },
  hd(c) { wallHi(c, TW, true); },
});
defineTile('housing_twall', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, TW); R(c, 7, 0, 1, 13, shade(TW, -0.13)); R(c, 0, 1, 16, 1, '#c9a227'); R(c, 0, 13, 16, 3, '#4a3020'); },
  hd(c) {
    wallHi(c, TW, true);
    R(c, 0, 0, 32, 1, shade(TW, 0.2)); R(c, 0, 2, 32, 2, '#c9a227'); R(c, 0, 2, 32, 1, '#e8c43a'); R(c, 0, 4, 32, 1, shade(TW, -0.18));
    R(c, 0, 26, 32, 6, '#4a3020'); R(c, 0, 26, 32, 1, '#6b4a32'); R(c, 0, 27, 32, 1, '#5a3a28'); R(c, 0, 31, 32, 1, '#2e1c12');
  },
});
defineTile('housing_ttop', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#3a3328'); R(c, 0, 15, 16, 1, shade(TW, -0.3)); },
  hd(c) {
    const d = shade(TW, -0.68);
    R(c, 0, 0, 32, 32, d); R(c, 0, 0, 32, 1, shade(d, 0.08)); R(c, 0, 29, 32, 1, shade(d, -0.12));
    R(c, 0, 30, 32, 1, mix(d, '#c9a227', 0.35)); R(c, 0, 31, 32, 1, mix(d, shade(TW, -0.3), 0.6));
  },
});
// White bathroom door (mansion), on a wall face.
defineTile('housing_bathdoor', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 0, 12, 16, '#b8bec8'); R(c, 3, 1, 10, 15, '#fbfbfd'); R(c, 5, 3, 3, 10, '#dfe8ee'); P(c, 10, 8, '#9aa0aa'); },
  hd(c) {
    R(c, 3, 0, 26, 32, '#9aa0aa'); R(c, 4, 0, 24, 32, '#c8ccd4'); R(c, 4, 0, 24, 1, '#e4e6ea');
    bevel(c, 6, 2, 20, 30, '#fbfbfd', '#ffffff', '#d5d9e0');
    R(c, 9, 5, 6, 23, '#cfe0ea'); dither(c, 9, 6, 6, 21, '#e6f0f6'); R(c, 9, 5, 6, 1, '#a8bcc8'); R(c, 9, 27, 6, 1, '#ffffff');
    R(c, 19, 16, 5, 2, '#9aa0aa'); R(c, 19, 16, 5, 1, '#e4e6ea'); R(c, 19, 18, 1, 2, '#7d8391');
    R(c, 18, 6, 6, 4, '#3a6fd8'); R(c, 19, 7, 4, 1, '#c8ecff'); R(c, 19, 8, 2, 1, '#c8ecff');
    R(c, 6, 31, 20, 1, '#b8bec8');
    outline(c);
  },
});
defineTile('housing_mailbox', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 2, 14, 11, '#9aa0aa'); for (let y = 3; y < 12; y += 5) for (let x = 2; x < 14; x += 4) R(c, x, y, 3, 4, '#c8ccd4'); },
  hd(c) {
    bevel(c, 2, 3, 28, 22, '#8d939e', '#b8bec8', '#6d7380');
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
      const x = 4 + i * 6.5, y = 5 + j * 10;
      bevel(c, Math.round(x), y, 6, 9, '#c8ccd4', '#e4e6ea', '#9aa0aa');
      R(c, Math.round(x) + 1, y + 2, 4, 1, '#3b3f48'); R(c, Math.round(x) + 2, y + 5, 2, 2, '#f4f1ea');
    }
    outline(c);
  },
});
defineTile('housing_kanri', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 4, 12, 8, '#9aa0aa'); R(c, 3, 5, 10, 6, '#a8dcf5'); R(c, 4, 1, 8, 2, '#ffffff'); },
  hd(c) {
    R(c, 7, 1, 18, 5, '#ffffff'); R(c, 7, 5, 18, 1, '#c8ccd4');
    for (let x = 9; x < 24; x += 3) R(c, x, 2, 2, 2, '#3b3f48');
    R(c, 3, 7, 26, 17, '#9aa0aa'); R(c, 3, 7, 26, 1, '#c8ccd4');
    R(c, 5, 9, 11, 13, '#a8dcf5'); R(c, 16, 9, 11, 13, '#a8dcf5'); R(c, 15, 8, 2, 15, '#7d8391');
    for (let k = 0; k < 5; k++) { P(c, 7 + k, 15 - k, '#e0f4ff'); P(c, 18 + k, 15 - k, '#e0f4ff'); }
    R(c, 5, 19, 22, 3, '#c8e4f2');
    R(c, 2, 24, 28, 3, '#c48a52'); R(c, 2, 24, 28, 1, '#d6a06a');
    outline(c);
  },
});
defineTile('housing_counter_dark', {
  solid: true, obj: true, talkThrough: true,
  draw(c) { R(c, 0, 1, 16, 7, '#ece8e0'); R(c, 0, 8, 16, 8, '#4a3020'); R(c, 0, 8, 16, 1, '#c9a227'); },
  hd(c) {
    R(c, 0, 2, 32, 14, '#ece8e0'); R(c, 0, 2, 32, 1, '#ffffff'); R(c, 0, 3, 32, 1, '#f6f4ee');
    line(c, 4, 6, 14, 10, '#d8d2c6'); line(c, 18, 5, 28, 12, '#d8d2c6'); P(c, 9, 12, '#d8d2c6');
    R(c, 0, 14, 32, 2, '#d0c8b8');
    R(c, 0, 16, 32, 16, '#4a3020'); R(c, 0, 16, 32, 2, '#c9a227'); R(c, 0, 16, 32, 1, '#e8c43a');
    for (let x = 3; x < 32; x += 8) R(c, x, 19, 1, 11, '#3a2418');
    R(c, 0, 30, 32, 2, '#2e1c12');
    outline(c);
  },
});
// Listings on the real-estate office wall (3 floor plans).
defineTile('housing_listing', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) { R(c, 2, 2, 12, 11, '#ffffff'); R(c, 3, 3, 10, 6, '#c8ccd4'); R(c, 9, 10, 4, 2, ['#5ee07a', '#5fd7ff', '#ffd23f'][v]); },
  hd(c, r, f, v) {
    const acc = ['#2f9a4a', '#2f6fd0', '#c9a227'][v];
    R(c, 3, 2, 26, 23, '#ffffff'); R(c, 3, 2, 26, 4, acc); R(c, 3, 24, 26, 1, '#d5d9e0');
    for (let x = 6; x < 26; x += 3) P(c, x, 3, '#ffffff');
    // floor plan
    R(c, 6, 8, 14, 12, '#3b3f48'); R(c, 7, 9, 12, 10, '#f4f1ea');
    if (v === 0) { R(c, 12, 9, 1, 10, '#3b3f48'); R(c, 13, 13, 6, 1, '#3b3f48'); }
    else if (v === 1) { R(c, 11, 9, 1, 6, '#3b3f48'); R(c, 7, 14, 12, 1, '#3b3f48'); R(c, 15, 15, 1, 4, '#3b3f48'); }
    else { R(c, 10, 9, 1, 10, '#3b3f48'); R(c, 15, 9, 1, 5, '#3b3f48'); R(c, 15, 14, 4, 1, '#3b3f48'); R(c, 7, 11, 3, 1, '#3b3f48'); }
    R(c, 8, 17, 3, 1, '#c9a227'); P(c, 17, 10, '#5fd7ff');
    // price tag
    R(c, 21, 15, 7, 6, '#d62f2f'); R(c, 22, 17, 5, 1, '#ffffff'); R(c, 22, 19, 3, 1, '#ffffff');
    R(c, 21, 9, 6, 1, '#9aa0aa'); R(c, 21, 11, 5, 1, '#9aa0aa');
    outline(c);
  },
});
// Kitchen pieces: white upper cabinets (mansion), dark kitchen with a marble top (tower).
defineTile('housing_kcab', {
  solid: true, obj: true,
  draw(c) { R(c, 0, 4, 16, 10, '#f6f6f8'); R(c, 7, 4, 1, 10, '#c3c6ce'); R(c, 0, 13, 16, 1, '#c3c6ce'); },
  hd(c) {
    R(c, 0, 8, 32, 20, '#f6f6f8'); R(c, 0, 8, 32, 1, '#ffffff'); R(c, 0, 27, 32, 1, '#c3c6ce');
    for (const x of [1, 17]) { bevel(c, x, 10, 14, 16, '#f6f6f8', '#ffffff', '#d5d9e0'); R(c, x + (x < 16 ? 11 : 1), 20, 2, 4, '#9aa0aa'); }
    R(c, 0, 28, 32, 2, 'rgba(0,0,0,0.12)');
  },
});
const MARBLE = (c, y, h) => {
  R(c, 0, y, 32, h, '#ece8e0'); R(c, 0, y, 32, 1, '#ffffff'); R(c, 0, y + h - 1, 32, 1, '#cfc8ba');
  line(c, 3, y + 2, 12, y + h - 2, '#d8d2c6'); line(c, 20, y + 1, 29, y + h - 3, '#d8d2c6');
};
function towerBase(c) {
  R(c, 0, 12, 32, 20, '#2f3446'); R(c, 0, 12, 32, 1, '#4a5068');
  R(c, 15, 13, 1, 19, '#1e2230'); R(c, 16, 13, 1, 19, '#3c4258');
  R(c, 3, 15, 10, 1, '#c8ccd4'); R(c, 19, 15, 10, 1, '#c8ccd4');
  R(c, 0, 30, 32, 2, '#16181e');
}
defineTile('housing_tk_sink', {
  solid: true, obj: true,
  draw(c) { R(c, 0, 2, 16, 6, '#ece8e0'); R(c, 4, 3, 8, 3, '#9aa0aa'); R(c, 0, 8, 16, 8, '#2f3446'); },
  hd(c) {
    towerBase(c); MARBLE(c, 2, 11);
    R(c, 7, 5, 16, 6, '#9aa0aa'); R(c, 8, 6, 14, 4, '#c8ccd4'); R(c, 8, 6, 14, 1, '#7d8391'); P(c, 15, 8, '#5a5f6b');
    R(c, 24, 1, 2, 6, '#c8ccd4'); R(c, 20, 0, 6, 2, '#c8ccd4'); R(c, 20, 2, 1, 2, '#9aa0aa');
    outline(c);
  },
});
defineTile('housing_tk_hob', {
  solid: true, obj: true,
  draw(c) { R(c, 0, 2, 16, 6, '#ece8e0'); R(c, 2, 3, 12, 4, '#16181e'); R(c, 0, 8, 16, 8, '#2f3446'); },
  hd(c) {
    towerBase(c); MARBLE(c, 2, 11);
    R(c, 4, 4, 24, 8, '#16181e'); R(c, 4, 4, 24, 1, '#3b3f48');
    for (const [x, w] of [[7, 7], [18, 7]]) { oval(c, x, 5, w, 5, '#5a2a2a'); oval(c, x + 1, 6, w - 2, 3, '#16181e'); }
    P(c, 25, 10, '#ff5d6c');
    outline(c);
  },
});
defineTile('housing_tk_fridge', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 0, 12, 16, '#c8ccd4'); R(c, 7, 0, 1, 16, '#9aa0aa'); },
  hd(c) {
    R(c, 3, 0, 26, 32, '#9aa0aa');
    bevel(c, 4, 1, 12, 30, '#d5d9e0', '#eef0f4', '#a3a9b3'); bevel(c, 16, 1, 12, 30, '#d5d9e0', '#eef0f4', '#a3a9b3');
    R(c, 14, 6, 1, 14, '#6d7380'); R(c, 17, 6, 1, 14, '#6d7380');
    R(c, 6, 4, 6, 3, '#3b3f48'); P(c, 7, 5, '#5fd7ff');
    for (let x = 5; x < 28; x += 3) P(c, x, 29, '#7d8391');
    outline(c);
  },
});
defineTile('housing_tkcab', {
  solid: true, obj: true,
  draw(c) { R(c, 0, 4, 16, 10, '#2f3446'); R(c, 3, 11, 4, 1, '#c9a227'); },
  hd(c) {
    R(c, 0, 8, 32, 20, '#2f3446'); R(c, 0, 8, 32, 1, '#4a5068'); R(c, 0, 27, 32, 1, '#16181e');
    R(c, 15, 9, 1, 18, '#1e2230'); R(c, 16, 9, 1, 18, '#3c4258');
    R(c, 4, 24, 8, 1, '#c9a227'); R(c, 20, 24, 8, 1, '#c9a227');
    R(c, 0, 28, 32, 2, 'rgba(0,0,0,0.15)');
  },
});
defineTile('housing_hood', {
  solid: true, obj: true,
  draw(c) { R(c, 6, 0, 4, 8, '#c8ccd4'); R(c, 2, 8, 12, 5, '#c8ccd4'); },
  hd(c) {
    bevel(c, 12, 0, 8, 16, '#c8ccd4', '#e4e6ea', '#9aa0aa');
    R(c, 3, 16, 26, 8, '#c8ccd4'); R(c, 5, 15, 22, 1, '#d5d9e0'); R(c, 3, 16, 26, 1, '#eef0f4'); R(c, 3, 23, 26, 1, '#7d8391');
    R(c, 6, 24, 20, 1, '#fff6a8');
    outline(c);
  },
});

// ================================================================ room props (native 2x)
const sprites = new Map();
function sprite(key, w, h, fn) {
  let cv = sprites.get(key);
  if (!cv) { let c; [cv, c] = makeCanvas(w * 2, h * 2); fn(c); sprites.set(key, cv); }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);

// Base beds of the mansion / tower (2 x 2 tiles, art 64 x 76 like the bed furniture).
function paintBedMansion(c) {
  shadowEllipse(c, 32, 74, 31, 2);
  R(c, 1, 2, 62, 19, '#c48a52'); R(c, 1, 2, 62, 2, '#e0a870'); R(c, 3, 6, 58, 12, '#d6a06a'); R(c, 3, 6, 58, 1, '#e8bc84');
  R(c, 2, 20, 60, 48, '#f6f6f8');
  pillow(c, 5, 22, 25, 12); pillow(c, 34, 22, 25, 12);
  const q = '#a8c0dc';
  R(c, 2, 36, 60, 32, q); R(c, 1, 38, 62, 28, q); R(c, 2, 36, 60, 3, '#d0e0f0'); R(c, 2, 39, 60, 1, '#e4eef8');
  R(c, 2, 56, 60, 1, shade(q, -0.15)); R(c, 1, 64, 62, 3, shade(q, -0.28));
  bedFrame(c, 2, '#c48a52', '#d6a06a', '#8a5a33');
  outline(c);
}
function paintBedTower(c) {
  shadowEllipse(c, 32, 74, 31, 2);
  R(c, 0, 0, 64, 21, '#2e1c12'); R(c, 2, 2, 60, 17, '#8a8c96'); R(c, 2, 2, 60, 2, '#a8aab4');
  for (let x = 17; x < 62; x += 15) { R(c, x, 3, 1, 15, '#6d6f78'); R(c, x + 1, 3, 1, 15, '#9a9ca6'); }
  R(c, 1, 20, 62, 48, '#fbfbfd');
  pillow(c, 4, 21, 27, 11); pillow(c, 33, 21, 27, 11); pillow(c, 10, 28, 18, 7, '#5a5f6b'); pillow(c, 36, 28, 18, 7, '#5a5f6b');
  R(c, 1, 38, 62, 30, '#eef0f6'); R(c, 1, 38, 62, 2, '#ffffff');
  R(c, 1, 54, 62, 10, '#3b3f48'); R(c, 1, 54, 62, 2, '#5a5f6b'); R(c, 1, 62, 62, 2, '#22252c');
  bedFrame(c, 2, '#4a3020', '#6b4a32', '#2e1c12');
  outline(c);
}
// A home's bed (base art, or the owned bed furniture while you live there): sleep on A.
function bedProp(housingId, x, y, paintBase, extra = {}) {
  return {
    type: 'prop', x, y, w: 2, h: 2,
    draw: (ctx, sx, sy, g) => {
      const id = lives(g, housingId) && bedPiece(g);
      if (id) drawFurniture(ctx, id, sx, sy, g, 2, 2);
      else blit(ctx, sprite('bed_' + housingId, 32, 38, paintBase), sx, sy + 32 - 38);
    },
    talk: async (g) => {
      if (!lives(g, housingId)) { await g.say('モデルルームのベッドだ。\n…ふかふか。住んだら、ぐっすり眠れそう。'); return; }
      await sleepInBed(g);
    },
    ...extra,
  };
}

// Mansion window (4 x 2 tiles, over the wall): daytime sky over the balcony.
function paintDayWindow(c) {
  const W = 128;
  R(c, 2, 2, W - 4, 58, '#f4f4f4'); R(c, 2, 2, W - 4, 1, '#ffffff');
  R(c, 6, 6, W - 12, 50, '#9fd4f5');
  dither(c, 6, 30, W - 12, 4, '#b8e2f8'); R(c, 6, 34, W - 12, 8, '#b8e2f8'); dither(c, 6, 42, W - 12, 2, '#d0ecfa', 1);
  for (const [x, y, s] of [[20, 12, 1], [70, 18, 1.3], [100, 9, 0.8]]) blobs(c, [[x, y + 3, 5 * s], [x + 6 * s, y, 6 * s], [x + 13 * s, y + 3, 5 * s]], ['#e4f2fa', '#f4faff', '#ffffff']);
  for (const [x, w, h] of [[8, 14, 12], [24, 10, 18], [36, 18, 9], [58, 12, 15], [74, 20, 11], [96, 10, 20], [108, 12, 13]]) {
    R(c, x, 44 - h, w, h, '#a8bcd0'); R(c, x, 44 - h, w, 1, '#c8d8e8');
    for (let yy = 46 - h; yy < 42; yy += 4) for (let xx = x + 2; xx < x + w - 1; xx += 3) P(c, xx, yy, '#d8e6f2');
  }
  R(c, 6, 44, W - 12, 12, '#8aa8c0');
  R(c, 6, 40, W - 12, 2, '#5a5f6b'); R(c, 6, 40, W - 12, 1, '#8d939e');
  for (let x = 8; x < W - 6; x += 5) R(c, x, 42, 1, 14, '#6d7380');
  R(c, 6, 54, W - 12, 2, '#5a5f6b');
  R(c, 63, 6, 2, 50, '#f4f4f4'); R(c, 64, 6, 1, 50, '#d8d8d8');
  // curtains
  for (const [x, dir] of [[2, 1], [W - 20, -1]]) {
    R(c, x, 2, 18, 56, '#b8cfa8');
    for (let k = 0; k < 4; k++) { R(c, x + 2 + k * 4, 2, 1, 56, '#9ab88a'); R(c, x + 4 + k * 4, 2, 1, 56, '#d0e4c0'); }
    R(c, x, 30, 18, 3, '#e8c43a');
  }
  R(c, 0, 0, W, 3, '#c8ccd4'); R(c, 0, 0, W, 1, '#e4e6ea');
  R(c, 0, 58, W, 4, '#e4e6ea'); R(c, 0, 58, W, 1, '#ffffff'); R(c, 0, 61, W, 1, '#b8bec8');
  outline(c);
}
// Tower panoramic window (w tiles x 2): the city at night.
function paintNightWindow(c, wt) {
  const W = wt * 32;
  const sky = ['#101634', '#16204a', '#1e2a5c', '#2a3468', '#3a3f78'];
  for (let i = 0; i < 5; i++) { R(c, 0, i * 9, W, 9, sky[i]); if (i) dither(c, 0, i * 9, W, 2, sky[i - 1]); }
  R(c, 0, 45, W, 19, '#3a3f78');
  const r = mulberry32(5);
  for (let i = 0; i < W / 5; i++) P(c, Math.floor(r() * W), Math.floor(r() * 28), r() < 0.3 ? '#ffffff' : '#8a96d0');
  oval(c, W - 46, 6, 12, 12, '#fff6d8'); oval(c, W - 43, 6, 10, 10, sky[0]); // crescent moon
  // skyline, far then near
  let x = 0;
  while (x < W) {
    const w = 8 + Math.floor(r() * 14), h = 14 + Math.floor(r() * 18);
    R(c, x, 56 - h, w, h + 8, '#262c5c');
    for (let yy = 58 - h; yy < 56; yy += 3) for (let xx = x + 2; xx < x + w - 1; xx += 3) if (r() < 0.35) P(c, xx, yy, '#8a86c8');
    x += w + Math.floor(r() * 3);
  }
  x = -4;
  while (x < W) {
    const w = 12 + Math.floor(r() * 18), h = 10 + Math.floor(r() * 24);
    R(c, x, 60 - h, w, h + 4, '#161a3c'); R(c, x, 60 - h, w, 1, '#2a3060');
    if (r() < 0.25) { R(c, x + Math.floor(w / 2), 54 - h, 1, 6, '#161a3c'); }
    for (let yy = 63 - h; yy < 58; yy += 3) for (let xx = x + 2; xx < x + w - 2; xx += 3) {
      const v = r();
      if (v < 0.42) P(c, xx, yy, v < 0.12 ? '#ffffff' : v < 0.3 ? '#ffe36e' : '#ffb46b');
    }
    x += w + 2 + Math.floor(r() * 4);
  }
  // highway glow at the bottom
  R(c, 0, 58, W, 6, '#0c0f24'); R(c, 0, 58, W, 1, '#3a3f78');
  // mullions + frame
  for (let mx = 0; mx <= W; mx += 64) { R(c, Math.min(W - 2, mx), 0, 2, 64, '#20232a'); R(c, Math.min(W - 2, mx), 0, 1, 64, '#4a4e58'); }
  R(c, 0, 0, W, 2, '#20232a'); R(c, 0, 62, W, 2, '#20232a');
  R(c, 0, 62, W, 1, '#c9a227');
}
function animNightWindow(ctx, x, y, g, wt) {
  const W = wt * 16, t = g.frame;
  // cars on the highway
  for (let i = 0; i < 6; i++) {
    const k = ((t * (0.25 + (i % 3) * 0.07) + i * 37) % (W + 20)) - 10;
    const xx = i % 2 ? x + k : x + W - k;
    if (xx > x + 1 && xx < x + W - 2) R(ctx, xx, y + 29.5 + (i % 2) * 0.5, 1, 0.5, i % 2 ? '#ff5d6c' : '#fff6d8');
  }
  // aviation lights + twinkles
  const r = mulberry32(9);
  for (let i = 0; i < wt; i++) {
    const ax = x + 4 + r() * (W - 8), ay = y + 8 + r() * 10;
    if ((Math.floor(t / 45) + i) % 3 === 0) R(ctx, ax, ay, 1, 1, '#ff3b3b');
    const tx = x + 2 + r() * (W - 4), ty = y + 16 + r() * 12;
    if ((Math.floor(t / 25) + i * 2) % 5 === 0) R(ctx, tx, ty, 0.5, 0.5, '#ffffff');
  }
}
function paintCurtain(c) {
  R(c, 0, 0, 16, 64, '#8a7a9a');
  for (let k = 0; k < 4; k++) { R(c, 1 + k * 4, 0, 1, 64, '#6d5f7d'); R(c, 3 + k * 4, 0, 1, 64, '#a898b8'); }
  R(c, 0, 0, 16, 2, '#c9a227'); R(c, 0, 34, 16, 3, '#c9a227'); R(c, 0, 34, 16, 1, '#e8c43a');
  outline(c);
}

// Tower jet bath (2 x 1 tiles).
function paintJacuzzi(c) {
  R(c, 0, 4, 64, 36, '#ece8e0'); R(c, 0, 4, 64, 1, '#ffffff'); R(c, 0, 30, 64, 10, '#d8d2c6'); R(c, 0, 30, 64, 1, '#cfc8ba');
  line(c, 4, 8, 14, 28, '#d8d2c6'); line(c, 50, 6, 60, 26, '#d8d2c6');
  oval(c, 5, 7, 54, 22, '#ffffff'); oval(c, 7, 9, 50, 18, '#7fc4f0'); oval(c, 9, 10, 46, 14, '#9fd8f8');
  for (const [x, y] of [[14, 14], [26, 18], [40, 13], [48, 19]]) { P(c, x, y, '#e0f4ff'); P(c, x + 1, y, '#ffffff'); }
  R(c, 44, 0, 14, 5, '#ffffff'); R(c, 44, 4, 14, 1, '#d5d9e0'); R(c, 44, 0, 14, 1, '#ff9ab8');
  R(c, 3, 9, 3, 3, '#c8ccd4');
  outline(c);
}
function animJacuzzi(ctx, x, y, g) {
  for (let i = 0; i < 6; i++) {
    const k = ((g.frame / 3 + i * 13) % 30) / 30;
    R(ctx, x + 7 + i * 3.5 + Math.sin(g.frame / 9 + i) * 0.5, y + 10 - k * 3, 0.5, 0.5, '#ffffff');
  }
}
// Tower kitchen island (2 x 1).
function paintIsland(c) {
  shadowEllipse(c, 32, 41, 30, 2);
  R(c, 1, 10, 62, 12, '#ece8e0'); R(c, 1, 10, 62, 1, '#ffffff'); R(c, 1, 21, 62, 1, '#cfc8ba');
  line(c, 8, 12, 20, 20, '#d8d2c6'); line(c, 40, 11, 52, 19, '#d8d2c6');
  R(c, 3, 22, 58, 16, '#2f3446'); R(c, 3, 22, 58, 1, '#4a5068');
  for (const x of [18, 32, 46]) { R(c, x, 23, 1, 15, '#1e2230'); R(c, x + 1, 23, 1, 15, '#3c4258'); }
  oval(c, 10, 5, 14, 7, '#f4f1ea'); oval(c, 11, 4, 4, 4, '#d62f2f'); oval(c, 15, 3, 4, 4, '#ffd23f'); oval(c, 19, 5, 4, 4, '#5ee07a');
  R(c, 42, 3, 3, 8, '#7a9a3a'); R(c, 42, 3, 1, 8, '#a8c060'); R(c, 43, 1, 1, 2, '#c9a227'); R(c, 48, 6, 4, 5, '#f4f1ea'); R(c, 49, 5, 2, 1, '#8a5a33');
  outline(c);
}
// Dining table for two (mansion), 2 x 1 tiles.
function paintDining(c) {
  shadowEllipse(c, 32, 41, 28, 2);
  for (const x of [1, 51]) { // chairs at both ends
    bevel(c, x + 2, 6, 8, 18, '#c48a52', '#d6a06a', '#8a5a33'); R(c, x + 3, 9, 6, 1, '#8a5a33'); R(c, x + 3, 14, 6, 1, '#8a5a33');
    R(c, x, 24, 12, 4, '#d6a06a'); R(c, x, 24, 12, 1, '#e8bc84'); R(c, x + 1, 28, 2, 12, '#8a5a33'); R(c, x + 9, 28, 2, 12, '#8a5a33');
  }
  R(c, 10, 16, 44, 9, '#e0c294'); R(c, 10, 16, 44, 1, '#f0d8b0'); R(c, 10, 25, 44, 3, '#a8845a');
  R(c, 13, 28, 3, 12, '#a8845a'); R(c, 48, 28, 3, 12, '#a8845a');
  R(c, 14, 18, 10, 5, '#f4f1ea'); R(c, 40, 18, 10, 5, '#f4f1ea'); R(c, 16, 19, 6, 3, '#ffffff'); R(c, 42, 19, 6, 3, '#ffffff');
  R(c, 30, 12, 4, 8, '#5fd7ff'); R(c, 30, 12, 4, 1, '#c8f0ff'); P(c, 31, 10, '#ff7eb6'); P(c, 32, 9, '#ffd23f'); P(c, 33, 10, '#ff7eb6'); R(c, 31, 11, 1, 2, '#3d8a44');
  outline(c);
}
// Glass coffee table (tower living room), 2 x 1 tiles.
function paintCoffeeTable(c) {
  shadowEllipse(c, 32, 29, 26, 2);
  R(c, 6, 10, 52, 12, '#bfe3f2'); R(c, 6, 10, 52, 1, '#ffffff'); R(c, 6, 21, 52, 1, '#8fb8cc');
  for (let k = 0; k < 6; k++) { P(c, 12 + k, 19 - k, '#e8f6fc'); P(c, 40 + k, 19 - k, '#e8f6fc'); }
  R(c, 6, 22, 52, 2, '#9aa0aa');
  for (const x of [8, 54]) { R(c, x, 24, 2, 6, '#c8ccd4'); P(c, x, 24, '#ffffff'); }
  R(c, 14, 12, 12, 7, '#ff7eb6'); R(c, 15, 13, 10, 2, '#ffffff'); R(c, 15, 16, 7, 1, '#ffffff');
  R(c, 40, 8, 5, 9, '#f4f1ea'); R(c, 40, 8, 5, 1, '#ffffff'); P(c, 41, 6, '#ffd23f'); P(c, 43, 5, '#ff8a3d'); P(c, 42, 7, '#3d8a44');
  outline(c);
}
// A scale model of the tower in a glass case (real-estate office).
function paintModel(c) {
  shadowEllipse(c, 16, 46, 14, 2);
  bevel(c, 3, 34, 26, 12, '#4a3020', '#6b4a32', '#2e1c12');
  R(c, 5, 6, 22, 28, '#d8eef8'); R(c, 5, 6, 22, 1, '#ffffff');
  R(c, 6, 31, 20, 3, '#5ea85a');
  R(c, 13, 10, 7, 21, '#6fa8dc'); R(c, 13, 10, 7, 1, '#a8d4f0'); R(c, 18, 11, 2, 20, '#4a88c0');
  for (let y = 12; y < 30; y += 2) R(c, 14, y, 4, 1, '#c8e4f8');
  R(c, 8, 22, 4, 9, '#e8ecf2'); R(c, 21, 25, 4, 6, '#f4e8d8');
  for (let k = 0; k < 8; k++) P(c, 7 + k, 14 - k, 'rgba(255,255,255,0.7)');
  outline(c);
}
// Chandelier (tower lobby), drawn over everything in units (cx = centre).
function drawChandelier(ctx, cx, cy, g) {
  const tw = Math.floor(g.frame / 20) % 3;
  R(ctx, cx - 0.25, cy - 12, 0.5, 8, '#a8851c');
  R(ctx, cx - 9, cy - 4, 18, 1.5, '#c9a227'); R(ctx, cx - 9, cy - 4, 18, 0.5, '#e8c43a');
  R(ctx, cx - 6, cy - 2.5, 12, 1, '#a8851c');
  for (let i = -4; i <= 4; i++) {
    const x = cx + i * 2;
    R(ctx, x - 0.25, cy - 2.5, 0.5, 2 + (Math.abs(i) % 2) * 1.5, '#e8f4ff');
    R(ctx, x - 0.5, cy - 0.5 + (Math.abs(i) % 2) * 1.5, 1, 1, (i + tw) % 3 === 0 ? '#ffffff' : '#fff6a8');
  }
  for (const i of [-4, 0, 4]) R(ctx, cx + i * 2 - 0.5, cy - 6, 1, 2, '#fff6d8');
}

// Shop name plaque on a wall (w tiles wide, in the middle of a wall face row).
function paintPlaque(c, w, label, bg, fg, accent) {
  const W = w * 32;
  R(c, 0, 2, W, 22, shade(bg, -0.35)); R(c, 1, 3, W - 2, 20, bg); R(c, 1, 3, W - 2, 1, shade(bg, 0.3));
  R(c, 1, 20, W - 2, 3, accent);
  text(c, label, W / 2, 5, { size: 14, align: 'center', color: fg, shadow: shade(bg, -0.45) });
  outline(c);
}
const plaque = (x, y, w, label, bg, fg, accent, talk) => ({
  type: 'prop', x, y, w, h: 1, solid: false,
  draw: (ctx, sx, sy) => blit(ctx, sprite('plaque_' + label, w * 16, 13, (c) => paintPlaque(c, w, label, bg, fg, accent)), sx, sy + 1),
  ...(talk ? { text: talk } : {}),
});

// ================================================================ shared flows
const AGENT = { name: '間取さん', look: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#2a3560', bottom: '#2a3560', jacket: true, tie: '#ff8a3d', glasses: true } };
const CLERK = { name: '家具屋の木目さん', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#5a4a3a', apron: '#2f7a5a' } };
const KANRI = { name: '管理人さん', look: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#5a7a9a', bottom: '#3b3f48', glasses: true } };
const CONCIERGE = { name: 'コンシェルジュ', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#1e2a4a', bottom: '#1e2a4a', jacket: true, skirt: true, tie: '#c9a227' } };
const speak = (who) => ({ name: who.name, look: who.look });

// Leave a building: back to its door in town, or (no building placed yet) to Tokyo.
async function leave(g, placeId) {
  if (doorIndexFor(placeId)) { await g.exitPlace(); return; }
  const home = doorIndexFor('home');
  if (home) await g.goto(home.town, home.room, home.x, home.y, 'down');
  else await g.goto('tokyo');
  g.save(true);
}
const exitEvents = (placeId, xs, y) => xs.map((x) => ({ x, y, on: 'step', run: (g) => leave(g, placeId) }));

const naikenOf = (g) => g.flag('housing_naiken') || null;

// The listing text for a home (list description / detail pages).
function listingLine(g, id) {
  const h = HOUSING[id];
  const f = reqFame(h);
  return `家賃 ${fmtMoney(h.rent)}／週・引っ越し ${fmtMoney(h.moveCost || 0)}${f ? `・★${f}以上` : ''}`;
}

// ---------------------------------------------------------------- listing card (hd overlay)
// Floor plans: [x, y, w, h, label, colour] on a 20 x 14 grid.
const PLANS = {
  dotsou: { color: '#8a5a33', rooms: [[0, 0, 13, 10, '洋室 6畳', '#f6ecd8'], [13, 0, 7, 6, 'K', '#e8eef4'], [13, 6, 7, 4, 'UB', '#d8ecf6'], [0, 10, 6, 4, '押入', '#ece4d4'], [6, 10, 7, 4, '玄関', '#d5d9e0'], [13, 10, 7, 4, '洗濯機', '#e8eef4']] },
  mansion: { color: '#3a6fd8', rooms: [[0, 0, 20, 2, 'バルコニー', '#d8ecd0'], [0, 2, 12, 8, 'LDK 12畳', '#fff6e0'], [12, 2, 8, 6, '洋室 6畳', '#f6ecd8'], [0, 10, 5, 4, '収納', '#ece4d4'], [12, 8, 4, 6, '浴室', '#d8ecf6'], [16, 8, 4, 6, 'WC', '#e8eef4'], [5, 10, 7, 4, '玄関', '#d5d9e0']] },
  tower: { color: '#a8851c', rooms: [[0, 0, 20, 1, '', '#1e2a5c'], [0, 1, 13, 8, 'LDK 20畳', '#fff6e0'], [13, 1, 7, 6, '主寝室', '#f6ecd8'], [13, 7, 7, 7, '洋室', '#f6ecd8'], [0, 9, 6, 5, 'ジェットバス', '#d8ecf6'], [6, 9, 4, 5, 'WIC', '#ece4d4'], [10, 9, 3, 5, '玄関', '#d5d9e0']] },
};
class ListingCard {
  constructor(g, id) { Object.assign(this, { g, id, hd: true, t: 0, hidesHud: true }); }
  update() { this.t++; }
  draw(ctx, g) {
    const h = HOUSING[this.id];
    const plan = PLANS[this.id] || PLANS.dotsou;
    const X = 92, Y = 10, W = SW - 184, H = 242;
    panel(ctx, X, Y, W, H, { bg: '#fbf8f2', edge: '#2a3560' });
    R(ctx, X + 3, Y + 3, W - 6, 28, plan.color);
    text(ctx, h.name, X + 16, Y + 8, { size: 16, color: '#ffffff', shadow: shade(plan.color, -0.5) });
    text(ctx, h.plan || '', X + W - 16, Y + 10, { size: 12, align: 'right', color: '#ffffff', shadow: null });
    // floor plan
    const PX = X + 16, PY = Y + 44, S = 10;
    R(ctx, PX - 3, PY - 3, 20 * S + 6, 14 * S + 6, '#3b3f48');
    for (const [x, y, w, hh, label, col] of plan.rooms) {
      R(ctx, PX + x * S, PY + y * S, w * S, hh * S, '#3b3f48');
      R(ctx, PX + x * S + 1, PY + y * S + 1, w * S - 2, hh * S - 2, col);
      const dark = col === '#1e2a5c';
      text(ctx, label, PX + (x + w / 2) * S, PY + (y + hh / 2) * S - 6, { size: 12, align: 'center', color: dark ? '#ffe36e' : '#3b3f48', shadow: null });
    }
    // facts
    const RX = PX + 20 * S + 18, RW = X + W - 16 - RX;
    const f = reqFame(h);
    const ok = g.state.fame >= f;
    const row = (y, k, v, col = '#20232a') => { text(ctx, k, RX, y, { size: 12, color: '#6d7380', shadow: null }); text(ctx, v, RX + RW, y - 2, { size: 16, align: 'right', color: col, shadow: null }); R(ctx, RX, y + 17, RW, 1, '#e4dccb'); };
    row(Y + 44, '家賃（毎週月曜）', fmtMoney(h.rent), '#d62f2f');
    row(Y + 68, '引っ越し費用', fmtMoney(h.moveCost || 0));
    row(Y + 92, '入居条件', f ? `★${f}以上` : 'なし', f && !ok ? '#d62f2f' : '#2f9a4a');
    row(Y + 116, '家具', `${h.slots}つまで`);
    (h.perks || []).slice(0, 3).forEach((p, i) => text(ctx, '・' + p, RX, Y + 142 + i * 18, { size: 12, color: '#3b3f48', shadow: null }));
    // right under the floor plan (the message window's name tag covers the card's bottom-left corner)
    text(ctx, `所持金 ${fmtMoney(g.state.money)}　★${g.state.fame}`, PX - 2, PY + 14 * S + 10, { size: 12, color: '#6d7380', shadow: null });
    if (lives(g, this.id)) {
      const sx = X + W - 120, sy = Y + H - 44;
      R(ctx, sx, sy, 104, 30, '#d62f2f'); R(ctx, sx + 2, sy + 2, 100, 26, '#fbf8f2'); R(ctx, sx + 3, sy + 3, 98, 24, '#d62f2f');
      text(ctx, 'いまの住まい', sx + 52, sy + 8, { size: 12, align: 'center', color: '#ffffff', shadow: null });
    } else if (f && !ok) text(ctx, `あと★${f - g.state.fame}`, X + W - 16, Y + H - 30, { size: 12, align: 'right', color: '#d62f2f', shadow: null });
  }
}
// Show the card while fn runs (the message window draws over its lower edge).
async function withCard(g, id, fn) {
  const card = new ListingCard(g, id);
  g.scenes.push(card);
  try { return await fn(); } finally { g.pop(card); }
}

// Sell furniture back (half price). Returns the refund.
function sellFurniture(g, id) {
  const f = FURNITURE[id];
  if (!f || !g.state.furniture[id]) return 0;
  delete g.state.furniture[id];
  const back = half(f.price);
  g.addMoney(back, true);
  return back;
}
// Ask which pieces to sell until at most `keep` pieces remain (not counting `except`, e.g. the
// bed being traded in), then sell them all at once. False if cancelled (then nothing is sold).
async function trimFurniture(g, keep, o, title = '引き取ってもらう家具', except = null) {
  const picked = [];
  for (;;) {
    const ids = ownedFurniture(g).filter((id) => id !== except && !picked.includes(id));
    const need = ids.length - keep;
    if (need <= 0) break;
    const i = await g.list({
      title: `${title}（あと${need}つ）`, x: 24, y: 52, w: 330, px: true,
      items: ids.map((id) => ({ label: FURNITURE[id].name, right: fmtMoney(half(FURNITURE[id].price)) })),
      describe: (k) => `${FURNITURE[ids[k]].perk || FURNITURE[ids[k]].desc}\n引き取り価格：${fmtMoney(half(FURNITURE[ids[k]].price))}（半額）`,
    });
    if (i < 0 || !ids[i]) return false;
    picked.push(ids[i]);
  }
  if (!picked.length) return true;
  let total = 0;
  for (const id of picked) total += sellFurniture(g, id);
  g.sfx('coin');
  const names = picked.length > 2 ? `家具${picked.length}つ` : picked.map((id) => `「${FURNITURE[id].name}」`).join('と');
  await g.say(`${names}を、${fmtMoney(total)}で\n引き取ってもらった。`);
  return true;
}

// ---------------------------------------------------------------- moving
class MovingScene {
  constructor(g, label, resolve) {
    Object.assign(this, { g, label, resolve, t: 0, hd: true, opaque: true, hidesHud: true });
  }
  update(g) {
    this.t++;
    if (g.auto || this.t > 200 || (this.t > 40 && g.input.pressed('a'))) { g.pop(this); this.resolve(); }
  }
  truck() {
    return sprite('mover_truck2', 110, 50, (c) => {
      // cargo box with the company stripes
      bevel(c, 4, 4, 146, 78, '#fbfbfd', '#ffffff', '#c8ccd4');
      R(c, 4, 64, 146, 5, '#ff8a3d'); R(c, 4, 69, 146, 4, '#2f6fd0');
      text(c, 'ドット引越センター', 77, 24, { size: 14, align: 'center', color: '#2f6fd0', shadow: null });
      R(c, 22, 44, 110, 1, '#d5d9e0'); text(c, 'まごころ配達', 77, 47, { size: 12, align: 'center', color: '#ff8a3d', shadow: null });
      // cab
      R(c, 150, 30, 58, 52, '#2f6fd0'); R(c, 150, 30, 40, 3, '#5a8fe8'); R(c, 150, 30, 2, 52, '#5a8fe8');
      R(c, 158, 36, 30, 20, '#a8dcf5'); R(c, 158, 36, 30, 3, '#e0f4ff'); R(c, 170, 40, 2, 12, '#e0f4ff');
      R(c, 192, 38, 14, 26, '#2a5ab8'); R(c, 196, 56, 6, 2, '#c8ccd4');
      R(c, 204, 66, 6, 8, '#ffd23f'); R(c, 204, 66, 6, 2, '#fff6a8');
      // chassis and wheel arches
      R(c, 2, 82, 210, 8, '#3b3f48'); R(c, 2, 82, 210, 2, '#5a5f6b');
      outline(c);
    });
  }
  wheel(ctx, x, y, t) {
    R(ctx, x - 12, y - 2, 24, 26, '#16181e'); R(ctx, x - 14, y + 2, 28, 18, '#16181e');
    R(ctx, x - 7, y + 4, 14, 14, '#9aa0aa'); R(ctx, x - 7, y + 4, 14, 2, '#c8ccd4');
    const k = Math.floor(t / 3) % 2;
    R(ctx, x - 1, y + 5 + k * 2, 2, 10 - k * 4, '#5a5f6b'); R(ctx, x - 5 + k * 2, y + 10, 10 - k * 4, 2, '#5a5f6b');
  }
  draw(ctx, g) {
    const t = this.t;
    // sky
    ['#7cc4f0', '#86caf2', '#92d0f4', '#a0d8f6', '#b0e0f8'].forEach((col, i) => R(ctx, 0, i * 50, SW, 50, col));
    for (const [x0, y, s] of [[60, 40, 1], [300, 70, 1.3], [520, 36, 1]]) {
      const x = ((x0 - t * 0.3) % (SW + 140) + SW + 140) % (SW + 140) - 70;
      R(ctx, x + 6 * s, y, 48 * s, 14 * s, '#ffffff'); R(ctx, x, y + 4 * s, 60 * s, 10 * s, '#ffffff');
      R(ctx, x + 14 * s, y - 8 * s, 24 * s, 10 * s, '#ffffff'); R(ctx, x + 2 * s, y + 14 * s, 56 * s, 2, '#d8ecf8');
    }
    // far city (slow parallax)
    const off = (t * 1.2) % 200;
    for (let i = -1; i < 5; i++) {
      const bx = i * 200 - off;
      for (const [dx, w, h] of [[0, 44, 96], [50, 34, 140], [90, 52, 76], [148, 40, 118]]) {
        R(ctx, bx + dx, 250 - h, w, h, '#b4c6dc'); R(ctx, bx + dx, 250 - h, w, 2, '#cad8e8');
        for (let yy = 258 - h; yy < 244; yy += 12) for (let xx = bx + dx + 6; xx < bx + dx + w - 6; xx += 10) R(ctx, xx, yy, 4, 6, '#dce6f2');
      }
    }
    // hedge and trees (faster), sidewalk, road
    R(ctx, 0, 244, SW, 22, '#4f9a4a'); R(ctx, 0, 244, SW, 3, '#62b35b');
    const toff = (t * 3) % 140;
    for (let i = -1; i < 6; i++) {
      const x = i * 140 - toff;
      R(ctx, x + 66, 214, 8, 36, '#6e4a2a');
      R(ctx, x + 50, 190, 40, 30, '#3d8a44'); R(ctx, x + 46, 196, 48, 18, '#3d8a44'); R(ctx, x + 56, 186, 28, 6, '#4fa04a'); R(ctx, x + 54, 192, 14, 6, '#62b35b');
    }
    R(ctx, 0, 262, SW, 10, '#c8ccd4'); R(ctx, 0, 262, SW, 2, '#e4e6ea');
    R(ctx, 0, 272, SW, 60, '#5a5f6b'); R(ctx, 0, 272, SW, 2, '#3b3f48');
    const loff = (t * 6) % 80;
    for (let x = -loff; x < SW; x += 80) R(ctx, x, 300, 40, 4, '#f4f4f4');
    R(ctx, 0, 332, SW, 28, '#c8ccd4'); R(ctx, 0, 332, SW, 2, '#e4e6ea');
    // the truck drives in, cruises, drives out
    const tx = t < 60 ? -230 + (t / 60) * 440 : t < 140 ? 210 : 210 + (t - 140) * 9;
    const bob = Math.floor(t / 6) % 2;
    ctx.drawImage(this.truck(), tx, 192 + bob, 220, 100);
    for (const wx of [tx + 40, tx + 118, tx + 186]) this.wheel(ctx, wx, 270, t);
    panel(ctx, SW / 2 - 200, 20, 400, 44, { bg: '#1d2a5e' });
    text(ctx, this.label, SW / 2, 32, { size: 16, align: 'center', color: '#fff' });
  }
}

async function movingScene(g, label) {
  await g.fadeOut(12);
  await new Promise((r) => { g.push(new MovingScene(g, label, r)); g.fadeIn(10); });
  g.fade = 1;
}

// Arrive in a home (after moving / from the lobby).
async function arriveHome(g, id, fade = true) {
  const h = HOUSING[id];
  if (id === 'dotsou') await g.goto('home', 'room', 4, 6, 'up', { fade });
  else await g.goto(h.place, h.room, undefined, undefined, 'up', { fade });
}

// The whole move: checks, furniture over the new limit, payment, scene, arrival.
export async function moveTo(g, id, o = speak(AGENT)) {
  const st = g.state;
  const h = HOUSING[id];
  if (!h) return false;
  if (lives(g, id)) { await g.say('いまお住まいのお部屋ですね！\n住み心地はいかがですか？', o); return false; }
  const debt = st.rent.debt || 0;
  if (debt > 0 && id !== 'dotsou') {
    await g.say([`未払いの家賃（${fmtMoney(debt)}）があるうちは、\n新しいお部屋のご契約はできないんです…。`, 'スマホの「家計」か、こちらの「家賃の相談」で\nお支払いいただいてから、またどうぞ。'], o);
    return false;
  }
  const f = reqFame(h);
  if (st.fame < f) { await g.say([`「${h.name}」は、知名度★${f}以上の方が\n入居の条件なんです…。（いまは★${st.fame}）`, 'お仕事でもっと有名になったら、ぜひ！'], o); return false; }
  const cost = moveCostFor(g, id);
  if (st.money < cost) { await g.say(`お引っ越し費用（${fmtMoney(cost)}）が\n足りないようです…。（あと${fmtMoney(cost - st.money)}）`, o); return false; }
  const over = ownedFurniture(g).length - h.slots;
  const costText = cost ? `引っ越し費用 ${fmtMoney(cost)}` : '引っ越し費用は、今回はサービスです';
  const i = await g.ask(`「${h.name}」へ引っ越しますか？\n${costText}\n家賃は毎週月曜 ${fmtMoney(h.rent)}`, ['引っ越す', 'やめておく'], { ...o, cancel: 1 });
  if (i !== 0) { await g.say('かしこまりました。\nまたいつでもご相談ください。', o); return false; }
  if (over > 0) {
    await g.say(`新しいお部屋に置ける家具は${h.slots}つまでです。\n置ききれない${over}つは、家具屋さんが\n半額で引き取ってくれますよ。`, o);
    if (!(await trimFurniture(g, h.slots, o))) { await g.say('では、お引っ越しはまた今度にしましょう。', o); return false; }
  }
  if (cost && !g.spend(cost)) return false;
  const from = g.housing();
  g.moveHousing(id);
  g.setFlag('housing_naiken', null);
  g.setFlag('housing_delivered', []); // the movers bring everything along
  g.setFlag('housing_moves', (Number(g.flag('housing_moves')) || 0) + 1);
  g.sfx('coin');
  await g.say(id === 'dotsou'
    ? ['ドット荘ですね。大家さんに連絡しておきます！\n「いつでもおかえり」っておっしゃってましたよ。', 'では、さっそくお引っ越しです！']
    : ['ご契約、ありがとうございます！\nでは、さっそくお引っ越しです！', `家具も全部、${h.name}に運んでおきますね。`], o);
  // messages: the new home, and the landlady when leaving or coming back
  const oya = PEOPLE.oya ? { person: 'oya', from: PEOPLE.oya.name } : { from: '大家さん' };
  if (from.id === 'dotsou') g.message({ ...oya, kind: 'chat', text: 'お引っ越しおめでとう。さみしくなるわね…。でも、たまには顔を見せにきてちょうだい。ドット荘はいつでもあなたの家よ。' });
  if (id === 'dotsou') g.message({ ...oya, kind: 'chat', text: 'おかえりなさい、{name}ちゃん！お部屋、ちゃんとそうじしておいたわよ。' });
  else g.message({ from: h.name, look: id === 'tower' ? CONCIERGE.look : KANRI.look, kind: 'news', text: `${h.name}へようこそ。家賃は毎週月曜の朝、${fmtMoney(h.rent)}をいただきます。快適な毎日を！` });
  await movingScene(g, `「${h.name}」へ引っ越し中…`);
  await arriveHome(g, id, true); // still black: goto fades in, then the arrival lines
  g.save();
  if (id === 'dotsou') {
    g.setFlag('housing_arrived', id);
    await g.say(['なつかしのドット荘に帰ってきた！\nやっぱり、ここは落ち着くなあ。']);
  }
  return true;
}

// 内見: look around a home, then come back to the office.
async function naiken(g, id, o) {
  const h = HOUSING[id];
  if (id === 'dotsou') { await g.say('ドット荘は、前にお住まいだったお部屋ですから…\n内見はいりませんね！', o); return; }
  if (lives(g, id)) { await g.say('いまお住まいのお部屋ですね！', o); return; }
  await g.say([`では「${h.name}」へご案内します！`, '見終わったら、玄関から出てくださいね。\nこちらの店までお送りします。'], o);
  g.setFlag('housing_naiken', id);
  g.sfx('door');
  await arriveHome(g, id, true);
}
async function endNaiken(g) {
  const id = naikenOf(g);
  g.setFlag('housing_naiken', null);
  await g.goto('fudousan', 'office', 6, 4, 'up');
  const o = speak(AGENT);
  const h = HOUSING[id];
  if (!h) return;
  const i = await g.ask(`おかえりなさい！\n「${h.name}」、いかがでしたか？`, ['ここに決める', 'もう少し考える'], { ...o, cancel: 1 });
  if (i === 0) await moveTo(g, id, o);
  else await g.say('ゆっくり考えてくださいね。\nお部屋は逃げませんから！…たぶん。', o);
}

// Leaving the apartment door: viewers go back to the office, residents to the lobby.
function apartmentDoor(placeId, lx, ly) {
  return async (g) => {
    // a viewing of this very home (a stale flag from another home never sends a resident away)
    if (naikenOf(g) === placeId && !lives(g, placeId)) { await endNaiken(g); return; }
    if (naikenOf(g)) g.setFlag('housing_naiken', null);
    await g.goto(placeId, 'lobby', lx, ly, 'down');
  };
}

// The elevator / auto-lock: residents (and viewers with the agent) only.
function residentsOnly(id, staff, lines) {
  return async (g) => {
    if (lives(g, id) || naikenOf(g) === id) { g.sfx('chime'); return true; }
    await g.say(lines, speak(staff));
    return false;
  };
}

// ---------------------------------------------------------------- the real-estate office
async function agentTalk(g, npc) {
  const o = speak(AGENT);
  const st = g.state;
  if (!g.flag('fudousan_met')) {
    g.setFlag('fudousan_met');
    await g.say(['いらっしゃいませ！ドット不動産の間取（まどり）です。', 'お部屋さがしから内見、お引っ越しまで\nまるっとおまかせください！'], o);
  }
  for (;;) {
    const k = await g.ask(`今日はどうされますか？\n（いまのお住まい：${g.housing().name}）`, ['物件を見る', '家賃の相談', 'やめておく'], { ...o, cancel: 2 });
    if (k === 0) { if ((await browse(g, o)) === 'moved') return; } else if (k === 1) await rentTalk(g, o);
    else { await g.say('ありがとうございました！\nいいお部屋との出会いを応援しています！', o); return; }
  }
}
async function browse(g, o) {
  for (;;) {
    const ids = HOME_ORDER.filter((id) => HOUSING[id]);
    const items = ids.map((id) => ({
      label: HOUSING[id].name + (lives(g, id) ? '（住んでいる）' : ''),
      right: `${fmtMoney(HOUSING[id].rent)}／週`,
    }));
    const i = await g.list({
      title: 'ドット不動産 物件リスト', items, x: 24, y: 52, w: 420, px: true,
      describe: (k) => `${listingLine(g, ids[k])}\n${(HOUSING[ids[k]].perks || []).slice(0, 2).join('・')}\n${HOUSING[ids[k]].plan || ''}・家具は${HOUSING[ids[k]].slots}つまで`,
    });
    if (i < 0) return null;
    const res = await listingDetail(g, ids[i], o);
    if (res === 'moved') return 'moved';
  }
}
async function listingDetail(g, id, o) {
  const choices = id === 'dotsou' ? ['引っ越す', 'もどる'] : ['内見する', '引っ越す', 'もどる'];
  const k = await withCard(g, id, async () => {
    await g.say(HOUSING[id].desc || '', o);
    if (lives(g, id)) { await g.say('こちらは、いまお住まいのお部屋ですね！', o); return -1; }
    return g.ask(`「${HOUSING[id].name}」、どうしますか？`, choices, { ...o, cancel: choices.length - 1 });
  });
  const act = choices[k];
  if (act === '内見する') { await naiken(g, id, o); return 'moved'; }
  if (act === '引っ越す') return (await moveTo(g, id, o)) ? 'moved' : null;
  return null;
}
async function rentTalk(g, o) {
  const st = g.state;
  const h = g.housing();
  const debt = st.rent.debt || 0;
  if (debt > 0) {
    const i = await g.ask(`未払いの家賃が${fmtMoney(debt)}ありますね。\nこちらでお支払いしますか？`, ['払う', 'やめておく'], { ...o, cancel: 1 });
    if (i === 0) {
      if (g.payDebt()) {
        g.message({ from: h.name, kind: 'bill', read: true, text: `未払いの家賃 ${fmtMoney(debt)} をお支払いいただきました。ありがとうございました。` });
        await g.say('お支払い、たしかに承りました！\nこれで一安心ですね。', o);
      } else await g.say(`うーん、所持金が足りないみたいです…。\n（あと${fmtMoney(debt - st.money)}）`, o);
    }
    if (!lives(g, 'dotsou') && (st.rent.debt || 0) > 0) {
      await g.say(['家賃がきびしいときは、無理をせず\nドット荘に戻るのも手ですよ。', 'ドット荘なら家賃は¥8,000。\nお引っ越し代もお安くしておきます！'], o);
    }
    return;
  }
  const weeks = h.rent ? Math.floor(st.money / h.rent) : 99;
  await g.say([
    `いまのお住まいの家賃は、毎週月曜の朝に\n${fmtMoney(h.rent)}です。未払いはありません！`,
    weeks >= 4 ? 'いまの所持金なら、しばらく安心ですね。' : `いまの所持金だと、あと${weeks}週分ほど…。\nお仕事、がんばってくださいね！`,
    '目安として、家賃が週のかせぎの2割くらいなら\nむりなく暮らせますよ。',
  ], o);
}

// ---------------------------------------------------------------- the furniture store
const perkOf = (f) => f.perk || f.desc || '';
// A bed that is a step down from the one you have (it would trade the better bed in).
function downgrade(g, id) {
  const f = FURNITURE[id];
  const cur = f && f.bed ? bedPiece(g) : null;
  return !!(cur && cur !== id && FURNITURE[cur].price > f.price);
}
export async function buyFurniture(g, id, o = speak(CLERK)) {
  const st = g.state;
  const f = FURNITURE[id];
  const h = g.housing();
  if (!f) return false;
  if (g.furnitureOwned(id)) { await g.say(`「${f.name}」は、もうお持ちですね！\n大事に使ってくださいね。`, o); return false; }
  // a bed replaces the one you have: the old one is taken back at half price (pay < 0: you get the difference)
  const oldBed = f.bed ? bedPiece(g) : null;
  const tradeIn = oldBed ? half(FURNITURE[oldBed].price) : 0;
  const pay = f.price - tradeIn;
  const deal = !oldBed ? 'お買い上げになりますか？'
    : pay >= 0 ? `（いまのベッドを下取り：お支払い${fmtMoney(pay)}）`
      : `（いまのベッドを下取り：差額${fmtMoney(-pay)}をお返し）`;
  if (st.money < pay) { await g.say(`「${f.name}」${fmtMoney(f.price)}\n${perkOf(f)}\nお代が、あと${fmtMoney(pay - st.money)}足りないようです…。`, o); return false; }
  const i = await g.ask(`「${f.name}」${fmtMoney(f.price)}\n${perkOf(f)}\n${deal}`, ['買う', 'やめておく'], { ...o, cancel: 1 });
  if (i !== 0) return false;
  if (downgrade(g, id)) {
    const j = await g.ask(`いまの「${FURNITURE[oldBed].name}」のほうが\n上等なベッドですが…\n本当に入れかえますか？`, ['入れかえる', 'やめておく'], { ...o, cancel: 1 });
    if (j !== 0) { await g.say('かしこまりました。\nいまのベッドを、大事に使ってくださいね。', o); return false; }
  }
  if (st.money < pay) { await g.say(`お客さま、お代が足りないようです…。\n（あと${fmtMoney(pay - st.money)}）`, o); return false; }
  // the bed being replaced leaves with the new one coming in: it never takes part in the count
  if (ownedFurniture(g).filter((k) => k !== oldBed).length >= h.slots) {
    await g.say(`「${h.name}」に置ける家具は${h.slots}つまで。\nいまのお部屋は、もういっぱいですね…。\nどれかを引き取りましょうか？（半額で買い取り）`, o);
    if (!(await trimFurniture(g, h.slots - 1, o, undefined, oldBed))) { await g.say('かしこまりました。\nまたのお越しをお待ちしています！', o); return false; }
  }
  if (pay > 0 && !g.spend(pay)) return false;
  if (pay < 0) g.addMoney(-pay, true);
  if (oldBed) delete st.furniture[oldBed];
  st.furniture[id] = true;
  const delivered = g.flag('housing_delivered');
  g.setFlag('housing_delivered', [...(Array.isArray(delivered) ? delivered : []).filter((k) => k !== id), id]);
  g.sfx('coin');
  await g.say(`お買い上げありがとうございます！\n「${h.name}」に配達しておきますね。`, o);
  if (f.stamina) {
    const fit = { ...(g.flag('housing_fit') || {}) };
    if (!fit[id]) {
      fit[id] = f.stamina;
      g.setFlag('housing_fit', fit);
      st.maxStamina = (st.maxStamina || 100) + f.stamina;
      fixMaxStamina(g);
      g.sfx('good');
      await g.say(`これで毎日トレーニングできる！\n（体力の最大値 +${f.stamina}：${st.maxStamina}）`);
    }
  }
  g.save();
  return true;
}
async function catalog(g, o) {
  let index = 0;
  for (;;) {
    const ids = FURNITURE_ORDER.filter((id) => FURNITURE[id]);
    const h = g.housing();
    const n = ownedFurniture(g).length;
    const i = await g.list({
      title: `家具カタログ（お部屋の家具 ${n}/${h.slots}）`, x: 24, y: 52, w: 420, px: true, index,
      items: ids.map((id) => ({ label: FURNITURE[id].name + (downgrade(g, id) ? '（ランク下）' : ''), right: g.furnitureOwned(id) ? '持っている' : fmtMoney(FURNITURE[id].price), disabled: g.furnitureOwned(id) })),
      describe: (k) => `${perkOf(FURNITURE[ids[k]])}\n${downgrade(g, ids[k]) ? 'いまのベッドより下のランクです' : FURNITURE[ids[k]].desc || ''}`,
    });
    if (i < 0) return;
    index = i;
    await buyFurniture(g, ids[i], o);
  }
}
async function clerkTalk(g) {
  const o = speak(CLERK);
  if (!g.flag('kagu_met')) {
    g.setFlag('kagu_met');
    await g.say(['いらっしゃいませ〜！ドット家具へようこそ。', '並んでいる家具は、ぜんぶ見本です。\n気になるものに話しかけると、くわしくご案内しますね。', '家具には、暮らしが楽になる「いいこと」があるんですよ。\nお部屋に置ける数には限りがあるので、よく選んでくださいね。'], o);
  }
  for (;;) {
    const k = await g.ask('今日はどうされますか？', ['カタログを見る', '引き取ってもらう', 'やめておく'], { ...o, cancel: 2 });
    if (k === 0) await catalog(g, o);
    else if (k === 1) {
      if (!ownedFurniture(g).length) { await g.say('お部屋に家具がないみたいですね。\nいい出会いがありますように！', o); continue; }
      const ids = ownedFurniture(g);
      const i = await g.list({
        title: '引き取り（買った値段の半分）', x: 24, y: 52, w: 360, px: true,
        items: ids.map((id) => ({ label: FURNITURE[id].name, right: fmtMoney(half(FURNITURE[id].price)) })),
        describe: (j) => perkOf(FURNITURE[ids[j]]),
      });
      if (i < 0) continue;
      const j = await g.ask(`「${FURNITURE[ids[i]].name}」を${fmtMoney(half(FURNITURE[ids[i]].price))}で\n引き取りますね。よろしいですか？`, ['お願いします', 'やめておく'], { ...o, cancel: 1 });
      if (j !== 0) continue;
      sellFurniture(g, ids[i]);
      g.sfx('coin');
      await g.say('たしかに引き取りました！\nまた新しい家具をさがしにきてくださいね。', o);
    } else { await g.say('ありがとうございました〜！', o); return; }
  }
}
// A showroom sample: info + buy.
function display(id, x, y, w = 2, h = 1) {
  return {
    type: 'prop', x, y, w, h,
    draw: (ctx, sx, sy, g) => {
      drawFurniture(ctx, id, sx, sy, g, w, h);
      const f = FURNITURE[id];
      if (!f) return;
      // price tag
      const owned = g.furnitureOwned(id);
      const label = owned ? '購入済' : fmtMoney(f.price);
      const tw = Math.max(18, label.length * 3.5 + 4);
      const tx = sx + w * 8 - tw / 2, ty = sy + h * 16 - 1;
      R(ctx, tx, ty, tw, 6.5, owned ? '#5a5f6b' : '#ffffff'); R(ctx, tx, ty + 6, tw, 0.5, '#9aa0aa');
      R(ctx, tx, ty, 1, 6.5, owned ? '#3b3f48' : '#d62f2f');
      text(ctx, label, tx + tw / 2 + 0.5, ty + 0.5, { size: 5.5, align: 'center', color: owned ? '#ffffff' : '#20232a', shadow: null });
    },
    talk: async (g) => {
      const f = FURNITURE[id];
      // the sample's description, then the clerk's offer (price + perk): nothing said twice
      if (g.furnitureOwned(id)) { await g.say(`【${f.name}】（お持ちの家具）\n${f.desc}\n${perkOf(f)}`); return; }
      await g.say(`【${f.name}】\n${f.desc}`);
      await buyFurniture(g, id);
    },
  };
}

// ================================================================ places
// ---------------------------------------------------------------- ドット不動産
registerPlace({
  id: 'fudousan',
  name: 'ドット不動産',
  kind: 'building',
  bgm: 'office',
  start: { room: 'office', x: 6, y: 7, dir: 'up' },
  rooms: {
    office: {
      floor: 'floor_carpet_gray',
      wall: 'white',
      tiles: [
        '#############',
        '#=LLL====cLL#',
        '#.......T...#',
        '#P...KKKK..P#',
        '#...........#',
        '#.SS........#',
        '#..........V#',
        '#.....G.....#',
        '######M######',
      ],
      legend: { L: 'wall_white+housing_listing', K: 'counter_white', S: 'sofa_blue', P: 'plant', V: 'water_server', G: 'housing_floor_genkan', T: 'desk_pc' },
      entities: [
        plaque(5, 1, 4, 'ドット不動産', '#2a3560', '#ffffff', '#ff8a3d'),
        { type: 'npc', id: 'madori', x: 6, y: 2, dir: 'down', ...AGENT, talk: agentTalk },
        { type: 'sign', x: 2, y: 1, talk: (g) => withCard(g, 'dotsou', () => g.say(['物件のチラシだ。', HOUSING['dotsou'].desc])) },
        { type: 'sign', x: 3, y: 1, talk: (g) => withCard(g, 'mansion', () => g.say(['物件のチラシだ。', HOUSING['mansion'].desc])) },
        { type: 'sign', x: 4, y: 1, talk: (g) => withCard(g, 'tower', () => g.say(['物件のチラシだ。', HOUSING['tower'].desc])) },
        { type: 'sign', x: 8, y: 2, text: '物件情報のパソコンだ。\n…間取さんの仕事道具。さわらないでおこう。' },
        { type: 'sign', x: 10, y: 1, text: '「駅近・日当たり良好！」\n「ペット可・角部屋！」\n…いろんな物件のチラシが貼ってある。' },
        { type: 'sign', x: 11, y: 1, text: '「今月のおすすめ：ドットタワー最上階」\n夜景がきれいな写真がついている。' },
        { type: 'prop', x: 9, y: 5, draw: (ctx, sx, sy) => blit(ctx, sprite('model', 16, 24, paintModel), sx, sy + 16 - 24), text: 'ドットタワーの模型だ。\nガラスケースの中で、小さな窓がキラキラしている。' },
        { type: 'npc', id: 'fudousan_customer', x: 2, y: 6, dir: 'up', look: { ...LOOKS.salaryman, top: '#8a6a4a', tie: '#d64161' }, name: 'お客さん', text: ['新しい部屋をさがしてるんです。', '家賃は安いほうがいいけど、お風呂はゆずれない…。\nなやましいなあ。'] },
      ],
      events: exitEvents('fudousan', [6], 8),
      onEnter: async (g) => { if (naikenOf(g)) g.setFlag('housing_naiken', null); },
    },
  },
});

// ---------------------------------------------------------------- ドット家具
const SHOW = [
  ['plant', 1, 2], ['bookshelf', 4, 2], ['aquarium', 7, 2], ['dresser', 10, 2], ['booth', 13, 2],
  ['sofa', 2, 5], ['tv', 5, 5], ['kotatsu', 8, 5], ['massage', 11, 5],
  ['yogamat', 2, 8], ['treadmill', 5, 8],
];
registerPlace({
  id: 'kagu',
  name: 'ドット家具',
  kind: 'building',
  bgm: 'office',
  start: { room: 'showroom', x: 9, y: 10, dir: 'up' },
  rooms: {
    showroom: {
      floor: 'housing_floor_oak',
      wall: 'cream',
      tiles: [
        '###################',
        '#==a==a==c==a=====#',
        '#.................#',
        '#...............B.#',
        '#.................#',
        '#.................#',
        '#.................#',
        '#..............RR.#',
        '#.................#',
        '#.................#',
        '#........G........#',
        '#########M#########',
      ],
      legend: { R: 'register', a: 'wall_cream+painting', B: 'sign_board', G: 'housing_floor_genkan' },
      topPad: 26,
      entities: [
        plaque(15, 1, 3, 'ドット家具', '#5a3a20', '#fff6e0', '#2f7a5a'),
        ...SHOW.map(([id, x, y]) => display(id, x, y)),
        display('bed_good', 9, 7, 2, 2), display('bed_king', 12, 7, 2, 2),
        { type: 'npc', id: 'mokume', x: 16, y: 6, dir: 'left', ...CLERK, talk: clerkTalk },
        { type: 'npc', id: 'kagu_couple', x: 7, y: 4, dir: 'up', look: { ...LOOKS.mom, top: '#5fd7ff' }, name: 'お客さん', wander: 1, text: ['このソファ、すわり心地がいいわねえ…。', 'でも、うちの部屋に入るかしら？\n家具は置ける数が決まってるのよね。'] },
        { type: 'sign', x: 16, y: 3, text: ['「家具はお部屋のパワーアップ！」\n毎朝の気分や、身だしなみが変わります。', '置ける数：ドット荘4・レジデンス6・タワー8\n（ベッドも1つに数えます）'] },
      ],
      events: exitEvents('kagu', [9], 11),
    },
  },
});

// ---------------------------------------------------------------- ドットレジデンス (mansion)
export const MANSION_SLOTS = [
  { x: 10, y: 3 }, // back wall, right of the window
  { x: 6, y: 3, low: true, win: true }, // under the window
  { x: 8, y: 3, low: true, win: true }, // under the window
  { x: 1, y: 8 }, // bottom-left
  { x: 10, y: 8 }, // bottom, left of the desk
  { x: 6, y: 6, low: true }, // middle of the living room
];
registerPlace({
  id: 'mansion',
  name: 'ドットレジデンス',
  kind: 'building',
  bgm: 'night',
  start: { room: 'lobby', x: 5, y: 6, dir: 'up' },
  rooms: {
    lobby: {
      floor: 'floor_tile',
      wall: 'white',
      tiles: [
        '############',
        '#=mm=E==kbw#',
        '#..........#',
        '#P.........#',
        '#.........P#',
        '#SS........#',
        '#..........#',
        '#####MM#####',
      ],
      legend: { m: 'wall_white+housing_mailbox', E: 'elevator', k: 'wall_white+housing_kanri', b: 'wall_white+whiteboard', S: 'sofa_beige', P: 'plant' },
      drawUnder: (ctx, g, cam) => {
        // entrance mat leading to the elevator
        const x = 5 * 16 - cam.x;
        for (let y = 2; y <= 6; y++) {
          const yy = y * 16 - cam.y;
          R(ctx, x + 2, yy, 28, 16, '#5a6f8a'); R(ctx, x + 3, yy, 1, 16, '#8aa0bc'); R(ctx, x + 28, yy, 1, 16, '#8aa0bc');
        }
      },
      entities: [
        {
          type: 'npc', id: 'kanri', x: 8, y: 2, dir: 'down', ...KANRI,
          talk: async (g) => {
            const o = speak(KANRI);
            if (lives(g, 'mansion')) {
              await g.say(pick([
                ['おかえりなさい、{name}さん。\n今日もおつかれさまです。', 'ゴミ出しは、月・木の朝ですよ。'],
                ['いつもテレビ、見てますよ。\n孫がね、{name}さんの大ファンなんです。'],
                ['エレベーターで7階へどうぞ。\nなにかあったら、いつでも管理人室へ。'],
              ]), o);
              if (g.state.rent.debt) await g.say(`それと…家賃の未払いが${fmtMoney(g.state.rent.debt)}あるようです。\nスマホの「家計」から、早めにお願いしますね。`, o);
            } else {
              await g.say(['こんにちは。ここは「ドットレジデンス」です。', 'お部屋の見学なら、商店街の「ドット不動産」さんに\n声をかけてくださいね。いい部屋ですよ。'], o);
            }
          },
        },
        { type: 'sign', x: 2, y: 1, talk: async (g) => g.say(lives(g, 'mansion') ? `郵便受けだ。「703 ${g.state.name}」\n…チラシしか入っていない。` : '住人さんの郵便受けがならんでいる。') },
        { type: 'sign', x: 3, y: 1, text: '郵便受けだ。ピカピカにみがかれている。' },
        { type: 'sign', x: 9, y: 1, text: '【管理組合からのお知らせ】\nゴミ出しは月・木の朝です。\n夜おそくは、お静かにお願いします。' },
        { type: 'npc', id: 'mansion_resident', x: 3, y: 4, dir: 'right', look: { ...LOOKS.mom, top: '#ff7eb6' }, name: '住人さん', wander: 1, text: ['あら、こんにちは。', 'このマンション、商店街が近くて便利なのよ。\nお風呂も広いし、言うことなしね。'] },
      ],
      warps: [
        { x: 5, y: 1, room: 'apartment', tx: 7, ty: 8, dir: 'up', sfx: 'door', check: residentsOnly('mansion', KANRI, ['あ、ちょっと待ってください。\nここから先は、住人さん専用なんです。', 'お部屋の見学なら、商店街の\n「ドット不動産」さんに声をかけてくださいね。']) },
      ],
      events: exitEvents('mansion', [5, 6], 7),
    },
    apartment: {
      floor: 'housing_floor_oak',
      wall: 'white',
      tiles: [
        '################',
        '#uuuuuuuuuuuuuu#',
        '#hh=D=======c==#',
        '#kf............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#......G.....T.#',
        '#######M########',
      ],
      legend: {
        h: 'wall_white+housing_kcab', u: 'housing_wallhi_white', D: 'wall_white+housing_bathdoor',
        k: 'kitchen', f: 'fridge', T: 'desk_pc', G: 'housing_floor_genkan',
      },
      entry: { x: 7, y: 8, dir: 'up' },
      entities: [
        // the window (decoration over the wall) and the view
        { type: 'prop', x: 6, y: 1, w: 4, h: 2, solid: false, draw: (ctx, sx, sy) => blit(ctx, sprite('daywin', 64, 32, paintDayWindow), sx, sy), talk: viewDay },
        closetProp(3, 3, { talk: (g) => (lives(g, 'mansion') ? openCloset(g) : g.say('広いクローゼットだ。\n服がたくさん入りそう！')) }),
        bedProp('mansion', 13, 3, paintBedMansion),
        { type: 'prop', x: 1, y: 5, w: 2, draw: (ctx, sx, sy) => blit(ctx, sprite('dining', 32, 22, paintDining), sx, sy + 16 - 22), text: 'ふたりがけのダイニングテーブル。\nだれかとごはんを食べる日も、来るかな。' },
        ...furnitureProps('mansion', MANSION_SLOTS),
      ],
      drawUnder: (ctx, g, cam) => blit(ctx, sprite('mansion_rug', 48, 32, (c) => paintRugModern(c, 96, 64, '#5a8fb0')), 5 * 16 - cam.x, 6 * 16 + 4 - cam.y),
      events: [
        { x: 7, y: 9, on: 'step', run: apartmentDoor('mansion', 5, 2) },
        { x: 1, y: 3, on: 'action', run: (g) => (lives(g, 'mansion') ? cook(g) : g.say('ピカピカのシステムキッチンだ。\n住んだら、自炊がはかどりそう！')) },
        { x: 2, y: 3, on: 'action', run: (g) => g.say(lives(g, 'mansion') ? '大きな冷蔵庫だ。\nスーパーで買った食材がしまってある。' : '大きな冷蔵庫だ。中はまだ空っぽ。') },
        { x: 4, y: 2, on: 'action', run: (g) => (lives(g, 'mansion') ? takeBath(g, { name: 'お風呂', verb: '湯船につかる', stress: HOUSING.mansion.bathStress, lines: ['ゆったり湯船につかった。\nふう…。一日の疲れがとけていく。'] }) : g.say('お風呂場だ。湯船が広い！\nここなら足をのばして入れそう。')) },
        { x: 13, y: 8, on: 'action', run: (g) => (lives(g, 'mansion') ? pcMenu(g) : g.say('モデルルームのパソコンだ。\n住んだら、ここで自主練ができそう。')) },
      ],
      onEnter: (g) => { g.run(() => arrivalLines(g, 'mansion')); },
    },
  },
});
async function viewDay(g) {
  const relax = lives(g, 'mansion') && onceToday(g, 'mansion_viewDay');
  if (relax) g.relax({ stress: 3 });
  await g.say(['大きな窓から、商店街の屋根と\n遠くのビルが見える。', relax ? 'ベランダに出て、のびをひとつ。\n青空が気持ちいい！（ストレス -3）' : 'ベランダの手すりの向こうに、\n青空がひろがっている。']);
}
function paintRugModern(c, w, h, col) {
  R(c, 0, 0, w, h, shade(col, -0.25)); R(c, 2, 2, w - 4, h - 4, col);
  R(c, 6, 6, w - 12, h - 12, shade(col, 0.15)); R(c, 8, 8, w - 16, h - 16, col);
  dither(c, 10, 10, w - 20, h - 20, shade(col, 0.08));
  R(c, 2, 2, w - 4, 1, shade(col, 0.3));
}

// First arrival lines (after moving), and the 内見 tour.
async function arrivalLines(g, id) {
  const h = HOUSING[id];
  if (naikenOf(g) === id) {
    if (g.flag('housing_naikenSeen') !== g.state.day + ':' + id) {
      g.setFlag('housing_naikenSeen', g.state.day + ':' + id);
      await g.say([`（内見中）ここが「${h.name}」の部屋…！`, (h.perks || []).slice(0, 3).map((p) => `・${p}`).join('\n'), '見終わったら、玄関から出よう。\n（間取さんの店にもどる）']);
    }
    return;
  }
  if (lives(g, id) && g.flag('housing_arrived') === id) { await announceDelivery(g, id); return; }
  if (lives(g, id) && g.flag('housing_arrived') !== id) {
    g.setFlag('housing_arrived', id);
    g.sfx('fanfare');
    await g.emote('player', '!');
    await g.say(id === 'tower'
      ? ['ここが新しい家…ドットタワーの最上階！', '窓いっぱいに、街の明かりがひろがっている。\n…ついに、ここまで来たんだ。', 'ジェットバスにキッチン、家具も8つまで置ける。\nさあ、新しい暮らしのはじまりだ！']
      : ['ここが新しい家…ドットレジデンスだ！', '明るくて、広い！湯船のあるお風呂に、\nシステムキッチンまである。', '家具は6つまで置ける。\nさあ、新しい暮らしのはじまりだ！']);
  }
}

// ---------------------------------------------------------------- ドットタワー (tower)
export const TOWER_SLOTS = [
  { x: 4, y: 3 }, // back wall left of the window
  { x: 14, y: 3 }, // back wall right of the window
  { x: 6, y: 3, low: true, win: true }, // under the window
  { x: 12, y: 3, low: true, win: true }, // under the window
  { x: 7, y: 6, low: true }, // living room
  { x: 11, y: 6, low: true }, // living room
  { x: 4, y: 8 }, // bottom wall
  { x: 13, y: 8 }, // bottom wall
];
const TOWER_WIN = { x: 6, w: 8 };
registerPlace({
  id: 'tower',
  name: 'ドットタワー',
  kind: 'building',
  bgm: 'lounge',
  start: { room: 'lobby', x: 7, y: 7, dir: 'up' },
  rooms: {
    lobby: {
      floor: 'floor_marble',
      tiles: [
        '################',
        '#uuuuuuuuuuuuuu#',
        '#=a====EE====a=#',
        '#..............#',
        '#P........KKK.P#',
        '#..............#',
        '#.SS........SS.#',
        '#..............#',
        '#######MM#######',
      ],
      legend: {
        '#': 'housing_ttop', '=': 'housing_twall', u: 'housing_twall_hi', a: 'housing_twall+painting', E: 'elevator',
        K: 'housing_counter_dark', S: 'sofa_beige', P: 'plant',
      },
      drawUnder: (ctx, g, cam) => {
        // carpet runner from the door to the elevators
        for (let y = 3; y <= 7; y++) {
          const x = 7 * 16 - cam.x, yy = y * 16 - cam.y;
          R(ctx, x + 1, yy, 30, 16, '#7a1f2e'); R(ctx, x + 2, yy, 1, 16, '#c9a227'); R(ctx, x + 29, yy, 1, 16, '#c9a227');
          for (let k = 0; k < 16; k += 4) R(ctx, x + 15, yy + k, 2, 2, '#9a2f3e');
        }
      },
      drawOver: (ctx, g, cam) => { drawChandelier(ctx, 4 * 16 - cam.x, 3 * 16 + 10 - cam.y, g); drawChandelier(ctx, 13 * 16 + 8 - cam.x, 3 * 16 + 10 - cam.y, g); },
      entities: [
        { type: 'npc', id: 'concierge', x: 11, y: 3, dir: 'down', ...CONCIERGE, talk: conciergeTalk },
        { type: 'sign', x: 2, y: 2, text: '大きな絵画だ。\n夜明けの海が、やさしい色でえがかれている。' },
        { type: 'sign', x: 13, y: 2, text: '現代アートだ。\n…何をえがいたものかは、よくわからない。' },
        {
          type: 'npc', id: 'tower_resident', x: 3, y: 5, dir: 'right', look: { ...LOOKS.actor, top: '#3b3f48', tie: '#c9a227' }, name: '住人さん',
          talk: (g, npc) => g.say(lives(g, 'tower')
            ? ['こんにちは、{name}さん。\nこの前の番組、拝見しましたよ。', '最上階からの夜景はいかがです？\nがんばった人へのごほうび、ですね。']
            : ['…おや、見学の方ですか？', 'ここの最上階からの夜景は格別ですよ。\nがんばった人へのごほうび、ですね。'], { name: npc.name, look: npc.look }),
        },
      ],
      warps: [
        { x: 7, y: 2, room: 'apartment', tx: 10, ty: 8, dir: 'up', sfx: 'door', check: residentsOnly('tower', CONCIERGE, towerStop()) },
        { x: 8, y: 2, room: 'apartment', tx: 10, ty: 8, dir: 'up', sfx: 'door', check: residentsOnly('tower', CONCIERGE, towerStop()) },
      ],
      events: exitEvents('tower', [7, 8], 8),
    },
    apartment: {
      floor: 'housing_floor_walnut',
      tiles: [
        '####################',
        '#uuuuuuuuuuuuuuuuuu#',
        '#===============CHC#',
        '#bb.............soF#',
        '#bb................#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#Tl.......G........#',
        '##########M#########',
      ],
      legend: {
        '#': 'housing_ttop', '=': 'housing_twall', u: 'housing_twall_hi', C: 'housing_twall+housing_tkcab', H: 'housing_twall+housing_hood',
        b: 'housing_floor_bath', T: 'desk_pc', l: 'plant', G: 'housing_floor_genkan', s: 'housing_tk_sink', o: 'housing_tk_hob', F: 'housing_tk_fridge',
      },
      entry: { x: 10, y: 8, dir: 'up' },
      entities: [
        // panoramic window with curtains
        {
          type: 'prop', x: TOWER_WIN.x, y: 1, w: TOWER_WIN.w, h: 2, solid: false, talk: viewNight,
          draw: (ctx, sx, sy, g) => {
            blit(ctx, sprite('nightwin', TOWER_WIN.w * 16, 32, (c) => paintNightWindow(c, TOWER_WIN.w)), sx, sy);
            animNightWindow(ctx, sx, sy, g, TOWER_WIN.w);
            const cur = sprite('tcurtain', 8, 32, paintCurtain);
            blit(ctx, cur, sx - 6, sy); blit(ctx, cur, sx + TOWER_WIN.w * 16 - 2, sy);
          },
        },
        { type: 'prop', x: 1, y: 3, w: 2, h: 1, draw: (ctx, sx, sy, g) => { blit(ctx, sprite('jacuzzi', 32, 20, paintJacuzzi), sx, sy + 16 - 20); animJacuzzi(ctx, sx, sy + 16 - 20, g); }, talk: towerBath },
        closetProp(3, 3, { talk: (g) => (lives(g, 'tower') ? openCloset(g) : g.say('ウォークインクローゼットだ。\n衣装部屋みたいに広い！')) }),
        { type: 'prop', x: 9, y: 6, w: 2, draw: (ctx, sx, sy) => blit(ctx, sprite('coffee', 32, 16, paintCoffeeTable), sx, sy), text: 'ガラスのローテーブル。\nファッション雑誌が置いてある。' },
        // kitchen island
        { type: 'prop', x: 16, y: 5, w: 2, draw: (ctx, sx, sy) => blit(ctx, sprite('island', 32, 22, paintIsland), sx, sy + 16 - 22), text: '大理石のアイランドキッチン。\nフルーツがかざってある。' },
        bedProp('tower', 17, 7, paintBedTower),
        ...furnitureProps('tower', TOWER_SLOTS),
      ],
      drawUnder: (ctx, g, cam) => blit(ctx, sprite('tower_rug', 80, 40, (c) => paintRugModern(c, 160, 80, '#3a4a7a')), 6 * 16 + 8 - cam.x, 5 * 16 + 4 - cam.y),
      events: [
        { x: 10, y: 9, on: 'step', run: apartmentDoor('tower', 7, 3) },
        { x: 16, y: 3, w: 2, on: 'action', run: (g) => (lives(g, 'tower') ? cook(g) : g.say('大理石のキッチンだ。\nシェフでも呼びたくなる…！')) },
        { x: 18, y: 3, on: 'action', run: (g) => g.say('大きな冷蔵庫だ。\n製氷機までついている！') },
        { x: 1, y: 8, on: 'action', run: (g) => (lives(g, 'tower') ? pcMenu(g) : g.say('窓ぎわのワークデスクだ。\n夜景を見ながらお仕事できそう。')) },
      ],
      onEnter: (g) => { g.run(() => arrivalLines(g, 'tower')); },
    },
  },
});
function towerStop() {
  return ['恐れ入ります。こちらから先は、\n居住者さま専用となっております。', 'お部屋のご見学でしたら、ドット商店街の\n「ドット不動産」さまで承っております。'];
}
async function viewNight(g) {
  const relax = lives(g, 'tower') && onceToday(g, 'tower_viewDay');
  if (relax) g.relax({ stress: 5 });
  await g.say(['窓いっぱいに、街の夜景がひろがっている。\n光の一つひとつに、だれかの暮らしがあるんだ…。', relax ? '（夜景をながめて、心がほどけた。ストレス -5）' : 'いつか、この街のみんなに\n笑顔をとどけられたらいいな。']);
}
async function towerBath(g) {
  if (!lives(g, 'tower')) { await g.say('窓ぎわのジェットバスだ。\n夜景を見ながらお風呂…ぜいたくすぎる！'); return; }
  await takeBath(g, { name: 'ジェットバス', verb: '夜景を見ながら入る', stress: HOUSING.tower.bathStress, stamina: 10, lines: ['ブクブクブク…。\n夜景をながめながら、ジェットバスでのんびり。', '体のしんまで、ぽかぽかだ。'] });
}
const CONCIERGE_GIFTS = ['hanataba', 'cake', 'okashi', 'tea'];
async function conciergeTalk(g) {
  const o = speak(CONCIERGE);
  if (!lives(g, 'tower')) {
    await g.say(['ドットタワーへようこそ。\nわたくし、コンシェルジュでございます。', 'こちらは居住者さま専用のレジデンスです。\nご入居のご相談は「ドット不動産」さまへどうぞ。'], o);
    return;
  }
  for (;;) {
    const k = await g.ask('おかえりなさいませ、{name}さま。\nなにかご用はございますか？', ['お食事のデリバリー', 'ギフトの手配', 'ありがとう'], { ...o, cancel: 2 });
    if (k === 0) {
      if (!g.canEat()) { await g.say('おなかがいっぱいのご様子ですね。\nまたのちほど、お申しつけください。', o); continue; }
      const i = await g.ask('シェフ特製の和定食を、お部屋にお届けします。\n¥3,000（体力 +50）よろしいですか？', ['お願い', 'やめておく'], { ...o, cancel: 1 });
      if (i !== 0) continue;
      if (!g.spend(3000)) { await g.say('恐れ入ります、お代が足りないようです…。', o); continue; }
      const got = g.eat(50, { silent: true, fill: 70 });
      g.relax({ stress: 3 });
      g.sfx('good');
      await g.say(['ほかほかの和定食がとどいた！\nだしのきいたお味噌汁が、しみる…。', `（体力 +${got}・ストレス -3）`]);
    } else if (k === 1) {
      // gifts for friends without a trip to the shopping street (same prices as はなや)
      const goods = CONCIERGE_GIFTS.filter((id) => ITEMS[id]);
      if (!goods.length) { await g.say('恐れ入ります、本日はギフトのお取り扱いがございません…。', o); continue; }
      await g.shop(goods, { title: 'コンシェルジュ ギフト手配', greeting: '大切な方への贈りものを、お届けいたします。' });
    } else {
      await g.say(g.state.rent.debt ? `いってらっしゃいませ。\n…なお、お家賃の未払いが${fmtMoney(g.state.rent.debt)}ございます。\nスマホの「家計」からお願いいたします。` : 'いってらっしゃいませ、{name}さま。', o);
      return;
    }
  }
}

// ================================================================ morning: a nicer home is within reach
onMorning((g) => {
  const st = g.state;
  for (const id of ['mansion', 'tower']) {
    const h = HOUSING[id];
    const key = 'housing_offer_' + id;
    if (g.flag(key) || st.fame < reqFame(h) || HOME_ORDER.indexOf(g.state.housing || 'dotsou') >= HOME_ORDER.indexOf(id)) continue;
    g.setFlag(key, true);
    g.message({
      from: 'ドット不動産', look: AGENT.look, kind: 'news',
      text: `${st.name}さま、ご活躍おめでとうございます！知名度が★${reqFame(h)}に届いたので、「${h.name}」（${h.plan}・家賃${fmtMoney(h.rent)}／週）にご入居いただけます。内見だけでもお気軽に！ドット商店街でお待ちしています。（担当：間取）`,
    });
    break;
  }
});

// ================================================================ morning: heavy rent hint
onMorning((g) => {
  const st = g.state;
  if (lives(g, 'dotsou') || !(st.rent && st.rent.debt) || (st.rent.late || 0) < 2) return;
  if (g.flag('housing_warnWeek') === g.week) return;
  g.setFlag('housing_warnWeek', g.week);
  // safety net: after 4 weeks behind, the agent arranges the move back so the debt stops growing
  if ((st.rent.late || 0) >= 4) {
    const from = g.housing().name;
    g.moveHousing('dotsou');
    g.message({ from: 'ドット不動産', look: AGENT.look, kind: 'news', text: `${from}の家賃が4週続けて払えなかったため、ご契約は終了となりました…。大家さんとお話しして、ドット荘のお部屋をご用意しています。今夜からはドット荘でお休みください。未払いの家賃は、スマホの「家計」から少しずつでも払えます。` });
    g.message({ from: '大家さん', kind: 'chat', text: '{name}ちゃん、おかえり。部屋はちゃんと掃除してあるからね。\nまた一からがんばればいいのよ。' });
    return;
  }
  g.message({ from: 'ドット不動産', look: AGENT.look, kind: 'news', text: `${g.housing().name}の家賃が、${st.rent.late}週続けて払えていないようです…。4週たまると契約終了になってしまいます。無理をせず、家賃¥8,000のドット荘に戻るのも手ですよ。ご相談はドット商店街の店舗まで！` });
});

// ================================================================ music
registerSong('lounge', {
  bpm: 84, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.07, notes: 'E5 . G5 B5 . A5 G5 . | F#5 . A5 . E5 - - . | D5 . F#5 A5 . G5 F#5 . | E5 - - . . . B4 . | C5 . E5 G5 . F#5 E5 . | D5 . F#5 . A5 - G5 . | F#5 . E5 . D#5 . E5 . | B4 - - - . . . .' },
    { wave: 'sine', vol: 0.1, notes: 'E3 . . B3 . . E3 . | A2 . . E3 . . A2 . | D3 . . A3 . . D3 . | G2 . . D3 . . B2 . | C3 . . G3 . . C3 . | D3 . . A3 . . F#3 . | B2 . . F#3 . . B2 . | E3 . . B3 . . E3 .' },
    { wave: 'drum', vol: 0.05, notes: 'h . h h . h h . | h . h h . h s .' },
  ],
});
