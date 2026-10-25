// お笑いの土台 — data (owner: A). Constants, the 相方 candidate pool (registered people), lines, helpers shared by
// owarai.js (core), owarai_net.js (相方募集 / meetings), owarai_ui.js (screens) and places/nsc.js.
// Everything here is fictional: every person, magazine, BBS, blog, app and theatre ladder below is this game's own
// (the SNS ドッター is the game's existing fictional SNS). Real: NSC（吉本総合芸能学院）facts, see places/nsc.js.
//
// Candidates are registered with registerPerson at module load under FIXED ids (net boards: 'ow_<board>_<name>',
// NSC 同期: 'ow_no_*' 大阪校 / 'ow_nt_*' 東京校), so a save that holds one of these ids always resolves. Their look and
// stats are derived deterministically from the id (same id → same person in every session).

import { registerPerson, PEOPLE } from './life.js';
import { clamp } from './util.js';
import { prefecture } from './profile.js';

// ------------------------------------------------------------------ stats
export const COMEDY_STATS = {
  neta: 'ネタ作り', boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間・テンポ', voice: '声量・滑舌', act: '演技力',
  hassou: '発想力', wagei: '話芸', dokyo: '度胸', chara: 'キャラ・華', adlib: 'アドリブ', mane: 'ものまね',
  // A's additions
  kosei: '構成力', kankyaku: '客席を読む力',
};
export const STAT_KEYS = Object.keys(COMEDY_STATS);
export const STAT_SHORT = { neta: 'ネタ', boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間', voice: '声', act: '演技', hassou: '発想', wagei: '話芸', dokyo: '度胸', chara: '華', adlib: 'アドリブ', mane: 'ものまね', kosei: '構成', kankyaku: '客読み' };

// 芸の種類 (CONTRACT4 kinds) and how much each stat counts for it.
export const KINDS = {
  manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'トーク',
};
export const KIND_ORDER = ['manzai', 'conte', 'pin', 'rakugo', 'ogiri', 'utaneta', 'monomane', 'talk'];
export const WEIGHTS = {
  manzai: { neta: 1.1, boke: 1, tsukkomi: 1, ma: 1.3, voice: 0.8, wagei: 0.7, chara: 0.6, adlib: 0.5, dokyo: 0.6, kosei: 1, kankyaku: 0.6, hassou: 0.8 },
  conte: { neta: 1.1, act: 1.4, hassou: 1, kosei: 1.1, boke: 0.8, tsukkomi: 0.7, chara: 0.8, ma: 0.8, voice: 0.5, dokyo: 0.5 },
  pin: { neta: 1.2, hassou: 1.2, chara: 1, wagei: 0.8, act: 0.6, dokyo: 0.9, kosei: 0.9, ma: 0.7, kankyaku: 0.6 },
  rakugo: { wagei: 1.5, ma: 1.3, act: 1, voice: 0.9, kosei: 0.7, chara: 0.5, kankyaku: 0.8 },
  ogiri: { hassou: 1.6, adlib: 1.4, boke: 0.9, dokyo: 0.6, wagei: 0.4, kankyaku: 0.4 },
  utaneta: { mane: 0.8, voice: 1.2, hassou: 1, chara: 1, neta: 0.8, act: 0.5, ma: 0.6 },
  monomane: { mane: 1.8, voice: 1, act: 0.9, chara: 0.8, kankyaku: 0.5 },
  talk: { wagei: 1.6, kosei: 1, ma: 0.9, adlib: 0.8, chara: 0.7, kankyaku: 0.8, dokyo: 0.6 },
};
// kinds that are always a solo art (the act's partner does not count)
export const SOLO_KINDS = new Set(['pin', 'rakugo', 'ogiri', 'utaneta', 'monomane', 'talk']);

// 実力不足: concrete reasons per stat (kind-specific wording where it matters)
export const GAP_REASON = {
  neta: { _: 'ネタの中身が弱い：同じパターンのくり返しで、後半に失速する', manzai: 'ネタの中身が弱い：ボケの数が少なく、中盤でダレる', conte: '設定がありきたり：「どこかで見たコント」と思われる', pin: 'フリップ／一人コントの切り口が平凡' },
  boke: { _: 'ボケが弱い：言い回しがふつうで、笑いの「ズレ」が小さい' },
  tsukkomi: { _: 'ツッコミが弱い：ワードが説明的で、ボケを笑いに変えきれていない' },
  ma: { _: '間が悪い：ツッコミが早すぎる。笑いを待たずに次へ行ってしまう', rakugo: '間が悪い：「間（ま）」がなく、オチの前に聞き手が置いていかれる' },
  voice: { _: '声量・滑舌：後ろの席まで声が届かず、早口になると噛む' },
  act: { _: '演技力：役に入りきれず、設定にお客さんが乗ってこない', rakugo: '所作が硬い：登場人物の演じ分けがはっきりしない' },
  hassou: { _: '発想力：答え・ボケが予想の範囲内で、驚きがない', ogiri: '発想力：お題に対して「ふつうの答え」しか出てこない' },
  wagei: { _: '話芸：語りが平板で、話に引きこまれない', talk: '話芸：エピソードの「フリ」が長く、オチまでにお客さんが離れる' },
  dokyo: { _: '度胸：舞台で緊張して表情がかたく、声が小さくなる' },
  chara: { _: 'キャラ・華：印象に残らない。「どんな人か」がお客さんに伝わらない' },
  adlib: { _: 'アドリブ：想定外の反応（スベり・ハプニング）を笑いに変えられない' },
  mane: { _: 'ものまね：似ている度が低く、元ネタが伝わらない', utaneta: '歌の再現度が低く、替え歌のおかしさが立たない' },
  kosei: { _: '構成力：ツカミ→展開→オチの流れが弱く、尺の配分がばらばら（尺オーバーしがち）' },
  kankyaku: { _: '客席を読む力：客層・空気に合わせられず、ウケない日に立て直せない' },
};

// Which practice / class grows which stat (shown in the 実力不足 advice).
export const GROW_HINT = {
  neta: 'ネタ作り（家）・NSCのネタ見せ', boke: '相方とネタ合わせ・大喜利の自主練', tsukkomi: '相方とネタ合わせ', ma: 'ネタ合わせ・先輩の舞台を観る・落語の稽古',
  voice: '発声練習・NSCの発声', act: 'NSCの演技・コント', hassou: '大喜利の自主練・NSCの発想法', wagei: '落語の稽古・トーク', dokyo: '劇場の出番（ライブ）',
  chara: 'NSCのダンス・ライブの場数', adlib: '大喜利・即興・ライブ', mane: 'ものまね練習', kosei: 'ネタ作り・台本を書く', kankyaku: '先輩の舞台を観る・ライブの場数',
};

// ------------------------------------------------------------------ the act
export const ROLES = { boke: 'ボケ', tsukkomi: 'ツッコミ', both: 'Wボケ', pin: 'ピン' };
export const STYLES = { manzai: '漫才中心', conte: 'コント中心', both: '漫才とコント', pin: 'ピン芸' };
export const SOURCES = { net: 'ネットで出会った', nsc: 'NSCの同期', people: '知り合い', solo: 'ピン' };
// 劇場ランク (fictional ladder; the agency's theatre is drawn as 「ドット小劇場」 in this world)
export const THEATER_RANKS = [
  { name: 'フリーライブ', desc: 'アマチュアの地下ライブ・インディーズライブ' },
  { name: '事務所ライブ', desc: '所属したての新人：ネタ見せとオーディションライブ' },
  { name: '若手劇場 ルーキー', desc: '若手劇場のメンバーに選ばれた' },
  { name: '若手劇場 レギュラー', desc: '若手劇場の定期公演に毎週出られる' },
  { name: '若手劇場 トップ', desc: '若手劇場の人気上位。トリをまかされることも' },
  { name: '本劇場 出演', desc: '本公演（先輩たちと同じ舞台）に出られる' },
  { name: '劇場の看板', desc: '劇場の看板芸人。ポスターの真ん中' },
];

// ------------------------------------------------------------------ personality / quirks / motivation of candidates
export const PERSONAS = {
  nekketsu: '熱血', cool: 'クール', tennen: '天然', rikutsu: '理屈っぽい', ochoshi: 'お調子者', shy: '人見知り', majime: 'まじめ', mypace: 'マイペース', negative: 'ネガティブ',
};
// effects: harmonyGain / harmonyLoss multipliers, start (harmony at formation), late (chance a ネタ合わせ starts late),
// decay (extra harmony loss per idle day), money (asks to borrow), stage (bonus to stage stat gains)
export const QUIRKS = {
  chikoku: { name: '遅刻癖', bad: true, late: 0.28, desc: 'ネタ合わせや待ち合わせに、よく遅れてくる' },
  shakkin: { name: '借金', bad: true, money: true, desc: 'お金にだらしない。ときどき「貸して」と言ってくる' },
  atsui: { name: '熱すぎる', harmonyGain: 1.3, harmonyLoss: 1.4, desc: '笑いに熱い。仲がいい時は最高、こじれると激しい' },
  tensai: { name: '天才肌', neta: 1.25, harmonyGain: 0.8, desc: 'ネタの才能はずば抜けているが、練習はきらい' },
  shy: { name: '人見知り', start: -8, harmonyGain: 1.2, desc: '最初は心を開かない。打ち解けると強い' },
  akippoi: { name: '飽きっぽい', bad: true, decay: 1, desc: 'ライブやネタ合わせが続かないと、やる気が下がる' },
  kanpeki: { name: '完璧主義', practice: 1.25, stress: 2, desc: 'ネタ合わせが長くて細かい。そのぶん仕上がる' },
  negative: { name: 'ネガティブ', harmonyLoss: 1.3, desc: 'スベると落ちこむ。ウケると素直に喜ぶ' },
  rouhi: { name: '浪費家', bad: true, greedy: true, desc: 'ギャラの取り分にうるさい' },
  hoko: { name: '方向音痴', late: 0.12, desc: 'よく道に迷う。悪気はない' },
  majime: { name: 'まじめ', harmonyGain: 1.15, desc: 'ネタ合わせを一日も休まない' },
  odayaka: { name: '穏やか', harmonyLoss: 0.7, desc: 'めったに怒らない。ケンカになりにくい' },
};
export const MOTIVES = {
  top: 'お笑いで天下を取りたい', fun: 'とにかく笑いが好き。楽しくやりたい', tv: 'テレビに出たい', money: '売れて、いい暮らしがしたい',
  family: '家族を楽にさせたい', escape: '会社員の人生から抜け出したい', dream: '子どものころからの夢',
};

// ------------------------------------------------------------------ era boards (相方募集)
// years: when the board exists in this world (the calendar year of the game, not the start era).
export const BOARDS = {
  zasshi: { name: '月刊わらいの友「相方募集」欄', short: '雑誌の投稿欄', kind: 'magazine', years: [1975, 1995], reply: [4, 7], contact: 'ハガキを出す', via: '手紙', meet: 'kissa', post: '投稿ハガキを送る', postDelay: 10, desc: 'お笑い雑誌の投稿ページ。ハガキで連絡する（返事は数日後）。' },
  pasotsu: { name: 'パソコン通信「ドットネット」お笑い会議室', short: 'パソコン通信', kind: 'bbs', years: [1985, 2000], reply: [1, 3], contact: 'メールを送る', via: 'パソコン通信のメール', meet: 'kissa', post: '会議室に書きこむ', postDelay: 2, desc: '電話回線でつなぐ会員制のネット。熱心な人が多い。' },
  webbbs: { name: 'お笑い相方募集BBS（インターネット掲示板）', short: 'ネット掲示板', kind: 'web', years: [1995, 2003], reply: [1, 2], contact: 'メールを送る', via: '電子メール', meet: 'kissa', post: '掲示板に書きこむ', postDelay: 2, desc: 'インターネットの掲示板。顔はわからない。' },
  keitai: { name: 'ケータイ掲示板「ドット掲示板」相方募集', short: 'ケータイ掲示板', kind: 'keitai', years: [2000, 2011], reply: [1, 1], contact: 'メールする', via: 'ケータイのメール', meet: 'famires', post: '掲示板に書きこむ', postDelay: 1, desc: 'ケータイの掲示板。返事は早いが、軽い人も多い。' },
  blog: { name: 'ドットブログ「#相方募集」', short: 'ブログ', kind: 'blog', years: [2003, 2012], reply: [1, 2], contact: 'コメントする', via: 'ブログのメッセージ', meet: 'famires', post: 'ブログに募集記事を書く', postDelay: 2, desc: 'ネタを公開しているブログ。文章から人柄がわかる。' },
  sns: { name: 'ドッター #相方募集', short: 'SNS', kind: 'sns', years: [2009, 9999], reply: [0, 1], contact: 'DMを送る', via: 'DM', meet: 'cafe', post: 'ドッターに投稿する', postDelay: 1, desc: 'SNSの「#相方募集」。ネタ動画を見てから会える。' },
  app: { name: '相方募集アプリ「アイカタ・マッチ」', short: '相方募集アプリ', kind: 'app', years: [2016, 9999], reply: [0, 1], contact: 'いいね！を送る', via: 'アプリのチャット', meet: 'cafe', post: 'プロフィールを公開する', postDelay: 1, desc: '芸人志望どうしのマッチングアプリ（架空）。' },
};
export const BOARD_ORDER = ['zasshi', 'pasotsu', 'webbbs', 'keitai', 'blog', 'sns', 'app'];
export const MEET_SPOTS = {
  kissa: { name: '喫茶店', drink: 'クリームソーダ', price: 600 },
  famires: { name: 'ファミレス', drink: 'ドリンクバー', price: 300 },
  cafe: { name: 'カフェ', drink: 'カフェラテ', price: 550 },
};

// ------------------------------------------------------------------ helpers
export const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
export function strHash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// a tiny deterministic PRNG for one id
export function idRng(id, salt = 0) {
  let a = (strHash(id) + salt * 0x9e3779b9) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ERA_BASE_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export const eraKey = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
// The game date of a day: { year, month, dom } (politics core's g.gameDate when loaded, the same calendar otherwise:
// day 1 = April 1 of the start year, 10 days a month).
export function dateOf(g, day) {
  try {
    if (g && typeof g.gameDate === 'function') {
      const d = day == null ? g.gameDate() : g.gameDate(day);
      if (d && Number.isFinite(d.year)) return { year: d.year, month: d.month, dom: d.dom || 1 };
    }
  } catch (e) { /* fall back */ }
  const st = g && g.state;
  const n = Math.max(0, ((day ?? (st && st.day)) || 1) - 1);
  const idx = 3 + Math.floor(n / 10);
  return { year: (ERA_BASE_YEAR[eraKey(g)] ?? 2026) + Math.floor(idx / 12), month: (idx % 12) + 1, dom: (n % 10) + 1 };
}
export const ymLabel = (d) => (d && d.year ? `${d.year}年${d.month}月` : '—');

// ------------------------------------------------------------------ deterministic looks
const HAIR_M = ['short', 'spiky', 'slick', 'short', 'afro', 'cap', 'bald', 'spiky', 'short'];
const HAIR_F = ['long', 'bob', 'twin', 'bob', 'long', 'short'];
const HAIR_X = ['bob', 'short', 'long', 'spiky'];
const TOPS = ['#d64161', '#2f6fd0', '#2f9a4a', '#ffd23f', '#ff8a3d', '#8a5ac8', '#3b3f48', '#f2f2f2', '#5fd7ff', '#c0452f', '#e8a0c0', '#5a6f8a'];
const BOTTOMS = ['#3a4a7a', '#2a2d36', '#5a4a3a', '#3b3f48', '#2a3560', '#6a5a8a'];
export function lookFor(id, gender, modern) {
  const r = idRng(id, 7);
  const pickR = (a) => a[Math.floor(r() * a.length)];
  const hair = pickR(gender === 'f' ? HAIR_F : gender === 'x' ? HAIR_X : HAIR_M);
  const colors = modern ? ['black', 'brown', 'brown', 'blonde', 'black', 'pink', 'blue', 'silver'] : ['black', 'black', 'brown', 'black'];
  const look = { hair, hairColor: pickR(colors), skin: pickR(['fair', 'light', 'fair', 'tan']), top: pickR(TOPS), bottom: pickR(BOTTOMS) };
  if (hair === 'cap') look.hat = pickR(['#d62f2f', '#2a2d36', '#2f6fd0']);
  if (gender === 'f' && r() < 0.5) look.skirt = true;
  if (r() < 0.22) look.glasses = true;
  if (r() < 0.18) look.jacket = true;
  return look;
}

// ------------------------------------------------------------------ the candidate pool
// stats: base level lv (every stat ≈ lv ± jitter) + highlights hi / weaknesses lo ('key:+n' list)
function parseMods(s) {
  const out = {};
  for (const part of String(s || '').split(/[,\s]+/).filter(Boolean)) { const [k, v] = part.split(':'); if (COMEDY_STATS[k]) out[k] = num(v); }
  return out;
}
export function baseStats(id, lv, hi, lo) {
  const r = idRng(id, 3);
  const h = parseMods(hi), l = parseMods(lo);
  const s = {};
  for (const k of STAT_KEYS) s[k] = clamp(Math.round(lv + (r() - 0.5) * 10 + (h[k] || 0) + (l[k] || 0)), 3, 92);
  return s;
}

// Candidate definitions. Fields: n (氏名), s (short), g (m/f/x), age, pref (profile.js PREFECTURES key), dial ('kansai'|'standard'),
// style ('manzai'|'conte'|'both'), role ('boke'|'tsukkomi'|'both'), lv, hi, lo, per (PERSONAS), q (QUIRKS ids), mot (MOTIVES),
// compat (hidden 相性 base 0..100), bar (the level they want from a partner; above it they turn you down), h (handle), post,
// say: their own line at the first meeting.
export const CANDIDATES = {};
function cand(id, def) { CANDIDATES[id] = { id, ...def }; }
// ---- 雑誌の投稿欄 (1975–1995)
cand('ow_zs_ken', { board: 'zasshi', n: '岡嶋 健吾', s: 'ケンジ', g: 'm', age: 21, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 28, hi: 'tsukkomi:20,voice:14,ma:8', lo: 'act:-8', per: 'nekketsu', q: ['atsui'], mot: 'top', compat: 72, bar: 0, h: 'なにわのケン',
  post: '漫才のボケ担当を求む。当方ツッコミ21歳、大阪出身・東京在住。本気で天下を取りたい人だけハガキ下さい。', say: 'ハガキおおきに！ケンジです。\n…ほんまに来てくれたんや。うれしいわ。' });
cand('ow_zs_yoko', { board: 'zasshi', n: '三輪 陽子', s: 'ヨーコ', g: 'f', age: 19, pref: 'shizuoka', dial: 'standard', style: 'conte', role: 'boke', lv: 22, hi: 'act:18,chara:14,hassou:8', lo: 'voice:-6', per: 'tennen', q: ['hoko'], mot: 'dream', compat: 64, bar: 0, h: 'ミカン娘',
  post: 'コントをやりたい19歳の女の子です。ボケ担当。台本を書ける人、いっしょに笑いをとりませんか？', say: 'あっ、ヨーコです！\n…ごめんなさい、駅で反対の出口に出ちゃって。' });
cand('ow_zs_tetsu', { board: 'zasshi', n: '石動 哲也', s: 'テツ', g: 'm', age: 26, pref: 'fukuoka', dial: 'standard', style: 'manzai', role: 'boke', lv: 34, hi: 'boke:16,wagei:12,dokyo:10', lo: 'kosei:-8', per: 'ochoshi', q: ['shakkin', 'rouhi'], mot: 'money', compat: 30, bar: 0, h: '博多の風雲児',
  post: 'すぐに売れる自信あり！ボケ担当26歳。ツッコミ募集。ギャラは山分け、細かいことは会ってから！', say: 'どーもどーも、テツです！\nいやあ、運命の出会いってやつですね、これは！' });
cand('ow_zs_masa', { board: 'zasshi', n: '北浦 正之', s: 'マサ', g: 'm', age: 24, pref: 'tokyo', dial: 'standard', style: 'both', role: 'tsukkomi', lv: 30, hi: 'kosei:16,neta:14,tsukkomi:8', lo: 'chara:-8,dokyo:-6', per: 'majime', q: ['kanpeki', 'shy'], mot: 'dream', compat: 60, bar: 0, h: 'マサ＠練馬',
  post: 'ネタは全部書きます。台本重視でコツコツやれる相方を探しています。漫才・コントどちらでも。', say: '…北浦です。\nあの、ネタ帳、持ってきました。見ますか。' });
cand('ow_zs_ryu', { board: 'zasshi', n: '竹之内 竜一', s: 'リュウ', g: 'm', age: 23, pref: 'hyogo', dial: 'kansai', style: 'manzai', role: 'boke', lv: 46, hi: 'hassou:22,neta:18,boke:14,adlib:10', lo: 'voice:-4', per: 'cool', q: ['tensai', 'akippoi'], mot: 'top', compat: 45, bar: 40, h: '神戸のリュウ',
  post: '才能ある奴だけ連絡くれ。ボケは俺がやる。中途半端な気持ちならお断り。', say: '竜一や。\n…で、自分、なにができるん？' });
cand('ow_zs_chika', { board: 'zasshi', n: '森口 千賀子', s: 'チカ', g: 'f', age: 28, pref: 'miyagi', dial: 'standard', style: 'both', role: 'tsukkomi', lv: 26, hi: 'tsukkomi:14,kankyaku:12,wagei:10', lo: 'hassou:-6', per: 'majime', q: ['majime'], mot: 'escape', compat: 66, bar: 0, h: '仙台の姉さん',
  post: 'OLやめて上京しました。28歳、ツッコミ担当。年齢は気にしない方、お便りください。', say: 'はじめまして、森口です。\nハガキの字、きれいだったからすぐわかったわ。' });
// ---- パソコン通信 (1985–2000)
cand('ow_ps_hiro', { board: 'pasotsu', n: '藤枝 浩', s: 'ヒロシ', g: 'm', age: 25, pref: 'saitama', dial: 'standard', style: 'conte', role: 'tsukkomi', lv: 30, hi: 'kosei:18,neta:14,act:6', lo: 'dokyo:-10', per: 'rikutsu', q: ['shy', 'kanpeki'], mot: 'dream', compat: 62, bar: 0, h: 'HIRO-CONTE',
  post: 'コント師の相方求む。脚本担当です。まずはオフで一度お会いしましょう。', say: '…あ、HIRO-CONTEです。\n実物の人と話すの、ひさしぶりで…。' });
cand('ow_ps_mai', { board: 'pasotsu', n: '吉居 麻衣', s: 'マイ', g: 'f', age: 20, pref: 'kanagawa', dial: 'standard', style: 'both', role: 'boke', lv: 24, hi: 'chara:16,adlib:12,boke:10', lo: 'kosei:-8', per: 'ochoshi', q: ['akippoi'], mot: 'tv', compat: 58, bar: 0, h: 'MAI★MAI',
  post: 'テレビに出たい！ボケ担当20歳です。ツッコミのうまい人、メールください(^^)', say: 'MAI★MAIでーす！\nえー、思ってたよりふつうの人だ！いい意味で！' });
cand('ow_ps_goro', { board: 'pasotsu', n: '黒田 吾郎', s: 'ゴロー', g: 'm', age: 31, pref: 'hokkaido', dial: 'standard', style: 'manzai', role: 'tsukkomi', lv: 33, hi: 'wagei:14,ma:14,tsukkomi:10', lo: 'chara:-8', per: 'mypace', q: ['odayaka'], mot: 'family', compat: 68, bar: 0, h: 'GORO_SAPPORO',
  post: '31歳、遅咲き上等。札幌で漫才をしていました。落ち着いて長くやれる相方を。', say: '黒田です。遠いところ、どうも。\nまあ、のんびりいきましょう。' });
cand('ow_ps_sho', { board: 'pasotsu', n: '西浦 翔', s: 'ショウ', g: 'm', age: 18, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'boke', lv: 20, hi: 'boke:14,dokyo:14,voice:10', lo: 'kosei:-10,neta:-6', per: 'ochoshi', q: ['chikoku', 'atsui'], mot: 'top', compat: 50, bar: 0, h: 'SHO-NAMBA',
  post: '高校出たばっかやけど、なめんといて！ボケ担当。ツッコミ募集中！', say: 'すんません、遅れました！\n電車、一本まちがえてもうて！' });
cand('ow_ps_eri', { board: 'pasotsu', n: '佐々野 絵里', s: 'エリ', g: 'f', age: 23, pref: 'tokyo', dial: 'standard', style: 'conte', role: 'both', lv: 38, hi: 'act:22,mane:16,chara:10', lo: 'wagei:-6', per: 'cool', q: ['tensai', 'kanpeki'], mot: 'top', compat: 52, bar: 34, h: 'ERI/ACTRESS',
  post: '劇団出身。コントの演技力には自信あり。本気の人のみ。', say: '佐々野です。\n時間がもったいないから、さっそく本題に入りましょう。' });
cand('ow_ps_kazu', { board: 'pasotsu', n: '大野 和夫', s: 'カズ', g: 'm', age: 29, pref: 'chiba', dial: 'standard', style: 'manzai', role: 'boke', lv: 27, hi: 'boke:12,hassou:12', lo: 'voice:-6', per: 'negative', q: ['shakkin', 'negative'], mot: 'escape', compat: 28, bar: 0, h: 'KAZU_CHIBA',
  post: '会社がつぶれました。人生をかけて笑いを。ツッコミ募集。', say: '大野です…。\nあ、ここのお茶代、あとで返しますんで…。' });
// ---- インターネット掲示板 (1995–2003)
cand('ow_wb_daisuke', { board: 'webbbs', n: '坂根 大輔', s: 'ダイスケ', g: 'm', age: 22, pref: 'kyoto', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 32, hi: 'tsukkomi:18,ma:12,kankyaku:10', lo: 'act:-6', per: 'cool', q: ['majime'], mot: 'top', compat: 70, bar: 0, h: 'だいすけ＠京都',
  post: '[相方募集] 京都出身22歳ツッコミ。全国ネットに出られる漫才師になりたい。ボケの方メールください。', say: '坂根です。メールの感じのまんまやな。\n…ええ意味で言うてるで。' });
cand('ow_wb_ayaka', { board: 'webbbs', n: '仲島 彩香', s: 'アヤカ', g: 'f', age: 21, pref: 'aichi', dial: 'standard', style: 'conte', role: 'boke', lv: 28, hi: 'hassou:18,act:12,chara:10', lo: 'voice:-6', per: 'tennen', q: ['hoko'], mot: 'dream', compat: 60, bar: 0, h: 'あやか(=^・^=)',
  post: '[相方募集] 名古屋から上京。不思議なコントがやりたいです。ツッコミさん大募集！', say: 'あやかです〜。\nここ、来るのに三回まちがえました。' });
cand('ow_wb_taku', { board: 'webbbs', n: '松葉 拓海', s: 'タクミ', g: 'm', age: 20, pref: 'tokyo', dial: 'standard', style: 'both', role: 'boke', lv: 22, hi: 'adlib:14,chara:12', lo: 'neta:-10,kosei:-8', per: 'ochoshi', q: ['chikoku', 'akippoi'], mot: 'tv', compat: 35, bar: 0, h: 'TAKU＠渋谷',
  post: '[相方募集] ノリで生きてます！テレビ出たい！ネタは…これから！', say: 'ちわーっす、タクミっす！\nいやー、寝坊しました！' });
cand('ow_wb_satoshi', { board: 'webbbs', n: '高森 聡', s: 'サトシ', g: 'm', age: 27, pref: 'hiroshima', dial: 'standard', style: 'manzai', role: 'boke', lv: 36, hi: 'wagei:16,boke:14,neta:10', lo: 'dokyo:-4', per: 'majime', q: ['kanpeki'], mot: 'family', compat: 66, bar: 0, h: 'さとし＠広島',
  post: '[相方募集] 広島出身27歳、しゃべくり漫才のボケ。ネタはしっかり作る派です。', say: '高森です。\n今日のために、ネタを三本、書いてきたんじゃ。' });
cand('ow_wb_rina', { board: 'webbbs', n: '村越 里奈', s: 'リナ', g: 'f', age: 24, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 40, hi: 'tsukkomi:20,voice:16,dokyo:12', lo: 'hassou:-6', per: 'nekketsu', q: ['atsui'], mot: 'top', compat: 54, bar: 34, h: 'リナ＠ミナミ',
  post: '[相方募集] ツッコミ歴6年。腕に自信あり。ヌルい人はお断りやで。', say: '村越や。\n…ほな、まずボケてみて。話はそれからや。' });
cand('ow_wb_ken', { board: 'webbbs', n: '杉森 健', s: 'ケン', g: 'm', age: 33, pref: 'niigata', dial: 'standard', style: 'conte', role: 'tsukkomi', lv: 25, hi: 'kosei:12,act:10', lo: 'voice:-8', per: 'negative', q: ['negative', 'shakkin'], mot: 'escape', compat: 32, bar: 0, h: 'ken33',
  post: '[相方募集] 33歳、人生最後の挑戦です。コントのツッコミ。', say: '杉森です…。\nこんなおじさんで、すみません。' });
// ---- ケータイ掲示板 (2000–2011)
cand('ow_kt_yuta', { board: 'keitai', n: '青柳 雄太', s: 'ユウタ', g: 'm', age: 20, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'boke', lv: 30, hi: 'boke:18,hassou:14,adlib:8', lo: 'kosei:-6', per: 'ochoshi', q: ['chikoku'], mot: 'top', compat: 66, bar: 0, h: 'ゆうた☆なにわ',
  post: '漫才やりたい人おらん？？ボケやるからツッコミ募集！本気やで(￣ー￣)', say: 'ゆうたです！ごめん、ちょい遅れた！\nあ、ドリンクバー取ってくるわ！' });
cand('ow_kt_misaki', { board: 'keitai', n: '小宮 美咲', s: 'ミサキ', g: 'f', age: 19, pref: 'chiba', dial: 'standard', style: 'conte', role: 'tsukkomi', lv: 24, hi: 'tsukkomi:14,act:12,chara:8', lo: 'hassou:-6', per: 'shy', q: ['shy'], mot: 'dream', compat: 62, bar: 0, h: 'みさき♪',
  post: 'コントのツッコミやりたいです…！人見知りだけど、舞台ではがんばれます。', say: '…み、美咲です。\nよ、よろしくお願いします…。' });
cand('ow_kt_takahiro', { board: 'keitai', n: '斎藤 隆弘', s: 'タカ', g: 'm', age: 28, pref: 'kanagawa', dial: 'standard', style: 'both', role: 'tsukkomi', lv: 34, hi: 'wagei:14,kosei:14,kankyaku:10', lo: 'chara:-6', per: 'rikutsu', q: ['kanpeki'], mot: 'money', compat: 58, bar: 0, h: 'TAKA_y',
  post: '戦略的に売れたい人。客層分析とネタの構成は任せてください。', say: '斎藤です。\n今日は「相方としての条件」をすり合わせたいと思って。' });
cand('ow_kt_jun', { board: 'keitai', n: '野口 純', s: 'ジュン', g: 'm', age: 22, pref: 'kagoshima', dial: 'standard', style: 'manzai', role: 'boke', lv: 26, hi: 'voice:16,chara:12,dokyo:10', lo: 'neta:-8', per: 'nekketsu', q: ['atsui', 'rouhi'], mot: 'tv', compat: 40, bar: 0, h: 'JUN鹿児島',
  post: '声のデカさは日本一！ボケ担当！ネタ書いてくれる人求む！', say: '野口純です！！\n…あ、声デカいってよく言われます！！' });
cand('ow_kt_nana', { board: 'keitai', n: '菅原 七海', s: 'ナナ', g: 'f', age: 23, pref: 'tokyo', dial: 'standard', style: 'conte', role: 'boke', lv: 42, hi: 'act:20,mane:18,hassou:12', lo: 'tsukkomi:-8', per: 'cool', q: ['tensai'], mot: 'top', compat: 50, bar: 38, h: 'nana_7',
  post: 'コントのボケ。ものまねもやります。レベルの高い人だけ。', say: '菅原です。\nネタ、何本か見せてもらえる？' });
cand('ow_kt_shingo', { board: 'keitai', n: '西垣 慎吾', s: 'シンゴ', g: 'm', age: 25, pref: 'mie', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 23, hi: 'tsukkomi:10,ma:8', lo: 'dokyo:-8', per: 'negative', q: ['shakkin', 'akippoi'], mot: 'escape', compat: 26, bar: 0, h: 'しんご',
  post: '仕事やめて芸人めざしてます。ツッコミ。誰でもいいので組んでください。', say: '西垣です…。\nあの、今月ちょっとピンチで…いや、なんでもないです。' });
// ---- ブログ (2003–2012)
cand('ow_bl_haruka', { board: 'blog', n: '遠山 遥', s: 'ハルカ', g: 'f', age: 22, pref: 'kyoto', dial: 'kansai', style: 'manzai', role: 'boke', lv: 30, hi: 'boke:16,wagei:12,chara:10', lo: '', per: 'tennen', q: ['hoko'], mot: 'dream', compat: 64, bar: 0, h: 'はるかの笑い日記',
  post: '【相方募集】ブログでネタを書いてる京都の22歳です。しゃべくり漫才のボケがしたい！', say: '遥です〜。ブログ読んでくれたん？\nうれしいなあ、あれ読者3人やねん。' });
cand('ow_bl_kouhei', { board: 'blog', n: '林 航平', s: 'コウヘイ', g: 'm', age: 24, pref: 'tokyo', dial: 'standard', style: 'conte', role: 'tsukkomi', lv: 34, hi: 'kosei:18,neta:16,act:8', lo: 'voice:-6', per: 'rikutsu', q: ['kanpeki', 'shy'], mot: 'top', compat: 60, bar: 0, h: 'コント設計図',
  post: '【相方募集】コントの台本を毎日ブログに上げています。演じてくれる相方を探しています。', say: '林です。\n…ブログのコメント、あなたでしたか。的確でした。' });
cand('ow_bl_gen', { board: 'blog', n: '田村 源太', s: 'ゲンタ', g: 'm', age: 30, pref: 'kumamoto', dial: 'standard', style: 'manzai', role: 'tsukkomi', lv: 28, hi: 'voice:16,tsukkomi:12,kankyaku:10', lo: 'hassou:-6', per: 'nekketsu', q: ['majime', 'atsui'], mot: 'family', compat: 68, bar: 0, h: 'ゲンタの火の国日記',
  post: '【相方募集】熊本から来た30歳。ツッコミ。故郷の母に、テレビに出る姿を見せたい。', say: '田村源太です！\n今日は、会ってくれてありがとうございます！' });
cand('ow_bl_ryo', { board: 'blog', n: '本庄 涼', s: 'リョウ', g: 'm', age: 21, pref: 'saitama', dial: 'standard', style: 'both', role: 'boke', lv: 22, hi: 'chara:14,adlib:10', lo: 'kosei:-8', per: 'ochoshi', q: ['akippoi', 'rouhi'], mot: 'money', compat: 38, bar: 0, h: 'RYO-style',
  post: '【相方募集】売れたら車買う！ボケ担当。おもしろい人ならだれでも。', say: 'リョウっす！\nこれ、新しく買ったスニーカーっす。かっこよくないっすか？' });
cand('ow_bl_aki', { board: 'blog', n: '河井 亜紀', s: 'アキ', g: 'f', age: 26, pref: 'ishikawa', dial: 'standard', style: 'conte', role: 'both', lv: 36, hi: 'act:18,hassou:14,mane:10', lo: 'voice:-4', per: 'mypace', q: ['odayaka'], mot: 'fun', compat: 56, bar: 0, h: 'あきのコント部屋',
  post: '【相方募集】のんびりコントを作るのが好き。いっしょに楽しめる人。', say: '河井です。\n…あ、このパフェおいしい。あなたも食べる？' });
cand('ow_bl_toru', { board: 'blog', n: '長谷川 徹', s: 'トオル', g: 'm', age: 35, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'boke', lv: 44, hi: 'wagei:20,ma:18,boke:12,neta:10', lo: 'chara:-8', per: 'rikutsu', q: ['tensai', 'negative'], mot: 'top', compat: 42, bar: 40, h: '元漫才師の反省文',
  post: '【相方募集】元・漫才師。もう一度だけ本気でやる。半端な腕なら来ないでくれ。', say: '長谷川や。\n…先に言うとく。わしは、甘ないで。' });
// ---- SNS ドッター (2009–)
cand('ow_sn_sora', { board: 'sns', n: '川口 空', s: 'ソラ', g: 'm', age: 20, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 30, hi: 'tsukkomi:18,ma:12,voice:10', lo: '', per: 'nekketsu', q: ['majime'], mot: 'top', compat: 70, bar: 0, h: '@sora_tsukkomi',
  post: '#相方募集 ツッコミ20歳／大阪→東京／漫才でてっぺん取りたい。ボケの人、DMください', say: 'ソラです！DMおおきに！\n動画で見るより、実物のほうがおもろそうやな！' });
cand('ow_sn_yui', { board: 'sns', n: '井ノ口 結衣', s: 'ユイ', g: 'f', age: 22, pref: 'kanagawa', dial: 'standard', style: 'conte', role: 'boke', lv: 28, hi: 'hassou:16,act:12,chara:10', lo: '', per: 'shy', q: ['shy'], mot: 'dream', compat: 62, bar: 0, h: '@yui_conte',
  post: '#相方募集 コントのボケ／22歳／ネタ動画あげてます。ツッコミさん、まずはDMで…！', say: '…ユイです。\nDMだと元気なのに、って言われます…。' });
cand('ow_sn_kaito', { board: 'sns', n: '原 海斗', s: 'カイト', g: 'm', age: 24, pref: 'tokyo', dial: 'standard', style: 'both', role: 'boke', lv: 34, hi: 'chara:16,adlib:14,mane:10', lo: 'kosei:-8', per: 'ochoshi', q: ['rouhi', 'chikoku'], mot: 'tv', compat: 44, bar: 0, h: '@kaito_buzz',
  post: '#相方募集 フォロワー1万人の動画芸人。舞台もやりたい！ネタ書ける人求む', say: 'どもー、カイトでーす。\nあ、これ撮っていいすか？「相方候補と初対面」って。' });
cand('ow_sn_mio', { board: 'sns', n: '長井 澪', s: 'ミオ', g: 'f', age: 25, pref: 'fukuoka', dial: 'standard', style: 'manzai', role: 'tsukkomi', lv: 38, hi: 'tsukkomi:18,wagei:14,kankyaku:12', lo: '', per: 'cool', q: ['kanpeki'], mot: 'top', compat: 56, bar: 32, h: '@mio_manzai',
  post: '#相方募集 ツッコミ／養成所中退／本気で賞レースを勝ちにいける人だけ', say: '長井です。\n単刀直入に聞くね。どこまで本気？' });
cand('ow_sn_daichi', { board: 'sns', n: '秋吉 大地', s: 'ダイチ', g: 'm', age: 27, pref: 'hokkaido', dial: 'standard', style: 'manzai', role: 'boke', lv: 26, hi: 'boke:12,voice:10', lo: 'neta:-8', per: 'negative', q: ['shakkin', 'negative'], mot: 'escape', compat: 28, bar: 0, h: '@daichi_hokkai',
  post: '#相方募集 ブラック企業やめた。笑いで人生変えたい。ツッコミの人', say: '秋吉です…。\nあの、ここ、割り勘で大丈夫ですか…。' });
cand('ow_sn_rei', { board: 'sns', n: '片山 怜', s: 'レイ', g: 'x', age: 23, pref: 'kyoto', dial: 'standard', style: 'conte', role: 'both', lv: 46, hi: 'neta:22,hassou:20,kosei:14', lo: 'dokyo:-6,voice:-4', per: 'cool', q: ['tensai', 'shy'], mot: 'top', compat: 48, bar: 42, h: '@rei_kakuu',
  post: '#相方募集 コントの台本を書きます。演じられる人。ネタを3本送ってくれた人とだけ会います', say: '…片山です。\n送ってくれたネタ、読みました。話はそれから。' });
// ---- 相方募集アプリ (2016–)
cand('ow_ap_hinata', { board: 'app', n: '小川 陽向', s: 'ヒナタ', g: 'm', age: 19, pref: 'hyogo', dial: 'kansai', style: 'manzai', role: 'boke', lv: 26, hi: 'boke:16,dokyo:12,chara:10', lo: 'kosei:-8', per: 'ochoshi', q: ['chikoku'], mot: 'top', compat: 64, bar: 0, h: 'ひなた（19・ボケ）',
  post: 'マッチありがとうございます！神戸の19歳、漫才のボケ。勢いだけは負けません！', say: 'ヒナタです！すんません、改札で迷子になってました！' });
cand('ow_ap_saki', { board: 'app', n: '岡部 咲', s: 'サキ', g: 'f', age: 21, pref: 'saitama', dial: 'standard', style: 'conte', role: 'tsukkomi', lv: 30, hi: 'tsukkomi:14,act:14,kosei:10', lo: '', per: 'majime', q: ['majime'], mot: 'dream', compat: 68, bar: 0, h: 'サキ（21・ツッコミ）',
  post: 'コントのツッコミ。毎日ネタ合わせできます。まじめにやれる人を探しています。', say: '岡部咲です。\n今日はよろしくお願いします。メモ、とってもいいですか？' });
cand('ow_ap_ren', { board: 'app', n: '武居 蓮', s: 'レン', g: 'm', age: 26, pref: 'aichi', dial: 'standard', style: 'both', role: 'tsukkomi', lv: 36, hi: 'kosei:18,neta:14,kankyaku:10', lo: 'chara:-6', per: 'rikutsu', q: ['kanpeki'], mot: 'money', compat: 58, bar: 0, h: 'レン（26・作家志望）',
  post: '構成作家志望のツッコミ。データで勝つ漫才を作りたい。', say: '武居です。\nいくつかの賞レースの傾向をまとめてきました。見ます？' });
cand('ow_ap_kotone', { board: 'app', n: '宮内 琴音', s: 'コトネ', g: 'f', age: 24, pref: 'nagano', dial: 'standard', style: 'manzai', role: 'boke', lv: 24, hi: 'hassou:14,chara:12', lo: 'voice:-8', per: 'mypace', q: ['hoko', 'odayaka'], mot: 'fun', compat: 60, bar: 0, h: 'ことね（24・ボケ）',
  post: 'ゆるっと漫才がしたいです。長野出身。のんびりでも続けられる人。', say: '宮内です〜。\nこのお店、ずっと来てみたかったんです。' });
cand('ow_ap_yamato', { board: 'app', n: '真柴 大和', s: 'ヤマト', g: 'm', age: 29, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 40, hi: 'tsukkomi:20,voice:16,ma:12', lo: 'hassou:-6', per: 'nekketsu', q: ['atsui', 'shakkin'], mot: 'top', compat: 46, bar: 36, h: 'ヤマト（29・ツッコミ）',
  post: '前のコンビ解散。結成何年目でもええ、勝てる相方がほしい。', say: '真柴や。\nもう回り道はできへん。…自分、腕は確かなんやろな。' });
cand('ow_ap_kanon', { board: 'app', n: '植田 花音', s: 'カノン', g: 'f', age: 20, pref: 'okinawa', dial: 'standard', style: 'conte', role: 'both', lv: 22, hi: 'chara:14,mane:12,act:8', lo: 'neta:-8', per: 'tennen', q: ['akippoi', 'rouhi'], mot: 'tv', compat: 34, bar: 0, h: 'カノン（20・なんでも）',
  post: 'テレビに出たい！沖縄出身です。おもしろそうなことならなんでも！', say: 'カノンでーす！\nはいさい！…って、東京の人には通じないか！' });
// ---- NSC 大阪校の同期 (fictional classmates)
cand('ow_no_kenta', { nsc: 'osaka', n: '谷岡 健太', s: 'ケンタ', g: 'm', age: 19, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 26, hi: 'tsukkomi:16,voice:12', lo: '', per: 'nekketsu', q: ['majime'], mot: 'top', compat: 66, bar: 0, say: '谷岡健太や！同期やな、よろしく！\n…自分、相方まだおらんの？' });
cand('ow_no_asami', { nsc: 'osaka', n: '辻 あさみ', s: 'アサミ', g: 'f', age: 20, pref: 'nara', dial: 'kansai', style: 'manzai', role: 'boke', lv: 24, hi: 'boke:14,chara:12,hassou:8', lo: '', per: 'tennen', q: ['hoko'], mot: 'dream', compat: 62, bar: 0, say: 'あさみです〜。奈良から通てんねん。\n毎朝、電車で二回寝過ごすねん。' });
cand('ow_no_shun', { nsc: 'osaka', n: '福留 駿', s: 'シュン', g: 'm', age: 18, pref: 'wakayama', dial: 'kansai', style: 'conte', role: 'boke', lv: 22, hi: 'act:14,hassou:12', lo: 'kosei:-6', per: 'ochoshi', q: ['chikoku'], mot: 'tv', compat: 54, bar: 0, say: 'シュンです！和歌山から来ました！\nコントやりたいんすよ、コント！' });
cand('ow_no_maki', { nsc: 'osaka', n: '浅井 真紀', s: 'マキ', g: 'f', age: 23, pref: 'hyogo', dial: 'kansai', style: 'both', role: 'tsukkomi', lv: 30, hi: 'tsukkomi:14,kosei:12,kankyaku:10', lo: '', per: 'majime', q: ['kanpeki'], mot: 'top', compat: 60, bar: 0, say: '浅井です。\nネタ見せの講評、ぜんぶノートにとってるんよ。' });
cand('ow_no_gaku', { nsc: 'osaka', n: '大西 岳', s: 'ガク', g: 'm', age: 21, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'boke', lv: 34, hi: 'boke:18,neta:14,hassou:12', lo: '', per: 'cool', q: ['tensai'], mot: 'top', compat: 48, bar: 30, say: '大西や。\n…ネタ見せ、見とったで。まあまあやな。' });
cand('ow_no_tora', { nsc: 'osaka', n: '金田 虎之介', s: 'トラ', g: 'm', age: 25, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'tsukkomi', lv: 22, hi: 'voice:16,dokyo:12', lo: 'kosei:-8', per: 'nekketsu', q: ['atsui', 'shakkin'], mot: 'money', compat: 36, bar: 0, say: '金田虎之介、トラでええ！\n…すまん、昼メシ代、ちょっと貸してくれへん？' });
cand('ow_no_yuki', { nsc: 'osaka', n: '白川 由紀', s: 'ユキ', g: 'f', age: 19, pref: 'shiga', dial: 'kansai', style: 'conte', role: 'both', lv: 20, hi: 'mane:14,act:10', lo: 'dokyo:-6', per: 'shy', q: ['shy'], mot: 'dream', compat: 58, bar: 0, say: '…白川です。\nものまね、ちょっとだけできます…。' });
cand('ow_no_ichiro', { nsc: 'osaka', n: '上野 一郎', s: 'イチロー', g: 'm', age: 30, pref: 'okayama', dial: 'standard', style: 'manzai', role: 'boke', lv: 28, hi: 'wagei:16,ma:10', lo: '', per: 'mypace', q: ['odayaka'], mot: 'escape', compat: 64, bar: 0, say: '上野です。会社を辞めて入りました。\n同期でいちばん年上ですが、よろしく。' });
// ---- NSC 東京校の同期 (fictional classmates)
cand('ow_nt_takumi', { nsc: 'tokyo', n: '今泉 拓実', s: 'タクミ', g: 'm', age: 20, pref: 'tokyo', dial: 'standard', style: 'manzai', role: 'tsukkomi', lv: 26, hi: 'tsukkomi:16,ma:10', lo: '', per: 'majime', q: ['majime'], mot: 'top', compat: 66, bar: 0, say: '今泉です。同期だね、よろしく。\n相方、もう決まってる？' });
cand('ow_nt_rin', { nsc: 'tokyo', n: '水野 凛', s: 'リン', g: 'f', age: 19, pref: 'chiba', dial: 'standard', style: 'conte', role: 'boke', lv: 24, hi: 'hassou:14,act:12', lo: '', per: 'tennen', q: ['hoko'], mot: 'dream', compat: 60, bar: 0, say: '水野凛です。\n教室の場所、まだ覚えられないんです…。' });
cand('ow_nt_kohei', { nsc: 'tokyo', n: '桑原 浩平', s: 'コーヘー', g: 'm', age: 22, pref: 'saitama', dial: 'standard', style: 'both', role: 'boke', lv: 28, hi: 'boke:14,chara:12,adlib:10', lo: '', per: 'ochoshi', q: ['chikoku', 'rouhi'], mot: 'tv', compat: 50, bar: 0, say: 'コーヘーでーす！\n授業、今日も5分遅刻しちゃった！' });
cand('ow_nt_aoi', { nsc: 'tokyo', n: '新居 葵', s: 'アオイ', g: 'f', age: 24, pref: 'gunma', dial: 'standard', style: 'manzai', role: 'tsukkomi', lv: 30, hi: 'tsukkomi:14,wagei:12,kankyaku:10', lo: '', per: 'cool', q: ['kanpeki'], mot: 'top', compat: 58, bar: 0, say: '新居です。\n…あなたのネタ見せ、ツカミは悪くなかった。' });
cand('ow_nt_genki', { nsc: 'tokyo', n: '荒木 元気', s: 'ゲンキ', g: 'm', age: 18, pref: 'kanagawa', dial: 'standard', style: 'conte', role: 'tsukkomi', lv: 22, hi: 'voice:14,dokyo:12', lo: '', per: 'nekketsu', q: ['atsui'], mot: 'fun', compat: 56, bar: 0, say: '荒木元気です！！名前のとおり元気です！！' });
cand('ow_nt_shiori', { nsc: 'tokyo', n: '千葉 詩織', s: 'シオリ', g: 'f', age: 27, pref: 'miyagi', dial: 'standard', style: 'conte', role: 'both', lv: 34, hi: 'neta:16,kosei:14,act:10', lo: '', per: 'rikutsu', q: ['tensai', 'shy'], mot: 'top', compat: 48, bar: 28, say: '千葉です。\n…ネタの話以外は、あまり得意じゃなくて。' });
cand('ow_nt_masaru', { nsc: 'tokyo', n: '堀 勝', s: 'マサル', g: 'm', age: 32, pref: 'osaka', dial: 'kansai', style: 'manzai', role: 'boke', lv: 30, hi: 'wagei:16,boke:12', lo: '', per: 'mypace', q: ['odayaka', 'shakkin'], mot: 'escape', compat: 52, bar: 0, say: '堀や。大阪から東京校に来たで。\nなんでって？…東京で売れたかってん。' });
cand('ow_nt_ema', { nsc: 'tokyo', n: '江口 恵麻', s: 'エマ', g: 'f', age: 21, pref: 'tokyo', dial: 'standard', style: 'both', role: 'boke', lv: 26, hi: 'chara:14,mane:12', lo: '', per: 'ochoshi', q: ['akippoi'], mot: 'tv', compat: 44, bar: 0, say: 'エマでーす！\nNSCって、思ったより体育会系だよね！' });

export const NSC_COHORT = { osaka: Object.keys(CANDIDATES).filter((id) => CANDIDATES[id].nsc === 'osaka'), tokyo: Object.keys(CANDIDATES).filter((id) => CANDIDATES[id].nsc === 'tokyo') };
export const boardCandidates = (b) => Object.keys(CANDIDATES).filter((id) => CANDIDATES[id].board === b);
export const isCandidate = (id) => !!CANDIDATES[id];
// a candidate's stats as defined (the core keeps their growing copy in st.owarai.members)
export const candStats = (id) => { const c = CANDIDATES[id]; return c ? baseStats(id, c.lv, c.hi, c.lo) : null; };

// ------------------------------------------------------------------ lines (by dialect)
const K = (c) => c && c.dial === 'kansai';
export const MOTIVE_LINES = {
  top: ['やるからには、てっぺんや。\n全国の賞レースで勝ちたいねん。', 'やるからには、いちばん上を目指したい。\n賞レースで勝てる芸人になりたいんだ。'],
  fun: ['笑いが好きなだけやねん。\n楽しくやれたら、それでええ。', '笑いが好きなだけなんだ。\n楽しくやれたら、それでいい。'],
  tv: ['テレビに出たいねん！\nゴールデンのひな壇、座ってみたいわ。', 'テレビに出たいんだ！\nゴールデンのひな壇に座ってみたい。'],
  money: ['売れて、ええ暮らしがしたい。\n正直に言うたら、それが一番やな。', '売れて、いい暮らしがしたい。\n正直に言うと、それが一番。'],
  family: ['親に、テレビに出てる姿を見せたいねん。\nずっと苦労かけてきたから。', '家族に、テレビに出てる姿を見せたいんだ。\nずっと苦労をかけてきたから。'],
  escape: ['会社員のままで終わりたなかってん。\nこれが最後のチャンスやと思てる。', '会社員のままで終わりたくなかった。\nこれが最後のチャンスだと思ってる。'],
  dream: ['子どものころからの夢やねん。\nテレビの前で、ずっとマネしとった。', '子どものころからの夢なんだ。\nテレビの前で、ずっとマネしてた。'],
};
export const STYLE_LINES = {
  manzai: ['やりたいのは、しゃべくり漫才やな。\nセンターマイク一本で勝負したい。', 'やりたいのは、しゃべくり漫才。\nセンターマイク一本で勝負したい。'],
  conte: ['コントがやりたいねん。\n設定と演技で、世界を作りたい。', 'コントがやりたいんだ。\n設定と演技で、ひとつの世界を作りたい。'],
  both: ['漫才もコントも、どっちもやりたい。\n欲ばりやろ？', '漫才もコントも、どっちもやりたい。\n欲ばりかな？'],
};
export const ROLE_LINES = {
  boke: ['ボケがやりたい。\nツッコまれてナンボやからな。', 'わたしはボケがやりたい。\nツッコまれてナンボだから。'],
  tsukkomi: ['ツッコミやな。\nボケを生かすのが好きやねん。', 'ツッコミがいい。\nボケを生かすのが好きなんだ。'],
  both: ['どっちでもええよ。\nネタによって変えたらええ。', 'どっちでもいいよ。\nネタによって変えればいい。'],
};
// what the player notices about a quirk at the meeting (narration)
export const QUIRK_TELLS = {
  chikoku: '（約束の時間を20分すぎてから、あわてて来た）',
  shakkin: '（会計の話になると、さっと目をそらした）',
  atsui: '（ネタの話になると、身を乗り出して熱く語る）',
  tensai: '（話のはしばしに、ひらめきの鋭さを感じる）',
  shy: '（目を合わせてくれない。でもネタの話は真剣だ）',
  akippoi: '（話題がころころ変わる。スマホ／手帳をちらちら見ている）',
  kanpeki: '（ノートに、ネタの直しがびっしり書きこんである）',
  negative: '（「どうせ」が口ぐせみたいだ）',
  rouhi: '（新しそうな服と時計。でも「金がない」と言う）',
  hoko: '（「ここに来るまでに二回迷った」と笑っている）',
  majime: '（約束の10分前に来ていたらしい）',
  odayaka: '（ずっとにこにこしている。怒ったところが想像できない）',
};
export function line(c, table, key) {
  const t = table[key];
  if (!t) return '';
  return K(c) ? t[0] : t[1];
}
// generic lines for registered candidates (phone small talk etc.)
function messagesFor(c) {
  const k = K(c);
  return k ? ['きのう、ネタ三本書いたで。\n二本はボツやけど！', '今日のバイト、店長にツッコんでもうた。\n反射ってこわいな。', 'ネタ帳、もう一冊目が終わりそうや。', '寝る前に考えたボケ、\n朝起きたら全然おもろなかった。']
    : ['きのう、ネタを三本書いたよ。\n二本はボツだけど。', '今日のバイト、店長にツッコみそうになった。', 'ネタ帳、一冊目が終わりそう。', '寝る前に考えたボケ、\n朝になったら全然おもしろくなかった。'];
}
function partnerMessagesFor(c) {
  const k = K(c);
  return k ? ['相方！新しいネタの設定、思いついたで。\n次のネタ合わせで聞いてや！', 'きのうのネタ合わせ、ええ感じやったな。', 'ライブのエントリー、どうする？\nそろそろ場数ふまなあかんで。']
    : ['相方！新しいネタの設定を思いついた。\n次のネタ合わせで聞いて！', 'きのうのネタ合わせ、いい感じだったね。', 'ライブのエントリー、どうする？\nそろそろ場数をふまないと。'];
}

// Register every candidate as a person (life.js). where / chats are refreshed by the core while they are your 相方.
for (const c of Object.values(CANDIDATES)) {
  const modern = c.board ? ['keitai', 'blog', 'sns', 'app'].includes(c.board) : false;
  const look = lookFor(c.id, c.g, modern);
  c.look = look;
  registerPerson(c.id, {
    name: c.n, short: c.s, look, kind: 'comedian', dialect: c.dial === 'kansai' ? 'kansai' : 'standard', canPartner: true,
    where: c.nsc ? `NSC${c.nsc === 'osaka' ? '大阪校' : '東京校'}（同期）` : `相方募集（${BOARDS[c.board].short}）`,
    profile: `${c.age}歳・${prefecture(c.pref).name}出身・${PERSONAS[c.per] || ''}。${STYLES[c.style] || ''}の${ROLES[c.role] || ''}志望。`,
    likes: ['onigiri', 'bento', 'netacho', 'manga'], loves: c.dial === 'kansai' ? ['takoyaki', 'butaman'] : ['cake', 'drink'], dislikes: ['accessory'],
    messages: messagesFor(c), partnerMessages: partnerMessagesFor(c), invites: K(c) ? ['今日ひま？「{spot}」行かへん？\nネタの話もしたいねん。'] : ['今日ひま？「{spot}」に行かない？\nネタの話もしたいんだ。'],
    greet: (g) => { const p = g.state.partner === c.id || (g.unit && g.unit() && g.unit().members.some((m) => m.id === c.id)); return p ? (K(c) ? '相方！今日もネタ合わせしよか！' : '相方！今日もネタ合わせしよう！') : (K(c) ? 'おう、{name}。どないしたん？' : 'あ、{name}。どうしたの？'); },
    chats: K(c) ? ['ネタの話しよか。…いや、まずは腹ごしらえや。', 'きのうのライブ、客がおもろかったわ。'] : ['ネタの話しよう。…いや、まずは腹ごしらえかな。', 'きのう見たライブ、すごかったよ。'],
    owarai: { candidate: true },
  });
}
export const personName = (id) => (PEOPLE[id] ? PEOPLE[id].short || PEOPLE[id].name : id);

// 'people' partners (people.js cast): their comedy stats when they join your act (old saves too)
export const CAST_STATS = {
  jiro: { lv: 32, hi: 'boke:16,wagei:14,ma:10,voice:8', lo: 'kosei:-6', role: 'boke' },
  momo: { lv: 30, hi: 'hassou:16,chara:14,neta:10', lo: 'voice:-4', role: 'boke' },
  takeru: { lv: 24, hi: 'tsukkomi:16,voice:10,kosei:6', lo: 'chara:-6', role: 'tsukkomi' },
};

// names for a new act (whimsical, fictional)
export const NAME_A = ['ドット', 'まんぷく', 'ぴんぼけ', 'はなまる', 'ねじまき', 'ゆうやけ', 'ドーナツ', 'からくり', 'こんぺいとう', 'みかん箱', 'ほしくず', 'あんみつ', 'ちくわぶ', 'かざぐるま', 'ぱちぱち', 'もちもち', 'へそまがり', 'おでん'];
export const NAME_B = ['ズ', 'ボーイズ', 'ガールズ', 'ブラザーズ', '堂', '座', '倶楽部', '団', '商会', '劇場', 'ロケット', 'エクスプレス', '同盟', '日和'];
