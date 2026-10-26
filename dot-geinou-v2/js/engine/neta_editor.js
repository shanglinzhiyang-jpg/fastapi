// 台本エディタ (EditorScene) — 大幅進化 (owner: R10-A). API: test-output/api_neta_editor.txt
//   neta_editor_core.js  history (undo / redo), clipboard, snippets, search / replace, lint, versions (no DOM)
//   neta_editor_skin.js  the era skins (昭和 原稿用紙 / 平成 ワープロ / 令和 ノート)
//   neta_editor_view.js  drawing (list with wrapped rows + minimap, live feedback panel, toolbar, touch bar)
//   neta_editor_read.js  読み上げプレビュー
// Keys: ↑↓ line (hold = faster, PageUp/PageDown/Home/End), ←→ speaker, A edit the line (hold A: line menu), B close, ↑ at the top: the
// header chips (⟲ ⟳ ⋯ title 種類 テーマ 尺 言葉), ↓ at the bottom: the toolbar; ↓ on the toolbar wraps to the first line. Desktop extras:
// Ctrl+Z / Ctrl+Y undo / redo, Ctrl+C / X / V lines (also text from outside), Ctrl+D duplicate, Ctrl+A all, Ctrl+F / F search (F3 next),
// Del delete, Alt+↑↓ move, V range, H fold, N new line, P read-through, O all commands, U / Y undo / redo, right click = line menu, wheel scroll.
// Touch: the 70-unit bar (戻す やり直し 足す 書く 上へ 下へ 操作 保存), swipe the list, the minimap, tap the number / chips of a line.

import { clamp } from './util.js';
import * as TI from './textinput.js';
import { estimate, structureCheck, scoreLocal, KINDS, mmss, netaHash } from './neta_ai.js';
import { keyState, getMode } from './neta_claude.js';
import { partsFor, topicsFor, buildAuto, DEFAULT_LEN, ERA_YEAR } from './neta_bank.js';
import {
  has, safe, sfx, num, R, inR, short, K, KIND_LABEL, ROLE_OPTS, ROLE_LONG, BEAT_OPTS, BEAT_LONG, CLOSE, TB, isTouch, topNeta, Base, partsModal, lengthPresets, hexA,
} from './neta_ui_kit.js';
import * as C from './neta_editor_core.js';
import { skinFor } from './neta_editor_skin.js';
import * as V from './neta_editor_view.js';
import { readModal } from './neta_editor_read.js';

export const TOOLS = ['部品から足す', '自分で書く', 'まとめて書く', '台本の設定', 'AI採点', '保存して閉じる'];
const HEAD = ['undo', 'redo', 'more', 'title', 'kind', 'theme', 'target', 'dialect'];
const FLASH = 45;
let _mc = null;
const mctx = () => { if (_mc) return _mc; if (typeof document === 'undefined') return null; _mc = document.createElement('canvas').getContext('2d'); return _mc; };
const askText = (g, o) => TI.askText(g, o);
const isAskingText = () => (typeof TI.isAskingText === 'function' ? TI.isAskingText() : typeof document !== 'undefined' && !!document.querySelector('.textask'));
const typing = (e) => { const t = e && e.target; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); };

export class EditorScene extends Base {
  constructor(g, draft, opts, resolve) {
    super(g, resolve);
    this.n = draft;
    this.opts = opts || {};
    this.kind = KINDS[draft.kind] ? draft.kind : 'manzai';
    this.skin = skinFor(this.era());
    this.sel = Math.max(0, draft.lines.length - 1);
    this.scroll = 0; this.scrollT = 0; this.needEnsure = true; this.layoutH = 0;
    this.focus = 'lines'; this.tool = 0; this.headIdx = 0;
    this.anchor = -1; this.moving = false;
    this.dirty = !draft.id && draft.lines.length > 0;
    this.saved = draft.id ? g.neta(draft.id) : null;
    this.hist = new C.History(60);
    this.rev = 0; this.foldRev = 0; this.folds = new Set(); this.flashes = new WeakMap(); this.find = null;
    this.cache = { rev: -1 }; this.live = null; this.liveNext = 0; this.lastEdit = 0; this.editCount = 0; this.lastSnap = -9999; this.draftDue = 0;
    this.hits = []; this.toolRects = []; this.fixRects = []; this.touchCells = [];
    this.keyq = []; this.gesture = null; this.aHold = null; this.freeScroll = false;
    this._presets = null;
    this.toastLife = 150; this.toastMax = 1;
    this.bindKeys();
  }
  // ---------------------------------------------------------------- context
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
    if (this.kind === 'ogiri' && r === 'pin') return '回答';
    if (this.kind === 'manzai' && (r === 'boke' || r === 'tsukkomi')) { const nm = this.names()[r]; if (nm) return `${ROLE_LONG[r]}（${nm}）`; }
    return ROLE_LONG[r] || r;
  }
  presets() { if (!this._presets) this._presets = safe(() => lengthPresets(this.g), []) || []; return this._presets; }
  rows() { return [...this.n.lines, { add: true }]; }
  tools() { return TOOLS; }
  headItems() { return HEAD; }
  hashNow() { if (this._hr !== this.rev) { this._hr = this.rev; this._hv = netaHash(this.n); } return this._hv; }
  stats() {
    if (this.cache.rev === this.rev && this.cache.est) return this.cache;
    const n = this.n;
    const est = estimate(n), check = structureCheck(n), times = C.lineTimes(n), dry = C.dryStretches(n, times);
    const lint = C.lintScript(n, { est, check, times, dry, year: this.year() });
    // a hint from the saved script: 仕上がり (rehearsal) is low
    if (this.saved && num(this.saved.practice) < 40 && est.lines >= 6) lint.push({ id: 'practice', level: 'info', text: `仕上がり ${num(this.saved.practice)}：ネタ合わせで上がる`, line: null, fix: { id: 'practice', label: 'ネタ合わせをする' } });
    this.cache = { rev: this.rev, est, check, times, dry, lint, beats: times.beats, counts: C.counts(n) };
    return this.cache;
  }
  liveAi() { return this.live ? this.live.ai : null; }
  liveStale() { return !!this.n.lines.length && (!this.live || this.live.rev !== this.rev); }
  hint() { return this.hist.canUndo ? `戻せる ${this.hist.undoS.length}` : ''; }
  hintLines() {
    if (this.moving) return ['↑↓ 動かす', 'A / B 決定'];
    if (this.anchor >= 0) return ['↑↓ はんい　A 操作', 'B 解除　Ctrl+C コピー'];
    if (this.focus === 'tools') return ['←→ えらぶ　A 決定', '↑↓ 台本へ　B 閉じる'];
    if (this.focus === 'head') return ['←→ えらぶ　A 開く', '↓ 台本へ　B 閉じる'];
    return ['↑↓ 行　A 書く　←→ 話者', '長押しA 操作　B 閉じる'];
  }
  rangeIdx() { return this.anchor >= 0 ? C.rangeOf(this.anchor, this.sel) : [this.sel, this.sel]; }
  selLines() { const L = this.n.lines; if (!L.length || this.sel >= L.length) return null; const [a, b] = this.rangeIdx(); return [Math.min(a, L.length - 1), Math.min(b, L.length - 1)]; }
  hiddenSet() {
    const key = `${this.rev}|${this.foldRev}`;
    if (this._hk === key) return this._hs;
    const hs = new Set();
    if (this.folds.size) { const L = this.n.lines; for (const s of this.sections()) if (s.end > s.start && this.folds.has(L[s.start])) for (let i = s.start + 1; i <= s.end; i++) hs.add(i); }
    this._hk = key; this._hs = hs;
    return hs;
  }
  sections() { if (this._sk !== this.rev) { this._sk = this.rev; this._sv = C.sections(this.n.lines, this.stats().beats); } return this._sv; }
  foldedHead(i) { if (!this.folds.size) return 0; const s = this.sections().find((x) => x.start === i); return s && s.end > s.start && this.folds.has(this.n.lines[i]) ? s.end - s.start : 0; }
  visibleIdx() { const hs = this.hiddenSet(), out = []; for (let i = 0; i < this.n.lines.length; i++) if (!hs.has(i)) out.push(i); out.push(this.n.lines.length); return out; }

  // ---------------------------------------------------------------- selection + scrolling
  setSel(i) {
    const n = this.n.lines.length;
    i = clamp(i, 0, n);
    if (i === this.sel) return;
    this.sel = i; this.needEnsure = true; this.freeScroll = false;
  }
  clampSel() {
    const n = this.n.lines.length;
    this.sel = clamp(this.sel, 0, n);
    if (this.sel < n) { const hs = this.hiddenSet(); if (hs.has(this.sel)) { const s = this.sections().find((x) => this.sel >= x.start && this.sel <= x.end); if (s) this.sel = s.start; } }
    if (this.anchor > n - 1) this.anchor = n - 1;
    if (!n) this.anchor = -1;
  }
  tickScroll() {
    const c = mctx();
    if (!c) return;
    const rows = V.layoutRows(this, c);
    const view = V.G.list.h;
    const maxS = Math.max(0, this.layoutH + 4 - view);
    if (this.needEnsure) {
      this.needEnsure = false;
      const r = rows.find((x) => x.i === this.sel);
      if (r) { if (r.h > view - 8 || r.y - 4 < this.scrollT) this.scrollT = r.y - 4; else if (r.y + r.h + 4 > this.scrollT + view) this.scrollT = r.y + r.h + 4 - view; }
    }
    this.scrollT = clamp(this.scrollT, 0, maxS);
    this.scroll = clamp(this.scroll, 0, maxS + 40);
    const d = this.scrollT - this.scroll;
    this.scroll = Math.abs(d) < 0.5 ? this.scrollT : this.scroll + d * 0.34;
  }
  scrollTo(y) { const maxS = Math.max(0, this.layoutH + 4 - V.G.list.h); this.scrollT = this.scroll = clamp(y, 0, maxS); this.freeScroll = true; }
  centerOn(i) { const rows = this.layoutRowsNow(); const r = rows.find((x) => x.i === i); if (r) this.scrollT = clamp(r.y + r.h / 2 - V.G.list.h / 2, 0, Math.max(0, this.layoutH + 4 - V.G.list.h)); }
  layoutRowsNow() { const c = mctx(); return c ? V.layoutRows(this, c) : []; }
  wheel(dy, e) {
    if (this.modals.length) return super.wheel(dy);
    if (this.busy) return false;
    void e;
    this.scrollTo(this.scrollT + dy * 0.6);
    return true;
  }

  // ---------------------------------------------------------------- the editing core: every change goes through commit() (undo / redo)
  commit(label, fn, key = '') {
    this.hist.push(this.n, this.sel, label, key, this.t);
    const r = fn();
    this.changed();
    return r;
  }
  changed() {
    this.rev++; this.dirty = true; this.lastEdit = this.t; this.editCount++;
    this.draftDue = this.t + 90;
    this.clampSel(); this.needEnsure = true;
    if (this.editCount % 8 === 0 && this.t - this.lastSnap > 600) this.snap('じどう');
  }
  insert(at, lines, label = '行を足す') {
    const L = this.n.lines;
    if (L.length >= C.MAX_LINES) { this.toast('これ以上は書けない（160行まで）', K.red); return 0; }
    let k = 0;
    this.commit(label, () => { k = C.insertAt(L, at, lines.map((l) => { const o = { role: l.role, text: l.text, beat: l.beat || '' }; if (l.twist) o.twist = true; if (l.src) o.src = l.src; return o; })); });
    for (let j = at; j < at + k; j++) this.flashes.set(L[j], this.t);
    this.anchor = -1;
    this.setSel(at + k - 1);
    return k;
  }
  insPos() { const L = this.n.lines; if (this.sel >= L.length) return L.length; return this.rangeIdx()[1] + 1; }
  defaultRole(at) {
    const L = this.n.lines, prev = L[at - 1];
    if (this.kind === 'manzai') return prev && prev.role === 'boke' ? 'tsukkomi' : 'boke';
    if (this.kind === 'conte') return prev && prev.role === 'a' ? 'b' : 'a';
    if (this.kind === 'rakugo') return prev && prev.role === 'a' ? 'b' : prev && prev.role === 'b' ? 'a' : 'narr';
    return 'pin';
  }
  afterRestore(e) {
    this.kind = KINDS[this.n.kind] ? this.n.kind : 'manzai';
    this.folds.clear(); this.foldRev++;
    this.rev++; this.dirty = true; this.lastEdit = this.t; this.draftDue = this.t + 90;
    this.anchor = -1;
    this.sel = clamp(e.sel | 0, 0, this.n.lines.length);
    this.clampSel(); this.needEnsure = true;
  }
  undo() { const e = this.hist.undo(this.n, this.sel); if (!e) { sfx('buzz'); this.toast('これ以上戻せない', K.dim); return; } this.afterRestore(e); sfx('cursor'); this.toast(`元に戻した：${e.label}`, K.cyan); }
  redo() { const e = this.hist.redo(this.n, this.sel); if (!e) { sfx('buzz'); this.toast('やり直すものがない', K.dim); return; } this.afterRestore(e); sfx('cursor'); this.toast(`やり直した：${e.label}`, K.cyan); }

  // ---------------------------------------------------------------- commands (palette, keys, header and touch buttons all land here)
  cmdTable() {
    const L = this.n.lines, sl = this.selLines(), H = this.hist, clipN = C.CLIP.lines.length;
    const kindHasSwap = C.canSwap(this.kind);
    return [
      { g: '編集' },
      { id: 'edit', label: 'セリフを書きかえる', hint: 'A', on: !!sl, async: true, run: () => this.editLine(this.sel) },
      { id: 'undo', label: H.canUndo ? `元に戻す（${H.undoLabel}）` : '元に戻す', hint: 'Ctrl+Z', on: H.canUndo, run: () => this.undo() },
      { id: 'redo', label: H.canRedo ? `やり直す（${H.redoLabel}）` : 'やり直す', hint: 'Ctrl+Y', on: H.canRedo, run: () => this.redo() },
      { id: 'copy', label: 'コピー', hint: 'Ctrl+C', on: !!sl, run: () => this.copyLines(false) },
      { id: 'cut', label: '切り取り', hint: 'Ctrl+X', on: !!sl, run: () => this.copyLines(true) },
      { id: 'paste', label: clipN ? `貼りつけ（${clipN}行）` : '貼りつけ', hint: 'Ctrl+V', on: clipN > 0, run: () => this.pasteLines() },
      { id: 'dup', label: '複製', hint: 'Ctrl+D', on: !!sl, run: () => this.dupLines() },
      { id: 'del', label: '削除', hint: 'Del', on: !!sl, run: () => this.delLines() },
      { id: 'up', label: 'ひとつ上へ動かす', hint: 'Alt+↑', on: !!sl, run: () => this.moveLines(-1) },
      { id: 'down', label: 'ひとつ下へ動かす', hint: 'Alt+↓', on: !!sl, run: () => this.moveLines(1) },
      { id: 'range', label: this.anchor >= 0 ? '範囲選択をやめる' : '範囲を選ぶ（複数行）', hint: 'V', on: !!L.length, run: () => this.toggleRange() },
      { id: 'all', label: 'すべて選ぶ', hint: 'Ctrl+A', on: !!L.length, run: () => this.selectAll() },
      { g: '台本づくり' },
      { id: 'parts', label: '部品から足す', on: true, async: true, run: () => this.addParts() },
      { id: 'snip', label: 'テンプレを入れる', on: true, async: true, run: () => this.snippetMenu() },
      { id: 'boke', label: 'ボケ候補', on: true, async: true, run: () => this.candidates('boke') },
      { id: 'tsukkomi', label: 'ツッコミ候補（選んだ行に）', on: !!sl, async: true, run: () => this.candidates('tsukkomi') },
      { id: 'swap', label: kindHasSwap ? (this.kind === 'manzai' ? 'ボケとツッコミを入れかえる' : '人物AとBを入れかえる') : '話者の入れかえ（漫才・コント・落語）', on: kindHasSwap && !!L.length, run: () => this.swapSpeakers() },
      { id: 'fold', label: 'この場面を折りたたむ／ひらく', hint: 'H', on: !!sl, run: () => this.toggleFold() },
      { id: 'foldall', label: 'すべて折りたたむ／ひらく', on: !!L.length, run: () => this.foldAll() },
      { id: 'bulk', label: 'まとめて書く（貼りつけ）', on: true, async: true, run: () => this.bulkWrite() },
      { id: 'write', label: '自分で書く（この下に）', hint: 'N', on: true, async: true, run: () => this.writeLine(this.insPos(), null) },
      { g: '調べる・見る' },
      { id: 'find', label: 'さがす・置きかえ', hint: 'Ctrl+F', on: !!L.length, async: true, run: () => this.findFlow() },
      { id: 'findnext', label: '次の検索結果', hint: 'F3', on: !!(this.find && this.find.q), run: () => this.findNext(1) },
      { id: 'read', label: '読み上げプレビュー（はじめから）', hint: 'P', on: L.some((l) => String(l.text).trim()), async: true, run: () => this.readThrough(0) },
      { id: 'readfrom', label: '読み上げプレビュー（この行から）', on: !!sl, async: true, run: () => this.readThrough(this.sel) },
      { id: 'check', label: `構成チェック（気になる点 ${this.stats().lint.length}）`, on: true, async: true, run: () => this.checkMenu() },
      { id: 'versions', label: '版をもどす（自動保存）', on: true, async: true, run: () => this.versionsMenu() },
      { id: 'copytext', label: '台本をテキストでコピー', on: !!L.length, async: true, run: () => this.copyText() },
      { g: '台本' },
      { id: 'settings', label: '台本の設定', on: true, async: true, run: () => this.settingsMenu() },
      { id: 'score', label: 'AI採点', on: true, async: true, run: () => this.score() },
      { id: 'save', label: '保存する', hint: 'Ctrl+S', on: true, run: () => { if (this.save()) sfx('ok'); } },
      { id: 'close', label: '保存して閉じる', on: true, async: true, run: () => { const ok = this.save(); if (ok) this.close(this.saved); return null; } },
    ];
  }
  runCmd(id) {
    if (id === 'palette') return this.act(() => this.paletteMenu());
    if (id === 'pgup' || id === 'pgdn' || id === 'home' || id === 'end') return this.navKey(id);
    if (id === 'line') return this.act(() => this.lineMenu(this.sel));
    const cmd = this.cmdTable().find((x) => x.id === id);
    if (!cmd) return null;
    if (!cmd.on) { sfx('buzz'); return null; }
    if (cmd.async) return this.act(() => cmd.run());
    return cmd.run();
  }
  navKey(id) {
    this.focus = 'lines';
    const vis = this.visibleIdx();
    const pos = Math.max(0, vis.indexOf(this.sel));
    const page = Math.max(3, Math.floor(V.G.list.h / 20));
    const to = id === 'home' ? 0 : id === 'end' ? vis.length - 1 : id === 'pgup' ? Math.max(0, pos - page) : Math.min(vis.length - 1, pos + page);
    this.setSel(vis[to]); sfx('cursor');
  }
  async paletteMenu() {
    const tbl = this.cmdTable();
    const items = tbl.map((c) => (c.g ? { label: c.g, head: true } : { label: c.label, right: c.hint || '', lock: !c.on, cmd: c }));
    const k = await this.pick({ title: '操作メニュー', items, rh: 22, w: 460 });
    if (k < 0) return;
    const cmd = items[k].cmd;
    if (cmd) { if (cmd.async) await cmd.run(); else cmd.run(); }
  }

  // ---------------------------------------------------------------- block operations on the selection
  copyLines(cut) {
    const sl = this.selLines();
    if (!sl) return;
    const [a, b] = sl, L = this.n.lines;
    const k = C.copyToClip(L.slice(a, b + 1), this.kind);
    try { if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(C.CLIP.text).catch(() => {}); } catch (e) { /* no clipboard */ }
    if (cut) { this.commit('切り取り', () => { C.removeRange(L, a, b); }); this.anchor = -1; this.setSel(Math.min(a, L.length - 1)); this.toast(`${k}行を切り取った`, K.green); }
    else { this.anchor = -1; this.toast(`${k}行をコピーした（別の台本にも貼れる）`, K.green); }
    sfx('ok');
  }
  pasteLines(textIn) {
    let items = null;
    if (typeof textIn === 'string' && textIn.trim() && textIn !== C.CLIP.text) items = C.fromText(textIn, this.kind, this.n.chars || {});
    else items = C.clipLines(this.kind);
    if (!items.length) { this.toast('貼りつけるものがない（先にコピー）', K.dim); sfx('buzz'); return; }
    const k = this.insert(this.insPos(), items.map((l) => ({ ...l, src: undefined })), '貼りつけ');
    if (k) { this.toast(`${k}行を貼りつけた`, K.green); sfx('ok'); }
  }
  dupLines() {
    const sl = this.selLines();
    if (!sl) return;
    const [a, b] = sl, L = this.n.lines;
    const copy = L.slice(a, b + 1).map((l) => ({ ...l, src: undefined }));
    const k = this.insert(b + 1, copy, '複製');
    if (k) { this.toast(`${k}行を複製した`, K.green); sfx('ok'); }
  }
  delLines() {
    const sl = this.selLines();
    if (!sl) return;
    const [a, b] = sl, L = this.n.lines;
    if (b - a + 1 >= 3) this.snap('削除の前');
    this.commit('削除', () => { C.removeRange(L, a, b); });
    this.anchor = -1;
    this.setSel(Math.min(a, L.length));
    this.sel = clamp(this.sel, 0, L.length);
    this.toast(`${b - a + 1}行を消した（⟲で戻せる）`, K.warn);
    sfx('cancel');
  }
  moveLines(dir) {
    const sl = this.selLines();
    if (!sl) return;
    const [a, b] = sl, L = this.n.lines;
    if ((dir < 0 && a <= 0) || (dir > 0 && b >= L.length - 1)) { sfx('buzz'); return; }
    this.commit('移動', () => C.moveBlock(L, a, b, dir), 'move');
    this.sel += dir; if (this.anchor >= 0) this.anchor += dir;
    this.needEnsure = true; sfx('cursor');
  }
  toggleRange() {
    if (this.anchor >= 0) { this.anchor = -1; this.toast('範囲選択をやめた', K.dim); return; }
    if (this.sel >= this.n.lines.length) return;
    this.anchor = this.sel; this.focus = 'lines';
    this.toast('範囲選択：↑↓ で広げる　A で操作　B でやめる', K.cyan);
  }
  selectAll() { const n = this.n.lines.length; if (!n) return; this.anchor = 0; this.sel = n - 1; this.needEnsure = true; this.focus = 'lines'; this.toast(`${n}行をすべて選んだ`, K.cyan); }
  swapSpeakers() {
    const sl = this.selLines();
    const [a, b] = this.anchor >= 0 && sl ? sl : [0, this.n.lines.length - 1];
    if (!C.swapRoles(C.cloneLines(this.n.lines), this.kind, a, b)) { this.toast('入れかえる行がない', K.dim); sfx('buzz'); return; }
    let k = 0;
    this.commit('話者を入れかえ', () => { k = C.swapRoles(this.n.lines, this.kind, a, b); });
    this.toast(`${k}行の話者を入れかえた${this.anchor >= 0 ? '' : '（台本ぜんぶ）'}`, K.green); sfx('ok');
  }
  toggleFold() {
    const L = this.n.lines;
    if (this.sel >= L.length) return;
    const s = this.sections().find((x) => this.sel >= x.start && this.sel <= x.end);
    if (!s || s.end <= s.start) { this.toast('この場面は1行だけ（たたむものがない）', K.dim); return; }
    const h = L[s.start];
    if (this.folds.has(h)) { this.folds.delete(h); this.toast('ひらいた', K.dim); } else { this.folds.add(h); this.sel = s.start; this.toast(`${s.end - s.start}行をたたんだ`, K.dim); }
    this.foldRev++; this.rev++; this.needEnsure = true; sfx('cursor');
  }
  foldAll() {
    const L = this.n.lines, secs = this.sections().filter((s) => s.end > s.start);
    const anyOpen = secs.some((s) => !this.folds.has(L[s.start]));
    this.folds.clear();
    if (anyOpen) for (const s of secs) this.folds.add(L[s.start]);
    this.foldRev++; this.rev++; this.clampSel(); this.needEnsure = true;
    this.toast(anyOpen ? 'ぜんぶ折りたたんだ' : 'ぜんぶひらいた', K.dim);
  }

  // ---------------------------------------------------------------- raw keys + paste
  bindKeys() {
    this._kd = (e) => this.onKey(e);
    this._ps = (e) => this.onPaste(e);
    if (typeof window !== 'undefined') { window.addEventListener('keydown', this._kd); window.addEventListener('paste', this._ps); }
  }
  unbindKeys() { if (typeof window !== 'undefined') { window.removeEventListener('keydown', this._kd); window.removeEventListener('paste', this._ps); } }
  active() { return !this.closed && topNeta(this.g) === this && !this.modals.length && this.busy <= 0 && !isAskingText(); }
  onKey(e) {
    if (!this.active() || typing(e)) return;
    const ctrl = e.ctrlKey || e.metaKey, code = e.code;
    let cmd = null;
    if (ctrl) cmd = { KeyZ: e.shiftKey ? 'redo' : 'undo', KeyY: 'redo', KeyC: 'copy', KeyX: 'cut', KeyD: 'dup', KeyA: 'all', KeyF: 'find', KeyS: 'save' }[code] || null;
    else if (e.altKey) cmd = { ArrowUp: 'up', ArrowDown: 'down' }[code] || null;
    else cmd = { PageUp: 'pgup', PageDown: 'pgdn', Home: 'home', End: 'end', Delete: 'del', KeyU: 'undo', KeyY: 'redo', KeyV: 'range', KeyH: 'fold', KeyF: 'find', F3: 'findnext', KeyN: 'write', KeyP: 'read', KeyO: 'palette', ContextMenu: 'line' }[code] || null;
    if (!cmd) return;
    e.preventDefault();
    if (e.repeat && !/^(pg|up|down)/.test(cmd)) return;
    this.keyq.push({ cmd, t: this.t });
  }
  onPaste(e) {
    if (!this.active() || typing(e)) return;
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    e.preventDefault();
    this.pasteLines(text);
  }
  close(v = null) { this.unbindKeys(); super.close(v); }

  // menus wear the era's skin
  pick(o) { return super.pick({ skin: this.skin, ...o }); }
  confirm(o) { return super.confirm({ skin: this.skin, ...o }); }
  info(title, lines, o = {}) { return super.info(title, lines, { skin: this.skin, ...o }); }

  // ---------------------------------------------------------------- input
  update(g) {
    super.update(g);
    if (this.closed) return;
    this.tickGesture();
    this.tickScroll();
    this.liveTick();
    if (this.draftDue && this.t >= this.draftDue) { this.draftDue = 0; this.writeDraft(); }
  }
  updateBody(inp) {
    this.keyq = this.keyq.filter((k) => this.t - k.t < 15);
    const q = this.keyq.shift();
    if (q) { this.runCmd(q.cmd); return; }
    if (this.moving) {
      if (inp.repeat('up')) this.moveLines(-1);
      else if (inp.repeat('down')) this.moveLines(1);
      else if (inp.pressed('a') || inp.pressed('b')) { this.moving = false; sfx('ok'); }
      return;
    }
    if (inp.pressed('menu')) { sfx('cancel'); this.act(() => this.askClose()); return; }
    if (this.focus === 'head') return this.keysHead(inp);
    if (this.focus === 'tools') return this.keysTools(inp);
    return this.keysLines(inp);
  }
  keysHead(inp) {
    const n = HEAD.length;
    if (inp.repeat('left')) { this.headIdx = (this.headIdx + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('right')) { this.headIdx = (this.headIdx + 1) % n; sfx('cursor'); }
    else if (inp.pressed('down')) { this.focus = 'lines'; sfx('cursor'); }
    else if (inp.pressed('up')) { this.focus = 'tools'; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.headAct(HEAD[this.headIdx]); }
    else if (inp.pressed('b')) { sfx('cancel'); this.act(() => this.askClose()); }
  }
  headAct(id) {
    if (id === 'undo' || id === 'redo') { this.runCmd(id); return; }
    if (id === 'more') { this.runCmd('palette'); return; }
    this.act(() => this.editSetting(id));
  }
  keysTools(inp) {
    const n = TOOLS.length;
    if (inp.repeat('left')) { this.tool = (this.tool + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('right')) { this.tool = (this.tool + 1) % n; sfx('cursor'); }
    else if (inp.pressed('up')) { this.focus = 'lines'; sfx('cursor'); }
    else if (inp.pressed('down')) { this.focus = 'lines'; const v = this.visibleIdx(); this.setSel(v[0]); this.needEnsure = true; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.runTool(this.tool)); }
    else if (inp.pressed('b')) { sfx('cancel'); this.act(() => this.askClose()); }
  }
  keysLines(inp) {
    const L = this.n.lines;
    const vis = this.visibleIdx();
    const pos = Math.max(0, vis.indexOf(this.sel));
    const step = (k) => { const tm = (inp.repeatTimer && inp.repeatTimer[k]) || 0; return tm > 110 ? 8 : tm > 70 ? 4 : tm > 38 ? 2 : 1; };
    if (inp.repeat('up')) {
      if (this.anchor >= 0) { if (this.sel > 0) { this.sel = Math.max(0, this.sel - step('up')); this.needEnsure = true; sfx('cursor'); } }
      else if (pos <= 0) { if (inp.pressed('up')) { this.focus = 'head'; sfx('cursor'); } }
      else { this.setSel(vis[Math.max(0, pos - step('up'))]); sfx('cursor'); }
      return;
    }
    if (inp.repeat('down')) {
      if (this.anchor >= 0) { if (this.sel < L.length - 1) { this.sel = Math.min(L.length - 1, this.sel + step('down')); this.needEnsure = true; sfx('cursor'); } }
      else if (pos >= vis.length - 1) { if (inp.pressed('down')) { this.focus = 'tools'; sfx('cursor'); } }
      else { this.setSel(vis[Math.min(vis.length - 1, pos + step('down'))]); sfx('cursor'); }
      return;
    }
    const cur = L[this.sel];
    if ((inp.repeat('left') || inp.repeat('right')) && cur && this.anchor < 0) {
      const opts = ROLE_OPTS[this.kind];
      const i = Math.max(0, opts.indexOf(cur.role));
      const to = opts[(i + (inp.repeat('left') ? opts.length - 1 : 1)) % opts.length];
      if (to !== cur.role) { this.commit('話者', () => { cur.role = to; }, `role${this.sel}`); sfx('cursor'); }
      return;
    }
    // A: edit the line / the add row's menu / the range menu; held for ~0.4 s: the line menu
    if (inp.pressed('a')) this.aHold = { t: this.t, done: false };
    if (this.aHold) {
      if (!inp.down('a')) { const h = this.aHold; this.aHold = null; if (!h.done) { sfx('ok'); this.act(() => this.onA()); } }
      else if (!this.aHold.done && this.t - this.aHold.t >= 26 && cur && this.anchor < 0) { this.aHold.done = true; sfx('ok'); this.act(() => this.lineMenu(this.sel)); }
      return;
    }
    if (inp.pressed('b')) { sfx('cancel'); if (this.anchor >= 0) { this.anchor = -1; this.toast('範囲選択をやめた', K.dim); } else this.act(() => this.askClose()); }
  }
  onA() {
    if (this.anchor >= 0) return this.rangeMenu();
    const cur = this.n.lines[this.sel];
    return cur ? this.editLine(this.sel) : this.addMenu();
  }

  // ---------------------------------------------------------------- taps and pointer gestures
  toBody(p) { const tt = this.tt; return tt ? { x: (p.x - tt.tox) / tt.ts, y: (p.y - tt.toy) / tt.ts } : { x: p.x, y: p.y }; }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    const { x, y } = tap;
    if (!isTouch() && inR(x, y, CLOSE)) { sfx('cancel'); this.onCloseTap(); return true; }
    if (this.moving) { this.moving = false; return true; }
    for (let i = 0; i < this.toolRects.length; i++) if (inR(x, y, this.toolRects[i])) { this.focus = 'tools'; this.tool = i; sfx('ok'); this.act(() => this.runTool(i)); return true; }
    if (inR(x, y, this.miniRect)) { this.gesture = { hit: { k: 'mini' }, x, y, moved: false }; this.miniJump(y); return true; }
    const hit = this.hits.find((h) => inR(x, y, h.r));
    if (!hit) return true;
    if (hit.k === 'hbtn') { sfx('ok'); this.runCmd(hit.id === 'more' ? 'palette' : hit.id); return true; }
    if (hit.k === 'chip') { sfx('ok'); this.act(() => this.editSetting(hit.id)); return true; }
    if (hit.k === 'strip') { sfx('ok'); this.act(() => this.settingsMenu()); return true; }
    if (hit.k === 'checkall') { sfx('ok'); this.runCmd('check'); return true; }
    if (hit.k === 'fix') { sfx('ok'); this.act(() => this.applyFix(hit.w)); return true; }
    if (hit.k === 'move') { this.runCmd(hit.id); return true; }
    if (hit.k === 'add') { this.focus = 'lines'; if (this.sel !== hit.i) { this.setSel(hit.i); sfx('cursor'); } else { sfx('ok'); this.act(() => this.addMenu()); } return true; }
    // list rows: decided on release (a drag scrolls instead)
    this.gesture = { hit, x, y, sy: y, scroll0: this.scroll, moved: false, shift: !!(this.ptr && this.ptr.multi) };
    return true;
  }
  miniJump(y) {
    const r = this.miniRect, n = this.n.lines.length;
    if (!r || !n) return;
    const i = clamp(Math.floor(((y - r.y) / r.h) * n), 0, n - 1);
    this.focus = 'lines';
    if (this.hiddenSet().has(i)) return;
    this.sel = i; this.freeScroll = false; this.centerOn(i);
  }
  tickGesture() {
    const gs = this.gesture;
    if (!gs) return;
    const ptr = this.ptr;
    if (!ptr || this.modals.length || this.busy > 0) { this.gesture = null; return; }
    const p = this.toBody(ptr);
    if (gs.hit.k === 'mini') { if (ptr.down) this.miniJump(p.y); else this.gesture = null; return; }
    if (!gs.moved && ptr.down && Math.hypot(p.x - gs.x, p.y - gs.y) > 7) gs.moved = true;
    if (gs.moved && ptr.down) this.scrollTo(gs.scroll0 - (p.y - gs.sy));
    if (!ptr.down) { this.gesture = null; if (!gs.moved) this.tapRow(gs.hit, gs); }
  }
  tapRow(hit, gs) {
    const i = hit.i;
    const L = this.n.lines;
    if (i == null || i >= L.length) return;
    this.focus = 'lines';
    if (hit.k === 'num') { if (this.anchor < 0) { this.anchor = i; this.sel = i; this.toast('範囲選択：別の行の番号をタップで広げる', K.cyan); } else { this.sel = i; } this.needEnsure = true; sfx('cursor'); return; }
    if (hit.k === 'fold') { this.sel = i; this.toggleFold(); return; }
    if (gs.shift && this.anchor < 0 && this.sel < L.length) { this.anchor = this.sel; this.sel = i; sfx('cursor'); return; }
    if (this.anchor >= 0) { this.sel = i; this.needEnsure = true; sfx('cursor'); return; }
    if (i !== this.sel) { this.setSel(i); sfx('cursor'); return; }
    sfx('ok');
    if (hit.k === 'more') this.act(() => this.lineMenu(i));
    else if (hit.k === 'role') this.act(() => this.roleMenu(i));
    else if (hit.k === 'beat') this.act(() => this.beatMenu(i));
    else this.act(() => this.editLine(i));
  }
  contextAt(p) {
    if (this.modals.length || this.busy) return true;
    const b = this.toBody(p);
    const hit = this.hits.find((h) => h.i != null && h.i < this.n.lines.length && inR(b.x, b.y, h.r));
    if (!hit) return false;
    this.focus = 'lines'; this.sel = hit.i; this.needEnsure = true;
    this.act(() => this.lineMenu(hit.i));
    return true;
  }
  // touch: the bar of big cells
  get touchY0() { return 21; }
  onCloseTap() { this.act(() => this.askClose()); }
  touchBarTap(tap) {
    const c = this.touchCells.find((x) => inR(tap.x, tap.y, x.r));
    if (!c) { sfx('ok'); this.act(() => this.settingsMenu()); return; }
    sfx('ok');
    if (c.id === 'add') { this.act(() => this.addMenu()); return; }
    if (c.id === 'edit') { this.runCmd(this.n.lines[this.sel] ? 'edit' : 'parts'); return; }
    if (c.id === 'more') { this.runCmd('palette'); return; }
    if (c.id === 'save') { if (this.save()) sfx('ok'); return; }
    this.runCmd(c.id);
  }
  drawTouchBar(c) { V.drawTouchBar(this, c); }
  drawScreen(c) { V.drawEditor(this, c); }
  drawOver(c) { for (const m of this.modals) { R(c, 0, 0, 640, 360, 'rgba(0,0,0,0.5)'); m.draw(this, c); } }

  // ---------------------------------------------------------------- live scoring (the curve, 独自性) — local AI, only when idle
  liveTick() {
    if (!this.liveStale() || this.t - this.lastEdit < 24 || this.t < this.liveNext || this.modals.length) return;
    this.liveNext = this.t + 45;
    const g = this.g;
    const others = has(g, 'netaList') ? safe(() => g.netaList().filter((o) => o.id !== this.n.id), []) : [];
    const ai = safe(() => scoreLocal(this.n, { era: this.era(), year: this.year(), target: this.n.target, others, names: this.names() }), null);
    this.live = ai ? { rev: this.rev, ai } : null;
  }

  // ---------------------------------------------------------------- persistence: versions (版), the draft, save
  vkey() { return this.n.id || `new:${this.kind}`; }
  store() { return has(this.g, 'netaSettings') ? C.edStore(this.g.netaSettings()) : C.edStore({}); }
  snap(label) { if (!this.n.lines.length) return; this.lastSnap = this.t; safe(() => C.addVersion(this.store(), this.vkey(), this.n, label, Date.now())); }
  writeDraft() { if (!this.dirty || this.closed) return; safe(() => C.setDraft(this.store(), this.vkey(), this.n, this.sel, Date.now())); }
  clearDraftNow() { safe(() => C.clearDraft(this.store(), this.vkey())); }
  async start() {
    return this.act(async () => {
      await this.offerDraft();
      this.snap('開いたとき');
      if (!this.n.lines.length && !this.n.theme) await this.themeMenu();
    });
  }
  async offerDraft() {
    const ed = this.store();
    const d = C.getDraft(ed, this.vkey());
    if (!d) return;
    const doc = C.unpackDoc(d.p);
    if (!doc || !doc.lines.length || JSON.stringify(C.packDoc(this.n)) === JSON.stringify(d.p)) { C.clearDraft(ed, this.vkey()); return; }
    const k = await this.confirm({ title: '書きかけの台本', lines: [`保存していない台本が残っている（『${doc.title || KIND_LABEL[doc.kind]}』${doc.lines.length}行）。つづきから書く？`], choices: ['つづきから書く', '捨てる', 'そのまま開く'], cancel: 2 });
    if (k === 0) { this.snap('復元の前'); this.applyDoc(doc); this.sel = clamp(d.sel | 0, 0, this.n.lines.length); this.dirty = true; this.rev++; this.needEnsure = true; this.toast('書きかけを復元した', K.green); }
    else if (k === 1) C.clearDraft(ed, this.vkey());
  }
  applyDoc(doc) {
    const n = this.n;
    Object.assign(n, { kind: doc.kind, title: doc.title, theme: doc.theme, themeId: doc.themeId, setting: doc.setting, dialect: doc.dialect, lines: C.cloneLines(doc.lines) });
    if (doc.target) n.target = doc.target;
    if (doc.chars) n.chars = { ...doc.chars }; else delete n.chars;
    this.kind = KINDS[n.kind] ? n.kind : 'manzai';
    this.folds.clear(); this.foldRev++;
  }
  save() {
    const wasNew = !this.n.id;
    const oldKey = this.vkey();
    const rec = this.g.saveNeta({ ...this.n, title: this.n.title || `${KIND_LABEL[this.kind]}のネタ` });
    if (!rec) { this.info('保存できない', ['ネタ帳がいっぱい（60本まで）。古いネタを消そう。']); return false; }
    this.n.id = rec.id;
    this.saved = rec;
    this.dirty = false;
    this.draftDue = 0;
    if (wasNew) safe(() => C.moveVersions(this.store(), oldKey, rec.id));
    this.snap('保存');
    C.clearDraft(this.store(), oldKey); C.clearDraft(this.store(), rec.id);
    this.toast('ネタ帳に保存した', K.green);
    return true;
  }
  async askClose() {
    if (!this.dirty) { this.close(this.saved); return; }
    const k = await this.confirm({ title: '台本エディタを閉じる', lines: ['書きかけの台本がある。'], choices: ['保存して閉じる', '保存しないで閉じる', 'つづける'], cancel: 2 });
    if (k === 0) { if (this.save()) this.close(this.saved); }
    else if (k === 1) { this.snap('閉じる前'); this.clearDraftNow(); this.close(this.saved); }
  }
  async score() {
    if (!this.n.lines.some((l) => String(l.text || '').trim())) { await this.info('AI採点', ['台本がまだ空っぽ。まず何行か書こう。']); return; }
    if (!this.save()) return;
    let by = 'local';
    const ks = keyState();
    if (ks.has) {
      const k = await this.confirm({ title: 'AI審査員', lines: ['どちらで採点する？', 'Claudeで採点すると、台本の文章がAnthropicのAPIに送られ、あなたのAPIキーに課金されます。'], choices: ['ローカルAI', 'Claude（APIキー使用）', 'やめる'], index: getMode() === 'claude' ? 1 : 0 });
      if (k === 2 || k == null) return;
      by = k === 1 ? 'claude' : 'local';
    }
    await this.g.scoreNeta(this.saved, { by, show: true, ui: true });
    this.rev++;
  }
  async runTool(i) {
    if (i === 0) return this.addParts();
    if (i === 1) return this.writeLine(this.insPos(), null);
    if (i === 2) return this.bulkWrite();
    if (i === 3) return this.settingsMenu();
    if (i === 4) return this.score();
    if (i === 5) { const ok = this.save(); if (ok) this.close(this.saved); return null; }
    return null;
  }

  // ---------------------------------------------------------------- menus
  async editLine(i) {
    const L = this.n.lines, l = L[i];
    if (!l) return;
    const v = await askText(this.g, { title: `${i + 1}行目（${this.roleLabel(l.role)}）を書きかえる`, value: l.text, max: 240, multiline: true, rows: 3, placeholder: this.kind === 'ogiri' ? '回答を書く（短いほど強い）' : 'セリフを書く', note: '改行は空白になる。240文字まで。' });
    if (v == null) return;
    const t = v.replace(/\s*\n\s*/g, ' ').trim();
    if (!t || t === l.text) return;
    this.commit('書きかえ', () => { l.text = t; delete l.src; });
    this.flashes.set(l, this.t);
  }
  async writeLine(at, line) {
    const role = line ? line.role : this.defaultRole(at);
    if (line) return this.editLine(at);
    const v = await askText(this.g, { title: `${at + 1}行目（${this.roleLabel(role)}）`, value: '', max: 240, multiline: true, rows: 3, placeholder: this.kind === 'ogiri' ? '回答を書く（短いほど強い）' : 'セリフを書く', note: '改行は空白になる。240文字まで。' });
    if (v == null) return;
    const t = v.replace(/\s*\n\s*/g, ' ').trim();
    if (!t) return;
    this.insert(at, [{ role, text: t, beat: this.kind === 'ogiri' ? 'answer' : '' }], '行を書く');
  }
  async lineMenu(i) {
    const L = this.n.lines, l = L[i];
    if (!l) return;
    const isB = l.role === 'boke' || l.role === 'a' || l.role === 'pin';
    const k = await this.pick({ title: `${i + 1}行目`, lines: [short(l.text, 60)], items: [
      { label: 'セリフを書きかえる' }, { label: `話者：${this.roleLabel(l.role)}`, sub: '←→ キーでもすぐ変えられる' }, { label: `ビート：${l.beat ? BEAT_LONG[l.twist ? 'uragiri' : l.beat] : '（自動）'}` },
      { label: '移動する（↑↓）' }, { label: 'この下に部品を足す' }, { label: 'この下に自分で書く' }, { label: '複製する' }, { label: '削除する' },
      { label: isB && this.kind === 'manzai' ? 'この行のツッコミ候補' : 'この下にボケ候補' }, { label: 'この行から範囲を選ぶ' }, { label: 'コピー' }, { label: '切り取り' }, { label: '場面を折りたたむ／ひらく' }, { label: 'もどる' },
    ] });
    this.sel = i;
    if (k === 0) return this.editLine(i);
    if (k === 1) return this.roleMenu(i);
    if (k === 2) return this.beatMenu(i);
    if (k === 3) { this.moving = true; this.toast('↑↓ で動かす　A/B で決定', K.cyan); return null; }
    if (k === 4) return this.addParts();
    if (k === 5) return this.writeLine(i + 1, null);
    if (k === 6) { this.anchor = -1; return this.dupLines(); }
    if (k === 7) { this.anchor = -1; return this.delLines(); }
    if (k === 8) return this.candidates(isB && this.kind === 'manzai' ? 'tsukkomi' : 'boke');
    if (k === 9) { this.anchor = i; this.toast('範囲選択：↑↓ で広げる　A で操作', K.cyan); return null; }
    if (k === 10) { this.anchor = -1; return this.copyLines(false); }
    if (k === 11) { this.anchor = -1; return this.copyLines(true); }
    if (k === 12) return this.toggleFold();
    return null;
  }
  async roleMenu(i) {
    const l = this.n.lines[i];
    if (!l) return;
    const opts = ROLE_OPTS[this.kind];
    const j = await this.pick({ title: '話者', items: opts.map((r) => ({ label: this.roleLabel(r) })), index: Math.max(0, opts.indexOf(l.role)) });
    if (j >= 0 && opts[j] !== l.role) this.commit('話者', () => { l.role = opts[j]; });
  }
  async beatMenu(i) {
    const l = this.n.lines[i];
    if (!l) return;
    const opts = BEAT_OPTS[this.kind];
    const cur = l.twist ? 'uragiri' : l.beat;
    const j = await this.pick({ title: 'ビート（台本の中での役目）', items: [{ label: '（自動）', sub: '前後から自動で決める' }, ...opts.map((b) => ({ label: BEAT_LONG[b] }))], index: Math.max(0, opts.indexOf(cur) + 1), rh: 22 });
    if (j < 0) return;
    this.commit('ビート', () => { if (j === 0) { l.beat = ''; delete l.twist; } else { const b = opts[j - 1]; if (b === 'uragiri') { l.beat = 'tenkai'; l.twist = true; } else { l.beat = b; delete l.twist; } } });
  }
  async rangeMenu() {
    const sl = this.selLines();
    if (!sl) { this.anchor = -1; return; }
    const [a, b] = sl, L = this.n.lines, cnt = b - a + 1;
    const k = await this.pick({ title: `${cnt}行を選択中（${a + 1}〜${b + 1}行目）`, items: [
      { label: 'コピー', right: 'Ctrl+C' }, { label: '切り取り', right: 'Ctrl+X' }, { label: '複製' }, { label: '削除', right: 'Del' }, { label: '話者を変える' }, { label: 'ビートを変える' },
      { label: C.canSwap(this.kind) ? '話者を入れかえる（ボケ↔ツッコミ・A↔B）' : '話者の入れかえ（漫才・コント・落語のみ）', lock: !C.canSwap(this.kind) }, { label: 'ここだけ台本の外にコピーして、あとで貼る', sub: 'コピーと同じ。別の台本にも貼れる' }, { label: '選択をやめる' },
    ], rh: 24 });
    if (k < 0) return;
    if (k === 0 || k === 7) return this.copyLines(false);
    if (k === 1) return this.copyLines(true);
    if (k === 2) { const ok = this.anchor; void ok; return this.dupLines(); }
    if (k === 3) return this.delLines();
    if (k === 4) {
      const opts = ROLE_OPTS[this.kind];
      const j = await this.pick({ title: `${cnt}行の話者`, items: opts.map((r) => ({ label: this.roleLabel(r) })) });
      if (j >= 0) { this.commit('話者', () => C.setRoleRange(L, a, b, opts[j])); this.toast(`${cnt}行の話者を変えた`, K.green); }
    } else if (k === 5) {
      const opts = BEAT_OPTS[this.kind];
      const j = await this.pick({ title: `${cnt}行のビート`, items: [{ label: '（自動）' }, ...opts.map((x) => ({ label: BEAT_LONG[x] }))], rh: 22 });
      if (j >= 0) { this.commit('ビート', () => { if (j === 0) C.setBeatRange(L, a, b, ''); else { const x = opts[j - 1]; if (x === 'uragiri') C.setBeatRange(L, a, b, 'tenkai', true); else C.setBeatRange(L, a, b, x); } }); this.toast(`${cnt}行のビートを変えた`, K.green); }
    } else if (k === 6) return this.swapSpeakers();
    else if (k === 8) { this.anchor = -1; }
    return null;
  }
  async addMenu() {
    const k = await this.pick({ title: '行を足す', items: [{ label: '部品から足す', sub: '候補のセリフから選ぶ（ネタの型を学べる）' }, { label: '自分で書く', sub: '一行ずつ入力する' }, { label: 'まとめて書く', sub: '台本をまるごと貼りつける・入力する' }, { label: 'テンプレを入れる', sub: '「ちょっと待って」型・天丼・〜と思ったら型 …' }, { label: 'もどる' }] });
    if (k === 0) return this.addParts();
    if (k === 1) return this.writeLine(this.insPos(), null);
    if (k === 2) return this.bulkWrite();
    if (k === 3) return this.snippetMenu();
    return null;
  }
  async bulkWrite() {
    const L = this.n.lines;
    let mode = 1;
    if (L.length) { const k = await this.confirm({ title: 'まとめて書く', lines: ['いまの台本はどうする？'], choices: ['後ろに足す', '入れかえる', 'やめる'] }); if (k === 2 || k == null) return; mode = k === 0 ? 1 : 2; }
    const v = await askText(this.g, { title: 'まとめて書く（一行に一セリフ）', value: '', max: 6000, multiline: true, rows: 10, placeholder: 'ボケ：どうもー！\nツッコミ：よろしくお願いしますー！\n[オチ] ボケ：…', note: '「ボケ：」「ツッコミ：」「A：」「B：」「ナレ：」「地：」で話者、[ツカミ]【オチ】でビートを指定できる。話者がない行は交互・本人になる。' });
    if (v == null) return;
    const lines = has(this.g, 'parseNetaScript') ? this.g.parseNetaScript(v, this.kind, this.n.chars || {}) : C.fromText(v, this.kind, this.n.chars || {});
    if (!lines.length) { this.toast('セリフが見つからなかった', K.red); return; }
    if (mode === 2) { this.snap('入れかえの前'); this.commit('台本を入れかえ', () => { this.n.lines = []; }); this.sel = 0; }
    const k = this.insert(this.n.lines.length, lines, 'まとめて書く');
    this.toast(`${k}行を足した`, K.green);
  }
  partsOpts() { const n = this.n; return { themeId: n.themeId, era: this.era(), year: this.year(), dialect: n.dialect, names: this.names(), seed: n.lines.length + 1 }; }
  async addParts(tabId) {
    const n = this.n;
    if (!n.theme && !n.themeId && this.kind !== 'manzai') await this.themeMenu();
    const tabs = safe(() => partsFor(this.kind, this.partsOpts()), []) || [];
    tabs.unshift({ id: 'auto', label: 'おまかせ', items: [
      { text: 'おまかせで一本まるごと組む（いまの台本と入れかえ）', auto: 'all' },
      { text: 'いまの台本の後ろに、おまかせで続きを足す', auto: 'more' },
    ] });
    let tab = n.lines.length ? 2 : 1;
    if (tabId) { const t = tabs.findIndex((x) => x.id === tabId); if (t >= 0) tab = t; }
    const m = partsModal({ skin: this.skin, title: `部品から足す（${KIND_LABEL[this.kind]}${n.theme ? `・${short(n.theme, 12)}` : ''}）`, note: this.kind === 'manzai' ? 'ボケを選ぶと、そのツッコミも続けて入る' : '', tabs, tab: Math.min(tab, tabs.length - 1),
      onPick: (tb, it) => {
        if (!it) return;
        if (it.auto) { this.act(() => this.autoFill(it.auto)); this.closeModal(m, null); return; }
        const lines = [{ role: it.role, text: it.text, beat: it.beat, twist: it.twist, src: 'bank' }];
        if (it.pair) lines.push({ ...it.pair, src: 'bank' });
        const k = this.insert(this.insPos(), lines, '部品を足す');
        if (k) this.toast(`＋「${short(it.text, 18)}」`, K.green);
      } });
    await this.openModal(m);
  }
  async autoFill(how) {
    const n = this.n;
    const a = buildAuto(this.kind, { quality: 62, era: this.era(), year: this.year(), dialect: n.dialect, names: this.names(), seed: `${this.g.state.day}:${n.lines.length}:${how}`, themeId: n.themeId, length: n.target });
    if (how === 'all') {
      if (n.lines.length) { const k = await this.confirm({ title: 'おまかせで組む', lines: ['いまの台本は消えて、おまかせの台本になる。（版から戻せる）'], choices: ['組む', 'やめる'] }); if (k !== 0) return; this.snap('おまかせの前'); }
      this.commit('おまかせで組む', () => {
        n.lines = a.lines.map((l) => ({ ...l }));
        if (!n.title) n.title = a.title;
        if (!n.theme) { n.theme = a.theme; n.themeId = a.themeId; }
        if (a.setting && !n.setting) n.setting = a.setting;
        if (a.chars && !n.chars) n.chars = { ...a.chars };
      });
      this.sel = 0; this.scroll = this.scrollT = 0; this.needEnsure = true;
      this.toast('おまかせで組んだ（部品のままだと独自性は低い）', K.cyan);
    } else {
      const extra = a.lines.filter((l) => l.beat === 'boke' || l.beat === 'tsukkomi').slice(0, 6);
      const k = this.insert(n.lines.length, extra, 'おまかせの続き');
      this.toast(`${k}行を足した`, K.green);
    }
  }
  async snippetMenu() {
    const L = this.n.lines;
    const list = C.snippetsFor(this.kind, this.year());
    if (!list.length) { this.toast('この種類のテンプレはない', K.dim); return; }
    const ctx0 = { era: this.era(), dialect: this.n.dialect, names: this.names() };
    const items = list.map((s) => ({ label: this.fillName(s.name), sub: this.fillName(s.desc), right: `${s.lines.length}行` }));
    const k = await this.pick({ title: 'テンプレを入れる（〇〇は自分の言葉で埋める）', items, rh: 32, w: 480 });
    if (k < 0) return;
    const sn = list[k];
    const recall = C.recallPhrase(L, this.sel);
    const lines = C.buildSnippet(sn, { ...ctx0, recall }, this.kind);
    const at = this.insPos();
    const n0 = this.insert(at, lines, `テンプレ：${sn.name}`);
    if (!n0) return;
    const first = L.findIndex((l, i) => i >= at && C.PLACEHOLDER.test(l.text));
    if (first >= 0) this.setSel(first);
    this.toast(`テンプレを入れた：${short(this.fillName(sn.name), 16)}（〇〇を埋めよう）`, K.green);
  }
  fillName(s) { return String(s).replace(/\{phone\}/g, (this.eraWord('phone'))); }
  eraWord(k) { const W = { phone: { showa: '黒電話', heisei_early: 'ポケベル', heisei: 'ケータイ', reiwa: 'スマホ' } }; return (W[k] && W[k][this.era()]) || 'スマホ'; }
  // ボケ候補 / ツッコミ候補 for the selected line, ranked by how much they share with it (neta_bank parts by era and dialect)
  async candidates(which) {
    const L = this.n.lines, cur = L[this.sel];
    const tabs0 = safe(() => partsFor(this.kind, this.partsOpts()), []) || [];
    const want = which === 'tsukkomi' ? (t) => /tsukkomi/.test(t.id) : (t) => /^(boke|zure|answer|kashi|shoten)$/.test(t.id);
    const tabs = tabs0.filter(want);
    if (!tabs.length) { this.toast('この種類には候補がない（「部品から足す」を見よう）', K.dim); return; }
    const have = new Set(L.map((l) => l.text));
    const seen = new Set();
    const all = tabs.flatMap((t) => t.items).filter((it) => { if (seen.has(it.text) || have.has(it.text)) return false; seen.add(it.text); return true; });
    const ctxText = `${cur ? cur.text : ''} ${this.n.theme || ''}`;
    const ranked = C.rankByLink(all, ctxText).slice(0, 40);
    const title = which === 'tsukkomi' ? `ツッコミ候補（${this.sel + 1}行目に）` : `ボケ候補（${this.sel + 1}行目のあとに）`;
    const nextTsk = which === 'tsukkomi' && L[this.sel + 1] && (L[this.sel + 1].role === 'tsukkomi' || L[this.sel + 1].role === 'b');
    const m = partsModal({ skin: this.skin, title, note: which === 'tsukkomi' ? (nextTsk ? 'A：次のツッコミを置きかえる' : 'A：この行の下に足す') : 'ボケを選ぶと、そのツッコミも入る', tabs: [{ id: 'rank', label: 'おすすめ（この行に近い順）', items: ranked }, ...tabs], tab: 0,
      help: '←→ 分類　↑↓ えらぶ　A 足す（続けて足せる）　B 閉じる',
      onPick: (tb, it) => {
        if (!it) return;
        const L2 = this.n.lines;
        if (which === 'tsukkomi' && nextTsk && L2[this.sel + 1]) { const tl = L2[this.sel + 1]; this.commit('ツッコミを置きかえ', () => { tl.text = it.text; tl.src = 'bank'; if (it.beat) tl.beat = it.beat; }); this.flashes.set(tl, this.t); this.toast(`置きかえた「${short(it.text, 16)}」`, K.green); return; }
        const lines = [{ role: it.role, text: it.text, beat: it.beat, twist: it.twist, src: 'bank' }];
        if (it.pair) lines.push({ ...it.pair, src: 'bank' });
        const at = this.sel >= L2.length ? L2.length : this.sel + 1;
        const k = this.insert(at, lines, which === 'tsukkomi' ? 'ツッコミ候補' : 'ボケ候補');
        if (k) this.toast(`＋「${short(it.text, 18)}」`, K.green);
      } });
    await this.openModal(m);
  }
  async findFlow() {
    const L = this.n.lines;
    const q = await askText(this.g, { title: 'さがす言葉（ひらがな・カタカナはどちらでも見つかる）', value: (this.find && this.find.q) || '', max: 40 });
    if (q == null) return;
    this.find = { q, cur: -1 };
    const hits = C.findAll(L, q);
    if (!hits.length) { this.toast(`「${short(q, 10)}」はみつからない`, K.dim); this.find = null; return; }
    for (;;) {
      const total = hits.reduce((s, h) => s + h.n, 0);
      const items = [{ label: `すべて置きかえ…（${total}か所）` }, ...hits.map((h) => ({ label: `${h.i + 1}行目　${short(L[h.i].text, 34)}`, right: h.n > 1 ? `${h.n}か所` : '' })), { label: 'もどる' }];
      const k = await this.pick({ title: `「${short(q, 12)}」${hits.length}行`, items, rh: 24 });
      if (k <= 0 && k !== 0) return;
      if (k === 0) {
        const r = await askText(this.g, { title: `「${short(q, 10)}」を何に置きかえる？（空にすると消える）`, value: '', max: 60 });
        if (r == null) return;
        const rep = r;
        this.snap('置きかえの前');
        let res = null;
        this.commit('置きかえ', () => { res = C.replaceIn(L, q, rep); });
        for (const i of res.changed) this.flashes.set(L[i], this.t);
        this.toast(`${res.count}か所を置きかえた（⟲で戻せる）`, K.green);
        this.find = rep ? { q: rep, cur: -1 } : null;
        return;
      }
      if (k - 1 < hits.length) { this.focus = 'lines'; this.setSel(hits[k - 1].i); this.find.cur = k - 1; return; }
      return;
    }
  }
  findNext(dir) {
    if (!this.find || !this.find.q) return;
    const hits = C.findAll(this.n.lines, this.find.q);
    if (!hits.length) { this.toast('みつからない', K.dim); return; }
    let j = hits.findIndex((h) => (dir > 0 ? h.i > this.sel : h.i >= this.sel));
    if (dir > 0) { if (j < 0) j = 0; } else { j = hits.map((h) => h.i).filter((i) => i < this.sel).length - 1; if (j < 0) j = hits.length - 1; }
    this.focus = 'lines'; this.setSel(hits[j].i);
    this.toast(`「${short(this.find.q, 10)}」${j + 1}／${hits.length}`, K.cyan);
  }
  async checkMenu() {
    const st = this.stats();
    const W = st.lint;
    if (!W.length) { this.toast('いまのところ気になる点はない', K.green); }
    const items = [
      ...W.map((w) => ({ label: w.text, sub: w.fix ? `▶ ${w.fix.label}` : '', right: w.level === 'bad' ? '要注意' : w.level === 'warn' ? '注意' : 'ヒント', rightColor: w.level === 'bad' ? K.red : w.level === 'warn' ? K.warn : K.cyan, w })),
      { label: '構成の確認', head: true },
      ...st.check.map((x) => ({ label: `${x.ok ? '✔' : '・'} ${x.label}`, lock: true })),
    ];
    if (!W.length && !st.check.length) return;
    const k = await this.pick({ title: `構成チェック（気になる点 ${W.length}）`, items, rh: 32, w: 480 });
    if (k < 0 || !items[k].w) return;
    await this.applyFix(items[k].w);
  }
  async applyFix(w) {
    const f = w.fix, L = this.n.lines;
    if (!f) { if (w.line != null && w.line >= 0) { this.setSel(w.line); this.focus = 'lines'; } return; }
    if (w.line != null && w.line >= 0 && f.id !== 'delete-empty') { this.focus = 'lines'; this.setSel(Math.min(w.line, L.length)); }
    if (f.id === 'delete-empty') { const idx = L.map((l, i) => (String(l.text).trim() ? -1 : i)).filter((i) => i >= 0); this.commit('空の行を消す', () => { for (const i of idx.reverse()) L.splice(i, 1); }); this.toast('空の行を消した', K.green); }
    else if (f.id === 'delete-line') { this.setSel(f.arg); this.anchor = -1; this.delLines(); }
    else if (f.id === 'parts') await this.addParts(f.arg || undefined);
    else if (f.id === 'boke-after') { this.setSel(clamp(f.arg, 0, L.length - 1)); await this.candidates('boke'); }
    else if (f.id === 'tsukkomi-after') { this.setSel(clamp(f.arg, 0, L.length - 1)); await this.candidates('tsukkomi'); }
    else if (f.id === 'edit' || f.id === 'blank') { this.setSel(clamp(f.arg, 0, L.length - 1)); if (f.id === 'blank') this.toast('〇〇のところを自分の言葉に', K.cyan); await this.editLine(clamp(f.arg, 0, L.length - 1)); }
    else if (f.id === 'practice') await this.editSetting('practice');
    else if (f.id === 'weak') {
      const ai = this.liveAi();
      let i = L.length - 1;
      if (ai && ai.lines && ai.lines.length) { const w2 = ai.lines.slice().sort((a, b) => a.s - b.s)[0]; if (w2) i = w2.i; }
      this.focus = 'lines'; this.setSel(i);
      this.toast('この行を削る・短くすると尺が縮む', K.cyan);
    }
  }
  async versionsMenu() {
    const vs = C.versionsOf(this.store(), this.vkey());
    if (!vs.length) { this.toast('まだ版がない（書くと自動で残る）', K.dim); return; }
    const now = Date.now();
    const ago = (t) => { const m = Math.max(0, Math.round((now - t) / 60000)); return m < 1 ? 'たった今' : m < 60 ? `${m}分前` : m < 1440 ? `${Math.round(m / 60)}時間前` : `${Math.round(m / 1440)}日前`; };
    const docs = vs.map((v) => C.unpackDoc(v.p));
    const items = vs.map((v, i) => { const d = docs[i]; const sec = estimate({ kind: d.kind, lines: d.lines, target: d.target }).sec; return { label: `${ago(v.at)}　${v.label || '版'}`, sub: `${d.lines.length}行・${mmss(sec)}　${short(d.lines[0] ? d.lines[0].text : '', 26)}`, right: i === 0 ? '最新' : '' }; });
    const k = await this.pick({ title: `版をもどす（${vs.length}版・自動で残る）`, items, rh: 32, w: 480 });
    if (k < 0) return;
    const c = await this.confirm({ title: 'この版にもどす？', lines: [`${items[k].label}（${items[k].sub}）`, 'いまの台本も版に残り、⟲でも戻せる。'], choices: ['もどす', 'やめる'] });
    if (c !== 0) return;
    this.snap('もどす前');
    this.hist.push(this.n, this.sel, '版をもどす', '', this.t);
    this.applyDoc(docs[k]);
    this.afterRestore({ sel: 0 });
    this.toast('その版にもどした', K.green);
  }
  async copyText() {
    const text = C.toText(this.n, { header: true });
    let ok = false;
    try { if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (ok) { this.toast(`台本をテキストでコピーした（${Array.from(text).length}字）`, K.green); sfx('ok'); return; }
    await askText(this.g, { title: '台本のテキスト（全部選んでコピーできる）', value: text, max: 8000, multiline: true, rows: 12 });
  }
  async readThrough(from = 0) {
    const m = readModal(this, from);
    if (!m) { this.toast('読み上げる行がない', K.dim); return; }
    await this.openModal(m);
  }

  // ---------------------------------------------------------------- settings
  async themeMenu() {
    const n = this.n;
    const topics = safe(() => topicsFor(this.kind, this.era()), []) || [];
    const label = this.kind === 'ogiri' ? 'お題' : this.kind === 'conte' ? '設定（コントの場面）' : this.kind === 'rakugo' ? '噺' : this.kind === 'monomane' ? 'ものまねの題材' : 'テーマ';
    const items = [{ label: '自分で書く', sub: `${label}を入力する` }, ...topics.map((t) => ({ label: t.name, sub: t.setting ? short(t.setting, 40) : '' })), { label: 'あとで決める' }];
    const k = await this.pick({ title: `${label}をえらぶ`, items, rh: 26, index: Math.max(0, topics.findIndex((t) => t.id === n.themeId) + 1) });
    if (k === 0) {
      const v = await askText(this.g, { title: label, value: n.theme || '', max: 40 });
      if (v) this.commit('テーマ', () => { n.theme = v.trim(); n.themeId = ''; if (!n.title) n.title = short(n.theme, 24); });
    } else if (k > 0 && k <= topics.length) {
      const t = topics[k - 1];
      this.commit('テーマ', () => {
        n.theme = t.name; n.themeId = t.id;
        if (!n.title) n.title = short(t.name, 24);
        if (t.setting && !n.setting) n.setting = t.setting;
        if (t.chars && (!n.chars || !Object.keys(n.chars).length)) n.chars = { ...t.chars };
      });
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
    if (id !== 'back') await this.editSetting(id);
  }
  async editSetting(id) {
    const n = this.n;
    if (id === 'title') { const v = await askText(this.g, { title: 'タイトル（24文字まで）', value: n.title || '', max: 24 }); if (v != null) this.commit('タイトル', () => { n.title = v.trim(); }); }
    else if (id === 'theme') await this.themeMenu();
    else if (id === 'setting') { const v = await askText(this.g, { title: '設定（どこで・だれが・何をしている）', value: n.setting || '', max: 120, multiline: true, rows: 3 }); if (v != null) this.commit('設定', () => { n.setting = v.replace(/\s*\n\s*/g, ' ').trim(); }); }
    else if (id === 'chars') {
      for (const r of ['a', 'b']) { const v = await askText(this.g, { title: `登場人物${r.toUpperCase()}の名前（10文字まで）`, value: (n.chars && n.chars[r]) || '', max: 10 }); if (v != null) this.commit('登場人物', () => { n.chars = n.chars || {}; if (v.trim()) n.chars[r] = v.trim(); else delete n.chars[r]; }); }
    } else if (id === 'target') {
      const PR = this.presets();
      const items2 = [...PR.map((p) => ({ label: p.label, right: mmss(p.sec) })), { label: '自分で決める（秒）' }];
      const j = await this.pick({ title: '目安の尺', lines: ['賞レースのネタは、大会ごとの持ち時間に合わせよう（尺オーバーは減点）。'], items: items2, rh: 22, index: Math.max(0, PR.findIndex((p) => p.sec === n.target)) });
      if (j >= 0 && j < PR.length) this.commit('目安の尺', () => { n.target = PR[j].sec; });
      else if (j === PR.length) { const v = await askText(this.g, { title: '目安の尺（秒）', value: String(n.target || ''), max: 4 }); const s = Math.round(Number(String(v || '').replace(/[^0-9]/g, ''))); if (s >= 10 && s <= 3600) this.commit('目安の尺', () => { n.target = s; }); }
      const st = has(this.g, 'netaSettings') ? this.g.netaSettings() : null;
      if (st) st.target = n.target;
    } else if (id === 'kind') {
      const kinds = Object.keys(KIND_LABEL);
      const j = await this.pick({ title: '種類', lines: n.lines.length ? ['話者は新しい種類に合わせて置きかわる。'] : [], items: kinds.map((x) => ({ label: KIND_LABEL[x] })), index: kinds.indexOf(this.kind), rh: 22 });
      if (j >= 0 && kinds[j] !== this.kind) {
        const to = kinds[j];
        this.commit('種類', () => {
          n.lines = C.adaptLines(n.lines, to);
          n.kind = to; this.kind = to;
          if (!n.target) n.target = DEFAULT_LEN[to];
        });
      }
    } else if (id === 'dialect') this.commit('言葉づかい', () => { n.dialect = n.dialect === 'kansai' ? 'std' : 'kansai'; });
    else if (id === 'beats') {
      const j = n.lines.some((l) => l.beat) ? await this.confirm({ title: 'ビートを自動でつける', choices: ['空いている行だけ', 'ぜんぶつけ直す', 'やめる'] }) : 0;
      if (j === 0 || j === 1) { const b = this.stats().beats; this.commit('ビート', () => { if (j === 1) for (const l of n.lines) { l.beat = ''; delete l.twist; } const inferred = j === 1 ? C.lineTimes({ kind: this.kind, lines: n.lines, target: n.target }).beats : b; n.lines.forEach((l, i) => { if (!l.beat && inferred[i]) l.beat = inferred[i]; }); }); this.toast('ビートをつけた', K.green); }
    } else if (id === 'practice' && this.saved) {
      if (this.dirty) this.save();
      const r = await this.g.netaRehearse(this.saved.id);
      if (r && r.ok) { sfx('good'); this.toast(`ネタ合わせ！仕上がり ${r.before} → ${r.after}`, K.green); } else this.toast((r && r.why) || 'できなかった', K.red);
    } else if (id === 'ai') { if (has(this.g, 'openNetaSettings')) await this.g.openNetaSettings(); }
  }
}

void hexA; void TB;
