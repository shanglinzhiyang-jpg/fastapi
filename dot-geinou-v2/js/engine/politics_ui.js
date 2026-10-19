// Politics UI (政治の画面): the HD front end of the politics core (js/engine/politics.js).
//
// Everything here only calls the core's g.* API and reads g.state.politics; it replaces the
// core's text fallback (g.politicsMenu and the phone app '政治'). d-pad + A/B only, 640x360.
//
// ---------------------------------------------------------------- for other modules
//   import { openPolitics, politicsScreen, drawEmblem, drawPartyMark } from '../engine/politics_ui.js';
//   await g.politicsMenu()                 the dashboard (also: phone app '政治', order 60)
//   await g.politicsScreen(name, opts)     open one screen directly (places use this):
//       'dashboard' | 'elections' | 'candidacy' { electionId } | 'campaign' { electionId } |
//       'parties' | 'found' | 'policy' | 'bills' | 'diet' | 'cabinet' | 'budget' | 'formation' |
//       'coalition' | 'amendment' | 'party' | 'money' | 'activities' | 'news' | 'results' |
//       'night' { resultId } (開票速報 + result card) | 'vote' { billId, house } (本会議の採決) |
//       'retire' (進退：議員辞職・政界引退の表明・政治家としての歩み; also in 資金・活動)
//   await g.politicsEvents()               show what happened overnight (election night, 首班指名,
//                                          打診, 不信任案の可決, 採決) — runs after g.sleep by itself
//   drawEmblem(ctx, emblem, x, y, size)    the player's party emblem (party.emblem from 党を立ち上げる)
//   drawPartyMark(ctx, g, partyId, x, y, size)   logo (自民・民主) / emblem / colour mark of any party
// UI-only data lives in g.state.flags.polui (economy history for the sparklines, 情勢調査 history,
// the overnight queue, the retirement / career records: see 進退 below). The places that write to the simulation without a g.* call: the 予算編成
// screen (applyBudget: the core has no budget API yet) and 民間人閣僚 (ensureCivilian adds an NPC
// record for a friend so g.formCabinet accepts them).
// Headless: under g.auto the screens do not open (openPolitics returns null) and the overnight
// queue is dropped; set g.auto.polui = true to drive them with keys in a test.

import { Game } from './game.js';
import * as POL from './politics.js';
import { SW, SH, clamp, fmtMoney, eraPrice, shade, mix, makeCanvas, hash2, YEN_MARK } from './util.js';
import { text, wrap, measure, COLORS, cursor, downArrow } from './draw.js';
import { audio } from './audio.js';
import { drawFaceHD, charSheetHD, LOOKS } from './sprites.js';
import { drawLogo } from './logos.js';
import { registerPhoneApp, onMorning, PEOPLE, WEEKDAYS, weekdayOf } from './life.js';
import { ERAS, ageOf, PREFECTURES, fullName, YEAR_DAYS } from './profile.js';
import { appTile, rrect } from './phone.js';
import { crimeLaw } from './crime.js';

const {
  OFFICES, POLICY_AREAS, AREA_ORDER, POLICIES, POLICY_ORDER, SEGMENTS, SEGMENT_ORDER, POSTS, PARTY_POST_ORDER,
  PARTY_DEFS, ELECTION_KINDS, CAMPAIGN_ACTIONS, ILLEGAL_CAMPAIGN, ACTIVITIES, postName, cabinetPosts, shugiRules,
  sangiRules, tokyoSangiMagnitude, depositFor, forfeitShare, polDate, dateLabel, onPolitics, fmtCho, segWeights,
  netCampaignOK, subsidyExists, partyTicketDisclosure, votingAge,
} = POL;

// ================================================================ theme & primitives
const C = {
  bg0: '#0a0f26', bg1: '#131b3e', head: '#0e1534', card: '#18224c', cardHead: '#202c5e', edge: '#34437f',
  sel: '#2c3d80', selDim: '#232f62', gold: '#e8c25a', goldDark: '#8a6a1a', text: '#f2f4ff', dim: '#9aa3c8', faint: '#5f6998',
  good: '#5ee07a', bad: '#ff6b78', warn: '#ffb03a', cyan: '#5fd7ff', pink: '#ff7eb6',
  paper: '#f4eedd', paperEdge: '#c9bc98', ink: '#25242c', inkDim: '#6e685a', stamp: '#d23a3a',
  yes: '#f4f4ee', no: '#3a7bd5', absent: '#3a4066',
};
const IND = 'ind';
const IND_COLOR = '#8a90a6';
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
function T(c, s, x, y, size = 12, color = C.text, align = 'left', shadow = null) { text(c, s, Math.round(x), Math.round(y), { size, color, align, shadow }); }
function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
// wrap() with one more kinsoku rule: a line never starts with a closing mark or a small kana
// (after a hung 「）」 the next 「。」 would otherwise open the following line)
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}'.split(''));
// The pass runs per paragraph, so a hard '\n' break (a 「・」 bullet, a 「…」 line) is never pulled
// up onto the line above.
function wrapJ(c, s, w, size) {
  return String(s ?? '').split('\n').flatMap((par) => kinsoku(wrap(c, par, w, size)));
}
function kinsoku(lines) {
  const gone = new Set();
  for (let i = 1; i < lines.length; i++) {
    const a = Array.from(lines[i]);
    let k = 0;
    while (k < a.length && k < 2 && NO_START.has(a[k])) k++;
    if (k && lines[i - 1] !== '') { lines[i - 1] += a.slice(0, k).join(''); lines[i] = a.slice(k).join(''); if (!lines[i]) gone.add(i); }
  }
  return lines.filter((l, i) => !gone.has(i));
}
// wrapped paragraph; returns the y below it
function para(c, s, x, y, w, size = 12, color = C.text, lh = size + 4, max = 99) {
  const lines = wrapJ(c, String(s ?? ''), w, size);
  lines.slice(0, max).forEach((l, i) => T(c, i === max - 1 && lines.length > max ? fit(c, l + '…', w, size) : l, x, y + i * lh, size, color));
  return y + Math.min(max, lines.length) * lh;
}
function line(c, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (let k = 0; k < 2000; k++) {
    c.fillRect(x0, y0, 1, 1);
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
// a 1px-outlined box with cut corners
function frame(c, x, y, w, h, fill, edge) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  R(c, x + 1, y, w - 2, 1, edge); R(c, x + 1, y + h - 1, w - 2, 1, edge); R(c, x, y + 1, 1, h - 2, edge); R(c, x + w - 1, y + 1, 1, h - 2, edge);
  if (fill) R(c, x + 1, y + 1, w - 2, h - 2, fill);
}
// a card: dark panel with a title strip
function card(c, x, y, w, h, title = null, o = {}) {
  R(c, x + 2, y + 2, w, h, 'rgba(0,0,0,0.35)');
  frame(c, x, y, w, h, o.fill || C.card, o.edge || C.edge);
  if (title) {
    R(c, x + 1, y + 1, w - 2, 17, o.head || C.cardHead);
    R(c, x + 1, y + 18, w - 2, 1, o.edge || C.edge);
    T(c, fit(c, title, w - 12 - (o.rightW || 0), 12), x + 7, y + 3, 12, o.accent || C.gold);
    if (o.right) T(c, o.right, x + w - 7, y + 3, 12, o.rightColor || C.dim, 'right');
  }
}
// paper document (bills, certificates, result cards)
function paper(c, x, y, w, h) {
  R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.45)');
  frame(c, x, y, w, h, C.paper, C.paperEdge);
  R(c, x + 3, y + 3, w - 6, 1, '#fffaf0');
  R(c, x + 3, y + h - 4, w - 6, 1, '#e2d8bc');
}
function pill(c, x, y, s, bg, fg = '#ffffff', size = 12) {
  const w = Math.round(measure(c, s, size)) + 8;
  frame(c, x, y, w, size + 4, bg, shade(bg, -0.35));
  T(c, s, x + 4, y + 2, size, fg);
  return w;
}
function pillR(c, xr, y, s, bg, fg, size = 12) { const w = Math.round(measure(c, s, size)) + 8; pill(c, xr - w, y, s, bg, fg, size); return w; }
function hbar(c, x, y, w, h, frac, col, back = '#0c1230') {
  R(c, x, y, w, h, '#05081a');
  R(c, x + 1, y + 1, w - 2, h - 2, back);
  const fw = Math.round(clamp(frac, 0, 1) * (w - 2));
  if (fw > 0) { R(c, x + 1, y + 1, fw, h - 2, col); R(c, x + 1, y + 1, fw, 1, shade(col, 0.3)); }
}
// a bar from the middle (-1..1)
function cbar(c, x, y, w, h, v, pos = C.good, neg = C.bad) {
  R(c, x, y, w, h, '#0c1230');
  const mid = x + Math.round(w / 2);
  R(c, mid, y - 1, 1, h + 2, C.faint);
  const k = Math.round(clamp(Math.abs(v), 0, 1) * (w / 2 - 1));
  if (k > 0) { if (v > 0) R(c, mid + 1, y + 1, k, h - 2, pos); else R(c, mid - k, y + 1, k, h - 2, neg); }
}
// sparkline: vals (numbers), area x,y,w,h
function spark(c, vals, x, y, w, h, col, o = {}) {
  const v = (vals || []).filter(Number.isFinite);
  if (o.back !== false) R(c, x, y, w, h, o.back || 'rgba(5,8,26,0.55)');
  if (v.length < 2) {
    for (let i = 0; i < w; i += 4) R(c, x + i, y + Math.floor(h / 2), 2, 1, C.faint);
    if (v.length === 1) R(c, x + w - 3, y + Math.floor(h / 2) - 1, 3, 3, col);
    return;
  }
  let mn = o.min ?? Math.min(...v), mx = o.max ?? Math.max(...v);
  const minRange = o.minRange || Math.max(1e-6, Math.abs(mx) * 0.02);
  if (mx - mn < minRange) { const m = (mx + mn) / 2; mn = m - minRange / 2; mx = m + minRange / 2; }
  const px = (i) => x + 1 + Math.round((i * (w - 3)) / (v.length - 1));
  const py = (val) => y + h - 2 - Math.round(((clamp(val, mn, mx) - mn) / (mx - mn)) * (h - 4));
  if (o.ref != null && o.ref > mn && o.ref < mx) for (let i = 0; i < w; i += 3) R(c, x + i, py(o.ref), 1, 1, o.refColor || C.faint);
  if (o.fill) {
    c.globalAlpha = 0.22;
    for (let i = 1; i < v.length; i++) { const x0 = px(i - 1), x1 = px(i); for (let xx = x0; xx <= x1; xx++) { const t = x1 === x0 ? 0 : (xx - x0) / (x1 - x0); const yy = Math.round(py(v[i - 1]) + (py(v[i]) - py(v[i - 1])) * t); R(c, xx, yy, 1, y + h - 1 - yy, col); } }
    c.globalAlpha = 1;
  }
  for (let i = 1; i < v.length; i++) line(c, px(i - 1), py(v[i - 1]), px(i), py(v[i]), col);
  const lx = px(v.length - 1), ly = py(v[v.length - 1]);
  R(c, lx - 1, ly - 1, 3, 3, shade(col, 0.4));
}
const fmtNum = (n) => Math.round(num(n)).toLocaleString('ja-JP');
// big amounts (party funds, subsidies) as 億円 / 万円, in the era's prices
function fmtBig(n) {
  const v = eraPrice(num(n));
  if (Math.abs(v) >= 1e8) return `約${YEN_MARK}${(Math.round(v / 1e7) / 10).toLocaleString('ja-JP')}億円`;
  if (Math.abs(v) >= 1e6) return `約${YEN_MARK}${Math.round(v / 1e4).toLocaleString('ja-JP')}万円`;
  return fmtMoney(n);
}
const pct = (v, d = 1) => `${(Math.round(num(v) * 10 ** d) / 10 ** d).toFixed(d)}%`;
const sign = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(num(v) * 10 ** d) / 10 ** d).toFixed(d)}`;
// an amount in 円 that g.fmt / yenText must not convert again (exchange rate, stock index…)
const plainYen = (n) => `${YEN_MARK}${fmtNum(n)}円`;
// 消費税 (from April 1989): before it there is none, not 「0%」
const taxWord = (r) => (num(r) > 0 ? `${num(r)}%` : 'なし');
const daysLeft = (n) => (n <= 0 ? '今日' : n === 1 ? 'あした' : `あと${n}日`);
function sfx(name) { try { audio.sfx(name); } catch (e) { /* no audio in tests */ } }

// ================================================================ politics helpers (read only)
const polOf = (g) => g.pol();
const today = (g) => (g.state && g.state.day) || 1;
const isNational = (me) => me.office === 'shugi' || me.office === 'sangi';
const inCabinet = (me) => me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
const yearOf = (g) => polDate(g).year;
// 期日前投票 began on 2003-12-01 (公選法改正); before it, 不在者投票 (as kuyakusho.js kijitsuName)
const kijitsuOK = (g) => { const d = polDate(g); return d.year * 100 + d.month >= 200312; };
const fyOf = (g) => polDate(g).fy;
const isRuling = (p, id) => (p.cabinet.partyIds || []).includes(id);
function partyColor(p, id) { if (!id || id === IND) return IND_COLOR; const pt = p.parties[id] || PARTY_DEFS[id]; return (pt && pt.color) || IND_COLOR; }
function partyShort(g, id) { return id && id !== IND ? g.partyName(id, true) : '無所属'; }
function partyFull(g, id) { return id && id !== IND ? g.partyName(id, false) : '無所属'; }
function npcLook(p, id) { const n = p.npcs[id]; return (n && n.look) || { ...LOOKS.salaryman }; }
function playerName(g) { const pr = g.state.profile; return pr ? fullName(pr) : g.state.name; }
function lookOf(g, p, who) { return who === 'player' ? g.state.look : npcLook(p, who); }
function whoName(g, who) { return who === 'player' ? playerName(g) : g.npcName(who) || '（空席）'; }
function factionName(p, partyId, fid) { const pt = p.parties[partyId]; const f = pt && (pt.factions || []).find((x) => x.id === fid); return f ? f.name : ''; }
function electionShort(g, e) {
  const p = polOf(g);
  if (e.kind === 'sosaisen') { const pt = p.parties[e.party]; return `${pt ? pt.short : ''}${postName('party_leader', fyOf(g), e.party)}選`; }
  if (e.kind === 'hosen') return `補選・${e.district || ''}`;
  return (ELECTION_KINDS[e.kind] || {}).short || e.label;
}
const kojiWord = (kind) => (kind === 'shugi' || kind === 'sangi' ? '公示' : '告示');
// 立候補の届出 window (as the core's declareImpl): from FILE_DAYS game days before the vote (about 3 months
// on the game calendar) to the 公示・告示 day. Earlier, g.declareCandidacy only records a 出馬表明 (not
// binding) and answers with a text that says so. Party leader races (党首選) have no such window.
const FILE_DAYS = Number(POL.FILING_DAYS) > 0 ? Number(POL.FILING_DAYS) : 30;
const filingOpens = (e) => e.day - FILE_DAYS;
// 'early' (a 出馬表明 only), 'open' (届出 taken now), 'closed' (after the 公示・告示 day)
function filingState(g, e) {
  const d = today(g);
  if (d > e.koji) return 'closed';
  return e.kind !== 'sosaisen' && d < filingOpens(e) ? 'early' : 'open';
}
const shortDate = (g, day) => dateLabel(g, day).replace(/^\d+年/, '');
// the player's 出馬表明 for this election (me.intent), if any
const intentFor = (g, e) => { const it = polOf(g).me.intent; return !!(it && e && it.election === e.id); };
function myDecl(e) { return (e && e.declared && e.declared.player) || null; }
function priceRate(g) { return (ERAS[polOf(g).era] || ERAS.reiwa).priceRate || 1; }
// 党費 for joining a party (一般党員 年4,000円程度 is the core's 目安): the core's own figure when it has one
function partyFee(g, id) {
  try {
    if (typeof g.partyFee === 'function') { const f = Number(g.partyFee(id)); if (Number.isFinite(f) && f >= 0) return f; }
    if (typeof POL.partyFee === 'function') { const f = Number(POL.partyFee(g, id)); if (Number.isFinite(f) && f >= 0) return f; }
    if (Number(POL.PARTY_FEE) >= 0 && POL.PARTY_FEE != null) return Number(POL.PARTY_FEE);
  } catch (e) { console.error(e); }
  return 4000;
}

// seats of a house as hemicycle groups: the opposition from the left, the governing parties on the right
function seatGroups(p, house) {
  const H = house === 'kugi' || house === 'togi' ? p.local[house] : p.diet[house];
  const seats = Object.entries((H && H.seats) || {}).filter(([, n]) => n > 0);
  const opp = seats.filter(([id]) => id !== IND && !isRuling(p, id)).sort((a, b) => b[1] - a[1]);
  const ind = seats.filter(([id]) => id === IND);
  const rul = seats.filter(([id]) => id !== IND && isRuling(p, id)).sort((a, b) => a[1] - b[1]);
  return [...opp, ...ind, ...rul].map(([id, n]) => ({ id, n: Math.round(n), color: partyColor(p, id), ruling: isRuling(p, id) }));
}

// ================================================================ hemicycle (議場の議席図)
const HEMI = new Map();
function hemiLayout(n) {
  n = Math.max(1, Math.round(n));
  if (HEMI.has(n)) return HEMI.get(n);
  const r0 = 0.36;
  const rows = n <= 10 ? 1 : clamp(Math.round(Math.sqrt(n) / 2.05), 2, 12);
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? 1 : r0 + ((1 - r0) * i) / (rows - 1)));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / sum)));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) { if (diff > 0) { counts[i]++; diff--; } else if (counts[i] > 1) { counts[i]--; diff++; } }
  const seats = [];
  counts.forEach((k, i) => { for (let j = 0; j < k; j++) seats.push({ a: k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1), r: radii[i], row: i }); });
  seats.sort((s, t) => t.a - s.a || s.r - t.r);
  const out = { seats, rows, r0 };
  HEMI.set(n, out);
  return out;
}
// groups: [{ color, n }] in order (left to right). o: { colors: [per seat colour] override, dot }
function drawHemi(c, cx, cy, Rr, groups, o = {}) {
  const total = Math.max(1, o.total || groups.reduce((a, g) => a + g.n, 0));
  const L = hemiLayout(total);
  const gap = (Rr * (1 - L.r0)) / Math.max(1, L.rows - 1 || 1);
  const dot = o.dot || Math.max(1, Math.min(8, Math.floor((L.rows === 1 ? Rr / 4 : gap) * 0.78)));
  const cols = o.colors || [];
  if (!o.colors) for (const gr of groups) for (let i = 0; i < gr.n; i++) cols.push(gr.color);
  L.seats.forEach((s, i) => {
    const x = cx + Math.cos(s.a) * Rr * s.r, y = cy - Math.sin(s.a) * Rr * s.r;
    const col = cols[i] || o.empty || '#2a3260';
    if (dot >= 5) rrect(c, x - dot / 2, y - dot / 2, dot, dot, 2, col);
    else R(c, Math.round(x - dot / 2), Math.round(y - dot / 2), dot, dot, col);
  });
  return L;
}

// ================================================================ emblem (32x32, the player's party)
// emblem = { v: 1, pal: ['#rrggbb', …] (≤ 9), px: string of 1024 chars '0' (clear) / '1'..'9' }
const EMB = new Map();
export function drawEmblem(c, emblem, x, y, size = 32) {
  if (!emblem || typeof emblem.px !== 'string' || emblem.px.length < 1024) return false;
  const key = emblem.px + (emblem.pal || []).join('');
  let cv = EMB.get(key);
  if (!cv) {
    const [can, x2] = makeCanvas(32, 32);
    for (let yy = 0; yy < 32; yy++) for (let xx = 0; xx < 32; xx++) {
      const k = emblem.px.charCodeAt(yy * 32 + xx) - 48;
      if (k > 0 && emblem.pal[k - 1]) { x2.fillStyle = emblem.pal[k - 1]; x2.fillRect(xx, yy, 1, 1); }
    }
    cv = can;
    EMB.set(key, cv);
    if (EMB.size > 40) EMB.delete(EMB.keys().next().value);
  }
  c.drawImage(cv, Math.round(x), Math.round(y), size, size);
  return true;
}
// Any party's mark: the real parties' logos, the player's emblem, else a colour badge with a letter.
export function drawPartyMark(c, g, id, x, y, size = 24) {
  const p = polOf(g);
  const pt = p.parties[id] || PARTY_DEFS[id];
  if (!pt || id === IND) { frame(c, x, y, size, size, '#3a4066', '#20264a'); T(c, '無', x + size / 2, y + size / 2 - 6, 12, C.dim, 'center'); return; }
  if (pt.logo) { R(c, x, y, size, size, '#ffffff'); drawLogo(c, pt.logo, x + 1, y + 1, size - 2, size - 2, {}); frame(c, x, y, size, size, null, '#20264a'); return; }
  if (pt.emblem && drawEmblem(c, pt.emblem, x, y, size)) return;
  rrect(c, x, y, size, size, 4, shade(pt.color || IND_COLOR, -0.4));
  rrect(c, x + 1, y + 1, size - 2, size - 2, 3, pt.color || IND_COLOR);
  const ch = Array.from(pt.short || pt.name || '?')[0];
  T(c, ch, x + size / 2, y + size / 2 - (size >= 24 ? 8 : 6), size >= 24 ? 16 : 12, '#ffffff', 'center', 'rgba(0,0,0,0.4)');
}
function partyChip(c, g, id, x, y, size = 12) {
  const p = polOf(g);
  R(c, x, y + 2, 4, size, partyColor(p, id));
  const s = partyShort(g, id);
  T(c, s, x + 7, y + 1, size, C.text);
  return 9 + measure(c, s, size);
}

// ================================================================ pixel icons (20x20)
const ICONS = {
  elections(c, x, y, col) { // ballot box
    R(c, x + 7, y + 1, 7, 8, '#ffffff'); R(c, x + 8, y + 3, 5, 1, '#9aa3c8'); R(c, x + 8, y + 5, 4, 1, '#9aa3c8');
    R(c, x + 2, y + 8, 16, 11, shade(col, -0.45)); R(c, x + 3, y + 9, 14, 9, col); R(c, x + 5, y + 9, 10, 2, '#0a0f26');
    R(c, x + 3, y + 13, 14, 1, shade(col, 0.3)); R(c, x + 8, y + 15, 4, 2, '#ffffff');
  },
  parties(c, x, y, col) { // flag
    R(c, x + 3, y + 1, 2, 18, '#c9b98a'); R(c, x + 2, y + 18, 5, 2, '#8a7a50');
    R(c, x + 5, y + 2, 13, 9, shade(col, -0.35)); R(c, x + 5, y + 3, 12, 7, col); disc(c, x + 11, y + 6, 2, '#ffffff');
  },
  policy(c, x, y, col) { // document with a pen
    R(c, x + 3, y + 1, 12, 17, '#5a5240'); R(c, x + 4, y + 2, 10, 15, '#f4eedd');
    for (let i = 0; i < 5; i++) R(c, x + 6, y + 5 + i * 2, i === 4 ? 4 : 6, 1, '#8a8270');
    R(c, x + 12, y + 9, 2, 8, col); R(c, x + 13, y + 8, 2, 8, shade(col, 0.3)); R(c, x + 12, y + 17, 2, 2, '#25242c');
  },
  diet(c, x, y, col) { // the Diet building
    R(c, x + 1, y + 13, 18, 6, '#e8e2d0'); R(c, x + 1, y + 18, 18, 1, '#a89c80');
    R(c, x + 7, y + 7, 6, 7, '#e8e2d0'); R(c, x + 8, y + 4, 4, 3, '#d8d0b8'); R(c, x + 9, y + 2, 2, 2, '#c8bea0'); R(c, x + 10, y, 1, 2, '#c8bea0');
    for (let i = 0; i < 4; i++) R(c, x + 3 + i * 4, y + 15, 1, 3, shade(col, -0.2));
    R(c, x + 9, y + 9, 2, 4, shade(col, -0.2));
  },
  cabinet(c, x, y, col) { // the 官邸 (modern glass building)
    R(c, x + 2, y + 6, 16, 12, '#c8d0e0'); R(c, x + 2, y + 5, 16, 1, '#ffffff');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) R(c, x + 4 + i * 3.5, y + 8 + j * 3, 2, 2, shade(col, 0.15));
    R(c, x + 1, y + 17, 18, 2, '#5a6a8a'); R(c, x + 9, y + 1, 1, 5, '#c8b070'); R(c, x + 10, y + 1, 4, 3, '#d23a3a');
  },
  party(c, x, y, col) { // three people
    for (const [dx, k] of [[2, 0.85], [12, 0.85], [7, 1]]) {
      const cc = k === 1 ? col : shade(col, -0.3);
      disc(c, x + dx + 3, y + (k === 1 ? 6 : 7), 3, '#f6c9a0');
      R(c, x + dx, y + (k === 1 ? 10 : 11), 7, 8, cc);
    }
  },
  money(c, x, y, col) { // a coin and banknotes
    R(c, x + 1, y + 4, 13, 8, '#3a6a3a'); R(c, x + 2, y + 5, 11, 6, '#8acb8a'); disc(c, x + 7, y + 8, 2, '#3a6a3a');
    disc(c, x + 13, y + 13, 5, '#8a5a10'); disc(c, x + 13, y + 13, 4, col); R(c, x + 12, y + 11, 2, 5, '#8a5a10');
  },
  news(c, x, y, col) { // newspaper
    R(c, x + 1, y + 3, 18, 14, '#5a5240'); R(c, x + 2, y + 4, 16, 12, '#f4eedd');
    R(c, x + 3, y + 5, 8, 3, col); for (let i = 0; i < 3; i++) R(c, x + 3, y + 10 + i * 2, 6, 1, '#8a8270');
    for (let i = 0; i < 5; i++) R(c, x + 12, y + 5 + i * 2, 5, 1, '#8a8270');
  },
  alert(c, x, y, col) { R(c, x + 8, y + 2, 4, 11, col); R(c, x + 8, y + 15, 4, 3, col); },
  govt(c, x, y, col) { // 政府中枢 (govt_ui.js): a console screen with bars and a line
    R(c, x + 1, y + 2, 18, 13, '#05081a'); R(c, x + 2, y + 3, 16, 11, '#0f2a3a');
    R(c, x + 4, y + 9, 2, 4, col); R(c, x + 7, y + 7, 2, 6, col); R(c, x + 10, y + 5, 2, 8, shade(col, 0.3)); R(c, x + 13, y + 8, 2, 5, col);
    R(c, x + 3, y + 4, 4, 1, '#5fd7ff'); R(c, x + 8, y + 15, 4, 2, '#3a4066'); R(c, x + 5, y + 17, 10, 2, '#5a6488');
  },
};

// ================================================================ the scene and its views
// One full-screen HD scene hosts a stack of views. A view: { title, hint, tip(), modal, update(ui, inp),
// draw(c, ui) }. ui.open(view) → promise of the value given to ui.done(view, value).
// taps on the canvas while the politics UI is on top (only the header's ？ uses the position; a tap is also A)
let polTapCanvas = null;
function bindPolTap(g) {
  const cv = g && g.canvas;
  if (!cv || polTapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  polTapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const ui = g.top;
    if (!ui || !ui.isPolUI) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    ui.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
// 政治ナビ over the politics UI: with the phone open below (the 政治 app), step aside so the navi opens on top
async function naviOver(ui, topic) {
  const g = ui.g;
  if (typeof g.navi !== 'function') return;
  const i = g.scenes.indexOf(ui);
  const below = g.scenes.slice(0, Math.max(0, i)).some((s) => s.isPhone && !s.closing && !s.dismissed);
  if (!below) { await g.navi(topic); return; }
  g.pop(ui);
  try { await g.navi(topic); } finally { for (const s of g.scenes) if (s.isPhone) s.tapAt = null; if (!ui.closed) g.push(ui); }
}
class PolScene {
  constructor(g) {
    Object.assign(this, { g, hd: true, opaque: true, hidesHud: true, isPolUI: true, views: [], t: 0, lock: 0, toasts: [], tapAt: null, helpRect: null });
    bindPolTap(g);
  }
  help() { sfx('ok'); return this.act(() => naviOver(this, 'advice')); }
  top() { return this.views[this.views.length - 1]; }
  update(g) {
    this.t++;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < t.life);
    const v = this.top();
    if (v && !v.modal && !(v._busy > 0)) this.backdrop = null;
    const tap = this.tapAt;
    this.tapAt = null;
    if (!v || v._busy > 0) return;
    if (tap && !v.modal && this.helpRect && tap.x >= this.helpRect.x && tap.x < this.helpRect.x + this.helpRect.w && tap.y >= this.helpRect.y && tap.y < this.helpRect.y + this.helpRect.h) {
      if (g.input.pressedNow) g.input.pressedNow.a = false;
      this.help();
      return;
    }
    v.t = (v.t || 0) + 1;
    if (v.t < 3) return;
    try { v.update(this, g.input, g); } catch (e) { console.error(e); }
  }
  draw(c, g) {
    let baseIdx = -1;
    for (let i = this.views.length - 1; i >= 0; i--) if (!this.views[i].modal) { baseIdx = i; break; }
    const top = this.top();
    // a dialog that follows a list keeps that list on screen behind it (the list already closed)
    const useBack = !!(this.backdrop && top && top.modal && this.backdropDepth > baseIdx);
    const base = useBack ? this.backdrop : baseIdx >= 0 ? this.views[baseIdx] : null;
    if (!base || !base.ownBg) drawBg(c, this.t);
    if (base) {
      try { base.draw(c, this, g); } catch (e) { console.error(e); }
      if (!base.noChrome) chrome(c, g, this, base);
    } else chrome(c, g, this, { title: '政治' });
    for (let i = baseIdx + 1; i < this.views.length; i++) {
      const v = this.views[i];
      c.globalAlpha = 0.62; R(c, 0, 0, SW, SH, '#03050f'); c.globalAlpha = 1;
      try { v.draw(c, this, g); } catch (e) { console.error(e); }
    }
    if (top && top.modal && base && !base.noChrome) footer(c, this, top);
    let ty = SH - 52;
    for (const t of this.toasts) {
      const a = t.t < 6 ? t.t / 6 : t.life - t.t < 10 ? (t.life - t.t) / 10 : 1;
      c.globalAlpha = clamp(a, 0, 1);
      const w = Math.min(SW - 40, measure(c, t.text, 14) + 28);
      frame(c, (SW - w) / 2, ty, w, 24, '#1a2556', t.color || C.gold);
      T(c, fit(c, t.text, w - 16, 14), SW / 2, ty + 4, 14, t.color || C.gold, 'center');
      c.globalAlpha = 1;
      ty -= 28;
    }
  }
  open(view) {
    if (!view.modal) this.backdrop = null;
    return new Promise((res) => { view._res = res; view.t = 0; this.views.push(view); if (view.enter) view.enter(this); });
  }
  done(view, value) {
    const i = this.views.lastIndexOf(view);
    if (i < 0) return;
    if (!view.modal && view.isMenu && value !== -1 && value != null) { this.backdrop = view; this.backdropDepth = i; }
    this.views.splice(i, 1);
    this.g.input.consume();
    if (view.leave) view.leave(this);
    view._res(value);
  }
  // run an async step for the top view; that view ignores input until it is done
  async act(fn) {
    const v = this.top();
    if (v) v._busy = (v._busy || 0) + 1;
    try { return await fn(); } catch (e) { console.error(e); return null; } finally { if (v) v._busy--; this.g.input.consume(); }
  }
  toast(s, color) { this.toasts.unshift({ text: String(s), t: 0, life: 150, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  // helpers that return promises
  menu(o) { return this.open(menuView(o)); }
  confirm(o) { return this.open(confirmView(o)); }
  alert(title, textOrLines, o = {}) { return this.open(confirmView({ title, text: [].concat(textOrLines).join('\n'), choices: ['OK'], ...o })); }
}
let BG = null;
function drawBg(c, t) {
  if (!BG) {
    const [cv, x] = makeCanvas(SW, SH);
    const bands = ['#090d22', '#0b1027', '#0d132d', '#0f1633', '#111938', '#131c3e'];
    bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, Math.round((i * SH) / bands.length), SW, Math.ceil(SH / bands.length) + 1); });
    for (let i = 0; i < 160; i++) { const sx = Math.floor(hash2(i, 3, 7) * SW), sy = Math.floor(hash2(i, 5, 7) * SH); x.fillStyle = i % 9 ? '#1a2350' : '#26306a'; x.fillRect(sx, sy, 1, 1); }
    // the Diet building's silhouette, very faint
    x.fillStyle = '#121a3c';
    const bx = SW / 2, by = SH - 22;
    x.fillRect(bx - 230, by - 34, 460, 34); x.fillRect(bx - 50, by - 70, 100, 40); x.fillRect(bx - 36, by - 96, 72, 26);
    x.fillRect(bx - 24, by - 114, 48, 18); x.fillRect(bx - 12, by - 128, 24, 14); x.fillRect(bx - 4, by - 136, 8, 8);
    x.fillStyle = '#0f1634';
    for (let i = 0; i < 22; i++) x.fillRect(bx - 222 + i * 21, by - 28, 6, 24);
    BG = cv;
  }
  c.drawImage(BG, 0, 0);
  void t;
}
function chrome(c, g, ui, v) {
  // header
  R(c, 0, 0, SW, 25, C.head);
  R(c, 0, 25, SW, 1, C.goldDark);
  R(c, 0, 24, SW, 1, C.gold);
  ICONS.diet(c, 5, 2, '#5a78c8');
  const title = typeof v.title === 'function' ? v.title(ui) : v.title || '政治';
  const tt = fit(c, title, 280, 16);
  T(c, tt, 30, 4, 16, '#ffffff', 'left', 'rgba(0,0,0,0.5)');
  // ？ (政治ナビ): tap it, or focus it from the dashboard with ↑
  if (typeof g.navi === 'function') {
    const hx = 30 + Math.round(measure(c, tt, 16)) + 10;
    const on = !!(v.focus === 'help');
    ui.helpRect = { x: hx, y: 4, w: 58, h: 17 };
    frame(c, hx, 4, 58, 17, on ? '#1d4a44' : '#0f2a28', on ? C.gold : '#2a9d8f');
    T(c, '？ナビ', hx + 29, 6, 12, on ? '#ffffff' : '#7fe0d0', 'center');
  } else ui.helpRect = null;
  const d = polDate(g);
  const dl = `${dateLabel(g)}（${d.wareki}）`;
  const dw = measure(c, g.dayLabel(), 12);
  T(c, g.dayLabel(), SW - 8, 7, 12, C.dim, 'right');
  T(c, dl, SW - 16 - dw, 7, 12, C.cyan, 'right');
  footer(c, ui, ui.top() || v);
}
function footer(c, ui, v) {
  R(c, 0, SH - 20, SW, 20, C.head);
  R(c, 0, SH - 21, SW, 1, C.edge);
  const hint = typeof v.hint === 'function' ? v.hint(ui) : v.hint || 'A:けってい B:もどる';
  const hw = measure(c, hint, 12);
  T(c, hint, SW - 8, SH - 16, 12, C.dim, 'right');
  let tip = '';
  try { tip = typeof v.tip === 'function' ? v.tip(ui) : v.tip || ''; } catch (e) { tip = ''; }
  if (tip) {
    R(c, 6, SH - 15, 9, 9, C.cyan); T(c, 'i', 10, SH - 17, 12, C.head, 'center');
    T(c, fit(c, tip, SW - hw - 40, 12), 19, SH - 16, 12, C.cyan);
  }
}

// ---------------------------------------------------------------- a scrolling list
// items: [{ label, right, sub, color, tag: { text, color }, disabled, why, icon(c, x, y), labelColor }]
class ListBox {
  constructor(o = {}) { this.o = o; this.idx = o.index | 0; this.topRow = 0; }
  rows() { const it = typeof this.o.items === 'function' ? this.o.items() : this.o.items; return it || []; }
  current() { const r = this.rows(); return r[clamp(this.idx, 0, r.length - 1)]; }
  move(inp) {
    const n = this.rows().length;
    if (!n) return false;
    const before = this.idx;
    if (inp.repeat('up')) this.idx = (this.idx + n - 1) % n;
    if (inp.repeat('down')) this.idx = (this.idx + 1) % n;
    this.idx = clamp(this.idx, 0, n - 1);
    if (before !== this.idx) { sfx('cursor'); return true; }
    return false;
  }
  draw(c, x, y, w, h, focused = true, t = 0) {
    const rows = this.rows();
    const rh = this.o.rowH || 22;
    if (!rows.length) { para(c, this.o.empty || '（なし）', x + 10, y + 8, w - 20, 12, C.dim); return; }
    const vis = Math.max(1, Math.floor(h / rh));
    const idx = clamp(this.idx, 0, rows.length - 1);
    let top = this.topRow;
    if (idx < top) top = idx;
    if (idx >= top + vis) top = idx - vis + 1;
    top = clamp(top, 0, Math.max(0, rows.length - vis));
    this.topRow = top;
    const scroll = rows.length > vis;
    const ww = w - (scroll ? 5 : 0);
    for (let i = top; i < Math.min(rows.length, top + vis); i++) {
      const it = typeof rows[i] === 'string' ? { label: rows[i] } : rows[i];
      const ry = y + (i - top) * rh;
      const sel = i === idx;
      if (sel) { R(c, x, ry, ww, rh - 1, focused ? C.sel : C.selDim); R(c, x, ry, 2, rh - 1, focused ? C.gold : C.faint); }
      if (this.o.drawRow) { this.o.drawRow(c, it, x, ry, ww, rh, sel, i); continue; }
      let lx = x + 8;
      if (it.color) { R(c, lx, ry + Math.floor((rh - 12) / 2), 4, 12, it.color); lx += 9; }
      if (it.icon) { try { it.icon(c, lx, ry + Math.floor((rh - 20) / 2)); } catch (e) { console.error(e); } lx += 24; }
      const size = rh >= 22 ? 14 : 12;
      let rw = 0;
      if (it.right != null) { rw = measure(c, String(it.right), 12) + 10; T(c, String(it.right), x + ww - 6, ry + (it.sub ? 4 : Math.floor((rh - 13) / 2)), 12, it.rightColor || (it.disabled ? C.faint : sel ? C.gold : C.dim), 'right'); }
      if (it.tag) { const tw = measure(c, it.tag.text, 12) + 8; pill(c, x + ww - 6 - rw - tw, ry + (it.sub ? 3 : Math.floor((rh - 16) / 2)), it.tag.text, it.tag.color || C.faint, it.tag.fg || '#ffffff'); rw += tw + 4; }
      const lc = it.disabled ? C.faint : it.labelColor || (sel ? '#ffffff' : C.text);
      const ly = it.sub ? ry + 3 : ry + Math.floor((rh - size) / 2) - 1;
      T(c, fit(c, it.label, x + ww - lx - rw - 4, size), lx, ly, size, lc);
      if (it.sub && rh >= 30) T(c, fit(c, it.sub, x + ww - lx - 6, 12), lx, ry + 19, 12, it.subColor || C.dim);
    }
    if (scroll) {
      const bh = Math.max(10, Math.round((h * vis) / rows.length));
      const by = y + Math.round(((h - bh) * top) / Math.max(1, rows.length - vis));
      R(c, x + w - 3, y, 3, h, '#0c1230');
      R(c, x + w - 3, by, 3, bh, C.faint);
    }
    void t;
  }
}

// ---------------------------------------------------------------- generic views
// A list on the left and a detail panel on the right. o: { title, items, index, listW, listTitle, rowH,
// detail(c, item, rect, index, ui), tip(item, index), hint, keys(ui, inp, lb, view) -> true if handled, empty }
function menuView(o) {
  const lb = new ListBox({ items: o.items, index: o.index, rowH: o.rowH || 24, empty: o.empty, drawRow: o.drawRow });
  return {
    title: o.title, lb, isMenu: true,
    hint: o.hint || '↑↓ A:けってい B:もどる',
    tip: () => (o.tip ? o.tip(lb.current(), lb.idx) : ''),
    update(ui, inp) {
      lb.move(inp);
      if (o.keys && o.keys(ui, inp, lb, this)) return;
      if (inp.pressed('a')) {
        const it = lb.current();
        if (!it) { sfx('buzz'); return; }
        if (it.disabled) { sfx('buzz'); if (it.why) ui.toast(it.why, C.dim); return; }
        sfx('ok');
        ui.done(this, lb.idx);
        return;
      }
      if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(this, -1); }
    },
    draw(c, ui) {
      const lw = o.listW || 262;
      const ly = 30, lh = SH - 21 - 4 - ly;
      card(c, 6, ly, lw, lh, o.listTitle || null, o.listTitleRight ? { right: o.listTitleRight } : {});
      const inner = o.listTitle ? 21 : 4;
      lb.draw(c, 8, ly + inner, lw - 4, lh - inner - 4, true, ui.t);
      if (o.detail) {
        const dx = 6 + lw + 6;
        const rect = { x: dx, y: ly, w: SW - 6 - dx, h: lh };
        try { o.detail(c, lb.current(), rect, lb.idx, ui); } catch (e) { console.error(e); }
      }
    },
  };
}
// A modal question: { title, text, choices, w, color, draw(c, rect) (extra art above the text), danger }
function confirmView(o) {
  const choices = o.choices || ['はい', 'いいえ'];
  return {
    modal: true, idx: o.index | 0,
    hint: o.hint || (choices.length > 1 ? '↑↓ A:けってい B:もどる' : 'A:OK'),
    tip: () => o.tip || '',
    update(ui, inp) {
      const n = choices.length;
      if (inp.repeat('up') || inp.repeat('left')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down') || inp.repeat('right')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.done(this, this.idx); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(this, o.cancel ?? n - 1); }
    },
    draw(c, ui) {
      const w = o.w || 400;
      const size = 14;
      const lines = wrapJ(c, String(o.text || ''), w - 32, size);
      const artH = o.artH || 0;
      const shown = lines.slice(0, 11);
      const h = 34 + artH + shown.length * 20 + 10 + choices.length * 26 + 8;
      const x = Math.round((SW - w) / 2), y = Math.round(clamp((SH - 20 - h) / 2, 28, 200));
      const col = o.color || (o.danger ? C.bad : C.gold);
      R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.5)');
      frame(c, x, y, w, h, '#151e48', col);
      R(c, x + 1, y + 1, w - 2, 22, shade(col, -0.65));
      T(c, fit(c, o.title || '', w - 20, 14), x + 10, y + 4, 14, col);
      let yy = y + 30;
      if (o.draw) { try { o.draw(c, { x: x + 10, y: yy, w: w - 20, h: artH }); } catch (e) { console.error(e); } yy += artH; }
      shown.forEach((l, i) => T(c, l, x + 16, yy + i * 20, size, C.text));
      yy += shown.length * 20 + 10;
      choices.forEach((ch, i) => {
        const sel = i === this.idx;
        const bx = x + 24, bw = w - 48;
        frame(c, bx, yy, bw, 22, sel ? shade(col, -0.45) : '#1c2656', sel ? col : C.edge);
        T(c, fit(c, ch, bw - 30, 14), bx + bw / 2, yy + 3, 14, sel ? '#ffffff' : C.text, 'center');
        if (sel) cursor(c, bx + 8, yy + 7, ui.t, col);
        yy += 26;
      });
    },
  };
}

// ---------------------------------------------------------------- open the UI
function activeUI(g) { return g.scenes.find((s) => s.isPolUI && !s.closed) || null; }
export async function withUI(g, fn) {
  const open = activeUI(g);
  if (open) return fn(open);
  const ui = new PolScene(g);
  g.push(ui);
  sfx('ok');
  try { return await fn(ui); } finally { ui.closed = true; g.pop(ui); }
}

// ================================================================ UI data (flags.polui) and history
function uiData(g) {
  const fl = g.state.flags;
  let d = fl.polui;
  if (!d || typeof d !== 'object') d = fl.polui = {};
  if (!Array.isArray(d.eco)) d.eco = [];
  if (!d.fc || typeof d.fc !== 'object') d.fc = {};
  if (!Array.isArray(d.queue)) d.queue = [];
  return d;
}
function recordEco(g) {
  if (!g.state || !g.state.politics) return;
  const d = uiData(g);
  const E = g.state.politics.economy;
  const day = today(g);
  const last = d.eco[d.eco.length - 1];
  const snap = { day, growth: Math.round(num(E.growth) * 100) / 100, inflation: Math.round(num(E.inflation) * 100) / 100, unemployment: Math.round(num(E.unemployment) * 100) / 100, debtRatio: Math.round(num(E.debtRatio) * 10) / 10, yen: Math.round(num(E.yen) * 10) / 10, nikkei: Math.round(num(E.nikkei)) };
  if (last && last.day === day) d.eco[d.eco.length - 1] = snap; else d.eco.push(snap);
  if (d.eco.length > 60) d.eco.splice(0, d.eco.length - 60);
}
function recordForecast(g, eid) {
  const p = polOf(g);
  const e = p.elections.upcoming.find((x) => x.id === (eid || p.me.candidacy));
  if (!e || !myDecl(e) || e.kind === 'sosaisen') return null;
  const f = g.electionForecast(e.id);
  if (!f) return null;
  const d = uiData(g);
  const list = d.fc[e.id] || (d.fc[e.id] = []);
  const day = today(g);
  const rec = { day, chance: Math.round(f.chance * 100), votes: f.votes, rank: f.rank, seats: f.seats };
  if (list.length && list[list.length - 1].day === day) list[list.length - 1] = rec; else list.push(rec);
  if (list.length > 30) list.splice(0, list.length - 30);
  for (const k of Object.keys(d.fc)) if (k !== e.id && !p.elections.upcoming.some((x) => x.id === k)) delete d.fc[k];
  return rec;
}
function queue(g, item) {
  const d = uiData(g);
  if (d.queue.some((q) => q.kind === item.kind && q.id === item.id)) return;
  d.queue.push({ ...item, day: today(g) });
  if (d.queue.length > 12) d.queue.splice(0, d.queue.length - 12);
}
// the morning: economy history, the poll of the player's race
onMorning((g) => {
  try { recordEco(g); recordForecast(g); } catch (e) { console.error(e); }
  try { trackCareer(g); } catch (e) { console.error(e); }
});
const involved = (g) => { const me = polOf(g).me; return !!(me.office || me.party || me.wins || me.losses || me.candidacy || me.formerOffice); };
onPolitics('election', (g, d) => {
  try {
    const res = d && d.result;
    if (!res || !g.state) return;
    const mine = !!res.myResult;
    if (!mine && !((res.kind === 'shugi' || res.kind === 'sangi') && involved(g))) return;
    queue(g, { kind: 'night', id: res.id });
    // the morning notes would give the result away before the count: the card shows it instead
    if (mine && !g.auto && Array.isArray(g.morningNotes)) {
      const pt = polOf(g).parties[res.party];
      g.morningNotes = g.morningNotes.filter((n) => !(String(n).includes(res.label) || (res.kind === 'sosaisen' && pt && String(n).includes(`${pt.name}の`))));
    }
  } catch (e) { console.error(e); }
});
onPolitics('cabinet', (g, d) => {
  if (d && d.pm === 'player' && !('reshuffle' in d) && !d.joined && !d.coalition) queue(g, { kind: 'pm', id: 'pm' + today(g) });
});
onPolitics('offer', (g, o) => { if (o && o.id) queue(g, { kind: 'offer', id: o.id }); });

// ================================================================ the dashboard
const COMMANDS = [
  { id: 'elections', label: '選挙', color: '#e0a03a', tip: '衆院選・参院選は「公示」、ほかの選挙は「告示」で選挙運動が始まる' },
  { id: 'parties', label: '政党', color: '#e05a8a', tip: '国会議員5人以上か、得票率2%以上（議員1人以上）で「政党」と認められる' },
  { id: 'policy', label: '政策・法案', color: '#5fb7ff', tip: '法律案には、内閣が出す「閣法」と、議員が出す「議員立法」がある' },
  { id: 'diet', label: '国会', color: '#b8a0ff', tip: '法律は衆参両院で可決して成立。衆院は出席議員の3分の2で再可決できる' },
  { id: 'cabinet', label: '内閣', color: '#ff8a5a', tip: '総理大臣は国会が指名し、天皇が任命する（憲法6条・67条）' },
  { id: 'party', label: '党内', color: '#5ee07a', tip: '幹事長・政調会長・総務会長などの党役員が、党の運営と政策を担う' },
  { id: 'money', label: '資金・活動', color: '#ffd23f', tip: '政治資金は毎年、収支報告書で公開される（原則、翌年3月末まで）' },
  { id: 'news', label: 'ニュース', color: '#9aa3c8', tip: 'このゲームの政治はシミュレーション。実在の政治家は登場しない' },
  // the government console (js/engine/govt_ui.js, when loaded)
  { id: 'govt', label: '政府中枢', color: '#ffb547', tip: '予算・税・省庁・世論・国会・安全保障・危機管理を一つの画面で（政府中枢）' },
];
function alerts(g) {
  const p = polOf(g);
  const me = p.me;
  const out = [];
  const fy = fyOf(g);
  if (p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline' && p.cabinet.pm === 'player') out.push({ text: '内閣不信任案が可決された！「解散」か「総辞職」を決める', color: C.bad, run: (ui) => ncDecision(ui) });
  for (const o of me.offers.filter((x) => !x.answered)) out.push({ text: o.kind === 'post' ? `総理から入閣の打診：「${postName(o.post, fy)}」` : `党役員の打診：「${postName(o.post, fy, o.party)}」`, color: C.gold, run: (ui) => offerFlow(ui, o) });
  if (uiData(g).queue.length) out.push({ text: '見ていない結果がある（開票速報・採決など）', color: C.cyan, run: (ui) => drainQueue(ui.g) });
  const e = p.elections.upcoming.find((x) => myDecl(x) && x.status !== 'done');
  if (e) {
    const left = e.day - today(g);
    out.push({ text: today(g) === e.day ? `${electionShort(g, e)}：今日は投票日！` : today(g) >= e.koji ? `${electionShort(g, e)}の選挙期間中（投票日まで${daysLeft(left)}）` : `${electionShort(g, e)}に立候補を届け出た（${kojiWord(e.kind)}まで${daysLeft(e.koji - today(g))}）`, color: C.good, run: (ui) => campaignScreen(ui, e.id) });
  } else {
    // the 届出 window is open for the race the player announced (出馬表明), or for the seat they hold
    // (unless they announced their retirement): file before the 公示・告示 day
    const R0 = uiData(g).retire;
    const due = electionList(g).find((x) => x.kind !== 'sosaisen' && !ELECTION_KINDS[x.kind].newsOnly && filingState(g, x) === 'open'
      && (intentFor(g, x) || (me.office && !R0 && x.kind !== 'hosen' && officeOfE(x) === me.office && !ninetyApplies(g, x))));
    if (due) out.push({ text: `${electionShort(g, due)}の届出を受付中（${kojiWord(due.kind)}日 ${shortDate(g, due.koji)}まで）`, color: C.gold, run: (ui) => candidacyFlow(ui, due.id) });
  }
  return out;
}
// the あなた card's last line: what the player can do next (a newcomer's call to action), or the office's
// staff when in office. [text, colour]
function nextStep(g) {
  const p = polOf(g);
  const me = p.me;
  const d = uiData(g);
  const day = today(g);
  if (d.retire && !d.retire.done && me.office) return ['引退を表明・任期まで務める', C.warn];
  if (me.office) return [`秘書 ${me.staff}人・後援会 ${fmtNum(me.kouenkai)}人`, C.faint];
  const mine = p.elections.upcoming.find((e) => myDecl(e) && e.status !== 'done' && e.kind !== 'sosaisen');
  if (mine) return [day >= mine.koji ? `${electionShort(g, mine)}に立候補中・投票${daysLeft(mine.day - day)}` : `${electionShort(g, mine)}に立候補・${kojiWord(mine.kind)}${daysLeft(mine.koji - day)}`, C.good];
  const intent = me.intent && p.elections.upcoming.find((e) => e.id === me.intent.election && e.status !== 'done');
  if (intent) return [filingState(g, intent) === 'early' ? `${electionShort(g, intent)}に出馬表明・届出は${shortDate(g, filingOpens(intent))}から` : `${electionShort(g, intent)}の届出受付中・${shortDate(g, intent.koji)}まで`, filingState(g, intent) === 'early' ? C.good : C.gold];
  if (d.retire && d.retire.done) return [`政界を引退（${dateLabel(g, d.retire.done).replace(/上旬|中旬|下旬/, '')}）`, C.dim];
  let banned = false;
  try { banned = typeof g.civicBanned === 'function' && !!g.civicBanned(); } catch (e) { banned = false; }
  if (banned) return ['公民権停止中：立候補できない', C.bad];
  const age = ageOf(g.state);
  const minAge = Math.min(...Object.values(OFFICES).map((o) => num(o.ageMin, 25)));
  if (age < minAge) {
    const n = (minAge - age) * YEAR_DAYS - ((day - 1) % YEAR_DAYS);
    return [`立候補は${minAge}歳から（あと${n}日）`, C.cyan];
  }
  const next = electionList(g).find((e) => !ELECTION_KINDS[e.kind].newsOnly && e.kind !== 'sosaisen' && day <= e.koji && OFFICES[officeOfE(e)] && age >= OFFICES[officeOfE(e)].ageMin);
  if (next) return [filingState(g, next) === 'early' ? `つぎは${electionShort(g, next)}・届出は${shortDate(g, filingOpens(next))}から` : `つぎは${electionShort(g, next)}・届出は${shortDate(g, next.koji)}まで`, C.cyan];
  return [me.party ? '党の活動で評価を上げよう' : 'まずは選挙か政党から', C.cyan];
}
function dashboardView(g) {
  let sum = null, sumT = -99;
  const view = {
    title: '政治ダッシュボード', ownBg: false, idx: 0, focus: 'cmd', aidx: 0, tick: 0,
    hint: () => (view.focus === 'help' ? 'A:政治ナビ ↓:もどる' : view.focus === 'alert' ? '↑↓ A:ひらく B:もどる' : '←→↑ A:ひらく B:とじる'),
    tip: () => (view.focus === 'help' ? '政治ナビ（ことは先生）：いま何をすればいいか、用語、しくみ' : view.focus === 'alert' ? '返事や決断には期限がある。早めに対応しよう' : COMMANDS[view.idx].tip),
    summary(ui) { if (!sum || ui.t - sumT > 20) { sum = g.politicsSummary(); sumT = ui.t; } return sum; },
    update(ui, inp) {
      // the first visit of a newcomer: what this is and where to start (over the dashboard)
      const d = uiData(g);
      if (!d.introSeen) {
        d.introSeen = true;
        if (!involved(g)) { ui.act(() => ui.alert('政治アプリへようこそ', ['選挙・政党・国会・内閣・経済のいまを、ここで見られる。', `まずは「選挙」で、立候補の条件（${Math.min(...Object.values(OFFICES).map((o) => num(o.ageMin, 25)))}歳から・供託金・届出の期限）を確かめよう。`, '立候補の届出は、ドット区役所2階の選挙管理委員会や、永田町の党本部でもできる。'], { w: 460 })); return; }
      }
      const al = alerts(g);
      if (view.focus === 'alert' && !al.length) view.focus = 'cmd';
      if (view.focus === 'help') {
        if (typeof g.navi !== 'function') { view.focus = 'cmd'; return; }
        if (inp.pressed('a')) { ui.help(); return; }
        if (inp.pressed('down') || inp.pressed('b')) { view.focus = al.length ? 'alert' : 'cmd'; view.aidx = 0; sfx('cursor'); }
        return;
      }
      if (view.focus === 'cmd') {
        if (inp.repeat('left')) { view.idx = (view.idx + COMMANDS.length - 1) % COMMANDS.length; sfx('cursor'); }
        if (inp.repeat('right')) { view.idx = (view.idx + 1) % COMMANDS.length; sfx('cursor'); }
        if (inp.pressed('up') && al.length) { view.focus = 'alert'; view.aidx = 0; sfx('cursor'); }
        else if (inp.pressed('up') && typeof g.navi === 'function') { view.focus = 'help'; sfx('cursor'); }
        if (inp.pressed('a')) { sfx('ok'); ui.act(async () => { await openSection(ui, COMMANDS[view.idx].id); sum = null; }); return; }
      } else {
        if (inp.repeat('up')) { if (view.aidx > 0) { view.aidx--; sfx('cursor'); } else if (typeof g.navi === 'function') { view.focus = 'help'; sfx('cursor'); } }
        if (inp.repeat('down')) { if (view.aidx < al.length - 1) { view.aidx++; sfx('cursor'); } else { view.focus = 'cmd'; sfx('cursor'); } }
        view.aidx = clamp(view.aidx, 0, Math.max(0, al.length - 1));
        if (inp.pressed('a') && al[view.aidx]) { sfx('ok'); const a = al[view.aidx]; ui.act(async () => { await a.run(ui); sum = null; }); return; }
      }
      if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(view, null); }
    },
    draw(c, ui) { drawDashboard(c, g, ui, view, view.summary(ui)); },
  };
  return view;
}
function drawDashboard(c, g, ui, view, s) {
  const p = polOf(g);
  const me = p.me;
  const day = today(g);
  // ---- あなた
  {
    const x = 6, y = 30, w = 206, h = 122;
    card(c, x, y, w, h, 'あなた', { right: me.office ? (OFFICES[me.office] || {}).short : '民間人', rightW: 60 });
    R(c, x + 7, y + 23, 54, 42, '#0c1230');
    drawFaceHD(c, g.state.look, x + 8, y + 24, 1.6);
    T(c, fit(c, playerName(g), w - 76, 14), x + 68, y + 23, 14, '#ffffff');
    T(c, fit(c, me.office ? OFFICES[me.office].label : me.formerOffice ? `元${OFFICES[me.formerOffice].short}` : '民間人', w - 76, 12), x + 68, y + 40, 12, C.dim);
    const pw = partyChip(c, g, me.party, x + 68, y + 54);
    if (me.posts.length) T(c, fit(c, me.posts.map((q) => postName(q, fyOf(g), me.party)).join('・'), w - 80 - pw, 12), x + 72 + pw, y + 55, 12, C.gold);
    const gauges = [['評判', (me.reputation + 100) / 200, me.reputation >= 0 ? C.good : C.bad, Math.round(me.reputation)], ['地元', me.localSupport / 100, C.cyan, Math.round(me.localSupport)], ['党内', me.standing / 100, C.gold, me.party ? Math.round(me.standing) : '—']];
    gauges.forEach(([lab, f, col, v], i) => {
      const gx = x + 8 + i * 66;
      T(c, lab, gx, y + 67, 12, C.dim);
      T(c, String(v), gx + 58, y + 67, 12, C.text, 'right');
      hbar(c, gx, y + 81, 58, 6, f, col);
    });
    T(c, '政治資金', x + 8, y + 90, 12, C.dim);
    T(c, fmtMoney(me.funds), x + w - 8, y + 90, 12, C.gold, 'right');
    if (me.secret > 0) {
      const blink = Math.floor(ui.t / 24) % 2 === 0;
      R(c, x + 3, y + 105, w - 6, 15, blink ? '#5a1420' : '#3a0e18');
      T(c, fit(c, `⚠ 裏金 ${fmtMoney(me.secret)}・発覚の危険`, w - 12, 12), x + 7, y + 106, 12, '#ffb0b8');
    } else { const [s1, col] = nextStep(g); T(c, fit(c, s1, w - 16, 12), x + 8, y + 105, 12, col); }
  }
  // ---- 内閣
  {
    const x = 216, y = 30, w = 206, h = 122;
    const C2 = s.cabinet;
    card(c, x, y, w, h, '内閣', { right: `発足 ${Math.max(0, day - num(C2.formed))}日`, rightW: 70 });
    R(c, x + 7, y + 23, 38, 30, '#0c1230');
    drawFaceHD(c, lookOf(g, p, C2.pm), x + 10, y + 26, 1);
    T(c, fit(c, `${C2.pm === 'player' ? playerName(g) : C2.pmName || '（不在）'} 内閣`, w - 58, 14), x + 50, y + 23, 14, '#ffffff');
    let cx = x + 50;
    for (const id of C2.partyIds.slice(0, 4)) { cx += partyChip(c, g, id, cx, y + 39) + 4; if (cx > x + w - 30) break; }
    T(c, '支持率', x + 8, y + 58, 12, C.dim);
    const ap = C2.approval;
    T(c, `${ap}%`, x + 56, y + 54, 16, ap >= 50 ? C.good : ap >= 30 ? C.gold : C.bad);
    const pl = p.polls;
    if (pl.length >= 2) { const d = Math.round(pl[pl.length - 1].approval - pl[pl.length - 2].approval); T(c, `前週比 ${d > 0 ? '▲' : d < 0 ? '▼' : '±'}${Math.abs(d)}`, x + w - 8, y + 58, 12, d >= 0 ? C.good : C.bad, 'right'); }
    spark(c, pl.slice(-30).map((q) => q.approval), x + 8, y + 76, w - 16, 38, ap >= 30 ? C.good : C.bad, { min: 0, max: 80, ref: 30, fill: true });
    T(c, pl.length ? '週ごとの世論調査' : '世論調査は毎週月曜日', x + 10, y + 77, 12, C.faint);
  }
  // ---- 国会
  {
    const x = 426, y = 30, w = 208, h = 122;
    const S = s.diet.session;
    const sessTxt = s.diet.shugi.dissolved ? '衆院 解散中' : S ? `${S.kind}・残り${Math.max(0, S.end - day)}日` : '閉会中';
    card(c, x, y, w, h, '国会', { right: sessTxt, rightColor: S ? C.good : s.diet.shugi.dissolved ? C.bad : C.dim, rightW: 110 });
    const gs = seatGroups(p, 'shugi');
    drawHemi(c, x + 52, y + 96, 46, gs);
    T(c, '衆議院', x + 52, y + 100, 12, C.dim, 'center');
    const rs = (h2) => (p.cabinet.partyIds || []).reduce((a, id) => a + num(p.diet[h2].seats[id]), 0);
    const st = p.diet.shugi.total, ss = p.diet.sangi.total;
    T(c, `衆 与党 ${rs('shugi')}/${st}`, x + 106, y + 26, 12, rs('shugi') > st / 2 ? C.text : C.bad);
    T(c, `過半数 ${Math.floor(st / 2) + 1}`, x + 106, y + 40, 12, C.faint);
    T(c, `参 与党 ${rs('sangi')}/${ss}`, x + 106, y + 56, 12, rs('sangi') > ss / 2 ? C.text : C.bad);
    // 参院: stacked bar
    let bx = x + 106;
    const bw = w - 114;
    for (const gr of seatGroups(p, 'sangi')) { const ww = Math.max(1, Math.round((gr.n / Math.max(1, ss)) * bw)); R(c, bx, y + 71, Math.min(ww, x + 106 + bw - bx), 6, gr.color); bx += ww; if (bx >= x + 106 + bw) break; }
    R(c, x + 106 + Math.round(bw / 2), y + 69, 1, 10, '#ffffff');
    if (s.diet.nejire) pill(c, x + 106, y + 82, 'ねじれ国会', C.bad);
    const pend = g.billsList({ pending: true }).filter((b) => b.kind !== 'noconfidence');
    const mine = pend.filter((b) => b.by === 'player').length;
    T(c, `法案 ${pend.length}本`, x + 106, y + 101, 12, C.dim);
    if (mine) T(c, `★${mine}`, x + w - 8, y + 101, 12, C.gold, 'right');
  }
  // ---- 選挙
  {
    const x = 6, y = 156, w = 206, h = 108;
    card(c, x, y, w, h, 'つぎの選挙');
    const list = s.upcoming.filter((e) => !e.newsOnly && (e.kind !== 'sosaisen' || e.party === me.party)).slice(0, 3);
    if (!list.length) T(c, '予定されている選挙はない', x + 10, y + 26, 12, C.dim);
    list.forEach((e, i) => {
      const ry = y + 22 + i * 28;
      const full = p.elections.upcoming.find((z) => z.id === e.id) || e;
      const left = e.day - day;
      if (e.declared) R(c, x + 3, ry, w - 6, 26, '#1f3a2e');
      T(c, fit(c, electionShort(g, full), w - 80, 14), x + 8, ry + 1, 14, e.declared ? C.good : '#ffffff');
      // not filed yet: when the 届出 opens / until when it is taken (党首選: the 告示 day)
      const fs = e.declared || e.kind === 'sosaisen' ? null : filingState(g, full);
      const st2 = day >= e.day ? '投票日' : day >= e.koji ? '選挙期間中' : fs === 'early' ? `届出 ${shortDate(g, filingOpens(full))}から` : fs === 'open' ? `届出受付 〜${shortDate(g, e.koji)}` : `${kojiWord(e.kind)} ${e.kojiDate.replace(/^\d+年/, '')}`;
      T(c, fit(c, `${st2}${e.declared ? '・立候補中' : ''}`, w - 80, 12), x + 8, ry + 15, 12, e.declared ? C.good : fs === 'open' && day < e.koji ? C.gold : C.dim);
      T(c, daysLeft(left), x + w - 8, ry + 6, 14, left <= 7 ? C.gold : C.text, 'right');
    });
  }
  // ---- 経済
  {
    const x = 216, y = 156, w = 418, h = 108;
    card(c, x, y, w, h, '経済（シミュレーション）', { right: `消費税 ${taxWord(s.economy.taxRate)}・予算 ${fmtCho(s.economy.budget.spending)}`, rightW: 200 });
    const hist = uiData(g).eco;
    const prev = hist.length > 7 ? hist[hist.length - 8] : hist[0];
    const E = p.economy;
    const tiles = [
      ['成長率', E.growth, (v) => pct(v), 'growth', 1, C.good],
      ['物価上昇率', E.inflation, (v) => pct(v), 'inflation', -1, C.gold],
      ['失業率', E.unemployment, (v) => pct(v), 'unemployment', -1, C.cyan],
      ['政府債務', E.debtRatio, (v) => `GDP比${Math.round(v)}%`, 'debtRatio', -1, C.bad],
      ['円相場', E.yen, (v) => `1ドル${Math.round(v)}円`, 'yen', 0, '#b8a0ff'],
      ['株価（日経平均）', E.nikkei, (v) => `${fmtNum(v)}円`, 'nikkei', 1, C.pink],
    ];
    tiles.forEach(([lab, v, f, key, good, col], i) => {
      const tx = x + 6 + (i % 3) * 137, ty = y + 22 + Math.floor(i / 3) * 42;
      R(c, tx, ty, 133, 40, '#141d44');
      T(c, lab, tx + 4, ty + 2, 12, C.dim);
      T(c, fit(c, f(num(v)), 74, 14), tx + 4, ty + 19, 14, '#ffffff');
      const d = prev ? num(v) - num(prev[key]) : 0;
      if (prev && Math.abs(d) > 1e-6) {
        const up = d > 0;
        const ok = good === 0 ? null : (up ? good > 0 : good < 0);
        T(c, up ? '▲' : '▼', tx + 4 + Math.min(74, measure(c, f(num(v)), 14)) + 3, ty + 21, 12, ok == null ? C.dim : ok ? C.good : C.bad);
      }
      spark(c, hist.map((q) => q[key]).concat(hist.length && hist[hist.length - 1].day === today(g) ? [] : [num(v)]), tx + 84, ty + 14, 45, 22, col);
    });
  }
  // ---- お知らせ / ニュース
  {
    const x = 6, y = 268, w = SW - 12;
    const al = alerts(g);
    if (al.length) {
      const sel = view.focus === 'alert';
      const i = clamp(view.aidx, 0, al.length - 1);
      const a = al[sel ? i : Math.floor(ui.t / 180) % al.length];
      const blink = Math.floor(ui.t / 20) % 2 === 0;
      frame(c, x, y, w, 20, sel ? '#2a2a10' : '#191c38', sel ? C.gold : blink ? a.color : C.edge);
      ICONS.alert(c, x + 2, y, a.color);
      T(c, fit(c, a.text, w - 90, 14), x + 24, y + 2, 14, a.color);
      T(c, `${al.length > 1 ? `${sel ? i + 1 : '1'}/${al.length}　` : ''}${sel ? 'A:ひらく' : '↑:えらぶ'}`, x + w - 8, y + 4, 12, C.dim, 'right');
    } else {
      frame(c, x, y, w, 20, '#10173a', C.edge);
      const news = p.news.slice(0, 6);
      pill(c, x + 4, y + 2, 'ニュース', '#3a4a8a');
      if (news.length) {
        const k = Math.floor(ui.t / 240) % news.length;
        const ph = (ui.t % 240) / 240;
        c.globalAlpha = ph < 0.06 ? ph / 0.06 : ph > 0.94 ? (1 - ph) / 0.06 : 1;
        T(c, fit(c, `${dateLabel(g, news[k].day).replace(/^\d+年/, '')}　${news[k].text}`, w - 84, 12), x + 72, y + 4, 12, C.text);
        c.globalAlpha = 1;
      } else T(c, 'まだ政治ニュースはない', x + 72, y + 4, 12, C.dim);
    }
  }
  // ---- commands
  {
    const y = 292, tw = 70, x0 = Math.round((SW - COMMANDS.length * tw) / 2);
    COMMANDS.forEach((cmd, i) => {
      const x = x0 + i * tw;
      const sel = view.focus === 'cmd' && view.idx === i;
      const lift = sel ? -2 : 0;
      frame(c, x + 2, y + lift, tw - 4, 44, sel ? shade(cmd.color, -0.55) : '#151d44', sel ? cmd.color : C.edge);
      if (sel) R(c, x + 3, y + 1 + lift, tw - 6, 1, shade(cmd.color, 0.2));
      ICONS[cmd.id](c, x + tw / 2 - 10, y + 3 + lift, cmd.color);
      T(c, cmd.label, x + tw / 2, y + 26 + lift, 12, sel ? '#ffffff' : C.dim, 'center');
    });
  }
}

// ================================================================ sections (filled below)
async function openSection(ui, id, opts = {}) {
  const fn = SECTIONS[id];
  if (!fn) { await ui.alert('準備中', 'この画面はまだ準備中です。'); return null; }
  return fn(ui, opts);
}
const SECTIONS = {};
// 政府中枢 (govt_ui.js registers g.govtConsole): opens over the politics UI and comes back here
SECTIONS.govt = async (ui) => {
  const g = ui.g;
  if (typeof g.govtConsole === 'function') { await g.govtConsole('overview'); return; }
  await ui.alert('政府中枢', '政府中枢の画面は、まだ読み込まれていない。');
};

// ================================================================ the overnight queue
async function drainQueue(g) {
  const d = uiData(g);
  if (g.auto && !g.auto.polui) { d.queue.length = 0; return; }
  const p = polOf(g);
  const nc = p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline' && p.cabinet.pm === 'player' && !p.cabinet.ncAsked;
  if (!d.queue.length && !nc) return;
  await withUI(g, async (ui) => {
    for (let guard = 0; guard < 16 && d.queue.length; guard++) {
      const it = d.queue.shift();
      try {
        if (it.kind === 'night' && SECTIONS.night) await SECTIONS.night(ui, { resultId: it.id });
        else if (it.kind === 'pm' && SECTIONS.pmCeremony) await SECTIONS.pmCeremony(ui, {});
        else if (it.kind === 'offer') { const o = p.me.offers.find((x) => x.id === it.id && !x.answered); if (o) await offerFlow(ui, o); }
        else if (it.kind === 'vote' && SECTIONS.vote) await SECTIONS.vote(ui, { billId: it.id, house: it.house });
        else if (it.kind === 'career') { const rec = (uiData(g).career || [])[0]; if (rec) { await ui.alert('政界引退', [`${rec.office ? `${rec.office}の任期を終え、` : ''}政界を引退した。`, '長いあいだ、おつかれさまでした。'], { draw: (c, rc) => stampArt(c, rc, '引退', '#8a6a1a'), artH: 60 }); await ui.open(careerCardView(g, rec)); } }
        else if (it.kind === 'einen') { sfx('fanfare'); await ui.alert('永年在職議員表彰', ['衆議院議員として在職25年。', '本会議で、永年在職議員として表彰された。', '評判と知名度が上がった。'], { draw: (c, rc) => stampArt(c, rc, '表彰'), artH: 60 }); }
      } catch (e) { console.error(e); }
    }
    if (p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline' && p.cabinet.pm === 'player' && !p.cabinet.ncAsked) await ncDecision(ui);
  });
}
async function offerFlow(ui, o) {
  const g = ui.g;
  const p = polOf(g);
  const fy = fyOf(g);
  const post = o.kind === 'post' ? postName(o.post, fy) : postName(o.post, fy, o.party);
  const from = o.kind === 'post' ? `${g.npcName(o.from) || ''}総理` : `${g.npcName(o.from) || ''}${postName('party_leader', fy, o.party)}`;
  // (2026-10 fix) the former PM of the もしも regime cannot take a cabinet post (regime.js g.regimeBarred): say why
  let bar = null;
  try { bar = o.kind === 'post' && typeof g.regimeBarred === 'function' ? g.regimeBarred('player', o.post) : null; } catch (e) { bar = null; }
  if (bar) { g.respondOffer(o.id, false); sfx('buzz'); await ui.alert('入閣の打診', [`「${post}」の打診は、受けられない。`, bar]); return; }
  const i = await ui.confirm({
    title: o.kind === 'post' ? '入閣の打診' : '党役員の打診',
    text: `${from}から連絡があった。\n「${post}」をお願いしたい、とのこと。\n返事の期限：${dateLabel(g, o.until)}`,
    choices: ['引き受ける', 'ことわる', 'あとで考える'],
    tip: o.kind === 'post' ? '国務大臣は総理大臣が任命し、天皇が認証する（認証官）' : '党役員は党首が決める。党内の評価が上がる',
    artH: 46, draw: (c, r) => { R(c, r.x, r.y, 40, 36, '#0c1230'); drawFaceHD(c, npcLook(p, o.from), r.x + 4, r.y + 6, 1); T(c, fit(c, post, r.w - 56, 16), r.x + 50, r.y + 8, 16, C.gold); },
  });
  if (i === 2 || i < 0) return;
  const why = g.respondOffer(o.id, i === 0);
  if (why) await ui.alert('打診', why);
  else if (i === 0) { sfx('fanfare'); await ui.alert('就任', `「${post}」に就任した！`); }
  else await ui.alert('打診', 'ていねいにお断りした。');
}
async function ncDecision(ui) {
  const g = ui.g;
  const p = polOf(g);
  p.cabinet.ncAsked = true;
  const i = await ui.confirm({
    title: '内閣不信任案が可決された', danger: true,
    text: '憲法69条により、内閣は10日以内に衆議院を解散するか、総辞職しなければならない。\nどうする？',
    choices: ['衆議院を解散する（総選挙へ）', '内閣総辞職する', 'もう少し考える'],
    tip: '解散すれば総選挙で国民に信を問う。総辞職なら国会が新しい総理を指名する',
  });
  p.cabinet.ncAsked = false;
  if (i === 0) {
    const id = g.dissolve('内閣不信任案の可決を受けて');
    if (id) { sfx('drum'); await ui.alert('衆議院解散', ['衆議院を解散した。', `総選挙は${dateLabel(g, (p.elections.upcoming.find((e) => e.id === id) || {}).day)}。`]); }
    else await ui.alert('解散', g.lastPoliticsError || '解散できなかった');
  } else if (i === 1) {
    const w = g.resignPM('内閣不信任案の可決');
    await ui.alert('内閣総辞職', w || '内閣は総辞職した。国会で新しい総理大臣が指名される。');
  }
}

// ================================================================ entry points
export async function openPolitics(g, screen = 'dashboard', opts = {}) {
  if (!g.state) return null;
  if (g.auto && !g.auto.polui) return null;
  try { g.pol(); recordEco(g); } catch (e) { console.error(e); return null; }
  return withUI(g, async (ui) => {
    if (uiData(g).queue.length) await drainQueue(g);
    if (screen === 'dashboard') return ui.open(dashboardView(g));
    return openSection(ui, screen, opts);
  });
}
export function politicsScreen(g, name, opts) { return openPolitics(g, name, opts); }
export function politicsEvents(g) { return drainQueue(g); }

Game.prototype.politicsMenu = function politicsMenu() { return openPolitics(this, 'dashboard'); };
Game.prototype.politicsScreen = function politicsScreenM(name, opts = {}) { return openPolitics(this, name || 'dashboard', opts); };
Game.prototype.politicsEvents = function politicsEventsM() { return drainQueue(this); };
// after the night: the election count, a new PM, offers, votes on the player's bills
{
  const sleep0 = Game.prototype.sleep;
  Game.prototype.sleep = async function sleepWithPolitics(opts = {}) {
    let snap = null;
    try { snap = billSnapshot(this); } catch (e) { snap = null; }
    const r = await sleep0.call(this, opts);
    try { if (snap) billReplays(this, snap); await drainQueue(this); } catch (e) { console.error(e); }
    return r;
  };
}
function billSnapshot(g) {
  const p = g.state && g.state.politics;
  if (!p) return null;
  const s = {};
  for (const b of p.diet.bills) s[b.id] = Object.keys(b.votes || {}).join(',');
  return s;
}
function billReplays(g, snap) {
  const p = g.state && g.state.politics;
  if (!p) return;
  const me = p.me;
  for (const b of p.diet.bills) {
    const keys = Object.keys(b.votes || {});
    const before = (snap[b.id] || '').split(',').filter(Boolean);
    const fresh = keys.filter((k) => !before.includes(k));
    if (!fresh.length) continue;
    const mine = b.by === 'player' || me.votes[b.id] || b.kind === 'noconfidence' || (b.kind === 'amendment' && involved(g));
    if (!mine) continue;
    queue(g, { kind: 'vote', id: b.id, house: fresh[fresh.length - 1] });
  }
}

registerPhoneApp('politics', {
  name: '政治', color: '#3a5a9a', order: 60,
  iconHD(c, x, y) {
    appTile(c, x, y, '#2d4f96');
    // the Diet building: wings, the central tower with its stepped roof
    R(c, x + 4, y + 19, 24, 7, '#ece6d4'); R(c, x + 4, y + 25, 24, 1, '#a89c80');
    R(c, x + 12, y + 12, 8, 8, '#ece6d4'); R(c, x + 13, y + 9, 6, 3, '#ddd4bc'); R(c, x + 14, y + 7, 4, 2, '#cfc4a6'); R(c, x + 15, y + 5, 2, 2, '#c4b896');
    for (let i = 0; i < 5; i++) R(c, x + 6 + i * 4, y + 21, 1, 4, '#7a88b0');
    R(c, x + 15, y + 15, 2, 5, '#7a88b0');
    R(c, x + 4, y + 26, 24, 2, '#6a9a5a');
  },
  badge: (g) => { const p = g.state && g.state.politics; if (!p || !p.me) return 0; return p.me.offers.filter((o) => !o.answered).length + ((g.state.flags.polui && Array.isArray(g.state.flags.polui.queue)) ? g.state.flags.polui.queue.length : 0) + (p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline' && p.cabinet.pm === 'player' ? 1 : 0); },
  open: (g) => openPolitics(g, 'dashboard'),
});

// ================================================================ SECTIONS BELOW
// ================================================================ 選挙
const officeOfE = (e) => (!e ? null : e.kind === 'hosen' ? (e.house === 'sangi' ? 'sangi' : 'shugi') : (ELECTION_KINDS[e.kind] || {}).office || null);
function findE(g, id) { return polOf(g).elections.upcoming.find((x) => x.id === id) || null; }
function electionList(g) {
  const p = polOf(g);
  return p.elections.upcoming.filter((e) => e.status !== 'done' && (e.kind !== 'sosaisen' || e.party === p.me.party)).sort((a, b) => a.day - b.day);
}
function districtText(g, e) {
  const p = polOf(g);
  const y = e.year || yearOf(g);
  if (e.kind === 'kugi') return `ドット区（定数${p.local.kugi.total || 40}）`;
  if (e.kind === 'togi') return 'ドット区選挙区（定数3）';
  if (e.kind === 'shicho') return 'ドット区（1人）';
  if (e.kind === 'chiji') return '東京都（1人）';
  if (e.kind === 'hosen') return `${e.house === 'sangi' ? '参議院' : '衆議院'}・${e.district || ''}（1人）`;
  if (e.kind === 'sosaisen') { const pt = p.parties[e.party]; return `${pt ? pt.name : ''}の国会議員と党員`; }
  if (e.kind === 'shugi') { const Rr = shugiRules(y, p.flags); return Rr.system === 'chusenkyoku' ? `東京ドット区（定数4）・全国${Rr.total}議席` : `東京ドット区（小選挙区）・全国${Rr.total}（小選挙区${Rr.smd}・比例${Rr.pr}）`; }
  if (e.kind === 'sangi') { const Rr = sangiRules(y); return `東京都選挙区（改選${tokyoSangiMagnitude(y)}）・比例（改選${Rr.pr}）`; }
  return '';
}
function systemTip(g, e) {
  if (!e) return '';
  const p = polOf(g);
  const y = e.year || yearOf(g);
  switch (e.kind) {
    case 'shugi': return shugiRules(y, p.flags).system === 'chusenkyoku' ? '中選挙区制：1つの選挙区から原則3〜5人が当選する（1993年まで）' : '小選挙区は1位だけが当選。比例代表はドント方式で議席を配分';
    case 'sangi': return sangiRules(y).list === 'hikousoku' ? '参院の比例は非拘束名簿式：党の議席の中で個人名の票が多い順に当選' : '参院の比例は拘束名簿式：政党が決めた名簿の順に当選（1983〜1998年）';
    case 'kugi': return '区議選：区全体が1つの選挙区。得票の多い順に定数まで当選';
    case 'togi': return '都議選：ドット区選挙区は定数3。得票の多い順に当選';
    case 'shicho': case 'chiji': return '首長選：得票1位が当選。任期は4年';
    case 'hosen': return y >= 2000 ? '国会議員の補欠選挙は、原則4月と10月の第4日曜日にまとめて行う（2000年から）' : '国会議員に欠員が出ると、補欠選挙で選び直す';
    case 'sosaisen': return '党首選は国会議員の票と党員票で争う。過半数なしなら上位2人の決選投票';
    case 'touitsu': return '統一地方選挙は4年ごと。多くの自治体の選挙を同じ日に行う';
    default: return '';
  }
}
function forfeitText(g, e) {
  const p = polOf(g);
  const y = e.year || yearOf(g);
  const sys = e.kind === 'shugi' ? shugiRules(y, p.flags).system : 'heiritsu';
  const M = e.kind === 'kugi' ? p.local.kugi.total || 40 : e.kind === 'togi' ? 3 : e.kind === 'sangi' ? tokyoSangiMagnitude(y) : sys === 'chusenkyoku' ? 4 : 1;
  const k = e.kind === 'hosen' && e.house === 'sangi' ? 'sangi' : e.kind === 'hosen' ? 'shugi' : e.kind;
  const share = forfeitShare(k, M, sys);
  const frac = M > 1 ? `有効投票÷定数の${Math.round(1 / (share * M))}分の1` : `有効投票の${Math.round(1 / share)}分の1`;
  return `得票が${frac}に届かないと没収`;
}
function eligibilityChecks(g, e) {
  const p = polOf(g);
  const me = p.me;
  const off = officeOfE(e);
  const O = OFFICES[off];
  if (!O) return [];
  // the age on the election day counts (公選法10条2項), as the core's eligible({ day })
  const age = ageOf({ profile: g.state.profile, day: e.day });
  const J = g.state.justice;
  let banned = false;
  try { banned = typeof g.civicBanned === 'function' ? !!g.civicBanned() : false; } catch (err) { banned = false; }
  const custody = !!(J && (J.status === 'prison' || J.status === 'detained'));
  const dep = g.depositInternal(off);
  const have = num(g.state.money) + num(me.funds);
  const fs = filingState(g, e);
  const out = [
    { ok: age >= O.ageMin, text: `被選挙権：${O.ageMin}歳以上（投票日に${age}歳）` },
    { ok: !banned, text: banned ? '公民権停止中：立候補できない' : '公民権：問題なし' },
    { ok: !custody, text: custody ? '身柄を拘束されていて届出に行けない' : '届出に行ける' },
    // the deposit is lodged when filing: before the window it is only a note
    { ok: have >= dep || fs === 'early', warn: have < dep && fs === 'early', deposit: true, text: `供託金 ${fmtMoney(dep)}（手元 ${fmtMoney(have)}）` },
    fs === 'closed' ? { ok: false, text: `届出は${kojiWord(e.kind)}日（${dateLabel(g, e.koji)}）で締め切った` }
      : { ok: true, warn: fs === 'early', window: true, text: `届出：${shortDate(g, filingOpens(e))}〜${shortDate(g, e.koji)}（${kojiWord(e.kind)}日）${fs === 'open' ? '受付中' : ''}` },
  ];
  if (ninetyApplies(g, e)) out.push({ ok: true, warn: true, text: `いまの${OFFICES[me.office].short}の職は失う（公選法90条）` });
  return out;
}
// 公職選挙法90条: an office holder who stands for another office is deemed to have resigned (as the core)
function ninetyApplies(g, e) {
  const p = polOf(g);
  const me = p.me;
  const off = officeOfE(e);
  if (!off || !me.office || !e || e.kind === 'sosaisen') return false;
  if (me.office !== off || e.kind === 'hosen') return true;
  if (off === 'sangi') { const cl = (p.diet.sangi.classes || []).map((c) => num(c.year)); return cl.length ? num(me.sangiClass) !== Math.min(...cl) : false; }
  return false;
}
function ninetyText(g, e) {
  const me = polOf(g).me;
  return `⚠ いまの${OFFICES[me.office].label}の職は、${kojiWord(e.kind)}の日に失う（公職選挙法90条：ほかの公職の候補者になると、いまの職を辞めたものとみなされる）`;
}
const declWord = (d) => (!d ? '' : d.pr ? '比例代表' : d.prOnly ? '比例単独' : d.proportional ? '選挙区と比例に重複' : '選挙区');
function checkRow(c, ok, s, x, y, w, warn = false) {
  R(c, x, y + 2, 11, 11, warn ? '#5a4a1a' : ok ? '#1f5a34' : '#5a1f2a');
  T(c, warn ? '!' : ok ? '✓' : '✕', x + 5, y, 12, warn ? C.warn : ok ? C.good : C.bad, 'center');
  T(c, fit(c, s, w - 16, 12), x + 16, y, 12, warn ? C.warn : ok ? C.text : '#ffb0b8');
}
function drawElectionDetail(c, g, e, r) {
  const p = polOf(g);
  if (!e) {
    card(c, r.x, r.y, r.w, r.h, '過去の選挙結果');
    para(c, '開票の結果と、議席の移り変わりを見る。あなたが出た選挙は、得票と順位も残っている。', r.x + 10, r.y + 26, r.w - 20, 12, C.text);
    const hist = p.elections.history.slice(0, 8);
    hist.forEach((h, i) => T(c, fit(c, `${dateLabel(g, h.day).replace(/上旬|中旬|下旬/, '')} ${h.label}${h.myResult ? (h.myResult.won ? '（当選）' : '（落選）') : ''}`, r.w - 20, 12), r.x + 10, r.y + 66 + i * 16, 12, h.myResult ? (h.myResult.won ? C.good : C.bad) : C.dim));
    return;
  }
  const d = myDecl(e);
  card(c, r.x, r.y, r.w, r.h, e.label, { right: e.newsOnly || ELECTION_KINDS[e.kind].newsOnly ? 'ニュースのみ' : d ? '立候補中' : '', rightColor: d ? C.good : C.dim, rightW: 70 });
  let y = r.y + 24;
  const x = r.x + 10, w = r.w - 20;
  const left = e.day - today(g);
  T(c, `投票日 ${dateLabel(g, e.day)}`, x, y, 14, '#ffffff');
  T(c, daysLeft(left), r.x + r.w - 10, y, 14, left <= 7 ? C.gold : C.text, 'right');
  y += 20;
  const K = ELECTION_KINDS[e.kind] || {};
  T(c, fit(c, `${kojiWord(e.kind)} ${dateLabel(g, e.koji)}・選挙運動 ${K.campaignDays}日間（ゲームでは${e.day - e.koji}日）`, w, 12), x, y, 12, C.dim);
  y += 16;
  if (ELECTION_KINDS[e.kind].newsOnly) { para(c, 'ドット区の外の自治体の選挙。結果はニュースで伝えられる。', x, y + 4, w, 12, C.dim); return; }
  y = para(c, `${e.kind === 'sosaisen' ? '投票する人' : '選挙区'}：${districtText(g, e)}`, x, y, w, 12, C.text, 15, 2) + 3;
  const off = officeOfE(e);
  const O = OFFICES[off];
  if (e.kind === 'sosaisen') {
    const pt = p.parties[e.party];
    T(c, `いまの${postName('party_leader', fyOf(g), e.party)}：${whoName(g, pt && pt.leader)}`, x, y, 12, C.text); y += 18;
    para(c, '立候補には推薦人（国会議員）が必要。国会議員の票と党員の票で決まり、過半数がいなければ上位2人の決選投票になる。', x, y, w, 12, C.dim, 16, 4);
    y += 70;
    const me = p.me;
    checkRow(c, me.party === e.party, me.party === e.party ? '党員である' : 'この党の党員ではない', x, y, w); y += 16;
    checkRow(c, isNational(me), isNational(me) ? '国会議員である' : '国会議員でないと出られない', x, y, w); y += 16;
    checkRow(c, today(g) <= e.koji, `届出は${dateLabel(g, e.koji)}まで`, x, y, w);
    return;
  }
  if (O) {
    T(c, fit(c, `任期 ${O.termYears}年・${O.level === 'national' ? '歳費' : O.level === 'exec' ? '給料' : '議員報酬'} 月${fmtMoney(O.salary)}`, w, 12), x, y, 12, C.text); y += 16;
    T(c, `供託金 ${fmtMoney(g.depositInternal(off))}`, x, y, 12, C.text); y += 15;
    T(c, fit(c, forfeitText(g, e), w, 12), x, y, 12, C.dim); y += 19;
  }
  if (d) {
    R(c, x - 4, y - 2, w + 8, 1, C.edge);
    y += 4;
    T(c, fit(c, `あなた：${d.district || ''}・${partyFull(g, d.party)}・${declWord(d)}`, w, 12), x, y, 12, C.good); y += 16;
    const camp = p.me.campaign && p.me.campaign.election === e.id ? p.me.campaign : null;
    T(c, `選挙運動の手ごたえ ${camp ? Math.round(camp.points * 10) / 10 : 0}`, x, y, 12, C.text); y += 16;
    const fc = (uiData(g).fc[e.id] || []).slice(-1)[0];
    if (fc) T(c, `情勢調査（${dateLabel(g, fc.day).replace(/^\d+年/, '')}）：当選の見込み ${fc.chance}%`, x, y, 12, fc.chance >= 50 ? C.good : C.warn);
    else T(c, 'Aで選挙運動の画面へ', x, y, 12, C.dim);
    return;
  }
  T(c, '立候補できるか', x, y, 12, C.gold); y += 16;
  for (const ck of eligibilityChecks(g, e)) { checkRow(c, ck.ok, ck.text, x, y, w, ck.warn); y += 16; }
  // before the 届出 window: only a 出馬表明 (as the core's declareCandidacy)
  if (filingState(g, e) === 'early') para(c, intentFor(g, e) ? `出馬表明ずみ。届出の受付は${dateLabel(g, filingOpens(e))}ごろから。` : `届出の受付は投票日の${FILE_DAYS}日前から。いまはAで「出馬表明」ができる。`, x, y + 4, w, 12, intentFor(g, e) ? C.good : C.dim, 16, 2);
}
SECTIONS.elections = async (ui) => {
  const g = ui.g;
  let idx = Math.max(0, electionList(g).findIndex((e) => !ELECTION_KINDS[e.kind].newsOnly));
  for (let guard = 0; guard < 200; guard++) {
    const p = polOf(g);
    const list = electionList(g);
    const items = list.map((e) => {
      const d = myDecl(e);
      const news = !!ELECTION_KINDS[e.kind].newsOnly;
      // when the 届出 opens / closes (党首選 and the news-only elections: the 告示 day)
      const fs = filingState(g, e);
      const st = today(g) >= e.day ? '投票日' : today(g) >= e.koji ? '選挙期間中' : news || e.kind === 'sosaisen' ? `${kojiWord(e.kind)} ${shortDate(g, e.koji)}` : fs === 'early' ? `届出は${shortDate(g, filingOpens(e))}から` : `届出は${shortDate(g, e.koji)}まで`;
      const intent = !d && intentFor(g, e);
      return { label: e.kind === 'hosen' ? electionShort(g, e) : e.label, sub: `${st}・投票 ${dateLabel(g, e.day)}`, subColor: !d && !news && fs === 'open' && today(g) < e.koji ? C.gold : null, right: daysLeft(e.day - today(g)), disabled: news, why: 'ドット区の外の選挙（ニュースで結果を伝える）', tag: d ? { text: '立候補中', color: '#2a7a4a' } : intent ? { text: '出馬表明', color: '#6a5a1a' } : null, labelColor: d ? C.good : null };
    });
    items.push({ label: '過去の選挙結果', sub: `${p.elections.history.length}件の記録`, labelColor: C.cyan });
    const i = await ui.menu({ title: '選挙', listTitle: '選挙の予定', items, index: idx, listW: 286, rowH: 36, detail: (c, it, r, k) => drawElectionDetail(c, g, list[k], r), tip: (it, k) => (k < list.length ? systemTip(g, list[k]) : '比例代表はドント方式：得票を1,2,3…で割った商の大きい順に配分') });
    if (i < 0) return;
    idx = i;
    if (i === list.length) { await SECTIONS.results(ui); continue; }
    const e = list[i];
    if (myDecl(e)) await campaignScreen(ui, e.id); else await candidacyFlow(ui, e.id);
  }
};
SECTIONS.candidacy = (ui, o = {}) => candidacyFlow(ui, o.electionId);
SECTIONS.campaign = (ui, o = {}) => campaignScreen(ui, o.electionId || polOf(ui.g).me.candidacy);

// ---------------------------------------------------------------- 立候補の届出
async function candidacyFlow(ui, eid) {
  const g = ui.g;
  const p = polOf(g);
  const me = p.me;
  const e = findE(g, eid);
  if (!e) { await ui.alert('立候補', 'その選挙は予定されていない。'); return; }
  if (myDecl(e)) { await campaignScreen(ui, e.id); return; }
  // an announced (or finished) retirement: standing again withdraws it / is a comeback
  const R0 = uiData(g).retire;
  if (R0) {
    const k = await ui.confirm(R0.done
      ? { title: '政界復帰', text: '政界を引退している。\n復帰して、立候補する？', choices: ['復帰して立候補する', 'やめておく'] }
      : { title: '引退を表明している', text: '次の選挙には出ないと表明している。\n表明を撤回して立候補する？（評判は少し下がる）', choices: ['撤回して立候補する', 'やめておく'] });
    if (k !== 0) return;
    if (!R0.done) me.reputation = clamp(num(me.reputation) - 3, -100, 100);
    uiData(g).retire = null;
  }
  if (e.kind === 'sosaisen') {
    const pt = p.parties[e.party];
    const i = await ui.confirm({ title: `${e.label}に立候補`, text: `国会議員の推薦人を集めて、${pt ? pt.name : ''}の${postName('party_leader', fyOf(g), e.party)}選挙に名乗りを上げる？\n届出：${dateLabel(g, e.koji)}まで・投票：${dateLabel(g, e.day)}`, choices: ['立候補する', 'やめておく'], tip: '推薦人の数は、派閥・グループの大きさと党内の評価で決まる' });
    if (i !== 0) return;
    const why = g.declareCandidacy(e.id);
    if (why) { await ui.alert('立候補できない', why); return; }
    sfx('fanfare');
    await ui.alert('立候補', `${e.label}に立候補した！\n推薦人 ${num(myDecl(e) && myDecl(e).recommenders)}人。投票は${dateLabel(g, e.day)}。`);
    return;
  }
  const off = officeOfE(e);
  const year = e.year || yearOf(g);
  const heiritsu = e.kind === 'shugi' && shugiRules(year, p.flags).system === 'heiritsu';
  const chu = e.kind === 'shugi' && !heiritsu;
  const hasPR = heiritsu || e.kind === 'sangi';
  // the deposit is checked once the way of running is known (the party pays for 比例 candidates)
  const fails = eligibilityChecks(g, e).filter((x) => !x.ok && !(x.deposit && me.party && hasPR));
  if (fails.length) { sfx('buzz'); await ui.alert('立候補できない', fails.map((x) => `・${x.text}`)); return; }
  const ninety = ninetyApplies(g, e);
  // before the 届出 window (from FILE_DAYS days before the vote): the flow ends in a 出馬表明, not a filing
  const early = filingState(g, e) === 'early';
  const windowText = `届出の受付：${dateLabel(g, filingOpens(e))}ごろ〜${kojiWord(e.kind)}日（${dateLabel(g, e.koji)}）`;
  if (early && intentFor(g, e)) {
    const k = await ui.confirm({ title: '出馬表明ずみ', w: 460, text: `${e.label}への出馬を表明している。\n${windowText}\n受付が始まったら、ここか区役所・党本部で届け出る。`, choices: ['所属・立候補のしかたを見直す', '表明を取り下げる', 'もどる'], cancel: 2, tip: '出馬表明は立候補の意思を示すだけ。取り下げても何も失わない' });
    if (k === 1) { me.intent = null; ui.toast('出馬表明を取り下げた', C.dim); }
    if (k !== 0) return;
  }
  // 1) 所属
  const recWord = ['chiji', 'shicho'].includes(e.kind) ? '推薦' : '公認';
  const pt = me.party ? p.parties[me.party] : null;
  const recText = recWord === '推薦'
    ? '推薦：政党が候補者を応援すること。首長選では、政党の「推薦」や「支持」を受けて戦う形が多い。党の支持者の票が集まりやすい。'
    : heiritsu ? '公認：党が候補者として認めること。党の支持者の票が集まりやすく、小選挙区と比例代表に重複して立候補できる。党の方針に従う必要がある。'
      : e.kind === 'sangi' ? '公認：党が候補者として認めること。党の支持者の票が集まりやすい。選挙区か比例代表のどちらかで戦う（参議院では重複立候補はできない）。'
        : chu ? '公認：党が候補者として認めること。党の支持者の票が集まりやすい。中選挙区では、同じ党の候補どうしも票を争う。'
          : '公認：党が候補者として認めること。党の支持者の票が集まりやすい。党の方針に従う必要がある。';
  const a = await ui.menu({
    title: '立候補の届出（1/3）所属', listTitle: '所属をえらぶ', listW: 250, rowH: 36,
    items: [
      { label: '無所属で立候補', sub: '政党の組織票はないが、しがらみもない' },
      { label: pt ? `${pt.short}の${recWord}を申請` : `政党の${recWord}を申請`, sub: pt ? `党の選考がある（党内の評価・知名度）` : 'まず政党に入る必要がある', disabled: !pt, why: '政党に入っていない（「政党」から入党できる）' },
    ],
    detail: (c, it, r, k) => {
      card(c, r.x, r.y, r.w, r.h, e.label);
      const x = r.x + 10, w = r.w - 20;
      let y = r.y + 26;
      y = para(c, k === 0 ? '無所属：選挙運動は自分の陣営だけで行う。党の支持層の票は期待できないが、知名度や地元の支持があれば勝負になる。' : recText, x, y, w, 12, C.text, 17, 6) + 8;
      y = para(c, `選挙区：${districtText(g, e)}`, x, y, w, 12, C.dim, 16, 2);
      T(c, fit(c, `供託金：${fmtMoney(g.depositInternal(off))}${hasPR ? '（比例代表は党が払う）' : ''}`, w, 12), x, y, 12, C.dim); y += 16;
      T(c, fit(c, forfeitText(g, e), w, 12), x, y, 12, C.dim); y += 20;
      if (ninety) para(c, ninetyText(g, e), x, y, w, 12, C.warn, 16, 4);
    },
    tip: () => '供託金は、得票が少ないと没収される（売名目的の立候補を防ぐため）',
  });
  if (a < 0) return;
  const home = g.state.profile && g.state.profile.hometown;
  const homeOK = !!(home && home !== 'tokyo' && PREFECTURES[home]);
  const canHome = (prop) => homeOK && ((e.kind === 'shugi' && prop !== 'only') || (e.kind === 'sangi' && !prop));
  // ふるさと: -1 = cancelled
  const askHome = async () => {
    const pref = PREFECTURES[home].name;
    const k = await ui.confirm({ title: '地元はどこにする？', text: `出身地の${pref}から出ることもできる。ふるさとの人たちは、知っている名前に票を入れてくれやすい。`, choices: ['東京（ドット区）から出る', `${pref}から出る`], cancel: -1, tip: '国政選挙は、住んでいる所と違う選挙区からも立候補できる' });
    return k < 0 ? -1 : k === 1;
  };
  let party = null;
  let proportional = false;
  let hometown = false;
  if (a === 1) {
    // 2) 立候補のしかた (national elections with 比例), then the party's decision for that way of running
    for (let guard = 0; guard < 12; guard++) {
      if (hasPR) {
        const items = heiritsu
          ? [{ label: '小選挙区だけ', sub: '1位にならなければ落選' }, { label: '小選挙区と比例代表に重複', sub: '負けても惜敗率しだいで比例で復活' }, { label: '比例代表だけ（比例単独）', sub: '党の名簿の順位で決まる' }]
          : [{ label: '東京都選挙区', sub: `改選${tokyoSangiMagnitude(year)}人の選挙区で戦う` }, { label: '比例代表（全国）', sub: sangiRules(year).list === 'hikousoku' ? '個人名の票で、党の中の順位が決まる' : '党の名簿の順位で決まる' }];
        const k = await ui.menu({ title: '立候補の届出（2/3）立候補のしかた', listTitle: 'どこで戦う？', listW: 280, rowH: 36, items,
          detail: (c, it, r, kk) => {
            card(c, r.x, r.y, r.w, r.h, '立候補のしかた');
            const txt = heiritsu
              ? ['小選挙区で1位になれば当選。供託金は自分で払う。', `小選挙区で負けても、同じ順位の重複候補の中で惜敗率（当選者の得票に対する割合）が高ければ比例で復活当選できる。${year >= 2000 ? 'ただし小選挙区で有効投票の10分の1に届かないと復活できない（2000年から）。' : ''}`, '小選挙区には出ず、比例名簿に載る。順位は党が決め、党内の評価と知名度が大切。比例単独の枠は少ない。供託金は党が払う。'][kk]
              : ['東京都選挙区で、得票の多い順に定数まで当選。', sangiRules(year).list === 'hikousoku' ? '全国の有権者が「党名」か「個人名」を書く。党の議席数の中で、個人名の票が多い順に当選（非拘束名簿式）。知名度のある人は党に選ばれやすい。供託金は党が払う。' : '党が決めた名簿の順に当選（拘束名簿式）。供託金は党が払う。'][kk];
            para(c, txt, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 17, 10);
          },
          tip: () => (heiritsu ? '比例代表の議席は、11のブロックごとにドント方式で配分' : '参議院は3年ごとに半数を改選する'),
        });
        if (k < 0) return;
        proportional = heiritsu ? [false, true, 'only'][k] : k === 1;
      }
      hometown = false;
      if (canHome(proportional)) { const h = await askHome(); if (h === -1) return; hometown = h; }
      const r = g.requestNomination(e.id, { proportional, hometown });
      if (r.ok) {
        sfx('success');
        await ui.alert(`${r.kind}が決まった`, `${pt.name}の${r.kind}候補として、${e.label}を戦うことになった。`, { draw: (c, rc) => stampArt(c, rc, r.kind), artH: 60 });
        party = me.party;
        break;
      }
      sfx('buzz');
      const ch = [...(hasPR ? ['ほかのしかたで申請する'] : []), '無所属で立候補する', 'やめておく'];
      const k = await ui.confirm({ title: `${recWord}は見送られた`, text: r.why || '党の選考で見送られた。', choices: ch, cancel: ch.length - 1, tip: hasPR ? '参議院の比例代表は、知名度のある人が党に選ばれやすい' : '党内の評価や地元の支持を上げると、選ばれやすくなる' });
      const pick = ch[k];
      if (pick === 'ほかのしかたで申請する') continue;
      if (pick !== '無所属で立候補する') return;
      proportional = false;
      hometown = false;
      break;
    }
    if (!party && hasPR && proportional) return;
  }
  // ふるさと（無所属）
  if (!party && canHome(false)) { const h = await askHome(); if (h === -1) return; hometown = h; }
  // 3) 届出書 (or, before the window, the 出馬表明)
  const noDeposit = (e.kind === 'sangi' && proportional) || proportional === 'only';
  const depShown = noDeposit ? 0 : g.depositInternal(off);
  if (!early && depShown > num(g.state.money) + num(me.funds)) { sfx('buzz'); await ui.alert('立候補できない', `供託金 ${fmtMoney(depShown)} が用意できない（政治資金と所持金の合計）。`); return; }
  const lines = [
    `選挙：${e.label}`,
    `所属：${party ? `${partyFull(g, party)}（${recWord}）` : '無所属'}`,
    ['shugi', 'sangi'].includes(e.kind) ? `しかた：${proportional === 'only' ? '比例代表のみ' : proportional ? (e.kind === 'sangi' ? '比例代表' : '小選挙区＋比例代表') : hometown ? `${PREFECTURES[home].name}の選挙区` : chu ? '中選挙区（東京ドット区）' : heiritsu ? '小選挙区（東京ドット区）' : '東京都選挙区'}` : `選挙区：${districtText(g, e)}`,
    `供託金：${depShown ? fmtMoney(depShown) : 'なし（党が払う）'}${proportional === true && e.kind === 'shugi' ? '（比例の分は党が払う）' : ''}${early && depShown ? '（届出のときに納める）' : ''}`,
    `投票日：${dateLabel(g, e.day)}（${kojiWord(e.kind)} ${dateLabel(g, e.koji)}）`,
  ];
  if (early) lines.push(windowText, 'いまは届出の前。出馬を表明して、受付が始まったら届け出る。');
  if (ninety) lines.push(ninetyText(g, e));
  const ok = await ui.confirm(early
    ? { title: '出馬表明（3/3）', text: lines.join('\n'), choices: ['出馬を表明する', 'やめておく'], w: 460, tip: `届出は投票日の${FILE_DAYS}日前から公示・告示の日まで（ゲームの目安）` }
    : { title: '立候補の届出（3/3）届出書', text: lines.join('\n'), choices: ['届け出る', 'やめておく'], w: 460, danger: ninety, tip: `本来の届出は公示・告示の日。ゲームでは投票日の${FILE_DAYS}日前から受け付ける` });
  if (ok !== 0) return;
  const why = g.declareCandidacy(e.id, { party: party || null, proportional, hometown });
  // before the window the core records the 出馬表明 and answers with its own text (shown as it is)
  if (why && !myDecl(e) && intentFor(g, e)) {
    sfx('ok');
    await ui.alert('出馬を表明した', [why, '後援会や支援者に知らせた。寄付も集まりはじめる。'], { draw: (c, rc) => stampArt(c, rc, '表明'), artH: 60 });
    return;
  }
  if (why) { sfx('buzz'); await ui.alert(early ? '表明できなかった' : '届出できなかった', why); return; }
  sfx('fanfare');
  try { recordForecast(g, e.id); } catch (err) { /* the poll can wait */ }
  await ui.alert('立候補した！', [`${e.label}に立候補を届け出た。`, today(g) < e.koji ? `${kojiWord(e.kind)}日（${dateLabel(g, e.koji)}）までは「政治活動」だけ。効果は半分。` : '選挙運動の始まりだ！'], { draw: (c, rc) => stampArt(c, rc, '出馬'), artH: 60 });
  await campaignScreen(ui, e.id);
}
// a red seal (公認 / 当選 …)
function stampArt(c, r, s, col = C.stamp) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const rad = Math.min(28, r.h / 2 - 2);
  disc(c, cx, cy, rad, col);
  disc(c, cx, cy, rad - 3, '#fff6ea');
  disc(c, cx, cy, rad - 5, col);
  disc(c, cx, cy, rad - 6, '#fff6ea');
  const ch = Array.from(s);
  if (ch.length <= 2) T(c, s, cx, cy - 9, 16, col, 'center');
  else T(c, s, cx, cy - 7, 12, col, 'center');
}

// ---------------------------------------------------------------- 選挙運動（その日の予定）
const ACT_ORDER = () => [...Object.keys(CAMPAIGN_ACTIONS), ...Object.keys(ILLEGAL_CAMPAIGN)];
function estimatePts(g, A, used, pre) {
  const st = g.state;
  const me = polOf(g).me;
  let pts = A.pts * (1 + used * -0.25);
  if (A.skill) pts *= 0.7 + (num(st.skills && st.skills[A.skill]) / 100) * 0.8;
  if (A.fame) pts *= 1 + Math.min(1.2, Math.log10(1 + num(st.fame)) / 4);
  if (A.fans) pts *= 1 + Math.min(1.5, Math.log10(1 + num(st.fans)) / 4);
  if (A.score) pts *= 0.4 + 0.6 * 1.4;
  if (pre) pts *= 0.5;
  pts *= 1 + Math.min(5, me.staff) * 0.05;
  return Math.max(0, Math.round(pts * 10) / 10);
}
const DEBATE = [
  ['司会「まず、子育ての支援策をひとつ具体的に」', '保育所の空きを毎月公開します', '子育ては大切だと思います', '相手の案は全部ダメです'],
  ['司会「その財源はどうしますか？」', '事業を見直して確保します', 'これから考えます', 'なんとかなります！'],
  ['司会「お年寄りの移動の不安には？」', '乗り合いバスを走らせます', '地域で話し合いたいです', '車があれば平気でしょう'],
  ['対立候補「芸能人に政治ができるのか」', '現場の声を政策で届けます', 'えっと、勉強中です…', 'あなたこそ顔がこわい'],
  ['司会「商店街の空き店舗をどうしますか」', '若い人の出店を応援します', 'にぎやかにしたいですね', '時代の流れです'],
  ['司会「災害への備えは？」', '避難所の備蓄を毎年点検します', '大切な課題です', 'そのときに考えます'],
  ['司会「最後に、有権者にひとこと」', 'どの候補でも、まず投票へ！', 'よろしくお願いします', '私に入れないと損ですよ', 'last'],
];
function debateOpts() {
  const pool = DEBATE.filter((d) => d[4] !== 'last').sort(() => Math.random() - 0.5).slice(0, 3);
  const scenes = [...pool, DEBATE[DEBATE.length - 1]].map(([prompt, a, b, c2]) => ({ prompt, answers: [{ text: a, score: 100 }, { text: b, score: 50 }, { text: c2, score: 5 }] }));
  return { topic: '公開討論会（ニュース）', set: 'news', show: '公開討論会', mc: '司会', scenes, count: scenes.length, title: '公開討論会' };
}
function campaignView(g, eid) {
  const v = {
    title: () => { const e = findE(g, eid); return e ? `選挙運動：${electionShort(g, e)}` : '選挙運動'; },
    focus: 'acts', plan: [], pidx: 0,
    lb: null,
    hint: () => (v.focus === 'plan' ? '↑↓ A:予定から外す ←:もどす B:もどる' : '↑↓ A:予定に入れる →:予定 B:もどる'),
    tip: () => {
      const it = v.lb.current();
      if (v.focus === 'plan') return '体力と資金が足りる範囲で、1日の予定を組もう';
      if (!it) return '';
      if (it.illegal) return `${it.key}は公職選挙法違反（犯罪）。発覚すれば逮捕・公民権停止も`;
      if (it.cmd === 'vote') return kijitsuOK(g) ? '期日前投票：選挙期間中なら投票日の前でも投票できる（2003年12月〜）' : '投票日に行けない人は「不在者投票」の制度がある';
      if (it.cmd === 'poll') return '情勢調査は、世論調査や取材から当落の見込みを探るもの';
      if (it.cmd === 'run') return '予定は上から順に行う。討論会はトークのミニゲームになる';
      if (it.cmd === 'sleep') return '休むと次の日になる。体力は戻るが、投票日までの日数は減る';
      if (it.cmd === 'withdraw') return '公示・告示の後に立候補をやめると、供託金は戻らない';
      const A = CAMPAIGN_ACTIONS[it.key];
      if (it.key === 'SNS' || it.key === 'ネット広告') return 'ネット選挙運動は2013年に解禁。候補者個人の有料ネット広告は禁止';
      if (it.key === 'ポスター') return '選挙ポスターは、自治体が立てる公営の掲示板に貼る';
      if (it.key === '選挙カー') return '選挙カーからの連呼は、走りながらでも認められている';
      return A ? A.desc : '';
    },
    rows() {
      const e = findE(g, eid);
      const p = polOf(g);
      const st = g.state;
      if (!e) return [];
      const d = myDecl(e);
      const day = today(g);
      const pre = day < e.koji;
      const onDay = day >= e.day;
      const camp = p.me.campaign && p.me.campaign.election === e.id ? p.me.campaign : { actions: {}, points: 0 };
      const planned = (k) => v.plan.filter((x) => x === k).length;
      const pStam = v.plan.reduce((a, k) => a + num((CAMPAIGN_ACTIONS[k] || {}).stamina), 0);
      const pCost = v.plan.reduce((a, k) => a + num((CAMPAIGN_ACTIONS[k] || {}).money), 0);
      const year = yearOf(g);
      // the order a candidate needs: the plan's 「実行」 first (always visible), the legal campaign,
      // the day's other commands, and the crimes last, below everything else
      const rows = [{ cmd: 'run', label: `▶ 予定を実行する${v.plan.length ? `（${v.plan.length}件）` : ''}`, labelColor: C.gold, disabled: !v.plan.length || onDay, why: onDay ? '投票日は選挙運動ができない' : '予定が空っぽ（下の一覧からAで入れる）' }];
      const crimes = [];
      for (const key of ACT_ORDER()) {
        const illegal = !!ILLEGAL_CAMPAIGN[key];
        const A = CAMPAIGN_ACTIONS[key];
        let why = null;
        if (onDay) why = '投票日は選挙運動ができない';
        else if (!illegal) {
          const used = num(camp.actions[`${key}@${day}`]) + planned(key);
          if (pre && !A.pre) why = `${kojiWord(e.kind)}日の後から`;
          else if (A.from && year < A.from) why = `${A.from}年に解禁`;
          else if (A.partyOnly && (!d || !d.party || d.party === IND)) why = '政党の公認候補だけ';
          else if (A.perElection && num(camp.actions[key]) + planned(key) >= A.perElection) why = 'もう十分に貼った';
          else if (used >= (A.perDay || 1)) why = '今日はもう十分';
          else if (pStam + A.stamina > st.stamina) why = '体力が足りない';
          else if (pCost + num(A.money) > num(st.money) + num(p.me.funds)) why = 'お金が足りない';
        } else if (planned(key)) why = 'もう予定に入っている';
        const used = illegal ? 0 : num(camp.actions[`${key}@${day}`]) + planned(key);
        (illegal ? crimes : rows).push({
          key, illegal, label: key,
          right: illegal ? '犯罪' : `体力${A.stamina}${A.money ? `・${fmtMoney(A.money)}` : ''}`,
          rightColor: illegal ? C.bad : null,
          tag: illegal ? null : why ? null : { text: `+${estimatePts(g, A, used, pre)}`, color: '#2a6a4a' },
          disabled: !!why, why, labelColor: illegal ? '#ff9aa4' : null,
        });
      }
      rows.push({ cmd: 'poll', label: '情勢調査を見る', labelColor: C.cyan, disabled: !!(d && (d.pr || d.prOnly)), why: '比例代表は党の得票と名簿の順位しだい' });
      // 期日前投票（2003年12月から。それまでは理由のいる「不在者投票」）: the day after 公示・告示 to the eve of 投票日
      const canVote = ((day > e.koji && day < e.day) || day === e.day) && !e.voted && e.kind !== 'sosaisen';
      rows.push({ cmd: 'vote', label: e.voted ? '投票ずみ' : day === e.day ? '投票に行く' : kijitsuOK(g) ? '期日前投票に行く' : '不在者投票に行く', labelColor: C.cyan, disabled: !canVote, why: e.voted ? 'もう投票した' : `投票できるのは${kojiWord(e.kind)}日の翌日から投票日まで` });
      rows.push({ cmd: 'sleep', label: onDay ? '開票を待つ（休む）' : '今日はここまで（休む）', labelColor: C.dim });
      rows.push({ cmd: 'withdraw', label: '立候補をとりやめる', labelColor: C.faint });
      return rows.concat(crimes);
    },
    // the cursor starts on the first campaign action (row 0 is 「予定を実行する」)
    enter() { v.lb = new ListBox({ items: () => v.rows(), rowH: 23, index: 1 }); },
    update(ui, inp) {
      const e = findE(g, eid);
      if (!e) { ui.done(v, null); return; }
      if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); return; }
      if (v.focus === 'plan') {
        if (inp.pressed('left') || !v.plan.length) { v.focus = 'acts'; sfx('cursor'); return; }
        if (inp.repeat('up')) { v.pidx = (v.pidx + v.plan.length - 1) % v.plan.length; sfx('cursor'); }
        if (inp.repeat('down')) { v.pidx = (v.pidx + 1) % v.plan.length; sfx('cursor'); }
        if (inp.pressed('a')) { v.plan.splice(clamp(v.pidx, 0, v.plan.length - 1), 1); v.pidx = clamp(v.pidx, 0, Math.max(0, v.plan.length - 1)); sfx('cancel'); }
        return;
      }
      v.lb.move(inp);
      if (inp.pressed('right') && v.plan.length) { v.focus = 'plan'; v.pidx = 0; sfx('cursor'); return; }
      if (!inp.pressed('a')) return;
      const it = v.lb.current();
      if (!it) return;
      if (it.disabled) { sfx('buzz'); if (it.why) ui.toast(it.why, C.dim); return; }
      sfx('ok');
      if (it.key) {
        if (v.plan.length >= 6) { ui.toast('1日の予定は6つまで', C.dim); return; }
        if (it.illegal) { ui.act(async () => { if (await illegalWarning(ui, g, it.key)) { v.plan.push(it.key); } }); return; }
        v.plan.push(it.key);
        return;
      }
      ui.act(() => campaignCommand(ui, g, v, e, it.cmd));
    },
    draw(c, ui) { drawCampaign(c, g, ui, v, findE(g, eid)); },
  };
  return v;
}
async function illegalWarning(ui, g, key) {
  const id = ILLEGAL_CAMPAIGN[key];
  let law = '';
  try { law = crimeLaw(g, id) || ''; } catch (e) { law = ''; }
  const i = await ui.confirm({
    title: `⚠ ${key}は犯罪です`, danger: true, w: 460,
    text: `${law || '公職選挙法で禁じられている。'}\n発覚すれば逮捕され、当選しても無効になることがある。`,
    choices: ['やめておく', 'それでも予定に入れる'], index: 0, cancel: 0,
    tip: '選挙のルールは、お金や力で票が左右されないためにある',
  });
  return i === 1;
}
async function campaignCommand(ui, g, v, e, cmd) {
  const p = polOf(g);
  if (cmd === 'run') {
    const plan = v.plan.splice(0);
    let total = 0;
    const done = [];
    for (const key of plan) {
      if (!findE(g, e.id)) break;
      let score = null;
      if (key === '討論会') {
        const ok = await ui.confirm({ title: '公開討論会', text: '候補者がそろって政策を語る公開討論会。司会や相手候補の問いに、具体的に答えよう。', choices: ['討論会にのぞむ'], tip: '公開討論会は、有権者が候補者を比べる大切な場' });
        void ok;
        const r = await g.minigame('talk', debateOpts());
        score = r ? r.score : 55;
      }
      const r = await g.campaign(key, { electionId: e.id, score: score ?? 55 });
      if (!r) continue;
      if (!r.ok) { ui.toast(`${key}：${r.why}`, C.bad); continue; }
      total += num(r.pts);
      done.push(r);
      await ui.open(vignetteView(g, key, r));
      if (r.illegal && r.crime && r.crime.caught) {
        await ui.alert('発覚', `${key}が発覚した…。選挙運動どころではない。`);
        if (!activeUI(g) || !findE(g, e.id)) return;
        break;
      }
    }
    if (v.lb) v.lb.idx = 1; // back to the first action for the next plan
    if (done.length) {
      const camp = p.me.campaign;
      sfx('good');
      ui.toast(`今日の手ごたえ +${Math.round(total * 10) / 10}（合計 ${camp ? Math.round(camp.points * 10) / 10 : '?'}）`, C.good);
    }
    return;
  }
  if (cmd === 'poll') {
    const rec = recordForecast(g, e.id);
    if (!rec) { ui.toast('情勢はまだ読めない', C.dim); return; }
    sfx('chime');
    ui.toast(`当選の見込み ${rec.chance}%・予想 ${fmtNum(rec.votes)}票（${rec.rank}位前後）`, rec.chance >= 50 ? C.good : C.warn);
    return;
  }
  if (cmd === 'vote') {
    const why = g.castVote(e.id, 'self');
    if (why) { ui.toast(why, C.dim); return; }
    sfx('success');
    await ui.alert(today(g) === e.day ? '投票' : kijitsuOK(g) ? '期日前投票' : '不在者投票', ['投票所で、自分の名前を書いて投票した。', '一票の重さをかみしめる…。']);
    return;
  }
  if (cmd === 'sleep') {
    const k = await ui.confirm({ title: '今日はここまで', text: today(g) >= e.day ? '投票は締め切られた。開票は今夜。\n休んで結果を待つ？' : '選挙運動を切り上げて休み、次の日にする？', choices: ['休む（次の日へ）', 'まだ続ける'] });
    if (k !== 0) return;
    await g.sleep();
    if (!findE(g, e.id)) ui.done(v, null);
    return;
  }
  if (cmd === 'withdraw') {
    const after = today(g) >= e.koji;
    const k = await ui.confirm({ title: '立候補をとりやめる', danger: true, text: `${e.label}への立候補をとりやめる？${after ? `\n${kojiWord(e.kind)}の後なので、供託金は戻ってこない。` : '\n届出の前なので、供託金は返ってくる。'}`, choices: ['とりやめない', 'とりやめる'], index: 0, cancel: 0 });
    if (k !== 1) return;
    const why = g.withdrawCandidacy(e.id);
    await ui.alert('立候補', why || '立候補をとりやめた。');
    ui.done(v, null);
  }
}
function drawCampaign(c, g, ui, v, e) {
  if (!e) return;
  const p = polOf(g);
  const d = myDecl(e) || {};
  const day = today(g);
  // ---- info strip
  card(c, 6, 30, SW - 12, 36);
  T(c, fit(c, `${d.district || districtText(g, e)}`, 210, 14), 14, 34, 14, '#ffffff');
  let px = 14;
  px += partyChip(c, g, d.party, px, 50) + 6;
  T(c, fit(c, declWord(d), 120, 12), px, 51, 12, C.dim);
  // day strip
  const days = [];
  for (let k = day; k <= e.day && days.length < 12; k++) days.push(k);
  const bw = 30;
  const sx = SW - 12 - days.length * (bw + 2);
  days.forEach((k, i) => {
    const x = sx + i * (bw + 2);
    const isKoji = k === e.koji, isVote = k === e.day, isToday = k === day;
    const col = isVote ? '#7a2a34' : k >= e.koji ? '#6a4a1a' : '#2a3262';
    frame(c, x, 34, bw, 28, isToday ? shade(col, 0.25) : col, isToday ? C.gold : shade(col, 0.3));
    T(c, isToday ? '今日' : WEEKDAYS[weekdayOf(k)], x + bw / 2, 35, 12, isToday ? '#ffffff' : C.dim, 'center');
    // 「+3」= 3日後 (「N日後」 is wider than the cell; today shows 「今日」 above and nothing here)
    const lab = isVote ? '投票' : isKoji ? kojiWord(e.kind) : isToday ? '' : `+${k - day}`;
    T(c, fit(c, lab, bw - 2, 12), x + bw / 2, 48, 12, isVote ? '#ffb0b8' : isKoji ? C.gold : C.faint, 'center');
  });
  if (e.day - day >= 12) T(c, '…', sx - 10, 42, 12, C.dim, 'center');
  // ---- actions list
  const lx = 6, ly = 70, lw = 300, lh = SH - 21 - 4 - ly;
  card(c, lx, ly, lw, lh, day < e.koji ? `政治活動（${kojiWord(e.kind)}前・効果は半分）` : day >= e.day ? '投票日' : '選挙運動', { right: `体力 ${g.state.stamina}`, rightW: 70 });
  v.lb.draw(c, lx + 2, ly + 21, lw - 4, lh - 25, v.focus === 'acts', ui.t);
  // ---- today's plan
  const rx = 312, rw = SW - 6 - rx;
  const ph = 132;
  card(c, rx, ly, rw, ph, '今日の予定', { right: `${v.plan.length}/6`, rightW: 40, edge: v.focus === 'plan' ? C.gold : C.edge });
  if (!v.plan.length) para(c, '左の一覧からAで予定に入れて、いちばん上の「▶ 予定を実行する」でまとめて行う。体力とお金が足りる分だけできる。', rx + 10, ly + 26, rw - 20, 12, C.dim, 16, 4);
  const camp = p.me.campaign && p.me.campaign.election === e.id ? p.me.campaign : { actions: {}, points: 0 };
  let stam = 0, cost = 0, est = 0;
  const cnt = {};
  v.plan.forEach((k, i) => {
    const A = CAMPAIGN_ACTIONS[k];
    const y = ly + 22 + i * 13;
    const sel = v.focus === 'plan' && i === v.pidx;
    if (sel) R(c, rx + 3, y, rw - 6, 13, C.sel);
    if (A) {
      const used = num(camp.actions[`${k}@${day}`]) + (cnt[k] || 0);
      cnt[k] = (cnt[k] || 0) + 1;
      const pts = estimatePts(g, A, used, day < e.koji);
      stam += A.stamina; cost += num(A.money); est += pts;
      T(c, `${i + 1}. ${k}`, rx + 10, y, 12, sel ? '#ffffff' : C.text);
      T(c, `+${pts}`, rx + rw - 10, y, 12, C.good, 'right');
    } else {
      T(c, `${i + 1}. ${k}（違法）`, rx + 10, y, 12, '#ff9aa4');
      T(c, '？', rx + rw - 10, y, 12, C.bad, 'right');
    }
  });
  const by = ly + ph - 30; // below the 6th plan row (ly + 22 + 5 * 13 + 13)
  R(c, rx + 6, by - 2, rw - 12, 1, C.edge);
  T(c, '体力', rx + 10, by, 12, C.dim);
  hbar(c, rx + 42, by + 3, 110, 8, (g.state.stamina - stam) / Math.max(1, g.state.maxStamina), C.good);
  T(c, `${g.state.stamina}→${g.state.stamina - stam}`, rx + 158, by, 12, C.text);
  T(c, `費用 ${fmtMoney(cost)}`, rx + 10, by + 14, 12, C.text);
  T(c, `見込み +${Math.round(est * 10) / 10}`, rx + rw - 10, by + 14, 12, C.good, 'right');
  // ---- the polls
  const gy = ly + ph + 4, gh = lh - ph - 4;
  card(c, rx, gy, rw, gh, '情勢（当選の見込み）', { right: `手ごたえ ${Math.round(num(camp.points) * 10) / 10}`, rightW: 110 });
  const fc = uiData(g).fc[e.id] || [];
  if (d.pr || d.prOnly) para(c, '比例代表：党の得票で議席数が決まり、名簿の順位（または個人名の票）で当落が決まる。党の支持率を上げよう。', rx + 10, gy + 26, rw - 20, 12, C.dim, 16, 5);
  else if (e.kind === 'sosaisen') para(c, '党首選：国会議員の票は派閥と党内の評価、党員票は知名度と評判で動く。', rx + 10, gy + 26, rw - 20, 12, C.dim, 16, 5);
  else {
    spark(c, fc.map((f) => f.chance), rx + 10, gy + 24, rw - 120, gh - 32, C.gold, { min: 0, max: 100, ref: 50, fill: true });
    T(c, '50%', rx + rw - 108, gy + 24 + (gh - 32) / 2 - 7, 12, C.faint);
    const last = fc[fc.length - 1];
    if (last) {
      T(c, `${last.chance}%`, rx + rw - 10, gy + 26, 16, last.chance >= 60 ? C.good : last.chance >= 40 ? C.gold : C.bad, 'right');
      T(c, `${fmtNum(last.votes)}票`, rx + rw - 10, gy + 48, 12, C.text, 'right');
      T(c, `${last.rank}位前後`, rx + rw - 10, gy + 64, 12, C.dim, 'right');
      T(c, `定数${last.seats}`, rx + rw - 10, gy + 80, 12, C.faint, 'right');
      T(c, dateLabel(g, last.day).replace(/^\d+年/, ''), rx + rw - 10, gy + gh - 18, 12, C.faint, 'right');
    } else T(c, '調査なし', rx + rw - 10, gy + 30, 12, C.dim, 'right');
  }
}

// ---------------------------------------------------------------- the campaign vignette
const CROWD = ['salaryman', 'oldman', 'oldwoman', 'mom', 'kid', 'tourist', 'fan', 'clerk', 'staff'];
function vignetteView(g, key, r) {
  const illegal = !!ILLEGAL_CAMPAIGN[key];
  const n = clamp(Math.round(num(r.pts) / 1.5), 1, 9);
  const crowd = Array.from({ length: n }, (_, i) => ({ look: LOOKS[CROWD[(i * 7 + key.length) % CROWD.length]] || LOOKS.salaryman, x: 0, delay: 6 + i * 5 }));
  const v = {
    modal: true, hint: 'A:つぎへ',
    tip: () => (illegal ? '違法な選挙運動は、のちに発覚することもある' : `${key}：手ごたえ +${r.pts}`),
    update(ui, inp) { if ((v.t > 20 && (inp.pressed('a') || inp.pressed('b'))) || v.t > 150 || g.auto) { sfx('cursor'); ui.done(v, true); } },
    draw(c, ui) {
      const x = 60, y = 40, w = SW - 120, h = 210;
      const t = v.t;
      R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.5)');
      frame(c, x, y, w, h, null, illegal ? C.bad : C.gold);
      c.save();
      c.beginPath(); c.rect(x + 1, y + 1, w - 2, h - 2); c.clip();
      vignetteArt(c, g, key, x + 1, y + 1, w - 2, h - 2, t, crowd, illegal);
      c.restore();
      // caption
      const cy = y + h + 6;
      frame(c, x, cy, w, 52, '#151e48', illegal ? C.bad : C.edge);
      T(c, key, x + 12, cy + 5, 16, illegal ? '#ff9aa4' : C.gold);
      T(c, fit(c, String(r.text || '').split('\n')[0], w - 140, 12), x + 12, cy + 28, 12, C.text);
      if (!illegal) {
        const k = Math.min(1, t / 40);
        T(c, `+${(Math.round(num(r.pts) * k * 10) / 10).toFixed(1)}`, x + w - 12, cy + 4, 16, C.good, 'right');
        T(c, `合計 ${Math.round(num(r.total) * 10) / 10}${r.cost ? `・${fmtMoney(r.cost)}` : ''}`, x + w - 12, cy + 28, 12, C.dim, 'right');
      } else T(c, '違法行為', x + w - 12, cy + 6, 14, C.bad, 'right');
    },
  };
  return v;
}
function drawSprite(c, look, x, y, s = 1, dir = 'down', frame = 0) {
  const sh = charSheetHD(look || {});
  const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
  c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
}
function vignetteArt(c, g, key, x, y, w, h, t, crowd, illegal) {
  const dark = illegal;
  // sky and town
  const sky = dark ? ['#0a0a18', '#121226', '#1a1a32'] : key === '後援会' || key === '討論会' || key === '献金集め' ? null : ['#7ab8f0', '#9ccaf4', '#c4e0f8'];
  if (sky) { sky.forEach((col, i) => R(c, x, y + (i * h * 0.6) / 3, w, (h * 0.6) / 3 + 1, col)); for (let i = 0; i < 9; i++) { const bw = 40 + ((i * 37) % 30), bh = 50 + ((i * 53) % 60); R(c, x + i * 60 - 10, y + h * 0.6 - bh, bw, bh, dark ? '#1c1c34' : i % 2 ? '#c8cede' : '#b4bccf'); for (let k = 0; k < 4; k++) R(c, x + i * 60 - 4 + (k % 2) * 16, y + h * 0.6 - bh + 8 + Math.floor(k / 2) * 16, 8, 8, dark ? (k % 3 ? '#2a2a44' : '#ffd27a') : '#e8eef8'); } R(c, x, y + h * 0.6, w, h * 0.4, dark ? '#24242c' : '#c8c0b0'); R(c, x, y + h * 0.6, w, 2, dark ? '#34343c' : '#e0d8c8'); }
  else { R(c, x, y, w, h * 0.62, '#5a3a2a'); for (let i = 0; i < w; i += 24) R(c, x + i, y, 2, h * 0.62, '#4a2e22'); R(c, x, y + h * 0.62, w, h * 0.38, '#7a5a3a'); }
  const ground = y + h * 0.6 + 40;
  const px = x + w * 0.42;
  const bob = Math.floor(t / 12) % 2;
  const me = g.state.look;
  const name = playerName(g);
  if (key === '街頭演説') {
    R(c, px - 6, ground - 6, 76, 12, '#c8a050'); R(c, px - 6, ground - 6, 76, 2, '#e8c070'); // a crate
    drawSprite(c, me, px, ground - 86 - bob, 2);
    R(c, px + 50, ground - 60, 3, 10, '#333'); R(c, px + 48, ground - 64, 7, 5, '#222'); // mic
    const e0 = findE(g, polOf(g).me.candidacy);
    const word = !e0 ? '政治' : ['kugi', 'shicho'].includes(e0.kind) ? '区政' : ['togi', 'chiji'].includes(e0.kind) ? '都政' : '国政';
    if (t % 40 < 26) speech(c, px + 70, ground - 110, `皆さまの声を${word}へ！`);
  } else if (key === 'ポスター') {
    R(c, px - 90, ground - 120, 240, 110, '#6a5a3a'); R(c, px - 86, ground - 116, 232, 102, '#e8e0c8');
    for (let i = 0; i < 12; i++) { const bx = px - 82 + (i % 6) * 38, by = ground - 112 + Math.floor(i / 6) * 50; R(c, bx, by, 34, 46, '#d8d0b8'); T(c, String(i + 1), bx + 2, by + 1, 12, '#8a8270'); if (i === 4 && t > 20) { R(c, bx + 2, by + 12, 30, 32, '#ffffff'); R(c, bx + 2, by + 12, 30, 6, partyColor(polOf(g), (myDecl(findE(g, polOf(g).me.candidacy)) || {}).party)); drawFaceHD(c, me, bx + 1, by + 19, 1); } }
    drawSprite(c, me, px + 160, ground - 40, 1, 'left', bob);
  } else if (key === '選挙カー') {
    const cx = x + ((t * 3) % (w + 200)) - 160;
    R(c, cx, ground - 50, 150, 40, '#f4f4f4'); R(c, cx + 110, ground - 66, 40, 18, '#cfe4f4'); R(c, cx, ground - 56, 100, 8, '#e04050');
    T(c, fit(c, name, 92, 12), cx + 50, ground - 46, 12, '#d02030', 'center');
    disc(c, cx + 30, ground - 8, 9, '#222'); disc(c, cx + 120, ground - 8, 9, '#222');
    R(c, cx + 20, ground - 70, 16, 10, '#888'); R(c, cx + 60, ground - 70, 16, 10, '#888');
    drawSprite(c, me, cx + 40, ground - 118, 1.2, 'down', bob);
    if (t % 30 < 18) speech(c, cx + 90, ground - 130, `${Array.from(name).slice(0, 6).join('')}でございます！`);
  } else if (key === '討論会') {
    R(c, x + 40, ground - 60, 60, 50, '#3a2a1a'); R(c, w + x - 100, ground - 60, 60, 50, '#3a2a1a');
    drawSprite(c, me, x + 54, ground - 120, 1.5);
    drawSprite(c, LOOKS.salaryman, w + x - 86, ground - 120, 1.5);
    R(c, x + w / 2 - 70, y + 14, 140, 22, '#1a2a6a'); T(c, '公開討論会', x + w / 2, y + 17, 14, '#ffffff', 'center');
    if (t % 50 < 30) speech(c, x + 110, ground - 140, '具体的な数字でお答えします');
  } else if (key === 'SNS' || key === 'ネット広告') {
    R(c, px - 40, y + 14, 150, 170, '#20232e'); R(c, px - 34, y + 22, 138, 150, '#f4f6fa');
    R(c, px - 34, y + 22, 138, 16, key === 'SNS' ? '#3a8ad8' : '#e8a020');
    T(c, key === 'SNS' ? '投稿' : '政党の広告', px + 35, y + 23, 12, '#ffffff', 'center');
    drawFaceHD(c, me, px - 26, y + 46, 1);
    para(c, key === 'SNS' ? '今日も駅前で皆さんのお話を聞きました。' : `${partyShort(g, polOf(g).me.party)}は暮らしを守ります`, px + 10, y + 46, 90, 12, '#222', 15, 4);
    for (let i = 0; i < 6; i++) { const k = (t + i * 17) % 90; if (k < 70) T(c, '♥', px + 120 + ((i * 23) % 50), y + 160 - k * 1.6, 14, '#ff5d8f'); }
  } else if (key === '握手') {
    drawSprite(c, me, px - 30, ground - 86, 2, 'right', bob);
  } else if (key === '後援会') {
    R(c, x + 30, y + 14, w - 60, 26, '#e8e0c8'); T(c, fit(c, `${name}後援会 決起集会`, w - 80, 14), x + w / 2, y + 19, 14, '#3a2a1a', 'center');
    drawSprite(c, me, px, ground - 96, 2, 'down', bob);
    if (t % 40 < 26) speech(c, px + 70, ground - 120, 'よろしくお願いします！');
  } else if (key === '献金集め') {
    R(c, x + 30, y + 14, w - 60, 26, '#e8e0c8'); T(c, '政治資金のご寄付（収支報告書に記載します）', x + w / 2, y + 19, 12, '#3a2a1a', 'center');
    drawSprite(c, me, px, ground - 96, 2);
  } else if (key === '買収') {
    drawSprite(c, me, px - 50, ground - 86, 2, 'right');
    drawSprite(c, LOOKS.salaryman, px + 40, ground - 86, 2, 'left');
    if (t > 20) { R(c, px + 24, ground - 46, 18, 12, '#e8e0c8'); R(c, px + 24, ground - 46, 18, 2, '#c8b890'); }
    T(c, '（票と引きかえに、お金を渡した）', x + w / 2, y + 10, 12, '#ff9aa4', 'center');
  } else if (key === '戸別訪問') {
    for (let i = 0; i < 4; i++) { R(c, x + 30 + i * 140, ground - 110, 110, 100, '#3a3a4a'); R(c, x + 70 + i * 140, ground - 70, 30, 60, '#5a3a2a'); }
    drawSprite(c, me, px - 10, ground - 86, 2, 'up', bob);
    T(c, '（一軒ずつ家を訪ねて、投票を頼んだ）', x + w / 2, y + 10, 12, '#ff9aa4', 'center');
  }
  // the crowd gathers
  if (!illegal) crowd.forEach((p2, i) => {
    if (t < p2.delay) return;
    const k = Math.min(1, (t - p2.delay) / 16);
    const cxp = key === '握手' ? x + w * 0.42 + 40 + i * 36 : x + 20 + ((i * 97) % (w - 60));
    const cy = ground - 36 + (i % 3) * 6 + Math.round((1 - k) * 30);
    if (key === 'SNS' || key === 'ネット広告' || key === 'ポスター' || key === '選挙カー') return;
    c.globalAlpha = k;
    drawSprite(c, p2.look, cxp, cy - 30, 1, key === '握手' ? 'left' : 'up', 0);
    c.globalAlpha = 1;
  });
}
function speech(c, x, y, s) {
  const w = Math.min(260, measure(c, s, 12) + 16);
  frame(c, x, y, w, 20, '#ffffff', '#3a3a4a');
  R(c, x + 8, y + 19, 6, 4, '#ffffff'); R(c, x + 8, y + 23, 3, 2, '#3a3a4a');
  T(c, fit(c, s, w - 12, 12), x + 8, y + 3, 12, '#222');
}
async function campaignScreen(ui, eid) {
  const g = ui.g;
  const e = findE(g, eid);
  if (!e) { await ui.alert('選挙運動', '立候補している選挙がない。'); return null; }
  if (!myDecl(e)) return candidacyFlow(ui, eid);
  return ui.open(campaignView(g, eid));
}

// ---------------------------------------------------------------- 開票速報 (election night)
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 2);
function tvBg(c, t) {
  for (let i = 0; i < 6; i++) R(c, 0, (i * SH) / 6, SW, SH / 6 + 1, mix('#0a1440', '#1a0a30', i / 6));
  for (let i = 0; i < 18; i++) { const x = ((i * 53 + t * 0.6) % (SW + 60)) - 30; c.globalAlpha = 0.07; R(c, x, 0, 18, SH, '#8ab0ff'); }
  c.globalAlpha = 1;
}
function tvTitle(c, label, sub, t) {
  R(c, 0, 8, 196, 34, '#c8102e'); R(c, 0, 8, 196, 2, '#ff6a7a'); R(c, 196, 8, 6, 34, '#8a0a1e');
  T(c, '開票速報', 14, 13, 16, '#ffffff', 'left', 'rgba(0,0,0,0.4)');
  T(c, 'ドットテレビ', 110, 17, 12, '#ffd8de');
  R(c, 202, 8, SW - 210, 34, 'rgba(10,16,48,0.85)');
  T(c, fit(c, label, SW - 230, 16), 214, 11, 16, '#ffffff');
  T(c, fit(c, sub, SW - 230, 12), 214, 28, 12, C.cyan);
  if (Math.floor(t / 20) % 2) R(c, SW - 18, 14, 6, 6, '#ff3a4a');
}
function nightView(g, res) {
  const p = polOf(g);
  const national = res.kind === 'shugi' || res.kind === 'sangi';
  const my = res.myResult;
  const cands0 = Array.isArray(res.candidates) ? res.candidates : [];
  const leader = res.kind === 'sosaisen';
  const M = leader ? 1 : Math.max(1, cands0.filter((x) => x.won).length || (res.winners || []).length || 1);
  // which candidates to show
  const winName = leader && res.winners && res.winners[0] ? res.winners[0].name : null;
  let rows = cands0.map((x, i) => ({ ...x, rank: i + 1, party: leader ? res.party : x.party, won: leader ? x.name === winName : x.won }));
  const windowed = rows.length > 8;
  if (windowed) {
    const keep = new Set([0, M - 2, M - 1, M, M + 1, rows.findIndex((x) => x.isPlayer)].filter((i) => i >= 0 && i < rows.length));
    for (let i = 1; keep.size < 7 && i < rows.length; i++) keep.add(i);
    rows = rows.filter((x, i) => keep.has(i));
  }
  const valid = Math.max(1, num(res.valid) || cands0.reduce((a, x) => a + num(x.votes), 0));
  const firstLoser = cands0[M] ? num(cands0[M].votes) : 0;
  rows.forEach((x, i) => {
    x.e = 0.75 + hash2(i, x.votes | 0, 5) * 0.5;
    const margin = (num(x.votes) - firstLoser) / valid;
    x.thr = x.won ? clamp(0.82 - margin * 6, 0, 0.92) : 2;
    x.y = null;
  });
  const showRace = rows.length > 0;
  const seatsTotal = national ? Math.max(1, num(res.total)) : 0;
  const groups = national ? Object.entries(res.seats || {}).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, color: partyColor(p, id), ruling: isRuling(p, id) })) : [];
  const ordered = [...groups.filter((x) => x.id !== IND && !x.ruling).sort((a, b) => b.n - a.n), ...groups.filter((x) => x.id === IND), ...groups.filter((x) => x.id !== IND && x.ruling).sort((a, b) => a.n - b.n)];
  const seatColors = [];
  const seatParty = [];
  for (const gr of ordered) for (let i = 0; i < gr.n; i++) { seatColors.push(gr.color); seatParty.push(gr.id); }
  const order = seatColors.map((_, i) => i).sort((a, b) => hash2(a, 3, seatsTotal) - hash2(b, 3, seatsTotal));
  const revealAt = new Array(seatColors.length);
  order.forEach((si, k) => { revealAt[si] = k; });
  const T0 = 70, TS = national ? 260 : 0, TR = showRace ? 330 : 0;
  const end = T0 + TS + TR;
  const myRow = rows.find((x) => x.isPlayer);
  const v = {
    noChrome: true, ownBg: true, called: false, finalSfx: false,
    hint: 'A:すすめる B:とばす',
    tip: () => (showRace && v.t > T0 + TS ? '当選が確実になると「当確」。開票前に出る「ゼロ打ち」もある' : national ? `${res.kind === 'shugi' ? '衆議院' : '参議院'}の過半数は、法案や予算を通すための目安` : '開票は、投票が締め切られた夜に行われる'),
    update(ui, inp) {
      if (g.auto) { ui.done(v, true); return; }
      if (inp.pressed('b')) { v.t = Math.max(v.t, end + 1); }
      if (inp.pressed('a')) {
        if (v.t < T0) v.t = T0;
        else if (national && v.t < T0 + TS) v.t = T0 + TS;
        else if (v.t < end) v.t = end;
        else { sfx('ok'); ui.done(v, true); return; }
      }
      const pr = showRace ? clamp((v.t - T0 - TS) / (TR - 60), 0, 1) : 0;
      if (myRow && myRow.won && !v.called && pr >= myRow.thr && v.t > T0 + TS) { v.called = true; sfx('chime'); }
      if (v.t >= end && !v.finalSfx) { v.finalSfx = true; sfx(my ? (my.won ? 'fanfare' : 'fail') : 'chime'); }
    },
    draw(c, ui) {
      const t = v.t;
      tvBg(c, t);
      const sub = leader ? `${dateLabel(g, res.day)}投票・国会議員と党員による選挙` : `${dateLabel(g, res.day)}投票・投票率 ${num(res.turnout).toFixed(1)}%`;
      tvTitle(c, res.label, sub, t);
      if (t < T0) {
        const k = ease(t / 30);
        c.globalAlpha = k;
        T(c, res.label, SW / 2, 130, 16, '#ffffff', 'center', 'rgba(0,0,0,0.5)');
        T(c, '開票作業が始まりました', SW / 2, 160, 16, C.gold, 'center');
        if (!leader) T(c, `投票率 ${num(res.turnout).toFixed(1)}%`, SW / 2, 190, 14, C.cyan, 'center');
        c.globalAlpha = 1;
      } else if (national && t < T0 + TS + (showRace ? 0 : 1e9)) {
        drawSeatCount(c, g, res, ordered, seatColors, revealAt, clamp((t - T0) / (TS - 50), 0, 1), t);
      }
      if (showRace && t >= T0 + TS) drawRaceCount(c, g, res, rows, M, clamp((t - T0 - TS) / (TR - 60), 0, 1), t, my, leader, windowed);
      // footer
      R(c, 0, SH - 20, SW, 20, 'rgba(6,10,30,0.9)');
      T(c, v.hint, SW - 8, SH - 16, 12, C.dim, 'right');
      T(c, fit(c, v.tip(), SW - 160, 12), 10, SH - 16, 12, C.cyan);
      if (t >= end && Math.floor(t / 24) % 2) T(c, '▼', SW / 2, SH - 34, 12, '#ffffff', 'center');
    },
  };
  return v;
}
function drawSeatCount(c, g, res, ordered, seatColors, revealAt, k, t) {
  const p = polOf(g);
  const n = Math.floor(seatColors.length * ease(k));
  const cols = seatColors.map((col, i) => (revealAt[i] < n ? col : '#232a55'));
  const cx = 222, cy = 300, Rr = 196;
  drawHemi(c, cx, cy, Rr, [], { colors: cols, total: seatColors.length });
  const total = seatColors.length;
  T(c, `${res.kind === 'sangi' ? '改選' : '定数'} ${total}`, cx, cy - 26, 16, '#ffffff', 'center');
  T(c, `開票 ${Math.round(ease(k) * 100)}%`, cx, cy - 6, 12, C.dim, 'center');
  // party counters
  const x = 434, w = SW - 8 - x;
  frame(c, x, 50, w, 270, 'rgba(10,16,48,0.85)', C.edge);
  T(c, '獲得議席', x + 8, 54, 12, C.gold);
  const counts = {};
  seatColors.forEach((_, i) => { if (revealAt[i] < n) { let acc = 0; for (const gr of ordered) { if (i < acc + gr.n) { counts[gr.id] = (counts[gr.id] || 0) + 1; break; } acc += gr.n; } } });
  const list = ordered.slice().sort((a, b) => b.n - a.n).slice(0, 9);
  list.forEach((gr, i) => {
    const y = 72 + i * 24;
    R(c, x + 6, y, 4, 18, gr.color);
    T(c, fit(c, partyShort(g, gr.id), 84, 14), x + 14, y + 1, 14, gr.ruling ? '#ffffff' : C.text);
    if (gr.ruling) T(c, '与', x + 100, y + 2, 12, C.gold);
    T(c, String(counts[gr.id] || 0), x + w - 10, y + 1, 14, C.gold, 'right');
    hbar(c, x + 114, y + 6, w - 160, 6, (counts[gr.id] || 0) / Math.max(1, total / 2), gr.color);
  });
  const ruling = ordered.filter((gr) => gr.ruling).reduce((a, gr) => a + (counts[gr.id] || 0), 0);
  if (res.kind === 'shugi') {
    const need = Math.floor(total / 2) + 1;
    T(c, `与党 ${ruling}／過半数 ${need}`, x + 8, 294, 14, ruling >= need ? C.good : C.text);
    if (k >= 1) T(c, ruling >= need ? '与党が過半数を確保' : '与党は過半数に届かず', x + 8, 278, 12, ruling >= need ? C.good : C.bad);
  } else {
    const houseRuling = (p.cabinet.partyIds || []).reduce((a, id) => a + num((res.houseSeats || {})[id]), 0);
    const ht = Object.values(res.houseSeats || {}).reduce((a, b) => a + num(b), 0);
    T(c, `与党 改選${ruling}`, x + 8, 278, 12, C.text);
    if (k >= 1 && ht) T(c, `参院全体 与党${houseRuling}／${ht}`, x + 8, 294, 14, houseRuling > ht / 2 ? C.good : C.bad);
  }
  void t;
}
// the election daruma: one eye at the start of the campaign, the other when the seat is won
function daruma(c, x, y, eyes) {
  disc(c, x + 26, y + 32, 26, '#6a0a0a');
  disc(c, x + 26, y + 32, 25, '#d22a2a');
  R(c, x + 6, y + 30, 6, 8, '#e84a4a');
  disc(c, x + 26, y + 22, 14, '#5a1010');
  disc(c, x + 26, y + 22, 13, '#f6e6cc');
  R(c, x + 14, y + 12, 24, 3, '#2a1a1a');
  for (const ex of [19, 33]) { disc(c, x + ex, y + 21, 4, '#2a1a1a'); disc(c, x + ex, y + 21, 3, '#ffffff'); }
  disc(c, x + 19, y + 21, 2, '#111');
  if (eyes) { c.globalAlpha = Math.min(1, eyes); disc(c, x + 33, y + 21, 2, '#111'); c.globalAlpha = 1; }
  R(c, x + 20, y + 28, 4, 1, '#2a1a1a'); R(c, x + 28, y + 28, 4, 1, '#2a1a1a');
  R(c, x + 14, y + 44, 24, 12, '#e8c040'); R(c, x + 15, y + 45, 22, 10, '#c8282a');
  T(c, '必勝', x + 26, y + 43, 12, '#ffe890', 'center');
}
function drawRaceCount(c, g, res, rows, M, k, t, my, leader, windowed) {
  const p = polOf(g);
  const pk = ease(k);
  const x = 16, y = 54, w = 470;
  frame(c, x - 6, y - 6, w + 12, 268, 'rgba(10,16,48,0.88)', C.edge);
  T(c, leader ? '党首選 開票' : `開票率 ${Math.round(pk * 100)}%`, x, y - 2, 14, C.gold);
  if (!leader) T(c, `定数 ${M}`, x + w, y - 2, 12, C.dim, 'right');
  const maxV = Math.max(1, ...rows.map((r) => num(r.votes)));
  const cur = rows.map((r) => ({ r, v: Math.floor((num(r.votes) * Math.pow(pk, r.e)) / 10) * 10 }));
  // a short race re-sorts live (every half second); a long list keeps its final order
  if (!windowed && !leader && (!rows._order || t % 30 === 0 || k >= 1)) rows._order = cur.slice().sort((a, b) => b.v - a.v || a.r.rank - b.r.rank).map((x) => x.r);
  const live = !windowed && !leader && rows._order ? rows._order.map((r) => cur.find((x) => x.r === r)) : cur;
  const rh = Math.min(30, Math.floor(232 / Math.max(1, rows.length)));
  live.forEach((it, i) => {
    const r = it.r;
    const target = y + 18 + i * rh;
    r.y = r.y == null ? target : Math.abs(target - r.y) < 1 ? target : r.y + (target - r.y) * 0.25;
    const ry = Math.round(r.y);
    if (windowed && i > 0 && live[i - 1].r.rank !== r.rank - 1) T(c, '⋮', x + 8, ry - 9, 12, C.faint, 'center');
    if ((windowed && r.rank === M + 1) || (!windowed && !leader && M > 1 && i === M)) { for (let xx = x; xx < x + w; xx += 6) R(c, xx, ry - 3, 3, 1, C.bad); T(c, `当選ライン（${M}位まで）`, x + w, ry - 15, 12, C.bad, 'right'); }
    if (r.isPlayer) R(c, x - 4, ry - 2, w + 8, rh - 2, '#2a2a10');
    const showRank = windowed ? r.rank : i + 1;
    T(c, `${showRank}`, x + 12, ry + 2, 12, C.dim, 'right');
    R(c, x + 18, ry + 2, 4, 14, partyColor(p, r.party));
    T(c, fit(c, r.name, 110, 14), x + 26, ry + 1, 14, r.isPlayer ? C.gold : '#ffffff');
    T(c, fit(c, partyShort(g, r.party), 60, 12), x + 140, ry + 3, 12, C.dim);
    const bx = x + 204, bw = w - 204 - 70;
    if (leader) {
      const dv = Math.round(num(r.dietVotes) * pk), mv = Math.round(num(r.memberVotes) * pk);
      const tot = Math.max(1, ...rows.map((q) => num(q.votes)));
      R(c, bx, ry + 4, Math.round((dv / tot) * bw), 10, '#4a7ad8');
      R(c, bx + Math.round((dv / tot) * bw), ry + 4, Math.round((mv / tot) * bw), 10, '#4ab87a');
      T(c, `${dv + mv}票`, x + w, ry + 2, 12, '#ffffff', 'right');
    } else {
      hbar(c, bx, ry + 4, bw, 10, it.v / maxV, r.isPlayer ? C.gold : shade(partyColor(p, r.party), 0.15));
      T(c, `${fmtNum(it.v)}`, x + w, ry + 2, 12, '#ffffff', 'right');
    }
    // 当確 / 当選 / 落選
    if (k >= 1) { if (r.won) pill(c, bx + 4, ry + 1, '当選', C.stamp); }
    else if (k >= r.thr) pill(c, bx + 4, ry + 1, '当確', '#d8402e');
  });
  if (leader && k >= 1 && res.runoff) T(c, fit(c, `決選投票：${res.runoff.a.name} ${res.runoff.a.votes}票・${res.runoff.b.name} ${res.runoff.b.votes}票`, w, 12), x, y + 236, 12, C.cyan);
  if (leader) { R(c, x, y + 252, 10, 8, '#4a7ad8'); T(c, '議員票', x + 14, y + 249, 12, C.dim); R(c, x + 70, y + 252, 10, 8, '#4ab87a'); T(c, '党員票', x + 84, y + 249, 12, C.dim); }
  // the player's camp
  const myRow = rows.find((r) => r.isPlayer);
  const cx = 500, cy = 54;
  frame(c, cx, cy - 6, SW - 8 - cx, 268, 'rgba(10,16,48,0.88)', C.edge);
  T(c, '選挙事務所', cx + 8, cy - 2, 12, C.gold);
  if (myRow || my) {
    const called = myRow ? myRow.won && k >= myRow.thr : my && my.won && k >= 1;
    const done = k >= 1;
    R(c, cx + 8, cy + 18, SW - 24 - cx, 120, '#2a1e18');
    if (called && myRow && !myRow._calledAt) myRow._calledAt = t;
    daruma(c, cx + 18, cy + 50, called ? (t - (myRow ? myRow._calledAt || t : t)) / 20 + 0.05 : 0);
    drawSprite(c, g.state.look, cx + 76, cy + 52 - (called && Math.floor(t / 10) % 2 ? 6 : 0), 1.5, 'down', 0);
    if (called) { T(c, 'バンザイ！', cx + (SW - 8 - cx) / 2, cy + 140, 16, C.gold, 'center'); }
    else if (done && my && !my.won) T(c, '…', cx + (SW - 8 - cx) / 2, cy + 140, 16, C.dim, 'center');
    else T(c, '固唾をのんで見守る…', cx + (SW - 8 - cx) / 2, cy + 144, 12, C.dim, 'center');
    if (called) para(c, '当選が決まると、だるまにもう片方の目を入れる。', cx + 10, cy + 170, SW - 28 - cx, 12, C.dim, 16, 4);
  } else para(c, 'あなたはこの選挙には出ていない。', cx + 10, cy + 30, SW - 28 - cx, 12, C.dim);
}
function resultCardView(g, res) {
  const p = polOf(g);
  const my = res.myResult;
  const v = {
    noChrome: true, modal: false,
    hint: 'A:とじる',
    tip: () => (my && my.revived ? '比例復活：小選挙区で負けても、重複立候補なら比例で当選することがある' : my && my.depositLost ? '供託金の没収は、立候補の乱立を防ぐための仕組み' : '当選人は、開票のあとの選挙会で選挙長が決める'),
    update(ui, inp) { if (g.auto || (v.t > 20 && (inp.pressed('a') || inp.pressed('b')))) { sfx('ok'); ui.done(v, true); } },
    draw(c, ui) {
      tvBg(c, v.t);
      const x = 110, y = 22, w = SW - 220, h = 300;
      paper(c, x, y, w, h);
      const ink = C.ink;
      const won = my && my.won;
      if (my) {
        T(c, won ? (res.kind === 'sosaisen' ? '選出' : '当選証書') : '選挙結果', x + w / 2, y + 14, 16, ink, 'center');
        R(c, x + 30, y + 36, w - 60, 1, C.paperEdge);
        T(c, `${playerName(g)} 殿`, x + 30, y + 48, 16, ink);
        let yy = y + 76;
        if (won) {
          const how = res.kind === 'sosaisen' ? `${partyFull(g, res.party)}の${postName('party_leader', res.year, res.party)}に選ばれました。` : my.revived ? '小選挙区では及ばなかったものの、比例代表で当選人と決定しました。' : my.pr ? '比例代表の当選人と決定しました。' : '当選人と決定しました。';
          yy = para(c, `あなたは、${res.label}において、${how}`, x + 30, yy, w - 60, 14, ink, 20, 4) + 8;
        } else {
          yy = para(c, `${res.label}は、残念ながら落選となりました。`, x + 30, yy, w - 60, 14, ink, 20, 3) + 8;
        }
        const lines = [];
        if (my.votes) lines.push(`得票　${fmtNum(my.votes)}票${my.rank && !my.pr ? `（${my.rank}位）` : ''}${my.share && !my.pr ? `・得票率 ${(num(my.share) * 100).toFixed(1)}%` : ''}`);
        if (my.revived && res.candidates && res.candidates[0]) lines.push(`惜敗率　${((num(my.votes) / Math.max(1, num(res.candidates[0].votes))) * 100).toFixed(1)}%`);
        if (my.pr && my.rank) lines.push(`比例名簿・個人票の順位　${my.rank}位`);
        if (res.turnout) lines.push(`投票率　${num(res.turnout).toFixed(1)}%`);
        if (my.deposit) lines.push(my.depositLost ? `供託金　${fmtMoney(my.deposit)}は没収` : `供託金　${fmtMoney(my.deposit)}は返還`);
        lines.forEach((l, i) => T(c, l, x + 40, yy + i * 20, 14, l.includes('没収') ? C.stamp : ink));
        if (won) {
          T(c, dateLabel(g, res.day), x + w - 30, y + h - 56, 12, C.inkDim, 'right');
          T(c, res.kind === 'sosaisen' ? `${partyFull(g, res.party)}${postName('party_leader', res.year, res.party)}選挙管理委員会` : '選挙長', x + w - 30, y + h - 38, 14, ink, 'right');
        }
        if (v.t > 18) {
          const s = clamp((v.t - 18) / 8, 0, 1);
          const sz = 1 + (1 - s) * 0.6;
          c.save(); c.translate(x + w - 86, y + h - 110); c.scale(sz, sz);
          c.globalAlpha = s;
          stampArt(c, { x: -36, y: -36, w: 72, h: 72 }, won ? (res.kind === 'sosaisen' ? '選出' : '当選') : '落選', won ? C.stamp : '#6a6a7a');
          c.restore(); c.globalAlpha = 1;
        }
      } else {
        T(c, res.label, x + w / 2, y + 14, 16, ink, 'center');
        R(c, x + 30, y + 36, w - 60, 1, C.paperEdge);
        const seats = Object.entries(res.seats || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
        T(c, `${res.kind === 'sangi' ? '改選' : '定数'} ${res.total}・投票率 ${num(res.turnout).toFixed(1)}%`, x + 30, y + 46, 14, ink);
        seats.slice(0, 9).forEach(([id, n], i) => {
          const yy = y + 72 + i * 22;
          R(c, x + 30, yy + 2, 6, 14, partyColor(p, id));
          T(c, partyFull(g, id), x + 42, yy, 14, ink);
          T(c, `${n}議席`, x + w - 40, yy, 14, ink, 'right');
          if (isRuling(p, id)) T(c, '与党', x + w - 110, yy + 2, 12, C.inkDim, 'right');
        });
      }
    },
  };
  return v;
}
SECTIONS.night = async (ui, o = {}) => {
  const g = ui.g;
  const res = polOf(g).elections.history.find((h) => h.id === o.resultId);
  if (!res) return;
  await ui.open(nightView(g, res));
  await ui.open(resultCardView(g, res));
};
SECTIONS.results = async (ui) => {
  const g = ui.g;
  let idx = 0;
  for (let guard = 0; guard < 100; guard++) {
    const p = polOf(g);
    const hist = p.elections.history;
    const items = hist.map((h) => ({ label: h.label, sub: `${dateLabel(g, h.day)}・投票率 ${num(h.turnout).toFixed(1)}%`, tag: h.myResult ? { text: h.myResult.won ? '当選' : '落選', color: h.myResult.won ? C.stamp : '#5a5a6a' } : null }));
    const i = await ui.menu({
      title: '過去の選挙結果', listTitle: '開票結果', listW: 300, rowH: 36, items, index: idx, empty: 'まだ選挙は行われていない',
      detail: (c, it, r, k) => {
        const h = hist[k];
        card(c, r.x, r.y, r.w, r.h, h ? h.label : '結果');
        if (!h) return;
        const x = r.x + 10;
        let y = r.y + 26;
        if (h.kind === 'shugi' || h.kind === 'sangi' || h.kind === 'touitsu') {
          const seats = Object.entries(h.seats || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
          seats.slice(0, 10).forEach(([id, n]) => { R(c, x, y + 2, 4, 12, partyColor(p, id)); T(c, fit(c, partyFull(g, id), r.w - 90, 12), x + 8, y, 12, C.text); T(c, `${n}`, r.x + r.w - 12, y, 12, C.gold, 'right'); y += 16; });
        } else {
          (h.winners || []).slice(0, 6).forEach((w2) => { T(c, fit(c, `当選 ${w2.name}（${partyShort(g, w2.party)}）`, r.w - 90, 12), x, y, 12, w2.isPlayer ? C.gold : C.text); T(c, `${fmtNum(w2.votes)}票`, r.x + r.w - 12, y, 12, C.dim, 'right'); y += 16; });
        }
        if (h.myResult) { y += 6; T(c, fit(c, `あなた：${h.myResult.won ? '当選' : '落選'}・${fmtNum(h.myResult.votes)}票${h.myResult.rank ? `（${h.myResult.rank}位）` : ''}`, r.w - 20, 12), x, y, 12, h.myResult.won ? C.good : C.bad); }
        T(c, 'A：開票速報をもう一度見る', x, r.y + r.h - 20, 12, C.faint);
      },
      tip: () => '投票率は、有権者のうち実際に投票した人の割合',
    });
    if (i < 0) return;
    idx = i;
    await SECTIONS.night(ui, { resultId: hist[i].id });
  }
};

// ---------------------------------------------------------------- 本会議の採決 (vote replay)
function voteSplit(g, b, houseKey) {
  const p = polOf(g);
  const house = houseKey.startsWith('sangi') ? 'sangi' : 'shugi';
  const rec = b.votes[houseKey] || {};
  const groups = seatGroups(p, house);
  const total = groups.reduce((a, x) => a + x.n, 0);
  if (rec.byParty) {
    const out = groups.map((gr) => ({ ...gr, yes: num((rec.byParty[gr.id] || {}).yes), no: num((rec.byParty[gr.id] || {}).no) }));
    return { groups: out, total, rec, house };
  }
  // approximate who voted how from the parties' leanings (the totals are the real count)
  let al = {};
  try { al = (b.policy && g.policyPreview(b.policy, b.params) || {}).alignment || {}; } catch (e) { al = {}; }
  const lean = (gr) => {
    if (b.kind === 'budget') return gr.ruling ? 0.99 : 0.03;
    if (b.kind === 'noconfidence') return gr.ruling ? 0.02 : 0.95;
    if (b.party === gr.id) return 0.97;
    if (b.sponsor === 'cabinet' && gr.ruling) return 0.97;
    if (gr.id === IND) return 0.5;
    const a = num(al[gr.id], 0.5);
    return clamp((a - 0.45) * 2.2, 0.03, 0.97);
  };
  const yesT = num(rec.yes), noT = num(rec.no);
  const want = groups.map((gr) => gr.n * lean(gr));
  const sw = want.reduce((a, x) => a + x, 0) || 1;
  const yes = groups.map((gr, i) => Math.min(gr.n, Math.floor((want[i] / sw) * yesT)));
  let left = yesT - yes.reduce((a, x) => a + x, 0);
  for (let k = 0; left > 0 && k < 2000; k++) { const i = k % groups.length; if (yes[i] < groups[i].n) { yes[i]++; left--; } }
  const rest = groups.map((gr, i) => gr.n - yes[i]);
  const rs = rest.reduce((a, x) => a + x, 0) || 1;
  const no = rest.map((n) => Math.floor((n / rs) * noT));
  let nl = noT - no.reduce((a, x) => a + x, 0);
  for (let k = 0; nl > 0 && k < 2000; k++) { const i = k % groups.length; if (no[i] < rest[i]) { no[i]++; nl--; } }
  return { groups: groups.map((gr, i) => ({ ...gr, yes: yes[i], no: no[i] })), total, rec, house };
}
function voteView(g, b, houseKey) {
  const p = polOf(g);
  if (houseKey === 'referendum') return referendumView(g, b);
  const S = voteSplit(g, b, houseKey);
  const colors = [];
  const states = [];
  S.groups.forEach((gr) => {
    const arr = [...Array(gr.yes).fill('y'), ...Array(gr.no).fill('n'), ...Array(Math.max(0, gr.n - gr.yes - gr.no)).fill('a')];
    arr.sort((a2, b2) => hash2(a2.charCodeAt(0), b2.charCodeAt(0), gr.n) - 0.5);
    for (const s of arr) { states.push(s); colors.push(gr.color); }
  });
  const order = states.map((_, i) => i).sort((a, b2) => hash2(a, 9, states.length) - hash2(b2, 9, states.length));
  const at = new Array(states.length);
  order.forEach((si, k) => { at[si] = k; });
  const passed = !!S.rec.passed;
  const kindWord = b.kind === 'noconfidence' ? '内閣不信任決議案' : b.kind === 'budget' ? (b.policy ? '補正予算案' : '予算案') : b.kind === 'amendment' ? '憲法改正原案' : '法律案';
  const houseName = S.house === 'shugi' ? '衆議院' : '参議院';
  const year = yearOf(g);
  const myVote = p.me.votes[b.id];
  const DUR = 240;
  const v = {
    noChrome: false, title: `${houseName}本会議`,
    hint: 'A:すすめる B:とばす',
    tip: () => (S.house === 'sangi' && year >= 1998 ? '参議院は1998年から押しボタン式で採決している' : '記名投票では、賛成は白票・反対は青票（木札）を投じる'),
    update(ui, inp) {
      if (g.auto) { ui.done(v, true); return; }
      if (inp.pressed('b') && v.t < DUR) v.t = DUR;
      else if (inp.pressed('a')) { if (v.t < DUR) v.t = DUR; else { sfx('ok'); ui.done(v, true); } }
      if (v.t === DUR + 1) sfx(passed ? 'applause' : 'buzz');
    },
    draw(c, ui) {
      const k = clamp(v.t / (DUR - 30), 0, 1);
      const n = Math.floor(states.length * ease(k));
      const cols = states.map((s, i) => (at[i] < n ? (s === 'y' ? C.yes : s === 'n' ? C.no : '#3a4066') : shade(colors[i], -0.55)));
      card(c, 6, 30, SW - 12, 52);
      T(c, fit(c, b.title, SW - 160, 16), 16, 36, 16, '#ffffff');
      T(c, `${kindWord}・${b.sponsor === 'cabinet' ? '内閣提出' : b.kind === 'noconfidence' ? '議員提出' : '議員提出'}`, 16, 58, 12, C.dim);
      if (myVote && ((p.me.office === 'shugi' && S.house === 'shugi') || (p.me.office === 'sangi' && S.house === 'sangi'))) T(c, `あなたの票：${{ yes: '賛成', no: '反対', abstain: '棄権' }[myVote] || myVote}`, SW - 16, 58, 12, C.gold, 'right');
      drawHemi(c, 230, 318, 200, [], { colors: cols, total: states.length });
      T(c, '議長席', 230, 298, 12, C.dim, 'center');
      R(c, 222, 314, 16, 6, '#c8a050');
      const yesN = states.filter((s, i) => s === 'y' && at[i] < n).length, noN = states.filter((s, i) => s === 'n' && at[i] < n).length;
      const x = 450, w = SW - 8 - x;
      frame(c, x, 90, w, 210, 'rgba(10,16,48,0.85)', C.edge);
      const button = S.house === 'sangi' && year >= 1998;
      T(c, button ? '賛成' : '賛成（白票）', x + 10, 98, 12, C.dim);
      T(c, String(yesN), x + w - 10, 112, 16, '#ffffff', 'right');
      R(c, x + 10, 116, 12, 12, C.yes);
      T(c, button ? '反対' : '反対（青票）', x + 10, 140, 12, C.dim);
      T(c, String(noN), x + w - 10, 154, 16, C.no, 'right');
      R(c, x + 10, 158, 12, 12, C.no);
      const need = S.rec.need || (b.kind === 'amendment' ? Math.ceil((S.total * 2) / 3) : null);
      T(c, need ? `必要 ${need}票${b.kind === 'amendment' ? '（総議員の3分の2）' : ''}` : '出席議員の過半数で可決', x + 10, 184, 12, C.faint);
      if (v.t >= DUR) {
        const s = clamp((v.t - DUR) / 10, 0, 1);
        c.globalAlpha = s;
        frame(c, x + 14, 210, w - 28, 70, passed ? '#5a1414' : '#14285a', passed ? '#ff6a6a' : '#6a9aff');
        T(c, passed ? '可決' : '否決', x + w / 2, 222, 16, '#ffffff', 'center');
        T(c, `${num(S.rec.yes)}対${num(S.rec.no)}`, x + w / 2, 248, 14, C.gold, 'center');
        c.globalAlpha = 1;
      }
    },
  };
  return v;
}
function referendumView(g, b) {
  const R0 = (b.votes && b.votes.referendum) || { yes: 50, passed: false };
  const v = {
    title: '国民投票', hint: 'A:すすめる',
    tip: () => '国民投票は、賛成が投票総数（賛成と反対の合計）の過半数なら承認',
    update(ui, inp) { if (g.auto || (v.t > 30 && (inp.pressed('a') || inp.pressed('b')))) { if (v.t < 200) { v.t = 200; return; } sfx('ok'); ui.done(v, true); } },
    draw(c, ui) {
      const k = ease(clamp(v.t / 180, 0, 1));
      card(c, 40, 50, SW - 80, 250, '憲法改正の国民投票', { right: dateLabel(g, b.closed || today(g)), rightW: 140 });
      para(c, b.title, 60, 80, SW - 120, 16, '#ffffff', 22, 2);
      const yes = num(R0.yes) * k, no = (100 - num(R0.yes)) * k;
      const bx = 60, bw = SW - 120;
      R(c, bx, 150, bw, 40, '#0c1230');
      R(c, bx, 150, Math.round((yes / 100) * bw), 40, '#e04a5a');
      R(c, bx + bw - Math.round((no / 100) * bw), 150, Math.round((no / 100) * bw), 40, '#4a7ad8');
      R(c, bx + bw / 2, 144, 1, 52, '#ffffff');
      T(c, `賛成 ${yes.toFixed(1)}%`, bx, 196, 14, '#ff9aa4');
      T(c, `反対 ${no.toFixed(1)}%`, bx + bw, 196, 14, '#9ab8ff', 'right');
      T(c, '過半数', bx + bw / 2, 128, 12, C.dim, 'center');
      if (v.t >= 190) T(c, R0.passed ? '承認：憲法が改正される' : '否決：改正は成立しなかった', SW / 2, 236, 16, R0.passed ? C.good : C.bad, 'center');
    },
  };
  return v;
}
SECTIONS.vote = async (ui, o = {}) => {
  const g = ui.g;
  const b = polOf(g).diet.bills.find((x) => x.id === o.billId);
  if (!b) return;
  const key = o.house && b.votes[o.house] ? o.house : Object.keys(b.votes || {}).pop();
  if (!key) { await ui.alert('採決', 'まだ本会議の採決は行われていない。'); return; }
  await ui.open(voteView(g, b, key));
};

// ---------------------------------------------------------------- 首班指名
SECTIONS.pmCeremony = async (ui) => {
  const g = ui.g;
  const p = polOf(g);
  if (p.cabinet.pm !== 'player') return;
  const H = p.diet.shugi;
  const mine = (p.cabinet.partyIds || []).reduce((a, id) => a + num(H.seats[id]), 0);
  const opp = Object.keys(p.parties).filter((id) => !isRuling(p, id) && num(H.seats[id]) > 0).sort((a, b) => H.seats[b] - H.seats[a]);
  // each opposition party votes for its own leader; the independents and small parties are shown together
  const rows = [{ name: playerName(g), party: p.me.party, votes: mine, me: true }];
  for (const id of opp.slice(0, 3)) rows.push({ name: g.npcName(p.parties[id].leader) || '（不明）', party: id, votes: num(H.seats[id]) });
  const others = H.total - rows.reduce((a, r) => a + r.votes, 0);
  if (others > 0) rows.push({ name: 'その他・無効など', party: IND, votes: others });
  rows.sort((a, b) => b.votes - a.votes);
  const pmNo = num(p.flags.pmNo, 100);
  const v = {
    title: '内閣総理大臣指名選挙（衆議院）', hint: 'A:すすめる',
    tip: () => '首班指名で衆参が違う人を選んだときは、衆議院の議決が優先（憲法67条）',
    update(ui2, inp) { if (g.auto) { ui2.done(v, true); return; } if (v.t > 30 && inp.pressed('a')) { if (v.t < 200) v.t = 200; else { sfx('ok'); ui2.done(v, true); } } if (v.t === 200) sfx('fanfare'); },
    draw(c) {
      const k = ease(clamp(v.t / 170, 0, 1));
      card(c, 30, 40, SW - 60, 270, '首班指名', { right: `衆議院 ${H.total}議席`, rightW: 120 });
      const max = Math.max(1, ...rows.map((r) => r.votes));
      rows.slice(0, 5).forEach((r, i) => {
        const y = 66 + i * 30;
        R(c, 50, y + 2, 4, 18, partyColor(p, r.party));
        T(c, fit(c, r.name, 150, 16), 60, y + 2, 16, r.me ? C.gold : '#ffffff');
        hbar(c, 230, y + 6, 260, 12, (r.votes * k) / max, r.me ? C.gold : partyColor(p, r.party));
        T(c, `${Math.round(r.votes * k)}票`, SW - 50, y + 4, 14, '#ffffff', 'right');
      });
      if (v.t >= 190) {
        R(c, 44, 218, SW - 88, 1, C.edge);
        para(c, `「${playerName(g)}君を、本院において内閣総理大臣に指名することに決まりました」`, 60, 226, SW - 120, 14, '#ffffff', 20, 2);
        T(c, `第${pmNo}代 内閣総理大臣`, SW / 2, 278, 16, C.gold, 'center');
      }
    },
  };
  await ui.open(v);
  const i = await ui.confirm({ title: '組閣', text: '総理大臣として、内閣の顔ぶれを決める（組閣）。いますぐ組閣する？\n（あとで「内閣」の画面からもできる）', choices: ['組閣する', 'あとにする'], tip: '国務大臣の過半数は、国会議員から選ばなければならない（憲法68条）' });
  if (i === 0 && SECTIONS.formation) await SECTIONS.formation(ui);
};

// ================================================================ 政党
const AXES = [
  ['econ', '経済', '再分配・公的支出', '市場・小さな政府'],
  ['social', '社会', '多様性・個人', '伝統・家族'],
  ['security', '安全保障', '対話・協調', '抑止・防衛'],
];
function drawIdeology(c, ide, x, y, w, col = C.gold, others = []) {
  AXES.forEach(([k, name, lo, hi], i) => {
    const yy = y + i * 30;
    T(c, name, x, yy, 12, C.dim);
    T(c, lo, x + 70, yy, 12, C.faint);
    T(c, hi, x + w, yy, 12, C.faint, 'right');
    const bx = x + 2, bw = w - 4, by = yy + 16;
    R(c, bx, by + 3, bw, 2, '#2a3262');
    for (let t2 = 0; t2 <= 4; t2++) R(c, bx + Math.round((t2 / 4) * bw), by + 1, 1, 6, t2 === 2 ? C.dim : '#3a4272');
    for (const o of others) { const ox = bx + Math.round(((num(o.v[k]) + 2) / 4) * bw); R(c, ox - 1, by + 1, 3, 6, o.color); }
    const vx = bx + Math.round(((num(ide && ide[k]) + 2) / 4) * bw);
    R(c, vx - 3, by - 1, 7, 10, '#05081a'); R(c, vx - 2, by, 5, 8, col);
  });
}
function partyInfo(c, g, id, r) {
  const p = polOf(g);
  const pt = p.parties[id];
  if (!pt) return;
  card(c, r.x, r.y, r.w, r.h, pt.real ? '実在の政党（事実のみ）' : pt.isPlayers ? 'あなたの政党' : '架空の政党', { accent: pt.real ? C.cyan : C.gold });
  const x = r.x + 10, w = r.w - 20;
  drawPartyMark(c, g, id, x, r.y + 26, 44);
  T(c, fit(c, pt.name, w - 56, 16), x + 54, r.y + 26, 16, '#ffffff');
  const st = g.partyStatus(id);
  T(c, fit(c, `${pt.leaderTitle || '代表'}：${whoName(g, pt.leader)}`, w - 56, 12), x + 54, r.y + 46, 12, C.dim);
  T(c, `衆${st.shugi}・参${st.sangi}・支持率 ${g.partySupport(id)}%`, x + 54, r.y + 60, 12, C.text);
  let y = para(c, pt.desc || '', x, r.y + 78, w, 12, C.text, 16, 4) + 4;
  T(c, fit(c, st.official ? '政党要件：満たしている' : `政党要件：まだ（${st.reason || ''}）`, w, 12), x, y, 12, st.official ? C.good : C.warn); y += 16;
  if (subsidyExists(yearOf(g))) { T(c, fit(c, `政党交付金 年${fmtBig(st.subsidy)}・党の資金 ${fmtBig(st.funds)}`, w, 12), x, y, 12, C.dim); y += 16; }
  y += 2;
  drawIdeology(c, pt.ideology, x, y, w, pt.color);
  y += 92;
  const plat = (pt.platform || []).filter((q) => POLICIES[q]).slice(0, 3).map((q) => POLICIES[q].name);
  if (plat.length && y < r.y + r.h - 16) para(c, `主な政策${pt.real ? '（シミュレーション上の傾向）' : ''}：${plat.join('・')}`, x, y, w, 12, C.dim, 16, Math.max(1, Math.floor((r.y + r.h - 6 - y) / 16)));
}
SECTIONS.parties = async (ui) => {
  const g = ui.g;
  let idx = 0;
  for (let guard = 0; guard < 100; guard++) {
    const p = polOf(g);
    const me = p.me;
    const ids = Object.keys(p.parties).sort((a, b) => g.partyStatus(b).seats - g.partyStatus(a).seats);
    const items = ids.map((id) => {
      const st = g.partyStatus(id);
      return { label: p.parties[id].name, sub: `${p.parties[id].isPlayers ? 'あなたの党' : p.parties[id].real ? '実在' : '架空'}・支持率 ${g.partySupport(id)}%${isRuling(p, id) ? '・与党' : ''}`, right: `衆${st.shugi} 参${st.sangi}`, icon: (c, x, y) => drawPartyMark(c, g, id, x, y, 20), tag: me.party === id ? { text: '所属', color: '#2a7a4a' } : null };
    });
    items.push({ label: '新しい政党を立ち上げる', sub: '党名・色・エンブレム・政策を決める', labelColor: C.gold });
    if (me.party) items.push({ label: '離党する', sub: `${partyFull(g, me.party)}を離れて無所属に`, labelColor: C.bad });
    const i = await ui.menu({ title: '政党', listTitle: '政党の一覧', listW: 290, rowH: 36, items, index: idx,
      detail: (c, it, r, k) => {
        if (k < ids.length) { partyInfo(c, g, ids[k], r); return; }
        card(c, r.x, r.y, r.w, r.h, it.label);
        para(c, k === ids.length ? `自分の政党をつくる。結党には事務所や届出などの費用（${fmtMoney(Math.round(5000000 / priceRate(g)))}）がかかる。国会議員5人以上、または国会議員1人以上で得票率2%以上になると「政党」と認められ${subsidyExists(yearOf(g)) ? '、政党交付金を受けられる' : 'る'}。` : '党を離れると、党の組織の支えはなくなる。議員なら、議席は「無所属」に移る。党の役職も失う。', r.x + 10, r.y + 26, r.w - 20, 12, C.text, 17, 10);
      },
      tip: (it, k) => (k < ids.length ? (p.parties[ids[k]].real ? '実在の政党は、確かめられる事実だけで紹介している' : 'このゲームの架空の政党。実在の政党とは関係ない') : '政党助成法（1994年成立）で、要件を満たす政党に交付金が出る'),
    });
    if (i < 0) return;
    idx = i;
    if (i < ids.length) {
      const id = ids[i];
      const pt = p.parties[id];
      if (me.party === id) { await SECTIONS.party(ui); continue; }
      if (pt.isPlayers) { await ui.alert(pt.name, 'あなたが立ち上げた政党だ。'); continue; }
      // the fee is shown before the answer; what the core would refuse (党費が払えない・年齢) is said up front,
      // in the core's own words (joinPartyBlock: no side effects), and the core's answer is shown as it is
      const fee = partyFee(g, id);
      let block = null;
      try { block = typeof g.joinPartyBlock === 'function' ? g.joinPartyBlock(id) : null; } catch (err) { console.error(err); }
      if (block) { sfx('buzz'); await ui.alert(`${pt.name}に入党できない`, block); continue; }
      const short = num(g.state.money) < fee;
      const k = await ui.confirm({ title: `${pt.name}に入党`, danger: short, text: `${pt.name}に入党する？${me.party ? `\nいまの${partyFull(g, me.party)}は離党することになる。` : ''}\n党費：${fmtMoney(fee)}（1年分）を所持金から納める。\n所持金：${fmtMoney(g.state.money)}${short ? '（足りない）' : ''}`, choices: ['入党する', 'やめておく'], tip: '党員になると、党首選で党員票を投じられる（党による）' });
      if (k !== 0) continue;
      const before = num(g.state.money);
      const why = g.joinParty(id);
      if (why) { sfx('buzz'); await ui.alert('入党できなかった', why); } else { sfx('success'); const paid = Math.max(0, before - num(g.state.money)); await ui.alert('入党', [`${pt.name}に入党した！`, ...(paid ? [`党費 ${fmtMoney(paid)} を納めた。`] : [])], { artH: 50, draw: (c, rc) => drawPartyMark(c, g, id, rc.x + rc.w / 2 - 22, rc.y, 44) }); }
    } else if (items[i].label.startsWith('新しい')) {
      await SECTIONS.found(ui);
    } else {
      const k = await ui.confirm({ title: '離党', danger: true, text: `${partyFull(g, me.party)}を離党する？`, choices: ['離党しない', '離党する'], index: 0, cancel: 0 });
      if (k === 1) { const why = g.leaveParty(); await ui.alert('離党', why || '離党した。いまは無所属だ。'); }
    }
  }
};

// ---------------------------------------------------------------- 党を立ち上げる
const PARTY_COLORS = ['#e05a8a', '#e8833a', '#e8c030', '#7ac040', '#2fa86a', '#2fb5a3', '#3a9ad9', '#3a5ac8', '#6a4ac8', '#9a3ab9', '#c8303c', '#8a5a3a', '#5a6a7a', '#1a8a8a', '#d0507a', '#4a8a2a'];
function emblemPal(color) { return ['#ffffff', '#111318', color, '#e04050', '#f0c030', '#3a8ad8', '#3aa860', '#9a5ad8', '#ff8a3a']; }
const EMB_TOOLS = [
  ['pen', 'ペン'], ['erase', '消しゴム'], ['circle', '丸'], ['ring', '輪'], ['square', '四角'], ['triangle', '三角'], ['star', '星'], ['diamond', 'ひし形'],
  ['heart', 'ハート'], ['wave', '波'], ['sun', '太陽'], ['cross', '十字'], ['fill', '塗りつぶし'], ['mirror', '左右対称'],
];
function shapeHit(kind, dx, dy, r) {
  const d = Math.sqrt(dx * dx + dy * dy);
  switch (kind) {
    case 'circle': return d <= r + 0.3;
    case 'ring': return d <= r + 0.3 && d > r - 2.2;
    case 'square': return Math.abs(dx) <= r && Math.abs(dy) <= r;
    case 'triangle': return dy >= -r && dy <= r && Math.abs(dx) <= (dy + r) / 2 + 0.3;
    case 'diamond': return Math.abs(dx) + Math.abs(dy) <= r + 0.3;
    case 'cross': return (Math.abs(dx) <= r / 3 && Math.abs(dy) <= r) || (Math.abs(dy) <= r / 3 && Math.abs(dx) <= r);
    case 'heart': { const x = dx / (r * 0.95), y = -dy / (r * 0.95) + 0.25; return Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y <= 0; }
    case 'wave': return Math.abs(dx) <= r && Math.abs(dy - Math.sin((dx / r) * Math.PI) * r * 0.35) <= 1.3;
    case 'sun': { if (d <= r * 0.5) return true; const a = Math.atan2(dy, dx); const k = Math.abs(Math.sin(a * 4)); return d <= r && d >= r * 0.65 && k < 0.22; }
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > dy) !== (yj > dy) && dx < ((xj - xi) * (dy - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }
    default: return false;
  }
}
function newEmblem(color) {
  const px = new Array(1024).fill(0);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) px[y * 32 + x] = v; };
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const dx = x - 15.5, dy = y - 15.5; const d = Math.sqrt(dx * dx + dy * dy); if (d <= 15) set(x, y, 3); if (d <= 15 && d > 13.6) set(x, y, 1); }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (shapeHit('star', x - 15.5, y - 16, 9)) set(x, y, 1);
  return { px, color };
}
function emblemOut(st) { return { v: 1, pal: emblemPal(st.color), px: st.px.map((k) => String.fromCharCode(48 + k)).join('') }; }
function emblemView(g, st) {
  const v = {
    title: '党を立ち上げる（4/7）エンブレム', focus: 'tools', tool: 2, color: 1, size: 7, cx: 16, cy: 16, undo: [],
    rows: () => [...EMB_TOOLS.map(([id, name]) => ({ id, label: name })), { id: 'color', label: '色' }, { id: 'size', label: '大きさ' }, { id: 'undo', label: 'ひとつ戻す' }, { id: 'clear', label: '全部消す' }, { id: 'template', label: 'お手本にもどす' }, { id: 'done', label: '✔ これで決める', labelColor: C.gold }],
    hint: () => (v.focus === 'canvas' ? '十字:うごかす A:かく B:道具へ' : '↑↓ ←→:色・大きさ A:えらぶ B:もどる'),
    tip: () => 'エンブレムは32×32ドット。党の看板やポスターに使われる',
    enter() { v.lb = new ListBox({ items: v.rows, rowH: 19, index: 2 }); },
    push() { v.undo.push(st.px.slice()); if (v.undo.length > 20) v.undo.shift(); },
    apply() {
      const kind = EMB_TOOLS[v.tool] && EMB_TOOLS[v.tool][0];
      v.push();
      const set = (x, y, val) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) st.px[y * 32 + x] = val; };
      if (kind === 'pen') set(v.cx, v.cy, v.color);
      else if (kind === 'erase') set(v.cx, v.cy, 0);
      else if (kind === 'fill') {
        const from = st.px[v.cy * 32 + v.cx];
        if (from === v.color) return;
        const q = [[v.cx, v.cy]];
        for (let n = 0; q.length && n < 2000; n++) {
          const [x, y] = q.pop();
          if (x < 0 || y < 0 || x >= 32 || y >= 32 || st.px[y * 32 + x] !== from) continue;
          st.px[y * 32 + x] = v.color;
          q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      } else if (kind === 'mirror') { for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) st.px[y * 32 + 31 - x] = st.px[y * 32 + x]; }
      else for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (shapeHit(kind, x - v.cx, y - v.cy, v.size)) st.px[y * 32 + x] = v.color;
      sfx('cursor');
    },
    update(ui, inp) {
      if (v.focus === 'canvas') {
        const step = 1;
        if (inp.repeat('left')) v.cx = clamp(v.cx - step, 0, 31);
        if (inp.repeat('right')) v.cx = clamp(v.cx + step, 0, 31);
        if (inp.repeat('up')) v.cy = clamp(v.cy - step, 0, 31);
        if (inp.repeat('down')) v.cy = clamp(v.cy + step, 0, 31);
        const kind = EMB_TOOLS[v.tool] && EMB_TOOLS[v.tool][0];
        if (inp.pressed('a') || ((kind === 'pen' || kind === 'erase') && inp.down('a') && (inp.repeat('left') || inp.repeat('right') || inp.repeat('up') || inp.repeat('down')))) v.apply();
        if (inp.pressed('b')) { v.focus = 'tools'; sfx('cancel'); }
        return;
      }
      v.lb.move(inp);
      const it = v.lb.current();
      if (it.id === 'color' && (inp.repeat('left') || inp.repeat('right'))) { v.color = ((v.color - 1 + (inp.repeat('left') ? 8 : 1)) % 9) + 1; if (v.color < 1) v.color = 1; sfx('cursor'); }
      if (it.id === 'size' && (inp.repeat('left') || inp.repeat('right'))) { v.size = clamp(v.size + (inp.repeat('left') ? -1 : 1), 2, 15); sfx('cursor'); }
      if (inp.pressed('b')) { sfx('cancel'); ui.done(v, false); return; }
      if (!inp.pressed('a')) return;
      sfx('ok');
      const ti = EMB_TOOLS.findIndex(([id]) => id === it.id);
      if (ti >= 0) { v.tool = ti; if (it.id === 'mirror') { v.apply(); return; } v.focus = 'canvas'; return; }
      if (it.id === 'color') { v.color = (v.color % 9) + 1; return; }
      if (it.id === 'size') { v.size = v.size >= 13 ? 3 : v.size + 2; return; }
      if (it.id === 'undo') { if (v.undo.length) st.px = v.undo.pop(); return; }
      if (it.id === 'clear') { v.push(); st.px = new Array(1024).fill(0); return; }
      if (it.id === 'template') { v.push(); st.px = newEmblem(st.color).px; return; }
      if (it.id === 'done') ui.done(v, true);
    },
    draw(c, ui) {
      const pal = emblemPal(st.color);
      card(c, 6, 30, 170, SH - 55, '道具');
      v.lb.draw(c, 8, 51, 166, SH - 80, v.focus === 'tools', ui.t);
      // the colour and size rows get a swatch / number
      const rows = v.rows();
      const top = v.lb.topRow;
      rows.forEach((r, i) => {
        const y = 51 + (i - top) * 19;
        if (y < 51 || y > SH - 46) return;
        if (r.id === 'color') { R(c, 120, y + 3, 30, 12, '#000'); R(c, 121, y + 4, 28, 10, pal[v.color - 1]); T(c, '◀▶', 156, y + 2, 12, C.faint); }
        if (r.id === 'size') T(c, `◀ ${v.size} ▶`, 168, y + 2, 12, C.text, 'right');
        if (i === v.tool && EMB_TOOLS[i]) R(c, 160, y + 7, 5, 5, C.gold);
      });
      // canvas
      const S = 8, cx0 = 186, cy0 = 34;
      frame(c, cx0 - 3, cy0 - 3, 32 * S + 6, 32 * S + 6, null, v.focus === 'canvas' ? C.gold : C.edge);
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const k = st.px[y * 32 + x];
        R(c, cx0 + x * S, cy0 + y * S, S, S, k ? pal[k - 1] : (x + y) % 2 ? '#262e5a' : '#20284e');
      }
      // cursor + the stamp preview
      const kind = EMB_TOOLS[v.tool] && EMB_TOOLS[v.tool][0];
      if (v.focus === 'canvas') {
        if (!['pen', 'erase', 'fill', 'mirror'].includes(kind)) {
          c.globalAlpha = 0.35;
          for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (shapeHit(kind, x - v.cx, y - v.cy, v.size)) R(c, cx0 + x * S, cy0 + y * S, S, S, pal[v.color - 1]);
          c.globalAlpha = 1;
        }
        const blink = Math.floor(ui.t / 10) % 2;
        frame(c, cx0 + v.cx * S - 1, cy0 + v.cy * S - 1, S + 2, S + 2, null, blink ? '#ffffff' : '#000000');
      }
      // preview
      const px0 = 456;
      card(c, px0, 30, SW - 6 - px0, SH - 55, '見本');
      const em = emblemOut(st);
      frame(c, px0 + 14, 54, 68, 68, '#ffffff', '#20264a');
      drawEmblem(c, em, px0 + 16, 56, 64);
      drawEmblem(c, em, px0 + 94, 56, 32);
      drawEmblem(c, em, px0 + 94, 96, 16);
      R(c, px0 + 10, 132, SW - 26 - px0, 46, st.color);
      drawEmblem(c, em, px0 + 16, 139, 32);
      T(c, fit(c, st.name || '新党', SW - 80 - px0, 16), px0 + 54, 146, 16, '#ffffff', 'left', 'rgba(0,0,0,0.4)');
      para(c, v.focus === 'canvas' ? `${EMB_TOOLS[v.tool][1]}：Aで置く。Bで道具の一覧へ。` : '道具をえらんでAで絵に移る。色と大きさは←→で変える。', px0 + 10, 190, SW - 26 - px0, 12, C.dim, 16, 6);
    },
  };
  return v;
}
function ideologyView(g, st) {
  const p = polOf(g);
  const v = {
    title: '党を立ち上げる（5/7）党の考え方', row: 0,
    hint: '↑↓ ←→:うごかす A:決定 B:もどる',
    tip: () => '政策の軸に正解はない。どの層に近いかで支持の集まり方が変わる',
    update(ui, inp) {
      if (inp.repeat('up')) { v.row = (v.row + 2) % 3; sfx('cursor'); }
      if (inp.repeat('down')) { v.row = (v.row + 1) % 3; sfx('cursor'); }
      const k = AXES[v.row][0];
      if (inp.repeat('left')) { st.ideology[k] = clamp(num(st.ideology[k]) - 0.5, -2, 2); sfx('cursor'); }
      if (inp.repeat('right')) { st.ideology[k] = clamp(num(st.ideology[k]) + 0.5, -2, 2); sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.done(v, true); }
      if (inp.pressed('b')) { sfx('cancel'); ui.done(v, false); }
    },
    draw(c, ui) {
      card(c, 6, 30, 330, SH - 55, '3つの軸（←→で動かす）');
      AXES.forEach(([k, name, lo, hi], i) => {
        const y = 56 + i * 80;
        const sel = i === v.row;
        if (sel) R(c, 9, y - 6, 324, 74, C.sel);
        T(c, name, 20, y, 16, sel ? C.gold : '#ffffff');
        T(c, `${num(st.ideology[k]) > 0 ? '+' : ''}${num(st.ideology[k]).toFixed(1)}`, 320, y, 14, C.text, 'right');
        T(c, lo, 20, y + 48, 12, C.dim);
        T(c, hi, 320, y + 48, 12, C.dim, 'right');
        const bx = 24, bw = 292, by = y + 28;
        R(c, bx, by + 4, bw, 4, '#2a3262');
        for (let t2 = 0; t2 <= 8; t2++) R(c, bx + Math.round((t2 / 8) * bw), by + 1, 1, 10, t2 === 4 ? C.dim : '#3a4272');
        for (const id of Object.keys(p.parties)) { const ox = bx + Math.round(((num(p.parties[id].ideology[k]) + 2) / 4) * bw); R(c, ox - 1, by - 2, 3, 5, p.parties[id].color); }
        const vx = bx + Math.round(((num(st.ideology[k]) + 2) / 4) * bw);
        R(c, vx - 5, by - 3, 11, 18, '#05081a'); R(c, vx - 4, by - 2, 9, 16, st.color); if (sel && Math.floor(ui.t / 15) % 2) frame(c, vx - 6, by - 4, 13, 20, null, '#ffffff');
      });
      T(c, '小さな印：いまある政党の位置', 20, SH - 44, 12, C.faint);
      // which voters are close
      const x = 342, w = SW - 6 - x;
      card(c, x, 30, w, SH - 55, '近い有権者（見込み）');
      const W = segWeights(yearOf(g));
      const aff = SEGMENT_ORDER.map((s) => {
        const S = SEGMENTS[s].ideo;
        const d = Math.abs(S.econ - st.ideology.econ) + Math.abs(S.social - st.ideology.social) * 0.8 + Math.abs(S.security - st.ideology.security) * 0.6;
        return { s, a: clamp(1 - d / 4, 0, 1), w: W[s] };
      }).sort((a, b) => b.a - a.a);
      aff.forEach((q, i) => {
        const y = 52 + i * 21;
        T(c, SEGMENTS[q.s].name, x + 10, y, 12, C.text);
        hbar(c, x + 96, y + 3, w - 160, 9, q.a, mix('#ff6b78', '#5ee07a', q.a));
        T(c, `${Math.round(q.w * 100)}%`, x + w - 10, y, 12, C.faint, 'right');
      });
      const near = Object.keys(p.parties).map((id) => { const I = p.parties[id].ideology; return { id, d: Math.abs(I.econ - st.ideology.econ) + Math.abs(I.social - st.ideology.social) + Math.abs(I.security - st.ideology.security) }; }).sort((a, b) => a.d - b.d)[0];
      if (near) T(c, fit(c, `いちばん近い政党：${partyFull(g, near.id)}`, w - 20, 12), x + 10, SH - 44, 12, C.dim);
      T(c, '％＝有権者に占める割合', x + w - 10, 34, 12, C.faint, 'right');
    },
  };
  return v;
}
SECTIONS.found = async (ui) => {
  const g = ui.g;
  const p = polOf(g);
  const cost = Math.round(5000000 / priceRate(g));
  const year = yearOf(g);
  const intro = await ui.confirm({
    title: '党を立ち上げる（1/7）', w: 460,
    text: `自分の政党をつくる。\n・結党の費用 ${fmtMoney(cost)}（事務所・届出・印刷など）\n・国会議員5人以上、または1人以上で得票率2%以上で「政党」に\n・${subsidyExists(year) ? '政党になれば、政党交付金（原資は国民1人250円）が出る' : 'この時代には、まだ政党交付金の制度はない（1995年から）'}${p.me.party ? `\n・いまの${partyShort(g, p.me.party)}は離党することになる` : ''}`,
    choices: ['つくる', 'やめておく'], tip: '政党をつくるのは自由。ただし「政党」と認められるには要件がある',
  });
  if (intro !== 0) return;
  if (num(g.state.money) + num(p.me.funds) < cost) { await ui.alert('結党できない', `結党の費用 ${fmtMoney(cost)} が足りない。`); return; }
  if (ageOf(g.state) < 18) { await ui.alert('結党できない', '政党をつくるのは成人になってから。'); return; }
  const st = { name: '', short: '', color: PARTY_COLORS[0], ideology: { econ: 0, social: 0, security: 0 }, platform: [] };
  let step = 2;
  let askText = null;
  try { askText = (await import('./textinput.js')).askText; } catch (e) { askText = null; }
  for (let guard = 0; guard < 40; guard++) {
    if (step === 2) {
      const name = askText ? await askText(g, { title: '党の名前（12文字まで）', value: st.name || 'ドット未来党', max: 12 }) : st.name || 'ドット未来党';
      if (!name) return;
      st.name = String(name).trim();
      const def = st.short || st.name.replace(/党$/, '').slice(0, 4);
      const short = askText ? await askText(g, { title: '略称（4文字まで）', value: def, max: 4 }) : def;
      if (!short) continue;
      st.short = String(short).trim();
      if (Object.values(p.parties).some((x) => x.name === st.name || x.short === st.short)) { await ui.alert('名前', '同じ名前（略称）の政党がすでにある。'); continue; }
      step = 3;
    } else if (step === 3) {
      const i = await ui.open(colorView(g, st));
      if (i == null) { step = 2; continue; }
      st.color = PARTY_COLORS[i];
      if (!st.px) st.px = newEmblem(st.color).px;
      step = 4;
    } else if (step === 4) {
      const ok = await ui.open(emblemView(g, st));
      step = ok ? 5 : 3;
    } else if (step === 5) {
      const ok = await ui.open(ideologyView(g, st));
      step = ok ? 6 : 4;
    } else if (step === 6) {
      const picked = await policyStudio(ui, { mode: 'pick', picked: st.platform.slice(), max: 8, title: '党を立ち上げる（6/7）公約' });
      if (!picked) { step = 5; continue; }
      st.platform = picked;
      if (!st.platform.length) { await ui.alert('公約', '公約を1つ以上えらぼう。'); continue; }
      step = 7;
    } else if (step === 7) {
      const em = emblemOut(st);
      const k = await ui.confirm({
        title: '党を立ち上げる（7/7）結党届', w: 470, artH: 56,
        draw: (c, r) => { R(c, r.x, r.y, r.w, 48, st.color); drawEmblem(c, em, r.x + 8, r.y + 4, 40); T(c, fit(c, `${st.name}（${st.short}）`, r.w - 70, 16), r.x + 58, r.y + 14, 16, '#ffffff', 'left', 'rgba(0,0,0,0.4)'); },
        text: `公約：${st.platform.map((id) => POLICIES[id].name).slice(0, 4).join('・')}${st.platform.length > 4 ? ` ほか${st.platform.length - 4}件` : ''}\n費用 ${fmtMoney(cost)}（政治資金から先に払う）`,
        choices: ['結党する', '直す（名前から）', 'やめる'], tip: '政治団体の届出は、都道府県の選挙管理委員会や総務省に出す',
      });
      if (k === 1) { step = 2; continue; }
      if (k !== 0) return;
      const id = g.foundParty({ name: st.name, short: st.short, color: st.color, emblem: em, ideology: { ...st.ideology }, platform: st.platform.slice(), desc: `${playerName(g)}が立ち上げた政党。` });
      if (!id) { sfx('buzz'); await ui.alert('結党できなかった', g.lastPoliticsError || 'うまくいかなかった。'); if (/名|略称/.test(g.lastPoliticsError || '')) { step = 2; continue; } return; }
      sfx('fanfare');
      const ps = g.partyStatus(id);
      await ui.alert('新党結成！', [`「${st.name}」を立ち上げた！あなたが党首だ。`, ps.official ? '政党要件も満たしている。' : `政党要件はまだ（${ps.reason || ''}）。「党内」から議員に入党を呼びかけよう。`], { artH: 70, draw: (c, r) => { R(c, r.x + r.w / 2 - 34, r.y, 68, 68, '#ffffff'); drawEmblem(c, em, r.x + r.w / 2 - 32, r.y + 2, 64); } });
      return;
    }
  }
};
function colorView(g, st) {
  const v = {
    title: '党を立ち上げる（3/7）党の色', idx: Math.max(0, PARTY_COLORS.indexOf(st.color)),
    hint: '十字:えらぶ A:決定 B:もどる', tip: () => '党の色は、ポスターや議席の図、ニュースで使われる',
    update(ui, inp) {
      const n = PARTY_COLORS.length;
      if (inp.repeat('left')) { v.idx = (v.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('right')) { v.idx = (v.idx + 1) % n; sfx('cursor'); }
      if (inp.repeat('up')) { v.idx = (v.idx + n - 8) % n; sfx('cursor'); }
      if (inp.repeat('down')) { v.idx = (v.idx + 8) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.done(v, v.idx); }
      if (inp.pressed('b')) { sfx('cancel'); ui.done(v, null); }
    },
    draw(c, ui) {
      const p = polOf(g);
      card(c, 60, 40, SW - 120, 270, `${st.name}（${st.short}）の色`);
      PARTY_COLORS.forEach((col, i) => {
        const x = 88 + (i % 8) * 60, y = 74 + Math.floor(i / 8) * 64;
        frame(c, x, y, 50, 50, col, i === v.idx ? '#ffffff' : shade(col, -0.4));
        if (i === v.idx && Math.floor(ui.t / 12) % 2) frame(c, x - 3, y - 3, 56, 56, null, C.gold);
        const used = Object.values(p.parties).find((pt) => pt.color.toLowerCase() === col.toLowerCase());
        if (used) T(c, fit(c, used.short, 46, 12), x + 25, y + 52, 12, C.faint, 'center');
      });
      const col = PARTY_COLORS[v.idx];
      R(c, 88, 220, SW - 176, 70, col);
      T(c, fit(c, st.name, SW - 200, 16), SW / 2, 236, 16, '#ffffff', 'center', 'rgba(0,0,0,0.45)');
      T(c, '名前の下の文字：その色を使っている政党', SW / 2, 264, 12, '#ffffff', 'center', 'rgba(0,0,0,0.45)');
    },
  };
  return v;
}

// ================================================================ 政策をつくる (the policy studio)
const SEG_SHORT = { young: '若者', families: '子育て', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁業', unions: '労働組合', urban: '都市住民', rural: '地方住民', floating: '無党派' };
const ECO_WORDS = { growth: '成長率', inflation: '物価', unemployment: '失業率', yen: '円相場', nikkei: '株価' };
function policyStatus(g, id) {
  const p = polOf(g);
  if (p.diet.bills.some((b) => b.policy === id && !['enacted', 'rejected', 'shelved'].includes(b.stage))) return { tag: '審議中', color: '#8a6a1a' };
  const enacted = p.laws.some((l) => l.policy === id);
  const why = g.policyBlock(id);
  if (enacted && why) return { tag: '成立', color: '#2a7a4a', why };
  if (why && /時代/.test(why)) return { tag: '時代外', color: '#3a4066', why };
  if (why) return { tag: '×', color: '#5a2a34', why };
  return enacted ? { tag: '成立', color: '#2a7a4a' } : null;
}
// the ministry that brings a policy's bills in that year (as the core: 総務大臣 → 自治大臣 before 2001…)
function ministryOf(post, fy, flags) {
  let q = post;
  for (let i = 0; i < 4 && q && !POL.postExists(q, fy, flags); i++) q = (POSTS[q] && (fy < ((POSTS[q].years || [0])[0]) ? POSTS[q].pre : POSTS[q].next)) || null;
  return q && POL.postExists(q, fy, flags) ? q : 'kanbo';
}
function drawPolicyDetail(c, g, id, params, r, o = {}) {
  const pl = POLICIES[id];
  if (!pl) return;
  const p = polOf(g);
  card(c, r.x, r.y, r.w, r.h, POLICY_AREAS[pl.area].name, { right: pl.kind === 'amendment' ? '憲法改正' : pl.billKind === 'budget' ? '補正予算' : '法律', rightW: 70 });
  const x = r.x + 8, w = r.w - 16;
  let y = r.y + 22;
  y = para(c, pl.name, x, y, w, 14, '#ffffff', 17, 2);
  y = para(c, pl.desc, x, y + 1, w, 12, C.dim, 14, (pl.params || []).length ? 2 : 3) + 3;
  const pv = o.preview || g.policyPreview(id, params);
  if (!pv) return;
  (pl.params || []).forEach((d, i) => {
    const sel = o.focus === 'param' && o.pidx === i;
    if (sel) R(c, x - 3, y - 1, w + 6, 24, C.sel);
    const val = `${sel ? '◀ ' : ''}${num(pv.params[d.key], d.def).toLocaleString('ja-JP')}${d.unit}${sel ? ' ▶' : ''}`;
    const vw = measure(c, val, 12);
    T(c, fit(c, d.name, w - vw - 8, 12), x, y, 12, sel ? C.gold : C.text);
    T(c, val, x + w, y, 12, sel ? '#ffffff' : C.gold, 'right');
    // the slider: track, a tick at the default value, the knob
    const span = Math.max(1e-9, num(d.max) - num(d.min));
    const tx = x + 4, tw = w - 8, ty = y + 17;
    R(c, tx, ty, tw, 2, '#2a3262');
    R(c, tx + Math.round(((num(d.def) - num(d.min)) / span) * tw), ty - 2, 1, 6, C.faint);
    const kx = tx + Math.round(clamp((num(pv.params[d.key], d.def) - num(d.min)) / span, 0, 1) * tw);
    R(c, kx - 3, ty - 3, 7, 8, '#05081a'); R(c, kx - 2, ty - 2, 5, 6, sel ? C.gold : C.cyan);
    y += 24;
  });
  const cost = num(pv.cost);
  T(c, cost > 0 && pl.billKind === 'budget' ? `財政：${fmtCho(cost)}の追加の支出（補正予算）` : cost > 0 ? `財政：年 ${fmtCho(cost)}の支出・減収` : cost < 0 ? `財政：年 ${fmtCho(-cost)}の財源` : '財政：大きな負担はない', x, y, 12, cost > 0 ? C.warn : cost < 0 ? C.good : C.dim);
  y += 15;
  if (pl.ministry) { T(c, fit(c, `担当：${postName(ministryOf(pl.ministry, fyOf(g), p.flags), fyOf(g))}`, w, 12), x, y, 12, C.faint); y += 15; }
  // voters
  const segs = pv.segments || {};
  const W = segWeights(yearOf(g));
  T(c, '有権者の受けとめ（見込み）', x, y, 12, C.gold); y += 14;
  const half = Math.ceil(SEGMENT_ORDER.length / 2);
  const cw = Math.floor((w - 6) / 2);
  SEGMENT_ORDER.forEach((s, i) => {
    const col = i < half ? 0 : 1;
    const yy = y + (i % half) * 13;
    const xx = x + col * (cw + 6);
    const val = num(segs[s]);
    T(c, SEG_SHORT[s] || SEGMENTS[s].name, xx, yy - 1, 12, C.text);
    cbar(c, xx + 54, yy + 2, cw - 54, 8, val / 8);
  });
  y += half * 13 + 2;
  const avg = SEGMENT_ORDER.reduce((a, s) => a + W[s] * num(segs[s]), 0);
  T(c, `全体：${avg >= 0.5 ? '支持が広がりそう' : avg <= -0.5 ? '反発が強そう' : '賛否が分かれそう'}`, x, y, 12, avg >= 0.5 ? C.good : avg <= -0.5 ? C.bad : C.dim);
  y += 15;
  const eco = Object.entries(pv.economy || {}).filter(([k, v2]) => ECO_WORDS[k] && Math.abs(num(v2)) >= 0.01);
  if (eco.length && y < r.y + r.h - 30) { T(c, fit(c, `経済：${eco.map(([k, v2]) => `${ECO_WORDS[k]}${num(v2) > 0 ? '↑' : '↓'}`).join(' ')}`, w, 12), x, y, 12, C.cyan); y += 15; }
  if (y < r.y + r.h - 16) {
    const al = Object.entries(pv.alignment || {}).sort((a, b) => b[1] - a[1]);
    const yes = al.filter(([, a]) => a >= 0.62).map(([id2]) => partyShort(g, id2));
    const no = al.filter(([, a]) => a < 0.45).reverse().map(([id2]) => partyShort(g, id2));
    T(c, fit(c, `賛成しそう：${yes.join('・') || 'なし'}`, w, 12), x, y, 12, C.good);
    y += 14;
    if (!pv.block || y < r.y + r.h - 44) { T(c, fit(c, `反対しそう：${no.join('・') || 'なし'}`, w, 12), x, y, 12, '#ff9aa4'); y += 15; }
  }
  if (pv.block && y < r.y + r.h - 4) { const lines = wrapJ(c, `× ${pv.block}`, w, 12); const yy = Math.min(y, r.y + r.h - 4 - Math.min(2, lines.length) * 14); para(c, `× ${pv.block}`, x, yy, w, 12, C.bad, 14, 2); }
  void p;
}
function policyStudioView(g, o) {
  const p = polOf(g);
  const pick = o.mode === 'pick';
  const picked = new Set(o.picked || []);
  const params = {};
  let cacheKey = '', cache = null;
  const preview = (id) => { const k = id + JSON.stringify(params[id] || {}); if (k !== cacheKey) { cacheKey = k; cache = g.policyPreview(id, params[id]); } return cache; };
  const areaRows = () => {
    const rows = AREA_ORDER.map((a) => { const n = POLICY_ORDER.filter((id) => POLICIES[id].area === a); const sel = n.filter((id) => picked.has(id)).length; return { label: POLICY_AREAS[a].name, right: pick && sel ? `✔${sel}` : String(n.length), rightColor: pick && sel ? C.gold : null }; });
    if (pick) rows.push({ label: `✔ これで決める（${picked.size}件）`, labelColor: C.gold });
    return rows;
  };
  const v = {
    title: o.title || '政策をつくる', focus: 'area', pidx: 0,
    hint: () => (v.focus === 'param' ? '←→:数字を変える ↑↓ A:提出 B:もどる' : pick ? '↑↓→ A:公約に入れる・外す B:もどる' : '↑↓→ A:えらぶ B:もどる'),
    tip: () => { const pl = v.cur(); if (v.focus === 'area') return POLICY_AREAS[AREA_ORDER[v.al.idx]] ? `${POLICY_AREAS[AREA_ORDER[v.al.idx]].name}：${POLICY_AREAS[AREA_ORDER[v.al.idx]].desc}` : '公約は、選挙で有権者に示す約束'; return pl ? (pl.kind === 'amendment' ? '憲法改正は、各院の総議員の3分の2で発議し、国民投票で決まる' : '効果は見込み。成立してから、時間をかけて経済に表れる') : ''; },
    enter() {
      v.al = new ListBox({ items: areaRows, rowH: 18, index: o.area ? Math.max(0, AREA_ORDER.indexOf(o.area)) : 0 });
      v.pl = new ListBox({ items: () => v.polRows(), rowH: 26 });
    },
    pols() { const a = AREA_ORDER[v.al.idx]; return a ? POLICY_ORDER.filter((id) => POLICIES[id].area === a) : []; },
    polRows() {
      return v.pols().map((id) => {
        const st = policyStatus(g, id);
        const isPicked = picked.has(id);
        return { label: POLICIES[id].name, tag: pick ? (isPicked ? { text: '公約', color: '#8a6a1a' } : st && st.tag === '時代外' ? { text: '時代外', color: st.color } : null) : st ? { text: st.tag, color: st.color } : null, labelColor: isPicked ? C.gold : st && (st.tag === '時代外' || st.tag === '×') ? C.faint : null };
      });
    },
    cur() { if (v.focus === 'area') return null; const id = v.pols()[v.pl.idx]; return id ? POLICIES[id] : null; },
    update(ui, inp) {
      if (v.focus === 'area') {
        if (v.al.move(inp)) v.pl.idx = 0;
        const isDone = pick && v.al.idx === AREA_ORDER.length;
        if (inp.pressed('a') && isDone) { sfx('ok'); ui.done(v, [...picked]); return; }
        if ((inp.pressed('right') || inp.pressed('a')) && !isDone) { v.focus = 'pol'; sfx('cursor'); return; }
        if (inp.pressed('b')) { sfx('cancel'); ui.done(v, pick ? null : undefined); }
        return;
      }
      const id = v.pols()[v.pl.idx];
      const pl = POLICIES[id];
      if (v.focus === 'param') {
        const ps = pl.params || [];
        if (!ps.length) { v.focus = 'pol'; return; }
        if (inp.repeat('up')) { v.pidx = (v.pidx + ps.length - 1) % ps.length; sfx('cursor'); }
        if (inp.repeat('down')) { v.pidx = (v.pidx + 1) % ps.length; sfx('cursor'); }
        const d = ps[clamp(v.pidx, 0, ps.length - 1)];
        const cur = params[id] || (params[id] = { ...pl.defaults });
        if (inp.repeat('left')) { cur[d.key] = clamp(num(cur[d.key], d.def) - (d.step || 1), d.min, d.max); sfx('cursor'); }
        if (inp.repeat('right')) { cur[d.key] = clamp(num(cur[d.key], d.def) + (d.step || 1), d.min, d.max); sfx('cursor'); }
        if (inp.pressed('b')) { v.focus = 'pol'; sfx('cancel'); return; }
        if (inp.pressed('a') && !pick) { sfx('ok'); ui.act(() => submitPolicy(ui, id, params[id])); }
        return;
      }
      v.pl.move(inp);
      if (inp.pressed('left') || inp.pressed('b')) { v.focus = 'area'; sfx('cancel'); return; }
      if (inp.pressed('right') && pl && pl.params && !pick) { v.focus = 'param'; v.pidx = 0; sfx('cursor'); return; }
      if (inp.pressed('a') && id) {
        if (pick) {
          if (picked.has(id)) { picked.delete(id); sfx('cancel'); return; }
          const st = policyStatus(g, id);
          if (st && st.tag === '時代外') { sfx('buzz'); ui.toast('いまの時代には取り上げられない政策', C.dim); return; }
          if (picked.size >= (o.max || 8)) { sfx('buzz'); ui.toast(`公約は${o.max || 8}つまで`, C.dim); return; }
          picked.add(id); sfx('ok');
          return;
        }
        sfx('ok');
        if (pl.params) { v.focus = 'param'; v.pidx = 0; return; }
        ui.act(() => submitPolicy(ui, id, null));
      }
    },
    draw(c, ui) {
      card(c, 6, 30, 150, SH - 55, '分野', { edge: v.focus === 'area' ? C.gold : C.edge });
      v.al.draw(c, 8, 50, 146, SH - 78, v.focus === 'area', ui.t);
      card(c, 160, 30, 214, SH - 55, pick ? `公約 ${picked.size}/${o.max || 8}` : '政策', { edge: v.focus !== 'area' ? C.gold : C.edge });
      v.pl.draw(c, 162, 50, 210, SH - 78, v.focus !== 'area', ui.t);
      const id = v.pols()[v.pl.idx];
      const r = { x: 378, y: 30, w: SW - 6 - 378, h: SH - 55 };
      if (pick && v.al.idx === AREA_ORDER.length) {
        card(c, r.x, r.y, r.w, r.h, '選んだ公約');
        [...picked].forEach((pid, i) => T(c, fit(c, `・${POLICIES[pid].name}`, r.w - 20, 12), r.x + 10, r.y + 26 + i * 16, 12, C.text));
        if (!picked.size) para(c, 'まだ何も選んでいない。分野から政策を選んで、Aで公約に入れる。', r.x + 10, r.y + 26, r.w - 20, 12, C.dim);
        return;
      }
      if (id) drawPolicyDetail(c, g, id, params[id], r, { focus: v.focus, pidx: v.pidx, preview: preview(id) });
      void p;
    },
  };
  return v;
}
async function policyStudio(ui, o = {}) { return ui.open(policyStudioView(ui.g, o)); }
async function submitPolicy(ui, id, params) {
  const g = ui.g;
  const p = polOf(g);
  const me = p.me;
  const pl = POLICIES[id];
  const why = g.policyBlock(id, params || undefined);
  if (why) { sfx('buzz'); await ui.alert(pl.name, `いまは出せない：${why}`); return; }
  if (!isNational(me) && !inCabinet(me)) { await ui.alert('法律案を出すには', ['法律案を国会に出せるのは、国会議員か内閣（大臣）だけ。', 'いまは政策を研究しておこう。国会議員になるには「選挙」から。']); return; }
  if (pl.kind === 'amendment' && !isNational(me)) { await ui.alert('憲法改正', '憲法改正の原案は、国会議員が提出する。'); return; }
  const cabinet = inCabinet(me) && pl.kind !== 'amendment';
  const pv = g.policyPreview(id, params || undefined);
  // a 補正予算 (the stimulus: policyPreview billKind 'budget'): only the cabinet sends a budget to the Diet
  const budget = pv && pv.billKind === 'budget';
  if (budget && !cabinet) { sfx('buzz'); await ui.alert(pv.title || pl.name, ['補正予算案を国会に出せるのは内閣だけ（憲法73条・86条）。', '大臣か総理大臣として、閣議に出そう。']); return; }
  const house = me.office === 'sangi' ? '参議院' : '衆議院';
  const need = pl.kind === 'amendment' ? (me.office === 'shugi' ? 100 : 50) : me.office === 'shugi' ? (num(pv.cost) > 0 ? 50 : 20) : (num(pv.cost) > 0 ? 20 : 10);
  const k = await ui.confirm({
    title: budget ? '補正予算案を閣議決定' : cabinet ? '閣法として閣議決定' : pl.kind === 'amendment' ? '憲法改正原案を提出' : '議員立法として提出', w: 470,
    text: `「${budget && pv.title ? pv.title : pl.name}」\n${budget ? `内閣が閣議決定して${p.diet.session ? '国会に提出する' : '次の国会に提出する'}。\n予算は衆議院が先に審議する（憲法60条）。` : cabinet ? `内閣が閣議決定して${p.diet.session ? '国会に提出する' : '次の国会に提出する'}。与党の賛成が見込める。` : `${house}に提出するには、賛成者が${need}人以上必要（国会法56条）。${me.party ? '党の了承も大切。' : ''}`}\n財政：${budget ? `${fmtCho(pv.cost)}の追加の支出（この年度）` : num(pv.cost) > 0 ? `年${fmtCho(pv.cost)}` : num(pv.cost) < 0 ? `年${fmtCho(-pv.cost)}の財源` : '影響は小さい'}`,
    choices: ['提出する', 'やめておく'], tip: budget ? '補正予算は、年度の途中で予算を追加・変更するときに組む' : cabinet ? '閣法は、各省庁がまとめ、内閣法制局の審査と閣議決定を経て出す' : '議員立法は、議員が自分で法律案をつくって出す',
  });
  if (k !== 0) return;
  const bid = g.proposeBill({ policy: id, params: params || undefined });
  if (!bid) { sfx('buzz'); await ui.alert('提出できなかった', g.lastPoliticsError || 'うまくいかなかった。'); return; }
  const b = p.diet.bills.find((x) => x.id === bid);
  sfx('success');
  if (b.stage === 'draft' && !b.ready) {
    await ui.alert('法案をまとめた', [`「${b.title}」`, `賛成者 ${b.supporters}/${b.need}人。「法案」の画面から、議員に声をかけて賛成者を集めよう（1日1回）。${b.partyApproved === false ? '\n党の了承はまだ得られていない。' : ''}`]);
  } else if (b.stage === 'draft') await ui.alert('法案をまとめた', [`「${b.title}」`, '次の国会が開かれたら提出される。']);
  else await ui.alert('国会に提出した', [`「${b.title}」`, '委員会で審議が始まる。本会議の採決は、毎朝の国会の動きで進む。']);
}
SECTIONS.policy = (ui, o = {}) => policyStudio(ui, { area: o.area });

// ---------------------------------------------------------------- 法案（bill tracker）
const STAGE_WORD = { draft: '準備中', committee: '委員会', shugi: '衆・本会議', sangi: '参・本会議', referendum: '国民投票', enacted: '成立', rejected: '否決', shelved: '廃案' };
function billStages(b) {
  const h1 = b.first || (b.kind === 'noconfidence' ? 'shugi' : b.house);
  const h2 = h1 === 'shugi' ? 'sangi' : 'shugi';
  const hn = (h) => (h === 'shugi' ? '衆' : '参');
  const hl = (h) => (h === 'shugi' ? '衆議院' : '参議院');
  if (b.kind === 'noconfidence') return { list: ['提出', '衆議院\n本会議', b.result || '採決'], cur: b.stage === 'shugi' ? 1 : 2, h1, h2 };
  const list = ['提出', `${hl(h1)}\n委員会`, `${hl(h1)}\n本会議`, `${hl(h2)}\n委員会`, `${hl(h2)}\n本会議`, b.kind === 'amendment' ? '国民\n投票' : '成立'];
  void hn;
  let cur = 0;
  if (b.stage === 'draft') cur = 0;
  else if (!b.first) cur = b.stage === 'committee' ? 1 : 2;
  else if (b.revote) cur = 4;
  else cur = b.stage === 'committee' ? 3 : b.stage === 'referendum' ? 5 : 4;
  if (b.stage === 'enacted') cur = 6;
  if (['rejected', 'shelved'].includes(b.stage)) {
    // where it stopped: the last house that voted, or the committee it was waiting in
    const hk = (h) => (h === 'shugi' ? '衆院' : '参院');
    const com = (h) => (b.log || []).some((l) => String(l.text).includes(`${hk(h)}の委員会`));
    if (b.revote) cur = 4;
    else if (!b.first) cur = b.votes[h1] || com(h1) ? 2 : 1;
    else cur = b.votes[h2] || com(h2) ? 4 : 3;
  }
  return { list, cur, h1, h2 };
}
function drawBillDetail(c, g, b, r) {
  const p = polOf(g);
  if (!b) { card(c, r.x, r.y, r.w, r.h, '法案'); para(c, '審議中の法案はない。', r.x + 10, r.y + 26, r.w - 20, 12, C.dim); return; }
  paper(c, r.x, r.y, r.w, r.h);
  const ink = C.ink, x = r.x + 12, w = r.w - 24;
  T(c, b.kind === 'budget' ? (b.policy ? '補正予算案（内閣が提出）' : '予算案（内閣が提出）') : b.kind === 'noconfidence' ? '決議案' : b.kind === 'amendment' ? '憲法改正原案' : b.sponsor === 'cabinet' ? '内閣提出法律案（閣法）' : '議員提出法律案（議員立法）', x, r.y + 8, 12, C.inkDim);
  let y = para(c, b.title, x, r.y + 24, w, 14, ink, 18, 2) + 2;
  T(c, fit(c, `提出：${b.by === 'player' ? playerName(g) : whoName(g, b.by)}（${partyShort(g, b.party)}）・${dateLabel(g, b.created)}`, w, 12), x, y, 12, C.inkDim); y += 18;
  // the pipeline
  const S = billStages(b);
  const n = S.list.length;
  const bw = Math.floor((w - (n - 1) * 6) / n);
  const failed = ['rejected', 'shelved'].includes(b.stage);
  S.list.forEach((s, i) => {
    const bx = x + i * (bw + 6);
    const done = i < S.cur || b.stage === 'enacted';
    const cur = i === S.cur && !done;
    const col = done ? '#3aa860' : cur ? (failed ? '#c83a3a' : Math.floor(Date.now() / 400) % 2 ? '#e8b030' : '#c89020') : '#d8d0b8';
    frame(c, bx, y, bw, 30, col, shade(col, -0.35));
    String(s).split('\n').forEach((ln, li) => T(c, fit(c, ln, bw - 4, 12), bx + bw / 2, y + 2 + li * 13, 12, done || cur ? '#ffffff' : C.inkDim, 'center'));
    if (i < n - 1) R(c, bx + bw + 1, y + 14, 4, 2, C.inkDim);
    // plenary votes
    const key = i === 2 ? S.h1 : i === 4 ? (b.revote || b.votes[`${S.h2}`] ? S.h2 : null) : null;
    const vt = key && b.votes[key];
    if (vt) T(c, `${vt.yes}対${vt.no}`, bx + bw / 2, y + 32, 12, vt.passed ? '#2a7a3a' : C.stamp, 'center');
  });
  y += 50;
  if (failed) { T(c, `結果：${b.result || STAGE_WORD[b.stage]}`, x, y, 14, C.stamp); y += 20; }
  else if (b.stage === 'enacted') { T(c, '成立', x, y, 14, '#2a7a3a'); y += 20; }
  if (b.stage === 'draft' && b.by === 'player') { T(c, `賛成者 ${b.supporters}/${b.need}人${b.ready ? '（提出の準備ずみ）' : ''}`, x, y, 12, b.ready ? '#2a7a3a' : C.stamp); y += 16; }
  if (b.votes && b.votes.referendum) { T(c, `国民投票：賛成 ${b.votes.referendum.yes}%`, x, y, 12, ink); y += 16; }
  const mv = p.me.votes[b.id];
  if (mv) { T(c, `あなたの票：${{ yes: '賛成', no: '反対', abstain: '棄権' }[mv]}`, x, y, 12, '#3a5ac8'); y += 16; }
  T(c, '経過', x, y, 12, C.inkDim); y += 15;
  // (a budget is not a 閣法: the core's log line for a cabinet bill says so)
  (b.log || []).slice(-6).reverse().forEach((l) => { if (y > r.y + r.h - 16) return; const t = b.kind === 'budget' ? String(l.text).replace('（閣法）', '') : l.text; T(c, fit(c, `${dateLabel(g, l.day).replace(/^\d+年/, '')} ${t}`, w, 12), x, y, 12, ink); y += 15; });
}
function partyLine(g, b) {
  const p = polOf(g);
  const me = p.me;
  if (!me.party) return null;
  if (b.kind === 'budget') return isRuling(p, me.party) ? 'yes' : 'no';
  if (b.kind === 'noconfidence') return isRuling(p, me.party) ? 'no' : 'yes';
  if (b.party === me.party) return 'yes';
  let al = 0.5;
  try { al = num((g.policyPreview(b.policy, b.params) || {}).alignment[me.party], 0.5); } catch (e) { al = 0.5; }
  if (b.sponsor === 'cabinet') return isRuling(p, me.party) ? 'yes' : al >= 0.62 ? 'yes' : 'no';
  return al >= 0.55 ? 'yes' : 'no';
}
SECTIONS.bills = async (ui) => {
  const g = ui.g;
  let idx = 0;
  for (let guard = 0; guard < 200; guard++) {
    const p = polOf(g);
    const me = p.me;
    const bills = p.diet.bills.slice().sort((a, b) => (b.by === 'player') - (a.by === 'player') || (['enacted', 'rejected', 'shelved'].includes(a.stage) - ['enacted', 'rejected', 'shelved'].includes(b.stage)) || b.created - a.created);
    const items = bills.map((b) => ({
      label: `${b.by === 'player' ? '★' : ''}${b.title}`,
      sub: `${b.kind === 'budget' ? (b.policy ? '補正予算' : '予算') : b.kind === 'noconfidence' ? '不信任' : b.kind === 'amendment' ? '憲法' : b.sponsor === 'cabinet' ? '閣法' : '議員立法'}・${partyShort(g, b.party)}${me.votes[b.id] ? `・あなた：${{ yes: '賛成', no: '反対', abstain: '棄権' }[me.votes[b.id]]}` : ''}`,
      tag: { text: STAGE_WORD[b.stage] || b.stage, color: b.stage === 'enacted' ? '#2a7a4a' : ['rejected', 'shelved'].includes(b.stage) ? '#6a2a34' : '#3a4a8a' },
      labelColor: b.by === 'player' ? C.gold : null,
    }));
    const S = p.diet.session;
    const i = await ui.menu({ title: '法案', listTitle: S ? `${S.kind}（${dateLabel(g, S.end).replace(/^\d+年/, '')}まで）` : '国会は閉会中', listW: 300, rowH: 36, items, index: idx, empty: '国会に出ている法案はない',
      detail: (c, it, r, k) => drawBillDetail(c, g, bills[k], r),
      tip: (it, k) => { const b = bills[k]; if (!b) return '法律案は委員会で審査され、本会議で採決される'; if (b.kind === 'budget') return '予算は衆議院が先に審議する。参院が30日以内に議決しないと成立'; if (b.stage === 'draft') return '議員立法の提出には、一定数の議員の賛成者が必要'; return '会期中に成立しない法案は、原則として廃案になる（継続審議もある）'; },
    });
    if (i < 0) return;
    idx = i;
    const b = bills[i];
    if (!b) continue;
    const pending = !['enacted', 'rejected', 'shelved'].includes(b.stage);
    const myHouse = isNational(me) && (b.kind === 'noconfidence' ? me.office === 'shugi' : true);
    const acts = [];
    if (b.by === 'player' && b.stage === 'draft' && !b.ready) acts.push(['gather', '賛成者を集める（体力8）']);
    if (pending && myHouse && b.stage !== 'draft' && b.stage !== 'referendum') { acts.push(['yes', '賛成で投票する']); acts.push(['no', '反対で投票する']); acts.push(['abstain', '棄権する']); }
    const vkeys = Object.keys(b.votes || {});
    if (vkeys.length) acts.push(['replay', '採決のようすを見る']);
    acts.push(['back', 'もどる']);
    const line = partyLine(g, b);
    const j = await ui.confirm({ title: fit(ui.g.ctx, b.title, 340, 14), text: `${STAGE_WORD[b.stage] || ''}${line && myHouse && pending ? `\n党の方針：${line === 'yes' ? '賛成' : '反対'}（逆らうと党内の評価が下がる＝党議拘束）` : ''}`, choices: acts.map((a) => a[1]), tip: '採決は、その日の本会議で行われる（毎朝の国会の動き）' });
    const a = acts[j] && acts[j][0];
    if (!a || a === 'back') continue;
    if (a === 'gather') {
      const r = g.gatherSupporters(b.id);
      if (!r.ok) { sfx('buzz'); await ui.alert('賛成者', r.why); continue; }
      sfx('good');
      await ui.alert('賛成者を集めた', [`新たに${r.added}人が賛成者に名を連ねた（${r.supporters}/${r.need}人）。`, r.ready ? (b.stage === 'draft' ? '準備ができた！次の国会で提出される。' : '国会に提出した！') : 'まだ足りない。また明日、声をかけよう。']);
    } else if (a === 'replay') {
      await SECTIONS.vote(ui, { billId: b.id, house: vkeys[vkeys.length - 1] });
    } else {
      const why = g.vote(b.id, a);
      if (why) await ui.alert('投票', why);
      else ui.toast(`「${{ yes: '賛成', no: '反対', abstain: '棄権' }[a]}」で投票する（採決の日に投じられる）`, C.good);
    }
  }
};

// ================================================================ 国会
function dietView(g) {
  const cmds = () => {
    const p = polOf(g);
    const me = p.me;
    const S = p.diet.session;
    return [
      { id: 'attend', label: '国会に出席する', disabled: !isNational(me) || !S, why: !isNational(me) ? '国会議員ではない' : '国会は閉会中', sub: (() => { const A = typeof g.attendance === 'function' ? g.attendance() : null; return A && A.member && A.session ? A.text : me.attend && me.attend.last === today(g) ? '今日は出席ずみ' : '体力5・欠席が続くと批判される'; })() },
      { id: 'bills', label: '法案の一覧・採決', sub: `審議中 ${g.billsList({ pending: true }).length}本` },
      { id: 'policy', label: '政策をつくる・法案を出す', sub: isNational(me) || inCabinet(me) ? '議員立法・閣法' : '研究だけ（提出は議員から）' },
      // (2026-10 fix) the cabinet answers in the committees (国会で答弁); the no-confidence motion is the opposition's
      inCabinet(me)
        ? { id: 'answer', label: '国会で答弁する', disabled: !S, why: '国会は閉会中', sub: '大臣として質問に答える・失言に注意' }
        : { id: 'question', label: '委員会で質問する', disabled: !isNational(me) || !S, why: '国会議員が会期中にできる', sub: 'トークの力しだい・体力12' },
      (() => { const why = typeof g.noConfidenceBlock === 'function' ? g.noConfidenceBlock({}) : me.office !== 'shugi' || !S ? '衆議院議員が会期中に出せる' : null; return { id: 'nc', label: '内閣不信任案を出す', disabled: !!why, why, sub: why ? `出せない：${why}` : '賛成者50人・可決なら解散か総辞職' }; })(),
      { id: 'amend', label: '憲法改正', sub: '発議と国民投票のしくみ' },
    ];
  };
  const v = {
    title: '国会', hint: '↑↓ A:けってい B:もどる',
    tip: () => ({ answer: '総理や大臣は、本会議や委員会で議員の質問に答える（答弁）。国会への出席として記録される', attend: '本会議や委員会に出るのが議員の基本。出席は記録に残る', bills: '法律は衆参両院で可決して成立。衆院は出席議員の3分の2で再可決できる', policy: '法律案には、内閣が出す「閣法」と、議員が出す「議員立法」がある', question: '委員会では、議員が大臣や役所に質問して政策を問いただす', nc: '内閣不信任決議は衆議院だけ。参議院の問責決議に法的な拘束力はない', amend: '憲法改正は、各院の総議員の3分の2で発議し、国民投票の過半数で成立' }[(v.lb.current() || {}).id] || ''),
    enter() { v.lb = new ListBox({ items: cmds, rowH: 34 }); },
    update(ui, inp) {
      v.lb.move(inp);
      if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); return; }
      if (!inp.pressed('a')) return;
      const it = v.lb.current();
      if (it.disabled) { sfx('buzz'); ui.toast(it.why, C.dim); return; }
      sfx('ok');
      ui.act(() => dietCommand(ui, g, it.id));
    },
    draw(c, ui) {
      const p = polOf(g);
      const S = p.diet.session;
      card(c, 6, 30, 252, SH - 55, S ? `${S.kind}：${dateLabel(g, S.end).replace(/^\d+年/, '')}まで` : p.diet.shugi.dissolved ? '衆議院は解散中' : '国会は閉会中', { accent: S ? C.good : C.dim });
      v.lb.draw(c, 8, 51, 248, SH - 80, true, ui.t);
      const x = 262, w = SW - 6 - x;
      for (const [k, house, name] of [[0, 'shugi', '衆議院'], [1, 'sangi', '参議院']]) {
        const y = 30 + k * 154, h = 150;
        const H = p.diet[house];
        const gs = seatGroups(p, house);
        const ruling = gs.filter((q) => q.ruling).reduce((a, q) => a + q.n, 0);
        card(c, x, y, w, h, `${name} ${H.total}議席`, { right: `与党 ${ruling}／過半数 ${Math.floor(H.total / 2) + 1}`, rightColor: ruling > H.total / 2 ? C.good : C.bad, rightW: 150 });
        drawHemi(c, x + 110, y + h - 22, 96, gs);
        gs.slice().sort((a, b) => b.n - a.n).slice(0, 6).forEach((q, i) => {
          const ly = y + 24 + i * 17;
          R(c, x + 224, ly + 2, 4, 12, q.color);
          T(c, fit(c, partyShort(g, q.id), 76, 12), x + 232, ly, 12, q.ruling ? '#ffffff' : C.dim);
          T(c, String(q.n), x + w - 10, ly, 12, q.ruling ? C.gold : C.text, 'right');
        });
        if (house === 'shugi') T(c, H.system === 'chusenkyoku' ? '中選挙区制' : '小選挙区比例代表並立制', x + 110, y + h - 17, 12, C.faint, 'center');
        else if (p.flags.nejire) { const pw = measure(c, 'ねじれ国会', 12) + 8; pill(c, x + 110 - pw / 2, y + h - 19, 'ねじれ国会', C.bad); }
      }
    },
  };
  return v;
}
// a sitting with nothing on the plenary's agenda: the bills still in committee (or a quiet day)
function attendQuiet(g) {
  const p = polOf(g);
  const pend = (g.billsList({ house: p.me.office, pending: true }) || []).filter((b) => b.stage === 'committee' || b.stage === 'draft');
  const any = pend.length ? pend : (g.billsList({ pending: true }) || []);
  return any.length ? `今日の本会議に採決はなく、委員会で${billShort(any[0].title)}${any.length > 1 ? `など${any.length}本` : ''}を審議した。` : '今日は大きな採決はなく、委員会で質疑が続いた。';
}
// 「○○に関する法律案」→「○○」の法案 (a whole title, not cut in the middle)
function billShort(t) {
  const s = String(t || '');
  const m = s.match(/^(.*)に関する法律案$/);
  return m ? `「${m[1]}」の法案` : `「${s}」`;
}
async function dietCommand(ui, g, id) {
  const p = polOf(g);
  if (id === 'attend') {
    const r = g.attendDiet();
    if (!r.ok) { ui.toast(r.why, C.dim); return; }
    sfx('good');
    const bills = r.bills || [];
    await ui.alert('国会に出席', [`${p.me.office === 'sangi' ? '参議院' : '衆議院'}の本会議と委員会に出席した。`, bills.length ? `今日の審議：${bills.slice(0, 2).map((b) => billShort(b.title)).join('・')}${bills.length > 2 ? `ほか${bills.length - 2}本` : ''}` : attendQuiet(g), '党内の評価が少し上がった。']);
  } else if (id === 'bills') await SECTIONS.bills(ui);
  else if (id === 'policy') await SECTIONS.policy(ui);
  else if (id === 'question' || id === 'answer') {
    const kind = id === 'answer' ? '国会で答弁' : '委員会で質問';
    const r = g.activity(kind);
    if (!r.ok) { ui.toast(r.why, C.dim); return; }
    sfx(r.gaffe ? 'buzz' : 'good');
    await ui.alert(kind, r.text.split('\n'));
  } else if (id === 'nc') {
    const k = await ui.confirm({ title: '内閣不信任決議案', w: 460, text: '内閣不信任決議案を提出する？\n可決されれば、内閣は10日以内に衆議院を解散するか総辞職しなければならない（憲法69条）。', choices: ['提出する', 'やめておく'], tip: '不信任決議は、衆議院が内閣を信任しないという意思を示すもの' });
    if (k !== 0) return;
    const r = g.noConfidence({});
    if (!r.ok) { await ui.alert('提出できない', r.why); return; }
    await SECTIONS.vote(ui, { billId: r.billId, house: 'shugi' });
    await ui.alert('採決の結果', r.passed ? ['内閣不信任決議案は可決された！', r.outcome === 'dissolve' ? '内閣は衆議院を解散した。総選挙だ。' : r.outcome === 'pending' ? '解散か総辞職かを決めなければならない。' : '内閣は総辞職へ。'] : [`否決された（賛成${r.yes}・反対${r.no}）。`]);
  } else if (id === 'amend') await SECTIONS.amendment(ui);
}
SECTIONS.diet = (ui) => ui.open(dietView(ui.g));

// ================================================================ 内閣
function cabinetCmds(g) {
  const p = polOf(g);
  const me = p.me;
  const pm = p.cabinet.pm === 'player';
  const pt = p.parties[me.party];
  const out = [];
  if (me.offers.some((o) => !o.answered)) out.push({ id: 'offer', label: '打診への返事', labelColor: C.gold, sub: '入閣・党役員の打診が来ている' });
  if (pm) {
    out.push({ id: 'formation', label: '組閣・内閣改造', sub: '大臣を任命する' });
    out.push({ id: 'coalition', label: '連立協議', sub: '与党の枠組みを決める' });
    out.push({ id: 'budget', label: '予算編成', sub: '分野ごとの配分' });
    out.push({ id: 'dissolve', label: '衆議院を解散する', sub: '総選挙で信を問う', labelColor: '#ffb0b8' });
    out.push({ id: 'resign', label: '内閣総辞職', sub: '総理をやめる', labelColor: '#ffb0b8' });
    out.push({ id: 'trip', label: '外遊（首脳会談）', sub: '体力20・知名度と支持率' });
  } else if (inCabinet(me)) {
    out.push({ id: 'kakugi', label: '閣議に出る', sub: '体力3' });
    out.push({ id: 'answer', label: '国会で答弁する', sub: '会期中・失言に注意' });
    if (me.posts.includes('minister_finance')) out.push({ id: 'budget', label: '予算編成', sub: `${postName('minister_finance', fyOf(g))}として` });
    out.push({ id: 'quit', label: '大臣を辞める', labelColor: '#ffb0b8' });
  }
  if (pt && pt.leader === 'player' && !pm) {
    out.push(isRuling(p, pt.id) ? { id: 'leave', label: '連立から離れる', sub: '与党を抜けて野党に' } : { id: 'join', label: '連立に加わる', sub: '与党の一員になる' });
    out.push({ id: 'stance', label: '首班指名での方針', sub: { auto: 'おまかせ', accept: '連立に前向き', refuse: '連立しない' }[me.coalitionStance || 'auto'] });
  }
  out.push({ id: 'amend', label: '憲法改正', sub: '発議と国民投票' });
  out.push({ id: 'chart', label: '支持率の推移', sub: '内閣と政党の支持率' });
  return out;
}
function cabinetView(g) {
  const v = {
    title: '内閣', focus: 'cmd',
    hint: () => (v.focus === 'list' ? '↑↓ ←:もどす B:もどる' : '↑↓ →:閣僚名簿 A:けってい B:もどる'),
    tip: () => (v.focus === 'list' ? '国務大臣の過半数は、国会議員から選ばれる（憲法68条）' : ({ formation: '総理大臣は国務大臣を任命し、いつでも罷免できる（憲法68条）', coalition: '1つの党で過半数に届かないとき、複数の党で連立政権をつくる', budget: '予算は内閣がつくり、国会の議決で成立する（衆議院が先に審議）', dissolve: '衆議院の解散は、内閣の助言と承認による天皇の国事行為（憲法7条）', resign: '総辞職すると、国会で新しい総理大臣が指名される', amend: '憲法改正原案は、国会議員が提出する（国会法68条の2）', chart: '内閣支持率は、新聞社やテレビ局の世論調査で毎月のように測られる' }[(v.lb.current() || {}).id] || '内閣は、総理大臣と国務大臣でつくる')),
    sum: null, sumT: -99,
    summary(ui) { if (!v.sum || !ui || ui.t - v.sumT > 15) { v.sum = g.politicsSummary(); v.sumT = ui ? ui.t : 0; } return v.sum; },
    enter(ui) {
      v.lb = new ListBox({ items: () => cabinetCmds(g), rowH: 32 });
      v.ml = new ListBox({ items: () => v.summary(ui).cabinet.ministers.map((m) => ({ post: m.post, name: m.name, who: m.who })), rowH: 16, drawRow: (c, it, x, y, w, rh, sel) => {
        const p = polOf(g);
        const n = p.npcs[it.who];
        T(c, fit(c, it.name, 134, 12), x + 6, y + 1, 12, sel ? '#ffffff' : C.dim);
        const nm = it.who === 'player' ? playerName(g) : n ? n.name : '（空席）';
        R(c, x + 144, y + 3, 3, 10, n && n.civilian ? '#ffffff' : partyColor(p, it.who === 'player' ? p.me.party : n && n.party));
        T(c, fit(c, nm, w - 160, 12), x + 151, y + 1, 12, it.who === 'player' ? C.gold : '#ffffff');
        if (n && n.civilian) T(c, '民間', x + w - 4, y + 1, 12, C.cyan, 'right');
      } });
    },
    update(ui, inp) {
      if (v.focus === 'list') {
        v.ml.move(inp);
        if (inp.pressed('left') || inp.pressed('b')) { v.focus = 'cmd'; sfx('cancel'); }
        return;
      }
      v.lb.move(inp);
      if (inp.pressed('right')) { v.focus = 'list'; sfx('cursor'); return; }
      if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); return; }
      if (inp.pressed('a')) { const it = v.lb.current(); if (!it) return; sfx('ok'); ui.act(async () => { await cabinetCommand(ui, g, it.id); v.sum = null; }); }
    },
    draw(c, ui) {
      const p = polOf(g);
      const s = v.summary(ui);
      const C2 = s.cabinet;
      card(c, 6, 30, 300, 112, `${C2.pm === 'player' ? playerName(g) : C2.pmName} 内閣`, { right: `発足 ${dateLabel(g, C2.formed).replace(/上旬|中旬|下旬/, '')}`, rightW: 120 });
      R(c, 13, 52, 54, 42, '#0c1230');
      drawFaceHD(c, lookOf(g, p, C2.pm), 14, 53, 1.6);
      T(c, `${postName('pm', fyOf(g))}`, 74, 52, 12, C.dim);
      T(c, fit(c, C2.pm === 'player' ? playerName(g) : C2.pmName, 140, 14), 74, 66, 14, '#ffffff');
      let cx = 74;
      for (const id of C2.partyIds.slice(0, 4)) cx += partyChip(c, g, id, cx, 84) + 4;
      T(c, '支持率', 230, 52, 12, C.dim);
      T(c, `${C2.approval}%`, 298, 64, 16, C2.approval >= 50 ? C.good : C2.approval >= 30 ? C.gold : C.bad, 'right');
      spark(c, p.polls.slice(-30).map((q) => q.approval), 12, 104, 288, 32, C2.approval >= 30 ? C.good : C.bad, { min: 0, max: 80, ref: 30, fill: true });
      card(c, 6, 146, 300, SH - 171, 'できること', { edge: v.focus === 'cmd' ? C.gold : C.edge });
      v.lb.draw(c, 8, 167, 296, SH - 196, v.focus === 'cmd', ui.t);
      card(c, 310, 30, SW - 316, SH - 55, '閣僚名簿', { right: `${C2.ministers.length + 1}人`, rightW: 50, edge: v.focus === 'list' ? C.gold : C.edge });
      T(c, fit(c, postName('pm', fyOf(g)), 134, 12), 316, 50, 12, C.gold);
      T(c, fit(c, C2.pm === 'player' ? playerName(g) : C2.pmName, SW - 480, 12), 467, 50, 12, '#ffffff');
      v.ml.draw(c, 312, 66, SW - 320, SH - 92, v.focus === 'list', ui.t);
    },
  };
  return v;
}
async function cabinetCommand(ui, g, id) {
  const p = polOf(g);
  if (id === 'offer') { const o = p.me.offers.find((x) => !x.answered); if (o) await offerFlow(ui, o); }
  else if (id === 'formation') await SECTIONS.formation(ui);
  else if (id === 'coalition') await SECTIONS.coalition(ui);
  else if (id === 'budget') await SECTIONS.budget(ui);
  else if (id === 'amend') await SECTIONS.amendment(ui);
  else if (id === 'chart') await ui.open(approvalChartView(g));
  else if (id === 'dissolve') {
    const k = await ui.confirm({ title: '衆議院の解散', danger: true, w: 460, text: '衆議院を解散して総選挙に打って出る？\nすべての衆議院議員がいったん職を失い、審議中の法案は廃案になる。\n解散から40日以内に総選挙（憲法54条）。', choices: ['解散しない', '解散する'], index: 0, cancel: 0, tip: '解散は「総理の専権事項」とも言われる大きな決断' });
    if (k !== 1) return;
    const eid = g.dissolve('総理大臣の判断');
    if (!eid) { await ui.alert('解散', g.lastPoliticsError || '解散できなかった'); return; }
    sfx('drum');
    const e = findE(g, eid);
    await ui.alert('衆議院解散', ['衆議院は解散された。', `総選挙：${kojiWord('shugi')} ${dateLabel(g, e.koji)}・投票 ${dateLabel(g, e.day)}`, '自分の選挙区でも、立候補の届出を忘れずに。']);
  } else if (id === 'resign') {
    const k = await ui.confirm({ title: '内閣総辞職', danger: true, text: '内閣総辞職して、総理大臣をやめる？\n国会で新しい総理大臣が指名される。', choices: ['やめない', '総辞職する'], index: 0, cancel: 0 });
    if (k !== 1) return;
    const why = g.resignPM('総理の決断');
    await ui.alert('内閣総辞職', why || '内閣は総辞職した。おつかれさまでした。');
  } else if (id === 'trip' || id === 'kakugi' || id === 'answer') {
    const kind = { trip: '外遊', kakugi: '閣議に出る', answer: '国会で答弁' }[id];
    const r = g.activity(kind);
    if (!r.ok) { ui.toast(r.why, C.dim); return; }
    sfx(r.gaffe ? 'buzz' : 'good');
    await ui.alert(kind, r.text.split('\n'));
  } else if (id === 'quit') {
    const posts = p.me.posts.filter((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm');
    if (!posts.length) return;
    const k = await ui.confirm({ title: '大臣を辞める', danger: true, text: `「${postName(posts[0], fyOf(g))}」を辞任する？`, choices: ['辞めない', '辞任する'], index: 0, cancel: 0 });
    if (k === 1) { g.resignPost(posts[0], '一身上の都合'); await ui.alert('辞任', '大臣を辞任した。'); }
  } else if (id === 'join') {
    const why = g.joinCoalition();
    if (why) { sfx('buzz'); await ui.alert('連立', why); } else { sfx('success'); await ui.alert('連立', '連立政権に加わった。与党の一員だ。'); }
  } else if (id === 'leave') {
    const k = await ui.confirm({ title: '連立離脱', danger: true, text: '連立政権から離れて野党になる？', choices: ['離れない', '離れる'], index: 0, cancel: 0 });
    if (k === 1) { const why = g.leaveCoalition(); await ui.alert('連立', why || '連立から離脱した。'); }
  } else if (id === 'stance') {
    const k = await ui.confirm({ title: '首班指名での方針', text: '選挙のあと、総理を選ぶときに連立の誘いを受ける？', choices: ['おまかせ（政策が近ければ）', '連立に前向き', '連立はしない', 'やめておく'], tip: '連立には、政策の合意（連立合意）が欠かせない' });
    if (k >= 0 && k <= 2) { g.setCoalitionStance(['auto', 'accept', 'refuse'][k]); ui.toast('方針を決めた', C.good); }
  }
}
function approvalChartView(g) {
  const v = {
    title: '支持率の推移', hint: 'A/B:もどる', tip: () => '世論調査の数字には誤差がある。流れで見るのが大切',
    update(ui, inp) { if (inp.pressed('a') || inp.pressed('b')) { sfx('cancel'); ui.done(v, null); } },
    draw(c) {
      const p = polOf(g);
      const polls = p.polls.slice(-40);
      card(c, 6, 30, SW - 12, SH - 55, '週ごとの世論調査（シミュレーション）');
      const x = 40, y = 56, w = SW - 200, h = 250;
      R(c, x, y, w, h, '#0c1230');
      for (let k = 0; k <= 8; k++) { const yy = y + h - Math.round((k / 8) * h); R(c, x, yy, w, 1, k === 0 ? C.faint : '#1a2250'); T(c, `${k * 10}`, x - 6, yy - 6, 12, C.faint, 'right'); }
      if (polls.length < 2) { T(c, '調査がまだ少ない（毎週月曜日に発表）', x + w / 2, y + h / 2, 14, C.dim, 'center'); return; }
      const px = (i) => x + Math.round((i * (w - 1)) / (polls.length - 1));
      const py = (val) => y + h - 1 - Math.round((clamp(val, 0, 80) / 80) * (h - 2));
      const series = [{ name: '内閣支持率', color: '#ffffff', get: (q) => q.approval }];
      const top = Object.keys(p.parties).sort((a, b) => num(polls[polls.length - 1].support[b]) - num(polls[polls.length - 1].support[a])).slice(0, 5);
      for (const id of top) series.push({ name: partyShort(g, id), color: partyColor(p, id), get: (q) => num(q.support[id]) });
      series.push({ name: '支持なし', color: C.faint, get: (q) => num(q.none) });
      series.forEach((s) => { for (let i = 1; i < polls.length; i++) line(c, px(i - 1), py(s.get(polls[i - 1])), px(i), py(s.get(polls[i])), s.color); });
      series.forEach((s, i) => {
        const ly = y + i * 22;
        R(c, x + w + 14, ly + 4, 10, 4, s.color);
        T(c, fit(c, s.name, 80, 12), x + w + 28, ly, 12, C.text);
        T(c, `${Math.round(s.get(polls[polls.length - 1]))}%`, SW - 16, ly, 12, C.gold, 'right');
      });
      T(c, dateLabel(g, polls[0].day), x, y + h + 4, 12, C.faint);
      T(c, dateLabel(g, polls[polls.length - 1].day), x + w, y + h + 4, 12, C.faint, 'right');
    },
  };
  return v;
}

// ---------------------------------------------------------------- 組閣
function ensureCivilian(g, pid) {
  const p = polOf(g);
  const id = 'pf_' + pid;
  const def = PEOPLE[pid];
  if (!def) return null;
  if (!p.npcs[id]) p.npcs[id] = { id, name: def.name, gender: 'x', party: p.me.party, office: null, house: null, faction: null, look: def.look || {}, age: 30, wins: 0, traits: { charisma: 60, integrity: 75, ambition: 35 }, posts: [], district: null, civilian: true, person: pid };
  p.npcs[id].party = p.me.party;
  return id;
}
function ministerCandidates(g, post, choice) {
  const p = polOf(g);
  const coalition = p.cabinet.partyIds || [];
  const taken = new Set(Object.entries(choice).filter(([k]) => k !== post).map(([, v]) => v));
  const out = [{ id: 'player', label: `${playerName(g)}（兼務）`, sub: '総理大臣が自分で兼ねる', color: partyColor(p, p.me.party) }];
  const pool = Object.values(p.npcs).filter((n) => coalition.includes(n.party) && (n.office === 'shugi' || n.office === 'sangi') && !taken.has(n.id) && n.id !== p.cabinet.pm && !n.civilian)
    .sort((a, b) => b.wins - a.wins || b.traits.charisma - a.traits.charisma).slice(0, 30);
  for (const n of pool) out.push({ id: n.id, label: n.name, sub: `${partyShort(g, n.party)}・${n.house === 'sangi' ? '参院' : '衆院'}当選${n.wins}回${n.faction ? `・${factionName(p, n.party, n.faction)}` : ''}`, color: partyColor(p, n.party), right: `力${n.traits.charisma} 清${n.traits.integrity}` });
  for (const pid of g.friends(2)) {
    if (!PEOPLE[pid] || taken.has('pf_' + pid)) continue;
    out.push({ id: 'pf_' + pid, person: pid, label: PEOPLE[pid].name, sub: `民間人（仲間・${['', '顔見知り', '友だち', '仲良し', '親友'][g.heartLevel(pid)] || ''}）`, color: '#ffffff', right: '民間' });
  }
  return out;
}
SECTIONS.formation = async (ui) => {
  const g = ui.g;
  const p = polOf(g);
  if (p.cabinet.pm !== 'player') { await ui.alert('組閣', '組閣できるのは総理大臣だけ。'); return; }
  const fy = fyOf(g);
  const posts = cabinetPosts(fy, p.flags);
  const choice = {};
  for (const post of posts) choice[post] = p.cabinet.ministers[post] || null;
  let idx = 0;
  for (let guard = 0; guard < 200; guard++) {
    const civ = posts.filter((q) => choice[q] && String(choice[q]).startsWith('pf_')).length;
    const items = posts.map((post) => {
      const who = choice[post];
      const n = p.npcs[who];
      const civil = who && String(who).startsWith('pf_');
      return { label: postName(post, fy), right: who === 'player' ? '（兼務）' : civil ? (PEOPLE[who.slice(3)] || {}).name || '民間人' : n ? n.name : 'おまかせ', rightColor: who === 'player' ? C.gold : civil ? C.cyan : null, color: who === 'player' ? partyColor(p, p.me.party) : civil ? '#ffffff' : n ? partyColor(p, n.party) : null };
    });
    items.push({ label: '✔ この顔ぶれで組閣する', labelColor: C.gold });
    items.push({ label: '全部おまかせにする', labelColor: C.dim });
    const i = await ui.menu({ title: '組閣', listTitle: `閣僚 ${posts.length}人・民間人 ${civ}人`, listW: 400, rowH: 20, items, index: idx,
      detail: (c, it, r, k) => {
        card(c, r.x, r.y, r.w, r.h, k < posts.length ? postName(posts[k], fy) : '組閣');
        const x = r.x + 10, w = r.w - 20;
        if (k < posts.length) {
          const who = choice[posts[k]];
          const n = who && who !== 'player' ? (who.startsWith('pf_') && !p.npcs[who] ? { name: (PEOPLE[who.slice(3)] || {}).name, look: (PEOPLE[who.slice(3)] || {}).look, civilian: true, traits: { charisma: 60, integrity: 75 } } : p.npcs[who]) : null;
          if (who === 'player' || n) {
            R(c, x, r.y + 26, 54, 42, '#0c1230');
            drawFaceHD(c, who === 'player' ? g.state.look : n.look, x + 1, r.y + 27, 1.6);
            T(c, fit(c, who === 'player' ? playerName(g) : n.name, w - 64, 14), x + 62, r.y + 28, 14, '#ffffff');
            T(c, fit(c, who === 'player' ? '総理大臣（兼務）' : n.civilian ? '民間人' : `${partyShort(g, n.party)}・当選${n.wins}回`, w - 64, 12), x + 62, r.y + 46, 12, C.dim);
            if (n && n.traits) { T(c, 'カリスマ', x, r.y + 76, 12, C.dim); hbar(c, x + 60, r.y + 79, w - 60, 7, n.traits.charisma / 100, C.gold); T(c, '清廉さ', x, r.y + 92, 12, C.dim); hbar(c, x + 60, r.y + 95, w - 60, 7, n.traits.integrity / 100, C.good); }
          } else para(c, 'まだ決めていない。決めなければ、党内のバランスを見て自動で選ばれる。', x, r.y + 28, w, 12, C.dim);
          const areas = (POSTS[posts[k]] || {}).areas || [];
          if (areas.length) para(c, `担当：${areas.map((a) => POLICY_AREAS[a] ? POLICY_AREAS[a].name : a).join('・')}`, x, r.y + 112, w, 12, C.text, 16, 3);
        } else para(c, k === posts.length ? `この顔ぶれで内閣をつくる。民間人は${Math.floor((posts.length - 1) / 2)}人まで（国務大臣の過半数は国会議員）。` : '党と連立相手の議員から、バランスよく自動で選ぶ。', x, r.y + 28, w, 12, C.text, 17, 8);
      },
      tip: () => '国務大臣の過半数は、国会議員から選ばれなければならない（憲法68条）',
    });
    if (i < 0) return;
    idx = i;
    if (i < posts.length) {
      const post = posts[i];
      const cands = ministerCandidates(g, post, choice);
      const k = await ui.menu({ title: `${postName(post, fy)}をえらぶ`, listTitle: '候補', listW: 400, rowH: 36, items: cands,
        detail: (c, it, r) => { card(c, r.x, r.y, r.w, r.h, '人物'); if (!it) return; const n = p.npcs[it.id]; R(c, r.x + 10, r.y + 26, 54, 42, '#0c1230'); drawFaceHD(c, it.id === 'player' ? g.state.look : it.person ? (PEOPLE[it.person] || {}).look || {} : npcLook(p, it.id), r.x + 11, r.y + 27, 1.6); para(c, it.label, r.x + 10, r.y + 76, r.w - 20, 14, '#ffffff', 18, 2); para(c, it.sub || '', r.x + 10, r.y + 114, r.w - 20, 12, C.dim, 16, 4); if (n && n.traits) { T(c, `カリスマ ${n.traits.charisma}・清廉さ ${n.traits.integrity}`, r.x + 10, r.y + 180, 12, C.text); } },
        tip: (it) => (it && it.person ? '民間人閣僚：国会議員でない人を大臣に起用すること' : '当選回数や派閥のバランスも、党内の評価に関わる'),
      });
      if (k < 0) continue;
      const pick = cands[k];
      if (pick.person) {
        const civNow = posts.filter((q) => q !== post && choice[q] && String(choice[q]).startsWith('pf_')).length;
        if (civNow + 1 > Math.floor((posts.length - 1) / 2)) { sfx('buzz'); await ui.alert('民間人閣僚', `民間人は${Math.floor((posts.length - 1) / 2)}人までにしないと、国務大臣の過半数が国会議員にならない（憲法68条）。`); continue; }
      }
      choice[post] = pick.id;
    } else if (i === posts.length) {
      const ministers = {};
      for (const post of posts) {
        const w = choice[post];
        if (!w) continue;
        if (String(w).startsWith('pf_')) { const id = ensureCivilian(g, w.slice(3)); if (id) ministers[post] = id; } else ministers[post] = w;
      }
      const r = g.formCabinet({ ministers });
      if (!r.ok) { await ui.alert('組閣', r.why || 'うまくいかなかった'); return; }
      sfx('fanfare');
      await ui.alert('組閣', [`${playerName(g)}内閣の閣僚がそろった（${Object.keys(r.ministers).length + 1}人）。`, '天皇による認証式を経て、新しい大臣が仕事を始める。']);
      return;
    } else {
      const r = g.reshuffle({});
      if (r && r.ok) { sfx('success'); await ui.alert('組閣', '党内のバランスを見て、閣僚を選んだ。'); }
      return;
    }
  }
};

// ---------------------------------------------------------------- 連立協議
const ideoDist = (a, b) => Math.abs(num(a.econ) - num(b.econ)) + Math.abs(num(a.social) - num(b.social)) + Math.abs(num(a.security) - num(b.security));
SECTIONS.coalition = async (ui) => {
  const g = ui.g;
  const p = polOf(g);
  const me = p.me;
  if (p.cabinet.pm !== 'player') {
    const pt = p.parties[me.party];
    if (pt && pt.leader === 'player') { await cabinetCommand(ui, g, isRuling(p, pt.id) ? 'leave' : 'join'); return; }
    await ui.alert('連立協議', '連立の枠組みを決めるのは、総理大臣（与党の党首）だ。');
    return;
  }
  const mine = p.parties[me.party];
  const partners = new Set((p.cabinet.partyIds || []).filter((id) => id !== me.party));
  let idx = 0;
  for (let guard = 0; guard < 100; guard++) {
    const ids = Object.keys(p.parties).filter((id) => id !== me.party).sort((a, b) => g.partyStatus(b).seats - g.partyStatus(a).seats);
    const tot = (h) => [me.party, ...partners].reduce((a, id) => a + num(p.diet[h].seats[id]), 0);
    // (2026-10 fix) a real party the regime rule keeps out of this government (regime.js g.regimeCoalitionBlock,
    // feature-detected) is shown locked with its reason, and cannot be put in the coalition
    const blockOf = (id) => { try { return typeof g.regimeCoalitionBlock === 'function' ? g.regimeCoalitionBlock(id) || null : null; } catch (e) { console.error(e); return null; } };
    const items = ids.map((id) => {
      const d = ideoDist(mine.ideology, p.parties[id].ideology);
      const why = partners.has(id) ? null : blockOf(id);
      return { label: p.parties[id].name, sub: why ? `連立できない：${why}` : `衆${num(p.diet.shugi.seats[id])}・参${num(p.diet.sangi.seats[id])}・${d < 2.2 ? '政策が近い' : d < 3.2 ? '協議しだい' : '政策が遠い'}`, icon: (c, x, y) => drawPartyMark(c, g, id, x, y, 20), tag: partners.has(id) ? { text: '連立', color: '#2a7a4a' } : null, disabled: !!why, why };
    });
    items.push({ label: '✔ この枠組みで連立政権をつくる', labelColor: C.gold });
    const i = await ui.menu({ title: '連立協議', listTitle: 'Aで連立に入れる・外す', listW: 300, rowH: 36, items, index: idx,
      detail: (c, it, r) => {
        card(c, r.x, r.y, r.w, r.h, '連立の枠組み');
        const x = r.x + 10, w = r.w - 20;
        let y = r.y + 28;
        for (const [h, name] of [['shugi', '衆議院'], ['sangi', '参議院']]) {
          const H = p.diet[h];
          const t2 = tot(h), need = Math.floor(H.total / 2) + 1;
          T(c, `${name}　${t2}／${H.total}（過半数 ${need}）`, x, y, 12, t2 >= need ? C.good : C.bad);
          hbar(c, x, y + 16, w, 9, t2 / H.total, t2 >= need ? C.good : C.warn);
          R(c, x + Math.round((need / H.total) * w), y + 13, 1, 15, '#ffffff');
          y += 38;
        }
        T(c, `与党：${[me.party, ...partners].map((id) => partyShort(g, id)).join('・')}`, x, y, 12, C.text); y += 20;
        if (it && it.disabled && it.why) { y = para(c, `${it.label}とは連立できない：${it.why}`, x, y, w, 12, C.warn, 16, 4) + 6; }
        para(c, '政策が遠い党とは、協議がまとまらないことがある。衆議院で過半数を持てば、法案や予算を通しやすい。参議院で過半数がないと「ねじれ」になる。', x, y, w, 12, C.dim, 16, 6);
      },
      tip: () => '連立を組むときは、党どうしで政策の合意文書を交わすことが多い',
    });
    if (i < 0) return;
    idx = i;
    if (i < ids.length) { const id = ids[i]; if (partners.has(id)) partners.delete(id); else partners.add(id); sfx('cursor'); continue; }
    const accepted = [], refused = [];
    for (const id of partners) (ideoDist(mine.ideology, p.parties[id].ideology) < 3.2 ? accepted : refused).push(id);
    const keep = {};
    for (const [post, w] of Object.entries(p.cabinet.ministers)) if (w === 'player' || (p.npcs[w] && [me.party, ...accepted].includes(p.npcs[w].party))) keep[post] = w;
    const r = g.formCabinet({ partners: accepted, ministers: keep });
    if (!r.ok) {
      sfx('buzz');
      // the core's reason, and each refused partner with its own (regime.js: { refused: [{ id, why }] })
      const lines = Array.isArray(r.refused) && r.refused.length ? ['連立の枠組みはまとまらなかった。', ...r.refused.map((x) => `${partyShort(g, x.id)}：${x.why}`)] : [r.why || 'まとまらなかった'];
      for (const x of r.refused || []) partners.delete(x.id);
      await ui.alert('連立協議', lines);
      continue;
    }
    sfx(refused.length ? 'buzz' : 'success');
    await ui.alert('連立協議', [`与党：${r.partyIds.map((id) => partyShort(g, id)).join('・')}`, refused.length ? `${refused.map((id) => partyShort(g, id)).join('・')}とは政策の違いが大きく、協議は決裂した。` : '連立の合意がまとまった。']);
    return;
  }
};

// ---------------------------------------------------------------- 予算編成
const BUDGET_ITEMS = [
  ['welfare', '社会保障', { elderly: 1, families: 0.6, young: -0.4, business: -0.4 }],
  ['finance', '国債費', null],
  ['regional', '地方交付税・公共事業', { rural: 1, farmers: 0.5, selfemployed: 0.4, urban: -0.5 }],
  ['diplomacy', '防衛・外交', { elderly: 0.4, business: 0.3, unions: -0.6, young: -0.3 }],
  ['education', '文教・科学', { families: 0.8, young: 0.8, elderly: -0.3 }],
  ['economy', '経済・産業', { business: 0.8, employees: 0.4, selfemployed: 0.4 }],
  ['agriculture', '農林水産', { farmers: 1.2, rural: 0.6, urban: -0.3 }],
  ['other', 'その他', null],
];
SECTIONS.budget = async (ui) => ui.open(budgetView(ui.g));
function budgetView(g) {
  const p = polOf(g);
  const E = p.economy;
  const B = E.budget;
  const year = yearOf(g);
  const d = uiData(g);
  const canEdit = (p.cabinet.pm === 'player' || p.me.posts.includes('minister_finance')) && !B.passed && num(d.budgetYear) !== num(B.year);
  const base = {};
  for (const [k] of BUDGET_ITEMS) base[k] = num(B.items[k]);
  const pctv = {};
  for (const [k] of BUDGET_ITEMS) pctv[k] = 0;
  const calc = () => {
    const items = {};
    let spending = 0;
    for (const [k] of BUDGET_ITEMS) { items[k] = Math.round(base[k] * (1 + pctv[k] / 100) * 10) / 10; spending += items[k]; }
    const delta = spending - Object.values(base).reduce((a, b) => a + b, 0);
    const revenue = num(B.revenue);
    const deficit = Math.round((num(B.deficit) + delta) * 10) / 10;
    const segs = {};
    for (const [k, , m] of BUDGET_ITEMS) if (m) { const dd = items[k] - base[k]; for (const [s, w] of Object.entries(m)) segs[s] = num(segs[s]) + dd * w; }
    return { items, spending: Math.round(spending * 10) / 10, delta, revenue, deficit, segs };
  };
  const v = {
    title: `${B.year}年度 予算編成`, row: 0,
    hint: () => (canEdit ? '↑↓ ←→:増減 A:決定 B:もどる' : 'B:もどる'),
    tip: () => (BUDGET_ITEMS[v.row] && BUDGET_ITEMS[v.row][0] === 'finance' ? '国債費は、過去の借金の返済と利払い。予算では減らせない' : '予算は内閣がつくり、国会で成立する（衆議院が先に審議）'),
    update(ui, inp) {
      const n = BUDGET_ITEMS.length;
      if (inp.repeat('up')) { v.row = (v.row + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down')) { v.row = (v.row + 1) % n; sfx('cursor'); }
      const k = BUDGET_ITEMS[v.row][0];
      if (canEdit && k !== 'finance') {
        if (inp.repeat('left')) { pctv[k] = clamp(pctv[k] - 2, -20, 20); sfx('cursor'); }
        if (inp.repeat('right')) { pctv[k] = clamp(pctv[k] + 2, -20, 20); sfx('cursor'); }
      }
      if (inp.pressed('b')) { sfx('cancel'); ui.done(v, null); return; }
      if (inp.pressed('a') && canEdit) {
        sfx('ok');
        ui.act(async () => {
          const r = calc();
          const k2 = await ui.confirm({ title: '予算案を閣議決定', text: `一般会計 ${fmtCho(r.spending)}（${r.delta >= 0 ? '+' : ''}${(Math.round(r.delta * 10) / 10).toFixed(1)}兆円）\n新規国債など ${fmtCho(r.deficit)}\nこの予算案で国会に出す？`, choices: ['決定する', 'もう少し考える'] });
          if (k2 !== 0) return;
          applyBudget(g, r);
          d.budgetYear = B.year;
          sfx('success');
          await ui.alert('予算案', ['予算案を閣議決定した。', '国会で可決されれば成立する。']);
          ui.done(v, true);
        });
      }
    },
    draw(c, ui) {
      const r = calc();
      card(c, 6, 30, 360, SH - 55, canEdit ? '分野ごとの配分（±20%）' : B.passed ? `${B.year}年度予算は成立ずみ` : '配分（見るだけ）');
      BUDGET_ITEMS.forEach(([k, name], i) => {
        const y = 52 + i * 33;
        const sel = i === v.row;
        if (sel) R(c, 9, y - 3, 354, 31, C.sel);
        T(c, name, 16, y, 12, sel ? C.gold : C.text);
        T(c, `${r.items[k].toFixed(1)}兆円`, 356, y, 12, '#ffffff', 'right');
        const pv = pctv[k];
        if (pv) T(c, `${pv > 0 ? '+' : ''}${pv}%`, 286, y, 12, pv > 0 ? C.warn : C.cyan, 'right');
        hbar(c, 16, y + 16, 336, 7, r.items[k] / Math.max(1, r.spending) * 2.5, k === 'finance' ? C.faint : sel ? C.gold : '#5a7ad8');
      });
      const x = 372, w = SW - 6 - x;
      card(c, x, 30, w, SH - 55, '財政と影響（見込み）');
      const rows2 = [['歳出（一般会計）', fmtCho(r.spending), '#ffffff'], ['税収など', fmtCho(r.revenue), C.text], ['新規国債など', fmtCho(r.deficit), r.deficit > num(B.deficit) ? C.bad : C.good], ['政府債務（GDP比）', `${Math.round(E.debtRatio)}%`, C.dim], ['消費税率', taxWord(E.taxRate), C.dim]];
      rows2.forEach(([a, b2, col], i) => { T(c, a, x + 10, 52 + i * 18, 12, C.dim); T(c, b2, x + w - 10, 52 + i * 18, 12, col, 'right'); });
      if (canEdit) {
        T(c, '有権者の受けとめ', x + 10, 150, 12, C.gold);
        const segs = SEGMENT_ORDER.filter((s) => Math.abs(num(r.segs[s])) > 0.05);
        if (!segs.length) T(c, '配分を変えると表示される', x + 10, 168, 12, C.faint);
        segs.slice(0, 8).forEach((s, i) => { const y = 168 + i * 16; T(c, SEGMENTS[s].name, x + 10, y, 12, C.text); cbar(c, x + 90, y + 3, w - 100, 8, num(r.segs[s]) / 6); });
      } else {
        // nothing can be changed here: say why instead of the voters' reaction to a change
        T(c, B.passed ? '予算の流れ' : '予算を編成するのは', x + 10, 150, 12, C.gold);
        para(c, B.passed ? '今年度の予算はもう成立している。来年度の予算案は、秋から編成して12月に閣議決定し、1月の通常国会に出す。'
          : p.cabinet.pm === 'player' || p.me.posts.includes('minister_finance') ? '今年度の予算案は、もう閣議決定した。国会で可決されれば成立する（衆議院が先に審議）。'
            : `内閣（総理大臣と${postName('minister_finance', fyOf(g))}）。配分を変えられるのは、総理大臣か${postName('minister_finance', fyOf(g))}のときだけ。`, x + 10, 168, w - 20, 12, C.dim, 16, 6);
      }
      if (r.delta) T(c, r.delta > 0 ? '景気：少し上向く・借金は増える' : '景気：少し下向く・借金は減る', x + 10, SH - 44, 12, C.cyan);
      void year;
    },
  };
  return v;
}
// The core has no budget API yet: the edited allocation replaces this year's budget figures, a
// small temporary push to the economy (an entry in economy.shocks, which the core fades out),
// and a small swing of the segments toward / away from the PM's party.
function applyBudget(g, r) {
  const p = polOf(g);
  const E = p.economy;
  const B = E.budget;
  B.items = { ...B.items, ...r.items };
  B.spending = r.spending;
  B.deficit = r.deficit;
  const abs = (polDate(g).year - p.cal.year) * 120 + polDate(g).doy;
  if (Math.abs(r.delta) >= 0.5) E.shocks.push({ kind: 'budget', name: '予算の配分の見直し', until: abs + 120, len: 120, growth: clamp(r.delta * 0.03, -0.6, 0.6), inflation: clamp(r.delta * 0.01, -0.2, 0.2), unemployment: clamp(-r.delta * 0.01, -0.2, 0.2), yen: 0 });
  const party = p.me.party;
  if (party && p.parties[party]) {
    for (const [s, val] of Object.entries(r.segs)) {
      if (!SEGMENTS[s]) continue;
      const m = p.support.mods[s] || (p.support.mods[s] = {});
      m[party] = clamp(num(m[party]) + clamp(val * 0.0015, -0.01, 0.01), -0.3, 0.3);
    }
  }
}

// ---------------------------------------------------------------- 憲法改正
SECTIONS.amendment = async (ui) => {
  const g = ui.g;
  const ids = POLICY_ORDER.filter((id) => POLICIES[id].kind === 'amendment' || id === 'referendum_law');
  let idx = 0;
  for (let guard = 0; guard < 60; guard++) {
    const p = polOf(g);
    const items = ids.map((id) => {
      const st = policyStatus(g, id);
      const b = p.diet.bills.find((x) => x.policy === id && !['enacted', 'rejected', 'shelved'].includes(x.stage));
      return { label: POLICIES[id].name, sub: b ? `審議中：${STAGE_WORD[b.stage]}` : st ? st.why || st.tag : '発議をめざせる', tag: st ? { text: st.tag, color: st.color } : null };
    });
    const i = await ui.menu({ title: '憲法改正', listTitle: '改正の案', listW: 280, rowH: 36, items, index: idx,
      detail: (c, it, r, k) => {
        const id = ids[k];
        const law = POLICIES[id].kind !== 'amendment';
        card(c, r.x, r.y, r.w, r.h, law ? '成立に必要な議席（出席議員の過半数）' : '発議に必要な議席（総議員の3分の2）');
        const x = r.x + 10, w = r.w - 20;
        let al = {};
        try { al = (g.policyPreview(id) || {}).alignment || {}; } catch (e) { al = {}; }
        let y = r.y + 26;
        for (const [h, name] of [['shugi', '衆議院'], ['sangi', '参議院']]) {
          const H = p.diet[h];
          const pro = Object.entries(H.seats).reduce((a, [pid, n]) => a + (num(al[pid]) >= 0.6 ? num(n) : 0), 0);
          const need = law ? Math.floor(H.total / 2) + 1 : Math.ceil((H.total * 2) / 3);
          T(c, `${name}　賛成しそう ${pro}／必要 ${need}${law ? '（目安）' : ''}`, x, y, 12, pro >= need ? C.good : C.warn);
          hbar(c, x, y + 16, w, 9, pro / H.total, pro >= need ? C.good : C.warn);
          R(c, x + Math.round((need / H.total) * w), y + 13, 1, 15, '#ffffff');
          y += 38;
        }
        y = para(c, POLICIES[id].desc, x, y, w, 12, C.text, 16, 4) + 6;
        para(c, `流れ：国会議員が原案を出す → 衆参それぞれで総議員の3分の2以上の賛成で発議 → 国民投票で過半数の賛成 → 成立。${yearOf(g) >= 2007 ? '国民投票の手続きは2007年の国民投票法で定められた（2010年施行）。' : '国民投票の手続きを定める法律は、この時代にはまだない（史実では2007年に制定）。'}`, x, y, w, 12, C.dim, 16, 7);
      },
      tip: () => '憲法改正には、国会の発議と国民投票の両方が必要（憲法96条）',
    });
    if (i < 0) return;
    idx = i;
    await submitPolicy(ui, ids[i], null);
  }
};

// ================================================================ 党内
SECTIONS.party = async (ui) => {
  const g = ui.g;
  let idx = 0;
  for (let guard = 0; guard < 100; guard++) {
    const p = polOf(g);
    const me = p.me;
    const pt = p.parties[me.party];
    if (!pt) {
      const k = await ui.confirm({ title: '党内', text: 'どの政党にも入っていない（無所属）。\n政党に入るか、自分で立ち上げよう。', choices: ['政党の一覧へ', 'もどる'] });
      if (k === 0) await SECTIONS.parties(ui);
      return;
    }
    const leader = pt.leader === 'player';
    const fy = fyOf(g);
    const sos = p.elections.upcoming.find((e) => e.kind === 'sosaisen' && e.party === pt.id && e.status !== 'done');
    const items = [];
    for (const post of PARTY_POST_ORDER) {
      if (POSTS[post].parties && !POSTS[post].parties.includes(pt.id)) continue;
      const who = (pt.posts || {})[post];
      items.push({ kind: 'post', post, label: postName(post, fy, pt.id), right: whoName(g, who), rightColor: who === 'player' ? C.gold : null });
    }
    for (const f of pt.factions || []) items.push({ kind: 'faction', f, label: f.name, sub: `${f.kind === 'faction' ? '派閥' : 'グループ'}・${whoName(g, f.leader)}`, right: `${f.size}人`, tag: me.faction === f.id ? { text: '所属', color: '#2a7a4a' } : null });
    if (sos) items.push({ kind: 'sosaisen', label: sos.label, sub: `投票 ${dateLabel(g, sos.day)}${myDecl(sos) ? '・立候補中' : ''}`, labelColor: C.gold });
    if (me.faction) items.push({ kind: 'leaveFaction', label: '派閥・グループを抜ける', labelColor: C.dim });
    if (leader) {
      items.push({ kind: 'recruit', label: '議員に入党を呼びかける', sub: '1日1回・体力10・党の資金で支度金も', labelColor: C.cyan });
      items.push({ kind: 'funds', label: '党の資金を政治資金に移す', sub: `党の資金 ${fmtBig(pt.funds)}`, labelColor: C.cyan });
    }
    const st = g.partyStatus(pt.id);
    const i = await ui.menu({ title: `党内：${pt.name}`, listTitle: '役員・派閥・党首選', listW: 330, rowH: 34, items, index: idx,
      detail: (c, it, r) => {
        card(c, r.x, r.y, r.w, r.h, pt.name);
        const x = r.x + 10, w = r.w - 20;
        drawPartyMark(c, g, pt.id, x, r.y + 26, 36);
        T(c, fit(c, `${pt.leaderTitle || '代表'}：${whoName(g, pt.leader)}`, w - 46, 12), x + 44, r.y + 26, 12, C.text);
        T(c, `衆${st.shugi}・参${st.sangi}・党員 ${fmtNum(st.members)}人`, x + 44, r.y + 42, 12, C.dim);
        let y = r.y + 70;
        y = para(c, st.official ? '政党要件：満たしている' : `政党要件：${st.reason || 'まだ'}`, x, y, w, 12, st.official ? C.good : C.warn, 16, 2);
        T(c, `党の資金 ${fmtBig(st.funds)}`, x, y, 12, C.text); y += 16;
        if (subsidyExists(yearOf(g))) { T(c, `政党交付金 年${fmtBig(st.subsidy)}`, x, y, 12, C.dim); y += 16; }
        T(c, `党内の評価 ${Math.round(me.standing)}`, x, y, 12, C.text); hbar(c, x + 100, y + 3, w - 100, 8, me.standing / 100, C.gold); y += 22;
        if (it && it.kind === 'faction') y = para(c, it.f.kind === 'faction' ? '派閥：考えの近い議員の集まり。選挙や党首選で助け合い、活動費を配ることもある。' : `グループ：政策を学び合う議員の集まり${yearOf(g) >= 2024 && pt.id === 'jimin' ? '（自民党では2024年に多くの派閥が解散した）' : ''}。`, x, y, w, 12, C.dim, 16, 4);
        else if (it && it.kind === 'post') y = para(c, { kanjicho: '幹事長：党の運営・選挙・お金を取りしきる要の役職。', seichokai: '政調会長：党の政策をまとめる。', somukai: '総務会長：党の意思決定機関「総務会」をまとめる。', sentai: '選対委員長：選挙の候補者選びと戦略を担う。', kokutai: '国対委員長：国会の日程や法案の扱いを他党と交渉する。' }[it.post] || '', x, y, w, 12, C.dim, 16, 4);
        else if (it && it.kind === 'sosaisen') y = para(c, '国会議員の票と党員の票で党首を選ぶ。推薦人が必要。', x, y, w, 12, C.dim, 16, 4);
        else if (it && it.kind === 'recruit') y = para(c, '無所属や野党の議員に入党を呼びかける（引き抜き）。支持率と知名度が高いほど集まりやすい。', x, y, w, 12, C.dim, 16, 4);
      },
      tip: (it) => (it && it.kind === 'faction' ? '派閥の活動費も政治資金。収支報告書への記載が必要' : '党の役職は党首が決める。党内の評価が高いと声がかかる'),
    });
    if (i < 0) return;
    idx = i;
    const it = items[i];
    if (it.kind === 'post') {
      if (!leader) { await ui.alert(it.label, `いまは${whoName(g, pt.posts[it.post])}が務めている。党首が決める役職だ。`); continue; }
      const cands = [{ id: 'player', label: `${playerName(g)}（自分で兼ねる）` }, ...Object.values(p.npcs).filter((n) => n.party === pt.id && (n.office === 'shugi' || n.office === 'sangi')).sort((a, b) => b.wins - a.wins).slice(0, 12).map((n) => ({ id: n.id, label: n.name, sub: `当選${n.wins}回` }))];
      const k = await ui.menu({ title: `${it.label}をえらぶ`, listTitle: '候補', listW: 360, rowH: 30, items: cands, tip: () => '役員人事は党首の大きな仕事' });
      if (k < 0) continue;
      const why = g.appointPartyPost(it.post, cands[k].id);
      if (why) await ui.alert('人事', why); else ui.toast(`${it.label}に${cands[k].label}`, C.good);
    } else if (it.kind === 'faction') {
      if (me.faction === it.f.id) { await ui.alert(it.f.name, 'すでに入っている。'); continue; }
      const k = await ui.confirm({ title: it.f.name, text: `${it.f.name}に入る？\n党首選の推薦人や、選挙の応援で助けてもらえる。`, choices: ['入る', 'やめておく'] });
      if (k === 0) { const why = g.joinFaction(it.f.id); await ui.alert(it.f.name, why || `${it.f.name}に入った。`); }
    } else if (it.kind === 'leaveFaction') { const why = g.leaveFaction(); ui.toast(why || '派閥を抜けた', C.dim); }
    else if (it.kind === 'sosaisen') { if (myDecl(sos)) await ui.alert(sos.label, '立候補している。投票日を待とう。'); else await candidacyFlow(ui, sos.id); }
    else if (it.kind === 'recruit') {
      const k = await ui.confirm({ title: '議員に入党を呼びかける', text: '支度金を出す？（党の資金→政治資金の順に使う）', choices: ['出さない', `${fmtMoney(5000000)}出す`, `${fmtMoney(20000000)}出す`, 'やめておく'] });
      if (k < 0 || k === 3) continue;
      const r = g.recruitMembers({ funds: [0, 5000000, 20000000][k] });
      if (!r.ok) { await ui.alert('呼びかけ', r.why); continue; }
      sfx(r.joined.length ? 'success' : 'cancel');
      await ui.alert('呼びかけ', r.joined.length ? [`${r.joined.map((j) => j.name).join('・')}が入党した！`, r.status.official ? '政党要件を満たしている。' : `政党要件まで：${r.status.reason || ''}`] : ['今日は誰も応じてくれなかった…。']);
    } else if (it.kind === 'funds') {
      const k = await ui.confirm({ title: '党の資金', text: `党の資金 ${fmtMoney(pt.funds)} から、あなたの政治資金に移す。`, choices: [fmtMoney(1000000), fmtMoney(10000000), 'やめておく'] });
      if (k < 0 || k === 2) continue;
      const why = g.transferPartyFunds([1000000, 10000000][k]);
      if (why) await ui.alert('党の資金', why); else ui.toast('政治資金に移した（収支報告書に記載）', C.good);
    }
  }
};

// ================================================================ 資金・活動
SECTIONS.money = async (ui) => {
  const g = ui.g;
  let idx = 0;
  for (let guard = 0; guard < 100; guard++) {
    const p = polOf(g);
    const me = p.me;
    const y = yearOf(g);
    const lg = me.ledger[y] || { income: 0, expense: 0, donations: 0, parties: 0 };
    // the same gates as the core (holdFundraiser / donationBlock / hireStaff), shown before anything
    // is asked: a newcomer is never offered 「一部を書かない（違法）」 for a party they cannot hold
    const day = today(g);
    const gap = num(POL.FUNDRAISER_GAP, 60);
    const nextParty = num(me.lastParty, -999) + gap;
    const live = (id) => !!id && p.elections.upcoming.some((x) => x.id === id && x.status !== 'done');
    const running = live(me.candidacy) || live(me.intent && me.intent.election);
    const partyWhy = !me.office && !me.posts.length ? '議員か党の役職についてから' : day < nextParty ? `次は${dateLabel(g, nextParty)}ごろから` : g.state.stamina < 15 ? '体力が足りない（15）' : null;
    const donWhy = !me.office && !me.formerOffice && !running && !me.posts.includes('party_leader') ? '立候補を届け出てから（支援者が寄付してくれる）' : null;
    const hireWhy = !me.office ? '議員・首長になってから' : null;
    const involvedNow = involved(g) || !!uiData(g).retire;
    const items = [
      { id: 'party', label: '政治資金パーティーを開く', sub: partyWhy || `年に${Math.max(1, Math.round(YEAR_DAYS / gap))}回まで・体力15`, disabled: !!partyWhy, why: partyWhy },
      { id: 'donate', label: '寄付を募る', sub: donWhy || '1日1回・体力6', disabled: !!donWhy, why: donWhy },
      { id: 'report', label: '収支報告書を出す', sub: me.reported[y - 1] && !me.reported[y - 1].auto ? `${y - 1}年分は提出ずみ` : `${y - 1}年分（3月末まで）` },
      { id: 'hire', label: '私設秘書を雇う', sub: hireWhy || `いま${me.staff}人・月${fmtMoney(POL.STAFF_COST)}`, disabled: !!hireWhy, why: hireWhy },
      { id: 'fire', label: '私設秘書を減らす', disabled: !me.staff, why: '秘書はいない' },
      { id: 'acts', label: '議員の活動', sub: '地元回り・記者会見・視察など', labelColor: C.cyan },
    ];
    if (involvedNow) items.push({ id: 'retire', label: '進退（辞職・引退）', sub: me.office ? '議員辞職・政界引退の表明' : '政界引退・これまでの歩み', labelColor: '#ffb0b8' });
    const i = await ui.menu({ title: '政治資金・活動', listTitle: 'お金と活動', listW: 290, rowH: 34, items, index: idx,
      detail: (c, it, r) => {
        card(c, r.x, r.y, r.w, r.h, `${y}年の政治資金`);
        const x = r.x + 10, w = r.w - 20;
        const rows = [['政治資金（いま）', fmtMoney(me.funds), C.gold], ['所持金（個人）', fmtMoney(g.state.money), C.text], ['今年の収入', fmtMoney(lg.income), C.good], ['今年の支出', fmtMoney(lg.expense), C.bad], ['うち寄付', fmtMoney(lg.donations), C.dim], ['パーティー', `${lg.parties || 0}回`, C.dim]];
        rows.forEach(([a, b, col], k) => { T(c, a, x, r.y + 26 + k * 17, 12, C.dim); T(c, b, x + w, r.y + 26 + k * 17, 12, col, 'right'); });
        let yy = r.y + 132;
        if (me.secret > 0) {
          frame(c, x - 4, yy - 2, w + 8, 64, '#3a0e18', C.bad);
          T(c, `⚠ 帳簿にないお金 ${fmtMoney(me.secret)}`, x, yy + 2, 12, '#ffb0b8');
          para(c, '収支報告書に書かないお金（裏金）は、政治資金規正法違反。発覚すれば大スキャンダルで、捜査の対象になる。', x, yy + 18, w, 12, '#ffd0d6', 15, 3);
          yy += 70;
        }
        // the threshold is a sum in law (that year's yen): never converted by the era's price level
        if (it && it.disabled && it.why) { T(c, fit(c, `いまはできない：${it.why}`, w, 12), x, yy, 12, C.warn); yy += 18; }
        const desc = { party: y >= 1993 ? `券を売って資金を集める。1回のパーティーで${plainYen(partyTicketDisclosure(y))}を超えて買った人の名前は、収支報告書で公開される。` : '券を売って資金を集める。集めたお金は政治資金として収支報告書に載せる。', donate: y >= 2000 ? '支援者から寄付を募る。個人からの寄付には上限があり、企業・団体の寄付は政党などに限られる（2000年から）。' : '支援者から寄付を募る。寄付には上限があり、一定の額を超える寄付は収支報告書で公開される。', report: '1年間のお金の出入りを報告する。正直に書けば、ごまかしたお金も「修正」できる。', hire: '秘書がいると、活動や選挙運動の効果が上がる。給料は政治資金から。', fire: '秘書を減らして経費を下げる。', acts: '議員としての毎日の活動。地元の支持や評判が変わる。', retire: '議員を辞めるか、政界からの引退を表明する。引退すれば、これまでの歩みが記録に残る。' }[it && it.id] || '';
        para(c, desc, x, yy, w, 12, C.text, 16, 6);
      },
      tip: (it) => ({ party: '政治資金パーティーの収入は、政治資金として報告が必要', report: '政治資金収支報告書は、原則として翌年3月末までに提出する', donate: '寄付の上限や公開のルールは、政治資金規正法で決められている' }[it && it.id] || '政治資金は、個人のお金とは分けて管理する'),
    });
    if (i < 0) return;
    idx = i;
    const id = items[i].id;
    if (items[i].disabled) { if (items[i].why) ui.toast(items[i].why, C.dim); continue; }
    if (id === 'party') {
      const k = await ui.confirm({ title: '政治資金パーティー', text: '収入をどう報告する？', choices: ['全部、収支報告書に書く', '一部を書かない（違法）', 'やめておく'], tip: 'パーティー収入の一部を記載しない「裏金」は、政治資金規正法違反' });
      if (k < 0 || k === 2) continue;
      let unreported = 0;
      if (k === 1) {
        let law = '';
        try { law = crimeLaw(g, 'slush_fund') || ''; } catch (e) { law = ''; }
        const k2 = await ui.confirm({ title: '⚠ 裏金は犯罪です', danger: true, w: 460, text: `${law || '政治資金規正法違反（不記載・虚偽記入）。'}\n発覚すれば議員の職を失うこともある。`, choices: ['やめて、全部書く', '3割を書かない', '半分を書かない'], index: 0, cancel: 0 });
        unreported = [0, 0.3, 0.5][k2] || 0;
      }
      const r = g.holdFundraiser({ unreported });
      if (!r.ok) { await ui.alert('パーティー', r.why); continue; }
      sfx(r.secret ? 'buzz' : 'coin');
      await ui.alert('政治資金パーティー', r.text.split('\n'));
    } else if (id === 'donate') {
      const r = g.collectDonations();
      if (!r.ok) { ui.toast(r.why, C.dim); continue; }
      sfx('coin');
      await ui.alert('寄付', r.text);
    } else if (id === 'report') {
      const me2 = polOf(g).me;
      let inc = false;
      if (me2.secret > 0) {
        const k = await ui.confirm({ title: '収支報告書', text: `帳簿にないお金 ${fmtMoney(me2.secret)} がある。正直に書く？`, choices: ['正直に書く（評判↓）', '書かない（違法）', 'やめておく'], tip: '虚偽の記載や不記載は、政治資金規正法で罰せられる' });
        if (k < 0 || k === 2) continue;
        inc = k === 0;
      }
      const r = g.reportFunds({ includeSecret: inc });
      await ui.alert('収支報告書', r.ok ? r.text : r.why);
    } else if (id === 'hire' || id === 'fire') {
      const why = g.hireStaff(id === 'hire' ? 1 : -1);
      if (why) await ui.alert('秘書', why); else ui.toast(`秘書 ${polOf(g).me.staff}人`, C.good);
    } else if (id === 'acts') await SECTIONS.activities(ui);
    else if (id === 'retire') await SECTIONS.retire(ui);
  }
};
SECTIONS.activities = async (ui) => {
  const g = ui.g;
  let idx = 0;
  const kinds = Object.keys(ACTIVITIES).filter((k) => k !== '献金集め');
  const ok = (k) => {
    const p = polOf(g);
    const me = p.me;
    const A = ACTIVITIES[k];
    const need = A.need;
    const okNeed = need === 'any' ? true : need === 'national' ? isNational(me) : need === 'local' ? ['kugi', 'togi'].includes(me.office) : need === 'exec' ? ['shicho', 'chiji'].includes(me.office) : need === 'cabinet' ? inCabinet(me) : need === 'pm' ? me.posts.includes('pm') : need === 'faction' ? !!me.faction : !!me.office;
    if (!okNeed) return { national: '国会議員の活動', local: '区議・都議の活動', exec: '区長・知事の活動', cabinet: '大臣の活動', pm: '総理大臣の活動', faction: '派閥に入ると', office: '議員・首長の活動' }[need] || 'いまはできない';
    if (A.session && !p.diet.session) return '国会の会期中だけ';
    if (me.lastAct[k] === today(g)) return '今日はもうやった';
    return null;
  };
  for (let guard = 0; guard < 100; guard++) {
    const items = kinds.map((k) => { const why = ok(k); return { label: k, right: `体力${ACTIVITIES[k].stamina}`, disabled: !!why, why, sub: why || ACTIVITIES[k].desc }; });
    const i = await ui.menu({ title: '議員の活動', listTitle: `体力 ${g.state.stamina}`, listW: 330, rowH: 34, items, index: idx,
      detail: (c, it, r, k) => {
        const A = ACTIVITIES[kinds[k]];
        card(c, r.x, r.y, r.w, r.h, kinds[k]);
        let y = para(c, A.desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 4) + 8;
        const fx = [A.local ? '地元の支持' : null, A.rep ? '評判' : null, A.standing ? '党内の評価' : null, A.kouenkai ? '後援会' : null, A.fame ? '知名度' : null, A.approval ? '内閣支持率' : null].filter(Boolean);
        T(c, `効果：${fx.join('・') || '—'}`, r.x + 10, y, 12, C.good); y += 16;
        if (A.funds) { T(c, `費用 ${fmtMoney(A.funds)}`, r.x + 10, y, 12, C.dim); y += 16; }
        if (A.gaffe) T(c, '失言に注意（トークの力が低いと危ない）', r.x + 10, y, 12, C.warn);
      },
      tip: () => '議員の仕事は、国会だけでなく地元の声を聞くことも大切',
    });
    if (i < 0) return;
    idx = i;
    const r = g.activity(kinds[i]);
    if (!r.ok) { ui.toast(r.why, C.dim); continue; }
    sfx(r.gaffe ? 'buzz' : 'good');
    await ui.alert(kinds[i], r.text.split('\n'));
  }
};

// ================================================================ 進退（議員辞職・政界引退）
// The core ends a career three ways: g.resignOffice (辞職 now: a 補選 or 繰上補充, the posts go to
// NPCs, a PM's cabinet resigns), not filing for the office's next election (the term ends with it,
// politics.js runElection), and g.leaveParty (a founder hands the party on). The UI adds the 会見,
// the career card and, in flags.polui:
//   retire { day, office, mode: 'term'|'now', done: day|undefined }   an announced retirement (term:
//          serving out the term; the morning after the office ends it is done) / a finished one
//   career [records]   the 「政治家としての歩み」 of each retirement (newest first; the notebook may read it)
//   held { [post]: days }   posts held (the core keeps only pmDays / ministerDays)
//   shugiDays, einen   days in the 衆議院 and the day of the 永年在職議員表彰 (25 years)
const EINEN_DAYS = 25 * YEAR_DAYS;
const MONTH_LEN = YEAR_DAYS / 12;
function spanText(n) {
  n = Math.max(0, Math.round(num(n)));
  const y = Math.floor(n / YEAR_DAYS), m = Math.floor((n % YEAR_DAYS) / MONTH_LEN);
  return y ? `${y}年${m ? `${m}か月` : ''}` : `${Math.max(1, m)}か月`;
}
const postRank = (x) => (x === 'pm' ? 0 : x === 'party_leader' ? 1 : POSTS[x] && POSTS[x].kind === 'cabinet' ? 2 : 3);
function careerRecord(g, how) {
  const p = polOf(g);
  const me = p.me;
  const d = uiData(g);
  const day = today(g);
  const fy = fyOf(g);
  const held = { ...(d.held || {}) };
  for (const x of me.posts) held[x] = Math.max(1, num(held[x]));
  const posts = Object.keys(held).filter((x) => POSTS[x]).sort((a, b) => postRank(a) - postRank(b) || held[b] - held[a]).map((x) => (x === 'pm' ? '内閣総理大臣' : postName(x, fy, me.party))).filter((x, i, a) => a.indexOf(x) === i);
  const laws = (p.laws || []).filter((l) => l.by === 'player');
  const off = me.office || me.formerOffice;
  // the first win (careerStart); an old save may only have the latest one (officeSince)
  const start = me.careerStart ?? me.officeSince ?? null;
  return {
    day, date: dateLabel(g, day), how, name: playerName(g),
    office: off && OFFICES[off] ? OFFICES[off].label : null, party: me.party ? partyFull(g, me.party) : '無所属',
    since: start != null ? dateLabel(g, start) : null, span: start != null ? day - num(start) : 0,
    won: (me.history || []).filter((h) => h && h.won && h.kind !== 'sosaisen').slice(0, 3).map((h) => h.label),
    wins: num(me.wins), losses: num(me.losses), nationalWins: num(me.nationalWins), pmDays: num(me.pmDays), ministerDays: num(me.ministerDays),
    posts: posts.slice(0, 6), laws: laws.length, lawTitles: laws.slice(-3).reverse().map((l) => l.title), einen: d.einen ? dateLabel(g, d.einen) : null,
  };
}
function careerLine(rec) {
  return rec.since ? `政治家として${spanText(rec.span)}・当選${rec.wins}回${rec.pmDays ? '・元総理大臣' : rec.ministerDays ? '・大臣経験者' : ''}` : `当選の経験はないまま、${rec.how}`;
}
// a finished retirement: the record, the phone news; queued for the card unless the UI shows it now
function finishRetire(g, rec, o = {}) {
  const d = uiData(g);
  const day = today(g);
  d.retire = { ...(d.retire || {}), day: d.retire ? d.retire.day : day, office: d.retire && d.retire.office, mode: (d.retire && d.retire.mode) || 'now', done: day };
  const list = Array.isArray(d.career) ? d.career : (d.career = []);
  list.unshift(rec);
  if (list.length > 5) list.length = 5;
  try { g.message({ from: 'ドット新聞 政治部', kind: 'news', text: `【政界引退】${g.state.name}さんが政界を引退した。\n${careerLine(rec)}。` }); } catch (e) { /* no phone in some tests */ }
  if (o.queue) queue(g, { kind: 'career', id: `c${day}` });
}
// the morning: posts held, the years in the 衆議院 (永年在職議員表彰), the end of an announced retirement
function trackCareer(g) {
  if (!g.state || !g.state.politics) return;
  const p = polOf(g);
  const me = p.me;
  const d = uiData(g);
  const day = today(g);
  if (d.careerDay === day) return;
  d.careerDay = day;
  if (me.posts.length) { const h = d.held && typeof d.held === 'object' ? d.held : (d.held = {}); for (const x of me.posts) h[x] = num(h[x]) + 1; }
  if (me.office === 'shugi') {
    if (d.shugiDays == null) d.shugiDays = Math.max(0, day - num(me.officeSince, day));
    d.shugiDays = num(d.shugiDays) + 1;
    if (d.shugiDays >= EINEN_DAYS && !d.einen) {
      d.einen = day;
      me.reputation = clamp(num(me.reputation) + 5, -100, 100);
      if (g.addFame) g.addFame(60, true);
      try { g.message({ from: '衆議院', kind: 'news', text: `${g.state.name}議員は、在職25年をむかえ、衆議院から永年在職議員として表彰されることになった。` }); } catch (e) { /* no phone */ }
      queue(g, { kind: 'einen', id: 'einen' });
    }
  }
  const R0 = d.retire;
  const filed = p.elections.upcoming.some((e) => myDecl(e) && e.status !== 'done' && e.kind !== 'sosaisen');
  // filed for an election after all (a place's 届出 window bypasses the UI's question): an
  // announcement is withdrawn, a finished retirement becomes a comeback
  if (R0 && (filed || (R0.done && me.office))) d.retire = null;
  else if (R0 && !R0.done && !me.office) finishRetire(g, careerRecord(g, '任期満了で政界引退'), { queue: true });
}
// 会見 (press conference): lines [[speaker, text]], A to go on
function pressView(g, o) {
  const lines = o.lines;
  const v = {
    noChrome: true, k: 0, hint: 'A:つぎへ',
    tip: () => o.tip || '',
    update(ui, inp) {
      if (g.auto) { ui.done(v, true); return; }
      if (v.t > 14 && (inp.pressed('a') || inp.pressed('b'))) { sfx('cursor'); v.k++; v.t = 3; if (v.k >= lines.length) ui.done(v, true); }
    },
    draw(c) {
      const t = num(v.t);
      for (let i = 0; i < 5; i++) R(c, 0, i * 42, SW, 43, mix('#1a2242', '#283258', i / 5));
      R(c, 0, 206, SW, SH - 206, '#3a3040');
      // the backdrop with the event's name
      R(c, 150, 18, SW - 300, 32, '#0e1534'); frame(c, 150, 18, SW - 300, 32, null, C.gold);
      T(c, o.board, SW / 2, 26, 16, '#ffffff', 'center');
      // the player behind the table, the microphones
      drawSprite(c, g.state.look, SW / 2 - 32, 80, 2, 'down', 0);
      R(c, 130, 152, SW - 260, 46, '#f0eee6'); R(c, 130, 152, SW - 260, 3, '#ffffff'); R(c, 130, 195, SW - 260, 3, '#c8c4b8');
      const flags = ['#d63a3a', '#3a7bd5', '#e8c25a', '#5ee07a', '#b8a0ff', '#ff8a5a'];
      flags.forEach((col, i) => { const mx = SW / 2 - 50 + i * 20; R(c, mx, 128, 3, 26, '#333'); R(c, mx - 2, 122, 7, 8, '#222'); R(c, mx - 4, 140, 11, 7, col); });
      // reporters (from behind) and the cameras' flashes
      for (let i = 0; i < 8; i++) drawSprite(c, LOOKS[CROWD[(i * 3) % CROWD.length]] || LOOKS.salaryman, 18 + i * 78, 196 + (i % 2) * 6, 1.4, 'up', 0);
      for (let i = 0; i < 3; i++) {
        const ph = (t + i * 17) % 41;
        if (ph < 3) { const fx = 60 + Math.floor(hash2(i, Math.floor((t + i * 17) / 41), 5) * (SW - 120)), fy = 196 + Math.floor(hash2(i, Math.floor(t / 41), 9) * 30); c.globalAlpha = 0.85 - ph * 0.25; disc(c, fx, fy, 9, '#ffffff'); c.globalAlpha = 1; }
      }
      // the words
      const [who, s] = lines[clamp(v.k, 0, lines.length - 1)];
      frame(c, 40, 262, SW - 80, 80, 'rgba(10,15,38,0.94)', C.edge);
      T(c, who, 54, 268, 12, who === '記者' ? C.cyan : C.gold);
      para(c, s, 54, 286, SW - 108, 14, '#ffffff', 19, 3);
      T(c, `${v.k + 1}/${lines.length}`, SW - 52, 268, 12, C.faint, 'right');
      if (t > 14) downArrow(c, SW - 60, 326, t, C.gold);
    },
  };
  return v;
}
function careerCardView(g, rec) {
  const v = {
    noChrome: true, hint: 'A:とじる',
    tip: () => '引退したあとでも、また立候補することはできる（政界復帰）',
    update(ui, inp) { if (g.auto || (v.t > 20 && (inp.pressed('a') || inp.pressed('b')))) { sfx('ok'); ui.done(v, true); } },
    draw(c) {
      tvBg(c, num(v.t));
      const x = 96, y = 14, w = SW - 192, h = SH - 28;
      paper(c, x, y, w, h);
      const ink = C.ink;
      T(c, '政治家としての歩み', x + w / 2, y + 12, 16, ink, 'center');
      R(c, x + 28, y + 34, w - 56, 1, C.paperEdge);
      T(c, fit(c, rec.name, w - 200, 16), x + 28, y + 42, 16, ink);
      T(c, fit(c, rec.how, 160, 12), x + w - 28, y + 46, 12, C.inkDim, 'right');
      let yy = y + 70;
      const row = (a, b, max = 1) => { T(c, a, x + 28, yy, 12, C.inkDim); yy = para(c, b, x + 130, yy, w - 158, 12, ink, 16, max) + 3; };
      row('最後の職', rec.office ? `${rec.office}（${rec.party}）` : `なし（${rec.party}）`);
      row('政治家として', rec.since ? `${rec.since}の当選から ${spanText(rec.span)}` : rec.wins ? '—' : '当選の経験はない');
      row('選挙', `当選${rec.wins}回${rec.nationalWins ? `（うち国政${rec.nationalWins}回）` : ''}・落選${rec.losses}回`);
      if (rec.won && rec.won.length) row('当選した選挙', rec.won.join('・'), 2);
      if (rec.pmDays) row('内閣総理大臣', spanText(rec.pmDays));
      if (rec.ministerDays) row('国務大臣', spanText(rec.ministerDays));
      if (rec.posts.length) row('主な役職', rec.posts.join('・'), 2);
      row('成立させた法律', rec.laws ? `${rec.laws}本${rec.lawTitles.length ? `：${rec.lawTitles.map((s) => `「${s}」`).join('')}` : ''}` : 'なし', 3);
      if (rec.einen) row('表彰', `永年在職議員表彰（${rec.einen}）`);
      T(c, rec.date, x + w - 28, y + h - 30, 12, C.inkDim, 'right');
      if (v.t > 18) {
        const s2 = clamp((v.t - 18) / 8, 0, 1);
        c.save(); c.translate(x + w - 70, y + h - 70); c.scale(1 + (1 - s2) * 0.6, 1 + (1 - s2) * 0.6); c.globalAlpha = s2;
        stampArt(c, { x: -32, y: -32, w: 64, h: 64 }, /辞職/.test(rec.how) && !/引退/.test(rec.how) ? '辞職' : '引退', '#8a6a1a');
        c.restore(); c.globalAlpha = 1;
      }
    },
  };
  return v;
}
// withdraw what the player has filed (or announced) before leaving politics
function dropFilings(g) {
  const p = polOf(g);
  for (const e of p.elections.upcoming) if (myDecl(e) && e.status !== 'done') g.withdrawCandidacy(e.id);
  if (p.me.intent) p.me.intent = null;
}
SECTIONS.retire = async (ui) => {
  const g = ui.g;
  if (!involved(g) && !uiData(g).retire) { await ui.alert('進退', 'まだ政治家としての歩みはない。\n選挙に立候補するか、政党に入ってから。'); return; }
  let idx = 0;
  for (let guard = 0; guard < 30; guard++) {
    const p = polOf(g);
    const me = p.me;
    const d = uiData(g);
    const ann = d.retire && !d.retire.done ? d.retire : null;
    const done = d.retire && d.retire.done ? d.retire : null;
    const O = me.office ? OFFICES[me.office] : null;
    const exec = O && O.level === 'exec';
    const items = [];
    if (O) items.push({ id: 'resign', label: exec ? `${O.short}を辞職する` : '議員辞職', sub: 'いまの職を辞める（また立候補はできる）', labelColor: '#ffb0b8' });
    if (O && !ann) items.push({ id: 'announce', label: '政界引退を表明', sub: '任期の終わりまで務め、次の選挙に出ない' });
    if (ann) items.push({ id: 'undo', label: '引退表明を撤回する', sub: '次の選挙に出られるようになる（評判↓）' });
    if (O || !done) items.push({ id: 'now', label: O ? '辞職して、いますぐ政界引退' : '政界引退を表明', sub: O ? '職も党の役職も退く' : '党の役職も退く', labelColor: '#ffb0b8' });
    if (Array.isArray(d.career) && d.career.length) items.push({ id: 'card', label: '政治家としての歩み', sub: `${d.career[0].date}の記録`, labelColor: C.cyan });
    const preview = careerRecord(g, '');
    const i = await ui.menu({ title: '進退', listTitle: '政治家としての進退', listW: 300, rowH: 34, items, index: idx,
      detail: (c, it, r) => {
        card(c, r.x, r.y, r.w, r.h, it && it.id === 'card' ? '記録' : 'これまでの歩み');
        const x = r.x + 10, w = r.w - 20;
        let y = r.y + 26;
        const line2 = (a, b, col = C.text) => { T(c, a, x, y, 12, C.dim); T(c, fit(c, b, w - 96, 12), x + w, y, 12, col, 'right'); y += 17; };
        line2('いまの立場', O ? O.label : me.formerOffice ? `元${OFFICES[me.formerOffice].short}` : '民間人', O ? C.gold : C.text);
        line2('政治家として', preview.since ? spanText(preview.span) : preview.wins ? '—' : '当選の経験はない');
        line2('当選・落選', `${preview.wins}回・${preview.losses}回`);
        if (preview.pmDays) line2('総理大臣', spanText(preview.pmDays), C.gold);
        if (preview.ministerDays) line2('大臣', spanText(preview.ministerDays));
        line2('成立させた法律', `${preview.laws}本`);
        if (ann) { T(c, '引退を表明している（任期まで務める）', x, y, 12, C.warn); y += 17; }
        if (done && !O) { T(c, fit(c, `${dateLabel(g, done.done)}に政界を引退した`, w, 12), x, y, 12, C.dim); y += 17; }
        y += 6;
        R(c, x - 4, y - 4, w + 8, 1, C.edge);
        const pr = !!(me.prElected || /比例/.test(String(me.district || '')));
        const desc = {
          resign: `${exec ? '任期の途中で職を退く（議会の議長に申し出る）。' : '議長の許可を得て、議員を辞める（会期中は本会議で許可）。'}${O && (O.level === 'national') ? (pr ? '比例代表の議席は、名簿の次の人に移る（繰上補充）。' : '空いた議席は補欠選挙で埋まる。') : '欠員は補欠選挙などで埋まる。'}${p.cabinet.pm === 'player' ? '総理大臣が議員を辞めれば、内閣は総辞職する。' : inCabinet(me) ? '大臣も退く。' : ''}`,
          announce: '次の選挙には立候補しないと表明する。任期の終わり（衆議院なら解散でも）まで、これまでどおり務める。後継は地元の有権者が選ぶ。',
          undo: '表明を取り消して、次の選挙に出られるようにする。「話が違う」という声で、評判は少し下がる。',
          now: O ? 'いますぐ職を辞めて、政界から身を引く。党の役職も後進にゆずる（自分の党は、ほかの議員に託す）。' : '政界から身を引くと表明する。党の役職も後進にゆずる。',
          card: '引退のときにまとめた、政治家としての記録。',
        }[it && it.id] || '';
        para(c, desc, x, y + 2, w, 12, C.text, 16, 8);
      },
      tip: () => '政治家の進退は、自分で決めるもの。表明のしかたで評判も変わる',
    });
    if (i < 0) return;
    idx = i;
    const it = items[i];
    if (it.disabled) continue;
    if (it.id === 'card') { await ui.open(careerCardView(g, d.career[0])); continue; }
    if (it.id === 'undo') {
      const k = await ui.confirm({ title: '引退表明の撤回', text: '引退の表明を取り消す？\n次の選挙に立候補できるようになるが、評判は少し下がる。', choices: ['撤回する', 'やめておく'] });
      if (k !== 0) continue;
      d.retire = null;
      me.reputation = clamp(num(me.reputation) - 3, -100, 100);
      ui.toast('引退表明を撤回した', C.warn);
      continue;
    }
    if (it.id === 'announce') {
      const filed = p.elections.upcoming.some((e) => myDecl(e) && e.status !== 'done') || !!me.intent;
      const k = await ui.confirm({ title: '政界引退を表明', w: 460, text: `次の選挙には立候補せず、${O.label}の任期かぎりで政界を引退すると表明する？\n任期中は、これまでどおり務める。${filed ? '\n届け出ている立候補（出馬表明）は取り下げる。' : ''}`, choices: ['表明する', 'やめておく'], tip: '引退の表明は、後援会や党の候補者選びにも関わる' });
      if (k !== 0) continue;
      dropFilings(g);
      d.retire = { day: today(g), office: me.office, mode: 'term' };
      await ui.open(pressView(g, { board: '引退表明 記者会見', tip: '引退の表明は、地元の後援会や党に先に伝えるのがならわし', lines: [
        [playerName(g), `次の選挙には立候補いたしません。${O.label}としての今期をもって、政界を引退いたします。`],
        [playerName(g), '残りの任期は、最後の一日まで全力で務めます。'],
        ['記者', '後継はどうされますか？'],
        [playerName(g), 'それは地元の皆さまが選ぶことです。新しい人が出てくることを願っています。'],
      ] }));
      ui.toast('引退を表明した（任期まで務める）', C.gold);
      continue;
    }
    if (it.id === 'resign' || it.id === 'now') {
      const full = it.id === 'now';
      const pm = p.cabinet.pm === 'player';
      const k = await ui.confirm({ title: full ? '政界引退' : it.label, danger: true, w: 460,
        text: full
          ? `${O ? `${O.label}を辞職し、` : ''}政界から引退する？${pm ? '\n内閣は総辞職する。' : ''}\n党の役職も退く。あとで復帰することもできる。`
          : `${O.label}を辞職する？${pm ? '\n総理大臣のあなたが辞職すれば、内閣は総辞職する。' : ''}\nあとで、また立候補することはできる。`,
        choices: [full ? '引退しない' : '辞職しない', full ? '引退する' : '辞職する'], index: 0, cancel: 0 });
      if (k !== 1) continue;
      const rec = careerRecord(g, full ? (O ? '辞職して政界引退' : '政界引退') : `${exec ? '' : '議員'}辞職`);
      dropFilings(g);
      if (O && !g.resignOffice(full ? '政界引退' : exec ? '辞職' : '議員辞職')) { await ui.alert('辞職', g.lastPoliticsError || '辞職できなかった。'); continue; }
      if (full || ann) {
        // the party posts go to others; a founder hands the party on (the core dissolves it when empty)
        const me2 = polOf(g).me;
        const pt = p.parties[me2.party];
        if (pt && pt.leader === 'player') g.leaveParty({ why: '政界引退' });
        else for (const x of me2.posts.slice()) if (POSTS[x] && POSTS[x].kind === 'party') g.resignPost(x, '政界引退');
        if (!full) rec.how = '辞職して政界引退';
        finishRetire(g, rec);
      }
      const name = playerName(g);
      await ui.open(pressView(g, full || ann ? { board: '引退 記者会見', tip: '引退しても、党員として、また一人の有権者として政治に関わることはできる', lines: [
        [name, O ? `本日、${exec ? '議会の議長に退職を申し出ました' : '議長に辞職願を提出しました'}。政界を引退いたします。` : '本日をもって、政界を引退いたします。'],
        [name, '支えてくださった皆さまに、心から感謝申し上げます。'],
        ['記者', '心残りはありますか？'],
        [name, rec.laws ? `「${rec.lawTitles[0]}」を形にできたことは、私の誇りです。あとは次の世代に託します。` : '志なかばのことも多くあります。後に続く人たちに託します。'],
      ] } : { board: '辞職 記者会見', tip: exec ? '首長が任期の途中で辞めると、選挙で新しい首長を選ぶ' : '国会議員の辞職は、会期中は本会議で、閉会中は議長が許可する（国会法107条）', lines: [
        [name, `本日、${exec ? '議会の議長に退職を申し出ました' : '議長に辞職願を提出しました'}。`],
        [name, 'ご迷惑をおかけする皆さまには、申し訳なく思っています。'],
        ['記者', '今後はどうされますか？'],
        [name, 'しばらくは一人の民間人として、地元を歩きます。'],
      ] }));
      if (full || ann) await ui.open(careerCardView(g, rec));
      else ui.toast(`${O.label}を辞職した`, C.dim);
      return;
    }
  }
};

// ================================================================ ニュース
SECTIONS.news = async (ui) => {
  const g = ui.g;
  const p = polOf(g);
  const items = p.news.map((n) => ({ label: n.text, sub: dateLabel(g, n.day) }));
  await ui.menu({ title: '政治ニュース', listTitle: `最近の政治ニュース（${items.length}件）`, listW: 380, rowH: 34, items, empty: 'まだ政治ニュースはない',
    detail: (c, it, r) => {
      card(c, r.x, r.y, r.w, r.h, 'ドット新聞 政治面');
      if (!it) return;
      T(c, it.sub, r.x + 10, r.y + 26, 12, C.dim);
      para(c, it.label, r.x + 10, r.y + 44, r.w - 20, 14, '#ffffff', 20, 10);
      T(c, '※ゲームの中のシミュレーション', r.x + 10, r.y + r.h - 20, 12, C.faint);
    },
    tip: () => 'このゲームの政治はシミュレーション。実在の政治家は登場しない',
  });
};
SECTIONS.cabinet = (ui) => ui.open(cabinetView(ui.g));
