// 駅構内 'eki' (owner: R9-B1) — one place, one room per station you can get off at (room id = station id; the six towns'
// stations use the town id: 'tokyo' 東京, 'machi' 阿佐ケ谷, 'minato' 六本木, 'nagatacho' 永田町, 'kanraku' 新橋, 'namba' なんば).
//
//   concourse (bottom): 券売機 + 路線図・運賃表 (the HD route map, js/world/eki_map.js), 駅員の窓口, 売店, era things
//   (伝言板・公衆電話 in 昭和/平成のはじめ), the exit; the 改札 line (自動改札 / 有人改札 in 1990 and before in 東京;
//   ICカード readers from Suica 2001-11 / ICOCA 2003-11); the platform (top): 駅名標, 発車標, the train of the line.
//   Riding: 券売機 → きっぷ (or the IC card / the phone) → 改札 → the train (talk to it) → pick a station on the map
//   → fare by distance → g.advanceTime(min, '移動（電車）') → the ride (station.js travelScene 'local', the line's colour,
//   a tunnel for the metro) → out at the destination's exit (towns: their `EKI` export, read lazily; 駅前 areas:
//   PLACES[area].ekiExit). 終電 0:35 / 始発 4:45 and 台風 (運転見合わせ), 雪・雷雨・大雨 (遅れ) via g.clock / g.weather.
//   東京 and なんば: the 新幹線のりかえ口 leads to station.js's station_tokyo / station_namba (新幹線 as before).
//
// API (also PLACES.eki.api):
//   enterStation(g, st)            into a station's concourse (the 駅前 areas' doors use it)
//   rideTo(g, from, to, o)         the whole ride from the platform (pays unless o.paid) → true when travelled
//   exitPoint(g, st) → Promise<{ place, room, x, y, dir } | null>   where you come out
//   rideCutscene(g, r, toName)     the ride scene for a route (apps)
//   openRouteMap (eki_map.js), NET (eki_net.js)
// State: g.state.eki = { v, ic: null|'tokyo'|'osaka', ticket, inside, rides, fares, km, minutes, seen {}, log [] } (lazy).

import { registerPlace, PLACES, doorIndexFor } from '../engine/map.js';
import { defineTile, R as TR, P as TP } from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { SW, SH, TILE, fmtMoney, clamp, shade } from '../engine/util.js';
import { text, measure } from '../engine/draw.js';
import { audio } from '../engine/audio.js';
import { Game } from '../engine/game.js';
import { travelScene, FARE as SHIN_FARE } from './station.js';
import * as NET from './eki_net.js';
import { openRouteMap } from './eki_map.js';

NET.setShinkansenFare(SHIN_FARE);
export { NET, openRouteMap };

// ---------------------------------------------------------------- the towns' station exits (R9-A: export const EKI)
const TOWN_MOD = {
  tokyo: () => import('./tokyo.js'), machi: () => import('./machi.js'), minato: () => import('./minato.js'),
  nagatacho: () => import('./nagatacho.js'), kanraku: () => import('./kanraku.js'), namba: () => import('./namba.js'),
};
const EKI_OF = {};
for (const [t, f] of Object.entries(TOWN_MOD)) f().then((m) => { if (m && m.EKI) EKI_OF[t] = m.EKI; }).catch(() => { /* town left out */ });
// before a town has its own station entrance: the old 東京駅 / なんば駅 doors, else the town's bus stop
const FALLBACK = { machi: [38, 20], minato: [35, 28], nagatacho: [45, 51], kanraku: [35, 9] };
export async function exitPoint(g, st) {
  const s = NET.STATIONS[st];
  if (!s || !s.place) return null;
  const place = s.place;
  if (TOWN_MOD[place]) {
    let E = EKI_OF[place];
    if (!E) { try { const m = await TOWN_MOD[place](); if (m && m.EKI) E = EKI_OF[place] = m.EKI; } catch (e) { /* none */ } }
    if (E && Number.isFinite(E.x) && Number.isFinite(E.y) && PLACES[place]) return { place, room: E.room || 'main', x: E.x, y: E.y, dir: E.dir || 'down' };
    if (!PLACES[place]) return null;
    const old = place === 'tokyo' ? 'station_tokyo' : place === 'namba' ? 'station_namba' : null;
    if (old) { try { const d = doorIndexFor(old); if (d && d.town === place) return { place, room: d.room, x: d.x, y: d.y, dir: 'down' }; } catch (e) { /* none */ } }
    const fb = FALLBACK[place];
    if (fb) return { place, room: 'main', x: fb[0], y: fb[1], dir: 'down' };
    const P = PLACES[place];
    return { place, room: P.start.room, x: P.start.x, y: P.start.y, dir: P.start.dir || 'down' };
  }
  const P = PLACES[place];
  if (!P) return null;
  if (P.ekiExit) return { place, room: P.ekiExit.room || 'main', x: P.ekiExit.x, y: P.ekiExit.y, dir: P.ekiExit.dir || 'down' };
  return { place, room: P.start.room, x: P.start.x, y: P.start.y, dir: P.start.dir || 'down' };
}

// ---------------------------------------------------------------- state
const READY = new WeakSet();
export function ekiState(g) {
  const st = g.state;
  if (!st) return {};
  let e = st.eki;
  if (!e || typeof e !== 'object' || Array.isArray(e)) e = st.eki = {};
  if (!READY.has(e)) {
    const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
    e.v = 1;
    e.ic = e.ic === 'tokyo' || e.ic === 'osaka' ? e.ic : null;
    const okSt = (id) => typeof id === 'string' && !!NET.STATIONS[id];
    e.ticket = e.ticket && okSt(e.ticket.from) && okSt(e.ticket.to) ? { from: e.ticket.from, to: e.ticket.to, fare: n(e.ticket.fare), day: n(e.ticket.day) } : null;
    e.inside = e.inside && okSt(e.inside.st) ? { st: e.inside.st, how: ['ic', 'ticket'].includes(e.inside.how) ? e.inside.how : 'ic', to: okSt(e.inside.to) ? e.inside.to : null, fare: n(e.inside.fare), day: n(e.inside.day) } : null;
    for (const k of ['rides', 'fares', 'km', 'minutes']) e[k] = n(e[k]);
    e.seen = e.seen && typeof e.seen === 'object' && !Array.isArray(e.seen) ? e.seen : {};
    e.log = Array.isArray(e.log) ? e.log.filter((x) => typeof x === 'string').slice(0, 8) : [];
    READY.add(e);
  }
  return e;
}

// ---------------------------------------------------------------- the clock: walking in and out of a station is a minute
// (the clock module would count a goto between the 'eki' place and a town as a trip between towns)
let LAST_G = null;
const goto0 = Game.prototype.goto;
Game.prototype.goto = async function gotoEki(placeId, roomId, x, y, dir, opts) {
  LAST_G = this;
  try {
    const from = this.map && this.map.placeId;
    if (this.state && from && placeId && from !== placeId && (from === 'eki' || placeId === 'eki') && !(opts && opts.time === false) && typeof this.advanceTime === 'function') {
      const ex = this._clkExplicit;
      const fresh = ex && (this.frame || 0) - ex.f < 900 && /移動|電車|新幹線/.test(ex.why || '');
      if (!fresh) this.advanceTime(1, '徒歩（駅）');
    }
  } catch (e) { console.error(e); }
  return goto0.call(this, placeId, roomId, x, y, dir, opts);
};
const yearOf = (g) => NET.dateOf(g).year;

// ---------------------------------------------------------------- tiles
defineTile('eki_plat', {
  draw(c) { TR(c, 0, 0, 16, 16, '#b9bcc3'); TP(c, 4, 5, '#aeb1b8'); TP(c, 11, 12, '#c4c7cd'); },
  hd(c) {
    TR(c, 0, 0, 32, 32, '#b9bcc3');
    for (const [x, y] of [[5, 7], [19, 4], [26, 21], [9, 25], [15, 15]]) { TR(c, x, y, 2, 1, '#aeb1b8'); TP(c, x + 2, y + 1, '#c6c9cf'); }
    TR(c, 0, 31, 32, 1, '#aeb1b8'); TR(c, 31, 0, 1, 31, '#b2b5bc');
  },
});
defineTile('eki_edge', {
  draw(c) { TR(c, 0, 0, 16, 16, '#b9bcc3'); TR(c, 0, 0, 16, 2, '#e8e8ea'); TR(c, 0, 4, 16, 4, '#e8c43a'); },
  hd(c) {
    TR(c, 0, 0, 32, 32, '#b9bcc3');
    TR(c, 0, 0, 32, 3, '#f0f0f2'); TR(c, 0, 3, 32, 1, '#8e9199');
    TR(c, 0, 7, 32, 8, '#e8c43a'); TR(c, 0, 7, 32, 1, '#f6dc6a'); TR(c, 0, 14, 32, 1, '#c9a52a');
    for (let x = 2; x < 32; x += 6) { TR(c, x, 9, 2, 2, '#f6dc6a'); TP(c, x + 1, 11, '#c9a52a'); }
    TR(c, 0, 31, 32, 1, '#aeb1b8');
  },
});
defineTile('eki_track', {
  solid: true,
  draw(c) { TR(c, 0, 0, 16, 16, '#6e6a62'); TR(c, 0, 4, 16, 1, '#c0c4cc'); TR(c, 0, 11, 16, 1, '#c0c4cc'); },
  hd(c) {
    TR(c, 0, 0, 32, 32, '#5f5b54');
    for (let i = 0; i < 40; i++) TP(c, (i * 13) % 32, (i * 7) % 32, i % 2 ? '#77736a' : '#4f4b45');
    for (const x of [2, 12, 22]) { TR(c, x, 4, 7, 24, '#7a6a58'); TR(c, x, 4, 7, 1, '#8e7e6a'); }
    for (const y of [7, 23]) { TR(c, 0, y, 32, 3, '#a8adb6'); TR(c, 0, y, 32, 1, '#e0e4ea'); TR(c, 0, y + 3, 32, 1, '#4a4d54'); }
  },
});
defineTile('eki_kenbaiki', {
  solid: true, obj: true,
  draw(c) { TR(c, 1, 1, 14, 14, '#c9ccd4'); TR(c, 3, 3, 10, 5, '#3b5a8a'); TR(c, 3, 10, 4, 2, '#e8c43a'); },
  hd(c) {
    TR(c, 2, 0, 28, 31, '#5a5f6b'); TR(c, 3, 1, 26, 29, '#d4d8e0'); TR(c, 3, 1, 26, 2, '#eef0f4');
    TR(c, 6, 5, 20, 11, '#1d2a4a'); TR(c, 7, 6, 18, 9, '#3a6ab0');
    for (let k = 0; k < 3; k++) TR(c, 8 + k * 6, 8, 4, 2, '#ffe48a');
    TR(c, 8, 12, 14, 1, '#c8d8f0');
    TR(c, 6, 19, 6, 3, '#20232a'); TR(c, 7, 20, 4, 1, '#e8c43a');
    TR(c, 15, 19, 10, 4, '#a8acb6'); TR(c, 16, 20, 8, 1, '#5a5f6b');
    TR(c, 6, 25, 20, 3, '#9aa0aa'); TR(c, 7, 26, 18, 1, '#20232a');
    TR(c, 2, 30, 28, 1, '#3b3f48');
  },
});

// ---------------------------------------------------------------- props
const F = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const lineColor = (l) => (NET.LINES[l] ? NET.LINES[l].color : '#3fae49');
function linesHere(g, st) { return NET.linesAt(st, NET.ymOf(g)); }
// the 駅名標: white board, the name, its reading, the neighbours, the line colour (2 tiles wide)
function nameBoard(x, y, st) {
  return {
    type: 'prop', x, y, w: 3, h: 1, solid: true,
    talk: async (g) => {
      const ls = linesHere(g, st).filter((l) => l !== 'shinkansen');
      const nb = [];
      for (const l of ls) {
        const s = NET.stopsOf(l, NET.ymOf(g)).map((q) => q[0]);
        const i = s.indexOf(st);
        const a = s[i - 1] || (NET.LINES[l].loop ? s[s.length - 1] : null), b = s[i + 1] || (NET.LINES[l].loop ? s[0] : null);
        nb.push(`${NET.LINES[l].name}：${a ? NET.stName(a) : '（終点）'} ← ${NET.stName(st)} → ${b ? NET.stName(b) : '（終点）'}`);
      }
      await g.say([`駅名標だ。「${NET.stName(st)}」（${NET.STATIONS[st].kana}）`, nb.join('\n') || 'となりの駅の名前が書いてある。']);
    },
    draw(ctx, sx, sy, g) {
      const ls = linesHere(g, st).filter((l) => l !== 'shinkansen');
      const col = lineColor(ls[0]);
      F(ctx, sx + 6, sy + 6, 1.5, 10, '#5a5f6b'); F(ctx, sx + 40.5, sy + 6, 1.5, 10, '#5a5f6b');
      F(ctx, sx + 1, sy - 12, 46, 19, '#3b3f48'); F(ctx, sx + 1.5, sy - 11.5, 45, 18, '#ffffff');
      F(ctx, sx + 1.5, sy + 1.5, 45, 3, col);
      ls.slice(1, 3).forEach((l, i) => F(ctx, sx + 1.5 + i * 8, sy + 4.5, 8, 1.5, lineColor(l)));
      text(ctx, NET.stName(st), sx + 24, sy - 11.5, { size: NET.stName(st).length > 4 ? 6 : 8, align: 'center', color: '#1d2230', shadow: null });
      text(ctx, NET.STATIONS[st].kana, sx + 24, sy - 3.5, { size: 4, align: 'center', color: '#5a5f6b', shadow: null });
    },
  };
}
// the wall-mounted 路線図・運賃表 above the ticket machines (w tiles wide): opens the big map
function routeBoard(x, y, w, st) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      const W = w * 16 - 4;
      F(ctx, sx + 2, sy - 12, W, 26, '#3b3f48'); F(ctx, sx + 2.5, sy - 11.5, W - 1, 25, '#f4f6f8');
      F(ctx, sx + 2.5, sy - 11.5, W - 1, 4, '#1d2a4a');
      text(ctx, '路線図・運賃表', sx + 4, sy - 11.8, { size: 3, color: '#ffffff', shadow: null });
      const reg = NET.STATIONS[st].region;
      const lines = NET.LINE_ORDER.filter((l) => NET.LINES[l].region === reg && NET.lineOpen(l, NET.ymOf(g)));
      // tiny schematic: each line a coloured stroke between its stations' positions, scaled into the board
      const ox = sx + 4, oy = sy - 6, sxk = (W - 4) / 640, syk = 17 / 250;
      for (const l of lines) {
        const pts = NET.stopsOf(l, NET.ymOf(g)).map((q) => NET.STATIONS[q[0]]);
        if (NET.LINES[l].loop) pts.push(pts[0]);
        ctx.strokeStyle = NET.LINES[l].color; ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach((p, i) => { const px = ox + p.mx * sxk, py = oy + (p.my - 40) * syk; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
      }
      const me = NET.STATIONS[st];
      F(ctx, ox + me.mx * sxk - 1, oy + (me.my - 40) * syk - 1, 2, 2, '#ff3b4f');
    },
  };
}
// 発車標 hanging over the platform: 昭和 white flap boards, 平成 orange LED, 令和 full-colour LCD
function departureBoard(x, y, st) {
  return {
    type: 'prop', x, y, w: 4, h: 1, solid: false, z: 600,
    talk: async (g) => { await g.say(departureText(g, st)); },
    draw(ctx, sx, sy, g) {
      const ym = NET.ymOf(g);
      const ls = linesHere(g, st).filter((l) => l !== 'shinkansen');
      F(ctx, sx + 16, sy - 30, 1, 8, '#5a5f6b'); F(ctx, sx + 47, sy - 30, 1, 8, '#5a5f6b');
      const lcd = ym >= 201001, led = ym >= 199401;
      F(ctx, sx + 2, sy - 23, 60, 15, '#3b3f48');
      F(ctx, sx + 2.5, sy - 22.5, 59, 14, lcd ? '#0b1020' : led ? '#0b0d12' : '#f4f2ea');
      const rows = departureRows(g, st).slice(0, 2);
      rows.forEach((r, i) => {
        const col = lcd ? (i ? '#ffffff' : '#ffe48a') : led ? (i ? '#ffb03a' : '#ff8a3d') : '#20232a';
        if (lcd) F(ctx, sx + 3.5, sy - 21.5 + i * 6.5, 4, 5, lineColor(ls[i % Math.max(1, ls.length)] || ls[0]));
        text(ctx, r, sx + (lcd ? 9 : 4), sy - 22 + i * 6.5, { size: 5, color: col, shadow: null });
      });
    },
  };
}
function departureRows(g, st) {
  const t = NET.clockTotal(g);
  const ls = linesHere(g, st).filter((l) => l !== 'shinkansen');
  const base = t == null ? 600 : t % 1440;
  return ls.slice(0, 2).map((l, i) => {
    const m = base + 2 + i * 3;
    const s = NET.stopsOf(l, NET.ymOf(g)).map((q) => q[0]);
    const dest = NET.LINES[l].loop ? (i % 2 ? '内回り' : '外回り') : NET.stName(s[s.length - 1] === st ? s[0] : s[s.length - 1]);
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} ${NET.LINES[l].short.slice(0, 4)} ${dest}`;
  });
}
function departureText(g, st) {
  const svc = NET.serviceNow(g, ['jr']);
  const rows = departureRows(g, st);
  if (!svc.ok) return ['発車標だ。', `「${svc.why}」と表示されている。`];
  return ['発車標だ。', rows.join('\n') + (svc.delay ? `\n（${svc.delayWhy}：約${svc.delay}分）` : '')];
}
// the train at the platform: arrives, waits with the doors open, leaves; talk to it to board
const TRAIN = { t0: 0, room: null };
const CYCLE = 1080;
function trainPhase(g) { return ((g.frame || 0) - TRAIN.t0) % CYCLE; }
function trainProp(x, y, w, st) {
  return {
    type: 'prop', x, y, w, h: 2, solid: false,
    talk: async (g) => { await board(g, st); },
    draw(ctx, sx, sy, g) {
      const ph = trainPhase(g);
      // 0..90 arriving, 90..780 standing (doors open), 780..870 leaving, 870.. empty
      let off;
      if (ph < 90) { const k = 1 - ph / 90; off = Math.round(k * k * 420); }
      else if (ph < 780) off = 0;
      else if (ph < 870) { const k = (ph - 780) / 90; off = -Math.round(k * k * 420); }
      else return;
      const ls = linesHere(g, st).filter((l) => l !== 'shinkansen');
      const L = NET.LINES[ls[0]] || NET.LINES.kanjo;
      const metro = L.kind === 'metro';
      const roomLeft = sx - x * TILE;
      ctx.save();
      ctx.beginPath(); ctx.rect(roomLeft, sy - 8, w * TILE + x * TILE * 2, 40); ctx.clip();
      const open = ph >= 110 && ph < 760;
      for (let k = 0; k < 3; k++) {
        const cx = sx + off + 4 + k * 116;
        const body = metro ? '#d8dce4' : '#e4e7ec';
        F(ctx, cx, sy - 4, 112, 34, '#4a4e58');
        F(ctx, cx + 0.5, sy - 3.5, 111, 33, body);
        F(ctx, cx + 0.5, sy - 3.5, 111, 1.5, '#ffffff');
        F(ctx, cx + 0.5, metro ? sy + 2 : sy + 17, 111, metro ? 3 : 4, L.color);
        if (metro) F(ctx, cx + 0.5, sy + 20, 111, 2, L.color);
        for (let d = 0; d < 4; d++) {
          const dx = cx + 8 + d * 27;
          F(ctx, dx, sy + 2, 12, 27, open ? '#2a2f3a' : '#b8bcc6');
          if (open) { F(ctx, dx - 4, sy + 2, 4, 27, '#b8bcc6'); F(ctx, dx + 12, sy + 2, 4, 27, '#b8bcc6'); }
          else F(ctx, dx + 5.5, sy + 2, 1, 27, '#8e929c');
          F(ctx, dx + 1, sy + 5, 10, 8, open ? '#3a4050' : '#3b4a6a');
          if (d < 3) F(ctx, dx + 15, sy + 4, 9, 9, '#3b4a6a');
        }
        F(ctx, cx, sy + 30, 112, 2, '#20232a');
      }
      ctx.restore();
    },
  };
}
// overlays on the gate line by era: IC readers (blue) / a 有人改札 booth (ラッチ) in Tokyo before 1990-04
const manned = (g, st) => NET.STATIONS[st].region === 'tokyo' && NET.ymOf(g) < 199004;
function gateOverlay(x, y, st) {
  return {
    type: 'prop', x, y, w: 1, h: 1, solid: false, z: 2,
    draw(ctx, sx, sy, g) {
      if (manned(g, st)) {
        F(ctx, sx + 1, sy - 6, 6, 20, '#6b4a2e'); F(ctx, sx + 1.5, sy - 5.5, 5, 19, '#a87a4a'); F(ctx, sx + 1, sy - 7, 7, 2, '#5a3a20');
        return;
      }
      if (NET.icEra(g, NET.STATIONS[st].region)) { F(ctx, sx + 1, sy + 3, 4, 3, '#2a6fd0'); F(ctx, sx + 1.5, sy + 3.5, 3, 1, '#9ac8ff'); }
    },
  };
}

// ---------------------------------------------------------------- the stations' looks and people
// wall: the concourse's wall theme; under: underground (metro: a tiled wall over the tracks, no sky); people: two
// passengers' lines (era: functions of the year)
const LOOK = {
  tokyo: { wall: 'brick', floor: 'floor_marble', back: 'white', shin: 'station_tokyo' },
  machi: { wall: 'cream', floor: 'floor_tile', back: 'gray' },
  minato: { wall: 'dark', floor: 'floor_tile', back: 'dark', under: true },
  nagatacho: { wall: 'gray', floor: 'floor_marble', back: 'gray', under: true },
  kanraku: { wall: 'gray', floor: 'floor_tile', back: 'gray' },
  namba: { wall: 'cream', floor: 'floor_tile', back: 'cream', under: true, shin: 'station_namba' },
  akihabara: { wall: 'white', floor: 'floor_tile', back: 'white' },
  ueno: { wall: 'cream', floor: 'floor_marble', back: 'cream' },
  shinjuku: { wall: 'gray', floor: 'floor_marble', back: 'gray' },
  shibuya: { wall: 'white', floor: 'floor_tile', back: 'white' },
  asakusa: { wall: 'red', floor: 'floor_tile', back: 'cream', under: true },
  shimokita: { wall: 'dark', floor: 'floor_tile', back: 'dark' },
  chofu: { wall: 'white', floor: 'floor_tile', back: 'white' },
  fuchu: { wall: 'white', floor: 'floor_tile', back: 'gray' },
  umeda: { wall: 'white', floor: 'floor_marble', back: 'white' },
  dobutsuen: { wall: 'dark', floor: 'floor_tile', back: 'dark', under: true },
};
const PEOPLE = {
  tokyo: [['出張の会社員', (y) => [y < 2001 ? '朝の東京駅は、人の波だ。' : '駅の中に、お店がずいぶん増えたよね。', '新幹線は、奥の「新幹線のりかえ口」から。在来線とは改札が別なんだ。']], ['観光客', () => ['ここから環状線、中央線、メトロ…。', '路線図を見ないと、どこへ行けばいいかわからない！']]],
  machi: [['商店街のおばあちゃん', () => ['この駅の南口を出ると、すぐ商店街よ。', '芸人さんの卵が、このへんにたくさん住んでるの。家賃が安いからねえ。']], ['若手芸人', (y, g) => ['ライブの帰りなんです。', weekendWord(g)]]],
  minato: [['ADさん', () => ['テレビ局へはこの駅が近いんです。', '終電を逃したら、タクシー代は自腹…いや、経費で落ちるかな…。']], ['夜の街の人', () => ['この駅、夜のほうがにぎやかなのよ。']]],
  nagatacho: [['議員秘書', () => ['国会の日は、この駅の出口が混むんです。', '地下鉄の乗りかえで、迷子になる新人秘書が毎年います。']], ['見学の学生', () => ['国会議事堂の見学に来ました！']]],
  kanraku: [['サラリーマン', (y) => [y < 1996 ? '駅前の広場で、テレビの街頭インタビューをよくやってるよ。' : '駅前の広場は、待ち合わせの定番。', '終電まで飲んで、走って帰るのがお決まりさ。']], ['駅員さんの話を聞いた人', () => ['酔っぱらいの忘れ物、すごい数なんだって。']]],
  namba: [['大阪のおばちゃん', () => ['地下鉄で梅田まで、すぐやで！', '御堂筋線は、いつも混んでるけどな。']], ['観光客', () => ['新幹線は新大阪からなんだって。', 'なんばからは地下鉄で新大阪へ行くんだね。']]],
  akihabara: [['電気街の店員', (y) => [y < 1995 ? '休みの日は、家電を買いに来る家族連れでいっぱいです。' : y < 2005 ? 'パソコンのパーツを探しに来る人が増えました。' : 'アニメやゲームのお店も増えましたね。', '電気街口を出たら、すぐですよ。']], ['旅行者', () => ['Akihabara! 駅を出たら、看板だらけだね！']]],
  ueno: [['上野の常連', (y) => [y < 1990 ? '上野は北の玄関口。東北から夜行列車で来た人が、まずここに着くんだ。' : '上野公園の桜の季節は、駅から人があふれるよ。', '動物園、美術館、アメ横。一日じゃ回りきれない。']], ['修学旅行生', () => ['公園口を出ると、すぐ公園なんだって！']]],
  shinjuku: [['迷子の人', () => ['出口が…東口、西口、南口…どこから出ればいいの？', '世界一乗り降りが多い駅って、本当らしいよ。']], ['会社員', (y) => [y < 1991 ? '西口の高層ビル街に、都庁の新しい庁舎を建てているんだ。' : '西口の先に、都庁がそびえてる。', '毎日この人ごみをくぐって通勤さ。']]],
  shibuya: [['若者', (y) => [y < 1999 ? '待ち合わせは、もちろんハチ公前！' : '待ち合わせはハチ公前。でも人が多すぎて見つからない！', '駅前のスクランブル交差点、すごい人だよ。']], ['駅員さんの話を聞いた人', (y) => [y >= 2013 ? '駅がどんどん工事で変わって、出口の場所も変わるんだって。' : '東横線の駅は、高いところにあるんだよ。']]],
  asakusa: [['人力車の車夫', () => ['駅を出たら、雷門はすぐそこ！', '人力車で浅草めぐり、いかがっすか！']], ['寄席帰りの人', () => ['演芸ホールで、昼から夜まで笑いっぱなしさ。']]],
  shimokita: [['バンドマン', (y) => [y < 2013 ? '駅のすぐ横に踏切があって、なかなか開かないんだよね。' : '線路が地下に入って、踏切がなくなったんだ。', '小劇場、ライブハウス、古着屋。夢を追う人の街さ。']], ['劇団員', () => ['今夜、駅前の小劇場で本番なんです！']]],
  chofu: [['教習生', () => ['教習所に通ってるんです。駅から歩いてすぐ。', '調布は「映画のまち」なんですって。撮影所が近くにあるとか。']], ['地元の人', (y) => [y >= 2012 ? '駅が地下になって、駅前が広くなったのよ。' : '駅前の踏切、渋滞するのよね。']]],
  fuchu: [['免許の更新に来た人', () => ['試験場は、駅からバスか歩きで。', '朝いちばんに来ないと、更新の列が長くて…。']], ['受験生', () => ['今日、本免の学科試験なんです…緊張する。']]],
  umeda: [['大阪の会社員', () => ['JRは「大阪駅」、地下鉄は「梅田駅」。同じところやで。', '地下街で迷うのは、大阪の人でもよくあることや。']], ['観光客', () => ['梅田の地下街、まるで迷路だね！']]],
  dobutsuen: [['新世界の常連', () => ['駅を出たら、通天閣が見えるで。', '串カツは、ソースの二度づけ禁止や！']], ['動物園帰りの親子', () => ['天王寺動物園、楽しかったね！']]],
};
function weekendWord(g) {
  const d = (g.state && g.state.day) || 1;
  return ((d - 1) % 7) >= 5 ? '今日は土日だから、中央線の快速がここに止まらないんです。各駅停車で来ました。' : '中央線の快速、土日はこの駅に止まらないから気をつけて。';
}

// ---------------------------------------------------------------- the room
const W = 24, H = 15, ENTRY = { x: 11, y: 13, dir: 'up' };
const GATES = [7, 9, 11, 13, 15], PASSES = [8, 10, 12, 14];
function stationRoom(st) {
  const look = LOOK[st] || LOOK.tokyo;
  const s = NET.STATIONS[st];
  return {
    floor: look.floor, wall: look.wall, bg: '#20232a', topPad: 0, entry: ENTRY,
    generate() {
      const cells = [];
      for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
          let v = [look.floor];
          if (y === 0) v = ['walltop_' + look.back];
          else if (y === 1) v = ['wall_' + look.back, ...(x % 6 === 2 ? ['poster_wide'] : x % 6 === 5 ? ['poster'] : [])];
          else if (y === 2 || y === 3) v = ['eki_track'];
          else if (y === 4) v = ['eki_edge'];
          else if (y === 5 || y === 6) v = ['eki_plat'];
          else if (y === 7) v = GATES.includes(x) ? ['eki_plat', 'station_gate'] : PASSES.includes(x) ? [look.floor, 'station_strip'] : ['eki_plat', 'railing'];
          else if (y === 8 && (x <= 6 || x >= 17)) v = ['walltop_' + look.wall];
          else if (y === 9 && (x <= 6 || x >= 17)) v = ['wall_' + look.wall, ...(x === 20 ? ['window'] : x === 18 || x === 22 ? ['poster'] : [])];
          else if (y === 10 && x >= 1 && x <= 5) v = [look.floor, 'eki_kenbaiki'];
          else if (y === 10 && x >= 18 && x <= 21) v = [look.floor, 'counter_white'];
          else if (y === H - 1) v = x === 11 || x === 12 ? ['exit_mat'] : ['walltop_' + look.wall];
          else if (x === 0 || x === W - 1) v = ['walltop_' + look.wall];
          row.push(v);
        }
        cells.push(row);
      }
      const put = (x, y, t) => { cells[y][x] = [cells[y][x][0], t]; };
      // platform furniture
      for (const x of [2, 3, 19, 20]) put(x, 5, 'bench');
      put(22, 5, 'vending'); put(1, 6, 'trash');
      // concourse: lockers, plants, a kiosk
      for (const x of [1, 2]) put(x, 13, 'locker');
      put(6, 13, 'plant'); put(17, 13, 'plant');
      for (const x of [20, 21, 22]) put(x, 13, 'shelf_goods');
      put(22, 12, 'register');
      if (look.shin) { for (let y = 10; y <= 12; y++) cells[y][W - 1] = [look.floor, 'tactile']; }
      const entities = [
        trainProp(1, 2, 22, st),
        nameBoard(10, 5, st),
        departureBoard(14, 5, st),
        routeBoard(1, 9, 5, st),
        ...GATES.map((x) => gateOverlay(x, 7, st)),
        ...[1, 2, 3, 4, 5].map((x) => ({ type: 'sign', x, y: 10, talk: (g) => ticketMachine(g, st) })),
        { type: 'npc', id: 'eki_staff', x: 19, y: 9, dir: 'down', look: { ...LOOKS.guard, hat: s.region === 'osaka' ? '#2a4a8a' : '#2f5fd0' }, name: '駅員さん', fixedDir: true, talk: (g, npc) => staffTalk(g, npc, st) },
        { type: 'npc', id: 'eki_kaisatsu', x: 16, y: 8, dir: 'left', look: { ...LOOKS.guard, hat: '#3a3f4a' }, name: '改札の駅員さん', fixedDir: true, cond: (g) => manned(g, st),
          talk: async (g, npc) => { await g.say(['きっぷを拝見します。', 'きっぷは、そこの券売機でどうぞ。改札でパチンと切りますからね。'], { name: npc.name, look: npc.look }); } },
        { type: 'npc', id: 'eki_kiosk', x: 21, y: 12, dir: 'down', look: { ...LOOKS.clerk, top: '#e07a1f' }, name: '売店の人', fixedDir: true, talk: (g, npc) => kiosk(g, npc, st) },
        ...(PEOPLE[st] || []).map(([name, lines], i) => ({
          type: 'npc', id: `eki_p${i}`, x: i ? 5 : 7, y: i ? 6 : 11, dir: i ? 'up' : 'right', look: i ? { ...LOOKS.salaryman, top: ['#6a7a8a', '#8a5a3a', '#3a6a9a'][st.length % 3] } : { ...LOOKS.fan, top: ['#ff9a3c', '#5fd7ff', '#ff7eb6'][st.length % 3] }, name, wander: 1,
          talk: async (g, npc) => { await g.say(lines(yearOf(g), g), { name: npc.name, look: npc.look }); },
        })),
        // era things: the 伝言板 (chalk message board) and a 公衆電話
        { type: 'prop', x: 8, y: 13, w: 2, h: 1, solid: true, cond: (g) => yearOf(g) < 2000,
          talk: async (g) => { await g.say(['伝言板だ。チョークで書いた伝言が並んでいる。', '「ケンジへ　先に行ってます　10:30　ユミ」\n「3時まで待った。帰ります」', '（ケータイがない時代の、待ち合わせの必需品だ）']); },
          draw(ctx, sx, sy) { F(ctx, sx + 3, sy + 4, 2, 12, '#5a3a20'); F(ctx, sx + 27, sy + 4, 2, 12, '#5a3a20'); F(ctx, sx + 1, sy - 10, 30, 16, '#5a3a20'); F(ctx, sx + 2, sy - 9, 28, 14, '#2f4a3a'); for (let k = 0; k < 4; k++) F(ctx, sx + 4, sy - 7 + k * 3, 10 + (k * 7) % 12, 1, '#e8e8e0'); text(ctx, '伝言板', sx + 16, sy - 13, { size: 4, align: 'center', color: '#ffffff', shadow: '#20232a' }); } },
        { type: 'prop', x: 15, y: 13, w: 1, h: 1, solid: true, cond: (g) => yearOf(g) < 2010,
          talk: async (g) => { await g.say(yearOf(g) < 1995 ? ['緑の公衆電話だ。テレホンカードも使える。', '実家に電話しようか…今日はやめておこう。'] : ['公衆電話だ。ケータイを持つ人が増えて、使う人は少なくなった。']); },
          draw(ctx, sx, sy, g) { F(ctx, sx + 3, sy - 4, 10, 18, '#3a3f48'); F(ctx, sx + 4, sy - 3, 8, 16, yearOf(g) < 1995 ? '#3f9a5a' : '#9aa0aa'); F(ctx, sx + 5, sy - 1, 6, 4, '#20232a'); F(ctx, sx + 5, sy + 5, 6, 5, '#e8e8e0'); } },
      ];
      if (look.shin) entities.push({ type: 'sign', x: W - 2, y: 9, text: ['「新幹線のりかえ口 →」', look.shin === 'station_tokyo' ? '新幹線は、この先の新幹線のりば（東京駅 新幹線きっぷうりば）から。' : '東京へは、この先のなんば駅きっぷうりば（新大阪で新幹線に乗りかえ）から。'] });
      const events = [
        ...PASSES.map((x) => ({ x, y: 7, on: 'step', run: (g) => gateStep(g, st) })),
        { x: 11, y: H - 1, w: 2, h: 1, on: 'step', run: (g) => leaveStation(g, st) },
      ];
      if (look.shin) events.push({ x: W - 1, y: 10, w: 1, h: 3, on: 'step', run: (g) => toShinkansen(g, st, look.shin) });
      return { w: W, h: H, cells, entities, events };
    },
    onEnter: async (g) => {
      TRAIN.t0 = (g.frame || 0) - 200; // a train is standing at the platform when you come in
      const E = ekiState(g);
      E.seen[st] = true;
      if (!g.flag('eki_first')) {
        g.setFlag('eki_first');
        g.notify('駅構内：券売機できっぷ → 改札 → ホームの電車に話しかけて乗る', { color: '#ffd23f', life: 300 });
      }
    },
  };
}

// ---------------------------------------------------------------- the concourse
async function useMap(g, st) {
  const to = await openRouteMap(g, { from: st, mode: 'browse' });
  if (!to) return;
  await buyTicket(g, st, to);
}
async function ticketMachine(g, st) {
  const reg = NET.STATIONS[st].region;
  const E = ekiState(g);
  const card = NET.cardOf(g);
  const choices = ['行き先をえらんで、きっぷを買う', '路線図・運賃表を見る'];
  const ic = NET.icEra(g, reg) && !card;
  if (ic) choices.push(`${NET.cardName(reg)}を買う（デポジット${fmtMoney(500)}）`);
  choices.push('やめておく');
  const head = card ? `券売機だ。（${NET.cardLabel(g, reg)}があれば、きっぷなしで改札を通れる）` : NET.icEra(g, reg) ? `券売機だ。きっぷと${NET.cardName(reg)}が買える。` : '券売機だ。上の路線図で運賃をたしかめて、きっぷを買う。';
  const i = await g.ask(head, choices, { cancel: choices.length - 1 });
  if (i === 0) await buyTicket(g, st);
  else if (i === 1) await useMap(g, st);
  else if (ic && i === 2) {
    if (!g.spend(500)) { await g.say('お金が足りない…。'); return; }
    E.ic = reg;
    audio.sfx('coin');
    await g.say([`${NET.cardName(reg)}を買った！`, '改札でタッチするだけで乗れる。運賃は、乗ったぶんだけ所持金からはらう。']);
  }
}
async function buyTicket(g, st, to = null) {
  if (!to) to = await openRouteMap(g, { from: st, mode: 'buy' });
  if (!to) return false;
  const r = NET.route(g, st, to);
  if (!r) { await g.say('そこへは、ここからは行けないみたい…。'); return false; }
  const svc = r.service.ok ? '' : `\n（${r.service.why}）`;
  const i = await g.ask(`${NET.stLabel(to)}まで ${fmtMoney(r.fare)}（${NET.hm(r.min)}・${r.transfers ? `乗換${r.transfers}回` : '乗換なし'}）\n${r.text}${svc}`, ['きっぷを買う', 'やめておく'], { cancel: 1 });
  if (i !== 0) return false;
  if (!g.spend(r.fare)) { await g.say('お金が足りない…。'); return false; }
  audio.sfx('coin');
  const E = ekiState(g);
  E.ticket = { from: st, to, fare: r.fare, day: g.state.day };
  g.notify(`きっぷを買った：${NET.stName(st)} → ${NET.stName(to)}（${fmtMoney(r.fare)}）`, { color: '#ffffff' });
  return true;
}
async function staffTalk(g, npc, st) {
  const say = (t) => g.say(t, { name: npc.name, look: npc.look });
  const reg = NET.STATIONS[st].region;
  const svc = NET.serviceNow(g, ['jr']);
  const opts = ['乗り方を聞く', '運行情報を聞く', NET.icEra(g, reg) ? 'ICカードのこと' : 'きっぷのこと', 'なんでもない'];
  const i = await g.ask(`${NET.stLabel(st)}の窓口です。どうされました？`, opts, { name: npc.name, look: npc.look, cancel: 3 });
  if (i === 0) await say(['券売機で行き先のきっぷを買って、改札を通ってください。', 'ホームの電車に乗ったら、あとは着くのを待つだけ。乗りかえも案内どおりで大丈夫ですよ。', ...(NET.STATIONS[st].region === 'tokyo' && NET.ymOf(g) < 199004 ? ['改札では、駅員がきっぷにハサミを入れます。'] : [])]);
  else if (i === 1) await say(svc.ok ? [svc.delay ? `${svc.delayWhy}が出ています。約${svc.delay}分の遅れです。` : '全線、平常どおり運転しています。', '終電は0時半ごろ、始発は朝5時前です。'] : [`${svc.why}。`, '運転再開まで、しばらくお待ちください。']);
  else if (i === 2) {
    if (!NET.icEra(g, reg)) await say(['きっぷは券売機で。路線図の上に、駅ごとの運賃が書いてあります。', '遠くまで行くなら、窓口でも売っていますよ。']);
    else await say([`${NET.cardName(reg)}はタッチするだけで改札を通れます。`, NET.phoneCard(g) ? 'いまはスマホにも入れられますね。全国の交通系ICカードは、ほとんどの路線で使えます。' : NET.ymOf(g) < 201303 ? 'ただ、会社によってはまだ使えない路線もあります。そのときは、きっぷを買ってくださいね。' : '全国の交通系ICカードが、相互に使えるようになりました。']);
  }
}
async function kiosk(g, npc, st) {
  const items = [['新聞・雑誌', 150, 'wadai'], ['のどあめ', 200, 'nodoame'], ['おにぎり', 150, 'onigiri']];
  const i = await g.ask('いらっしゃいませ。', [...items.map(([n, p]) => `${n} ${fmtMoney(p)}`), 'いらない'], { name: npc.name, look: npc.look, cancel: items.length });
  if (i < 0 || i >= items.length) return;
  const [name, price, id] = items[i];
  if (!g.spend(price)) { await g.say('お金が足りない…。'); return; }
  audio.sfx('coin');
  g.giveItem(id);
  await g.say(`${name}を買った。`);
}

// ---------------------------------------------------------------- the gate
async function gateStep(g, st) {
  const p = g.map.player;
  const E = ekiState(g);
  if (p.dir === 'down') {
    // back out to the concourse: the ticket stays good
    if (E.inside && E.inside.st === st) {
      if (E.inside.how === 'ticket' && E.inside.to) E.ticket = { from: st, to: E.inside.to, fare: E.inside.fare, day: g.state.day };
      E.inside = null;
    }
    return;
  }
  if (E.inside && E.inside.st === st) return;
  const reg = NET.STATIONS[st].region;
  const old = manned(g, st);
  if (E.ticket && E.ticket.from === st) {
    E.inside = { st, how: 'ticket', to: E.ticket.to, fare: E.ticket.fare, day: g.state.day };
    E.ticket = null;
    audio.sfx(old ? 'cursor' : 'ok');
    g.notify(old ? 'パチン！ 駅員さんがきっぷを切った' : 'きっぷを改札に通した', { color: '#ffffff' });
    return;
  }
  const card = NET.cardOf(g);
  if (card && NET.icEra(g, reg)) {
    E.inside = { st, how: 'ic', to: null, fare: 0, day: g.state.day };
    audio.sfx('coin');
    g.notify(`ピッ（${NET.cardLabel(g, reg)}）`, { color: '#9ac8ff' });
    return;
  }
  const api = PLACES.kanraku && PLACES.kanraku.api;
  const choices = ['きっぷを買う', 'もどる'];
  if (api && typeof api.fareEvasion === 'function') {
    let label = 'きっぷなしで通る…';
    try { if (typeof g.crimeMode === 'function' && g.crimeMode()) { const o = g.crimeOdds('fare_evasion', { detect: 0.5 }); if (o && o.ok) label = `きっぷなし（成功${o.pct.success}%）`; } } catch (e) { console.error(e); }
    choices.push(label);
  }
  const k = await g.ask(old ? '改札の駅員さん「きっぷを拝見します」\n（きっぷを持っていない…）' : `改札だ。きっぷ${NET.icEra(g, reg) ? 'かICカード' : ''}がないと通れない。`, choices, { cancel: 1 });
  if (k === 0) {
    if (await buyTicket(g, st)) { await gateStep(g, st); return; }
  } else if (k === 2) {
    const to = await openRouteMap(g, { from: st, mode: 'ride', title: '（どこまで行く…？）' });
    if (to) {
      const r = NET.route(g, st, to);
      const res = await api.fareEvasion(g, { fare: r ? r.fare : 200, dest: NET.stName(to), inspected: false, ride: async () => { await rideTo(g, st, to, { paid: true, evade: true, noWait: true }); } });
      if (res && res.ok) return;
    }
  }
  await g.movePlayer(['down']);
}

// ---------------------------------------------------------------- boarding and the ride
async function board(g, st) {
  const E = ekiState(g);
  if (trainPhase(g) >= 780) { TRAIN.t0 = (g.frame || 0) - 60; await g.say('（次の電車が、ホームに入ってきた）'); }
  if (!E.inside || E.inside.st !== st) {
    await g.say('電車だ。（改札を通ってから乗ろう）');
    return;
  }
  let to = E.inside.to;
  if (to) {
    const i = await g.ask(`電車だ。${NET.stLabel(to)}へ向かう？`, ['乗る', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
  } else {
    to = await openRouteMap(g, { from: st, mode: 'ride' });
    if (!to) return;
  }
  const how = E.inside.how;
  const ok = await rideTo(g, st, to, { paid: how === 'ticket', ticketFare: E.inside.fare });
  if (ok) E.inside = null;
}
export async function rideTo(g, from, to, o = {}) {
  let r = NET.route(g, from, to);
  if (!r) { await g.say('そこへは、ここからは行けないみたい…。'); return false; }
  if (!r.service.ok) {
    if (r.service.wait != null && !o.noWait) {
      const i = await g.ask(`${r.service.why}。\n駅のベンチで始発を待つ？（あと${NET.hm(r.service.wait)}）`, ['始発を待つ', 'やめておく'], { cancel: 1 });
      if (i !== 0) return false;
      if (typeof g.advanceTime === 'function') g.advanceTime(r.service.wait, '始発待ち');
      g.addNeed('stress', 4);
      r = NET.route(g, from, to) || r;
    } else { await g.say(`${r.service.why}…。`); return false; }
  }
  // the fare: a ticket was paid at the machine (a longer ride than the ticket: 精算); the IC card pays now
  let pay = 0, payText = '';
  if (o.evade) pay = 0;
  else if (o.paid) {
    const extra = Math.max(0, r.fare - (o.ticketFare || r.fare));
    if (extra) { pay = extra; payText = `のりこし精算 ${fmtMoney(extra)}`; }
  } else {
    pay = r.fare;
    payText = r.ic.ok ? `ピッ ${fmtMoney(r.fare)}（${NET.cardLabel(g, NET.STATIONS[from].region)}）` : r.ic.card ? `${r.ic.why}ので、きっぷを買い直した（${fmtMoney(r.fare)}）` : `運賃 ${fmtMoney(r.fare)}`;
  }
  if (pay && g.state.money < pay) { await g.say(['お金が足りない…。', `（${fmtMoney(pay)} 必要）`]); return false; }
  if (pay) g.spend(pay);
  const E = ekiState(g);
  E.rides++; E.fares += pay + (o.paid && !o.evade ? (o.ticketFare || 0) : 0); E.km += r.km; E.minutes += r.min;
  E.log = [`${NET.stName(from)}→${NET.stName(to)}`, ...E.log].slice(0, 8);
  if (typeof g.advanceTime === 'function') g.advanceTime(r.min, '移動（電車）');
  const rush = NET.rushNow(g) && !r.kinds.includes('shinkansen');
  if (rush) g.addNeed('stress', 3);
  await rideCutscene(g, r, NET.stLabel(to));
  const ex = await exitPoint(g, to);
  if (!ex) { await g.fadeIn(); await g.say('（その駅の出口は、工事中だった…）'); return false; }
  await g.goto(ex.place, ex.room, ex.x, ex.y, ex.dir);
  const lines = [...new Set(r.segs.map((s) => NET.LINES[s.line].short))].join('・');
  await g.say([`${NET.stLabel(to)}に着いた。`, `（${lines} ${NET.hm(r.min)}${payText ? `・${payText}` : ''}${r.delay ? `・${r.delayWhy}` : ''}）`, ...(rush ? ['満員電車で、ぎゅうぎゅうだった…。（ストレス+3）'] : [])].slice(0, 3));
  g.save(true);
  return true;
}
// the ride scene for a route (fades out before, leaves the screen faded out)
export async function rideCutscene(g, r, toName) {
  const main = r.segs.reduce((a, s) => (!a || s.min > a.min ? s : a), null);
  const L = main ? NET.LINES[main.line] : NET.LINES.kanjo;
  const shin = r.kinds.includes('shinkansen');
  const via = r.text.length > 44 ? `${NET.LINES[r.segs[0].line].short} ほか（乗換${r.transfers}回）` : r.text;
  await g.fadeOut();
  const sc = travelScene(g, { to: toName, via, vehicle: shin ? 'shinkansen' : 'local', scenery: shin ? 'fuji' : L.kind === 'metro' ? 'tunnel' : 'city', color: L.color });
  await g.fadeIn();
  await sc;
  await g.fadeOut();
}

// ---------------------------------------------------------------- in and out
export async function enterStation(g, st) {
  if (!NET.STATIONS[st] || !(PLACES.eki && PLACES.eki.rooms[st])) { await g.say('（駅は、まだ工事中のようだ…）'); return; }
  await g.goto('eki', st, ENTRY.x, ENTRY.y, 'up');
}
async function leaveStation(g, st) {
  const E = ekiState(g);
  if (E.inside) { if (E.inside.how === 'ticket' && E.inside.to) E.ticket = { from: E.inside.st, to: E.inside.to, fare: E.inside.fare, day: g.state.day }; E.inside = null; }
  const ex = await exitPoint(g, st);
  if (!ex) { await g.say('（出口は工事中のようだ…）'); await g.movePlayer(['up']); return; }
  await g.goto(ex.place, ex.room, ex.x, ex.y, ex.dir);
}
async function toShinkansen(g, st, place) {
  if (!PLACES[place]) { await g.movePlayer(['left']); return; }
  await g.goto(place, 'concourse', 11, 8, 'up');
}

// ---------------------------------------------------------------- the place
const rooms = {};
for (const id of Object.keys(NET.STATIONS)) if (NET.enterable(id)) rooms[id] = stationRoom(id);
const place = {
  id: 'eki', kind: 'building', bgm: 'office', noTrip: false, rooms,
  api: { enterStation, rideTo, exitPoint, rideCutscene, openRouteMap, ekiState, NET },
};
// enterPlace('eki') (a door without its own goto): the station of the town you are in
const curStation = () => {
  const g = LAST_G || (typeof window !== 'undefined' && window.__game) || null;
  const m = g && g.map;
  return m && m.placeId === 'eki' && rooms[m.roomId] ? m.roomId : null;
};
Object.defineProperty(place, 'name', { enumerable: true, get() { const st = curStation(); return st ? NET.stLabel(st) : '駅'; } });
Object.defineProperty(place, 'start', {
  enumerable: true,
  get() {
    const g = LAST_G || (typeof window !== 'undefined' && window.__game) || null;
    const here = g && g.map && g.map.placeId;
    const st = here && NET.stationOfPlace(here);
    return { room: st && rooms[st] ? st : 'tokyo', x: ENTRY.x, y: ENTRY.y, dir: 'up' };
  },
});
registerPlace(place);
