// 相方募集 — the flashy skin (owner: R9-C). Drawing, taps, modals and effects for the 相方募集 screen of owarai_ui.js (its
// BoardScreen delegates here) and an overlay for the meeting scene (MeetScene). Each board is drawn in its era's own medium:
// 雑誌の投稿欄 (paper, red ink, a starburst masthead), パソコン通信 (green phosphor, a blinking cursor, a modem), ネット掲示板
// (a 90s homepage in a browser window: marquee, access counter, blinking NEW!), ケータイ掲示板 (status bar, antenna, number keys),
// ブログ (pastel, falling petals), SNS (a dark timeline, a trending tag, a live counter), 相方募集アプリ (pink gradient, MATCH!).
// やりとり / 自分の募集 use the player's device of the era: 手帳 (showa / heisei_early), ケータイ (heisei), アプリ (reiwa).
// Profile cards: portrait (a silhouette until you meet, on boards without photos), chips, a 6-axis stat chart (自己PR → 第一印象 →
// ネタ合わせで判明, with your own outline to compare), a 相性メーター (よそう from what you can see → 手ごたえ after the trial →
// コンビ仲), status stamps, NEW badges (st.owarai.net.uiSeen), the contact effect and the match effect when a reply arrives
// (st.owarai.net.uiAck). Nothing here changes a flow: acting still goes through the tab's act (candAct / postAct).
// Desktop: header 0..30, tabs 30..50, list 6..232 / card 238..634 (y 52..334), ticker 336..360.
// Touch (body.touch): 70-unit tabs and ×, a 2×3 grid of 70-unit cards (+ a 70-unit pager) → a full-width card with 70-unit
// もどる / action buttons; modals with 70-unit rows and buttons.

import { SW, SH, clamp, shade, makeCanvas } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { drawFaceHD } from './sprites.js';
import { confetti, sparkles } from './contests_tv.js';
import { BOARDS, MEET_SPOTS, STYLES, ROLES, CANDIDATES, STAT_SHORT, candStats, num, dateOf, eraKey, strHash } from './owarai_data.js';
import { PREFECTURES } from './profile.js';
import { PEOPLE } from './life.js';

const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const has = (g, k) => !!g && typeof g[k] === 'function';
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const ease = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const TB = 70; // touch: tab bar height, × cell, every button and card

// ---------------------------------------------------------------- text (every string gets a width: no overflow)
const FIT = new Map();
function fit(c, s, w, size) {
  s = String(s ?? '');
  if (!w || w <= 0) return w <= 0 && w !== 0 ? '' : s;
  const key = `${size}|${Math.round(w)}|${s}`;
  const hit = FIT.get(key);
  if (hit !== undefined) return hit;
  let out = s;
  if (measure(c, s, size) > w) {
    const a = Array.from(s);
    let lo = 0, hi = a.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(c, a.slice(0, mid).join('') + '…', size) <= w) lo = mid; else hi = mid - 1; }
    out = lo ? a.slice(0, lo).join('') + '…' : '';
  }
  FIT.set(key, out);
  if (FIT.size > 600) FIT.delete(FIT.keys().next().value);
  return out;
}
function T(c, s, x, y, size = 12, color = '#ffffff', align = 'left', w = 0, outline = null) {
  text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: null, outline });
}
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const TOKEN = /[−\-]?[0-9０-９]+(?:[.,][0-9]+)*(?:[／/][0-9]+)?(?:[%％年月日歳人分万円倍回本点期]+)?|[A-Za-z0-9.,:%/+\-#@_'’]+|\s+|./gu;
const WRAP = new Map();
function wrapJ(c, str, w, size = 12) {
  const key = `${size}|${Math.round(w)}|${str}`;
  const hit = WRAP.get(key);
  if (hit) return hit;
  measure(c, '', size);
  const Wd = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = par.match(TOKEN) || [];
    let ln = '';
    for (const t of toks) {
      if (!ln && /^\s+$/.test(t)) continue;
      if (Wd(ln + t) <= w) { ln += t; continue; }
      if (!ln) { for (const ch of Array.from(t)) { if (ln && Wd(ln + ch) > w) { out.push(ln); ln = ''; } ln += ch; } continue; }
      let carry = '';
      if (Array.from(t).length === 1 && NO_START.has(t)) { const a0 = Array.from(ln); carry = a0.pop(); ln = a0.join(''); }
      while (ln.length > 1 && NO_END.has(ln[ln.length - 1])) { carry = ln[ln.length - 1] + carry; ln = ln.slice(0, -1); }
      out.push(ln);
      ln = carry + (/^\s+$/.test(t) ? '' : t);
    }
    out.push(ln);
  }
  WRAP.set(key, out);
  if (WRAP.size > 300) WRAP.delete(WRAP.keys().next().value);
  return out;
}
function para(c, s, x, y, w, size = 12, color = '#ffffff', lh = 0, maxLines = 99) {
  const ls = wrapJ(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? ls[i] + '…' : ls[i], x, y + i * step, size, color, 'left', w);
  return n * step;
}
function rrect(c, x, y, w, h, r, fill, stroke = null, lw = 1) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function grad(c, x, y, w, h, c0, c1, vertical = false) {
  const gr = c.createLinearGradient(x, y, vertical ? x : x + w, vertical ? y + h : y);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  c.fillStyle = gr;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function star(c, cx, cy, r0, r1, n, rot, fill, stroke = null) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n; const r = i % 2 ? r1 : r0; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  c.closePath();
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); }
}
function heart(c, cx, cy, s, col) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(cx, cy + s * 0.9);
  c.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 0.9, cy - s * 0.9, cx, cy - s * 0.3);
  c.bezierCurveTo(cx + s * 0.9, cy - s * 0.9, cx + s * 1.3, cy + s * 0.1, cx, cy + s * 0.9);
  c.fill();
}

// ---------------------------------------------------------------- themes (one per medium)
// tab: the tab look; stamp: the status-stamp look; dark: light text on a dark ground
export const THEMES = {
  magazine: { id: 'magazine', bg: '#efe4c8', paper: '#fbf4e2', ink: '#2a2018', sub: '#7a6650', accent: '#c0392b', accent2: '#1f4f9f', line: '#d6c6a2', sel: '#f8dcae', head0: '#d8402e', head1: '#9a1e12', headInk: '#fff6dc', tab: 'paper', stamp: 'hanko', dark: false, btnInk: '#fff6dc' },
  techo: { id: 'techo', bg: '#4a2c1c', paper: '#f6f0dc', ink: '#1c2c64', sub: '#6a6478', accent: '#b8322a', accent2: '#1c6a4a', line: '#cbd6ea', sel: '#ffeab0', head0: '#6a4028', head1: '#2e180c', headInk: '#ecd08a', tab: 'paper', stamp: 'hanko', dark: false, btnInk: '#fff6dc' },
  bbs: { id: 'bbs', bg: '#020a04', paper: '#03140a', ink: '#5cff7a', sub: '#2fa84a', accent: '#d4ff6a', accent2: '#5cff7a', line: '#0f5a22', sel: '#0d4a1c', head0: '#06301a', head1: '#020a04', headInk: '#5cff7a', tab: 'inverse', stamp: 'tag', dark: true, btnInk: '#020a04' },
  web: { id: 'web', bg: '#c0c0c0', paper: '#ffffff', ink: '#000000', sub: '#505050', accent: '#0000cc', accent2: '#cc0000', line: '#9a9a9a', sel: '#000080', selInk: '#ffffff', head0: '#000080', head1: '#1084d0', headInk: '#ffffff', tab: 'bevel', stamp: 'tag', dark: false, btnInk: '#000000' },
  keitai: { id: 'keitai', bg: '#081634', paper: '#122a5c', ink: '#ffffff', sub: '#a8bfec', accent: '#ffcc33', accent2: '#ff5aa0', line: '#2a4c8c', sel: '#ff7a1a', selInk: '#ffffff', head0: '#1c3e86', head1: '#0a1a40', headInk: '#ffffff', tab: 'pill', stamp: 'pill', dark: true, btnInk: '#1a1206' },
  blog: { id: 'blog', bg: '#fdeef3', paper: '#ffffff', ink: '#4a3038', sub: '#a07c88', accent: '#e0628a', accent2: '#4a9a7a', line: '#f4cbd8', sel: '#ffe2ec', head0: '#f7a8c0', head1: '#e0628a', headInk: '#ffffff', tab: 'ribbon', stamp: 'round', dark: false, btnInk: '#ffffff' },
  sns: { id: 'sns', bg: '#15202b', paper: '#1e2a36', ink: '#e7e9ea', sub: '#8b98a5', accent: '#4aa8f0', accent2: '#f0486a', line: '#2f3b47', sel: '#263646', head0: '#1e2a36', head1: '#15202b', headInk: '#e7e9ea', tab: 'underline', stamp: 'pill', dark: true, btnInk: '#ffffff' },
  app: { id: 'app', bg: '#fff0f4', paper: '#ffffff', ink: '#3a2030', sub: '#a07890', accent: '#ff4f86', accent2: '#ff9a3c', line: '#ffd0de', sel: '#ffe4ec', head0: '#ff4f86', head1: '#ff9a3c', headInk: '#ffffff', tab: 'segment', stamp: 'pill', dark: false, btnInk: '#ffffff' },
};
const homeKind = (g) => { const e = eraKey(g); return e === 'reiwa' ? 'app' : e === 'heisei' ? 'keitai' : 'techo'; };
export function themeOf(ui) {
  const tb = ui.tab;
  if (tb && tb.board && THEMES[tb.board.kind]) return THEMES[tb.board.kind];
  return THEMES[homeKind(ui.g)];
}
const kindOf = (board) => (BOARDS[board] && BOARDS[board].kind) || 'sns';
// the words a medium uses for a status
const STAMP = { sent: ['返事待ち', '#c98a00'], replied: ['返事あり！', '#1f9a4a'], met: ['会った', '#2a6fc0'], declined: ['見送り', '#7a7a7a'], refused: ['ことわられた', '#c0392b'], formed: ['相方', '#d4a017'], ex: ['もと相方', '#8a6a3a'] };
const STAMP_WORD = { app: { replied: 'マッチ！', sent: 'いいね済' }, sns: { replied: 'DMあり', sent: 'DM送信済' }, bbs: { replied: 'RE:あり', sent: '送信済' }, magazine: { replied: '返事あり', sent: '投函済' }, keitai: { replied: '受信あり' } };
function stampOf(th, status) {
  const s = STAMP[status];
  if (!s) return null;
  const w = (STAMP_WORD[th.id] || {})[status] || s[0];
  return [w, s[1]];
}

// ---------------------------------------------------------------- small pixel icons (12×12 units, scaled)
export function icon(c, kind, x, y, s = 1, th = THEMES.sns) {
  const P = (px, py, w, h, col) => R(c, x + px * s, y + py * s, w * s, h * s, col);
  switch (kind) {
    case 'magazine': P(0, 2, 12, 9, '#fffaf0'); P(0, 2, 12, 1, '#8a6a4a'); P(0, 10, 12, 1, '#8a6a4a'); P(0, 2, 1, 9, '#8a6a4a'); P(11, 2, 1, 9, '#8a6a4a'); P(2, 4, 2, 2, '#d8402e'); P(4, 4, 2, 2, '#d8402e'); P(8, 4, 3, 3, '#d8402e'); P(2, 7, 6, 1, '#8a6a4a'); P(2, 9, 5, 1, '#8a6a4a'); break;
    case 'techo': P(1, 0, 10, 12, '#6a4028'); P(2, 1, 8, 10, '#f6f0dc'); P(3, 3, 6, 1, '#9ab0d8'); P(3, 5, 6, 1, '#9ab0d8'); P(3, 7, 6, 1, '#9ab0d8'); P(8, 0, 2, 12, '#c0392b'); break;
    case 'bbs': P(0, 1, 12, 9, '#9a9a8a'); P(1, 2, 10, 7, '#020a04'); P(2, 3, 5, 1, '#5cff7a'); P(2, 5, 7, 1, '#5cff7a'); P(2, 7, 2, 1, '#5cff7a'); P(4, 10, 4, 1, '#6a6a5a'); P(2, 11, 8, 1, '#6a6a5a'); break;
    case 'web': P(0, 1, 12, 10, '#c0c0c0'); P(0, 1, 12, 2, '#000080'); P(10, 1, 2, 2, '#c0c0c0'); P(1, 4, 10, 6, '#ffffff'); P(2, 5, 3, 3, '#3a7ad8'); P(6, 5, 4, 1, '#0000cc'); P(6, 7, 3, 1, '#808080'); break;
    case 'keitai': P(3, 0, 1, 3, '#c0c8d8'); P(3, 2, 7, 10, '#c0c8d8'); P(4, 3, 5, 4, '#3a8ae0'); P(5, 4, 3, 1, '#ffffff'); P(4, 8, 1, 1, '#405070'); P(6, 8, 1, 1, '#405070'); P(8, 8, 1, 1, '#405070'); P(4, 10, 1, 1, '#405070'); P(6, 10, 1, 1, '#405070'); P(8, 10, 1, 1, '#405070'); break;
    case 'blog': P(2, 9, 2, 2, '#4a3038'); P(3, 7, 2, 2, '#f0c080'); P(5, 5, 2, 2, '#e0628a'); P(7, 3, 2, 2, '#e0628a'); P(9, 1, 2, 2, '#c84a72'); P(1, 11, 10, 1, '#e0628a'); break;
    case 'sns': c.fillStyle = '#4aa8f0'; c.beginPath(); c.arc(x + 6 * s, y + 5.5 * s, 5.5 * s, 0, Math.PI * 2); c.fill(); P(2, 9, 3, 3, '#4aa8f0'); P(3, 5, 1, 1, '#ffffff'); P(6, 5, 1, 1, '#ffffff'); P(9, 5, 1, 1, '#ffffff'); break;
    case 'app': heart(c, x + 6 * s, y + 6.2 * s, 5.2 * s, '#ff4f86'); P(3, 4, 2, 1, 'rgba(255,255,255,0.7)'); break;
    case 'contacts': P(0, 2, 12, 9, '#fffaf0'); P(0, 2, 12, 1, th.accent); P(0, 10, 12, 1, th.accent); P(0, 2, 1, 9, th.accent); P(11, 2, 1, 9, th.accent); P(1, 3, 2, 1, th.accent); P(3, 4, 2, 1, th.accent); P(5, 5, 2, 1, th.accent); P(7, 4, 2, 1, th.accent); P(9, 3, 2, 1, th.accent); break;
    case 'post': P(1, 1, 8, 10, '#ffffff'); P(1, 1, 8, 1, th.accent); P(2, 3, 6, 1, '#9a9a9a'); P(2, 5, 6, 1, '#9a9a9a'); P(2, 7, 4, 1, '#9a9a9a'); P(8, 6, 2, 2, th.accent); P(9, 5, 2, 2, th.accent); P(10, 4, 2, 2, th.accent); break;
    default: P(2, 2, 8, 8, th.accent);
  }
}
const tabKind = (tb) => (tb && tb.board ? tb.board.kind : tb && tb.id === 'contacts' ? 'contacts' : 'post');

// ---------------------------------------------------------------- the dates of a medium
const md = (g, day) => { const d = dateOf(g, day); return `${d.month}/${(d.dom - 1) * 3 + 1}`; };
function postedAgo(id) { return 1 + (strHash(id) % 9); }
function stampTime(g, th, id) {
  const ago = postedAgo(id);
  const day = Math.max(1, num(g.state && g.state.day, 1) - ago);
  const d = dateOf(g, day);
  const rd = (d.dom - 1) * 3 + 1;
  const h = 18 + (strHash(id + 'h') % 8), mi = strHash(id + 'm') % 60;
  const hm = `${String(h % 24).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
  const yy = String(d.year).slice(2);
  const p2 = (n) => String(n).padStart(2, '0');
  switch (th.id) {
    case 'magazine': return `${d.year}年${d.month}月号`;
    case 'bbs': return `${yy}/${p2(d.month)}/${p2(rd)} ${hm}`;
    case 'web': return `${d.year}/${p2(d.month)}/${p2(rd)} ${hm}`;
    case 'keitai': return `${d.month}/${rd} ${hm}`;
    case 'blog': return `${d.year}.${p2(d.month)}.${p2(rd)}`;
    case 'sns': return ago <= 1 ? `${1 + (strHash(id) % 20)}時間前` : `${ago}日前`;
    case 'app': return ago <= 2 ? 'オンライン' : `${ago}日前にログイン`;
    default: return `${d.month}月${rd}日`;
  }
}

// ---------------------------------------------------------------- state kept in the save (lazy): NEW badges, acknowledged replies
function netOf(g) { return safe(() => (g.__ow && g.__ow.ensure(g) ? g.__ow.ensure(g).net : null), null); }
function isSeen(g, id) { const n = netOf(g); return !!(n && n.uiSeen && n.uiSeen[id]); }
function markSeen(g, id) { const n = netOf(g); if (!n) return; if (!n.uiSeen || typeof n.uiSeen !== 'object') n.uiSeen = {}; n.uiSeen[id] = 1; }
const ackKey = (ct) => `${num(ct && ct.sent)}|${num(ct && ct.replyDay)}`;

// ---------------------------------------------------------------- what a card shows
const AX = ['neta', 'boke', 'tsukkomi', 'ma', 'act', 'chara'];
function prKeys(id) {
  const c = CANDIDATES[id];
  if (!c) return [];
  return String(c.hi || '').split(/[,\s]+/).filter(Boolean).map((p) => p.split(':')[0]).filter((k) => STAT_SHORT[k]);
}
function myStats(g) { const o = g.state && g.state.owarai; return (o && o.stats) || {}; }
function candStatsNow(g, id) { const o = g.state && g.state.owarai; const m = o && o.members && o.members[id]; return (m && m.stats) || candStats(id) || {}; }
// the chart: level pr (before meeting: their own 自己PR only), first (met: rounded), full (after the trial / your 相方)
export function statView(g, x) {
  const level = x.member || x.status === 'formed' || x.trial != null ? 'full' : x.met ? 'first' : 'pr';
  const raw = candStatsNow(g, x.id);
  const stats = {};
  for (const k of AX) stats[k] = level === 'first' ? Math.round(num(raw[k]) / 10) * 10 : num(raw[k]);
  return { level, stats, mine: myStats(g), pr: prKeys(x.id) };
}
// the compatibility meter: a guess from what you can see (roles, the style you asked for, the level gap, 笑いの文化),
// the trial's 手ごたえ once you tried, the コンビ仲 once you are a combi. The hidden 相性 is never shown.
export function meterView(g, x) {
  if (x.member) {
    const u = safe(() => (has(g, 'unit') ? g.unit() : null), null);
    if (u && u.type !== 'pin') return { v: clamp(num(u.harmony, 50), 0, 100), band: 0, label: 'コンビ仲', kind: 'harmony' };
  }
  if (x.trial != null) return { v: clamp(num(x.trial), 0, 100), band: 0, label: 'ネタ合わせの手ごたえ', kind: 'trial' };
  const mine = myStats(g);
  const myRole = num(mine.boke) >= num(mine.tsukkomi) ? 'boke' : 'tsukkomi';
  let v = 50;
  if (x.role === 'both') v += 4; else v += x.role !== myRole ? 14 : -12;
  const o = g.state && g.state.owarai;
  const post = o && o.net && o.net.post;
  if (post && post.style) v += x.style === post.style || x.style === 'both' ? 8 : -8;
  const raw = candStatsNow(g, x.id);
  const avg = (s) => AX.reduce((a, k) => a + num(s[k]), 0) / AX.length;
  v += 10 - Math.min(22, Math.abs(avg(raw) - avg(mine)) * 0.7);
  const pref = g.state && g.state.profile && PREFECTURES[g.state.profile.pref];
  const cp = PREFECTURES[x.pref];
  if (pref && cp && (pref.region === 'kansai') === (cp.region === 'kansai')) v += 4;
  return { v: clamp(Math.round(v), 8, 92), band: x.met ? 12 : 20, label: x.met ? '相性よそう（第一印象）' : '相性よそう', kind: 'guess' };
}
// the button: what A does first (candAct opens the full list)
function actionOf(x) {
  const B = BOARDS[x.board] || {};
  const spot = MEET_SPOTS[B.meet];
  if (x.member || x.status === 'formed') return { label: 'いまの相方', sub: 'コンビ結成ずみ', live: false };
  if (x.status === 'sent') return { label: '返事待ち…', sub: B.reply ? `${B.via || 'メール'}の返事は${B.reply[0]}〜${B.reply[1]}日` : '', live: false };
  const more = [x.canMeet, x.met && x.trial != null && (x.status === 'met' || x.status === 'ex'), x.canContact].filter(Boolean).length > 1 ? '…' : '';
  if (x.canMeet) return { label: `会いに行く${more}`, sub: spot ? `${spot.name}・${spot.drink}代` : '', live: true };
  if (x.met && x.trial != null && (x.status === 'met' || x.status === 'ex')) return { label: `コンビを組もう${more}`, sub: x.feel || '', live: true };
  if (x.canContact) return { label: B.contact || '連絡する', sub: B.via ? `${B.via}で連絡` : '', live: true };
  if (x.status === 'refused') return { label: 'いまは連絡できない', sub: '日をおいてから', live: false };
  return { label: '…', sub: '', live: false };
}
const prefName = (k) => (PREFECTURES[k] ? PREFECTURES[k].name : '');
const styleShort = (s) => String(STYLES[s] || '').replace('中心', '');
const at = (th, h) => (th.id === 'sns' && !String(h).startsWith('@') ? '@' : '') + h;

// ---------------------------------------------------------------- portraits
function silhouette(c, th, x, y, w, h) {
  R(c, x, y, w, h, th.dark ? '#26323e' : '#d8d2c8');
  const cx = x + w / 2;
  c.fillStyle = th.dark ? '#3e4c5a' : '#b0a898';
  c.beginPath(); c.arc(cx, y + h * 0.42, Math.min(w, h) * 0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(cx, y + h * 0.98, w * 0.34, h * 0.3, 0, Math.PI, 0); c.fill();
  T(c, '？', cx, y + h * 0.3, Math.max(10, Math.round(h * 0.22)), th.dark ? '#c8d4e0' : '#ffffff', 'center');
}
function portrait(c, th, look, x, y, w, h, known = true) {
  if (!known || !look) { silhouette(c, th, x, y, w, h); return; }
  R(c, x, y, w, h, th.dark ? '#2a3a4a' : '#e4ecf4');
  R(c, x, y + h - Math.round(h * 0.3), w, Math.round(h * 0.3), th.dark ? '#22303c' : '#d0dce8');
  const s = Math.max(1, Math.min(w / 32, h / 24) * 0.95);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  try { drawFaceHD(c, look, x + (w - 32 * s) / 2, y + (h - 24 * s) / 2 + 2, s); } catch (e) { /* no face */ }
  c.restore();
}
function frame(c, th, x, y, w, h) {
  if (th.id === 'app' || th.id === 'sns') { R(c, x - 2, y - 2, w + 4, h + 4, th.accent); return; }
  if (th.id === 'magazine' || th.id === 'techo') { R(c, x - 3, y - 3, w + 6, h + 8, '#ffffff'); R(c, x - 3, y + h + 4, w + 6, 1, '#c8b898'); return; }
  if (th.id === 'web') { R(c, x - 2, y - 2, w + 4, 2, '#808080'); R(c, x - 2, y - 2, 2, h + 4, '#808080'); R(c, x - 2, y + h, w + 4, 2, '#ffffff'); R(c, x + w, y - 2, 2, h + 4, '#ffffff'); return; }
  R(c, x - 1, y - 1, w + 2, h + 2, th.line);
}
const faceKnown = (x) => !!(x.photo || x.met || x.member);

// ---------------------------------------------------------------- stamps, badges, chips
// a status stamp, slammed in (k 0..1 of the slam), right edge at x when align 'right'. Returns its width.
function stampDraw(c, th, x, y, label, col, k = 1, align = 'right', size = 10) {
  const w = Math.ceil(measure(c, label, size)) + 12, h = size + 8;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  const sc = 1 + (1 - ease(k)) * 0.9;
  c.save();
  c.globalAlpha = clamp(k * 1.6, 0, 1);
  c.translate(x0 + w / 2, y + h / 2);
  c.rotate(th.stamp === 'hanko' || th.stamp === 'round' ? -0.12 : 0);
  c.scale(sc, sc);
  if (th.stamp === 'hanko') {
    rrect(c, -w / 2, -h / 2, w, h, 4, 'rgba(255,255,255,0.35)', col, 2);
    rrect(c, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 3, null, col, 1);
    T(c, label, 0, -size / 2 - 1, size, col, 'center');
  } else if (th.stamp === 'tag') {
    R(c, -w / 2, -h / 2, w, h, th.id === 'bbs' ? th.ink : col);
    T(c, label, 0, -size / 2 - 1, size, th.id === 'bbs' ? th.bg : '#ffffff', 'center');
  } else if (th.stamp === 'round') {
    rrect(c, -w / 2, -h / 2, w, h, h / 2, '#ffffff', col, 2);
    T(c, label, 0, -size / 2 - 1, size, col, 'center');
  } else {
    rrect(c, -w / 2, -h / 2, w, h, h / 2, col);
    T(c, label, 0, -size / 2 - 1, size, '#ffffff', 'center');
  }
  c.restore();
  return w;
}
// NEW badge (each medium's own), right edge at x. Returns its width.
function newBadge(c, th, x, y, t, size = 10) {
  const word = { magazine: '新着', techo: '新', bbs: 'NEW', web: 'NEW!', keitai: 'NEW', blog: 'new♪', sns: 'NEW', app: 'NEW' }[th.id] || 'NEW';
  const w = Math.ceil(measure(c, word, size)) + 10, h = size + 6;
  const x0 = x - w;
  const blink = Math.floor(t / 16) % 2 === 0;
  if (th.id === 'magazine' || th.id === 'techo') {
    c.save(); c.translate(x0 + w / 2, y + h / 2); c.rotate((t % 120) * 0.004);
    star(c, 0, 0, w * 0.62, w * 0.42, 10, 0, '#ffd23f', '#c0392b');
    c.restore();
    T(c, word, x0 + w / 2, y + 2, size, '#c0392b', 'center');
  } else if (th.id === 'web') {
    R(c, x0, y, w, h, blink ? '#ff0000' : '#ffff00');
    T(c, word, x0 + w / 2, y + 2, size, blink ? '#ffff00' : '#ff0000', 'center');
  } else if (th.id === 'bbs') {
    if (blink) R(c, x0, y, w, h, th.ink);
    T(c, word, x0 + w / 2, y + 2, size, blink ? th.bg : th.ink, 'center');
  } else if (th.id === 'keitai') {
    rrect(c, x0, y, w, h, 3, blink ? '#ff3a3a' : '#ffcc33');
    T(c, word, x0 + w / 2, y + 2, size, blink ? '#ffffff' : '#3a1a00', 'center');
  } else if (th.id === 'sns') {
    c.fillStyle = th.accent; c.beginPath(); c.arc(x - 5, y + h / 2, 3.5 + (blink ? 0.8 : 0), 0, Math.PI * 2); c.fill();
    T(c, word, x - 12, y + 2, size, th.accent, 'right');
  } else {
    rrect(c, x0, y, w, h, h / 2, th.id === 'blog' ? '#ff8ab0' : th.accent);
    T(c, word, x0 + w / 2, y + 2, size, '#ffffff', 'center');
  }
  return w;
}
function chip(c, th, x, y, s, size = 10, col = null) {
  const w = Math.ceil(measure(c, s, size)) + 10, h = size + 6;
  if (th.id === 'bbs') { T(c, `[${s}]`, x, y + 2, size, col || th.sub); return measure(c, `[${s}]`, size) + 4; }
  rrect(c, x, y, w, h, th.id === 'web' || th.id === 'magazine' || th.id === 'techo' ? 1 : h / 2, col ? shade(col, th.dark ? -0.45 : 0.78) : th.dark ? shade(th.paper, 0.12) : shade(th.accent, 0.86));
  T(c, s, x + 5, y + 3, size, col || (th.dark ? th.ink : shade(th.accent, -0.35)));
  return w + 4;
}

// ---------------------------------------------------------------- the stat chart and the meter
export function radar(c, th, cx, cy, r, view, t, k = 1, size = 10) {
  const n = AX.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / n; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v]; };
  c.save();
  c.lineWidth = 1;
  // rings + spokes
  for (const ring of [1, 0.66, 0.33]) {
    c.beginPath(); for (let i = 0; i < n; i++) { const [px, py] = pt(i, ring); if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath();
    if (ring === 1) { c.fillStyle = th.dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; c.fill(); }
    c.strokeStyle = th.line; c.stroke();
  }
  for (let i = 0; i < n; i++) { const [px, py] = pt(i, 1); c.beginPath(); c.moveTo(cx, cy); c.lineTo(px, py); c.strokeStyle = th.line; c.stroke(); }
  let top = 40;
  for (const key of AX) top = Math.max(top, num(view.stats && view.stats[key]), view.level !== 'pr' ? num(view.mine && view.mine[key]) : 0);
  const scale = Math.min(100, Math.ceil((top * 1.12) / 10) * 10);
  const val = (s, key) => clamp(num(s[key]) / scale, 0.04, 1) * k;
  // you (dashed outline) to compare with
  if (view.mine && view.level !== 'pr') {
    c.setLineDash([3, 2]);
    c.beginPath(); AX.forEach((key, i) => { const [px, py] = pt(i, val(view.mine, key)); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath();
    c.strokeStyle = th.accent2; c.lineWidth = 1.5; c.stroke();
    c.setLineDash([]);
  }
  if (view.level === 'pr') {
    // only what they wrote about themselves: a star on each strong axis
    AX.forEach((key, i) => {
      const [px, py] = pt(i, view.pr.includes(key) ? 0.78 * k : 0.0);
      if (view.pr.includes(key)) star(c, px, py, 5.5, 2.4, 5, -Math.PI / 2 + t * 0.03, th.accent, null);
    });
    T(c, '？', cx, cy - 6, 12, th.sub, 'center');
  } else {
    c.beginPath(); AX.forEach((key, i) => { const [px, py] = pt(i, val(view.stats, key)); if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath();
    c.globalAlpha = view.level === 'full' ? 0.42 : 0.24; c.fillStyle = th.accent; c.fill(); c.globalAlpha = 1;
    if (view.level === 'first') c.setLineDash([4, 3]);
    c.strokeStyle = th.accent; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
    if (view.level === 'full') AX.forEach((key, i) => { const [px, py] = pt(i, val(view.stats, key)); R(c, px - 1.5, py - 1.5, 3, 3, th.accent); });
  }
  c.restore();
  // labels
  AX.forEach((key, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
    const lx = cx + Math.cos(a) * (r + 6), ly = cy + Math.sin(a) * (r + 6);
    const al = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
    const strong = view.level === 'pr' ? view.pr.includes(key) : num(view.stats[key]) >= 50;
    T(c, STAT_SHORT[key], lx, ly - size / 2 - (Math.sin(a) < -0.5 ? size / 2 : Math.sin(a) > 0.5 ? -size / 2 + 2 : 0), size, strong ? th.accent : th.sub, al);
  });
}
// a semicircle gauge 0..100; m = meterView(); nv = the needle's animated value
export function meter(c, th, cx, cy, r, m, nv, t, size = 10) {
  c.save();
  const zone = (a0, a1, col) => { c.beginPath(); c.arc(cx, cy, r, Math.PI + a0 * Math.PI, Math.PI + a1 * Math.PI); c.strokeStyle = col; c.lineWidth = Math.max(5, r * 0.18); c.stroke(); };
  zone(0, 0.4, th.dark ? '#a8344a' : '#f08a8a');
  zone(0.4, 0.6, th.dark ? '#b08a2a' : '#f4d070');
  zone(0.6, 1, th.dark ? '#2a9a5a' : '#7cd49a');
  if (m.band) {
    c.globalAlpha = 0.28;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r + 3, Math.PI + clamp(m.v - m.band, 0, 100) / 100 * Math.PI, Math.PI + clamp(m.v + m.band, 0, 100) / 100 * Math.PI); c.closePath();
    c.fillStyle = th.accent; c.fill(); c.globalAlpha = 1;
  }
  // ticks
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    const r0 = r - Math.max(5, r * 0.18) / 2 - (i % 5 ? 2 : 4), r1 = r - Math.max(5, r * 0.18) / 2;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.strokeStyle = th.sub; c.lineWidth = 1; c.stroke();
  }
  const a = Math.PI + clamp(nv, 0, 100) / 100 * Math.PI;
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); c.strokeStyle = th.dark ? '#ffffff' : '#2a2030'; c.lineWidth = 2.5; c.stroke();
  c.fillStyle = th.accent; c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fill();
  c.restore();
  const vs = m.kind === 'guess' ? `${Math.round(m.v / 10) * 10}前後` : `${Math.round(clamp(nv, 0, 100))}`;
  T(c, vs, cx, cy + 4, size + 2, m.kind === 'guess' ? th.sub : m.v >= 60 ? (th.dark ? '#5ee07a' : '#1f9a4a') : m.v >= 40 ? (th.dark ? '#ffcc4d' : '#b07a00') : (th.dark ? '#ff6470' : '#c0392b'), 'center', r * 2 + 30);
  T(c, m.label, cx, cy - r - size - 6, size, th.sub, 'center', r * 2 + 60);
}

// ---------------------------------------------------------------- backgrounds (cached) and decorations
const cache = new Map();
function cached(key, w, h, paint) {
  let cv = cache.get(key);
  if (cv) return cv;
  if (typeof document === 'undefined') return null;
  const [canvas, x] = makeCanvas(w, h);
  paint(x, w, h);
  cache.set(key, canvas);
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  return canvas;
}
function paintBg(c, th) {
  const cv = cached(`bg|${th.id}`, SW, SH, (k, W, H) => {
    k.fillStyle = th.bg; k.fillRect(0, 0, W, H);
    if (th.id === 'magazine') { k.fillStyle = 'rgba(160,110,60,0.10)'; for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) k.fillRect(x, y, 1, 1); }
    else if (th.id === 'techo') { k.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 3) for (let x = (y * 7) % 5; x < W; x += 5) k.fillRect(x, y, 1, 1); k.fillStyle = 'rgba(236,208,138,0.35)'; for (let x = 4; x < W - 4; x += 6) { k.fillRect(x, 3, 3, 1); k.fillRect(x, H - 4, 3, 1); } }
    else if (th.id === 'bbs') { k.fillStyle = 'rgba(92,255,122,0.035)'; for (let y = 0; y < H; y += 2) k.fillRect(0, y, W, 1); const rg = k.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.6)'); k.fillStyle = rg; k.fillRect(0, 0, W, H); }
    else if (th.id === 'web') { k.fillStyle = '#e8f0f8'; k.fillRect(4, 4, W - 8, H - 8); k.fillStyle = 'rgba(80,120,200,0.10)'; for (let y = 4; y < H; y += 12) for (let x = 4 + ((y / 12) % 2) * 6; x < W; x += 12) k.fillRect(x, y, 2, 2); }
    else if (th.id === 'keitai') { const gr = k.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#12306a'); gr.addColorStop(1, '#050c20'); k.fillStyle = gr; k.fillRect(0, 0, W, H); k.fillStyle = 'rgba(120,170,255,0.06)'; for (let x = 0; x < W; x += 16) k.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 16) k.fillRect(0, y, W, 1); }
    else if (th.id === 'blog') { k.fillStyle = 'rgba(224,98,138,0.10)'; for (let y = 6; y < H; y += 14) for (let x = 6 + ((y / 14) % 2) * 7; x < W; x += 14) { k.beginPath(); k.arc(x, y, 2, 0, Math.PI * 2); k.fill(); } }
    else if (th.id === 'sns') { k.fillStyle = 'rgba(255,255,255,0.02)'; for (let y = 0; y < H; y += 24) k.fillRect(0, y, W, 1); }
    else if (th.id === 'app') { const gr = k.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#fff4f7'); gr.addColorStop(1, '#ffe6ee'); k.fillStyle = gr; k.fillRect(0, 0, W, H); }
  });
  if (cv) c.drawImage(cv, 0, 0, SW, SH); else R(c, 0, 0, SW, SH, th.bg);
}
// floating things over the background (hearts, petals, sparkles): a handful of shapes per frame
function ambient(c, th, t, x, y, w, h) {
  if (th.id === 'app') for (let i = 0; i < 7; i++) { const sp = 0.25 + hash(i * 7) * 0.35; const py = y + h - ((t * sp + hash(i * 3) * h) % (h + 20)); const px = x + hash(i * 11) * w + Math.sin(t * 0.03 + i) * 8; c.globalAlpha = 0.18; heart(c, px, py, 4 + hash(i) * 4, '#ff4f86'); c.globalAlpha = 1; }
  else if (th.id === 'blog') for (let i = 0; i < 8; i++) { const sp = 0.2 + hash(i * 5) * 0.3; const py = y + ((t * sp + hash(i * 9) * h) % h); const px = x + hash(i * 13) * w + Math.sin(t * 0.02 + i) * 10; c.globalAlpha = 0.3; c.fillStyle = i % 2 ? '#f7a8c0' : '#ffd0de'; c.beginPath(); c.ellipse(px, py, 3, 1.8, t * 0.02 + i, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  else if (th.id === 'keitai') sparkles(c, t, x, y, w, h, 6, 4, 'rgba(255,230,140,0.7)');
  else if (th.id === 'sns') sparkles(c, t, x, y, w, h, 4, 9, 'rgba(120,190,255,0.45)');
}

// ---------------------------------------------------------------- header (desktop) — the masthead of each medium, animated
function dateLine(g) {
  const d = dateOf(g);
  const ck = safe(() => (has(g, 'clock') ? g.clock() : null), null);
  return { y: d.year, m: d.month, d: ck && ck.date ? ck.date : (d.dom - 1) * 3 + 1, hm: ck && ck.label ? ck.label : '' };
}
function drawHeader(ui, c, th, g) {
  const t = ui.t;
  const D = dateLine(g);
  const H = 30;
  const closeX = SW - 28;
  const counts = ui._counts || { replied: 0, all: 0 };
  switch (th.id) {
    case 'magazine': {
      grad(c, 0, 0, SW, H, th.head0, th.head1, true);
      R(c, 0, H - 2, SW, 2, '#ffd23f');
      c.save(); c.translate(10, 5); c.transform(1, 0, -0.16, 1, 0, 0);
      T(c, '月刊 わらいの友', 0, 0, 18, '#fff6dc', 'left', 0, '#6a0c06');
      c.restore();
      const sx = 196, sy = 15;
      c.save(); c.translate(sx, sy); c.rotate(Math.sin(t * 0.05) * 0.12);
      const pulse = 1 + Math.sin(t * 0.15) * 0.05; c.scale(pulse, pulse);
      star(c, 0, 0, 22, 15, 12, t * 0.01, '#ffd23f', '#9a1e12');
      T(c, '相方', 0, -10, 9, '#c0392b', 'center'); T(c, '募集!', 0, 0, 9, '#c0392b', 'center');
      c.restore();
      T(c, `${D.y}年${D.m}月号　特集：いっしょに笑いをとる仲間`, closeX - 8, 9, 10, '#fff6dc', 'right', closeX - 240);
      break;
    }
    case 'techo': {
      grad(c, 0, 0, SW, H, th.head0, th.head1, true);
      for (let x = 6; x < SW - 6; x += 7) R(c, x, H - 4, 4, 1, 'rgba(236,208,138,0.45)');
      R(c, 18, 0, 8, H + 6, '#b8322a'); R(c, 18, H + 6, 4, 3, '#b8322a'); R(c, 22, H + 6, 4, 2, '#8a2018');
      T(c, '芸人手帳　相方さがしメモ', 36, 7, 14, th.headInk, 'left', 260, '#2e180c');
      T(c, `${D.y}年${D.m}月${D.d}日`, closeX - 8, 9, 10, '#ecd08a', 'right', 200);
      break;
    }
    case 'bbs': {
      R(c, 0, 0, SW, H, '#010703');
      R(c, 0, H - 1, SW, 1, th.line);
      T(c, '＊ ドットネット ＊　お笑い会議室', 10, 3, 12, th.ink, 'left', 300);
      const bps = Math.floor(t / 90) % 2 ? '2400bps' : '1200bps';
      T(c, `[接続中 ${bps}]　${String(D.y).slice(2)}/${String(D.m).padStart(2, '0')}/${String(D.d).padStart(2, '0')} ${D.hm}`, 10, 17, 10, th.sub, 'left', 300);
      const cur = Math.floor(t / 20) % 2 === 0;
      const lw = Math.min(300, measure(c, '＊ ドットネット ＊　お笑い会議室', 12));
      if (cur) R(c, 14 + lw, 4, 7, 12, th.ink);
      // the receive lamp of the modem
      const lamp = (Math.floor(t / 6) % 5) < 2;
      T(c, 'RD', closeX - 64, 9, 10, th.sub); R(c, closeX - 46, 11, 6, 6, lamp ? th.accent : '#0a2a12');
      T(c, 'SD', closeX - 34, 9, 10, th.sub); R(c, closeX - 16, 11, 6, 6, Math.floor(t / 40) % 4 === 0 ? th.accent : '#0a2a12');
      break;
    }
    case 'web': {
      grad(c, 0, 0, SW, 16, th.head0, th.head1);
      icon(c, 'web', 4, 2, 1, th);
      T(c, 'お笑い相方募集BBS - ドットブラウザ', 20, 2, 10, '#ffffff', 'left', 360);
      R(c, 0, 16, SW, 14, '#c0c0c0'); R(c, 0, 29, SW, 1, '#808080');
      T(c, 'アドレス', 6, 18, 9, '#000000');
      R(c, 48, 17, 300, 12, '#ffffff'); R(c, 48, 17, 300, 1, '#808080'); R(c, 48, 17, 1, 12, '#808080');
      T(c, 'http://www.dot-owarai.ne.jp/aikata/bbs.cgi', 51, 18, 9, '#000000', 'left', 294);
      // the access counter
      const n = String(1234 + num(g.state && g.state.day) * 7 + Math.floor(t / 240)).padStart(6, '0');
      T(c, 'あなたは', 360, 18, 9, '#000000');
      for (let i = 0; i < 6; i++) { R(c, 402 + i * 9, 17, 8, 12, '#000000'); T(c, n[i], 406 + i * 9, 18, 9, '#ff3a3a', 'center'); }
      T(c, '人目のお客様です', 460, 18, 9, '#000000', 'left', closeX - 466);
      break;
    }
    case 'keitai': {
      grad(c, 0, 0, SW, 13, '#0a1a40', '#122a5c', true);
      // antenna (it wobbles like a real signal)
      const bars = 1 + (Math.floor(t / 37) % 3 === 0 ? 1 : 2);
      for (let i = 0; i < 3; i++) R(c, 6 + i * 4, 9 - i * 3, 3, 3 + i * 3, i < bars + 1 ? '#ffffff' : '#3a4a6a');
      T(c, 'ドットWEB', 22, 1, 9, '#a8c8ff');
      if (counts.replied) { icon(c, 'contacts', 84, 0, 1, th); if (Math.floor(t / 15) % 2) T(c, '新着', 99, 1, 9, '#ffcc33'); }
      T(c, D.hm || `${D.m}/${D.d}`, SW / 2, 1, 9, '#ffffff', 'center');
      R(c, closeX - 30, 3, 16, 7, '#ffffff'); R(c, closeX - 29, 4, 14, 5, '#122a5c'); R(c, closeX - 28, 5, 10, 3, '#5ee07a'); R(c, closeX - 14, 5, 2, 3, '#ffffff');
      grad(c, 0, 13, SW, 17, th.head0, th.head1, true);
      const tw = ['★', '☆'][Math.floor(t / 12) % 2];
      T(c, `${tw}ドット掲示板${tw}相方募集`, 10, 14, 12, '#ffcc33', 'left', 300);
      T(c, `${D.y}年${D.m}月${D.d}日`, closeX - 8, 16, 10, '#a8c8ff', 'right', 200);
      break;
    }
    case 'blog': {
      grad(c, 0, 0, SW, H, '#ffd6e4', '#fbe9d4');
      R(c, 0, H - 3, SW, 3, th.accent);
      for (let x = 0; x < SW; x += 12) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + 6, H - 3, 4, Math.PI, 0); c.fill(); }
      T(c, 'ドットブログ', 10, 3, 10, th.sub);
      T(c, '#相方募集', 10, 13, 14, th.accent, 'left', 140, '#ffffff');
      for (let i = 0; i < 4; i++) { const k = (t * 0.04 + i * 1.6); T(c, '♪', 150 + i * 16, 8 + Math.sin(k) * 4, 10, ['#e0628a', '#f0a050', '#4a9a7a', '#7a8ae0'][i]); }
      T(c, `${D.y}.${String(D.m).padStart(2, '0')}.${String(D.d).padStart(2, '0')}　きょうも笑顔で♪`, closeX - 8, 10, 10, th.sub, 'right', 260);
      break;
    }
    case 'sns': {
      R(c, 0, 0, SW, H, th.head1); R(c, 0, H - 1, SW, 1, th.line);
      icon(c, 'sns', 8, 6, 1.5, th);
      T(c, 'ドッター', 30, 8, 12, th.ink);
      rrect(c, 96, 6, 150, 18, 9, '#22303c');
      T(c, '#相方募集', 108, 9, 10, th.accent);
      const live = 800 + Math.floor((num(g.state && g.state.day) * 37) % 900) + Math.floor(t / 50) % 40;
      T(c, `トレンド入り・${live.toLocaleString()}件`, 252, 10, 10, th.sub, 'left', 170);
      if (counts.replied) { rrect(c, closeX - 112, 6, 104, 18, 9, th.accent); T(c, `DM ${counts.replied}件`, closeX - 60, 9, 10, '#ffffff', 'center'); }
      else T(c, `${D.m}月${D.d}日 ${D.hm}`, closeX - 8, 10, 10, th.sub, 'right', 160);
      break;
    }
    case 'app': {
      grad(c, 0, 0, SW, H, th.head0, th.head1);
      const pul = 1 + Math.max(0, Math.sin(t * 0.12)) * 0.18;
      c.save(); c.translate(18, 15); c.scale(pul, pul); heart(c, 0, 0, 9, '#ffffff'); c.restore();
      T(c, 'アイカタ・マッチ', 32, 6, 16, '#ffffff', 'left', 200, '#c8245a');
      T(c, '芸人志望どうしの相方さがし', 220, 10, 10, '#fff0f4', 'left', 180);
      if (counts.replied) { rrect(c, closeX - 112, 6, 104, 18, 9, '#ffffff'); T(c, `マッチ ${counts.replied}件！`, closeX - 60, 9, 10, th.accent, 'center'); }
      else T(c, `${D.m}/${D.d} ${D.hm}`, closeX - 8, 10, 10, '#ffffff', 'right', 120);
      break;
    }
    default: R(c, 0, 0, SW, H, th.head1);
  }
  // ×
  const cx0 = SW - 26;
  if (th.id === 'web') { R(c, cx0 + 6, 2, 14, 12, '#c0c0c0'); R(c, cx0 + 6, 13, 14, 1, '#404040'); T(c, '×', cx0 + 13, 2, 10, '#000000', 'center'); }
  else T(c, '×', cx0 + 13, 7, 14, th.id === 'blog' ? th.accent : th.id === 'magazine' || th.id === 'app' || th.id === 'techo' ? '#ffffff' : th.headInk, 'center');
  ui.closeRect = { x: SW - 30, y: 0, w: 30, h: 30 };
}

// ---------------------------------------------------------------- tabs (desktop and touch)
function drawTabs(ui, c, th, y, h, w, size) {
  ui.tabRects = [];
  const tabs = ui.cfg.tabs;
  const tw = w / tabs.length;
  const target = ui.tabIdx * tw;
  ui.ulX = ui.ulX == null ? target : ui.ulX + (target - ui.ulX) * 0.3;
  const big = h >= 40;
  tabs.forEach((tb, i) => {
    const x = Math.round(i * tw), ww = Math.round((i + 1) * tw) - x, on = i === ui.tabIdx;
    const lit = on && ui.focus === 'tabs';
    let ink = th.ink;
    switch (th.tab) {
      case 'paper': R(c, x + 1, y + (on ? 0 : 3), ww - 2, h - (on ? 0 : 3), on ? th.accent : th.id === 'techo' ? '#e8dcbc' : '#e6d7b2'); if (on) R(c, x + 1, y, ww - 2, 2, '#ffd23f'); ink = on ? '#fff6dc' : th.id === 'techo' ? '#4a3a2a' : th.ink; break;
      case 'inverse': R(c, x + 1, y + 1, ww - 2, h - 2, on ? th.ink : '#03140a'); R(c, x + 1, y + h - 1, ww - 2, 1, th.line); ink = on ? th.bg : th.ink; break;
      case 'bevel': R(c, x + 1, y + 1, ww - 2, h - 2, on ? '#d4d0c8' : '#c0c0c0'); R(c, x + 1, y + 1, ww - 2, 1, on ? '#808080' : '#ffffff'); R(c, x + 1, y + 1, 1, h - 2, on ? '#808080' : '#ffffff'); R(c, x + 1, y + h - 2, ww - 2, 1, on ? '#ffffff' : '#404040'); R(c, x + ww - 2, y + 1, 1, h - 2, on ? '#ffffff' : '#404040'); ink = on ? '#000080' : '#000000'; break;
      case 'pill': rrect(c, x + 3, y + 2, ww - 6, h - 4, (h - 4) / 2, on ? th.sel : '#16306a', on ? '#ffcc33' : th.line, 1); ink = '#ffffff'; break;
      case 'ribbon': R(c, x + 2, y + 2, ww - 4, h - 4, on ? th.accent : '#ffffff'); R(c, x + 2, y + h - 3, ww - 4, 1, th.line); ink = on ? '#ffffff' : th.ink; break;
      case 'underline': R(c, x, y, ww, h, on ? '#1b2733' : th.bg); ink = on ? th.ink : th.sub; break;
      case 'segment': rrect(c, x + 3, y + 2, ww - 6, h - 4, (h - 4) / 2, on ? th.accent : '#ffffff', on ? null : th.line, 1); ink = on ? '#ffffff' : th.ink; break;
      default: R(c, x + 1, y + 1, ww - 2, h - 2, on ? th.accent : th.paper);
    }
    if (lit) { c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(ui.t * 0.2); R(c, x + 1, y + 1, ww - 2, h - 2, '#ffffff'); c.restore(); }
    const kind = tabKind(tb);
    const label = tb.label;
    // the icon shrinks (or goes) before the label is cut
    const lwFull = measure(c, label, size);
    const isz = big ? (lwFull + 28 + 8 <= ww ? 2 : lwFull + 16 + 8 <= ww ? 1 : 0) : (lwFull + 16 + 8 <= ww ? 1 : 0);
    const lw = Math.min(lwFull, ww - 8 - 14 * isz);
    const total = lw + (isz ? 12 * isz + 4 : 0);
    const lx = x + Math.max(4, (ww - total) / 2);
    const iy = y + Math.round((h - 12 * isz) / 2);
    if (isz) {
      if (on && ['paper', 'segment', 'ribbon', 'pill'].includes(th.tab)) rrect(c, lx - 2, iy - 2, 12 * isz + 4, 12 * isz + 4, 3, 'rgba(255,255,255,0.85)');
      icon(c, kind, lx, iy, isz, th);
    }
    T(c, label, lx + (isz ? 12 * isz + 4 : 0), y + Math.round((h - size) / 2) - 1, size, ink, 'left', ww - 8 - 14 * isz);
    if (tb.alert && safe(() => tb.alert(ui), false)) { const pulse = 3 + Math.abs(Math.sin(ui.t * 0.15)) * 1.5; c.fillStyle = '#ff3a50'; c.beginPath(); c.arc(x + ww - (big ? 12 : 7), y + (big ? 12 : 6), pulse, 0, Math.PI * 2); c.fill(); }
    ui.tabRects.push({ x, y, w: ww, h });
  });
  if (th.tab === 'underline' || th.tab === 'pill' || th.tab === 'segment' || th.tab === 'ribbon') R(c, ui.ulX + 10, y + h - 3, tw - 20, 3, th.tab === 'segment' || th.tab === 'ribbon' ? th.accent2 : th.accent);
}

// ---------------------------------------------------------------- the list rows
function visRows(ui) { const out = []; ui.rows().forEach((r, i) => { if (!r.header) out.push({ r, i }); }); return out; }
function rowStamp(c, th, x, y, r, t, size) {
  const cand = r.c;
  if (!cand) return 0;
  if (cand.status === 'none') return isSeenCache(r) ? 0 : newBadge(c, th, x, y, t, size);
  const s = stampOf(th, cand.status);
  return s ? stampDraw(c, th, x, y, s[0], s[1], 1, 'right', size) : 0;
}
const isSeenCache = (r) => !!r._seen;
function drawRow(ui, c, th, r, x, y, w, h, sel, touch) {
  const g = ui.g;
  const t = ui.t;
  const big = touch;
  const cand = r.c;
  // background
  if (sel) {
    if (th.id === 'web') R(c, x, y, w, h - 2, th.sel);
    else if (th.id === 'bbs') { R(c, x, y, w, h - 2, th.sel); R(c, x, y, 3, h - 2, th.ink); }
    else { rrect(c, x, y, w, h - 2, th.id === 'magazine' || th.id === 'techo' ? 1 : 6, th.sel, th.accent, 2); }
    if (ui.focus === 'body') { c.save(); c.globalAlpha = 0.08 + 0.06 * Math.sin(t * 0.15); R(c, x, y, w, h - 2, '#ffffff'); c.restore(); }
  } else if (th.id === 'magazine' || th.id === 'techo' || th.id === 'blog' || th.id === 'app' || th.id === 'web') {
    rrect(c, x, y, w, h - 2, th.id === 'app' || th.id === 'blog' ? 6 : 1, th.paper, th.line, 1);
  } else { R(c, x, y + h - 2, w, 1, th.line); }
  const ink = sel && th.selInk ? th.selInk : th.ink;
  const sub = sel && th.selInk ? '#d8e0ff' : th.sub;
  if (!cand) {
    // the 自分の募集 rows
    const isNew = r.key === 'new';
    icon(c, isNew ? 'post' : 'contacts', x + 8, y + (h - 24) / 2, 2, th);
    T(c, r.label, x + 40, y + (big ? 14 : 8), big ? 15 : 12, isNew ? (sel && th.selInk ? ink : th.accent) : ink, 'left', w - 50 - (r.right ? 40 : 0));
    if (r.right) T(c, r.right, x + w - 8, y + (big ? 16 : 10), big ? 12 : 10, sub, 'right');
    T(c, isNew ? 'A：書いて出す' : 'いま出している募集', x + 40, y + (big ? 38 : 24), big ? 12 : 10, sub, 'left', w - 50);
    return;
  }
  const av = big ? 52 : 34;
  const ax = x + 6, ay = y + Math.round((h - 2 - av) / 2);
  frame(c, th, ax, ay, av, av);
  portrait(c, th, cand.look, ax, ay, av, av, faceKnown(cand));
  if (!faceKnown(cand)) icon(c, th.id === 'techo' ? kindOf(cand.board) : th.id, ax + av - 14, ay + av - 12, 1, th);
  const tx = ax + av + 8;
  const sw = 0;
  // the stamp / NEW on the right (measured first so the name never runs under it)
  const sz = big ? 11 : 9;
  const stw = cand.status === 'none' ? (r._seen ? 0 : Math.ceil(measure(c, 'NEW!', sz)) + 14) : (stampOf(th, cand.status) ? Math.ceil(measure(c, stampOf(th, cand.status)[0], sz)) + 14 : 0);
  void sw;
  const nm = r.label;
  const prefix = th.id === 'bbs' ? `${String(140 + (strHash(cand.id) % 80)).padStart(4, '0')} ` : th.id === 'keitai' ? `${'①②③④⑤⑥⑦⑧⑨'[Math.min(8, r._n || 0)]}` : '';
  T(c, prefix + nm, tx, y + (big ? 8 : 4), big ? 15 : 12, sel && th.selInk ? ink : th.id === 'sns' || th.id === 'app' || th.id === 'blog' ? (sel ? th.accent : ink) : ink, 'left', x + w - tx - stw - 6);
  T(c, `${cand.age}歳・${styleShort(cand.style)}・${ROLES[cand.role] || ''}`, tx, y + (big ? 30 : 20), big ? 12 : 10, sub, 'left', x + w - tx - 8);
  T(c, cand.met ? `${prefName(cand.pref)}　${cand.persona ? cand.persona : ''}` : stampTime(g, THEMES[kindOf(cand.board)] || th, cand.id), tx, y + (big ? 48 : 31), big ? 11 : 9, sub, 'left', x + w - tx - 8);
  rowStamp(c, th, x + w - 6, y + (big ? 8 : 4), r, t, sz);
}
function listTitle(ui, c, th, x, y, w, h, s, right) {
  if (th.id === 'web') { R(c, x, y, w, h, '#000080'); T(c, s, x + 6, y + (h - 10) / 2 - 1, 10, '#ffffff', 'left', w - 60); }
  else if (th.id === 'bbs') { R(c, x, y + h - 1, w, 1, th.line); T(c, `== ${s} ==`, x + 4, y + (h - 10) / 2 - 1, 10, th.accent, 'left', w - 60); }
  else if (th.id === 'magazine' || th.id === 'techo') { R(c, x, y, w, h, th.id === 'techo' ? '#e8dcbc' : '#2a2018'); T(c, s, x + 6, y + (h - 10) / 2 - 1, 10, th.id === 'techo' ? th.ink : '#fff6dc', 'left', w - 60); }
  else { rrect(c, x, y, w, h, 4, th.dark ? shade(th.paper, 0.06) : shade(th.accent, 0.82)); T(c, s, x + 6, y + (h - 10) / 2 - 1, 10, th.dark ? th.accent : shade(th.accent, -0.35), 'left', w - 60); }
  if (right) T(c, right, x + w - 6, y + (h - 10) / 2 - 1, 10, th.id === 'web' ? '#ffffff' : th.sub, 'right', 56);
}
function prepRows(ui) {
  const g = ui.g;
  let n = 0;
  for (const r of ui.rows()) { if (r.header) continue; r._n = n++; if (r.c) r._seen = r.c.status !== 'none' || isSeen(g, r.c.id); }
}
function drawListDesk(ui, c, th) {
  const L = { x: 6, y: 52, w: 226, h: 282 };
  const rows = ui.rows();
  const vis = visRows(ui);
  const st = ui.ls();
  const head = rows.find((r) => r.header);
  listTitle(ui, c, th, L.x, L.y, L.w, 18, head ? head.label : '', vis.length && ui.tab.board ? `${vis.length}件` : '');
  const RH = 43, n = 6, y0 = L.y + 20;
  const vi = Math.max(0, vis.findIndex((v) => v.i === st.i));
  st.vtop = clamp(st.vtop || 0, 0, Math.max(0, vis.length - n));
  if (vi < st.vtop) st.vtop = vi;
  if (vi >= st.vtop + n) st.vtop = vi - n + 1;
  if (!vis.length) para(c, ui.tab.id === 'contacts' ? 'まだだれにも連絡していない。\n掲示板の投稿から連絡するか、自分の募集を出そう。' : '（なし）', L.x + 8, y0 + 8, L.w - 16, 12, th.sub, 18, 6);
  for (let k = 0; k < n && st.vtop + k < vis.length; k++) {
    const { r, i } = vis[st.vtop + k];
    const y = y0 + k * RH;
    const sel = i === st.i;
    const kk = ease((ui.t - (ui.tabT || 0) - k * 2) / 10);
    c.save();
    if (kk < 1) { c.globalAlpha = clamp(kk, 0, 1); c.translate(Math.round((1 - kk) * -20), 0); }
    drawRow(ui, c, th, r, L.x, y, L.w, RH, sel && ui.focus === 'body' ? true : sel, false);
    c.restore();
    ui.hits.push({ x: L.x, y, w: L.w, h: RH - 2, row: i });
  }
  if (vis.length > n) { const h = Math.max(12, (258 * n) / vis.length); R(c, L.x + L.w + 1, y0 + ((258 - h) * st.vtop) / Math.max(1, vis.length - n), 3, h, th.accent); }
}

// ---------------------------------------------------------------- the card (profile / thread / meter / chart / action)
function cardPanel(c, th, x, y, w, h) {
  if (th.id === 'magazine') { R(c, x + 3, y + 3, w, h, 'rgba(90,60,30,0.25)'); R(c, x, y, w, h, th.paper); R(c, x, y, w, 3, th.accent); R(c, x, y + h - 1, w, 1, th.line); }
  else if (th.id === 'techo') { R(c, x, y, w, h, th.paper); for (let yy = y + 26; yy < y + h; yy += 16) R(c, x + 4, yy, w - 8, 1, th.line); R(c, x + 30, y, 1, h, '#f0b0b0'); }
  else if (th.id === 'bbs') { R(c, x, y, w, h, th.paper); R(c, x, y, w, 1, th.line); R(c, x, y + h - 1, w, 1, th.line); R(c, x, y, 1, h, th.line); R(c, x + w - 1, y, 1, h, th.line); }
  else if (th.id === 'web') { R(c, x, y, w, h, '#ffffff'); R(c, x, y, w, 1, '#808080'); R(c, x, y, 1, h, '#808080'); R(c, x, y + h - 1, w, 1, '#dfdfdf'); R(c, x + w - 1, y, 1, h, '#dfdfdf'); }
  else if (th.id === 'keitai') { rrect(c, x, y, w, h, 8, th.paper, '#4a6cb0', 1); }
  else if (th.id === 'blog') { rrect(c, x + 2, y + 3, w, h, 8, 'rgba(224,98,138,0.15)'); rrect(c, x, y, w, h, 8, '#ffffff', th.line, 1); }
  else if (th.id === 'sns') { rrect(c, x, y, w, h, 10, th.paper, th.line, 1); }
  else if (th.id === 'app') { rrect(c, x + 2, y + 4, w, h, 14, 'rgba(255,79,134,0.18)'); rrect(c, x, y, w, h, 14, '#ffffff', th.line, 1); }
  else R(c, x, y, w, h, th.paper);
}
// the post as the medium shows it (magazine: a classified ad; bbs: a log line; web: a BBS entry; keitai/blog/sns/app: a bubble)
function drawPostBody(c, th, x, y, w, h, s, opts = {}) {
  const size = opts.size || 12, lh = size + 5;
  const lines = Math.max(1, Math.floor((h - (opts.foot ? lh : 0)) / lh));
  if (th.id === 'magazine' || th.id === 'techo') {
    T(c, th.id === 'techo' ? '■ 募集の文' : '【相方募集】', x, y, size, th.accent, 'left', w);
    para(c, s, x, y + lh, w, size, th.ink, lh, lines - 1);
  } else if (th.id === 'bbs') {
    para(c, `> ${s}`, x, y, w, size, th.ink, lh, lines);
  } else if (th.id === 'web') {
    R(c, x, y + 1, w, 1, '#c0c0c0');
    para(c, s, x, y + 6, w, size, '#000000', lh, lines);
  } else {
    const bh = Math.min(h, para(c, s, -9999, -9999, w - 16, size, th.ink, lh, lines) + 12);
    rrect(c, x, y, w, bh, th.id === 'keitai' ? 4 : 10, th.dark ? shade(th.paper, 0.08) : th.id === 'app' ? '#fff4f8' : th.id === 'blog' ? '#fff8fa' : '#f4f8ff', th.line, 1);
    para(c, s, x + 8, y + 6, w - 16, size, th.ink, lh, lines);
  }
  if (opts.foot) T(c, opts.foot, x, y + h - lh + 2, size - 2, th.sub, 'left', w);
}
function threadOf(g, x) {
  const ct = safe(() => g.netStatus(x.id), null) || {};
  const B = BOARDS[x.board] || {};
  const spot = MEET_SPOTS[B.meet];
  const out = [];
  if (ct.by === 'them') out.push({ who: 'them', text: '募集を見ました！一度会って話しませんか？', day: ct.sent });
  else if (ct.sent) out.push({ who: 'me', text: `はじめまして！募集を見て${B.contact === 'いいね！を送る' ? 'いいね！しました' : '連絡しました'}。`, day: ct.sent });
  if (x.status === 'sent') out.push({ who: 'sys', text: `返事待ち…（${B.via || 'メール'}はふつう${B.reply ? `${B.reply[0]}〜${B.reply[1]}日` : '数日'}）` });
  else if (ct.by !== 'them' && ct.sent && ['replied', 'met', 'formed', 'ex', 'declined', 'refused'].includes(x.status)) {
    const rt = safe(() => (has(g, 'owaraiReplyText') ? g.owaraiReplyText(x.id, true) : ''), '') || '一度会って話しませんか？';
    out.push({ who: 'them', text: rt.split('\n').filter((l) => !/^（/.test(l)).join(''), day: ct.replyDay });
  }
  if (ct.met) out.push({ who: 'sys', text: `${md(g, ct.met)} ${spot ? spot.name : 'お店'}で会った${num(ct.meets) > 1 ? `（${num(ct.meets)}回）` : ''}` });
  if (Number.isFinite(ct.trial)) out.push({ who: 'sys', text: `おためしネタ合わせ：${ct.feel || ''}（${ct.trial}）`, col: ct.trial >= 55 ? 'good' : 'warn' });
  if (x.status === 'formed' || x.member) out.push({ who: 'sys', text: 'コンビ結成！', col: 'gold' });
  if (x.status === 'refused') out.push({ who: 'sys', text: 'ことわられた（実力をつけて、日をおいてから）', col: 'bad' });
  if (x.status === 'declined') out.push({ who: 'sys', text: '今回は見送った', col: 'dim' });
  return out;
}
function drawThread(ui, c, th, x0, y0, w, h, cand, size = 11) {
  const g = ui.g;
  const items = threadOf(g, cand);
  const lh = size + 4;
  // measure from the newest back: show what fits
  const blocks = items.map((it) => {
    const ls = wrapJ(c, it.text, it.who === 'sys' ? w - 12 : w - 64, size).slice(0, 4);
    return { it, ls, h: it.who === 'sys' ? ls.length * lh + 6 : ls.length * lh + 12 + (it.day ? 0 : 0) };
  });
  let total = 0, from = blocks.length;
  while (from > 0 && total + blocks[from - 1].h + 4 <= h) { total += blocks[from - 1].h + 4; from--; }
  let y = y0;
  const colOf = (k) => ({ good: th.dark ? '#5ee07a' : '#1f9a4a', warn: th.dark ? '#ffcc4d' : '#b07a00', bad: th.dark ? '#ff6470' : '#c0392b', gold: th.dark ? '#ffd23f' : '#c08a00', dim: th.sub }[k] || th.sub);
  blocks.slice(from).forEach((b, k) => {
    const it = b.it;
    const kk = ease((ui.t - (ui.cardT || 0) - k * 5) / 10);
    c.save(); c.globalAlpha = clamp(kk, 0, 1);
    if (it.who === 'sys') {
      const bw = Math.min(w, Math.max(...b.ls.map((l) => measure(c, l, size))) + 12);
      rrect(c, x0 + (w - bw) / 2, y, bw, b.h, 4, th.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)');
      b.ls.forEach((l, i) => T(c, l, x0 + w / 2, y + 3 + i * lh, size, colOf(it.col), 'center', w - 8));
    } else {
      const me = it.who === 'me';
      const bw = Math.min(w - 40, Math.max(...b.ls.map((l) => measure(c, l, size))) + 16);
      const bx = me ? x0 + w - bw : x0 + 30;
      if (!me) { frame(c, th, x0 + 1, y + 1, 24, 24); portrait(c, th, cand.look, x0 + 1, y + 1, 24, 24, faceKnown(cand)); }
      const fill = th.id === 'bbs' ? 'rgba(0,0,0,0)' : me ? (th.id === 'web' ? '#e8ecff' : th.dark ? shade(th.accent, -0.35) : shade(th.accent, 0.78)) : (th.dark ? shade(th.paper, 0.1) : '#ffffff');
      rrect(c, bx, y, bw, b.h, th.id === 'web' || th.id === 'techo' || th.id === 'magazine' ? 2 : 8, fill, th.line, 1);
      if (th.id === 'bbs') T(c, me ? '>>' : '<<', bx - 2, y + 4, size, th.sub, 'right');
      b.ls.forEach((l, i) => T(c, l, bx + 8, y + 6 + i * lh, size, th.ink, 'left', bw - 14));
      if (it.day) T(c, md(g, it.day), me ? bx - 4 : bx + bw + 4, y + b.h - size - 2, size - 2, th.sub, me ? 'right' : 'left');
    }
    c.restore();
    y += b.h + 4;
  });
}
function knownLines(x) {
  const out = [];
  if (!x.met) {
    out.push(['顔・人柄・相性は、会うまでわからない', 'sub']);
    if (x.status === 'sent') out.push(['返事を待っている…', 'warn']);
    if (x.status === 'replied') out.push(['返事が来た！会いに行こう', 'good']);
    return out;
  }
  if (x.persona) out.push([`性格：${x.persona}`, 'ink']);
  if (x.motive) out.push([`理由：${x.motive}`, 'ink']);
  if (x.quirks && x.quirks.length) out.push([`クセ：${x.quirks.join('・')}`, 'warn']);
  if (!x.motive && !x.quirks) out.push(['会って「理由」や「ふだん」を聞くと、わかることが増える', 'sub']);
  if (x.status === 'refused') out.push(['ことわられた（実力をつけて、日をおいてから）', 'bad']);
  return out;
}
const lineCol = (th, k) => ({ ink: th.ink, sub: th.sub, warn: th.dark ? '#ffcc4d' : '#b07a00', good: th.dark ? '#5ee07a' : '#1f9a4a', bad: th.dark ? '#ff6470' : '#c0392b' }[k] || th.ink);
function button(ui, c, th, x, y, w, h, label, sub, live, onTap, size = 12) {
  const t = ui.t;
  const lit = live && ui.focus === 'body';
  if (th.id === 'web') {
    R(c, x, y, w, h, '#c0c0c0'); R(c, x, y, w, 1, '#ffffff'); R(c, x, y, 1, h, '#ffffff'); R(c, x, y + h - 1, w, 1, '#404040'); R(c, x + w - 1, y, 1, h, '#404040');
    if (lit) { c.setLineDash([1, 1]); c.strokeStyle = '#000000'; c.lineWidth = 1; c.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9); c.setLineDash([]); }
  } else if (th.id === 'bbs') {
    R(c, x, y, w, h, live ? th.ink : '#0a2a12');
  } else if (th.id === 'magazine' || th.id === 'techo') {
    R(c, x + 2, y + 2, w, h, 'rgba(60,30,10,0.35)'); R(c, x, y, w, h, live ? th.accent : '#a89878'); R(c, x, y, w, 2, 'rgba(255,255,255,0.35)');
  } else {
    const r = Math.min(h / 2, 14);
    if (live) { const gr = c.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, th.accent); gr.addColorStop(1, th.id === 'keitai' ? '#ff9a1a' : th.accent2 === th.accent ? shade(th.accent, -0.2) : th.id === 'sns' ? shade(th.accent, -0.25) : th.accent2); rrect(c, x, y, w, h, r, null); c.fillStyle = gr; c.fill(); }
    else rrect(c, x, y, w, h, r, th.dark ? '#33414e' : '#d8ccd4');
  }
  if (live) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); const p = (t % 150) / 150; if (p < 0.4) { const sx = x - 40 + (w + 80) * (p / 0.4); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(sx, y + h); c.lineTo(sx + 16, y); c.lineTo(sx + 34, y); c.lineTo(sx + 18, y + h); c.closePath(); c.fill(); } c.restore(); }
  const ink = th.id === 'web' ? '#000000' : th.id === 'bbs' ? (live ? th.bg : th.sub) : live ? th.btnInk : th.dark ? '#a8b4c0' : '#6a5a64';
  const hasSub = sub && h >= 30;
  const plain = /^[◀▲▼]|▶$/.test(label);
  const pre = live && !plain ? (lit && Math.floor(t / 20) % 2 ? '▶ ' : '　 ') : '';
  T(c, pre + label, x + w / 2, y + (hasSub ? h / 2 - size - 1 : (h - size) / 2 - 1), size, ink, 'center', w - 12);
  if (hasSub) T(c, sub, x + w / 2, y + h / 2 + 2, Math.max(9, size - 3), ink, 'center', w - 12);
  if (onTap) ui.hits.push({ x, y, w, h, fn: onTap });
}
function cardHead(ui, c, th, cand, x, y, w, touch) {
  const g = ui.g;
  const t = ui.t;
  const pw = touch ? 60 : 56;
  frame(c, th, x + 8, y + 8, pw, pw);
  portrait(c, th, cand.look, x + 8, y + 8, pw, pw, faceKnown(cand));
  if (cand.met || cand.member) T(c, cand.member ? '相方' : '会った', x + 8 + pw / 2, y + 8 + pw - 12, 9, '#ffffff', 'center', pw, '#000000');
  const tx = x + pw + 20;
  // stamp / NEW (top right) — slammed in when the card appears
  const sk = clamp((t - (ui.cardT || 0) - 6) / 10, 0, 1);
  let stw = 0;
  if (cand.status === 'none') { if (!ui._cardSeen) stw = newBadge(c, th, x + w - 8, y + 8, t, touch ? 12 : 10); }
  else { const s = stampOf(th, cand.status); if (s) stw = stampDraw(c, th, x + w - 10, y + 10, s[0], s[1], sk, 'right', touch ? 14 : 12); }
  const nameW = x + w - tx - stw - 14;
  const handle = at(th, cand.handle);
  T(c, cand.met ? cand.name : handle, tx, y + 8, touch ? 18 : 15, th.id === 'web' ? '#0000cc' : th.id === 'bbs' ? th.accent : th.dark ? th.ink : th.accent, 'left', nameW);
  T(c, cand.met ? `（${BOARDS[cand.board] ? BOARDS[cand.board].short : ''}の「${cand.handle}」）` : `本名：？　${stampTime(g, THEMES[kindOf(cand.board)] || th, cand.id)}`, tx, y + (touch ? 30 : 27), touch ? 11 : 10, th.sub, 'left', x + w - tx - 10);
  let cx = tx;
  const cy = y + (touch ? 46 : 42);
  for (const s of [`${cand.age}歳`, prefName(cand.pref), styleShort(cand.style), `${ROLES[cand.role] || ''}志望`]) {
    if (!s) continue;
    if (cx + measure(c, s, touch ? 11 : 10) + 14 > x + w - 8) break;
    cx += chip(c, th, cx, cy, s, touch ? 11 : 10);
  }
}
// the whole card: board / contacts (cand) or the post tab
function drawCard(ui, c, th, x, y, w, h, row, touch) {
  const g = ui.g;
  const cand = row && row.c;
  const k = ease((ui.t - (ui.cardT || 0)) / 12);
  c.save();
  if (k < 1) { c.globalAlpha = 0.3 + 0.7 * k; c.translate(Math.round((1 - k) * 26), 0); }
  cardPanel(c, th, x, y, w, h);
  if (!cand) { c.restore(); return; }
  cardHead(ui, c, th, cand, x, y, w, touch);
  const topH = touch ? 72 : 70;
  const by = y + topH, bh = h - topH - (touch ? 0 : 34);
  const lw = Math.round(w * (touch ? 0.5 : 0.52));
  R(c, x + 8, by - 2, w - 16, 1, th.line);
  // left: the post (or the thread)
  if (ui.tab.id === 'contacts') drawThread(ui, c, th, x + 8, by + 4, lw - 12, bh - 8, cand, touch ? 12 : 11);
  else {
    const kl = knownLines(cand);
    const ksz = touch ? 11 : 10;
    const kh = Math.min(kl.length, 4) * (ksz + 4);
    const B = BOARDS[cand.board] || {};
    drawPostBody(c, THEMES[kindOf(cand.board)] === th ? th : th, x + 10, by + 4, lw - 16, bh - kh - 12, cand.post, { size: touch ? 13 : 12, foot: th.id === 'sns' ? `↩ ${1 + (strHash(cand.id) % 5)}　⇄ ${strHash(cand.id + 'r') % 9}　♡ ${3 + (strHash(cand.id + 'l') % 40)}` : th.id === 'app' ? '♡ いいね！で連絡' : th.id === 'blog' ? `コメント(${strHash(cand.id) % 6})` : th.id === 'web' ? `[返信] [${B.contact || 'メール'}]` : th.id === 'bbs' ? '--- 返信はメールで ---' : '' });
    kl.slice(0, 4).forEach((l, i) => T(c, l[0], x + 10, by + bh - kh - 4 + i * (ksz + 4), ksz, lineCol(th, l[1]), 'left', lw - 16));
  }
  // right: the meter and the chart
  const rx = x + lw, rw = w - lw - 8;
  const m = meterView(g, cand);
  const mk = ui.t - (ui.cardT || 0); // the needle swings in when the card appears (time based: draw may run at any rate)
  const wob = m.kind === 'guess' ? Math.sin(ui.t * 0.07) * m.band * 0.35 * ease(mk / 30) : 0;
  ui._nv = m.v * ease(mk / 30) + wob + (mk < 50 ? Math.sin(mk * 0.4) * (50 - mk) * 0.06 : 0);
  const view = statView(g, cand);
  const rk = ease((ui.t - (ui.cardT || 0) - 4) / 18);
  if (touch) {
    meter(c, th, rx + rw * 0.27, by + 58, 38, m, ui._nv, ui.t, 10);
    radar(c, th, rx + rw * 0.72, by + 62, 34, view, ui.t, rk, 10);
    T(c, { pr: '自己PR（会えばわかる）', first: '第一印象', full: 'ネタ合わせで判明' }[view.level], rx + rw * 0.72, by + bh - 14, 10, th.sub, 'center', rw * 0.5);
    T(c, view.level !== 'pr' ? '- - あなた' : '★ 得意', rx + rw * 0.27, by + bh - 14, 10, view.level !== 'pr' ? th.accent2 : th.accent, 'center', rw * 0.5);
  } else {
    meter(c, th, rx + rw / 2, by + 52, 36, m, ui._nv, ui.t, 10);
    radar(c, th, rx + rw / 2 + 12, by + 124, 33, view, ui.t, rk, 10);
    T(c, { pr: '★自己PR', first: '第一印象', full: '判明！' }[view.level], rx + 4, by + 76, 10, view.level === 'full' ? th.accent : th.sub, 'left', 64);
    if (view.level !== 'pr') { R(c, rx + 4, by + 96, 10, 2, th.accent); T(c, '相手', rx + 16, by + 91, 9, th.sub, 'left', 40); R(c, rx + 4, by + 108, 10, 2, th.accent2); T(c, 'あなた', rx + 16, by + 103, 9, th.sub, 'left', 40); }
    else T(c, '会えば', rx + 4, by + 92, 9, th.sub, 'left', 50), T(c, 'わかる', rx + 4, by + 103, 9, th.sub, 'left', 50);
  }
  c.restore();
}

// ---------------------------------------------------------------- 自分の募集 (the post tab): your post as the medium shows it
function drawPostCard(ui, c, th, x, y, w, h, touch) {
  const g = ui.g;
  const o = g.state && g.state.owarai;
  const p = o && o.net && o.net.post;
  const k = ease((ui.t - (ui.cardT || 0)) / 12);
  c.save();
  if (k < 1) { c.globalAlpha = 0.3 + 0.7 * k; c.translate(Math.round((1 - k) * 26), 0); }
  cardPanel(c, th, x, y, w, h);
  const pw = touch ? 60 : 56;
  frame(c, th, x + 8, y + 8, pw, pw);
  portrait(c, th, g.state.look, x + 8, y + 8, pw, pw, true);
  const tx = x + pw + 20;
  const B = p ? BOARDS[p.board] || {} : null;
  const mth = p ? THEMES[kindOf(p.board)] || th : th;
  let stw = 0;
  if (p) stw = stampDraw(c, th, x + w - 10, y + 10, p.done ? '締切' : g.state.day < num(p.day) + num(B.postDelay) && B.postDelay >= 5 ? '掲載待ち' : '募集中', p.done ? '#7a7a7a' : '#c0392b', clamp((ui.t - (ui.cardT || 0) - 6) / 10, 0, 1), 'right', touch ? 14 : 12);
  T(c, `${g.state.name || 'あなた'}の相方募集`, tx, y + 8, touch ? 18 : 15, th.dark ? th.ink : th.accent, 'left', x + w - tx - stw - 14);
  T(c, p ? `掲載先：${B.name || ''}` : 'まだ募集を出していない', tx, y + (touch ? 30 : 27), touch ? 11 : 10, th.sub, 'left', x + w - tx - 10);
  if (p) {
    let cx = tx;
    for (const s of [p.style ? STYLES[p.style] : 'スタイル問わず', p.role ? `${ROLES[p.role]}募集` : '役割問わず']) cx += chip(c, th, cx, y + (touch ? 46 : 42), s, touch ? 11 : 10);
  }
  const topH = touch ? 72 : 70;
  const by = y + topH, bh = h - topH - (touch ? 0 : 34);
  const lw = Math.round(w * 0.56);
  R(c, x + 8, by - 2, w - 16, 1, th.line);
  if (!p) {
    para(c, '募集を出すと、条件に合いそうな人から返事が来る。雑誌は掲載まで時間がかかり、ネットやアプリは早い。', x + 10, by + 6, lw - 16, touch ? 12 : 11, th.ink, touch ? 17 : 16, 4);
    const boards = safe(() => g.owaraiBoards(), []) || [];
    boards.slice(0, 3).forEach((b, i) => { const yy = by + (touch ? 80 : 74) + i * (touch ? 20 : 18); icon(c, b.kind, x + 10, yy, 1, th); T(c, `${b.short}：${b.postDelay >= 5 ? `掲載まで${b.postDelay}日` : `返事まで${b.postDelay}日ほど`}`, x + 26, yy, touch ? 11 : 10, th.sub, 'left', lw - 30); });
  } else {
    // the post in its own medium (a little framed preview)
    const px = x + 10, py = by + 4, pw2 = lw - 16, ph = bh - 30;
    if (mth !== th) { cardPanel(c, mth, px - 2, py - 2, pw2 + 4, ph + 4); }
    drawPostBody(c, mth, px + (mth !== th ? 6 : 0), py + (mth !== th ? 6 : 0), pw2 - (mth !== th ? 12 : 0), ph - (mth !== th ? 12 : 0), `「${p.text}」`, { size: touch ? 13 : 12 });
    const left = Math.max(0, num(p.replyDay) - g.state.day);
    const replies = Object.values((o.net && o.net.contacts) || {}).filter((ct) => ct && ct.by === 'them' && num(ct.sent) >= num(p.day)).length;
    T(c, p.done ? (replies ? `返事が${replies}件来た！（やりとりのタブへ）` : '返事は来なかった…書き方を変えて、もう一度') : `返事まで あと${left}日くらい`, x + 10, by + bh - 20, touch ? 12 : 11, p.done ? (replies ? lineCol(th, 'good') : lineCol(th, 'warn')) : lineCol(th, 'warn'), 'left', lw - 16);
  }
  // right: your own chart
  const rx = x + lw, rw = w - lw - 8;
  const mine = myStats(g);
  const view = { level: 'full', stats: mine, mine: null, pr: [] };
  radar(c, th, rx + rw / 2, by + (touch ? 62 : 82), touch ? 36 : 42, view, ui.t, ease((ui.t - (ui.cardT || 0) - 4) / 18), 10);
  T(c, 'あなたの実力（自己PR）', rx + rw / 2, by + bh - 14, 10, th.sub, 'center', rw);
  c.restore();
}

// ---------------------------------------------------------------- footer ticker (desktop)
function drawFooter(ui, c, th, g) {
  const y = 336, h = 24;
  const dark = th.dark || th.id === 'magazine' || th.id === 'techo';
  R(c, 0, y, SW, h, th.id === 'web' ? '#c0c0c0' : th.id === 'magazine' ? '#2a2018' : th.id === 'techo' ? '#2e180c' : th.id === 'app' ? '#ffffff' : th.id === 'blog' ? '#ffffff' : '#0b1118');
  R(c, 0, y, SW, 1, th.id === 'web' ? '#ffffff' : th.line);
  const foot = safe(() => (ui.tab.foot ? ui.tab.foot(ui) : ''), '') || '';
  const cnt = ui._counts || { replied: 0, all: 0, contacts: 0 };
  const msg = [foot, cnt.replied ? `返事が来た人 ${cnt.replied}人` : '', cnt.contacts ? `やりとり中 ${cnt.contacts}人` : '', th.id === 'web' ? 'リンクフリーです' : th.id === 'bbs' ? 'ログは毎週更新' : ''].filter(Boolean).join('　◆　');
  const tw = measure(c, msg, 10) + 80;
  const W = 420;
  const ink = th.id === 'web' ? '#000000' : dark ? (th.id === 'magazine' || th.id === 'techo' ? '#fff6dc' : th.ink) : th.ink;
  c.save(); c.beginPath(); c.rect(0, y + 1, W, h - 1); c.clip();
  if (tw - 80 <= W - 16) T(c, msg, 8, y + 7, 10, ink);
  else { const off = (ui.t * 0.6) % tw; T(c, msg, 8 - off, y + 7, 10, ink); T(c, msg, 8 - off + tw, y + 7, 10, ink); }
  c.restore();
  R(c, W, y + 3, 1, h - 6, th.id === 'web' ? '#808080' : th.line);
  T(c, ui.focus === 'tabs' ? '←→タブ　↓選ぶ　B閉じる' : '↑↓選ぶ　←→タブ　A決定　B戻る', SW - 6, y + 7, 10, th.id === 'web' ? '#000000' : th.sub, 'right', SW - W - 12);
}

// ---------------------------------------------------------------- touch: the grid of cards, the card page, the post page
const GRID = { x: 4, y: 74, cw: 314, ch: 70, gap: 4, cols: 2, rows: 3 };
function drawGridTouch(ui, c, th) {
  const vis = visRows(ui);
  const st = ui.ls();
  const per = GRID.cols * GRID.rows;
  const vi = Math.max(0, vis.findIndex((v) => v.i === st.i));
  const pages = Math.max(1, Math.ceil(vis.length / per));
  ui.page = clamp(Math.floor(vi / per), 0, pages - 1);
  if (!vis.length) {
    cardPanel(c, th, 8, 80, SW - 16, 140);
    para(c, ui.tab.id === 'contacts' ? 'まだだれにも連絡していない。掲示板の投稿から連絡するか、自分の募集を出そう。' : '（いまは投稿がない）', 24, 96, SW - 48, 15, th.ink, 22, 5);
  }
  for (let k = 0; k < per; k++) {
    const j = ui.page * per + k;
    if (j >= vis.length) break;
    const { r, i } = vis[j];
    const col = k % GRID.cols, row = Math.floor(k / GRID.cols);
    const x = GRID.x + col * (GRID.cw + GRID.gap), y = GRID.y + row * (GRID.ch + 2);
    const kk = ease((ui.t - (ui.tabT || 0) - k * 2) / 10);
    c.save();
    if (kk < 1) { c.globalAlpha = clamp(kk, 0, 1); c.translate(0, Math.round((1 - kk) * 14)); }
    drawRow(ui, c, th, r, x, y, GRID.cw, GRID.ch + 2, i === st.i && ui.focus === 'body', true);
    c.restore();
    ui.hits.push({ x, y, w: GRID.cw, h: GRID.ch, row: i, open: true });
  }
  // the pager (or the board's line)
  const py = GRID.y + GRID.rows * (GRID.ch + 2);
  if (pages > 1) {
    const go = (d) => () => { const p = clamp(ui.page + d, 0, pages - 1); const v = vis[p * per]; if (v) { st.i = v.i; ui.focus = 'body'; sfx('cursor'); } };
    button(ui, c, th, 4, py, 180, SH - py - 2, '◀ まえ', '', ui.page > 0, ui.page > 0 ? go(-1) : null, 15);
    button(ui, c, th, SW - 184, py, 180, SH - py - 2, 'つぎ ▶', '', ui.page < pages - 1, ui.page < pages - 1 ? go(1) : null, 15);
    T(c, `${ui.page + 1}／${pages}`, SW / 2, py + 18, 16, th.dark ? th.ink : th.accent, 'center');
    T(c, `${vis.length}件`, SW / 2, py + 40, 11, th.sub, 'center');
  } else {
    const foot = safe(() => (ui.tab.foot ? ui.tab.foot(ui) : ''), '') || '';
    para(c, foot, 16, py + 14, SW - 32, 12, th.dark ? th.sub : th.sub, 18, 2);
  }
}
function drawCardTouch(ui, c, th) {
  const row = ui.curRow();
  if (!row || !row.c) { ui.view = 'list'; return; }
  drawCard(ui, c, th, 4, 74, SW - 8, 212, row, true);
  const a = actionOf(row.c);
  const py = 290;
  button(ui, c, th, 4, py, 170, SH - py - 2, '◀ もどる', '一覧へ', true, () => { ui.view = 'list'; sfx('cancel'); }, 15);
  button(ui, c, th, 180, py, SW - 184, SH - py - 2, a.label, a.sub, a.live, () => doAct(ui, row), 16);
}
function drawPostTouch(ui, c, th) {
  const rows = ui.rows();
  const st = ui.ls();
  const iNew = rows.findIndex((r) => r.key === 'new');
  drawPostCard(ui, c, th, 4, 74, SW - 8, 212, true);
  const r = rows[iNew];
  const py = 290;
  button(ui, c, th, 4, py, SW - 8, SH - py - 2, r ? r.label : '募集を出す', '雑誌・ネット・アプリに出せる', !!r, r ? () => { st.i = iNew; doAct(ui, r); } : null, 16);
}

// ---------------------------------------------------------------- effects (contact sent / a reply arrived)
export function fxContact(ui, cand) {
  const th = THEMES[kindOf(cand.board)] || themeOf(ui);
  ui.fx = { kind: 'contact', k: 0, dur: 86, th, cand };
}
export function fxMatch(ui, cand) {
  const th = THEMES[kindOf(cand.board)] || themeOf(ui);
  ui.fx = { kind: 'match', k: 0, dur: 160, th, cand };
  sfx(th.id === 'app' ? 'fanfare' : 'chime');
}
const CONTACT_WORD = { magazine: 'ハガキを出した！', bbs: '送信完了', web: '送信しました', keitai: '送信しました', blog: 'コメントしました♪', sns: 'DMを送りました', app: 'いいね！を送りました' };
const MATCH_WORD = { magazine: 'ハガキの返事が届いた！', bbs: '＊＊ メールが とどいています ＊＊', web: '新着メールが 1件 あります', keitai: '新着メール 1件', blog: 'メッセージが届きました♪', sns: 'DMが届きました', app: 'マッチング成立！' };
function drawFx(ui, c, g) {
  const fx = ui.fx;
  if (!fx) return;
  const th = fx.th;
  const k = fx.k, t = ui.t;
  const cand = fx.cand;
  const fade = clamp(Math.min(k / 8, (fx.dur - k) / 10), 0, 1);
  c.save();
  c.globalAlpha = fade;
  R(c, 0, 0, SW, SH, fx.kind === 'match' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)');
  const cx = SW / 2, cy = SH / 2;
  if (fx.kind === 'contact') {
    const p = clamp(k / 50, 0, 1);
    if (th.id === 'magazine') {
      // a postcard flies into the post box
      R(c, 470, 150, 70, 120, '#d62f2f'); R(c, 462, 140, 86, 16, '#b81e1e'); R(c, 486, 176, 38, 6, '#2a0a0a'); T(c, '〒', 505, 200, 18, '#ffffff', 'center'); T(c, 'ポスト', 505, 228, 10, '#ffffff', 'center');
      if (p < 1) { const px = 120 + (490 - 120) * ease(p), py = 260 - Math.sin(p * Math.PI) * 140 + p * -80; c.save(); c.translate(px, py); c.rotate(p * 1.6); R(c, -24, -16, 48, 32, '#fffaf0'); R(c, -20, -12, 6, 6, '#d8402e'); R(c, -12, -12, 6, 6, '#d8402e'); R(c, 10, -12, 10, 12, '#d8402e'); c.restore(); }
    } else if (th.id === 'bbs' || th.id === 'web' || th.id === 'keitai') {
      const w = 300, h = 90, x = cx - w / 2, y = cy - h / 2;
      if (th.id === 'web') { R(c, x, y, w, h, '#c0c0c0'); grad(c, x + 2, y + 2, w - 4, 14, '#000080', '#1084d0'); T(c, 'メールの送信', x + 6, y + 3, 10, '#ffffff'); T(c, p < 1 ? 'メールを送信しています…' : '送信しました。', x + 14, y + 26, 12, '#000000'); R(c, x + 14, y + 50, w - 28, 16, '#ffffff'); for (let i = 0; i < Math.floor(p * 22); i++) R(c, x + 16 + i * 12, y + 52, 10, 12, '#000080'); }
      else if (th.id === 'bbs') { R(c, x, y, w, h, '#010703'); R(c, x, y, w, 1, th.ink); R(c, x, y + h - 1, w, 1, th.ink); T(c, p < 1 ? '送信中… ピーーー ガガガ…' : '送信完了。', x + 14, y + 16, 12, th.ink, 'left', w - 28); T(c, '[' + '■'.repeat(Math.floor(p * 14)) + '□'.repeat(14 - Math.floor(p * 14)) + ']', x + 14, y + 48, 12, th.accent, 'left', w - 28); }
      else { rrect(c, cx - 70, cy - 90, 140, 180, 16, '#c0c8d8'); rrect(c, cx - 58, cy - 76, 116, 100, 4, '#1c3e86'); const ey = cy - 30 - ease(p) * 40; icon(c, 'contacts', cx - 18, ey, 3, th); T(c, p < 1 ? '送信中…' : '送信しました', cx, cy - 2, 12, '#ffffff', 'center'); for (let i = 0; i < 3; i++) R(c, cx + 40 + i * 5, cy - 70 - i * 3, 3, 3 + i * 3, Math.floor(k / 8) % 3 >= i ? '#ffffff' : '#3a4a6a'); for (let i = 0; i < 9; i++) R(c, cx - 40 + (i % 3) * 30, cy + 34 + Math.floor(i / 3) * 16, 20, 10, '#e8ecf4'); }
    } else if (th.id === 'sns') {
      const px = 80 + ease(p) * 480, py = 280 - ease(p) * 200;
      for (let i = 1; i < 8; i++) { const q = clamp(p - i * 0.03, 0, 1); R(c, 80 + ease(q) * 480, 280 - ease(q) * 200, 3, 3, `rgba(74,168,240,${0.6 - i * 0.07})`); }
      c.save(); c.translate(px, py); c.rotate(-0.4); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, -10); c.lineTo(-6, 12); c.closePath(); c.fill(); c.fillStyle = '#c8d8e8'; c.beginPath(); c.moveTo(-6, 12); c.lineTo(18, -10); c.lineTo(-2, 4); c.closePath(); c.fill(); c.restore();
    } else {
      // app / blog: a heart burst
      const s = 10 + ease(p) * 34 + Math.max(0, Math.sin(k * 0.3)) * 4 * (1 - p);
      heart(c, cx, cy - 20, s, th.accent);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const d = ease(p) * 90; c.globalAlpha = fade * (1 - p * 0.7); heart(c, cx + Math.cos(a) * d, cy - 20 + Math.sin(a) * d, 5, i % 2 ? th.accent2 : '#ffffff'); }
      c.globalAlpha = fade;
    }
    const word = CONTACT_WORD[th.id] || '連絡した！';
    T(c, word, cx, th.id === 'keitai' ? cy + 100 : 290, 20, '#ffffff', 'center', SW - 40, '#000000');
    T(c, `${cand.handle}　返事を待とう`, cx, th.id === 'keitai' ? cy + 126 : 318, 12, '#ffffff', 'center', SW - 40, '#000000');
  } else {
    // a reply arrived
    const p = ease(k / 26);
    if (th.id === 'app') {
      confetti(c, t, 0, 0, SW, SH, 46, 11);
      const me = safe(() => g.state.look, null);
      const lx = cx - 120 - (1 - p) * 200, rx = cx + 120 + (1 - p) * 200;
      for (const [x0, look] of [[lx, me], [rx, cand.look]]) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x0, cy - 10, 52, 0, Math.PI * 2); c.fill(); c.save(); c.beginPath(); c.arc(x0, cy - 10, 48, 0, Math.PI * 2); c.clip(); R(c, x0 - 48, cy - 58, 96, 96, '#ffe4ec'); try { drawFaceHD(c, look || {}, x0 - 48, cy - 46, 3); } catch (e) { /* no face */ } c.restore(); }
      const hs = 18 + Math.max(0, Math.sin(k * 0.18)) * 8;
      heart(c, cx, cy - 10, hs * p, '#ff4f86');
      star(c, cx, 66, 96 * p, 60 * p, 16, t * 0.012, 'rgba(255,210,63,0.30)');
      c.save(); c.translate(cx, 66); const sc = 0.6 + 0.4 * p + Math.max(0, Math.sin(k * 0.12)) * 0.04; c.scale(sc, sc); c.transform(1, 0, -0.15, 1, 0, 0); T(c, 'MATCH!', 0, -24, 30, '#ffffff', 'center', 0, '#ff4f86'); T(c, 'マッチング成立！', 0, 12, 18, '#ffd23f', 'center', 0, '#c8245a'); c.restore();
    } else if (th.id === 'sns') {
      const by = -60 + p * 120;
      rrect(c, cx - 200, by, 400, 70, 12, '#1e2a36', th.accent, 2);
      R(c, cx - 188, by + 12, 44, 44, '#2a3a4a'); portrait(c, th, cand.look, cx - 188, by + 12, 44, 44, true);
      T(c, 'DMが届きました', cx - 134, by + 12, 14, th.accent, 'left', 320);
      T(c, `${at(th, cand.handle)}：募集見ました！一度会って話しませんか？`, cx - 134, by + 36, 11, th.ink, 'left', 320);
      sparkles(c, t, cx - 200, by, 400, 70, 10, 3, '#9ad4ff');
    } else if (th.id === 'keitai') {
      const sh = k < 40 ? Math.sin(k * 1.7) * 4 : 0;
      c.save(); c.translate(sh, 0);
      rrect(c, cx - 80, cy - 120, 160, 230, 18, '#c0c8d8'); rrect(c, cx - 66, cy - 104, 132, 120, 4, Math.floor(k / 8) % 2 ? '#3a8ae0' : '#1c3e86');
      icon(c, 'contacts', cx - 24, cy - 84, 4, th);
      T(c, '新着メール', cx, cy - 26, 14, '#ffcc33', 'center'); T(c, '1件', cx, cy - 8, 12, '#ffffff', 'center');
      for (let i = 0; i < 9; i++) R(c, cx - 46 + (i % 3) * 34, cy + 30 + Math.floor(i / 3) * 20, 24, 12, '#e8ecf4');
      R(c, cx - 4, cy - 140, 6, 24, '#c0c8d8'); if (Math.floor(k / 6) % 2) R(c, cx - 4, cy - 144, 6, 6, '#ff3a6a');
      c.restore();
    } else if (th.id === 'web') {
      const w = 340, h = 120, x = cx - w / 2, y = cy - h / 2 - (1 - p) * 40;
      R(c, x + 4, y + 4, w, h, 'rgba(0,0,0,0.4)'); R(c, x, y, w, h, '#c0c0c0'); R(c, x, y, w, 1, '#ffffff'); R(c, x, y, 1, h, '#ffffff'); R(c, x, y + h - 1, w, 1, '#404040'); R(c, x + w - 1, y, 1, h, '#404040');
      grad(c, x + 3, y + 3, w - 6, 16, '#000080', '#1084d0'); T(c, 'メール', x + 8, y + 5, 10, '#ffffff');
      icon(c, 'contacts', x + 18, y + 34, 3, THEMES.web); T(c, '新着メールが 1件 あります。', x + 70, y + 36, 12, '#000000', 'left', w - 80); T(c, `差出人：${cand.handle}`, x + 70, y + 56, 11, '#000000', 'left', w - 80);
      R(c, cx - 40, y + h - 30, 80, 22, '#c0c0c0'); R(c, cx - 40, y + h - 30, 80, 1, '#ffffff'); R(c, cx - 40, y + h - 9, 80, 1, '#404040'); T(c, 'OK', cx, y + h - 26, 12, '#000000', 'center');
    } else if (th.id === 'bbs') {
      R(c, 60, cy - 50, SW - 120, 100, '#010703'); R(c, 60, cy - 50, SW - 120, 1, th.ink); R(c, 60, cy + 49, SW - 120, 1, th.ink);
      if (Math.floor(k / 14) % 2 === 0) T(c, MATCH_WORD.bbs, cx, cy - 30, 14, th.ink, 'center', SW - 140);
      T(c, `FROM: ${cand.handle}`, cx, cy, 12, th.accent, 'center', SW - 140); T(c, 'SUBJ: Re: 相方募集', cx, cy + 20, 12, th.sub, 'center', SW - 140);
    } else {
      // magazine / techo / blog: a postcard (or a letter) drops onto the desk
      const y = -120 + p * (cy + 60);
      c.save(); c.translate(cx, y); c.rotate((1 - p) * 0.5 - 0.06);
      R(c, -140, -80, 280, 160, th.id === 'blog' ? '#ffffff' : '#fffaf0'); R(c, -140, -80, 280, 3, th.accent);
      for (let i = 0; i < 7; i++) R(c, -128 + i * 16, -70, 12, 14, 'rgba(216,64,46,0.6)');
      R(c, 96, -70, 32, 38, th.id === 'blog' ? '#ffd0de' : '#e8b0a0'); T(c, th.id === 'blog' ? '♪' : '〒', 112, -60, 16, th.accent, 'center');
      T(c, cand.handle, -120, -42, 14, th.ink, 'left', 200);
      T(c, '募集、見ました！', -120, -20, 12, th.ink, 'left', 240); T(c, '一度、会って話しませんか？', -120, 0, 12, th.ink, 'left', 240);
      c.restore();
      sparkles(c, t, cx - 160, cy - 100, 320, 200, 10, 5);
    }
    if (th.id !== 'app' && th.id !== 'bbs') T(c, MATCH_WORD[th.id] || '返事が来た！', cx, th.id === 'sns' ? 220 : 300, 20, '#ffffff', 'center', SW - 40, '#000000');
    T(c, `${cand.handle}から返事が来た！「やりとり」から会いに行ける`, cx, th.id === 'sns' ? 248 : 328, 12, '#ffffff', 'center', SW - 40, '#000000');
  }
  c.restore();
}

// ---------------------------------------------------------------- the modal (themed; touch: 70-unit rows and buttons)
export function modal(ui, o) {
  const m = {
    ...o, idx: o.index || 0, top: 0, t: 0,
    get n() { return o.kind === 'pick' ? (o.items || []).length : (o.choices || ['OK']).length; },
    update(u, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.n;
      if (o.kind === 'pick') {
        if (inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) { const it = o.items[m.idx]; if (it && it.lock) { sfx('buzz'); u.toast(it.lock); return; } sfx('ok'); u.closeModal(m, m.idx); } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); u.closeModal(m, -1); }
        return;
      }
      if (inp.repeat('left') || inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('right') || inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); u.closeModal(m, m.idx); } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); u.closeModal(m, o.cancel != null ? o.cancel : (o.choices || ['OK']).length - 1); }
    },
    tap(u, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (const h of m.hits || []) if (inR(tap.x, tap.y, h)) { if (h.scroll) { m.top = clamp(m.top + h.scroll, 0, Math.max(0, m.n - m.rowsN)); m.idx = clamp(m.idx, m.top, m.top + m.rowsN - 1); sfx('cursor'); return; } const i = h.i; const it = o.items && o.items[i]; if (o.kind === 'pick' && it && it.lock) { u.toast(it.lock); return; } m.idx = i; sfx('ok'); u.closeModal(m, i); return; }
      if (!inR(tap.x, tap.y, m.box)) { sfx('cancel'); u.closeModal(m, o.kind === 'pick' ? -1 : o.cancel != null ? o.cancel : (o.choices || ['OK']).length - 1); }
    },
    draw(u, c) {
      const th = themeOf(u);
      const touch = !!u.touchLayout;
      const w = Math.min(SW - 24, touch ? 560 : o.w || 440);
      const x = Math.round((SW - w) / 2);
      const size = touch ? 15 : 12;
      const lines = [];
      for (const l of o.lines || []) lines.push(...wrapJ(c, String(l ?? ''), w - 28, size));
      const pick = o.kind === 'pick';
      const rh = touch ? TB : 30;
      const shown = lines.slice(0, pick ? (touch ? 2 : 4) : touch ? 6 : 10);
      const titleH = touch ? 34 : 26;
      const lh = size + 5;
      const avail = SH - 16 - titleH - shown.length * lh - 10;
      m.rowsN = pick ? Math.max(1, Math.min(m.n, Math.floor(avail / rh))) : 0;
      const bh = touch ? TB : 28;
      const h = titleH + shown.length * lh + (pick ? m.rowsN * rh + 8 : bh + 16) + 6;
      const y = Math.round((SH - h) / 2);
      const k = ease(m.t / 8);
      m.box = { x, y, w, h };
      m.hits = [];
      c.save();
      c.translate(x + w / 2, y + h / 2); c.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); c.translate(-(x + w / 2), -(y + h / 2));
      cardPanel(c, th, x, y, w, h);
      if (th.id === 'web') { grad(c, x + 2, y + 2, w - 4, titleH - 6, '#000080', '#1084d0'); T(c, o.title || '', x + 10, y + (titleH - 6 - size) / 2 + 2, size, '#ffffff', 'left', w - 24); }
      else { R(c, x, y, w, 3, th.accent); T(c, o.title || '', x + 12, y + 8, size, th.id === 'bbs' ? th.accent : th.dark ? th.ink : th.accent, 'left', w - 24); }
      shown.forEach((l, i) => T(c, l, x + 14, y + titleH + i * lh, size, th.ink, 'left', w - 28));
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + m.rowsN) m.top = m.idx - m.rowsN + 1;
        const y0 = y + titleH + shown.length * lh + 4;
        const scroll = m.n > m.rowsN;
        const rw = w - 16 - (scroll && touch ? TB + 4 : 0);
        for (let q = 0; q < m.rowsN && m.top + q < m.n; q++) {
          const i = m.top + q;
          const it = o.items[i];
          const yy = y0 + q * rh;
          const sel = i === m.idx;
          if (th.id === 'web') { R(c, x + 8, yy, rw, rh - 3, sel ? '#000080' : '#ffffff'); }
          else rrect(c, x + 8, yy, rw, rh - 3, th.id === 'bbs' || th.id === 'magazine' || th.id === 'techo' ? 1 : 8, sel ? th.sel : th.dark ? shade(th.paper, 0.06) : shade(th.bg, 0.4), sel ? th.accent : th.line, sel ? 2 : 1);
          const ink = sel && th.selInk ? th.selInk : it.lock ? th.sub : th.ink;
          const rwid = it.right ? measure(c, it.right, size - 2) + 12 : 0;
          const two = !!it.sub;
          T(c, (sel ? '▶ ' : '') + it.label, x + 18, yy + (two ? (touch ? 12 : 3) : (rh - 3 - size) / 2), size, ink, 'left', rw - 24 - rwid);
          if (two) T(c, it.sub, x + 18 + (sel ? measure(c, '▶ ', size) : 0), yy + (touch ? 38 : 17), size - 3, sel && th.selInk ? '#d8e0ff' : th.sub, 'left', rw - 30);
          if (it.right) T(c, it.right, x + 8 + rw - 8, yy + 4, size - 2, th.sub, 'right');
          m.hits.push({ x: x + 8, y: yy, w: rw, h: rh - 3, i });
        }
        if (scroll && touch) {
          const sx = x + w - 8 - TB;
          button(u, c, th, sx, y0, TB, TB - 3, '▲', '', m.top > 0, null, 16);
          button(u, c, th, sx, y0 + m.rowsN * rh - TB, TB, TB - 3, '▼', '', m.top + m.rowsN < m.n, null, 16);
          m.hits.push({ x: sx, y: y0, w: TB, h: TB - 3, scroll: -1 }, { x: sx, y: y0 + m.rowsN * rh - TB, w: TB, h: TB - 3, scroll: 1 });
        } else if (scroll) T(c, `${m.idx + 1}／${m.n}`, x + w - 12, y + 8, 10, th.sub, 'right');
      } else {
        const ch = o.choices || ['OK'];
        const bw = Math.min(touch ? 240 : 180, Math.floor((w - 24 - (ch.length - 1) * 8) / ch.length));
        const total = ch.length * bw + (ch.length - 1) * 8;
        ch.forEach((label, i) => {
          const bx = x + Math.round((w - total) / 2) + i * (bw + 8), by = y + h - bh - 10;
          const sel = i === m.idx;
          button(u, c, th, bx, by, bw, bh, label, '', sel, null, size);
          m.hits.push({ x: bx, y: by, w: bw, h: bh, i });
        });
      }
      c.restore();
    },
  };
  return m;
}

// ---------------------------------------------------------------- the screen: init / input / taps / draw (BoardScreen calls these)
export function boardInit(ui) {
  ui.view = 'list';
  ui.hits = [];
  ui.tabT = 0;
  ui.cardT = 0;
  ui._nv = 0;
  ui.fx = null;
  ui._lastTab = ui.tabIdx;
  ui._checkT = -999;
}
export function onTab(ui) { ui.view = 'list'; ui.tabT = ui.t; ui.cardT = ui.t; ui._cardKey = null; }
function doAct(ui, row) {
  if (!row || row.header || !ui.tab.act || ui.busy > 0) return;
  sfx('ok');
  ui.act(() => ui.tab.act(ui, row));
}
// before the screen's own update: the effects (skippable), the touch card page (A opens it, B goes back). true = this frame is used.
export function boardPre(ui, g) {
  const inp = g.input;
  if (ui.fx) {
    ui.t++;
    for (const t of ui.toasts) t.t++;
    ui.toasts = ui.toasts.filter((t) => t.t < 150);
    const fx = ui.fx;
    fx.k++;
    if (fx.kind === 'contact' && fx.k === 48) sfx('good');
    const tap = ui.tapAt;
    ui.tapAt = null;
    if ((fx.k > 14 && (tap || inp.pressed('a') || inp.pressed('b') || inp.pressed('menu'))) || fx.k >= fx.dur) ui.fx = null;
    inp.consume();
    return true;
  }
  if (!ui.touchLayout || ui.modals.length || ui.busy > 0 || ui.t < 3 || ui.tapAt) return false;
  if (ui.tab.id === 'post' || ui.focus !== 'body') return false;
  if (ui.view === 'list' && inp.pressed('a')) { const r = ui.curRow(); if (r && r.c) { ui.view = 'card'; ui.cardT = ui.t; sfx('ok'); inp.consume(); ui.t++; return true; } }
  if (ui.view === 'card' && inp.pressed('b')) { ui.view = 'list'; sfx('cancel'); inp.consume(); ui.t++; return true; }
  return false;
}
// after it: card changes (animations), NEW marks, replies (the match effect)
export function boardPost(ui, g) {
  if (ui._lastTab !== ui.tabIdx) { ui._lastTab = ui.tabIdx; onTab(ui); }
  const row = ui.curRow();
  const key = `${ui.tab.id}|${row ? row.key : ''}`;
  if (ui._cardKey !== key) { ui._cardKey = key; ui.cardT = ui.t; ui._cardSeen = row && row.c ? isSeen(g, row.c.id) : true; }
  const shown = row && row.c && (!ui.touchLayout || ui.view === 'card');
  if (shown && row.c.status === 'none' && !ui._cardSeen && ui.t - ui.cardT >= 45) { markSeen(g, row.c.id); ui._cardSeen = true; }
  if (ui.t > 3 && ui.t - ui._checkT >= 30 && !ui.fx && !ui.modals.length && ui.busy === 0 && g.top === ui) {
    ui._checkT = ui.t;
    const list = safe(() => g.owaraiCandidates('net'), []) || [];
    ui._counts = { replied: list.filter((x) => x.status === 'replied').length, contacts: list.filter((x) => x.status !== 'none').length, all: list.length };
    const n = netOf(g);
    if (n) {
      for (const x of list) {
        if (x.status !== 'replied') continue;
        const ct = n.contacts && n.contacts[x.id];
        const kk = ackKey(ct);
        if (n.uiAck && n.uiAck[x.id] === kk) continue;
        if (!n.uiAck || typeof n.uiAck !== 'object') n.uiAck = {};
        n.uiAck[x.id] = kk;
        fxMatch(ui, x);
        break;
      }
    }
  }
}
export function boardTap(ui, tap, inp) {
  const now = inp.pressedNow || {};
  const touch = !!ui.touchLayout;
  now.a = false;
  if (inR(tap.x, tap.y, touch ? { x: SW - TB, y: 0, w: TB, h: TB } : ui.closeRect || { x: SW - 30, y: 0, w: 30, h: 30 })) { sfx('cancel'); ui.close(); return true; }
  for (let i = 0; i < (ui.tabRects || []).length; i++) if (inR(tap.x, tap.y, ui.tabRects[i])) { ui.focus = 'tabs'; if (i !== ui.tabIdx) { ui.setTab(i); sfx('cursor'); } return true; }
  for (const h of ui.hits || []) {
    if (!inR(tap.x, tap.y, h)) continue;
    if (h.fn) { h.fn(); return true; }
    if (h.row != null) {
      const st = ui.ls();
      ui.focus = 'body';
      if (h.open) { st.i = h.row; ui.view = 'card'; ui.cardT = ui.t; sfx('ok'); return true; }
      if (st.i !== h.row) { st.i = h.row; sfx('cursor'); return true; }
      doAct(ui, ui.rows()[h.row]);
      return true;
    }
  }
  return true;
}
export function drawBoard(ui, c, g) {
  const th = themeOf(ui);
  const touch = !!ui.touchLayout;
  ui.hits = [];
  prepRows(ui);
  paintBg(c, th);
  ambient(c, th, ui.t, 0, touch ? TB : 30, SW, SH - (touch ? TB : 30));
  if (touch) {
    drawTabs(ui, c, th, 0, TB, SW - TB, 15);
    const xh = th.dark ? shade(th.paper, 0.1) : th.accent;
    R(c, SW - TB + 1, 1, TB - 2, TB - 2, xh);
    T(c, '×', SW - TB / 2, TB / 2 - 13, 26, '#ffffff', 'center');
    try {
      if (ui.tab.id === 'post') drawPostTouch(ui, c, th);
      else if (ui.view === 'card') drawCardTouch(ui, c, th);
      else drawGridTouch(ui, c, th);
    } catch (e) { console.error(e); }
  } else {
    drawHeader(ui, c, th, g);
    drawTabs(ui, c, th, 30, 20, SW, 12);
    try {
      drawListDesk(ui, c, th);
      const row = ui.curRow();
      const D = { x: 238, y: 52, w: 396, h: 282 };
      if (ui.tab.id === 'post') {
        drawPostCard(ui, c, th, D.x, D.y, D.w, D.h, false);
        const rows = ui.rows();
        const iNew = rows.findIndex((r) => r.key === 'new');
        const r = rows[iNew];
        if (r) button(ui, c, th, D.x + D.w - 200, D.y + D.h - 30, 192, 24, r.label, '', true, () => { ui.ls().i = iNew; doAct(ui, r); }, 12);
      } else if (row && row.c) {
        drawCard(ui, c, th, D.x, D.y, D.w, D.h, row, false);
        const a = actionOf(row.c);
        const sub = a.sub ? fit(c, a.sub, 180, 10) : '';
        if (sub) T(c, sub, D.x + 12, D.y + D.h - 24, 10, th.sub, 'left', 180);
        button(ui, c, th, D.x + D.w - 200, D.y + D.h - 30, 192, 24, `A：${a.label}`, '', a.live, () => doAct(ui, row), 12);
      } else {
        cardPanel(c, th, D.x, D.y, D.w, D.h);
        const b = ui.tab.board;
        T(c, b ? b.name : 'やりとり', D.x + 12, D.y + 12, 14, th.dark ? th.ink : th.accent, 'left', D.w - 24);
        para(c, b ? b.desc : 'まだだれにも連絡していない。掲示板の投稿から連絡するか、自分の募集を出そう。', D.x + 12, D.y + 40, D.w - 24, 12, th.ink, 18, 6);
      }
    } catch (e) { console.error(e); }
    drawFooter(ui, c, th, g);
  }
  ui.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, 12) + 20); R(c, (SW - w) / 2, 300 - i * 22, w, 20, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * 22, 12, t.color || '#ffd23f', 'center', w - 10); });
  drawFx(ui, c, g);
  for (const m of ui.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)'); m.draw(ui, c); }
}

// ================================================================ the meeting (MeetScene) overlay
const TRIAL_LINES = [['どうも〜！', 'よろしくお願いします！'], ['…ってことがあって', 'いや、なんでやねん！'], ['ちょっと待って', 'ちゃうちゃう！'], ['どうしたらええねん', 'もうええわ！']];
const TRIAL_STD = [['どうも〜！', 'よろしくお願いします！'], ['…ってことがあって', 'いや、なんでだよ！'], ['ちょっと待って', 'ちがうって！'], ['どうしたらいいの', 'もういいよ！']];
function formedNow(scene, g) {
  if (scene.t - (scene._fChk || -99) >= 10) {
    scene._fChk = scene.t;
    const ou = g.state && g.state.owarai && g.state.owarai.unit;
    const f = !!(ou && Array.isArray(ou.members) && ou.members.some((m) => m.id === scene.o.pid));
    if (f && !scene._formedT) scene._formedT = scene.t;
    scene._formed = f;
  }
  return !!scene._formed;
}
// vertical offset for the two (they jump when the combi is formed); who: 0 you, 1 them
export function meetHop(scene, g, who = 0) {
  if (!formedNow(scene, g)) return 0;
  const k = scene.t - scene._formedT;
  return -Math.round(Math.abs(Math.sin((k + who * 9) * 0.16)) * 10);
}
export function meetOverlay(scene, c, g) {
  const t = scene.t;
  const o = scene.o || {};
  const pid = o.pid;
  const cand = CANDIDATES[pid] || {};
  const B = BOARDS[o.board] || {};
  const th = THEMES[B.kind] || THEMES.techo;
  const spot = MEET_SPOTS[o.spot] || {};
  const D = dateLine(g);
  // the top band (the medium's colours) — the place, the board, the time
  grad(c, 0, 0, SW, 26, th.head0, th.head1, th.id === 'keitai' || th.id === 'techo');
  R(c, 0, 25, SW, 1, th.id === 'bbs' ? th.ink : th.accent2);
  if (th.id === 'bbs') R(c, 0, 0, SW, 26, '#010703');
  const ink = th.id === 'bbs' ? th.ink : th.headInk;
  rrect(c, 6, 4, 18, 18, 4, 'rgba(255,255,255,0.85)');
  icon(c, B.kind || 'techo', 8, 6, 1.2, th);
  T(c, o.title || `${spot.name || ''}で待ち合わせ`, 28, 6, 13, ink, 'left', 300, th.id === 'bbs' || th.dark ? null : shade(th.head1, -0.3));
  T(c, `${B.short || ''}${D.hm ? `　${D.hm}` : ''}`, SW - 10, 8, 10, ink, 'right', 260);
  const formed = formedNow(scene, g);
  // the plate of the person you meet (slides in once they arrive)
  if (scene.mode !== 'wait') {
    if (scene._arrT == null) scene._arrT = t;
    const k = ease((t - scene._arrT) / 14);
    const x = -260 + k * 268, y = 32;
    c.save();
    c.globalAlpha = clamp(k * 1.5, 0, 1);
    rrect(c, x, y, 252, 40, 6, th.dark ? '#0c1628' : '#ffffff', th.accent, 2);
    R(c, x + 6, y + 6, 28, 28, th.dark ? '#2a3a4a' : '#e4ecf4');
    try { drawFaceHD(c, (PEOPLE[pid] && PEOPLE[pid].look) || {}, x + 4, y + 9, 1); } catch (e) { /* no face */ }
    const lw = measure(c, formed ? '相方' : '相方候補', 9);
    rrect(c, x + 37, y + 4, lw + 6, 13, 3, formed ? '#d4a017' : th.id === 'bbs' ? '#0f5a22' : th.accent);
    T(c, formed ? '相方' : '相方候補', x + 40, y + 5, 9, '#ffffff', 'left', 60);
    T(c, cand.s ? `${cand.s}（${cand.age}）` : '', x + 46 + lw, y + 4, 11, th.dark ? '#ffffff' : th.ink, 'left', 252 - 56 - lw);
    T(c, `${styleShort(cand.style)}・${ROLES[cand.role] || ''}志望${cand.h ? `　「${cand.h}」` : ''}`, x + 40, y + 21, 10, th.dark ? '#c8d4e8' : th.sub, 'left', 206);
    c.restore();
  } else {
    // waiting: the clock ticks, a "…" bubble
    const cx = SW - 40, cy = 58;
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(cx, cy, 16, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#4a3a2a'; c.lineWidth = 2; c.stroke();
    const a1 = t * 0.05, a2 = t * 0.004;
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a1) * 12, cy + Math.sin(a1) * 12); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a2) * 8, cy + Math.sin(a2) * 8); c.stroke();
    const dots = '…'.repeat(1 + (Math.floor(t / 20) % 3));
    rrect(c, 150, 70, 64, 30, 12, '#ffffff', '#4a3a2a', 1);
    T(c, dots, 182, 76, 14, '#4a3a2a', 'center', 56);
  }
  // steam from hot drinks
  if (o.spot === 'cafe') for (let i = 0; i < 2; i++) for (const dx of [246, scene.mode !== 'wait' ? 402 : -999]) { if (dx < 0) continue; const ph = (t * 0.6 + i * 30) % 60; c.globalAlpha = 0.5 * (1 - ph / 60); R(c, dx + Math.sin((t + i * 40) * 0.08) * 3, 200 - ph * 0.5, 2, 6, '#ffffff'); c.globalAlpha = 1; }
  // the trial ネタ合わせ: a telop and the two talking
  if (scene.mode === 'trial') {
    const bounce = Math.abs(Math.sin(t * 0.12)) * 4;
    c.save(); c.translate(SW / 2, 92 - bounce); c.transform(1, 0, -0.15, 1, 0, 0);
    T(c, 'ネタ合わせ中！', 0, -10, 18, th.id === 'bbs' ? th.ink : '#ffffff', 'center', 0, th.id === 'bbs' ? '#010703' : th.accent);
    c.restore();
    const lines = (cand.dial === 'kansai' ? TRIAL_LINES : TRIAL_STD)[Math.floor(t / 70) % 4];
    const turn = Math.floor(t / 35) % 2;
    const bx = turn ? 430 : 120, by = 118;
    const s = lines[turn];
    const bw = Math.min(200, measure(c, s, 11) + 18);
    rrect(c, bx, by, bw, 22, 10, '#ffffff', '#2a2030', 1);
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(bx + (turn ? 20 : bw - 20), by + 21); c.lineTo(bx + (turn ? 12 : bw - 12), by + 30); c.lineTo(bx + (turn ? 28 : bw - 28), by + 21); c.fill();
    T(c, s, bx + bw / 2, by + 5, 11, '#2a2030', 'center', bw - 10);
    sparkles(c, t, 250, 120, 140, 80, 6, 2, th.dark ? '#ffe9a0' : '#ffd23f');
  }
  // the result: a 手ごたえ meter, a stamp slammed in
  if (scene.trial) {
    if (scene._trialRef !== scene.trial) { scene._trialRef = scene.trial; scene._trialT = Number.isFinite(scene.trialT) ? scene.trialT : t; }
    const tr = scene.trial;
    const k = t - scene._trialT;
    scene._nv = num(tr.score) * ease(k / 40) + (k < 60 ? Math.sin(k * 0.4) * (60 - k) * 0.08 : 0);
    const mth = { ...th, dark: true, sub: '#d8d0e8', line: '#5a5070', accent: th.accent, accent2: th.accent2 };
    rrect(c, SW - 150, 34, 142, 82, 8, '#160f1c', th.accent, 1);
    meter(c, mth, SW - 79, 96, 34, { v: num(tr.score), band: 0, label: '手ごたえ', kind: 'trial' }, scene._nv, t, 10);
    const good = num(tr.score) >= 55;
    const big = k < 70 && !formed;
    const word = num(tr.score) >= 70 ? '息ぴったり！' : good ? '手ごたえあり' : num(tr.score) >= 40 ? 'ぎこちない…' : 'かみ合わない…';
    if (big) {
      const sk = clamp(k / 10, 0, 1);
      stampDraw(c, { ...th, stamp: 'hanko' }, SW / 2, 120, word, good ? '#d4202a' : '#5a5a7a', sk, 'center', 22);
      if (good) sparkles(c, t, SW / 2 - 120, 90, 240, 70, 12, 8);
    }
  }
  // the combi is formed: confetti, a big telop
  if (formed) {
    const k = t - (scene._formedT || t);
    confetti(c, t, 0, 0, SW, SH, 50, 21);
    const sc = 0.5 + 0.5 * ease(k / 16) + Math.max(0, Math.sin(k * 0.1)) * 0.03;
    c.save(); c.translate(SW / 2, 104); c.scale(sc, sc); c.transform(1, 0, -0.15, 1, 0, 0);
    T(c, 'コンビ結成！', 0, -16, 30, '#ffd23f', 'center', 0, '#8a1a10');
    c.restore();
    heart(c, SW / 2, 160 + Math.sin(t * 0.1) * 3, 10 + Math.max(0, Math.sin(t * 0.2)) * 3, '#ff4f86');
    sparkles(c, t, 120, 40, 400, 160, 16, 12);
  }
}
