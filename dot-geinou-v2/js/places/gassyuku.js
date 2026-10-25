// ドット合宿教習所 (owner: R8-L1) — the 合宿 school with a dormitory, far from Tokyo (山形・蔵王 / 長野・高原 / 熊本・阿蘇: the player picks).
// Not a town of its own: a train + bus ride away (license_flow.js goCamp, 4 hours on the clock), one yard, one school building and a dorm.
//
//   yard       校庭（屋外）：本館・寮・食堂の入口、門（帰る／途中でやめる）
//   lobby      本館の受付（今日のカリキュラム：学科・技能・検定を、おまかせで全部／選んで）
//   kyoshitsu  学科教室       course  教習コース（屋外）   — the same rooms as the Tokyo school (kyoshujo.js builders)
//   hall       談話室（夜の寮：仲間たち）   room  寮の部屋（ベッドで寝ると次の日）   shokudo  食堂（食事は無料、朝・昼・夕に1回ずつ）
//
// While the camp lasts: rent was paid in advance, the regular shows are paused (no penalty), the morning hooks do not run
// (custody-style days, license_flow.js campSleep). The camp's days: AT 5 / MT 6 game days (3 calendar days each ≈ 14 / 16 days).
// Everyone here is fictional.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { FLOW, SITES, lic, schoolOf } from '../engine/license.js';
import '../engine/license_exam.js';
import '../engine/license_flow.js';
import { WHO, MATES } from '../engine/license_flow.js';
import { classroomRoom, courseRoom } from './kyoshujo.js';

const sign = (x, y, t) => ({ type: 'sign', x, y, text: t });
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
function devCamp(g) {
  const d = g.state.day;
  lic(g).school = {
    cls: 'futsu', mt: false, kind: 'gassyuku', site: 'zao', enrolled: d, fee: 0, done: {}, ken1: 0, kari: 0, ken2: 0, cert: 0, fails: { ken1: 0, kari: 0, ken2: 0 }, need: { hoshu: 0 },
    t: { day: 0, gi: 0, gaku: 0, ken: 0 }, lastLesson: 0, cond: [], special: false, booking: null, score: { gaku: 0, n: 0 }, gradDay: 0, extended: 0,
    camp: { start: d, planned: 5, extra: 0, day: 1, arrived: true, end: 0, prepaid: 0, meals: 0, vignette: 0, slotsDay: 0, slots: [] },
  };
}
const inCamp = (g) => { const s = schoolOf(g); return !!s && !!s.camp && s.camp.arrived; };

const W = 22;
function yardRows() {
  const rows = [];
  rows.push('#'.repeat(W));
  const r1 = Array.from({ length: W }, (_, x) => (x === 0 || x === W - 1 ? '#' : x % 2 === 1 ? '=' : 'w'));
  for (const x of [4, 11, 18]) r1[x] = 'g';
  rows.push(r1.join(''));
  const mid = (extra) => {
    const r = Array.from({ length: W }, (_, x) => (x === 0 || x === W - 1 ? 'T' : '.'));
    for (const [x, c] of extra) r[x] = c;
    return r.join('');
  };
  rows.push(mid([[4, 'p'], [11, 'p'], [18, 'p']]));
  rows.push(mid([[4, 'p'], [11, 'p'], [18, 'p'], [1, 'f'], [20, 'f']]));
  rows.push(mid([[4, 'p'], [5, 'p'], [6, 'p'], [7, 'p'], [8, 'p'], [9, 'p'], [10, 'p'], [11, 'p'], [12, 'p'], [13, 'p'], [14, 'p'], [15, 'p'], [16, 'p'], [17, 'p'], [18, 'p']]));
  rows.push(mid([[10, 'p'], [11, 'p'], [3, 'b'], [19, 'b']]));
  rows.push(mid([[10, 'p'], [11, 'p'], [2, 'f'], [8, 'f'], [14, 'f']]));
  rows.push(mid([[10, 'p'], [11, 'p'], [16, 'b']]));
  rows.push(mid([[10, 'p'], [11, 'p'], [5, 'f'], [17, 'f']]));
  rows.push(mid([[10, 'p'], [11, 'p']]));
  rows.push('T'.repeat(W));
  return rows;
}

registerPlace({
  id: 'gassyuku',
  get name() {
    const g = typeof window !== 'undefined' ? window.__game : null;
    const s = g && g.state && g.state.license && g.state.license.school;
    const site = (s && SITES[s.site]) || SITES.zao;
    return `ドット合宿教習所（${site.name}）`;
  },
  kind: 'building', bgm: 'gassyuku', noTrip: true,
  start: { room: 'yard', x: 10, y: 7, dir: 'up' },
  rooms: {
    yard: {
      outdoor: true, wall: 'cream', floor: 'grass', bg: '#6fb86a',
      tiles: yardRows(),
      legend: { T: 'tree', p: 'path', f: 'flowers', b: 'bench', 'g': 'door_glass' },
      warps: [
        { x: 4, y: 1, room: 'lobby', tx: 8, ty: 8, dir: 'up' },
        { x: 11, y: 1, room: 'hall', tx: 6, ty: 6, dir: 'up' },
        { x: 18, y: 1, room: 'shokudo', tx: 6, ty: 6, dir: 'up' },
      ],
      entities: [
        npc('gs_guard', 12, 8, 'left', { name: '門の守衛さん', look: { ...LOOKS.guard, hat: '#3b3f48' } }, { talk: (g) => FLOW.campGate(g) }),
        npc('gs_y1', 7, 4, 'down', MATES[0], { wander: 2, text: ['朝の散歩。空気がおいしい！', '東京とは全然ちがうなあ。'] }),
        npc('gs_y2', 15, 6, 'left', MATES[1], { wander: 1, text: ['午後の教習まで、ひとやすみ。', 'ここ、夜は星がすごいんだよ。'] }),
        sign(4, 2, '「本館」教習の受付と学科教室、教習コース。'),
        sign(11, 2, '「寮」ここで寝泊まりする。談話室と、自分の部屋。'),
        sign(18, 2, '「食堂」食事は朝・昼・夕に1回ずつ（料金は合宿代にふくまれている）。'),
      ],
      // the gate (the bottom of the path): stepping out asks whether to go home
      events: [{ x: 10, y: 9, w: 2, on: 'step', run: async (g) => { await FLOW.campGate(g); } }],
      onEnter: async (g) => {
        if (!inCamp(g)) {
          // ?test=1 (tools/inspect.mjs, screenshots): a pretend camp, so the place can be looked at without enrolling
          if (!schoolOf(g) && typeof location !== 'undefined' && /[?&]test=/.test(location.search)) devCamp(g);
          else {
            await g.say('（合宿の手続きがない…。東京に帰ろう）');
            await FLOW.leaveCamp(g, false);
            return;
          }
        }
        const s = schoolOf(g);
        if (!g.flag('gs_first_' + s.camp.start)) { g.setFlag('gs_first_' + s.camp.start, true); g.notify(`合宿 ${s.camp.day}日目（予定${s.camp.planned + s.camp.extra}日）`, { color: '#ffd23f', life: 260 }); }
      },
    },
    lobby: {
      wall: 'blue', floor: 'floor_tile',
      tiles: [
        '################',
        '#=d=p=c=g=p=w==#',
        '#..............#',
        '#...KKKK.......#',
        '#..............#',
        '#.SS......VV...#',
        '#..............#',
        '#.SS.......P...#',
        '#..............#',
        '#P............P#',
        '#######MM#######',
      ],
      legend: { K: 'counter', S: 'bench', V: 'vending', P: 'plant' },
      warps: [
        { x: 7, y: 10, room: 'yard', tx: 4, ty: 2, dir: 'down' }, { x: 8, y: 10, room: 'yard', tx: 4, ty: 2, dir: 'down' },
        { x: 2, y: 1, room: 'kyoshitsu', tx: 6, ty: 7, dir: 'up' },
        { x: 8, y: 1, room: 'course', tx: 2, ty: 2, dir: 'down' },
      ],
      entities: [
        npc('gs_desk', 5, 2, 'down', WHO.uketsuke, { talk: (g) => FLOW.campDesk(g) }),
        npc('gs_l1', 12, 8, 'up', MATES[2], { text: ['明日は修了検定…。', 'ほんとに、持ち点100点からの減点なんだよね。コーンに触らないようにしないと。'] }),
        sign(4, 1, '「ドット合宿教習所」のプレートだ。'),
      ],
      events: [{ x: 10, y: 1, on: 'action', run: async (g) => { await g.say(['掲示板だ。', '【合宿のきまり】\n朝食 7:30　教習 9:00〜18:00　夕食 18:30　消灯 22:00', '検定に落ちると、延泊になります。（1日 9,000円）']); } }],
    },
    kyoshitsu: classroomRoom({ room: 'lobby', tx: 2, ty: 2, dir: 'down' }),
    course: courseRoom({ room: 'lobby', tx: 8, ty: 2, dir: 'down' }),
    hall: {
      wall: 'wood', floor: 'floor_carpet_beige',
      tiles: [
        '##############',
        '#=w=p==c=d=w=#',
        '#............#',
        '#.sssS...TT..#',
        '#............#',
        '#.V.......VV.#',
        '#............#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { s: 'sofa', S: 'sofa_blue', T: 'table', V: 'vending', P: 'plant', c: 'wall_wood+clock' },
      warps: [
        { x: 6, y: 8, room: 'yard', tx: 11, ty: 2, dir: 'down' }, { x: 7, y: 8, room: 'yard', tx: 11, ty: 2, dir: 'down' },
        { x: 9, y: 1, room: 'room', tx: 3, ty: 5, dir: 'up' },
      ],
      entities: [
        npc('gs_h1', 3, 4, 'down', MATES[0], { talk: (g) => FLOW.campVignette(g) }),
        npc('gs_h2', 6, 4, 'down', MATES[1], { talk: (g) => FLOW.campVignette(g) }),
        npc('gs_h3', 10, 4, 'left', MATES[3], { talk: (g) => FLOW.campVignette(g) }),
        sign(1, 1, '窓の外は、まっくら。遠くに山の稜線が見える。'),
      ],
      events: [{ x: 6, y: 1, on: 'action', run: async (g) => { await g.say('時計だ。夜の談話室は、教習生の話し声でにぎやか。'); } }],
    },
    room: {
      wall: 'cream', floor: 'floor_wood',
      tiles: [
        '#########',
        '#=w=p=w=#',
        '#.......#',
        '#.B..B..#',
        '#.b..b..#',
        '#.....D.#',
        '###MMM###',
      ],
      legend: { B: 'bed_top', b: 'bed_bottom', D: 'desk', p: 'wall_cream+poster' },
      warps: [{ x: 3, y: 6, room: 'hall', tx: 9, ty: 2, dir: 'down' }, { x: 4, y: 6, room: 'hall', tx: 9, ty: 2, dir: 'down' }, { x: 5, y: 6, room: 'hall', tx: 9, ty: 2, dir: 'down' }],
      entities: [
        npc('gs_rm', 6, 2, 'down', MATES[2], { text: ['同じ部屋のテツです。いびき、かいてたらごめん。', 'あした、がんばろうな。'] }),
        sign(2, 1, '窓の外は、星空。'),
      ],
      events: [
        { x: 2, y: 3, w: 1, h: 2, on: 'action', run: async (g) => { await FLOW.campSleep(g); } },
        { x: 5, y: 3, w: 1, h: 2, on: 'action', run: async (g) => { await g.say('同室の人のベッドだ。'); } },
        { x: 6, y: 5, on: 'action', run: async (g) => { await g.say(['机の上に、教習原簿とテキストが広げてある。', 'よく読んで、明日に備えよう。（ベッドで寝ると次の日になる）']); } },
      ],
    },
    shokudo: {
      wall: 'orange', floor: 'floor_wood',
      tiles: [
        '##############',
        '#=w=p==c=w=p=#',
        '#.KKKK.......#',
        '#............#',
        '#.TT.TT.TT...#',
        '#.hh.hh.hh...#',
        '#............#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { K: 'counter', T: 'table', h: 'chair', P: 'plant', c: 'wall_orange+clock' },
      warps: [{ x: 6, y: 8, room: 'yard', tx: 18, ty: 2, dir: 'down' }, { x: 7, y: 8, room: 'yard', tx: 18, ty: 2, dir: 'down' }],
      entities: [
        npc('gs_ryobo', 3, 1, 'down', WHO.ryobo, { talk: (g) => FLOW.campMeal(g) }),
        npc('gs_s1', 5, 6, 'up', MATES[3], { text: ['ここの定食、おかわり自由なのがうれしい。', '太りそう…でも、おいしい。'] }),
      ],
      events: [{ x: 6, y: 1, on: 'action', run: async (g) => { await g.say('今日のメニュー：焼き魚定食。\n（食事は、寮母さんに声をかけて）'); } }],
    },
  },
});
