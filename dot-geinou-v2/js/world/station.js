// 東京駅 / なんば駅: travel between the two towns, and (東京駅) going home to the
// 実家 (js/world/family.js adds that ticket through STATION_TICKETS).
// The real route is 東京 →(新幹線)→ 新大阪 →(電車)→ なんば; the game sells it as one ticket.
//
// For other modules:
//   STATION_TICKETS[stationId].push({ id, label, cond(g), run: async (g, npc) => {} })
//       an extra choice at the ticket counter (label ≤ 14 chars; shown when cond passes).
//   await travelScene(g, { to, via, vehicle, scenery })   the HD ride cutscene
//       vehicle: 'shinkansen' | 'local' | 'plane'; scenery: 'fuji' | 'mountains' | 'fields' | 'sea' | 'city' | 'tunnel'
//       color: the local train's stripe (the line colour, js/world/eki_net.js)  [R9-B1]
// [R9-B1] the in-town rail network (駅構内 'eki', js/world/eki.js): when a town's station door leads to 'eki', the exits
// of station_tokyo / station_namba lead back into that town's station concourse (the 新幹線のりかえ口).

import { registerPlace, PLACES, doorIndexFor } from '../engine/map.js';
import { defineTile, R as TR, P as TP } from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { SW, SH, fmtMoney } from '../engine/util.js';
import { text } from '../engine/draw.js';
import { audio } from '../engine/audio.js';

export const FARE = 3000;
// Extra ticket-counter choices per station (see the header).
export const STATION_TICKETS = { station_tokyo: [], station_namba: [] };

// ---------------------------------------------------------------- the ride (HD, 640x360)
const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const wrapX = (x, span) => ((x % span) + span) % span;

function drawSky(c, top, mid, low) {
  for (let y = 0; y < 230; y += 10) F(c, 0, y, SW, 10, y < 80 ? top : y < 160 ? mid : low);
}
function drawClouds(c, t, y0, speed, col = '#ffffff') {
  for (let i = 0; i < 6; i++) {
    const x = wrapX(i * 131 - t * speed, SW + 120) - 60;
    const y = y0 + (i % 3) * 22;
    F(c, x, y, 64, 10, col); F(c, x + 12, y - 8, 36, 8, col); F(c, x + 6, y + 10, 50, 4, 'rgba(200,220,240,0.7)');
  }
}
function drawFuji(c, t) {
  const fx = 420 - t * 0.25;
  for (let i = 0; i < 120; i += 2) {
    F(c, fx - i * 1.5, 100 + i, i * 3, 2, '#5a78b0');
    if (i < 34) F(c, fx - i * 1.5, 100 + i, i * 3, 2, i % 6 === 4 ? '#e4ecf6' : '#ffffff');
  }
  F(c, fx - 6, 100, 12, 2, '#ffffff');
}
function drawRidge(c, t, base, col, speed, amp, seed) {
  for (let x = 0; x < SW; x += 4) {
    const wx = x + t * speed;
    const h = amp * (0.55 + 0.25 * Math.sin((wx + seed) / 47) + 0.2 * Math.sin((wx + seed * 3) / 19));
    F(c, x, base - h, 4, h + 2, col);
  }
}
function drawSea(c, t) {
  F(c, 0, 150, SW, 70, '#3f8fd0');
  for (let i = 0; i < 18; i++) {
    const x = wrapX(i * 53 - t * 1.2, SW + 40) - 20;
    F(c, x, 160 + (i % 4) * 14, 18, 2, '#9fd4ff');
  }
  // islands far away
  F(c, wrapX(500 - t * 0.2, SW + 200) - 100, 142, 90, 8, '#4f7a5a');
  F(c, wrapX(500 - t * 0.2, SW + 200) - 80, 136, 44, 6, '#5f8a6a');
}
function drawCity(c, t) {
  for (let i = 0; i < 16; i++) {
    const x = wrapX(i * 47 - t * 1.6, SW + 60) - 30;
    const h = 40 + ((i * 37) % 70);
    F(c, x, 220 - h, 38, h, ['#8a93a8', '#a3abbd', '#7a849a'][i % 3]);
    for (let wy = 220 - h + 8; wy < 212; wy += 10) for (let wx = 4; wx < 34; wx += 9) F(c, x + wx, wy, 4, 4, '#dfe8f4');
  }
}
function drawFields(c, t) {
  F(c, 0, 210, SW, 150, '#62b35b');
  for (let i = 0; i < 16; i++) {
    const x = wrapX(i * 60 - t * 5, SW + 60) - 30;
    F(c, x, 228 + (i % 3) * 30, 40, 4, '#55a34f');
    F(c, x + 20, 300 + (i % 2) * 20, 28, 4, '#6fc067');
  }
  // small houses go by
  for (let i = 0; i < 4; i++) {
    const x = wrapX(i * 190 - t * 2.4, SW + 120) - 60;
    F(c, x, 196, 30, 16, '#efe2bf'); F(c, x - 3, 188, 36, 9, '#b8434a'); F(c, x + 11, 202, 8, 10, '#7a4e2a');
  }
}
function drawTrain(c, t, kind, color = '#3fa86a') {
  // poles and track
  F(c, 0, 268, SW, 14, '#8e929c'); F(c, 0, 268, SW, 2, '#b8bcc6'); F(c, 0, 282, SW, 4, '#5a5f6b');
  for (let i = 0; i < 8; i++) {
    const x = wrapX(i * 96 - t * 14, SW + 96) - 30;
    F(c, x, 196, 5, 74, '#5a5f6b'); F(c, x - 10, 198, 25, 3, '#5a5f6b');
  }
  F(c, 0, 200, SW, 1, '#40444e');
  const bob = Math.round(Math.sin(t / 5));
  const y = 222 + bob;
  if (kind === 'local') {
    // commuter train: boxy cars with a stripe
    for (let k = 0; k < 3; k++) {
      const x = 30 + k * 172;
      F(c, x, y, 166, 44, '#d8dce4'); F(c, x, y, 166, 3, '#f4f6fa');
      F(c, x, y + 28, 166, 6, color);
      for (let wx = x + 10; wx < x + 156; wx += 26) F(c, wx, y + 8, 18, 14, '#3b4a6a');
      F(c, x + 70, y + 6, 22, 34, '#9aa0aa');
    }
    F(c, 542, y + 8, 10, 14, '#3b4a6a');
    return;
  }
  // shinkansen: long white body, blue line, pointed nose
  F(c, 20, y, 470, 42, '#f4f6fa'); F(c, 20, y, 470, 3, '#ffffff');
  for (let i = 0; i < 70; i += 2) F(c, 490 + i, y + 6 + Math.floor(i * 0.5), 2, 36 - Math.floor(i * 0.5), '#eef1f6');
  F(c, 20, y + 26, 540, 5, '#2f5fd0');
  F(c, 512, y + 12, 18, 7, '#20232a');
  for (let x = 34; x < 480; x += 22) F(c, x, y + 9, 14, 11, '#3b4a6a');
  F(c, 20, y + 40, 470, 3, '#c8ccd6');
}
function drawPlane(c, t) {
  drawClouds(c, t, 250, 2.4, '#ffffff');
  const x = Math.round(220 + Math.sin(t / 30) * 8), y = 150 + Math.round(Math.sin(t / 12) * 2);
  // far wing (behind the body)
  for (let i = 0; i < 16; i += 2) F(c, x + 66 + i * 2, y - 16 + i, 46, 2, '#b8bcc6');
  // tail fin: a stepped triangle
  for (let i = 0; i < 40; i += 2) F(c, x - 8 + i * 0.6, y - 40 + i, 30 - i * 0.4, 2, '#e8484f');
  F(c, x - 8, y - 40, 18, 2, '#ff7a80');
  // body with a rounded nose
  F(c, x - 10, y, 200, 26, '#f4f6fa'); F(c, x - 10, y, 200, 3, '#ffffff'); F(c, x - 10, y + 23, 200, 3, '#d8dce4');
  for (let i = 0; i < 24; i += 2) F(c, x + 190 + i, y + Math.round(i * 0.35), 2, 26 - Math.round(i * 0.75), '#eef1f6');
  F(c, x + 192, y + 6, 10, 5, '#3b4a6a');
  for (let wx = x + 8; wx < x + 180; wx += 12) F(c, wx, y + 9, 6, 6, '#3b4a6a');
  F(c, x - 10, y + 17, 214, 3, '#2f5fd0');
  // near wing and its engine
  for (let i = 0; i < 20; i += 2) F(c, x + 110 - i * 2, y + 20 + i, 60, 2, '#c8ccd6');
  F(c, x + 92, y + 34, 26, 10, '#8a8f99'); F(c, x + 92, y + 34, 26, 2, '#a8acb6'); F(c, x + 116, y + 36, 3, 6, '#3b3f48');
}
// the metro: a dark tunnel, its lamps rushing by, the train's lit windows
function drawTunnel(c, t, color) {
  F(c, 0, 0, SW, SH, '#15171d');
  for (let y = 0; y < 200; y += 20) F(c, 0, y, SW, 1, '#1d2028');
  for (let i = 0; i < 7; i++) {
    const x = wrapX(i * 110 - t * 16, SW + 110) - 50;
    F(c, x, 120, 26, 6, '#fff3c0'); F(c, x - 6, 116, 38, 2, 'rgba(255,243,192,0.25)');
    F(c, x + 40, 60, 3, 160, '#262a33');
  }
  for (let i = 0; i < 30; i++) F(c, wrapX(i * 37 - t * 22, SW + 40) - 20, 200 + (i % 3) * 3, 14, 1, '#2c3039');
  const bob = Math.round(Math.sin(t / 5));
  const y = 214 + bob;
  for (let k = 0; k < 3; k++) {
    const x = 30 + k * 196;
    F(c, x, y, 190, 54, '#c8ccd4'); F(c, x, y, 190, 3, '#e8ebf0');
    F(c, x, y + 6, 190, 4, color); F(c, x, y + 40, 190, 4, color);
    for (let wx = x + 10; wx < x + 176; wx += 30) F(c, wx, y + 14, 20, 18, '#f6e6a0');
    F(c, x + 84, y + 12, 22, 38, '#9aa0aa');
  }
  F(c, 0, 272, SW, 10, '#3b3f48'); F(c, 0, 282, SW, 78, '#101216');
}
function drawBushes(c, t) {
  for (let i = 0; i < 14; i++) {
    const x = wrapX(i * 71 - t * 9, SW + 80) - 40;
    const y = 312 + (i % 3) * 14;
    F(c, x, y, 34, 12, '#3f8a3a'); F(c, x + 6, y - 6, 22, 8, '#4f9a4a'); F(c, x + 10, y - 4, 6, 3, '#6fc067');
    if (i % 4 === 0) { F(c, x + 40, y + 4, 4, 4, '#ffd23f'); F(c, x + 48, y + 8, 4, 4, '#ff8ab0'); }
  }
}

// The ride cutscene (HD). Resolves when it ends (A to skip after a moment).
export function travelScene(g, o = {}) {
  const vehicle = o.vehicle || 'shinkansen';
  const scenery = o.scenery || (vehicle === 'plane' ? 'sky' : 'fuji');
  return new Promise((resolve) => {
    const scene = {
      hd: true, opaque: true, hidesHud: true, t: 0,
      update(gg) {
        scene.t++;
        if (scene.t === 1) audio.sfx(vehicle === 'plane' ? 'chime' : 'whistle');
        const done = gg.auto ? scene.t > 3 : scene.t > 230 || (scene.t > 40 && gg.input.pressed('a'));
        if (done) { gg.pop(scene); resolve(); }
      },
      draw(c) {
        const t = scene.t;
        if (vehicle === 'plane') {
          drawSky(c, '#5aa8e8', '#7cc4f0', '#a8dcf8');
          F(c, 0, 230, SW, 130, '#a8dcf8');
          drawClouds(c, t, 74, 0.5);
          drawPlane(c, t);
        } else if (scenery === 'tunnel') {
          drawTunnel(c, t, o.color || '#3fa86a');
        } else {
          drawSky(c, '#6cb8ec', '#8fcbf2', '#b8e2fb');
          drawClouds(c, t, 72, 0.6);
          if (scenery === 'fuji') { drawFuji(c, t); drawRidge(c, t, 214, '#7fa8c8', 0.4, 46, 3); }
          if (scenery === 'mountains') { drawRidge(c, t, 200, '#7a98bc', 0.3, 90, 7); drawRidge(c, t, 214, '#5f8a6a', 0.9, 50, 11); }
          if (scenery === 'sea') drawSea(c, t);
          if (scenery === 'city') drawCity(c, t);
          if (scenery !== 'city') drawFields(c, t); else F(c, 0, 220, SW, 140, '#8a8f99');
          if (scenery === 'fields') drawRidge(c, t, 196, '#86a8c0', 0.25, 30, 5);
          drawTrain(c, t, vehicle, o.color);
          F(c, 0, 286, SW, 74, scenery === 'city' ? '#7a7f89' : '#4f9a4a');
          if (scenery !== 'city') drawBushes(c, t);
          else for (let i = 0; i < 10; i++) F(c, wrapX(i * 97 - t * 9, SW + 60) - 30, 310 + (i % 2) * 20, 50, 4, '#8a8f99');
        }
        F(c, 0, 0, SW, 52, 'rgba(10,14,34,0.55)');
        text(c, `${o.to || ''} へ移動中…`, SW / 2, 8, { size: 20, align: 'center', color: '#fff', outline: '#20232a' });
        if (o.via) text(c, o.via, SW / 2, 32, { size: 12, align: 'center', color: '#fff6a8', outline: '#20232a' });
        if (t > 40) text(c, 'A：とばす', SW - 12, SH - 22, { size: 12, align: 'right', color: '#ffffff', outline: '#20232a' });
      },
    };
    g.push(scene);
  });
}

// ---------------------------------------------------------------- tiles
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

// [R9-B1] the 新幹線 concourse's exit: the town door if it still leads here, else the town's station concourse ('eki')
const TOWN_OF = { station_tokyo: 'tokyo', station_namba: 'namba' };
async function leaveShinkansen(g, id) {
  g.sfx('door');
  let door = null;
  try { door = doorIndexFor(id); } catch (e) { door = null; }
  const eki = PLACES.eki;
  if (!door && eki && eki.rooms && eki.rooms[TOWN_OF[id]]) { await g.goto('eki', TOWN_OF[id], 22, 11, 'left'); return; }
  if (door) { await g.exitPlace(); return; }
  await g.goto(TOWN_OF[id], 'main');
}

function makeStation({ id, name, wall, floor, destPlace, destName, bgm, transfer, via, board, wallRow, gateText, extraLegend = {}, extraEntities = [], traveler, warnReturn, scenery }) {
  const say = (g, npc, t) => g.say(t, { name: npc.name, look: npc.look });
  // the usual ticket to the other town
  async function townTicket(g, npc) {
    if (g.state.money < FARE) { await say(g, npc, 'お金が足りないようですね…。'); return; }
    if (warnReturn && g.state.money - FARE < FARE) {
      const j = await g.ask(`帰りの運賃（${fmtMoney(FARE)}）も\n残しておくと安心ですよ。\nそれでも行きますか？`, ['行く', 'やめておく'], { name: npc.name, look: npc.look });
      if (j !== 0) return;
    }
    if (!g.spend(FARE)) { await say(g, npc, 'お金が足りないようですね…。'); return; }
    g.sfx('coin');
    await say(g, npc, 'いってらっしゃいませ！');
    await g.fadeOut();
    const ride = travelScene(g, { to: destName, via, vehicle: 'shinkansen', scenery });
    await g.fadeIn();
    await ride;
    await g.fadeOut();
    await g.goto(destPlace, 'concourse', 10, 3, 'down');
    await g.say(`${destName}に到着した！`);
  }
  // The ticket gate. 無賃乗車 goes through ネオン街's shared api (js/world/kanraku.js, looked up when
  // used): the odds card (crime.js g.crimeConfirm), the ride, then the arrival gate decides
  // (g.commitCrime('fare_evasion')). In crime mode the choice already shows the odds.
  async function gate(g) {
    const api = PLACES.kanraku && PLACES.kanraku.api;
    if (!api) { await g.say(gateText); return; }
    let label = 'きっぷなしで通る…';
    try {
      if (typeof g.crimeMode === 'function' && g.crimeMode()) {
        const o = g.crimeOdds('fare_evasion', { detect: 0.6 });
        if (o && o.ok) label = `きっぷなし（成功${o.pct.success}%）`;
      }
    } catch (e) { console.error(e); }
    const k = await g.ask(gateText, ['もどる', label], { cancel: 0 });
    if (k !== 1) return;
    await api.fareEvasion(g, {
      fare: FARE, dest: destName, inspected: true, // the 新幹線: the conductor checks tickets
      ride: async () => {
        await g.fadeOut();
        const ride = travelScene(g, { to: destName, via, vehicle: 'shinkansen', scenery });
        await g.fadeIn();
        await ride;
        await g.fadeOut();
        await g.goto(destPlace, 'concourse', 10, 3, 'down');
      },
    });
  }
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
        // [R9-B1] out through the town's door, or (when the town's station door leads to 'eki') into its concourse
        events: [{ x: 6, y: 9, w: 2, h: 1, on: 'step', run: (g) => leaveShinkansen(g, id) }],
        entities: [
          departureBoard(8, 1, 5, board),
          {
            type: 'npc', id: 'ticket', x: 2, y: 2, dir: 'down', look: { ...LOOKS.guard, hat: '#2f5fd0' }, name: 'きっぷ売り場',
            talk: async (g, npc) => {
              const extra = (STATION_TICKETS[id] || []).filter((x) => {
                try { return !x.cond || x.cond(g); } catch (e) { console.error(e); return false; }
              });
              const choices = [`${destName}へ行く`, ...extra.map((x) => (typeof x.label === 'function' ? x.label(g) : x.label)), 'やめておく'];
              const i = await g.ask(`きっぷ売り場です。\n${destName}まで ${fmtMoney(FARE)} です。\n（${transfer}）`, choices, { name: npc.name, look: npc.look, cancel: choices.length - 1 });
              if (i === 0) { await townTicket(g, npc); return; }
              const x = extra[i - 1];
              if (x) { try { await x.run(g, npc); } catch (e) { console.error(e); } }
            },
          },
          { type: 'npc', id: 'traveler', x: 9, y: 6, dir: 'left', look: LOOKS.tourist, name: '旅行客', wander: 2, text: traveler },
          ...[8, 9, 10, 11, 12].map((x) => ({ type: 'sign', x, y: 2, talk: gate })),
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
  scenery: 'fuji',
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
  scenery: 'fuji',
  extraEntities: [
    { type: 'npc', id: 'owarai_fan', x: 4, y: 8, dir: 'up', look: { ...LOOKS.fan, top: '#ff7eb6' }, name: 'お笑いファン', text: ['劇場、めっちゃ笑ったわ〜！', '次は東京のお笑いも見に行ってみたいなあ。'] },
    { type: 'sign', x: 1, y: 6, text: 'おみやげ売り場だ。\n大阪のお菓子がずらりと並んでいる。' },
    { type: 'sign', x: 1, y: 7, text: 'おみやげ売り場だ。\n大阪のお菓子がずらりと並んでいる。' },
  ],
});
