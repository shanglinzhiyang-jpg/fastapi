// Helpers for building town maps procedurally (used by room.generate()).

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
