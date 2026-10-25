// Driving minigame — art: the course bitmap, vehicles, signals, people.  (draws only; no game logic)
// API doc: test-output/api_driving.txt.  Everything is drawn in world pixels; the minigame scales by Z.

import { makeCanvas, mulberry32 } from './util.js';
import { sigState, TOWN } from './driving_course.js';

export const Z = 1.5; // screen pixels per world pixel
const TAU = Math.PI * 2;
const PAL = {
  grass: ['#5d9b55', '#53914c', '#68a65f'],
  asphalt: '#4a4f60', asphalt2: '#444958', curb: '#d4d4dc', walk: '#bdb8ac', walk2: '#aaa598',
  white: '#f6f6ee', yellow: '#f2c93b', rail: '#9a9aa6', sleeper: '#6d5a44', wood: '#b07b43', wood2: '#8e5f30',
  bld: ['#c9b79c', '#a9b6c8', '#c8a3a3', '#b5c7a3', '#d3c27a', '#9fb0b6'],
  roof: ['#8d7a64', '#6f7f95', '#946b6b', '#7d9468', '#a8984f', '#6a7e85'],
};
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; };

function strokePoly(c, pts, w, col, cap = 'round') {
  if (pts.length < 2) { c.fillStyle = col; c.beginPath(); c.arc(pts[0][0], pts[0][1], w / 2, 0, TAU); c.fill(); return; }
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = cap; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
}
function dashed(c, pts, w, col, on = 6, off = 8, startOff = 0) {
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'butt';
  c.setLineDash([on, off]); c.lineDashOffset = -startOff;
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke(); c.setLineDash([]);
}
const rotRect = (c, x, y, dx, dy, along, lat, col) => { // rect centred at (x,y) oriented by (dx,dy): `along` long, `lat` wide
  c.save(); c.translate(x, y); c.rotate(Math.atan2(dy, dx)); c.fillStyle = col; c.fillRect(-along / 2, -lat / 2, along, lat); c.restore();
};

// ------------------------------------------------------------------ the course bitmap
export function renderStatic(course, opts = {}) {
  const b = course.bounds;
  const ox = Math.floor(b.x0), oy = Math.floor(b.y0);
  const w = Math.ceil(b.x1 - b.x0), h = Math.ceil(b.y1 - b.y0);
  const [cv, c] = makeCanvas(Math.ceil(w * Z), Math.ceil(h * Z));
  c.imageSmoothingEnabled = false;
  c.setTransform(Z, 0, 0, Z, -ox * Z, -oy * Z);
  const town = !!course.town;
  // ---- ground
  c.fillStyle = PAL.grass[0];
  c.fillRect(ox, oy, w, h);
  for (let y = oy; y < oy + h; y += 6) for (let x = ox; x < ox + w; x += 6) {
    const r = hash(x >> 1, y >> 1);
    if (r < 0.2) { c.fillStyle = PAL.grass[1]; c.fillRect(x, y, 6, 6); } else if (r > 0.9) { c.fillStyle = PAL.grass[2]; c.fillRect(x + 1, y + 1, 4, 3); }
  }
  // ---- town blocks: pavement + buildings
  if (town) drawTownGround(c, course, ox, oy, w, h);
  // ---- drivable surfaces: kerb band, asphalt
  for (const r of course.rects) {
    if ((r.road && town) || r.corner) continue;
    c.fillStyle = PAL.curb; c.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  }
  for (const r of course.ribbons) strokePoly(c, r.pts, r.hw * 2 + 6, PAL.curb);
  for (const r of course.rects) { if ((r.road && town) || r.corner) continue; c.fillStyle = PAL.asphalt; c.fillRect(r.x, r.y, r.w, r.h); }
  for (const r of course.ribbons) strokePoly(c, r.pts, r.hw * 2, PAL.asphalt);
  // asphalt speckle
  c.fillStyle = PAL.asphalt2;
  for (const r of course.rects) { if ((r.road && town) || r.corner) continue; for (let y = r.y; y < r.y + r.h; y += 8) for (let x = r.x; x < r.x + r.w; x += 8) if (hash(x, y) < 0.18) c.fillRect(x + 2, y + 3, 3, 2); }
  if (town) drawRoadsTown(c, course);
  // lane centre for the yard: dashed line along the path
  if (!town && course.path.length > 2 && !course.noPathProgress) {
    dashed(c, course.path, 1.4, 'rgba(246,246,238,0.55)', 6, 9);
  }
  // ---- walls / fences / garages
  for (const wl of course.walls) drawWall(c, wl);
  // ---- marks
  for (const m of course.marks) drawMark(c, m, course, opts);
  // ---- zebra crossings
  for (const z of course.zebras || []) drawZebra(c, z.x, z.y, z.dx, z.dy, z.len, z.hw);
  if (town) drawTownDeco(c, course);
  else drawYardDeco(c, course, ox, oy, w, h);
  return { cv, ox, oy };
}

function drawWall(c, wl) {
  if (wl.kind === 'car') { // parked car (no sprite sheet: simple top view)
    const horiz = wl.w >= wl.h;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(wl.x + 1, wl.y + 1.5, wl.w, wl.h);
    c.fillStyle = wl.col; c.fillRect(wl.x, wl.y, wl.w, wl.h);
    c.fillStyle = 'rgba(255,255,255,0.28)'; if (horiz) c.fillRect(wl.x + 2, wl.y + 1, wl.w - 4, 2); else c.fillRect(wl.x + 1, wl.y + 2, 2, wl.h - 4);
    c.fillStyle = '#243049';
    if (horiz) { c.fillRect(wl.x + wl.w * 0.55, wl.y + 2, 5, wl.h - 4); c.fillRect(wl.x + wl.w * 0.16, wl.y + 2.5, 4, wl.h - 5); } else { c.fillRect(wl.x + 2, wl.y + wl.h * 0.55, wl.w - 4, 5); c.fillRect(wl.x + 2.5, wl.y + wl.h * 0.16, wl.w - 5, 4); }
    c.fillStyle = '#e7d97a';
    if (horiz) { c.fillRect(wl.x + wl.w - 2, wl.y + 1.5, 2, 2); c.fillRect(wl.x + wl.w - 2, wl.y + wl.h - 3.5, 2, 2); } else { c.fillRect(wl.x + 1.5, wl.y + wl.h - 2, 2, 2); c.fillRect(wl.x + wl.w - 3.5, wl.y + wl.h - 2, 2, 2); }
    c.restore();
    return;
  }
  if (wl.kind === 'curb') { c.fillStyle = '#9fa3b2'; c.fillRect(wl.x, wl.y, wl.w, wl.h); c.fillStyle = '#d4d4dc'; c.fillRect(wl.x, wl.y + wl.h - 2, wl.w, 2); return; }
  // building
  c.fillStyle = wl.col; c.fillRect(wl.x, wl.y, wl.w, wl.h);
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(wl.x, wl.y + wl.h - 5, wl.w, 5);
  c.fillStyle = 'rgba(255,255,255,0.16)'; c.fillRect(wl.x, wl.y, wl.w, 3);
  c.fillStyle = 'rgba(30,40,60,0.55)';
  for (let x = wl.x + 8; x < wl.x + wl.w - 10; x += 16) for (let y = wl.y + 8; y < wl.y + wl.h - 14; y += 18) c.fillRect(x, y, 8, 9);
}

function drawMark(c, m, course, opts = {}) {
  const W = PAL.white;
  switch (m.t) {
    case 'stopline': {
      const nx = -m.dy, ny = m.dx;
      c.save(); c.translate(m.x, m.y); c.rotate(Math.atan2(m.dy, m.dx));
      c.fillStyle = W; c.fillRect(-1.5, -m.hw, 3, m.hw * 2);
      if (m.kind === 'mark') { c.fillStyle = PAL.yellow; for (let k = -m.hw + 2; k < m.hw - 2; k += 8) c.fillRect(-1.5, k, 3, 3); }
      c.restore();
      break;
    }
    case 'stopsign': drawStopSign(c, m.x, m.y, opts.year); break;
    case 'bay': {
      c.strokeStyle = m.col || W; c.lineWidth = 1.6; c.setLineDash([5, 3]);
      c.strokeRect(m.x, m.y, m.w, m.h); c.setLineDash([]);
      break;
    }
    case 'rail': drawRailBed(c, m); break;
    case 'slope': drawSlope(c, course, m); break;
    case 'bridge': drawBridge(c, course, m); break;
    case 'pickup': {
      const nx = m.dy, ny = -m.dx; // left normal
      c.save(); c.translate(m.x + nx * 9, m.y + ny * 9); c.rotate(Math.atan2(m.dy, m.dx));
      c.fillStyle = m.kind === 'pickup' ? 'rgba(111,214,255,0.4)' : 'rgba(255,214,90,0.4)'; c.fillRect(-26, -6, 52, 12);
      c.strokeStyle = W; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.strokeRect(-26, -6, 52, 12); c.setLineDash([]);
      c.restore();
      break;
    }
    default: break;
  }
}

function drawStopSign(c, x, y, year = 2026) {
  c.save(); c.translate(x, y);
  if (year >= 2017) { // 「止まれ」 signs carry 「STOP」 from 2017
    c.fillStyle = '#fff'; c.fillRect(-6, 7, 12, 4.6); c.fillStyle = '#e03a3a';
    c.font = 'bold 4.2px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', 0, 9.4);
  }
  c.fillStyle = '#6b6f80'; c.fillRect(-0.8, -0.8, 1.6, 1.6);
  c.fillStyle = '#e03a3a';
  c.beginPath(); c.moveTo(-7, -6); c.lineTo(7, -6); c.lineTo(0, 7); c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-5, -4.6); c.lineTo(5, -4.6); c.lineTo(0, 4.6); c.closePath(); c.fill();
  c.fillStyle = '#e03a3a'; c.beginPath(); c.moveTo(-3.6, -3.4); c.lineTo(3.6, -3.4); c.lineTo(0, 3.2); c.closePath(); c.fill();
  c.restore();
}

function drawZebra(c, x, y, dx, dy, len, hw) {
  c.save(); c.translate(x, y); c.rotate(Math.atan2(dy, dx));
  c.fillStyle = PAL.white;
  for (let k = -hw + 3; k < hw - 3; k += 7) c.fillRect(-len / 2, k, len, 3.6);
  c.restore();
}

function drawRailBed(c, m) {
  // tracks run across the path: along the lateral axis
  c.save(); c.translate(m.x, m.y); c.rotate(Math.atan2(m.dy, m.dx));
  const L = m.hw + 40;
  c.fillStyle = '#5a5d6c'; c.fillRect(-9, -m.hw, 18, m.hw * 2); // level-crossing deck
  c.fillStyle = PAL.sleeper;
  for (let k = -m.hw; k < m.hw; k += 4) c.fillRect(-7, k, 14, 2.2);
  c.fillStyle = '#7b6a55'; for (let k = -L; k < -m.hw; k += 5) c.fillRect(-6, k, 12, 2); for (let k = m.hw; k < L; k += 5) c.fillRect(-6, k, 12, 2);
  c.fillStyle = PAL.rail; c.fillRect(-4, -L, 1.6, L * 2); c.fillRect(2.4, -L, 1.6, L * 2);
  c.fillStyle = '#c9c9d4'; c.fillRect(-4, -L, 0.6, L * 2); c.fillRect(2.4, -L, 0.6, L * 2);
  // warning stripes at the edges
  c.fillStyle = PAL.yellow; c.fillRect(-9, -m.hw, 2, 4); c.fillRect(7, m.hw - 4, 2, 4);
  c.restore();
}

function drawSlope(c, course, m) {
  const pb = course._pb;
  const hw = (course.ribbons[0] ? course.ribbons[0].hw : 24);
  for (let s = m.s0; s < m.s1; s += 18) {
    const q = pb.at(s);
    c.save(); c.translate(q.x, q.y); c.rotate(q.a);
    const t = (s - m.s0) / (m.s1 - m.s0);
    c.fillStyle = `rgba(255,214,90,${0.12 + 0.22 * t})`; c.fillRect(-9, -hw, 9, hw * 2);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-3, -hw * 0.5); c.lineTo(3, 0); c.lineTo(-3, hw * 0.5); c.stroke();
    c.restore();
  }
  const q = pb.at(m.s0 - 22);
  c.save(); c.translate(q.x - Math.sin(q.a) * (hw + 14), q.y + Math.cos(q.a) * (hw + 14));
  c.fillStyle = '#fff'; c.fillRect(-10, -8, 20, 16); c.strokeStyle = '#e03a3a'; c.lineWidth = 2; c.strokeRect(-9, -7, 18, 14);
  c.fillStyle = '#222'; c.beginPath(); c.moveTo(-6, 4); c.lineTo(6, -3); c.lineTo(6, 4); c.closePath(); c.fill();
  c.restore();
}

function drawBridge(c, course, m) {
  const pb = course._pb;
  const hw = (course.ribbons.find((r) => r.hw < 12) || { hw: 7 }).hw;
  for (let s = m.s0; s < m.s1; s += 3) {
    const q = pb.at(s);
    c.save(); c.translate(q.x, q.y); c.rotate(q.a);
    c.fillStyle = (Math.floor(s / 3) % 2) ? PAL.wood : PAL.wood2; c.fillRect(0, -hw, 3.2, hw * 2);
    c.restore();
  }
  for (const side of [-1, 1]) {
    const a = pb.at(m.s0), b = pb.at(m.s1);
    c.strokeStyle = '#f3efe0'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(a.x - Math.sin(a.a) * hw * side, a.y + Math.cos(a.a) * hw * side); c.lineTo(b.x - Math.sin(b.a) * hw * side, b.y + Math.cos(b.a) * hw * side); c.stroke();
  }
}

function drawYardDeco(c, course, ox, oy, w, h) {
  const rnd = mulberry32(5);
  // fence along the bounds, a few trees, the school building at the start
  c.strokeStyle = '#8a8f9e'; c.lineWidth = 1.2;
  c.strokeRect(ox + 8, oy + 8, w - 16, h - 16);
  c.fillStyle = '#7b8190';
  for (let x = ox + 8; x < ox + w - 8; x += 12) { c.fillRect(x, oy + 6, 1.6, 4); c.fillRect(x, oy + h - 10, 1.6, 4); }
  for (let y = oy + 8; y < oy + h - 8; y += 12) { c.fillRect(ox + 6, y, 4, 1.6); c.fillRect(ox + w - 10, y, 4, 1.6); }
  for (let i = 0; i < Math.round(w / 70); i++) {
    const x = ox + 20 + rnd() * (w - 40), y = rnd() < 0.5 ? oy + 16 + rnd() * 10 : oy + h - 26 + rnd() * 10;
    drawTree(c, x, y, 7 + rnd() * 3);
  }
  const st = course.start;
  if (!course.noPathProgress && course.name !== 'moto') {
    // 教習所 building behind the start line
    const bx = st.x - 80, by = st.y - 140;
    if (by > oy + 10) {
      c.fillStyle = '#c9b79c'; c.fillRect(bx, by, 110, 44);
      c.fillStyle = '#8d7a64'; c.fillRect(bx - 4, by - 6, 118, 10);
      c.fillStyle = 'rgba(30,40,60,0.6)'; for (let x = bx + 8; x < bx + 100; x += 16) c.fillRect(x, by + 14, 9, 11);
      c.fillStyle = '#fff'; c.fillRect(bx + 40, by + 27, 30, 17);
    }
  }
}
function drawTree(c, x, y, r) {
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.arc(x + 1.5, y + 2, r, 0, TAU); c.fill();
  c.fillStyle = '#3f7a3f'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = '#58a257'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, TAU); c.fill();
}

// ------------------------------------------------------------------ the town
function drawTownGround(c, course, ox, oy, w, h) {
  const { XS, YS, ROAD_HW } = TOWN;
  const xs = [0, ...XS.flatMap((x) => [x - ROAD_HW, x + ROAD_HW]), TOWN.GRID_W];
  const ys = [0, ...YS.flatMap((y) => [y - ROAD_HW, y + ROAD_HW]), TOWN.GRID_H];
  for (let i = 0; i < xs.length; i += 2) for (let j = 0; j < ys.length; j += 2) {
    const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
    if (x1 - x0 < 4 || y1 - y0 < 4) continue;
    // pavement for the whole block
    c.fillStyle = PAL.walk; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = PAL.walk2;
    for (let x = x0; x < x1; x += 10) c.fillRect(x, y0, 1, y1 - y0);
    // kerb line
    c.fillStyle = PAL.curb;
    const pad = 3;
    c.fillRect(x0, y0, x1 - x0, 0);
    // buildings inside the block
    const rnd = mulberry32(((i + 1) * 31 + (j + 1) * 17) >>> 0);
    const bw = x1 - x0, bh = y1 - y0;
    const inset = 16;
    const nx = Math.max(1, Math.floor((bw - inset * 2) / 150)), ny = Math.max(1, Math.floor((bh - inset * 2) / 120));
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
      const cw = (bw - inset * 2) / nx, ch = (bh - inset * 2) / ny;
      const px = x0 + inset + a * cw + 4, py = y0 + inset + b * ch + 4;
      const ww = cw - 8, hh = ch - 8;
      if (ww < 24 || hh < 24) continue;
      const k = Math.floor(rnd() * PAL.bld.length);
      if (rnd() < 0.18) { // a small park / lot
        c.fillStyle = '#6fae62'; c.fillRect(px, py, ww, hh);
        for (let t = 0; t < 4; t++) drawTree(c, px + 12 + rnd() * (ww - 24), py + 12 + rnd() * (hh - 24), 7 + rnd() * 3);
        continue;
      }
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 3, py + 3, ww, hh);
      c.fillStyle = PAL.bld[k]; c.fillRect(px, py, ww, hh);
      c.fillStyle = PAL.roof[k]; c.fillRect(px + 4, py + 4, ww - 8, hh - 8);
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(px + 4, py + 4, ww - 8, 3);
      c.fillStyle = 'rgba(0,0,0,0.14)'; c.fillRect(px + ww * 0.5, py + 4, 2, hh - 8);
      c.fillStyle = 'rgba(40,40,50,0.35)'; c.fillRect(px + 10, py + hh * 0.5 - 4, 14, 8); // roof unit
    }
  }
}

function drawRoadsTown(c, course) {
  const { XS, YS, ROAD_HW } = TOWN;
  // kerb then asphalt for the road rectangles (drawn as one union so the intersections are open)
  for (const r of course.rects) if (r.road) { c.fillStyle = PAL.curb; c.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6); }
  for (const r of course.rects) if (r.road) { c.fillStyle = PAL.asphalt; c.fillRect(r.x, r.y, r.w, r.h); }
  // rounded kerb corners
  for (const r of course.rects) if (r.corner) {
    c.save();
    c.beginPath(); c.rect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1); c.clip();
    c.fillStyle = PAL.asphalt; c.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
    c.fillStyle = PAL.walk; c.beginPath(); c.arc(r.cut.x, r.cut.y, r.cut.r, 0, TAU); c.fill();
    c.strokeStyle = PAL.curb; c.lineWidth = 3; c.beginPath(); c.arc(r.cut.x, r.cut.y, r.cut.r + 0.5, 0, TAU); c.stroke();
    c.restore();
  }
  // speckle
  c.fillStyle = PAL.asphalt2;
  for (const r of course.rects) if (r.road) for (let y = r.y; y < r.y + r.h; y += 8) for (let x = r.x; x < r.x + r.w; x += 8) if (hash(x, y) < 0.14) c.fillRect(x + 2, y + 3, 3, 2);
  // centre lines (dashed yellow-white) outside the intersections
  const gap = ROAD_HW + 4;
  const segs = (a0, a1, cuts) => { const out = []; let p = a0; for (const q of cuts) { if (q - gap > p) out.push([p, q - gap]); p = q + gap; } if (a1 > p) out.push([p, a1]); return out; };
  c.lineCap = 'butt';
  for (const y of YS) for (const [x0, x1] of segs(0, TOWN.GRID_W, XS)) dashed(c, [[x0, y], [x1, y]], 1.6, PAL.yellow, 14, 10);
  for (const x of XS) for (const [y0, y1] of segs(0, TOWN.GRID_H, YS)) dashed(c, [[x, y0], [x, y1]], 1.6, PAL.yellow, 14, 10);
  // zebra on every arm of the intersections
  for (const x of XS) for (const y of YS) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = 43;
      drawZebra(c, x + dx * d, y + dy * d, dx, dy, 11, ROAD_HW);
    }
  }
}

function drawTownDeco(c, course) {
  const { XS, YS } = TOWN;
  // street trees on the pavement corners
  const rnd = mulberry32(21);
  for (const x of XS) for (const y of YS) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    drawTree(c, x + sx * 60, y + sy * 60, 6.5);
  }
  for (let i = 0; i < 40; i++) {
    const horiz = rnd() < 0.5;
    const t = rnd();
    if (horiz) { const y = YS[Math.floor(rnd() * YS.length)] + (rnd() < 0.5 ? -1 : 1) * 41; const x = t * TOWN.GRID_W; if (!XS.some((q) => Math.abs(q - x) < 80)) drawTree(c, x, y, 5.5); }
    else { const x = XS[Math.floor(rnd() * XS.length)] + (rnd() < 0.5 ? -1 : 1) * 41; const y = t * TOWN.GRID_H; if (!YS.some((q) => Math.abs(q - y) < 80)) drawTree(c, x, y, 5.5); }
  }
  // the school gate at the start
  const st = course.start;
  c.fillStyle = '#d8d8e0'; c.fillRect(st.x - 26, st.y - 36, 6, 12); c.fillRect(st.x - 26, st.y + 24, 6, 12);
  c.fillStyle = '#e03a3a'; c.fillRect(st.x - 26, st.y - 36, 6, 3); c.fillRect(st.x - 26, st.y + 24, 6, 3);
}

// ------------------------------------------------------------------ dynamic things
export function drawSignalHeads(c, course, t) {
  const { ROAD_HW } = TOWN;
  for (const s of course.sigs || []) {
    const C = s.C;
    const heads = [
      { x: C.x - 50, y: C.y - 44, dx: 1, dy: 0, axis: 'h' },
      { x: C.x + 50, y: C.y + 44, dx: -1, dy: 0, axis: 'h' },
      { x: C.x + 44, y: C.y - 50, dx: 0, dy: 1, axis: 'v' },
      { x: C.x - 44, y: C.y + 50, dx: 0, dy: -1, axis: 'v' },
    ];
    for (const hd of heads) {
      const st = sigState(s.id, hd.axis, t);
      c.save(); c.translate(hd.x, hd.y); c.rotate(Math.atan2(hd.dy, hd.dx));
      c.fillStyle = '#2b2e3b'; c.fillRect(-9, -3.6, 18, 7.2);
      c.fillStyle = '#6b6f80'; c.fillRect(-1, 3.6, 2, 3);
      const lamps = [['g', '#31e07a', '#14452c'], ['y', '#ffd23f', '#4a4018'], ['r', '#ff4a4a', '#4a1a1a']];
      lamps.forEach(([k, on, off], i) => {
        c.fillStyle = st === k ? on : off;
        c.beginPath(); c.arc(-5 + i * 5, 0, 2.1, 0, TAU); c.fill();
        if (st === k) { c.fillStyle = on; c.globalAlpha = 0.25; c.beginPath(); c.arc(-5 + i * 5, 0, 4.6, 0, TAU); c.fill(); c.globalAlpha = 1; }
      });
      c.restore();
    }
  }
}

export function drawGateAndTrain(c, course, gate, train) {
  const m = course.marks.find((q) => q.t === 'rail');
  if (!m) return;
  const a = Math.atan2(m.dy, m.dx);
  c.save(); c.translate(m.x, m.y); c.rotate(a);
  const closed = gate.st !== 'open';
  const phase = gate.st === 'closing' ? Math.min(1, gate.t / 40) : gate.st === 'opening' ? 1 - Math.min(1, gate.t / 30) : gate.st === 'closed' ? 1 : 0;
  // two gates (one per side of the tracks), arms swing across our lane / the other lane
  for (const side of [-1, 1]) {
    const px = side * 14;
    const left = side < 0;
    // pivot at the left curb for our lane (lateral -hw), at the right curb for the oncoming lane
    for (const lane of [-1, 1]) {
      const py = lane * (m.hw + 1);
      c.fillStyle = '#23252f'; c.fillRect(px - 1.6, py - 1.6, 3.2, 3.2);
      // arm: lateral extent grows from 0 to hw
      const len = (m.hw - 1) * phase + 5;
      c.save(); c.translate(px, py);
      c.fillStyle = '#fff'; c.fillRect(-1.1, lane > 0 ? -len : 0, 2.2, len);
      c.fillStyle = '#e03a3a';
      for (let k = 0; k < len; k += 6) c.fillRect(-1.1, lane > 0 ? -len + k : k, 2.2, Math.min(3, len - k));
      c.restore();
      if (closed && Math.floor(gate.t / 10) % 2 === (left ? 0 : 1)) { c.fillStyle = '#ff4a4a'; c.beginPath(); c.arc(px, py + (lane > 0 ? -4 : 4), 2.6, 0, TAU); c.fill(); }
    }
  }
  if (train) {
    const L = m.hw + 40;
    const u = (train.x * 2 - 1) * (L + 90); // lateral travel
    c.fillStyle = '#d6d9e6';
    c.fillRect(-5.5, u - 90, 11, 90);
    c.fillStyle = '#2f6fd0'; c.fillRect(-5.5, u - 90, 11, 4);
    c.fillStyle = '#27324f'; for (let k = 6; k < 88; k += 11) c.fillRect(-3.5, u - 90 + k, 7, 6);
    c.fillStyle = '#9aa0b8'; c.fillRect(-5.5, u - 4, 11, 4);
  }
  c.restore();
}

// ------------------------------------------------------------------ vehicles
const spriteCache = new Map();
export function carSprite(look) {
  const key = look.kind + look.body + (look.taxi ? 't' : '') + (look.school ? 's' : '');
  if (spriteCache.has(key)) return spriteCache.get(key);
  const moto = look.kind === 'moto';
  const W = moto ? 18 : 29, H = moto ? 8 : 13;
  const [cv, c] = makeCanvas(W, H);
  c.imageSmoothingEnabled = false;
  const body = look.body, trim = look.trim;
  const fr = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  if (moto) {
    fr(2, 3, 12, 3, '#1b1b22'); // body
    fr(3, 2, 8, 4, body); fr(11, 2, 3, 4, trim); fr(1, 3.5, 2, 1, '#e8e8f0');
    fr(14, 1, 3, 6, '#2a2a30'); // front fork / handlebar
    fr(6, 1.5, 4, 5, '#2f6fd0'); // rider body
    c.fillStyle = '#e8e8f0'; c.beginPath(); c.arc(8, 4, 2.1, 0, TAU); c.fill(); // helmet
    fr(16, 3, 2, 2, '#ffe9a0');
  } else {
    const sedan = look.kind === 'sedan';
    // shadow-less top view facing east
    fr(1, 1, W - 2, H - 2, body);
    fr(0, 2, 1, H - 4, body); fr(W - 1, 2, 1, H - 4, body);
    fr(1, 1, W - 2, 1, 'rgba(255,255,255,0.45)');
    fr(1, H - 2, W - 2, 1, 'rgba(0,0,0,0.18)');
    // glass and roof
    const gx = sedan ? 9 : 8;
    fr(gx, 2, 4, H - 4, '#2a3a5c'); // rear window
    fr(gx + 4, 2, sedan ? 7 : 8, H - 4, shadeCol(body)); // roof
    fr(gx + (sedan ? 11 : 12), 2, 4, H - 4, '#33476e'); // windscreen
    fr(gx + (sedan ? 15 : 16), 2, sedan ? 3 : 2, H - 4, shadeCol(body, 0.04)); // bonnet shade
    // lights
    fr(W - 2, 2, 2, 2, '#fff2a8'); fr(W - 2, H - 4, 2, 2, '#fff2a8');
    fr(0, 2, 1, 2, '#8a2626'); fr(0, H - 4, 1, 2, '#8a2626');
    // mirrors
    fr(gx + 10, 0, 2, 1, trim); fr(gx + 10, H - 1, 2, 1, trim);
    if (look.school) { fr(gx + 4, 4, 7, 5, '#fff'); fr(gx + 5, 5, 2, 3, '#e03a3a'); fr(gx + 8, 5, 2, 3, '#e03a3a'); }
    if (look.taxi) { fr(gx + 5, 4, 5, 5, '#fff7c9'); fr(gx + 6, 5, 3, 3, '#e8a43a'); }
    // 初心運転者標識 (若葉) on the nose — tiny
    fr(W - 5, 5, 2, 3, '#69b94b');
  }
  const out = { cv, W, H };
  spriteCache.set(key, out);
  return out;
}
function shadeCol(hex, k = 0.1) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - k * 2.2))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// draws the player's vehicle; (x,y) = rear axle; ctx is in world coordinates
export function drawVehicle(c, sim, look, t) {
  const car = sim.car, V = sim.veh;
  const sp = carSprite(look);
  const cx = car.x + Math.cos(car.a) * V.wb / 2, cy = car.y + Math.sin(car.a) * V.wb / 2;
  // shadow
  c.save();
  c.translate(cx, cy); c.rotate(car.a);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(-V.L / 2 + 1.5, -V.W / 2 + 2, V.L, V.W);
  c.imageSmoothingEnabled = false;
  c.drawImage(sp.cv, -sp.W / 2, -sp.H / 2);
  // brake lights
  if (car.br > 0.1 || (car.gear === 'R')) {
    c.fillStyle = car.gear === 'R' ? '#ffffff' : '#ff5050';
    if (sim.moto) c.fillRect(-sp.W / 2, -1, 1.5, 2); else { c.fillRect(-sp.W / 2, -V.W / 2 + 1.5, 1.6, 2.4); c.fillRect(-sp.W / 2, V.W / 2 - 3.9, 1.6, 2.4); }
  }
  // turn signals blink
  if (sim.sig && Math.floor(t / 14) % 2 === 0) {
    const side = sim.sig < 0 ? -1 : 1;
    c.fillStyle = '#ffb400';
    const hy = side * (V.W / 2 - 1.2);
    c.fillRect(V.L / 2 - 2, hy - 1, 2.4, 2.2); c.fillRect(-V.L / 2 - 0.4, hy - 1, 2.4, 2.2);
    c.globalAlpha = 0.35; c.beginPath(); c.arc(V.L / 2, hy, 4, 0, TAU); c.fill(); c.beginPath(); c.arc(-V.L / 2, hy, 4, 0, TAU); c.fill(); c.globalAlpha = 1;
  }
  // front wheels (steering) as small dark ticks
  if (!sim.moto) {
    c.fillStyle = '#16161c';
    const fx = V.wb - V.wb / 2; // front axle relative to centre
    for (const s of [-1, 1]) {
      c.save(); c.translate(fx, s * (V.W / 2)); c.rotate(car.steer); c.fillRect(-2.2, -0.7, 4.4, 1.4); c.restore();
    }
  }
  c.restore();
  // safety-check cone
  if (sim.lookT < 26) {
    const a0 = car.a, side = (sim.lookT < 13 ? -1 : 1);
    const k = 1 - Math.abs(sim.lookT - 13) / 13;
    c.save(); c.translate(cx, cy);
    c.fillStyle = `rgba(255,255,255,${0.12 + 0.2 * k})`;
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 42, a0 + (side < 0 ? -Math.PI * 0.95 : Math.PI * 0.05), a0 + (side < 0 ? -Math.PI * 0.05 : Math.PI * 0.95)); c.closePath(); c.fill();
    c.restore();
  }
}

export function drawPed(c, p, t) {
  if (p.gone) return;
  c.save(); c.translate(p.x, p.y); c.scale(1.35, 1.35);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0.8, 1.4, 3.6, 2.6, 0, 0, TAU); c.fill();
  const ang = Math.atan2(p.vy, p.vx);
  c.rotate(ang);
  c.fillStyle = '#e8584a'; c.fillRect(-1.6, -3.2, 3.2, 6.4); // shoulders
  const step = Math.sin(t * 0.25 + p.look) * 1.4;
  c.fillStyle = '#2f3a60'; c.fillRect(-3 + step, -1.6, 2, 1.2); c.fillRect(-3 - step, 0.4, 2, 1.2);
  c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0, 0, 2.2, 0, TAU); c.fill();
  c.fillStyle = '#2b2430'; c.beginPath(); c.arc(-0.4, 0, 2.1, Math.PI * 0.5, Math.PI * 1.5); c.fill();
  c.restore();
}

export function drawCone(c, k) {
  if (k.hit) {
    const t = k.hit;
    c.save(); c.translate(k.x + (k.vx || 0) * Math.min(t, 18), k.y + (k.vy || 0) * Math.min(t, 18)); c.rotate(t * 0.3);
    c.globalAlpha = Math.max(0.35, 1 - t / 90);
    c.fillStyle = '#ff8a3d'; c.fillRect(-2.5, -1.4, 5, 2.8); c.fillStyle = '#fff'; c.fillRect(-0.6, -1.4, 1.4, 2.8);
    c.restore();
    return;
  }
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(k.x + 1, k.y + 1.4, 3.4, 0, TAU); c.fill();
  c.fillStyle = '#e8e8f0'; c.fillRect(k.x - 3.2, k.y - 3.2, 6.4, 6.4);
  c.fillStyle = '#ff7a2f'; c.beginPath(); c.arc(k.x, k.y, 2.9, 0, TAU); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(k.x, k.y, 1.5, 0, TAU); c.fill();
  c.fillStyle = '#ff7a2f'; c.beginPath(); c.arc(k.x, k.y, 0.7, 0, TAU); c.fill();
}
