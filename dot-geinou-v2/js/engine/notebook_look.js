// てちょう — the look (imported only by notebook.js): era themes (昭和 革の手帳 / 平成 システム手帳 / 令和 デジタル),
// the cached cover + paper, tab icons, ink colours on paper and the page-turn shading.
//
//   themeFor(era)              → THEMES.leather | system | digital
//   ink(theme, c)              → the colour c as ink on that paper (dark themes: c itself)
//   drawBackdrop(ctx, th, L)   → cover + page (cached per theme and layout)
//   icon(ctx, id, x, y, c, s)  → a 12x12 pixel icon (s = scale)
//   pageTurnEdge(ctx, th, x, y, h, dir) → the shaded curl at the edge of a turning page

import { SW, SH, shade } from './util.js';
import { rect, COLORS } from './draw.js';

const P = (o) => o;
export const THEMES = {
  // 昭和: a brown leather 手帳 with cream pages and sepia ink
  leather: P({
    id: 'leather', dark: false,
    bg: '#120b06', cover: '#6b3f22', coverHi: '#8a5634', coverLo: '#4a2914', grain: ['#5e361c', '#77482a'], stitch: '#d9b48a',
    paper: '#f4ead2', paper2: '#e6d8b6', paperEdge: '#c9b38a', rule: '#e3d4b2', margin: '#d79a86',
    ink: { [COLORS.text]: '#2e2116', [COLORS.dim]: '#7d6c55', [COLORS.accent]: '#a85a08', [COLORS.good]: '#2f7a37', [COLORS.bad]: '#b3261e', [COLORS.pink]: '#b23a6e', [COLORS.cyan]: '#1f6c94', '#ffffff': '#2e2116' },
    track: '#e2d3b0', trackEdge: '#a8916a', sticky: '#fff1a6', stickyEdge: '#e2c95a', stickyBad: '#ffd2c8', stickyBadEdge: '#e09a88',
    heartEmpty: { o: '#a8946e', h: '#f3e8cf', f: '#e4d6b4', s: '#d6c6a0' },
    tabText: '#fff6e4', tabDim: '#f3e4c8', tabMix: -0.28, footer: '#8a7759', head: '#2e2116',
  }),
  // 平成: a black システム手帳 with six rings and white 方眼 refills
  system: P({
    id: 'system', dark: false,
    bg: '#0c0d12', cover: '#24252d', coverHi: '#3a3c48', coverLo: '#15161b', grain: ['#1d1e25', '#2c2d36'], stitch: '#6e7080',
    paper: '#fbfaf3', paper2: '#e9e7dc', paperEdge: '#c8c5b6', rule: '#dfe7ef', margin: '#f0a0a0', rings: true,
    ink: { [COLORS.text]: '#1b2238', [COLORS.dim]: '#69718c', [COLORS.accent]: '#b65f00', [COLORS.good]: '#1f7d39', [COLORS.bad]: '#c4202f', [COLORS.pink]: '#b8326f', [COLORS.cyan]: '#156aa8', '#ffffff': '#1b2238' },
    track: '#e4e8ee', trackEdge: '#9aa3b6', sticky: '#fff3a0', stickyEdge: '#e6cf55', stickyBad: '#ffd6dc', stickyBadEdge: '#e8a0aa',
    heartEmpty: { o: '#9aa0b4', h: '#fbfaf3', f: '#e6e8ee', s: '#d8dbe4' },
    tabText: '#ffffff', tabDim: '#f2f4fa', tabMix: -0.15, footer: '#7a8198', head: '#1b2238',
  }),
  // 令和: a digital notebook (tablet-like dark pages, flat tabs)
  digital: P({
    id: 'digital', dark: true,
    bg: '#070a16', cover: '#10162b', coverHi: '#1d2748', coverLo: '#0a0f20', grain: null, stitch: null,
    paper: '#121a35', paper2: '#0d1430', paperEdge: '#2c3a6e', rule: '#1a2346', margin: null,
    ink: {}, track: '#2a2f55', trackEdge: '#06081a', sticky: 'rgba(255,210,63,0.13)', stickyEdge: COLORS.accent, stickyBad: 'rgba(255,93,108,0.14)', stickyBadEdge: COLORS.bad,
    heartEmpty: { o: '#555a80', h: '#2e3460', f: '#232a52', s: '#1e2448' },
    tabText: '#ffffff', tabDim: '#c6cbe6', tabMix: -0.55, footer: COLORS.dim, head: '#ffffff',
  }),
};

export const themeFor = (era) => (era === 'showa' ? THEMES.leather : era === 'heisei' || era === 'heisei_early' ? THEMES.system : THEMES.digital);

// a colour as ink on the theme's paper: the known UI colours map to inks, any other bright
// hex is darkened; dark themes keep everything
export function ink(th, c) {
  if (!c || th.dark) return c;
  const m = th.ink[c];
  if (m) return m;
  return /^#[0-9a-f]{6}$/i.test(c) ? shade(c, -0.42) : c;
}

// ---------------------------------------------------------------- cover + paper (cached)
const cache = new Map();
export function drawBackdrop(ctx, th, L) {
  const key = th.id + '|' + L.id;
  let cv = cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = SW;
    cv.height = SH;
    const c = cv.getContext('2d');
    drawCover(c, th);
    drawPaper(c, th, L.page);
    cache.set(key, cv);
  }
  ctx.drawImage(cv, 0, 0, SW, SH);
  return cv;
}
// part of the cached paper (the turning page's back)
export function drawPaperPart(ctx, th, L, x, y, w, h) {
  const cv = cache.get(th.id + '|' + L.id);
  if (!cv || w <= 0 || h <= 0) return;
  ctx.drawImage(cv, x, y, w, h, x, y, w, h);
}

function drawCover(c, th) {
  rect(c, 0, 0, SW, SH, th.bg);
  const x = 2, y = 2, w = SW - 4, h = SH - 4;
  if (th.dark) {
    // a tablet: dark bezel with a soft vertical gradient
    for (let i = 0; i < h; i++) rect(c, x, y + i, w, 1, shade(th.cover, (i / h) * 0.25));
    rect(c, x, y, w, 1, th.coverHi);
    return;
  }
  rect(c, x - 1, y - 1, w + 2, h + 2, '#000000');
  rect(c, x, y, w, h, th.cover);
  rect(c, x, y, w, 1, th.coverHi);
  rect(c, x, y, 1, h, th.coverHi);
  rect(c, x, y + h - 2, w, 2, th.coverLo);
  rect(c, x + w - 2, y, 2, h, th.coverLo);
  // leather grain (deterministic)
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = th.grain[i & 1];
    c.fillRect(x + 3 + Math.floor(rnd() * (w - 6)), y + 3 + Math.floor(rnd() * (h - 6)), 1 + (i % 3 === 0 ? 1 : 0), 1);
  }
  // stitching along the edge
  c.fillStyle = th.stitch;
  for (let xx = x + 6; xx < x + w - 8; xx += 7) { c.fillRect(xx, y + 3, 4, 1); c.fillRect(xx, y + h - 5, 4, 1); }
  for (let yy = y + 6; yy < y + h - 8; yy += 7) { c.fillRect(x + 3, yy, 1, 4); c.fillRect(x + w - 5, yy, 1, 4); }
}

function drawPaper(c, th, p) {
  const { x, y, w, h } = p;
  if (th.dark) {
    rect(c, x + 2, y + 3, w, h, 'rgba(0,0,0,0.45)');
    rect(c, x, y, w, h, th.paperEdge);
    rect(c, x + 1, y + 1, w - 2, h - 2, th.paper);
    // a faint top glow, as a screen
    for (let i = 0; i < 24; i++) rect(c, x + 1, y + 1 + i, w - 2, 1, `rgba(120,150,255,${(0.07 * (24 - i)) / 24})`);
    // corner rounding
    for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) rect(c, cx, cy, 1, 1, th.cover);
    return;
  }
  // stacked pages under the top one
  rect(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.35)');
  rect(c, x + 2, y + 2, w, h, th.paperEdge);
  rect(c, x + 1, y + 1, w, h, th.paper2);
  rect(c, x, y, w, h, th.paperEdge);
  rect(c, x + 1, y + 1, w - 2, h - 2, th.paper);
  if (th.id === 'system') {
    // 方眼: a light dot grid
    c.fillStyle = th.rule;
    for (let yy = y + 10; yy < y + h - 4; yy += 10) for (let xx = x + 26; xx < x + w - 4; xx += 10) c.fillRect(xx, yy, 1, 1);
    // punched holes and the six rings
    const holes = 6;
    for (let i = 0; i < holes; i++) {
      const hy = Math.round(y + 26 + (i * (h - 52)) / (holes - 1));
      rect(c, x + 6, hy - 3, 7, 7, '#c9c6b8');
      rect(c, x + 7, hy - 2, 5, 5, th.cover);
      // ring: a silver loop over the edge
      rect(c, x - 6, hy - 1, 16, 3, '#9aa0ac');
      rect(c, x - 6, hy - 1, 16, 1, '#e4e8f0');
      rect(c, x - 6, hy + 1, 16, 1, '#5d6270');
    }
  } else {
    // 革の手帳: soft fibres and a red margin line
    let s = 11;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    c.fillStyle = th.paper2;
    for (let i = 0; i < 700; i++) c.fillRect(x + 2 + Math.floor(rnd() * (w - 4)), y + 2 + Math.floor(rnd() * (h - 4)), 2, 1);
    // a ribbon bookmark hanging out at the bottom
    const rx = x + w - 130;
    rect(c, rx, y + h - 3, 7, 8, '#a8322a');
    rect(c, rx, y + h - 3, 2, 8, '#c8524a');
    rect(c, rx, y + h + 5, 3, 1, '#a8322a');
    rect(c, rx + 4, y + h + 5, 3, 1, '#a8322a');
  }
  if (th.margin) rect(c, x + 20, y + 4, 1, h - 8, th.margin);
}

// shading at the edge of a turning page; dir > 0: the page leaves to the left
export function pageTurnEdge(ctx, th, x, y, h, dir) {
  const dark = th.dark ? 'rgba(0,0,0,' : 'rgba(60,40,20,';
  for (let i = 0; i < 10; i++) {
    const a = (0.32 * (10 - i)) / 10;
    ctx.fillStyle = dark + a.toFixed(3) + ')';
    ctx.fillRect(dir > 0 ? x + i : x - 1 - i, y, 1, h);
  }
  // the curled back of the page: a light strip on the other side
  ctx.fillStyle = th.dark ? 'rgba(160,180,255,0.18)' : 'rgba(255,255,255,0.55)';
  ctx.fillRect(dir > 0 ? x - 4 : x, y, 4, h);
}

// ---------------------------------------------------------------- icons (12x12)
const ICONS = {
  goal: ['.#..........', '.########...', '.#########..', '.#########..', '.########...', '.#######....', '.#..........', '.#..........', '.#..........', '.#..........', '.#..........', '###.........'],
  life: ['.....##.....', '....####....', '...######...', '..########..', '.##########.', '############', '..#......#..', '..#.##...#..', '..#.##...#..', '..#.##...#..', '..#.##...#..', '..########..'],
  cal: ['..#.....#...', '############', '############', '#..........#', '#.##.##.##.#', '#.##.##.##.#', '#..........#', '#.##.##.##.#', '#.##.##.##.#', '#..........#', '############', '............'],
  owarai: ['....####....', '...######...', '...#.##.#...', '...######...', '....####....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '.....##.....', '...######...', '..########..'],
  contest: ['.##########.', '#.########.#', '#.########.#', '.#.######.#.', '...######...', '....####....', '.....##.....', '.....##.....', '....####....', '...######...', '...######...', '............'],
  neta: ['#########...', '#.......#.#.', '#.#####.#.#.', '#.......#.#.', '#.#####.#.#.', '#.......#.#.', '#.####..#.#.', '#.......#.#.', '#.......#.#.', '#########.#.', '..........#.', '............'],
  law: ['.....##.....', '############', '.#...##...#.', '#.#..##..#.#', '#.#..##..#.#', '###..##..###', '.....##.....', '.....##.....', '.....##.....', '....####....', '..########..', '............'],
  politics: ['.....##.....', '....####....', '....####....', '...######...', '..########..', '############', '#.#.#..#.#.#', '#.#.#..#.#.#', '#.#.#..#.#.#', '############', '############', '............'],
  places: ['...######...', '..########..', '.###....###.', '.###....###.', '.###....###.', '..########..', '..########..', '...######...', '....####....', '.....##.....', '.....##.....', '............'],
  record: ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '...######...', '..########..', '..###..###..', '.###....###.', '.##......##.', '............'],
  more: ['............', '..#.........', '..##........', '..###.......', '..####......', '..#####.....', '..######....', '..#####.....', '..####......', '..###.......', '..##........', '..#.........'],
};
export function icon(ctx, id, x, y, color, s = 1) {
  const bm = ICONS[id];
  if (!bm) return;
  ctx.fillStyle = color;
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < 12; j++) {
    const row = bm[j];
    for (let i = 0; i < 12; i++) if (row.charCodeAt(i) === 35) ctx.fillRect(x + i * s, y + j * s, s, s);
  }
}
