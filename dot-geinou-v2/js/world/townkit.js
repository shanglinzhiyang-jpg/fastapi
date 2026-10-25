// Helpers for building town maps procedurally (used by room.generate()).

import { TILE } from '../engine/util.js';
import { PLACES } from '../engine/map.js';

export function grid(w, h, base) {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => [base]));
}

export function set(cells, x, y, ...layers) {
  if (y < 0 || y >= cells.length || x < 0 || x >= cells[0].length) return;
  cells[y][x] = layers.flat();
}

// Put an object tile on top of whatever ground is already there.
export function put(cells, x, y, obj) {
  if (y < 0 || y >= cells.length || x < 0 || x >= cells[0].length) return;
  cells[y][x] = [cells[y][x][0], obj];
}

export function fill(cells, x, y, w, h, ...layers) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(cells, xx, yy, ...layers);
}

const ROADS = new Set(['road', 'road_line_h', 'road_line_v', 'crosswalk_h', 'crosswalk_v']);
const isRoad = (cells, x, y) => ROADS.has(cells[y]?.[x]?.[0]);

// 3-tile wide horizontal road with dashed centre line + sidewalks above/below.
export function hroad(cells, y, x0, x1) {
  for (let x = x0; x <= x1; x++) {
    set(cells, x, y - 1, 'sidewalk');
    set(cells, x, y, 'road');
    set(cells, x, y + 1, x % 2 ? 'road_line_h' : 'road');
    set(cells, x, y + 2, 'road');
    set(cells, x, y + 3, 'sidewalk');
  }
}

export function vroad(cells, x, y0, y1) {
  for (let y = y0; y <= y1; y++) {
    const crossing = isRoad(cells, x, y);
    if (!crossing) {
      set(cells, x - 1, y, 'sidewalk');
      set(cells, x + 3, y, 'sidewalk');
    }
    set(cells, x, y, 'road');
    set(cells, x + 1, y, crossing ? 'road' : y % 2 ? 'road_line_v' : 'road');
    set(cells, x + 2, y, 'road');
  }
}

export function border(cells, obj = 'tree') {
  const h = cells.length, w = cells[0].length;
  for (let x = 0; x < w; x++) { cells[0][x] = ['grass', obj]; cells[h - 1][x] = ['grass', obj]; }
  for (let y = 0; y < h; y++) { cells[y][0] = ['grass', obj]; cells[y][w - 1] = ['grass', obj]; }
}

// A town's onEnter calls this: when the player stands on a blocked tile (a save made
// before the map changed, on a spot a later building, fence or tree now covers), step
// them to the nearest free tile that is still connected to the town's start, so they
// never land inside a wall or in a closed-off pocket. Returns true when they moved.
export function unstick(g) {
  const m = g && g.map, p = m && m.player, room = m && m.room;
  if (!p || !room || typeof m.blocked !== 'function') return false;
  const W = room.w, H = room.h;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  if (inside(p.x, p.y) && !m.blocked(p.x, p.y)) return false;
  const key = (x, y) => y * W + x;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // every free tile a walker reaches from the start (the town's main walkable area)
  const st = (m.place && m.place.start) || {};
  const ok = new Set();
  if (inside(st.x, st.y) && !m.blocked(st.x, st.y)) {
    const q = [[st.x, st.y]];
    ok.add(key(st.x, st.y));
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny) || ok.has(key(nx, ny)) || m.blocked(nx, ny)) continue;
        ok.add(key(nx, ny));
        q.push([nx, ny]);
      }
    }
  }
  const good = (x, y) => (ok.size ? ok.has(key(x, y)) : !m.blocked(x, y)) && !(typeof m.warpAt === 'function' && m.warpAt(x, y));
  // the nearest such tile, searching outward through anything
  const sx = Math.max(0, Math.min(W - 1, Math.round(p.x) || 0)), sy = Math.max(0, Math.min(H - 1, Math.round(p.y) || 0));
  const seen = new Set([key(sx, sy)]);
  const q = [[sx, sy]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    if (good(x, y)) {
      Object.assign(p, { x, y, px: x * TILE, py: y * TILE, tx: x, ty: y, moving: false });
      if (typeof m.updateCamera === 'function') m.updateCamera(true);
      return true;
    }
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      q.push([nx, ny]);
    }
  }
  return false;
}

// ---------------------------------------------------------------- [R9-A] station entrances
// Every town has one station entrance (a 駅 building or a 地下鉄の出入口) and exports
// `EKI = { x, y, dir }`: the tile in front of it, where a player arriving by train appears.
// The entrance leads to the rail network's 駅構内 (place 'eki', one room per town id, R9-B1)
// when that exists; before that, `fallback` (東京駅 / なんば駅: their own station places) or a
// short 「工事中」 line.
export function ekiReady(town) {
  const P = PLACES.eki;
  return !!(P && P.rooms && P.rooms[town]);
}
export async function enterEki(g, town, fallback) {
  if (ekiReady(town)) { await g.goto('eki', town, undefined, undefined, 'up'); return true; }
  if (fallback) { await fallback(g); return true; }
  g.sfx('cursor');
  await g.say(['駅の入口だ。', '「ただいま改良工事中です。\n　ご不便をおかけしております」\n…まだ電車には乗れないみたいだ。']);
  return false;
}
// a building's enter(g) (its door leads into the station); without a station yet, step back out of the door
export const ekiEnter = (town, fallback) => async (g) => {
  if (!(await enterEki(g, town, fallback)) && typeof g.movePlayer === 'function') await g.movePlayer(['down']);
};
// The stairs of a 地下鉄の出入口 (props.js subwayEntrance): warps into the station; while there is
// no station yet the check says so and the map walks the player back out.
export function ekiStairs(xs, y, town) {
  return xs.map((x) => ({
    x, y, place: 'eki', room: town, dir: 'up',
    check: async (g) => {
      if (ekiReady(town)) return true;
      await enterEki(g, town);
      const p = g.map && g.map.player;
      if (p) p.dir = 'up'; // the map walks the player back the opposite way: down, out of the stairs
      return false;
    },
  }));
}
