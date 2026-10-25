// 賞レースの画面 (owner: D1) — the HD 賞レース screen (g.openContests(tab)), the エントリー用紙, the 掲示 (results board),
// the 決勝 scoreboard, the vote board, and the phone app 「賞レース」 (手帳 / ケータイ / スマホ). Talks to contests.js only
// through its exports and the g.* API; registers its scenes into CONTEST_UI (contests_run.js falls back to text without them).
//
// Screen (640x360, hd / opaque / hidesHud / isContestUI): tabs カレンダー · 大会一覧 · エントリー状況 · 結果 · 歴代王者 · ニュース.
// Keys: ←→ tabs (on the tab bar), ↓/A into the body, ↑↓ choose, A act, B back, MENU close. Calendar: ↑↓←→ move the day,
// A the day's events. Taps: tabs, ×, rows (first tap selects, second acts), calendar cells, ‹ › (year), modal buttons.
// Test hook: window.__contestui = { scene(), open, TABS }.

import { SW, SH, clamp, shade, fmtMoney } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { registerPhoneApp } from './life.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, closePhoneThen, phoneOverMapOnly, activePhone } from './phone.js';
import { drawFaceHD } from './sprites.js';
import { CONTESTS, CONTEST_UI, internals as I } from './contests.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const K = {
  bg: '#110c1c', head: '#1b1330', panel: '#19122a', panel2: '#251a3c', edge: '#3c2d5c', edgeHi: '#7a5fb8', text: '#f4eefc', dim: '#a99dc2', faint: '#6a5e88',
  gold: '#ffd23f', good: '#57d98a', bad: '#ff6470', warn: '#ffcc4d', sel: '#2f2350', cyan: '#5fd7ff', pink: '#ff7eb6', white: '#ffffff',
};
const STATUS_COL = { open: '#3fb86a', running: '#e0902a', future: '#4a7ac8', closed: '#6a6a7a', notyet: '#5a4a6a' };
const ENTRY_COL = { entered: '#4a7ac8', passed: '#3fb86a', out: '#a05060', champion: '#e0b020', withdrawn: '#6a6a7a' };
const ENTRY_LABEL = { entered: 'エントリー済み', passed: '勝ち上がり中', out: '敗退', champion: '優勝', withdrawn: '棄権' };

// ================================================================ text helpers (every string has a width)
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
const TOKEN = /[−\-]?[0-9０-９]+(?:[.,][0-9]+)*(?:[%年月日歳人分万億円組位回点票番秒]+)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
export function jwrap(c, str, w, size = 12) {
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
function chip(c, s, x, y, col, size = 10, align = 'left') {
  const w = Math.ceil(measure(c, s, size)) + 8;
  const x0 = align === 'right' ? x - w : x;
  R(c, x0, y, w, size + 4, col);
  T(c, s, x0 + 4, y + 1, size, '#ffffff');
  return w;
}
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// ================================================================ taps (shared by the scenes here)
const sceneOf = (g) => g && g.scenes && [...g.scenes].reverse().find((s) => s.isContestUI && !s.closed);
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
const dropA = (inp) => { const now = inp.pressedNow || {}; now.a = false; };

// ================================================================ modals (confirm / pick / info with scrolling)
function modal(o) {
  const m = {
    ...o, idx: o.index || 0, top: 0, scroll: 0, t: 0,
    get n() { return o.kind === 'pick' ? (o.items || []).length : (o.choices || ['OK']).length; },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.n;
      if (o.kind === 'pick') {
        if (inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) { if (o.items[m.idx] && o.items[m.idx].lock) { sfx('buzz'); return; } sfx('ok'); ui.closeModal(m, m.idx); }
        else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, -1); }
        return;
      }
      if (m.maxScroll > 0 && inp.repeat('up')) { m.scroll = Math.max(0, m.scroll - 1); return; }
      if (m.maxScroll > 0 && inp.repeat('down')) { m.scroll = Math.min(m.maxScroll, m.scroll + 1); return; }
      if (inp.repeat('left')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('right')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, o.cancel != null ? o.cancel : (o.choices || ['OK']).length === 1 ? 0 : (o.choices || []).length - 1); }
    },
    tap(ui, tap, inp) {
      dropA(inp);
      for (let i = 0; i < (m.rects || []).length; i++) if (m.rects[i] && inR(tap.x, tap.y, m.rects[i])) { if (m.idx === i || o.kind !== 'pick') { if (o.kind === 'pick' && o.items[i] && o.items[i].lock) { sfx('buzz'); return; } m.idx = i; ui.closeModal(m, i); } else { m.idx = i; sfx('cursor'); } return; }
      if (m.up && inR(tap.x, tap.y, m.up)) { if (o.kind === 'pick') m.idx = Math.max(0, m.idx - 3); else m.scroll = Math.max(0, m.scroll - 3); return; }
      if (m.dn && inR(tap.x, tap.y, m.dn)) { if (o.kind === 'pick') m.idx = Math.min(m.n - 1, m.idx + 3); else m.scroll = Math.min(m.maxScroll, m.scroll + 3); return; }
      if (!inR(tap.x, tap.y, m.box)) ui.closeModal(m, o.kind === 'pick' ? -1 : o.cancel != null ? o.cancel : (o.choices || ['OK']).length - 1);
    },
    draw(ui, c) {
      const w = Math.min(SW - 32, o.w || 480);
      const x = Math.round((SW - w) / 2);
      const lines = [];
      for (const l of o.lines || []) lines.push(...jwrap(c, String(l ?? ''), w - 24, 12));
      const pick = o.kind === 'pick';
      const rh = 26;
      const maxLines = pick ? 5 : 15;
      m.maxScroll = pick ? 0 : Math.max(0, lines.length - maxLines);
      m.scroll = clamp(m.scroll, 0, m.maxScroll);
      const shown = lines.slice(m.scroll, m.scroll + maxLines);
      const maxRows = pick ? Math.min(m.n, Math.max(3, Math.floor((SH - 70 - shown.length * 16) / rh))) : 0;
      const h = 28 + shown.length * 16 + (pick ? maxRows * rh + 8 : 40) + 4;
      const y = Math.round((SH - h) / 2);
      m.box = { x, y, w, h };
      R(c, x, y, w, h, '#150f24');
      R(c, x, y, w, 2, o.color || K.gold);
      R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
      T(c, o.title || '', x + 12, y + 7, 12, o.color || K.gold, 'left', w - 70);
      shown.forEach((l, i) => T(c, l, x + 12, y + 27 + i * 16, 12, K.text, 'left', w - 24));
      m.up = m.dn = null;
      if (m.maxScroll > 0) {
        T(c, `${m.scroll + 1}-${Math.min(lines.length, m.scroll + maxLines)}／${lines.length}行`, x + w - 12, y + 8, 10, K.dim, 'right');
        m.up = { x: x + w - 26, y: y + 24, w: 22, h: 20 }; m.dn = { x: x + w - 26, y: y + 24 + maxLines * 16 - 20, w: 22, h: 20 };
        if (m.scroll > 0) T(c, '▲', x + w - 16, y + 26, 10, K.gold, 'center');
        if (m.scroll < m.maxScroll) T(c, '▼', x + w - 16, y + 24 + maxLines * 16 - 14, 10, K.gold, 'center');
      }
      m.rects = [];
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + maxRows) m.top = m.idx - maxRows + 1;
        const y0 = y + 30 + shown.length * 16;
        for (let k = 0; k < maxRows && m.top + k < m.n; k++) {
          const it = o.items[m.top + k];
          const yy = y0 + k * rh;
          const sel = m.top + k === m.idx;
          R(c, x + 8, yy, w - 16, rh - 2, sel ? K.sel : '#1d1530');
          if (sel) R(c, x + 8, yy, 2, rh - 2, K.gold);
          if (it.color) R(c, x + 12, yy + 4, 4, rh - 10, it.color);
          const rw = it.right ? measure(c, it.right, 10) + 10 : 0;
          const lx = x + (it.color ? 22 : 16);
          T(c, it.label, lx, yy + (it.sub ? 1 : 6), 12, it.lock ? K.faint : K.text, 'left', w - (lx - x) - 16 - rw);
          if (it.sub) T(c, it.sub, lx, yy + 14, 10, it.lock ? K.faint : K.dim, 'left', w - (lx - x) - 16);
          if (it.right) T(c, it.right, x + w - 14, yy + 3, 10, it.rightColor || K.dim, 'right');
          m.rects[m.top + k] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
        }
        if (m.n > maxRows) { T(c, `${m.idx + 1}／${m.n}`, x + w - 12, y + 8, 10, K.dim, 'right'); m.up = { x: x + w - 60, y: y0 - 14, w: 52, h: 14 }; m.dn = { x: x + w - 60, y: y0 + maxRows * rh, w: 52, h: 10 }; }
      } else {
        const ch = o.choices || ['OK'];
        const bw = Math.min(180, Math.floor((w - 24 - (ch.length - 1) * 8) / ch.length));
        const total = ch.length * bw + (ch.length - 1) * 8;
        ch.forEach((lab, i) => {
          const bx = x + Math.round((w - total) / 2) + i * (bw + 8), by = y + h - 34;
          const sel = i === m.idx;
          R(c, bx, by, bw, 26, sel ? K.gold : '#2a1f44');
          T(c, lab, bx + bw / 2, by + 6, 12, sel ? '#1a1206' : K.text, 'center', bw - 8);
          m.rects[i] = { x: bx, y: by, w: bw, h: 26 };
        });
      }
    },
  };
  return m;
}

// ================================================================ the screen
const TABS = [
  { id: 'calendar', label: 'カレンダー' }, { id: 'list', label: '大会一覧' }, { id: 'entries', label: 'エントリー状況' },
  { id: 'results', label: '結果' }, { id: 'history', label: '歴代王者' }, { id: 'news', label: 'ニュース' },
];
const tabIndex = (id) => Math.max(0, TABS.findIndex((t) => t.id === id));
const LIST_Y = 66, ROW_H = 26, LIST_ROWS = 10;
const CAL = { x: 50, y: 64, cw: 29, ch: 21, px: 352 };

function yearEvents(g, Y) {
  // day → [{ id, def, kind: 'entry'|'round'|'final', name, mine, eligible }]
  const out = new Map();
  const add = (d, ev) => { if (!out.has(d)) out.set(d, []); out.get(d).push(ev); };
  const lo = I.dayOfDate(g, Y, 1, 1), hi = I.dayOfDate(g, Y, 12, 10);
  for (const def of Object.values(CONTESTS)) {
    for (const yy of [Y, Y + 1]) {
      const cyc = safe(() => I.cycleOf(g, def, yy), null);
      if (!cyc || !cyc.held) continue;
      const e = I.entryOf(g, def.id, yy);
      const active = e && e.status !== 'withdrawn';
      if (cyc.entry) for (let d = Math.max(lo, cyc.entry.from); d <= Math.min(hi, cyc.entry.to); d++) add(d, { id: def.id, def, year: yy, kind: 'entry', name: d === cyc.entry.from ? 'エントリー開始' : d === cyc.entry.to ? 'エントリー締切' : 'エントリー受付中', mine: false });
      for (const rr of cyc.rounds) for (const o of rr.options) {
        if (o.day < lo || o.day > hi) continue;
        const reached = !!e && (e.status === 'entered' || e.status === 'passed' ? e.round >= rr.idx : (e.results || []).some((x) => x.round === rr.idx));
        const mine = active && reached && num(e.picks && e.picks[rr.idx], 0) === o.k;
        add(o.day, { id: def.id, def, year: yy, kind: rr.idx === cyc.rounds.length - 1 ? 'final' : 'round', name: `${rr.name}${rr.options.length > 1 ? `（${o.venue}）` : ''}`, mine, idx: rr.idx, option: o });
      }
    }
  }
  return out;
}

class ContestScene {
  constructor(g, opts, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isContestUI: true, t: 0, focus: opts && opts.tab ? 'body' : 'tabs', tabIdx: tabIndex(opts && opts.tab), lists: {}, modals: [], toasts: [], busy: 0, tapAt: null, closed: false, filter: 0, dataT: -999, evCache: null });
    bindTap(g);
    const d = I.contestDate(g);
    this.cal = { year: d.year, month: d.month, dom: d.dom };
    this.refresh(true);
  }
  get tab() { return TABS[this.tabIdx]; }
  ls(id = this.tab.id) { return this.lists[id] || (this.lists[id] = { i: 0, top: 0 }); }
  refresh(force = false) {
    if (!force && this.t - this.dataT < 30) return;
    this.dataT = this.t;
    this._rows = safe(() => this.buildRows(), []) || [];
    const st = this.ls();
    if (st.i >= this._rows.length) st.i = Math.max(0, this._rows.length - 1);
  }
  dirty() { this.dataT = -999; this.evCache = null; }
  setTab(i) { this.tabIdx = (i + TABS.length) % TABS.length; this.refresh(true); }
  rows() { return this._rows || []; }
  // ---------------------------------------------------------------- rows per tab
  buildRows() {
    const g = this.g;
    const id = this.tab.id;
    if (id === 'list') {
      const FILTERS = ['すべて', '出られる大会', 'エントリー中', '開催中・受付中'];
      const all = g.contests();
      const rows = [{ filter: true, label: `表示：${FILTERS[this.filter]}（Aで切りかえ）`, sub: `${all.length}大会` }];
      for (const x of all) {
        const el = safe(() => I.eligibilityOf(g, x.id, x.year), { ok: false, why: '' });
        if (this.filter === 1 && !(el.ok && (x.status === 'open' || x.status === 'future'))) continue;
        if (this.filter === 2 && !(x.entry && x.entry.status !== 'withdrawn')) continue;
        if (this.filter === 3 && !(x.status === 'open' || x.status === 'running')) continue;
        rows.push({ c: x, el, label: x.label, color: I.colorOf(x.def) });
      }
      return rows;
    }
    if (id === 'entries') {
      const c = I.cstate(g);
      const out = [];
      for (const cid of Object.keys(c.entries)) for (const y of Object.keys(c.entries[cid] || {})) {
        const e = c.entries[cid][y];
        const def = CONTESTS[cid];
        if (!e || !def) continue;
        out.push({ id: cid, year: Number(y), e, def, cyc: I.cycleOf(g, def, Number(y)), color: I.colorOf(def) });
      }
      for (const def of Object.values(CONTESTS)) {
        if (!I.isSelfRun(def) || out.some((r) => r.id === def.id)) continue;
        const ext = I.externalEntry(g, def);
        if (ext) { const y = ext.year ?? I.seasonYearOf(g, def.id); out.push({ id: def.id, year: y, e: ext, def, cyc: I.cycleOf(g, def, y), color: I.colorOf(def), external: true }); }
      }
      return out.sort((a, b) => b.year - a.year || num(b.e.day) - num(a.e.day));
    }
    if (id === 'results') {
      const c = I.cstate(g);
      const out = [];
      for (const cid of Object.keys(c.entries)) for (const y of Object.keys(c.entries[cid] || {})) {
        const e = c.entries[cid][y];
        const def = CONTESTS[cid];
        if (!e || !def) continue;
        for (const r of e.results || []) out.push({ id: cid, year: Number(y), e, r, def, color: I.colorOf(def) });
      }
      return out.sort((a, b) => num(b.r.day) - num(a.r.day));
    }
    if (id === 'history') return Object.values(CONTESTS).map((def) => ({ def, color: I.colorOf(def) })).sort((a, b) => I.prestigeOf(b.def) - I.prestigeOf(a.def) || String(a.def.name).localeCompare(String(b.def.name), 'ja'));
    if (id === 'news') return I.cstate(g).news.slice(0, 160).map((n) => ({ n }));
    return [];
  }
  // ---------------------------------------------------------------- update / input
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
    if (this.tab.id === 'calendar') { this.updateCal(inp); return; }
    const rows = this.rows();
    const st = this.ls();
    if (inp.repeat('up')) { if (st.i > 0) { st.i--; sfx('cursor'); } else { this.focus = 'tabs'; sfx('cursor'); } return; }
    if (inp.repeat('down')) { if (st.i < rows.length - 1) { st.i++; sfx('cursor'); } return; }
    if (inp.repeat('left')) { this.setTab(this.tabIdx - 1); this.focus = 'tabs'; sfx('cursor'); return; }
    if (inp.repeat('right')) { this.setTab(this.tabIdx + 1); this.focus = 'tabs'; sfx('cursor'); return; }
    if (inp.pressed('a') && rows[st.i]) { sfx('ok'); this.act(() => this.activate(rows[st.i])); }
  }
  moveCal(dd, dm) {
    const c = this.cal;
    let m = c.month + dm, dom = c.dom + dd, y = c.year;
    while (dom > 10) { dom -= 10; m++; }
    while (dom < 1) { dom += 10; m--; }
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    const s0 = I.startYear(this.g);
    if (y < s0 - 1 || y > s0 + 60) return;
    if (y !== c.year) this.evCache = null;
    Object.assign(c, { year: y, month: m, dom });
    sfx('cursor');
  }
  updateCal(inp) {
    if (inp.repeat('left')) { this.moveCal(-1, 0); return; }
    if (inp.repeat('right')) { this.moveCal(1, 0); return; }
    if (inp.repeat('up')) { if (this.cal.month === 1 && this.calTopGuard) { this.focus = 'tabs'; sfx('cursor'); return; } this.moveCal(0, -1); return; }
    if (inp.repeat('down')) { this.moveCal(0, 1); return; }
    if (inp.pressed('a')) { sfx('ok'); this.act(() => this.dayMenu()); }
  }
  events(y = this.cal.year) {
    if (!this.evCache || this.evCache.y !== y || this.evCache.v !== I.cstate(this.g).v) this.evCache = { y, v: I.cstate(this.g).v, map: yearEvents(this.g, y) };
    return this.evCache.map;
  }
  dayOfCal(m = this.cal.month, d = this.cal.dom) { return I.dayOfDate(this.g, this.cal.year, m, d); }
  async dayMenu() {
    const evs = (this.events().get(this.dayOfCal()) || []);
    if (!evs.length) { this.toast('この日に大会の予定はない'); return; }
    const uniq = [];
    const seen = new Set();
    for (const e of evs) { const k = `${e.id}|${e.kind}|${e.name}`; if (!seen.has(k)) { seen.add(k); uniq.push(e); } }
    const k = await this.pick({ title: `${this.cal.year}年${this.cal.month}月${this.cal.dom}日の予定`, items: uniq.map((e) => ({ label: `${I.contestName(e.def, e.year)}　${e.name}`, sub: e.mine ? 'あなたの出番' : e.kind === 'entry' ? '' : '', color: I.colorOf(e.def), right: e.mine ? '★出場' : '', rightColor: K.gold })) });
    if (k >= 0) await this.contestMenu(uniq[k].id);
  }
  handleTap(tap, inp) {
    const { x, y } = tap;
    if (inR(x, y, { x: SW - 24, y: 0, w: 24, h: 20 })) { dropA(inp); sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < TABS.length; i++) if (inR(x, y, this.tabRects && this.tabRects[i])) { dropA(inp); this.focus = 'tabs'; if (i !== this.tabIdx) { this.setTab(i); sfx('cursor'); } return true; }
    if (this.tab.id === 'calendar') {
      if (inR(x, y, this.yPrev)) { dropA(inp); this.cal.year--; this.evCache = null; sfx('cursor'); return true; }
      if (inR(x, y, this.yNext)) { dropA(inp); this.cal.year++; this.evCache = null; sfx('cursor'); return true; }
      if (x >= CAL.x && x < CAL.x + CAL.cw * 10 && y >= CAL.y && y < CAL.y + CAL.ch * 12) {
        const dom = 1 + Math.floor((x - CAL.x) / CAL.cw), m = 1 + Math.floor((y - CAL.y) / CAL.ch);
        this.focus = 'body';
        if (m === this.cal.month && dom === this.cal.dom) return false; // second tap: A (the day's menu)
        dropA(inp); this.cal.month = m; this.cal.dom = dom; sfx('cursor'); return true;
      }
      dropA(inp);
      return true;
    }
    const L = this.listRect;
    if (L && inR(x, y, L)) {
      const rows = this.rows();
      const st = this.ls();
      const j = (st.top || 0) + Math.floor((y - L.y) / ROW_H);
      if (j >= 0 && j < rows.length) { this.focus = 'body'; if (j !== st.i) { st.i = j; dropA(inp); sfx('cursor'); return true; } return false; }
    }
    if (this.scrollUp && inR(x, y, this.scrollUp)) { dropA(inp); const st = this.ls(); st.i = Math.max(0, st.i - LIST_ROWS); return true; }
    if (this.scrollDn && inR(x, y, this.scrollDn)) { dropA(inp); const st = this.ls(); st.i = Math.min(this.rows().length - 1, st.i + LIST_ROWS); return true; }
    dropA(inp);
    return true;
  }
  async act(fn) { this.busy++; try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); this.dirty(); this.refresh(true); } }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { return this.openModal(modal({ ...o, kind: 'confirm' })); }
  pick(o) { return this.openModal(modal({ ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { return this.openModal(modal({ title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
  toast(s, color = K.gold) { this.toasts.unshift({ text: String(s), t: 0, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  close() {
    if (this.closed) return;
    this.closed = true;
    for (const m of this.modals.splice(0)) m._res(null);
    this.g.pop(this);
    this.resolve(null);
  }
  // ---------------------------------------------------------------- actions
  async activate(row) {
    const id = this.tab.id;
    if (id === 'list') {
      if (row.filter) { this.filter = (this.filter + 1) % 4; this.ls().i = 0; return; }
      await this.contestMenu(row.c.id);
    } else if (id === 'entries') await this.contestMenu(row.id, row.year);
    else if (id === 'results') await showResult(this.g, row.id, row.year, row.r.round, this);
    else if (id === 'history') await this.historyOf(row.def.id);
    else if (id === 'news') await this.info(`${row.n.day}日目のニュース`, String(row.n.text).split('\n'), { color: K.pink });
  }
  async historyOf(id) {
    const g = this.g;
    const def = CONTESTS[id];
    const rows = g.contestHistory(id, { all: true });
    const h = def.history || {};
    const head = [`${I.contestName(def, I.contestDate(g).year)}（${num(h.founded) ? `${h.founded}年創設` : ''}${h.ended ? `・${h.ended}年終了${def.revive !== false ? '→復刻開催' : ''}` : ''}）`];
    if (!rows.length) { await this.info('歴代王者', [...head, '', 'まだ一度も開催されていない。']); return; }
    const items = rows.map((r) => (r.held ? { label: `${r.year}年 ${r.label || ''}`, sub: `優勝：${r.champion || '—'}${r.runnerUp ? `／準優勝：${r.runnerUp}` : ''}`, right: r.playerPlace ? `あなた${r.playerPlace}位` : r.revival ? '復刻' : '', rightColor: r.playerPlace === 1 ? K.gold : K.dim } : { label: `${r.year}年`, sub: r.note || '開催なし', lock: true }));
    await this.pick({ title: `歴代王者：${def.short || def.name}`, lines: head, items, w: 560 });
  }
  async contestMenu(id, year) {
    const g = this.g;
    const def = CONTESTS[id];
    if (!def) return;
    for (;;) {
      const info = I.contestInfo(g, id);
      const y = year ?? info.year;
      const cyc = I.cycleOf(g, def, y);
      const e = I.entryOf(g, id, y);
      const el = I.eligibilityOf(g, id, y);
      const due = I.dueOn(g).filter((d) => d.id === id);
      const self = I.isSelfRun(def);
      const ext = self ? I.externalEntry(g, def) : null;
      const items = [];
      items.push({ id: 'info', label: 'くわしく見る', sub: 'ルール・出場資格・日程・賞金' });
      if (self && info.today && info.today.length && typeof def.flow === 'function') items.push({ id: 'selfgo', label: `今日の予定：${info.today[0].label || ''}`, sub: info.today.length > 1 ? `ほか${info.today.length - 1}件` : '', color: K.gold });
      if (due.length) items.push({ id: 'go', label: '会場へ向かう', sub: `${due[0].revival ? '敗者復活戦' : cyc.rounds[due[0].idx].name}（${due[0].option.venue}会場）`, color: K.gold });
      const inv = I.cstate(g).invites && I.cstate(g).invites[id] && I.cstate(g).invites[id][y] > 0;
      if (!e && !ext && cyc.held && !cyc.invite) items.push({ id: 'enter', label: 'エントリーする', sub: info.status === 'open' ? (el.ok ? `参加費 ${I.feeOf(g, id, y).text}` : el.why) : info.status === 'future' && cyc.entry ? `受付は${I.dateText(g, cyc.entry.from)}から` : '受付期間外', lock: info.status !== 'open' || !el.ok });
      if (!e && cyc.invite && inv) items.push({ id: 'enter', label: '出場のお願いに返事する', sub: '招待が届いている', color: K.gold });
      if (e && (e.status === 'entered' || e.status === 'passed')) items.push({ id: 'resched', label: '日程・会場を変える', sub: '次の回戦の日程が複数あるとき' });
      if (cyc.held) items.push({ id: 'odds', label: '見込みを調べる', sub: '自分の実力と、通過ラインの目安' });
      items.push({ id: 'hist', label: '歴代王者', sub: '歴代のチャンピオン' });
      if (e && (e.status === 'entered' || e.status === 'passed')) items.push({ id: 'quit', label: 'エントリーを取り消す（辞退）', sub: '参加費はもどらない' });
      items.push({ id: 'back', label: 'もどる' });
      const en = e || ext;
      const k = await this.pick({ title: info.label, lines: [`${info.statusLabel}${en ? `　エントリーNo.${en.no}（${en.external ? en.statusText || ENTRY_LABEL[en.status] || '' : ENTRY_LABEL[en.status] || ''}）` : ''}`], items, color: I.colorOf(def) });
      if (k < 0 || items[k].id === 'back') return;
      const a = items[k].id;
      if (a === 'info') await this.info(info.label, detailLines(g, id, y), { color: I.colorOf(def), w: 560 });
      else if (a === 'hist') await this.historyOf(id);
      else if (a === 'odds') { const o = g.contestOdds(id, e ? e.round : 0); await this.info('見込み', o ? [`あなたの実力（推定）：${o.power}　ネタの出来：${o.quality}`, `本番の得点の目安：${o.mean}点前後`, `${o.round}の通過ライン（推定）：${o.cut}点`, o.text, '', '※ 実力は相方・稽古・場数で伸びる。ネタの出来は台本と練習で上がる。'] : ['この大会の見込みは出せない。']); }
      else if (a === 'enter') { if (g.auto && !g.auto.contestui) return; await g.enterContest(id); this.dirty(); }
      else if (a === 'go') { this.close(); if (has(g, 'contestGo')) { if (activePhone(g)) closePhoneThen(g, (gg) => gg.contestGo(id)); else g.run(() => g.contestGo(id)); } return; }
      else if (a === 'selfgo') { this.close(); const run = (gg) => def.flow(gg, { id, def, year: y, edition: info.edition, revival: info.revival, entry: null, round: null, date: I.contestDate(gg), mode: 'full' }); if (activePhone(g)) closePhoneThen(g, run); else g.run(run); return; }
      else if (a === 'resched') await reschedule(g, id, y, this);
      else if (a === 'quit') { const q = await this.confirm({ title: 'エントリーの取り消し', lines: ['本当に辞退する？（参加費はもどらない）'], choices: ['辞退する', 'やめる'], index: 1 }); if (q === 0) { const en = I.entryOf(g, id, y); if (en) { en.status = 'withdrawn'; en.results.push({ round: en.round, passed: false, withdrawn: true, day: I.todayOf(g), note: '辞退' }); I.bump(g, id, y); this.toast('辞退した'); } } }
    }
  }
  // ---------------------------------------------------------------- drawing
  draw(c, g) {
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, '賞レース', 8, 3, 12, K.gold);
    const d = I.contestDate(g);
    T(c, `${d.year}年（${I.wareki(d.year, d.month)}）${d.month}月${d.dom}日　${I.todayOf(g)}日目`, 80, 4, 10, K.dim, 'left', 300);
    const dueN = I.dueOn(g).length;
    if (dueN) T(c, `今日は本番の日！（${dueN}件）`, SW - 30, 4, 10, K.gold, 'right', 220);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    this.tabRects = [];
    const tw = Math.floor(SW / TABS.length);
    TABS.forEach((tb, i) => {
      const x = i * tw, on = i === this.tabIdx;
      R(c, x + 1, 21, tw - 2, 18, on ? (this.focus === 'tabs' ? K.gold : K.panel2) : '#150f24');
      T(c, tb.label, x + tw / 2, 24, 12, on && this.focus === 'tabs' ? '#1a1206' : on ? K.gold : K.text, 'center', tw - 8);
      this.tabRects.push({ x, y: 20, w: tw, h: 20 });
    });
    this.listRect = null; this.scrollUp = this.scrollDn = null; this.yPrev = this.yNext = null;
    try { if (this.tab.id === 'calendar') this.drawCal(c, g); else this.drawList(c, g); } catch (e) { console.error(e); }
    // footer: hint + news ticker
    R(c, 0, 336, SW, 24, '#0a0712');
    R(c, 0, 336, SW, 1, K.edge);
    const news = I.cstate(g).news.slice(0, 6).map((n) => String(n.text).split('\n')[0]).join('　◆　') || '賞レースのニュースはまだない。';
    const tw2 = measure(c, news, 10) + 80;
    const off = (this.t * 0.6) % Math.max(1, tw2);
    c.save(); c.beginPath(); c.rect(0, 337, 430, 22); c.clip();
    T(c, news, 8 - off, 343, 10, K.text); T(c, news, 8 - off + tw2, 343, 10, K.text);
    c.restore();
    R(c, 434, 338, 1, 20, K.edge);
    T(c, this.focus === 'tabs' ? '←→タブ　↓決定　B閉じる' : this.tab.id === 'calendar' ? '十字で日付　A予定　Bタブへ' : '↑↓選ぶ　A決定　Bタブへ', SW - 6, 343, 10, K.dim, 'right', 196);
    this.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, 12) + 20); R(c, (SW - w) / 2, 300 - i * 22, w, 20, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * 22, 12, t.color, 'center', w - 10); });
    for (const m of this.modals) { R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)'); m.draw(this, c); }
  }
  drawCal(c, g) {
    const cal = this.cal;
    const evs = this.events();
    const today = I.todayOf(g);
    // year bar
    const yl = `${cal.year}年（${I.wareki(cal.year)}）`;
    T(c, '‹', CAL.x + 8, 45, 14, K.gold, 'center');
    T(c, yl, CAL.x + CAL.cw * 5, 46, 12, K.text, 'center', 220);
    T(c, '›', CAL.x + CAL.cw * 10 - 8, 45, 14, K.gold, 'center');
    this.yPrev = { x: CAL.x - 4, y: 42, w: 28, h: 20 }; this.yNext = { x: CAL.x + CAL.cw * 10 - 24, y: 42, w: 28, h: 20 };
    for (let m = 1; m <= 12; m++) {
      const y = CAL.y + (m - 1) * CAL.ch;
      T(c, `${m}月`, CAL.x - 6, y + 4, 10, m === cal.month ? K.gold : K.dim, 'right');
      for (let d = 1; d <= 10; d++) {
        const x = CAL.x + (d - 1) * CAL.cw;
        const day = I.dayOfDate(g, cal.year, m, d);
        const list = evs.get(day) || [];
        const mine = list.some((e) => e.mine);
        R(c, x, y, CAL.cw - 1, CAL.ch - 1, mine ? '#4a3a10' : (m % 2 ? '#1a1430' : '#1e1736'));
        if (day < 1) R(c, x, y, CAL.cw - 1, CAL.ch - 1, 'rgba(0,0,0,0.35)');
        T(c, String(d), x + 2, y + 1, 10, day === today ? K.cyan : K.faint);
        // markers: entry windows (bottom line), rounds (dots), finals (gold square)
        const entries = list.filter((e) => e.kind === 'entry');
        if (entries.length) R(c, x + 1, y + CAL.ch - 4, CAL.cw - 3, 2, entries.some((e) => I.entryOf(g, e.id, e.year)) ? K.good : '#3a6a8a');
        const rounds = list.filter((e) => e.kind !== 'entry');
        rounds.slice(0, 6).forEach((e, k) => R(c, x + 2 + (k % 3) * 8 + (k >= 3 ? 4 : 0), y + 10 + (k >= 3 ? -0 : 0) + (k >= 3 ? 4 : 0), 5, 4, e.kind === 'final' ? K.gold : I.colorOf(e.def)));
        if (rounds.length > 6) T(c, '+', x + CAL.cw - 6, y + 1, 10, K.dim);
        if (day === today) { R(c, x, y, CAL.cw - 1, 1, K.cyan); R(c, x, y + CAL.ch - 2, CAL.cw - 1, 1, K.cyan); R(c, x, y, 1, CAL.ch - 1, K.cyan); R(c, x + CAL.cw - 2, y, 1, CAL.ch - 1, K.cyan); }
        if (m === cal.month && d === cal.dom) { const col = this.focus === 'body' ? K.gold : K.edgeHi; R(c, x - 1, y - 1, CAL.cw + 1, 2, col); R(c, x - 1, y + CAL.ch - 2, CAL.cw + 1, 2, col); R(c, x - 1, y - 1, 2, CAL.ch + 1, col); R(c, x + CAL.cw - 2, y - 1, 2, CAL.ch + 1, col); }
      }
    }
    // legend
    const ly = CAL.y + CAL.ch * 12 + 4;
    R(c, CAL.x, ly + 4, 10, 2, '#3a6a8a'); T(c, '受付期間', CAL.x + 14, ly, 10, K.dim);
    R(c, CAL.x + 70, ly + 2, 5, 4, '#c0392b'); T(c, '予選', CAL.x + 80, ly, 10, K.dim);
    R(c, CAL.x + 116, ly + 2, 5, 4, K.gold); T(c, '決勝', CAL.x + 126, ly, 10, K.dim);
    R(c, CAL.x + 162, ly, 10, 9, '#4a3a10'); T(c, 'あなたの出番', CAL.x + 176, ly, 10, K.dim);
    // the day's panel
    const px = CAL.px, pw = SW - px - 8;
    R(c, px, 44, pw, 288, K.panel); R(c, px, 44, pw, 1, K.edgeHi);
    const day = this.dayOfCal();
    T(c, `${cal.year}年${cal.month}月${cal.dom}日${day === today ? '（今日）' : day < today ? '' : day - today <= 30 ? `（${day - today}日後）` : ''}`, px + 8, 50, 12, K.gold, 'left', pw - 16);
    const list = (evs.get(day) || []).slice();
    list.sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || (a.kind === 'entry' ? 1 : 0) - (b.kind === 'entry' ? 1 : 0));
    const seen = new Set();
    const uniq = list.filter((e) => { const k = `${e.id}|${e.kind}|${e.name}`; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!uniq.length) T(c, 'この日は大会の予定がない。', px + 8, 74, 12, K.dim, 'left', pw - 16);
    const maxRows = 12;
    uniq.slice(0, maxRows).forEach((e, i) => {
      const y = 70 + i * 21;
      R(c, px + 6, y, 4, 17, e.kind === 'final' ? K.gold : I.colorOf(e.def));
      if (e.mine) R(c, px + 12, y, pw - 18, 17, '#3a2e10');
      T(c, `${e.def.short || I.contestName(e.def, e.year)}`, px + 14, y + 2, 12, e.mine ? K.gold : K.text, 'left', 110);
      T(c, e.name + (e.mine ? '★' : ''), px + pw - 8, y + 3, 10, e.kind === 'entry' ? K.dim : K.text, 'right', pw - 136);
    });
    if (uniq.length > maxRows) T(c, `ほか${uniq.length - maxRows}件（Aで一覧）`, px + 8, 70 + maxRows * 21, 10, K.dim, 'left', pw - 16);
  }
  drawList(c, g) {
    const rows = this.rows();
    const st = this.ls();
    const id = this.tab.id;
    // column header
    const heads = { list: ['大会', 'つぎの日程', '状態'], entries: ['大会・エントリー', 'つぎ', '状態'], results: ['大会・回戦', '結果', ''], history: ['大会', '直近の王者', ''], news: ['ニュース', '', '日'] };
    const hd = heads[id] || ['', '', ''];
    R(c, 6, 44, SW - 12, 18, K.panel2);
    T(c, hd[0], 14, 47, 10, K.dim); T(c, hd[1], 400, 47, 10, K.dim); T(c, hd[2], SW - 14, 47, 10, K.dim, 'right');
    if (!rows.length) {
      const empty = { entries: 'まだどの大会にもエントリーしていない。\n「大会一覧」から、出られる大会を探そう。', results: 'まだ結果はない。', news: '賞レースのニュースはまだない。' }[id] || '（なし）';
      jwrap(c, empty, SW - 60, 12).forEach((l, i) => T(c, l, 30, 80 + i * 18, 12, K.dim));
      return;
    }
    if (st.i < st.top) st.top = st.i;
    if (st.i >= st.top + LIST_ROWS) st.top = st.i - LIST_ROWS + 1;
    st.top = clamp(st.top, 0, Math.max(0, rows.length - LIST_ROWS));
    this.listRect = { x: 6, y: LIST_Y, w: SW - 12, h: LIST_ROWS * ROW_H };
    for (let k = 0; k < LIST_ROWS && st.top + k < rows.length; k++) {
      const i = st.top + k;
      const row = rows[i];
      const y = LIST_Y + k * ROW_H;
      const sel = i === st.i && this.focus === 'body';
      R(c, 6, y, SW - 12, ROW_H - 2, sel ? K.sel : k % 2 ? '#171127' : '#1a132c');
      if (sel) R(c, 6, y, 2, ROW_H - 2, K.gold);
      if (row.color) R(c, 10, y + 4, 4, ROW_H - 10, row.color);
      try { this.drawRow(c, g, id, row, y, sel); } catch (e) { console.error(e); }
    }
    if (rows.length > LIST_ROWS) {
      const h = LIST_ROWS * ROW_H;
      const bh = Math.max(12, (h * LIST_ROWS) / rows.length);
      R(c, SW - 5, LIST_Y, 2, h, '#2a2040');
      R(c, SW - 5, LIST_Y + ((h - bh) * st.top) / Math.max(1, rows.length - LIST_ROWS), 2, bh, K.edgeHi);
      T(c, `${st.i + 1}／${rows.length}`, SW - 12, LIST_Y + h + 2, 10, K.dim, 'right');
      this.scrollUp = { x: SW - 40, y: LIST_Y - 20, w: 34, h: 18 }; this.scrollDn = { x: SW - 80, y: LIST_Y + h, w: 74, h: 14 };
    }
  }
  drawRow(c, g, id, row, y) {
    const today = I.todayOf(g);
    if (id === 'list') {
      if (row.filter) { T(c, row.label, 20, y + 6, 12, K.cyan, 'left', 400); T(c, row.sub, SW - 14, y + 7, 10, K.dim, 'right'); return; }
      const x = row.c;
      const scol = STATUS_COL[x.status] || '#5a5a6a';
      const sw = chip(c, x.statusLabel.length > 10 ? x.statusLabel.slice(0, 9) + '…' : x.statusLabel, SW - 12, y + 5, scol, 10, 'right');
      const nr = x.nextRound;
      const nx = nr ? `${nr.name} ${nr.day === today ? '今日' : I.dateText(g, nr.day)}` : '';
      T(c, nx, 400, y + 7, 10, nr && nr.day === today && x.entry ? K.gold : K.dim, 'left', SW - 400 - sw - 20);
      const mark = x.entry && x.entry.status !== 'withdrawn' ? '★' : row.el.ok ? '○' : x.invite ? '招' : '×';
      T(c, mark, 22, y + 6, 12, mark === '★' ? K.gold : mark === '○' ? K.good : K.faint);
      T(c, x.label, 38, y + 2, 12, x.status === 'notyet' || x.status === 'closed' ? K.dim : K.text, 'left', 352);
      T(c, `${I.KIND_LABEL[I.kindOf(x.def)] || ''}${x.def.broadcaster ? `・${x.def.broadcaster}` : ''}${row.el.ok ? '' : `・${row.el.why}`}`, 38, y + 13, 10, row.el.ok ? K.dim : K.faint, 'left', 352);
      return;
    }
    if (id === 'entries') {
      const { e, cyc, def } = row;
      const col = ENTRY_COL[e.status] || '#5a5a6a';
      const sw = chip(c, ENTRY_LABEL[e.status] || e.status, SW - 12, y + 5, col, 10, 'right');
      T(c, `${cyc ? cyc.label : def.name}`, 22, y + 2, 12, K.text, 'left', 360);
      T(c, `No.${e.no}　${e.unitName}`, 22, y + 14, 10, K.dim, 'left', 360);
      let nx = '';
      if (e.external) nx = `${e.roundName || ''}${e.next && Number.isFinite(Number(e.next.day)) ? ` ${Number(e.next.day) === today ? '今日' : I.dateText(g, Number(e.next.day))} ${e.next.city || ''}` : ''}`;
      else if ((e.status === 'entered' || e.status === 'passed') && cyc && cyc.rounds[e.round]) { const rr = cyc.rounds[e.round]; const o = rr.options[num(e.picks && e.picks[e.round], 0)] || rr.options[0]; nx = `${rr.name} ${o.day === today ? '今日' : I.dateText(g, o.day)} ${o.venue}`; }
      else if (e.pending) nx = '結果待ち';
      else if (e.final) nx = `決勝 ${e.final.place}位`;
      T(c, nx, 392, y + 7, 10, nx.includes('今日') ? K.gold : K.dim, 'left', SW - 392 - sw - 20);
      return;
    }
    if (id === 'results') {
      const { r, def, year, e } = row;
      const cyc = I.cycleOf(g, def, year);
      const rr = cyc && cyc.rounds[r.round];
      T(c, `${cyc ? cyc.label : def.name}`, 22, y + 2, 12, K.text, 'left', 360);
      T(c, `${r.revival ? '敗者復活戦' : rr ? rr.name : ''}　${r.day ? `${r.day}日目` : ''}　No.${e.no}`, 22, y + 14, 10, K.dim, 'left', 360);
      const res = r.withdrawn ? '棄権' : r.passed ? (rr && rr.idx === cyc.rounds.length - 1 ? '優勝' : '合格') : r.place && rr && rr.idx === cyc.rounds.length - 1 ? `${r.place}位` : '不合格';
      chip(c, res, SW - 12, y + 5, r.withdrawn ? '#6a6a7a' : r.passed ? '#3fb86a' : '#a05060', 10, 'right');
      if (r.place && r.of && !r.withdrawn) T(c, `${Math.round(r.of).toLocaleString('ja-JP')}組中 ${Math.round(r.place).toLocaleString('ja-JP')}位${r.of > 60 ? '前後' : ''}`, 392, y + 7, 10, K.dim, 'left', 160);
      return;
    }
    if (id === 'history') {
      const { def } = row;
      const h = def.history || {};
      T(c, I.contestName(def, I.contestDate(g).year), 22, y + 2, 12, K.text, 'left', 360);
      T(c, `${num(h.founded) ? `${h.founded}年創設` : ''}${h.ended ? `・${h.ended}年終了` : ''}　${I.KIND_LABEL[I.kindOf(def)] || ''}`, 22, y + 14, 10, K.dim, 'left', 360);
      const last = (this._lastChamp || (this._lastChamp = new Map()));
      if (!last.has(def.id)) last.set(def.id, safe(() => { const hs = g.contestHistory(def.id); return hs[0] ? `${hs[0].year} ${hs[0].champion}` : '—'; }, '—'));
      T(c, last.get(def.id), 392, y + 7, 10, K.dim, 'left', SW - 404);
      return;
    }
    if (id === 'news') {
      const n = row.n;
      T(c, String(n.text).split('\n')[0], 22, y + 2, 12, n.kind === 'personal' ? K.gold : K.text, 'left', SW - 100);
      T(c, String(n.text).split('\n')[1] || '', 22, y + 14, 10, K.dim, 'left', SW - 100);
      T(c, `${n.day}日目`, SW - 12, y + 7, 10, K.dim, 'right');
    }
  }
}

// ================================================================ shared detail text
export function detailLines(g, id, year) {
  const def = CONTESTS[id];
  const y = year ?? I.seasonYearOf(g, id);
  const cyc = I.cycleOf(g, def, y);
  const el = I.eligibilityOf(g, id, y);
  const fee = I.feeOf(g, id, y);
  const prize = I.prizeOf(def, y);
  const h = def.history || {};
  const L = [];
  L.push(`${I.KIND_LABEL[I.kindOf(def)] || ''}の大会${def.organizer ? `／主催：${def.organizer}` : ''}${def.broadcaster ? `／放送：${def.broadcaster}` : ''}`);
  L.push(`${num(h.founded) ? `${h.founded}年創設` : ''}${h.ended ? `・${h.ended}年終了${def.revive !== false ? '（復刻開催）' : ''}` : ''}${Array.isArray(h.gaps) && h.gaps.length ? `・休止 ${h.gaps.map((x) => `${x[0]}〜${x[1] ?? x[0]}年`).join('、')}` : ''}${h.note ? `／${h.note}` : ''}`);
  if (cyc.notyet) L.push(cyc.note);
  else if (!cyc.held) L.push(cyc.note || 'この年は開催されない');
  L.push('');
  L.push(`【出場資格】${el.notes.join('／') || '特になし'}`);
  if (el.ok) L.push('→ あなたは出場できる'); else el.reasons.forEach((r) => L.push(`→ ×${r.text}`));
  L.push(`【参加費】${fee.text}　【賞金】${prize.text || 'なし'}`);
  if (cyc.held) {
    L.push('');
    L.push(`【日程】${cyc.label}`);
    if (cyc.entry) L.push(`エントリー：${I.dateText(g, cyc.entry.from, { year: true })}〜${I.dateText(g, cyc.entry.to)}`);
    for (const rr of cyc.rounds) {
      const r = rr.r;
      const pass = r.pass == null ? '' : num(r.pass) < 1 ? `通過 約${Math.round(num(r.pass) * 100)}%` : `通過 ${r.pass}組`;
      const fmt = [r.judge === 'panel' ? `審査員${num(r.judges) ? `${r.judges}人` : ''}` : r.judge === 'audience' ? '観客投票' : r.judge === 'vote' ? '投票' : r.judge === 'points' ? '採点' : '', r.scoring || '', r.length ? `持ち時間${r.length >= 60 ? `${Math.floor(r.length / 60)}分${r.length % 60 ? `${r.length % 60}秒` : ''}` : `${r.length}秒`}` : ''].filter(Boolean).join('・');
      const dates = rr.options.length > 1 ? `${I.dateText(g, rr.first)}〜${I.dateText(g, rr.last)}（${[...new Set(rr.options.map((o) => o.venue))].join('・')}）` : `${I.dateText(g, rr.first)}（${rr.options[0].venue}）`;
      L.push(`・${rr.name}：${dates}${r.field ? `　出場 約${num(r.field).toLocaleString('ja-JP')}組` : ''}${pass ? `　${pass}` : ''}`);
      if (fmt) L.push(`　${fmt}${r.revival ? `　※${r.revivalName || '敗者復活戦'}あり` : ''}${r.stage2 ? `　※${r.stage2.name || '最終決戦'}あり` : ''}${r.tv ? '　（テレビ放送）' : ''}`);
    }
  }
  const o = cyc.held ? safe(() => g.contestOdds(id, 0), null) : null;
  if (o) { L.push(''); L.push(`【見込み】あなたの実力（推定）${o.power}・ネタ${o.quality}`); L.push(o.text); }
  return L;
}
async function reschedule(g, id, year, ui) {
  const def = CONTESTS[id];
  const cyc = I.cycleOf(g, def, year);
  const e = I.entryOf(g, id, year);
  if (!e || !cyc.rounds[e.round]) return;
  const rr = cyc.rounds[e.round];
  const fut = rr.options.filter((o) => o.day > I.todayOf(g));
  if (fut.length < 2) { await (ui ? ui.info('日程の変更', ['この回戦の日程は、変えられない。']) : phoneInfo(g, { title: '日程の変更', lines: ['この回戦の日程は、変えられない。'] })); return; }
  const items = fut.map((o) => ({ label: `${I.dateText(g, o.day)}　${o.venue}会場`, sub: I.dueOn(g, o.day).some((d) => d.id !== id) ? '※ 別の大会と重なっている' : '', right: num(e.picks && e.picks[e.round], 0) === o.k ? 'いまの予定' : '', rightColor: K.gold }));
  const k = ui ? await ui.pick({ title: `${rr.name}の日程・会場`, items }) : await phoneList(g, { title: `${rr.name}の日程`, items: items.map((x) => ({ label: x.label, sub: x.sub, right: x.right })) });
  if (k < 0) return;
  e.picks = e.picks || {};
  e.picks[e.round] = fut[k].k;
  I.bump(g, id, year);
  if (ui) ui.toast(`${I.dateText(g, fut[k].day)}（${fut[k].venue}）に変えた`);
}
// A stored round result, again (the 結果 tab / the phone)
async function showResult(g, id, year, idx, ui) {
  const def = CONTESTS[id];
  const cyc = I.cycleOf(g, def, year);
  const res = I.resultsOf(g, id, year);
  const e = I.entryOf(g, id, year);
  const rd = res && res.rounds[idx];
  const rr = cyc.rounds[idx];
  if (!rd || !rr) { if (ui) await ui.info('結果', ['くわしい記録は残っていない。']); return; }
  const last = idx === cyc.rounds.length - 1;
  if (last && res.final) { await openScene(g, (gg, done) => new BoardScene(gg, { title: cyc.label, sub: `${rr.name} 最終順位`, ranking: res.final.ranking, color: I.colorOf(def), champion: res.final.place === 1 }, done)); return; }
  await openScene(g, (gg, done) => new BoardScene(gg, { title: cyc.label, sub: `${rr.name}${rr.options[rd.opt ?? 0] ? ` ${rr.options[rd.opt ?? 0].venue}会場` : ''} 合格者`, numbers: rd.numbers || [], mine: e ? e.no : null, passed: !!rd.passed, place: rd.place, of: rd.of, exact: !!rd.exact, color: I.colorOf(def), reasons: rd.reasons || [] }, done));
}

// ================================================================ scenes: entry form, stamp, board, scoreboard, votes
function openScene(g, make) {
  if (!g || (g.auto && !g.auto.contestui)) return Promise.resolve(null);
  bindTap(g);
  return new Promise((resolve) => { const sc = make(g, (v) => { if (sc.closed) return; sc.closed = true; g.pop(sc); g.input.consume(); resolve(v); }); g.push(sc); });
}
const PAPER = '#fbf6ea', INK = '#2a2430', RED = '#c0392b';
class FormScene {
  constructor(g, o, done) {
    Object.assign(this, { g, o, done, hd: true, opaque: true, hidesHud: true, isContestUI: true, t: 0, idx: 0, tapAt: null, busy: 0, closed: false });
    const f = o.form;
    this.f = { ...f, pick: o.options[0].k, kindIdx: 0 };
    this.fields = [
      { key: 'unitName', label: o.form.members > 1 ? 'コンビ名（グループ名）' : '芸名', edit: { max: 16, title: o.form.members > 1 ? 'コンビ名' : '芸名' } },
      { key: 'kana', label: 'フリガナ', edit: { max: 20, title: 'フリガナ（カタカナ）', placeholder: 'ドットソウボーイズ' } },
      { key: 'rep', label: '代表者名', edit: { max: 12, title: '代表者名' } },
      { key: 'formed', label: '結成年月' },
      { key: 'agency', label: '所属' },
      { key: 'members', label: '人数', fmt: (v) => `${v}名${o.form.memberNames && o.form.memberNames.length ? `（${o.form.memberNames.join('・')}）` : ''}` },
      { key: 'kinds', label: 'ネタの種類', cycle: o.kinds },
      { key: 'title', label: 'ネタのタイトル（任意）', edit: { max: 16, title: 'ネタのタイトル（任意）', placeholder: '例：引っ越しのあいさつ' } },
      { key: 'pick', label: `${o.cyc.rounds[0].name}の日程・会場`, opts: true },
      { key: 'fee', label: '参加費', fmt: () => o.fee.text },
    ];
    this.buttons = ['提出する', 'やめる'];
  }
  rowsN() { return this.fields.length + 1; }
  update(g) {
    this.t++;
    const inp = g.input;
    const tap = this.tapAt; this.tapAt = null;
    if (this.t < 4 || this.busy) return;
    if (tap) {
      dropA(inp);
      for (let i = 0; i < (this.rects || []).length; i++) if (inR(tap.x, tap.y, this.rects[i])) { if (this.idx === i) this.activate(); else { this.idx = i; sfx('cursor'); } return; }
      for (let i = 0; i < 2; i++) if (inR(tap.x, tap.y, this.btnRects && this.btnRects[i])) { this.idx = this.fields.length; this.btn = i; this.activate(); return; }
      if (this.optL && inR(tap.x, tap.y, this.optL)) { this.idx = this.fields.indexOf(this.fields.find((x) => x.opts)); this.cycleOpt(-1); return; }
      if (this.optR && inR(tap.x, tap.y, this.optR)) { this.idx = this.fields.indexOf(this.fields.find((x) => x.opts)); this.cycleOpt(1); return; }
      return;
    }
    const n = this.rowsN();
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
    else if (inp.repeat('left') || inp.repeat('right')) {
      const d = inp.repeat('left') ? -1 : 1;
      if (this.idx === this.fields.length) { this.btn = ((this.btn || 0) + 1) % 2; sfx('cursor'); }
      else this.cycleOpt(d);
    } else if (inp.pressed('a')) this.activate();
    else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); this.done(null); }
  }
  cycleOpt(d) {
    const fd = this.fields[this.idx];
    if (!fd) return;
    if (fd.opts) { const os = this.o.options; const i = os.findIndex((o) => o.k === this.f.pick); this.f.pick = os[(i + d + os.length) % os.length].k; sfx('cursor'); }
    else if (fd.cycle && fd.cycle.length > 1) { this.f.kindIdx = (this.f.kindIdx + d + fd.cycle.length) % fd.cycle.length; this.f.kinds = fd.cycle[this.f.kindIdx]; sfx('cursor'); }
  }
  async activate() {
    if (this.idx === this.fields.length) {
      if ((this.btn || 0) === 1) { sfx('cancel'); this.done(null); return; }
      if (!String(this.f.unitName || '').trim()) { sfx('buzz'); return; }
      sfx('ok');
      this.done({ ...this.f });
      return;
    }
    const fd = this.fields[this.idx];
    if (fd.edit) {
      this.busy++;
      try {
        const { askText } = await import('./textinput.js');
        const v = await askText(this.g, { title: fd.edit.title, value: String(this.f[fd.key] || ''), max: fd.edit.max, placeholder: fd.edit.placeholder || '' });
        if (v != null) this.f[fd.key] = v;
      } catch (e) { console.error(e); } finally { this.busy--; }
      return;
    }
    if (fd.opts || fd.cycle) { this.cycleOpt(1); return; }
    sfx('buzz');
  }
  draw(c, g) {
    R(c, 0, 0, SW, SH, '#2a2032');
    for (let i = 0; i < 30; i++) R(c, (i * 97) % SW, (i * 53) % SH, 2, 2, '#3a2e44');
    const x = 70, y = 10, w = SW - 140, h = SH - 20;
    R(c, x + 4, y + 4, w, h, 'rgba(0,0,0,0.4)');
    R(c, x, y, w, h, PAPER);
    R(c, x, y, w, 3, RED);
    T(c, 'エントリー用紙', x + 14, y + 8, 16, INK);
    T(c, this.o.title, x + w - 14, y + 12, 12, RED, 'right', w - 170);
    R(c, x + 10, y + 30, w - 20, 1, RED);
    this.rects = [];
    const rh = 22, x1 = x + 14, xv = x + 190, y0 = y + 36;
    this.optL = this.optR = null;
    this.fields.forEach((fd, i) => {
      const yy = y0 + i * rh;
      const sel = i === this.idx;
      if (sel) R(c, x + 8, yy, w - 16, rh - 2, '#ffe9a8');
      R(c, x + 8, yy + rh - 2, w - 16, 1, '#e0d3b8');
      T(c, fd.label, x1, yy + 4, 12, '#6a5a4a', 'left', 170);
      let v;
      if (fd.opts) { const o = this.o.options.find((q) => q.k === this.f.pick) || this.o.options[0]; v = `${I.dateText(g, o.day)}　${o.venue}会場`; }
      else if (fd.fmt) v = fd.fmt(this.f[fd.key]);
      else v = String(this.f[fd.key] ?? '');
      const editable = !!(fd.edit || fd.opts || (fd.cycle && fd.cycle.length > 1));
      const right = fd.opts && this.o.options.length > 1 ? 40 : 6;
      T(c, v || (fd.edit ? '（未記入）' : '—'), xv, yy + 4, 12, v ? INK : '#a89a88', 'left', x + w - xv - right - 30);
      if (editable) T(c, fd.edit ? '✎' : '⇄', x + w - 14, yy + 4, 12, sel ? RED : '#b8a890', 'right');
      if (fd.opts && this.o.options.length > 1) { T(c, '‹', x + w - 48, yy + 2, 14, RED, 'center'); T(c, '›', x + w - 32, yy + 2, 14, RED, 'center'); this.optL = { x: x + w - 58, y: yy, w: 18, h: rh }; this.optR = { x: x + w - 40, y: yy, w: 18, h: rh }; }
      this.rects[i] = { x: x + 8, y: yy, w: w - 16 - (fd.opts && this.o.options.length > 1 ? 52 : 0), h: rh - 2 };
    });
    // odds (honest)
    const oy = y0 + this.fields.length * rh + 4;
    const o = this.o.odds;
    R(c, x + 10, oy, w - 20, 34, '#f1e8d4');
    if (o) {
      T(c, `あなたの実力（推定）${o.power}・ネタの出来${o.quality}　→ 本番の目安${o.mean}点`, x + 18, oy + 3, 10, '#4a3a2a', 'left', w - 36);
      T(c, `${o.round}の通過ライン（推定）${o.cut}点　${o.text}`, x + 18, oy + 18, 10, o.pct >= 50 ? '#2a7a3a' : o.pct >= 20 ? '#a06010' : RED, 'left', w - 36);
    } else T(c, '（見込みは出せない）', x + 18, oy + 10, 10, '#4a3a2a');
    // buttons
    const by = y + h - 32;
    this.btnRects = [];
    this.buttons.forEach((b, i) => {
      const bx = x + w - 14 - (2 - i) * 128 + 8, sel = this.idx === this.fields.length && (this.btn || 0) === i;
      R(c, bx, by, 120, 24, sel ? (i === 0 ? RED : '#8a7a6a') : '#e8dcc4');
      T(c, b, bx + 60, by + 5, 12, sel ? '#ffffff' : INK, 'center', 110);
      this.btnRects[i] = { x: bx, y: by, w: 120, h: 24 };
    });
    T(c, '↑↓選ぶ　A:書く・決定　←→:日程', x + 14, by + 7, 10, '#a89a88', 'left', w - 14 - 2 * 128 - 20);
  }
}
class StampScene {
  constructor(g, o, done) { Object.assign(this, { g, o, done, hd: true, opaque: true, hidesHud: true, isContestUI: true, t: 0, tapAt: null }); }
  update(g) { this.t++; const tap = this.tapAt; this.tapAt = null; if (this.t > 40 && (tap || g.input.pressed('a') || g.input.pressed('b'))) { dropA(g.input); sfx('ok'); this.done(true); } if (this.t === 30) sfx('hit'); }
  draw(c, g) {
    const { o } = this;
    R(c, 0, 0, SW, SH, '#2a2032');
    const x = 120, y = 30, w = SW - 240, h = 300;
    R(c, x, y, w, h, PAPER); R(c, x, y, w, 3, RED);
    T(c, o.title, x + w / 2, y + 14, 12, RED, 'center', w - 20);
    T(c, 'エントリーナンバー', x + w / 2, y + 50, 12, '#6a5a4a', 'center');
    T(c, String(o.entry.no), x + w / 2, y + 70, 32, INK, 'center');
    T(c, o.entry.unitName, x + w / 2, y + 120, 16, INK, 'center', w - 30);
    T(c, `${o.cyc.rounds[0].name}：${I.dateText(g, o.option.day, { year: true })}　${o.option.venue}会場`, x + w / 2, y + 150, 12, INK, 'center', w - 30);
    T(c, `参加費 ${o.fee.text}`, x + w / 2, y + 170, 12, '#6a5a4a', 'center', w - 30);
    T(c, '当日は受付でエントリーナンバーを伝えよう。', x + w / 2, y + 200, 12, '#6a5a4a', 'center', w - 30);
    if (this.t >= 30) {
      const k = Math.min(1, (this.t - 30) / 6);
      const s = 1.6 - 0.6 * k;
      c.save(); c.translate(x + w - 86, y + 252); c.rotate(-0.2); c.scale(s, s);
      c.globalAlpha = 0.85;
      R(c, -46, -20, 92, 40, RED); R(c, -42, -16, 84, 32, PAPER);
      T(c, '受付完了', 0, -8, 16, RED, 'center');
      c.restore(); c.globalAlpha = 1;
    }
    if (this.t > 40 && Math.floor(this.t / 30) % 2) T(c, 'Aでとじる', x + w / 2, y + h - 22, 10, '#a89a88', 'center');
  }
}
class BoardScene {
  constructor(g, o, done) { Object.assign(this, { g, o, done, hd: true, opaque: true, hidesHud: true, isContestUI: true, t: 0, tapAt: null, scroll: 0 }); }
  update(g) {
    this.t++;
    const tap = this.tapAt; this.tapAt = null;
    const inp = g.input;
    if (this.maxScroll > 0) { if (inp.repeat('up')) this.scroll = Math.max(0, this.scroll - 1); if (inp.repeat('down')) this.scroll = Math.min(this.maxScroll, this.scroll + 1); }
    if (this.t > 20 && (tap || inp.pressed('a') || inp.pressed('b') || inp.pressed('menu'))) { dropA(inp); sfx('ok'); this.done(true); }
  }
  draw(c, g) {
    const o = this.o;
    R(c, 0, 0, SW, SH, '#3a2a1a');
    // a cork board with the posted sheet
    for (let i = 0; i < 160; i++) R(c, (i * 131) % SW, (i * 71) % SH, 2, 1, i % 2 ? '#4a3a26' : '#2e2214');
    const x = 40, y = 10, w = SW - 80, h = SH - 20;
    R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.35)');
    R(c, x, y, w, h, '#ffffff');
    R(c, x, y, w, 26, o.color || RED);
    T(c, o.title, x + 10, y + 6, 12, '#ffffff', 'left', w - 200);
    T(c, o.sub || '', x + w - 10, y + 7, 12, '#ffffff', 'right', 260);
    for (const px of [x + 12, x + w - 16]) { R(c, px, y + 3, 5, 5, '#e0b020'); }
    const by = y + 34;
    if (o.ranking) {
      // final ranking
      const rows = o.ranking;
      const rh = 22;
      const maxRows = Math.floor((h - 70) / rh);
      this.maxScroll = Math.max(0, rows.length - maxRows);
      rows.slice(this.scroll, this.scroll + maxRows).forEach((r, k) => {
        const i = this.scroll + k;
        const yy = by + k * rh;
        if (r.me) R(c, x + 8, yy, w - 16, rh - 2, '#fff3c0');
        T(c, `${i + 1}位`, x + 18, yy + 4, 12, i === 0 ? '#c09010' : INK);
        T(c, r.name, x + 70, yy + 4, 12, r.me ? RED : INK, 'left', w - 200);
        T(c, `${Number.isFinite(r.total) ? `${Math.round(r.total * 10) / 10}点` : ''}${Number.isFinite(r.votes) ? `　最終決戦 ${r.votes}票` : ''}`, x + w - 18, yy + 4, 12, INK, 'right');
        R(c, x + 8, yy + rh - 2, w - 16, 1, '#e8e2d4');
      });
      if (o.champion && this.t % 40 < 30) T(c, '優勝！', x + w - 24, y + h - 26, 16, '#c09010', 'right');
    } else if (o.names) {
      T(c, `合格 ${o.names.length + (o.passed ? 1 : 0)}組`, x + 12, by, 12, INK);
      const names = [...o.names];
      const mine = o.passed ? (o.mineName || null) : null;
      if (mine) names.push(mine);
      const cols = 3, cw = (w - 24) / cols, rh = 18;
      names.slice(0, cols * 13).forEach((n, i) => T(c, n, x + 12 + (i % cols) * cw, by + 22 + Math.floor(i / cols) * rh, 12, INK, 'left', cw - 8));
    } else {
      const nums = o.numbers || [];
      T(c, `合格者 ${nums.length.toLocaleString('ja-JP')}組（エントリーナンバー）`, x + 12, by, 12, INK, 'left', w - 24);
      const cols = 12, cw = Math.floor((w - 24) / cols), rh = 16;
      const maxRows = Math.floor((h - 120) / rh);
      const rowsN = Math.ceil(nums.length / cols);
      this.maxScroll = Math.max(0, rowsN - maxRows);
      const mineRow = o.passed && o.mine ? Math.floor(nums.indexOf(o.mine) / cols) : -1;
      if (this.t === 1 && mineRow >= maxRows) this.scroll = Math.min(this.maxScroll, mineRow - Math.floor(maxRows / 2));
      for (let r0 = 0; r0 < maxRows; r0++) {
        const r = r0 + this.scroll;
        for (let k = 0; k < cols; k++) {
          const i = r * cols + k;
          if (i >= nums.length) break;
          const v = nums[i];
          const me = o.mine && v === o.mine;
          const xx = x + 12 + k * cw, yy = by + 20 + r0 * rh;
          if (me && this.t % 30 < 22) R(c, xx - 2, yy - 1, cw - 4, rh - 1, '#ffd23f');
          T(c, String(v), xx + cw - 10, yy, 12, me ? RED : INK, 'right');
        }
      }
      const fy = by + 22 + maxRows * rh;
      R(c, x + 8, fy, w - 16, 1, '#e0d8c8');
      const msg = o.passed ? `あなたの番号（${o.mine}番）があった！合格！` : `あなたの番号（${o.mine ?? '—'}番）は、なかった…。`;
      T(c, msg, x + 12, fy + 6, 12, o.passed ? '#2a7a3a' : RED, 'left', w - 24);
      if (o.place && o.of) T(c, `${o.exact ? '' : '推定 '}${Math.round(o.of).toLocaleString('ja-JP')}組中 ${Math.round(o.place).toLocaleString('ja-JP')}位${o.exact ? '' : '前後'}`, x + w - 12, fy + 6, 10, '#6a5a4a', 'right', 200);
      if (!o.passed && o.reasons && o.reasons.length) T(c, `実力不足：${o.reasons.slice(0, 2).join('／')}`, x + 12, fy + 22, 10, '#6a4a3a', 'left', w - 24);
      else if (o.next) T(c, `次：${o.next}`, x + 12, fy + 22, 10, '#4a5a6a', 'left', w - 24);
    }
    if (this.maxScroll > 0) T(c, '↑↓スクロール', x + w - 12, y + h - 16, 10, '#a89a88', 'right');
    if (this.t > 20 && Math.floor(this.t / 30) % 2) T(c, 'Aでとじる', x + 12, y + h - 16, 10, '#a89a88');
  }
}
class ScoreScene {
  constructor(g, o, done) { Object.assign(this, { g, o, done, hd: true, opaque: true, hidesHud: true, isContestUI: true, t: 0, tapAt: null }); }
  get shown() { return Math.min(this.o.judges.length, Math.floor(Math.max(0, this.t - 30) / 22)); }
  update(g) {
    this.t++;
    const tap = this.tapAt; this.tapAt = null;
    const inp = g.input;
    const all = this.shown >= this.o.judges.length;
    if (this.t > 30 && this.t % 22 === 8 && !all) sfx('cursor');
    if ((tap || inp.pressed('a') || inp.pressed('b')) && this.t > 10) {
      dropA(inp);
      if (!all) { this.t = 30 + this.o.judges.length * 22 + 1; sfx('drum'); return; }
      sfx('ok'); this.done(true);
    }
  }
  draw(c, g) {
    const o = this.o;
    const col = o.color || '#c0392b';
    R(c, 0, 0, SW, SH, '#0a0a1c');
    for (let i = 0; i < 18; i++) { const x = (i * 38 + this.t) % (SW + 40) - 20; R(c, x, 0, 2, 120, 'rgba(255,255,255,0.04)'); }
    R(c, 0, 0, SW, 28, shade(col, -0.45));
    R(c, 0, 26, SW, 2, K.gold);
    T(c, o.title, 12, 7, 12, '#ffffff', 'left', 360);
    T(c, `${o.order}番目／${o.of}組`, SW - 12, 8, 10, K.gold, 'right');
    T(c, o.unit, SW / 2, 40, 16, '#ffffff', 'center', SW - 40);
    // judges
    const n = Math.max(1, o.judges.length);
    const jw = Math.min(84, Math.floor((SW - 40) / n));
    const x0 = Math.round((SW - jw * n) / 2);
    o.judges.forEach((j, i) => {
      const x = x0 + i * jw;
      R(c, x + 3, 70, jw - 6, 92, '#161632');
      R(c, x + 3, 70, jw - 6, 2, col);
      T(c, j.name, x + jw / 2, 76, 10, K.dim, 'center', jw - 10);
      if (i < this.shown || this.shown >= n) {
        T(c, String(j.pts ?? '—'), x + jw / 2, 100, 24, K.gold, 'center');
      } else T(c, '?', x + jw / 2, 100, 24, '#3a3a5a', 'center');
    });
    const done = this.shown >= n;
    R(c, SW / 2 - 110, 172, 220, 46, '#161632');
    R(c, SW / 2 - 110, 172, 220, 2, K.gold);
    T(c, done ? `${o.total}点` : '採点中…', SW / 2, 180, done ? 24 : 16, done ? '#ffffff' : K.dim, 'center');
    if (o.max) T(c, `（${o.max}点満点）`, SW / 2 + 104, 204, 10, K.dim, 'right');
    // standings so far
    if (done && o.standings && o.standings.length) {
      R(c, 120, 226, SW - 240, 102, '#11112a');
      T(c, 'ここまでの順位', 128, 230, 10, K.dim);
      o.standings.slice(0, 5).forEach((s, i) => {
        const y = 246 + i * 16;
        if (s.me) R(c, 124, y - 1, SW - 248, 15, '#3a3010');
        T(c, `${i + 1}`, 132, y, 12, i === 0 ? K.gold : K.text);
        T(c, s.name, 150, y, 12, s.me ? K.gold : K.text, 'left', SW - 400);
        T(c, `${s.total}`, SW - 128, y, 12, K.text, 'right');
      });
    }
    if (done && Math.floor(this.t / 30) % 2) T(c, 'Aでつづける', SW / 2, 340, 10, K.dim, 'center');
  }
}
class VotesScene {
  constructor(g, o, done) { Object.assign(this, { g, o, done, hd: true, opaque: true, hidesHud: true, isContestUI: true, t: 0, tapAt: null }); }
  update(g) {
    this.t++;
    const tap = this.tapAt; this.tapAt = null;
    const inp = g.input;
    if ((tap || inp.pressed('a') || inp.pressed('b')) && this.t > 10) { dropA(inp); if (this.t < 90) { this.t = 90; return; } sfx('ok'); this.done(true); }
  }
  draw(c, g) {
    const o = this.o;
    const col = o.color || '#c0392b';
    R(c, 0, 0, SW, SH, '#101830');
    R(c, 0, 0, SW, 28, shade(col, -0.4));
    T(c, o.title, 12, 7, 12, '#ffffff', 'left', SW - 24);
    const rows = o.rows.slice(0, 10);
    const max = Math.max(1, ...rows.map((r) => num(r.votes)));
    const k = Math.min(1, this.t / 80);
    rows.forEach((r, i) => {
      const y = 44 + i * 28;
      if (r.me) R(c, 8, y - 2, SW - 16, 26, '#2a2a10');
      T(c, `${i + 1}`, 18, y + 4, 12, i === 0 ? K.gold : K.dim);
      T(c, r.name, 36, y + 4, 12, r.me ? K.gold : '#ffffff', 'left', 190);
      const bw = Math.round(((SW - 330) * num(r.votes) * k) / max);
      R(c, 236, y + 4, bw, 14, r.me ? K.gold : i === 0 ? col : '#4a5a8a');
      T(c, `${Math.round(num(r.votes) * k).toLocaleString('ja-JP')}${o.unit || '票'}`, SW - 14, y + 4, 12, '#ffffff', 'right');
    });
    if (this.t > 90 && Math.floor(this.t / 30) % 2) T(c, 'Aでつづける', SW / 2, 340, 10, K.dim, 'center');
  }
}

// ================================================================ CONTEST_UI (used by contests_run.js)
Object.assign(CONTEST_UI, {
  open: (g, tab) => openContestScreen(g, { tab }),
  entryForm: (g, o) => openScene(g, (gg, done) => new FormScene(gg, o, done)),
  entryDone: (g, o) => openScene(g, (gg, done) => new StampScene(gg, o, done)),
  board: (g, o) => openScene(g, (gg, done) => new BoardScene(gg, o, done)),
  scoreboard: (g, o) => openScene(g, (gg, done) => new ScoreScene(gg, o, done)),
  votes: (g, o) => openScene(g, (gg, done) => new VotesScene(gg, o, done)),
  detailLines,
});
export async function openContestScreen(g, opts = {}) {
  if (!g || !g.state) return null;
  if (g.auto && !g.auto.contestui) return null;
  const open = g.scenes.find((s) => s instanceof ContestScene && !s.closed);
  if (open) { if (opts.tab) open.setTab(tabIndex(opts.tab)); return null; }
  sfx('ok');
  return new Promise((resolve) => { const sc = new ContestScene(g, opts, resolve); g.push(sc); });
}

// ================================================================ the phone app 「賞レース」 (手帳 / ケータイ / スマホ)
const APP_COLOR = '#b8402a';
const appTitle = () => '賞レース';
async function contestApp(g) {
  let index = 0;
  for (;;) {
    const due = I.dueOn(g);
    const c = I.cstate(g);
    const invites = [];
    for (const id of Object.keys(c.invites || {})) for (const y of Object.keys(c.invites[id] || {})) if (num(c.invites[id][y]) > 0 && !I.entryOf(g, id, Number(y)) && CONTESTS[id]) invites.push({ id, year: Number(y) });
    const list = g.contests();
    const mine = list.filter((x) => x.entry && (x.entry.status === 'entered' || x.entry.status === 'passed'));
    const open = list.filter((x) => x.status === 'open');
    const items = [];
    for (const x of list) if (x.selfRun && x.today && x.today.length && typeof x.def.flow === 'function') items.push({ id: 'selfgo', x, label: `${x.def.short || x.def.name}：${x.today[0].label || '今日の予定'}`, sub: x.today.length > 1 ? `ほか${x.today.length - 1}件` : x.statusLabel, right: '今日', rightColor: '#d03030' });
    for (const d of due) items.push({ id: 'go', d, label: `会場へ向かう`, sub: `${I.contestName(CONTESTS[d.id], d.year)} ${d.revival ? '敗者復活戦' : d.cyc.rounds[d.idx].name}`, right: '今日', rightColor: '#d03030' });
    for (const iv of invites) items.push({ id: 'invite', iv, label: '出場のお願いが届いている', sub: I.contestName(CONTESTS[iv.id], iv.year), right: '招待', rightColor: '#c08010' });
    items.push({ id: 'season', label: '今シーズンの大会', sub: `受付中 ${open.length}・全${list.length}大会`, right: open.length ? `${open.length}` : '' });
    items.push({ id: 'entries', label: 'エントリー状況', sub: mine.length ? mine.map((x) => x.def.short || x.def.name).slice(0, 3).join('・') : 'まだエントリーしていない' });
    items.push({ id: 'results', label: '自分の成績', sub: `出場 ${num(c.stats.entered)}・決勝 ${num(c.stats.finals)}・優勝 ${num(c.stats.wins)}` });
    items.push({ id: 'news', label: 'お笑いニュース', sub: c.news[0] ? String(c.news[0].text).split('\n')[0] : 'まだない' });
    items.push({ id: 'history', label: '歴代王者', sub: '歴代のチャンピオン' });
    items.push({ id: 'screen', label: '賞レースの画面を開く', sub: 'カレンダー・一覧・結果' });
    const i = await phoneList(g, { title: appTitle(g), color: APP_COLOR, index, items: items.map((x) => ({ label: x.label, sub: x.sub, right: x.right, rightColor: x.rightColor })) });
    if (i < 0) return;
    index = i;
    const it = items[i];
    if (it.id === 'go') {
      if (!phoneOverMapOnly(g)) { await phoneInfo(g, { title: '会場へ', color: APP_COLOR, lines: ['（いまは移動できない。用事がすんでからにしよう）'] }); continue; }
      closePhoneThen(g, (gg) => gg.contestGo(it.d.id));
      return;
    }
    if (it.id === 'selfgo') {
      if (!phoneOverMapOnly(g)) { await phoneInfo(g, { title: '会場へ', color: APP_COLOR, lines: ['（いまは移動できない。用事がすんでからにしよう）'] }); continue; }
      const x = it.x;
      closePhoneThen(g, (gg) => x.def.flow(gg, { id: x.id, def: x.def, year: x.year, edition: x.edition, revival: x.revival, entry: null, round: null, date: I.contestDate(gg), mode: 'full' }));
      return;
    }
    if (it.id === 'invite') { await g.enterContest(it.iv.id); continue; }
    if (it.id === 'season') await seasonList(g, list);
    else if (it.id === 'entries') await entriesList(g);
    else if (it.id === 'results') await phoneInfo(g, { title: '自分の成績', color: APP_COLOR, lines: resultLines(g) });
    else if (it.id === 'news') await newsList(g);
    else if (it.id === 'history') await historyList(g);
    else if (it.id === 'screen') { if (g.auto && !g.auto.contestui) continue; await openContestScreen(g, { tab: 'list' }); }
  }
}
async function seasonList(g, list) {
  let index = 0;
  for (;;) {
    const rows = list.map((x) => {
      const el = safe(() => I.eligibilityOf(g, x.id, x.year), { ok: false, why: '' });
      const nr = x.nextRound;
      return { label: `${x.entry && x.entry.status !== 'withdrawn' ? '★' : el.ok ? '○' : '×'} ${x.def.short || x.def.name}`, sub: `${x.statusLabel}${nr ? `・${nr.name} ${I.dateText(g, nr.day)}` : ''}`, right: x.status === 'open' ? '受付中' : '', rightColor: '#3a9a5a' };
    });
    const k = await phoneList(g, { title: '今シーズンの大会', color: APP_COLOR, index, items: rows, empty: '大会がない。' });
    if (k < 0) return;
    index = k;
    await contestActions(g, list[k].id);
  }
}
async function contestActions(g, id) {
  const def = CONTESTS[id];
  for (;;) {
    const info = I.contestInfo(g, id);
    const e = info.entry;
    const el = I.eligibilityOf(g, id, info.year);
    const due = I.dueOn(g).filter((d) => d.id === id);
    const acts = [{ id: 'info', label: 'くわしく見る' }];
    if (due.length) acts.push({ id: 'go', label: '会場へ向かう', right: '今日' });
    if (!e && info.status === 'open' && !info.invite) acts.push({ id: 'enter', label: 'エントリーする', sub: el.ok ? `参加費 ${I.feeOf(g, id, info.year).text}` : el.why, disabled: !el.ok, why: el.why });
    if (e && !e.external && (e.status === 'entered' || e.status === 'passed')) acts.push({ id: 'resched', label: '日程・会場を変える' });
    if (info.cyc.held) acts.push({ id: 'odds', label: '見込みを調べる' });
    acts.push({ id: 'hist', label: '歴代王者' });
    const k = await phoneList(g, { title: def.short || def.name, color: I.colorOf(def), items: acts.map((a) => ({ label: a.label, sub: a.sub, right: a.right, disabled: a.disabled, why: a.why })) });
    if (k < 0) return;
    const a = acts[k].id;
    if (a === 'info') await phoneInfo(g, { title: def.short || def.name, color: I.colorOf(def), lines: [info.label, ...detailLines(g, id, info.year)] });
    else if (a === 'go') { if (!phoneOverMapOnly(g)) { await phoneInfo(g, { title: '会場へ', lines: ['（いまは移動できない）'] }); continue; } closePhoneThen(g, (gg) => gg.contestGo(id)); return; }
    else if (a === 'enter') await g.enterContest(id);
    else if (a === 'resched') await reschedule(g, id, info.year, null);
    else if (a === 'odds') { const o = g.contestOdds(id, e ? e.round : 0); await phoneInfo(g, { title: '見込み', color: I.colorOf(def), lines: o ? [`実力（推定）${o.power}・ネタ${o.quality}`, `本番の目安 ${o.mean}点`, `${o.round}の通過ライン ${o.cut}点`, o.text] : ['見込みは出せない。'] }); }
    else if (a === 'hist') await phoneInfo(g, { title: '歴代王者', color: I.colorOf(def), lines: historyLines(g, id) });
  }
}
function historyLines(g, id) {
  const rows = g.contestHistory(id);
  if (!rows.length) return ['まだ一度も開催されていない。'];
  return [...rows.slice(0, 40).map((r) => `${r.year} ${r.edition ? `第${r.edition}回 ` : ''}${r.champion}${r.playerPlace ? `（あなた${r.playerPlace}位）` : ''}${r.revival ? '［復刻］' : ''}`)];
}
async function entriesList(g) {
  const c = I.cstate(g);
  const rows = [];
  for (const id of Object.keys(c.entries)) for (const y of Object.keys(c.entries[id] || {})) { const e = c.entries[id][y]; if (e && CONTESTS[id]) rows.push({ id, year: Number(y), e }); }
  rows.sort((a, b) => b.year - a.year || num(b.e.day) - num(a.e.day));
  const k = await phoneList(g, { title: 'エントリー状況', color: APP_COLOR, items: rows.map((r) => ({ label: `${CONTESTS[r.id].short || CONTESTS[r.id].name} ${r.year}`, sub: `No.${r.e.no}・${ENTRY_LABEL[r.e.status] || ''}${r.e.pending ? '（結果待ち）' : ''}`, right: r.e.status === 'champion' ? '優勝' : '' })), empty: 'まだエントリーしていない。' });
  if (k >= 0) await contestActions(g, rows[k].id);
}
function resultLines(g) {
  const c = I.cstate(g);
  const L = [`出場 ${num(c.stats.entered)}大会・本番 ${num(c.stats.rounds)}回・合格 ${num(c.stats.passed)}回`, `決勝進出 ${num(c.stats.finals)}回・優勝 ${num(c.stats.wins)}回`, `賞金 ${fmtMoney(num(c.stats.prize))}・参加費 ${fmtMoney(num(c.stats.fees))}`, ''];
  for (const id of Object.keys(c.entries)) for (const y of Object.keys(c.entries[id] || {})) {
    const e = c.entries[id][y];
    const def = CONTESTS[id];
    if (!e || !def) continue;
    const cyc = I.cycleOf(g, def, Number(y));
    const last = (e.results || [])[e.results.length - 1];
    L.push(`・${cyc.label}：${e.status === 'champion' ? '優勝！' : e.final ? `決勝${e.final.place}位` : last ? `${last.withdrawn ? '棄権' : `${(cyc.rounds[last.round] || {}).name || ''}${last.passed ? '突破' : '敗退'}`}` : ENTRY_LABEL[e.status] || ''}`);
  }
  return L;
}
async function newsList(g) {
  const c = I.cstate(g);
  const items = c.news.slice(0, 60);
  for (;;) {
    const k = await phoneList(g, { title: 'お笑いニュース', color: APP_COLOR, items: items.map((n) => ({ label: String(n.text).split('\n')[0], sub: `${n.day}日目`, right: n.kind === 'personal' ? 'あなた' : '' })), empty: 'まだニュースはない。' });
    if (k < 0) return;
    await phoneInfo(g, { title: 'お笑いニュース', color: APP_COLOR, lines: [`${items[k].day}日目`, ...String(items[k].text).split('\n')] });
  }
}
async function historyList(g) {
  const defs = Object.values(CONTESTS).sort((a, b) => I.prestigeOf(b) - I.prestigeOf(a));
  for (;;) {
    const k = await phoneList(g, { title: '歴代王者', color: APP_COLOR, items: defs.map((d) => ({ label: d.short || d.name, sub: I.contestName(d, I.contestDate(g).year) })), empty: '大会がない。' });
    if (k < 0) return;
    await phoneInfo(g, { title: defs[k].short || defs[k].name, color: I.colorOf(defs[k]), lines: historyLines(g, defs[k].id) });
  }
}
registerPhoneApp('shourace', {
  name: '賞レース', color: APP_COLOR, order: 58,
  iconHD(c, x, y) {
    appTile(c, x, y, APP_COLOR);
    // a trophy with a centre mic
    R(c, x + 9, y + 7, 14, 3, '#ffe36e'); R(c, x + 10, y + 10, 12, 6, '#ffd23f'); R(c, x + 11, y + 16, 10, 2, '#e0b020');
    R(c, x + 6, y + 8, 3, 6, '#ffd23f'); R(c, x + 23, y + 8, 3, 6, '#ffd23f');
    R(c, x + 15, y + 18, 2, 4, '#e0b020'); R(c, x + 11, y + 22, 10, 3, '#c09010');
    R(c, x + 13, y + 11, 6, 3, '#2a2430'); R(c, x + 15, y + 9, 2, 2, '#ffffff');
  },
  badge: (g) => { try { const c = I.cstate(g); let n = I.dueOn(g).length; for (const id of Object.keys(c.invites || {})) for (const y of Object.keys(c.invites[id] || {})) if (num(c.invites[id][y]) > 0 && !I.entryOf(g, id, Number(y))) n++; return n; } catch (e) { return 0; } },
  cond: (g) => !!g && !!g.state && Object.keys(CONTESTS).length > 0,
  open: (g) => contestApp(g),
});
void drawFaceHD; void phoneConfirm;
if (typeof window !== 'undefined') window.__contestui = { scene: () => sceneOf(window.__game), open: openContestScreen, TABS, FormScene, BoardScene, ScoreScene, VotesScene, StampScene };
