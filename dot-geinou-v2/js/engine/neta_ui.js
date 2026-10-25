// 台本作成とAI審査員の画面 (owner: B): HD screens (640x360) + the phone app 「ネタ帳」. Only g.* methods of neta.js are
// called back (no import of neta.js: it imports this file).
//
//   openEditor(g, draft, opts)  → Promise<Neta|null>   the script editor (台本エディタ)
//   openResult(g, neta, ai)     → Promise              the AI審査員's result (総評・審査員・行ごと・アドバイス)
//   openPicker(g, opts)         → Promise<Neta|null>   choose a script to perform (+ 新しく書く / おまかせ)
//   openSettings(g)             → Promise              AI審査員の設定 (ローカルAI / Claude with the player's API key)
//   openWaiting(g, run)         → Promise<result>      「審査中…」 while Claude reads (B: やめてローカルAIで)
//   installNetaApp()            registers the phone app 'neta' (all three devices)
// Keys: ↑↓ choose, A act, B back, ←→ tabs / toolbar / (editor list) change the speaker; MENU closes. Taps: rows (first tap
// selects, second acts), toolbar buttons, tabs, ×, modal rows / buttons. Under g.auto the screens do not open unless
// g.auto.netaui (tests); test hook: window.__netaui = { top(), EditorScene, ResultScene, PickerScene, SettingsScene }.

import { SW, SH, clamp } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { registerPhoneApp } from './life.js';
import { askText } from './textinput.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, withPhone } from './phone.js';
import { estimate, structureCheck, inferBeats, KINDS, AXES, AXES_BY_KIND, JUDGES, mmss, netaHash, rankLabel } from './neta_ai.js';
import { partsFor, topicsFor, buildAuto, BOKE_TYPES, ERA_YEAR, DEFAULT_LEN } from './neta_bank.js';
import { keyState, setKey, setRemember, clearKey, setMode, getMode, CLAUDE } from './neta_claude.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const inR = (x, y, r) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const short = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };

const K = {
  bg: '#120c18', head: '#1e1428', panel: '#1a1222', panel2: '#261a32', edge: '#4a3460', edgeHi: '#8a5ab8', text: '#f4eef8', dim: '#a898b8', faint: '#6a5a7a',
  gold: '#ffcf4a', red: '#ff5d6c', green: '#5ee07a', cyan: '#5fd7ff', sel: '#3a2652', pink: '#ff7eb6', warn: '#ffb547', ink: '#1a1206',
};
export const KIND_LABEL = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'エピソードトーク' };
export const ROLE_OPTS = {
  manzai: ['boke', 'tsukkomi', 'narr'], conte: ['a', 'b', 'c', 'narr'], pin: ['pin', 'narr'], rakugo: ['narr', 'a', 'b', 'c'], ogiri: ['pin'],
  utaneta: ['pin', 'narr'], monomane: ['pin', 'narr'], talk: ['pin', 'narr'],
};
const ROLE_SHORT = { boke: 'ボケ', tsukkomi: 'ツッコ', a: 'A', b: 'B', c: 'C', narr: 'ナレ', pin: '本人', sage: 'サゲ' };
const ROLE_LONG = { boke: 'ボケ', tsukkomi: 'ツッコミ', a: '人物A', b: '人物B', c: '人物C', narr: 'ナレ・ト書き', pin: '本人', sage: 'サゲ' };
const ROLE_COL = { boke: '#ff8a3d', tsukkomi: '#4fa8ff', a: '#e06a9a', b: '#4fb8a0', c: '#c0a040', narr: '#7a7a8e', pin: '#d6a33a', sage: '#c06030' };
export const BEAT_OPTS = {
  manzai: ['tsukami', 'setup', 'boke', 'tsukkomi', 'tenkai', 'tendon', 'fukusen', 'kaishu', 'ochi'],
  conte: ['setup', 'boke', 'tsukkomi', 'tenkai', 'uragiri', 'tendon', 'fukusen', 'kaishu', 'ochi'],
  pin: ['tsukami', 'setup', 'boke', 'tenkai', 'tendon', 'fukusen', 'kaishu', 'ochi'],
  rakugo: ['makura', 'hondai', 'boke', 'tenkai', 'fukusen', 'kaishu', 'sage'],
  ogiri: ['answer'],
  utaneta: ['tsukami', 'setup', 'boke', 'tendon', 'tenkai', 'ochi'],
  monomane: ['tsukami', 'setup', 'boke', 'tenkai', 'tendon', 'ochi'],
  talk: ['tsukami', 'setup', 'tenkai', 'boke', 'fukusen', 'kaishu', 'ochi'],
};
const BEAT_SHORT = { tsukami: 'ツカミ', setup: 'フリ', boke: 'ボケ', tsukkomi: 'ツッコ', tenkai: '展開', tendon: '天丼', fukusen: '伏線', kaishu: '回収', ochi: 'オチ', makura: 'まくら', hondai: '本題', sage: 'サゲ', answer: '回答', uragiri: '裏切り' };
const BEAT_LONG = { tsukami: 'ツカミ', setup: 'フリ・設定', boke: 'ボケ', tsukkomi: 'ツッコミ', tenkai: '展開', tendon: '天丼（くり返し）', fukusen: '伏線', kaishu: '伏線の回収', ochi: 'オチ', makura: 'まくら', hondai: '本題', sage: 'サゲ', answer: '回答', uragiri: '裏切り（展開）' };
const BEAT_COL = { tsukami: '#ffcf4a', setup: '#7a8aa8', boke: '#ff8a3d', tsukkomi: '#4fa8ff', tenkai: '#a070e0', tendon: '#ff7eb6', fukusen: '#40b0a8', kaishu: '#5fe0c8', ochi: '#ff5d6c', makura: '#a07850', hondai: '#8a8a9a', sage: '#d0603a', answer: '#ffcf4a', uragiri: '#c060ff' };
// Length presets. Verified (2026-10): M-1 — 1回戦 2分, 2回戦・3回戦 3分, 準々決勝・準決勝・決勝 4分 (2019年大会の規定;
// 敗者復活戦 4分, 第11〜14回は3分) [daily.co.jp 2020-07-02, compe.japandesign.ne.jp m-1gp-2019/2020]; キングオブコント —
// 1回戦・2回戦 2分, 準々決勝〜決勝 5分 (2020年大会, 4分→5分) [natalie.mu/owarai/award/king-of-conte/2020];
// R-1グランプリ — 決勝 3分 → 2024年大会から4分 [news.mynavi.jp 2024-03-08, natalie.mu/owarai/award/r-1gp/2024].
// The others are generic ("約") targets, not rules. Callers (contests) pass their own length anyway.
export const PRESETS = [
  { label: 'M-1 1回戦（2分）', sec: 120 }, { label: 'M-1 2回戦・3回戦（3分）', sec: 180 }, { label: 'M-1 準々決勝〜決勝（4分）', sec: 240 },
  { label: 'キングオブコント 1・2回戦（2分）', sec: 120 }, { label: 'キングオブコント 準々決勝〜決勝（5分）', sec: 300 },
  { label: 'R-1 決勝（2024年〜 4分）', sec: 240 }, { label: 'R-1 決勝（〜2023年 3分）', sec: 180 },
  { label: '劇場の出番（約5分）', sec: 300 }, { label: 'テレビのネタ番組（約3分）', sec: 180 }, { label: '落語の高座（約15分）', sec: 900 },
  { label: '大喜利（約2分）', sec: 120 }, { label: 'エピソードトーク（約2分）', sec: 120 },
];

// ------------------------------------------------------------------ text helpers (every string has a width)
function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
function T(c, s, x, y, size = 12, color = K.text, align = 'left', w = 0) { text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: null }); }
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％～〜'.split(''));
function jwrap(c, str, w, size = 12) {
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
function chip(c, x, y, label, col, w = 0, size = 10) {
  const ww = w || Math.ceil(measure(c, label, size)) + 8;
  R(c, x, y, ww, size + 4, col);
  T(c, label, x + ww / 2, y + 2, size, K.ink, 'center', ww - 2);
  return ww;
}
const scoreCol = (s) => (s >= 75 ? K.green : s >= 55 ? K.gold : s >= 35 ? K.warn : K.red);

// ------------------------------------------------------------------ taps + the base scene
let tapCanvas = null;
const topNeta = (g) => { const t = g && g.top; return t && t.isNetaUI && !t.closed ? t : null; };
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = topNeta(g);
    if (!sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
class Base {
  constructor(g, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isNetaUI: true, t: 0, modals: [], toasts: [], busy: 0, tapAt: null, closed: false });
    bindTap(g);
  }
  update(g) {
    this.t++;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < 140);
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    const m = this.modals[this.modals.length - 1];
    if (m) { if (tap) m.tap(this, tap, inp); m.update(this, inp); return; }
    if (this.busy > 0) return;
    if (tap && this.handleTap(tap, inp)) return;
    this.updateBody(inp);
  }
  handleTap() { return false; }
  updateBody() {}
  async act(fn) { this.busy++; try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); } }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { return this.openModal(modal({ ...o, kind: 'confirm' })); }
  pick(o) { return this.openModal(modal({ ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { return this.openModal(modal({ title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
  toast(s, color = K.gold) { this.toasts.unshift({ text: String(s), t: 0, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  close(v = null) {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.modals.splice(0)) m._res(m.kind === 'pick' ? -1 : null);
    this.g.pop(this);
    for (const s of this.g.scenes) if (s.isPhone) s.tapAt = null;
    this.resolve(v);
  }
  drawOver(c) {
    this.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, 12) + 20); R(c, (SW - w) / 2, 300 - i * 22, w, 20, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * 22, 12, t.color, 'center', w - 10); });
    for (const m of this.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)'); m.draw(this, c); }
  }
}
// A modal: confirm (title, lines, choices) or pick (title, lines?, items [{ label, sub, right, rightColor, lock }]).
function modal(o) {
  const m = {
    ...o, idx: o.index || 0, top: 0,
    get n() { return o.kind === 'pick' ? (o.items || []).length : (o.choices || ['OK']).length; },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.n;
      if (o.kind === 'pick') {
        if (n && inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
        if (n && inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
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
        if (o.kind === 'confirm' || m.idx === i) { m.idx = i; const it = o.items && o.items[i]; if (it && it.lock) { sfx('buzz'); return; } sfx('ok'); ui.closeModal(m, i); } else { m.idx = i; sfx('cursor'); }
        return;
      }
      if (!inR(tap.x, tap.y, m.box)) { sfx('cancel'); ui.closeModal(m, o.kind === 'pick' ? -1 : o.cancel != null ? o.cancel : m.n - 1); }
    },
    draw(ui, c) {
      const w = Math.min(SW - 40, o.w || 440);
      const x = Math.round((SW - w) / 2);
      const lines = [];
      for (const l of o.lines || []) lines.push(...jwrap(c, String(l ?? ''), w - 24, 12));
      const pick = o.kind === 'pick';
      const rh = o.rh || 26;
      const shownLines = lines.slice(0, pick ? 5 : 13);
      const maxRows = pick ? Math.min(m.n, Math.max(3, Math.floor((SH - 70 - shownLines.length * 16) / rh))) : 0;
      const h = 26 + shownLines.length * 16 + (pick ? maxRows * rh + 8 : 38) + 6;
      const y = Math.round((SH - h) / 2);
      m.box = { x, y, w, h };
      R(c, x, y, w, h, '#160f20');
      R(c, x, y, w, 2, o.danger ? K.red : o.color || K.gold);
      R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
      T(c, o.title || '', x + 12, y + 7, 12, o.danger ? K.red : o.color || K.gold, 'left', w - 70);
      shownLines.forEach((l, i) => T(c, l, x + 12, y + 26 + i * 16, 12, K.text, 'left', w - 24));
      m.rects = [];
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + maxRows) m.top = m.idx - maxRows + 1;
        const y0 = y + 28 + shownLines.length * 16;
        for (let k = 0; k < maxRows && m.top + k < m.n; k++) {
          const it = o.items[m.top + k];
          const yy = y0 + k * rh;
          const sel = m.top + k === m.idx;
          R(c, x + 8, yy, w - 16, rh - 2, sel ? K.sel : '#1e1529');
          if (sel) R(c, x + 8, yy, 2, rh - 2, K.gold);
          const rw = it.right ? measure(c, it.right, 10) + 12 : 0;
          if (rh >= 26) {
            T(c, it.label, x + 16, yy + 2, 12, it.lock ? K.faint : K.text, 'left', w - 36 - rw);
            if (it.sub) T(c, it.sub, x + 16, yy + 15, 10, it.lock ? K.faint : K.dim, 'left', w - 36);
          } else T(c, it.label, x + 16, yy + (rh - 14) / 2, 12, it.lock ? K.faint : K.text, 'left', w - 36 - rw);
          if (it.right) T(c, it.right, x + w - 14, yy + 3, 10, it.rightColor || K.dim, 'right');
          m.rects[m.top + k] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
        }
        if (m.n > maxRows) T(c, `${m.idx + 1}／${m.n}`, x + w - 12, y + 7, 10, K.dim, 'right');
      } else {
        const ch = o.choices || ['OK'];
        const bw = Math.min(170, Math.floor((w - 24 - (ch.length - 1) * 8) / ch.length));
        const total = ch.length * bw + (ch.length - 1) * 8;
        ch.forEach((label, i) => {
          const bx = x + Math.round((w - total) / 2) + i * (bw + 8), by = y + h - 34;
          const sel = i === m.idx;
          R(c, bx, by, bw, 26, sel ? (o.danger && i === (o.dangerIdx ?? 0) ? K.red : K.gold) : '#2a1e38');
          T(c, label, bx + bw / 2, by + 6, 12, sel ? K.ink : K.text, 'center', bw - 8);
          m.rects[i] = { x: bx, y: by, w: bw, h: 26 };
        });
      }
    },
  };
  return m;
}

// The parts picker (tabs of candidates; A adds and keeps it open; B closes)
function partsModal(o) {
  const m = {
    kind: 'parts', tab: o.tab || 0, idx: 0, top: 0, t: 0, ...o,
    items() { const tb = m.tabs[m.tab]; return tb ? tb.items : []; },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.items().length;
      if (inp.repeat('left')) { m.tab = (m.tab + m.tabs.length - 1) % m.tabs.length; m.idx = 0; m.top = 0; sfx('cursor'); return; }
      if (inp.repeat('right')) { m.tab = (m.tab + 1) % m.tabs.length; m.idx = 0; m.top = 0; sfx('cursor'); return; }
      if (n && inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (n && inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
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
      const x = 16, y = 16, w = SW - 32, h = SH - 32;
      m.box = { x, y, w, h };
      R(c, x, y, w, h, '#160f20');
      R(c, x, y, w, 2, K.gold); R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
      T(c, o.title || '部品から足す', x + 10, y + 6, 12, K.gold, 'left', 300);
      T(c, o.note || '', x + w - 30, y + 7, 10, K.dim, 'right', w - 340);
      T(c, '×', x + w - 12, y + 5, 12, K.dim, 'center');
      m.closeRect = { x: x + w - 24, y, w: 24, h: 22 };
      // tabs (wrap to a second row when they do not fit)
      m.tabRects = [];
      let tx = x + 8, ty = y + 24;
      m.tabs.forEach((tb, i) => {
        const tw = Math.ceil(measure(c, tb.label, 10)) + 14;
        if (tx + tw > x + w - 8) { tx = x + 8; ty += 18; }
        const on = i === m.tab;
        R(c, tx, ty, tw, 16, on ? K.gold : '#2a1e38');
        T(c, tb.label, tx + tw / 2, ty + 3, 10, on ? K.ink : K.text, 'center', tw - 4);
        m.tabRects.push({ x: tx, y: ty, w: tw, h: 16 });
        tx += tw + 4;
      });
      const ly = ty + 22;
      const rh = 22;
      const items = m.items();
      const vis = Math.max(1, Math.floor((y + h - 40 - ly) / rh));
      if (m.idx < m.top) m.top = m.idx;
      if (m.idx >= m.top + vis) m.top = m.idx - vis + 1;
      m.rects = [];
      if (!items.length) T(c, '（この時代・種類で使える部品がない）', x + w / 2, ly + 20, 12, K.dim, 'center');
      for (let k = 0; k < vis && m.top + k < items.length; k++) {
        const i = m.top + k, it = items[i];
        const yy = ly + k * rh;
        const sel = i === m.idx;
        R(c, x + 8, yy, w - 16, rh - 2, sel ? K.sel : '#1e1529');
        if (sel) R(c, x + 8, yy, 2, rh - 2, K.gold);
        let xx = x + 14;
        if (it.role) xx += chip(c, xx, yy + 3, ROLE_SHORT[it.role] || '', ROLE_COL[it.role] || K.dim, 30) + 4;
        if (it.beat) xx += chip(c, xx, yy + 3, BEAT_SHORT[it.twist ? 'uragiri' : it.beat] || it.beat, BEAT_COL[it.twist ? 'uragiri' : it.beat] || K.dim, 34) + 6;
        const right = it.theme ? `（${it.theme}）` : it.type ? (BOKE_TYPES[it.type] || it.type) : '';
        const rw = right ? Math.min(150, measure(c, right, 10) + 10) : 0;
        T(c, it.text + (it.pair ? `　→ ${it.pair.text}` : ''), xx, yy + 4, 12, K.text, 'left', x + w - 16 - xx - rw);
        if (right) T(c, right, x + w - 14, yy + 5, 10, it.theme ? K.dim : K.pink, 'right', 150);
        m.rects[i] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
      }
      if (items.length > vis) T(c, `${m.idx + 1}／${items.length}`, x + w - 12, y + h - 34, 10, K.dim, 'right');
      R(c, x + 1, y + h - 22, w - 2, 21, '#120c18');
      T(c, '←→ 分類　↑↓ えらぶ　A 足す（続けて足せる）　B 閉じる', x + 10, y + h - 17, 10, K.dim, 'left', w - 20);
    },
  };
  return m;
}

// ================================================================ the editor
const LIST = { x: 6, y: 42, w: 420, h: 250, rh: 18 };
const RIGHT = { x: 432, y: 40, w: 202, h: 252 };
const TOOLS = ['部品から足す', '自分で書く', 'まとめて書く', '台本の設定', 'AI採点', '保存して閉じる'];
export class EditorScene extends Base {
  constructor(g, draft, opts, resolve) {
    super(g, resolve);
    this.n = draft;
    this.opts = opts || {};
    this.kind = KINDS[draft.kind] ? draft.kind : 'manzai';
    this.sel = Math.max(0, draft.lines.length - 1);
    this.top = 0;
    this.focus = 'lines';
    this.tool = 0;
    this.moving = false;
    this.dirty = !draft.id && draft.lines.length > 0;
    this.saved = draft.id ? g.neta(draft.id) : null;
    this.cache = { h: -1 };
    this.toolRects = [];
  }
  rows() { return [...this.n.lines, { add: true }]; }
  era() { const e = this.g.state && this.g.state.profile && this.g.state.profile.era; return ERA_YEAR[e] ? e : 'reiwa'; }
  year() { const d = has(this.g, 'gameDate') ? safe(() => this.g.gameDate(), null) : null; return d && d.year ? d.year : ERA_YEAR[this.era()]; }
  names() {
    const u = has(this.g, 'unit') ? safe(() => this.g.unit(), null) : null;
    const out = { unit: u && u.type !== 'pin' ? u.name : '', boke: '', tsukkomi: '', name: this.g.state && this.g.state.name };
    for (const m of (u && u.members) || []) { if (m.role === 'boke' && !out.boke) out.boke = m.short || m.name; if (m.role === 'tsukkomi' && !out.tsukkomi) out.tsukkomi = m.short || m.name; }
    return out;
  }
  roleLabel(r) {
    if ((r === 'a' || r === 'b' || r === 'c') && this.n.chars && this.n.chars[r]) return `${ROLE_LONG[r]}（${this.n.chars[r]}）`;
    if (this.kind === 'rakugo' && r === 'narr') return '地（語り）';
    if (this.kind === 'pin' && r === 'narr') return 'フリップ・ト書き';
    if (this.kind === 'manzai' && (r === 'boke' || r === 'tsukkomi')) { const nm = this.names()[r]; if (nm) return `${ROLE_LONG[r]}（${nm}）`; }
    return ROLE_LONG[r] || r;
  }
  stats() {
    const h = netaHash(this.n);
    if (this.cache.h !== h) {
      this.cache = { h, est: estimate(this.n), check: structureCheck(this.n), beats: inferBeats(this.n) };
    }
    return this.cache;
  }
  mark() { this.dirty = true; }
  clampSel() { const n = this.rows().length; this.sel = clamp(this.sel, 0, n - 1); }
  // ---------------------------------------------------------------- input
  updateBody(inp) {
    const rows = this.rows();
    if (this.moving) {
      const L = this.n.lines;
      if (inp.repeat('up') && this.sel > 0) { [L[this.sel - 1], L[this.sel]] = [L[this.sel], L[this.sel - 1]]; this.sel--; this.mark(); sfx('cursor'); }
      else if (inp.repeat('down') && this.sel < L.length - 1) { [L[this.sel + 1], L[this.sel]] = [L[this.sel], L[this.sel + 1]]; this.sel++; this.mark(); sfx('cursor'); }
      else if (inp.pressed('a') || inp.pressed('b')) { this.moving = false; sfx('ok'); }
      return;
    }
    if (inp.pressed('menu')) { sfx('cancel'); this.act(() => this.askClose()); return; }
    if (this.focus === 'tools') {
      if (inp.repeat('left')) { this.tool = (this.tool + TOOLS.length - 1) % TOOLS.length; sfx('cursor'); }
      else if (inp.repeat('right')) { this.tool = (this.tool + 1) % TOOLS.length; sfx('cursor'); }
      else if (inp.pressed('up')) { this.focus = 'lines'; sfx('cursor'); }
      else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.runTool(this.tool)); }
      else if (inp.pressed('b')) { sfx('cancel'); this.act(() => this.askClose()); }
      return;
    }
    if (inp.repeat('up')) { if (this.sel > 0) { this.sel--; sfx('cursor'); } return; }
    if (inp.repeat('down')) { if (this.sel < rows.length - 1) { this.sel++; sfx('cursor'); } else { this.focus = 'tools'; sfx('cursor'); } return; }
    const cur = rows[this.sel];
    if ((inp.repeat('left') || inp.repeat('right')) && cur && !cur.add) {
      const opts = ROLE_OPTS[this.kind];
      const i = Math.max(0, opts.indexOf(cur.role));
      cur.role = opts[(i + (inp.repeat('left') ? opts.length - 1 : 1)) % opts.length];
      this.mark(); sfx('cursor');
      return;
    }
    if (inp.pressed('a')) { sfx('ok'); this.act(() => (cur && cur.add ? this.addMenu() : this.lineMenu(this.sel))); return; }
    if (inp.pressed('b')) { sfx('cancel'); this.act(() => this.askClose()); }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    const { x, y } = tap;
    now.a = false;
    if (inR(x, y, { x: SW - 24, y: 0, w: 24, h: 20 })) { sfx('cancel'); this.act(() => this.askClose()); return true; }
    if (this.moving) { this.moving = false; return true; }
    for (let i = 0; i < this.toolRects.length; i++) if (inR(x, y, this.toolRects[i])) { this.focus = 'tools'; this.tool = i; sfx('ok'); this.act(() => this.runTool(i)); return true; }
    if (inR(x, y, this.dialRect)) { this.n.dialect = this.n.dialect === 'kansai' ? 'std' : 'kansai'; this.mark(); sfx('cursor'); return true; }
    if (inR(x, y, this.headRect)) { this.act(() => this.settingsMenu()); return true; }
    if (inR(x, y, LIST)) {
      const j = this.top + Math.floor((y - LIST.y) / LIST.rh);
      const rows = this.rows();
      if (j >= 0 && j < rows.length) {
        this.focus = 'lines';
        if (j !== this.sel) { this.sel = j; sfx('cursor'); } else { sfx('ok'); this.act(() => (rows[j].add ? this.addMenu() : this.lineMenu(j))); }
      }
      return true;
    }
    return true;
  }
  // ---------------------------------------------------------------- actions
  async runTool(i) {
    if (i === 0) return this.addParts();
    if (i === 1) return this.writeLine(this.insertAt(), null);
    if (i === 2) return this.bulkWrite();
    if (i === 3) return this.settingsMenu();
    if (i === 4) return this.score();
    if (i === 5) { const ok = this.save(); if (ok) this.close(this.saved); return null; }
    return null;
  }
  insertAt() { const L = this.n.lines; return this.sel >= L.length ? L.length : this.sel + 1; }
  defaultRole(at) {
    const L = this.n.lines;
    const prev = L[at - 1];
    if (this.kind === 'manzai') return prev && prev.role === 'boke' ? 'tsukkomi' : 'boke';
    if (this.kind === 'conte') return prev && prev.role === 'a' ? 'b' : 'a';
    if (this.kind === 'rakugo') return prev && prev.role === 'a' ? 'b' : prev && prev.role === 'b' ? 'a' : 'narr';
    return 'pin';
  }
  insert(at, lines) {
    const L = this.n.lines;
    const room = 160 - L.length;
    if (room <= 0) { this.toast('これ以上は書けない（160行まで）', K.red); return 0; }
    const add = lines.slice(0, room).map((l) => { const o = { role: l.role, text: l.text, beat: l.beat || '' }; if (l.twist) o.twist = true; if (l.src) o.src = l.src; return o; });
    L.splice(at, 0, ...add);
    this.sel = at + add.length - 1;
    this.mark();
    return add.length;
  }
  async lineMenu(i) {
    const L = this.n.lines;
    const l = L[i];
    if (!l) return;
    const k = await this.pick({ title: `${i + 1}行目`, lines: [short(l.text, 60)], items: [
      { label: 'セリフを書きかえる' }, { label: `話者：${this.roleLabel(l.role)}`, sub: '←→ キーでもすぐ変えられる' }, { label: `ビート：${l.beat ? BEAT_LONG[l.twist ? 'uragiri' : l.beat] : '（自動）'}` },
      { label: '移動する（↑↓）' }, { label: 'この下に部品を足す' }, { label: 'この下に自分で書く' }, { label: '複製する' }, { label: '削除する' }, { label: 'もどる' },
    ] });
    if (k === 0) return this.writeLine(i, l);
    if (k === 1) {
      const opts = ROLE_OPTS[this.kind];
      const j = await this.pick({ title: '話者', items: opts.map((r) => ({ label: this.roleLabel(r) })), index: Math.max(0, opts.indexOf(l.role)) });
      if (j >= 0) { l.role = opts[j]; this.mark(); }
    } else if (k === 2) {
      const opts = BEAT_OPTS[this.kind];
      const cur = l.twist ? 'uragiri' : l.beat;
      const j = await this.pick({ title: 'ビート（台本の中での役目）', items: [{ label: '（自動）', sub: '前後から自動で決める' }, ...opts.map((b) => ({ label: BEAT_LONG[b] }))], index: Math.max(0, opts.indexOf(cur) + 1), rh: 22 });
      if (j === 0) { l.beat = ''; delete l.twist; this.mark(); } else if (j > 0) { const b = opts[j - 1]; if (b === 'uragiri') { l.beat = 'tenkai'; l.twist = true; } else { l.beat = b; delete l.twist; } this.mark(); }
    } else if (k === 3) { this.sel = i; this.moving = true; this.toast('↑↓ で動かす　A/B で決定', K.cyan); }
    else if (k === 4) { this.sel = i; return this.addParts(); }
    else if (k === 5) return this.writeLine(i + 1, null);
    else if (k === 6) { this.insert(i + 1, [{ ...l, src: undefined }]); }
    else if (k === 7) { const c = await this.confirm({ title: '削除', lines: [`「${short(l.text, 30)}」を消す？`], choices: ['消す', 'やめる'], danger: true }); if (c === 0) { L.splice(i, 1); this.clampSel(); this.mark(); sfx('cancel'); } }
    return null;
  }
  async addMenu() {
    const k = await this.pick({ title: '行を足す', items: [{ label: '部品から足す', sub: '候補のセリフから選ぶ（ネタの型を学べる）' }, { label: '自分で書く', sub: '一行ずつ入力する' }, { label: 'まとめて書く', sub: '台本をまるごと貼りつける・入力する' }, { label: 'もどる' }] });
    if (k === 0) return this.addParts();
    if (k === 1) return this.writeLine(this.insertAt(), null);
    if (k === 2) return this.bulkWrite();
    return null;
  }
  async writeLine(at, line) {
    const role = line ? line.role : this.defaultRole(at);
    const v = await askText(this.g, { title: `${line ? at + 1 : at + 1}行目（${this.roleLabel(role)}）${line ? 'を書きかえる' : ''}`, value: line ? line.text : '', max: 240, multiline: true, rows: 3, placeholder: this.kind === 'ogiri' ? '回答を書く（短いほど強い）' : 'セリフを書く', note: '改行は空白になる。240文字まで。' });
    if (v == null) return;
    const t = v.replace(/\s*\n\s*/g, ' ').trim();
    if (!t) return;
    if (line) { if (line.text !== t) { line.text = t; delete line.src; this.mark(); } return; }
    this.insert(at, [{ role, text: t, beat: this.kind === 'ogiri' ? 'answer' : '' }]);
  }
  async bulkWrite() {
    const L = this.n.lines;
    let mode = 1;
    if (L.length) { const k = await this.confirm({ title: 'まとめて書く', lines: ['いまの台本はどうする？'], choices: ['後ろに足す', '入れかえる', 'やめる'] }); if (k === 2 || k == null) return; mode = k === 0 ? 1 : 2; }
    const v = await askText(this.g, { title: 'まとめて書く（一行に一セリフ）', value: '', max: 6000, multiline: true, rows: 10, placeholder: 'ボケ：どうもー！\nツッコミ：よろしくお願いしますー！\n[オチ] ボケ：…', note: '「ボケ：」「ツッコミ：」「A：」「B：」「ナレ：」「地：」で話者、[ツカミ]【オチ】でビートを指定できる。話者がない行は交互・本人になる。' });
    if (v == null) return;
    const parse = this.g.__netaParse || ((s) => s.split(/\n/).map((t) => ({ role: this.defaultRole(this.n.lines.length), text: t.trim(), beat: '' })).filter((x) => x.text));
    const lines = parse(v, this.kind, this.n.chars || {});
    if (!lines.length) { this.toast('セリフが見つからなかった', K.red); return; }
    if (mode === 2) { this.n.lines = []; this.sel = 0; }
    const k = this.insert(this.n.lines.length, lines);
    this.toast(`${k}行を足した`, K.green);
  }
  async addParts() {
    const n = this.n;
    if (!n.theme && !n.themeId && this.kind !== 'manzai') await this.themeMenu();
    const opts = { themeId: n.themeId, era: this.era(), year: this.year(), dialect: n.dialect, names: this.names(), seed: n.lines.length + 1 };
    const tabs = safe(() => partsFor(this.kind, opts), []) || [];
    tabs.unshift({ id: 'auto', label: 'おまかせ', items: [
      { text: 'おまかせで一本まるごと組む（いまの台本と入れかえ）', auto: 'all' },
      { text: 'いまの台本の後ろに、おまかせで続きを足す', auto: 'more' },
    ] });
    const m = partsModal({ title: `部品から足す（${KIND_LABEL[this.kind]}${n.theme ? `・${short(n.theme, 12)}` : ''}）`, note: this.kind === 'manzai' ? 'ボケを選ぶと、そのツッコミも続けて入る' : '', tabs, tab: n.lines.length ? 2 : 1,
      onPick: (tb, it) => {
        if (!it) return;
        if (it.auto) { this.act(() => this.autoFill(it.auto)); this.closeModal(m, null); return; }
        const lines = [{ role: it.role, text: it.text, beat: it.beat, twist: it.twist, src: 'bank' }];
        if (it.pair) lines.push({ ...it.pair, src: 'bank' });
        const k = this.insert(this.insertAt(), lines);
        if (k) this.toast(`＋「${short(it.text, 18)}」`, K.green);
      } });
    await this.openModal(m);
  }
  async autoFill(how) {
    const n = this.n;
    const a = buildAuto(this.kind, { quality: 62, era: this.era(), year: this.year(), dialect: n.dialect, names: this.names(), seed: `${this.g.state.day}:${n.lines.length}:${how}`, themeId: n.themeId, length: n.target });
    if (how === 'all') {
      if (n.lines.length) { const k = await this.confirm({ title: 'おまかせで組む', lines: ['いまの台本は消えて、おまかせの台本になる。'], choices: ['組む', 'やめる'] }); if (k !== 0) return; }
      n.lines = a.lines.map((l) => ({ ...l }));
      if (!n.title) n.title = a.title;
      if (!n.theme) { n.theme = a.theme; n.themeId = a.themeId; }
      if (a.setting && !n.setting) n.setting = a.setting;
      if (a.chars && !n.chars) n.chars = { ...a.chars };
      this.sel = 0; this.top = 0;
      this.mark();
      this.toast('おまかせで組んだ（部品のままだと独自性は低い）', K.cyan);
    } else {
      const extra = a.lines.filter((l) => l.beat === 'boke' || l.beat === 'tsukkomi').slice(0, 6);
      const k = this.insert(n.lines.length, extra);
      this.toast(`${k}行を足した`, K.green);
    }
  }
  async themeMenu() {
    const n = this.n;
    const topics = safe(() => topicsFor(this.kind, this.era()), []) || [];
    const label = this.kind === 'ogiri' ? 'お題' : this.kind === 'conte' ? '設定（コントの場面）' : this.kind === 'rakugo' ? '噺' : this.kind === 'monomane' ? 'ものまねの題材' : 'テーマ';
    const items = [{ label: '自分で書く', sub: `${label}を入力する` }, ...topics.map((t) => ({ label: t.name, sub: t.setting ? short(t.setting, 40) : '' })), { label: 'あとで決める' }];
    const k = await this.pick({ title: `${label}をえらぶ`, items, rh: 26, index: Math.max(0, topics.findIndex((t) => t.id === n.themeId) + 1) });
    if (k === 0) {
      const v = await askText(this.g, { title: label, value: n.theme || '', max: 40 });
      if (v) { n.theme = v.trim(); n.themeId = ''; if (!n.title) n.title = short(n.theme, 24); this.mark(); }
    } else if (k > 0 && k <= topics.length) {
      const t = topics[k - 1];
      n.theme = t.name; n.themeId = t.id;
      if (!n.title) n.title = short(t.name, 24);
      if (t.setting && !n.setting) n.setting = t.setting;
      if (t.chars && (!n.chars || !Object.keys(n.chars).length)) n.chars = { ...t.chars };
      this.mark();
    }
  }
  async settingsMenu() {
    const n = this.n;
    const items = [
      { id: 'title', label: `タイトル：${n.title || '（なし）'}` },
      { id: 'theme', label: `${this.kind === 'ogiri' ? 'お題' : 'テーマ'}：${n.theme || '（なし）'}` },
      ...(this.kind === 'conte' ? [{ id: 'setting', label: `設定：${n.setting ? short(n.setting, 26) : '（なし）'}` }] : []),
      ...(this.kind === 'conte' || this.kind === 'rakugo' ? [{ id: 'chars', label: `登場人物：A=${(n.chars && n.chars.a) || '？'}　B=${(n.chars && n.chars.b) || '？'}` }] : []),
      { id: 'target', label: `目安の尺：${mmss(n.target)}` },
      { id: 'kind', label: `種類：${KIND_LABEL[this.kind]}` },
      { id: 'dialect', label: `候補の言葉づかい：${n.dialect === 'kansai' ? '関西弁' : '標準語'}` },
      { id: 'beats', label: 'ビートを自動でつける' },
      ...(this.saved ? [{ id: 'practice', label: 'ネタ合わせをする（体力 -8）', sub: `仕上がり ${num(this.saved.practice)}` }] : []),
      { id: 'ai', label: 'AI審査員の設定' },
      { id: 'back', label: 'もどる' },
    ];
    const k = await this.pick({ title: '台本の設定', items, rh: 24 });
    const id = k >= 0 ? items[k].id : 'back';
    if (id === 'title') { const v = await askText(this.g, { title: 'タイトル（24文字まで）', value: n.title || '', max: 24 }); if (v != null) { n.title = v.trim(); this.mark(); } }
    else if (id === 'theme') await this.themeMenu();
    else if (id === 'setting') { const v = await askText(this.g, { title: '設定（どこで・だれが・何をしている）', value: n.setting || '', max: 120, multiline: true, rows: 3 }); if (v != null) { n.setting = v.replace(/\s*\n\s*/g, ' ').trim(); this.mark(); } }
    else if (id === 'chars') {
      n.chars = n.chars || {};
      for (const r of ['a', 'b']) { const v = await askText(this.g, { title: `登場人物${r.toUpperCase()}の名前（10文字まで）`, value: n.chars[r] || '', max: 10 }); if (v != null) { if (v.trim()) n.chars[r] = v.trim(); else delete n.chars[r]; this.mark(); } }
    } else if (id === 'target') {
      const items2 = [...PRESETS.map((p) => ({ label: p.label, right: mmss(p.sec) })), { label: '自分で決める（秒）' }];
      const j = await this.pick({ title: '目安の尺', lines: ['賞レースのネタは、大会ごとの持ち時間に合わせよう（尺オーバーは減点）。'], items: items2, rh: 22, index: Math.max(0, PRESETS.findIndex((p) => p.sec === n.target)) });
      if (j >= 0 && j < PRESETS.length) { n.target = PRESETS[j].sec; this.mark(); }
      else if (j === PRESETS.length) { const v = await askText(this.g, { title: '目安の尺（秒）', value: String(n.target || ''), max: 4 }); const s = Math.round(Number(String(v || '').replace(/[^0-9]/g, ''))); if (s >= 10 && s <= 3600) { n.target = s; this.mark(); } }
      const st = has(this.g, 'netaSettings') ? this.g.netaSettings() : null;
      if (st) st.target = n.target;
    } else if (id === 'kind') {
      const kinds = Object.keys(KIND_LABEL);
      const j = await this.pick({ title: '種類', lines: n.lines.length ? ['話者は新しい種類に合わせて置きかわる。'] : [], items: kinds.map((x) => ({ label: KIND_LABEL[x] })), index: kinds.indexOf(this.kind), rh: 22 });
      if (j >= 0 && kinds[j] !== this.kind) {
        const to = kinds[j];
        const ok = ROLE_OPTS[to];
        for (const l of n.lines) if (!ok.includes(l.role)) l.role = l.role === 'narr' ? (ok.includes('narr') ? 'narr' : ok[0]) : l.role === 'tsukkomi' || l.role === 'b' ? (ok[1] && ok[1] !== 'narr' ? ok[1] : ok[0]) : ok[0];
        for (const l of n.lines) if (l.beat && !BEAT_OPTS[to].includes(l.beat)) l.beat = '';
        n.kind = to; this.kind = to;
        if (!n.target || DEFAULT_LEN[to]) n.target = n.target || DEFAULT_LEN[to];
        this.mark();
      }
    } else if (id === 'dialect') { n.dialect = n.dialect === 'kansai' ? 'std' : 'kansai'; this.mark(); }
    else if (id === 'beats') {
      const j = n.lines.some((l) => l.beat) ? await this.confirm({ title: 'ビートを自動でつける', choices: ['空いている行だけ', 'ぜんぶつけ直す', 'やめる'] }) : 0;
      if (j === 0 || j === 1) { if (j === 1) for (const l of n.lines) { l.beat = ''; delete l.twist; } const b = inferBeats(n); n.lines.forEach((l, i) => { if (!l.beat && b[i]) l.beat = b[i]; }); this.mark(); this.toast('ビートをつけた', K.green); }
    } else if (id === 'practice' && this.saved) {
      if (this.dirty) this.save();
      const r = await this.g.netaRehearse(this.saved.id);
      if (r && r.ok) { sfx('good'); this.toast(`ネタ合わせ！仕上がり ${r.before} → ${r.after}`, K.green); } else this.toast((r && r.why) || 'できなかった', K.red);
    } else if (id === 'ai') await openSettings(this.g);
  }
  save() {
    const rec = this.g.saveNeta({ ...this.n, title: this.n.title || `${KIND_LABEL[this.kind]}のネタ` });
    if (!rec) { this.info('保存できない', ['ネタ帳がいっぱい（60本まで）。古いネタを消そう。']); return false; }
    this.n.id = rec.id;
    this.saved = rec;
    this.dirty = false;
    this.toast('ネタ帳に保存した', K.green);
    return true;
  }
  async score() {
    if (!this.n.lines.some((l) => String(l.text || '').trim())) { await this.info('AI採点', ['台本がまだ空っぽ。まず何行か書こう。']); return; }
    if (!this.save()) return;
    let by = 'local';
    const ks = keyState();
    if (ks.has) {
      const k = await this.confirm({ title: 'AI審査員', lines: ['どちらで採点する？', `Claudeで採点すると、台本の文章がAnthropicのAPIに送られ、あなたのAPIキーに課金されます。`], choices: ['ローカルAI', 'Claude（APIキー使用）', 'やめる'], index: getMode() === 'claude' ? 1 : 0 });
      if (k === 2 || k == null) return;
      by = k === 1 ? 'claude' : 'local';
    }
    await this.g.scoreNeta(this.saved, { by, show: true, ui: true });
    this.cache.h = -1;
  }
  async askClose() {
    if (!this.dirty) { this.close(this.saved); return; }
    const k = await this.confirm({ title: '台本エディタを閉じる', lines: ['書きかけの台本がある。'], choices: ['保存して閉じる', '保存しないで閉じる', 'つづける'], cancel: 2 });
    if (k === 0) { if (this.save()) this.close(this.saved); }
    else if (k === 1) this.close(this.saved);
  }
  // ---------------------------------------------------------------- draw
  draw(c) {
    const n = this.n;
    const S = this.stats();
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, '台本エディタ', 8, 3, 12, K.gold);
    T(c, `${KIND_LABEL[this.kind]}${n.forContest ? '・賞レース用' : ''}`, 88, 4, 10, K.dim, 'left', 120);
    T(c, this.dirty ? '●未保存' : this.saved ? '保存ずみ' : '', SW - 32, 4, 10, this.dirty ? K.warn : K.green, 'right', 80);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    // title / theme strip (tap: 台本の設定)
    R(c, 0, 21, SW, 18, '#170f20');
    this.headRect = { x: 0, y: 21, w: 428, h: 18 };
    T(c, n.title || '（タイトルなし）', 8, 24, 12, n.title ? K.text : K.faint, 'left', 190);
    T(c, `${this.kind === 'ogiri' ? 'お題' : 'テーマ'}：${n.theme || '（未定）'}`, 204, 25, 10, K.dim, 'left', 220);
    // the lines
    const rows = this.rows();
    const vis = Math.floor(LIST.h / LIST.rh);
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + vis) this.top = this.sel - vis + 1;
    this.top = clamp(this.top, 0, Math.max(0, rows.length - vis));
    box(c, LIST.x - 2, LIST.y - 2, LIST.w + 4, LIST.h + 4, '');
    c.save(); c.beginPath(); c.rect(LIST.x, LIST.y, LIST.w, LIST.h); c.clip();
    for (let k = 0; k < vis && this.top + k < rows.length; k++) {
      const i = this.top + k, l = rows[i];
      const y = LIST.y + k * LIST.rh;
      const sel = i === this.sel && this.focus === 'lines';
      R(c, LIST.x, y, LIST.w, LIST.rh - 1, sel ? (this.moving ? '#4a2a20' : K.sel) : i % 2 ? '#1a1222' : '#1d1426');
      if (sel) R(c, LIST.x, y, 2, LIST.rh - 1, this.moving ? K.warn : K.gold);
      if (l.add) { T(c, rows.length === 1 ? '＋ ここから書きはじめる（A：部品から／自分で）' : '＋ 行を足す', LIST.x + 10, y + 3, 12, K.cyan, 'left', LIST.w - 20); continue; }
      T(c, String(i + 1), LIST.x + 20, y + 4, 10, K.faint, 'right');
      chip(c, LIST.x + 24, y + 2, ROLE_SHORT[l.role] || '?', ROLE_COL[l.role] || K.dim, 34);
      const b = l.twist ? 'uragiri' : l.beat || S.beats[i];
      if (b) { const auto = !l.beat; R(c, LIST.x + 62, y + 2, 36, 14, auto ? '#2a2236' : BEAT_COL[b] || K.dim); T(c, BEAT_SHORT[b] || b, LIST.x + 80, y + 4, 10, auto ? K.dim : K.ink, 'center', 34); }
      T(c, l.text, LIST.x + 102, y + 3, 12, l.src === 'bank' ? '#d8cce8' : K.text, 'left', LIST.w - 106);
    }
    c.restore();
    if (rows.length > vis) { const bh = Math.max(12, Math.round((LIST.h * vis) / rows.length)); const by = LIST.y + Math.round(((LIST.h - bh) * this.top) / Math.max(1, rows.length - vis)); R(c, LIST.x + LIST.w - 3, by, 3, bh, K.edgeHi); }
    // detail strip: the selected line in full
    const cur = rows[this.sel];
    R(c, 4, 296, 424, 36, K.panel); R(c, 4, 296, 424, 1, K.edge);
    if (cur && !cur.add) {
      T(c, `${this.sel + 1}行目・${this.roleLabel(cur.role)}${cur.src === 'bank' ? '・部品のまま' : ''}`, 10, 298, 10, cur.src === 'bank' ? K.pink : K.dim, 'left', 300);
      T(c, `${Array.from(cur.text).length}字`, 422, 298, 10, K.faint, 'right');
      para(c, cur.text, 10, 311, 412, 10, K.text, 11, 2);
    } else T(c, this.n.lines.length ? 'A：行を足す（部品から・自分で書く・まとめて書く）' : '台本はまだ空。部品から組むか、自分で書いてみよう。', 10, 306, 12, K.dim, 'left', 412);
    // right panel: numbers, checklist, AI
    const E = S.est;
    box(c, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h, 'ネタの状態');
    let y = RIGHT.y + 20;
    const over = E.sec > n.target * 1.05;
    T(c, `推定 ${mmss(E.sec)}`, RIGHT.x + 8, y, 12, over ? K.red : K.text);
    T(c, `目安 ${mmss(n.target)}`, RIGHT.x + RIGHT.w - 8, y + 1, 10, K.dim, 'right');
    y += 16;
    R(c, RIGHT.x + 8, y, RIGHT.w - 16, 6, '#2a2236');
    R(c, RIGHT.x + 8, y, Math.round((RIGHT.w - 16) * clamp(E.sec / Math.max(1, n.target), 0, 1)), 6, over ? K.red : E.sec >= n.target * 0.85 ? K.green : K.gold);
    y += 9;
    T(c, over ? `尺オーバー ${E.sec - n.target}秒！` : E.sec < n.target * 0.8 ? `あと${n.target - E.sec}秒ぶん書ける` : 'ちょうどいい長さ', RIGHT.x + 8, y, 10, over ? K.red : K.dim, 'left', RIGHT.w - 16);
    y += 14;
    T(c, `行 ${E.lines}・ボケ ${E.punches}・手数 ${E.perMin}/分`, RIGHT.x + 8, y, 10, K.text, 'left', RIGHT.w - 16);
    y += 16;
    T(c, '構成チェック', RIGHT.x + 8, y, 10, K.gold);
    y += 13;
    for (const it of S.check) { T(c, it.ok ? '✔' : '・', RIGHT.x + 10, y, 10, it.ok ? K.green : K.faint); T(c, it.label, RIGHT.x + 24, y, 10, it.ok ? K.text : K.faint, 'left', RIGHT.w - 30); y += 13; }
    y += 4;
    const ai = this.saved && this.saved.ai;
    const fresh = ai && (!ai.hash || ai.hash === netaHash(n));
    T(c, 'AI採点', RIGHT.x + 8, y, 10, K.gold);
    if (ai) {
      T(c, `${ai.total}点`, RIGHT.x + 60, y - 2, 12, fresh ? scoreCol(ai.total) : K.faint);
      T(c, ai.by === 'claude' ? 'Claude' : 'ローカルAI', RIGHT.x + RIGHT.w - 8, y, 10, K.dim, 'right');
      if (!fresh) T(c, '書きかえ後は未採点', RIGHT.x + 8, y + 13, 10, K.warn, 'left', RIGHT.w - 16);
      else T(c, ai.rank || rankLabel(ai.total), RIGHT.x + 8, y + 13, 10, K.dim, 'left', RIGHT.w - 16);
    } else T(c, '未採点（ツールの「AI採点」）', RIGHT.x + 60, y, 10, K.faint, 'left', RIGHT.w - 68);
    y += 30;
    const dl = `候補：${n.dialect === 'kansai' ? '関西弁' : '標準語'}`;
    const dw = measure(c, dl, 10) + 12;
    this.dialRect = { x: RIGHT.x + 8, y: Math.min(y, RIGHT.y + RIGHT.h - 20), w: dw, h: 16 };
    R(c, this.dialRect.x, this.dialRect.y, dw, 16, '#2a1e38');
    T(c, dl, this.dialRect.x + 6, this.dialRect.y + 3, 10, K.cyan);
    // toolbar
    this.toolRects = [];
    const bw = 104;
    TOOLS.forEach((lb, i) => {
      const x = 3 + i * (bw + 2), y2 = 336;
      const on = this.focus === 'tools' && this.tool === i;
      R(c, x, y2, bw, 22, on ? K.gold : i === 5 ? '#3a2a18' : '#2a1e38');
      T(c, lb, x + bw / 2, y2 + 5, 12, on ? K.ink : K.text, 'center', bw - 6);
      this.toolRects.push({ x, y: y2, w: bw, h: 22 });
    });
    T(c, this.moving ? '移動中：↑↓ 動かす　A/B 決定' : this.focus === 'tools' ? '←→ えらぶ　A 決定　↑ 台本へ　B 閉じる' : '↑↓ 行　A 操作　←→ 話者　↓ ツール　B 閉じる', SW - 4, 296 + 38 - 12, 10, K.faint, 'right', 200);
    this.drawOver(c);
  }
}

// ================================================================ the result
const TABS_R = ['総評', '審査員', '行ごと', 'アドバイス'];
export class ResultScene extends Base {
  constructor(g, neta, ai, resolve) {
    super(g, resolve);
    this.n = neta; this.ai = ai;
    this.tab = 0; this.scroll = [0, 0, 0, 0]; this.lsel = 0;
    this.kind = KINDS[neta.kind] ? neta.kind : 'manzai';
    const sentLines = (neta.lines || []).map((l, i) => ({ ...l, i })).filter((l) => String(l.text || '').trim());
    const by = new Map((ai.lines || []).map((x) => [x.i, x]));
    this.rows = sentLines.map((l) => ({ ...l, r: by.get(l.i) || null }));
  }
  updateBody(inp) {
    if (inp.pressed('menu') || inp.pressed('b')) { sfx('cancel'); this.close(); return; }
    if (inp.repeat('left')) { this.tab = (this.tab + TABS_R.length - 1) % TABS_R.length; sfx('cursor'); return; }
    if (inp.repeat('right')) { this.tab = (this.tab + 1) % TABS_R.length; sfx('cursor'); return; }
    if (this.tab === 2) {
      if (inp.repeat('up') && this.lsel > 0) { this.lsel--; sfx('cursor'); }
      if (inp.repeat('down') && this.lsel < this.rows.length - 1) { this.lsel++; sfx('cursor'); }
    } else {
      if (inp.repeat('up')) this.scroll[this.tab] = Math.max(0, this.scroll[this.tab] - 16);
      if (inp.repeat('down')) this.scroll[this.tab] = Math.min(this.maxScroll || 0, this.scroll[this.tab] + 16);
    }
    if (inp.pressed('a')) { if (this.tab < TABS_R.length - 1) { this.tab++; sfx('cursor'); } else { sfx('ok'); this.close(); } }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, { x: SW - 24, y: 0, w: 24, h: 20 })) { sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < (this.tabRects || []).length; i++) if (inR(tap.x, tap.y, this.tabRects[i])) { this.tab = i; sfx('cursor'); return true; }
    if (this.tab === 2 && this.listRect && inR(tap.x, tap.y, this.listRect)) { const j = (this.ltop || 0) + Math.floor((tap.y - this.listRect.y) / 18); if (j >= 0 && j < this.rows.length) { this.lsel = j; sfx('cursor'); } return true; }
    if (this.tab !== 2 && tap.y > 40) { const half = tap.y > 200; this.scroll[this.tab] = clamp(this.scroll[this.tab] + (half ? 48 : -48), 0, this.maxScroll || 0); }
    return true;
  }
  draw(c) {
    const ai = this.ai;
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, 'AI審査員の採点', 8, 3, 12, K.gold);
    T(c, `『${this.n.title || '無題'}』${KIND_LABEL[this.kind]}`, 112, 4, 10, K.text, 'left', 300);
    const badge = ai.by === 'claude' ? 'Claude（APIキー使用）' : 'ローカルAI';
    const bw = measure(c, badge, 10) + 12;
    R(c, SW - 32 - bw, 3, bw, 14, ai.by === 'claude' ? '#c06a3a' : '#3a5a8a');
    T(c, badge, SW - 32 - bw / 2, 4, 10, '#ffffff', 'center');
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    this.tabRects = [];
    const tw = Math.floor(SW / TABS_R.length);
    TABS_R.forEach((lb, i) => { const x = i * tw, on = i === this.tab; R(c, x + 1, 21, tw - 2, 18, on ? K.gold : '#1a1222'); T(c, lb, x + tw / 2, 24, 12, on ? K.ink : K.text, 'center', tw - 8); this.tabRects.push({ x, y: 20, w: tw, h: 20 }); });
    c.save(); c.beginPath(); c.rect(0, 40, SW, 300); c.clip();
    if (this.tab === 0) this.drawSummary(c);
    else if (this.tab === 1) this.drawJudges(c);
    else if (this.tab === 2) this.drawLines(c);
    else this.drawAdvice(c);
    c.restore();
    R(c, 0, 340, SW, 20, '#0c0812');
    T(c, '←→ タブ　↑↓ ' + (this.tab === 2 ? '行をえらぶ' : 'スクロール') + '　A 次へ　B 閉じる', SW - 8, 345, 10, K.faint, 'right', 400);
    if (ai.notice) T(c, ai.notice, 8, 345, 10, K.warn, 'left', 330);
    this.drawOver(c);
  }
  drawSummary(c) {
    const ai = this.ai;
    const axes = AXES_BY_KIND[this.kind].filter((a) => a in (ai.axes || {}));
    // radar
    const cx = 150, cy = 192, r = 96;
    const n = axes.length;
    const pt = (i, v) => { const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(ang) * r * v, cy + Math.sin(ang) * r * v]; };
    c.save();
    c.lineWidth = 1;
    for (const ring of [0.25, 0.5, 0.75, 1]) { c.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, ring); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.strokeStyle = ring === 1 ? K.edgeHi : K.edge; c.stroke(); }
    for (let i = 0; i < n; i++) { const [x, y] = pt(i, 1); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.strokeStyle = K.edge; c.stroke(); }
    c.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, clamp(num(ai.axes[axes[i % n]]) / 100, 0.02, 1)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.fillStyle = 'rgba(255,207,74,0.30)'; c.fill(); c.strokeStyle = K.gold; c.lineWidth = 2; c.stroke();
    c.restore();
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, 1.2);
      const v = num(ai.axes[axes[i]]);
      const lb = AXES[axes[i]];
      const al = Math.abs(x - cx) < 10 ? 'center' : x < cx ? 'right' : 'left';
      T(c, lb, x, y - 9, 10, K.text, al, 76);
      T(c, String(v), x, y + 2, 10, scoreCol(v), al);
    }
    // total and judges
    const X = 318;
    T(c, '総合', X, 48, 12, K.dim);
    T(c, `${ai.total}`, X + 40, 44, 40, scoreCol(ai.total));
    T(c, '点', X + 44 + measure(c, String(ai.total), 40), 66, 12, K.dim);
    T(c, ai.rank || rankLabel(ai.total), X + 140, 52, 12, K.gold, 'left', SW - X - 150);
    para(c, ai.summary || (ai.comments || [])[0] || '', X + 140, 70, SW - X - 150, 10, K.dim, 13, 2);
    let y = 100;
    T(c, `審査員5人（${JUDGES.length * 100}点満点：${(ai.judges || []).reduce((s, j) => s + num(j.score), 0)}点）`, X, y, 10, K.gold, 'left', SW - X - 8);
    y += 15;
    for (const j of ai.judges || []) {
      T(c, j.name, X, y, 12, K.text, 'left', 112);
      T(c, j.taste || '', X + 116, y + 1, 10, K.dim, 'left', 60);
      R(c, X + 178, y + 3, 100, 8, '#2a2236'); R(c, X + 178, y + 3, Math.round(num(j.score)), 8, scoreCol(num(j.score)));
      T(c, String(j.score), SW - 10, y, 12, scoreCol(num(j.score)), 'right');
      y += 18;
    }
    y += 6;
    T(c, 'ひとこと', X, y, 10, K.gold);
    y += 14;
    const adv = (ai.advice || [])[0] || '';
    para(c, adv, X, y, SW - X - 10, 12, K.text, 15, 4);
    const best = (ai.best || [])[0];
    if (best != null && this.n.lines[best]) { y += 66; T(c, `★ いちばんの行：${best + 1}行目「${short(this.n.lines[best].text, 26)}」`, X, Math.min(y, 322), 10, K.green, 'left', SW - X - 10); }
  }
  drawJudges(c) {
    const ai = this.ai;
    const off = this.scroll[1];
    let y = 46 - off;
    for (const j of ai.judges || []) {
      const lines = jwrap(c, j.comment || '（コメントなし）', SW - 140, 12);
      const h = Math.max(54, 24 + lines.length * 15);
      box(c, 8, y, SW - 16, h - 4, '');
      T(c, j.name, 16, y + 6, 12, K.gold, 'left', 200);
      T(c, `${j.title || ''}・${j.taste || ''}`, 16 + Math.min(200, measure(c, j.name, 12)) + 8, y + 7, 10, K.dim, 'left', 220);
      T(c, String(j.score), SW - 20, y + 10, 24, scoreCol(num(j.score)), 'right');
      lines.forEach((l, k) => T(c, l, 16, y + 24 + k * 15, 12, K.text));
      y += h;
    }
    this.maxScroll = Math.max(0, y + off - 330);
  }
  drawLines(c) {
    const ai = this.ai;
    const L = { x: 6, y: 44, w: SW - 12, h: 236 };
    this.listRect = L;
    const vis = Math.floor(L.h / 18);
    if (this.lsel < (this.ltop || 0)) this.ltop = this.lsel;
    if (this.lsel >= (this.ltop || 0) + vis) this.ltop = this.lsel - vis + 1;
    const top = this.ltop || 0;
    const best = new Set(ai.best || []), worst = new Set(ai.worst || []);
    for (let k = 0; k < vis && top + k < this.rows.length; k++) {
      const row = this.rows[top + k];
      const y = L.y + k * 18;
      const sel = top + k === this.lsel;
      R(c, L.x, y, L.w, 17, sel ? K.sel : k % 2 ? '#1a1222' : '#1d1426');
      T(c, String(row.i + 1), L.x + 20, y + 4, 10, K.faint, 'right');
      chip(c, L.x + 24, y + 2, ROLE_SHORT[row.role] || '?', ROLE_COL[row.role] || K.dim, 34);
      const s = row.r ? num(row.r.s) : null;
      R(c, L.x + 62, y + 5, 40, 7, '#2a2236');
      if (s != null) R(c, L.x + 62, y + 5, Math.round(s * 0.4), 7, scoreCol(s));
      const mark = best.has(row.i) ? '★' : worst.has(row.i) ? '▼' : '';
      if (mark) T(c, mark, L.x + 108, y + 3, 10, mark === '★' ? K.green : K.red);
      const tag = row.r && row.r.tag ? row.r.tag : '';
      const tw2 = tag ? Math.min(120, measure(c, tag, 10) + 8) : 0;
      T(c, row.text, L.x + 122, y + 3, 12, K.text, 'left', L.w - 128 - tw2);
      if (tag) T(c, tag, L.x + L.w - 6, y + 4, 10, best.has(row.i) ? K.green : worst.has(row.i) ? K.red : K.dim, 'right', 120);
    }
    const cur = this.rows[this.lsel];
    box(c, 6, 284, SW - 12, 52, cur ? `${cur.i + 1}行目${cur.r ? `　${cur.r.s}点${cur.r.tag ? '・' + cur.r.tag : ''}` : ''}` : '');
    if (cur) para(c, cur.text, 14, 302, SW - 28, 12, K.text, 15, 2);
  }
  drawAdvice(c) {
    const ai = this.ai;
    const off = this.scroll[3];
    let y = 46 - off;
    T(c, '改善のアドバイス', 12, y, 12, K.gold);
    y += 18;
    (ai.advice || []).forEach((a, i) => { T(c, `${i + 1}.`, 14, y, 12, K.gold); y += para(c, a, 34, y, SW - 50, 12, K.text, 16) + 4; });
    y += 8;
    T(c, '項目ごとの評価', 12, y, 12, K.gold);
    y += 18;
    for (const a of AXES_BY_KIND[this.kind]) {
      if (!(a in (ai.axes || {}))) continue;
      const v = num(ai.axes[a]);
      T(c, AXES[a], 14, y, 12, K.text, 'left', 110);
      R(c, 130, y + 4, 100, 8, '#2a2236'); R(c, 130, y + 4, v, 8, scoreCol(v));
      T(c, String(v), 254, y, 12, scoreCol(v), 'right');
      T(c, (ai.reasons || {})[a] || '', 264, y + 1, 10, K.dim, 'left', SW - 276);
      y += 17;
    }
    const st = ai.stats || {};
    if (st.sec != null) { y += 6; T(c, `推定の尺 ${mmss(st.sec)}／目安 ${mmss(st.target || this.n.target)}・ボケ ${st.punches ?? '-'}個・1分あたり ${st.perMin ?? '-'}個`, 14, y, 10, K.dim, 'left', SW - 28); y += 14; }
    if (ai.by === 'local') { T(c, '※ローカルAIは辞書と規則で読む採点。言葉遊び・韻はかなで書かれたところだけ見える。', 14, y, 10, K.faint, 'left', SW - 28); y += 14; }
    this.maxScroll = Math.max(0, y + off - 330);
  }
}

// ================================================================ the chooser (g.pickNeta)
export class PickerScene extends Base {
  constructor(g, opts, resolve) {
    super(g, resolve);
    this.opts = opts;
    this.kind = opts.kind || 'manzai';
    this.idx = 0; this.top = 0;
    this.reload();
    // start on the best fitting script
    let best = -1, bq = -1;
    this.items.forEach((it, i) => { if (it.neta) { const q = num(safe(() => g.netaQuality(it.neta, { contest: opts.forContest }), 0)); if (q > bq) { bq = q; best = i; } } });
    if (best >= 0) this.idx = best;
  }
  reload() {
    const g = this.g;
    const list = g.netaList(this.kind);
    this.items = [...list.map((x) => ({ neta: x })), { id: 'new', label: '＋ 新しく書く' }, { id: 'auto', label: 'おまかせ（その場で組む）' }, { id: 'cancel', label: 'やめる' }];
  }
  updateBody(inp) {
    const n = this.items.length;
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.choose(this.idx)); }
    else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); this.close(null); }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, { x: SW - 24, y: 0, w: 24, h: 20 })) { sfx('cancel'); this.close(null); return true; }
    if (this.listRect && inR(tap.x, tap.y, this.listRect)) { const j = this.top + Math.floor((tap.y - this.listRect.y) / 30); if (j >= 0 && j < this.items.length) { if (j === this.idx) { sfx('ok'); this.act(() => this.choose(j)); } else { this.idx = j; sfx('cursor'); } } }
    return true;
  }
  async choose(i) {
    const it = this.items[i];
    const g = this.g, o = this.opts;
    if (!it || it.id === 'cancel') { this.close(null); return; }
    if (it.id === 'new') {
      const x = await g.writeNeta({ kind: this.kind === 'any' || this.kind === 'double' ? 'manzai' : this.kind, length: o.length, title: o.title, forContest: o.forContest });
      this.reload();
      if (x) { const j = this.items.findIndex((y) => y.neta && y.neta.id === x.id); if (j >= 0) this.idx = j; const k = await this.confirm({ title: 'このネタでいく？', lines: [`『${x.title}』`], choices: ['このネタでいく', 'えらびなおす'] }); if (k === 0) this.close(x); }
      return;
    }
    if (it.id === 'auto') {
      const q = Math.round(clamp(20 + num(has(g, 'comedyStat') ? safe(() => g.comedyStat('neta'), 30) : 30) * 0.6, 15, 75));
      const x = g.autoNeta(this.kind === 'any' || this.kind === 'double' ? 'manzai' : this.kind, q, { length: o.length });
      const k = await this.confirm({ title: 'おまかせ', lines: [`その場で組んだネタ『${x.title}』（目安${q}点）でいく。自分で書いた台本のほうが、ふつうは強い。`], choices: ['これでいく', 'やめる'] });
      if (k === 0) this.close(x);
      return;
    }
    const x = it.neta;
    const est = estimate(x, { target: o.length || x.target });
    const target = Number(o.length) || x.target;
    if (o.length && est.sec > target * 1.1) {
      const k = await this.confirm({ title: '尺オーバー', lines: [`『${x.title}』は推定${mmss(est.sec)}。持ち時間${mmss(target)}を${est.sec - target}秒こえる。オーバーは大きく減点される。`], choices: ['それでもいく', 'えらびなおす'], danger: true });
      if (k !== 0) return;
    }
    this.close(x);
  }
  draw(c) {
    const g = this.g, o = this.opts;
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, 'ネタをえらぶ', 8, 3, 12, K.gold);
    T(c, `${o.title ? o.title + '・' : ''}${KIND_LABEL[this.kind] || 'なんでも'}${o.length ? `・持ち時間 ${mmss(o.length)}` : ''}`, 100, 4, 10, K.text, 'left', SW - 140);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    const L = { x: 6, y: 26, w: 378, h: 306 };
    this.listRect = L;
    const vis = Math.floor(L.h / 30);
    if (this.idx < this.top) this.top = this.idx;
    if (this.idx >= this.top + vis) this.top = this.idx - vis + 1;
    for (let k = 0; k < vis && this.top + k < this.items.length; k++) {
      const it = this.items[this.top + k];
      const y = L.y + k * 30;
      const sel = this.top + k === this.idx;
      R(c, L.x, y, L.w, 28, sel ? K.sel : '#1a1222');
      if (sel) R(c, L.x, y, 2, 28, K.gold);
      if (!it.neta) { T(c, it.label, L.x + 12, y + 7, 12, it.id === 'new' ? K.cyan : it.id === 'auto' ? K.gold : K.dim, 'left', L.w - 20); continue; }
      const x = it.neta;
      const q = num(safe(() => g.netaQuality(x, { contest: o.forContest }), 0));
      const est = estimate(x, { target: o.length || x.target });
      const over = (o.length || x.target) && est.sec > (Number(o.length) || x.target) * 1.05;
      T(c, x.title || '無題', L.x + 12, y + 2, 12, K.text, 'left', 230);
      T(c, `${KIND_LABEL[x.kind]}・${mmss(est.sec)}${over ? '（尺オーバー）' : ''}・${x.ai ? `AI ${x.ai.total}点` : '未採点'}・仕上がり${num(x.practice)}`, L.x + 12, y + 16, 10, over ? K.red : K.dim, 'left', 290);
      T(c, `${q}`, L.x + L.w - 10, y + 6, 16, scoreCol(q), 'right');
    }
    // detail
    const it = this.items[this.idx];
    box(c, 390, 26, 244, 306, it && it.neta ? '台本のようす' : '');
    if (it && it.neta) {
      const x = it.neta;
      const f = g.netaFreshness(x, o.forContest);
      let y = 46;
      T(c, x.title || '無題', 398, y, 12, K.gold, 'left', 228); y += 18;
      T(c, `出来（本番の見込み）${num(safe(() => g.netaQuality(x, { contest: o.forContest }), 0))}`, 398, y, 10, K.text, 'left', 228); y += 14;
      T(c, `仕上がり ${num(x.practice)}`, 398, y, 10, K.text); R(c, 480, y + 3, 140, 6, '#2a2236'); R(c, 480, y + 3, Math.round(1.4 * num(x.practice)), 6, K.cyan); y += 14;
      T(c, `鮮度：${f.label}`, 398, y, 10, f.same ? K.red : f.value < 70 ? K.warn : K.green, 'left', 228); y += 16;
      for (const ch of structureCheck(x)) { T(c, `${ch.ok ? '✔' : '・'} ${ch.label}`, 400, y, 10, ch.ok ? K.text : K.faint, 'left', 220); y += 13; }
      y += 4;
      if (x.ai && x.ai.advice && x.ai.advice[0]) { T(c, 'AIのアドバイス', 398, y, 10, K.gold); y += 14; para(c, x.ai.advice[0], 398, y, 228, 10, K.dim, 13, 5); }
    } else if (it) para(c, it.id === 'new' ? 'その場で台本エディタを開いて、新しいネタを書く。書き終えたら、そのネタを選べる。' : it.id === 'auto' ? '部品を組み合わせたネタで出る。手っ取り早いが、独自性は低い。' : '今回はネタを選ばない。', 398, 48, 228, 12, K.dim, 16);
    R(c, 0, 340, SW, 20, '#0c0812');
    T(c, '↑↓ えらぶ　A 決定　B やめる', SW - 8, 345, 10, K.faint, 'right');
    this.drawOver(c);
  }
}

// ================================================================ the settings (ローカルAI / Claude + API key)
export class SettingsScene extends Base {
  constructor(g, resolve) { super(g, resolve); this.idx = 0; this.rowRects = []; }
  rows() {
    const ks = keyState();
    return [
      { id: 'mode', label: '採点するAI', value: ks.mode === 'claude' ? 'Claude（APIキー使用）' : 'ローカルAI（ふつう）' },
      { id: 'key', label: 'APIキー', value: ks.has ? ks.masked : '未設定（ここで入力）' },
      { id: 'remember', label: 'この端末に保存する', value: ks.remember ? '☑ 保存する' : '☐ 保存しない（ゲームを閉じると消える）', lock: !ks.has },
      { id: 'clear', label: 'キーを削除', value: ks.has ? '削除する' : '—', lock: !ks.has },
      { id: 'close', label: '閉じる', value: '' },
    ];
  }
  updateBody(inp) {
    const n = this.rows().length;
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.run(this.rows()[this.idx].id)); }
    else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); this.close(); }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, { x: SW - 24, y: 0, w: 24, h: 20 })) { sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < this.rowRects.length; i++) if (inR(tap.x, tap.y, this.rowRects[i])) { if (this.idx === i) { sfx('ok'); this.act(() => this.run(this.rows()[i].id)); } else { this.idx = i; sfx('cursor'); } return true; }
    return true;
  }
  async run(id) {
    const ks = keyState();
    if (id === 'mode') {
      if (ks.mode === 'claude') { setMode('local'); this.toast('ローカルAIで採点する', K.green); return; }
      if (!ks.has) { const ok = await this.enterKey(); if (!ok) return; }
      const k = await this.confirm({ title: 'Claudeで採点する', lines: ['台本の文章がAnthropicのAPIに送信され、あなたのAPIキーに課金されます。', `モデル：${CLAUDE.model}。つながらない時はローカルAIで採点します。`], choices: ['Claudeにする', 'やめる'] });
      if (k === 0) { setMode('claude'); this.toast('Claude（APIキー使用）で採点する', K.gold); }
    } else if (id === 'key') await this.enterKey();
    else if (id === 'remember' && ks.has) { const v = setRemember(!ks.remember); this.toast(v ? 'この端末に保存した' : 'この端末から消した（今回だけ使う）', K.cyan); }
    else if (id === 'clear' && ks.has) { const k = await this.confirm({ title: 'キーを削除', lines: ['APIキーをゲームから消す（保存していれば端末からも消える）。'], choices: ['削除する', 'やめる'], danger: true }); if (k === 0) { clearKey(); this.toast('キーを削除した', K.green); } }
    else if (id === 'close') this.close();
  }
  async enterKey() {
    const v = await askText(this.g, { title: 'AnthropicのAPIキー', value: '', max: 200, type: 'password', placeholder: 'sk-ant-…', note: '入力したキーは画面にふせ字でしか出ない。台本を採点するときだけ api.anthropic.com に送る。' });
    if (v == null || !v.trim()) return false;
    const ok = setKey(v, keyState().remember);
    if (!ok) { await this.info('APIキー', ['キーの形が正しくないようだ（空白なし・16文字以上）。']); return false; }
    this.toast('キーを設定した（' + keyState().masked + '）', K.green);
    return true;
  }
  draw(c) {
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, 'AI審査員の設定', 8, 3, 12, K.gold);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    box(c, 40, 32, SW - 80, 200, '採点するAI');
    this.rowRects = [];
    this.rows().forEach((r, i) => {
      const y = 52 + i * 34;
      const sel = i === this.idx;
      R(c, 50, y, SW - 100, 30, sel ? K.sel : '#1d1426');
      if (sel) R(c, 50, y, 2, 30, K.gold);
      T(c, r.label, 62, y + 8, 12, r.lock ? K.faint : K.text, 'left', 170);
      T(c, r.value, 236, y + 8, 12, r.lock ? K.faint : r.id === 'mode' && keyState().mode === 'claude' ? K.gold : K.cyan, 'left', SW - 300);
      this.rowRects.push({ x: 50, y, w: SW - 100, h: 30 });
    });
    box(c, 40, 240, SW - 80, 94, '注意');
    para(c, '台本の文章がAnthropicのAPIに送信され、あなたのAPIキーに課金されます。', 50, 260, SW - 100, 12, K.warn, 15, 2);
    para(c, `キーはふせ字でしか表示せず、記録にも残さない。「この端末に保存する」をえらばなければ、ゲームを閉じると消える。モデル：${CLAUDE.model}。失敗したときはローカルAIで採点する（ふだんはローカルAIで十分）。`, 50, 280, SW - 100, 10, K.dim, 13, 4);
    R(c, 0, 340, SW, 20, '#0c0812');
    T(c, '↑↓ えらぶ　A 決定　B 閉じる', SW - 8, 345, 10, K.faint, 'right');
    this.drawOver(c);
  }
}

// ================================================================ waiting for Claude
class WaitingScene {
  constructor(g, resolve) { Object.assign(this, { g, resolve, hd: true, opaque: false, hidesHud: true, isNetaUI: true, t: 0, closed: false, tapAt: null }); }
  update(g) { this.t++; const tap = this.tapAt; this.tapAt = null; if (this.t > 10 && (g.input.pressed('b') || g.input.pressed('menu') || tap)) { const now = g.input.pressedNow || {}; now.a = false; this.cancel(); } }
  draw(c) {
    R(c, 0, 0, SW, SH, 'rgba(8,4,14,0.78)');
    const w = 360, x = (SW - w) / 2, y = 130;
    box(c, x, y, w, 96, 'AI審査員（Claude）');
    const dots = '・'.repeat(1 + (Math.floor(this.t / 20) % 3));
    T(c, `審査員が台本を読んでいます${dots}`, x + w / 2, y + 30, 12, K.text, 'center', w - 20);
    T(c, `${Math.floor(this.t / 60)}秒`, x + w / 2, y + 50, 10, K.dim, 'center');
    T(c, 'B：やめてローカルAIで採点する', x + w / 2, y + 72, 10, K.faint, 'center');
  }
}
export function openWaiting(g, run) {
  if (g.auto) return run(undefined);
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  return new Promise((resolve) => {
    const sc = new WaitingScene(g, resolve);
    bindTap(g);
    let done = false;
    const finish = (r) => { if (done) return; done = true; if (!sc.closed) { sc.closed = true; g.pop(sc); } resolve(r); };
    sc.cancel = () => { if (ac) ac.abort(); finish({ ok: false, code: 'offline', notice: '採点をやめました' }); };
    g.push(sc);
    Promise.resolve().then(() => run(ac ? ac.signal : undefined)).then(finish, () => finish({ ok: false, code: 'offline', notice: 'Claudeに接続できません' }));
  });
}

// ================================================================ entry points
const allowUI = (g) => !g.auto || g.auto.netaui;
export function openEditor(g, draft, opts = {}) {
  if (!allowUI(g)) return Promise.resolve(null);
  sfx('ok');
  return new Promise((resolve) => { const sc = new EditorScene(g, draft, opts, resolve); g.push(sc); if (!draft.lines.length && !draft.theme) sc.act(() => sc.themeMenu()); });
}
export function openResult(g, neta, ai) {
  if (!allowUI(g) || !ai) return Promise.resolve(null);
  sfx(ai.total >= 70 ? 'fanfare' : 'ok');
  return new Promise((resolve) => g.push(new ResultScene(g, neta, ai, resolve)));
}
export function openPicker(g, opts = {}) {
  if (!allowUI(g)) return Promise.resolve(null);
  return new Promise((resolve) => g.push(new PickerScene(g, opts, resolve)));
}
export function openSettings(g) {
  if (!allowUI(g)) return Promise.resolve(null);
  return new Promise((resolve) => g.push(new SettingsScene(g, resolve)));
}
if (typeof window !== 'undefined') window.__netaui = { top: () => { const g = window.__game; return g && g.top && g.top.isNetaUI ? g.top : null; }, EditorScene, ResultScene, PickerScene, SettingsScene, partsModal };

// ================================================================ the phone app 「ネタ帳」 (手帳 / ケータイ / スマホ)
const devOf = (g) => { const e = g.state && g.state.profile && g.state.profile.era; return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; };
const APP = { smart: { color: '#c0562a', bg: null, title: 'ネタ帳' }, keitai: { color: '#9a5a3a', bg: null, title: 'ネタ帳（メモ）' }, techo: { color: '#7a5230', bg: '#f6efd8', title: 'ネタ帳（手帳のページ）' } };
async function netaApp(g) {
  const A = APP[devOf(g)];
  let index = 0;
  for (;;) {
    const list = g.netaList();
    const ks = keyState();
    const items = [
      { label: '＋ 新しく書く', sub: '漫才・コント・ピン・落語・大喜利…' },
      { label: 'AI審査員の設定', sub: ks.mode === 'claude' && ks.has ? 'Claude（APIキー使用）' : 'ローカルAI' },
      ...list.map((x) => ({ label: x.title || '無題', sub: `${KIND_LABEL[x.kind]}・${mmss(x.length || 0)}・${x.ai ? `AI ${x.ai.total}点` : '未採点'}・仕上がり${num(x.practice)}`, right: x.ai ? String(x.ai.total) : '' })),
    ];
    const i = await phoneList(g, { title: A.title, color: A.color, bg: A.bg, index, items, describe: (k) => (k >= 2 && list[k - 2] ? `${list[k - 2].theme ? 'テーマ：' + list[k - 2].theme + '　' : ''}${list[k - 2].ai ? list[k - 2].ai.rank || '' : 'まだAI採点していない'}` : k === 0 ? '台本エディタで書く（部品から・自分で）' : 'ローカルAI／Claude（自分のAPIキー）') });
    if (i < 0) return;
    index = i;
    if (i === 0) {
      const kinds = Object.keys(KIND_LABEL);
      const k = await phoneList(g, { title: 'どのネタを書く？', color: A.color, bg: A.bg, items: kinds.map((x) => ({ label: KIND_LABEL[x] })) });
      if (k >= 0) await g.writeNeta({ kind: kinds[k] });
      continue;
    }
    if (i === 1) { await openSettings(g); continue; }
    const x = list[i - 2];
    if (x) await scriptActions(g, x, A);
  }
}
async function scriptActions(g, x, A) {
  for (;;) {
    const acts = [{ id: 'view', label: '台本を見る' }, { id: 'edit', label: '書きなおす（エディタ）' }, { id: 'score', label: 'AI採点する' }, ...(x.ai ? [{ id: 'result', label: '採点結果を見る', sub: `${x.ai.total}点・${x.ai.by === 'claude' ? 'Claude' : 'ローカルAI'}` }] : []), { id: 'practice', label: 'ネタ合わせ（体力 -8）', sub: `仕上がり ${num(x.practice)}` }, { id: 'del', label: '削除する' }];
    const k = await phoneList(g, { title: short(x.title || '無題', 12), color: A.color, bg: A.bg, items: acts });
    if (k < 0) return;
    const id = acts[k].id;
    if (id === 'view') await phoneInfo(g, { title: short(x.title || '無題', 12), color: A.color, lines: [`${KIND_LABEL[x.kind]}　推定${mmss(x.length || 0)}／目安${mmss(x.target)}`, x.theme ? `テーマ：${x.theme}` : null, x.setting ? `設定：${x.setting}` : null, '', ...x.lines.map((l, j) => `${j + 1}.【${(x.chars && x.chars[l.role]) || ROLE_LONG[l.role] || l.role}】${l.text}`)].filter((s) => s != null) });
    else if (id === 'edit') await g.writeNeta({ id: x.id, kind: x.kind });
    else if (id === 'score') { const ai = await g.scoreNeta(x, { show: true, ui: true }); if (g.auto && ai) await phoneInfo(g, { title: 'AI採点', color: A.color, lines: [`${ai.total}点（${ai.rank}）`, ...(ai.advice || []).slice(0, 3)] }); }
    else if (id === 'result') await g.showNetaResult(x);
    else if (id === 'practice') { const r = await g.netaRehearse(x.id); await phoneInfo(g, { title: 'ネタ合わせ', color: A.color, lines: r && r.ok ? [`ネタ合わせをした。`, `仕上がり ${r.before} → ${r.after}`, `（今日はあと${r.left}回できる）`] : [(r && r.why) || 'できなかった'] }); }
    else if (id === 'del') { const c = await phoneConfirm(g, { title: '削除', color: A.color, text: `『${x.title || '無題'}』をネタ帳から消す？`, choices: ['消す', 'やめる'] }); if (c === 0) { g.deleteNeta(x.id); return; } }
    if (!g.neta(x.id)) return;
  }
}
export function installNetaApp() {
  registerPhoneApp('neta', {
    name: 'ネタ帳', color: '#c0562a', order: 35,
    iconHD(c, x, y, g) {
      const d = g ? devOf(g) : 'smart';
      appTile(c, x, y, d === 'techo' ? '#7a5230' : '#c0562a');
      // a notebook with ruled lines and a red ribbon
      R(c, x + 8, y + 6, 17, 21, '#2a1608'); R(c, x + 9, y + 7, 15, 19, d === 'techo' ? '#f6efd8' : '#ffffff');
      for (let j = 0; j < 4; j++) R(c, x + 11, y + 11 + j * 4, 11, 1, '#9ab0d0');
      R(c, x + 8, y + 6, 3, 21, '#5a3010');
      R(c, x + 19, y + 5, 3, 8, '#e0303a'); R(c, x + 20, y + 13, 1, 1, '#e0303a');
    },
    badge: (g) => { try { return g.netaList().filter((x) => !x.ai && x.lines.length).length ? 1 : 0; } catch (e) { return 0; } },
    open: (g) => netaApp(g),
  });
  installNetaApp.openBook = (g) => withPhone(g, () => netaApp(g));
}
