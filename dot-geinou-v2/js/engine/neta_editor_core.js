// 台本エディタの中身（画面なし・DOMなし・node から import できる）。 owner: R10-A. API: test-output/api_neta_editor.txt
//   History            undo / redo (60 steps; same-key edits within 1.5 s merge)
//   block operations   insertAt removeRange moveBlock setRoleRange setBeatRange swapRoles adaptLines (paste across kinds)
//   clipboard          CLIP (kept in memory, shared between scripts) copyToClip / clipLines
//   search / replace   findAll replaceIn
//   sections / fold    sections(lines, beats, kind)
//   text               toText (round-trips with parseScript) fromText
//   timing             lineTimes (per-line seconds, the same formula as estimate()) lintScript (inline warnings with fixes)
//   snippets           SNIPPETS snippetsFor buildSnippet  (テンプレ挿入; era words, dialect, names)
//   candidates         rankByLink (ツッコミ候補 / ボケ候補 ordering)
//   versions / draft   edStore packDoc unpackDoc addVersion versionsOf moveVersions setDraft getDraft clearDraft
// The saved neta schema is untouched: everything the editor remembers (versions, draft) lives in g.netaSettings().ed.

import { inferBeats, estimate, structureCheck, KINDS, parseScript } from './neta_ai.js';
import { ANACHRO } from './neta_lex.js';
import { fillEra, fillNames, fillDialect } from './neta_bank.js';

export const MAX_LINES = 160;
export const MAX_CHARS = 240;
export const ROLE_OPTS = {
  manzai: ['boke', 'tsukkomi', 'narr'], conte: ['a', 'b', 'c', 'narr'], pin: ['pin', 'narr'], rakugo: ['narr', 'a', 'b', 'c'], ogiri: ['pin'],
  utaneta: ['pin', 'narr'], monomane: ['pin', 'narr'], talk: ['pin', 'narr'],
};
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clen = (s) => Array.from(String(s || '')).length;
const kindOk = (k) => (KINDS[k] ? k : 'manzai');

// ------------------------------------------------------------------ lines, snapshots, undo / redo
export function cloneLine(l) {
  const o = { role: l.role, text: String(l.text ?? ''), beat: l.beat || '' };
  if (l.twist) o.twist = true;
  if (l.src) o.src = l.src;
  return o;
}
export const cloneLines = (a) => (a || []).map(cloneLine);
const META = ['title', 'theme', 'themeId', 'setting', 'target', 'dialect', 'kind'];
export function snapshot(n, sel = 0) {
  const s = { lines: cloneLines(n.lines), sel };
  for (const k of META) s[k] = n[k];
  s.chars = n.chars ? { ...n.chars } : null;
  return s;
}
export function restore(n, s) {
  n.lines = cloneLines(s.lines);
  for (const k of META) if (s[k] !== undefined) n[k] = s[k];
  if (s.chars) n.chars = { ...s.chars }; else delete n.chars;
  return n;
}
export class History {
  constructor(limit = 60) { this.limit = limit; this.undoS = []; this.redoS = []; }
  // call BEFORE changing n. key: edits with the same key within 90 frames merge into one step (keeps the oldest before-state)
  push(n, sel, label = '', key = '', at = 0) {
    const last = this.undoS[this.undoS.length - 1];
    this.redoS.length = 0;
    if (key && last && last.key === key && at - last.at < 90) { last.at = at; return false; }
    this.undoS.push({ ...snapshot(n, sel), label, key, at });
    if (this.undoS.length > this.limit) this.undoS.shift();
    return true;
  }
  undo(n, sel) {
    const e = this.undoS.pop();
    if (!e) return null;
    this.redoS.push({ ...snapshot(n, sel), label: e.label });
    restore(n, e);
    return e;
  }
  redo(n, sel) {
    const e = this.redoS.pop();
    if (!e) return null;
    this.undoS.push({ ...snapshot(n, sel), label: e.label, key: '', at: 0 });
    restore(n, e);
    return e;
  }
  clear() { this.undoS.length = 0; this.redoS.length = 0; }
  get canUndo() { return this.undoS.length > 0; }
  get canRedo() { return this.redoS.length > 0; }
  get undoLabel() { const e = this.undoS[this.undoS.length - 1]; return e ? e.label : ''; }
  get redoLabel() { const e = this.redoS[this.redoS.length - 1]; return e ? e.label : ''; }
}

// ------------------------------------------------------------------ block operations (all on a lines array, in place)
export const rangeOf = (a, b) => [Math.min(a, b), Math.max(a, b)];
export function insertAt(lines, at, items, max = MAX_LINES) {
  const room = max - lines.length;
  if (room <= 0 || !items.length) return 0;
  const add = items.slice(0, room).map((l) => { const o = cloneLine(l); o.text = Array.from(o.text).slice(0, MAX_CHARS).join(''); return o; });
  lines.splice(clamp(at, 0, lines.length), 0, ...add);
  return add.length;
}
export function removeRange(lines, a, b) { return lines.splice(a, b - a + 1); }
// move the block a..b one step (dir -1 up / +1 down); false at the ends
export function moveBlock(lines, a, b, dir) {
  if (dir < 0) { if (a <= 0) return false; const x = lines.splice(a - 1, 1)[0]; lines.splice(b, 0, x); return true; }
  if (b >= lines.length - 1) return false;
  const x = lines.splice(b + 1, 1)[0];
  lines.splice(a, 0, x);
  return true;
}
export function setRoleRange(lines, a, b, role) { let k = 0; for (let i = a; i <= b; i++) if (lines[i] && lines[i].role !== role) { lines[i].role = role; k++; } return k; }
export function setBeatRange(lines, a, b, beat, twist = false) {
  let k = 0;
  for (let i = a; i <= b; i++) { const l = lines[i]; if (!l) continue; l.beat = beat || ''; if (twist) l.twist = true; else delete l.twist; k++; }
  return k;
}
const SWAP = { manzai: { boke: 'tsukkomi', tsukkomi: 'boke' }, conte: { a: 'b', b: 'a' }, rakugo: { a: 'b', b: 'a' } };
export const canSwap = (kind) => !!SWAP[kind];
// ボケ↔ツッコミ (漫才) / A↔B (コント・落語) in a..b; the explicit boke / tsukkomi beats follow
export function swapRoles(lines, kind, a = 0, b = lines.length - 1) {
  const m = SWAP[kind];
  if (!m) return 0;
  let k = 0;
  for (let i = Math.max(0, a); i <= Math.min(lines.length - 1, b); i++) {
    const l = lines[i];
    if (!m[l.role]) continue;
    l.role = m[l.role];
    if (kind === 'manzai' && (l.beat === 'boke' || l.beat === 'tsukkomi')) l.beat = l.beat === 'boke' ? 'tsukkomi' : 'boke';
    k++;
  }
  return k;
}
// lines of another kind → valid roles / beats for this kind (paste between scripts)
export function adaptLines(items, kind) {
  const ok = ROLE_OPTS[kindOk(kind)];
  const beats = BEAT_OPTS[kindOk(kind)];
  return items.map((l) => {
    const o = cloneLine(l);
    if (!ok.includes(o.role)) o.role = o.role === 'narr' ? (ok.includes('narr') ? 'narr' : ok[0]) : o.role === 'tsukkomi' || o.role === 'b' ? (ok[1] && ok[1] !== 'narr' ? ok[1] : ok[0]) : ok[0];
    if (o.twist && !beats.includes('uragiri')) delete o.twist;
    if (o.beat && !beats.includes(o.beat)) { o.beat = ''; delete o.twist; }
    return o;
  });
}
// the clipboard (memory only; lines can be pasted into another script, even of another kind)
export const CLIP = { lines: [], kind: '', text: '' };
export function copyToClip(lines, kind) { CLIP.lines = cloneLines(lines).map((l) => { delete l.src; return l; }); CLIP.kind = kind; CLIP.text = toTextLines(CLIP.lines, kind, null); return CLIP.lines.length; }
export const clipLines = (kind) => adaptLines(CLIP.lines, kind);

// ------------------------------------------------------------------ search / replace
// kana-insensitive (ひらがな = カタカナ) and case-insensitive; length-preserving so positions map back
export function foldStr(s) {
  let out = '';
  for (const ch of Array.from(String(s || ''))) {
    const c = ch.codePointAt(0);
    if (c >= 0x3041 && c <= 0x3096) { out += String.fromCharCode(c + 0x60); continue; }
    const lo = ch.toLowerCase();
    out += lo.length === ch.length ? lo : ch;
  }
  return out;
}
function occurrences(hay, needle) {
  const out = [];
  if (!needle) return out;
  let i = 0;
  for (;;) { const k = hay.indexOf(needle, i); if (k < 0) break; out.push(k); i = k + needle.length; }
  return out;
}
export function findAll(lines, q, a = 0, b = lines.length - 1) {
  const nq = foldStr(q);
  const out = [];
  if (!nq) return out;
  for (let i = Math.max(0, a); i <= Math.min(lines.length - 1, b); i++) { const k = occurrences(foldStr(lines[i].text), nq); if (k.length) out.push({ i, n: k.length, at: k[0] }); }
  return out;
}
// → { count, changed: [line index] }; texts are cut at 240 characters
export function replaceIn(lines, q, r, a = 0, b = lines.length - 1) {
  const nq = foldStr(q);
  const res = { count: 0, changed: [] };
  if (!nq) return res;
  for (let i = Math.max(0, a); i <= Math.min(lines.length - 1, b); i++) {
    const l = lines[i];
    const at = occurrences(foldStr(l.text), nq);
    if (!at.length) continue;
    const src = Array.from(l.text);
    const qlen = Array.from(q).length;
    let out = '', pos = 0;
    for (const k of at) { out += src.slice(pos, k).join('') + r; pos = k + qlen; }
    out += src.slice(pos).join('');
    l.text = Array.from(out).slice(0, MAX_CHARS).join('');
    delete l.src;
    res.count += at.length;
    res.changed.push(i);
  }
  return res;
}

// ------------------------------------------------------------------ sections (for 折りたたみ)
const HEADS = new Set(['tsukami', 'setup', 'tenkai', 'ochi', 'makura', 'hondai', 'sage']);
// → [{ start, end }] (inclusive). A section starts at a フリ / 展開 / オチ … line; lines after it belong to it.
export function sections(lines, beats) {
  const n = lines.length;
  if (!n) return [];
  let heads = [];
  for (let i = 0; i < n; i++) { const b = lines[i].beat || (beats && beats[i]) || ''; const prevHead = i > 0 && HEADS.has(lines[i - 1].beat || (beats && beats[i - 1]) || ''); if (i === 0 || (HEADS.has(b) && !prevHead)) heads.push(i); }
  if (heads.length < 2 && n > 6) { heads = []; for (let i = 0; i < n; i += 4) heads.push(i); }
  return heads.map((h, k) => ({ start: h, end: (k + 1 < heads.length ? heads[k + 1] : n) - 1 }));
}
export const sectionAt = (secs, i) => secs.find((s) => i >= s.start && i <= s.end) || null;

// ------------------------------------------------------------------ text (copy / paste of the whole script)
const LABEL = { boke: 'ボケ', tsukkomi: 'ツッコミ', a: 'A', b: 'B', c: 'C', narr: 'ト書き', pin: '本人', sage: 'サゲ' };
const BEAT_TAG = { tsukami: 'ツカミ', setup: 'フリ', boke: 'ボケ', tsukkomi: 'ツッコミ', tenkai: '展開', tendon: '天丼', fukusen: '伏線', kaishu: '回収', ochi: 'オチ', makura: 'まくら', hondai: '本題', sage: 'サゲ', answer: '回答' };
export function toTextLines(lines, kind, chars) {
  return lines.map((l) => {
    const tag = l.twist ? '[裏切り]' : l.beat && BEAT_TAG[l.beat] ? `[${BEAT_TAG[l.beat]}]` : '';
    let who = LABEL[l.role] || '本人';
    if (kind === 'rakugo' && l.role === 'narr') who = '地';
    if (kind === 'ogiri' && l.role === 'pin') who = '回答';
    if (chars && chars[l.role] && /^[abc]$/.test(l.role) && !/[：:「」\s]/.test(chars[l.role]) && Array.from(chars[l.role]).length <= 8) who = chars[l.role];
    return `${tag}${who}：${String(l.text).replace(/\s*\n\s*/g, ' ')}`;
  }).join('\n');
}
export function toText(n, o = {}) {
  const head = o.header ? `${n.title ? `『${n.title}』` : ''}${n.theme ? `テーマ：${n.theme}` : ''}\n` : '';
  return head + toTextLines(n.lines || [], n.kind, n.chars);
}
export const fromText = (text, kind, chars) => parseScript(text, kind, chars);

// ------------------------------------------------------------------ timing + the warnings
const PUNCH = new Set(['boke', 'tendon', 'kaishu', 'ochi', 'answer', 'sage']);
// seconds per line with the same formula as neta_ai.estimate (the sum equals estimate().sec)
export function lineTimes(n) {
  const kind = kindOk(n && n.kind);
  const Kd = KINDS[kind];
  const src = (n && n.lines) || [];
  const inf = inferBeats({ kind, lines: src });
  const sec = [], start = [], punch = [];
  let t = 0;
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    const text = String((l && l.text) || '').trim();
    start[i] = t;
    if (!text) { sec[i] = 0; punch[i] = false; continue; }
    const len = clen(text);
    const beat = l.beat || inf[i];
    const next = src[i + 1];
    const p = (PUNCH.has(beat) && l.role !== 'tsukkomi') || (beat === 'tsukami' && !!next && (next.role === 'tsukkomi' || next.beat === 'tsukkomi'));
    const action = l.role === 'narr' && /^[（(]/.test(text);
    let s = action ? 1.5 + len / 15 : kind === 'ogiri' ? 2.5 + len / Kd.rate : len / Kd.rate + Kd.pause;
    if (p) s += Kd.laugh;
    sec[i] = s; punch[i] = p; t += s;
  }
  return { sec, start, punch, total: t, beats: inf };
}
// stretches of lines without a punch line that run longer than the kind's gap: [{ a, b (line indexes), t0, t1, secs }]
export function dryStretches(n, times) {
  const Kd = KINDS[kindOk(n && n.kind)];
  const L = (n && n.lines) || [];
  const out = [];
  let a = -1;
  for (let i = 0; i <= L.length; i++) {
    const p = i < L.length ? !!times.punch[i] : true;
    if (p) {
      if (a >= 0) { const t0 = times.start[a], t1 = times.start[i - 1] + times.sec[i - 1]; if (t1 - t0 > Kd.gap) out.push({ a, b: i - 1, t0, t1, secs: t1 - t0 }); }
      a = -1;
    } else if (a < 0) a = i;
  }
  return out;
}
export const countWords = (text) => (String(text || '').match(/[一-鿿々〆ヶ]+|[ァ-ヺー]+|[A-Za-z][A-Za-z0-9\-]*|[0-9]+|[ぁ-ゖ]{1,3}/gu) || []).length;
export function counts(n) {
  const L = (n.lines || []).filter((l) => String(l.text || '').trim());
  return { lines: L.length, chars: L.reduce((s, l) => s + clen(l.text), 0), words: L.reduce((s, l) => s + countWords(l.text), 0) };
}
export const PLACEHOLDER = /〇{2,}/;
const NAMES = { tsukami: 'ツカミ', ochi: 'オチ', sage: 'サゲ', ketsu: '結（オチ）', makura: 'まくら' };
const FIX_TAB = { tsukami: 'tsukami', ochi: 'ochi', sage: 'sage', ketsu: 'ketsu', makura: 'makura' };
// [{ id, level: 'bad' | 'warn' | 'info', text, line (index or null), fix: { id, label, arg? } | null }]
export function lintScript(n, ctx = {}) {
  const kind = kindOk(n.kind);
  const Kd = KINDS[kind];
  const L = n.lines || [];
  const out = [];
  const times = ctx.times || lineTimes(n);
  const est = ctx.est || estimate(n);
  const check = ctx.check || structureCheck(n);
  const year = ctx.year || 0;
  const empty = L.map((l, i) => (String(l.text || '').trim() ? -1 : i)).filter((i) => i >= 0);
  if (empty.length) out.push({ id: 'empty', level: 'warn', text: `空の行が${empty.length}つある`, line: empty[0], fix: { id: 'delete-empty', label: '空の行を消す' } });
  if (est.sec > n.target * 1.05) out.push({ id: 'over', level: 'bad', text: `尺オーバー ${est.sec - n.target}秒（目安をこえている）`, line: null, fix: { id: 'weak', label: '弱い行をさがす' } });
  for (const c of check) {
    if (c.ok || !FIX_TAB[c.id] || !L.length) continue;
    out.push({ id: `no-${c.id}`, level: c.id === 'ochi' || c.id === 'sage' ? 'warn' : 'warn', text: `${NAMES[c.id]}がまだない`, line: null, fix: { id: 'parts', label: `${NAMES[c.id]}を足す`, arg: FIX_TAB[c.id] } });
  }
  // runs of the same speaker role
  const runs = (role, min) => {
    let i = 0;
    const res = [];
    while (i < L.length) { if (L[i].role === role) { let j = i; while (j + 1 < L.length && L[j + 1].role === role) j++; if (j - i + 1 >= min) res.push([i, j]); i = j + 1; } else i++; }
    return res;
  };
  if (kind === 'manzai') {
    for (const [a, b] of runs('tsukkomi', 3)) out.push({ id: 'tsukkomi-run', level: 'warn', text: `ツッコミが${b - a + 1}回続く（${a + 1}〜${b + 1}行目）`, line: a + 1, fix: { id: 'boke-after', label: '間にボケを足す', arg: a } });
    for (const [a, b] of runs('boke', 4)) out.push({ id: 'boke-run', level: 'info', text: `ボケが${b - a + 1}回続く（${a + 1}〜${b + 1}行目）`, line: b, fix: { id: 'tsukkomi-after', label: 'ツッコミを足す', arg: b } });
  }
  for (let i = 1; i < L.length; i++) { const a = foldStr(L[i].text).replace(/\s/g, ''), b = foldStr(L[i - 1].text).replace(/\s/g, ''); if (clen(a) >= 4 && a === b) { out.push({ id: 'dup', level: 'warn', text: `${i}・${i + 1}行目が同じセリフ`, line: i, fix: { id: 'delete-line', label: '重複を消す', arg: i } }); break; } }
  const long = L.map((l, i) => [i, clen(l.text)]).filter(([, k]) => k > Kd.maxLine);
  if (long.length) out.push({ id: 'long', level: 'info', text: `${long[0][0] + 1}行目が長い（${long[0][1]}字）`, line: long[0][0], fix: { id: 'edit', label: '書きなおす', arg: long[0][0] } });
  // a long stretch with no punch line
  const dry = ctx.dry || dryStretches(n, times);
  if (L.length >= 6 && dry.length) { const worst = dry.slice().sort((a, b) => b.secs - a.secs)[0]; out.push({ id: 'dry', level: 'warn', text: `笑いどころがない区間 ${Math.round(worst.secs)}秒（${worst.a + 1}〜${worst.b + 1}行目）`, line: worst.a, fix: { id: 'boke-after', label: 'ボケを足す', arg: Math.floor((worst.a + worst.b) / 2) } }); }
  const ph = L.map((l, i) => (PLACEHOLDER.test(l.text) ? i : -1)).filter((i) => i >= 0);
  if (ph.length) out.push({ id: 'placeholder', level: 'warn', text: `「〇〇」が${ph.length}行に残っている`, line: ph[0], fix: { id: 'blank', label: '〇〇を埋める', arg: ph[0] } });
  if (year) {
    for (let i = 0; i < L.length; i++) { const hit = ANACHRO.find(([w, y]) => y > year && String(L[i].text).includes(w)); if (hit) { out.push({ id: 'anachro', level: 'bad', text: `「${hit[0]}」は${year}年にはまだ早い（${i + 1}行目）`, line: i, fix: { id: 'edit', label: '言いかえる', arg: i } }); break; } }
  }
  const bank = L.filter((l) => l.src === 'bank').length;
  if (L.length >= 4 && bank / L.length >= 0.6) out.push({ id: 'bank', level: 'info', text: `部品のままの行が${bank}行（独自性が下がる）`, line: L.findIndex((l) => l.src === 'bank'), fix: { id: 'edit', label: '自分の言葉に', arg: L.findIndex((l) => l.src === 'bank') } });
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((x, y) => rank[x.level] - rank[y.level]);
}

// ------------------------------------------------------------------ candidates
const bigrams = (s) => { const a = Array.from(foldStr(String(s || '')).replace(/[\s、。！？!?「」…・]/g, '')); const out = new Set(); for (let i = 0; i + 2 <= a.length; i++) out.add(a[i] + a[i + 1]); return out; };
// items sorted by how many two-character runs they share with ctxText (stable: the bank order breaks ties)
export function rankByLink(items, ctxText) {
  const g = bigrams(ctxText);
  const sc = items.map((it, k) => { const h = bigrams(`${it.text} ${it.pair ? it.pair.text : ''}`); let s = 0; for (const x of h) if (g.has(x)) s++; return { it, s, k }; });
  return sc.sort((x, y) => y.s - x.s || x.k - y.k).map((x) => x.it);
}

// ------------------------------------------------------------------ snippets (テンプレ挿入)
// lines: [role, text, beat, twist?]. 〇〇 = a blank the writer fills; {unit} {name} {phone} … are filled at insertion (era words,
// the act's name); {recall} = a phrase from an earlier ボケ. from: first year the template may be offered.
const S = (id, name, desc, kinds, lines, from = 0) => ({ id, name, desc, kinds, lines, from });
export const SNIPPETS = [
  S('intro', '自己紹介のツカミ', '「どうもー、〇〇です！」から入る定番の出だし', ['manzai'], [
    ['boke', 'どうもー、{unit}です！よろしくお願いしますー！', 'tsukami'], ['tsukkomi', 'お願いします。今日はたくさん来てくれてありがとうございます。', 'setup'],
    ['boke', 'いやあ、ぼくね、最近〇〇にハマってまして。', 'setup'], ['tsukkomi', 'へえ、〇〇に。', 'setup']]),
  S('matte', '「ちょっと待って」型ツッコミ', 'ボケの一言を止めて、聞き返して、広げる', ['manzai'], [
    ['boke', '実はぼく、〇〇なんですよ。', 'boke'], ['tsukkomi', 'ちょっと待って。いま何て言った？', 'tsukkomi'],
    ['boke', '〇〇、って言いました。', 'boke'], ['tsukkomi', 'そこは聞こえてたよ！なんで〇〇なんだよ！', 'tsukkomi']]),
  S('tendon', '天丼の繰り返し', '前のボケをもう一度。最後にもう一回で笑いが大きくなる', ['manzai', 'pin', 'utaneta', 'monomane'], [
    ['boke', 'ところで、さっきの「{recall}」の話なんですけど。', 'tendon'], ['tsukkomi', 'まだ引っぱるのかよ！', 'tsukkomi'],
    ['boke', '最後にもう一回だけ言わせて。「{recall}」。', 'tendon'], ['tsukkomi', 'しつこいんだよ！', 'tsukkomi']]),
  S('omottara', '〜と思ったら型', '「〇〇かと思ったら、〇〇でした」の落差で見せる', ['manzai'], [
    ['boke', '〇〇かと思ったら、〇〇でした。', 'boke'], ['tsukkomi', '〇〇かい！', 'tsukkomi']]),
  S('tatoe', '例えツッコミ型', '「〜か！」「〜じゃないんだから！」でたとえる', ['manzai'], [
    ['boke', '〇〇は、いつも〇〇なんですよ。', 'boke'], ['tsukkomi', '〇〇の〇〇か！〇〇じゃないんだから！', 'tsukkomi']]),
  S('nori', 'ノリツッコミ型', 'いったん受け入れてから、気づいてツッコむ', ['manzai'], [
    ['boke', '〇〇ってどう？', 'boke'], ['tsukkomi', 'いいね、それ採用！…って、するか！', 'tsukkomi']]),
  S('kanchigai', '勘違い型', '言葉の意味をとりちがえる', ['manzai', 'conte'], [
    ['boke', '〇〇って言われたから、〇〇のことだと思って、〇〇しました。', 'boke'], ['tsukkomi', 'それは〇〇のことじゃないよ！', 'tsukkomi']]),
  S('rule3', '三段落ち（くり返し→裏切り）', '同じ型を二回くり返して、三回目で外す', ['manzai', 'pin'], [
    ['boke', '〇〇は〇〇、〇〇は〇〇、そして…', 'boke'], ['tsukkomi', 'そして？', 'tsukkomi'], ['boke', '〇〇！', 'boke'], ['tsukkomi', '急に〇〇が来たな！', 'tsukkomi']]),
  S('era', '時代のあるある（{phone}）', '{phone}まわりのあるあるで入る（時代の言葉に自動で置きかわる）', ['manzai', 'pin', 'talk'], [
    ['boke', 'うちの{phone}、最近〇〇なんですよ。', 'boke'], ['tsukkomi', '{phone}が〇〇って、そんなことあるか？', 'tsukkomi'],
    ['boke', 'この前なんか、〇〇が{phone}を〇〇してて。', 'boke'], ['tsukkomi', 'なんで〇〇が{phone}を〇〇するんだよ！', 'tsukkomi']]),
  S('ochi', '締めのオチ', '最後の一言とあいさつ', ['manzai'], [
    ['boke', '最後に〇〇しておきました。', 'ochi'], ['tsukkomi', 'もういいよ！どうもありがとうございました！', 'ochi']]),
  S('c_open', '場面設定（ト書き＋ふたり）', 'どこで・だれが・何をしているかを見せる', ['conte'], [
    ['narr', '（〇〇の店内。客のAがカウンターに座っている）', 'setup'], ['a', 'すみません、〇〇をください。', 'setup'], ['b', 'はい、〇〇ですね。かしこまりました。', 'setup']]),
  S('c_zure', 'ズレの発生', '店員のふるまいが、少しずつおかしくなる', ['conte'], [
    ['a', 'あの、これ〇〇じゃないですか？', 'boke'], ['b', 'いいえ、〇〇です。', 'boke'], ['a', '〇〇が〇〇になってますけど。', 'tsukkomi'], ['b', 'それが当店の〇〇でして。', 'boke']]),
  S('c_uragiri', '裏切り（実は…）', '観客の予想をひっくり返す', ['conte'], [
    ['narr', '（Bがマスクを取る。実は〇〇だった）', 'tenkai', true], ['a', 'えっ、〇〇だったの！？', 'tsukkomi']]),
  S('c_ochi', '暗転オチ', '最後の一言で暗転', ['conte'], [
    ['b', 'では、こちらが〇〇になります。', 'ochi'], ['narr', '（暗転）', 'ochi']]),
  S('p_flip', 'フリップ芸', 'フリップをめくりながら、共感から落とす', ['pin'], [
    ['narr', '（フリップ：「〇〇な人」）', 'tsukami'], ['pin', '〇〇な人、〇〇だよね。', 'boke'], ['pin', 'さらに〇〇な人は、〇〇。', 'boke'], ['narr', '（フリップをめくる：「〇〇」）', 'ochi']]),
  S('p_open', '漫談の入り', 'あいさつから一つの話題に入る', ['pin', 'talk'], [
    ['pin', 'どうもー。〇〇です。', 'tsukami'], ['pin', '最近、〇〇なことがありまして。', 'setup'], ['pin', 'それがもう〇〇で。', 'tenkai']]),
  S('r_makura', 'まくらから本題へ', '世間話から噺に入る', ['rakugo'], [
    ['narr', 'ええ、えらいお暑い中、〇〇にお越しいただきまして、ありがとうございます。', 'makura'], ['narr', '〇〇と申しますものは、〇〇でございまして。', 'makura'], ['narr', 'ええ、そんな〇〇のお話でございます。', 'hondai']]),
  S('r_sage', 'サゲ（落ち）', '噺の終わり', ['rakugo'], [
    ['a', '〇〇ってえと、〇〇かい？', 'sage'], ['narr', '…というわけで、お後がよろしいようで。', 'sage']]),
  S('o_ans', '大喜利の回答の型', '短く、意外な角度から', ['ogiri'], [
    ['pin', '〇〇な〇〇', 'answer'], ['pin', '〇〇しながら〇〇', 'answer'], ['pin', '〇〇の中の〇〇', 'answer']]),
  S('o_shika', '「〇〇しか勝たん」型', '最近の言い回しの回答', ['ogiri'], [['pin', '〇〇しか勝たん', 'answer']], 2020),
  S('u_sabi', 'サビの天丼', 'サビのくり返しを少しずつ崩す', ['utaneta'], [
    ['pin', '（サビ）〇〇〇〇〇〜〇〇〇〇〇〜', 'tendon'], ['pin', '（もう一回サビ）〇〇〇〇〇〜〇〇〇〇〇〜！', 'tendon'], ['pin', '（最後のサビ）〇〇〇〇〇〜〇〇〇〇〇〜…〇〇。', 'ochi']]),
  S('m_scene', 'ものまねの場面設定', '何のまねを、どんな場面で', ['monomane'], [
    ['narr', '（〇〇のものまね。場面：〇〇）', 'setup'], ['pin', '〇〇〇〇〇〇！', 'boke'], ['pin', '〇〇〇〇〇〇…〇〇！', 'ochi']]),
  S('t_kisho', '起承転結の型', '状況→展開→ひっくり返し→結び', ['talk', 'pin'], [
    ['pin', 'この前、〇〇があったんですよ。', 'setup'], ['pin', 'そしたら、〇〇で。', 'tenkai'], ['pin', 'ところが〇〇だったんです。', 'boke'], ['pin', '結局〇〇でした。', 'ochi']]),
];
export const snippetsFor = (kind, year = 0) => SNIPPETS.filter((s) => s.kinds.includes(kindOk(kind)) && (!s.from || !year || year >= s.from));
// → lines [{ role, text, beat, twist? }] with the roles / beats made valid for `kind` (a ボケ+ツッコミ template in a one-voice kind
// becomes 本人 lines); ctx: { era, dialect, names, recall }
export function buildSnippet(sn, ctx = {}, kind = '') {
  const lines = sn.lines.map(([role, text, beat, tw]) => {
    let t = String(text).replaceAll('{recall}', ctx.recall || '〇〇');
    t = fillNames(fillEra(t, ctx.era || 'reiwa'), ctx.names || {});
    t = fillDialect(t, ctx.dialect);
    const o = { role, text: Array.from(t).slice(0, MAX_CHARS).join(''), beat: beat || '' };
    if (tw) o.twist = true;
    return o;
  });
  const k = kind || (sn.kinds && sn.kinds[0]) || 'manzai';
  return adaptLines(lines, k);
}
// a phrase worth repeating: the first 「…」 of the latest ボケ before `at`, else its first 10 characters
export function recallPhrase(lines, at) {
  for (let i = Math.min(at, lines.length - 1); i >= 0; i--) {
    const l = lines[i];
    if (!l || (l.role === 'tsukkomi') || !String(l.text).trim()) continue;
    const q = String(l.text).match(/「([^」]{2,14})」/);
    if (q) return q[1];
    const t = Array.from(String(l.text).replace(/^[…\s]+/, ''));
    if (t.length >= 3) return t.slice(0, 10).join('').replace(/[、。！？]+$/, '');
  }
  return '';
}

// ------------------------------------------------------------------ versions (版) and the draft — kept in g.netaSettings().ed
const ROLE_IDX = ['boke', 'tsukkomi', 'a', 'b', 'c', 'narr', 'pin', 'sage'];
const BEAT_IDX = ['', 'tsukami', 'setup', 'boke', 'tsukkomi', 'tenkai', 'tendon', 'fukusen', 'kaishu', 'ochi', 'makura', 'hondai', 'sage', 'answer'];
export const packLine = (l) => [Math.max(0, ROLE_IDX.indexOf(l.role)), String(l.text ?? ''), Math.max(0, BEAT_IDX.indexOf(l.beat || '')), (l.twist ? 1 : 0) | (l.src === 'bank' ? 2 : 0)];
export function unpackLine(a) {
  if (!Array.isArray(a)) return null;
  const o = { role: ROLE_IDX[a[0]] || 'boke', text: String(a[1] ?? ''), beat: BEAT_IDX[a[2]] || '' };
  if (a[3] & 1) o.twist = true;
  if (a[3] & 2) o.src = 'bank';
  return o;
}
export function packDoc(n) {
  const p = { k: kindOk(n.kind), t: n.title || '', th: n.theme || '', ti: n.themeId || '', s: n.setting || '', g: n.target || 0, d: n.dialect === 'kansai' ? 'kansai' : 'std', l: (n.lines || []).map(packLine) };
  if (n.chars && Object.keys(n.chars).length) p.c = { ...n.chars };
  return p;
}
export function unpackDoc(p) {
  if (!p || typeof p !== 'object') return null;
  const doc = { kind: kindOk(p.k), title: String(p.t || ''), theme: String(p.th || ''), themeId: String(p.ti || ''), setting: String(p.s || ''), target: Number(p.g) || 0, dialect: p.d === 'kansai' ? 'kansai' : 'std', lines: (Array.isArray(p.l) ? p.l : []).slice(0, MAX_LINES).map(unpackLine).filter(Boolean) };
  if (p.c && typeof p.c === 'object') doc.chars = { ...p.c };
  return doc;
}
export function edStore(settings) {
  let e = settings && settings.ed;
  if (!e || typeof e !== 'object' || Array.isArray(e)) { e = {}; if (settings) settings.ed = e; }
  if (!e.snaps || typeof e.snaps !== 'object' || Array.isArray(e.snaps)) e.snaps = {};
  e.v = 1;
  return e;
}
const sizeOf = (e) => { let n = 0; for (const k of Object.keys(e.snaps)) for (const v of e.snaps[k] || []) n += JSON.stringify(v.p || '').length; return n; };
// store a version of n under key (a script id, or 'new:<kind>'); consecutive identical versions are not stored twice. → true when stored
export function addVersion(e, key, n, label, now = 0, max = 8) {
  const arr = (e.snaps[key] = Array.isArray(e.snaps[key]) ? e.snaps[key] : []);
  const p = packDoc(n);
  const last = arr[arr.length - 1];
  if (last && JSON.stringify(last.p) === JSON.stringify(p)) { last.at = now || last.at; if (label && label !== 'じどう') last.label = label; return false; }
  if (!p.l.length) return false;
  arr.push({ at: now, label: label || '', p });
  while (arr.length > max) arr.shift();
  // global limits: 24 scripts, ~300 KB of lines
  const keys = Object.keys(e.snaps);
  if (keys.length > 24) { const old = keys.filter((k) => k !== key).sort((a, b) => ((e.snaps[a].slice(-1)[0] || {}).at || 0) - ((e.snaps[b].slice(-1)[0] || {}).at || 0)); while (Object.keys(e.snaps).length > 24 && old.length) delete e.snaps[old.shift()]; }
  let guard = 0;
  while (sizeOf(e) > 300000 && guard++ < 200) { const ks = Object.keys(e.snaps).filter((k) => (e.snaps[k] || []).length > 1); if (!ks.length) break; const k = ks.sort((a, b) => (e.snaps[a][0].at || 0) - (e.snaps[b][0].at || 0))[0]; e.snaps[k].shift(); }
  return true;
}
export const versionsOf = (e, key) => (Array.isArray(e.snaps[key]) ? e.snaps[key] : []).slice().reverse();
export function moveVersions(e, from, to) {
  if (from === to || !Array.isArray(e.snaps[from])) return;
  e.snaps[to] = [...(Array.isArray(e.snaps[to]) ? e.snaps[to] : []), ...e.snaps[from]].slice(-8);
  delete e.snaps[from];
}
export function setDraft(e, key, n, sel, now = 0) { e.draft = { key, id: n.id || null, at: now, sel: sel | 0, p: packDoc(n) }; }
export function getDraft(e, key) { const d = e.draft; return d && typeof d === 'object' && d.key === key && d.p ? d : null; }
export function clearDraft(e, key) { if (!key || (e.draft && e.draft.key === key)) delete e.draft; }
