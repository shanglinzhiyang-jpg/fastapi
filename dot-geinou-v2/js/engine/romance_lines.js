// 恋愛・結婚・家庭 (R12-L1) — the lines: small talk by stage and era, reactions, seasonal messages.
// Tokens as romance_data.js sayLine ({I} {yo} {ne} {da} {dane} {deshou} {kara} {nda} {teru} {no} …); {name} is the player.
import { JOBS, sayLine, DEVICE, rngPick, rngNext } from './romance_data.js';

// How a person calls the player at each stage: {name} + さん / くん / ちゃん / (bare).
export function callYou(rec, pg, pAge = 20) {
  const nm = '{name}';
  if (rec.st === 'know') return `${nm}さん`;
  const gender = pg && pg.gender;
  if (rec.st === 'close') return rec.age > pAge + 5 ? `${nm}さん` : (gender === 'f' ? `${nm}ちゃん` : gender === 'm' ? `${nm}くん` : `${nm}さん`);
  return nm; // dating and on: the name itself
}

// ---------------------------------------------------------------- polite openers for people you hardly know
export const KNOW_TALK = [
  'この前は、ありがとうございました。\nまたお話しできたら、うれしいです。',
  '{name}さん、こんにちは。\nお仕事、おつかれさまです。',
  '先日は楽しかったです。\n今度、ゆっくりお話ししませんか？',
  '{name}さんの活躍、こっそり応援しています。',
];
// ---------------------------------------------------------------- closer: friends who might be more
export const CLOSE_TALK = [
  '今度また、ごはん行こう{yo}。',
  '{name}は最近どう？ちゃんと寝て{teru}？',
  '新しくできたお店、気になってる{nda}。今度どう{no}？',
  '{name}と話してると、時間があっという間{da}。',
  'そういえば、この前の話の続き、聞かせて{ne}。',
];
export const DATING_TALK = [
  '今日も一日おつかれさま。無理しないで{ne}。',
  '{name}のこと、ふと考えてた{yo}。',
  '次のお休み、いつ{dane}？会いたいな。',
  '{name}ががんばってる{kara}、{I}もがんばれる{yo}。',
  'ごはん、ちゃんと食べた{no}？',
  '今日ね、{name}に話したいことがいっぱいある{nda}。',
  '寒くなってきた{kara}、風邪ひかないで{ne}。',
];
export const COHAB_TALK = [
  '今日の晩ごはん、何がいい？',
  '牛乳が切れてた{kara}、帰りに買ってきて{ne}。',
  '洗濯物、取りこんでおいた{yo}。',
  '帰り、何時ごろになりそう？',
  'お風呂わかしておく{ne}。',
];
export const ENGAGED_TALK = [
  '式場の資料、また届いた{yo}。いっしょに見よう{ne}。',
  'ふたりの新居、どんな部屋がいいかな。',
  '{name}と結婚するんだな、って、ふと実感した{yo}。',
];
export const MARRIED_TALK = [
  '今日は早く帰れそう？',
  '今月の家計、ちょっと余裕があった{yo}。',
  '週末、どこか出かけよう{ne}。',
  'おつかれさま。夕ごはん、作って待ってる{ne}。',
  '{name}の出てた番組、見たよ。わが家のヒーロー{da}。',
];
// by era: the device they write on
export const ERA_TALK = {
  showa: ['電話ありがとう。{I}、公衆電話からかけてる{nda}。', '今度の日曜、{name}の都合はどう{no}？家の電話に伝言ちょうだい{ne}。'],
  heisei_early: ['0840！（おはよう、の数字だよ）', '14106。…意味、わかる{no}？', '今夜、ポケベル鳴らして{ne}。'],
  heisei: ['メール、返信おそくなってごめん（汗）', 'ケータイの待ち受け、{name}の写真にしちゃった{yo}。', 'メールうれしい{yo}。また送って{ne}。'],
  reiwa: ['スタンプ送ったの、気づいた{no}？', '既読ついたのに返事がない、って思われてない{kara}、いま打ってる{yo}。', 'ビデオ通話しない？顔見たくなった。'],
};

// One small-talk line for a person at their stage.
export function smallTalk(g, rec, rom, era) {
  let pool;
  switch (rec.st) {
    case 'know': pool = KNOW_TALK; break;
    case 'close': pool = CLOSE_TALK; break;
    case 'dating': pool = DATING_TALK; break;
    case 'cohab': pool = COHAB_TALK.concat(DATING_TALK); break;
    case 'engaged': pool = ENGAGED_TALK.concat(DATING_TALK); break;
    case 'married': pool = MARRIED_TALK; break;
    default: pool = CLOSE_TALK;
  }
  const job = JOBS[rec.jb];
  const pick = rngNext(rom);
  let t;
  if (rec.st !== 'know' && job && pick < 0.3) t = rngPick(rom, job.talk);
  else if (rec.st !== 'know' && pick < 0.5 && ERA_TALK[era]) t = rngPick(rom, ERA_TALK[era]);
  else t = rngPick(rom, pool);
  if (t === rec.lastTalk) t = rngPick(rom, pool);
  rec.lastTalk = t;
  return rec.st === 'know' ? t : sayLine(t, rec);
}

// ---------------------------------------------------------------- Valentine / White Day / Christmas (the messages)
export function seasonLine(kind, rec, era, pg) {
  const f = rec.g === 'f';
  switch (kind) {
    case 'valentine':
      if (era === 'showa' || era === 'heisei_early') return f ? '{name}、これ…チョコレート。\n本命、だからね。受け取ってくれる？' : 'バレンタインって、女の子から贈るものだけど…\n{I}からも、チョコ、渡したくて。';
      return '今日はバレンタイン。\nチョコ、用意したよ。{name}と食べたくて。';
    case 'whiteday':
      return era === 'showa' || era === 'heisei_early' ? 'ホワイトデーのお返し、楽しみにしてる{yo}。\n（3月14日は、男の子がお返しする日なんだって）' : 'ホワイトデー、ちょっと期待しちゃってる{yo}。';
    case 'xmas':
      return era === 'showa' || era === 'heisei_early' ? 'クリスマスイブの夜、空いてる？\n…予定、入れないでおいてほしいな。' : 'クリスマス、いっしょに過ごしたいな。\nイルミネーション、見に行かない？';
    case 'hatsumode':
      return '初詣、いっしょに行かない？\nおみくじ、引きたいな。';
    case 'tanabata':
      return '今日は七夕。\n短冊に「{name}と、もっといっしょにいられますように」って書いた{yo}。';
    case 'toshikoshi':
      return '今年も、あと少し。\nいっしょに年を越せたら、うれしいな。';
    default: return null;
  }
}

// ---------------------------------------------------------------- the weekly message when it has been quiet
export const MISS_YOU = [
  '最近、会えてないね。\n忙しいのはわかってる{kara}、無理は言わない{yo}。…でも、ちょっとさびしいな。',
  'ちゃんと生きてる{no}？\n返事、待ってる{ne}。',
  '{name}の声が聞きたくなった。\n時間ができたら、連絡して{ne}。',
];
export const COLD_TALK = [
  '…最近、返事がないね。\nいそがしいなら、そう言ってほしいな。',
  '連絡、待ってたんだ{yo}。',
];

export { sayLine, DEVICE };
