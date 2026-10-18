// コンビニ（ドットマート）: buy food and buff items.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { pick } from '../engine/util.js';

const GOSSIP = [
  '芸能雑誌：「芸人の登竜門！事務所オーディションは日々開催中」',
  '芸能雑誌：「新喜劇のズッコケ、実は受け身の練習がとても大切らしい」',
  '芸能雑誌：「歌の上達には、のどのケアが欠かせない。のどあめは必需品！」',
  '芸能雑誌：「売れっ子タレントの体力管理術。ちゃんと寝て、ちゃんと食べる」',
  '芸能雑誌：「東映の殺陣、東宝の怪獣映画…撮影所の裏側に密着！」',
];

registerPlace({
  id: 'konbini',
  name: 'ドットマート',
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
        {
          type: 'npc', id: 'clerk', x: 7, y: 4, dir: 'down', look: LOOKS.clerk, name: '店員さん', person: 'haruto',
          talk: async (g, npc) => {
            await g.shop(['onigiri', 'bento', 'drink', 'nodoame', 'netacho', 'daihon', 'wadai'], { title: 'ドットマート', greeting: 'いらっしゃいませ〜！' });
            // once you know him, the same name as in his talk menu (people.js)
            await g.say('ありがとうございました〜！', { name: g.met('haruto') ? '店員の春斗さん' : npc.name, look: npc.look });
          },
        },
        { type: 'npc', id: 'customer', x: 4, y: 4, dir: 'up', look: { ...LOOKS.salaryman, top: '#5a6f8a' }, name: 'お客さん', wander: 1, text: ['エナジードリンクは仕事前の必需品ですよ…。', '体力が足りないとお仕事もレッスンも受けられませんからね。'] },
      ],
      events: [
        { x: 1, y: 6, on: 'action', run: async (g) => { await g.say(['雑誌を立ち読みした。', pick(GOSSIP)]); } },
      ],
    },
  },
});
