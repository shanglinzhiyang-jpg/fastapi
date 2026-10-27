// 恋愛・結婚・家庭 (R12-L1) — static data: names, jobs, personalities, compatibility, date spots, dialects, era facts.
// Pure data and small pure helpers (no state, no side effects): romance.js and the romance_* modules import from here.
// API doc: test-output/api_romance.txt.
//
// Everyone here is fictional and an adult (18+). Names are common surnames + common given names by the decade
// the person was born in (romance.js checks them with contests.js isRealNameLike when that module is loaded).

import { PERSONALITIES } from './profile.js';

export const ERA_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export const eraKey = (st) => {
  const e = st && st.profile && st.profile.era;
  return ERA_YEAR[e] ? e : 'reiwa';
};
export const MODERN = { showa: 0, heisei_early: 1, heisei: 2, reiwa: 3 }; // order of the eras
export const eraIdx = (st) => MODERN[eraKey(st)];

// What the phone is called in each era (for the lines the people write).
export const DEVICE = { showa: '電話', heisei_early: 'ポケベル', heisei: 'ケータイ', reiwa: 'スマホ' };

// ---------------------------------------------------------------- dialects (as family.js)
// Tokens in a line: {I} first person, {yo} {ne} {da} (noun + copula + sentence end), {dap} (bare copula), {dane},
// {deshou}, {kara}, {nda}, {teru}/{deru}, {no} (question), {totemo}, {honma}, {doshita}, {yoku}.
export const DIA = {
  standard: { yo: 'よ', ne: 'ね', da: 'だよ', dap: 'だ', dane: 'だね', deshou: 'でしょ', kara: 'から', totemo: 'とっても', nda: 'んだよ', teru: 'てる', deru: 'でる', honma: 'ほんと', doshita: 'どうしたの', yoku: 'よく', no: 'の' },
  kansai: { yo: 'で', ne: 'な', da: 'やで', dap: 'や', dane: 'やな', deshou: 'やろ', kara: 'から', totemo: 'めっちゃ', nda: 'んや', teru: 'てる', deru: 'でる', honma: 'ほんま', doshita: 'どうしたん', yoku: 'よう', no: 'ん' },
  hokkaido: { yo: 'よ', ne: 'ね', da: 'だわ', dap: 'だ', dane: 'だね', deshou: 'っしょ', kara: 'から', totemo: 'なまら', nda: 'んだわ', teru: 'てる', deru: 'でる', honma: 'ほんと', doshita: 'どうしたの', yoku: 'よく', no: 'の' },
  tohoku: { yo: 'よ', ne: 'な', da: 'だ', dap: 'だ', dane: 'だな', deshou: 'だべ', kara: 'がら', totemo: 'すごく', nda: 'んだ', teru: 'てる', deru: 'でる', honma: 'ほんと', doshita: 'どうした', yoku: 'よく', no: 'の' },
  chubu: { yo: 'よ', ne: 'ね', da: 'だに', dap: 'だ', dane: 'だね', deshou: 'だら', kara: 'から', totemo: 'すごく', nda: 'んだに', teru: 'てる', deru: 'でる', honma: 'ほんと', doshita: 'どうしたの', yoku: 'よく', no: 'の' },
  chugoku: { yo: 'よ', ne: 'ね', da: 'じゃ', dap: 'じゃ', dane: 'じゃね', deshou: 'じゃろ', kara: 'けえ', totemo: 'ぶち', nda: 'んじゃ', teru: 'とる', deru: 'どる', honma: 'ほんと', doshita: 'どうしたん', yoku: 'よう', no: 'ん' },
  shikoku: { yo: 'よ', ne: 'ね', da: 'じゃ', dap: 'じゃ', dane: 'じゃね', deshou: 'じゃろ', kara: 'けん', totemo: 'ほんまに', nda: 'んよ', teru: 'とる', deru: 'どる', honma: 'ほんま', doshita: 'どしたん', yoku: 'よう', no: 'ん' },
  kyushu: { yo: 'ばい', ne: 'ね', da: 'ばい', dap: 'や', dane: 'やね', deshou: 'やろ', kara: 'けん', totemo: 'ばり', nda: 'とよ', teru: 'とる', deru: 'どる', honma: 'ほんと', doshita: 'どうしたと', yoku: 'よう', no: 'と' },
};
export const diaOfRegion = (region) => {
  const d = { hokkaido: 'hokkaido', tohoku: 'tohoku', kanto: 'standard', chubu: 'chubu', kansai: 'kansai', chugoku: 'chugoku', shikoku: 'shikoku', kyushu: 'kyushu' }[region];
  return d || 'standard';
};
// First person: casual speech by gender (kansai women: うち).
export function firstPerson(rec) {
  if (rec.g === 'f') return rec.dia === 'kansai' ? 'うち' : 'わたし';
  return rec.fp === 1 ? 'おれ' : 'ぼく';
}
// Fill a line for a person. x: extra tokens ({kid}, {job} …). {name} stays for g.fmt.
export function sayLine(tpl, rec, x = {}) {
  if (tpl == null) return '';
  const D = DIA[rec.dia] || DIA.standard;
  return String(tpl).replace(/\{([a-zA-Z]+)\}/g, (m, k) => {
    if (k in x) return x[k];
    if (k === 'I') return firstPerson(rec);
    if (k in D) return D[k];
    return m;
  });
}

// ---------------------------------------------------------------- names (fictional, common)
export const SURNAMES = ['青木', '石川', '井上', '今村', '大野', '岡田', '小川', '加藤', '河合', '木村', '近藤', '坂本', '清水', '杉本', '関口', '高田', '武田', '谷口', '津田', '中島',
  '西村', '野村', '橋本', '原田', '平井', '藤井', '前田', '松本', '三宅', '宮崎', '村田', '森本', '柳田', '山口', '吉田', '渡辺', '秋山', '浅野', '内田', '大塚', '川上', '小松', '白石', '田辺', '長谷', '福田', '堀内', '水野', '安藤', '荒井'];
// given names by the decade of birth (the era the player chose ≈ when they were born ~25 years earlier)
export const GIVEN = {
  showa: { m: ['浩二', '健一', '剛', '勉', '誠', '直樹', '隆', '秀樹', '和彦', '正樹', '哲也', '雅人'], f: ['恵子', '由美', '久美子', '陽子', '智子', '真理', '洋子', '典子', '裕子', '直美', '香織', '純子'] },
  heisei_early: { m: ['健太', '大輔', '淳', '賢治', '慎一', '圭太', '亮', '拓也', '和也', '祐介', '達也', '勇気'], f: ['美穂', '麻美', '千恵', '由香', '愛', '裕美', '亜紀', '真由美', '友美', '彩', '奈緒美', '京子'] },
  heisei: { m: ['翔太', '大樹', '拓海', '雄介', '亮太', '直人', '健人', '翼', '大地', '良太', '陽介', '悠'], f: ['麻衣', '美咲', '愛美', '絵里', '沙織', '菜摘', '彩花', '舞', '梨沙', '優子', '千尋', '亜美'] },
  reiwa: { m: ['蓮', '颯太', '翔', '大和', '悠斗', '陸', '湊', '陽翔', '樹', '海斗', '朔', '駿'], f: ['陽菜', '美咲', '結衣', '凛', '莉子', '彩花', '紗希', '葵', '咲良', '心春', '柚希', '詩織'] },
};

// ---------------------------------------------------------------- jobs
// n: the job as the era calls it (string | (era, g) => string); inc: the weekly money they bring home (internal yen);
// busy 0..2 (how often work gets in the way); lines: small talk about work.
const E = (a, b, c, d) => (era) => ({ showa: a, heisei_early: b, heisei: c, reiwa: d }[era]);
export const JOBS = {
  kaisha: { n: (era, g) => (era === 'showa' || era === 'heisei_early' ? (g === 'f' ? 'OL' : 'サラリーマン') : '会社員'), inc: 14000, busy: 1, from: 'shokuba', talk: ['今日は会議が三つもあって、くたくた{da}', '上司に怒られたけど、同僚が助けてくれた{yo}', '残業が続く{kara}、{name}のお笑いで元気もらいたい'] },
  ginko: { n: '銀行員', inc: 16000, busy: 1, talk: ['窓口がすごく混んでた{yo}', '数字とにらめっこの一日だった{ne}', '月末は{totemo}忙しい{nda}'] },
  kango: { n: E('看護婦', '看護婦', '看護師', '看護師'), inc: 15000, busy: 2, f: 1, talk: ['夜勤あけで{totemo}眠い…', '患者さんに「ありがとう」って言われて、うれしかった{yo}', '病棟は今日もバタバタ{da}'] },
  kangoM: { n: '看護師', inc: 15000, busy: 2, m: 1, minEra: 2, talk: ['夜勤あけで{totemo}眠い…', '患者さんに「ありがとう」って言われて、うれしかった{yo}', '病棟は今日もバタバタ{da}'] },
  hoiku: { n: E('保母さん', '保母さん', '保育士', '保育士'), inc: 11000, busy: 1, talk: ['子どもたちに、お絵かきをプレゼントされた{yo}', '運動会の準備で{totemo}いそがしい{nda}', '今日は泥だらけの一日だった{yo}'] },
  kyoshi: { n: '学校の先生', inc: 15000, busy: 2, talk: ['テストの採点が山のよう{da}', '生徒に「先生おもしろい」って言われた{yo}', '部活の顧問で、休みがない{nda}'] },
  shop: { n: '商店街のお店の人', inc: 8000, busy: 1, talk: ['常連さんが差し入れしてくれた{yo}', 'お店、今日は雨でヒマだった{ne}', '新商品のポップを書いた{nda}'] },
  biyo: { n: '美容師', inc: 9000, busy: 1, talk: ['今日はカットのモデルさんが来た{yo}', '立ちっぱなしで足がパンパン{da}', '髪、そろそろ切りに来なよ{ne}'] },
  cook: { n: '料理人', inc: 9000, busy: 2, talk: ['新しい味つけを試した{nda}', '今日は仕込みで朝から{totemo}いそがしかった{yo}', '賄いが、{totemo}おいしくできた{yo}'] },
  tv: { n: '番組の制作スタッフ', inc: 12000, busy: 2, from: 'shokuba', industry: 1, talk: ['今日は編集で徹夜明け{da}', 'ロケが雨で延びた{nda}', '企画会議がなかなか通らない{yo}'] },
  geinou: { n: '芸能事務所のスタッフ', inc: 11000, busy: 2, from: 'shokuba', industry: 1, talk: ['タレントさんのスケジュールで頭がいっぱい{da}', 'ライブの受付をやってた{yo}', '楽屋の差し入れ選びが{totemo}むずかしい{nda}'] },
  koumuin: { n: '区役所の職員', inc: 15000, busy: 0, talk: ['窓口はきょうも平和{da}', '書類が山積み{nda}', '定時で帰れた{kara}、ごはんでも行く？'] },
  it: { n: (era) => (era === 'reiwa' ? 'エンジニア' : 'システムエンジニア'), inc: 16000, busy: 2, minEra: 1, talk: ['バグがなかなか直らない…', 'リリース前で{totemo}いそがしい{nda}', 'パソコンの前から動けない一日だった{yo}'] },
  free: { n: (era) => (era === 'reiwa' ? 'アルバイトを掛け持ち' : 'フリーター'), inc: 5000, busy: 1, talk: ['バイト先の店長が変な人{nda}', 'シフトが急に変わった{yo}', '夢のために、お金をためてる{nda}'] },
  gakusei: { n: '大学生', inc: 1500, busy: 1, youngOnly: 1, talk: ['レポートの締切が近い{nda}', 'サークルの飲み会があった{yo}', '単位がちょっとあぶない{da}'] },
  jieigyo: { n: '家業の手伝い', inc: 10000, busy: 1, talk: ['親父に仕事をまかされた{nda}', '店の帳簿とにらめっこ{da}', '常連さんと立ち話ばかりしてる{yo}'] },
  artist: { n: (era) => (era === 'reiwa' ? 'デザイナー' : '絵を描く仕事'), inc: 7000, busy: 1, talk: ['締切に追われてる{nda}', '新しい絵の構図を思いついた{yo}', '描いてるとき、時間を忘れる{ne}'] },
};
export function jobName(job, era, g) {
  const j = JOBS[job] || JOBS.kaisha;
  const n = typeof j.n === 'function' ? j.n(era, g) : j.n;
  return n || '会社員';
}

// ---------------------------------------------------------------- personalities of the people you meet
// fit: how well each of the player's personalities (profile.js) goes with them, 0..2.
export const PERS = {
  yasashii: { name: 'やさしい', first: 'おだやかで、話しやすい人', fit: { akarui: 1, majime: 1, mypace: 2, makezu: 1, hitomishiri: 2, ochoshi: 1 }, tags: ['quiet', 'talk', 'indoor', 'book', 'gourmet'] },
  akarui: { name: '明るい', first: 'よく笑う、元気な人', fit: { akarui: 2, majime: 1, mypace: 1, makezu: 1, hitomishiri: 1, ochoshi: 2 }, tags: ['talk', 'outdoor', 'warai', 'music', 'sports'] },
  majime: { name: 'まじめ', first: 'きちんとしていて、頼りになる人', fit: { akarui: 1, majime: 2, mypace: 1, makezu: 1, hitomishiri: 1, ochoshi: 0 }, tags: ['book', 'quiet', 'indoor', 'nature'] },
  mypace: { name: 'マイペース', first: 'ふんわりしていて、気がぬける人', fit: { akarui: 1, majime: 0, mypace: 2, makezu: 0, hitomishiri: 1, ochoshi: 1 }, tags: ['nature', 'gourmet', 'quiet', 'music'] },
  shikkari: { name: 'しっかり者', first: '頼れる、姉御・兄貴ふうの人', fit: { akarui: 1, majime: 1, mypace: 2, makezu: 0, hitomishiri: 1, ochoshi: 2 }, tags: ['talk', 'gourmet', 'outdoor', 'sports'] },
  cool: { name: 'クール', first: '口数は少ないけれど、芯のある人', fit: { akarui: 1, majime: 1, mypace: 1, makezu: 1, hitomishiri: 2, ochoshi: 0 }, tags: ['quiet', 'book', 'music', 'indoor'] },
  genki: { name: '元気いっぱい', first: 'いるだけで場が明るくなる人', fit: { akarui: 2, majime: 0, mypace: 1, makezu: 1, hitomishiri: 0, ochoshi: 2 }, tags: ['outdoor', 'sports', 'warai', 'talk'] },
  ganbariya: { name: '努力家', first: '夢に向かってまっすぐな人', fit: { akarui: 1, majime: 2, mypace: 0, makezu: 2, hitomishiri: 1, ochoshi: 1 }, tags: ['sports', 'music', 'talk', 'outdoor'] },
};
export const PERS_ORDER = Object.keys(PERS);

export const TAGS = {
  indoor: { name: 'おうち派', opp: 'outdoor' },
  outdoor: { name: 'おでかけ派', opp: 'indoor' },
  talk: { name: 'おしゃべり好き', opp: 'quiet' },
  quiet: { name: 'しずかな時間が好き', opp: 'talk' },
  warai: { name: 'お笑い好き' },
  music: { name: '音楽好き' },
  gourmet: { name: '食べるのが好き' },
  book: { name: '本が好き' },
  sports: { name: '体を動かすのが好き' },
  nature: { name: '自然が好き' },
};
export const TAG_ORDER = Object.keys(TAGS);

// What the player brings: from the personality (profile.js) and what they like to do (date choices, state.taste).
const PLAYER_TAGS = {
  akarui: ['talk', 'outdoor'], majime: ['book', 'quiet'], mypace: ['nature', 'gourmet'],
  makezu: ['sports', 'warai'], hitomishiri: ['quiet', 'music'], ochoshi: ['warai', 'talk'],
};
export const playerTags = (persKey, taste) => {
  const out = new Set(PLAYER_TAGS[persKey] || ['talk']);
  const t = taste || {};
  for (const [k, n] of Object.entries(t)) if (n >= 3 && TAGS[k]) out.add(k);
  out.add('warai'); // an entertainer
  return out;
};

// ---------------------------------------------------------------- compatibility (a sense, never a number on screen)
// → { v: 0..3 (0 ちがうところが多い, 1 ふつう, 2 気が合う, 3 ぴったり), shared: [tag], diff: [tag], word, reasons: [text] }
export function compat(persKey, rec, taste) {
  const pl = playerTags(persKey, taste);
  const per = PERS[rec.per] || PERS.yasashii;
  let s = per.fit[persKey] ?? 1; // 0..2
  const shared = (rec.tags || []).filter((t) => pl.has(t));
  const diff = (rec.tags || []).filter((t) => TAGS[t] && TAGS[t].opp && pl.has(TAGS[t].opp) && !pl.has(t));
  s += Math.min(2, shared.length) * 0.8 - diff.length * 0.9;
  const v = s >= 3.3 ? 3 : s >= 2.1 ? 2 : s >= 1.1 ? 1 : 0;
  const reasons = [];
  if (shared.length) reasons.push(`${shared.map((t) => TAGS[t].name).slice(0, 2).join('・')}なところが同じ`);
  if (per.fit[persKey] >= 2) reasons.push('いっしょにいると、ペースが合う');
  if (per.fit[persKey] === 0) reasons.push('ペースが少しちがう');
  if (diff.length) reasons.push(`${TAGS[diff[0]].name}で、休みの過ごし方がちがう`);
  const word = ['ちがうところも多いかも', 'ふつうに話せる', '気が合いそう', 'ぴったりかもしれない'][v];
  return { v, s, shared, diff, word, reasons };
}
// How the air feels between you (aff + dates + compatibility), for 告白 and the proposal: 0..3.
export const AIR_WORDS = ['まだ友だちのままがいい空気', 'もう少しで届きそうな空気', 'いい感じの空気', 'とてもいい感じ！'];

// ---------------------------------------------------------------- the Valentine / seasons (the game's 10-day months)
// g.gameDate() gives { year, month, dom } with dom 1, 4, 7 … 28.
export function seasonOf(date) {
  const m = date ? date.month : 4, d = date ? date.dom : 1;
  const out = [];
  if (m === 1 && d <= 7) out.push('hatsumode');
  if (m === 2 && d >= 13 && d <= 16) out.push('valentine');
  if (m === 3 && d >= 13 && d <= 16) out.push('whiteday');
  if ((m === 3 && d >= 25) || (m === 4 && d <= 10)) out.push('sakura');
  if (m === 7 && d >= 7 && d <= 7) out.push('tanabata');
  if (m === 7 || m === 8) out.push('natsu');
  if (m === 11) out.push('momiji');
  if (m === 12 && d >= 22) out.push('xmas');
  if (m === 12 && d >= 28) out.push('toshikoshi');
  return out;
}

// ---------------------------------------------------------------- date spots
// price: what the outing costs you (internal yen); min: minutes; sta: stamina; aff: base gain; str: stress relief;
// tags: what kind of outing (matches a person's tags); out: outdoors (rain hurts); night: best / only after 17:00;
// need(g, { age, rec }) → why not (string) or null; art: romance_art.js painter id; go: the title card.
export const SPOTS = {
  cafe: { name: (e) => (e === 'showa' || e === 'heisei_early' ? '喫茶店' : 'カフェ'), go: '喫茶店でおしゃべり', price: 1400, min: 90, sta: 4, aff: 5, str: 14, tags: ['talk', 'quiet', 'indoor'], art: 'cafe', fill: 12 },
  eiga: { name: '映画館', go: '映画を観に行く', price: 3600, min: 180, sta: 6, aff: 6, str: 16, tags: ['quiet', 'indoor', 'book'], art: 'eiga' },
  live: { name: 'お笑いライブ', go: 'お笑いライブを観に行く', price: 3000, min: 150, sta: 6, aff: 6, str: 18, tags: ['warai', 'indoor'], art: 'live' },
  sanpo: { name: '公園さんぽ', go: '公園をさんぽする', price: 0, min: 90, sta: 6, aff: 4, str: 12, tags: ['outdoor', 'nature', 'talk'], art: 'park', out: 1 },
  gohan: { name: 'ごはん', go: 'ごはんを食べに行く', price: 2800, min: 90, sta: 4, aff: 5, str: 12, tags: ['gourmet', 'talk'], art: 'gohan', fill: 40 },
  izakaya: { name: '居酒屋', go: '居酒屋で乾杯', price: 5000, min: 150, sta: 5, aff: 6, str: 20, tags: ['gourmet', 'talk'], art: 'izakaya', night: 1, fill: 30, need: (g, x) => (x.age < 20 ? 'お酒は20歳になってから' : null) },
  karaoke: { name: 'カラオケ', go: 'カラオケに行く', price: 2600, min: 120, sta: 8, aff: 6, str: 22, tags: ['music', 'warai', 'talk'], art: 'karaoke' },
  suizokukan: { name: '水族館', go: '水族館に行く', price: 4200, min: 180, sta: 8, aff: 7, str: 18, tags: ['nature', 'indoor', 'quiet'], art: 'suizokukan' },
  kanransha: { name: '観覧車', go: '観覧車に乗る', price: 1700, min: 120, sta: 6, aff: 8, str: 16, tags: ['outdoor', 'quiet'], art: 'kanransha', out: 1, need: (g) => (visited(g, 'minato') ? null : 'テレビ局エリアの観覧車に、まだ行ったことがない') },
  yakei: { name: '夜景の見える展望台', go: '夜景を見に行く', price: 2400, min: 120, sta: 6, aff: 8, str: 16, tags: ['quiet', 'outdoor'], art: 'yakei', night: 1, out: 1, need: (g) => (visited(g, 'minato') ? null : 'テレビ局エリアの電波塔に、まだ行ったことがない') },
  drive: { name: 'ドライブ', go: 'ドライブに出かける', price: 3500, min: 240, sta: 8, aff: 8, str: 22, tags: ['outdoor', 'music', 'nature'], art: 'drive', out: 1, priceOf: (g) => (g.carOwned && g.carOwned() && !g.carDriveBlock() ? 1800 : 3500), need: (g) => (g.hasLicense && g.hasLicense() ? null : '運転免許がない') },
  home: { name: 'おうちデート', go: 'おうちでのんびり', price: 1200, min: 180, sta: 2, aff: 5, str: 24, tags: ['indoor', 'quiet', 'gourmet'], art: 'home', fill: 28, need: (g, x) => (x.rec && (x.rec.st === 'cohab' || x.rec.st === 'engaged' || x.rec.st === 'married') ? null : (x.rec && x.rec.st === 'dating' && x.rec.dates >= 4 ? null : 'まだ、おうちに呼ぶには早いかも')) },
  hatsumode: { name: '初詣', go: '初詣に行く', price: 600, min: 120, sta: 6, aff: 9, str: 14, tags: ['outdoor', 'quiet'], art: 'jinja', season: 'hatsumode', out: 1 },
  hanami: { name: 'お花見', go: 'お花見に行く', price: 1800, min: 150, sta: 6, aff: 9, str: 18, tags: ['outdoor', 'nature', 'gourmet'], art: 'hanami', season: 'sakura', out: 1 },
  hanabi: { name: '花火大会', go: '花火を観に行く', price: 2000, min: 180, sta: 8, aff: 10, str: 20, tags: ['outdoor', 'talk'], art: 'hanabi', season: 'natsu', night: 1, out: 1 },
  xmas: { name: (e) => (e === 'showa' || e === 'heisei_early' ? 'クリスマスイブの街' : 'クリスマスのイルミネーション'), go: 'クリスマスの街へ出かける', price: 6000, min: 180, sta: 6, aff: 12, str: 20, tags: ['outdoor', 'quiet'], art: 'illumi', season: 'xmas', night: 1, out: 1 },
};
export const SPOT_ORDER = ['cafe', 'eiga', 'live', 'sanpo', 'gohan', 'izakaya', 'karaoke', 'suizokukan', 'kanransha', 'yakei', 'drive', 'home', 'hatsumode', 'hanami', 'hanabi', 'xmas'];
export const spotName = (id, era) => { const s = SPOTS[id]; if (!s) return id; return typeof s.name === 'function' ? s.name(era) : s.name; };
export const spotGo = (id, era) => { const s = SPOTS[id]; if (!s) return ''; if (id === 'xmas') return era === 'showa' || era === 'heisei_early' ? 'クリスマスイブの街を歩く' : 'イルミネーションを観に行く'; return s.go; };
function visited(g, place) { const v = g && g.state && g.state.flags && g.state.flags.visited; return !!(v && v[place]); }

// ---------------------------------------------------------------- the way people meet, by era
// kind → label shown on the 出会い list. era: which eras offer it.
export const MEET = {
  goukon: { name: '合コン', eras: ['showa', 'heisei_early', 'heisei', 'reiwa'], price: 3500, desc: '友だちの紹介で、にぎやかな食事会。' },
  shokai: { name: '友だちの紹介', eras: ['showa', 'heisei_early', 'heisei', 'reiwa'], price: 1400, desc: '仲のいい友だちが「会わせたい人がいる」と。' },
  omiai: { name: 'お見合い', eras: ['showa', 'heisei_early', 'heisei', 'reiwa'], price: 0, desc: '家族や知り合いからの縁談。' },
  party: { name: 'お見合いパーティー', eras: ['showa', 'heisei_early', 'heisei'], price: 4000, desc: '会場にたくさんの人。ひとりずつ、おしゃべり。' },
  konkatsu: { name: '婚活パーティー', eras: ['heisei', 'reiwa'], price: 4000, desc: '婚活が言葉になった時代。ひと言ずつ、自己紹介。' },
  machikon: { name: '街コン', eras: ['reiwa'], price: 4500, desc: '街ぜんたいが会場の、大きな食事会。' },
  app: { name: 'マッチングアプリ', eras: ['reiwa'], price: 0, desc: 'プロフィールを見て「いいね」。メッセージから始まる。' },
  shokuba: { name: '職場・共演者', eras: ['showa', 'heisei_early', 'heisei', 'reiwa'], price: 0, desc: '仕事で知り合った人から、声をかけられることも。' },
  aibou: { name: '相方の友人', eras: ['showa', 'heisei_early', 'heisei', 'reiwa'], price: 0, desc: '相方が「紹介したい人がいる」と言ってきた。' },
};
export const MEET_ORDER = ['goukon', 'shokai', 'party', 'konkatsu', 'machikon', 'app'];

// ---------------------------------------------------------------- stages
export const STAGES = {
  know: { name: '知り合い', col: '#8a96aa' },
  close: { name: '気になる人', col: '#e2569a' },
  dating: { name: '恋人', col: '#ff5d8f' },
  cohab: { name: '同棲中', col: '#ff5d8f' },
  engaged: { name: '婚約中', col: '#ff8a3d' },
  married: { name: '結婚', col: '#d0703a' },
  ex: { name: '友だち', col: '#8a96aa' },
};

// ---------------------------------------------------------------- the people around (parents of the person you love, 仲人 …)
export const PARENT_SURNAME_NOTE = '名字は、その人の家のもの';

// ---------------------------------------------------------------- facts (one place; wording kept short)
export const FACTS = {
  marryAge: (year) => (year >= 2022 ? '結婚できるのは、男女とも18歳から（2022年4月から）。' : '結婚できるのは、男性18歳・女性16歳から。20歳になるまでは親の同意が必要だった。'),
  surname: '日本の法律では、夫婦は同じ名字になる。結婚するとき、どちらかの名字に決める。（仕事では、旧姓を「通称」として使い続ける人も多い）',
  samesex: (era) => (era === 'reiwa'
    ? '同性どうしの婚姻届は、いまのところ受理されない（「結婚の自由」をめぐる裁判が各地で続いている）。かわりに、自治体の「パートナーシップ制度」で、ふたりの関係を証明してもらえる。東京都では2022年11月から。'
    : '同性どうしの婚姻届は出せない。ふたりで暮らし、式をあげることはできても、法律の上の家族にはなれない時代だった。'),
  shussan: (era) => ({ showa: '産前6週・産後8週の産休は、法律で決まっている。育児休業の制度は、まだない（1992年から）。', heisei_early: '育児休業の制度は、1992年に始まった。取る人は、まだ少ない。', heisei: '産前6週・産後8週の産休と、子どもが1歳になるまでの育児休業がある。男性が取る人は、まだとても少ない。', reiwa: '産前6週・産後8週の産休と、育児休業。男性の育休も増えてきた。2023年4月から、出産育児一時金は50万円。' }[era]),
  hoikuen: (era) => ({ showa: '共働きの家は、認可保育所（保母さんのいる保育所）に預ける。母親が家にいる家は、幼稚園に通うのがふつうだった。', heisei_early: '保育所は、お母さんが働いている家のためのもの。幼稚園とは役所の担当もちがう。', heisei: '保育所に入りたくても、定員がいっぱいで待つ「待機児童」が、ニュースになっている。', reiwa: '保育園探しは「保活」と呼ばれる。3〜5歳は2019年10月から無償化された。' }[era]),
  jidoteate: (era) => ({ showa: '児童手当は、第3子から。一人っ子や二人きょうだいの家は、出ない時代。', heisei_early: '児童手当は、3歳未満の子どもに、少しだけ出る。', heisei: '児童手当や子ども手当など、制度は何度も変わっている。', reiwa: '児童手当は、2024年10月から高校生年代まで。第3子以降は月3万円。' }[era]),
  funin: (era) => (era === 'reiwa' ? '不妊の治療は、2022年4月から保険がきくようになった。' : '不妊の治療は、保険がきかず、費用がかなりかかる。'),
  rikon: '離婚の9割ほどは、役所に離婚届を出す「協議離婚」。話し合いがまとまらなければ、家庭裁判所の「調停」になる。',
};

// ---------------------------------------------------------------- seeded random (mulberry32 on a stored uint32)
export function rngNext(rom) {
  let a = (rom.rs = (rom.rs + 0x6D2B79F5) >>> 0);
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rngInt = (rom, n) => Math.floor(rngNext(rom) * n);
export const rngPick = (rom, list) => list[rngInt(rom, list.length)];
export function rngShuffle(rom, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rngInt(rom, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export { PERSONALITIES };
