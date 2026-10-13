// 自宅（ドット荘）: sleep, self-practice, intro event.

import { registerPlace } from '../engine/map.js';
import { SKILLS } from '../engine/state.js';
import { pick } from '../engine/util.js';

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

registerPlace({
  id: 'home',
  name: 'ドット荘（自宅）',
  kind: 'building',
  bgm: 'night',
  start: { room: 'room', x: 4, y: 6, dir: 'up' },
  rooms: {
    room: {
      floor: 'floor_wood',
      wall: 'cream',
      tiles: [
        '##########',
        '#=w==p=c=#',
        '#kf....tB#',
        '#.......b#',
        '#..T.....#',
        '#S.......#',
        '#......DP#',
        '####M#####',
      ],
      legend: { k: 'kitchen', f: 'fridge', t: 'tv', B: 'bed_top', b: 'bed_bottom', T: 'table_low', S: 'bookshelf', D: 'desk_pc', P: 'plant' },
      warps: [{ x: 4, y: 7, to: 'exit' }],
      events: [
        {
          x: 8, y: 2, h: 2, on: 'action',
          run: async (g) => {
            const i = await g.ask('ベッドだ。寝て体力を回復する？（次の日になります）', ['寝る', 'やめておく']);
            if (i !== 0) return;
            await g.sleep();
            await g.say(`${g.state.day}日目の朝だ！今日もがんばろう！`);
          },
        },
        {
          x: 7, y: 2, on: 'action',
          run: async (g) => {
            g.sfx('cursor');
            await g.say(['テレビをつけた。', pick(TV_TIPS)]);
          },
        },
        {
          x: 7, y: 6, on: 'action',
          run: async (g) => {
            const keys = Object.keys(SKILLS);
            const i = await g.ask('パソコンで動画を見ながら自主練しよう。（体力 -10・無料）', [...keys.map((k) => SKILLS[k] + 'の練習'), 'やめておく']);
            if (i < 0 || i >= keys.length) return;
            if (!g.useStamina(10)) { await g.say('体力が足りない…。今日はもう休もう。'); return; }
            await g.fadeOut(10);
            g.sfx('drum');
            await g.wait(400);
            await g.fadeIn(10);
            g.addSkill(keys[i], 1, true);
            await g.say(`自主練をした！${SKILLS[keys[i]]}が1上がった。（${g.state.skills[keys[i]]}）\nプロのレッスンを受ければ、もっと伸びるはず…！`);
          },
        },
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
        if (!g.flag('intro')) {
          g.setFlag('intro');
          await intro(g);
        }
      },
    },
  },
});
