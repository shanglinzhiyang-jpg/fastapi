// Tile registry and the built-in pixel-art tile set (all procedurally drawn).
//
// defineTile(id, {
//   solid: bool,          // blocks movement
//   obj: bool,            // transparent background, drawn on top of a floor tile
//   talkThrough: bool,    // you can talk to someone standing behind it (counters)
//   frames: n, speed: n,  // animation (speed = game frames per animation frame)
//   variants: n,          // random visual variants picked per map cell
//   draw(c, r, frame, variant)  // c = 16x16 canvas 2D ctx, r = seeded rng()
// })
//
// Map cells can stack tiles with "+", e.g. "floor_wood+desk" or "wall_white+poster".

import { TILE, makeCanvas, mulberry32, shade } from './util.js';

export const TILES = {};
const cache = new Map();

export function defineTile(id, def) {
  TILES[id] = { solid: false, obj: false, frames: 1, speed: 20, variants: 1, ...def, id };
  for (const k of cache.keys()) if (k.startsWith(id + '|')) cache.delete(k);
}

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function tileImage(id, frame = 0, variant = 0) {
  const key = id + '|' + frame + '|' + variant;
  let img = cache.get(key);
  if (img) return img;
  const def = TILES[id] || TILES.missing;
  const [cv, c] = makeCanvas(TILE, TILE);
  def.draw(c, mulberry32(strHash(id) + variant * 7919), frame, variant);
  cache.set(key, cv);
  return cv;
}

// ---------------------------------------------------------------- helpers
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
export const P = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
export function speckle(c, r, cols, n, x0 = 0, y0 = 0, w = 16, h = 16) {
  for (let i = 0; i < n; i++) P(c, x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), cols[Math.floor(r() * cols.length)]);
}
// Draw a pixel template: rows of chars, pal maps char -> color ('.' / missing = skip).
export function pix(c, rows, pal, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) P(c, ox + x, oy + y, col);
    }
  });
}
function disc(c, cx, cy, rad, col) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y <= rad * rad + rad * 0.6) P(c, cx + x, cy + y, col);
    }
  }
}
function shadowEllipse(c, cx, cy, rx, ry) {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    c.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

// ---------------------------------------------------------------- fallback
defineTile('missing', { solid: true, draw(c) { R(c, 0, 0, 16, 16, '#ff00ff'); R(c, 0, 0, 8, 8, '#000'); R(c, 8, 8, 8, 8, '#000'); } });
defineTile('void', { solid: true, draw(c) { R(c, 0, 0, 16, 16, '#000'); } });
defineTile('black', { solid: true, draw(c) { R(c, 0, 0, 16, 16, '#0d0d12'); } });

// ---------------------------------------------------------------- outdoor ground
defineTile('grass', {
  variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#62b35b');
    speckle(c, r, ['#55a34f', '#4f9a4a'], 14);
    speckle(c, r, ['#79c76c', '#86d277'], 6);
    if (v === 3) { P(c, 5, 6, '#fff'); P(c, 4, 6, '#ffe36e'); P(c, 11, 11, '#fff'); }
  },
});
defineTile('flowers', {
  variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#62b35b');
    speckle(c, r, ['#55a34f', '#4f9a4a'], 10);
    const cols = v ? ['#ff6f91', '#fff'] : ['#ffd23f', '#ff8fb1'];
    for (const [x, y, i] of [[3, 3, 0], [11, 5, 1], [6, 10, 1], [12, 12, 0], [2, 13, 1]]) {
      const pc = cols[i];
      P(c, x, y - 1, pc); P(c, x - 1, y, pc); P(c, x + 1, y, pc); P(c, x, y + 1, pc); P(c, x, y, '#ffe36e');
    }
  },
});
defineTile('path', {
  variants: 2,
  draw(c, r) { R(c, 0, 0, 16, 16, '#d9b77a'); speckle(c, r, ['#c9a66a', '#e6c88f', '#bf9b5f'], 18); },
});
defineTile('sand', { draw(c, r) { R(c, 0, 0, 16, 16, '#ecd9a0'); speckle(c, r, ['#e0c98a', '#f5e6b8'], 16); } });
defineTile('sidewalk', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#cfd0d6');
    R(c, 0, 7, 16, 1, '#b5b6be'); R(c, 0, 15, 16, 1, '#b5b6be');
    R(c, 7, 0, 1, 7, '#b5b6be'); R(c, 15, 8, 1, 7, '#b5b6be');
    R(c, 0, 0, 16, 1, '#dcdde2');
    speckle(c, r, ['#c3c4ca'], 6);
  },
});
defineTile('tactile', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#e8c43a');
    for (let y = 2; y < 16; y += 4) for (let x = 2; x < 16; x += 4) { R(c, x, y, 2, 2, '#f6dc6a'); P(c, x + 1, y + 1, '#c9a52a'); }
  },
});
defineTile('brick', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#8e4a37');
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let x = -4; x < 16; x += 8) {
        R(c, x + off + 1, row * 4 + 1, 7, 3, '#b8644a');
        R(c, x + off + 1, row * 4 + 1, 7, 1, '#c97a5e');
      }
    }
  },
});
defineTile('stone', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#a9adb7');
    R(c, 0, 0, 16, 1, '#8e929c'); R(c, 0, 8, 16, 1, '#8e929c'); R(c, 0, 0, 1, 16, '#8e929c'); R(c, 8, 0, 1, 16, '#8e929c');
    R(c, 1, 1, 7, 1, '#bcc0c9'); R(c, 9, 9, 7, 1, '#bcc0c9');
    speckle(c, r, ['#9a9ea8'], 6);
  },
});
function road(c, r) { R(c, 0, 0, 16, 16, '#4d5058'); speckle(c, r, ['#585b64', '#44474e'], 14); }
defineTile('road', { draw: road });
defineTile('road_line_h', { draw(c, r) { road(c, r); R(c, 2, 7, 10, 2, '#e8e6d8'); } });
defineTile('road_line_v', { draw(c, r) { road(c, r); R(c, 7, 2, 2, 10, '#e8e6d8'); } });
defineTile('road_edge_top', { draw(c, r) { road(c, r); R(c, 0, 0, 16, 1, '#e8e6d8'); } });
defineTile('road_edge_bottom', { draw(c, r) { road(c, r); R(c, 0, 15, 16, 1, '#e8e6d8'); } });
defineTile('crosswalk_h', { draw(c, r) { road(c, r); for (let y = 1; y < 16; y += 4) R(c, 1, y, 14, 2, '#ecebe4'); } });
defineTile('crosswalk_v', { draw(c, r) { road(c, r); for (let x = 1; x < 16; x += 4) R(c, x, 1, 2, 14, '#ecebe4'); } });
defineTile('water', {
  solid: true, frames: 2, speed: 40,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, '#3d7fd1');
    speckle(c, r, ['#3674c2'], 10);
    const o = f * 4;
    for (const [x, y] of [[1, 3], [9, 6], [4, 11], [12, 13]]) R(c, (x + o) % 16, y, 3, 1, '#8cc2f5');
  },
});
defineTile('canal', {
  solid: true, frames: 2, speed: 45,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, '#2f5f96');
    speckle(c, r, ['#2a5688', '#36699f'], 12);
    const o = f * 5;
    for (const [x, y] of [[2, 2], [10, 7], [5, 12]]) R(c, (x + o) % 16, y, 4, 1, '#6f9fd4');
  },
});
defineTile('bridge_v', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#b07a46');
    for (let y = 0; y < 16; y += 4) R(c, 2, y, 12, 1, '#8a5a30');
    R(c, 0, 0, 2, 16, '#6e4422'); R(c, 14, 0, 2, 16, '#6e4422');
    R(c, 1, 0, 1, 16, '#d8a46a'); R(c, 15, 0, 1, 16, '#8a5a30');
  },
});
defineTile('bridge_h', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#b07a46');
    for (let x = 0; x < 16; x += 4) R(c, x, 2, 1, 12, '#8a5a30');
    R(c, 0, 0, 16, 2, '#6e4422'); R(c, 0, 14, 16, 2, '#6e4422');
    R(c, 0, 1, 16, 1, '#d8a46a');
  },
});
defineTile('rail', {
  solid: true,
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#8b8577'); speckle(c, r, ['#7a7466', '#9c968a'], 30);
    for (let x = 1; x < 16; x += 5) R(c, x, 2, 3, 12, '#6b4a2e');
    R(c, 0, 4, 16, 2, '#c0c4cc'); R(c, 0, 10, 16, 2, '#c0c4cc');
    R(c, 0, 5, 16, 1, '#7e828a'); R(c, 0, 11, 16, 1, '#7e828a');
  },
});
defineTile('platform', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#bdbfc6'); speckle(c, r, ['#b0b2b9'], 8);
    R(c, 0, 12, 16, 3, '#e8c43a'); for (let x = 1; x < 16; x += 3) P(c, x, 13, '#c9a52a');
    R(c, 0, 15, 16, 1, '#ffffff');
  },
});

// ---------------------------------------------------------------- outdoor objects
defineTile('tree', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 14, 6, 2);
    R(c, 7, 10, 3, 5, '#7a4f2a'); R(c, 7, 10, 1, 5, '#94653a');
    const dark = v ? '#2f6b34' : '#2d5a2b', mid = v ? '#45944a' : '#3f8a3a', lite = v ? '#6cbc5c' : '#5fae4f';
    disc(c, 8, 6, 6, dark); disc(c, 8, 6, 5, mid);
    disc(c, 6, 4, 2, lite); P(c, 10, 5, lite); P(c, 11, 4, lite); P(c, 5, 8, lite);
  },
});
defineTile('sakura', {
  solid: true, obj: true,
  draw(c, r) {
    shadowEllipse(c, 8, 14, 6, 2);
    R(c, 7, 10, 3, 5, '#6e4428');
    disc(c, 8, 6, 6, '#d97aa0'); disc(c, 8, 6, 5, '#f2a7c3');
    disc(c, 6, 4, 2, '#ffd3e3'); speckle(c, r, ['#ffe8f0', '#e88fb2'], 10, 3, 1, 10, 9);
  },
});
defineTile('bush', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 13, 6, 2);
    disc(c, 8, 9, 5, '#2f6b34'); disc(c, 8, 9, 4, '#4a9a4a'); disc(c, 6, 7, 1, '#74c26a'); P(c, 10, 8, '#74c26a');
  },
});
defineTile('hedge', {
  solid: true,
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#2f6b34'); R(c, 0, 0, 16, 12, '#4a9a4a');
    speckle(c, r, ['#5fb35b', '#3f8a3a'], 30, 0, 0, 16, 12); R(c, 0, 0, 16, 1, '#74c26a');
  },
});
defineTile('fence', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 6, 16, 2, '#f2efe6'); R(c, 0, 11, 16, 2, '#f2efe6');
    for (const x of [1, 6, 11]) { R(c, x, 3, 3, 12, '#f8f6ef'); R(c, x + 2, 3, 1, 12, '#c9c4b5'); P(c, x + 1, 2, '#f8f6ef'); }
  },
});
defineTile('railing', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 5, 16, 2, '#9aa0aa'); R(c, 0, 5, 16, 1, '#d5d9e0');
    for (const x of [2, 10]) R(c, x, 5, 2, 10, '#7c828c');
    R(c, 0, 10, 16, 1, '#9aa0aa');
  },
});
defineTile('lamp', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 3, 1);
    R(c, 7, 4, 2, 11, '#5a5f6b'); R(c, 7, 4, 1, 11, '#7d8391');
    R(c, 6, 14, 4, 2, '#4a4e58');
    R(c, 5, 1, 6, 3, '#3b3f48'); R(c, 6, 3, 4, 1, '#fff2a8'); R(c, 6, 2, 4, 1, '#ffe36e');
  },
});
defineTile('bench', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 13, 7, 1);
    R(c, 1, 5, 14, 2, '#a86c3a'); R(c, 1, 8, 14, 3, '#c4884e'); R(c, 1, 8, 14, 1, '#dca26a');
    R(c, 2, 11, 2, 3, '#4a4e58'); R(c, 12, 11, 2, 3, '#4a4e58');
  },
});
defineTile('vending', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    const body = v ? '#2f6fd0' : '#d63a3a';
    R(c, 2, 0, 12, 16, shade(body, -0.35)); R(c, 3, 0, 10, 15, body); R(c, 3, 0, 10, 1, shade(body, 0.3));
    R(c, 4, 2, 8, 6, '#e8f2ff');
    const cans = ['#ff5d6c', '#ffd23f', '#5ee07a', '#5fd7ff', '#ff9a3c', '#b388ff'];
    for (let i = 0; i < 4; i++) { R(c, 4 + i * 2, 3, 1, 2, cans[i]); R(c, 4 + i * 2, 6, 1, 2, cans[i + 2]); }
    R(c, 4, 9, 5, 2, '#20232a'); R(c, 10, 9, 2, 3, '#c0c4cc'); R(c, 4, 12, 8, 2, '#20232a');
  },
});
defineTile('trash', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 4, 1);
    R(c, 4, 5, 8, 9, '#3a6fb0'); R(c, 4, 5, 2, 9, '#5a8fd0'); R(c, 3, 4, 10, 2, '#2a5a94'); R(c, 6, 4, 4, 1, '#20232a');
  },
});
defineTile('mailbox', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 7, 11, 2, 4, '#7a1f1f');
    R(c, 4, 2, 8, 10, '#d62f2f'); R(c, 4, 2, 2, 10, '#ef5a5a'); R(c, 4, 1, 8, 2, '#b02020');
    R(c, 6, 4, 4, 1, '#20232a'); R(c, 6, 7, 4, 2, '#ffffff'); P(c, 7, 7, '#d62f2f');
  },
});
defineTile('planter', {
  solid: true, obj: true,
  draw(c, r) {
    R(c, 1, 8, 14, 7, '#8a5a33'); R(c, 1, 8, 14, 1, '#b07a46');
    disc(c, 5, 7, 3, '#3f8a3a'); disc(c, 11, 7, 3, '#3f8a3a');
    for (const [x, y, col] of [[4, 5, '#ff6f91'], [7, 7, '#ffd23f'], [11, 5, '#ff6f91'], [12, 8, '#fff']]) P(c, x, y, col);
  },
});
defineTile('cone', {
  solid: true, obj: true,
  draw(c) {
    R(c, 4, 13, 8, 2, '#d0551f');
    for (let y = 4; y < 13; y++) { const w = 1 + Math.floor((y - 4) / 2); R(c, 8 - w, y, w * 2, 1, (y === 7 || y === 10) ? '#ffffff' : '#ff7a2f'); }
  },
});
defineTile('nobori', {
  solid: true, obj: true, variants: 4,
  draw(c, r, f, v) {
    const col = ['#d62f2f', '#2f6fd0', '#e8b818', '#2f9a4a'][v];
    R(c, 3, 0, 1, 16, '#c0c4cc');
    R(c, 4, 1, 8, 13, col); R(c, 4, 1, 8, 1, shade(col, 0.4));
    for (let y = 3; y < 13; y += 3) R(c, 7, y, 2, 2, '#ffffff');
  },
});
defineTile('sign_board', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 10, 2, 5, '#6e4428'); R(c, 11, 10, 2, 5, '#6e4428');
    R(c, 1, 2, 14, 9, '#6e4428'); R(c, 2, 3, 12, 7, '#d9b77a');
    R(c, 4, 5, 8, 1, '#8a5a33'); R(c, 4, 7, 6, 1, '#8a5a33');
  },
});
defineTile('bicycle', {
  solid: true, obj: true,
  draw(c) {
    for (const cx of [4, 12]) { for (let a = 0; a < 16; a++) P(c, Math.round(cx + Math.cos(a / 16 * 6.283) * 3), Math.round(11 + Math.sin(a / 16 * 6.283) * 3), '#2a2d36'); }
    R(c, 4, 8, 8, 1, '#d62f2f'); R(c, 7, 6, 1, 5, '#d62f2f'); R(c, 6, 6, 3, 1, '#2a2d36'); R(c, 11, 6, 2, 1, '#2a2d36');
  },
});

// ---------------------------------------------------------------- indoor floors
function planks(c, r, base, seam, light, horizontal = true) {
  R(c, 0, 0, 16, 16, base);
  for (let i = 0; i < 4; i++) {
    if (horizontal) {
      R(c, 0, i * 4 + 3, 16, 1, seam);
      R(c, 0, i * 4, 16, 1, light);
      const jx = (i * 7 + 3) % 16;
      R(c, jx, i * 4, 1, 3, seam);
    } else {
      R(c, i * 4 + 3, 0, 1, 16, seam);
      R(c, i * 4, 0, 1, 16, light);
      const jy = (i * 7 + 3) % 16;
      R(c, i * 4, jy, 3, 1, seam);
    }
  }
  speckle(c, r, [shade(base, -0.06)], 6);
}
defineTile('floor_wood', { draw(c, r) { planks(c, r, '#c48a52', '#a06c3c', '#d29a62'); } });
defineTile('floor_wood_dark', { draw(c, r) { planks(c, r, '#8a5a33', '#6e4428', '#9b6a40'); } });
defineTile('floor_stage', { draw(c, r) { planks(c, r, '#ddb06e', '#b88a4c', '#ecc488'); } });
defineTile('floor_tile', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#c9ccd4');
    R(c, 0, 0, 8, 8, '#eceef2'); R(c, 8, 8, 8, 8, '#eceef2'); R(c, 8, 0, 8, 8, '#dfe2e8'); R(c, 0, 8, 8, 8, '#dfe2e8');
    R(c, 0, 0, 16, 1, '#c3c6ce'); R(c, 0, 0, 1, 16, '#c3c6ce');
  },
});
defineTile('floor_marble', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#ecebe6');
    let x = Math.floor(r() * 16), y = 0;
    while (y < 16) { P(c, x, y, '#cfccc2'); x = (x + (r() < 0.5 ? 1 : -1) + 16) % 16; y++; }
    R(c, 0, 15, 16, 1, '#dad8d0'); R(c, 15, 0, 1, 16, '#dad8d0');
  },
});
function carpet(base) {
  return (c, r) => {
    R(c, 0, 0, 16, 16, base);
    speckle(c, r, [shade(base, -0.1), shade(base, 0.08)], 20);
  };
}
defineTile('floor_carpet_red', { draw: carpet('#b8343c') });
defineTile('floor_carpet_blue', { draw: carpet('#3a58a8') });
defineTile('floor_carpet_purple', { draw: carpet('#6b4a9a') });
defineTile('floor_carpet_green', { draw: carpet('#3d8a5a') });
defineTile('floor_carpet_gray', { draw: carpet('#6d7280') });
defineTile('floor_carpet_beige', { draw: carpet('#c9b48e') });
defineTile('floor_concrete', { draw(c, r) { R(c, 0, 0, 16, 16, '#9a9ca2'); speckle(c, r, ['#8d8f95', '#a8aab0'], 24); } });
defineTile('floor_studio', {
  variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#2e3038'); speckle(c, r, ['#34363f', '#292b32'], 14);
    if (v === 1) { R(c, 3, 7, 6, 2, '#e8c43a'); R(c, 5, 5, 2, 6, '#e8c43a'); }
  },
});
defineTile('floor_black', { draw(c, r) { R(c, 0, 0, 16, 16, '#18181c'); speckle(c, r, ['#202026'], 8); } });
defineTile('floor_checker', {
  draw(c) { R(c, 0, 0, 16, 16, '#f2f2f2'); R(c, 0, 0, 8, 8, '#1e1e24'); R(c, 8, 8, 8, 8, '#1e1e24'); },
});
defineTile('floor_tatami', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#c9c27a');
    for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#bdb56c');
    R(c, 0, 0, 16, 1, '#3d5a2a'); R(c, 0, 15, 16, 1, '#3d5a2a');
    speckle(c, r, ['#d4cd88'], 8);
  },
});
defineTile('exit_mat', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a2a2a'); R(c, 1, 1, 14, 14, '#a83a3a');
    for (let y = 3; y < 14; y += 3) R(c, 2, y, 12, 1, '#c25050');
  },
});
defineTile('stairs_up', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#9a9ca2');
    for (let i = 0; i < 4; i++) { R(c, 0, i * 4, 16, 3, shade('#c8cad0', -i * 0.08)); R(c, 0, i * 4 + 3, 16, 1, '#6d7078'); }
  },
});
defineTile('stairs_down', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a4c54');
    for (let i = 0; i < 4; i++) { R(c, 0, i * 4, 16, 3, shade('#9a9ca2', -(3 - i) * 0.12)); R(c, 0, i * 4 + 3, 16, 1, '#2a2c32'); }
  },
});

// ---------------------------------------------------------------- walls (themed)
export const WALL_THEMES = {
  white: '#e9e5dc', cream: '#efe2bf', blue: '#86aee0', navy: '#3d4f86', gray: '#a3a6ad',
  red: '#c25050', purple: '#9273bd', wood: '#a87449', dark: '#454559', orange: '#e9935a',
  green: '#86b882', pink: '#eeb0c3', black: '#26262e', yellow: '#ecd66a', brick: '#a85a42',
};
for (const [name, col] of Object.entries(WALL_THEMES)) {
  defineTile('wall_' + name, {
    solid: true,
    draw(c, r) {
      R(c, 0, 0, 16, 16, col);
      R(c, 0, 0, 16, 1, shade(col, 0.25));
      if (name === 'brick') {
        for (let row = 0; row < 3; row++) {
          const off = row % 2 ? 4 : 0;
          for (let x = -4; x < 16; x += 8) R(c, x + off, 1 + row * 4 + 3, 8, 1, shade(col, -0.25));
          for (let x = -4; x < 16; x += 8) R(c, x + off, 1 + row * 4, 1, 4, shade(col, -0.25));
        }
      } else if (name === 'wood') {
        for (let x = 3; x < 16; x += 4) R(c, x, 1, 1, 12, shade(col, -0.15));
      } else {
        R(c, 0, 4, 16, 1, shade(col, -0.05));
      }
      R(c, 0, 13, 16, 3, shade(col, -0.3));
      R(c, 0, 13, 16, 1, shade(col, -0.45));
    },
  });
  defineTile('walltop_' + name, {
    solid: true,
    draw(c) {
      const d = shade(col, -0.6);
      R(c, 0, 0, 16, 16, d);
      R(c, 0, 15, 16, 1, shade(col, -0.2));
      R(c, 0, 0, 16, 1, shade(d, 0.1));
    },
  });
}

// ---------------------------------------------------------------- wall decorations (obj overlays on walls)
defineTile('window', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 10, '#f4f4f4'); R(c, 3, 3, 10, 8, '#8fd0ff');
    R(c, 3, 3, 4, 2, '#c8ecff'); R(c, 8, 3, 1, 8, '#f4f4f4'); R(c, 3, 7, 10, 1, '#f4f4f4');
    R(c, 2, 12, 12, 1, '#b8b8b8');
  },
});
defineTile('window_night', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 10, '#f4f4f4'); R(c, 3, 3, 10, 8, '#1d2650');
    P(c, 5, 4, '#fff'); P(c, 11, 6, '#ffe36e'); R(c, 8, 3, 1, 8, '#f4f4f4'); R(c, 3, 7, 10, 1, '#f4f4f4');
  },
});
defineTile('poster', {
  solid: true, obj: true, variants: 4,
  draw(c, r, f, v) {
    const bg = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#ff8a3d'][v];
    R(c, 4, 1, 8, 11, '#20232a'); R(c, 4, 1, 8, 10, bg);
    disc(c, 8, 5, 2, v % 2 ? '#ffffff' : '#d62f2f');
    R(c, 5, 8, 6, 1, '#20232a'); R(c, 5, 10, 4, 1, '#20232a');
  },
});
defineTile('poster_wide', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    const bg = ['#2f6fd0', '#d62f2f', '#2f9a4a'][v];
    R(c, 1, 2, 14, 9, '#ffffff'); R(c, 2, 3, 12, 7, bg);
    R(c, 3, 4, 3, 3, '#ffd23f'); R(c, 7, 4, 6, 1, '#fff'); R(c, 7, 6, 5, 1, '#fff'); R(c, 7, 8, 6, 1, '#fff');
  },
});
defineTile('clock', {
  solid: true, obj: true,
  draw(c) { disc(c, 8, 6, 4, '#20232a'); disc(c, 8, 6, 3, '#ffffff'); R(c, 8, 4, 1, 3, '#20232a'); R(c, 8, 6, 2, 1, '#d62f2f'); },
});
defineTile('painting', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 9, '#c9a227'); R(c, 3, 3, 10, 7, '#8fd0ff');
    R(c, 3, 7, 10, 3, '#4a9a4a'); disc(c, 10, 5, 1, '#ffd23f'); R(c, 5, 5, 3, 2, '#ffffff');
  },
});
defineTile('whiteboard', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 2, 14, 10, '#9aa0aa'); R(c, 2, 3, 12, 8, '#ffffff');
    R(c, 3, 4, 7, 1, '#2f6fd0'); R(c, 3, 6, 9, 1, '#20232a'); R(c, 3, 8, 5, 1, '#d62f2f'); R(c, 2, 11, 12, 1, '#6d7078');
  },
});
defineTile('mirror', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 1, 14, 12, '#c9a227'); R(c, 3, 3, 10, 8, '#cfe8f5'); R(c, 4, 4, 3, 1, '#ffffff'); R(c, 4, 5, 1, 2, '#ffffff');
    for (const [x, y] of [[2, 2], [7, 1], [13, 2], [1, 7], [14, 7], [2, 12], [13, 12]]) R(c, x, y, 1, 1, '#fff6a8');
  },
});
defineTile('onair', {
  solid: true, obj: true, frames: 2, speed: 40,
  draw(c, r, f) {
    R(c, 2, 4, 12, 6, '#20232a'); R(c, 3, 5, 10, 4, f ? '#ff2b3a' : '#7a1f1f');
    if (f) { R(c, 4, 6, 2, 2, '#ffd0d4'); R(c, 7, 6, 2, 2, '#ffd0d4'); R(c, 10, 6, 2, 2, '#ffd0d4'); }
  },
});
defineTile('exit_sign', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 7, '#1fa35a'); R(c, 3, 3, 10, 5, '#2fd07a');
    R(c, 5, 3, 2, 2, '#ffffff'); R(c, 5, 5, 3, 1, '#ffffff'); R(c, 4, 6, 2, 1, '#ffffff'); R(c, 7, 6, 1, 2, '#ffffff'); R(c, 10, 3, 2, 5, '#20232a');
  },
});
defineTile('tv_wall', {
  solid: true, obj: true, frames: 3, speed: 24,
  draw(c, r, f) {
    R(c, 1, 2, 14, 10, '#20232a');
    const scr = [['#5fd7ff', '#ffd23f'], ['#ff7eb6', '#5ee07a'], ['#ffffff', '#ff8a3d']][f];
    R(c, 2, 3, 12, 8, scr[0]); R(c, 4 + f * 2, 5, 4, 4, scr[1]);
    R(c, 6, 12, 4, 1, '#4a4e58');
  },
});
defineTile('shelf_wall', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 5, 14, 1, '#6e4428'); R(c, 1, 11, 14, 1, '#6e4428');
    const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#9273bd'];
    for (let i = 0; i < 5; i++) { R(c, 2 + i * 3, 1, 2, 4, cols[i]); R(c, 2 + i * 3, 7, 2, 4, cols[4 - i]); }
  },
});

// ---------------------------------------------------------------- doors
defineTile('door_wood', {
  draw(c) {
    R(c, 1, 0, 14, 16, '#5a3a20'); R(c, 2, 1, 12, 15, '#9b6638'); R(c, 3, 2, 10, 5, '#a8733f'); R(c, 3, 9, 10, 6, '#a8733f');
    R(c, 11, 8, 2, 2, '#ffd23f');
  },
});
defineTile('door_glass', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7d8391'); R(c, 1, 1, 7, 15, '#a8dcf5'); R(c, 8, 1, 7, 15, '#a8dcf5');
    R(c, 2, 2, 2, 6, '#e0f4ff'); R(c, 9, 2, 2, 6, '#e0f4ff'); R(c, 7, 1, 2, 15, '#5a5f6b');
  },
});
defineTile('door_metal', {
  draw(c) {
    R(c, 1, 0, 14, 16, '#3b3f48'); R(c, 2, 1, 12, 15, '#8d939e'); R(c, 2, 1, 12, 1, '#b8bec8');
    R(c, 4, 4, 8, 3, '#5a5f6b'); R(c, 11, 9, 2, 2, '#20232a');
  },
});
defineTile('elevator', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a5f6b'); R(c, 1, 2, 14, 14, '#b8bec8'); R(c, 7, 2, 2, 14, '#7d8391');
    R(c, 6, 0, 4, 2, '#ffd23f');
  },
});
defineTile('shutter', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#8d939e'); for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#6d7380'); },
});

// ---------------------------------------------------------------- furniture (obj)
defineTile('counter', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 7, '#e2cfa8'); R(c, 0, 1, 16, 1, '#f2e2c0');
    R(c, 0, 8, 16, 8, '#8f6a48'); R(c, 0, 8, 16, 1, '#6e4f34'); R(c, 0, 15, 16, 1, '#5a3f28');
    R(c, 3, 10, 10, 1, '#a07a56');
  },
});
defineTile('counter_white', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 7, '#f6f6f8'); R(c, 0, 1, 16, 1, '#ffffff');
    R(c, 0, 8, 16, 8, '#3f5fa8'); R(c, 0, 8, 16, 1, '#2c4683'); R(c, 0, 12, 16, 1, '#6d8bd0'); R(c, 0, 15, 16, 1, '#223566');
  },
});
defineTile('register', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 7, '#e2cfa8'); R(c, 0, 8, 16, 8, '#8f6a48'); R(c, 0, 8, 16, 1, '#6e4f34');
    R(c, 3, 0, 9, 6, '#3b3f48'); R(c, 4, 1, 7, 2, '#5ee07a'); R(c, 4, 4, 7, 1, '#9aa0aa');
  },
});
defineTile('desk', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 0, 2, 16, 8, '#b98552'); R(c, 0, 2, 16, 1, '#d6a06a'); R(c, 0, 10, 16, 3, '#8a5a33');
    R(c, 1, 13, 2, 2, '#5a3a20'); R(c, 13, 13, 2, 2, '#5a3a20');
    R(c, 3, 4, 5, 3, '#ffffff'); R(c, 4, 5, 3, 1, '#9aa0aa');
  },
});
defineTile('desk_pc', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 0, 4, 16, 6, '#b98552'); R(c, 0, 4, 16, 1, '#d6a06a'); R(c, 0, 10, 16, 3, '#8a5a33');
    R(c, 4, 0, 8, 6, '#20232a'); R(c, 5, 1, 6, 4, '#5fd7ff'); R(c, 6, 2, 2, 1, '#ffffff'); R(c, 7, 6, 2, 1, '#20232a');
    R(c, 4, 7, 8, 2, '#d5d9e0');
  },
});
defineTile('chair', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 4, 1);
    R(c, 4, 2, 8, 6, '#3b3f48'); R(c, 5, 3, 6, 4, '#5a5f6b');
    R(c, 4, 8, 8, 4, '#4a4e58'); R(c, 7, 12, 2, 2, '#20232a'); R(c, 5, 14, 6, 1, '#20232a');
  },
});
defineTile('seat', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 2, 14, 8, '#9e1f2a'); R(c, 2, 3, 12, 6, '#c8323f'); R(c, 2, 3, 12, 1, '#e05462');
    R(c, 1, 10, 14, 4, '#7a1520'); R(c, 0, 4, 1, 10, '#3b2a20'); R(c, 15, 4, 1, 10, '#3b2a20');
  },
});
function sofa(col) {
  return (c) => {
    shadowEllipse(c, 8, 14, 8, 1);
    R(c, 0, 2, 16, 6, shade(col, -0.25)); R(c, 0, 2, 16, 1, shade(col, 0.1));
    R(c, 0, 7, 16, 6, col); R(c, 0, 7, 16, 1, shade(col, 0.25)); R(c, 7, 7, 1, 6, shade(col, -0.2));
    R(c, 0, 13, 16, 1, shade(col, -0.45));
  };
}
defineTile('sofa', { solid: true, obj: true, draw: sofa('#c8323f') });
defineTile('sofa_blue', { solid: true, obj: true, draw: sofa('#3a58a8') });
defineTile('sofa_beige', { solid: true, obj: true, draw: sofa('#c9b48e') });
defineTile('table', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 1, 4, 14, 7, '#c48a52'); R(c, 1, 4, 14, 1, '#dca26a'); R(c, 1, 11, 14, 2, '#8a5a33');
    R(c, 3, 13, 2, 2, '#5a3a20'); R(c, 11, 13, 2, 2, '#5a3a20');
    R(c, 4, 6, 3, 3, '#ffffff'); R(c, 5, 7, 1, 1, '#8a5a33'); R(c, 10, 6, 3, 2, '#ffd23f');
  },
});
defineTile('table_white', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 1, 4, 14, 7, '#f6f6f8'); R(c, 1, 11, 14, 2, '#c3c6ce'); R(c, 3, 13, 2, 2, '#9aa0aa'); R(c, 11, 13, 2, 2, '#9aa0aa');
    R(c, 5, 6, 2, 3, '#5fd7ff'); R(c, 9, 6, 2, 3, '#ff7eb6');
  },
});
defineTile('plant', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 5, 10, 6, 5, '#b8643a'); R(c, 5, 10, 6, 1, '#d8845a');
    disc(c, 8, 6, 4, '#2f6b34'); disc(c, 8, 6, 3, '#4a9a4a');
    P(c, 6, 4, '#74c26a'); P(c, 9, 3, '#74c26a'); P(c, 4, 7, '#2f6b34'); P(c, 12, 7, '#2f6b34');
  },
});
defineTile('bookshelf', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e4428'); R(c, 1, 1, 14, 14, '#8a5a33');
    const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#9273bd', '#ff8a3d', '#ffffff'];
    for (let row = 0; row < 3; row++) {
      R(c, 1, 5 + row * 5, 14, 1, '#5a3a20');
      for (let i = 0; i < 6; i++) R(c, 2 + i * 2, 1 + row * 5 + (i % 2), 2, 4 - (i % 2), cols[(i + row * 2) % cols.length]);
    }
  },
});
defineTile('cabinet', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 16, '#7d8391'); R(c, 2, 1, 12, 14, '#a3a8b2');
    for (const y of [2, 7, 12]) { R(c, 2, y + 3, 12, 1, '#7d8391'); R(c, 6, y + 1, 4, 1, '#5a5f6b'); }
  },
});
defineTile('locker', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a6f8a'); R(c, 1, 1, 6, 15, '#7d95b5'); R(c, 9, 1, 6, 15, '#7d95b5');
    for (const x of [2, 10]) { R(c, x, 3, 4, 1, '#4a5a70'); R(c, x, 5, 4, 1, '#4a5a70'); R(c, x + 3, 9, 1, 2, '#20232a'); }
  },
});
defineTile('tv', {
  solid: true, obj: true, frames: 3, speed: 24,
  draw(c, r, f) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 2, 10, 12, 5, '#5a3a20'); R(c, 2, 10, 12, 1, '#8a5a33');
    R(c, 2, 1, 12, 9, '#20232a');
    const scr = ['#5fd7ff', '#ff7eb6', '#5ee07a'][f];
    R(c, 3, 2, 10, 7, scr); R(c, 4, 3, 3, 2, '#ffffff'); R(c, 8 - f, 5, 4, 3, '#ffd23f');
  },
});
defineTile('monitor', {
  solid: true, obj: true, frames: 4, speed: 16,
  draw(c, r, f) {
    R(c, 0, 0, 16, 14, '#20232a');
    const cols = ['#5fd7ff', '#5ee07a', '#ffd23f', '#ff7eb6'];
    for (let i = 0; i < 4; i++) R(c, 1 + (i % 2) * 7, 1 + Math.floor(i / 2) * 6, 6, 5, cols[(i + f) % 4]);
    R(c, 0, 14, 16, 2, '#3b3f48');
  },
});
defineTile('camera', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 8, 9, 1, 5, '#3b3f48'); R(c, 3, 13, 11, 1, '#3b3f48'); R(c, 4, 12, 2, 1, '#3b3f48'); R(c, 11, 12, 2, 1, '#3b3f48');
    R(c, 2, 2, 11, 7, '#20232a'); R(c, 3, 3, 9, 5, '#3b3f48'); R(c, 0, 3, 3, 5, '#4a4e58'); R(c, 0, 4, 2, 3, '#5fd7ff');
    R(c, 13, 3, 2, 3, '#ffd23f'); P(c, 11, 3, '#ff2b3a');
  },
});
defineTile('mic', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 3, 1);
    R(c, 7, 4, 2, 11, '#9aa0aa'); R(c, 7, 4, 1, 11, '#d5d9e0'); R(c, 5, 14, 6, 1, '#3b3f48');
    R(c, 6, 0, 4, 5, '#3b3f48'); R(c, 6, 0, 4, 1, '#7d8391'); R(c, 7, 1, 1, 2, '#9aa0aa');
  },
});
defineTile('spotlight', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 7, 8, 2, 7, '#3b3f48'); R(c, 4, 14, 8, 1, '#3b3f48');
    R(c, 4, 1, 8, 7, '#20232a'); R(c, 5, 2, 6, 5, '#4a4e58'); R(c, 6, 3, 4, 3, '#fff6a8'); R(c, 7, 4, 2, 1, '#ffffff');
  },
});
defineTile('speaker', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 0, 12, 16, '#20232a'); R(c, 3, 1, 10, 14, '#2e3038');
    disc(c, 8, 4, 2, '#4a4e58'); P(c, 8, 4, '#20232a'); disc(c, 8, 10, 3, '#4a4e58'); disc(c, 8, 10, 1, '#20232a');
  },
});
defineTile('piano', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 10, '#16161a'); R(c, 1, 1, 14, 2, '#3b3f48');
    R(c, 0, 10, 16, 4, '#ffffff'); for (let x = 1; x < 16; x += 2) R(c, x, 10, 1, 2, '#16161a');
    R(c, 0, 14, 16, 2, '#16161a');
  },
});
defineTile('curtain', {
  solid: true, variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#a51f2c');
    for (let x = v * 2; x < 16; x += 4) { R(c, x, 0, 1, 16, '#7a1520'); R(c, x + 2, 0, 1, 16, '#d0404e'); }
  },
});
defineTile('curtain_top', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a1520'); R(c, 0, 0, 16, 11, '#a51f2c');
    for (let x = 0; x < 16; x += 4) { R(c, x, 8, 4, 3, '#d0404e'); R(c, x + 1, 11, 2, 2, '#a51f2c'); }
    R(c, 0, 13, 16, 1, '#e8c43a'); for (let x = 0; x < 16; x += 2) P(c, x, 14, '#e8c43a');
  },
});
defineTile('rope', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 5, 3, 10, '#c9a227'); R(c, 1, 4, 3, 2, '#e8c43a'); R(c, 0, 14, 5, 2, '#a07f1a');
    for (let x = 4; x < 16; x++) P(c, x, 7 + Math.round(Math.sin((x - 4) / 12 * Math.PI) * 2), '#c8323f');
    for (let x = 4; x < 16; x++) P(c, x, 8 + Math.round(Math.sin((x - 4) / 12 * Math.PI) * 2), '#7a1520');
  },
});
defineTile('box', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 2, 4, 12, 10, '#c9955a'); R(c, 2, 4, 12, 3, '#ddb07a'); R(c, 7, 4, 2, 10, '#e8c890'); R(c, 2, 13, 12, 1, '#9b6c3c');
  },
});
defineTile('boxes', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 6, 9, 9, '#c9955a'); R(c, 0, 6, 9, 2, '#ddb07a'); R(c, 4, 6, 1, 9, '#e8c890');
    R(c, 7, 1, 9, 14, '#b98552'); R(c, 7, 1, 9, 2, '#d6a06a'); R(c, 11, 1, 1, 14, '#e8c890');
  },
});
defineTile('clothes_rack', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 1, 14, 1, '#9aa0aa'); R(c, 1, 1, 1, 14, '#9aa0aa'); R(c, 14, 1, 1, 14, '#9aa0aa'); R(c, 0, 14, 16, 1, '#5a5f6b');
    const cols = ['#d62f2f', '#ffd23f', '#2f6fd0', '#ff7eb6', '#2f9a4a'];
    for (let i = 0; i < 5; i++) { R(c, 2 + i * 2 + (i > 2 ? 1 : 0), 2, 2, 9, cols[i]); R(c, 2 + i * 2 + (i > 2 ? 1 : 0), 2, 2, 1, '#20232a'); }
  },
});
defineTile('makeup', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 3, 16, 7, '#f6f6f8'); R(c, 0, 10, 16, 4, '#d5d9e0'); R(c, 0, 14, 16, 1, '#9aa0aa');
    R(c, 3, 5, 2, 3, '#ff7eb6'); R(c, 7, 6, 3, 2, '#c9a227'); R(c, 12, 4, 2, 4, '#5fd7ff');
  },
});
defineTile('water_server', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 4, 6, 8, 9, '#f6f6f8'); R(c, 4, 6, 1, 9, '#d5d9e0'); R(c, 5, 0, 6, 6, '#8fd0ff'); R(c, 6, 1, 2, 4, '#c8ecff');
    P(c, 6, 9, '#2f6fd0'); P(c, 9, 9, '#d62f2f');
  },
});
defineTile('bed_top', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 16, '#8a5a33'); R(c, 2, 2, 12, 14, '#f6f6f8'); R(c, 3, 3, 10, 5, '#ffffff'); R(c, 3, 8, 10, 1, '#d5d9e0');
    R(c, 2, 10, 12, 6, '#5f8fd8'); R(c, 2, 10, 12, 1, '#8fb4ee');
  },
});
defineTile('bed_bottom', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 14, '#8a5a33'); R(c, 2, 0, 12, 12, '#5f8fd8'); R(c, 2, 4, 12, 1, '#4a78c0'); R(c, 2, 8, 12, 1, '#4a78c0');
    R(c, 1, 14, 14, 2, '#5a3a20');
  },
});
defineTile('kitchen', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 2, 16, 14, '#d5d9e0'); R(c, 0, 2, 16, 6, '#f6f6f8'); R(c, 2, 3, 8, 4, '#9aa0aa'); R(c, 3, 4, 6, 2, '#c8ecff');
    R(c, 12, 3, 2, 3, '#3b3f48'); R(c, 1, 9, 14, 6, '#c3c6ce'); R(c, 7, 11, 2, 1, '#5a5f6b');
  },
});
defineTile('fridge', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 0, 12, 16, '#c3c6ce'); R(c, 3, 0, 10, 15, '#f6f6f8'); R(c, 3, 6, 10, 1, '#c3c6ce'); R(c, 11, 2, 1, 3, '#9aa0aa'); R(c, 11, 8, 1, 4, '#9aa0aa');
  },
});
defineTile('table_low', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 13, 7, 1);
    R(c, 0, 4, 16, 8, '#8a5a33'); R(c, 1, 5, 14, 6, '#b98552'); R(c, 1, 5, 14, 1, '#d6a06a');
    R(c, 4, 6, 3, 2, '#f4a640'); R(c, 9, 7, 2, 2, '#ffffff');
  },
});
defineTile('shelf_goods', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#9aa0aa'); R(c, 1, 0, 14, 15, '#e8eaee');
    const sets = [['#d62f2f', '#ffd23f', '#ff8a3d'], ['#2f9a4a', '#ffffff', '#5fd7ff'], ['#ff7eb6', '#9273bd', '#ffd23f']][v];
    for (let row = 0; row < 3; row++) {
      R(c, 1, 4 + row * 5, 14, 1, '#7d8391');
      for (let i = 0; i < 4; i++) R(c, 2 + i * 3 + (row % 2), 1 + row * 5, 2, 3, sets[(i + row) % 3]);
    }
  },
});
defineTile('fridge_drinks', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a5f6b'); R(c, 1, 1, 14, 14, '#bfe6ff');
    const cols = ['#d62f2f', '#2f9a4a', '#ffd23f', '#2f6fd0', '#ff8a3d'];
    for (let row = 0; row < 3; row++) { R(c, 1, 5 + row * 5, 14, 1, '#9aa0aa'); for (let i = 0; i < 5; i++) R(c, 2 + i * 3, 2 + row * 5, 2, 3, cols[(i + row) % 5]); }
    R(c, 7, 1, 1, 14, '#9aa0aa');
  },
});
defineTile('magazine', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 4, 16, 12, '#8a5a33');
    const cols = ['#ff7eb6', '#ffd23f', '#5fd7ff', '#d62f2f', '#5ee07a'];
    for (let i = 0; i < 5; i++) { R(c, 1 + i * 3, 1 + (i % 2), 3, 8, cols[i]); R(c, 1 + i * 3, 3 + (i % 2), 3, 1, '#ffffff'); }
  },
});
defineTile('trophy', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e4428'); R(c, 1, 1, 14, 14, '#2a1f18');
    for (const [x, y] of [[3, 2], [9, 2], [6, 9]]) { R(c, x, y, 4, 3, '#e8c43a'); R(c, x + 1, y + 3, 2, 1, '#c9a227'); R(c, x, y + 4, 4, 1, '#c9a227'); P(c, x, y, '#fff6a8'); }
    R(c, 1, 7, 14, 1, '#6e4428');
  },
});
defineTile('drum_set', {
  solid: true, obj: true,
  draw(c) {
    disc(c, 8, 10, 4, '#d62f2f'); disc(c, 8, 10, 3, '#f6f6f8');
    disc(c, 3, 6, 2, '#c9a227'); disc(c, 13, 6, 2, '#c9a227'); disc(c, 8, 4, 2, '#d62f2f'); P(c, 8, 4, '#f6f6f8');
  },
});
defineTile('flower_stand', {
  solid: true, obj: true,
  draw(c) {
    R(c, 7, 9, 2, 7, '#6e4428'); R(c, 4, 15, 8, 1, '#6e4428');
    disc(c, 8, 5, 5, '#ff7eb6'); disc(c, 8, 5, 3, '#ffd3e3'); disc(c, 8, 5, 1, '#ffd23f');
    R(c, 6, 10, 4, 4, '#ffffff'); R(c, 7, 11, 2, 2, '#d62f2f');
  },
});
defineTile('director_chair', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 3, 2, 10, 4, '#20232a'); R(c, 4, 3, 8, 2, '#3b3f48');
    R(c, 3, 8, 10, 2, '#20232a'); R(c, 3, 2, 1, 13, '#c48a52'); R(c, 12, 2, 1, 13, '#c48a52');
    for (let i = 0; i < 5; i++) { P(c, 4 + i * 2, 10 + i, '#c48a52'); P(c, 11 - i * 2, 10 + i, '#c48a52'); }
  },
});
defineTile('lightstand_back', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 2, 16, 2, '#3b3f48');
    for (const x of [1, 6, 11]) { R(c, x, 4, 4, 4, '#20232a'); R(c, x + 1, 7, 2, 1, '#fff6a8'); }
  },
});
defineTile('green_screen', { solid: true, draw(c, r) { R(c, 0, 0, 16, 16, '#22b14c'); speckle(c, r, ['#1fa045'], 6); } });
defineTile('set_wall', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    const col = ['#ffd23f', '#5fd7ff', '#ff7eb6'][v];
    R(c, 0, 0, 16, 16, col); for (let x = 0; x < 16; x += 4) R(c, x, 0, 2, 16, shade(col, 0.25));
    R(c, 0, 13, 16, 3, shade(col, -0.35));
  },
});
defineTile('stage_edge', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#5a3a20'); R(c, 0, 0, 16, 3, '#ddb06e'); R(c, 0, 3, 16, 1, '#3a2512'); for (let x = 2; x < 16; x += 5) R(c, x, 7, 2, 2, '#fff6a8'); },
});
defineTile('kanban_takoyaki', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 1, 16, 12, '#20232a'); R(c, 1, 2, 14, 10, '#ff8a3d');
    disc(c, 5, 7, 3, '#8a4a20'); disc(c, 11, 7, 3, '#8a4a20'); P(c, 4, 6, '#5ee07a'); P(c, 10, 6, '#5ee07a'); R(c, 3, 5, 3, 1, '#ffd3a8'); R(c, 9, 5, 3, 1, '#ffd3a8');
  },
});
defineTile('lantern', {
  solid: true, obj: true,
  draw(c) {
    R(c, 7, 0, 2, 3, '#20232a'); R(c, 4, 3, 8, 11, '#d62f2f'); R(c, 3, 5, 10, 7, '#d62f2f');
    R(c, 4, 3, 8, 1, '#20232a'); R(c, 4, 13, 8, 1, '#20232a'); R(c, 6, 6, 4, 4, '#20232a'); R(c, 7, 7, 2, 2, '#d62f2f');
    R(c, 3, 6, 1, 4, '#ff5d6c');
  },
});
