// 生活 (R30) — the life screen: an HD 640x360 planner in the colours of the season, opened from the phone app 「生活」 and the
// MENU (「生活」). Tabs: きょう (you, the needs, today's timeline, お知らせ and what you can do now) · キャリア (the stage ladder,
// the six-stat chart, the stage's own page: 通知表 / 単位・就活 / 会社 / 健康, and the settings) · 子育て (親キャリア: the children,
// their stats and report cards, what you can do for each) · 年表 (the lifeline from 0歳 and every milestone; 生い立ち starts here)
// · 家計 (the money that comes and goes every week, the last weeks' ledger).
// Keys: ←→ tabs, ↑↓ choose, A do / open, B or MENU close. Touch: tap a tab, tap a row (again to do it), tap a modal's rows.
// On a portrait phone the lower screen (bigtext.js) shows the selected tab in large type (portraitSpec).
// Logic: lifestage.js, lifestage_kids.js, lifestage_origin.js. Data: lifestage_data.js.
import { Game } from './game.js';
import { SW, SH, clamp, fmtMoney, makeCanvas } from './util.js';
import { text, wrap, measure } from './draw.js';
import { audio } from './audio.js';
import { drawFaceHD } from './sprites.js';
import { registerPhoneApp } from './life.js';
import { fitText, appTile } from './phone.js';
import { ageOf, profileOf, fullName, YEAR_DAYS } from './profile.js';
import * as D from './lifestage_data.js';
import { ensure, stageOf, stageLabel, dateOf, hm, highGrade, uniGrade, weeklyCosts } from './lifestage.js';
import { runOrigin } from './lifestage_origin.js';
import { rom } from './romance.js';
import { drawLifeArt, ACT_ART, KID_ART, INBOX_ART, ART_W, ART_H } from './life_art.js';

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error('[life_screen]', e); return d; } };
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* tests */ } };
const R = (c, x, y, w, h, col) => { if (w <= 0 || h <= 0) return; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const T = (c, s, x, y, size = 12, col = '#2b2a33', align = 'left', maxW = 0) => text(c, maxW > 0 ? fitText(c, String(s), maxW, size) : String(s), x, y, { size, color: col, align, shadow: null });
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
function frame(c, x, y, w, h, col) { R(c, x, y, w, 1, col); R(c, x, y + h - 1, w, 1, col); R(c, x, y, 1, h, col); R(c, x + w - 1, y, 1, h, col); }
// a pixel-rounded box (corners cut by 2 px) with a soft drop shadow
function card(c, x, y, w, h, fill, edge, shadow = true) {
  if (shadow) { R(c, x + 2, y + 3, w, h, 'rgba(80,55,20,0.10)'); }
  R(c, x + 2, y, w - 4, h, fill); R(c, x, y + 2, w, h - 4, fill); R(c, x + 1, y + 1, w - 2, h - 2, fill);
  if (edge) { R(c, x + 2, y, w - 4, 1, edge); R(c, x + 2, y + h - 1, w - 4, 1, edge); R(c, x, y + 2, 1, h - 4, edge); R(c, x + w - 1, y + 2, 1, h - 4, edge); R(c, x + 1, y + 1, 1, 1, edge); R(c, x + w - 2, y + 1, 1, 1, edge); R(c, x + 1, y + h - 2, 1, 1, edge); R(c, x + w - 2, y + h - 2, 1, 1, edge); }
}
function pill(c, x, y, w, h, fill) { R(c, x + 2, y, w - 4, h, fill); R(c, x + 1, y + 1, w - 2, h - 2, fill); R(c, x, y + 2, w, h - 4, fill); }
function disc(c, cx, cy, r, col) { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } }
function ringC(c, cx, cy, r, col, t = 2) { for (let a = 0; a < 360; a += 2) { const rad = (a * Math.PI) / 180; R(c, cx + Math.cos(rad) * r - t / 2, cy + Math.sin(rad) * r - t / 2, t, t, col); } }
function para(c, s, x, y, w, size, col, lh, maxLines = 99) {
  const all = wrap(c, String(s || ''), w, size);
  const ls = all.slice(0, maxLines);
  if (all.length > maxLines && ls.length) ls[ls.length - 1] = fitText(c, ls[ls.length - 1] + '……', w, size);
  ls.forEach((l, i) => T(c, l, x, y + i * lh, size, col));
  return y + ls.length * lh;
}
const mix = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };

// ================================================================ the look
const P = { bg: '#f7f2e7', grid: '#efe7d6', ink: '#2b2a33', dim: '#756f63', faint: '#b3aa97', card: '#fffdf8', edge: '#e1d6bf', sel: '#fff1c6', selEdge: '#e8b84a', red: '#c4423a', green: '#2f8a52', lock: '#a0722a' };
const SEASON = (m) => (m >= 3 && m <= 5 ? { name: '春', acc: '#e07f9f', dark: '#b8577a', light: '#fbe3ea' } : m >= 6 && m <= 8 ? { name: '夏', acc: '#2a9d98', dark: '#1d7470', light: '#d8f1ef' } : m >= 9 && m <= 11 ? { name: '秋', acc: '#d27a2c', dark: '#a85a1a', light: '#f8e5d2' } : { name: '冬', acc: '#4a78bd', dark: '#33578f', light: '#dfe8f6' });
const TABS = [{ id: 'today', label: 'きょう' }, { id: 'career', label: 'キャリア' }, { id: 'kids', label: '子育て' }, { id: 'hist', label: '年表' }, { id: 'money', label: '家計' }];
const KIND_COL = { start: '#7a7468', school: '#4a72d8', work: '#2f9a6a', geino: '#d64161', family: '#ef9a2b', health: '#22a4b5', money: '#38a46a', life: '#8a6ac0', origin: '#f08cb0', rom: '#e0577f' };

// tiny pixel icons (14x14 box)
function icon(c, kind, x, y, col = '#ffffff') {
  const r = (a, b, w, h) => R(c, x + a, y + b, w, h, col);
  switch (kind) {
    case 'baby': r(4, 1, 6, 2); r(3, 3, 8, 8); r(5, 11, 4, 2); break; // a feeding bottle
    case 'randoseru': r(3, 2, 8, 2); r(2, 4, 10, 8); R(c, x + 4, y + 6, 6, 1, 'rgba(0,0,0,0.25)'); break;
    case 'gakuran': r(4, 1, 6, 3); r(2, 4, 10, 9); R(c, x + 6, y + 5, 2, 8, 'rgba(0,0,0,0.25)'); break;
    case 'book': r(2, 3, 5, 9); r(7, 3, 5, 9); R(c, x + 7, y + 3, 1, 9, 'rgba(0,0,0,0.3)'); break;
    case 'cap': r(1, 4, 12, 3); r(4, 7, 6, 4); r(11, 7, 1, 4); break;
    case 'bag': r(5, 2, 4, 2); r(2, 4, 10, 8); R(c, x + 2, y + 7, 10, 1, 'rgba(0,0,0,0.25)'); break;
    case 'tea': r(3, 5, 7, 6); r(10, 6, 2, 3); r(4, 11, 5, 1); r(5, 1, 1, 3); r(7, 2, 1, 2); break;
    case 'cane': r(5, 1, 5, 2); r(9, 3, 2, 2); r(5, 3, 2, 10); r(4, 12, 4, 1); break;
    case 'heart': r(2, 3, 4, 4); r(8, 3, 4, 4); r(3, 6, 8, 3); r(5, 9, 4, 2); r(6, 11, 2, 1); break;
    case 'bowl': r(2, 6, 10, 4); r(4, 10, 6, 2); r(4, 3, 2, 3); r(7, 2, 2, 4); break;
    case 'cloud': r(3, 5, 8, 5); r(5, 3, 4, 2); r(2, 7, 10, 3); break;
    case 'spark': r(6, 1, 2, 12); r(1, 6, 12, 2); r(4, 4, 6, 6); break;
    case 'coin': r(3, 2, 8, 10); r(2, 4, 10, 6); R(c, x + 6, y + 4, 2, 6, 'rgba(0,0,0,0.25)'); break;
    case 'mail': r(1, 3, 12, 9); R(c, x + 2, y + 4, 10, 1, 'rgba(0,0,0,0.25)'); R(c, x + 4, y + 6, 6, 1, 'rgba(0,0,0,0.25)'); break;
    case 'star': r(6, 1, 2, 4); r(1, 5, 12, 2); r(3, 7, 8, 2); r(2, 9, 4, 3); r(8, 9, 4, 3); break;
    case 'check': r(2, 7, 2, 2); r(4, 9, 2, 2); r(6, 7, 2, 2); r(8, 5, 2, 2); r(10, 3, 2, 2); break;
    default: r(4, 4, 6, 6);
  }
}
// the season in the header: petals / sun / leaves / snow, drifting
function seasonArt(c, x, y, w, h, se, t) {
  for (let i = 0; i < 9; i++) {
    const px = x + ((i * 53 + t * (0.25 + (i % 3) * 0.1)) % w), py = y + ((i * 17 + t * 0.15 * (1 + (i % 2))) % h);
    const col = se.name === '春' ? '#ffd6e3' : se.name === '夏' ? '#bff3ee' : se.name === '秋' ? (i % 2 ? '#ffd28a' : '#f3a35a') : '#ffffff';
    if (se.name === '冬') { R(c, px, py, 2, 2, col); } else if (se.name === '夏') { R(c, px, py, 3, 1, 'rgba(255,255,255,0.55)'); } else { R(c, px, py, 3, 2, col); R(c, px + 1, py + 2, 1, 1, col); }
  }
}

// ================================================================ the scene
const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isLifeUI && !s.closed);
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

class LifeScene {
  constructor(g, opts, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isLifeUI: true, t: 0, tapAt: null, closed: false, tab: 0, sel: {}, top: {}, hits: [], modal: null, toast: null, busy: 0, kidSel: 0 });
    const ti = opts && opts.tab ? TABS.findIndex((x) => x.id === opts.tab) : 0;
    this.tab = ti >= 0 ? ti : 0;
    bindTap(g);
    ensure(g);
    this.refresh(true);
    if (this.tabId === 'hist') this.sel.hist = Math.max(0, this.rows().length - 1);
  }
  get tabId() { return TABS[this.tab].id; }
  // ---------------------------------------------------------------- data
  refresh(force = false) {
    if (!force && this.t - (this.dataT || -999) < 50) return;
    this.dataT = this.t;
    const g = this.g;
    this.d = {
      ls: safe(() => g.lifeStage(), null),
      acts: safe(() => g.lifeActions(), []) || [],
      inbox: safe(() => g.lifeInbox(), []) || [],
      kids: safe(() => g.lifeKids(), []) || [],
      parent: safe(() => g.lifeParent(), null),
      hist: safe(() => this.histRows(), []) || [],
      ledger: safe(() => g.lifeLedger(), { weeks: [], costs: [] }),
      career: safe(() => g.lifeCareer(), []) || [],
      date: safe(() => dateOf(g), { year: 2026, month: 4, dom: 1 }),
      clock: safe(() => (has(g, 'clock') ? g.clock() : null), null),
    };
    this.kidSel = clamp(this.kidSel, 0, Math.max(0, this.d.kids.length - 1));
    const k = this.d.kids[this.kidSel];
    this.d.kidActs = k ? safe(() => g.lifeKidActions(k.id), []) || [] : [];
    const n = this.rows().length;
    for (const t of TABS) if ((this.sel[t.id] | 0) >= n && t.id === this.tabId) this.sel[t.id] = Math.max(0, n - 1);
  }
  histRows() {
    const g = this.g, st = g.state, pf = profileOf(st);
    const ageAt = (day) => num(pf.age, 20) + Math.floor((Math.max(1, num(day, 1)) - 1) / YEAR_DAYS);
    const out = (has(g, 'lifeHistory') ? g.lifeHistory() : []).map((h) => ({ a: num(h.a), d: num(h.d), t: h.t, k: h.k }));
    const R0 = safe(() => rom(g), null);
    if (R0 && Array.isArray(R0.album)) for (const al of R0.album.slice(-40)) if (al && al.cap) out.push({ a: ageAt(al.d), d: num(al.d), t: String(al.cap), k: 'rom' });
    out.sort((x, y) => x.a - y.a || x.d - y.d);
    return out;
  }
  rows() {
    const d = this.d || {};
    switch (this.tabId) {
      case 'today': return [...(d.inbox || []).map((it) => ({ kind: 'inbox', it })), ...(d.acts || []).filter((a) => a.group !== 'set').map((a) => ({ kind: 'act', a }))];
      case 'career': return (d.acts || []).filter((a) => a.group === 'set' || a.id === 'shukatsu' || a.id === 'enroll').filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i).map((a) => ({ kind: 'act', a }));
      case 'kids': return [...(d.kids || []).map((k, i) => ({ kind: 'kid', k, i })), ...(d.kidActs || []).map((a) => ({ kind: 'kidact', a }))];
      case 'hist': return [...(ensure(this.g).origin.done ? [] : [{ kind: 'origin' }]), ...(d.hist || []).map((h) => ({ kind: 'hist', h }))];
      case 'money': return (d.ledger && d.ledger.costs ? d.ledger.costs : []).map((c) => ({ kind: 'cost', c }));
      default: return [];
    }
  }
  setTab(i) { this.tab = (i + TABS.length) % TABS.length; this.refresh(true); if (this.tabId === 'hist' && this.sel.hist == null) this.sel.hist = Math.max(0, this.rows().length - 1); sfx('cursor'); }
  close() { if (this.closed) return; this.closed = true; if (this.modal) { const m = this.modal; this.modal = null; m.res(-1); } this.g.pop(this); this.resolve(null); }
  // ---------------------------------------------------------------- modals
  pick(o) { return new Promise((res) => { this.modal = { ...o, kind: 'pick', idx: 0, top: 0, res }; }); }
  info(title, lines, o = {}) { return new Promise((res) => { this.modal = { title, lines: [].concat(lines), kind: o.art ? 'scene' : 'info', res, t0: this.t, ...o }; }); }
  artX(extra = {}) {
    const g = this.g, d = this.d || {}, h = d.clock ? num(d.clock.hour, 12) : 12;
    const sen = d.ls && d.ls.id === 'senior';
    return { me: sen ? { ...(g.state.look || {}), hairColor: 'silver' } : g.state.look || {}, phase: h >= 5 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'dusk' : 'night', season: (this.se || SEASON(4)).name, year: (d.date && d.date.year) || 2026, stage: d.ls ? d.ls.id : 'work', club: d.ls && d.ls.high ? d.ls.high.club : null, ...extra };
  }
  page(title, lines, o = {}) { const art = o.stage === 'baby' ? 'origin_baby' : o.stage === 'elem' ? 'origin_school' : o.stage === 'mid' ? 'origin_mid' : null; return new Promise((res) => { this.modal = { title, lines: [].concat(lines), kind: art ? 'scene' : 'page', art, page: true, res, t0: this.t, ...o, X: this.artX() }; }); }
  endModal(v) { const m = this.modal; this.modal = null; if (m) m.res(v); if (this.g.input.consume) this.g.input.consume(); }
  async act(fn) { this.busy++; try { await fn(); } catch (e) { console.error(e); } finally { this.busy--; this.refresh(true); } }
  async activate(row) {
    if (!row) return;
    const g = this.g;
    if (row.kind === 'inbox') {
      const it = row.it;
      const i = await this.pick({ title: it.title, note: it.text, items: (it.choices || ['わかった']).map((c) => ({ label: c })) });
      if (i < 0) return;
      const r = g.lifeRespond(it.id, i);
      sfx('ok');
      const ev = it.data && it.data.ev;
      const art = it.kind === 'kid_event' ? (ev === 'sankan' ? 'kid_class' : ev === 'show' ? 'kid_stage' : 'kid_field') : INBOX_ART[it.kind];
      const kidL = it.data && it.data.kid ? safe(() => (g.lifeKids().find((k) => k.id === it.data.kid) || {}).look, null) : null;
      if (r.text) await this.info(it.title, r.text.split('\n'), { art: i === 0 || it.kind === 'teinen' ? art : null, X: this.artX({ kid: kidL, ev: it.title }) });
      return;
    }
    if (row.kind === 'act') {
      const a = row.a;
      if (a.why) { sfx('buzz'); this.toast = { text: a.why, t: 0 }; return; }
      let o = {};
      if (a.pick) { const i = await this.pick({ title: a.pick.title, items: a.pick.items }); if (i < 0) return; o = { pick: i }; }
      const r = g.lifeAct(a.id, o);
      sfx(r.ok ? 'ok' : 'buzz');
      const ls2 = safe(() => g.lifeStage(), null);
      const extra = { pct: ls2 && ls2.uni ? ls2.uni.thesis : null, grade: ls2 && ls2.mid && ls2.mid.check ? ls2.mid.check.grade : null, overtime: a.id === 'overtime', kid: ls2 && (ls2.grand || []).length ? { hair: 'short', hairColor: 'black', skin: 'light', top: '#ffd23f', bottom: '#5a8ad8' } : null, market: a.id === 'shukatsu' ? D.jobMarket((this.d.date || {}).year || 2026).name : '' };
      if (r.text) await this.info(a.name, r.text.split('\n'), { art: r.ok ? ACT_ART[a.id] : null, X: this.artX(extra) });
      return;
    }
    if (row.kind === 'kid') { this.kidSel = row.i; this.refresh(true); sfx('cursor'); return; }
    if (row.kind === 'kidact') {
      const a = row.a, k = this.d.kids[this.kidSel];
      if (!k) return;
      if (a.why) { sfx('buzz'); this.toast = { text: a.why, t: 0 }; return; }
      let o = {};
      if (a.pick) { const i = await this.pick({ title: a.pick.title, items: a.pick.items }); if (i < 0) return; o = { pick: i }; }
      const r = g.lifeKidAct(k.id, a.id, o);
      sfx(r.ok ? 'ok' : 'buzz');
      if (r.text) await this.info(`${k.name}と`, r.text.split('\n'), { art: r.ok ? KID_ART[a.id] : null, X: this.artX({ kid: k.look, club: k.club }) });
      return;
    }
    if (row.kind === 'origin') {
      const io = { page: (title, lines, o) => this.page(title, lines, o || {}), pick: (title, items, o) => this.pick({ title, items, stage: o && o.stage, noCancel: !!(o && o.stage) }) };
      await runOrigin(g, io);
      this.refresh(true);
      this.sel.hist = Math.max(0, this.rows().length - 1);
      return;
    }
    if (row.kind === 'hist') { sfx('cursor'); await this.info(`${row.h.a}歳のころ`, [row.h.t]); }
  }
  // ---------------------------------------------------------------- update
  update(g) {
    this.t++;
    if (this.toast) { this.toast.t++; if (this.toast.t > 150) this.toast = null; }
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    if (this.modal) { this.updateModal(inp, tap); return; }
    if (this.busy) return;
    this.refresh();
    if (tap) { this.onTap(tap); return; }
    if (inp.pressed('menu') || inp.pressed('b')) { sfx('cancel'); this.close(); return; }
    if (inp.pressed('left')) { this.setTab(this.tab - 1); return; }
    if (inp.pressed('right')) { this.setTab(this.tab + 1); return; }
    const rows = this.rows(), id = this.tabId;
    if (rows.length) {
      let s = this.sel[id] | 0;
      if (inp.pressed('up')) { s = (s - 1 + rows.length) % rows.length; sfx('cursor'); }
      if (inp.pressed('down')) { s = (s + 1) % rows.length; sfx('cursor'); }
      if (s !== (this.sel[id] | 0)) { this.sel[id] = s; if (rows[s] && rows[s].kind === 'kid') { this.kidSel = rows[s].i; this.refresh(true); } }
      if (inp.pressed('a')) { const row = rows[this.sel[id] | 0]; sfx('ok'); this.act(() => this.activate(row)); }
    }
  }
  onTap(tp) {
    const h = this.hits.slice().reverse().find((r) => inR(tp.x, tp.y, r));
    if (!h) return;
    if (h.tab != null) { if (h.tab !== this.tab) this.setTab(h.tab); return; }
    if (h.close) { sfx('cancel'); this.close(); return; }
    if (h.row != null) {
      const rows = this.rows(), id = this.tabId;
      if ((this.sel[id] | 0) === h.row || (rows[h.row] && rows[h.row].kind === 'kid')) { this.sel[id] = h.row; sfx('ok'); this.act(() => this.activate(rows[h.row])); }
      else { this.sel[id] = h.row; sfx('cursor'); }
    }
  }
  updateModal(inp, tap) {
    const m = this.modal;
    if (m.kind === 'info' || m.kind === 'page' || m.kind === 'scene') {
      if (m.kind === 'scene' && this.t - num(m.t0) < 12) return; // let the picture show before a held A closes it
      if (tap || inp.pressed('a') || inp.pressed('b')) { sfx('ok'); this.endModal(0); }
      return;
    }
    const n = m.items.length;
    if (tap) {
      const hit = (m.rects || []).findIndex((r) => inR(tap.x, tap.y, r));
      if (hit >= 0) { if (m.items[hit].lock) { sfx('buzz'); this.toast = { text: m.items[hit].lock, t: 0 }; return; } sfx('ok'); this.endModal(hit); return; }
      if (!m.noCancel && !inR(tap.x, tap.y, m.box)) { sfx('cancel'); this.endModal(-1); }
      return;
    }
    if (inp.pressed('up')) { m.idx = (m.idx - 1 + n) % n; sfx('cursor'); }
    if (inp.pressed('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
    if (inp.pressed('b') && !m.noCancel) { sfx('cancel'); this.endModal(-1); return; }
    if (inp.pressed('a')) { const it = m.items[m.idx]; if (it && it.lock) { sfx('buzz'); this.toast = { text: it.lock, t: 0 }; return; } sfx('ok'); this.endModal(m.idx); }
  }

  // ================================================================ draw
  draw(c) {
    this.hits = [];
    const d = this.d || {}, date = d.date || { month: 4 };
    const se = SEASON(date.month);
    this.se = se;
    // paper with a faint planner grid
    R(c, 0, 0, SW, SH, P.bg);
    for (let x = 0; x < SW; x += 16) R(c, x, 72, 1, SH - 92, P.grid);
    for (let y = 72; y < SH - 20; y += 16) R(c, 0, y, SW, 1, P.grid);
    this.drawHeader(c, d, se);
    this.drawTabs(c, se);
    const id = this.tabId;
    if (id === 'today') this.drawToday(c, d, se);
    else if (id === 'career') this.drawCareer(c, d, se);
    else if (id === 'kids') this.drawKids(c, d, se);
    else if (id === 'hist') this.drawHist(c, d, se);
    else this.drawMoney(c, d, se);
    // footer
    R(c, 0, SH - 18, SW, 18, '#efe6d3');
    R(c, 0, SH - 18, SW, 1, P.edge);
    T(c, '←→ タブ　↑↓ えらぶ　A 決定・ひらく　B とじる', 12, SH - 14, 10, P.dim);
    T(c, `${se.name}・${d.ls ? d.ls.name : ''}`, SW - 12, SH - 14, 10, se.dark, 'right');
    if (this.toast) {
      const w = Math.min(560, measure(c, this.toast.text, 11) + 28);
      card(c, (SW - w) / 2, SH - 50, w, 24, '#3a3340', null, true);
      T(c, this.toast.text, SW / 2, SH - 43, 11, '#ffe9a8', 'center', w - 16);
    }
    if (this.modal) this.drawModal(c, this.modal, se);
  }
  drawHeader(c, d, se) {
    const ls = d.ls, st = this.g.state;
    R(c, 0, 0, SW, 46, se.acc);
    R(c, 0, 43, SW, 3, se.dark);
    seasonArt(c, 250, 2, 250, 40, se, this.t);
    const S = ls ? D.STAGES[ls.id] : D.STAGES.work;
    disc(c, 24, 22, 15, '#ffffff');
    disc(c, 24, 22, 13, S.color);
    icon(c, S.icon, 17, 15, '#ffffff');
    T(c, '生活', 46, 6, 18, '#ffffff');
    T(c, ls ? ls.label : '', 47, 28, 10, '#fff6e8', 'left', 190);
    const date = d.date || {};
    const wd = ['月', '火', '水', '木', '金', '土', '日'][((st.day - 1) % 7 + 7) % 7];
    const part = num(date.dom, 1) <= 10 ? '上旬' : num(date.dom, 1) <= 20 ? '中旬' : '下旬';
    T(c, `${date.year || ''}年${date.month || ''}月${part}（${wd}）`, 420, 7, 12, '#ffffff', 'center');
    T(c, d.clock ? `${d.clock.label}　${d.clock.phaseLabel || ''}` : `${st.day}日目`, 420, 25, 11, '#fff6e8', 'center');
    pill(c, SW - 132, 10, 120, 24, 'rgba(255,255,255,0.92)');
    icon(c, 'coin', SW - 126, 15, '#d4a020');
    T(c, fmtMoney(num(st.money)), SW - 18, 15, 13, P.ink, 'right', 92);
  }
  drawTabs(c, se) {
    const w = (SW - 24) / TABS.length;
    TABS.forEach((tb, i) => {
      const x = 12 + i * w, on = i === this.tab;
      const y = on ? 48 : 51, h = on ? 22 : 19;
      card(c, x + 2, y, w - 4, h, on ? P.card : '#ebe2cf', on ? P.edge : '#ddd2bb', false);
      if (on) R(c, x + 4, y, w - 8, 3, se.acc);
      let label = tb.label;
      if (tb.id === 'today' && this.d && this.d.inbox && this.d.inbox.length) label += `（${this.d.inbox.length}）`;
      if (tb.id === 'kids' && this.d && this.d.kids && this.d.kids.length) label += `（${this.d.kids.length}）`;
      T(c, label, x + w / 2, y + 5, 12, on ? P.ink : P.dim, 'center', w - 10);
      this.hits.push({ x: x + 2, y: 46, w: w - 4, h: 26, tab: i });
    });
    R(c, 10, 70, SW - 20, 1, P.edge);
  }
  // a scrolling list of rows in a box; draw(row, x, y, w, h, selected)
  list(c, x, y, w, h, rowH, rows, drawRow, opts = {}) {
    const id = this.tabId, sel = opts.sel != null ? opts.sel : this.sel[id] | 0, base = opts.base || 0;
    const vis = Math.max(1, Math.floor(h / rowH));
    let top = this.top[`${id}${opts.key || ''}`] | 0;
    const ls = sel - base;
    if (ls >= 0 && ls < rows.length) { if (ls < top) top = ls; if (ls >= top + vis) top = ls - vis + 1; }
    top = clamp(top, 0, Math.max(0, rows.length - vis));
    this.top[`${id}${opts.key || ''}`] = top;
    rows.slice(top, top + vis).forEach((row, j) => {
      const i = top + j, ry = y + j * rowH, on = i + base === sel;
      if (on) { R(c, x, ry, w, rowH - 2, P.sel); frame(c, x, ry, w, rowH - 2, P.selEdge); R(c, x, ry, 3, rowH - 2, this.se.acc); }
      drawRow(row, x, ry, w, rowH, on, i);
      this.hits.push({ x, y: ry, w, h: rowH - 2, row: i + base });
    });
    if (rows.length > vis) {
      const sh = Math.max(12, (h * vis) / rows.length), sy = y + ((h - sh) * top) / Math.max(1, rows.length - vis);
      R(c, x + w + 2, y, 2, h, '#e7dfcc'); R(c, x + w + 2, sy, 2, sh, this.se.acc);
    }
    if (!rows.length && opts.empty) T(c, opts.empty, x + w / 2, y + 14, 11, P.faint, 'center', w - 12);
  }
  meter(c, x, y, w, label, v, max, col, iconK, valText, bad = false) {
    icon(c, iconK, x, y - 1, col);
    T(c, label, x + 18, y, 11, P.ink);
    T(c, valText, x + w, y, 11, bad ? P.red : P.dim, 'right');
    const bw = w - 18, f = clamp(v / Math.max(1, max), 0, 1);
    R(c, x + 18, y + 15, bw, 6, '#ece4d3');
    R(c, x + 18, y + 15, Math.round(bw * f), 6, col);
    R(c, x + 18, y + 15, Math.round(bw * f), 2, mix(col, '#ffffff', 0.35));
  }
  actRow(c, a, x, y, w, h, on) {
    const lock = !!a.why;
    T(c, a.name, x + 10, y + 3, 12, lock ? P.faint : P.ink, 'left', w * 0.55);
    T(c, a.sub || '', x + 10, y + 16, 9, lock ? P.faint : P.dim, 'left', w - 20);
    if (lock) T(c, a.why, x + w - 8, y + 3, 9, P.lock, 'right', w * 0.42);
    else if (on) { pill(c, x + w - 30, y + 3, 22, 12, this.se.acc); T(c, 'A', x + w - 19, y + 4, 9, '#fff', 'center'); }
  }
  // ---------------------------------------------------------------- きょう
  drawToday(c, d, se) {
    const g = this.g, st = g.state, ls = d.ls, L = st.life || {};
    // you
    card(c, 10, 76, 214, 260, P.card, P.edge);
    const S = ls ? D.STAGES[ls.id] : D.STAGES.work;
    disc(c, 54, 112, 30, mix(S.color, '#ffffff', 0.75));
    ringC(c, 54, 112, 30, S.color, 2);
    safe(() => drawFaceHD(c, st.look || {}, 22, 88, 2));
    const pf = profileOf(st);
    T(c, fullName(pf) || st.name || 'あなた', 92, 86, 14, P.ink, 'left', 126);
    T(c, ls ? `${ls.age}歳・誕生日まで${ls.toBirthday}日` : '', 92, 104, 10, P.dim, 'left', 126);
    const lab = ls ? ls.name : '';
    const lw = Math.min(126, measure(c, lab, 10) + 14);
    pill(c, 92, 119, lw, 16, S.color);
    T(c, lab, 92 + lw / 2, 121, 10, '#ffffff', 'center', lw - 6);
    const y0 = 152;
    this.meter(c, 22, y0, 190, '体力', num(st.stamina), num(st.maxStamina, 100), '#e0574a', 'heart', `${num(st.stamina)}/${num(st.maxStamina, 100)}`, num(st.stamina) < 20);
    this.meter(c, 22, y0 + 30, 190, '満腹', num(L.hunger), 100, '#ef9a2b', 'bowl', `${num(L.hunger)}%`, num(L.hunger) < 20);
    this.meter(c, 22, y0 + 60, 190, 'ストレス', num(L.stress), 100, '#8a6ac0', 'cloud', `${num(L.stress)}`, num(L.stress) >= 70);
    this.meter(c, 22, y0 + 90, 190, '身だしなみ', num(L.clean), 100, '#22a4b5', 'spark', `${num(L.clean)}%`, num(L.clean) < 30);
    R(c, 22, y0 + 122, 190, 1, P.edge);
    const rent = safe(() => g.housing().rent, 0);
    T(c, '住まい', 22, y0 + 130, 10, P.dim);
    T(c, `${safe(() => g.housing().name, '') || ''}（週 ${fmtMoney(num(rent))}）`, 212, y0 + 130, 10, P.ink, 'right', 140);
    T(c, '健康', 22, y0 + 146, 10, P.dim);
    const ken = ls ? ls.stats.ken : 80;
    T(c, `${ken}${ken < 40 ? '（疲れやすい）' : ''}`, 212, y0 + 146, 10, ken < 40 ? P.red : P.ink, 'right');
    // today's timeline
    card(c, 232, 76, 398, 72, P.card, P.edge);
    T(c, '今日の予定', 244, 82, 12, P.ink);
    const off = ls && ls.off;
    T(c, off ? `${off}！` : ls && ls.duty ? `${ls.duty.label}の日` : '自由な日', 618, 82, 11, off ? se.dark : P.dim, 'right');
    const X0 = 246, X1 = 616, H0 = 360, H1 = 1440;
    const xm = (m) => X0 + ((clamp(m, H0, H1) - H0) / (H1 - H0)) * (X1 - X0);
    R(c, X0, 110, X1 - X0, 10, '#efe7d6');
    for (let h = 6; h <= 24; h += 3) { R(c, xm(h * 60), 108, 1, 14, P.faint); T(c, `${h}`, xm(h * 60), 124, 9, P.dim, 'center'); }
    if (ls && ls.duty) {
      const du = ls.duty, done = du.kind === 'work' ? ls.today.work : ls.today.school;
      const col = done ? mix(S.color, '#ffffff', 0.15) : mix(S.color, '#ffffff', 0.55);
      R(c, xm(du.start), 104, xm(du.end) - xm(du.start), 22, col);
      frame(c, xm(du.start), 104, xm(du.end) - xm(du.start), 22, S.color);
      T(c, done ? (done === 'leave' ? '有給' : done === 'late' ? '遅刻で出席' : '✓ 行った') : du.label, (xm(du.start) + xm(du.end)) / 2, 109, 10, done ? '#ffffff' : P.ink, 'center', xm(du.end) - xm(du.start) - 4);
    }
    const now = d.clock ? num(d.clock.total, 540) : 540;
    R(c, xm(now), 98, 2, 32, se.dark);
    R(c, xm(now) - 3, 96, 8, 3, se.dark);
    T(c, 'いま', xm(now), 134, 9, se.dark, 'center');
    // inbox + what you can do
    card(c, 232, 154, 398, 182, P.card, P.edge);
    const rows = this.rows();
    const nIn = (d.inbox || []).length;
    T(c, nIn ? `お知らせ ${nIn}件　・　できること` : 'できること', 244, 160, 11, P.ink);
    this.list(c, 238, 176, 384, 156, 28, rows, (row, x, y, w, h, on) => {
      if (row.kind === 'inbox') {
        icon(c, 'mail', x + 8, y + 6, se.acc);
        T(c, row.it.title, x + 28, y + 3, 12, P.ink, 'left', w - 100);
        T(c, `${Math.max(0, row.it.until - this.g.state.day)}日以内に・${(row.it.choices || []).length}つの選択肢`, x + 28, y + 16, 9, P.dim, 'left', w - 40);
        if (on) { pill(c, x + w - 30, y + 3, 22, 12, se.acc); T(c, 'A', x + w - 19, y + 4, 9, '#fff', 'center'); }
      } else this.actRow(c, row.a, x, y, w, h, on);
    }, { empty: 'いまできることはない' });
  }
  // ---------------------------------------------------------------- キャリア
  drawCareer(c, d, se) {
    const ls = d.ls, g = this.g;
    if (!ls) return;
    // the ladder of stages
    card(c, 10, 76, 620, 50, P.card, P.edge);
    const cur = D.STAGE_ORDER.indexOf(ls.id);
    const skipUni = !ls.uni && cur >= 5;
    const gap = 528 / (D.STAGE_ORDER.length - 1);
    D.STAGE_ORDER.forEach((sid, i) => {
      const x = 56 + i * gap, y = 96, S = D.STAGES[sid];
      if (i < D.STAGE_ORDER.length - 1) R(c, x + 12, y - 1, gap - 24, 3, i < cur ? S.color : '#e3dac6');
      const past = i < cur, now = i === cur, skip = sid === 'uni' && skipUni;
      if (now) { disc(c, x, y, 13, S.color); ringC(c, x, y, 16, S.color, 2); icon(c, S.icon, x - 7, y - 7, '#ffffff'); }
      else if (past && !skip) { disc(c, x, y, 11, mix(S.color, '#ffffff', 0.2)); icon(c, 'check', x - 7, y - 7, '#ffffff'); }
      else { disc(c, x, y, 11, '#ece4d3'); ringC(c, x, y, 11, skip ? '#e3dac6' : '#d8ceb8', 1); icon(c, S.icon, x - 7, y - 7, skip ? '#ddd3bf' : '#c8bda6'); }
      T(c, skip ? '（進まず）' : S.short, x, y + 16, 9, now ? S.color : past ? P.dim : P.faint, 'center');
    });
    // the six stats
    card(c, 10, 132, 220, 204, P.card, P.edge);
    T(c, '能力', 22, 138, 12, P.ink);
    const cx = 120, cy = 238, rr = 66, adult = ls.id === 'work' || ls.id === 'middle' || ls.id === 'senior';
    const pt = (i, f) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / 6; return [cx + Math.cos(a) * rr * f, cy + Math.sin(a) * rr * f]; };
    for (const f of [0.25, 0.5, 0.75, 1]) for (let i = 0; i < 6; i++) { const [x1, y1] = pt(i, f), [x2, y2] = pt((i + 1) % 6, f); line(c, x1, y1, x2, y2, f === 1 ? '#d6ccb6' : '#ebe3d1'); }
    for (let i = 0; i < 6; i++) { const [x2, y2] = pt(i, 1); line(c, cx, cy, x2, y2, '#ebe3d1'); }
    const S = D.STAGES[ls.id];
    c.save();
    c.beginPath();
    D.STAT_ORDER.forEach((k, i) => { const [x, y] = pt(i, clamp(ls.stats[k], 4, 100) / 100); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.closePath();
    c.fillStyle = mix(S.color, '#ffffff', 0.45); c.globalAlpha = 0.7; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = S.color; c.lineWidth = 2; c.stroke();
    c.restore();
    D.STAT_ORDER.forEach((k, i) => {
      const [x, y] = pt(i, 1.24);
      T(c, adult ? D.STATS[k].adult : D.STATS[k].name, x, y - 9, 10, D.STATS[k].color, 'center');
      T(c, `${ls.stats[k]}`, x, y + 2, 10, P.ink, 'center');
    });
    // the stage's own page
    card(c, 238, 132, 392, 116, P.card, P.edge);
    this.stagePage(c, ls, d, 250, 138, 370);
    // settings and moves
    card(c, 238, 254, 392, 82, P.card, P.edge);
    this.list(c, 244, 258, 378, 74, 26, this.rows(), (row, x, y, w, h, on) => this.actRow(c, row.a, x, y, w, h, on), { empty: '変えられる設定はない' });
  }
  stagePage(c, ls, d, x, y, w) {
    const g = this.g, S = D.STAGES[ls.id];
    T(c, ls.label, x, y, 13, S.color, 'left', w);
    const kv = (yy, k, v, col = P.ink) => { T(c, k, x, yy, 10, P.dim); T(c, v, x + w, yy, 10, col, 'right', w - 90); };
    const bar = (yy, label, f, col, val) => { T(c, label, x, yy, 10, P.dim); R(c, x + 80, yy + 3, w - 150, 6, '#ece4d3'); R(c, x + 80, yy + 3, Math.round((w - 150) * clamp(f, 0, 1)), 6, col); T(c, val, x + w, yy, 10, P.ink, 'right'); };
    if (ls.id === 'high' && ls.high) {
      const H = ls.high, rate = H.tatt.p + H.tatt.n ? H.tatt.p / (H.tatt.p + H.tatt.n) : 1;
      kv(y + 20, '部活', H.club ? D.CLUBS[H.club].name : '未定');
      bar(y + 34, '今学期の出席', rate, rate < D.HIGH_TYPES[H.type].req ? P.red : S.color, `${Math.round(rate * 100)}%`);
      kv(y + 48, '進路', H.plan ? ({ koku: '国公立大学', shi: '私立大学', job: '就職', geino: '芸能の道' })[H.plan] + (H.exam ? (H.exam.pass ? '（合格！）' : '（不合格）') : '') : '3年の秋に決める');
      const rep = H.reports[H.reports.length - 1];
      if (rep) { T(c, `通知表（${rep.label}）平均 ${rep.avg}`, x, y + 64, 10, P.ink); rep.rows.forEach(([n, m], i) => { const xx = x + i * (w / 7); pill(c, xx, y + 78, w / 7 - 4, 26, m >= 4 ? mix(S.color, '#ffffff', 0.7) : m <= 2 ? '#f6dcd6' : '#eee7d8'); T(c, n, xx + (w / 7 - 4) / 2, y + 80, 9, P.dim, 'center'); T(c, `${m}`, xx + (w / 7 - 4) / 2, y + 91, 11, m <= 2 ? P.red : P.ink, 'center'); }); }
      else T(c, '通知表は、学期の終わりにもらえる', x, y + 70, 10, P.faint);
      return;
    }
    if (ls.id === 'uni' && ls.uni) {
      const U = ls.uni;
      if (!U.started) { para(c, '合格おめでとう！ 4月の入学式から大学生。入学したら、履修とサークルを決めよう。', x, y + 22, w, 11, P.ink, 16); return; }
      bar(y + 20, '単位', U.credits / 124, S.color, `${U.credits}/124`);
      bar(y + 34, '卒業論文', U.thesis / 100, S.color, `${U.thesis}%`);
      kv(y + 48, 'サークル', U.circle ? D.CIRCLES[U.circle].name : '未定');
      kv(y + 62, '履修', ({ light: 'ゆるめ（週2日）', normal: 'ふつう（週3日）', heavy: 'がっつり（週5日）' })[U.load]);
      kv(y + 76, '就活', U.shk.chosen ? `${D.INDUSTRIES[U.shk.chosen].name}に内定` : `手ごたえ ${Math.round(U.shk.pts)}・内定 ${U.shk.offers.length}社`);
      kv(y + 90, '学費', `${U.kind === 'koku' ? '国公立' : '私立'}${U.loan.left ? `・奨学金 ${fmtMoney(U.loan.left)}` : ''}`);
      return;
    }
    const J = ls.job;
    if (J) {
      const I = D.INDUSTRIES[J.ind];
      kv(y + 20, '勤め先', I.name);
      // the ladder
      const n = D.CO_RANKS.length, sw = (w - 4) / n;
      D.CO_RANKS.forEach((r, i) => { const xx = x + i * sw; pill(c, xx, y + 34, sw - 3, 14, i < J.rank ? mix(S.color, '#ffffff', 0.45) : i === J.rank ? S.color : '#ece4d3'); T(c, r.name.replace('新入社員', '新人').replace('一般社員', '一般'), xx + (sw - 3) / 2, y + 36, 8, i === J.rank ? '#fff' : P.dim, 'center', sw - 4); });
      const last = J.evals.length ? J.evals[J.evals.length - 1].score : 0;
      kv(y + 54, '週給', fmtMoney(Math.round(D.CO_RANKS[J.rank].pay * I.pay)));
      kv(y + 68, '前回の査定', last ? '★'.repeat(last) + '☆'.repeat(5 - last) : 'まだ（毎年4月）');
      kv(y + 82, '有給・今年の欠勤', `${J.leave}日・${J.wk.n}日`, J.wk.n > 4 ? P.red : P.ink);
    } else if (ls.ronin) {
      para(c, `浪人生。予備校に通いながら、2月の${D.entranceTest(dateOf(g).year + (dateOf(g).month >= 2 ? 1 : 0))}・入試をめざす。「予備校で勉強する」で学力を上げよう。`, x, y + 22, w, 11, P.ink, 16);
    } else {
      const lines = (d.career || []).filter((x0) => x0.k !== 'job' && !(ls.id === 'senior' && x0.k === 'pension'));
      if (lines.length) lines.slice(0, ls.id === 'senior' ? 1 : 3).forEach((r, i) => { T(c, r.label, x, y + 22 + i * 28, 10, P.dim); T(c, r.value, x + 40, y + 20 + i * 28, 12, P.ink, 'left', w - 40); T(c, r.sub || '', x + 40, y + 34 + i * 28, 9, P.dim, 'left', w - 40); });
      else if (ls.id === 'senior') para(c, 'これからは、自分のペースで。趣味・ボランティア・孫との時間…。', x, y + 22, w, 11, P.ink, 16, 2);
      else para(c, '会社には勤めていない。芸能・政治・アルバイト…どの道で生きていくか。会社員になりたければ、下の「会社をさがす」から。', x, y + 22, w, 11, P.ink, 16);
    }
    if (ls.id === 'senior') {
      R(c, x, y + 66, w, 48, '#fffdf8');
      kv(y + 68, '年金', ls.pension ? `週 ${fmtMoney(ls.pension.week)}（会社勤め 約${ls.coYears}年）` : `${D.pensionAge(dateOf(g).year)}歳から`);
      kv(y + 82, '趣味', ls.hobby ? D.HOBBIES[ls.hobby].name : 'まだ（「趣味の教室をえらぶ」）');
      kv(y + 96, '孫・健康', `${(ls.grand || []).length ? `孫 ${ls.grand.length}人（${ls.grand.map((x0) => x0.n).join('・')}）` : '孫はまだ'}・健康 ${ls.stats.ken}`, ls.stats.ken < 40 ? P.red : P.ink);
    }
    if (ls.id === 'middle') {
      const ck = ls.mid && ls.mid.check;
      T(c, `健康 ${ls.stats.ken}${ck ? `・健康診断 ${ck.grade}` : ''}${ls.mid && ls.mid.care ? '・親の介護を手伝っている' : ''}`, x, y + 98, 10, ls.stats.ken < 40 ? P.red : D.STATS.ken.color, 'left', w);
    }
  }
  // ---------------------------------------------------------------- 子育て
  drawKids(c, d, se) {
    const g = this.g, P0 = d.parent, kids = d.kids || [];
    card(c, 10, 76, 620, 30, P.card, P.edge);
    if (P0) {
      icon(c, 'heart', 20, 84, '#e0577f');
      T(c, `親キャリア：${P0.name}`, 40, 83, 12, P.ink, 'left', 260);
      const f = P0.next ? (P0.pts - P0.min) / Math.max(1, P0.next - P0.min) : 1;
      R(c, 330, 88, 220, 6, '#ece4d3'); R(c, 330, 88, Math.round(220 * clamp(f, 0, 1)), 6, '#e0577f');
      T(c, P0.next ? `${P0.pts}/${P0.next}pt` : `${P0.pts}pt`, 618, 83, 10, P.dim, 'right');
      const gr = (d.ls && d.ls.grand) || [];
      if (gr.length) T(c, `孫 ${gr.length}人`, 322, 83, 10, '#e0577f', 'right');
    }
    if (!kids.length) {
      card(c, 10, 112, 620, 224, P.card, P.edge);
      // a little family under a roof
      const fx = 90, fy = 150;
      R(c, fx - 30, fy + 40, 120, 60, '#f3eadb'); for (let i = 0; i < 40; i++) R(c, fx + 30 - i * 1.7, fy + i, i * 3.4, 1, '#e7b48c');
      disc(c, fx, fy + 62, 8, '#e0b896'); disc(c, fx + 30, fy + 64, 7, '#e8c4a2'); disc(c, fx + 54, fy + 70, 5, '#f0d0b0');
      R(c, fx - 7, fy + 70, 14, 22, se.acc); R(c, fx + 24, fy + 71, 12, 20, '#7a9ad0'); R(c, fx + 50, fy + 75, 9, 14, '#f0a030');
      T(c, '親キャリアは、子どもを迎えるとはじまります', 240, 128, 13, P.ink, 'left', 380);
      para(c, 'スマホのアプリ「恋のはなし」で、好きな人とお付き合い → 結婚。夫婦で「子どものこと」を話しあうと、子どもを授かったり、迎えたりできます（養子・里親の道もあります）。\n\n子どもが生まれたら、ここで赤ちゃん・小学生・中学生・高校生と、それぞれの時期に合った子育てができます。読み聞かせ、宿題、習いごと、塾、運動会、反抗期、進路…。親ポイントがたまると、親の称号が上がります。', 240, 150, 380, 11, P.dim, 16, 11);
      return;
    }
    // the children
    card(c, 10, 112, 206, 224, P.card, P.edge);
    const rows = this.rows();
    const kidRows = rows.filter((r) => r.kind === 'kid'), actRows = rows.filter((r) => r.kind === 'kidact');
    const sel = this.sel.kids | 0;
    this.list(c, 16, 118, 192, 212, 42, kidRows, (row, x, y, w, h, on) => {
      const k = row.k, S = D.STAGES[k.stage === 'adult' ? 'work' : k.stage];
      const selected = row.i === this.kidSel;
      if (selected && !on) { R(c, x, y, w, h - 2, mix(S.color, '#ffffff', 0.85)); R(c, x, y, 3, h - 2, S.color); }
      disc(c, x + 22, y + 19, 16, mix(S.color, '#ffffff', 0.7));
      if (k.look) safe(() => drawFaceHD(c, k.look, x + 6, y + 7, 1));
      T(c, k.name, x + 44, y + 4, 12, P.ink, 'left', w - 70);
      T(c, `${k.years}歳・${k.stageName}${k.away ? '（別居）' : ''}`, x + 44, y + 20, 9, P.dim, 'left', w - 50);
      icon(c, 'heart', x + w - 20, y + 4, k.joy >= 70 ? '#e0577f' : k.joy >= 45 ? '#f0a0b4' : '#c8bda6');
    }, { sel, base: 0, key: 'k' });
    const k = kids[this.kidSel];
    card(c, 222, 112, 408, 116, P.card, P.edge);
    if (k) {
      const S = D.STAGES[k.stage === 'adult' ? 'work' : k.stage];
      T(c, `${k.name}（${k.years}歳）`, 234, 118, 13, S.color, 'left', 200);
      pill(c, 520, 118, 98, 16, S.color); T(c, k.stageName, 569, 120, 10, '#fff', 'center', 92);
      D.STAT_ORDER.forEach((s, i) => {
        const col = i % 2, rowI = Math.floor(i / 2), x = 234 + col * 196, y = 140 + rowI * 16;
        T(c, D.STATS[s].name, x, y, 9, P.dim); R(c, x + 44, y + 3, 110, 5, '#ece4d3'); R(c, x + 44, y + 3, Math.round(110 * k.stats[s] / 100), 5, D.STATS[s].color); T(c, `${k.stats[s]}`, x + 182, y, 9, P.ink, 'right');
      });
      const bits = [];
      if (k.hoiku) bits.push('保育園');
      if (k.lesson) bits.push(`習いごと：${D.LESSONS[k.lesson].name}`);
      if (k.juku) bits.push('塾');
      if (k.club) bits.push(D.CLUBS[k.club].name);
      if (k.hs) bits.push(k.hs === 'geino' ? '芸術・専門コースの高校' : D.HIGH_TYPES[k.hs].name);
      if (k.after) bits.push(k.after.kind === 'uni' ? (k.after.job ? `卒業→${D.INDUSTRIES[k.after.job].name}` : '大学生') : k.after.kind === 'senmon' ? (k.after.job ? `専門卒→${D.INDUSTRIES[k.after.job].name}` : '専門学校生') : `${D.INDUSTRIES[k.after.ind].name}で働く`);
      T(c, bits.length ? bits.join('・') : (k.stage === 'baby' ? 'すくすく育っている' : '習いごとはしていない'), 234, 192, 10, P.ink, 'left', 384);
      const rep = k.report;
      T(c, rep ? `最近の通知表（${rep.label}）平均 ${rep.avg}：${rep.rows.slice(0, 4).map(([n, m]) => `${n}${m}`).join(' ')}` : (k.stage === 'baby' ? '通知表は小学生から' : k.stage === 'adult' ? '学校は卒業した' : '通知表は学期の終わりにもらえる'), 234, 208, 9, P.dim, 'left', 384);
    }
    card(c, 222, 234, 408, 102, P.card, P.edge);
    this.list(c, 228, 238, 394, 94, 26, actRows, (row, x, y, w, h, on) => this.actRow(c, row.a, x, y, w, h, on), { sel, base: kidRows.length, key: 'a', empty: 'いまできることはない' });
  }
  // ---------------------------------------------------------------- 年表
  drawHist(c, d, se) {
    const ls = d.ls, age = ls ? ls.age : 20;
    card(c, 10, 76, 620, 66, P.card, P.edge);
    T(c, '人生の年表', 22, 82, 12, P.ink);
    const maxA = Math.max(70, Math.ceil((age + 10) / 10) * 10), X0 = 30, X1 = 610;
    const xa = (a) => X0 + (clamp(a, 0, maxA) / maxA) * (X1 - X0);
    const segs = [['baby', 0, 6], ['elem', 6, 12], ['mid', 12, 15], ['high', 15, 18], [ls && ls.uni ? 'uni' : 'work', 18, 22], ['work', 22, 40], ['middle', 40, 65], ['senior', 65, Math.max(65, maxA)]];
    for (const [sid, a, b] of segs) { const col = D.STAGES[sid].color; R(c, xa(a), 108, xa(b) - xa(a), 10, a <= age ? col : mix(col, '#ffffff', 0.7)); }
    for (let a = 0; a <= maxA; a += 10) { R(c, xa(a), 120, 1, 4, P.faint); T(c, `${a}`, xa(a), 125, 9, P.dim, 'center'); }
    for (const h of (d.hist || [])) R(c, xa(h.a) - 1, 101, 3, 5, KIND_COL[h.k] || P.dim);
    R(c, xa(age) - 1, 98, 3, 24, se.dark);
    T(c, `いま ${age}歳`, xa(age), 86, 10, se.dark, 'center');
    card(c, 10, 148, 620, 188, P.card, P.edge);
    this.list(c, 16, 154, 606, 178, 22, this.rows(), (row, x, y, w, h, on) => {
      if (row.kind === 'origin') { icon(c, 'star', x + 8, y + 4, '#f08cb0'); T(c, '生い立ちをふりかえる（赤ちゃん・小学生・中学生を遊ぶ）', x + 28, y + 4, 12, P.ink, 'left', w - 60); if (on) { pill(c, x + w - 30, y + 4, 22, 12, se.acc); T(c, 'A', x + w - 19, y + 5, 9, '#fff', 'center'); } return; }
      const hh = row.h, col = KIND_COL[hh.k] || P.dim;
      pill(c, x + 6, y + 3, 40, 15, col); T(c, `${hh.a}歳`, x + 26, y + 5, 9, '#fff', 'center');
      T(c, hh.t, x + 54, y + 4, 11, P.ink, 'left', w - 64);
    }, { empty: 'まだ何もない' });
  }
  // ---------------------------------------------------------------- 家計
  drawMoney(c, d, se) {
    const st = this.g.state, led = d.ledger || { weeks: [], costs: [] };
    card(c, 10, 76, 300, 260, P.card, P.edge);
    T(c, '所持金', 22, 84, 11, P.dim);
    T(c, fmtMoney(num(st.money)), 298, 80, 22, P.ink, 'right', 200);
    R(c, 22, 110, 276, 1, P.edge);
    T(c, '毎週の決まった出入り（目安）', 22, 116, 11, P.ink);
    const rows = this.rows();
    this.list(c, 18, 134, 284, 150, 22, rows, (row, x, y, w, h, on) => {
      const [label, amt] = row.c;
      T(c, label, x + 8, y + 4, 11, P.ink, 'left', w - 110);
      T(c, `${amt >= 0 ? '+' : '-'}${fmtMoney(Math.abs(amt))}`, x + w - 6, y + 4, 11, amt >= 0 ? P.green : P.red, 'right');
    }, { empty: '決まった出入りはない' });
    const tot = (led.costs || []).reduce((a, x) => a + x[1], 0);
    R(c, 22, 290, 276, 1, P.edge);
    T(c, '1週間あたり', 22, 296, 11, P.dim);
    T(c, `${tot >= 0 ? '+' : '-'}${fmtMoney(Math.abs(tot))}`, 298, 296, 13, tot >= 0 ? P.green : P.red, 'right');
    const rent = (led.costs || []).find((x) => /家賃/.test(x[0]));
    const weeks = rent && rent[1] < 0 ? Math.floor(num(st.money) / -rent[1]) : null;
    T(c, weeks != null ? `いまのお金で、家賃 約${weeks}週分` : '芸能や会社の仕事のギャラは、ここに入っていない', 22, 316, 9, weeks != null && weeks < 3 ? P.red : P.dim, 'left', 276);
    // ledger chart
    card(c, 318, 76, 312, 260, P.card, P.edge);
    T(c, '最近の家計簿（生活のお金）', 330, 84, 11, P.ink);
    const ws = (led.weeks || []).slice(-8);
    const base = 190, bw = 30;
    R(c, 330, base, 288, 1, P.faint);
    const maxV = Math.max(1, ...ws.map((w) => Math.max(w.items.filter((i) => i[1] > 0).reduce((a, i) => a + i[1], 0), -w.items.filter((i) => i[1] < 0).reduce((a, i) => a + i[1], 0))));
    ws.forEach((w, i) => {
      const inc = w.items.filter((x) => x[1] > 0).reduce((a, x) => a + x[1], 0), out = -w.items.filter((x) => x[1] < 0).reduce((a, x) => a + x[1], 0);
      const x = 340 + i * 35, hi = Math.round((inc / maxV) * 80), ho = Math.round((out / maxV) * 60);
      R(c, x, base - hi, bw / 2, hi, '#5fb07a'); R(c, x + bw / 2, base + 1, bw / 2, ho, '#e07a6a');
      T(c, `${w.w}週`, x + bw / 2, base + 64, 8, P.dim, 'center');
    });
    if (!ws.length) T(c, '月曜の朝に、1週間ぶんが記録される', 474, 140, 10, P.faint, 'center');
    const lastW = ws[ws.length - 1];
    if (lastW) lastW.items.slice(-4).forEach((it, i) => { T(c, it[0], 330, 266 + i * 16, 10, P.ink, 'left', 180); T(c, `${it[1] >= 0 ? '+' : '-'}${fmtMoney(Math.abs(it[1]))}`, 618, 266 + i * 16, 10, it[1] >= 0 ? P.green : P.red, 'right'); });
  }
  // ---------------------------------------------------------------- modals
  drawModal(c, m, se) {
    if (m.kind === 'scene') { this.drawScene(c, m, se); return; }
    R(c, 0, 0, SW, SH, 'rgba(40,30,20,0.45)');
    if (m.kind === 'page') {
      const S = D.STAGES[m.stage || 'elem'] || D.STAGES.elem;
      const x = 70, y = 52, w = 500, h = 250;
      card(c, x, y, w, h, '#fffaf0', S.color);
      R(c, x + 2, y + 2, w - 4, 36, S.color);
      disc(c, x + 40, y + 20, 26, '#ffffff'); disc(c, x + 40, y + 20, 23, mix(S.color, '#ffffff', 0.3));
      T(c, m.age != null ? `${m.age}` : '★', x + 40, y + 8, m.age != null && m.age >= 10 ? 18 : 20, '#ffffff', 'center');
      T(c, m.age != null ? '歳' : '', x + 40, y + 29, 9, '#ffffff', 'center');
      T(c, m.title, x + 76, y + 10, 15, '#ffffff', 'left', w - 90);
      let yy = y + 56;
      for (const l of m.lines) yy = para(c, l, x + 28, yy, w - 56, 13, /^（/.test(l) ? S.color : P.ink, 20) + 6;
      T(c, 'A で次へ', x + w - 16, y + h - 20, 10, P.dim, 'right');
      return;
    }
    if (m.kind === 'info') {
      const w = 460, lines = m.lines.flatMap((l) => wrap(c, String(l), w - 40, 12));
      const h = Math.min(260, 64 + lines.length * 18);
      const x = (SW - w) / 2, y = (SH - h) / 2;
      card(c, x, y, w, h, P.card, se.acc);
      R(c, x + 2, y + 2, w - 4, 28, se.acc);
      T(c, m.title, x + 16, y + 9, 13, '#fff', 'left', w - 32);
      lines.slice(0, Math.floor((h - 64) / 18)).forEach((l, i) => T(c, l, x + 20, y + 40 + i * 18, 12, P.ink));
      T(c, 'A でとじる', x + w - 14, y + h - 18, 10, P.dim, 'right');
      return;
    }
    // pick
    const S = m.stage ? D.STAGES[m.stage] : null;
    const acc = S ? S.color : se.acc;
    const w = 470, noteL = m.note ? wrap(c, m.note, w - 36, 11).slice(0, 4) : [];
    const rowH = 30, vis = Math.min(m.items.length, 7);
    const h = 44 + noteL.length * 16 + vis * rowH + 18;
    const x = (SW - w) / 2, y = Math.max(8, (SH - h) / 2);
    m.box = { x, y, w, h };
    card(c, x, y, w, h, P.card, acc);
    R(c, x + 2, y + 2, w - 4, 30, acc);
    T(c, m.title, x + 16, y + 9, 13, '#fff', 'left', w - 32);
    let yy = y + 40;
    noteL.forEach((l) => { T(c, l, x + 18, yy, 11, P.dim); yy += 16; });
    if (m.idx < m.top) m.top = m.idx;
    if (m.idx >= m.top + vis) m.top = m.idx - vis + 1;
    m.rects = [];
    m.items.slice(m.top, m.top + vis).forEach((it, j) => {
      const i = m.top + j, ry = yy + j * rowH, on = i === m.idx;
      if (on) { R(c, x + 8, ry, w - 16, rowH - 3, P.sel); frame(c, x + 8, ry, w - 16, rowH - 3, P.selEdge); R(c, x + 8, ry, 3, rowH - 3, acc); }
      T(c, it.label, x + 20, ry + 3, 12, it.lock ? P.faint : P.ink, 'left', w * 0.5);
      if (it.sub) T(c, it.sub, x + 20, ry + 16, 9, P.dim, 'left', w - 40);
      if (it.lock) T(c, it.lock, x + w - 18, ry + 3, 9, P.lock, 'right', w * 0.4);
      m.rects[i] = { x: x + 8, y: ry, w: w - 16, h: rowH - 3 };
    });
    if (m.items.length > vis) T(c, `${m.idx + 1}/${m.items.length}`, x + w - 14, y + h - 16, 9, P.dim, 'right');
    T(c, m.noCancel ? '↑↓ えらぶ　A 決定' : '↑↓ えらぶ　A 決定　B もどる', x + 14, y + h - 16, 9, P.dim);
  }
  // a picture across the top (320x112 at 2x) and the words in a band below; 生い立ち's pages carry the age badge
  drawScene(c, m, se) {
    if (!this.artCv) { const [cv, cx] = makeCanvas(ART_W, ART_H); this.artCv = cv; this.artCx = cx; }
    const ax = this.artCx;
    ax.clearRect(0, 0, ART_W, ART_H);
    const ok = safe(() => drawLifeArt(ax, m.art, this.t - num(m.t0), m.X || this.artX()), false);
    R(c, 0, 0, SW, SH, '#1a1620');
    if (ok) { const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false; c.drawImage(this.artCv, 0, 0, ART_W, ART_H, 0, 0, SW, ART_H * 2); c.imageSmoothingEnabled = sm; }
    const S = m.page ? D.STAGES[m.stage || 'elem'] : null;
    const acc = S ? S.color : se.acc;
    const y0 = ART_H * 2;
    R(c, 0, y0, SW, SH - y0, P.card); R(c, 0, y0, SW, 3, acc);
    let tx = 18;
    if (m.page) { disc(c, 40, y0 + 2, 24, '#ffffff'); disc(c, 40, y0 + 2, 21, acc); T(c, m.age != null ? `${m.age}` : '★', 40, y0 - 10, 17, '#ffffff', 'center'); T(c, m.age != null ? '歳' : '', 40, y0 + 9, 9, '#ffffff', 'center'); tx = 74; }
    pill(c, tx, y0 + 10, Math.min(360, measure(c, m.title, 12) + 20), 20, acc);
    T(c, m.title, tx + 10, y0 + 13, 12, '#ffffff', 'left', 340);
    let yy = y0 + 38;
    for (const l of m.lines) { yy = para(c, l, 18, yy, SW - 36, 12, /^（/.test(l) ? acc : P.ink, 17, Math.max(1, Math.floor((SH - 14 - yy) / 17))) + 2; if (yy > SH - 20) break; }
    T(c, m.page ? 'A で次へ' : 'A でとじる', SW - 14, SH - 16, 10, P.dim, 'right');
  }
  // ---------------------------------------------------------------- portrait lower screen (bigtext.js)
  portraitKey() { return `${this.tab}|${this.sel[this.tabId] | 0}|${this.kidSel}|${this.dataT}|${this.modal ? this.modal.kind + (this.modal.idx | 0) : ''}`; }
  portraitSpec() {
    const d = this.d || {}, ls = d.ls, se = this.se || SEASON(4);
    const tabs = { items: TABS.map((t) => t.label), index: this.tab, onPick: (i) => this.setTab(i) };
    if (this.modal) {
      const m = this.modal;
      if (m.kind === 'pick') return { color: se.acc, title: m.title, light: true, lines: m.note ? [m.note] : [], list: { items: m.items.map((it) => ({ label: it.label, sub: it.sub || '', dim: !!it.lock })), index: m.idx, onPick: (i) => { m.idx = i; if (!m.items[i].lock) this.endModal(i); } } };
      return { color: se.acc, title: m.title, light: true, lines: m.lines, onTap: () => { if (m.kind !== 'scene' || this.t - num(m.t0) >= 12) this.endModal(0); } };
    }
    const rows = this.rows();
    const label = (r) => (r.kind === 'inbox' ? `✉ ${r.it.title}` : r.kind === 'act' || r.kind === 'kidact' ? r.a.name : r.kind === 'kid' ? `${r.k.name}（${r.k.years}歳・${r.k.stageName}）` : r.kind === 'origin' ? '生い立ちをふりかえる' : r.kind === 'hist' ? `${r.h.a}歳　${r.h.t}` : r.kind === 'cost' ? `${r.c[0]}　${r.c[1] >= 0 ? '+' : '-'}${fmtMoney(Math.abs(r.c[1]))}` : '');
    const sub = (r) => (r.kind === 'act' || r.kind === 'kidact' ? (r.a.why ? `🔒 ${r.a.why}` : r.a.sub) : r.kind === 'inbox' ? r.it.text : '');
    const blocks = [];
    if (ls) {
      blocks.push({ kv: ['いま', `${ls.age}歳・${ls.label}`] });
      if (this.tabId === 'today') { const st = this.g.state; blocks.push({ bar: ['体力', num(st.stamina) / Math.max(1, num(st.maxStamina, 100)), '#e0574a', `${num(st.stamina)}`] }, { kv: ['所持金', fmtMoney(num(st.money))] }); if (ls.duty) blocks.push({ kv: ['今日', `${ls.duty.label} ${hm(ls.duty.start)}〜${hm(ls.duty.end)}`] }); }
      if (this.tabId === 'career') for (const k of D.STAT_ORDER) blocks.push({ bar: [ls.id === 'work' || ls.id === 'middle' || ls.id === 'senior' ? D.STATS[k].adult : D.STATS[k].name, ls.stats[k] / 100, D.STATS[k].color, `${ls.stats[k]}`] });
      if (this.tabId === 'kids' && d.parent) {
        blocks.push({ kv: ['親キャリア', `${d.parent.name}（${d.parent.pts}pt）`] });
        const k = (d.kids || [])[this.kidSel];
        if (k) { blocks.push({ h: `${k.name}（${k.years}歳・${k.stageName}）`, c: D.STAGES[k.stage === 'adult' ? 'work' : k.stage].color }); for (const s2 of D.STAT_ORDER) blocks.push({ bar: [D.STATS[s2].name, k.stats[s2] / 100, D.STATS[s2].color, `${k.stats[s2]}`] }); if (k.report) blocks.push({ kv: ['通知表', `${k.report.label} 平均${k.report.avg}`] }); }
      }
    }
    return { sid: `life_${this.tabId}`, color: (ls && ls.color) || se.acc, title: `生活｜${TABS[this.tab].label}`, light: true, tabs, blocks, list: { items: rows.map((r) => ({ label: label(r), sub: sub(r), dim: !!(r.a && r.a.why) })), index: this.sel[this.tabId] | 0, onPick: (i) => { this.sel[this.tabId] = i; this.act(() => this.activate(rows[i])); } } };
  }
}
function line(c, x1, y1, x2, y2, col) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  c.fillStyle = col;
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x1 + ((x2 - x1) * i) / n), Math.round(y1 + ((y2 - y1) * i) / n), 1, 1);
}

export async function openLifeScreen(g, opts = {}) {
  if (!g || !g.state) return null;
  if (g.auto && !g.auto.lifeui) return null;
  if (sceneOf(g)) return null;
  sfx('ok');
  return new Promise((resolve) => { const sc = new LifeScene(g, opts, resolve); g.push(sc); });
}
Object.defineProperty(Game.prototype, 'lifeScreen', { value: function lifeScreen(tab, opts = {}) { return openLifeScreen(this, { ...opts, tab }); }, writable: true, configurable: true });

// ---------------------------------------------------------------- the phone app 「生活」
const APP_COLOR = '#d27a2c';
function appIcon(c, x, y) {
  appTile(c, x, y, APP_COLOR);
  R(c, x + 7, y + 8, 18, 17, '#fff7e8'); R(c, x + 7, y + 8, 18, 4, '#f05a5a');
  R(c, x + 10, y + 6, 2, 4, '#5a3a20'); R(c, x + 20, y + 6, 2, 4, '#5a3a20');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R(c, x + 10 + i * 5, y + 14 + j * 4, 3, 2, i === 1 && j === 1 ? '#f05a5a' : '#c8b89a');
}
registerPhoneApp('seikatsu', {
  name: '生活', color: APP_COLOR, order: 30.2,
  iconHD: appIcon,
  badge: (g) => { try { return (g.lifeInbox() || []).length; } catch (e) { return 0; } },
  open: (g) => openLifeScreen(g),
});
if (typeof window !== 'undefined') window.__lifeui = { scene: () => sceneOf(window.__game), open: openLifeScreen, TABS };
