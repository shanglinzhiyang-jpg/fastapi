// お笑いの土台 — screens (owner: A): the 芸人手帳 (HD 640x360: ステータス・コンビ・芸歴と記録・実力不足・目標・練習),
// the 相方募集 screen (era boards, your contacts, your own 募集), the meeting scene (喫茶店 / ファミレス / カフェ) and the
// phone apps 「芸人手帳」 and 「相方募集」. Only calls g.* methods (owarai.js / owarai_net.js / owarai_nsc.js), feature-detected.
// Keys: ←→ tabs, ↑↓ rows, A act, B back / close, MENU close. Taps: tabs, rows (first tap selects, second acts), ×, modal buttons.
// Under g.auto the HD screens do not open unless g.auto.owarai is set (tests).

import { Game } from './game.js';
import { SW, SH, clamp, fmtMoney } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { registerPhoneApp, PEOPLE } from './life.js';
import { phoneList, phoneInfo, appTile } from './phone.js';
import { charSheetHD, drawFaceHD } from './sprites.js';
import { AGENCIES } from './state.js';
import {
  COMEDY_STATS, STAT_KEYS, STAT_SHORT, KINDS, KIND_ORDER, ROLES, STYLES, SOURCES, THEATER_RANKS, GROW_HINT, BOARDS, MEET_SPOTS,
  QUIRKS, PERSONAS, MOTIVES, num, dateOf, ymLabel, personName, eraKey, CANDIDATES,
} from './owarai_data.js';
import * as NUI from './owarai_net_ui.js'; // [R9-C] the flashy 相方募集 skin (board screen + meeting overlay)

const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const K = {
  bg: '#17121c', head: '#2a1a2c', panel: '#221a2a', panel2: '#2e2438', edge: '#4a3a58', edgeHi: '#9a7ac0', text: '#f4eee6', dim: '#bcaec8', faint: '#7e6e8c',
  gold: '#ffd23f', pink: '#ff7eb6', cyan: '#5fd7ff', good: '#5ee07a', bad: '#ff6470', warn: '#ffcc4d', sel: '#3c2a50', lock: '#c9a76a', ink: '#1a1206',
};
// ---------------------------------------------------------------- text (every string gets a width: no overflow)
function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
function T(c, s, x, y, size = 12, color = K.text, align = 'left', w = 0) { text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: null }); }
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const TOKEN = /[−\-]?[0-9０-９]+(?:[.,][0-9]+)*(?:[／/][0-9]+)?(?:[%％年月日歳人分万円倍回本点期]+)?|[A-Za-z0-9.,:%/+\-#@_'’]+|\s+|./gu;
function jwrap(c, str, w, size = 12) {
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
  return out;
}
function para(c, s, x, y, w, size = 12, color = K.text, lh = 0, maxLines = 99) {
  const ls = jwrap(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], x, y + i * step, size, color);
  return n * step;
}
function box(c, x, y, w, h, title, opts = {}) {
  R(c, x, y, w, h, opts.bg || K.panel);
  R(c, x, y, w, 1, opts.accent || K.edge); R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
  if (title) { R(c, x + 1, y + 1, w - 2, 15, K.panel2); T(c, title, x + 6, y + 2, 10, opts.accent || K.gold, 'left', w - 12 - (opts.right ? measure(c, opts.right, 10) + 8 : 0)); if (opts.right) T(c, opts.right, x + w - 6, y + 2, 10, K.dim, 'right'); }
}
function bar(c, x, y, w, v, max = 100, col = K.gold, h = 6) {
  R(c, x, y, w, h, '#120c18');
  R(c, x, y, Math.max(0, Math.round((w * clamp(num(v), 0, max)) / max)), h, col);
}
const statCol = (v) => (v >= 80 ? K.gold : v >= 60 ? K.good : v >= 40 ? K.cyan : v >= 20 ? K.warn : K.bad);
const harmCol = (v) => (v >= 70 ? K.good : v >= 45 ? K.cyan : v >= 25 ? K.warn : K.bad);
const STAT_DESC = {
  neta: 'ネタの設定・ボケの数・展開を考える力。台本の出来に直結する。', boke: 'ボケの言い回し、表情、ズレの大きさ。', tsukkomi: 'ツッコミのワード選び・タイミング・強さ。',
  ma: '間（ま）とテンポ。笑いを待つ、たたみかける。漫才・落語の命。', voice: '声の大きさと滑舌。後ろの席まで届くか、噛まないか。', act: 'コントの役に入る力、落語の演じ分け。',
  hassou: '人が思いつかない切り口。大喜利・ピン芸の要。', wagei: '語りで引きこむ力。トーク・落語・しゃべくり漫才。', dokyo: '本番で物おじしない心臓。場数で育つ。',
  chara: '舞台に立っただけで目を引く華、覚えてもらえる個性。', adlib: '想定外を笑いに変える力。スベった時の立て直し。', mane: '声・しぐさを写しとる力。ものまね・歌ネタ。',
  kosei: 'ツカミ→展開→オチの組み立て、尺の配分（尺オーバー防止）。', kankyaku: '客層と空気を読む力。ウケない日に立て直す。',
};

// ================================================================ the meeting scene (owarai_net.js pushes it)
export class MeetScene {
  constructor(g, o) { Object.assign(this, { g, o, hd: true, opaque: true, hidesHud: true, t: 0, mode: 'wait', trial: null }); }
  update() { this.t++; }
  draw(c, g) {
    const spot = this.o.spot || 'kissa';
    const P = PEOPLE[this.o.pid] || {};
    const wall = { kissa: '#4a2e1c', famires: '#f2e6c8', cafe: '#e8e2d6' }[spot];
    const floor = { kissa: '#2e1c12', famires: '#c8a878', cafe: '#a8865c' }[spot];
    R(c, 0, 0, SW, SH, wall);
    // window
    const wx = 180, wy = 40;
    R(c, wx, wy, 280, 120, spot === 'kissa' ? '#6a4a2a' : '#8a6a4a');
    R(c, wx + 6, wy + 6, 268, 108, spot === 'kissa' ? '#2a3a5a' : '#9fd0ee');
    if (spot !== 'kissa') { for (let i = 0; i < 5; i++) R(c, wx + 20 + i * 56, wy + 70 + (i % 2) * 8, 36, 44, i % 2 ? '#d8d0c0' : '#c0c8d0'); R(c, wx + 6, wy + 104, 268, 10, '#7a8a6a'); }
    else { for (let i = 0; i < 12; i++) R(c, wx + 12 + i * 22, wy + 20 + (i * 37) % 40, 2, 2, '#ffe9a0'); }
    R(c, wx + 138, wy + 6, 4, 108, spot === 'kissa' ? '#6a4a2a' : '#8a6a4a');
    if (spot === 'kissa') { for (let x = wx + 6; x < wx + 274; x += 8) R(c, x, wy + 6, 4, 22, 'rgba(255,250,235,0.55)'); }
    // lamps / plants
    if (spot === 'kissa') { for (const lx of [90, 550]) { R(c, lx, 0, 2, 50, '#2a1a10'); R(c, lx - 14, 50, 30, 16, '#c88a3a'); R(c, lx - 10, 66, 22, 4, '#ffe0a0'); } }
    if (spot === 'cafe') { for (const px of [70, 560]) { R(c, px, 150, 30, 40, '#7a5a3a'); R(c, px - 10, 100, 50, 56, '#4a8a4a'); R(c, px - 4, 92, 38, 20, '#5aa05a'); } }
    if (spot === 'famires') { R(c, 0, 176, SW, 6, '#c0392b'); }
    // floor
    R(c, 0, 250, SW, SH - 250, floor);
    // seats (booth backs)
    const seat = spot === 'famires' ? '#b8323a' : spot === 'cafe' ? '#6a4a30' : '#7a2a2a';
    R(c, 110, 170, 120, 90, seat); R(c, 410, 170, 120, 90, seat);
    // the two of them (upper bodies, 3x)
    const me = charSheetHD(g.state.look || {});
    // full frames at 3x; the table hides the legs
    const drawUpper = (sheet, dir, x, y) => { const im = (sheet[dir] || sheet.down)[0]; c.drawImage(im, 0, 0, im.width, im.height, x, y, 96, 120); };
    const bob = Math.floor(this.t / 30) % 2;
    drawUpper(me, 'right', 140, 116 + (this.mode === 'trial' ? bob * 2 : 0) + NUI.meetHop(this, g, 0)); // [R9-C] hop when formed
    if (this.mode !== 'wait' && P.look) drawUpper(charSheetHD(P.look), 'left', 404, 116 + (this.mode === 'trial' ? (1 - bob) * 2 : 0) + NUI.meetHop(this, g, 1));
    // table
    R(c, 170, 228, 300, 14, spot === 'famires' ? '#f4f4f4' : '#8a5a33');
    R(c, 170, 242, 300, 6, spot === 'famires' ? '#c8c8c8' : '#5a3a20');
    R(c, 310, 248, 20, 60, '#3a2a1a');
    // drinks
    const drink = (x) => {
      if (spot === 'kissa') { R(c, x, 196, 16, 32, 'rgba(220,240,255,0.6)'); R(c, x + 2, 206, 12, 22, '#4ad06a'); R(c, x + 1, 196, 14, 10, '#fff8e8'); R(c, x + 6, 190, 5, 5, '#e02030'); }
      else if (spot === 'famires') { R(c, x, 200, 16, 28, 'rgba(220,240,255,0.6)'); R(c, x + 2, 208, 12, 20, '#c86a2a'); R(c, x + 12, 188, 2, 20, '#ffffff'); }
      else { R(c, x, 210, 20, 18, '#f8f4ee'); R(c, x + 2, 212, 16, 4, '#c89a6a'); R(c, x + 20, 214, 4, 8, '#f8f4ee'); }
    };
    drink(236); if (this.mode !== 'wait') drink(392);
    if (this.mode === 'trial') { T(c, '♪', 300, 150 - bob * 4, 18, K.gold, 'center'); T(c, '!', 340, 140 + bob * 4, 18, K.pink, 'center'); }
    // [R9-C] caption, name plate, trial telop, 手ごたえ meter, コンビ結成！ (owarai_net_ui.js)
    try { NUI.meetOverlay(this, c, g); } catch (e) { console.error(e); }
  }
}

// ================================================================ the generic HD screen
const LIST = { x: 4, y: 42, w: 236, h: 292, rh: 22 };
const DETAIL = { x: 244, y: 42, w: 392, h: 292 };
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
// Touch layout (body.touch): a 70-unit tab bar with a 70×70 × cell (≈ 44 CSS px at a 412-px-wide canvas: 640 units → 412 px),
// no footer, and the body (list + detail, drawn for y 42..334) scaled by 286/292 into y 72..358. Desktop is unchanged.
const isTouch = () => typeof document !== 'undefined' && !!document.body && document.body.classList.contains('touch');
const TB = 70;
const TS = (SH - TB - 2) / 292;
const TOX = (SW - SW * TS) / 2;
const TOY = TB + 2 - 42 * TS;
const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isOwaraiUI && !s.closed);
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
class OwScreen {
  constructor(g, cfg, opts, resolve) {
    Object.assign(this, { g, cfg, resolve, hd: true, opaque: true, hidesHud: true, isOwaraiUI: true, t: 0, focus: opts && opts.tab ? 'body' : 'tabs', lists: {}, modals: [], toasts: [], busy: 0, tapAt: null, closed: false, dataT: -999 });
    this.tabIdx = Math.max(0, cfg.tabs.findIndex((t) => t.id === (opts && opts.tab)));
    bindTap(g);
    this.refresh(true);
  }
  get tab() { return this.cfg.tabs[this.tabIdx]; }
  ls(id = this.tab.id) { return this.lists[id] || (this.lists[id] = { i: 0, top: 0 }); }
  rows() { return this._rows || []; }
  curRow() { const st = this.ls(); return this.rows()[st.i] || null; }
  refresh(force = false) {
    if (!force && this.t - this.dataT < 30) return;
    this.dataT = this.t;
    if (this.cfg.tabsFn) { const tabs = safe(() => this.cfg.tabsFn(this.g), null); if (tabs && tabs.length) { const id = this.tab && this.tab.id; this.cfg.tabs = tabs; const i = tabs.findIndex((t) => t.id === id); this.tabIdx = i < 0 ? Math.min(this.tabIdx, tabs.length - 1) : i; } }
    this._rows = safe(() => this.tab.rows(this), []) || [];
    const st = this.ls();
    if (st.i >= this._rows.length) st.i = Math.max(0, this._rows.length - 1);
    if (this._rows[st.i] && this._rows[st.i].header) { const j = this._rows.findIndex((r) => !r.header); st.i = j < 0 ? 0 : j; }
  }
  dirty() { this.dataT = -999; }
  setTab(i) { const n = this.cfg.tabs.length; this.tabIdx = (i + n) % n; this.refresh(true); }
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
      if (inp.repeat('left')) { this.setTab(this.tabIdx - 1); sfx('cursor'); } else if (inp.repeat('right')) { this.setTab(this.tabIdx + 1); sfx('cursor'); } else if (inp.pressed('down') || inp.pressed('a')) { this.focus = 'body'; sfx('cursor'); } else if (inp.pressed('b')) { sfx('cancel'); this.close(); }
      return;
    }
    if (inp.pressed('b')) { this.focus = 'tabs'; sfx('cancel'); return; }
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
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    const touch = !!this.touchLayout;
    if (inR(tap.x, tap.y, touch ? { x: SW - TB, y: 0, w: TB, h: TB } : { x: SW - 24, y: 0, w: 24, h: 20 })) { now.a = false; sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < (this.tabRects || []).length; i++) if (inR(tap.x, tap.y, this.tabRects[i])) { now.a = false; this.focus = 'tabs'; if (i !== this.tabIdx) { this.setTab(i); sfx('cursor'); } return true; }
    // the body is drawn scaled on touch: back to its own units
    const x = touch ? (tap.x - TOX) / TS : tap.x, y = touch ? (tap.y - TOY) / TS : tap.y;
    const L = this.listRect;
    if (L && inR(x, y, L)) {
      const rows = this.rows();
      const st = this.ls();
      const j = (st.top || 0) + Math.floor((y - L.y - 2) / L.rh);
      if (j >= 0 && j < rows.length && !rows[j].header) { this.focus = 'body'; if (j !== st.i) { st.i = j; now.a = false; sfx('cursor'); return true; } return false; }
      now.a = false; return true;
    }
    // the detail area: its own buttons (tab.tap), else nothing
    if (this.tab.tap) { const r = safe(() => this.tab.tap(this, x, y), false); if (r) { now.a = false; return true; } }
    now.a = false;
    return true;
  }
  async act(fn) { this.busy++; try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); this.dirty(); for (const s of this.g.scenes) if (s.isPhone) s.tapAt = null; } }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { if (this.g.auto) return Promise.resolve(o.auto ?? 0); return this.openModal(modal({ ...o, kind: 'confirm' })); }
  pick(o) { if (this.g.auto) return Promise.resolve(o.auto ?? 0); return this.openModal(modal({ ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { if (this.g.auto) return Promise.resolve(0); return this.openModal(modal({ title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
  toast(s, color = K.gold) { this.toasts.unshift({ text: String(s), t: 0, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.modals.splice(0)) m._res(null);
    this.g.pop(this);
    for (const s of this.g.scenes) if (s.isPhone) s.tapAt = null;
    this.resolve(null);
  }
  drawTouch(c, g) {
    const th = this.cfg.theme || {};
    R(c, 0, 0, SW, SH, th.bg || K.bg);
    this.tabRects = [];
    const tabs = this.cfg.tabs;
    const tw = (SW - TB) / tabs.length;
    tabs.forEach((tb, i) => {
      const x = Math.round(i * tw), w = Math.round((i + 1) * tw) - x, on = i === this.tabIdx;
      R(c, x + 1, 0, w - 2, TB - 2, on ? (this.focus === 'tabs' ? (th.accent || K.gold) : K.panel2) : '#120d16');
      if (on) R(c, x + 1, TB - 5, w - 2, 3, th.accent || K.gold);
      T(c, tb.label, x + w / 2, TB / 2 - 8, 14, on && this.focus === 'tabs' ? K.ink : on ? (th.accent || K.gold) : K.text, 'center', w - 8);
      if (tb.alert && safe(() => tb.alert(this), false)) R(c, x + w - 12, 8, 6, 6, K.bad);
      this.tabRects.push({ x, y: 0, w, h: TB });
    });
    R(c, SW - TB + 1, 0, TB - 2, TB - 2, '#3a1a2a');
    T(c, '×', SW - TB / 2, TB / 2 - 12, 24, K.text, 'center');
    c.save();
    c.translate(TOX, TOY);
    c.scale(TS, TS);
    try { this.tab.draw(this, c); } catch (e) { console.error(e); }
    c.restore();
    this.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, 12) + 20); R(c, (SW - w) / 2, 300 - i * 22, w, 20, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * 22, 12, t.color, 'center', w - 10); });
    for (const m of this.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)'); m.draw(this, c); }
  }
  draw(c, g) {
    this.touchLayout = isTouch();
    if (this.touchLayout) { this.drawTouch(c, g); return; }
    const th = this.cfg.theme || {};
    R(c, 0, 0, SW, SH, th.bg || K.bg);
    R(c, 0, 0, SW, 20, th.head || K.head);
    T(c, typeof this.cfg.title === 'function' ? this.cfg.title(g) : this.cfg.title, 8, 3, 12, th.accent || K.gold, 'left', 200);
    const sub = safe(() => (this.cfg.sub ? this.cfg.sub(g) : ''), '') || '';
    T(c, sub, SW - 30, 4, 10, K.dim, 'right', 380);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    this.tabRects = [];
    const tabs = this.cfg.tabs;
    const tw = Math.floor(SW / tabs.length);
    tabs.forEach((tb, i) => {
      const x = i * tw, on = i === this.tabIdx;
      R(c, x + 1, 21, tw - 2, 18, on ? (this.focus === 'tabs' ? (th.accent || K.gold) : K.panel2) : '#120d16');
      T(c, tb.label, x + tw / 2, 24, 12, on && this.focus === 'tabs' ? K.ink : on ? (th.accent || K.gold) : K.text, 'center', tw - 8);
      if (tb.alert && safe(() => tb.alert(this), false)) R(c, x + tw - 9, 24, 4, 4, K.bad);
      this.tabRects.push({ x, y: 20, w: tw, h: 20 });
    });
    try { this.tab.draw(this, c); } catch (e) { console.error(e); }
    R(c, 0, 336, SW, 24, '#0c0810');
    R(c, 0, 336, SW, 1, K.edge);
    const foot = safe(() => (this.tab.foot ? this.tab.foot(this) : ''), '') || '';
    T(c, foot, 8, 343, 10, K.dim, 'left', 380);
    T(c, this.focus === 'tabs' ? '←→タブ　↓選ぶ　B閉じる' : '↑↓選ぶ　←→タブ　A決定　B戻る', SW - 6, 343, 10, K.dim, 'right', 240);
    this.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, 12) + 20); R(c, (SW - w) / 2, 300 - i * 22, w, 20, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * 22, 12, t.color, 'center', w - 10); });
    for (const m of this.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)'); m.draw(this, c); }
  }
}
function drawList(ui, c, L = LIST, drawRow = null) {
  const rows = ui.rows();
  const st = ui.ls();
  const n = Math.max(1, Math.floor((L.h - 4) / L.rh));
  st.top = clamp(st.top || 0, 0, Math.max(0, rows.length - n));
  if (st.i < st.top) st.top = st.i;
  if (st.i >= st.top + n) st.top = st.i - n + 1;
  R(c, L.x, L.y, L.w, L.h, K.panel);
  R(c, L.x, L.y, L.w, 1, K.edge); R(c, L.x, L.y + L.h - 1, L.w, 1, K.edge);
  ui.listRect = { ...L, n };
  if (!rows.length) T(c, '（なし）', L.x + 10, L.y + 8, 12, K.faint);
  for (let k = 0; k < n && st.top + k < rows.length; k++) {
    const r = rows[st.top + k];
    const y = L.y + 2 + k * L.rh;
    const sel = st.top + k === st.i && ui.focus === 'body';
    if (r.header) { R(c, L.x + 1, y, L.w - 2, L.rh - 1, '#140e1a'); T(c, r.label, L.x + 6, y + 4, 10, K.gold, 'left', L.w - 12); continue; }
    if (sel) { R(c, L.x + 1, y, L.w - 2, L.rh - 1, K.sel); R(c, L.x + 1, y, 2, L.rh - 1, K.gold); }
    if (drawRow) { drawRow(c, r, L.x, y, L.w, L.rh, sel); continue; }
    const rw = r.right ? measure(c, r.right, 10) + 10 : 0;
    T(c, r.label, L.x + 8, y + 4, 12, r.lock ? K.faint : r.color || K.text, 'left', L.w - 16 - rw);
    if (r.right) T(c, r.right, L.x + L.w - 6, y + 5, 10, r.rightColor || (r.lock ? K.lock : K.dim), 'right');
  }
  if (rows.length > n) { const h = Math.max(10, (L.h * n) / rows.length); R(c, L.x + L.w - 3, L.y + ((L.h - h) * st.top) / Math.max(1, rows.length - n), 2, h, K.edgeHi); }
}
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
        if (inp.pressed('a')) { const it = o.items[m.idx]; if (it && it.lock) { sfx('buzz'); ui.toast(it.lock, K.lock); return; } sfx('ok'); ui.closeModal(m, m.idx); } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, -1); }
        return;
      }
      if (inp.repeat('left') || inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('right') || inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, o.cancel != null ? o.cancel : (o.choices || ['OK']).length - 1); }
    },
    tap(ui, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (let i = 0; i < (m.rects || []).length; i++) if (inR(tap.x, tap.y, m.rects[i])) { if (m.idx === i || o.kind === 'confirm') { m.idx = i; const it = o.items && o.items[i]; if (o.kind === 'pick' && it && it.lock) { ui.toast(it.lock, K.lock); return; } ui.closeModal(m, i); } else m.idx = i; return; }
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
      const shown = lines.slice(0, pick ? 6 : 14);
      const h = 26 + shown.length * 16 + (pick ? maxRows * rh + 8 : 38) + 6;
      const y = Math.round((SH - h) / 2);
      m.box = { x, y, w, h };
      R(c, x, y, w, h, '#1c1424');
      R(c, x, y, w, 2, o.danger ? K.bad : K.gold);
      R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
      T(c, o.title || '', x + 12, y + 7, 12, o.danger ? K.bad : K.gold, 'left', w - 24);
      shown.forEach((l, i) => T(c, l, x + 12, y + 26 + i * 16, 12, K.text, 'left', w - 24));
      m.rects = [];
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + maxRows) m.top = m.idx - maxRows + 1;
        const y0 = y + 28 + shown.length * 16;
        for (let k = 0; k < maxRows && m.top + k < m.n; k++) {
          const it = o.items[m.top + k];
          const yy = y0 + k * rh;
          const sel = m.top + k === m.idx;
          R(c, x + 8, yy, w - 16, rh - 2, sel ? K.sel : '#251c2e');
          if (sel) R(c, x + 8, yy, 2, rh - 2, K.gold);
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
          R(c, bx, by, bw, 26, sel ? (o.danger && i === 0 ? K.bad : K.gold) : '#2a2034');
          T(c, label, bx + bw / 2, by + 6, 12, sel ? K.ink : K.text, 'center', bw - 8);
          m.rects[i] = { x: bx, y: by, w: bw, h: 26 };
        });
      }
    },
  };
  return m;
}
function openScreen(g, cfg, opts = {}) {
  if (!g || !g.state) return Promise.resolve(null);
  if (g.auto && !g.auto.owarai) return Promise.resolve(null);
  const open = g.scenes.find((s) => s.isOwaraiUI && !s.closed && s.cfg.id === cfg.id);
  if (open) return Promise.resolve(null);
  sfx('ok');
  return new Promise((resolve) => g.push(new OwScreen(g, cfg, opts, resolve)));
}

// ================================================================ 芸人手帳 tabs
const U = (g) => (has(g, 'unit') ? safe(() => g.unit(), null) : null);
const O = (g) => (has(g, 'owarai') ? safe(() => g.owarai(), null) : null);
function face(c, look, x, y, s = 1) { try { drawFaceHD(c, look || {}, x, y, s); } catch (e) { /* no face */ } }
function memberLine(g, m) { return `${m.id === 'player' ? '自分' : m.short}（${ROLES[m.role] || ''}）`; }
function yearsOf(g, u) { return u && u.type !== 'pin' ? Math.max(0, dateOf(g).year - num(u.formed.year, dateOf(g).year)) : num(safe(() => g.geireki(), 0)); }

const TAB_STATS = {
  id: 'stats', label: 'ステータス',
  rows(ui) {
    const o = O(ui.g);
    if (!o) return [];
    const out = [{ header: true, label: 'お笑いのステータス（0〜100）' }];
    for (const k of STAT_KEYS) out.push({ key: k, label: COMEDY_STATS[k], v: o.stats[k] });
    return out;
  },
  draw(ui, c) {
    const g = ui.g;
    drawList(ui, c, { ...LIST, rh: 19 }, (c2, r, x, y, w, rh, sel) => {
      T(c2, r.label, x + 8, y + 3, 12, K.text, 'left', 92);
      bar(c2, x + 104, y + 7, w - 146, r.v, 100, statCol(r.v));
      T(c2, String(Math.round(r.v)), x + w - 8, y + 3, 12, statCol(r.v), 'right');
    });
    const st = g.state;
    const D = DETAIL;
    box(c, D.x, D.y, D.w, 96, 'じぶん');
    face(c, st.look, D.x + 10, D.y + 22, 2);
    const age = safe(() => g.playerAge(), 20);
    const deb = safe(() => g.owarai().career.debut, null);
    const gy = safe(() => g.geireki(), 0);
    T(c, st.profile && st.profile.familyName ? `${st.profile.familyName} ${st.profile.givenName || st.name}` : st.name, D.x + 82, D.y + 22, 14, K.text, 'left', 200);
    T(c, `${age}歳・${st.agency ? `${(AGENCIES[st.agency] || {}).name || st.agency}所属（プロ）` : 'フリー（アマチュア）'}`, D.x + 82, D.y + 42, 10, K.dim, 'left', 300);
    T(c, deb ? `芸歴${gy + 1}年目（${ymLabel(deb)}${deb.how === 'nsc' ? 'NSC卒業' : deb.how === 'agency' ? '所属' : '初舞台'}）` : '芸歴：まだ（初舞台の前）', D.x + 82, D.y + 56, 10, K.cyan, 'left', 300);
    T(c, `体力 ${st.stamina}/${st.maxStamina}　ストレス ${Math.round(num(st.life && st.life.stress))}`, D.x + 82, D.y + 70, 10, num(st.life && st.life.stress) >= 70 ? K.bad : K.dim, 'left', 300);
    const row = ui.curRow();
    const y2 = D.y + 100;
    box(c, D.x, y2, D.w, 86, row && row.key ? COMEDY_STATS[row.key] : '');
    if (row && row.key) {
      para(c, STAT_DESC[row.key] || '', D.x + 8, y2 + 20, D.w - 16, 12, K.text, 15, 2);
      T(c, `伸ばし方：${GROW_HINT[row.key] || ''}`, D.x + 8, y2 + 52, 10, K.good, 'left', D.w - 16);
      const fr = safe(() => num(g.owarai().frac[row.key]), 0);
      T(c, `次の1ポイントまで ${Math.round(fr * 100)}%（高いほど伸びにくい）`, D.x + 8, y2 + 66, 10, K.faint, 'left', D.w - 16);
    }
    const y3 = y2 + 90;
    box(c, D.x, y3, D.w, D.y + D.h - y3, U(g) && U(g).type !== 'pin' ? `芸の種類ごとの実力（「${U(g).name}」で）` : '芸の種類ごとの実力（ピンで）');
    KIND_ORDER.forEach((k, i) => {
      const col = i % 2, rr = Math.floor(i / 2);
      const x = D.x + 8 + col * 192, y = y3 + 22 + rr * 22;
      const p = safe(() => g.unitPower(k), 0);
      T(c, KINDS[k], x, y, 10, K.text, 'left', 56);
      bar(c, x + 58, y + 3, 100, p, 100, statCol(p));
      T(c, String(p), x + 182, y, 10, statCol(p), 'right');
    });
  },
  foot: () => 'ステータスは練習・授業・舞台で少しずつ伸びる（同じ練習の連続は効果が下がる）',
};

function unitActions(g) {
  const u = U(g);
  if (!u) return [];
  if (u.type === 'pin') {
    return [
      { header: true, label: 'ピンで活動中' },
      { key: 'board', label: '相方をさがす（ネット）', right: '▶' },
      { key: 'nsc', label: 'NSCで相方をさがす', right: '▶' },
      { key: 'rename', label: '芸名を決める', right: u.name },
    ];
  }
  return [
    { header: true, label: u.type === 'trio' ? 'トリオの活動' : 'コンビの活動' },
    { key: 'awase', label: 'ネタ合わせ（相方と）', right: '▶' },
    { key: 'rename', label: `${u.type === 'trio' ? 'トリオ' : 'コンビ'}名を変える`, right: u.named ? '' : '未定' },
    { key: 'roles', label: '役割を決める', right: u.members.map((m) => ROLES[m.role]).join('/') },
    { key: 'style', label: 'スタイル', right: STYLES[u.style] },
    { key: 'split', label: 'ギャラの分け方', right: { even: '折半', me: '自分が多め', them: '相方に多め' }[u.split] },
    u.type === 'combi' ? { key: 'add', label: 'メンバーを加える（トリオ）', right: '▶' } : { key: 'remove', label: 'メンバーを外す（コンビに）', right: '▶' },
    { key: 'board', label: '相方募集を見る', right: '▶' },
    { key: 'dissolve', label: '解散する', right: '', color: K.bad },
  ];
}
const TAB_UNIT = {
  id: 'unit', label: 'コンビ',
  rows: (ui) => unitActions(ui.g),
  draw(ui, c) {
    const g = ui.g;
    drawList(ui, c);
    const u = U(g);
    const D = DETAIL;
    if (!u) return;
    const yrs = yearsOf(g, u);
    box(c, D.x, D.y, D.w, D.h, u.type === 'pin' ? `ピン芸人「${u.name}」` : `${u.type === 'trio' ? 'トリオ' : 'コンビ'}「${u.name}」`, { right: u.amateur ? 'アマチュア' : 'プロ' });
    let y = D.y + 22;
    if (u.type === 'pin') {
      face(c, g.state.look, D.x + 10, y, 2);
      T(c, `芸歴${num(safe(() => g.geireki(), 0)) + (safe(() => g.owarai().career.debut, null) ? 1 : 0)}年目・舞台${num(safe(() => g.owarai().career.stages, 0))}回`, D.x + 82, y + 4, 12, K.text, 'left', 290);
      para(c, 'いまはピン（ひとり）で活動している。漫才は相方がいないとできない（漫談になる）。相方はネットの相方募集か、NSCの同期で見つけられる。ピン芸・落語・大喜利・ものまね・トークの大会には、コンビのままでもピンで出られる。', D.x + 82, y + 22, D.w - 92, 10, K.dim, 14, 6);
      return;
    }
    T(c, `結成 ${ymLabel(u.formed)}（大会の数え方で結成${yrs}年）・${STYLES[u.style]}・${SOURCES[u.source] || ''}`, D.x + 8, y, 10, K.dim, 'left', D.w - 16);
    y += 16;
    T(c, 'コンビ仲', D.x + 8, y, 12, K.text);
    bar(c, D.x + 70, y + 4, 200, u.harmony, 100, harmCol(u.harmony), 8);
    T(c, `${u.harmony}`, D.x + 278, y, 12, harmCol(u.harmony));
    if (u.quarrel) T(c, 'ケンカ中', D.x + D.w - 8, y, 12, K.bad, 'right');
    else if (u.paused) T(c, '活動休止中', D.x + D.w - 8, y, 12, K.warn, 'right');
    y += 20;
    const mw = Math.floor((D.w - 16) / u.members.length);
    u.members.forEach((m, i) => {
      const x = D.x + 8 + i * mw;
      R(c, x, y, mw - 6, 118, '#1a1320');
      face(c, m.look, x + 6, y + 6, 1.5);
      T(c, m.id === 'player' ? '自分' : m.short, x + 60, y + 6, 12, K.text, 'left', mw - 70);
      T(c, ROLES[m.role] || '', x + 60, y + 22, 10, m.role === 'tsukkomi' ? K.cyan : K.pink, 'left', mw - 70);
      const keys = ['neta', 'boke', 'tsukkomi', 'ma', 'act', 'voice'];
      keys.forEach((k, j) => {
        const yy = y + 46 + j * 12;
        T(c, STAT_SHORT[k], x + 6, yy, 8, K.dim, 'left', 40);
        bar(c, x + 48, yy + 2, mw - 84, m.stats[k], 100, statCol(m.stats[k]), 5);
        T(c, String(Math.round(m.stats[k])), x + mw - 12, yy, 8, K.dim, 'right');
      });
      if (m.id !== 'player') {
        const info = safe(() => g.memberInfo(m.id), null);
        const ct = safe(() => g.netStatus(m.id), null);
        if (info && info.candidate && ct && ct.asked && ct.asked.quirk && info.quirks.length) T(c, info.quirks.map((q) => QUIRKS[q].name).join('・'), x + 60, y + 34, 8, K.warn, 'left', mw - 70);
      }
    });
    y += 124;
    const o = O(g);
    const log = (o && o.unit && o.unit.log) || [];
    T(c, 'コンビ仲の動き', D.x + 8, y, 10, K.gold);
    y += 13;
    if (!log.length) T(c, 'まだない', D.x + 12, y, 10, K.faint);
    log.slice(0, 4).forEach((l, i) => T(c, `${l.day}日目　${l.why}　${l.d > 0 ? '+' : ''}${l.d}`, D.x + 12, y + i * 12, 10, l.d >= 0 ? K.good : K.bad, 'left', D.w - 24));
  },
  async act(ui, row) {
    const g = ui.g;
    if (!row) return;
    if (row.key === 'board') { ui.close(); await openBoard(g); return; }
    if (row.key === 'nsc') { await ui.info('NSCで相方をさがす', nscLines(g)); return; }
    if (row.key === 'rename') { await g.renameUnit(); return; }
    if (row.key === 'roles') { await g.setUnitRoles(); return; }
    if (row.key === 'style') { await g.setUnitStyle(); return; }
    if (row.key === 'awase') { await g.owaraiPractice('awase'); return; }
    if (row.key === 'split') {
      const k = await ui.pick({ title: 'ギャラの分け方', lines: ['毎週月曜に、その週のお笑いの仕事のギャラを精算する。', '多めにとれば手元は増えるが、コンビ仲が下がる。'], items: [{ label: '折半', sub: 'いちばん揉めにくい' }, { label: '自分が多め（+2割）', sub: 'コンビ仲 −4／週' }, { label: '相方に多め（−2割）', sub: 'コンビ仲 +4／週' }] });
      if (k >= 0) g.setUnitSplit(['even', 'me', 'them'][k]);
      return;
    }
    if (row.key === 'dissolve') { ui.close(); await g.dissolveUnit(); return; }
    if (row.key === 'remove') {
      const u = U(g);
      const ms = u.members.filter((m) => m.id !== 'player');
      const k = await ui.pick({ title: 'だれに抜けてもらう？', items: ms.map((m) => ({ label: m.name, sub: ROLES[m.role] })) });
      if (k >= 0) await g.removeUnitMember(ms[k].id);
      return;
    }
    if (row.key === 'add') {
      const list = knownCandidates(g);
      if (!list.length) { await ui.info('メンバーを加える', ['いっしょにやれそうな知り合いがいない。', '相方募集で会った人、NSCの同期、仲良し（♥♥）の芸人仲間から選べる。']); return; }
      const k = await ui.pick({ title: 'だれを加える？', items: list.map((x) => ({ label: x.name, sub: x.sub })) });
      if (k >= 0) await g.addUnitMember(list[k].id);
    }
  },
  foot: () => '結成した年が「結成◯年目」の基準。解散して組みなおすと、新しい結成日になる',
};
function knownCandidates(g) {
  const u = U(g);
  const ids = new Set((u ? u.members : []).map((m) => m.id));
  const out = [];
  for (const [id, P] of Object.entries(PEOPLE)) {
    if (ids.has(id) || !P.canPartner || !g.met(id)) continue;
    const c = CANDIDATES[id];
    const ct = safe(() => g.netStatus(id), null);
    const ok = c ? !!(ct && ct.met) || (c.nsc && safe(() => g.nsc().campus === c.nsc, false)) : g.heartLevel(id) >= 2;
    if (ok) out.push({ id, name: P.name, sub: c ? `${STYLES[c.style]}・${ROLES[c.role]}志望` : '芸人仲間' });
  }
  return out;
}
function nscLines(g) {
  const s = safe(() => g.nsc(), null);
  if (!s) return ['NSCの情報がない'];
  const lines = ['NSC（吉本総合芸能学院）は、吉本興業の養成所。1年制・4月入学。大阪校は1982年、東京校は1995年に開校。', '4月の「相方探しの会」や、ネタ見せの授業で同期と組める。'];
  if (!s.open.tokyo) lines.push('いまは大阪校だけ（なんばにある）。');
  lines.push(s.status === 'enrolled' ? `いま：${s.campusName} ${s.ki}期生（出席率 ${Math.round(s.attendRate * 100)}%）` : s.status === 'applied' ? `${s.campusName}に出願ずみ（${s.year}年4月入学）` : s.status === 'graduated' ? `${s.campusName} ${s.ki}期 卒業` : '入学の手続きは、NSCの受付で。');
  return lines;
}

function careerRows(g) {
  const o = O(g);
  if (!o) return [];
  const c = o.career;
  const s = safe(() => g.nsc(), null);
  const tr = safe(() => g.theaterRank(), { name: '' });
  const out = [{ header: true, label: '芸歴と記録' }];
  out.push({ key: 'geireki', label: '芸歴', right: c.debut ? `${num(g.geireki()) + 1}年目` : 'まだ' });
  out.push({ key: 'stages', label: '舞台の数', right: `${c.stages}回` });
  out.push({ key: 'uke', label: 'ウケた／スベった', right: `${c.ukeru}／${c.suberu}` });
  out.push({ key: 'theater', label: '劇場ランク', right: tr.name });
  if (g.state.agency) out.push({ key: 'oshi', label: '事務所の推し度', right: `${Math.round(c.oshi)}` });
  out.push({ key: 'agency', label: '所属', right: g.state.agency ? (AGENCIES[g.state.agency] || {}).short || g.state.agency : 'フリー' });
  if (s && s.status !== 'none') out.push({ key: 'nsc', label: 'NSC', right: s.status === 'enrolled' ? `${s.ki}期・在学中` : s.status === 'graduated' ? `${s.ki}期・卒業` : s.status === 'applied' ? '出願ずみ' : s.status === 'expelled' ? '除籍' : '退学', rightColor: s.unpaid ? K.bad : null });
  if (o.past.length) { out.push({ header: true, label: '過去のコンビ' }); o.past.forEach((p, i) => out.push({ key: 'past', i, label: p.name, right: `${p.formed && p.formed.year ? p.formed.year : '?'}〜${p.dissolved ? p.dissolved.year : ''}` })); }
  out.push({ header: true, label: 'できごと' });
  out.push({ key: 'log', label: '最近のできごと', right: `${c.log.length}件` });
  return out;
}
const TAB_CAREER = {
  id: 'career', label: '芸歴・記録',
  rows: (ui) => careerRows(ui.g),
  draw(ui, c) {
    const g = ui.g;
    drawList(ui, c);
    const o = O(g);
    const row = ui.curRow();
    const D = DETAIL;
    box(c, D.x, D.y, D.w, D.h, row ? row.label : '');
    if (!o || !row) return;
    const cr = o.career;
    const x = D.x + 8, w = D.w - 16;
    let y = D.y + 22;
    const P = (s, col = K.text, size = 12) => { y += para(c, s, x, y, w, size, col, size + 4, 8) + 2; };
    if (row.key === 'geireki') {
      P(cr.debut ? `デビュー：${ymLabel(cr.debut)}（${{ nsc: 'NSC卒業', agency: '事務所に所属', stage: '初舞台', seed: '' }[cr.debut.how] || ''}）` : 'まだデビューしていない（初舞台・事務所への所属・NSC卒業のどれかで芸歴が始まる）');
      P(`芸歴 ${num(g.geireki())}年（デビューの年を0として、暦の年で数える。「芸歴◯年目」は+1）`, K.dim, 10);
      P(`年齢 ${g.playerAge()}歳`, K.dim, 10);
      const u = U(g);
      if (u && u.type !== 'pin') P(`「${u.name}」結成 ${ymLabel(u.formed)} → 結成${yearsOf(g, u)}年（大会の「結成◯年以内」はこの数で見る）`, K.cyan, 10);
    } else if (row.key === 'stages' || row.key === 'uke') {
      P(`舞台 ${cr.stages}回（ウケた ${cr.ukeru}・スベった ${cr.suberu}・最高 ${cr.bestScore}点）`);
      for (const k of KIND_ORDER) { const b = cr.byKind[k]; if (b && b.stages) P(`・${KINDS[k]}：${b.stages}回（最高${num(b.best)}点）`, K.dim, 10); }
      P('「60点以上」をウケた、「40点未満」をスベったとして数える。', K.faint, 10);
    } else if (row.key === 'theater') {
      THEATER_RANKS.forEach((t, i) => P(`${i === cr.theater ? '▶' : '　'}${t.name}：${t.desc}`, i === cr.theater ? K.gold : i < cr.theater ? K.dim : K.faint, 10));
      P(g.state.agency ? '毎週月曜、直近2週間の出番の平均点で昇格・降格（上のランクは推し度も必要）。' : '事務所に所属すると、事務所ライブ→若手劇場…と上がっていける。', K.dim, 10);
    } else if (row.key === 'oshi') {
      P(`事務所の推し度 ${Math.round(cr.oshi)}／100`);
      P('いい出番・大会の結果で上がる。出番がないと少しずつ下がる。劇場ランクの上のほうへ上がるのに必要。', K.dim, 10);
    } else if (row.key === 'agency') {
      P(g.state.agency ? `${(AGENCIES[g.state.agency] || {}).name}所属＝プロ。` : 'フリー＝アマチュア。大会にはアマチュア枠で出る。');
      P('NSCを卒業して所属審査に通るか、事務所のオーディションに合格すると所属できる。', K.dim, 10);
    } else if (row.key === 'nsc') {
      for (const l of nscLines(g)) P(l, K.text, 10);
      const s = g.nsc();
      if (s.status === 'enrolled') P(`ネタ見せ ${s.netamiCount}回・平均${s.netamiAvg}点・最高${s.netamiBest}点`, K.dim, 10);
      if (s.unpaid) P(`学費の未納 ${fmtMoney(s.unpaid)}（A：払う）`, K.bad, 12);
      if (s.grad) P(`卒業公演 ${s.grad.show ?? '—'}点・成績 ${s.grad.score}点・所属審査：${{ passed: '合格', failed: '不合格', skipped: '受けていない' }[s.grad.shinsa] || '—'}`, K.cyan, 10);
    } else if (row.key === 'past') {
      const p = o.past[row.i];
      if (p) {
        P(`${p.type === 'trio' ? 'トリオ' : 'コンビ'}「${p.name}」`);
        P(`メンバー：${p.members.map((m) => (m.id === 'player' ? '自分' : personName(m.id)) + `（${ROLES[m.role] || ''}）`).join('・')}`, K.dim, 10);
        P(`結成 ${ymLabel(p.formed)} → 解散 ${ymLabel(p.dissolved)}（${{ talk: '話し合い', quarrel: '不仲', reform: '組みかえ', external: '活動停止' }[p.why] || ''}）・舞台${num(p.stages)}回`, K.dim, 10);
      }
    } else if (row.key === 'log') {
      if (!cr.log.length) P('まだない', K.faint, 10);
      for (const l of cr.log.slice(0, 14)) P(`${l.day}日目　${l.text}`, K.text, 10);
    }
  },
  async act(ui, row) {
    const g = ui.g;
    if (row && row.key === 'nsc') {
      const s = g.nsc();
      if (s.unpaid) { const k = await ui.confirm({ title: '学費を払う', lines: [`未納 ${fmtMoney(s.unpaid)}。いま払える分を払う？（所持金 ${fmtMoney(g.state.money)}）`], choices: ['払う', 'やめておく'] }); if (k === 0) { const p = g.nscPay(); ui.toast(p ? `${fmtMoney(p)} 払った` : 'お金が足りない'); } }
    }
  },
  foot: () => '芸歴＝デビュー（初舞台・所属・NSC卒業）からの年数',
};

const TARGETS = [40, 55, 70, 85];
const TAB_SHORT = {
  id: 'short', label: '実力不足',
  rows(ui) {
    const g = ui.g;
    const out = [{ header: true, label: `芸の種類（Aで目標 ${TARGETS[ui.target || 0]}を切りかえ）` }];
    for (const k of KIND_ORDER) { const p = safe(() => g.unitPower(k), 0); out.push({ key: k, label: KINDS[k], right: String(p), rightColor: statCol(p) }); }
    return out;
  },
  draw(ui, c) {
    const g = ui.g;
    drawList(ui, c);
    const row = ui.curRow();
    const D = DETAIL;
    const need = TARGETS[ui.target || 0];
    box(c, D.x, D.y, D.w, D.h, row ? `${KINDS[row.key]}：目標${need}に対して` : '', { right: 'A：目標を変える' });
    if (!row) return;
    const sf = safe(() => g.shortfall(row.key, need), null);
    if (!sf) return;
    const p = safe(() => g.unitPower(row.key), 0);
    let y = D.y + 22;
    T(c, `いまの実力 ${p}／目標 ${need}`, D.x + 8, y, 12, p >= need ? K.good : K.warn);
    bar(c, D.x + 190, y + 4, 180, p, 100, statCol(p), 8);
    R(c, D.x + 190 + (180 * need) / 100, y, 1, 16, K.text);
    y += 22;
    if (!sf.gaps.length) { para(c, sf.ok ? 'この目標なら、いまの力で十分に戦える。あとは本番の出来しだい。' : '目立った穴はない。場数とネタの質で、あと一歩。', D.x + 8, y, D.w - 16, 12, K.good, 16, 4); return; }
    for (const gp of sf.gaps.slice(0, 7)) {
      if (y > D.y + D.h - 34) break;
      T(c, gp.label, D.x + 8, y, 12, K.text, 'left', 96);
      if (['partner', 'young', 'exp'].includes(gp.key)) T(c, gp.key === 'partner' ? '相方なし' : gp.key === 'exp' ? `${gp.have}回（めやす${gp.need}回）` : `結成${gp.have}年`, D.x + 110, y, 10, K.bad, 'left', 200);
      else { bar(c, D.x + 110, y + 4, 120, gp.have, 100, statCol(gp.have)); R(c, D.x + 110 + (120 * Math.min(100, gp.need)) / 100, y + 1, 1, 12, K.text); T(c, `${gp.have}→${gp.need}`, D.x + 236, y, 10, K.dim, 'left', 60); }
      y += 14;
      const rs = String(gp.reason || '');
      const ci = rs.indexOf('：');
      y += para(c, ci > 0 && rs.slice(0, ci) === gp.label ? rs.slice(ci + 1) : rs, D.x + 16, y, D.w - 24, 10, K.warn, 13, 2);
      if (gp.hint) { T(c, `→ ${gp.hint}`, D.x + 16, y, 10, K.good, 'left', D.w - 24); y += 14; }
      y += 3;
    }
  },
  act(ui) { ui.target = ((ui.target || 0) + 1) % TARGETS.length; ui.dirty(); },
  foot: () => '実力不足：何が足りないかを、本番で起きることの言葉で',
};

function goalsOf(g) {
  const st = g.state;
  const o = O(g);
  if (!o) return [];
  const out = [];
  const u = U(g);
  const s = safe(() => g.nsc(), null);
  if (!o.career.debut) out.push({ label: '初舞台に立つ', sub: '貸し稽古場のフリーライブ・NSC卒業・事務所に所属', done: false });
  if (!u || u.type === 'pin') out.push({ label: '相方を見つける（ピンでも続けられる）', sub: '「相方募集」アプリ／NSCの同期' });
  if (s && s.status === 'none' && (s.open.osaka || s.open.tokyo)) out.push({ label: 'NSCに入る（4月入学・1年）', sub: s.open.tokyo ? '大阪校（なんば）・東京校' : '大阪校（なんば）。東京校は1995年開校' });
  if (s && s.status === 'enrolled') out.push({ label: `NSCを卒業する（${s.year + 1}年3月の卒業公演）`, sub: `出席率 ${Math.round(s.attendRate * 100)}%・ネタ見せ平均 ${s.netamiAvg}点` });
  if (!st.agency) out.push({ label: 'プロになる（事務所に所属）', sub: 'NSCの所属審査・事務所のオーディション' });
  else { const tr = g.theaterRank(); const nx = THEATER_RANKS[tr.index + 1]; if (nx) out.push({ label: `劇場ランク「${nx.name}」へ`, sub: '出番の平均点と推し度' }); }
  // the weakest stat of the act's main kind
  const kind = u && u.type !== 'pin' ? (u.style === 'conte' ? 'conte' : 'manzai') : 'pin';
  const sf = safe(() => g.shortfall(kind, 50), null);
  if (sf && sf.gaps.length) out.push({ label: `${KINDS[kind]}の弱点：${sf.gaps[0].label}`, sub: sf.gaps[0].hint || '' });
  // contests (the 賞レース framework, when it has them)
  if (has(g, 'contests')) {
    const list = safe(() => g.contests(), []) || [];
    const mine = list.filter((x) => x && x.def && (x.def.kind === kind || x.def.kind === 'any' || (kind !== 'pin' && x.def.kind === 'double'))).slice(0, 4);
    for (const x of mine) {
      const el = x.def.eligibility && typeof x.def.eligibility === 'object' ? x.def.eligibility : null;
      out.push({ label: `${x.def.short || x.def.name}`, sub: [el && el.note, x.status === 'notyet' ? 'まだ始まっていない' : x.status === 'revival' ? '復刻開催' : ''].filter(Boolean).join('・') || '賞レース' });
    }
  }
  if (u && u.type !== 'pin') out.push({ label: `「${u.name}」結成${yearsOf(g, u)}年`, sub: `コンビ仲 ${u.harmony}・舞台 ${u.stages}回` });
  return out;
}
const TAB_GOALS = {
  id: 'goals', label: '目標',
  rows: (ui) => [{ header: true, label: 'つぎの目標' }, ...goalsOf(ui.g).map((x, i) => ({ key: 'g' + i, label: x.label, sub: x.sub, right: x.done ? '✓' : '' }))],
  draw(ui, c) {
    drawList(ui, c);
    const row = ui.curRow();
    const D = DETAIL;
    box(c, D.x, D.y, D.w, D.h, row ? row.label : '目標');
    if (row) para(c, row.sub || '', D.x + 8, D.y + 22, D.w - 16, 12, K.text, 16, 10);
    const g = ui.g;
    const y = D.y + 120;
    T(c, '賞レースの「結成◯年」「芸歴◯年」は、手帳の年数で判定される', D.x + 8, y, 10, K.faint, 'left', D.w - 16);
    const u = U(g);
    T(c, `結成${u && u.type !== 'pin' ? yearsOf(g, u) : '—'}年・芸歴${num(safe(() => g.geireki(), 0))}年・${g.playerAge()}歳・${g.state.agency ? 'プロ' : 'アマチュア'}`, D.x + 8, y + 16, 12, K.cyan, 'left', D.w - 16);
    if (has(g, 'openContests')) T(c, 'A：賞レースの画面を開く', D.x + 8, y + 40, 10, K.dim, 'left', D.w - 16);
  },
  async act(ui) { const g = ui.g; if (has(g, 'openContests')) { ui.close(); await g.openContests(); } },
  foot: () => '目標はいまの状況から自動で並ぶ',
};

const TAB_PRACTICE = {
  id: 'practice', label: '練習',
  rows(ui) {
    const g = ui.g;
    const out = [{ header: true, label: 'ここでできる練習（↑↓選ぶ・A実行）' }];
    for (const p of safe(() => g.practiceList(), []) || []) out.push({ key: p.id, label: p.label, p, right: p.why ? '—' : `体力${p.stamina}${p.count ? `・×${p.mult}` : ''}`, lock: p.why, rightColor: p.why ? K.faint : K.good });
    const s = safe(() => g.nsc(), null);
    if (s && s.status === 'enrolled') out.push({ key: 'nsc', label: `NSCの授業：${s.classToday ? s.classToday.label : '休講'}`, right: s.attendedToday ? '出席ずみ' : s.classToday ? 'NSCで' : '日曜', lock: !s.classToday || s.attendedToday ? '今日の授業はない' : null });
    out.push({ key: 'live', label: '劇場の出番（ライブ）', right: g.state.agency ? '事務所ライブ' : 'フリーライブ' });
    return out;
  },
  draw(ui, c) {
    const g = ui.g;
    drawList(ui, c);
    const row = ui.curRow();
    const D = DETAIL;
    box(c, D.x, D.y, D.w, D.h, row ? row.label : '');
    if (!row) return;
    let y = D.y + 22;
    if (row.p) {
      const p = row.p;
      T(c, `体力 -${p.stamina}・ストレス ${p.stress > 0 ? '+' : ''}${p.stress}${p.price ? `・${fmtMoney(p.price)}（所属芸人は関係者として無料）` : ''}`, D.x + 8, y, 12, K.text, 'left', D.w - 16); y += 18;
      T(c, `伸びる：${p.gains.join('・')}`, D.x + 8, y, 12, K.good, 'left', D.w - 16); y += 18;
      if (p.count) { T(c, `今日${p.count}回目 → 効果 ×${p.mult}（同じ練習は、くり返すほど身につきにくい）`, D.x + 8, y, 10, K.warn, 'left', D.w - 16); y += 16; }
      if (p.why) para(c, `いまはできない：${p.why}`, D.x + 8, y, D.w - 16, 12, K.lock, 16, 3);
    } else if (row.key === 'live') {
      para(c, g.state.agency ? '事務所ライブ・劇場の出番。結果は劇場ランクと推し度にひびく。1日1回。' : '貸し稽古場「ドットスタジオ」のフリーライブ（エントリー料あり）。アマチュアでも出られる。1日1回。\n貸し稽古場（東京）で受け付けている。', D.x + 8, y, D.w - 16, 12, K.text, 16, 6);
    } else if (row.key === 'nsc') {
      for (const l of nscLines(g)) y += para(c, l, D.x + 8, y, D.w - 16, 10, K.text, 14, 3);
    }
  },
  async act(ui, row) {
    const g = ui.g;
    if (!row) return;
    if (row.p) { if (row.p.why) { await ui.info(row.label, [row.p.why]); return; } await g.owaraiPractice(row.key); return; }
    if (row.key === 'live') {
      const id = g.map && g.map.placeId;
      const ok = id === 'keikoba' || (g.state.agency && ['yoshimoto', 'shinkigeki', 'shochiku', 'grape'].includes(id));
      if (!ok) { await ui.info('ライブ', [g.state.agency ? '事務所（劇場）か、貸し稽古場で出られる。' : '貸し稽古場「ドットスタジオ」（東京）で出られる。']); return; }
      await g.owaraiLive();
      return;
    }
    if (row.key === 'nsc') await ui.info('NSCの授業', ['授業はNSCの教室・ネタ見せ教室で受けられる。']);
  },
  foot: () => '練習は体力とストレスを使う。休むのも芸のうち',
};

const NOTE_TABS = [TAB_STATS, TAB_UNIT, TAB_CAREER, TAB_SHORT, TAB_GOALS, TAB_PRACTICE];
const NOTE_CFG = {
  id: 'note', title: '芸人手帳', tabs: NOTE_TABS,
  sub: (g) => { const u = U(g); const d = dateOf(g); return `${d.year}年${d.month}月　${u ? (u.type === 'pin' ? `ピン「${u.name}」` : `「${u.name}」結成${yearsOf(g, u)}年`) : ''}`; },
};
export function openNote(g, tab) { return openScreen(g, { ...NOTE_CFG, tabs: NOTE_TABS.slice() }, { tab }); }

// ================================================================ 相方募集 (the era's boards)
const BOARD_THEME = {
  magazine: { bg: '#efe4c8', ink: '#2a2018', accent: '#c0392b', panel: '#fbf4e2', font: K.ink },
  bbs: { bg: '#020a04', ink: '#5cff7a', accent: '#5cff7a', panel: '#041408' },
  web: { bg: '#c0c0c0', ink: '#000000', accent: '#0000cc', panel: '#ffffff' },
  keitai: { bg: '#0a1a40', ink: '#ffffff', accent: '#ffcc33', panel: '#14285a' },
  blog: { bg: '#fdf6f0', ink: '#3a2a2a', accent: '#e06a8a', panel: '#ffffff' },
  sns: { bg: '#15202b', ink: '#e7e9ea', accent: '#4aa8f0', panel: '#1e2a36' },
  app: { bg: '#fff0f4', ink: '#3a2030', accent: '#ff4f86', panel: '#ffffff' },
};
const STATUS_COL = { sent: K.warn, replied: K.good, met: K.cyan, declined: K.faint, refused: K.bad, formed: K.gold, ex: K.lock };
function boardTabs(g) {
  const boards = safe(() => g.owaraiBoards(), []) || [];
  const tabs = boards.map((b) => ({ id: b.id, label: b.short, board: b, rows: (ui) => boardRows(ui.g, b.id), draw: (ui, c) => drawBoard(ui, c, b), act: (ui, row) => candAct(ui, row), foot: () => b.desc }));
  tabs.push({ id: 'contacts', label: 'やりとり', rows: (ui) => contactRows(ui.g), draw: (ui, c) => drawContact(ui, c), act: (ui, row) => candAct(ui, row), alert: (ui) => contactRows(ui.g).some((r) => r.c && r.c.status === 'replied'), foot: () => '返事が来た人とは、会って話せる（ネタ合わせのおためしも）' });
  tabs.push({ id: 'post', label: '自分の募集', rows: (ui) => postRows(ui.g), draw: (ui, c) => drawPost(ui, c), act: (ui, row) => postAct(ui, row), foot: () => '募集を出すと、何日かあとに返事が届く' });
  return tabs;
}
function boardRows(g, b) {
  const list = (safe(() => g.owaraiCandidates('net'), []) || []).filter((x) => x.board === b);
  return [{ header: true, label: `${BOARDS[b].name}` }, ...list.map((x) => ({ key: x.id, c: x, label: x.handle, right: x.statusLabel || STYLES[x.style].replace('中心', ''), rightColor: STATUS_COL[x.status] || K.dim }))];
}
function contactRows(g) {
  const list = (safe(() => g.owaraiCandidates('net'), []) || []).filter((x) => x.status !== 'none');
  const order = { replied: 0, met: 1, sent: 2, formed: 3, ex: 4, refused: 5, declined: 6 };
  list.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  return [{ header: true, label: 'やりとり中の人' }, ...list.map((x) => ({ key: x.id, c: x, label: x.met ? x.name : x.handle, right: x.statusLabel, rightColor: STATUS_COL[x.status] || K.dim }))];
}
function drawCard(ui, c, x0, y0, w, h, cand, theme) {
  const g = ui.g;
  const th = BOARD_THEME[theme] || BOARD_THEME.sns;
  R(c, x0, y0, w, h, th.bg);
  R(c, x0, y0, w, 1, th.accent); R(c, x0, y0 + h - 1, w, 1, th.accent);
  let y = y0 + 8;
  const ink = th.ink;
  const B = BOARDS[cand.board] || {};
  if (theme === 'magazine') {
    T(c, '【相方募集】', x0 + 10, y, 14, th.accent); y += 20;
    y += para(c, cand.post, x0 + 10, y, w - 20, 12, ink, 17, 5) + 6;
    T(c, `（${cand.pref ? '' : ''}${cand.age}歳・ペンネーム「${cand.handle}」）`, x0 + w - 10, y, 10, ink, 'right', w - 20); y += 18;
  } else if (theme === 'bbs' || theme === 'web') {
    T(c, theme === 'bbs' ? `#${String(140 + (cand.id.length * 7) % 80).padStart(4, '0')}  ${cand.handle}` : `■ 投稿者：${cand.handle}`, x0 + 10, y, 12, th.accent, 'left', w - 20); y += 18;
    y += para(c, cand.post, x0 + 10, y, w - 20, 12, ink, 16, 5) + 6;
    T(c, theme === 'bbs' ? '--- 返信はメールで ---' : `[返信] [${B.contact || 'メール'}]`, x0 + 10, y, 10, theme === 'bbs' ? ink : '#0000cc', 'left', w - 20); y += 16;
  } else {
    if (cand.photo) { R(c, x0 + 10, y, 44, 36, '#d8d8e0'); face(c, cand.look, x0 + 16, y + 6, 1); }
    const tx = x0 + (cand.photo ? 62 : 10);
    T(c, cand.handle, tx, y, 12, th.accent, 'left', w - (tx - x0) - 10);
    T(c, `${cand.age}歳・${STYLES[cand.style]}・${ROLES[cand.role]}志望`, tx, y + 16, 10, ink, 'left', w - (tx - x0) - 10);
    y += 44;
    y += para(c, cand.post, x0 + 10, y, w - 20, 12, ink, 16, 5) + 6;
    if (theme === 'app') T(c, '♡ いいね！で連絡', x0 + 10, y, 10, th.accent);
    if (theme === 'sns') T(c, '↩ 返信　⇄ 拡散　♡', x0 + 10, y, 10, '#8899a6');
    y += 16;
  }
  return y;
}
function drawBoard(ui, c, b) {
  drawList(ui, c);
  const row = ui.curRow();
  const D = DETAIL;
  if (!row || !row.c) { box(c, D.x, D.y, D.w, D.h, b.name); para(c, b.desc, D.x + 8, D.y + 22, D.w - 16, 12, K.text, 16, 6); return; }
  const y = drawCard(ui, c, D.x, D.y, D.w, 172, row.c, b.kind);
  drawKnown(ui, c, row.c, D.y + 176);
  void y;
}
function drawKnown(ui, c, x, y0) {
  const D = DETAIL;
  box(c, D.x, y0, D.w, D.y + D.h - y0, x.met ? `${x.name}（会って分かったこと）` : 'まだ会っていない', { right: x.statusLabel });
  let y = y0 + 20;
  const L = (s, col = K.text) => { T(c, s, D.x + 8, y, 10, col, 'left', D.w - 16); y += 13; };
  if (!x.met) { L('顔・人柄・相性は、会ってみるまでわからない。', K.dim); if (x.status === 'sent') L('返事を待っている…', K.warn); if (x.status === 'replied') L('返事が来た！ A：会いに行く', K.good); return; }
  if (x.asked && x.asked.style) L(`やりたい笑い：${STYLES[x.style]}・${ROLES[x.role]}`);
  if (x.motive) L(`理由：${x.motive}`);
  if (x.persona) L(`性格：${x.persona}`);
  if (x.quirks && x.quirks.length) L(`クセ：${x.quirks.join('・')}`, K.warn);
  if (x.trial != null) L(`おためしネタ合わせ：${x.feel}（${x.trial}）`, x.trial >= 55 ? K.good : K.warn);
  if (x.status === 'refused') L('ことわられた（実力をつけて、日をおいてから）', K.bad);
}
function drawContact(ui, c) {
  drawList(ui, c);
  const row = ui.curRow();
  const D = DETAIL;
  if (!row || !row.c) { box(c, D.x, D.y, D.w, D.h, 'やりとり'); para(c, 'まだだれにも連絡していない。掲示板の投稿から連絡するか、自分の募集を出そう。', D.x + 8, D.y + 22, D.w - 16, 12, K.dim, 16, 4); return; }
  const B = BOARDS[row.c.board];
  drawCard(ui, c, D.x, D.y, D.w, 172, row.c, B ? B.kind : 'sns');
  drawKnown(ui, c, row.c, D.y + 176);
}
async function candAct(ui, row) {
  const g = ui.g;
  if (!row || !row.c) return;
  const x = row.c;
  const B = BOARDS[x.board] || {};
  if (x.status === 'formed') { await ui.info(x.name, ['あなたの相方。']); return; }
  if (x.status === 'sent') { await ui.info(x.handle, ['返事を待っている。', `（${B.via || 'メール'}の返事は、ふつう${B.reply ? `${B.reply[0]}〜${B.reply[1]}日` : '数日'}で来る）`]); return; }
  const items = [];
  if (x.canMeet) items.push({ label: `会いに行く（${MEET_SPOTS[B.meet] ? MEET_SPOTS[B.meet].name : 'お店'}）`, sub: `${MEET_SPOTS[B.meet] ? fmtMoney(MEET_SPOTS[B.meet].price) : ''}・体力4`, id: 'meet' });
  if (x.met && x.trial != null && (x.status === 'met' || x.status === 'ex')) items.push({ label: 'コンビを組もうと伝える', sub: x.feel || '', id: 'propose' });
  if (x.canContact) items.push({ label: B.contact || '連絡する', sub: B.via ? `${B.via}で` : '', id: 'contact' });
  items.push({ label: 'もどる', id: 'back' });
  const k = await ui.pick({ title: x.met ? x.name : x.handle, items: items.map((i) => ({ label: i.label, sub: i.sub })) });
  const it = items[k];
  if (!it || it.id === 'back') return;
  if (it.id === 'contact') { g.netContact(x.id); sfx('ok'); ui.toast(`${x.handle}に連絡した。返事を待とう`); if (ui.isBoardSkin) NUI.fxContact(ui, x); return; } // [R9-C] + the contact effect
  if (it.id === 'meet') { ui.close(); await g.netMeet(x.id); return; }
  if (it.id === 'propose') { ui.close(); await g.owaraiPropose(x.id); }
}
function postRows(g) {
  const o = O(g);
  const p = o && o.net && o.net.post;
  const out = [{ header: true, label: '自分の相方募集' }, { key: 'new', label: p && !p.done ? '募集を出しなおす' : '募集を出す', right: '▶' }];
  if (p) out.push({ key: 'cur', label: `「${p.text}」`, right: p.done ? '締切' : '募集中' });
  return out;
}
function drawPost(ui, c) {
  const g = ui.g;
  drawList(ui, c);
  const D = DETAIL;
  const o = O(g);
  const p = o && o.net && o.net.post;
  box(c, D.x, D.y, D.w, D.h, '自分の募集');
  let y = D.y + 22;
  if (!p) { para(c, '募集を出すと、条件に合いそうな人から返事が来る。雑誌は掲載まで時間がかかり、ネットやアプリは早い。', D.x + 8, y, D.w - 16, 12, K.text, 16, 6); return; }
  const B = BOARDS[p.board] || {};
  y += para(c, `掲載先：${B.name || ''}`, D.x + 8, y, D.w - 16, 12, K.text, 16, 2);
  y += para(c, `「${p.text}」`, D.x + 8, y, D.w - 16, 12, K.gold, 16, 3);
  T(c, `さがしている相方：${p.style ? STYLES[p.style] : 'どちらでも'}・${p.role ? ROLES[p.role] : '役割は問わない'}`, D.x + 8, y + 4, 10, K.dim, 'left', D.w - 16);
  T(c, p.done ? '返事はもう来た（やりとりのタブへ）' : `返事は${Math.max(0, num(p.replyDay) - g.state.day)}日後くらい`, D.x + 8, y + 20, 10, p.done ? K.good : K.warn, 'left', D.w - 16);
}
async function postAct(ui, row) {
  const g = ui.g;
  if (row && row.key === 'new') await g.netPost();
}
const BOARD_CFG = {
  id: 'board', title: (g) => ({ techo: '相方募集（手帳）', keitai: '相方募集', smart: '相方募集' }[dev(g)] || '相方募集'), tabs: [], tabsFn: (g) => boardTabs(g),
  sub: (g) => { const d = dateOf(g); return `${d.year}年${d.month}月　${(safe(() => g.owaraiBoards(), []) || []).map((b) => b.short).join('・')}`; },
};
// [R9-C] the board screen: OwScreen with the skin of owarai_net_ui.js (each era's medium; drawing, taps, 70-unit touch
// targets, themed modals, the contact / match effects). Rows, tabs and acts (candAct / postAct) are the ones above.
class BoardScreen extends OwScreen {
  constructor(g, cfg, opts, resolve) { super(g, cfg, opts, resolve); this.isBoardSkin = true; NUI.boardInit(this); }
  update(g) { if (NUI.boardPre(this, g)) return; super.update(g); NUI.boardPost(this, g); }
  handleTap(tap, inp) { return NUI.boardTap(this, tap, inp); }
  setTab(i) { super.setTab(i); NUI.onTab(this); }
  draw(c, g) { this.touchLayout = isTouch(); NUI.drawBoard(this, c, g); }
  confirm(o) { if (this.g.auto) return Promise.resolve(o.auto ?? 0); return this.openModal(NUI.modal(this, { ...o, kind: 'confirm' })); }
  pick(o) { if (this.g.auto) return Promise.resolve(o.auto ?? 0); return this.openModal(NUI.modal(this, { ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { if (this.g.auto) return Promise.resolve(0); return this.openModal(NUI.modal(this, { title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
}
export function openBoard(g, tab) {
  if (!g || !g.state) return Promise.resolve(null);
  if (g.auto && !g.auto.owarai) return Promise.resolve(null);
  if (g.scenes.find((s) => s.isOwaraiUI && !s.closed && s.cfg.id === BOARD_CFG.id)) return Promise.resolve(null);
  sfx('ok');
  return new Promise((resolve) => g.push(new BoardScreen(g, { ...BOARD_CFG, tabs: boardTabs(g) }, { tab }, resolve)));
}

// ================================================================ g.* + phone apps
Game.prototype.owaraiScreen = function owaraiScreen(tab) { return openNote(this, tab); };
Game.prototype.owaraiBoard = function owaraiBoard(tab) { return openBoard(this, tab); };
function dev(g) { const e = eraKey(g); return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; }
const APP_COLOR = '#8a3a5a';
async function noteApp(g) {
  let index = 0;
  for (;;) {
    const u = U(g);
    const o = O(g);
    const items = [
      { id: 'screen', label: '手帳をひらく（全画面）', sub: 'ステータス・コンビ・実力不足・練習' },
      { id: 'stats', label: 'ステータス', sub: o ? STAT_KEYS.slice(0, 4).map((k) => `${STAT_SHORT[k]}${o.stats[k]}`).join(' ') : '' },
      { id: 'unit', label: u && u.type !== 'pin' ? `「${u.name}」` : 'ピンで活動中', sub: u && u.type !== 'pin' ? `結成${yearsOf(g, u)}年・コンビ仲${u.harmony}` : '相方募集・NSC' },
      { id: 'short', label: '実力不足', sub: '何が足りない？' },
      { id: 'nsc', label: 'NSC', sub: (safe(() => g.nsc(), {}) || {}).campusName || '吉本総合芸能学院' },
    ];
    const i = await phoneList(g, { title: '芸人手帳', color: APP_COLOR, index, items: items.map((x) => ({ label: x.label, sub: x.sub })) });
    if (i < 0) return;
    index = i;
    const id = items[i].id;
    if (id === 'screen') { if (g.auto && !g.auto.owarai) continue; await openNote(g); }
    else if (id === 'stats') await phoneInfo(g, { title: 'ステータス', color: APP_COLOR, lines: o ? STAT_KEYS.map((k) => `${COMEDY_STATS[k]}　${o.stats[k]}`) : [] });
    else if (id === 'unit') await phoneInfo(g, { title: u && u.type !== 'pin' ? u.name : 'ピン', color: APP_COLOR, lines: u && u.type !== 'pin' ? [`結成 ${ymLabel(u.formed)}（結成${yearsOf(g, u)}年）`, `${STYLES[u.style]}・${u.members.map((m) => memberLine(g, m)).join('・')}`, `コンビ仲 ${u.harmony}${u.quarrel ? '（ケンカ中）' : ''}`, `${u.amateur ? 'アマチュア' : 'プロ'}・舞台${u.stages}回`] : ['ピンで活動中。', '相方は「相方募集」か、NSCの同期で。'] });
    else if (id === 'short') {
      const kind = u && u.type !== 'pin' ? (u.style === 'conte' ? 'conte' : 'manzai') : 'pin';
      const sf = g.shortfall(kind, 55);
      await phoneInfo(g, { title: `実力不足（${KINDS[kind]}）`, color: APP_COLOR, lines: [`実力 ${g.unitPower(kind)}／目標55`, ...sf.gaps.slice(0, 5).map((x) => `・${x.reason}`)] });
    } else if (id === 'nsc') await phoneInfo(g, { title: 'NSC', color: APP_COLOR, lines: nscLines(g) });
  }
}
async function boardApp(g) {
  if (!(g.auto && !g.auto.owarai)) { await openBoard(g); return; }
  const list = safe(() => g.owaraiCandidates('net'), []) || [];
  await phoneList(g, { title: '相方募集', color: '#c0507a', items: list.map((x) => ({ label: x.handle, sub: x.statusLabel || STYLES[x.style] })) });
}
registerPhoneApp('geinin', {
  name: '芸人手帳', color: APP_COLOR, order: 34,
  iconHD(c, x, y) {
    appTile(c, x, y, '#6a2a44');
    R(c, x + 8, y + 6, 16, 20, '#c0392b'); R(c, x + 8, y + 6, 3, 20, '#8a2a20'); R(c, x + 13, y + 10, 8, 2, '#ffd23f'); R(c, x + 13, y + 14, 8, 1, '#ffe9a0'); R(c, x + 13, y + 17, 6, 1, '#ffe9a0');
    R(c, x + 22, y + 4, 2, 8, '#ffd23f');
  },
  badge: (g) => { const u = U(g); return u && u.quarrel ? 1 : 0; },
  open: (g) => noteApp(g),
});
registerPhoneApp('aikata', {
  name: (g) => (dev(g) === 'smart' ? 'アイカタ' : '相方募集'), color: '#c0507a', order: 35,
  iconHD(c, x, y) {
    appTile(c, x, y, '#c0507a');
    // two people and a heart
    R(c, x + 7, y + 9, 6, 6, '#ffe0c4'); R(c, x + 6, y + 16, 8, 9, '#ffd23f');
    R(c, x + 19, y + 9, 6, 6, '#ffe0c4'); R(c, x + 18, y + 16, 8, 9, '#5fd7ff');
    R(c, x + 14, y + 6, 4, 3, '#ffffff'); R(c, x + 15, y + 9, 2, 2, '#ffffff');
  },
  badge: (g) => (safe(() => g.owaraiCandidates('net'), []) || []).filter((x) => x.status === 'replied').length,
  open: (g) => boardApp(g),
});

if (typeof window !== 'undefined') window.__owui = { scene: () => sceneOf(window.__game), openNote, openBoard, NOTE_TABS };
