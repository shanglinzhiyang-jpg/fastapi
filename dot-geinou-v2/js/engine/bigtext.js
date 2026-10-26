// 縦画面の「大きな文字」パネル (R12-U1).
// On a portrait phone (body.touch, taller than wide) the 640x360 game screen is only about 412x232 CSS px, and the room between it and
// the touch pad stays empty. This facility fills that room with a second canvas ("the lower screen") that shows the SELECTED item's text in
// 18-22 px type; the small canvas above stays the list / overview. world_ui_sub.js (R9-E) does this for 世界情勢 only; this is the general form.
//
// USE (a scene needs no code change):
//   registerBigtext({ id, match(scene, g) → bool, key(scene, g) → string (cheap; the panel rebuilds only when it changes),
//                     spec(scene, g) → spec })            // see bigtext_screens.js for the screens that are covered
//   or give a scene a method  portraitSpec(g) → spec  (+ optional portraitKey(g) → string): it is picked up while that scene is on top.
//   g.portraitPanel (after the first use) = the PortraitPanel: .on() (enabled and there is room), .tick(), .tap(), .scrollBy(dy).
//
// SPEC  { sid?: scroll identity (the scroll resets when it changes; default adapter id + title)
//         color: accent '#rrggbb', title, tag?, sub?, hint? (top right, small), light?: true (paper look)
//         pal?: { bg, ink, dim, line, sel, chip, head, accent } overrides the colours of the light / dark look
//         tabs?: { items: [label], index, onPick(i) } | [that, that]      strip(s) of big chips (46 px tall), scroll sideways
//         blocks?: [Block] | lines?: [Block]                              the scrolling body ( rows?: [[label, value, colour]] adds label / value lines after it )
//         list?: { items: [{ label, sub, right, color, dim }], index, onPick(i), rows? }   big tappable rows (46 px = 70 units) under the body
//         onTap?: () => void                                              a tap on the body (a drag scrolls); without it a tap pages down
//         mirror?: { w, h, draw(c), tap(u, v), drag?(+1 | -1) }   instead of all of the above: a live picture of a small screen, drawn in its own units
//                                              (0..w, 0..h) and scaled up to fill the room (the phone does this); taps arrive in those units
//         live?: true   redraw every frame (a mirror, or an animated panel) }
//   Block = 'text' | { t, s (size), c (color), b (emphasis), gap (space above), ind (indent) } | { h: 'heading', c } | { kv: [label, value, color] }
//         | { bar: [label, 0..1, color, valueText] } | { sep: true } | { gap: n } | { chips: [text | [text, color]] }
//
// SETTING  bigtextPref() → true | false | null (null = default: on for a portrait phone); setBigtextPref(on) remembers it in localStorage (try/catch).
//   The phone's 設定 app has the switch (phone_apps.js, [R12-U1]). bigtextEnabled() = portrait phone && pref !== false.
// No game state. Nothing happens on desktop / landscape (the panel stays hidden and costs one cheap check per frame).
import { text, wrap, measure } from './draw.js';

const LS_KEY = 'dotgeinou_bigtext';
let memPref = null; // used when localStorage is blocked
export function bigtextPref() {
  try { const v = localStorage.getItem(LS_KEY); if (v === '0') return false; if (v === '1') return true; return memPref; } catch (e) { return memPref; }
}
export function setBigtextPref(on) {
  memPref = !!on;
  try { localStorage.setItem(LS_KEY, on ? '1' : '0'); } catch (e) { /* blocked: this session only */ }
}
export function portraitPhone() {
  try { return typeof window !== 'undefined' && typeof document !== 'undefined' && !!document.body && document.body.classList.contains('touch') && window.innerHeight > window.innerWidth * 1.2 && window.innerWidth <= 600; } catch (e) { return false; }
}
export function bigtextEnabled() { return portraitPhone() && bigtextPref() !== false; }

// ---------------------------------------------------------------- adapters
const ADAPTERS = [];
export function registerBigtext(a) { const i = ADAPTERS.findIndex((x) => x.id === a.id); if (i >= 0) ADAPTERS[i] = a; else ADAPTERS.push(a); }
export function bigtextAdapters() { return ADAPTERS.slice(); }

// ---------------------------------------------------------------- look
const DARK = { bg: '#0a1124', ink: '#f2f4ff', dim: '#a4acd0', line: '#26335c', sel: '#1c2a5c', selEdge: '#ffd23f', chip: '#16224a', head: '#101a38', accent: '#ffd23f' };
const LIGHT = { bg: '#f3ecd8', ink: '#1e1d22', dim: '#5d5a52', line: '#c9bfa2', sel: '#e3d6b4', selEdge: '#8a5a10', chip: '#e4dac0', head: '#ece2c6', accent: '#8a3a10' };
const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", monospace';
const PADX = 14, BODY = 18, ROW_H = 46, TAB_H = 36, LH = 1.55;

const hexLum = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) return 0.3; const n = parseInt(m[1], 16); return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; };
const inkOn = (bg) => (hexLum(bg) > 0.62 ? '#1a1a28' : '#ffffff');
function ell(c, s, maxW, size) {
  s = String(s);
  if (measure(c, s, size) <= maxW) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > maxW) a.pop();
  return a.join('') + '…';
}
function tx(c, s, x, y, size, col, align = 'left') { text(c, s, x, y, { size, color: col, align, shadow: null }); }
function rrect(c, x, y, w, h, r, col) {
  c.fillStyle = col; c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  c.fill();
}

// ---------------------------------------------------------------- the panel
export class PortraitPanel {
  constructor(g) {
    this.g = g;
    this.el = document.createElement('canvas');
    this.el.id = 'bigtext-panel';
    Object.assign(this.el.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '40', display: 'none', touchAction: 'none', userSelect: 'none', webkitUserSelect: 'none' });
    this.ctx = this.el.getContext('2d');
    this.box = null; this.shown = false;
    this.owner = null; this.adapter = null; this.key = null; this.spec = null; this.L = null;
    this.sid = null; this.sy = 0; this.stripX = []; this.stripKeys = []; this.listY = 0; this.dirty = true; this.errs = 0; this.mute = 0;
    this.drag = null;
    this.bind();
    document.body.appendChild(this.el);
    const loop = () => { try { this.tick(); } catch (e) { if (this.errs++ < 3) console.error(e); else this.mute = Date.now() + 5000; } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  on() { return bigtextEnabled() && !!this.place(); }
  // the free room between the game screen and the pad (CSS px), or null when there is none
  place() {
    const gc = document.getElementById('game');
    if (!gc) return null;
    const r = gc.getBoundingClientRect();
    const pad = document.getElementById('pad');
    const pt = pad ? pad.getBoundingClientRect().top : window.innerHeight;
    const top = Math.round(r.bottom + 4), h = Math.round(pt - top - 4);
    if (h < 140 || r.width < 200) return null;
    return { x: Math.round(r.left), y: top, w: Math.round(r.width), h };
  }
  hide() { if (this.shown) { this.el.style.display = 'none'; this.shown = false; } this.owner = null; this.adapter = null; this.key = null; }
  // find what to show for the scene on top: portraitSpec() of the scene itself, else a registered adapter
  pick(top) {
    if (!top) return null;
    if (typeof top.portraitSpec === 'function') return { id: 'scene', key: (g) => (typeof top.portraitKey === 'function' ? String(top.portraitKey(g)) : String(g.frame >> 3)), spec: (s, g) => top.portraitSpec(g) };
    for (const a of ADAPTERS) { let ok = false; try { ok = !!a.match(top, this.g); } catch (e) { ok = false; } if (ok) return a; }
    return null;
  }
  tick() {
    if (this.mute && Date.now() < this.mute) return;
    const g = this.g;
    if (!g || !g.top || !bigtextEnabled() || (g.fade || 0) > 0.6) { this.hide(); return; }
    const b = this.place();
    if (!b) { this.hide(); return; }
    const top = g.top;
    const ad = this.pick(top);
    if (!ad) { this.hide(); return; }
    let key;
    try { key = String(ad.key(top, g)); } catch (e) { this.hide(); throw e; }
    if (key === 'null') { this.hide(); return; }
    const sameBox = this.box && this.box.x === b.x && this.box.y === b.y && this.box.w === b.w && this.box.h === b.h;
    if (!sameBox) { this.box = b; Object.assign(this.el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` }); this.dirty = true; this.key = null; }
    if (ad !== this.adapter || top !== this.owner || key !== this.key) {
      let spec = null;
      try { spec = ad.spec(top, g); } catch (e) { this.hide(); throw e; }
      if (!spec) { this.hide(); return; }
      this.adapter = ad; this.owner = top; this.key = key; this.spec = spec;
      const sid = spec.sid || `${ad.id}:${spec.title || ''}`;
      if (sid !== this.sid) { this.sid = sid; this.sy = 0; this.listY = 0; this.stripKeys = []; this.followKey = null; }
      this.layout();
      this.dirty = true;
    }
    if (!this.shown) { this.el.style.display = 'block'; this.shown = true; this.dirty = true; }
    if (this.spec && this.spec.live) this.dirty = true;
    if (this.dirty) { this.render(); this.dirty = false; }
  }
  // ---- layout (CSS px): header, tab strip, scrolling body, list
  layout() {
    const sp = this.spec, b = this.box, c = this.ctx;
    const W = b.w, H = b.h, iw = W - PADX * 2;
    const th = Object.assign({}, sp.light ? LIGHT : DARK, sp.pal || {});
    const L = { th, W, H, iw, head: [], headH: 0, strips: [], tabsY: 0, tabsH: 0, body: [], bodyY: 0, bodyH: 0, contentH: 0, list: null, listY: 0, listH: 0 };
    if (sp.mirror) {
      const m = sp.mirror, z = Math.min((W - 6) / m.w, (H - 4) / m.h);
      L.mirror = { z, ox: Math.round((W - m.w * z) / 2), oy: Math.round((H - m.h * z) / 2) };
      this.L = L;
      return;
    }
    // header: a tag and the hint on the first row, then the title (≤ 2 lines) and the sub line (≤ 2 lines)
    let y = 8;
    if (sp.tag || sp.hint) {
      let x = PADX;
      if (sp.tag) { const w = Math.ceil(measure(c, sp.tag, 14)) + 14; L.head.push({ k: 'chip', x, y, w, h: 22, t: sp.tag, col: sp.color || th.accent }); x += w + 8; }
      if (sp.hint) L.head.push({ k: 't', x: W - PADX, y: y + 4, t: ell(c, sp.hint, W - x - PADX, 14), s: 14, col: th.dim, al: 'right' });
      y += 28;
    }
    if (sp.title) {
      const ls = wrap(c, String(sp.title), iw, 22).slice(0, 2);
      if (wrap(c, String(sp.title), iw, 22).length > 2) ls[1] = ell(c, ls[1] + '…', iw, 22);
      for (const l of ls) { L.head.push({ k: 't', x: PADX, y, t: l, s: 22, col: sp.light ? th.ink : '#ffffff', al: 'left' }); y += 30; }
    }
    if (sp.sub) {
      const ls = wrap(c, String(sp.sub), iw, 16).slice(0, 2);
      for (const l of ls) { L.head.push({ k: 't', x: PADX, y, t: l, s: 16, col: th.dim, al: 'left' }); y += 23; }
    }
    y += 4;
    L.headH = y;
    // tab strip(s)
    const strips = sp.tabs ? [].concat(sp.tabs).filter((t) => t && t.items && t.items.length) : [];
    L.strips = strips.map((st) => {
      let x = 8;
      const items = st.items.map((lab, i) => { const w = Math.max(54, Math.ceil(measure(c, String(lab), 18)) + 26); const r = { i, x, w, t: String(lab) }; x += w + 6; return r; });
      const r = { spec: st, items, W: x + 2, y, h: TAB_H + 8, x: 0 };
      y += r.h;
      return r;
    });
    L.tabsY = L.strips.length ? L.strips[0].y : 0;
    L.tabsH = L.strips.reduce((a, r) => a + r.h, 0);
    L.bodyY = y;
    // body blocks
    // `rows` ([[label, value, colour]]) are label / value lines after the blocks
    const blocks = [...(sp.blocks || sp.lines || []), ...(sp.rows || []).map((r) => ({ kv: Array.isArray(r) ? r : [r.label, r.value, r.color] }))].filter((x) => x != null && x !== false);
    let by = 6;
    for (const bl of blocks) {
      const o = typeof bl === 'string' ? { t: bl } : bl;
      if (o.gap && !o.sep) by += o.gap;
      if (o.sep) { L.body.push({ k: 'sep', y: by + 6 }); by += 14; continue; }
      if (o.gap && o.t == null && o.h == null && !o.kv && !o.bar && !o.chips) continue;
      if (o.h != null) { const s = 16; const w = Math.ceil(measure(c, o.h, s)) + 16; L.body.push({ k: 'h', y: by + 2, t: o.h, w, col: o.c || sp.color || th.accent }); by += 32; continue; }
      if (o.kv) {
        const [k, v, col] = o.kv;
        const kw = Math.ceil(measure(c, String(k), 16)) + 10;
        const vl = wrap(c, String(v), iw - kw, 18);
        L.body.push({ k: 'kv', y: by, kt: String(k), kw, lines: vl, col: col || th.ink });
        by += Math.max(1, vl.length) * 28 + 4; continue;
      }
      if (o.bar) {
        const [lab, f, col, vt] = o.bar;
        const lw = Math.min(Math.ceil(measure(c, String(lab), 16)) + 12, Math.floor(iw * 0.5));
        L.body.push({ k: 'bar', y: by, lab: ell(c, String(lab), lw - 8, 16), lw: Math.max(100, lw), f: Math.max(0, Math.min(1, +f || 0)), col: col || sp.color || th.accent, vt: vt == null ? '' : String(vt) });
        by += 34; continue;
      }
      if (o.chips) {
        let x = PADX, cy = by;
        for (const ch of o.chips) {
          const [t, col] = Array.isArray(ch) ? ch : [ch];
          const w = Math.ceil(measure(c, String(t), 16)) + 18;
          if (x + w > W - PADX) { x = PADX; cy += 34; }
          L.body.push({ k: 'chip', x, y: cy, w, h: 28, t: String(t), col: col || th.chip });
          x += w + 6;
        }
        by = cy + 38; continue;
      }
      const size = o.s || BODY, ind = o.ind || 0;
      const col = o.c || th.ink;
      const lh = Math.round(size * LH);
      const ls = wrap(c, String(o.t == null ? '' : o.t), iw - ind - 4, size);
      L.body.push({ k: 'p', y: by, x: PADX + ind, lines: ls, s: size, col, lh, b: !!o.b });
      by += ls.length * lh + 4;
    }
    L.contentH = by + 10;
    // the list (big rows, 46 px = 70 units) at the bottom; the body keeps at least `bodyMin` px: a long list shrinks to 2 rows, then to a stepper (◀ name ▶)
    const items = sp.list && sp.list.items ? sp.list.items : null;
    if (items && items.length) {
      const want = Math.min(items.length, sp.list.rows || 3);
      const need = Math.max(sp.list.bodyMin != null ? sp.list.bodyMin : 90, Math.min(L.contentH, sp.list.bodyMax || 230));
      const room = Math.floor((H - y - 8 - need) / ROW_H);
      if (room >= 2 || sp.list.noStepper) {
        const rows = Math.max(1, Math.min(want, Math.max(room, 1)));
        L.listH = rows * ROW_H + 8; L.listRows = rows;
      } else { L.stepper = true; L.listH = ROW_H + 8; L.listRows = 1; }
      // nothing to read above the rows (a plain menu): the rows take the whole room (the last one may be cut: it scrolls)
      if (!L.stepper && !blocks.length) L.listH = H - y;
      L.listY = H - L.listH; L.listN = items.length; L.list = items;
    }
    L.bodyH = Math.max(0, H - y - L.listH);
    this.L = L;
    this.clamp();
  }
  clamp() {
    const L = this.L; if (!L) return;
    this.sy = Math.max(0, Math.min(Math.max(0, L.contentH - L.bodyH), this.sy));
    if (L.list) {
      const max = Math.max(0, L.listN * ROW_H - (L.listH - 8));
      // follow the selected row when the content (the selection) changed
      const idx = this.spec.list.index | 0;
      if (this.followKey !== `${this.sid}|${idx}`) {
        this.followKey = `${this.sid}|${idx}`;
        const top = idx * ROW_H, bot = top + ROW_H;
        if (top < this.listY) this.listY = top; else if (bot > this.listY + (L.listH - 8)) this.listY = bot - (L.listH - 8);
      }
      this.listY = Math.max(0, Math.min(max, this.listY));
    }
    L.strips.forEach((r, k) => {
      const key = `${this.sid}|${k}|${r.spec.index}`;
      const view = L.W - 16, max = Math.max(0, r.W - L.W);
      if (this.stripKeys[k] !== key) {
        this.stripKeys[k] = key;
        const t = r.items[r.spec.index | 0];
        this.stripX[k] = t ? t.x + t.w / 2 - view / 2 : 0;
      }
      this.stripX[k] = Math.max(0, Math.min(max, this.stripX[k] || 0));
    });
  }
  // ---- drawing
  render() {
    const L = this.L, sp = this.spec, b = this.box;
    if (!L || !b) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(b.w * dpr), H = Math.round(b.h * dpr);
    if (this.el.width !== W || this.el.height !== H) { this.el.width = W; this.el.height = H; }
    const c = this.ctx, th = L.th;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, b.w, b.h);
    c.fillStyle = th.bg; c.fillRect(0, 0, b.w, b.h);
    if (L.mirror) {
      const { z, ox, oy } = L.mirror, m = sp.mirror;
      c.save(); c.translate(ox, oy); c.scale(z, z); c.beginPath(); c.rect(0, 0, m.w, m.h); c.clip();
      try { m.draw(c); } catch (e) { c.restore(); throw e; }
      c.restore();
      return;
    }
    const acc = sp.color || th.accent;
    // header
    c.fillStyle = th.head; c.fillRect(0, 0, b.w, L.headH);
    c.fillStyle = acc; c.fillRect(0, 0, b.w, 3);
    for (const h of L.head) {
      if (h.k === 'chip') { rrect(c, h.x, h.y, h.w, h.h, 5, h.col); tx(c, h.t, h.x + h.w / 2, h.y + 3, 14, inkOn(h.col), 'center'); } else tx(c, h.t, h.x, h.y, h.s, h.col, h.al);
    }
    c.fillStyle = th.line; c.fillRect(0, L.headH - 1, b.w, 1);
    // tab strips
    L.strips.forEach((r, k) => {
      c.fillStyle = th.head; c.fillRect(0, r.y, b.w, r.h);
      c.save(); c.beginPath(); c.rect(0, r.y, b.w, r.h); c.clip();
      const cur = r.spec.index | 0, ax = r.spec.color || acc;
      for (const t of r.items) {
        const x = t.x - (this.stripX[k] || 0), on = t.i === cur;
        if (x > b.w || x + t.w < 0) continue;
        rrect(c, x, r.y + 4, t.w, TAB_H - 2, 8, on ? ax : th.chip);
        tx(c, t.t, x + t.w / 2, r.y + 4 + (TAB_H - 2 - 18) / 2 + 1, 18, on ? inkOn(ax) : th.ink, 'center');
      }
      c.restore();
      c.fillStyle = th.line; c.fillRect(0, r.y + r.h - 1, b.w, 1);
    });
    // body (scrolls)
    if (L.bodyH > 0) {
      c.save(); c.beginPath(); c.rect(0, L.bodyY, b.w, L.bodyH); c.clip();
      const oy = L.bodyY - this.sy;
      for (const e of L.body) {
        const y = oy + e.y;
        if (y > L.bodyY + L.bodyH || y + 400 < L.bodyY) {
          if (e.k !== 'p' || y > L.bodyY + L.bodyH || y + e.lines.length * e.lh < L.bodyY) continue;
        }
        if (e.k === 'p') { e.lines.forEach((l, i) => { const yy = y + i * e.lh; if (yy + e.lh < L.bodyY || yy > L.bodyY + L.bodyH) return; tx(c, l, e.x, yy + (e.lh - e.s) / 2 - 1, e.s, e.col); }); } else if (e.k === 'h') { rrect(c, PADX, y, e.w, 26, 5, e.col); tx(c, e.t, PADX + 8, y + 4, 16, inkOn(e.col)); } else if (e.k === 'sep') { c.fillStyle = th.line; c.fillRect(PADX, y, L.iw, 1); } else if (e.k === 'kv') {
          tx(c, e.kt, PADX, y + 6, 16, th.dim);
          e.lines.forEach((l, i) => tx(c, l, PADX + e.kw, y + i * 28 + 3, 18, e.col));
        } else if (e.k === 'bar') {
          tx(c, e.lab, PADX, y + 2, 16, th.dim);
          const bx = PADX + e.lw, bw = Math.max(40, L.iw - e.lw - (e.vt ? 64 : 0));
          c.fillStyle = th.line; c.fillRect(bx, y + 8, bw, 12);
          c.fillStyle = e.col; c.fillRect(bx, y + 8, Math.round(bw * e.f), 12);
          if (e.vt) tx(c, e.vt, b.w - PADX, y + 2, 16, th.ink, 'right');
        } else if (e.k === 'chip') { rrect(c, e.x, y, e.w, e.h, 6, e.col); tx(c, e.t, e.x + e.w / 2, y + 5, 16, inkOn(e.col), 'center'); }
      }
      c.restore();
      const max = L.contentH - L.bodyH;
      if (max > 0) {
        const bh = Math.max(24, Math.round((L.bodyH * L.bodyH) / L.contentH));
        const bt = L.bodyY + Math.round(((L.bodyH - bh) * this.sy) / max);
        c.fillStyle = th.line; c.fillRect(b.w - 4, L.bodyY, 3, L.bodyH);
        c.fillStyle = acc; c.fillRect(b.w - 4, bt, 3, bh);
        if (this.sy < max - 2) { const yy = L.bodyY + L.bodyH - 24; rrect(c, b.w - 92, yy - 3, 84, 22, 11, th.head); tx(c, '▼ つづき', b.w - 50, yy, 14, acc, 'center'); }
      }
    }
    // list (big rows) or the stepper
    if (L.list) {
      const ly = L.listY, n = L.listN, sel = sp.list.index | 0;
      c.fillStyle = th.head; c.fillRect(0, ly, b.w, L.listH);
      c.fillStyle = th.line; c.fillRect(0, ly, b.w, 1);
      if (L.stepper) {
        const it = L.list[Math.max(0, Math.min(n - 1, sel))];
        const label = typeof it === 'string' ? it : it.label;
        const bw = 60, y = ly + 4;
        rrect(c, 8, y + 2, bw, ROW_H - 4, 8, th.chip); rrect(c, b.w - 8 - bw, y + 2, bw, ROW_H - 4, 8, th.chip);
        tx(c, '◀', 8 + bw / 2, y + (ROW_H - 18) / 2, 18, sel > 0 ? th.ink : th.dim, 'center'); tx(c, '▶', b.w - 8 - bw / 2, y + (ROW_H - 18) / 2, 18, sel < n - 1 ? th.ink : th.dim, 'center');
        tx(c, ell(c, `${sel + 1}／${n}　${label}`, b.w - 2 * bw - 40, 17), b.w / 2, y + (ROW_H - 17) / 2, 17, th.ink, 'center');
      } else {
        c.save(); c.beginPath(); c.rect(0, ly + 4, b.w, L.listH - 8); c.clip();
        L.list.forEach((it, i) => {
          const y = ly + 4 + i * ROW_H - this.listY;
          if (y + ROW_H < ly || y > ly + L.listH) return;
          const on = i === sel;
          if (on) { c.fillStyle = th.sel; c.fillRect(6, y + 1, b.w - 12, ROW_H - 2); c.fillStyle = acc; c.fillRect(6, y + 1, 4, ROW_H - 2); }
          const label = typeof it === 'string' ? it : it.label, sub = typeof it === 'string' ? '' : it.sub, right = typeof it === 'string' ? '' : it.right;
          const dim = typeof it !== 'string' && it.dim;
          const col = (typeof it !== 'string' && it.color) || (dim ? th.dim : on ? inkOn(th.sel) : th.ink);
          const rt = right ? ell(c, String(right), Math.min(150, b.w * 0.36), 16) : '';
          const rw = rt ? Math.ceil(measure(c, rt, 16)) + 10 : 0;
          const avail = b.w - 28 - rw;
          if (sub) { tx(c, ell(c, label, avail, 18), 18, y + 4, 18, col); tx(c, ell(c, sub, b.w - 36 - rw, 14), 18, y + 26, 14, th.dim); } else if (measure(c, String(label), 18) > avail) {
            // a long label with nothing under it: two lines at 16 px instead of a cut-off one
            const ls = wrap(c, String(label), avail, 16);
            tx(c, ls[0], 18, y + 5, 16, col); tx(c, ls.length > 2 ? ell(c, ls[1] + ls.slice(2).join(''), avail, 16) : ls[1] || '', 18, y + 25, 16, col);
          } else tx(c, label, 18, y + (ROW_H - 18) / 2 - 1, 18, col);
          if (rt) tx(c, rt, b.w - 14, y + (ROW_H - 16) / 2 - 1, 16, (typeof it !== 'string' && it.rcol) || th.dim, 'right');
          c.fillStyle = th.line; c.fillRect(14, y + ROW_H - 1, b.w - 28, 1);
        });
        c.restore();
        if (n * ROW_H > L.listH - 8) {
          const view = L.listH - 8, total = n * ROW_H, bh = Math.max(20, Math.round((view * view) / total));
          c.fillStyle = acc; c.fillRect(b.w - 3, ly + 4 + Math.round(((view - bh) * this.listY) / (total - view)), 3, bh);
        }
      }
    }
  }
  // ---- input
  bind() {
    const el = this.el;
    const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ }
      const p = pos(e);
      const rg = this.regionAt(p.y);
      this.drag = { id: e.pointerId, x0: p.x, y0: p.y, sy: this.sy, ly: this.listY, moved: false, region: rg, strip: this.stripAt(p.y), tx: this.stripX[this.stripAt(p.y)] || 0 };
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      const p = pos(e);
      const dx = p.x - d.x0, dy = p.y - d.y0;
      if (!d.moved && Math.hypot(dx, dy) > 8) d.moved = true;
      if (!d.moved) return;
      if (d.region === 'mirror') {
        // a drag on a live copy of a small screen = the pad's ↑ / ↓ (one step per 36 px; the finger moving down scrolls up)
        const m = this.spec && this.spec.mirror, L = this.L;
        if (m && m.drag && L && L.mirror) { if (d.my == null) d.my = d.y0; const step = 36; if (Math.abs(p.y - d.my) >= step) { m.drag(p.y > d.my ? 1 : -1); d.my += (p.y > d.my ? 1 : -1) * step; } }
        return;
      }
      if (d.region === 'tabs') { this.stripX[d.strip] = d.tx - dx; } else if (d.region === 'list') this.listY = d.ly - dy; else this.sy = d.sy - dy;
      this.clampSoft(); this.dirty = true;
    });
    const end = (e, cancel) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.moved && !cancel) { const p = pos(e); try { this.tap(p.x, p.y); } catch (err) { console.error(err); } }
    };
    el.addEventListener('pointerup', (e) => end(e, false));
    el.addEventListener('pointercancel', (e) => end(e, true));
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.scrollBy(e.deltaY); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  clampSoft() {
    const L = this.L; if (!L) return;
    this.sy = Math.max(0, Math.min(Math.max(0, L.contentH - L.bodyH), this.sy));
    if (L.list) this.listY = Math.max(0, Math.min(Math.max(0, L.listN * ROW_H - (L.listH - 8)), this.listY));
    L.strips.forEach((r, k) => { this.stripX[k] = Math.max(0, Math.min(Math.max(0, r.W - L.W), this.stripX[k] || 0)); });
  }
  scrollBy(dy) { this.sy += dy; this.clampSoft(); this.dirty = true; }
  regionAt(y) {
    const L = this.L; if (!L) return 'body';
    if (L.mirror) return 'mirror';
    if (L.strips && L.strips.length && y >= L.tabsY && y < L.tabsY + L.tabsH) return 'tabs';
    if (L.list && y >= L.listY) return 'list';
    return 'body';
  }
  stripAt(y) { const L = this.L; if (!L || !L.strips) return 0; const k = L.strips.findIndex((r) => y >= r.y && y < r.y + r.h); return k < 0 ? 0 : k; }
  tap(x, y) {
    const L = this.L, sp = this.spec; if (!L || !sp) return;
    const r = this.regionAt(y);
    if (r === 'mirror') {
      const { z, ox, oy } = L.mirror, m = sp.mirror, u = (x - ox) / z, v = (y - oy) / z;
      if (u >= 0 && v >= 0 && u < m.w && v < m.h && m.tap) m.tap(u, v);
      this.dirty = true;
      return;
    }
    if (r === 'tabs') {
      const k = this.stripAt(y), st = L.strips[k];
      const px = x + (this.stripX[k] || 0);
      const t = st.items.find((t) => px >= t.x - 3 && px < t.x + t.w + 3);
      if (t && st.spec.onPick) { st.spec.onPick(t.i); this.dirty = true; }
      return;
    }
    if (r === 'list' && L.stepper) {
      const i = sp.list.index | 0, n = L.listN;
      if (x < 70) { if (i > 0 && sp.list.onPick) sp.list.onPick(i - 1); } else if (x > L.W - 70) { if (i < n - 1 && sp.list.onPick) sp.list.onPick(i + 1); } else if (sp.onTap) sp.onTap();
      this.dirty = true;
      return;
    }
    if (r === 'list') {
      const i = Math.floor((y - (L.listY + 4) + this.listY) / ROW_H);
      if (i >= 0 && i < L.listN && sp.list.onPick) sp.list.onPick(i);
      return;
    }
    if (sp.onTap) { sp.onTap(); return; }
    const max = L.contentH - L.bodyH;
    if (max > 2) { this.sy = this.sy >= max - 2 ? 0 : this.sy + Math.round(L.bodyH * 0.8); this.clampSoft(); this.dirty = true; }
  }
}


// ---------------------------------------------------------------- reading the text a screen draws
// Many HD screens draw their detail pane imperatively (text(ctx, …) here and there). captureText runs a draw function against a recording
// context (a real offscreen canvas under a Proxy that notes every fillText with its transform, font size and colour), keeps what falls inside
// `rect`, drops shadow / outline duplicates and returns the text in reading order, one entry per visual line: [{ t, size, col, y, x }].
//   captureText((c) => scene.drawScreen(c, g), { x, y, w, h })   (units of the screen the draw function uses; 640x360 for the HD screens)
let capCv = null;
export function captureText(drawFn, rect) {
  if (typeof document === 'undefined') return [];
  if (!capCv) { capCv = document.createElement('canvas'); capCv.width = 640; capCv.height = 360; }
  const real = capCv.getContext('2d');
  real.setTransform(1, 0, 0, 1, 0, 0);
  const recs = [];
  const rec = new Proxy(real, {
    get(t, k) {
      if (k === 'fillText') {
        return (s, x, y) => {
          const m = t.getTransform(), sc = Math.hypot(m.a, m.b) || 1;
          const size = (parseFloat(t.font) || 12) * sc;
          const w = t.measureText(String(s)).width * sc;
          let X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f;
          const bl = t.textBaseline;
          if (bl === 'alphabetic' || bl === 'ideographic') Y -= size * 0.85; else if (bl === 'middle') Y -= size / 2; else if (bl === 'bottom') Y -= size;
          const al = t.textAlign;
          const left = al === 'center' ? X - w / 2 : al === 'right' || al === 'end' ? X - w : X;
          recs.push({ s: String(s), left, right: left + w, y: Y, size, col: typeof t.fillStyle === 'string' ? t.fillStyle : '#ffffff' });
        };
      }
      if (k === 'strokeText') return () => {};
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  try { drawFn(rec); } catch (e) { console.error(e); }
  // inside the rect, no shadow copies (the last of the near-identical ones wins)
  const keep = [];
  for (const r of recs) {
    if (rect && (r.left < rect.x - 1 || r.left > rect.x + rect.w || r.y < rect.y - 2 || r.y > rect.y + rect.h)) continue;
    if (!r.s.trim()) continue;
    const j = keep.findIndex((q) => q.s === r.s && Math.abs(q.left - r.left) <= 2 && Math.abs(q.y - r.y) <= 2);
    if (j >= 0) keep[j] = r; else keep.push(r);
  }
  keep.sort((a, b) => a.y - b.y || a.left - b.left);
  const lines = [];
  let grp = null;
  const flush = () => {
    if (!grp) return;
    grp.p.sort((a, b) => a.left - b.left);
    let t = '', prev = null;
    for (const p of grp.p) { if (prev && p.left - prev.right > 7) t += '　'; t += p.s; prev = p; }
    const big = grp.p.reduce((a, p) => (p.size > a.size ? p : a), grp.p[0]);
    if (!/^[\s▲▼◀▶◁▷×○●■□★☆…・]+$/.test(t)) lines.push({ t, size: big.size, col: big.col, y: grp.y0, x: grp.p[0].left });
    grp = null;
  };
  for (const r of keep) {
    if (grp && r.y - grp.y0 <= Math.max(3, Math.min(grp.size, r.size) * 0.55)) { grp.p.push(r); grp.size = Math.min(grp.size, r.size); } else { flush(); grp = { p: [r], y0: r.y, size: r.size }; }
  }
  flush();
  return lines;
}
// a colour that can be read on the panel (light = the paper look)
export function fixCol(col, light) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(col || ''));
  let r = 255, g = 255, b = 255;
  if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((x) => x + x).join(''); r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); } else {
    const q = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(String(col || ''));
    if (q) { r = +q[1]; g = +q[2]; b = +q[3]; } else return light ? '#1e1d22' : '#f2f4ff';
  }
  const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
  const mix = (k, to) => `rgb(${Math.round(r + (to - r) * k)},${Math.round(g + (to - g) * k)},${Math.round(b + (to - b) * k)})`;
  if (!light && lum < 0.45) return mix(0.65, 255);
  if (light && lum > 0.6) return mix(0.7, 0);
  return `rgb(${r},${g},${b})`;
}
// captured lines → body blocks (paragraph breaks where the screen left a gap)
export function linesToBlocks(lines, light) {
  const out = [];
  let prevY = null, prevSize = 12;
  for (const l of lines) {
    const big = l.size >= 15;
    if (prevY != null && l.y - prevY > prevSize * 1.9) out.push({ gap: 8 });
    out.push({ t: l.t, s: big ? 21 : 18, c: fixCol(l.col, light) });
    prevY = l.y; prevSize = l.size;
  }
  return out;
}


// A modal of the neta kit / the 賞レース / 芸人手帳 / 世論の声 screens ({ kind: 'pick' | 'confirm' | 'info', title, lines, items | choices, idx, color })
// as a spec: its text and its choices as big rows (a tap on a row = highlight it + A). null for a modal of some other shape.
export function modalSpec(g, m, opt = {}) {
  if (m && m.kind === 'parts' && Array.isArray(m.tabs) && typeof m.items === 'function') {
    // the 台本エディタ's 部品 picker: category chips, the parts as rows, the highlighted one in full (first tap highlights, the second adds it)
    const items = m.items(), it = items[Math.max(0, Math.min(items.length - 1, m.idx | 0))];
    const role = opt.roles || { boke: 'ボケ', tsukkomi: 'ツッコミ', a: '人物A', b: '人物B', c: '人物C', narr: 'ナレ・ト書き', pin: '本人', sage: 'サゲ' }, beats = opt.beats || {};
    const chips = it ? [it.role && [role[it.role] || it.role, '#ff8a3d'], it.beat && [beats[it.twist ? 'uragiri' : it.beat] || String(it.beat), '#5a72d8'], it.theme && [`（${it.theme}）`, '#5a5a7a']].filter(Boolean) : [];
    return {
      sid: `parts:${m.title || ''}:${m.tab}`, color: opt.color || '#a98bff', title: m.title || '部品から足す', hint: 'えらんでもう一度タップ：足す　Bでとじる', pal: opt.pal, light: opt.light,
      tabs: { items: m.tabs.map((t) => t.label), index: m.tab | 0, onPick: (i) => { m.tab = i; m.idx = 0; m.top = 0; } },
      blocks: it ? [...(chips.length ? [{ chips }] : []), { t: it.text + (it.pair ? `\n→ ${it.pair.text}` : ''), s: 20 }] : [{ t: '（この時代・種類で使える部品がない）', s: 18 }],
      list: items.length ? { items: items.map((p) => ({ label: p.text + (p.pair ? `　→ ${p.pair.text}` : '') })), index: Math.max(0, Math.min(items.length - 1, m.idx | 0)), rows: 3, bodyMin: 120, onPick: (i) => { if ((m.idx | 0) === i) padPress(g, 'a'); else m.idx = i; } } : null,
      onTap: () => {},
    };
  }
  if (!m || (m.kind !== 'pick' && m.kind !== 'confirm' && m.kind !== 'info')) return null;
  const pick = m.kind === 'pick';
  const raw = pick ? (m.items || []) : (m.choices || ['OK']).map((c) => ({ label: c }));
  if (!Array.isArray(raw) || !raw.length) return null;
  const items = raw.map((it) => (typeof it === 'string' ? { label: it } : { label: it.label, sub: it.lock ? (typeof it.lock === 'string' ? it.lock : it.why || it.sub) : it.sub, right: it.right, rcol: it.rightColor, dim: !!(it.lock || it.head) }));
  const lines = (m.lines || []).map((l) => ({ t: String(l == null ? '' : l), s: 18 })).filter((x, i, a) => x.t !== '' || (i > 0 && i < a.length - 1));
  return {
    sid: `modal:${m.title || ''}:${raw.length}`, color: m.color || opt.color || '#ffd23f', title: m.title || '', tag: opt.tag || '', pal: opt.pal, light: opt.light,
    hint: pick ? 'えらんでタップ　Bでもどる' : '', blocks: lines,
    list: { items, index: Math.max(0, Math.min(raw.length - 1, m.idx | 0)), rows: Math.min(6, items.length), bodyMin: lines.length ? 80 : 0, bodyMax: 220, noStepper: true, onPick: (i) => { if (raw[i] && raw[i].head) return; m.idx = i; padPress(g, 'a'); } },
    onTap: items.length === 1 ? () => padPress(g, 'a') : () => {},
  };
}

// the panel of a game (created on first use; also reachable as g.portraitPanel afterwards)
export function portraitPanelOf(g) {
  if (!g || typeof document === 'undefined') return null;
  if (!g.portraitPanel) { try { g.portraitPanel = new PortraitPanel(g); } catch (e) { console.error(e); return null; } }
  return g.portraitPanel;
}

// Press a virtual button for the scene on top (a tap on the lower screen that should act like the pad): A / B / up / down …
export function padPress(g, k, frames = 3) {
  const src = 'bt:' + k;
  g.input.press(k, src);
  const rel = () => g.input.release(k, src);
  if (g.timers) g.timers.push({ left: frames, resolve: rel }); else setTimeout(rel, 60);
}
