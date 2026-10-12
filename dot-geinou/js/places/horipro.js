// STUB — placeholder until the real place is implemented.
import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';

registerPlace({
  id: 'horipro',
  name: 'ホリプロ',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 4, y: 6, dir: 'up' },
  rooms: {
    lobby: {
      floor: 'floor_marble',
      wall: 'white',
      tiles: [
        '##########',
        '#=w==p==w#',
        '#........#',
        '#.CCC....#',
        '#........#',
        '#........#',
        '#........#',
        '####M#####',
      ],
      legend: { C: 'counter_white' },
      warps: [{ x: 4, y: 7, to: 'exit' }],
      entities: [
        { type: 'logo', x: 5, y: 1, w: 3, h: 1, logo: 'horipro' },
        { type: 'npc', id: 'reception', x: 3, y: 2, dir: 'down', look: LOOKS.receptionist, name: '受付', text: ['いらっしゃいませ。ただいま準備中です。'] },
      ],
    },
  },
});
