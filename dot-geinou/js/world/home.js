// 自宅（ドット荘）: sleep, self-practice, premium coaching, closet, intro event,
// and the apartment upgrades sold by the landlady (大家さん, in front of ドット荘 in tokyo.js).
//
// flags: home_level (0..3, bought upgrades), home_seen (last level shown on entering),
//        home_called (level she called out about), home_told (level she hinted at),
//        home_pitched (level she made the full offer for), home_coachDay (day of the last premium coaching).

import { registerPlace } from '../engine/map.js';
import { SKILLS, SKILL_MAX, MAX_STAMINA } from '../engine/state.js';
import { tileImage, R, P, disc } from '../engine/tiles.js';
import { drawFace, LOOKS } from '../engine/sprites.js';
import { makeCanvas, fmtMoney, pick } from '../engine/util.js';
import { CreateScene } from '../title.js';

const TV_TIPS = [
  '『芸能ニュースです。よしもとのオーディションでは、ツッコミのタイミングが大切だそうです』',
  '『大阪・なんばの「よしもと新喜劇」では、今日も満員御礼！お約束のズッコケに大爆笑！』',
  '『NHKでは、アナウンサーの原稿読みも見どころ。難しい漢字の読みに注目です』',
  '『東映の撮影所では時代劇の殺陣（たて）の撮影が行われています。決めポーズがかっこいい！』',
  '『東宝のスタジオでは大迫力の怪獣映画を撮影中。ミュージカルの公演も好評です』',
  '『ホリプロ所属の新人歌手がデビュー！レッスンの積み重ねが実を結びました』',
  '『グレープカンパニーの芸人さんのグッズ、身につけると気合いが入ると評判です』',
  '『松竹芸能の若手芸人さんたち、大阪の劇場で腕を磨いているそうです』',
  '『BSよしもとでは、地域の魅力を伝える番組を放送中です』',
  '『疲れたときは、銭湯でひとっ風呂！コンビニのお弁当で体力回復もおすすめです』',
];

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

// Max stamina the bought upgrades give (old saves: level 0 -> 100).
function fixMaxStamina(g) {
  const lv = homeLevel(g);
  const want = lv ? HOME_UPGRADES[lv - 1].max : MAX_STAMINA;
  if (!(g.state.maxStamina >= want)) g.state.maxStamina = want;
}

function oyaSmallTalk(g) {
  const st = g.state;
  if (!st.agency && st.fame < 30) {
    return ['あら{name}ちゃん、おでかけ？', '芸能界で売れたいなら、\nまずは事務所に所属することね。', 'よしもとさん、グレープカンパニーさん、\nホリプロさん…\nこのあたりにいっぱいあるわよ。', '疲れたら部屋のベッドでゆっくり休むのよ。'];
  }
  if (st.fame < 250) return ['あら{name}ちゃん、お仕事がんばってるみたいね。', 'ちゃんとごはん食べてる？\n体が資本なんだから、無理しちゃだめよ。'];
  if (st.fame < 1000) return ['この前、テレビで{name}ちゃんを見たわよ！\nご近所さんに自慢しちゃった。'];
  if (st.fame < 2000) return ['ご近所さんに、{name}ちゃんのサインを頼まれて困ってるのよ〜。', '…あ、私の分もお願いね。'];
  return ['すっかりスターねえ。\nでも、ここが{name}ちゃんの家なのは変わらないわよ。'];
}

async function buildUpgrade(g, up, o) {
  const st = g.state;
  if (!g.spend(up.price)) { await g.say('あら、ちょっと足りないみたい。\nまた今度ね。', o); return false; }
  await g.say('じゃあ、さっそく業者さんを呼ぶわね〜！', o);
  await g.fadeOut(15);
  for (const s of ['hit', 'hit', 'drum']) { g.sfx(s); await g.wait(350); }
  g.setFlag('home_level', up.level);
  st.maxStamina = Math.max(st.maxStamina || MAX_STAMINA, up.max);
  await g.fadeIn(15);
  await g.say('トントン、カンカン…\nあっという間に工事が終わった！');
  g.sfx('fanfare');
  await g.say(`リフォーム完了！\n体力の最大値が${up.max}になった！\n（ベッドで寝ると${up.max}まで回復する）`);
  await g.say(up.after, o);
  g.save();
  return true;
}

// The landlady's talk (the NPC in front of ドット荘 in tokyo.js finds it on PLACES.home.oyaTalk).
// She only ever offers the next level, and hints at it once the player is close.
export async function oyaTalk(g, npc) {
  const st = g.state;
  const o = { name: (npc && npc.name) || '大家さん', look: (npc && npc.look) || LOOKS.oldwoman };
  const lv = homeLevel(g);
  const up = HOME_UPGRADES[lv];
  if (up && st.money >= up.price) {
    // the full pitch once per level; after that (e.g. she was turned down) just the question
    if (g.flag('home_pitched') === up.level) await g.say('あら{name}ちゃん！\nリフォームの件、考えてくれた？', o);
    else await g.say([lv ? 'あら{name}ちゃん、ちょうどよかった！\nまたリフォームのお話があるの。' : 'あら{name}ちゃん、ちょうどよかった！\nお部屋のリフォーム、してみない？', ...up.pitch], o);
    g.setFlag('home_told', up.level);
    g.setFlag('home_pitched', up.level);
    g.setFlag('home_called', up.level); // already asked in person: no call from the door
    const i = await g.ask(`「${up.name}」${fmtMoney(up.price)}よ。\n寝ると体力が${up.max}まで回復するようになるわ。\nどうする？`, ['お願いします', 'また今度'], o);
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
      `寝ると体力が${up.max}まで回復するようになるわ。\nあと${fmtMoney(up.price - st.money)}たまったら、声をかけてね。`,
    ], o);
  } else if (g.flag('home_told') === up.level) {
    await g.say(`「${up.name}」（${fmtMoney(up.price)}）の話、\nおぼえてる？いつでも待ってるわよ〜。`, o);
  }
}

// Leaving the room with enough money for the next level: she calls out once per level.
async function oyaCall(g) {
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
    'お仕事で知名度を上げて、称号をランクアップさせよう！\n部屋の外に出たら、街の人に話を聞いてみよう。',
  ]);
}

async function openCloset(g) {
  const i = await g.ask('クローゼットだ。\n着がえて、イメージチェンジする？', ['着がえる', 'やめておく']);
  if (i !== 0) return;
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
  await g.say([big ? '大画面のテレビをつけた。\nやっぱり迫力がちがう！' : 'テレビをつけた。', pick(TV_TIPS)]);
}

async function trophyTalk(g) {
  const st = g.state;
  await g.say([
    'トロフィー棚だ。上の金の額縁には、\n{name}のブロマイドが飾ってある。',
    `これまでのお仕事：${st.stats.jobs}回\n芸能生活：${st.day}日目\n…ここまで来たんだなあ。`,
  ]);
}

async function selfPractice(g) {
  const keys = Object.keys(SKILLS);
  const i = await g.ask('パソコンで動画を見ながら自主練しよう。\n（無料・体力 -10・スキル +1）', [...keys.map((k) => SKILLS[k] + 'の練習'), 'やめておく']);
  if (i < 0 || i >= keys.length) return;
  if (g.state.skills[keys[i]] >= SKILL_MAX) { await g.say(`${SKILLS[keys[i]]}はもう極めている！\nほかのスキルをみがこう。`); return; }
  if (!g.useStamina(10)) { await g.say('体力が足りない…。今日はもう休もう。'); return; }
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

async function coaching(g) {
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
  const room = SKILL_MAX - st.skills[k];
  if (room < COACH.gain) {
    const j = await g.ask(`${SKILLS[k]}は、あと${room}で極められる。\n受講料は${fmtMoney(COACH.price)}のまま。受ける？`, ['受ける', 'やめておく']);
    if (j !== 0) return;
  }
  g.spend(COACH.price);
  g.useStamina(COACH.stamina);
  g.setFlag('home_coachDay', st.day);
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

async function pcMenu(g) {
  const i = await g.ask('パソコンだ。なにをしよう？', ['自主練する', 'プロの個別指導', 'やめておく']);
  if (i === 0) await selfPractice(g);
  else if (i === 1) await coaching(g);
}

// ------------------------------------------------------------------ room art (props)
const sprites = new Map();
function sprite(key, w, h, fn) {
  let cv = sprites.get(key);
  if (!cv) {
    let c;
    [cv, c] = makeCanvas(w, h);
    fn(c);
    sprites.set(key, cv);
  }
  return cv;
}

function drawCloset(c) {
  R(c, 0, 1, 16, 24, '#4a2e18');
  R(c, 1, 0, 14, 2, '#a06c3c'); R(c, 1, 0, 14, 1, '#c48a52');
  R(c, 1, 2, 14, 21, '#8a5a33');
  for (const x of [2, 9]) {
    R(c, x, 3, 5, 19, '#b98552'); R(c, x, 3, 5, 1, '#d6a06a');
    R(c, x + 1, 5, 3, 7, '#a8774a'); R(c, x + 1, 14, 3, 6, '#a8774a');
  }
  R(c, 8, 3, 1, 19, '#5a3a20');
  R(c, 6, 11, 1, 3, '#e8c43a'); R(c, 10, 11, 1, 3, '#e8c43a');
  R(c, 1, 23, 14, 1, '#5a3a20');
  R(c, 2, 24, 2, 1, '#3b2a20'); R(c, 12, 24, 2, 1, '#3b2a20');
}

function drawBigPlant(c) {
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(3, 21, 10, 1);
  R(c, 4, 15, 8, 6, '#c9b48e'); R(c, 3, 15, 10, 2, '#e0d2b0'); R(c, 4, 19, 8, 1, '#a8956e');
  disc(c, 8, 9, 5, '#2f6b34'); disc(c, 5, 6, 3, '#3d8a44'); disc(c, 11, 5, 3, '#3d8a44'); disc(c, 8, 3, 3, '#4a9a4a');
  disc(c, 8, 9, 3, '#4a9a4a');
  for (const [x, y] of [[5, 5], [11, 4], [8, 2], [7, 8], [10, 10]]) P(c, x, y, '#74c26a');
  R(c, 7, 12, 2, 3, '#2f6b34');
}

const SCREENS = [
  (c) => { R(c, 3, 1, 26, 13, '#5fd7ff'); disc(c, 23, 5, 2, '#ffd23f'); R(c, 3, 10, 26, 4, '#5ee07a'); disc(c, 9, 11, 3, '#3d8a44'); },
  (c) => { R(c, 3, 1, 26, 13, '#2a1f30'); R(c, 12, 1, 8, 13, '#4a3a50'); R(c, 14, 6, 4, 6, '#ffd23f'); disc(c, 16, 5, 2, '#f6c9a0'); R(c, 3, 12, 26, 2, '#b8343c'); },
  (c) => { R(c, 3, 1, 26, 13, '#ff7eb6'); for (const [x, y] of [[6, 3], [12, 8], [20, 4], [25, 10], [16, 2]]) { P(c, x, y, '#ffffff'); P(c, x - 1, y, '#ffe0ef'); P(c, x + 1, y, '#ffe0ef'); } },
];
function drawBigTv(c, f) {
  R(c, 1, 17, 30, 8, '#5a3a20'); R(c, 1, 17, 30, 1, '#8a5a33'); R(c, 2, 19, 13, 5, '#6e4428'); R(c, 17, 19, 13, 5, '#6e4428');
  R(c, 8, 21, 2, 1, '#c9a227'); R(c, 22, 21, 2, 1, '#c9a227');
  R(c, 14, 15, 4, 2, '#20232a');
  R(c, 2, 0, 28, 16, '#20232a');
  SCREENS[f](c);
  R(c, 3, 1, 26, 1, 'rgba(255,255,255,0.25)');
  R(c, 27, 14, 2, 1, '#5ee07a');
}

function drawSofaBack(c) {
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(1, 15, 30, 1);
  const col = '#2f7a8a', dark = '#215a66', light = '#4fa0b0';
  R(c, 0, 4, 5, 11, dark); R(c, 0, 4, 5, 2, col);
  R(c, 27, 4, 5, 11, dark); R(c, 27, 4, 5, 2, col);
  R(c, 4, 1, 24, 13, col); R(c, 4, 1, 24, 3, light); R(c, 4, 4, 24, 1, dark);
  R(c, 15, 5, 2, 9, dark);
  R(c, 2, 15, 2, 1, '#3b2a20'); R(c, 28, 15, 2, 1, '#3b2a20');
}

function cup(c, x, y) {
  const gd = '#e8c43a', dk = '#c9a227';
  R(c, x, y, 5, 2, gd); P(c, x - 1, y, dk); P(c, x + 5, y, dk);
  R(c, x + 1, y + 2, 3, 1, gd); P(c, x + 2, y + 3, dk); R(c, x + 1, y + 4, 3, 1, dk);
  P(c, x, y, '#fff6a8');
}
function drawTrophyShelf(c) {
  R(c, 0, 0, 32, 16, '#6e4428'); R(c, 1, 1, 30, 13, '#2a2430'); R(c, 1, 7, 30, 1, '#8a5a33');
  cup(c, 3, 1); cup(c, 22, 1);
  // star on a stand
  R(c, 14, 3, 3, 3, '#ffd23f'); P(c, 15, 2, '#ffd23f'); P(c, 13, 4, '#ffd23f'); P(c, 17, 4, '#ffd23f'); P(c, 15, 6, '#c9a227');
  // gold disc, microphone, plaque
  disc(c, 6, 11, 2, '#e8c43a'); P(c, 6, 11, '#2a2430');
  R(c, 15, 9, 2, 2, '#e8c43a'); R(c, 15, 11, 1, 3, '#c9a227');
  R(c, 21, 9, 7, 5, '#c9a227'); R(c, 22, 10, 5, 3, '#e8c43a');
  for (let i = 0; i < 4; i++) P(c, 27 - i, 2 + i, 'rgba(255,255,255,0.35)');
  R(c, 0, 14, 32, 2, '#5a3a20');
}

function drawGoldFrame(ctx, x, y, g) {
  R(ctx, x, y, 24, 16, '#a8851c'); R(ctx, x + 1, y + 1, 22, 14, '#e8c43a'); R(ctx, x + 2, y + 2, 20, 12, '#fff0f5');
  P(ctx, x + 1, y + 1, '#fff6a8');
  drawFace(ctx, g.state.look || {}, x + 4, y + 2, 1);
  if (Math.floor(g.frame / 30) % 4 === 0) { P(ctx, x + 22, y, '#ffffff'); P(ctx, x + 21, y + 1, '#ffffff'); P(ctx, x + 23, y + 1, '#ffffff'); }
}

function drawRug(ctx, g, cam) {
  const lv = homeLevel(g);
  if (lv < 1) return;
  const x = 3 * 16 + 2 - cam.x, y = 4 * 16 - 6 - cam.y, w = 44, h = 34;
  R(ctx, x, y, w, h, '#a8343f'); R(ctx, x + 2, y + 2, w - 4, h - 4, '#e07a8a');
  R(ctx, x + 5, y + 5, w - 10, h - 10, '#f2b8c0'); R(ctx, x + 7, y + 7, w - 14, h - 14, '#e07a8a');
  for (let i = 2; i < h - 2; i += 3) { P(ctx, x - 1, y + i, '#f6e7c8'); P(ctx, x + w, y + i, '#f6e7c8'); }
  // floor cushions (zabuton) on either side of the low table
  for (const [cx, col] of [[3 * 16 + 4, '#7a4fa0'], [5 * 16 + 2, '#ff8a3d']]) {
    R(ctx, cx - cam.x, 4 * 16 + 4 - cam.y, 10, 9, col);
    R(ctx, cx + 1 - cam.x, 4 * 16 + 5 - cam.y, 8, 1, 'rgba(255,255,255,0.3)');
    P(ctx, cx + 5 - cam.x, 4 * 16 + 8 - cam.y, '#ffd23f');
  }
}

const atLeast = (n) => (g) => homeLevel(g) >= n;
const below = (n) => (g) => homeLevel(g) < n;
const tileProp = (id) => (ctx, sx, sy) => ctx.drawImage(tileImage(id), sx, sy);

registerPlace({
  id: 'home',
  name: 'ドット荘（自宅）',
  kind: 'building',
  bgm: 'night',
  start: { room: 'room', x: 4, y: 6, dir: 'up' },
  oyaTalk, // the landlady in front of ドット荘 (tokyo.js looks it up here)
  rooms: {
    room: {
      floor: 'floor_wood',
      wall: 'cream',
      tiles: [
        '############',
        '#cw=p=====w#',
        '#kf.......B#',
        '#.........b#',
        '#..........#',
        '#S.........#',
        '#........DP#',
        '####M#######',
      ],
      legend: { k: 'kitchen', f: 'fridge', B: 'bed_top', b: 'bed_bottom', S: 'bookshelf', D: 'desk_pc', P: 'plant' },
      drawUnder: drawRug,
      entities: [
        { type: 'prop', x: 3, y: 2, draw: (ctx, sx, sy) => ctx.drawImage(sprite('closet', 16, 25, drawCloset), sx, sy - 9), talk: openCloset },
        { type: 'prop', x: 4, y: 4, draw: tileProp('table_low'), text: 'ちゃぶ台だ。\n上京するとき、実家から持ってきた。' },
        // level 0: just moved in
        { type: 'prop', x: 6, y: 2, cond: below(1), draw: tileProp('boxes'), text: '引っ越しの段ボールだ。\n荷ほどきは…また今度にしよう。' },
        { type: 'prop', x: 8, y: 2, cond: below(2), draw: (ctx, sx, sy, g) => ctx.drawImage(tileImage('tv', Math.floor(g.frame / 24) % 3), sx, sy), talk: watchTv },
        // level 1: rug (drawUnder) + plants
        { type: 'prop', x: 9, y: 2, cond: atLeast(1), draw: (ctx, sx, sy) => ctx.drawImage(sprite('bigplant', 16, 22, drawBigPlant), sx, sy - 6), text: '大きな観葉植物だ。\n大家さんが選んでくれたらしい。' },
        { type: 'prop', x: 1, y: 4, cond: atLeast(1), draw: (ctx, sx, sy) => ctx.drawImage(sprite('bigplant', 16, 22, drawBigPlant), sx, sy - 6), text: '観葉植物があると、部屋の空気がちがう気がする。' },
        // level 2: big TV + sofa
        {
          type: 'prop', x: 7, y: 2, w: 2, cond: atLeast(2), talk: watchTv,
          draw: (ctx, sx, sy, g) => { const f = Math.floor(g.frame / 40) % 3; ctx.drawImage(sprite('bigtv' + f, 32, 26, (c) => drawBigTv(c, f)), sx, sy - 10); },
        },
        { type: 'prop', x: 7, y: 4, w: 2, cond: atLeast(2), draw: (ctx, sx, sy) => ctx.drawImage(sprite('sofa', 32, 16, drawSofaBack), sx, sy), text: 'ふかふかのソファだ。\nここで大画面のテレビを見るのが、最高のぜいたく。' },
        // level 3: trophy shelf + gold frame (the frame is decoration; the shelf talks about both)
        { type: 'prop', x: 5, y: 2, w: 2, cond: atLeast(3), draw: (ctx, sx, sy) => ctx.drawImage(sprite('trophies', 32, 16, drawTrophyShelf), sx, sy), talk: trophyTalk },
        { type: 'prop', x: 5, y: 1, w: 2, cond: atLeast(3), draw: (ctx, sx, sy, g) => drawGoldFrame(ctx, sx + 4, sy, g) },
      ],
      warps: [{ x: 4, y: 7, to: 'exit', check: async (g) => { await oyaCall(g); return true; } }],
      events: [
        {
          x: 10, y: 2, h: 2, on: 'action',
          run: async (g) => {
            const i = await g.ask('ベッドだ。寝て体力を回復する？（次の日になります）', ['寝る', 'やめておく']);
            if (i !== 0) return;
            await g.sleep();
            await g.say(`${g.state.day}日目の朝だ！今日もがんばろう！`);
          },
        },
        { x: 9, y: 6, on: 'action', run: pcMenu },
        {
          x: 1, y: 2, on: 'action',
          run: async (g) => {
            const i = await g.ask('キッチンだ。自炊する？（¥100・体力+15）', ['つくる', 'やめておく']);
            if (i !== 0) return;
            if (g.mealsLeft() <= 0) { await g.say('おなかいっぱいだ…。\n今日はもう食べられない。'); return; }
            if (g.state.stamina >= g.state.maxStamina) { await g.say('体力は満タンだ。\nまたおなかがすいたら作ろう。'); return; }
            if (!g.spend(100)) { await g.say('食材を買うお金もない…'); return; }
            const got = g.eat(15, { silent: true });
            g.sfx('good');
            await g.say(`もやし炒めを作って食べた！体力が${got}回復した。`);
          },
        },
      ],
      onEnter: async (g) => {
        fixMaxStamina(g);
        if (!g.flag('intro')) {
          g.setFlag('intro');
          await intro(g);
        }
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
  },
});
