// Procedural 16x20 pixel characters.
//
//   const sheet = charSheet(look)          // cached
//   drawChar(ctx, sheet, dir, frame, x, y) // x,y = top-left of the 16x16 tile the character stands on
//
// look = {
//   hair: 'short'|'long'|'bob'|'spiky'|'bald'|'afro'|'cap'|'twin'|'slick'|'mage'|'helmet'|'none',
//   hairColor, skin, top, bottom, shoes,          // css colors (or keys of HAIR / SKIN)
//   skirt: bool, jacket: bool, tie: color|null, glasses: false|true|'sun', beard: bool,
//   hat: color (cap/helmet color), blush: bool
// }

import { makeCanvas, shade } from './util.js';

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
  const skin = resolve(look.skin, SKIN, SKIN.fair);
  const hair = resolve(look.hairColor, HAIR, HAIR.black);
  const top = look.top || '#d64161';
  const bottom = look.bottom || '#3a4a7a';
  const hat = look.hat || '#d62f2f';
  return {
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
  if (look.jacket) layer(c, ACC.jacket[dir], pal);
  if (look.tie) layer(c, ACC.tie[dir], pal);
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

// Draw a character standing on tile-space pixel position (x, y).
export function drawChar(ctx, sheet, dir, frame, x, y) {
  const img = sheet[dir] ? sheet[dir][frame] || sheet[dir][0] : sheet.down[0];
  ctx.drawImage(img, Math.round(x), Math.round(y) - 4);
}

export function drawShadow(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(x) + 4, Math.round(y) + 14, 8, 2);
  ctx.fillRect(Math.round(x) + 3, Math.round(y) + 15, 10, 1);
}

// 16x12 face crop (for dialogue name tags), drawn at `scale`.
export function drawFace(ctx, look, x, y, scale = 2) {
  const sheet = charSheet(look);
  ctx.drawImage(sheet.down[0], 0, 0, 16, 12, Math.round(x), Math.round(y), 16 * scale, 12 * scale);
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
