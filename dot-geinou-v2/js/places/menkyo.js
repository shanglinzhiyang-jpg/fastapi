// ドット運転免許センター (owner: R8-L1) — the 運転免許試験場. Tokyo, south-east strip behind the railway (js/world/tokyo.js adds the door).
//
//   lobby      総合受付（小松さん：本免・原付の手続き、更新、免許証を見る）／案内の掲示
//   tekisei    適性検査（視力・色彩識別・聴力・運動能力：minigame 'license_check'）
//   shiken     学科試験場（minigame 'license_exam'：仮免 50問・本免・第二種・原付、90%以上で合格）
//   koufu      交付窓口（写真・交付時講習・原付講習・免許証の交付：license_card.js）
//
// The procedure itself is js/engine/license_flow.js (centerDesk / procedure): 適性検査 → 学科試験（1日1回）→ 写真・交付時講習 →
// 免許証の交付。受付は平日 9:00–16:00（土日は休み）。Everyone here is fictional.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { FLOW, CENTER_NAME, lic } from '../engine/license.js';
import '../engine/license_exam.js';
import '../engine/license_flow.js';
import { WHO } from '../engine/license_flow.js';

const sign = (x, y, t) => ({ type: 'sign', x, y, text: t });
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });

registerPlace({
  id: 'menkyo', name: CENTER_NAME, kind: 'building', bgm: 'menkyo',
  start: { room: 'lobby', x: 7, y: 9, dir: 'up' },
  rooms: {
    lobby: {
      wall: 'gray', floor: 'floor_marble',
      tiles: [
        '################',
        '#=d=p=c=b=p=g=d#',
        '#..............#',
        '#...KKKKKK.....#',
        '#..............#',
        '#.SSSS....VV...#',
        '#..............#',
        '#.SSSS.....P...#',
        '#..............#',
        '#P............P#',
        '#######MM#######',
      ],
      legend: { K: 'counter_white', S: 'bench', V: 'vending', P: 'plant', b: 'wall_gray+whiteboard' },
      warps: [
        { x: 7, y: 10, to: 'exit' }, { x: 8, y: 10, to: 'exit' },
        { x: 2, y: 1, room: 'tekisei', tx: 5, ty: 6, dir: 'up' },
        { x: 12, y: 1, room: 'shiken', tx: 7, ty: 6, dir: 'up' },
        { x: 14, y: 1, room: 'koufu', tx: 7, ty: 7, dir: 'up' },
      ],
      entities: [
        npc('mk_desk', 6, 2, 'down', WHO.c_uketsuke, { talk: (g) => FLOW.centerDesk(g) }),
        npc('mk_guide', 9, 6, 'left', { name: '案内係', look: { ...LOOKS.staff, top: '#2f6fd0', hat: '#2f6fd0' } }, {
          text: ['いらっしゃいませ。', '左の部屋が適性検査、まん中が学科試験場、右が交付の窓口です。\n手続きは、まず総合受付で。', '受付は平日の午前9時から午後4時まで。土日はお休みです。'],
        }),
        npc('mk_a1', 3, 6, 'right', { name: '受験者', look: { ...LOOKS.fan, top: '#5fd7ff' } }, { wander: 1, text: ['今日、本免の学科試験なんです。', '合宿のときのノートを、見返してきました。90%以上って、けっこう厳しいですよね。'] }),
        npc('mk_a2', 12, 8, 'up', { name: '更新に来た人', look: { ...LOOKS.salaryman, top: '#8a7a5a' } }, { text: ['免許の更新です。', '更新のたびに写真を撮り直すのが、ちょっと気恥ずかしくて。'] }),
        sign(4, 1, '時計だ。学科試験は、おひとり1日1回まで。'),
      ],
      events: [
        { x: 8, y: 1, on: 'action', run: async (g) => { await g.say(['掲示板だ。', '【免許試験のご案内】\n受付：平日 午前9時〜午後4時（土日・祝日はお休み）\n学科試験：一種 文章問題とイラスト問題、90%以上で合格（1日1回）', '教習所を卒業した人は、卒業証明書を持って、卒業から1年以内に。\n原付免許は、教習所に通わず、ここで学科試験と原付講習を受けます。']); } },
      ],
      onEnter: async (g) => {
        if (!g.flag('mk_first')) { g.setFlag('mk_first', true); g.notify(`${CENTER_NAME}。総合受付で手続きができる`, { color: '#ffd23f', life: 260 }); }
      },
    },
    tekisei: {
      wall: 'white', floor: 'floor_tile',
      tiles: [
        '############',
        '#=p=c==w=p=#',
        '#..........#',
        '#.DD...DD..#',
        '#.hh...hh..#',
        '#..........#',
        '#P........P#',
        '#####MM#####',
      ],
      legend: { D: 'desk_pc', h: 'chair', P: 'plant', c: 'wall_white+clock' },
      warps: [{ x: 5, y: 7, room: 'lobby', tx: 2, ty: 2, dir: 'down' }, { x: 6, y: 7, room: 'lobby', tx: 2, ty: 2, dir: 'down' }],
      entities: [
        npc('mk_apt', 5, 2, 'down', WHO.c_kakari, { text: ['適性検査の部屋です。', '視力、色彩識別、聴力、運動能力。\n眼鏡やコンタクトは、つけたままで大丈夫ですよ。\n受付で手続きをすると、ここに案内されます。'] }),
        sign(3, 2, '視力検査の機械だ。輪の切れ目の向きを答える。'),
      ],
    },
    shiken: {
      wall: 'cream', floor: 'floor_carpet_gray',
      tiles: [
        '################',
        '#=w=pp=c=pp=w=w#',
        '#..............#',
        '#.......KKK....#',
        '#..............#',
        '#.DD.DD..DD.DD.#',
        '#.hh.hh..hh.hh.#',
        '#..............#',
        '#.DD.DD..DD.DD.#',
        '#.hh.hh..hh.hh.#',
        '#######MM#######',
      ],
      legend: { K: 'counter', D: 'desk', h: 'chair', c: 'wall_cream+clock' },
      warps: [{ x: 7, y: 10, room: 'lobby', tx: 12, ty: 2, dir: 'down' }, { x: 8, y: 10, room: 'lobby', tx: 12, ty: 2, dir: 'down' }],
      entities: [
        npc('mk_exam', 8, 2, 'down', WHO.c_shiken, { text: ['試験場です。手続きがすんだ人から、席についてもらいます。', 'スマホや参考書は、かばんの中へ。\n時間は30分。90%以上で合格です。', '（受付で手続きをすると、試験が始まる）'] }),
        npc('mk_stu1', 3, 6, 'up', { name: '受験者', look: { ...LOOKS.fan, top: '#ff9ab8' } }, { text: ['…（ぶつぶつ、標識の意味を復習している）'] }),
      ],
    },
    koufu: {
      wall: 'cream', floor: 'floor_wood',
      tiles: [
        '##############',
        '#=w=p==c=w=p=#',
        '#............#',
        '#.KKKK.KKKK..#',
        '#............#',
        '#.hh.hh.hh...#',
        '#.hh.hh.hh...#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { K: 'counter_white', h: 'chair', P: 'plant', c: 'wall_cream+clock' },
      warps: [{ x: 6, y: 8, room: 'lobby', tx: 14, ty: 2, dir: 'down' }, { x: 7, y: 8, room: 'lobby', tx: 14, ty: 2, dir: 'down' }],
      entities: [
        npc('mk_koufu', 3, 2, 'down', WHO.c_koufu, { text: ['交付の窓口です。', '学科試験に合格した人は、写真を撮って、交付時講習を受けて、免許証を受け取ります。\n受付で手続きをすると、ここで順番に。'] }),
        npc('mk_koufu2', 9, 2, 'down', { name: '講習の係員', look: { ...LOOKS.staff, top: '#8a5ac8' } }, { text: ['交付時講習では、免許を取ったばかりの人に、事故の実例を見てもらいます。', 'これで運転を始める人は、みんな受けるんですよ。'] }),
        sign(5, 1, '免許証の見本が飾ってある。ブルー、ゴールド…。「優良運転者はゴールド免許」と説明がある。'),
      ],
    },
  },
});
