// コンビニ（ローソン）: buy food and buff items.

import { registerPlace, PLACES } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { pick } from '../engine/util.js';

const GOSSIP = [
  '芸能雑誌：「芸人の登竜門！事務所オーディションは日々開催中」',
  '芸能雑誌：「新喜劇のズッコケ、実は受け身の練習がとても大切らしい」',
  '芸能雑誌：「歌の上達には、のどのケアが欠かせない。のどあめは必需品！」',
  '芸能雑誌：「売れっ子タレントの体力管理術。ちゃんと寝て、ちゃんと食べる」',
  '芸能雑誌：「東映の殺陣、東宝の怪獣映画…撮影所の裏側に密着！」',
];

const GOODS = ['onigiri', 'bento', 'drink', 'nodoame', 'netacho', 'daihon', 'wadai'];
// ネオン街's shared crime / age-check helpers (js/world/kanraku.js), looked up when used (no import).
const kanApi = () => (PLACES.kanraku && PLACES.kanraku.api) || null;

// The shelves: buying goes through the register. 「万引きする…？」 (the odds card first — crime.js
// g.crimeConfirm — then g.commitCrime('shoplifting')) is kanraku.js's api.shoplift.
// In crime mode the choice shows the odds right away (crime.js g.crimeOdds).
function liftLabel(g) {
  try {
    if (typeof g.crimeMode === 'function' && g.crimeMode() && typeof g.crimeOdds === 'function') {
      const o = g.crimeOdds('shoplifting', { amount: 300 });
      if (o && o.ok) return `万引き（成功${o.pct.success}%）`;
    }
  } catch (e) { console.error(e); }
  return '万引きする…？';
}
async function shelf(g) {
  const api = kanApi();
  const k = await g.ask('おにぎり、パン、お菓子、飲み物…\n棚に商品がぎっしり並んでいる。', api ? ['レジで買う', 'ながめるだけ', liftLabel(g)] : ['レジで買う', 'ながめるだけ'], { cancel: 1 });
  if (k === 0) await g.shop(GOODS, { title: 'ローソン', greeting: 'いらっしゃいませ〜！' });
  else if (k === 2 && api) await api.shoplift(g, { where: 'ローソン', items: ['onigiri', 'drink', 'nodoame'] });
}
// タバコ・お酒 behind the register: sold only with the age check (ageOf: 二十歳から).
async function tobacco(g) {
  const api = kanApi();
  if (!api) { await g.say('レジの後ろに、タバコが並んでいる。\n「二十歳未満の方には販売できません」'); return; }
  await api.tobaccoCounter(g, g.npc('clerk'), { where: 'ローソン' });
}

// the tobacco and liquor shelf behind the register (talked to across it)
const tabakoShelf = {
  type: 'prop', x: 6, y: 4, w: 1, h: 1, solid: true, talk: tobacco,
  draw(ctx, sx, sy) {
    const F = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(sx + x, sy + y, w, h); };
    F(1, -6, 14, 17, '#5a4a3a'); F(2, -5, 12, 15, '#2e2620');
    const cols = ['#d62f2f', '#2f6fd0', '#f2f2f2', '#2f9a4a', '#ffd23f', '#8a5ac8'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) F(2.5 + i * 2.3, -4.5 + r * 4, 1.8, 3, cols[(i + r * 2) % cols.length]);
    for (let i = 0; i < 4; i++) { F(2.6 + i * 2.9, 3.5, 2, 4, ['#c8ccd2', '#ffd23f', '#2f6fd0', '#c8ccd2'][i]); F(2.6 + i * 2.9, 3.5, 2, 0.6, '#ffffff'); } // cans
    F(1, 10, 14, 1, '#3a2e24');
  },
};

registerPlace({
  id: 'konbini',
  name: 'ローソン',
  kind: 'building',
  bgm: 'office',
  start: { room: 'store', x: 4, y: 6, dir: 'up' },
  rooms: {
    store: {
      floor: 'floor_tile',
      wall: 'white',
      tiles: [
        '##########',
        '#FFFF=w=p#',
        '#........#',
        '#.SS.SS..#',
        '#........#',
        '#.SS..RR.#',
        '#G.......#',
        '####M#####',
      ],
      legend: { F: 'wall_white+fridge_drinks', S: 'shelf_goods', R: 'register', G: 'magazine' },
      warps: [{ x: 4, y: 7, to: 'exit' }],
      entities: [
        { type: 'logo', x: 7, y: 0.9, w: 1.2, h: 1.1, logo: 'lawson', text: 'ローソンの看板だ。今日も24時間営業！' },
        {
          type: 'npc', id: 'clerk', x: 7, y: 4, dir: 'down', look: LOOKS.clerk, name: '店員さん', person: 'haruto',
          talk: async (g, npc) => {
            await g.shop(GOODS, { title: 'ローソン', greeting: 'いらっしゃいませ〜！' });
            // once you know him, the same name as in his talk menu (people.js)
            await g.say('ありがとうございました〜！', { name: g.met('haruto') ? '店員の春斗さん' : npc.name, look: npc.look });
          },
        },
        tabakoShelf,
        { type: 'npc', id: 'customer', x: 4, y: 4, dir: 'up', look: { ...LOOKS.salaryman, top: '#5a6f8a' }, name: 'お客さん', wander: 1, text: ['エナジードリンクは仕事前の必需品ですよ…。', '体力が足りないとお仕事もレッスンも受けられませんからね。'] },
      ],
      events: [
        { x: 1, y: 6, on: 'action', run: async (g) => { await g.say(['雑誌を立ち読みした。', pick(GOSSIP)]); } },
        { x: 2, y: 3, w: 2, on: 'action', run: shelf },
        { x: 5, y: 3, w: 2, on: 'action', run: shelf },
        { x: 2, y: 5, w: 2, on: 'action', run: shelf },
      ],
    },
  },
});
