// 東京駅 / なんば駅: travel between the two towns by shinkansen.

import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { W, H } from '../engine/util.js';
import { text, COLORS } from '../engine/draw.js';
import { audio } from '../engine/audio.js';

export const FARE = 3000;

// Short train ride cutscene (shinkansen passing Mt. Fuji).
function rideScene(g, toName) {
  return new Promise((resolve) => {
    const scene = {
      opaque: true,
      t: 0,
      update(gg) {
        scene.t++;
        if (scene.t === 1) audio.sfx('whistle');
        if (scene.t > 220 || (scene.t > 40 && gg.input.pressed('a'))) { gg.pop(scene); resolve(); }
      },
      draw(ctx) {
        const t = scene.t;
        for (let y = 0; y < 150; y += 6) { ctx.fillStyle = y < 50 ? '#7cc4f0' : y < 100 ? '#9ad3f5' : '#bfe6ff'; ctx.fillRect(0, y, W, 6); }
        // Mt. Fuji
        const fx = 220 - t * 0.3;
        ctx.fillStyle = '#5a78b0';
        for (let i = 0; i < 70; i++) ctx.fillRect(Math.round(fx - i * 1.4), 80 + i, Math.round(i * 2.8), 1);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 18; i++) ctx.fillRect(Math.round(fx - i * 1.4), 80 + i, Math.round(i * 2.8), 1);
        // clouds
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) { const cx = ((i * 97 - t * 0.6) % (W + 60) + W + 60) % (W + 60) - 30; ctx.fillRect(Math.round(cx), 30 + i * 9, 30, 6); ctx.fillRect(Math.round(cx) + 6, 26 + i * 9, 18, 4); }
        // fields
        ctx.fillStyle = '#62b35b'; ctx.fillRect(0, 150, W, 90);
        ctx.fillStyle = '#55a34f';
        for (let i = 0; i < 12; i++) { const x = ((i * 40 - t * 4) % (W + 40) + W + 40) % (W + 40) - 20; ctx.fillRect(Math.round(x), 160 + (i % 3) * 20, 24, 3); }
        // track + poles
        ctx.fillStyle = '#8e929c'; ctx.fillRect(0, 196, W, 8);
        ctx.fillStyle = '#5a5f6b';
        for (let i = 0; i < 6; i++) { const x = ((i * 70 - t * 8) % (W + 70) + W + 70) % (W + 70) - 20; ctx.fillRect(Math.round(x), 150, 3, 50); ctx.fillRect(Math.round(x) - 6, 152, 15, 2); }
        // shinkansen
        const bob = Math.round(Math.sin(t / 4));
        const ty = 172 + bob;
        ctx.fillStyle = '#f4f6fa'; ctx.fillRect(20, ty, 230, 24);
        for (let i = 0; i < 26; i++) { ctx.fillRect(250 + i, ty + 4 + Math.floor(i * 0.7), 1, 20 - Math.floor(i * 0.7)); }
        ctx.fillStyle = '#2f5fd0'; ctx.fillRect(20, ty + 15, 240, 3);
        ctx.fillStyle = '#20232a'; ctx.fillRect(258, ty + 6, 8, 4);
        ctx.fillStyle = '#3b4a6a';
        for (let x = 28; x < 240; x += 12) ctx.fillRect(x, ty + 5, 8, 6);
        text(ctx, `新幹線で ${toName} へ移動中…`, W / 2, 12, { align: 'center', color: '#fff', outline: '#20232a' });
      },
    };
    g.push(scene);
  });
}

function makeStation({ id, name, wall, floor, destPlace, destName, bgm }) {
  registerPlace({
    id,
    name,
    kind: 'building',
    bgm,
    start: { room: 'concourse', x: 6, y: 7, dir: 'up' },
    rooms: {
      concourse: {
        floor,
        wall,
        tiles: [
          '############',
          '==p==w==p===',
          '............',
          '.KKK....RRR.',
          '............',
          '.P........P.',
          '............',
          '............',
          '#####MM#####',
        ],
        legend: { K: 'counter_white', R: 'rope', P: 'plant' },
        warps: [{ x: 5, y: 8, to: 'exit' }, { x: 6, y: 8, to: 'exit' }],
        entities: [
          {
            type: 'npc', id: 'ticket', x: 2, y: 2, dir: 'down', look: { ...LOOKS.guard, hat: '#2f5fd0' }, name: 'きっぷ売り場',
            talk: async (g, npc) => {
              const i = await g.ask(`新幹線のきっぷ売り場です。\n${destName}まで ¥${FARE.toLocaleString()} です。`, [`${destName}へ行く`, 'やめておく'], { name: npc.name, look: npc.look });
              if (i !== 0) return;
              if (!g.spend(FARE)) { await g.say('お金が足りないようですね…。', { name: npc.name, look: npc.look }); return; }
              g.sfx('coin');
              await g.say('いってらっしゃいませ！', { name: npc.name, look: npc.look });
              await g.fadeOut();
              const ride = rideScene(g, destName);
              await g.fadeIn();
              await ride;
              await g.fadeOut();
              await g.goto(destPlace, 'concourse', 6, 6, 'down');
              await g.say(`${destName}に到着した！`);
            },
          },
          { type: 'npc', id: 'traveler', x: 9, y: 6, dir: 'left', look: LOOKS.tourist, name: '旅行客', wander: 2, text: [`${destName}行きの新幹線、もうすぐ出発だって！`] },
          { type: 'sign', x: 9, y: 3, text: '改札だ。この先は新幹線のりば。\nきっぷ売り場で、きっぷを買おう。' },
          { type: 'sign', x: 8, y: 3, text: '改札だ。この先は新幹線のりば。\nきっぷ売り場で、きっぷを買おう。' },
          { type: 'sign', x: 10, y: 3, text: '改札だ。この先は新幹線のりば。\nきっぷ売り場で、きっぷを買おう。' },
        ],
      },
    },
  });
}

makeStation({ id: 'station_tokyo', name: '東京駅', wall: 'brick', floor: 'floor_marble', destPlace: 'station_namba', destName: 'なんば（大阪）', bgm: 'office' });
makeStation({ id: 'station_namba', name: 'なんば駅', wall: 'cream', floor: 'floor_tile', destPlace: 'station_tokyo', destName: '東京', bgm: 'osaka' });
