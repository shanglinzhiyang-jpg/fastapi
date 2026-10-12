// Procedural building facades for town maps.
//
// building entity: { type: 'building', x, y, w, h, place, door: dx, kind, wall, roof,
//                    logo, sign: { text, bg, color }, name }
// The footprint (w x h tiles) is solid except the door tile (x + door, y + h - 1),
// which is the entrance.
//
// kind: 'office' | 'tower' | 'theater' | 'studio' | 'house' | 'shop' | 'station' | 'small' | 'hotel' | 'bath'

import { TILE, shade } from './util.js';
import { drawLogo } from './logos.js';
import { text, measure } from './draw.js';

const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function windowsGrid(ctx, x, y, w, h, opt) {
  const { cw = 10, ch = 9, gx = 4, gy = 5, glass = '#8fd0ff', frame = '#f4f4f4', t = 0, lit = false } = opt;
  const cols = Math.max(1, Math.floor((w + gx) / (cw + gx)));
  const rows = Math.max(1, Math.floor((h + gy) / (ch + gy)));
  const ox = x + Math.floor((w - (cols * (cw + gx) - gx)) / 2);
  const oy = y + Math.floor((h - (rows * (ch + gy) - gy)) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = ox + c * (cw + gx), wy = oy + r * (ch + gy);
      R(ctx, wx - 1, wy - 1, cw + 2, ch + 2, frame);
      R(ctx, wx, wy, cw, ch, glass);
      R(ctx, wx + 1, wy + 1, Math.max(1, Math.floor(cw / 3)), 2, shade(glass, 0.45));
      if (lit && ((r * 7 + c * 3) % 5 === 0)) R(ctx, wx, wy, cw, ch, '#ffe9a0');
    }
  }
}

function doorAt(ctx, px, py, kind, t) {
  if (kind === 'glass') {
    R(ctx, px, py, 16, 16, '#5a5f6b');
    R(ctx, px + 1, py + 2, 7, 14, '#a8dcf5'); R(ctx, px + 8, py + 2, 7, 14, '#a8dcf5');
    R(ctx, px + 2, py + 3, 2, 5, '#e0f4ff'); R(ctx, px + 9, py + 3, 2, 5, '#e0f4ff');
    R(ctx, px + 7, py + 2, 2, 14, '#3b3f48');
  } else if (kind === 'curtain') {
    R(ctx, px, py, 16, 16, '#3a2512');
    R(ctx, px + 1, py + 2, 14, 14, '#a51f2c');
    for (let i = 2; i < 15; i += 3) R(ctx, px + i, py + 2, 1, 14, '#7a1520');
  } else if (kind === 'noren') {
    R(ctx, px, py, 16, 16, '#3a2512');
    R(ctx, px + 1, py + 6, 14, 10, '#f6e7c8');
    R(ctx, px, py + 1, 16, 6, '#2a3a7a');
    for (let i = 3; i < 16; i += 5) R(ctx, px + i, py + 1, 1, 6, '#3a2512');
  } else if (kind === 'shutter') {
    R(ctx, px, py, 16, 16, '#5a5f6b');
    for (let y = 1; y < 16; y += 2) R(ctx, px + 1, py + y, 14, 1, '#8d939e');
  } else {
    R(ctx, px + 1, py, 14, 16, '#5a3a20'); R(ctx, px + 2, py + 1, 12, 15, '#9b6638');
    R(ctx, px + 11, py + 8, 2, 2, '#ffd23f');
  }
  // door mat
  R(ctx, px + 2, py + 15, 12, 1, 'rgba(0,0,0,0.25)');
}

function signBoard(ctx, b, x, y, w, h, opt = {}) {
  if (b.logo) {
    drawLogo(ctx, b.logo, x, y, w, h, { board: true, lights: opt.lights, bg: b.signBg, frame: opt.frame });
    return;
  }
  const s = b.sign || { text: b.name || '' };
  R(ctx, x, y, w, h, opt.frame || '#2a2d36');
  R(ctx, x + 1, y + 1, w - 2, h - 2, s.bg || '#ffffff');
  const size = s.size || (h >= 16 ? 12 : 10);
  let label = s.text || '';
  const tw = measure(ctx, label, size);
  const scale = tw > w - 6 ? (w - 6) / tw : 1;
  ctx.save();
  ctx.translate(x + w / 2, y + Math.round((h - size) / 2));
  ctx.scale(scale, 1);
  text(ctx, label, 0, 0, { size, align: 'center', color: s.color || '#20232a', shadow: null });
  ctx.restore();
}

export function drawBuilding(ctx, b, px, py, t = 0) {
  const W = b.w * TILE, H = b.h * TILE;
  const wall = b.wall || '#d8d2c4';
  const roof = b.roof || shade(wall, -0.35);
  const doorPx = px + (b.door ?? Math.floor(b.w / 2)) * TILE;
  const doorPy = py + H - TILE;
  const kind = b.kind || 'office';

  // ground shadow
  R(ctx, px + 2, py + H - 2, W, 3, 'rgba(0,0,0,0.25)');

  if (kind === 'tower' || kind === 'office' || kind === 'hotel') {
    const roofH = kind === 'tower' ? 10 : 8;
    R(ctx, px, py, W, H, wall);
    R(ctx, px, py, W, roofH, roof);
    R(ctx, px, py + roofH - 2, W, 2, shade(roof, -0.25));
    R(ctx, px + 2, py + 1, W - 4, 1, shade(roof, 0.3));
    // side shading
    R(ctx, px + W - 4, py + roofH, 4, H - roofH, shade(wall, -0.15));
    R(ctx, px, py + roofH, 2, H - roofH, shade(wall, 0.12));
    const signH = b.signH || (kind === 'tower' ? 24 : 18);
    const signW = Math.min(W - 12, b.signW || W - 16);
    const sx = px + Math.round((W - signW) / 2), sy = py + roofH + 3;
    if (kind === 'tower') {
      // vertical glass curtain wall
      for (let x = px + 6; x < px + W - 6; x += 8) {
        R(ctx, x, sy + signH + 4, 6, H - roofH - signH - 30, b.glass || '#6fa8dc');
        R(ctx, x + 1, sy + signH + 5, 2, H - roofH - signH - 32, shade(b.glass || '#6fa8dc', 0.4));
      }
    } else {
      windowsGrid(ctx, px + 6, sy + signH + 4, W - 12, H - roofH - signH - 30, { glass: b.glass || '#8fd0ff', frame: shade(wall, 0.4), lit: kind === 'hotel' });
    }
    signBoard(ctx, b, sx, sy, signW, signH);
    // entrance canopy
    R(ctx, doorPx - 10, doorPy - 6, 36, 5, b.canopy || shade(roof, -0.1));
    R(ctx, doorPx - 10, doorPy - 2, 36, 1, 'rgba(0,0,0,0.3)');
    R(ctx, doorPx - 8, doorPy, 32, 16, shade(wall, -0.2));
    doorAt(ctx, doorPx, doorPy, b.doorKind || 'glass', t);
    R(ctx, doorPx - 7, doorPy + 2, 6, 12, b.glass || '#8fd0ff');
    R(ctx, doorPx + 17, doorPy + 2, 6, 12, b.glass || '#8fd0ff');
  } else if (kind === 'theater') {
    R(ctx, px, py + 6, W, H - 6, wall);
    // stepped crown
    R(ctx, px + 4, py, W - 8, 8, roof);
    R(ctx, px, py + 6, W, 4, shade(roof, -0.2));
    for (let x = px + 6; x < px + W - 6; x += 6) R(ctx, x, py + 2, 2, 2, '#fff6a8');
    const signH = b.signH || 30, signW = Math.min(W - 10, b.signW || W - 14);
    signBoard(ctx, b, px + (W - signW) / 2, py + 12, signW, signH, { lights: true });
    // marquee bulbs
    const my = py + 12 + signH + 3;
    R(ctx, px + 4, my, W - 8, 9, '#20232a');
    for (let x = px + 6; x < px + W - 6; x += 4) R(ctx, x, my + 3, 2, 2, Math.floor(t / 15 + x / 4) % 2 ? '#fff6a8' : '#ff9a3c');
    // posters
    const posterY = my + 14;
    const ph = Math.max(10, doorPy - posterY - 4);
    for (let x = px + 6; x < px + W - 10; x += 18) {
      if (Math.abs(x + 6 - (doorPx + 8)) < 18) continue;
      R(ctx, x, posterY, 12, ph, '#20232a');
      R(ctx, x + 1, posterY + 1, 10, ph - 2, ['#ffd23f', '#ff7eb6', '#5fd7ff'][(x >> 3) % 3]);
      R(ctx, x + 3, posterY + 3, 6, 4, '#ffffff');
    }
    R(ctx, doorPx - 16, doorPy - 4, 48, 4, '#20232a');
    doorAt(ctx, doorPx - 16, doorPy, b.doorKind || 'curtain', t);
    doorAt(ctx, doorPx, doorPy, b.doorKind || 'curtain', t);
    doorAt(ctx, doorPx + 16, doorPy, b.doorKind || 'curtain', t);
  } else if (kind === 'studio') {
    // arched warehouse roof
    for (let i = 0; i < 14; i++) {
      const inset = Math.round(14 - Math.sqrt(14 * 14 - (14 - i) * (14 - i)));
      R(ctx, px + inset, py + i, W - inset * 2, 1, i % 3 === 0 ? shade(roof, 0.15) : roof);
    }
    R(ctx, px, py + 14, W, H - 14, wall);
    for (let x = px + 4; x < px + W - 4; x += 8) R(ctx, x, py + 16, 1, H - 32, shade(wall, -0.08));
    const signH = b.signH || 26, signW = Math.min(W - 12, b.signW || 64);
    signBoard(ctx, b, px + (W - signW) / 2, py + 18, signW, signH);
    // big hangar door + people door
    R(ctx, px + 8, doorPy - 22, 40, 38, '#3b3f48');
    for (let y = doorPy - 21; y < doorPy + 16; y += 3) R(ctx, px + 9, y, 38, 2, '#8d939e');
    R(ctx, doorPx - 2, doorPy - 4, 20, 4, '#3b3f48');
    doorAt(ctx, doorPx, doorPy, b.doorKind || 'wood', t);
    if (b.onair !== false) { R(ctx, doorPx + 18, doorPy - 10, 12, 6, '#20232a'); R(ctx, doorPx + 19, doorPy - 9, 10, 4, Math.floor(t / 40) % 2 ? '#ff2b3a' : '#7a1f1f'); }
  } else if (kind === 'house') {
    // apartment: 2 floors with walkway
    R(ctx, px, py + 8, W, H - 8, wall);
    for (let i = 0; i < 10; i++) R(ctx, px - 2 + Math.floor(i / 3), py + i, W + 4 - Math.floor(i / 3) * 2, 1, i < 8 ? roof : shade(roof, -0.3));
    const mid = py + Math.floor(H / 2);
    R(ctx, px, mid - 2, W, 3, shade(wall, -0.3));
    R(ctx, px, mid + 1, W, 1, '#c0c4cc');
    for (let x = px + 6; x < px + W - 10; x += 22) {
      doorAt(ctx, x, mid - 18, 'wood', t);
      R(ctx, x + 18, mid - 14, 10, 8, '#8fd0ff'); R(ctx, x + 17, mid - 15, 12, 1, '#f4f4f4');
    }
    for (let x = px + 6; x < px + W - 10; x += 22) {
      if (Math.abs(x - doorPx) < 20) continue;
      R(ctx, x + 2, doorPy + 2, 12, 9, '#8fd0ff'); R(ctx, x + 1, doorPy + 1, 14, 1, '#f4f4f4');
    }
    // stairs
    for (let i = 0; i < 6; i++) R(ctx, px + W - 14 + i, mid + 2 + i * 3, 10, 2, '#9aa0aa');
    doorAt(ctx, doorPx, doorPy, b.doorKind || 'wood', t);
    if (b.sign) signBoard(ctx, b, px + 4, py + 12, Math.min(W - 8, 40), 12);
  } else if (kind === 'shop' || kind === 'bath' || kind === 'small') {
    const roofH = kind === 'small' ? 10 : 8;
    R(ctx, px, py, W, H, wall);
    if (kind === 'bath') {
      // tiled japanese roof
      for (let i = 0; i < 12; i++) R(ctx, px - 2 + Math.floor(i / 2), py + i, W + 4 - Math.floor(i / 2) * 2, 1, i % 3 === 2 ? shade(roof, -0.3) : roof);
      R(ctx, px + W / 2 - 8, py - 6, 16, 8, roof);
    } else {
      R(ctx, px, py, W, roofH, roof);
    }
    const stripeY = py + (kind === 'bath' ? 12 : roofH);
    if (b.stripes) b.stripes.forEach((c, i) => R(ctx, px, stripeY + i * 3, W, 3, c));
    const sy = stripeY + (b.stripes ? b.stripes.length * 3 + 2 : 2);
    const signH = b.signH || 14;
    signBoard(ctx, b, px + 4, sy, W - 8, signH);
    // shop windows
    const wy = sy + signH + 4;
    const wh = doorPy - wy + 12;
    if (wh > 6) {
      for (let x = px + 4; x < px + W - 4; x += 16) {
        if (x + 16 > doorPx && x < doorPx + 16) continue;
        R(ctx, x, wy, 14, wh, '#f4f4f4'); R(ctx, x + 1, wy + 1, 12, wh - 2, '#a8dcf5');
        R(ctx, x + 2, wy + 2, 3, wh - 4, '#e0f4ff');
      }
    }
    doorAt(ctx, doorPx, doorPy, b.doorKind || (kind === 'bath' || kind === 'small' ? 'noren' : 'glass'), t);
  } else if (kind === 'station') {
    R(ctx, px, py + 6, W, H - 6, wall);
    R(ctx, px - 2, py, W + 4, 8, roof);
    R(ctx, px - 2, py + 8, W + 4, 2, shade(roof, -0.3));
    // clock
    const cx = px + W / 2;
    R(ctx, cx - 7, py - 6, 14, 14, roof);
    R(ctx, cx - 5, py - 4, 10, 10, '#ffffff'); R(ctx, cx, py - 3, 1, 5, '#20232a'); R(ctx, cx, py + 1, 3, 1, '#20232a');
    const signW = Math.min(W - 16, b.signW || 80);
    signBoard(ctx, b, cx - signW / 2, py + 12, signW, 16);
    // arches
    for (let x = px + 6; x < px + W - 10; x += 20) {
      R(ctx, x, py + 32, 14, H - 36, shade(wall, -0.25));
      R(ctx, x + 1, py + 34, 12, H - 40, '#a8dcf5');
    }
    doorAt(ctx, doorPx, doorPy, 'glass', t);
    doorAt(ctx, doorPx + 16, doorPy, 'glass', t);
    doorAt(ctx, doorPx - 16, doorPy, 'glass', t);
  }

  if (b.decorate) b.decorate(ctx, px, py, t);
}
