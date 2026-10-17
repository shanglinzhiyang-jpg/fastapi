// 東京駅 / なんば駅: travel between the two towns.
// The real route is 東京 →(新幹線)→ 新大阪 →(電車)→ なんば; the game sells it as one ticket.

import { registerPlace } from '../engine/map.js';
import { defineTile, R as TR, P as TP } from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { W, H } from '../engine/util.js';
import { text, COLORS } from '../engine/draw.js';
import { audio } from '../engine/audio.js';

export const FARE = 3000;

// Short train ride cutscene (shinkansen passing Mt. Fuji).
function rideScene(g, toName, via) {
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
        text(ctx, `${toName} へ移動中…`, W / 2, 10, { align: 'center', color: '#fff', outline: '#20232a' });
        if (via) text(ctx, via, W / 2, 28, { size: 10, align: 'center', color: '#fff6a8', outline: '#20232a' });
      },
    };
    g.push(scene);
  });
}

// Automatic ticket gate: a cabinet on the left with a closed red flap reaching across.
defineTile('station_gate', {
  solid: true, obj: true,
  draw(c) {
    TR(c, 1, 14, 14, 2, 'rgba(0,0,0,0.18)');
    TR(c, 0, 3, 6, 12, '#7d8391'); TR(c, 1, 3, 4, 11, '#c9ccd4'); TR(c, 1, 3, 4, 2, '#eef0f4');
    TR(c, 1, 6, 4, 1, '#3b4a6a'); TP(c, 3, 8, '#5ee07a');
    TR(c, 6, 8, 4, 3, '#d64f4f'); TR(c, 6, 8, 4, 1, '#ff8a8a');
  },
});

// Tactile warning strip in front of the gates (overlay on the room floor).
defineTile('station_strip', {
  draw(c) {
    TR(c, 0, 2, 16, 5, '#e8c43a');
    for (let x = 1; x < 16; x += 3) { TR(c, x, 3, 2, 2, '#f6dc6a'); TP(c, x + 1, 4, '#c9a52a'); }
  },
});

// Departure board hung on the wall (black panel, white header, orange LED lines).
function departureBoard(x, y, w, rows) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      const pw = w * 16 - 4;
      TR(ctx, sx + 2, sy - 10, pw, 25, '#5a5f6b');
      TR(ctx, sx + 3, sy - 9, pw - 2, 23, '#0b0d12');
      TR(ctx, sx + 3, sy + 1, pw - 2, 1, '#2a2d36');
      rows.forEach((r, i) => {
        const blink = i > 0 && i === rows.length - 1 && Math.floor(g.frame / 40) % 2 === 1;
        text(ctx, r, sx + 6, sy - 9 + i * 11, { size: 10, color: i === 0 ? '#ffffff' : blink ? '#a85a10' : '#ffb03a', shadow: null });
      });
    },
  };
}

function makeStation({ id, name, wall, floor, destPlace, destName, bgm, transfer, via, board, wallRow, gateText, extraLegend = {}, extraEntities = [], traveler, warnReturn }) {
  const say = (g, npc, t) => g.say(t, { name: npc.name, look: npc.look });
  registerPlace({
    id,
    name,
    kind: 'building',
    bgm,
    start: { room: 'concourse', x: 6, y: 8, dir: 'up' },
    rooms: {
      concourse: {
        floor,
        wall,
        tiles: [
          '##############',
          wallRow,
          '#...P...GGGGG#',
          '#KKK....TTTTT#',
          '#............#',
          '#.bb......bb.#',
          '#S...........#',
          '#S..........P#',
          '#............#',
          '######MM######',
        ],
        legend: { K: 'counter_white', G: 'station_gate', T: floor + '+station_strip', P: 'plant', b: 'bench', S: 'shelf_goods', ...extraLegend },
        warps: [{ x: 6, y: 9, to: 'exit' }, { x: 7, y: 9, to: 'exit' }],
        entities: [
          departureBoard(8, 1, 5, board),
          {
            type: 'npc', id: 'ticket', x: 2, y: 2, dir: 'down', look: { ...LOOKS.guard, hat: '#2f5fd0' }, name: 'きっぷ売り場',
            talk: async (g, npc) => {
              const i = await g.ask(`きっぷ売り場です。\n${destName}まで ¥${FARE.toLocaleString()} です。\n（${transfer}）`, [`${destName}へ行く`, 'やめておく'], { name: npc.name, look: npc.look });
              if (i !== 0) return;
              if (g.state.money < FARE) { await say(g, npc, 'お金が足りないようですね…。'); return; }
              if (warnReturn && g.state.money - FARE < FARE) {
                const j = await g.ask(`帰りの運賃（¥${FARE.toLocaleString()}）も\n残しておくと安心ですよ。\nそれでも行きますか？`, ['行く', 'やめておく'], { name: npc.name, look: npc.look });
                if (j !== 0) return;
              }
              if (!g.spend(FARE)) { await say(g, npc, 'お金が足りないようですね…。'); return; }
              g.sfx('coin');
              await say(g, npc, 'いってらっしゃいませ！');
              await g.fadeOut();
              const ride = rideScene(g, destName, via);
              await g.fadeIn();
              await ride;
              await g.fadeOut();
              await g.goto(destPlace, 'concourse', 10, 3, 'down');
              await g.say(`${destName}に到着した！`);
            },
          },
          { type: 'npc', id: 'traveler', x: 9, y: 6, dir: 'left', look: LOOKS.tourist, name: '旅行客', wander: 2, text: traveler },
          ...[8, 9, 10, 11, 12].map((x) => ({ type: 'sign', x, y: 2, text: gateText })),
          ...extraEntities,
        ],
      },
    },
  });
}

makeStation({
  id: 'station_tokyo', name: '東京駅', wall: 'brick', floor: 'floor_marble', bgm: 'office',
  destPlace: 'station_namba', destName: 'なんば（大阪）',
  transfer: '新幹線で新大阪へ行き、電車に乗りかえ',
  via: '新幹線で新大阪へ → 電車で なんばへ',
  board: ['新幹線　のりば', '9:30 新大阪'],
  wallRow: '#=p==w=c=====#',
  gateText: '改札だ。この先は新幹線のりば。\nきっぷ売り場で、きっぷを買おう。',
  traveler: ['新大阪行きの新幹線、もうすぐ出発だって！', '大阪に着いたら、電車でなんばに行くんだ。'],
  warnReturn: true,
  extraEntities: [
    { type: 'npc', id: 'biz', x: 4, y: 8, dir: 'up', look: { ...LOOKS.salaryman, tie: '#2f5fd0' }, name: '出張の会社員', text: ['これから大阪へ出張です。', '新幹線で新大阪まで行って、\nそこから電車でなんばへ向かいます。'] },
    { type: 'sign', x: 1, y: 6, text: 'おみやげ売り場だ。\n東京のお菓子がずらりと並んでいる。' },
    { type: 'sign', x: 1, y: 7, text: 'おみやげ売り場だ。\n東京のお菓子がずらりと並んでいる。' },
  ],
});
makeStation({
  id: 'station_namba', name: 'なんば駅', wall: 'cream', floor: 'floor_tile', bgm: 'osaka',
  destPlace: 'station_tokyo', destName: '東京',
  transfer: '電車で新大阪へ行き、新幹線に乗りかえ',
  via: '電車で新大阪へ → 新幹線で 東京へ',
  board: ['電車　のりば', '9:12 新大阪'],
  wallRow: '#L=p=L=L=====#',
  extraLegend: { L: 'wall_cream+lantern' },
  gateText: '改札だ。この先は電車のりば。\n東京へは、新大阪で新幹線に乗りかえ。\nきっぷ売り場で、きっぷを買おう。',
  traveler: ['新大阪で新幹線に乗りかえて、東京へ帰るんだ！', '大阪、おもろかったわ〜。また来よっと！'],
  extraEntities: [
    { type: 'npc', id: 'owarai_fan', x: 4, y: 8, dir: 'up', look: { ...LOOKS.fan, top: '#ff7eb6' }, name: 'お笑いファン', text: ['劇場、めっちゃ笑ったわ〜！', '次は東京のお笑いも見に行ってみたいなあ。'] },
    { type: 'sign', x: 1, y: 6, text: 'おみやげ売り場だ。\n大阪のお菓子がずらりと並んでいる。' },
    { type: 'sign', x: 1, y: 7, text: 'おみやげ売り場だ。\n大阪のお菓子がずらりと並んでいる。' },
  ],
});
