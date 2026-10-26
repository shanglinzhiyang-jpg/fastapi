// Procedural 16x20 pixel characters.
//
//   const sheet = charSheet(look)          // cached
//   drawChar(ctx, sheet, dir, frame, x, y) // x,y = top-left of the 16x16 tile the character stands on
//   drawCharPart(ctx, sheet, dir, frame, sx, sy, sw, sh, dx, dy) // crop in 1x frame pixels (any sheet)
//   drawSeated(ctx, sheet, dir, x, y, seat) // sitting on a seat tile (the map does this by itself)
//
//   const hd = charSheetHD(look)           // same layout, native 32x40 frames (the map uses these)
//   drawFaceHD(ctx, look, x, y, scale)     // 32x24 face crop of the HD sheet (name tags, status)
//
// look = {
//   hair: 'short'|'long'|'bob'|'spiky'|'bald'|'afro'|'cap'|'twin'|'slick'|'mage'|'helmet'|'none',
//   hairColor, skin, top, bottom, shoes,          // css colors (or keys of HAIR / SKIN)
//   skirt: bool, jacket: bool, tie: color|null, glasses: false|true|'sun', beard: bool,
//   hat: color (cap/helmet color), blush: bool, glassesColor: color,
//   apron: true|color, kimono: true|color (crossed collar + obi of that color),
//   ribbon: color (HD hair bow: on each twin tail, or on the side of the head for
//           short/long/bob/spiky/slick/afro hair),
//   lashes: bool (HD; default: long/bob/twin hair or skirt, unless mage/bald hair or beard)
// }

import { makeCanvas, shade, mix } from './util.js';
import { histImg } from './world_hist.js'; // [R14-P] photo faces (assets/hist, assets/pol)

export const SKIN = { light: '#ffe0c4', fair: '#f6c9a0', tan: '#e0a878', brown: '#b97a50', dark: '#8a5a3a', green: '#6fbf4a' };
export const HAIR = {
  black: '#2a2430', brown: '#6b4226', blonde: '#e8c45a', red: '#c0452f', silver: '#c8ccd4',
  pink: '#ff7eb6', blue: '#3a6fd8', green: '#3f9a5a', purple: '#8a5ac8', orange: '#e8873a', white: '#f2f2f2',
};
export const HAIR_STYLES = ['short', 'long', 'bob', 'spiky', 'twin', 'slick', 'afro', 'cap', 'bald', 'mage', 'helmet'];

const OUT = '#22202a';
const SW = 16, SH = 20;

// ---------------------------------------------------------------- head bases
const HEAD = {
  down: {
    1: '....oooooooo....',
    2: '...osssssssso...',
    3: '..osssssssssso..',
    4: '..osssssssssso..',
    5: '..osssssssssso..',
    6: '..ossessssesso..',
    7: '..ossessssesso..',
    8: '..osksssssskso..',
    9: '...osssssssso...',
    10: '....oooooooo....',
  },
  left: {
    1: '....oooooooo....',
    2: '...osssssssso...',
    3: '..osssssssssso..',
    4: '..osssssssssso..',
    5: '..osssssssssso..',
    6: '..osesssssssso..',
    7: '..osesssssssso..',
    8: '..okssssssssso..',
    9: '...osssssssso...',
    10: '....oooooooo....',
  },
  up: {
    1: '....oooooooo....',
    2: '...osssssssso...',
    3: '..osssssssssso..',
    4: '..osssssssssso..',
    5: '..osssssssssso..',
    6: '..osssssssssso..',
    7: '..osssssssssso..',
    8: '..osssssssssso..',
    9: '...osssssssso...',
    10: '....oooooooo....',
  },
};

// ---------------------------------------------------------------- bodies
const BODY_TOP = {
  down: {
    11: '...occcccccco...',
    12: '..occcccccccco..',
    13: '..oCccccccccCo..',
    14: '..osoccccccoso..',
  },
  up: {
    11: '...occcccccco...',
    12: '..occcccccccco..',
    13: '..oCccccccccCo..',
    14: '..osoccccccoso..',
  },
  left: {
    11: '....occcccco....',
    12: '...occcccccco...',
    13: '...occCCcccco...',
    14: '...ocosccccco...',
  },
};
const PANTS = {
  down: {
    stand: { 15: '...oppppppppo...', 16: '...oppppppppo...', 17: '...opppoopppo...', 18: '...offfoofffo...', 19: '....ooo..ooo....' },
    walk: { 15: '...oppppppppo...', 16: '...oppppppppo...', 17: '...offfoopppo...', 18: '....ooo.offfo...', 19: '.........ooo....' },
  },
  left: {
    stand: { 15: '....opppppppo...', 16: '....opppppppo...', 17: '....oppppppo....', 18: '...offffffo.....', 19: '...oooooooo.....' },
    walk: { 15: '....opppppppo...', 16: '...oppppppppo...', 17: '..oppo..oppo....', 18: '.offo...offo....', 19: '.ooo....ooo.....' },
  },
};
const SKIRT = {
  down: {
    stand: { 15: '...oppppppppo...', 16: '..oppppppppppo..', 17: '..oooooooooooo..', 18: '....oso..oso....', 19: '....ofo..ofo....' },
    walk: { 15: '...oppppppppo...', 16: '..oppppppppppo..', 17: '..oooooooooooo..', 18: '....ofo..oso....', 19: '....ooo..ofo....' },
  },
  left: {
    stand: { 15: '....opppppppo...', 16: '...opppppppppo..', 17: '...ooooooooooo..', 18: '......oso.......', 19: '.....offo.......' },
    walk: { 15: '....opppppppo...', 16: '...opppppppppo..', 17: '...ooooooooooo..', 18: '....oso..oso....', 19: '...offo.offo.....' },
  },
};

// ---------------------------------------------------------------- hair overlays
// '.' keeps what is underneath. Rows not listed are untouched.
const FULL_BACK = { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..ohhhhhhhhhho..', 6: '..ohhhhhhhhhho..', 7: '..ohhhhhhhhhho..', 8: '..oHhhhhhhhhHo..', 9: '...ohhhhhhhho...' };
const HAIRS = {
  none: { down: {}, left: {}, up: {} },
  short: {
    down: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..ohhhhsshhhho..', 6: '..oh........ho..', 7: '..oH........Ho..' },
    left: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..oshhhhhhhhho..', 6: '........hhhhho..', 7: '.........hhhho..', 8: '..........hHho..', 9: '...........ho...' },
    up: FULL_BACK,
  },
  slick: {
    down: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..oHhhhhhhhhHo..', 5: '..oh........ho..' },
    left: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..oHhhhhhhhhho..', 5: '........hhhhho..', 6: '........hhhhho..', 7: '.........hhhho..', 8: '..........hHho..' },
    up: FULL_BACK,
  },
  long: {
    down: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..ohhhhsshhhho..', 6: '..oh........ho..', 7: '..oh........ho..', 8: '.ohh........hho.', 9: '.ohh........hho.', 10: '.ohho......ohho.', 11: '.ohho......ohho.', 12: '.oHHo......oHHo.', 13: '..oo........oo..' },
    left: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..oshhhhhhhhho..', 6: '........hhhhho..', 7: '........hhhhho..', 8: '.......hhhhhho..', 9: '.......hhhhhho..', 10: '......ohhhhhho..', 11: '......ohhhhhho..', 12: '......oHHHHHHo..', 13: '.......oooooo...' },
    up: { ...FULL_BACK, 9: '..ohhhhhhhhhho..', 10: '..ohhhhhhhhhho..', 11: '..ohhhhhhhhhho..', 12: '..oHhhhhhhhhHo..', 13: '...oooooooooo...' },
  },
  bob: {
    down: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..ohhhhhhhhhho..', 6: '..oh........ho..', 7: '..oh........ho..', 8: '.ohh........hho.', 9: '.oHHh......hHHo.', 10: '..ooo......ooo..' },
    left: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..ohhhhhhhhhho..', 6: '......hhhhhhho..', 7: '......hhhhhhho..', 8: '......hhhhhhho..', 9: '.....oHHHHHHHo..', 10: '.....oooooooo...' },
    up: { ...FULL_BACK, 9: '..ohhhhhhhhhho..', 10: '..oHHHHHHHHHHo..', 11: '...oooooooooo...' },
  },
  spiky: {
    down: { 0: '...o.o.oo.o.o...', 1: '..ohohohhohoho..', 2: '..ohhhhhhhhhho..', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhho..', 5: '..ohhshhhhshho..', 6: '..oh........ho..' },
    left: { 0: '....o.o.o.o.o...', 1: '...ohohohohoho..', 2: '..ohhhhhhhhhhoo.', 3: '..ohhhhhhhhhhho.', 4: '..ohhhhhhhhhho..', 5: '..oshhhhhhhhho..', 6: '........hhhhho..', 7: '.........hhhho..', 8: '..........hHho..' },
    up: { 0: '...o.o.oo.o.o...', 1: '..ohohohhohoho..', ...FULL_BACK, 2: '..ohhhhhhhhhho..' },
  },
  twin: {
    down: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: 'oooohhhhhhhhoooo', 5: 'ohhhhhhsshhhhhho', 6: 'ohho........ohho', 7: 'ohho........ohho', 8: 'ohho........ohho', 9: '.ohho......ohho.', 10: '.ohho......ohho.', 11: '.oHHo......oHHo.', 12: '..oo........oo..' },
    left: { 2: '...ohhhhhhhho...', 3: '..ohhhhhhhhhho..', 4: '..ohhhhhhhhhhooo', 5: '..oshhhhhhhhhhho', 6: '........hhhhhhho', 7: '...........ohhho', 8: '...........ohhho', 9: '...........ohhho', 10: '...........oHHo.', 11: '............oo..' },
    up: { ...FULL_BACK, 4: 'oooohhhhhhhhoooo', 5: 'ohhhhhhhhhhhhhho', 6: 'ohhhhhhhhhhhhhho', 7: 'ohhhhhhhhhhhhhho', 8: 'ohhoHhhhhhhHohho', 9: '.ohhohhhhhhohho.', 10: '.ohho......ohho.', 11: '.oHHo......oHHo.', 12: '..oo........oo..' },
  },
  afro: {
    down: { 0: '.oooooooooooooo.', 1: 'ohhhhhhhhhhhhhho', 2: 'ohhhhhhhhhhhhhho', 3: 'ohhhhhhhhhhhhhho', 4: 'ohhhhhhhhhhhhhho', 5: 'ohhhhhhhhhhhhhho', 6: 'ohho........ohho', 7: 'oHHo........oHHo', 8: '.oo..........oo.' },
    left: { 0: '..oooooooooooo..', 1: '.ohhhhhhhhhhhhho', 2: '.ohhhhhhhhhhhhho', 3: '.ohhhhhhhhhhhhho', 4: '.ohhhhhhhhhhhhho', 5: '.ohshhhhhhhhhhho', 6: '.......hhhhhhhho', 7: '.......hhhhhhhho', 8: '........HHHHHHo.', 9: '.........oooooo.' },
    up: { 0: '.oooooooooooooo.', 1: 'ohhhhhhhhhhhhhho', 2: 'ohhhhhhhhhhhhhho', 3: 'ohhhhhhhhhhhhhho', 4: 'ohhhhhhhhhhhhhho', 5: 'ohhhhhhhhhhhhhho', 6: 'ohhhhhhhhhhhhhho', 7: 'ohhhhhhhhhhhhhho', 8: '.oHHhhhhhhhhHHo.', 9: '..oooooooooooo..' },
  },
  cap: {
    down: { 1: '....oooooooo....', 2: '...oqqqqqqqqo...', 3: '..oqqqqqqqqqqo..', 4: '..oqqqqwwqqqqo..', 5: '.oQQQQQQQQQQQQo.', 6: '..oh........ho..' },
    left: { 1: '....oooooooo....', 2: '...oqqqqqqqqo...', 3: '..oqqqqqqqqqqo..', 4: '..oqqqqqqqqqqo..', 5: 'oQQQQqqqqqqqqo..', 6: 'oooo....hhhhho..', 7: '.........hhhho..', 8: '..........hho...' },
    up: { 1: '....oooooooo....', 2: '...oqqqqqqqqo...', 3: '..oqqqqqqqqqqo..', 4: '..oqqqqqqqqqqo..', 5: '..oQqqqqqqqqQo..', 6: '..ohhhhhhhhhho..', 7: '..ohhhhhhhhhho..', 8: '..oHhhhhhhhhHo..', 9: '...ohhhhhhhho...' },
  },
  bald: {
    down: { 3: '.....ww.........', 5: '..oh........ho..', 6: '..oH........Ho..' },
    left: { 3: '......ww........', 5: '...........hho..', 6: '..........hhho..', 7: '...........Hho..' },
    up: { 3: '.....ww.........', 6: '..ohhhhhhhhhho..', 7: '..oHhhhhhhhhHo..', 8: '...ohhhhhhhho...' },
  },
  mage: {
    down: { 0: '......oooo......', 1: '....oohhhhoo....', 2: '...osshhhhsso...', 3: '..osswssssssso..', 4: '..ohhsssssshho..', 5: '..ohh......hho..', 6: '..oH........Ho..' },
    left: { 0: '.....ooooooo....', 1: '....ohhhhhhho...', 2: '...osssoohhhoo..', 3: '..osswssssshho..', 4: '..osssssshhhho..', 5: '........hhhhho..', 6: '.........hhhho..', 7: '..........hHo...' },
    up: { 0: '......oooo......', 1: '....oohhhhoo....', 2: '...osshhhhsso...', 3: '..ossshhhhssso..', 4: '..ohhsshhsshho..', 5: '..ohhhhhhhhhho..', 6: '..ohhhhhhhhhho..', 7: '..ohhhhhhhhhho..', 8: '..oHhhhhhhhhHo..', 9: '...ohhhhhhhho...' },
  },
  helmet: {
    down: { 1: '....oooooooo....', 2: '...oqqqqqqqqo...', 3: '..oqqqqwwqqqqo..', 4: '..oqqqqqqqqqqo..', 5: '..oqvvvvvvvvqo..', 6: '..oqvVvvvvVvqo..', 7: '..oqvvvvvvvvqo..', 8: '..oqqqqqqqqqqo..', 9: '...oQQQQQQQQo...' },
    left: { 1: '....oooooooo....', 2: '...oqqqqqqqqo...', 3: '..oqqqqqqwqqqo..', 4: '..oqqqqqqqqqqo..', 5: '..ovvvvvqqqqqo..', 6: '..ovVvvvqqqqqo..', 7: '..ovvvvvqqqqqo..', 8: '..oqqqqqqqqqqo..', 9: '...oQQQQQQQQo...' },
    up: { 1: '....oooooooo....', 2: '...oqqqqqqqqo...', 3: '..oqqqqqqqqqqo..', 4: '..oqqqqqqqqqqo..', 5: '..oqqqqqqqqqqo..', 6: '..oqqqqqqqqqqo..', 7: '..oqqqqqqqqqqo..', 8: '..oqqqqqqqqqqo..', 9: '...oQQQQQQQQo...' },
  },
};

const ACC = {
  glasses: {
    down: { 5: '...gggggggggg...', 6: '...gw.wggw.wg...', 7: '...g...gg...g...', 8: '...gggggggggg...' },
    left: { 5: '..gggg..........', 6: '..g..gggggg.....', 7: '..g..g..........', 8: '..gggg..........' },
    up: { 6: '..g..........g..' },
  },
  sun: {
    down: { 5: '...gggggggggg...', 6: '...gzzzggzzzg...', 7: '...gzzzggzzzg...', 8: '....ggg..ggg....' },
    left: { 5: '..gggg..........', 6: '..gzzgggggg.....', 7: '..gzzg..........', 8: '...gg...........' },
    up: { 6: '..g..........g..' },
  },
  tie: { down: { 11: '.......tt.......', 12: '.......tt.......', 13: '.......tt.......', 14: '......tttt......' }, left: { 12: '.....t..........', 13: '.....t..........' }, up: {} },
  jacket: { down: { 11: '......wwww......', 12: '.......ww.......' }, left: { 11: '.....w..........' }, up: {} },
  apron: {
    down: { 11: '......a..a......', 12: '.....aaaaaa.....', 13: '.....aaaaaa.....', 14: '.....AAAAAA.....', 15: '....aaaaaaaa....', 16: '....aaaaaaaa....' },
    left: { 12: '....a...........', 13: '....a...........', 14: '....A...........', 15: '.....a..........', 16: '.....a..........' },
    up: { 11: '.....a....a.....', 14: '.....AAAAAA.....' },
  },
  kimono: { down: { 11: '......w..w......', 12: '.......ww.......', 14: '.....OOOOOO.....' }, left: { 11: '.....w..........', 14: '.......OOOOO....' }, up: { 14: '.....OOOOOO.....' } },
  beard: { down: { 8: '...sHHHHHHHHs...', 9: '...oHHHHHHHHo...', 10: '....oHHHHHHo....' }, left: { 8: '..oHHHHH........', 9: '...oHHHHH.......', 10: '....ooooo.......' }, up: {} },
};

function layer(c, rows, pal) {
  if (!rows) return;
  for (const [ry, row] of Object.entries(rows)) {
    const y = +ry;
    for (let x = 0; x < SW && x < row.length; x++) {
      let ch = row[x];
      if (ch === 'o') ch = 'o'; // tolerate cyrillic look-alike
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x, y, 1, 1);
    }
  }
}

function resolve(v, table, fallback) {
  if (!v) return fallback;
  return table[v] || v;
}

function palette(look) {
  const skin = hex(resolve(look.skin, SKIN, SKIN.fair));
  const hair = hex(resolve(look.hairColor, HAIR, HAIR.black));
  const top = hex(look.top || '#d64161');
  const bottom = hex(look.bottom || '#3a4a7a');
  const hat = hex(look.hat || '#d62f2f');
  const apron = hex(typeof look.apron === 'string' ? look.apron : '#f4f2ec');
  return {
    a: apron, A: shade(apron, -0.18), O: hex(typeof look.kimono === 'string' ? look.kimono : shade(top, -0.45)),
    o: OUT, e: OUT, w: '#ffffff',
    s: skin, S: shade(skin, -0.15), k: look.blush === false ? skin : shade(skin, -0.12),
    h: hair, H: shade(hair, -0.3),
    c: top, C: shade(top, -0.25),
    p: bottom, P: shade(bottom, -0.25),
    f: look.shoes || '#3b2a20',
    t: look.tie || '#d62f2f',
    q: hat, Q: shade(hat, -0.3),
    g: look.glassesColor || OUT, z: '#16161c',
    v: '#20232a', V: '#5fd7ff',
  };
}

function drawFrame(c, look, pal, dir, walk) {
  const lower = look.skirt ? SKIRT : PANTS;
  const ldir = dir === 'up' ? 'down' : dir;
  layer(c, BODY_TOP[dir], pal);
  layer(c, lower[ldir][walk ? 'walk' : 'stand'], pal);
  if (look.kimono) layer(c, ACC.kimono[dir], pal);
  else {
    if (look.jacket) layer(c, ACC.jacket[dir], pal);
    if (look.tie) layer(c, ACC.tie[dir], pal);
  }
  if (look.apron) layer(c, ACC.apron[dir], pal);
  layer(c, HEAD[dir], pal);
  if (look.beard) layer(c, ACC.beard[dir], pal);
  const hair = HAIRS[look.hair || 'short'] || HAIRS.short;
  layer(c, hair[dir], pal);
  if (look.glasses) layer(c, ACC[look.glasses === 'sun' ? 'sun' : 'glasses'][dir], pal);
}

function mirror(src) {
  const [cv, c] = makeCanvas(SW, SH);
  c.translate(SW, 0);
  c.scale(-1, 1);
  c.drawImage(src, 0, 0);
  return cv;
}

const sheetCache = new Map();

export function charSheet(look = {}) {
  const key = JSON.stringify(look);
  const hit = sheetCache.get(key);
  if (hit) return hit;
  const pal = palette(look);
  const sheet = {};
  for (const dir of ['down', 'up', 'left']) {
    const frames = [];
    for (const walk of [false, true]) {
      const [cv, c] = makeCanvas(SW, SH);
      drawFrame(c, look, pal, dir, walk);
      frames.push(cv);
    }
    // frames: 0 = stand, 1 = walk A, 2 = walk B
    if (dir === 'left') {
      sheet.left = [frames[0], frames[1], frames[1]];
    } else {
      // walk B: mirror only the legs of walk A (rows 15..19)
      const [cv, c] = makeCanvas(SW, SH);
      c.drawImage(frames[0], 0, 0, SW, 15, 0, 0, SW, 15);
      const m = mirror(frames[1]);
      c.drawImage(m, 0, 15, SW, 5, 0, 15, SW, 5);
      sheet[dir] = [frames[0], frames[1], cv];
    }
  }
  sheet.right = sheet.left.map(mirror);
  // left walk B: same pose, legs swapped by one pixel shift for variety
  sheetCache.set(key, sheet);
  return sheet;
}

// =========================================================================== HD
// Native 2x sheets (32x40 frames) used by the map: same layout as charSheet, and
// drawChar draws either kind at 16x20 units. Same person as the 1x sprite (same
// colours, big head and chibi body), drawn with 2x detail.
//
// Art is written as grids G(x0, y0, ...rows). Rows may use run lengths
// ('6.20p6.' = 6 dots, 20 'p', 6 dots); '.' keeps the pixel, '_' clears it and
// letters map to [part, tone] (HC; tones 0 base, 1 shadow, 2 line, 3 highlight).
// Layers are painted back to front with a depth (Z_*), then finishHD():
//   - outlines the silhouette: a pixel next to an empty one becomes OUT;
//   - draws inner lines: a pixel of an edge layer next to a pixel of a layer
//     behind it takes the line tone of its own colour (fringe over the face,
//     chin over the collar, hem over the trousers ...);
//   - shades the skin right under hair and hats.
// Optional look keys only the art reads: apron (true | colour), kimono (true |
// obi colour), ribbon (hair bow colour), lashes (bool, default by hair style /
// skirt), glassesColor.
const HW = 32, HH = 40;
const HC = {
  s: ['skin', 0], S: ['skin', 1], u: ['skin', 2], n: ['skin', 3],
  h: ['hair', 0], H: ['hair', 1], I: ['hair', 2], j: ['hair', 3],
  c: ['top', 0], C: ['top', 1], D: ['top', 2], y: ['top', 3],
  w: ['shirt', 0], W: ['shirt', 1], K: ['shirt', 2],
  p: ['bottom', 0], P: ['bottom', 1], B: ['bottom', 2], b: ['bottom', 3],
  f: ['shoes', 0], F: ['shoes', 1], N: ['shoes', 2], r: ['shoes', 3],
  t: ['tie', 0], T: ['tie', 1],
  q: ['hat', 0], Q: ['hat', 1], R: ['hat', 2], a: ['hat', 3],
  v: ['visor', 0], V: ['visor', 3],
  x: ['ribbon', 0], X: ['ribbon', 1],
  e: ['eye', 0], E: ['eye', 1], i: ['eye', 3],
  m: ['mouth', 0], k: ['blush', 0],
  g: ['frame', 0], z: ['lens', 0], Z: ['lens', 3],
  o: ['out', 0],
};
const PARTS = ['skin', 'hair', 'top', 'shirt', 'bottom', 'shoes', 'tie', 'hat', 'visor', 'ribbon', 'eye', 'mouth', 'blush', 'frame', 'lens', 'out', 'apron', 'obi'];
const PI = Object.fromEntries(PARTS.map((p, i) => [p, i]));
// parts that never get inner lines (small painted details)
const DETAIL = new Uint8Array(PARTS.length);
for (const p of ['eye', 'mouth', 'blush', 'frame', 'lens', 'out', 'visor']) DETAIL[PI[p]] = 1;
// char code -> part index (-1 none, -2 clear) and tone
const CPART = new Int8Array(128).fill(-1), CTONE = new Int8Array(128);
for (const ch in HC) { CPART[ch.charCodeAt(0)] = PI[HC[ch][0]]; CTONE[ch.charCodeAt(0)] = HC[ch][1]; }
CPART[95] = -2; // '_'
// depths, back to front; EDGE[z]: that layer draws inner lines
const Z_BACK = 1, Z_LEGS = 2, Z_BODY = 3, Z_HEAD = 4, Z_BEARD = 5, Z_HAIR = 6, Z_HAT = 7, Z_ARM = 8, Z_GLASS = 9;
const EDGE = [0, 1, 1, 1, 1, 0, 1, 1, 0, 0];

function rle(s) {
  if (!/\d/.test(s)) return s;
  let out = '', n = '';
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') n += ch;
    else { out += ch.repeat(n ? +n : 1); n = ''; }
  }
  return out;
}
// A grid compiles to flat [x, y, charCode] ops (painting is the hot path).
function G(x0, y0, ...rows) {
  const ops = [];
  rows.forEach((r, ry) => {
    r = rle(r);
    if (x0 + r.length > HW || (x0 === 0 && r.length !== HW)) console.error('sprites: bad HD row', y0 + ry, JSON.stringify(r), r.length);
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') ops.push(x0 + i, y0 + ry, r.charCodeAt(i));
  });
  return Int16Array.from(ops);
}

// --------------------------------------------------------------- colours
let normCtx = null;
// Any css colour -> '#rrggbb' (shade/mix need hex).
function hex(c) {
  if (typeof c !== 'string') return '#ff00ff';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map((ch) => ch + ch).join('').toLowerCase();
  if (!normCtx) normCtx = makeCanvas(1, 1)[1];
  normCtx.fillStyle = '#ff00ff';
  normCtx.fillStyle = c;
  const v = String(normCtx.fillStyle);
  if (v[0] === '#') return v;
  const m = v.match(/[\d.]+/g);
  return m ? '#' + m.slice(0, 3).map((n) => (Math.round(+n) & 255).toString(16).padStart(2, '0')).join('') : '#ff00ff';
}
const int = (h) => parseInt(h.slice(1), 16);
const lum = (h) => { const n = int(h); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };
// [base, shadow, line, highlight]; very dark colours get a brighter highlight
// so folds and edges still read.
function ramp(c, sh, ln, hi) {
  const L = lum(c);
  return [c, shade(c, L < 0.2 ? sh * 0.75 : sh), mix(shade(c, ln), OUT, 0.25), shade(c, L < 0.2 ? hi + 0.12 : hi)];
}
// Lighter tone that keeps the colour's saturation (HSL lightness). shade()
// fades toward white, which turns the shine on brown / red hair a dull grey.
function lighten(c, amt) {
  const n = int(c);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 0) {
    s = Math.min(1, d / (1 - Math.abs(2 * l - 1)));
    h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  }
  const L2 = l + (1 - l) * amt, C = (1 - Math.abs(2 * L2 - 1)) * s, X = C * (1 - Math.abs((h % 2) - 1)), m = L2 - C / 2;
  const rgb = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, '0')).join('');
}

function hdPalette(look) {
  const skin = hex(resolve(look.skin, SKIN, SKIN.fair));
  const hair = hex(resolve(look.hairColor, HAIR, HAIR.black));
  const top = hex(look.top || '#d64161');
  const eye = '#2a2233';
  const P = {
    skin: [skin, shade(skin, -0.13), mix(shade(skin, -0.42), '#6a2a2a', 0.15), shade(skin, 0.45)],
    hair: ramp(hair, -0.28, -0.55, 0.38),
    top: ramp(top, -0.2, -0.5, 0.28),
    shirt: ['#f8f8fa', '#d4d8e2', '#9aa0b0', '#ffffff'],
    bottom: ramp(hex(look.bottom || '#3a4a7a'), -0.22, -0.5, 0.25),
    shoes: ramp(hex(look.shoes || '#3b2a20'), -0.3, -0.6, 0.35),
    tie: ramp(hex(look.tie || '#d62f2f'), -0.25, -0.5, 0.3),
    hat: ramp(hex(look.hat || '#d62f2f'), -0.25, -0.5, 0.38),
    apron: ramp(hex(typeof look.apron === 'string' ? look.apron : '#f4f2ec'), -0.12, -0.42, 0.3),
    obi: ramp(hex(typeof look.kimono === 'string' ? look.kimono : shade(top, -0.45)), -0.25, -0.5, 0.3),
    ribbon: ramp(hex(look.ribbon || (lum(hair) > 0.75 ? '#ff6f9f' : '#f4f4f8')), -0.2, -0.5, 0.3),
    visor: ['#20232a', '#20232a', OUT, '#5fd7ff'],
    eye: [eye, mix(hair, eye, lum(hair) > 0.5 ? 0.6 : 0.35), eye, '#ffffff'],
    mouth: [mix(skin, '#7a2a3a', 0.6)],
    blush: [mix(skin, '#ff5f7f', 0.28)],
    frame: [hex(look.glassesColor || OUT)],
    lens: ['#16161c', '#16161c', '#16161c', '#7f93b8'],
    out: [OUT],
  };
  // hair shine keeps the hair's hue (warm brown, red ...); near-greys are unchanged
  P.hair[3] = mix(P.hair[3], lighten(hair, lum(hair) < 0.2 ? 0.5 : 0.38), 0.7);
  // packed little-endian RGBA (ImageData as Uint32)
  const abgr = (h) => { const n = int(h); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
  return PARTS.map((k) => Uint32Array.from([0, 1, 2, 3], (i) => abgr(P[k][i] || P[k][0])));
}

// --------------------------------------------------------------- pixel buffer
const NPX = HW * HH;
// per pixel: depth (-1 empty), colour, line colour, shadow colour, flags
// (1 = may take an inner line, 2 = plain skin: shaded under hair)
const BZ = new Int8Array(NPX), BC = new Uint32Array(NPX), BL = new Uint32Array(NPX), BS = new Uint32Array(NPX), BF = new Uint8Array(NPX);
const OUT32 = (0xff000000 | 0x2a2022) >>> 0; // OUT #22202a as RGBA little-endian
let PAL = null, IMG = null, IMG32 = null;

function paint(g, z, o) {
  if (!g) return;
  if (!(g instanceof Int16Array)) { for (const x of g) paint(x, z, o); return; }
  const dx = (o && o.dx) || 0, dy = (o && o.dy) || 0;
  const from = o && o.remap ? PI.top : -1, to = o && o.remap ? PI[o.remap] : -1;
  for (let n = 0; n < g.length; n += 3) {
    const x = g[n] + dx, y = g[n + 1] + dy;
    if (x < 0 || x >= HW || y < 0 || y >= HH) continue;
    const k = y * HW + x, code = g[n + 2];
    let part = CPART[code];
    if (part === -1) continue;
    if (part === -2) { BZ[k] = -1; continue; }
    if (part === from) part = to;
    const tone = CTONE[code], rp = PAL[part];
    BC[k] = rp[tone]; BL[k] = rp[2]; BS[k] = rp[1]; BZ[k] = z;
    BF[k] = (tone !== 2 && !DETAIL[part] ? 1 : 0) | (part === 0 && tone === 0 ? 2 : 0);
  }
}

// Resolve outlines / inner lines into canvas `c` (and mirrored into `cm`).
function finishHD(c, cm) {
  if (!IMG) { IMG = new ImageData(HW, HH); IMG32 = new Uint32Array(IMG.data.buffer); }
  const out = IMG32;
  out.fill(0);
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      const k = y * HW + x, z = BZ[k];
      if (z < 0) continue;
      const up = y > 0 ? BZ[k - HW] : -1, dn = y < HH - 1 ? BZ[k + HW] : -1;
      const lf = x > 0 ? BZ[k - 1] : -1, rt = x < HW - 1 ? BZ[k + 1] : -1;
      let col = BC[k];
      if (up < 0 || dn < 0 || lf < 0 || rt < 0) col = OUT32;
      else if ((BF[k] & 1) && EDGE[z] && (up < z || dn < z || lf < z || rt < z)) col = BL[k];
      else if ((BF[k] & 2) && (up === Z_HAIR || up === Z_HAT)) col = BS[k];
      out[k] = col;
    }
  }
  c.putImageData(IMG, 0, 0);
  if (!cm) return;
  for (let y = 0; y < HH; y++) {
    const row = y * HW;
    for (let x = 0; x < HW / 2; x++) { const t = out[row + x]; out[row + x] = out[row + HW - 1 - x]; out[row + HW - 1 - x] = t; }
  }
  cm.putImageData(IMG, 0, 0);
}

// --------------------------------------------------------------- head & face
const HEAD_SPAN = { 2: [10, 21], 3: [8, 23], 4: [6, 25], 5: [5, 26], 6: [5, 26], 18: [5, 26], 19: [6, 25], 20: [7, 24], 21: [9, 22] };
function headGrid(dir) {
  const rows = [];
  for (let y = 2; y <= 21; y++) {
    const [a, b] = HEAD_SPAN[y] || [4, 27];
    let row = '';
    for (let x = 0; x < HW; x++) {
      let ch = '.';
      if (x >= a && x <= b) {
        ch = 's';
        if (dir !== 'up' && y >= 11 && x >= b - 2 && x < b) ch = 'S';
        if (dir !== 'up' && y >= 19 && x >= b - 4 && x < b) ch = 'S';
        if (dir === 'up' && y >= 18 && x >= b - 3) ch = 'S';
      }
      row += ch;
    }
    rows.push(row);
  }
  return G(0, 2, ...rows);
}
const HEAD_HD = { down: headGrid('down'), up: headGrid('up'), left: headGrid('left') };
const NOSE_HD = G(3, 15, 's');
const EARS_HD = {
  down: G(3, 13, 's24.s', 'sS22.Ss', 'su22.us', 's24.s'),
  up: G(3, 13, 's24.s', 'sS22.Ss', 'sS22.Ss', 's24.s'),
  left: G(15, 13, 'SS', 'Su', 'Su', 'SS'),
};
const FACE_HD = {
  down: {
    eyes: G(10, 12, 'ee8.ee', 'ie8.ie', 'eE8.eE', 'EE8.EE'),
    lash: G(9, 12, 'e12.e'),
    brow: G(9, 10, 'III8.III'),
    browF: G(10, 10, 'II8.II'),
    mouth: G(15, 18, 'mm'),
    blush: G(7, 16, 'kkk12.kkk'),
  },
  left: {
    eyes: G(7, 12, 'ee', 'ie', 'eE', 'EE'),
    lash: G(9, 12, 'e'),
    brow: G(6, 10, 'III'),
    browF: G(7, 10, 'II'),
    mouth: G(6, 18, 'm'), // x5 is the profile outline
    blush: G(8, 16, 'kkk'),
  },
};

// --------------------------------------------------------------- body
const TORSO_HD = {
  down: G(0, 22,
    '6.6c8C6c6.',
    '5.9c4C8cC5.',
    '4.cy2cD14cD2cCc4.',
    '4.cy2cDy11c2CD2cCc4.',
    '4.cy2cDy11c2CD2cCc4.',
    '4.4CDy11c2CD4C4.',
    '4.3sSu12c2Cu3sS4.',
    '4.s3Su6cC5c2Cus3S4.',
    '5.3S16.3S5.'),
  up: G(0, 22,
    '6.20c6.',
    '5.21cC5.',
    '4.cy2cD14cD2cCc4.',
    '4.cy2cDy11c2CD2cCc4.',
    '4.cy2cDy11c2CD2cCc4.',
    '4.4CDy11c2CD4C4.',
    '4.3sSu12c2Cu3sS4.',
    '4.s3Su12c2Cus3S4.',
    '5.3S16.3S5.'),
  left: G(0, 22,
    '8.14c2C8.',
    '7.15c3C7.',
    '6.cy15c3C6.',
    '6.cy15c3C6.',
    '6.cy15c3C6.',
    '6.cy15c3C6.',
    '6.cy14c4C6.',
    '6.cy14c4C6.'),
};
// near arm of the side view: stand / swing forward / swing back
const ARM_HD = [
  G(11, 24, '.ycC.', 'DyccD', 'DyccD', 'DCCCD', 'usssu', 'ussSu', '.uuu.'),
  G(10, 24, '..ycC.', '.DyccD', 'DyccD.', 'DCCCD.', 'usssu.', 'ussSu.', '.uuu..'),
  G(11, 24, '.ycC..', 'DyccD.', '.DyccD', '.DCCCD', '.usssu', '.ussSu', '..uuu.'),
];
const JACKET_HD = {
  down: G(11, 22, 'DwwwwwwwwD', 'yDwWwwwWDC', '.yDwwwWDC.', '..yDwWDC..', '...yDDC...', '....yD....', '..........', '....yD....'),
  left: G(7, 22, '.Dww', 'yDwW', '.yDW', '.yD.', '.yD.', '.yD.', '.yD.', '.yD.'),
  up: G(13, 22, 'CCCCCC'),
};
const TIE_HD = {
  down: G(14, 22, '.tT.', '.TT.', '.tT.', '.tT.', 'ttTT', 'ttTT', '.tT.'),
  left: G(8, 23, 'tT', 'tT', 'tT', 'tT', '.T'),
  collar: G(12, 22, 'yy4.yy', '.D4.D.'),
};
// apron / obi: `top` chars painted in the apron / obi colour
const APRON_HD = {
  down: G(9, 22,
    '..c8.c..', '..c8.c..',
    '.DccccccccccD.', '.DcyccccccCCD.', '.DccccccccCCD.', '.DcccDDDDcCCD.', '.DccccccccCCD.',
    'DDDDDDDDDDDDDD',
    'DccccccccccccD', 'DcyccccccccCCD', 'DcccccccccccCD', 'DcccccccccccCD', 'DDDDDDDDDDDDDD'),
  left: G(5, 24, '.ccD', '.ccD', '.ccD', '.ccD', '.ccD', '.DDD', 'cccD', 'cccD', 'cccD', 'cccD', 'DDDD'),
  up: G(6, 22, '5.c8.c5.', '5.c8.c5.', '6.c6.c6.', '7.c4.c7.', '8.c2.c8.', '7.cc2Dcc7.', '20c', '7.cC2.Cc7.'),
};
const KIMONO_HD = {
  down: G(8, 22, '3.WW6sWW3.', '4.WW4sWW4.', '5.WW2sWW5.', '6.WwWW6.', '5.WW9.', '15cC', '16x', '14c2C'),
  left: G(6, 22, '.Wws', '.Ww.', '..W.', '..W.', '..W.', '19cC', '20x', '18c2C'),
  up: G(4, 25, '6.12c6.', '6.y10cC6.', '5cDy10cCD5c', '5xDy10cCD5x', '5cDy10cCD5c', '6.Dy8cCD6.', '6.12D6.'),
};

// legs: [stand, walk A, walk B]
const PANTS_HD = {
  down: [
    G(0, 30, '6.20p6.', '6.b17p2P6.', '6.b8p2B7p2P6.', '6.b7pB2oB6p2P6.', '6.b6p2P2o2P5p2P6.', '6.9B2o9B6.', '6.f2r6f2of2r4f2F6.', '6.7f2F2o6f3F6.', '7.8N2.8N7.', '8.6o4.6o8.'),
    G(0, 30, '6.20p6.', '6.b17p2P6.', '6.b8p2B7p2P6.', '6.9B2oB6p2P6.', '6.f2r6f2o2P5p2P6.', '6.7f2F2o9B6.', '7.8N2of2r4f2F6.', '8.6o3.6f3F6.', '17.8N7.', '18.6o8.'),
    G(0, 30, '6.20p6.', '6.b17p2P6.', '6.b8p2B7p2P6.', '6.b7pB2o9B6.', '6.b6p2P2of2r4f2F6.', '6.9B2o6f3F6.', '6.f2r6f2o8N7.', '6.7f2Fo2.6o8.', '7.8N17.', '8.6o18.'),
  ],
  left: [
    G(0, 30, '8.18p6.', '8.b15p2P6.', '8.b8pB6p2P6.', '8.b8pB7P7.', '8.17B7.', '8.10f6F8.', '6.fr10fN5F8.', '6.12f6F8.', '6.18N8.', '7.16o9.'),
    G(0, 30, '8.18p6.', '7.b16p2P6.', '6.b8pB10P6.', '5.b8p2.9P7.', '4.b7p4.8P8.', '4.8B4.8B8.', '3.fr7f4.9F7.', '2.f2r7f4.9F7.', '2.10N4.9N7.', '3.8o5.8o8.'),
    G(0, 30, '8.18p6.', '7.b16p2P6.', '6.9PB8p2P6.', '5.9P2.b7pP7.', '4.8P4.b6pP8.', '4.8B4.8B8.', '3.9F4.fr7f7.', '2.10F4.f2r6f7.', '2.10N4.9N7.', '3.8o5.8o8.'),
  ],
};
const SK_DOWN = ['6.20p6.', '6.pbpPpbpPppppPpppPpPp6.', '5.pbpPpbppPppppPppppPpPp5.', '4.pbpPpbppPppppppPppppPpPp4.', '4.pbpPpbppPppppppPppppPpPp4.', '4.24B4.'];
const SK_LEFT = ['8.18p6.', '7.pbpPpbpPpppPpppPpPPp5.', '6.pbpPpbppPppppPpppPpPPp4.', '6.pbpPpbppPppppPpppPpPPp4.', '6.pbpPpbppPppppPpppPpPPp4.', '6.22B4.'];
const SKIRT_HD = {
  down: [
    G(0, 30, ...SK_DOWN, '9.2sSs6.2sSs9.', '8.fr3fF4.fr3fF8.', '8.5fF4.5fF8.', '9.4N6.4N9.'),
    G(0, 30, ...SK_DOWN, '8.fr3fF5.2sSs9.', '8.5fF4.fr3fF8.', '9.4N5.5fF8.', '19.4N9.'),
    G(0, 30, ...SK_DOWN, '9.2sSs5.fr3fF8.', '8.fr3fF4.5fF8.', '8.5fF5.4N9.', '9.4N19.'),
  ],
  left: [
    G(0, 30, ...SK_LEFT, '13.ssSs15.', '10.fr5fF14.', '10.7fF14.', '11.6N15.'),
    G(0, 30, ...SK_LEFT, '9.ssSs5.4S10.', '6.fr5fF2.6F10.', '6.7fF2.6F10.', '7.6N4.4N11.'),
    G(0, 30, ...SK_LEFT, '9.4S5.ssSs10.', '6.8F2.fr3fF10.', '6.8F2.5fF10.', '7.6N4.4N11.'),
  ],
};

// --------------------------------------------------------------- accessories
const GLASSES_HD = {
  down: G(8, 11, '.4g6.4g.', 'gw3.6gw3.g', 'g4.g4.g4.g', 'g4.g4.g4.g', 'g4.g4.g4.g', '.4g6.4g.'),
  left: G(5, 11, '.4g', 'gw3.g6g', 'g4.g', 'g4.g', 'g4.g', '.4g'),
  up: G(5, 12, 'g20.g'),
};
const SUN_HD = {
  down: G(8, 11, '.4g6.4g.', 'gZ3z6gZ3zg', 'g4zg4.g4zg', 'g4zg4.g4zg', '.g3zg4.g3zg.', '..3g6.3g..'),
  left: G(5, 11, '.4g', 'gZ3zg6g', 'g4zg', 'g4zg', '.g3zg', '..3g'),
  up: G(5, 12, 'g20.g'),
};
const BEARD_HD = {
  down: G(7, 15, 'H16.H', 'hH14.Hh', 'hhH3.HhhhhH3.Hhh', 'hhhHhhHmmHhhHhhh', '.hhhhhhHHhhhhhh.', '..HhhhhhhhhhhH..', '...IIIIIIIIII...'),
  left: G(4, 15, '11.H', '10.Hh', '.HhhH4.hhh', 'HmmhhhhhhhhH', 'hhhhhhhhhhH.', '.HhhhhhhhH..', '..IIIIIII...'),
};

// --------------------------------------------------------------- hair styles
// { down, left, up }: hair in front of the head (Z_HAIR); back: down-view hair
// behind the body; hat: { down, left, up } (Z_HAT); skin: head-layer marks
// (scalp shine); ears: draw ears; fem: lashes by default; masc: never lashes by
// default; bow: look.ribbon draws BOW_HD; face: false hides it;
// soft: no inner line around the hair (thin hair on a bald head).
const UPB = [ // back of a full head of hair, rows 2..17
  '10.12h10.', '8.5h3j8h8.', '6.6h5j8hH6.', '5.8h3j9h2H5.', '5.20h2H5.', '4.22h2H4.',
  '4.7hH14h2H4.', '4.7hH4hH4hH4h2H4.', '4.7hH4hH4hH4h2H4.', '4.6hH5hH4hH4h2H4.', '4.6hH5hH4hH4h2H4.',
  '4.6hH5hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.',
];
const NAPE = ['5.4hH6hH5hH2h2H5.', '6.3hH6h2.4hHh2H6.'];
const UPB_LONG = ['4.5hH6hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.', '4.4hH7hH6hH2h2H4.', '4.4hH7hH6hH2h2H4.', '4.4hH7hH6hH2h2H4.', '4.4hH7hH6hH2h2H4.', '4.4hH7hH6hH2h2H4.'];
// fringe of the short family, rows 2..12 (down view)
const FRINGE = ['10.12h10.', '8.4h3j9h8.', '6.4h5j10hH6.', '5.4h3j13h2H5.', '5.20h2H5.', '4.22h2H4.', '4.11hH10h2H4.', '4.10hH8hH2h2H4.', '4.9hH8hH3hHh4.', '4.5hH5h2.8h2Hh4.'];
// side view of the short family, rows 2..11
const SIDE = ['10.12h10.', '8.2h4j10h8.', '6.3h5j11hH6.', '5.4h4j12h2H5.', '5.20h2H5.', '4.22h2H4.', '4.hH20h2H4.', '4.3hH18h2H4.', '4.3.hH17h2H4.', '4.4.2hH.13h2Hh4.'];
const SIDE_BACK = ['16.10h2H4.', '17.9h2H4.', '18.8h2H4.', '19.7h2H4.', '20.4h2H6.', '21.3h2H6.', '22.2hH7.', '23.h8.']; // rows 12..19
const SPIKES = ['.....h....h....hh....h....h.....', '.....hh..hhh..hhhh..hhh..hh.....', '....24h....'];
const TWIN_TAILS = G(0, 8,
  '..hhh...16....hhh..',
  '.hhjhh..16...hhhhh.',
  'hhjhhh..16...hhhhhh',
  'hjhhHh..16...hhhhHh',
  'hjhhHh..16...hhhhHh',
  'hjhhHh..16...hhhhHh',
  'hjhhHh..16...hhhhHh',
  'hhjhHh..16...hjhhHh',
  'hhjhHh..16...hjhhHh',
  'hhjhH...16....hjhhH',
  'hhjhH...16....hjhhH',
  'hhhhH...16....hhhhH',
  '.hhHH...16....hhHH.',
  '.hhHH...16....hhHH.',
  '.hHH....16.....hHH.',
  '..HH....16.....HH..',
  '..H.....16......H..');
// hair bow in the ribbon colour (painted over the hair at Z_HAT, so finishHD
// outlines it): two loops and a knot. at() places it on a full-width grid.
const BOW = ['.XX.XX.', 'XxxXxxX', 'XxxXxxX', '.XX.XX.'];
const at = (x0, y0, rows) => G(0, y0, ...rows.map((r) => '.'.repeat(x0) + r + '.'.repeat(HW - x0 - r.length)));
// twin tails: one bow where each tail is tied (symmetric)
const TWIN_BOWS = [at(0, 7, BOW), at(HW - 7, 7, BOW)];
// look.ribbon on other styles: a bow on the upper side of the head
// (from behind it sits on the other side: up mirrors down's x = 20..26)
const BOW_HD = { down: at(20, 2, BOW), up: at(HW - 20 - BOW[0].length, 2, BOW), left: at(17, 3, BOW) };
const TWIN_SIDE = G(0, 7, '26.4h2.', '25.6h1.', '25.hjhhhH1.', '25.hjhhh2H', '25.hjhhh2H', '25.hjhhh2H', '25.hhjhh2H', '25.hhjhh2H',
  '25.hhjh2H1.', '25.hhjh2H1.', '25.4h2H1.', '25.3h2H2.', '25.3h2H2.', '25.2h3H2.', '25.h3H3.', '26.3H3.', '26.2H4.', '26.H5.');
const HS = {
  none: { ears: true },
  short: {
    ears: true,
    bow: true,
    down: G(0, 2, ...FRINGE, '4.5h4.2h4.h4.2hHh4.', '4.4h16.4h4.', '4.4h16.4h4.', '4.3h18.3h4.'),
    left: G(0, 2, ...SIDE, ...SIDE_BACK),
    up: G(0, 2, ...UPB, ...NAPE),
  },
  slick: {
    ears: true,
    bow: true,
    down: G(0, 2, '10.12h10.', '8.3h4j9h8.', '6.3h6j9h2H6.', '5.4h2j2hH6hH3h3H5.', '5.2hH3hH9hH3h2H5.', '4.2hH3hH11hH3h2H4.', '4.hH3hH13hH2h2H4.', '4.22h2H4.', '4.3h18.h2H4.', '4.2h20.hH4.', '4.2h20.hH4.', '4.h22.H4.'),
    left: G(0, 2, '10.12h10.', '8.h4j11h8.', '6.h6j2hH8h2H6.', '5.5hH4hH9h2H5.', '5.3hH4hH5hH5h2H5.', '4.H5hH10hH4h2H4.', '4.22h2H4.', '4.22h2H4.', '17.9h2H4.', '17.9h2H4.', '18.8h2H4.', '19.7h2H4.', '20.6h2H4.', '21.5h2H4.', '22.3h2H5.', '23.h2H6.'),
    up: G(0, 2, ...UPB, ...NAPE),
  },
  long: {
    fem: true,
    bow: true,
    down: G(0, 2, ...FRINGE, '4.5h4.2h4.h3.3hHh4.', '4.5h14.5h4.', '4.hjh2h14.2h2Hh4.', '4.hjhHh14.hh2Hh4.',
      '2.2hjhHhh14.hh2H3h2.', '2.2hjhHhh14.hhH4h2.', '2.hhjhHhh14.hhHhhHh2.', '2.hhjhHhh14.hhHhhHh2.',
      '2.hhjhHhhh12.hhhHhhHh2.', '2.hhjhHhhh12.hhhHhhHh2.', '2.hhjhHhhH12.HhhHhhHh2.', '2.hhhhHhhH12.HhhHhhHh2.',
      '2.HhhhHhHH12.HHhHhhHH2.', '2.HHhHHhHH12.HHhHHhHH2.', '3.6H14.6H3.', '4.4H16.4H4.'),
    left: G(0, 2, ...SIDE, '16.10h2H4.', '16.10h2H4.', '16.hjh7h2H4.', '16.hjh7h2H4.', '14.hhjhhHhhhhhhHH4.', '14.hhjhhHhhhhhhHH4.',
      '14.hhjhhHhhhHhhHH4.', '14.hhjhhHhhhHhhHH4.', '12.hhhjhhHhhhHhhhHH4.', '12.hhhjhhHhhhHhhhHH4.', '12.6hHhhhHhhhHH4.', '12.6hHhhhHhhhHH4.',
      '12.HhhhHhHHhhHhHHHH4.', '12.HHhHHhHHHHHhHHHH4.', '14.12H6.', '15.10H7.'),
    up: G(0, 2, ...UPB, ...UPB_LONG, '4.4hH7hH6hH2h2H4.', '5.3hH7hH6hH3H5.', '6.2H.5H2.6H.3H6.'),
  },
  bob: {
    fem: true,
    bow: true,
    down: G(0, 2, '10.12h10.', '8.4h3j9h8.', '6.4h5j10hH6.', '5.4h3j13h2H5.', '5.20h2H5.', '4.22h2H4.', '4.22h2H4.', '4.4hH6hH6hH3hHh4.', '4.4hH6hH6hH3h2H4.', '4.24h4.',
      '4.4h16.4h4.', '4.4h16.4h4.', '4.hjhh16.hhHh4.', '4.hjhh16.hhHh4.', '2.hhhjhh16.hhHhhh2.', '2.hhhjhh16.hhHhhh2.', '2.hhhjhhhh12.hhhhHhhh2.', '2.8H12.8H2.', '3.7H12.7H3.'),
    left: G(0, 2, '10.12h10.', '8.2h4j10h8.', '6.3h5j11hH6.', '5.4h4j12h2H5.', '5.20h2H5.', '4.22h2H4.', '4.hH20h2H4.', '4.3hH18h2H4.', '4.hhHhhH16h2H4.', '4.24h4.',
      '12.14h2H4.', '12.14h2H4.', '12.hjh11h2H4.', '12.hjh11h2H4.', '12.hjh11h2H4.', '11.hhjh11h2H4.', '10.3hj12h2H4.', '10.18H4.', '11.16H5.'),
    up: G(0, 2, ...UPB, '4.5hH6hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.', '4.H4hH6hH5hH2h3H4.', '4.5H2h8H2h7H4.', '6.20H6.'),
  },
  spiky: {
    ears: true,
    bow: true,
    down: G(0, 0, ...SPIKES, '4.5h3j14h2H4.', '4.4h5j13h2H4.', '4.5h3j14h2H4.', '4.22h2H4.', '4.22h2H4.', '4.6hH6hH7hH2H4.', '4.5hH7hH6hHh2H4.',
      '4.6h2.8h2.6h4.', '4.5h4.6h4.5h4.', '4.4h6.4h6.4h4.', '4.4h16.4h4.', '4.3h18.3h4.', '4.2h20.2h4.'),
    left: G(0, 0, '.........h....h....h....h.......', '........hh...hh...hhh..hhh......', '.......hhhh.16h4.', '6.3h3j15h5.', '5.3h5j12h2H2h3.', '5.4h3j14h2H3h1.', '4.22h2H2h2.', '4.22h2Hh3.',
      '4.hH20h2H4.', '4.3hH18h2H4.', '4.3.hH17h2H4.', '4.4.2hH.hH11h2Hh4.', ...SIDE_BACK),
    up: G(0, 0, ...SPIKES, '4.5h3j14h2H4.', '4.4h5j13h2H4.', '4.5h3j14h2H4.', '4.22h2H4.', '4.22h2H4.', ...UPB.slice(6), ...NAPE),
  },
  twin: {
    fem: true,
    back: { down: TWIN_TAILS, left: TWIN_SIDE },
    down: G(0, 2, ...FRINGE, '4.5h4.2h4.h4.2hHh4.', '4.4h16.4h4.', '4.4h16.4h4.', '4.3h18.3h4.'),
    left: G(0, 2, ...SIDE, ...SIDE_BACK),
    up: [G(0, 2, ...UPB, ...NAPE), TWIN_TAILS],
    hat: { down: TWIN_BOWS, up: TWIN_BOWS, left: at(23, 6, BOW) },
  },
  afro: {
    bow: true,
    down: G(0, 0,
      '7.5h.6h.5h7.', '4.5h3j16h4.', '2.5h6j15h2H2.', '1.5h7j7hH7h3H1.', '1.6h5j6hH9h3H1.', '8h3j9hH8h3H', '13hH15h3H', '1.11hH8hH6h3H1.', '7hH16hH4h3H', '3hH14hH10h3H', '1.9hH17h3H1.', '6hH14hH7h3H', '3hH4h16.4hH3H', '8h16.5h3H', '1.2hH4h16.3hHh2H1.', '1.7h16.5h2H1.', '2.H4h18.3h2H2.', '3.3H20.3H3.'),
    left: G(0, 0,
      '8.5h.7h.6h4.', '5.4h3j17h3.', '3.4h6j16h2H1.', '2.4h7j6hH9h2H1.', '2.5h5j6hH11h2H', '2.11hH15h2H1.', '2.6hH16hH4h2H', '2.16hH10h2H1.', '2.4hH13hH9h2H', '2.11hH15h2H1.', '8.6hH15h2H', '8.12hH8h2H1.', '14.3hH11h2H1.', '14.15h2H1.', '14.5hH9h2H1.', '15.13h2H2.', '16.H9h3H3.', '18.9H5.'),
    up: G(0, 0,
      '7.5h.6h.5h7.', '4.5h3j16h4.', '2.5h6j15h2H2.', '1.5h7j7hH7h3H1.', '1.6h5j6hH9h3H1.', '8h3j9hH8h3H', '13hH15h3H', '1.11hH8hH6h3H1.', '7hH16hH4h3H', '3hH14hH10h3H', '1.9hH17h3H1.', '6hH14hH7h3H', '3hH12hH12h3H', '1.9hH15hHh3H1.', '14hH13h4H', '1.5hH17hH3h3H1.', '2.2H21h5H2.', '4.3H17h4H4.', '7.18H7.'),
  },
  cap: {
    ears: true,
    down: G(0, 12, '4.4h16.4h4.', '4.4h16.4h4.', '4.4h16.4h4.', '4.3h18.3h4.'),
    left: G(0, 12, ...SIDE_BACK),
    up: G(0, 11, ...UPB.slice(9), ...NAPE),
    hat: {
      down: G(0, 2, '10.12q10.', '8.3q3a10q8.', '6.3q5a10q2Q6.', '5.4q3a13q2Q5.', '5.9q4w7q2Q5.', '4.10q4W8q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '2.28Q2.', '2.28R2.'),
      left: G(0, 2, '10.12q10.', '8.2q4a8q2Q8.', '6.2q5a10q3Q6.', '5.3q4a12q3Q5.', '5.6q3w11q2Q5.', '4.7q3W12q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '10Q16q2Q4.', '10R18Q4.'),
      up: G(0, 2, '10.12q10.', '8.5q3a8q8.', '6.6q5a8qQ6.', '5.8q3a9q2Q5.', '5.20q2Q5.', '4.22q2Q4.', '4.9q6h7q2Q4.', '4.9q6Q7q2Q4.', '4.24Q4.'),
    },
  },
  bald: {
    ears: true,
    soft: true,
    masc: true,
    skin: { down: G(10, 5, '.nnn', 'nnn.', 'nn..'), left: G(12, 5, '.nn', 'nnn', 'nn.'), up: G(11, 5, '.nnn', 'nnn.', 'nn..') },
    down: G(0, 9, '4.h22.h4.', '4.hh20.hH4.', '4.hhH18.hHH4.', '4.hhH18.hHH4.', '4.HH20.HH4.'),
    // horseshoe fringe: over the ear and round the back of the head (a band,
    // not a patch, so it never reads as an ear muff)
    left: G(0, 10, '22.hjhhH5.', '16.hjjjhhhhhhH5.', '15.hhhhhhhhhhhH5.', '18.HHhhhhhhH5.', '21.hhhhhH5.', '22.hhHhH5.',
      '22.hhHhH5.', '22.HhhhH5.', '23.HhhH5.', '24.HH6.'),
    up: G(0, 12, '5.2h4.2h6.2h4.2h5.', '4.24h4.', '4.5hH6hH5hH3h2H4.', '4.5hH6hH5hH3h2H4.', '5.HhhhH6hH5hH2h2H5.', '6.20H6.'),
  },
  mage: {
    ears: true,
    masc: true,
    skin: { down: G(9, 6, 'nn', 'n.'), left: G(9, 6, 'nn', 'n.'), up: G(9, 5, 'nn', 'n.') },
    down: G(0, 0, '13.6h13.', '12.hjjhhhhH12.', '12.hjhhhhhH12.', '12.hhhhhhHH12.', '13.hhhhHH13.', '14.4H14.', '32.',
      '5.2h18.2h5.', '4.4h16.4h4.', '4.4h16.4h4.', '4.4h16.4h4.', '4.4h16.4h4.', '4.4h16.4h4.', '4.3H18.3H4.'),
    left: G(0, 0, '10.13h9.', '9.hjjjjj7h2H8.', '9.5H8h2H8.', '17.6h2H7.', '18.5h2H7.', '20.4h2H6.', '22.3hH6.', '22.4h2H4.',
      '18.8h2H4.', '18.8h2H4.', '16.10h2H4.', '16.10h2H4.', '18.8h2H4.', '18.8h2H4.', '20.4hH7.', '21.3h8.'),
    up: G(0, 0, '13.6h13.', '12.hhjjhhhH12.', '12.hhjhhhhH12.', '13.hhhhHH13.', '13.hhhhHH13.', '12.hhhhhhHH12.', '5.20h2H5.', '4.22h2H4.', ...UPB.slice(6), ...NAPE),
  },
  helmet: {
    face: false,
    hat: {
      down: G(0, 2, '10.12q10.', '8.3q3a10q8.', '6.3q5a10q2Q6.', '5.4q3a13q2Q5.', '5.20q2Q5.', '4.22q2Q4.', '4.22q2Q4.', '4.3q18Rq2Q4.', '4.3qR16vRq2Q4.', '4.3qR16vRq2Q4.',
        '4.3qRvvVVvvvvvvvvVVvvRq2Q4.', '4.3qR16vRq2Q4.', '4.3qR16vRq2Q4.', '4.3qR16vRq2Q4.', '4.3q18Rq2Q4.', '4.22q2Q4.', '5.20q2Q5.', '6.18q2Q6.', '7.18Q7.', '9.14R9.'),
      left: G(0, 2, '10.12q10.', '8.2q4a10q8.', '6.2q5a11q2Q6.', '5.3q4a13q2Q5.', '5.20q2Q5.', '4.22q2Q4.', '4.22q2Q4.', '4.10R12q2Q4.', '4.9vR12q2Q4.', '4.9vR12q2Q4.',
        '4.vvVVvvvvvR12q2Q4.', '4.9vR12q2Q4.', '4.9vR12q2Q4.', '4.9vR12q2Q4.', '4.10R12q2Q4.', '4.22q2Q4.', '5.20q2Q5.', '6.18q2Q6.', '7.18Q7.', '9.14R9.'),
      up: G(0, 2, '10.12q10.', '8.5q3a8q8.', '6.6q5a8qQ6.', '5.8q3a9q2Q5.', '5.20q2Q5.', '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.',
        '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '4.22q2Q4.', '5.20q2Q5.', '6.18q2Q6.', '7.18Q7.', '9.14R9.'),
    },
  },
};

function composeHD(look, view, f) {
  BZ.fill(-1);
  const hs = HS[look.hair || 'short'] || HS.short;
  if (hs.back) paint(hs.back[view], Z_BACK);
  paint((look.skirt ? SKIRT_HD : PANTS_HD)[view === 'left' ? 'left' : 'down'][f], Z_LEGS);
  paint(TORSO_HD[view], Z_BODY);
  if (look.kimono) paint(KIMONO_HD[view], Z_BODY, { remap: 'obi' });
  else {
    if (look.jacket) paint(JACKET_HD[view], Z_BODY);
    if (look.tie && view === 'down') { if (!look.jacket) paint(TIE_HD.collar, Z_BODY); paint(TIE_HD.down, Z_BODY); }
    if (look.tie && view === 'left') paint(TIE_HD.left, Z_BODY);
  }
  if (look.apron) paint(APRON_HD[view], Z_BODY, { remap: 'apron' });
  paint(HEAD_HD[view], Z_HEAD);
  if (hs.ears) paint(EARS_HD[view], Z_HEAD);
  if (hs.skin) paint(hs.skin[view], Z_HEAD);
  const face = hs.face !== false && view !== 'up';
  if (face) {
    const F = FACE_HD[view];
    // (a samurai's hakama is a skirt too: topknots, bald heads and beards stay masculine)
    const fem = look.lashes != null ? !!look.lashes : !!((look.skirt || hs.fem) && !hs.masc && !look.beard);
    if (view === 'left') paint(NOSE_HD, Z_HEAD);
    paint(fem ? F.browF : F.brow, Z_HEAD);
    paint(F.eyes, Z_HEAD);
    if (fem) paint(F.lash, Z_HEAD);
    if (!look.beard) paint(F.mouth, Z_HEAD);
    if (look.blush !== false) paint(F.blush, Z_HEAD);
    if (look.beard) paint(BEARD_HD[view], Z_BEARD);
  }
  paint(hs[view], hs.soft ? Z_BEARD : Z_HAIR);
  if (hs.hat) paint(hs.hat[view], Z_HAT);
  if (look.ribbon && hs.bow) paint(BOW_HD[view], Z_HAT);
  if (view === 'left') paint(ARM_HD[f], Z_ARM);
  // glasses sit on the face (a helmet hides them); from behind only the temple tips show
  if (look.glasses && hs.face !== false) paint((look.glasses === 'sun' ? SUN_HD : GLASSES_HD)[view], Z_GLASS);
}

const hdCache = new Map();
export function charSheetHD(look = {}) {
  const key = JSON.stringify(look);
  const hit = hdCache.get(key);
  if (hit) return hit;
  PAL = hdPalette(look);
  const sheet = { down: [], up: [], left: [], right: [] };
  for (const dir of ['down', 'up', 'left']) {
    for (let f = 0; f < 3; f++) {
      const [cv, c] = makeCanvas(HW, HH);
      composeHD(look, dir, f);
      let cm = null;
      if (dir === 'left') { const [cvm, cx] = makeCanvas(HW, HH); sheet.right.push(cvm); cm = cx; }
      finishHD(c, cm);
      sheet[dir].push(cv);
    }
  }
  hdCache.set(key, sheet);
  // the closet can mint hundreds of looks: keep the newest few hundred sheets
  // (anything still holding an evicted sheet keeps using it)
  if (hdCache.size > 400) hdCache.delete(hdCache.keys().next().value);
  return sheet;
}

// Draw a character standing on tile-space pixel position (x, y).
export function drawChar(ctx, sheet, dir, frame, x, y) {
  const img = sheet[dir] ? sheet[dir][frame] || sheet[dir][0] : sheet.down[0];
  ctx.drawImage(img, Math.round(x), Math.round(y) - 4, SW, SH);
}

// Part of a frame. The source rectangle is in 1x frame pixels (the frame is 16x20),
// so the same call crops a 1x sheet and an HD sheet alike (custom sprites must never
// crop an HD frame with 1x numbers: that cuts out only its top-left quarter).
export function drawCharPart(ctx, sheet, dir, frame, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
  const list = sheet[dir] || sheet.down;
  const img = list[frame] || list[0];
  const k = img.width / SW;
  ctx.drawImage(img, sx * k, sy * k, sw * k, sh * k, Math.round(dx), Math.round(dy), dw, dh);
}

// Someone sitting on the tile whose top-left is (x, y) (units, like drawChar).
// seat = { img, top, low } is the seat under them (its tile image, 16x16 units, the row
// in units where the seat's top edge starts, and low: a cushion or stool) or null.
//  - seen from behind ('up') in a seat with a back: the head and shoulders rise above
//    the seat back and the seat is drawn again over the rest of the body (theatre /
//    studio / gallery seats, benches and sofas seen from behind);
//  - otherwise (facing you or sideways, or a low seat): the seat stays under them; the
//    body sits 3 units lower and ends at the lap.
export function drawSeated(ctx, sheet, dir, x, y, seat = null) {
  x = Math.round(x); y = Math.round(y);
  if (dir === 'up' && seat && !seat.low) {
    const st = Math.max(0, Math.round(seat.top));
    drawCharPart(ctx, sheet, 'up', 0, 0, 0, SW, 16, x, y + st - 12, SW, 16);
    const k = seat.img.width / 16;
    ctx.drawImage(seat.img, 0, st * k, seat.img.width, seat.img.height - st * k, x, y + st, 16, 16 - st);
    return;
  }
  drawCharPart(ctx, sheet, dir, 0, 0, 0, SW, 17, x, y - 1, SW, 17);
}

export function drawShadow(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(x) + 4, Math.round(y) + 14, 8, 2);
  ctx.fillRect(Math.round(x) + 3, Math.round(y) + 15, 10, 1);
}

// 16x12 face crop (for dialogue name tags), drawn at `scale` (1x pixels).
export function drawFace(ctx, look, x, y, scale = 2) {
  const sheet = charSheet(look);
  ctx.drawImage(sheet.down[0], 0, 0, 16, 12, Math.round(x), Math.round(y), 16 * scale, 12 * scale);
}

// Same crop from the 2x sheet: 32x24 HD pixels drawn at `scale` per HD pixel.
// A scale that would give uneven device pixels (e.g. 2.25 on a 2x canvas) is
// snapped down to the nearest crisp one and the face is centred in the box the
// caller asked for.
// [R14-P] the photo of a real figure in a face box (32x24 sprite units × scale): the top of the portrait, centred (face and hair), a thin frame.
// Returns false while the image is loading (the pixel face is drawn instead).
function drawPhotoFace(ctx, key, x, y, scale) {
  const img = histImg(key);
  if (!img || !img.naturalWidth) return false;
  const w = 32 * scale, h = 24 * scale;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const sh = Math.min(ih, iw * (h / w)), sy = Math.max(0, Math.min(ih - sh, ih * 0.06));
  ctx.save();
  ctx.fillStyle = '#0b1626'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, w + 2, h + 2);
  ctx.drawImage(img, 0, sy, iw, sh, Math.round(x), Math.round(y), w, h);
  ctx.restore();
  return true;
}
export function drawFaceHD(ctx, look, x, y, scale = 1) {
  if (look && look.photo && drawPhotoFace(ctx, look.photo, x, y, scale)) return; // [R14-P] a real figure: the photo, as it is
  const sheet = charSheetHD(look);
  let k = scale, ox = 0, oy = 0;
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const dev = m && !m.b && !m.c ? Math.abs(m.a) : 0;
  if (dev > 0 && scale * dev >= 1) {
    k = Math.max(1, Math.floor(scale * dev + 1e-6)) / dev;
    ox = Math.round(((32 * (scale - k)) / 2) * dev) / dev;
    oy = Math.round(((24 * (scale - k)) / 2) * dev) / dev;
  }
  ctx.drawImage(sheet.down[0], 0, 0, 32, 24, Math.round(x) + ox, Math.round(y) + oy, 32 * k, 24 * k);
}

// Handy presets for NPCs. Spread & override: { ...LOOKS.staff, top: '#2f9a4a' }
export const LOOKS = {
  player: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#d64161', bottom: '#3a4a7a' },
  receptionist: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#3f5fa8', bottom: '#2a3560', skirt: true, jacket: true },
  manager: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2e3140', bottom: '#2e3140', jacket: true, tie: '#3a6fd8', glasses: true },
  president: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#d62f2f', beard: true },
  staff: { hair: 'cap', hat: '#2a2d36', hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#2a2d36' },
  ad: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#ff8a3d', bottom: '#3a4a7a' },
  director: { hair: 'cap', hat: '#d62f2f', hairColor: 'black', skin: 'tan', top: '#f2f2f2', bottom: '#5a4a3a', glasses: 'sun', beard: true },
  cameraman: { hair: 'cap', hat: '#2f6fd0', hairColor: 'brown', skin: 'tan', top: '#5a6f8a', bottom: '#3b3f48' },
  guard: { hair: 'cap', hat: '#2a3560', hairColor: 'black', skin: 'fair', top: '#3a4a7a', bottom: '#2a3560', tie: '#20232a' },
  comedian: { hair: 'spiky', hairColor: 'orange', skin: 'fair', top: '#ffd23f', bottom: '#d62f2f' },
  comedian2: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#2f9a4a', bottom: '#1e1e26', glasses: true },
  idol: { hair: 'twin', hairColor: 'pink', skin: 'light', top: '#ff7eb6', bottom: '#ffffff', skirt: true },
  singer: { hair: 'long', hairColor: 'black', skin: 'light', top: '#8a5ac8', bottom: '#2a2430', skirt: true },
  actor: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#8a5ac8' },
  actress: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#c0452f', skirt: true },
  announcer: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#f2f2f2', bottom: '#2a3560', skirt: true, jacket: true },
  announcerM: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#2a3560', jacket: true, tie: '#3a6fd8' },
  makeup: { hair: 'bob', hairColor: 'purple', skin: 'light', top: '#1e1e26', bottom: '#1e1e26' },
  samurai: { hair: 'mage', hairColor: 'black', skin: 'tan', top: '#3a4a7a', bottom: '#5a5f6b', skirt: true },
  ninja: { hair: 'helmet', hat: '#1e1e26', top: '#1e1e26', bottom: '#1e1e26', shoes: '#1e1e26' },
  hero: { hair: 'helmet', hat: '#d62f2f', top: '#d62f2f', bottom: '#f2f2f2', shoes: '#f2f2f2' },
  kaiju: { hair: 'spiky', hairColor: '#2f6b34', skin: 'green', top: '#3f8a3a', bottom: '#2f6b34', shoes: '#2f6b34', blush: false },
  oldman: { hair: 'bald', hairColor: 'white', skin: 'tan', top: '#8a6a4a', bottom: '#5a4a3a', glasses: true },
  oldwoman: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#9273bd', bottom: '#5a4a6a', skirt: true },
  kid: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#ffd23f', bottom: '#2f6fd0' },
  salaryman: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3b3f48', bottom: '#3b3f48', jacket: true, tie: '#2f9a4a' },
  fan: { hair: 'twin', hairColor: 'black', skin: 'light', top: '#5fd7ff', bottom: '#3a4a7a', skirt: true },
  clerk: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#2f9a4a', bottom: '#3b3f48' },
  chef: { hair: 'cap', hat: '#f2f2f2', hairColor: 'black', skin: 'tan', top: '#f2f2f2', bottom: '#3b3f48' },
  tourist: { hair: 'cap', hat: '#ffd23f', hairColor: 'blonde', skin: 'light', top: '#ff8a3d', bottom: '#e0c48a', glasses: 'sun' },
  mom: { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#ff9a3c', bottom: '#5a4a6a', skirt: true },
};
