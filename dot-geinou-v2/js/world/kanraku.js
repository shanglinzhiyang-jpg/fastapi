// ネオン街 ('kanraku'): a big-city nightlife district south of 東京エリア, fully fictionalised.
//
// Town (70x50). Tokyo's center avenue (x 38..42) leaves Tokyo at its south edge and arrives
// here at the north edge on the same columns, then meets ネオン大通り (road rows 10..12). Across
// it the neon gate 「ネオン街一番通り」 opens the pedestrian district: 一番通り (x 38..42, south to
// 花道通り), セントラル通り (rows 20..21), さくら通り (rows 30..31), 花道通り (rows 40..41), the west alley
// (x 12..13), the east alley (x 56..57) and the back alley (row 48) where the 組事務所 stands.
//   N  カプセルホテル (sleep), ドットローン ('shohisha'), 牛丼屋, the 喫煙所 and the bus stop, 交番 ('koban'),
//      パチンコ店 (flavour), 雑居ビル
//   B1 第一ネオンビル, 居酒屋 ほろよい (a drink and a bite), ゲームセンター ('gamecen'), CLUB ステラ ('kyabakura')
//   B2 クイック融資 の雑居ビル ('yamikin'), 映画館 ネオン座 (closed), 雑居ビル
//   B3 スナック横丁, 雑居ビル
//   B4 ネオン公園 (the homeless man, the NPO worker), 鬼灯興業 = 鬼灯組の事務所 ('kumi', back alley)
// Interiors (one place each): koban, kyabakura, shohisha, yamikin, kumi (genkan / jimusho), gamecen.
//
// Shared with other modules (looked up at run time as PLACES.kanraku.api, no import, so a broken
// kanraku.js cannot take a shop down):
//   api.shoplift(g, { where, items: [itemId...] })   「万引きする…？」 with a warning → g.commitCrime('shoplifting')
//   api.tobaccoCounter(g, npc, { where })           タバコ / お酒 at a counter: age check (ageOf) → g.buyCigarettes / beer
//   api.fareEvasion(g, { fare, where, dest })       無賃乗車 → g.commitCrime('fare_evasion'); resolves { ok, caught }
//
// Everything is fictional: the district, the shops, the 鬼灯組 (no real group), the lenders (the core's
// fictional brands), every person. Crimes are abstract choices routed through the justice core
// (js/engine/crime.js) — no real-world method detail. 暴力団 are shown as dangerous and predatory;
// ties end careers. The cabaret is adults-only, conversation and drinks, non-sexual, respectful.
//
// flags: g.state.flags.kanraku = { ... } (see K()), plus kanraku_intro.
//
// Facts used (checked 2026-10, WebSearch; the core's sources in crime.js cover loans, 闇金, taspo, 喫煙, 鉄道営業法):
//   風営法: 接待飲食等営業（キャバクラ）は18歳未満を客として立ち入らせてはならない（22条）・20歳未満に酒類を
//     提供しない（営業方法の届出に「20歳未満の者への酒類の提供を防止する方法」）（keishicho.metro.tokyo.lg.jp
//     style41.pdf, police.pref.kanagawa.jp d0022_02.pdf）。風俗営業者の客引きは禁止（22条）、東京都の迷惑防止条例も
//     公共の場所でのしつこい客引きを禁止（rilg.or.jp 062_Bargaining_regulations, city.shinjuku.lg.jp）。
//   ゲームセンター（風営法の許可店）: 18歳未満は午後10時以降、16歳未満は午後6時以降の立入り禁止（条例で保護者
//     同伴なら緩和の県が多い）（police.pref.saitama.lg.jp saposentimes.pdf, bandainamco-am.co.jp 2016-06-20）。
//   ぼったくり防止条例: 東京都 2000年10月公布（全国初）。料金を著しく安いと誤認させる勧誘の禁止、料金表示の義務
//     （seisakukikaku.metro.tokyo.lg.jp, president.jp 41345）。
//   暴力団対策法 1992年3月施行・各都道府県の暴力追放運動推進センター（相談無料）（police.pref.kanagawa.jp mesc8009,
//     seikatubunka.metro.tokyo.lg.jp boutsui）; 暴力団排除条例 2011年10月に全都道府県（crime.js）。
//   遺失物法: 拾得物の保管期間 3か月（2007年12月から。前は6か月）、報労金は価格の5〜20%（justice.js の出典）。
//   法テラス 2006年10月、消費者ホットライン188 2015年7月、生活困窮者自立支援制度 2015年4月、高卒認定 2005年度から
//     （それまでは大検）、特定非営利活動促進法（NPO法）1998年12月施行。

import { registerPlace, PLACES } from '../engine/map.js';
import { defineTile, tileImageHD, R, P, Rw, disc, oval, line, outline, shadowEllipse, speckle } from '../engine/tiles.js';
import { LOOKS, charSheetHD } from '../engine/sprites.js';
import { text, setFont, panel, measure, COLORS } from '../engine/draw.js';
import { makeCanvas, shade, mix, fmtMoney, clamp, SW, SH, TILE, VIEW_W, VIEW_H, mulberry32, YEN_MARK } from '../engine/util.js';
import { registerItem, ITEMS, AGENCIES } from '../engine/state.js';
import { onMorning } from '../engine/life.js';
import { ageOf } from '../engine/profile.js';
import { audio } from '../engine/audio.js';
import { lawDate, registerSmokingRule, LENDERS, lenderRate, rateLawText, loanBalance, MONTH_DAYS, CRIMES, isPolitician } from '../engine/crime.js';
import { busStop } from './props.js';
import { grid, set, put, fill } from './townkit.js';
import { GUIDE, GUIDE_ORDER } from './guide.js';

export const KAN_W = 70;
export const KAN_H = 50;
// Tokyo's center avenue (x 38..42) leaves Tokyo at its south edge (row 45) and arrives here on row 1.
export const KAN_FROM_TOKYO = { y: 1 };
const BUS = { x: 36, y: 8, arrive: [35, 9] };

// ====================================================================== small helpers
const who = (n) => ({ name: n.name, look: n.look });
const U = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
const hu = (v) => Math.round(v * 2) / 2;
const K = (g) => { const f = g.state.flags; if (!f.kanraku || typeof f.kanraku !== 'object') f.kanraku = {}; return f.kanraku; };
const today = (g) => g.state.day;
const doneToday = (g, k) => K(g)[k] === today(g);
const markToday = (g, k) => { K(g)[k] = today(g); };
const rnd = () => Math.random();
const roll = (p) => Math.random() < p;
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const age = (g) => ageOf(g.state);
const jus = (g) => { try { return typeof g.jus === 'function' ? g.jus() : null; } catch (e) { console.error(e); return null; } };
function ld(g) { try { return lawDate(g); } catch (e) { return { year: 2026, month: 4, ym: 202604 }; } }
const yearOf = (g) => ld(g).year;
const since = (g, y, m = 1) => ld(g).ym >= y * 100 + m;
const eraKey = (g) => (g.state.profile && g.state.profile.era) || 'reiwa';
const famous = (g) => g.state.fame >= 1000;
const politician = (g) => { try { return isPolitician(g); } catch (e) { return false; } };
const hasPhone = (g) => since(g, 1999); // a mobile phone in everyone's pocket
async function narrate(g, t) { await g.say(t); }

// ====================================================================== crisp lettering
// DotGothic16 is a 16-dot font. Signs are lettered from the font's exact dot bitmap (sampled
// from a big render), scaled to the size by area coverage, then given a 1px signage bold — the
// same approach as buildings.js, so small kanji stay legible instead of smearing.
const DOT = 8, BIGPX = 16 * DOT, BASE = Math.round(BIGPX * 1.05);
let gridOff = null;
function fontGrid() {
  if (gridOff) return gridOff;
  const n = BIGPX + 32;
  const [, c] = makeCanvas(n, BASE + 40);
  setFont(c, BIGPX);
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#000';
  c.fillText('口', DOT, BASE);
  const d = c.getImageData(0, 0, n, BASE + 40).data;
  let x0 = n, y0 = BASE + 40;
  for (let p = 0; p < n * (BASE + 40); p++) {
    if (d[p * 4 + 3] < 128) continue;
    const x = p % n, y = (p - x) / n;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
  }
  if (y0 > BASE) { x0 = 0; y0 = 0; }
  return (gridOff = [x0 % DOT, y0 % DOT]);
}
function coverAxis(n, f, dn) {
  const t = [];
  for (let X = 0; X < dn; X++) {
    const a = X / f, b = (X + 1) / f, l = [];
    for (let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++) {
      const wgt = (Math.min(b, i + 1) - Math.max(a, i)) * f;
      if (wgt > 1e-6) l.push(i, wgt);
    }
    t.push(l);
  }
  return t;
}
function scaleBits(src, sw, sh, fx, fy) {
  const w = Math.max(1, Math.round(sw * fx)), h = Math.max(1, Math.round(sh * fy));
  const ax = coverAxis(sw, fx, w), ay = coverAxis(sh, fy, h);
  const mid = new Uint8Array(w * sh);
  for (let y = 0; y < sh; y++) for (let X = 0; X < w; X++) {
    const l = ax[X]; let cov = 0;
    for (let k = 0; k < l.length; k += 2) if (src[y * sw + l[k]]) cov += l[k + 1];
    mid[y * w + X] = fx >= 1 ? cov >= 0.5 - 1e-6 : cov > 0;
  }
  const out = new Uint8Array(w * h);
  for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
    const l = ay[Y]; let cov = 0;
    for (let k = 0; k < l.length; k += 2) if (mid[l[k] * w + X]) cov += l[k + 1];
    out[Y * w + X] = fy >= 1 ? cov >= 0.5 - 1e-6 : cov > 0;
  }
  return { out, w, h };
}
function embolden(src, w, h, dx, dy) {
  const out = src.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (src[p] || x < dx || y < dy || !src[p - dy * w - dx]) continue;
    const nx = x + dx, ny = y + dy;
    if (nx < w && ny < h && src[ny * w + nx]) continue;
    out[p] = 1;
  }
  return out;
}
const maskCache = new Map();
// A mask canvas of `str` at `size` px (squeezed to maxW px when given); ink box in px.
function textMask(str, size, maxW = 0, bold = true) {
  const key = `${str}|${size}|${maxW}|${bold}`;
  const hit = maskCache.get(key);
  if (hit) return hit;
  const [px0, py0] = fontGrid();
  const [, m] = makeCanvas(2, 2);
  setFont(m, BIGPX);
  const bw = Math.ceil(m.measureText(str).width) + DOT * 3, bh = BASE + DOT * 6;
  const [, bc] = makeCanvas(bw, bh);
  setFont(bc, BIGPX);
  bc.textBaseline = 'alphabetic';
  bc.fillStyle = '#000';
  bc.fillText(str, DOT, BASE);
  const bd = bc.getImageData(0, 0, bw, bh).data;
  const sw = Math.floor((bw - px0) / DOT), sh = Math.floor((bh - py0) / DOT);
  const bits = new Uint8Array(sw * sh);
  let c0 = sw, c1 = -1;
  for (let j = 0; j < sh; j++) {
    const yy = py0 + j * DOT + (DOT >> 1);
    for (let i = 0; i < sw; i++) {
      if (bd[(yy * bw + px0 + i * DOT + (DOT >> 1)) * 4 + 3] >= 128) { bits[j * sw + i] = 1; if (i < c0) c0 = i; if (i > c1) c1 = i; }
    }
  }
  const tw = c1 >= c0 ? c1 - c0 + 1 : 1;
  const f = size / 16;
  const k = maxW && tw * f > maxW ? maxW / (tw * f) : 1;
  const sc = scaleBits(bits, sw, sh, f * k, f);
  const w = sc.w, h = sc.h;
  const out = bold ? embolden(embolden(sc.out, w, h, 1, 0), w, h, 0, 1) : sc.out;
  const [cv, c] = makeCanvas(w, h);
  const img = c.createImageData(w, h), d = img.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < w * h; p++) {
    if (!out[p]) continue;
    d[p * 4 + 3] = 255;
    const px = p % w, py = (p - px) / w;
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
  c.putImageData(img, 0, 0);
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  const res = { cv, ink: [x0, y0, x1 + 1, y1 + 1] };
  maskCache.set(key, res);
  return res;
}
function tinted(mask, col) {
  const [cv, c] = makeCanvas(mask.width, mask.height);
  c.drawImage(mask, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = col;
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
// Crisp text with its ink centred on (cx, cy) (canvas px). opts: { maxW, shadow, glow, bold }
function sign(c, str, cx, cy, size, col, opts = {}) {
  if (str == null || str === '') return;
  const m = textMask(String(str), size, opts.maxW || 0, opts.bold !== false);
  const x = Math.round(cx - (m.ink[0] + m.ink[2]) / 2), y = Math.round(cy - (m.ink[1] + m.ink[3]) / 2);
  if (opts.glow) { const t = tinted(m.cv, opts.glow); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(t, x + dx, y + dy); }
  if (opts.shadow) c.drawImage(tinted(m.cv, opts.shadow), x + 1, y + 1);
  c.drawImage(tinted(m.cv, col), x, y);
}
// Vertical lettering (one character per row), centred on cx, starting at top y0, row pitch.
function vsign(c, str, cx, y0, size, col, pitch, opts = {}) {
  Array.from(String(str)).forEach((ch, i) => {
    const rot = /[ー〜～]/.test(ch);
    if (rot) { R(c, cx - 1, y0 + i * pitch + 2, 2, pitch - 5, col); return; }
    sign(c, ch, cx, y0 + i * pitch + pitch / 2, size, col, opts);
  });
}

// ====================================================================== baking
const baked = new Map();
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (!cv) {
    const [c2, c] = makeCanvas(Math.round(w), Math.round(h));
    try { paint(c); } catch (e) { console.error('[kanraku] paint failed', key, e); }
    cv = c2;
    baked.set(key, cv);
  }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);

// ====================================================================== palette (night)
const NEON = { pink: '#ff4fa0', cyan: '#4fe0ff', yellow: '#ffd23f', violet: '#b57bff', green: '#5ef08a', red: '#ff4a4a', orange: '#ff9a3c', white: '#f4f0ff' };
const NEON_LIST = [NEON.pink, NEON.cyan, NEON.yellow, NEON.violet, NEON.green, NEON.orange];
const INK = '#14121c';
const LITWIN = ['#ffd98a', '#ffe9b0', '#ffc870'];

// ====================================================================== HD tiles: the streets
// Every tile here is painted natively at 32x32; the 16px draw() is the same art halved.
function tile(id, def, hd) {
  defineTile(id, {
    ...def,
    hd,
    draw(c, r, f, v) {
      const [cv, c2] = makeCanvas(32, 32);
      hd(c2, r, f, v);
      c.imageSmoothingEnabled = false;
      c.drawImage(cv, 0, 0, 16, 16);
    },
  });
}
// neon reflections on wet ground: a few soft streaks of colour
function reflect(c, r, n, alpha = 0.35) {
  for (let i = 0; i < n; i++) {
    const col = NEON_LIST[Math.floor(r() * NEON_LIST.length)];
    const x = Math.floor(r() * 28), y = Math.floor(r() * 30), len = 2 + Math.floor(r() * 5);
    c.globalAlpha = alpha;
    R(c, x, y, len, 1, col);
    c.globalAlpha = alpha * 0.5;
    R(c, x + 1, y + 1, Math.max(1, len - 2), 1, col);
    c.globalAlpha = 1;
  }
}
function asphalt(c, r, base = '#262634') {
  R(c, 0, 0, 32, 32, base);
  speckle(c, r, [shade(base, -0.2), shade(base, 0.12), shade(base, 0.22)], 70);
}
tile('kanraku_road', { variants: 4 }, (c, r, f, v) => { asphalt(c, r); reflect(c, r, v === 0 ? 3 : 1, 0.28); });
tile('kanraku_line_h', {}, (c, r) => { asphalt(c, r); R(c, 4, 15, 24, 2, '#c9c6b8'); R(c, 4, 15, 24, 1, '#e4e0d0'); reflect(c, r, 1, 0.25); });
tile('kanraku_line_v', {}, (c, r) => { asphalt(c, r); R(c, 15, 4, 2, 24, '#c9c6b8'); R(c, 15, 4, 1, 24, '#e4e0d0'); reflect(c, r, 1, 0.25); });
tile('kanraku_cross_h', {}, (c, r) => { asphalt(c, r); for (const y of [2, 12, 22]) { R(c, 3, y, 26, 7, '#cfcbbd'); R(c, 3, y, 26, 1, '#ebe7da'); R(c, 3, y + 6, 26, 1, '#a9a596'); } reflect(c, r, 1, 0.25); });
tile('kanraku_cross_v', {}, (c, r) => { asphalt(c, r); for (const x of [2, 12, 22]) { R(c, x, 3, 7, 26, '#cfcbbd'); R(c, x, 3, 1, 26, '#ebe7da'); R(c, x + 6, 3, 1, 26, '#a9a596'); } reflect(c, r, 1, 0.25); });
// sidewalk: dark square slabs
tile('kanraku_side', { variants: 3 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#3c3f4e');
  for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) {
    const k = (x + y + v * 16) % 48 === 0 ? 0.04 : 0;
    R(c, x + 1, y + 1, 14, 14, shade('#424656', k));
    R(c, x + 1, y + 1, 14, 1, '#4e5264'); R(c, x + 1, y + 1, 1, 14, '#4a4e60');
    R(c, x, y + 15, 16, 1, '#2e303c'); R(c, x + 15, y, 1, 16, '#2e303c');
  }
  speckle(c, r, ['#353845', '#4b4f60'], 22);
  reflect(c, r, v === 1 ? 2 : 0, 0.22);
});
// the pedestrian streets: interlocking brick in a dusky mauve, wet and glittering
tile('kanraku_walk', { variants: 4 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2f2833');
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 3; col++) {
      const x = col * 16 + off, y = row * 8;
      const tint = ((row * 3 + col + v) % 5) * 0.015;
      Rw(c, x + 1, y + 1, 14, 6, shade('#40363f', tint));
      Rw(c, x + 1, y + 1, 14, 1, '#4c414b');
      Rw(c, x + 1, y + 6, 14, 1, '#382f37');
    }
  }
  speckle(c, r, ['#2a242d', '#4a3f49'], 18);
  reflect(c, r, v === 0 ? 3 : v === 2 ? 2 : 1, 0.3);
});
// narrow alleys: grimy concrete, cracks, a puddle that holds the neon
tile('kanraku_alley', { variants: 4 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2a292f');
  speckle(c, r, ['#222126', '#33323a', '#2e2d34'], 90);
  if (v === 1) { line(c, 3, 6, 12, 14, '#1c1b20'); line(c, 12, 14, 16, 26, '#1c1b20'); }
  if (v === 2) {
    oval(c, 6, 14, 20, 9, '#1e2436'); oval(c, 8, 15, 16, 6, '#26304a');
    R(c, 10, 17, 5, 1, NEON.pink); R(c, 17, 18, 4, 1, NEON.cyan); R(c, 12, 19, 3, 1, '#7a6aa0');
  }
  if (v === 3) { R(c, 20, 4, 6, 3, '#3a3940'); R(c, 21, 5, 4, 1, '#454450'); }
});
// plaza paving around the bus stop and the 喫煙所
tile('kanraku_plaza', { variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#383a48');
  for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) {
    const k = ((x + y) / 8 + v) % 3 === 0 ? 0.06 : 0;
    R(c, x + 1, y + 1, 7, 7, shade('#40435a', k));
    R(c, x + 1, y + 1, 7, 1, '#4b4e66');
  }
  reflect(c, r, 1, 0.2);
});
// 路上喫煙禁止 painted on the paving (the district's no-smoking decals)
tile('kanraku_decal', {}, (c, r) => {
  // the walk underneath
  R(c, 0, 0, 32, 32, '#2f2833');
  for (let row = 0; row < 4; row++) for (let col = -1; col < 3; col++) Rw(c, col * 16 + (row % 2 ? 8 : 0) + 1, row * 8 + 1, 14, 6, '#40363f');
  disc(c, 16, 16, 12, '#e8e4dc'); disc(c, 16, 16, 10, '#2f2833');
  disc(c, 16, 16, 9, '#d8d2c8');
  R(c, 9, 15, 13, 3, '#5a5650'); R(c, 20, 15, 3, 3, '#e86a3a'); // the cigarette
  line(c, 9, 9, 23, 23, '#d23a3a'); line(c, 10, 9, 24, 23, '#d23a3a'); line(c, 9, 10, 23, 24, '#d23a3a');
  ring(c, 16, 16, 10, 12, '#d23a3a');
});
function ring(c, cx, cy, r0, r1, col) {
  c.fillStyle = col;
  for (let y = -r1; y <= r1; y++) for (let x = -r1; x <= r1; x++) { const d = x * x + y * y; if (d >= r0 * r0 && d <= r1 * r1) c.fillRect(cx + x, cy + y, 1, 1); }
}
// the backs of buildings / rooftops: the edge of the map and the gaps between façades (solid)
tile('kanraku_back', { solid: true, variants: 4 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#1b1a24');
  for (let y = 0; y < 32; y += 8) { R(c, 0, y, 32, 1, '#22212c'); }
  for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 0 : 8; x < 32; x += 16) R(c, x, y + 1, 1, 7, '#22212c');
  if (v === 1) { R(c, 4, 0, 3, 32, '#34343f'); R(c, 4, 0, 1, 32, '#44444f'); R(c, 2, 12, 7, 3, '#2a2a34'); }
  if (v === 2) { R(c, 8, 10, 16, 12, '#2c2c38'); R(c, 9, 11, 14, 10, '#3a3a48'); for (let x = 11; x < 22; x += 3) R(c, x, 12, 1, 8, '#24242e'); disc(c, 16, 16, 3, '#2a2a34'); }
  if (v === 3) { R(c, 18, 6, 6, 5, LITWIN[Math.floor(r() * 3)]); R(c, 18, 6, 6, 1, '#fff4d0'); R(c, 20, 6, 1, 5, '#7a5a30'); R(c, 17, 5, 8, 1, '#2a2a34'); }
  speckle(c, r, ['#15141c', '#26252f'], 20);
});

// ---------------------------------------------------------------- street objects
// street lamp (glows: see GLOW below)
tile('kanraku_lamp', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 6, 2);
  R(c, 14, 8, 4, 22, '#3e4250'); R(c, 14, 8, 1, 22, '#5a6072'); R(c, 17, 8, 1, 22, '#2a2d38');
  R(c, 12, 27, 8, 3, '#2e313c');
  R(c, 9, 2, 14, 6, '#4a4e5c'); R(c, 9, 2, 14, 1, '#6a7080');
  R(c, 10, 7, 12, 3, '#fff3c0'); R(c, 11, 8, 10, 1, '#ffffff');
  outline(c, { tint: 0.3 });
});
// garbage bags and a crate by a back door
tile('kanraku_trash', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 27, 12, 3);
  R(c, 3, 16, 12, 10, '#6a4a2a'); R(c, 3, 16, 12, 2, '#8a6a3a'); for (let x = 4; x < 15; x += 3) R(c, x, 18, 1, 8, '#5a3a20');
  disc(c, 20, 20, 7, '#2a3a4a'); disc(c, 19, 18, 5, '#3a4e62'); R(c, 18, 11, 3, 3, '#2a3a4a');
  disc(c, 12, 24, 5, '#3a3a3a'); disc(c, 11, 22, 3, '#555555');
  R(c, 22, 15, 2, 1, '#6a8aa8');
  outline(c, { tint: 0.3 });
});
// air-conditioner units stacked against a wall
tile('kanraku_ac', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 13, 2);
  for (const y of [4, 17]) {
    R(c, 3, y, 26, 12, '#c9ccd2'); R(c, 3, y, 26, 1, '#e4e6ea'); R(c, 3, y + 11, 26, 1, '#8a8e98');
    disc(c, 11, y + 6, 4, '#5a5e68'); disc(c, 11, y + 6, 2, '#3a3e48');
    for (let x = 18; x < 27; x += 2) R(c, x, y + 2, 1, 8, '#9aa0aa');
  }
  outline(c, { tint: 0.3 });
});
// a lit stand signboard (立て看板)
tile('kanraku_board', { solid: true, obj: true, variants: 3 }, (c, r, f, v) => {
  const col = [NEON.pink, NEON.cyan, NEON.yellow][v];
  shadowEllipse(c, 16, 29, 8, 2);
  R(c, 8, 4, 16, 22, '#1a1820'); R(c, 9, 5, 14, 20, shade(col, -0.55));
  R(c, 10, 6, 12, 18, col); R(c, 10, 6, 12, 2, '#ffffff');
  for (let y = 10; y < 22; y += 4) R(c, 12, y, 8, 2, shade(col, -0.45));
  R(c, 9, 26, 2, 4, '#3a3a44'); R(c, 21, 26, 2, 4, '#3a3a44');
  outline(c, { tint: 0.3 });
});
// 路上喫煙禁止 plate on a short post
tile('kanraku_nosmoke', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 5, 2);
  R(c, 15, 14, 3, 16, '#8a8e98'); R(c, 15, 14, 1, 16, '#b8bcc6');
  R(c, 6, 1, 20, 16, '#f2efe8'); R(c, 6, 1, 20, 1, '#ffffff'); R(c, 6, 16, 20, 1, '#b8b4aa');
  ring(c, 16, 9, 5, 6, '#d23a3a');
  R(c, 12, 8, 7, 2, '#5a5650'); R(c, 18, 8, 2, 2, '#e86a3a');
  line(c, 12, 5, 20, 13, '#d23a3a');
  outline(c, { tint: 0.3 });
});
// bollard (pedestrian street entrance)
tile('kanraku_bollard', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 28, 6, 2);
  R(c, 12, 10, 8, 18, '#5a5e6c'); R(c, 12, 10, 2, 18, '#7a808e'); R(c, 18, 10, 2, 18, '#40434e');
  R(c, 11, 8, 10, 3, '#ffd23f'); R(c, 11, 8, 10, 1, '#fff0a0');
  R(c, 12, 16, 8, 2, '#d8d4c8');
  outline(c, { tint: 0.3 });
});
// parked bicycles (dark)
tile('kanraku_bikes', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 28, 14, 2);
  for (const [x, col] of [[2, '#c84a5a'], [12, '#4a8ac8'], [22, '#d8d4c8']]) {
    ring(c, x + 3, 22, 3, 4, '#1a1a20'); ring(c, x + 3, 12, 3, 4, '#1a1a20');
    R(c, x + 2, 12, 2, 11, col); R(c, x, 9, 6, 2, '#2a2a30');
  }
  outline(c, { tint: 0.3 });
});
// a planter with a small lit tree
tile('kanraku_planter', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 12, 2);
  R(c, 4, 20, 24, 9, '#4a4552'); R(c, 4, 20, 24, 2, '#6a6474'); R(c, 4, 27, 24, 2, '#332f3a');
  disc(c, 16, 12, 9, '#1f4a32'); disc(c, 14, 10, 6, '#2c6a46'); disc(c, 12, 8, 3, '#3a8a5a');
  for (const [x, y, col] of [[9, 9, '#ffe9a0'], [20, 8, '#ffb0d8'], [16, 15, '#a0e8ff'], [22, 14, '#ffe9a0'], [12, 16, '#ffb0d8']]) P(c, x, y, col);
  outline(c, { tint: 0.3 });
});
// a lit vending machine (cold drinks)
tile('kanraku_vending', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 11, 2);
  R(c, 5, 1, 22, 29, '#c8302e'); R(c, 5, 1, 22, 2, '#e85a50'); R(c, 25, 1, 2, 29, '#8a1e1e');
  R(c, 7, 4, 18, 12, '#eaf6ff');
  for (let row = 0; row < 3; row++) for (let i = 0; i < 5; i++) { R(c, 8 + i * 3.4, 5 + row * 4, 2, 3, ['#3a8ad8', '#e8c02a', '#5ac85a', '#d84a4a', '#8a5ad8'][(i + row) % 5]); }
  R(c, 7, 18, 18, 3, '#20232a'); for (let i = 0; i < 6; i++) P(c, 8 + i * 3, 19, '#5ef08a');
  R(c, 8, 24, 16, 4, '#2a2a30'); R(c, 20, 19, 3, 4, '#d8d4c8');
  outline(c, { tint: 0.3 });
});

// ====================================================================== façades
// Buildings are ordinary town 'building' entities (doors, places, exits work as usual); their
// look is painted here and blitted by `decorate` over the base art (the footprint is covered
// completely). A façade canvas is in screen px: footprint w*32 x h*32, MX px margin on the sides
// and MT px above for rooftop billboards. `live` parts (neon, lamps, cameras) are drawn per frame.
const MX = 6, MT = 52, MB = 4;
const facadeCache = new Map();
function wallTex(c, x, y, w, h, col, kind = 'tile', r = Math.random) {
  R(c, x, y, w, h, col);
  if (kind === 'tile') {
    for (let yy = y + 5; yy < y + h; yy += 6) R(c, x, yy, w, 1, shade(col, -0.07));
    for (let yy = y; yy < y + h; yy += 6) for (let xx = x + ((yy - y) / 6 % 2 ? 0 : 6); xx < x + w; xx += 12) R(c, xx, yy, 1, 5, shade(col, -0.05));
  } else if (kind === 'concrete') {
    speckle(c, r, [shade(col, -0.08), shade(col, 0.06)], Math.round(w * h / 28), x, y, w, h);
    for (let yy = y + 30; yy < y + h; yy += 30) R(c, x, yy, w, 1, shade(col, -0.1));
  } else if (kind === 'grime') {
    speckle(c, r, [shade(col, -0.12), shade(col, -0.2), shade(col, 0.05)], Math.round(w * h / 18), x, y, w, h);
    for (let i = 0; i < Math.max(2, w / 40); i++) { const sx = x + Math.floor(r() * (w - 4)); R(c, sx, y + 4, 2, Math.floor(h * (0.3 + r() * 0.4)), shade(col, -0.16)); }
  } else if (kind === 'panel') {
    for (let xx = x; xx < x + w; xx += 16) { R(c, xx, y, 1, h, shade(col, -0.18)); R(c, xx + 1, y, 1, h, shade(col, 0.1)); }
  }
}
function win(c, x, y, w, h, kind, r) {
  R(c, x - 1, y - 1, w + 2, h + 2, '#1a1822');
  if (kind === 'dark') { R(c, x, y, w, h, '#20222e'); R(c, x, y, w, 2, '#2c2f3e'); R(c, x + 2, y + 3, 3, h - 5, '#2a2d3a'); return; }
  if (kind === 'blind') { R(c, x, y, w, h, '#d8e4f0'); for (let yy = y + 1; yy < y + h; yy += 2) R(c, x, yy, w, 1, '#b8c6d6'); return; }
  if (kind === 'plate') { R(c, x, y, w, h, '#4a4c54'); R(c, x, y, w, 1, '#6a6c76'); for (const [bx, by] of [[x + 2, y + 2], [x + w - 3, y + 2], [x + 2, y + h - 3], [x + w - 3, y + h - 3]]) P(c, bx, by, '#8a8c96'); return; }
  const col = kind === 'lit' ? LITWIN[Math.floor(r() * 3)] : kind;
  R(c, x, y, w, h, col);
  R(c, x, y, w, 2, shade(col, 0.25));
  R(c, x + Math.floor(w / 2), y, 1, h, shade(col, -0.35));
  if (kind === 'lit' && r() < 0.5) { R(c, x, y + 2, Math.floor(w / 2), h - 2, shade(col, -0.12)); }
}
// a stack of 袖看板 (vertical tenant signs) at x, from y0 down to y1
function sodeStack(c, x, y0, y1, signs, live, w = 18) {
  let y = y0;
  R(c, x + w / 2 - 1, y0 - 4, 2, y1 - y0 + 4, '#2a2830'); // the frame they hang on
  signs.forEach((s, i) => {
    const chars = Array.from(s.t);
    const pitch = 12;
    const h = chars.length * pitch + 6;
    if (y + h > y1) return;
    R(c, x - 1, y - 1, w + 2, h + 2, INK);
    R(c, x, y, w, h, s.bg);
    R(c, x, y, w, 1, shade(s.bg, 0.35));
    R(c, x, y + h - 1, w, 1, shade(s.bg, -0.3));
    vsign(c, s.t, x + w / 2, y + 3, 11, s.fg, pitch, { bold: true });
    if (s.neon) live.push({ kind: 'frame', x: x - 1, y: y - 1, w: w + 2, h: h + 2, col: s.neon, mode: s.mode || 'blink', ph: i * 13 });
    y += h + 3;
  });
}
// horizontal sign band (a tenant's sign across the window band)
function hsign(c, x, y, w, h, s) {
  R(c, x - 1, y - 1, w + 2, h + 2, INK);
  R(c, x, y, w, h, s.bg);
  R(c, x, y, w, 1, shade(s.bg, 0.3));
  sign(c, s.t, x + w / 2, y + h / 2, s.size || 11, s.fg, { maxW: w - 4 });
}
function doorway(c, x, y, kind, o = {}) {
  // x: the door tile's left edge; y: the footprint's bottom (BH)
  if (kind === 'stairs') {
    R(c, x + 4, y - 34, 24, 34, '#14121a');
    for (let i = 0; i < 6; i++) R(c, x + 6, y - 6 - i * 5, 20, 2, shade('#5a5464', -i * 0.08));
    R(c, x + 4, y - 36, 24, 3, o.trim || '#3a3842');
    R(c, x + 7, y - 33, 18, 2, '#fff3c0'); // the stair light
    return;
  }
  if (kind === 'glass') {
    R(c, x + 3, y - 32, 26, 32, '#2a2a34');
    R(c, x + 4, y - 31, 11, 31, o.inside || '#cfe8f0'); R(c, x + 17, y - 31, 11, 31, o.inside || '#cfe8f0');
    R(c, x + 4, y - 31, 11, 3, '#ffffff'); R(c, x + 17, y - 31, 11, 3, '#ffffff');
    R(c, x + 15, y - 31, 2, 31, '#3a3a44');
    return;
  }
  if (kind === 'heavy') {
    R(c, x + 3, y - 34, 26, 34, '#101014'); R(c, x + 5, y - 32, 22, 32, '#22232a');
    R(c, x + 5, y - 32, 22, 1, '#3a3b44'); R(c, x + 22, y - 18, 3, 3, '#8a8c96');
    R(c, x + 12, y - 28, 8, 2, '#4a4c54'); // peephole plate
    return;
  }
  if (kind === 'wood') {
    R(c, x + 4, y - 30, 24, 30, '#4a2e1c'); R(c, x + 5, y - 29, 22, 29, '#6a4428');
    for (let xx = x + 7; xx < x + 27; xx += 4) R(c, xx, y - 29, 1, 29, '#5a3a22');
    return;
  }
  if (kind === 'club') {
    R(c, x + 1, y - 36, 30, 36, '#c9a227'); R(c, x + 3, y - 34, 26, 34, '#1a1218');
    R(c, x + 4, y - 33, 11, 33, '#2a1a26'); R(c, x + 17, y - 33, 11, 33, '#2a1a26');
    R(c, x + 13, y - 20, 1, 6, '#ffd23f'); R(c, x + 18, y - 20, 1, 6, '#ffd23f');
    R(c, x + 3, y - 3, 26, 3, '#8a1e2e'); // red carpet
  }
}
function parapet(c, W, col) {
  R(c, -2, -6, W + 4, 8, col); R(c, -2, -6, W + 4, 1, shade(col, 0.3)); R(c, -2, 1, W + 4, 1, shade(col, -0.35));
}
function billboard(c, W, s, live) {
  const bw = Math.min(W - 16, s.w || W - 24), bh = s.h || 26, bx = Math.round((W - bw) / 2), by = -10 - bh - 8;
  for (const lx of [bx + 8, bx + bw - 12]) { R(c, lx, by + bh, 3, 14, '#3a3a44'); R(c, lx + 1, by + bh, 1, 14, '#5a5a66'); }
  R(c, bx + 6, by + bh + 6, bw - 12, 2, '#3a3a44');
  R(c, bx - 2, by - 2, bw + 4, bh + 4, INK);
  R(c, bx, by, bw, bh, s.bg);
  R(c, bx, by, bw, 2, shade(s.bg, 0.3));
  sign(c, s.t, bx + bw / 2, by + bh / 2, s.size || 14, s.fg, { maxW: bw - 8, glow: s.glow });
  if (s.neon) live.push({ kind: 'frame', x: bx - 2, y: by - 2, w: bw + 4, h: bh + 4, col: s.neon, mode: s.mode || 'chase' });
  return { x: bx + bw / 2, y: by + bh / 2 };
}

// glow halo sprites (drawn additively in the room's drawOver)
const haloCache = new Map();
function halo(col, rad) {
  const key = col + rad;
  let cv = haloCache.get(key);
  if (cv) return cv;
  const [c2, c] = makeCanvas(rad * 2, rad * 2);
  const bands = [[1, 0.05], [0.72, 0.07], [0.46, 0.09]];
  for (const [k, a] of bands) {
    c.globalAlpha = a; c.fillStyle = col;
    const rr = rad * k;
    for (let y = -rr; y < rr; y += 2) { const hw = Math.sqrt(Math.max(0, rr * rr - y * y)); c.fillRect(Math.round(rad - hw), Math.round(rad + y), Math.round(hw * 2), 2); }
  }
  haloCache.set(key, c2);
  return c2;
}

// The painted look of one building. Returns { cv, live, glows } (canvas px; glows in units).
function facade(b) {
  const fx = b.fx || {};
  const key = JSON.stringify([b.w, b.h, b.door, fx]);
  const hit = facadeCache.get(key);
  if (hit) return hit;
  const W = b.w * 32, H = b.h * 32, dx = (b.door ?? Math.floor(b.w / 2)) * 32;
  const live = [], glows = [];
  const r = mulberry32((fx.seed || 7) * 7919 + b.w * 31 + b.h);
  const cv = bake('fac:' + key, W + MX * 2, H + MT + MB, (c) => {
    c.translate(MX, MT);
    const style = FACADES[fx.style] || FACADES.zakkyo;
    style(c, { W, H, dx, fx, live, glows, r, b });
    c.setTransform(1, 0, 0, 1, 0, 0);
    outline(c, { tint: 0.25 });
  });
  const res = { cv, live, glows };
  facadeCache.set(key, res);
  return res;
}
function drawLive(ctx, px, py, t, parts) {
  for (const p of parts) {
    const x = px + p.x / 2, y = py + p.y / 2, w = p.w / 2, h = p.h / 2;
    if (p.kind === 'frame') {
      let on = true;
      if (p.mode === 'blink') on = ((t + (p.ph || 0)) % 120) < 90;
      if (p.mode === 'flicker') on = !(((t * 7 + (p.ph || 0)) % 97) < 9 || ((t % 211) > 200));
      if (!on) continue;
      if (p.mode === 'chase') {
        const per = Math.round((w + h) * 2);
        const k = Math.floor(t / 3) % 4;
        ctx.fillStyle = p.col;
        for (let i = k; i < per; i += 4) {
          const s = i / 2;
          let qx, qy;
          if (s < w) { qx = x + s; qy = y; } else if (s < w + h) { qx = x + w - 0.5; qy = y + s - w; } else if (s < w * 2 + h) { qx = x + w - (s - w - h); qy = y + h - 0.5; } else { qx = x; qy = y + h - (s - w * 2 - h); }
          ctx.fillRect(hu(qx), hu(qy), 0.5, 0.5);
        }
        continue;
      }
      ctx.fillStyle = p.col;
      ctx.fillRect(x, y, w, 0.5); ctx.fillRect(x, y + h - 0.5, w, 0.5); ctx.fillRect(x, y, 0.5, h); ctx.fillRect(x + w - 0.5, y, 0.5, h);
    } else if (p.kind === 'lamp') {
      const on = p.mode === 'pulse' ? (t % 60) < 40 : p.mode === 'flicker' ? ((t * 13) % 89) > 6 : true;
      ctx.fillStyle = on ? p.col : shade(p.col, -0.5);
      ctx.fillRect(x, y, w, h);
      if (on && p.hi) { ctx.fillStyle = p.hi; ctx.fillRect(x + 0.5, y + 0.5, Math.max(0.5, w / 3), 0.5); }
    } else if (p.kind === 'bulbs') {
      // a row of marquee bulbs, every other one lit in turn
      const k = Math.floor(t / 8) % 2;
      for (let i = 0; i < p.n; i++) {
        ctx.fillStyle = (i + k) % 2 ? p.col : shade(p.col, -0.55);
        ctx.fillRect(x + i * p.step / 2, y, 1, 1);
      }
    } else if (p.kind === 'text') {
      const on = p.mode === 'blink' ? ((t + (p.ph || 0)) % 100) < 70 : true;
      if (on) ctx.drawImage(p.cv, x, y, p.cv.width / 2, p.cv.height / 2);
    }
  }
}
function decorate(b) {
  return (ctx, px, py, t) => {
    const f = facade(b);
    ctx.drawImage(f.cv, px - MX / 2, py - MT / 2, f.cv.width / 2, f.cv.height / 2);
    drawLive(ctx, px - MX / 2 + MX / 2, py, t, f.live);
  };
}
// a glowing text sprite (for live 'text' parts): crisp text with a 1px glow, on its own canvas
function glowText(str, size, col, glowCol) {
  const m = textMask(str, size);
  const w = m.cv.width + 4, h = m.cv.height + 4;
  return bake(`gt:${str}|${size}|${col}|${glowCol}`, w, h, (c) => sign(c, str, w / 2, h / 2, size, col, { glow: glowCol }));
}

const FACADES = {
  // ---------------------------------------------------------------- 雑居ビル
  zakkyo(c, o) {
    const { W, H, dx, fx, live, glows, r } = o;
    const wall = fx.wall || '#3c3a48';
    const GH = 44; // ground floor
    wallTex(c, 0, 0, W, H, wall, fx.tex || 'tile', r);
    R(c, 0, 0, 3, H, shade(wall, 0.12)); R(c, W - 4, 0, 4, H, shade(wall, -0.18));
    parapet(c, W, fx.trim || shade(wall, -0.2));
    if (fx.roof) { const p = billboard(c, W, fx.roof, live); glows.push({ x: p.x / 2, y: p.y / 2 - MT / 2 + MT / 2, col: fx.roof.glow || fx.roof.bg, r: 26 }); }
    else if (W >= 160) { R(c, W - 40, -14, 18, 10, '#5a5e6a'); R(c, W - 40, -14, 18, 2, '#7a7e8a'); disc(c, W - 31, -9, 3, '#3a3e48'); }
    // upper floors
    const side = fx.side || (dx > W / 2 ? 'left' : 'right');
    const sx = fx.signs && fx.signs.length ? (side === 'right' ? W - 24 : 6) : -100;
    const top = 10, bottom = H - GH;
    const pitch = 30;
    let fl = 0;
    for (let y = top; y + 22 <= bottom; y += pitch, fl++) {
      R(c, 2, y + pitch - 6, W - 6, 2, shade(wall, -0.16)); // floor slab
      const band = fx.bands && fx.bands[fl];
      const x0 = side === 'right' ? 8 : 30, x1 = side === 'right' ? W - 30 : W - 8;
      if (band) { hsign(c, x0, y + 2, x1 - x0, 18, band); if (band.neon) live.push({ kind: 'frame', x: x0 - 1, y: y + 1, w: x1 - x0 + 2, h: 20, col: band.neon, mode: band.mode || 'steady', ph: fl * 17 }); continue; }
      for (let x = x0; x + 16 <= x1; x += 22) {
        const k = r();
        const kind = fx.dark ? (k < 0.75 ? 'dark' : 'lit') : k < 0.42 ? 'lit' : k < 0.58 ? (fx.tint || '#ff8ac0') : k < 0.7 ? 'blind' : k < 0.8 ? '#b090ff' : 'dark';
        win(c, x, y + 3, 16, 16, kind, r);
      }
    }
    if (fx.signs && fx.signs.length) { sodeStack(c, sx, top, bottom - 4, fx.signs, live); glows.push({ x: (sx + 9) / 2, y: (top + (bottom - top) / 3) / 2, col: fx.signs[0].bg, r: 22 }); }
    // ground floor
    const gy = H - GH;
    R(c, 0, gy, W, GH, shade(wall, -0.12));
    R(c, 0, gy, W, 3, fx.trim || shade(wall, -0.25)); R(c, 0, gy + 3, W, 1, shade(wall, 0.1));
    const g = fx.ground || 'stairs';
    if (g === 'shop' || g === 'lobby') {
      const inside = fx.inside || '#ffe9b8';
      for (let x = 6; x < W - 6; x += 32) {
        if (x + 26 > dx && x < dx + 32) continue;
        R(c, x, gy + 8, 26, GH - 10, '#2a2a34'); R(c, x + 1, gy + 9, 24, GH - 12, inside);
        R(c, x + 1, gy + 9, 24, 3, '#ffffff');
        for (let i = 0; i < 3; i++) R(c, x + 3 + i * 8, gy + 18 + (i % 2) * 6, 5, 7, NEON_LIST[(i + Math.floor(x / 32)) % NEON_LIST.length]);
      }
      doorway(c, dx, H, 'glass', { inside });
      glows.push({ x: (dx + 16) / 2, y: (H - 16) / 2, col: inside, r: 20 });
    } else if (g === 'shutter') {
      for (let x = 4; x < W - 4; x += 1) if (!(x >= dx && x < dx + 32)) R(c, x, gy + 6, 1, GH - 6, (x % 4) ? '#6a6e7a' : '#545864');
      R(c, 4, gy + 6, W - 8, 2, '#8a8e98');
      doorway(c, dx, H, 'heavy');
    } else if (g === 'izakaya') {
      R(c, 0, gy + 4, W, GH - 4, '#5a3a24');
      for (let x = 2; x < W; x += 6) R(c, x, gy + 6, 1, GH - 8, '#4a2e1a');
      doorway(c, dx, H, 'wood');
      // noren
      R(c, dx + 3, H - 34, 26, 12, fx.noren || '#2a3a7a');
      for (let i = 1; i < 4; i++) R(c, dx + 3 + i * 6.5, H - 34, 1, 12, shade(fx.noren || '#2a3a7a', -0.35));
      for (const lx of [dx - 12, dx + 36]) if (lx > 0 && lx < W - 10) { live.push({ kind: 'lamp', x: lx, y: H - 38, w: 10, h: 14, col: '#ff5a3a', hi: '#ffd0a0', mode: 'steady' }); glows.push({ x: (lx + 5) / 2, y: (H - 31) / 2, col: '#ff6a3a', r: 14 }); }
    } else {
      // stairs + a small lit tenant board
      R(c, 4, gy + 8, W - 8, GH - 8, shade(wall, -0.2));
      doorway(c, dx, H, 'stairs', { trim: fx.trim });
      const bx = dx + 34 <= W - 18 ? dx + 34 : dx - 20;
      if (bx > 2) { R(c, bx, H - 34, 14, 22, '#1a1822'); for (let i = 0; i < 4; i++) R(c, bx + 2, H - 32 + i * 5, 10, 3, NEON_LIST[(i * 2 + (fx.seed || 0)) % NEON_LIST.length]); }
      glows.push({ x: (dx + 16) / 2, y: (H - 30) / 2, col: '#fff0c0', r: 12 });
    }
    if (fx.door) fx.door(c, o);
  },

  // ---------------------------------------------------------------- 交番
  koban(c, o) {
    const { W, H, dx, live, glows } = o;
    const wall = '#e4e0d6';
    // flat roof slab with a thick dark band
    R(c, -4, -2, W + 8, 14, '#3a3e4a'); R(c, -4, -2, W + 8, 2, '#5a5e6a'); R(c, -4, 10, W + 8, 2, '#24262e');
    wallTex(c, 0, 12, W, H - 12, wall, 'tile');
    R(c, 0, 12, 3, H - 12, shade(wall, 0.08)); R(c, W - 4, 12, 4, H - 12, shade(wall, -0.15));
    // the sign 「交番」 + KOBAN
    R(c, dx - 26, 16, 84, 22, '#ffffff'); R(c, dx - 27, 15, 86, 24, INK);
    R(c, dx - 26, 16, 84, 22, '#ffffff');
    sign(c, '交番', dx + 6, 24, 14, '#1a1a22');
    sign(c, 'KOBAN', dx + 40, 24, 8, '#2a4a8a');
    // the red lamp above the sign
    R(c, dx + 12, -14, 8, 4, '#2a2a30');
    live.push({ kind: 'lamp', x: dx + 10, y: -24, w: 12, h: 10, col: '#ff2a2a', hi: '#ffd0d0', mode: 'pulse' });
    glows.push({ x: (dx + 16) / 2, y: -19 / 2, col: '#ff3030', r: 22 });
    // windows either side, a notice board
    for (const x of [6, W - 30]) if (x + 24 < dx - 2 || x > dx + 34) { R(c, x - 1, 44, 26, 30, '#3a3e48'); R(c, x, 45, 24, 28, '#e8f4f8'); R(c, x, 45, 24, 3, '#ffffff'); R(c, x + 12, 45, 1, 28, '#9aa6b0'); }
    const nb = dx + 36 <= W - 24 ? dx + 36 : 6;
    R(c, nb, H - 40, 22, 18, '#8a6a3a'); R(c, nb + 1, H - 39, 20, 16, '#f2efe6');
    R(c, nb + 3, H - 37, 7, 8, '#ff9a9a'); R(c, nb + 12, H - 37, 7, 5, '#9ac8ff'); R(c, nb + 3, H - 27, 16, 2, '#5a5a66');
    doorway(c, dx, H, 'glass', { inside: '#f0fff6' });
    R(c, dx + 2, H - 36, 28, 3, '#3a3e4a');
    glows.push({ x: (dx + 16) / 2, y: (H - 18) / 2, col: '#e8fff0', r: 22 });
  },

  // ---------------------------------------------------------------- CLUB ステラ (キャバクラ)
  club(c, o) {
    const { W, H, dx, live, glows } = o;
    const wall = '#16121c';
    R(c, 0, 0, W, H, wall);
    for (let x = 8; x < W; x += 24) { R(c, x, 0, 1, H, '#2a2230'); R(c, x + 1, 0, 1, H, '#0e0a12'); }
    parapet(c, W, '#c9a227');
    // big name panel
    const py = 12, ph = 50;
    R(c, 10, py, W - 20, ph, '#0c0a10'); R(c, 10, py, W - 20, 1, '#3a2a40');
    R(c, 12, py + 2, W - 24, ph - 4, '#1e1028');
    sign(c, 'CLUB', W / 2, py + 12, 11, '#e8c8ff');
    live.push({ kind: 'text', x: W / 2 - 46, y: py + 18, cv: glowText('ステラ', 24, '#ffe9a0', '#c9a227'), mode: 'steady' });
    live.push({ kind: 'frame', x: 10, y: py, w: W - 20, h: ph, col: NEON.pink, mode: 'chase' });
    live.push({ kind: 'frame', x: 14, y: py + 4, w: W - 28, h: ph - 8, col: NEON.violet, mode: 'blink' });
    // the star
    const stx = W / 2 + 52, sty = py + 30;
    for (const [x, y] of [[0, -6], [-1, -4], [1, -4], [-6, -1], [-3, -1], [3, -1], [6, -1], [-2, 1], [2, 1], [-3, 3], [3, 3], [-4, 5], [4, 5], [0, 0], [-1, -1], [1, -1], [0, 2], [-1, 1], [1, 1]]) R(c, stx + x, sty + y, 2, 2, '#ffe9a0');
    glows.push({ x: W / 4, y: (py + ph / 2) / 2, col: NEON.pink, r: 34 });
    glows.push({ x: (W * 3) / 4, y: (py + ph / 2) / 2, col: NEON.violet, r: 30 });
    // mirrored panels and a lit price board (料金は店頭に表示: ぼったくり防止条例)
    for (let x = 14; x < W - 14; x += 30) { if (x + 26 > dx - 4 && x < dx + 36) continue; R(c, x, 72, 24, H - 120, '#2a2234'); R(c, x + 2, 74, 6, H - 124, '#3a3046'); }
    const pbx = dx + 40 <= W - 40 ? dx + 40 : 16;
    R(c, pbx, H - 64, 34, 40, '#c9a227'); R(c, pbx + 2, H - 62, 30, 36, '#fff8e8');
    sign(c, '料金', pbx + 17, H - 55, 8, '#5a3a10');
    for (let i = 0; i < 4; i++) R(c, pbx + 5, H - 47 + i * 5, 24, 2, '#a89a80');
    glows.push({ x: (pbx + 17) / 2, y: (H - 44) / 2, col: '#fff0c0', r: 12 });
    // potted plants and the door
    for (const px of [dx - 18, dx + 36]) if (px > 2 && px < W - 14) { R(c, px, H - 12, 12, 10, '#c9a227'); disc(c, px + 6, H - 22, 8, '#1f4a32'); disc(c, px + 4, H - 25, 5, '#2c6a46'); }
    doorway(c, dx, H, 'club');
    R(c, dx - 6, H - 44, 44, 6, '#c9a227'); R(c, dx - 6, H - 44, 44, 1, '#ffe9a0');
    live.push({ kind: 'bulbs', x: dx - 4, y: H - 42, n: 20, step: 4.2, col: '#ffe9a0' });
  },

  // ---------------------------------------------------------------- ゲームセンター
  gamecen(c, o) {
    const { W, H, dx, live, glows } = o;
    const wall = '#2a2448';
    wallTex(c, 0, 0, W, H, wall, 'panel');
    parapet(c, W, '#5a4ab0');
    // marquee sign
    const py = 10, ph = 40;
    R(c, 6, py, W - 12, ph, '#ffd23f'); R(c, 8, py + 2, W - 16, ph - 4, '#ff3e7f');
    R(c, 8, py + 2, W - 16, 3, '#ff8ab0');
    sign(c, 'GAME', W / 2 - 50, py + ph / 2, 22, '#ffffff', { shadow: '#7a1040' });
    sign(c, 'ネオン', W / 2 + 40, py + ph / 2, 18, '#ffe94a', { shadow: '#7a1040' });
    live.push({ kind: 'bulbs', x: 8, y: py - 3, n: Math.floor((W - 16) / 6), step: 6, col: '#fff3a0' });
    live.push({ kind: 'bulbs', x: 8, y: py + ph + 1, n: Math.floor((W - 16) / 6), step: 6, col: '#fff3a0' });
    glows.push({ x: W / 4, y: (py + ph / 2) / 2, col: NEON.pink, r: 36 }, { x: (W * 3) / 4, y: (py + ph / 2) / 2, col: NEON.yellow, r: 30 });
    // upper windows: a bright prize floor
    for (let x = 10; x + 20 < W - 6; x += 26) win(c, x, 58, 20, 22, ['#a0f0ff', '#ffb0e0', '#fff0a0'][(x / 26) % 3 | 0], o.r);
    sign(c, '2F プリントシール・メダル', W / 2, 90, 9, '#ffffff', { maxW: W - 20 });
    // the glass front with crane machines behind
    const gy = H - 50;
    R(c, 0, gy, W, 50, '#1a1630'); R(c, 0, gy, W, 3, '#ffd23f');
    for (let x = 6; x + 30 <= W - 4; x += 34) {
      if (x + 30 > dx && x < dx + 32) continue;
      R(c, x, gy + 6, 30, 42, '#2a2a3a'); R(c, x + 1, gy + 7, 28, 40, '#cfe8ff');
      R(c, x + 3, gy + 9, 24, 22, ['#ffd0e8', '#d0f0ff', '#fff0c0'][(x / 34) % 3 | 0]);
      for (let i = 0; i < 4; i++) disc(c, x + 7 + i * 5, gy + 26, 3, NEON_LIST[(i + x) % NEON_LIST.length]);
      R(c, x + 13, gy + 9, 2, 8, '#8a8e98'); R(c, x + 11, gy + 16, 6, 2, '#c9ccd2');
      R(c, x + 3, gy + 34, 24, 10, '#ff4fa0'); R(c, x + 5, gy + 36, 8, 3, '#ffffff');
    }
    doorway(c, dx, H, 'glass', { inside: '#fff0ff' });
    glows.push({ x: (dx + 16) / 2, y: (H - 20) / 2, col: '#ffd0ff', r: 26 });
  },

  // ---------------------------------------------------------------- ドットローン (消費者金融)
  loan(c, o) {
    const { W, H, dx, live, glows } = o;
    const wall = '#eef0f2';
    wallTex(c, 0, 0, W, H, wall, 'panel');
    parapet(c, W, '#2f9a6a');
    R(c, 0, 8, W, 26, '#2f9a6a'); R(c, 0, 8, W, 2, '#5ac08a'); R(c, 0, 32, W, 2, '#1f7a52');
    sign(c, 'ドットローン', W / 2, 21, 16, '#ffffff', { shadow: '#1f6a42' });
    glows.push({ x: W / 4, y: 21 / 2, col: '#7affc0', r: 24 }, { x: (W * 3) / 4, y: 21 / 2, col: '#7affc0', r: 24 });
    for (let x = 8; x + 22 <= W - 6; x += 28) win(c, x, 42, 22, 18, 'blind', o.r);
    R(c, 6, H - 58, W - 12, 12, '#ffffff'); R(c, 6, H - 58, W - 12, 1, '#c8ccd2');
    sign(c, 'ご相談窓口', W / 2, H - 52, 9, '#2f7a52');
    const gy = H - 44;
    R(c, 0, gy, W, 44, '#d8dce2');
    for (let x = 6; x + 26 <= W - 6; x += 32) { if (x + 26 > dx && x < dx + 32) continue; R(c, x, gy + 6, 26, 36, '#2a2a34'); R(c, x + 1, gy + 7, 24, 34, '#e8fff4'); R(c, x + 1, gy + 7, 24, 4, '#ffffff'); R(c, x + 5, gy + 20, 16, 2, '#2f9a6a'); }
    doorway(c, dx, H, 'glass', { inside: '#e8fff4' });
    glows.push({ x: (dx + 16) / 2, y: (H - 20) / 2, col: '#e0fff0', r: 24 });
  },

  // ---------------------------------------------------------------- 鬼灯興業 (組事務所)
  kumi(c, o) {
    const { W, H, dx, live, glows } = o;
    const wall = '#5a5c62';
    wallTex(c, 0, 0, W, H, wall, 'concrete', o.r);
    R(c, 0, 0, 3, H, shade(wall, 0.1)); R(c, W - 4, 0, 4, H, shade(wall, -0.2));
    parapet(c, W, '#3a3c42');
    // windows: steel plates and frosted glass with bars
    for (let y = 14; y + 24 < H - 46; y += 34) for (let x = 12; x + 24 <= W - 10; x += 34) {
      if ((x / 34 + y / 34) % 2 < 1) win(c, x, y, 24, 22, 'plate', o.r);
      else { win(c, x, y, 24, 22, '#8a9098', o.r); for (let bx = x + 3; bx < x + 24; bx += 5) R(c, bx, y, 1, 22, '#2a2c32'); }
    }
    // security cameras (their red LEDs blink)
    for (const [x, y, d] of [[6, 10, 1], [W - 18, 10, -1], [dx - 10, H - 50, 1]]) {
      R(c, x, y, 12, 6, '#d8dade'); R(c, x, y, 12, 1, '#ffffff'); R(c, x + (d > 0 ? 10 : 0), y + 1, 2, 4, '#20222a');
      R(c, x + 5, y - 4, 2, 4, '#8a8c96');
      live.push({ kind: 'lamp', x: x + (d > 0 ? 2 : 8), y: y + 2, w: 2, h: 2, col: '#ff2a2a', mode: 'pulse' });
    }
    // the door, a small nameplate, a dim lamp
    const gy = H - 46;
    R(c, 0, gy, W, 46, '#46484e'); R(c, 0, gy, W, 3, '#2a2c32');
    doorway(c, dx, H, 'heavy');
    R(c, dx + 36, H - 36, 22, 14, '#c9a86a'); R(c, dx + 37, H - 35, 20, 12, '#e8d8a8');
    sign(c, '鬼灯興業', dx + 47, H - 29, 6, '#3a2a10', { bold: false });
    R(c, dx + 10, H - 46, 12, 4, '#2a2a30');
    live.push({ kind: 'lamp', x: dx + 11, y: H - 43, w: 10, h: 2, col: '#e8b86a', mode: 'flicker' });
    glows.push({ x: (dx + 16) / 2, y: (H - 40) / 2, col: '#c8904a', r: 12 });
  },

  // ---------------------------------------------------------------- パチンコ (flavour)
  pachinko(c, o) {
    const { W, H, dx, live, glows } = o;
    R(c, 0, 0, W, H, '#f4f0e8');
    for (let y = 6; y < H - 60; y += 10) R(c, 0, y, W, 4, y % 20 ? '#ffd23f' : '#ff4a4a');
    parapet(c, W, '#d62f2f');
    R(c, 8, 14, W - 16, 44, '#d62f2f'); R(c, 10, 16, W - 20, 40, '#ffffff');
    sign(c, 'パチンコ', W / 2, 30, 16, '#d62f2f');
    sign(c, 'ドットホール', W / 2, 48, 11, '#1a3a8a');
    live.push({ kind: 'frame', x: 8, y: 14, w: W - 16, h: 44, col: '#ffe94a', mode: 'chase' });
    for (const y of [64, 74, 84]) live.push({ kind: 'bulbs', x: 6, y, n: Math.floor((W - 12) / 6), step: 6, col: ['#ff4a4a', '#ffe94a', '#4fe0ff'][(y / 10) % 3 | 0] });
    glows.push({ x: W / 4, y: 18, col: '#ffe94a', r: 34 }, { x: (W * 3) / 4, y: 18, col: '#ff4a4a', r: 34 });
    const gy = H - 50;
    R(c, 0, gy, W, 50, '#2a2a34');
    for (let x = 6; x + 26 <= W - 6; x += 30) { if (x + 26 > dx - 4 && x < dx + 36) continue; R(c, x, gy + 6, 26, 42, '#fff0c8'); R(c, x + 2, gy + 10, 22, 4, '#ffffff'); }
    doorway(c, dx, H, 'glass', { inside: '#fff0c8' });
    if (o.fx.closed) { R(c, dx + 6, H - 24, 20, 8, '#ffffff'); sign(c, '休業', dx + 16, H - 20, 6, '#d62f2f', { bold: false }); }
  },

  // ---------------------------------------------------------------- 映画館 ネオン座 (closed; flavour)
  cinema(c, o) {
    const { W, H, dx, live, glows } = o;
    const wall = '#6a3a2e';
    wallTex(c, 0, 0, W, H, wall, 'tile');
    parapet(c, W, '#3a1e16');
    // the classic vertical sign
    const vx = W - 28;
    R(c, vx - 1, 4, 22, 92, INK); R(c, vx, 5, 20, 90, '#f4e8c8');
    vsign(c, 'ネオン座', vx + 10, 10, 13, '#a81e1e', 20);
    live.push({ kind: 'frame', x: vx - 1, y: 4, w: 22, h: 92, col: '#ffe9a0', mode: 'chase' });
    glows.push({ x: (vx + 10) / 2, y: 50 / 2, col: '#ffe9a0', r: 26 });
    // marquee + poster cases
    R(c, 8, 22, vx - 18, 26, '#1a1210'); R(c, 10, 24, vx - 22, 22, '#fff8e0');
    sign(c, '本日休館', (vx - 8) / 2 + 4, 35, 11, '#3a2a1a');
    live.push({ kind: 'bulbs', x: 8, y: 50, n: Math.floor((vx - 18) / 6), step: 6, col: '#ffe9a0' });
    for (let x = 10; x + 24 <= vx - 8; x += 30) {
      R(c, x, 60, 24, 34, '#c9a227'); R(c, x + 2, 62, 20, 30, ['#2a3a6a', '#6a2a3a', '#2a5a3a'][(x / 30) % 3 | 0]);
      disc(c, x + 12, 72, 5, '#f0d8b0'); R(c, x + 5, 84, 14, 3, '#ffe9a0');
    }
    const gy = H - 44;
    for (let x = 4; x < W - 4; x++) if (!(x >= dx && x < dx + 32)) R(c, x, gy + 4, 1, 40, x % 4 ? '#6a6e7a' : '#545864');
    doorway(c, dx, H, 'heavy');
  },

  // ---------------------------------------------------------------- 居酒屋 ほろよい / 牛丼 (low eateries)
  izakaya(c, o) {
    const { W, H, dx, fx, live, glows } = o;
    // tiled eave roof
    R(c, -4, -2, W + 8, 18, '#3a3e4a');
    for (let x = -4; x < W + 4; x += 6) { R(c, x, -2, 1, 18, '#2a2e38'); R(c, x + 1, -2, 1, 18, '#4a4e5a'); }
    R(c, -4, 14, W + 8, 3, '#24262e');
    wallTex(c, 0, 17, W, H - 17, fx.wall || '#c8b490', 'tile');
    const sw = Math.min(W - 16, 110);
    R(c, (W - sw) / 2 - 2, 22, sw + 4, 28, INK); R(c, (W - sw) / 2, 24, sw, 24, fx.board || '#f4ecd8');
    sign(c, fx.name || '居酒屋', W / 2, 36, 14, fx.ink || '#2a1a10', { maxW: sw - 8 });
    glows.push({ x: W / 4, y: 36 / 2, col: '#ffe0a0', r: 22 }, { x: (W * 3) / 4, y: 36 / 2, col: '#ffe0a0', r: 22 });
    // lattice windows lit warm
    for (let x = 8; x + 26 <= W - 6; x += 34) {
      if (x + 26 > dx - 2 && x < dx + 34) continue;
      R(c, x, H - 44, 26, 26, '#3a2414'); R(c, x + 1, H - 43, 24, 24, '#ffd890');
      for (let k = 1; k < 4; k++) { R(c, x + 1 + k * 6, H - 43, 1, 24, '#6a4428'); R(c, x + 1, H - 43 + k * 6, 24, 1, '#6a4428'); }
    }
    doorway(c, dx, H, 'wood');
    R(c, dx + 3, H - 34, 26, 12, fx.noren || '#2a3a7a');
    for (let i = 1; i < 4; i++) R(c, dx + 3 + i * 6.5, H - 34, 1, 12, shade(fx.noren || '#2a3a7a', -0.35));
    sign(c, fx.norenText || '酒', dx + 16, H - 28, 8, '#ffffff', { bold: false });
    for (const lx of [dx - 12, dx + 34]) if (lx > 0 && lx < W - 10) {
      live.push({ kind: 'lamp', x: lx, y: H - 40, w: 10, h: 14, col: '#ff5a3a', hi: '#ffd0a0', mode: 'steady' });
      glows.push({ x: (lx + 5) / 2, y: (H - 33) / 2, col: '#ff6a3a', r: 14 });
    }
  },
};

// ====================================================================== props
// The neon gate over 一番通り: pillars at x and x+6 (solid signs), arch drawn above the row.
function neonGate(x, y) {
  return {
    type: 'prop', x, y, w: 7, h: 1, solid: false, z: 2,
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('gate', 7 * 32, 112, paintGate), sx, sy - 40);
      const t = g.frame;
      // chasing bulbs along the arch and a blinking star
      const k = Math.floor(t / 6) % 3;
      for (let i = 0; i < 34; i++) { U(ctx, sx + 9 + i * 2.75, sy - 35, 1, 1, (i + k) % 3 ? '#fff3a0' : '#7a6a3a'); U(ctx, sx + 9 + i * 2.75, sy - 18, 1, 1, (i + k + 1) % 3 ? '#fff3a0' : '#7a6a3a'); }
      if ((t % 90) < 70) U(ctx, sx + 54, sy - 33, 4, 0.5, NEON.pink);
    },
  };
}
function paintGate(c) {
  // pillars (0..32 and 192..224 px), the arch (y 8..48)
  for (const x of [6, 6 * 32 + 6]) {
    R(c, x, 24, 20, 88, '#2a2632'); R(c, x + 2, 24, 4, 88, '#4a4456'); R(c, x + 16, 24, 4, 88, '#1a1820');
    R(c, x - 2, 100, 24, 12, '#3a3642'); R(c, x - 2, 100, 24, 2, '#5a5464');
    for (let y = 34; y < 96; y += 14) { R(c, x + 6, y, 8, 8, '#ffe9a0'); R(c, x + 7, y + 1, 3, 2, '#ffffff'); }
  }
  R(c, 0, 6, 7 * 32, 44, INK);
  R(c, 2, 8, 7 * 32 - 4, 40, '#3a1030');
  R(c, 4, 10, 7 * 32 - 8, 36, '#c8143c');
  R(c, 4, 10, 7 * 32 - 8, 3, '#ff5a7a');
  R(c, 4, 43, 7 * 32 - 8, 3, '#8a0a24');
  sign(c, 'ネオン街一番通り', 7 * 16, 28, 16, '#fff6c8', { shadow: '#5a0018', maxW: 7 * 32 - 30 });
  R(c, 4, 0, 7 * 32 - 8, 6, '#2a2632');
}
// 喫煙所: a partitioned smoking booth (from 2005), before that an ashtray stand
function smokingSpot(x, y) {
  return {
    type: 'prop', x, y, w: 3, h: 2, solid: true,
    talk: (g) => smokingSpotTalk(g),
    draw(ctx, sx, sy, g) {
      const booth = since(g, 2005, 8);
      blit(ctx, bake(booth ? 'kitsuen' : 'haizara', 3 * 32, 2 * 32 + 30, booth ? paintBooth : paintAshtray), sx, sy - 15);
    },
  };
}
function paintBooth(c) {
  const T = 30; // top margin
  R(c, 2, T + 20, 92, 42, '#1a1820');
  R(c, 4, T + 22, 88, 38, '#9aa8b8'); // frosted glass
  for (let x = 4; x < 92; x += 22) { R(c, x, T + 22, 2, 38, '#5a6070'); }
  R(c, 4, T + 22, 88, 3, '#c8d4e0');
  R(c, 4, T + 46, 88, 14, '#7a8494');
  R(c, 0, T + 10, 96, 12, '#2a2a34'); R(c, 2, T + 12, 92, 8, '#3a8a5a');
  sign(c, '喫煙所', 48, T + 16, 8, '#ffffff', { bold: false });
  // smoke rising from inside
  for (const [x, y] of [[30, T + 4], [34, T], [62, T + 2], [66, T - 3]]) { c.globalAlpha = 0.35; R(c, x, y, 6, 4, '#d8d8e0'); c.globalAlpha = 1; }
  R(c, 40, T + 50, 16, 10, '#2a2a30'); R(c, 38, T + 48, 20, 3, '#5a5e68'); // ashtray can inside
}
function paintAshtray(c) {
  const T = 30;
  R(c, 40, T + 30, 16, 30, '#7a7e88'); R(c, 40, T + 30, 4, 30, '#9aa0aa'); R(c, 36, T + 26, 24, 6, '#5a5e68'); R(c, 36, T + 26, 24, 1, '#8a8e98');
  R(c, 38, T + 58, 20, 4, '#3a3e48');
  sign(c, '灰皿', 48, T + 44, 8, '#ffffff', { bold: false });
}
// a fortune teller's little table with a lantern
function fortuneTable(x, y, talk) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true, talk,
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('uranai', 32, 48, (c) => {
        R(c, 2, 26, 28, 18, '#1a1430'); R(c, 2, 26, 28, 3, '#5a3a8a'); R(c, 4, 29, 24, 14, '#3a2a5a');
        R(c, 6, 30, 20, 4, '#f4ecd8'); sign(c, '占', 16, 38, 8, '#ffe9a0', { bold: false });
        R(c, 20, 6, 8, 18, '#e8d0a0'); R(c, 20, 6, 8, 2, '#a83a2a'); R(c, 20, 22, 8, 2, '#a83a2a'); R(c, 23, 24, 2, 3, '#3a2a1a');
        disc(c, 10, 22, 4, '#a0c8ff'); P(c, 9, 21, '#ffffff');
      }), sx, sy - 8);
      if ((g.frame % 80) < 70) U(ctx, sx + 11, sy - 3, 2, 1, '#fff0b0');
    },
  };
}
// an open guitar case in front of the street musician
function guitarCase(x, y, talk) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true, talk,
    draw(ctx, sx, sy) {
      blit(ctx, bake('gcase', 32, 32, (c) => {
        shadowEllipse(c, 16, 27, 12, 2);
        R(c, 3, 12, 26, 14, '#1a1a1e'); R(c, 4, 13, 24, 12, '#8a1e3a'); R(c, 4, 13, 24, 2, '#b83a5a');
        for (const [x0, y0] of [[9, 17], [14, 19], [19, 16], [22, 20]]) { disc(c, x0, y0, 2, '#d8c060'); P(c, x0 - 1, y0 - 1, '#fff6c0'); }
        R(c, 6, 4, 20, 6, '#f4ecd8'); sign(c, 'LIVE', 16, 7, 6, '#3a2a1a', { bold: false });
      }), sx, sy);
    },
  };
}
// a can cart (the man in the park collects cans for recycling)
function canCart(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true,
    text: ['リヤカーに、つぶした空き缶の袋がきちんと積まれている。', '一つひとつ、ていねいに分けてあるようだ。'],
    draw(ctx, sx, sy) {
      blit(ctx, bake('cart', 32, 40, (c) => {
        shadowEllipse(c, 16, 35, 13, 2);
        R(c, 2, 14, 28, 14, '#5a6070'); R(c, 2, 14, 28, 2, '#7a8090');
        for (const [x0, col] of [[4, '#c8ccd2'], [12, '#a8c8e8'], [20, '#d8d4c8']]) { R(c, x0, 4, 8, 12, col); R(c, x0, 4, 8, 2, '#ffffff'); }
        disc(c, 8, 31, 4, '#1a1a20'); disc(c, 24, 31, 4, '#1a1a20'); P(c, 8, 31, '#8a8e98'); P(c, 24, 31, '#8a8e98');
        outline(c, { tint: 0.3 });
      }), sx, sy - 8);
    },
  };
}
// the NPO's folding table with leaflets and a small banner
function npoTable(x, y, talk) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true, talk,
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('npo', 32, 48, (c) => {
        R(c, 4, 4, 2, 24, '#8a8e98'); R(c, 26, 4, 2, 24, '#8a8e98');
        R(c, 4, 4, 24, 12, '#ffffff'); R(c, 4, 4, 24, 2, '#5ac08a');
        sign(c, '相談', 16, 11, 8, '#2f7a52', { bold: false });
        R(c, 1, 26, 30, 4, '#c8b48a'); R(c, 1, 26, 30, 1, '#e8d8b0');
        R(c, 3, 30, 2, 14, '#7a6a4a'); R(c, 27, 30, 2, 14, '#7a6a4a');
        for (let i = 0; i < 4; i++) R(c, 5 + i * 6, 23, 5, 4, ['#ffffff', '#ffe0a0', '#d0f0ff', '#ffd0e0'][i]);
        R(c, 20, 18, 6, 8, '#e8f0ff'); R(c, 21, 19, 4, 2, '#5a8ac8'); // the pot of warm tea
      }), sx, sy - 16);
    },
  };
}
// telephone-pole stickers for illegal lenders (闇金のチラシ)
function poleStickers(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: true,
    talk: async (g) => {
      await g.say(['電柱に、べたべたとチラシが貼ってある。', '「即日融資」「ブラックOK」「審査なし」…\n電話番号は、どれも携帯の番号だ。']);
      await g.say(['（こういうのが「闇金」の手口だ。\n登録のない業者が、法律の上限をはるかにこえる利息で貸す。）', '（借りた人を、取り立てで追いつめる…。\n困ったときの相談先は、警察・弁護士・区役所だ）']);
    },
    draw(ctx, sx, sy) {
      blit(ctx, bake('pole', 32, 96, (c) => {
        shadowEllipse(c, 16, 93, 7, 2);
        R(c, 12, 0, 8, 94, '#5a5650'); R(c, 12, 0, 2, 94, '#7a766e'); R(c, 18, 0, 2, 94, '#3a3632');
        R(c, 4, 8, 24, 3, '#3a3632');
        for (const [yy, col] of [[30, '#ffef5a'], [44, '#ffffff'], [56, '#ff9aba'], [68, '#ffef5a']]) { R(c, 10, yy, 12, 10, col); R(c, 11, yy + 2, 10, 2, '#d23a3a'); R(c, 11, yy + 6, 7, 1, '#3a3a3a'); }
        outline(c, { tint: 0.3 });
      }), sx, sy - 64);
    },
  };
}
// a painted 路上喫煙禁止 decal on the paving (only where/when the ordinance applies)
function decal(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, z: -400,
    cond: (g) => since(g, 2005, 8),
    talk: (g) => noSmokingSign(g),
    draw(ctx, sx, sy) { ctx.drawImage(tileImageHD('kanraku_decal'), sx, sy, 16, 16); },
  };
}

// ====================================================================== shared crime choices (used by shops)
// 万引き at a shop shelf: a clear warning, then g.commitCrime('shoplifting'). The core decides
// whether the store notices now (the back office → 警察) or the cameras find it later.
async function shoplift(g, opts = {}) {
  const items = (opts.items || ['onigiri']).filter((id) => ITEMS[id]);
  if (!items.length || typeof g.commitCrime !== 'function') return { done: false };
  const j = jus(g);
  if (j && (j.status === 'detained' || j.status === 'prison')) return { done: false };
  const k = await g.ask([
    '（棚の商品が目に入った。\n…お金を払わずに、持って出てしまえば――）',
    '万引きは「窃盗罪」という犯罪だ。\n店には防犯カメラも、見回りの店員もいる。',
    '見つかれば警察に通報され、前科がつくこともある。\n仕事も信用も、すべてを失いかねない…。',
  ], ['やめておく', '万引きする…'], { cancel: 0 });
  if (k !== 1) { await narrate(g, '（手をひっこめた。\n…ほしい物は、ちゃんとお金を払って買おう）'); return { done: false }; }
  let item = items[0];
  if (items.length > 1) {
    const i = await g.list({ title: '何をとる…？', items: items.map((id) => ({ label: ITEMS[id].name, right: fmtMoney(ITEMS[id].price) })), x: 150, y: 70, w: 340, px: true });
    if (i < 0) { await narrate(g, '（…やっぱり、やめておこう）'); return { done: false }; }
    item = items[i];
  }
  const amount = Math.max(100, ITEMS[item].price || 300);
  await narrate(g, `（${ITEMS[item].name}を、そっとかばんに入れた…）`);
  const res = await g.commitCrime('shoplifting', { amount, where: opts.where, gain: { item } });
  if (!res.caught) {
    g.addNeed('stress', 8);
    await narrate(g, ['（何事もなく、店を出た…。\nでも、胸のどきどきがおさまらない）', '（防犯カメラには、映っていたかもしれない。\nあとから警察が来ることだってある…）']);
  }
  return { done: true, caught: !!res.caught, res };
}
// タバコ / お酒 at a counter: the age check (二十歳未満には売れない), then the core's buyCigarettes.
async function tobaccoCounter(g, npc, opts = {}) {
  const o = npc ? who(npc) : {};
  const k = await g.ask('レジの後ろに、タバコとお酒が並んでいる。\n「二十歳未満の方には販売できません」', ['やめておく', 'タバコ（1箱）', 'お酒（缶ビール）'], { cancel: 0 });
  if (k <= 0) return null;
  const minor = age(g) < 20;
  if (since(g, 2000)) await g.say(minor ? 'いらっしゃいませ。\n…恐れ入ります、年齢確認のため\n身分証を見せていただけますか？' : '年齢確認のため、\n画面の「はい」を押してください。', o);
  if (k === 1) {
    if (typeof g.buyCigarettes !== 'function') return null;
    const r = g.buyCigarettes(1, { counter: true });
    if (!r.ok) {
      await g.say(minor ? ['申し訳ありません。\n二十歳未満の方には、タバコは販売できないんです。', r.reason] : r.reason, minor ? o : {});
      if (minor) K(g).refusedTabako = (K(g).refusedTabako || 0) + 1;
      return r;
    }
    g.sfx('coin');
    await g.say(`タバコを1箱買った。（${fmtMoney(r.price)}）\n（吸うと少し気が晴れる。でも、体にはよくない…）`);
    return r;
  }
  if (minor) {
    await g.say(['申し訳ありません。\nお酒は、二十歳になってからなんです。', '（売った店も法律で罰せられる。\nお店の人は、きっちり断った）'], o);
    K(g).refusedSake = (K(g).refusedSake || 0) + 1;
    return { ok: false, reason: 'minor' };
  }
  const price = ITEMS.kanraku_beer ? ITEMS.kanraku_beer.price : 250;
  if (!g.spend(price)) { await g.say('お金が足りない…。'); return { ok: false, reason: 'money' }; }
  g.giveItem('kanraku_beer', 1, true);
  g.sfx('coin');
  await g.say(`缶ビールを買った。（${fmtMoney(price)}）`);
  return { ok: true, price };
}
// 無賃乗車 at a ticket gate: a warning, the ride (opts.ride), then the arrival gate decides.
async function fareEvasion(g, opts = {}) {
  if (typeof g.commitCrime !== 'function') return { ok: false };
  const j = jus(g);
  if (j && (j.status === 'detained' || j.status === 'prison')) return { ok: false };
  const k = await g.ask([
    '（きっぷを買わずに、ほかの人のうしろについて\n改札を抜けてしまえば…）',
    '無賃乗車は、鉄道営業法違反。見つかれば、\n運賃に加えて2倍の「増運賃」――合計3倍を払う。\nくり返せば、詐欺罪で警察沙汰になることも…',
  ], ['やめておく', 'きっぷを買わずに乗る'], { cancel: 0 });
  if (k !== 1) { await narrate(g, '（…やっぱり、きっぷを買おう）'); return { ok: false }; }
  await narrate(g, '（人ごみにまぎれて、改札を抜けた…）');
  if (opts.ride) await opts.ride();
  const res = await g.commitCrime('fare_evasion', { fare: opts.fare, where: `${opts.dest || '駅'}の改札` });
  if (!res.caught) {
    g.addNeed('stress', 6);
    await narrate(g, ['（到着した駅の改札も、なんとか抜けた…）', '（…でも、駅には防犯カメラも改札の記録もある。\n次も見逃してもらえるとはかぎらない）']);
  }
  return { ok: true, caught: !!res.caught, res };
}
export const KANRAKU_API = { shoplift, tobaccoCounter, fareEvasion };

registerItem('kanraku_beer', {
  name: '缶ビール', price: 250,
  desc: '冷えた缶ビール。飲むと少し気が晴れる。\n二十歳から。飲みすぎに注意。',
  use: async (g) => {
    g.takeItem('kanraku_beer');
    const home = g.map && g.housing && g.map.placeId === g.housing().place;
    const n = (K(g).beerDay === today(g) ? K(g).beers || 0 : 0) + 1;
    K(g).beerDay = today(g); K(g).beers = n;
    g.sfx('good');
    await g.say(n === 1 ? 'プシュッ…ごくごく。\nはぁ〜、しみる…！' : n === 2 ? '2本目の缶ビールを開けた。' : 'また缶ビールを開けた…。\n（ちょっと飲みすぎかもしれない）');
    if (typeof g.drinkAlcohol === 'function') await g.drinkAlcohol({ private: !!home, relief: n === 1 ? 8 : n === 2 ? 4 : 1, heavy: n >= 3, where: g.map && g.map.place ? g.map.place.name : '' });
  },
});
registerItem('kanraku_wallet', { name: '拾った財布', price: 0, desc: 'ネオン街で拾った黒い財布。\n交番に届けよう。' });
registerItem('kanraku_card', {
  name: '相談窓口カード', price: 0,
  desc: 'NPOの人にもらった、困ったときの相談先のカード。\n使うと、内容を読める。',
  use: async (g) => { await g.say(helplinePages(g)); },
});

// ====================================================================== era-aware help (shared by the NPO, the 交番 …)
function npoName(g) { return since(g, 1998, 12) ? 'NPOの相談員' : '支援団体の相談員'; }
function helplinePages(g) {
  const p = [];
  p.push('【困ったときの相談先】\n・危ないとき、脅されたとき：110番\n・闇金・ストーカー：警察署の生活安全課' + (since(g, 2009) ? '（#9110）' : ''));
  p.push('・借金：' + (since(g, 2007, 4) ? '区役所・市役所の多重債務相談窓口、' : '消費生活センター、') + (since(g, 2006, 10) ? '法テラス、' : '') + '弁護士会の法律相談' + (since(g, 2015, 7) ? '\n・契約や悪質商法：消費者ホットライン「188」' : ''));
  p.push('・暮らしに困ったら：区役所の福祉の窓口' + (since(g, 2015, 4) ? '\n（生活保護・生活困窮者の自立相談支援）' : '（生活保護の相談）') + '\n・暴力団のこと：' + (since(g, 1992, 3) ? '暴力追放運動推進センター、警察' : '警察'));
  p.push('・お酒・ギャンブル・クスリがやめられない：\n' + (since(g, 1995, 7) ? '精神保健福祉センター、保健所、自助グループ' : '保健所、自助グループ') + '\nひとりで抱えこまないで。');
  return p;
}
function playerCall(g) { const x = g.state.profile && g.state.profile.gender; return x === 'f' ? 'お姉さん' : x === 'm' ? 'お兄さん' : 'お客さん'; }
function phone110(g) { return eraKey(g) === 'reiwa' ? 'スマホで110番した' : since(g, 1999) ? 'ケータイで110番した' : '近くの公衆電話に走って、110番した'; }

// ====================================================================== town scripts
async function smokingSpotTalk(g) {
  const j = jus(g);
  const has = g.hasItem('tabako') || !!(j && j.smoke && j.smoke.cigs > 0);
  const booth = since(g, 2005, 8);
  if (!has) {
    await g.say(booth ? ['仕切りで囲まれた「喫煙所」だ。', 'このあたりは路上喫煙禁止地区。\nタバコを吸う人は、ここで吸うことになっている。'] : ['大きな灰皿が置いてある。', '通りがかりの人が、ここで一服していく。']);
    return;
  }
  const minor = age(g) < 20;
  const k = await g.ask(minor ? '（タバコを持っている…。\nでも、二十歳未満の喫煙は法律で禁止されている）' : booth ? '喫煙所だ。一服していく？' : '灰皿だ。一服していく？', ['やめておく', minor ? '吸う…' : '一服する'], { cancel: 0 });
  if (k !== 1) return;
  if (typeof g.smoke === 'function') await g.smoke({ place: 'kanraku_kitsuen' });
}
async function noSmokingSign(g) {
  const rule = typeof g.canSmokeHere === 'function' ? g.canSmokeHere('kanraku') : null;
  if (!rule || rule.ok) { await g.say('「吸い殻のポイ捨てはやめましょう」と書いてある。'); return; }
  await g.say([`「路上喫煙禁止地区」\n${rule.law || '区の条例'}`, rule.fine ? `違反すると、過料${YEN_MARK}${Number(rule.fine).toLocaleString('ja-JP')}円。\nタバコは、大通りの「喫煙所」で。` : 'タバコは、指定の喫煙所で。']);
}
async function busKanraku(g) {
  const dests = [{ label: '東京駅前', place: 'tokyo', x: 53, y: 31 }];
  if (PLACES.machi) dests.push({ label: 'ドット商店街', place: 'machi', x: 38, y: 20, flag: 'machi_intro' });
  if (PLACES.minato) dests.push({ label: 'テレビ局エリア', place: 'minato', x: 35, y: 28, flag: 'minato_intro' });
  const i = await g.ask('バス停だ。\nどこ行きのバスに乗る？（¥210）', [...dests.map((d) => d.label), 'やめておく'], { cancel: dests.length });
  if (i < 0 || i >= dests.length) return;
  const d = dests[i];
  if (!g.spend(210)) { await g.say('運賃が足りない…。\n歩いていこう。（大通りから北へ行けば東京エリア）'); return; }
  g.sfx('coin');
  const first = d.flag && !g.flag(d.flag);
  await g.fadeOut(16);
  g.sfx('door');
  await g.wait(600);
  await g.goto(d.place, 'main', d.x, d.y, 'down');
  if (!first) await g.say(`ブロロロ…。\n${d.label}でバスを降りた。`);
}

// ---------------------------------------------------------------- 客引き (illegal touting) and ぼったくり
const TOUT = { name: '客引き', look: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#1e1e26', bottom: '#2a2a30', jacket: true, tie: '#c9a227' } };
async function toutTalk(g, npc) {
  const o = who(npc);
  if (age(g) < 20) {
    await g.say([`${playerCall(g)}、一杯どうっすか？\n…って、あれ、もしかして未成年？`, 'あー、じゃあダメだわ。\nほら、早く帰んな。'], o);
    return;
  }
  await g.say([`${playerCall(g)}、一杯どうっすか？\nうち、60分3,000円ポッキリ！`, 'すぐそこ、すぐそこっすよ。\n楽しいお店っす、マジで！'], o);
  const k = await g.ask('（しつこくついてくる…。どうしよう？）', ['無視する', 'ついていく', '交番に知らせる'], { cancel: 0 });
  if (k === 0) {
    await narrate(g, ['（目を合わせずに、通り過ぎた。）', '（客引きについていくのは危ない。\n風営法や都の条例でも、客引きは禁止されている）']);
    return;
  }
  if (k === 2) {
    K(g).toutReported = today(g);
    K(g).reports = (K(g).reports || 0) + 1;
    await g.say('チッ…。', o);
    await narrate(g, ['（すぐ近くの交番に知らせた。）', '（しばらくして、おまわりさんが通りを見回ると、\n客引きはどこかへ消えていた）']);
    return;
  }
  await bottakuri(g, npc);
}
async function bottakuri(g, npc) {
  const st = g.state;
  const MAMA = { name: 'バーの店員', look: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#2a2030', bottom: '#1e1e26', jacket: true, glasses: 'sun' } };
  await g.fadeOut(10);
  const v = g.push(new Vignette(g, 'bar', { title: '雑居ビル 3階の「バー」', sub: '客引きに案内された店' }));
  await g.fadeIn(10);
  await narrate(g, ['（雑居ビルの3階、薄暗いバーに通された。\nメニューには、値段が書いていない…）', '（ビールを1杯飲んで、少し話しただけで、\n店員が伝票を持ってきた）']);
  if (typeof g.drinkAlcohol === 'function') await g.drinkAlcohol({ where: 'バー' });
  const bill = 98000 + Math.floor(rnd() * 6) * 10000;
  await g.say([`お会計、${fmtMoney(bill)}になります。`, 'セット料金に、テーブルチャージ、\nサービス料、女性のドリンク代…\n全部ちゃんと入ってますんで。'], MAMA);
  const k = await g.ask('（「60分3,000円ポッキリ」だったはず…！）', ['警察を呼ぶ', '言われたとおり払う'], { cancel: 0 });
  if (k === 0) {
    await g.say('あ？ 払えないって言うの？\n…ちょっと、こっち来てもらおうか。', MAMA);
    await narrate(g, `（ひるまずに、${phone110(g)}。）`);
    v.opts.police = true;
    g.sfx('whistle');
    await g.say([
      '警察です。どうしました？',
      since(g, 2000, 10) ? '店の外で「60分3,000円」と言って客を引いて、\nこの料金ですか。都のぼったくり防止条例にも\nふれますね。料金表を見せてください。' : '料金のことで、もめているんですね。\n最初に聞いた料金を、はっきりさせましょう。',
    ], { name: '警察官', look: POLICE_LOOK });
    await g.say('…あ、いや。計算をまちがえました。\nセット料金だけで、けっこうです…。', MAMA);
    const fair = 3000;
    const paid = Math.min(st.money, fair);
    st.money -= paid;
    g.sfx('coin');
    await narrate(g, [`（${fmtMoney(paid)}だけ払って、店を出た。）`, '（客引きについていくと、こういう店もある。\nおかしいと思ったら、その場で110番を）']);
    K(g).bottakuri = 'police';
    g.addNeed('stress', 6);
  } else {
    const paid = Math.min(st.money, bill);
    st.money -= paid;
    g.sfx('coin');
    if (paid < bill) await g.say(['足りない？ じゃあ、あるだけでいいわ。\n今日のところはね。'], MAMA);
    await narrate(g, [`（${fmtMoney(paid)}も払ってしまった…。）`, '（こういう店は「ぼったくり」。\n払う前に、警察を呼んでよかったのだ…）']);
    K(g).bottakuri = 'paid';
    g.addNeed('stress', 18);
  }
  await g.fadeOut(10);
  g.pop(v);
  await g.fadeIn(10);
}
const POLICE_LOOK = { hair: 'cap', hat: '#1e2a50', hairColor: 'black', skin: 'fair', top: '#2a3a6a', bottom: '#1e2a50', tie: '#14182a' };

// ---------------------------------------------------------------- the people of the street
async function drunkTalk(g, npc) {
  const o = who(npc);
  await g.say(['う〜い…。\nもう一軒…いや、終電…いや、もう一軒…。', 'あ〜、すいません、ぶつかっちゃって…。'], o);
  if (doneToday(g, 'drunk')) return;
  const k = await g.ask('（ふらふらしている…）', ['そっとしておく', '水を買ってあげる'], { cancel: 0 });
  if (k !== 1) return;
  if (!g.spend(150)) { await g.say('（小銭が足りない…）'); return; }
  markToday(g, 'drunk');
  g.sfx('coin');
  await g.say(['…あ、ありがとう。\nすいませんねえ、こんな酔っぱらいに。', '会社で、毎晩おそくまで残業でね…。\nたまには飲まないと、やってられなくて。', '家に帰ると、娘はもう寝てるんだ。\n…今度の日曜は、遊園地に連れてってやろう。'], o);
  g.addNeed('stress', -4);
  await narrate(g, '（ちょっとだけ、いいことをした気分だ。\nストレス -4）');
}
const FORTUNES = [
  ['おぬしの星は、いま上り坂じゃ。', 'ただし、うまい話には気をつけよ。\n「すぐもうかる」は、たいてい落とし穴じゃ。'],
  ['近いうちに、大切な人からの連絡がありそうじゃ。', '返事は早めにな。'],
  ['働きすぎの相が出ておる。', 'よく食べて、よく眠ること。\nそれがいちばんの開運じゃ。'],
  ['おぬし、人を笑わせる星を持っておるな。', 'その星を、まっすぐ使うのじゃぞ。'],
  ['金運は…ふむ、出たり入ったり。', '借りるより、まず減らすことを考えよ。\n財布のひもは、しっかりとな。'],
];
async function fortune(g) {
  const T = { name: '占い師', look: FORTUNE_LOOK };
  const fee = 2000;
  const k = await g.ask(['ほう、迷える顔をしておるな。', `見てしんぜよう。見料は${fmtMoney(fee)}じゃ。`], ['やめておく', '占ってもらう'], { ...T, cancel: 0 });
  if (k !== 1) { await g.say('またいつでも来るがよい。', T); return; }
  if (!g.spend(fee)) { await g.say('…持ち合わせがないようじゃな。\nまた今度にせい。', T); return; }
  g.sfx('chime');
  const j = jus(g);
  const yami = j && (j.loans || []).some((l) => l.lender === 'yamikin' && l.status !== 'void' && l.status !== 'paid');
  const lines = yami ? ['…むむ。借金の相が出ておる。\nそれも、たちの悪いものじゃ。', 'ひとりで抱えるでない。\n交番でも、弁護士でもよい。今すぐ相談するのじゃ。'] : pickOne(FORTUNES);
  await g.say(lines, T);
  if (!doneToday(g, 'fortune')) { markToday(g, 'fortune'); g.addNeed('stress', -6); await narrate(g, '（なんだか、少し気が楽になった。\nストレス -6）'); }
}
const FORTUNE_LOOK = { hair: 'long', hairColor: 'silver', skin: 'fair', top: '#3a2a5a', bottom: '#2a1e40', skirt: true, hat: '#3a2a5a' };
async function buskerTalk(g, npc) {
  const o = who(npc);
  await g.say(['♪〜　（アコースティックギターの音色が、\nネオンの街にしみていく）', '…あ、聴いてくれてありがとう。\n毎晩ここで歌ってるんだ。'], o);
  const k = await g.ask('（どうしよう？）', ['聴いていく', '投げ銭する（¥500）', 'またね'], { cancel: 2 });
  if (k === 2 || k < 0) return;
  if (k === 1) {
    if (!g.spend(500)) { await g.say('（小銭が足りない…）'); return; }
    g.sfx('coin');
    await g.emote(npc.id, '♪');
    await g.say(['ありがとう！\nいつか、ちゃんとしたステージで歌うのが夢なんだ。', 'ここで歌うのも、本当は道路使用の許可がいるんだ。\nおまわりさんに言われたら、ちゃんと移動するよ。'], o);
  }
  if (!doneToday(g, 'busker')) { markToday(g, 'busker'); g.addNeed('stress', k === 1 ? -8 : -5); await narrate(g, `（いい歌だった…。ストレス -${k === 1 ? 8 : 5}）`); }
}
const OJISAN = { name: '公園のおじさん', look: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#5a5a4a', bottom: '#4a4438', beard: true, hat: '#4a4a3e' } };
async function ojisanTalk(g, npc) {
  const o = who(npc);
  const f = K(g);
  if (!f.ojisan) {
    await g.say(['…ああ、こんばんは。', 'いや、ここに座ってるのは、べつに悪さするわけじゃない。\n空き缶を集めて、少しばかりの稼ぎにしてるんだ。', '昔はね、印刷工だったんだよ。三十年。\n会社がつぶれて、ひざを悪くして…\nそれから、いろいろあってね。'], o);
    const can = g.hasItem('onigiri');
    const k = await g.ask('（おじさんは、おだやかに笑っている）', can ? ['話を聞く', 'おにぎりを分ける'] : ['話を聞く', 'またね'], { cancel: 0 });
    if (k === 1 && can) {
      g.takeItem('onigiri');
      await g.say(['…いいのかい。ありがとう。\nじゃあ、半分こにしよう。ひとりで食べるより、うまいからね。'], o);
      g.addNeed('stress', -4);
    } else if (k === 0) {
      await g.say(['あそこのNPOの人たちには、世話になってるよ。\n住むところの相談にも、乗ってもらってる。', '生活保護も、遠慮しなくていいって言われてね。\n…意地を張ってたのは、わたしのほうだったかもしれない。', 'あんたは、何をしてる人だい？\n…そうか。夢があるのは、いいことだ。'], o);
    }
    f.ojisan = today(g);
    return;
  }
  if (f.ojisanMoving) { await g.say(['やあ。じつはね、来週からアパートに入れることになった。', '相談員さんが、いっしょに区役所に行ってくれてね。\nまた、印刷の仕事を探してみるよ。'], o); return; }
  await g.say(pickOne([['やあ、また会ったね。\n今夜は、少し冷えるね。'], ['空き缶、今日はけっこう集まったよ。\nこの街は、夜のあいだにたくさん捨てられるからね。'], ['無理しすぎるなよ。\n体をこわしたら、元も子もない。']]), o);
}
async function npoTalk(g, npc) {
  const o = who(npc);
  const f = K(g);
  await g.say([`こんばんは。${since(g, 1998, 12) ? 'NPO法人「ネオンのあかり」' : '支援団体「ネオンのあかり」'}です。`, '夜の街で困っている人の相談を、無料で受けています。\nあたたかいお茶もありますよ。'], o);
  for (;;) {
    const k = await g.ask('何か、困っていることはありますか？', ['だいじょうぶです', 'くらしのこと', '借金のこと', '依存症のこと', '暴力団のこと'], { ...o, cancel: 0 });
    if (k <= 0) break;
    if (k === 1) await g.say(['住むところや、食べるものに困ったら、\nまず区役所の福祉の窓口へ。', '生活保護は、憲法25条にもとづく権利です。\n恥ずかしいことじゃありません。' + (since(g, 2015, 4) ? '\n仕事や家計の相談に乗る窓口もあります。' : ''), 'ひとりで行くのが不安なら、\nわたしたちがいっしょに行きますよ。'], o);
    if (k === 2) {
      await g.say(['借金が返せなくなったら、ひとりで悩まないで。\n' + (since(g, 2007, 4) ? '区役所の多重債務の相談窓口や、' : '消費生活センターや、') + (since(g, 2006, 10) ? '法テラス、' : '') + '弁護士会で相談できます。', '任意整理や自己破産で、生活を立て直せます。\n「借金を返すための借金」だけは、しないで。', '闇金は、そもそも犯罪です。\n脅されたら、すぐ警察に。返さなくていい場合もあります。'], o);
    }
    if (k === 3) await g.say(['お酒、ギャンブル、クスリ…\nやめたくてもやめられないのは、病気なんです。', `${since(g, 1995, 7) ? '精神保健福祉センター' : '保健所'}や、同じ悩みの人たちの\n自助グループがあります。`, '意志が弱いからじゃない。\n助けを借りれば、回復できます。'], o);
    if (k === 4) await g.say(['暴力団から誘われても、きっぱり断ってください。\n一度関わると、なかなか抜けられません。', since(g, 1992, 3) ? '「暴力追放運動推進センター」や警察が、\n相談に乗ってくれます。抜けたい人の支援もあります。' : '警察が相談に乗ってくれます。\nひとりで抱えないで。', '脅されたら、迷わず110番です。'], o);
    if (!doneToday(g, 'npo')) { markToday(g, 'npo'); g.addNeed('stress', -4); }
  }
  if (!g.hasItem('kanraku_card') && !f.card) {
    f.card = today(g);
    g.giveItem('kanraku_card', 1, true);
    await g.say(['よかったら、このカードを持っていってください。\n相談先が書いてあります。'], o);
    await narrate(g, '「相談窓口カード」をもらった！');
  } else await g.say('いつでも、ここにいますからね。', o);
}
async function patrolTalk(g, npc) {
  const o = who(npc);
  if (age(g) < 18) { await g.say(['君、まだ未成年だろう？\n夜の繁華街は、危ないことも多い。', '用がすんだら、早めに帰りなさい。\n困ったことがあったら、交番においで。'], o); return; }
  const j = jus(g);
  const tips = [
    ['こんばんは。パトロール中です。', '客引きについていくと、高い料金を取られることがある。\n声をかけられても、相手にしないように。'],
    ['こんばんは。', 'このへんは路上喫煙禁止だよ。\nタバコは大通りの喫煙所でね。'],
    ['落とし物をしたら、交番へ。\n拾った物も、交番に届けてね。'],
    ['「すぐもうかる仕事」には、裏があることが多い。\n口座を売る、荷物を受け取る…それは犯罪の手伝いだよ。'],
  ];
  if (!since(g, 2005, 8)) tips.splice(1, 1);
  if (j && (j.loans || []).some((l) => l.lender === 'yamikin' && l.status !== 'void' && l.status !== 'paid')) tips.unshift(['…顔色が悪いね。何か困ってる？', '借金の取り立てで脅されているなら、\nそれは犯罪だ。交番で話を聞くよ。']);
  await g.say(tips[Math.floor(g.state.day + (K(g).patrolN = (K(g).patrolN || 0) + 1)) % tips.length], o);
}

// ====================================================================== HD vignettes (cut-in scenes behind dialogue)
// new Vignette(g, kind, { title, sub, cast, police, ... }): a full-screen 640x360 backdrop with
// the people in it; push it, talk over it, pop it.
const PL = (g) => (g.state && g.state.look) || LOOKS.player;
function fig(c, look, x, y, dir = 'down', s = 2, frame = 0) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
  } catch (e) { /* sprites optional */ }
}
const VBG = {
  bar(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#140e16');
    R(c, 0, 0, SW, 150, '#22161e');
    for (let x = 0; x < SW; x += 40) R(c, x, 0, 1, 150, '#2c1e28');
    // shelves of bottles behind the counter
    for (const y of [40, 80]) { R(c, 60, y + 26, 520, 4, '#4a2e1c'); for (let x = 70; x < 570; x += 14) R(c, x, y + 4 + (x % 3) * 2, 8, 22 - (x % 3) * 2, ['#3a6a3a', '#7a3a1a', '#c8c0a0', '#2a3a6a'][(x / 14) % 4 | 0]); }
    fig(c, { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#2a2030', bottom: '#1e1e26', jacket: true, glasses: 'sun' }, 260, 70, 'down');
    R(c, 0, 150, SW, 40, '#3a2218'); R(c, 0, 150, SW, 4, '#6a4428');
    R(c, 0, 190, SW, SH - 190, '#1a1014');
    fig(c, PL(g), 300, 160, 'up');
    if (o.police) { fig(c, POLICE_LOOK, 470, 150, 'left'); fig(c, POLICE_LOOK, 530, 156, 'left'); }
    c.globalAlpha = 0.25; R(c, 0, 0, SW, SH, '#3a0a2a'); c.globalAlpha = 1;
  },
  booth(c, t, g, o) {
    // a cabaret booth: dark velvet, gold, a chandelier, a low glass table
    R(c, 0, 0, SW, SH, '#140c18');
    for (let x = 0; x < SW; x += 32) { R(c, x, 0, 16, 190, '#1e1024'); }
    R(c, 0, 186, SW, 4, '#c9a227');
    for (let i = 0; i < 9; i++) { const x = 160 + i * 40; R(c, x, 20, 2, 26, '#c9a227'); disc(c, x + 1, 50, 5, (t / 10 + i) % 9 < 1 ? '#ffffff' : '#ffe9a0'); }
    R(c, 150, 18, 340, 3, '#c9a227');
    // the sofa
    R(c, 40, 150, 560, 70, '#5a0e2a'); R(c, 40, 150, 560, 10, '#7a1e3e'); R(c, 40, 210, 560, 10, '#3a0618');
    for (let x = 60; x < 600; x += 40) disc(c, x, 176, 2, '#2a0414');
    const cast = o.cast || {};
    fig(c, PL(g), 200, 116, 'down');
    if (cast.look) fig(c, cast.look, 330, 116, 'down');
    // the table with drinks
    R(c, 150, 236, 340, 14, '#a8d8f0'); R(c, 150, 236, 340, 3, '#e8f8ff'); R(c, 170, 250, 8, 40, '#c9a227'); R(c, 462, 250, 8, 40, '#c9a227');
    const n = Math.min(8, o.glasses || 1);
    for (let i = 0; i < n; i++) { const x = 190 + i * 34; R(c, x, 210, 14, 26, '#e8f0ff'); R(c, x + 2, 218, 10, 16, (o.soft && i === 0) ? '#ff9a3c' : i % 2 ? '#ffd890' : '#c8e0a0'); }
    if (o.bottle) { R(c, 420, 186, 18, 50, '#1a4a2a'); R(c, 424, 172, 10, 16, '#1a4a2a'); R(c, 420, 206, 18, 12, '#c9a227'); }
    c.globalAlpha = 0.18; R(c, 0, 0, SW, SH, '#5a1a6a'); c.globalAlpha = 1;
  },
  party(c, t, g, o) {
    // a banquet hall (the 闇営業 job): round tables, men in dark suits, a small stage
    R(c, 0, 0, SW, SH, '#2a2018');
    R(c, 0, 0, SW, 130, '#4a3626'); for (let x = 0; x < SW; x += 64) R(c, x, 0, 2, 130, '#3a2a1c');
    R(c, 220, 30, 200, 70, '#7a1a1a'); R(c, 220, 30, 200, 6, '#c9a227');
    R(c, 160, 110, 320, 36, '#5a3a24'); R(c, 160, 110, 320, 4, '#8a6040');
    fig(c, PL(g), 288, 54, 'down');
    for (const [x, y] of [[60, 200], [250, 230], [460, 200]]) { oval(c, x, y + 40, 130, 30, '#e8e0d0'); }
    const suit = { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true };
    for (const [x, y, d] of [[40, 170, 'right'], [140, 176, 'left'], [240, 196, 'up'], [330, 196, 'up'], [450, 170, 'right'], [560, 172, 'left']]) fig(c, { ...suit, glasses: x % 3 ? 'sun' : false }, x, y, d);
    c.globalAlpha = 0.2; R(c, 0, 0, SW, SH, '#000000'); c.globalAlpha = 1;
  },
  door(c, t, g, o) {
    // an apartment corridor at night: the debtor's door
    R(c, 0, 0, SW, SH, '#1c1e28');
    R(c, 0, 0, SW, 200, '#5a5e6a'); for (let x = 0; x < SW; x += 120) { R(c, x + 20, 40, 60, 150, '#3a3e4a'); R(c, x + 24, 44, 52, 146, '#7a6a5a'); R(c, x + 66, 110, 6, 6, '#c9c6b8'); }
    R(c, 0, 200, SW, 6, '#3a3e48'); R(c, 0, 206, SW, SH - 206, '#4a4e58');
    R(c, 300, 10, 40, 8, '#e8e8d0');
    fig(c, { hair: 'bald', hairColor: 'silver', skin: 'fair', top: '#8a8070', bottom: '#5a5448', glasses: true }, 140, 110, 'right');
    fig(c, { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#5a1a2a', bottom: '#1e1e26', glasses: 'sun' }, 300, 116, 'left');
    fig(c, PL(g), 420, 120, 'left');
  },
  street(c, t, g, o) {
    // the street at night (a 週刊誌 photographer's flash)
    for (let y = 0; y < 200; y++) R(c, 0, y, SW, 1, `rgb(${18 + y * 0.12},${14 + y * 0.1},${34 + y * 0.18})`);
    for (let i = 0; i < 7; i++) { const x = i * 96 - 10, h = 120 + (i % 3) * 30; R(c, x, 200 - h, 88, h, '#2a2634'); for (let wy = 210 - h; wy < 190; wy += 16) for (let wx = x + 8; wx < x + 80; wx += 18) R(c, wx, wy, 10, 8, (wx + wy) % 3 ? '#ffd98a' : '#ff8ac0'); }
    R(c, 0, 200, SW, SH - 200, '#2f2833');
    fig(c, PL(g), 280, 150, 'down');
    if (o.cast) fig(c, o.cast, 360, 150, 'down');
    if (o.flash && (t % 40) < 6) { c.globalAlpha = 0.75; R(c, 0, 0, SW, SH, '#ffffff'); c.globalAlpha = 1; }
    if (o.kisha) fig(c, { hair: 'cap', hat: '#5a4a3a', hairColor: 'brown', skin: 'tan', top: '#8a7a5a', bottom: '#4a4038' }, 520, 170, 'left');
  },
  gamefight(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#120e24');
    for (let x = 0; x < SW; x += 80) { R(c, x + 6, 40, 68, 130, '#2a2448'); R(c, x + 12, 50, 56, 40, ['#4fe0ff', '#ff4fa0', '#ffd23f'][(x / 80) % 3 | 0]); }
    R(c, 0, 190, SW, SH - 190, '#2a2238');
    const y1 = { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#5a2a8a', bottom: '#1e1e26' };
    const y2 = { hair: 'slick', hairColor: 'brown', skin: 'tan', top: '#1e1e26', bottom: '#3a3a44', glasses: 'sun' };
    fig(c, y1, 330, 140, 'left'); fig(c, y2, 400, 130, 'left');
    fig(c, PL(g), 200, 140, 'right');
    if (o.police) fig(c, POLICE_LOOK, 40, 150, 'right');
    if (o.hit && (t % 20) < 10) { R(c, 270, 150, 30, 4, '#ffffff'); R(c, 283, 137, 4, 30, '#ffffff'); }
  },
};
class Vignette {
  constructor(g, kind, opts = {}) { Object.assign(this, { g, kind, opts, t: 0, hd: true, opaque: true, hidesHud: true }); }
  update() { this.t++; }
  draw(ctx, g) {
    const fn = VBG[this.kind] || VBG.street;
    try { fn(ctx, g.frame, g, this.opts); } catch (e) { console.error(e); }
    const title = this.opts.title;
    if (title) {
      const w = Math.min(SW - 24, Math.max(measure(ctx, title, 16), measure(ctx, this.opts.sub || '', 12)) + 28);
      panel(ctx, 8, 8, w, this.opts.sub ? 50 : 32, { bg: '#1a1f38' });
      text(ctx, title, 22, 15, { size: 16, color: COLORS.accent });
      if (this.opts.sub) text(ctx, this.opts.sub, 22, 36, { size: 12, color: '#d8dcf0' });
    }
  }
}
async function withVignette(g, kind, opts, fn) {
  await g.fadeOut(10);
  const v = g.push(new Vignette(g, kind, opts));
  await g.fadeIn(10);
  try { return await fn(v); } finally {
    await g.fadeOut(10);
    if (g.scenes.includes(v)) g.pop(v);
    await g.fadeIn(10);
  }
}

// ====================================================================== flavour buildings
const DIRS_TEXT = {
  neon1: ['「第一ネオンビル」のテナント案内だ。', '2F スナック 紫苑　3F BAR ルビー\n4F 麻雀クラブ　5F 整体院 ほぐし屋\n6F （空き室）'],
  neon2: ['「第二ネオンビル」のテナント案内だ。', '1F 立ち飲み　2F カラオケパブ\n3F ダーツバー　4F 占いの館\n5F 事務所'],
  snackbldg: ['小さな雑居ビル。', '階段の奥から、カラオケの歌声と\n手拍子が聞こえてくる…。'],
  bar: ['細長いビルに、小さなバーが入っている。', '「BAR 月光」――常連さんだけの店らしい。'],
  hotelbldg: ['ビジネスホテルのような、雑居ビルだ。', '入口のプレートには、会社の名前がいくつも並んでいる。'],
  b2a: ['古い雑居ビル。エレベーターは「点検中」の紙が\n貼られたまま、何年もたっていそうだ。'],
  b2b: ['雑居ビルの1階は、深夜営業のラーメン屋。\n…今日はもう、のれんがしまわれている。'],
  b2c: ['大きな雑居ビル。', '看板には、居酒屋、カラオケ、ネットカフェ…\n夜通し、明かりが消えることはない。'],
  b3a: ['雑居ビルだ。', '入口の郵便受けには、チラシがぎっしり。\n「家賃滞納のお知らせ」の紙も見える…。'],
  b3b: ['薄暗い階段のビル。', '「会員制」と書かれたドアが、ぴたりと閉まっている。'],
  b3c: ['雑居ビルの前に、配達のバイクが止まっている。\n「深夜まで営業中」の明かりがまぶしい。'],
  b3d: ['雑居ビル。', '屋上の大きな看板が、ジジジ…と小さく鳴っている。'],
};
async function capsuleTalk(g) {
  const fee = 2800;
  const k = await g.ask(['カプセルホテル「ドットイン」だ。', `終電を逃した人たちが泊まっていく。\n1泊 ${fmtMoney(fee)}（大浴場つき・男女別フロア）。`], ['やめておく', '泊まる（次の日に）'], { cancel: 0 });
  if (k !== 1) return;
  if (!g.spend(fee)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  await g.say(['フロント：「いらっしゃいませ。\nカプセルは上の段になります。ごゆっくりどうぞ」', '大浴場でさっぱりして、カプセルにもぐりこんだ。\nせまいけど、意外と落ち着く…。']);
  await g.sleep({ away: true, shower: 30, sleepStress: 8 });
  await g.say('おはようございます。\nチェックアウトは10時です…。\n（カプセルホテルを出た）', { name: 'フロント', look: { ...LOOKS.receptionist, top: '#2a4a6a' } });
}
async function gyudonTalk(g) {
  const k = await g.ask(['24時間営業の牛丼屋「ドット屋」だ。', '牛丼（並）¥450。早い、安い、うまい！'], ['やめておく', '牛丼を食べる'], { cancel: 0 });
  if (k !== 1) return;
  if (!g.canEat()) { await g.say('おなかいっぱいだ…。'); return; }
  if (!g.spend(450)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  const got = g.eat(32, { fill: 55, silent: true });
  await g.say(`カウンターで牛丼をかきこんだ。\nつゆだくで、うまい！\n（体力 +${got}）`);
}
async function izakayaTalk(g) {
  const H = { name: '居酒屋の大将', look: { hair: 'cap', hat: '#ffffff', hairColor: 'black', skin: 'tan', top: '#2a3a7a', bottom: '#3b3f48', apron: '#2a3a7a' } };
  const minor = age(g) < 20;
  const k = await g.ask(['いらっしゃい！「ほろよい」へようこそ！', minor ? 'お、若いね。二十歳前ならお酒は出せないけど、\n定食ならあるよ！' : 'ちょい飲みセット、\n生ビールに焼き鳥3本で¥1,800だよ！'], ['やめておく', minor ? '定食（¥900）' : 'ちょい飲みセット', ...(minor ? [] : ['定食（¥900）'])], { ...H, cancel: 0 });
  if (k <= 0) return;
  const set = !minor && k === 1;
  const price = set ? 1800 : 900;
  if (!g.canEat() && !set) { await g.say('（おなかいっぱいだ…）'); return; }
  if (!g.spend(price)) { await g.say('（お金が足りない…）'); return; }
  g.sfx('coin');
  if (set) {
    const n = (K(g).izaDay === today(g) ? K(g).iza || 0 : 0) + 1;
    K(g).izaDay = today(g); K(g).iza = n;
    const got = g.canEat() ? g.eat(12, { fill: 20, silent: true }) : 0;
    await g.say(['へい、生とねぎま、つくね、かわ！', 'カウンターのにぎやかさが心地いい。\nジョッキを一気に…いや、ゆっくり飲もう。' + (got ? `\n（体力 +${got}）` : '')], H);
    if (typeof g.drinkAlcohol === 'function') await g.drinkAlcohol({ relief: n === 1 ? 12 : 4, heavy: n >= 3, where: '居酒屋' });
    if (n === 1) await narrate(g, '（いい息抜きになった。ストレス -12）');
    else if (n >= 3) await g.say('…お客さん、今日はそのへんにしときな。\n水、置いとくよ。', H);
  } else {
    const got = g.eat(30, { fill: 50, silent: true });
    await g.say(`焼き魚定食だ。ごはんがすすむ！\n（体力 +${got}）`, H);
  }
}
async function pachinkoTalk(g) {
  await g.say(['パチンコ店「ドットホール」だ。\n自動ドアが開くたびに、ジャラジャラと大きな音がする。', '（入っていく人の中には、目の下にくまを作った人も…）', since(g, 2018, 10) ? '（ギャンブルがやめられないのは「依存症」という病気。\n相談窓口もある、と入口のポスターに書いてある）' : '（ギャンブルで借金を重ね、闇金に手を出す人も\n少なくないという…）']);
}
async function cinemaTalk(g) {
  await g.say(['古い映画館「ネオン座」だ。', '「本日休館」の札がかかっている。\nポスターには、なつかしい任侠映画や喜劇のタイトル。', '（いつか、自分の出た映画もここで…？）']);
}
async function snackTalk(g, name) {
  await g.say([`スナック「${name}」の扉だ。`, 'ドアの向こうから、カラオケの演歌と\nママさんの笑い声が聞こえる。', '（常連さんの店のようだ。今日はやめておこう）']);
}

// ====================================================================== the town map
function bld(x, y, w, h, door, fx, extra = {}) {
  const b = { type: 'building', x, y, w, h, door, kind: 'office', wall: '#1b1a24', roof: '#1b1a24', fx, ...extra };
  b.decorate = decorate(b);
  return b;
}
const SIGNS = {
  snack: [{ t: 'スナック紫苑', bg: '#ff4fa0', fg: '#ffffff', neon: '#ffd0e8' }, { t: 'BAR', bg: '#1a2a5a', fg: '#4fe0ff' }, { t: '麻雀', bg: '#2a8a4a', fg: '#ffffff' }, { t: '整体', bg: '#ffffff', fg: '#2a5a8a' }],
  bar: [{ t: 'BAR月光', bg: '#1a1a3a', fg: '#ffe9a0', neon: '#ffe9a0', mode: 'flicker' }, { t: 'ダーツ', bg: '#d62f2f', fg: '#ffffff' }],
  kara: [{ t: 'カラオケ', bg: '#ffd23f', fg: '#7a1040', neon: '#fff3a0' }, { t: '居酒屋', bg: '#d62f2f', fg: '#ffffff' }, { t: '占い', bg: '#5a2a8a', fg: '#ffe9a0' }],
  yami: [{ t: '金融', bg: '#e8e0c8', fg: '#d62f2f', neon: '#ff6a6a', mode: 'flicker' }, { t: '質', bg: '#2a2a3a', fg: '#ffffff' }],
  misc: [{ t: 'スナック', bg: '#b57bff', fg: '#ffffff', neon: '#e8d0ff' }, { t: '酒場', bg: '#ff9a3c', fg: '#3a1a0a' }, { t: 'BAR', bg: '#4fe0ff', fg: '#0a2a3a' }],
  hotel: [{ t: 'カプセルホテル', bg: '#2a4a8a', fg: '#ffffff', neon: '#9ad0ff' }],
};
function generate() {
  const W = KAN_W, H = KAN_H;
  const c = grid(W, H, 'kanraku_back');
  const glows = [];
  // ---- the avenue from Tokyo (x 38..42) and ネオン大通り (road rows 10..12)
  for (let y = 0; y <= 9; y++) { set(c, 38, y, 'kanraku_side'); set(c, 42, y, 'kanraku_side'); for (let x = 39; x <= 41; x++) set(c, x, y, x === 40 && y % 2 ? 'kanraku_line_v' : 'kanraku_road'); }
  for (let x = 1; x <= W - 2; x++) {
    set(c, x, 9, 'kanraku_side');
    for (let y = 10; y <= 12; y++) set(c, x, y, y === 11 && x % 2 ? 'kanraku_line_h' : 'kanraku_road');
    set(c, x, 13, 'kanraku_side');
  }
  for (let x = 37; x <= 43; x++) for (let y = 10; y <= 12; y++) set(c, x, y, 'kanraku_cross_h');
  for (let x = 39; x <= 41; x++) set(c, x, 8, 'kanraku_cross_v');
  // ---- the north side: plaza with the bus stop and the 喫煙所
  fill(c, 26, 3, 12, 6, 'kanraku_plaza');
  fill(c, 47, 1, 1, 8, 'kanraku_alley');
  // ---- pedestrian streets and alleys
  fill(c, 38, 13, 5, 29, 'kanraku_walk');          // 一番通り
  for (const y of [20, 30, 40]) fill(c, 1, y, W - 2, 2, 'kanraku_walk');
  fill(c, 12, 14, 2, 35, 'kanraku_alley');          // west alley
  fill(c, 56, 14, 2, 35, 'kanraku_alley');          // east alley
  fill(c, 44, 48, 24, 1, 'kanraku_alley');          // back alley (組事務所)
  fill(c, 1, 42, 11, 7, 'kanraku_back');
  // ---- ネオン公園 (rows 42..47, x 14..36)
  fill(c, 14, 42, 23, 6, 'kanraku_plaza');
  for (const x of [14, 36]) for (let y = 43; y <= 47; y++) put(c, x, y, y % 2 ? 'kanraku_planter' : 'bush');
  for (let x = 15; x <= 35; x++) if (x % 4 === 1) put(c, x, 47, 'tree');
  for (const [x, y] of [[20, 45], [26, 45]]) put(c, x, y, 'bench');
  put(c, 33, 45, 'kanraku_vending'); put(c, 34, 45, 'trash');
  // ---- street furniture
  for (const x of [4, 12, 20, 28, 46, 54, 62]) { put(c, x, 9, 'kanraku_lamp'); glows.push({ x: x * 16 + 8, y: 9 * 16 + 4, col: '#fff0c0', r: 18 }); }
  for (const x of [6, 22, 34, 50, 60, 66]) { put(c, x, 13, 'kanraku_lamp'); glows.push({ x: x * 16 + 8, y: 13 * 16 + 4, col: '#fff0c0', r: 18 }); }
  for (const [x, y] of [[1, 21], [35, 31], [44, 21], [67, 31], [9, 41], [67, 41]]) { put(c, x, y, 'kanraku_lamp'); glows.push({ x: x * 16 + 8, y: y * 16 + 4, col: '#ffe0b0', r: 16 }); }
  for (const [x, y, v] of [[28, 21, 0], [52, 21, 1], [7, 31, 2], [43, 31, 0], [20, 41, 1], [50, 41, 2]]) put(c, x, y, 'kanraku_board');
  for (const [x, y] of [[12, 22], [13, 34], [56, 26], [57, 36], [57, 44], [45, 48], [67, 48]]) put(c, x, y, (x + y) % 2 ? 'kanraku_trash' : 'kanraku_ac');
  for (const [x, y] of [[2, 31], [62, 21], [24, 31]]) put(c, x, y, 'kanraku_bikes');
  for (const [x, y] of [[11, 21], [37, 41], [55, 31]]) { put(c, x, y, 'kanraku_vending'); glows.push({ x: x * 16 + 8, y: y * 16 + 4, col: '#ffffff', r: 12 }); }
  put(c, 37, 13, 'kanraku_planter'); put(c, 43, 13, 'kanraku_planter');
  for (const [x, y] of [[26, 9], [33, 13], [56, 13]]) put(c, x, y, 'kanraku_nosmoke');
  // the north edge: Tokyo's center avenue comes in here
  for (let x = 38; x <= 42; x++) set(c, x, 0, x === 38 || x === 42 ? 'kanraku_side' : x === 40 ? 'kanraku_line_v' : 'kanraku_road');

  const B = [
    // north (doors on row 8)
    bld(2, 2, 8, 7, 3, { style: 'zakkyo', wall: '#3a4258', signs: SIGNS.hotel, roof: { t: 'ドットイン', bg: '#1a2a5a', fg: '#9ad0ff', neon: '#9ad0ff', glow: '#9ad0ff' }, ground: 'lobby', inside: '#e8f0ff', seed: 1 }, { name: 'カプセルホテル ドットイン', talk: capsuleTalk }),
    bld(12, 3, 7, 6, 3, { style: 'loan', seed: 2 }, { place: 'shohisha', name: 'ドットローン' }),
    bld(20, 4, 5, 5, 2, { style: 'izakaya', name: '牛丼 ドット屋', board: '#ff8a1a', ink: '#ffffff', wall: '#e8dcc8', noren: '#ff8a1a', norenText: '牛丼', seed: 3 }, { name: '牛丼 ドット屋', talk: gyudonTalk }),
    bld(43, 5, 4, 4, 1, { style: 'koban', seed: 4 }, { place: 'koban', name: '交番' }),
    bld(48, 2, 8, 7, 4, { style: 'pachinko', seed: 5 }, { name: 'パチンコ ドットホール', talk: pachinkoTalk }),
    bld(57, 3, 11, 6, 5, { style: 'zakkyo', wall: '#40384a', signs: SIGNS.kara, roof: { t: 'ネオンで遊ぼう！', bg: '#ff4fa0', fg: '#ffffff', neon: '#ffe94a', glow: '#ff4fa0' }, seed: 6 }, { name: '第二ネオンビル', text: DIRS_TEXT.neon2 }),
    // B1 (doors on row 19)
    bld(2, 14, 9, 6, 4, { style: 'zakkyo', wall: '#463a44', signs: SIGNS.snack, side: 'right', seed: 7 }, { name: '第一ネオンビル', text: DIRS_TEXT.neon1 }),
    bld(15, 15, 6, 5, 3, { style: 'izakaya', name: '居酒屋 ほろよい', noren: '#2a3a7a', norenText: '酒', seed: 8 }, { name: '居酒屋 ほろよい', talk: izakayaTalk }),
    bld(22, 14, 6, 6, 2, { style: 'zakkyo', wall: '#3a3a52', signs: SIGNS.misc, side: 'right', seed: 9 }, { name: '雑居ビル', text: DIRS_TEXT.snackbldg }),
    bld(29, 14, 8, 6, 4, { style: 'gamecen', seed: 10 }, { place: 'gamecen', name: 'ゲームセンター ネオン' }),
    bld(44, 14, 8, 6, 3, { style: 'club', seed: 11 }, { place: 'kyabakura', name: 'CLUB ステラ' }),
    bld(52, 14, 4, 6, 2, { style: 'zakkyo', wall: '#2e3446', signs: SIGNS.bar.slice(0, 1), side: 'right', ground: 'stairs', seed: 12 }, { name: 'BAR 月光', text: DIRS_TEXT.bar }),
    bld(58, 14, 10, 6, 5, { style: 'zakkyo', wall: '#3c3a48', signs: SIGNS.bar, roof: { t: 'ネオン街', bg: '#14121c', fg: '#ff4fa0', neon: '#4fe0ff', glow: '#ff4fa0' }, ground: 'shop', inside: '#ffe0f0', seed: 13 }, { name: '雑居ビル', text: DIRS_TEXT.hotelbldg }),
    // B2 (doors on row 29)
    bld(2, 22, 9, 8, 4, { style: 'zakkyo', wall: '#3a3c4e', signs: SIGNS.kara, side: 'right', roof: { t: 'カラオケ', bg: '#ffd23f', fg: '#7a1040', neon: '#ff4fa0', glow: '#ffd23f' }, seed: 14 }, { name: '雑居ビル', text: DIRS_TEXT.b2c }),
    bld(14, 23, 6, 7, 2, { style: 'zakkyo', wall: '#5a5248', tex: 'grime', signs: SIGNS.yami, side: 'right', bands: [{ t: '即日融資', bg: '#fff6e0', fg: '#d62f2f', size: 10 }, { t: 'クイック融資', bg: '#fff6e0', fg: '#d62f2f', size: 10, neon: '#ff6a6a', mode: 'flicker' }], dark: true, seed: 15 }, { place: 'yamikin', name: 'クイック融資（雑居ビル3階）' }),
    bld(21, 22, 9, 8, 4, { style: 'cinema', seed: 16 }, { name: '映画館 ネオン座', talk: cinemaTalk }),
    bld(31, 23, 6, 7, 3, { style: 'zakkyo', wall: '#44404e', signs: SIGNS.misc.slice(0, 2), side: 'left', seed: 17 }, { name: '雑居ビル', text: DIRS_TEXT.b2a }),
    bld(44, 22, 7, 8, 3, { style: 'zakkyo', wall: '#3a3448', signs: SIGNS.snack.slice(0, 3), side: 'right', ground: 'shop', inside: '#fff0d0', seed: 18 }, { name: '雑居ビル', text: DIRS_TEXT.b2b }),
    bld(51, 24, 5, 6, 2, { style: 'zakkyo', wall: '#2e3a44', signs: SIGNS.misc.slice(1), side: 'right', seed: 19 }, { name: '雑居ビル', text: DIRS_TEXT.b3b }),
    bld(58, 22, 10, 8, 4, { style: 'zakkyo', wall: '#403848', signs: SIGNS.kara, roof: { t: 'NEON TOWER', bg: '#1a1a3a', fg: '#4fe0ff', neon: '#ff4fa0', glow: '#4fe0ff' }, ground: 'shop', inside: '#e0f0ff', seed: 20 }, { name: '雑居ビル', text: DIRS_TEXT.b3d }),
    // B3 (doors on row 39)
    bld(2, 35, 5, 5, 2, { style: 'izakaya', name: 'スナック紫苑', board: '#3a1a3a', ink: '#ffb0e0', wall: '#4a3a44', noren: '#7a1a5a', norenText: 'ママ', seed: 21 }, { name: 'スナック 紫苑', talk: (g) => snackTalk(g, '紫苑') }),
    bld(7, 35, 5, 5, 2, { style: 'izakaya', name: 'ひまわり', board: '#ffd23f', ink: '#7a3a0a', wall: '#4a4038', noren: '#c87a1a', norenText: '歌', seed: 22 }, { name: 'スナック ひまわり', talk: (g) => snackTalk(g, 'ひまわり') }),
    bld(14, 32, 8, 8, 4, { style: 'zakkyo', wall: '#3e3a4c', signs: SIGNS.snack, side: 'right', roof: { t: 'ネオン街', bg: '#1a1a24', fg: '#ffd23f', neon: '#ff4fa0', glow: '#ffd23f' }, seed: 23 }, { name: '雑居ビル', text: DIRS_TEXT.b3a }),
    bld(23, 33, 7, 7, 3, { style: 'zakkyo', wall: '#36404a', signs: SIGNS.bar, side: 'left', seed: 24 }, { name: '雑居ビル', text: DIRS_TEXT.b3b }),
    bld(31, 32, 6, 8, 2, { style: 'zakkyo', wall: '#483c40', signs: SIGNS.misc, side: 'right', ground: 'shop', inside: '#fff0c0', seed: 25 }, { name: '雑居ビル', text: DIRS_TEXT.b3c }),
    bld(44, 32, 6, 8, 3, { style: 'zakkyo', wall: '#3a3a4a', signs: SIGNS.kara.slice(0, 2), side: 'right', seed: 26 }, { name: '雑居ビル', text: DIRS_TEXT.snackbldg }),
    bld(50, 33, 6, 7, 3, { style: 'zakkyo', wall: '#2e3446', signs: SIGNS.bar, side: 'left', dark: true, seed: 27 }, { name: '雑居ビル', text: DIRS_TEXT.b2a }),
    bld(58, 32, 10, 8, 6, { style: 'zakkyo', wall: '#3c3448', signs: SIGNS.snack, roof: { t: 'ドット', bg: '#ff4fa0', fg: '#ffffff', neon: '#ffffff', glow: '#ff4fa0' }, side: 'left', seed: 28 }, { name: '雑居ビル', text: DIRS_TEXT.neon1 }),
    // B4: the 組事務所 at the end of the back alley (door on row 47)
    bld(59, 43, 8, 5, 3, { style: 'kumi', seed: 29 }, { place: 'kumi', name: '鬼灯興業' }),
  ];

  const entities = [
    ...B,
    neonGate(37, 14),
    { type: 'sign', x: 37, y: 14, solid: true, text: ['「ネオン街一番通り」のゲートだ。', 'キャバクラ、ゲームセンター、居酒屋、スナック…\n夜通し、明かりが消えることはない。'] },
    { type: 'sign', x: 43, y: 14, solid: true, text: ['ゲートの柱に、案内図が貼ってある。', '【大通りの北】カプセルホテル・ドットローン・\n牛丼屋・喫煙所・バス停・交番・パチンコ', '【一番通り】ゲームセンター・CLUB ステラ・居酒屋\n【さくら通り】映画館・雑居ビル　【南】ネオン公園'] },
    smokingSpot(27, 5),
    busStop(BUS.x, BUS.y, { text: undefined, talk: busKanraku }),
    { type: 'sign', x: 37, y: 8, text: ['道しるべだ。', '↑ 東京エリア（東京駅・ドット荘・事務所）\nこの通りを北へまっすぐ。', 'バス停からは、東京駅前行きのバスも出ている。（¥210）'], solid: true },
    { type: 'sign', x: 33, y: 13, talk: noSmokingSign },
    { type: 'sign', x: 26, y: 9, talk: noSmokingSign },
    { type: 'sign', x: 56, y: 13, talk: noSmokingSign },
    ...[[39, 16], [41, 25], [26, 21], [52, 30], [20, 31], [47, 41]].map(([x, y]) => decal(x, y)),
    { type: 'sign', x: 42, y: 15, cond: (g) => since(g, 2002), text: ['電柱に「防犯カメラ作動中」のステッカー。', '通りのあちこちに、街頭防犯カメラがある。'] },
    poleStickers(13, 28),
    fortuneTable(8, 31, (g) => fortune(g)),
    guitarCase(30, 44, (g) => { const n = g.npc('kan_busker'); return n ? buskerTalk(g, n) : null; }),
    canCart(17, 46),
    npoTable(23, 43, (g) => { const n = g.npc('kan_npo'); return n ? npoTalk(g, n) : null; }),
    { type: 'sign', x: 15, y: 42, text: ['「ネオン公園」', '夜も明かりのついた、小さな公園。\nベンチで休む人、待ち合わせの人…。'] },
    { type: 'sign', x: 56, y: 47, text: ['路地の奥は、明かりも少なく静かだ。', '…突きあたりのビルには、監視カメラがいくつも\nこちらを向いている。'] },

    // ---- people
    { type: 'npc', id: 'kan_tout', x: 40, y: 17, dir: 'left', look: TOUT.look, name: TOUT.name, talk: toutTalk, cond: (g) => K(g).toutReported !== g.state.day },
    { type: 'npc', id: 'kan_patrol', x: 41, y: 27, dir: 'down', look: POLICE_LOOK, name: 'パトロール中の警察官', wander: 3, talk: patrolTalk },
    { type: 'npc', id: 'kan_tachiban', x: 46, y: 9, dir: 'down', look: POLICE_LOOK, name: '交番のおまわりさん', fixedDir: true,
      text: ['こんばんは。ここは交番です。', '道案内、落とし物、困りごとの相談…\nなんでも中で聞きますよ。'] },
    { type: 'npc', id: 'kan_drunk', x: 22, y: 21, dir: 'down', look: { ...LOOKS.salaryman, tie: '#d62f2f', blush: true }, name: '酔っぱらいのサラリーマン', wander: 2, talk: drunkTalk },
    { type: 'npc', id: 'kan_uranai', x: 8, y: 30, dir: 'down', look: FORTUNE_LOOK, name: '占い師', talk: (g) => fortune(g) },
    { type: 'npc', id: 'kan_busker', x: 30, y: 43, dir: 'down', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#5a8a6a', bottom: '#3a4a7a', hat: '#3a3a44' }, name: '路上ミュージシャン', talk: buskerTalk },
    { type: 'npc', id: 'kan_ojisan', x: 18, y: 46, dir: 'down', look: OJISAN.look, name: OJISAN.name, talk: ojisanTalk, cond: (g) => !K(g).ojisanMoved },
    { type: 'sign', x: 18, y: 46, cond: (g) => !!K(g).ojisanMoved, text: ['ベンチのそばに、きれいにたたんだ段ボールと\nメモが残っている。', '「お世話になりました。アパートが決まりました」\n…ていねいな字だ。'] },
    { type: 'npc', id: 'kan_npo', x: 23, y: 42, dir: 'down', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#5ac08a', bottom: '#3a4a5a', glasses: true }, name: '相談員さん', talk: npoTalk },
    { type: 'npc', id: 'kan_yankee', x: 31, y: 21, dir: 'down', look: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#5a2a8a', bottom: '#1e1e26' }, name: 'ヤンキー',
      text: ['…あ？ なに見てんだよ。', 'ゲーセンの中で、ダチが待ってんだよ。\nじゃまだ、どけよ。'] },
    { type: 'npc', id: 'kan_kurofuku', x: 49, y: 20, dir: 'down', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#14121a', bottom: '#14121a', jacket: true, tie: '#14121a' }, name: 'CLUB ステラの黒服', fixedDir: true,
      text: ['いらっしゃいませ。CLUB ステラでございます。', '店の前での呼び込みは条例で禁止されていますので、\nこちらからお声がけはいたしません。', '料金は入口の料金表のとおりです。\n18歳未満の方はご入店いただけません。お酒は二十歳から。'] },
    { type: 'npc', id: 'kan_students', x: 49, y: 31, dir: 'left', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#3a8ac8', bottom: '#3a3a44' }, name: '大学生', wander: 1,
      text: ['サークルの飲み会の二次会、どこにしよっか〜。', 'あ、一年生には飲ませちゃダメだからね！\n二十歳前だし、一気飲みは命にかかわるんだから。'] },
    { type: 'npc', id: 'kan_tissue', x: 16, y: 9, dir: 'down', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#2f9a6a', bottom: '#3a3a44', hat: '#2f9a6a' }, name: 'ティッシュ配りの人',
      text: ['ドットローンです〜。どうぞ〜。', '（ポケットティッシュをもらった。\n裏には「ご利用は計画的に」と書いてある）'] },
    { type: 'npc', id: 'kan_tourist', x: 33, y: 9, dir: 'down', look: LOOKS.tourist, name: '観光客', wander: 2, text: ['Wow… すごいネオン！', 'この街、夜でもこんなに明るいんだね。\n写真、いっぱい撮っちゃった！'] },
    { type: 'npc', id: 'kan_cast', x: 46, y: 21, dir: 'left', look: CASTS.misaki.look, name: '出勤途中の女性', wander: 1,
      text: ['これから出勤なんです。CLUB ステラで。', '昼間はネイルの専門学校。\nお店のお給料で、学費を払ってるんです。'] },
  ];
  // the walk from Tokyo: warps on the north edge
  const warps = [];
  for (let x = 38; x <= 42; x++) warps.push({ x, y: 0, place: 'tokyo', room: 'main', tx: x, ty: 44, dir: 'up' });

  return { w: W, h: H, cells: c, entities, warps, events: [
    { x: 27, y: 31, on: 'action', cond: (g) => !K(g).wallet && g.state.day >= 2, run: foundWallet },
    { x: 40, y: 13, on: 'step', cond: (g) => !g.flag('kanraku_gate'), run: async (g) => { g.setFlag('kanraku_gate'); await g.say(['「ネオン街一番通り」のゲートだ。', '（楽しそうな街だけど、危ない誘いもありそうだ。\n困ったら、大通りの交番へ）']); } },
  ], glows };
}
// a wallet on the ground (once): hand it in at the 交番
const walletProp = {
  type: 'prop', x: 27, y: 31, w: 1, h: 1, solid: false, z: -300,
  cond: (g) => !K(g).wallet && g.state.day >= 2,
  draw(ctx, sx, sy, g) {
    blit(ctx, bake('wallet', 32, 32, (c) => { R(c, 10, 18, 12, 8, '#1a1a1e'); R(c, 10, 18, 12, 2, '#3a3a40'); R(c, 19, 21, 2, 2, '#c9a227'); outline(c, { tint: 0.3 }); }), sx, sy);
    if ((g.frame % 90) < 10) U(ctx, sx + 9, sy + 8.5, 1, 1, '#ffffff');
  },
};
async function foundWallet(g) {
  await g.say(['足元に、黒い財布が落ちている…。', '中には、お札が何枚かと、カードが入っている。']);
  const k = await g.ask('（どうしよう？）', ['交番に届ける', '見なかったことにする'], { cancel: 1 });
  K(g).wallet = today(g);
  if (k !== 0) { await narrate(g, '（そのままにして、立ち去った。\n…落とし主は、きっと困っているだろう）'); K(g).walletLeft = true; return; }
  g.giveItem('kanraku_wallet', 1, true);
  await narrate(g, '「拾った財布」を手に入れた。\n（大通りの交番に届けよう）');
}

// glows: building façades + street lamps, drawn additively over the town
function drawGlows(ctx, g, cam) {
  const m = g.map;
  if (!m || !m.room) return;
  const room = m.room;
  const list = room._glow || (room._glow = []);
  if (!room._glowBuilt) {
    room._glowBuilt = true;
    const gen = room.def._gen;
    if (gen) list.push(...gen);
    for (const e of m.entities) {
      if (e.type !== 'building' || !e.fx) continue;
      const f = facade(e);
      for (const gl of f.glows) list.push({ x: e.x * TILE + gl.x, y: e.y * TILE + gl.y, col: gl.col, r: gl.r });
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const gl of list) {
    const x = gl.x - cam.x, y = gl.y - cam.y;
    if (x < -gl.r || y < -gl.r || x > VIEW_W + gl.r || y > VIEW_H + gl.r) continue;
    const cv = halo(gl.col, gl.r * 2);
    ctx.drawImage(cv, Math.round(x - gl.r), Math.round(y - gl.r), gl.r * 2, gl.r * 2);
  }
  ctx.restore();
}

registerPlace({
  id: 'kanraku',
  name: 'ネオン街',
  kind: 'town',
  bgm: 'night',
  start: { room: 'main', x: 40, y: 2, dir: 'down' },
  api: KANRAKU_API,
  rooms: {
    main: {
      generate() { const r = generate(); r.entities.push(walletProp); this._gen = r.glows; return r; },
      bg: '#14121c',
      topPad: 24,
      drawOver: drawGlows,
      onEnter: async (g) => {
        if (g.flag('kanraku_intro')) return;
        g.setFlag('kanraku_intro');
        await g.wait(250);
        await g.say(['ネオンの光があふれる街に出た。\nここは「ネオン街」――東京いちばんの歓楽街だ。', 'キャバクラ、ゲームセンター、居酒屋、スナック…\n夜通し、人と明かりが絶えない。', '（楽しい場所だけど、危ない誘いも多いらしい。\n困ったら、大通りの交番に行こう）']);
        if (age(g) < 18) await narrate(g, '（…まだ未成年だ。\n用がすんだら、早めに帰ったほうがよさそうだ）');
      },
    },
  },
});

// 路上喫煙: the district is a 路上喫煙禁止地区 (a fictional ward ordinance, from 2005-08); the 喫煙所 is allowed.
registerSmokingRule('kanraku', (g) => (since(g, 2005, 8)
  ? { ok: false, area: 'ネオン街（路上喫煙禁止地区）', law: '（架空の）ドット区路上喫煙防止条例', fine: 2000, patrol: 0.3, smokingArea: true }
  : { ok: true, area: 'ネオン街' }));
registerSmokingRule('kanraku_kitsuen', (g) => ({ ok: true, area: since(g, 2005, 8) ? 'ネオン街の指定喫煙所' : 'ネオン街の灰皿の前' }));

// ====================================================================== interiors: shared bits
const exitRow = (n) => '#'.repeat(n);
function exits(xs, y) { return xs.map((x) => ({ x, y, to: 'exit' })); }
async function firstVisit(g, key, lines, n) {
  if (K(g)['met_' + key]) return;
  K(g)['met_' + key] = today(g);
  await g.wait(200);
  await g.say(lines, n ? who(n) : {});
}

// ====================================================================== 交番 ('koban')
tile('koban_floor', { variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#b8bcb4');
  for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) { R(c, x + 1, y + 1, 14, 14, v && (x + y) % 32 === 0 ? '#c4c8c0' : '#bec2ba'); R(c, x + 1, y + 1, 14, 1, '#d0d4cc'); }
  speckle(c, r, ['#a8aca4', '#c8ccc4'], 20);
});
tile('koban_desk', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 8, 32, 22, '#6a6e78'); R(c, 0, 8, 32, 6, '#c8ccd4'); R(c, 0, 8, 32, 1, '#e8eaee'); R(c, 0, 13, 32, 1, '#8a8e98');
  R(c, 2, 15, 28, 13, '#5a5e68'); R(c, 4, 17, 24, 2, '#7a7e88');
  R(c, 4, 9, 12, 4, '#f4f0e0'); R(c, 6, 10, 8, 1, '#8a8a8a'); // ledger
  R(c, 20, 8, 7, 4, '#2a2a30'); R(c, 21, 7, 5, 2, '#3a3a44'); // phone
  outline(c, { tint: 0.3 });
});
tile('koban_map', { obj: true }, (c) => {
  R(c, 2, 4, 28, 22, '#3a3a44'); R(c, 3, 5, 26, 20, '#f0ecd8');
  R(c, 3, 14, 26, 2, '#9aa0aa'); R(c, 15, 5, 2, 20, '#9aa0aa'); R(c, 6, 7, 6, 5, '#c8d8a0'); R(c, 20, 18, 7, 5, '#f0c8a0');
  disc(c, 22, 9, 2, '#d62f2f'); R(c, 8, 19, 4, 3, '#a0c8e8');
});
tile('koban_poster', { obj: true, variants: 2 }, (c, r, f, v) => {
  for (const [x, col] of [[3, v ? '#ffe0a0' : '#ffffff'], [17, v ? '#d0e8ff' : '#ffd0d0']]) {
    R(c, x, 6, 12, 18, col); R(c, x, 6, 12, 1, '#ffffff');
    R(c, x + 2, 8, 8, 2, '#d62f2f'); disc(c, x + 6, 15, 3, '#9a9aa4'); R(c, x + 2, 20, 8, 1, '#5a5a66'); R(c, x + 2, 22, 6, 1, '#5a5a66');
  }
});
tile('koban_shelf', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 14, 2);
  R(c, 2, 2, 28, 28, '#7a6a52'); R(c, 4, 4, 24, 24, '#5a4a36');
  for (const y of [4, 13, 22]) R(c, 4, y + 7, 24, 2, '#8a7a5e');
  R(c, 6, 6, 6, 5, '#d62f2f'); R(c, 14, 7, 8, 4, '#2a2a30'); R(c, 6, 15, 10, 5, '#3a6ac8'); R(c, 18, 16, 6, 4, '#ffd23f'); R(c, 7, 24, 7, 4, '#5a9a5a'); R(c, 16, 23, 8, 5, '#e8e0d0');
  for (const [x, y] of [[9, 5], [18, 6], [11, 14], [21, 15]]) R(c, x, y, 2, 3, '#ffffff'); // tags
  outline(c, { tint: 0.3 });
});
const KOBAN_COP = { name: '交番の森下巡査長', look: { ...POLICE_LOOK, hair: 'cap', skin: 'tan', glasses: true } };
async function kobanTalk(g, npc) {
  const o = who(npc);
  if (!K(g).met_koban_cop) {
    K(g).met_koban_cop = today(g);
    await g.say(['はい、こんばんは。ネオン街交番の森下です。', 'この街は、楽しいけど危ないことも多い。\n困ったら、いつでも来なさい。'], o);
  }
  for (;;) {
    const items = ['道を聞く', '落とし物', '相談したい', '自首したい', 'なんでもない'];
    const k = await g.ask('どうしました？', items, { ...o, cancel: 4 });
    if (k < 0 || k === 4) { await g.say('気をつけて。\n夜道は明るいところを歩くんだよ。', o); return; }
    if (k === 0) await kobanDirections(g, o);
    if (k === 1) await kobanLost(g, o);
    if (k === 2) await kobanConsult(g, o);
    if (k === 3) await kobanJishu(g, o);
  }
}
const KAN_PLACES = [
  ['交番', '大通りの北、東京へ行く通りの角。ここだよ。'],
  ['バス停・喫煙所', '交番の西、大通りの北側の広場。\nタバコは、その喫煙所でね。'],
  ['ドットローン', '大通りの北側。消費者金融の窓口だ。\n借りる前に、返す計画をよく考えるように。'],
  ['ゲームセンター', 'ゲートをくぐってすぐ西。\n…最近、ガラの悪い連中がたまっていてね。'],
  ['CLUB ステラ', 'ゲートをくぐってすぐ東のキャバクラ。\n18歳未満は入れない。お酒は二十歳から。'],
  ['ネオン公園', '一番通りを南へ行った、いちばん奥。\nNPOの人たちが、相談に乗ってくれている。'],
  ['東京エリア', '大通りから、北の通りをまっすぐ。\nバスなら東京駅前まで¥210だ。'],
];
async function kobanDirections(g, o) {
  const i = await g.list({ title: 'どこへ行きたい？', items: KAN_PLACES.map((p) => p[0]), x: 170, y: 60, w: 300, px: true });
  if (i < 0) return;
  await g.say(KAN_PLACES[i][1], o);
  if (KAN_PLACES[i][0] === 'ゲームセンター') return;
  if (i === 1 && !since(g, 2005, 8)) await g.say('（このころは、まだ路上喫煙を禁止する条例はなかった）');
}
async function kobanLost(g, o) {
  if (g.hasItem('kanraku_wallet')) {
    await g.say(['財布を拾ったのかい。ありがとう。\nこの「拾得物件預り書」に、拾った場所を書いてね。', `落とし主が見つかったら、連絡がいく。\nお礼の「報労金」は、中身の5〜20%が目安だ。\n${since(g, 2007, 12) ? '3か月' : '6か月'}たっても落とし主が出なければ、\n拾った人のものになる。`], o);
    g.takeItem('kanraku_wallet');
    K(g).walletIn = today(g);
    g.sfx('ok');
    await narrate(g, '（財布を交番に届けた）');
    return;
  }
  const k = await g.ask('落とし物かい？', ['物をなくした', '拾った物はない'], { ...o, cancel: 1 });
  if (k === 0) await g.say(['何をなくしたのかな。…ふむ、いまのところ\nそれらしい届けは出ていないね。', '見つかったら、連絡するよ。\n遺失届を出しておこう。'], o);
  else await g.say('そうかい。拾った物があったら、\nちゃんと届けるんだよ。', o);
}
async function kobanConsult(g, o) {
  const f = K(g);
  const items = ['闇金の被害', 'ぼったくり・客引き', '暴力団のこと', '借金のこと'];
  if (f.gameVictim && !f.gameReported) items.push('ゲーセンで絡まれた');
  items.push('やめる');
  const k = await g.ask('どんな相談かな？\n（話した内容の秘密は守るよ）', items, { ...o, cancel: items.length - 1 });
  const pick = items[k];
  if (!pick || pick === 'やめる') return;
  if (pick === '闇金の被害') {
    const j = jus(g);
    const yami = j && (j.loans || []).some((l) => l.lender === 'yamikin' && l.status !== 'void' && l.status !== 'paid');
    if (yami && typeof g.policeConsult === 'function') {
      await g.policeConsult('yamikin');
      await g.say(['それから、弁護士にも相談しなさい。\n' + (since(g, 2006, 10) ? '法テラスなら、お金のない人も相談できる。' : '弁護士会の相談窓口があるよ。'), '「借金をチャラにしてやるから、口座を売れ、\n荷物を運べ」…そう言われても、絶対に断ること。'], o);
      return;
    }
    await g.say(['登録のない業者が、法外な利息で貸すのが「闇金」。\n10日で1割――「トイチ」なんて、立派な犯罪だ。', since(g, 2008, 6) ? '年109.5%をこえる利息の契約は無効。\n最高裁は、元本も返さなくていいと判断している。' : '法律の上限をこえた利息は、払う必要はない。', '家族や職場に取り立てに来たら、すぐ110番。\n借りる前に、ここに来てくれればいちばんだ。'], o);
    return;
  }
  if (pick === 'ぼったくり・客引き') {
    await g.say(['客引きは、風営法や都の迷惑防止条例で禁止されている。\nついていった先が、ぼったくりの店ってことも多い。', since(g, 2000, 10) ? '東京都には「ぼったくり防止条例」もある。\n料金でもめたら、払う前にその場で110番。' : '料金でもめたら、払う前にその場で110番。\n警察が間に入るよ。'], o);
    if (f.bottakuri === 'paid' && !f.bottakuriReported) {
      f.bottakuriReported = today(g);
      await g.say(['…払ってしまったのかい。\n店の場所と、客引きの顔、覚えているかな。', '被害届を受理しよう。取り戻せるかはわからないが、\n店への捜査の手がかりになる。'], o);
    }
    return;
  }
  if (pick === '暴力団のこと') {
    if (f.kumiTies && !f.kumiCut) {
      await g.say(['…鬼灯組と関わってしまったんだね。\n正直に話してくれて、ありがとう。', since(g, 1992, 3) ? '警察と「暴力追放運動推進センター」が、\nあなたを守る。連絡は絶って、何か言ってきたら\nすぐ知らせなさい。' : '警察が、あなたを守る。\n連絡は絶って、何か言ってきたらすぐ知らせなさい。', '…ただ、やってしまったことは消えない。\n仕事への影響は、覚悟しておいたほうがいい。'], o);
      f.kumiCut = today(g);
      f.kumiPressure = 0;
      g.addNeed('stress', -10);
      return;
    }
    await g.say(['暴力団の誘いは、きっぱり断ること。\n「仕事を手伝え」「ちょっと歌ってくれ」――\n一度でも受けたら、抜けられなくなる。', '芸能人なら、つながりが明るみに出ただけで\n事務所との契約も、テレビの仕事も失う。', since(g, 1992, 3) ? '脅されたら110番。暴力追放運動推進センターにも\n相談できるよ。' : '脅されたら110番だ。'], o);
    return;
  }
  if (pick === '借金のこと') {
    await g.say(['借金そのものは、警察の仕事じゃないんだが…\n返せなくなったら、ひとりで抱えないこと。', (since(g, 2007, 4) ? '区役所の多重債務の相談窓口や、' : '消費生活センターや、') + (since(g, 2006, 10) ? '法テラス、' : '') + '弁護士会。\n専門家が、整理のしかたを教えてくれる。'], o);
    const j = jus(g);
    if (j && (j.loans || []).some((l) => l.status !== 'void' && l.status !== 'paid' && l.lender !== 'yamikin') && typeof g.consultLawyer === 'function') {
      const q = await g.ask('弁護士の相談窓口に、電話をつないであげようか？', ['お願いします', 'だいじょうぶです'], { ...o, cancel: 1 });
      if (q === 0) await g.consultLawyer('debt');
    }
    return;
  }
  if (pick === 'ゲーセンで絡まれた') {
    f.gameReported = today(g);
    await g.say(['ゲームセンターで、突き飛ばされたんだね。\nけがはないかい。', 'それは暴行だ。被害届を受理しよう。\n店の防犯カメラも確認する。', '話してくれてありがとう。\n泣き寝入りしないことが、次の被害を防ぐんだ。'], o);
  }
}
async function kobanJishu(g, o) {
  const j = jus(g);
  if (!j || typeof g.arrest !== 'function') { await g.say('…自首、ですか？\n詳しくは、警察署で聞きます。', o); return; }
  if (j.status === 'detained' || j.status === 'prison') return;
  const ids = Object.keys(j.heat || {}).filter((id) => CRIMES[id] && CRIMES[id].kind === 'crime' && !(j.cases || []).some((c) => !c.closed && c.crime === id));
  if (!ids.length) { await g.say(['自首…？', '話を聞くかぎり、事件にあたるようなことは\nなさそうだね。困りごとなら、相談に乗るよ。'], o); return; }
  const names = ids.map((id) => CRIMES[id].name).concat(['やっぱりやめる']);
  const k = await g.ask('（どのことを話そう…）', names, { cancel: names.length - 1 });
  if (k < 0 || k >= ids.length) { await narrate(g, '（言い出せなかった…）'); return; }
  const id = ids[k];
  if (id === 'tax_evasion') { await g.say('税金の申告のことなら、まず税務署へ。\n自分から修正申告をすれば、扱いが軽くなることもある。', o); return; }
  const h = j.heat[id];
  const c = await g.ask([`${CRIMES[id].name}の件、だね。`, '捜査機関に知られる前に、自分から申し出ることを\n「自首」という。刑が軽くなることがある。（刑法42条）', '警察署に連絡して、担当の刑事に来てもらう。\n…いいね？'], ['すべて話す', 'やっぱりやめる'], { ...o, cancel: 1 });
  if (c !== 0) { await g.say('…わかった。気持ちが決まったら、また来なさい。', o); return; }
  K(g).jishu = (K(g).jishu || 0) + 1;
  await narrate(g, '（しばらくして、警察署から刑事がやって来た…）');
  await g.arrest(id, { via: 'warrant', evidence: 0.92, amount: h ? h.amount : 0, plea: 'admit' });
}

registerPlace({
  id: 'koban',
  name: 'ネオン街交番',
  kind: 'building',
  bgm: 'office',
  start: { room: 'main', x: 4, y: 6, dir: 'up' },
  rooms: {
    main: {
      floor: 'koban_floor',
      wall: 'cream',
      tiles: [
        '##########',
        '#=MM=PP=w#',
        '#K......L#',
        '#..DDDD..#',
        '#........#',
        '#cc....cc#',
        '#........#',
        '####EE####',
      ],
      legend: { M: 'wall_cream+koban_map', P: 'wall_cream+koban_poster', K: 'locker', L: 'koban_shelf', D: 'koban_desk', c: 'chair', E: 'exit_mat' },
      warps: exits([4, 5], 7),
      entities: [
        { type: 'npc', id: 'koban_cop', x: 4, y: 2, dir: 'down', look: KOBAN_COP.look, name: KOBAN_COP.name, talk: kobanTalk, fixedDir: true },
        { type: 'npc', id: 'koban_cop2', x: 7, y: 2, dir: 'down', look: { ...POLICE_LOOK, skin: 'light', hair: 'cap' }, name: '若い巡査', fixedDir: true,
          text: ['（書類を書いている）', '…あ、こんばんは。\n夜の巡回から戻ったところです。', 'この時間は、酔っぱらいの保護や\n客引きの注意で、大いそがしですよ。'] },
        { type: 'npc', id: 'koban_obaa', x: 7, y: 5, dir: 'up', look: { ...LOOKS.oldwoman, top: '#5a8ac8' }, name: '道に迷ったおばあさん',
          text: ['孫の働いてるお店をたずねてきたんだけど、\nこの街は、明るすぎて目がまわるねえ。', 'おまわりさんが、地図で教えてくれたよ。\nありがたいことだねえ。'] },
        { type: 'sign', x: 2, y: 1, text: ['ネオン街の地図だ。', '交番、バス停、一番通り、ネオン公園…\n赤い丸は「客引き・ぼったくり注意」の場所らしい。'] },
        { type: 'sign', x: 5, y: 1, text: ['ポスターが貼ってある。', '「客引きについていかない！」\n「闇金の被害は110番・#9110へ」\n「指名手配被疑者の情報をお寄せください」'] },
        { type: 'sign', x: 8, y: 2, text: ['落とし物の棚だ。', '傘、手袋、スマホ、定期入れ…\n一つひとつに、拾われた日と場所の札がついている。'] },
      ],
      onEnter: (g) => firstVisit(g, 'koban', ['はい、こんばんは。どうしました？', '道案内、落とし物、相談…なんでもどうぞ。'], KOBAN_COP),
    },
  },
});

// ====================================================================== CLUB ステラ ('kyabakura')
// A キャバクラ (接待飲食等営業): adults only (18歳未満は入店不可・お酒は二十歳から), conversation and
// drinks, expensive. The casts are adults with their own lives; the club protects them (house rules).
const CASTS = {
  misaki: {
    name: 'ミサキ', age: 24, look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#ff7eb6', bottom: '#ff7eb6', skirt: true, lashes: true },
    profile: '24歳。昼はネイルの専門学校。明るくて、話しやすい。',
    hello: ['はじめまして、ミサキです！\n今日は来てくれてありがとう♪', 'お仕事帰りですか？\nなにか飲みます？'],
    topics: {
      work: ['お仕事の話、聞かせてほしいな。\n…へえ、芸能のお仕事なんだ！すごい！', 'わたしも、人をきれいにする仕事がしたくて。\nネイリストになるのが夢なんだ。'],
      hobby: ['休みの日？ ネイルの練習ばっかり！\n友だちの爪を借りて、塗らせてもらってるの。', 'あとはね、甘いもの食べ歩き。\n商店街のたい焼き、知ってる？'],
      listen: ['うんうん…。\nそれは、がんばったね。', 'えらいよ、ほんとに。\nたまには、ここで息抜きしてね。'],
    },
    story: [
      ['じつはね、ネイルの検定、受かったの！\nお店のみんなにも、お祝いしてもらっちゃった。'],
      ['来月で、このお店を卒業するんだ。\nネイルサロンで働けることになったの！', 'お店のお給料で学費を払って…がんばってよかった。\n来てくれて、ほんとにありがとう。'],
    ],
    msgs: ['昨日はありがとう♪\nお仕事、むりしないでね！', 'ネイルの練習、今日もがんばるよ〜。\nまたお話ししようね！'],
  },
  reina: {
    name: 'レイナ', age: 28, look: { hair: 'bob', hairColor: 'black', skin: 'fair', top: '#4a2a8a', bottom: '#4a2a8a', skirt: true, lashes: true },
    profile: '28歳。聞き上手で落ち着いた雰囲気。簿記の勉強中。',
    hello: ['レイナです。いらっしゃいませ。', '今日は、ゆっくりしていってくださいね。'],
    topics: {
      work: ['芸能のお仕事…人に見られるお仕事って、\n気が休まらないでしょう？', 'わたし？ 昼は会計事務所でアルバイト。\n簿記の資格をとって、ちゃんと就職したくて。'],
      hobby: ['趣味は…古い映画かな。\n角の「ネオン座」、休館になっちゃって残念。', '白黒の喜劇が好きなの。\n笑わせる人って、本当にすごいと思う。'],
      listen: ['…そう。つらかったですね。', '話してくれて、ありがとう。\nここで言ったことは、ここに置いていって。'],
    },
    story: [
      ['簿記2級、合格したんです。\n…だれかに言いたくて。ありがとう、聞いてくれて。'],
      ['春から、会計事務所で正社員になります。\nこのお店も、もうすぐ卒業。', '夜のお仕事も、わたしにとっては大事な時間でした。\nお客さんにも、いろんなことを教わったから。'],
    ],
    msgs: ['昨日はありがとうございました。\n無理して来なくていいですからね。お仕事がんばって。', '簿記の問題集、今日も一章すすみました。\n…ちょっとした報告です。'],
  },
  yuu: {
    name: 'ユウ', age: 22, look: { hair: 'short', hairColor: 'pink', skin: 'light', top: '#4fb8d8', bottom: '#2a3a6a', skirt: true, lashes: true },
    profile: '22歳。小劇場の役者。お芝居の話になると止まらない。',
    hello: ['ユウです！よろしくお願いします！', 'えっ、待って…もしかして、芸能の人？'],
    topics: {
      work: ['わたしも劇団で役者やってるんです！\n昼は稽古、夜はここ。', 'チケット、ノルマがあって…。\nでも、舞台に立つのがいちばん好き！'],
      hobby: ['趣味もお芝居！\nあと、人間観察。お客さんを見て、役づくりの勉強。', 'あ、いまの顔、いただきました（笑）'],
      listen: ['わかる〜。\nがんばってるのに、報われないときってあるよね。', 'でも、見てる人は見てるから。\nわたしも、いま見てるし！'],
    },
    story: [
      ['今度の公演、はじめてセリフの多い役なの！\n台本、もうボロボロ。'],
      ['劇団のオーディション、受かったんです！\n大きな劇場の舞台、出られることになって。', 'お店はやめて、お芝居一本でいきます。\nいつか、同じ番組で共演しましょうね！'],
    ],
    msgs: ['昨日はありがとうございました！\n舞台の稽古、行ってきます！', '演出家さんにほめられた〜！\n…ちょっとだけ自慢です。'],
  },
};
const CAST_ORDER = ['misaki', 'reina', 'yuu'];
const KYABA = { set: 6000, shimei: 2500, drink: 1500, ext: 3500, service: 0.25 };
const KUROFUKU = { name: '黒服のスタッフ', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#14121a', bottom: '#14121a', jacket: true, tie: '#14121a' } };
const castGone = (g, id) => (K(g).castStory && K(g).castStory[id] || 0) >= 2 && K(g).castGoneDay && K(g).castGoneDay[id] && today(g) > K(g).castGoneDay[id];
const castsHere = (g) => CAST_ORDER.filter((id) => !castGone(g, id));

tile('kyaba_floor', { variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2a0e22');
  for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) {
    R(c, x + 7, y + 3, 2, 10, '#3e1632'); R(c, x + 3, y + 7, 10, 2, '#3e1632');
    P(c, x + 8, y + 8, '#8a6a2a');
  }
  speckle(c, r, ['#24081c', '#341228'], 30);
});
tile('kyaba_bottles', { obj: true }, (c) => {
  R(c, 1, 4, 30, 24, '#2a1a12'); R(c, 1, 13, 30, 2, '#6a4428'); R(c, 1, 26, 30, 2, '#6a4428');
  for (let x = 3; x < 30; x += 4) { R(c, x, 5 + (x % 3), 3, 8 - (x % 3), ['#3a6a3a', '#7a3a1a', '#d8d0a8', '#3a4a8a', '#8a2a3a'][x % 5]); R(c, x, 16 + (x % 2), 3, 10 - (x % 2), ['#c9a227', '#3a6a3a', '#e8e8f0', '#7a3a1a'][x % 4]); }
  for (const x of [6, 18]) P(c, x, 7, '#ffffff');
});
tile('kyaba_mirror', { obj: true }, (c) => {
  R(c, 6, 3, 20, 26, '#c9a227'); R(c, 7, 4, 18, 24, '#ffe9a0'); R(c, 8, 5, 16, 22, '#5a4a6a'); R(c, 9, 6, 14, 20, '#7a6a8a');
  line(c, 11, 8, 15, 12, '#c8b8d8'); line(c, 12, 14, 18, 20, '#a898b8');
});
tile('kyaba_price', { obj: true }, (c) => {
  R(c, 2, 3, 28, 26, '#c9a227'); R(c, 4, 5, 24, 22, '#fff8e8');
  sign(c, '料金', 16, 9, 8, '#5a3a10', { bold: false });
  for (let i = 0; i < 4; i++) { R(c, 6, 14 + i * 3, 12, 1, '#7a6a50'); R(c, 21, 14 + i * 3, 5, 1, '#a83a2a'); }
});
tile('kyaba_castboard', { obj: true }, (c) => {
  R(c, 2, 3, 28, 26, '#c9a227'); R(c, 3, 4, 26, 24, '#1a1218');
  for (const [x, col] of [[5, '#ff7eb6'], [14, '#7a5ac8'], [23, '#4fb8d8']]) { R(c, x, 7, 6, 9, '#f4e8e0'); disc(c, x + 3, 10, 2, '#e8c0a0'); R(c, x, 13, 6, 3, col); R(c, x, 18, 6, 1, '#c9a227'); }
  sign(c, 'CAST', 16, 23, 7, '#ffe9a0', { bold: false });
});
tile('kyaba_bar', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 8, 32, 22, '#3a1a12'); R(c, 0, 8, 32, 5, '#6a3a22'); R(c, 0, 8, 32, 1, '#9a6a3a');
  R(c, 0, 13, 32, 1, '#c9a227');
  for (let x = 2; x < 32; x += 8) R(c, x, 16, 4, 12, '#2a120a');
  R(c, 8, 4, 4, 6, '#e8f0ff'); R(c, 9, 6, 2, 3, '#ffd890'); R(c, 20, 3, 3, 7, '#3a6a3a');
  outline(c, { tint: 0.3 });
});
tile('kyaba_sofa', { solid: true, obj: true }, (c) => {
  R(c, 0, 6, 32, 24, '#5a0e2a'); R(c, 0, 6, 32, 3, '#8a2a4a'); R(c, 0, 26, 32, 4, '#3a0618');
  for (let x = 4; x < 32; x += 8) { disc(c, x, 14, 1, '#2a0414'); disc(c, x + 4, 20, 1, '#2a0414'); }
  R(c, 0, 9, 32, 1, '#c9a227');
  outline(c, { tint: 0.3 });
});
tile('kyaba_table', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 26, 14, 3);
  R(c, 1, 12, 30, 8, '#a8d8f0'); R(c, 1, 12, 30, 2, '#e8f8ff'); R(c, 1, 19, 30, 1, '#6a98b0');
  R(c, 3, 20, 2, 6, '#c9a227'); R(c, 27, 20, 2, 6, '#c9a227');
  R(c, 8, 6, 4, 7, '#e8f0ff'); R(c, 9, 8, 2, 4, '#ffd890'); R(c, 20, 7, 4, 6, '#e8f0ff'); R(c, 21, 9, 2, 3, '#c8e0a0');
  R(c, 14, 9, 4, 4, '#c9c6b8'); // ice bucket
  outline(c, { tint: 0.3 });
});
tile('kyaba_recept', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 8, 32, 22, '#14121a'); R(c, 0, 8, 32, 5, '#c9a227'); R(c, 0, 8, 32, 1, '#ffe9a0');
  R(c, 2, 15, 28, 13, '#1e1a24'); R(c, 4, 17, 24, 1, '#3a3044');
  R(c, 20, 4, 8, 5, '#2a2a30'); R(c, 21, 5, 6, 3, '#4fe0ff'); // the register tablet
  outline(c, { tint: 0.3 });
});
function chandelier(x, y) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, z: 400,
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('chand', 48, 40, (c) => {
        R(c, 23, 0, 2, 10, '#c9a227');
        R(c, 8, 10, 32, 3, '#c9a227'); R(c, 12, 13, 24, 2, '#a88a1a');
        for (let i = 0; i < 7; i++) { R(c, 9 + i * 5, 15, 1, 8 + (i % 2) * 6, '#e8f0ff'); disc(c, 9 + i * 5, 25 + (i % 2) * 6, 2, '#fff6d8'); }
      }), sx - 4, sy - 12);
      const k = Math.floor(g.frame / 12) % 7;
      U(ctx, sx + 0.5 + k * 2.5, sy + 1.5 + (k % 2) * 3, 1, 1, '#ffffff');
    },
  };
}
async function kyabaPriceBoard(g) {
  const pages = [
    `【料金のご案内】\nセット料金（60分）　${fmtMoney(KYABA.set)}\nご指名料　${fmtMoney(KYABA.shimei)}`,
    `キャストのドリンク　1杯 ${fmtMoney(KYABA.drink)}\n延長（30分）　${fmtMoney(KYABA.ext)}\nサービス料・税　${Math.round(KYABA.service * 100)}%`,
    '※18歳未満の方のご入店はお断りいたします。\n※二十歳未満の方への酒類の提供はいたしません。\n※キャストへの迷惑行為は固くお断りします。',
  ];
  await g.say(pages);
}
async function kyabaCastBoard(g) {
  const ids = castsHere(g);
  const i = await g.list({ title: '在籍キャスト', items: ids.map((id) => ({ label: CASTS[id].name, right: `${CASTS[id].age}歳` })), x: 150, y: 70, w: 340, px: true, describe: (k) => CASTS[ids[k]] && CASTS[ids[k]].profile });
  if (i >= 0) await g.say(CASTS[ids[i]].profile);
}
// The whole visit: age check, the system, 指名, the talk, drinks, 延長, the bill — and afterwards
// maybe a 週刊誌 photographer outside.
async function kyabaVisit(g, npc) {
  const o = who(npc);
  const st = g.state;
  const f = K(g);
  const a = age(g);
  await g.say('いらっしゃいませ。CLUB ステラへようこそ。', o);
  if (a < 18 || !f.idChecked || a < 20) {
    await g.say('恐れ入りますが、ご年齢の確認のため\n身分証を拝見できますか？', o);
    await narrate(g, '（身分証を見せた）');
  }
  if (a < 18) {
    await g.say(['…申し訳ございません。\n18歳未満の方は、法律でご入店いただけないんです。', 'またご縁がありましたら、そのときに。\nお気をつけてお帰りください。'], o);
    f.minorRefused = (f.minorRefused || 0) + 1;
    return;
  }
  f.idChecked = true;
  const minor = a < 20;
  const cost0 = Math.round(KYABA.set * (1 + KYABA.service));
  await g.say([`ありがとうございます。${minor ? '\n…二十歳未満のお客様ですね。\nお酒はお出しできませんので、ソフトドリンクでご案内します。' : ''}`, `セット料金は60分${fmtMoney(KYABA.set)}、ご指名料${fmtMoney(KYABA.shimei)}、\nキャストのドリンクは1杯${fmtMoney(KYABA.drink)}。\nほかに、サービス料・税が${Math.round(KYABA.service * 100)}%かかります。`], o);
  if (st.money < cost0) {
    await g.say(['（所持金では、セット料金も払えそうにない…）', ''].filter(Boolean));
    await g.say('またのお越しをお待ちしております。', o);
    return;
  }
  const ids = castsHere(g);
  const choose = await g.ask('ご指名はございますか？', ['やっぱり帰る', 'フリーで', '指名する'], { ...o, cancel: 0 });
  if (choose <= 0) { await g.say('かしこまりました。またのお越しを。', o); return; }
  let castId = null, shimei = false;
  if (choose === 2) {
    const i = await g.list({ title: 'だれを指名する？', items: ids.map((id) => ({ label: CASTS[id].name, right: `${CASTS[id].age}歳` })), x: 150, y: 70, w: 340, px: true, describe: (k) => CASTS[ids[k]] && CASTS[ids[k]].profile });
    if (i < 0) { await g.say('かしこまりました。またのお越しを。', o); return; }
    castId = ids[i];
    if (st.money < cost0 + Math.round(KYABA.shimei * (1 + KYABA.service))) { await g.say('（ご指名料までは、所持金が足りない…。\nフリーでお願いしよう）'); castId = null; }
    else shimei = true;
  }
  if (!castId) castId = ids[(today(g) + (f.visits || 0)) % ids.length];
  const cast = CASTS[castId];
  const C = { name: cast.name, look: cast.look };
  const bill = { set: KYABA.set, shimei: shimei ? KYABA.shimei : 0, drinks: 0, ext: 0 };
  const total = () => Math.round((bill.set + bill.shimei + bill.drinks * KYABA.drink + bill.ext * KYABA.ext) * (1 + KYABA.service));
  const canAfford = (add) => st.money >= Math.round((bill.set + bill.shimei + bill.drinks * KYABA.drink + bill.ext * KYABA.ext + add) * (1 + KYABA.service));
  f.visits = (f.visits || 0) + 1;
  f.visitDays = (f.visitDays || []).filter((d) => d > today(g) - 7).concat([today(g)]);
  if (shimei) { f.shimei = f.shimei || {}; f.shimei[castId] = (f.shimei[castId] || 0) + 1; }
  let relief = 0, talks = 0;
  await withVignette(g, 'booth', { title: 'CLUB ステラ', sub: `${cast.name}（${shimei ? '指名' : 'フリー'}）`, cast: { look: cast.look }, glasses: 1, soft: minor }, async (v) => {
    await g.say(cast.hello, C);
    if (minor) await g.say('ウーロン茶でいいですか？\n二十歳になったら、乾杯しようね。', C);
    else if (typeof g.drinkAlcohol === 'function') await g.drinkAlcohol({ where: 'キャバクラ' });
    // one topic per half hour: the 60-minute set is two topics, each 延長 one more (2 at most)
    let slots = 2;
    for (let slot = 0; slot < slots; slot++) {
      const t = await g.ask('（何を話そう？）', ['仕事の話', '趣味の話', '話を聞いてもらう'], { cancel: 2 });
      const key = ['work', 'hobby', 'listen'][Math.max(0, t)];
      await g.say(cast.topics[key], C);
      talks++;
      relief += talks === 1 ? 10 : 4;
      // the cast's own story moves on with 指名 (only with the one you choose)
      if (shimei && slot === 0) await castStory(g, castId, C);
      if (slot === 0 || slot === 2) {
        const d = await g.ask(`${cast.name}：「わたしも、ドリンクいただいてもいい？」\n（1杯 ${fmtMoney(KYABA.drink)}＋サービス料）`, ['今日はやめておく', 'どうぞ'], { cancel: 0 });
        if (d === 1 && canAfford(KYABA.drink)) { bill.drinks++; v.opts.glasses++; g.sfx('ok'); await g.say('ありがとう！ かんぱ〜い♪', C); }
        else if (d === 1) await g.say('（…所持金が心配だ。やめておこう）');
        else await g.say('うん、ぜんぜん大丈夫！', C);
      }
      if (slot === slots - 1 && bill.ext < 2) {
        const k2 = await g.ask(['（黒服がそっと近づいてきた）', `お時間です。延長されますか？\n（30分 ${fmtMoney(KYABA.ext)}＋サービス料）\nいまのお会計は ${fmtMoney(total())} です。`], ['お会計にする', '延長する'], { ...o, cancel: 0 });
        if (k2 !== 1) break;
        if (!canAfford(KYABA.ext)) { await g.say('（延長できるほどのお金がない…。帰ろう）'); break; }
        bill.ext++;
        slots++;
      }
    }
    if (!minor && bill.ext >= 1 && typeof g.drinkAlcohol === 'function') await g.drinkAlcohol({ heavy: bill.ext >= 2, where: 'キャバクラ' });
    await g.say(talks >= 3 ? ['今日はいっぱいお話しできて、うれしかった。\nでも、お金は大事にしてね？', 'また、元気な顔を見せてね。'] : ['今日はありがとう！\nお仕事、がんばってね。'], C);
  });
  // the bill
  const sum = total();
  const lines = [`セット ${fmtMoney(bill.set)}${bill.shimei ? `／指名料 ${fmtMoney(bill.shimei)}` : ''}`, `ドリンク ${bill.drinks}杯 ${fmtMoney(bill.drinks * KYABA.drink)}／延長 ${bill.ext}回 ${fmtMoney(bill.ext * KYABA.ext)}`, `サービス料・税込みで、合計 ${fmtMoney(sum)}`];
  await g.say(['お会計でございます。', lines.join('\n')], o);
  const paid = Math.min(st.money, sum);
  st.money -= paid;
  g.sfx('coin');
  f.spent = (f.spent || 0) + paid;
  const once = !doneToday(g, 'kyaba');
  markToday(g, 'kyaba');
  const r = once ? relief : Math.round(relief / 3);
  g.addNeed('stress', -r);
  await narrate(g, [`（${fmtMoney(paid)}を払った。）`, `（たくさん話して、少し気が晴れた。ストレス -${r}）${f.visitDays.length >= 3 ? '\n（…でも、今週はもう何度も来ている。お金は大丈夫だろうか）' : ''}`]);
  if (shimei) f.castMsg = { id: castId, day: today(g) };
  await g.say('ありがとうございました。\nお足もとにお気をつけて。', o);
  await paparazzi(g, cast);
}
async function castStory(g, id, C) {
  const f = K(g);
  f.castStory = f.castStory || {};
  f.castStoryDay = f.castStoryDay || {};
  const n = f.shimei[id] || 0;
  const stage = f.castStory[id] || 0;
  // a new chapter on the 3rd and the 5th 指名, on different days
  const need = [3, 5][stage];
  if (!need || n < need || f.castStoryDay[id] === today(g)) return;
  await g.say(CASTS[id].story[stage], C);
  f.castStory[id] = stage + 1;
  f.castStoryDay[id] = today(g);
  if (stage + 1 >= 2) { f.castGoneDay = f.castGoneDay || {}; f.castGoneDay[id] = today(g) + 7; }
  g.addNeed('stress', -5);
}
// A 週刊誌 photographer may be waiting outside for a famous face or a politician.
async function paparazzi(g, cast) {
  const f = K(g);
  const pol = politician(g);
  if (!famous(g) && !pol) return;
  const week = (f.visitDays || []).length;
  if (f.photoDay && today(g) - f.photoDay < 20) return;
  const p = (pol ? 0.2 : 0.12) + 0.05 * Math.max(0, week - 1);
  if (!roll(p)) return;
  f.photoDay = today(g);
  await withVignette(g, 'street', { title: '店の外', sub: 'カシャッ、カシャッ…', flash: true, kisha: true }, async () => {
    await g.say(['（店を出たとたん、フラッシュが光った！）', '週刊ドットです！\nいまのお店、常連なんですか？'], { name: '週刊誌のカメラマン', look: { hair: 'cap', hat: '#5a4a3a', hairColor: 'brown', skin: 'tan', top: '#8a7a5a', bottom: '#4a4038' } });
    await narrate(g, '（顔をそむけたが、何枚も撮られてしまった…）');
  });
  if (pol && typeof g.politicalScandal === 'function') {
    try { g.politicalScandal('private', { name: 'キャバクラ通い', severity: 2 }); } catch (e) { console.error(e); }
  } else if (typeof g.careerSanction === 'function') {
    try { g.careerSanction(1, { force: true }); } catch (e) { console.error(e); }
    g.message({ from: '週刊ドット', kind: 'news', text: g.fmt('【独占】人気タレント{fullname}、ネオン街のキャバクラで夜な夜な…？') });
    if (g.state.agency) g.message({ from: AGENCIES[g.state.agency].name, kind: 'chat', text: '週刊誌に写真が出ました…。\n法律に反することではないけれど、イメージは大事です。\nしばらくは、夜の街は控えてください。' });
  }
}

registerPlace({
  id: 'kyabakura',
  name: 'CLUB ステラ',
  kind: 'building',
  bgm: 'lounge',
  start: { room: 'floor', x: 8, y: 10, dir: 'up' },
  rooms: {
    floor: {
      floor: 'kyaba_floor',
      wall: 'black',
      tiles: [
        '##################',
        '#=bbb=m=PPP=m=cc=#',
        '#................#',
        '#KKKK..UUUU..UUUU#',
        '#................#',
        '#......TTTT..TTTT#',
        '#................#',
        '#UUUU............#',
        '#............QQQ.#',
        '#TTTT..........f.#',
        '#................#',
        '#######EE#########',
      ],
      legend: {
        b: 'wall_black+kyaba_bottles', m: 'wall_black+kyaba_mirror', P: 'wall_black+kyaba_price', c: 'wall_black+kyaba_castboard',
        K: 'kyaba_bar', U: 'kyaba_sofa', T: 'kyaba_table', Q: 'kyaba_recept', f: 'flower_stand', E: 'exit_mat',
      },
      warps: exits([7, 8], 11),
      entities: [
        chandelier(8.5, 2), chandelier(14.5, 2),
        { type: 'npc', id: 'kyaba_kurofuku', x: 14, y: 7, dir: 'down', look: KUROFUKU.look, name: KUROFUKU.name, talk: kyabaVisit, fixedDir: true },
        { type: 'npc', id: 'kyaba_bartender', x: 2, y: 2, dir: 'down', look: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#ffffff', bottom: '#14121a', tie: '#14121a', beard: true }, name: 'バーテンダー', fixedDir: true,
          text: ['いらっしゃいませ。', 'うちのキャストは、みんなそれぞれに夢がある子たちでね。\nお話を楽しんでもらうのが、この店の仕事です。', 'しつこく連絡先を聞いたり、店の外で待ち伏せたり…\nそういうお客様には、お帰りいただいています。'] },
        { type: 'npc', id: 'kyaba_guest1', x: 8, y: 4, dir: 'down', look: { ...LOOKS.salaryman, tie: '#c9a227' }, name: '常連の会社員', fixedDir: true,
          text: ['今日は昇進祝いなんだ。\n部下に気をつかって、上司に気をつかって…', 'ここでは、だれにも気をつかわなくていい。\n…まあ、財布にはやさしくないけどね。ははは。'] },
        { type: 'npc', id: 'kyaba_cast1', x: 9, y: 4, dir: 'down', look: CASTS.reina.look, name: 'キャストのレイナ', fixedDir: true, cond: (g) => !castGone(g, 'reina'),
          text: ['（お客さんの話に、静かにうなずいている）', '…いらっしゃいませ。\nまたのちほど、ご指名いただけたらうれしいです。'] },
        { type: 'npc', id: 'kyaba_guest2', x: 14, y: 4, dir: 'down', look: { ...LOOKS.oldman, top: '#3a3a4a' }, name: 'ひとりで来た老紳士', fixedDir: true,
          text: ['家内に先立たれてね。\n家にいても、話す相手がいないんだ。', 'ここで少し話をして、帰る。\n月に一度の、ぜいたくだよ。'] },
        { type: 'npc', id: 'kyaba_cast2', x: 15, y: 4, dir: 'down', look: CASTS.yuu.look, name: 'キャストのユウ', fixedDir: true, cond: (g) => !castGone(g, 'yuu'),
          text: ['（お客さんに、お芝居の話をしている）', 'あっ、いらっしゃいませ！\n次、わたし空いてますよ〜。'] },
        { type: 'npc', id: 'kyaba_cast3', x: 5, y: 8, dir: 'right', look: CASTS.misaki.look, name: 'キャストのミサキ', fixedDir: true, cond: (g) => !castGone(g, 'misaki'),
          text: ['いらっしゃいませ〜！ミサキです！', '（待機中。爪の先を、そっと確かめている）'] },
        { type: 'sign', x: 9, y: 1, talk: kyabaPriceBoard }, { type: 'sign', x: 10, y: 1, talk: kyabaPriceBoard }, { type: 'sign', x: 8, y: 1, talk: kyabaPriceBoard },
        { type: 'sign', x: 14, y: 1, talk: kyabaCastBoard }, { type: 'sign', x: 15, y: 1, talk: kyabaCastBoard },
        { type: 'sign', x: 2, y: 1, text: 'お酒のボトルが、ずらりと並んでいる。\nボトルの首には、お客さんの名札がかかっている。' },
      ],
      onEnter: (g) => firstVisit(g, 'kyaba', ['いらっしゃいませ。', 'ご案内は、こちらの受付でいたします。'], KUROFUKU),
    },
  },
});

// ====================================================================== ドットローン ('shohisha': 消費者金融, legal)
// The counter explains the rate of the time (上限金利), 総量規制 (2010-06〜: 年収の3分の1) and a
// repayment plan before anything is signed; the loan itself is g.borrow('shohisha').
tile('loan_floor', { variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#e4e8ec');
  for (let y = 0; y < 32; y += 16) for (let x = 0; x < 32; x += 16) { R(c, x + 1, y + 1, 14, 14, (x + y + v * 16) % 32 ? '#eaeef2' : '#e0e4e8'); R(c, x + 1, y + 1, 14, 1, '#f6f8fa'); }
});
tile('loan_counter', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 10, 32, 20, '#f4f6f8'); R(c, 0, 10, 32, 5, '#2f9a6a'); R(c, 0, 10, 32, 1, '#5ac08a');
  R(c, 0, 15, 32, 1, '#c8ccd2'); R(c, 2, 18, 28, 10, '#e4e8ec');
  R(c, 0, 0, 2, 14, '#c8d8e0'); R(c, 30, 0, 2, 14, '#c8d8e0'); R(c, 0, 0, 2, 1, '#ffffff'); // partitions
  R(c, 8, 6, 14, 5, '#ffffff'); R(c, 9, 7, 9, 1, '#9aa0aa'); R(c, 9, 9, 6, 1, '#9aa0aa'); // the papers
  R(c, 24, 7, 3, 4, '#2a2a30');
  outline(c, { tint: 0.3 });
});
tile('loan_atm', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 12, 2);
  R(c, 4, 0, 24, 30, '#d8dce2'); R(c, 4, 0, 24, 2, '#f4f6f8'); R(c, 26, 0, 2, 30, '#a8acb6');
  R(c, 4, 2, 24, 5, '#2f9a6a');
  R(c, 8, 9, 16, 10, '#2a3a4a'); R(c, 9, 10, 14, 8, '#7ad8b0'); R(c, 10, 11, 8, 1, '#ffffff'); R(c, 10, 13, 10, 1, '#d0f8e8');
  R(c, 8, 21, 16, 3, '#9aa0aa'); R(c, 10, 25, 12, 2, '#3a3a44');
  outline(c, { tint: 0.3 });
});
tile('loan_board', { obj: true }, (c) => {
  R(c, 3, 4, 26, 24, '#2a2a30'); R(c, 4, 5, 24, 22, '#ffffff');
  R(c, 4, 5, 24, 4, '#2f9a6a');
  for (let i = 0; i < 5; i++) R(c, 6, 11 + i * 3, i % 2 ? 14 : 18, 1, '#6a7078');
});
tile('loan_poster', { obj: true }, (c) => {
  R(c, 5, 4, 22, 24, '#fffbe8'); R(c, 5, 4, 22, 1, '#ffffff');
  disc(c, 16, 12, 5, '#5ac08a'); R(c, 13, 11, 6, 2, '#ffffff');
  R(c, 8, 20, 16, 2, '#2f7a52'); R(c, 9, 24, 14, 1, '#9aa0aa');
});
tile('loan_numbers', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 6, 2);
  R(c, 14, 14, 4, 16, '#9aa0aa');
  R(c, 8, 4, 16, 12, '#2f9a6a'); R(c, 10, 6, 12, 5, '#1a2a22'); R(c, 11, 7, 3, 3, '#ff6a3a'); R(c, 15, 7, 3, 3, '#ff6a3a');
  R(c, 12, 13, 8, 2, '#ffffff');
  outline(c, { tint: 0.3 });
});
const LOAN_STAFF = { name: 'ドットローンの相談員', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#2f6a52', jacket: true, tie: '#2f9a6a' } };
// The plan: the core's minimum payment every 10 days (the game's month): max(¥2,000, 3% of the
// balance), interest at the annual rate / 12 per cycle. Returns { cycles, interest, pay }.
function loanPlan(principal, rate, pay = null) {
  let bal = principal, interest = 0, n = 0;
  const first = pay || Math.max(2000, Math.round(principal * 0.03 / 1000) * 1000);
  while (bal > 0 && n < 600) {
    const i = bal * rate / 12;
    interest += i;
    bal += i;
    const p = Math.min(bal, pay || Math.max(2000, Math.round(bal * 0.03 / 1000) * 1000));
    bal -= p;
    n++;
  }
  return { cycles: n, interest: Math.round(interest), first, done: bal <= 0 };
}
const cyclesText = (n) => (n >= 12 ? `約${Math.round(n / 12 * 10) / 10}年（${n}回）` : `${n}回`);
async function loanDesk(g, npc) {
  const o = who(npc);
  const L = LENDERS.shohisha;
  const loans = () => { const j = jus(g); return j ? (j.loans || []).filter((l) => l.lender === 'shohisha' && l.status !== 'void' && l.status !== 'paid') : []; };
  if (!K(g).met_loan) {
    K(g).met_loan = today(g);
    await g.say([`いらっしゃいませ。${eraKey(g) === 'showa' ? 'ドットローン（消費者金融）' : 'ドットローン'}の相談窓口です。`, '借りる前に、金利と返し方をよくご説明します。\nご利用は計画的に、が当社のお約束です。'], o);
  }
  for (;;) {
    const has = loans().length > 0;
    const items = ['しくみを聞く', '借入れの相談', ...(has ? ['返済する'] : []), 'やめておく'];
    const k = await g.ask('ご用件をどうぞ。', items, { ...o, cancel: items.length - 1 });
    const pick = items[k];
    if (!pick || pick === 'やめておく') { await g.say('ありがとうございました。\nお困りのことがあれば、いつでもご相談ください。', o); return; }
    if (pick === 'しくみを聞く') await loanExplain(g, o);
    if (pick === '借入れの相談') await loanBorrow(g, o);
    if (pick === '返済する') await loanRepay(g, o, loans());
  }
}
async function loanExplain(g, o) {
  const rate = lenderRate(g, 'shohisha', 100000);
  const pages = [
    `当社の実質年率は、10万円なら${Math.round(rate * 1000) / 10}%です。\n${rateLawText(g)}。`,
    'たとえば10万円を借りて、最低額だけ返していくと…\n' + (() => { const p = loanPlan(100000, rate); return `毎回${fmtMoney(p.first)}ずつ、完済まで${cyclesText(p.cycles)}。\n利息だけで、およそ${fmtMoney(p.interest)}になります。`; })(),
    `返済日は${MONTH_DAYS}日ごと（ゲームの中の1か月）。口座から自動で\n引き落とします。2回続けて遅れると「信用情報」に\n延滞が記録されて、5年ほど新しい借入れができません。`,
  ];
  if (since(g, 2010, 6)) pages.push('それから「総量規制」。貸金業者からの借入れは、\nほかの会社の分も合わせて、年収の3分の1までです。\n（銀行のカードローンは別のルールです）');
  pages.push('借金を返すための借金は、絶対にやめてください。\nそれが「多重債務」の入口です。');
  await g.say(pages, o);
}
async function loanBorrow(g, o) {
  const st = g.state;
  if (age(g) < 20) { await g.say(['申し訳ございません。\n当社のご契約は、二十歳以上の方に限らせていただいています。'], o); return; }
  const inc = typeof g.annualIncome === 'function' ? g.annualIncome() : 0;
  const limit = typeof g.loanLimit === 'function' ? g.loanLimit('shohisha') : 0;
  const lines = [`まず、ご年収を確認させてください。\n…この1年のご収入は、およそ${fmtMoney(inc)}ですね。`];
  if (since(g, 2010, 6)) lines.push(`総量規制で、お貸しできるのは年収の3分の1まで。\nほかの借入れを引いて、あと${fmtMoney(Math.max(0, limit))}までです。`);
  else lines.push(`審査の結果しだいですが、1社あたり${fmtMoney(Math.max(0, limit))}までが目安です。`);
  await g.say(lines, o);
  const amounts = [50000, 100000, 300000, 500000];
  const items = amounts.map((a) => `${fmtMoney(a)}`).concat(['やめておく']);
  const k = await g.ask('おいくら、ご希望ですか？', items, { ...o, cancel: items.length - 1 });
  if (k < 0 || k >= amounts.length) return;
  const amount = amounts[k];
  const rate = lenderRate(g, 'shohisha', amount);
  const p = loanPlan(amount, rate), fast = loanPlan(amount, rate, Math.max(10000, Math.round(amount / 10 / 1000) * 1000));
  await g.say([
    `${fmtMoney(amount)}を年${Math.round(rate * 1000) / 10}%でお借りになると…`,
    `【最低額で返す】毎回${fmtMoney(p.first)}から、完済まで${cyclesText(p.cycles)}。\n利息の合計 およそ${fmtMoney(p.interest)}。`,
    `【毎回${fmtMoney(Math.max(10000, Math.round(amount / 10 / 1000) * 1000))}ずつ返す】完済まで${cyclesText(fast.cycles)}。\n利息の合計 およそ${fmtMoney(fast.interest)}。\n早く返すほど、利息は少なくてすみます。`,
  ], o);
  const c = await g.ask('ご契約されますか？', ['やめておく', '契約する'], { ...o, cancel: 0 });
  if (c !== 1) { await g.say('かしこまりました。\n慎重にお考えになるのが、いちばんです。', o); return; }
  const res = g.borrow('shohisha', amount);
  if (!res || !res.ok) { await g.say(res && res.reason ? res.reason : '審査に通りませんでした…。', o); return; }
  g.sfx('coin');
  K(g).borrowed = (K(g).borrowed || 0) + 1;
  await g.say([`ご契約ありがとうございます。${fmtMoney(res.received)}をお貸しします。`, `返済日は${MONTH_DAYS}日ごと。口座から自動で引き落とします。\nスマホの「借入・返済」アプリでも、確認や返済ができます。`, '返済が苦しくなったら、遅れる前にご相談ください。'], o);
}
async function loanRepay(g, o, loans) {
  const st = g.state;
  const l = loans[0];
  if (!l) return;
  const bal = loanBalance(l);
  const min = Math.min(bal, Math.max(2000, Math.round(bal * 0.03 / 1000) * 1000));
  const opts = [`全額（${fmtMoney(bal)}）`, `1万円`, `最低額（${fmtMoney(min)}）`, 'やめておく'];
  const k = await g.ask(`${l.company}のご返済ですね。\n残高は ${fmtMoney(bal)} です。`, opts, { ...o, cancel: 3 });
  if (k < 0 || k === 3) return;
  const amount = k === 0 ? bal : k === 1 ? Math.min(bal, 10000) : min;
  if (st.money < amount) { await g.say('（所持金が足りない…）'); return; }
  const r = g.repay(l, amount);
  if (r.cleared) await g.say(['ご完済、おめでとうございます。\nおつかれさまでした。'], o);
  else await g.say(`${fmtMoney(r.paid)}、たしかにお預かりしました。\n残りは ${fmtMoney(r.left)} です。`, o);
}

registerPlace({
  id: 'shohisha',
  name: 'ドットローン',
  kind: 'building',
  bgm: 'office',
  start: { room: 'main', x: 6, y: 7, dir: 'up' },
  rooms: {
    main: {
      floor: 'loan_floor',
      wall: 'white',
      tiles: [
        '#############',
        '#=b=p==w=p=n#',
        '#...........#',
        '#.CCC...CCC.#',
        '#...........#',
        '#A.......SS.#',
        '#P........N.#',
        '#...........#',
        '######EE#####',
      ],
      legend: { b: 'wall_white+loan_board', p: 'wall_white+loan_poster', n: 'wall_white+clock', C: 'loan_counter', A: 'loan_atm', S: 'sofa_blue', P: 'plant', N: 'loan_numbers', E: 'exit_mat' },
      warps: exits([6, 7], 8),
      entities: [
        { type: 'npc', id: 'loan_staff', x: 3, y: 2, dir: 'down', look: LOAN_STAFF.look, name: LOAN_STAFF.name, talk: loanDesk, fixedDir: true },
        { type: 'npc', id: 'loan_staff2', x: 9, y: 2, dir: 'down', look: { ...LOAN_STAFF.look, hair: 'short', hairColor: 'black', skin: 'fair', bottom: '#2f6a52' }, name: '返済相談の係', talk: loanDesk, fixedDir: true },
        { type: 'npc', id: 'loan_customer', x: 9, y: 5, dir: 'up', look: { ...LOOKS.salaryman, top: '#5a5e6a', tie: '#5a5e6a' }, name: '順番を待つ男性',
          text: ['…最初は、ちょっと足りない分だけのつもりだったんだ。', '返済日に足りなくて、別の会社で借りて…\nいまは、3社から借りてる。', '利息を払うために働いてるみたいだよ。\n…今日は、返済の相談に来たんだ。'] },
        { type: 'sign', x: 2, y: 1, talk: async (g) => { await g.say(['「貸付条件の掲示」が貼ってある。（貸金業法で、\n店に見えるように出すことが決められている）', `実質年率　${Math.round(lenderRate(g, 'shohisha', 100000) * 1000) / 10}%（10万円の場合）\n返済方式　残高スライドリボルビング\n遅延損害金　年20%`]); } },
        { type: 'sign', x: 4, y: 1, text: ['ポスターだ。', '「ご利用は計画的に。」\n「返済が苦しいときは、お早めにご相談ください」'] },
        { type: 'sign', x: 9, y: 1, text: ['ポスターだ。', '「借金の悩みは、ひとりで抱えずに。\n多重債務の相談窓口があります」'] },
        { type: 'sign', x: 1, y: 5, talk: async (g) => { if (since(g, 1993)) await g.say(['自動契約機だ。', '人と顔を合わせずに、その場でカードが作れる。\n…手軽すぎるのも、ちょっとこわい。']); else await g.say(['カード発行機だ。', '契約した人のカードは、ここで受け取るらしい。']); } },
        { type: 'sign', x: 10, y: 6, text: '番号札の発券機だ。\n「ご相談の方は、番号札をお取りください」' },
      ],
      onEnter: (g) => firstVisit(g, 'shohisha', ['いらっしゃいませ。ドットローンです。', 'ご相談は、カウンターへどうぞ。'], LOAN_STAFF),
    },
  },
});
