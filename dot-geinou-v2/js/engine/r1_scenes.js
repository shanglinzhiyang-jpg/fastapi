// R-1 / ABC の HD 画面 (owner: E3) — shared by contest_r1.js and contest_abc.js.
// 640x360 scenes in the style of the other HD screens: every string is measured (fit / jwrap) so nothing
// overflows; keyboard (A/B) and touch (a tap = A) both close a card. Under g.auto (scripted tests)
// cards close at once.
//
//   stage(g, { set, theme, sign, sub, cast, fx, overlay })  → an opaque backdrop scene (pushed; returns it).
//        Change it in place (st.set = 'gakuya'; st.cast = [...]) and remove it with unstage(g, st).
//        sets: lobby 受付 · gakuya 楽屋 · sode 舞台袖 · hall 予選の劇場 · studio 決勝のテレビスタジオ ·
//              rehearsal 決勝のリハーサル · press 会見場 · home 自宅（鏡） · street 街頭ビジョン · cafe 打ち合わせ
//        cast: [{ look, x, y, dir, k (1|2), bob, label, face }]; fx: { flash, beams, crowd, confetti, dark, mic, flip, zabuton }
//   card(g, draw(c, sc, g), opts) → Promise; a card over the stage (opts: min frames before A, life, value, dim).
//   THEMES (r1old / r1new / abcold / abcnew), drawing helpers (T, fit, jwrap, para, box, drawBig, faceAt,
//   confetti, beams), drumroll(g, n).
import { SW, SH, clamp } from './util.js';
import { text, measure } from './draw.js';
import { charSheetHD, drawFaceHD } from './sprites.js';
import { audio } from './audio.js';

export const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };

// ================================================================ themes
export const THEMES = {
  // R-1ぐらんぷり (2002–2020): warm crimson and gold
  r1old: { id: 'r1old', bg: '#1b0609', bg2: '#2c0a10', main: '#c8102e', dark: '#5a0614', acc: '#f2c14e', acc2: '#fff1c2', ink: '#ffffff', floor: '#3a1216', floor2: '#4e1a1f', curtain: '#9e0f26', curtain2: '#6e0a1a', led: '#ff3b52', logo: 'R-1ぐらんぷり', sub: 'ピン芸日本一決定戦', board: '#fff8e6' },
  // R-1グランプリ (2021–): black, white and a hard neon red
  r1new: { id: 'r1new', bg: '#07070b', bg2: '#121219', main: '#e60033', dark: '#2a0710', acc: '#ffffff', acc2: '#ffd1da', ink: '#ffffff', floor: '#16161e', floor2: '#22222c', curtain: '#1d1d26', curtain2: '#101016', led: '#ff2a4f', logo: 'R-1グランプリ', sub: 'ひとり芸日本一決定戦', board: '#f4f4f8' },
  // ABC (朝日放送, 1980–2011): navy, gold and vermilion — an Osaka studio of the time
  abcold: { id: 'abcold', bg: '#0b1330', bg2: '#13204a', main: '#1d3f96', dark: '#0a1a44', acc: '#e8b84a', acc2: '#fff0c4', ink: '#ffffff', floor: '#3a2a18', floor2: '#4e3820', curtain: '#b8342a', curtain2: '#8a2218', led: '#ffcf5a', logo: 'ABC', sub: '朝日放送', board: '#fffaf0' },
  // ABCお笑いグランプリ (2012–): sky blue, yellow and white — ABCテレビの大阪のスタジオ
  abcnew: { id: 'abcnew', bg: '#04142c', bg2: '#0a2448', main: '#0a6fd6', dark: '#06325e', acc: '#ffd400', acc2: '#fff6bf', ink: '#ffffff', floor: '#0d2a4e', floor2: '#123a66', curtain: '#0a4f9e', curtain2: '#073a76', led: '#38b6ff', logo: 'ABCお笑いグランプリ', sub: 'ABCテレビ', board: '#f6fbff' },
};

// ================================================================ text (no overflow: every string has a width)
export function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
export function T(c, s, x, y, size = 12, color = '#ffffff', align = 'left', w = 0, opt = {}) {
  text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: opt.shadow === undefined ? null : opt.shadow, outline: opt.outline || null });
}
// A size that makes s fit in w (down to min).
export function sizeFor(c, s, w, size, min = 8) {
  let k = size;
  while (k > min && measure(c, s, k) > w) k--;
  return k;
}
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const TOKEN = /[−\-]?[0-9０-９]+(?:[.,][0-9]+)*(?:[%％年月日歳人分秒万億円組回位点票]+)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
export function jwrap(c, str, w, size = 12) {
  measure(c, '', size);
  const Wd = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = par.match(TOKEN) || [];
    let line = '';
    for (const t of toks) {
      if (!line && /^\s+$/.test(t)) continue;
      if (Wd(line + t) <= w) { line += t; continue; }
      if (!line) { for (const ch of Array.from(t)) { if (line && Wd(line + ch) > w) { out.push(line); line = ''; } line += ch; } continue; }
      let carry = '';
      if (Array.from(t).length === 1 && NO_START.has(t)) { const a0 = Array.from(line); carry = a0.pop(); line = a0.join(''); }
      while (line.length > 1 && NO_END.has(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
      out.push(line);
      line = carry + (/^\s+$/.test(t) ? '' : t);
    }
    out.push(line);
  }
  return out;
}
export function para(c, s, x, y, w, size = 12, color = '#ffffff', lh = 0, maxLines = 99, align = 'left') {
  const ls = jwrap(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], align === 'center' ? x + w / 2 : x, y + i * step, size, color, align, w);
  return n * step;
}

// ================================================================ shapes
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function box(c, x, y, w, h, fill, edge, inner) {
  R(c, x, y, w, h, edge || '#000');
  R(c, x + 1, y + 1, w - 2, h - 2, fill);
  if (inner) { R(c, x + 2, y + 2, w - 4, 1, inner); R(c, x + 2, y + 2, 1, h - 4, inner); }
}
export function frame(c, x, y, w, h, col) { R(c, x, y, w, 1, col); R(c, x, y + h - 1, w, 1, col); R(c, x, y, 1, h, col); R(c, x + w - 1, y, 1, h, col); }
export function alpha(c, a, fn) { const o = c.globalAlpha; c.globalAlpha = o * clamp(a, 0, 1); try { fn(); } finally { c.globalAlpha = o; } }
// the HD character (32x40 frames) at k = 1 or 2
export function drawBig(c, look, dir, x, y, k = 2, frame0 = 0) {
  if (!look) return;
  const sheet = charSheetHD(look);
  const list = sheet[dir] || sheet.down;
  const img = list[frame0] || list[0];
  c.drawImage(img, Math.round(x), Math.round(y), 32 * k, 40 * k);
}
export function shadowAt(c, x, y, w = 36) { alpha(c, 0.35, () => { R(c, x - w / 2, y - 2, w, 4, '#000'); R(c, x - w / 2 + 4, y - 3, w - 8, 6, '#000'); }); }
export function faceAt(c, look, x, y, scale = 1) { if (look) drawFaceHD(c, look, x, y, scale); }
const CONF = ['#ffd23f', '#ff5d8f', '#5fd7ff', '#5ee07a', '#ffffff', '#ff8a3d'];
export function confetti(c, t, n = 120, top = 0) {
  for (let i = 0; i < n; i++) {
    const sp = 0.7 + (i % 5) * 0.3;
    const x = ((i * 73) % (SW + 30)) - 15 + Math.sin((t + i * 17) / 16) * 8;
    const y = top + ((t * sp * 1.6 + i * 41) % (SH + 30)) - 15;
    R(c, x, y, (Math.floor((t + i * 7) / 7) % 2) ? 3 : 5, 3, CONF[i % CONF.length]);
  }
}
export function beams(c, t, color, n = 5, top = 0, bottom = 260) {
  alpha(c, 0.13, () => {
    c.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x0 = 60 + i * ((SW - 120) / Math.max(1, n - 1));
      const sw = Math.sin(t / 50 + i * 1.3) * 120;
      c.beginPath();
      c.moveTo(x0 - 6, top);
      c.lineTo(x0 + 6, top);
      c.lineTo(x0 + sw + 46, bottom);
      c.lineTo(x0 + sw - 46, bottom);
      c.closePath();
      c.fill();
    }
  });
}
function spotlight(c, cx, top, bottom, w, color = '#fff6d8', a = 0.16) {
  alpha(c, a, () => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(cx - 10, top);
    c.lineTo(cx + 10, top);
    c.lineTo(cx + w / 2, bottom);
    c.lineTo(cx - w / 2, bottom);
    c.closePath();
    c.fill();
  });
  alpha(c, a * 1.6, () => { c.fillStyle = color; c.beginPath(); c.ellipse(cx, bottom, w / 2, 9, 0, 0, Math.PI * 2); c.fill(); });
}
export function micStand(c, x, y, h = 60, col = '#c8ccd4') {
  R(c, x - 1, y - h, 3, h, col);
  R(c, x - 3, y - h - 8, 7, 10, '#3a3a44');
  R(c, x - 2, y - h - 7, 5, 8, '#6a6a78');
  R(c, x - 12, y - 2, 25, 3, '#4a4a54');
  R(c, x - 8, y - 4, 17, 2, '#6a6a78');
}
export function flipEasel(c, x, y, s = '', col = '#ffffff') {
  R(c, x - 2, y - 46, 3, 48, '#7a5a38');
  R(c, x + 24, y - 46, 3, 48, '#7a5a38');
  R(c, x - 6, y - 74, 38, 30, '#20232a');
  R(c, x - 5, y - 73, 36, 28, col);
  if (s) T(c, s, x + 13, y - 66, 10, '#20232a', 'center', 34);
}
export function zabuton(c, x, y) { R(c, x - 24, y - 6, 48, 10, '#7a1428'); R(c, x - 22, y - 5, 44, 3, '#a82040'); R(c, x - 2, y - 4, 4, 4, '#f2c14e'); }
function crowdRow(c, t, y, n, cols, seed = 0, react = 0) {
  for (let i = 0; i < n; i++) {
    const x = Math.round((i + 0.5) * (SW / n)) + ((i * 7 + seed) % 5) - 2;
    const hop = react > 0 && Math.floor(t / 6 + i) % 4 === 0 ? -react : 0;
    const col = cols[(i + seed) % cols.length];
    R(c, x - 9, y + hop, 18, 14, col);
    R(c, x - 6, y - 9 + hop, 12, 11, col);
    R(c, x - 5, y - 8 + hop, 10, 3, 'rgba(255,255,255,0.08)');
  }
}

// ================================================================ the sets
function wall(c, th, top, h, a, b) {
  for (let y = 0; y < h; y += 4) R(c, 0, top + y, SW, 4, (y / 4) % 2 ? a : b);
}
function floorBands(c, top, a, b) { for (let y = top, i = 0; y < SH; y += 6 + i, i++) R(c, 0, y, SW, 6 + i, i % 2 ? a : b); }
function signBoard(c, x, y, w, h, s, sub, th) {
  box(c, x, y, w, h, th.main, th.acc);
  const k = sizeFor(c, s, w - 16, sub ? 16 : 18, 9);
  T(c, s, x + w / 2, y + (sub ? 5 : (h - k) / 2), k, th.ink, 'center', w - 12, { shadow: 'rgba(0,0,0,0.5)' });
  if (sub) T(c, sub, x + w / 2, y + h - 16, 11, th.acc2, 'center', w - 12);
}
function logoText(c, th, x, y, size = 30, w = 300) {
  const s = th.logo;
  const k = sizeFor(c, s, w, size, 12);
  T(c, s, x, y, k, th.ink, 'center', w, { outline: th.main });
}
function drawCast(c, st, g) {
  for (const p of st.cast || []) {
    if (!p || !p.look) continue;
    const k = p.k || 1;
    const bob = p.bob ? (Math.floor((st.t + (p.phase || 0)) / 14) % 2) : 0;
    shadowAt(c, p.x + 16 * k, p.y + 40 * k - 1, 22 * k);
    drawBig(c, p.look, p.dir || 'down', p.x, p.y - bob, k, p.walk ? Math.floor(st.t / 10) % 3 : 0);
    if (p.label) {
      const w = Math.max(30, measure(c, p.label, 10) + 8);
      const lx = p.x + 16 * k - w / 2;
      box(c, lx, p.y + 40 * k + 1, w, 13, 'rgba(10,10,20,0.85)', p.labelCol || '#ffffff');
      T(c, p.label, lx + w / 2, p.y + 40 * k + 2, 10, p.labelCol || '#ffffff', 'center', w - 4);
    }
  }
}

const SETS = {
  lobby(c, st, th) {
    wall(c, th, 0, 200, '#e9e4da', '#efebe3');
    R(c, 0, 196, SW, 4, '#b8b0a0');
    floorBands(c, 200, '#cfc8bb', '#d8d2c6');
    // banner
    signBoard(c, 150, 18, 340, 48, st.sign || th.logo, st.sub || '受付', th);
    // posters
    for (let i = 0; i < 2; i++) {
      const x = i ? 520 : 40;
      box(c, x, 30, 80, 104, th.dark, '#20232a');
      R(c, x + 6, 36, 68, 56, th.main);
      T(c, th.logo, x + 40, 100, 10, th.acc, 'center', 72);
      T(c, i ? '観覧募集' : '出場者募集', x + 40, 116, 9, '#ffffff', 'center', 72);
      alpha(c, 0.25, () => R(c, x + 10, 40, 30, 50, '#ffffff'));
    }
    // reception desk
    R(c, 150, 150, 340, 46, '#5a4630');
    R(c, 150, 150, 340, 6, '#7a6040');
    R(c, 158, 160, 324, 30, '#4a3a28');
    T(c, '受付', 320, 165, 14, '#ffe9b0', 'center');
    // rope line
    for (let x = 40; x < 140; x += 30) { R(c, x, 200, 4, 40, '#c0a050'); R(c, x - 2, 198, 8, 4, '#e0c070'); }
    R(c, 40, 210, 100, 3, '#b8202a');
  },
  gakuya(c, st, th) {
    wall(c, th, 0, 190, '#d9cdb8', '#e1d6c3');
    R(c, 0, 188, SW, 4, '#9a8a70');
    floorBands(c, 192, '#8a7a62', '#94846a');
    // the long mirror with bulbs
    box(c, 70, 34, 500, 96, '#a8c0d0', '#3a3a44');
    alpha(c, 0.35, () => { for (let i = 0; i < 6; i++) R(c, 90 + i * 84, 40, 22, 84, '#ffffff'); });
    for (let i = 0; i < 16; i++) { const lit = (i + Math.floor(st.t / 30)) % 9 !== 0; R(c, 74 + i * 32, 28, 8, 6, lit ? '#fff3b0' : '#8a8460'); }
    // table
    R(c, 60, 140, 520, 16, '#6a4a2a');
    R(c, 60, 140, 520, 3, '#8a6a42');
    // bento & bottles
    for (let i = 0; i < 4; i++) { R(c, 100 + i * 120, 128, 26, 12, '#2a2a2a'); R(c, 102 + i * 120, 129, 22, 4, '#d84030'); R(c, 140 + i * 120, 120, 6, 20, '#5fb8e8'); }
    // the running order on the wall
    box(c, 590, 40, 44, 120, '#fffdf4', '#3a3a44');
    T(c, '出番表', 612, 44, 9, '#20232a', 'center');
    for (let i = 0; i < 9; i++) R(c, 596, 60 + i * 11, 32, 2, i === (st.fx && st.fx.myRow) ? th.main : '#9a9aa8');
    if (st.sign) T(c, st.sign, 12, 6, 11, '#3a3020', 'left', 560);
  },
  sode(c, st, th) {
    R(c, 0, 0, SW, SH, '#07070c');
    // light spill from the stage (right)
    alpha(c, 0.22, () => { c.fillStyle = '#fff2c8'; c.beginPath(); c.moveTo(SW, 0); c.lineTo(SW, 300); c.lineTo(360, 300); c.lineTo(440, 0); c.fill(); });
    // curtain edge
    for (let i = 0; i < 9; i++) R(c, 430 + i * 8, 0, 8, 300, i % 2 ? th.curtain : th.curtain2);
    floorBands(c, 270, '#141018', '#1a141e');
    // monitor
    box(c, 30, 40, 130, 84, '#0c0c12', '#4a4a58');
    R(c, 38, 48, 114, 64, th.bg2);
    R(c, 38, 96, 114, 16, th.floor2);
    micStand(c, 95, 104, 30);
    T(c, 'モニター', 95, 128, 9, '#9a9aa8', 'center');
    // cables & tape marks
    R(c, 0, 296, 420, 2, '#2a2a34');
    R(c, 300, 284, 26, 4, '#f2c14e');
    T(c, st.sign || '舞台袖', 12, 6, 11, '#8a8a9a', 'left', 400);
  },
  hall(c, st, th) {
    R(c, 0, 0, SW, SH, th.bg);
    // proscenium
    R(c, 0, 0, SW, 26, th.dark);
    for (let i = 0; i < 12; i++) { R(c, i * 9, 26, 9, 220, i % 2 ? th.curtain : th.curtain2); R(c, SW - (i + 1) * 9, 26, 9, 220, i % 2 ? th.curtain : th.curtain2); }
    R(c, 108, 26, SW - 216, 168, th.bg2);
    for (let i = 0; i < 40; i++) R(c, 108 + i * 11, 26, 11, 14, i % 2 ? th.curtain : th.curtain2);
    // stage floor
    R(c, 60, 194, SW - 120, 52, th.floor2);
    for (let i = 0; i < 6; i++) R(c, 60, 196 + i * 8, SW - 120, 1, th.floor);
    R(c, 60, 194, SW - 120, 3, th.acc);
    // banner
    signBoard(c, 190, 44, 260, 40, st.sign || th.logo, st.sub || '', th);
    spotlight(c, 320, 26, 236, 150);
    if (st.fx && st.fx.flip) flipEasel(c, 384, 236, st.fx.flip, '#ffffff');
    if (st.fx && st.fx.zabuton) zabuton(c, 320, 240);
  },
  studio(c, st, th) {
    R(c, 0, 0, SW, SH, th.bg);
    // LED wall
    R(c, 70, 10, 500, 150, th.dark);
    for (let i = 0; i < 25; i++) for (let j = 0; j < 7; j++) {
      const on = (i * 3 + j * 5 + Math.floor(st.t / 8)) % 11 < 3;
      R(c, 74 + i * 20, 14 + j * 20, 18, 18, on ? th.led : th.bg2);
    }
    alpha(c, 0.9, () => R(c, 150, 46, 340, 74, th.bg));
    logoText(c, th, 320, 54, 30, 320);
    T(c, st.sign || th.sub, 320, 96, 13, th.acc, 'center', 320);
    // steps / floor
    for (let i = 0; i < 4; i++) R(c, 110 - i * 20, 160 + i * 10, SW - 220 + i * 40, 10, i % 2 ? th.floor : th.floor2);
    R(c, 0, 200, SW, 70, th.floor);
    for (let i = 0; i < 7; i++) R(c, 0, 204 + i * 9, SW, 1, th.floor2);
    if (!(st.fx && st.fx.dark)) beams(c, st.t, th.acc2, 6, 0, 250);
    spotlight(c, 320, 0, 248, 170, '#ffffff', 0.12);
    if (st.fx && st.fx.flip) flipEasel(c, 386, 248, st.fx.flip);
    if (st.fx && st.fx.zabuton) zabuton(c, 320, 252);
    // judges' desk (left) and the MC stand (right)
    if (st.fx && st.fx.judges) {
      // the judges' desk (stage left), above the message window
      const J = st.fx.judges;
      const n = Math.max(1, J.length);
      const w = Math.min(34, 200 / n);
      const dw = w * n + 8;
      J.forEach((j, i) => faceAt(c, j.look, 8 + i * w + w / 2 - 12, 150, 0.75));
      R(c, 4, 166, dw, 44, '#20232a');
      R(c, 4, 166, dw, 3, th.acc);
      J.forEach((j, i) => {
        const x = 8 + i * w;
        R(c, x + 1, 172, w - 2, 12, '#f4f4f8');
        T(c, j.short || j.name, x + w / 2, 173, 8, '#20232a', 'center', w - 3);
        if (j.show != null) { box(c, x + 1, 187, w - 2, 16, th.main, th.acc); T(c, String(j.show), x + w / 2, 189, 10, '#ffffff', 'center', w - 3); }
      });
    }
    if (st.fx && st.fx.crowd !== false) crowdRow(c, st.t, 262, 22, ['#15151d', '#1b1b25', '#121219'], 3, st.fx && st.fx.react ? 3 : 0);
    if (st.fx && st.fx.ticker) {
      R(c, 0, SH - 22, SW, 22, th.main);
      const s = st.fx.ticker;
      const w = measure(c, s, 12) + 60;
      const off = (st.t * 1.4) % (w + SW);
      T(c, s, SW - off, SH - 18, 12, '#ffffff');
    }
  },
  rehearsal(c, st, th) {
    SETS.studio(c, { ...st, fx: { ...(st.fx || {}), crowd: false, dark: true } }, th);
    alpha(c, 0.3, () => R(c, 0, 0, SW, SH, '#d8d8e0'));
    // staff with scripts
    R(c, 0, 296, SW, 64, '#2a2a34');
    T(c, 'リハーサル中', 12, 6, 12, '#20232a', 'left', 200, { shadow: null });
  },
  press(c, st, th) {
    R(c, 0, 0, SW, SH, '#e8e8ee');
    // step and repeat
    for (let y = 0; y < 220; y += 36) for (let x = (y / 36) % 2 ? -40 : 0; x < SW; x += 120) {
      T(c, th.logo, x + 60, y + 10, 12, th.main, 'center', 112);
    }
    R(c, 0, 220, SW, 140, '#8a1a2a');
    R(c, 0, 220, SW, 4, th.acc);
    signBoard(c, 170, 228, 300, 34, st.sign || '決勝進出者発表会見', st.sub || '', th);
    if (st.fx && st.fx.flash) {
      for (let i = 0; i < 4; i++) {
        const k = (st.t * 7 + i * 53) % 90;
        if (k < 6) alpha(c, 0.7, () => { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(40 + ((i * 157 + st.t) % 560), 300 + (i % 2) * 20, 22 - k * 3, 0, Math.PI * 2); c.fill(); });
      }
    }
  },
  home(c, st) {
    wall(c, null, 0, 210, '#e8dcc4', '#eee3cd');
    floorBands(c, 210, '#b08a5a', '#ba9462');
    // window
    box(c, 40, 30, 120, 90, '#9ad0f0', '#6a5032');
    R(c, 99, 30, 3, 90, '#6a5032');
    R(c, 40, 74, 120, 3, '#6a5032');
    // standing mirror
    box(c, 420, 40, 110, 176, '#bcd8e4', '#7a5a38');
    alpha(c, 0.3, () => { R(c, 434, 50, 12, 150, '#ffffff'); R(c, 452, 50, 5, 150, '#ffffff'); });
    // desk with sketchbooks (フリップ)
    R(c, 180, 170, 180, 12, '#7a5a38');
    R(c, 190, 182, 8, 40, '#6a4a2a');
    R(c, 342, 182, 8, 40, '#6a4a2a');
    for (let i = 0; i < 3; i++) { R(c, 200 + i * 44, 150 - i * 2, 40, 22, '#ffffff'); R(c, 200 + i * 44, 150 - i * 2, 40, 3, '#e04040'); }
    R(c, 340, 156, 4, 14, '#20232a');
    // clock
    R(c, 250, 30, 28, 28, '#ffffff'); frame(c, 250, 30, 28, 28, '#3a3a44'); R(c, 263, 36, 2, 9, '#20232a'); R(c, 263, 44, 8, 2, '#20232a');
    if (st.sign) T(c, st.sign, 12, 6, 11, '#6a5032', 'left', 360);
  },
  cafe(c, st) {
    wall(c, null, 0, 200, '#3a2a22', '#40302a');
    floorBands(c, 200, '#5a4030', '#624636');
    for (let i = 0; i < 5; i++) { R(c, 40 + i * 120, 40, 70, 50, '#f6e2b0'); alpha(c, 0.4, () => R(c, 44 + i * 120, 44, 62, 42, '#ffffff')); }
    R(c, 160, 190, 320, 12, '#7a5030');
    R(c, 300, 202, 40, 50, '#5a3a20');
    if (st.sign) T(c, st.sign, 12, 6, 11, '#e8d8b8', 'left', 360);
  },
  street(c, st, th) {
    // dusk sky, buildings, a big screen
    for (let y = 0; y < 220; y += 4) R(c, 0, y, SW, 4, y < 80 ? '#2a2a5a' : y < 150 ? '#4a3a6a' : '#7a4a5a');
    for (let i = 0; i < 9; i++) {
      const x = i * 74 - 10, h = 120 + ((i * 37) % 70);
      R(c, x, 220 - h, 70, h, '#1a1a2a');
      for (let wy = 230 - h; wy < 210; wy += 14) for (let wx = x + 6; wx < x + 64; wx += 12) if ((wx * 3 + wy) % 7 < 4) R(c, wx, wy, 6, 6, '#ffe9a0');
    }
    box(c, 170, 36, 300, 150, '#000000', '#3a3a44');
    R(c, 176, 42, 288, 138, th.dark);
    if (st.fx && st.fx.vision) { try { st.fx.vision(c, 176, 42, 288, 138, st.t); } catch (e) { console.error(e); } }
    R(c, 0, 220, SW, 140, '#3a3a44');
    for (let i = 0; i < 12; i++) R(c, i * 56, 280, 30, 4, '#e8e8ee');
    if (st.sign) T(c, st.sign, 12, 6, 11, '#e8e8ee', 'left', 360);
  },
};

// ================================================================ the backdrop scene
class StageScene {
  constructor(g, o) {
    Object.assign(this, { g, hd: true, opaque: true, hidesHud: true, isR1Stage: true, t: 0, set: 'hall', theme: THEMES.r1new, sign: '', sub: '', cast: [], fx: {}, overlay: null }, o || {});
    if (typeof this.theme === 'string') this.theme = THEMES[this.theme] || THEMES.r1new;
  }
  update() { this.t++; }
  draw(c, g) {
    const th = typeof this.theme === 'string' ? THEMES[this.theme] || THEMES.r1new : this.theme;
    const fn = SETS[this.set] || SETS.hall;
    try { fn(c, this, th); } catch (e) { console.error(e); R(c, 0, 0, SW, SH, '#000'); }
    drawCast(c, this, g);
    // the stand mic stands in front of the performer (mouth height of a k=2 character)
    if ((this.set === 'hall' || this.set === 'studio' || this.set === 'rehearsal') && this.fx && this.fx.mic !== false && !this.fx.zabuton) micStand(c, 320, this.set === 'hall' ? 236 : 248, this.set === 'hall' ? 34 : 46);
    // the MC's podium stands in front of the MC (stage right)
    if (this.set === 'studio' && this.fx && this.fx.mc) {
      const th = typeof this.theme === 'string' ? THEMES[this.theme] || THEMES.r1new : this.theme;
      R(c, 506, 200, 104, 34, '#20232a'); R(c, 506, 200, 104, 3, th.acc);
      T(c, 'MC', 558, 212, 11, th.acc, 'center');
    }
    if (this.fx && this.fx.confetti) confetti(c, this.t, 140);
    if (this.overlay) { try { this.overlay(c, this, g); } catch (e) { console.error(e); } }
  }
}
export function stage(g, o) {
  const s = new StageScene(g, o);
  g.push(s);
  return s;
}
export function unstage(g, s) { if (s && g.scenes.includes(s)) g.pop(s); }

// ================================================================ cards (wait for A / a tap)
export function card(g, draw, o = {}) {
  return new Promise((resolve) => {
    let done = false;
    const sc = {
      hd: true, isR1Card: true, t: 0, opaque: !!o.opaque, data: o.data || {},
      close(v) { if (done) return; done = true; if (g.scenes.includes(sc)) g.pop(sc); resolve(v ?? o.value ?? null); },
      update(gg) {
        sc.t++;
        if (o.tick) { try { o.tick(sc, gg); } catch (e) { console.error(e); } }
        if (gg.auto) { if (sc.t > (o.autoT ?? 1)) sc.close(); return; }
        if (o.life && sc.t > o.life) { sc.close(); return; }
        if (sc.t > (o.min ?? 18) && (gg.input.pressed('a') || gg.input.pressed('b'))) { sfx('cursor'); sc.close(); }
      },
      draw(c, gg) {
        if (o.dim !== false) alpha(c, o.dimA ?? 0.55, () => R(c, 0, 0, SW, SH, '#000'));
        try { draw(c, sc, gg); } catch (e) { console.error(e); }
        if (!o.noHint && sc.t > (o.min ?? 18) && !o.life) T(c, '▼ A / タップ', SW - 10, SH - 16, 10, '#c8c8d8', 'right', 140);
      },
    };
    g.push(sc);
  });
}

export async function drumroll(g, n = 10) {
  for (let k = 0; k < n; k++) { sfx('snare'); await g.wait(g.auto ? 1 : 70); }
  sfx('drum');
}

// A plain dark card with a title and wrapped lines (shortfall reasons, rules …).
export function infoCard(g, title, lines, o = {}) {
  const th = o.theme || THEMES.r1new;
  return card(g, (c) => {
    const w = o.w || 520, x = (SW - w) / 2;
    const ls = [].concat(lines).filter((l) => l != null);
    let h = 52;
    const wrapped = ls.map((l) => jwrap(c, String(l), w - 40, 12));
    for (const wl of wrapped) h += wl.length * 16 + 4;
    h = Math.min(SH - 20, h + 8);
    const y = Math.max(8, (SH - h) / 2 - 10);
    box(c, x, y, w, h, '#101018', th.acc);
    R(c, x + 1, y + 1, w - 2, 28, th.main);
    T(c, title, x + w / 2, y + 7, 15, '#ffffff', 'center', w - 20);
    let yy = y + 38;
    for (const wl of wrapped) {
      for (const l of wl) { if (yy > y + h - 18) break; T(c, l, x + 20, yy, 12, o.color || '#e8e8f0', 'left', w - 40); yy += 16; }
      yy += 4;
    }
  }, o);
}
