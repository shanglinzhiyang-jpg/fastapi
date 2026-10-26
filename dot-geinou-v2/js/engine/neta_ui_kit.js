// Shared kit of the 台本 screens (owner: R10-A; extracted from neta_ui.js): visual tokens, text helpers, the screen base class
// (touch bar, taps, drag / wheel / right-click forwarding), the pick / confirm modal and the parts picker.
// neta_ui.js (result, chooser, settings, phone app) and neta_editor*.js (the editor) import it; it imports no screen.
//
// Pointer forwarding (new): besides the first tap (scene.tapAt, as before) every neta screen gets scene.ptr = { x, y, down,
// multi (Ctrl / ⌘ held), button } (canvas units 0..640 x 0..360, updated on pointermove / pointerup), scene.wheel(dy, e) → true when handled,
// scene.contextAt({x, y}, e) → true when handled (right click). Screens that do not define them are unaffected.

import { SW, SH, clamp } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { mmss } from './neta_ai.js';
import { BOKE_TYPES, ERA_YEAR } from './neta_bank.js';
import { ROLE_OPTS, BEAT_OPTS } from './neta_editor_core.js';
export { ROLE_OPTS, BEAT_OPTS };

export const has = (g, k) => !!g && typeof g[k] === 'function';
export const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
export const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
export const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export const inR = (x, y, r) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const short = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
// '#rrggbb' + alpha → 'rgba()'; mix two '#rrggbb' colours
export const hexA = (hex, a) => { const h = String(hex).replace('#', ''); const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`; };
export const mix = (a, b, t) => { const pa = String(a).replace('#', ''), pb = String(b).replace('#', ''); const f = (s, i) => parseInt(s.slice(i, i + 2), 16); const ch = (i) => Math.round(f(pa, i) + (f(pb, i) - f(pa, i)) * t).toString(16).padStart(2, '0'); return `#${ch(0)}${ch(2)}${ch(4)}`; };
// a filled rounded rectangle (pill chips of the 令和 skin)
export function RR(c, x, y, w, h, r, col) {
  c.fillStyle = col; c.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr); c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath(); c.fill();
}

export const K = {
  bg: '#120c18', head: '#1e1428', panel: '#1a1222', panel2: '#261a32', edge: '#4a3460', edgeHi: '#8a5ab8', text: '#f4eef8', dim: '#a898b8', faint: '#6a5a7a',
  gold: '#ffcf4a', red: '#ff5d6c', green: '#5ee07a', cyan: '#5fd7ff', sel: '#3a2652', pink: '#ff7eb6', warn: '#ffb547', ink: '#1a1206',
};
export const KIND_LABEL = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'エピソードトーク' };
export const ROLE_SHORT = { boke: 'ボケ', tsukkomi: 'ツッコ', a: 'A', b: 'B', c: 'C', narr: 'ナレ', pin: '本人', sage: 'サゲ' };
export const ROLE_LONG = { boke: 'ボケ', tsukkomi: 'ツッコミ', a: '人物A', b: '人物B', c: '人物C', narr: 'ナレ・ト書き', pin: '本人', sage: 'サゲ' };
export const ROLE_COL = { boke: '#ff8a3d', tsukkomi: '#4fa8ff', a: '#e06a9a', b: '#4fb8a0', c: '#c0a040', narr: '#7a7a8e', pin: '#d6a33a', sage: '#c06030' };
export const BEAT_SHORT = { tsukami: 'ツカミ', setup: 'フリ', boke: 'ボケ', tsukkomi: 'ツッコ', tenkai: '展開', tendon: '天丼', fukusen: '伏線', kaishu: '回収', ochi: 'オチ', makura: 'まくら', hondai: '本題', sage: 'サゲ', answer: '回答', uragiri: '裏切り' };
export const BEAT_LONG = { tsukami: 'ツカミ', setup: 'フリ・設定', boke: 'ボケ', tsukkomi: 'ツッコミ', tenkai: '展開', tendon: '天丼（くり返し）', fukusen: '伏線', kaishu: '伏線の回収', ochi: 'オチ', makura: 'まくら', hondai: '本題', sage: 'サゲ', answer: '回答', uragiri: '裏切り（展開）' };
export const BEAT_COL = { tsukami: '#ffcf4a', setup: '#7a8aa8', boke: '#ff8a3d', tsukkomi: '#4fa8ff', tenkai: '#a070e0', tendon: '#ff7eb6', fukusen: '#40b0a8', kaishu: '#5fe0c8', ochi: '#ff5d6c', makura: '#a07850', hondai: '#8a8a9a', sage: '#d0603a', answer: '#ffcf4a', uragiri: '#c060ff' };

// Length presets. The contests' round lengths are read from their own definitions (g.contest('m1' | 'koc' | 'r1').rounds,
// owned by the contest modules), so they match those modules year by year (e.g. KOC 2回戦 3分 from 2022); a contest that
// is not held in the current game year (not founded yet, hiatus) is not offered (no future facts).
// Fallback when no contest module is loaded — year-gated, verified 2026-10: M-1 1回戦 2分, 2回戦・3回戦 3分, 準々決勝〜決勝
// 4分 (2019 rules) [daily.co.jp 2020-07-02, compe.japandesign.ne.jp m-1gp-2019/2020], held 2001–2010 and from 2015;
// キングオブコント (from 2008) 1回戦 2分, 2回戦 2分 (3分 in 2008 and from 2022, as koc_data.js), 準々決勝〜決勝 4分 / 5分
// (5分 from 2018 as koc_data.js; natalie.mu gives the 4→5分 change for 2020) ; R-1ぐらんぷり (2002–2016) / R-1グランプリ
// (2017–) 決勝 3分, 4分 from 2024 [news.mynavi.jp 2024-03-08, natalie.mu/owarai/award/r-1gp/2024].
// The generic presets ("約") are targets, not rules.
export const GENERIC_PRESETS = [
  { label: '劇場の出番（約5分）', sec: 300 }, { label: 'テレビのネタ番組（約3分）', sec: 180 }, { label: '落語の高座（約15分）', sec: 900 },
  { label: '大喜利（約2分）', sec: 120 }, { label: 'エピソードトーク（約2分）', sec: 120 },
];
export const gameYearOf = (g) => { const d = has(g, 'gameDate') ? safe(() => g.gameDate(), null) : null; if (d && d.year) return d.year; const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_YEAR[e] || 2026; };
function fallbackRounds(id, y) {
  if (id === 'm1') { if (y < 2001 || (y >= 2011 && y <= 2014)) return null; return { name: 'M-1グランプリ', rounds: [{ name: '1回戦', length: 120 }, { name: '2回戦', length: 180 }, { name: '3回戦', length: 180 }, { name: '準々決勝', length: 240 }, { name: '準決勝', length: 240 }, { name: '決勝', length: 240 }] }; }
  if (id === 'koc') { if (y < 2008) return null; const late = y >= 2018 ? 300 : 240; return { name: 'キングオブコント', rounds: [{ name: '1回戦', length: 120 }, { name: '2回戦', length: y === 2008 || y >= 2022 ? 180 : 120 }, { name: '準々決勝', length: late }, { name: '準決勝', length: late }, { name: '決勝', length: y === 2008 ? 300 : late }] }; }
  if (id === 'r1') { if (y < 2002) return null; return { name: y >= 2017 ? 'R-1グランプリ' : 'R-1ぐらんぷり', rounds: [{ name: '決勝', length: y >= 2024 ? 240 : 180 }] }; }
  return null;
}
export function lengthPresets(g) {
  const y = gameYearOf(g);
  const out = [];
  for (const id of ['m1', 'koc', 'r1']) {
    let name = null, rounds = null;
    if (has(g, 'contest')) {
      const c = safe(() => g.contest(id), null);
      if (c) {
        const ed = has(g, 'contestEdition') ? safe(() => g.contestEdition(id, y), null) : null;
        if (!ed) continue;
        name = ed.name || c.name;
        const rs = safe(() => (typeof c.roundsOf === 'function' ? c.roundsOf(y) : null), null) || c.rounds;
        rounds = Array.isArray(rs) ? rs.filter((r) => r && Number(r.length) > 0) : null;
      }
    }
    if (!rounds || !rounds.length) { const fb = fallbackRounds(id, y); if (!fb) continue; name = name || fb.name; rounds = fb.rounds; }
    // one preset per run of rounds with the same length (準決勝（1日目）/（2日目） count once)
    const norm = rounds.map((r) => ({ name: String(r.name || '').replace(/（.*?）/g, ''), length: Number(r.length) }));
    const groups = [];
    for (const r of norm) { const last = groups[groups.length - 1]; if (last && last.length === r.length) { if (!last.names.includes(r.name)) last.names.push(r.name); } else groups.push({ length: r.length, names: [r.name] }); }
    for (const gr of groups) {
      const rn = gr.names.length === 1 ? gr.names[0] : gr.names.length === 2 ? gr.names.join('・') : `${gr.names[0]}〜${gr.names[gr.names.length - 1]}`;
      out.push({ label: `${name} ${rn}（${mmss(gr.length).replace(/00秒$/, '').replace(/分$/, '分')}）`, sec: gr.length, contest: id, name, rounds: gr.names });
    }
  }
  return [...out, ...GENERIC_PRESETS];
}

// ------------------------------------------------------------------ text helpers (every string has a width)
export function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
export function T(c, s, x, y, size = 12, color = K.text, align = 'left', w = 0) { text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: null }); }
export const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％～〜'.split(''));
export function jwrap(c, str, w, size = 12) {
  measure(c, '', size);
  const Wd = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    let line = '';
    for (const ch of Array.from(par)) {
      if (!line || Wd(line + ch) <= w) { line += ch; continue; }
      if (NO_START.has(ch)) { const a = Array.from(line); const last = a.pop(); out.push(a.join('')); line = last + ch; continue; }
      out.push(line);
      line = ch;
    }
    out.push(line);
  }
  return out;
}
export function para(c, s, x, y, w, size = 12, color = K.text, lh = 0, maxLines = 99) {
  const ls = jwrap(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], x, y + i * step, size, color);
  return n * step;
}
export function box(c, x, y, w, h, title, opts = {}) {
  R(c, x, y, w, h, opts.bg || K.panel);
  R(c, x, y, w, 1, opts.accent || K.edge); R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
  if (title) { R(c, x + 1, y + 1, w - 2, 15, K.panel2); T(c, title, x + 6, y + 2, 10, opts.accent || K.gold, 'left', w - 12 - (opts.right ? measure(c, opts.right, 10) + 8 : 0)); if (opts.right) T(c, opts.right, x + w - 6, y + 2, 10, K.dim, 'right'); }
}
export function chip(c, x, y, label, col, w = 0, size = 10) {
  const ww = w || Math.ceil(measure(c, label, size)) + 8;
  R(c, x, y, ww, size + 4, col);
  T(c, label, x + ww / 2, y + 2, size, K.ink, 'center', ww - 2);
  return ww;
}
export const scoreCol = (s) => (s >= 75 ? K.green : s >= 55 ? K.gold : s >= 35 ? K.warn : K.red);
// The × of every full screen. Desktop: the small 24x20 box in the header. Touch (body.touch), as the 芸人手帳 (owarai_ui.js):
// a 70-unit top bar with a 70x70 × cell (about 45 CSS px on a 412-px-wide portrait canvas: 640 units → 412 px), and the
// screen below its own header drawn scaled into y 72..360 (taps are mapped back to the screen's own units).
export const CLOSE = { x: SW - 24, y: 0, w: 24, h: 20 };
export const drawClose = (c) => T(c, '×', SW - 12, 3, 12, K.dim, 'center');
export const TB = 70;
export const isTouch = () => typeof document !== 'undefined' && !!document.body && !!document.body.classList && document.body.classList.contains('touch');

// ------------------------------------------------------------------ taps + the base scene
let tapCanvas = null;
export const topNeta = (g) => { const t = g && g.top; return t && t.isNetaUI && !t.closed ? t : null; };
export function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return r.width && r.height ? { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height } : null; };
  cv.addEventListener('pointerdown', (e) => {
    const sc = topNeta(g);
    if (!sc || e.button) return; // the primary button / touch only (right click = scene.contextAt)
    const p = pos(e);
    if (!p) return;
    sc.tapAt = p;
    sc.ptr = { x: p.x, y: p.y, down: true, multi: !!(e.ctrlKey || e.metaKey), button: e.button || 0, id: e.pointerId };
  }, { passive: true });
  cv.addEventListener('pointermove', (e) => { const sc = topNeta(g); if (!sc || !sc.ptr) return; const p = pos(e); if (p) { sc.ptr.x = p.x; sc.ptr.y = p.y; } }, { passive: true });
  const up = () => { const sc = topNeta(g); if (sc && sc.ptr) sc.ptr.down = false; };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) cv.addEventListener(ev, up, { passive: true });
  cv.addEventListener('wheel', (e) => { const sc = topNeta(g); if (sc && typeof sc.wheel === 'function' && sc.wheel(e.deltaY, e)) e.preventDefault(); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => { const sc = topNeta(g); if (!sc || typeof sc.contextAt !== 'function') return; const p = pos(e); if (p && sc.contextAt(p, e)) e.preventDefault(); });
}
export class Base {
  constructor(g, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isNetaUI: true, t: 0, modals: [], toasts: [], busy: 0, tapAt: null, ptr: null, closed: false });
    bindTap(g);
  }
  update(g) {
    this.t++;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < (this.toastLife || 140));
    const inp = g.input;
    let tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    const m = this.modals[this.modals.length - 1];
    if (m) { if (tap) m.tap(this, tap, inp); m.update(this, inp); return; }
    if (this.busy > 0) return;
    if (tap && this.tt) {
      // touch layout: the top bar (× cell, the scene's own bar items), else back to the screen's own units
      if (tap.y < TB + 2) { const now = inp.pressedNow || {}; now.a = false; if (tap.x >= SW - TB) { sfx('cancel'); this.onCloseTap(); } else this.touchBarTap(tap, inp); return; }
      tap = { x: (tap.x - this.tt.tox) / this.tt.ts, y: (tap.y - this.tt.toy) / this.tt.ts };
    }
    if (tap && this.handleTap(tap, inp)) return;
    this.updateBody(inp);
  }
  handleTap() { return false; }
  onCloseTap() { this.close(); }
  touchBarTap() {}
  drawTouchBar(c) { T(c, this.touchTitle || '', 12, TB / 2 - 10, 16, K.gold, 'left', SW - TB - 24); }
  draw(c, g) {
    if (!isTouch()) { this.tt = null; this.drawScreen(c, g); this.drawOver(c); return; }
    const y0 = this.touchY0 || 20;
    const ts = (SH - TB - 2) / (SH - y0);
    const tt = (this.tt = { ts, tox: (SW - SW * ts) / 2, toy: TB + 2 - y0 * ts });
    R(c, 0, 0, SW, SH, K.bg);
    c.save(); c.beginPath(); c.rect(0, TB + 2, SW, SH - TB - 2); c.clip(); c.translate(tt.tox, tt.toy); c.scale(ts, ts);
    try { this.drawScreen(c, g); } catch (e) { console.error(e); }
    c.restore();
    R(c, 0, 0, SW, TB, K.head); R(c, 0, TB, SW, 2, K.edge);
    try { this.drawTouchBar(c, g); } catch (e) { console.error(e); }
    R(c, SW - TB + 1, 0, TB - 2, TB - 2, '#3a1a2a');
    T(c, '×', SW - TB / 2, TB / 2 - 12, 24, K.text, 'center');
    this.drawOver(c);
  }
  updateBody() {}
  async act(fn) { this.busy++; try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); } }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { return this.openModal(modal({ ...o, kind: 'confirm' })); }
  pick(o) { return this.openModal(modal({ ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { return this.openModal(modal({ title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
  toast(s, color = K.gold) { this.toasts.unshift({ text: String(s), t: 0, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  wheel(dy) { const m = this.modals[this.modals.length - 1]; if (m && typeof m.wheel === 'function') { m.wheel(dy); return true; } return false; }
  close(v = null) {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.modals.splice(0)) m._res(m.kind === 'pick' ? -1 : null);
    this.g.pop(this);
    for (const s of this.g.scenes) if (s.isPhone) s.tapAt = null;
    this.resolve(v);
  }
  drawOver(c) {
    // toast positions are in the screen's own units (scaled with the body on touch)
    const tt = this.tt || { ts: 1, tox: 0, toy: 0 };
    const ty = tt.toy + (this.toastY || 300) * tt.ts, tx = tt.tox + (this.toastX || SW / 2) * tt.ts, dir = this.toastDir || -1;
    const maxW = (this.toastW || SW - 40) * tt.ts;
    this.toasts.slice(0, this.toastMax || 3).forEach((t, i) => { const w = Math.min(maxW, measure(c, t.text, 12) + 20); R(c, tx - w / 2, ty + dir * i * 22, w, 20, 'rgba(0,0,0,0.88)'); T(c, t.text, tx, ty + 4 + dir * i * 22, 12, t.color, 'center', w - 10); });
    for (const m of this.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)'); m.draw(this, c); }
  }
}
// Modal colours: the dark default, or an era skin from the editor (neta_editor_skin.js) so the menus match the desk.
const DARK_PAL = { bg: '#160f20', edge: K.edge, accent: K.gold, title: K.gold, text: K.text, dim: K.dim, faint: K.faint, row: '#1e1529', sel: K.sel, selBar: K.gold, selText: K.text, btn: '#2a1e38', btnText: K.text, btnOn: K.gold, btnOnText: K.ink, bar: '#120c18' };
const SKIN_PAL = { showa: { row: '#f7efd2', sel: '#d8412f', selText: '#fff7e6', selBar: '#7a2a1a' }, heisei_early: { row: '#ffffff', sel: '#000080', selText: '#ffffff', selBar: '#ffe000' }, heisei: { row: '#ffffff', sel: '#316ac5', selText: '#ffffff', selBar: '#ffcc00' }, reiwa: { row: '#211d2e', sel: '#3a3060', selText: '#ffffff', selBar: '#a98bff' } };
export function palOf(o) {
  const sk = o && o.skin;
  if (!sk) return DARK_PAL;
  const x = SKIN_PAL[sk.id] || SKIN_PAL.reiwa;
  return { bg: sk.panel, edge: sk.panelEdge, accent: sk.accent, title: sk.dark && sk.id !== 'heisei_early' ? sk.panelHeadText : sk.panelHead, text: sk.id === 'heisei_early' || !sk.dark ? sk.panelText : sk.panelText, dim: sk.panelDim, faint: sk.faint, row: x.row, sel: x.sel, selBar: x.selBar, selText: x.selText, btn: sk.tool, btnText: sk.toolText, btnOn: sk.toolOn, btnOnText: sk.toolOnText, bar: sk.dark ? mix(sk.panel, '#000000', 0.35) : mix(sk.panel, '#000000', 0.08), headBg: sk.panelHead, headText: sk.panelHeadText };
}
// A modal: confirm (title, lines, choices) or pick (title, lines?, items [{ label, sub, right, rightColor, lock, why, head }]).
// A `head` item is a section heading (drawn small, skipped by the cursor and taps). Touch rows are at least 38 units tall.
export function modal(o) {
  const items0 = o.items || [];
  const firstSel = () => { let i = o.index || 0; while (i < items0.length - 1 && items0[i] && items0[i].head) i++; return i; };
  const m = {
    ...o, idx: o.kind === 'pick' ? firstSel() : o.index || 0, top: 0,
    get n() { return o.kind === 'pick' ? (o.items || []).length : (o.choices || ['OK']).length; },
    stepIdx(dir, count = 1) {
      const n = m.n;
      if (!n) return;
      for (let c = 0; c < count; c++) for (let k = 0; k < n; k++) { const nx = m.idx + dir; if (count > 1 && (nx < 0 || nx >= n)) break; m.idx = (m.idx + dir + n) % n; const it = o.items && o.items[m.idx]; if (!it || !it.head) break; }
    },
    wheel(dy) { if (o.kind === 'pick' && m.n) { m.stepIdx(dy > 0 ? 1 : -1); sfx('cursor'); } },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.n;
      if (o.kind === 'pick') {
        const sp = (key) => { const tm = (inp.repeatTimer && inp.repeatTimer[key]) || 0; return tm > 100 ? 5 : tm > 60 ? 3 : tm > 36 ? 2 : 1; }; // hold = faster on long lists
        if (n && inp.repeat('up')) { m.stepIdx(-1, sp('up')); sfx('cursor'); }
        if (n && inp.repeat('down')) { m.stepIdx(1, sp('down')); sfx('cursor'); }
        if (n && inp.pressed('a')) { const it = o.items[m.idx]; if (it && it.lock) { sfx('buzz'); if (it.why) ui.toast(it.why, K.dim); } else { sfx('ok'); ui.closeModal(m, m.idx); } }
        else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, -1); }
        return;
      }
      if (inp.repeat('left') || inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('right') || inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, o.cancel != null ? o.cancel : n - 1); }
    },
    tap(ui, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (let i = 0; i < (m.rects || []).length; i++) {
        if (!inR(tap.x, tap.y, m.rects[i])) continue;
        const it = o.items && o.items[i];
        if (it && it.head) return;
        if (o.kind === 'confirm' || m.idx === i) { m.idx = i; if (it && it.lock) { sfx('buzz'); if (it.why) ui.toast(it.why, K.dim); return; } sfx('ok'); ui.closeModal(m, i); } else { m.idx = i; sfx('cursor'); }
        return;
      }
      if (!inR(tap.x, tap.y, m.box)) { sfx('cancel'); ui.closeModal(m, o.kind === 'pick' ? -1 : o.cancel != null ? o.cancel : m.n - 1); }
    },
    draw(ui, c) {
      const touch = isTouch();
      const P = palOf(o);
      const w = Math.min(SW - 40, o.w || 440);
      const x = Math.round((SW - w) / 2);
      const lines = [];
      for (const l of o.lines || []) lines.push(...jwrap(c, String(l ?? ''), w - 24, 12));
      const pick = o.kind === 'pick';
      // a row with a sub-label gets room for both lines (label 12px + sub 10px, 3px padding)
      const anySub = pick && (o.items || []).some((it) => it && it.sub);
      let rh = anySub ? Math.max(32, o.rh || 0) : o.rh || 26;
      if (touch) rh = Math.max(rh, anySub ? 46 : 42);
      const bh = touch ? 52 : 26;
      const shownLines = lines.slice(0, pick ? 5 : 13);
      const maxRows = pick ? Math.min(m.n, Math.max(3, Math.floor((SH - 70 - shownLines.length * 16) / rh))) : 0;
      const h = 26 + shownLines.length * 16 + (pick ? maxRows * rh + 8 : bh + 12) + 6;
      const y = Math.round((SH - h) / 2);
      m.box = { x, y, w, h };
      R(c, x, y, w, h, P.bg);
      R(c, x, y, w, 2, o.danger ? K.red : o.color || P.accent);
      R(c, x, y + h - 1, w, 1, P.edge); R(c, x, y, 1, h, P.edge); R(c, x + w - 1, y, 1, h, P.edge);
      T(c, o.title || '', x + 12, y + 7, 12, o.danger ? K.red : o.color || P.title, 'left', w - 70);
      shownLines.forEach((l, i) => T(c, l, x + 12, y + 26 + i * 16, 12, P.text, 'left', w - 24));
      m.rects = [];
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + maxRows) m.top = m.idx - maxRows + 1;
        // a heading directly above the first visible row stays visible
        if (m.top > 0 && o.items[m.top - 1] && o.items[m.top - 1].head && m.idx === m.top) m.top--;
        const y0 = y + 28 + shownLines.length * 16;
        for (let k = 0; k < maxRows && m.top + k < m.n; k++) {
          const it = o.items[m.top + k];
          const yy = y0 + k * rh;
          if (it.head) { T(c, it.label, x + 14, yy + Math.round((rh - 2 - 10) / 2) + 2, 10, P.title, 'left', w - 36); R(c, x + 14 + Math.min(w - 60, Math.ceil(measure(c, it.label, 10)) + 8), yy + Math.round(rh / 2), Math.max(0, w - 36 - Math.ceil(measure(c, it.label, 10)) - 8), 1, P.edge); continue; }
          const sel = m.top + k === m.idx;
          R(c, x + 8, yy, w - 16, rh - 2, sel ? P.sel : P.row);
          if (sel) R(c, x + 8, yy, 2, rh - 2, P.selBar);
          const rw = it.right ? measure(c, it.right, 10) + 12 : 0;
          const tcol = it.lock ? P.faint : sel ? P.selText : P.text, scol = it.lock ? P.faint : sel ? P.selText : P.dim;
          if (anySub && it.sub) {
            T(c, it.label, x + 16, yy + (touch ? 5 : 3), 12, tcol, 'left', w - 36 - rw);
            T(c, it.sub, x + 16, yy + (touch ? 21 : 17), 10, scol, 'left', w - 36);
          } else T(c, it.label, x + 16, yy + Math.round((rh - 2 - 14) / 2), 12, tcol, 'left', w - 36 - rw);
          if (it.right) T(c, it.right, x + w - 14, yy + Math.round((rh - 2 - 10) / 2), 10, sel ? P.selText : it.rightColor || P.dim, 'right');
          m.rects[m.top + k] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
        }
        if (m.n > maxRows) T(c, `${m.idx + 1}／${m.n}`, x + w - 12, y + 7, 10, P.dim, 'right');
      } else {
        const ch = o.choices || ['OK'];
        const bw = Math.min(170, Math.floor((w - 24 - (ch.length - 1) * 8) / ch.length));
        const total = ch.length * bw + (ch.length - 1) * 8;
        ch.forEach((label, i) => {
          const bx = x + Math.round((w - total) / 2) + i * (bw + 8), by = y + h - bh - 8;
          const sel = i === m.idx;
          R(c, bx, by, bw, bh, sel ? (o.danger && i === (o.dangerIdx ?? 0) ? K.red : P.btnOn) : P.btn);
          T(c, label, bx + bw / 2, by + Math.round((bh - 14) / 2), 12, sel ? (o.danger && i === (o.dangerIdx ?? 0) ? '#ffffff' : P.btnOnText) : P.btnText, 'center', bw - 8);
          m.rects[i] = { x: bx, y: by, w: bw, h: bh };
        });
      }
    },
  };
  return m;
}

// The parts picker (tabs of candidates; A adds and keeps it open; B closes)
export function partsModal(o) {
  const m = {
    kind: 'parts', tab: o.tab || 0, idx: 0, top: 0, t: 0, ...o,
    items() { const tb = m.tabs[m.tab]; return tb ? tb.items : []; },
    wheel(dy) { const n = m.items().length; if (n) { m.idx = (m.idx + (dy > 0 ? 1 : n - 1)) % n; sfx('cursor'); } },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.items().length;
      if (inp.repeat('left')) { m.tab = (m.tab + m.tabs.length - 1) % m.tabs.length; m.idx = 0; m.top = 0; sfx('cursor'); return; }
      if (inp.repeat('right')) { m.tab = (m.tab + 1) % m.tabs.length; m.idx = 0; m.top = 0; sfx('cursor'); return; }
      const sp = (key) => { const tm = (inp.repeatTimer && inp.repeatTimer[key]) || 0; return tm > 100 ? 5 : tm > 60 ? 3 : tm > 36 ? 2 : 1; };
      if (n && inp.repeat('up')) { m.idx = inp.pressed('up') ? (m.idx + n - 1) % n : Math.max(0, m.idx - sp('up')); sfx('cursor'); }
      if (n && inp.repeat('down')) { m.idx = inp.pressed('down') ? (m.idx + 1) % n : Math.min(n - 1, m.idx + sp('down')); sfx('cursor'); }
      if (n && inp.pressed('a')) { sfx('ok'); m.onPick(m.tabs[m.tab], m.items()[m.idx]); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, null); }
    },
    tap(ui, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (let i = 0; i < (m.tabRects || []).length; i++) if (inR(tap.x, tap.y, m.tabRects[i])) { if (m.tab !== i) { m.tab = i; m.idx = 0; m.top = 0; sfx('cursor'); } return; }
      if (inR(tap.x, tap.y, m.closeRect)) { sfx('cancel'); ui.closeModal(m, null); return; }
      for (let i = 0; i < (m.rects || []).length; i++) if (m.rects[i] && inR(tap.x, tap.y, m.rects[i])) { if (m.idx === i) { sfx('ok'); m.onPick(m.tabs[m.tab], m.items()[i]); } else { m.idx = i; sfx('cursor'); } return; }
      if (!inR(tap.x, tap.y, m.box)) { sfx('cancel'); ui.closeModal(m, null); }
    },
    draw(ui, c) {
      const P = palOf(o);
      const x = 16, y = 16, w = SW - 32, h = SH - 32;
      m.box = { x, y, w, h };
      R(c, x, y, w, h, P.bg);
      R(c, x, y, w, 2, P.accent); R(c, x, y + h - 1, w, 1, P.edge); R(c, x, y, 1, h, P.edge); R(c, x + w - 1, y, 1, h, P.edge);
      T(c, o.title || '部品から足す', x + 10, y + 6, 12, P.title, 'left', 300);
      const touch = isTouch(), cw = touch ? TB : 24;
      T(c, o.note || '', x + w - cw - 6, y + 7, 10, P.dim, 'right', w - 336 - cw);
      m.closeRect = touch ? { x: x + w - TB, y, w: TB, h: TB } : { x: x + w - 24, y, w: 24, h: 22 };
      if (touch) { R(c, x + w - TB + 1, y + 2, TB - 3, TB - 3, '#3a1a2a'); T(c, '×', x + w - TB / 2, y + TB / 2 - 12, 24, K.text, 'center'); }
      else T(c, '×', x + w - 12, y + 5, 12, P.dim, 'center');
      // tabs (wrap to a second row when they do not fit)
      m.tabRects = [];
      let tx = x + 8, ty = y + 24;
      m.tabs.forEach((tb, i) => {
        const tw = Math.ceil(measure(c, tb.label, 10)) + 14;
        if (tx + tw > x + w - (touch ? TB + 4 : 8)) { tx = x + 8; ty += 18; }
        const on = i === m.tab;
        R(c, tx, ty, tw, 16, on ? P.btnOn : P.btn);
        T(c, tb.label, tx + tw / 2, ty + 3, 10, on ? P.btnOnText : P.btnText, 'center', tw - 4);
        m.tabRects.push({ x: tx, y: ty, w: tw, h: 16 });
        tx += tw + 4;
      });
      const ly = Math.max(ty + 22, touch ? y + TB + 4 : 0);
      const rh = touch ? 34 : 22;
      const items = m.items();
      const vis = Math.max(1, Math.floor((y + h - 40 - ly) / rh));
      if (m.idx < m.top) m.top = m.idx;
      if (m.idx >= m.top + vis) m.top = m.idx - vis + 1;
      m.rects = [];
      if (!items.length) T(c, '（この時代・種類で使える部品がない）', x + w / 2, ly + 20, 12, P.dim, 'center');
      for (let k = 0; k < vis && m.top + k < items.length; k++) {
        const i = m.top + k, it = items[i];
        const yy = ly + k * rh;
        const sel = i === m.idx;
        R(c, x + 8, yy, w - 16, rh - 2, sel ? P.sel : P.row);
        if (sel) R(c, x + 8, yy, 2, rh - 2, P.selBar);
        let xx = x + 14;
        const cy = yy + Math.round((rh - 2 - 14) / 2);
        if (it.role) xx += chip(c, xx, cy, ROLE_SHORT[it.role] || '', ROLE_COL[it.role] || K.dim, 34) + 4;
        if (it.beat) xx += chip(c, xx, cy, BEAT_SHORT[it.twist ? 'uragiri' : it.beat] || it.beat, BEAT_COL[it.twist ? 'uragiri' : it.beat] || K.dim, 38) + 6;
        const right = it.theme ? `（${it.theme}）` : it.type ? (BOKE_TYPES[it.type] || (it.type === 'stock' ? 'ありがち' : it.type)) : '';
        const rw = right ? Math.min(150, measure(c, right, 10) + 10) : 0;
        T(c, it.text + (it.pair ? `　→ ${it.pair.text}` : ''), xx, cy + 1, 12, sel ? P.selText : P.text, 'left', x + w - 16 - xx - rw);
        if (right) T(c, right, x + w - 14, cy + 2, 10, sel ? P.selText : it.theme ? P.dim : K.pink, 'right', 150);
        m.rects[i] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
      }
      if (items.length > vis) T(c, `${m.idx + 1}／${items.length}`, x + w - 12, y + h - 34, 10, P.dim, 'right');
      R(c, x + 1, y + h - 22, w - 2, 21, P.bar);
      T(c, o.help || '←→ 分類　↑↓ えらぶ　A 足す（続けて足せる）　B 閉じる', x + 10, y + h - 17, 10, P.dim, 'left', w - 20);
    },
  };
  return m;
}
