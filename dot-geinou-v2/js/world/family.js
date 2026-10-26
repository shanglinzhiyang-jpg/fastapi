// 家族と実家: the family chosen in the character creator (g.state.profile.family, see
// engine/profile.js) as people you stay in touch with.
//
//   - Living members are registered as people ('fam_<rel>' ids, kind 'family') and start
//     as 仲良し (♥60): contacts with a 家族 chip, their own phone call (def.onCall, phone.js),
//     gifts and heart events at ♥3 / ♥4 (on the first call or visit at that level).
//     Their words follow the hometown's dialect (REGIONS[region].dialect).
//   - Mornings: family texts now and then (everyday news, worry when you are hungry /
//     stressed / behind on rent, cheers on a new title, agency or show), care packages
//     (仕送り: a hometown specialty 'furusato_<key>' and sometimes a little money, more
//     often when you are broke), birthday wishes (the birthday message itself comes from
//     main.js's hook when present: then only the present and a second member's line here).
//   - The phone app 「家族」: call, 送金 (send money home: ¥5,000 / ¥10,000 / ¥30,000), memories
//     of members who passed away, and how to go home.
//   - 帰省: 東京駅 → 「帰省する」 (station.js STATION_TICKETS) → the 実家 (place 'jikka':
//     house + yard). Home cooking, a futon (g.sleep away from home), お参り at the 仏壇,
//     big stress relief and ♥ once every FULL_VISIT_DAYS days. The gate takes you back.
//   - Members who passed away are background only: spoken of gently at the 仏壇 and in
//     the family's memories (the cause only when it is not 'secret', never in detail).
//
// State: g.state.flags.fam = { last, pkg, worry, next: { pid: day }, rank, agency, regs,
//   age, sent, saved, sendStress, callStress, visit: { start, welcomed, full, meal, gift },
//   lastFull, pray, help } and per person (g.state.people[pid]): callDay, memDay, sendDay,
//   lastFam (last line), family: true.
//
// For other modules / tests: ensureFamily(g) → members, familyCall(g, pid),
//   sendMoney(g, pid, amount), sendPackage(g, opts), tripOf(prefId), startVisit(g).

import {
  registerPerson, PEOPLE, PEOPLE_UI, HANGOUTS, REGULARS, HEARTS, MORNING_HOOKS, onMorning,
  registerPhoneApp, heartIndex,
} from '../engine/life.js';
import { registerItem, ITEMS, RANKS, rankIndex } from '../engine/state.js';
import { registerPlace } from '../engine/map.js';
import { defineTile, tileImageHD, R, P, outline, bevel, inset, dither, shadowEllipse, oval, grain, speckle } from '../engine/tiles.js';
import { drawFaceHD, LOOKS } from '../engine/sprites.js';
import { fmtMoney, shade } from '../engine/util.js';
import { text, wrap, COLORS } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import {
  PREFECTURES, REGIONS, RELATIONS, CAUSES, prefecture, regionOf, ageOf,
  profileOf, givenOf, familyLook,
} from '../engine/profile.js';
import { phoneList, phoneInfo, phoneConfirm, phoneView, box, phoneText, fitText, PC, SCREEN } from '../engine/phone.js';
import { STATION_TICKETS, travelScene } from './station.js';

// [R12-L1] extra rows of the 家族 app (romance_ui.js adds 「家族アルバム」): each (g) => { label, sub, run(g) } | null
export const FAMILY_ROWS = [];
export const START_AFF = 60; // 仲良し
export const FULL_VISIT_DAYS = 7; // full bonuses of a visit home at most this often
export const SEND_AMOUNTS = [5000, 10000, 30000];
const SEND_AFF = { 5000: 3, 10000: 5, 30000: 8 };
const SEND_STRESS = { 5000: 5, 10000: 8, 30000: 12 };
const CALL_STRESS = 8; // the first family call of a day
const CALL_AFF = 2;
const NEWS_GAP = 3; // days between two everyday family texts (any member)
const QUIET_GAP = 2; // days after any family text before a package or a worried text
const PKG_GAP = 16, PKG_GAP_NEED = 6; // days between care packages (normal / when broke or hungry)

const game = () => (typeof window !== 'undefined' && window.__game) || null;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const flat = (s) => String(s).replace(/\n/g, '');
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// ---------------------------------------------------------------- dialects
// Tokens used in the lines below ({yo} after a plain verb / adjective, {da} after a noun,
// {dap} the bare copula (だ / や / じゃ: {dap}から, {dap}った), {ne} a soft ending,
// {deshou} after a noun, {nda} explanatory, {teru} / {deru} progressive (し{teru},
// 喜ん{deru}), {kara} because, {no} question particle).
const DIA = {
  standard: { yo: 'よ', ne: 'ね', da: 'だよ', dap: 'だ', dane: 'だね', deshou: 'でしょ', kara: 'から', totemo: 'とっても', nda: 'んだよ', teru: 'てる', deru: 'でる', honma: 'ほんと', dameyo: 'だめだよ', doshita: 'どうしたの', yoku: 'よく', no: 'の' },
  kansai: { yo: 'で', ne: 'な', da: 'やで', dap: 'や', dane: 'やな', deshou: 'やろ', kara: 'から', totemo: 'めっちゃ', nda: 'んや', teru: 'てる', deru: 'でる', honma: 'ほんま', dameyo: 'あかんで', doshita: 'どうしたん', yoku: 'よう', no: 'ん' },
  hokkaido: { yo: 'よ', ne: 'ね', da: 'だわ', dap: 'だ', dane: 'だね', deshou: 'っしょ', kara: 'から', totemo: 'なまら', nda: 'んだわ', teru: 'てる', deru: 'でる', honma: 'ほんと', dameyo: 'だめだよ', doshita: 'どうしたの', yoku: 'よく', no: 'の' },
  tohoku: { yo: 'よ', ne: 'な', da: 'だ', dap: 'だ', dane: 'だな', deshou: 'だべ', kara: 'がら', totemo: 'すごく', nda: 'んだ', teru: 'てる', deru: 'でる', honma: 'ほんと', dameyo: 'だめだよ', doshita: 'どうした', yoku: 'よく', no: 'の' },
  chubu: { yo: 'よ', ne: 'ね', da: 'だに', dap: 'だ', dane: 'だね', deshou: 'だら', kara: 'から', totemo: 'すごく', nda: 'んだに', teru: 'てる', deru: 'でる', honma: 'ほんと', dameyo: 'だめだに', doshita: 'どうしたの', yoku: 'よく', no: 'の' },
  chugoku: { yo: 'よ', ne: 'ね', da: 'じゃ', dap: 'じゃ', dane: 'じゃね', deshou: 'じゃろ', kara: 'けえ', totemo: 'ぶち', nda: 'んじゃ', teru: 'とる', deru: 'どる', honma: 'ほんと', dameyo: 'いけんよ', doshita: 'どうしたん', yoku: 'よう', no: 'ん' },
  shikoku: { yo: 'よ', ne: 'ね', da: 'じゃ', dap: 'じゃ', dane: 'じゃね', deshou: 'じゃろ', kara: 'けん', totemo: 'ほんまに', nda: 'んよ', teru: 'とる', deru: 'どる', honma: 'ほんま', dameyo: 'いかんよ', doshita: 'どしたん', yoku: 'よう', no: 'ん' },
  kyushu: { yo: 'ばい', ne: 'ね', da: 'ばい', dap: 'や', dane: 'やね', deshou: 'やろ', kara: 'けん', totemo: 'ばり', nda: 'とよ', teru: 'とる', deru: 'どる', honma: 'ほんと', dameyo: 'いかんばい', doshita: 'どうしたと', yoku: 'よう', no: 'と' },
};
const ROLE = {
  father: 'parent', mother: 'parent', grandfather: 'grand', grandmother: 'grand',
  brother_older: 'older', sister_older: 'older', brother_younger: 'younger', sister_younger: 'younger',
};
const ME = {
  father: 'お父さん', mother: 'お母さん', grandfather: 'じいちゃん', grandmother: 'ばあちゃん',
  brother_older: 'おれ', sister_older: 'わたし', brother_younger: 'おれ', sister_younger: 'わたし',
};

// Fill a line for member M ({name} / {item} / {agency} stay for g.fmt and phone.js).
function fill(s, M, x = {}) {
  if (s == null) return s;
  const D = DIA[M.dia] || DIA.standard;
  return String(s).replace(/\{([a-z]+)\}/g, (m, k) => {
    if (k in x) return x[k];
    if (k === 'you') return M.you;
    if (k === 'me') return M.me;
    if (k === 'pref') return M.pref;
    if (k === 'gift') return M.gift;
    if (k === 'sib') return M.sib;
    if (k in D) return D[k];
    return m;
  });
}
// A pool entry: a string, or { t, cond(M) }.
function pool(list, M) {
  return (list || []).filter((e) => typeof e === 'string' || !e.cond || e.cond(M)).map((e) => (typeof e === 'string' ? e : e.t));
}
function fresh(g, M, list, x) {
  const all = pool(list, M);
  if (!all.length) return '';
  const p = g.person(M.pid);
  const choices = all.length > 1 && p ? all.filter((s) => s !== p.lastFam) : all;
  const s = pick(choices);
  if (p) p.lastFam = s;
  return fill(s, M, x);
}

// ---------------------------------------------------------------- lines (by role)
const hasLate = (M) => M.late.length > 0;
const hasParents = (M) => M.parents;
const NEWS = {
  parent: [
    '{you}、元気にし{teru}？こっちはみんな変わりない{yo}。たまには声を聞かせて{ne}。',
    '近所に新しいパン屋さんができた{yo}。{you}が帰ってきたら、いっしょに行こう{ne}。',
    '{me}、最近ウォーキングを始めた{nda}。体が軽くなった気がする{yo}。',
    '{you}の部屋は、出ていったときのままにしてある{yo}。いつでも帰っておいで。',
    '商店街の福引きで、お米が当たった{nda}。今度、送る{kara}{ne}。',
    '{pref}のローカル番組で芸能ニュースを見るたびに、{you}のことを思い出す{yo}。',
    '庭に植えた花が、きれいにさいた{yo}。{you}にも見せたい{nda}。',
    '親戚のおばさんが、{you}のこと「応援し{teru}」って言ってた{yo}。',
  ],
  grand: [
    '{you}、ちゃんと食べ{teru}かい？{me}は毎日、{you}の元気をお祈りし{teru}{yo}。',
    '{me}ね、近ごろ畑仕事が楽しくて。{you}に食べさせたい野菜が、いっぱいある{yo}。',
    'テレビをつけるたびに、{you}が出てないか探してしまう{yo}。',
    'ご近所のみんなに、{you}の話ばっかりし{teru}{yo}。自慢の孫{da}。',
    '老人会の旅行で、温泉に行ってきた{yo}。{you}も、たまにはゆっくりして{ne}。',
    '{me}、この機械の使い方をおぼえた{yo}。こうして、{you}に連絡できる{nda}。',
  ],
  older: [
    '{you}、元気にし{teru}？{me}は相変わらず、仕事でバタバタ{da}。',
    { t: '実家に寄ったら、{you}の話でもちきり{dap}った{yo}。たまには連絡してあげて{ne}。', cond: hasParents },
    '{me}、最近料理にハマっ{teru}{nda}。今度帰ってきたら、ごちそうする{yo}。',
    '仕事帰りに、{you}が好き{dap}ったお店の前を通った{yo}。まだやってて、なつかしかった。',
    '{you}のこと、職場で話したら、みんな「応援する」って言ってた{yo}。',
    'この前、昔のアルバムを見つけた{yo}。{you}、ちっちゃくて{totemo}かわいかった。',
  ],
  younger: [
    '{you}、元気？こっちは毎日バタバタ{da}〜。',
    '友だちに{you}のこと自慢しちゃった！サインもらってきてって頼まれた{yo}。',
    '{you}の部屋で昼寝するのが、最近のお気に入り{da}。ないしょにしといて{ne}。',
    '{you}のお仕事の話、聞くのが毎回楽しみ{da}！',
    '{you}の好き{dap}ったお菓子を見つけて、つい買っちゃった。今度送る{kara}{ne}！',
    '{me}もいつか東京に遊びに行きたい{nda}！そのときは案内して{ne}。',
  ],
};
// spoken of members who passed away ({dead}: how the player calls them)
const MEMORIAL = [
  '{dead}の好き{dap}ったお菓子を仏壇にそなえて、{you}のことも報告しておいた{yo}。',
  'きっと{dead}も、どこかで{you}のこと、見守っ{teru}{yo}。',
  '{dead}が今の{you}を見たら、{totemo}よろこんだはず{dap}。',
];
const WORRY = {
  hunger: {
    parent: '{you}、ちゃんとごはん食べ{teru}？おなかすかせてないか、{me}心配{da}。',
    grand: '{you}、ちゃんと食べ{teru}かい？おなかがすくと、元気も出ない{yo}。',
    older: '{you}、ちゃんと食べ{teru}？忙しくても、ごはんだけは抜いたら{dameyo}。',
    younger: '{you}、ちゃんとごはん食べ{teru}？おなかすいたら、元気出ない{yo}〜。',
  },
  stress: {
    parent: '{you}、無理しすぎてない？つらいときは、休むのも仕事のうち{da}。',
    grand: 'がんばりすぎは体に毒{da}。たまには、ゆっくり休みなさい{ne}。',
    older: '{you}、声が疲れ{teru}気がする。無理だけは{dameyo}。',
    younger: '{you}、がんばりすぎてない？たまには休んで{ne}。',
  },
  debt: {
    parent: 'お家賃、だいじょうぶ？困ったときは、遠慮しないで言って{ne}。',
    grand: '困ったときは、遠慮しないで{me}に言って{ne}。{you}の味方{dap}{kara}。',
    older: 'お金、ちゃんと回っ{teru}？困ったら言って{ne}。少しなら貸せる{kara}。',
    younger: 'お金、だいじょうぶ？{me}のおこづかい、少しなら送れる{yo}！',
  },
};
const CHEER = {
  rank: {
    parent: '「{rank}」になったって聞いた{yo}！{me}、{totemo}うれしい。体に気をつけて{ne}。',
    grand: '「{rank}」になったって聞いた{yo}。{me}、ご近所じゅうに話して回った{yo}。',
    older: '「{rank}」だって？すごい{yo}。{me}も鼻が高い。',
    younger: '「{rank}」になったの！？すごい！友だちみんなに自慢した{yo}！',
  },
  agency: {
    parent: '{agency}に入ったって聞いた{yo}！おめでとう。これからが本番{dane}。',
    grand: '{agency}さんに入ったって{ne}。立派になって…{me}、うれしい{yo}。',
    older: '{agency}所属だって？おめでとう。これからが本番{dane}。',
    younger: '{agency}って、テレビでよく聞くとこ{deshou}！？すごい！',
  },
  regular: {
    parent: '『{show}』のレギュラーが決まったって聞いた{yo}！毎週楽しみにし{teru}{kara}{ne}。',
    grand: '『{show}』に毎週出るって聞いた{yo}。{me}、毎週楽しみにする{yo}。',
    older: '『{show}』のレギュラー、おめでとう。毎週チェックする{kara}。',
    younger: '『{show}』のレギュラー！？すごすぎ！毎週楽しみにし{teru}{ne}！',
  },
  kanmuri: {
    parent: '自分の名前の番組なんて、夢みたい{da}…。{me}、何回でも見る{yo}。',
    grand: '{you}の名前がついた番組ができるなんて…。長生きして、{honma}によかった。',
    older: '冠番組！？{you}、{honma}にすごい{yo}。{me}、泣きそう{da}。',
    younger: '{you}の番組！？友だちに宣伝しまくる{yo}！',
  },
};
const BIRTHDAY = {
  parent: '{you}、{age}歳のお誕生日おめでとう！生まれてきてくれて、{honma}にありがとう。',
  grand: '{age}歳のお誕生日、おめでとう。{you}が元気でいてくれるのが、{me}のいちばんのしあわせ{da}。',
  older: '{you}、{age}歳おめでとう！いい一年にして{ne}。',
  younger: '{you}、お誕生日おめでとう〜！{age}歳の{you}も、応援し{teru}{yo}！',
};
// A birthday that passed while the player was held / inside (the justice core skips the morning hooks
// there and records it in jus().flags.insideBirthday): a belated wish on the first morning out.
const BIRTHDAY_LATE = {
  parent: '{you}、遅くなったけど、{age}歳のお誕生日おめでとう。\n中で迎えた誕生日、さびしかった{deshou}。…生まれてきてくれて、{honma}にありがとう。',
  grand: '{you}、遅れてしまったけど、{age}歳おめでとう。\n{me}は、{you}が元気で帰ってきてくれたら、それでいい{nda}。',
  older: '{you}、遅くなったけど、{age}歳おめでとう。\n中で誕生日を迎えたんだ{ne}。…これからの一年、ちゃんとやり直そう{ne}。',
  younger: '{you}、遅くなっちゃったけど、{age}歳おめでとう！\n{me}、ずっと待って{teru}{yo}。',
};
const BIRTHDAY_LATE_GIFT = '遅くなったけど、誕生日の{gift}を送った{yo}。';
const BIRTHDAY_GIFT = 'お誕生日おめでとう！ささやかだけど、{gift}を送った{yo}。';
const PACKAGE = {
  parent: ['{gift}を送った{yo}。ちゃんと食べて、元気でいて{ne}。', '{you}、ちゃんと食べ{teru}？{gift}と、少しだけど、おこづかいも入れておいた{yo}。'],
  grand: ['{gift}を送った{yo}。{you}の好きな味{dap}{kara}{ne}。', '{gift}と、ないしょのおこづかいを入れておいた{yo}。体を大事に{ne}。'],
  older: ['{gift}、まとめて送っといた{yo}。ちゃんと食べて{ne}。', '{gift}と、ちょっとだけ助っ人代を入れといた{yo}。ちゃんと食べて{ne}。'],
  younger: ['{me}からも{gift}を送った{yo}！食べて元気出して{ne}！', '{gift}と、{me}のおこづかいから少し入れた{yo}！がんばって{ne}！'],
};
const SAVINGS = '{you}が送ってくれたお金、手をつけずにとっておいた{nda}。今こそ使って{ne}。';
const REPLY = {
  parent: 'お金、届いた{yo}。こんなこと、しなくていいのに…。でも、ありがとう{ne}。大事に使わせてもらう{yo}。',
  grand: '{you}からの仕送り、ありがたくて涙が出た{yo}。{honma}に立派になって…。',
  older: '{you}から仕送りをもらう日が来るとは{ne}。ありがとう、大事に使う{yo}。',
  younger: 'えっ、いいの！？ありがとう！大事に使う{yo}！{you}、かっこいい！',
};
const REPLY_SAVED = '…実はね、{you}が送ってくれたお金、ほとんど貯金し{teru}{nda}。いつか{you}が困ったときのために。';
const CALL_HELLO = {
  parent: ['もしもし、{you}？電話くれるなんて、うれしい{yo}。', 'また電話くれた{no}？声が聞けて、うれしい{yo}。'],
  grand: ['もしもし…{you}かい？声が聞けて、うれしい{yo}。', 'また電話くれた{no}かい？うれしい{ne}。'],
  older: ['おー、{you}。{doshita}？何かあった？', 'また電話？さては、さびしいんだな？'],
  younger: ['もしもし{you}？{doshita}〜？', 'また電話？{you}、ひまなの〜？'],
};
const CALL_TALK = {
  parent: 'お仕事、どう？{you}のペースでがんばって{ne}。',
  grand: '{you}の声を聞くと、{me}まで元気になる{yo}。',
  older: '{you}、ちゃんと休め{teru}？たまには息抜きもして{ne}。',
  younger: '{you}の話、もっと聞かせて{ne}！',
};
const CALL_BYE = {
  parent: '体に気をつけて{ne}。いつでも電話して{ne}。',
  grand: 'またいつでも電話しておいで。待っ{teru}{yo}。',
  older: 'じゃあ、また。応援し{teru}{kara}{ne}。',
  younger: 'またね〜！今度帰ってくるとき、おみやげよろしく{ne}！',
};
const GREET = {
  parent: ['{you}、ゆっくりしていって{ne}。', '{you}、{doshita}？おなかすいてない？'],
  grand: ['{you}、こっちにおいで。顔をよく見せておくれ。', '{you}がいると、家が明るい{ne}。'],
  older: ['{you}、{doshita}？', 'お、{you}。ちょっと話そうか。'],
  younger: ['{you}〜！遊ぼ〜！', '{you}、{doshita}〜？'],
};
// [far away, near Tokyo, a second speaker of the same role]
const WELCOME = {
  parent: ['おかえり、{you}！遠いところ、{yoku}帰ってきた{ne}。', 'おかえり、{you}！ゆっくりしていって{ne}。', '{you}、おかえり。元気そうで、安心した{yo}。'],
  grand: ['{yoku}帰ってきた{ne}。顔をよく見せておくれ。', '{yoku}帰ってきた{ne}。顔をよく見せておくれ。', 'まあまあ、{you}。立派になって…。'],
  older: ['おかえり、{you}。ちょっと見ないうちに、大人っぽくなった{ne}。', 'おかえり、{you}。ちょっと見ないうちに、大人っぽくなった{ne}。', 'お、{you}。おかえり。'],
  younger: ['{you}、おかえり〜！おみやげは？', '{you}、おかえり〜！おみやげは？', '{you}、おかえり〜！待って{teru}{yo}〜！'],
};
const MEMORY = {
  parent: '{you}が小さいころは、毎日いっしょに公園へ行った{ne}。おぼえ{teru}？',
  grand: '{you}が小さいころ、{me}のひざの上で、よく歌をうたってくれた{yo}。',
  older: '子どものころ、{you}と同じおやつを取り合って、よくケンカした{ne}。',
  younger: '{you}が家にいたころ、よく宿題を見てくれた{ne}。…ありがとう。',
};
const MEAL = '{you}の好きなおかず、いっぱい作った{yo}。たくさん食べて{ne}。';
const BENTO = 'これ、帰りの電車で食べて{ne}。{gift}も入れておいた{yo}。';

// Heart events at ♥3 (the first call or visit) and ♥4 (親友, aff 85).
const EVENTS = {
  parent: {
    3: ['{you}、東京の暮らしはどう？', '{you}が「芸能界に行く」って言ったとき、\n{me}、ほんとは少し心配{dap}った{nda}。', 'でも、決めたことは最後までやる子{dap}{kara}。\n…信じ{teru}{yo}。'],
    4: ['{you}のお仕事の話を聞くたびに、\nノートに書きとめ{teru}{nda}。もう三冊目{da}。', '{you}は、{me}たちの自慢{dap}。\nいつまでも、応援し{teru}{kara}{ne}。', '…これ、お守り。{you}を守ってくれるように。'],
  },
  grand: {
    3: ['{you}、ちゃんと眠れ{teru}かい？', '{you}は小さいころ、歌ったり踊ったりして、\nみんなを笑わせ{teru}子{dap}った。', 'あのころから、人を元気にする子{dap}った{ne}。'],
    4: ['{me}はね、{you}のことが、いちばんの自慢{dap}。', '…これを持っていきなさい。\n{me}が、ずっと大事にしてきたお守り{da}。'],
  },
  older: {
    3: ['{you}が東京に行くって言ったとき、\n正直、{me}はうらやましかった{nda}。', '自分のやりたいことに、まっすぐで{ne}。', '…がんばって{ne}。{me}は、ずっと{you}の味方{dap}{kara}。'],
    4: ['子どものころは、{you}とよくケンカした{ne}。', '…でも今は、いちばん自慢の{sib}{dap}。\n職場でも、言いふらし{teru}{yo}。', 'これ、{me}からのお守り。…照れるから、何も言わないで{ne}。'],
  },
  younger: {
    3: ['{you}がいないと、家がちょっと静か{da}。', '…べつに、さびしいとかじゃない{kara}{ne}！', 'でも、{you}のお仕事の話を聞くと、\nなんか元気出る{nda}。'],
    4: ['あのね、{me}にも夢ができた{nda}。', '{you}みたいに、好きなことで、\nだれかを元気にしたい{nda}。', '…これ、お守り。いつか{you}に追いつく{kara}！'],
  },
};
// The 仏壇: a gentle memory for each relation (narration).
const MEMORIES = {
  father: '大きな手で、肩車をしてくれたっけ…',
  mother: 'お弁当の卵焼きの味を、今でも覚えている…',
  grandfather: '縁側で、将棋を教えてくれたっけ…',
  grandmother: 'こっそり、お菓子をくれたっけ…',
  brother_older: '自転車の乗り方を、教えてくれたっけ…',
  sister_older: '宿題を、いつも見てくれたっけ…',
  brother_younger: 'いつも、うしろをついてきたっけ…',
  sister_younger: '小さな手で、ぎゅっと手をつないできたっけ…',
};
// The neighbour who keeps the house when nobody lives there any more.
const NEIGHBOR = {
  welcome: 'あら、{you}！おかえりなさい。\nお家は、ときどき風を通しておいた{yo}。',
  flowers: '仏壇のお花も、替えておいた{kara}{ne}。',
  talk: ['ゆっくりしていって{ne}。\nご近所はみんな、{you}を応援し{teru}{yo}。', '{you}が小さいころ、\nこのへんを元気に走り回って{teru}のを思い出す{yo}。'],
  meal: 'おすそわけ{da}。煮物、たくさん作ったから。\n遠慮しないで食べて{ne}。',
};

// ---------------------------------------------------------------- items
for (const R0 of Object.values(REGIONS)) {
  const gf = R0.gift;
  const id = 'furusato_' + gf.key;
  if (gf.key === 'tea') {
    registerItem(id, {
      name: 'ふるさとの' + gf.name, price: 0,
      desc: '実家から届いたお茶っ葉。\nいれて飲むと、ほっとする（ストレス -8）。',
      use: async (g) => {
        if (!g.takeItem(id)) return;
        const first = g.flag('fam_teaDay') !== g.state.day;
        g.setFlag('fam_teaDay', g.state.day);
        const d = -g.addNeed('stress', first ? -8 : -2);
        audio.sfx('good');
        await g.say(`ふるさとのお茶をいれて飲んだ。\nなつかしい香り…。${d > 0 ? `（ストレス -${d}）` : ''}`);
      },
    });
  } else {
    registerItem(id, {
      name: 'ふるさとの' + gf.name, price: 0, heal: gf.heal, fill: Math.round(gf.heal * 1.8),
      desc: `実家から届いた${gf.name}。ふるさとの味がする。\n体力が${gf.heal}回復する。`,
    });
  }
}
registerItem('family_bento', { name: '実家のお弁当', price: 0, heal: 40, fill: 55, desc: '家族が持たせてくれた、手作りのお弁当。\n体力が40回復する。' });
registerItem('family_omamori', { name: 'ふるさとのお守り', price: 0, key: true, desc: '家族がくれたお守り。\n持っていると、なんだか心強い。' });
const giftItem = (M) => 'furusato_' + M.giftKey;

// ---------------------------------------------------------------- members
const REGISTERED = new Set();
let cache = { state: null, key: '', members: [], late: [] };
const youOf = (prof, rel) => {
  const given = prof.givenName || 'ドット';
  const role = ROLE[rel];
  if (role === 'younger') return prof.gender === 'm' ? 'お兄ちゃん' : prof.gender === 'f' ? 'お姉ちゃん' : given + 'ちゃん';
  if (role === 'grand') return given + 'ちゃん';
  return given;
};
// How the player calls a member (also how family members speak of each other).
const callOf = (m, prof) => {
  const rel = RELATIONS[m.rel];
  if (!rel) return '家族';
  if (!rel.older) return givenOf(m.name, prof.familyName) || rel.name;
  return rel.call;
};

function buildMember(m, prof, st, i, used) {
  const rel = RELATIONS[m.rel] ? m.rel : 'mother';
  let pid = String(m.id || ('fam_' + rel));
  if (!pid.startsWith('fam_')) pid = 'fam_' + pid;
  pid = pid.replace(/[^a-zA-Z0-9_]/g, '_');
  let k = 2;
  const base = pid;
  while (used.has(pid)) pid = base + '_' + k++;
  used.add(pid);
  const pref = prefecture(prof.hometown);
  const region = regionOf(prof.hometown) || REGIONS.kanto;
  const dia = DIA[region.dialect] ? region.dialect : 'standard';
  const given = givenOf(m.name, prof.familyName) || RELATIONS[rel].name;
  let me = ME[rel];
  if (dia === 'kansai' && (rel === 'sister_older' || rel === 'sister_younger')) me = 'うち';
  const look = familyLook({ ...m, rel }, st.look || {});
  // a second brother / sister of the same kind gets other clothes
  const nth = (used.rels[rel] = (used.rels[rel] || 0) + 1);
  if (nth > 1) { look.top = shade(look.top || '#5a6a8a', -0.3); look.bottom = shade(look.bottom || '#3a3a4a', 0.2); }
  return {
    pid, rel, role: ROLE[rel], idx: i, alive: m.alive !== false, cause: m.cause || null,
    fullName: m.name || '', given, call: callOf({ ...m, rel }, prof),
    label: `${RELATIONS[rel].name}（${given}）`,
    dia, pref: pref.name, prefId: prof.hometown, near: !!pref.near,
    gift: region.gift.name, giftKey: region.gift.key,
    you: youOf(prof, rel), me,
    sib: prof.gender === 'm' ? '弟' : prof.gender === 'f' ? '妹' : 'きょうだい',
    look,
  };
}

// Registers the living family as people (again whenever the profile or the state object
// changes: つづきから / はじめから). Returns the living members; .late on the result is the list
// of members who passed away.
export function ensureFamily(g) {
  const st = g && g.state;
  if (!st) return [];
  const prof = profileOf(st);
  const fam = Array.isArray(prof.family) ? prof.family : [];
  const key = JSON.stringify([fam, prof.hometown, prof.givenName, prof.familyName, prof.gender, st.look && st.look.hairColor, st.look && st.look.skin]);
  if (cache.state === st && cache.key === key) return cache.members;
  const used = new Set();
  used.rels = {};
  const all = fam.filter((m) => m && typeof m === 'object').map((m, i) => buildMember(m, prof, st, i, used));
  const members = all.filter((M) => M.alive);
  const late = all.filter((M) => !M.alive);
  const parents = members.some((M) => M.role === 'parent');
  for (const M of all) { M.late = late; M.parents = parents; M.members = members; }
  // forget members of another profile
  for (const id of REGISTERED) if (!members.some((M) => M.pid === id)) { delete PEOPLE[id]; REGISTERED.delete(id); }
  for (const M of members) {
    registerPerson(M.pid, personDef(M));
    REGISTERED.add(M.pid);
    if (!st.people) st.people = {};
    let p = st.people[M.pid];
    if (!p) p = st.people[M.pid] = { aff: START_AFF, met: st.day || 1, talkDay: 0, giftDay: 0, hangDay: 0, seen: {}, contact: true, family: true };
    p.contact = true;
    p.family = true;
    if (!p.seen) p.seen = {};
  }
  members.late = late;
  cache = { state: st, key, members, late };
  return members;
}
export const familyMembers = (g) => ensureFamily(g);
export const lateMembers = (g) => { ensureFamily(g); return cache.late || []; };
const memberOf = (g, pid) => ensureFamily(g).find((M) => M.pid === pid) || null;
const famState = (g) => {
  const fl = g.state.flags || (g.state.flags = {});
  if (!fl.fam || typeof fl.fam !== 'object') fl.fam = {};
  const f = fl.fam;
  if (!f.next || typeof f.next !== 'object') f.next = {};
  if (!f.regs || typeof f.regs !== 'object') f.regs = {};
  return f;
};
// a member to speak first: parents, then grandparents, then the others
const ROLE_ORDER = { parent: 0, grand: 1, older: 2, younger: 3 };
const byRole = (list) => list.slice().sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.idx - b.idx);
function lateLine(M) {
  if (!M.late.length) return null;
  const d = pick(M.late);
  return fill(pick(MEMORIAL), M, { dead: d.call });
}

// The heart event of member M at a level: lines + the お守り at ♥4.
function eventLines(M, level) {
  return EVENTS[M.role][level].map((s) => fill(s, M));
}
function personDef(M) {
  const role = M.role;
  const loves = { parent: ['hanataba', 'okashi'], grand: ['okashi', 'tea'], older: ['cake', 'cd'], younger: ['plushie', 'manga'] }[role];
  const likes = { parent: ['tea', 'cake', 'book'], grand: ['hanataba', 'cake', 'book'], older: ['manga', 'book', 'tea', 'okashi'], younger: ['cake', 'accessory', 'cd'] }[role];
  const f = (s) => fill(s, M);
  const ev = (level) => ({
    level,
    run: async (g, def, npc) => {
      await g.say(eventLines(M, level), { name: def.name, look: (npc && npc.look) || def.look });
      await afterEvent(g, M, level, false);
    },
  });
  return {
    name: M.label, short: M.call, look: M.look, kind: 'family', family: true, rel: M.rel, role,
    where: `ふるさと（${M.pref}）`,
    profile: `${M.call}。${M.pref}の実家で暮らしている。${M.near ? 'ときどき会える。' : ''}`,
    likes, loves, dislikes: [],
    dialect: M.dia === 'kansai' ? 'kansai' : M.dia,
    events: [ev(3), ev(4)],
    messages: [], invites: [],
    near: M.near,
    noInvite: true,
    callLabel: '電話する',
    onCall: (g, id) => familyCall(g, id),
    greet: () => f(pick(GREET[role])),
    chats: [(g) => f(talkLine(g, M))],
    chat: (g) => [f(pick([MEMORY[role], CALL_TALK[role], ...pool(NEWS[role], M)]))],
    giftLines: {
      love: [f('{item}！？{you}、覚えててくれた{no}？'), f('{honma}にうれしい{yo}。ありがとう{ne}。')],
      like: [f('{item}、ありがとう{ne}。大事にする{yo}。')],
      neutral: [f('ありがとう{ne}。{you}がくれるものなら、なんでもうれしい{yo}。')],
      dislike: [f('ありがとう{ne}。{you}がくれるものなら、なんでもうれしい{yo}。')],
      repeat: [f('また持ってきてくれた{no}？ありがとう{ne}。')],
      [giftItem(M)]: [f('{item}って…これ、うちから送ったやつ{deshou}！'), '（笑われてしまった）'],
    },
    again: f('ほかに何かある？'),
    giftDone: f('今日はもう、もらった{yo}。気持ちだけで十分{da}。'),
    hangDone: f('今日はもう、いっしょに出かけた{deshou}。また今度{ne}。'),
    thanks: f('今日はありがとう。楽しかった{yo}。また会おう{ne}。'),
    declined: f('そっか、忙しい{no}{ne}。また今度{ne}。'),
    hangBye: f('また出かけよう{ne}。'),
    inviteYes: f('いい{ne}、行こう！'),
    callYes: [f('もしもし？…うん、行こう！')],
    hangout: { default: [f('{you}と出かけるなんて、久しぶり{dane}。'), '（家族の話、昔の話。笑いがたえなかった）'] },
  };
}
// One personal line in person: worry first, then news / memories.
function talkLine(g, M) {
  const w = worryKind(g);
  if (w && Math.random() < 0.6) return WORRY[w][M.role];
  if (M.late.length && Math.random() < 0.25) return pick(MEMORIAL).replaceAll('{dead}', pick(M.late).call);
  return pick(pool(NEWS[M.role], M));
}
function worryKind(g) {
  const st = g.state;
  if (st.rent && st.rent.debt > 0) return 'debt';
  if (st.life.hunger < 20) return 'hunger';
  if (st.life.stress >= 70) return 'stress';
  return null;
}
async function afterEvent(g, M, level, byPhone) {
  if (level === 4 && !g.hasItem('family_omamori')) {
    g.giveItem('family_omamori', 1, true);
    await g.say(byPhone ? '（あとで、小さなお守りが送られてきた）' : '（小さなお守りを、そっと手わたされた）');
    g.notify('ふるさとのお守りを もらった', { color: COLORS.pink });
  }
}

// ---------------------------------------------------------------- messages
function famMessage(g, M, textStr, extra = {}) {
  const def = PEOPLE[M.pid];
  const st = g.state;
  const p = g.person(M.pid);
  if (p) { p.famMsg = st.day; p.msgDay = st.day; }
  famState(g).last = st.day;
  return g.message({ from: def ? def.name : M.label, person: M.pid, kind: 'chat', look: M.look, ...extra, text: flat(g.fmt(textStr)) });
}
// broke, behind on rent, or hungry with little money: the family sends more often (and money)
const needy = (g) => g.state.money < 1500 || (g.state.rent && g.state.rent.debt > 0) || (g.state.life.hunger < 20 && g.state.money < 3000);

// A care package from M (or the first parent / grandparent). opts: { money, items, text, note }
export function sendPackage(g, opts = {}) {
  const members = ensureFamily(g);
  if (!members.length) return null;
  const M = opts.member || byRole(members)[0];
  const st = g.state;
  const f = famState(g);
  const need = opts.need ?? needy(g);
  const item = giftItem(M);
  const n = opts.items ?? (st.life.hunger < 20 ? 3 : 2);
  let money = opts.money;
  let saved = false;
  if (money == null) {
    money = 0;
    if (need) {
      if ((f.saved || 0) >= 20000 && (M.role === 'parent' || M.role === 'grand') && st.day - (f.savedBack || -99) >= 14) {
        money = Math.min(20000, Math.floor(f.saved / 2 / 1000) * 1000);
        f.saved -= money;
        f.savedBack = st.day;
        saved = true;
      } else money = M.role === 'parent' || M.role === 'grand' ? 5000 : 2000;
    } else if (st.fame < 1000 && Math.random() < 0.3) money = 3000;
  }
  if (ITEMS[item]) g.giveItem(item, n, true);
  if (money) g.addMoney(money, true);
  f.pkg = st.day;
  const what = `${ITEMS[item] ? ITEMS[item].name : M.gift}×${n}${money ? '・' + fmtMoney(money) : ''}`;
  let body = opts.text || fill(PACKAGE[M.role][money ? 1 : 0], M);
  if (saved) body = fill(SAVINGS, M) + body;
  const m = famMessage(g, M, `${body}（仕送りが届いた：${what}）`);
  const notes = g.morningNotes || (g.morningNotes = []);
  if (opts.note !== false) notes.push(`（${M.call}から仕送りが届いた！\n${what}）`);
  return m;
}

// Send money home (the 家族 app). Returns { reply } or null (not enough money).
export function sendMoney(g, pid, amount) {
  const M = memberOf(g, pid);
  if (!M || !SEND_AFF[amount]) return null;
  const st = g.state;
  if (!g.spend(amount)) return null;
  audio.sfx('coin');
  const f = famState(g);
  const before = f.sent || 0;
  f.sent = before + amount;
  if (M.role === 'parent' || M.role === 'grand') f.saved = (f.saved || 0) + amount;
  const p = g.person(M.pid);
  const fresh7 = !(typeof p.sendDay === 'number' && st.day - p.sendDay < 7);
  p.sendDay = st.day;
  const da = g.addAff(M.pid, fresh7 ? SEND_AFF[amount] : 1, true);
  let ds = 0;
  if (f.sendStress !== st.day) { f.sendStress = st.day; ds = -g.addNeed('stress', -SEND_STRESS[amount]); }
  let reply = fill(REPLY[M.role], M);
  if (before < 100000 && f.sent >= 100000 && (M.role === 'parent' || M.role === 'grand')) reply += fill(REPLY_SAVED, M);
  famMessage(g, M, reply);
  g.notify(`${M.label}に ${fmtMoney(amount)} 送った${da ? `　♥+${da}` : ''}${ds ? `　ストレス -${ds}` : ''}`, { color: COLORS.pink, life: 200 });
  return { reply, aff: da, stress: ds };
}

// ---------------------------------------------------------------- the morning
// people.js's friend texts skip the family (this module writes their messages): runs first.
MORNING_HOOKS.unshift((g) => {
  const st = g.state;
  if (!st || !st.people) return;
  for (const M of ensureFamily(g)) if (st.people[M.pid]) st.people[M.pid].msgDay = st.day;
});

onMorning((g) => {
  const st = g.state;
  if (!st || !st.phone) return;
  const members = ensureFamily(g);
  const f = famState(g);
  const day = st.day;
  const age = ageOf(st);
  const rank = rankIndex(st.fame);
  const regs = Object.keys(st.regulars || {}).filter((id) => REGULARS[id] && st.regulars[id] && !st.regulars[id].dropped && REGULARS[id].medium !== 'event');
  // first look at this save: remember where things stand (no messages about the past)
  if (typeof f.age !== 'number') f.age = age;
  if (typeof f.rank !== 'number') f.rank = rank;
  if (typeof f.agency !== 'string') f.agency = st.agency || '';
  if (!f.seeded) { f.seeded = true; for (const id of regs) f.regs[id] = true; if (typeof f.pkg !== 'number') f.pkg = day - 6; }
  const atHome = !!(g.map && g.map.placeId === 'jikka');
  // what happened since yesterday
  const events = [];
  if (age > f.age) { f.age = age; events.push({ kind: 'birthday', age }); }
  if (regs.includes('career_kanmuri') && !f.regs.career_kanmuri) events.push({ kind: 'kanmuri', show: REGULARS.career_kanmuri.title });
  for (const id of regs) if (!f.regs[id] && id !== 'career_kanmuri') events.push({ kind: 'regular', show: REGULARS[id].title });
  for (const id of regs) f.regs[id] = true;
  if (rank > f.rank) { f.rank = rank; events.push({ kind: 'rank', rank: RANKS[rank][1] }); }
  const ag = st.agency || '';
  if (ag !== f.agency) { f.agency = ag; if (ag) events.push({ kind: 'agency' }); }
  if (!members.length) return;
  if (atHome) {
    (g.morningNotes || (g.morningNotes = [])).push('（実家の朝だ。台所から、いいにおいがする）');
    return;
  }
  const order = byRole(members);
  // birthday: main.js may already have sent the wish (flag + a message with `family`)
  const bd = events.find((e) => e.kind === 'birthday');
  if (bd) {
    // passed inside (custody / a term): a belated wish, never "happy birthday" as if it were today
    const jf = st.justice && st.justice.flags;
    const late = !!(jf && Number(jf.insideBirthday) === bd.age);
    if (jf && jf.insideBirthday != null) delete jf.insideBirthday;
    const sentBy = st.flags[`birthday_${bd.age}`] ? (st.phone.inbox.find((m) => m && m.family && m.day === day) || null) : null;
    let first = null;
    if (late) {
      first = order[0];
      famMessage(g, first, fill(BIRTHDAY_LATE[first.role], first, { age: String(bd.age) }));
      const other = order.find((M) => M !== first);
      if (other) sendPackage(g, { member: other, text: fill(BIRTHDAY_LATE_GIFT, other), money: 0, items: 2, need: false });
      return;
    }
    if (sentBy) {
      const fid = String(sentBy.family);
      first = members.find((M) => M.pid === fid || M.pid === 'fam_' + fid) || order[0];
    } else {
      first = order[0];
      famMessage(g, first, fill(BIRTHDAY[first.role], first, { age: String(bd.age) }));
    }
    const other = order.find((M) => M !== first);
    const giver = other || first;
    if (other) sendPackage(g, { member: other, text: fill(BIRTHDAY_GIFT, other), money: other.role === 'parent' || other.role === 'grand' ? 5000 : 0, items: 2, need: false });
    else {
      // the only member already spoke: the present comes without a second message
      const item = giftItem(giver);
      if (ITEMS[item]) g.giveItem(item, 2, true);
      f.pkg = day;
      (g.morningNotes || (g.morningNotes = [])).push(`（${giver.call}から、誕生日のプレゼントが届いた！\n${ITEMS[item] ? ITEMS[item].name : giver.gift}×2）`);
    }
    return;
  }
  // a cheer for the best news of the day
  const best = ['kanmuri', 'regular', 'rank', 'agency'].map((k) => events.find((e) => e.kind === k)).find(Boolean);
  if (best) {
    const M = pick(order.slice(0, 2));
    famMessage(g, M, fill(CHEER[best.kind][M.role], M, { rank: best.rank || '', show: best.show || '' }));
    return;
  }
  // a care package (sooner when broke or hungry)
  const need = needy(g);
  const since = day - (typeof f.pkg === 'number' ? f.pkg : day);
  const quiet = day - (f.last || -99) >= QUIET_GAP;
  if (quiet && since >= (need ? PKG_GAP_NEED : PKG_GAP) && Math.random() < (need ? 0.7 : 0.4)) {
    const senders = order.filter((M) => M.role === 'parent' || M.role === 'grand');
    const M = senders.length && Math.random() < 0.8 ? pick(senders) : pick(order);
    sendPackage(g, { member: M, need });
    return;
  }
  if (f.last === day) return;
  // worry (every few days at most)
  const w = worryKind(g);
  if (w && quiet && day - (f.worry || -99) >= 4 && Math.random() < 0.4) {
    f.worry = day;
    const M = pick(order.slice(0, 2));
    famMessage(g, M, fill(WORRY[w][M.role], M));
    return;
  }
  // everyday news: each member about once a week, never two days in a row
  if (day - (f.last || -99) < NEWS_GAP) return;
  const due = members.filter((M) => (f.next[M.pid] ?? day - 1) <= day);
  if (!due.length || Math.random() >= 0.55) return;
  const M = pick(due);
  f.next[M.pid] = day + 6 + Math.floor(Math.random() * 5);
  const p = g.person(M.pid);
  if (M.near && p && p.hangDay !== day && Math.random() < 0.35 && Object.keys(HANGOUTS).length) {
    const spot = HANGOUTS.ramen ? 'ramen' : Object.keys(HANGOUTS)[0];
    famMessage(g, M, fill('近くまで行く用事がある{nda}。{you}、今日いっしょにごはんでもどう？', M), { kind: 'invite', spot });
    return;
  }
  const late = M.late.length && Math.random() < 0.25 ? lateLine(M) : null;
  famMessage(g, M, late || fresh(g, M, NEWS[M.role]));
});

// ---------------------------------------------------------------- the phone call
function disc(c, cx, cy, r, col) { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); }
function callScreen(g, def, lines) {
  return {
    noHeader: true, underStatus: true, bg: '#1b1f3a', hint: 'A:つぎへ', cancel: true, line: 0, shown: 0,
    lines: lines.map((l) => g.fmt(String(l))),
    enter() { audio.sfx('chime'); },
    update(ph, inp) {
      if (this.t < 40) { if (this.t === 26) audio.sfx('ok'); return; }
      const total = Array.from(this.lines[this.line] || '').length;
      if (this.shown < total) {
        const b = Math.floor(this.shown);
        this.shown = Math.min(total, this.shown + 0.8);
        if (Math.floor(this.shown) !== b && b % 3 === 0) audio.sfx('talk');
        if (inp.pressed('a') || inp.pressed('b')) this.shown = total;
        return;
      }
      if (inp.pressed('a') || inp.pressed('b')) {
        audio.sfx('cursor');
        if (this.line < this.lines.length - 1) { this.line++; this.shown = 0; } else ph.back(true);
      }
    },
    draw(c, ph, a) {
      const cx = a.x + a.w / 2;
      R(c, a.x, SCREEN.y, a.w, SCREEN.h, '#1b1f3a');
      // a little house behind the face: calling home
      for (let i = 0; i < 3; i++) {
        const r = 40 + ((this.t * 0.6 + i * 14) % 42);
        if (this.t < 40) { c.globalAlpha = 0.3 * (1 - (r - 40) / 42); disc(c, cx, SCREEN.y + 74, r, '#d0703a'); c.globalAlpha = 1; }
      }
      disc(c, cx, SCREEN.y + 74, 39, '#0c0e1e');
      disc(c, cx, SCREEN.y + 74, 37, '#8a4a2a');
      disc(c, cx, SCREEN.y + 74, 35, '#f6d8b0');
      drawFaceHD(c, def.look || {}, cx - 32, SCREEN.y + 52, 2);
      text(c, def.name, cx, SCREEN.y + 120, { size: 16, align: 'center', color: '#fff', shadow: '#000' });
      const dots = '.'.repeat(1 + (Math.floor(this.t / 12) % 3));
      const sec = Math.max(0, Math.floor((this.t - 40) / 60));
      phoneText(c, this.t < 40 ? '実家に発信中' + dots : `通話中 0:${String(sec).padStart(2, '0')}`, cx, SCREEN.y + 142, 12, '#e8c49a', 'center');
      if (this.t >= 40) {
        const all = this.lines[this.line] || '';
        const ls = wrap(c, all, a.w - 40, 12);
        const bh = Math.max(1, ls.length) * 15 + 12;
        const by = SCREEN.y + 166;
        box(c, a.x + 12, by, a.w - 24, bh, 6, '#fff8ec', '#0c0e1e');
        let rem = Math.floor(this.shown);
        ls.forEach((l, i) => {
          const ch = Array.from(l);
          phoneText(c, ch.slice(0, Math.max(0, rem)).join(''), a.x + 20, by + 6 + i * 15, 12, PC.text);
          rem -= ch.length;
        });
        if (this.line < this.lines.length - 1) phoneText(c, '▼', a.x + a.w - 26, by + bh - 14, 12, PC.dim);
      }
      const hy = SCREEN.y + SCREEN.h - 16 - 26;
      disc(c, cx, hy, 13, '#5a0a14');
      disc(c, cx, hy, 12, '#e8484f');
      R(c, cx - 7, hy - 1, 14, 3, '#ffffff');
    },
  };
}

// The lines (and effects) of a call to member pid. Effects apply before the screen, so a
// call counts even when the dialogue is skipped. Returns { lines, aff, stress, event }.
export function callPlan(g, pid) {
  const M = memberOf(g, pid);
  if (!M) return null;
  const st = g.state;
  const p = g.meet(M.pid);
  const f = famState(g);
  const again = p.callDay === st.day;
  const lines = [];
  let event = null;
  const ev = g.pendingHeartEvent(M.pid);
  if (ev && !again) {
    p.seen[ev.level] = true;
    event = ev.level;
    lines.push(fill(CALL_HELLO[M.role][0], M), ...eventLines(M, ev.level));
  } else {
    lines.push(fill(CALL_HELLO[M.role][again ? 1 : 0], M));
    if (!again) {
      const w = worryKind(g);
      if (w) lines.push(fill(WORRY[w][M.role], M));
      else if (M.late.length && Math.random() < 0.25) lines.push(lateLine(M));
      else lines.push(fresh(g, M, NEWS[M.role]));
    }
    lines.push(fill(CALL_TALK[M.role], M));
  }
  lines.push(fill(CALL_BYE[M.role], M));
  let aff = 0, stress = 0;
  if (!again) {
    p.callDay = st.day;
    aff = g.addAff(M.pid, CALL_AFF, true);
    if (f.callStress !== st.day) { f.callStress = st.day; stress = -g.addNeed('stress', -CALL_STRESS); }
  }
  return { M, lines: lines.filter(Boolean), aff, stress, event };
}
// Call a family member (def.onCall from phone.js, and the 家族 app).
export async function familyCall(g, pid) {
  const plan = callPlan(g, pid);
  if (!plan) return false;
  const def = PEOPLE[pid];
  await phoneView(g, callScreen(g, def, plan.lines));
  const bits = [plan.aff ? `♥+${plan.aff}` : '', plan.stress ? `ストレス -${plan.stress}` : ''].filter(Boolean);
  if (bits.length) g.notify(`${def.name}と話した　${bits.join('　')}`, { color: COLORS.pink, life: 180 });
  if (plan.event) await afterEvent(g, plan.M, plan.event, true);
  // family near Tokyo can meet up
  const p = g.person(pid);
  if (plan.M.near && p.hangDay !== g.state.day && Object.keys(HANGOUTS).length) {
    const k = await phoneConfirm(g, { title: def.name, color: '#d0703a', text: fill('「近いし、今日会えない？\nごはんでも行こう{yo}」', plan.M), choices: ['会いに行く', 'また今度'] });
    if (k === 0) {
      const spots = Object.values(HANGOUTS);
      const i = await phoneList(g, {
        title: 'どこで会う？', color: '#d0703a',
        items: spots.map((s) => ({ label: s.name, right: s.price ? fmtMoney(s.price) : '無料', disabled: g.state.money < s.price || g.state.stamina < (s.stamina ?? 5), why: g.state.money < s.price ? 'お金が足りない…' : '体力が足りない…' })),
      });
      if (i >= 0) return g.hangout(pid, spots[i].id);
    }
  }
  return true;
}

// ---------------------------------------------------------------- the 家族 app
function houseIcon(c, x, y) {
  R(c, x + 4, y + 11, 16, 10, '#fff6e8'); R(c, x + 4, y + 20, 16, 1, '#c9a07a');
  for (let i = 0; i < 9; i++) R(c, x + 12 - i, y + 3 + i, i * 2 + 1, 1, '#8a3a2a');
  R(c, x + 10, y + 15, 4, 6, '#8a5a33');
  R(c, x + 15, y + 13, 3, 3, '#5fb0e8');
  // heart over the roof
  R(c, x + 17, y + 2, 2, 2, '#ff5d8f'); R(c, x + 20, y + 2, 2, 2, '#ff5d8f'); R(c, x + 17, y + 4, 5, 1, '#ff5d8f'); R(c, x + 18, y + 5, 3, 1, '#ff5d8f'); R(c, x + 19, y + 6, 1, 1, '#ff5d8f');
}
async function memorialInfo(g, M) {
  const cause = M.cause && M.cause !== 'secret' && CAUSES[M.cause] ? `${CAUSES[M.cause].text}旅立った。` : '';
  await phoneInfo(g, {
    title: `${M.call}の思い出`, color: '#7a6a5a',
    text: `${M.call}（${M.fullName || M.given}）\n\n${MEMORIES[M.rel] || ''}\n${cause ? cause + '\n' : ''}\n実家の仏壇で、手を合わせることができる。`,
  });
}
async function tripInfo(g) {
  const prof = profileOf(g.state);
  const t = tripOf(prof.hometown);
  const f = famState(g);
  const full = !f.lastFull || g.state.day - f.lastFull >= FULL_VISIT_DAYS;
  const members = ensureFamily(g);
  await phoneInfo(g, {
    title: '帰省のこと', color: '#d0703a',
    text: `ふるさと：${prefecture(prof.hometown).name}\n東京駅のきっぷ売り場で「帰省する」。\n往復 ${fmtMoney(t.fare)}（${t.via}）\n\n${members.length ? '家族といっしょに、ごはん・ひと晩・思い出話。' : '実家は、おとなりさんが見てくれている。'}\n${full ? '今帰ると、心も体もすっかり元気になれそうだ。' : `次にゆっくりできるのは、${FULL_VISIT_DAYS - (g.state.day - f.lastFull)}日後くらい。`}`,
  });
}
async function sendFlow(g, M) {
  const i = await phoneList(g, {
    title: `${M.label}に送金`, color: '#d0703a', hint: 'A:送る　B:やめる',
    items: SEND_AMOUNTS.map((n) => ({ label: fmtMoney(n), sub: `♥+${SEND_AFF[n]}・ストレス -${SEND_STRESS[n]}（1日1回）`, disabled: g.state.money < n, why: 'お金が足りない…' })),
    describe: () => `所持金 ${fmtMoney(g.state.money)}。実家への仕送り。\n（♥が大きく上がるのは 7日に1回）`,
  });
  if (i < 0) return;
  const n = SEND_AMOUNTS[i];
  const k = await phoneConfirm(g, { title: '送金', color: '#d0703a', text: `${M.label}に ${fmtMoney(n)} 送る？`, choices: ['送る', 'やめる'] });
  if (k !== 0) return;
  const r = sendMoney(g, M.pid, n);
  if (!r) return;
  await phoneInfo(g, { title: `${M.label}から`, color: '#d0703a', text: g.fmt(r.reply) });
}
async function familyApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const members = ensureFamily(g);
    const late = cache.late || [];
    const rows = [];
    for (const M of byRole(members)) {
      const p = g.person(M.pid) || { aff: START_AFF };
      rows.push({ type: 'm', M, label: M.label, look: M.look, sub: `${HEARTS[heartIndex(p.aff)][1]}・${p.callDay === g.state.day ? '今日は電話した' : '電話・送金'}` });
    }
    for (const M of late) rows.push({ type: 'late', M, label: `${M.call}（思い出）`, look: M.look, sub: '実家の仏壇で お参りできる' });
    if (!members.length && !late.length) rows.push({ type: 'none', label: '家族の登録はない', sub: 'ふるさとの家は、おとなりさんが見ている', disabled: true, why: '（実家へは帰れる）' });
    for (const fr of FAMILY_ROWS) { try { const r = fr(g); if (r) rows.push({ type: 'ext', ...r }); } catch (e) { console.error(e); } } // [R12-L1]
    rows.push({ type: 'trip', label: '帰省のこと', sub: `${prefecture(profileOf(g.state).hometown).name}・往復 ${fmtMoney(tripOf(profileOf(g.state).hometown).fare)}` });
    const i = await phoneList(g, { title: '家族', color: '#d0703a', items: rows, hint: 'A:えらぶ　B:もどる' });
    if (i < 0) return;
    const row = rows[i];
    if (row.type === 'trip') { await tripInfo(g); continue; }
    if (row.type === 'ext') { try { await row.run(g); } catch (e) { console.error(e); } continue; } // [R12-L1]
    if (row.type === 'late') { await memorialInfo(g, row.M); continue; }
    if (row.type !== 'm') continue;
    const k = await phoneList(g, { title: row.M.label, color: '#d0703a', items: [{ label: '電話する', sub: '1日1回 ストレス -8・♥+2' }, { label: '送金する', sub: '¥5,000 / ¥10,000 / ¥30,000' }] });
    if (k === 0) await familyCall(g, row.M.pid);
    else if (k === 1) await sendFlow(g, row.M);
  }
}
registerPhoneApp('family', {
  name: '家族', color: '#d0703a', order: 25,
  icon: houseIcon,
  badge: (g) => { ensureFamily(g); return 0; },
  open: (g) => familyApp(g),
});

// ---------------------------------------------------------------- 帰省 (trips)
const FARES = { kanto: 3000, chubu: 5000, kansai: 6000, tohoku: 6000, chugoku: 8000, shikoku: 9000, hokkaido: 12000, kyushu: 12000 };
// The round trip home from 東京駅: { fare, vehicle, scenery, via, near }.
export function tripOf(prefId) {
  const pr = prefecture(prefId);
  const region = pr.region;
  if (prefId === 'tokyo' || !PREFECTURES[prefId]) return { fare: 400, vehicle: 'local', scenery: 'city', via: '電車ですぐ', near: true };
  if (prefId === 'kanagawa') return { fare: 1000, vehicle: 'local', scenery: 'city', via: '電車で1時間ほど', near: true };
  if (prefId === 'okinawa') return { fare: 15000, vehicle: 'plane', via: '空港から飛行機で' };
  if (region === 'hokkaido') return { fare: FARES.hokkaido, vehicle: 'plane', via: '空港から飛行機で' };
  if (region === 'kanto') return { fare: FARES.kanto, vehicle: 'local', scenery: 'fields', via: '特急電車で' };
  const scenery = { chubu: 'mountains', kansai: 'fuji', tohoku: 'fields', chugoku: 'fuji', shikoku: 'sea', kyushu: 'fuji' }[region] || 'fields';
  return { fare: FARES[region] || 6000, vehicle: 'shinkansen', scenery, via: '新幹線で' };
}
// A visit begins (the ticket, or arriving some other way).
export function startVisit(g) {
  const f = famState(g);
  const full = !f.lastFull || g.state.day - f.lastFull >= FULL_VISIT_DAYS;
  f.visit = { start: g.state.day, welcomed: false, full, gift: false };
  return f.visit;
}
STATION_TICKETS.station_tokyo.push({
  id: 'kisei', label: '帰省する',
  run: async (g, npc) => {
    const prof = profileOf(g.state);
    const pr = prefecture(prof.hometown);
    const t = tripOf(prof.hometown);
    const o = { name: npc.name, look: npc.look };
    const where = t.near ? `${pr.name}のご実家までは、${t.via}ですね。` : `${pr.name}のご実家までですね。`;
    const i = await g.ask(`${where}\n往復で ${fmtMoney(t.fare)} です。\n（${t.via}）`, ['帰省する', 'やめておく'], { ...o, cancel: 1 });
    if (i !== 0) return;
    if (!g.spend(t.fare)) { await g.say('お金が足りないようですね…。', o); return; }
    g.sfx('coin');
    await g.say('いってらっしゃいませ！\nどうぞ、ごゆっくり。', o);
    ensureFamily(g);
    startVisit(g);
    await g.fadeOut();
    const ride = travelScene(g, { to: `${pr.name}（ふるさと）`, via: t.via, vehicle: t.vehicle, scenery: t.scenery });
    await g.fadeIn();
    await ride;
    await g.fadeOut();
    await g.goto('jikka', 'yard', 7, 7, 'up');
  },
});

// ---------------------------------------------------------------- the 実家: tiles
// tatami, two orientations (variants) so the floor reads as separate mats
defineTile('jikka_tatami', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#cfc47e');
    for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#c2b871');
    R(c, 0, 0, 16, 1, '#3d5a2a'); R(c, 0, 15, 16, 1, '#3d5a2a');
  },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#cfc47e');
    for (let y = 3; y < 30; y += 2) R(c, 0, y, 32, 1, '#c4ba72');
    for (let y = 2; y < 30; y += 4) for (let x = (y & 4) ? 0 : 2; x < 32; x += 4) P(c, x, y, '#d8ce8c');
    speckle(c, r, ['#dad18e', '#bdb36a'], 14, 0, 2, 32, 28);
    R(c, 0, 0, 32, 2, '#3d5a2a'); R(c, 0, 0, 32, 1, '#557a3a'); R(c, 0, 30, 32, 2, '#3d5a2a'); R(c, 0, 31, 32, 1, '#2c4420');
    R(c, 31, 2, 1, 28, '#b0a662'); // the seam between two mats
  },
});
// wooden dish cabinet with glass doors
defineTile('jikka_shokki', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 1, 14, 15, '#8a5a33'); R(c, 2, 2, 12, 6, '#cfe6f2'); R(c, 2, 9, 12, 6, '#b98552'); R(c, 4, 4, 3, 2, '#ffffff'); R(c, 9, 4, 3, 2, '#f4a640'); },
  hd(c) {
    shadowEllipse(c, 16, 30, 15, 2);
    bevel(c, 2, 1, 28, 29, '#7a4e2a', '#9a6a3c', '#5a3a20');
    inset(c, 4, 3, 24, 13, '#bcd8e8', '#e4f2fa', '#8aa8bc');
    R(c, 15, 3, 2, 13, '#7a4e2a'); R(c, 4, 9, 24, 1, '#8a5a33');
    for (const [x, col] of [[6, '#ffffff'], [10, '#f4a640'], [19, '#ffffff'], [23, '#5fb0e8']]) { oval(c, x, 5, 4, 3, col); oval(c, x, 11, 4, 3, col === '#ffffff' ? '#e8c43a' : '#ffffff'); }
    P(c, 5, 4, '#ffffff'); P(c, 18, 4, '#ffffff');
    R(c, 4, 18, 24, 10, '#b98552'); R(c, 4, 18, 24, 1, '#d6a06a'); R(c, 15, 18, 2, 10, '#7a4e2a');
    R(c, 12, 22, 2, 2, '#e8c43a'); R(c, 18, 22, 2, 2, '#e8c43a');
    outline(c);
  },
});
// shoji window on a wall
defineTile('jikka_shoji', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 2, 12, 11, '#8a5a33'); R(c, 3, 3, 10, 9, '#f6f1e2'); R(c, 7, 3, 1, 9, '#b98552'); R(c, 3, 7, 10, 1, '#b98552'); },
  hd(c) {
    R(c, 4, 3, 24, 23, '#7a4e2a'); R(c, 4, 3, 24, 1, '#9a6a3c');
    R(c, 6, 5, 20, 19, '#f6f1e2'); dither(c, 6, 5, 20, 19, '#fbf8ee');
    for (const x of [11, 16, 21]) R(c, x, 5, 1, 19, '#b98552');
    for (const y of [10, 15, 20]) R(c, 6, y, 20, 1, '#b98552');
    R(c, 6, 5, 20, 1, '#e4dcc4');
    R(c, 3, 26, 26, 2, '#6e4428'); R(c, 3, 26, 26, 1, '#8a5a33');
    outline(c);
  },
});
// framed family photos on the wall
defineTile('jikka_photos', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 4, 5, 6, '#8a5a33'); R(c, 3, 5, 3, 4, '#8fd0ff'); R(c, 9, 3, 6, 7, '#8a5a33'); R(c, 10, 4, 4, 5, '#ffd8a8'); },
  hd(c) {
    const frame = (x, y, w, h, bg, figs) => {
      R(c, x, y, w, h, '#6e4428'); R(c, x + 1, y + 1, w - 2, h - 2, '#c9a06a'); R(c, x + 2, y + 2, w - 4, h - 4, bg);
      for (const [fx, fy, col] of figs) { R(c, fx, fy, 2, 2, '#f6c9a0'); R(c, fx - 1, fy + 2, 4, 3, col); }
    };
    frame(3, 6, 12, 12, '#9fd4ff', [[7, 9, '#d64161'], [10, 10, '#3f5fa8']]);
    frame(17, 4, 12, 15, '#ffe0b8', [[20, 8, '#2f9a4a'], [23, 7, '#ff8a3d'], [21, 12, '#5a6a8a']]);
    R(c, 3, 18, 12, 1, 'rgba(0,0,0,0.15)'); R(c, 17, 19, 12, 1, 'rgba(0,0,0,0.15)');
    outline(c);
  },
});
// 仏壇: dark lacquer cabinet with gilded inside (used by a prop, shown when someone passed away)
defineTile('jikka_butsudan', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 1, 12, 15, '#3a2418'); R(c, 4, 3, 8, 8, '#c9a227'); R(c, 6, 5, 4, 4, '#2a1a12'); R(c, 3, 12, 10, 3, '#5a3a24'); },
  hd(c) {
    shadowEllipse(c, 16, 30, 14, 2);
    bevel(c, 3, 1, 26, 29, '#3a2418', '#5a3a26', '#24160e');
    R(c, 3, 1, 26, 3, '#2a1a12'); R(c, 2, 0, 28, 2, '#4a2e1e');
    // open doors
    R(c, 4, 5, 4, 16, '#5a3a24'); R(c, 24, 5, 4, 16, '#5a3a24'); R(c, 5, 6, 2, 14, '#6e4a30'); R(c, 25, 6, 2, 14, '#6e4a30');
    // gilded inside
    inset(c, 8, 5, 16, 16, '#b8901f', '#e8c43a', '#8a6a14');
    R(c, 10, 7, 12, 3, '#e8c43a'); P(c, 11, 8, '#fff6a8');
    R(c, 13, 11, 6, 8, '#2a1a12'); // where the photo stands (drawn by the prop)
    // candles and incense on the shelf
    R(c, 8, 21, 16, 2, '#6e4428');
    R(c, 9, 17, 2, 4, '#f4f2ec'); P(c, 9, 16, '#ffb03a'); R(c, 21, 17, 2, 4, '#f4f2ec'); P(c, 22, 16, '#ffb03a');
    // drawers
    R(c, 5, 23, 22, 6, '#4a2e1e'); R(c, 5, 25, 22, 1, '#2a1a12'); R(c, 14, 24, 4, 1, '#c9a227'); R(c, 14, 27, 4, 1, '#c9a227');
    outline(c);
  },
});
// a decorative stand with a vase (where the 仏壇 would be when nobody passed away)
defineTile('jikka_kazari', {
  solid: true, obj: true,
  draw(c) { R(c, 2, 9, 12, 6, '#8a5a33'); R(c, 6, 3, 4, 6, '#3f6fb0'); R(c, 7, 1, 2, 2, '#5ea04a'); },
  hd(c) {
    shadowEllipse(c, 16, 30, 13, 2);
    bevel(c, 3, 18, 26, 11, '#8a5a33', '#a87449', '#6e4428'); R(c, 3, 18, 26, 2, '#b98552');
    R(c, 5, 29, 3, 2, '#5a3a20'); R(c, 24, 29, 3, 2, '#5a3a20');
    oval(c, 11, 8, 10, 11, '#2f5fa0'); R(c, 13, 6, 6, 3, '#2f5fa0'); P(c, 13, 10, '#8ab4e8'); P(c, 14, 9, '#8ab4e8');
    R(c, 15, 1, 1, 6, '#3d8a44'); R(c, 12, 2, 1, 5, '#3d8a44'); R(c, 19, 3, 1, 4, '#3d8a44');
    oval(c, 13, 0, 4, 3, '#ff8ab0'); oval(c, 17, 1, 4, 3, '#ffd23f');
    outline(c);
  },
});
defineTile('jikka_tansu', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 2, 14, 14, '#8a5a33'); for (const y of [4, 8, 12]) { R(c, 2, y, 12, 3, '#b98552'); P(c, 7, y + 1, '#3a3a3a'); } },
  hd(c, r) {
    shadowEllipse(c, 16, 30, 15, 2);
    bevel(c, 2, 2, 28, 28, '#8a5a33', '#a87449', '#6e4428');
    for (const [y, h] of [[5, 6], [12, 7], [20, 8]]) {
      inset(c, 4, y, 24, h, '#b98552', '#d6a06a', '#8a5a33');
      grain(c, r, 5, y + 1, 22, h - 2, '#ad7a48', 3, 6);
      R(c, 12, y + Math.floor(h / 2), 8, 1, '#3a2a20'); R(c, 12, y + Math.floor(h / 2) - 1, 1, 2, '#3a2a20'); R(c, 19, y + Math.floor(h / 2) - 1, 1, 2, '#3a2a20');
    }
    outline(c);
  },
});
// round low table with a teapot and cups
defineTile('jikka_chabudai', {
  solid: true, obj: true,
  draw(c) { oval(c, 1, 4, 14, 9, '#8a5a33'); oval(c, 2, 4, 12, 7, '#b98552'); R(c, 6, 5, 4, 3, '#4a6a5a'); },
  hd(c, r) {
    shadowEllipse(c, 16, 26, 15, 3);
    oval(c, 1, 8, 30, 18, '#6e4428'); oval(c, 1, 7, 30, 16, '#a87449'); oval(c, 3, 8, 26, 13, '#b98552');
    grain(c, r, 6, 10, 20, 9, '#ad7a48', 4, 6);
    R(c, 6, 23, 3, 4, '#5a3a20'); R(c, 23, 23, 3, 4, '#5a3a20');
    // teapot
    oval(c, 11, 8, 9, 7, '#3f6a5a'); R(c, 14, 7, 3, 2, '#2f5a4a'); R(c, 20, 10, 3, 1, '#3f6a5a'); P(c, 12, 9, '#7aa898');
    // cups
    R(c, 6, 13, 4, 4, '#f4f2ec'); R(c, 6, 13, 4, 1, '#8ab858'); R(c, 22, 14, 4, 4, '#f4f2ec'); R(c, 22, 14, 4, 1, '#8ab858');
    // a plate of crackers
    oval(c, 13, 16, 8, 4, '#ffffff'); R(c, 15, 17, 2, 1, '#c8862a'); R(c, 18, 17, 2, 1, '#c8862a');
    outline(c);
  },
});
defineTile('jikka_zabuton', {
  obj: true,
  draw(c) { R(c, 3, 4, 10, 9, '#7a4fa0'); R(c, 4, 5, 8, 7, '#9273bd'); },
  hd(c) {
    R(c, 6, 8, 20, 17, '#5a3a7a'); R(c, 5, 9, 22, 15, '#7a4fa0'); R(c, 7, 10, 18, 12, '#8a62b0');
    R(c, 7, 10, 18, 1, '#a888cc'); R(c, 15, 15, 2, 2, '#ffd23f');
    for (const [x, y] of [[5, 8], [26, 8], [5, 24], [26, 24]]) P(c, x, y, '#ffd23f');
  },
});
defineTile('jikka_futon_top', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 1, 14, 15, '#f4f2ec'); R(c, 4, 2, 8, 4, '#ffffff'); R(c, 1, 8, 14, 8, '#d64f6f'); },
  hd(c) {
    R(c, 2, 2, 28, 30, '#e4e0d6'); R(c, 3, 3, 26, 29, '#f4f2ec');
    bevel(c, 8, 4, 16, 8, '#ffffff', '#ffffff', '#d8d4ca'); R(c, 9, 5, 14, 1, '#f8f8f8');
    R(c, 3, 14, 26, 18, '#c84a68'); R(c, 3, 14, 26, 2, '#e07a92');
    for (let y = 18; y < 32; y += 6) for (let x = 6; x < 28; x += 8) { R(c, x, y, 3, 3, '#f4c0cc'); P(c, x + 1, y + 1, '#ffffff'); }
    outline(c);
  },
});
defineTile('jikka_futon_bottom', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 0, 14, 14, '#d64f6f'); R(c, 1, 14, 14, 1, '#a83a52'); },
  hd(c) {
    R(c, 2, 0, 28, 29, '#e4e0d6'); R(c, 3, 0, 26, 28, '#c84a68');
    for (let y = 2; y < 26; y += 6) for (let x = 6; x < 28; x += 8) { R(c, x, y, 3, 3, '#f4c0cc'); P(c, x + 1, y + 1, '#ffffff'); }
    R(c, 3, 25, 26, 3, '#a83a52'); R(c, 2, 28, 28, 2, '#cfcabe');
    shadowEllipse(c, 16, 30, 14, 1);
    outline(c);
  },
});
// wooden veranda (縁側), walkable, seamless planks
defineTile('jikka_engawa', {
  draw(c) { R(c, 0, 0, 16, 16, '#b98552'); for (const y of [4, 8, 12]) R(c, 0, y, 16, 1, '#8a5a33'); R(c, 0, 15, 16, 1, '#5a3a20'); },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#b98552');
    for (let y = 0; y < 28; y += 7) { R(c, 0, y, 32, 1, '#8a5a33'); R(c, 0, y + 1, 32, 1, '#cf9a64'); grain(c, r, 0, y + 2, 32, 4, '#ad7a48', 3, 8); }
    R(c, 0, 28, 32, 2, '#6e4428'); R(c, 0, 30, 32, 2, '#4a2e18');
  },
});
// laundry pole with towels and a shirt
defineTile('jikka_monohoshi', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 2, 1, 14, '#9aa0aa'); R(c, 14, 2, 1, 14, '#9aa0aa'); R(c, 1, 3, 14, 1, '#c8ccd4'); R(c, 3, 4, 4, 6, '#ffffff'); R(c, 9, 4, 4, 5, '#5fb0e8'); },
  hd(c) {
    shadowEllipse(c, 16, 30, 14, 2);
    R(c, 2, 4, 2, 26, '#7d8391'); R(c, 28, 4, 2, 26, '#7d8391'); R(c, 1, 29, 4, 2, '#5a5f6b'); R(c, 27, 29, 4, 2, '#5a5f6b');
    R(c, 1, 5, 30, 2, '#c8ccd4'); R(c, 1, 5, 30, 1, '#eef0f4');
    R(c, 5, 7, 8, 12, '#ffffff'); R(c, 5, 7, 8, 1, '#e4e8ee'); R(c, 5, 17, 8, 2, '#ffd23f');
    R(c, 15, 7, 11, 4, '#5fb0e8'); R(c, 17, 11, 7, 9, '#5fb0e8'); R(c, 19, 7, 3, 2, '#3f8fd0'); R(c, 17, 11, 7, 1, '#3f8fd0');
    outline(c);
  },
});
// a small vegetable patch (just sprouts: no season)
defineTile('jikka_hatake', {
  solid: true, obj: true,
  draw(c) { R(c, 0, 2, 16, 13, '#6e4a2a'); for (const y of [4, 8, 12]) { R(c, 0, y, 16, 2, '#8a5e36'); for (let x = 2; x < 16; x += 4) R(c, x, y - 1, 2, 2, '#5ea04a'); } },
  hd(c, r) {
    R(c, 0, 3, 32, 27, '#5a3a20'); R(c, 0, 3, 32, 1, '#7a4e2a');
    for (const y of [6, 14, 22]) {
      R(c, 0, y, 32, 5, '#8a5e36'); R(c, 0, y, 32, 1, '#a87449');
      speckle(c, r, ['#6e4a2a'], 6, 0, y + 1, 32, 4);
      for (let x = 2; x < 32; x += 6) { R(c, x + 1, y - 3, 1, 4, '#3d8a44'); R(c, x, y - 4, 2, 2, '#5ea04a'); R(c, x + 2, y - 3, 2, 2, '#74c26a'); }
    }
    R(c, 0, 29, 32, 2, '#4a2e18');
  },
});
// stone gate post with a little name plate
defineTile('jikka_gate', {
  solid: true, obj: true,
  draw(c) { R(c, 4, 1, 8, 15, '#9aa0aa'); R(c, 4, 1, 8, 2, '#c8ccd4'); R(c, 6, 5, 4, 5, '#e8dcc0'); },
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    bevel(c, 8, 3, 16, 27, '#b8b0a0', '#d8d0c0', '#8a8272');
    for (let y = 9; y < 30; y += 7) R(c, 8, y, 16, 1, '#9a9282');
    R(c, 5, 0, 22, 4, '#3a3f58'); R(c, 5, 0, 22, 1, '#5a6080'); R(c, 7, 4, 18, 1, '#2a2e40');
    inset(c, 11, 8, 10, 12, '#e8dcc0', '#fff6e0', '#b8a888');
    R(c, 14, 10, 4, 1, '#3a3a3a'); R(c, 13, 13, 6, 1, '#3a3a3a'); R(c, 14, 16, 4, 1, '#3a3a3a');
    outline(c);
  },
});

// ---------------------------------------------------------------- the 実家: people in the house
// Places where family members stand (house) by preference.
const SLOTS = {
  kitchen: { x: 11, y: 3, dir: 'up' },
  zw: { x: 4, y: 4, dir: 'right' },
  ze: { x: 6, y: 4, dir: 'left' },
  zs: { x: 5, y: 5, dir: 'up' },
  r1: { x: 8, y: 3, dir: 'down' },
  r2: { x: 9, y: 5, dir: 'left' },
  r3: { x: 3, y: 6, dir: 'right', wander: 1 },
  r4: { x: 10, y: 6, dir: 'up', wander: 1 },
  r5: { x: 2, y: 3, dir: 'down' },
  r6: { x: 13, y: 6, dir: 'up' },
};
const SLOT_PREF = {
  mother: ['kitchen', 'zw', 'zs'], father: ['zw', 'zs', 'ze'], grandmother: ['ze', 'kitchen', 'zs'], grandfather: ['ze', 'zs', 'r5'],
  brother_older: ['r1', 'r2'], sister_older: ['r2', 'r1'], brother_younger: ['r3', 'r4'], sister_younger: ['r4', 'r3'],
};
const NPC_SLOTS = 10;
function seating(g) {
  const members = g ? ensureFamily(g) : [];
  if (seating.cache && seating.cache.members === members) return seating.cache.out;
  const free = new Set(Object.keys(SLOTS));
  const out = [];
  for (const M of byRole(members).slice(0, NPC_SLOTS)) {
    const k = (SLOT_PREF[M.rel] || []).find((s) => free.has(s)) || [...free][0];
    if (!k) break;
    free.delete(k);
    out.push({ M, ...SLOTS[k] });
  }
  seating.cache = { members, out };
  return out;
}
function famNpc(i) {
  const at = () => seating(game())[i] || null;
  return {
    type: 'npc',
    id: 'fam' + i,
    get x() { const s = at(); return s ? s.x : 1; },
    get y() { const s = at(); return s ? s.y : 1; },
    get dir() { const s = at(); return s ? s.dir : 'down'; },
    get wander() { const s = at(); return s && s.wander ? s.wander : 0; },
    get look() { const s = at(); return s ? s.M.look : {}; },
    get name() { const s = at(); return s ? s.M.label : ''; },
    get person() { const s = at(); return s ? s.M.pid : undefined; },
    cond: (g) => !!seating(g)[i],
  };
}
// the neighbour (when no family member is living)
function neighborM(g) {
  const prof = profileOf(g.state);
  const region = regionOf(prof.hometown) || REGIONS.kanto;
  return { dia: DIA[region.dialect] ? region.dialect : 'standard', you: (prof.givenName || 'ドット') + 'ちゃん', me: 'わたし', pref: prefecture(prof.hometown).name, gift: region.gift.name, sib: '', late: [] };
}
const NEIGHBOR_LOOK = { ...LOOKS.oldwoman, top: '#c0703a', apron: '#f4e8d0' };
const hasFamily = (g) => ensureFamily(g).length > 0;
const hasLateFam = (g) => lateMembers(g).length > 0;

// ---------------------------------------------------------------- the 実家: scripts
const visitOf = (g) => {
  const f = famState(g);
  if (!f.visit || typeof f.visit !== 'object') startVisit(g);
  return f.visit;
};
async function welcome(g) {
  const v = visitOf(g);
  if (v.welcomed) return;
  v.welcomed = true;
  const members = ensureFamily(g);
  const st = g.state;
  const f = famState(g);
  if (v.full) f.lastFull = st.day;
  await g.wait(200);
  if (!members.length) {
    const d = -g.addNeed('stress', v.full ? -15 : -4);
    await g.say(['（しんとした家…。\nでも、なつかしいにおいがする）', `（心がほどけていくようだ）${d ? `\n（ストレス -${d}）` : ''}`]);
    return;
  }
  const order = byRole(members);
  const first = order[0];
  await g.emote('player', '!');
  await g.say(fill(WELCOME[first.role][first.near ? 1 : 0], first), { name: PEOPLE[first.pid].name, look: first.look });
  const roles = new Set([first.role]);
  for (const M of order.slice(1, 3)) {
    await g.say(fill(WELCOME[M.role][roles.has(M.role) ? 2 : M.near ? 1 : 0], M), { name: PEOPLE[M.pid].name, look: M.look });
    roles.add(M.role);
  }
  let da = 0;
  for (const M of members) da = Math.max(da, g.addAff(M.pid, v.full ? 8 : 2, true));
  const d = -g.addNeed('stress', v.full ? -25 : -8);
  g.sfx(v.full ? 'chime' : 'good');
  await g.say([
    v.full ? '（なつかしい家のにおい、家族の声…。\n心も体も、すっかりほどけていく）' : '（家族の顔を見ると、ほっとする）',
    `（${[d ? `ストレス -${d}` : '', da ? `家族 ♥+${da}` : ''].filter(Boolean).join('・') || 'ゆっくりしていこう'}）`,
  ]);
}
async function meal(g, by) {
  const st = g.state;
  const v = visitOf(g);
  if (v.meal === st.day) { await g.say('（もうおなかいっぱい、ごちそうになった。\nまたあとで食べよう）'); return; }
  if (!g.canEat()) { await g.say(by ? fill('あら、おなかいっぱい{no}？\nじゃあ、またあとで{ne}。', by) : '（おなかいっぱいだ…。またあとで）', by ? { name: PEOPLE[by.pid].name, look: by.look } : {}); return; }
  v.meal = st.day;
  const members = ensureFamily(g);
  // whoever stands in the kitchen cooks (else the first of the family)
  const cook = by || (seating(g).find((x) => x.x === SLOTS.kitchen.x && x.y === SLOTS.kitchen.y) || {}).M || byRole(members)[0];
  if (cook) await g.say(fill(MEAL, cook), { name: PEOPLE[cook.pid].name, look: cook.look });
  else await g.say(fill(NEIGHBOR.meal, neighborM(g)), { name: 'おとなりさん', look: NEIGHBOR_LOOK });
  await g.fadeOut(12);
  g.sfx('good');
  await g.wait(400);
  await g.fadeIn(12);
  const before = st.stamina, hungry = st.life.hunger;
  if (cook) g.eat(55, { fill: 85, silent: true }); else g.eat(30, { fill: 45, silent: true });
  const ds = -g.addNeed('stress', cook ? -8 : -4);
  const dh = st.stamina - before, df = st.life.hunger - hungry;
  await g.say([cook ? '（ふるさとの味だ…！\nおなかも心も、満たされていく）' : '（やさしい味の煮物だ。\nなんだか、なつかしい）', `（${[dh ? `体力 +${dh}` : '', df ? `満腹 +${df}` : '', ds ? `ストレス -${ds}` : ''].filter(Boolean).join('・') || 'ごちそうさまでした'}）`]);
  if (cook) for (const M of members) g.addAff(M.pid, 1, true);
}
async function sleepOver(g) {
  const i = await g.ask('ふかふかの布団が敷いてある。\n実家に泊まる？（次の日になります）', ['泊まる', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  const before = g.state.life.stress;
  await g.sleep({ away: true, shower: 40, sleepStress: 25 });
  const d = before - g.state.life.stress;
  const members = ensureFamily(g);
  const lines = [`${g.dayLabel()}の朝。なつかしい天井だ…。${d > 0 ? `\nぐっすり眠れた。（ストレス -${d}）` : ''}`];
  if (members.length) {
    const M = byRole(members)[0];
    await g.say(lines);
    await g.say(fill('{you}、おはよう。\nよく眠れた？朝ごはん、できてる{yo}。', M), { name: PEOPLE[M.pid].name, look: M.look });
  } else await g.say(lines);
}
async function pray(g) {
  const late = lateMembers(g);
  if (!late.length) return;
  const st = g.state;
  const f = famState(g);
  await g.say(late.length > 1 ? '（仏壇に、家族の写真が並んでいる。\nろうそくに火をともして、手を合わせた）' : `（仏壇に、${late[0].call}の写真がある。\nろうそくに火をともして、手を合わせた）`);
  for (const M of late) {
    const cause = M.cause && M.cause !== 'secret' && CAUSES[M.cause] ? `${M.call}は、${CAUSES[M.cause].text}旅立った。` : `${M.call}…。`;
    await g.say(`（${cause}\n${MEMORIES[M.rel] || ''}）`);
  }
  const rank = rankIndex(st.fame);
  await g.say(`（近ごろのことを、心の中で報告した。\n${rank > 0 ? `「${RANKS[rank][1]}」になれたよ。見ていてね）` : 'まだまだだけど、がんばってるよ）'}`);
  if (f.pray !== st.day) {
    f.pray = st.day;
    const d = -g.addNeed('stress', -10);
    g.sfx('chime');
    await g.say(`（心が、すっと静かになった）${d ? `\n（ストレス -${d}）` : ''}`);
  }
  const members = ensureFamily(g);
  if (members.length && Math.random() < 0.7) {
    const M = byRole(members)[0];
    await g.say(fill(pick(MEMORIAL), M, { dead: pick(late).call }), { name: PEOPLE[M.pid].name, look: M.look });
  }
}
async function helpField(g) {
  const st = g.state;
  const f = famState(g);
  const members = ensureFamily(g);
  if (f.help === st.day) { await g.say('（小さな畑だ。今日はもう、草むしりをした）'); return; }
  const i = await g.ask('小さな畑だ。草むしりを手伝う？\n（体力 -5）', ['手伝う', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (st.stamina < 5) { await g.say('（体力が足りない…。少し休んでからにしよう）'); return; }
  f.help = st.day;
  st.stamina -= 5;
  await g.fadeOut(12);
  await g.wait(300);
  await g.fadeIn(12);
  const d = -g.addNeed('stress', -6);
  const M = byRole(members).find((x) => x.role === 'grand' || x.role === 'parent') || members[0];
  if (M) {
    g.addAff(M.pid, 2, true);
    await g.say(fill('ありがとう{ne}、{you}。\nおかげで、きれいになった{yo}。', M), { name: PEOPLE[M.pid].name, look: M.look });
  }
  await g.say(`（土のにおい、風の音…。いい汗をかいた）${d ? `\n（ストレス -${d}）` : ''}`);
}
async function leaveHome(g) {
  const i = await g.ask('東京に帰る？', ['帰る', 'まだいる'], { cancel: 1 });
  if (i !== 0) return false;
  const st = g.state;
  const f = famState(g);
  const v = visitOf(g);
  const members = ensureFamily(g);
  if (members.length && !v.gift) {
    v.gift = true;
    const M = byRole(members)[0];
    await g.say(fill(BENTO, M), { name: PEOPLE[M.pid].name, look: M.look });
    g.giveItem('family_bento', 1, true);
    if (ITEMS[giftItem(M)]) g.giveItem(giftItem(M), 2, true);
    g.sfx('good');
    await g.say(`（実家のお弁当と、${ITEMS[giftItem(M)] ? ITEMS[giftItem(M)].name : M.gift}×2 をもらった）`);
    const last = byRole(members)[members.length - 1];
    if (last !== M) await g.say(fill('また帰ってきて{ne}。待っ{teru}{kara}。', last), { name: PEOPLE[last.pid].name, look: last.look });
  } else if (!members.length) {
    await g.say(fill('いってらっしゃい。\nお家のことは、まかせて{ne}。', neighborM(g)), { name: 'おとなりさん', look: NEIGHBOR_LOOK });
  }
  f.lastVisit = st.day;
  f.visit = null;
  const prof = profileOf(st);
  const t = tripOf(prof.hometown);
  await g.fadeOut();
  const ride = travelScene(g, { to: '東京', via: t.via, vehicle: t.vehicle, scenery: t.scenery });
  await g.fadeIn();
  await ride;
  return true;
}

// ---------------------------------------------------------------- the 実家: the place
const homeName = () => {
  const g = game();
  const pr = g && g.state ? prefecture(profileOf(g.state).hometown).name : '';
  return pr ? `実家（${pr}）` : '実家';
};
registerPlace({
  id: 'jikka',
  get name() { return homeName(); },
  kind: 'building',
  bgm: 'title',
  start: { room: 'yard', x: 7, y: 7, dir: 'up' },
  rooms: {
    house: {
      floor: 'jikka_tatami',
      wall: 'cream',
      tiles: [
        '################',
        '#=sY==s==c==w==#',
        '#.T.v......kkfK#',
        '#..........____#',
        '#...zCz....__DD#',
        '#....z.....____#',
        '#F.........____#',
        '#u.........____#',
        '#######MM#######',
      ],
      legend: {
        s: 'wall_cream+jikka_shoji', Y: 'wall_cream+jikka_photos',
        T: 'jikka_tansu', v: 'tv', C: 'jikka_chabudai', z: 'jikka_zabuton',
        _: 'floor_wood', k: 'floor_wood+kitchen', f: 'floor_wood+fridge', K: 'floor_wood+jikka_shokki', D: 'floor_wood+table',
        F: 'jikka_futon_top', u: 'jikka_futon_bottom',
      },
      entities: [
        // the 仏壇 (someone passed away) or a flower stand
        {
          type: 'prop', x: 1, y: 2, solid: true, cond: (g) => hasLateFam(g), talk: pray,
          draw: (ctx, sx, sy, g) => {
            ctx.drawImage(tileImageHD('jikka_butsudan'), sx, sy, 16, 16);
            const late = lateMembers(g);
            const M = late[0];
            if (M) {
              // a small framed photo: black frame, a ribbon, a smiling face
              const hair = { black: '#2a2430', brown: '#6b4226', white: '#e8e8ee', silver: '#c8ccd4' }[(M.look || {}).hairColor] || '#2a2430';
              const fr = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(sx + x, sy + y, w, h); };
              fr(6, 5, 4, 4.5, '#16100c'); fr(6.5, 5.5, 3, 3.5, '#d8d4cc');
              fr(7, 6, 2, 2, '#f6c9a0'); fr(7, 5.5, 2, 1, hair); fr(7, 8, 2, 1, '#5a5f6b');
              fr(6, 5, 1, 1, '#16100c'); fr(9.5, 5, 0.5, 1.5, '#16100c');
            }
            if (Math.floor(g.frame / 20) % 2) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx + 4.5, sy + 7.5, 0.5, 0.5); ctx.fillRect(sx + 11, sy + 7.5, 0.5, 0.5); }
          },
        },
        { type: 'prop', x: 1, y: 2, solid: true, cond: (g) => !hasLateFam(g), draw: (ctx, sx, sy) => ctx.drawImage(tileImageHD('jikka_kazari'), sx, sy, 16, 16), text: '（花が生けてある。\n家の中が、ぱっと明るく見える）' },
        ...Array.from({ length: NPC_SLOTS }, (_, i) => famNpc(i)),
      ],
      warps: [
        { x: 7, y: 8, room: 'yard', tx: 7, ty: 3, dir: 'down' },
        { x: 8, y: 8, room: 'yard', tx: 8, ty: 3, dir: 'down' },
      ],
      events: [
        { x: 1, y: 6, h: 2, on: 'action', run: sleepOver },
        { x: 13, y: 4, w: 2, on: 'action', run: (g) => meal(g, null) },
        { x: 11, y: 2, w: 2, on: 'action', run: (g) => meal(g, null) },
        { x: 13, y: 2, on: 'action', run: async (g) => { await g.say('（冷蔵庫に、ふるさとの名物がぎっしり入っている）'); } },
        { x: 14, y: 2, on: 'action', run: async (g) => { await g.say('（食器棚だ。子どものころに使っていた\nお茶わんが、まだしまってある）'); } },
        { x: 2, y: 2, on: 'action', run: async (g) => { await g.say('（たんすの引き出しに、\n小さいころの服が、大事にしまってある）'); } },
        { x: 3, y: 1, on: 'action', run: async (g) => { await g.say('（家族の写真だ。\nみんな、いい顔で笑っている）'); } },
        {
          x: 4, y: 2, on: 'action',
          run: async (g) => {
            const f = famState(g);
            const first = f.tvDay !== g.state.day;
            f.tvDay = g.state.day;
            const d = first ? -g.addNeed('stress', -3) : 0;
            await g.say([`（地元のテレビ番組だ。\n${prefecture(profileOf(g.state).hometown).name}のおいしいお店を紹介している）`, d ? `（なんだか、ほっとする。ストレス -${d}）` : '（のんびりした番組だ）']);
          },
        },
        { x: 5, y: 4, on: 'action', run: async (g) => { await g.say('（ちゃぶ台だ。\n子どものころから、ずっとここにある）'); } },
      ],
      // not awaited (like home.js's corridor): the arrival itself is done, the welcome follows
      onEnter: (g) => { ensureFamily(g); if (!visitOf(g).welcomed) g.run(() => welcome(g)); },
    },
    yard: {
      floor: 'grass',
      wall: 'wood',
      tiles: [
        '################',
        '#===s==dd====s=#',
        'HEEEEEE::EEEEEEH',
        'H......::......H',
        'H.t....::.ooo.LH',
        'H......::......H',
        'H.p.b..::....p.H',
        'H......::......H',
        'HHHHHHG::GHHHHHH',
      ],
      legend: {
        s: 'wall_wood+jikka_shoji', d: 'wall_wood+door_wood', E: 'jikka_engawa', ':': 'path',
        H: 'hedge', t: 'tree', o: 'jikka_hatake', L: 'jikka_monohoshi', p: 'planter', b: 'bench', G: 'jikka_gate',
      },
      entities: [
        {
          type: 'npc', id: 'tonari', x: 4, y: 3, dir: 'down', look: NEIGHBOR_LOOK, name: 'おとなりさん',
          cond: (g) => !hasFamily(g),
          talk: async (g, npc) => {
            const M = neighborM(g);
            const o = { name: npc.name, look: npc.look };
            const v = visitOf(g);
            if (!v.neighbor) {
              v.neighbor = true;
              await g.say([fill(NEIGHBOR.welcome, M), ...(hasLateFam(g) ? [fill(NEIGHBOR.flowers, M)] : [])], o);
            } else await g.say(fill(pick(NEIGHBOR.talk), M), o);
            if (v.meal !== g.state.day) {
              const i = await g.ask(fill('そうそう、煮物を作ったの。\n食べていく？', M), ['いただきます', 'だいじょうぶ'], { ...o, cancel: 1 });
              if (i === 0) await meal(g, null);
            }
          },
        },
      ],
      warps: [
        { x: 7, y: 2, room: 'house', tx: 7, ty: 7, dir: 'up' },
        { x: 8, y: 2, room: 'house', tx: 8, ty: 7, dir: 'up' },
        { x: 7, y: 8, place: 'station_tokyo', room: 'concourse', tx: 6, ty: 8, dir: 'down', sfx: 'ok', check: leaveHome },
        { x: 8, y: 8, place: 'station_tokyo', room: 'concourse', tx: 7, ty: 8, dir: 'down', sfx: 'ok', check: leaveHome },
      ],
      events: [
        { x: 10, y: 4, w: 3, on: 'action', run: helpField },
        { x: 14, y: 4, on: 'action', run: async (g) => { await g.say('（物干しざおに、洗濯物がゆれている。\nお日さまのにおいがしそうだ）'); } },
        { x: 2, y: 4, on: 'action', run: async (g) => { await g.say('（子どものころ、この木に登って\nよくしかられたっけ…）'); } },
        {
          x: 4, y: 6, on: 'action',
          run: async (g) => {
            const f = famState(g);
            const first = f.benchDay !== g.state.day;
            f.benchDay = g.state.day;
            const d = first ? -g.addNeed('stress', -3) : 0;
            await g.say(`（ベンチに座って、庭をながめた）${d ? `\n（ストレス -${d}）` : ''}`);
          },
        },
        { x: 6, y: 8, on: 'action', run: async (g) => { await g.say(`（門の表札に「${profileOf(g.state).familyName || ''}」と書いてある）`); } },
        { x: 9, y: 8, on: 'action', run: async (g) => { await g.say(`（門の表札に「${profileOf(g.state).familyName || ''}」と書いてある）`); } },
      ],
      onEnter: (g) => {
        const v = visitOf(g);
        if (v.arrived) return;
        v.arrived = true;
        g.run(async () => {
          await g.wait(200);
          await g.say(`（ふるさと、${prefecture(profileOf(g.state).hometown).name}。\nなつかしい実家に帰ってきた…）`);
        });
      },
    },
  },
});

// ---------------------------------------------------------------- in person: talk menu extras
const isFam = (id) => !!(PEOPLE[id] && PEOPLE[id].family);
PEOPLE_UI.hooks.start.push((g) => { ensureFamily(g); });
PEOPLE_UI.extras.push({
  id: 'fam_meal', label: 'ごはんにする', order: 40,
  cond: (g, id) => isFam(id) && !!(g.map && g.map.placeId === 'jikka') && visitOf(g).meal !== g.state.day,
  run: async (g, id) => { await meal(g, memberOf(g, id)); return 'end'; },
});
PEOPLE_UI.extras.push({
  id: 'fam_memory', label: '思い出話をする', order: 41,
  cond: (g, id) => isFam(id) && (g.person(id) || {}).memDay !== g.state.day,
  run: async (g, id, npc) => {
    const M = memberOf(g, id);
    if (!M) return;
    const p = g.person(id);
    p.memDay = g.state.day;
    const o = { name: PEOPLE[id].name, look: (npc && npc.look) || M.look };
    const lines = [fill(MEMORY[M.role], M)];
    if (M.late.length) lines.push(lateLine(M));
    await g.say(lines, o);
    const da = g.addAff(id, 2, true);
    const ds = -g.addNeed('stress', -4);
    if (npc && npc.id && g.map && g.map.npc(npc.id)) g.emote(npc.id, '♥', 40);
    await g.say(`（なつかしい話に、花が咲いた）\n（${[da ? `♥+${da}` : '', ds ? `ストレス -${ds}` : ''].filter(Boolean).join('・') || 'ほっこりした'}）`);
  },
});

// ---------------------------------------------------------------- keeping in step with the state
// New game / つづきから replace g.state: register the family again (cheap when unchanged).
if (typeof window !== 'undefined') {
  setInterval(() => { try { const g = game(); if (g && g.state) ensureFamily(g); } catch (e) { console.error(e); } }, 500);
}
export const FAMILY = { DIA, ROLE, NEWS, WORRY, CHEER, EVENTS, fill, callPlan, seating };

// The justice core (optional: a guarded dynamic import): the family stands by the player — crime.js
// sends their messages — but an arrest and a judgment still hurt them (家族の気持ち, ♥ silently down).
import('../engine/crime.js').then(({ onJustice }) => {
  const hurt = (g, n) => {
    try {
      if (!g || !g.state || !g.state.people) return;
      for (const M of ensureFamily(g)) if (M && M.pid && PEOPLE[M.pid]) g.addAff(M.pid, -n, true);
    } catch (e) { console.error('[family] justice', e); }
  };
  onJustice('arrested', (g) => hurt(g, 3));
  onJustice('convicted', (g, info) => {
    const k = info && info.sentence && info.sentence.kind;
    hurt(g, k === 'prison' ? 8 : k === 'suspended' ? 5 : 2);
  });
}).catch(() => { /* no justice core */ });
