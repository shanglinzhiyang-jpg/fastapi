// AI審査員 — the local scoring model for the scripts the player writes (owner: B). Pure JS, no DOM, no network,
// deterministic (the same script always gets the same result). node imports it for the unit tests.
//
//   scoreLocal(neta, ctx?) → ai   ctx: { target (sec), era, year, others: [Neta] (the player's other scripts), names }
//   estimate(neta, ctx?)   → { sec, lines, punches, perMin, chars, target, over }      (cheap: the editor's live numbers)
//   structureCheck(neta)   → [{ id, label, ok, note }]                                 (the editor's checklist)
//   inferBeats(neta)       → beats[] for lines without one (the editor's 「ビートを自動でつける」 too)
//   KINDS, AXES, AXES_BY_KIND, JUDGES, rankLabel(total), netaHash(neta), mmss(sec)
//
// How it reads a script (Japanese, no morphological analyser):
//   * lines → punch lines (ボケ: beats boke/tendon/kaishu/ochi/answer/sage, or a ボケ answered by a ツッコミ),
//     ツッコミ lines, the rest (フリ・設定・展開・ト書き). Missing beats are inferred.
//   * 尺: characters / speaking rate per kind (漫才 ≈ 7 字/秒, 落語 ≈ 5 字/秒, …) + pauses + laughs.
//   * 発想・意外性: a compact category lexicon (neta_lex.js CATS); distance between the categories of a ボケ and of its
//     setup (theme + the two lines before it). Best: one foot in the setup, one far away (ズレ). Same category = ベタ;
//     no link at all = 飛びすぎ.
//   * 言葉選び: wordplay seen in kana (ダジャレの音のくり返し, 一字ちがいの言い間違い, 語呂合わせ), concrete nouns and numbers,
//     line lengths, anachronisms for the era, fluency.
//   * ツッコミの質: 例えツッコミ (「〜か！」 after a noun), ノリツッコミ, specific wording vs stock 「なんでやねん」.
//   * 天丼・伏線回収: phrases said again in later punch lines; early nouns that come back late (in the オチ = best).
//   * 独自性: stock jokes, stock ツッコミ, 4-gram overlap with the built-in bank (部品の丸写し) and with the player's
//     other scripts (使い回し).
//   * nonsense guards: kana / kanji bigrams unknown to a model built from the bank (random characters), repeated
//     characters, one line repeated, empty, very long lines → low scores with the matching comments.
// Five fictional judges with their own tastes weight the axes; the total is their mean, with caps for nonsense,
// repetition, copying and length.

import {
  lexHits, catDist, CLICHE_TSUKKOMI, CLOSERS, CLICHE_JOKES, META_RE, ARUARU_RE, JIGYAKU_RE, KOCHOU_RE, TWIST_RE, TENKAI_RE,
  NORI_RE, KANCHI_RE, TATOE_TAIL, KANSAI_RE, STD_RE, RAKUGO_RE, SAGE_RE, FIRST_RE, ANACHRO, STOP_NOUNS,
} from './neta_lex.js';
import { bankCorpus, hashStr, ERA_YEAR } from './neta_bank.js';

export const VERSION = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R = Math.round;
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

// rate: characters per second; pause: after each line; laugh: after a punch line; ppm: ideal punch lines per minute;
// gap: the longest stretch without a laugh that still feels fine (sec); maxLine: a punch line longer than this drags.
export const KINDS = {
  manzai: { label: '漫才', rate: 7.0, pause: 0.35, laugh: 0.8, ppm: [5, 10], gap: 16, maxLine: 45, def: 240 },
  conte: { label: 'コント', rate: 5.5, pause: 0.7, laugh: 1.1, ppm: [3, 7.5], gap: 25, maxLine: 50, def: 300 },
  pin: { label: 'ピン芸', rate: 6.5, pause: 0.6, laugh: 1.0, ppm: [4, 9], gap: 20, maxLine: 60, def: 240 },
  rakugo: { label: '落語', rate: 5.0, pause: 0.6, laugh: 1.0, ppm: [1.2, 4.5], gap: 50, maxLine: 90, def: 900 },
  ogiri: { label: '大喜利', rate: 6.0, pause: 2.5, laugh: 1.5, ppm: [3, 9], gap: 25, maxLine: 30, def: 120 },
  utaneta: { label: '歌ネタ', rate: 4.0, pause: 0.6, laugh: 1.0, ppm: [2.5, 7], gap: 25, maxLine: 60, def: 180 },
  monomane: { label: 'ものまね', rate: 5.5, pause: 0.8, laugh: 1.0, ppm: [3, 8], gap: 22, maxLine: 60, def: 180 },
  talk: { label: 'エピソードトーク', rate: 6.5, pause: 0.4, laugh: 1.2, ppm: [0.8, 3.5], gap: 45, maxLine: 90, def: 120 },
};
const kindOf = (k) => (KINDS[k] ? k : 'manzai');

export const AXES = {
  tsukami: 'ツカミ', kousei: '構成', hassou: '発想・意外性', kotoba: '言葉選び', tsukkomi: 'ツッコミの質', tempo: '手数とテンポ',
  tendon: '天丼・伏線回収', dokuji: '独自性', chara: 'キャラ', shaku: '尺の適正', sage: 'サゲ', enji: '人物の演じ分け', mijika: '回答の短さ',
  kyori: 'お題との距離', settei: '設定の強さ', uragiri: '裏切り', uta: '歌のリズム', nisete: '特徴の誇張', rinjou: '臨場感', hitori: '一人で成立',
};
export const AXES_BY_KIND = {
  manzai: ['tsukami', 'kousei', 'hassou', 'kotoba', 'tsukkomi', 'tempo', 'tendon', 'dokuji', 'chara', 'shaku'],
  conte: ['tsukami', 'kousei', 'settei', 'uragiri', 'hassou', 'kotoba', 'tempo', 'tendon', 'dokuji', 'chara', 'shaku'],
  pin: ['tsukami', 'kousei', 'hassou', 'kotoba', 'hitori', 'tempo', 'tendon', 'dokuji', 'chara', 'shaku'],
  rakugo: ['tsukami', 'kousei', 'hassou', 'kotoba', 'enji', 'sage', 'tempo', 'dokuji', 'chara', 'shaku'],
  ogiri: ['tsukami', 'hassou', 'kyori', 'mijika', 'kotoba', 'tempo', 'dokuji'],
  utaneta: ['tsukami', 'kousei', 'hassou', 'kotoba', 'uta', 'tendon', 'dokuji', 'chara', 'shaku'],
  monomane: ['tsukami', 'kousei', 'nisete', 'hassou', 'kotoba', 'tempo', 'dokuji', 'chara', 'shaku'],
  talk: ['tsukami', 'kousei', 'rinjou', 'hassou', 'kotoba', 'tempo', 'dokuji', 'chara', 'shaku'],
};
// All fictional. w: axis weights (others 1).
export const JUDGES = [
  { id: 'dan', name: '段 組彦', title: '放送作家', taste: '構成派', w: { kousei: 3, tsukami: 2, shaku: 2, tendon: 2, sage: 2, settei: 1.5, uragiri: 1.5, tempo: 1.5 }, bias: -1, spread: 1.0 },
  { id: 'tobishima', name: '飛島 ゲン', title: 'ベテラン漫才師', taste: '発想派', w: { hassou: 3, dokuji: 2, uragiri: 2, settei: 2, kyori: 2, nisete: 1.5 }, bias: 0, spread: 1.15 },
  { id: 'koiki', name: '言之葉亭 小粋', title: '落語家', taste: '言葉派', w: { kotoba: 3, tsukkomi: 2.5, enji: 2.5, sage: 2, chara: 1.5, mijika: 1.5, uta: 2, rinjou: 1.5 }, bias: -1, spread: 1.0 },
  { id: 'emihara', name: '笑原 よし江', title: '劇場支配人', taste: '大衆派', w: { tsukami: 2.5, tempo: 2.5, chara: 2, kousei: 1.5, hitori: 1.5, rinjou: 1.5, nisete: 1.5 }, bias: 3, spread: 0.9 },
  { id: 'shindo', name: '新堂 斬', title: 'お笑い評論家', taste: '新しさ派', w: { dokuji: 3.5, hassou: 2.5, uragiri: 1.5, tendon: 1 }, bias: -4, spread: 1.25 },
];
const RANKS = [[90, '優勝候補'], [82, '決勝レベル'], [74, '準決勝レベル'], [66, '準々決勝レベル'], [56, '3回戦レベル'], [46, '2回戦レベル'], [32, '1回戦レベル'], [18, 'ネタ見せで止まるレベル'], [0, '台本になっていない']];
export const rankLabel = (t) => (RANKS.find(([m]) => t >= m) || RANKS[RANKS.length - 1])[1];
export const mmss = (sec) => { const s = Math.max(0, R(sec)); return `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`; };

const PUNCH_BEATS = new Set(['boke', 'tendon', 'kaishu', 'ochi', 'answer', 'sage']);
const MAX_LINES = 400;
const MAX_CHARS = 400;

// ------------------------------------------------------------------ text helpers
const PUNCT = /[\s、。，．・：；？！!?…‥「」『』（）()【】〔〕〈〉《》〜～ー―\-.,:;"'’”“＊*／/]/g;
const normN = (s) => String(s || '').normalize('NFKC').replace(PUNCT, '');
const toHira = (s) => String(s || '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanji = (c) => /[一-鿿々〆ヶ]/.test(c);
const isKana = (c) => /[ぁ-ゖァ-ヺー]/.test(c);
const isJP = (c) => isKanji(c) || isKana(c) || /[、。！？「」『』（）…・〜～]/.test(c);
const TOK_RE = /[一-鿿々〆ヶ]+|[ァ-ヺー]+|[A-Za-z][A-Za-z0-9\-]*|[0-9]+|[ぁ-ゖ]+/gu;
const tokens = (s) => String(s || '').match(TOK_RE) || [];
const short = (s, n = 16) => { const a = Array.from(String(s || '').replace(/\s+/g, ' ')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
export function netaHash(n) {
  if (!n) return 0;
  const body = (n.lines || []).map((l) => `${l.role}|${l.beat || ''}|${l.text || ''}`).join('\n');
  return hashStr(`${n.kind}\n${n.title || ''}\n${n.theme || ''}\n${n.setting || ''}\n${n.target || ''}\n${body}`);
}
function grams(s, n) { const a = Array.from(s); const out = []; for (let i = 0; i + n <= a.length; i++) out.push(a.slice(i, i + n).join('')); return out; }

// The bank as 4-grams (copy check) and the language model (bigrams of real Japanese) — built once.
let BANK = null;
function bank() {
  if (BANK) return BANK;
  const g4 = new Set();
  const bi = new Set();
  for (const s of bankCorpus()) {
    const n = normN(s);
    for (const g of grams(n, 4)) g4.add(g);
    const a = Array.from(String(s).normalize('NFKC'));
    for (let i = 0; i + 1 < a.length; i++) if (isJP(a[i]) && isJP(a[i + 1]) && !/[、。！？「」]/.test(a[i] + a[i + 1])) bi.add(toHira(a[i] + a[i + 1]));
  }
  // everyday function bigrams the bank might miss
  for (const w of 'です ます した して いる ない から けど って ので よね ちゃ じゃ たら れば だけ でも まで こと もの ため とか なん だっ かっ ませ でし まし てい てる いま あり おり なり くれ もら あげ やっ ちょ っと すご ほん とう もう まだ'.split(' ')) bi.add(w);
  BANK = { g4, bi };
  return BANK;
}
// share of a text's 4-grams found in a set (0..1); short lines (< 6 chars) are not judged
function overlap(text, set) {
  const n = normN(text);
  if (Array.from(n).length < 6) return 0;
  const gs = grams(n, 4);
  if (!gs.length) return 0;
  let k = 0;
  for (const g of gs) if (set.has(g)) k++;
  return k / gs.length;
}
// 0..1: how much a line reads as Japanese (random characters, mashed keys → low)
function fluency(text) {
  const a = Array.from(String(text || '').normalize('NFKC'));
  const n = a.length;
  if (!n) return 0;
  if (n <= 4) return a.some(isJP) ? 0.85 : 0.5;
  const B = bank().bi;
  let jp = 0, kan = 0, hira = 0, pairs = 0, known = 0, longK = 0, run = 0, maxRep = 1, rep = 1;
  for (let i = 0; i < n; i++) {
    const c = a[i];
    if (isJP(c)) jp++;
    if (isKanji(c)) { kan++; run++; } else { if (run >= 6) longK += run; run = 0; }
    if (/[ぁ-ゖ]/.test(c)) hira++;
    if (i && c === a[i - 1]) { rep++; maxRep = Math.max(maxRep, rep); } else rep = 1;
    if (i + 1 < n && isJP(c) && isJP(a[i + 1]) && !/[、。！？「」『』（）…・〜～]/.test(c + a[i + 1])) { pairs++; if (B.has(toHira(c + a[i + 1]))) known++; }
  }
  if (run >= 6) longK += run;
  const jpRatio = jp / n;
  let kn = pairs >= 3 ? known / pairs : 0.75;
  if (!hira && n >= 6) kn = Math.min(kn, 0.25); // Japanese sentences almost always have hiragana
  const distinct = new Set(a).size / n;
  let f = 0.55 * kn + 0.3 * jpRatio + 0.15 * (kan ? 1 - longK / kan : 1);
  if (n >= 8 && distinct < 0.3) f *= 0.4;
  if (maxRep >= 5) f *= 0.4;
  return clamp(f, 0, 1);
}
const isAction = (l) => l.role === 'narr' && /^[（(]/.test(l.text);

// ------------------------------------------------------------------ beats
export function inferBeats(neta) {
  const kind = kindOf(neta && neta.kind);
  const L = ((neta && neta.lines) || []).map((l) => ({ role: l.role, text: String(l.text || '').trim() }));
  const n = L.length;
  const out = new Array(n).fill('');
  const tskLike = (i) => i >= 0 && i < n && (L[i].role === 'tsukkomi' || (kind === 'conte' && i > 0 && L[i].role !== L[i - 1].role && L[i].role !== 'narr' && Array.from(L[i].text).length <= 22 && /[！!？?]$/.test(L[i].text)));
  const marks = (t) => KOCHOU_RE.test(t) || TWIST_RE.test(t) || /…|！$/.test(t);
  for (let i = 0; i < n; i++) {
    const { role, text } = L[i];
    const pos = n > 1 ? i / (n - 1) : 0;
    if (!text) continue;
    if (kind === 'ogiri') { out[i] = 'answer'; continue; }
    if (kind === 'manzai' || kind === 'conte') {
      if (role === 'narr') { out[i] = pos < 0.25 ? 'setup' : 'tenkai'; continue; }
      if (tskLike(i)) { out[i] = i >= n - 1 ? 'ochi' : 'tsukkomi'; continue; }
      if (tskLike(i + 1)) { out[i] = i >= n - 3 ? 'ochi' : i <= 2 ? 'tsukami' : 'boke'; continue; }
      out[i] = TENKAI_RE.test(text) && pos > 0.25 ? 'tenkai' : i === 0 ? 'tsukami' : 'setup';
      continue;
    }
    if (kind === 'rakugo') {
      if (i >= n - 1 || (i >= n - 2 && pos > 0.8)) { out[i] = 'sage'; continue; }
      if (role === 'narr' && pos < 0.3 && !RAKUGO_RE.test(text)) { out[i] = 'makura'; continue; }
      out[i] = marks(text) && role !== 'narr' ? 'boke' : 'hondai';
      continue;
    }
    if (i === n - 1) { out[i] = 'ochi'; continue; }
    if (kind === 'talk') { out[i] = pos < 0.3 ? 'setup' : marks(text) && pos > 0.4 ? 'boke' : 'tenkai'; continue; }
    if (i === 0) { out[i] = FIRST_RE.test(text) ? 'tsukami' : 'setup'; continue; }
    out[i] = role === 'narr' && kind !== 'pin' ? 'setup' : marks(text) || role === 'narr' ? 'boke' : 'setup';
  }
  return out;
}

// ------------------------------------------------------------------ analysis
function analyze(neta, ctx = {}) {
  const kind = kindOf(neta.kind);
  const K = KINDS[kind];
  const year = ctx.year || ERA_YEAR[ctx.era] || 0;
  const src = (neta.lines || []).slice(0, MAX_LINES);
  const inferred = inferBeats({ kind, lines: src });
  const lines = [];
  src.forEach((l, i) => {
    let text = String((l && l.text) || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (Array.from(text).length > MAX_CHARS) text = Array.from(text).slice(0, MAX_CHARS).join('');
    lines.push({ i, role: l.role || (kind === 'manzai' ? 'boke' : 'pin'), beat: l.beat || inferred[i] || '', text, twistFlag: !!l.twist, n: Array.from(text).length });
  });
  const B = bank();
  const head = `${neta.title || ''} ${neta.theme || ''} ${neta.setting || ''}`;
  const headHits = lexHits(head);
  const headCats = [...new Set(headHits.flatMap((h) => h.cats))];
  // the player's other scripts (4-grams), for 使い回し
  const own = new Set();
  for (const o of ctx.others || []) if (o && o.id !== neta.id) for (const l of o.lines || []) for (const g of grams(normN(l.text), 4)) own.add(g);
  const seen = new Map();
  for (const L of lines) {
    const t = L.text;
    L.action = isAction(L);
    L.flu = L.action ? Math.max(0.7, fluency(t.replace(/[（）()]/g, ''))) : fluency(t);
    L.nonsense = L.flu < 0.5;
    L.hits = lexHits(t);
    L.cats = [...new Set(L.hits.flatMap((h) => h.cats))];
    const toks = tokens(t);
    L.nouns = new Set([...L.hits.map((h) => h.w), ...toks.filter((w) => (isKanji(w[0]) && w.length >= 2) || (/[ァ-ヺ]/.test(w[0]) && w.length >= 3))].filter((w) => !STOP_NOUNS.has(w)));
    L.number = /[0-9０-９]|[一二三四五六七八九十百千万]+(?:回|人|個|本|年|日|時間|分|秒|円|キロ|メートル|往復|杯|匹|頭|台|枚|倍|周|件|歩|番|か月|パーセント)/.test(t);
    const nt = normN(t);
    L.norm = nt;
    L.dup = seen.has(nt) && Array.from(nt).length >= 2 ? seen.get(nt) : -1;
    if (!seen.has(nt)) seen.set(nt, L.i);
    L.closer = CLOSERS.some((c) => nt.includes(normN(c)));
    const clicheHit = CLICHE_TSUKKOMI.find((c) => nt.includes(normN(c)));
    L.clicheAny = !!clicheHit;
    L.clicheOnly = !!clicheHit && Array.from(nt).length - Array.from(normN(clicheHit)).length <= 3;
    L.joke = CLICHE_JOKES.some((c) => nt.includes(normN(c)));
    L.meta = META_RE.test(t);
    L.aruaru = ARUARU_RE.test(t);
    L.jigyaku = JIGYAKU_RE.test(t);
    L.kochou = KOCHOU_RE.test(t);
    L.twist = L.twistFlag || TWIST_RE.test(t);
    L.tenkaiMark = TENKAI_RE.test(t);
    L.nori = NORI_RE.test(t);
    L.kanchi = KANCHI_RE.test(t);
    L.kansai = KANSAI_RE.test(t);
    L.std = STD_RE.test(t);
    L.pron = (t.match(/(俺|おれ|オレ|僕|ぼく|ボク|私|わたし|わたくし|あたし|うち|わし|拙者|あっし|わっち|おいら)/g) || []);
    L.quote = /「[^」]{2,}」/.test(t);
    L.copy = L.action ? 0 : overlap(t, B.g4);
    L.selfCopy = own.size && !L.action ? overlap(t, own) : 0;
    L.anachro = year ? ANACHRO.filter(([w, y]) => year < y && t.includes(w)).map(([w]) => w) : [];
    L.person = L.cats.some((c) => ['tech', 'home', 'food', 'weather', 'nature', 'space', 'money', 'shop', 'vehicle', 'drink'].includes(c)) && /しゃべ|言われ|言って|謝られ|謝っ|返事|返され|笑って|泣いて|怒られ|照れ|ほめて|教えて|聞かれ|あいさつ|お礼|認めて/.test(t);
    L.dajare = dajare(t);
  }
  // roles: punch / tsukkomi / other
  const n = lines.length;
  for (let k = 0; k < n; k++) {
    const L = lines[k];
    const next = lines[k + 1];
    const tsk = L.role === 'tsukkomi' || L.beat === 'tsukkomi';
    const prev = lines[k - 1];
    const ochiReply = L.beat === 'ochi' && prev && prev.beat === 'ochi' && prev.role !== L.role && L.n <= 24 && /[！!？?]$/.test(L.text);
    L.tsk = tsk || ochiReply || (L.beat === 'ochi' && L.closer && L.role === 'tsukkomi');
    if (L.tsk) { L.punch = false; continue; }
    const nextTsk = next && (next.role === 'tsukkomi' || next.beat === 'tsukkomi' || (next.beat === 'ochi' && next.role !== L.role && next.n <= 24));
    L.punch = !L.action && (PUNCH_BEATS.has(L.beat) || (L.beat === 'tsukami' && nextTsk) || (!L.beat && nextTsk) || (L.role === 'boke' && nextTsk && L.beat !== 'setup' && L.beat !== 'makura'));
    if (kind === 'rakugo' && L.beat === 'sage' && next && next.beat === 'sage') L.punch = false; // the last サゲ line is the punch
    if (kind === 'rakugo' && L.beat === 'sage' && !next) L.punch = true;
  }
  // timing
  let t = 0;
  for (const L of lines) {
    L.t0 = t;
    const d = L.action ? 1.5 + L.n / 15 : kind === 'ogiri' ? 2.5 + L.n / K.rate : L.n / K.rate + K.pause;
    L.sec = d + (L.punch ? K.laugh : 0);
    t += L.sec;
  }
  const sec = t;
  // per-line context: categories of the head + the two lines before (and the last setup)
  let lastSetup = null;
  for (let k = 0; k < n; k++) {
    const L = lines[k];
    const ctxL = [lines[k - 1], lines[k - 2], lastSetup].filter(Boolean);
    const ctxCats = [...new Set([...headCats, ...ctxL.flatMap((x) => x.cats)])];
    const ctxNouns = new Set(ctxL.flatMap((x) => [...x.nouns]));
    let link = [...L.nouns].some((w) => ctxNouns.has(w));
    let s = 0.3, maxFar = 0.3;
    if (L.cats.length && ctxCats.length) {
      let sum = 0;
      maxFar = 0;
      for (const c of L.cats) { let m = 1; for (const k2 of ctxCats) m = Math.min(m, catDist(c, k2)); sum += m; if (m === 0) link = true; maxFar = Math.max(maxFar, m); }
      s = link ? 0.35 + 0.65 * maxFar : 0.25 + 0.5 * (sum / L.cats.length);
    } else if (L.cats.length) s = 0.5;
    else if (link) s = 0.4;
    s += (L.kochou ? 0.12 : 0) + (L.twist ? 0.1 : 0) + (L.person ? 0.14 : 0) + (L.meta ? 0.05 : 0);
    L.sur = clamp(s, 0, 1);
    L.link = link;
    L.beta = L.punch && link && maxFar < 0.2 && !L.kochou && !L.twist && !L.person;
    L.tobi = L.punch && L.cats.length > 0 && !link && maxFar >= 1 && !L.kochou && !L.person;
    if (L.beat === 'setup' || L.beat === 'makura' || L.beat === 'hondai' || L.role === 'narr') lastSetup = L;
  }
  // 言い間違い (一字ちがい) and 例えツッコミ
  for (let k = 0; k < n; k++) {
    const L = lines[k];
    L.iima = false;
    const near = [lines[k - 1], lines[k + 1]].filter(Boolean);
    const words = (x) => tokens(x.text).filter((w) => (w.length >= 3 && !isKanji(w[0])) || (isKanji(w[0]) && w.length >= 3));
    const mine = words(L);
    if (/「([^」]{2,8})」と「([^」]{2,8})」/.test(L.text)) { const m = L.text.match(/「([^」]{2,8})」と「([^」]{2,8})」/); if (m && edit1(toHira(m[1]), toHira(m[2]))) L.iima = true; }
    for (const o of near) for (const a of mine) for (const b of words(o)) if (a !== b && edit1(toHira(a), toHira(b))) L.iima = true;
    if (L.tsk) {
      const body = L.text.replace(/[！!？?。…]+$/, '');
      const before = body.replace(/(か|かい|かよ|やないか|じゃないか)$/, '');
      const endsKa = before !== body && before.length >= 2;
      const lastTok = endsKa ? (before.match(TOK_RE) || []).pop() || '' : '';
      const nounish = lastTok && (isKanji(lastTok[0]) || /[ァ-ヺ]/.test(lastTok[0]) || /(の|な)[ぁ-ん]{0,3}$/.test(before) === false && lexHits(lastTok).length);
      const prevP = lines[k - 1];
      const newImage = L.hits.some((h) => !prevP || !prevP.text.includes(h.w));
      L.tatoe = (endsKa && nounish && (newImage || !L.hits.length)) || TATOE_TAIL.test(L.text);
      L.spec = prevP ? [...L.nouns].some((w) => prevP.nouns.has(w)) : false;
    }
  }
  return { kind, K, lines, sec, head, headCats, year };
}
function edit1(a, b) {
  a = Array.from(a); b = Array.from(b);
  if (a.length < 3 || b.length < 3 || Math.abs(a.length - b.length) > 1 || a.join('') === b.join('')) return false;
  if (a.length === b.length) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d === 1; }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  let i = 0, j = 0, d = 0;
  while (i < s.length && j < l.length) { if (s[i] === l[j]) { i++; j++; } else { d++; j++; if (d > 1) return false; } }
  return true;
}
// a pun heard in kana: the same 3–5 sounds twice in one line, with different words around them
const FUNC3 = new Set('ました ですよ てます ている ってる んです ません でした てたら ったら ちゃっ じゃな ないで ないよ だよね ですね ますね てくだ くださ ださい ちゃん ところ いいか いうか ってい てるん るんで かった しまっ まった みたい ですか ますか います ありま りまし ないか じゃん ないの んだよ ている てない とこと ことが ことを っても てもら もらっ らって なんで なんだ だから ですけ すけど たんで んでい でいる するの してる してた した しても にいる にいっ いって って もう ました'.split(' '));
function dajare(text) {
  const runs = (String(text).match(/[ぁ-ゖァ-ヺー]+/g) || []).map((r) => toHira(r).replace(/[っッー]/g, ''));
  const all = runs.join('|');
  const a = Array.from(all);
  for (let i = 0; i + 3 <= a.length; i++) {
    const g = a.slice(i, i + 3).join('');
    if (g.includes('|') || FUNC3.has(g)) continue;
    for (let j = i + 3; j + 3 <= a.length; j++) {
      if (a.slice(j, j + 3).join('') !== g) continue;
      let k = 3;
      while (i + k < j && j + k < a.length && a[i + k] === a[j + k] && a[i + k] !== '|') k++;
      if (k <= 5 && (a[i + k] !== a[j + k])) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ scoring
function tsukkomiQuality(L) {
  let q = 50;
  if (L.clicheOnly) q = 22;
  if (L.tatoe) q += 26;
  if (L.nori) q += 24;
  if (L.spec) q += 8;
  if (L.iima) q += 6;
  if (L.hits.length && !L.clicheOnly) q += 6;
  if (L.n >= 3 && L.n <= 18) q += 5; else if (L.n > 30) q -= 12;
  if (/[！!]$/.test(L.text)) q += 2;
  if (L.copy > 0.75) q -= 14;
  if (L.nonsense) q = 5;
  return clamp(q, 0, 100);
}
function punchStrength(L, A, next, extra) {
  const K = A.K;
  let s = 22 + 40 * L.sur;
  if (L.nouns.size) s += 6;
  if (L.number) s += 3;
  if (L.dajare) s += 9;
  if (L.iima) s += 8;
  if (L.aruaru) s += 6;
  if (L.jigyaku) s += 3;
  if (L.meta) s += 3;
  if (extra.callback) s += 12;
  if (extra.tendon) s += 8;
  if (next && next.tsk) s += (tsukkomiQuality(next) - 50) * 0.25;
  if (L.n > K.maxLine) s -= Math.min(18, (L.n - K.maxLine) * 0.5);
  if (L.n < 4 && L.beat !== 'answer') s -= 5;
  if (L.beta) s -= 8;
  if (L.tobi) s -= 4;
  if (L.joke) s -= 30;
  s -= 34 * clamp((L.copy - 0.35) / 0.45, 0, 1);
  s -= 26 * clamp((L.selfCopy - 0.35) / 0.45, 0, 1);
  if (L.dup >= 0) s -= 35;
  if (L.anachro.length) s -= 6;
  if (L.nonsense) s = Math.min(s, 8);
  return clamp(R(s), 0, 100);
}

// 天丼: a phrase (≥ 4 chars, normalized) said in 2+ punch lines, at least two lines apart.
function findTendon(A) {
  const P = A.lines.filter((l) => l.punch || l.tsk);
  const found = new Map();
  for (let x = 0; x < P.length; x++) {
    const a = Array.from(P[x].norm);
    for (let len = Math.min(10, a.length); len >= 4; len--) {
      for (let s = 0; s + len <= a.length; s++) {
        const g = a.slice(s, s + len).join('');
        if (found.has(g) || CLOSERS.some((c) => normN(c).includes(g)) || CLICHE_TSUKKOMI.some((c) => normN(c).includes(g)) || /^(どうも|よろしく|ありがとう|お願いします)/.test(g)) continue;
        const uses = P.filter((p) => p.norm.includes(g));
        if (uses.length >= 2 && uses[uses.length - 1].i - uses[0].i >= 2 && uses.some((u) => u.dup < 0 || u === uses[0])) {
          // keep only the longest phrase per group of lines
          const key = uses.map((u) => u.i).join(',');
          if (![...found.values()].some((v) => v.key === key && v.g.includes(g))) found.set(g, { g, key, uses: uses.map((u) => u.i) });
        }
      }
    }
  }
  // drop phrases contained in a longer found phrase with the same uses
  const list = [...found.values()].filter((v) => ![...found.values()].some((w) => w !== v && w.key === v.key && w.g.length > v.g.length && w.g.includes(v.g)));
  return list.sort((a, b) => b.g.length - a.g.length).slice(0, 4);
}
// 伏線回収: a noun from the first 40% that comes back in the last 35% (not a topic word said everywhere)
function findCallbacks(A) {
  const L = A.lines;
  const n = L.length;
  if (n < 6) return [];
  const cut1 = Math.floor(n * 0.4), cut2 = Math.ceil(n * 0.65);
  const freq = new Map();
  for (const l of L) for (const w of l.nouns) freq.set(w, (freq.get(w) || 0) + 1);
  const headN = new Set(tokens(A.head));
  const early = new Map();
  for (let k = 0; k < cut1; k++) for (const w of L[k].nouns) if (!early.has(w)) early.set(w, k);
  const out = [];
  for (let k = cut2; k < n; k++) {
    if (!L[k].punch) continue;
    for (const w of L[k].nouns) {
      if (!early.has(w) || headN.has(w) || A.head.includes(w) || (freq.get(w) || 0) > Math.max(2, n * 0.3) || Array.from(w).length < 2) continue;
      // not said in between (that would be the topic, not a callback)
      let between = 0;
      for (let m = early.get(w) + 1; m < k; m++) if (L[m].nouns.has(w)) between++;
      if (between > 1) continue;
      out.push({ w, from: L[early.get(w)].i, to: L[k].i, ochi: k >= n - 3 });
    }
  }
  const uniq = [];
  for (const c of out) if (!uniq.some((u) => u.w === c.w)) uniq.push(c);
  return uniq.slice(0, 5);
}

export function scoreLocal(neta, ctx = {}) {
  neta = neta || { kind: 'manzai', lines: [] };
  const A = analyze(neta, ctx);
  const { kind, K, lines, sec } = A;
  const axesIds = AXES_BY_KIND[kind];
  const target = Number(ctx.target || neta.target) || K.def;
  const n = lines.length;
  const res = { version: VERSION, by: 'local', kind, hash: netaHash(neta), axes: {}, reasons: {}, judges: [], comments: [], advice: [], lines: [], best: [], worst: [], stats: {}, total: 0, rank: '', summary: '' };
  if (!n) {
    for (const a of axesIds) { res.axes[a] = 0; res.reasons[a] = '台本が空'; }
    res.judges = JUDGES.map((j) => ({ id: j.id, name: j.name, title: j.title, taste: j.taste, score: 0, comment: '…台本がまだ一行もありませんね。' }));
    res.advice = ['台本が空です。まずはツカミを一行書いてみよう。'];
    res.comments = ['台本が空なので採点できない。'];
    res.rank = rankLabel(0);
    res.summary = '台本が空';
    res.stats = { sec: 0, lines: 0, punches: 0, perMin: 0, target };
    return res;
  }
  const P = lines.filter((l) => l.punch);
  const T = lines.filter((l) => l.tsk);
  const tendon = findTendon(A);
  const callbacks = findCallbacks(A);
  const tendonLines = new Set(tendon.flatMap((x) => x.uses.slice(1)));
  const cbLines = new Set(callbacks.map((c) => c.to));
  for (let k = 0; k < n; k++) {
    const L = lines[k];
    if (L.punch) L.s = punchStrength(L, A, lines[k + 1], { tendon: tendonLines.has(L.i), callback: cbLines.has(L.i) });
    else if (L.tsk) L.s = tsukkomiQuality(L);
    else L.s = clamp(R(45 + (L.nouns.size ? 8 : 0) - (L.n > K.maxLine * 1.6 ? 15 : 0) - (L.dup >= 0 ? 25 : 0) - 30 * clamp((L.copy - 0.35) / 0.45, 0, 1) - (L.nonsense ? 40 : 0)), 0, 100);
  }
  const nonsenseRatio = lines.filter((l) => l.nonsense).length / n;
  const distinct = new Set(lines.map((l) => l.norm)).size / n;
  const speech = lines.filter((l) => !l.action && l.n >= 6);
  const copyRatio = speech.length ? avg(speech.map((l) => clamp((l.copy - 0.35) / 0.45, 0, 1))) : 0;
  const selfRatio = speech.length ? avg(speech.map((l) => clamp((l.selfCopy - 0.35) / 0.45, 0, 1))) : 0;
  const pS = P.map((l) => l.s);
  const meanP = avg(pS);
  const perMin = P.length / Math.max(0.25, sec / 60);
  const ax = {};
  const why = {};
  const first = P[0];
  // --- ツカミ
  {
    const slow = kind === 'rakugo' || kind === 'talk' ? 2.5 : kind === 'conte' ? 1.6 : 1;
    if (!first) { ax.tsukami = 8; why.tsukami = 'ボケが見つからない'; } else {
      const tt = first.t0;
      const ts = tt <= 8 * slow ? 100 : tt >= 60 * slow ? 15 : 100 - ((tt - 8 * slow) * 85) / (52 * slow);
      ax.tsukami = R(0.55 * first.s + 0.45 * ts);
      why.tsukami = tt <= 12 * slow ? `${R(tt)}秒で最初のボケ（つかみが早い）` : `ツカミまでが長い（最初のボケが${R(tt)}秒後）`;
    }
  }
  // --- 構成
  {
    const pos = (l) => (n > 1 ? lines.indexOf(l) / (n - 1) : 0);
    const has = (f) => lines.some(f);
    let s = 0;
    const miss = [];
    const setup = has((l) => (l.beat === 'setup' || l.beat === 'makura' || l.beat === 'fukusen') && pos(l) < 0.35) || A.headCats.some((c) => lines.slice(0, 3).some((l) => l.cats.includes(c)));
    if (setup) s += 20; else miss.push('設定の提示');
    const tenk = has((l) => (l.beat === 'tenkai' || l.tenkaiMark || l.beat === 'hondai') && pos(l) > 0.2 && pos(l) < 0.85);
    if (tenk || kind === 'ogiri') s += 15; else miss.push('展開');
    const tail = lines.slice(-3);
    const ochiLine = tail.find((l) => l.beat === 'ochi' || l.beat === 'sage' || l.beat === 'kaishu') || (P.length && lines.indexOf(P[P.length - 1]) >= n - 3 ? P[P.length - 1] : null);
    if (ochiLine) s += 25; else miss.push(kind === 'rakugo' ? 'サゲ' : 'オチ');
    if (kind === 'manzai' && lines[n - 1].closer) s += 5;
    const third = Math.max(1, Math.floor(P.length / 3));
    const early = avg(pS.slice(0, third)), late = avg(pS.slice(-third));
    const esc = P.length >= 3 ? clamp(10 + (late - early), 0, 20) : 6;
    s += esc;
    const lastP = P[P.length - 1];
    const ochiS = lastP ? clamp(((lastP.s - meanP) / 20) * 15 + 7, 0, 15) : 0;
    s += ochiS;
    if (!lines.slice(0, Math.floor(n / 2)).some((l) => l.beat === 'ochi' || l.beat === 'sage')) s += 5;
    if (kind === 'ogiri') s = 25 + clamp(P.length, 0, 10) * 4 + esc + ochiS - (P.length < 3 ? 20 : 0);
    if (kind === 'rakugo') { const mk = has((l) => l.beat === 'makura'); if (!mk) { s -= 10; miss.push('まくら'); } }
    ax.kousei = R(clamp(s, 0, 100));
    why.kousei = miss.length ? `${miss.join('・')}がない` : late > early + 4 ? '後半に向けて盛り上がり、最後に落ちている' : late < early - 6 ? '後半が尻すぼみ' : '起承転結はできている';
    A.ochiLine = ochiLine; A.escalation = late - early; A.miss = miss;
  }
  // --- 発想・意外性
  {
    const sur = avg(P.map((l) => l.sur + (l.link && l.sur > 0.6 ? 0.08 : 0)));
    const cats = new Set(P.flatMap((l) => l.cats));
    const beta = P.length ? P.filter((l) => l.beta).length / P.length : 0;
    const tobi = P.length ? P.filter((l) => l.tobi).length / P.length : 0;
    ax.hassou = R(clamp(18 + sur * 72 + Math.min(10, cats.size * 1.5) - beta * 22 - tobi * 8 - nonsenseRatio * 45 - copyRatio * 25, 0, 100));
    const bestS = P.slice().sort((a, b) => b.sur - a.sur)[0];
    why.hassou = beta > 0.4 ? 'ボケが予想どおり（ベタ）' : tobi > 0.4 ? '飛びすぎて設定とつながっていない' : bestS ? `「${short(bestS.text)}」の飛躍がいい` : 'ボケがない';
    A.beta = beta; A.tobi = tobi;
  }
  // --- 言葉選び
  {
    const wp = lines.filter((l) => l.dajare || l.iima || /[0-9]{3,}/.test(l.text) && /「/.test(l.text)).length;
    const concrete = P.length ? P.filter((l) => l.nouns.size || l.number).length / P.length : 0;
    const fit = P.length ? P.filter((l) => l.n >= 6 && l.n <= K.maxLine).length / P.length : 0;
    const tatoe = T.filter((l) => l.tatoe).length;
    const ana = [...new Set(lines.flatMap((l) => l.anachro))];
    const longR = lines.filter((l) => l.n > K.maxLine * 2).length / n;
    const jokes = lines.filter((l) => l.joke).length;
    ax.kotoba = R(clamp(38 + Math.min(18, wp * 7) + concrete * 20 + fit * 12 + Math.min(10, tatoe * 3) - ana.length * 8 - jokes * 10 - nonsenseRatio * 55 - longR * 25 - copyRatio * 12, 0, 100));
    why.kotoba = ana.length ? `この時代にはまだない言葉（${ana.slice(0, 2).join('・')}）` : wp ? '言葉遊び（音・一字ちがい）が効いている' : concrete < 0.5 ? 'ふわっとした言葉が多い（具体的な名詞や数字を）' : '具体的な言葉で絵が浮かぶ';
    A.ana = ana; A.wp = wp;
  }
  // --- ツッコミの質
  if (axesIds.includes('tsukkomi')) {
    const TT = T.filter((l) => !(l.closer && lines.indexOf(l) >= n - 2));
    if (!TT.length) { ax.tsukkomi = kind === 'manzai' ? 12 : 40; why.tsukkomi = 'ツッコミのセリフがない'; } else {
      const q = avg(TT.map(tsukkomiQuality));
      const variety = new Set(TT.map((l) => l.norm)).size / TT.length;
      const cl = TT.filter((l) => l.clicheOnly).length / TT.length;
      ax.tsukkomi = R(clamp(q * 0.8 + variety * 18 - Math.max(0, cl - 0.25) * 50, 0, 100));
      const nande = T.filter((l) => /なんでやねん|なんでだよ/.test(l.norm)).length;
      const bestT = TT.filter((l) => l.tatoe || l.nori).sort((a, b) => tsukkomiQuality(b) - tsukkomiQuality(a))[0];
      why.tsukkomi = cl > 0.35 ? `「なんでやねん」系の決まり文句が${TT.filter((l) => l.clicheOnly).length}回` : bestT ? `${bestT.nori ? 'ノリツッコミ' : '例えツッコミ'}「${short(bestT.text, 14)}」が光る` : variety < 0.7 ? '同じツッコミのくり返し' : 'ツッコミがボケを言葉で拾えている';
      A.nande = nande; A.clicheT = cl;
    }
  }
  // --- 手数とテンポ
  {
    const [lo, hi] = K.ppm;
    const sp = perMin >= lo && perMin <= hi ? 100 : perMin < lo ? 100 - ((lo - perMin) / lo) * 110 : 100 - ((perMin - hi) / hi) * 60;
    let gap = 0, gapAt = null, last = 0;
    for (const l of P) { if (l.t0 - last > gap) { gap = l.t0 - last; gapAt = l; } last = l.t0 + l.sec; }
    if (sec - last > gap) { gap = sec - last; gapAt = null; }
    const gs = gap <= K.gap ? 100 : 100 - ((gap - K.gap) / K.gap) * 70;
    const lens = lines.filter((l) => !l.action).map((l) => l.n);
    const mean = avg(lens) || 1;
    const cv = Math.sqrt(avg(lens.map((x) => (x - mean) ** 2))) / mean;
    const vs = kind === 'ogiri' ? 100 - Math.abs(cv - 0.35) * 80 : cv < 0.2 ? 55 : cv > 1.4 ? 55 : 100;
    const longR = lines.filter((l) => l.n > K.maxLine * 2).length / n;
    ax.tempo = R(clamp(0.5 * clamp(sp, 0, 100) + 0.3 * clamp(gs, 0, 100) + 0.2 * vs - longR * 40 - nonsenseRatio * 30, 0, 100));
    why.tempo = perMin < lo ? `手数が少ない（1分あたりボケ${perMin.toFixed(1)}個）` : gap > K.gap * 1.5 ? `笑いのない時間が${R(gap)}秒続く` : longR > 0.15 ? 'セリフが長くてテンポが落ちる' : `1分あたりボケ${perMin.toFixed(1)}個でテンポがいい`;
    A.gap = gap; A.gapAt = gapAt; A.perMin = perMin;
  }
  // --- 天丼・伏線回収
  {
    let s = 18;
    for (const t2 of tendon) s += t2.uses.length <= 3 ? 20 : t2.uses.length === 4 ? 12 : 4;
    s = Math.min(s, 62);
    s += Math.min(30, callbacks.length * 12);
    if (callbacks.some((c) => c.ochi)) s += 14;
    if (lines.some((l) => l.beat === 'fukusen') && lines.some((l) => l.beat === 'kaishu')) s += 8;
    const tooMany = tendon.some((t2) => t2.uses.length >= 5);
    ax.tendon = R(clamp(s - (tooMany ? 10 : 0) - copyRatio * 15, 0, 100));
    why.tendon = tendon.length && callbacks.length ? `「${short(tendon[0].g, 10)}」の天丼と「${callbacks[0].w}」の回収が効いている` : tendon.length ? `「${short(tendon[0].g, 10)}」の天丼が効いている${tooMany ? '（ただし、くどい）' : ''}` : callbacks.length ? `前半の「${callbacks[0].w}」を後半で回収している` : '天丼も伏線回収もない';
  }
  // --- 独自性
  {
    const jokes = lines.filter((l) => l.joke).length;
    const cl = T.length ? T.filter((l) => l.clicheOnly).length / T.length : 0;
    const rare = lines.some((l) => l.meta) && P.length >= 3 ? 4 : 0;
    ax.dokuji = R(clamp(96 - jokes * 15 - cl * 30 - copyRatio * 85 - selfRatio * 65 - (A.beta || 0) * 15 - nonsenseRatio * 50 + rare - (distinct < 0.8 ? (0.8 - distinct) * 60 : 0), 0, 100));
    const copied = speech.filter((l) => l.copy >= 0.75).length;
    const selfC = speech.filter((l) => l.selfCopy >= 0.75).length;
    why.dokuji = copied >= Math.max(2, speech.length * 0.3) ? `部品のセリフがそのまま${copied}行` : selfC >= 2 ? `前に書いた台本と同じ行が${selfC}行` : jokes ? 'どこかで聞いたことのあるネタがある' : cl > 0.4 ? '決まり文句のツッコミが多い' : 'ほかで見たことのない台本';
    A.copied = copied; A.selfC = selfC; A.jokes = jokes;
  }
  // --- キャラ
  {
    const by = new Map();
    for (const l of lines) if (!l.action && l.role !== 'narr') { const a = by.get(l.role) || []; a.push(l); by.set(l.role, a); }
    let s = 42;
    const notes = [];
    let shaky = false;
    for (const [role, ls] of by) {
      if (ls.length < 3) continue;
      const ka = ls.filter((l) => l.kansai && !l.std).length, sd = ls.filter((l) => l.std && !l.kansai).length;
      if (ka + sd >= 3 && Math.min(ka, sd) / (ka + sd) > 0.3) shaky = true;
      const prons = ls.flatMap((l) => l.pron);
      if (prons.length >= 2 && new Set(prons.map((p) => toHira(p).replace('おれ', 'おれ'))).size > 1) shaky = true;
    }
    if (!shaky) s += 14; else notes.push('言葉づかいがぶれている');
    // a catchphrase: the same short line by the same speaker, 2–4 times
    const shortLines = lines.filter((l) => !l.action && l.n <= 14 && !l.clicheOnly && !l.closer);
    const cp = shortLines.some((l) => { const same = shortLines.filter((x) => x.role === l.role && x.norm === l.norm).length; return same >= 2 && same <= 4; });
    if (cp) s += 10;
    const persona = lines.slice(0, Math.max(3, Math.floor(n * 0.35))).some((l) => /(ぼく|僕|おれ|俺|わたし|私|うち|わし|あっし)(は|、|って|ね|も)/.test(l.text) && /(なんです|なんですよ|なんだ|でして|してます|してる|やねん|でございます|だった)/.test(l.text));
    if (persona || (neta.setting && Array.from(neta.setting).length >= 10)) s += 12;
    if (kind === 'manzai') {
      const share = T.length / Math.max(1, n);
      if (share >= 0.28 && share <= 0.55) s += 14; else { s -= 6; notes.push(share < 0.28 ? 'ツッコミのセリフが少ない' : 'ツッコミばかり'); }
    } else if (kind === 'conte' || kind === 'rakugo') {
      const roles = [...by.keys()].filter((r) => by.get(r).length >= 2);
      if (roles.length >= 2) s += 14; else notes.push('登場人物が一人しかいない');
    } else if (by.size === 1 || kind === 'talk') s += 10;
    s += Math.min(8, lines.filter((l) => l.jigyaku).length * 4);
    ax.chara = R(clamp(s - nonsenseRatio * 40 - (distinct < 0.6 ? 20 : 0), 0, 100));
    why.chara = notes.length ? notes.join('・') : cp ? '口ぐせが効いてキャラが立っている' : persona ? 'どんな人物かが早く伝わる' : 'キャラが一貫している';
  }
  // --- 尺の適正
  {
    const d = sec - target;
    const r2 = d / target;
    ax.shaku = R(clamp(Math.abs(r2) <= 0.05 ? 100 : r2 > 0 ? 100 - (r2 - 0.05) * 260 : 100 - (-r2 - 0.05) * 125, 0, 100));
    why.shaku = `推定${mmss(sec)}／目安${mmss(target)}` + (r2 > 0.05 ? `（${R(d)}秒オーバー）` : r2 < -0.15 ? `（${R(-d)}秒短い）` : '（ちょうどいい）');
  }
  // --- kind-specific
  if (axesIds.includes('sage')) {
    const last = lines[n - 1];
    const sl = lines.filter((l) => l.beat === 'sage');
    if (!sl.length && !(last && (SAGE_RE.test(last.text) || last.punch))) { ax.sage = 10; why.sage = 'サゲがない'; } else {
      const L = sl.length ? sl[sl.length - 1] : last;
      const cb = callbacks.some((c) => c.to === L.i);
      ax.sage = R(clamp(30 + (L.s || 40) * 0.45 + (cb ? 15 : 0) + (L.dajare || L.iima ? 10 : 0) + (L.twist ? 6 : 0) + (L.n <= 50 ? 6 : -6) - (L.joke ? 15 : 0), 0, 100));
      why.sage = cb ? 'サゲで前半を回収している' : L.dajare || L.iima ? '地口のサゲが効いている' : (L.s || 0) >= 60 ? 'サゲがすっと落ちる' : 'サゲが弱い';
    }
  }
  if (axesIds.includes('enji')) {
    const chars = ['a', 'b', 'c'].filter((r) => lines.filter((l) => l.role === r).length >= 2);
    const endOf = (r) => new Set(lines.filter((l) => l.role === r).map((l) => l.norm.slice(-2)));
    let diff = 0;
    if (chars.length >= 2) { const a = endOf(chars[0]), b = endOf(chars[1]); const inter = [...a].filter((x) => b.has(x)).length; diff = 1 - inter / Math.max(1, Math.min(a.size, b.size)); }
    const narr = lines.some((l) => l.role === 'narr');
    const rk = lines.filter((l) => RAKUGO_RE.test(l.text)).length;
    ax.enji = R(clamp((chars.length >= 3 ? 50 : chars.length === 2 ? 42 : 8) + diff * 28 + (narr ? 8 : 0) + Math.min(12, rk * 2), 0, 100));
    why.enji = chars.length < 2 ? '人物が一人しか出てこない（上下で演じ分けを）' : diff > 0.6 ? '人物ごとの言葉づかいがはっきり違う' : '人物の言葉づかいがにている';
  }
  if (axesIds.includes('mijika')) {
    const ml = avg(P.map((l) => l.n)) || 99;
    ax.mijika = R(clamp(ml <= 15 ? 100 : ml <= 25 ? 100 - (ml - 15) * 3 : ml <= 40 ? 70 - (ml - 25) * 2.7 : 30 - (ml - 40), 5, 100));
    why.mijika = ml <= 20 ? `回答が短くて鋭い（平均${R(ml)}字）` : `回答が長い（平均${R(ml)}字）`;
  }
  if (axesIds.includes('kyori')) {
    const sur = avg(P.map((l) => l.sur));
    ax.kyori = R(clamp(22 + sur * 72 - (A.beta || 0) * 25 - nonsenseRatio * 50, 0, 100));
    why.kyori = (A.beta || 0) > 0.4 ? 'お題から近すぎる回答が多い' : (A.tobi || 0) > 0.5 ? 'お題から離れすぎた回答が多い' : 'お題からほどよく飛んでいる';
  }
  if (axesIds.includes('settei')) {
    const st = String(neta.setting || '');
    const hits = lexHits(st + ' ' + (neta.title || ''));
    const cats = [...new Set(hits.flatMap((h) => h.cats))];
    let far = false;
    for (let x = 0; x < cats.length; x++) for (let y = x + 1; y < cats.length; y++) if (catDist(cats[x], cats[y]) >= 1) far = true;
    const roles = new Set(lines.filter((l) => l.role !== 'narr').map((l) => l.role)).size;
    ax.settei = R(clamp((Array.from(st).length >= 10 ? 30 : Array.from(st).length ? 15 : 0) + (hits.some((h) => h.cats.some((c) => ['job', 'city', 'shop', 'school', 'work', 'home', 'health', 'fantasy', 'history', 'space'].includes(c))) ? 20 : 0) + (far ? 22 : 0) + (roles >= 2 ? 14 : 4) + (lines.slice(0, 3).some((l) => l.beat === 'setup') ? 10 : 0) - nonsenseRatio * 40, 0, 100));
    why.settei = !st ? '設定が書かれていない' : far ? '組み合わせの意外な設定' : '設定がふつう（ありそうな場面）';
  }
  if (axesIds.includes('uragiri')) {
    const late = lines.slice(Math.floor(n * 0.45));
    const tw = late.filter((l) => l.twist);
    const strong = tw.length ? Math.max(...tw.map((l) => { const j = lines.indexOf(l); const nx = lines.slice(j, j + 3).filter((x) => x.punch).map((x) => x.s); return nx.length ? Math.max(...nx) : 40; })) : 0;
    ax.uragiri = R(clamp(tw.length ? 40 + strong * 0.5 + Math.min(10, tw.length * 4) : 18, 0, 100));
    why.uragiri = tw.length ? '後半の裏切りで景色が変わる' : '裏切り（後半の意外な展開）がない';
  }
  if (axesIds.includes('uta')) {
    const sung = lines.filter((l) => !l.action && /[～〜]/.test(l.text)).length + lines.filter((l) => l.beat === 'tendon').length;
    const vt = lines.map((l) => vowelTail(l.text)).filter(Boolean);
    let rh = 0;
    for (let k = 1; k < vt.length; k++) if (vt[k] === vt[k - 1]) rh++;
    ax.uta = R(clamp(25 + Math.min(30, sung * 5) + Math.min(25, rh * 8) + (tendon.length ? 15 : 0) - nonsenseRatio * 40, 0, 100));
    why.uta = tendon.length ? 'サビのくり返しが気持ちいい' : rh ? '韻をふんでいる' : '歌のリズムが弱い（くり返しや韻を）';
  }
  if (axesIds.includes('nisete')) {
    const intro = lines.slice(0, 3).some((l) => /ものまね|まね/.test(l.text) || /ものまね/.test(neta.title || ''));
    const ex = lines.filter((l) => l.kochou || /[～〜]{1,}|(.)\1{2,}|えー/.test(l.text)).length;
    const sit = lines.some((l) => /もしも|もし/.test(l.text));
    ax.nisete = R(clamp(25 + (intro ? 18 : 0) + Math.min(30, ex * 6) + (sit ? 15 : 0) + (tendon.length ? 8 : 0) - nonsenseRatio * 40, 0, 100));
    why.nisete = !intro ? '何のものまねか最初に伝えよう' : sit ? '「もしも」のシチュエーションで広がる' : '特徴の誇張が足りない';
  }
  if (axesIds.includes('rinjou')) {
    const det = lines.filter((l) => l.number || l.quote || /この前|昨日|こないだ|先週|朝|夜中|[0-9一二三四五六七八九十]+時/.test(l.text)).length;
    const fp = lines.filter((l) => /(ぼく|僕|おれ|俺|わたし|私|うち)/.test(l.text)).length;
    ax.rinjou = R(clamp(28 + Math.min(40, det * 8) + Math.min(14, fp * 4) + (lines.some((l) => l.quote) ? 10 : 0) - nonsenseRatio * 40, 0, 100));
    why.rinjou = det >= 3 ? 'いつ・どこ・だれが具体的で目に浮かぶ' : '状況の描写が少ない（いつ・どこ・セリフを）';
  }
  if (axesIds.includes('hitori')) {
    const self = lines.filter((l) => /(って|…いや、|いや、それは|ちがうか|違うか|そりゃそうだ)/.test(l.text) && l.role !== 'tsukkomi').length;
    const others = lines.filter((l) => l.role === 'tsukkomi' || /^[abc]$/.test(l.role)).length;
    const flips = lines.filter((l) => l.role === 'narr').length;
    ax.hitori = R(clamp(40 + Math.min(25, self * 6) + Math.min(15, flips * 3) - Math.min(30, others * 6) + (P.length >= 4 ? 10 : 0), 0, 100));
    why.hitori = others ? 'ピンなのに相手のセリフが多い' : self ? '自分でボケて自分で拾えている' : '一人で笑いを回収する工夫を';
  }
  for (const a of axesIds) if (!(a in ax)) { ax[a] = 40; why[a] = ''; }

  // ------------------------------------------------ caps (nonsense, repetition, copying, too little)
  let cap = 100;
  const capNotes = [];
  if (nonsenseRatio > 0.5) { cap = Math.min(cap, 10); capNotes.push('意味の通らない行がほとんど'); } else if (nonsenseRatio > 0.25) { cap = Math.min(cap, 32); capNotes.push('意味の通らない行が多い'); }
  if (distinct < 0.4) { cap = Math.min(cap, 14); capNotes.push('同じセリフのくり返し'); } else if (distinct < 0.7) { cap = Math.min(cap, 40); capNotes.push('同じセリフが多い'); }
  if (copyRatio > 0.15) { cap = Math.min(cap, R(100 - 62 * copyRatio)); if (copyRatio > 0.4) capNotes.push('部品の丸写し'); }
  if (selfRatio > 0.2) cap = Math.min(cap, R(100 - 50 * selfRatio));
  const minLines = { manzai: 6, conte: 6, pin: 4, rakugo: 6, ogiri: 2, utaneta: 4, monomane: 3, talk: 4 }[kind];
  if (n < minLines) { cap = Math.min(cap, 22 + n * 4); capNotes.push('ネタとして短すぎる'); }
  if (!P.length) { cap = Math.min(cap, 18); capNotes.push('ボケがない'); }
  const over = (sec - target) / target;
  if (over > 0.6) cap = Math.min(cap, 55);
  for (const a of axesIds) if (cap < 100) ax[a] = Math.min(ax[a], R(cap + 12));

  // ------------------------------------------------ judges
  const taste = { aruaru: lines.filter((l) => l.aruaru).length, meta: P.length ? P.filter((l) => l.meta).length / P.length : 0 };
  res.judges = JUDGES.map((j) => {
    let ws = 0, wt = 0;
    for (const a of axesIds) { const w = j.w[a] || 1; ws += ax[a] * w; wt += w; }
    let s = 50 + (ws / wt - 50) * j.spread + j.bias;
    if (j.id === 'emihara') { if (taste.aruaru >= 2) s += 4; if (taste.meta > 0.3) s -= 5; if ((A.tobi || 0) > 0.5) s -= 5; }
    if (j.id === 'shindo') { s -= (A.clicheT || 0) * 8 + copyRatio * 10; if (taste.meta > 0 && ax.dokuji >= 70) s += 3; }
    if (j.id === 'koiki') s += Math.min(6, (A.wp || 0) * 3);
    if (j.id === 'dan' && A.miss && A.miss.some((m) => m === 'オチ' || m === 'サゲ')) s -= 6;
    if (j.id === 'tobishima' && (A.beta || 0) > 0.5) s -= 6;
    s = Math.min(s, cap + (j.id === 'emihara' ? 4 : 2));
    const score = clamp(R(s), 0, 100);
    return { id: j.id, name: j.name, title: j.title, taste: j.taste, score, comment: judgeComment(j, score, ax, why, axesIds, A, res.hash) };
  });
  let total = R(avg(res.judges.map((x) => x.score)));
  total = Math.min(total, cap);
  res.total = clamp(total, 0, 100);
  res.axes = ax;
  res.reasons = why;
  res.rank = rankLabel(res.total);

  // ------------------------------------------------ advice (concrete, most useful first)
  const adv = [];
  const push = (p, s) => adv.push([p, s]);
  if (nonsenseRatio > 0.25) push(100, `意味の通らない行が${lines.filter((l) => l.nonsense).length}行ある（${lines.filter((l) => l.nonsense).slice(0, 3).map((l) => `${l.i + 1}行目`).join('・')}）。日本語の文にしよう。`);
  if (distinct < 0.7) { const d = lines.find((l) => l.dup >= 0); push(95, `同じセリフのくり返しが多い（「${short(d ? d.text : lines[0].text, 12)}」）。天丼は2〜3回まで、少しずつ言い方を変えて。`); }
  if (n < minLines) push(90, `台本が短すぎる（${n}行）。フリ→ボケ→ツッコミを何往復か足そう。`);
  if (!P.length) push(88, 'ボケになっている行がない。ボケのセリフ（ビート「ボケ」）を入れよう。');
  if (A.copied >= Math.max(2, speech.length * 0.3)) push(85, `部品のセリフがそのまま${A.copied}行。自分の言葉に書き換えると独自性がぐっと上がる。`);
  if (A.selfC >= 2) push(70, `前に書いた台本と同じ行が${A.selfC}行ある。使い回しは審査員に見抜かれる。`);
  if (sec > target * 1.05) push(84, `尺が${R(sec - target)}秒オーバー（目安${mmss(target)}）。いちばん弱いボケから削ろう。`);
  else if (sec < target * 0.8 && n >= minLines) push(55, `尺が${R(target - sec)}秒短い。展開をひとつ足すか、天丼を入れよう。`);
  if (first && ax.tsukami < 55) push(80, `ツカミまでが長い（最初のボケが${R(first.t0)}秒後・${first.i + 1}行目）。最初の10秒で一回笑わせたい。`);
  if (A.miss && A.miss.includes('オチ')) push(82, 'オチがない。最後に一番強いボケか、前半の伏線の回収を。');
  else if (A.miss && A.miss.includes('サゲ')) push(82, 'サゲがない。最後の一言で噺をすとんと落とそう。');
  else if (P.length >= 3 && P[P.length - 1].s < meanP - 6) push(65, `オチが弱い（最後のボケ「${short(P[P.length - 1].text, 12)}」が中盤のボケより弱い）。`);
  if (A.escalation < -6 && P.length >= 4) push(60, '後半が尻すぼみ。強いボケを後ろに回して、だんだん大きくしよう。');
  const pat = samePattern(P);
  if (pat) push(62, `${pat.k}つ目のボケで同じパターン（${pat.what}）。型を変えて裏切ろう。`);
  if (A.nande >= 3) push(72, `「なんでやねん／なんでだよ」が${A.nande}回。例えツッコミやノリツッコミを混ぜよう。`);
  else if ((A.clicheT || 0) > 0.35) push(60, '決まり文句のツッコミが多い。ボケの中身を言葉で拾うツッコミに。');
  if (A.gap > KINDS[kind].gap * 1.5 && A.gapAt) push(58, `ボケとボケの間が${R(A.gap)}秒空く（${A.gapAt.i + 1}行目の前）。説明を削るかボケを足そう。`);
  const longL = lines.filter((l) => l.n > K.maxLine * 2);
  if (longL.length) push(57, `${longL[0].i + 1}行目が長すぎる（${longL[0].n}字）。${K.label}のセリフは${K.maxLine}字くらいまでが目安。`);
  if (!tendon.length && !callbacks.length && P.length >= 5 && axesIds.includes('tendon')) {
    const cand = lines.slice(0, Math.floor(n * 0.4)).flatMap((l) => [...l.nouns]).find((w) => Array.from(w).length >= 2 && !A.head.includes(w));
    push(50, cand ? `前半の「${cand}」を後半やオチでもう一度使うと、伏線回収になる。` : '天丼か伏線回収をひとつ入れると、台本がしまる。');
  }
  if ((A.beta || 0) > 0.4) push(52, 'ボケが設定から予想できる（ベタ）。設定から一番遠いものとくっつけてみよう。');
  if ((A.tobi || 0) > 0.4) push(48, '設定とつながらないボケが多い。設定の言葉を一つ残したまま飛ばすと伝わる。');
  if (A.ana && A.ana.length) push(66, `この時代にはまだない言葉がある（${A.ana.join('・')}）。`);
  if (kind === 'manzai' && T.length / n < 0.28) push(56, 'ツッコミのセリフが少ない。ボケのあとに必ず拾おう。');
  if (kind === 'conte' && !neta.setting) push(54, '設定（どこで・だれが）を書こう。コントは設定が命。');
  if (kind === 'conte' && ax.uragiri < 40) push(50, '後半に裏切り（「実は…」の展開）を入れると景色が変わる。');
  if (kind === 'rakugo' && ax.enji < 40) push(55, '人物が一人しか出てこない。上下（かみしも）で二人以上を演じ分けよう。');
  if (kind === 'ogiri' && ax.mijika < 60) push(55, '回答が長い。大喜利は一言で言い切るほど強い。');
  if (lines.some((l) => l.joke)) push(64, `どこかで聞いたネタ「${short(lines.find((l) => l.joke).text, 12)}」は外そう。`);
  adv.sort((a, b) => b[0] - a[0]);
  res.advice = [...new Set(adv.map((x) => x[1]))].slice(0, 6);
  if (!res.advice.length) res.advice = ['大きな欠点はない。ネタ合わせで仕上がりを上げて、本番で噛まないように。'];

  // ------------------------------------------------ line highlights
  res.lines = lines.map((l) => ({ i: l.i, s: l.s, k: l.punch ? 'p' : l.tsk ? 't' : 'o', tag: lineTag(l, tendonLines, cbLines) }));
  const byS = lines.filter((l) => l.punch || l.tsk).slice().sort((a, b) => b.s - a.s || a.i - b.i);
  res.best = byS.slice(0, 3).filter((l) => l.s >= 55).map((l) => l.i);
  const worstPool = lines.slice().sort((a, b) => a.s - b.s || a.i - b.i);
  res.worst = worstPool.slice(0, 3).filter((l) => l.s < 50 && !res.best.includes(l.i)).map((l) => l.i);
  const top = axesIds.slice().sort((a, b) => ax[b] - ax[a])[0];
  const low = axesIds.slice().sort((a, b) => ax[a] - ax[b])[0];
  res.summary = capNotes.length ? capNotes[0] : `${AXES[top]}が強み、${AXES[low]}が課題`;
  res.comments = [`${res.rank}（${res.total}点）。${res.summary}。`, ...res.advice.slice(0, 2)];
  res.stats = { sec: R(sec), lines: n, punches: P.length, perMin: Math.round(perMin * 10) / 10, target, tsukkomi: T.length, cliche: T.filter((l) => l.clicheOnly).length, copy: Math.round(copyRatio * 100) / 100, self: Math.round(selfRatio * 100) / 100, tendon: tendon.map((x) => x.g), callbacks: callbacks.map((c) => c.w), nonsense: Math.round(nonsenseRatio * 100) / 100, distinct: Math.round(distinct * 100) / 100 };
  return res;
}

function lineTag(l, tendonLines, cbLines) {
  if (l.nonsense) return '意味が通らない';
  if (l.dup >= 0) return 'くり返し';
  if (l.joke) return 'どこかで聞いたネタ';
  if (l.copy >= 0.75) return '部品のまま';
  if (l.selfCopy >= 0.75) return '使い回し';
  if (l.tsk) return l.nori ? 'ノリツッコミ' : l.tatoe ? '例えツッコミ' : l.clicheOnly ? '決まり文句' : l.spec ? 'ボケを拾っている' : '';
  if (!l.punch) return l.n > 90 ? '長すぎる' : '';
  if (cbLines.has(l.i)) return '伏線回収';
  if (tendonLines.has(l.i)) return '天丼';
  if (l.dajare) return '言葉遊び';
  if (l.iima) return '言い間違い';
  if (l.person) return '擬人化';
  if (l.beta) return 'ベタ';
  if (l.tobi) return '飛びすぎ';
  if (l.n > 60) return '長すぎる';
  if (l.aruaru) return 'あるある';
  if (l.kochou) return '誇張';
  if (l.sur >= 0.8) return '意外性';
  return '';
}
// three punch lines in a row built the same way (same ending, same opening, or the same 「〜すぎて」 shape)
function samePattern(P) {
  const shape = (l) => {
    const t = l.norm;
    const m = t.match(/(すぎて|しすぎて|ほど|のに|と思ったら|って言ったら|ったら)/);
    return { end: t.slice(-3), start: t.slice(0, 3), mid: m ? m[1] : '' };
  };
  for (let k = 2; k < P.length; k++) {
    const a = shape(P[k - 2]), b = shape(P[k - 1]), c = shape(P[k]);
    if (a.mid && a.mid === b.mid && b.mid === c.mid) return { k: k + 1, what: `「〜${a.mid}」の型が続いている` };
    if (a.end === b.end && b.end === c.end && a.end.length === 3) return { k: k + 1, what: `語尾「${a.end}」が3回続く` };
    if (a.start === b.start && b.start === c.start && a.start.length === 3) return { k: k + 1, what: `「${a.start}…」で始まるボケが3回続く` };
  }
  return null;
}
const VOW = (() => {
  const t = {};
  const rows = { a: 'あかさたなはまやらわがざだばぱぁゃ', i: 'いきしちにひみりぎじぢびぴぃ', u: 'うくすつぬふむゆるぐずづぶぷぅゅ', e: 'えけせてねへめれげぜでべぺぇ', o: 'おこそとのほもよろをごぞどぼぽぉょ' };
  for (const [v, s] of Object.entries(rows)) for (const ch of s) t[ch] = v;
  t['ん'] = 'n';
  return t;
})();
function vowelTail(text) {
  const h = toHira(String(text).replace(/[～〜ー…。、！？!?\s）)」]+$/g, ''));
  const kana = Array.from(h).filter((c) => VOW[c]);
  if (kana.length < 2) return '';
  return kana.slice(-2).map((c) => VOW[c]).join('');
}

const VOICE = {
  dan: { hi: ['よく組み立てられた台本です。', '設計図がしっかりしていますね。'], mid: ['骨組みはできています。', '流れは悪くないです。'], lo: ['構成から見直しましょう。', '組み立てがまだばらばらです。'], focus: ['kousei', 'tsukami', 'shaku', 'tendon', 'sage'] },
  tobishima: { hi: ['おもろい発想しとるわ。', 'この飛び方は、なかなかできへんで。'], mid: ['ええとこもあるけど、まだ普通やな。', '発想はもう一歩やな。'], lo: ['どっかで見たようなボケばっかりやで。', '発想がまだ素人さんや。'], focus: ['hassou', 'dokuji', 'uragiri', 'settei', 'kyori', 'nisete'] },
  koiki: { hi: ['言葉の選び方が粋ですな。', 'ことばが立っております。'], mid: ['言い回しに、もうひと工夫ほしいところで。', '言葉は丁寧ですが、まだ角が丸い。'], lo: ['言葉が立っておりませんな。', 'せりふが耳に残りませんな。'], focus: ['kotoba', 'tsukkomi', 'enji', 'sage', 'mijika', 'uta', 'rinjou'] },
  emihara: { hi: ['お客さん、絶対よろこぶわ！', 'うちの劇場で毎日かけてほしいわ。'], mid: ['うちの劇場やったら、まあまあウケるわね。', 'お客さんは半分くらい笑うわ。'], lo: ['これはお客さん、置いてけぼりやわ。', '客席がしーんとしてまうわ。'], focus: ['tsukami', 'tempo', 'chara', 'kousei', 'hitori', 'rinjou'] },
  shindo: { hi: ['新しい。久しぶりにメモを取った。', 'この台本は、まだ誰もやっていない。'], mid: ['既視感が先に立つ。', '悪くはないが、新しくもない。'], lo: ['今のままでは誰の記憶にも残らない。', 'どこかで聞いた話の寄せ集めだ。'], focus: ['dokuji', 'hassou', 'uragiri', 'tendon'] },
};
function judgeComment(j, score, ax, why, axesIds, A, h) {
  const v = VOICE[j.id];
  const band = score >= 70 ? 'hi' : score >= 45 ? 'mid' : 'lo';
  const pick = (arr, salt) => arr[(h + salt) % arr.length];
  const focus = v.focus.filter((a) => axesIds.includes(a));
  const best = focus.slice().sort((a, b) => ax[b] - ax[a])[0];
  const worst = focus.slice().sort((a, b) => ax[a] - ax[b])[0];
  const opener = pick(v[band], j.id.length);
  const good = best && why[best] && ax[best] >= 60 ? `${AXES[best]}：${why[best]}。` : '';
  const bad = worst && why[worst] && ax[worst] < 60 && worst !== best ? `${AXES[worst]}は、${why[worst]}。` : '';
  return (opener + (band === 'lo' ? bad || good : good || bad)).slice(0, 120);
}

// ------------------------------------------------------------------ the editor's live numbers and checklist
export function estimate(neta, ctx = {}) {
  const kind = kindOf(neta && neta.kind);
  const K = KINDS[kind];
  const src = (neta && neta.lines) || [];
  const inferred = inferBeats({ kind, lines: src });
  let sec = 0, punches = 0, chars = 0, count = 0;
  for (let i = 0; i < src.length; i++) {
    const l = src[i];
    const t = String((l && l.text) || '').trim();
    if (!t) continue;
    count++;
    const n = Array.from(t).length;
    chars += n;
    const beat = l.beat || inferred[i];
    const next = src[i + 1];
    const punch = PUNCH_BEATS.has(beat) && !(l.role === 'tsukkomi') || (beat === 'tsukami' && next && (next.role === 'tsukkomi' || next.beat === 'tsukkomi'));
    if (punch) punches++;
    sec += isAction({ role: l.role, text: t }) ? 1.5 + n / 15 : kind === 'ogiri' ? 2.5 + n / K.rate : n / K.rate + K.pause;
    if (punch) sec += K.laugh;
  }
  const target = Number(ctx.target || (neta && neta.target)) || K.def;
  return { sec: R(sec), lines: count, punches, perMin: sec ? Math.round((punches / (sec / 60)) * 10) / 10 : 0, chars, target, over: R(sec - target) };
}
const STRUCT = {
  manzai: [['tsukami', 'ツカミ'], ['setup', '設定の提示'], ['ofuku', 'ボケとツッコミの往復'], ['tenkai', '展開'], ['tendon', '天丼'], ['fukusen', '伏線と回収'], ['ochi', '大オチ']],
  conte: [['setting', '設定'], ['chars', '登場人物'], ['zure', 'ズレ'], ['tenkai', '展開'], ['uragiri', '裏切り'], ['ochi', 'オチ']],
  pin: [['tsukami', 'ツカミ'], ['setup', 'フリ・設定'], ['renda', 'ボケの連打'], ['tenkai', '展開'], ['ochi', 'オチ']],
  rakugo: [['makura', 'まくら'], ['hondai', '本題'], ['enji', '人物の演じ分け'], ['sage', 'サゲ']],
  ogiri: [['odai', 'お題'], ['answers', '回答3つ以上'], ['short', '回答の短さ']],
  utaneta: [['tsukami', 'ツカミ'], ['setup', '歌の設定'], ['kashi', '歌詞のボケ'], ['sabi', 'サビの天丼'], ['ochi', 'オチ']],
  monomane: [['setup', '何のものまねか'], ['kochou', '特徴の誇張'], ['moshimo', 'シチュエーション'], ['ochi', 'オチ']],
  talk: [['ki', '起（状況）'], ['shou', '承'], ['ten', '転'], ['ketsu', '結（オチ）'], ['rinjou', '臨場感']],
};
export function structureCheck(neta) {
  const kind = kindOf(neta && neta.kind);
  const src = ((neta && neta.lines) || []).filter((l) => l && String(l.text || '').trim());
  const inferred = inferBeats({ kind, lines: src });
  const B = src.map((l, i) => l.beat || inferred[i]);
  const has = (b) => B.includes(b);
  const n = src.length;
  const txt = src.map((l) => l.text);
  const tsk = src.filter((l) => l.role === 'tsukkomi' || l.beat === 'tsukkomi').length;
  const boke = B.filter((b) => b === 'boke' || b === 'tendon' || b === 'kaishu').length;
  const roles = new Set(src.filter((l) => /^[abc]$/.test(l.role)).map((l) => l.role)).size;
  const rep = (() => { const seen = new Map(); for (const t of txt) { const k = normN(t); if (Array.from(k).length >= 4) seen.set(k, (seen.get(k) || 0) + 1); } return [...seen.values()].some((v) => v >= 2); })();
  const ok = {
    tsukami: has('tsukami') || (n && FIRST_RE.test(txt[0])), setup: has('setup') || has('makura'), ofuku: Math.min(tsk, boke) >= 3, tenkai: has('tenkai') || txt.some((t) => TENKAI_RE.test(t)),
    tendon: has('tendon') || rep, fukusen: has('fukusen') && has('kaishu'), ochi: n > 0 && (B.slice(-3).includes('ochi') || B.slice(-3).includes('sage')),
    setting: Array.from(String((neta && neta.setting) || '')).length >= 6, chars: roles >= 2, zure: boke >= 2, uragiri: src.some((l) => l.twist || TWIST_RE.test(l.text)),
    renda: boke >= 3, makura: has('makura'), hondai: has('hondai') || boke >= 2, enji: roles >= 2, sage: has('sage'),
    odai: !!(neta && (neta.theme || neta.title)), answers: B.filter((b) => b === 'answer').length >= 3, short: n > 0 && avg(src.map((l) => Array.from(l.text).length)) <= 22,
    kashi: boke >= 2, sabi: has('tendon') || rep, kochou: txt.some((t) => KOCHOU_RE.test(t) || /[～〜]/.test(t)), moshimo: txt.some((t) => /もしも|もし/.test(t)),
    ki: has('setup'), shou: has('tenkai'), ten: has('boke') || has('tenkai') && txt.some((t) => TWIST_RE.test(t)), ketsu: B.slice(-2).includes('ochi'), rinjou: txt.some((t) => /「[^」]{2,}」/.test(t) || /[0-9一二三四五六七八九十]+(時|分|回|人|円)/.test(t)),
  };
  return (STRUCT[kind] || STRUCT.manzai).map(([id, label]) => ({ id, label, ok: !!ok[id] }));
}
