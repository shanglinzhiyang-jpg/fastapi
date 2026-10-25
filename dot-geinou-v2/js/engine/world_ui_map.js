// 世界情勢の地図 (R9-E): the pixel world map of world_ui.js, now with views (世界 / 東アジア / 東南アジア / 中東 / 欧州 / 選んだ国
// を中心に), status icons by every capital (同盟・制裁・戦争・危機), country labels in the zoomed views, region names, the
// selected country's tooltip, crises (blinking triangles), conflicts (dotted lines), disputes and Japan's enemy.
// The map data: Natural Earth 1:50m (public domain; world-atlas 2.0.2, ISC) rasterised offline to 144 × 53 cells of 2.5°
// (lon −25 → 335, Pacific-centred as Japanese maps are; lat 75 → −57.5), RLE-encoded. Codes: '.' sea, 'x' other land.
import { clamp, makeCanvas } from './util.js';
import { measure } from './draw.js';
import { K, R, T, num, icon, relColor } from './world_uikit.js';

export const MAP = { COLS: 144, ROWS: 53, LON0: -25, LAT0: 75, STEP: 2.5, CELL: 4, X: 32, Y: 42 };
export const LEGEND = { '.': '.', x: 'x', A: 'sv', B: 'au', C: 'br', D: 'ca', E: 'cn', F: 'tw', G: 'fr', H: 'de', I: 'in', J: 'id', K: 'ir', L: 'iq', M: 'il', N: 'it', O: 'jp', P: 'kp', Q: 'kr', R: 'my', S: 'ph', T: 'ru', U: 'sa', V: 'sg', W: 'vn', X: 'th', Y: 'tr', Z: 'ua', a: 'gb', b: 'us', c: 'dd' };
const MAP_DATA = 'xx.29T03.04T.03T20.04T.37D06.D.DD.D07.08x13x.18x.x.09TT.04T37.16b04.10D09.D03.D08.06x12T17x05TT..T04.04TT.T45.T05b10T04DT06DDTDT07DT03DDT08x09TT16x03T03.T05.10T.43T.T04b10T46.x03.09x09T60.06b10D24.D.D03.05x05.06.12x05.x04T58.07b11D19.06D03.08x03.07.08a.03x06.AAT48.TT.T03.13b04.05bbD17.06D06.15.07aa.04x04.A04T44.06T03.14bb.09bD19.03D07.14.06xxaa..xHHcx03A04T12A06T26.05TT.27D20.D10.12.06x.a03xxHHcx04Z04T06AT03A08T07xxT07E03T07.04T.30D29.12.08G05HHx04Z07T03A16x12E05T06.36D25.D03.11.09G04xNx06AZ03T05A13E03x11E07T.39b16D06bD03.14.07xxG04N03x06.03T04.A12E06x07E08T..OO.36b17DDb04DD.15.06x05..G.NNx04Y06A03.A10E20P.04O.37b22.18.06x04.05NN.xxY08KK.A09E18..PQ.04O.37b20.20.07xx.x05.06Y03x03LK06AAx04E19.QQ.O04.38b19.20.07x08.09xxLLK06x06IIE16.04O03.41b17.21.06x11.x07UULLK05x06IIE17.48x05b10.22.05x19U06K05x04I03xxE15.49x06bb.b.03b.22.04x20U06.K04x03I07xIIxE09.50x07.06b.22.03x21.U06x03.03xI07xxIxE08.F.50x.x04.06x.22.03x22U07xx.04I08.x04WWEE.56x04.03x.03xx.20.03x22.U04x03.06I05.03xxxWE.04S.53x07.05xx.18.03x23.x05.07I04.05xX03x.05S.55x06.24.03x27.10II.07xxW.04S.58x04.23.04x27.09II.07X.xWW.05S.59xx.03x05.15.04x26.10IIx.06X..W.06SS.59x10.14.05x25.12x.07R.05RR..S.62x09G.11.13x16.19JJRR.03RJ.66x06CxxGC.10.14x14.21JJR.J06.63x04CxC06.10.13x14.23JJ..J03.J.03JJ.J.55x05C10.08.14x12.25JJ.J05.04J04x.53x05C13.05.15x11.26J03.10Jx03.52x04C15.04.15x11.28JJ.03Jx.05x04.52x03C15.04.15x12.36B.59x05C11.05.15x12..x.30B.B03.BB.55x06C10.05.14x12..xx.29B10.55x06C09.05.15x10..x03.28B11.57x05C07.06.15x09.03x03.26B14.06x.49x05C07.06.16x08.03xx.26B16.54x07C05.07.16x07.32B17.53x07C03.09.16x07.33B16.53x07C03.09.17x05.34B15.54x07CC.10.17x04.35B04.04B07.54x08.11.65B05.09x.45x06.13.67BB.10x03.42x07.13.68B.09x03.43x05.15.68B.08xx.45x04.16.77x.46x04.16.99.25x03.17.99.25x03.03x.13.99.25x04.16.99.45';
let GRID = null;
export function grid() {
  if (GRID) return GRID;
  const out = [];
  const s = MAP_DATA;
  for (let i = 0; i < s.length;) {
    const ch = s[i++];
    let n = 1;
    if (/[0-9]/.test(s[i] || '') && /[0-9]/.test(s[i + 1] || '')) { n = Number(s.slice(i, i + 2)); i += 2; }
    const code = LEGEND[ch] || '.';
    for (let k = 0; k < n; k++) out.push(code);
  }
  GRID = out;
  return GRID;
}
// the country a cell stands for at the game's date (ソ連 before 1991-12-26, 東西ドイツ before 1990-10-03)
export function cellCountry(code, dn) {
  if (code === 'ru' || code === 'ua' || code === 'sv') return dn < 19911226 ? 'su' : code === 'sv' ? 'x' : code;
  if (code === 'de') return dn < 19901003 ? 'wde' : 'de';
  if (code === 'dd') return dn < 19901003 ? 'dde' : 'de';
  return code;
}
// lat/lon → the point on the default (whole-world) map at MAP.X / MAP.Y (kept for the old API: window.__worldui.project)
export function project(lat, lon) {
  const b = baked(lat, lon);
  return { x: MAP.X + b.x, y: MAP.Y + b.y };
}
// lat/lon → pixels of the baked map (CELL px per cell)
export function baked(lat, lon) {
  let L = lon;
  if (L < MAP.LON0) L += 360;
  return { x: ((L - MAP.LON0) / MAP.STEP) * MAP.CELL, y: ((MAP.LAT0 - lat) / MAP.STEP) * MAP.CELL };
}
export const MODES = [{ id: 'relation', label: '関係' }, { id: 'bloc', label: '陣営' }, { id: 'alliance', label: '同盟' }];
// the views: a centre (lat, lon) and a zoom (× the baked map); 'world' fits the whole map; 'sel' follows the selection
export const VIEWS = [
  { id: 'world', label: '世界' },
  { id: 'ea', label: '東アジア', lat: 36, lon: 128, z: 3 },
  { id: 'sea', label: '東南アジア', lat: 4, lon: 118, z: 2.4 },
  { id: 'me', label: '中東', lat: 31, lon: 48, z: 3 },
  { id: 'eu', label: '欧州', lat: 50, lon: 18, z: 3 },
];
export const REGION_LABELS = [
  { t: '東アジア', lat: 47, lon: 108 }, { t: '東南アジア', lat: -1, lon: 100 }, { t: '中東', lat: 24, lon: 42 }, { t: '欧州', lat: 55, lon: 24 },
  { t: '北米', lat: 50, lon: -105 }, { t: '南米', lat: -24, lon: -62 }, { t: 'アフリカ', lat: 4, lon: 20 }, { t: 'オセアニア', lat: -30, lon: 128 }, { t: '太平洋', lat: 12, lon: 178 },
];
function cellColor(ui, id) {
  const d = ui.data;
  if (id === '.') return null;
  if (id === 'x') return K.land;
  if (id === 'jp') return '#f0f0f6';
  const row = d.rows[id];
  if (!row) return K.land;
  if (row.war) return Math.floor(ui.t / 20) % 2 ? '#ff3848' : '#a82030';
  if (ui.mode === 'bloc') return (d.w.blocs[row.bloc] || {}).color || K.land;
  if (ui.mode === 'alliance') return row.ally ? '#4f8fe8' : row.sanction ? '#c07040' : row.onJapan ? '#a05050' : '#5a6270';
  return relColor(row.relation);
}
export function bakeMap(ui) {
  const [cv, c] = makeCanvas(MAP.COLS * MAP.CELL, MAP.ROWS * MAP.CELL);
  c.fillStyle = K.sea; c.fillRect(0, 0, cv.width, cv.height);
  for (let y = 0; y < cv.height; y += 16) { c.fillStyle = K.sea2; c.fillRect(0, y, cv.width, 1); }
  for (let x = 0; x < cv.width; x += 16) { c.fillStyle = K.sea2; c.fillRect(x, 0, 1, cv.height); }
  const G0 = grid();
  const dn = ui.data.dn;
  for (let r = 0; r < MAP.ROWS; r++) for (let q = 0; q < MAP.COLS; q++) {
    const code = G0[r * MAP.COLS + q];
    if (!code || code === '.') continue;
    const col = cellColor(ui, cellCountry(code, dn));
    if (!col) continue;
    c.fillStyle = col;
    c.fillRect(q * MAP.CELL, r * MAP.CELL, MAP.CELL, MAP.CELL);
  }
  // country borders: a darker pixel where the country changes (both directions)
  c.fillStyle = 'rgba(0,0,0,0.35)';
  for (let r = 0; r < MAP.ROWS; r++) for (let q = 0; q < MAP.COLS; q++) {
    const a = cellCountry(G0[r * MAP.COLS + q], dn);
    if (a === '.') continue;
    if (q < MAP.COLS - 1) { const b = cellCountry(G0[r * MAP.COLS + q + 1], dn); if (a !== b && b !== '.') c.fillRect((q + 1) * MAP.CELL - 1, r * MAP.CELL, 1, MAP.CELL); }
    if (r < MAP.ROWS - 1) { const b = cellCountry(G0[(r + 1) * MAP.COLS + q], dn); if (a !== b && b !== '.') c.fillRect(q * MAP.CELL, (r + 1) * MAP.CELL - 1, MAP.CELL, 1); }
  }
  return cv;
}
// the source window of a view into the baked map for a destination rect: { sx, sy, z }
export function viewWindow(view, dest, selPos) {
  const BW = MAP.COLS * MAP.CELL, BH = MAP.ROWS * MAP.CELL;
  const V = typeof view === 'string' ? VIEWS.find((v) => v.id === view) || VIEWS[0] : view;
  let z, cx, cy;
  if (!V || V.id === 'world' || (V.id === 'sel' && !selPos)) { z = Math.min(dest.w / BW, dest.h / BH); cx = BW / 2; cy = BH / 2; }
  else { z = V.z || 2.6; const p = V.id === 'sel' ? baked(selPos[0], selPos[1]) : baked(V.lat, V.lon); cx = p.x; cy = p.y; }
  const sw = dest.w / z, sh = dest.h / z;
  const sx = sw >= BW ? (BW - sw) / 2 : clamp(cx - sw / 2, 0, BW - sw);
  const sy = sh >= BH ? (BH - sh) / 2 : clamp(cy - sh / 2, 0, BH - sh);
  return { sx, sy, z, sw, sh };
}
export function dotLine(c, a, b, col) { const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4)); for (let i = 0; i <= n; i++) R(c, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 2, 2, col); }
export function ring(c, x, y, r, col) { for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; R(c, x + Math.cos(a) * r, y + Math.sin(a) * r, 1, 1, col); } }
function tri(c, x, y, col) { R(c, x + 3, y, 1, 1, col); R(c, x + 2, y + 1, 3, 1, col); R(c, x + 1, y + 2, 5, 1, col); R(c, x, y + 3, 7, 1, col); R(c, x + 3, y + 1, 1, 2, '#1a1206'); }
// Draw the map into dest with a view. Returns the visible markers [{ id, x, y }] (screen coords) for taps / the cursor.
// opts: { labels (country names), regions (region names), icons (status icons), inset (the fictional nations box), tooltip }
export function drawMapView(ui, c, dest, view, opts = {}) {
  const d = ui.data;
  if (!ui.mapCv || ui.mapKey !== ui.mapStamp()) { ui.mapCv = bakeMap(ui); ui.mapKey = ui.mapStamp(); }
  const selRow = ui.sel && d.rows[ui.sel];
  const win = viewWindow(view, dest, selRow && selRow.pos);
  const S = (lat, lon) => { const b = baked(lat, lon); return { x: dest.x + (b.x - win.sx) * win.z, y: dest.y + (b.y - win.sy) * win.z }; };
  const inside = (p, m = 0) => p.x >= dest.x - m && p.x < dest.x + dest.w + m && p.y >= dest.y - m && p.y < dest.y + dest.h + m;
  c.save();
  c.beginPath(); c.rect(dest.x, dest.y, dest.w, dest.h); c.clip();
  R(c, dest.x, dest.y, dest.w, dest.h, K.sea);
  const smooth = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(ui.mapCv, win.sx, win.sy, win.sw, win.sh, dest.x, dest.y, dest.w, dest.h);
  c.imageSmoothingEnabled = smooth;
  const big = win.z >= 1.8;
  // region names (faint)
  if (opts.regions) for (const L of REGION_LABELS) { const p = S(L.lat, L.lon); if (inside(p, -10)) T(c, L.t, p.x, p.y - 6, big ? 12 : 10, 'rgba(200,220,240,0.42)', 'center'); }
  // territorial disputes (small diamonds)
  for (const D of d.w.disputes) { const p = S(D.pos[0], D.pos[1]); if (!inside(p)) continue; const s = big ? 2 : 1; R(c, p.x - s, p.y - 3 * s, 2 * s, 6 * s, K.warn); R(c, p.x - 3 * s, p.y - s, 6 * s, 2 * s, K.warn); if (big && opts.labels) T(c, D.name, p.x + 8, p.y - 5, 10, K.warn); }
  // conflicts: a dotted line between the capitals, blinking
  for (const k of d.w.conflicts) if (k.posA && k.posB) { const a = S(k.posA[0], k.posA[1]), b = S(k.posB[0], k.posB[1]); if (Math.floor(ui.t / 15) % 2) dotLine(c, a, b, K.bad); }
  // capitals + status icons
  const pts = [];
  const labels = [];
  for (const m of d.w.countries) {
    if (!m.pos) continue;
    const p = S(m.pos[0], m.pos[1]);
    if (!inside(p, -2)) continue;
    pts.push({ id: m.id, x: p.x, y: p.y });
    const s = big ? 2 : 1;
    R(c, p.x - s, p.y - s, 2 * s + 1, 2 * s + 1, m.war ? K.bad : '#f2f2f2');
    if (opts.icons !== false) {
      const ic = [];
      if (m.war) ic.push(['war', K.bad]);
      else if (m.ally) ic.push(['ally', K.blue]);
      if (m.sanction || m.onJapan) ic.push(['ban', '#ff9a5a']);
      if (big) ic.slice(0, 2).forEach(([id, col], i) => { const ix = p.x + 4 + i * 11, iy = p.y + 3; R(c, ix - 1, iy - 1, 11, 11, 'rgba(4,10,18,0.8)'); icon(c, id, ix, iy, 1, col); });
      else ic.slice(0, 1).forEach(([, col]) => { R(c, p.x + 2, p.y + 2, 3, 3, col); });
    }
    if (big && opts.labels && m.id !== ui.sel) labels.push({ id: m.id, x: p.x, y: p.y, t: m.short, col: relColor(m.relation) });
  }
  // Japan
  const jp = S(35.68, 139.69);
  if (inside(jp)) { R(c, jp.x - 2, jp.y - 2, 5, 5, '#e8343c'); R(c, jp.x - 1, jp.y - 1, 3, 3, '#ffffff'); if (big && opts.labels) labels.unshift({ id: 'jp', x: jp.x, y: jp.y, t: '日本', col: '#ffffff' }); }
  // labels with a simple collision check
  const placed = [];
  for (const L of labels) {
    const w = measure(c, L.t, 10) + 6, h = 13;
    const cands = [[L.x + 6, L.y - 15], [L.x + 6, L.y + 2], [L.x - w - 5, L.y - 15], [L.x - w - 5, L.y + 2]];
    for (const [lx, ly] of cands) {
      const r = { x: lx, y: ly, w, h };
      if (r.x < dest.x || r.y < dest.y || r.x + w > dest.x + dest.w || r.y + h > dest.y + dest.h) continue;
      if (placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y)) continue;
      placed.push(r);
      R(c, lx, ly, w, h, 'rgba(4,10,18,0.72)');
      T(c, L.t, lx + 3, ly + 1, 10, L.col);
      break;
    }
  }
  // crises: blinking triangles (bigger in a zoomed view)
  for (const k of d.w.crises) {
    if (!k.pos) continue;
    const p = S(k.pos[0], k.pos[1]);
    if (!inside(p)) continue;
    if (Math.floor(ui.t / 12) % 2) tri(c, p.x - 3, p.y - 12, num(k.sev, 1) >= 2 ? K.warn : '#ffe9a0');
  }
  // the war of Japan: the enemy marker with a ring
  if (d.war && d.rows[d.war.enemy] && d.rows[d.war.enemy].pos) { const p = S(d.rows[d.war.enemy].pos[0], d.rows[d.war.enemy].pos[1]); ring(c, p.x, p.y, 5 + (ui.t >> 3) % 4, K.bad); }
  // the selection + its tooltip
  if (selRow && selRow.pos && selRow.real !== false) {
    const p = S(selRow.pos[0], selRow.pos[1]);
    if (inside(p)) {
      ring(c, p.x, p.y, (big ? 8 : 6) + ((ui.t >> 4) % 2), K.amber);
      if (opts.tooltip !== false) {
        const t1 = selRow.short, t2 = `関係 ${selRow.relation}`;
        const w = Math.max(measure(c, t1, 12), measure(c, t2, 10)) + 12, h = 30;
        let lx = p.x + 10, ly = p.y - 34;
        if (lx + w > dest.x + dest.w - 2) lx = p.x - w - 10;
        if (ly < dest.y + 2) ly = p.y + 10;
        R(c, lx, ly, w, h, 'rgba(4,10,18,0.88)'); R(c, lx, ly, 2, h, K.amber);
        T(c, t1, lx + 6, ly + 2, 12, K.amber);
        T(c, t2, lx + 6, ly + 17, 10, relColor(selRow.relation));
      }
    }
  }
  c.restore();
  R(c, dest.x, dest.y + dest.h, dest.w, 1, K.edge);
  return { pts, win };
}
