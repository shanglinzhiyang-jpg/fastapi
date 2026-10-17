// 自宅（ドット荘）: sleep, self-practice, premium coaching, closet, unit bath, kitchen,
// intro event, the apartment upgrades sold by the landlady (大家さん, in front of
// ドット荘 in tokyo.js), and the pieces every home shares (housing.js imports them):
// closet, PC, bath, bed, kitchen and the furniture slots.
//
// flags: home_level (0..3, bought upgrades), home_seen (last level shown on entering),
//        home_called (level she called out about), home_told (level she hinted at),
//        home_pitched (level she made the full offer for), home_coachDay (day of the last premium coaching),
//        home_v2told (she explained the v2 life), home_v2called (she called from the door about it),
//        home_tvDay (day the TV last relaxed you), home_practice { day, n } (PC self-practice today),
//        housing_bathDay (day of the last bath bonus), housing_use_<furnitureId> (day it was last used),
//        housing_fit { furnitureId: max stamina it gave } (fitness furniture, given once).

import { registerPlace, PLACES } from '../engine/map.js';
import { defineTile, tileImageHD, R, P, outline, oval, bevel, inset, blobs, ramp, dither, shadowEllipse } from '../engine/tiles.js';
import { SKILLS, SKILL_MAX, MAX_STAMINA } from '../engine/state.js';
import { drawFaceHD, LOOKS } from '../engine/sprites.js';
import { makeCanvas, fmtMoney, pick, shade } from '../engine/util.js';
import { FURNITURE, HOUSING } from '../engine/life.js';

// Two lines at most (watchTv adds a third), broken at phrase boundaries.
export const TV_TIPS = [
  '『芸能ニュースです。よしもとのオーディションでは、\nツッコミのタイミングが大切だそうです』',
  '『大阪・なんばの「よしもと新喜劇」では、今日も満員御礼！\nお約束のズッコケに大爆笑！』',
  '『NHKでは、アナウンサーの原稿読みも見どころ。\n難しい漢字の読みに注目です』',
  '『東映の撮影所では、時代劇の殺陣（たて）を撮影中。\n決めポーズがかっこいい！』',
  '『東宝のスタジオでは、大迫力の怪獣映画を撮影中。\nミュージカルの公演も好評です』',
  '『ホリプロ所属の新人歌手がデビュー！\nレッスンの積み重ねが実を結びました』',
  '『グレープカンパニーの芸人さんのグッズ、\n身につけると気合いが入ると評判です』',
  '『松竹芸能の若手芸人さんたち、\n大阪の劇場で腕を磨いているそうです』',
  '『BSよしもとでは、地域の魅力を伝える番組を放送中です』',
  '『疲れたときは、銭湯でひとっ風呂！\nコンビニのお弁当で体力回復もおすすめです』',
  '『ドット商店街の特集です。スーパーの食材で自炊すれば、\nおなかも心も満たされますね』',
  '『ストレスをためないコツは、好きなことをする時間を作ること。\n友だちとのおでかけも効果的です』',
];

// Modules owned by others, loaded on the side so a broken one cannot take the home down
// (and nothing waits on a module load in the middle of a script).
const ext = { CreateScene: null, cookMenu: null };
import('../title.js').then((m) => { ext.CreateScene = m.CreateScene; }).catch((e) => console.error(e));
import('./cooking.js').then((m) => { ext.cookMenu = m.cookMenu; }).catch((e) => console.error(e));

// ------------------------------------------------------------------ shared helpers
// Where the player lives (old saves without the field, or a home whose module did not
// load, count as ドット荘 so there is always a bed to sleep in).
export const livesIn = (g) => {
  const id = g.state && g.state.housing;
  return id && HOUSING[id] ? id : 'dotsou';
};
export const lives = (g, id) => livesIn(g) === id;

// True the first time it is called on a day (then false until tomorrow).
export function onceToday(g, key) {
  if (g.flag(key) === g.state.day) return false;
  g.setFlag(key, g.state.day);
  return true;
}

// ------------------------------------------------------------------ apartment upgrades
// Money sinks for the mid/late game: each level raises the max stamina by 10.
export const HOME_UPGRADES = [
  {
    level: 1, price: 50000, max: 110, name: 'くつろぎリフォーム',
    pitch: ['ふかふかのラグと観葉植物で、くつろげるお部屋にしてあげる。', '段ボールの片付けも、サービスしちゃうわよ。'],
    after: 'お部屋、見てきてごらんなさい。\n家賃は…そのままでいいわよ、うふふ。',
    reveal: 'ふかふかのラグに、観葉植物…！\n段ボールも片付いて、部屋が見ちがえた！',
  },
  {
    level: 2, price: 200000, max: 120, name: 'シアターリフォーム',
    pitch: ['大きなテレビとソファを入れて、お部屋で映画館気分！', 'ソファでゆっくりすれば、疲れもすっきりよ。'],
    after: '映画を見るときは、ポップコーンも忘れずにね。\n…私も見に行っていいかしら？',
    reveal: '大きなテレビとソファが届いている！\nおうちが映画館みたいだ！',
  },
  {
    level: 3, price: 500000, max: 130, name: 'スターリフォーム',
    pitch: ['トロフィー棚と金の額縁で、スターにふさわしいお部屋にするの。', 'ここまでのがんばりを、ずらっと飾りましょう。'],
    after: '金の額縁、ピッカピカに磨いておいたわよ。\nまぶしすぎて、サングラスがいるかもね！',
    reveal: 'トロフィー棚と金の額縁…！\nまるでスターの部屋だ！',
  },
];
const HINT_RATIO = 0.6; // she mentions the next upgrade once the player has 60% of the price

export function homeLevel(g) {
  const v = Number(g.flag('home_level')) || 0;
  return Math.max(0, Math.min(HOME_UPGRADES.length, Math.floor(v)));
}

// Max stamina from fitness furniture (given once per piece, kept even if it is sold).
export function fitnessBonus(g) {
  const fit = g.flag('housing_fit');
  if (!fit || typeof fit !== 'object') return 0;
  return Object.values(fit).reduce((s, v) => s + (Number(v) || 0), 0);
}
// The max stamina the bought upgrades and fitness furniture guarantee.
export function staminaCap(g) {
  const lv = homeLevel(g);
  return (lv ? HOME_UPGRADES[lv - 1].max : MAX_STAMINA) + fitnessBonus(g);
}
// Old saves / other sources: only ever raises the max stamina.
export function fixMaxStamina(g) {
  const want = staminaCap(g);
  if (!(g.state.maxStamina >= want)) g.state.maxStamina = want;
}

function oyaSmallTalk(g) {
  const st = g.state;
  if (!st.agency && st.fame < 30) {
    // one line pointing at the next step (the full advice was in her first talk)
    if (!(st.stats && st.stats.jobs)) return ['あら{name}ちゃん、おでかけ？\nすぐそこの公園のステージなら、事務所に入ってなくても\n歌や漫才で投げ銭がもらえるわよ。'];
    return ['あら{name}ちゃん、おでかけ？\n事務所のオーディションには、もう行ってみた？\n所属できたら、お仕事がぐんと増えるわよ。'];
  }
  if (st.fame < 250) return ['あら{name}ちゃん、お仕事がんばってるみたいね。', 'ちゃんとごはん食べてる？\n体が資本なんだから、無理しちゃだめよ。'];
  if (st.fame < 1000) return ['この前、テレビで{name}ちゃんを見たわよ！\nご近所さんに自慢しちゃった。'];
  if (st.fame < 2000) return ['ご近所さんに、{name}ちゃんのサインを頼まれて困ってるのよ〜。', '…あ、私の分もお願いね。'];
  return ['すっかりスターねえ。\nでも、ここが{name}ちゃんの家なのは変わらないわよ。'];
}

// Her first talk: the v2 life in her words (the intro only names the gauges), once.
function oyaLife(g) {
  const lines = [
    'あら{name}ちゃん、おでかけ？\nちょうどよかった。暮らしのことで、大事なお話。',
    'おなか（満腹）、ストレス、身だしなみ…\nこの3つは毎日気にかけるのよ。\nごはんを食べて、お風呂に入って、たまには息抜き。',
    'ストレスがたまりすぎると、お仕事どころじゃなくなるわ。\n疲れたら、部屋のベッドでゆっくり休むこと。\nキッチンで自炊、ユニットバスでシャワーもできるわよ。',
    `お家賃は毎週月曜の朝に${fmtMoney((HOUSING.dotsou && HOUSING.dotsou.rent) || 8000)}。\n払えないときは、スマホの「家計」からあとで払えばいいの。\nうちはね、だれも追い出したりしないから。`,
    'スマホは、メニューから開けるわよ。\nお友だちからの連絡も、そこに届くの。',
    '西の「ドット商店街」には、スーパーやお花屋さん、\n家具屋さんに不動産屋さんもあるわ。\n一度のぞいてごらんなさい。',
  ];
  if (!g.state.agency) lines.push('それから、お仕事ね。まずは事務所のオーディション！\nよしもとさん、グレープカンパニーさん、ホリプロさん…\nこのあたりにいっぱいあるわよ。');
  return lines;
}

async function buildUpgrade(g, up, o) {
  const st = g.state;
  if (!g.spend(up.price)) { await g.say('あら、ちょっと足りないみたい。\nまた今度ね。', o); return false; }
  await g.say('じゃあ、さっそく業者さんを呼ぶわね〜！', o);
  await g.fadeOut(15);
  for (const s of ['hit', 'hit', 'drum']) { g.sfx(s); await g.wait(350); }
  const prevBase = homeLevel(g) ? HOME_UPGRADES[homeLevel(g) - 1].max : MAX_STAMINA;
  g.setFlag('home_level', up.level);
  // +10 on top of whatever else raised it (gym, furniture), never below the guaranteed cap
  st.maxStamina = Math.max((st.maxStamina || MAX_STAMINA) + (up.max - prevBase), staminaCap(g));
  await g.fadeIn(15);
  await g.say('トントン、カンカン…\nあっという間に工事が終わった！');
  g.sfx('fanfare');
  await g.say(`リフォーム完了！\n体力の最大値が${st.maxStamina}になった！\n（ベッドで寝ると${st.maxStamina}まで回復する）`);
  await g.say(up.after, o);
  g.save();
  return true;
}

// The landlady's talk (the NPC in front of ドット荘 in tokyo.js finds it on PLACES.home.oyaTalk).
// She only ever offers the next level, and hints at it once the player is close.
export async function oyaTalk(g, npc) {
  const st = g.state;
  const o = { name: (npc && npc.name) || '大家さん', look: (npc && npc.look) || LOOKS.oldwoman };
  const away = !lives(g, 'dotsou');
  const debt = (st.rent && st.rent.debt) || 0;
  if (away) {
    const h = HOUSING[livesIn(g)];
    await g.say([
      `あら{name}ちゃん、来てくれたの！\n${h ? `「${h.name}」での暮らしはどう？` : '新しいおうちはどう？'}`,
      'あなたのお部屋には、いまは新しい子が住んでるの。\nでも、もし戻りたくなったら…\nドット商店街の不動産屋さんに言えば、すぐよ。',
      'ちゃんと食べて、ちゃんと寝るのよ。\nどこに住んでても、それがいちばん。',
    ], o);
    return;
  }
  if (!g.flag('home_v2told')) {
    g.setFlag('home_v2told');
    g.setFlag('home_v2called'); // told in person: no call from the door
    await g.say(oyaLife(g), o);
    return;
  }
  if (debt > 0) {
    await g.say(['お家賃のことなら、気にしすぎないの。\n払えるときに、スマホの「家計」から払ってくれればいいわ。', `（未払いの家賃：${fmtMoney(debt)}）`], o);
  }
  const lv = homeLevel(g);
  const up = HOME_UPGRADES[lv];
  if (up && st.money >= up.price) {
    // the full pitch once per level; after that (e.g. she was turned down) just the question
    if (g.flag('home_pitched') === up.level) await g.say('あら{name}ちゃん！\nリフォームの件、考えてくれた？', o);
    else await g.say([lv ? 'あら{name}ちゃん、ちょうどよかった！\nまたリフォームのお話があるの。' : 'あら{name}ちゃん、ちょうどよかった！\nお部屋のリフォーム、してみない？', ...up.pitch], o);
    g.setFlag('home_told', up.level);
    g.setFlag('home_pitched', up.level);
    g.setFlag('home_called', up.level); // already asked in person: no call from the door
    const i = await g.ask(`「${up.name}」${fmtMoney(up.price)}よ。\n体力の最大値が10上がるわ。\nどうする？`, ['お願いします', 'また今度'], o);
    if (i !== 0) { await g.say('あらそう？\n気が変わったら、いつでも声をかけてね。', o); return; }
    await buildUpgrade(g, up, o);
    return;
  }
  await g.say(oyaSmallTalk(g), o);
  if (!up) {
    await g.say('お部屋はもう、これ以上ないくらい立派よ。\nあとは…お城でも建てる？うふふ。', o);
    return;
  }
  if (st.money >= up.price * HINT_RATIO) {
    // the full pitch once per level, then just how much is still missing
    if (g.flag('home_told') === up.level) {
      await g.say(`「${up.name}」まで、あと${fmtMoney(up.price - st.money)}ね。\nたまったら、声をかけてちょうだい。`, o);
      return;
    }
    g.setFlag('home_told', up.level);
    await g.say([
      `そうそう、お部屋のリフォームを考えてるの。\n「${up.name}」${fmtMoney(up.price)}よ。`,
      up.pitch[0],
      `体力の最大値が10上がるわ。\nあと${fmtMoney(up.price - st.money)}たまったら、声をかけてね。`,
    ], o);
  } else if (g.flag('home_told') === up.level) {
    await g.say(`「${up.name}」（${fmtMoney(up.price)}）の話、\nおぼえてる？いつでも待ってるわよ〜。`, o);
  }
}

// Leaving the room with enough money for the next level: she calls out once per level.
async function oyaCall(g) {
  if (!lives(g, 'dotsou')) return;
  if (!g.flag('home_v2told') && !g.flag('home_v2called')) {
    g.setFlag('home_v2called');
    await g.say('（ドアの外から、大家さんの声がする…）\n「{name}ちゃーん、おでかけ？\nちょっといいかしら〜？」');
    return;
  }
  const up = HOME_UPGRADES[homeLevel(g)];
  if (!up || g.state.money < up.price || g.flag('home_called') === up.level) return;
  g.setFlag('home_called', up.level);
  await g.say('（ドアの外から、大家さんの声がする…）\n「{name}ちゃーん、ちょっといいかしら〜？」');
}

// ------------------------------------------------------------------ room interactions
async function intro(g) {
  await g.wait(300);
  await g.say(['ここは東京の小さなアパート「ドット荘」。', '{name}は、芸能界のてっぺんを目指して、今日 上京してきたばかりだ！']);
  await g.emote('player', '!');
  await g.say(['目標は…国民的スター！', 'まずはどこかの事務所のオーディションに合格して、所属タレントになろう。']);
  await g.say([
    '【あそびかた】\n移動：矢印キー／WASD（スマホは十字パッド）\n話す・調べる・決定：Aボタン（Z / スペース / Enter）',
    'ダッシュ：Bボタン（X / Shift）を押しながら移動\nメニュー：Esc / C（スマホはMENUボタン）',
    'お仕事やレッスンをすると体力が減る。\nベッドで寝ると体力が回復して、次の日になるよ。',
    'お仕事で知名度を上げて、称号をランクアップさせよう！\n部屋を出たら、まずはアパートの前の大家さんにあいさつ。\n街の人の話も聞いてみよう。',
    '【くらし】右上のゲージは「満腹」「ストレス」「身だしなみ」。\n食べる・遊ぶ・お風呂で、毎日ととのえよう。\n困ったら メニュー→てちょうの「せいかつ」を見てね。',
  ]);
}

// Closet: change clothes (the character creator in closet mode). Shared by every home.
export async function openCloset(g) {
  const i = await g.ask('クローゼットだ。\n着がえて、イメージチェンジする？', ['着がえる', 'やめておく']);
  if (i !== 0) return;
  const CreateScene = ext.CreateScene;
  if (!CreateScene) { await g.say('（いまはクローゼットが開かないみたいだ…）'); return; }
  g.sfx('door');
  const scene = new CreateScene(g, null, { look: g.state.look || {}, name: g.state.name, closet: true });
  const before = JSON.stringify(scene.look());
  const res = await new Promise((r) => { scene.resolve = r; g.push(scene); });
  if (!res || JSON.stringify(res.look) === before) { await g.say('やっぱり、いつもの服がいちばん！'); return; }
  g.state.look = res.look;
  g.save();
  g.sfx('good');
  await g.say('着がえた！\n…うん、なかなか似合ってる！');
}

async function watchTv(g) {
  g.sfx('cursor');
  const big = homeLevel(g) >= 2;
  const relax = onceToday(g, 'home_tvDay');
  if (relax) g.relax({ stress: big ? 6 : 3 });
  await g.say([big ? '大画面のテレビをつけた。\nやっぱり迫力がちがう！' : 'テレビをつけた。', pick(TV_TIPS) + (relax ? `\n（ちょっと気分転換できた。ストレス -${big ? 6 : 3}）` : '')]);
}

async function trophyTalk(g) {
  const st = g.state;
  await g.say([
    'トロフィー棚だ。上の金の額縁には、\n{name}のブロマイドが飾ってある。',
    `これまでのお仕事：${st.stats.jobs}回\n芸能生活：${st.day}日目\n…ここまで来たんだなあ。`,
  ]);
}

// Free practice at home (PC, 防音ブース): a little hunger, stress and sweat, like a light lesson.
export const SELF_PRACTICE_TICK = { hunger: -4, stress: 2, clean: -2 };
const PRACTICE_PER_DAY = 3;
const practiceToday = (g) => {
  const f = g.flag('home_practice');
  return f && typeof f === 'object' && f.day === g.state.day ? Number(f.n) || 0 : 0;
};

export async function selfPractice(g) {
  const done = practiceToday(g);
  if (done >= PRACTICE_PER_DAY) { await g.say(`今日の自主練は、もう${PRACTICE_PER_DAY}回やった。\n集中力が続かない…。また明日にしよう。`); return; }
  const keys = Object.keys(SKILLS);
  const i = await g.ask(`パソコンで動画を見ながら自主練しよう。\n（無料・体力 -10・スキル +1・今日あと${PRACTICE_PER_DAY - done}回）`, [...keys.map((k) => SKILLS[k] + 'の練習'), 'やめておく']);
  if (i < 0 || i >= keys.length) return;
  if (g.state.skills[keys[i]] >= SKILL_MAX) { await g.say(`${SKILLS[keys[i]]}はもう極めている！\nほかのスキルをみがこう。`); return; }
  if (!g.useStamina(10)) { await g.say('体力が足りない…。今日はもう休もう。'); return; }
  g.setFlag('home_practice', { day: g.state.day, n: done + 1 });
  g.lifeTick(SELF_PRACTICE_TICK);
  await g.fadeOut(10);
  g.sfx('drum');
  await g.wait(400);
  await g.fadeIn(10);
  g.addSkill(keys[i], 1, true);
  await g.say(`自主練をした！${SKILLS[keys[i]]}が1上がった。（${g.state.skills[keys[i]]}）\nプロのレッスンを受ければ、もっと伸びるはず…！`);
}

// Premium coaching: a pricey once-a-day lesson at home (no travel, no minigame).
const COACH = { price: 20000, stamina: 15, gain: 5 };
const COACH_NPC = { name: 'オンライン講師', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#2f9a4a', bottom: '#2a2d36', glasses: true } };
const COACH_LINES = {
  warai: 'よろしくお願いします！\n今日は「間」の取り方を、じっくりやりましょう。',
  engi: 'よろしくお願いします！\n今日はセリフに気持ちを乗せる練習です。',
  uta: 'よろしくお願いします！\nまずは腹式呼吸から、しっかりいきますよ。',
  talk: 'よろしくお願いします！\n今日は相手の話を広げる「返し」を磨きましょう。',
};

export async function coaching(g) {
  const st = g.state;
  if (g.flag('home_coachDay') === st.day) {
    await g.say('今日の個別指導は、もう受けた。\n予約は1日1回まで。また明日にしよう。');
    return;
  }
  const keys = Object.keys(SKILLS);
  const i = await g.ask(`プロの講師が、オンラインで\nマンツーマン指導をしてくれる。（1日1回）\n${fmtMoney(COACH.price)}・体力 -${COACH.stamina}・スキル +${COACH.gain}`, [...keys.map((k) => SKILLS[k] + 'の指導'), 'やめておく']);
  if (i < 0 || i >= keys.length) return;
  const k = keys[i];
  if (st.skills[k] >= SKILL_MAX) { await g.say(`${SKILLS[k]}はもう極めている！\nほかのスキルをみがこう。`); return; }
  if (st.money < COACH.price) { await g.say(`受講料（${fmtMoney(COACH.price)}）が足りない…。\nお仕事でかせいでからにしよう。`); return; }
  if (st.stamina < COACH.stamina) { await g.say('体力が足りない…。\n休んでからにしよう。'); return; }
  const tired = g.lifeRefusal();
  if (tired) { await g.say(tired); return; }
  const room = SKILL_MAX - st.skills[k];
  if (room < COACH.gain) {
    const j = await g.ask(`${SKILLS[k]}は、あと${room}で極められる。\n受講料は${fmtMoney(COACH.price)}のまま。受ける？`, ['受ける', 'やめておく']);
    if (j !== 0) return;
  }
  g.spend(COACH.price);
  g.useStamina(COACH.stamina);
  g.setFlag('home_coachDay', st.day);
  st.life.workDay = st.day; // a lesson like g.lesson: no day off, and the same toll on the needs
  g.lifeTick('lesson');
  await g.say(COACH_LINES[k], COACH_NPC);
  await g.fadeOut(10);
  g.sfx('drum');
  await g.wait(500);
  await g.fadeIn(10);
  const before = st.skills[k];
  g.addSkill(k, COACH.gain, true);
  g.sfx('good');
  await g.say(`個別指導が終わった！\n${SKILLS[k]}が${st.skills[k] - before}上がった！（${st.skills[k]}）`);
}

// The PC on the desk (self-practice + coaching). Shared by every home.
export async function pcMenu(g) {
  const i = await g.ask('パソコンだ。なにをしよう？', ['自主練する', 'プロの個別指導', 'やめておく']);
  if (i === 0) await selfPractice(g);
  else if (i === 1) await coaching(g);
}

// Kitchen: cooking.js (the shopping street's ingredients) when it loads, else a simple meal.
export async function cook(g) {
  if (ext.cookMenu) { await ext.cookMenu(g); return; }
  if (!g.canEat()) { await g.say('おなかいっぱいだ…。\nおなかが空いたらまた作ろう。'); return; }
  const i = await g.ask('キッチンだ。自炊する？（¥100・体力+15）', ['つくる', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(100)) { await g.say('食材を買うお金もない…'); return; }
  const got = g.eat(15, { silent: true, fill: 30 });
  g.sfx('good');
  await g.say('もやし炒めを作って食べた！' + (got > 0 ? `体力が${got}回復した。` : 'おなかが満たされた。'));
}

// Bath: 身だしなみ back to 100, plus a once-a-day stress bonus.
// opts: { name, verb, stress, stamina, lines: [after-bath narration] }
export async function takeBath(g, opts = {}) {
  const name = opts.name || 'お風呂';
  const stress = opts.stress ?? 4;
  const bonus = g.flag('housing_bathDay') !== g.state.day;
  const i = await g.ask(`${name}だ。${opts.verb || 'お風呂に入る'}？\n（身だしなみ 全回復${bonus && stress ? `・今日はじめてならストレス -${stress}` : ''}）`, ['入る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  await g.fadeOut(12);
  g.sfx('door');
  await g.wait(700);
  await g.fadeIn(12);
  const dc = g.bathe(100, true);
  let ds = 0;
  // the daily bonus is only used up when it does something (no stress to lose and no stamina bonus: kept for later)
  if (bonus && (opts.stamina || (stress && g.state.life.stress > 0))) {
    g.setFlag('housing_bathDay', g.state.day);
    ds = -g.addNeed('stress', -stress);
    if (opts.stamina) g.heal(opts.stamina);
  }
  g.sfx('good');
  const what = [dc > 0 ? `身だしなみ +${dc}` : '', ds > 0 ? `ストレス -${ds}` : '', bonus && opts.stamina ? `体力 +${opts.stamina}` : ''].filter(Boolean).join('・');
  await g.say([...(opts.lines || ['さっぱりした！']), what ? `（${what}）` : '（もうピカピカだ）']);
}

// Bed: sleep (next day), with a short morning summary.
export async function sleepInBed(g, opts = {}) {
  const i = await g.ask(opts.ask || 'ベッドだ。寝て体力を回復する？（次の日になります）', ['寝る', 'やめておく']);
  if (i !== 0) return false;
  const before = g.state.life.stress;
  await g.sleep();
  const d = before - g.state.life.stress;
  const lines = [`${g.dayLabel()}の朝だ！今日もがんばろう！`];
  if (d > 0) lines[0] += `\n${d >= 30 ? 'ぐっすり眠れた！' : 'よく眠れた。'}（ストレス -${d}）`;
  await g.say(lines);
  return true;
}

// ------------------------------------------------------------------ furniture (every home)
// FURNITURE defs (registered in housing.js) carry their own art:
//   paint(c, wTiles)       native 2x art on a (32 * wTiles) x artH canvas, bottom-aligned
//                          with the footprint (2x1 tiles; a bed covers the home's bed area)
//   artH                   canvas height in px (default 64; beds 76 over a 2-tile bed)
//   anim(ctx, x, y, g, w)  optional per-frame extras in units (x, y = canvas top-left)
//   tall                   stands against a wall (avoids the low slots under windows)
//   bed                    drawn over the home's bed instead of standing in a slot (still one of the slots pieces)
//   use: async (g, def)    what A on it does in your home (default: its description)
const furnArt = new Map();
function furnCanvas(id, w) {
  const def = FURNITURE[id];
  if (!def || !def.paint) return null;
  const key = id + '|' + w;
  let cv = furnArt.get(key);
  if (!cv) {
    let c;
    [cv, c] = makeCanvas(w * 32, def.artH || (def.bed ? 76 : 64));
    try { def.paint(c, w); } catch (e) { console.error(e); }
    furnArt.set(key, cv);
  }
  return cv;
}
// Draw a piece standing on the footprint whose top-left tile is at (sx, sy) units.
export function drawFurniture(ctx, id, sx, sy, g, w = 2, h = 1) {
  const cv = furnCanvas(id, w);
  if (!cv) return;
  const top = sy + h * 16 - cv.height / 2;
  ctx.drawImage(cv, sx, top, cv.width / 2, cv.height / 2);
  const def = FURNITURE[id];
  if (def.anim) {
    try { def.anim(ctx, sx, top, g, w); } catch (e) { console.error(e); }
  }
}

export function ownedFurniture(g) {
  const f = (g.state && g.state.furniture) || {};
  return Object.keys(f).filter((k) => f[k] && FURNITURE[k]);
}
// A bed piece is drawn over the home's own bed (no slot position) but, like every piece,
// counts against housing().slots (life.js: at most slots pieces; the notebook shows n/slots).
export const bedPiece = (g) => ownedFurniture(g).find((id) => FURNITURE[id].bed) || null;

// Which owned piece stands in which slot ({ x, y, low, win }): tall pieces against the
// walls (never in front of a window if avoidable), low ones in the low slots; purchase order otherwise.
export function arrangeFurniture(g, slots) {
  const ids = ownedFurniture(g).filter((id) => !FURNITURE[id].bed);
  const out = new Array(slots.length).fill(null);
  const put = (id, ok) => {
    const i = slots.findIndex((s, k) => !out[k] && ok(s));
    if (i < 0) return false;
    out[i] = id;
    return true;
  };
  for (const id of ids.filter((k) => FURNITURE[k].tall)) put(id, (s) => !s.low) || put(id, (s) => !s.win) || put(id, () => true);
  for (const id of ids.filter((k) => !FURNITURE[k].tall)) put(id, (s) => s.low) || put(id, () => true);
  return out;
}

// Furniture bought since the last visit home: "it has arrived!" (flags.housing_delivered = [ids]).
export async function announceDelivery(g, housingId) {
  const list = g.flag('housing_delivered');
  const ids = (Array.isArray(list) ? list : []).filter((id) => FURNITURE[id] && g.state.furniture[id]);
  if (!lives(g, housingId) || !ids.length) return;
  g.setFlag('housing_delivered', []);
  g.sfx('good');
  await g.emote('player', '♪');
  await g.say(`${ids.map((id) => `「${FURNITURE[id].name}」`).join('')}が届いている！\n${ids.length > 1 ? '部屋がにぎやかになった。' : 'さっそく使ってみよう。'}`);
}

export async function useFurniture(g, id) {
  const def = FURNITURE[id];
  if (!def) return;
  if (def.use) await def.use(g, def);
  else await g.say(`${def.name}だ。\n${def.desc || ''}`);
}

// Prop entities showing the owned furniture at a home's slots (only while you live there).
export function furnitureProps(housingId, slots) {
  return slots.map((s, i) => ({
    type: 'prop', x: s.x, y: s.y, w: 2, h: 1, furnSlot: i,
    cond: (g) => lives(g, housingId) && !!arrangeFurniture(g, slots)[i],
    draw: (ctx, sx, sy, g) => { const id = arrangeFurniture(g, slots)[i]; if (id) drawFurniture(ctx, id, sx, sy, g); },
    talk: async (g) => { const id = arrangeFurniture(g, slots)[i]; if (id) await useFurniture(g, id); },
  }));
}

// ------------------------------------------------------------------ room art (props, native 2x)
// Each painting is cached at 2 px per unit and drawn at w x h units.
const sprites = new Map();
function sprite(key, w, h, fn) {
  let cv = sprites.get(key);
  if (!cv) {
    let c;
    [cv, c] = makeCanvas(w * 2, h * 2);
    fn(c);
    sprites.set(key, cv);
  }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);

// Wardrobe, 16 x 25 units (stands on one tile, rises over the wall).
export function paintCloset(c) {
  R(c, 1, 0, 30, 4, '#a06c3c'); R(c, 1, 0, 30, 1, '#c48a52'); R(c, 1, 3, 30, 1, '#7a4e2a');
  R(c, 2, 4, 28, 42, '#8a5a33');
  for (const x of [3, 17]) {
    bevel(c, x, 6, 12, 38, '#b98552', '#d6a06a', '#8a5a33');
    inset(c, x + 2, 9, 8, 13, '#a8774a', '#c48f5c', '#86592f');
    inset(c, x + 2, 26, 8, 15, '#a8774a', '#c48f5c', '#86592f');
  }
  R(c, 15, 6, 2, 38, '#5a3a20');
  for (const x of [12, 19]) { R(c, x, 22, 1, 5, '#e8c43a'); P(c, x, 22, '#fff6a8'); P(c, x, 26, '#a8851c'); }
  R(c, 2, 45, 28, 2, '#5a3a20');
  R(c, 4, 47, 4, 2, '#3b2a20'); R(c, 24, 47, 4, 2, '#3b2a20');
  outline(c);
}
export function drawCloset(ctx, sx, sy) { blit(ctx, sprite('closet', 16, 25, paintCloset), sx, sy - 9); }
// The closet entity for any home.
export const closetProp = (x, y, extra = {}) => ({ type: 'prop', x, y, draw: drawCloset, talk: openCloset, ...extra });

function paintBigPlant(c) {
  shadowEllipse(c, 16, 42, 10, 1);
  R(c, 9, 30, 14, 12, '#c9b48e'); R(c, 8, 29, 16, 3, '#e0d2b0'); R(c, 8, 29, 16, 1, '#f2e8cc');
  dither(c, 10, 33, 12, 8, '#b8a37c');
  R(c, 21, 32, 2, 10, '#a8956e'); R(c, 9, 41, 14, 1, '#a8956e');
  R(c, 15, 22, 2, 8, '#2f6b34');
  blobs(c, [[16, 20, 8], [9, 14, 6], [23, 13, 6], [16, 7, 6], [11, 21, 5], [21, 21, 5]], ramp('#3d8a44'));
  for (const [x, y] of [[9, 12], [22, 10], [15, 4], [13, 17]]) { P(c, x, y, '#86d277'); P(c, x + 1, y, '#74c26a'); }
  outline(c);
}
const bigPlant = (ctx, sx, sy) => blit(ctx, sprite('bigplant', 16, 22, paintBigPlant), sx, sy - 6);

const SCREEN_ART = [
  (c, x, y) => { R(c, x, y, 52, 26, '#5fd7ff'); R(c, x, y + 18, 52, 8, '#5ee07a'); oval(c, x + 6, y + 15, 14, 8, '#3d8a44'); oval(c, x + 38, y + 3, 7, 7, '#ffd23f'); R(c, x + 2, y + 2, 10, 1, '#c8f0ff'); },
  (c, x, y) => { R(c, x, y, 52, 26, '#2a1f30'); R(c, x + 18, y, 16, 26, '#4a3a50'); R(c, x + 22, y + 11, 8, 12, '#ffd23f'); oval(c, x + 22, y + 5, 8, 7, '#f6c9a0'); R(c, x, y + 22, 52, 4, '#b8343c'); },
  (c, x, y) => { R(c, x, y, 52, 26, '#ff7eb6'); for (const [a, b] of [[6, 5], [16, 16], [30, 7], [44, 18], [36, 3]]) { R(c, x + a - 1, y + b, 3, 1, '#ffffff'); R(c, x + a, y + b - 1, 1, 3, '#ffffff'); } },
];
function paintBigTv(c, f) {
  shadowEllipse(c, 32, 50, 30, 2);
  bevel(c, 2, 34, 60, 16, '#6e4428', '#8a5a33', '#4a2e18');
  R(c, 2, 34, 60, 2, '#a87449');
  inset(c, 5, 38, 25, 9, '#7a4e2e', '#8f6038', '#5a3a20'); inset(c, 34, 38, 25, 9, '#7a4e2e', '#8f6038', '#5a3a20');
  R(c, 15, 42, 4, 1, '#c9a227'); R(c, 45, 42, 4, 1, '#c9a227');
  R(c, 28, 30, 8, 4, '#20232a');
  R(c, 4, 0, 56, 31, '#20232a'); R(c, 4, 0, 56, 1, '#3b3f48');
  SCREEN_ART[f](c, 6, 2);
  R(c, 6, 2, 52, 1, 'rgba(255,255,255,0.25)');
  R(c, 54, 28, 3, 1, '#5ee07a');
  outline(c);
}
function paintSofaBack(c) {
  shadowEllipse(c, 32, 30, 30, 1);
  const col = '#2f7a8a', dark = '#215a66', light = '#4fa0b0';
  bevel(c, 0, 8, 10, 22, dark, col, '#174650'); bevel(c, 54, 8, 10, 22, dark, col, '#174650');
  R(c, 8, 2, 48, 26, col); R(c, 8, 2, 48, 5, light); R(c, 8, 7, 48, 1, dark);
  R(c, 31, 9, 2, 19, dark); R(c, 8, 26, 48, 2, dark);
  R(c, 4, 30, 3, 2, '#3b2a20'); R(c, 57, 30, 3, 2, '#3b2a20');
  outline(c);
}
function cupHD(c, x, y) {
  R(c, x, y, 10, 4, '#e8c43a'); R(c, x, y, 10, 1, '#fff6a8'); R(c, x - 2, y + 1, 2, 2, '#c9a227'); R(c, x + 10, y + 1, 2, 2, '#c9a227');
  R(c, x + 2, y + 4, 6, 2, '#e8c43a'); R(c, x + 4, y + 6, 2, 2, '#c9a227'); R(c, x + 2, y + 8, 6, 2, '#a8851c');
}
function paintTrophies(c) {
  R(c, 0, 0, 64, 32, '#6e4428'); R(c, 0, 0, 64, 1, '#8a5a33');
  R(c, 2, 2, 60, 26, '#2a2430'); R(c, 2, 14, 60, 2, '#8a5a33'); R(c, 2, 15, 60, 1, '#5a3a20');
  cupHD(c, 6, 2); cupHD(c, 46, 2);
  // star on a stand
  R(c, 29, 5, 6, 6, '#ffd23f'); R(c, 31, 3, 2, 2, '#ffd23f'); R(c, 26, 7, 3, 2, '#ffd23f'); R(c, 35, 7, 3, 2, '#ffd23f'); R(c, 30, 11, 4, 2, '#c9a227'); P(c, 30, 6, '#fff6a8');
  // gold disc, microphone, plaque
  oval(c, 7, 18, 9, 9, '#e8c43a'); oval(c, 10, 21, 3, 3, '#2a2430'); P(c, 9, 19, '#fff6a8');
  R(c, 30, 18, 4, 4, '#e8c43a'); R(c, 31, 22, 2, 5, '#c9a227'); P(c, 30, 18, '#fff6a8');
  bevel(c, 42, 18, 15, 9, '#c9a227', '#e8c43a', '#a8851c'); R(c, 44, 20, 11, 5, '#e8c43a'); R(c, 46, 22, 7, 1, '#a8851c');
  for (let i = 0; i < 6; i++) P(c, 55 - i, 3 + i, 'rgba(255,255,255,0.35)');
  R(c, 0, 28, 64, 4, '#5a3a20'); R(c, 0, 28, 64, 1, '#7a4e2a');
  outline(c);
}
function paintGoldFrame(c) {
  R(c, 0, 0, 48, 32, '#a8851c'); R(c, 2, 2, 44, 28, '#e8c43a'); R(c, 2, 2, 44, 1, '#fff6a8'); R(c, 2, 2, 1, 28, '#fff6a8');
  R(c, 4, 4, 40, 24, '#fff0f5'); R(c, 4, 4, 40, 1, '#c9a227'); R(c, 4, 4, 1, 24, '#c9a227');
}
function drawGoldFrame(ctx, x, y, g) {
  blit(ctx, sprite('goldframe', 24, 16, paintGoldFrame), x, y);
  drawFaceHD(ctx, g.state.look || {}, x + 4, y + 2, 0.5);
  if (Math.floor(g.frame / 30) % 4 === 0) { R(ctx, x + 22, y, 0.5, 0.5, '#ffffff'); R(ctx, x + 21.5, y + 0.5, 1.5, 0.5, '#ffffff'); R(ctx, x + 22, y + 1, 0.5, 0.5, '#ffffff'); }
}

function paintRug(c) {
  const w = 88, h = 68;
  R(c, 0, 0, w, h, '#a8343f'); R(c, 3, 3, w - 6, h - 6, '#e07a8a');
  R(c, 9, 9, w - 18, h - 18, '#f2b8c0'); R(c, 13, 13, w - 26, h - 26, '#e07a8a');
  dither(c, 15, 15, w - 30, h - 30, '#d86e7e');
  R(c, 3, 3, w - 6, 1, '#f2a0ac'); R(c, 9, h - 10, w - 18, 1, '#d8909a');
  for (let i = 4; i < h - 3; i += 5) { R(c, -0, i, 1, 2, '#f6e7c8'); R(c, w - 1, i, 1, 2, '#f6e7c8'); }
}
function paintZabuton(c, col) {
  R(c, 1, 0, 18, 16, col); R(c, 0, 1, 20, 14, col);
  R(c, 2, 1, 16, 2, shade(col, 0.3)); R(c, 1, 13, 18, 2, shade(col, -0.25));
  R(c, 9, 7, 2, 2, '#ffd23f');
  outline(c);
}
function drawRug(ctx, g, cam) {
  if (!lives(g, 'dotsou') || homeLevel(g) < 1) return;
  blit(ctx, sprite('rug', 44, 34, paintRug), 3 * 16 + 2 - cam.x, 4 * 16 - 6 - cam.y);
  for (const [cx, col] of [[3 * 16 + 4, '#7a4fa0'], [5 * 16 + 2, '#ff8a3d']]) {
    blit(ctx, sprite('zabuton' + col, 10, 8, (c) => paintZabuton(c, col)), cx - cam.x, 4 * 16 + 4 - cam.y);
  }
}

// ------------------------------------------------------------------ tiles
// Unit bath door (ドット荘): wooden frame, frosted glass, small "BATH" plate.
defineTile('home_bathdoor', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 1, 10, 15, '#7a4e2a'); R(c, 4, 2, 8, 14, '#c9a06a'); R(c, 5, 3, 6, 6, '#dfe8ee'); R(c, 6, 10, 4, 1, '#5fd7ff'); P(c, 10, 11, '#c9a227');
  },
  hd(c) {
    R(c, 6, 2, 20, 30, '#7a4e2a'); R(c, 6, 2, 20, 1, '#9a6a3c');
    bevel(c, 8, 4, 16, 28, '#c9a06a', '#dcb684', '#a87e4c');
    inset(c, 10, 6, 12, 12, '#dfe8ee', '#f4f8fb', '#b8c4cc');
    dither(c, 11, 8, 10, 9, '#eef3f6');
    R(c, 11, 21, 10, 3, '#3a6fd8'); R(c, 12, 22, 8, 1, '#c8ecff');
    R(c, 20, 25, 3, 2, '#c9a227'); P(c, 20, 25, '#fff6a8');
    outline(c);
  },
});

// ------------------------------------------------------------------ the place
const atLeast = (n) => (g) => lives(g, 'dotsou') && homeLevel(g) >= n;
const below = (n) => (g) => lives(g, 'dotsou') && homeLevel(g) < n;
const mine = (g) => lives(g, 'dotsou');

// Furniture slots in ドット荘 (2x1 each) and the bed.
export const DOTSOU_SLOTS = [
  { x: 11, y: 2 }, // back wall, between the windows and the bed
  { x: 13, y: 5 }, // right wall, below the bed
  { x: 1, y: 6 }, // bottom-left corner
  { x: 7, y: 6, low: true }, // in front of the rug
];
const DOTSOU_BED = { x: 14, y: 2, w: 1, h: 2 };

const HOME_START = { room: 'room', x: 4, y: 6, dir: 'up' };
const AWAY_START = { room: 'rouka', x: 4, y: 3, dir: 'up' };
// The game (for the start getter: who lives here decides where the door leads).
const game = () => (typeof window !== 'undefined' && window.__game) || null;

async function bedAction(g) {
  if (!mine(g)) { await g.say('ここはもう、自分の部屋じゃない…。'); return; }
  await sleepInBed(g);
}

registerPlace({
  id: 'home',
  name: 'ドット荘（自宅）',
  kind: 'building',
  bgm: 'night',
  // living elsewhere, the door opens onto the corridor (someone else lives in the room now)
  get start() {
    const g = game();
    return g && g.state && !lives(g, 'dotsou') ? AWAY_START : HOME_START;
  },
  oyaTalk, // the landlady in front of ドット荘 (tokyo.js looks it up here)
  rooms: {
    room: {
      floor: 'floor_wood',
      wall: 'cream',
      tiles: [
        '################',
        '#cw=D=====w==p=#',
        '#kf...........B#',
        '#.............b#',
        '#..............#',
        '#S.............#',
        '#..........TP..#',
        '####M###########',
      ],
      legend: { k: 'kitchen', f: 'fridge', B: 'bed_top', b: 'bed_bottom', S: 'bookshelf', T: 'desk_pc', P: 'plant', D: 'wall_cream+home_bathdoor' },
      drawUnder: drawRug,
      entities: [
        closetProp(3, 2),
        { type: 'prop', x: 4, y: 4, draw: (ctx, sx, sy) => ctx.drawImage(tileImageHD('table_low'), sx, sy, 16, 16), text: 'ちゃぶ台だ。\n上京するとき、実家から持ってきた。' },
        // level 0: just moved in
        { type: 'prop', x: 6, y: 2, cond: below(1), draw: (ctx, sx, sy) => ctx.drawImage(tileImageHD('boxes'), sx, sy, 16, 16), text: '引っ越しの段ボールだ。\n荷ほどきは…また今度にしよう。' },
        { type: 'prop', x: 8, y: 2, cond: below(2), draw: (ctx, sx, sy, g) => ctx.drawImage(tileImageHD('tv', Math.floor(g.frame / 24) % 3), sx, sy, 16, 16), talk: watchTv },
        // level 1: rug (drawUnder) + plants
        { type: 'prop', x: 9, y: 2, cond: atLeast(1), draw: bigPlant, text: '大きな観葉植物だ。\n大家さんが選んでくれたらしい。' },
        { type: 'prop', x: 1, y: 4, cond: atLeast(1), draw: bigPlant, text: '観葉植物があると、部屋の空気がちがう気がする。' },
        // level 2: big TV + sofa
        {
          type: 'prop', x: 7, y: 2, w: 2, cond: atLeast(2), talk: watchTv,
          draw: (ctx, sx, sy, g) => { const f = Math.floor(g.frame / 40) % 3; blit(ctx, sprite('bigtv' + f, 32, 26, (c) => paintBigTv(c, f)), sx, sy - 10); },
        },
        { type: 'prop', x: 7, y: 4, w: 2, cond: atLeast(2), draw: (ctx, sx, sy) => blit(ctx, sprite('sofa', 32, 16, paintSofaBack), sx, sy), text: 'ふかふかのソファだ。\nここで大画面のテレビを見るのが、最高のぜいたく。' },
        // level 3: trophy shelf + gold frame (the frame is decoration; the shelf talks about both)
        { type: 'prop', x: 5, y: 2, w: 2, cond: atLeast(3), draw: (ctx, sx, sy) => blit(ctx, sprite('trophies', 32, 16, paintTrophies), sx, sy), talk: trophyTalk },
        { type: 'prop', x: 5, y: 1, w: 2, cond: atLeast(3), draw: (ctx, sx, sy, g) => drawGoldFrame(ctx, sx + 4, sy, g) },
        // furniture bought at the furniture store, and a better bed drawn over the old one
        ...furnitureProps('dotsou', DOTSOU_SLOTS),
        {
          type: 'prop', x: DOTSOU_BED.x, y: DOTSOU_BED.y, w: 1, h: 2, solid: false,
          cond: (g) => mine(g) && !!bedPiece(g),
          draw: (ctx, sx, sy, g) => { const id = bedPiece(g); if (id) drawFurniture(ctx, id, sx, sy, g, 1, 2); },
        },
      ],
      warps: [{ x: 4, y: 7, to: 'exit', check: async (g) => { await oyaCall(g); return true; } }],
      events: [
        { x: DOTSOU_BED.x, y: DOTSOU_BED.y, h: 2, on: 'action', run: bedAction },
        { x: 11, y: 6, on: 'action', run: pcMenu },
        { x: 1, y: 2, on: 'action', run: cook },
        { x: 2, y: 2, on: 'action', run: async (g) => { await g.say('冷蔵庫だ。\n商店街のスーパーで買った食材は、ここにしまってある。'); } },
        {
          x: 4, y: 1, on: 'action',
          run: (g) => takeBath(g, { name: 'ユニットバス', verb: 'シャワーを浴びる', stress: 3, lines: ['せまいユニットバスで、シャワーを浴びた。\nさっぱり！'] }),
        },
      ],
      onEnter: async (g) => {
        fixMaxStamina(g);
        if (!g.flag('intro')) {
          g.setFlag('intro');
          await intro(g); // the landlady explains the life basics on the first talk (home_v2told)
        }
        if (!mine(g)) return;
        await announceDelivery(g, 'dotsou');
        // first visit after upgrading (several levels bought at once: every change is described)
        const lv = homeLevel(g);
        const seen = Math.max(0, Number(g.flag('home_seen')) || 0);
        if (lv > seen) {
          g.setFlag('home_seen', lv);
          await g.wait(200);
          g.sfx('chime');
          await g.emote('player', '!');
          await g.say(HOME_UPGRADES.slice(seen, lv).map((u) => u.reveal));
        }
      },
    },
    // The outside corridor, shown instead of the room after moving out.
    rouka: {
      floor: 'floor_wood',
      wall: 'cream',
      tiles: [
        '##########',
        '#=D==w=D=#',
        '#........#',
        '#........#',
        '####M#####',
      ],
      legend: { D: 'wall_cream+door_wood' },
      entities: [
        { type: 'sign', x: 2, y: 1, text: '新しい住人の表札がかかっている。\n今は別の人が住んでいるみたいだ。\n（もとの部屋…なつかしいな）' },
        { type: 'sign', x: 7, y: 1, text: 'おとなりさんの部屋だ。\n中からギターの音が聞こえる。' },
      ],
      warps: [{ x: 4, y: 4, to: 'exit' }],
      // shown right after arriving (not awaited: the arrival itself is done)
      onEnter: (g) => {
        g.run(async () => {
          if (onceToday(g, 'home_roukaDay')) await g.say(['（ドット荘の廊下…。もとの部屋のドアには、\n新しい住人の表札がかかっている）', '今は別の人が住んでいるみたいだ。\n大家さんなら、アパートの前にいるはず。']);
          else await g.say('今は別の人が住んでいる。\n（大家さんは、アパートの前にいる）');
        });
      },
    },
  },
});
