// Career: fans, the SNS app ドッター, weekly regular shows, your own show (冠番組) and
// the weekly popularity ranking.
//
//   Regular shows   8 weekly shows at the companies' buildings (registerRegular), offered by
//                   phone (kind 'offer') at most once every 3 days when the requirements are
//                   met. A declined show is not offered again within 4 weeks (an unanswered
//                   offer stays in the inbox and can still be accepted).
//   冠番組          at ★1200 and 8,000+ fans: your own weekly show ('career_kanmuri'), so it
//                   has a few weeks to run before the ★4000 finale. Its title, studio, weekday
//                   and minigame follow the player (agency, best skill) and are fixed when the
//                   offer is made (flags.career_kan). Declined, it is offered again a week
//                   later. The first recording ends with a celebration.
//   Fans            milestones 1,000 … 300,000 (phone messages + small gifts), fan letters
//                   (at most one per morning), a fan meeting at 20,000 fans and a bigger
//                   ファン感謝祭 at 100,000 (a one-day "regular" at a venue, see FANMEET).
//   ドッター        phone app: one post a day (今日のお仕事 / ごはん / オフの日 / 告知) → some
//                   fans (at most 40% of what your best show brings), stress -5; a timeline with fan replies; now and then a harmless
//                   misunderstanding (炎上しかけ) that a follow-up post clears up.
//   Ranking         every Monday morning: 「今週のタレント好感度ランキング」 (news).
//
// State: g.state.flags career_* / dotter (old saves simply lack them), g.state.phone.lastPost
// and .posts (life fields), g.state.regulars (engine). All names are fictional.

import { registerRegular, REGULARS, onMorning, registerPhoneApp, weekdayOf, weekOf, WEEKDAYS, PEOPLE, isKansai } from '../engine/life.js';
import { registerItem, ITEMS, RANKS, rankIndex, AGENCIES } from '../engine/state.js';
import { PLACES } from '../engine/map.js';
import { LOOKS, charSheetHD, drawFaceHD } from '../engine/sprites.js';
import { text, wrap, measure, COLORS } from '../engine/draw.js';
import { SW, SH, clamp, makeCanvas, shade, hash2 } from '../engine/util.js';
import { audio } from '../engine/audio.js';
import * as Phone from '../engine/phone.js';
import * as Guide from './guide.js';

// ======================================================================== small helpers
const G = () => (typeof window !== 'undefined' ? window.__game : null);
const ST = () => { const g = G(); return g && g.state ? g.state : null; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
function fansShort(n) {
  n = Math.max(0, Math.round(n || 0));
  if (n >= 100000) return `${Math.round(n / 10000)}万`;
  if (n >= 10000) return `${(Math.floor(n / 1000) / 10).toFixed(1)}万`;
  return n.toLocaleString('ja-JP');
}
// A flag that holds an object (created on first use; old saves lack it).
function obj(g, key) {
  const fl = g.state.flags;
  if (!fl[key] || typeof fl[key] !== 'object' || Array.isArray(fl[key])) fl[key] = {};
  return fl[key];
}
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
// Rounded rectangles: the phone's helpers when present, else simple local ones.
function rrect(c, x, y, w, h, r, col) {
  if (Phone.rrect) { Phone.rrect(c, x, y, w, h, r, col); return; }
  R(c, x + 1, y, w - 2, h, col); R(c, x, y + 1, w, h - 2, col);
}
function box(c, x, y, w, h, r, fill, outline, opt) {
  if (Phone.box) { Phone.box(c, x, y, w, h, r, fill, outline, opt || {}); return; }
  rrect(c, x, y, w, h, r, outline); rrect(c, x + 1, y + 1, w - 2, h - 2, r, fill);
}
const T = (c, s, x, y, size = 12, color = '#2a2a3a', align = 'left') => text(c, s, Math.round(x), Math.round(y), { size, color, align, shadow: null });
function fit(c, s, maxW, size = 12) {
  if (Phone.fitText) return Phone.fitText(c, s, maxW, size);
  s = String(s);
  if (measure(c, s, size) <= maxW) return s;
  const ch = Array.from(s);
  while (ch.length && measure(c, ch.join('') + '…', size) > maxW) ch.pop();
  return ch.join('') + '…';
}
// The look of an NPC of a registered place (by entity id, else by name); fallback otherwise.
const lookCache = {};
function npcLook(placeId, who, fallback) {
  const key = `${placeId}|${who.id || ''}|${who.name || ''}`;
  if (lookCache[key]) return lookCache[key];
  const p = PLACES[placeId];
  if (p && p.rooms) {
    for (const room of Object.values(p.rooms)) {
      const ents = room && Array.isArray(room.entities) ? room.entities : [];
      const e = ents.find((e) => e && e.type === 'npc' && e.look && ((who.id && e.id === who.id) || (!who.id && who.name && e.name === who.name)));
      if (e) return (lookCache[key] = e.look);
    }
  }
  return fallback;
}
const placeName = (id) => (PLACES[id] && PLACES[id].name) || (Guide.GUIDE && Guide.GUIDE[id] && Guide.GUIDE[id].name) || id;

// ======================================================================== items (keepsakes)
registerItem('career_kan_trophy', { name: '冠番組の記念トロフィー', price: 0, desc: '自分の名前がついた番組の、初回収録の記念。\nながめると、胸があつくなる。' });
registerItem('career_fm_photo', { name: 'ファンミの集合写真', price: 0, desc: 'ファンミーティングの最後に、会場のみんなと撮った写真。\n宝物だ。' });
registerItem('career_no1_badge', { name: '好感度No.1の記念バッジ', price: 0, desc: 'タレント好感度ランキングで1位になった記念。\nキラキラ光る金のバッジ。' });
registerItem('career_fan_plaque', { name: 'ファン30万人の記念盾', price: 0, desc: 'ファンが30万人をこえた記念に、ファンクラブから贈られた盾。' });

// ======================================================================== regular shows
// A regular pays more than a normal job of its tier and brings far more fans, but takes
// the weekday: be at the place that day (the engine offers the recording at the door).
// Its fame is a little below a job's: it comes on top of the day's work, and at a slow
// pace the weekly shows would otherwise rush the ★4000 finale.
// Tiers: ★250 jobs pay ~¥12,000 / ★45 / 135 fans; ★1000 ~¥30,000 / ★110 / 330 fans.
// Weekly TV / radio / stage exposure is where fans come from: a regular brings ~6x the
// fans of a job (so 8,000 fans for the 冠番組 is in reach around ★1200).
const SHOW_IDS = [];
const SHOW_META = {}; // id -> { tier (1: ★250, 2: ★1000), kansai, npc, medium: 'tv' | 'radio' | 'stage', voice }
// A show you hold now (accepted, not dropped; a declined offer leaves { declined, dropped }).
const isActive = (st, id) => !!(st.regulars[id] && !st.regulars[id].dropped && st.regulars[id].since != null);
const activeShows = (st) => SHOW_IDS.filter((id) => isActive(st, id));
// A show you hold that has been recorded at least once (on the air / on stage already).
const aired = (st, id) => isActive(st, id) && num(st.regulars[id].count) > 0;
// How the show reaches people: 'tv' | 'radio' | 'stage' ('event' for the fan meeting).
const mediumOf = (id) => (id === 'career_kanmuri' ? 'tv' : id === 'career_fanmeet' ? 'event' : (SHOW_META[id] && SHOW_META[id].medium) || 'tv');

function addShow(id, def) {
  const { npc, fallbackLook, kansai, tier, medium, voice, ...rest } = def;
  registerRegular(id, { ...rest, medium: medium || 'tv' });
  SHOW_IDS.push(id);
  SHOW_META[id] = { tier, kansai: !!kansai, npc, medium: medium || 'tv', voice: voice || null };
  // the host's face comes from that place's NPC (places load after this module)
  Object.defineProperty(REGULARS[id], 'hostLook', { get: () => npcLook(def.place, npc, fallbackLook), enumerable: true, configurable: true });
}
// Replace properties of a registered regular with getters.
function dyn(id, props) {
  for (const [k, get] of Object.entries(props)) Object.defineProperty(REGULARS[id], k, { get, enumerable: true, configurable: true });
}

// --- content for the shows' minigames
const BURARI_SCENES = [
  { prompt: '司会「今週は港町からお届けします！第一印象は？」', answers: [{ text: '潮の香りで元気が出ます！', score: 100 }, { text: '…魚のにおいがしますね', score: 10 }, { text: '海、ひろいですね〜', score: 60 }] },
  { prompt: '漁師さん「とれたてのイカ、食べてみな！」', answers: [{ text: 'コリコリで甘い！', score: 100 }, { text: 'イカはちょっと…', score: 10 }, { text: 'いただきまーす！', score: 60 }] },
  { prompt: 'おかみさん「うちのコロッケ、町の名物なのよ」', answers: [{ text: '中がとろっとろ！', score: 100 }, { text: 'ふつうのコロッケですね', score: 10 }, { text: '揚げたて最高です！', score: 70 }] },
  { prompt: '司会「ここで視聴者プレゼントのお知らせを！」', answers: [{ text: '名物セットを3名様に！', score: 100 }, { text: 'えーと、なんでしたっけ', score: 20 }, { text: 'わたしがほしいです！', score: 50 }] },
  { prompt: 'こども「テレビの人だ！なにしてるの？」', answers: [{ text: 'この町のいいところ探し！', score: 100 }, { text: 'お仕事中だから静かにね', score: 20 }, { text: 'ひみつ！', score: 50 }] },
  { prompt: '急に雨が降ってきた！ロケはどうする？', answers: [{ text: '雨の町もすてきです！', score: 100 }, { text: '中止にしましょう', score: 10 }, { text: '傘、だれか持ってます？', score: 50 }] },
  { prompt: '司会「最後に、この町をひと言で表すと？」', answers: [{ text: '人があったかい町！', score: 100 }, { text: '…遠い町？', score: 10 }, { text: 'また来たい町です！', score: 80 }] },
];
const RADIO_SCENES = [
  { prompt: 'パーソナリティ「今夜もはじまりました！相方の{name}さん、意気込みを！」', answers: [{ text: '今夜もしゃべり倒します！', score: 100 }, { text: 'ねむいです…', score: 10 }, { text: 'よろしゅうおたのもうします', score: 70 }] },
  { prompt: 'パーソナリティ「ハガキ来てます。『最近、犬が自分より早起きです』」', answers: [{ text: 'ワンダフルな朝やん！', score: 100 }, { text: 'そうですか', score: 10 }, { text: 'うちは猫が早いです', score: 60 }] },
  { prompt: 'パーソナリティ「大阪で好きな食べもんは？」', answers: [{ text: 'たこ焼き！熱々のやつ！', score: 100 }, { text: 'とくにないですね', score: 10 }, { text: '豚まんも捨てがたい！', score: 80 }] },
  { prompt: 'パーソナリティ「リスナーさんから『ぼくも芸人になりたい』て」', answers: [{ text: 'いつか一緒に舞台立とな！', score: 100 }, { text: 'やめといたほうが…', score: 10 }, { text: 'まずはネタ帳からや！', score: 70 }] },
  { prompt: 'パーソナリティ「ここで1曲…あ、CDが見つからへん！」', answers: [{ text: 'ほな、わたしが歌います！', score: 100 }, { text: '（無言で待つ）', score: 0 }, { text: '鼻歌でつなぎましょ！', score: 70 }] },
  { prompt: 'パーソナリティ「そろそろお別れの時間です。ひと言！」', answers: [{ text: 'また来週、この時間に！', score: 100 }, { text: 'おつかれっした', score: 20 }, { text: 'みんな、はよ寝や〜！', score: 80 }] },
];
// Bits for the 寄席 stage, in the 相方's own way of talking (Kansai-ben / standard).
const YOSE_BITS = {
  kansai: [
    [{ boke: 'この前、商店街で福引きしたんですわ。', punch: false }, { boke: '一等の温泉旅行…の、となりの人がもらうティッシュでした。', punch: true, tsukkomi: 'それただのハズレや！' }],
    [{ boke: '最近、朝活はじめましてん。', punch: false }, { boke: '毎朝5時に起きて…二度寝。', punch: true, tsukkomi: 'それ朝活ちゃう！' }],
    [{ boke: 'ぼく、料理が得意なんですよ。', punch: false }, { boke: '得意料理は…お湯。', punch: true, tsukkomi: '料理ちゃうやろ！' }],
    [{ boke: '将来の夢は、宇宙飛行士です。', punch: false }, { boke: 'ただ、高いところがこわいんです。', punch: true, tsukkomi: '向いてへんわ！' }],
    [{ boke: '健康のために、毎日1万歩あるいてます。', punch: false }, { boke: 'スマホを持って、その場で足ぶみで。', punch: true, tsukkomi: 'ずるいな！' }],
    [{ boke: 'お客さん、今日はあったかいですね〜。', punch: false }, { boke: '拍手の温度が！', punch: true, tsukkomi: 'うまいこと言うな！' }],
    [{ boke: '休みの日は、家でゴロゴロしてますねん。', punch: false }, { boke: 'ゴロゴロしすぎて、気づいたら隣町まで転がってました。', punch: true, tsukkomi: 'どんだけ転がるねん！' }],
    [{ boke: '最近、犬を飼いはじめたんですわ。', punch: false }, { boke: '名前は「ネコ」です。', punch: true, tsukkomi: 'ややこしいわ！' }],
  ],
  std: [
    [{ boke: 'この前、商店街で福引きしたんですよ。', punch: false }, { boke: '一等の温泉旅行…の、となりの人がもらうティッシュでした。', punch: true, tsukkomi: 'それただのハズレだろ！' }],
    [{ boke: '最近、朝活はじめたんです。', punch: false }, { boke: '毎朝5時に起きて…二度寝。', punch: true, tsukkomi: 'それ朝活じゃない！' }],
    [{ boke: 'わたし、料理が得意なんですよ。', punch: false }, { boke: '得意料理は…お湯。', punch: true, tsukkomi: '料理じゃないだろ！' }],
    [{ boke: '将来の夢は、宇宙飛行士です。', punch: false }, { boke: 'ただ、高いところがこわいんです。', punch: true, tsukkomi: '向いてないだろ！' }],
    [{ boke: '健康のために、毎日1万歩あるいてます。', punch: false }, { boke: 'スマホを持って、その場で足ぶみで。', punch: true, tsukkomi: 'ずるいな！' }],
    [{ boke: 'お客さん、今日はあったかいですね〜。', punch: false }, { boke: '拍手の温度が！', punch: true, tsukkomi: 'うまいこと言うな！' }],
    [{ boke: '休みの日は、家でゴロゴロしてるんです。', punch: false }, { boke: 'ゴロゴロしすぎて、気づいたら隣町まで転がってました。', punch: true, tsukkomi: 'どれだけ転がるんだよ！' }],
    [{ boke: '最近、犬を飼いはじめたんですよ。', punch: false }, { boke: '名前は「ネコ」です。', punch: true, tsukkomi: 'ややこしいよ！' }],
  ],
};
const CONTE_CLUB = [
  { title: '気が弱すぎる銀行強盗', beats: 'OTNDWOTK' },
  { title: '最後の晩ごはんに迷う王様', beats: 'KDNWOTDK' },
  { title: '宇宙人の転校生', beats: 'DWTDONWK' },
  { title: '早口すぎる天気予報士', beats: 'WODDTNWK' },
  { title: 'ポンコツ執事の初出勤', beats: 'TDOWNDWK' },
  { title: 'ゴールしないマラソン選手', beats: 'KWDONTWK' },
];
const yoseLines = (dialect = 'kansai') => [{ boke: 'どうも〜！よろしくお願いします！', punch: false }, ...shuffled(YOSE_BITS[dialect] || YOSE_BITS.kansai).slice(0, 4).flat()];

addShow('career_nhk_juku', {
  title: '博士のドット塾', place: 'nhk', weekday: 0, tier: 1,
  requires: { fame: 250 },
  pay: 16000, fame: 45, fans: 900, stamina: 20, skill: 'talk', medium: 'tv', voice: 'hakase',
  minigame: 'quiz', opts: { category: 'general', difficulty: 3, count: 5, show: '博士のドット塾' },
  host: 'NHK 物知り博士', npc: { id: 'nhk_hakase', name: '物知り博士' }, fallbackLook: LOOKS.oldman,
  desc: 'NHKの教養クイズ番組。物知り博士の出す問題に、塾生として答える。',
  offer: 'わしは物知り博士じゃ。NHKの教養クイズ番組『博士のドット塾』で、毎週月曜の塾生をさがしておってな。\n{name}くんのがんばり、ちゃんと見ておるぞ。どうじゃ、塾生になってみんか？',
});
addShow('career_bsy_burari', {
  title: 'ぶらり！ご当地ドット便', place: 'bs_yoshimoto', weekday: 1, tier: 1,
  requires: { fame: 250 },
  pay: 15000, fame: 40, fans: 850, stamina: 20, skill: 'talk', medium: 'tv',
  minigame: 'talk', opts: { difficulty: 3, topic: 'local', show: 'ぶらり！ご当地ドット便', scenes: BURARI_SCENES },
  host: 'BSよしもと 陽向さん', npc: { name: '司会の陽向さん' }, fallbackLook: LOOKS.announcerM,
  desc: 'BSよしもとの情報バラエティ。全国の町をたずねて、その魅力をリポートする。',
  offer: 'BSよしもとの陽向です。毎週火曜の情報バラエティ『ぶらり！ご当地ドット便』で、全国の町を紹介するリポーターを探しています。\n{name}さんの明るいトーク、ぜひ番組で聞かせてください！',
});
addShow('career_yoshimoto_yose', {
  title: 'ドット寄席 水曜の部', place: 'yoshimoto', weekday: 2, tier: 1, kansai: true,
  requires: { fame: 250, anyOf: [{ agency: 'yoshimoto' }, { skills: { warai: 40 } }], anyOfText: 'よしもと所属か、お笑いのスキル40以上が必要だ。' },
  pay: 15000, fame: 45, fans: 850, stamina: 20, skill: 'warai', medium: 'stage',
  minigame: 'tsukkomi', opts: { difficulty: 3, dialect: 'kansai' },
  host: 'よしもと 舞台監督', npc: { name: '舞台監督' }, fallbackLook: LOOKS.staff,
  desc: 'よしもとの劇場で毎週ひらかれる漫才ライブ。常連のお客さんも多い。',
  offer: 'よしもとの舞台監督や。毎週水曜の劇場ライブ『ドット寄席 水曜の部』、レギュラーの枠がひとつ空いてな。\n{name}の漫才、毎週お客さんに見せたってくれへんか？',
});
addShow('career_shochiku_radio', {
  title: 'なんばハガキ道場', place: 'shochiku', weekday: 3, tier: 1, kansai: true,
  requires: { fame: 250, anyOf: [{ agency: 'shochiku' }, { skills: { talk: 40 } }], anyOfText: '松竹芸能所属か、トークのスキル40以上が必要だ。' },
  pay: 14000, fame: 40, fans: 800, stamina: 15, skill: 'talk', medium: 'radio',
  minigame: 'talk', opts: { difficulty: 3, topic: 'radio', show: 'なんばハガキ道場', scenes: RADIO_SCENES },
  host: '松竹芸能 プロデューサー', npc: { id: 'producer', name: 'プロデューサー' }, fallbackLook: LOOKS.manager,
  desc: '大阪・なんばで公開収録している深夜ラジオ。リスナーのハガキを読む。',
  offer: '松竹芸能のプロデューサーです。毎週木曜に公開収録しとるラジオ『なんばハガキ道場』、{name}さんにパーソナリティの相方をお願いしたいんですわ。\nリスナーのハガキ、一緒に読んでくれませんか？',
});
addShow('career_grape_conte', {
  title: '金曜コントクラブ', place: 'grape', weekday: 4, tier: 1,
  requires: { fame: 250, anyOf: [{ agency: 'grape' }, { skills: { engi: 40 } }], anyOfText: 'グレープカンパニー所属か、演技のスキル40以上が必要だ。' },
  pay: 15000, fame: 45, fans: 850, stamina: 20, skill: 'engi', medium: 'stage',
  minigame: 'command', opts: { theme: 'acting', difficulty: 3 },
  host: 'グレープ 藤棚先生', npc: { name: 'コント作家 藤棚先生' }, fallbackLook: LOOKS.director,
  desc: 'グレープカンパニーの劇場でやる、毎週新作のコントライブ。',
  offer: 'コント作家の藤棚です。グレープカンパニーの劇場でやっている『金曜コントクラブ』、毎週新作のコントを書いていてね。\n{name}さんに、レギュラーで演じてもらいたいんです。どうかな？',
});
addShow('career_toho_musical', {
  title: '星降る街のメロディ（日曜公演）', place: 'toho', weekday: 6, tier: 1,
  requires: { fame: 250, skills: { uta: 30 } },
  pay: 15000, fame: 40, fans: 800, stamina: 20, skill: 'uta', medium: 'stage',
  minigame: 'rhythm', opts: { difficulty: 3, lanes: 2, bpm: 120, length: 48, song: '星降る街のメロディ' },
  host: '東宝 演出家', npc: { id: 'toho_stagedir', name: '演出家' }, fallbackLook: LOOKS.director,
  desc: '東宝のミュージカルのロングラン公演。毎週日曜のステージにアンサンブルで出る。',
  offer: '東宝の演出家です。ミュージカル『星降る街のメロディ』のロングラン公演が決まりました！\n毎週日曜のステージに、アンサンブルとしてレギュラー出演していただけませんか？あなたの歌声が必要です。',
});
addShow('career_horipro_music', {
  title: 'ドット・サウンドステージ', place: 'horipro', weekday: 2, tier: 2,
  requires: { fame: 1000, anyOf: [{ agency: 'horipro' }, { skills: { uta: 50 } }], anyOfText: 'ホリプロ所属か、歌のスキル50以上が必要だ。' },
  pay: 36000, fame: 100, fans: 2600, stamina: 25, skill: 'uta', medium: 'tv',
  minigame: 'rhythm', opts: { difficulty: 4, lanes: 4, song: 'きらめきプレイリスト' },
  host: 'ホリプロ 制作プロデューサー', npc: { name: '制作プロデューサー' }, fallbackLook: LOOKS.singer,
  desc: '毎週水曜に収録する音楽番組。レギュラー歌手として、新しい歌を届ける。',
  offer: 'ホリプロの制作プロデューサーです。毎週水曜に収録している音楽番組『ドット・サウンドステージ』で、{name}さんにレギュラー歌手として出演してほしいんです。\n毎週、新しい歌を一緒に届けましょう！',
});
addShow('career_toei_hero', {
  title: 'ピクセリオン・ネオ', place: 'toei', weekday: 5, tier: 2,
  requires: { fame: 1000, skills: { engi: 50 } },
  pay: 36000, fame: 100, fans: 2800, stamina: 25, skill: 'engi', medium: 'tv',
  minigame: 'command', opts: { theme: 'henshin', difficulty: 4 },
  host: '東映 プロデューサー', npc: { id: 'toei_producer', name: 'プロデューサー' }, fallbackLook: LOOKS.manager,
  desc: '東映の特撮ヒーロー番組。ピクセリオンの新章で、新ヒーロー「ピクセリオン・ネオ」に変身する主人公の役。',
  offer: '東映のプロデューサーです。ピクセリオンのテレビシリーズに新章『ピクセリオン・ネオ』が決まりました！\n新ヒーローに変身する主人公の役を、{name}さんにお願いしたい！撮影は毎週土曜です。',
});
// shows whose content changes each week (fresh scenes, the player's 相方 on stage)
dyn('career_bsy_burari', { opts: () => ({ difficulty: 3, topic: 'local', show: 'ぶらり！ご当地ドット便', scenes: shuffled(BURARI_SCENES).slice(0, 5), mc: '陽向さん' }) });
dyn('career_shochiku_radio', { opts: () => ({ difficulty: 3, topic: 'radio', show: 'なんばハガキ道場', scenes: [RADIO_SCENES[0], ...shuffled(RADIO_SCENES.slice(1, -1)).slice(0, 3), RADIO_SCENES[RADIO_SCENES.length - 1]] }) });
dyn('career_yoshimoto_yose', { opts: () => { const dialect = partnerDialect() || 'kansai'; return { difficulty: 3, dialect, lines: yoseLines(dialect), ...partnerOpts() }; } });
dyn('career_grape_conte', { opts: () => ({ theme: 'acting', difficulty: 3, scenes: shuffled(CONTE_CLUB).slice(0, 4) }) });

// The player's 相方 (people.js) plays the ボケ in comedy shows when there is one.
function partnerDef() {
  const st = ST();
  const id = st && st.partner;
  return (id && PEOPLE[id]) || null;
}
function partnerOpts() {
  const P = partnerDef();
  return P ? { partner: P.short || P.name, partnerLook: P.look } : {};
}
// 'kansai' | 'std' for the 相方's lines; null without a 相方
function partnerDialect() {
  const P = partnerDef();
  return P ? (isKansai(P) ? 'kansai' : 'std') : null;
}

// ======================================================================== 冠番組
export const KAN = 'career_kanmuri';
const KAN_KINDS = {
  talk: { suffix: 'のトークひろば', skill: 'talk', minigame: 'talk' },
  warai: { suffix: 'のドッカン笑劇場', skill: 'warai', minigame: 'tsukkomi' },
  uta: { suffix: 'のミュージック・ドット', skill: 'uta', minigame: 'rhythm' },
  engi: { suffix: '劇場', skill: 'engi', minigame: 'command' },
};
// the studio (and the person who offers it) by agency; no agency: BSよしもと
const KAN_STUDIOS = {
  yoshimoto: { place: 'yoshimoto', host: 'よしもと マネージャー 笑川', npc: { name: 'マネージャー 笑川' }, kansai: false },
  shochiku: { place: 'shochiku', host: '松竹芸能 プロデューサー', npc: { id: 'producer', name: 'プロデューサー' }, kansai: true },
  grape: { place: 'grape', host: 'グレープ テレビのプロデューサー', npc: { name: 'テレビのプロデューサー' }, kansai: false },
  horipro: { place: 'horipro', host: 'ホリプロ TV局プロデューサー', npc: { name: 'TV局プロデューサー' }, kansai: false },
  none: { place: 'bs_yoshimoto', host: 'BSよしもと プロデューサー', npc: { name: 'プロデューサー' }, kansai: false },
};
const KAN_TALK = [
  { prompt: 'オープニング！客席から大きな拍手が起きている', answers: [{ text: 'みなさん、こんばんは！', score: 100 }, { text: '…えー、始まりました', score: 20 }, { text: '拍手、もっとちょうだい！', score: 70 }] },
  { prompt: 'ゲスト「今日は{name}さんに会いたくて来ました！」', answers: [{ text: 'うれしい！ゆっくりしてって！', score: 100 }, { text: 'そうですか', score: 10 }, { text: 'サインは後でね！', score: 60 }] },
  { prompt: 'ゲスト「実はわたし、昔{name}さんと共演してて…」', answers: [{ text: 'あの現場、覚えてる！', score: 100 }, { text: '…どちらさまでしたっけ', score: 10 }, { text: 'え、ほんとに！？', score: 60 }] },
  { prompt: 'ゲストがスベった！スタジオがシーンとしている', answers: [{ text: '今のは高度すぎた！', score: 100 }, { text: '（つられて黙る）', score: 0 }, { text: 'もう一回どうぞ！', score: 60 }] },
  { prompt: 'コーナー紹介の時間！カンペが逆さまだ', answers: [{ text: '逆立ちで読みます！', score: 100 }, { text: 'カンペ、逆です…', score: 30 }, { text: '（なんとなく読む）', score: 50 }] },
  { prompt: 'エンディング！最後にひと言お願いします', answers: [{ text: 'また来週、この時間に！', score: 100 }, { text: 'おつかれさまでした', score: 30 }, { text: '来週も見てね〜！', score: 80 }] },
];
const KAN_CONTE = [
  { title: '初回スペシャル・名探偵{name}', beats: 'KDOWTNDK' },
  { title: '{name}、王様になる', beats: 'WKDTOWNK' },
  { title: 'タイムスリップ商店街', beats: 'DDWTONWK' },
  { title: '涙の卒業式（コント）', beats: 'NTWDNOWK' },
];
function kanCfg() {
  const st = ST();
  const c = st && st.flags && st.flags.career_kan;
  return c && typeof c === 'object' ? c : { wd: 6, kind: 'talk', studio: 'none' };
}
function kanTitle(name) {
  const n = name || (ST() && ST().name) || '';
  const k = KAN_KINDS[kanCfg().kind] || KAN_KINDS.talk;
  return n ? `${n}${k.suffix}` : `冠番組${k.suffix.replace(/^の/, '')}`;
}
const kanStudio = () => KAN_STUDIOS[kanCfg().studio] || KAN_STUDIOS.none;

registerRegular(KAN, { title: '冠番組', medium: 'tv', place: 'bs_yoshimoto', weekday: 6, stamina: 25, pay: 90000, fame: 200, fans: 6000, minigame: 'talk', skill: 'talk', desc: '自分の名前がついた、毎週の冠番組。' });
dyn(KAN, {
  title: () => kanTitle(),
  place: () => kanStudio().place,
  weekday: () => clamp(num(kanCfg().wd, 6), 0, 6),
  host: () => kanStudio().host,
  hostLook: () => npcLook(kanStudio().place, kanStudio().npc, LOOKS.manager),
  skill: () => (KAN_KINDS[kanCfg().kind] || KAN_KINDS.talk).skill,
  minigame: () => (KAN_KINDS[kanCfg().kind] || KAN_KINDS.talk).minigame,
  opts: () => { watchFirst(KAN); return kanOpts(); },
});
function kanOpts() {
  const kind = kanCfg().kind;
  const title = kanTitle();
  const st = ST();
  const name = (st && st.name) || 'あなた';
  if (kind === 'warai') {
    // the 相方 talks the way they always do; alone, the studio decides. The built-in bits
    // are Kansai-ben, so a standard-Japanese show gets its own script.
    const dialect = partnerDialect() || (kanStudio().kansai || kanCfg().studio === 'yoshimoto' ? 'kansai' : 'std');
    return { difficulty: 5, dialect, ...(dialect === 'std' ? { lines: yoseLines('std') } : {}), ...partnerOpts() };
  }
  if (kind === 'uta') return { difficulty: 5, lanes: 4, song: `${name}のテーマ` };
  if (kind === 'engi') return { theme: 'acting', difficulty: 5, scenes: KAN_CONTE.map((s) => ({ ...s, title: s.title.replace('{name}', name) })) };
  return { difficulty: 5, topic: 'variety', show: title, scenes: [KAN_TALK[0], ...shuffled(KAN_TALK.slice(1, -1)).slice(0, 3), KAN_TALK[KAN_TALK.length - 1]] };
}
// Best skill decides what kind of show it is.
function bestSkill(st) {
  const order = ['talk', 'warai', 'uta', 'engi'];
  return order.reduce((best, k) => ((st.skills[k] || 0) > (st.skills[best] || 0) ? k : best), order[0]);
}

// ======================================================================== fan meeting (a one-day event)
// Registered as a regular whose weekday exists only in the event's week, until its day:
// the engine then offers it at the venue's door on that day, and never counts a miss.
export const FANMEET = 'career_fanmeet';
function fmCfg(st = ST()) {
  const f = st && st.flags && st.flags.career_fm;
  return f && typeof f === 'object' ? f : null;
}
const FM_SCENES = [
  { prompt: '司会「それでは、ファンのみなさんからの質問コーナー！」', answers: [{ text: 'なんでも聞いてください！', score: 100 }, { text: 'お手やわらかに…', score: 50 }, { text: '質問は1人1問まで', score: 20 }] },
  { prompt: 'ファン「休みの日は何をしてますか？」', answers: [{ text: '商店街を食べ歩きしてます！', score: 100 }, { text: 'ひみつです', score: 20 }, { text: 'ずっと寝てます', score: 50 }] },
  { prompt: 'こども「どうしたら{name}さんみたいになれますか？」', answers: [{ text: '毎日ちょっとずつ練習！', score: 100 }, { text: 'うーん、運かな', score: 10 }, { text: 'ごはんをいっぱい食べる！', score: 60 }] },
  { prompt: 'おばあちゃん「いつもテレビで元気をもらってるよ」', answers: [{ text: 'こちらこそ、ありがとう！', score: 100 }, { text: 'どうも', score: 10 }, { text: '長生きしてくださいね！', score: 70 }] },
  { prompt: 'ファン「最近ハマってることは？」', answers: [{ text: 'ドッターでみんなの返信読むこと！', score: 100 }, { text: 'とくにないです', score: 10 }, { text: '自炊です！', score: 60 }] },
  { prompt: '司会「最後に、ファンのみなさんへひと言！」', answers: [{ text: 'みんな、本当にありがとう！', score: 100 }, { text: 'おつかれさまでした', score: 20 }, { text: 'また会いましょう！', score: 80 }] },
];
registerRegular(FANMEET, { title: 'ファンミーティング', medium: 'event', place: 'bs_yoshimoto', weekday: -1, stamina: 20, pay: 30000, fame: 50, fans: 2500, minigame: 'talk', skill: 'talk', host: 'ドットプロモーション', desc: 'ファンのみんなと会える、一日だけのイベント。' });
dyn(FANMEET, {
  title: () => (fmCfg() && fmCfg().big ? 'ファン感謝祭' : 'ファンミーティング'),
  place: () => (fmCfg() && fmCfg().place) || 'bs_yoshimoto',
  // only in the event's own week and up to its day (so the morning after never counts a miss)
  weekday: () => {
    const f = fmCfg(), st = ST();
    if (!f || !st || f.state !== 'planned' || st.day > f.day || weekOf(st.day) !== weekOf(f.day)) return -1;
    return weekdayOf(f.day);
  },
  pay: () => (fmCfg() && fmCfg().big ? 60000 : 30000),
  fame: () => (fmCfg() && fmCfg().big ? 100 : 50),
  fans: () => (fmCfg() && fmCfg().big ? 8000 : 2500),
  hostLook: () => LOOKS.ad,
  opts: () => {
    watchFirst(FANMEET);
    const big = fmCfg() && fmCfg().big;
    return { difficulty: big ? 4 : 3, topic: big ? 'ファン感謝祭' : 'ファンミーティング', show: big ? 'ファン感謝祭' : 'ファンミーティング', mc: '司会', scenes: [FM_SCENES[0], ...shuffled(FM_SCENES.slice(1, -1)).slice(0, 3), FM_SCENES[FM_SCENES.length - 1]] };
  },
});
// The event shows up among your shows (schedule, notebook) only in its own week.
function joinFanMeet(g) {
  const st = g.state;
  const f = fmCfg(st);
  if (!f || f.state !== 'planned' || st.regulars[FANMEET] || st.day > f.day || weekOf(st.day) !== weekOf(f.day)) return;
  g.joinRegular(FANMEET);
}
// Where a fan meeting is held: the player's agency, else the BSよしもと studio.
const FM_VENUE = { yoshimoto: 'yoshimoto', shochiku: 'shochiku', grape: 'grape', horipro: 'horipro' };
function scheduleFanMeet(g, big) {
  const st = g.state;
  const place = (st.agency && FM_VENUE[st.agency] && PLACES[FM_VENUE[st.agency]] ? FM_VENUE[st.agency] : 'bs_yoshimoto');
  // the next Saturday / Sunday at least 2 days away: best a day without any of your
  // shows, else at least none at the same venue (a 冠番組 just offered counts as held)
  const held = activeShows(st).concat(isActive(st, KAN) || pendingOffer(st, KAN) ? [KAN] : []);
  const onDay = (d) => held.filter((id) => REGULARS[id].weekday === weekdayOf(d));
  const weekend = [];
  for (let d = st.day + 2; d < st.day + 16; d++) if (weekdayOf(d) >= 5) weekend.push(d);
  const day = weekend.find((d) => !onDay(d).length) ?? weekend.find((d) => !onDay(d).some((id) => REGULARS[id].place === place)) ?? weekend[0];
  const prev = fmCfg(st);
  st.flags.career_fm = { day, place, big: !!big, state: 'planned', n: num(prev && prev.n) + 1 };
  joinFanMeet(g);
  const what = big ? 'ファン感謝祭' : 'ファンミーティング';
  const intro = big
    ? `ファン10万人突破、おめでとうございます！\nこれを記念して、大きな${what}をひらきます！`
    : `ファン2万人突破、おめでとうございます！\n記念の${what}をひらくことになりました！`;
  g.message({
    from: 'イベント制作 ドットプロモーション', kind: 'news', look: LOOKS.ad,
    text: g.fmt(`${intro}\n日時：${day}日目（${WEEKDAYS[weekdayOf(day)]}曜）\n会場：${placeName(place)}\n当日、会場に来てくださいね。（トークの様子は配信用に収録します）`),
  });
}

// ======================================================================== celebrations
// The first recording of the 冠番組 (and each fan meeting) ends with a short party. The
// opts getter above runs when g.doRegular starts the recording: from there we wait until
// the recording is counted and its script is over, then celebrate as a script of our own.
const watching = {};
function watchFirst(id) {
  const g = G();
  if (!g || !g.state || watching[id] || !g.busy) return;
  const s = g.state.regulars[id];
  if (!s || !g.regularsToday().includes(id)) return;
  if (id === KAN && (s.count > 0 || g.state.flags.career_kanParty)) return;
  const before = s.count || 0;
  watching[id] = true;
  const start = g.frame;
  (async () => {
    try {
      const timeout = () => g.frame - start > 60 * 60 * 20;
      while (!(g.state && g.state.regulars[id] && g.state.regulars[id].count > before)) {
        await g.waitFrames(10);
        if (timeout()) return;
      }
      while (g.busy > 0 || g.top !== g.map || g.fade > 0) {
        await g.waitFrames(6);
        if (timeout()) return;
      }
      await g.run((gg) => (id === KAN ? kanParty(gg) : fanMeetParty(gg)));
    } finally {
      watching[id] = false;
    }
  })();
}

const FM_MC = { ...LOOKS.announcer, hairColor: 'brown', top: '#ff7eb6', bottom: '#2a2430' };
const CONFETTI = ['#ff5d8f', '#ffd23f', '#5fd7ff', '#5ee07a', '#ff8a3d', '#b48aff', '#ffffff'];
const AW = 320, AH = 180; // art pixels, shown 2x

class CelebrationScene {
  constructor(g, o) {
    this.g = g;
    this.o = o; // { kind: 'kanmuri' | 'fanmeet', title, host, hostLook }
    this.hd = true;
    this.opaque = true;
    this.hidesHud = true;
    this.t0 = g.frame;
    [this.cv, this.cx] = makeCanvas(AW, AH);
    this.bg = null;
  }
  update() {}
  sheet(look, dir = 'down') { const s = charSheetHD(look || {}); return (s[dir] || s.down)[0]; }
  stand(c, look, x, y, dir = 'down', hop = 0) { const im = this.sheet(look, dir); c.drawImage(im, 0, 0, im.width, im.height, Math.round(x), Math.round(y - hop), 32, 40); }
  shadow(c, x, y) { R(c, x + 7, y + 38, 18, 2, 'rgba(0,0,0,0.3)'); R(c, x + 9, y + 40, 14, 1, 'rgba(0,0,0,0.2)'); }
  background() {
    if (this.bg) return this.bg;
    const [cv, c] = makeCanvas(AW, AH);
    if (this.o.kind === 'fanmeet') paintHall(c); else paintStudio(c);
    this.bg = cv;
    return cv;
  }
  draw(ctx, g) {
    const t = g.frame - this.t0;
    const c = this.cx;
    c.clearRect(0, 0, AW, AH);
    c.drawImage(this.background(), 0, 0);
    const me = (g.state && g.state.look) || LOOKS.player;
    const hop = (k) => Math.round(Math.abs(Math.sin((t + k * 9) / 7)) * 3);
    if (this.o.kind === 'fanmeet') {
      // on stage: the MC and you; below: the crowd with penlights
      this.shadow(c, 108, 52); this.stand(c, FM_MC, 108, 52, 'right', 0);
      const h = hop(0) > 2 ? 1 : 0;
      this.shadow(c, 150, 50); this.stand(c, me, 150, 50, 'down', h);
      // handheld mic
      R(c, 174, 72 - h, 2, 6, '#3a3a44'); R(c, 173, 69 - h, 4, 3, '#20232a'); R(c, 174, 69 - h, 1, 1, '#8a8a9a');
      paintCrowd(c, t);
    } else {
      this.shadow(c, 70, 84); this.stand(c, LOOKS.ad, 70, 84, 'right', hop(1));
      this.shadow(c, 112, 82); this.stand(c, this.o.hostLook || LOOKS.manager, 112, 82, 'down', hop(2));
      this.shadow(c, 150, 80); this.stand(c, me, 150, 80, 'down', hop(0));
      this.shadow(c, 186, 82); this.stand(c, LOOKS.makeup, 186, 82, 'down', hop(3));
      this.shadow(c, 244, 84); this.stand(c, LOOKS.cameraman, 244, 84, 'left', 0);
      paintCamera(c, 228, 94);
      paintCake(c, 76, 110 - hop(1), t);
    }
    // confetti (stateless: every piece is a function of time)
    for (let i = 0; i < 90; i++) {
      const sp = 0.5 + hash2(i, 1, 7) * 0.7;
      const per = Math.round((AH + 20) / sp);
      const ph = (t + Math.floor(hash2(i, 2, 7) * per)) % per;
      const y = ph * sp - 10;
      const x = (hash2(i, 3, 7) * AW + Math.sin((t + i * 13) / 14) * 4) % AW;
      const col = CONFETTI[i % CONFETTI.length];
      const flip = Math.floor((t + i * 5) / 8) % 2;
      R(c, x, y, flip ? 2 : 1, flip ? 1 : 2, col);
    }
    ctx.drawImage(this.cv, 0, 0, AW, AH, 0, 0, SW, SH);
    this.drawText(ctx, g, t);
  }
  drawText(ctx, g, t) {
    if (this.o.kind === 'fanmeet') {
      const s = this.o.big ? 'ファン感謝祭' : 'ファンミーティング';
      text(ctx, `${g.state.name}`, SW / 2, 22, { size: 16, align: 'center', color: '#fff6a8', shadow: '#3a1048' });
      text(ctx, s, SW / 2, 42, { size: 24, align: 'center', color: '#ffffff', shadow: '#3a1048' });
      return;
    }
    // くす玉の垂れ幕（縦書き）
    const tate = ['祝', '初', '回', '放', '送'];
    tate.forEach((ch, i) => text(ctx, ch, 72, 40 + i * 18, { size: 16, align: 'center', color: '#c8102e', shadow: null }));
    // title board
    const title = `『${this.o.title}』`;
    const size = measure(ctx, title, 20) <= 380 ? 20 : 16;
    text(ctx, fit(ctx, title, 400, size), 380, 50, { size, align: 'center', color: '#fff6a8', shadow: '#1a1040' });
    const blink = Math.floor(t / 30) % 2 === 0;
    text(ctx, '第1回 収録おつかれさま！', 380, 82, { size: 16, align: 'center', color: blink ? '#ffffff' : '#ffd6e4', shadow: '#1a1040' });
  }
}

function paintStudio(c) {
  R(c, 0, 0, AW, 112, '#25204c');
  for (let x = 0; x < AW; x += 32) { R(c, x, 0, 1, 112, '#1a1638'); R(c, x + 1, 0, 1, 112, '#352f6a'); }
  // spotlights (flat translucent wedges)
  c.globalAlpha = 0.16;
  for (const sx of [96, 236]) for (let y = 0; y < 112; y++) { const w = 6 + y * 0.42; R(c, sx - w / 2 + (sx < 160 ? y * 0.25 : -y * 0.25), y, w, 1, '#fff6c8'); }
  c.globalAlpha = 1;
  // title board (LED screen)
  R(c, 104, 12, 172, 40, '#0e0c1e');
  R(c, 105, 13, 170, 38, '#3a2a8a');
  R(c, 105, 13, 170, 1, '#5a4ab0');
  for (let y = 15; y < 50; y += 3) for (let x = 107; x < 274; x += 3) if (hash2(x, y, 3) > 0.86) R(c, x, y, 1, 1, '#6a5ad0');
  R(c, 104, 52, 172, 2, '#0e0c1e');
  // くす玉: two halves open, a paper banner hangs down
  R(c, 35, 0, 1, 7, '#5a5a66');
  disc(c, 29, 10, 7, '#7a1020'); disc(c, 29, 10, 6, '#d6304a'); R(c, 29, 3, 8, 15, '#25204c');
  disc(c, 43, 10, 7, '#8a6a10'); disc(c, 43, 10, 6, '#ffd23f'); R(c, 36, 3, 7, 15, '#25204c');
  R(c, 28, 6, 1, 2, '#ff8a9a'); R(c, 44, 6, 1, 2, '#fff6a8');
  R(c, 27, 17, 18, 50, '#5a1a1a'); R(c, 28, 17, 16, 49, '#ffffff'); R(c, 28, 17, 2, 49, '#c8102e'); R(c, 42, 17, 2, 49, '#c8102e');
  // streamers
  const ST_COL = ['#ff5d8f', '#5fd7ff', '#ffd23f', '#5ee07a'];
  for (let i = 0; i < 8; i++) { const x = 18 + i * 5; for (let y = 16; y < 30 + (i % 3) * 8; y += 2) R(c, x + ((y >> 2) % 2), y, 1, 2, ST_COL[i % 4]); }
  // stage floor
  R(c, 0, 112, AW, 68, '#8a5a32');
  for (let y = 117; y < AH; y += 7) R(c, 0, y, AW, 1, '#6a4224');
  for (let x = 0; x < AW; x += 23) R(c, x, 112, 1, 68, '#7a4c2a');
  R(c, 0, 112, AW, 1, '#b07a44');
  for (let x = 4; x < AW; x += 12) { R(c, x, 108, 4, 3, '#3a2a1a'); R(c, x + 1, 108, 2, 2, x % 24 < 12 ? '#ffd23f' : '#fff6a8'); }
}
function paintHall(c) {
  R(c, 0, 0, AW, AH, '#1c1434');
  for (let y = 0; y < 90; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < AW; x += 4) if (hash2(x, y, 5) > 0.93) R(c, x, y, 1, 1, '#4a3a7a');
  // banner
  R(c, 40, 4, 240, 34, '#3a1048'); R(c, 41, 5, 238, 32, '#ff5d8f'); R(c, 41, 5, 238, 2, '#ff9ab8'); R(c, 41, 35, 238, 2, '#c8306a');
  for (let x = 46; x < 276; x += 10) { R(c, x, 38, 4, 3, x % 20 < 10 ? '#ffd23f' : '#5fd7ff'); }
  // stage
  R(c, 0, 86, AW, 14, '#5a3a24'); R(c, 0, 86, AW, 2, '#a8703e'); R(c, 0, 92, AW, 8, '#3a2414');
  R(c, 60, 44, 200, 44, '#3a2a5a');
  for (let x = 60; x < 260; x += 20) R(c, x, 44, 1, 44, '#4a3a6a');
  // spotlight on the center
  c.globalAlpha = 0.18;
  for (let y = 0; y < 88; y++) { const w = 20 + y * 0.5; R(c, 160 - w / 2, y, w, 1, '#fff6c8'); }
  c.globalAlpha = 1;
  for (let x = 4; x < AW; x += 14) { R(c, x, 84, 4, 3, '#2a1a10'); R(c, x + 1, 84, 2, 2, '#ffd23f'); }
  R(c, 0, 100, AW, 80, '#120c22');
}
function paintCrowd(c, t) {
  const HAIR_C = ['#2a2420', '#5a3a20', '#20232a', '#8a5a30', '#3a2a4a', '#c8a050'];
  const PEN = ['#ff5d8f', '#5fd7ff', '#ffd23f', '#5ee07a', '#b48aff', '#ff8a3d'];
  for (let row = 0; row < 4; row++) {
    const y = 112 + row * 16;
    for (let i = 0; i < 18; i++) {
      const x = 6 + i * 18 + (row % 2 ? 9 : 0);
      const k = row * 31 + i;
      const sway = Math.round(Math.sin((t + k * 7) / 9) * 2);
      // penlight
      const pc = PEN[k % PEN.length];
      R(c, x + 4 + sway, y - 13, 2, 9, pc);
      R(c, x + 3 + sway, y - 14, 4, 2, '#ffffff');
      R(c, x + 4, y - 4, 2, 3, '#3a3a44');
      // head (from behind) and shoulders
      disc(c, x + 7, y + 1, 5, HAIR_C[k % HAIR_C.length]);
      R(c, x, y + 6, 15, 8, shade(PEN[(k + 2) % PEN.length], -0.45));
    }
  }
}
function paintCamera(c, x, y) {
  R(c, x, y, 16, 10, '#20232a'); R(c, x + 1, y + 1, 14, 3, '#4a4e5a'); R(c, x - 6, y + 3, 7, 5, '#20232a'); R(c, x - 6, y + 4, 2, 3, '#5fd7ff');
  R(c, x + 7, y + 10, 2, 16, '#3a3a44'); R(c, x + 1, y + 26, 14, 2, '#3a3a44');
  R(c, x + 12, y + 2, 2, 2, '#ff3b4f');
}
function paintCake(c, x, y, t) {
  R(c, x - 2, y + 14, 28, 2, '#8a8a9a');
  R(c, x, y + 4, 24, 10, '#5a3a2a'); R(c, x + 1, y + 4, 22, 9, '#fff4e6'); R(c, x + 1, y + 9, 22, 2, '#ff9ab8');
  R(c, x + 1, y + 4, 22, 1, '#ffffff');
  for (let i = 0; i < 4; i++) {
    const cx = x + 4 + i * 5;
    R(c, cx, y, 1, 4, i % 2 ? '#5fd7ff' : '#ffd23f');
    if ((Math.floor(t / 6) + i) % 3) R(c, cx, y - 2, 1, 2, '#ff8a3d'); else R(c, cx, y - 3, 1, 3, '#ffd23f');
  }
  R(c, x + 4, y + 5, 3, 3, '#e8384f'); R(c, x + 17, y + 5, 3, 3, '#e8384f');
}

async function withCelebration(g, o, fn) {
  const sc = new CelebrationScene(g, o);
  await g.fadeOut(12);
  g.push(sc);
  await g.fadeIn(12);
  audio.sfx('fanfare');
  try {
    await fn();
  } finally {
    await g.fadeOut(12);
    g.pop(sc);
    await g.fadeIn(12);
  }
}

async function kanParty(g) {
  const fl = g.state.flags;
  if (fl.career_kanParty) return;
  fl.career_kanParty = g.state.day;
  const r = REGULARS[KAN];
  const k = kanStudio().kansai;
  const host = { name: r.host, look: r.hostLook };
  await withCelebration(g, { kind: 'kanmuri', title: r.title, host: r.host, hostLook: r.hostLook }, async () => {
    await g.say('パーン！\n（くす玉が割れて、紙ふぶきがスタジオいっぱいに舞った！）');
    await g.say(k
      ? ['{name}さん、初回の収録おつかれさんでした！', 'スタッフみんなで「最高のスタートや」て言うてますわ。', 'これ、番組からの記念のトロフィーです。受け取ってください！']
      : ['{name}さん、初回の収録おつかれさまでした！', 'スタッフ一同、最高のスタートだと思っています。', 'これ、番組からの記念のトロフィーです。受け取ってください！'], host);
    g.giveItem('career_kan_trophy', 1, true);
    g.addNeed('stress', -25);
    audio.sfx('applause');
    await g.say(['（冠番組の記念トロフィーをもらった！）', '（自分の名前がついた番組…。夢みたいだ。\nこれからも毎週、全力で届けよう！）']);
  });
  g.message({ from: r.host, look: r.hostLook, kind: 'chat', read: true, text: g.fmt(`『${r.title}』、これから毎週よろしくお願いします！\n収録は毎週${WEEKDAYS[r.weekday]}曜、${placeName(r.place)}です。`) });
}

async function fanMeetParty(g) {
  const f = g.state.flags.career_fm;
  if (!f || f.state === 'done') return;
  f.state = 'done';
  f.doneDay = g.state.day;
  const fanLook = { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' };
  await withCelebration(g, { kind: 'fanmeet', big: !!f.big }, async () => {
    await g.say(['（会場いっぱいのファンが、ペンライトをふっている…！）', '（最後は、みんなで記念撮影！）']);
    await g.say(['{name}〜！ありがとう〜！！', 'これからも、ずっと応援してるからね！'], { name: 'ファンのみんな', look: fanLook });
    g.giveItem('career_fm_photo', 1, true);
    g.addNeed('stress', -30);
    audio.sfx('applause');
    await g.say('（ファンのみんなとの集合写真をもらった！\nこの笑顔のために、もっとがんばろう）');
  });
}

// ======================================================================== missed shows (morning)
// The engine (life.js morning) reminds you of a missed recording and drops a show missed
// twice, in plain standard Japanese. For our shows, rewrite those messages of this morning
// in the host's own voice, with the host's face and what it cost.
function missLines(id, r, drop) {
  const meta = SHOW_META[id] || {};
  const kansai = id === KAN ? kanStudio().kansai : meta.kansai;
  const day = mediumOf(id) === 'stage' ? '本番の日' : '収録日';
  const what = mediumOf(id) === 'stage' ? '本番' : '収録';
  const t = r.title;
  if (meta.voice === 'hakase') {
    return drop
      ? `『${t}』を続けて休んでしまったからのう…。\n残念じゃが、塾生は卒業ということにさせてもらうぞ。またいつでも遊びに来なさい。`
      : `{name}くん、昨日は『${t}』の収録日じゃったぞ。\n塾生が来んと、さびしいのう。来週は必ず来るんじゃぞ。`;
  }
  if (kansai) {
    return drop
      ? `『${t}』、続けて休んでもうたから、レギュラーは降板ということになってしもた…。\nまたいつか、一緒にやろな。`
      : `{name}さん、昨日は『${t}』の${day}やったで！\nみんな心配しとったわ。来週は頼むで。`;
  }
  return drop
    ? `『${t}』の${what}を続けて休んでしまったので、残念ですが、レギュラーは降板ということになりました…。\nまたいつか、一緒にお仕事しましょう。`
    : `{name}さん、昨日は『${t}』の${day}でしたよ！\nみんな心配していました。来週は必ず来てくださいね。`;
}
function missMorning(g) {
  const st = g.state;
  for (const m of st.phone.inbox) {
    if (m.day !== st.day) break; // newest first: only this morning's
    if (m.kind !== 'news' || m.career || m.look) continue;
    for (const id of [...SHOW_IDS, KAN]) {
      const r = REGULARS[id];
      if (!r || m.from !== (r.host || 'プロデューサー') || !String(m.text).includes(`『${r.title}』`)) continue;
      const drop = String(m.text).includes('降板');
      m.text = g.fmt(missLines(id, r, drop) + `\n（知名度 -${Math.round(num(r.fame) / 2)}）`);
      m.look = r.hostLook;
      m.career = 1;
      break;
    }
  }
}

// ======================================================================== offers (morning)
const MAX_SHOWS = 4; // regular shows held at once (the 冠番組 does not count)
const OFFER_GAP = 28; // days before a show is offered again (declined / dropped)
const KAN_GAP = 7; // the 冠番組, declined: offered again a week later (dropped: OFFER_GAP)
const OFFER_EVERY = 3; // days between two regular-show offers
const KAN_FAME = 1200, KAN_FANS = 8000; // the 冠番組 is offered from here
function pendingOffer(st, id) {
  return st.phone.inbox.some((m) => m.kind === 'offer' && m.regular === id && !m.answered);
}
function offerable(g, id) {
  const st = g.state;
  const offers = obj(g, 'career_offers');
  if (isActive(st, id) || pendingOffer(st, id)) return false;
  if (offers[id] && st.day - offers[id] < OFFER_GAP) return false;
  const s = st.regulars[id];
  if (s && s.declined && st.day - s.declined < OFFER_GAP) return false;
  return g.checkRequires(REGULARS[id].requires) === null;
}
function kanEligible(g) {
  const st = g.state;
  if (st.fame < KAN_FAME || st.fans < KAN_FANS) return false;
  const offers = obj(g, 'career_offers');
  if (isActive(st, KAN) || pendingOffer(st, KAN)) return false;
  // dropped from it (missed twice): a long break; only declined: a week
  const s = st.regulars[KAN];
  const gap = s && s.dropped && s.since != null ? OFFER_GAP : KAN_GAP;
  return !(offers[KAN] && st.day - offers[KAN] < gap);
}
function sendOffer(g, id) {
  const st = g.state;
  obj(g, 'career_offers')[id] = st.day;
  st.flags.career_offerDay = st.day;
  const r = REGULARS[id];
  let text;
  if (id === KAN) {
    const k = kanStudio().kansai;
    const wd = `毎週${WEEKDAYS[r.weekday]}曜`;
    // the agencies' own 冠 shows (よしもとの公開収録 / 松竹の冠ラジオ) may already exist
    const again = num(st.jobs && st.jobs.yoshimoto_kanmuri) > 0 || !!st.flags.shochiku_kanmuri_started;
    if (again) {
      text = k
        ? `{name}さん、また大きな話が来ましたで！\n今度はゴールデンタイムに、{name}さんの名前がついた新番組『${r.title}』を、${wd}にスタートさせたいんです。\n番組の顔として、引き受けてもらえませんか？`
        : `{name}さん、また大きなお話です！\n今度はゴールデンタイムに、{name}さんの名前がついた新番組『${r.title}』を、${wd}にスタートさせたいんです。\n番組の顔として、引き受けてもらえませんか？`;
    } else {
      text = k
        ? `{name}さん、ついにこの日が来ましたで！\nあなたの名前がついた冠番組『${r.title}』を、${wd}にスタートさせたいんです。\n番組の顔として、引き受けてもらえませんか？`
        : `{name}さん、ついにこの日が来ました！\nあなたの名前がついた冠番組『${r.title}』を、${wd}にスタートさせたいんです。\n番組の顔として、引き受けてもらえませんか？`;
    }
  } else text = r.offer;
  g.message({ from: r.host, look: r.hostLook, kind: 'offer', regular: id, text: g.fmt(text) });
}
// The 冠番組's shape is fixed when it is offered: the studio of your agency, the kind of
// show you are best at, and the first weekday from tomorrow on without your other shows
// or a planned fan meeting (so the first recording is never far off; answering late only
// moves the start to the next week, it never counts as a miss).
function setupKan(g) {
  const st = g.state;
  const busy = new Set(activeShows(st).map((id) => REGULARS[id].weekday));
  const f = fmCfg(st);
  if (f && f.state === 'planned' && f.day >= st.day) busy.add(weekdayOf(f.day));
  let wd = null;
  for (let k = 1; k < 8 && wd == null; k++) if (!busy.has(weekdayOf(st.day + k))) wd = weekdayOf(st.day + k);
  st.flags.career_kan = { wd: wd ?? 6, kind: bestSkill(st), studio: st.agency && KAN_STUDIOS[st.agency] ? st.agency : 'none' };
}
// A show you were dropped from (missed twice) counts as offered on the day it was
// dropped: it is not offered again within OFFER_GAP days either.
function noteDrops(g) {
  const st = g.state;
  const offers = obj(g, 'career_offers');
  const drops = obj(g, 'career_drops');
  for (const id of [...SHOW_IDS, KAN]) {
    const s = st.regulars[id];
    if (s && s.dropped && s.since != null && drops[id] !== s.since) { drops[id] = s.since; offers[id] = st.day; }
  }
}
function offerMorning(g, out) {
  const st = g.state;
  noteDrops(g);
  if (out.sent >= 2) return; // a busy morning: tomorrow
  // the 冠番組 does not wait for the regular shows' turn
  if (kanEligible(g)) {
    setupKan(g);
    sendOffer(g, KAN);
    out.sent++;
    return;
  }
  if (st.day - num(st.flags.career_offerDay, -99) < OFFER_EVERY) return;
  // shows you hold + fresh offers you have not answered yet (older ones no longer count)
  const fresh = st.phone.inbox.filter((m) => m.kind === 'offer' && !m.answered && SHOW_IDS.includes(m.regular) && st.day - num(m.day) < 14).length;
  if (activeShows(st).length + fresh >= MAX_SHOWS) return;
  const cands = SHOW_IDS.filter((id) => REGULARS[id] && offerable(g, id));
  if (!cands.length) return;
  // shows that fit you first: your agency's, your best skill's, the higher tier, a free
  // weekday, then random
  const best = bestSkill(st);
  const busy = new Set(activeShows(st).concat(isActive(st, KAN) || pendingOffer(st, KAN) ? [KAN] : []).map((id) => REGULARS[id].weekday));
  const f = fmCfg(st);
  if (f && f.state === 'planned' && f.day >= st.day) busy.add(weekdayOf(f.day));
  const score = {};
  for (const id of cands) {
    const r = REGULARS[id];
    const ag = AGENCIES[st.agency] && r.place === st.agency ? 3 : 0;
    score[id] = ag + (r.skill === best ? 2 : 0) + (SHOW_META[id].tier || 1) * 2 - (busy.has(r.weekday) ? 3 : 0) + Math.random();
  }
  cands.sort((a, b) => score[b] - score[a]);
  sendOffer(g, cands[0]);
  out.sent++;
}

// ======================================================================== fans: milestones, letters, fan meeting
const MILESTONES = [1000, 5000, 20000, 50000, 100000, 300000];
function giftIf(g, id, n = 1) {
  if (!ITEMS[id]) return '';
  g.giveItem(id, n, true);
  return ITEMS[id].name + (n > 1 ? ` ×${n}` : '');
}
function milestoneMorning(g, out) {
  const st = g.state;
  const fl = st.flags;
  const ms = obj(g, 'career_fanMs');
  // a save that already has many fans: only the highest milestone gets a message
  if (!fl.career_fanInit) {
    fl.career_fanInit = st.day;
    const reached = MILESTONES.filter((m) => st.fans >= m);
    reached.slice(0, -1).forEach((m) => { if (m !== 20000 && m !== 100000) ms[m] = st.day; });
  }
  for (const m of MILESTONES) {
    if (ms[m] || st.fans < m) continue;
    if (out.sent >= 2) return;
    // a fan meeting can only be planned when none is pending
    if ((m === 20000 || m === 100000) && fmCfg(st) && fmCfg(st).state === 'planned') continue;
    ms[m] = st.day;
    sendMilestone(g, m);
    out.sent++;
    return; // one milestone per morning
  }
}
function sendMilestone(g, m) {
  const st = g.state;
  const club = st.fans >= 5000 && m > 5000 ? 'ファンクラブ事務局' : 'ファンのみんな';
  const fanLook = { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' };
  if (m === 1000) {
    const gift = giftIf(g, 'cake');
    g.message({ from: 'ファンのみんな', kind: 'fan', look: fanLook, text: g.fmt(`{name}さん、ファン1,000人突破おめでとう！\nみんなでお金を出しあって、お祝いのケーキを選びました。\nこれからも応援してます！${gift ? `\n（${gift}をもらった）` : ''}`) });
  } else if (m === 5000) {
    const a = giftIf(g, 'hanataba'), b = giftIf(g, 'okashi');
    const got = [a, b].filter(Boolean).join('と');
    g.message({ from: 'ファンクラブ事務局', kind: 'fan', look: fanLook, text: g.fmt(`ファン5,000人突破、おめでとうございます！\nこのたび、{name}さんの公式ファンクラブが発足しました。\n会員一同より、お祝いを贈ります。${got ? `\n（${got}をもらった）` : ''}`) });
  } else if (m === 20000) {
    scheduleFanMeet(g, false);
  } else if (m === 50000) {
    g.addMoney(50000, true);
    const p = giftIf(g, 'plushie');
    g.message({ from: club, kind: 'fan', look: fanLook, text: g.fmt(`ファン5万人突破、おめでとうございます！\n記念グッズの「{name}ぬいぐるみ」が、発売初日に完売しました！\nグッズの売上から、お祝い金をお送りします。\n（¥50,000${p ? `と${p}` : ''}をもらった）`) });
    g.notify('ファン5万人突破！ +¥50,000', { color: COLORS.pink });
  } else if (m === 100000) {
    scheduleFanMeet(g, true);
    g.addMoney(100000, true);
    const a = giftIf(g, 'accessory');
    g.message({ from: club, kind: 'fan', look: fanLook, text: g.fmt(`ファン10万人突破、おめでとうございます！\n会員のみんなで寄せ書きをつくりました。\nささやかですが、お祝い金もどうぞ。\n（¥100,000${a ? `と${a}` : ''}をもらった）`) });
    g.notify('ファン10万人突破！ +¥100,000', { color: COLORS.pink });
  } else if (m === 300000) {
    g.addMoney(300000, true);
    g.giveItem('career_fan_plaque', 1, true);
    g.message({ from: 'ドット芸能ニュース', kind: 'news', text: g.fmt(`【ファン30万人突破】\n{name}さんのファンが30万人をこえ、社会現象に！\nファンクラブからは記念の盾が贈られました。\n（ファン30万人の記念盾と¥300,000をもらった）`) });
    g.notify('ファン30万人突破！', { color: COLORS.pink });
  }
}

// Fan letters: now and then (more with more fans), at most one per morning. Letters about
// TV / radio wait until you have been on it (c.tv / c.radio); early ones remember the
// first small jobs (did(st, ids)).
const did = (st, ids) => ids.some((id) => num(st.jobs && st.jobs[id]) > 0);
const LETTERS = [
  { t: 'はじめてお手紙を書きます。テレビで{name}さんを見て、一目でファンになりました！\nこれからも応援しています。', s: '北国のみかん箱', need: (st, c) => c.tv },
  { t: '{name}さんへ。仕事でへこんだ日に{name}さんを見て、大笑いしました。\n明日もがんばれそうです。', s: '会社員・夜ふかしペンギン' },
  { t: '{name}さん、だいすき！\nおおきくなったら、{name}さんみたいになりたいです。', s: 'ゆうた（5さい）・ママ代筆' },
  { t: '孫に教えてもらって、{name}さんを知りました。\nテレビの前で、毎週ふたりで応援しています。お体に気をつけてね。', s: 'ドット町のおばあちゃん', need: (st, c) => c.tv },
  { t: '{name}さんのモノマネをしたら、クラスで大ウケしました。\n勝手にすみません！', s: '高校1年・ものまね修行中' },
  { t: 'うちの犬が、テレビに{name}さんが映るとしっぽをふります。\n犬にも人気です！', s: '柴犬こむぎの飼い主', need: (st, c) => c.tv },
  { t: '受験勉強の休けいに{name}さんの番組を見るのが、毎日のごほうびです。\n春までがんばります！', s: '受験生・はちみつ', need: (st, c) => c.tv },
  { t: 'きのう、ゆめに{name}さんがでてきました。\nいっしょに、おにぎりをたべました。', s: 'りこ（7さい）' },
  { t: 'バイト先のラジオで{name}さんの声が流れて、思わず手が止まりました。\n店長にはバレずにすみました。', s: 'コンビニ店員・ドット', need: (st, c) => c.radio },
  { t: 'いつも全力の{name}さんを見て、わたしも、もう一度夢を追いかけることにしました。', s: '元・役者志望のサラリーマン' },
  { t: '{name}さんの笑顔を見ると、なぜか肩こりが治ります。\n医学的にはわかりませんが、本当です。', s: 'ドット整骨院の院長' },
  { t: '家族4人、好きな芸能人がバラバラなのに、{name}さんだけは全員一致です！', s: 'ドット家一同', need: (st) => st.fame >= 250 },
  // the first small jobs (while still on the way up)
  { t: '公園で{name}さんの路上ライブを見ました！\n足を止めたのは、わたしが最初のひとりだったかも。', s: 'いつもの散歩道・たんぽぽ', need: (st) => st.fame < 500 && did(st, ['street_tsukkomi', 'street_rhythm']) },
  { t: '劇場の前説で{name}さんを見ました。\n本番の前から笑いすぎて、ちょっと疲れました（笑）', s: '劇場通いの大学生・ぽてと', need: (st) => st.fame < 500 && did(st, ['yoshimoto_maesetsu']) },
  { t: 'グレープカンパニーのストアの前で、{name}さんの呼び込みダンスを見ました！\nつられて、わたしも踊っちゃいました。', s: '買い物帰りのOL・すだち', need: (st) => st.fame < 500 && did(st, ['grape_store_help']) },
  // congratulations: only within a few days of the new title / joining the agency
  { t: '「{title}」の称号、おめでとうございます！\nずっと前から応援してたので、自分のことみたいにうれしいです。', s: '古参ファン・ぽんず', need: (st, c) => st.fame >= 100 && c.newTitle },
  { t: '{agency}所属、おめでとうございます！\nこれからの活躍、楽しみにしています！', s: 'ドット駅前の本屋さん', need: (st, c) => !!st.agency && c.newAgency },
  { t: '『{show}』毎週見てます！\n{wd}曜日が、一週間でいちばんの楽しみです。', s: '録画もしてる・さくら', need: (st, c) => c.medium === 'tv' },
  { t: '『{show}』の{name}さん、最高でした！\n毎週、家族みんなでテレビの前に集合しています。', s: 'テレビっ子のドット家', need: (st, c) => c.medium === 'tv' },
  { t: '『{show}』、毎週聞いてます！\n{name}さんの声を聞くと、一週間の疲れがふっとびます。', s: 'ラジオネーム・夜ふかしの月', need: (st, c) => c.medium === 'radio' },
  { t: '『{show}』に、はじめてハガキを出しました！\n読まれたら、家族に自慢します。', s: 'ラジオネーム・はがき職人見習い', need: (st, c) => c.medium === 'radio' },
  { t: '『{show}』、劇場で見ました！\n生の{name}さん、本当にキラキラしてました。また見に行きます！', s: '観劇が趣味・すずらん', need: (st, c) => c.medium === 'stage' },
  { t: 'ドッターの投稿、毎日の楽しみです！\nごはんの話がいつもおいしそうで、つい夜食を食べちゃいます。', s: '夜型のくま', need: (st) => num(st.phone.posts) >= 3 },
  { t: '大阪から応援してます！\nなんばに来たら、たこ焼き食べていってや〜！', s: 'なんばのたこ焼き好き', need: (st) => !!(st.flags.visited && st.flags.visited.namba) },
  { t: '{partner}さんとのコンビ、最高です！\nふたりのかけ合いが大好き！', s: 'お笑い大好き・まめ', need: (st, c) => !!c.partner },
  { t: 'ファンクラブの会報、宝物にしています！\n表紙の{name}さんを、額に入れて飾りました。', s: 'ファンクラブ会員・ことり', need: (st) => st.fans >= 5000 },
];
// Has the public seen you on TV / radio yet? (a recorded show of that medium, a job of
// that kind from the notebook's job list; on TV also: every ★250 job is on air somewhere)
const MEDIA_RE = { tv: /^(?!.*ラジオ).*(番組|CM|ドラマ|映画|テレビ|アフレコ|クイズ|リポーター|食レポ)/, radio: /ラジオ/ };
function seenOn(st, medium) {
  const jobs = st.jobs || {};
  if (Object.keys(jobs).some((k) => k.startsWith('regular_') && num(jobs[k]) > 0 && REGULARS[k.slice(8)] && mediumOf(k.slice(8)) === medium)) return true;
  if (medium === 'tv' && st.fame >= 250) return true;
  const re = MEDIA_RE[medium];
  return !!re && (Guide.GUIDE_JOBS || []).some((j) => re.test(j.label || '') && Array.isArray(j.ids) && did(st, j.ids));
}
function letterMorning(g, out) {
  const st = g.state;
  const L = obj(g, 'career_letters');
  // remember when the title / the agency last changed (congratulation letters)
  const rk = rankIndex(st.fame), ag = st.agency || '';
  if (L.rank !== rk) { if (L.rank != null && rk > L.rank) L.rankDay = st.day; L.rank = rk; }
  if (L.agency !== ag) { if (L.agency != null && ag) L.agencyDay = st.day; L.agency = ag; }
  if (out.sent >= 2 || st.fans < 50) return;
  const p = clamp(0.1 + 0.07 * Math.log10(st.fans), 0, 0.5);
  if (Math.random() >= p) return;
  if (L.day === st.day) return;
  // only shows that have been on (not one whose first recording is still ahead)
  const shows = activeShows(st).concat([KAN]).filter((id) => aired(st, id));
  const sh = shows.length ? pick(shows) : null;
  const P = st.partner && PEOPLE[st.partner];
  const ctx = {
    show: sh ? REGULARS[sh].title : '', wd: sh ? WEEKDAYS[REGULARS[sh].weekday] : '', medium: sh ? mediumOf(sh) : '',
    tv: seenOn(st, 'tv'), radio: seenOn(st, 'radio'),
    partner: P ? P.short || P.name : '',
    newTitle: st.day - num(L.rankDay, -99) <= 6, newAgency: st.day - num(L.agencyDay, -99) <= 6,
  };
  const recent = Array.isArray(L.recent) ? L.recent : [];
  const ok = LETTERS.map((l, i) => i).filter((i) => (!LETTERS[i].need || LETTERS[i].need(st, ctx)) && !recent.includes(i));
  if (!ok.length) { L.recent = []; return; }
  const i = pick(ok);
  L.recent = [...recent, i].slice(-8);
  L.day = st.day;
  L.count = num(L.count) + 1;
  const l = LETTERS[i];
  let body = l.t.replaceAll('{show}', ctx.show).replaceAll('{wd}', ctx.wd).replaceAll('{partner}', ctx.partner)
    .replaceAll('{title}', RANKS[rankIndex(st.fame)][1]);
  let gift = '';
  if (Math.random() < 0.15) gift = giftIf(g, pick(['cake', 'tea', 'okashi', 'manga', 'onigiri']));
  g.message({ from: 'ファンレター', kind: 'fan', text: g.fmt(`${body}\n― ${l.s}${gift ? `\n（手紙といっしょに、${gift}が入っていた）` : ''}`) });
  out.sent++;
}

// ======================================================================== weekly ranking
const RIVALS = [
  '白鳥ルミナ', '大河原ツバサ', '桃瀬あんず', 'すずめ百貨店', '風見ケイタ', '雪村しずく', '黒潮ゴロー', '天城コハル', 'ミルクティー同盟', '真夜中ペンギンズ',
  '鳴海タクト', '南野マリン', '森乃くまお', '青空ハイウェイ', '藤咲レイナ', 'こたつむり', '早乙女ジョー', '星屑シスターズ', 'ドット山ピク太', '浪花のマダム千鶴',
  '御影リョウ', 'ナポリタン親方', '小野寺みのり', 'カスタードプリンス', '真壁ソウジ', 'ゆるふわ団地', '春風ひまり', '鉄板ジュンペイ', '朝凪カオル', 'ピコピコ博士',
  '銀河ステーション', '若葉のぞみ', 'たこやきガールズ', '千本木リク', 'おかわり侍', '水無月セナ', '草野ぽぽ', '月見ボーイズ', '紅林アキラ', '七色クレヨン',
  '田中ドット', '西園寺ミレイ', '宇宙ねこ団', '一番星ヨシオ', 'くるみ割り', '柚木サラ', '三日月ポテト', '東雲ハヤト', 'しらたまパフェ', '大入りガッツ',
];
// No.1 is in reach late game (about ★3500 with a 冠番組, regular shows and a busy week)
const RIVAL_TOP = 6400, RIVAL_STEP = 0.93;
const rivalScore = (i, week) => RIVAL_TOP * RIVAL_STEP ** i * (1 + 0.07 * (hash2(i, week, 11) * 2 - 1));
// recordings of regular shows so far (g.doRegular logs each as the job 'regular_<id>'; unlike
// regulars[id].count this never resets when a show is joined again)
const totalRecorded = (st) => Object.keys(st.jobs || {}).filter((k) => k.startsWith('regular_') && k !== 'regular_' + FANMEET).reduce((a, k) => a + num(st.jobs[k]), 0);
function weekSnapshot(g) {
  const st = g.state;
  return { week: g.week, jobs: num(st.stats.jobs), posts: num(st.phone.posts), regs: totalRecorded(st) };
}
// Score from fame, fans, last week's work, regular shows (and the 冠番組).
function playerScore(g, d) {
  const st = g.state;
  return st.fame + st.fans * 0.02 + d.jobs * 30 + d.regs * 60 + activeShows(st).length * 80 + (aired(st, KAN) ? 400 : 0) + Math.min(7, d.posts) * 15;
}
export function weeklyRanking(g, d) {
  const week = g.week;
  const me = playerScore(g, d);
  const list = RIVALS.map((name, i) => ({ name, score: rivalScore(i, week) }));
  list.push({ name: g.state.name, score: me, me: true });
  list.sort((a, b) => b.score - a.score);
  const rank = list.findIndex((x) => x.me) + 1;
  return { list, rank, score: me };
}
function rankingMorning(g, out) {
  const st = g.state;
  const fl = st.flags;
  const prev = fl.career_rank && typeof fl.career_rank === 'object' ? fl.career_rank : null;
  if (g.weekday !== 0) { if (!prev) fl.career_rank = { ...weekSnapshot(g), rank: 0, best: 0 }; return; }
  if (prev && prev.week === g.week) return; // already this Monday
  const now = weekSnapshot(g);
  const d = prev
    ? { jobs: Math.max(0, now.jobs - num(prev.jobs)), posts: Math.max(0, now.posts - num(prev.posts)), regs: Math.max(0, now.regs - num(prev.regs)) }
    : { jobs: Math.min(20, now.jobs), posts: Math.min(7, now.posts), regs: 0 };
  const { list, rank } = weeklyRanking(g, d);
  const last = prev ? num(prev.rank) : 0;
  const best = prev && num(prev.best) ? Math.min(num(prev.best), rank) : rank;
  fl.career_rank = { ...now, rank, best };
  const LIMIT = 50;
  const lines = ['【今週のタレント好感度ランキング】'];
  const row = (i) => `${i + 1}位　${list[i].me ? `★${list[i].name}` : list[i].name}`;
  for (let i = 0; i < 3; i++) lines.push(row(i));
  if (rank <= LIMIT) {
    if (rank > 5) lines.push('　　…');
    for (let i = Math.max(3, rank - 2); i <= Math.min(list.length - 1, rank); i++) lines.push(row(i));
    const wasIn = prev && num(prev.best) && num(prev.best) <= LIMIT;
    const move = !last || last > LIMIT ? (wasIn ? 'ランクイン復帰！' : '初ランクイン！') : last > rank ? `先週から${last - rank}ランクアップ！` : last < rank ? `先週から${rank - last}ランクダウン…` : '先週と同じ順位';
    lines.push(`{name}は${rank}位！（${move}）`);
  } else {
    lines.push('　　…');
    lines.push(`{name}は${LIMIT}位圏外…。\nお仕事やレギュラー番組、ドッターで、まずはランクインを目指そう！`);
  }
  if (rank <= LIMIT) {
    const why = aired(st, KAN) ? '冠番組が好調！' : d.regs >= 2 ? 'レギュラー番組での安定感が評価されています。' : d.jobs >= 15 ? 'お仕事の多さが話題に！' : st.fans >= 20000 ? 'ドッターでの人気がすごい！' : d.posts >= 5 ? '毎日の投稿で、親しみやすさアップ！' : '';
    if (why) lines.push(`コメント：${why}`);
  }
  g.message({ from: 'ドット芸能ニュース', kind: 'news', text: g.fmt(lines.join('\n')) });
  out.sent++;
  if (rank === 1 && !fl.career_no1) {
    fl.career_no1 = st.day;
    g.giveItem('career_no1_badge', 1, true);
    g.addFans(Math.round(st.fans * 0.05), true);
    g.message({ from: 'ドット芸能ニュース', kind: 'news', text: g.fmt('【速報】{name}さん、タレント好感度ランキングで初の1位に！\n街の声「元気をもらえる」「家族みんなで好き」\n（記念のバッジが届いた！）') });
    g.notify('好感度ランキング1位！', { color: COLORS.accent });
  } else if (rank <= 10 && !fl.career_top10 && out.sent < 3) {
    fl.career_top10 = st.day;
    g.message({ from: 'ファンレター', kind: 'fan', text: g.fmt(`ランキング${rank}位、見ました！トップ10入り、おめでとう！\n次はてっぺんだね！\n― ファン一同`) });
  }
}

// ======================================================================== SNS app ドッター
const DOT = {
  color: '#17a398', dark: '#0b5e57', light: '#dff4f0', bg: '#f4f1e8', card: '#ffffff', line: '#dcd5c4',
  text: '#2a2a3a', dim: '#7c7a88', heart: '#ff5d8f', rt: '#2f9a4a', warn: '#e07a1f', good: '#2f9a4a', coral: '#ff6b4a',
};
const TOPICS = {
  work: { label: '今日のお仕事', desc: 'お仕事の感想をつぶやこう。お仕事をした日は、ファンが多めに増える。' },
  food: { label: 'ごはん', desc: '今日食べたものを投稿しよう。' },
  off: { label: 'オフの日', desc: 'のんびりした話を投稿しよう。お仕事のない日なら、ストレスが大きく減る。' },
  promo: { label: '告知', desc: 'レギュラー番組を宣伝しよう。ファンが大きく増える。' },
  fix: { label: '誤解をとく', desc: 'あの投稿、誤解されてる…！ちゃんと説明して、みんなを安心させよう。' },
};
// Post texts: t = text, r = replies that only fit this text (topic replies are added).
const POST_TEXT = {
  workJob: [
    { t: '今日は「{job}」のお仕事でした！\n現場のみなさん、ありがとうございました。' },
    { t: '「{job}」、無事に終わりました！\nまだまだ勉強の毎日です。がんばります★', r: ['勉強熱心なところ、尊敬します！'] },
    { t: '今日の「{job}」は、緊張したけど楽しかった！\n見守ってくれたスタッフさんに感謝です。', r: ['緊張してるように見えなかったよ！'] },
    { t: '「{job}」のお仕事、おわりました〜！\n帰りの電車で、もう反省会してます（笑）', r: ['反省会してるの、えらい…！', '今日はもう休んで〜！'] },
  ],
  // a job whose name is not known (content from other modules)
  workAny: [
    { t: '今日のお仕事、無事に終わりました！\n現場のみなさん、ありがとうございました。' },
    { t: 'お仕事おわり〜！\n帰りの電車で、もう反省会してます（笑）', r: ['反省会してるの、えらい…！', '今日はもう休んで〜！'] },
  ],
  // a regular show recorded today, by how it reaches people
  workShow_tv: [
    { t: '『{show}』の収録でした！\nオンエア、ぜひ見てくださいね♪', r: ['録画予約しました！'] },
    { t: '『{show}』収録おわり！\n今週も、いい回になったと思います★', r: ['毎週の楽しみです！'] },
  ],
  workShow_radio: [
    { t: '『{show}』の収録でした！\nオンエア、ぜひ聞いてくださいね♪', r: ['リアタイで聞きます！'] },
    { t: '『{show}』収録おわり！\nハガキをくれたみなさん、いつもありがとう！', r: ['次こそ読まれたい…！'] },
  ],
  workShow_stage: [
    { t: '『{show}』、今日の本番おわりました！\n客席のみなさん、ありがとう！', r: ['今日見に行きました！最高だった！'] },
    { t: '『{show}』本番終了！\n毎回ちがうお客さんの笑顔が見られて、しあわせです。', r: ['次こそチケット取りたい！'] },
  ],
  workShow_event: [
    { t: '{show}、来てくれたみんな、ありがとう！\n最高の一日でした！', r: ['今日、会場にいました！一生の思い出！'] },
  ],
  workNone: [
    { t: '今日はお仕事おやすみ。\n家で自主練してました！', r: ['休みの日も練習してるの、えらい！'] },
    { t: '今日は台本とにらめっこの一日。\n本番に向けて、こっそり特訓中です。', r: ['特訓の成果、楽しみにしてます！'] },
    { t: 'お仕事のない日は、ネタ帳を書く日。\n今日は3ページ書けました！', r: ['3ページもすごい！', 'そのネタ、早く見たい〜！'] },
  ],
  food: [
    { t: 'ロケ弁のからあげが、今日もおいしかった！\n現場のごはんって、なんで元気が出るんだろう。', r: ['ロケ弁、一度食べてみたい！', 'おいしそう〜！おなかすいてきた'] },
    { t: 'ラーメン屋さんで、替え玉までいっちゃいました。\nしあわせの味がする…！', r: ['替え玉は正義', 'どこのお店か気になる〜！', 'おいしそう〜！おなかすいてきた'] },
    { t: '自炊にチャレンジ！\nちょっと焦げたけど、それも味ってことで♪', r: ['焦げも味！わかる〜', '自炊えらい！'] },
    { t: '差し入れのたい焼き、しっぽまであんこ入りでした！', r: ['しっぽまであんこは神', 'たい焼きは頭から派です！'] },
    { t: '朝ごはんは、おにぎり2個。\nシンプルが一番！', r: ['具は何派ですか？', 'わたしも明日おにぎりにしよ'] },
    { t: 'たこ焼きって、なんで大阪で食べると味がちがう気がするんだろう？', r: ['大阪の味、あると思います！', 'なんばで食べたら最高やで〜'] },
    { t: 'ファミレスのドリンクバーで、オリジナルミックスを開発しました。\n名前はまだない。', r: ['名前、募集してますか？', '絶対まずいやつ（笑）'] },
  ],
  off: [
    { t: '今日はオフ！\n洗濯して、昼寝して、最高の一日でした。', r: ['理想の休日すぎる'] },
    { t: '公園のベンチでぼーっとしてたら、ハトに囲まれました。', r: ['ハトうらやましい', 'ハトにも人気（笑）'] },
    { t: '銭湯の大きいお風呂で、心までぽかぽか♪', r: ['銭湯いいよね〜', 'お風呂上がりはコーヒー牛乳ですか？'] },
    { t: 'ひさしぶりに一日中マンガを読んでました。\n続きが気になる…！', r: ['なんのマンガか気になる！'] },
    { t: '商店街をお散歩。\nコロッケ屋さんのおばちゃんに元気をもらいました！', r: ['その商店街、わたしの地元です！'] },
    { t: '部屋の片づけをしてたら、デビュー前のネタ帳が出てきました。\n…そっと閉じました。', r: ['見たい！そのネタ帳見たい！', 'そっと閉じた（笑）'] },
  ],
  promo_tv: [
    { t: '【告知】毎週{wd}曜は『{show}』！\n今週もよろしくお願いします★' },
    { t: '今週の『{show}』、見どころいっぱいです！\nぜひチェックしてね♪' },
    { t: '{wd}曜は『{show}』の日！\nみんなの感想、待ってます。', r: ['感想送ります！'] },
  ],
  promo_radio: [
    { t: '【告知】毎週{wd}曜は『{show}』！\nみんなのハガキ、待ってます★' },
    { t: '{wd}曜は『{show}』の日！\n今週も、ゆるっとしゃべります。', r: ['ハガキ書きます！'] },
  ],
  promo_stage: [
    { t: '【告知】毎週{wd}曜は『{show}』の舞台に立ってます！\n劇場でお待ちしてます★' },
    { t: '{wd}曜は『{show}』の本番！\n今週も全力でいきます。', r: ['劇場で応援してます！'] },
  ],
  // a show whose first recording is still ahead
  promo_new: [
    { t: '【お知らせ】『{show}』に、レギュラー出演が決まりました！\n毎週{wd}曜、まもなくスタートです。お楽しみに★' },
    { t: '『{show}』、まもなくスタート！\n毎週{wd}曜です。いまからドキドキしてます…！', r: ['初回、絶対チェックします！'] },
  ],
};
const HANDLES_A = ['mikan', 'pixel', 'dotto', 'hoshi', 'neko', 'tako', 'sakura', 'momo', 'kuma', 'sora', 'yuzu', 'pon', 'mame', 'kotori', 'ichigo', 'nori'];
const HANDLES_B = ['_fan', '_love', '123', '_daisuki', 'chan', '_oshi', '7', '_dot', '_san', '88'];
const handle = () => `@${pick(HANDLES_A)}${pick(HANDLES_B)}`;
// replies that fit any post of the topic
const REPLIES = {
  any: ['いつも応援してます！', '今日も元気もらいました！', 'がんばりすぎないでね〜', '推しが今日も尊い…', 'フォローしててよかった！', 'うちの猫も画面の{name}さんにパンチしてました', '母が{name}さんのファンになりました（父は複雑）'],
  workJob: ['お仕事おつかれさまでした！', 'オンエア絶対見ます！', '{name}さんの出てる番組、家族で見てます'],
  workAny: ['お仕事おつかれさまでした！', '今日もがんばったね！'],
  workShow_tv: ['オンエア絶対見ます！', 'お仕事おつかれさまでした！'],
  workShow_radio: ['オンエア、リアタイします！', 'お仕事おつかれさまでした！'],
  workShow_stage: ['チケット取れたら見に行きます！', 'おつかれさまでした！'],
  workShow_event: ['また会いたいです！', 'ありがとう〜！おつかれさま！'],
  workNone: ['努力してるの、ちゃんと見てるよ！', 'たまには休んでね〜'],
  food: ['飯テロだ…（夜中2時）', 'ごはんの投稿、毎回楽しみ！', 'ちゃんと食べてて、えらい！'],
  off: ['ゆっくり休んでね！', 'オフの日の{name}さん、レアだ…', 'いい休日！明日もがんばろうね'],
  promo_tv: ['録画予約しました！', '毎週の楽しみです！', '{wd}曜が待ち遠しい！', '家族にも宣伝しておきます！', '今週も絶対見る〜！'],
  promo_radio: ['毎週聞いてます！', '{wd}曜が待ち遠しい！', '今週もリアタイします！', '友だちにも宣伝しておきます！'],
  promo_stage: ['チケット取れました！', '劇場で会えるの楽しみ！', '{wd}曜が待ち遠しい！', '友だちと見に行きます！'],
  promo_new: ['おめでとうございます！', 'ついに…！楽しみすぎる！', '{wd}曜が待ち遠しい！', 'みんなに宣伝しておきます！'],
  fix: ['なーんだ、よかった〜！', 'まぎらわしいよ（笑）でも安心した！', '説明ありがとう！これからも推します！', '心配して損した（笑）元気ならOK！'],
};
// harmless misunderstandings, one per topic
const ENJO = {
  work: {
    x: '今日の現場で、思いっきり泣いちゃった…。\nもう、だめかもしれない。',
    rep: ['え、何があったの…！？', 'ゆっくり休んで…（泣）', 'まさか引退とか言わないよね…？'],
    fix: 'きのうの投稿で心配かけてごめんなさい！\n泣いたのはドラマの「泣きのシーン」の話です。監督にほめられて、うれし泣きもしました（笑）',
  },
  food: {
    x: 'ひとりで3人前、ぺろりといっちゃいました。\n止まらない…。',
    rep: ['食べすぎ…！？体だいじょうぶ？', 'ストレスたまってるのかな…', 'ちゃんと寝てる…？'],
    fix: 'みなさん、心配ありがとう！\n「3人前」は、お店の大盛りカレーのサイズの名前でした…。まぎらわしくてごめんなさい！',
  },
  off: {
    x: '今日は一日、だれとも話しませんでした。\nこれからは、ひとりで生きていきます。',
    rep: ['え、元気ないの…？', '何かあったら話してね…', 'ひとりにしないで〜！'],
    fix: 'あの投稿、ちがうんです！\n一日じゅう読書してたら、本の主人公の口ぐせがうつっちゃって…。みんなと話すの、大好きです！',
  },
  promo: {
    x: '【重大発表】\nみなさんに大事なお知らせがあります。\n…今まで、本当にありがとうございました。',
    rep: ['え、やめちゃうの…！？', 'うそだと言って…', '心の準備ができてない'],
    fix: '重大発表、まぎらわしくてごめんなさい！\n「今まで使っていた髪型」に、ありがとうを言いたかっただけです。新しい髪型、どうですか？',
  },
};
function dotter(g) {
  const D = obj(g, 'dotter');
  if (!Array.isArray(D.posts)) D.posts = [];
  if (!D.seq) D.seq = 1;
  return D;
}
export const canPost = (g) => num(g.state.phone.lastPost) !== g.state.day;
const enjoPending = (g) => { const D = g.state.flags.dotter; return !!(D && D.enjo); };
// Jobs done today (job ids), from the snapshot taken in the morning.
function todayJobs(g) {
  const st = g.state;
  const snap = st.flags.career_today;
  // day 1 has no morning: everything done so far was done today
  const map = snap && snap.day === st.day && snap.map ? snap.map : st.day === 1 ? {} : null;
  if (!map) return [];
  return Object.keys(st.jobs).filter((id) => num(st.jobs[id]) > num(map[id]));
}
const workedToday = (g) => todayJobs(g).length > 0;
// The name of a job for a post ('' when it is not known).
function jobLabel(id) {
  if (id.startsWith('regular_')) { const r = REGULARS[id.slice(8)]; return r ? r.title : ''; }
  const list = Guide.GUIDE_JOBS || [];
  const j = list.find((x) => x.ids && x.ids.includes(id));
  return j ? j.label : '';
}
// The show to advertise: today's, else the next one this week, else any.
function promoShow(g) {
  const st = g.state;
  const shows = activeShows(st).concat(isActive(st, KAN) ? [KAN] : []);
  if (!shows.length) return null;
  const wd = g.weekday;
  const key = (id) => (REGULARS[id].weekday - wd + 7) % 7;
  return shows.sort((a, b) => key(a) - key(b))[0];
}
function topicItems(g) {
  const items = [];
  if (enjoPending(g)) items.push({ id: 'fix', label: '誤解をとく', sub: 'あの投稿、ちゃんと説明しよう', rightColor: DOT.warn, right: '！' });
  const jobs = todayJobs(g);
  const jl = jobs.length ? jobLabel(jobs[jobs.length - 1]) : '';
  items.push({ id: 'work', label: TOPICS.work.label, sub: jobs.length ? (jl ? `「${jl}」のこと` : '今日のお仕事のこと') : 'まだお仕事してない日（自主練の話）' });
  items.push({ id: 'food', label: TOPICS.food.label, sub: '今日食べたもの' });
  items.push({ id: 'off', label: TOPICS.off.label, sub: jobs.length ? 'のんびりした話' : 'お休みの日（ストレス大きく減る）' });
  const sh = promoShow(g);
  items.push(sh
    ? { id: 'promo', label: TOPICS.promo.label, sub: `『${REGULARS[sh].title}』を宣伝` }
    : { id: 'promo', label: TOPICS.promo.label, sub: 'レギュラー番組があるときだけ', disabled: true, why: 'レギュラーを持つと告知できる' });
  return items;
}
function fill(g, s, c = {}) {
  return g.fmt(String(s).replaceAll('{job}', c.job || 'お仕事').replaceAll('{show}', c.show || '').replaceAll('{wd}', c.wd || ''));
}
// Draft a post (text + whether it gets misunderstood). topic: work | food | off | promo | fix
export function draftPost(g, topic) {
  const st = g.state;
  const D = dotter(g);
  const jobs = todayJobs(g);
  const shId = promoShow(g);
  const c = { job: jobs.length ? jobLabel(jobs[jobs.length - 1]) : '', show: shId ? REGULARS[shId].title : '', wd: shId ? WEEKDAYS[REGULARS[shId].weekday] : '' };
  if (topic === 'promo' && !shId) topic = 'food';
  if (topic === 'fix' && !D.enjo) topic = 'food';
  if (topic === 'fix') {
    const sc = ENJO[D.enjo.k] || ENJO.food;
    return { k: 'fix', x: g.fmt(sc.fix), e: 'fix', ek: D.enjo.k, c };
  }
  // which set of texts (and replies): work splits into a show / a job / no job today,
  // shows and the promo by how the show reaches people (tv / radio / stage)
  let set = POST_TEXT[topic] ? topic : 'food';
  if (topic === 'work') {
    const shToday = jobs.map((id) => (id.startsWith('regular_') ? id.slice(8) : null)).filter((id) => id && REGULARS[id]);
    if (shToday.length) { set = 'workShow_' + mediumOf(shToday[0]); c.show = REGULARS[shToday[0]].title; } else set = !jobs.length ? 'workNone' : c.job ? 'workJob' : 'workAny';
  } else if (topic === 'promo') set = aired(st, shId) ? 'promo_' + mediumOf(shId) : 'promo_new';
  if (!POST_TEXT[set]) set = topic === 'promo' ? 'promo_tv' : 'food';
  const v = pick(POST_TEXT[set]);
  // a rare, harmless misunderstanding (the work one only on a day with work)
  const lastEnjo = num(D.lastEnjo, -99);
  if (!D.enjo && ENJO[topic] && !(topic === 'work' && !jobs.length) && st.fans >= 1000 && num(st.phone.posts) >= 5 && st.day - lastEnjo >= 20 && Math.random() < 0.07) {
    return { k: topic, x: g.fmt(ENJO[topic].x), e: 'enjo', ek: topic, c };
  }
  // an off-day post on a real day off unwinds more
  return { k: topic, x: fill(g, v.t, c), e: null, c, off: topic === 'off' && !jobs.length, replies: [...(v.r || []), ...(REPLIES[set] || [])] };
}
// Fans from one post: a nice bonus, but below what a recording of your best show brings
// (weekly shows are where fans come from). Grows slowly with fame and fans (no runaway), and is
// capped at 40% of the fans of the best show you hold (or of a ★250 regular).
function fanGain(g, topic, e) {
  const st = g.state;
  const base = 10 + st.fame * 0.12 + Math.sqrt(Math.max(0, st.fans)) * 1.5;
  let m = { work: 1.1, food: 1.0, off: 0.9, promo: 1.5, fix: 1.3 }[topic] || 1;
  if (workedToday(g)) m *= 1.5;
  if (e === 'enjo') m *= 0.4;
  const ref = activeShows(st).concat(isActive(st, KAN) ? [KAN] : []).reduce((a, id) => Math.max(a, num(REGULARS[id].fans)), 900);
  return Math.max(3, Math.min(Math.round(ref * 0.4), Math.round(base * m * rnd(0.85, 1.15))));
}
// Publish a draft: fans, stress, the timeline. Returns { post, gain, stress }.
export function publishPost(g, draft) {
  const st = g.state;
  const D = dotter(g);
  if (!canPost(g)) return null;
  st.phone.lastPost = st.day;
  st.phone.posts = num(st.phone.posts) + 1;
  const gain = fanGain(g, draft.k, draft.e);
  g.addFans(gain, true);
  const stress = draft.e === 'enjo' ? 10 : draft.k === 'fix' ? -15 : draft.off ? -10 : -5;
  g.addNeed('stress', stress);
  const likes = Math.round(st.fans * 0.03 * rnd(0.7, 1.3) + gain * 1.5 + rnd(2, 8));
  // replies: the misunderstanding's, the follow-up's, else two that fit the post + maybe one general
  let pool;
  if (draft.e === 'enjo') pool = shuffled(ENJO[draft.ek].rep);
  else if (draft.k === 'fix') pool = shuffled(REPLIES.fix).slice(0, 3);
  else pool = shuffled(draft.replies || REPLIES.any).slice(0, 2).concat(Math.random() < 0.5 ? [pick(REPLIES.any)] : []);
  const handles = new Set();
  const rep = pool.map((s) => {
    let h = handle();
    for (let i = 0; i < 5 && handles.has(h); i++) h = handle();
    handles.add(h);
    return [h, fill(g, s, draft.c)];
  });
  const post = {
    id: D.seq++, d: st.day, k: draft.k, x: draft.x, f: gain, e: draft.e || null,
    l: likes, r: Math.round(likes * rnd(0.08, 0.18)), c: Math.max(rep.length, Math.round(likes * rnd(0.02, 0.05))), rep,
  };
  D.posts.unshift(post);
  if (D.posts.length > 20) D.posts.length = 20;
  if (draft.e === 'enjo') { D.enjo = { day: st.day, k: draft.ek }; D.lastEnjo = st.day; }
  if (draft.k === 'fix') D.enjo = null;
  return { post, gain, stress };
}
// Post without any UI (tests, other content). Returns the result or null (already posted today).
export function postToDotter(g, topic) {
  if (!canPost(g)) return null;
  return publishPost(g, draftPost(g, topic));
}
function dotterMorning(g, out) {
  const D = g.state.flags.dotter;
  if (!D || !D.enjo || g.state.day - num(D.enjo.day) < 3) return;
  D.enjo = null; // blew over by itself
  if (out.sent < 2) {
    const E = g.state.agency === 'yoshimoto' && PEOPLE.emikawa;
    if (E) g.message({ from: E.name, person: 'emikawa', look: E.look, kind: 'news', text: g.fmt('ドッターのあの投稿、だいぶ落ち着いたみたいですね。\nみんな心配してましたから、言葉には気をつけましょう。…でも、{name}さんらしくて、ぼくは好きですよ。') });
    else if (g.state.agency) g.message({ from: 'マネージャー', kind: 'news', look: LOOKS.manager, text: g.fmt('ドッターのあの投稿、だいぶ落ち着いたみたいですね。\nみんな心配していましたから、言葉には気をつけましょうね。…でも、{name}さんらしくていいと思いますよ。') });
    else g.message({ from: 'ドッター運営チーム', kind: 'news', text: g.fmt('{name}さんの先日の投稿についての話題は、もう落ち着いたようです。\nこれからも、楽しいドッターライフを！') });
    out.sent++;
  }
}

// --- the app's icon (32x32): a speech bubble with a big coral dot
function dotterIcon(c, x, y) {
  if (Phone.appTile) Phone.appTile(c, x, y, DOT.color);
  else { rrect(c, x, y, 32, 32, 7, shade(DOT.color, -0.6)); rrect(c, x + 1, y + 1, 30, 30, 6, DOT.color); }
  const O = '#08403b';
  rrect(c, x + 5, y + 6, 22, 17, 6, O);
  rrect(c, x + 6, y + 7, 20, 15, 5, '#ffffff');
  R(c, x + 8, y + 20, 12, 1, '#cdeee9');
  // tail
  R(c, x + 10, y + 22, 1, 4, O); R(c, x + 11, y + 22, 3, 1, '#ffffff'); R(c, x + 14, y + 22, 1, 1, O);
  R(c, x + 11, y + 23, 2, 1, '#ffffff'); R(c, x + 13, y + 23, 1, 1, O);
  R(c, x + 11, y + 24, 1, 1, '#ffffff'); R(c, x + 12, y + 24, 1, 1, O); R(c, x + 11, y + 25, 1, 1, O);
  // the dot
  disc(c, x + 16, y + 14, 5, '#a8361e');
  disc(c, x + 16, y + 14, 4, DOT.coral);
  R(c, x + 14, y + 12, 2, 2, '#ffc2b0');
  // sparkle
  R(c, x + 25, y + 3, 1, 3, '#ffffff'); R(c, x + 24, y + 4, 3, 1, '#ffffff');
}
// small 9x8 glyphs for the post metrics
const GLYPH = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  rt: ['.####..', '#....#.', '#..#####', '#...###.', '#....#..', '.####...'],
  reply: ['.#####.', '#.....#', '#.....#', '.#####.', '..#....', '.#.....'],
  check: ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'],
};
function glyph(c, name, x, y, col) {
  const rows = GLYPH[name];
  c.fillStyle = col;
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') c.fillRect(x + i, y + j, 1, 1); });
}

const LINE_H = 15;
function timelineView(g) {
  return {
    title: 'ドッター',
    color: DOT.color,
    bg: DOT.bg,
    cancel: -1,
    target: 0,
    scroll: 0,
    dirty: true,
    anim: null,
    headerRight: () => `♥${fansShort(g.state.fans)}`,
    hint: () => (canPost(g) ? 'A:投稿　↑↓:スクロール　B:もどる' : '↑↓:スクロール　B:もどる'),
    update(ph, inp) {
      if (inp.repeat('down')) this.target = Math.min(this.maxScroll || 0, this.target + 30);
      if (inp.repeat('up')) this.target = Math.max(0, this.target - 30);
      if (inp.pressed('a')) {
        if (canPost(g)) { audio.sfx('ok'); ph.run(this, () => composeFlow(g, ph, this)); } else { audio.sfx('buzz'); ph.toast('投稿は1日1回。また明日！', '#9aa3c7'); }
        return;
      }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    layout(c, w) {
      const D = dotter(g);
      const items = [];
      let y = 6;
      items.push({ type: 'compose', y, h: 40 });
      y += 48;
      if (!D.posts.length) { items.push({ type: 'empty', y, h: 60 }); y += 60; }
      const tw = w - 58;
      for (const p of D.posts) {
        const lines = wrap(c, p.x, tw, 12);
        let h = 24 + lines.length * LINE_H + 4;
        const tag = p.e === 'enjo' ? '（ちょっと誤解されてる…？）' : p.e === 'fix' ? '（誤解がとけた！）' : '';
        if (tag) h += LINE_H;
        h += 18; // metrics
        const reps = p.rep.map(([hd, s]) => ({ hd, lines: wrap(c, s, tw - 14, 12) }));
        const rh = reps.reduce((a, r) => a + 15 + r.lines.length * LINE_H + 4, 0);
        h += rh ? rh + 6 : 0;
        items.push({ type: 'post', y, h, p, lines, tag, reps });
        y += h + 6;
      }
      this.items = items;
      this.totalH = y + 4;
      this.w = w;
      this.dirty = false;
    },
    draw(c, ph, a) {
      if (this.dirty || this.w !== a.w) this.layout(c, a.w);
      this.maxScroll = Math.max(0, this.totalH - a.h);
      this.target = clamp(this.target, 0, this.maxScroll);
      this.scroll += (this.target - this.scroll) * 0.35;
      if (Math.abs(this.target - this.scroll) < 0.5) this.scroll = this.target;
      const sy = Math.round(this.scroll);
      const at = this.anim ? ph.t - this.anim.t0 : 9999;
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, a.h);
      c.clip();
      for (const it of this.items) {
        const y = a.y + it.y - sy;
        if (y > a.y + a.h || y + it.h < a.y) continue;
        if (it.type === 'compose') drawCompose(c, g, a.x + 6, y, a.w - 12, it.h);
        else if (it.type === 'empty') {
          T(c, 'まだ投稿がない。', a.x + a.w / 2, y + 10, 12, DOT.dim, 'center');
          T(c, 'A で、はじめての投稿をしてみよう！', a.x + a.w / 2, y + 28, 12, DOT.dim, 'center');
        } else drawPost(c, g, it, a.x + 6, y, a.w - 12, this.anim && this.anim.id === it.p.id ? at : 9999);
      }
      c.restore();
      if (this.maxScroll > 0) {
        const bh = Math.max(14, Math.round((a.h * a.h) / this.totalH));
        const by = a.y + Math.round(((a.h - bh) * this.scroll) / this.maxScroll);
        R(c, a.x + a.w - 3, a.y, 3, a.h, '#e4ddcc');
        R(c, a.x + a.w - 3, by, 3, bh, '#a8a090');
      }
    },
  };
}
function drawCompose(c, g, x, y, w, h) {
  const can = canPost(g);
  const warn = can && enjoPending(g);
  box(c, x, y, w, h, 6, can ? '#ffffff' : '#ebe6da', warn ? DOT.warn : can ? DOT.color : '#c8c0ae', { lo: '#e4ddcc' });
  const look = (g.state && g.state.look) || LOOKS.player;
  box(c, x + 5, y + 7, 34, 26, 3, '#ffffff', '#3a3a4a');
  drawFaceHD(c, look, x + 6, y + 8, 1);
  if (warn) {
    T(c, '誤解をとく投稿をしよう', x + 46, y + 6, 12, DOT.warn);
    T(c, 'A:投稿する', x + 46, y + 22, 12, DOT.dim);
  } else if (can) {
    T(c, 'いま、なにしてる？', x + 46, y + 6, 12, DOT.dim);
    T(c, 'A:今日の投稿をする（1日1回）', x + 46, y + 22, 12, DOT.color);
  } else {
    T(c, '今日は投稿ずみ。', x + 46, y + 6, 12, DOT.dim);
    T(c, 'また明日、投稿しよう！', x + 46, y + 22, 12, DOT.dim);
  }
}
function drawPost(c, g, it, x, y, w, at) {
  const p = it.p;
  const st = g.state;
  box(c, x, y, w, it.h, 5, DOT.card, it.p.e === 'enjo' ? '#e8b080' : '#d6cfbe', { lo: '#ece6d8' });
  const look = st.look || LOOKS.player;
  box(c, x + 5, y + 6, 34, 26, 3, '#ffffff', '#3a3a4a');
  drawFaceHD(c, look, x + 6, y + 7, 1);
  const tx = x + 46;
  const day = `${p.d}日目`;
  const dw = measure(c, day, 12);
  const nm = fit(c, st.name, w - 46 - dw - 30, 12);
  T(c, nm, tx, y + 5, 12, DOT.text);
  const nw = measure(c, nm, 12);
  rrect(c, tx + nw + 3, y + 6, 11, 11, 5, DOT.color);
  glyph(c, 'check', tx + nw + 5, y + 8, '#ffffff');
  T(c, day, x + w - 6, y + 5, 12, DOT.dim, 'right');
  let ly = y + 22;
  for (const l of it.lines) { T(c, l, tx, ly, 12, DOT.text); ly += LINE_H; }
  if (it.tag) { T(c, it.tag, tx, ly, 12, p.e === 'enjo' ? DOT.warn : DOT.good); ly += LINE_H; }
  ly += 4;
  // metrics (count up right after posting)
  const k = clamp(at / 80, 0, 1);
  const e = 1 - (1 - k) ** 3;
  const likes = Math.round(p.l * e), rts = Math.round(p.r * e), reps = Math.round(p.c * e);
  glyph(c, 'reply', tx, ly + 3, DOT.dim); T(c, String(reps), tx + 10, ly, 12, DOT.dim);
  glyph(c, 'rt', tx + 50, ly + 3, DOT.rt); T(c, String(rts), tx + 61, ly, 12, DOT.dim);
  glyph(c, 'heart', tx + 104, ly + 3, DOT.heart); T(c, likes.toLocaleString('ja-JP'), tx + 113, ly, 12, DOT.dim);
  ly += 18;
  if (!it.reps.length) return;
  const shown = at >= 9999 ? it.reps.length : clamp(Math.floor((at - 30) / 30), 0, it.reps.length);
  if (!shown) return;
  // the reply panel grows as the replies come in
  const rh = it.reps.slice(0, shown).reduce((s, r) => s + 15 + r.lines.length * LINE_H + 4, 0);
  R(c, tx - 4, ly, w - 46, rh + 2, '#f3f0e8');
  R(c, tx - 4, ly, 2, rh + 2, DOT.light);
  let ry = ly + 2;
  it.reps.forEach((r, i) => {
    if (i >= shown) return;
    const col = ['#ff9a3c', '#5fa0e0', '#8ac85a', '#c88ae0', '#e86a8a'][(r.hd.charCodeAt(1) + i) % 5];
    disc(c, tx + 4, ry + 6, 4, shade(col, -0.4)); disc(c, tx + 4, ry + 6, 3, col);
    T(c, r.hd, tx + 12, ry, 12, DOT.dim);
    ry += 15;
    for (const l of r.lines) { T(c, l, tx + 12, ry, 12, DOT.text); ry += LINE_H; }
    ry += 4;
  });
}
async function composeFlow(g, ph, view) {
  if (!Phone.phoneList) return;
  const items = topicItems(g);
  const k = await Phone.phoneList(g, {
    title: '投稿する', color: DOT.color, items, index: 0,
    describe: (i) => (items[i] ? TOPICS[items[i].id].desc : ''),
    hint: 'A:えらぶ　B:やめる',
  });
  if (k < 0 || !items[k] || items[k].disabled) return;
  const draft = draftPost(g, items[k].id);
  const ok = Phone.phoneConfirm
    ? await Phone.phoneConfirm(g, { title: 'プレビュー', color: DOT.color, text: draft.x, choices: ['投稿する', 'やめておく'] })
    : 0;
  if (ok !== 0) return;
  const res = publishPost(g, draft);
  if (!res) return;
  view.dirty = true;
  view.target = 0;
  view.anim = { id: res.post.id, t0: ph.t };
  audio.sfx('chime');
  ph.toast(`ファン +${res.gain.toLocaleString('ja-JP')}人`, COLORS.pink);
  if (res.post.e === 'enjo') { audio.sfx('buzz'); ph.toast('あれ…？誤解されてる…！？', DOT.warn); } else if (res.post.k === 'fix') ph.toast('誤解がとけた！ストレス -15', DOT.good);
  else ph.toast(`ストレス ${res.stress}`, DOT.color);
}
export async function dotterApp(g) {
  if (Phone.phoneView) return Phone.phoneView(g, timelineView(g));
  // fallback without the HD phone: a plain list
  if (!canPost(g)) { await g.say('（ドッター：今日はもう投稿した。また明日！）'); return; }
  const items = topicItems(g).filter((it) => !it.disabled);
  const i = await g.list({ title: 'ドッターに投稿', items: items.map((it) => it.label) });
  if (i < 0) return;
  const res = postToDotter(g, items[i].id);
  if (res) await g.say(`「${res.post.x}」\n（ファン +${res.gain}人）`);
}
registerPhoneApp('dotter', {
  name: 'ドッター', color: DOT.color, order: 45,
  iconHD: dotterIcon,
  badge: (g) => (enjoPending(g) ? 1 : 0),
  open: (g) => dotterApp(g),
});

// ======================================================================== the 冠番組: next-morning news
function kanMorning(g, out) {
  const st = g.state;
  const fl = st.flags;
  const s = st.regulars[KAN];
  if (!s || !s.count) return;
  const r = REGULARS[KAN];
  if (!fl.career_kanParty) {
    // the party could not run (e.g. the game was closed): celebrate by phone instead
    fl.career_kanParty = st.day;
    g.giveItem('career_kan_trophy', 1, true);
    g.message({ from: r.host, look: r.hostLook, kind: 'chat', text: g.fmt(`初回の収録、おつかれさまでした！\n番組からの記念のトロフィーをお送りしました。\nこれから毎週、よろしくお願いします！`) });
    out.sent++;
  }
  if (!fl.career_kanRating && out.sent < 2) {
    fl.career_kanRating = st.day;
    const rate = (9 + Math.random() * 7).toFixed(1);
    g.message({ from: 'ドット芸能ニュース', kind: 'news', text: g.fmt(`【視聴率速報】{name}さんの冠番組『${r.title}』、初回は${rate}%の好発進！\nSNSでも「毎週見たい」の声が続々。`) });
    g.addFans(Math.round(r.fans * 0.5), true);
    out.sent++;
  }
}

// ======================================================================== fan meeting: the morning after
function fanMeetMorning(g, out) {
  const st = g.state;
  const f = fmCfg(st);
  if (!f) return;
  const rec = st.regulars[FANMEET];
  if (f.state === 'planned' && rec && num(rec.count) > 0) {
    // recorded, but the party did not run (e.g. the game was closed right after)
    f.state = 'done';
    f.doneDay = f.day;
    g.giveItem('career_fm_photo', 1, true);
  }
  if (f.state === 'planned' && st.day > f.day) {
    f.state = 'missed';
    g.message({ from: 'ファンのみんな', kind: 'fan', look: { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' }, text: g.fmt(`きのうの${f.big ? 'ファン感謝祭' : 'ファンミーティング'}、{name}さんに会えなくて残念…。\nでも、いそがしいのはわかってるよ！\nまた会える日を楽しみにしてます。`) });
    out.sent++;
  }
  // the event is over: take it off the list of shows (or put it on, in its week)
  if (f.state !== 'planned' && st.regulars[FANMEET]) delete st.regulars[FANMEET];
  joinFanMeet(g);
  if (f.state === 'done' && !f.thanked && st.day > num(f.doneDay)) {
    f.thanked = true;
    if (out.sent < 2) {
      g.message({ from: 'ファンレター', kind: 'fan', text: g.fmt(`${f.big ? 'ファン感謝祭' : 'ファンミーティング'}、本当に楽しかったです！\n{name}さんが目の前にいて、夢みたいでした。\n一生の思い出です！\n― 会場にいたファンより`) });
      out.sent++;
    }
  }
}

// ======================================================================== the morning hook
onMorning((g) => {
  const st = g.state;
  if (!st || !st.flags || !st.phone || !st.regulars) return;
  // jobs done so far (ドッター knows what you did today)
  st.flags.career_today = { day: st.day, map: { ...st.jobs } };
  const out = { sent: 0 };
  const steps = [missMorning, fanMeetMorning, kanMorning, dotterMorning, offerMorning, milestoneMorning, rankingMorning, letterMorning];
  for (const fn of steps) {
    try { fn(g, out); } catch (e) { console.error('[career]', fn.name, e); }
  }
});
