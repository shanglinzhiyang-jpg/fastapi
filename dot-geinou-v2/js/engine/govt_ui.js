// 政府中枢 (govt_ui): the politics-only, information-dense government console (HD 640x360) and the political
// phone apps 「世論の声」「国会中継」「政府中枢」. Agent D (GOVT UI).
//
// Everything here only CALLS the cores' g.* APIs (politics.js, govt.js, regime.js, ideology.js, assist.js); it never
// writes their state. Every core but politics.js is feature-detected (a missing one shows 「準備中」 in its panels).
// Locked controls always say why, with the cores' own refusal reasons (g.govtRefusal / g.regimeRefusal / the
// `why` fields of their lists). Neutral tone: every policy, tax and budget item shows 賛成 and 反対.
// The dictatorship / war parts are a fictional 「もしも」 simulation (regime.js FICTION_NOTE): every such step asks a
// sober confirmation that states the consequences and says it is fiction. Wars only against FICTIONAL nations.
//
// ---------------------------------------------------------------- for other modules
//   import { openGovtConsole } from './govt_ui.js'   (or feature-detect g.govtConsole)
//   await g.govtConsole(tab?)          the console; tab: 'overview' | 'budget' | 'network' | 'opinion' | 'diet' |
//                                      'admin' | 'security' | 'crisis' | 'ideology' | 'society' (or 1..10)
//   openGovtConsole(g, { tab, sub })   same; sub picks a sub-view ('tax', 'supp', 'press', 'regime', …)
//   govtRole(g) -> { kind: 'pm'|'minister'|'member'|'citizen', label, posts[], diet, ruling, … }
//   Under g.auto the console does not open (returns null) unless g.auto.govtui is set (tests drive it with keys).
// Roles: 総理 controls everything; a 大臣 controls the items of their own ministry (財務: 予算・税, 防衛: 自衛隊,
// 官房長官・国家公安委員長: デモへの対応, 文部（科学）: 宗教法人, the ministries' 政令・省令 / 審議会); a Diet member can
// propose (法案・質問主意書・対案) and see everything; anyone else gets a read-only view with 政治ナビ explanations.
// The cores decide: a control is locked when the core's refusal function gives a reason.
// Phone apps (registerPhoneApp): 'voices' 世論の声 (order 63), 'kokkai_live' 国会中継 (64), 'govt_console' 政府中枢 (65).
// UI-only data: g.state.flags.govtui = { tab, def: [{ fy, cho, pct }] (防衛費の推移, one row per fiscal year) }.
// Test hook: window.__govtui = { scene(), open(g, opts), TABS, role }.

import { Game } from './game.js';
import * as POL from './politics.js';
import { SW, SH, clamp, shade, makeCanvas, hash2 } from './util.js';
import { text, wrap, measure } from './draw.js';
import { audio } from './audio.js';
import { drawFaceHD } from './sprites.js';
import { registerPhoneApp, onMorning } from './life.js';
import { appTile, rrect, box, phoneView, phoneText, fitText, PC, activePhone, phoneInfo, phoneList, phoneConfirm } from './phone.js';
import { drawPartyMark } from './politics_ui.js';

const { POSTS, POLICIES, POLICY_AREAS, SEGMENTS, SEGMENT_ORDER, postName, polDate, dateLabel, fmtCho, segWeights } = POL;

// the other cores: guarded literal imports (each may be missing; a single-file bundler can include them)
let GV = null; // govt.js (A1)
let RG = null; // regime.js (A2)
let ID = null; // ideology.js (B)
let AS = null; // assist.js (C)
import('./govt.js').then((m) => { GV = m; }).catch(() => { GV = null; });
import('./regime.js').then((m) => { RG = m; }).catch(() => { RG = null; });
import('./ideology.js').then((m) => { ID = m; }).catch(() => { ID = null; });
import('./assist.js').then((m) => { AS = m; }).catch(() => { AS = null; });

// ================================================================ theme (the console's own look in the politics_ui family)
const K = {
  bg: '#050a11', grid: '#0a1520', grid2: '#0d1b28', head: '#08111b',
  panel: '#0b1622', panelHi: '#0f1d2c', head2: '#10202f', edge: '#1d3a50', edgeHi: '#3a6d8c',
  text: '#e6f0f8', dim: '#8ea4b8', faint: '#4f667a', ghost: '#2a3c4c',
  amber: '#ffb547', amberDk: '#7a5214', cyan: '#4fd2e8', teal: '#2bb39a', good: '#57d98a', bad: '#ff6470',
  warn: '#ffcc4d', violet: '#a78bfa', pink: '#ff7eb6', sel: '#16324a', selEdge: '#ffb547', lock: '#c9a76a',
  paper: '#f2ecdc', ink: '#24232b', white: '#ffffff', danger: '#ff5468',
};
const SEG_SHORT = { young: '若者', families: '子育て', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁業', unions: '労働組合', urban: '都市', rural: '地方', floating: '無党派' };
const SEG_COLOR = { young: '#5fd7ff', families: '#ff9ac8', elderly: '#e8c25a', employees: '#7aa8ff', selfemployed: '#ffb070', business: '#c8a0ff', farmers: '#8ad06a', unions: '#ff7a7a', urban: '#a0e0e8', rural: '#b8d080', floating: '#c0c8d8' };

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
// every string drawn by the console goes through T with a width: it is cut with '…' when it does not fit (no overflow)
const FITLOG = { on: false, cut: [] };
function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  if (FITLOG.on && FITLOG.cut.length < 400) FITLOG.cut.push(s);
  return a.join('') + '…';
}
function T(c, s, x, y, size = 12, color = K.text, align = 'left', w = 0) {
  const str = w > 0 ? fit(c, s, w, size) : String(s ?? '');
  text(c, str, Math.round(x), Math.round(y), { size, color, align, shadow: null });
}
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
function wrapJ(c, s, w, size) {
  return String(s ?? '').split('\n').flatMap((par) => {
    const lines = wrap(c, par, w, size);
    for (let i = 1; i < lines.length; i++) {
      const a = Array.from(lines[i]);
      let k = 0;
      while (k < a.length && k < 2 && NO_START.has(a[k])) k++;
      if (k && lines[i - 1] !== '') { lines[i - 1] += a.slice(0, k).join(''); lines[i] = a.slice(k).join(''); }
    }
    return lines.filter((l, i) => l !== '' || i === 0);
  });
}
// a wrapped paragraph (at most `max` lines, the last one cut with '…'); returns the y below it
function para(c, s, x, y, w, size = 12, color = K.text, lh = size + 3, max = 99) {
  const lines = wrapJ(c, s, w, size);
  const n = Math.min(max, lines.length);
  for (let i = 0; i < n; i++) {
    const l = i === n - 1 && lines.length > n ? lines[i] + '…' : lines[i];
    T(c, l, x, y + i * lh, size, color, 'left', w + (i === n - 1 && lines.length > n ? 0 : size));
  }
  return y + n * lh;
}
function lineCount(c, s, w, size) { return wrapJ(c, s, w, size).length; }
function line(c, x0, y0, x1, y1, col, wpx = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (let k = 0; k < 3000; k++) {
    c.fillRect(x0, y0, wpx, wpx);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
}
function frame(c, x, y, w, h, fill, edge) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (fill) R(c, x, y, w, h, fill);
  R(c, x, y, w, 1, edge); R(c, x, y + h - 1, w, 1, edge); R(c, x, y, 1, h, edge); R(c, x + w - 1, y, 1, h, edge);
}
// a console panel: a dark box with corner ticks and a title strip
function panel(c, x, y, w, h, title, o = {}) {
  frame(c, x, y, w, h, o.fill || K.panel, o.edge || K.edge);
  const tc = o.tick || K.edgeHi;
  R(c, x, y, 5, 1, tc); R(c, x, y, 1, 5, tc); R(c, x + w - 5, y, 5, 1, tc); R(c, x + w - 1, y, 1, 5, tc);
  R(c, x, y + h - 1, 5, 1, tc); R(c, x, y + h - 5, 1, 5, tc); R(c, x + w - 5, y + h - 1, 5, 1, tc); R(c, x + w - 1, y + h - 5, 1, 5, tc);
  if (title) {
    R(c, x + 1, y + 1, w - 2, 15, o.head || K.head2);
    R(c, x + 1, y + 16, w - 2, 1, o.edge || K.edge);
    const rw = o.right ? Math.min(w * 0.55, measure(c, o.right, 10) + 4) : 0;
    T(c, title, x + 6, y + 2, 12, o.accent || K.amber, 'left', w - 12 - rw);
    if (o.right) T(c, o.right, x + w - 5, y + 4, 10, o.rightColor || K.dim, 'right', rw);
  }
}
function chip(c, x, y, s, bg, fg = K.white, size = 10) {
  const w = Math.round(measure(c, s, size)) + 6;
  R(c, x, y, w, size + 3, bg);
  T(c, s, x + 3, y + 1, size, fg);
  return w;
}
function chipR(c, xr, y, s, bg, fg = K.white, size = 10) { const w = Math.round(measure(c, s, size)) + 6; chip(c, xr - w, y, s, bg, fg, size); return w; }
function hbar(c, x, y, w, h, frac, col, back = '#081019') {
  R(c, x, y, w, h, back);
  const fw = Math.round(clamp(num(frac), 0, 1) * w);
  if (fw > 0) { R(c, x, y, fw, h, col); R(c, x, y, fw, 1, shade(col, 0.3)); }
}
// a bar from the middle (v in -1..1)
function cbar(c, x, y, w, h, v, pos = K.good, neg = K.bad) {
  R(c, x, y, w, h, '#081019');
  const mid = x + Math.round(w / 2);
  R(c, mid, y - 1, 1, h + 2, K.faint);
  const k = Math.round(clamp(Math.abs(num(v)), 0, 1) * (w / 2 - 1));
  if (k > 0) { if (v > 0) R(c, mid + 1, y, k, h, pos); else R(c, mid - k, y, k, h, neg); }
}
function spark(c, vals, x, y, w, h, col, o = {}) {
  let n = 0, mn = Infinity, mx = -Infinity;
  for (const v of vals) if (Number.isFinite(v)) { n++; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (o.back !== false) R(c, x, y, w, h, o.back || '#07111b');
  if (n < 2) { for (let i = 0; i < w; i += 4) R(c, x + i, y + (h >> 1), 2, 1, K.ghost); return; }
  if (o.min != null) mn = o.min;
  if (o.max != null) mx = o.max;
  const range = Math.max(o.minRange || Math.max(1e-6, Math.abs(mx) * 0.02), mx - mn);
  const mid = (mx + mn) / 2;
  if (mx - mn < range) { mn = mid - range / 2; mx = mid + range / 2; }
  const px = (i) => x + 1 + Math.round((i * (w - 3)) / (vals.length - 1));
  const py = (v) => y + h - 2 - Math.round(((clamp(v, mn, mx) - mn) / (mx - mn)) * (h - 4));
  if (o.ref != null && o.ref > mn && o.ref < mx) for (let i = 0; i < w; i += 3) R(c, x + i, py(o.ref), 1, 1, o.refColor || K.faint);
  let prev = null;
  for (let i = 0; i < vals.length; i++) {
    if (!Number.isFinite(vals[i])) continue;
    const pt = [px(i), py(vals[i])];
    if (prev) line(c, prev[0], prev[1], pt[0], pt[1], col);
    prev = pt;
  }
  if (prev) R(c, prev[0] - 1, prev[1] - 1, 3, 3, shade(col, 0.4));
}
// a semicircular gauge: v 0..1, segments coloured
function gauge(c, cx, cy, r, v, col, o = {}) {
  for (let a = 0; a <= 40; a++) {
    const t = a / 40, ang = Math.PI - t * Math.PI;
    const on = t <= clamp(v, 0, 1);
    const cc = o.zones ? (t < 0.33 ? o.zones[0] : t < 0.66 ? o.zones[1] : o.zones[2]) : col;
    for (let k = r - 4; k <= r; k++) R(c, cx + Math.cos(ang) * k, cy - Math.sin(ang) * k, 1, 1, on ? cc : '#16222e');
  }
  const ang = Math.PI - clamp(v, 0, 1) * Math.PI;
  line(c, cx, cy, cx + Math.cos(ang) * (r - 6), cy - Math.sin(ang) * (r - 6), K.white);
  disc(c, cx, cy, 2, K.white);
}
// a 7x8 padlock
function padlock(c, x, y, col = K.lock) {
  R(c, x + 2, y, 3, 1, col); R(c, x + 1, y + 1, 1, 3, col); R(c, x + 5, y + 1, 1, 3, col);
  R(c, x, y + 3, 7, 5, col); R(c, x + 3, y + 5, 1, 2, '#2a2210');
}
const fmtN = (n, d = 0) => (Math.round(num(n) * 10 ** d) / 10 ** d).toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => `${fmtN(v, d)}%`;
const sgn = (v, d = 1) => `${num(v) > 0 ? '+' : num(v) < 0 ? '−' : '±'}${fmtN(Math.abs(num(v)), d)}`;
const cho = (v) => (typeof fmtCho === 'function' ? fmtCho(num(v)) : `${fmtN(v, 1)}兆円`);
function sfx(name) { try { audio.sfx(name); } catch (e) { /* no audio in tests */ } }

// ================================================================ safe access to the cores
const has = (g, k) => !!g && typeof g[k] === 'function';
function safe(fn, d = null) { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } }
const polOf = (g) => safe(() => g.pol(), null);
const today = (g) => (g.state && g.state.day) || 1;
const yearOf = (g) => safe(() => polDate(g).year, 2026);
const fyOf = (g) => safe(() => polDate(g).fy, 2026.3);
const pName = (post, g) => safe(() => postName(post, fyOf(g)), post);
const FICTION = () => (RG && RG.FICTION_NOTE) || 'これは架空の「もしも」のシミュレーションです。実在の政党・人物・国とは関係ありません。';
function partyShortName(g, id) { if (!id || id === 'ind') return '無所属'; return safe(() => g.partyName(id, true), id) || id; }
function partyColorOf(g, id) {
  if (!id || id === 'ind') return '#8a90a6';
  const p = polOf(g);
  const pt = p && p.parties && p.parties[id];
  return (pt && pt.color) || (POL.PARTY_DEFS && POL.PARTY_DEFS[id] && POL.PARTY_DEFS[id].color) || '#8a90a6';
}
function eraDev(g) {
  const era = g.state && g.state.profile && g.state.profile.era;
  return era === 'reiwa' ? 'smart' : era === 'heisei' ? 'keitai' : 'techo';
}

// ================================================================ the player's role
export function govtRole(g) {
  const p = polOf(g);
  const out = { kind: 'citizen', pm: false, posts: [], diet: false, ruling: false, office: null, party: null, label: '市民（閲覧のみ）', color: K.dim, short: '閲覧' };
  if (!p || !p.me) return out;
  const me = p.me;
  out.office = me.office || null;
  out.party = me.party || null;
  out.pm = p.cabinet && p.cabinet.pm === 'player';
  const posts = (me.posts || []).filter((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm');
  for (const [post, who] of Object.entries((p.cabinet && p.cabinet.ministers) || {})) if (who === 'player' && !posts.includes(post)) posts.push(post);
  out.posts = posts;
  out.diet = me.office === 'shugi' || me.office === 'sangi';
  out.ruling = !!(me.party && ((p.cabinet && p.cabinet.partyIds) || []).includes(me.party));
  if (out.pm) Object.assign(out, { kind: 'pm', label: '内閣総理大臣', color: K.amber, short: '全権' });
  else if (posts.length) Object.assign(out, { kind: 'minister', label: pName(posts[0], g), color: K.cyan, short: '所管' });
  else if (out.diet) Object.assign(out, { kind: 'member', label: `${me.office === 'shugi' ? '衆議院' : '参議院'}議員（${out.ruling ? '与党' : '野党'}）`, color: K.teal, short: '提案' });
  else if (me.office) {
    const O = POL.OFFICES && POL.OFFICES[me.office];
    Object.assign(out, { kind: 'citizen', label: `${O ? O.label : '議員'}（国政は閲覧）`, color: K.dim, short: '閲覧' });
  }
  out.has = (post) => out.pm || out.posts.includes(post);
  return out;
}
const ROLE_NOTE = {
  pm: '総理大臣：すべての項目を操作できる（最終的な可否は各制度のルールで決まる）',
  minister: '大臣：自分の省の項目を操作できる。ほかは見るだけ',
  member: '国会議員：法案・質問主意書・対案を出せる。政府の決定は見るだけ',
  citizen: '見るだけ（政治ナビの解説つき）。デモへの参加・主催は市民としてできる',
};

// ================================================================ UI data (flags.govtui) and the defence-budget history
function uiData(g) {
  const fl = g.state.flags || (g.state.flags = {});
  let d = fl.govtui;
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = fl.govtui = {};
  if (!Array.isArray(d.def)) d.def = [];
  d.def = d.def.filter((x) => x && Number.isFinite(x.fy) && Number.isFinite(x.cho));
  return d;
}
function recordDefense(g) {
  if (!g.state || !has(g, 'sdf') || !has(g, 'pol')) return;
  const s = safe(() => g.sdf(), null);
  if (!s || !s.budget) return;
  const d = uiData(g);
  const fy = Math.floor(fyOf(g));
  const row = { fy, cho: Math.round(num(s.budget.cho) * 100) / 100, pct: s.budget.gdpPct == null ? null : Math.round(num(s.budget.gdpPct) * 100) / 100 };
  const i = d.def.findIndex((x) => x.fy === fy);
  if (i >= 0) d.def[i] = row; else d.def.push(row);
  d.def.sort((a, b) => a.fy - b.fy);
  if (d.def.length > 60) d.def.splice(0, d.def.length - 60);
}
onMorning((g) => { try { recordDefense(g); } catch (e) { console.error(e); } });
// Real 防衛関係費 (当初予算) for reference, shown only up to the game year (verified 2026-10, sources below):
//   FY1987 3兆5174億円（対GNP比1.004%）— 政府答弁書（第108回国会, 1987年）https://www.shugiin.go.jp/internet/itdb_shitsumona.nsf/html/shitsumon/a108033.htm
//   FY1997 4.94兆円, FY2004 4.88兆円（SACO・米軍再編関係経費などを除く）— 防衛白書「防衛関係費（当初予算）の推移」
//     https://www.mod.go.jp/j/press/wp/wp2022/html/n240201000.html
//   FY2025 8兆7005億円, FY2026 9兆353億円（SACO・米軍再編関係経費を含む）— 防衛白書2026 / 財務省 https://www.mof.go.jp/public_relations/finance/202605/202605g.html
const DEF_REAL = [
  { fy: 1987, cho: 3.52, note: 'GNP比1.004%（初めて1%を超えた）' },
  { fy: 1997, cho: 4.94, note: '' },
  { fy: 2004, cho: 4.88, note: '' },
  { fy: 2025, cho: 8.70, note: '' },
  { fy: 2026, cho: 9.04, note: '初めて9兆円を超えた' },
];

// ================================================================ hemicycle (cached layouts)
const HEMI = new Map();
function hemiLayout(n) {
  n = Math.max(1, Math.round(n));
  if (HEMI.has(n)) return HEMI.get(n);
  const r0 = 0.38;
  const rows = n <= 10 ? 1 : clamp(Math.round(Math.sqrt(n) / 2.1), 2, 12);
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? 1 : r0 + ((1 - r0) * i) / (rows - 1)));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / sum)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) { if (diff > 0) { counts[i]++; diff--; } else if (counts[i] > 1) { counts[i]--; diff++; } }
  const seats = [];
  counts.forEach((k, i) => { for (let j = 0; j < k; j++) seats.push({ a: k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1), r: radii[i] }); });
  seats.sort((s, t) => t.a - s.a || s.r - t.r);
  const out = { seats, rows, r0 };
  HEMI.set(n, out);
  return out;
}
// groups: [{ color, n }] left → right (the opposition on the left, the ruling parties on the right)
function drawHemi(c, cx, cy, Rr, groups, total, o = {}) {
  const L = hemiLayout(total);
  const gap = (Rr * (1 - L.r0)) / Math.max(1, L.rows - 1);
  const dot = o.dot || Math.max(1, Math.min(6, Math.floor((L.rows === 1 ? Rr / 4 : gap) * 0.8)));
  let gi = 0, left = groups.length ? groups[0].n : 0;
  for (let i = 0; i < L.seats.length; i++) {
    while (gi < groups.length && left <= 0) { gi++; left = gi < groups.length ? groups[gi].n : 0; }
    const col = gi < groups.length ? groups[gi].color : '#1c2a38';
    left--;
    const s = L.seats[i];
    R(c, cx + Math.cos(s.a) * Rr * s.r - dot / 2, cy - Math.sin(s.a) * Rr * s.r - dot / 2, dot, dot, col);
  }
  // 過半数 and 3分の2 lines, counted from the right (the ruling side)
  for (const [k, col, lab] of o.lines || []) {
    const a = Math.PI * (k / total);
    const x0 = cx + Math.cos(a) * Rr * (L.r0 - 0.12), y0 = cy - Math.sin(a) * Rr * (L.r0 - 0.12);
    const x1 = cx + Math.cos(a) * (Rr + 4), y1 = cy - Math.sin(a) * (Rr + 4);
    for (let t = 0; t <= 1; t += 0.06) R(c, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1, 1, col);
    if (lab && o.labels) T(c, lab, x1 + (Math.cos(a) >= 0 ? 2 : -2), y1 - 10, 10, col, Math.cos(a) >= 0 ? 'left' : 'right');
  }
}
function seatGroupsOf(sd) {
  const parts = (sd && sd.parties) || [];
  const opp = parts.filter((q) => !q.ruling && q.id !== 'ind').sort((a, b) => b.seats - a.seats);
  const ind = parts.filter((q) => q.id === 'ind');
  const rul = parts.filter((q) => q.ruling).sort((a, b) => a.seats - b.seats);
  return [...opp, ...ind, ...rul].map((q) => ({ id: q.id, n: Math.round(num(q.seats)), color: q.color || '#8a90a6', ruling: q.ruling, name: q.short || q.name, kaiha: q.kaiha }));
}

// ================================================================ background (baked once)
let BG = null;
function drawBg(c) {
  if (!BG) {
    const [cv, x] = makeCanvas(SW, SH);
    x.fillStyle = K.bg; x.fillRect(0, 0, SW, SH);
    x.fillStyle = K.grid;
    for (let i = 0; i < SW; i += 16) x.fillRect(i, 0, 1, SH);
    for (let j = 0; j < SH; j += 16) x.fillRect(0, j, SW, 1);
    x.fillStyle = K.grid2;
    for (let i = 0; i < SW; i += 64) x.fillRect(i, 0, 1, SH);
    for (let j = 0; j < SH; j += 64) x.fillRect(0, j, SW, 1);
    for (let i = 0; i < 90; i++) { x.fillStyle = i % 7 ? '#0e2232' : '#163246'; x.fillRect(Math.floor(hash2(i, 9, 3) * SW), Math.floor(hash2(i, 4, 3) * SH), 1, 1); }
    BG = cv;
  }
  c.drawImage(BG, 0, 0);
}
// the console's mark: a hexagon with a pillar (generic, no real emblem)
function mark(c, x, y, col = K.amber) {
  R(c, x + 5, y, 8, 1, col); R(c, x + 3, y + 1, 12, 1, col); R(c, x + 1, y + 2, 16, 12, shade(col, -0.55));
  R(c, x + 3, y + 14, 12, 1, col); R(c, x + 5, y + 15, 8, 1, col);
  R(c, x + 1, y + 2, 1, 12, col); R(c, x + 16, y + 2, 1, 12, col);
  R(c, x + 8, y + 4, 2, 8, col); R(c, x + 5, y + 4, 8, 1, col); R(c, x + 5, y + 11, 8, 1, col);
}

// ================================================================ geometry
const HEAD_H = 21;
const TAB_Y = 23, TAB_H = 17;
const BODY = { x: 4, y: 44, w: 632, h: 292 };
const FOOT_Y = 340;

// ================================================================ the scene
// Controls (rebuilt by each tab's layout() when its data is refreshed, about once a second or after an action):
//   { id, x, y, w, h, kind: 'btn'|'list'|'node'|'panel'|'seg', label?, why (lock reason) | null, tip, a(ui),
//     lr(ui, d) (←→ adjusts a value), list: { n, get(), set(i), rowH, top } (↑↓ inside), tapRow(i) }
// Focus: 'tabs' (←→ change the tab, → past the last tab = ？, ↓/A into the body) or 'body' (spatial ↑↓←→, B back).
const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isGovtUI && !s.closed);
let tapBoundCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapBoundCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapBoundCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = sceneOf(g);
    if (!sc || g.top !== sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
const inR = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

class GovtScene {
  constructor(g, opts, resolve) {
    Object.assign(this, {
      g, hd: true, opaque: true, hidesHud: true, isGovtUI: true, allowTips: true, t: 0, resolve,
      focus: 'tabs', tabIdx: 0, cur: {}, ctls: [], modals: [], toasts: [], busy: 0, st: {}, data: null, dataT: -999,
      tabRects: [], helpRect: { x: 0, y: 0, w: 0, h: 0 }, closeRect: { x: SW - 22, y: 2, w: 18, h: 17 }, tapAt: null, closed: false,
    });
    bindTap(g);
    const i = tabIndex(opts && opts.tab);
    this.tabIdx = i >= 0 ? i : clamp(num(uiData(g).tab, 0), 0, TABS.length - 1);
    if (opts && opts.sub) this.tabState().sub = opts.sub;
    if (opts && opts.tab) this.focus = 'body';
    this.enterTab(true);
  }
  get tab() { return TABS[this.tabIdx]; }
  tabState(id = this.tab.id) { return this.st[id] || (this.st[id] = { sub: null }); }
  role() { return govtRole(this.g); }
  enterTab(first = false) {
    this.data = null;
    this.dataT = -999;
    this.refresh(true);
    uiData(this.g).tab = this.tabIdx;
    const T0 = this.tab;
    const key = typeof T0.tip === 'function' ? T0.tip(this) : T0.tip;
    if (first) tipKey(this.g, 'govt_open');
    if (key) tipKey(this.g, key);
  }
  setTab(i, sub) {
    i = clamp(i, 0, TABS.length - 1);
    if (sub) this.st[TABS[i].id] = { ...(this.st[TABS[i].id] || {}), sub };
    if (i === this.tabIdx && !sub) return;
    this.tabIdx = i;
    this.enterTab();
  }
  refresh(force = false) {
    if (!force && this.t - this.dataT < 50 && this.data) return;
    this.dataT = this.t;
    const T0 = this.tab;
    this.role0 = this.role();
    this.data = safe(() => T0.load(this), {}) || {};
    this.ctls = safe(() => T0.layout(this, this.data), []) || [];
    this.ctls.push({ id: 'help', ...this.helpRect, kind: 'help', why: null, tip: '解説（政治ナビ）：この画面の見かた・用語', a: (ui) => ui.help() });
    if (!this.ctls.some((k) => k.id === this.cur[T0.id] && !k.nofocus)) this.cur[T0.id] = (this.ctls.find((k) => k.id !== 'help' && !k.nofocus) || {}).id;
  }
  ctl(id = this.cur[this.tab.id]) { return this.ctls.find((k) => k.id === id) || null; }
  dirty() { this.dataT = -999; }
  // ---------------------------------------------------------------- update
  update(g) {
    this.t++;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < t.life);
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    const m = this.modals[this.modals.length - 1];
    if (m) {
      if (tap) this.tapModal(m, tap, inp);
      try { m.update(this, inp); } catch (e) { console.error(e); this.closeModal(m, null); }
      return;
    }
    if (this.busy > 0) return;
    this.refresh();
    if (tap) this.handleTap(tap, inp);
    // MENU closes the console (as it closes the phone); the ？ is on the tab bar (→ past the last tab, or a tap)
    if (inp.pressed('menu')) { sfx('cancel'); this.close(); return; }
    if (this.focus === 'tabs') this.updateTabs(inp);
    else this.updateBody(inp);
  }
  updateTabs(inp) {
    const n = TABS.length;
    if (this.cur._tabsHelp) {
      if (inp.pressed('a')) { sfx('ok'); this.help(); return; }
      if (inp.repeat('left')) { this.cur._tabsHelp = false; sfx('cursor'); return; }
      if (inp.repeat('right')) { this.cur._tabsHelp = false; this.setTab(0); sfx('cursor'); return; }
      if (inp.pressed('down')) { this.cur._tabsHelp = false; this.focus = 'body'; sfx('cursor'); return; }
      if (inp.pressed('b')) { this.cur._tabsHelp = false; sfx('cancel'); return; }
      return;
    }
    if (inp.repeat('left')) { this.setTab((this.tabIdx + n - 1) % n); sfx('cursor'); }
    else if (inp.repeat('right')) { if (this.tabIdx === n - 1) this.cur._tabsHelp = true; else this.setTab(this.tabIdx + 1); sfx('cursor'); }
    if (inp.pressed('down') || inp.pressed('a')) { this.focus = 'body'; sfx('cursor'); return; }
    if (inp.pressed('b')) { sfx('cancel'); this.close(); }
  }
  updateBody(inp) {
    this.cur._tabsHelp = false;
    const k = this.ctl();
    if (inp.pressed('b')) { sfx('cancel'); this.focus = 'tabs'; return; }
    if (!k) { if (inp.pressed('up')) this.focus = 'tabs'; return; }
    for (const dir of ['up', 'down']) {
      if (!inp.repeat(dir)) continue;
      if (k.list && k.list.n > 0) {
        const i = k.list.get();
        const j = i + (dir === 'up' ? -1 : 1);
        if (j >= 0 && j < k.list.n) { k.list.set(j); sfx('cursor'); return; }
      }
      const nx = this.spatial(k, dir);
      if (nx) { this.cur[this.tab.id] = nx.id; if (nx.list && nx.list.n) nx.list.set(dir === 'up' ? nx.list.n - 1 : 0); sfx('cursor'); }
      else if (dir === 'up') { this.focus = 'tabs'; sfx('cursor'); }
      return;
    }
    for (const dir of ['left', 'right']) {
      if (!inp.repeat(dir)) continue;
      if (k.lr && !whyOf(k, this)) { k.lr(this, dir === 'left' ? -1 : 1); sfx('cursor'); return; }
      const nx = this.spatial(k, dir);
      if (nx) { this.cur[this.tab.id] = nx.id; sfx('cursor'); }
      return;
    }
    if (inp.pressed('a')) this.activate(k);
  }
  spatial(cur, dir) {
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = null, bs = Infinity;
    for (const k of this.ctls) {
      if (k === cur || k.id === 'help' || k.nofocus) continue;
      const kx = k.x + k.w / 2, ky = k.y + k.h / 2;
      const ox = Math.max(0, Math.max(cur.x, k.x) - Math.min(cur.x + cur.w, k.x + k.w));
      const oy = Math.max(0, Math.max(cur.y, k.y) - Math.min(cur.y + cur.h, k.y + k.h));
      let p, s;
      if (dir === 'up') { if (ky >= cy - 1 || k.y >= cur.y) continue; p = Math.max(0, cur.y - (k.y + k.h)); s = ox; }
      else if (dir === 'down') { if (ky <= cy + 1 || k.y + k.h <= cur.y + cur.h) continue; p = Math.max(0, k.y - (cur.y + cur.h)); s = ox; }
      else if (dir === 'left') { if (kx >= cx - 1 || k.x >= cur.x) continue; p = Math.max(0, cur.x - (k.x + k.w)); s = oy; }
      else { if (kx <= cx + 1 || k.x + k.w <= cur.x + cur.w) continue; p = Math.max(0, k.x - (cur.x + cur.w)); s = oy; }
      const score = p + s * 3 + (dir === 'up' || dir === 'down' ? Math.abs(kx - cx) * 0.05 : Math.abs(ky - cy) * 0.05);
      if (score < bs) { bs = score; best = k; }
    }
    return best;
  }
  activate(k) {
    if (!k) return;
    if (whyOf(k, this)) { sfx('buzz'); this.showLock(k); return; }
    if (!k.a) { sfx('buzz'); return; }
    sfx('ok');
    this.act(() => k.a(this));
  }
  showLock(k) {
    const why = whyOf(k, this);
    if (Array.from(String(why)).length <= 34) { this.toast(`🔒 ${why}`, K.lock); return; }
    this.act(() => this.info(`${k.lockTitle || k.label || 'いまはできない'}`, [`いまはできない理由：`, String(why)], { color: K.lock }));
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    const { x, y } = tap;
    if (inR(x, y, this.closeRect)) { now.a = false; sfx('cancel'); this.close(); return; }
    if (inR(x, y, this.helpRect)) { now.a = false; sfx('ok'); this.help(); return; }
    for (let i = 0; i < this.tabRects.length; i++) {
      if (inR(x, y, this.tabRects[i])) { now.a = false; this.focus = 'tabs'; this.cur._tabsHelp = false; if (i !== this.tabIdx) { this.setTab(i); sfx('cursor'); } return; }
    }
    for (let i = this.ctls.length - 1; i >= 0; i--) {
      const k = this.ctls[i];
      if (k.id === 'help' || k.nofocus || !inR(x, y, k)) continue;
      this.focus = 'body';
      this.cur[this.tab.id] = k.id;
      if (k.list && k.list.n) {
        const rh = k.list.rowH || 16;
        const row = Math.floor((y - k.y - (k.list.y0 || 0)) / rh) + (k.list.top ? k.list.top() : 0);
        if (row >= 0 && row < k.list.n) { if (row !== k.list.get()) { k.list.set(row); now.a = false; sfx('cursor'); return; } }
        else { now.a = false; return; }
      }
      if (k.lr && !whyOf(k, this) && k.tapLR !== false) {
        // a slider: the left third lowers, the right third raises, the middle presses A
        const fx = (x - k.x) / Math.max(1, k.w);
        if (fx < 0.3 || fx > 0.7) { now.a = false; k.lr(this, fx < 0.3 ? -1 : 1); sfx('cursor'); return; }
      }
      return; // keep the A: the tapped control is activated
    }
    now.a = false;
  }
  tapModal(m, tap, inp) {
    const now = inp.pressedNow || {};
    let keep = false;
    try { keep = m.tap ? !!m.tap(this, tap.x, tap.y) : false; } catch (e) { console.error(e); }
    if (!keep) now.a = false;
  }
  // ---------------------------------------------------------------- async helpers
  async act(fn) {
    this.busy++;
    try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); this.dirty(); }
  }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { return this.openModal(confirmModal(o)); }
  pick(o) { return this.openModal(pickModal(o)); }
  amount(o) { return this.openModal(amountModal(o)); }
  info(title, lines, o = {}) { return this.openModal(confirmModal({ title, lines: [].concat(lines), choices: ['OK'], ...o })); }
  toast(s, color = K.amber) { this.toasts.unshift({ text: String(s), t: 0, life: 170, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  // show a core result: { ok, why, text }
  async result(title, r, okText = '') {
    if (!r) { await this.info(title, ['うまくいかなかった。']); return false; }
    if (r.ok === false) { sfx('buzz'); await this.info(title, [`できなかった：${r.why || '理由は不明'}`], { color: K.lock }); return false; }
    sfx('good');
    const t = r.text || okText || '実行した。';
    if (Array.from(String(t)).length <= 30 && !String(t).includes('\n')) this.toast(t, K.good);
    else await this.info(title, String(t).split('\n'));
    await this.flush();
    return true;
  }
  // the regime core's queued scenes (KIKI) after an action
  async flush() { if (has(this.g, 'regimeFlush')) await safe(() => this.g.regimeFlush(), null); }
  // Leave the screen for another UI that would open under it (the phone or the politics UI already open below
  // the console), then come back. Without one below, fn just runs (its UI opens on top of the console).
  async away(fn) {
    const g = this.g;
    const i = g.scenes.indexOf(this);
    const below = g.scenes.slice(0, Math.max(0, i)).some((s) => (s.isPhone && !s.closing && !s.dismissed) || (s.isPolUI && !s.closed));
    if (!below) return fn();
    g.pop(this);
    try { return await fn(); } finally {
      for (const s of g.scenes) if (s.isPhone) s.tapAt = null;
      if (!this.closed) g.push(this);
    }
  }
  navi(topic) {
    if (!has(this.g, 'navi')) { this.toast('政治ナビは読み込まれていない', K.dim); return Promise.resolve(null); }
    return this.away(() => this.g.navi(topic));
  }
  explain(term) { return has(this.g, 'explain') ? safe(() => this.g.explain(term), Promise.resolve(null)) : this.info('用語', [`${term}：用語じてんが読み込まれていない`]); }
  async help() {
    if (this.busy > 0 && !this.modals.length) return;
    const T0 = this.tab;
    const key = typeof T0.tip === 'function' ? T0.tip(this) : T0.tip;
    if (key) tipKey(this.g, key, true);
    const terms = (typeof T0.terms === 'function' ? T0.terms(this) : T0.terms) || [];
    const lesson = typeof T0.lesson === 'function' ? T0.lesson(this) : T0.lesson;
    const items = [
      ...terms.map((t) => ({ label: `用語：${t}`, sub: '用語じてん（政治ナビ）', kind: 'term', t })),
      lesson ? { label: '政治のしくみを学ぶ', sub: '政治ナビのレッスン', kind: 'lesson' } : null,
      { label: 'いま何をすればいい？', sub: '政治ナビのアドバイス', kind: 'advice' },
    ].filter(Boolean);
    await this.act(async () => {
      for (let guard = 0; guard < 20; guard++) {
        const i = await this.pick({ title: `解説：${T0.label}`, lines: [T0.about, ROLE_NOTE[this.role0 ? this.role0.kind : 'citizen']], items, index: 0, w: 470, color: K.teal });
        if (i == null || i < 0) return;
        const it = items[i];
        if (it.kind === 'term') await this.explain(it.t);
        else if (it.kind === 'lesson') await this.navi(`lesson:${lesson}`);
        else await this.navi('advice');
      }
    });
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.modals.splice(0)) m._res(null);
    this.g.pop(this);
    for (const s of this.g.scenes) if (s.isPhone) s.tapAt = null;
    this.resolve(null);
  }
  // ---------------------------------------------------------------- draw
  draw(c, g) {
    drawBg(c);
    const d = this.data || {};
    try { this.tab.draw(c, this, d); } catch (e) { console.error(e); T(c, '（この画面を表示できなかった）', BODY.x + 10, BODY.y + 10, 12, K.bad); }
    this.drawFocus(c);
    this.drawChrome(c, g);
    for (let i = 0; i < this.modals.length; i++) {
      c.globalAlpha = 0.66; R(c, 0, 0, SW, SH, '#02050a'); c.globalAlpha = 1;
      try { this.modals[i].draw(c, this); } catch (e) { console.error(e); }
    }
    let ty = SH - 50;
    for (const t of this.toasts) {
      const a = t.t < 6 ? t.t / 6 : t.life - t.t < 12 ? (t.life - t.t) / 12 : 1;
      c.globalAlpha = clamp(a, 0, 1);
      const w = Math.min(SW - 40, measure(c, t.text, 12) + 26);
      frame(c, (SW - w) / 2, ty, w, 20, '#0d1d2c', t.color);
      T(c, t.text, SW / 2, ty + 4, 12, t.color, 'center', w - 14);
      c.globalAlpha = 1;
      ty -= 24;
    }
  }
  drawFocus(c) {
    if (this.focus !== 'body' || this.modals.length) return;
    const k = this.ctl();
    if (!k || k.id === 'help') return;
    if (k.list && k.list.n) return; // lists draw their own selected row
    const blink = Math.floor(this.t / 20) % 2 === 0;
    frame(c, k.x - 1, k.y - 1, k.w + 2, k.h + 2, null, blink ? K.selEdge : shade(K.selEdge, -0.3));
    R(c, k.x - 3, k.y + Math.floor(k.h / 2) - 2, 2, 5, K.selEdge);
  }
  drawChrome(c, g) {
    // header
    R(c, 0, 0, SW, HEAD_H, K.head);
    R(c, 0, HEAD_H, SW, 1, K.amberDk);
    mark(c, 5, 2);
    T(c, '政府中枢', 28, 3, 14, K.white);
    const role = this.role0 || govtRole(g);
    let x = 28 + measure(c, '政府中枢', 14) + 8;
    const rl = `${role.label}・${role.short}`;
    x += chip(c, x, 4, rl.length > 22 ? role.label : rl, shade(role.color, -0.55), role.color, 10) + 4;
    const rg = has(g, 'regime') ? safe(() => g.regime(), null) : null;
    if (rg && rg.id !== 'democracy') x += chip(c, x, 4, `${rg.name}（もしも）`, '#4a1018', K.danger, 10) + 4;
    const dl = safe(() => `${dateLabel(g)}（${polDate(g).wareki}）`, '');
    const dw = Math.min(200, measure(c, dl, 10));
    T(c, dl, SW - 28, 6, 10, K.cyan, 'right', 200);
    void dw;
    // close
    const cr = this.closeRect;
    frame(c, cr.x, cr.y, cr.w, cr.h, '#14202c', K.edge);
    T(c, '×', cr.x + cr.w / 2, cr.y + 2, 12, K.dim, 'center');
    // tabs
    let tx = 4;
    this.tabRects = [];
    TABS.forEach((tb, i) => {
      const w = Math.round(measure(c, tb.label, 12)) + 12;
      const on = i === this.tabIdx;
      const foc = this.focus === 'tabs' && on && !this.cur._tabsHelp;
      R(c, tx, TAB_Y, w, TAB_H, on ? K.panel : '#0a131d');
      R(c, tx, TAB_Y, w, 1, on ? K.amber : K.edge);
      if (!on) R(c, tx, TAB_Y + TAB_H - 1, w, 1, K.edge);
      R(c, tx, TAB_Y, 1, TAB_H, K.edge); R(c, tx + w - 1, TAB_Y, 1, TAB_H, K.edge);
      if (foc) { const b = Math.floor(this.t / 20) % 2 === 0; frame(c, tx + 1, TAB_Y + 1, w - 2, TAB_H - 2, null, b ? K.selEdge : K.amberDk); }
      T(c, tb.label, tx + 6, TAB_Y + 3, 12, on ? K.white : K.dim);
      const alert = safe(() => (tb.alert ? tb.alert(this) : 0), 0);
      if (alert) R(c, tx + w - 4, TAB_Y + 3, 3, 3, K.bad);
      this.tabRects.push({ x: tx, y: TAB_Y, w, h: TAB_H });
      tx += w + 1;
    });
    R(c, tx, TAB_Y + TAB_H - 1, SW - 4 - tx, 1, K.edge);
    // ？ (help)
    const hw = 46;
    this.helpRect = { x: SW - 4 - hw, y: TAB_Y, w: hw, h: TAB_H - 1 };
    const hk = this.ctls.find((k) => k.id === 'help');
    if (hk) Object.assign(hk, this.helpRect);
    const hfoc = (this.focus === 'tabs' && this.cur._tabsHelp) || (this.focus === 'body' && this.cur[this.tab.id] === 'help');
    frame(c, this.helpRect.x, this.helpRect.y, hw, TAB_H - 1, hfoc ? '#1d4a44' : '#0f2a28', hfoc ? K.selEdge : K.teal);
    T(c, '？解説', this.helpRect.x + hw / 2, TAB_Y + 3, 12, hfoc ? K.white : K.teal, 'center');
    // footer: the focused control's tip or lock reason; the keys
    R(c, 0, FOOT_Y - 1, SW, 1, K.edge);
    R(c, 0, FOOT_Y, SW, SH - FOOT_Y, K.head);
    const k = this.focus === 'body' ? this.ctl() : null;
    const hint = this.modals.length ? '↑↓:えらぶ A:けってい B:もどる' : this.focus === 'tabs' ? (this.cur._tabsHelp ? 'A:解説 ←:タブ ↓:中へ B:もどる' : '←→:タブ（右はしの先に？）↓:中へ B:とじる') : k && k.lr && !whyOf(k, this) ? '←→:増減 A:けってい B:タブへ' : '↑↓←→:えらぶ A:けってい B:タブへ';
    const hw2 = measure(c, hint, 10);
    T(c, hint, SW - 6, FOOT_Y + 5, 10, K.dim, 'right');
    let tip = '';
    let col = K.cyan;
    if (this.focus === 'tabs') tip = this.cur._tabsHelp ? 'この画面の解説と用語（政治ナビ）' : this.tab.short || this.tab.about;
    else if (k) {
      const why = whyOf(k, this) || '';
      if (why) { tip = `🔒 ${why}`; col = K.lock; } else tip = safe(() => (typeof k.tip === 'function' ? k.tip(this) : k.tip) || '', '');
    }
    if (tip) T(c, tip, 6, FOOT_Y + 4, 12, col, 'left', SW - hw2 - 20);
  }
}

// ================================================================ modals
function modalBox(c, o, h) {
  const w = o.w || 420;
  const x = Math.round((SW - w) / 2), y = Math.round(clamp((SH - h) / 2, 26, 200));
  const col = o.color || (o.danger ? K.danger : K.amber);
  R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.5)');
  frame(c, x, y, w, h, '#0c1824', col);
  R(c, x + 1, y + 1, w - 2, 18, shade(col, -0.68));
  T(c, o.title || '', x + 8, y + 3, 12, col, 'left', w - 16);
  return { x, y, w, col };
}
// { title, lines[] | text, choices[], index, cancel, danger, fiction (adds the もしも note), w, color }
function confirmModal(o) {
  const choices = o.choices || ['はい', 'いいえ'];
  const m = {
    idx: o.index | 0, sy: 0,
    update(ui, inp) {
      const n = choices.length;
      if (inp.repeat('up') || (n <= 3 && inp.repeat('left'))) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down') || (n <= 3 && inp.repeat('right'))) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(this, this.idx); } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(this, o.cancel ?? n - 1); }
    },
    tap(ui, x, y) {
      for (let i = 0; i < (this.btn || []).length; i++) if (inR(x, y, this.btn[i])) { this.idx = i; return true; }
      return false;
    },
    draw(c) {
      const w = o.w || 440;
      const src = [...(o.lines || (o.text != null ? String(o.text).split('\n') : []))];
      if (o.fiction) src.push('', `※${FICTION()}`);
      const lines = [];
      for (const l of src) lines.push(...wrapJ(c, String(l), w - 28, 12));
      const shown = lines.slice(0, 15);
      const h = 26 + shown.length * 15 + 8 + choices.length * 22 + 8;
      const b = modalBox(c, { ...o, w }, h);
      shown.forEach((l, i) => {
        const warn = /^⚠|^※|^【/.test(l);
        T(c, i === 14 && lines.length > 15 ? l + '…' : l, b.x + 14, b.y + 24 + i * 15, 12, warn ? (o.danger ? '#ffb0b8' : K.warn) : K.text, 'left', i === 14 && lines.length > 15 ? w - 26 : w - 16);
      });
      let yy = b.y + 24 + shown.length * 15 + 8;
      this.btn = [];
      choices.forEach((ch, i) => {
        const sel = i === this.idx;
        const bx = b.x + 20, bw = w - 40;
        frame(c, bx, yy, bw, 19, sel ? shade(b.col, -0.5) : '#122030', sel ? b.col : K.edge);
        T(c, ch, bx + bw / 2, yy + 3, 12, sel ? K.white : K.text, 'center', bw - 12);
        if (sel) R(c, bx + 6, yy + 6, 3, 7, b.col);
        this.btn.push({ x: bx, y: yy, w: bw, h: 19 });
        yy += 22;
      });
    },
  };
  return m;
}
// { title, lines[] (a short header), items: [{ label, sub, right, why, color }], index, w, color } → index | -1
function pickModal(o) {
  const items = o.items || [];
  const m = {
    idx: clamp(o.index | 0, 0, Math.max(0, items.length - 1)), top: 0,
    update(ui, inp) {
      const n = items.length;
      if (n && inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
      if (n && inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a') && n) {
        const it = items[this.idx];
        if (it && it.why) { sfx('buzz'); ui.toast(`🔒 ${it.why}`, K.lock); if (o.lockedOK) ui.closeModal(this, this.idx); return; }
        sfx('ok'); ui.closeModal(this, this.idx);
      } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(this, -1); }
    },
    tap(ui, x, y) {
      const L = this.lay;
      if (!L || !inR(x, y, L)) return false;
      const i = this.top + Math.floor((y - L.y) / L.rh);
      if (i < 0 || i >= items.length) return false;
      if (i !== this.idx) { this.idx = i; sfx('cursor'); return false; }
      return true;
    },
    draw(c) {
      const w = o.w || 420;
      const head = [];
      for (const l of o.lines || []) if (l) head.push(...wrapJ(c, String(l), w - 28, 12));
      const hs = head.slice(0, 5);
      const rh = items.some((it) => it.sub) ? 28 : 18;
      // the selected item's full text (subs and lock reasons are cut in the rows)
      const cur = items[this.idx];
      const full = cur ? (cur.why ? `🔒 ${cur.why}` : cur.detail || cur.sub || '') : '';
      const fl = items.some((it) => it.sub || it.why) && full ? wrapJ(c, full, w - 28, 10).slice(0, 3) : [];
      const fh = fl.length ? 8 + 3 * 12 : 0;
      const vis = Math.max(1, Math.min(items.length, Math.floor((300 - 30 - hs.length * 15 - fh) / rh)));
      const h = 26 + hs.length * 15 + (hs.length ? 6 : 0) + vis * rh + 10 + fh;
      const b = modalBox(c, { ...o, w }, h);
      hs.forEach((l, i) => T(c, l, b.x + 14, b.y + 24 + i * 15, 12, K.dim, 'left', w - 16));
      const ly = b.y + 24 + hs.length * 15 + (hs.length ? 6 : 0);
      if (this.idx < this.top) this.top = this.idx;
      if (this.idx >= this.top + vis) this.top = this.idx - vis + 1;
      this.top = clamp(this.top, 0, Math.max(0, items.length - vis));
      this.lay = { x: b.x + 8, y: ly, w: w - 16, h: vis * rh, rh };
      if (!items.length) T(c, '（なし）', b.x + 16, ly + 2, 12, K.dim);
      for (let i = this.top; i < Math.min(items.length, this.top + vis); i++) {
        const it = items[i];
        const y = ly + (i - this.top) * rh;
        const sel = i === this.idx;
        if (sel) { R(c, b.x + 8, y, w - 16, rh - 2, K.sel); R(c, b.x + 8, y, 2, rh - 2, b.col); }
        let lx = b.x + 14;
        if (it.color) { R(c, lx, y + 4, 4, 10, it.color); lx += 8; }
        if (it.why) { padlock(c, lx, y + 4); lx += 10; }
        const rw = it.right ? Math.min(150, measure(c, it.right, 10) + 8) : 0;
        T(c, it.label, lx, y + 2, 12, it.why ? K.faint : sel ? K.white : K.text, 'left', b.x + w - 14 - lx - rw);
        if (it.right) T(c, it.right, b.x + w - 14, y + 4, 10, it.rightColor || K.dim, 'right', rw);
        if (it.sub && rh >= 28) T(c, it.why ? `🔒 ${it.why}` : it.sub, lx, y + 15, 10, it.why ? K.lock : K.dim, 'left', b.x + w - 14 - lx);
      }
      if (items.length > vis) {
        const bh = Math.max(8, Math.round((vis * rh * vis) / items.length));
        const by = ly + Math.round(((vis * rh - bh) * this.top) / Math.max(1, items.length - vis));
        R(c, b.x + w - 6, ly, 2, vis * rh, '#14202c'); R(c, b.x + w - 6, by, 2, bh, K.faint);
      }
      if (fl.length) {
        const fy = ly + vis * rh + 4;
        R(c, b.x + 8, fy, w - 16, 1, K.edge);
        fl.forEach((l, i) => T(c, l, b.x + 14, fy + 4 + i * 12, 10, cur.why ? K.lock : K.text, 'left', w - 18));
      }
    },
  };
  return m;
}
// { title, lines[], value, min, max, step, unit, fmt(v) } → value | null
function amountModal(o) {
  const step = o.step || 1;
  const m = {
    v: clamp(num(o.value, o.min), o.min, o.max), idx: 0,
    update(ui, inp) {
      if (inp.repeat('left')) { this.v = clamp(Math.round((this.v - step) / step) * step, o.min, o.max); sfx('cursor'); }
      if (inp.repeat('right')) { this.v = clamp(Math.round((this.v + step) / step) * step, o.min, o.max); sfx('cursor'); }
      if (inp.repeat('up') || inp.repeat('down')) { this.idx = 1 - this.idx; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(this, this.idx === 0 ? this.v : null); } else if (inp.pressed('b')) { sfx('cancel'); ui.closeModal(this, null); }
    },
    tap(ui, x, y) {
      const L = this.lay;
      if (!L) return false;
      if (inR(x, y, L.minus)) { this.v = clamp(this.v - step, o.min, o.max); sfx('cursor'); return false; }
      if (inR(x, y, L.plus)) { this.v = clamp(this.v + step, o.min, o.max); sfx('cursor'); return false; }
      if (inR(x, y, L.ok)) { this.idx = 0; return true; }
      if (inR(x, y, L.no)) { this.idx = 1; return true; }
      return false;
    },
    draw(c) {
      const w = o.w || 400;
      const lines = [];
      for (const l of o.lines || []) lines.push(...wrapJ(c, String(l), w - 28, 12));
      const shown = lines.slice(0, 6);
      const h = 26 + shown.length * 15 + 40 + 2 * 22 + 10;
      const b = modalBox(c, { ...o, w }, h);
      shown.forEach((l, i) => T(c, l, b.x + 14, b.y + 24 + i * 15, 12, K.text, 'left', w - 16));
      const vy = b.y + 26 + shown.length * 15 + 4;
      const vs = o.fmt ? o.fmt(this.v) : `${fmtN(this.v, step < 1 ? 1 : 0)}${o.unit || ''}`;
      const minus = { x: b.x + 40, y: vy, w: 30, h: 26 }, plus = { x: b.x + w - 70, y: vy, w: 30, h: 26 };
      frame(c, minus.x, minus.y, minus.w, minus.h, '#122030', K.edge); T(c, '◀', minus.x + 15, vy + 6, 12, K.amber, 'center');
      frame(c, plus.x, plus.y, plus.w, plus.h, '#122030', K.edge); T(c, '▶', plus.x + 15, vy + 6, 12, K.amber, 'center');
      T(c, vs, b.x + w / 2, vy + 4, 16, K.white, 'center', w - 160);
      hbar(c, b.x + 80, vy + 24, w - 160, 3, (this.v - o.min) / Math.max(1e-9, o.max - o.min), b.col);
      let yy = vy + 36;
      const btns = [];
      ['決定する', 'やめる'].forEach((s, i) => {
        const sel = this.idx === i;
        frame(c, b.x + 20, yy, w - 40, 19, sel ? shade(b.col, -0.5) : '#122030', sel ? b.col : K.edge);
        T(c, s, b.x + w / 2, yy + 3, 12, sel ? K.white : K.text, 'center');
        btns.push({ x: b.x + 20, y: yy, w: w - 40, h: 19 });
        yy += 22;
      });
      this.lay = { minus, plus, ok: btns[0], no: btns[1] };
    },
  };
  return m;
}

// ================================================================ shared control builders
// a button control; o: { id, x, y, w, h, label, why, tip, a, color }
function btn(o) { return { kind: 'btn', h: 18, ...o }; }
function drawBtn(c, ui, k, o = {}) {
  if (!k) return;
  const why = whyOf(k, ui);
  const sel = ui.focus === 'body' && ui.cur[ui.tab.id] === k.id;
  const col = o.color || k.color || K.cyan;
  frame(c, k.x, k.y, k.w, k.h, why ? '#0d151d' : sel ? shade(col, -0.62) : '#0f1e2b', why ? K.ghost : sel ? col : shade(col, -0.35));
  let lx = k.x + 6;
  if (why) { padlock(c, lx, k.y + Math.floor(k.h / 2) - 4); lx += 10; }
  const size = k.h >= 16 ? 12 : 10;
  const cx = o.center ? (why ? (lx + k.x + k.w) / 2 : k.x + k.w / 2) : lx;
  T(c, k.label, cx, k.y + Math.floor((k.h - size) / 2) - 1, size, why ? K.faint : sel ? K.white : K.text, o.center ? 'center' : 'left', k.w - (lx - k.x) - 4);
}
// a list control: rows drawn by drawRow(c, i, x, y, w, rh, sel); state kept in ui.tabState()[key]
function listCtl(ui, key, o) {
  const st = ui.tabState();
  const n = o.n;
  if (st[key] == null || st[key] >= n) st[key] = clamp(num(st[key], 0), 0, Math.max(0, n - 1));
  const rh = o.rowH || 16;
  const y0 = o.y0 || 0;
  const vis = Math.max(1, Math.floor((o.h - y0) / rh));
  const tk = `${o.id || key}_top`;
  const k = {
    kind: 'list', id: o.id || key, x: o.x, y: o.y, w: o.w, h: o.h, why: o.why || null, tip: o.tip, a: o.a, lr: o.lr,
    list: {
      n, rowH: rh, y0, vis,
      get: () => clamp(num(st[key], 0), 0, Math.max(0, n - 1)),
      set: (i) => { st[key] = clamp(i, 0, Math.max(0, n - 1)); if (o.onMove) o.onMove(ui, st[key]); },
      top: () => num(st[tk], 0),
    },
  };
  return k;
}
function drawList(c, ui, k, drawRow, o = {}) {
  if (!k) return;
  const L = k.list;
  const st = ui.tabState();
  const sel = ui.focus === 'body' && ui.cur[ui.tab.id] === k.id;
  const idx = L.get();
  const key = `${k.id}_top`;
  let top = num(st[key], 0);
  if (idx < top) top = idx;
  if (idx >= top + L.vis) top = idx - L.vis + 1;
  top = clamp(top, 0, Math.max(0, L.n - L.vis));
  st[key] = top;
  L.top = () => top;
  if (!L.n) { T(c, o.empty || '（なし）', k.x + 6, k.y + L.y0 + 3, 12, K.dim, 'left', k.w - 12); return; }
  for (let i = top; i < Math.min(L.n, top + L.vis); i++) {
    const y = k.y + L.y0 + (i - top) * L.rowH;
    const on = i === idx;
    if (on) { R(c, k.x, y, k.w - (L.n > L.vis ? 4 : 0), L.rowH - 1, sel ? K.sel : '#0f2030'); R(c, k.x, y, 2, L.rowH - 1, sel ? K.selEdge : K.faint); }
    try { drawRow(c, i, k.x, y, k.w - (L.n > L.vis ? 4 : 0), L.rowH, on && sel, on); } catch (e) { console.error(e); }
  }
  if (L.n > L.vis) {
    const h = L.vis * L.rowH;
    const bh = Math.max(8, Math.round((h * L.vis) / L.n));
    const by = k.y + L.y0 + Math.round(((h - bh) * top) / Math.max(1, L.n - L.vis));
    R(c, k.x + k.w - 3, k.y + L.y0, 3, h, '#0a1520'); R(c, k.x + k.w - 3, by, 3, bh, K.faint);
  }
}
// sub-view switch (segmented control at the top of a tab)
function segCtls(ui, subs, x, y) {
  const st = ui.tabState();
  if (!subs.some((s) => s.id === st.sub)) st.sub = subs[0].id;
  const out = [];
  let xx = x;
  const c = ui.g.ctx;
  for (const s of subs) {
    const w = Math.round((c ? measure(c, s.label, 12) : s.label.length * 12)) + 16;
    out.push({ kind: 'seg', id: `seg_${s.id}`, x: xx, y, w, h: 17, label: s.label, why: null, tip: s.tip || `${s.label}を表示する`, a: (ui2) => { ui2.tabState().sub = s.id; ui2.dirty(); } });
    xx += w + 2;
  }
  return out;
}
function drawSegs(c, ui, subs) {
  const st = ui.tabState();
  for (const s of subs) {
    const k = ui.ctls.find((q) => q.id === `seg_${s.id}`);
    if (!k) continue;
    const on = st.sub === s.id;
    const sel = ui.focus === 'body' && ui.cur[ui.tab.id] === k.id;
    frame(c, k.x, k.y, k.w, k.h, on ? '#1d4a64' : '#0b1621', on ? K.cyan : K.edge);
    if (on) R(c, k.x + 1, k.y + k.h - 2, k.w - 2, 1, K.cyan);
    T(c, s.label, k.x + k.w / 2, k.y + 2, 12, on ? K.white : K.dim, 'center', k.w - 6);
    void sel;
  }
}
const sub = (ui) => ui.tabState().sub;
// a focusable panel that jumps to another tab on A
function jump(id, x, y, w, h, tabId, tip, subId) {
  return { kind: 'panel', id, x, y, w, h, why: null, tip, a: (ui) => { ui.setTab(tabIndex(tabId), subId); ui.focus = 'body'; } };
}

// ================================================================ shared data readers
function upcomingOf(g) {
  const list = has(g, 'upcomingElections') ? safe(() => g.upcomingElections(), []) : [];
  return (list || []).filter((e) => !e.newsOnly && e.status !== 'done' && e.day >= today(g)).sort((a, b) => a.day - b.day);
}
function sessionText(g) {
  const p = polOf(g);
  if (!p) return '—';
  const S = p.diet.session;
  if (p.diet.shugi && p.diet.shugi.dissolved) return '衆議院は解散中（総選挙のあと特別国会）';
  if (S) return `${S.kind}：会期末 ${safe(() => dateLabel(g, S.end).replace(/^\d+年/, ''), '')}（あと${Math.max(0, S.end - today(g))}日）`;
  const rg = has(g, 'regime') ? safe(() => g.regime(), null) : null;
  if (rg && rg.steps && rg.steps.diet && rg.id !== 'democracy') return '国会は停止されている（もしも）';
  return '閉会中（通常国会は1月に召集）';
}
const REFORM_STAGE = { idle: null, chosakai: '与党税調で審議中（12月中旬に大綱）', taiko: '税制改正大綱がまとまった', none: '今年の税制改正はなし', bill: '税制改正法案を国会で審議中', enacted: '税制改正法が成立した', failed: '税制改正法案は成立しなかった' };
// ねじれ: the ruling side has a majority in the 衆院 but not in the 参院 (computed from the seats shown)
function nejireOf(sd) { return !!(sd && sd.shugi && sd.sangi && sd.shugi.rulingMajority && !sd.sangi.rulingMajority); }
const CAL_SHORT = (fy) => ({ ceiling: 'シーリング', request: '概算要求', genan: fy < 2001 ? '大蔵原案' : '財務省原案', cabinet: '閣議決定', diet: '国会提出', passed: '成立', fy: '新年度' });
function voicesOf(g, n, opts) { return has(g, 'voices') ? safe(() => g.voices(n, opts || {}), []) || [] : []; }
const STANCE_COL = { pro: K.good, con: K.bad, neutral: K.dim };
const STANCE_WORD = { pro: '賛成', con: '反対', neutral: '中立' };

// ================================================================ tab 1: 概況
const REASON_SHORT = { base: '基礎', honeymoon: '発足直後', economy: '経済', deficit: '財政', policy: '政策', scandal: '不祥事・カネ', fatigue: '政権の長さ', pm: '総理の人気', nejire: 'ねじれ', tax: '税', budget: '予算', demo: 'デモ', diet: '国会運営', religion: '宗教問題', admin: '行政', disaster: '災害対応', regime: '体制・安保', other: 'その他' };
const TAB_OVERVIEW = {
  id: 'overview', label: '概況', short: '支持率・議席・経済・体制・危機・世論・予定', tip: 'govt_approval', lesson: 'yoron',
  about: '内閣支持率・議席・経済・体制・危機・世論・次の予定を一度に見る',
  terms: ['支持率', '世論調査', '過半数', '報道の自由'],
  load(ui) {
    const g = ui.g, p = polOf(g);
    const d = { p };
    d.ab = has(g, 'approvalBreakdown') ? safe(() => g.approvalBreakdown(), null) : null;
    const wk = d.ab && Array.isArray(d.ab.weekly) && d.ab.weekly.length >= 2 ? d.ab.weekly : null;
    d.series = wk ? wk.slice(-104).map((w) => num(w.approval, NaN)) : (p.polls || []).slice(-104).map((q) => num(q.approval, NaN));
    d.none = wk ? wk.slice(-104).map((w) => num(w.none, NaN)) : (p.polls || []).slice(-104).map((q) => num(q.none, NaN));
    d.firstDay = wk ? wk[Math.max(0, wk.length - 104)].day : (p.polls[Math.max(0, p.polls.length - 104)] || {}).day;
    d.approval = Math.round(num(d.ab ? d.ab.approval : p.cabinet.approval));
    const prev = d.series.length >= 2 ? d.series[d.series.length - 2] : null;
    d.apDelta = prev == null ? null : Math.round(d.approval - prev);
    const rs = (d.ab && d.ab.reasons) || [];
    d.base = rs.find((r) => r.id === 'base');
    d.reasons = rs.filter((r) => r.id !== 'base' && Math.abs(num(r.value)) >= 0.05).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 7);
    d.seats = has(g, 'seatDetails') ? safe(() => g.seatDetails(), null) : null;
    d.eco = p.economy;
    const hist = (g.state.flags.polui && Array.isArray(g.state.flags.polui.eco)) ? g.state.flags.polui.eco : [];
    d.ecoHist = (k) => hist.map((q) => num(q[k], NaN));
    d.regime = has(g, 'regime') ? safe(() => g.regime(), null) : null;
    d.press = has(g, 'pressFreedom') ? safe(() => g.pressFreedom(), null) : null;
    d.disaster = has(g, 'disaster') ? safe(() => g.disaster(), null) : null;
    d.war = has(g, 'war') ? safe(() => g.war(), null) : null;
    d.demos = has(g, 'demos') ? safe(() => g.demos({ active: true }), []) : [];
    d.voices = voicesOf(g, 2);
    const b = has(g, 'budget') ? safe(() => g.budget(), null) : null;
    const next = b && (b.calendar || []).find((s) => !s.done);
    d.dead = [
      { k: '予算', t: b ? `${b.fy}年度 ${b.stageLabel || ''}${next ? `／つぎ：${(CAL_SHORT(b.fy)[next.step] || next.label)}（${next.when}）` : ''}` : '—', tab: 'budget' },
      ...upcomingOf(g).filter((e) => e.kind !== 'sosaisen' || e.party === p.me.party).slice(0, 2).map((e) => ({ k: '選挙', t: `${e.label}：${e.date}`, r: e.day - today(g) <= 0 ? '今日' : `あと${e.day - today(g)}日`, tab: 'diet' })),
      { k: '国会', t: sessionText(g), tab: 'diet' },
    ];
    const tr = has(g, 'taxReform') ? safe(() => g.taxReform(), null) : null;
    if (tr && REFORM_STAGE[tr.stage]) d.dead.push({ k: '税制', t: REFORM_STAGE[tr.stage], tab: 'budget', sub: 'tax' });
    d.dead = d.dead.slice(0, 4);
    return d;
  },
  layout(ui, d) {
    const out = [
      jump('ov_ap', 4, 44, 258, 132, 'opinion', '支持率の推移（毎週の世論調査）。A：世論のくわしい内訳へ'),
      jump('ov_rs', 266, 44, 176, 132, 'opinion', '支持率がなぜ動いたか（理由ごとの寄与）。A：世論へ'),
      jump('ov_seat', 446, 44, 190, 132, 'diet', '衆参の議席（与党・過半数・3分の2）。A：国会の画面へ'),
      jump('ov_eco', 4, 180, 258, 82, 'network', '経済指標と最近の動き。A：政策と指標のつながり（政策マップ）へ'),
      jump('ov_reg', 266, 180, 176, 82, 'crisis', '体制と報道の自由度（ゲーム内の指標）。A：危機管理へ', 'regime'),
      jump('ov_crisis', 446, 180, 190, 82, d.war ? 'security' : 'crisis', 'いまの危機とデモ。A：くわしく'),
      jump('ov_voice', 4, 266, 300, 70, 'opinion', '最新の世論の声（架空の市民の声）。A：世論の声の一覧へ'),
    ];
    d.dead.forEach((r, i) => out.push(jump(`ov_dead${i}`, 309, 284 + i * 13, 326, 13, r.tab, `${r.k}：${r.t}`, r.sub)));
    return out;
  },
  draw(c, ui, d) {
    const g = ui.g, p = d.p;
    if (!p) return;
    // ---- A: approval trend
    {
      const x = 4, y = 44, w = 258, h = 132;
      const ap = d.approval;
      panel(c, x, y, w, h, '内閣支持率の推移', { right: `${ap}%${d.apDelta != null ? `（前回${d.apDelta >= 0 ? '▲' : '▼'}${Math.abs(d.apDelta)}）` : ''}`, rightColor: ap >= 50 ? K.good : ap >= 30 ? K.warn : K.bad });
      const cx = x + 24, cy = y + 22, cw = w - 30, ch = h - 42;
      R(c, cx, cy, cw, ch, '#07111b');
      for (const v of [0, 20, 40, 60, 80]) { const yy = cy + ch - 1 - Math.round((v / 80) * (ch - 1)); R(c, cx, yy, cw, 1, v === 0 ? K.faint : '#0e2131'); T(c, String(v), cx - 3, yy - 5, 10, K.faint, 'right'); }
      const y30 = cy + ch - 1 - Math.round((30 / 80) * (ch - 1));
      for (let i = 0; i < cw; i += 3) R(c, cx + i, y30, 1, 1, K.amberDk);
      spark(c, d.none, cx, cy, cw, ch, K.faint, { min: 0, max: 80, back: false });
      spark(c, d.series, cx, cy, cw, ch, ap >= 30 ? K.cyan : K.bad, { min: 0, max: 80, back: false });
      if (d.series.length < 2) T(c, '世論調査は毎週。まだ少ない', cx + cw / 2, cy + ch / 2 - 6, 12, K.dim, 'center', cw - 8);
      T(c, '━支持率', x + 6, y + h - 16, 10, K.cyan);
      T(c, '━支持なし', x + 60, y + h - 16, 10, K.faint);
      T(c, '┄30%', x + 124, y + h - 16, 10, K.amberDk);
      if (d.firstDay != null) T(c, safe(() => `${dateLabel(g, d.firstDay).replace(/上旬|中旬|下旬/, '')}〜`, ''), x + w - 6, y + h - 16, 10, K.faint, 'right', 90);
    }
    // ---- B: reasons
    {
      const x = 266, y = 44, w = 176, h = 132;
      panel(c, x, y, w, h, '支持率の内訳', { right: d.base ? `基礎 ${fmtN(d.base.value, 1)}` : '' });
      if (!d.reasons.length) para(c, d.ab ? 'いまは大きく動かす理由がない（基礎の評価だけ）。' : '（内訳は政府コアが読み込まれると表示される）', x + 6, y + 22, w - 12, 12, K.dim, 15, 4);
      d.reasons.forEach((r, i) => {
        const yy = y + 22 + i * 15;
        const lab = REASON_SHORT[r.id] || String(r.label).replace(/（.*$/, '');
        T(c, lab, x + 6, yy, 10, K.text, 'left', 76);
        cbar(c, x + 84, yy + 3, 50, 6, num(r.value) / 8);
        T(c, sgn(r.value, 1), x + w - 6, yy, 10, num(r.value) >= 0 ? K.good : K.bad, 'right', 38);
      });
    }
    // ---- C: seats
    {
      const x = 446, y = 44, w = 190, h = 132;
      const sd = d.seats;
      const nej = nejireOf(sd);
      panel(c, x, y, w, h, '議席', { right: nej ? 'ねじれ国会' : '与党／総数', rightColor: nej ? K.bad : K.dim });
      if (!sd) { T(c, '（議席の詳細は準備中）', x + 8, y + 26, 12, K.dim, 'left', w - 16); }
      else {
        [['shugi', '衆議院', x + 48], ['sangi', '参議院', x + 142]].forEach(([hk, name, hx]) => {
          const H = sd[hk];
          if (!H) return;
          drawHemi(c, hx, y + 76, 40, seatGroupsOf(H), H.total, { lines: [[H.majority, K.white], [H.twoThirds, K.amber]] });
          T(c, name, hx, y + 80, 10, K.dim, 'center');
          T(c, `与党 ${H.ruling}/${H.total}`, hx, y + 93, 12, H.rulingMajority ? K.text : K.bad, 'center', 90);
        });
        T(c, `│過半数 ${sd.shugi ? sd.shugi.majority : '—'}・${sd.sangi ? sd.sangi.majority : '—'}`, x + 6, y + h - 26, 10, K.white, 'left', w - 12);
        T(c, `│3分の2 ${sd.shugi ? sd.shugi.twoThirds : '—'}・${sd.sangi ? sd.sangi.twoThirds : '—'}`, x + 6, y + h - 14, 10, K.amber, 'left', w - 12);
      }
    }
    // ---- D: economy
    {
      const x = 4, y = 180, w = 258, h = 82;
      const E = d.eco;
      panel(c, x, y, w, h, '経済（シミュレーション）', { right: `GDP ${fmtN(E.gdp, 0)}兆円` });
      const tiles = [['成長率', pct(E.growth), 'growth', K.good], ['物価', pct(E.inflation), 'inflation', K.warn], ['失業率', pct(E.unemployment), 'unemployment', K.cyan], ['政府債務', `GDP比${fmtN(E.debtRatio, 0)}%`, 'debtRatio', K.bad], ['円相場', `${fmtN(E.yen, 0)}円/ドル`, 'yen', K.violet], ['株価', `${fmtN(E.nikkei, 0)}円`, 'nikkei', K.pink]];
      tiles.forEach(([lab, v, key, col], i) => {
        const tx = x + 4 + (i % 3) * 84, ty = y + 20 + Math.floor(i / 3) * 30;
        R(c, tx, ty, 82, 28, '#0a1824');
        T(c, lab, tx + 3, ty + 1, 10, K.dim, 'left', 40);
        T(c, v, tx + 3, ty + 13, 12, K.white, 'left', 78);
        spark(c, d.ecoHist(key), tx + 44, ty + 2, 36, 11, col, { back: false });
      });
    }
    // ---- E: regime & press
    {
      const x = 266, y = 180, w = 176, h = 82;
      const rg = d.regime, pf = d.press;
      panel(c, x, y, w, h, '体制・報道の自由度');
      if (!rg) T(c, '（体制のコアは準備中）', x + 6, y + 24, 12, K.dim, 'left', w - 12);
      else {
        const v = { democracy: 0.12, emergency: 0.5, dictatorship: 0.86, fallen: 1 }[rg.id] || 0;
        gauge(c, x + 44, y + 60, 30, v, K.cyan, { zones: [K.cyan, K.warn, K.bad] });
        T(c, rg.name, x + 44, y + 64, 10, rg.id === 'democracy' ? K.cyan : K.bad, 'center', 84);
        if (pf) {
          gauge(c, x + 128, y + 60, 30, pf.value / 100, K.good, { zones: [K.bad, K.warn, K.good] });
          T(c, `${pf.value}・${pf.label}`, x + 128, y + 64, 10, pf.value >= 60 ? K.good : pf.value >= 40 ? K.warn : K.bad, 'center', 84);
        }
        T(c, '体制', x + 44, y + 19, 10, K.dim, 'center');
        T(c, '報道の自由度', x + 128, y + 19, 10, K.dim, 'center');
      }
    }
    // ---- F: crisis
    {
      const x = 446, y = 180, w = 190, h = 82;
      const ds = d.disaster, wr = d.war;
      panel(c, x, y, w, h, '危機・デモ', { right: ds || wr ? '対応中' : '平時', rightColor: ds || wr ? K.bad : K.good });
      let yy = y + 20;
      if (wr) {
        T(c, `【戦争・もしも】${wr.enemyName}`, x + 6, yy, 12, K.bad, 'left', w - 12); yy += 14;
        T(c, `戦況：${wr.frontText}・死傷 ${fmtN(wr.cas.soldiers.dead + wr.cas.soldiers.wounded + wr.cas.civilians.dead + wr.cas.civilians.wounded)}人`, x + 6, yy, 10, K.text, 'left', w - 12); yy += 13;
      }
      if (ds) {
        T(c, `【災害】${ds.name}`, x + 6, yy, 12, K.warn, 'left', w - 12); yy += 14;
        T(c, `${ds.tierName}・避難 ${fmtN(ds.known.evac)}人・${ds.honbuName || '本部なし'}`, x + 6, yy, 10, K.text, 'left', w - 12); yy += 13;
      }
      if (!wr && !ds) { T(c, '大きな災害や有事はない', x + 6, yy, 12, K.dim, 'left', w - 12); yy += 15; }
      const dm = d.demos;
      if (dm.length) {
        const big = dm.slice().sort((a, b) => b.size - a.size)[0];
        T(c, `デモ ${dm.length}件：${big.cause}`, x + 6, yy, 10, K.pink, 'left', w - 12); yy += 12;
        T(c, `${big.place}・約${fmtN(big.size)}人`, x + 6, yy, 10, K.dim, 'left', w - 12);
      } else if (yy < y + h - 14) T(c, 'いま行われているデモはない', x + 6, yy, 10, K.faint, 'left', w - 12);
    }
    // ---- G: voices
    {
      const x = 4, y = 266, w = 300, h = 70;
      panel(c, x, y, w, h, '世論の声（架空の市民）', { right: 'A：一覧' });
      if (!d.voices.length) T(c, '（まだ声はない）', x + 6, y + 22, 12, K.dim);
      d.voices.slice(0, 2).forEach((v, i) => {
        const yy = y + 20 + i * 25;
        R(c, x + 5, yy, 3, 22, STANCE_COL[v.stance] || K.dim);
        T(c, `${v.header}・${v.event || ''}`, x + 12, yy, 10, K.dim, 'left', w - 18);
        T(c, `「${v.text}」`, x + 12, yy + 11, 12, K.text, 'left', w - 18);
      });
    }
    // ---- H: deadlines
    {
      const x = 308, y = 266, w = 328, h = 70;
      panel(c, x, y, w, h, '次の予定・期限');
      d.dead.forEach((r, i) => {
        const yy = y + 19 + i * 13;
        chip(c, x + 6, yy, r.k, r.k === '選挙' ? '#5a3a10' : r.k === '国会' ? '#2a2a5a' : r.k === '税制' ? '#4a2a3a' : '#1a3a3a', K.white, 10);
        const rw = r.r ? measure(c, r.r, 10) + 6 : 0;
        T(c, r.t, x + 40, yy, 10, K.text, 'left', w - 46 - rw);
        if (r.r) T(c, r.r, x + w - 6, yy, 10, K.amber, 'right');
      });
    }
  },
};

// ================================================================ tab 2: 予算・税
const BUDGET_SUBS = [{ id: 'budget', label: '予算（歳出）' }, { id: 'tax', label: '税制' }, { id: 'supp', label: '補正予算・予備費' }];
const REVENUE_COLORS = { shotoku: '#4f9be8', hojin: '#57c0d9', shohi: '#57d98a', sozoku: '#9ad06a', kihatsu: '#c8d06a', sake: '#d0b06a', tabako: '#b09070', sonotazei: '#7a8aa0', zeigai: '#a0a0c0', kosai: '#ff6470' };
const SPEND_COLORS = ['#ff9a5a', '#ff6470', '#e8c25a', '#9ad06a', '#4fd2e8', '#a78bfa', '#ff7eb6', '#7aa8ff', '#57d98a', '#c8a0ff', '#8a90a6', '#b0b8c8', '#ffcc4d'];
const SUPP_PURPOSES = ['経済対策', '災害復旧', '物価高対策', '防災・減災'];
const RESERVE_PURPOSE = [['disaster', '災害の復旧・被災者の支援'], ['prices', '物価高への緊急の対策'], ['health', '急な健康危機への対応'], ['other', '急を要するそのほかの経費']];
function budgetStep(v) { return v >= 20 ? 0.5 : v >= 5 ? 0.2 : 0.1; }
const TAB_BUDGET = {
  id: 'budget', label: '予算・税', short: '歳出・歳入・予算編成・税率・補正と予備費', lesson: 'yosan',
  tip: (ui) => (sub(ui) === 'tax' ? 'govt_tax' : 'govt_budget'),
  about: '一般会計の歳出・歳入、予算編成の流れ、税率（税制改正）、補正予算と予備費',
  terms: (ui) => (sub(ui) === 'tax' ? ['消費税', '所得税', '累進課税', '法人税', '軽減税率'] : sub(ui) === 'supp' ? ['補正予算', '予算', '国債'] : ['予算', '概算要求', '財務省原案', '国債', 'プライマリーバランス']),
  load(ui) {
    const g = ui.g;
    const d = {};
    d.b = has(g, 'budget') ? safe(() => g.budget(), null) : null;
    d.draft = has(g, 'budgetDraft') ? safe(() => g.budgetDraft(), null) : null;
    d.editWhy = d.draft ? d.draft.editable : has(g, 'govtRefusal') ? safe(() => g.govtRefusal('budget'), '') : '政府のしくみが読み込まれていない';
    d.taxes = has(g, 'taxRates') ? safe(() => g.taxRates(), []) : [];
    d.reform = has(g, 'taxReform') ? safe(() => g.taxReform(), null) : null;
    d.suppWhy = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('supplementary'), null) : '政府のしくみが読み込まれていない';
    d.resWhy = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('reserve'), null) : '政府のしくみが読み込まれていない';
    const p = polOf(g);
    d.session = !!(p && p.diet.session);
    d.role = ui.role0;
    // the rows of the 歳出 list: the draft when one is open, else this year's budget
    const sp = d.b ? d.b.spending.filter((x) => x.id !== 'midyear') : [];
    d.rows = d.draft ? d.draft.items.map((it) => ({ ...(sp.find((x) => x.id === it.id) || {}), ...it, value: it.draft, base: it.preview })) : sp.map((x) => ({ ...x, base: x.baseline, min: x.value, max: x.value }));
    return d;
  },
  layout(ui, d) {
    const st = ui.tabState();
    const out = segCtls(ui, BUDGET_SUBS, 4, 44);
    const g = ui.g;
    if (sub(ui) === 'budget') {
      st.edit = st.edit || {};
      const rows = d.rows;
      const editable = !!d.draft && !d.editWhy;
      out.push(listCtl(ui, 'brow', {
        id: 'brow', x: 4, y: 64, w: 318, h: 272, y0: 30, rowH: 18, n: rows.length,
        why: editable ? null : d.editWhy || '予算案の編成期間ではない',
        tip: (u) => { const r = rows[u.tabState().brow | 0]; return r ? `${r.name}：${r.fixedLabel || r.explain || ''}` : ''; },
        lr: (u, dir) => {
          const r = rows[u.tabState().brow | 0];
          if (!r || r.fixed === 'debt' || (r.min === r.max)) { u.toast('この費目は予算では変えられない', K.lock); return; }
          const cur = num(st.edit[r.id], r.value);
          st.edit[r.id] = Math.round(clamp(cur + dir * budgetStep(r.base || r.value), r.min, r.max) * 100) / 100;
        },
        a: async (u) => {
          const r = rows[u.tabState().brow | 0];
          if (!r) return;
          const v = num(st.edit[r.id], r.value);
          if (Math.abs(v - r.value) < 0.005) { u.toast('←→で金額を変えてから A で決める', K.dim); return; }
          const res = safe(() => g.setBudget(r.id, v), null);
          if (res && res.ok) delete st.edit[r.id];
          await u.result('予算の配分', res);
        },
      }));
    } else if (sub(ui) === 'tax') {
      st.target = st.target || {};
      const taxes = d.taxes;
      const rowWhy = (t, v) => (has(g, 'govtRefusal') ? safe(() => g.govtRefusal('tax', { id: t.id, value: v }), null) : '政府のしくみが読み込まれていない');
      out.push(listCtl(ui, 'trow', {
        id: 'trow', x: 4, y: 64, w: 318, h: 214, y0: 30, rowH: 26, n: taxes.length,
        why: (() => { const t = taxes[st.trow | 0]; return t ? rowWhy(t, null) : null; })(),
        tip: (u) => { const t = taxes[u.tabState().trow | 0]; return t ? `${t.name}：${t.kind}。←→で目標の税率、Aで税制改正を提案` : ''; },
        lr: (u, dir) => {
          const t = taxes[u.tabState().trow | 0];
          if (!t) return;
          const cur = num(st.target[t.id], t.rate);
          st.target[t.id] = Math.round(clamp(cur + dir * t.step, t.min, t.max) * 100) / 100;
        },
        a: (u) => taxProposal(u, d, taxes[u.tabState().trow | 0]),
      }));
      out.push(btn({ id: 'tax_pipeline', x: 4, y: 282, w: 318, h: 54, kind: 'panel', why: null, tip: '税制改正の流れ（与党税調 → 税制改正大綱 → 法案 → 施行）', a: (u) => u.info('税制改正の流れ', taxProcessLines(u.g, d)) }));
    } else {
      st.supp = st.supp || { amount: 10, purpose: 0 };
      const left = d.b && d.b.reserve ? num(d.b.reserve.left) : 0;
      st.res = st.res || { amount: Math.max(0.1, Math.min(0.5, Math.floor(left * 10) / 10)), purpose: 0 };
      out.push(btn({ id: 'supp_amount', x: 10, y: 116, w: 300, h: 18, label: '', why: d.suppWhy, tip: '補正予算の規模（2〜40兆円）。←→で変える', lr: (u, dir) => { st.supp.amount = clamp(st.supp.amount + dir * 2, 2, 40); }, a: null }));
      out.push(btn({ id: 'supp_purpose', x: 10, y: 138, w: 300, h: 18, label: '', why: d.suppWhy, tip: '補正予算の目的。←→で変える', lr: (u, dir) => { st.supp.purpose = (st.supp.purpose + dir + SUPP_PURPOSES.length) % SUPP_PURPOSES.length; }, a: null }));
      out.push(btn({ id: 'supp_go', x: 10, y: 162, w: 300, h: 20, label: '補正予算案を閣議決定して国会へ', why: d.suppWhy, color: K.amber, tip: '補正予算は内閣がつくり、国会の議決で成立する（憲法86条）', a: (u) => suppFlow(u, d) }));
      out.push(btn({ id: 'res_amount', x: 328, y: 116, w: 300, h: 18, label: '', why: d.resWhy, tip: '予備費から使う額。←→で変える', lr: (u, dir) => { st.res.amount = Math.round(clamp(st.res.amount + dir * 0.1, 0.1, Math.max(0.1, Math.floor(left * 10) / 10)) * 10) / 10; }, a: null }));
      out.push(btn({ id: 'res_purpose', x: 328, y: 138, w: 300, h: 18, label: '', why: d.resWhy, tip: '予備費の目的。←→で変える', lr: (u, dir) => { st.res.purpose = (st.res.purpose + dir + RESERVE_PURPOSE.length) % RESERVE_PURPOSE.length; }, a: null }));
      out.push(btn({ id: 'res_go', x: 328, y: 162, w: 300, h: 20, label: '予備費の使用を閣議決定する', why: d.resWhy, color: K.amber, tip: '予備費は、国会の承諾をあとで得る（憲法87条）', a: (u) => reserveFlow(u, d) }));
    }
    return out;
  },
  draw(c, ui, d) {
    const st = ui.tabState();
    drawSegs(c, ui, BUDGET_SUBS);
    const b = d.b;
    if (!b) { panel(c, 4, 64, 632, 272, '予算'); para(c, '予算の詳細（政府コア govt.js）が読み込まれていない。', 12, 88, 600, 12, K.dim); return; }
    T(c, `${b.fy}年度 一般会計 ${cho(b.total)}・${b.stageLabel || ''}${b.provisional ? '（暫定予算）' : ''}`, 636, 47, 12, K.cyan, 'right', 300);
    if (sub(ui) === 'budget') drawBudgetSub(c, ui, d, st);
    else if (sub(ui) === 'tax') drawTaxSub(c, ui, d, st);
    else drawSuppSub(c, ui, d, st);
  },
};
function drawBudgetSub(c, ui, d, st) {
  const b = d.b;
  const rows = d.rows;
  const k = ui.ctls.find((q) => q.id === 'brow');
  panel(c, 4, 64, 318, 272, d.draft ? `${d.draft.fy}年度 予算案（編成中）` : '歳出（費目別）', { right: d.draft ? `案 ${cho(d.draft.total)}` : '当初予算・基準との差' });
  T(c, '費目', 10, 82, 10, K.faint); T(c, '金額', 222, 82, 10, K.faint, 'right'); T(c, '基準比', 316, 82, 10, K.faint, 'right');
  const total = Math.max(1, rows.reduce((a, r) => a + num(r.value), 0));
  drawList(c, ui, k, (c2, i, x, y, w, rh, sel) => {
    const r = rows[i];
    const v = num(st.edit && st.edit[r.id], r.value);
    const edited = st.edit && st.edit[r.id] != null && Math.abs(st.edit[r.id] - r.value) > 0.005;
    const col = SPEND_COLORS[i % SPEND_COLORS.length];
    R(c2, x + 5, y + 4, 4, 10, col);
    T(c2, r.name, x + 12, y + 2, 12, r.fixed === 'debt' ? K.dim : K.text, 'left', 126);
    const vs = `${sel && !k.why ? '◀ ' : ''}${fmtN(v, 2)}兆${sel && !k.why ? ' ▶' : ''}`;
    T(c2, vs, x + 218, y + 2, 12, edited ? K.amber : K.white, 'right', 82);
    hbar(c2, x + 224, y + 7, 40, 5, v / total * 3, col);
    const dv = v - num(r.base, v);
    T(c2, Math.abs(dv) < 0.005 ? '±0' : sgn(dv, 2), x + w - 4, y + 4, 10, dv > 0 ? K.warn : dv < 0 ? K.cyan : K.faint, 'right', 44);
  });
  // ---- the right column: revenue / spending bars, the selected item, the calendar
  const x = 326, w = 310;
  panel(c, x, 64, w, 94, '歳入と歳出', { right: `公債依存度 ${pct(b.bondRatio)}` });
  const bw = w - 54;
  const bar = (yy, label, parts, tot) => {
    T(c, label, x + 6, yy, 10, K.dim);
    let bx = x + 46;
    for (const pt of parts) { const ww = Math.max(0, Math.round((pt.v / Math.max(1e-9, tot)) * bw)); if (ww > 0) R(c, bx, yy, Math.min(ww, x + 46 + bw - bx), 10, pt.col); bx += ww; }
  };
  const revTotal = b.revenue.reduce((a, r) => a + num(r.value), 0);
  bar(84, '歳入', b.revenue.map((r) => ({ v: num(r.value), col: REVENUE_COLORS[r.id] || '#8a90a6' })), revTotal);
  bar(98, d.draft ? '歳出案' : '歳出', rows.map((r, i) => ({ v: num(st.edit && st.edit[r.id], r.value), col: SPEND_COLORS[i % SPEND_COLORS.length] })), total);
  const lg = [['税収', `${cho(b.tax)}`, K.cyan], ['税外', cho(b.nontax), '#a0a0c0'], ['公債金', cho(b.bonds), K.bad]];
  lg.forEach(([a, v, col], i) => { R(c, x + 8 + i * 100, 116, 6, 6, col); T(c, `${a} ${v}`, x + 17 + i * 100, 113, 10, K.text, 'left', 88); });
  T(c, `PB ${sgn(b.primaryBalance, 1)}兆円・政府債務 GDP比${fmtN(b.debtRatio, 0)}%`, x + 8, 128, 10, K.dim, 'left', w - 16);
  T(c, '※開始年度は実際の当初予算、その後はシミュレーション', x + 8, 141, 10, K.faint, 'left', w - 16);
  // selected item
  const r = rows[st.brow | 0];
  panel(c, x, 162, w, 106, r ? r.name : '費目', { right: r ? r.ministry || '' : '' });
  if (r) {
    let yy = para(c, r.explain || '', x + 6, 182, w - 12, 10, K.text, 12, 3) + 2;
    const v = num(st.edit && st.edit[r.id], r.value);
    const dv = v - num(r.value);
    const B = GV && GV.BUDGET_ITEMS && GV.BUDGET_ITEMS[r.id];
    if (Math.abs(dv) > 0.005 && B) {
      const segs = Object.entries(B.seg || {}).map(([s, w2]) => [s, num(w2) * dv]).filter(([, v2]) => Math.abs(v2) > 0.02).sort((a, b2) => Math.abs(b2[1]) - Math.abs(a[1])).slice(0, 4);
      T(c, `この変更（${sgn(dv, 2)}兆円）の見込み：`, x + 6, yy, 10, K.amber, 'left', w - 12); yy += 12;
      T(c, segs.map(([s, v2]) => `${SEG_SHORT[s] || s}${v2 > 0 ? '↑' : '↓'}`).join(' ') + (B.eco && B.eco.growth ? `・景気${num(B.eco.growth) * dv > 0 ? '↑' : '↓'}` : '') + `・国債${dv > 0 ? '↑' : '↓'}`, x + 6, yy, 10, K.text, 'left', w - 12); yy += 13;
    } else {
      T(c, `賛成：${(r.pro || [])[0] || '—'}`, x + 6, yy, 10, K.good, 'left', w - 12); yy += 12;
      T(c, `反対：${(r.con || [])[0] || '—'}`, x + 6, yy, 10, K.bad, 'left', w - 12); yy += 12;
    }
    if (yy < 262) T(c, d.draft ? `範囲 ${fmtN(r.min, 2)}〜${fmtN(r.max, 2)}兆円（前年なみ ${fmtN(r.base, 2)}）` : r.fixedLabel || '', x + 6, yy, 10, K.faint, 'left', w - 12);
  }
  // calendar
  panel(c, x, 272, w, 64, '予算編成の流れ', { right: b.stageLabel || '' });
  const cal = b.calendar || [];
  const n = Math.max(1, cal.length);
  const step = (w - 60) / Math.max(1, n - 1);
  R(c, x + 30, 292, w - 60, 1, K.edge);
  const SHORT = CAL_SHORT(b.fy);
  const nextIdx = cal.findIndex((q) => !q.done);
  cal.forEach((s, i) => {
    const cx2 = x + 30 + Math.round(i * step);
    disc(c, cx2, 292, 3, s.done ? K.good : i === nextIdx ? K.amber : K.ghost);
    T(c, SHORT[s.step] || s.label, cx2, i % 2 ? 308 : 297, 10, i === nextIdx ? K.amber : s.done ? K.text : K.faint, 'center', step * 2 - 4);
  });
  const nx = cal[nextIdx];
  T(c, nx ? `つぎ：${nx.label}（${nx.when}）` : '今年度の予算は成立している', x + 6, 321, 10, K.amber, 'left', w - 12);
  if (k && k.why && ui.focus === 'body' && ui.cur.budget === 'brow') { /* the footer shows the reason */ }
}
function taxProcessLines(g, d) {
  const tr = d.reform;
  const out = ['税率は、毎年の税制改正で変わる：', '① 与党の税制調査会が議論（秋〜12月）', '② 税制改正大綱（12月中旬）', '③ 「所得税法等の一部を改正する法律案」を1月の通常国会へ', '④ 成立すれば4月1日から施行（住民税は6月）', ''];
  if (tr) {
    out.push(`いまの段階：${REFORM_STAGE[tr.stage] || 'とくになし'}`);
    for (const pl of (tr.plan || []).slice(0, 3)) out.push(`予定：${(GV && GV.TAXES && GV.TAXES[pl.id] ? GV.TAXES[pl.id].short : pl.id)} → ${pl.rate}（${pl.year}年${pl.month}月）${pl.why ? `・${pl.why}` : ''}`);
    for (const l of (tr.log || []).slice(-3)) out.push(`・${typeof l === 'string' ? l : l.text || ''}`);
  }
  return out;
}
async function taxProposal(ui, d, t) {
  if (!t) return;
  const g = ui.g;
  const st = ui.tabState();
  const v = num(st.target && st.target[t.id], t.rate);
  if (Math.abs(v - t.rate) < 1e-6) { ui.toast('←→で目標の税率を決めてから A', K.dim); return; }
  const why = safe(() => g.govtRefusal('tax', { id: t.id, value: v }), null);
  if (why) { await ui.info(`${t.name}：いまは提案できない`, [why], { color: K.lock }); return; }
  const nowWhy = safe(() => g.govtRefusal('tax', { id: t.id, value: v, now: true }), null);
  const lines = [
    `${t.name}を ${t.rate}${t.unit} → ${v}${t.unit} にする税制改正を提案する。`,
    `【賛成の声】${(t.pro || []).slice(0, 2).join('／') || '—'}`,
    `【反対の声】${(t.con || []).slice(0, 2).join('／') || '—'}`,
    '流れ：与党税調 → 税制改正大綱（12月）→ 法案（1月の国会）→ 施行（4月）。税調が認めないこともある。',
  ];
  const choices = ['与党税調に提案する', nowWhy ? '臨時の税制改正（いまはできない）' : '臨時の税制改正法案を今国会に出す', 'やめる'];
  const k = await ui.confirm({ title: `税制改正：${t.name}`, lines, choices, index: 0, cancel: 2, w: 480 });
  if (k === 0) { const r = safe(() => g.setTaxRate(t.id, v), null); if (r && r.ok) delete st.target[t.id]; await ui.result('税制改正の提案', r); }
  else if (k === 1) {
    if (nowWhy) { await ui.info('臨時の税制改正', [nowWhy], { color: K.lock }); return; }
    const r = safe(() => g.setTaxRate(t.id, v, { now: true }), null);
    if (r && r.ok) delete st.target[t.id];
    await ui.result('臨時の税制改正', r);
  }
}
function drawTaxSub(c, ui, d, st) {
  const taxes = d.taxes;
  const k = ui.ctls.find((q) => q.id === 'trow');
  panel(c, 4, 64, 318, 214, '税率（国税・地方税）', { right: '←→：目標 A：提案' });
  T(c, '税', 10, 82, 10, K.faint); T(c, 'いま', 196, 82, 10, K.faint, 'right'); T(c, '目標・予定', 316, 82, 10, K.faint, 'right');
  drawList(c, ui, k, (c2, i, x, y, w, rh, sel) => {
    const t = taxes[i];
    const v = num(st.target && st.target[t.id], t.rate);
    const changed = Math.abs(v - t.rate) > 1e-6;
    T(c2, t.short || t.name, x + 8, y + 2, 12, K.text, 'left', 110);
    T(c2, t.local ? '地方税' : t.kind ? String(t.kind).replace(/（.*$/, '') : '', x + 8, y + 14, 10, K.faint, 'left', 110);
    T(c2, t.id === 'shohi' && !(num(t.rate) > 0) ? 'なし' : `${fmtN(t.rate, t.step < 1 ? 2 : 0)}${t.unit}`, x + 192, y + 2, 12, K.white, 'right', 70);
    if (t.reduced) T(c2, `軽減${t.reduced}%`, x + 192, y + 14, 10, K.faint, 'right', 70);
    let right = '';
    if (sel || changed) right = `${sel ? '◀ ' : ''}${fmtN(v, t.step < 1 ? 2 : 0)}${t.unit}${sel ? ' ▶' : ''}`;
    else if (t.pending && t.pending.length) right = `→${t.pending[0].rate}（${t.pending[0].year}.${t.pending[0].month}）`;
    else if (t.proposal) right = `提案中 ${t.proposal.rate}`;
    T(c2, right, x + w - 4, y + 2, 12, changed ? K.amber : K.cyan, 'right', 110);
    if (t.rejected != null) T(c2, `税調が見送り：${t.rejected}`, x + w - 4, y + 14, 10, K.bad, 'right', 110);
    else if (t.revenue != null) T(c2, `税収 ${cho(t.revenue)}`, x + w - 4, y + 14, 10, K.faint, 'right', 110);
  });
  // the pipeline (与党税調 → 大綱 → 法案 → 施行)
  const tr = d.reform;
  const pk = ui.ctls.find((q) => q.id === 'tax_pipeline');
  panel(c, pk.x, pk.y, pk.w, pk.h, '税制改正の流れ', { right: 'A：くわしく' });
  const stages = [['chosakai', '与党税調'], ['taiko', '大綱（12月）'], ['bill', '法案（国会）'], ['enacted', '施行（4月）']];
  const at = tr ? { idle: -1, none: -1, failed: -1, chosakai: 0, taiko: 1, bill: 2, enacted: 3 }[tr.stage] : -1;
  stages.forEach(([, lab], i) => {
    const bx = pk.x + 8 + i * 77;
    frame(c, bx, pk.y + 22, 70, 16, i === at ? '#3a2a0a' : i < at ? '#0f2a1a' : '#0b1621', i === at ? K.amber : i < at ? K.good : K.edge);
    T(c, lab, bx + 35, pk.y + 24, 10, i === at ? K.amber : i < at ? K.good : K.dim, 'center', 66);
    if (i < 3) T(c, '→', bx + 73, pk.y + 24, 10, K.faint, 'center');
  });
  T(c, tr ? REFORM_STAGE[tr.stage] || 'いまは税制改正の動きはない' : '（税制のコアは準備中）', pk.x + 8, pk.y + 40, 10, K.text, 'left', pk.w - 16);
  // the selected tax
  const t = taxes[st.trow | 0];
  const x = 326, w = 310;
  const notYet = t && t.id === 'shohi' && !(num(t.rate) > 0);
  panel(c, x, 64, w, 272, t ? t.name : '税', { right: notYet ? 'この時代にはまだない' : '' });
  if (!t) return;
  let yy = notYet ? 84 : para(c, `根拠：${t.law || '—'}`, x + 6, 84, w - 12, 10, K.cyan, 12, 1) + 1;
  yy = para(c, t.explain || '', x + 6, yy, w - 12, 10, K.text, 12, 4) + 2;
  if (t.note) yy = para(c, `※${t.note}`, x + 6, yy, w - 12, 10, K.faint, 12, 2) + 2;
  // the rate's history (a step chart)
  const hist = (t.history || []).filter((h) => Number.isFinite(num(h.rate, NaN)));
  const chY = yy + 4, chH = 58, chX = x + 30, chW = w - 40;
  R(c, chX, chY, chW, chH, '#07111b');
  if (hist.length) {
    const y0 = Math.min(...hist.map((h) => h.year)), y1 = Math.max(yearOf(ui.g), ...hist.map((h) => h.year)) + 1;
    const vals = [...hist.map((h) => num(h.rate)), t.rate];
    const mx = Math.max(...vals) * 1.15 || 1;
    const px = (yr) => chX + Math.round(((yr - y0) / Math.max(1, y1 - y0)) * (chW - 2));
    const py = (v) => chY + chH - 2 - Math.round((v / mx) * (chH - 6));
    for (let i = 0; i < hist.length; i++) {
      const a = hist[i], nx = hist[i + 1];
      const xa = px(a.year + (a.month - 1) / 12), xb = nx ? px(nx.year + (nx.month - 1) / 12) : px(y1);
      R(c, xa, py(a.rate), Math.max(1, xb - xa), 2, K.cyan);
      if (nx) R(c, xb, Math.min(py(a.rate), py(nx.rate)), 1, Math.abs(py(a.rate) - py(nx.rate)) + 2, K.cyan);
    }
    T(c, String(y0), chX, chY + chH + 1, 10, K.faint);
    T(c, String(y1 - 1), chX + chW, chY + chH + 1, 10, K.faint, 'right');
    T(c, fmtN(mx / 1.15, 0), chX - 3, chY, 10, K.faint, 'right');
  } else T(c, '（推移のデータはない）', chX + 6, chY + 20, 10, K.dim);
  yy = chY + chH + 14;
  T(c, '賛成の声', x + 6, yy, 10, K.good); yy += 12;
  for (const s of (t.pro || []).slice(0, 2)) { yy = para(c, `・${s}`, x + 6, yy, w - 12, 10, K.text, 12, 2); }
  T(c, '反対の声', x + 6, yy + 2, 10, K.bad); yy += 14;
  for (const s of (t.con || []).slice(0, 2)) { if (yy > 320) break; yy = para(c, `・${s}`, x + 6, yy, w - 12, 10, K.text, 12, 2); }
}
async function suppFlow(ui, d) {
  const g = ui.g;
  const st = ui.tabState();
  const purpose = SUPP_PURPOSES[st.supp.purpose];
  const k = await ui.confirm({ title: '補正予算案', lines: [`${purpose}・${st.supp.amount}兆円の補正予算案を閣議決定し、国会に出す。`, '【賛成の声】景気や被災地をすぐに支えられる', '【反対の声】国債が増え、将来の負担になる・ばらまきとの批判', '国会で可決されて成立する（衆議院が先に審議）。'], choices: ['閣議決定して国会に出す', 'やめる'], cancel: 1 });
  if (k !== 0) return;
  await ui.result('補正予算', safe(() => g.supplementaryBudget({ amount: st.supp.amount, purpose }), null), '補正予算案を国会に出した');
}
async function reserveFlow(ui, d) {
  const g = ui.g;
  const st = ui.tabState();
  const [pid, plab] = RESERVE_PURPOSE[st.res.purpose];
  const k = await ui.confirm({ title: '予備費の使用', lines: [`予備費から${fmtN(st.res.amount, 1)}兆円を「${plab}」に使う。`, '予備費は、予想できない支出のために予算に入れておくお金。使ったあとで国会の承諾を求める（憲法87条）。'], choices: ['閣議決定する', 'やめる'], cancel: 1 });
  if (k !== 0) return;
  await ui.result('予備費', safe(() => g.useReserve(st.res.amount, pid), null));
}
function drawSuppSub(c, ui, d, st) {
  const b = d.b;
  const g = ui.g;
  // 補正予算
  panel(c, 4, 64, 314, 272, '補正予算', { right: '内閣が国会に出す' });
  para(c, '年度の途中で、景気対策や災害の復旧などに追加の予算を組むのが補正予算。財源の多くは国債。', 10, 84, 300, 10, K.text, 12, 2);
  const k1 = ui.ctls.find((q) => q.id === 'supp_amount'), k2 = ui.ctls.find((q) => q.id === 'supp_purpose');
  const valRow = (k, lab, val) => { if (!k) return; frame(c, k.x, k.y, k.w, k.h, '#0b1621', k.why ? K.ghost : K.edge); T(c, lab, k.x + 6, k.y + 3, 12, k.why ? K.faint : K.dim); T(c, `◀ ${val} ▶`, k.x + k.w - 6, k.y + 3, 12, k.why ? K.faint : K.amber, 'right', 180); if (k.why) padlock(c, k.x + k.w - 200, k.y + 5); };
  valRow(k1, '規模', `${st.supp.amount}兆円`);
  valRow(k2, '目的', SUPP_PURPOSES[st.supp.purpose]);
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'supp_go'), { center: true, color: K.amber });
  T(c, 'これまでの補正予算', 10, 190, 10, K.amber);
  const sp = (b.supplementary || []).slice(-7).reverse();
  if (!sp.length) T(c, 'この年度の補正予算はまだない', 10, 204, 10, K.dim, 'left', 300);
  sp.forEach((s, i) => T(c, `${s.title || `${s.purpose}・${s.amount}兆円`}　${s.status === 'passed' || s.passed ? '成立' : s.status === 'rejected' ? '否決' : '審議中'}`, 10, 204 + i * 13, 10, K.text, 'left', 300));
  if (d.suppWhy) para(c, `🔒 ${d.suppWhy}`, 10, 300, 300, 10, K.lock, 12, 3);
  // 予備費
  const R0 = b.reserve || { total: 0, used: 0, left: 0, list: [] };
  panel(c, 322, 64, 314, 272, '予備費', { right: `残り ${cho(R0.left)}／${cho(R0.total)}` });
  para(c, '予備費は、災害などの予想できない支出にそなえて予算に入れておくお金。内閣の判断で使い、あとで国会の承諾を得る（憲法87条）。', 328, 84, 302, 10, K.text, 12, 2);
  hbar(c, 330, 110, 296, 3, R0.total ? R0.left / R0.total : 0, K.teal);
  valRow(ui.ctls.find((q) => q.id === 'res_amount'), '金額', `${fmtN(st.res.amount, 1)}兆円`);
  valRow(ui.ctls.find((q) => q.id === 'res_purpose'), '目的', RESERVE_PURPOSE[st.res.purpose][1]);
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'res_go'), { center: true, color: K.amber });
  T(c, '使った予備費', 328, 190, 10, K.amber);
  const used = (R0.list || []).slice(-7).reverse();
  if (!used.length) T(c, 'まだ使っていない', 328, 204, 10, K.dim);
  used.forEach((u, i) => T(c, `${fmtN(u.amount, 1)}兆円・${u.label || u.purpose}`, 328, 204 + i * 13, 10, K.text, 'left', 300));
  if (d.resWhy) para(c, `🔒 ${d.resWhy}`, 328, 300, 302, 10, K.lock, 12, 3);
  void g;
}

// ================================================================ tab 3: 政策マップ (a node graph: policies ↔ indicators ↔ voters)
// The links are the cores' own numbers: a law's economy / segment effects (politics.js POLICIES effects, kept in
// p.laws) and policyPreview for laws in force at the era start and for bills. 財政 = the yearly cost (兆円).
const IND_DEFS = [
  { id: 'growth', name: '成長率', good: 1, fmt: (E) => pct(E.growth), scale: 0.25 },
  { id: 'inflation', name: '物価', good: -1, fmt: (E) => pct(E.inflation), scale: 0.25 },
  { id: 'unemployment', name: '失業率', good: -1, fmt: (E) => pct(E.unemployment), scale: 0.15 },
  { id: 'yen', name: '円相場', good: 0, fmt: (E) => `${fmtN(E.yen, 0)}円`, scale: 3 },
  { id: 'nikkei', name: '株価', good: 1, fmt: (E) => `${fmtN(E.nikkei, 0)}円`, scale: 3 },
  { id: 'fiscal', name: '財政', good: -1, fmt: (E) => `債務${fmtN(E.debtRatio, 0)}%`, scale: 1.5 },
];
const NET_FILTERS = [{ id: 'all', label: 'すべて' }, { id: 'law', label: '施行中' }, { id: 'bill', label: '審議中' }];
const NET_PAGE = 15;
const NET = { x: 4, y: 64, w: 424, h: 272, px: 8, pw: 132, ix: 182, iw: 74, sx: 330, sw: 90 };
const STAGE_JA = { draft: '準備中', committee: '委員会', shugi: '衆・本会議', sangi: '参・本会議', referendum: '国民投票', enacted: '成立', rejected: '否決', shelved: '廃案' };
function netPolicies(g, p, filter) {
  const out = [];
  const seen = new Set();
  if (filter !== 'bill') {
    for (const L of (p.laws || []).slice().reverse()) {
      if (!L || seen.has(L.policy) || !POLICIES[L.policy]) continue;
      seen.add(L.policy);
      out.push({ key: `l_${L.policy}`, id: L.policy, name: POLICIES[L.policy].name, status: 'law', since: safe(() => polDate(g, L.day).year, null), eco: L.economy || {}, seg: L.segments || {}, cost: num(L.cost), title: L.title });
    }
    for (const [id, yr] of Object.entries((p.flags && p.flags.inForce) || {})) {
      if (seen.has(id) || !POLICIES[id]) continue;
      seen.add(id);
      const pv = safe(() => g.policyPreview(id), null) || {};
      out.push({ key: `l_${id}`, id, name: POLICIES[id].name, status: 'law', since: yr, eco: pv.economy || {}, seg: pv.segments || {}, cost: num(pv.cost), title: POLICIES[id].name, era: true });
    }
  }
  if (filter !== 'law') {
    for (const b of p.diet.bills || []) {
      if (!b.policy || !POLICIES[b.policy] || ['enacted', 'rejected', 'shelved'].includes(b.stage)) continue;
      const pv = safe(() => g.policyPreview(b.policy, b.params), null) || {};
      out.push({ key: `b_${b.id}`, id: b.policy, name: POLICIES[b.policy].name, status: 'bill', stage: b.stage, eco: pv.economy || {}, seg: pv.segments || {}, cost: num(pv.cost), title: b.title, bill: b, align: pv.alignment || {} });
    }
  }
  return out;
}
function edgesOf(pl) {
  const out = [];
  for (const I of IND_DEFS) {
    const v = I.id === 'fiscal' ? num(pl.cost) : num(pl.eco[I.id]);
    if (Math.abs(v) < (I.id === 'fiscal' ? 0.05 : I.id === 'yen' || I.id === 'nikkei' ? 0.5 : 0.02)) continue;
    const good = I.good === 0 ? 0 : Math.sign(v) * I.good;
    out.push({ to: `i_${I.id}`, v, s: clamp(Math.abs(v) / I.scale, 0.2, 1), col: good > 0 ? K.good : good < 0 ? K.bad : K.violet });
  }
  for (const s of SEGMENT_ORDER) {
    const v = num(pl.seg[s]);
    if (Math.abs(v) < 0.3) continue;
    out.push({ to: `s_${s}`, v, s: clamp(Math.abs(v) / 4, 0.2, 1), col: v > 0 ? K.good : K.bad });
  }
  return out;
}
let NETCV = null;
function bakeEdges(nodes, edges) {
  const [cv, x] = NETCV && NETCV[0].width === NET.w ? NETCV : makeCanvas(NET.w, NET.h);
  NETCV = [cv, x];
  x.clearRect(0, 0, NET.w, NET.h);
  for (const e of edges) {
    const a = nodes[e.from], b = nodes[e.to];
    if (!a || !b) continue;
    line(x, a.x + a.w - NET.x, a.y + a.h / 2 - NET.y, b.x - NET.x, b.y + b.h / 2 - NET.y, shade(e.col, -0.62));
  }
  return cv;
}
const TAB_NETWORK = {
  id: 'network', label: '政策マップ', short: '政策→指標・有権者のつながり（緑＋・赤−）', lesson: 'houritsu',
  tip: 'govt_network',
  about: '施行中・審議中の政策が、経済の指標と有権者の層にどう効くか（線の色：緑＝プラス・赤＝マイナス、太さ＝強さ）',
  terms: ['法律案', '閣法', '議員立法', '景気', 'インフレ'],
  load(ui) {
    const g = ui.g, p = polOf(g);
    const st = ui.tabState();
    const filter = st.filter || 'all';
    const all = netPolicies(g, p, filter);
    const pages = Math.max(1, Math.ceil(all.length / NET_PAGE));
    st.page = clamp(num(st.page, 0), 0, pages - 1);
    const pols = all.slice(st.page * NET_PAGE, st.page * NET_PAGE + NET_PAGE);
    const nodes = {};
    pols.forEach((pl, i) => { nodes[pl.key] = { x: NET.x + NET.px, y: NET.y + 20 + i * 15, w: NET.pw, h: 13, pl }; });
    IND_DEFS.forEach((I, i) => { nodes[`i_${I.id}`] = { x: NET.x + NET.ix, y: NET.y + 26 + i * 40, w: NET.iw, h: 26, I }; });
    SEGMENT_ORDER.forEach((s, i) => { nodes[`s_${s}`] = { x: NET.x + NET.sx, y: NET.y + 20 + i * 22, w: NET.sw, h: 18, s }; });
    const edges = [];
    for (const pl of pols) for (const e of edgesOf(pl)) edges.push({ from: pl.key, ...e });
    const ab = has(g, 'approvalBreakdown') ? safe(() => g.approvalBreakdown(), null) : null;
    const W = safe(() => segWeights(yearOf(g)), {}) || {};
    return { p, all, pols, pages, nodes, edges, cv: bakeEdges(nodes, edges), bySeg: ab ? ab.bySegment || [] : [], W, eco: p.economy, filter };
  },
  layout(ui, d) {
    const st = ui.tabState();
    const out = [];
    let x = 4;
    for (const f of NET_FILTERS) {
      const w = (ui.g.ctx ? measure(ui.g.ctx, f.label, 12) : 36) + 16;
      out.push({ kind: 'seg', id: `nf_${f.id}`, x, y: 44, w, h: 17, why: null, tip: `表示：${f.label}の政策`, a: (u) => { u.tabState().filter = f.id; u.tabState().page = 0; u.dirty(); } });
      x += w + 2;
    }
    out.push({ kind: 'btn', id: 'np_prev', x: x + 8, y: 44, w: 54, h: 17, label: '▲前', why: st.page > 0 ? null : '最初のページ', tip: '前のページの政策', a: (u) => { u.tabState().page--; u.dirty(); } });
    out.push({ kind: 'btn', id: 'np_next', x: x + 64, y: 44, w: 54, h: 17, label: '▼次', why: st.page < d.pages - 1 ? null : '最後のページ', tip: '次のページの政策', a: (u) => { u.tabState().page++; u.dirty(); } });
    for (const [key, n] of Object.entries(d.nodes)) {
      const tip = n.pl ? `${n.pl.name}（${n.pl.status === 'law' ? `施行中${n.pl.since ? `・${n.pl.since}年から` : ''}` : `審議中：${STAGE_JA[n.pl.stage] || n.pl.stage}`}）` : n.I ? `${n.I.name}：いま ${n.I.fmt(d.eco)}` : `${SEGMENTS[n.s] ? SEGMENTS[n.s].name : n.s}の受けとめ`;
      out.push({ kind: 'node', id: `n_${key}`, x: n.x, y: n.y, w: n.w, h: n.h, why: null, tip, a: (u) => { u.tabState().node = key; } });
    }
    return out;
  },
  draw(c, ui, d) {
    const st = ui.tabState();
    // filters
    for (const f of NET_FILTERS) {
      const k = ui.ctls.find((q) => q.id === `nf_${f.id}`);
      if (!k) continue;
      const on = (st.filter || 'all') === f.id;
      frame(c, k.x, k.y, k.w, k.h, on ? '#1d4a64' : '#0b1621', on ? K.cyan : K.edge);
      T(c, f.label, k.x + k.w / 2, k.y + 2, 12, on ? K.white : K.dim, 'center');
    }
    drawBtn(c, ui, ui.ctls.find((q) => q.id === 'np_prev'), { center: true });
    drawBtn(c, ui, ui.ctls.find((q) => q.id === 'np_next'), { center: true });
    T(c, `${d.all.length}件・${st.page + 1}/${d.pages}ページ`, 428, 47, 10, K.dim, 'right', 120);
    panel(c, NET.x, NET.y, NET.w, NET.h, null);
    T(c, '政策', NET.x + NET.px, NET.y + 5, 10, K.amber);
    T(c, '指標', NET.x + NET.ix, NET.y + 5, 10, K.amber);
    T(c, '有権者の層', NET.x + NET.sx, NET.y + 5, 10, K.amber);
    c.drawImage(d.cv, NET.x, NET.y);
    // the focused (or last chosen) node and its links
    const fk = ui.focus === 'body' && String(ui.cur.network || '').startsWith('n_') ? ui.cur.network.slice(2) : st.node;
    const selKey = d.nodes[fk] ? fk : null;
    if (selKey) {
      for (const e of d.edges) {
        if (e.from !== selKey && e.to !== selKey) continue;
        const a = d.nodes[e.from], b = d.nodes[e.to];
        line(c, a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, e.col, e.s > 0.6 ? 2 : 1);
      }
    }
    const linked = new Set();
    if (selKey) for (const e of d.edges) { if (e.from === selKey) linked.add(e.to); if (e.to === selKey) linked.add(e.from); }
    if (!d.pols.length) para(c, d.filter === 'bill' ? 'いま審議中の法案はない。' : 'まだ施行中の政策はない。', NET.x + NET.px, NET.y + 24, NET.pw, 10, K.dim, 12, 4);
    for (const [key, n] of Object.entries(d.nodes)) {
      const on = key === selKey, lk = linked.has(key);
      if (n.pl) {
        frame(c, n.x, n.y, n.w, n.h, on ? '#2a3a12' : lk ? '#16263a' : '#0c1824', on ? K.amber : n.pl.status === 'bill' ? K.violet : K.edge);
        T(c, n.pl.name, n.x + 3, n.y + 1, 10, n.pl.status === 'bill' ? '#d8c8ff' : K.text, 'left', n.w - 6);
      } else if (n.I) {
        frame(c, n.x, n.y, n.w, n.h, on ? '#2a3a12' : lk ? '#16263a' : '#0d1c2a', on ? K.amber : K.edgeHi);
        T(c, n.I.name, n.x + n.w / 2, n.y + 1, 10, K.cyan, 'center', n.w - 4);
        T(c, n.I.fmt(d.eco), n.x + n.w / 2, n.y + 13, 10, K.white, 'center', n.w - 4);
      } else {
        const seg = d.bySeg.find((q) => q.seg === n.s);
        frame(c, n.x, n.y, n.w, n.h, on ? '#2a3a12' : lk ? '#16263a' : '#0c1824', on ? K.amber : K.edge);
        R(c, n.x + 2, n.y + 3, 3, n.h - 6, SEG_COLOR[n.s] || K.dim);
        T(c, SEG_SHORT[n.s] || n.s, n.x + 8, n.y + 3, 10, K.text, 'left', 50);
        if (seg) T(c, `${seg.approval}%`, n.x + n.w - 3, n.y + 3, 10, seg.approval >= 50 ? K.good : seg.approval >= 30 ? K.warn : K.bad, 'right', 30);
      }
    }
    // legend
    T(c, '線：', NET.x + 6, NET.y + NET.h - 13, 10, K.faint);
    R(c, NET.x + 28, NET.y + NET.h - 8, 12, 2, K.good); T(c, 'よい方向・支持', NET.x + 43, NET.y + NET.h - 13, 10, K.dim);
    R(c, NET.x + 128, NET.y + NET.h - 8, 12, 2, K.bad); T(c, '悪い方向・反発', NET.x + 143, NET.y + NET.h - 13, 10, K.dim);
    R(c, NET.x + 230, NET.y + NET.h - 8, 12, 2, K.violet); T(c, '円相場の変化', NET.x + 245, NET.y + NET.h - 13, 10, K.dim);
    // details
    drawNetDetail(c, ui, d, selKey);
  },
};
function drawNetDetail(c, ui, d, key) {
  const x = 432, y = 44, w = 204, h = 292;
  const g = ui.g;
  const n = key ? d.nodes[key] : null;
  panel(c, x, y, w, h, n ? (n.pl ? n.pl.name : n.I ? n.I.name : SEGMENTS[n.s] ? SEGMENTS[n.s].name : n.s) : 'くわしく');
  const lx = x + 6, lw = w - 12;
  if (!n) { para(c, '政策・指標・層をえらぶと、つながりと賛成・反対の声が出る。', lx, y + 22, lw, 12, K.dim, 15, 6); return; }
  let yy = y + 22;
  if (n.pl) {
    const pl = n.pl, P = POLICIES[pl.id];
    T(c, pl.status === 'law' ? `施行中${pl.since ? `（${pl.since}年から）` : ''}` : `審議中：${STAGE_JA[pl.stage] || pl.stage}${pl.bill && pl.bill.by === 'player' ? '・あなたの法案' : ''}`, lx, yy, 10, pl.status === 'law' ? K.good : K.violet, 'left', lw); yy += 12;
    T(c, `分野：${POLICY_AREAS[P.area] ? POLICY_AREAS[P.area].name : P.area}`, lx, yy, 10, K.dim, 'left', lw); yy += 12;
    yy = para(c, P.desc || '', lx, yy, lw, 10, K.text, 12, 3) + 2;
    T(c, pl.cost > 0 ? `財政：年${cho(pl.cost)}の支出・減収` : pl.cost < 0 ? `財政：年${cho(-pl.cost)}の財源` : '財政：大きな負担はない', lx, yy, 10, pl.cost > 0 ? K.warn : K.good, 'left', lw); yy += 12;
    const eco = IND_DEFS.filter((I) => I.id !== 'fiscal' && Math.abs(num(pl.eco[I.id])) >= 0.01).map((I) => `${I.name}${num(pl.eco[I.id]) > 0 ? '↑' : '↓'}`);
    T(c, `経済：${eco.join(' ') || '大きな影響はない'}`, lx, yy, 10, K.cyan, 'left', lw); yy += 14;
    const segs = SEGMENT_ORDER.map((s) => [s, num(pl.seg[s])]);
    const pro = segs.filter(([, v]) => v > 0.3).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s]) => SEG_SHORT[s]);
    const con = segs.filter(([, v]) => v < -0.3).sort((a, b) => a[1] - b[1]).slice(0, 4).map(([s]) => SEG_SHORT[s]);
    T(c, '賛成しそうな層', lx, yy, 10, K.good); yy += 12;
    T(c, pro.join('・') || 'とくになし', lx + 6, yy, 10, K.text, 'left', lw - 6); yy += 13;
    T(c, '反対しそうな層', lx, yy, 10, K.bad); yy += 12;
    T(c, con.join('・') || 'とくになし', lx + 6, yy, 10, K.text, 'left', lw - 6); yy += 14;
    if (pl.align && Object.keys(pl.align).length) {
      const al = Object.entries(pl.align).sort((a, b) => b[1] - a[1]);
      T(c, `賛成しそうな党：${al.filter(([, a]) => a >= 0.62).map(([id]) => partyShortName(g, id)).join('・') || 'なし'}`, lx, yy, 10, K.good, 'left', lw); yy += 12;
      T(c, `反対しそうな党：${al.filter(([, a]) => a < 0.45).map(([id]) => partyShortName(g, id)).join('・') || 'なし'}`, lx, yy, 10, K.bad, 'left', lw); yy += 14;
    }
    const vs = voicesOf(g, 6, { event: pl.title }).concat(voicesOf(g, 6, { event: pl.name }));
    const vp = vs.find((v) => v.stance === 'pro'), vc = vs.find((v) => v.stance === 'con');
    T(c, '世論の声', lx, yy, 10, K.amber); yy += 12;
    if (!vp && !vc) yy = para(c, 'この政策についての声は、まだ集まっていない（成立や採決のときに出る）。', lx, yy, lw, 10, K.faint, 12, 3);
    for (const v of [vp, vc].filter(Boolean)) { if (yy > y + h - 26) break; T(c, `${STANCE_WORD[v.stance]}・${v.who}`, lx, yy, 10, STANCE_COL[v.stance], 'left', lw); yy = para(c, `「${v.text}」`, lx, yy + 11, lw, 10, K.text, 12, 2) + 2; }
  } else if (n.I) {
    const I = n.I;
    T(c, `いま：${I.fmt(d.eco)}`, lx, yy, 12, K.white, 'left', lw); yy += 16;
    const hist = (g.state.flags.polui && Array.isArray(g.state.flags.polui.eco)) ? g.state.flags.polui.eco.map((q) => num(q[I.id === 'fiscal' ? 'debtRatio' : I.id], NaN)) : [];
    spark(c, hist, lx, yy, lw, 34, K.cyan); yy += 40;
    T(c, I.good > 0 ? '上がるほどよいとされる指標' : I.good < 0 ? '上がると暮らしの負担になりやすい指標' : '円安・円高のどちらにも得する人と困る人がいる', lx, yy, 10, K.dim, 'left', lw); yy += 14;
    T(c, 'この指標に効いている政策', lx, yy, 10, K.amber); yy += 12;
    const inc = d.edges.filter((e) => e.to === key).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    if (!inc.length) T(c, 'このページの政策にはない', lx, yy, 10, K.faint, 'left', lw);
    for (const e of inc.slice(0, 12)) { if (yy > y + h - 14) break; T(c, `${e.v > 0 ? '↑' : '↓'} ${d.nodes[e.from].pl.name}`, lx, yy, 10, e.col, 'left', lw); yy += 12; }
  } else {
    const s = n.s;
    const seg = d.bySeg.find((q) => q.seg === s);
    T(c, `内閣支持：${seg ? `${seg.approval}%` : '—'}・有権者の${pct(num(d.W[s]) * 100, 0)}`, lx, yy, 10, K.white, 'left', lw); yy += 14;
    T(c, 'この層に効いている政策', lx, yy, 10, K.amber); yy += 12;
    const inc = d.edges.filter((e) => e.to === key).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    if (!inc.length) { T(c, 'このページの政策にはない', lx, yy, 10, K.faint, 'left', lw); yy += 12; }
    for (const e of inc.slice(0, 8)) { T(c, `${e.v > 0 ? '＋' : '−'} ${d.nodes[e.from].pl.name}`, lx, yy, 10, e.col, 'left', lw); yy += 12; }
    yy += 4;
    T(c, 'この層の声', lx, yy, 10, K.amber); yy += 12;
    const vs = voicesOf(g, 20, { segment: s });
    const pick2 = [vs.find((v) => v.stance === 'pro'), vs.find((v) => v.stance === 'con')].filter(Boolean);
    if (!pick2.length) T(c, 'まだ声はない', lx, yy, 10, K.faint, 'left', lw);
    for (const v of pick2) { if (yy > y + h - 26) break; T(c, `${STANCE_WORD[v.stance]}・${v.who}`, lx, yy, 10, STANCE_COL[v.stance], 'left', lw); yy = para(c, `「${v.text}」`, lx, yy + 11, lw, 10, K.text, 12, 2) + 2; }
  }
}

// ================================================================ tab 4: 世論
const VOICE_FILTERS = [{ id: 'all', label: 'すべて' }, { id: 'pro', label: '賛成' }, { id: 'con', label: '反対' }, { id: 'neutral', label: '中立' }];
const DEMO_CAUSES = [
  ['tax', '増税に反対する'], ['scandal', '政治とカネの問題をただす'], ['policy', '政府の政策に反対する'], ['war', '戦争に反対する'],
  ['speech', '表現の自由を守る'], ['disaster', '被災地への支援を求める'], ['rally', '政府を応援する'],
];
// what a response does (from govt.js / regime.js DEMO_RESPONSES apply())
const DEMO_CONSEQ = {
  dialogue: 'デモの勢いが少し弱まり、その層の支持が少し上がる。「話を聞く政府」と受けとめられやすい',
  tolerate: '表現の自由として見守る。支持率への影響はほとんどない',
  regulate: '勢い×0.85・規模×0.9。若者や都市の層から「過剰な警備」との反発（高齢者・経営者は理解）',
  remove: '勢いはかえって強まる（×1.25）。支持率が4〜7ポイント下がり、若者・都市・無党派が強く反発する',
  crackdown: '【もしも】勢い×0.5・規模×0.6。民衆の不満+18・国際社会の懸念+15・報道の自由度−5・支持率−8。多数のけが人と拘束者が出たと伝えられ、蜂起の危険が一気に高まる',
  curfew: '【もしも】勢い×0.8。民衆の不満+6・国際社会の懸念+5・成長率−0.5（60日）。暮らしと経済に重い負担',
  concession: '【もしも】民衆の不満−10・国際社会の懸念−4。拘束者を解放し、対話を約束する',
};
const TAB_OPINION = {
  id: 'opinion', label: '世論', short: '層別の支持・世論の声・デモ（参加・対応）', lesson: 'yoron',
  tip: (ui) => (ui.tabState().last === 'demo' ? 'govt_demo' : 'govt_voices'),
  about: '層ごとの内閣支持・政党支持・世論の声（架空の市民）・デモ（参加・主催・政府の対応）',
  terms: ['世論', '世論調査', 'デモ', '表現の自由', '無党派層'],
  alert: (ui) => (has(ui.g, 'demos') ? safe(() => ui.g.demos({ active: true }).length, 0) : 0),
  load(ui) {
    const g = ui.g;
    const st = ui.tabState();
    const d = {};
    d.ab = has(g, 'approvalBreakdown') ? safe(() => g.approvalBreakdown(), null) : null;
    const f = st.vf || 'all';
    d.voices = voicesOf(g, 40, f === 'all' ? {} : { stance: f });
    d.demos = has(g, 'demos') ? safe(() => g.demos(), []) : [];
    d.demos = d.demos.slice().sort((a, b) => (a.status === 'ended') - (b.status === 'ended') || b.day - a.day).slice(0, 14);
    d.joinWhy = (id) => (has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_join', { id }), null) : '政府のしくみが読み込まれていない');
    d.orgWhy = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_organize'), null) : '政府のしくみが読み込まれていない';
    d.respWhy = (id) => (has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_respond', { id }), null) : '政府のしくみが読み込まれていない');
    return d;
  },
  layout(ui, d) {
    const st = ui.tabState();
    const out = [];
    out.push(jump('op_seg', 4, 44, 210, 292, 'network', '層ごとの内閣支持率（推計）。A：政策マップで層ごとのつながりを見る'));
    let x = 218;
    for (const f of VOICE_FILTERS) {
      const w = (ui.g.ctx ? measure(ui.g.ctx, f.label, 10) : 24) + 12;
      out.push({ kind: 'seg', id: `vf_${f.id}`, x, y: 62, w, h: 14, why: null, tip: `世論の声：${f.label}`, a: (u) => { u.tabState().vf = f.id; u.tabState().vrow = 0; u.dirty(); } });
      x += w + 2;
    }
    out.push(btn({ id: 'v_fresh', x: 384, y: 62, w: 68, h: 14, label: '新しい声', why: has(ui.g, 'voices') ? null : '世論の声のしくみがない', tip: '街の声・ネットの声を新しく集める（架空の市民）', a: (u) => { safe(() => u.g.voices(6, { fresh: true })); st.vrow = 0; u.toast('新しい声を集めた', K.cyan); } }));
    out.push(listCtl(ui, 'vrow', { id: 'vrow', x: 218, y: 80, w: 234, h: 256, rowH: 32, n: d.voices.length, tip: (u) => { const v = d.voices[u.tabState().vrow | 0]; return v ? `${v.mediumLabel}・${v.segName}・${v.event || ''}（架空の市民の声）` : ''; }, a: (u) => { const v = d.voices[u.tabState().vrow | 0]; if (v) return u.info(v.header, [`「${v.text}」`, '', `立場：${STANCE_WORD[v.stance] || '—'}・層：${v.segName}`, `話題：${v.event || '—'}・${v.mediumLabel}`, '※架空の市民の声。ひとつの声だけで世論を決めつけない']); } }));
    out.push(listCtl(ui, 'drow', { id: 'drow', x: 456, y: 62, w: 180, h: 112, rowH: 28, n: d.demos.length, tip: (u) => { const dm = d.demos[u.tabState().drow | 0]; return dm ? `${dm.cause}（${dm.place}・約${fmtN(dm.size)}人）` : 'デモはない'; }, a: null, onMove: (u) => { u.tabState().last = 'demo'; } }));
    const dm = d.demos[st.drow | 0];
    const ended = !dm || dm.status === 'ended';
    out.push(btn({ id: 'd_join', x: 456, y: 270, w: 88, h: 20, label: '参加する', why: !dm ? 'デモがない' : ended ? 'そのデモはもう終わっている' : d.joinWhy(dm.id), tip: '市民としてデモに参加する（集会・表現の自由：憲法21条）', a: (u) => demoJoin(u, dm) }));
    out.push(btn({ id: 'd_org', x: 548, y: 270, w: 88, h: 20, label: '主催する', why: d.orgWhy, tip: 'デモを主催する（公安条例の許可・準備のお金）', a: (u) => demoOrganize(u) }));
    out.push(btn({ id: 'd_resp', x: 456, y: 294, w: 180, h: 20, label: '政府として対応する', color: K.amber, why: !dm ? 'デモがない' : ended ? 'そのデモはもう終わっている' : d.respWhy(dm.id), tip: '総理・官房長官・国家公安委員長がデモに対応する', a: (u) => demoRespond(u, dm) }));
    out.push(btn({ id: 'd_scene', x: 456, y: 318, w: 180, h: 18, label: 'デモの様子を見る', why: !dm ? 'デモがない' : has(ui.g, 'demoScene') ? null : '場面のしくみがない', tip: 'デモの現場の様子（架空）', a: (u) => (dm ? safe(() => u.g.demoScene(dm.id, null), null) : null) }));
    return out;
  },
  draw(c, ui, d) {
    const st = ui.tabState();
    const ab = d.ab;
    // ---- by segment
    panel(c, 4, 44, 210, 292, '層ごとの内閣支持（推計）', { right: ab ? `全体 ${ab.approval}%` : '' });
    if (!ab) para(c, '（政府コアが読み込まれると表示される）', 10, 66, 198, 12, K.dim);
    else {
      const segs = (ab.bySegment || []).slice().sort((a, b) => b.approval - a.approval);
      segs.forEach((s, i) => {
        const yy = 64 + i * 14;
        R(c, 10, yy + 3, 3, 8, SEG_COLOR[s.seg] || K.dim);
        T(c, SEG_SHORT[s.seg] || s.name, 16, yy, 10, K.text, 'left', 50);
        hbar(c, 68, yy + 3, 100, 7, s.approval / 100, s.approval >= 50 ? K.good : s.approval >= 30 ? K.warn : K.bad);
        R(c, 68 + 50, yy + 1, 1, 11, K.faint);
        T(c, `${s.approval}%`, 208, yy, 10, K.white, 'right', 36);
      });
      let yy = 64 + Math.min(11, segs.length) * 14 + 4;
      T(c, '政党支持率', 10, yy, 10, K.amber);
      T(c, `支持なし ${pct(ab.none)}`, 208, yy, 10, K.dim, 'right', 100); yy += 13;
      const sup = (ab.support || []).slice(0, 6);
      for (const s of sup) {
        R(c, 10, yy + 3, 3, 8, partyColorOf(ui.g, s.id));
        T(c, s.name, 16, yy, 10, K.text, 'left', 60);
        hbar(c, 80, yy + 3, 88, 7, s.pct / 60, partyColorOf(ui.g, s.id));
        T(c, pct(s.pct), 208, yy, 10, K.white, 'right', 40);
        yy += 12;
      }
      T(c, '※推計（実在の世論調査ではない）', 10, 322, 10, K.faint, 'left', 198);
    }
    // ---- voices
    panel(c, 218, 44, 234, 292, '世論の声', { right: '架空の市民' });
    for (const f of VOICE_FILTERS) {
      const k = ui.ctls.find((q) => q.id === `vf_${f.id}`);
      if (!k) continue;
      const on = (st.vf || 'all') === f.id;
      frame(c, k.x, k.y, k.w, k.h, on ? '#1d4a64' : '#0b1621', on ? K.cyan : K.edge);
      T(c, f.label, k.x + k.w / 2, k.y + 1, 10, on ? K.white : K.dim, 'center');
    }
    drawBtn(c, ui, ui.ctls.find((q) => q.id === 'v_fresh'), { center: true });
    drawList(c, ui, ui.ctls.find((q) => q.id === 'vrow'), (c2, i, x, y, w) => {
      const v = d.voices[i];
      R(c2, x + 4, y + 3, 3, 25, STANCE_COL[v.stance] || K.dim);
      T(c2, `${v.header}`, x + 10, y + 2, 10, K.dim, 'left', w - 60);
      T(c2, safe(() => dateLabel(ui.g, v.day).replace(/^\d+年/, ''), ''), x + w - 4, y + 2, 10, K.faint, 'right', 60);
      T(c2, v.text, x + 10, y + 15, 12, K.text, 'left', w - 14);
    }, { empty: 'まだ声はない（「新しい声」で集める）' });
    // ---- demos
    panel(c, 456, 44, 180, 292, 'デモ・集会', { right: `${d.demos.filter((x) => x.status !== 'ended').length}件` });
    drawList(c, ui, ui.ctls.find((q) => q.id === 'drow'), (c2, i, x, y, w) => {
      const dm = d.demos[i];
      R(c2, x + 4, y + 3, 3, 22, dm.status === 'ended' ? K.ghost : dm.stance === 'rally' ? K.teal : K.pink);
      T(c2, dm.cause, x + 10, y + 2, 10, dm.status === 'ended' ? K.faint : K.text, 'left', w - 14);
      T(c2, `${dm.status === 'ended' ? '終了' : dm.status === 'planned' ? '予定' : '開催中'}・約${fmtN(dm.size)}人`, x + 10, y + 14, 10, K.dim, 'left', w - 14);
    }, { empty: 'いまデモはない' });
    const dm = d.demos[st.drow | 0];
    let yy = 180;
    if (dm) {
      T(c, dm.place, 462, yy, 10, K.cyan, 'left', 168); yy += 12;
      T(c, `主催：${dm.organiser}`, 462, yy, 10, K.text, 'left', 168); yy += 12;
      T(c, `層：${SEG_SHORT[dm.segment] || dm.segment}・許可：${dm.permit ? 'あり' : 'なし'}`, 462, yy, 10, K.text, 'left', 168); yy += 12;
      const mo = num(dm.momentum, 1);
      T(c, `最大 約${fmtN(dm.peak)}人`, 462, yy, 10, K.text, 'left', 168); yy += 12;
      T(c, `勢い：${dm.status === 'ended' ? '終わった' : mo > 1.05 ? '強まっている' : mo < 0.95 ? '弱まっている' : '横ばい'}`, 462, yy, 10, K.text, 'left', 168); yy += 12;
      if (dm.joined) { T(c, `あなたも参加した（${dm.joined.role === 'speaker' ? 'スピーチ' : '参加'}）`, 462, yy, 10, K.good, 'left', 168); yy += 12; }
      const resp = (dm.responses || []).slice(-1)[0];
      if (resp) {
        const RD = GV && GV.DEMO_RESPONSES && GV.DEMO_RESPONSES[resp.how];
        T(c, `政府の対応：${RD ? String(RD.label || RD.name || resp.how).replace(/（.*$/, '') : resp.how}`, 462, yy, 10, K.warn, 'left', 168); yy += 12;
      }
      for (const l of (dm.log || []).slice(-2)) { if (yy > 256) break; T(c, `・${l.text}`, 462, yy, 10, K.dim, 'left', 168); yy += 12; }
    }
    for (const id of ['d_join', 'd_org', 'd_resp', 'd_scene']) drawBtn(c, ui, ui.ctls.find((q) => q.id === id), { center: true, color: id === 'd_resp' ? K.amber : K.cyan });
  },
};
async function demoJoin(ui, dm) {
  if (!dm) return;
  const k = await ui.confirm({ title: 'デモに参加する', lines: [`「${dm.cause}」に参加する（${dm.place}）。`, 'デモや集会は、集会・表現の自由（憲法21条）で守られている。', '体力を使う。芸能人なら知名度やスポンサーへの影響、政治家なら党内の評価にもかかわる。'], choices: ['参加する', 'スピーチもする', 'やめる'], cancel: 2 });
  if (k < 0 || k === 2) return;
  await ui.result('デモ', safe(() => ui.g.joinDemo(dm.id, { role: k === 1 ? 'speaker' : 'participant' }), null));
}
async function demoOrganize(ui) {
  const items = DEMO_CAUSES.map(([id, label]) => ({ label, sub: id === 'rally' ? '政府を応援する集会' : '政府や政策への抗議', id }));
  const i = await ui.pick({ title: 'デモを主催する', lines: ['公安条例にもとづく許可をとり、あすから行う。準備のお金がいる。'], items, w: 420 });
  if (i == null || i < 0) return;
  const [against, label] = DEMO_CAUSES[i];
  await ui.result('デモの主催', safe(() => ui.g.organizeDemo({ cause: label, against }), null));
}
async function demoRespond(ui, dm) {
  if (!dm) return;
  const g = ui.g;
  const list = has(g, 'demoResponses') ? safe(() => g.demoResponses(dm.id), []) : [];
  const items = list.map((r) => ({ label: r.label, sub: r.why ? r.why : DEMO_CONSEQ[r.id] || r.desc, why: r.why, id: r.id, color: ['crackdown', 'curfew', 'remove'].includes(r.id) ? K.danger : ['dialogue', 'tolerate'].includes(r.id) ? K.good : K.warn }));
  const i = await ui.pick({ title: `デモへの対応：${dm.cause}`, lines: ['民主国家の政府は、デモを力でおさえず、対話で応えるのが基本（憲法21条）。'], items, w: 500, color: K.amber });
  if (i == null || i < 0) return;
  const r = list[i];
  const severe = ['remove', 'crackdown', 'curfew', 'concession'].includes(r.id);
  const lines = [r.desc, '', `【この対応の結果】${DEMO_CONSEQ[r.id] || '—'}`];
  const k = await ui.confirm({ title: `${severe ? '⚠ ' : ''}${r.label}`, lines, choices: severe ? ['やめておく', '理解したうえで実行する'] : ['実行する', 'やめる'], index: 0, cancel: severe ? 0 : 1, danger: severe, fiction: ['crackdown', 'curfew', 'concession'].includes(r.id), w: 480 });
  if ((severe && k !== 1) || (!severe && k !== 0)) return;
  await ui.result('デモへの対応', safe(() => g.respondDemo(dm.id, r.id), null));
}

// ================================================================ tab 5: 国会
const PIPE = [['draft', '提出'], ['committee', '委員会'], ['shugi', '衆議院'], ['sangi', '参議院'], ['enacted', '成立']];
function billStageIdx(b) { const s = b.stage === 'referendum' ? 'sangi' : b.stage; const i = PIPE.findIndex(([k]) => k === s); return i < 0 ? 0 : i; }
const TAB_DIET = {
  id: 'diet', label: '国会', short: '議席・法案の流れ・国会戦術・政権交代', lesson: 'houritsu',
  tip: 'govt_seats',
  about: '衆参の議席（会派）・過半数と3分の2・審議中の法案・野党と与党の国会戦術・政権交代の見通し',
  terms: ['過半数', '再可決', '会派', '質問主意書', '内閣不信任決議', '強行採決', '政権交代'],
  load(ui) {
    const g = ui.g, p = polOf(g);
    const d = { p };
    d.seats = has(g, 'seatDetails') ? safe(() => g.seatDetails(), null) : null;
    d.bills = (p.diet.bills || []).filter((b) => b.kind !== 'noconfidence' && !['enacted', 'rejected', 'shelved'].includes(b.stage)).slice(0, 30);
    d.recent = (p.diet.bills || []).filter((b) => ['enacted', 'rejected', 'shelved'].includes(b.stage) && today(g) - num(b.closed, -99) <= 30).slice(-6);
    d.opp = has(g, 'opposition') ? safe(() => g.opposition(), null) : null;
    d.ab = has(g, 'approvalBreakdown') ? safe(() => g.approvalBreakdown(), null) : null;
    d.next = upcomingOf(g).find((e) => e.kind === 'shugi' || e.kind === 'sangi') || null;
    const st = ui.tabState();
    const sel = d.bills[st.bill | 0];
    d.billId = sel ? sel.id : null;
    const R0 = (kind, opts) => (has(g, 'govtRefusal') ? safe(() => g.govtRefusal(kind, opts || {}), null) : '政府のしくみが読み込まれていない');
    const role = ui.role0;
    const acts = [];
    const oppWhy = (id) => { const o = d.opp && (d.opp.opposition || []).find((x) => x.id === id); return o ? o.why : R0(id); };
    const rulWhy = (id) => { const o = d.opp && (d.opp.ruling || []).find((x) => x.id === id); return o ? o.why : R0(id); };
    const OA = (GV && GV.OPPOSITION_ACTIONS) || {}, RA = (GV && GV.RULING_ACTIONS) || {};
    acts.push({ id: 'bill', grp: '議員', label: '法案を出す（政策をつくる）', desc: '議員立法（議員が出す）か閣法（内閣が出す）。政策・法案の画面へ', why: role && (role.diet || role.pm || role.kind === 'minister') ? null : '法律案を出せるのは国会議員か内閣だけ' });
    for (const id of ['shitsumon_shuisho', 'yosan_shitsugi', 'taian', 'kyoto', 'shingi_kyohi', 'fushinnin']) if (OA[id] || d.opp) acts.push({ id, grp: '野党', label: (OA[id] || {}).label || id, desc: `${(OA[id] || {}).desc || ''}${OA[id] && OA[id].law && OA[id].law !== '—' ? `（${OA[id].law}）` : ''}`, why: oppWhy(id) });
    for (const id of ['kokutai', 'kyoko', 'key_bill']) if (RA[id] || d.opp) acts.push({ id, grp: '与党', label: (RA[id] || {}).label || id, desc: (RA[id] || {}).desc || '', why: rulWhy(id) || (!d.billId && id !== 'kyoko' ? '先に左の一覧で法案をえらぶ' : null) });
    acts.push({ id: 'key_dissolve', grp: '総理', label: '最重要法案の否決を受けて解散', desc: '参議院で最重要法案が否決されたとき、衆議院を解散して国民に信を問う', why: R0('key_dissolve') });
    acts.push({ id: 'questions', grp: '見る', label: `質問主意書と答弁書（${d.opp ? d.opp.questions.length : 0}件）`, desc: '出された質問主意書と、内閣の答弁書', why: null });
    d.acts = acts;
    return d;
  },
  layout(ui, d) {
    const st = ui.tabState();
    const out = [];
    out.push(jump('dt_shugi', 4, 44, 314, 122, 'diet', '衆議院の会派別の議席。白線：過半数・金線：3分の2'));
    out.push(jump('dt_sangi', 322, 44, 314, 122, 'diet', '参議院の会派別の議席。白線：過半数・金線：3分の2'));
    out[0].nofocus = out[1].nofocus = true;
    out.push(listCtl(ui, 'bill', { id: 'bill', x: 4, y: 186, w: 314, h: 150, rowH: 26, n: d.bills.length, tip: (u) => { const b = d.bills[u.tabState().bill | 0]; return b ? `${b.title}（${b.sponsor === 'cabinet' ? '閣法' : '議員立法'}）` : '審議中の法案はない'; }, a: (u) => { const b = d.bills[u.tabState().bill | 0]; if (b) return u.info(b.title, billLines(u.g, b)); } }));
    out.push(listCtl(ui, 'act', {
      id: 'act', x: 322, y: 186, w: 314, h: 86, rowH: 17, n: d.acts.length,
      why: (u) => { const a = d.acts[u.tabState().act | 0]; return a ? a.why : null; },
      tip: (u) => { const a = d.acts[u.tabState().act | 0]; return a ? a.desc : ''; },
      a: (u) => dietAction(u, d, d.acts[u.tabState().act | 0]),
    }));
    out.push(jump('dt_out', 322, 276, 314, 60, 'opinion', '政権交代の見通し（世論調査の政党支持からの目安）。A：世論へ'));
    void st;
    return out;
  },
  draw(c, ui, d) {
    const g = ui.g, sd = d.seats;
    for (const [hk, name, x] of [['shugi', '衆議院', 4], ['sangi', '参議院', 322]]) {
      const H = sd && sd[hk];
      panel(c, x, 44, 314, 122, H ? `${name} ${H.total}議席` : name, { right: H ? `与党 ${H.ruling}／過半数 ${H.majority}` : '', rightColor: H && H.rulingMajority ? K.good : K.bad });
      if (!H) { T(c, '（議席の詳細は準備中）', x + 8, 66, 12, K.dim); continue; }
      const gs = seatGroupsOf(H);
      drawHemi(c, x + 76, 148, 66, gs, H.total, { lines: [[H.majority, K.white, '過半数'], [H.twoThirds, K.amber, '2/3']], labels: true });
      T(c, hk === 'shugi' ? (H.system === 'chusenkyoku' ? '中選挙区制' : '小選挙区比例代表並立制') : `改選は${(H.classes || []).map((q) => q.year + 6).filter((y) => y > yearOf(g)).sort()[0] || '—'}年`, x + 76, 152, 10, K.faint, 'center', 140);
      // legend: by 会派
      const leg = gs.slice().sort((a, b) => b.n - a.n).slice(0, 7);
      leg.forEach((q, i) => {
        const ly = 64 + i * 13;
        R(c, x + 160, ly + 2, 4, 9, q.color);
        T(c, q.id === 'ind' ? '無所属' : q.kaiha || q.name, x + 168, ly, 10, q.ruling ? K.white : K.dim, 'left', 110);
        T(c, String(q.n), x + 308, ly, 10, q.ruling ? K.amber : K.text, 'right', 26);
      });
      const tags = [];
      if (H.rulingTwoThirds) tags.push(['与党で3分の2', '#5a4a10']);
      if (!H.rulingMajority) tags.push(['与党は過半数割れ', '#5a1a20']);
      if (hk === 'sangi' && nejireOf(sd)) tags.push(['ねじれ国会', '#5a1a20']);
      if (hk === 'shugi' && H.dissolved) tags.push(['解散中', '#5a1a20']);
      let tx = x + 160;
      for (const [t, col] of tags) tx += chip(c, tx, 154 - 2, t, col, K.white, 10) + 3;
    }
    // ---- bills
    const S0 = d.p.diet.session;
    panel(c, 4, 170, 314, 166, '審議中の法案', { right: S0 ? `${S0.kind}・あと${Math.max(0, S0.end - today(g))}日` : '閉会中' });
    drawList(c, ui, ui.ctls.find((q) => q.id === 'bill'), (c2, i, x, y, w) => {
      const b = d.bills[i];
      const tags = `${b.sponsor === 'cabinet' ? '閣法' : '議員'}${b.by === 'player' ? '★' : ''}${b.key ? '・最重要' : ''}`;
      const tw = measure(c2, tags, 10) + 6;
      T(c2, b.title, x + 6, y + 1, 10, b.by === 'player' ? K.amber : K.text, 'left', w - tw - 10);
      T(c2, tags, x + w - 4, y + 1, 10, b.key ? K.warn : K.faint, 'right', tw);
      const at = billStageIdx(b);
      PIPE.forEach(([k2, lab], j) => {
        const bx = x + 6 + j * 60;
        const on = j === at;
        const l2 = k2 === 'committee' ? `${b.house === 'sangi' ? '参' : '衆'}・委員会` : lab;
        R(c2, bx, y + 14, 56, 9, j < at ? '#123a24' : on ? '#3a2a0a' : '#0b1621');
        T(c2, l2, bx + 28, y + 13, 10, j < at ? K.good : on ? K.amber : K.faint, 'center', 54);
      });
    }, { empty: d.p.diet.session ? '審議中の法案はない' : '国会は閉会中。審議中の法案はない' });
    // ---- actions
    panel(c, 322, 170, 314, 104, '国会での行動', { right: ui.role0 ? ui.role0.label : '' });
    drawList(c, ui, ui.ctls.find((q) => q.id === 'act'), (c2, i, x, y, w) => {
      const a = d.acts[i];
      chip(c2, x + 4, y + 2, a.grp, a.grp === '野党' ? '#2a3a5a' : a.grp === '与党' ? '#3a2a1a' : a.grp === '総理' ? '#4a2a10' : '#1a3a3a', K.white, 10);
      if (a.why) padlock(c2, x + 34, y + 4);
      T(c2, a.label, x + 44, y + 2, 12, a.why ? K.faint : K.text, 'left', w - 48);
    });
    // ---- outlook
    const k = ui.ctls.find((q) => q.id === 'dt_out');
    panel(c, k.x, k.y, k.w, k.h, '政権交代の見通し（目安）');
    const sup = (d.ab && d.ab.support) || [];
    const ruling = new Set((d.p.cabinet.partyIds || []));
    const r = sup.filter((s) => ruling.has(s.id)).reduce((a, s) => a + num(s.pct), 0);
    const o = sup.filter((s) => !ruling.has(s.id)).reduce((a, s) => a + num(s.pct), 0);
    const tot = Math.max(1, r + o + num(d.ab && d.ab.none));
    let bx = k.x + 6;
    const bw = k.w - 12;
    for (const [v, col] of [[r, K.amber], [o, K.cyan], [num(d.ab && d.ab.none), K.ghost]]) { const ww = Math.round((v / tot) * bw); R(c, bx, k.y + 20, ww, 6, col); bx += ww; }
    const word = !sup.length ? '世論調査がまだない' : o > r * 1.15 ? '野党が上回る：政権交代もありうる' : r > o * 1.3 ? '与党の支持が厚い' : '与野党が接近：選挙しだい';
    T(c, `与党 ${pct(r)}・野党 ${pct(o)}・支持なし ${pct(num(d.ab && d.ab.none))}`, k.x + 6, k.y + 29, 10, K.text, 'left', k.w - 12);
    const nx = d.next ? `次の${d.next.kind === 'shugi' ? '衆院選' : '参院選'}：${d.next.date}` : '';
    T(c, word, k.x + 6, k.y + 42, 10, o > r * 1.15 ? K.warn : K.dim, 'left', k.w - 12 - (nx ? measure(c, nx, 10) + 8 : 0));
    if (nx) T(c, nx, k.x + k.w - 6, k.y + 42, 10, K.cyan, 'right', 150);
  },
};
function billLines(g, b) {
  const out = [`${b.sponsor === 'cabinet' ? '内閣提出（閣法）' : '議員立法'}・いま：${STAGE_JA[b.stage] || b.stage}`];
  if (b.policy && POLICIES[b.policy]) out.push(POLICIES[b.policy].desc);
  const pv = b.policy ? safe(() => g.policyPreview(b.policy, b.params), null) : null;
  if (pv && pv.alignment) {
    const al = Object.entries(pv.alignment).sort((a, c) => c[1] - a[1]);
    out.push(`賛成しそうな党：${al.filter(([, a]) => a >= 0.62).map(([id]) => partyShortName(g, id)).join('・') || 'なし'}`);
    out.push(`反対しそうな党：${al.filter(([, a]) => a < 0.45).map(([id]) => partyShortName(g, id)).join('・') || 'なし'}`);
  }
  for (const [h, v] of Object.entries(b.votes || {})) out.push(`${h.startsWith('shugi') ? '衆院' : '参院'}本会議：賛成${v.yes}・反対${v.no}（${v.passed ? '可決' : '否決'}）`);
  for (const l of (b.log || []).slice(-3)) out.push(`・${safe(() => dateLabel(g, l.day).replace(/^\d+年/, ''), '')} ${l.text}`);
  return out;
}
async function dietAction(ui, d, a) {
  if (!a) return;
  const g = ui.g;
  const st = ui.tabState();
  if (a.id === 'bill') { await ui.away(() => g.politicsScreen('policy')); return; }
  if (a.id === 'questions') {
    const qs = (d.opp && d.opp.questions) || [];
    const lines = qs.length ? qs.slice(-8).reverse().flatMap((q) => [`【${q.title || q.topic}】${q.answered ? '答弁ずみ' : `答弁は${safe(() => dateLabel(g, q.due).replace(/^\d+年/, ''), '')}ごろ`}`, q.answer ? `　${q.answer.title}：${q.answer.text}` : '']).filter(Boolean) : ['まだ質問主意書は出されていない。'];
    await ui.info('質問主意書と答弁書', lines, { w: 500 });
    return;
  }
  const topics = (GV && GV.QUESTION_TOPICS) || { generic: '政府の方針' };
  const pickTopic = async (title) => {
    const ids = Object.keys(topics);
    const i = await ui.pick({ title, lines: ['何について内閣にただす？'], items: ids.map((t) => ({ label: topics[t] })) });
    return i >= 0 ? ids[i] : null;
  };
  if (a.id === 'shitsumon_shuisho' || a.id === 'yosan_shitsugi') {
    const t = await pickTopic(a.label);
    if (!t) return;
    await ui.result(a.label, safe(() => g.oppositionAction(a.id, { topic: t }), null));
    return;
  }
  if (a.id === 'taian') {
    const ids = POL.POLICY_ORDER.filter((id) => POLICIES[id] && POLICIES[id].kind === 'law');
    const items = ids.map((id) => ({ label: POLICIES[id].name, sub: POLICY_AREAS[POLICIES[id].area] ? POLICY_AREAS[POLICIES[id].area].name : '', why: safe(() => g.policyBlock(id), null), id }));
    const i = await ui.pick({ title: '対案（議員立法）', lines: ['政府案に代わる自分たちの案を、法律案として出す。'], items, w: 460 });
    if (i < 0) return;
    await ui.result('対案', safe(() => g.oppositionAction('taian', { policy: items[i].id }), null));
    return;
  }
  if (a.id === 'fushinnin') {
    const k = await ui.confirm({ title: '内閣不信任決議案', danger: true, lines: ['内閣不信任決議案を出す。衆議院議員50人以上の賛成で提出する。', '可決されれば、内閣は10日以内に衆議院を解散するか総辞職しなければならない（憲法69条）。'], choices: ['提出する', 'やめておく'], cancel: 1 });
    if (k !== 0) return;
    await ui.result('不信任案', safe(() => g.oppositionAction('fushinnin', {}), null));
    return;
  }
  if (a.id === 'kyoko') {
    const k = await ui.confirm({ title: '⚠ 採決を急ぐ（強行採決）', danger: true, lines: [a.desc, '【結果】支持率が3〜5ポイント下がる。デモが起きることもある。'], choices: ['やめておく', '採決を急ぐ'], index: 0, cancel: 0 });
    if (k !== 1) return;
    await ui.result(a.label, safe(() => g.rulingAction('kyoko', { billId: d.billId }), null));
    return;
  }
  if (a.id === 'key_dissolve') {
    const k = await ui.confirm({ title: '衆議院の解散', danger: true, lines: [a.desc, 'すべての衆議院議員がいったん職を失い、総選挙になる。'], choices: ['やめておく', '解散する'], index: 0, cancel: 0 });
    if (k !== 1) return;
    await ui.result('解散', safe(() => g.keyBillDissolve(), null));
    return;
  }
  if (a.id === 'kokutai' || a.id === 'key_bill') { await ui.result(a.label, safe(() => g.rulingAction(a.id, { billId: d.billId }), null)); return; }
  if (a.id === 'shingi_kyohi') {
    const k = await ui.confirm({ title: '審議拒否', lines: [a.desc, '【結果】法案の審議が遅れる。「仕事の放棄」との批判もあり、与党が採決を急ぐこともある。'], choices: ['審議拒否する', 'やめる'], cancel: 1 });
    if (k !== 0) return;
    await ui.result(a.label, safe(() => g.oppositionAction('shingi_kyohi', { billId: d.billId }), null));
    return;
  }
  await ui.result(a.label, safe(() => g.oppositionAction(a.id, {}), null));
  void st;
}

// ================================================================ tab 6: 行政
const ADMIN_SUBS = [{ id: 'min', label: '省庁と官僚' }, { id: 'council', label: '審議会' }, { id: 'ord', label: '政令・省令' }, { id: 'reform', label: '行政改革・天下り' }];
const TAB_ADMIN = {
  id: 'admin', label: '行政', short: '省庁と官僚・審議会・政令・行政改革', lesson: 'naikaku',
  tip: 'govt_ministries',
  about: 'その年の省庁と大臣・架空の官僚、審議会への諮問、政令・省令（国会の議決なしで決める）、行政改革と天下り',
  terms: ['官僚', '政令', '省令', '審議会', '天下り', '行政改革', '内閣人事局'],
  load(ui) {
    const g = ui.g;
    const d = {};
    d.min = has(g, 'ministries') ? safe(() => g.ministries(), []) : [];
    d.councils = has(g, 'councils') ? safe(() => g.councils(), []) : [];
    d.ords = has(g, 'ordinances') ? safe(() => g.ordinances(), []) : [];
    d.reform = has(g, 'adminReform') ? safe(() => g.adminReform(), null) : null;
    d.R = (kind, opts) => (has(g, 'govtRefusal') ? safe(() => g.govtRefusal(kind, opts || {}), null) : '政府のしくみが読み込まれていない');
    return d;
  },
  layout(ui, d) {
    const st = ui.tabState();
    const out = segCtls(ui, ADMIN_SUBS, 4, 44);
    const s = sub(ui);
    if (s === 'min') {
      out.push(listCtl(ui, 'mrow', { id: 'mrow', x: 4, y: 64, w: 250, h: 272, y0: 30, rowH: 20, n: d.min.length, tip: (u) => { const m = d.min[u.tabState().mrow | 0]; return m ? `${m.name}：大臣 ${m.ministerName || '—'}` : ''; }, a: null }));
      out.push(btn({ id: 'm_answer', x: 262, y: 314, w: 180, h: 20, label: '官僚の答弁を聞く', why: has(ui.g, 'bureaucratAnswer') ? null : '行政のしくみがない', tip: `国会での官僚（${yearOf(ui.g) < 2000 ? '政府委員' : '政府参考人'}）の答弁の例（架空の人物）`, a: (u) => bureauAnswer(u, d) }));
      out.push(btn({ id: 'm_jinji', x: 448, y: 314, w: 184, h: 20, label: '幹部人事（内閣人事局）', why: d.R('kanbu_jinji'), tip: jinjiTip(d), a: (u) => kanbuJinji(u, d) }));
    } else if (s === 'council') {
      out.push(listCtl(ui, 'crow', { id: 'crow', x: 4, y: 64, w: 300, h: 272, y0: 18, rowH: 26, n: d.councils.length, tip: (u) => { const k = d.councils[u.tabState().crow | 0]; return k ? `${k.name}：${k.topic}` : ''; }, a: null }));
      const k = d.councils[st.crow | 0];
      out.push(btn({ id: 'c_go', x: 312, y: 314, w: 320, h: 20, label: k ? `「${k.name}」に諮問する` : '諮問する', why: !k ? '審議会がない' : k.why || d.R('council', { id: k.id }), tip: '審議会に意見を求める（答申は5〜12日後）', color: K.amber, a: (u) => u.result('諮問', safe(() => u.g.councilConsult(k.id), null)) }));
    } else if (s === 'ord') {
      out.push(listCtl(ui, 'orow', { id: 'orow', x: 4, y: 64, w: 260, h: 272, y0: 18, rowH: 26, n: d.ords.length, tip: (u) => { const o = d.ords[u.tabState().orow | 0]; return o ? `${o.name}：${o.kind}（根拠：${o.basis}）` : ''; }, a: null }));
      const o = d.ords[st.orow | 0];
      (o ? o.options : []).forEach((op, i) => {
        out.push(btn({ id: `o_opt${i}`, x: 272, y: 290 - ((o.options.length - 1 - i) * 22), w: 360, h: 20, label: `${o.kind}を出す：${op.label}`, why: o.why || d.R('ordinance', { id: o.id, option: op.key }), color: K.amber, tip: `${op.label}${op.cost ? `（費用 年${cho(op.cost)}）` : ''}`, a: (u) => ordinanceFlow(u, o, op) }));
      });
    } else {
      out.push(btn({ id: 'r_jinji', x: 330, y: 290, w: 302, h: 20, label: '幹部人事を決める（内閣人事局）', why: d.R('kanbu_jinji'), tip: jinjiTip(d), a: (u) => kanbuJinji(u, d) }));
      out.push(btn({ id: 'r_ama', x: 330, y: 314, w: 302, h: 20, label: '天下りの実態を調べさせる', why: d.R('amakudari_check'), tip: reformDone(d, 'amakudariBan') ? '再就職のあっせんがないか調べる（あっせんは法律で禁じられている）' : '再就職のあっせんの実態を調べる（あっせんを禁じる法律はまだない）', a: (u) => u.result('天下りの調査', safe(() => u.g.adminAction('amakudari_check'), null)) }));
    }
    return out;
  },
  draw(c, ui, d) {
    const st = ui.tabState();
    drawSegs(c, ui, ADMIN_SUBS);
    const s = sub(ui);
    if (!has(ui.g, 'ministries')) { panel(c, 4, 64, 632, 272, '行政'); para(c, '行政のしくみ（政府コア govt.js）が読み込まれていない。', 12, 88, 600, 12, K.dim); return; }
    T(c, `${yearOf(ui.g)}年の省庁（${d.min.length}）`, 636, 47, 10, K.dim, 'right', 200);
    if (s === 'min') {
      panel(c, 4, 64, 250, 272, '府省と大臣');
      T(c, '府省', 10, 82, 10, K.faint); T(c, '大臣', 248, 82, 10, K.faint, 'right');
      drawList(c, ui, ui.ctls.find((q) => q.id === 'mrow'), (c2, i, x, y, w) => {
        const m = d.min[i];
        T(c2, m.name, x + 6, y + 3, 12, K.text, 'left', 104);
        T(c2, m.playerHeads ? 'あなた' : m.ministerName || '—', x + w - 4, y + 4, 10, m.playerHeads ? K.amber : K.dim, 'right', w - 116);
      });
      const m = d.min[st.mrow | 0];
      panel(c, 258, 64, 378, 246, m ? m.name : '府省', { right: m ? m.minister : '' });
      if (m) {
        let yy = 84;
        T(c, `大臣：${m.playerHeads ? 'あなた' : m.ministerName || '（空席）'}`, 264, yy, 12, m.playerHeads ? K.amber : K.white, 'left', 366); yy += 17;
        const ppl = [m.top, m.kanbo, ...(m.bureaus || [])].filter(Boolean);
        T(c, '幹部（架空の官僚）', 264, yy, 10, K.amber); yy += 13;
        for (const b of ppl.slice(0, 6)) {
          T(c, b.title, 270, yy, 10, K.dim, 'left', 150);
          T(c, `${b.name}（${b.age}歳・${b.entered}年入省）`, 630, yy, 10, K.text, 'right', 210);
          yy += 13;
        }
        yy += 4;
        const cn = (m.councils || []).map((id) => (d.councils.find((q) => q.id === id) || {}).name || id);
        const on = (m.ordinances || []).map((id) => (d.ords.find((q) => q.id === id) || {}).name || id);
        T(c, '審議会', 264, yy, 10, K.amber); yy += 12;
        yy = para(c, cn.join('・') || 'なし', 270, yy, 360, 10, K.text, 12, 2) + 4;
        T(c, '政令・省令・告示', 264, yy, 10, K.amber); yy += 12;
        yy = para(c, on.join('・') || 'なし', 270, yy, 360, 10, K.text, 12, 3) + 4;
        para(c, '大臣は省のトップ。法律の細かいことは、政令（内閣）・省令（大臣）で決める。官僚は試験で採用された国家公務員で、政治的に中立に仕事をする。', 264, Math.max(yy, 250), 366, 10, K.faint, 12, 4);
      }
      drawBtn(c, ui, ui.ctls.find((q) => q.id === 'm_answer'), { center: true });
      drawBtn(c, ui, ui.ctls.find((q) => q.id === 'm_jinji'), { center: true });
    } else if (s === 'council') {
      panel(c, 4, 64, 300, 272, '審議会');
      drawList(c, ui, ui.ctls.find((q) => q.id === 'crow'), (c2, i, x, y, w) => {
        const k = d.councils[i];
        T(c2, k.name, x + 6, y + 1, 12, K.text, 'left', w - 70);
        const sc = { idle: ['待機', K.faint], pending: ['審議中', K.warn], reported: ['答申あり', K.good] }[k.status] || ['', K.faint];
        T(c2, sc[0], x + w - 4, y + 2, 10, sc[1], 'right', 60);
        T(c2, k.topic, x + 6, y + 14, 10, K.dim, 'left', w - 12);
      });
      const k = d.councils[st.crow | 0];
      panel(c, 308, 64, 328, 246, k ? k.name : '審議会');
      if (k) {
        let yy = para(c, k.desc, 314, 84, 316, 10, K.text, 12, 5) + 4;
        T(c, `諮問できる人：${(k.posts || []).join('・')}`, 314, yy, 10, K.dim, 'left', 316); yy += 13;
        T(c, `テーマ：${k.topic}`, 314, yy, 10, K.dim, 'left', 316); yy += 15;
        if (k.report) { T(c, `答申（${safe(() => dateLabel(ui.g, k.report.day), '')}）`, 314, yy, 10, K.good); yy += 12; yy = para(c, k.report.text, 314, yy, 316, 10, K.text, 12, 5); }
        else if (k.status === 'pending') T(c, `審議中：答申は${safe(() => dateLabel(ui.g, k.due), '')}ごろ`, 314, yy, 10, K.warn, 'left', 316);
        para(c, '審議会は、大臣や総理の諮問を受けて専門家が意見（答申）を出す。答申があると、関係する政令・省令や税制改正が進めやすくなる。', 314, 262, 316, 10, K.faint, 12, 4);
      }
      drawBtn(c, ui, ui.ctls.find((q) => q.id === 'c_go'), { center: true, color: K.amber });
    } else if (s === 'ord') {
      panel(c, 4, 64, 260, 272, '政令・省令・告示');
      drawList(c, ui, ui.ctls.find((q) => q.id === 'orow'), (c2, i, x, y, w) => {
        const o = d.ords[i];
        T(c2, o.name, x + 6, y + 1, 12, o.why ? K.dim : K.text, 'left', w - 12);
        T(c2, `${o.kind}・根拠：${o.basis}`, x + 6, y + 14, 10, K.faint, 'left', w - 12);
      });
      const o = d.ords[st.orow | 0];
      const n = o ? o.options.length : 0;
      const top = 290 - (n - 1) * 22;
      panel(c, 268, 64, 368, top - 70, o ? o.name : '政令・省令');
      if (o) {
        let yy = para(c, o.desc, 274, 84, 356, 10, K.text, 12, 4) + 2;
        T(c, `根拠：${o.basis}${o.needCouncil ? `・先に諮問：${(d.councils.find((q) => q.id === o.needCouncil) || {}).name || o.needCouncil}` : ''}`, 274, yy, 10, K.dim, 'left', 356); yy += 13;
        if (o.last) { T(c, `前回：${safe(() => dateLabel(ui.g, typeof o.last === 'object' ? o.last.day : o.last), '')}`, 274, yy, 10, K.dim, 'left', 356); yy += 13; }
        T(c, '賛成の声', 274, yy, 10, K.good); yy += 12;
        for (const s2 of (o.pro || []).slice(0, 2)) yy = para(c, `・${s2}`, 274, yy, 356, 10, K.text, 12, 2);
        T(c, '反対の声', 274, yy + 2, 10, K.bad); yy += 14;
        for (const s2 of (o.con || []).slice(0, 2)) { if (yy > top - 18) break; yy = para(c, `・${s2}`, 274, yy, 356, 10, K.text, 12, 2); }
      }
      (o ? o.options : []).forEach((op, i) => drawBtn(c, ui, ui.ctls.find((q) => q.id === `o_opt${i}`), { color: K.amber }));
    } else {
      const r = d.reform;
      panel(c, 4, 64, 322, 272, '行政改革の歩み');
      if (r) {
        let yy = 84;
        for (const it of r.items || []) {
          chip(c, 10, yy, it.done ? '実現' : 'まだ', it.done ? '#1a4a2a' : '#2a2a3a', it.done ? K.good : K.dim, 10);
          T(c, it.label, 44, yy, 10, K.text, 'left', 278); yy += 13;
          if (it.done) { T(c, it.when || '', 44, yy, 10, K.faint, 'left', 278); yy += 12; }
          yy = para(c, it.text, 44, yy, 278, 10, K.dim, 12, 3) + 6;
        }
        T(c, '賛成の声', 10, yy, 10, K.good); yy += 12;
        for (const s2 of (r.pro || []).slice(0, 2)) yy = para(c, `・${s2}`, 10, yy, 310, 10, K.text, 12, 2);
        T(c, '反対の声', 10, yy + 2, 10, K.bad); yy += 14;
        for (const s2 of (r.con || []).slice(0, 2)) { if (yy > 320) break; yy = para(c, `・${s2}`, 10, yy, 310, 10, K.text, 12, 2); }
      }
      panel(c, 330, 64, 306, 222, '天下り（再就職のあっせん）', { right: r ? `世論の関心 ${fmtN(r.amakudari.heat, 0)}` : '' });
      if (r) {
        hbar(c, 336, 86, 294, 6, num(r.amakudari.heat) / 100, num(r.amakudari.heat) >= 60 ? K.bad : K.warn);
        let yy = 98;
        const cases = r.amakudari.cases || [];
        if (!cases.length) { T(c, '問題になっている事例はない', 336, yy, 10, K.dim, 'left', 290); yy += 13; }
        for (const cs of cases.slice(0, 5)) { yy = para(c, `・${typeof cs === 'string' ? cs : cs.text || `${cs.name}（架空）：${cs.from} → ${cs.to}`}`, 336, yy, 290, 10, K.text, 12, 2); }
        // the core's era- and history-aware text (never tells the future: the 2007 ban only once it exists)
        const ban = ((r.items || []).find((it) => it.id === 'amakudariBan') || {}).text || '';
        para(c, `天下り：退職した官僚が、仕事で関わった業界の団体や企業に再就職すること。${ban}`, 336, Math.max(yy + 4, 214), 292, 10, K.faint, 12, 5);
      }
      drawBtn(c, ui, ui.ctls.find((q) => q.id === 'r_jinji'), { center: true });
      drawBtn(c, ui, ui.ctls.find((q) => q.id === 'r_ama'), { center: true });
    }
  },
};
async function bureauAnswer(ui, d) {
  const g = ui.g;
  const topics = (GV && GV.QUESTION_TOPICS) || { generic: '政府の方針' };
  const ids = Object.keys(topics);
  const i = await ui.pick({ title: '官僚の答弁', lines: ['国会の委員会で、議員の質問に官僚が答える場面の例（架空の人物）。'], items: ids.map((t) => ({ label: topics[t] })) });
  if (i < 0) return;
  const a = safe(() => g.bureaucratAnswer(ids[i]), null);
  if (!a) { await ui.info('答弁', ['答弁はなかった。']); return; }
  await ui.info(`${a.role}の答弁`, [`${a.title}　${a.who}`, `「${a.text}」`, '', `※${a.role === '政府委員' ? 'いまは官僚が「政府委員」として国会で答弁する' : '1999年の国会審議活性化法で政府委員制度は廃止。いまは「政府参考人」として答える'}。人物は架空。`], { w: 480 });
}
// adminReform() items (the core's era- and history-aware record)
function reformDone(d, id) { return !!(d && d.reform && (d.reform.items || []).some((it) => it.id === id && it.done)); }
function jinjiTip(d) { return reformDone(d, 'jinjikyoku') ? '各府省の事務次官などの幹部を、総理と官房長官が決める（内閣人事局）' : '幹部人事を内閣で一元管理する仕組み（内閣人事局）ができると、総理と官房長官が決められる'; }
async function kanbuJinji(ui, d) {
  const g = ui.g;
  const items = d.min.map((m) => ({ label: m.name, sub: m.top ? `事務次官など：${m.top.name}` : '', post: m.post }));
  const i = await ui.pick({ title: '幹部人事', lines: ['どの府省の幹部人事を決める？'], items });
  if (i < 0) return;
  const picks = [['kanbo', '官房の幹部から（順当な人事）'], ['bureau', '局長から（政策の実績を重視）'], ['outside', '外部から起用（政治主導・「忖度」への懸念も）']];
  const k = await ui.pick({ title: `${items[i].label}の幹部人事`, items: picks.map(([, l]) => ({ label: l })) });
  if (k < 0) return;
  await ui.result('幹部人事', safe(() => g.adminAction('kanbu_jinji', { post: items[i].post, pick: picks[k][0] }), null));
}
async function ordinanceFlow(ui, o, op) {
  const segs = Object.entries(op.segments || {}).sort((a, b) => b[1] - a[1]);
  const lines = [`${o.name}：${op.label}`, `${o.kind}は、国会の議決なしに、${o.basis}の委任の範囲で決める。`, `よろこぶ層：${segs.filter(([, v]) => v > 0).map(([s]) => SEG_SHORT[s] || s).join('・') || 'とくになし'}`, `負担を感じる層：${segs.filter(([, v]) => v < 0).map(([s]) => SEG_SHORT[s] || s).join('・') || 'とくになし'}`];
  if (op.cost) lines.push(`財政：年${cho(op.cost)}`);
  const k = await ui.confirm({ title: `${o.kind}を出す`, lines, choices: ['決定する', 'やめる'], cancel: 1, w: 460 });
  if (k !== 0) return;
  await ui.result(o.name, safe(() => ui.g.issueOrdinance(o.id, { option: op.key }), null));
}

// ================================================================ tab 7: 安全保障
const SEC_SUBS = [{ id: 'sdf', label: '自衛隊・防衛' }, { id: 'war', label: '戦争（もしも）' }];
const TAB_SECURITY = {
  id: 'security', label: '安全保障', short: '自衛隊・防衛費・命令（文民統制）・PKO', lesson: 'anpo',
  tip: (ui) => (sub(ui) === 'war' ? 'war_warning' : 'sdf_order'),
  about: '自衛隊の状況・防衛費の推移・命令（文民統制）・PKO・スクランブル。独裁体制の「もしも」では架空の国との戦争',
  terms: (ui) => (sub(ui) === 'war' ? ['独裁', '憲法9条', '文民統制'] : ['自衛隊', '文民統制', '防衛出動', 'PKO協力法', '防衛費', '専守防衛']),
  alert: (ui) => (has(ui.g, 'war') && safe(() => ui.g.war(), null) ? 1 : 0),
  load(ui) {
    const g = ui.g;
    const d = {};
    d.sdf = has(g, 'sdf') ? safe(() => g.sdf(), null) : null;
    d.orders = has(g, 'sdfOrders') ? safe(() => g.sdfOrders(), []) : [];
    d.war = has(g, 'war') ? safe(() => g.war(), null) : null;
    d.warOrders = has(g, 'warOrders') ? safe(() => g.warOrders(), []) : [];
    d.regime = has(g, 'regime') ? safe(() => g.regime(), null) : null;
    d.showWar = !!(d.war || (d.regime && d.regime.id === 'dictatorship'));
    d.log = (has(g, 'regimeNews') ? safe(() => g.regimeNews(40), []) : []).filter((n) => /スクランブル|緊急発進|不審船|PKO|海上警備|災害派遣|自衛隊|国軍/.test(n.text)).slice(0, 8);
    recordDefense(g);
    d.def = uiData(g).def.slice(-14);
    if (!d.showWar && ui.tabState().sub === 'war') ui.tabState().sub = 'sdf';
    return d;
  },
  layout(ui, d) {
    const out = d.showWar ? segCtls(ui, SEC_SUBS, 4, 44) : [];
    if (!d.showWar) ui.tabState().sub = 'sdf';
    if (sub(ui) === 'war') {
      out.push(listCtl(ui, 'wrow', { id: 'wrow', x: 384, y: 174, w: 252, h: 110, y0: 18, rowH: 15, n: d.warOrders.length, why: (u) => { const o = d.warOrders[u.tabState().wrow | 0]; return o ? o.why : null; }, tip: (u) => { const o = d.warOrders[u.tabState().wrow | 0]; return o ? o.desc : ''; }, a: (u) => warFlow(u, d, d.warOrders[u.tabState().wrow | 0]) }));
      out.push(jump('w_map', 4, 64, 376, 186, 'security', '架空の地域（係争地ヴェルミナ諸島）。実在の国・地域とは関係ない', 'war'));
      out[out.length - 1].a = null; out[out.length - 1].nofocus = true;
    } else {
      const y0 = d.showWar ? 64 : 44;
      out.push(listCtl(ui, 'orow', { id: 'orow', x: 450, y: y0, w: 186, h: 168, y0: 18, rowH: 18, n: d.orders.length, why: (u) => { const o = d.orders[u.tabState().orow | 0]; return o ? o.why : null; }, tip: (u) => { const o = d.orders[u.tabState().orow | 0]; return o ? o.desc : ''; }, a: (u) => sdfFlow(u, d, d.orders[u.tabState().orow | 0]) }));
      out.push(jump('s_def', 254, y0, 192, 150, 'budget', '防衛費（防衛関係費）の推移とGDP比。A：予算の画面へ'));
    }
    return out;
  },
  draw(c, ui, d) {
    if (d.showWar) drawSegs(c, ui, SEC_SUBS);
    if (!d.sdf) { panel(c, 4, 64, 632, 272, '安全保障'); para(c, '安全保障のしくみ（regime.js）が読み込まれていない。', 12, 88, 600, 12, K.dim); return; }
    if (sub(ui) === 'war') { drawWar(c, ui, d); return; }
    const y0 = d.showWar ? 64 : 44, H = 336 - y0;
    const S = d.sdf;
    // ---- status
    panel(c, 4, y0, 246, H, `${S.name}（${S.founded}年発足）`, { right: S.agency });
    let yy = y0 + 22;
    T(c, `指揮：内閣総理大臣（最高指揮官）・${S.minister}`, 10, yy, 10, K.text, 'left', 234); yy += 14;
    const per = S.personnel || {};
    T(c, `人員：現員 約${fmtN(num(per.actual) / 10000, 1)}万人／定員 約${fmtN(num(per.quota) / 10000, 1)}万人${per.approx ? '（目安）' : ''}`, 10, yy, 10, K.text, 'left', 234); yy += 12;
    hbar(c, 10, yy, 234, 5, num(per.actual) / Math.max(1, num(per.quota)), K.teal); yy += 10;
    T(c, `防衛費：約${fmtN(S.budget.cho, 2)}兆円${S.budget.gdpPct != null ? `（GDP比 約${fmtN(S.budget.gdpPct, 2)}%）` : ''}`, 10, yy, 10, K.text, 'left', 234); yy += 14;
    T(c, S.pkoLaw ? 'PKO協力法：あり（1992年）' : 'PKO協力法：まだない（1992年に成立）', 10, yy, 10, S.pkoLaw ? K.good : K.dim, 'left', 234); yy += 13;
    if (S.haken) { T(c, `災害派遣中：${S.haken.where}（約${fmtN(S.haken.personnel)}人）`, 10, yy, 10, K.warn, 'left', 234); yy += 13; }
    for (const dp of (S.deployments || []).slice(0, 2)) { T(c, `${dp.kind === 'pko' ? 'PKO' : '派遣'}：${dp.where || dp.mission}（約${fmtN(dp.personnel)}人）`, 10, yy, 10, K.cyan, 'left', 234); yy += 13; }
    if (S.pkoOffer) { T(c, `国連の要請：${S.pkoOffer.mission}（架空）`, 10, yy, 10, K.amber, 'left', 234); yy += 13; }
    if (S.kaijo) { T(c, '不審船の事案：海上保安庁が対応中', 10, yy, 10, K.amber, 'left', 234); yy += 13; }
    T(c, `今年のスクランブル：約${fmtN(S.scrambles)}回`, 10, yy, 10, K.text, 'left', 234); yy += 15;
    T(c, 'ルール', 10, yy, 10, K.amber); yy += 12;
    for (const r of (S.rules || []).slice(0, 2)) yy = para(c, `・${r}`, 10, yy, 234, 10, K.dim, 12, 4) + 2;
    if (yy < y0 + H - 40) para(c, '民主制の日本は、憲法9条のもとで侵略戦争をしない。防衛出動は武力攻撃があったときだけで、閣議決定と国会の承認がいる（文民統制）。', 10, yy + 2, 234, 10, K.faint, 12, Math.max(1, Math.floor((y0 + H - 6 - yy) / 12)));
    // ---- defence budget chart
    const dk = ui.ctls.find((q) => q.id === 's_def');
    panel(c, dk.x, dk.y, dk.w, dk.h, '防衛費の推移', { right: '兆円・GDP比' });
    const yr = yearOf(ui.g);
    const firstGame = d.def.length ? d.def[0].fy : yr;
    const real = DEF_REAL.filter((r) => r.fy < firstGame && r.fy <= yr);
    const pts = [...real.map((r) => ({ fy: r.fy, cho: r.cho, real: true })), ...d.def.map((r) => ({ fy: r.fy, cho: r.cho, pct: r.pct }))].sort((a, b) => a.fy - b.fy).slice(-7);
    const cx = dk.x + 26, cy = dk.y + 22, cw = dk.w - 32, ch = dk.h - 66;
    R(c, cx, cy, cw, ch, '#07111b');
    const mx = Math.max(1, ...pts.map((q) => q.cho)) * 1.2;
    for (const v of [0, mx / 2, mx]) { const y = cy + ch - 1 - Math.round((v / mx) * (ch - 1)); R(c, cx, y, cw, 1, '#0e2131'); T(c, fmtN(v, 0), cx - 3, y - 5, 10, K.faint, 'right'); }
    const bw = Math.max(4, Math.floor(cw / Math.max(1, pts.length)) - 3);
    pts.forEach((q, i) => {
      const bx = cx + 3 + i * (bw + 3), bh = Math.round((q.cho / mx) * (ch - 2));
      R(c, bx, cy + ch - 1 - bh, bw, bh, q.real ? '#3a6d8c' : K.teal);
      T(c, String(q.fy), bx + bw / 2, cy + ch + 1, 10, q.real ? '#5a8db0' : K.teal, 'center', bw + 3);
    });
    T(c, '■実際の当初予算（参考）', dk.x + 6, dk.y + dk.h - 29, 10, '#5a8db0', 'left', dk.w - 12);
    T(c, '■ゲームの中の予算', dk.x + 6, dk.y + dk.h - 17, 10, K.teal, 'left', 100);
    T(c, S.budget.gdpPct != null ? `いまGDP比 ${fmtN(S.budget.gdpPct, 2)}%` : '', dk.x + dk.w - 6, dk.y + dk.h - 17, 10, K.white, 'right', 90);
    // ---- the log
    const ly = dk.y + dk.h + 4;
    panel(c, 254, ly, 192, 336 - ly, '自衛隊の動き（ニュース）');
    let yl = ly + 20;
    if (!d.log.length) T(c, 'まだ大きな動きはない', 260, yl, 10, K.dim, 'left', 180);
    for (const n of d.log) { if (yl > 324) break; yl = para(c, `・${n.text}`, 260, yl, 180, 10, K.text, 11, 2) + 1; }
    // ---- orders
    const ok = ui.ctls.find((q) => q.id === 'orow');
    panel(c, ok.x, ok.y, ok.w, ok.h, '命令（文民統制）');
    drawList(c, ui, ok, (c2, i, x, y, w) => {
      const o = d.orders[i];
      if (o.why) padlock(c2, x + 5, y + 4);
      T(c2, o.name, x + 15, y + 2, 12, o.why ? K.faint : K.text, 'left', w - 18);
    });
    const o = d.orders[ui.tabState().orow | 0];
    const oy = ok.y + ok.h + 4;
    panel(c, 450, oy, 186, 336 - oy, o ? o.name : '命令');
    if (o) {
      let y2 = para(c, o.desc, 456, oy + 20, 174, 10, K.text, 12, 5) + 2;
      if (o.why) para(c, `🔒 ${o.why}`, 456, y2, 174, 10, K.lock, 12, Math.max(1, Math.floor((336 - 4 - y2) / 12)));
    }
  },
};
function drawWar(c, ui, d) {
  const w = d.war;
  const nat = w && RG && RG.FICTIONAL_NATIONS ? RG.FICTIONAL_NATIONS[w.enemy] : null;
  // ---- the map of the fictional region (abstract; no people)
  const x = 4, y = 64, mw = 376, mh = 186;
  panel(c, x, y, mw, mh, '架空の地域の地図（もしも）', { right: '架空の国・地域（実在の国とは無関係）' });
  R(c, x + 1, y + 17, mw - 2, mh - 18, '#0c2236');
  for (let yy = y + 20; yy < y + mh - 2; yy += 3) { const ww = 70 + Math.sin(yy / 16) * 14; R(c, x + 2, yy, ww, 3, '#3a4a2a'); }
  for (let yy = y + 24; yy < y + mh - 2; yy += 3) { const ww = 76 + Math.cos(yy / 19) * 16; R(c, x + mw - 2 - ww, yy, ww, 3, '#4a3a2a'); }
  const ix = x + mw / 2, iy = y + 96;
  for (let i = 0; i < 6; i++) R(c, ix - 26 + (i % 3) * 18, iy - 16 + Math.floor(i / 3) * 18 + (i % 2) * 4, 10, 6, '#6a6a4a');
  T(c, '日本', x + 24, y + 30, 12, K.white);
  if (nat) T(c, nat.short, x + mw - 24, y + 30, 12, K.white, 'right', 120);
  T(c, RG && RG.DISPUTED_AREA ? RG.DISPUTED_AREA.name : '係争地', ix, iy + 26, 10, K.dim, 'center', 140);
  if (w) {
    // the front: from our coast (−100) to theirs (+100)
    const fx = x + 80 + Math.round(((clamp(w.front, -100, 100) + 100) / 200) * (mw - 160));
    for (let yy = y + 20; yy < y + mh - 4; yy += 4) R(c, fx + (Math.floor(yy / 4) % 2), yy, 2, 3, w.front >= 0 ? K.cyan : K.bad);
    T(c, '前線', fx, y + mh - 16, 10, w.front >= 0 ? K.cyan : K.bad, 'center');
    T(c, `戦況：${w.frontText}`, x + 8, y + mh - 16, 10, K.white, 'left', 150);
  } else T(c, 'いまは戦争をしていない', ix, y + mh - 18, 10, K.dim, 'center', 200);
  // ---- casualties and costs (numbers only)
  panel(c, 384, 64, 252, 106, w ? `戦争：${w.enemyName}（架空）` : '戦争（もしも）', { accent: K.danger });
  if (w) {
    const C0 = w.cas;
    const rows = [
      ['自国の兵士', `死者 ${fmtN(C0.soldiers.dead)}人・負傷 ${fmtN(C0.soldiers.wounded)}人`],
      ['自国の民間人', `死者 ${fmtN(C0.civilians.dead)}人・負傷 ${fmtN(C0.civilians.wounded)}人`],
      ['相手国側', `死傷 ${fmtN(num(C0.enemySoldiers) + num(C0.enemyCivilians))}人`],
      ['戦費', `約${fmtN(w.cost, 1)}兆円・家族からの手紙 ${fmtN(w.letters)}通`],
      ['厭戦気分', `${fmtN(w.weariness, 0)}／100・動員 段階${w.mob}`],
    ];
    rows.forEach(([a, b], i) => { T(c, a, 390, 84 + i * 16, 10, K.dim, 'left', 70); T(c, b, 630, 84 + i * 16, 10, K.white, 'right', 170); });
  } else para(c, '独裁体制の「もしも」でだけ、架空の国との戦争になりうる。勝っても制裁・孤立・反乱が待ち、負ければ独裁者の人生は終わる。', 390, 84, 240, 10, K.text, 12, 6);
  const wk = ui.ctls.find((q) => q.id === 'wrow');
  panel(c, wk.x, wk.y, wk.w, wk.h, '戦争の命令（もしも）', { accent: K.danger });
  drawList(c, ui, wk, (c2, i, x2, y2, w2) => {
    const o = d.warOrders[i];
    if (o.why) padlock(c2, x2 + 5, y2 + 3);
    T(c2, o.name, x2 + 15, y2 + 1, 12, o.why ? K.faint : K.text, 'left', w2 - 18);
  });
  const o = d.warOrders[ui.tabState().wrow | 0];
  panel(c, 384, 288, 252, 48, o ? o.name : '');
  if (o) para(c, o.why ? `🔒 ${o.why}` : o.desc, 390, 306, 240, 10, o.why ? K.lock : K.text, 12, 2);
  // ---- log
  panel(c, 4, 254, 376, 82, '戦況の記録');
  const rg = d.regime;
  let yy = 272;
  if (rg) { T(c, `民衆の不満 ${rg.unrest}／100・国際社会の懸念 ${rg.intl}／100・制裁 段階${rg.sanctions}`, 10, yy, 10, rg.unrest >= 60 ? K.bad : K.text, 'left', 364); yy += 13; }
  for (const l of (w ? w.log : []).slice(-3).reverse()) { if (yy > 298) break; T(c, `・${l.text || l}`, 10, yy, 10, K.dim, 'left', 364); yy += 12; }
  para(c, `※${FICTION()}`, 10, 311, 364, 10, K.faint, 12, 2);
}
async function sdfFlow(ui, d, o) {
  if (!o) return;
  const k = await ui.confirm({ title: `命令：${o.name}`, lines: [o.desc, '自衛隊の最高指揮官は内閣総理大臣。命令には法律の根拠がいる（文民統制）。'], choices: ['命令する', 'やめる'], cancel: 1, fiction: o.id === 'kokugun', danger: o.id === 'kokugun', w: 460 });
  if (k !== 0) return;
  await ui.result(o.name, safe(() => ui.g.sdfOrder(o.id), null));
}
async function warFlow(ui, d, o) {
  if (!o) return;
  const g = ui.g;
  let target = null;
  if (o.id === 'declare') {
    const ids = (RG && RG.NATION_ORDER) || [];
    const i = await ui.pick({ title: '相手の国（すべて架空）', lines: ['実在の国・地域とは関係ありません。'], items: ids.map((n) => ({ label: RG.FICTIONAL_NATIONS[n].name, sub: RG.FICTIONAL_NATIONS[n].desc })), w: 480, color: K.danger });
    if (i < 0) return;
    target = ids[i];
  }
  const conseq = {
    declare: '兵士と民間人の命が失われる。国際社会の制裁が強まり、経済は傷つく。勝っても占領への反乱と孤立が続き、負ければ体制は崩れる。',
    mobilize: '予備の要員を召集する。暮らしと経済への負担が大きく、民衆の不満が高まる。',
    offensive: '戦況は動くが、兵士の死傷が増える。',
    defend: '死傷は減るが、戦況は動きにくい。',
    negotiate: '第三国を通じて停戦を探る（4〜8日）。戦況が悪すぎると相手は応じない。停戦しても制裁は残る。',
    surrender: '戦争は終わる。独裁者としての命運も尽き、この人生は終わる（ロードか、はじめから）。',
  }[o.id] || '';
  const k = await ui.confirm({ title: `⚠ ${o.name}`, danger: true, fiction: true, lines: [o.desc, '', `【結果】${conseq}`], choices: ['やめておく', '理解したうえで命令する'], index: 0, cancel: 0, w: 480 });
  if (k !== 1) return;
  if (o.id === 'declare' || o.id === 'surrender') {
    const k2 = await ui.confirm({ title: '最後の確認', danger: true, lines: [o.id === 'declare' ? '本当に宣戦しますか？　多くの人の命とくらしが失われます。' : '本当に降伏しますか？　独裁体制は終わり、この人生も終わります。'], choices: ['やめておく', '命令する'], index: 0, cancel: 0 });
    if (k2 !== 1) return;
  }
  await ui.result(o.name, safe(() => g.warOrder(o.id, target ? { target } : {}), null));
}

// ================================================================ tab 8: 危機管理
const CRISIS_SUBS = [{ id: 'disaster', label: '災害対応' }, { id: 'press', label: '報道の自由' }, { id: 'regime', label: '体制・憲法改正' }];
const PHASES = [['hassei', '発生'], ['hinan', '避難・救助'], ['fukko', '復旧・復興'], ['done', '終了']];
// the 国民投票 projection: regime.js's model (runReferendum REF_BASE) without the random part
const REF_BASE = { young: 0.25, families: 0.32, elderly: 0.42, employees: 0.33, selfemployed: 0.4, business: 0.4, farmers: 0.42, unions: 0.15, urban: 0.28, rural: 0.44, floating: 0.27 };
function referendumProjection(g, rg) {
  const appr = num(safe(() => g.approval(), 40), 40);
  const W = safe(() => segWeights(yearOf(g)), null) || {};
  let yes = 0, ws = 0;
  const bySeg = {};
  for (const s of Object.keys(REF_BASE)) {
    const v = clamp(REF_BASE[s] + (appr - 40) * 0.006 - num(rg && rg.unrest) * 0.001, 0.05, 0.9);
    bySeg[s] = v; yes += num(W[s], 1 / 11) * v; ws += num(W[s], 1 / 11);
  }
  return { yes: ws ? (yes / ws) * 100 : 30, bySeg };
}
// 発議: the votes the player's side can count on (regime.js amendVotes, expected: the own party, fictional partners
// half, a few independents; a real party never). Needs ceil(2/3 × 総議員) in each house.
function amendProjection(g, house) {
  const p = polOf(g);
  const H = p && p.diet[house];
  if (!H) return null;
  const total = num(H.total) || Object.values(H.seats || {}).reduce((a, v) => a + num(v), 0);
  const me = p.me.party;
  const real = (id) => !!(p.parties[id] && (p.parties[id].real || id === 'jimin' || id === 'minshu'));
  let yes = 0;
  if (me && !real(me)) {
    yes += num(H.seats[me]) * 0.97;
    for (const id of p.cabinet.partyIds || []) if (id !== me && !real(id)) yes += num(H.seats[id]) * 0.5;
    yes += num(H.seats.ind) * 0.1;
  }
  return { yes: Math.round(yes), total, need: Math.ceil((total * 2) / 3) };
}
const STEP_CONSEQ = {
  referendum_law: '憲法改正の国民投票の手続きを定める法律案を国会に出す（民主的な手続き）。',
  amend_emergency: '支持率の低下・デモ・国際社会の懸念・党内の造反。衆参それぞれ総議員の3分の2の賛成がなければ発議できない。発議されれば国民投票へ。',
  declare_emergency: '内閣に権限が集まる。最高裁の違憲判断・デモ・国際社会の制裁・民衆の不満が待つ。',
  suspend_elections: '国民が政権を選び直せなくなる。選挙と国会の両方を止めると独裁体制。違憲判決・デモ・制裁。',
  suspend_diet: '法律に代わって政令で国を動かす。選挙と国会の両方を止めると独裁体制。',
  ban_opposition: '与党以外の政党が活動できなくなる。国内外の激しい非難と制裁、民衆の不満。',
  national_army: '9条の制約を無視して軍を動かせるようになる。戦争への道が開かれ、国際社会は孤立を深める。',
  lift_emergency: '緊急事態を解除し、選挙と国会を元に戻す。',
  democratize: '権力を手放して退陣し、民主制に戻す。それまでの行為は法にもとづいて裁かれる（特捜部の捜査）。',
};
const PRESS_CONSEQ = '報道の自由は民主主義の土台。報道の自由度が下がり、支持率の低下・党内の造反・デモ・最高裁の違憲判決（言論規制法）・国際社会の懸念を招く。';
const TAB_CRISIS = {
  id: 'crisis', label: '危機管理', short: '災害対応・報道の自由・体制と憲法改正', lesson: (ui) => (sub(ui) === 'disaster' ? 'saigai' : 'minshu'),
  tip: (ui) => ({ disaster: 'disaster_first', press: 'regime_press', regime: 'amendment' }[sub(ui)] || 'disaster_first'),
  about: '災害への対応（実際の法律と手続き）・報道の自由度・体制と憲法改正の手続き（独裁は架空の「もしも」）',
  terms: (ui) => ({ disaster: ['災害対策基本法', '災害救助法', '激甚災害', '緊急災害対策本部', '災害派遣'], press: ['報道の自由', '検閲', '言論弾圧', '表現の自由'], regime: ['憲法改正', '発議', '国民投票', '緊急事態条項', '立憲主義', '独裁'] }[sub(ui)] || []),
  alert: (ui) => (has(ui.g, 'disaster') && safe(() => ui.g.disaster(), null) ? 1 : 0),
  load(ui) {
    const g = ui.g;
    const d = {};
    d.ds = has(g, 'disaster') ? safe(() => g.disaster(), null) : null;
    d.dacts = has(g, 'disasterActions') ? safe(() => g.disasterActions(), []) : [];
    d.past = has(g, 'disasters') ? safe(() => g.disasters(), []).slice(-5).reverse() : [];
    d.pf = has(g, 'pressFreedom') ? safe(() => g.pressFreedom(), null) : null;
    d.pacts = has(g, 'pressActions') ? safe(() => g.pressActions(), []) : [];
    d.rg = has(g, 'regime') ? safe(() => g.regime(), null) : null;
    d.steps = has(g, 'regimeSteps') ? safe(() => g.regimeSteps(), []) : [];
    d.amend = { shugi: amendProjection(g, 'shugi'), sangi: amendProjection(g, 'sangi') };
    d.ref = referendumProjection(g, d.rg);
    if (ui.tabState().sub == null && !d.ds) ui.tabState().sub = d.rg && d.rg.id !== 'democracy' ? 'regime' : 'disaster';
    return d;
  },
  layout(ui, d) {
    const out = segCtls(ui, CRISIS_SUBS, 4, 44);
    const s = sub(ui);
    if (s === 'disaster') out.push(listCtl(ui, 'darow', { id: 'darow', x: 334, y: 64, w: 302, h: 160, y0: 18, rowH: 17, n: d.dacts.length, why: (u) => { const a = d.dacts[u.tabState().darow | 0]; return a ? a.why : null; }, tip: (u) => { const a = d.dacts[u.tabState().darow | 0]; return a ? a.desc : ''; }, a: (u) => disasterFlow(u, d.dacts[u.tabState().darow | 0]) }));
    else if (s === 'press') out.push(listCtl(ui, 'parow', { id: 'parow', x: 334, y: 64, w: 302, h: 160, y0: 18, rowH: 17, n: d.pacts.length, why: (u) => { const a = d.pacts[u.tabState().parow | 0]; return a ? a.why : null; }, tip: (u) => { const a = d.pacts[u.tabState().parow | 0]; return a ? a.desc : ''; }, a: (u) => pressFlow(u, d.pacts[u.tabState().parow | 0]) }));
    else out.push(listCtl(ui, 'srow', { id: 'srow', x: 334, y: 64, w: 302, h: 172, y0: 18, rowH: 17, n: d.steps.length, why: (u) => { const a = d.steps[u.tabState().srow | 0]; return a ? a.why : null; }, tip: (u) => { const a = d.steps[u.tabState().srow | 0]; return a ? a.desc : ''; }, a: (u) => stepFlow(u, d.steps[u.tabState().srow | 0]) }));
    return out;
  },
  draw(c, ui, d) {
    drawSegs(c, ui, CRISIS_SUBS);
    if (!d.rg) { panel(c, 4, 64, 632, 272, '危機管理'); para(c, '危機管理のしくみ（regime.js）が読み込まれていない。', 12, 88, 600, 12, K.dim); return; }
    const s = sub(ui);
    if (s === 'disaster') drawDisaster(c, ui, d);
    else if (s === 'press') drawPress(c, ui, d);
    else drawRegime(c, ui, d);
  },
};
function actionDesc(c, ui, list, key, y, title) {
  const a = list[ui.tabState()[key] | 0];
  panel(c, 334, y, 302, 336 - y, a ? a.name : title);
  if (!a) return;
  let yy = para(c, a.desc, 340, y + 20, 290, 10, K.text, 12, 5) + 3;
  if (a.why) para(c, `🔒 ${a.why}`, 340, yy, 290, 10, K.lock, 12, Math.max(1, Math.floor((336 - 4 - yy) / 12)));
}
function drawDisaster(c, ui, d) {
  const ds = d.ds;
  panel(c, 4, 64, 326, 272, ds ? ds.name : '災害（いまはない）', { right: ds ? ds.tierName : '', accent: ds ? K.warn : K.amber });
  if (!ds) {
    let yy = para(c, 'いま対応が必要な災害はない。災害が起きると、ここに被害と対応の段階が出る（災害はすべて架空の地名）。', 10, 84, 314, 10, K.text, 12, 3) + 6;
    T(c, 'これまでの災害', 10, yy, 10, K.amber); yy += 12;
    if (!d.past.length) T(c, 'まだない', 16, yy, 10, K.dim);
    for (const p of d.past) { T(c, `${p.name}：死者 ${fmtN(p.dead)}人・避難 ${fmtN(p.evac)}人${p.score != null ? `・対応の評価 ${p.score}` : ''}`, 16, yy, 10, K.text, 'left', 308); yy += 12; }
  } else {
    let yy = 84;
    T(c, `${ds.where || ds.place}${(ds.kind === 'quake' || ds.kind === 'tsunami') && ds.mag ? `・M${fmtN(ds.mag, 1)}・最大震度${ds.shindo || '—'}` : ''}`, 10, yy, 10, K.text, 'left', 314); yy += 14;
    PHASES.forEach(([k, lab], i) => {
      const at = PHASES.findIndex(([q]) => q === ds.phase);
      const bx = 10 + i * 78;
      frame(c, bx, yy, 72, 15, i === at ? '#3a2a0a' : i < at ? '#0f2a1a' : '#0b1621', i === at ? K.amber : i < at ? K.good : K.edge);
      T(c, lab, bx + 36, yy + 2, 10, i === at ? K.amber : i < at ? K.good : K.dim, 'center', 68);
    });
    yy += 22;
    const kn = ds.known || {};
    [['死者', kn.dead], ['行方不明', kn.missing], ['けが人', kn.injured], ['避難', kn.evac], ['住宅の被害', kn.houses]].forEach(([a, v], i) => {
      const bx = 10 + (i % 3) * 104, by = yy + Math.floor(i / 3) * 28;
      R(c, bx, by, 100, 26, '#0a1824');
      T(c, a, bx + 4, by + 1, 10, K.dim, 'left', 92);
      T(c, `${fmtN(v)}${a === '住宅の被害' ? '棟' : '人'}`, bx + 96, by + 12, 12, K.white, 'right', 92);
    });
    yy += 60;
    T(c, `政府：${ds.honbuName || '対策本部はまだない'}`, 10, yy, 10, ds.honbuName ? K.good : K.warn, 'left', 314); yy += 13;
    yy = para(c, ds.summary || '', 10, yy, 314, 10, K.text, 12, 3) + 4;
    T(c, '対応の記録', 10, yy, 10, K.amber); yy += 12;
    for (const l of (ds.log || []).slice(-6).reverse()) { if (yy > 324) break; T(c, `・${safe(() => dateLabel(ui.g, l.day).replace(/^\d+年/, ''), '')} ${l.text}`, 14, yy, 10, K.dim, 'left', 310); yy += 12; }
  }
  const k = ui.ctls.find((q) => q.id === 'darow');
  const ROLE_JA = { pm: '総理', defmin: '防衛', finmin: '財務', minister: '大臣', chiji: '知事', kucho: '区長', local: '地方議員', diet: '国会議員', celebrity: '芸能人', citizen: '市民' };
  panel(c, k.x, k.y, k.w, k.h, 'できる対応', { right: ds ? `立場：${(ds.roles || []).map((r) => ROLE_JA[r] || r).join('・')}` : '' });
  drawList(c, ui, k, (c2, i, x, y, w) => { const a = d.dacts[i]; if (a.why) padlock(c2, x + 5, y + 4); T(c2, a.name, x + 15, y + 2, 12, a.why ? K.faint : K.text, 'left', w - 18); }, { empty: ds ? 'いまの立場でできる対応はない' : '災害が起きると、ここに対応が出る' });
  actionDesc(c, ui, d.dacts, 'darow', 228, '対応');
}
async function disasterFlow(ui, a) {
  if (!a) return;
  const k = await ui.confirm({ title: a.name, lines: [a.desc], choices: ['実行する', 'やめる'], cancel: 1, w: 460 });
  if (k !== 0) return;
  await ui.result(a.name, safe(() => ui.g.disasterAction(a.id), null));
}
function drawPress(c, ui, d) {
  const pf = d.pf;
  panel(c, 4, 64, 326, 272, '報道の自由度（ゲーム内の指標）', { right: pf ? `${pf.value}／100・${pf.label}` : '' });
  if (!pf) return;
  gauge(c, 80, 140, 56, pf.value / 100, K.good, { zones: [K.bad, K.warn, K.good] });
  T(c, String(pf.value), 80, 146, 16, K.white, 'center');
  T(c, pf.label, 80, 166, 10, pf.value >= 60 ? K.good : pf.value >= 40 ? K.warn : K.bad, 'center', 120);
  T(c, `基準（いまの体制）${pf.baseline}`, 150, 92, 10, K.dim, 'left', 174);
  T(c, `拘束された記者：${fmtN(pf.detained)}人`, 150, 106, 10, pf.detained ? K.bad : K.dim, 'left', 174);
  T(c, `検閲：${pf.censorship ? 'あり（もしも）' : 'なし'}`, 150, 120, 10, pf.censorship ? K.bad : K.dim, 'left', 174);
  spark(c, (pf.history || []).slice(-40).map((h) => num(h.v, NaN)), 150, 134, 174, 34, K.cyan, { min: 0, max: 100 });
  let yy = 184;
  T(c, '最近の動き', 10, yy, 10, K.amber); yy += 12;
  const hist = (pf.history || []).slice(-5).reverse();
  if (!hist.length) T(c, '報道への圧力はない', 16, yy, 10, K.dim);
  for (const h of hist) { T(c, `・${safe(() => dateLabel(ui.g, h.day).replace(/^\d+年/, ''), '')} ${h.v}${h.why ? `（${h.why}）` : ''}`, 16, yy, 10, K.text, 'left', 308); yy += 12; }
  para(c, '民主制では、報道への圧力をかけても検閲はできない（憲法21条）。圧力は強い反発をまねき、時間がたつと指標は戻っていく。', 10, Math.max(yy + 6, 270), 314, 10, K.faint, 12, 5);
  const k = ui.ctls.find((q) => q.id === 'parow');
  panel(c, k.x, k.y, k.w, k.h, '報道に関する行為', { accent: K.danger });
  drawList(c, ui, k, (c2, i, x, y, w) => { const a = d.pacts[i]; if (a.why) padlock(c2, x + 5, y + 4); T(c2, a.name, x + 15, y + 2, 12, a.why ? K.faint : '#ffc8cc', 'left', w - 18); });
  actionDesc(c, ui, d.pacts, 'parow', 228, '行為');
}
async function pressFlow(ui, a) {
  if (!a) return;
  const auth = !['release', 'disclosure'].includes(a.id) || a.id === 'disclosure';
  const k = await ui.confirm({ title: `⚠ ${a.name}`, danger: true, fiction: (a.regimes || []).some((r) => r !== 'democracy'), lines: [a.desc, '', `【この行為の結果】${a.id === 'release' ? '拘束した記者を解放し、検閲をやめる。報道の自由度は戻りはじめる。' : PRESS_CONSEQ}`], choices: a.id === 'release' ? ['実行する', 'やめる'] : ['やめておく', '理解したうえで実行する'], index: 0, cancel: a.id === 'release' ? 1 : 0, w: 480 });
  if ((a.id === 'release' && k !== 0) || (a.id !== 'release' && k !== 1)) return;
  void auth;
  await ui.result(a.name, safe(() => ui.g.pressAction(a.id), null));
}
function drawRegime(c, ui, d) {
  const rg = d.rg;
  const g = ui.g;
  panel(c, 4, 64, 326, 118, '体制', { right: rg.label });
  const ladder = [['democracy', '民主制'], ['emergency', '緊急事態'], ['dictatorship', '独裁'], ['fallen', '崩壊']];
  ladder.forEach(([id, lab], i) => {
    const bx = 10 + i * 79, on = rg.id === id;
    const col = RG && RG.REGIME_INFO && RG.REGIME_INFO[id] ? RG.REGIME_INFO[id].color : K.dim;
    frame(c, bx, 86, 72, 18, on ? shade(col, -0.6) : '#0b1621', on ? col : K.edge);
    T(c, lab, bx + 36, 89, 12, on ? K.white : K.dim, 'center', 68);
    if (i < 3) T(c, '→', bx + 75, 89, 10, K.faint, 'center');
  });
  para(c, `（${rg.labelWhy || ''}）`, 10, 110, 314, 10, K.dim, 12, 2);
  [['民衆の不満', rg.unrest, K.bad], ['国際社会の懸念', rg.intl, K.warn]].forEach(([a, v, col], i) => {
    T(c, a, 10, 136 + i * 14, 10, K.dim, 'left', 90);
    hbar(c, 100, 139 + i * 14, 170, 6, num(v) / 100, col);
    T(c, `${v}`, 324, 136 + i * 14, 10, K.white, 'right', 40);
  });
  T(c, rg.sanctions ? `国際社会の制裁：段階${rg.sanctions}` : '国際社会の制裁：なし', 10, 164, 10, rg.sanctions ? K.bad : K.dim, 'left', 314);
  // the amendment path
  panel(c, 4, 186, 326, 150, '憲法改正の手続き（憲法96条）', { right: rg.amend ? { referendum: '国民投票待ち', passed: '改正された', rejected: '国民投票で否決', failed: '発議されず' }[rg.amend.stage] || '' : '' });
  let yy = 206;
  const voted = rg.amend && rg.amend.votes ? rg.amend.votes : null;
  for (const [hk, name] of [['shugi', '衆議院'], ['sangi', '参議院']]) {
    const A = voted ? voted[hk === 'shugi' ? 's' : 'a'] : d.amend[hk];
    if (!A) continue;
    T(c, `${name}：${voted ? '発議の採決 賛成' : '賛成の見込み'} ${A.yes}／必要 ${A.need}（総議員${A.total}の3分の2）`, 10, yy, 10, A.yes >= A.need ? K.good : K.text, 'left', 314);
    hbar(c, 10, yy + 13, 314, 6, A.yes / Math.max(1, A.total), A.yes >= A.need ? K.good : K.warn);
    R(c, 10 + Math.round((A.need / Math.max(1, A.total)) * 314), yy + 11, 1, 10, K.amber);
    yy += 26;
  }
  const A0 = rg.amend;
  const refLine = A0 && A0.result ? `国民投票の結果：賛成 ${fmtN(A0.result.yes, 1)}%（投票率 ${fmtN(A0.result.turnout, 1)}%）`
    : A0 && A0.stage === 'referendum' ? `国民投票：${safe(() => dateLabel(g, A0.voteDay), '')}・見込み 賛成 約${fmtN(d.ref.yes, 0)}%`
      : `国民投票の見込み（強権型の緊急事態条項）：賛成 約${fmtN(d.ref.yes, 0)}%`;
  T(c, refLine, 10, yy, 10, d.ref.yes > 50 ? K.warn : K.text, 'left', 314); yy += 13;
  const segs = Object.entries(A0 && A0.result && A0.result.bySeg ? Object.fromEntries(Object.entries(A0.result.bySeg).map(([k, v]) => [k, num(v) / 100])) : d.ref.bySeg);
  segs.forEach(([s, v], i) => {
    const bx = 10 + i * 28;
    const bh = Math.round(v * 22);
    R(c, bx, yy + 22 - bh, 20, bh, K.cyan); R(c, bx, yy, 20, 22 - bh, '#14202c');
    R(c, bx - 1, yy + 11, 22, 1, K.amber);
    T(c, (SEG_SHORT[s] || s).slice(0, 2), bx + 10, yy + 23, 10, K.faint, 'center', 28);
  });
  yy += 36;
  para(c, '※見込みは目安。発議は議員一人ひとりの判断、国民投票は層ごとの投票で決まる。実在の政党はこの改正に賛成しない。', 10, Math.min(yy, 312), 314, 10, K.faint, 11, 2);
  const k = ui.ctls.find((q) => q.id === 'srow');
  panel(c, k.x, k.y, k.w, k.h, '体制の手続き', { accent: K.danger });
  drawList(c, ui, k, (c2, i, x, y, w) => { const a = d.steps[i]; if (a.why) padlock(c2, x + 5, y + 4); T(c2, a.name, x + 15, y + 2, 12, a.why ? K.faint : a.auth ? '#ffc8cc' : K.text, 'left', w - 18); });
  const a = d.steps[ui.tabState().srow | 0];
  const y0 = 240;
  panel(c, 334, y0, 302, 96, a ? a.name : '手続き');
  if (a) {
    let y2 = para(c, a.desc, 340, y0 + 20, 290, 10, K.text, 12, 3) + 2;
    if (a.why) para(c, `🔒 ${a.why}`, 340, y2, 290, 10, K.lock, 12, Math.max(1, Math.floor((336 - 4 - y2) / 12)));
    else para(c, `【結果】${STEP_CONSEQ[a.id] || ''}`, 340, y2, 290, 10, '#ffb0b8', 12, 3);
  }
  void g;
}
async function stepFlow(ui, a) {
  if (!a) return;
  const g = ui.g;
  const auth = a.auth;
  const lines = [a.desc, '', `【この手続きの結果】${STEP_CONSEQ[a.id] || ''}`];
  if (auth) lines.push('', '⚠ 憲法と法律の手続きを守るのが立憲主義。権力が1か所に集まると、チェックする人がいなくなる。');
  const k = await ui.confirm({ title: `${auth ? '⚠ ' : ''}体制の手続き：${a.name}`, danger: auth, fiction: auth || a.id === 'democratize' || a.id === 'lift_emergency', lines, choices: auth ? ['やめておく', '理解したうえで進める'] : ['進める', 'やめる'], index: 0, cancel: auth ? 0 : 1, w: 490 });
  if ((auth && k !== 1) || (!auth && k !== 0)) return;
  if (auth && ['suspend_elections', 'suspend_diet', 'ban_opposition', 'national_army'].includes(a.id)) {
    const k2 = await ui.confirm({ title: '最後の確認', danger: true, lines: ['本当に進めますか？　国民の自由と権利が大きく損なわれます。', `（${FICTION()}）`], choices: ['やめておく', '進める'], index: 0, cancel: 0 });
    if (k2 !== 1) return;
  }
  if (has(g, 'assistTip')) safe(() => g.assistTip(a.id === 'democratize' || a.id === 'lift_emergency' ? 'regime_emergency' : 'regime_dictator'));
  await ui.result(a.name, safe(() => g.regimeStep(a.id), null));
}

// ================================================================ tab 9: 思想
const IDEO_AXES_FALLBACK = [{ id: 'econ', name: '経済', left: '平等・計画', right: '市場・自由' }, { id: 'power', name: '権力', left: '自由・分権', right: '権威・集権' }];
const axesList = () => (ID && Array.isArray(ID.IDEO_AXES) ? ID.IDEO_AXES : IDEO_AXES_FALLBACK);
const PLOT = { x: 36, y: 86, s: 214 };
const TAB_IDEOLOGY = {
  id: 'ideology', label: '思想', short: '思想のコンパス・考えの変化・党の理念', lesson: 'minshu',
  tip: 'govt_ideology',
  about: '思想のコンパス（7つの軸から2つ）：あなた・政党・議員の位置。あなたの考え方の変化、党の理念、思想じてん',
  terms: ['保守', 'リベラル', '右派', '左派', 'ポピュリズム', 'ナショナリズム'],
  load(ui) {
    const g = ui.g, p = polOf(g);
    const st = ui.tabState();
    const axes = axesList();
    st.ax = clamp(num(st.ax, 0), 0, axes.length - 1);
    st.ay = clamp(num(st.ay, 1), 0, axes.length - 1);
    const d = { p, axes, ok: has(g, 'ideology') && has(g, 'ideologyOf') };
    if (!d.ok) return d;
    d.me = safe(() => g.ideology(), null);
    d.parties = Object.keys(p.parties || {}).filter((id) => p.parties[id] && !p.parties[id].dissolved).map((id) => ({ id, ...(safe(() => g.ideologyOf('party', id), null) || {}) })).filter((x) => x.axes);
    const npcIds = new Set();
    for (const pt of Object.values(p.parties || {})) if (pt && pt.leader && pt.leader !== 'player') npcIds.add(pt.leader);
    for (const w of Object.values(p.cabinet.ministers || {})) if (w && w !== 'player') npcIds.add(w);
    if (p.cabinet.pm && p.cabinet.pm !== 'player') npcIds.add(p.cabinet.pm);
    d.npcs = [...npcIds].slice(0, 30).map((id) => safe(() => g.ideologyOf('npc', id), null)).filter((x) => x && x.axes);
    const myParty = p.me.party && p.parties[p.me.party];
    d.myParty = myParty || null;
    d.partyWhy = !myParty ? '政党に入っていない（理念を決めるのは党首）' : (myParty.real || myParty.id === 'jimin' || myParty.id === 'minshu') ? '実在の政党の理念は、その党の綱領で決まっている' : myParty.leader !== 'player' ? '党の理念を決められるのは党首だけ' : has(g, 'setPartyIdeology') ? null : '思想のしくみが読み込まれていない';
    return d;
  },
  layout(ui, d) {
    const out = [];
    const st = ui.tabState();
    if (!d.ok) return out;
    out.push({ kind: 'btn', id: 'ax', x: 8, y: 62, w: 132, h: 16, why: null, tip: '横軸の思想の軸。←→で変える', lr: (u, dir) => { st.ax = (st.ax + dir + d.axes.length) % d.axes.length; if (st.ax === st.ay) st.ax = (st.ax + dir + d.axes.length) % d.axes.length; u.dirty(); } });
    out.push({ kind: 'btn', id: 'ay', x: 142, y: 62, w: 132, h: 16, why: null, tip: '縦軸の思想の軸。←→で変える', lr: (u, dir) => { st.ay = (st.ay + dir + d.axes.length) % d.axes.length; if (st.ay === st.ax) st.ay = (st.ay + dir + d.axes.length) % d.axes.length; u.dirty(); } });
    out.push(btn({ id: 'npcs', x: 8, y: 318, w: 266, h: 16, label: st.hideNpc ? '議員の点：かくしている（Aで表示）' : '議員の点：表示中（Aでかくす）', why: null, tip: '総理・閣僚・党首など、議員の位置（党の路線＋一人ひとりの考え）', a: (u) => { st.hideNpc = !st.hideNpc; u.dirty(); } }));
    out.push(listCtl(ui, 'prow', { id: 'prow', x: 280, y: 146, w: 356, h: 100, y0: 18, rowH: 14, n: d.parties.length, tip: (u) => { const pt = d.parties[u.tabState().prow | 0]; return pt ? `${pt.name}：${pt.label}（${pt.basis === 'self' ? '党の綱領などの言葉から' : pt.basis === 'declared' ? '党首が決めた理念' : '公約と路線から推定'}）` : ''; }, a: async (u) => {
      const pt = d.parties[u.tabState().prow | 0];
      if (!pt) return;
      const ids = (pt.ideologyIds || []).filter((id) => ID && ID.ideologyById && ID.ideologyById(id));
      const nm = (id) => (ID && ID.ideologyName ? ID.ideologyName(id) : id);
      const k = await u.confirm({ title: pt.name, lines: partyIdeoLines(pt), choices: [...ids.map((id) => `思想じてんで読む：${nm(id)}`), 'とじる'], cancel: ids.length, w: 480 });
      if (k >= 0 && k < ids.length) await u.navi(`ideology:${ids[k]}`);
    } }));
    out.push(btn({ id: 'i_party', x: 286, y: 122, w: 112, h: 18, label: '理念を決める', why: d.partyWhy, tip: '自分が党首の政党の理念（1つか2つ）を決める', a: (u) => partyIdeoFlow(u, d) }));
    out.push(btn({ id: 'i_book', x: 402, y: 122, w: 112, h: 18, label: '思想じてんで読む', why: has(ui.g, 'navi') ? null : '政治ナビが読み込まれていない', tip: 'いちばん近い思想の、考え・歴史・実際に起きたことを読む', a: (u) => u.navi(`ideology:${(d.me && d.me.ideologyId) || 'democracy'}`) }));
    out.push(btn({ id: 'i_quiz', x: 518, y: 122, w: 112, h: 18, label: '思想しんだん', why: has(ui.g, 'navi') ? null : '政治ナビが読み込まれていない', tip: '20の問いで、自分の考えの位置を見る', a: (u) => u.navi('quiz') }));
    out.push(listCtl(ui, 'hrow', { id: 'hrow', x: 280, y: 250, w: 356, h: 86, y0: 18, rowH: 13, n: d.me ? (d.me.history || []).length : 0, tip: (u) => { const h = ((d.me && d.me.history) || []).slice().reverse()[u.tabState().hrow | 0]; return h ? h.why : ''; }, a: null }));
    return out;
  },
  draw(c, ui, d) {
    const g = ui.g;
    const st = ui.tabState();
    panel(c, 4, 44, 272, 292, '思想のコンパス');
    if (!d.ok) { para(c, '思想のしくみ（ideology.js）が読み込まれていない。', 10, 66, 260, 12, K.dim); return; }
    const AX = d.axes[st.ax], AY = d.axes[st.ay];
    for (const [id, A, lab] of [['ax', AX, '横'], ['ay', AY, '縦']]) {
      const k = ui.ctls.find((q) => q.id === id);
      const sel = ui.focus === 'body' && ui.cur.ideology === id;
      frame(c, k.x, k.y, k.w, k.h, sel ? '#1a3346' : '#0b1621', sel ? K.amber : K.edge);
      T(c, `${lab}：◀ ${A.name} ▶`, k.x + k.w / 2, k.y + 2, 12, sel ? K.white : K.text, 'center', k.w - 6);
    }
    const { x, y, s } = PLOT;
    R(c, x, y, s, s, '#07111b');
    R(c, x + s / 2, y, 1, s, K.ghost); R(c, x, y + s / 2, s, 1, K.ghost);
    for (let i = 0; i <= 4; i++) { R(c, x + Math.round((i * s) / 4), y + s, 1, 3, K.faint); R(c, x - 3, y + Math.round((i * s) / 4), 3, 1, K.faint); }
    T(c, AX.left, x, y + s + 4, 10, K.dim, 'left', s / 2 - 4);
    T(c, AX.right, x + s, y + s + 4, 10, K.dim, 'right', s / 2 - 4);
    T(c, AY.right, x + 3, y + 2, 10, K.dim, 'left', s - 6);
    T(c, AY.left, x + 3, y + s - 13, 10, K.dim, 'left', s - 6);
    const px = (a) => x + Math.round(((clamp(num(a[AX.id]), -1, 1) + 1) / 2) * (s - 1));
    const py = (a) => y + s - 1 - Math.round(((clamp(num(a[AY.id]), -1, 1) + 1) / 2) * (s - 1));
    if (!st.hideNpc) for (const n of d.npcs) R(c, px(n.axes) - 1, py(n.axes) - 1, 2, 2, shade(partyColorOf(g, n.party), -0.1));
    const selP = d.parties[st.prow | 0];
    // labels never overlap: each tries right / left / above / below of its point, else it is left out (the list names it)
    const placed = [];
    const label = (s2, X, Y, col, must = false) => {
      const w = Math.min(60, measure(c, s2, 10)), h = 11;
      const spots = [[X + 6, Y - 5], [X - 6 - w, Y - 5], [X - w / 2, Y - 17], [X - w / 2, Y + 6]];
      for (const [lx, ly] of spots) {
        const r = { x: lx - 1, y: ly - 1, w: w + 2, h: h + 2 };
        if (lx < x || lx + w > x + s || ly < y || ly + h > y + s) continue;
        if (placed.some((q) => q.x < r.x + r.w && r.x < q.x + q.w && q.y < r.y + r.h && r.y < q.y + q.h)) continue;
        placed.push(r);
        T(c, s2, lx, ly, 10, col, 'left', 60);
        return true;
      }
      if (!must) return false;
      // the player's own label always shows (over a point if it must), on a dark plate
      const [lx, ly] = spots.find(([lx2, ly2]) => lx2 >= x && lx2 + w <= x + s && ly2 >= y && ly2 + h <= y + s) || spots[0];
      R(c, lx - 1, ly - 1, w + 2, h + 2, '#05090e');
      placed.push({ x: lx - 1, y: ly - 1, w: w + 2, h: h + 2 });
      T(c, s2, lx, ly, 10, col, 'left', 60);
      return true;
    };
    const meXY = d.me ? [px(d.me.axes), py(d.me.axes)] : null;
    if (meXY) placed.push({ x: meXY[0] - 6, y: meXY[1] - 6, w: 13, h: 13 });
    for (const pt of d.parties) {
      const X = px(pt.axes), Y = py(pt.axes);
      R(c, X - 3, Y - 3, 7, 7, '#020406'); R(c, X - 2, Y - 2, 5, 5, partyColorOf(g, pt.id));
      placed.push({ x: X - 4, y: Y - 4, w: 9, h: 9 });
    }
    if (meXY) {
      const [X, Y] = meXY;
      const bl = Math.floor(ui.t / 15) % 2 === 0;
      R(c, X - 1, Y - 5, 3, 11, bl ? K.amber : K.white); R(c, X - 5, Y - 1, 11, 3, bl ? K.amber : K.white);
      label('あなた', X, Y, K.amber, true);
    }
    for (const pt of d.parties) {
      const X = px(pt.axes), Y = py(pt.axes);
      const on = selP && selP.id === pt.id;
      if (on) frame(c, X - 5, Y - 5, 11, 11, null, K.white);
      label(pt.short || pt.name, X, Y, on ? K.white : partyColorOf(g, pt.id));
    }
    drawBtn(c, ui, ui.ctls.find((q) => q.id === 'npcs'), { center: true });
    // ---- you
    const me = d.me;
    panel(c, 280, 44, 356, 98, 'あなたの考え方', { right: me ? (me.formed ? '形成された' : 'まだ形成中') : '' });
    if (me) {
      T(c, me.labelText || me.label, 286, 64, 12, K.white, 'left', 344);
      T(c, `近い思想：${(me.top3 || []).map((t) => `${t.name} ${t.match}%`).join('・')}`, 286, 80, 10, K.text, 'left', 344);
      if (me.party) T(c, `${me.party.name}の路線（${me.party.label}）との距離 ${fmtN(me.party.distance, 2)}${me.party.far ? '：ずれが大きい（党内の評価が下がる）' : ''}`, 286, 94, 10, me.party.far ? K.bad : K.dim, 'left', 344);
      if (me.quiz) T(c, `思想しんだんの結果：${ID && ID.ideologyName ? ID.ideologyName(me.quiz.id) : me.quiz.id}`, 286, 108, 10, K.cyan, 'left', 344);
    }
    for (const id of ['i_party', 'i_book', 'i_quiz']) drawBtn(c, ui, ui.ctls.find((q) => q.id === id), { center: true, color: id === 'i_party' ? K.amber : K.teal });
    // ---- parties
    const pk = ui.ctls.find((q) => q.id === 'prow');
    panel(c, pk.x, pk.y, pk.w, pk.h, '政党の理念・路線', { right: 'A：くわしく' });
    drawList(c, ui, pk, (c2, i, x2, y2, w2) => {
      const pt = d.parties[i];
      R(c2, x2 + 4, y2 + 3, 4, 8, partyColorOf(g, pt.id));
      T(c2, pt.name, x2 + 12, y2 + 1, 10, K.text, 'left', 110);
      T(c2, pt.label, x2 + 126, y2 + 1, 10, K.cyan, 'left', w2 - 200);
      T(c2, pt.basis === 'self' ? '党の綱領など' : pt.basis === 'declared' ? '党首が決定' : '公約から推定', x2 + w2 - 4, y2 + 1, 10, K.faint, 'right', 70);
    });
    // ---- history
    const hk = ui.ctls.find((q) => q.id === 'hrow');
    panel(c, hk.x, hk.y, hk.w, hk.h, 'あなたの思想の変化');
    const hist = ((me && me.history) || []).slice().reverse();
    drawList(c, ui, hk, (c2, i, x2, y2, w2) => {
      const h = hist[i];
      T(c2, safe(() => dateLabel(g, h.day).replace(/上旬|中旬|下旬/, ''), ''), x2 + 4, y2, 10, K.faint, 'left', 84);
      T(c2, h.why, x2 + 90, y2, 10, K.text, 'left', w2 - 160);
      if (h.label) T(c2, `→${h.label}`, x2 + w2 - 4, y2, 10, K.amber, 'right', 66);
    }, { empty: 'まだ記録はない（投票・入党・決断で動く）' });
  },
};
function partyIdeoLines(pt) {
  const out = [`理念：${pt.label || '—'}`];
  if (!pt.note) out.push(pt.basis === 'self' ? '（実在の政党：党自身の綱領・宣言の言葉から。ゲームの判断ではない）' : pt.basis === 'declared' ? '（党首が決めた理念）' : '（架空の政党：公約と路線からの推定）');
  for (const q of (pt.quotes || []).slice(0, 4)) out.push(`「${q.text}」— ${q.source}`);
  if (pt.note) out.push(pt.note);
  for (const s of (pt.sources || []).slice(0, 2)) out.push(`出典：${s.title}`);
  return out;
}
async function partyIdeoFlow(ui, d) {
  const g = ui.g;
  if (!ID) return;
  const ids = [...(ID.IDEOLOGY_ORDER || []), ...(ID.COMMUNISM_ORDER || [])].filter((id) => (ID.isSelectable ? ID.isSelectable(id) : true));
  const nameOf = (id) => (ID.ideologyName ? ID.ideologyName(id) : id);
  const ent = (id) => (ID.ideologyById ? ID.ideologyById(id) : null);
  const items = ids.map((id) => ({ label: nameOf(id), sub: (ent(id) || {}).short || '', id }));
  const i = await ui.pick({ title: `${d.myParty.name}の理念（1つめ）`, lines: ['党の理念を1つか2つえらぶ。どの思想にも、支持する人と批判する人がいる。'], items, w: 440 });
  if (i < 0) return;
  const pick = [ids[i]];
  const j = await ui.pick({ title: '2つめ（えらばなくてもよい）', items: [{ label: '1つだけにする', id: null }, ...items.filter((x) => x.id !== ids[i])], w: 440 });
  if (j > 0) pick.push(items.filter((x) => x.id !== ids[i])[j - 1].id);
  const r = safe(() => g.setPartyIdeology(d.myParty.id, pick), null);
  await ui.result('党の理念', r ? { ...r, text: r.ok ? `${d.myParty.name}の理念を「${pick.map(nameOf).join('・')}」にした。` : r.why } : null);
}

// ================================================================ tab 10: 社会・宗教
const SOC_SUBS = [{ id: 'religion', label: '宗教と政教分離' }, { id: 'postal', label: '郵政' }];
const REL_ACTIONS = [
  ['visit', '行事を訪ねる（敬意をもって交流）'], ['ask_support', '選挙の推薦をお願いする'], ['public_money', '公金で団体を支援する'],
  ['report', '被害の相談・報道を確かめる'], ['victim_support', '被害者の支援に取り組む'], ['diet_question', '国会で質問する'],
  ['question_power', '報告徴収・質問権を使う（所轄庁）'], ['request_dissolution', '解散命令を請求する（所轄庁）'],
];
const TAB_SOCIETY = {
  id: 'society', label: '社会・宗教', short: '架空の宗教団体と政教分離・郵政', lesson: 'kenpo',
  tip: (ui) => (sub(ui) === 'postal' ? 'govt_postal' : 'govt_religion'),
  about: '架空の宗教団体と政教分離（憲法20条・89条、宗教法人法）・郵政事業の歩みと郵政民営化',
  terms: (ui) => (sub(ui) === 'postal' ? ['郵政民営化', '日本郵政公社', '民営化', '財政投融資'] : ['信教の自由', '政教分離', '宗教法人法', '組織票']),
  load(ui) {
    const g = ui.g;
    const d = {};
    d.rel = has(g, 'religion') ? safe(() => g.religion(), null) : null;
    d.postal = has(g, 'postal') ? safe(() => g.postal(), null) : null;
    d.R = (kind, opts) => (has(g, 'govtRefusal') ? safe(() => g.govtRefusal(kind, opts || {}), null) : '政府のしくみが読み込まれていない');
    d.role = ui.role0;
    return d;
  },
  layout(ui, d) {
    const out = segCtls(ui, SOC_SUBS, 4, 44);
    const st = ui.tabState();
    if (sub(ui) === 'religion') {
      const groups = d.rel ? d.rel.groups : [];
      out.push(listCtl(ui, 'grow', { id: 'grow', x: 4, y: 64, w: 196, h: 272, y0: 18, rowH: 30, n: groups.length, tip: (u) => { const gr = groups[u.tabState().grow | 0]; return gr ? `${gr.name}（架空の団体）：${gr.kind}` : ''; }, a: null }));
      const gr = groups[st.grow | 0];
      // the core's side-effect-free check for every action kind (govtRefusal('religion', { group, action }))
      const whyOfAct = (kind) => {
        if (!gr) return '団体をえらぶ';
        return d.R('religion', { group: gr.id, action: kind });
      };
      d.acts = REL_ACTIONS.map(([id, label]) => ({ id, label, why: whyOfAct(id) }));
      out.push(listCtl(ui, 'rarow', { id: 'rarow', x: 424, y: 64, w: 212, h: 150, y0: 18, rowH: 16, n: d.acts.length, why: (u) => { const a = d.acts[u.tabState().rarow | 0]; return a ? a.why : null; }, tip: (u) => { const a = d.acts[u.tabState().rarow | 0]; return a ? a.label : ''; }, a: (u) => religionFlow(u, d, gr, d.acts[u.tabState().rarow | 0]) }));
      out.push(btn({ id: 'r_law', x: 424, y: 218, w: 212, h: 118, kind: 'panel', why: null, tip: '信教の自由と政教分離の法律（A：全文）', a: (u) => u.info('信教の自由と政教分離', (d.rel && d.rel.law) || [], { w: 520 }) }));
    } else {
      const P = d.postal;
      const block = P ? (P.open ? d.R('postal') : P.block) : '政府のしくみが読み込まれていない';
      out.push(btn({ id: 'p_bill', x: 324, y: 294, w: 312, h: 20, label: '郵政民営化法案を出す', color: K.amber, why: block || (d.role && (d.role.diet || d.role.pm || d.role.kind === 'minister') ? null : '法律案を出せるのは国会議員か内閣だけ'), tip: '郵政民営化の法案を国会に出す（大きな議論になる）', a: (u) => postalBill(u) }));
      const bill = P && P.bill;
      out.push(btn({ id: 'p_key', x: 324, y: 316, w: 312, h: 20, label: '郵政法案を政権の最重要法案にする', why: !bill ? '郵政民営化の法案がまだ出ていない' : d.R('key_bill'), tip: '参院で否決されたら衆議院を解散する、という覚悟を示す', a: (u) => u.result('最重要法案', safe(() => u.g.rulingAction('key_bill', { billId: bill.id }), null)) }));
    }
    return out;
  },
  draw(c, ui, d) {
    drawSegs(c, ui, SOC_SUBS);
    if (sub(ui) === 'religion') drawReligion(c, ui, d);
    else drawPostal(c, ui, d);
  },
};
function drawReligion(c, ui, d) {
  const st = ui.tabState();
  const rel = d.rel;
  panel(c, 4, 64, 196, 272, '宗教団体（すべて架空）');
  if (!rel) { para(c, '宗教のしくみ（govt.js）が読み込まれていない。', 10, 86, 184, 10, K.dim); return; }
  drawList(c, ui, ui.ctls.find((q) => q.id === 'grow'), (c2, i, x, y, w) => {
    const gr = rel.groups[i];
    T(c2, gr.name, x + 6, y + 2, 12, K.text, 'left', w - 10);
    T(c2, gr.kind, x + 6, y + 16, 10, K.faint, 'left', w - 10);
  });
  const gr = rel.groups[st.grow | 0];
  panel(c, 204, 64, 216, 272, gr ? gr.name : '団体', { right: gr ? `約${fmtN(gr.members)}人` : '' });
  if (gr) {
    let yy = 84;
    T(c, gr.kana || '', 210, yy, 10, K.faint, 'left', 204); yy += 12;
    yy = para(c, gr.desc, 210, yy, 204, 10, K.text, 12, 6) + 4;
    T(c, '主な活動', 210, yy, 10, K.amber); yy += 12;
    yy = para(c, (gr.activities || []).join('・'), 210, yy, 204, 10, K.text, 12, 3) + 4;
    [['信頼', gr.trust], ['あなたとの関係', gr.relation]].forEach(([a, v]) => { T(c, a, 210, yy, 10, K.dim, 'left', 90); hbar(c, 300, yy + 3, 110, 6, num(v) / 100, K.teal); yy += 13; });
    if (gr.endorse) { T(c, '選挙で候補者を推薦することがある（組織票）', 210, yy, 10, K.warn, 'left', 204); yy += 12; }
    if (gr.problem && rel.cult) { yy = para(c, `問題：${rel.cult.label}（相談 ${fmtN(rel.cult.complaints)}件）`, 210, yy + 2, 204, 10, rel.cult.stage ? K.bad : K.dim, 12, 3); }
    para(c, '※架空の団体。信仰そのものではなく、違法な勧誘・献金の強要が問題として扱われる。', 210, Math.max(yy + 4, 300), 204, 10, K.faint, 12, 3);
  }
  const k = ui.ctls.find((q) => q.id === 'rarow');
  panel(c, k.x, k.y, k.w, k.h, 'できること');
  drawList(c, ui, k, (c2, i, x, y, w) => { const a = d.acts[i]; if (a.why) padlock(c2, x + 4, y + 3); T(c2, a.label, x + 14, y + 1, 10, a.why ? K.faint : K.text, 'left', w - 16); });
  const lk = ui.ctls.find((q) => q.id === 'r_law');
  panel(c, lk.x, lk.y, lk.w, lk.h, '政教分離の法律', { right: 'A：全文' });
  para(c, (rel.law || []).slice(0, 2).join('\n'), lk.x + 6, lk.y + 20, lk.w - 12, 10, K.text, 12, 8);
}
async function religionFlow(ui, d, gr, a) {
  if (!gr || !a) return;
  if (a.id === 'public_money') { await ui.info('公金の支出', [d.R('religion_funds') || '憲法89条：公金を宗教団体のために支出してはならない。'], { color: K.lock }); return; }
  const lines = [`「${gr.name}」（架空）：${a.label}`];
  if (a.id === 'request_dissolution') lines.push('解散命令は裁判所が決める（宗教法人法81条）。法人格を失わせるもので、信仰そのものを禁じるものではない。');
  if (a.id === 'question_power') lines.push('所轄庁が、宗教法人審議会の意見を聞いたうえで報告を求め、質問する（78条の2）。');
  if (a.id === 'visit') lines.push('国は宗教を優遇も弾圧もしない（政教分離）。政治家の訪問は、敬意をもった交流として。');
  const k = await ui.confirm({ title: a.label, lines, choices: ['実行する', 'やめる'], cancel: 1, w: 460 });
  if (k !== 0) return;
  await ui.result(a.label, safe(() => ui.g.religionAction(gr.id, a.id, {}), null));
}
function drawPostal(c, ui, d) {
  const P = d.postal;
  panel(c, 4, 64, 316, 272, '郵政事業の歩み');
  if (!P) { para(c, '郵政のしくみ（govt.js）が読み込まれていない。', 10, 86, 300, 10, K.dim); return; }
  T(c, `いま：${P.label}`, 10, 84, 10, K.amber, 'left', 304);
  let yy = 98;
  for (const t of (P.timeline || []).slice(-12)) {
    if (yy > 300) break;
    T(c, `${t.year}年${t.month ? `${t.month}月` : ''}`, 10, yy, 10, t.game ? K.amber : K.cyan, 'left', 64);
    yy = para(c, t.text, 76, yy, 238, 10, K.text, 12, 3) + 3;
  }
  para(c, `※${P.note || ''}`, 10, Math.max(yy, 306), 304, 10, K.faint, 12, 2);
  panel(c, 324, 64, 312, 226, '郵政民営化：賛成と反対');
  let y2 = 84;
  T(c, '賛成の声', 330, y2, 10, K.good); y2 += 12;
  for (const s of (P.pro || []).slice(0, 3)) y2 = para(c, `・${s}`, 330, y2, 300, 10, K.text, 12, 2);
  T(c, '反対の声', 330, y2 + 2, 10, K.bad); y2 += 14;
  for (const s of (P.con || []).slice(0, 3)) y2 = para(c, `・${s}`, 330, y2, 300, 10, K.text, 12, 2);
  if (P.segments) {
    y2 += 4;
    T(c, `賛成が多い層：${(P.segments.pro || []).map((s) => SEG_SHORT[s] || s).join('・')}`, 330, y2, 10, K.good, 'left', 300); y2 += 12;
    T(c, `反対が多い層：${(P.segments.con || []).map((s) => SEG_SHORT[s] || s).join('・')}`, 330, y2, 10, K.bad, 'left', 300); y2 += 12;
  }
  if (P.bill) T(c, `法案：${P.bill.title}（${STAGE_JA[P.bill.stage] || P.bill.stage}）`, 330, Math.min(y2 + 4, 274), 10, K.amber, 'left', 300);
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'p_bill'), { center: true, color: K.amber });
  drawBtn(c, ui, ui.ctls.find((q) => q.id === 'p_key'), { center: true });
}
async function postalBill(ui) {
  const g = ui.g;
  const k = await ui.confirm({ title: '郵政民営化法案', lines: ['郵政事業を民営化する法案を国会に出す。', '与党の中にも反対する議員がいる、大きな議論になる法案（造反がありうる）。'], choices: ['法案を出す', 'やめる'], cancel: 1 });
  if (k !== 0) return;
  const id = safe(() => g.proposeBill({ policy: 'postal_privatization' }), null);
  await ui.result('郵政民営化法案', id ? { ok: true, text: '郵政民営化の法案を出した。国会での審議を待つ。' } : { ok: false, why: g.lastPoliticsError || '法案を出せなかった' });
}

// ================================================================ the tabs, tips, entry points
const TABS = [TAB_OVERVIEW, TAB_BUDGET, TAB_NETWORK, TAB_OPINION, TAB_DIET, TAB_ADMIN, TAB_SECURITY, TAB_CRISIS, TAB_IDEOLOGY, TAB_SOCIETY];
function tabIndex(t) {
  if (t == null || t === '') return -1;
  if (typeof t === 'number') return t >= 1 && t <= TABS.length ? t - 1 : -1;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= TABS.length) return n - 1;
  return TABS.findIndex((x) => x.id === t);
}
// tips this console adds (assist.js TIPS has the others; see test-output/api_assist.txt)
const CUSTOM_TIPS = {
  govt_network: '政策マップでは、法律や法案が景気などの指標と、有権者のどの層に効くかを線で見られるよ。緑はプラス、赤はマイナス。',
  govt_ideology: '思想に正解はないよ。軸を変えると、政党や議員の位置の見え方も変わる。思想じてんで、考えと実際の歴史の両方を読んでみてね。',
};
function tipKey(g, key, force = false) {
  if (!key || !has(g, 'assistTip')) return;
  const own = CUSTOM_TIPS[key] && !(AS && AS.TIPS && AS.TIPS[key]);
  safe(() => g.assistTip(key, own ? { text: CUSTOM_TIPS[key], level: 2, force } : force ? { force: true } : {}));
}
const whyOf = (k, ui) => (!k ? null : typeof k.why === 'function' ? safe(() => k.why(ui), null) : k.why);

export async function openGovtConsole(g, opts = {}) {
  if (!g || !g.state || !has(g, 'pol')) return null;
  if (g.auto && !g.auto.govtui) return null;
  const open = sceneOf(g);
  if (open) { if (opts.tab != null) open.setTab(Math.max(0, tabIndex(opts.tab)), opts.sub); return null; }
  try { g.pol(); } catch (e) { console.error(e); return null; }
  sfx('ok');
  return new Promise((resolve) => { const sc = new GovtScene(g, opts, resolve); g.push(sc); });
}
Game.prototype.govtConsole = function govtConsole(tab, opts = {}) { return openGovtConsole(this, { ...opts, tab }); };
Game.prototype.govtRole = function govtRoleM() { return govtRole(this); };

// ================================================================ phone apps
const APP_VOICE = '#c0508a', APP_KOKKAI = '#3a6aa8', APP_GOVT = '#b07a1a';
const PT = (c, s, x, y, size = 12, col = PC.text, align = 'left', w = 0) => phoneText(c, w > 0 ? fitText(c, s, w, size) : s, x, y, size, col, align);
function phoneTabs(c, a, labels, idx, col) {
  const tw = (a.w - 8) / labels.length;
  labels.forEach((lab, i) => {
    const on = i === idx;
    const x = Math.round(a.x + 4 + i * tw);
    box(c, x + 1, a.y + 3, Math.round(tw) - 2, 18, 4, on ? col : '#ffffff', on ? shade(col, -0.4) : '#c8c4bc');
    PT(c, lab, x + tw / 2, a.y + 6, 12, on ? '#ffffff' : PC.text, 'center', tw - 6);
  });
}
// 世論の声: the voices feed (newspaper letters, street interviews, BBS, blogs, SNS by era) and the demos
async function voicesApp(g) {
  const TABS2 = [['all', 'すべて'], ['pro', '賛成'], ['con', '反対'], ['demo', 'デモ']];
  const v = {
    title: voicesAppName(g), color: APP_VOICE, bg: '#f8f4f6', hint: '←→:タブ A:よむ B:もどる', tab: 0, idx: 0, top: 0, cancel: null,
    rows() {
      const t = TABS2[this.tab][0];
      if (t === 'demo') {
        const list = has(g, 'demos') ? safe(() => g.demos(), []) : [];
        return [{ kind: 'org', label: '＋ デモを主催する', sub: '公安条例の許可・準備のお金' }, ...list.slice().sort((a, b) => (a.status === 'ended') - (b.status === 'ended') || b.day - a.day).slice(0, 20).map((d) => ({ kind: 'demo', d }))];
      }
      return [{ kind: 'fresh', label: '＋ 新しい声を聞く', sub: '街の声・ネットの声を集める' }, ...voicesOf(g, 30, t === 'all' ? {} : { stance: t }).map((x) => ({ kind: 'voice', v: x }))];
    },
    update(ph, inp) {
      const rows = this.rows();
      if (inp.repeat('left') || inp.repeat('right')) { this.tab = (this.tab + (inp.repeat('left') ? 3 : 1)) % 4; this.idx = 0; this.top = 0; sfx('cursor'); return; }
      if (rows.length && inp.repeat('up')) { this.idx = (this.idx + rows.length - 1) % rows.length; sfx('cursor'); }
      if (rows.length && inp.repeat('down')) { this.idx = (this.idx + 1) % rows.length; sfx('cursor'); }
      if (inp.pressed('a') && rows[this.idx]) { sfx('ok'); const r = rows[this.idx]; ph.run(this, () => voiceRowAction(g, r)); return; }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(null); }
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      if (y < a.y + 24) { const i = clamp(Math.floor((x - a.x - 4) / ((a.w - 8) / 4)), 0, 3); if (i !== this.tab) { this.tab = i; this.idx = 0; this.top = 0; sfx('cursor'); } return false; }
      const i = this.top + Math.floor((y - a.y - 26) / 46);
      const rows = this.rows();
      if (i < 0 || i >= rows.length) return false;
      if (i !== this.idx) { this.idx = i; sfx('cursor'); return false; }
      return true;
    },
    draw(c, ph, a) {
      this.area = a;
      phoneTabs(c, a, TABS2.map((t) => t[1]), this.tab, APP_VOICE);
      const rows = this.rows();
      const vis = Math.max(1, Math.floor((a.h - 26) / 46));
      this.idx = clamp(this.idx, 0, Math.max(0, rows.length - 1));
      if (this.idx < this.top) this.top = this.idx;
      if (this.idx >= this.top + vis) this.top = this.idx - vis + 1;
      for (let i = this.top; i < Math.min(rows.length, this.top + vis); i++) {
        const r = rows[i];
        const y = a.y + 26 + (i - this.top) * 46;
        const sel = i === this.idx;
        box(c, a.x + 4, y, a.w - 8, 43, 4, sel ? PC.sel : '#ffffff', sel ? PC.selEdge : '#ddd4c8');
        if (r.kind === 'voice') {
          const x = r.v;
          R(c, a.x + 7, y + 4, 3, 35, x.stance === 'pro' ? PC.good : x.stance === 'con' ? PC.bad : PC.dim);
          PT(c, x.header, a.x + 14, y + 3, 10, PC.dim, 'left', a.w - 24);
          const ls = wrapJ(c, x.text, a.w - 26, 12).slice(0, 2);
          ls.forEach((l, k) => PT(c, k === 1 && wrapJ(c, x.text, a.w - 26, 12).length > 2 ? fitText(c, l + '…', a.w - 26, 12) : l, a.x + 14, y + 15 + k * 13, 12, PC.text, 'left', a.w - 16));
        } else if (r.kind === 'demo') {
          const d = r.d;
          R(c, a.x + 7, y + 4, 3, 35, d.status === 'ended' ? '#c8c0b8' : d.stance === 'rally' ? '#2a9d8f' : PC.pink);
          PT(c, d.cause, a.x + 14, y + 4, 12, d.status === 'ended' ? PC.dim : PC.text, 'left', a.w - 24);
          PT(c, `${d.status === 'ended' ? '終了' : d.status === 'planned' ? '予定' : '開催中'}・${d.place}・約${fmtN(d.size)}人`, a.x + 14, y + 22, 10, PC.dim, 'left', a.w - 24);
        } else {
          PT(c, r.label, a.x + 14, y + 6, 12, APP_VOICE, 'left', a.w - 24);
          PT(c, r.sub, a.x + 14, y + 23, 10, PC.dim, 'left', a.w - 24);
        }
      }
      if (rows.length <= 1 && TABS2[this.tab][0] !== 'demo') PT(c, 'まだ声はない', a.x + a.w / 2, a.y + 86, 12, PC.dim, 'center');
      PT(c, '※架空の市民の声', a.x + a.w - 6, a.y + a.h - 12, 10, PC.dim, 'right');
    },
  };
  return phoneView(g, v);
}
async function voiceRowAction(g, r) {
  const PH = { phoneInfo, phoneList, phoneConfirm };
  if (r.kind === 'fresh') { safe(() => g.voices(6, { fresh: true })); return; }
  if (r.kind === 'voice') {
    const x = r.v;
    await PH.phoneInfo(g, { title: x.mediumLabel || '世論の声', color: APP_VOICE, lines: [x.header, `「${x.text}」`, '', `立場：${STANCE_WORD[x.stance] || '—'}`, `層：${x.segName}`, `話題：${x.event || '—'}`, '', '※架空の市民の声。ひとつの声だけで世論を決めつけないこと。'] });
    return;
  }
  if (r.kind === 'org') {
    const why = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_organize'), null) : 'しくみがない';
    if (why) { await PH.phoneInfo(g, { title: 'デモの主催', color: APP_VOICE, lines: ['いまは主催できない：', why] }); return; }
    const i = await PH.phoneList(g, { title: '何を訴える？', color: APP_VOICE, items: DEMO_CAUSES.map(([, l]) => ({ label: l })) });
    if (i < 0) return;
    const res = safe(() => g.organizeDemo({ cause: DEMO_CAUSES[i][1], against: DEMO_CAUSES[i][0] }), null);
    await PH.phoneInfo(g, { title: 'デモの主催', color: APP_VOICE, lines: [res && res.ok ? res.text || '主催の届け出をした。' : `できなかった：${(res && res.why) || ''}`] });
    return;
  }
  const d = r.d;
  const why = d.status === 'ended' ? 'そのデモはもう終わっている' : has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_join', { id: d.id }), null) : 'しくみがない';
  const info = [`${d.cause}`, `場所：${d.place}`, `主催：${d.organiser}`, `規模：約${fmtN(d.size)}人（最大 約${fmtN(d.peak)}人）`, d.joined ? 'あなたも参加した' : ''].filter(Boolean);
  if (why) { await PH.phoneInfo(g, { title: 'デモ', color: APP_VOICE, lines: [...info, '', `参加できない：${why}`] }); return; }
  const k = await PH.phoneConfirm(g, { title: 'デモに参加する', color: APP_VOICE, text: `${info.join('\n')}\n\n集会・表現の自由（憲法21条）。参加する？`, choices: ['参加する', 'スピーチもする', 'やめる'] });
  if (k === 0 || k === 1) {
    const res = safe(() => g.joinDemo(d.id, { role: k === 1 ? 'speaker' : 'participant' }), null);
    await PH.phoneInfo(g, { title: 'デモ', color: APP_VOICE, lines: [res && res.ok ? res.text || '参加した。' : `できなかった：${(res && res.why) || ''}`] });
  }
}
function voicesAppName(g) { return eraDev(g) === 'techo' ? '投書欄' : '世論の声'; }
function kokkaiAppName(g) { const d = eraDev(g); return d === 'techo' ? '国会日誌' : d === 'keitai' ? '国会速報' : '国会中継'; }
// the bill's stage in plain words
function plainStage(b) {
  const h = b.house === 'sangi' ? '参議院' : '衆議院';
  return {
    draft: 'まだ国会に出る前（党や内閣で準備中）', committee: `${h}の委員会で話し合っている`, shugi: '衆議院の本会議で採決を待っている',
    sangi: '参議院で審議している', referendum: '国民投票を待っている', enacted: '成立した', rejected: '否決された', shelved: '廃案になった',
  }[b.stage] || b.stage;
}
// 国会中継: today's Diet business in plain words
async function kokkaiApp(g) {
  const PH = { phoneInfo, phoneList, phoneConfirm };
  let index = 0;
  for (let guard = 0; guard < 60; guard++) {
    const p = polOf(g);
    if (!p) return;
    const S = p.diet.session;
    const todayBills = has(g, 'billsList') ? safe(() => g.billsList({ today: true }), []) : [];
    const pend = (p.diet.bills || []).filter((b) => b.kind !== 'noconfidence' && !['enacted', 'rejected', 'shelved'].includes(b.stage));
    const recent = (p.diet.bills || []).filter((b) => ['enacted', 'rejected', 'shelved'].includes(b.stage) && today(g) - num(b.closed, -99) <= 12).slice(-5).reverse();
    const items = [
      { t: 'session', label: S ? `${S.kind}・会期中` : '国会は閉会中', sub: sessionText(g) },
      { t: 'today', label: '今日の国会', sub: todayBills.length ? `本会議の採決：${todayBills.length}本` : S ? '本会議の採決はない（委員会で審議）' : '閉会中' },
      ...pend.slice(0, 12).map((b) => ({ t: 'bill', b, label: b.title, sub: plainStage(b) })),
      ...recent.map((b) => ({ t: 'bill', b, label: `【${b.stage === 'enacted' ? '成立' : b.stage === 'rejected' ? '否決' : '廃案'}】${b.title}`, sub: plainStage(b) })),
      { t: 'questions', label: '質問主意書と答弁', sub: '内閣への文書での質問' },
      { t: 'console', label: '政府中枢で見る', sub: '議席・法案・国会の戦術（くわしい画面）' },
    ];
    const i = await PH.phoneList(g, { title: kokkaiAppName(g), color: APP_KOKKAI, items, index, describe: (k) => (items[k] && items[k].t === 'bill' ? `${items[k].b.sponsor === 'cabinet' ? '内閣が出した法案（閣法）' : '議員が出した法案（議員立法）'}` : '') });
    if (i < 0) return;
    index = i;
    const it = items[i];
    if (it.t === 'session') await PH.phoneInfo(g, { title: '国会', color: APP_KOKKAI, lines: [sessionText(g), '', '通常国会は毎年1月に召集（会期150日）。臨時国会・特別国会もある。法律は衆参両院で可決して成立し、衆議院は出席議員の3分の2で再可決できる。'] });
    else if (it.t === 'today') await PH.phoneInfo(g, { title: '今日の国会', color: APP_KOKKAI, lines: todayBills.length ? todayBills.map((b) => `・${b.title}\n　${plainStage(b)}`) : [S ? '今日の本会議に採決はない。委員会で法案の質疑が続いている。' : '国会は閉会中。'] });
    else if (it.t === 'bill') await PH.phoneInfo(g, { title: '法案', color: APP_KOKKAI, lines: [it.b.title, `いま：${plainStage(it.b)}`, '', ...billLines(g, it.b).slice(1)] });
    else if (it.t === 'questions') {
      const opp = has(g, 'opposition') ? safe(() => g.opposition(), null) : null;
      const qs = opp ? opp.questions.slice(-6).reverse() : [];
      await PH.phoneInfo(g, { title: '質問主意書', color: APP_KOKKAI, lines: qs.length ? qs.flatMap((q) => [`【${q.title || q.topic}】${q.answered ? '答弁ずみ' : '答弁待ち'}`, q.answer ? `　${q.answer.text}` : '']) : ['まだ質問主意書は出されていない。', '', '国会議員は、議長の承認を経て内閣に文書で質問できる（国会法74条）。内閣は7日以内に答弁書で答える。'] });
    } else if (it.t === 'console') { await openGovtConsole(g, { tab: 'diet' }); }
  }
}
function accessFor(role, tab) {
  if (!role) return '見るだけ';
  if (role.kind === 'pm') return '操作できる';
  const has2 = (post) => role.posts.includes(post);
  const M = {
    budget: has2('minister_finance') ? '操作できる（予算・税）' : '見るだけ',
    security: has2('minister_defense') ? '操作できる（自衛隊）' : '見るだけ',
    admin: role.kind === 'minister' ? '所管の政令・審議会' : '見るだけ',
    opinion: has2('kanbo') || has2('minister_npsc') ? 'デモへの対応・参加' : 'デモに参加・主催できる',
    crisis: role.kind === 'minister' ? '担当の災害対応' : role.office === 'chiji' || role.office === 'shicho' ? '首長の災害対応' : '見るだけ',
    diet: role.diet || role.kind === 'minister' ? '提案・質問できる' : '見るだけ',
    ideology: '思想しんだん・党首なら理念',
    society: role.diet ? '国会で質問できる' : '見るだけ',
  };
  return M[tab] || '見るだけ';
}
async function launcherApp(g) {
  const PH = { phoneInfo, phoneList, phoneConfirm };
  let index = 1;
  for (let guard = 0; guard < 40; guard++) {
    const role = govtRole(g);
    const items = [
      { label: `あなた：${role.label}`, sub: ROLE_NOTE[role.kind], tab: null },
      ...TABS.map((t) => ({ label: t.label, sub: accessFor(role, t.id), right: safe(() => (t.alert ? t.alert({ g, tabState: () => ({}) }) : 0), 0) ? '●' : '', rightColor: PC.bad, tab: t.id })),
    ];
    const i = await PH.phoneList(g, { title: '政府中枢', color: APP_GOVT, items, index, describe: (k) => (items[k] && items[k].tab ? (TABS.find((t) => t.id === items[k].tab) || {}).about || '' : 'A：概況から開く') });
    if (i < 0) return;
    index = i;
    await openGovtConsole(g, { tab: items[i].tab || 'overview' });
  }
}
function drawBubbles(c, x, y) {
  rrect(c, x + 2, y + 3, 14, 10, 3, '#ffffff'); R(c, x + 5, y + 13, 3, 3, '#ffffff');
  rrect(c, x + 9, y + 10, 13, 9, 3, '#ffd6e8'); R(c, x + 17, y + 19, 3, 3, '#ffd6e8');
  R(c, x + 5, y + 6, 8, 1, '#c0508a'); R(c, x + 5, y + 9, 6, 1, '#c0508a'); R(c, x + 12, y + 13, 7, 1, '#8a2a5a'); R(c, x + 12, y + 16, 5, 1, '#8a2a5a');
}
registerPhoneApp('voices', {
  name: (g) => voicesAppName(g), color: APP_VOICE, order: 63,
  icon(c, x, y) { drawBubbles(c, x, y); },
  badge: (g) => { const r = govtRole(g); return r.kind === 'pm' && has(g, 'demos') ? safe(() => g.demos({ active: true }).filter((d) => !(d.responses || []).length).length, 0) : 0; },
  cond: (g) => has(g, 'pol') && has(g, 'voices'),
  open: (g) => voicesApp(g),
});
registerPhoneApp('kokkai_live', {
  name: (g) => kokkaiAppName(g), color: APP_KOKKAI, order: 64,
  icon(c, x, y) {
    R(c, x + 1, y + 3, 22, 16, '#1a2a44'); R(c, x + 2, y + 4, 20, 14, '#8ab8e8');
    R(c, x + 5, y + 13, 14, 4, '#ece6d4'); R(c, x + 9, y + 9, 6, 4, '#ece6d4'); R(c, x + 11, y + 6, 2, 3, '#ddd4bc');
    R(c, x + 8, y + 20, 8, 2, '#1a2a44'); R(c, x + 18, y + 5, 3, 3, '#ff3b4f');
  },
  badge: (g) => { const r = govtRole(g); return r.diet && has(g, 'billsList') ? safe(() => g.billsList({ today: true }).length, 0) : 0; },
  cond: (g) => has(g, 'pol'),
  open: (g) => kokkaiApp(g),
});
registerPhoneApp('govt_console', {
  name: '政府中枢', color: APP_GOVT, order: 65,
  iconHD(c, x, y) { appTile(c, x, y, '#5a3a0e'); mark(c, x + 7, y + 7, '#ffcf6a'); },
  badge: (g) => { const r = govtRole(g); if (r.kind !== 'pm' && r.kind !== 'minister') return 0; const s = has(g, 'govtSummary') ? safe(() => g.govtSummary(), null) : null; return s && Array.isArray(s.alerts) ? Math.min(9, s.alerts.length) : 0; },
  cond: (g) => has(g, 'pol'),
  open: (g) => launcherApp(g),
});

if (typeof window !== 'undefined') window.__govtui = { scene: () => sceneOf(window.__game), open: openGovtConsole, TABS, role: govtRole, FITLOG, tabIndex, activePhone };
