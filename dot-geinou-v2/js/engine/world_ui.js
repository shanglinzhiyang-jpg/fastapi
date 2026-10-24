// 世界情勢 (world_ui): the HD screen of the world-affairs core (js/engine/world.js) and the phone app 「世界」.
// Only CALLS the cores' g.* APIs: world.js (g.world, g.worldCountry, g.diplomacy*, …), regime.js (g.war, g.warOrders,
// g.warOrder, g.warPaths, g.regimeSteps, g.regimeStep, g.regimeFlush) — all feature-detected.
//
// The screen (640x360, scene flags hd / opaque / hidesHud / isWorldUI): tabs 地図 · 国々 · 外交 · 同盟・条約 ·
// 危機・戦争 · ニュース, a news ticker at the bottom. The map is a pixel-art world (Natural Earth data, public domain,
// rasterised to 2.5° cells, Pacific-centred as Japanese maps are), coloured by the relation with Japan, by bloc or by
// alliance; capitals, crises, conflicts, the territorial disputes and the fictional ヴェルミナ海 (inset) are marked.
// Every action shows its odds, costs and consequences before it is taken; a locked one says why and the path.
// Keys: ←→ tabs (on the tab bar), ↓/A into the body, ↑↓ (←→ on the map) choose, A act, B back, MENU close.
// Taps: tabs, ×, list rows (first tap selects, second acts), map markers, the map's colour chips, modal buttons.
//
// API: g.worldScreen(tab?, opts?) → Promise (resolves when closed); openWorldScreen(g, { tab, sel });
//   tab: 'map' | 'countries' | 'diplomacy' | 'alliances' | 'crisis' | 'news'. Under g.auto it does not open unless
//   g.auto.worldui. Phone app 'world' (「世界」, order 61). Test hook: window.__worldui = { scene(), open, TABS }.

import { Game } from './game.js';
import { SW, SH, clamp, makeCanvas } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { registerPhoneApp } from './life.js';
import { phoneList, phoneInfo, appTile } from './phone.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const n0 = (n) => Math.max(0, Math.round(num(n))).toLocaleString('ja-JP');
// troops given in 千人 → 「約1.6万人」 / 「約8,000人」
const troops = (k) => (num(k) >= 10 ? `約${(Math.round(num(k)) / 10).toFixed(1).replace(/\.0$/, '')}万人` : `約${n0(num(k) * 1000)}人`);
const K = {
  bg: '#07101c', head: '#0b1626', panel: '#0d1a2c', panel2: '#10223a', edge: '#21405e', edgeHi: '#4a86b8', text: '#e8f0f8', dim: '#93a8bc', faint: '#566c80',
  amber: '#ffb547', cyan: '#4fd2e8', good: '#57d98a', bad: '#ff6470', warn: '#ffcc4d', sel: '#173452', lock: '#c9a76a', sea: '#0c2640', sea2: '#0e2c48', land: '#4a5462', white: '#ffffff', danger: '#ff5468',
};
// ================================================================ text helpers (no overflow: every string has a width)
function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
function T(c, s, x, y, size = 12, color = K.text, align = 'left', w = 0) { text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: null }); }
// Japanese line breaking: a number keeps its unit (「5,260人」「1.2兆円」「48%」), no closing mark starts a line.
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const TOKEN = /[−\-]?[0-9０-９]+(?:[.,][0-9]+)*(?:[／/][0-9]+)?(?:分の[0-9]+|[%％年月日歳人分万億兆円倍回本条号割棟件隻機台ドル]+)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
function jwrap(c, str, w, size = 12) {
  measure(c, '', size);
  const Wd = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = par.match(TOKEN) || [];
    let line = '';
    for (const t of toks) {
      if (!line && /^\s+$/.test(t)) continue;
      if (Wd(line + t) <= w) { line += t; continue; }
      if (!line) { for (const ch of Array.from(t)) { if (line && Wd(line + ch) > w) { out.push(line); line = ''; } line += ch; } continue; }
      let carry = '';
      if (Array.from(t).length === 1 && NO_START.has(t)) { const a0 = Array.from(line); carry = a0.pop(); line = a0.join(''); }
      while (line.length > 1 && NO_END.has(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
      out.push(line);
      line = carry + (/^\s+$/.test(t) ? '' : t);
    }
    out.push(line);
  }
  return out;
}
function para(c, s, x, y, w, size = 12, color = K.text, lh = 0, maxLines = 99) {
  const ls = jwrap(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], x, y + i * step, size, color);
  return n * step;
}
function panel(c, x, y, w, h, title, opts = {}) {
  R(c, x, y, w, h, opts.bg || K.panel);
  R(c, x, y, w, 1, opts.accent || K.edge); R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
  if (title) { R(c, x + 1, y + 1, w - 2, 15, K.panel2); T(c, title, x + 6, y + 2, 10, opts.accent || K.amber, 'left', w - 12 - (opts.right ? measure(c, opts.right, 10) + 8 : 0)); if (opts.right) T(c, opts.right, x + w - 6, y + 2, 10, K.dim, 'right'); }
}
const relColor = (v) => (v >= 60 ? '#3aa86a' : v >= 25 ? '#7cbc62' : v > -25 ? '#c4b46a' : v > -60 ? '#d07a46' : '#c63c3c');
function gauge(c, x, y, w, v, lo = -100, hi = 100) {
  R(c, x, y, w, 6, '#1a2a3a');
  const z = x + ((0 - lo) / (hi - lo)) * w;
  const p = x + ((clamp(v, lo, hi) - lo) / (hi - lo)) * w;
  R(c, Math.min(z, p), y, Math.max(1, Math.abs(p - z)), 6, relColor(v));
  R(c, z, y - 1, 1, 8, K.dim);
}

// ================================================================ the map (Natural Earth 1:50m, public domain; world-atlas 2.0.2, ISC)
// 144 × 53 cells of 2.5°: longitude −25 → 335 (Pacific-centred), latitude 75 → −57.5. Codes: '.' sea, 'x' other land.
const MAP = { COLS: 144, ROWS: 53, LON0: -25, LAT0: 75, STEP: 2.5, CELL: 4, X: 32, Y: 42 };
const LEGEND = { '.': '.', x: 'x', A: 'sv', B: 'au', C: 'br', D: 'ca', E: 'cn', F: 'tw', G: 'fr', H: 'de', I: 'in', J: 'id', K: 'ir', L: 'iq', M: 'il', N: 'it', O: 'jp', P: 'kp', Q: 'kr', R: 'my', S: 'ph', T: 'ru', U: 'sa', V: 'sg', W: 'vn', X: 'th', Y: 'tr', Z: 'ua', a: 'gb', b: 'us', c: 'dd' };
const MAP_DATA = 'xx.29T03.04T.03T20.04T.37D06.D.DD.D07.08x13x.18x.x.09TT.04T37.16b04.10D09.D03.D08.06x12T17x05TT..T04.04TT.T45.T05b10T04DT06DDTDT07DT03DDT08x09TT16x03T03.T05.10T.43T.T04b10T46.x03.09x09T60.06b10D24.D.D03.05x05.06.12x05.x04T58.07b11D19.06D03.08x03.07.08a.03x06.AAT48.TT.T03.13b04.05bbD17.06D06.15.07aa.04x04.A04T44.06T03.14bb.09bD19.03D07.14.06xxaa..xHHcx03A04T12A06T26.05TT.27D20.D10.12.06x.a03xxHHcx04Z04T06AT03A08T07xxT07E03T07.04T.30D29.12.08G05HHx04Z07T03A16x12E05T06.36D25.D03.11.09G04xNx06AZ03T05A13E03x11E07T.39b16D06bD03.14.07xxG04N03x06.03T04.A12E06x07E08T..OO.36b17DDb04DD.15.06x05..G.NNx04Y06A03.A10E20P.04O.37b22.18.06x04.05NN.xxY08KK.A09E18..PQ.04O.37b20.20.07xx.x05.06Y03x03LK06AAx04E19.QQ.O04.38b19.20.07x08.09xxLLK06x06IIE16.04O03.41b17.21.06x11.x07UULLK05x06IIE17.48x05b10.22.05x19U06K05x04I03xxE15.49x06bb.b.03b.22.04x20U06.K04x03I07xIIxE09.50x07.06b.22.03x21.U06x03.03xI07xxIxE08.F.50x.x04.06x.22.03x22U07xx.04I08.x04WWEE.56x04.03x.03xx.20.03x22.U04x03.06I05.03xxXXxWE.04S.53x07.05xx.18.03x23.x05.07I04.05xX03x.05S.55x06.24.03x27.10II.07XXxxW.04S.58x04.23.04x27.09II.07X.xWW.05S.59xx.03x05.15.04x26.10IIx.06X..W.06SS.59x10.14.05x25.12x.07R.05RR..S.62x09G.11.13x16.19JJRR.03RJ.66x06CxxGC.10.14x14.21JJR.J06.63x04CxC06.10.13x14.23JJ..J03.J.03JJ.J.55x05C10.08.14x12.25JJ.J05.04J04x.53x05C13.05.15x11.26J03.10Jx03.52x04C15.04.15x11.28JJ.03Jx.05x04.52x03C15.04.15x12.36B.59x05C11.05.15x12..x.30B.B03.BB.55x06C10.05.14x12..xx.29B10.55x06C09.05.15x10..x03.28B11.57x05C07.06.15x09.03x03.26B14.06x.49x05C07.06.16x08.03xx.26B16.54x07C05.07.16x07.32B17.53x07C03.09.16x07.33B16.53x07C03.09.17x05.34B15.54x07CC.10.17x04.35B04.04B07.54x08.11.65B05.09x.45x06.13.67BB.10x03.42x07.13.68B.09x03.43x05.15.68B.08xx.45x04.16.77x.46x04.16.99.25x03.17.99.25x03.03x.13.99.25x04.16.99.45';
let GRID = null;
function grid() {
  if (GRID) return GRID;
  const out = [];
  const s = MAP_DATA;
  for (let i = 0; i < s.length;) {
    const ch = s[i++];
    let n = 1;
    if (/[0-9]/.test(s[i] || '') && /[0-9]/.test(s[i + 1] || '')) { n = Number(s.slice(i, i + 2)); i += 2; }
    const code = LEGEND[ch] || '.';
    for (let k = 0; k < n; k++) out.push(code);
  }
  GRID = out;
  return GRID;
}
// the country a cell stands for at the game's date (ソ連 before 1991-12-26, 東西ドイツ before 1990-10-03)
function cellCountry(code, dn) {
  if (code === 'ru' || code === 'ua' || code === 'sv') return dn < 19911226 ? 'su' : code === 'sv' ? 'x' : code;
  if (code === 'de') return dn < 19901003 ? 'wde' : 'de';
  if (code === 'dd') return dn < 19901003 ? 'dde' : 'de';
  return code;
}
function project(lat, lon) {
  let L = lon;
  if (L < MAP.LON0) L += 360;
  return { x: MAP.X + ((L - MAP.LON0) / MAP.STEP) * MAP.CELL, y: MAP.Y + ((MAP.LAT0 - lat) / MAP.STEP) * MAP.CELL };
}
const MODES = [{ id: 'relation', label: '関係' }, { id: 'bloc', label: '陣営' }, { id: 'alliance', label: '同盟' }];
function cellColor(ui, id) {
  const d = ui.data;
  if (id === '.') return null;
  if (id === 'x') return K.land;
  if (id === 'jp') return '#f0f0f6';
  const row = d.rows[id];
  if (!row) return K.land;
  if (row.war) return Math.floor(ui.t / 20) % 2 ? '#ff3848' : '#a82030';
  if (ui.mode === 'bloc') return (d.w.blocs[row.bloc] || {}).color || K.land;
  if (ui.mode === 'alliance') return row.ally ? '#4f8fe8' : row.sanction ? '#c07040' : row.onJapan ? '#a05050' : '#5a6270';
  return relColor(row.relation);
}
function bakeMap(ui) {
  const [cv, c] = makeCanvas(MAP.COLS * MAP.CELL, MAP.ROWS * MAP.CELL);
  c.fillStyle = K.sea; c.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < cv.height; y += 16) { c.fillStyle = K.sea2; c.fillRect(0, y, cv.width, 1); }
  for (let x = 0; x < cv.width; x += 16) { c.fillStyle = K.sea2; c.fillRect(x, 0, 1, cv.height); }
  const G0 = grid();
  const dn = ui.data.dn;
  for (let r = 0; r < MAP.ROWS; r++) for (let q = 0; q < MAP.COLS; q++) {
    const code = G0[r * MAP.COLS + q];
    if (!code || code === '.') continue;
    const col = cellColor(ui, cellCountry(code, dn));
    if (!col) continue;
    c.fillStyle = col;
    c.fillRect(q * MAP.CELL, r * MAP.CELL, MAP.CELL, MAP.CELL);
  }
  // country borders: a darker pixel where the country changes
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let r = 0; r < MAP.ROWS; r++) for (let q = 0; q < MAP.COLS - 1; q++) {
    const a = cellCountry(G0[r * MAP.COLS + q], dn), b = cellCountry(G0[r * MAP.COLS + q + 1], dn);
    if (a !== b && a !== '.' && b !== '.') c.fillRect((q + 1) * MAP.CELL - 1, r * MAP.CELL, 1, MAP.CELL);
  }
  return cv;
}

// ================================================================ data
function roleOf(g) {
  try {
    const p = g.pol();
    const posts = (p && p.me && p.me.posts) || [];
    if (posts.includes('pm')) return { kind: 'pm', label: '内閣総理大臣' };
    if (posts.includes('minister_foreign')) return { kind: 'fm', label: '外務大臣' };
    if (posts.includes('minister_defense')) return { kind: 'dm', label: '防衛大臣' };
    if (p && p.me && (p.me.office === 'shugi' || p.me.office === 'sangi')) return { kind: 'member', label: '国会議員' };
  } catch (e) { /* no politics */ }
  return { kind: 'citizen', label: '市民' };
}
function loadData(ui) {
  const g = ui.g;
  const w = safe(() => g.world(), null);
  if (!w) return { ok: false };
  const rows = {};
  for (const c of [...w.countries, ...(w.fictional || [])]) rows[c.id] = c;
  const d0 = has(g, 'gameDate') ? safe(() => g.gameDate(), null) : null;
  const dn = d0 ? d0.year * 10000 + d0.month * 100 + d0.dom : 20260401;
  const war = has(g, 'war') ? safe(() => g.war(), null) : null;
  return {
    ok: true, w, rows, dn, war, role: roleOf(g),
    orders: has(g, 'warOrders') ? safe(() => g.warOrders(), []) : [],
    paths: has(g, 'warPaths') ? safe(() => g.warPaths(), null) : null,
    life: has(g, 'regimeLifeOver') ? safe(() => g.regimeLifeOver(), null) : null,
    markers: w.countries.filter((c) => c.pos).map((c) => ({ id: c.id, ...project(c.pos[0], c.pos[1]) })),
  };
}

// ================================================================ tabs
// Each tab: { id, label, rows(ui) → [{ key, label, sub?, right?, rightColor?, color?, header?, lock? }], draw(ui, c), act(ui, row) }
const LIST = { x: 4, y: 42, w: 248, h: 292, rh: 18 };
const DETAIL = { x: 256, y: 42, w: 380, h: 292 };
function countryRows(ui) {
  const d = ui.data;
  const real = d.w.countries.slice().sort((a, b) => b.relation - a.relation);
  const out = [{ header: true, label: `国々（${real.length}）` }];
  for (const c of real) out.push({ key: c.id, label: c.name, right: `${c.relation}`, rightColor: relColor(c.relation), sub: c.war ? '戦争中' : !c.ties ? `国交：${c.tiesLabel}` : c.ally ? '同盟・協力' : c.sanction ? `制裁 段階${c.sanction}` : '' });
  if ((d.w.fictional || []).length) { out.push({ header: true, label: 'ヴェルミナ海の国々' }); for (const c of d.w.fictional) out.push({ key: c.id, label: c.name, right: `${c.relation}`, rightColor: relColor(c.relation), sub: c.war ? '戦争中' : '' }); }
  return out;
}
const TAB_MAP = {
  id: 'map', label: '地図',
  rows: () => [],
  draw(ui, c) {
    const d = ui.data;
    if (!ui.mapCv || ui.mapKey !== ui.mapStamp()) { ui.mapCv = bakeMap(ui); ui.mapKey = ui.mapStamp(); }
    c.drawImage(ui.mapCv, MAP.X, MAP.Y);
    R(c, MAP.X, MAP.Y + MAP.ROWS * MAP.CELL, MAP.COLS * MAP.CELL, 1, K.edge);
    // territorial disputes (small diamonds)
    for (const D of d.w.disputes) { const p = project(D.pos[0], D.pos[1]); R(c, p.x - 1, p.y - 3, 2, 6, K.warn); R(c, p.x - 3, p.y - 1, 6, 2, K.warn); }
    // conflicts: a line between the capitals, blinking
    for (const k of d.w.conflicts) if (k.posA && k.posB) { const a = project(k.posA[0], k.posA[1]), b = project(k.posB[0], k.posB[1]); if (Math.floor(ui.t / 15) % 2) dotLine(c, a, b, K.bad); }
    // capitals
    for (const m of d.markers) { const row = d.rows[m.id]; R(c, m.x - 1, m.y - 1, 3, 3, row && row.war ? K.bad : '#f2f2f2'); }
    const jp = project(35.68, 139.69); R(c, jp.x - 2, jp.y - 2, 5, 5, '#e8343c'); R(c, jp.x - 1, jp.y - 1, 3, 3, '#ffffff');
    // crises: blinking triangles
    for (const k of d.w.crises) if (k.pos) { const p = project(k.pos[0], k.pos[1]); if (Math.floor(ui.t / 12) % 2) { R(c, p.x + 3, p.y - 8, 1, 1, K.warn); R(c, p.x + 2, p.y - 7, 3, 1, K.warn); R(c, p.x + 1, p.y - 6, 5, 1, K.warn); R(c, p.x, p.y - 5, 7, 1, K.warn); } }
    // the war of Japan: the enemy marker with a ring
    if (d.war && d.rows[d.war.enemy] && d.rows[d.war.enemy].pos) { const p = project(d.rows[d.war.enemy].pos[0], d.rows[d.war.enemy].pos[1]); const r0 = 5 + (ui.t >> 3) % 4; ring(c, p.x, p.y, r0, K.bad); }
    // the selection
    const sel = ui.sel && d.rows[ui.sel];
    if (sel && sel.pos) { const p = project(sel.pos[0], sel.pos[1]); ring(c, p.x, p.y, 6 + ((ui.t >> 4) % 2), K.amber); const lab = sel.short; const lw = measure(c, lab, 10) + 6; const lx = clamp(p.x + 8, MAP.X + 2, MAP.X + MAP.COLS * MAP.CELL - lw - 2); R(c, lx, p.y - 7, lw, 13, 'rgba(0,0,0,0.75)'); T(c, lab, lx + 3, p.y - 6, 10, K.amber); }
    // the inset: the fictional nations of ヴェルミナ海
    const fx = INSET.x, fy = INSET.y;
    R(c, fx, fy, INSET.w, 58, 'rgba(6,14,26,0.88)'); R(c, fx, fy, INSET.w, 1, K.edge);
    T(c, 'ヴェルミナ海', fx + 4, fy + 2, 10, K.dim);
    (d.w.fictional || []).forEach((f, i) => { const sy = fy + 16 + i * 13; R(c, fx + 6, sy + 2, 8, 8, relColor(f.relation)); if (f.war && Math.floor(ui.t / 15) % 2) R(c, fx + 6, sy + 2, 8, 8, K.bad); T(c, f.short, fx + 18, sy, 10, ui.sel === f.id ? K.amber : K.text, 'left', INSET.w - 46); T(c, `${f.relation}`, fx + INSET.w - 6, sy, 10, relColor(f.relation), 'right'); if (ui.sel === f.id) R(c, fx + 2, sy + 4, 2, 4, K.amber); });
    // the colour chips (top right)
    ui.chips = [];
    MODES.forEach((m, i) => { const w = 40, x = MAP.X + MAP.COLS * MAP.CELL - 4 - (MODES.length - i) * (w + 3), y = MAP.Y + 3; const on = ui.mode === m.id; R(c, x, y, w, 15, on ? K.amber : 'rgba(10,20,34,0.85)'); T(c, m.label, x + w / 2, y + 2, 10, on ? '#1a1206' : K.text, 'center'); ui.chips.push({ x, y, w, h: 15, id: m.id }); });
    // the legend
    const lx0 = MAP.X + 130, ly0 = MAP.Y + MAP.ROWS * MAP.CELL - 14;
    const leg = ui.mode === 'bloc' ? Object.values(d.w.blocs).map((b) => [b.color, b.short]) : ui.mode === 'alliance' ? [['#4f8fe8', '同盟・協力'], ['#c07040', '日本が制裁'], ['#a05050', '日本に制裁'], ['#5a6270', 'その他']] : [['#3aa86a', '良好'], ['#7cbc62', 'まずまず'], ['#c4b46a', 'ふつう'], ['#d07a46', '冷えこみ'], ['#c63c3c', '険悪']];
    R(c, lx0 - 4, ly0 - 2, leg.length * 62 + 4, 14, 'rgba(6,14,26,0.8)');
    leg.forEach(([col, lab], i) => { R(c, lx0 + i * 62, ly0 + 2, 8, 8, col); T(c, lab, lx0 + i * 62 + 11, ly0, 10, K.text, 'left', 50); });
    // the info panel
    drawCountryStrip(ui, c, 4, 258, 632, 76);
  },
};
const INSET = { x: MAP.X + 4, y: MAP.Y + 146, w: 100 };
const insetPts = (fl) => (fl || []).map((f, i) => ({ id: f.id, x: INSET.x + 10, y: INSET.y + 22 + i * 13 }));
function dotLine(c, a, b, col) { const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4)); for (let i = 0; i <= n; i++) R(c, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 2, 2, col); }
function ring(c, x, y, r, col) { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; R(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 1, 1, col); } }
function drawCountryStrip(ui, c, x, y, w, h) {
  const d = ui.data;
  const row = ui.sel && d.rows[ui.sel];
  panel(c, x, y, w, h, row ? row.name : '国を選ぶ', { right: 'A：外交・くわしく' });
  if (!row) return;
  const det = ui.detail(ui.sel);
  T(c, det ? det.leader : '', x + 8, y + 20, 12, K.text, 'left', 200);
  T(c, `陣営：${row.blocName}`, x + 8, y + 36, 10, (d.w.blocs[row.bloc] || {}).color || K.dim, 'left', 200);
  T(c, `国交：${row.tiesLabel}${row.sanction ? `・日本の制裁 段階${row.sanction}` : ''}${row.onJapan ? `・日本への制裁 段階${row.onJapan}` : ''}`, x + 8, y + 52, 10, K.dim, 'left', 220);
  T(c, `日本との関係 ${row.relation}（${row.relLabel}）`, x + 236, y + 20, 12, relColor(row.relation), 'left', 180);
  gauge(c, x + 236, y + 38, 170, row.relation);
  if (row.real) T(c, `貿易の割合 約${row.trade}%・軍事力 ${row.mil}`, x + 236, y + 52, 10, K.dim, 'left', 180);
  const note = det && (det.conflicts && det.conflicts.length ? `【紛争】${det.conflicts.join('・')}` : det.note) || '';
  para(c, note, x + 420, y + 20, w - 428, 10, K.text, 13, 4);
}
const TAB_COUNTRIES = {
  id: 'countries', label: '国々',
  rows: (ui) => countryRows(ui),
  draw(ui, c) {
    drawList(ui, c, LIST);
    const row = ui.curRow();
    const det = row && row.key ? ui.detail(row.key) : null;
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, det ? det.name : '', { right: 'A：外交の手段' });
    if (!det) return;
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 20;
    T(c, `${det.leader}・${det.gov || ''}`, x, y, 10, K.dim, 'left', DETAIL.w - 16); y += 14;
    T(c, `日本との関係 ${det.relation}（${det.relLabel}）`, x, y, 12, relColor(det.relation), 'left', 180); gauge(c, x + 190, y + 4, 170, det.relation); y += 18;
    T(c, `陣営：${det.blocName}　国交：${det.tiesLabel}`, x, y, 10, K.text, 'left', DETAIL.w - 16); y += 14;
    if (det.real) { T(c, `GDP 約${det.gdp}兆ドル（目安）・軍事力 ${det.mil}・日本の貿易の約${det.trade}%`, x, y, 10, K.text, 'left', DETAIL.w - 16); y += 14; }
    if (det.member && det.member.length) { T(c, `加盟：${det.member.join('・')}`, x, y, 10, K.text, 'left', DETAIL.w - 16); y += 14; }
    if (det.nuclear) { T(c, det.nuclear, x, y, 10, K.dim, 'left', DETAIL.w - 16); y += 14; }
    if (det.alliances && det.alliances.length) { T(c, `同盟・協力：${det.alliances.join('・')}`, x, y, 10, K.cyan, 'left', DETAIL.w - 16); y += 14; }
    if (det.treaties && det.treaties.length) { y += para(c, `日本との条約・協定：${det.treaties.join('、')}`, x, y, DETAIL.w - 16, 10, K.text, 13, 3); }
    if (det.conflicts && det.conflicts.length) { T(c, `紛争：${det.conflicts.join('・')}`, x, y, 10, K.bad, 'left', DETAIL.w - 16); y += 14; }
    y += 2;
    y += para(c, det.note || '', x, y, DETAIL.w - 16, 10, K.text, 13, 4);
    if (det.dispute) { R(c, x, y + 2, DETAIL.w - 16, 1, K.edge); y += 6; T(c, `【${det.dispute.name}】`, x, y, 10, K.warn); y += 13; para(c, det.dispute.lines.join(''), x, y, DETAIL.w - 16, 10, K.text, 13, Math.max(1, Math.floor((DETAIL.y + DETAIL.h - 4 - y) / 13))); }
  },
  act: (ui, row) => (row && row.key ? actionsMenu(ui, row.key) : null),
};
const GLOBAL_DIPLO = ['ally_up', 'ally_down', 'withdraw_notice', 'abrogate', 'peace_conf', 'un_speech', 'unsc_run', 'leave_un', 'rejoin_un'];
const TAB_DIPLOMACY = {
  id: 'diplomacy', label: '外交',
  rows(ui) {
    const g = ui.g;
    const out = [{ header: true, label: `${ui.data.role.label}としてできること` }];
    out.push({ key: 'pick', label: '相手の国を選んで外交する', sub: '首脳会談・外遊・条約・制裁・援助…', right: '▶' });
    out.push({ key: 'declare', label: '宣戦布告（相手を選ぶ）', sub: '戦争への道と見込み', right: '▶', color: K.danger });
    for (const id of GLOBAL_DIPLO) {
      const pv = has(g, 'diplomacyPreview') ? safe(() => g.diplomacyPreview(id, null), null) : null;
      if (!pv) continue;
      out.push({ key: 'g:' + id, label: pv.name, lock: pv.why, right: pv.why ? '🔒' : pv.odds != null ? `${Math.round(pv.odds * 100)}%` : '○', sub: pv.why ? pv.why : pv.lines[0] || '', pv });
    }
    for (const o of ui.data.w.offers || []) out.push({ key: 'o:' + o.treaty, label: `交渉が妥結：${o.name}`, sub: '署名する／見送る', right: '!', rightColor: K.warn });
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const row = ui.curRow();
    const d = ui.data;
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, row && row.pv ? row.label : '外交の概況');
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 20;
    if (row && row.pv) {
      y += para(c, row.pv.desc, x, y, DETAIL.w - 16, 12, K.text, 16, 3) + 4;
      for (const l of row.pv.lines) y += para(c, `・${l}`, x, y, DETAIL.w - 16, 10, K.text, 13, 3);
      if (row.pv.odds != null) { T(c, `成功の見込み ${Math.round(row.pv.odds * 100)}%`, x, y + 4, 12, K.amber); y += 20; }
      if (row.lock) para(c, `🔒 ${row.lock}`, x, y + 4, DETAIL.w - 16, 10, K.lock, 13, 6);
      return;
    }
    // the overview
    const w = d.w;
    T(c, `国際的な信頼 ${w.standing}／100　世界の緊張 ${w.tension}（${w.tensionLabel}）`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 18;
    T(c, `原油価格（指数）${w.oil}　日本への脅威 ${w.threat}／100`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 18;
    T(c, `安保理：${w.unsc.member ? '非常任理事国（任期中）' : w.unsc.candidate ? '立候補中' : '理事国ではない'}　${w.unsc.member ? '' : w.unsc.nextText}`, x, y, 10, K.dim, 'left', DETAIL.w - 16); y += 16;
    T(c, '次の首脳会議', x, y, 10, K.amber); y += 14;
    for (const s0 of w.summits.slice(0, 4)) { T(c, `${s0.year}年${s0.month}月　${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`, x + 6, y, 10, K.text, 'left', DETAIL.w - 22); y += 13; }
    y += 4;
    T(c, '最近の共同声明', x, y, 10, K.amber); y += 14;
    for (const st of w.statements.slice(0, 3)) { T(c, `${st.withName}「${st.label}」`, x + 6, y, 10, K.text, 'left', DETAIL.w - 22); y += 13; }
    if (!w.statements.length) { T(c, 'まだない', x + 6, y, 10, K.faint); y += 13; }
    y += 4;
    para(c, d.role.kind === 'pm' ? '総理はすべての外交の手段を使える。首脳会談は相手国の首脳と、外遊は相手国を訪ねて。成功の見込みは関係・国際的な信頼・制裁で変わる。' : d.role.kind === 'fm' ? '外務大臣は外相会談・外遊・経済連携・援助・抗議・大使の召還などを担う。首脳会談・制裁・同盟・戦争は総理が決める。' : d.role.kind === 'dm' ? '防衛大臣は防衛協力の協定、後方支援、在外邦人の退避、同盟の強化を担う。' : '外交は総理・外務大臣・防衛大臣が行う。いまは見ることだけができる（危機の募金はだれでもできる）。', x, y, DETAIL.w - 16, 10, K.dim, 13, 5);
  },
  async act(ui, row) {
    if (!row) return;
    if (row.key === 'pick') { const id = await pickCountry(ui, '外交の相手'); if (id) await actionsMenu(ui, id); return; }
    if (row.key === 'declare') { await declareFlow(ui); return; }
    if (row.key.startsWith('g:')) { await diploFlow(ui, row.key.slice(2), null); return; }
    if (row.key.startsWith('o:')) { const t = row.key.slice(2); const k = await ui.confirm({ title: '交渉の妥結', lines: [`${row.label.replace('交渉が妥結：', '')}に署名し、国会の承認を求める？`], choices: ['署名する', '見送る', 'あとで'] }); if (k === 0 || k === 1) await ui.info('協定', [safe(() => ui.g.worldOffer(t, k === 0), '') || '']); }
  },
};
const TAB_ALLIANCES = {
  id: 'alliances', label: '同盟・条約',
  rows(ui) {
    const w = ui.data.w;
    const out = [{ header: true, label: '日本の同盟・安全保障の協力' }];
    for (const a of w.alliances.filter((x) => x.japan)) out.push({ key: 'a:' + a.id, label: a.name, right: a.strength != null ? `${a.strength}` : '', sub: a.notice ? '終了を通告中' : { defense: '相互防衛', partnership: '協力の枠組み', collective: '集団防衛' }[a.kind] || '', a });
    out.push({ header: true, label: '日本の条約・協定' });
    for (const t of w.treaties) out.push({ key: 't:' + t.id, label: t.name, sub: { ties: '国交', peace: '平和条約', fta: '経済連携', security: '安全保障', declaration: '宣言', alliance: '同盟' }[t.kind] || '', t });
    out.push({ header: true, label: '制裁' });
    for (const x of w.sanctions.byJapan) out.push({ key: 's:' + x.id, label: `日本 → ${x.name}`, right: `段階${x.level}`, rightColor: K.warn, sub: x.g7 ? 'G7と協調' : x.un ? '国連の制裁に参加' : '日本の判断' });
    for (const x of w.sanctions.onJapan) out.push({ key: 'r:' + x.id, label: `${x.name} → 日本`, right: `段階${x.level}`, rightColor: K.bad, sub: x.war ? '戦争への制裁' : '対抗措置' });
    if (!w.sanctions.byJapan.length && !w.sanctions.onJapan.length) out.push({ key: 'none', label: '（いまはない）' });
    out.push({ header: true, label: '世界の同盟' });
    for (const a of w.alliances.filter((x) => !x.japan)) out.push({ key: 'w:' + a.id, label: a.name, sub: (a.members || []).length + 'か国', a });
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const row = ui.curRow();
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, row && !row.header ? row.label : '同盟・条約', { right: row && row.a && row.a.id === 'anpo' ? 'A：強化・見直し・破棄' : '' });
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 22;
    const names = (ids) => (ids || []).map((id) => (id === 'jp' ? '日本' : (ui.data.rows[id] || {}).short || id)).join('・');
    if (row && row.a) {
      const a = row.a;
      T(c, `加盟：${names(a.members)}`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 18;
      if (a.strength != null) { T(c, `同盟の強さ ${a.strength}／100`, x, y, 12, K.cyan); R(c, x + 130, y + 4, 200, 6, '#1a2a3a'); R(c, x + 130, y + 4, 2 * a.strength, 6, K.cyan); y += 18; }
      if (a.notice) { T(c, '終了を通告中（通告から1年で終了）', x, y, 12, K.bad); y += 18; }
      para(c, a.desc || '', x, y, DETAIL.w - 16, 12, K.text, 16, 8);
    } else if (row && row.t) {
      T(c, `相手：${names(row.t.with)}`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 18;
      T(c, row.t.by === 'history' ? 'ゲームの始まる前から結ばれている' : row.t.by === 'npc' ? '政府が結んだ' : row.t.since > 0 ? `${row.t.since}日目に結んだ` : '', x, y, 10, K.dim, 'left', DETAIL.w - 16);
    } else para(c, '日米安保条約は、総理（防衛大臣）が強化・見直しでき、総理は破棄（終了の通告）もできる。同盟は戦争のとき援軍になる一方、相手の戦争に巻きこまれることもある。', x, y, DETAIL.w - 16, 12, K.dim, 16, 8);
  },
  async act(ui, row) {
    if (!row) return;
    if (row.a && row.a.id === 'anpo') { const k = await ui.pick({ title: '日米安保条約', items: ['ally_up', 'ally_down', 'abrogate', 'withdraw_notice'].map((id) => { const pv = safe(() => ui.g.diplomacyPreview(id, null, id === 'abrogate' ? { treaty: 'anpo' } : {}), null) || { name: id }; return { label: pv.name, sub: pv.why || (pv.lines || [])[0] || '', lock: pv.why, id }; }) }); if (k == null || k < 0) return; const id = ['ally_up', 'ally_down', 'abrogate', 'withdraw_notice'][k]; await diploFlow(ui, id, null, id === 'abrogate' ? { treaty: 'anpo' } : {}); return; }
    if (row.t && ['fta', 'security', 'alliance', 'peace'].includes(row.t.kind)) { await diploFlow(ui, 'abrogate', null, { treaty: row.t.id }); return; }
    if (row.key.startsWith('s:')) { await diploFlow(ui, 'lift', row.key.slice(2)); }
  },
};
const TAB_CRISIS = {
  id: 'crisis', label: '危機・戦争',
  rows(ui) {
    const d = ui.data;
    const out = [];
    if (d.war) {
      out.push({ header: true, label: `戦争：${d.war.enemyShort}（${d.war.modeName}）` });
      for (const o of d.orders) out.push({ key: 'w:' + o.id, label: o.name, lock: o.why, right: o.why ? '🔒' : '▶', sub: o.why || '', order: o, color: ['declare', 'surrender'].includes(o.id) ? K.danger : null });
    } else {
      out.push({ header: true, label: '戦争への道' });
      out.push({ key: 'declare', label: '宣戦布告（相手を選ぶ）', right: '▶', color: K.danger, sub: d.paths && d.paths.declare ? '条件と道を見る' : '' });
      out.push({ key: 'steps', label: '体制・憲法の手続き', right: '▶', sub: '9条の改正・緊急事態など' });
      for (const o of d.orders.filter((x) => x.id === 'front_go' || x.id === 'front_return')) out.push({ key: 'w:' + o.id, label: o.name, lock: o.why, right: o.why ? '🔒' : '▶', order: o });
    }
    out.push({ header: true, label: `世界の危機（${d.w.crises.length}）` });
    for (const k of d.w.crises) out.push({ key: 'k:' + k.id, label: k.title, sub: k.countryName || '', right: '▶', k });
    if (!d.w.crises.length) out.push({ key: 'none', label: '（いまは大きな危機はない）' });
    out.push({ header: true, label: `各地の紛争（${d.w.conflicts.length}）` });
    for (const k of d.w.conflicts) out.push({ key: 'c:' + k.id, label: k.name, sub: k.japan ? '日本が関わっている' : '', right: '▶', conflict: k });
    if (!d.w.conflicts.length) out.push({ key: 'none2', label: '（いまはない）' });
    if (d.w.deployments.length) { out.push({ header: true, label: '自衛隊の海外派遣' }); for (const x of d.w.deployments) out.push({ key: 'd:' + x.id, label: x.mission, sub: x.where }); }
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const d = ui.data;
    const row = ui.curRow();
    if (d.war) { drawWar(ui, c, row); return; }
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, row && !row.header ? row.label : '危機・戦争');
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 22;
    if (row && row.k) {
      const k = row.k;
      T(c, `${k.countryName}・深刻さ ${'●'.repeat(clamp(num(k.sev, 1), 1, 3))}`, x, y, 12, K.warn, 'left', DETAIL.w - 16); y += 18;
      para(c, 'A：対応を選ぶ（退避・援助・抗議・安保理への提起・備蓄の放出・国際協調・募金など、いまの立場でできること）', x, y, DETAIL.w - 16, 10, K.dim, 13, 4);
    } else if (row && row.conflict) {
      const k = row.conflict;
      T(c, `${k.aName} 対 ${k.bName}`, x, y, 12, K.bad); y += 18;
      T(c, `死者（推計）${n0(k.dead)}人`, x, y, 12, K.text); y += 18;
      para(c, 'A：仲介・後方支援・集団的自衛権での参戦・派兵（どちらの側に立つか）。どれも見込みと結果を確かめてから決める。', x, y, DETAIL.w - 16, 10, K.dim, 13, 5);
    } else if (d.paths) {
      const P = d.paths;
      y += para(c, P.declare ? `宣戦：${P.declare}` : '宣戦できる状態（相手を選ぶ）。', x, y, DETAIL.w - 16, 10, P.declare ? K.lock : K.good, 13, 9) + 4;
      if (P.art9) { T(c, '9条は改正ずみ：国会の承認で宣戦できる', x, y, 10, K.good, 'left', DETAIL.w - 16); y += 14; }
      if (P.amend9 && P.amend9.stage === 'referendum') { T(c, `9条の改正：国民投票を待っている（見込み 賛成${P.referendum9.yes}%）`, x, y, 10, K.warn, 'left', DETAIL.w - 16); y += 14; }
      if (P.collective) { T(c, `集団的自衛権の根拠：${P.collective}`, x, y, 10, K.cyan, 'left', DETAIL.w - 16); y += 14; }
      if (P.attack) { T(c, '武力攻撃事態：防衛出動を命じられる', x, y, 10, K.bad, 'left', DETAIL.w - 16); y += 14; }
      if (P.breakaway) { y += para(c, `（${P.breakaway}。実在の政党は戦争を決めない：進めると、党を離れて新党を結成する場面になる）`, x, y, DETAIL.w - 16, 10, K.dim, 13, 3); }
      T(c, `国会が宣戦を承認する見込み（改正後）：${Math.round(num(P.dietOdds) * 100)}%`, x, y + 4, 10, K.dim, 'left', DETAIL.w - 16);
    }
  },
  async act(ui, row) {
    if (!row) return;
    if (row.key === 'declare') { await declareFlow(ui); return; }
    if (row.key === 'steps') { await stepsFlow(ui); return; }
    if (row.key.startsWith('w:')) { await warFlow(ui, row.order); return; }
    if (row.key.startsWith('k:')) { await actionsMenu(ui, 'k:' + row.k.id, row.k.title); return; }
    if (row.key.startsWith('c:')) { await actionsMenu(ui, 'c:' + row.conflict.id, row.conflict.name); }
  },
};
function drawWar(ui, c, row) {
  const w = ui.data.war;
  const x0 = DETAIL.x, y0 = DETAIL.y;
  panel(c, x0, y0, DETAIL.w, 128, `${w.enemyName}との戦争（${ui.g.state.day - w.start}日目）`, { accent: K.danger, right: w.frontText });
  w.fronts.forEach((f, i) => {
    const y = y0 + 20 + i * 18;
    T(c, f.name, x0 + 6, y, 10, K.text, 'left', 130);
    const bx = x0 + 140, bw = 120;
    R(c, bx, y + 3, bw, 6, '#1a2a3a'); R(c, bx + bw / 2, y + 1, 1, 10, K.dim);
    const p = bx + bw / 2 + (clamp(f.control, -100, 100) / 100) * (bw / 2);
    R(c, Math.min(p, bx + bw / 2), y + 3, Math.abs(p - (bx + bw / 2)), 6, f.control >= 0 ? K.cyan : K.bad);
    T(c, `兵力 ${troops(f.own)}`, x0 + 268, y, 10, K.dim, 'left', 80);
    T(c, `${f.odds}%`, x0 + DETAIL.w - 8, y, 10, f.odds >= 50 ? K.good : K.warn, 'right');
  });
  let y = y0 + 22 + w.fronts.length * 18;
  T(c, `死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人　相手側 ${n0(w.cas.enemySoldiers + w.cas.enemyCivilians)}人`, x0 + 6, y, 10, K.text, 'left', DETAIL.w - 12); y += 13;
  T(c, `予備 ${troops(w.reserve)}・動員 段階${w.mob}・厭戦 ${Math.round(w.weariness)}・戦費 約${w.cost}兆円`, x0 + 6, y, 10, K.dim, 'left', DETAIL.w - 12); y += 13;
  T(c, `${w.allies.length ? `味方：${w.allies.map((a) => a.name).join('・')}　` : ''}${w.foes.length ? `相手側：${w.foes.map((a) => a.name).join('・')}` : ''}` || '同盟国の参戦はない', x0 + 6, y, 10, K.cyan, 'left', DETAIL.w - 12);
  // the people the player knows / the player
  const y2 = y0 + 132;
  panel(c, x0, y2, DETAIL.w, 74, '知っている人・自分', { right: w.player ? `前線（1日の危険 約${w.player.risk}%）` : '' });
  const ST = { front: '前線', called: '召集', wounded: '負傷', kia: '戦死', exempt: '免除', back: '帰還' };
  (w.known || []).slice(0, 4).forEach((k, i) => { T(c, `${k.rel}の${k.name}（${k.unit}）`, x0 + 6, y2 + 19 + i * 13, 10, k.status === 'kia' ? K.bad : K.text, 'left', 250); T(c, ST[k.status] || k.status, x0 + DETAIL.w - 8, y2 + 19 + i * 13, 10, k.status === 'kia' ? K.bad : K.dim, 'right'); });
  if (!(w.known || []).length) T(c, '（いない）', x0 + 6, y2 + 19, 10, K.faint);
  // the selected order
  const y3 = y2 + 78;
  panel(c, x0, y3, DETAIL.w, DETAIL.y + DETAIL.h - y3, row && row.order ? row.order.name : '戦況の記録');
  if (row && row.order) para(c, row.order.why ? `🔒 ${row.order.why}` : row.order.desc, x0 + 6, y3 + 19, DETAIL.w - 12, 10, row.order.why ? K.lock : K.text, 13, 5);
  else (w.log || []).slice(-5).reverse().forEach((l, i) => T(c, `・${l.text}`, x0 + 6, y3 + 19 + i * 13, 10, K.dim, 'left', DETAIL.w - 12));
}
const TAB_NEWS = {
  id: 'news', label: 'ニュース',
  rows(ui) {
    const w = ui.data.w;
    const out = [{ header: true, label: '世界のニュース' }];
    for (const n of w.news.slice(0, 30)) out.push({ key: 'n' + out.length, label: n.text, sub: `${n.day}日目`, news: n });
    if (!w.news.length) out.push({ key: 'none', label: '（まだニュースはない）' });
    out.push({ header: true, label: '首脳会議の予定' });
    for (const s0 of w.summits) out.push({ key: 's' + out.length, label: `${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`, sub: `${s0.year}/${s0.month}` });
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, { ...LIST, w: 632 }, true);
  },
  act: (ui, row) => (row && row.news ? ui.info('ニュース', [row.news.text]) : null),
};
const TABS = [TAB_MAP, TAB_COUNTRIES, TAB_DIPLOMACY, TAB_ALLIANCES, TAB_CRISIS, TAB_NEWS];
const tabIndex = (t) => { if (typeof t === 'number') return clamp(t, 0, TABS.length - 1); const i = TABS.findIndex((x) => x.id === t); return i < 0 ? 0 : i; };

// ================================================================ lists
function drawList(ui, c, L, wide = false) {
  const rows = ui.rows();
  const st = ui.ls();
  const n = Math.max(1, Math.floor((L.h - 4) / L.rh));
  st.top = clamp(st.top || 0, 0, Math.max(0, rows.length - n));
  if (st.i < st.top) st.top = st.i;
  if (st.i >= st.top + n) st.top = st.i - n + 1;
  R(c, L.x, L.y, L.w, L.h, K.panel);
  R(c, L.x, L.y, L.w, 1, K.edge); R(c, L.x, L.y + L.h - 1, L.w, 1, K.edge);
  ui.listRect = { ...L, n };
  for (let k = 0; k < n && st.top + k < rows.length; k++) {
    const r = rows[st.top + k];
    const y = L.y + 2 + k * L.rh;
    const sel = st.top + k === st.i && ui.focus === 'body';
    if (r.header) { R(c, L.x + 1, y, L.w - 2, L.rh - 1, '#0a1626'); T(c, r.label, L.x + 6, y + 3, 10, K.amber, 'left', L.w - 12); continue; }
    if (sel) R(c, L.x + 1, y, L.w - 2, L.rh - 1, K.sel);
    if (sel) R(c, L.x + 1, y, 2, L.rh - 1, K.amber);
    const rw = r.right ? measure(c, r.right, 10) + 10 : 0;
    if (wide && r.sub) { T(c, r.sub, L.x + 8, y + 3, 10, K.faint, 'left', 60); T(c, r.label, L.x + 70, y + 3, 10, K.text, 'left', L.w - 80); continue; }
    T(c, r.label, L.x + 8, y + 3, 12, r.lock ? K.faint : r.color || K.text, 'left', L.w - 16 - rw);
    if (r.right) T(c, r.right, L.x + L.w - 6, y + 4, 10, r.rightColor || (r.lock ? K.lock : K.dim), 'right');
  }
  if (rows.length > n) { const h = Math.max(10, (L.h * n) / rows.length); R(c, L.x + L.w - 3, L.y + ((L.h - h) * st.top) / Math.max(1, rows.length - n), 2, h, K.edgeHi); }
  // the selected row's sub line at the bottom of the list (when it does not fit in the row)
}

// ================================================================ flows (modals: confirm / pick / info)
const OPT_KEY = { summit: 'topic', visit: 'topic', fm_talks: 'topic', statement: 'kind', sanction: 'level', aid: 'level', peace_treaty: 'terms', abrogate: 'treaty', peace_conf: 'terms', dispatch: 'side' };
async function diploFlow(ui, kind, target, opts0 = {}) {
  const g = ui.g;
  let pv = safe(() => g.diplomacyPreview(kind, target, opts0), null);
  if (!pv) return;
  if (pv.why) { await whyInfo(ui, pv.name, pv.why, kind, target); return; }
  let opts = { ...opts0 };
  if (pv.options && pv.options.length && OPT_KEY[kind] && opts[OPT_KEY[kind]] == null) {
    const k = await ui.pick({ title: pv.name, lines: [pv.desc], items: pv.options.map((o) => ({ label: o.label, sub: o.sub })) });
    if (k == null || k < 0) return;
    opts[OPT_KEY[kind]] = pv.options[k].id;
    pv = safe(() => g.diplomacyPreview(kind, target, opts), pv);
    if (pv.why) { await whyInfo(ui, pv.name, pv.why, kind, target); return; }
  }
  const danger = ['declare', 'collective', 'dispatch', 'cut_ties', 'leave_un', 'abrogate'].includes(kind);
  const lines = [pv.desc, ...pv.lines.map((l) => `・${l}`), pv.odds != null ? `【成功の見込み】${Math.round(pv.odds * 100)}%` : null].filter(Boolean);
  const k = await ui.confirm({ title: `${danger ? '⚠ ' : ''}${pv.name}${target && ui.data.rows[target] ? `（${ui.data.rows[target].short}）` : ''}`, lines, choices: ['実行する', 'やめる'], danger });
  if (k !== 0) return;
  const res = safe(() => g.diplomacy(kind, target, opts), { ok: false, why: 'うまくいかなかった' });
  await ui.result(pv.name, res);
}
async function whyInfo(ui, title, why, kind, target) {
  // the path, not a dead end: the war's routes lead to their first step
  if (kind === 'declare' || /9条|交戦権|国軍/.test(String(why))) {
    const k = await ui.pick({ title: `${title}：いまの状態`, lines: [why], items: [{ label: '体制・憲法の手続きを見る', sub: '9条の改正・緊急事態・国軍化などの見込み' }, { label: 'もどる' }] });
    if (k === 0) await stepsFlow(ui);
    return;
  }
  await ui.info(title, ['いまはできない：', why]);
}
async function actionsMenu(ui, target, title = null) {
  const g = ui.g;
  for (let guard = 0; guard < 30 && !ui.closed; guard++) {
    const list = safe(() => g.diplomacyActions(target), []) || [];
    if (!list.length) { await ui.info(title || '外交', ['この相手に使える手段はない。']); return; }
    const nm = title || (ui.data.rows[target] || {}).name || '';
    const k = await ui.pick({ title: `${nm}：外交の手段`, items: list.map((a) => ({ label: a.name, sub: a.why ? `🔒 ${a.why}` : a.lines[0] || a.desc, right: a.why ? '🔒' : a.odds != null ? `${Math.round(a.odds * 100)}%` : '○', lock: a.why })), w: 520 });
    if (k == null || k < 0) return;
    const a = list[k];
    await diploFlow(ui, a.id, target);
    ui.dirty();
  }
}
async function pickCountry(ui, title, opts = {}) {
  const d = ui.data;
  const ids = [...d.w.countries.map((c) => c.id), ...(opts.fictional ? (d.w.fictional || []).map((c) => c.id) : [])];
  const k = await ui.pick({ title, items: ids.map((id) => { const r = d.rows[id]; return { label: r.name, sub: `関係 ${r.relation}・${r.blocName}${r.war ? '・戦争中' : ''}`, right: `${r.relation}`, rightColor: relColor(r.relation) }; }), w: 480 });
  return k == null || k < 0 ? null : ids[k];
}
async function declareFlow(ui) {
  const id = await pickCountry(ui, '宣戦の相手', { fictional: true });
  if (!id) return;
  const g = ui.g;
  const pv = safe(() => g.diplomacyPreview('declare', id), null);
  if (!pv) return;
  if (pv.why) { await whyInfo(ui, '宣戦布告', pv.why, 'declare', id); return; }
  const k = await ui.confirm({ title: `⚠ 宣戦布告（${ui.data.rows[id].short}）`, danger: true, lines: [pv.desc, ...pv.lines.map((l) => `・${l}`)], choices: ['やめておく', '理解したうえで宣戦する'], index: 0 });
  if (k !== 1) return;
  const k2 = await ui.confirm({ title: '最後の確認', danger: true, lines: ['本当に宣戦しますか？　多くの人の命とくらしが失われます。'], choices: ['やめておく', '宣戦する'], index: 0 });
  if (k2 !== 1) return;
  await ui.result('宣戦布告', safe(() => g.diplomacy('declare', id), null));
}
async function stepsFlow(ui) {
  const g = ui.g;
  if (!has(g, 'regimeSteps')) { await ui.info('体制', ['体制の仕組みが読み込まれていない']); return; }
  for (let guard = 0; guard < 10 && !ui.closed; guard++) {
    const steps = safe(() => g.regimeSteps(), []) || [];
    const k = await ui.pick({ title: '体制・憲法の手続き', items: steps.map((s0) => ({ label: s0.name, sub: s0.why ? `🔒 ${s0.why}` : s0.breakaway ? `進めると：${s0.breakaway}` : s0.desc, right: s0.why ? '🔒' : s0.odds != null ? `${Math.round(s0.odds * 100)}%` : '○', lock: s0.why })), w: 560 });
    if (k == null || k < 0) return;
    const s0 = steps[k];
    if (s0.why) { await ui.info(s0.name, [s0.desc, '', `いまはできない：${s0.why}`]); continue; }
    const c = await ui.confirm({ title: `${s0.auth || s0.war ? '⚠ ' : ''}${s0.name}`, danger: s0.auth || s0.war, lines: [s0.desc, s0.odds != null ? `【成功の見込み】${Math.round(s0.odds * 100)}%` : null, s0.breakaway ? `【党】${s0.breakaway}。党を離れて新党を結成してから進める。` : null, s0.auth ? '【結果】支持率・国際社会の評価・民衆の不満に重い影響がある。' : null].filter(Boolean), choices: ['やめておく', '進める'], index: 0 });
    if (c !== 1) continue;
    await ui.result(s0.name, safe(() => g.regimeStep(s0.id), null));
  }
}
const WAR_CONSEQ = {
  mobilize: '兵力が増える。暮らしと経済への負担が大きく、不満が高まる。独裁体制では、友だちや家族も召集される。',
  deploy: '予備の部隊を前線に送る。その前線で勝ちやすくなる。',
  battle: '勝てば前線が進み、負ければ押し戻される。どちらでも両国の兵士と民間人の命が失われる。',
  offensive: '戦況は動くが、毎日の死傷が増える。',
  defend: '死傷は減るが、戦況は動きにくい。',
  negotiate: '第三国を通じて停戦を探る（4〜8日）。停戦すると講和の交渉に入れる。',
  withdraw: '同盟国の戦争から手を引く。同盟国は失望する。',
  surrender: '戦争は終わるが、重い代償を払う（独裁体制は崩れ、民主制なら内閣は総辞職し、係争地を失う）。',
  front_visit: '前線の部隊を励ます。危険は小さいがゼロではない。',
  front_go: '自分も前線に立つ。毎日、戦死する危険がある。戦死すれば、この人生は終わる（セーブデータは前のまま）。',
  front_return: '前線を離れる。任務の途中なら、脱走と見なされることもある。',
};
async function warFlow(ui, o) {
  if (!o) return;
  const g = ui.g;
  if (o.why) { await ui.info(o.name, ['いまはできない：', o.why]); return; }
  if (o.id === 'declare') { await declareFlow(ui); return; }
  let opts = {};
  if (o.id === 'battle' || o.id === 'deploy' || o.id === 'front_go' || o.id === 'front_visit') {
    const w = ui.data.war;
    const k = await ui.pick({ title: o.id === 'battle' ? '作戦を行う前線' : o.id === 'deploy' ? '部隊を送る前線' : '向かう前線', items: w.fronts.map((f) => ({ label: f.name, sub: `兵力 ${troops(f.own)}・${f.control >= 0 ? '優勢' : '劣勢'}${Math.abs(f.control)}${f.today && o.id === 'battle' ? '・今日は作戦ずみ' : ''}`, right: `${f.odds}%`, rightColor: f.odds >= 50 ? K.good : K.warn })) });
    if (k == null || k < 0) return;
    opts.front = w.fronts[k].id;
    if (o.id === 'deploy') opts.n = Math.min(40, Math.max(2, Math.round(w.reserve / 2)));
  }
  const pv = (safe(() => g.warOrders(opts), []) || []).find((x) => x.id === o.id) || o;
  if (pv.why) { await ui.info(o.name, ['いまはできない：', pv.why]); return; }
  const danger = ['mobilize', 'battle', 'offensive', 'surrender', 'front_go'].includes(o.id);
  const k = await ui.confirm({ title: `${danger ? '⚠ ' : ''}${o.name}`, danger, lines: [pv.desc, '', `【結果】${WAR_CONSEQ[o.id] || ''}`], choices: danger ? ['やめておく', '命令する'] : ['命令する', 'やめる'], index: 0 });
  if (danger ? k !== 1 : k !== 0) return;
  await ui.result(o.name, safe(() => g.warOrder(o.id, opts), null));
}

// ================================================================ the scene
const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isWorldUI && !s.closed);
let tapCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = sceneOf(g);
    if (!sc || g.top !== sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
class WorldScene {
  constructor(g, opts, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isWorldUI: true, t: 0, focus: opts && opts.tab ? 'body' : 'tabs', tabIdx: tabIndex(opts && opts.tab), lists: {}, modals: [], toasts: [], busy: 0, data: null, dataT: -999, mode: 'relation', tapAt: null, closed: false, tick: 0, mapCv: null, mapKey: '', details: {} });
    bindTap(g);
    this.refresh(true);
    const w = this.data && this.data.w;
    this.sel = (opts && opts.sel) || (this.data && this.data.war && this.data.war.enemy) || (w && w.countries.find((c) => c.id === 'us') ? 'us' : w && w.countries[0] ? w.countries[0].id : null);
  }
  get tab() { return TABS[this.tabIdx]; }
  mapStamp() { return `${this.mode}|${this.dataT}|${Math.floor(this.t / 20) % 2}`; }
  ls(id = this.tab.id) { return this.lists[id] || (this.lists[id] = { i: 1, top: 0 }); }
  rows() { return this._rows || []; }
  curRow() { const r = this.rows(); const st = this.ls(); return r[st.i] || null; }
  detail(id) { if (!this.details[id]) this.details[id] = safe(() => this.g.worldCountry(id), null); return this.details[id]; }
  refresh(force = false) {
    if (!force && this.t - this.dataT < 45 && this.data) return;
    this.dataT = this.t;
    this.data = loadData(this);
    this.details = {};
    this._rows = this.data.ok ? safe(() => this.tab.rows(this), []) || [] : [];
    const st = this.ls();
    if (st.i >= this._rows.length) st.i = Math.max(0, this._rows.length - 1);
    if (this._rows[st.i] && this._rows[st.i].header) st.i = this._rows.findIndex((r) => !r.header);
    if (st.i < 0) st.i = 0;
  }
  dirty() { this.dataT = -999; }
  setTab(i) { this.tabIdx = (i + TABS.length) % TABS.length; this.refresh(true); }
  update(g) {
    this.t++;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < 150);
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    const m = this.modals[this.modals.length - 1];
    if (m) { if (tap) m.tap(this, tap, inp); m.update(this, inp); return; }
    if (this.busy > 0) return;
    this.refresh();
    if (tap && this.handleTap(tap, inp)) return;
    if (inp.pressed('menu')) { sfx('cancel'); this.close(); return; }
    if (this.focus === 'tabs') {
      if (inp.repeat('left')) { this.setTab(this.tabIdx - 1); sfx('cursor'); }
      else if (inp.repeat('right')) { this.setTab(this.tabIdx + 1); sfx('cursor'); }
      else if (inp.pressed('down') || inp.pressed('a')) { this.focus = 'body'; sfx('cursor'); }
      else if (inp.pressed('b')) { sfx('cancel'); this.close(); }
      return;
    }
    if (inp.pressed('b')) { this.focus = 'tabs'; sfx('cancel'); return; }
    if (this.tab.id === 'map') { this.updateMap(inp); return; }
    const rows = this.rows();
    const st = this.ls();
    for (const dir of ['up', 'down']) {
      if (!inp.repeat(dir)) continue;
      let j = st.i;
      do { j += dir === 'up' ? -1 : 1; } while (j >= 0 && j < rows.length && rows[j].header);
      if (j >= 0 && j < rows.length) { st.i = j; sfx('cursor'); } else if (dir === 'up') { this.focus = 'tabs'; sfx('cursor'); }
      return;
    }
    if (inp.repeat('left')) { this.setTab(this.tabIdx - 1); sfx('cursor'); return; }
    if (inp.repeat('right')) { this.setTab(this.tabIdx + 1); sfx('cursor'); return; }
    if (inp.pressed('a')) { const r = this.curRow(); if (r && !r.header && this.tab.act) { sfx('ok'); this.act(() => this.tab.act(this, r)); } }
  }
  updateMap(inp) {
    const d = this.data;
    if (!d || !d.ok) return;
    const pts = [...d.markers, ...insetPts(d.w.fictional)];
    const cur = pts.find((p) => p.id === this.sel) || pts[0];
    for (const [dir, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
      if (!inp.repeat(dir)) continue;
      let best = null, bs = Infinity;
      for (const p of pts) {
        if (p.id === cur.id) continue;
        const vx = p.x - cur.x, vy = p.y - cur.y;
        const along = vx * dx + vy * dy;
        if (along <= 1) continue;
        const across = Math.abs(vx * dy) + Math.abs(vy * dx);
        const s0 = along + across * 2.2;
        if (s0 < bs) { bs = s0; best = p; }
      }
      if (best) { this.sel = best.id; sfx('cursor'); } else if (dir === 'up') { this.focus = 'tabs'; sfx('cursor'); }
      return;
    }
    if (inp.pressed('a') && this.sel) { sfx('ok'); this.act(() => this.mapMenu()); }
  }
  async mapMenu() {
    const row = this.data.rows[this.sel];
    if (!row) return;
    const k = await this.pick({ title: row.name, items: [{ label: 'くわしく見る', sub: '国々のページ' }, { label: '外交の手段', sub: '首脳会談・条約・制裁・援助…' }, { label: `地図の色：${MODES.find((x) => x.id === this.mode).label} → ${MODES[(MODES.findIndex((x) => x.id === this.mode) + 1) % MODES.length].label}`, sub: '関係・陣営・同盟を切りかえる' }, { label: 'もどる' }] });
    if (k === 0) { const i = TABS.indexOf(TAB_COUNTRIES); this.setTab(i); const rows = this.rows(); const j = rows.findIndex((r) => r.key === this.sel); if (j >= 0) this.ls().i = j; this.focus = 'body'; }
    else if (k === 1) await actionsMenu(this, this.sel);
    else if (k === 2) { this.mode = MODES[(MODES.findIndex((x) => x.id === this.mode) + 1) % MODES.length].id; this.mapKey = ''; }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    const { x, y } = tap;
    if (inR(x, y, { x: SW - 22, y: 0, w: 22, h: 20 })) { now.a = false; sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < TABS.length; i++) if (inR(x, y, this.tabRects && this.tabRects[i])) { now.a = false; this.focus = 'tabs'; if (i !== this.tabIdx) { this.setTab(i); sfx('cursor'); } return true; }
    if (this.tab.id === 'map') {
      for (const ch of this.chips || []) if (inR(x, y, ch)) { now.a = false; this.mode = ch.id; this.mapKey = ''; sfx('cursor'); return true; }
      const d = this.data;
      const pts = [...d.markers, ...insetPts(d.w.fictional)];
      let best = null, bd = 14;
      for (const p of pts) { const dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; best = p; } }
      if (best) { this.focus = 'body'; if (this.sel !== best.id) { this.sel = best.id; now.a = false; sfx('cursor'); } return !now.a; }
      if (y < 256) { now.a = false; return true; }
      return false;
    }
    const L = this.listRect;
    if (L && inR(x, y, L)) {
      const rows = this.rows();
      const st = this.ls();
      const j = (st.top || 0) + Math.floor((y - L.y - 2) / L.rh);
      if (j >= 0 && j < rows.length && !rows[j].header) { this.focus = 'body'; if (j !== st.i) { st.i = j; now.a = false; sfx('cursor'); return true; } return false; }
      now.a = false; return true;
    }
    now.a = false;
    return true;
  }
  async act(fn) { this.busy++; try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); this.dirty(); } }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { return this.openModal(modal({ ...o, kind: 'confirm' })); }
  pick(o) { return this.openModal(modal({ ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { return this.openModal(modal({ title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
  toast(s, color = K.amber) { this.toasts.unshift({ text: String(s), t: 0, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  async result(title, r) {
    if (!r) { await this.info(title, ['うまくいかなかった。']); return; }
    if (r.ok === false) { sfx('buzz'); await this.info(title, [`できなかった：${r.why || '理由は不明'}`], { color: K.lock }); return; }
    sfx(r.success === false ? 'cancel' : 'good');
    await this.info(title, String(r.text || '実行した。').split('\n'));
    if (has(this.g, 'regimeFlush')) await safe(() => this.g.regimeFlush(), null);
    this.dirty();
    // the end of a life (the scene took the player back to the title)
    const life = has(this.g, 'regimeLifeOver') ? safe(() => this.g.regimeLifeOver(), null) : null;
    if (life || (this.g.state && this.g.state.regime && this.g.state.regime.id === 'fallen')) this.close();
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.modals.splice(0)) m._res(null);
    this.g.pop(this);
    this.resolve(null);
  }
  draw(c, g) {
    R(c, 0, 0, SW, SH, K.bg);
    // header
    R(c, 0, 0, SW, 20, K.head);
    T(c, '世界情勢', 8, 3, 12, K.amber);
    const d = this.data;
    if (!d || !d.ok) { T(c, '世界情勢の仕組み（world.js）が読み込まれていない', 20, 60, 12, K.dim); return; }
    T(c, `${d.w.date}　${d.role.label}`, 76, 4, 10, K.dim, 'left', 200);
    const tl = `世界：${d.w.tensionLabel}・緊張${d.w.tension}`;
    T(c, tl, SW - 30, 4, 10, d.w.tension >= 55 ? K.bad : d.w.tension >= 35 ? K.warn : K.good, 'right', 300);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    // tabs
    this.tabRects = [];
    const tw = Math.floor(SW / TABS.length);
    TABS.forEach((tb, i) => {
      const x = i * tw, on = i === this.tabIdx;
      R(c, x + 1, 21, tw - 2, 18, on ? (this.focus === 'tabs' ? K.amber : K.panel2) : '#0a1424');
      const alert = (tb.id === 'crisis' && (d.war || d.w.crises.some((k) => k.sev >= 2))) || (tb.id === 'diplomacy' && (d.w.offers || []).length);
      T(c, tb.label, x + tw / 2, 24, 12, on && this.focus === 'tabs' ? '#1a1206' : on ? K.amber : K.text, 'center', tw - 8);
      if (alert) R(c, x + tw - 9, 24, 4, 4, K.bad);
      this.tabRects.push({ x, y: 20, w: tw, h: 20 });
    });
    try { this.tab.draw(this, c); } catch (e) { console.error(e); }
    // ticker
    R(c, 0, 336, SW, 24, '#050b14');
    R(c, 0, 336, SW, 1, K.edge);
    const news = d.w.news.slice(0, 8).map((n) => n.text).join('　　◆　　') || d.w.summits.slice(0, 3).map((s0) => `${s0.year}年${s0.month}月　${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`).join('　　◆　　');
    const tw2 = measure(c, news, 10) + 80;
    const off = (this.t * 0.6) % Math.max(1, tw2);
    c.save(); c.beginPath(); c.rect(0, 337, 462, 22); c.clip();
    T(c, news, 8 - off, 343, 10, K.text); T(c, news, 8 - off + tw2, 343, 10, K.text);
    c.restore();
    R(c, 466, 338, 1, 20, K.edge);
    T(c, this.focus === 'tabs' ? '←→タブ　↓選ぶ　B閉じる' : this.tab.id === 'map' ? '十字で国を選ぶ　A決定　Bタブへ' : '↑↓選ぶ　←→タブ　A決定　B戻る', SW - 6, 343, 10, K.dim, 'right', 160);
    // toasts and modals
    this.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, 12) + 20); R(c, (SW - w) / 2, 300 - i * 22, w, 20, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * 22, 12, t.color, 'center', w - 10); });
    for (const m of this.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.45)'); m.draw(this, c); }
  }
}
// A modal: confirm (title, lines, choices) or pick (title, lines?, items[{ label, sub, right, rightColor, lock }]).
function modal(o) {
  const m = {
    ...o, idx: o.index || 0, top: 0,
    get n() { return o.kind === 'pick' ? (o.items || []).length : (o.choices || ['OK']).length; },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.n;
      if (o.kind === 'pick') {
        if (inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); }
        else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, -1); }
        return;
      }
      if (inp.repeat('left') || inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('right') || inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, o.cancel != null ? o.cancel : (o.choices || ['OK']).length === 1 ? 0 : (o.choices || []).length - 1); }
    },
    tap(ui, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (let i = 0; i < (m.rects || []).length; i++) if (inR(tap.x, tap.y, m.rects[i])) { if (m.idx === i || o.kind === 'confirm') { m.idx = i; ui.closeModal(m, i); } else m.idx = i; return; }
      if (!inR(tap.x, tap.y, m.box)) ui.closeModal(m, o.kind === 'pick' ? -1 : o.cancel != null ? o.cancel : (o.choices || ['OK']).length - 1);
    },
    draw(ui, c) {
      const w = Math.min(SW - 40, o.w || 460);
      const x = Math.round((SW - w) / 2);
      const lines = [];
      for (const l of o.lines || []) lines.push(...jwrap(c, String(l ?? ''), w - 24, 12));
      const pick = o.kind === 'pick';
      const rh = 28;
      const maxRows = pick ? Math.min(m.n, Math.max(3, Math.floor((SH - 80 - Math.min(lines.length, 6) * 16) / rh))) : 0;
      const shownLines = lines.slice(0, pick ? 6 : 14);
      const h = 26 + shownLines.length * 16 + (pick ? maxRows * rh + 8 : 38) + 6;
      const y = Math.round((SH - h) / 2);
      m.box = { x, y, w, h };
      R(c, x, y, w, h, '#0c1828');
      R(c, x, y, w, 2, o.danger ? K.danger : o.color || K.amber);
      R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
      T(c, o.title || '', x + 12, y + 7, 12, o.danger ? K.danger : o.color || K.amber, 'left', w - 24);
      shownLines.forEach((l, i) => T(c, l, x + 12, y + 26 + i * 16, 12, K.text, 'left', w - 24));
      if (lines.length > shownLines.length) T(c, '…', x + w - 16, y + 26 + (shownLines.length - 1) * 16, 12, K.dim);
      m.rects = [];
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + maxRows) m.top = m.idx - maxRows + 1;
        const y0 = y + 28 + shownLines.length * 16;
        for (let k = 0; k < maxRows && m.top + k < m.n; k++) {
          const it = o.items[m.top + k];
          const yy = y0 + k * rh;
          const sel = m.top + k === m.idx;
          R(c, x + 8, yy, w - 16, rh - 2, sel ? K.sel : '#0f2034');
          if (sel) R(c, x + 8, yy, 2, rh - 2, K.amber);
          const rw = it.right ? measure(c, it.right, 10) + 10 : 0;
          T(c, it.label, x + 16, yy + 2, 12, it.lock ? K.faint : K.text, 'left', w - 36 - rw);
          if (it.sub) T(c, it.sub, x + 16, yy + 15, 10, it.lock ? K.lock : K.dim, 'left', w - 36);
          if (it.right) T(c, it.right, x + w - 14, yy + 3, 10, it.rightColor || K.dim, 'right');
          m.rects[m.top + k] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
        }
        if (m.n > maxRows) T(c, `${m.idx + 1}／${m.n}`, x + w - 12, y + 7, 10, K.dim, 'right');
      } else {
        const ch = o.choices || ['OK'];
        const bw = Math.min(180, Math.floor((w - 24 - (ch.length - 1) * 8) / ch.length));
        const total = ch.length * bw + (ch.length - 1) * 8;
        ch.forEach((label, i) => {
          const bx = x + Math.round((w - total) / 2) + i * (bw + 8), by = y + h - 34;
          const sel = i === m.idx;
          R(c, bx, by, bw, 26, sel ? (o.danger && i > 0 ? K.danger : K.amber) : '#16283e');
          T(c, label, bx + bw / 2, by + 6, 12, sel ? '#140c04' : K.text, 'center', bw - 8);
          m.rects[i] = { x: bx, y: by, w: bw, h: 26 };
        });
      }
    },
  };
  return m;
}

export async function openWorldScreen(g, opts = {}) {
  if (!g || !g.state || !has(g, 'world')) return null;
  if (g.auto && !g.auto.worldui) return null;
  const open = sceneOf(g);
  if (open) { if (opts.tab != null) open.setTab(tabIndex(opts.tab)); if (opts.sel) open.sel = opts.sel; return null; }
  sfx('ok');
  return new Promise((resolve) => { const sc = new WorldScene(g, opts, resolve); g.push(sc); });
}
Game.prototype.worldScreen = function worldScreen(tab, opts = {}) { return openWorldScreen(this, { ...opts, tab }); };

// ================================================================ the phone app 「世界」 (era-framed)
const APP_COLOR = '#2a6a9a';
const eraOfG = (g) => (g.state && g.state.profile && g.state.profile.era) || 'reiwa';
const FRAME = { showa: '新聞の国際面', heisei_early: 'ケータイの国際ニュース', heisei: 'ケータイの国際ニュース', reiwa: '国際ニュース' };
const short = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
async function worldApp(g) {
  if (!has(g, 'world')) { await phoneInfo(g, { title: '世界', color: APP_COLOR, lines: ['（世界情勢の仕組みが読み込まれていない）'] }); return; }
  let index = 0;
  for (;;) {
    const w = g.world();
    const war = has(g, 'war') ? g.war() : null;
    const items = [
      { id: 'screen', label: '世界情勢の画面を開く', sub: '地図・国々・外交・危機' },
      { id: 'over', label: '概況', sub: `${w.tensionLabel}・緊張${w.tension}` },
      war ? { id: 'war', label: `戦争：${war.enemyShort}`, sub: war.frontText } : null,
      { id: 'news', label: FRAME[eraOfG(g)] || '国際ニュース', sub: w.news[0] ? short(w.news[0].text, 18) : '' },
      { id: 'crises', label: '世界の危機', sub: `${w.crises.length}件・紛争${w.conflicts.length}件` },
      { id: 'summits', label: '首脳会議の予定', sub: w.summits[0] ? `${w.summits[0].year}年${w.summits[0].month}月 ${short(w.summits[0].name, 10)}` : '' },
      { id: 'countries', label: '国々と日本の関係', sub: `${w.countries.length}か国` },
    ].filter(Boolean);
    const i = await phoneList(g, { title: '世界', color: APP_COLOR, index, items: items.map((x) => ({ label: x.label, sub: x.sub })) });
    if (i < 0) return;
    index = i;
    const id = items[i].id;
    if (id === 'screen') { if (g.auto && !g.auto.worldui) continue; await openWorldScreen(g, { tab: 'map' }); }
    else if (id === 'over') await phoneInfo(g, { title: '概況', color: APP_COLOR, lines: [`${w.date}　世界は「${w.tensionLabel}」（緊張 ${w.tension}／100）`, `日本の国際的な信頼 ${w.standing}／100・日本への脅威 ${w.threat}／100`, `原油価格（指数）${w.oil}`, '', '陣営：', ...Object.values(w.blocs).map((b) => `・${b.name}：${b.members.map((x) => (w.countries.find((c) => c.id === x) || {}).short || x).join('・')}`), '', `日本の同盟・協力：${w.alliances.filter((a) => a.japan).map((a) => a.short || a.name).join('・') || 'なし'}`, `日本の制裁：${w.sanctions.byJapan.map((x) => `${x.name}（段階${x.level}）`).join('・') || 'なし'}`] });
    else if (id === 'war' && war) await phoneInfo(g, { title: `戦争：${war.enemyShort}`, color: APP_COLOR, lines: [war.modeName, `戦況：${war.frontText}`, ...war.fronts.map((f) => `・${f.name}：${f.control >= 0 ? '優勢' : '劣勢'}${Math.abs(f.control)}（作戦の見込み${f.odds}%）`), `死者 兵士${n0(war.cas.soldiers.dead)}人・民間人${n0(war.cas.civilians.dead)}人`, `相手側の死傷者 ${n0(war.cas.enemySoldiers + war.cas.enemyCivilians)}人`, '（命令は「世界情勢の画面」の「危機・戦争」から）'] });
    else if (id === 'news') await phoneInfo(g, { title: FRAME[eraOfG(g)] || 'ニュース', color: APP_COLOR, lines: w.news.length ? w.news.slice(0, 16).map((n) => `・${n.text}`) : ['まだニュースはない。'] });
    else if (id === 'crises') await phoneInfo(g, { title: '世界の危機', color: APP_COLOR, lines: [...(w.crises.length ? w.crises.map((k) => `・${k.title}`) : ['・いまは大きな危機はない']), '', '紛争：', ...(w.conflicts.length ? w.conflicts.map((k) => `・${k.name}`) : ['・いまはない'])] });
    else if (id === 'summits') await phoneInfo(g, { title: '首脳会議の予定', color: APP_COLOR, lines: w.summits.map((s0) => `・${s0.year}年${s0.month}月　${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`) });
    else if (id === 'countries') {
      const list = w.countries.slice().sort((a, b) => b.relation - a.relation);
      const k = await phoneList(g, { title: '国々と日本の関係', color: APP_COLOR, items: list.map((c) => ({ label: short(c.name, 12), sub: `${c.relLabel}・${BLOC_SHORT(w, c.bloc)}${c.war ? '・戦争中' : ''}`, right: `${c.relation}` })) });
      if (k >= 0) { const det = g.worldCountry(list[k].id); await phoneInfo(g, { title: short(det.name, 12), color: APP_COLOR, lines: [det.leader, det.gov, `関係 ${det.relation}（${det.relLabel}）・国交：${det.tiesLabel}`, det.member && det.member.length ? `加盟：${det.member.join('・')}` : null, det.note, det.dispute ? `【${det.dispute.name}】${det.dispute.lines.join('')}` : null].filter(Boolean) }); }
    }
  }
}
const BLOC_SHORT = (w, b) => (w.blocs[b] ? w.blocs[b].short : '');
registerPhoneApp('world', {
  name: '世界', color: APP_COLOR, order: 61,
  iconHD(c, x, y) {
    appTile(c, x, y, '#1a4a72');
    // a small globe: the ocean, two land shapes, a meridian
    const cx = x + 16, cy = y + 16;
    for (let dy = -9; dy <= 9; dy++) { const hw = Math.round(Math.sqrt(81 - dy * dy)); c.fillStyle = '#4fb0e8'; c.fillRect(cx - hw, cy + dy, hw * 2, 1); }
    c.fillStyle = '#6ad08a'; c.fillRect(cx - 6, cy - 5, 5, 4); c.fillRect(cx - 4, cy - 1, 3, 5); c.fillRect(cx + 2, cy - 6, 5, 3); c.fillRect(cx + 3, cy - 3, 3, 6);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(cx, cy - 9, 1, 18); c.fillRect(cx - 9, cy, 18, 1);
  },
  badge: (g) => { try { const w = g.world(); const r = roleOf(g); return (has(g, 'war') && g.war() ? 1 : 0) + (r.kind !== 'citizen' && r.kind !== 'member' ? Math.min(3, w.crises.filter((k) => k.sev >= 2).length + (w.offers || []).length) : 0); } catch (e) { return 0; } },
  cond: (g) => has(g, 'world'),
  open: (g) => worldApp(g),
});
if (typeof window !== 'undefined') window.__worldui = { scene: () => sceneOf(window.__game), open: openWorldScreen, TABS, MAP, grid, project };
