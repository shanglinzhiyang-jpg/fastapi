// メモ, ネタ時計 (ストップウォッチ・通し稽古の録音), お笑い用語じてん and やること (today's plan).
//
// メモ: the player's notes (askText, up to 40 × 200 字), pins, ネタの種 notes the バイト leaves, and
//   「このメモでネタを書く」 (g.writeNeta, エピソードトーク). 手帳: the 手帳's memo pages.
// ネタ時計 (手帳: ストップウォッチとカセットテープ / ケータイ・スマホ: ネタ録音): a stopwatch, and 通し稽古:
//   run a script through against the clock — the real length (the script's estimate ± the run: 間・テンポ,
//   声量・滑舌, 仕上がり), 噛み, each part's time on the recording, the contests' 尺 for the year — and a
//   little 仕上がり (g.practiceNeta +2, twice a day per script, 4 runs a day, 体力 -4).
// お笑い用語じてん: short definitions of the trade's words (ツカミ, 天丼, 尺, 香盤, 出囃子, 笑神籤 …), with
//   what each means in this game. Words that did not exist yet in the game year are left out.
// やること: what today asks for (a regular show, an offer, a contest round soon, the NSC, rent, 体力 /
//   満腹 / ストレス / 身だしなみ), suggestions, and the player's own to-do list. Each row opens the app that
//   deals with it. Badge: the urgent ones.

import { fmtMoney, clamp, shade } from './util.js';
import { audio } from './audio.js';
import { askText } from './textinput.js';
import { weekdayOf, WEEKDAYS, PHONE_APPS, REGULARS, HUNGRY, STRESSED, BURNOUT, SCRUFFY } from './life.js';
import { phoneView, phoneList, phoneInfo, phoneConfirm, moneyApp, scheduleApp, messagesApp, contactsApp } from './phone.js';
import { panelView, rowsList, lifeBlock } from './phone_apps.js';
import {
  num, isObj, arr, str, has, safe, R, disc, art, devOf, dateOf, ymOf, yearOf, part, definePart, rnd, gaussR, commas, mmss,
  addMemo, MEMO_LEN, passMinutes, chip, bar, buttons, hit, T, fitText, PC, box, rrect, para, wrap, measure,
} from './phone_apps3_kit.js';

const EXT = { ai: null, netaUi: null };
import('./neta_ai.js').then((m) => { EXT.ai = m; }).catch(() => { /* neta_ai.js left out */ });
import('./neta_ui.js').then((m) => { EXT.netaUi = m; }).catch(() => { /* neta_ui.js left out */ });

export const MEMO_COLOR = '#c8a020';
export const TIMER_COLOR = '#3a6a8a';
export const YOUGO_COLOR = '#a0522d';
export const PLAN_COLOR = '#4a8a3a';
export const timerTitle = (g) => (devOf(g) === 'techo' ? 'ネタ時計' : 'ネタ録音');

// ======================================================================== メモ
export async function memoApp(g) {
  const M = part(g, 'memo');
  const rows = () => {
    const list = M.list.filter((m) => m.tag !== 'todo').slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.day - a.day || b.id - a.id);
    return [{ id: 'new', label: '新しいメモを書く', chip: ['＋', MEMO_COLOR] }, ...list.map((m) => ({ id: 'm', m, label: `${m.pin ? '★' : ''}${m.title || '（無題）'}`, sub: `${m.day}日目・${m.text.replace(/\n/g, ' ')}`, chip: m.tag === 'seed' ? ['ネタの種', '#d07a1a'] : null }))];
  };
  return phoneView(g, panelView(g, {
    title: 'メモ', color: MEMO_COLOR, bg: devOf(g) === 'techo' ? '#f8f2dc' : '#fffbea', top: 0, rowH: 38,
    items: rows,
    empty: 'メモはまだない。',
    pick: (ph, it, i, v) => ph.run(v, async () => {
      if (it.id === 'new') {
        const s = await askText(g, { title: 'メモ（1行目がタイトル）', value: '', max: MEMO_LEN, multiline: true, rows: 5 });
        if (s) { addMemo(g, { text: s }); audio.sfx('ok'); }
        return;
      }
      await memoDetail(g, it.m);
    }),
  }));
}
async function memoDetail(g, m) {
  const M = part(g, 'memo');
  for (;;) {
    if (!M.list.includes(m)) return;
    const acts = [['view', '読む'], ['edit', '書きなおす'], ['pin', m.pin ? 'ピンをはずす' : 'ピン留めする'], ...(has(g, 'writeNeta') ? [['neta', 'このメモでネタを書く']] : []), ['del', '消す']];
    const k = await rowsList(g, { title: m.title || 'メモ', color: MEMO_COLOR, items: acts.map(([, l]) => ({ label: l })) });
    if (k < 0) return;
    const a = acts[k][0];
    if (a === 'view') await phoneInfo(g, { title: m.title || 'メモ', color: MEMO_COLOR, text: `${m.day}日目\n\n${m.text}` });
    else if (a === 'edit') { const s = await askText(g, { title: 'メモを書きなおす', value: m.text, max: MEMO_LEN, multiline: true, rows: 5 }); if (s) { m.text = s; m.title = str(s.split('\n')[0], 24); } }
    else if (a === 'pin') m.pin = !m.pin;
    else if (a === 'neta') { await safe(() => g.writeNeta({ kind: 'talk', title: str(m.title, 24), theme: str(m.text.replace(/\n/g, ' '), 40) }), null); return; }
    else if (a === 'del') { const c = await phoneConfirm(g, { title: 'メモを消す', color: MEMO_COLOR, text: `「${m.title || '無題'}」を消す？`, choices: ['消す', 'やめる'] }); if (c === 0) { M.list.splice(M.list.indexOf(m), 1); return; } }
  }
}

// ======================================================================== ネタ時計 / ネタ録音
definePart('timer', (s) => ({
  day: Math.floor(num(s.day)), runs: Math.max(0, Math.floor(num(s.runs))), by: isObj(s.by) ? Object.fromEntries(Object.entries(s.by).filter(([k]) => typeof k === 'string' && k.length < 30).map(([k, v]) => [k, Math.max(0, Math.floor(num(v)))])) : {},
  total: Math.max(0, Math.floor(num(s.total))),
  last: isObj(s.last) ? { id: str(s.last.id, 30), title: str(s.last.title, 30), sec: Math.max(0, num(s.last.sec)), est: Math.max(0, num(s.last.est)), target: Math.max(0, num(s.last.target)), flubs: Math.max(0, Math.floor(num(s.last.flubs))), parts: arr(s.last.parts).filter(isObj).slice(0, 12).map((p) => ({ label: str(p.label, 12), sec: Math.max(0, num(p.sec)) })), day: Math.floor(num(s.last.day)), flubAt: arr(s.last.flubAt).map((x) => Math.max(0, num(x))).slice(0, 8) } : null,
}));
const RUNS_PER_SCRIPT = 2, RUNS_PER_DAY = 4, RUN_STAMINA = 4;
const BEAT_LABEL = { tsukami: 'ツカミ', setup: 'フリ', boke: 'ボケ', tsukkomi: 'ツッコミ', tenkai: '展開', tendon: '天丼', fukusen: '伏線', kaishu: '回収', ochi: 'オチ', makura: 'まくら', hondai: '本題', sage: 'サゲ', answer: '回答' };
// the time of each line (as neta_ai.js estimate does it), scaled to the script's estimate
function lineTimes(n) {
  const K = (EXT.ai && EXT.ai.KINDS && EXT.ai.KINDS[n.kind]) || { rate: 6.5, pause: 0.5, laugh: 1 };
  const beats = EXT.ai && EXT.ai.inferBeats ? safe(() => EXT.ai.inferBeats({ kind: n.kind, lines: n.lines }), []) || [] : [];
  return (n.lines || []).map((l, i) => {
    const t = String((l && l.text) || '').trim();
    const beat = (l && l.beat) || beats[i] || '';
    return { beat, sec: t ? Array.from(t).length / K.rate + K.pause + (['boke', 'ochi', 'tendon', 'kaishu', 'answer'].includes(beat) ? K.laugh : 0) : 0 };
  });
}
export function scriptLength(n) {
  if (!n) return 0;
  if (EXT.ai && EXT.ai.estimate) { const e = safe(() => EXT.ai.estimate(n), null); if (e && e.sec) return e.sec; }
  return num(n.length) || lineTimes(n).reduce((a, x) => a + x.sec, 0);
}
export function runWhy(g, n) {
  const T0 = part(g, 'timer'), st = g.state;
  if (!n) return '台本がない。';
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (T0.day !== st.day) { T0.day = st.day; T0.runs = 0; T0.by = {}; }
  if (T0.runs >= RUNS_PER_DAY) return `今日はもう${RUNS_PER_DAY}回通した。のどを休めよう。`;
  if (num(T0.by[n.id]) >= RUNS_PER_SCRIPT) return `このネタは今日もう${RUNS_PER_SCRIPT}回通した。`;
  if (num(st.life && st.life.stress) >= BURNOUT) return 'ストレスが限界…';
  if (st.stamina < RUN_STAMINA) return `体力が足りない（体力${RUN_STAMINA}）。`;
  return null;
}
// One timed run-through (no UI) → { ok, sec, est, target, flubs, parts: [{ label, sec }], practice: [before, after] }
export function runThrough(g, id) {
  const n = has(g, 'neta') ? safe(() => g.neta(id), null) : null;
  const why = runWhy(g, n);
  if (why) return { ok: false, why };
  const st = g.state, T0 = part(g, 'timer');
  T0.runs++; T0.by[n.id] = num(T0.by[n.id]) + 1; T0.total++;
  st.stamina -= RUN_STAMINA;
  g.lifeTick({ stress: 1, hunger: -2 });
  const stat = (k) => (has(g, 'comedyStat') ? num(safe(() => g.comedyStat(k), 30)) : 30);
  const ma = stat('ma'), voice = stat('voice'), prac = num(n.practice);
  const est = scriptLength(n);
  const k = `${T0.total}`;
  // nerves rush an unrehearsed script; the spread narrows with 間・テンポ and 仕上がり
  const bias = -0.05 * (1 - ma / 100) * (1 - prac / 100);
  const sd = 0.08 * (1 - prac / 130) * (1 - ma / 220);
  const f = 1 + bias + sd * gaussR(g, 'run', n.id, st.day, k);
  const lam = 2.6 * (1 - prac / 110) * (1 - voice / 160);
  let flubs = 0, p = Math.exp(-lam), cum = p;
  const u = rnd(g, 'flub', n.id, st.day, k);
  while (u > cum && flubs < 9) { flubs++; p *= lam / flubs; cum += p; }
  const sec = Math.max(5, est * f + flubs * 1.5);
  // the parts on the recording
  const lt = lineTimes(n);
  const sum = lt.reduce((a, x) => a + x.sec, 0) || 1;
  const parts = [];
  let acc = 0;
  for (const [i, x] of lt.entries()) {
    const pos = acc / sum;
    acc += x.sec;
    const label = (i === 0 || x.beat === 'tsukami') && pos < 0.2 ? (n.kind === 'rakugo' ? 'まくら' : 'ツカミ') : x.beat === 'makura' ? 'まくら' : (x.beat === 'ochi' || x.beat === 'sage') && pos > 0.6 ? 'オチ' : pos < 0.5 ? '前半' : '後半';
    const last = parts[parts.length - 1];
    if (last && last.label === label) last.sec += (x.sec / sum) * sec; else parts.push({ label, sec: (x.sec / sum) * sec });
  }
  const merged = [];
  for (const pt of parts) { if (merged.length < 7) merged.push(pt); else merged[merged.length - 1].sec += pt.sec; }
  const flubAt = Array.from({ length: flubs }, (_, i) => rnd(g, 'flubAt', n.id, st.day, k, i) * sec);
  const before = prac;
  const after = has(g, 'practiceNeta') ? num(safe(() => g.practiceNeta(n.id, 2), prac)) : prac;
  const target = num(n.target, est);
  passMinutes(g, Math.max(5, Math.round((sec * 2) / 60) + 5), '通し稽古');
  T0.last = { id: n.id, title: str(n.title || '無題', 30), sec, est, target, flubs, parts: merged.map((x) => ({ label: x.label, sec: x.sec })), day: st.day, flubAt };
  return { ok: true, sec, est, target, flubs, parts: T0.last.parts, practice: [before, after], flubAt };
}
// the contests' 尺 this year (neta_ui.js lengthPresets) + the usual ones
function shakuRows(g) {
  const out = [];
  const pre = EXT.netaUi && EXT.netaUi.lengthPresets ? safe(() => EXT.netaUi.lengthPresets(g), []) || [] : [];
  for (const p of pre) {
    if (!p || !p.label || !p.sec) continue;
    const m = /^(\S+?)\s+(.+?)(?:（[^）]*）)?$/.exec(String(p.label));
    out.push(m ? { label: m[1], sub: m[2], right: mmss(p.sec) } : { label: String(p.label).replace(/（[^）]*）$/, ''), right: mmss(p.sec) });
  }
  if (!out.length) out.push({ label: '劇場の出番', right: '約5:00' }, { label: 'テレビのネタ番組', right: '約3:00' }, { label: '落語の高座', right: '約15:00' });
  return out;
}
export async function timerApp(g) {
  const rows = () => {
    const T0 = part(g, 'timer');
    const out = [{ id: 'watch', label: 'ストップウォッチ', sub: '何でも計れる' }];
    out.push({ id: 'run', label: '通し稽古（タイムを計る）', sub: `今日 ${T0.day === g.state.day ? T0.runs : 0}/${RUNS_PER_DAY}回・体力-${RUN_STAMINA}・仕上がり少しアップ`, chip: ['録音', TIMER_COLOR] });
    if (T0.last) out.push({ id: 'last', label: `前回：${T0.last.title}`, sub: `${mmss(T0.last.sec)}（目安${mmss(T0.last.target)}）・噛み${T0.last.flubs}回`, right: '聞く' });
    out.push({ id: 'shaku', label: '尺のめやす（賞レース）', sub: `${yearOf(g)}年の大会の持ち時間` });
    return out;
  };
  return phoneView(g, panelView(g, {
    title: timerTitle(g), color: TIMER_COLOR, top: 0, rowH: 38, items: rows,
    pick: (ph, it, i, v) => ph.run(v, async () => {
      if (it.id === 'watch') await stopwatch(g);
      else if (it.id === 'run') await runFlow(g);
      else if (it.id === 'last') await playback(g);
      else if (it.id === 'shaku') await rowsList(g, { title: '尺のめやす', color: TIMER_COLOR, items: shakuRows(g), hint: 'B:もどる', pick: () => {} });
    }),
  }));
}
function stopwatch(g) {
  return phoneView(g, {
    title: 'ストップウォッチ', color: TIMER_COLOR, cancel: true, el: 0, run: false, laps: [], sel: 0,
    bg: devOf(g) === 'techo' ? '#d8d0bc' : '#101820',
    hint: 'A:開始/停止　←:ラップ　→:リセット',
    update(ph, inp) {
      if (this.run) this.el++;
      if (inp.pressed('a')) { this.press(0); return; }
      if (inp.pressed('left')) this.press(1);
      if (inp.pressed('right')) this.press(2);
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(true); }
    },
    press(i) {
      if (i === 0) { this.run = !this.run; audio.sfx(this.run ? 'ok' : 'cancel'); }
      else if (i === 1 && this.run) { this.laps.unshift(this.el); this.laps.length = Math.min(this.laps.length, 6); audio.sfx('cursor'); }
      else if (i === 2 && !this.run) { this.el = 0; this.laps = []; audio.sfx('cursor'); }
    },
    tap(ph, x, y) { const i = (this.btns || []).findIndex((r) => hit(r, x, y)); if (i >= 0) { if (i === 0) return true; this.press(i); } return false; },
    draw(c, ph, a) {
      const techo = devOf(g) === 'techo';
      const fmt = (f) => { const cs = Math.floor((f * 100) / 60); return `${String(Math.floor(cs / 6000)).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
      if (techo) { box(c, a.x + 14, a.y + 14, a.w - 28, 58, 6, '#a8b890', '#3a3a4a'); }
      T(c, fmt(this.el), a.x + a.w / 2, a.y + 26, 24, techo ? '#26301e' : '#ffffff', 'center');
      T(c, this.run ? '計測中' : this.el ? 'ストップ' : '', a.x + a.w / 2, a.y + 56, 12, techo ? '#3a4a2a' : '#8ad0ff', 'center');
      this.laps.forEach((l, i) => T(c, `ラップ${this.laps.length - i}　${fmt(l)}`, a.x + 24, a.y + 84 + i * 16, 12, techo ? PC.text : '#c8d8e8'));
      this.btns = buttons(c, a, [this.run ? 'ストップ' : 'スタート', 'ラップ', 'リセット'], this.run ? 0 : -1, TIMER_COLOR);
    },
  });
}
async function runFlow(g) {
  const list = has(g, 'netaList') ? safe(() => g.netaList(), []) || [] : [];
  if (!list.length) { await phoneInfo(g, { title: '通し稽古', color: TIMER_COLOR, text: 'ネタ帳に台本がない。\n「ネタ帳」で書いてから計ろう。' }); return; }
  const k = await rowsList(g, { title: 'どのネタを通す？', color: TIMER_COLOR, items: list.slice(0, 30).map((n) => { const why = runWhy(g, n); return { label: n.title || '無題', sub: why || `推定${mmss(scriptLength(n))}・目安${mmss(num(n.target, scriptLength(n)))}・仕上がり${num(n.practice)}`, disabled: !!why, why }; }) });
  if (k < 0) return;
  const r = runThrough(g, list[k].id);
  if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: '通し稽古', color: TIMER_COLOR, text: r.why }); return; }
  audio.sfx('good');
  await playback(g, true);
}
// the recording: the parts as a bar, the 噛み marks, the time against the target
function playback(g, fresh = false) {
  const L = part(g, 'timer').last;
  if (!L) return phoneInfo(g, { title: '録音', color: TIMER_COLOR, text: 'まだ録音がない。' });
  const cols = ['#d6463a', '#e0a020', '#3a8ac0', '#5a9a5a', '#8a5ac8', '#c0562a', '#4a6a8a'];
  return phoneView(g, {
    title: devOf(g) === 'techo' ? 'カセットを聞く' : '録音を聞く', color: TIMER_COLOR, cancel: true,
    hint: 'A/B:もどる',
    update(ph, inp) { if (inp.pressed('a') || inp.pressed('b')) { audio.sfx('cancel'); ph.back(true); } },
    draw(c, ph, a) {
      R(c, a.x, a.y, a.w, a.h, '#f6f8fa');
      T(c, fitText(c, L.title, a.w - 16, 14), a.x + 8, a.y + 4, 14, PC.text);
      const diff = L.sec - L.target;
      T(c, mmss(L.sec), a.x + 8, a.y + 24, 24, TIMER_COLOR);
      T(c, `目安 ${mmss(L.target)}`, a.x + a.w - 8, a.y + 26, 12, PC.dim, 'right');
      T(c, `${diff >= 0 ? '+' : '−'}${Math.round(Math.abs(diff))}秒`, a.x + a.w - 8, a.y + 42, 12, Math.abs(diff) <= Math.max(5, L.target * 0.05) ? PC.good : PC.bad, 'right');
      // the tape: parts and 噛み
      const x0 = a.x + 8, w = a.w - 16, y0 = a.y + 62;
      let x = x0;
      L.parts.forEach((p, i) => { const pw = Math.max(2, Math.round((p.sec / Math.max(1, L.sec)) * w)); R(c, x, y0, Math.min(pw, x0 + w - x), 12, cols[i % cols.length]); x += pw; });
      for (const f of L.flubAt || []) { const fx = x0 + Math.round((f / Math.max(1, L.sec)) * w); R(c, fx, y0 - 4, 2, 20, '#20202a'); }
      const ph2 = (this.t * 2) % w; R(c, x0 + ph2, y0 + 14, 3, 3, '#20202a');
      let y = y0 + 22;
      L.parts.forEach((p, i) => { if (y > a.y + a.h - 60) return; R(c, x0, y + 3, 8, 8, cols[i % cols.length]); T(c, `${p.label}`, x0 + 12, y, 12, PC.text); T(c, mmss(p.sec), x0 + w, y, 12, PC.dim, 'right'); y += 15; });
      const note = [`推定（台本）${mmss(L.est)}・噛み${L.flubs}回`, fresh ? '通し稽古で、ネタが少し体になじんだ。' : `${L.day}日目の録音`];
      note.forEach((s, i) => T(c, fitText(c, s, a.w - 16, 12), a.x + 8, a.y + a.h - 36 + i * 16, 12, PC.dim));
    },
  });
}

// ======================================================================== お笑い用語じてん
// [word, reading, category, definition, in this game (optional), from year (optional)]
export const YOUGO = [
  ['ツカミ', 'つかみ', 'ネタ', 'ネタの最初で客の心をつかむ笑い。はじめの数十秒で客席を味方にできるかが勝負。', 'AI採点では「ツカミ」の早さも見られる。'],
  ['フリ', 'ふり', 'ネタ', '後の笑いのために、前もって状況や期待をつくっておくこと。「フリが効いている」と言う。'],
  ['ボケ', 'ぼけ', 'ネタ', '常識からずれたことを言ったりしたりして、笑いを生む役。'],
  ['ツッコミ', 'つっこみ', 'ネタ', 'ボケのおかしさを指摘して、笑いどころをはっきりさせる役。'],
  ['天丼', 'てんどん', 'ネタ', '同じボケをくり返して笑いを取ること。天丼にエビが2本のることから、と言われる。', '台本のビート「天丼」。AI採点で構成として評価される。'],
  ['かぶせ', 'かぶせ', 'ネタ', '前のボケやツッコミに、さらにボケを重ねること。'],
  ['ノリツッコミ', 'のりつっこみ', 'ネタ', 'いったんボケに乗っかってから、我に返ってツッコむこと。'],
  ['すかし', 'すかし', 'ネタ', '期待される反応やツッコミを、わざとしないことで笑いにする技。'],
  ['伏線', 'ふくせん', 'ネタ', '後で回収するために、前もって仕込んでおくセリフや動き。回収すると大きな笑いになる。', '台本のビート「伏線」「回収」。'],
  ['オチ', 'おち', 'ネタ', '話やネタの最後をしめる笑い。'],
  ['間', 'ま', 'ネタ', 'セリフとセリフのあいだの時間。同じネタでも、間ひとつでウケ方が変わる。', '能力「間・テンポ」。通し稽古のタイムのぶれにも出る。'],
  ['尺', 'しゃく', '舞台', 'ネタや番組、コーナーの長さ（時間）。「尺が余る」「尺オーバー」などと言う。', 'ネタ時計の通し稽古で、本番の長さを計れる。'],
  ['噛む', 'かむ', '舞台', 'セリフをつっかえたり、言いまちがえたりすること。', '能力「声量・滑舌」が高いと噛みにくい。'],
  ['スベる', 'すべる', '舞台', 'ネタやボケがウケないこと。反対は「ウケる」。'],
  ['鉄板', 'てっぱん', 'ネタ', '必ずウケる定番のネタや話。'],
  ['香盤', 'こうばん', '業界', '出演者の出番や役、時間の段取りを一覧にした表（香盤表）。劇場や撮影現場で使う。'],
  ['出囃子', 'でばやし', '舞台', '芸人が舞台に出てくるときに流れる音楽。寄席では三味線や太鼓の生演奏で、落語家ごとに曲が決まっている。'],
  ['出番', 'でばん', '舞台', '舞台に出る順番、または出る時間。'],
  ['板付き', 'いたつき', '舞台', '幕が開いたり明かりがついたりしたとき、すでに舞台の上にいること。コントの始まりに多い。'],
  ['暗転', 'あんてん', '舞台', '照明を消して場面を変えること。コントの場面転換で使う。'],
  ['袖', 'そで', '舞台', '舞台の左右の、客席から見えない場所（舞台袖）。出番前の芸人が待つ。'],
  ['前説', 'まえせつ', 'テレビ', '番組の収録や公演の前に、客席を温めたり注意を伝えたりする役目。若手の仕事のことが多い。'],
  ['ひな壇', 'ひなだん', 'テレビ', 'バラエティ番組で、段になった席にずらりと並ぶ出演者たち。', null, 2000],
  ['ガヤ', 'がや', 'テレビ', 'ひな壇などから、合いの手やリアクションで場を盛り上げること。'],
  ['営業', 'えいぎょう', '業界', '劇場やテレビ以外の、イベントや地方の催しでネタをする仕事。'],
  ['ネタ見せ', 'ねたみせ', '業界', '作家や劇場の社員などにネタを見せて、アドバイスや出演の判断をもらうこと。', 'NSCの授業にもある。'],
  ['ネタ合わせ', 'ねたあわせ', '業界', 'コンビやトリオで、ネタを合わせて練習すること。', 'ネタ帳の「ネタ合わせ」で仕上がりが上がる。'],
  ['単独ライブ', 'たんどくらいぶ', '業界', 'そのコンビや芸人だけで行うライブ。'],
  ['賞レース', 'しょうれーす', '業界', '優勝を争うお笑いの大会。', '「賞レース」アプリで、エントリーや日程を見られる。'],
  ['敗者復活戦', 'はいしゃふっかつせん', '業界', '予選で落ちた組がもう一度戦い、決勝への切符を争う戦い。'],
  ['笑神籤', 'えみくじ', '業界', 'M-1グランプリの決勝で、出番順をその場で引くくじ。2017年から。', null, 2017],
  ['芸歴', 'げいれき', '業界', '芸人としてデビューしてからの年数。先輩・後輩は芸歴で決まることが多い。', '大会の出場資格（結成年数・芸歴）にも関わる。'],
  ['兄さん・姉さん', 'にいさん', '業界', '芸人の世界で、先輩芸人を呼ぶときの言い方。'],
  ['ピン', 'ぴん', '業界', 'ひとりで活動する芸人。'],
  ['しゃべくり漫才', 'しゃべくりまんざい', 'ネタ', '役に入らず、会話だけで笑わせる漫才。'],
  ['漫才コント', 'まんざいこんと', 'ネタ', '漫才の途中で役に入り、コントのように演じる形。'],
  ['楽屋落ち', 'がくやおち', 'ネタ', '内輪にしかわからない笑い。お客さんには伝わりにくい。'],
  ['大喜利', 'おおぎり', 'ネタ', 'お題に対して、おもしろい答えを出しあう芸。'],
  ['フリップ', 'ふりっぷ', 'ネタ', '文字や絵をかいた大きな紙のボード。フリップ芸で使う。'],
  ['寄席', 'よせ', '寄席', '落語や漫才、色物などを毎日見せる演芸場。'],
  ['色物', 'いろもの', '寄席', '寄席で、落語・講談以外の芸。漫才、奇術、紙切り、曲芸など。'],
  ['高座', 'こうざ', '寄席', '寄席で落語家が座って話す、一段高い場所。'],
  ['まくら', 'まくら', '寄席', '落語の本題に入る前の、軽い世間話や小話。'],
  ['サゲ', 'さげ', '寄席', '落語の最後のオチ。「落ち」とも言う。'],
];
export function yougoList(g) { const y = yearOf(g); return YOUGO.filter((w) => !w[5] || y >= w[5]).slice().sort((a, b) => a[1].localeCompare(b[1], 'ja')); }
const YOUGO_TABS = ['全部', 'ネタ', '舞台', 'テレビ', '業界', '寄席'];
export async function yougoApp(g) {
  let tab = 0;
  const rows = () => yougoList(g).filter((w) => !tab || w[2] === YOUGO_TABS[tab]).map((w) => ({ w, label: w[0], sub: w[3], chip: [w[2], { ネタ: '#c0562a', 舞台: '#3a6a8a', テレビ: '#d0304a', 業界: '#6a5aa8', 寄席: '#2f8a5e' }[w[2]] || '#8a8a96'] }));
  return phoneView(g, panelView(g, {
    title: 'お笑い用語', color: YOUGO_COLOR, top: 22, rowH: 38,
    hint: '←→:分類　A:くわしく　B:もどる',
    items: rows,
    update(ph, inp, v) {
      if (inp.repeat('left') || inp.repeat('right')) { tab = (tab + (inp.repeat('left') ? YOUGO_TABS.length - 1 : 1)) % YOUGO_TABS.length; v.idx = 0; v.topRow = 0; v.sy = 0; audio.sfx('cursor'); return true; }
      return false;
    },
    tapTop(ph, x, y, v) { const a = v.area; const w = a.w / YOUGO_TABS.length; const i = Math.floor((x - a.x) / w); if (i >= 0 && i < YOUGO_TABS.length) { tab = i; v.idx = 0; v.topRow = 0; v.sy = 0; audio.sfx('cursor'); } return false; },
    drawTop(c, a) {
      const w = a.w / YOUGO_TABS.length;
      YOUGO_TABS.forEach((s, i) => { const on = i === tab; R(c, a.x + i * w, a.y, w, a.h, on ? YOUGO_COLOR : '#efe6d8'); T(c, s, a.x + i * w + w / 2, a.y + 4, 12, on ? '#ffffff' : PC.text, 'center'); });
    },
    pick: (ph, it, i, v) => ph.run(v, () => phoneInfo(g, { title: it.w[0], color: YOUGO_COLOR, lines: [`【${it.w[0]}】（${it.w[1]}）`, '', it.w[3], it.w[4] ? '' : null, it.w[4] ? `このゲームでは：${it.w[4]}` : null].filter((s) => s != null) })),
  }));
}

// ======================================================================== やること
const BUILTIN = { money: moneyApp, schedule: scheduleApp, messages: messagesApp, contacts: contactsApp };
const appThere = (id) => !!(BUILTIN[id] || (PHONE_APPS[id] && typeof PHONE_APPS[id].open === 'function'));
const openApp = (g, id) => { if (BUILTIN[id]) return safe(() => BUILTIN[id](g), null); const A = PHONE_APPS[id]; return A && typeof A.open === 'function' ? safe(() => A.open(g), null) : null; };
// → [{ id, label, sub, level: 'urgent'|'today'|'hint', app?, done? }]
export function planItems(g) {
  const st = g.state, L = st.life || {}, out = [];
  const add = (level, label, sub, app = null) => out.push({ level, label, sub, app });
  const lb = lifeBlock(g);
  if (lb) add('urgent', 'いまは身動きがとれない', lb.replace(/[（）\n]/g, ''));
  if (num(L.stress) >= BURNOUT) add('urgent', 'ストレスが限界', '今日は休もう（仕事はできない）。ゲームや音楽で気分転換', 'game');
  else if (num(L.stress) >= STRESSED) add('urgent', `ストレス ${Math.round(num(L.stress))}`, `${STRESSED}以上はミニゲームが難しくなる。息抜きを`, 'music');
  if (num(L.hunger) < HUNGRY) add('urgent', 'おなかがペコペコ', '何か食べよう（ミニゲーム −20%・よく眠れない）', 'demae');
  if (st.stamina < st.maxStamina * 0.2) add('urgent', `体力が少ない（${st.stamina}）`, '食事か、家でぐっすり眠ろう');
  if (num(L.clean) < SCRUFFY) add('urgent', '身だしなみが乱れている', 'お風呂や銭湯でさっぱり（仕事の評価が下がる）');
  const debt = num(st.rent && st.rent.debt);
  const rent = safe(() => g.housing().rent, 0) || 0;
  if (debt > 0) add('urgent', `家賃の滞納 ${fmtMoney(debt)}`, '家計アプリで払える', 'money');
  else if (weekdayOf(st.day) === 6 && st.money < rent) add('urgent', `明日（月曜）は家賃 ${fmtMoney(rent)}`, `所持金 ${fmtMoney(st.money)}。足りない分を用意しよう`, 'kyujin');
  else if (weekdayOf(st.day) === 6 && rent) add('today', `明日は家賃 ${fmtMoney(rent)}`, '所持金は足りている');
  for (const id of has(g, 'regularsToday') ? safe(() => g.regularsToday(), []) || [] : []) { const r = REGULARS[id]; if (r) add('today', `レギュラー『${r.title}』`, '今日が出番の日', 'schedule'); }
  const offers = arr(st.phone && st.phone.inbox).filter((m) => m && m.kind === 'offer' && !m.answered).length;
  if (offers) add('today', `お仕事のオファー ${offers}件`, '返事を待っている', 'jobs');
  if (has(g, 'contests')) for (const c of (safe(() => g.contests(), []) || []).filter((x) => x && x.entry && x.nextRound && Number.isFinite(Number(x.nextRound.day))).slice(0, 3)) {
    const left = num(c.nextRound.day) - st.day;
    if (left >= 0 && left <= 3) add(left === 0 ? 'urgent' : 'today', `${(c.def && (c.def.short || c.def.name)) || c.id} ${c.nextRound.name || ''}`, left === 0 ? '今日が本番！' : `あと${left}日。通し稽古で尺を確認`, left === 0 ? 'shourace' : 'netatimer');
  }
  const nsc = has(g, 'nsc') ? safe(() => g.nsc(), null) : null;
  if (nsc && nsc.status === 'enrolled' && weekdayOf(st.day) < 6) add('today', 'NSCの授業', '月曜〜土曜。出席が成績になる', 'map');
  // hints
  const V = part(g, 'video'), J = part(g, 'job'), Tm = part(g, 'timer');
  if (st.money < Math.max(3000, rent) && J.day !== st.day) add('hint', '今日のバイト', 'お金が心もとない。単発のバイトで食いつなぐ', 'kyujin');
  if ((has(g, 'netaList') ? (safe(() => g.netaList(), []) || []).length : 0) > 0 && (Tm.day !== st.day || !Tm.runs)) add('hint', '通し稽古', 'ネタのタイムを計って、仕上がりを少し上げる', 'netatimer');
  if (PHONE_APPS.douga && safe(() => PHONE_APPS.douga.cond ? PHONE_APPS.douga.cond(g) : true, false) && V.lastPost !== st.day && devOf(g) !== 'techo') add('hint', '動画を1本', '再生がのびればファンがふえる', 'douga');
  if (PHONE_APPS.dotter && num(st.phone && st.phone.lastPost) !== st.day) add('hint', '今日の投稿', 'ファンに近況をとどけよう', 'dotter');
  return out;
}
export const planBadge = (g) => { try { return planItems(g).filter((x) => x.level === 'urgent').length; } catch (e) { return 0; } };
const LEVEL = { urgent: ['急ぎ', '#d6304a'], today: ['今日', '#3a7ac0'], hint: ['おすすめ', '#5a9a5a'], todo: ['ToDo', '#c8a020'] };
export async function planApp(g) {
  const M = part(g, 'memo');
  const rows = () => {
    const st = g.state;
    const out = planItems(g).map((x) => ({ ...x, chip: LEVEL[x.level], right: x.app && appThere(x.app) ? '›' : '' }));
    const todos = M.list.filter((m) => m.tag === 'todo');
    for (const m of todos) out.push({ level: 'todo', m, label: `${m.done ? '☑' : '☐'} ${m.title}`, sub: m.done ? 'すんだ' : `${m.day}日目に書いた`, chip: LEVEL.todo, subColor: m.done ? PC.good : PC.dim });
    out.push({ level: 'add', label: 'ToDoを書く', chip: ['＋', '#c8a020'] });
    if (todos.some((m) => m.done)) out.push({ level: 'clear', label: 'すんだToDoを消す' });
    return out;
  };
  return phoneView(g, panelView(g, {
    title: 'やること', color: PLAN_COLOR, top: 30, rowH: 38, items: rows,
    hint: 'A:ひらく・チェック　B:もどる',
    drawTop(c, a) {
      const st = g.state, d = dateOf(g);
      R(c, a.x, a.y, a.w, a.h, devOf(g) === 'techo' ? '#f2ead0' : '#eef6ea');
      T(c, `${d.year}年${d.month}月・${st.day}日目（${WEEKDAYS[weekdayOf(st.day)]}）`, a.x + 8, a.y + 3, 12, PC.text);
      T(c, `体力${st.stamina}・満腹${Math.round(num(st.life.hunger))}・ストレス${Math.round(num(st.life.stress))}`, a.x + 8, a.y + 15, 12, PC.dim);
      R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
    },
    pick: (ph, it, i, v) => ph.run(v, async () => {
      if (it.level === 'add') { const s = await askText(g, { title: 'ToDo', value: '', max: 30 }); if (s) addMemo(g, { text: s, title: s, tag: 'todo' }); return; }
      if (it.level === 'clear') { M.list = M.list.filter((m) => !(m.tag === 'todo' && m.done)); return; }
      if (it.m) { it.m.done = !it.m.done; audio.sfx(it.m.done ? 'good' : 'cursor'); return; }
      if (it.app && appThere(it.app)) await openApp(g, it.app);
      else await phoneInfo(g, { title: it.label, color: PLAN_COLOR, text: it.sub || '' });
    }),
  }));
}
