// ドット自動車教習所 (owner: R8-L1) — the driving school. Tokyo, 劇場通り (js/world/tokyo.js adds the door).
//
//   lobby      受付・待合（受付の水野さん：入所・予約・進み具合・精算／掲示板）
//   kyoshitsu  学科教室（桐生 教官：学科教習・仮免学科試験）
//   course     教習コース（屋外：岩城／千葉 教官：技能教習・修了検定・卒業検定。教習車）
//   simu       シミュレーター室（無料の練習：'driving' の practice）
//
// Everything is in js/engine/license_flow.js (the scenes), license.js (the rules, fees, state) and the minigame 'driving'
// (js/minigames/driving.js; until it exists a short quiz stands in). The people are fictional.
// This file also exports the room builders the 合宿先 (gassyuku.js) reuses.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { taxi } from '../world/props.js';
import { FLOW, lic, schoolOf, progressText, SCHOOL_NAME, runDriving, eraId, hmText, CAMP_DAYS } from '../engine/license.js';
import '../engine/license_exam.js';
import '../engine/license_flow.js';
import { WHO } from '../engine/license_flow.js';

const sign = (x, y, t) => ({ type: 'sign', x, y, text: t });
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
const first = (g, key, msg) => { if (!g.flag(key)) { g.setFlag(key, true); g.notify(msg, { color: '#ffd23f', life: 260 }); } };

// the car of the course: the era's model (昭和 セダン / 平成 / 令和 コンパクト) is the colour here
export function schoolCar(x, y, g) {
  return taxi(x, y, '#f2f2f6', { text: ['教習車だ。助手席側にも補助ブレーキがついている。', '「仮免許練習中」の標識が前と後ろに貼ってある。'] });
}

// ---------------------------------------------------------------- rooms the camp reuses
export function classroomRoom(back, backSpot) {
  return {
    wall: 'white', floor: 'floor_wood',
    tiles: [
      '##############',
      '#=w=WWWWWW=w=#',
      '#............#',
      '#............#',
      '#.hh.hh.hh.hh#',
      '#............#',
      '#.hh.hh.hh.hh#',
      '#............#',
      '#P..........P#',
      '######MM######',
    ],
    legend: { W: 'wall_white+whiteboard', h: 'chair', P: 'plant' },
    warps: [{ x: 6, y: 9, ...back }, { x: 7, y: 9, ...back }],
    entities: [
      npc('ky_gaku', 6, 2, 'down', WHO.gaku, { talk: (g) => FLOW.classNpc(g) }),
      npc('ky_s1', 2, 5, 'up', { name: '教習生', look: { ...LOOKS.fan, top: '#2f9a8a' } }, { text: ['学科教習、眠くなるんですよね…。', '教官のお話は、問題によく出るところばかり。ノートを取っておくと、仮免の試験が楽ですよ。'] }),
      npc('ky_s2', 9, 7, 'up', { name: '教習生', look: { ...LOOKS.salaryman, top: '#8a5ac8' } }, { text: ['仕事の合間に通ってるんです。', '予約を取るのが一番大変で…。'] }),
      sign(4, 1, 'ホワイトボードに「本日の学科：応急救護処置 / 危険予測」と書いてある。'),
    ],
    events: [{ x: 4, y: 1, w: 6, on: 'action', run: async (g) => { await g.say(['ホワイトボードだ。', '学科教習は、50分ごとに1コマ。\n第1段階で3コマ、第2段階でも3コマほど受ける。', '仮免の学科試験は50問・90%以上で合格だ。']); } }],
  };
}
export function courseRoom(back) {
  return {
    outdoor: true,
    wall: 'gray', floor: 'road', bg: '#4b8a4a',
    tiles: [
      '####################',
      '#=g==w==w==w==w==w=#',
      'H..................H',
      'H..c.c.c.c.c.c.....H',
      'H..................H',
      'H.LLLL....cc....LL.H',
      'H..................H',
      'H...c........c.....H',
      'H..................H',
      'H..................H',
      'HHHHHHHHHHHHHHHHHHHH',
    ],
    legend: { H: 'hedge', c: 'cone', L: 'road_line_h' },
    warps: [{ x: 2, y: 1, ...back }],
    entities: [
      npc('ky_k1', 8, 8, 'left', WHO.kyokan, { talk: (g) => FLOW.courseNpc(g) }),
      npc('ky_k2', 14, 6, 'down', WHO.kentei, { text: ['検定員の榊原です。', '修了検定と卒業検定は、持ち点100点からの減点方式。\n合格は70点以上。第二種は80点以上です。', '一時停止の違反や信号無視は、その場で検定中止。気をつけて。'] }),
      schoolCar(5, 8),
      sign(2, 2, '建物の出入口だ。受付や教室は、この中。'),
    ],
    events: [],
  };
}

// ---------------------------------------------------------------- the school
registerPlace({
  id: 'kyoshujo', name: SCHOOL_NAME, kind: 'building', bgm: 'kyoshujo',
  start: { room: 'lobby', x: 7, y: 9, dir: 'up' },
  rooms: {
    lobby: {
      wall: 'blue', floor: 'floor_tile',
      tiles: [
        '################',
        '#=d=p=c=g=p=d==#',
        '#..............#',
        '#.KKKKK........#',
        '#..............#',
        '#.SS......VV...#',
        '#..............#',
        '#.SS.......P...#',
        '#..............#',
        '#P...........BP#',
        '#######MM#######',
      ],
      legend: { K: 'counter', S: 'bench', V: 'vending', P: 'plant', B: 'bookshelf' },
      warps: [
        { x: 7, y: 10, to: 'exit' }, { x: 8, y: 10, to: 'exit' },
        { x: 2, y: 1, room: 'kyoshitsu', tx: 6, ty: 7, dir: 'up' },
        { x: 8, y: 1, room: 'course', tx: 2, ty: 2, dir: 'down' },
        { x: 12, y: 1, room: 'simu', tx: 5, ty: 6, dir: 'up' },
      ],
      entities: [
        npc('ky_desk', 4, 2, 'down', WHO.uketsuke, { talk: (g) => FLOW.schoolDesk(g) }),
        npc('ky_l1', 3, 6, 'right', { name: '教習生', look: { ...LOOKS.fan, top: '#ff9a3c' } }, { wander: 1, text: ['予約、なかなか取れなくて…。', 'あしたは学科と技能、両方入れたんです。'] }),
        npc('ky_l2', 12, 8, 'up', { name: '卒業間近の人', look: { ...LOOKS.salaryman, top: '#2f6fd0' } }, { text: ['来週、卒業検定なんです。', '路上は、歩行者や自転車がいちばん怖い。声に出して確認するのがコツって、教官が。'] }),
        sign(3, 1, '「ドット自動車教習所」のプレートだ。'),
      ],
      events: [
        { x: 10, y: 1, on: 'action', run: async (g) => { await g.say(['掲示板だ。「教習の流れ」', '①入所・適性検査　②第1段階（学科・所内技能）　③修了検定　④仮免学科試験（90%以上）→ 仮免許\n⑤第2段階（路上・応急救護）　⑥卒業検定（70点以上）　⑦免許センターで学科試験 → 免許証', 'ほかに「通学（1〜3か月）」と「合宿（最短2週間）」がある。受付で相談しよう。']); } },
        { x: 13, y: 9, on: 'action', run: async (g) => {
          const i = await g.ask('学科の問題集の棚だ。\n「○×問題集」を開いて、10問練習する？', ['練習する', 'やめておく'], { cancel: 1 });
          if (i === 0) await FLOW.practiceExam(g);
        } },
        { x: 6, y: 1, on: 'action', run: async (g) => { const s = schoolOf(g); await g.say(['時計だ。受付は午前9時から午後7時まで。', s ? `進み具合：${progressText(g)}` : '入所の相談は、受付で。']); } },
      ],
      onEnter: async (g) => {
        first(g, 'ky_first', `${SCHOOL_NAME}。受付で入所の相談ができる`);
      },
    },
    kyoshitsu: classroomRoom({ room: 'lobby', tx: 2, ty: 2, dir: 'down' }),
    course: courseRoom({ room: 'lobby', tx: 8, ty: 2, dir: 'down' }),
    simu: {
      wall: 'dark', floor: 'floor_wood_dark',
      tiles: [
        '############',
        '#=c=p==p=c=#',
        '#..........#',
        '#.DD.DD.DD.#',
        '#.hh.hh.hh.#',
        '#..........#',
        '#P........P#',
        '#####MM#####',
      ],
      legend: { D: 'desk_pc', h: 'chair', P: 'plant', c: 'wall_dark+clock' },
      warps: [{ x: 5, y: 7, room: 'lobby', tx: 12, ty: 2, dir: 'down' }, { x: 6, y: 7, room: 'lobby', tx: 12, ty: 2, dir: 'down' }],
      entities: [
        npc('ky_sim', 9, 5, 'left', { name: 'シミュレーター係', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#2a2d36' } }, {
          talk: async (g) => {
            await g.say(['シミュレーター室です。ハンドルとペダルの練習用。', '成績には入らない、気軽な練習ですよ。']);
            const i = await g.ask('練習しますか？', ['やってみる', 'やめておく'], { cancel: 1 });
            if (i !== 0) return;
            const r = await runDriving(g, { stage: 'lesson1', course: 'basic', practice: true, difficulty: 1, title: 'シミュレーター練習', minutes: 30 });
            g.relax({ stress: 2 });
            await g.say(r.points >= 80 ? 'いい感じです。本番の教習でも、その調子で。' : 'お疲れさま。何度でも練習できますよ。');
          },
        }),
        sign(4, 2, 'シミュレーターのモニターに「安全確認、合図、発進」の文字が流れている。'),
      ],
    },
  },
});
