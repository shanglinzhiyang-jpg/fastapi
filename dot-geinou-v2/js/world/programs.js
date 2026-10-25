// Real TV programs at the real broadcasters' places (titles only; hosts are never depicted).
//
//   programDesk(g, stationId, npc)   the reception desk of a TV station place calls this:
//                                    a list of the station's programs of the player's era
//                                    (g.state.profile.era) with a ★ gate, a one-line
//                                    description and 「ゲスト出演」 (a g.job with a minigame
//                                    that fits the format). Some programs then offer a weekly
//                                    regular slot by phone (registerRegular, medium 'tv').
//
// The programs are real (official title spelling, producing / broadcasting station and
// broadcast years checked against public sources); everything that happens in the game is
// fictional: the player deals with fictional staff (AD, ディレクター, プロデューサー,
// アナウンサー) and fictional co-stars. The real hosts / performers are never named, drawn,
// quoted or imitated (the minigames' host is a generic アナウンサー / ナビゲーター / キャスター).
//
// Eras: a program is in an era when its broadcast years overlap the era's window
//   showa 1980-1989 / heisei_early 1990-1999 / heisei 2000-2009 / reiwa 2019-
// A program that aired only between the windows (2010-2018) goes to the nearest era
// (near: true in the table below; e.g. ピカルの定理 2010-13 → heisei).
// A weekly regular is offered only in an era where the program ran as a weekly show
// (reg years), never for specials (オールスター感謝祭, ドリーム東西ネタ合戦 …).
//
// Station ids (place ids built by the station modules): ntv tbs tvasahi fujitv tvtokyo
// mbs ktv nhk. Everything here is data + functions: a station whose place does not exist
// yet still lists its programs at a desk that calls programDesk, but regular offers wait
// until PLACES[station] exists (the recording happens at that place's door).
//
// Not in any in-game station: 『麒麟・千鳥の二笑流TV』 (CS放送 GAORA, 2005-06). It is
// offered once in the heisei era by phone as a ロケ with an Osaka meeting point (local: true),
// and then shows up at that place's desk (mbs, else ktv). 『千鳥のぼっけぇTV!』 is GAORA's
// too but was also broadcast on MBS (2009-12), so it is listed at 'mbs'.
//
// State: g.state.flags.programs (created on first use; old saves simply lack it)
//   { guest: {id: day}, offered: {id: day}, wd: {id: weekday}, drops: {id: since},
//     lastOfferWeek, stations: {stationId: true}, total, firstNetwork, keySweep,
//     kansai, firstRegular, bigSpecial, local: {id: { day, meet, done }} }
// Job ids: 'prog_<id>' (guest), 'regular_prog_<id>' (the weekly show).

import { registerRegular, REGULARS, onMorning, weekdayOf, WEEKDAYS, OFFER_DAYS, PEOPLE, isKansai } from '../engine/life.js';
import { registerItem } from '../engine/state.js';
import { PLACES } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { ERAS } from '../engine/profile.js';
// The politics core is optional (main.js loads it before the content; a core that failed is left out):
// read it through a guarded dynamic import, never a static one.
let POL = null;
import('../engine/politics.js').then((m) => { POL = m; }).catch(() => { POL = null; });

// ======================================================================== helpers
const G = () => (typeof window !== 'undefined' ? window.__game : null);
const ST = () => { const g = G(); return g && g.state ? g.state : null; };
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const NOW_YEAR = 2026; // "ongoing" programs run up to now

// ======================================================================== eras
export const ERA_WINDOWS = { showa: [1980, 1989], heisei_early: [1990, 1999], heisei: [2000, 2009], reiwa: [2019, 9999] };
const ERA_KEYS = Object.keys(ERA_WINDOWS);
export const eraKey = (st) => {
  const e = st && st.profile && st.profile.era;
  return ERA_WINDOWS[e] ? e : 'reiwa';
};
const spans = (ys) => (ys || []).map(([a, b]) => [a, b == null ? NOW_YEAR : b]);
const overlaps = (ys, [lo, hi]) => spans(ys).some(([a, b]) => a <= hi && b >= lo);
// the eras a set of years falls in (the nearest era when none: 2010-2018 only)
function erasOf(ys) {
  const out = ERA_KEYS.filter((k) => overlaps(ys, ERA_WINDOWS[k]));
  if (out.length || !ys || !ys.length) return { eras: out, near: false };
  const mid = spans(ys).reduce((s, [a, b]) => s + (a + b) / 2, 0) / ys.length;
  const dist = (k) => { const [lo, hi] = ERA_WINDOWS[k]; return mid < lo ? lo - mid : mid > hi ? mid - hi : 0; };
  return { eras: [ERA_KEYS.slice().sort((a, b) => dist(a) - dist(b))[0]], near: true };
}

// ======================================================================== stations
export const STATIONS = {
  ntv: { name: '日本テレビ', short: '日テレ' },
  tbs: { name: 'TBS', short: 'TBS' },
  tvasahi: { name: 'テレビ朝日', short: 'テレ朝' },
  fujitv: { name: 'フジテレビ', short: 'フジテレビ' },
  tvtokyo: { name: 'テレビ東京', short: 'テレ東' },
  mbs: { name: 'MBS毎日放送', short: 'MBS', kansai: true },
  ktv: { name: '関西テレビ', short: 'カンテレ', kansai: true },
  nhk: { name: 'NHK', short: 'NHK' },
};
const KEY_STATIONS = ['ntv', 'tbs', 'tvasahi', 'fujitv', 'tvtokyo'];
const stationName = (id) => (STATIONS[id] ? STATIONS[id].name : (PLACES[id] && PLACES[id].name) || id);
const kansaiStation = (id) => !!(STATIONS[id] && STATIONS[id].kansai);

// ======================================================================== tiers (like the job tiers)
// fame: the ★ gate; guest: the one-off appearance (rank B); reg: the weekly regular.
export const TIERS = {
  1: { fame: 30, diff: 2, stamina: 15, guest: { pay: 4500, fame: 15, fans: 50 }, reg: { pay: 6000, fame: 15, fans: 300 } },
  2: { fame: 250, diff: 3, stamina: 20, guest: { pay: 12000, fame: 45, fans: 140 }, reg: { pay: 15000, fame: 40, fans: 850 } },
  3: { fame: 1000, diff: 4, stamina: 25, guest: { pay: 30000, fame: 110, fans: 340 }, reg: { pay: 36000, fame: 100, fans: 2600 } },
  4: { fame: 2000, diff: 5, stamina: 30, guest: { pay: 60000, fame: 200, fans: 600 }, reg: null },
};
const tierReq = (t) => (t === 1 ? { anyOf: [{ agency: true }, { fame: 30 }], anyOfText: '事務所に所属しているか、知名度★30以上でないと出られない番組のようだ。' } : { fame: TIERS[t].fame });

// ======================================================================== the programs
// years: broadcast years ([from, to], to null = still on the air); reg: years it ran as a
// weekly show (default: years); regular: a regular slot can be offered; kind: the format
// (picks the minigame, see KINDS); genre: a short label; desc: one factual line.
// Sources: station sites / news archives / encyclopedias (checked 2026-10).
const P = (id, title, station, years, tier, kind, genre, desc, extra = {}) => ({ id, title, station, years, tier, kind, genre, desc, ...extra });
export const PROGRAM_LIST = [
  // ---- 日本テレビ
  P('gaki', 'ダウンタウンのガキの使いやあらへんで!!', 'ntv', [[1989, null]], 3, 'kikaku', 'お笑いバラエティ', '体を張った企画やトークでおくる、長寿のお笑いバラエティ。', { regular: true, wd: 1 }),
  P('genki', '天才・たけしの元気が出るテレビ!!', 'ntv', [[1985, 1996]], 3, 'loke', 'バラエティ', '一般の人も参加する、ロケ企画が人気のバラエティ。', { regular: true, wd: 6 }),
  P('goten', '踊る!さんま御殿!!', 'ntv', [[1997, null]], 3, 'hinadan', 'トークバラエティ', 'テーマにそって、ゲストがエピソードを披露するトーク番組。'),
  P('shabekuri', 'しゃべくり007', 'ntv', [[2008, null]], 3, 'talk', 'トークバラエティ', 'レギュラー陣がゲストを迎えて、トークで盛り上げるバラエティ。'),
  P('urinari', 'ウッチャンナンチャンのウリナリ!!', 'ntv', [[1996, 2002]], 2, 'dance', 'ドキュメントバラエティ', '出演者が体当たりで企画に挑む、ドキュメント系バラエティ。', { regular: true, wd: 4 }),
  P('matsushin', '松紳', 'ntv', [[2003, 2006]], 2, 'talk', 'トーク番組', 'MCとゲストが自由に語り合う、トーク番組。'),
  P('gyoten', 'ザ!世界仰天ニュース', 'ntv', [[2001, null]], 3, 'gyoten', 'ドキュメントバラエティ', '世界のおどろきの出来事を、再現VTRで紹介するバラエティ。'),
  P('shoten', '笑点', 'ntv', [[1966, null]], 3, 'oogiri', '演芸番組', '演芸と大喜利でおくる、日曜夕方の長寿演芸番組。'),
  P('gurunai', 'ぐるぐるナインティナイン', 'ntv', [[1994, null]], 3, 'gourmet', 'バラエティ', 'ゲームやグルメ企画でおくる、人気バラエティ。', { regular: true, wd: 3 }),
  P('waragami', '笑神様は突然に…', 'ntv', [[2012, null]], 2, 'loke', 'ロケバラエティ', '芸人たちのロケに密着し、笑いが生まれる瞬間を届けるバラエティ。', { reg: [[2013, 2015]] }),
  P('damasareta', 'うわっ!ダマされた大賞', 'ntv', [[2010, null]], 3, 'dokkiri', 'ドッキリ特番', '芸能人がドッキリにかかる瞬間を集めた、ドッキリ特番。', { special: true }),
  // ---- TBS
  P('suidou', '水曜日のダウンタウン', 'tbs', [[2014, null]], 3, 'setsu', 'バラエティ', '芸能人が持ちこんだ「説」を、ロケやVTRで検証するバラエティ。', { regular: true, wd: 2 }),
  P('takeshijo', '痛快なりゆき番組 風雲!たけし城', 'tbs', [[1986, 1989]], 2, 'challenge', 'アトラクション番組', '一般参加者が城をめざして関門に挑む、アトラクション番組。', { scenes: 'castle' }),
  P('kanshasai', 'オールスター感謝祭', 'tbs', [[1991, null]], 4, 'quiz', 'クイズ特番', '春と秋の改編期に生放送される、大型クイズ特番。', { special: true, quiz: { category: 'mix', count: 8 } }),
  P('bestone', 'ザ・ベストワン', 'tbs', [[2020, 2023]], 3, 'neta', 'ネタ番組', '実力派の芸人がネタを披露する、お笑いネタ番組。', { special: true }),
  P('arabiki', 'あらびき団', 'tbs', [[2007, 2011], [2022, 2022]], 2, 'neta', 'ネタ番組', 'あら削りな一芸を持つパフォーマーを紹介する、ネタ番組。'),
  P('dreamtouzai', 'ドリーム東西ネタ合戦', 'tbs', [[2014, null]], 4, 'neta', 'お笑い特番', '東西の芸人がネタで対決する、元日恒例のお笑い特番。', { special: true }),
  P('bouken', 'アイ・アム・冒険少年', 'tbs', [[2014, 2015], [2020, 2024]], 2, 'challenge', '冒険バラエティ', '芸能人が体を張った冒険企画に挑むバラエティ。', { regular: true, wd: 0, scenes: 'bouken' }),
  // ---- テレビ朝日
  P('ametalk', 'アメトーーク！', 'tvasahi', [[2003, null]], 3, 'hinadan', 'トークバラエティ', '共通点のある芸人が集まり、テーマごとに語るトークバラエティ。'),
  P('kinmedal', '笑いの金メダル', 'tvasahi', [[2004, 2007]], 2, 'neta', '演芸バラエティ', '若手芸人がネタで競う、演芸バラエティ（朝日放送制作）。'),
  P('shikujiri', 'しくじり先生 俺みたいになるな!!', 'tvasahi', [[2014, 2017], [2019, null]], 2, 'class', '教育バラエティ', '失敗の経験を持つ人が先生になり、授業形式で教訓を伝える番組。', { regular: true, wd: 0 }),
  P('nantoka', 'くりぃむナントカ', 'tvasahi', [[2004, 2008]], 2, 'kikaku', 'バラエティ', 'ゲームや企画でゲストと盛り上がる、深夜発のバラエティ。', { regular: true, wd: 2 }),
  // ---- フジテレビ
  P('hyokin', 'オレたちひょうきん族', 'fujitv', [[1981, 1989]], 3, 'conte', 'お笑いバラエティ', 'コントやパロディでおくる、土曜夜のお笑いバラエティ。', { regular: true, wd: 5 }),
  P('stardokkiri', 'スターどっきり(秘)報告', 'fujitv', [[1976, 1998]], 2, 'dokkiri', 'ドッキリバラエティ', 'スターたちにしかけたドッキリを紹介する、バラエティ番組。', { special: true }),
  P('gottsu', 'ダウンタウンのごっつええ感じ', 'fujitv', [[1991, 1997]], 3, 'conte', 'お笑いバラエティ', 'コントを中心に、ゲームやトークも楽しめるお笑いバラエティ。', { regular: true, wd: 6 }),
  P('heyhey', 'HEY!HEY!HEY! MUSIC CHAMP', 'fujitv', [[1994, 2012]], 3, 'music', '音楽バラエティ', '人気アーティストのライブとトークでおくる、音楽バラエティ。'),
  P('mechaike', 'めちゃ²イケてるッ!', 'fujitv', [[1996, 2018]], 3, 'kikaku', 'お笑いバラエティ', '体当たりの企画とコントでおくる、お笑いバラエティ。', { regular: true, wd: 5 }),
  P('junk', 'ジャンクSPORTS', 'fujitv', [[2000, 2010], [2018, null]], 2, 'sports', 'スポーツバラエティ', 'アスリートが集まり、競技の裏話を語るスポーツバラエティ。', { regular: true, wd: 1 }),
  P('millionaire', 'クイズ$ミリオネア', 'fujitv', [[2000, 2007], [2026, null]], 3, 'quiz', 'クイズ番組', '4択の問題に正解するたびに、賞金が上がっていくクイズ番組。', { reg: [[2000, 2007]], quiz: { category: 'mix', count: 8, show: 'クイズ$ミリオネア' } }),
  P('hanetobi', 'はねるのトびら', 'fujitv', [[2001, 2012]], 2, 'conte', 'コントバラエティ', '若手芸人たちのコントと企画でおくる、バラエティ。', { regular: true, wd: 2 }),
  P('trivia', 'トリビアの泉 〜素晴らしきムダ知識〜', 'fujitv', [[2002, 2006]], 3, 'trivia', '雑学バラエティ', '思わず「へぇ〜」と言いたくなる雑学を紹介する、バラエティ。'),
  // ---- クイズ番組 (R7-D): the quiz minigame plays each show's own format by its title (js/engine/quiz_studio.js):
  //   ネプリーグ (2003-04〜; ゴールデン・5人1チームは2005-04〜): ファイブリーグ, ボーナスステージ トロッコアドベンチャー (2007〜)
  //   クイズ!ヘキサゴン (2002年の深夜番組が前身、2003-04からこの題名でゴールデン、〜2005-09): 6人の心理戦
  //   クイズ!ヘキサゴンII (2005-10-19〜2011-09-28、水曜19時): 予選ペーパーテスト → チーム分け → 1対1の早押し
  //   Each one is listed only in the months it was on the air (see the block after PROGRAMS).
  P('nepleague', 'ネプリーグ', 'fujitv', [[2003, null]], 2, 'quiz', 'クイズバラエティ', 'チームで常識問題に挑む、クイズバラエティ。', { quiz: { category: ['general', 'japan'], count: 7, show: 'ネプリーグ' } }),
  P('hexagon', 'クイズ!ヘキサゴン', 'fujitv', [[2003, 2005]], 2, 'quiz', 'クイズバラエティ', '6人が六角形の席に座り、だれが間違えるかを見抜き合う、心理戦のクイズ番組。', { quiz: { category: ['general', 'japan'], count: 6, show: 'クイズ!ヘキサゴン' } }),
  P('hexagon2', 'クイズ!ヘキサゴンII', 'fujitv', [[2005, 2011]], 2, 'quiz', 'クイズバラエティ', '予選のペーパーテストの成績でチームを分け、1対1の早押しなどで競うクイズバラエティ。', { regular: true, wd: 2, quiz: { category: ['general', 'japan'], count: 8, show: 'クイズ!ヘキサゴンII' } }),
  P('redcarpet', '爆笑レッドカーペット', 'fujitv', [[2007, 2014], [2025, null]], 2, 'neta', 'ネタ番組', '芸人が短いネタを次々に披露する、ショートネタ番組。', { reg: [[2008, 2010]] }),
  P('redtheater', '爆笑レッドシアター', 'fujitv', [[2009, 2010]], 2, 'conte', 'コント番組', '芸人たちのコントを中心にした、お笑い番組。', { regular: true, wd: 2 }),
  P('pikaru', 'ピカルの定理', 'fujitv', [[2010, 2013]], 2, 'conte', 'コントバラエティ', 'コントを中心にした、バラエティ番組。', { regular: true, wd: 2 }),
  P('hokotate', 'ほこ×たて', 'fujitv', [[2010, 2013]], 2, 'challenge', '対決バラエティ', '「絶対に◯◯なもの」どうしを対決させる、バラエティ。', { scenes: 'hokotate' }),
  P('waidona', 'ワイドナショー', 'fujitv', [[2013, 2025]], 2, 'news', '情報バラエティ', 'その週の話題について、コメンテーターが語り合う番組。', { regular: true, wd: 6 }),
  P('netapare', 'ネタパレ', 'fujitv', [[2017, null]], 2, 'neta', 'ネタ番組', '芸人たちのネタを楽しむ、お笑いネタ番組。'),
  // ---- テレビ東京
  P('tvchamp', 'TVチャンピオン', 'tvtokyo', [[1992, 2006]], 2, 'challenge', '選手権バラエティ', 'さまざまな分野の達人が腕を競う、選手権バラエティ。', { scenes: 'champ' }),
  P('pirameki', 'ピラメキーノ', 'tvtokyo', [[2009, 2015]], 1, 'quiz', '子ども向けバラエティ', 'コーナー満載の、子ども向けバラエティ番組。', { regular: true, wd: 3, quiz: { category: 'general', count: 5 } }),
  P('chaplin', 'にちようチャップリン', 'tvtokyo', [[2017, 2018]], 2, 'neta', 'ネタ番組', '芸人たちがネタを披露して競い合う、お笑いネタ番組。'),
  // ---- MBS毎日放送（大阪）
  P('prebato', 'プレバト!!', 'mbs', [[2012, null]], 3, 'prebato', '才能査定バラエティ', '芸能人の才能を、俳句などの課題で査定するバラエティ（TBS系）。'),
  P('seyanen', 'せやねん!', 'mbs', [[2001, null]], 1, 'loke', '情報バラエティ', '土曜の朝に生放送でおくる、関西の情報バラエティ。', { regular: true, wd: 5 }),
  P('gobugobu', 'ごぶごぶ', 'mbs', [[2007, null]], 1, 'loke', 'ロケバラエティ', '街をぶらりと歩きながらおくる、関西のロケバラエティ。'),
  P('kirinroom', '麒麟の部屋', 'mbs', [[2007, 2011]], 1, 'talk', 'トークバラエティ', 'トークを中心にした、関西の深夜バラエティ。', { regular: true, wd: 1 }),
  P('bokke', '千鳥のぼっけぇTV!', 'mbs', [[2009, 2012]], 1, 'loke', 'お笑いバラエティ', 'GAORA制作のお笑いバラエティ（MBSでも放送）。'),
  // ---- 関西テレビ（大阪）
  P('manma', 'さんまのまんま', 'ktv', [[1985, null]], 3, 'talk', 'トーク番組', 'ゲストを迎えて、ざっくばらんに語り合うトーク番組。', { reg: [[1985, 2016]] }),
  // ---- NHK
  P('onbato', '爆笑オンエアバトル', 'nhk', [[1999, 2010]], 2, 'neta', 'ネタ番組', '客席の審査で放送される組が決まる、若手芸人のネタ番組。'),
  // ---- not in any in-game station: CS放送 GAORA (offered by phone as a ロケ, see LOCAL)
  P('nishoryu', '麒麟・千鳥の二笑流TV', null, [[2005, 2006]], 1, 'loke', 'お笑いバラエティ', 'CS放送のGAORAで放送された、お笑いバラエティ。', { local: { channel: 'CS放送GAORA', meet: ['mbs', 'ktv'] } }),
];
export const PROGRAMS = {};
for (const p of PROGRAM_LIST) {
  const e = erasOf(p.years);
  p.eras = e.eras;
  p.near = e.near;
  // weekly-regular eras: where it ran weekly (specials never)
  p.regEras = p.special ? [] : erasOf(p.reg || p.years).eras.filter((k) => p.eras.includes(k));
  PROGRAMS[p.id] = p;
}
// ---- R7-D: the quiz programs that changed within an era follow the game month (クイズ!ヘキサゴン → II on
// 2005-10; II ends 2011-09): outside its months a program is in no era (not at the desk, no regular offer).
let QUIZBANK = null;
import('../engine/quiz_bank.js').then((m) => { QUIZBANK = m; }).catch(() => { QUIZBANK = null; });
function quizOnAir(id) {
  const g = G();
  if (!g || !g.state || !QUIZBANK) return true;
  let y = null, m = 6;
  try { const d = typeof g.gameDate === 'function' ? g.gameDate() : null; if (d && Number.isFinite(d.year)) { y = d.year; m = d.month || 6; } } catch (e) { /* fall back */ }
  if (y == null) {
    const base = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 }[eraKey(g.state)] || 2026;
    const mi = 3 + Math.floor(Math.max(0, num(g.state.day, 1) - 1) / 10);
    y = base + Math.floor(mi / 12); m = (mi % 12) + 1;
  }
  return QUIZBANK.onAir(id, y, m);
}
for (const id of ['hexagon', 'hexagon2']) {
  const p = PROGRAMS[id];
  if (!p) continue;
  const eras = p.eras, regEras = p.regEras;
  Object.defineProperty(p, 'eras', { get: () => (quizOnAir(id) ? eras : []), enumerable: true, configurable: true });
  Object.defineProperty(p, 'regEras', { get: () => (quizOnAir(id) ? regEras : []), enumerable: true, configurable: true });
}
const progId = (p) => 'prog_' + p.id;
export const PROGRAM_SHOW_IDS = PROGRAM_LIST.filter((p) => p.regular).map(progId);

// The programs of a station in an era (the desk's list), lowest ★ first.
export function programsAt(stationId, era) {
  return PROGRAM_LIST.filter((p) => p.station === stationId && p.eras.includes(era)).sort((a, b) => a.tier - b.tier);
}
const yearsText = (p) => spans(p.years).map(([a, b], i) => {
  const open = p.years[i][1] == null;
  return open ? `${a}年〜` : a === b ? `${a}年` : `${a}〜${b}年`;
}).join('・');

// ======================================================================== minigame content
const S = (prompt, best, ok, bad) => ({ prompt, answers: [{ text: best, score: 100 }, { text: ok, score: 55 }, { text: bad, score: 10 }] });
// [opener, ...middle, closer]; a show plays the opener, 3 of the middle, the closer
const TALK = {
  talk: [
    S('アナウンサー「{name}さん、ようこそ！今日は楽しんでください」', 'よろしくお願いします！', 'どうも…', 'はやく帰りたいです'),
    S('アナウンサー「最近ハマっていることは？」', '商店街の食べ歩きです！', '寝ることですね', 'とくにないです'),
    S('アナウンサー「上京して、いちばんおどろいたことは？」', '電車の路線図の複雑さです！', '人が多いことですね', '…べつに何も'),
    S('共演者「{name}さんって、家ではどんな感じ？」', '意外と自炊してるんです！', 'ずっとゴロゴロしてます', 'ひみつです'),
    S('アナウンサー「子どものころの夢は？」', 'テレビに出ることでした！', 'パン屋さんです', 'わすれました'),
    S('ゲスト「{name}さん、緊張してない？」', 'ドキドキしてます！でも楽しい！', 'ちょっとだけ…', 'してません（棒読み）'),
    S('アナウンサー「最後に、告知をどうぞ！」', '応援よろしくお願いします！', 'ドッターも見てね！', 'とくにないです'),
  ],
  hinadan: [
    S('アナウンサー「今日のテーマは『家族のちょっといい話』です！」', '母の手紙に泣いた話を！', '父の毎朝のラジオ体操…', 'うちはふつうです'),
    S('共演芸人「その話、もうちょっとくわしく！」', 'じつは続きがありまして…', 'えっと、どこまで話したっけ', '以上です'),
    S('アナウンサー「テーマ『人生でいちばんあせったこと』」', '名札を逆さにつけて本番！', '寝坊しかけました', 'ないです'),
    S('ゲスト「わかる〜！それ、あるある！」', 'ですよね！みんなやりますよね', 'え、ないですか？', '……'),
    S('アナウンサー「テーマ『ゆずれないこだわり』」', 'おにぎりは塩むすび一択！', '靴下は左から、かな', 'こだわりはないです'),
    S('共演芸人「{name}、ここで一発ボケて！」', '（全力のポーズ）ドット〜！', 'え、いまですか？', 'むりです'),
    S('アナウンサー「最後に、ひと言どうぞ！」', 'また呼んでください！', 'おつかれさまでした', 'もう帰っていいですか'),
  ],
  kikaku: [
    S('アナウンサー「本日の企画は『激辛ラーメン完食チャレンジ』！」', 'よーし、受けて立ちます！', '甘口でお願いします', '辛いのはちょっと…'),
    S('共演者「{name}さん、顔が真っ赤ですよ！」', 'これは…情熱の赤です！', '見ないでください', 'ギブアップ…'),
    S('アナウンサー「つづいては、早口言葉チャレンジ！」', '生麦生米生卵！', 'なまむぎ…なまごめ…', 'パスで'),
    S('アナウンサー「罰ゲームは、全身タイツで商店街へ！」', 'よろこんで行ってきます！', '聞いてないです！', '帰ります'),
    S('共演者「{name}さん、意外と体張るね！」', '体だけはじょうぶです！', 'がんばってます', 'もうむりです'),
    S('アナウンサー「次は『1分間ものまね連発』です！」', 'まずは駅のアナウンス！', '…ネコのまねで', 'できません'),
    S('アナウンサー「今日の感想をどうぞ！」', '最高に楽しかったです！', 'つかれました…', 'もう出ません'),
  ],
  setsu: [
    S('アナウンサー「{name}さんの説、発表をどうぞ！」', '「行列の店は2回目がうまい」説！', '「月曜日はねむい」説', '説はとくにないです'),
    S('共演者「その説、ほんとうに？」', 'ちゃんと検証してきました！', 'たぶん…', 'うそです'),
    S('検証VTRのあとで――結果は？', '説、立証です！', '微妙なところですね', '見てませんでした'),
    S('共演者「意外な結果やったね！」', 'ぼくもびっくりしました！', 'まあ、そうですね', 'べつに'),
    S('アナウンサー「次の説の候補はありますか？」', '「猫は新聞の上が好き」説！', '考えておきます', 'ネタ切れです'),
    S('アナウンサー「最後に、今日の感想を！」', '検証って奥が深いですね！', 'おもしろかったです', 'つかれました'),
  ],
  gyoten: [
    S('アナウンサー「今日は世界のおどろきのニュースです！」', 'ワクワクします！', 'こわい話ですか？', 'ねむいです'),
    S('再現VTRを見て――スタジオの感想は？', '信じられない…！', 'へえ〜', 'よくある話ですね'),
    S('共演者「{name}さん、こういう経験ある？」', '迷子の犬を助けたことが！', 'ないですね', 'おぼえてません'),
    S('アナウンサー「ここで専門家の解説です」', 'なるほど、勉強になります！', 'むずかしいですね', 'わかりません'),
    S('共演者「家族にも伝えたいよね」', '今日さっそく話します！', 'そうですね', 'べつにいいです'),
    S('アナウンサー「最後に、ひと言どうぞ！」', 'みなさんも気をつけて！', '以上です', 'おわりです'),
  ],
  gourmet: [
    S('アナウンサー「今日のグルメ企画、スタートです！」', 'おなか空かせてきました！', 'ほどほどに…', 'さっき食べました'),
    S('アナウンサー「このメニュー、お味はいかが？」', 'お出汁がしみてて最高です！', 'おいしいです', 'ふつうです'),
    S('共演者「{name}さん、食レポうまいね！」', '食べるの大好きなんです！', 'そうですか？', 'まずいです'),
    S('アナウンサー「つづいてはゲーム対決です！」', '負けませんよ〜！', 'がんばります', 'やりたくないです'),
    S('共演者「おしい！あと少しだった！」', '次こそ勝ちます！', 'くやしい…', 'もういいです'),
    S('アナウンサー「最後に、今日の感想を！」', 'ごちそうさまでした！', 'おなかいっぱいです', 'つかれました'),
  ],
  sports: [
    S('アナウンサー「今日はアスリートのみなさんとトークです！」', '話を聞くのが楽しみです！', 'スポーツ苦手で…', 'ねむいです'),
    S('共演アスリート「試合の前は、毎日8時間練習です」', 'すごい！ぼくは3分で寝ます', '大変ですね', 'へえ'),
    S('アナウンサー「{name}さんの得意なスポーツは？」', 'ラジオ体操なら負けません！', '見る専門です', 'ないです'),
    S('共演アスリート「試合前のルーティン、聞きたい？」', 'ぜひ！教えてください！', 'まあ、はい', 'べつにいいです'),
    S('共演アスリート「今度いっしょに走ってみます？」', 'ぜひ！手かげんしてください', '明日なら…', '遠慮します'),
    S('アナウンサー「最後に、選手のみなさんにエールを！」', 'これからも応援してます！', 'がんばってください', '以上です'),
  ],
  news: [
    S('キャスター「今週の話題、まずはご当地グルメのブームです」', '地元の味が広まるのはうれしい！', '食べてみたいですね', '興味ないです'),
    S('キャスター「{name}さん、若い世代の意見を聞かせてください」', '自分の言葉で話しますね！', 'みなさんと同じです', 'わかりません'),
    S('コメンテーター「なるほど、するどい意見ですね」', 'ありがとうございます！', 'そうですか？', '適当です'),
    S('キャスター「つづいて、夏祭りの話題です」', '花火大会、毎年楽しみです！', '人が多いですよね', 'とくにないです'),
    S('コメンテーター「{name}さんの地元はどう？」', '商店街がにぎやかなんです！', 'ふつうですね', 'ひみつです'),
    S('キャスター「今日はありがとうございました」', '勉強になりました！', 'また来週も！', 'つかれました'),
  ],
  class: [
    S('先生「みなさん、今日の授業は『調子に乗った話』です」', 'ノートとります！', 'はい', 'ねむいです'),
    S('先生「当時のぼくは、遅刻ばかりしていました」', 'それはしくじりますね…', 'ぼくもです', 'へえ'),
    S('先生「ここで問題！ぼくは次にどうしたでしょう？」', 'すなおに謝った！', 'にげた？', '寝た'),
    S('先生「失敗から学んだことは、なんだと思う？」', '準備が大事ってことです！', '運ですね', 'わすれました'),
    S('先生「{name}くん、いい質問だね！」', '先生の話、心にささりました！', 'ありがとうございます', 'なんとなくです'),
    S('先生「最後に、生徒のみなさんへ！」', '先生、ありがとうございました！', 'おつかれさまでした', 'もう帰ります'),
  ],
  oogiri: [
    S('お題：「こんな八百屋はいやだ」どんな八百屋？', '大根がぜんぶ自己紹介してくる', '野菜が高い', '閉まっている'),
    S('お題：「うちの猫が急に◯◯した」', 'うちの猫が急に家賃を払った', 'うちの猫が急に寝た', 'わかりません'),
    S('お題：天気予報士になって、ひと言！', 'あしたは晴れ、ところにより座布団', 'あしたは晴れです', '見てません'),
    S('お題：「こんな運動会はいやだ」', '玉入れの玉がぜんぶ大福', '雨がふる', '出ません'),
    S('お題：「新しいことわざ」を作ってください', '早起きは三文の得、二度寝は四文の夢', '急がば回れ', 'ありません'),
    S('お題：座布団10枚をめざして、ひと言！', '座布団、ぜんぶください！', 'がんばります', '座布団いらないです'),
  ],
  prebato: [
    S('お題：「夏の商店街」の写真で一句', '夕立や 商店街の 傘の花', '暑いです 商店街は 暑いです', '一句…できません'),
    S('お題：「冬の朝」の写真で一句', '白い息 始発の駅に 灯がともる', '冬の朝 寒い寒いよ 冬の朝', 'パスします'),
    S('お題：生け花の才能を査定します', '季節の花を主役に生けます', 'ぜんぶまとめてさします', '花びんに水だけ'),
    S('お題：盛りつけの才能を査定します', '彩りよく、高さを出して盛る', 'とりあえず全部のせる', 'お皿は使いません'),
    S('お題：「春の公園」の写真で一句', '花ふぶき ベンチの猫も 目を細め', '春の公園 さくらがきれい', 'あとで考えます'),
    S('結果発表！今日の査定は……？', '「才能アリ」いただきました！', 'ふつうでした…', '才能ナシ…'),
  ],
};
const LOKE = {
  std: [
    S('ナビゲーター「今日はこの町をぶらり歩きます！」', 'いい町ですね〜！', 'はじめて来ました', '帰りたいです'),
    S('おばあちゃん「よう来たねえ。これ食べていき！」', 'いただきます！おいしい！', 'あとで食べます', 'おなかいっぱいで…'),
    S('こども「テレビの人だ！サインちょうだい！」', 'もちろん！名前は？', 'あとでね', 'いまはむり'),
    S('大将「うちの名物、コロッケだよ！」', 'サクサクで最高です！', 'もう一個ください！', 'ふつうですね'),
    S('観光客「この町のおすすめは？」', 'あの坂の上の景色です！', 'ぼくも初めてで…', 'わかりません'),
    S('ナビゲーター「最後に、町のみなさんにひと言！」', 'また来ます！ありがとう！', 'おつかれさまでした', 'さようなら'),
  ],
  kansai: [
    S('ナビゲーター「今日は大阪の町をぶらり歩きます！」', 'ええ町ですね〜！', 'はじめて来ました', '帰りたいです'),
    S('おばちゃん「よう来たなあ。アメちゃんあげるわ！」', 'ありがとう！大事に食べます！', 'あとでもらいます', 'いりません'),
    S('こども「テレビの人や！サインちょうだい！」', 'もちろん！名前は？', 'あとでな', 'いまはむり'),
    S('大将「うちの名物、たこ焼き食べていき！」', '外カリ中トロで最高です！', 'もう一皿ください！', 'ふつうですね'),
    S('おっちゃん「兄ちゃん姉ちゃん、なんかおもろいことして！」', '（全力のポーズ）ドット〜！', 'え、いまですか？', 'むりです'),
    S('ナビゲーター「最後に、町のみなさんにひと言！」', 'また来ます！おおきに！', 'おつかれさまでした', 'さようなら'),
  ],
};
// command 'acting' scenes (W 笑う N 泣く O 怒る D 驚く K キメ T 照れる); the last one closes
const ACT = {
  conte: [
    { title: '迷子のロボット', beats: 'DNTWKDOW' }, { title: 'あわてんぼうの忍者', beats: 'DOWTDKNW' },
    { title: '張り切りすぎる店長', beats: 'WKODWTNK' }, { title: '泣き虫の怪盗', beats: 'NDNWTOKW' },
    { title: '正直すぎる占い師', beats: 'TDWONKDW' }, { title: 'ねぼすけの勇者', beats: 'DTNOWKDW' },
    { title: 'エンディングのあいさつ', beats: 'WTKWWKTK' },
  ],
  dokkiri: [
    { title: '楽屋に巨大なケーキ！', beats: 'DDWTKWDW' }, { title: 'にせのインタビュー', beats: 'TDOWDNWK' },
    { title: '止まったエレベーター', beats: 'DNDOTWKW' }, { title: 'サプライズ誕生日会', beats: 'DWNTWKTW' },
    { title: '突然のどしゃぶり', beats: 'DODNWTKW' }, { title: 'しゃべる自動販売機', beats: 'DDTWOWKD' },
    { title: 'ネタばらし！', beats: 'DOTWWKTK' },
  ],
  castle: [
    { title: 'ぐらぐら橋をわたれ！', beats: 'DKOWDKTK' }, { title: '巨大迷路を突破！', beats: 'DOKDWTKN' },
    { title: '転がる大玉をよけろ！', beats: 'DDOKWDKT' }, { title: '飛び石の池を渡れ！', beats: 'TDKODWKN' },
    { title: 'すべる坂をのぼれ！', beats: 'OKDNOKWD' }, { title: '最後の決戦！', beats: 'KODKWKDK' },
  ],
  bouken: [
    { title: '無人島から脱出！', beats: 'DKOWDKNK' }, { title: 'いかだを組み立てろ！', beats: 'OKDWTKOK' },
    { title: '洞窟を探検！', beats: 'DNDKOWKD' }, { title: '火おこしに挑戦！', beats: 'OOKDWTWK' },
    { title: '夕日の海を進め！', beats: 'TWKDNWKT' }, { title: 'ついにゴール！', beats: 'DNWWKTWK' },
  ],
  hokotate: [
    { title: '絶対に割れない板！？', beats: 'DKODWKDK' }, { title: '最強のドリル対決', beats: 'OKDOKDWK' },
    { title: '絶対に倒れない人形', beats: 'DTWDOKWD' }, { title: '見破る名人 対 変装', beats: 'TDKOWDNK' },
    { title: '絶対に落ちない吸盤', beats: 'DOKDTKWD' }, { title: '勝負の決着！', beats: 'DDKWOKWK' },
  ],
  champ: [
    { title: '手先の器用さ選手権', beats: 'TKDOWKTK' }, { title: 'ご当地知識選手権', beats: 'DKTWOKDK' },
    { title: '早組み立て選手権', beats: 'OKDKWDTK' }, { title: 'ケーキデコレーション', beats: 'TWDKOWTK' },
    { title: '名人どうしの決勝戦', beats: 'KODKNWDK' }, { title: '優勝発表！', beats: 'DNWWKTWK' },
  ],
};
// トリビアの泉: harmless, well-known facts (correct answer first; the quiz shuffles them)
const TRIVIA_Q = [
  { q: 'タコの心臓は、いくつある？', choices: ['3つ', '1つ', '2つ', '8つ'], answer: 0 },
  { q: 'ジャイアントパンダのしっぽの色は？', choices: ['白', '黒', '茶色', 'しましま'], answer: 0 },
  { q: 'いちごの表面のつぶつぶは、植物学では何？', choices: ['実（果実）', 'たね', 'とげ', '花びら'], answer: 0 },
  { q: 'ホッキョクグマがくらしているのは？', choices: ['北極のまわり', '南極のまわり', '赤道のあたり', '砂漠'], answer: 0 },
  { q: '富士山の高さは？', choices: ['3776m', '2776m', '4776m', '3376m'], answer: 0 },
  { q: '1日は何秒？', choices: ['86400秒', '3600秒', '60000秒', '100000秒'], answer: 0 },
  { q: '日本でいちばん大きい湖は？', choices: ['琵琶湖', '霞ヶ浦', '十和田湖', '浜名湖'], answer: 0 },
];

// The partner (相方) for ネタ shows, when the player has one.
function partnerOpts(st) {
  const d = st && st.partner && PEOPLE[st.partner];
  return d ? { partner: d.short || d.name, partnerLook: d.look, dialect: isKansai(d) ? 'kansai' : 'std' } : {};
}
const pickScenes = (bank) => [bank[0], ...shuffled(bank.slice(1, -1)).slice(0, 3), bank[bank.length - 1]];
// What a format plays: { minigame, skill, opts(p, tier) }.
const KINDS = {
  talk: { minigame: 'talk', skill: 'talk', bank: 'talk', set: 'variety', mc: 'アナウンサー' },
  hinadan: { minigame: 'talk', skill: 'talk', bank: 'hinadan', set: 'variety', mc: 'アナウンサー' },
  kikaku: { minigame: 'talk', skill: 'warai', bank: 'kikaku', set: 'variety', mc: 'アナウンサー' },
  setsu: { minigame: 'talk', skill: 'talk', bank: 'setsu', set: 'variety', mc: 'アナウンサー' },
  gyoten: { minigame: 'talk', skill: 'talk', bank: 'gyoten', set: 'variety', mc: 'アナウンサー' },
  gourmet: { minigame: 'talk', skill: 'talk', bank: 'gourmet', set: 'variety', mc: 'アナウンサー' },
  sports: { minigame: 'talk', skill: 'talk', bank: 'sports', set: 'variety', mc: 'アナウンサー' },
  news: { minigame: 'talk', skill: 'talk', bank: 'news', set: 'news', mc: 'キャスター' },
  class: { minigame: 'talk', skill: 'talk', bank: 'class', set: 'variety', mc: '先生' },
  oogiri: { minigame: 'ogiri', skill: 'warai', bank: 'oogiri', set: 'variety', mc: 'アナウンサー' },
  prebato: { minigame: 'talk', skill: 'talk', bank: 'prebato', set: 'variety', mc: 'アナウンサー' },
  loke: { minigame: 'talk', skill: 'talk', bank: 'loke', set: 'local', mc: 'ナビゲーター' },
  quiz: { minigame: 'quiz', skill: 'talk' },
  trivia: { minigame: 'quiz', skill: 'talk' },
  neta: { minigame: 'manzai', skill: 'warai' },
  conte: { minigame: 'conte', skill: 'engi', act: 'conte' },
  dokkiri: { minigame: 'command', skill: 'engi', act: 'dokkiri' },
  challenge: { minigame: 'command', skill: 'engi', act: 'castle' },
  dance: { minigame: 'command', skill: 'engi' },
  music: { minigame: 'rhythm', skill: 'uta' },
};
// The minigame opts for one appearance (fresh scenes each time).
export function programOpts(p, st = ST(), regular = false) {
  const K = KINDS[p.kind] || KINDS.talk;
  const d = Math.min(5, TIERS[p.tier].diff + (regular && p.tier < 4 ? 1 : 0)); // the weekly show is a step harder
  if (K.minigame === 'talk') {
    const bank = K.bank === 'loke' ? (kansaiStation(p.station) || p.local ? LOKE.kansai : LOKE.std) : TALK[K.bank];
    return { difficulty: d, show: p.title, set: K.set, mc: K.mc, scenes: pickScenes(bank) };
  }
  if (p.kind === 'trivia') return { difficulty: d, questions: shuffled(TRIVIA_Q).slice(0, 5), show: 'トリビアの泉', genre: 'ムダ知識' };
  if (K.minigame === 'quiz') {
    const q = p.quiz || {};
    return { difficulty: d, category: q.category || 'mix', count: q.count || 6, show: q.show || p.title };
  }
  // 芸の実演 (C): ネタ番組 → 漫才, コント番組 → コント, 大喜利 → 大喜利 (a TV studio: the stakes rise with the tier)
  const venue = { name: p.title, size: 'tv', crowd: p.tier >= 3 ? 'normal' : 'warm', pressure: Math.min(90, 35 + (Number(p.tier) || 1) * 10) };
  if (K.minigame === 'manzai') return { difficulty: d, ...partnerOpts(st), venue, stage: 'studio' };
  if (K.minigame === 'ogiri') return { difficulty: d, mode: 'zabuton', rounds: 3, scenes: shuffled(TALK.oogiri).slice(0, 3), venue };
  if (K.minigame === 'conte') { const bank = ACT[p.scenes || K.act] || ACT.conte; return { difficulty: d, scenes: shuffled(bank.slice(0, -1)).slice(0, 3), venue }; }
  if (p.kind === 'dance') return { difficulty: d, theme: 'dance' };
  if (K.minigame === 'command') {
    const bank = ACT[p.scenes || K.act] || ACT.conte;
    const last = bank[bank.length - 1];
    const n = Math.min(bank.length - 1, 3 + Math.floor(d / 2));
    return { difficulty: d, theme: 'acting', rounds: n + 1, scenes: [...shuffled(bank.slice(0, -1)).slice(0, n), last] };
  }
  if (K.minigame === 'rhythm') return { difficulty: d, style: 'sing', lanes: p.tier >= 3 ? 4 : 2 };
  return { difficulty: d };
}
export const programSkill = (p) => (KINDS[p.kind] || KINDS.talk).skill;
export const programMinigame = (p) => (KINDS[p.kind] || KINDS.talk).minigame;

// ======================================================================== items (keepsakes)
registerItem('prog_first_pass', { name: 'テレビ局の記念入館証', price: 0, desc: 'はじめて全国ネットの番組に出た日の入館証。\n首にかけたときの緊張を、まだおぼえている。' });
registerItem('prog_key_plaque', { name: 'キー局制覇の記念盾', price: 0, desc: '東京のテレビ局の番組に、ひととおり出演した記念。\nスタッフのみなさんの寄せ書きつき。' });
registerItem('prog_clapper', { name: '記念のカチンコ', price: 0, desc: 'はじめてのレギュラー収録の記念に、\nディレクターがくれたカチンコ。' });
registerItem('prog_special_ribbon', { name: '大型特番の出演リボン', price: 0, desc: '大型特番に出演したときの、胸のリボン。\nスタジオの熱気がよみがえる。' });

// ======================================================================== state
function pstate(g) {
  const fl = g.state.flags;
  if (!fl.programs || typeof fl.programs !== 'object' || Array.isArray(fl.programs)) fl.programs = {};
  const s = fl.programs;
  for (const k of ['guest', 'offered', 'wd', 'drops', 'stations', 'local']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  return s;
}
const GUEST_GAP = 7; // the same program again as a guest: a week later
const OFFER_GAP = 28; // a program's regular slot is not offered again within 4 weeks
const MAX_SHOWS = 4; // shows held at once, the career's and these together (冠番組 aside)
const MAX_PROG_SHOWS = 2; // of those, real programs
const LOCAL_DAYS = OFFER_DAYS; // a phone ロケ offer stays open this long

// ======================================================================== regulars
const staffLook = () => LOOKS.director || LOOKS.staff;
function regWeekday(p) {
  const st = ST();
  const w = st && st.flags && st.flags.programs && st.flags.programs.wd ? st.flags.programs.wd[p.id] : null;
  return Number.isInteger(w) && w >= 0 && w < 7 ? w : (p.wd ?? 2);
}
for (const p of PROGRAM_LIST) {
  if (!p.regular || !p.station) continue;
  const T = TIERS[p.tier];
  if (!T.reg) continue;
  const id = progId(p);
  registerRegular(id, {
    title: p.title, place: p.station, medium: 'tv', requires: { ...tierReq(p.tier) },
    pay: T.reg.pay, fame: T.reg.fame, fans: T.reg.fans, stamina: T.stamina,
    skill: programSkill(p), minigame: programMinigame(p),
    host: `${stationName(p.station)}のプロデューサー`, hostLook: staffLook(),
    desc: `${p.genre}『${p.title}』のレギュラー出演。`,
  });
  Object.defineProperty(REGULARS[id], 'weekday', { get: () => regWeekday(p), enumerable: true, configurable: true });
  Object.defineProperty(REGULARS[id], 'opts', { get: () => programOpts(p, ST(), true), enumerable: true, configurable: true });
}
const isProgShow = (id) => PROGRAM_SHOW_IDS.includes(id);
const activeReg = (st, id) => !!(st.regulars[id] && !st.regulars[id].dropped && st.regulars[id].since != null);
const openOffer = (st, m) => m && m.kind === 'offer' && !m.answered && st.day - num(m.day) < OFFER_DAYS;
// every weekly show the player holds (career's shows and these; not the 冠番組 / one-day events)
const weeklyHeld = (st) => Object.keys(st.regulars).filter((id) => REGULARS[id] && id !== 'career_kanmuri' && REGULARS[id].medium !== 'event' && REGULARS[id].weekday >= 0 && activeReg(st, id));
const openShowOffers = (st) => st.phone.inbox.filter((m) => openOffer(st, m) && m.regular && m.regular !== 'career_kanmuri' && REGULARS[m.regular] && REGULARS[m.regular].medium !== 'event');
// How many real-program regulars the player holds (for career.js and the notebook).
export function programShowsHeld(st = ST()) { return st && st.regulars ? PROGRAM_SHOW_IDS.filter((id) => activeReg(st, id)).length : 0; }
// A sitting minister / prime minister (大臣規範: no other occupation while in office): no new offers
// of any kind (shows already held follow the politics core: TV / radio end, stage work may go on).
export function inCabinet(g) {
  const p = g && g.state && g.state.politics;
  const posts = p && p.me && Array.isArray(p.me.posts) ? p.me.posts : [];
  const POSTS = (POL && POL.POSTS) || {};
  return posts.some((x) => x === 'pm' || (POSTS[x] && POSTS[x].kind === 'cabinet'));
}
// Why no producer calls with a show now (null: they may). Asks the cores the recording itself would
// ask (g.doRegular / g.job): custody, 活動自粛 and a TV ban (justice core: stage shows still come during
// a TV ban), an official campaign the player runs in or a cabinet post (politics core: TV / radio only).
// The politics core gets a def without the 'regular_' prefix, so it reads only the medium and leaves
// the show's week alone. Also used by career.js (offers, the 冠番組).
export function showOfferRefusal(g, id, medium) {
  const r = REGULARS[id];
  const md = medium || (r && r.medium) || 'tv';
  try {
    if (typeof g.justiceRefusal === 'function') {
      const why = g.justiceRefusal('regular', { id: 'regular_' + id, medium: md });
      if (why) return why;
    }
    if (typeof g.politicsRefusal === 'function') {
      const why = g.politicsRefusal('regular', { id: 'offer_' + id, medium: md });
      if (why) return why;
    }
  } catch (e) { console.error('[programs] showOfferRefusal', e); }
  return null;
}

// A program the player can be offered a regular slot on now (or why not: for the desk).
function regularBlock(g, p) {
  const st = g.state;
  const id = progId(p);
  if (!p.regular || !REGULARS[id]) return 'none';
  if (!p.regEras.includes(eraKey(st))) return 'none';
  if (activeReg(st, id)) return 'active';
  if (st.phone.inbox.some((m) => openOffer(st, m) && m.regular === id)) return 'pending';
  if (!PLACES[p.station]) return 'noplace';
  if (num(st.jobs[id]) <= 0) return 'guestFirst'; // a guest appearance first ('prog_<id>')
  if (g.checkRequires(REGULARS[id].requires)) return 'fame';
  const P = pstate(g);
  if (P.offered[p.id] != null && st.day - P.offered[p.id] < OFFER_GAP) return 'wait';
  const s = st.regulars[id];
  if (s && s.declined && st.day - s.declined < OFFER_GAP) return 'wait';
  return null;
}
// A free weekday for a new show: its own one, else the nearest day without another show.
function freeWeekday(st, p) {
  const busy = new Set(weeklyHeld(st).map((id) => REGULARS[id].weekday));
  const want = p.wd ?? 2;
  for (let k = 0; k < 7; k++) {
    for (const w of [want + k, want - k]) { const d = ((w % 7) + 7) % 7; if (!busy.has(d)) return d; }
  }
  return want;
}
function sendRegularOffer(g, p) {
  const st = g.state;
  const P = pstate(g);
  const id = progId(p);
  P.wd[p.id] = freeWeekday(st, p);
  P.offered[p.id] = st.day;
  P.lastOfferWeek = g.week;
  const wd = `毎週${WEEKDAYS[P.wd[p.id]]}曜`;
  const text = kansaiStation(p.station)
    ? `${stationName(p.station)}の『${p.title}』のプロデューサーです。\nこの前のゲスト出演、えらい評判よかったんですわ！\n${wd}の収録に、レギュラーで出てもらえませんか？`
    : `${stationName(p.station)}『${p.title}』のプロデューサーです。\n先日のゲスト出演、とても好評でした！\n${wd}の収録に、レギュラーとして出ていただけませんか？`;
  g.message({ from: REGULARS[id].host, look: REGULARS[id].hostLook, kind: 'offer', regular: id, text: g.fmt(text) });
}
// A show you were dropped from counts as offered that day (no new offer for 4 weeks).
function noteDrops(g, P) {
  const st = g.state;
  for (const p of PROGRAM_LIST) {
    const s = st.regulars[progId(p)];
    if (s && s.dropped && s.since != null && P.drops[p.id] !== s.since) { P.drops[p.id] = s.since; P.offered[p.id] = st.day; }
  }
}
function regularOfferMorning(g, P) {
  const st = g.state;
  if (P.lastOfferWeek === g.week) return; // one new program offer a week at most
  const held = weeklyHeld(st), offers = openShowOffers(st);
  if (held.length + offers.length >= MAX_SHOWS) return;
  const mine = held.filter(isProgShow).length + offers.filter((m) => isProgShow(m.regular)).length;
  if (mine >= MAX_PROG_SHOWS) return;
  const cands = PROGRAM_LIST.filter((p) => regularBlock(g, p) === null && !showOfferRefusal(g, progId(p)));
  if (!cands.length) return;
  // the program you appeared on most, the higher tier, then random
  const score = (p) => num(st.jobs[progId(p)]) * 2 + p.tier * 3 + Math.random() * 2;
  cands.sort((a, b) => score(b) - score(a));
  sendRegularOffer(g, cands[0]);
}

// ======================================================================== local / CS programs (phone ロケ)
function localMeet(p) { return ((p.local && p.local.meet) || []).find((id) => PLACES[id]) || null; }
function localOfferMorning(g, P) {
  const st = g.state;
  if (showOfferRefusal(g, 'prog_local', 'tv')) return; // no TV work now: the ロケ offer waits
  for (const p of PROGRAM_LIST) {
    if (!p.local || P.local[p.id] || !p.eras.includes(eraKey(st))) continue;
    if (g.checkRequires(tierReq(p.tier))) continue;
    const meet = localMeet(p);
    if (!meet) continue;
    P.local[p.id] = { day: st.day, meet, done: false };
    g.message({
      from: `『${p.title}』のAD`, look: LOOKS.ad, kind: 'news',
      text: g.fmt(`${p.local.channel}の『${p.title}』のADです！\n大阪でのロケ収録に、ゲストで出てもらえませんか？\n集合場所は${stationName(meet)}の受付です。2週間以内なら、いつでも大丈夫です！`),
    });
    return; // one at a time
  }
}
// local ロケ waiting at this place's desk
function pendingLocal(g, stationId) {
  const st = g.state;
  const P = pstate(g);
  return PROGRAM_LIST.filter((p) => {
    const L = p.local && P.local[p.id];
    return L && !L.done && L.meet === stationId && st.day - num(L.day) < LOCAL_DAYS && p.eras.includes(eraKey(st));
  });
}

// ======================================================================== special events
async function afterGuest(g, p, stationId, who) {
  const st = g.state;
  const P = pstate(g);
  P.total = num(P.total) + 1;
  const firstHere = !P.stations[stationId];
  if (stationId) P.stations[stationId] = true;
  // 1) the first network appearance
  if (!P.firstNetwork && !p.local) {
    P.firstNetwork = st.day;
    g.sfx('fanfare');
    await g.say([
      `おつかれさまでした！\n${stationName(stationId)}の番組、はじめての出演ですよね。`,
      'スタッフみんなで、ちょっとしたお祝いを用意しました。\nこれ、今日の入館証です。記念にどうぞ！',
    ], { name: 'AD', look: LOOKS.ad });
    g.giveItem('prog_first_pass', 1, true);
    g.addFans(300, true);
    await g.say('『テレビ局の記念入館証』をもらった！\n（ファン +300）');
  } else if (firstHere && kansaiStation(stationId) && !P.kansai) {
    // 2) the first Osaka station
    P.kansai = st.day;
    await g.say(`大阪のテレビ局、${stationName(stationId)}でのはじめての出演や！\nまた来てくださいね〜！`, { name: 'AD', look: LOOKS.ad });
    g.addFans(150, true);
  }
  // 3) a big special (★2000)
  if (p.tier >= 4 && !P.bigSpecial) {
    P.bigSpecial = st.day;
    await g.say(`『${p.title}』みたいな大型特番に出られるなんて…！\nスタジオの熱気がすごかった。`);
    g.giveItem('prog_special_ribbon', 1, true);
    await g.say('『大型特番の出演リボン』をもらった！');
  }
  // 4) every key station of this era
  const era = eraKey(st);
  const keys = KEY_STATIONS.filter((s) => programsAt(s, era).length);
  if (!P.keySweep && keys.length >= 3 && keys.every((s) => P.stations[s])) {
    P.keySweep = st.day;
    g.sfx('fanfare');
    await g.say([
      `{name}さん、これで東京のテレビ局の番組に、ひととおり出演しましたね！`,
      'プロデューサーたちのあいだでも、評判になっていますよ。\nこれ、スタッフ一同からです！',
    ], { name: 'プロデューサー', look: staffLook() });
    g.giveItem('prog_key_plaque', 1, true);
    g.addFame(30, true);
    await g.say('『キー局制覇の記念盾』をもらった！\n（知名度 +30）');
  }
}
// The first recording of a real program's regular slot: a keepsake the next morning.
function firstRegularMorning(g, P) {
  const st = g.state;
  if (P.firstRegular) return;
  const id = PROGRAM_SHOW_IDS.find((x) => st.regulars[x] && num(st.regulars[x].count) > 0);
  if (!id) return;
  P.firstRegular = st.day;
  g.giveItem('prog_clapper', 1, true);
  g.message({ from: REGULARS[id].host, look: REGULARS[id].hostLook, kind: 'news', text: g.fmt(`はじめてのレギュラー収録、おつかれさまでした！\n『${REGULARS[id].title}』のスタッフ一同、これからよろしくお願いします。\n記念のカチンコ、お送りしておきました！`) });
}

onMorning((g) => {
  const st = g.state;
  if (!st || !st.flags || !st.phone || !st.regulars || !st.jobs) return;
  const P = pstate(g);
  const steps = [noteDrops, firstRegularMorning];
  // a busy morning (3+ new messages): no new offers today
  const busy = st.phone.inbox.filter((m) => m && m.day === st.day).length >= 3;
  if (!busy) steps.push(localOfferMorning, regularOfferMorning);
  for (const fn of steps) {
    try { fn(g, P); } catch (e) { console.error('[programs]', fn.name, e); }
  }
});

// ======================================================================== the desk
// The guest appearance (a g.job). Returns the minigame result or null.
async function guestJob(g, p, stationId, who) {
  const st = g.state;
  const P = pstate(g);
  const T = TIERS[p.tier];
  const last = P.guest[p.id];
  if (last != null && st.day - last < GUEST_GAP) {
    await g.say(`『${p.title}』には、つい最近出たばかりです。\nまた来週以降に、ぜひお願いします！`, who);
    return null;
  }
  const res = await g.job({
    id: progId(p), title: p.title, desc: `${stationName(stationId || p.station)}の${p.genre}にゲスト出演！`,
    client: who.name, clientLook: who.look, stamina: T.stamina,
    minigame: programMinigame(p), opts: programOpts(p, st), skill: programSkill(p), gain: p.tier + 1,
    pay: T.guest.pay, fame: T.guest.fame, fans: T.guest.fans, requires: tierReq(p.tier),
  });
  if (!res) return null;
  P.guest[p.id] = st.day;
  await afterGuest(g, p, stationId, who);
  return res;
}
// What the desk says about a program's regular slot.
async function regularTalk(g, p, who) {
  const id = progId(p);
  const why = regularBlock(g, p);
  const r = REGULARS[id];
  const lines = {
    active: () => `『${p.title}』のレギュラー、いつもありがとうございます！\n毎週${WEEKDAYS[r.weekday]}曜が収録日です。この建物に来てくださいね。`,
    pending: () => 'レギュラーのお話、スマホにお送りしていますよ。\nお返事、お待ちしています！',
    guestFirst: () => 'レギュラーの枠は、まずゲストで出ていただいてから、\nプロデューサーが決めるんです。よかったら、ゲストからどうぞ！',
    fame: () => `レギュラーになるには、もう少し知名度が必要みたいです。\n（★${TIERS[p.tier].fame}以上）`,
    noplace: () => 'いまはスタジオの準備中で、レギュラーの話はまだ先になりそうです。',
    none: () => `『${p.title}』は、いまはゲスト出演だけなんです。`,
  };
  if (why !== 'active' && why !== 'none' && showOfferRefusal(g, id)) {
    await g.say('レギュラーのお話は…いまは、ちょっと難しいみたいです。\nまた落ち着いたら、ぜひ。', who);
    return;
  }
  if (why === null || why === 'wait') {
    await g.say('評判はプロデューサーの耳にも届いていますよ。\n枠が空いたら、スマホに連絡が行くと思います！', who);
    return;
  }
  await g.say((lines[why] || lines.none)(), who);
}
// A local (CS) program's ロケ, met at this desk.
async function localLoke(g, p, stationId, who) {
  const P = pstate(g);
  const T = TIERS[p.tier];
  await g.say(`『${p.title}』のロケのかたですね。\nロケバスが表で待っていますよ。いってらっしゃい！`, who);
  const res = await g.job({
    id: progId(p), title: p.title, desc: `${p.local.channel}の番組の大阪ロケ。`,
    client: `『${p.title}』のAD`, clientLook: LOOKS.ad, stamina: T.stamina,
    minigame: programMinigame(p), opts: programOpts(p, g.state), skill: programSkill(p), gain: p.tier + 1,
    pay: T.guest.pay, fame: T.guest.fame, fans: T.guest.fans, requires: tierReq(p.tier),
  });
  if (!res) return null;
  P.local[p.id].done = true;
  P.guest[p.id] = g.state.day;
  P.total = num(P.total) + 1;
  await g.say('ロケ、おつかれさまでした！\nオンエアは来月です。お楽しみに！', { name: `『${p.title}』のAD`, look: LOOKS.ad });
  return res;
}

// The reception desk of a TV station: the station's programs of the player's era.
export async function programDesk(g, stationId, npc) {
  const st = g.state;
  const who = { name: (npc && npc.name) || '受付', look: npc ? npc.look : undefined };
  const era = eraKey(st);
  const eraLabel = (ERAS[era] && ERAS[era].label) || '';
  const progs = programsAt(stationId, era);
  const locals = pendingLocal(g, stationId);
  if (!progs.length && !locals.length) {
    await g.say(`いまの時代（${eraLabel}）、${stationName(stationId)}で{name}さんにお願いできる番組は、まだないんです。\nまたの機会に、ぜひ！`, who);
    return;
  }
  const P = pstate(g);
  if (!P.desk) P.desk = {};
  if (!P.desk[stationId]) {
    P.desk[stationId] = st.day;
    await g.say(`${stationName(stationId)}へようこそ！\nいま出演者を募集している番組は、こちらです。`, who);
  }
  let index = 0;
  for (let guard = 0; guard < 12; guard++) {
    const entries = [
      ...locals.filter((p) => !P.local[p.id].done).map((p) => ({ p, local: true })),
      ...progs.map((p) => ({ p, local: false })),
    ];
    if (!entries.length) return;
    const items = entries.map(({ p, local }) => {
      if (local) return { label: `ロケ：${p.title}`, right: '集合' };
      const reg = activeReg(st, progId(p));
      return { label: p.title, right: reg ? 'レギュラー' : `★${TIERS[p.tier].fame}`, disabled: !!g.checkRequires(tierReq(p.tier)) };
    });
    const describe = (i) => {
      const e = entries[i];
      if (!e) return '';
      const p = e.p, T = TIERS[p.tier];
      if (e.local) return `${p.local.channel}の番組（${yearsText(p)}）\n${p.desc}\n大阪ロケのゲスト／ギャラ目安¥${T.guest.pay.toLocaleString('ja-JP')}`;
      const tag = p.special ? '特番' : p.regEras.includes(era) && p.regular ? 'レギュラー枠あり' : 'ゲスト出演';
      return `${p.genre}｜${stationName(p.station)}（${yearsText(p)}）\n${p.desc}\n★${T.fame}から／ギャラ目安¥${T.guest.pay.toLocaleString('ja-JP')}／${tag}`;
    };
    const i = await g.list({ title: `${stationName(stationId)}の番組`, items, index, px: true, x: 16, y: 52, w: 560, describe });
    if (i < 0 || !entries[i]) return;
    index = i;
    const { p, local } = entries[i];
    if (local) { await localLoke(g, p, stationId, who); return; }
    const why = g.checkRequires(tierReq(p.tier));
    if (why) {
      await g.say(`『${p.title}』は、★${TIERS[p.tier].fame}から出演できる番組です。\n（いまは★${st.fame}）`, who);
      if (g.auto) return; // auto-play: never loop on a locked row
      continue;
    }
    const hasReg = p.regular && p.regEras.includes(era) && REGULARS[progId(p)];
    const choices = hasReg ? ['ゲスト出演', 'レギュラーの話', 'もどる'] : ['ゲスト出演', 'もどる'];
    const k = await g.ask(`『${p.title}』\n${p.desc}`, choices, { ...who, cancel: choices.length - 1 });
    if (k === 0) { await guestJob(g, p, stationId, who); return; }
    if (hasReg && k === 1) { await regularTalk(g, p, who); if (g.auto) return; continue; }
    if (g.auto) return;
  }
}
