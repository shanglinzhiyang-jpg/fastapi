// 縦画面の「大きな文字」: 政治画面 (PolScene: every view except the 政治家の動向 hub, which bigtext_polai.js has) and 政府中枢 / 各界 (GovtScene)  [R13-F].
//
// Both screens are drawn imperatively at 640x360 (cards, charts, lists), so the lower screen READS the text they draw: captureRaw() runs the
// screen's own draw function against a recording context, the notes are cut into regions (one per card / panel), and each region becomes a
// block of big text. What the screen lets you pick (the rows of its list, its buttons and jump panels, its sub-views, its tabs) becomes
// the chips and the 46 px rows of the lower screen; a tap highlights a row, the second tap does what A does (padPress), exactly like the
// shop / 会話 adapters. Landscape and desktop: nothing changes (the panel stays hidden).
//
//   PolScene     adapter 'polui_any'   top view modal → bigtext.js modalSpec (confirmView has kind / title / lines / choices)
//                                      top view with a ListBox (v.lb | v.al | v.pl | …): the rows of the list + the other cards as text
//                                      top view without one: the text of the screen
//                (the dashboard and the 政治家の動向 hub have their own v.bigtext: adapter 'polui' of bigtext_polai.js, first in line)
//   GovtScene    adapter 'govt'        tab chips (+ the sub-view chips), the focused control's tip, the panels as text, rows = the focused list
//                                      (every row, read from the drawing) + the buttons / panels / other lists of the tab
//   ExplainScene (用語じてん)            has its own portraitSpec() in assist.js
//   Test hooks: window.__bigtextPolui = { capturePol(ui, g), captureGovt(s, g) }
import { registerBigtext, padPress, captureRaw, linesOf, fixCol, modalSpec } from './bigtext.js';
import { POLCAP } from './politics_ui.js';
import { GOVCAP, GOVT_TABS } from './govt_ui.js';

const GRAY = '#a4acd0';
const ACC_POL = '#e8c25a', ACC_GOV = '#ffb547';
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const safe = (fn, d = null) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } };

// ---------------------------------------------------------------- regions of a drawing → blocks
// recs: captureRaw() notes; cards: [{ x, y, w, h, title }] the cards / panels the screen drew; the area [yTop, yBot] is the body of the screen
// (the header and the footer strips are not text of the content); skip: rects whose text goes elsewhere (a list's rows, the sub-view chips)
function regionsOf(recs, cards, yTop, yBot, skip = []) {
  const keep = recs.filter((r) => r.s.trim() && r.y >= yTop - 2 && r.y <= yBot && !skip.some((q) => inRect(r.left + 1, r.y + 2, q)));
  const cs = cards.filter((c) => c.w > 24 && c.h > 14 && c.y + c.h > yTop && c.y < yBot).map((c) => ({ ...c, area: c.w * c.h, recs: [] }));
  const free = [];
  for (const r of keep) {
    let best = null;
    for (const c of cs) if (inRect(r.left + 1, r.y + 2, c) && (!best || c.area < best.area)) best = c;
    (best ? best.recs : free).push(r);
  }
  cs.sort((a, b) => Math.round(a.y / 10) - Math.round(b.y / 10) || a.x - b.x);
  const out = [];
  if (free.length) out.push({ free: true, recs: free });
  for (const c of cs) if (c.recs.length) out.push(c);
  return out;
}
// lines of one region → blocks (heading chip, label / value rows, wrapped paragraphs joined again, plain lines)
function regionBlocks(region, o = {}) {
  const b = [];
  let recs = region.recs;
  let head = null;
  if (!region.free && region.title) {
    // the title strip: the left-most note on it is the title (the rest, at the right edge, is a status line)
    const strip = recs.filter((r) => r.y < region.y + 19);
    if (strip.length) { const t = strip.reduce((a, r) => (r.left < a.left ? r : a), strip[0]); head = t.s; recs = recs.filter((r) => r !== t); }
  }
  if (head) b.push({ h: String(head).replace(/…$/, ''), c: o.color });
  // (chart axes: a small number alone on its line says nothing in text)
  const lines = linesOf(recs, null).filter((l) => !(l.size <= 10.5 && /^[\d.,%+\-−]{1,6}$/.test(l.t)));
  // the right edge of the wrapped text of this region: a line that reaches it was wrapped (join it with the next)
  const edge = {};
  for (const l of lines) { const k = Math.round(l.x / 4); edge[k] = Math.max(edge[k] || 0, l.r); }
  let prev = null, para = null;
  const flush = () => { if (para) { b.push(para); para = null; } };
  for (const l of lines) {
    const size = l.size >= 15 ? 20 : l.size >= 12 ? 18 : 16;
    const col = fixCol(l.col, false);
    const parts = l.t.split('　').filter(Boolean);
    const kv = parts.length === 2 && Array.from(parts[0]).length <= 10 && l.size < 15;
    if (kv) { flush(); b.push({ kv: [parts[0], parts[1], col === '#f2f4ff' ? undefined : col] }); prev = null; continue; }
    const plain = parts.length === 1;
    const k = Math.round(l.x / 4);
    const wrapped = prev && plain && prev.plain && Math.abs(prev.x - l.x) <= 3 && Math.abs(prev.size - l.size) < 1 && l.y - prev.y > prev.size * 0.9 && l.y - prev.y < prev.size * 2.1 && prev.r >= (edge[k] || prev.r) - prev.size * 1.3 && prev.r - prev.x > 100 && !/[。！？!?]$/.test(prev.t);
    if (wrapped && para) para.t += l.t; else { flush(); para = { t: parts.join('　'), s: size, c: col === '#f2f4ff' ? undefined : col }; }
    prev = { ...l, plain };
  }
  flush();
  return b;
}
function bodyBlocks(recs, cards, yTop, yBot, skip, color) {
  const out = [];
  for (const rg of regionsOf(recs, cards, yTop, yBot, skip)) {
    const bl = regionBlocks(rg, { color });
    if (!bl.length) continue;
    if (bl.length === 1 && bl[0].h) continue; // a card whose body went elsewhere (its list): a heading with nothing under it
    if (out.length && !bl[0].h) out.push({ gap: 6 });
    out.push(...bl);
  }
  return out;
}
// the text of one row of a list, drawn by drawRow: the first line is the label, the rest the sub line
function rowFromLines(lines) {
  if (!lines.length) return { label: '' };
  const [a, ...rest] = lines;
  const parts = a.t.split('　').filter(Boolean);
  let label = a.t, right = '';
  if (parts.length >= 2) { label = parts.slice(0, -1).join(' '); right = parts[parts.length - 1]; }
  return { label, right: rest.length ? '' : right, sub: rest.length ? rest.map((l) => l.t).join('　') : '', col: fixCol(a.col, false) };
}

// ---------------------------------------------------------------- 政治画面 (PolScene)
const POL_Y0 = 27, POL_Y1 = 338;
const viewTitle = (s, v) => safe(() => (typeof v.title === 'function' ? v.title(s) : v.title), '') || '政治';
// the list of the view: v.bigtextList(ui) (a view with several lists says which one has the focus), else v.lb, else the first ListBox-like property
const isLB = (x) => x && typeof x === 'object' && typeof x.rows === 'function' && typeof x.draw === 'function' && 'topRow' in x && 'idx' in x;
function findLB(v, s) {
  if (typeof v.bigtextList === 'function') { const q = safe(() => v.bigtextList(s), null); if (isLB(q)) return q; }
  if (isLB(v.lb)) return v.lb;
  for (const k of Object.keys(v)) if (isLB(v[k])) return v[k];
  return null;
}
function allLBs(v, lb) {
  const a = Object.keys(v).map((k) => v[k]).filter(isLB);
  if (lb && !a.includes(lb)) a.push(lb);
  return a;
}
export function capturePol(s, g, lb) {
  const lbs = allLBs(s.top(), lb);
  for (const q of lbs) q.capSkip = q === lb;
  POLCAP.cards = [];
  let recs = [];
  try { recs = captureRaw((c) => s.draw(c, g)); } finally { POLCAP.cards = POLCAP.cards || []; for (const q of lbs) q.capSkip = false; }
  const cards = POLCAP.cards; POLCAP.cards = null;
  return { recs, cards };
}
function polRows(s, g, lb) {
  const rows = lb.rows();
  const need = rows.some((it) => typeof it === 'string' || (it && typeof it.label !== 'string'));
  let drawn = null;
  if (need && lb.rect) {
    // custom rows (drawRow): draw all of them once and read the text row by row
    const lbs = allLBs(s.top(), lb);
    for (const q of lbs) q.capSkip = q !== lb;
    lb.capAll = true;
    let recs = [];
    try { recs = captureRaw((c) => s.draw(c, g)); } finally { lb.capAll = false; for (const q of lbs) q.capSkip = false; }
    const R0 = lb.rect;
    const lines = linesOf(recs, { x: R0.x, y: R0.y, w: R0.w, h: rows.length * R0.rh + 2 });
    drawn = rows.map(() => []);
    for (const l of lines) { const i = Math.floor((l.y - R0.y + 3) / R0.rh); if (i >= 0 && i < rows.length) drawn[i].push(l); }
  }
  return rows.map((it, i) => {
    if (it && typeof it.label === 'string') {
      const tag = it.tag && it.tag.text ? it.tag.text : '';
      return { label: it.label, sub: tag && it.sub ? `【${tag}】${it.sub}` : it.sub || (tag ? `【${tag}】` : ''), right: it.right != null ? String(it.right) : tag && !it.sub ? '' : '', rcol: it.rightColor, color: it.labelColor || undefined, dim: !!it.disabled };
    }
    if (drawn && drawn[i].length) { const r = rowFromLines(drawn[i]); return { label: r.label, sub: r.sub, right: r.right, color: r.col !== '#f2f4ff' ? r.col : undefined }; }
    return { label: typeof it === 'string' ? it : '' };
  });
}
function polGeneric(s, g) {
  const t0 = performance.now();
  const v = s.top();
  const lb = findLB(v, s);
  const bt = typeof v.bigtextTabs === 'function' ? safe(() => v.bigtextTabs(s), null) : null;
  const { recs, cards } = capturePol(s, g, lb);
  const title = viewTitle(s, v);
  const spec = { sid: `pol:${s.views.length}:${title}`, color: ACC_POL, tag: '政治', title, hint: 'タップ：えらぶ→もう一度でけってい' };
  const tip = safe(() => (typeof v.tip === 'function' ? v.tip(s) : v.tip), '');
  const b = [];
  if (tip) b.push({ t: tip, s: 16, c: '#7fe0d0' });
  b.push(...bodyBlocks(recs, cards, POL_Y0, POL_Y1, bt && bt.skip ? [bt.skip] : [], ACC_POL));
  spec.blocks = b;
  if (bt) spec.tabs = { items: bt.items, index: bt.index, onPick: bt.onPick, color: ACC_POL };
  if (lb) {
    const items = polRows(s, g, lb);
    if (items.length) spec.list = { items, index: Math.max(0, Math.min(items.length - 1, lb.idx | 0)), rows: 3, bodyMin: 100, bodyMax: 120, onPick: (i) => { if ((lb.idx | 0) === i) padPress(g, 'a'); else lb.idx = i; } };
    else spec.blocks = [...b, { t: lb.o && lb.o.empty ? lb.o.empty : '（なし）', s: 18, c: GRAY }];
    spec.onTap = () => {};
    if (!items.length) spec.hint = '';
  } else spec.hint = 'ドラッグ：スクロール　Bでもどる';
  s.__capMs = performance.now() - t0; // a heavy screen is read less often (the key below)
  return spec;
}
registerBigtext({
  id: 'polui_any',
  match: (s) => { if (!s.isPolUI || s.closed || typeof s.top !== 'function') return false; return !!s.top(); },
  key: (s) => {
    const v = s.top();
    if (v.modal) return modalSpec(s.g, v) ? `m|${s.views.length}|${v.idx}|${v.title || ''}` : 'null';
    if (typeof v.bigtext === 'function') return 'null'; // the 'polui' adapter (first in line) has it
    const lb = findLB(v, s);
    const bt = typeof v.bigtextTabs === 'function' ? safe(() => v.bigtextTabs(s), null) : null;
    return `${s.views.length}|${lb ? lb.idx : -1}|${v.idx == null ? '' : v.idx}|${v.tab == null ? '' : v.tab}|${v.focus || ''}|${bt ? bt.index : ''}|${s.t >> (s.__capMs > 20 ? 6 : 4)}`;
  },
  spec: (s, g) => {
    const v = s.top();
    if (v.modal) return modalSpec(g, v, { tag: '政治', color: v.color });
    return polGeneric(s, g);
  },
});

// ---------------------------------------------------------------- 政府中枢 / 各界 (GovtScene)
const GOV_Y0 = 44, GOV_Y1 = 338;
const whyOf = (k, s) => safe(() => (typeof k.why === 'function' ? k.why(s) : k.why), null) || null;
const tipOf = (k, s) => safe(() => (typeof k.tip === 'function' ? k.tip(s) : k.tip), '') || '';
const lastList = new Map(); // `${tab}|${sub}` → the id of the list that had the focus last
export function captureGovt(s, g, opt = {}) {
  GOVCAP.cards = [];
  GOVCAP.skip = opt.skip || null;
  GOVCAP.all = opt.all || null;
  let recs = [];
  try { recs = captureRaw((c) => { try { s.tab.draw(c, s, s.data || {}); } catch (e) { console.error(e); } }); } finally { GOVCAP.skip = null; GOVCAP.all = null; }
  const cards = GOVCAP.cards || []; GOVCAP.cards = null;
  return { recs, cards };
}
function govtSpec(s, g) {
  const tStart = performance.now();
  const T0 = s.tab, st = s.tabState();
  const ctls = (s.ctls || []).filter((k) => k.id !== 'help' && Number.isFinite(k.x));
  const focusId = s.focus === 'body' ? s.cur[T0.id] : null;
  const lists = ctls.filter((k) => k.kind === 'list' && k.list && k.list.n >= 0);
  const memo = `${T0.id}|${st.sub || ''}|${st.filter || ''}`;
  let primary = lists.find((k) => k.id === focusId) || lists.find((k) => k.id === lastList.get(memo)) || lists[0] || null;
  if (primary) lastList.set(memo, primary.id);
  const segs = ctls.filter((k) => k.kind === 'seg');
  // pass 1: the body (the primary list and the sub-view chips left out); pass 2: every row of the primary list
  const skip = ctls.filter((k) => k.kind === 'seg' || k.kind === 'btn').map((k) => ({ x: k.x - 1, y: k.y - 1, w: k.w + 2, h: k.h + 2 }));
  const p1 = captureGovt(s, g, { skip: primary && primary.id });
  const regionOf = (k) => linesOf(p1.recs, { x: k.x - 1, y: k.y - 2, w: k.w + 2, h: k.h + 4 });
  const items = [];
  const link = (k, label, sub) => ({ k, label, sub });
  let rowOff = 0;
  if (primary) {
    const L = primary.list, n = Math.min(L.n, 80);
    const p2 = captureGovt(s, g, { all: primary.id });
    const y0 = primary.y + num(L.y0), rh = num(L.rowH, 16);
    const lines = linesOf(p2.recs, { x: primary.x, y: y0 - 2, w: primary.w, h: n * rh + 4 });
    const per = Array.from({ length: n }, () => []);
    for (const l of lines) { const i = Math.floor((l.y - y0 + 3) / rh); if (i >= 0 && i < n) per[i].push(l); }
    for (let i = 0; i < n; i++) { const r = rowFromLines(per[i]); items.push({ k: primary, i, label: r.label || `${i + 1}`, sub: r.sub, right: r.right, color: r.col !== '#f2f4ff' ? r.col : undefined, dim: false }); }
    rowOff = items.length;
    if (L.n === 0) { items.length = 0; rowOff = 0; }
  }
  // the other controls of the tab: buttons, jump panels, nodes of the map, the other lists
  let nOther = 0;
  const RANK = { panel: 0, node: 0, list: 1, btn: 2 };
  for (const k of ctls.slice().sort((a, b) => (RANK[a.kind] == null ? 1 : RANK[a.kind]) - (RANK[b.kind] == null ? 1 : RANK[b.kind]))) {
    if (k === primary || k.kind === 'seg' || nOther >= 60) continue;
    let label = k.label || '';
    let sub = '';
    if (!label || k.kind === 'panel' || k.kind === 'node') {
      const card = p1.cards.filter((c) => Math.abs(c.x - k.x) <= 3 && Math.abs(c.y - k.y) <= 3 && Math.abs(c.w - k.w) <= 4).sort((a, b) => b.w * b.h - a.w * a.h)[0];
      const ls = regionOf(k);
      label = label || (card && card.title) || (ls[0] ? ls[0].t.split('　')[0] : '') || tipOf(k, s).slice(0, 18) || k.id;
      if (k.kind === 'node' && ls.length) label = ls.map((l) => l.t).join(' ');
      if (k.kind === 'panel') sub = tipOf(k, s);
    }
    if (k.kind === 'list') { sub = `（${k.list.n}件）`; }
    const why = whyOf(k, s);
    items.push({ k, link: k.kind === 'list', label: `${k.kind === 'btn' ? '▶ ' : k.kind === 'list' ? '≡ ' : ''}${label}`, sub: why ? `🔒 ${why}` : sub, dim: !!why });
    nOther++;
  }
  let index = 0;
  const fk = focusId ? ctls.find((k) => k.id === focusId) : null;
  if (fk && fk === primary) index = Math.max(0, Math.min(rowOff - 1, fk.list.get()));
  else if (fk) { const j = items.findIndex((it) => it.k === fk && it.i == null); index = j >= 0 ? j : 0; }
  else if (primary && rowOff) index = Math.max(0, Math.min(rowOff - 1, primary.list.get()));
  // chips
  const tabs = [{ items: GOVT_TABS.map((t) => `${t.label}${safe(() => (t.alert ? t.alert(s) : 0), 0) ? '●' : ''}`), index: s.tabIdx, color: ACC_GOV, onPick: (i) => { s.focus = 'tabs'; s.cur._tabsHelp = false; s.setTab(i); } }];
  if (segs.length) {
    const on = segs.findIndex((k) => (k.id.startsWith('seg_') && st.sub === k.id.slice(4)) || (k.id.startsWith('nf_') && (st.filter || 'all') === k.id.slice(3)));
    tabs.push({ items: segs.map((k) => k.label || (regionOf(k)[0] || {}).t || k.id.replace(/^(seg|nf)_/, '')), index: on, color: '#5fd7ff', onPick: (i) => { const k = segs[i]; s.cur[T0.id] = k.id; s.focus = 'body'; if (k.a) safe(() => k.a(s)); s.dirty(); } });
  }
  const b = [];
  const tip = fk ? tipOf(fk, s) : s.focus === 'tabs' ? T0.short || T0.about || '' : '';
  const fwhy = fk ? whyOf(fk, s) : null;
  if (fwhy) b.push({ t: `🔒 ${fwhy}`, s: 17, c: '#ff8a8a' }); else if (tip) b.push({ t: tip, s: 17, c: '#7fe0d0' });
  b.push(...bodyBlocks(p1.recs, p1.cards, GOV_Y0, GOV_Y1, skip, ACC_GOV));
  const spec = { sid: `govt:${memo}`, color: ACC_GOV, tag: s.tabIdx === GOVT_TABS.findIndex((t) => t.id === 'groups') ? '各界' : '政府中枢', title: T0.label, hint: items.length ? 'タップ：えらぶ→もう一度でけってい' : 'ドラッグ：スクロール', tabs, blocks: b, onTap: () => {} };
  if (items.length) {
    spec.list = {
      items: items.map((it) => ({ label: it.label, sub: it.sub, right: it.right, color: it.color, dim: it.dim })), index, rows: 3, bodyMin: 100, bodyMax: 120,
      onPick: (i) => {
        const it = items[i]; if (!it) return;
        const k = it.k;
        const same = s.focus === 'body' && s.cur[T0.id] === k.id;
        s.focus = 'body'; s.cur[T0.id] = k.id;
        if (it.i != null) { if (same && k.list.get() === it.i) { if (k.a) padPress(g, 'a'); } else k.list.set(it.i); } else if (same && !it.link) padPress(g, 'a');
        else s.dirty();
      },
    };
  } else spec.onTap = undefined;
  s.__capMs = performance.now() - tStart;
  return spec;
}
// a modal of the console (confirmModal / pickModal / amountModal): their kind / title / lines / choices / items are set in govt_ui.js
function govtModalSpec(s, g, m) {
  if (m.kind === 'amount') {
    const o = m.o || {};
    const step = o.step || 1;
    const vs = o.fmt ? safe(() => o.fmt(m.v), String(m.v)) : `${m.v}${o.unit || ''}`;
    const f = (num(m.v) - num(o.min)) / Math.max(1e-9, num(o.max) - num(o.min));
    return {
      sid: `govtamt:${m.title || ''}`, color: ACC_GOV, tag: '政府中枢', title: m.title || '', hint: 'タップ：へらす・ふやす・決める',
      blocks: [...(m.lines || []).filter(Boolean).map((t) => ({ t: String(t), s: 18 })), { gap: 8 }, { t: vs, s: 26, c: '#ffffff' }, { bar: ['', f, ACC_GOV, ''] }],
      list: { items: [{ label: '◀ へらす' }, { label: 'ふやす ▶' }, { label: '決定する' }, { label: 'やめる' }], index: m.idx === 0 ? 2 : 3, rows: 4, noStepper: true, bodyMin: 120,
        onPick: (i) => { if (i === 0) m.v = Math.max(num(o.min), m.v - step); else if (i === 1) m.v = Math.min(num(o.max), m.v + step); else { m.idx = i === 2 ? 0 : 1; padPress(g, 'a'); } } },
      onTap: () => {},
    };
  }
  return modalSpec(g, m, { tag: '政府中枢', color: m.color });
}
registerBigtext({
  id: 'govt',
  match: (s) => !!s.isGovtUI && !s.closed,
  key: (s) => {
    const m = s.modals && s.modals[s.modals.length - 1];
    if (m) return m.kind === 'amount' || modalSpec(s.g, m) ? `m|${s.modals.length}|${m.idx}|${m.v == null ? '' : m.v}|${m.title || ''}` : 'null';
    const T0 = s.tab, st = s.tabState(), id = s.cur[T0.id];
    const k = (s.ctls || []).find((q) => q.id === id);
    return `${s.tabIdx}|${s.focus}|${id}|${st.sub || ''}|${st.filter || ''}|${st.page == null ? '' : st.page}|${k && k.list ? k.list.get() : ''}|${s.t >> (s.__capMs > 30 ? 7 : 5)}`;
  },
  spec: (s, g) => {
    const m = s.modals && s.modals[s.modals.length - 1];
    if (m) return govtModalSpec(s, g, m);
    return govtSpec(s, g);
  },
});

if (typeof window !== 'undefined') window.__bigtextPolui = { capturePol, captureGovt, regionsOf, regionBlocks };
