// 永田町・霞が関 ('nagatacho'): the government district, north of 東京エリア.
//
// Town (80x56). The center avenue (x 39..41) comes up from Tokyo's north exit (same x) and
// ends at 国会正門前の通り (road rows 20..22). Two more avenues (x 17..19, 60..62) and
// 霞が関の通り (road rows 38..40) cut the district into blocks:
//   N  国会議事堂 (a 27-tile facade, central tower with the stepped pyramid; place 'kokkai'
//      is entered through its central entrance), forecourt, iron fence and main gate
//   NW 議員会館 ×3 (enter the Diet's 議員会館 room when the kokkai place has one), 国会記者会館
//   NE 国会図書館, 国会前庭 (日本水準原点の標庫)
//   B  国会前の歩道 (demonstrators on both sides of the bill of the day, police, reporters),
//      首相官邸 ('kantei', old/new building by year), 自由民主党本部 ('jimin_hq'),
//      民主党本部 ('minshu_hq', only while the party exists; otherwise another tenant),
//      野党の党本部 ('yato_hq': the largest fictional opposition party), the player's party
//      office ('myparty_hq': テナント募集 until the player founds a party), さくら田公園
//   S  警視庁 ('keisatsu'), 検察庁 ('kensatsu'), 裁判所 ('saibansho'), 霞が関の中央省庁 ×4
//      (ministry names by year from politics POSTS), bus stop, the road south to Tokyo
//
// Places entered from here (other modules): kokkai, kantei, jimin_hq, minshu_hq, yato_hq,
// myparty_hq (parties.js), keisatsu, kensatsu, saibansho. A place that is not registered yet
// is simply closed (no error).
// flags (prefix nagatacho_): nagatacho_intro, nagatacho_door (中央玄関の案内),
//   nagatacho_burasagari (day of the last doorstep interview), nagatacho_speech_day.
// Facts (checked 2026-10): 国会議事堂 1920年1月着工・1936年（昭和11年）11月完成、中央塔 65.45m、
//   正面から見て左が衆議院・右が参議院。中央玄関はふだん閉じていて、開会式・選挙後の召集日・
//   外国の元首などの訪問のときだけ開く（「あかずの扉」、扉はブロンズ製で1枚1.1トン）。
//   首相官邸: 旧官邸 1929年竣工、新官邸は2002年4月から（旧官邸は2005年から公邸）。
//   国立国会図書館 1948年設立・納本制度、永田町の本館 1961年第一期・1968年完成。
//   日本水準原点 1891年（明治24年）設置、国会前庭の標庫。原点の高さは 24.4140m（1923年の関東大震災後）
//   → 24.3900m（2011年の東北地方太平洋沖地震のあと改定）。
//   警視庁本部庁舎 1980年竣工、皇居の桜田門の前で「桜田門」とも呼ばれる。
//   議員会館は2010年に新しい建物に（衆議院第一・第二議員会館、参議院議員会館）。
//   千代田区 生活環境条例: 2002年10月施行、翌11月から路上禁煙地区での喫煙に過料2,000円（全国で初めての罰則）。
//   はじめの禁煙地区は8か所（区の約3割）、2010年4月から区内全域。
//   首相官邸の新しい建物の運用は2002年4月から。
// Every politician, demonstrator, reporter and guard here is fictional. 自由民主党 / 民主党 are
// described only with the neutral facts of politics.js (PARTY_DEFS).

import { registerPlace, PLACES } from '../engine/map.js';
import { defineTile, R, P, Rw, disc, oval, outline, shadowEllipse, blobs, speckle } from '../engine/tiles.js';
import { LOOKS, drawChar } from '../engine/sprites.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, VIEW_W, TILE } from '../engine/util.js';
import { grid, set, put, fill, hroad, vroad, border, ekiStairs } from './townkit.js';
import { busStop, fountain, subwayEntrance } from './props.js';
import { cabinetPosts, postName, POLICIES, POLICY_ORDER, SEGMENTS, votingAge } from '../engine/politics.js';
import { registerSmokingRule, lawDate } from '../engine/crime.js';

export const NAGA_W = 80;
export const NAGA_H = 56;
// Tokyo's center avenue (x 38..42) leaves Tokyo at its north edge and arrives here at the
// south edge on the same columns.
export const NAGA_FROM_TOKYO = { y: NAGA_H - 2 };
const DIET = { x: 27, y: 9, w: 27, h: 4, door: 13 };          // facade footprint; door tile (40, 12)
const DOOR = { x: DIET.x + DIET.door, y: DIET.y + DIET.h - 1 };
const BUS = { x: 44, y: 50, arrive: [45, 51] };
// [R9-A] the 地下鉄の出入口 on the ministries' sidewalk, next to the bus stop: a train arrival appears in front of it
const SUBWAY = { x: 49, y: 51 };
export const EKI = { x: SUBWAY.x, y: SUBWAY.y + 2, dir: 'down' };

// ====================================================================== helpers
const who = (n) => ({ name: n.name, look: n.look });
const U = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
let G = null; // the running game (set whenever a script / cond of this town runs)
const game = () => G || (typeof window !== 'undefined' ? window.__game : null) || null;
function pol(g) {
  if (!g || !g.state || typeof g.pol !== 'function') return null;
  try { return g.pol(); } catch (e) { console.error(e); return null; }
}
// The simulated date (calendar year / fractional fiscal year) cached per frame.
const dateCache = { frame: -1, day: -1, d: null };
function pdate(g) {
  g = g || game();
  if (!g || !g.state) return { year: 2026, fy: 2026.3, month: 4 };
  if (dateCache.frame === g.frame && dateCache.day === g.state.day && dateCache.d) return dateCache.d;
  let d = null;
  try { d = g.polDate(); } catch (e) { d = null; }
  if (!d) {
    const era = (g.state.profile && g.state.profile.era) || 'reiwa';
    const y = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 }[era] || 2026;
    d = { year: y, fy: y + 0.3, month: 4 };
  }
  Object.assign(dateCache, { frame: g.frame, day: g.state.day, d });
  return d;
}
const yearOf = (g) => pdate(g).year;
const me = (g) => { const p = pol(g); return p ? p.me : null; };
const isDietMember = (g) => { const m = me(g); return !!(m && (m.office === 'shugi' || m.office === 'sangi')); };
const isPolitician = (g) => { const m = me(g); return !!(m && (m.office || (m.posts && m.posts.length))); };
const inCabinet = (g) => { const p = pol(g); return !!(p && (p.cabinet.pm === 'player' || Object.values(p.cabinet.ministers || {}).includes('player'))); };
const today = (g, k) => g.flag(k) === g.state.day;
// How reporters address the player: 姓 + 議員 / 区長 / 知事 (先生 for a party post only).
const TITLE_OF = { shugi: '議員', sangi: '議員', kugi: '議員', togi: '議員', shicho: '区長', chiji: '知事' };
const honor = (g) => { const m = me(g); return `{familyname}${(m && TITLE_OF[m.office]) || '先生'}`; };

// The party in the player's own office building: the one the player founded (isPlayers)
// or, after the founder left, the last party founded by the player ('my<n>' ids).
export function myPartyOf(g) {
  const p = pol(g);
  if (!p) return null;
  const all = Object.values(p.parties || {});
  return all.find((pt) => pt.isPlayers && pt.leader === 'player') || all.filter((pt) => /^my\d+$/.test(pt.id)).sort((a, b) => (b.founded || 0) - (a.founded || 0))[0] || null;
}
// The largest fictional opposition party (the 'yato_hq' tenant).
export function yatoPartyOf(g) {
  const p = pol(g);
  if (!p) return null;
  const ruling = new Set(p.cabinet.partyIds || []);
  const seats = (id) => (Number(p.diet.shugi.seats[id]) || 0) + (Number(p.diet.sangi.seats[id]) || 0);
  const fict = Object.values(p.parties || {}).filter((pt) => !pt.real && !/^my\d+$/.test(pt.id));
  const opp = fict.filter((pt) => !ruling.has(pt.id));
  const list = (opp.length ? opp : fict).slice().sort((a, b) => seats(b.id) - seats(a.id) || String(a.id).localeCompare(String(b.id)));
  return list[0] || null;
}
export function minshuOpen(g) {
  const p = pol(g);
  return !!(p && p.parties && p.parties.minshu);
}

// Static art painted once on a 2x canvas (1 px = half a unit = 1 screen px).
const baked = new Map();
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (!cv) {
    const [c2, c] = makeCanvas(Math.round(w * 2), Math.round(h * 2));
    try { paint(c); } catch (e) { console.error('[nagatacho] paint failed', key, e); }
    cv = c2;
    baked.set(key, cv);
  }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);

// ====================================================================== HD tiles
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
const RND = (r, n) => Math.floor(r() * n);

// ---- granite paving: large pale slabs with fine grain (the forecourts)
tile('nagatacho_granite', { variants: 6 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#a9a49a');
  const tones = ['#d9d4c9', '#d2cdc1', '#dedad0'];
  const slabs = v % 2 ? [[0, 0, 32, 16], [0, 16, 16, 16], [16, 16, 16, 16]] : [[0, 0, 16, 16], [16, 0, 16, 16], [0, 16, 32, 16]];
  slabs.forEach(([x, y, w, h], i) => {
    const col = tones[(i + v) % 3];
    R(c, x + 1, y + 1, w - 1, h - 1, col);
    R(c, x + 1, y + 1, w - 1, 1, shade(col, 0.08));
    R(c, x + 1, y + h - 1, w - 1, 1, shade(col, -0.08));
    speckle(c, r, [shade(col, -0.07), shade(col, 0.06), '#b9b3a6'], Math.round(w * h / 22), x + 2, y + 2, w - 3, h - 3);
  });
  if (v === 5) { R(c, 14, 14, 4, 4, '#b8a070'); R(c, 15, 15, 2, 2, '#d8c490'); }
});
// ---- granite steps (wide treads, shadow under each nose)
tile('nagatacho_steps', {}, (c, r) => {
  for (let k = 0; k < 4; k++) {
    const y = k * 8;
    R(c, 0, y, 32, 8, '#cfc9bc');
    R(c, 0, y, 32, 2, '#ece7dc');
    R(c, 0, y + 2, 32, 1, '#e0dacd');
    R(c, 0, y + 6, 32, 2, '#a8a294');
    speckle(c, r, ['#bdb6a8', '#dcd6ca'], 10, 0, y + 3, 32, 3);
  }
});
// ---- invisible solid (under the Diet's painted facade)
tile('nagatacho_solid', { solid: true, obj: true }, () => {});
// ---- gravel (官邸・図書館の前庭)
tile('nagatacho_gravel', { variants: 3 }, (c, r) => {
  R(c, 0, 0, 32, 32, '#c9c2b2');
  speckle(c, r, ['#b3ab99', '#ddd6c6', '#a69e8c', '#e8e2d4'], 150);
  for (let i = 0; i < 6; i++) { const x = RND(r, 30), y = RND(r, 30); R(c, x, y, 2, 1, '#9a927f'); P(c, x, y - 1, '#f0ebe0'); }
});
// ---- clipped lawn with mower stripes
tile('nagatacho_lawn', {}, (c, r) => {
  for (let x = 0; x < 32; x += 8) R(c, x, 0, 8, 32, (x / 8) % 2 ? '#6fae55' : '#7cba5e');
  speckle(c, r, ['#5f9a48', '#8cc86c'], 40);
});
// ---- iron fence on a granite curb (the Diet's perimeter)
tile('nagatacho_fence', { solid: true, obj: true }, (c) => {
  R(c, 0, 24, 32, 6, '#c2bcae'); R(c, 0, 24, 32, 1, '#e6e1d6'); R(c, 0, 29, 32, 1, '#8e887a');
  R(c, 0, 9, 32, 2, '#2c2f36'); R(c, 0, 19, 32, 2, '#2c2f36');
  R(c, 0, 9, 32, 1, '#4a4f5a'); R(c, 0, 19, 32, 1, '#4a4f5a');
  for (let x = 2; x < 32; x += 5) {
    R(c, x, 6, 2, 18, '#2c2f36'); P(c, x, 6, '#5a606c');
    R(c, x, 4, 2, 2, '#c8a24a'); P(c, x, 4, '#ecd28a'); P(c, x + 1, 3, '#c8a24a');
  }
});
// ---- granite gate pillar with a bronze lamp
tile('nagatacho_gatepost', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 11, 2);
  R(c, 7, 12, 18, 18, '#d8d2c4'); R(c, 7, 12, 2, 18, '#ece7dc'); R(c, 23, 12, 2, 18, '#aea795');
  R(c, 5, 10, 22, 3, '#c8c1b1'); R(c, 5, 10, 22, 1, '#efeadf');
  R(c, 6, 27, 20, 3, '#b8b1a0');
  R(c, 10, 16, 12, 9, '#cbc4b4'); R(c, 10, 16, 12, 1, '#b2ab9a'); R(c, 10, 24, 12, 1, '#e4dfd3');
  // lamp
  R(c, 14, 6, 4, 4, '#6a5030'); R(c, 12, 1, 8, 6, '#f6e8b0'); R(c, 12, 1, 8, 1, '#5a4228'); R(c, 13, 2, 2, 4, '#fff8dc'); R(c, 15, 0, 2, 1, '#5a4228');
  outline(c);
});
// ---- Japanese black pine (クロマツ), pruned in tiers
tile('nagatacho_pine', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 29, 11, 3);
  const tr = ['#4a3424', '#6a4a30', '#8a6440'];
  for (let i = 0; i < 14; i++) { const x = 14 + Math.round(Math.sin(i / 3 + v) * 2); R(c, x, 16 + i, 4, 1, tr[1]); P(c, x, 16 + i, tr[2]); P(c, x + 3, 16 + i, tr[0]); }
  const pal = ['#1f3f2a', '#2f5a36', '#3f7442', '#5a9050', '#7aac62'];
  const tiers = v ? [[16, 6, 8, 3.5], [10, 12, 6, 3], [22, 15, 6, 3]] : [[16, 5, 7, 3.5], [21, 11, 6, 3], [10, 15, 7, 3]];
  for (const [x, y, rw, rh] of tiers) {
    const lumps = [];
    for (let k = -2; k <= 2; k++) lumps.push([x + k * rw * 0.42, y + Math.abs(k) * 0.4, rh + 0.6 - Math.abs(k) * 0.3]);
    blobs(c, lumps, pal, { bias: -0.02 });
  }
  outline(c);
});
// ---- ginkgo (霞が関のイチョウ並木)
tile('nagatacho_ginkgo', { solid: true, obj: true }, (c, r) => {
  shadowEllipse(c, 16, 29, 11, 3);
  R(c, 14, 20, 4, 9, '#6a4a2c'); R(c, 14, 20, 1, 9, '#8a6440'); R(c, 17, 20, 1, 9, '#4a321c'); R(c, 12, 27, 8, 2, '#5a3e24');
  const pal = ['#2f5a18', '#4a7f22', '#6fa632', '#98c84a', '#c8e47a'];
  blobs(c, [[16, 4, 4.5], [12, 8, 5.5], [20, 8, 5.5], [16, 10, 7], [9, 14, 6], [23, 14, 6], [16, 16, 8], [11, 19, 5], [21, 19, 5]], pal, { bias: -0.02 });
  outline(c);
  for (let i = 0; i < 9; i++) { const x = 6 + RND(r, 20), y = 2 + RND(r, 18); P(c, x, y, pal[4]); P(c, x + 1, y + 1, pal[3]); }
});
// ---- bamboo (官邸の竹の庭)
tile('nagatacho_bamboo', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 2, 26, 28, 4, 'rgba(0,0,0,0.18)');
  const stalks = v ? [5, 12, 18, 25] : [3, 9, 16, 22, 28];
  for (const x of stalks) {
    const top = 1 + ((x * 7) % 5);
    R(c, x, top, 3, 29 - top, '#6fae4a'); R(c, x, top, 1, 29 - top, '#9ad06a'); R(c, x + 2, top, 1, 29 - top, '#4a8a34');
    for (let y = top + 5; y < 29; y += 7) R(c, x - 1, y, 5, 1, '#3f7a2a');
  }
  for (let i = 0; i < 14; i++) { const x = RND(r, 30), y = RND(r, 20); R(c, x, y, 3, 1, i % 2 ? '#5fa040' : '#8cc860'); }
  outline(c, { tint: 0.4 });
});
// ---- national flag on a pole (animated)
tile('nagatacho_flag', { solid: true, obj: true, frames: 3, speed: 18 }, (c, r, f) => {
  shadowEllipse(c, 16, 30, 6, 2);
  R(c, 13, 27, 6, 3, '#b8b1a0'); R(c, 13, 27, 6, 1, '#e0dbcf');
  R(c, 15, 1, 2, 27, '#d8dce4'); P(c, 15, 1, '#ffffff'); R(c, 15, 0, 2, 1, '#c8a24a');
  const wave = [0, 1, 0][f];
  for (let x = 0; x < 13; x++) {
    const dy = Math.round(Math.sin((x + f * 3) / 3) * 1) + (x > 8 ? wave : 0);
    R(c, 17 + x, 2 + dy, 1, 9, '#ffffff');
    P(c, 17 + x, 10 + dy, '#d8dce4');
  }
  disc(c, 23, 6 + Math.round(Math.sin((6 + f * 3) / 3)), 2.6, '#d4202c');
  outline(c, { tint: 0.3 });
});
// ---- police crowd barrier (鉄柵)
tile('nagatacho_barrier', { solid: true, obj: true }, (c) => {
  R(c, 1, 27, 30, 2, 'rgba(0,0,0,0.2)');
  R(c, 1, 12, 30, 2, '#d8dde6'); R(c, 1, 12, 30, 1, '#ffffff');
  R(c, 1, 22, 30, 2, '#9aa3b2');
  for (let x = 3; x < 31; x += 4) R(c, x, 14, 1, 8, '#b8c0cc');
  for (const x of [2, 28]) { R(c, x, 10, 2, 18, '#7a8496'); R(c, x - 2, 27, 6, 1, '#5a6272'); }
  R(c, 8, 15, 16, 5, '#f4f0e0'); R(c, 8, 15, 16, 1, '#2a3560'); R(c, 8, 19, 16, 1, '#2a3560');
  for (let x = 10; x < 23; x += 3) R(c, x, 17, 2, 1, '#2a3560');
  outline(c, { tint: 0.3 });
});
// ---- guard booth (立番の詰所)
tile('nagatacho_booth', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 11, 2);
  R(c, 7, 6, 18, 23, '#eef0f2'); R(c, 7, 6, 2, 23, '#ffffff'); R(c, 23, 6, 2, 23, '#c4c8d0');
  R(c, 5, 3, 22, 4, '#3a4a6a'); R(c, 5, 3, 22, 1, '#5a6a8a');
  R(c, 10, 9, 12, 8, '#6f8aa8'); R(c, 10, 9, 12, 1, '#3a4a6a'); R(c, 11, 10, 3, 3, '#c8daf0');
  R(c, 10, 19, 12, 2, '#d62f2f');
  R(c, 13, 21, 6, 8, '#9aa2ae');
  outline(c);
});
// ---- low stone wall (官邸の外周)
tile('nagatacho_stonewall', { solid: true, obj: true }, (c, r) => {
  R(c, 0, 12, 32, 18, '#bdb5a3');
  for (let row = 0; row < 3; row++) {
    const y = 13 + row * 6, off = row % 2 ? 8 : 0;
    for (let x = -off; x < 32; x += 16) {
      const col = ['#d2cab8', '#c8c0ad', '#dad3c2'][RND(r, 3)];
      Rw(c, x + 1, y, 15, 5, col); Rw(c, x + 1, y, 15, 1, shade(col, 0.1)); Rw(c, x + 1, y + 4, 15, 1, shade(col, -0.1));
    }
  }
  R(c, 0, 10, 32, 3, '#e4ddcc'); R(c, 0, 10, 32, 1, '#f4efe4');
  R(c, 0, 29, 32, 1, '#8e8674');
});
// ---- stone plaque (説明板)
tile('nagatacho_plaque', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 10, 2);
  R(c, 6, 8, 20, 18, '#3a3a40'); R(c, 6, 8, 20, 1, '#6a6a74'); R(c, 6, 8, 1, 18, '#5a5a64');
  R(c, 8, 10, 16, 14, '#4a4a52');
  for (let y = 12; y < 23; y += 3) R(c, 10, y, 12, 1, '#c8c0a0');
  R(c, 10, 26, 3, 3, '#5a5a62'); R(c, 19, 26, 3, 3, '#5a5a62');
  outline(c);
});

// ====================================================================== the Diet (国会議事堂)
// Facade painted at 2x; footprint 27x4 tiles (432 x 64 units). Art spans x -4..436 and
// y -92..68 units relative to the footprint's top-left (tower top at -88).
const DOX = 4, DOY = 92, DW = 440, DH = 162;
function paintDiet(c) {
  const px = (u) => Math.round(u * 2);
  const B = (x, y, w, h, col) => { const x0 = px(x + DOX), y0 = px(y + DOY); R(c, x0, y0, px(x + DOX + w) - x0, px(y + DOY + h) - y0, col); };
  const STONE = '#e2dbca', LIGHT = '#f3eee2', MID = '#cfc7b4', DARK = '#aaa18c', DEEP = '#857c68';
  const GLASS = '#3f4c62', GLASS2 = '#5a6c88', ROOF = '#8f9188';
  const win = (x, y, w, h) => {
    B(x - 0.5, y - 0.5, w + 1, h + 1, LIGHT);
    B(x, y, w, h, GLASS);
    B(x, y, w, 1, '#2c3648');
    B(x + 0.5, y + 1, 1, h - 2, GLASS2);
    B(x - 0.5, y + h, w + 1, 1, DARK);
  };
  const cornice = (x, y, w) => { B(x - 1, y, w + 2, 3, LIGHT); B(x - 1, y + 3, w + 2, 1, MID); B(x - 1, y + 4, w + 2, 1, DARK); };
  const wallBlock = (x, y, w, h) => {
    B(x, y, w, h, STONE);
    for (let k = y + 6; k < y + h; k += 6) B(x, k, w, 0.5, shade(STONE, -0.04));
    B(x, y, 1.5, h, LIGHT);
    B(x + w - 1.5, y, 1.5, h, MID);
  };
  const pilaster = (x, y, h) => { B(x, y, 4, h, LIGHT); B(x + 3, y, 1, h, MID); B(x - 0.5, y, 5, 1.5, '#fbf7ee'); B(x - 0.5, y + h - 1.5, 5, 1.5, MID); };
  const column = (x, y, h) => {
    B(x - 1, y, 6, 2, LIGHT); B(x - 1, y + 2, 6, 0.5, DARK);
    B(x, y + 2.5, 4, h - 5, '#f1ebdf'); B(x, y + 2.5, 1, h - 5, '#fffaf0'); B(x + 3, y + 2.5, 1, h - 5, MID); B(x + 1.5, y + 2.5, 0.5, h - 5, '#e4ddcf');
    B(x - 1, y + h - 2.5, 6, 2.5, MID); B(x - 1, y + h - 2.5, 6, 0.5, LIGHT);
  };

  // ---- wings (whole width), roof band and cornice
  B(0, -8, 432, 4, ROOF); B(0, -8, 432, 1, '#b2b4aa'); B(0, -5, 432, 1, '#73756c');
  wallBlock(0, 0, 432, 58);
  cornice(0, -4, 432);
  B(0, 18, 432, 1, LIGHT); B(0, 19, 432, 0.5, MID);
  B(0, 38, 432, 1, LIGHT); B(0, 39, 432, 0.5, MID);
  for (let x = 6; x < 428; x += 10) {
    if ((x > 140 && x < 292) || x < 48 || x > 380) continue;
    win(x, 5, 4.5, 10); win(x, 23, 4.5, 11); win(x, 43, 4.5, 10);
  }
  // mid pavilions (slightly forward, with pilasters)
  for (const x0 of [96, 304]) {
    B(x0 - 2, -12, 36, 4, ROOF); B(x0 - 2, -12, 36, 1, '#b2b4aa');
    wallBlock(x0, -8, 32, 66); cornice(x0, -8, 32);
    for (let k = 0; k < 3; k++) pilaster(x0 + 3 + k * 11, -3, 59);
    for (let k = 0; k < 2; k++) { win(x0 + 9 + k * 11, 2, 4, 13); win(x0 + 9 + k * 11, 22, 4, 13); win(x0 + 9 + k * 11, 42, 4, 11); }
    B(x0 + 31, -8, 1, 66, DARK);
  }
  // end pavilions
  for (const x0 of [0, 386]) {
    B(x0 - 1, -18, 48, 4, ROOF); B(x0 - 1, -18, 48, 1, '#b2b4aa'); B(x0 - 1, -15, 48, 1, '#73756c');
    wallBlock(x0, -14, 46, 72); cornice(x0, -14, 46);
    B(x0 + 4, -9, 38, 3, MID); B(x0 + 4, -9, 38, 1, LIGHT);
    for (let k = 0; k < 5; k++) pilaster(x0 + 3 + k * 9.5, -5, 61);
    for (let k = 0; k < 4; k++) { win(x0 + 8.5 + k * 9.5, 0, 3.5, 15); win(x0 + 8.5 + k * 9.5, 22, 3.5, 13); win(x0 + 8.5 + k * 9.5, 42, 3.5, 11); }
    B(x0 + (x0 ? 0 : 45), -14, 1, 72, x0 ? LIGHT : DARK);
  }
  // ---- central block
  B(146, -30, 140, 4, ROOF); B(146, -30, 140, 1, '#b2b4aa'); B(146, -27, 140, 1, '#73756c');
  wallBlock(148, -26, 136, 84);
  cornice(148, -26, 136);
  B(150, -21, 132, 3, MID); B(150, -21, 132, 1, LIGHT);
  for (const x0 of [150, 252]) for (let k = 0; k < 3; k++) { pilaster(x0 + 2 + k * 10.5, -17, 75); }
  for (const x0 of [150, 252]) for (let k = 0; k < 2; k++) { win(x0 + 8 + k * 10.5, -12, 4, 14); win(x0 + 8 + k * 10.5, 10, 4, 16); win(x0 + 8 + k * 10.5, 36, 4, 16); }
  B(148, -26, 1, 84, LIGHT); B(283, -26, 1, 84, DARK);
  // portico: attic, entablature, eight columns, the bronze doors behind
  B(182, -16, 68, 12, MID); B(182, -16, 68, 1.5, LIGHT); B(184, -13, 64, 7, STONE);
  for (let k = 0; k < 8; k++) B(187 + k * 8, -11, 3, 3, DARK);
  B(180, -4, 72, 8, LIGHT); B(180, -4, 72, 1, '#fffaf0'); B(180, 3, 72, 1, DARK); B(182, 0, 68, 1, MID);
  B(184, 4, 64, 48, '#b9b09c');
  B(184, 4, 64, 2, DEEP);
  B(204, 18, 24, 34, '#5a4126'); B(204, 18, 24, 1, '#3a2814');
  B(205, 19, 11, 33, '#7a5a34'); B(216.5, 19, 10.5, 33, '#6a4c2a');
  for (let y = 22; y < 50; y += 7) { B(206, y, 9, 4, '#8a6a3e'); B(217.5, y, 8.5, 4, '#7a5c34'); }
  B(215.5, 19, 1, 33, '#3a2814');
  for (let k = 0; k < 8; k++) column(184.5 + k * 8.6, 4, 48);
  // steps
  for (let k = 0; k < 3; k++) { const ww = 76 + k * 8; B(216 - ww / 2, 52 + k * 4, ww, 4, k % 2 ? '#d6d0c2' : '#e4dfd2'); B(216 - ww / 2, 52 + k * 4, ww, 1, '#f6f2e8'); B(216 - ww / 2, 55 + k * 4, ww, 1, '#aaa392'); }
  // ---- plinth all along
  B(0, 58, 432, 6, MID); B(0, 58, 432, 1, LIGHT); B(0, 63, 432, 1, DEEP);
  for (let x = 0; x < 432; x += 12) B(x, 59, 0.5, 4, DARK);
  B(180, 52, 72, 12, '#e4dfd2'); for (let k = 0; k < 3; k++) { const ww = 76 + k * 8; B(216 - ww / 2, 52 + k * 4, ww, 4, k % 2 ? '#d6d0c2' : '#e4dfd2'); B(216 - ww / 2, 52 + k * 4, ww, 1, '#f6f2e8'); }
  // ---- the central tower: shaft with a colonnade, cornice, stepped pyramid, lantern
  const TX = 188, TW = 56;
  wallBlock(TX, -56, TW, 30);
  B(TX - 2, -60, TW + 4, 4, LIGHT); B(TX - 2, -57, TW + 4, 1, DARK);
  B(TX - 2, -28, TW + 4, 2, MID);
  for (let k = 0; k < 4; k++) pilaster(TX + 2 + k * 16, -55, 27);
  for (let k = 0; k < 3; k++) { B(TX + 8 + k * 16, -52, 6, 22, '#4a586e'); B(TX + 8 + k * 16, -52, 6, 1, '#2c3648'); B(TX + 9 + k * 16, -51, 1, 20, '#6f84a0'); }
  B(TX, -56, 1, 30, LIGHT); B(TX + TW - 1, -56, 1, 30, DARK);
  for (let k = 0; k < 9; k++) {
    const w = 60 - k * 6.5, y = -63 - k * 2.9, x = 216 - w / 2;
    B(x, y, w, 3, k % 2 ? '#d9d2c0' : '#d2cab6');
    B(x, y, w, 0.5, '#f6f1e6');
    B(x + w - 2, y, 2, 3, '#b3aa95');
    B(x, y + 2.5, w, 0.5, '#9a917c');
  }
  B(212, -83, 8, 4, '#e6e0d2'); B(212, -83, 8, 0.5, '#fbf8f0'); B(218, -83, 2, 4, '#b3aa95');
  B(213.5, -86, 5, 3, '#d8d1c0'); B(215, -88, 2, 2, '#c8c0ac');
  outline(c, { tint: 0.18 });
}
function dietProp() {
  return {
    type: 'prop', x: DIET.x, y: DIET.y, w: DIET.w, h: DIET.h, solid: false, z: 0.1,
    draw(ctx, sx, sy) {
      blit(ctx, bake('diet', DW, DH, paintDiet), sx - DOX, sy - DOY);
    },
  };
}

// ---- 日本水準原点の標庫 (a small Roman-temple-style stone house), 2x2 tiles
function paintSuijun(c) {
  const S = '#ddd6c6', L = '#f1ece0', D = '#a59c88';
  R(c, 4, 34, 56, 26, S); R(c, 4, 34, 56, 2, L);
  for (let k = 0; k < 4; k++) { const x = 8 + k * 14; R(c, x, 36, 5, 22, L); R(c, x + 4, 36, 1, 22, D); }
  R(c, 2, 28, 60, 6, L); R(c, 2, 33, 60, 1, D);
  for (let k = 0; k < 16; k++) R(c, 32 - k * 2, 12 + k, k * 4, 1, k % 3 ? S : L);
  R(c, 2, 27, 60, 1, D);
  R(c, 26, 42, 12, 16, '#5a4a32'); R(c, 27, 43, 10, 1, '#8a7450');
  R(c, 0, 58, 64, 4, '#b8b09c'); R(c, 0, 58, 64, 1, L);
  outline(c, { tint: 0.2 });
}
function suijunProp(x, y) {
  return {
    type: 'prop', x, y, w: 2, h: 2,
    draw(ctx, sx, sy) { blit(ctx, bake('suijun', 32, 31, paintSuijun), sx, sy + 1); },
    talk: async (g) => {
      const yr = yearOf(g);
      const h = yr >= 2011 ? '24.3900' : '24.4140';
      await g.say(['「日本水準原点」の標庫だ。', '日本じゅうの土地の高さ（標高）は、ここが基準。\n1891年（明治24年）に置かれた原点だ。', `原点の高さは、東京湾の平均海面から ${h}メートル。\n${yr >= 2011 ? '2011年の大地震のあと、測り直されたそうだ。' : '関東大震災のあと、測り直されたそうだ。'}`]);
    },
  };
}

// ---- TV relay van (中継車), 3x1 tiles
function paintVan(c) {
  R(c, 2, 14, 90, 22, '#f4f4f6'); R(c, 2, 14, 90, 2, '#ffffff');
  R(c, 2, 26, 90, 4, '#2f6fd0'); R(c, 2, 30, 90, 2, '#1f4fa0');
  R(c, 70, 16, 18, 9, '#3f4c62'); R(c, 71, 17, 6, 3, '#8fa4c8');
  R(c, 8, 18, 50, 6, '#e4e6ea');
  R(c, 2, 36, 90, 3, '#2a2d36');
  for (const x of [16, 72]) { disc(c, x, 38, 5, '#20232a'); disc(c, x, 38, 2, '#9aa0aa'); }
  // dish and mast
  R(c, 30, 6, 2, 8, '#9aa0aa'); oval(c, 20, 0, 22, 10, '#e4e6ea'); oval(c, 22, 2, 18, 6, '#cfd3da'); R(c, 30, 4, 2, 2, '#5a606c');
  outline(c, { tint: 0.3 });
}
function vanProp(x, y) {
  return {
    type: 'prop', x, y, w: 3, h: 1,
    draw(ctx, sx, sy) { blit(ctx, bake('van', 47, 22, paintVan), sx, sy - 6); },
    text: ['テレビ局の中継車だ。', '屋根の大きなパラボラアンテナで、\n国会の前から生中継をしているらしい。'],
  };
}

// ---- wooden signpost to Tokyo
function signpost(x, y, label, txt) {
  return {
    type: 'prop', x, y, w: 1, h: 1, text: txt,
    draw(ctx, sx, sy) {
      U(ctx, sx + 3, sy + 14.5, 10, 1.5, 'rgba(0,0,0,0.22)');
      U(ctx, sx + 7, sy - 4, 2.5, 19, '#4a2e18'); U(ctx, sx + 7.5, sy - 4, 1, 19, '#8a5a33');
      U(ctx, sx - 7.5, sy - 10.5, 31, 10, '#3a2512');
      U(ctx, sx - 7, sy - 10, 30, 9, '#c48a52'); U(ctx, sx - 7, sy - 10, 30, 1, '#e0b07a');
      for (let k = 0; k < 4; k++) U(ctx, sx + 6 + k, sy - 1 + k, 4 - k * 0.5, 1, '#3a2512');
      text(ctx, label, sx + 8, sy - 8.5, { size: 5, align: 'center', color: '#fff6e0', shadow: '#3a2512' });
    },
  };
}

// ---- a held banner (横断幕) above a row of people; the text changes with the bill of the day
function bannerProp(x, y, w, side) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false, z: 2,
    draw(ctx, sx, sy, g) {
      G = g;
      const t = demoTopic(g);
      const label = !t ? (side === 'no' ? '増税反対！' : '行政改革を！') : side === 'no' ? `${t.short}に反対！` : t.bill ? `${t.short}に賛成！` : `${t.short}の実現を！`;
      const W = w * TILE - 8, bx = sx + 4, by = sy - 17;
      U(ctx, bx - 1.5, by - 2, 1.5, 22, '#6a4a2c'); U(ctx, bx + W, by - 2, 1.5, 22, '#6a4a2c');
      U(ctx, bx, by, W, 10, '#22202a');
      U(ctx, bx + 0.5, by + 0.5, W - 1, 9, side === 'no' ? '#fff4e8' : '#eef6ff');
      U(ctx, bx + 0.5, by + 0.5, W - 1, 1, side === 'no' ? '#d84a3a' : '#2f6fd0');
      U(ctx, bx + 0.5, by + 8.5, W - 1, 1, side === 'no' ? '#d84a3a' : '#2f6fd0');
      const size = Math.max(4, Math.min(6, Math.floor((W - 4) / Math.max(1, Array.from(label).length) * 2) / 2));
      text(ctx, label, bx + W / 2, by + 5 - size / 2, { size, align: 'center', color: side === 'no' ? '#b8281c' : '#1f4fa0', shadow: null });
    },
  };
}
// A demonstrator holding a small placard over the head.
function placardSprite(word, col) {
  return (ctx, x, y, g, e) => {
    drawChar(ctx, e.sheet, e.dir, 0, x, y);
    const bob = Math.floor(((g.frame + (e.x * 17)) % 120) / 60) ? 0 : -0.5;
    U(ctx, x + 7.5, y - 10 + bob, 1, 8, '#6a4a2c');
    U(ctx, x + 1.5, y - 19 + bob, 13, 10, '#22202a');
    U(ctx, x + 2, y - 18.5 + bob, 12, 9, '#ffffff');
    U(ctx, x + 2, y - 18.5 + bob, 12, 1, col);
    text(ctx, word, x + 8, y - 17 + bob, { size: 5, align: 'center', color: col, shadow: null });
  };
}

// ---- speech stand (お立ち台: a beer crate with a microphone stand)
function speechStand(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1, talk: speechSpot,
    draw(ctx, sx, sy) {
      U(ctx, sx + 2, sy + 14.5, 12, 1.5, 'rgba(0,0,0,0.22)');
      U(ctx, sx + 2, sy + 6, 12, 9, '#22202a');
      U(ctx, sx + 2.5, sy + 6.5, 11, 8, '#2f6fd0'); U(ctx, sx + 2.5, sy + 6.5, 11, 1, '#5f8fe6');
      for (let k = 0; k < 3; k++) U(ctx, sx + 4 + k * 3.5, sy + 9, 2, 3, '#1f4fa0');
      U(ctx, sx + 12, sy - 6, 1, 12, '#3b3f48'); U(ctx, sx + 11, sy - 7.5, 3, 2, '#20232a'); U(ctx, sx + 11.5, sy - 7, 1, 0.5, '#9aa0aa');
    },
  };
}

// ====================================================================== the bill of the day
// Demonstrators on both sides: the pending bill (cabinet bills first), else a policy from the
// hottest issue. Cached per day: { policy, short, bill }.
const demoCache = { key: '', topic: null };
const shortName = (s) => { const t = String(s || '').replace(/（[^）]*）/g, '').replace(/「|」/g, '').trim(); return Array.from(t).length > 14 ? Array.from(t).slice(0, 13).join('') + '…' : t; };
function demoTopic(g) {
  if (!g || !g.state) return null;
  const key = `${g.state.day}`;
  if (demoCache.key === key) return demoCache.topic;
  let topic = null;
  try {
    const p = pol(g);
    if (p) {
      const bills = (g.billsList({ pending: true }) || []).filter((b) => b.policy && POLICIES[b.policy] && !['budget', 'noconfidence'].includes(b.kind));
      const b = bills.find((x) => x.sponsor === 'cabinet' && x.stage !== 'draft') || bills.find((x) => x.stage !== 'draft');
      if (b) topic = { policy: b.policy, short: shortName(POLICIES[b.policy].name), bill: true, title: b.title };
      else {
        const issues = Object.entries(p.opinion.issues || {}).sort((a, c) => c[1] - a[1]);
        for (const [area] of issues) {
          const id = POLICY_ORDER.find((k) => POLICIES[k].area === area && POLICIES[k].kind === 'law' && !g.policyBlock(k));
          if (id) { topic = { policy: id, short: shortName(POLICIES[id].name), bill: false, title: POLICIES[id].name }; break; }
        }
      }
    }
  } catch (e) { console.error(e); topic = null; }
  demoCache.key = key;
  demoCache.topic = topic;
  return topic;
}
// Who gains / who bears the cost, in plain words (from the policy's segment effects).
function sides(g, policyId) {
  let pv = null;
  try { pv = g.policyPreview(policyId); } catch (e) { pv = null; }
  const segs = Object.entries((pv && pv.segments) || {}).filter(([s]) => SEGMENTS[s]);
  const win = segs.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => SEGMENTS[s].name);
  const lose = segs.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([s]) => SEGMENTS[s].name);
  return { win, lose, cost: pv ? pv.cost : 0 };
}
// The title on a line of its own (a long bill title would wrap in the message window).
const demoTitle = (t) => (Array.from(t.title || '').length > 32 ? t.short : t.title);
async function demoNo(g, npc) {
  G = g;
  const t = demoTopic(g);
  if (!t) { await g.say(['増税には反対です！', '…今日は、国会で大きな法案はないみたいだけど。\n声を上げ続けることが大事なんです。'], who(npc)); return; }
  const s = sides(g, t.policy);
  const worry = s.lose.length ? `${s.lose.join('や')}の負担が重くなると思うんです。` : s.cost > 0 ? '財源をどうするのか、まだ説明が足りないと思うんです。' : '進め方が急すぎると思うんです。';
  await g.say([
    `「${demoTitle(t)}」\n${t.bill ? 'いま国会で審議中のこの法案に' : 'この政策に'}、反対しています。\n${worry}`,
    '賛成の人たちの言い分も、わからなくはない。\nだからこそ、国会でちゃんと議論してほしいんです。',
  ], who(npc));
}
async function demoYes(g, npc) {
  G = g;
  const t = demoTopic(g);
  if (!t) { await g.say(['行政改革を進めてほしくて、ここに来ました。', '反対の人とも、ここでは静かに並んでいます。\nお互いさまですからね。'], who(npc)); return; }
  const s = sides(g, t.policy);
  const good = s.win.length ? `${s.win.join('や')}にとって、必要な政策だと思います。` : 'この国の将来のために、必要だと思います。';
  await g.say([
    `「${demoTitle(t)}」\n${t.bill ? 'この法案の早期成立' : 'この政策の実現'}を求めています。\n${good}`,
    '反対する人たちの心配も、わかります。\nよりよい形で決めてほしいですね。',
  ], who(npc));
}

// ====================================================================== scripts
// The effect part of an activity result ('委員会で質問をした。評判 +2・…' -> '（評判 +2・…）').
const effects = (r) => { const [first, ...rest] = String((r && r.text) || '').split('\n'); const t = first.replace(/^[^。]*をした。/, '').trim(); return (t ? `（${t}）` : '') + (rest.length ? `\n${rest.join('\n')}` : ''); };
// Camera pan over the Diet (the facade is taller than the screen around the player).
async function panDiet(g, lines = null) {
  G = g;
  const m = g.map;
  if (!m || m.placeId !== 'nagatacho') { if (lines) await g.say(lines); return; }
  const veil = { hd: true, hidesHud: true, update() {}, draw() {} };
  g.push(veil);
  const from = { x: m.cam.x, y: m.cam.y };
  const to = { x: (DIET.x + DIET.w / 2) * TILE - VIEW_W / 2, y: DIET.y * TILE - 100 };
  const N = g.auto ? 4 : 50;
  for (let i = 1; i <= N; i++) {
    const k = i / N, e = k * k * (3 - 2 * k);
    m.cam.x = Math.round(from.x + (to.x - from.x) * e);
    m.cam.y = Math.round(from.y + (to.y - from.y) * e);
    m.camOverride = { x: m.cam.x, y: m.cam.y };
    await g.waitFrames(1);
  }
  await g.waitFrames(g.auto ? 1 : 30);
  if (lines) await g.say(lines);
  for (let i = 1; i <= N; i++) {
    const k = i / N, e = k * k * (3 - 2 * k);
    m.cam.x = Math.round(to.x + (from.x - to.x) * e);
    m.cam.y = Math.round(to.y + (from.y - to.y) * e);
    m.camOverride = { x: m.cam.x, y: m.cam.y };
    await g.waitFrames(1);
  }
  m.camOverride = null;
  g.pop(veil);
}
function dietLines(g) {
  const yr = yearOf(g);
  const age = yr - 1936;
  return [
    '国会議事堂。\n日本の法律と予算を決める、国権の最高機関の建物だ。',
    `完成は1936年（昭和11年）。17年がかりで建てられ、\nもう${age}年、ここに立っている。`,
    '正面から見て左が衆議院、右が参議院。\nまん中の塔は、高さ65.45メートルある。',
  ];
}
async function plaqueTalk(g) {
  G = g;
  const i = await g.ask(['説明板だ。「国会議事堂」と書いてある。'], ['議事堂をながめる', 'やめておく'], { cancel: 1 });
  if (i === 0) await panDiet(g, dietLines(g));
}

// The Diet's central entrance (step event on the door tile). The kokkai place itself handles
// the 初登院 (its 'elected' hook); here only the first visit gets a word about the closed door.
async function enterDiet(g) {
  G = g;
  if (!PLACES.kokkai) {
    await g.say(['中央玄関の大きな扉は、閉まっている。', '（議事堂の中は、まだ見学の準備中のようだ）']);
    await g.movePlayer('down');
    return;
  }
  if (!g.flag('nagatacho_door') && !g.flag('kokkai_firstday')) {
    g.setFlag('nagatacho_door', true);
    await g.say(['中央玄関の扉は、ふだん閉じている「あかずの扉」。', `${isDietMember(g) ? '衛視さんに会釈して、議員の入口から中へ入った。' : '衛視さんに、見学（参観）の入口へ案内してもらった。'}`]);
  }
  await g.enterPlace('kokkai');
}

// A building whose place may not be registered yet (another module) is closed politely.
const enterIf = (pid, closed) => async (g) => {
  G = g;
  if (!PLACES[pid]) { await g.say(closed); await g.movePlayer('down'); return; }
  await g.enterPlace(pid);
};

// 議員会館: a Diet member's office is the kokkai place's 議員会館 room (when it has one).
function kaikanRoom() {
  const k = PLACES.kokkai;
  if (!k || !k.rooms) return null;
  return Object.keys(k.rooms).find((id) => /kaikan/i.test(id)) || null;
}
const enterKaikan = (house) => async (g) => {
  G = g;
  const m = me(g);
  const room = kaikanRoom();
  const S = { name: '会館の受付', look: { ...LOOKS.receptionist, top: '#3a4a6a' } };
  if (m && m.office === house && room) {
    await g.say(`（${house === 'shugi' ? '衆議院の議員会館' : '参議院議員会館'}。自分の事務所へ向かった。\n　会館と議事堂は、地下の通路でつながっている）`);
    await g.goto('kokkai', room, 8, 8, 'up');
    return;
  }
  if (m && (m.office === 'shugi' || m.office === 'sangi')) {
    await g.say([`先生の事務所は、${m.office === 'shugi' ? '衆議院の第一・第二議員会館' : '参議院議員会館'}ですよ。`, '（となりの建物だった）'], S);
    await g.movePlayer('down');
    return;
  }
  await g.say('議員会館の受付だ。');
  await g.say('議員とのお約束はありますか？\n面会のかたは、議員の事務所の確認がとれてから\nお通しします。', S);
  await g.say('（国会議員の事務所が入る建物だ。\n　議員になれば、ここに自分の事務所を持てる）');
  await g.movePlayer('down');
};

// 首相官邸: guarded. Politicians, and stars invited for a courtesy call (★2000).
async function enterKantei(g) {
  G = g;
  if (!PLACES.kantei) { await g.say('門は固く閉ざされている。'); await g.movePlayer('down'); return; }
  const sp = { name: '警備の警察官', look: POLICE };
  if (isPolitician(g) || inCabinet(g)) { await g.say('「お疲れさまです。どうぞ」', sp); await g.enterPlace('kantei'); return; }
  if ((g.state.fame || 0) >= 2000) {
    await g.say(['「…{fullname}さんですね。\n　表敬訪問のお約束、うかがっております」', '「どうぞ、お入りください」'], sp);
    g.setFlag('kantei_guest', g.state.day);
    await g.enterPlace('kantei');
    return;
  }
  await g.say(['「こちらは総理大臣官邸です。\n　お約束のないかたは、お通しできません」', '（政治家になるか、もっと有名になれば…\n　中に入れる日が来るかもしれない）'], sp);
  await g.movePlayer('down');
}

async function takeBus(g) {
  G = g;
  const dests = [{ label: '東京駅前', place: 'tokyo', x: 53, y: 31 }];
  if (PLACES.machi) dests.push({ label: 'ドット商店街', place: 'machi', x: 38, y: 20, flag: 'machi_intro' });
  if (PLACES.minato) dests.push({ label: 'テレビ局エリア', place: 'minato', x: 35, y: 28, flag: 'minato_intro' });
  if (PLACES.kanraku) dests.push({ label: 'ネオン街', place: 'kanraku', x: 35, y: 9, flag: 'kanraku_intro' }); // same stop as tokyo.js's bus
  const i = await g.ask('バス停だ。\nどこ行きのバスに乗る？（¥210）', [...dests.map((d) => d.label), 'やめておく'], { cancel: dests.length });
  if (i < 0 || i >= dests.length) return;
  const d = dests[i];
  if (!g.spend(210)) { await g.say('運賃が足りない…。\n歩いていこう。（中央の通りを南へ行けば東京エリア）'); return; }
  g.sfx('coin');
  const first = d.flag && !g.flag(d.flag); // that town's first-visit lines describe the arrival
  await g.fadeOut(16);
  g.sfx('door');
  await g.wait(600);
  await g.goto(d.place, 'main', d.x, d.y, 'down');
  if (!first) await g.say(`ブロロロ…。\n${d.label}でバスを降りた。`);
}

// 街頭演説: the player's own speech when running in an election, else a fictional member's.
async function speechSpot(g) {
  G = g;
  const e = typeof g.myElection === 'function' ? g.myElection() : null;
  if (e) {
    const i = await g.ask(['駅前の演説スポットだ。\n人通りが多い。'], ['街頭演説をする', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    const r = await g.campaign('街頭演説', { electionId: e.id });
    await g.say(r && r.ok ? ['ビールケースの上に立って、マイクを握った。', `足を止めて聞いてくれる人がいた。\n${effects(r)}`] : (r && r.why) || 'いまは演説できない。');
    return;
  }
  const pt = yatoPartyOf(g);
  const p = pol(g);
  const name = pt && p && p.npcs[pt.leader] ? p.npcs[pt.leader].name.split(' ')[0] : '若手';
  await g.say([`${pt ? pt.name : '野党'}の${name}議員が、街頭演説をしている。`, '「みなさんの声を、国会へ届けます！\n　賛成の人も、反対の人も、まずは聞いてください！」', '（選挙に立候補したら、ここで演説ができそうだ）']);
}

// 番記者 / ぶら下がり: a politician answers a few questions (once a day).
async function reporterTalk(g, npc) {
  G = g;
  const p = pol(g);
  const S = who(npc);
  if (!isPolitician(g)) {
    const n = p && p.news && p.news[0] ? p.news[0].text : null;
    await g.say([n ? `いまの永田町の話題？\n「${n.slice(0, 30)}」ってところかな。` : '今日の永田町は、わりと静かだね。', g.state.fame >= 1000 ? 'あれ、{name}さん？\n…政界進出のうわさ、本当ですか？（笑）' : '国会記者会館から、毎日ここに通ってるんだ。'], S);
    return;
  }
  if (today(g, 'nagatacho_burasagari')) { await g.say('先ほどはありがとうございました！\nまたお話、聞かせてください。', S); return; }
  const i = await g.ask([`${honor(g)}、ひと言お願いします！\n（記者たちが集まってきた。ぶら下がり取材だ）`], ['丁寧に答える', '短く答える', 'ノーコメント'], { cancel: 2, ...S });
  g.setFlag('nagatacho_burasagari', g.state.day);
  if (i === 2) { await g.say('「ノーコメントです」\n…記者たちは、少し不満そうだ。', S); return; }
  const score = i === 0 ? 45 + (g.state.skills.talk || 0) * 0.5 : 55;
  const r = g.activity('記者会見', { score });
  await g.say(r && r.ok ? (i === 0 ? `質問のひとつひとつに、言葉を選んで答えた。\n${effects(r)}` : `要点だけ、短く答えた。\n${effects(r)}`) : (r && r.why) || '今日はもう十分話した。');
}

// The ministries row: names by year from the cabinet posts (politics.js).
const MIN_ORDER = ['外務', '財務', '大蔵', '経済産業', '通商産業', '厚生労働', '厚生', '文部科学', '文部', '国土交通', '運輸', '建設', '農林水産', '総務', '自治', '郵政', '労働', '環境', '防衛', '内閣府', '経済企画', '科学技術', '国土', '北海道開発', '沖縄開発', '総務庁', '行政管理', '復興', 'デジタル', '国家公安'];
function ministryName(post) {
  if (!post || post === '内閣官房長官' || post === '内閣総理大臣') return null;
  if (/^経済財政|^内閣府/.test(post)) return '内閣府';
  if (/国家公安委員会/.test(post)) return '国家公安委員会・警察庁';
  if (post === '復興大臣') return '復興庁';
  if (post === 'デジタル大臣') return 'デジタル庁';
  return post.replace(/大臣$/, '省').replace(/長官$/, '');
}
export function ministriesOf(g) {
  const d = pdate(g);
  const p = pol(g);
  let posts = [];
  try { posts = cabinetPosts(d.fy, (p && p.flags) || {}); } catch (e) { posts = []; }
  const out = [];
  for (const id of posts) { const n = ministryName(postName(id, d.fy)); if (n && !out.includes(n)) out.push(n); }
  const rank = (n) => { const k = MIN_ORDER.findIndex((m) => n.startsWith(m)); return k < 0 ? 99 : k; };
  return out.sort((a, b) => rank(a) - rank(b));
}
const MIN_BLDG = 4;
function ministriesIn(g, k) { return ministriesOf(g).filter((_, i) => i % MIN_BLDG === k); }
// The 案内図 at the arrival point (the party HQs change with the era and the player's own party).
async function mapSignTalk(g) {
  G = g;
  const left = ['自由民主党本部', ...(minshuOpen(g) ? ['民主党本部'] : [])];
  const yato = yatoPartyOf(g), mine = myPartyOf(g);
  const right = [...(yato ? [`${yato.name}本部`] : []), ...(mine ? [`${mine.name}本部`] : [])];
  await g.say([
    '「永田町・霞が関」の案内図だ。',
    `↑ 国会議事堂・議員会館・国立国会図書館\n　通りの左手に ${left.join('・')}${right.length ? `\n　右手に ${right.join('・')}` : ''}`,
    '← 裁判所・検察庁・警視庁、その先の角を北へ首相官邸\n→ 霞が関の官庁街・公園\n↓ 東京エリア（バス停は右手）',
  ]);
}
function ministryBuilding(k, x, y, w, extra = {}) {
  return {
    type: 'building', x, y, w, h: 6, door: Math.floor(w / 2), kind: 'office', rise: 2,
    wall: ['#e4e0d6', '#dcd8ce', '#e8e2d4', '#d8d6d0'][k], roof: '#5a606c', glass: '#7fa6c8', texture: k % 2 ? 'tile' : 'concrete', signH: 16,
    get name() { return ministriesIn(game(), k)[0] || '中央合同庁舎'; },
    get sign() { const n = ministriesIn(game(), k)[0] || '中央合同庁舎'; return { text: n.length > 7 ? n.replace(/・.*$/, '') : n, bg: '#f6f4ee', color: '#2a2d36' }; },
    talk: async (g) => {
      G = g;
      const list = ministriesIn(g, k);
      const yr = yearOf(g);
      await g.say([
        `霞が関の官庁街。この庁舎に入っているのは…\n${list.slice(0, 3).join('・') || '（いまは空いている）'}${list.length > 3 ? `\n${list.slice(3, 6).join('・')}` : ''}`,
        yr < 2001 ? '（2001年1月に省庁が再編されると、\n　名前や組み合わせが大きく変わる）' : yr < 2003 ? '（2001年1月の中央省庁再編で、1府12省庁になったばかりだ）' : '「関係者以外の立入りはご遠慮ください」\n…中は役所の仕事場だ。',
      ]);
    },
    ...extra,
  };
}

// ====================================================================== looks
const POLICE = { hair: 'cap', hat: '#1f2a4a', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#1f2a4a', tie: '#20232a' };
const SP = { hair: 'short', hairColor: 'black', skin: 'fair', top: '#22252e', bottom: '#22252e', jacket: true, tie: '#5a1f2a' };
const EISHI = { hair: 'cap', hat: '#20232a', hairColor: 'black', skin: 'tan', top: '#2a2d36', bottom: '#20232a', tie: '#8a6a2a' };
const REPORTER = { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8e6e0', bottom: '#3a3f55', jacket: true, skirt: false };
const REPORTER2 = { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#2a2d36', jacket: true, glasses: true };
const KANRYO = { ...LOOKS.salaryman, top: '#2f3442', bottom: '#2f3442', tie: '#3a5a9a', glasses: true };

// ====================================================================== the town
function generate() {
  const W = NAGA_W, H = NAGA_H;
  const c = grid(W, H, 'grass');
  const P2 = (x, y, obj) => put(c, x, y, obj);
  const treeRow = (x0, y0, x1, y1, k = 0) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(c, x, y, 'grass', ['tree', 'nagatacho_pine', 'tree', 'bush'][(x * 3 + y * 5 + k) % 4]); };

  // ---- roads: 国会正門前の通り (rows 20..22), 霞が関の通り (rows 38..40), three avenues
  hroad(c, 20, 1, W - 2);
  hroad(c, 38, 1, W - 2);
  vroad(c, 17, 1, H - 2);
  vroad(c, 60, 1, H - 2);
  vroad(c, 39, 23, H - 2);
  for (const x of [15, 21, 58, 64]) for (const y0 of [20, 38]) for (let y = y0; y <= y0 + 2; y++) set(c, x, y, 'crosswalk_h');
  for (const x of [37, 43]) for (let y = 38; y <= 40; y++) set(c, x, y, 'crosswalk_h');
  for (let x = 39; x <= 41; x++) for (let y = 20; y <= 22; y++) set(c, x, y, 'crosswalk_h');
  for (const y of [17, 35, 43]) for (const x0 of [17, 60]) for (let x = x0; x < x0 + 3; x++) set(c, x, y, 'crosswalk_v');
  for (let x = 39; x <= 41; x++) set(c, x, 43, 'crosswalk_v');
  border(c, 'tree');
  // south exit to Tokyo (same columns as Tokyo's center avenue)
  for (let x = 38; x <= 42; x++) set(c, x, H - 1, x === 38 || x === 42 ? 'sidewalk' : x === 40 ? 'road_line_v' : 'road');

  // ================================================================ N: 国会議事堂
  treeRow(21, 1, 58, 8, 1);
  fill(c, DIET.x, DIET.y, DIET.w, DIET.h, 'nagatacho_granite', 'nagatacho_solid');
  set(c, DOOR.x, DOOR.y, 'nagatacho_steps');
  for (const x0 of [21, 54]) for (let x = x0; x < x0 + 6 && x <= 58; x++) for (let y = 9; y <= 12; y++) set(c, x, y, 'grass', (x + y) % 3 ? 'hedge' : 'nagatacho_pine');
  fill(c, 21, 13, 38, 5, 'nagatacho_granite');
  for (let x = 36; x <= 44; x++) set(c, x, 13, 'nagatacho_steps');
  // lawns with pines either side of the approach
  for (const [x0, x1] of [[22, 34], [46, 57]]) {
    fill(c, x0, 14, x1 - x0 + 1, 3, 'nagatacho_lawn');
    for (const x of [x0 + 2, x0 + 6, x0 + 10]) if (x <= x1) P2(x, 15, 'nagatacho_pine');
  }
  for (const x of [35, 45]) { P2(x, 14, 'lamp'); P2(x, 16, 'lamp'); }
  P2(21, 13, 'nagatacho_flag'); P2(58, 13, 'nagatacho_flag');
  set(c, 34, 17, 'nagatacho_granite', 'nagatacho_plaque');
  // fence and main gate
  for (let x = 21; x <= 58; x++) if (x < 37 || x > 43) P2(x, 18, 'nagatacho_fence');
  P2(37, 18, 'nagatacho_gatepost'); P2(43, 18, 'nagatacho_gatepost');
  for (let x = 38; x <= 42; x++) set(c, x, 18, 'nagatacho_granite');

  // ================================================================ NW: 議員会館, 国会記者会館
  treeRow(1, 1, 15, 2, 2);
  fill(c, 1, 3, 15, 16, 'nagatacho_granite');
  for (const x of [5, 10, 15]) for (let y = 3; y <= 8; y++) set(c, x, y, 'grass', y % 2 ? 'nagatacho_ginkgo' : 'bush');
  for (let x = 10; x <= 15; x++) for (let y = 11; y <= 13; y++) set(c, x, y, 'grass', (x + y) % 3 ? 'tree' : 'bush');
  P2(15, 16, 'lamp'); P2(1, 17, 'vending'); P2(9, 17, 'trash');

  // ================================================================ NE: 国会図書館, 国会前庭
  treeRow(64, 1, 78, 2, 3);
  fill(c, 64, 3, 15, 16, 'nagatacho_gravel');
  fill(c, 64, 9, 15, 2, 'nagatacho_granite');
  fill(c, 64, 11, 15, 7, 'grass');
  for (let x = 64; x <= 78; x++) set(c, x, 14, 'path');
  for (let y = 11; y <= 17; y++) set(c, 71, y, 'path');
  for (const [x, y] of [[65, 11], [77, 11], [65, 17], [77, 17], [74, 12], [66, 16]]) P2(x, y, (x + y) % 2 ? 'nagatacho_pine' : 'tree');
  for (const [x, y] of [[67, 12], [76, 16], [73, 16], [68, 16]]) set(c, x, y, 'flowers');
  P2(69, 15, 'bench'); P2(73, 15, 'bench');
  fill(c, 64, 18, 15, 1, 'nagatacho_granite');

  // ================================================================ B: 国会前の歩道 (demonstrations)
  fill(c, 21, 24, 17, 2, 'nagatacho_granite');
  fill(c, 43, 24, 16, 2, 'nagatacho_granite');
  for (const x of [36, 44]) P2(x, 25, 'nagatacho_barrier');

  // ================================================================ B west: 首相官邸
  for (let x = 1; x <= 15; x++) for (let y = 24; y <= 26; y++) set(c, x, y, 'grass', (x + y) % 2 ? 'nagatacho_bamboo' : 'hedge');
  fill(c, 1, 27, 15, 9, 'nagatacho_gravel');
  for (let y = 27; y <= 32; y++) for (const x of [1, 2, 14, 15]) set(c, x, y, 'grass', 'nagatacho_bamboo');
  fill(c, 6, 33, 5, 3, 'nagatacho_granite');
  for (let x = 1; x <= 15; x++) if (x < 7 || x > 9) P2(x, 36, 'nagatacho_stonewall');
  P2(6, 36, 'nagatacho_gatepost'); P2(10, 36, 'nagatacho_gatepost');
  for (let x = 7; x <= 9; x++) set(c, x, 36, 'nagatacho_granite');
  P2(3, 34, 'nagatacho_flag'); P2(13, 34, 'nagatacho_booth');

  // ================================================================ B center: party headquarters
  fill(c, 21, 26, 17, 11, 'nagatacho_granite');
  fill(c, 43, 26, 16, 11, 'nagatacho_granite');
  for (const x of [21, 31]) P2(x, 35, 'nagatacho_ginkgo');
  for (const x of [43, 51, 58]) P2(x, 35, 'nagatacho_ginkgo');
  P2(31, 30, 'nagatacho_ginkgo'); P2(31, 32, 'bush');
  P2(51, 30, 'nagatacho_ginkgo'); P2(51, 32, 'bush');
  P2(58, 27, 'vending');

  // ================================================================ B east: さくら田公園
  fill(c, 64, 24, 15, 13, 'grass');
  for (let x = 64; x <= 78; x++) { set(c, x, 30, 'path'); }
  for (let y = 24; y <= 36; y++) set(c, 71, y, 'path');
  fill(c, 69, 28, 5, 5, 'path');
  for (let x = 64; x <= 78; x++) if (x !== 71) { P2(x, 24, 'hedge'); }
  for (const [x, y] of [[65, 26], [77, 26], [65, 34], [77, 34], [67, 33], [75, 27], [68, 25], [74, 35]]) P2(x, y, (x + y) % 3 ? 'tree' : 'sakura');
  for (const [x, y] of [[66, 28], [76, 32], [67, 27], [75, 33], [76, 28]]) set(c, x, y, 'flowers');
  for (const x of [66, 68, 74, 76]) P2(x, 31, 'bench');
  P2(64, 36, 'trash'); P2(78, 29, 'vending');

  // ================================================================ S: 警視庁・検察庁・裁判所・中央省庁
  fill(c, 1, 42, 15, 13, 'nagatacho_granite');
  fill(c, 21, 42, 17, 13, 'nagatacho_granite');
  fill(c, 43, 42, 16, 13, 'nagatacho_granite');
  fill(c, 64, 42, 15, 13, 'nagatacho_granite');
  for (const x of [1, 14, 15]) for (let y = 42; y <= 48; y++) set(c, x, y, 'grass', y % 2 ? 'tree' : 'bush');
  set(c, 2, 49, 'nagatacho_granite', 'nagatacho_booth');
  for (const x of [22, 26, 30, 34]) P2(x, 52, 'nagatacho_ginkgo');
  for (const x of [48, 52, 56, 66, 70, 74, 78]) P2(x, 52, 'nagatacho_ginkgo');
  for (const x of [4, 8, 12]) P2(x, 52, 'nagatacho_ginkgo');
  for (const x of [24, 32, 54, 68, 72]) P2(x, 53, 'bench'); // [R9-A] (the bench at x 50 made way for the 地下鉄の出入口)
  P2(29, 49, 'nagatacho_barrier');
  // a green strip along the south edge, planters along the party HQ fronts
  for (let x = 1; x <= 78; x++) {
    if ((x >= 16 && x <= 20) || (x >= 36 && x <= 44) || (x >= 59 && x <= 63)) continue;
    if (x % 5 === 0) set(c, x, 54, 'grass', 'bush'); else set(c, x, 54, x % 3 === 1 ? 'flowers' : 'grass');
  }
  for (const x of [23, 29, 46, 56]) P2(x, 36, 'planter');
  for (const x of [5, 11]) P2(x, 51, 'planter');
  P2(21, 50, 'vending'); P2(58, 50, 'trash');

  // ---- street lamps
  for (const x of [4, 13, 26, 32, 48, 54, 68, 74]) { P2(x, 19, 'lamp'); P2(x, 37, 'lamp'); }
  P2(37, 53, 'sign_board');
  for (const y of [6, 30, 46]) { P2(16, y, 'lamp'); P2(63, y, 'lamp'); }

  // ================================================================ entities
  // the present 官邸 is used from April 2002 (pdate gives the month)
  const kanteiOld = (g) => { const d = pdate(g); return d.year < 2002 || (d.year === 2002 && (d.month || 4) < 4); };
  const kaikanNew = (g) => yearOf(g) >= 2010;
  const KAIKAN = (x, label, full, house) => [false, true].map((isNew) => ({
    type: 'building', x, y: 3, w: 4, h: 6, door: 2, place: null, name: full, kind: 'office', rise: isNew ? 3 : 1,
    wall: isNew ? '#d8d5cc' : '#cfc6b4', roof: isNew ? '#4a5260' : '#6a6458', glass: isNew ? '#7fa6c8' : '#8fb0c8', texture: isNew ? 'stone' : 'tile', signH: 14,
    sign: { text: label, bg: '#f4f2ec', color: '#2a2d36' },
    cond: (g) => { G = g; return kaikanNew(g) === isNew; },
    enter: enterKaikan(house),
    talk: async (g) => { G = g; await g.say([`${full}だ。`, '国会議員ひとりひとりの事務所が入っている。\n入口は建物の正面だ。']); },
  }));
  const entities = [
    dietProp(),
    { type: 'building', x: DOOR.x, y: DOOR.y, w: 1, h: 1, door: 0, place: 'kokkai', name: '国会議事堂', hidden: true },
    // ---- 議員会館 (the building entity needs a place for its door to work: enter() decides)
    ...KAIKAN(1, '第一議員会館', '衆議院第一議員会館', 'shugi').map((b) => ({ ...b, place: 'kokkai_kaikan1' })),
    ...KAIKAN(6, '第二議員会館', '衆議院第二議員会館', 'shugi').map((b) => ({ ...b, place: 'kokkai_kaikan2' })),
    ...KAIKAN(11, '参議院議員会館', '参議院議員会館', 'sangi').map((b) => ({ ...b, place: 'kokkai_kaikan3' })),
    { type: 'building', x: 2, y: 12, w: 7, h: 5, door: 3, name: '国会記者会館', kind: 'office', wall: '#e6e2d8', roof: '#5a6070', sign: { text: '国会記者会館', bg: '#ffffff', color: '#2a2d36' }, signH: 14,
      text: ['国会記者会館だ。', '新聞社やテレビ局の政治部の記者が、\nここを拠点に国会を取材している。'] },
    { type: 'building', x: 65, y: 3, w: 12, h: 6, door: 6, name: '国立国会図書館', kind: 'office', wall: '#d8d2c4', roof: '#4a4e58', glass: '#6f8aa8', texture: 'tile', sign: { text: '国立国会図書館', bg: '#f4f2ec', color: '#2a2d36' }, signH: 16, signW: 96,
      text: ['国立国会図書館だ（1948年設立）。', '国会議員の調査を助けるための図書館で、\n日本で出版された本は、ここに納めることになっている。', '（納本制度というそうだ。…今日は閲覧だけの日らしい）'] },
    // ---- 首相官邸 (old building until 2002, the present one after)
    { type: 'building', x: 3, y: 27, w: 11, h: 6, door: 5, place: 'kantei', name: '総理大臣官邸', kind: 'hotel', wall: '#c9a476', roof: '#5a4430', texture: 'tile', glass: '#8fa0b0', sign: { text: '総理大臣官邸', bg: '#efe6d4', color: '#3a2a1a' }, signH: 14, canopy: '#5a4430',
      cond: (g) => { G = g; return kanteiOld(g); }, enter: enterKantei },
    { type: 'building', x: 3, y: 27, w: 11, h: 6, door: 5, place: 'kantei', name: '総理大臣官邸', kind: 'office', wall: '#d9d6ce', roof: '#3f444e', glass: '#7fa6c8', texture: 'stone', sign: { text: '総理大臣官邸', bg: '#e8e6e0', color: '#2a2d36' }, signH: 14, canopy: '#3f444e', plants: true,
      cond: (g) => { G = g; return !kanteiOld(g); }, enter: enterKantei },
    // ---- party headquarters
    { type: 'building', x: 22, y: 27, w: 9, h: 7, door: 4, place: 'jimin_hq', name: '自由民主党本部', kind: 'office', wall: '#e8e4da', roof: '#4a5058', glass: '#8fb4d0', logo: 'jimin', signW: 26, signH: 38, signBg: '#ffffff' },
    { type: 'building', x: 32, y: 28, w: 6, h: 6, door: 3, place: 'minshu_hq', name: '民主党本部', kind: 'office', wall: '#ecebe6', roof: '#5a5f6a', glass: '#8fb4d0', logo: 'minshu', signW: 24, signH: 30, signBg: '#ffffff',
      cond: (g) => { G = g; return minshuOpen(g); } },
    { type: 'building', x: 32, y: 28, w: 6, h: 6, door: 3, name: '永田町ビル', kind: 'office', wall: '#e4e2dc', roof: '#5a5f6a', glass: '#8fb4d0', sign: { text: '永田町ビル', bg: '#f4f4f0', color: '#3a3f4a' }, signH: 14,
      cond: (g) => { G = g; return !minshuOpen(g); },
      talk: async (g) => { G = g; const y = yearOf(g); await g.say(['オフィスビル「永田町ビル」だ。', y < 1998 ? '政治団体や法律事務所が入っているらしい。' : '（ここには以前、民主党の本部があった。\n　1998年に結成され、2016年に党名を改めた政党だ）']); } },
    { type: 'building', x: 44, y: 28, w: 7, h: 6, door: 3, place: 'yato_hq', kind: 'office', wall: '#ece8e0', roof: '#4a5060', glass: '#8fb4d0', signH: 16,
      get name() { const pt = yatoPartyOf(game()); return pt ? `${pt.name}本部` : '党本部'; },
      get sign() { const pt = yatoPartyOf(game()); return { text: pt ? `${pt.short}党 本部`.replace('党党', '党') : '党本部', bg: pt ? pt.color : '#3a5a9a', color: '#ffffff' }; } },
    { type: 'building', x: 52, y: 28, w: 6, h: 6, door: 3, place: 'myparty_hq', name: '貸しオフィス', kind: 'office', wall: '#e6e4de', roof: '#6a6e78', glass: '#9ab4c8', signH: 14,
      sign: { text: 'テナント募集', bg: '#ffffff', color: '#d62f2f' },
      cond: (g) => { G = g; return !myPartyOf(g); } },
    { type: 'building', x: 52, y: 28, w: 6, h: 6, door: 3, place: 'myparty_hq', kind: 'office', wall: '#f0eee8', roof: '#4a4e58', glass: '#8fb4d0', signH: 14, plants: true,
      get name() { const pt = myPartyOf(game()); return pt ? `${pt.name}本部` : '党本部'; },
      get sign() { const pt = myPartyOf(game()); return { text: pt ? pt.name : '党本部', bg: pt ? pt.color : '#e05a8a', color: '#ffffff' }; },
      get canopy() { const pt = myPartyOf(game()); return pt ? pt.color : '#e05a8a'; },
      cond: (g) => { G = g; return !!myPartyOf(g); } },
    // ---- police, prosecutors, courts
    { type: 'building', x: 3, y: 43, w: 10, h: 6, door: 5, place: 'keisatsu', name: '警視庁', kind: 'office', rise: 3, wall: '#e2ded4', roof: '#4a505c', glass: '#7f9fbf', texture: 'tile', sign: { text: '警視庁', bg: '#ffffff', color: '#1f2a4a' }, signH: 16, canopy: '#2a3560',
      enter: enterIf('keisatsu', ['警視庁の正面玄関だ。', '「ご用件のあるかたは、受付へ」\n…いまは中に用はなさそうだ。']) },
    { type: 'building', x: 22, y: 43, w: 7, h: 6, door: 3, place: 'kensatsu', name: '検察庁', kind: 'office', rise: 2, wall: '#ddd8cc', roof: '#4a4e58', glass: '#7f9fbf', texture: 'stone', sign: { text: '検察庁', bg: '#f4f2ec', color: '#2a2d36' }, signH: 14,
      enter: enterIf('kensatsu', ['法務省・検察庁の庁舎だ。', '「関係者以外の立入りはご遠慮ください」']) },
    { type: 'building', x: 30, y: 43, w: 8, h: 6, door: 4, place: 'saibansho', name: '裁判所', kind: 'office', rise: 1, wall: '#d6d0c2', roof: '#4a4440', glass: '#8a9aaa', texture: 'stone', sign: { text: '裁判所', bg: '#f4f2ec', color: '#2a2d36' }, signH: 14,
      enter: enterIf('saibansho', ['裁判所だ。', '（裁判は原則として公開されていて、だれでも傍聴できる。\n　…でも今日は、閉廷しているようだ）']) },
    ministryBuilding(0, 44, 43, 7),
    ministryBuilding(1, 52, 43, 7),
    ministryBuilding(2, 64, 43, 7),
    ministryBuilding(3, 72, 43, 7),

    // ---- props
    suijunProp(68, 11),
    vanProp(11, 15),
    fountain(70, 28, { text: ['公園の噴水だ。', 'お昼どきは、霞が関で働く人たちの\n休けいの場所になっている。'] }),
    bannerProp(25, 25, 6, 'no'),
    bannerProp(47, 25, 6, 'yes'),
    busStop(BUS.x, BUS.y, { text: undefined, talk: takeBus }),
    signpost(43, H - 2, '東京エリア', ['道しるべだ。', '↓ 東京エリア\n（東京駅・NHK・事務所・ドット荘）\nこの中央の通りを南へまっすぐ。', '東京エリアの北の出口から、\nここ「永田町・霞が関」に通じている。']),
    { type: 'sign', x: 37, y: 53, talk: mapSignTalk },
    { type: 'sign', x: 34, y: 17, talk: plaqueTalk },

    // ---- people: 国会の正門
    { type: 'npc', id: 'naga_eishi1', x: 37, y: 19, dir: 'down', look: EISHI, name: '衛視さん',
      talk: async (g, npc) => { G = g; await g.say(['国会議事堂の中央玄関は、ふだん閉じています。', '開くのは、天皇陛下をお迎えする開会式や、\n選挙のあとの国会の召集日、外国の元首の訪問のときだけ。', 'それで「あかずの扉」と呼ばれているんですよ。\n扉はブロンズ製で、1枚1.1トンもあるんです。'], who(npc)); } },
    { type: 'npc', id: 'naga_eishi2', x: 43, y: 19, dir: 'down', look: EISHI, name: '衛視さん',
      talk: async (g, npc) => {
        G = g;
        const i = await g.ask(['ようこそ。国会の見学（参観）ですか？', '中へは、正面の階段を上がった入口からどうぞ。'], ['議事堂をながめたい', 'ありがとう'], { cancel: 1, ...who(npc) });
        if (i === 0) await panDiet(g, dietLines(g));
      } },
    { type: 'npc', id: 'naga_student', x: 30, y: 13, dir: 'up', look: { ...LOOKS.kid, top: '#2a3560', bottom: '#2a3560' }, name: '修学旅行の生徒', wander: 2,
      text: ['修学旅行で、国会の見学に来ました！', '本会議場の天井、すっごく高いんだって！\n…先生、まだかなあ。'] },
    { type: 'npc', id: 'naga_teacher', x: 32, y: 13, dir: 'left', look: { ...LOOKS.salaryman, top: '#5a4a3a', bottom: '#3b3f48', tie: '#8a3a2a', glasses: true }, name: '引率の先生',
      talk: async (g, npc) => { G = g; const p = pol(g); let age = 18; try { age = votingAge(yearOf(g), (p && p.flags) || {}); } catch (e) { age = 18; } await g.say(['はい、みんな集まってー！\n…あ、すみません。', `国会の見学は、修学旅行の定番なんです。\n${age}歳になれば、みんなも投票できるからね。`], who(npc)); } },
    // ---- people: 国会前の歩道
    { type: 'npc', id: 'naga_demo_no1', x: 25, y: 25, dir: 'down', look: { hair: 'short', hairColor: 'gray', skin: 'fair', top: '#7a5a3a', bottom: '#3b3f48', glasses: true }, name: '集会の参加者', talk: demoNo },
    { type: 'npc', id: 'naga_demo_no2', x: 30, y: 25, dir: 'down', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#d86a4a', bottom: '#3a4a7a' }, name: '集会の参加者', talk: demoNo },
    { type: 'npc', id: 'naga_demo_no3', x: 23, y: 24, dir: 'down', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#8a5ac8', bottom: '#2a2d36' }, name: '集会の参加者', talk: demoNo, sprite: placardSprite('反対', '#c8281c') },
    { type: 'npc', id: 'naga_demo_no4', x: 33, y: 24, dir: 'down', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#3a7a5a', bottom: '#2a2d36' }, name: '集会の参加者', sprite: placardSprite('反対', '#c8281c'),
      text: ['デモや集会は、憲法で保障された表現の自由。', 'ルールを守って、平和的にやる。\nそれがいちばん大事なんです。'] },
    { type: 'npc', id: 'naga_demo_yes1', x: 47, y: 25, dir: 'down', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#3a4a6a', bottom: '#2a2d36', jacket: true, tie: '#2f6fd0' }, name: '集会の参加者', talk: demoYes },
    { type: 'npc', id: 'naga_demo_yes2', x: 52, y: 25, dir: 'down', look: { hair: 'bob', hairColor: 'black', skin: 'fair', top: '#5fa8d8', bottom: '#3b3f48', skirt: true }, name: '集会の参加者', talk: demoYes },
    { type: 'npc', id: 'naga_demo_yes3', x: 45, y: 24, dir: 'down', look: { hair: 'short', hairColor: 'brown', skin: 'light', top: '#e8b84a', bottom: '#3a4a7a' }, name: '集会の参加者', talk: demoYes, sprite: placardSprite('賛成', '#1f4fa0') },
    { type: 'npc', id: 'naga_demo_yes4', x: 55, y: 24, dir: 'down', look: { hair: 'bald', hairColor: 'gray', skin: 'tan', top: '#6a7a8a', bottom: '#3b3f48' }, name: '集会の参加者', sprite: placardSprite('賛成', '#1f4fa0'),
      text: ['向こうの人たちとは、意見がちがう。\nでも、言いたいことがあるのはお互いさまだ。', '決めるのは国会。\n選ぶのは、わたしたち有権者だよ。'] },
    { type: 'npc', id: 'naga_police1', x: 37, y: 24, dir: 'left', look: POLICE, name: '警察官',
      text: ['ここは国会の前です。\n集会は、決められた場所で平和的にお願いします。', '車道には出ないでくださいね。'] },
    { type: 'npc', id: 'naga_police2', x: 43, y: 24, dir: 'right', look: POLICE, name: '警察官',
      text: ['ご苦労さまです。', '賛成の人も反対の人も、ここでは同じ。\n安全に声を上げられるようにするのが、私たちの仕事です。'] },
    { type: 'npc', id: 'naga_reporter1', x: 36, y: 26, dir: 'down', look: REPORTER, name: '政治部の記者', talk: reporterTalk },
    { type: 'npc', id: 'naga_camera', x: 35, y: 26, dir: 'right', look: LOOKS.cameraman, name: 'カメラマン',
      text: ['国会前から中継です。', '両方の集会を、同じ時間ずつ撮るようにしてるんだ。\n報道は、公平が基本だからね。'] },
    // ---- people: 首相官邸
    { type: 'npc', id: 'naga_sp1', x: 6, y: 37, dir: 'down', look: SP, name: '警備の人', text: '……（無言で、まわりに目を配っている）' },
    { type: 'npc', id: 'naga_sp2', x: 10, y: 37, dir: 'down', look: SP, name: '警備の人', text: '……（耳のイヤホンに、手を当てた）' },
    { type: 'npc', id: 'naga_banki', x: 12, y: 37, dir: 'left', look: REPORTER2, name: '総理番の記者',
      talk: async (g, npc) => {
        G = g;
        const p = pol(g);
        if (p && p.cabinet.pm === 'player') {
          await g.say(['あっ、総理！　おはようございます！', `内閣支持率は${g.approval()}%。\n…今日のご予定、少しだけ教えていただけませんか？`, '（記者たちが、ぞろぞろとついてきた）'], who(npc));
          return;
        }
        const pm = p && p.cabinet.pm ? String(g.npcName(p.cabinet.pm) || '').split(' ')[0] : '';
        await g.say([`総理の一日の動きを追いかける「総理番」です。`, pm ? `${pm}総理、今日は朝から官邸に缶づめ。\n内閣支持率は${g.approval()}%…さて、どうなるかな。` : '今日の総理の日程は…ひみつです。', 'あそこのスーツの人たちはSP。\n要人を守る、警視庁の警察官なんですよ。'], who(npc));
      } },
    // ---- people: party HQs
    { type: 'npc', id: 'naga_party_staff', x: 26, y: 35, dir: 'up', look: { ...LOOKS.salaryman, top: '#3a4a3a', tie: '#2f8f4e' }, name: '党の職員', wander: 2,
      text: ['党本部には、選挙の公認を求める人や、\n陳情に来る人が毎日やってきます。', '政党に入るなら、本部の受付へどうぞ。'] },
    { type: 'npc', id: 'naga_agent', x: 55, y: 35, dir: 'up', look: { ...LOOKS.salaryman, top: '#6a5a4a', tie: '#c0452f' }, name: '不動産会社の人', cond: (g) => !myPartyOf(g),
      text: ['このビル、永田町では珍しい空き物件なんです。', '新しい政党の事務所にぴったりですよ。\n…なーんてね。中、見ていきます？'] },
    // ---- people: 霞が関
    { type: 'npc', id: 'naga_kanryo', x: 47, y: 50, dir: 'up', look: KANRYO, name: '役所の職員',
      text: ['国会の会期中は、大臣の答弁の準備で\n夜遅くまで…ということも多いんです。', '法律の案をつくるのも、予算をまとめるのも\n役所の大事な仕事。…今日も、がんばります。'] },
    { type: 'npc', id: 'naga_kanryo2', x: 68, y: 50, dir: 'left', look: { ...KANRYO, hair: 'bob', hairColor: 'black', top: '#4a4a5a', skirt: true, tie: undefined }, name: '役所の職員', wander: 2,
      text: ['霞が関には、国の役所が集まっています。', 'この通りのイチョウ並木、秋には黄色く色づいて\nとってもきれいなんですよ。'] },
    { type: 'npc', id: 'naga_bocho', x: 33, y: 50, dir: 'up', look: { ...LOOKS.oldman, top: '#5a6a7a' }, name: '傍聴希望の人',
      text: ['注目の裁判は、傍聴券の抽選になるんです。', '今日は当たるといいんだがなあ…。\n裁判は、だれでも見られるのが原則なんだよ。'] },
    { type: 'npc', id: 'naga_kensatsu_reporter', x: 25, y: 50, dir: 'up', look: REPORTER2, name: '社会部の記者',
      talk: async (g, npc) => {
        G = g;
        const m = me(g);
        const lines = ['検察庁の前で、張りこみ中なんだ。', '東京地検には「特捜部」があってね。\n汚職や大きな経済事件を、独自に捜査するんだよ。'];
        if (m && m.secret > 0 && isPolitician(g)) lines.push(`…あなた、${honor(g)}ですよね？\n最近、いろいろうわさを聞くもので。…いえ、べつに。`);
        await g.say(lines, who(npc));
      } },
    { type: 'npc', id: 'naga_mpd', x: 9, y: 50, dir: 'down', look: POLICE, name: '警察官',
      text: ['こちらは警視庁。東京の警察の本部です。', '皇居の桜田門の前にあるので、\n「桜田門」とも呼ばれているんですよ。'] },
    // ---- people: park, bus stop
    { type: 'npc', id: 'naga_lunch', x: 66, y: 30, dir: 'down', look: { ...LOOKS.salaryman, top: '#4a5a6a' }, name: '昼休みの人',
      text: ['霞が関で働いてるんだ。\nお昼は、この公園でお弁当。', 'ここにいると、ちょっとだけ肩の力が抜けるんだよね。'] },
    { type: 'npc', id: 'naga_jogger', x: 72, y: 33, dir: 'down', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#ff8a3d', bottom: '#20232a' }, name: 'ランナー', wander: 3,
      text: ['皇居のまわりを走って、ここでひと休み！', '永田町も、朝は静かでいいところだよ。'] },
    { type: 'npc', id: 'naga_speaker', x: 47, y: 53, dir: 'up', look: { hair: 'slick', hairColor: 'gray', skin: 'fair', top: '#3a3f55', bottom: '#2a2d36', jacket: true, tie: '#c0452f' }, name: '演説中の議員', fixedDir: true,
      cond: (g) => !(typeof g.myElection === 'function' && g.myElection()), talk: speechSpot },
  ];

  entities.push(speechStand(46, 53));
  entities.push(subwayEntrance(SUBWAY.x, SUBWAY.y)); // [R9-A]
  const events = [
    { x: DOOR.x, y: DOOR.y, on: 'step', run: enterDiet },
  ];
  const warps = [];
  for (let x = 38; x <= 42; x++) warps.push({ x, y: H - 1, place: 'tokyo', room: 'main', tx: x, ty: 1, dir: 'down' });
  warps.push(...ekiStairs([SUBWAY.x, SUBWAY.x + 1], SUBWAY.y + 1, 'nagatacho')); // [R9-A] down to the station
  return { w: W, h: H, cells: c, entities, warps, events };
}

// Smoking: 千代田区の生活環境条例 (2002年10月施行、11月から路上禁煙地区での喫煙に過料2,000円).
// The first zones were 8 areas (about 30% of the ward, 秋葉原駅周辺 など); whether 永田町・霞が関 was among
// them could not be confirmed, so the fine applies here from April 2010, when the whole ward became a zone.
registerSmokingRule('nagatacho', (g) => (lawDate(g).ym >= 201004
  ? { ok: false, area: '千代田区（永田町・霞が関）', law: '千代田区生活環境条例', fine: 2000, patrol: 0.4, smokingArea: true }
  : { ok: true, area: '永田町' }));

registerPlace({
  id: 'nagatacho',
  name: '永田町・霞が関',
  kind: 'town',
  bgm: 'town',
  start: { room: 'main', x: 40, y: NAGA_H - 2, dir: 'up' },
  rooms: {
    main: {
      generate,
      bg: '#62b35b',
      topPad: 24,
      onEnter: async (g) => {
        G = g;
        if (g.flag('nagatacho_intro')) return;
        g.setFlag('nagatacho_intro', true);
        await g.wait(250);
        await g.say(['ここは「永田町・霞が関」。\n国会、首相官邸、政党の本部、国の役所が集まる\n日本の政治の中心だ。']);
        await panDiet(g, [...dietLines(g), '（議事堂をまたながめたくなったら、\n　門の前の説明板を調べよう）']);
        await g.say(['（党本部の受付で入党、2階の選挙対策本部で公認の相談。\n　国会は、だれでも見学と本会議の傍聴ができる）', '（選挙の届出は、ドット商店街の区役所でもできる。\n　行き先は、すぐそばの案内図で確かめよう）']);
      },
    },
  },
});

