// STUB — 銭湯 / ホテル / たこ焼き屋 placeholders.
import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';

function simple(id, name, floor, wall, npcText) {
  registerPlace({
    id, name, kind: 'building', bgm: 'office',
    start: { room: 'main', x: 4, y: 6, dir: 'up' },
    rooms: {
      main: {
        floor, wall,
        tiles: ['##########', '#=w==p==w#', '#........#', '#........#', '#........#', '#........#', '#........#', '####M#####'],
        warps: [{ x: 4, y: 7, to: 'exit' }],
        entities: [{ type: 'npc', id: 'staff', x: 4, y: 3, dir: 'down', look: LOOKS.clerk, name: '店員', text: [npcText] }],
      },
    },
  });
}
simple('sento', '銭湯 ドットの湯', 'floor_tile', 'blue', 'ただいま準備中です。');
simple('hotel', 'ドットホテル なんば', 'floor_carpet_red', 'cream', 'ただいま準備中です。');
simple('takoyaki', 'たこ焼き屋', 'floor_wood', 'wood', 'ただいま準備中です。');
