// 環境音 (R15): the ambient layers under the BGM, chosen from where the player is, the weather and the time of day.
//   a station (駅・電車の街): platform rumble and the chime · a town street (街): the crowd's hum · at night in the towns: crickets / a low hum
//   rain (雨・台風): rain on top of whatever the place sounds like. Indoors: silence (the BGM is enough).
// startAmbience(g) polls every half second (cheap: it compares strings and only changes the layers when the place, weather or night changes),
// and reports every new place to the 図鑑 (zukan.js visit). 設定 → 環境音 turns the layers off (localStorage 'dotgeinou_ambient'; kept in the save too).
import { audio } from './audio.js';
import { visit } from './zukan.js';

const LS = 'dotgeinou_ambient';
const TOWNS = ['tokyo', 'machi', 'minato', 'nagatacho', 'kanraku', 'namba'];
let memOn = null;

export function ambientOn() {
  try { const v = localStorage.getItem(LS); if (v === '0') return false; if (v === '1') return true; } catch (e) { /* blocked */ }
  return memOn !== false;
}
export function setAmbientOn(on) {
  memOn = !!on;
  try { localStorage.setItem(LS, on ? '1' : '0'); } catch (e) { /* blocked: this session only */ }
  if (!on) audio.setAmbient([]);
}

// the layers for the current moment (pure: the test uses it)
export function layersFor(placeId, rain, min) {
  const L = [];
  const id = String(placeId || '');
  const night = min != null && (min >= 1080 || min < 300);
  if (/eki|station/i.test(id)) L.push('station');
  else if (TOWNS.includes(id)) L.push(night ? 'night' : 'town');
  if (rain && L.length) L.push('rain'); // the rain is heard outdoors only
  return L;
}

export function startAmbience(g) {
  let last = '';
  const tick = () => {
    try {
      if (!g || !g.state || !g.map) return;
      const pid = g.map.placeId;
      if (pid) visit(g, pid);
      const wx = g.weather ? g.weather() : null;
      const rain = !!wx && (wx.kind === 'rain' || wx.kind === 'typhoon');
      const c = g.clock ? g.clock() : null;
      const key = `${pid}|${rain}|${c && c.min != null ? (c.min >= 1080 || c.min < 300 ? 'n' : 'd') : 'd'}|${ambientOn()}`;
      if (key === last) return;
      last = key;
      audio.setAmbient(ambientOn() ? layersFor(pid, rain, c ? c.min : null) : []);
    } catch (e) { /* the watcher never breaks the game */ }
  };
  tick();
  return setInterval(tick, 500);
}
