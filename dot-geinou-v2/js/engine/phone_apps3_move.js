// 乗換案内 (手帳の時代: 時刻表と路線図) — routes from where you are to any place you have been to, by
// means (徒歩 / 電車 / バス / タクシー / 新幹線), with the time, the fare, transfers and 体力. Picking a
// route starts the trip like the マップ app (closePhoneThen → fare, 体力, a short ride, g.goto).
// The 電車 is only here (the マップ app has bus / taxi / walk / 新幹線): cheaper than a taxi, faster
// than the bus. With the clock module (g.clock) it shows departure / arrival times, 終電 and the
// taxi's 深夜割増 (+20%, 22:00–5:00); with the weather (g.weather) delays and 運転見合わせ.
// Facts: 東京–新大阪 fastest: ひかり 2時間56分 (1986-11), のぞみ 2時間30分 (1992-03-14), 2時間25分
// (N700系 2007-07), 2時間22分 (2015-03-14), 2時間21分 (2020-03-14). Tokyo taxi fares: phone_apps.js taxiFare.
// IC乗車券 (Suica) 2001-11-18: earlier eras buy a きっぷ.

import { SW, SH, fmtMoney, clamp, shade, mix } from './util.js';
import { text } from './draw.js';
import { audio } from './audio.js';
import { PLACES, buildRoom } from './map.js';
import { GUIDE, GUIDE_ORDER } from '../world/guide.js';
import { phoneView, phoneInfo, closePhoneThen, phoneOverMapOnly } from './phone.js';
import { appState, panelView, lifeBlock, taxiFare, placeLabel } from './phone_apps.js';
import {
  num, isObj, arr, str, has, safe, R, disc, devOf, dateOf, realT, part, definePart, clockNow, clockLabel, passMinutes,
  weatherNow, hm, chip, buttons, hit, T, fitText, PC, box, rrect, para,
} from './phone_apps3_kit.js';

const EXT = { station: null };
import('../world/station.js').then((m) => { EXT.station = m; }).catch(() => { /* station.js left out */ });

export const COLOR = '#2a7ab0';
export const norikaeTitle = (g) => (devOf(g) === 'techo' ? '時刻表' : '乗換案内');

definePart('trip', (t, day) => ({
  trips: Math.max(0, Math.floor(num(t.trips))),
  fares: Math.max(0, Math.floor(num(t.fares))),
  minutes: Math.max(0, Math.floor(num(t.minutes))),
  recent: arr(t.recent).filter((x) => typeof x === 'string' && x.length < 40).slice(0, 6),
  byMode: isObj(t.byMode) ? Object.fromEntries(Object.entries(t.byMode).filter(([k]) => /^[a-z]{2,12}$/.test(k)).map(([k, v]) => [k, Math.max(0, Math.floor(num(v)))])) : {},
}));

// ---------------------------------------------------------------- the towns (as the マップ app; tiles ≈ 50 m)
const AREAS = {
  tokyo: { name: '東京', ox: 0, oy: 0, st: '東京' },
  machi: { name: '商店街', ox: -96, oy: 0, st: 'ドット商店街' },
  minato: { name: 'テレビ局', ox: 96, oy: 0, st: 'テレビ局前' },
  nagatacho: { name: '永田町', ox: 0, oy: -70, st: '永田町' },
  kanraku: { name: 'ネオン街', ox: 0, oy: 60, st: 'ネオン街' },
  namba: { name: 'なんば', ox: 0, oy: 0, osaka: true, st: 'なんば' },
};
const AREA_ORDER = ['tokyo', 'machi', 'minato', 'nagatacho', 'kanraku', 'namba'];
const HUB = 'tokyo';
const STATION = { kanto: 'station_tokyo', osaka: 'station_namba' };
const NO_TRIP = new Set(['jikka', 'keimusho']);
export const TRAIN_FARE = 180; // one line (internal = today's yen; each era shows its own price)
export const BUS_FARE = 210;
const areaOf = (id) => AREAS[id] || { name: placeLabel(id), ox: 0, oy: 0, st: placeLabel(id) };
const regionOf = (town) => (areaOf(town).osaka ? 'osaka' : 'kanto');

let BLD = null, BLD_N = 0;
function buildingOf(placeId, g) {
  const n = Object.keys(PLACES).length;
  if (!BLD || BLD_N !== n) {
    BLD = {};
    BLD_N = n;
    for (const p of Object.values(PLACES)) {
      if (!p || p.kind !== 'town' || !p.rooms) continue;
      for (const roomId of Object.keys(p.rooms)) {
        let room = null;
        try { room = buildRoom(p, roomId); } catch (e) { continue; }
        for (const e of (room && room.entities) || []) if (e && e.type === 'building' && e.place) (BLD[e.place] || (BLD[e.place] = [])).push({ e, town: p.id, room: roomId });
      }
    }
  }
  return (BLD[placeId] || []).find((b) => { try { return !b.e.cond || b.e.cond(g); } catch (err) { return false; } }) || null;
}
function destOf(g, id) {
  const P = PLACES[id];
  if (!P || NO_TRIP.has(id) || P.noTrip || (GUIDE[id] && GUIDE[id].secret)) return null;
  if (P.kind === 'town') {
    if (!P.start) return null;
    return { id, name: placeLabel(id), area: id, room: P.start.room, x: P.start.x, y: P.start.y, dir: P.start.dir || 'down', inside: false, town: true };
  }
  const b = buildingOf(id, g);
  if (!b) return null;
  const e = b.e;
  const dx = e.door ?? Math.floor(e.w / 2);
  return { id, name: placeLabel(id), area: b.town, room: b.room, x: e.x + dx, y: e.y + e.h, dir: 'up', inside: !e.enter && !!P.start, town: false };
}
function hereOf(g) {
  const m = g.map;
  if (!m || !m.place) return null;
  if (m.place.kind === 'town') return { id: m.placeId, name: placeLabel(m.placeId), area: m.placeId, x: m.player.x, y: m.player.y };
  const d = destOf(g, m.placeId);
  return d ? { id: m.placeId, name: d.name, area: d.area, x: d.x, y: d.y } : null;
}
const visitedOf = (g) => { const v = g.state.flags && g.state.flags.visited; return isObj(v) ? v : {}; };
export function destinations(g) {
  const ids = new Set(Object.keys(visitedOf(g)).filter((k) => visitedOf(g)[k]));
  try { ids.add(g.housing().place); } catch (e) { /* no housing */ }
  const list = [];
  for (const id of ids) { const d = destOf(g, id); if (d) list.push(d); }
  const key = (d) => [AREA_ORDER.includes(d.area) ? AREA_ORDER.indexOf(d.area) : 99, d.town ? 0 : 1, GUIDE_ORDER.includes(d.id) ? GUIDE_ORDER.indexOf(d.id) : 999];
  return list.sort((a, b) => { const A = key(a), B = key(b); return A[0] - B[0] || A[1] - B[1] || A[2] - B[2] || a.name.localeCompare(b.name, 'ja'); });
}
const tilesBetween = (a, b) => { const A = areaOf(a.area), B = areaOf(b.area); return Math.abs(A.ox + a.x - (B.ox + b.x)) + Math.abs(A.oy + a.y - (B.oy + b.y)); };
const townDist = (a, b) => { const A = areaOf(a), B = areaOf(b); return Math.abs(A.ox - B.ox) + Math.abs(A.oy - B.oy); };

// 東京–新大阪 fastest time (minutes) by the game year
export function shinkansenMin(year, month = 6) {
  const ym = year * 100 + month;
  if (ym >= 202003) return 141;
  if (ym >= 201503) return 142;
  if (ym >= 200707) return 145;
  if (ym >= 199203) return 150;
  return 176;
}
const shinName = (g) => (dateOf(g).year * 100 + dateOf(g).month >= 199203 ? 'のぞみ' : 'ひかり');
function transportStopped(g) {
  if (has(g, 'regimeTravelBlock')) { try { return !!g.regimeTravelBlock(); } catch (e) { console.error(e); } }
  const r = g.state && g.state.regime;
  return !!(r && typeof r === 'object' && num(r.cancelUntil) >= (g.state.day || 0) && r.disaster);
}

// ---------------------------------------------------------------- routes
// → [{ id, mode, label, steps: [{ how, from, to, min, note }], min, fare, stamina, hunger, transfers, why, tags }]
export function routesTo(g, from, d) {
  const out = [];
  const dv = devOf(g);
  const clk = clockNow(g);
  const w = weatherNow(g);
  const now = clk ? clk.min : null;
  const lateNight = now != null && (now >= 60 && now < 300); // 1:00–5:00: 終電後、始発前
  const nightFare = now != null && (now >= 1320 || now < 300); // 深夜割増 22:00–5:00
  const pickup = (dv === 'smart' ? 5 : dv === 'keitai' ? 8 : 4) + (w && (w.id === 'rain' || w.id === 'storm' || w.id === 'typhoon' || w.id === 'snow') ? 5 : 0);
  const taxiHow = dv === 'smart' ? '配車アプリで呼ぶ' : dv === 'keitai' ? 'ケータイでタクシー会社に電話' : '大通りで流しのタクシーを拾う';
  const ticket = dateOf(g).year * 100 + dateOf(g).month >= 200111 ? 'ICカード' : 'きっぷ';
  const trainDelay = !w ? 0 : w.id === 'snow' ? 15 : w.id === 'storm' ? 10 : w.id === 'rain' ? 2 : 0;
  const trainStop = (w && w.id === 'typhoon') ? '台風で運転見合わせ' : lateNight ? '終電が出たあと（始発は5時ごろ）' : null;
  const busStop = (w && (w.id === 'typhoon' || w.id === 'snow')) ? `${w.label}で運休` : now != null && (now >= 1380 || now < 360) ? '最終バスのあと（6時ごろから）' : null;
  const taxi = (t) => Math.round(taxiFare(t) * (nightFare ? 1.2 : 1) / 10) * 10;
  const A = areaOf(from.area), B = areaOf(d.area);
  const t = tilesBetween(from, d);
  if (regionOf(from.area) === regionOf(d.area)) {
    if (from.area === d.area) {
      const far = t > 40;
      out.push({ id: 'walk', mode: 'walk', label: '徒歩', steps: [{ how: '徒歩', from: from.name, to: d.name, min: Math.max(1, Math.round(t * 0.6)) }], fare: 0, stamina: far ? 4 : 2, hunger: far ? 3 : 1 });
    } else {
      const lines = from.area === HUB || d.area === HUB ? 1 : 2;
      const D = townDist(from.area, d.area);
      const ride = (dist) => Math.max(3, Math.round(dist * 0.06)) + 2 + trainDelay;
      const steps = [{ how: '徒歩', from: from.name, to: `${A.st}駅`, min: 4 }];
      if (lines === 1) steps.push({ how: '電車', from: `${A.st}駅`, to: `${B.st}駅`, min: ride(D), note: trainDelay ? `${w.label}で遅れ` : '' });
      else {
        steps.push({ how: '電車', from: `${A.st}駅`, to: '東京駅', min: ride(townDist(from.area, HUB)), note: '' });
        steps.push({ how: '乗換', from: '東京駅', to: '東京駅', min: 4, note: 'ホームを移動' });
        steps.push({ how: '電車', from: '東京駅', to: `${B.st}駅`, min: ride(townDist(HUB, d.area)), note: trainDelay ? `${w.label}で遅れ` : '' });
      }
      steps.push({ how: '徒歩', from: `${B.st}駅`, to: d.name, min: 4 });
      out.push({ id: 'train', mode: 'train', label: lines > 1 ? '電車（東京で乗換）' : '電車', steps, fare: TRAIN_FARE * lines, stamina: 1 + lines, hunger: 1, transfers: lines - 1, why: trainStop, note: ticket });
      const bsteps = [{ how: '徒歩', from: from.name, to: `${A.st}バス停`, min: 3 }];
      if (lines === 1) bsteps.push({ how: 'バス', from: `${A.st}`, to: `${B.st}`, min: 6 + Math.round(D * 0.14) + trainDelay });
      else {
        bsteps.push({ how: 'バス', from: A.st, to: '東京駅前', min: 6 + Math.round(townDist(from.area, HUB) * 0.14) + trainDelay });
        bsteps.push({ how: '乗換', from: '東京駅前', to: '東京駅前', min: 6, note: 'バス停を移動' });
        bsteps.push({ how: 'バス', from: '東京駅前', to: B.st, min: 6 + Math.round(townDist(HUB, d.area) * 0.14) + trainDelay });
      }
      bsteps.push({ how: '徒歩', from: `${B.st}バス停`, to: d.name, min: 3 });
      out.push({ id: 'bus', mode: 'bus', label: lines > 1 ? 'バス（東京駅前で乗換）' : 'バス', steps: bsteps, fare: BUS_FARE * lines, stamina: 3 * lines, hunger: 1, transfers: lines - 1, why: busStop });
    }
    out.push({ id: 'taxi', mode: 'taxi', label: 'タクシー', steps: [{ how: '待つ', from: from.name, to: from.name, min: pickup, note: taxiHow }, { how: 'タクシー', from: from.name, to: d.name, min: Math.max(2, Math.round(t * 0.09)), note: nightFare ? '深夜割増（2割増し）' : '' }], fare: taxi(t), stamina: 0, hunger: 0 });
  } else {
    // 東京 ⇄ なんば: to the station, the 新幹線, from the station
    const s1 = destOf(g, STATION[regionOf(from.area)]), s2 = destOf(g, STATION[regionOf(d.area)]);
    const shinFare = num(EXT.station && EXT.station.FARE, 3000);
    const year = dateOf(g).year, month = dateOf(g).month;
    const sm = shinkansenMin(year, month) + trainDelay * 2;
    const osakaFirst = regionOf(from.area) === 'osaka';
    const big = osakaFirst ? ['新大阪', '東京'] : ['東京', '新大阪'];
    const shinStop = (w && w.id === 'typhoon') ? '台風で運転見合わせ' : now != null && (now >= 1290 || now < 360) ? '新幹線の最終が出たあと（始発は6時ごろ）' : null;
    const legIn = s1 && s1.id !== from.id ? tilesBetween(from, s1) : 0, legOut = s2 && s2.id !== d.id ? tilesBetween(s2, d) : 0;
    const mk = (byTaxi) => {
      const steps = [];
      let fare = shinFare, stamina = byTaxi ? 3 : 6;
      if (legIn) { if (byTaxi) { steps.push({ how: 'タクシー', from: from.name, to: `${big[0]}駅`, min: pickup + Math.max(3, Math.round(legIn * 0.09)) }); fare += taxi(legIn); } else { steps.push({ how: '電車', from: from.name, to: `${big[0]}駅`, min: 12 }); fare += TRAIN_FARE; } }
      steps.push({ how: '新幹線', from: `${big[0]}駅`, to: `${big[1]}駅`, min: sm, note: `${shinName(g)}・指定席` });
      if (legOut || !osakaFirst) {
        const toName = d.name;
        if (byTaxi) { steps.push({ how: 'タクシー', from: `${big[1]}駅`, to: toName, min: 4 + Math.max(3, Math.round(Math.max(legOut, 10) * 0.09)) }); fare += taxi(Math.max(legOut, 10)); } else { steps.push({ how: osakaFirst ? '電車' : '地下鉄', from: `${big[1]}駅`, to: toName, min: 15 }); fare += TRAIN_FARE; }
      }
      return { id: byTaxi ? 'shin_taxi' : 'shin', mode: 'shinkansen', label: byTaxi ? '新幹線＋タクシー' : '新幹線', steps, fare, stamina, hunger: 3, transfers: steps.length - 1, why: shinStop };
    };
    out.push(mk(false), mk(true));
  }
  const stopped = transportStopped(g);
  for (const o of out) {
    o.min = o.steps.reduce((a, s) => a + s.min, 0);
    o.transfers = o.transfers || 0;
    if (!o.why && stopped && o.mode !== 'walk') o.why = '災害の影響で、交通機関が止まっている';
    if (!o.why && g.state.money < o.fare) o.why = 'お金が足りない…';
    if (!o.why && g.state.stamina < o.stamina) o.why = '体力が足りない…';
  }
  // tags: the fastest / cheapest / easiest of the routes that can be taken
  const ok = out.filter((o) => !o.why);
  const best = (f) => (ok.length > 1 ? ok.reduce((a, b) => (f(b) < f(a) ? b : a)) : null);
  const tag = (o, s) => { if (o) (o.tags || (o.tags = [])).push(s); };
  tag(best((o) => o.min), '早'); tag(best((o) => o.fare), '安'); tag(best((o) => o.stamina * 100 + o.min), '楽');
  return out.sort((a, b) => (a.why ? 1 : 0) - (b.why ? 1 : 0) || a.min - b.min);
}
function tripBlock(g) {
  const lb = lifeBlock(g);
  if (lb) return lb;
  if (!phoneOverMapOnly(g)) return '（いまは移動できない。用事がすんでからにしよう）';
  const P = g.map && g.map.place;
  if (P && (P.noTrip || P.noSave)) return '（ここからは移動できない）';
  return null;
}

// ---------------------------------------------------------------- the app
const MODE_COL = { walk: '#5a9a5a', train: '#2a7ab0', bus: '#d08a2a', taxi: '#c8a020', shinkansen: '#3a5ad0' };
const STEP_COL = { 徒歩: '#5a9a5a', 電車: '#2a7ab0', 地下鉄: '#7a4ab0', バス: '#d08a2a', タクシー: '#c8a020', 新幹線: '#3a5ad0', 乗換: '#8a8a96', 待つ: '#8a8a96' };
function drawTop(c, a, g, here) {
  const dv = devOf(g);
  const paper = dv === 'techo';
  R(c, a.x, a.y, a.w, a.h, paper ? '#f2ead0' : dv === 'keitai' ? '#dfe8f0' : '#eef5fb');
  if (paper) for (let y = a.y + 6; y < a.y + a.h; y += 8) R(c, a.x, y, a.w, 1, '#e6dcbc');
  // a strip of the line map: the towns as stations
  const ids = ['machi', 'tokyo', 'minato'];
  const y = a.y + 30;
  R(c, a.x + 16, y - 1, a.w - 32, 3, paper ? '#8a5a2a' : COLOR);
  ids.forEach((id, i) => {
    const x = a.x + 16 + Math.round(((a.w - 32) * i) / (ids.length - 1));
    const on = here && here.area === id;
    disc(c, x, y, on ? 5 : 4, paper ? '#8a5a2a' : '#1a4a70');
    disc(c, x, y, on ? 3 : 2, on ? '#ff5d6c' : '#ffffff');
    T(c, AREAS[id].name, x, y + 7, 12, PC.text, 'center');
  });
  T(c, fitText(c, `いま：${here ? here.name : '（ここからは出られない）'}`, a.w - 16, 12), a.x + 8, a.y + 4, 12, PC.text);
  const clk = clockNow(g), w = weatherNow(g);
  const right = [clk ? clk.label : null, w ? w.label : null].filter(Boolean).join('・');
  if (right) T(c, right, a.x + a.w - 8, a.y + 4, 12, PC.dim, 'right');
  R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
}
export async function norikaeApp(g, opts = {}) {
  const T3 = part(g, 'trip');
  let idx = 0;
  const rows = () => {
    const here = hereOf(g);
    const list = destinations(g).filter((d) => !here || d.id !== here.id);
    const recent = T3.recent.map((id) => list.find((d) => d.id === id)).filter(Boolean).slice(0, 3);
    const rest = list.filter((d) => !recent.includes(d));
    const mk = (d, star) => {
      let sub = areaOf(d.area).name;
      if (here) { const r = routesTo(g, here, d).find((o) => !o.why); if (r) sub += `・最短${hm(r.min)}（${r.label.replace(/（.*）/, '')}）`; else sub += '・いまは行けない'; }
      return { d, label: (star ? '★ ' : '') + d.name, sub, chip: [areaOf(d.area).name.slice(0, 3), shade(MODE_COL.train, d.area === 'namba' ? -0.3 : 0)] };
    };
    return [...recent.map((d) => mk(d, true)), ...rest.map((d) => mk(d, false))];
  };
  const pickDest = async (ph, it, v) => {
    const why = tripBlock(g);
    const here = hereOf(g);
    if (why || !here) { audio.sfx('buzz'); await phoneInfo(g, { title: norikaeTitle(g), color: COLOR, text: why || '（ここからは移動できない。まずは町に出よう）' }); return; }
    const went = await routesView(g, here, it.d);
    if (went) ph.back(-1);
  };
  if (opts.place) { const d = destOf(g, opts.place); const here = hereOf(g); if (d && here && !tripBlock(g)) return routesView(g, here, d); }
  return phoneView(g, panelView(g, {
    title: norikaeTitle(g), color: COLOR, top: 52, rowH: 38, index: idx,
    hint: 'A:経路をさがす　B:もどる',
    empty: 'まだどこにも行ったことがない。\n一度行った場所への経路が出る。',
    items: () => rows(),
    drawTop: (c, a) => drawTop(c, a, g, hereOf(g)),
    pick: (ph, it, i, v) => { idx = i; ph.run(v, () => pickDest(ph, it, v)); },
  }));
}

// the routes to one place → true when a trip was started
async function routesView(g, here, d) {
  let go = null;
  await phoneView(g, panelView(g, {
    title: d.name, color: COLOR, top: 30, rowH: 40,
    hint: 'A:くわしく　B:もどる',
    items: () => routesTo(g, here, d).map((o) => ({ o, label: o.label, sub: `${hm(o.min)}・${o.stamina ? `体力-${o.stamina}` : '体力そのまま'}${o.transfers ? `・乗換${o.transfers}回` : ''}${o.why ? `・${o.why}` : ''}`, right: o.fare ? fmtMoney(o.fare) : '無料', rightColor: o.why ? PC.bad : PC.text, disabled: !!o.why, why: o.why, subColor: o.why ? PC.bad : PC.dim })),
    drawRow(c, it, x, y, w, rh, sel) {
      const o = it.o;
      R(c, x + 6, y + 6, 4, rh - 12, it.disabled ? '#c8c0ac' : MODE_COL[o.mode] || COLOR);
      let tx = x + 16;
      for (const s of o.tags || []) tx += chip(c, s, tx, y + 4, s === '早' ? '#d6463a' : s === '安' ? '#2f9a4a' : '#3a7ac0') + 3;
      T(c, fitText(c, it.label, x + w - tx - 70, 14), tx + 2, y + 4, 14, it.disabled ? PC.dim : PC.text);
      T(c, it.right, x + w - 8, y + 5, 12, it.rightColor, 'right');
      T(c, fitText(c, it.sub, w - 24, 12), x + 16, y + 22, 12, it.subColor);
    },
    drawTop(c, a) {
      R(c, a.x, a.y, a.w, a.h, devOf(g) === 'techo' ? '#f2ead0' : '#eef5fb');
      T(c, fitText(c, `${here.name} → ${d.name}`, a.w - 16, 12), a.x + 8, a.y + 4, 12, PC.text);
      const clk = clockNow(g);
      if (clk) T(c, `${clk.label}発`, a.x + a.w - 8, a.y + 16, 12, PC.dim, 'right');
      R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
    },
    pick: (ph, it, i, v) => {
      ph.run(v, async () => {
        const ok = await routeDetail(g, here, d, it.o);
        if (ok) { go = it.o; ph.back(-1); }
      });
    },
  }));
  if (!go) return false;
  const why = tripBlock(g);
  if (why) { await phoneInfo(g, { title: norikaeTitle(g), color: COLOR, text: why }); return false; }
  closePhoneThen(g, (gg) => doRoute(gg, here, d, go));
  return true;
}
// the steps of a route, with the times; A = この経路で行く → true
function routeDetail(g, here, d, o) {
  const clk = clockNow(g);
  return phoneView(g, {
    title: o.label, color: COLOR, cancel: false, sel: 0, sy: 0,
    hint: 'A:この経路で行く　B:もどる',
    update(ph, inp) {
      if (inp.repeat('down')) this.sy = Math.min(this.maxSy || 0, this.sy + 16);
      if (inp.repeat('up')) this.sy = Math.max(0, this.sy - 16);
      if (inp.pressed('a')) { if (o.why) { audio.sfx('buzz'); ph.toast(o.why, '#9aa3c7'); return; } audio.sfx('ok'); ph.back(true); return; }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(false); }
    },
    tap(ph, x, y) { if (hit(this.btn, x, y)) return true; return false; },
    draw(c, ph, a) {
      R(c, a.x, a.y, a.w, a.h, devOf(g) === 'techo' ? '#f6f0dc' : '#f7fafc');
      // summary
      box(c, a.x + 6, a.y + 4, a.w - 12, 40, 5, '#ffffff', '#c8c0ac');
      T(c, `${hm(o.min)}`, a.x + 14, a.y + 8, 14, MODE_COL[o.mode] || COLOR);
      T(c, o.fare ? fmtMoney(o.fare) : '無料', a.x + a.w - 14, a.y + 8, 14, PC.text, 'right');
      const bits = [o.stamina ? `体力-${o.stamina}` : '体力そのまま', o.transfers ? `乗換${o.transfers}回` : '乗換なし', o.note || null].filter(Boolean).join('・');
      T(c, fitText(c, bits, a.w - 28, 12), a.x + 14, a.y + 26, 12, PC.dim);
      // the steps
      const top = a.y + 50, bottom = a.y + a.h - 36;
      c.save(); c.beginPath(); c.rect(a.x, top, a.w, bottom - top); c.clip();
      let y = top + 4 - this.sy;
      let t = clk ? clk.min : null;
      const line = (yy, label, col) => {
        disc(c, a.x + 22, yy + 7, 5, col); disc(c, a.x + 22, yy + 7, 3, '#ffffff');
        T(c, fitText(c, label, a.w - 90, 12), a.x + 34, yy + 1, 12, PC.text);
      };
      line(y, o.steps[0].from, '#3a3a4a');
      if (t != null) T(c, clockLabel(t), a.x + a.w - 10, y + 1, 12, PC.dim, 'right');
      y += 18;
      for (const s of o.steps) {
        const col = STEP_COL[s.how] || COLOR;
        R(c, a.x + 20, y - 4, 4, 30, col);
        T(c, fitText(c, `${s.how}　${hm(s.min)}${s.note ? `・${s.note}` : ''}`, a.w - 50, 12), a.x + 32, y + 5, 12, shade(col, -0.25));
        y += 28;
        if (t != null) t += s.min;
        if (s.how !== '乗換' && s.how !== '待つ') { line(y, s.to, s === o.steps[o.steps.length - 1] ? '#d6463a' : '#3a3a4a'); if (t != null) T(c, clockLabel(t), a.x + a.w - 10, y + 1, 12, PC.dim, 'right'); y += 18; }
      }
      c.restore();
      this.maxSy = Math.max(0, y + this.sy - bottom + 4);
      const r = buttons(c, a, [o.why ? o.why : 'この経路で行く'], 0, o.why ? '#a8a8b0' : COLOR);
      this.btn = r[0];
    },
  });
}

// ---------------------------------------------------------------- the trip
async function doRoute(g, from, d, o) {
  const st = g.state;
  if (st.money < o.fare || st.stamina < o.stamina) { await g.say('（お金か体力が、足りなくなっていた…）'); return; }
  if (o.fare) { g.spend(o.fare); audio.sfx('coin'); }
  if (o.stamina) g.useStamina(o.stamina);
  if (o.hunger) g.addNeed('hunger', -o.hunger);
  const S = safe(() => appState(g), null);
  if (S) { S.stats.trips++; S.stats.fares += o.fare; }
  const T3 = part(g, 'trip');
  T3.trips++; T3.fares += o.fare; T3.minutes += o.min;
  T3.byMode[o.mode] = num(T3.byMode[o.mode]) + 1;
  T3.recent = [d.id, ...T3.recent.filter((x) => x !== d.id)].slice(0, 6);
  passMinutes(g, o.min);
  await g.fadeOut(12);
  const via = o.steps.map((s) => s.how).filter((h) => h !== '待つ').join(' → ');
  let ride = null;
  const m = EXT.station;
  if ((o.mode === 'shinkansen' || o.mode === 'train') && m && typeof m.travelScene === 'function') {
    ride = safe(() => m.travelScene(g, { to: d.name, via, vehicle: o.mode === 'train' ? 'local' : 'shinkansen', scenery: o.mode === 'train' ? 'city' : 'fuji' }), null);
  }
  if (!ride) ride = rideScene(g, { mode: o.mode, to: d.name, via });
  await g.fadeIn(10);
  await ride;
  await g.fadeOut(10);
  const P = PLACES[d.id];
  if (d.inside && P && P.start) await g.goto(d.id, P.start.room, P.start.x, P.start.y, P.start.dir || 'up');
  else await g.goto(d.area, d.room, d.x, d.y, d.dir);
  g.notify(`${d.name}に着いた（${o.label.replace(/（.*）/, '')} ${hm(o.min)}${o.fare ? '・' + fmtMoney(o.fare) : ''}）`, { color: '#ffffff' });
  g.save(true);
}
// A short HD ride (640x360): the street going by and the vehicle (bus, taxi, train, walking).
function rideScene(g, o) {
  return new Promise((resolve) => {
    const dur = o.mode === 'walk' ? 100 : 150;
    const night = (() => { const k = clockNow(g); return k ? (k.min >= 1140 || k.min < 300) : false; })();
    const sc = {
      hd: true, opaque: true, hidesHud: true, t: 0,
      update(gg) {
        sc.t++;
        if (sc.t === 1) audio.sfx(o.mode === 'walk' ? 'cursor' : o.mode === 'bus' ? 'chime' : 'door');
        const done = gg.auto ? sc.t > 3 : sc.t > dur || (sc.t > 30 && gg.input.pressed('a'));
        if (done) { gg.pop(sc); resolve(); }
      },
      draw(c) { try { drawRide(c, sc.t, o, night); } catch (e) { console.error(e); } },
    };
    g.push(sc);
  });
}
const wrapX = (x, span) => ((x % span) + span) % span;
function drawRide(c, t, o, night) {
  const sky = night ? ['#141a3a', '#232a54'] : ['#6cb8ec', '#a8dcf8'];
  for (let y = 0; y < 230; y += 10) R(c, 0, y, SW, 10, mix(sky[0], sky[1], y / 230));
  if (night) for (let i = 0; i < 30; i++) R(c, (i * 113) % SW, (i * 37) % 120, 2, 2, '#e8e8ff');
  // buildings (two layers)
  for (let layer = 0; layer < 2; layer++) {
    const sp = layer ? 3 : 1.4, base = layer ? 236 : 220, col = night ? (layer ? '#2a2f50' : '#1e2340') : (layer ? '#8a9ab8' : '#a8b8d0');
    for (let i = 0; i < 12; i++) {
      const w = 40 + ((i * 37) % 30), h = 50 + ((i * 53 + layer * 17) % 90);
      const x = wrapX(i * 70 - t * sp, SW + 100) - 60;
      R(c, x, base - h, w, h, col);
      for (let wy = base - h + 8; wy < base - 8; wy += 12) for (let wx = x + 6; wx < x + w - 6; wx += 10) R(c, wx, wy, 5, 6, night ? ((wx + wy) % 3 ? '#f0d878' : '#3a3f60') : shade(col, 0.25));
    }
  }
  // the road
  R(c, 0, 236, SW, 124, night ? '#2a2a34' : '#6a6e78');
  R(c, 0, 236, SW, 4, night ? '#4a4a58' : '#a0a4ae');
  for (let i = 0; i < 9; i++) R(c, wrapX(i * 90 - t * 6, SW + 90) - 45, 300, 46, 4, '#e8e4d0');
  const bob = Math.round(Math.sin(t / 4));
  if (o.mode === 'bus') {
    const x = 200, y = 214 + bob;
    rrect(c, x, y, 230, 70, 8, '#20232a'); rrect(c, x + 2, y + 2, 226, 66, 7, '#e8eef4');
    R(c, x + 2, y + 46, 226, 8, '#2f9a4a');
    for (let k = 0; k < 6; k++) R(c, x + 14 + k * 34, y + 10, 26, 24, night ? '#f0d878' : '#3b4a6a');
    R(c, x + 196, y + 10, 26, 40, '#9aa0aa');
    disc(c, x + 46, y + 70, 12, '#20232a'); disc(c, x + 186, y + 70, 12, '#20232a'); disc(c, x + 46, y + 70, 5, '#8a8f99'); disc(c, x + 186, y + 70, 5, '#8a8f99');
  } else if (o.mode === 'shinkansen' || o.mode === 'train') {
    const y = 226 + bob, sh = o.mode === 'shinkansen';
    for (let k = 0; k < 3; k++) {
      const x = 40 + k * 190;
      R(c, x, y, 184, 50, sh ? '#f4f6fa' : '#d8dce4'); R(c, x, y, 184, 3, '#ffffff');
      R(c, x, y + 32, 184, 6, sh ? '#2f5fd0' : '#3fa86a');
      for (let wx = x + 10; wx < x + 170; wx += 24) R(c, wx, y + 9, 16, 14, night ? '#f0d878' : '#3b4a6a');
    }
    R(c, 0, y + 52, SW, 6, '#5a5f6b');
  } else if (o.mode === 'taxi') {
    const x = 240, y = 238 + bob;
    rrect(c, x, y, 160, 44, 8, '#20232a'); rrect(c, x + 2, y + 2, 156, 40, 7, '#f0c020');
    rrect(c, x + 30, y - 22, 96, 28, 6, '#20232a'); rrect(c, x + 32, y - 20, 92, 26, 5, '#f0c020');
    R(c, x + 38, y - 16, 36, 18, night ? '#2a3050' : '#9ac8e8'); R(c, x + 80, y - 16, 38, 18, night ? '#2a3050' : '#9ac8e8');
    R(c, x + 66, y - 30, 26, 9, '#20232a'); R(c, x + 68, y - 28, 22, 5, '#ff8a3d');
    disc(c, x + 34, y + 44, 11, '#20232a'); disc(c, x + 126, y + 44, 11, '#20232a'); disc(c, x + 34, y + 44, 4, '#8a8f99'); disc(c, x + 126, y + 44, 4, '#8a8f99');
    if (night) { R(c, x + 154, y + 12, 6, 6, '#fff6a8'); for (let k = 0; k < 6; k++) R(c, x + 160 + k * 6, y + 10 + k, 6, 10 - k * 2, 'rgba(255,246,168,0.3)'); }
  } else {
    // walking: a small figure and its shadow
    const x = 300, y = 250, step = Math.floor(t / 8) % 2;
    R(c, x - 10, y + 44, 30, 4, 'rgba(0,0,0,0.25)');
    disc(c, x + 5, y + 4, 8, '#f2c8a0'); R(c, x - 3, y - 4, 16, 6, '#3a2a20');
    R(c, x - 4, y + 12, 18, 18, '#3a7ac0');
    R(c, x - 2 + (step ? 4 : -2), y + 30, 6, 14, '#3b3f48'); R(c, x + 8 + (step ? -4 : 2), y + 30, 6, 14, '#3b3f48');
  }
  R(c, 0, 0, SW, 52, 'rgba(10,14,34,0.55)');
  text(c, `${o.to || ''} へ移動中…`, SW / 2, 8, { size: 20, align: 'center', color: '#fff', outline: '#20232a' });
  if (o.via) text(c, o.via, SW / 2, 32, { size: 12, align: 'center', color: '#fff6a8', outline: '#20232a' });
  if (t > 30) text(c, 'A：とばす', SW - 12, SH - 22, { size: 12, align: 'right', color: '#ffffff', outline: '#20232a' });
}

// for other modules / tests
export { hereOf, destOf };
