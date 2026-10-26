// 台本エディタの描画 (owner: R10-A). Pure drawing of an EditorScene (neta_editor.js) in the era's skin (neta_editor_skin.js).
// Geometry is in the screen's own 640x360 units; on touch the body is scaled under the 70-unit bar by the kit's Base.draw.

import { SW } from './util.js';
import { measure } from './draw.js';
import { mmss } from './neta_ai.js';
import { R, RR, T, hexA, mix, inR, short, fit, jwrap, NO_START, K, KIND_LABEL, ROLE_SHORT, ROLE_LONG, BEAT_SHORT, TB, isTouch, scoreCol } from './neta_ui_kit.js';
import { drawChip, drawButton, drawPanel, drawGrid, roleColor, beatColor } from './neta_editor_skin.js';
import { foldStr, counts } from './neta_editor_core.js';

export const G = {
  head: { x: 0, y: 0, w: SW, h: 20 }, strip: { x: 0, y: 21, w: SW, h: 20 },
  list: { x: 6, y: 43, w: 420, h: 249, rh: 18 }, panel: { x: 432, y: 42, w: 202, h: 252 },
  detail: { x: 4, y: 296, w: 424, h: 37 }, side: { x: 432, y: 296, w: 202, h: 37 },
  tools: { y: 336, h: 22, bw: 104 }, mini: { w: 8 },
};
const CW = 12; // 原稿用紙 cell
const TEXT_X = 102; // text column inside a row
const PH = /〇+/g;

// ------------------------------------------------------------------ small icons (no font dependency)
export function icon(c, id, cx, cy, s, col) {
  c.save();
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = Math.max(1.5, s / 9); c.lineCap = 'round'; c.lineJoin = 'round';
  const r = s * 0.32;
  if (id === 'undo' || id === 'redo') {
    const d = id === 'undo' ? -1 : 1;
    c.beginPath(); c.arc(cx, cy + s * 0.08, r, id === 'undo' ? 0.15 * Math.PI : 0.85 * Math.PI, id === 'undo' ? Math.PI : 0, id === 'undo'); c.stroke();
    const ax = cx + d * r, ay = cy + s * 0.08;
    c.beginPath(); c.moveTo(ax - s * 0.16, ay - s * 0.04); c.lineTo(ax + s * 0.16, ay - s * 0.04); c.lineTo(ax, ay + s * 0.22); c.closePath(); c.fill();
  } else if (id === 'more') { for (const k of [-1, 0, 1]) { c.beginPath(); c.arc(cx + k * s * 0.26, cy, s * 0.08, 0, 7); c.fill(); } }
  else if (id === 'plus') { c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx + r, cy); c.moveTo(cx, cy - r); c.lineTo(cx, cy + r); c.stroke(); }
  else if (id === 'pen') { c.beginPath(); c.moveTo(cx - r, cy + r); c.lineTo(cx + r * 0.9, cy - r * 0.9); c.stroke(); c.beginPath(); c.moveTo(cx - r * 1.15, cy + r * 1.1); c.lineTo(cx - r * 0.7, cy + r * 0.5); c.lineTo(cx - r * 0.5, cy + r * 0.9); c.closePath(); c.fill(); }
  else if (id === 'up' || id === 'down') { const d = id === 'up' ? -1 : 1; c.beginPath(); c.moveTo(cx - r, cy - d * r * 0.5); c.lineTo(cx + r, cy - d * r * 0.5); c.lineTo(cx, cy + d * r * 0.7); c.closePath(); c.fill(); }
  else if (id === 'check') { c.beginPath(); c.moveTo(cx - r, cy); c.lineTo(cx - r * 0.25, cy + r * 0.8); c.lineTo(cx + r, cy - r * 0.8); c.stroke(); }
  else if (id === 'sel') { c.setLineDash([3, 2]); c.strokeRect(cx - r, cy - r * 0.9, r * 2, r * 1.8); c.setLineDash([]); }
  else if (id === 'play') { c.beginPath(); c.moveTo(cx - r * 0.6, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx - r * 0.6, cy + r); c.closePath(); c.fill(); }
  else if (id === 'pause') { c.fillRect(cx - r * 0.8, cy - r, r * 0.55, r * 2); c.fillRect(cx + r * 0.25, cy - r, r * 0.55, r * 2); }
  else if (id === 'next') { c.beginPath(); c.moveTo(cx - r, cy - r); c.lineTo(cx + r * 0.3, cy); c.lineTo(cx - r, cy + r); c.closePath(); c.fill(); c.fillRect(cx + r * 0.55, cy - r, r * 0.4, r * 2); }
  else if (id === 'prev') { c.beginPath(); c.moveTo(cx + r, cy - r); c.lineTo(cx - r * 0.3, cy); c.lineTo(cx + r, cy + r); c.closePath(); c.fill(); c.fillRect(cx - r * 0.95, cy - r, r * 0.4, r * 2); }
  c.restore();
}

// ------------------------------------------------------------------ text wrapping (cached)
const WC = new Map();
export function wrapFor(ed, text, w, c) {
  const S = ed.skin;
  const key = `${S.kind}|${w}|${text}`;
  let r = WC.get(key);
  if (r) return r;
  if (S.kind === 'genko') {
    const N = Math.max(4, Math.floor(w / CW));
    r = []; let cur = [];
    for (const ch of Array.from(String(text))) {
      if (cur.length >= N) { if (NO_START.has(ch) && cur.length === N) { cur.push(ch); r.push(cur.join('')); cur = []; continue; } r.push(cur.join('')); cur = []; }
      cur.push(ch);
    }
    r.push(cur.join(''));
  } else r = jwrap(c, String(text), w, 12);
  if (!r.length) r = [''];
  if (WC.size > 3000) WC.clear();
  WC.set(key, r);
  return r;
}
export const textWidth = () => G.list.w - TEXT_X - 16;
// the selected row leaves room for the ⋯ button, a folded head for its ▸+n badge
export const rowTextWidth = (ed, i) => textWidth() - (ed.foldedHead(i) ? 34 : i === ed.sel ? 18 : 0);

// ------------------------------------------------------------------ the row layout (variable heights: long lines wrap)
// rows: [{ i, y, h, wrap: [str], cut: bool, add?: true }]  (y relative to the content top). Cached per (rev, sel, folds, skin).
export function layoutRows(ed, c) {
  const key = `${ed.rev}|${ed.sel}|${ed.foldRev}|${ed.skin.id}|${ed.anchor}`;
  if (ed.layoutKey === key && ed.layoutRowsCache) return ed.layoutRowsCache;
  const L = ed.n.lines, hidden = ed.hiddenSet(), rows = [];
  let y = 0;
  for (let i = 0; i < L.length; i++) {
    if (hidden.has(i)) continue;
    const full = wrapFor(ed, L[i].text, rowTextWidth(ed, i), c);
    const max = i === ed.sel ? 8 : 3;
    const wr = full.length > max ? [...full.slice(0, max - 1), `${full[max - 1]}…`] : full;
    const h = 4 + 14 * wr.length;
    rows.push({ i, y, h, wrap: wr, cut: full.length > max });
    y += h;
  }
  rows.push({ i: L.length, add: true, y, h: 20 });
  y += 20;
  ed.layoutKey = key; ed.layoutRowsCache = rows; ed.layoutH = y;
  return rows;
}

// ------------------------------------------------------------------ the row text with 〇〇 blanks and search hits highlighted
function spansOf(ed, str) {
  const sp = [];
  let m;
  PH.lastIndex = 0;
  const a = Array.from(str);
  const idx = (s) => Array.from(s).length;
  while ((m = PH.exec(str))) { const st = idx(str.slice(0, m.index)); sp.push({ a: st, b: st + idx(m[0]), t: 'blank' }); }
  const q = ed.find && ed.find.q ? foldStr(ed.find.q) : '';
  if (q) {
    const f = foldStr(str);
    let i = 0;
    for (;;) { const k = f.indexOf(q, i); if (k < 0) break; const st = idx(f.slice(0, k)); sp.push({ a: st, b: st + idx(q), t: 'find' }); i = k + q.length; }
  }
  void a;
  return sp;
}
function drawRowText(ed, c, str, x, y, color, cells) {
  const S = ed.skin;
  const sp = spansOf(ed, str);
  const chars = Array.from(str);
  if (S.kind === 'genko') {
    for (const s of sp) R(c, x + s.a * CW, y, (s.b - s.a) * CW, 13, s.t === 'find' ? S.find : S.blank);
    for (let k = 0; k < chars.length; k++) T(c, chars[k], x + k * CW + CW / 2, y, 12, color, 'center');
    void cells;
    return;
  }
  for (const s of sp) { const x0 = x + measure(c, chars.slice(0, s.a).join(''), 12), x1 = x + measure(c, chars.slice(0, s.b).join(''), 12); R(c, x0, y, x1 - x0, 13, s.t === 'find' ? S.find : S.blank); }
  T(c, str, x, y, 12, color);
}

// ------------------------------------------------------------------ the whole screen
export function drawEditor(ed, c) {
  const S = ed.skin;
  R(c, 0, 0, SW, 360, S.bg);
  ed.hits = []; ed.btnRects = {};
  if (!isTouch()) drawHead(ed, c);
  drawStrip(ed, c);
  drawList(ed, c);
  drawPanelLive(ed, c);
  drawDetail(ed, c);
  drawSide(ed, c);
  drawTools(ed, c);
  drawToasts(ed, c);
}

function drawHead(ed, c) {
  const S = ed.skin, n = ed.n;
  R(c, 0, 0, SW, 20, S.head); R(c, 0, 19, SW, 1, S.headEdge);
  T(c, '台本エディタ', 8, 4, 12, S.headText);
  T(c, `${KIND_LABEL[ed.kind]}${n.forContest ? '・賞レース用' : ''}`, 88, 5, 10, S.headDim, 'left', 110);
  const st = ed.dirty ? '●未保存' : ed.saved ? '保存ずみ' : '';
  T(c, st, 532, 5, 10, ed.dirty ? S.headWarn : S.headOk, 'right', 70);
  const ids = [['undo', 540, ed.hist.canUndo], ['redo', 566, ed.hist.canRedo], ['more', 592, true]];
  for (const [id, x, on] of ids) {
    const focus = ed.focus === 'head' && ed.headItems()[ed.headIdx] === id;
    drawButton(c, S, x, 1, 24, 18, '', { on: focus, bg: S.head === S.tool ? undefined : hexA('#ffffff', 0.12) });
    icon(c, id, x + 12, 10, 14, focus ? S.toolOnText : on ? S.headText : S.headDim);
    ed.hits.push({ k: 'hbtn', id, r: { x, y: 1, w: 24, h: 18 } });
  }
  T(c, '×', SW - 12, 3, 12, S.headText, 'center');
}

function drawStrip(ed, c) {
  const S = ed.skin, n = ed.n;
  const y0 = G.strip.y, h = G.strip.h;
  R(c, 0, y0, SW, h, S.strip);
  R(c, 0, y0 + h - 1, SW, 1, S.dark ? hexA('#000000', 0.5) : hexA('#000000', 0.18));
  const hf = ed.focus === 'head';
  const items = ed.headItems();
  const tf = hf && items[ed.headIdx] === 'title';
  T(c, n.title || '（タイトルなし）', 8, y0 + 4, 12, n.title ? S.stripText : S.faint, 'left', 170);
  if (tf) R(c, 6, y0 + h - 3, Math.min(172, Math.ceil(measure(c, n.title || '（タイトルなし）', 12)) + 4), 2, S.selBar);
  let x = 182;
  const chip = (id, lab, val, w, col) => {
    const f = hf && items[ed.headIdx] === id;
    const r = { x, y: y0 + 2, w, h: h - 4 };
    if (S.chip === 'pill') RR(c, r.x, r.y, r.w, r.h, 8, f ? S.toolOn : S.stripChip); else { R(c, r.x, r.y, r.w, r.h, f ? S.toolOn : S.stripChip); if (!S.dark) R(c, r.x, r.y + r.h - 1, r.w, 1, hexA('#000000', 0.2)); }
    T(c, lab, r.x + 5, r.y + 3, 10, f ? S.toolOnText : S.stripDim);
    const lw = Math.ceil(measure(c, lab, 10)) + 9;
    T(c, val, r.x + lw, r.y + 3, 10, f ? S.toolOnText : col || S.stripText, 'left', w - lw - 4);
    ed.hits.push({ k: 'chip', id, r });
    x += w + 4;
  };
  chip('kind', '種類', KIND_LABEL[ed.kind], 70);
  chip('theme', ed.kind === 'ogiri' ? 'お題' : 'テーマ', n.theme || '未定', 142, n.theme ? S.stripText : S.faint);
  chip('target', '尺', mmss(n.target), 82);
  chip('dialect', '言葉', n.dialect === 'kansai' ? '関西弁' : '標準語', 66);
  const ai = ed.saved && ed.saved.ai;
  if (ai) { const fresh = !ai.hash || ai.hash === ed.hashNow(); T(c, fresh ? `AI ${ai.total}点` : 'AI 未採点', SW - 8, y0 + 4, 10, fresh ? (S.dark ? scoreCol(ai.total) : S.stripText) : S.faint, 'right'); }
  ed.hits.push({ k: 'strip', r: { x: 0, y: y0, w: SW, h } });
}

// ------------------------------------------------------------------ the list
function drawList(ed, c) {
  const S = ed.skin, L = G.list, lines = ed.n.lines;
  const rows = layoutRows(ed, c);
  const stats = ed.stats();
  // frame
  if (S.box === 'card') { RR(c, L.x - 3, L.y - 3, L.w + 6, L.h + 6, 7, S.panelEdge); RR(c, L.x - 2, L.y - 2, L.w + 4, L.h + 4, 6, S.paper); }
  else { R(c, L.x - 2, L.y - 2, L.w + 4, L.h + 4, S.panelEdge === '#808080' ? '#808080' : S.kind === 'genko' ? '#8a6a44' : S.panelEdge); R(c, L.x, L.y, L.w, L.h, S.paper); }
  c.save(); c.beginPath(); c.rect(L.x, L.y, L.w - G.mini.w - 1, L.h); c.clip();
  const sc = Math.round(ed.scroll);
  const [ra, rb] = ed.anchor >= 0 ? [Math.min(ed.anchor, ed.sel), Math.max(ed.anchor, ed.sel)] : [-1, -1];
  const focusLines = ed.focus === 'lines';
  let rowNo = 0;
  for (const row of rows) {
    rowNo++;
    const yy = L.y + row.y - sc;
    if (yy + row.h < L.y || yy > L.y + L.h) continue;
    const x = L.x, w = L.w - G.mini.w - 1;
    if (row.add) {
      const sel = ed.sel === lines.length;
      R(c, x, yy, w, row.h - 1, sel && focusLines ? S.sel : S.paper2);
      if (sel && focusLines) R(c, x, yy, 3, row.h - 1, S.selBar);
      T(c, lines.length === 0 ? '＋ ここから書きはじめる（A：部品から／自分で／テンプレ）' : '＋ 行を足す（A）', x + 12, yy + 4, 12, sel && focusLines ? S.selText : S.accent === '#a98bff' ? '#a98bff' : S.dark ? S.info : S.accent, 'left', w - 24);
      ed.hits.push({ k: 'add', i: lines.length, r: { x, y: Math.max(yy, L.y), w, h: Math.max(0, Math.min(yy + row.h, L.y + L.h) - Math.max(yy, L.y)) } });
      continue;
    }
    const l = lines[row.i], i = row.i;
    const sel = i === ed.sel;
    const rc = roleColor(S, l.role);
    const inRange = ra >= 0 && i >= ra && i <= rb;
    // background: stripe → role tint (the speech line in its speaker's colour) → range → selection
    R(c, x, yy, w, row.h - 1, rowNo % 2 ? S.paper2 : S.paper);
    R(c, x + 3, yy, w - 3, row.h - 1, hexA(rc, S.dark ? 0.10 : 0.09));
    const rw = rowTextWidth(ed, i);
    if (S.kind === 'genko') drawGrid(c, S, x + TEXT_X, yy + 2, Math.floor(rw / CW), row.wrap.length, CW, 14);
    else if (S.kind === 'wp') R(c, x, yy + row.h - 1, w, 1, S.rule);
    if (inRange) { R(c, x + 3, yy, w - 3, row.h - 1, S.range); R(c, x + 3, yy, w - 3, row.h - 1, hexA(S.selBar, 0.18)); }
    const flash = ed.flashes.get(l);
    if (flash != null) { const a = 1 - (ed.t - flash) / 45; if (a > 0) R(c, x, yy, w, row.h - 1, hexA(S.dark ? '#ffcf4a' : '#ffb000', 0.35 * a)); }
    const inverse = sel && focusLines && S.kind === 'wp' && S.dark;
    if (sel) {
      const pulse = 0.5 + 0.5 * Math.sin(ed.t / 14);
      if (focusLines) { R(c, x, yy, w, row.h - 1, ed.moving ? (S.dark ? '#7a4a20' : '#ffc890') : S.sel); if (S.kind === 'genko') { drawGrid(c, S, x + TEXT_X, yy + 2, Math.floor(rw / CW), row.wrap.length, CW, 14); } }
      else R(c, x, yy, w, row.h - 1, hexA(S.sel, 0.4));
      R(c, x, yy, 3, row.h - 1, ed.moving ? S.warn : S.selBar);
      if (focusLines) R(c, x + 3, yy, w - 3, 1, hexA(S.selBar, 0.35 + 0.25 * pulse));
    } else R(c, x, yy, 3, row.h - 1, inRange ? S.selBar : hexA(rc, 0.85));
    if (inRange) { c.fillStyle = S.selBar; c.beginPath(); c.arc(x + 6, yy + 8, 2, 0, 7); c.fill(); }
    const selTxt = sel && focusLines ? S.selText : S.text;
    // number, beat chip (left margin), speaker chip
    T(c, String(i + 1), x + 21, yy + 4, 10, sel && focusLines ? (S.kind === 'wp' && S.dark ? S.selText : S.selBar) : S.num, 'right');
    const b = l.twist ? 'uragiri' : l.beat || stats.beats[i];
    if (b) drawChip(c, S, x + 24, yy + 2, 34, 14, BEAT_SHORT[b] || b, beatColor(S, b), { dim: !l.beat, size: 10 });
    drawChip(c, S, x + 61, yy + 2, 37, 14, ROLE_SHORT[l.role] || '?', rc, { size: 10 });
    if (l.src === 'bank') R(c, x + 4, yy + 2, 3, 3, S.pink);
    // text rows
    const tx = x + TEXT_X;
    row.wrap.forEach((s, k) => drawRowText(ed, c, s, tx, yy + 2 + k * 14 + (S.kind === 'genko' ? 0 : 0), l.src === 'bank' && !(sel && focusLines) ? mix(selTxt, S.paper, 0.18) : selTxt));
    // folded section marker / row menu dot
    if (ed.foldedHead(i)) { const n = ed.foldedHead(i); const lab = `▸+${n}`; const lw = Math.ceil(measure(c, lab, 10)) + 8; const fx = x + w - lw - 4; R(c, fx, yy + 2, lw, 13, S.toolOn); T(c, lab, fx + lw / 2, yy + 4, 10, S.toolOnText, 'center'); ed.hits.push({ k: 'fold', i, r: { x: fx, y: yy + 2, w: lw, h: 13 } }); }
    else if (sel && focusLines) { const mx = x + w - 18; R(c, mx, yy + 1, 16, 14, hexA(S.selBar, 0.2)); icon(c, 'more', mx + 8, yy + 8, 12, S.selText); ed.hits.push({ k: 'more', i, r: { x: mx, y: yy + 1, w: 16, h: 14 } }); }
    const cy0 = Math.max(yy, L.y), cy1 = Math.min(yy + row.h, L.y + L.h), ch = Math.max(0, cy1 - cy0);
    ed.hits.push({ k: 'num', i, r: { x, y: cy0, w: 24, h: ch } });
    ed.hits.push({ k: 'beat', i, r: { x: x + 24, y: cy0, w: 36, h: ch } });
    ed.hits.push({ k: 'role', i, r: { x: x + 60, y: cy0, w: 40, h: ch } });
    ed.hits.push({ k: 'text', i, r: { x: x + TEXT_X, y: cy0, w: w - TEXT_X, h: ch } });
  }
  c.restore();
  // scrollbar-less: the minimap is the scroll indicator
  drawMinimap(ed, c, rows, stats);
}

function drawMinimap(ed, c, rows, stats) {
  const S = ed.skin, L = G.list, lines = ed.n.lines, n = lines.length;
  const x = L.x + L.w - G.mini.w, y = L.y, h = L.h;
  R(c, x - 1, y, G.mini.w + 1, h, S.dark ? hexA('#000000', 0.35) : hexA('#000000', 0.10));
  ed.miniRect = { x: x - 2, y, w: G.mini.w + 2, h };
  if (!n) return;
  const per = Math.min(5, h / n);
  const hidden = ed.hiddenSet();
  for (let i = 0; i < n; i++) {
    const yy = y + Math.floor(i * (h - 1) / Math.max(1, n));
    const hh = Math.max(1, Math.round(per) - (per > 3 ? 1 : 0));
    const l = lines[i], b = l.twist ? 'uragiri' : l.beat || stats.beats[i];
    const a = hidden.has(i) ? 0.35 : 1;
    R(c, x, yy, 5, hh, b ? hexA(beatColor(S, b), a) : hexA(S.faint, a));
    R(c, x + 5, yy, 2, hh, hexA(roleColor(S, l.role), a));
  }
  // viewport
  const sc = ed.scroll, H = Math.max(1, ed.layoutH);
  const vy = y + (sc / H) * h, vh = Math.max(6, (G.list.h / H) * h);
  c.fillStyle = hexA(S.dark ? '#ffffff' : '#000000', 0.16); c.fillRect(x - 1, Math.round(vy), G.mini.w + 1, Math.round(Math.min(vh, h - (vy - y))));
  c.strokeStyle = hexA(S.dark ? '#ffffff' : '#000000', 0.55); c.lineWidth = 1; c.strokeRect(x - 0.5, Math.round(vy) + 0.5, G.mini.w, Math.round(Math.min(vh, h - (vy - y))) - 1);
  // the selection
  if (ed.sel < n) { const yy = y + Math.floor(ed.sel * (h - 1) / n); R(c, x - 3, yy, 3, 2, S.selBar); }
  if (ed.anchor >= 0) { const a = Math.min(ed.anchor, ed.sel), b = Math.max(ed.anchor, ed.sel); const y0 = y + Math.floor(a * (h - 1) / n), y1 = y + Math.floor(b * (h - 1) / n) + 2; R(c, x - 3, y0, 2, y1 - y0, S.selBar); }
}

// ------------------------------------------------------------------ the live feedback panel
// the round limits that matter for this kind: M-1 for 漫才, キングオブコント for コント, R-1 for ピン芸 (all from lengthPresets(g) of the game year);
// kinds without a contest of their own show the generic target of that kind (落語の高座 / 大喜利 / エピソードトーク / 劇場・テレビ)
const KIND_CONTEST = { manzai: ['m1'], conte: ['koc'], pin: ['r1'] };
const KIND_GENERIC = { rakugo: /落語/, ogiri: /大喜利/, talk: /エピソード/, utaneta: /劇場|テレビ/, monomane: /劇場|テレビ/ };
export function limitMarks(ed) {
  const out = [];
  const want = KIND_CONTEST[ed.kind];
  const add = (p, short1) => { const f = out.find((o) => o.sec === p.sec); if (!f) out.push({ sec: p.sec, label: p.label, short: short1 }); else f.label += `／${p.label}`; };
  for (const p of ed.presets()) { if (want && p.contest && want.includes(p.contest)) add(p, p.name ? short(p.name.replace(/グランプリ|ぐらんぷり|キングオブ/g, ''), 6) : ''); }
  if (!out.length && KIND_GENERIC[ed.kind]) for (const p of ed.presets()) { if (!p.contest && KIND_GENERIC[ed.kind].test(p.label)) add(p, p.label.replace(/（.*）/, '')); }
  return out.sort((a, b) => a.sec - b.sec);
}
function drawPanelLive(ed, c) {
  const S = ed.skin, P = G.panel, n = ed.n, st = ed.stats();
  drawPanel(c, S, P.x, P.y, P.w, P.h, 'ネタの状態', ed.liveStale() ? '計算中…' : '');
  const E = st.est;
  let y = P.y + 19;
  const over = E.sec > n.target * 1.05;
  const tcol = S.panelText;
  // time: 推定 / 目安 and the bar with the round limits
  T(c, `推定 ${mmss(E.sec)}`, P.x + 8, y, 12, over ? S.bad : tcol);
  T(c, `目安 ${mmss(n.target)}`, P.x + P.w - 8, y + 2, 10, S.panelDim, 'right');
  y += 16;
  const bx = P.x + 8, bw = P.w - 16;
  const marks = limitMarks(ed);
  const maxSec = Math.max(n.target * 1.25, E.sec * 1.08, 60);
  R(c, bx, y, bw, 7, S.track);
  R(c, bx, y, Math.round(bw * Math.min(1, E.sec / maxSec)), 7, over ? S.bad : E.sec >= n.target * 0.85 ? S.good : S.accent === '#a98bff' ? '#ffcf4a' : S.warn);
  let lastLab = -99;
  for (const m of marks) { if (m.sec > maxSec) continue; const mx = bx + Math.round(bw * (m.sec / maxSec)); R(c, mx, y - 2, 1, 11, S.panelText); if (mx - lastLab >= 16) { const mn = m.sec / 60; T(c, `${Number.isInteger(mn) ? mn : mn.toFixed(1)}分`, mx, y + 8, 9, S.panelDim, 'center'); lastLab = mx; } }
  const tx = bx + Math.round(bw * Math.min(1, n.target / maxSec));
  c.fillStyle = S.accent; c.beginPath(); c.moveTo(tx - 3, y - 4); c.lineTo(tx + 3, y - 4); c.lineTo(tx, y); c.closePath(); c.fill();
  y += marks.length ? 18 : 10;
  // which limit does it fit in
  const fits = marks.filter((m) => E.sec <= m.sec + 1).sort((a, b) => a.sec - b.sec)[0];
  const txt = over ? `尺オーバー ${E.sec - n.target}秒！` : E.sec < n.target * 0.8 ? `あと${n.target - E.sec}秒ぶん書ける` : 'ちょうどいい長さ';
  T(c, txt, P.x + 8, y, 10, over ? S.bad : S.panelDim, 'left', P.w - 16);
  y += 12;
  if (marks.length) { T(c, fits ? `${fits.short || '持ち時間'} ${mmss(fits.sec).replace(/00秒$/, '')}までに収まる` : `最長の持ち時間（${mmss(marks[marks.length - 1].sec).replace(/00秒$/, '')}）をこえている`, P.x + 8, y, 10, fits ? S.panelDim : S.bad, 'left', P.w - 16); y += 12; }
  y += 1;
  // the laughter curve
  T(c, '笑いの予想カーブ', P.x + 8, y, 10, S.pdark ? S.accent === '#a98bff' ? '#ffcf4a' : S.panelHeadText : S.panelHead);
  y += 12;
  drawCurve(ed, c, P.x + 8, y, P.w - 16, 34, st);
  y += 38;
  // warnings with a fix button
  const W = st.lint;
  T(c, W.length ? `気になる点 ${W.length}` : '気になる点 なし', P.x + 8, y, 10, W.length ? (S.pdark ? '#ffb547' : S.warn) : S.good);
  if (W.length) { const bw2 = 52; R(c, P.x + P.w - bw2 - 6, y - 2, bw2, 13, S.toolOn); T(c, 'ぜんぶ見る', P.x + P.w - 6 - bw2 / 2, y, 10, S.toolOnText, 'center', bw2); ed.hits.push({ k: 'checkall', r: { x: P.x + P.w - bw2 - 6, y: y - 2, w: bw2, h: 13 } }); }
  y += 13;
  ed.fixRects = [];
  const room = Math.max(0, Math.floor((P.y + P.h - 34 - y) / 22));
  W.slice(0, Math.min(3, room)).forEach((w, k) => {
    const col = w.level === 'bad' ? S.bad : w.level === 'warn' ? (S.pdark ? '#ffb547' : S.warn) : S.info;
    R(c, P.x + 6, y + 1, 2, 19, col);
    T(c, w.text, P.x + 11, y + 1, 10, S.panelText, 'left', P.w - 20);
    if (w.fix) {
      const lab = `▶ ${w.fix.label}`;
      const fw = Math.min(P.w - 22, Math.ceil(measure(c, lab, 10)) + 8);
      const r = { x: P.x + 11, y: y + 11, w: fw, h: 11 };
      R(c, r.x, r.y, fw, 11, hexA(col, S.pdark ? 0.30 : 0.22)); T(c, lab, r.x + 4, r.y + 1, 10, S.panelText, 'left', fw - 6);
      ed.fixRects.push({ r, w });
      ed.hits.push({ k: 'fix', w, r: { x: r.x, y: r.y - 1, w: fw, h: 13 } });
    }
    y += 22;
  });
  // numbers and hints at the bottom
  const cn = st.counts;
  const by = P.y + P.h - 32;
  // the kind's 構成チェック as small ticks, if there is room
  const ck = st.check, rowsN = Math.ceil(ck.length / 2), roomH = by - 4 - y;
  if (ck.length && roomH >= 12 + rowsN * 11) {
    T(c, '構成チェック', P.x + 8, y + 1, 10, S.pdark ? (S.accent === '#a98bff' ? '#ffcf4a' : S.panelHeadText) : S.panelHead);
    ck.forEach((it, k) => T(c, `${it.ok ? '✔' : '・'}${it.label}`, P.x + 8 + (k % 2) * 96, y + 13 + Math.floor(k / 2) * 11, 10, it.ok ? S.good : S.panelDim, 'left', 94));
  }
  R(c, P.x + 6, by - 2, P.w - 12, 1, S.pdark ? hexA('#ffffff', 0.12) : hexA('#000000', 0.15));
  T(c, `${cn.lines}行・${cn.chars}字・約${cn.words}語・ボケ${E.punches}`, P.x + 8, by, 10, S.panelText, 'left', P.w - 16);
  const ai = ed.liveAi();
  const prac = ed.saved ? Math.round(ed.saved.practice || 0) : 0;
  const dok = ai && ai.axes && ai.axes.dokuji != null ? ai.axes.dokuji : null;
  T(c, `仕上がり ${prac}`, P.x + 8, by + 12, 10, S.panelDim);
  if (dok != null) T(c, `独自性 ${dok}`, P.x + 84, by + 12, 10, ed.liveStale() ? S.panelDim : (S.pdark ? scoreCol(dok) : dok >= 55 ? S.good : dok >= 35 ? S.warn : S.bad));
  const hint = ed.hint();
  T(c, hint, P.x + P.w - 8, by + 12, 10, S.panelDim, 'right', 70);
}

function drawCurve(ed, c, x, y, w, h, st) {
  const S = ed.skin, n = ed.n, T0 = st.times;
  R(c, x, y, w, h, S.pdark ? hexA('#000000', 0.28) : hexA('#000000', 0.07));
  const total = Math.max(1, T0.total);
  const ai = ed.liveAi();
  const sOf = new Map();
  if (ai && ai.lines) for (const l of ai.lines) sOf.set(l.i, l);
  const stale = ed.liveStale();
  const L = n.lines;
  // dry stretches (no punch for longer than the kind's gap) under the bars
  for (const w2 of st.dry) { const x0 = x + (w2.t0 / total) * w, x1 = x + (w2.t1 / total) * w; R(c, x0, y + h - 3, Math.max(1, x1 - x0), 3, hexA(S.bad, 0.7)); }
  let pts = [];
  for (let i = 0; i < L.length; i++) {
    const sec = T0.sec[i];
    if (!sec) continue;
    const x0 = x + (T0.start[i] / total) * w, bw = Math.max(1, (sec / total) * w - 1);
    const info = sOf.get(i);
    const punch = T0.punch[i];
    const sv = info ? info.s : punch ? 45 : 12;
    const v = punch ? sv : info && info.k === 't' ? sv * 0.35 : sv * 0.18;
    const bh = Math.max(1, Math.round(((h - 5) * Math.min(100, v)) / 100));
    const col = punch ? (sv >= 60 ? S.good : sv >= 40 ? (S.pdark ? '#ffcf4a' : S.warn) : S.bad) : mix(S.faint, S.panelText, 0.2);
    c.globalAlpha = stale ? 0.45 : 1;
    R(c, x0, y + h - 3 - bh, bw, bh, col);
    c.globalAlpha = 1;
    if (punch) pts.push([x0 + bw / 2, y + h - 3 - bh]);
    if (i === ed.sel) R(c, x0, y, Math.max(1, bw), 2, S.selBar);
  }
  if (pts.length > 1) { c.strokeStyle = hexA(S.panelText, 0.55); c.lineWidth = 1; c.beginPath(); pts.forEach(([px, py], k) => (k ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke(); }
  if (!L.length) T(c, '台本を書くとここに出る', x + w / 2, y + 12, 10, S.panelDim, 'center', w - 8);
}

// ------------------------------------------------------------------ the detail strip, side hints, toolbar
function drawDetail(ed, c) {
  const S = ed.skin, D = G.detail, L = ed.n.lines;
  const st = ed.stats();
  if (S.box === 'card') { RR(c, D.x, D.y, D.w, D.h, 6, S.panel); } else { R(c, D.x, D.y, D.w, D.h, S.detail); R(c, D.x, D.y, D.w, 1, S.kind === 'genko' ? '#8a6a44' : S.panelEdge); }
  const dtx = S.dText, dd = S.dDim;
  if (ed.anchor >= 0) {
    const [a, b] = ed.rangeIdx();
    T(c, `${b - a + 1}行を選択中（${a + 1}〜${b + 1}行目）`, D.x + 8, D.y + 5, 12, dtx);
    T(c, '↑↓ はんいを広げる　A 操作（削除・話者・ビート…）　B 解除', D.x + 8, D.y + 21, 10, dd, 'left', D.w - 16);
    return;
  }
  const cur = L[ed.sel];
  if (!cur) { T(c, L.length ? 'A：行を足す（部品から・自分で書く・まとめて書く・テンプレ）' : '台本はまだ空。部品から組むか、テンプレを入れるか、自分で書いてみよう。', D.x + 8, D.y + 12, 11, dd, 'left', D.w - 16); return; }
  if (ed.aHold && !ed.aHold.done) R(c, D.x, D.y + D.h - 3, Math.round(D.w * Math.min(1, (ed.t - ed.aHold.t) / 26)), 3, S.selBar);
  const b = cur.twist ? 'uragiri' : cur.beat || st.beats[ed.sel];
  T(c, `${ed.sel + 1}行目・${ed.roleLabel(cur.role)}${b ? `・${BEAT_SHORT[b] || b}${cur.beat ? '' : '（自動）'}` : ''}${cur.src === 'bank' ? '・部品のまま' : ''}`, D.x + 8, D.y + 4, 10, cur.src === 'bank' ? S.pink : dd, 'left', 300);
  const sec = st.times.sec[ed.sel] || 0;
  T(c, `${Array.from(cur.text).length}字・約${sec.toFixed(1)}秒`, D.x + D.w - 52, D.y + 4, 10, dd, 'right');
  const ls = jwrap(c, cur.text, D.w - 16, 11);
  ls.slice(0, 2).forEach((s, k) => T(c, k === 1 && ls.length > 2 ? fit(c, `${s}…`, D.w - 16, 11) : s, D.x + 8, D.y + 16 + k * 11, 11, dtx));
  // ▲▼ (move the line)
  for (const [id, dx] of [['up', D.x + D.w - 46], ['down', D.x + D.w - 24]]) {
    const r = { x: dx, y: D.y + 2, w: 20, h: 14 };
    drawButton(c, S, r.x, r.y, r.w, r.h, '', { bg: S.pdark ? undefined : undefined });
    icon(c, id, r.x + 10, r.y + 7, 11, S.toolText);
    ed.hits.push({ k: 'move', id, r });
  }
}
function drawSide(ed, c) {
  const S = ed.skin, D = G.side;
  const lines = ed.hintLines();
  lines.forEach((s, k) => T(c, s, D.x + D.w - 2, D.y + 3 + k * 12, 10, S.hint, 'right', D.w - 4));
}
function drawTools(ed, c) {
  const S = ed.skin;
  ed.toolRects = [];
  const { y, h, bw } = G.tools;
  ed.tools().forEach((lb, i) => {
    const x = 3 + i * (bw + 2);
    const on = ed.focus === 'tools' && ed.tool === i;
    drawButton(c, S, x, y, bw, h, lb, { on, save: i === 5, size: 12 });
    if (on) { c.strokeStyle = S.selBar; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, bw - 2, h - 2); }
    ed.toolRects.push({ x, y, w: bw, h });
  });
}

// ------------------------------------------------------------------ animated toasts (slide up, hold, fade) in the strip under the panel
function drawToasts(ed, c) {
  const S = ed.skin, D = G.side;
  const t = ed.toasts[0];
  if (!t) return;
  const life = ed.toastLife || 150;
  const a = Math.min(1, t.t / 8) * Math.min(1, (life - t.t) / 20);
  const ease = 1 - Math.pow(1 - Math.min(1, t.t / 10), 3);
  const w = Math.min(380, Math.ceil(measure(c, t.text, 11)) + 30), x = D.x + D.w - 2 - w, y = D.y + 8 + (1 - ease) * 12;
  c.globalAlpha = Math.max(0, a);
  RR(c, x, y, w, 22, 5, 'rgba(10,8,16,0.94)'); R(c, x + 2, y + 4, 3, 14, t.color);
  T(c, t.text, x + 10, y + 5, 11, '#ffffff', 'left', w - 14);
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------ touch: the 70-unit bar of big cells (≥70 x 70 units)
export const TOUCH_CELLS = ['undo', 'redo', 'add', 'edit', 'up', 'down', 'more', 'save'];
const CELL_LABEL = { undo: '戻す', redo: 'やり直し', add: '足す', edit: '書く', up: '上へ', down: '下へ', more: '操作', save: '保存' };
const CELL_ICON = { undo: 'undo', redo: 'redo', add: 'plus', edit: 'pen', up: 'up', down: 'down', more: 'more', save: 'check' };
export function drawTouchBar(ed, c) {
  const S = ed.skin;
  R(c, 0, 0, SW, TB, S.head); R(c, 0, TB, SW, 2, S.headEdge);
  ed.touchCells = [];
  TOUCH_CELLS.forEach((id, i) => {
    const x = i * 70, r = { x, y: 0, w: 70, h: TB };
    const off = (id === 'undo' && !ed.hist.canUndo) || (id === 'redo' && !ed.hist.canRedo);
    const hot = id === 'save' && ed.dirty;
    R(c, x + 2, 3, 66, TB - 8, hot ? hexA(S.accent, 0.35) : hexA(S.dark ? '#ffffff' : '#000000', 0.10));
    icon(c, CELL_ICON[id], x + 35, 28, 30, off ? S.headDim : S.headText);
    T(c, CELL_LABEL[id], x + 35, 49, 12, off ? S.headDim : S.headText, 'center', 66);
    ed.touchCells.push({ id, r });
  });
}
void inR;
