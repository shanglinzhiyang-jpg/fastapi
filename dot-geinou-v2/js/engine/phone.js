// The phone (menu → スマホ) and the people interaction UI.
//
// openPhone(g) slides a pixel-art smartphone over the dimmed map: a home screen
// with app icons (unread badges), and the apps メッセージ / 連絡先 / 予定 / 家計 plus
// every app registered with registerPhoneApp (life.js). d-pad + A/B only:
// B backs out, MENU closes the whole phone.
//
// Also here (installed into PEOPLE_UI of life.js at load):
//   talkPersonUI(g, npc)        talking to an NPC linked to a person: hooks.start, a heart
//                               event first, hooks.before (may take over), then (from the
//                               second talk; the first is their own introduction) a small
//                               menu 話す / プレゼント / さそう (♥2) / [extras] / またね,
//                               hooks.after. Content extends it with PEOPLE_UI.extras
//                               ({ id, label, cond(g, id, npc), run(g, id, npc), repeat,
//                               order }) and PEOPLE_UI.hooks — see life.js; do not replace
//                               PEOPLE_UI.talk.
//   hangoutUI(g, id, spotId)    an HD vignette of the hangout (g.hangout calls it)
//
// ---------------------------------------------------------------- for other modules
// Entry points (each works with the phone open or closed; a closed phone slides in
// and out around the call):
//   openPhone(g)                  the home screen
//   messagesApp(g) / contactsApp(g) / scheduleApp(g) / moneyApp(g)
//   readMessage(g, m)             read one message as dialogue and answer it (invite / offer)
//   answerMessage(g, m, yes)      answer an invite / offer without any dialogue of its own
//   callPerson(g, id)             phone someone (invite them out when ♥2+, once a day)
//
// Apps registered with registerPhoneApp(id, { name, color, order, icon, badge, open })
// show on the home screen. name: short (≤5 chars). icon(ctx, x, y): a 24x24 glyph drawn
// on a 32x32 tile of `color` (or iconHD(ctx, x, y) for the whole 32x32 icon).
// open(g) is async; g.say / g.list work as usual (drawn over the phone), or render
// inside the phone frame with these helpers (all resolve when the player is done):
//   await phoneList(g, { title, color, items: [{ label, sub, right, look, icon(ctx, x, y),
//                        disabled, why }], index, hint, empty, describe: (i) => '…' })
//                        → chosen index, or -1 on B
//   await phoneInfo(g, { title, color, text | lines, draw(ctx, area, view), hint })
//   await phoneConfirm(g, { title, color, text, choices: ['はい', 'いいえ'] })
//                        → index (B = the last choice)
//   await phoneView(g, view)  a custom screen. view: { title, color, bg, noHeader, hint,
//                        cancel, enter(ph), update(ph, input, g), draw(ctx, ph, area, g) };
//                        call ph.back(value) to close it (the promise gets value).
//                        area = { x, y, w, h } in screen px (224 px wide).
// Drawing helpers: appTile, rrect, box, drawHeart, drawHearts, drawBadge, phoneText,
// fitText, nameFit, PHONE / SCREEN (geometry), PC (the phone's colours).
// openPhone(g) resolves with 'menu' when the player closed it with MENU.

import { SW, SH, fmtMoney, clamp, shade, mix, makeCanvas, hash2 } from './util.js';
import { text, wrap, measure, panel, COLORS, downArrow } from './draw.js';
import { drawFaceHD, charSheetHD } from './sprites.js';
import { audio } from './audio.js';
import { ITEMS } from './state.js';
import { PLACES } from './map.js';
import {
  PEOPLE, HEARTS, HANGOUTS, REGULARS, PHONE_APPS, PEOPLE_UI, WEEKDAYS,
  heartIndex, weekdayOf, weekdayName, isKansai, showWords, hangoutMeal,
} from './life.js';

// ---------------------------------------------------------------- geometry & theme
export const PHONE = { x: 200, y: 8, w: 240, h: 344 };
export const SCREEN = { x: 208, y: 30, w: 224, h: 290 };
const STATUS_H = 16;
const HEADER_H = 26;
const FOOTER_H = 16;
const OPEN_F = 12; // frames to slide the phone in / out
const TRANS_F = 10; // frames for a screen transition

export const PC = {
  bg: '#f4f1e8', text: '#2a2a3a', dim: '#7c7a88', line: '#dcd5c4', sel: '#fff1c2', selEdge: '#e0a82e',
  good: '#2f9a4a', bad: '#d6304a', pink: '#ff5d8f', accent: '#e07a1f', foot: '#e7e1d1',
  chat: '#dde5ef', out: '#b8eda0', outEdge: '#3d7a32',
};
const APP_COLORS = { messages: '#43b65d', contacts: '#ff8a3d', schedule: '#4a78d8', money: '#8a5ac8' };
const KIND_TAG = { invite: 'おさそい', offer: 'オファー', bill: '家計', fan: 'ファン', news: 'おしらせ' };
const KIND_COLOR = { invite: '#43b65d', offer: '#e07a1f', bill: '#8a5ac8', fan: '#ff5d8f', news: '#4a78d8', chat: '#8a8a9a' };
const PERSON_KIND = { comedian: '芸人', idol: 'アイドル', actor: '俳優', singer: '歌手', staff: 'スタッフ', local: 'ご近所さん' };

const ease = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;

// ---------------------------------------------------------------- pixel drawing helpers
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

const INSETS = {};
function insets(r) {
  if (!INSETS[r]) {
    const a = [];
    for (let j = 0; j < r; j++) a.push(r - Math.round(Math.sqrt(r * r - (r - j) ** 2)));
    INSETS[r] = a;
  }
  return INSETS[r];
}
// Filled rounded rectangle with stepped (pixel) corners.
export function rrect(c, x, y, w, h, r, col) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  r = Math.max(0, Math.min(r | 0, w >> 1, h >> 1));
  c.fillStyle = col;
  if (!r) { c.fillRect(x, y, w, h); return; }
  const ins = insets(r);
  c.fillRect(x, y + r, w, h - 2 * r);
  for (let j = 0; j < r; j++) {
    const k = ins[j];
    c.fillRect(x + k, y + j, w - 2 * k, 1);
    c.fillRect(x + k, y + h - 1 - j, w - 2 * k, 1);
  }
}
// Outlined rounded box (1px outline), optional light / shade lines inside.
export function box(c, x, y, w, h, r, fill, outline, opt = {}) {
  rrect(c, x, y, w, h, r, outline);
  rrect(c, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1), fill);
  const k = Math.max(1, r);
  if (opt.hi) { R(c, x + k, y + 1, w - 2 * k, 1, opt.hi); R(c, x + 1, y + k, 1, h - 2 * k, opt.hi); }
  if (opt.lo) { R(c, x + k, y + h - 2, w - 2 * k, 1, opt.lo); R(c, x + w - 2, y + k, 1, h - 2 * k, opt.lo); }
}
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
function dither(c, x, y, w, h, col, ph = 0) {
  c.fillStyle = col;
  for (let j = 0; j < h; j++) for (let i = (j + ph) & 1; i < w; i += 2) c.fillRect(x + i, y + j, 1, 1);
}
// String pixel art: rows of chars, pal maps a char to a colour ('.' = clear).
function art(c, x, y, rows, pal, s = 1) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col) { c.fillStyle = col; c.fillRect(x + i * s, y + j * s, s, s); }
    }
  }
}
const cache = {};
function cached(key, w, h, fn) {
  if (!cache[key]) { const [cv, c] = makeCanvas(w, h); fn(c); cache[key] = cv; }
  return cache[key];
}

// Text without the default drop shadow (the phone screens are light).
export function phoneText(c, s, x, y, size = 12, color = PC.text, align = 'left') {
  text(c, s, Math.round(x), Math.round(y), { size, color, align, shadow: null });
}
const T = phoneText;
// Cut a string with '…' so it fits maxW.
export function fitText(c, s, maxW, size = 12) {
  s = String(s);
  if (measure(c, s, size) <= maxW) return s;
  const ch = Array.from(s);
  while (ch.length && measure(c, ch.join('') + '…', size) > maxW) ch.pop();
  return ch.join('') + '…';
}
const oneLine = (s) => String(s || '').replace(/\s*\n\s*/g, ' ');
// A person's name for a narrow spot: the full name, else def.short, else cut.
export function nameFit(c, def, maxW, size = 14) {
  const full = String((def && def.name) || '？？？');
  if (measure(c, full, size) <= maxW) return full;
  if (def && def.short && measure(c, def.short, size) <= maxW) return def.short;
  return fitText(c, full, maxW, size);
}

const HEART = ['..oo.oo..', '.ohfoffo.', 'ohffffffo', 'offffffso', '.offffso.', '..offso..', '...ofo...', '....o....'];
const HEART_PAL = {
  full: { o: '#7a1a3a', f: '#ff5d8f', h: '#ffc2d6', s: '#d63a6a' },
  empty: { o: '#a898b0', f: '#ece4ee', h: '#ffffff', s: '#d8cede' },
  dark: { o: '#0e0c1a', f: '#3e3858', h: '#4e4870', s: '#34304c' },
  white: { o: '#7a1a3a', f: '#ffffff', h: '#ffffff', s: '#ffd6e4' },
};
// 9x8 pixel heart (s = pixel size). style: 'light' | 'dark' background for an empty one.
export function drawHeart(c, x, y, full = true, s = 1, style = 'light') {
  art(c, Math.round(x), Math.round(y), HEART, full ? HEART_PAL.full : style === 'dark' ? HEART_PAL.dark : HEART_PAL.empty, s);
}
export function drawHearts(c, x, y, level, s = 1, style = 'light') {
  for (let i = 0; i < 4; i++) drawHeart(c, x + i * 10 * s, y, i < level, s, style);
}
// Red unread badge centred on (x, y).
export function drawBadge(c, x, y, n) {
  const s = n > 99 ? '99+' : String(n);
  const w = Math.max(14, Math.ceil(measure(c, s, 12)) + 8);
  rrect(c, x - w / 2, y - 7, w, 14, 6, '#6a0a1a');
  rrect(c, x - w / 2 + 1, y - 6, w - 2, 12, 5, '#ff3b4f');
  R(c, x - w / 2 + 4, y - 5, w - 8, 1, '#ff8a96');
  text(c, s, Math.round(x), Math.round(y - 6), { size: 12, align: 'center', color: '#fff', shadow: null });
}

// ---------------------------------------------------------------- icons
// The rounded 32x32 tile every app icon sits on, lit from the top left.
export function appTile(c, x, y, color) {
  rrect(c, x, y, 32, 32, 7, shade(color, -0.6));
  rrect(c, x + 1, y + 1, 30, 30, 6, color);
  R(c, x + 6, y + 1, 20, 1, shade(color, 0.35));
  R(c, x + 1, y + 6, 1, 20, shade(color, 0.35));
  R(c, x + 6, y + 30, 20, 1, shade(color, -0.22));
  R(c, x + 30, y + 6, 1, 20, shade(color, -0.22));
  R(c, x + 3, y + 3, 2, 2, shade(color, 0.5));
}
const YEN = ['#...#', '.#.#.', '..#..', '#####', '..#..', '#####', '..#..'];
const GLYPHS = {
  messages(c) {
    appTile(c, 0, 0, APP_COLORS.messages);
    const O = '#1d5a2c', W = '#ffffff';
    rrect(c, 5, 6, 22, 16, 5, O);
    rrect(c, 6, 7, 20, 14, 4, W);
    R(c, 9, 19, 14, 1, '#d4ecd9');
    R(c, 8, 21, 1, 4, O); R(c, 9, 21, 3, 1, W); R(c, 12, 21, 1, 1, O);
    R(c, 9, 22, 2, 1, W); R(c, 11, 22, 1, 1, O);
    R(c, 9, 23, 1, 1, W); R(c, 10, 23, 1, 1, O); R(c, 9, 24, 1, 1, O);
    for (const x of [10, 15, 20]) { R(c, x, 12, 3, 3, '#5a7a64'); R(c, x, 12, 1, 1, '#8aa894'); }
  },
  contacts(c) {
    appTile(c, 0, 0, APP_COLORS.contacts);
    const O = '#7a3410', F = '#fff4e6', S = '#f0d2b4';
    rrect(c, 7, 18, 18, 11, 5, O);
    rrect(c, 8, 19, 16, 10, 4, F);
    R(c, 19, 21, 3, 7, S);
    R(c, 7, 28, 18, 1, O);
    disc(c, 16, 12, 6, O);
    disc(c, 16, 12, 5, F);
    R(c, 18, 10, 2, 5, S);
    R(c, 13, 9, 2, 2, '#ffffff');
  },
  schedule(c) {
    appTile(c, 0, 0, APP_COLORS.schedule);
    const O = '#1e2f6a';
    rrect(c, 6, 8, 20, 19, 3, O);
    rrect(c, 7, 9, 18, 17, 2, '#ffffff');
    rrect(c, 7, 9, 18, 6, 2, '#e8484f');
    R(c, 7, 13, 18, 2, '#e8484f');
    R(c, 7, 15, 18, 1, '#b8303a');
    R(c, 11, 6, 2, 5, O); R(c, 19, 6, 2, 5, O);
    R(c, 11, 6, 1, 1, '#8aa0e0'); R(c, 19, 6, 1, 1, '#8aa0e0');
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) R(c, 9 + k * 4, 17 + r * 3, 2, 2, r === 1 && k === 2 ? '#e8484f' : '#9aa3c7');
  },
  money(c) {
    appTile(c, 0, 0, APP_COLORS.money);
    disc(c, 16, 16, 10, '#5a3a08');
    disc(c, 16, 16, 9, '#ffd23f');
    disc(c, 16, 16, 7, '#e0a82e');
    disc(c, 16, 16, 6, '#ffd23f');
    R(c, 10, 9, 3, 1, '#fff6a8'); R(c, 9, 10, 1, 3, '#fff6a8'); R(c, 10, 10, 1, 1, '#fff6a8');
    art(c, 14, 13, YEN, { '#': '#8a5a10' });
  },
};
// Draws an app's 32x32 icon at (x, y).
export function drawAppIcon(c, x, y, app) {
  try {
    if (app.glyph && GLYPHS[app.glyph]) { c.drawImage(cached('icon_' + app.glyph, 32, 32, GLYPHS[app.glyph]), x, y); return; }
    if (app.iconHD) { app.iconHD(c, x, y); return; }
    appTile(c, x, y, app.color || '#5a6fd8');
    if (app.icon) app.icon(c, x + 4, y + 4);
    else text(c, Array.from(app.name || '?')[0], x + 16, y + 8, { size: 16, align: 'center', color: '#fff' });
  } catch (e) {
    console.error(e);
  }
}

const SMALL_ICONS = {
  bill: ['.....o.....', '....owo....', '...owwwo...', '..owwwwwo..', '.owwwwwwwo.', 'ooowwwwwooo', '..owwdwwo..', '..owwdwwo..', '..ooooooo..'],
  news: ['..o.....o..', '...o...o...', 'ooooooooooo', 'osssssssswo', 'osssssssswo', 'osssssssswo', 'osssssssswo', 'ooooooooooo', '.o.......o.'],
  offer: ['ooooooooooo', 'owkwkwkwkwo', 'ooooooooooo', 'owwwwwwwwwo', 'owwkkkkwwwo', 'owwwwwwwwwo', 'owwkkkwwwwo', 'owwwwwwwwwo', 'ooooooooooo'],
  chat: ['....ooo....', '...owwwo...', '...owwwo...', '...owwwo...', '....ooo....', '..ooooooo..', '.owwwwwwwo.', '.owwwwwwwo.', '.ooooooooo.'],
};
// 32x24 avatar for a sender without a face (bills, news, fan mail…).
function kindAvatar(c, x, y, kind) {
  const col = KIND_COLOR[kind] || KIND_COLOR.chat;
  box(c, x, y, 32, 24, 4, col, shade(col, -0.55), { hi: shade(col, 0.3) });
  if (kind === 'fan' || kind === 'invite') { art(c, x + 12, y + 8, HEART, HEART_PAL.white); return; }
  const rows = SMALL_ICONS[kind] || SMALL_ICONS.chat;
  art(c, x + 11, y + 7, rows, { o: shade(col, -0.6), w: '#ffffff', d: shade(col, -0.3), s: '#bfe6ff', k: '#2a2a3a' });
}
// Face (or kind icon) in a small frame: 34x26.
function avatar(c, x, y, look, kind) {
  if (look) {
    box(c, x, y, 34, 26, 3, '#ffffff', '#3a3a4a');
    drawFaceHD(c, look, x + 1, y + 1, 1);
  } else kindAvatar(c, x + 1, y + 1, kind);
}
// 12x12 icons for the schedule.
function miniIcon(c, x, y, kind) {
  if (kind === 'rent') { disc(c, x + 6, y + 6, 6, '#6a4a10'); disc(c, x + 6, y + 6, 5, '#ffd23f'); art(c, x + 4, y + 3, ['#.#', '.#.', '###', '.#.'], { '#': '#8a5a10' }, 1); R(c, x + 4, y + 7, 3, 1, '#8a5a10'); return; }
  if (kind === 'tv') { R(c, x, y + 2, 12, 9, '#2a2a3a'); R(c, x + 1, y + 3, 10, 7, '#5fd7ff'); R(c, x + 2, y + 4, 3, 1, '#ffffff'); R(c, x + 3, y, 1, 2, '#2a2a3a'); R(c, x + 8, y, 1, 2, '#2a2a3a'); R(c, x + 2, y + 11, 8, 1, '#2a2a3a'); return; }
  if (kind === 'invite') { drawHeart(c, x + 1, y + 2, true); return; }
  if (kind === 'done') { art(c, x + 1, y + 2, ['.........#', '........##', '#......##.', '##....##..', '.##..##...', '..####....', '...##.....'], { '#': PC.good }); return; }
  if (kind === 'miss') { art(c, x + 2, y + 2, ['#......#', '.#....#.', '..#..#..', '...##...', '...##...', '..#..#..', '.#....#.', '#......#'], { '#': PC.bad }); return; }
  R(c, x + 4, y + 4, 4, 4, PC.dim);
}

// Wallpaper of the home screen (night city, flat colour bands with dithered seams).
function wallpaper() {
  return cached('wallpaper', SCREEN.w, SCREEN.h, (c) => {
    const W = SCREEN.w, H = SCREEN.h;
    const bands = ['#191c46', '#20245a', '#292c6a', '#363478', '#473c84', '#5d458c', '#77508f', '#8f5c8e'];
    const bh = 28;
    R(c, 0, 0, W, H, bands[bands.length - 1]);
    bands.forEach((col, i) => R(c, 0, i * bh, W, bh, col));
    for (let i = 1; i < bands.length; i++) { dither(c, 0, i * bh - 2, W, 2, bands[i], 0); dither(c, 0, i * bh, W, 2, bands[i - 1], 1); }
    for (let i = 0; i < 46; i++) {
      const sx = Math.floor(hash2(i, 1, 3) * W), sy = Math.floor(hash2(i, 2, 3) * 150);
      R(c, sx, sy, 1, 1, i % 7 ? '#8a90d0' : '#fff6a8');
      if (i % 11 === 0) { R(c, sx - 1, sy, 3, 1, '#c8ccf0'); R(c, sx, sy - 1, 1, 3, '#c8ccf0'); }
    }
    disc(c, 182, 36, 10, '#fff2b8');
    disc(c, 187, 32, 9, bands[1]);
    R(c, 176, 34, 2, 2, '#ffe28a');
    // far skyline, then near skyline with lit windows
    let x = -4, i = 0;
    while (x < W) {
      const w = 12 + Math.floor(hash2(i, 5, 1) * 16), h = 46 + Math.floor(hash2(i, 6, 1) * 50);
      R(c, x, H - h, w, h, '#2a2556');
      x += w + 1; i++;
    }
    x = -6; i = 0;
    while (x < W) {
      const w = 16 + Math.floor(hash2(i, 7, 2) * 20), h = 24 + Math.floor(hash2(i, 8, 2) * 44);
      R(c, x, H - h, w, h, '#14152e');
      R(c, x, H - h, w, 1, '#262650');
      for (let yy = H - h + 4; yy < H - 4; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) {
        if (hash2(xx, yy, 9) > 0.62) R(c, xx, yy, 2, 3, hash2(xx, yy, 4) > 0.3 ? '#ffd27a' : '#8ac8ff');
      }
      if (i % 3 === 1) { R(c, x + (w >> 1), H - h - 6, 1, 6, '#14152e'); R(c, x + (w >> 1), H - h - 7, 1, 1, '#ff5d6c'); }
      x += w + 2; i++;
    }
  });
}

// ---------------------------------------------------------------- the phone scene
class PhoneScene {
  constructor(g) {
    this.g = g;
    this.hd = true;
    this.hidesHud = true;
    this.isPhone = true;
    this.views = [];
    this.t = 0;
    this.openT = g.auto ? OPEN_F : 0;
    this.closing = null;
    this.dismissed = false;
    this.trans = null;
    this.last = null;
    this.zoomFrom = null;
    this.pressB = 0;
  }
  get view() { return this.views[this.views.length - 1] || null; }

  // Push a view; resolves with the value given to back().
  open(view) {
    if (this.dismissed || this.closing) return Promise.resolve(view.cancel ?? -1);
    return new Promise((resolve) => {
      view._resolve = resolve;
      view.t = 0;
      const prev = this.view;
      if (prev) {
        const rect = this.zoomFrom;
        this.zoomFrom = null;
        if (rect) view._zoom = rect;
        this.trans = { kind: rect ? 'zoom' : 'slide', dir: 1, from: prev, to: view, t: 0, rect };
      }
      this.views.push(view);
      try { if (view.enter) view.enter(this, this.g); } catch (e) { console.error(e); }
    });
  }
  // Close the top view (or `view`), resolving its promise with value.
  back(value, view = this.view) {
    const i = view ? this.views.lastIndexOf(view) : -1;
    if (i < 0) return;
    const top = i === this.views.length - 1;
    this.views.splice(i, 1);
    const under = this.view;
    if (top && under) this.trans = { kind: view._zoom ? 'zoom' : 'slide', dir: -1, from: view, to: under, t: 0, rect: view._zoom };
    this.last = view;
    const r = view._resolve;
    view._resolve = null;
    if (r) r(value);
  }
  // MENU: close every view at once (each resolves with its cancel value).
  dismiss() {
    this.dismissed = true;
    this.trans = null;
    while (this.views.length) {
      const v = this.views.pop();
      this.last = v;
      const r = v._resolve;
      v._resolve = null;
      if (r) r(v.cancel ?? -1);
    }
  }
  // Run an async action from a view; the view ignores input until it is done.
  run(view, fn) {
    view.waiting = true;
    Promise.resolve().then(fn).catch((e) => console.error(e)).finally(() => { view.waiting = false; });
  }
  toast(str, color) { this.g.notify(str, { color: color || COLORS.accent }); }
  // Slide out and leave the scene stack.
  close() {
    if (this.closing) return this.closing.promise;
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    this.closing = { t: 0, resolve, promise };
    if (this.g.auto || !this.g.scenes.includes(this)) this.finishClose();
    return promise;
  }
  finishClose() {
    if (this.closing.done) return;
    this.closing.done = true;
    this.g.pop(this);
    this.closing.resolve();
  }

  update(g) {
    this.t++;
    if (this.pressB > 0) this.pressB--;
    if (this.closing) { if (++this.closing.t >= OPEN_F) this.finishClose(); return; }
    if (this.openT < OPEN_F) this.openT++;
    if (this.trans && ++this.trans.t >= TRANS_F) this.trans = null;
    const v = this.view;
    if (!v || v.waiting) return;
    if (g.auto) { this.back(v.cancel ?? -1); return; }
    v.t++;
    if (g.input.pressed('menu')) { audio.sfx('cancel'); this.dismiss(); return; }
    if (g.input.pressed('b')) this.pressB = 8;
    if (this.openT < 4) return;
    try { v.update(this, g.input, g); } catch (e) { console.error(e); this.back(v.cancel ?? -1, v); }
  }

  draw(ctx, g) {
    const k = this.closing ? 1 - ease(this.closing.t / OPEN_F) : ease(this.openT / OPEN_F);
    ctx.fillStyle = `rgba(6,8,22,${(0.62 * k).toFixed(3)})`;
    ctx.fillRect(0, 0, SW, SH);
    const oy = Math.round((1 - k) * (SH - PHONE.y + 8));
    ctx.save();
    ctx.translate(0, oy);
    this.drawBody(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    ctx.clip();
    this.drawViews(ctx, g);
    this.drawStatus(ctx, g);
    this.drawBanners(ctx, g);
    ctx.restore();
    this.drawHomeButton(ctx);
    ctx.restore();
    if (k > 0.9 && !this.closing) this.drawGuide(ctx);
  }

  drawBody(c) {
    const { x, y, w, h } = PHONE;
    R(c, x + 4, y + 6, w, h - 2, 'rgba(0,0,0,0.35)');
    // side buttons
    R(c, x - 2, y + 64, 3, 22, '#0a0b12'); R(c, x - 1, y + 65, 1, 20, '#4a5070');
    R(c, x - 2, y + 92, 3, 22, '#0a0b12'); R(c, x - 1, y + 93, 1, 20, '#4a5070');
    R(c, x + w - 1, y + 78, 3, 30, '#0a0b12'); R(c, x + w, y + 79, 1, 28, '#3a3f58');
    rrect(c, x, y, w, h, 16, '#07080e');
    rrect(c, x + 1, y + 1, w - 2, h - 2, 15, '#2a2e46');
    rrect(c, x + 2, y + 2, w - 4, h - 4, 14, '#1d2034');
    R(c, x + 14, y + 2, w - 28, 1, '#4a5074');
    R(c, x + 2, y + 14, 1, h - 28, '#4a5074');
    R(c, x + 14, y + h - 3, w - 28, 1, '#12141f');
    R(c, x + w - 3, y + 14, 1, h - 28, '#12141f');
    // speaker + camera
    rrect(c, x + w / 2 - 18, y + 13, 36, 4, 2, '#0a0b12');
    R(c, x + w / 2 - 16, y + 14, 32, 1, '#2a2e46');
    disc(c, x + w / 2 + 30, y + 15, 3, '#0a0b12');
    R(c, x + w / 2 + 29, y + 14, 1, 1, '#5a6aa8');
    // screen bezel
    R(c, SCREEN.x - 1, SCREEN.y - 1, SCREEN.w + 2, SCREEN.h + 2, '#05060a');
  }
  drawHomeButton(c) {
    const cx = PHONE.x + PHONE.w / 2, cy = SCREEN.y + SCREEN.h + 16;
    const down = this.pressB > 0;
    disc(c, cx, cy, 9, '#07080e');
    disc(c, cx, cy, 8, down ? '#14162a' : '#2a2e46');
    disc(c, cx, cy, 6, down ? '#1d2034' : '#1d2034');
    rrect(c, cx - 4, cy - 4, 8, 8, 2, down ? '#5a6aa8' : '#4a5074');
    rrect(c, cx - 3, cy - 3, 6, 6, 1, down ? '#1d2034' : '#1d2034');
  }
  drawGuide(c) {
    const x = PHONE.x + PHONE.w + 18, y = SH - 104, w = 176;
    panel(c, x, y, w, 92, { bg: 'rgba(18,26,58,0.92)' });
    const rows = [['↑↓←→', 'えらぶ'], ['A', 'けってい'], ['B', 'もどる'], ['MENU', 'スマホをとじる']];
    rows.forEach(([k, v], i) => {
      text(c, k, x + 14, y + 10 + i * 19, { size: 12, color: COLORS.accent });
      text(c, v, x + 72, y + 10 + i * 19, { size: 12, color: '#fff' });
    });
  }

  drawViews(c, g) {
    const tr = this.trans;
    const cur = this.view || this.last;
    if (!tr) { if (cur) this.drawView(c, cur, 0, g); return; }
    const f = ease(tr.t / TRANS_F);
    const W = SCREEN.w;
    if (tr.kind === 'slide') {
      if (tr.dir > 0) {
        this.drawView(c, tr.from, -Math.round(f * W * 0.3), g);
        const dx = Math.round((1 - f) * W);
        this.drawView(c, tr.to, dx, g);
        R(c, SCREEN.x + dx - 1, SCREEN.y, 1, SCREEN.h, 'rgba(0,0,0,0.35)');
      } else {
        this.drawView(c, tr.to, -Math.round((1 - f) * W * 0.3), g);
        const dx = Math.round(f * W);
        this.drawView(c, tr.from, dx, g);
        R(c, SCREEN.x + dx - 1, SCREEN.y, 1, SCREEN.h, 'rgba(0,0,0,0.35)');
      }
      return;
    }
    // zoom: the app window grows out of its icon (and shrinks back into it)
    const big = tr.dir > 0 ? tr.to : tr.from, small = tr.dir > 0 ? tr.from : tr.to;
    const k = tr.dir > 0 ? f : 1 - f;
    this.drawView(c, small, 0, g);
    const a = tr.rect;
    const rx = Math.round(a.x + (SCREEN.x - a.x) * k), ry = Math.round(a.y + (SCREEN.y - a.y) * k);
    const rw = Math.round(a.w + (SCREEN.w - a.w) * k), rh = Math.round(a.h + (SCREEN.h - a.h) * k);
    c.save();
    c.beginPath();
    c.rect(rx, ry, rw, rh);
    c.clip();
    this.drawView(c, big, 0, g);
    c.restore();
    if (k < 1) {
      R(c, rx, ry, rw, 1, '#ffffff'); R(c, rx, ry + rh - 1, rw, 1, '#ffffff');
      R(c, rx, ry, 1, rh, '#ffffff'); R(c, rx + rw - 1, ry, 1, rh, '#ffffff');
    }
  }

  drawView(c, v, dx, g) {
    const x = SCREEN.x + dx;
    const bottom = SCREEN.y + SCREEN.h;
    R(c, x, SCREEN.y, SCREEN.w, SCREEN.h, v.bg || PC.bg);
    let y = SCREEN.y;
    if (!v.noHeader) {
      const col = v.color || APP_COLORS.schedule;
      R(c, x, y, SCREEN.w, STATUS_H, shade(col, -0.28));
      y += STATUS_H;
      R(c, x, y, SCREEN.w, HEADER_H, col);
      R(c, x, y, SCREEN.w, 1, shade(col, 0.25));
      R(c, x, y + HEADER_H - 1, SCREEN.w, 1, shade(col, -0.4));
      art(c, x + 8, y + 8, ['...##', '..##.', '.##..', '##...', '.##..', '..##.', '...##'], { '#': '#ffffff' }, 1);
      const title = typeof v.title === 'function' ? v.title(this, g) : v.title || '';
      text(c, fitText(c, title, SCREEN.w - 50, 14), x + SCREEN.w / 2, y + 6, { size: 14, align: 'center', color: '#fff', shadow: shade(col, -0.5) });
      if (v.headerRight) T(c, v.headerRight(this, g), x + SCREEN.w - 8, y + 8, 12, '#ffffff', 'right');
      y += HEADER_H;
    } else y += v.underStatus ? 0 : STATUS_H;
    const foot = v.noFooter ? 0 : FOOTER_H;
    const area = { x, y, w: SCREEN.w, h: bottom - foot - y };
    try { v.draw(c, this, area, g); } catch (e) { console.error(e); }
    if (foot) {
      R(c, x, bottom - foot, SCREEN.w, foot, PC.foot);
      R(c, x, bottom - foot, SCREEN.w, 1, '#cfc6b0');
      const hint = typeof v.hint === 'function' ? v.hint(this, g) : v.hint || 'B:もどる';
      T(c, fitText(c, hint, SCREEN.w - 10, 12), x + SCREEN.w / 2, bottom - foot + 2, 12, '#6a6878', 'center');
    }
  }

  drawStatus(c, g) {
    const st = g.state;
    if (!st) return;
    const v = this.view || this.last;
    // white text on app headers / the wallpaper; a full-screen view with a light
    // background sets statusDark
    const light = !(v && v.noHeader && v.statusDark);
    const col = light ? '#ffffff' : PC.text;
    const x = SCREEN.x, y = SCREEN.y;
    T(c, `${st.day}日目 ${WEEKDAYS[weekdayOf(st.day)]}曜`, x + 6, y + 2, 12, col);
    // signal bars
    for (let i = 0; i < 4; i++) R(c, x + SCREEN.w - 46 + i * 3, y + 11 - (i * 2 + 3), 2, i * 2 + 3, col);
    // battery = stamina
    const frac = st.maxStamina ? st.stamina / st.maxStamina : 0;
    const bx = x + SCREEN.w - 30, by = y + 4;
    R(c, bx, by, 18, 9, col);
    R(c, bx + 1, by + 1, 16, 7, light ? '#000000' : PC.bg);
    R(c, bx + 18, by + 3, 2, 3, col);
    const fw = Math.round(14 * clamp(frac, 0, 1));
    if (fw > 0) R(c, bx + 2, by + 2, fw, 5, frac > 0.5 ? '#5ee07a' : frac > 0.2 ? '#ffd23f' : '#ff5d6c');
  }

  // g.notify toasts show as notification banners at the top of the screen.
  drawBanners(c, g) {
    const list = g.toasts.slice(-2);
    list.forEach((t, i) => {
      const slide = t.t < 8 ? (8 - t.t) * 4 : 0;
      const a = t.life - t.t < 12 ? (t.life - t.t) / 12 : 1;
      const x = SCREEN.x + 6, y = SCREEN.y + 18 + i * 28 - slide, w = SCREEN.w - 12;
      c.globalAlpha = clamp(a, 0, 1);
      box(c, x, y, w, 24, 5, '#fbfaf6', '#3a3a4a', { lo: '#e0dccf' });
      rrect(c, x + 5, y + 5, 14, 14, 3, t.color && t.color !== '#fff' && t.color !== '#ffffff' ? t.color : '#5a6fd8');
      R(c, x + 8, y + 8, 8, 1, '#ffffff'); R(c, x + 8, y + 11, 8, 1, '#ffffff'); R(c, x + 8, y + 14, 5, 1, '#ffffff');
      T(c, fitText(c, t.text, w - 32, 12), x + 25, y + 6, 12, PC.text);
      c.globalAlpha = 1;
    });
  }
}

// The open phone (or null).
export function activePhone(g) {
  for (let i = g.scenes.length - 1; i >= 0; i--) {
    const s = g.scenes[i];
    if (s.isPhone && !s.closing && !s.dismissed) return s;
  }
  return null;
}
// Run fn(ph) with a phone on screen: the open one, or a new one that slides in
// and out around the call.
export async function withPhone(g, fn) {
  const open = activePhone(g);
  if (open) return fn(open);
  // closed with MENU and still sliding out: app code that goes on calling the
  // helpers gets their cancel values instead of a new phone popping up
  const gone = g.scenes.find((s) => s.isPhone && s.dismissed && !(s.closing && s.closing.done));
  if (gone) return fn(gone);
  const ph = new PhoneScene(g);
  g.push(ph);
  try {
    return await fn(ph);
  } finally {
    await ph.close();
  }
}
// A custom screen inside the phone (see the header).
export function phoneView(g, view) { return withPhone(g, (ph) => ph.open(view)); }

// ---------------------------------------------------------------- home screen
const BUILTIN_APPS = [
  { id: 'messages', name: 'メッセージ', order: 10, color: APP_COLORS.messages, glyph: 'messages', badge: (g) => g.unread(), open: (g) => messagesApp(g) },
  { id: 'contacts', name: '連絡先', order: 20, color: APP_COLORS.contacts, glyph: 'contacts', badge: () => 0, open: (g) => contactsApp(g) },
  { id: 'schedule', name: '予定', order: 30, color: APP_COLORS.schedule, glyph: 'schedule', badge: (g) => g.regularsToday().length, open: (g) => scheduleApp(g) },
  { id: 'money', name: '家計', order: 40, color: APP_COLORS.money, glyph: 'money', badge: (g) => (g.state.rent.debt ? 1 : 0), open: (g) => moneyApp(g) },
];
function phoneApps() {
  const reg = Object.values(PHONE_APPS);
  const ids = new Set(reg.map((a) => a.id));
  return [...BUILTIN_APPS.filter((a) => !ids.has(a.id)), ...reg].sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}
const COLS = 4, CELL_W = 56, CELL_H = 58, GRID_Y = 84, GRID_ROWS = 3;

function homeView(g) {
  return {
    id: 'home',
    noHeader: true,
    underStatus: true,
    idx: 0,
    top: 0,
    cancel: undefined,
    hint: 'A:ひらく　B:とじる',
    update(ph, inp) {
      const apps = phoneApps(), n = apps.length;
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(undefined); return; }
      if (!n) return;
      let i = clamp(this.idx, 0, n - 1);
      const rows = Math.ceil(n / COLS), r = Math.floor(i / COLS), col = i % COLS;
      if (inp.repeat('left')) i = (i + n - 1) % n;
      else if (inp.repeat('right')) i = (i + 1) % n;
      else if (inp.repeat('up')) i = r > 0 ? i - COLS : Math.min(n - 1, (rows - 1) * COLS + col);
      else if (inp.repeat('down')) i = r < rows - 1 ? Math.min(n - 1, i + COLS) : col;
      if (i !== this.idx) { this.idx = i; audio.sfx('cursor'); }
      const row = Math.floor(this.idx / COLS);
      if (row < this.top) this.top = row;
      if (row >= this.top + GRID_ROWS) this.top = row - GRID_ROWS + 1;
      if (inp.pressed('a')) {
        const app = apps[this.idx];
        if (!app || typeof app.open !== 'function') { audio.sfx('buzz'); return; }
        audio.sfx('ok');
        const p = this.iconPos(this.idx);
        ph.zoomFrom = { x: p.x, y: p.y, w: 32, h: 32 };
        ph.run(this, async () => {
          await app.open(g);
          ph.zoomFrom = null;
        });
      }
    },
    iconPos(i) {
      const r = Math.floor(i / COLS) - this.top, col = i % COLS;
      return { x: SCREEN.x + col * CELL_W + 12, y: SCREEN.y + GRID_Y + r * CELL_H + 4 };
    },
    draw(c, ph, a) {
      c.drawImage(wallpaper(), a.x, SCREEN.y);
      // widget: day, week and what matters today
      const wx = a.x + 8, wy = SCREEN.y + 20, ww = a.w - 16, wh = 56;
      c.globalAlpha = 0.94;
      box(c, wx, wy, ww, wh, 6, '#f4f1e8', '#0c0e26', { lo: '#ddd6c4' });
      c.globalAlpha = 1;
      const st = g.state;
      const wd = weekdayOf(st.day);
      T(c, `${st.day}日目`, wx + 10, wy + 5, 16, PC.text);
      const dw = measure(c, `${st.day}日目`, 16);
      T(c, `${WEEKDAYS[wd]}曜日`, wx + 16 + dw, wy + 8, 12, wd === 5 ? '#3a6fd8' : wd === 6 ? PC.bad : PC.dim);
      T(c, `第${g.week}週`, wx + ww - 10, wy + 8, 12, PC.dim, 'right');
      const info = todayInfo(g);
      info.slice(0, 2).forEach(([s, col], i) => T(c, fitText(c, s, ww - 20, 12), wx + 10, wy + 26 + i * 14, 12, col));
      // app grid
      const apps = phoneApps();
      const first = this.top * COLS, last = Math.min(apps.length, first + GRID_ROWS * COLS);
      for (let i = first; i < last; i++) {
        const app = apps[i];
        const p = this.iconPos(i);
        const sel = i === this.idx;
        const lift = sel ? -2 : 0;
        const ix = p.x + (a.x - SCREEN.x), iy = p.y + lift;
        if (sel) {
          R(c, ix + 2, iy + 34 - lift, 30, 2, 'rgba(0,0,0,0.35)');
          rrect(c, ix - 3, iy - 3, 38, 38, 9, '#ffffff');
          rrect(c, ix - 2, iy - 2, 36, 36, 8, shade(app.color || '#5a6fd8', -0.6));
        }
        drawAppIcon(c, ix, iy, app);
        let n = 0;
        try { n = app.badge ? app.badge(g) | 0 : 0; } catch (e) { n = 0; }
        if (n > 0) drawBadge(c, ix + 31, iy + 1, n);
        const label = fitText(c, app.name || app.id, CELL_W + 6, 12);
        // keep long names (メッセージ) inside the screen's edges
        const lw = measure(c, label, 12);
        const lx = clamp(ix + 16, SCREEN.x + lw / 2 + 3, SCREEN.x + SCREEN.w - lw / 2 - 3);
        text(c, label, lx, p.y + 37, { size: 12, align: 'center', color: sel ? COLORS.accent : '#ffffff', shadow: '#0a0b18' });
      }
      const rows = Math.ceil(apps.length / COLS);
      if (rows > GRID_ROWS) {
        for (let r = 0; r < rows - GRID_ROWS + 1; r++) R(c, a.x + a.w / 2 - (rows - GRID_ROWS) * 4 + r * 8, SCREEN.y + 262, 4, 4, r === this.top ? '#ffffff' : '#6a6aa0');
      }
    },
  };
}

// Up to two short lines about today for the home widget: [text, colour].
function todayInfo(g) {
  const st = g.state;
  const out = [];
  if (st.rent.debt) out.push([`未払いの家賃 ${fmtMoney(st.rent.debt)}`, PC.bad]);
  for (const id of g.regularsToday()) out.push([`今日は${showWords(REGULARS[id]).act}：『${REGULARS[id].title}』`, PC.accent]);
  for (const m of pendingInvites(g)) out.push([`${senderName(m)}から おさそい！`, PC.good]);
  const unread = g.unread();
  if (unread && out.length < 2) out.push([`未読メッセージ ${unread}件`, PC.text]);
  out.push([`家賃まで ${rentWhen(g)}（${fmtMoney(g.housing().rent)}）`, PC.dim]);
  return out;
}
const daysToRent = (g) => (7 - weekdayOf(g.state.day)) % 7 || 7;
// 'あした' / 'あと3日' (as in the notebook)
const rentWhen = (g) => (daysToRent(g) === 1 ? 'あした' : `あと${daysToRent(g)}日`);
const pendingInvites = (g) => g.state.phone.inbox.filter((m) => m.kind === 'invite' && !m.answered && m.day === g.state.day && !metToday(g, m));
// An invite from someone you already spent today with (talk menu / another invite).
const metToday = (g, m) => !!(m.person && g.state.people[m.person] && g.state.people[m.person].hangDay === g.state.day);
// short names (ジロー) where a row has little room, as in the message list
const senderName = (m) => (m.person && PEOPLE[m.person] ? PEOPLE[m.person].short || PEOPLE[m.person].name : m.from || '？？？');

// Entry point used by the pause menu. Resolves with 'menu' when the player closed
// the phone with MENU (the pause menu then closes too), else undefined (B).
export async function openPhone(g) {
  if (activePhone(g)) return undefined;
  audio.sfx('cursor');
  const ph = new PhoneScene(g);
  g.push(ph);
  await ph.open(homeView(g));
  await ph.close();
  return ph.dismissed ? 'menu' : undefined;
}

// ---------------------------------------------------------------- generic list / info / confirm
function listView(g, o) {
  return {
    title: o.title,
    color: o.color,
    bg: o.bg,
    hint: o.hint || 'A:えらぶ　B:もどる',
    headerRight: o.headerRight,
    idx: o.index | 0,
    sy: null,
    cancel: -1,
    rows() { return (typeof o.items === 'function' ? o.items() : o.items) || []; },
    rowH(rows) { return o.rowH || (rows.some((r) => r && (r.sub || r.look || r.icon || r.kind)) ? 38 : 26); },
    update(ph, inp) {
      const rows = this.rows(), n = rows.length;
      if (n) {
        this.idx = clamp(this.idx, 0, n - 1);
        if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; audio.sfx('cursor'); }
        if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; audio.sfx('cursor'); }
        if (inp.pressed('a')) {
          const it = rows[this.idx];
          if (it && it.disabled) { audio.sfx('buzz'); if (it.why) ph.toast(it.why, '#9aa3c7'); } else {
            audio.sfx('ok');
            if (o.pick) o.pick(ph, it, this.idx, this);
            else ph.back(this.idx);
          }
          return;
        }
      }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      const rows = this.rows();
      const descH = o.describe && rows.length ? 40 : 0;
      const lh = a.h - descH;
      if (!rows.length) {
        const lines = wrap(c, o.empty || '（なし）', a.w - 32, 12);
        lines.forEach((l, i) => T(c, l, a.x + a.w / 2, a.y + a.h / 2 - lines.length * 8 + i * 16, 12, PC.dim, 'center'));
        return;
      }
      const rh = this.rowH(rows);
      const vis = Math.max(1, Math.floor(lh / rh));
      const idx = clamp(this.idx, 0, rows.length - 1);
      const maxTop = Math.max(0, rows.length - vis);
      let top = this.topRow ?? 0;
      if (idx < top) top = idx;
      if (idx >= top + vis) top = idx - vis + 1;
      top = clamp(top, 0, maxTop);
      this.topRow = top;
      const target = top * rh;
      this.sy = this.sy == null ? target : Math.abs(target - this.sy) < 1 ? target : this.sy + (target - this.sy) * 0.4;
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, lh);
      c.clip();
      const from = Math.max(0, Math.floor(this.sy / rh)), to = Math.min(rows.length, from + vis + 2);
      for (let i = from; i < to; i++) {
        const y = Math.round(a.y + i * rh - this.sy);
        const sel = i === idx;
        if (sel) { R(c, a.x, y, a.w, rh, PC.sel); R(c, a.x, y, 3, rh, PC.selEdge); }
        if (o.drawRow) o.drawRow(c, rows[i], a.x, y, a.w, rh, sel, i);
        else drawRowDefault(c, rows[i], a.x, y, a.w, rh, sel);
        R(c, a.x + 6, y + rh - 1, a.w - 12, 1, PC.line);
      }
      c.restore();
      if (rows.length > vis) {
        const bh = Math.max(12, Math.round((lh * vis) / rows.length));
        const by = a.y + Math.round(((lh - bh) * top) / Math.max(1, maxTop));
        R(c, a.x + a.w - 3, a.y, 3, lh, '#e4ddcc');
        R(c, a.x + a.w - 3, by, 3, bh, '#a8a090');
      }
      if (descH) {
        const d = o.describe(idx);
        const dy = a.y + a.h - descH;
        R(c, a.x, dy, a.w, descH, '#ebe5d6');
        R(c, a.x, dy, a.w, 1, '#cfc6b0');
        if (d) wrap(c, d, a.w - 16, 12).slice(0, 2).forEach((l, i) => T(c, l, a.x + 8, dy + 5 + i * 15, 12, PC.text));
      }
    },
  };
}
function drawRowDefault(c, it, x, y, w, rh, sel) {
  if (typeof it === 'string') it = { label: it };
  let lx = x + 10;
  if (it.look || it.kind) { avatar(c, x + 8, y + (rh - 26) / 2, it.look, it.kind); lx = x + 48; } else if (it.icon) { try { it.icon(c, x + 8, y + (rh - 24) / 2); } catch (e) { console.error(e); } lx = x + 44; }
  const rw = it.right ? measure(c, it.right, 12) + 12 : 0;
  const col = it.disabled ? PC.dim : sel ? '#1a1a28' : PC.text;
  if (it.sub) {
    T(c, fitText(c, it.label, x + w - lx - rw - 6, 14), lx, y + 4, 14, col);
    T(c, fitText(c, it.sub, x + w - lx - 8, 12), lx, y + 21, 12, PC.dim);
  } else T(c, fitText(c, it.label, x + w - lx - rw - 6, 14), lx, y + (rh - 14) / 2 - 1, 14, col);
  if (it.right) T(c, it.right, x + w - 8, y + (it.sub ? 6 : (rh - 12) / 2), 12, it.rightColor || (it.disabled ? PC.bad : PC.dim), 'right');
}

// A list inside the phone. Resolves with the chosen index, or -1.
export function phoneList(g, o) { return phoneView(g, listView(g, o)); }

function infoView(g, o) {
  return {
    title: o.title, color: o.color, bg: o.bg, hint: o.hint || 'A/B:もどる', sy: 0, cancel: true,
    update(ph, inp) {
      if (this.maxScroll > 0) {
        if (inp.repeat('down')) this.sy = Math.min(this.maxScroll, this.sy + 16);
        if (inp.repeat('up')) this.sy = Math.max(0, this.sy - 16);
      }
      if (inp.pressed('a') || inp.pressed('b')) { audio.sfx('cancel'); ph.back(true); }
    },
    draw(c, ph, a) {
      if (o.draw) { o.draw(c, a, this); return; }
      const src = o.lines ? [].concat(o.lines).join('\n') : o.text || '';
      const lines = wrap(c, g.fmt(src), a.w - 20, 12);
      this.maxScroll = Math.max(0, lines.length * 16 + 16 - a.h);
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, a.h);
      c.clip();
      lines.forEach((l, i) => T(c, l, a.x + 10, a.y + 8 + i * 16 - this.sy, 12, PC.text));
      c.restore();
      if (this.maxScroll > 0 && this.sy < this.maxScroll) downArrow(c, a.x + a.w - 14, a.y + a.h - 10, ph.t, PC.dim);
    },
  };
}
export function phoneInfo(g, o) { return phoneView(g, infoView(g, o)); }

function confirmView(g, o) {
  const choices = o.choices || ['はい', 'いいえ'];
  return {
    title: o.title, color: o.color, hint: 'A:けってい　B:もどる', idx: 0, cancel: choices.length - 1,
    update(ph, inp) {
      const n = choices.length;
      if (inp.repeat('up') || inp.repeat('left')) { this.idx = (this.idx + n - 1) % n; audio.sfx('cursor'); }
      if (inp.repeat('down') || inp.repeat('right')) { this.idx = (this.idx + 1) % n; audio.sfx('cursor'); }
      if (inp.pressed('a')) { audio.sfx('ok'); ph.back(this.idx); } else if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(n - 1); }
    },
    draw(c, ph, a) {
      const lines = wrap(c, g.fmt(o.text || ''), a.w - 20, 12);
      lines.slice(0, 9).forEach((l, i) => T(c, l, a.x + 10, a.y + 10 + i * 16, 12, PC.text));
      choices.forEach((ch, i) => {
        const y = a.y + a.h - (choices.length - i) * 30 - 4;
        const sel = i === this.idx;
        box(c, a.x + 16, y, a.w - 32, 26, 5, sel ? (o.color || APP_COLORS.schedule) : '#ffffff', sel ? shade(o.color || APP_COLORS.schedule, -0.5) : '#b8b0a0', { lo: sel ? shade(o.color || APP_COLORS.schedule, -0.2) : '#e4ddcc' });
        T(c, ch, a.x + a.w / 2, y + 6, 14, sel ? '#ffffff' : PC.text, 'center');
      });
    },
  };
}
export function phoneConfirm(g, o) { return phoneView(g, confirmView(g, o)); }

// ---------------------------------------------------------------- messages
function threadKey(m) { return m.person && PEOPLE[m.person] ? 'p:' + m.person : 'f:' + (m.from || ''); }
function threads(g) {
  const map = new Map();
  for (const m of g.state.phone.inbox) {
    const key = threadKey(m);
    let t = map.get(key);
    if (!t) {
      const def = m.person && PEOPLE[m.person];
      t = { key, person: def ? m.person : null, name: def ? def.name : m.from || '？？？', look: def ? def.look : m.look || null, kind: m.kind || 'chat', msgs: [], unread: 0, last: m };
      map.set(key, t);
    }
    t.msgs.push(m);
    if (!m.read) t.unread++;
  }
  // newest conversation first (inbox order is arrival order; days decide first)
  const newer = (a, b) => b.day - a.day || b.id - a.id;
  const list = [...map.values()];
  for (const t of list) { t.msgs.sort(newer); t.last = t.msgs[0]; }
  return list.sort((a, b) => newer(a.last, b.last));
}

export async function messagesApp(g) {
  return phoneView(g, listView(g, {
    title: 'メッセージ',
    color: APP_COLORS.messages,
    hint: 'A:よむ　B:もどる',
    rowH: 42,
    empty: 'メッセージはまだない。\n仲良くなった人やお仕事の相手から、ここに連絡が届く。',
    items: () => threads(g),
    headerRight: () => (g.unread() ? `未読${g.unread()}` : ''),
    pick: (ph, t) => ph.open(threadView(g, t.key)),
    drawRow(c, t, x, y, w, rh, sel) {
      avatar(c, x + 8, y + 8, t.look, t.kind);
      const day = `${t.last.day}日目`;
      const dw = measure(c, day, 12);
      // long senders: the short name (people), else the small size, else cut
      const nw = w - 60 - dw - 4;
      let nm = t.person ? nameFit(c, PEOPLE[t.person], nw, 14) : t.name, ns = 14;
      if (measure(c, nm, 14) > nw) { ns = 12; nm = fitText(c, nm, nw, 12); }
      T(c, nm, x + 48, y + (ns === 14 ? 5 : 7), ns, t.unread ? '#1a1a28' : PC.text);
      T(c, day, x + w - 8, y + 6, 12, PC.dim, 'right');
      const tag = KIND_TAG[t.last.kind] ? `【${KIND_TAG[t.last.kind]}】` : '';
      const prev = g.fmt(previewText(t.last));
      T(c, fitText(c, tag + prev, w - 48 - (t.unread ? 30 : 10), 12), x + 48, y + 23, 12, t.unread ? PC.text : PC.dim);
      if (t.unread) drawBadge(c, x + w - 16, y + 29, t.unread);
    },
  }));
}
function previewText(m) {
  if (m.answered === 'met') return '今日はもう いっしょに過ごした';
  if (m.answered === 'yes') return m.kind === 'offer' ? 'オファーを引き受けた' : '行く！と返事した';
  if (m.answered === 'no') return m.kind === 'offer' ? 'オファーをことわった' : 'ことわった';
  if (m.answered === 'expired') return m.kind === 'offer' ? 'オファーの期限が過ぎてしまった' : 'おさそいの日が過ぎてしまった';
  return oneLine(m.text);
}

const REPLY = {
  invite: { yes: '行く！', no: 'ごめん、また今度', choices: ['行く！', 'また今度'] },
  offer: { yes: 'ぜひ、やらせてください！', no: '今回はおことわりします', choices: ['引き受ける', 'ことわる'] },
};
const BUB_W = 140; // max text width in a bubble
const LINE = 15;

function threadView(g, key) {
  return {
    title: '',
    color: APP_COLORS.messages,
    bg: PC.chat,
    sel: 0,
    scroll: 0,
    target: 0,
    dirty: true,
    cancel: -1,
    hint() { return this.pending() ? '←→:えらぶ　A:返信　B:もどる' : '↑↓:スクロール　B:もどる'; },
    msgs() { const t = threads(g).find((x) => x.key === key); return t ? t.msgs.slice().reverse() : []; },
    enter() {
      const t = threads(g).find((x) => x.key === key);
      this.title = t ? t.name : 'メッセージ';
      this.look = t ? t.look : null;
      this.firstUnread = null;
      let seenRead = false;
      for (const m of this.msgs()) {
        if (m.read) seenRead = true;
        else if (this.firstUnread == null && seenRead) this.firstUnread = m.id; // divider only after older, read messages
        m.read = true;
        if (m.kind === 'invite' && !m.answered) {
          if (m.day !== g.state.day) m.answered = 'expired';
          else if (metToday(g, m)) m.answered = 'met';
        }
      }
      this.dirty = true;
      this.toBottom = true;
    },
    pending() {
      return this.msgs().find((m) => !m.answered && ((m.kind === 'invite' && m.day === g.state.day && !metToday(g, m)) || (m.kind === 'offer' && m.regular && REGULARS[m.regular] && g.offerOpen(m)))) || null;
    },
    layout(c, w) {
      const items = [];
      let y = 8, lastDay = null;
      for (const m of this.msgs()) {
        if (m.read === false) m.read = true;
        if (m.day !== lastDay) { items.push({ type: 'day', y, text: `${m.day}日目（${weekdayName(m.day)}）` }); y += 22; lastDay = m.day; }
        if (m.id === this.firstUnread) { items.push({ type: 'unread', y }); y += 18; }
        const extra = msgExtra(m);
        const lines = wrap(c, g.fmt(m.text || ''), BUB_W, 12);
        const xl = extra ? wrap(c, extra, BUB_W, 12) : [];
        const tag = KIND_TAG[m.kind] || '';
        const tw = Math.max(...lines.map((l) => measure(c, l, 12)), ...xl.map((l) => measure(c, l, 12)), tag ? measure(c, `【${tag}】`, 12) : 0);
        const h = (lines.length + xl.length + (tag ? 1 : 0)) * LINE + 10 + (xl.length ? 4 : 0);
        // (a hanging 。」ー may stick out of BUB_W by one char: the bubble fits the lines)
        items.push({ type: 'in', y, h, bw: Math.min(w - 56, Math.ceil(tw) + 14), lines, xl, tag, m });
        y += Math.max(h, 26) + 8;
        if (m.answered === 'yes' || m.answered === 'no') {
          const r = (REPLY[m.kind] || REPLY.invite)[m.answered];
          const rl = wrap(c, r, BUB_W, 12);
          const rh = rl.length * LINE + 10;
          items.push({ type: 'out', y, h: rh, bw: Math.ceil(Math.max(...rl.map((l) => measure(c, l, 12)))) + 14, lines: rl });
          y += rh + 8;
        } else if (m.answered === 'expired' || m.answered === 'met') {
          items.push({ type: 'note', y, text: m.answered === 'met' ? '今日はもう いっしょに過ごした' : m.kind === 'offer' ? 'オファーの期限が過ぎてしまった' : 'おさそいの日が過ぎてしまった' });
          y += 20;
        }
      }
      this.items = items;
      this.totalH = y + 4;
      this.w = w;
      this.dirty = false;
    },
    update(ph, inp) {
      const p = this.pending();
      if (p) {
        if (inp.repeat('left') || inp.repeat('right')) { this.sel = 1 - this.sel; audio.sfx('cursor'); }
        if (inp.pressed('a')) { audio.sfx('ok'); this.answer(ph, p, this.sel === 0); return; }
      }
      if (inp.repeat('up')) this.target = Math.max(0, this.target - 18);
      if (inp.repeat('down')) this.target = Math.min(this.maxScroll || 0, this.target + 18);
      if (!p && inp.pressed('a')) { this.target = this.maxScroll || 0; }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    answer(ph, m, yes) {
      ph.run(this, async () => {
        const def = m.person && PEOPLE[m.person];
        if (m.kind === 'invite') {
          const ok = await answerMessage(g, m, yes);
          if (def && yes && ok) g.message({ from: def.name, person: m.person, kind: 'chat', read: true, text: msgLine(def, 'thanks', g) });
          if (def && !yes) g.message({ from: def.name, person: m.person, kind: 'chat', read: true, text: msgLine(def, 'declined', g) });
        } else {
          await answerMessage(g, m, yes);
          if (!yes) ph.toast('オファーをおことわりした', '#9aa3c7');
        }
        this.sel = 0;
        this.dirty = true;
        this.toBottom = true;
      });
    },
    draw(c, ph, a) {
      if (this.dirty || this.w !== a.w) this.layout(c, a.w);
      const p = this.pending();
      const barH = p ? 40 : 0;
      const vh = a.h - barH;
      this.maxScroll = Math.max(0, this.totalH - vh);
      if (this.toBottom) { this.target = this.maxScroll; this.scroll = this.scroll || this.maxScroll; this.toBottom = false; }
      this.target = clamp(this.target, 0, this.maxScroll);
      this.scroll += (this.target - this.scroll) * 0.35;
      if (Math.abs(this.target - this.scroll) < 0.5) this.scroll = this.target;
      const sy = Math.round(this.scroll);
      c.save();
      c.beginPath();
      c.rect(a.x, a.y, a.w, vh);
      c.clip();
      for (const it of this.items) {
        const y = a.y + it.y - sy;
        if (y > a.y + vh || y + (it.h || 20) < a.y) continue;
        if (it.type === 'day') {
          const w = measure(c, it.text, 12) + 16;
          rrect(c, a.x + (a.w - w) / 2, y, w, 16, 7, '#b9c4d4');
          T(c, it.text, a.x + a.w / 2, y + 2, 12, '#ffffff', 'center');
        } else if (it.type === 'unread') {
          R(c, a.x + 10, y + 7, a.w - 20, 1, PC.accent);
          const s = 'ここから未読';
          const w = measure(c, s, 12) + 10;
          R(c, a.x + (a.w - w) / 2, y, w, 15, PC.chat);
          T(c, s, a.x + a.w / 2, y + 1, 12, PC.accent, 'center');
        } else if (it.type === 'note') {
          T(c, fitText(c, `（${it.text}）`, a.w - 16, 12), a.x + a.w / 2, y + 2, 12, PC.dim, 'center');
        } else if (it.type === 'in') {
          avatar(c, a.x + 6, y, this.look, it.m.kind);
          const bx = a.x + 46;
          box(c, bx, y, it.bw, it.h, 5, '#ffffff', '#5a6478');
          R(c, bx - 3, y + 8, 4, 1, '#5a6478'); R(c, bx - 2, y + 9, 3, 1, '#ffffff'); R(c, bx - 2, y + 10, 3, 1, '#5a6478');
          R(c, bx - 3, y + 9, 1, 1, '#5a6478');
          let ly = y + 5;
          if (it.tag) { T(c, `【${it.tag}】`, bx + 7, ly, 12, KIND_COLOR[it.m.kind] ? shade(KIND_COLOR[it.m.kind], -0.15) : PC.dim); ly += LINE; }
          for (const l of it.lines) { T(c, l, bx + 7, ly, 12, PC.text); ly += LINE; }
          if (it.xl.length) { R(c, bx + 6, ly + 1, it.bw - 12, 1, PC.line); ly += 4; for (const l of it.xl) { T(c, l, bx + 7, ly, 12, PC.accent); ly += LINE; } }
        } else if (it.type === 'out') {
          const bx = a.x + a.w - 10 - it.bw;
          box(c, bx, y, it.bw, it.h, 5, PC.out, PC.outEdge);
          R(c, bx + it.bw - 1, y + 8, 4, 1, PC.outEdge); R(c, bx + it.bw - 1, y + 9, 3, 1, PC.out); R(c, bx + it.bw + 2, y + 9, 1, 1, PC.outEdge); R(c, bx + it.bw - 1, y + 10, 3, 1, PC.outEdge);
          it.lines.forEach((l, i) => T(c, l, bx + 7, y + 5 + i * LINE, 12, '#1e3a18'));
        }
      }
      c.restore();
      if (this.scroll > 1) art(c, a.x + a.w - 14, a.y + 4, ['...#...', '..###..', '.#####.'], { '#': '#8a96aa' });
      if (p) {
        const by = a.y + vh;
        R(c, a.x, by, a.w, barH, '#f7f4ec');
        R(c, a.x, by, a.w, 1, '#c8c0ae');
        const ch = (REPLY[p.kind] || REPLY.invite).choices;
        ch.forEach((s, i) => {
          const sel = i === this.sel;
          const bw = (a.w - 24) / 2, bx = a.x + 8 + i * (bw + 8);
          const col = i === 0 ? APP_COLORS.messages : '#9aa3c7';
          box(c, bx, by + 7, bw, 26, 6, sel ? col : '#ffffff', sel ? shade(col, -0.5) : '#b8b0a0', { lo: sel ? shade(col, -0.2) : '#e4ddcc' });
          T(c, s, bx + bw / 2, by + 13, 14, sel ? '#ffffff' : PC.text, 'center');
          if (sel) R(c, bx + 6, by + 30, bw - 12, 1, '#ffffff');
        });
      }
    },
  };
}
// The info line under an invite / offer bubble.
function msgExtra(m) {
  if (m.kind === 'invite') {
    const s = HANGOUTS[m.spot];
    return s ? `場所：${s.name}（${s.price ? fmtMoney(s.price) : '無料'}）` : null;
  }
  if (m.kind === 'offer' && m.regular && REGULARS[m.regular]) {
    const r = REGULARS[m.regular];
    const where = placeName(r.place);
    const when = [showDay(r), where].filter(Boolean).join('・');
    return `『${r.title}』\n${when ? when + '\n' : ''}ギャラ ${fmtMoney(r.pay)}\n体力 -${r.stamina}`;
  }
  return null;
}

const placeName = (id) => (id && PLACES[id] ? PLACES[id].name : '');
// '毎週木曜' (a one-off event registered with a dynamic weekday: just the weekday)
const showDay = (r) => (r.weekday >= 0 && r.weekday < 7 ? `毎週${WEEKDAYS[r.weekday]}曜` : '');
// Answers an invite / offer (no dialogue of its own beyond the result). Returns
// true when the message got answered.
export async function answerMessage(g, m, yes) {
  m.read = true;
  if (m.answered) return true;
  if (m.kind === 'invite') {
    if (m.day !== g.state.day) { m.answered = 'expired'; return true; }
    if (!yes) { m.answered = 'no'; return true; }
    if (metToday(g, m)) { m.answered = 'met'; return true; } // no second outing with them today
    const spot = HANGOUTS[m.spot];
    const ok = await g.hangout(m.person, m.spot);
    if (ok) m.answered = 'yes';
    else await g.say(`${spot ? spot.name : 'おでかけ'}は、また今度にしよう。`);
    return !!ok;
  }
  if (m.kind === 'offer' && m.regular) {
    const r = REGULARS[m.regular];
    if (!r) return false;
    if (yes) {
      // an old offer (OFFER_DAYS) or one whose conditions no longer hold (agency changed…)
      const why = !g.offerOpen(m) ? 'このオファーは、返事の期限が過ぎてしまった…。' : g.checkRequires(r.requires) ? 'このオファーは、条件が合わなくなってしまった…。' : null;
      if (why) { m.answered = 'expired'; await g.say(`（${why}）`); return true; }
      const cur = g.state.regulars[m.regular];
      if (!cur || cur.dropped) g.joinRegular(m.regular); // a duplicate offer does not reset the week
      m.answered = 'yes';
      audio.sfx('fanfare');
      const where = placeName(r.place);
      const day = showDay(r);
      const w = showWords(r);
      const now = g.regularsToday().includes(m.regular);
      await g.say(`『${r.title}』のレギュラーになった！\n${day ? day + 'は、' : ''}${where ? where + 'で' + w.act + 'だ。' : w.act + 'をがんばろう。'}` + (now ? `\n（さっそく今日も${w.act}がある。今週は休んでもだいじょうぶ）` : ''));
    } else {
      m.answered = 'no';
      if (!g.state.regulars[m.regular]) g.state.regulars[m.regular] = { declined: g.state.day, dropped: true, doneWeek: 0, missed: 0, count: 0 };
    }
    return true;
  }
  return false;
}

// Shows one message as dialogue and handles its reply (invite / offer).
export async function readMessage(g, m) {
  m.read = true;
  const def = m.person && PEOPLE[m.person];
  const opts = { name: m.from, look: def ? def.look : m.look };
  if (m.kind === 'invite' && !m.answered) {
    if (m.day !== g.state.day) {
      await g.say(m.text, opts);
      await g.say('（このおさそいの日は、もう過ぎてしまった…）');
      m.answered = 'expired';
      return;
    }
    if (metToday(g, m)) {
      await g.say(m.text, opts);
      await g.say('（今日はもう いっしょに過ごした）');
      m.answered = 'met';
      return;
    }
    const i = await g.ask(m.text, ['行く！', 'ごめん、また今度'], { ...opts, cancel: 1 });
    if (i === 0) await answerMessage(g, m, true);
    else {
      m.answered = 'no';
      await g.say(def ? lineFor(def, 'declined', g) : '了解！また誘うね〜。', opts);
    }
    return;
  }
  if (m.kind === 'offer' && m.regular && !m.answered) {
    const r = REGULARS[m.regular];
    if (!r) { await g.say(m.text, opts); return; }
    if (!g.offerOpen(m)) {
      m.answered = 'expired';
      await g.say(m.text, opts);
      await g.say('（このオファーは、返事の期限が過ぎてしまった…）');
      return;
    }
    const i = await g.ask(`${m.text}\n（${showDay(r) ? showDay(r) + '：' : ''}${r.title}／ギャラ ${fmtMoney(r.pay)}）`, ['引き受ける', 'おことわりする'], { ...opts, cancel: 1 });
    await answerMessage(g, m, i === 0);
    if (i !== 0) await g.say('今回はおことわりした。');
    return;
  }
  await g.say(m.text, opts);
}

// ---------------------------------------------------------------- contacts
function contactIds(g) {
  const st = g.state;
  // contact: exchanged at ♥1 (life.js addAff); older saves may lack the flag
  const ids = Object.keys(st.people).filter((id) => PEOPLE[id] && st.people[id] && (st.people[id].contact || st.partner === id || st.people[id].special || heartIndex(st.people[id].aff || 0) >= 1));
  const rank = (id) => (st.partner === id ? 0 : st.people[id].special ? 1 : 2);
  return ids.sort((a, b) => rank(a) - rank(b) || g.aff(b) - g.aff(a));
}
function tagsOf(g, id) {
  const out = [];
  if (g.state.partner === id) out.push(['相方', '#e07a1f']);
  if (g.state.people[id] && g.state.people[id].special) out.push(['大切な人', '#ff5d8f']);
  return out;
}
function drawChips(c, tags, x, y, align = 'left') {
  const ws = tags.map(([s]) => measure(c, s, 12) + 10);
  let cx = align === 'center' ? x - (ws.reduce((a, b) => a + b, 0) + (tags.length - 1) * 4) / 2 : x;
  tags.forEach(([s, col], i) => {
    rrect(c, cx, y, ws[i], 15, 4, col);
    T(c, s, cx + ws[i] / 2, y + 1, 12, '#ffffff', 'center');
    cx += ws[i] + 4;
  });
  return cx;
}
// "♥ progress" inside the current heart level (0..1).
function levelProgress(aff) {
  const lv = heartIndex(aff);
  if (lv >= HEARTS.length - 1) return 1;
  const a = HEARTS[lv][0], b = HEARTS[lv + 1][0];
  return clamp((aff - a) / (b - a), 0, 1);
}

export async function contactsApp(g) {
  return phoneView(g, listView(g, {
    title: '連絡先',
    color: APP_COLORS.contacts,
    hint: 'A:くわしく　B:もどる',
    rowH: 42,
    empty: '連絡先はまだだれもいない。\n何度か話して仲良くなると、連絡先を交換できる。',
    items: () => contactIds(g),
    headerRight: () => `${contactIds(g).length}人`,
    pick: (ph, id, i, view) => ph.open(contactCardView(g, i, view)),
    drawRow(c, id, x, y, w, rh, sel) {
      const def = PEOPLE[id];
      avatar(c, x + 8, y + 8, def.look, 'chat');
      T(c, nameFit(c, def, w - 60, 14), x + 48, y + 4, 14, PC.text);
      const lv = g.heartLevel(id);
      drawHearts(c, x + 48, y + 26, lv);
      const end = drawChips(c, tagsOf(g, id), x + 94, y + 23);
      const ln = HEARTS[lv][1];
      if (end < x + w - 14 - measure(c, ln, 12)) T(c, ln, x + w - 10, y + 24, 12, PC.dim, 'right');
    },
  }));
}

function inviteState(g, id) {
  const p = g.person(id);
  if (!p) return { ok: false, why: 'まだ知り合っていない' };
  if (heartIndex(p.aff) < 2) return { ok: false, why: '♥♥「友だち」から さそえる' };
  if (p.hangDay === g.state.day) return { ok: false, why: '今日はもう いっしょに遊んだ' };
  return { ok: true };
}

function contactCardView(g, index, list) {
  return {
    title: '連絡先',
    color: APP_COLORS.contacts,
    idx: index,
    slide: 0,
    cancel: -1,
    hint() {
      const ids = contactIds(g);
      const id = ids[clamp(this.idx, 0, Math.max(0, ids.length - 1))];
      return (ids.length > 1 ? '←→:となりの人　' : '') + (id && inviteState(g, id).ok ? 'A:さそう　' : '') + 'B:もどる';
    },
    headerRight() { const ids = contactIds(g); return ids.length > 1 ? `${this.idx + 1}/${ids.length}` : ''; },
    update(ph, inp) {
      const ids = contactIds(g);
      if (!ids.length) { ph.back(-1); return; }
      this.idx = clamp(this.idx, 0, ids.length - 1);
      if (ids.length > 1 && (inp.repeat('left') || inp.repeat('right'))) {
        const d = inp.repeat('left') ? -1 : 1;
        this.idx = (this.idx + d + ids.length) % ids.length;
        this.slide = d * 14;
        if (list) list.idx = this.idx;
        audio.sfx('cursor');
      }
      if (this.slide) this.slide -= Math.sign(this.slide) * Math.min(Math.abs(this.slide), 3);
      if (inp.pressed('a')) {
        const id = ids[this.idx];
        const s = inviteState(g, id);
        if (!s.ok) { audio.sfx('buzz'); ph.toast(s.why, '#9aa3c7'); return; }
        audio.sfx('ok');
        ph.run(this, () => callPerson(g, id));
        return;
      }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      const ids = contactIds(g);
      if (!ids.length) return;
      const id = ids[clamp(this.idx, 0, ids.length - 1)];
      const def = PEOPLE[id], p = g.person(id) || { aff: 0 };
      const x = a.x + Math.round(this.slide), cx = x + a.w / 2;
      const top = def.look && def.look.top ? def.look.top : '#5fd7ff';
      const band = mix(/^#[0-9a-f]{3,6}$/i.test(top) ? top : '#5fd7ff', '#ffffff', 0.5);
      R(c, a.x, a.y, a.w, 42, band);
      for (let i = 0; i < a.w; i += 8) for (let j = (i / 8) % 2 ? 4 : 0; j < 42; j += 8) R(c, a.x + i + 2, a.y + j + 2, 2, 2, mix(band, '#ffffff', 0.35));
      R(c, a.x, a.y + 42, a.w, 1, shade(band, -0.25));
      if (ids.length > 1) {
        art(c, a.x + 8, a.y + 14, ['..#', '.##', '###', '.##', '..#'], { '#': shade(band, -0.5) }, 2);
        art(c, a.x + a.w - 14, a.y + 14, ['#..', '##.', '###', '##.', '#..'], { '#': shade(band, -0.5) }, 2);
      }
      box(c, cx - 36, a.y + 6, 72, 56, 4, '#ffffff', '#3a3a4a', { lo: '#e0dccf' });
      drawFaceHD(c, def.look || {}, cx - 32, a.y + 10, 2);
      T(c, def.name, cx, a.y + 64, 16, PC.text, 'center');
      const tags = tagsOf(g, id);
      const kind = PERSON_KIND[def.kind] || '';
      let y = a.y + 83;
      if (tags.length || kind) {
        drawChips(c, kind ? [[kind, '#8a8a9a'], ...tags] : tags, cx, y, 'center');
        y += 18;
      }
      // hearts + level name on one row, progress to the next level under it
      const lv = heartIndex(p.aff);
      const lname = HEARTS[lv][1];
      const rowW = 78 + 6 + measure(c, lname, 12);
      const hx = Math.round(cx - rowW / 2);
      drawHearts(c, hx, y, lv, 2);
      T(c, lname, hx + 84, y + 2, 12, PC.pink);
      R(c, hx, y + 19, rowW, 4, '#5a4a5a');
      R(c, hx + 1, y + 20, rowW - 2, 2, '#efe4ee');
      R(c, hx + 1, y + 20, Math.round((rowW - 2) * levelProgress(p.aff)), 2, PC.pink);
      y += 28;
      const btnY = a.y + a.h - 26;
      const lines = [];
      if (def.profile) wrap(c, g.fmt(def.profile), a.w - 20, 12).slice(0, 2).forEach((l) => lines.push([l, PC.text]));
      if (def.where) wrap(c, 'よくいる場所：' + def.where, a.w - 20, 12).slice(0, 2).forEach((l) => lines.push([l, '#4a5a8a']));
      const known = Object.entries(p.known || {}).filter(([, r]) => r === 'love' || r === 'like').sort((x, z) => (x[1] === 'love' ? 0 : 1) - (z[1] === 'love' ? 0 : 1)).map(([it]) => (ITEMS[it] ? ITEMS[it].name : it));
      // (a little narrower than the row: wrap may let a 、 hang past the edge)
      if (known.length) wrap(c, '好きなもの：' + known.join('、'), a.w - 32, 12).slice(0, 2).forEach((l) => lines.push([l, PC.pink]));
      else lines.push(['好きなもの：？？？', PC.dim]);
      R(c, a.x + 8, y - 4, a.w - 16, 1, PC.line);
      for (const [l, col] of lines) {
        if (y + 13 > btnY - 1) break;
        T(c, fitText(c, l, a.w - 20, 12), a.x + 10, y, 12, col);
        y += 14;
      }
      const s = inviteState(g, id);
      const col = s.ok ? APP_COLORS.messages : '#c8c2b4';
      box(c, a.x + 16, btnY, a.w - 32, 22, 6, col, shade(col, -0.45), { lo: shade(col, -0.15) });
      T(c, s.ok ? 'さそう（A）' : fitText(c, s.why, a.w - 44, 12), a.x + a.w / 2, btnY + (s.ok ? 4 : 5), s.ok ? 14 : 12, s.ok ? '#ffffff' : '#6a6878', 'center');
    },
  };
}

// The calling screen: dialling, then the person's lines (A to continue).
function callView(g, def, lines) {
  return {
    noHeader: true,
    underStatus: true,
    bg: '#1b1f3a',
    noFooter: false,
    hint: 'A:つぎへ',
    cancel: false,
    line: 0,
    shown: 0,
    lines: [].concat(lines || '…').map((l) => g.fmt(String(l))),
    enter() { audio.sfx('chime'); },
    update(ph, inp) {
      if (this.t < 46) { if (this.t === 30) audio.sfx('ok'); return; }
      const total = Array.from(this.lines[this.line] || '').length;
      if (this.shown < total) {
        const b = Math.floor(this.shown);
        this.shown = Math.min(total, this.shown + 0.8);
        if (Math.floor(this.shown) !== b && b % 3 === 0) audio.sfx('talk');
        if (inp.pressed('a') || inp.pressed('b')) this.shown = total;
        return;
      }
      if (inp.pressed('a') || inp.pressed('b')) {
        audio.sfx('cursor');
        if (this.line < this.lines.length - 1) { this.line++; this.shown = 0; } else ph.back(true);
      }
    },
    draw(c, ph, a) {
      const cx = a.x + a.w / 2;
      R(c, a.x, SCREEN.y, a.w, SCREEN.h, '#1b1f3a');
      for (let i = 0; i < 3; i++) {
        const r = 40 + ((this.t * 0.6 + i * 14) % 42);
        if (this.t < 46) { c.globalAlpha = 0.3 * (1 - (r - 40) / 42); disc(c, cx, SCREEN.y + 74, r, '#5a6fd8'); c.globalAlpha = 1; }
      }
      disc(c, cx, SCREEN.y + 74, 39, '#0c0e1e');
      disc(c, cx, SCREEN.y + 74, 37, '#3a4a8a');
      disc(c, cx, SCREEN.y + 74, 35, mix(def.look && /^#/.test(def.look.top || '') ? def.look.top : '#5fd7ff', '#ffffff', 0.55));
      drawFaceHD(c, def.look || {}, cx - 32, SCREEN.y + 52, 2);
      text(c, def.name, cx, SCREEN.y + 120, { size: 16, align: 'center', color: '#fff', shadow: '#000' });
      const dots = '.'.repeat(1 + (Math.floor(this.t / 12) % 3));
      const sec = Math.max(0, Math.floor((this.t - 46) / 60));
      T(c, this.t < 46 ? '発信中' + dots : `通話中 0:${String(sec).padStart(2, '0')}`, cx, SCREEN.y + 142, 12, '#9aa3c7', 'center');
      if (this.t >= 46) {
        const all = this.lines[this.line] || '';
        const vis = Array.from(all).slice(0, Math.floor(this.shown)).join('');
        const ls = wrap(c, all, a.w - 40, 12);
        const bh = Math.max(1, ls.length) * 15 + 12;
        const by = SCREEN.y + 166;
        box(c, a.x + 12, by, a.w - 24, bh, 6, '#ffffff', '#0c0e1e');
        let rem = Array.from(vis).length;
        ls.forEach((l, i) => {
          const ch = Array.from(l);
          T(c, ch.slice(0, Math.max(0, rem)).join(''), a.x + 20, by + 6 + i * 15, 12, PC.text);
          rem -= ch.length;
        });
        if (this.shown >= Array.from(all).length) downArrow(c, a.x + a.w - 26, by + bh - 10, ph.t, PC.dim);
      }
      // hang-up button
      const hy = SCREEN.y + SCREEN.h - FOOTER_H - 26;
      disc(c, cx, hy, 13, '#5a0a14');
      disc(c, cx, hy, 12, '#e8484f');
      R(c, cx - 7, hy - 1, 14, 3, '#ffffff');
      R(c, cx - 8, hy, 3, 3, '#ffffff'); R(c, cx + 5, hy, 3, 3, '#ffffff');
    },
  };
}

// Call someone: invite them out when you are friends (once a day each).
export async function callPerson(g, id) {
  const def = PEOPLE[id];
  if (!def) { console.error('callPerson: unknown person', id); return false; }
  const p = g.meet(id);
  return withPhone(g, async (ph) => {
    if (heartIndex(p.aff) < 2) { await ph.open(callView(g, def, lineFor(def, 'callShy', g))); return false; }
    if (p.hangDay === g.state.day) { await ph.open(callView(g, def, lineFor(def, 'callAgain', g))); return false; }
    const spots = Object.values(HANGOUTS);
    const k = await ph.open(listView(g, {
      title: `${def.name}をさそう`,
      color: APP_COLORS.contacts,
      hint: 'A:さそう　B:やめる',
      items: spots.map((s) => {
        const why = spotBlock(g, s);
        return {
          label: s.name,
          right: s.price ? fmtMoney(s.price) : '無料',
          rightColor: g.state.money < s.price ? PC.bad : PC.dim,
          sub: spotEffects(s),
          disabled: !!why,
          why,
        };
      }),
    }));
    if (k < 0) return false;
    const ok = await ph.open(callView(g, def, lineFor(def, 'callYes', g)));
    if (ok !== true) return false;
    return g.hangout(id, spots[k].id);
  });
}
// Why you cannot go to a spot right now (money / stamina), or null.
function spotBlock(g, s) {
  if (g.state.money < s.price) return 'お金が足りない…';
  if (g.state.stamina < (s.stamina ?? 5)) return '体力が足りない…';
  return null;
}
function spotEffects(s) {
  const out = [`ストレス-${s.stress}`, `体力-${s.stamina}`, `♥+${s.aff}`];
  if (s.fill) out.push(`満腹+${s.fill}`);
  if (s.clean) out.push(`身だしなみ+${s.clean}`);
  return out.join(' ');
}

// ---------------------------------------------------------------- schedule
export async function scheduleApp(g) {
  return phoneView(g, scheduleView(g));
}
function scheduleView(g) {
  return {
    title: '予定',
    color: APP_COLORS.schedule,
    hint: '←→:日をえらぶ　B:もどる',
    sel: weekdayOf(g.state.day),
    cancel: -1,
    headerRight: () => `第${g.week}週`,
    update(ph, inp) {
      if (inp.repeat('left')) { this.sel = (this.sel + 6) % 7; audio.sfx('cursor'); }
      if (inp.repeat('right')) { this.sel = (this.sel + 1) % 7; audio.sfx('cursor'); }
      if (inp.pressed('b') || inp.pressed('a')) { audio.sfx('cancel'); ph.back(-1); }
    },
    regularsOn(i) {
      const st = g.state;
      return Object.keys(st.regulars).filter((id) => REGULARS[id] && !st.regulars[id].dropped && REGULARS[id].weekday === i);
    },
    // 'done' | 'missed' | 'today' | 'later' | 'next' (starts next week)
    regularStatus(id, i) {
      const s = g.state.regulars[id];
      const wd = weekdayOf(g.state.day);
      if (s.doneWeek >= g.week) {
        if (s.count === 0 && s.missed === 0) return 'next';
        return s.missed > 0 ? 'missed' : 'done';
      }
      if (i === wd) return 'today';
      return i < wd ? 'missed' : 'later';
    },
    entries(i) {
      const st = g.state;
      const wd = weekdayOf(st.day);
      const out = [];
      if (i === 0) {
        const h = g.housing();
        if (st.rent.debt) out.push(['rent', `家賃の日（${fmtMoney(h.rent)}）`, `未払い ${fmtMoney(st.rent.debt)}（家計で払える）`, PC.bad]);
        else out.push(['rent', `家賃の日（${fmtMoney(h.rent)}）`, '今週分は支払いずみ', PC.good]);
      }
      for (const id of this.regularsOn(i)) {
        const r = REGULARS[id];
        const place = PLACES[r.place] ? PLACES[r.place].name : '';
        const s = this.regularStatus(id, i);
        const w = showWords(r);
        const sub = { done: [w.done, PC.good], missed: ['休んでしまった…', PC.bad], today: [`今日！${place}へ行こう`, PC.accent], later: [`${place}　ギャラ ${fmtMoney(r.pay)}`, PC.dim], next: ['来週から', PC.dim] }[s];
        out.push([s === 'done' ? 'done' : s === 'missed' ? 'miss' : 'tv', `『${r.title}』${w.act}`, sub[0], sub[1]]);
      }
      if (i === wd) for (const m of pendingInvites(g)) out.push(['invite', `${senderName(m)}からおさそい`, `${HANGOUTS[m.spot] ? HANGOUTS[m.spot].name + '・' : ''}返事はメッセージで`, PC.good]);
      return out;
    },
    draw(c, ph, a) {
      const st = g.state;
      const wd = weekdayOf(st.day);
      const monday = st.day - wd;
      T(c, `${monday}日目〜${monday + 6}日目`, a.x + 8, a.y + 6, 12, PC.dim);
      T(c, `家賃まで ${rentWhen(g)}`, a.x + a.w - 8, a.y + 6, 12, PC.dim, 'right');
      const cw = 30, sx = a.x + 7, sy = a.y + 24, ch = 60;
      for (let i = 0; i < 7; i++) {
        const x = sx + i * cw;
        const today = i === wd, past = i < wd, sel = i === this.sel;
        const fill = today ? '#fff1c2' : past ? '#e3ded2' : '#ffffff';
        box(c, x + 1, sy, cw - 2, ch, 4, fill, sel ? '#c8901a' : '#bdb5a2');
        if (sel) rrect(c, x + 2, sy + 1, cw - 4, 2, 1, '#e0a82e');
        const wcol = i === 5 ? '#3a6fd8' : i === 6 ? PC.bad : PC.text;
        T(c, WEEKDAYS[i], x + cw / 2, sy + 5, 12, past ? mix(wcol, '#c8c0b0', 0.5) : wcol, 'center');
        T(c, String(monday + i), x + cw / 2, sy + 20, 12, past ? PC.dim : PC.text, 'center');
        let iy = sy + 36;
        if (i === 0) { miniIcon(c, x + 9, iy, 'rent'); iy += 12; }
        const regs = this.regularsOn(i);
        if (regs.length) {
          const s = this.regularStatus(regs[0], i);
          miniIcon(c, x + 9, Math.min(iy, sy + ch - 14), s === 'done' ? 'done' : s === 'missed' ? 'miss' : 'tv');
        }
        if (today) { art(c, x + cw / 2 - 3, sy + ch + 2, ['#######', '.#####.', '..###..', '...#...'].reverse(), { '#': PC.accent }); }
      }
      // details of the selected day
      let y = sy + ch + 12;
      const day = monday + this.sel;
      R(c, a.x + 8, y - 2, a.w - 16, 1, PC.line);
      T(c, `${day}日目（${WEEKDAYS[this.sel]}）${this.sel === wd ? '　今日' : this.sel < wd ? '　すぎた日' : ''}`, a.x + 10, y + 3, 14, PC.text);
      y += 24;
      const es = this.entries(this.sel);
      if (!es.length) T(c, '予定なし', a.x + 14, y, 12, PC.dim);
      for (const [icon, t1, t2, col] of es) {
        if (y > a.y + a.h - 28) break;
        miniIcon(c, a.x + 10, y + 1, icon);
        T(c, fitText(c, t1, a.w - 36, 12), a.x + 28, y, 12, PC.text);
        T(c, fitText(c, t2, a.w - 36, 12), a.x + 28, y + 14, 12, col);
        y += 32;
      }
    },
  };
}

// ---------------------------------------------------------------- money
export async function moneyApp(g) {
  return phoneView(g, moneyView(g));
}
function moneyView(g) {
  return {
    title: '家計',
    color: APP_COLORS.money,
    cancel: -1,
    flash: 0,
    hint() {
      const st = g.state;
      if (!st.rent.debt) return 'B:もどる';
      return st.money >= st.rent.debt ? 'A:未払いを払う　B:もどる' : st.money > 0 ? 'A:払えるだけ払う　B:もどる' : 'B:もどる';
    },
    update(ph, inp) {
      if (this.flash > 0) this.flash--;
      const st = g.state;
      if (inp.pressed('a') && st.rent.debt) {
        const d = st.rent.debt;
        const h = g.housing();
        if (st.money <= 0) { audio.sfx('buzz'); ph.toast(`お金が足りない…（未払い ${fmtMoney(d)}）`, '#ff5d6c'); return; }
        // as much as the money allows: the rest stays as debt
        const cleared = g.payDebt(true);
        const paid = g.lastDebtPaid || 0;
        this.flash = 40;
        if (cleared) {
          g.message({ from: h.name, kind: 'bill', read: true, text: `未払いの家賃 ${fmtMoney(d)} をお支払いいただきました。ありがとうございました。` });
          ph.toast(`家賃 -${fmtMoney(d)}　ほっとした…`, '#8a5ac8');
        } else {
          g.message({ from: h.name, kind: 'bill', read: true, text: `未払い分 ${fmtMoney(paid)} をお支払いいただきました。（のこり ${fmtMoney(st.rent.debt)}）` });
          ph.toast(`家賃 -${fmtMoney(paid)}（のこり ${fmtMoney(st.rent.debt)}）`, '#8a5ac8');
        }
        return;
      }
      if (inp.pressed('b') || inp.pressed('a')) { audio.sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      const st = g.state;
      const h = g.housing();
      // money card
      const cx = a.x + 8, cy = a.y + 8, cw = a.w - 16;
      box(c, cx, cy, cw, 50, 6, '#2c2f52', '#0c0e1e', { hi: '#4a4e7a', lo: '#1e2040' });
      rrect(c, cx + 10, cy + 30, 16, 12, 2, '#e0a82e'); R(c, cx + 12, cy + 34, 12, 1, '#a07018'); R(c, cx + 17, cy + 31, 1, 10, '#a07018');
      T(c, '所持金', cx + 10, cy + 8, 12, '#c8cce8');
      text(c, fmtMoney(st.money), cx + cw - 10, cy + 22, { size: 20, align: 'right', color: '#ffd23f', shadow: '#000' });
      // housing
      let y = cy + 60;
      T(c, '住まい', a.x + 10, y, 12, PC.dim);
      T(c, `${fmtMoney(h.rent)}／週`, a.x + a.w - 10, y, 12, PC.text, 'right');
      T(c, fitText(c, h.name, a.w - 20, 14), a.x + 10, y + 14, 14, PC.text);
      T(c, `次の家賃：${rentWhen(g)}（月曜の朝）`, a.x + 10, y + 32, 12, PC.dim);
      // weekly shows only (a one-day event such as the fan meeting is not weekly pay)
      const regs = Object.keys(st.regulars).filter((id) => REGULARS[id] && !st.regulars[id].dropped && !st.regulars[id].declined && REGULARS[id].medium !== 'event');
      if (regs.length) {
        const sum = regs.reduce((s, id) => s + (REGULARS[id].pay || 0), 0);
        T(c, `レギュラー ${regs.length}本：目安 ${fmtMoney(sum)}／週`, a.x + 10, y + 46, 12, PC.good);
      }
      // debt
      y += regs.length ? 66 : 54;
      if (st.rent.debt) {
        const col = this.flash ? PC.good : PC.bad;
        box(c, a.x + 8, y, a.w - 16, 40, 5, '#fff0f0', col);
        T(c, '未払いの家賃', a.x + 16, y + 5, 12, col);
        text(c, fmtMoney(st.rent.debt), a.x + 16, y + 19, { size: 16, color: col, shadow: null });
        const ok = st.money > 0;
        const bc = ok ? APP_COLORS.money : '#c8c2b4';
        box(c, a.x + a.w - 78, y + 9, 62, 22, 5, bc, shade(bc, -0.5), { lo: shade(bc, -0.2) });
        T(c, st.money >= st.rent.debt || !ok ? '払う(A)' : '一部払う', a.x + a.w - 47, y + 13, 12, ok ? '#ffffff' : '#6a6878', 'center');
      } else {
        box(c, a.x + 8, y, a.w - 16, 24, 5, this.flash ? '#e8ffe0' : '#f0f8ea', PC.good);
        miniIcon(c, a.x + 14, y + 6, 'done');
        T(c, this.flash ? '支払い完了！' : '未払いはありません', a.x + 30, y + 5, 12, PC.good);
      }
      y += st.rent.debt ? 48 : 32;
      // recent bills
      T(c, '最近の明細', a.x + 10, y, 12, PC.dim);
      R(c, a.x + 8, y + 15, a.w - 16, 1, PC.line);
      y += 19;
      const bills = st.phone.inbox.filter((m) => m.kind === 'bill');
      if (!bills.length) T(c, 'まだ明細はない', a.x + 14, y, 12, PC.dim);
      for (const m of bills) {
        if (y > a.y + a.h - 15) break;
        T(c, `${m.day}日目`, a.x + 10, y, 12, PC.dim);
        T(c, fitText(c, oneLine(g.fmt(m.text)), a.w - 70, 12), a.x + 56, y, 12, PC.text);
        y += 15;
      }
    },
  };
}

// ---------------------------------------------------------------- people: lines
// Generic lines (standard / Kansai). A person may override any of them with
// def[key] (string | string[] | (g, def) => …).
const LINES = {
  greet1: ['あ、{name}さん。こんにちは！', 'あ、{name}さん。どうも〜！'],
  greet2: ['おっ、{name}！元気にしてた？', 'おっ、{name}やん！元気しとった？'],
  greet3: ['{name}！ちょうど話したいと思ってたんだ。', '{name}！ちょうど会いたい思てたとこや。'],
  greet4: ['{name}〜！会えてうれしい！', '{name}〜！会えてめっちゃうれしいわ！'],
  greetPartner: ['相方！今日も一緒にがんばろう！', '相方！今日もいっちょやったろか！'],
  greetSpecial: ['{name}…！えへへ、会えてうれしいな。', '{name}…！えへへ、会えてうれしいわ。'],
  again: ['ほかに何かある？', 'ほかになんかある？'],
  noGift: ['（わたせそうなものを持っていない…）\n（商店街の「はなや」やスーパーで、プレゼントを買える）', '（わたせそうなものを持っていない…）\n（商店街の「はなや」やスーパーで、プレゼントを買える）'],
  giftDone: ['今日はもうもらったよ！\nまた今度ね。', '今日はもうもろたで！\nまた今度な。'],
  hangDone: ['今日はもう遊んだし、また今度ね！', '今日はもう遊んだし、また今度な！'],
  inviteYes: ['いいね、行こう！', 'ええやん、行こ行こ！'],
  callShy: [['もしもし？…あ、どうも！', 'また今度、ゆっくり話そうね。'], ['もしもし？…あ、どうも〜！', 'また今度、ゆっくりしゃべろな。']],
  smalltalk: ['最近どう？　お仕事、がんばってる？', '最近どないや？　仕事、がんばってるか？'],
  callAgain: [['今日はもう十分遊んだね！', 'またね〜。'], ['今日はもう十分遊んだなあ！', 'ほなまたな〜。']],
  callYes: [['もしもし？…うん、行く行く！'], ['もしもし？…おっ、ええな！行く行く！']],
  thanks: ['今日はありがとう！楽しかった〜。また行こうね。', '今日はおおきに！めっちゃ楽しかったわ。また行こな！'],
  declined: ['了解！また誘うね〜。', '了解！またさそうわ〜。'],
  hangBye: ['また来ようね！', 'また来よな！'],
  love: [['わあっ、{item}！？　これ大好きなんだ！', '覚えててくれたの？　本当にありがとう！'], ['うわっ、{item}やん！　これめっちゃ好きやねん！', 'なんで知ってるん？　ほんまにありがとう！']],
  like: [['{item}だ！　ありがとう、うれしいな。'], ['{item}や！　おおきに、うれしいわ。']],
  neutral: [['これ、くれるの？　ありがとう！'], ['え、くれるん？　ありがとうな。']],
  dislike: [['あ…{item}か…。', 'ごめん、これはちょっと苦手なんだ…。\n気持ちだけもらっておくね。'], ['あ…{item}か…。', 'ごめんな、これちょっと苦手やねん…。\n気持ちだけもろとくわ。']],
};
// The line(s) for `key`: def[key] first, else the generic one in the person's dialect.
export function lineFor(def, key, g = null) {
  let v = def && def[key];
  if (v == null && key === 'inviteYes' && def && def.yes) v = pickOne(def.yes); // people.js name
  if (typeof v === 'function') v = v(g, def);
  if (v != null && v !== '') return v;
  const pair = LINES[key];
  if (!pair) return '';
  return pair[isKansai(def) ? 1 : 0];
}
const pickOne = (v) => (Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v);
// A line as one chat-bubble string (phone messages).
const msgLine = (def, key, g) => [].concat(lineFor(def, key, g)).join('\n');
function greeting(g, def, id) {
  const lv = g.heartLevel(id);
  let v = def.greet;
  if (typeof v === 'function') v = v(g, lv, def);
  else if (v && typeof v === 'object' && !Array.isArray(v)) v = v[lv] ?? v.default;
  v = pickOne(v);
  if (v) return v;
  if (g.state.partner === id) return lineFor(def, 'greetPartner', g);
  if (g.state.people[id] && g.state.people[id].special) return lineFor(def, 'greetSpecial', g);
  return lineFor(def, 'greet' + clamp(lv, 1, 4), g);
}
// A list of lines → g.say calls: strings are spoken by the person, lines that start
// with '（' are narration, { text, name, look } objects pick their own speaker.
async function sayLines(g, lines, def) {
  const list = [].concat(lines || []).filter((l) => l != null && l !== '');
  let group = [], key = null, opts = null;
  for (const l of list) {
    let s, k, o;
    const narr = typeof l === 'object' ? !!l.narr : /^[（(]/.test(String(l));
    s = typeof l === 'object' ? l.text : String(l);
    if (narr) { k = '#narr'; o = {}; } else if (typeof l === 'object' && l.name) { k = 'n:' + l.name; o = { name: l.name, look: l.look }; } else { k = '#p'; o = { name: def.name, look: def.look }; }
    if (group.length && k !== key) { await g.say(group, opts); group = []; }
    key = k;
    opts = o;
    group.push(s);
  }
  if (group.length) await g.say(group, opts);
}

// ---------------------------------------------------------------- people: talking
// Items the player can give: gifts first, then other usable things; keepsakes
// (price 0 without an effect) and key items stay out.
function giftable(g) {
  const ids = Object.keys(g.state.items).filter((k) => g.state.items[k] > 0 && ITEMS[k] && !ITEMS[k].key && (ITEMS[k].gift || ITEMS[k].heal || ITEMS[k].buff || ITEMS[k].price > 0));
  // real gifts first, then food, other things, and cooking ingredients last
  const order = (k) => (ITEMS[k].gift ? 0 : isIngredient(k) ? 3 : ITEMS[k].heal ? 1 : 2);
  return ids.sort((a, b) => order(a) - order(b));
}
const isIngredient = (k) => /^ing_/.test(k);
// An item's description in the gift list (without the "give it to someone" hint).
const giftDesc = (k) => String((ITEMS[k] && ITEMS[k].desc) || '').replace(/\n?（人に話しかけて「プレゼント」でわたそう）\s*$/, '');

async function giftFlow(g, id, def, npc) {
  const p = g.person(id);
  const opts = { name: def.name, look: npc.look || def.look };
  if (p.giftDay === g.state.day) { await g.say(lineFor(def, 'giftDone', g), opts); return; }
  const ids = giftable(g);
  if (!ids.length) { await g.say(lineFor(def, 'noGift', g)); return; }
  const known = p.known || {};
  const mark = { love: '♥', like: '♪', dislike: '×' };
  const i = await g.list({
    title: `${def.name}へのプレゼント`,
    items: ids.map((k) => ({ label: (mark[known[k]] ? mark[known[k]] + ' ' : '') + (isIngredient(k) ? '（食材）' : '') + ITEMS[k].name, right: '×' + g.state.items[k] })),
    x: 12, y: 56, w: 330, px: true,
    describe: (k) => giftDesc(ids[k]) + (g.giftRepeat && g.giftRepeat(id, ids[k]) ? '\n（このあいだも同じものをあげた）' : ''),
  });
  if (i < 0) return;
  const item = ids[i];
  const reaction = g.giftReaction(id, item);
  const repeat = !!(g.giftRepeat && g.giftRepeat(id, item)) && (reaction === 'love' || reaction === 'like');
  const lvBefore = g.heartLevel(id);
  g.giveGift(id, item); // also records the reaction in p.known (contact card)
  const shown = repeat ? 'neutral' : reaction; // the same favourite again: a polite thank-you
  const emo = { love: '♥', like: '♪', neutral: '!', dislike: '…' }[shown];
  if (npc.id) g.emote(npc.id, emo, 60);
  audio.sfx(shown === 'love' ? 'success' : shown === 'like' ? 'good' : shown === 'dislike' ? 'cancel' : 'ok');
  const name = ITEMS[item] ? ITEMS[item].name : item;
  let lines = repeat ? (def.giftLines && def.giftLines.repeat) : def.giftLines && (def.giftLines[item] || def.giftLines[reaction]);
  if (typeof lines === 'function') lines = lines(g, item, def);
  if (!lines) lines = lineFor(def, shown, g);
  await g.say([].concat(lines).map((l) => String(l).replaceAll('{item}', name)), opts);
  if (repeat) await g.say('（このあいだと同じプレゼントだったからか、\n前ほどは喜んでいないみたいだ。ちがう物も選んでみよう）');
  levelUpToast(g, id, lvBefore, false); // g.giveGift's addAff already showed the toast
}
function levelUpToast(g, id, before, toast = true) {
  const lv = g.heartLevel(id);
  if (lv > before) { audio.sfx('fanfare'); if (toast) g.notify(`${PEOPLE[id].name}と「${HEARTS[lv][1]}」になった！`, { color: COLORS.pink }); }
}

async function inviteFlow(g, id, def, npc) {
  const p = g.person(id);
  const opts = { name: def.name, look: npc.look || def.look };
  if (p.hangDay === g.state.day) { await g.say(lineFor(def, 'hangDone', g), opts); return false; }
  const spots = Object.values(HANGOUTS);
  const k = await g.list({
    title: `${def.name}をどこにさそう？`,
    items: spots.map((s) => ({ label: s.name, right: s.price ? fmtMoney(s.price) : '無料', disabled: !!spotBlock(g, s) })),
    x: 12, y: 56, w: 330, px: true,
    describe: (j) => spotEffects(spots[j]).replaceAll(' ', '　') + (spotBlock(g, spots[j]) ? '\n' + spotBlock(g, spots[j]) : ''),
  });
  if (k < 0) return false;
  const why = spotBlock(g, spots[k]);
  if (why) { await g.say(`${why}\n（${spots[k].name}は、また今度にしよう）`); return false; }
  await sayLines(g, [].concat(lineFor(def, 'inviteYes', g)), { ...def, look: opts.look });
  return g.hangout(id, spots[k].id);
}

// Content hooks (PEOPLE_UI.hooks, documented in life.js). Errors are logged and skipped.
function hookList(name) {
  const h = PEOPLE_UI.hooks && PEOPLE_UI.hooks[name];
  return Array.isArray(h) ? h : typeof h === 'function' ? [h] : [];
}
function runHooksSync(name, ...args) {
  for (const fn of hookList(name)) { try { fn(...args); } catch (e) { console.error(e); } }
}
async function runHooks(name, ...args) {
  for (const fn of hookList(name)) { try { await fn(...args); } catch (e) { console.error(e); } }
}
async function firstHook(name, ...args) {
  for (const fn of hookList(name)) {
    try { const v = await fn(...args); if (v) return v; } catch (e) { console.error(e); }
  }
  return null;
}
// The extra menu entries that apply now: [{ key, label, run }]. Entries are objects
// { id, label, cond(g, id, npc), run(g, id, npc), repeat, order } (life.js); a function
// (g, def, npc) => entry | [entries] | null is also accepted (its run gets (g, def, npc)).
function menuExtras(g, id, def, npc, used) {
  const out = [];
  const add = (o, legacy, i) => {
    if (!o || typeof o.run !== 'function') return;
    if (!legacy && o.cond) { try { if (!o.cond(g, id, npc)) return; } catch (e) { console.error(e); return; } }
    let label = o.label;
    try { if (typeof label === 'function') label = label(g, id, npc); } catch (e) { console.error(e); return; }
    if (!label) return;
    const key = 'x:' + (o.id || label);
    if (used.has(key) && !o.repeat) return;
    const run = legacy ? () => o.run(g, def, npc) : () => o.run(g, id, npc);
    out.push({ key, label: String(label), run, order: o.order ?? 50, i });
  };
  (PEOPLE_UI.extras || []).forEach((e, i) => {
    if (typeof e === 'function') {
      try { for (const o of [].concat(e(g, def, npc) || [])) add(o, true, i); } catch (err) { console.error(err); }
    } else add(e, false, i);
  });
  return out.sort((a, b) => a.order - b.order || a.i - b.i);
}

// Talking to an NPC linked to a person (see g.talkPerson).
export async function talkPersonUI(g, npc) {
  const id = npc && npc.person;
  const def = PEOPLE[id];
  if (!def) { await (npc.talk ? npc.talk(g, npc) : g.say(npc.text, { name: npc.name, look: npc.look })); return; }
  const first = !g.met(id);
  const rec = g.meet(id);
  if (!rec.seen) rec.seen = {}; // records from older builds
  if (typeof rec.aff !== 'number') rec.aff = 0;
  // once you have talked, the nameplate is the person's name all through the talk (also
  // in the venue's own talk, which reads npc.name), not the NPC's job title
  const ownName = npc.name;
  const named = !first && !!rec.talkDay && !!def.name && ownName !== def.name;
  if (named) npc.name = def.name;
  runHooksSync('start', g, id, npc);
  try {
    const ev = g.pendingHeartEvent(id);
    if (ev) {
      g.person(id).seen[ev.level] = true;
      await ev.run(g, def, npc);
      return;
    }
    if (await firstHook('before', g, id, npc)) return;
    await talkMenu(g, id, def, npc, first);
  } finally {
    if (named) npc.name = ownName;
    await runHooks('after', g, id, npc);
  }
}

// Daily affinity from the first talk of a day: a little more while you are still strangers.
const TALK_AFF = 2, TALK_AFF_NEW = 3;
async function talkMenu(g, id, def, npc, first) {
  const look = npc.look || def.look;
  let greet = null; // the menu's opening line: 話す does not repeat it
  const chatLines = () => (Array.isArray(def.chats) ? def.chats : def.chats ? [def.chats] : [])
    .map((l) => { try { return typeof l === 'function' ? l(g) : l; } catch (e) { console.error(e); return null; } })
    .filter((l) => l && l !== greet);
  // the very first talk: their own introduction (the NPC's talk / text), no menu yet
  const newFace = first || !g.person(id).talkDay;
  const chat = async () => {
    const p = g.person(id);
    const firstToday = p.talkDay !== g.state.day;
    // one personal line on the first talk of the day (def.chats)
    let today = null;
    if (firstToday && heartIndex(p.aff) >= 1) today = pickOne(chatLines()) || null;
    if (npc.talk) await npc.talk(g, npc);
    else if (today) { await g.say(today, { name: def.name, look }); today = null; } else if (npc.text && newFace) await g.say(npc.text, { name: npc.name || def.name, look });
    else {
      // known faces do not introduce themselves again: one of their own lines
      let own = typeof def.chat === 'function' ? def.chat(g, def) : def.chat;
      if (!own || (Array.isArray(own) && !own.length)) own = pickOne(chatLines());
      await sayLines(g, own ? [].concat(own) : [lineFor(def, 'smalltalk', g)], { ...def, look });
    }
    if (today) await g.say(today, { name: def.name, look });
    if (firstToday) {
      p.talkDay = g.state.day;
      const lv = g.heartLevel(id);
      g.addAff(id, lv < 1 ? TALK_AFF_NEW : TALK_AFF, true);
      if (npc.id) g.emote(npc.id, '♥', 40);
      levelUpToast(g, id, lv);
      // still strangers: show how close the next step is
      // (the very first acquaintance also explains how friendships grow)
      if (g.heartLevel(id) < 1 && (!newFace || !g.flag('people_tip'))) {
        const short = def.short || def.name;
        await g.say(newFace
          ? `（${short}と知り合った！毎日話しかけたり、\nプレゼントをわたしたりすると、仲良くなれる。♥ ${g.aff(id)}/${HEARTS[1][0]}）`
          : `（${short}と、すこし打ち解けた気がする。♥ ${g.aff(id)}/${HEARTS[1][0]}）`);
        if (newFace) g.setFlag('people_tip', true);
      }
    }
  };
  if (newFace && g.heartLevel(id) < 1) {
    await chat();
    if (first) g.notify(`${def.name}と知り合った`, { color: COLORS.pink });
    return;
  }
  const used = new Set();
  greet = (await firstHook('greet', g, id, npc)) || greeting(g, def, id);
  let prompt = greet;
  for (let turn = 0; turn < 16; turn++) {
    const lv = g.heartLevel(id);
    const opts = [];
    if (!used.has('talk')) opts.push([fitLabel(def.talkLabel || '話す'), 'talk']);
    if (!used.has('gift')) opts.push(['プレゼント', 'gift']);
    if (lv >= 2 && !used.has('invite')) opts.push(['さそう', 'invite']);
    for (const x of menuExtras(g, id, def, npc, used)) opts.push([fitLabel(x.label), x.key, x]);
    if (!opts.length) break;
    opts.push(['またね', 'bye']);
    const k = await g.ask(prompt, opts.map((o) => o[0]), { name: def.name, look, cancel: opts.length - 1 });
    const [, act, extra] = opts[k] || opts[opts.length - 1];
    if (act === 'bye') break;
    used.add(act);
    if (act === 'talk') {
      await chat();
      if (npc.talk && def.talkLabel) break; // a shop / job desk says its own goodbye
    } else if (act === 'gift') await giftFlow(g, id, def, npc);
    else if (act === 'invite') { if (await inviteFlow(g, id, def, npc)) break; } else if (extra) { let r; try { r = await extra.run(); } catch (e) { console.error(e); } if (r === 'end') break; }
    if (!g.person(id)) break;
    prompt = lineFor(def, 'again', g);
  }
}
const fitLabel = (s) => (Array.from(String(s)).length > 14 ? Array.from(String(s)).slice(0, 13).join('') + '…' : String(s));
if (!Array.isArray(PEOPLE_UI.extras)) PEOPLE_UI.extras = [];
if (!PEOPLE_UI.hooks) PEOPLE_UI.hooks = {};
for (const k of ['start', 'before', 'greet', 'after']) if (!PEOPLE_UI.hooks[k]) PEOPLE_UI.hooks[k] = [];

// ---------------------------------------------------------------- hangout vignette
const AW = 208, AH = 108; // illustration, in art pixels (drawn at 2x)
const FX = 112, FY = 18, FW = AW * 2, FH = AH * 2;

function sheetImg(look, dir = 'down') {
  const sh = charSheetHD(look || {});
  return (sh[dir] || sh.down)[0];
}
const P = {
  stand(c, look, x, y, dir = 'down') { const im = sheetImg(look, dir); c.drawImage(im, 0, 0, im.width, im.height, x, y, 32, 40); },
  // upper body only (the rest is hidden by a table / counter)
  seat(c, look, x, y, dir = 'down', rows = 30) { const im = sheetImg(look, dir); c.drawImage(im, 0, 0, im.width, (im.height * rows) / 40, x, y, 32, rows); },
  legs(c, look, x, y) { const im = sheetImg(look); c.drawImage(im, 0, (im.height * 30) / 40, im.width, im.height / 4, x, y, 32, 10); },
};
function cloud(c, x, y) {
  x = Math.round(x);
  rrect(c, x, y + 4, 34, 9, 4, '#ffffff');
  rrect(c, x + 6, y, 14, 9, 4, '#ffffff');
  rrect(c, x + 16, y + 2, 12, 8, 4, '#ffffff');
  R(c, x + 3, y + 12, 28, 1, '#d8eef8');
}
function lantern(c, x, y) {
  R(c, x + 5, y - 6, 2, 6, '#3a2010');
  R(c, x + 2, y, 8, 2, '#2a1a1a');
  R(c, x, y + 3, 12, 11, '#d6304a'); R(c, x + 1, y + 2, 10, 13, '#d6304a');
  R(c, x - 1, y + 4, 1, 9, '#5a1018'); R(c, x + 12, y + 4, 1, 9, '#5a1018');
  R(c, x + 2, y + 4, 2, 8, '#ff7a7a');
  R(c, x, y + 6, 12, 1, '#a01a30'); R(c, x, y + 10, 12, 1, '#a01a30');
  R(c, x + 2, y + 15, 8, 2, '#2a1a1a');
  R(c, x + 5, y + 17, 2, 3, '#ffd23f');
}
function steam(c, x, y, t, n = 3) {
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.35 + i * 7) % 16;
    c.globalAlpha = Math.max(0, 0.8 - ph / 18);
    R(c, x + i * 5 + ((Math.floor(ph / 4) + i) % 2), y - ph, 1, 3, '#ffffff');
  }
  c.globalAlpha = 1;
}
function bowl(c, x, y, t) {
  steam(c, x + 6, y - 2, t);
  R(c, x + 2, y, 20, 1, '#2a1a12');
  R(c, x + 1, y + 1, 22, 3, '#e8a858');
  R(c, x + 4, y + 2, 7, 1, '#fff0a0'); R(c, x + 12, y + 1, 4, 1, '#fff0a0'); R(c, x + 6, y + 3, 5, 1, '#fff0a0');
  R(c, x + 15, y + 1, 4, 2, '#ffffff'); R(c, x + 16, y + 1, 2, 1, '#ff7eb6');
  R(c, x + 8, y + 1, 1, 1, '#5ec44a'); R(c, x + 11, y + 3, 1, 1, '#5ec44a');
  R(c, x, y + 1, 1, 4, '#2a1a12'); R(c, x + 23, y + 1, 1, 4, '#2a1a12');
  R(c, x, y + 4, 24, 1, '#1e1414');
  R(c, x + 1, y + 5, 22, 3, '#c0392b'); R(c, x + 3, y + 8, 18, 1, '#a02a20'); R(c, x + 5, y + 9, 14, 1, '#6a1a14');
  for (let k = 0; k < 5; k++) R(c, x + 3 + k * 4, y + 6, 2, 1, '#ffffff');
}
function cup(c, x, y, t, col = '#c08a5a') {
  steam(c, x + 2, y - 2, t, 2);
  R(c, x, y, 10, 1, '#5a4a3a');
  R(c, x, y + 1, 10, 6, '#ffffff'); R(c, x + 1, y + 1, 8, 1, col);
  R(c, x + 3, y + 1, 1, 1, '#ffffff'); R(c, x + 5, y + 1, 1, 1, '#ffffff');
  R(c, x - 1, y + 1, 1, 6, '#5a4a3a'); R(c, x + 10, y + 1, 1, 6, '#5a4a3a');
  R(c, x + 11, y + 2, 2, 1, '#5a4a3a'); R(c, x + 12, y + 3, 1, 2, '#5a4a3a'); R(c, x + 11, y + 5, 2, 1, '#5a4a3a');
  R(c, x, y + 7, 10, 1, '#5a4a3a');
  R(c, x - 3, y + 8, 16, 1, '#8a8a9a');
}
function glass(c, x, y, liquid, top) {
  R(c, x, y, 8, 14, '#5a6478');
  R(c, x + 1, y, 6, 13, '#e8f4f8');
  R(c, x + 1, y + 4, 6, 9, liquid);
  R(c, x + 1, y + 4, 2, 9, shade(liquid, 0.3));
  if (top) R(c, x + 1, y + 2, 6, 3, top);
  R(c, x + 5, y - 6, 1, 9, '#ff7eb6');
}

const ART = {
  ramen(c, t, me, you) {
    // seen from the kitchen: the two of them at the counter, pots in the foreground
    R(c, 0, 0, AW, 58, '#b9814a');
    for (let x = 4; x < AW; x += 13) R(c, x, 6, 1, 52, '#a06c3a');
    R(c, 0, 0, AW, 5, '#5a3418'); R(c, 0, 5, AW, 1, '#3a2010');
    for (let i = 0; i < 9; i++) {
      const x = 30 + i * 14, y = 8;
      R(c, x, y, 11, 19, '#3a2010'); R(c, x + 1, y + 1, 9, 17, '#f6ecd2'); R(c, x + 1, y + 1, 9, 1, '#ffffff'); R(c, x + 9, y + 2, 1, 16, '#e0d2b0');
      for (let k = 0; k < 3; k++) R(c, x + 4, y + 3 + k * 5, 3, 3, k === 0 && i % 3 === 0 ? '#c0392b' : '#3a2a1a');
    }
    lantern(c, 9, 7);
    // entrance with a noren on the right
    R(c, 160, 8, 44, 50, '#3a2416'); R(c, 162, 10, 40, 48, '#d8eef8'); R(c, 162, 40, 40, 18, '#c8b898');
    R(c, 160, 8, 44, 16, '#2f3f7a'); for (let k = 0; k < 3; k++) R(c, 174 + k * 10, 10, 1, 14, '#24305e');
    R(c, 164, 13, 6, 6, '#ffffff'); R(c, 165, 14, 4, 4, '#2f3f7a');
    P.seat(c, you, 52, 17, 'down', 32); P.seat(c, me, 100, 17, 'down', 32);
    // customers' counter
    R(c, 0, 49, 156, 1, '#3a2010'); R(c, 0, 50, 156, 5, '#e8c48a'); R(c, 0, 50, 156, 1, '#f8e0b4'); R(c, 0, 55, 156, 6, '#8a5a32'); R(c, 0, 55, 156, 1, '#5a3418');
    R(c, 156, 49, 52, 12, '#8a5a32'); R(c, 156, 49, 52, 1, '#3a2010');
    bowl(c, 56, 40, t); bowl(c, 104, 40, t + 20);
    R(c, 82, 43, 1, 7, '#e8d0a0'); R(c, 84, 43, 1, 7, '#e8d0a0');
    // kitchen side: steel counter, pots, noodle baskets
    R(c, 0, 61, AW, 47, '#2a2428');
    R(c, 0, 61, AW, 1, '#1a1418');
    R(c, 0, 80, AW, 1, '#6a7078'); R(c, 0, 81, AW, 9, '#b8c0c8'); R(c, 0, 81, AW, 1, '#e4eaf0'); R(c, 0, 90, AW, 1, '#5a6068'); R(c, 0, 91, AW, 17, '#8a929a');
    for (let x = 10; x < AW; x += 40) R(c, x, 92, 1, 16, '#7a828a');
    const pot = (x, w, h, k) => {
      R(c, x, 81 - h, w, h, '#5a6068'); R(c, x + 1, 82 - h, w - 2, h - 1, '#a8b0b8'); R(c, x + 2, 82 - h, 3, h - 2, '#d8e0e8');
      R(c, x - 2, 80 - h, w + 4, 2, '#4a5058'); R(c, x + 1, 78 - h, w - 2, 2, '#e8b060');
      steam(c, x + 4, 76 - h, t + k, 4);
    };
    pot(18, 30, 14, 0); pot(62, 22, 10, 9);
    for (const bx of [108, 122, 136]) { R(c, bx, 70, 10, 10, '#5a6068'); R(c, bx + 1, 71, 8, 8, '#8a929a'); for (let k = 0; k < 3; k++) R(c, bx + 2 + k * 3, 72, 1, 6, '#5a6068'); R(c, bx + 4, 62, 2, 8, '#3a3a44'); }
    R(c, 160, 72, 30, 8, '#e8e0d0'); R(c, 160, 72, 30, 1, '#ffffff'); R(c, 166, 70, 6, 2, '#5ec44a'); R(c, 176, 70, 8, 2, '#ff7eb6');
  },
  park(c, t, me, you) {
    R(c, 0, 0, AW, 46, '#8fd0f0'); R(c, 0, 30, AW, 16, '#a8dcf4'); dither(c, 0, 28, AW, 2, '#a8dcf4');
    cloud(c, ((t * 0.06) % 260) - 40, 6); cloud(c, ((t * 0.04 + 140) % 260) - 40, 15);
    R(c, 0, 44, AW, 14, '#3f8a46');
    for (let i = 0; i < 12; i++) { disc(c, 4 + i * 19, 44, 10 + (i % 3) * 2, '#3f8a46'); disc(c, 1 + i * 19, 41 - (i % 2) * 2, 4, '#5aa85a'); }
    R(c, 0, 56, AW, 52, '#7cc85a');
    for (let i = 0; i < 70; i++) { const x = Math.floor(hash2(i, 3, 1) * AW), y = 58 + Math.floor(hash2(i, 4, 1) * 30); R(c, x, y, 1, 2, '#5aa848'); if (i % 9 === 0) R(c, x + 2, y, 1, 1, i % 2 ? '#ffffff' : '#ffd23f'); }
    R(c, 0, 90, AW, 18, '#e2cf9a'); R(c, 0, 90, AW, 1, '#c8b47e');
    for (let i = 0; i < 14; i++) R(c, Math.floor(hash2(i, 9, 2) * AW), 94 + Math.floor(hash2(i, 8, 2) * 12), 2, 1, '#c8b47e');
    // tree
    R(c, 12, 36, 8, 56, '#7a5232'); R(c, 12, 36, 2, 56, '#9a6a42'); R(c, 19, 36, 1, 56, '#5a3a22');
    disc(c, 16, 26, 20, '#2f7a3a'); disc(c, 12, 22, 14, '#4a9a4a'); disc(c, 8, 18, 6, '#6cc46c');
    // lamp
    R(c, 186, 30, 3, 62, '#3a3a44'); R(c, 182, 24, 11, 6, '#3a3a44'); R(c, 184, 30, 7, 2, '#fff6a8');
    // bench back + posts
    R(c, 54, 40, 3, 50, '#3a3a44'); R(c, 151, 40, 3, 50, '#3a3a44');
    for (const y of [43, 50]) { R(c, 48, y, 112, 5, '#c07a3a'); R(c, 48, y, 112, 1, '#e09a5a'); R(c, 48, y + 4, 112, 1, '#5a3216'); }
    P.seat(c, you, 66, 32); P.seat(c, me, 110, 32);
    R(c, 44, 60, 120, 1, '#5a3216'); R(c, 44, 61, 120, 4, '#d08a4a'); R(c, 44, 61, 120, 1, '#f0aa6a'); R(c, 44, 65, 120, 1, '#5a3216');
    P.legs(c, you, 66, 66); P.legs(c, me, 110, 66);
    R(c, 50, 66, 3, 22, '#3a3a44'); R(c, 155, 66, 3, 22, '#3a3a44');
    // pigeons
    for (const [bx, k] of [[28, 0], [176, 1]]) {
      const peck = Math.floor((t + k * 30) / 20) % 3 === 0 ? 1 : 0;
      R(c, bx, 96, 7, 4, '#8a8a9a'); R(c, bx + 1, 95, 4, 1, '#9a9aaa'); R(c, bx + (k ? -2 : 6), 94 + peck, 3, 3, '#6a6a7a'); R(c, bx + (k ? -3 : 9), 95 + peck, 1, 1, '#e0a82e'); R(c, bx + 2, 100, 1, 1, '#d6304a'); R(c, bx + 4, 100, 1, 1, '#d6304a');
    }
  },
  cafe(c, t, me, you) {
    R(c, 0, 0, AW, 58, '#f2e2c4'); R(c, 0, 58, AW, 14, '#8a5a32'); R(c, 0, 58, AW, 1, '#a87a4a'); R(c, 0, 71, AW, 1, '#5a3418');
    R(c, 60, 6, 88, 44, '#6b4226'); R(c, 62, 8, 84, 40, '#bfe6f6'); R(c, 62, 32, 84, 16, '#d8eef8');
    disc(c, 76, 36, 9, '#6cc46c'); R(c, 75, 40, 2, 8, '#7a5232'); R(c, 100, 24, 30, 24, '#e0d6c4'); for (let i = 0; i < 4; i++) R(c, 104 + i * 7, 28, 3, 4, '#8ac8e8');
    R(c, 103, 8, 2, 40, '#6b4226'); R(c, 62, 26, 84, 2, '#6b4226'); R(c, 58, 50, 92, 3, '#8a5a32');
    for (const lx of [34, 174]) { R(c, lx, 0, 1, 12, '#3a3a44'); R(c, lx - 5, 12, 11, 2, '#2f6b5a'); R(c, lx - 6, 14, 13, 3, '#3f8a72'); R(c, lx - 2, 17, 5, 2, '#fff6a8'); }
    R(c, 8, 22, 30, 28, '#8a5a32'); R(c, 10, 24, 26, 24, '#2f3f36');
    for (let i = 0; i < 4; i++) R(c, 13, 28 + i * 5, 8 + ((i * 7) % 12), 1, '#e8e8e8');
    R(c, 176, 46, 18, 16, '#c0603a'); R(c, 176, 46, 18, 2, '#e08060');
    for (const [dx, dy] of [[0, 0], [8, -6], [14, 2], [4, -10]]) disc(c, 180 + dx, 40 + dy, 6, '#4a9a4a');
    R(c, 0, 72, AW, 36, '#c89a6a');
    for (let y = 72; y < AH; y += 8) for (let x = ((y - 72) / 8) % 2 ? 0 : 8; x < AW; x += 16) R(c, x, y, 8, 8, '#b88a5a');
    P.seat(c, you, 66, 42, 'down', 32); P.seat(c, me, 110, 42, 'down', 32);
    // table with a cloth
    R(c, 44, 72, 120, 1, '#6a6a7a'); R(c, 44, 73, 120, 5, '#fbf8f0'); R(c, 44, 73, 120, 1, '#ffffff');
    R(c, 46, 78, 116, 16, '#f0e4cc'); R(c, 46, 78, 116, 1, '#c8b898'); R(c, 46, 90, 116, 2, '#e8a0b0'); R(c, 46, 93, 116, 1, '#b8a888');
    for (let x = 50; x < 160; x += 8) R(c, x, 82, 2, 2, '#e8d4b0');
    R(c, 60, 94, 4, 12, '#3a3a44'); R(c, 144, 94, 4, 12, '#3a3a44'); R(c, 46, 104, 116, 2, 'rgba(0,0,0,0.15)');
    cup(c, 72, 65, t, '#c08a5a'); cup(c, 126, 65, t + 15, '#7a4a2a');
    R(c, 96, 72, 16, 1, '#8a8a9a'); R(c, 98, 65, 10, 7, '#fff6e0'); R(c, 98, 68, 10, 1, '#f0c870'); R(c, 98, 65, 10, 1, '#ffffff'); R(c, 101, 62, 4, 3, '#e8384f'); R(c, 102, 61, 1, 1, '#5ec44a');
  },
  karaoke(c, t, me, you) {
    R(c, 0, 0, AW, 84, '#2a1a4a');
    for (let i = 0; i < 30; i++) { const x = Math.floor(hash2(i, 1, 7) * AW), y = Math.floor(hash2(i, 2, 7) * 70); const k = (Math.floor(t / 16) + i) % 4; R(c, x, y, 2, 2, ['#ff5db0', '#5fd7ff', '#ffd23f', '#5ee07a'][k]); }
    const blink = Math.floor(t / 30) % 2;
    R(c, 0, 8, AW, 1, blink ? '#ff5db0' : '#c03a88'); R(c, 0, 72, AW, 1, blink ? '#5fd7ff' : '#3a9ac0');
    R(c, 64, 14, 80, 44, '#0a0a12'); R(c, 66, 16, 76, 40, '#20306a'); R(c, 66, 46, 76, 10, '#2a3a8a');
    const prog = (t * 0.6) % 64;
    for (let i = 0; i < 2; i++) { R(c, 74, 26 + i * 10, 60, 4, '#ffffff'); R(c, 74, 26 + i * 10, i === 0 ? prog : Math.max(0, prog - 60), 4, '#ff5db0'); }
    R(c, 100, 58, 8, 4, '#0a0a12');
    R(c, 120, 52, 88, 24, '#c0304a'); R(c, 120, 52, 88, 2, '#e05068'); R(c, 120, 75, 88, 1, '#6a1a2a');
    P.seat(c, me, 150, 42, 'down', 32);
    R(c, 120, 74, 88, 8, '#a02a40'); R(c, 120, 74, 88, 1, '#c84860');
    R(c, 0, 84, AW, 24, '#1e1430'); R(c, 0, 84, AW, 1, '#3a2a5a');
    for (let i = 0; i < 30; i++) R(c, Math.floor(hash2(i, 5, 7) * AW), 86 + Math.floor(hash2(i, 6, 7) * 20), 1, 1, '#3a2a5a');
    // low table in front of the sofa
    R(c, 126, 84, 76, 4, '#5a5a7a'); R(c, 126, 84, 76, 1, '#8a8aaa'); R(c, 130, 88, 3, 14, '#3a3a5a'); R(c, 194, 88, 3, 14, '#3a3a5a');
    glass(c, 140, 71, '#ff9a3c'); glass(c, 184, 71, '#5ee07a');
    // tambourine
    const up = Math.floor(t / 10) % 2;
    disc(c, 186, 58 - up * 3, 5, '#ffd23f'); disc(c, 186, 58 - up * 3, 3, '#f4ead2');
    // the friend sings
    const hop = Math.floor(t / 20) % 2;
    P.stand(c, you, 38, 58 - hop);
    R(c, 61, 72 - hop, 2, 6, '#3a3a44'); R(c, 60, 69 - hop, 4, 3, '#c8ccd4');
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.5 + i * 13) % 40;
      c.globalAlpha = Math.max(0, 1 - ph / 40);
      art(c, 68 + i * 8 + (Math.floor(ph / 6) % 2), 66 - ph, ['.##', '.#.', '##.', '##.'], { '#': i % 2 ? '#ffd23f' : '#ff5db0' });
      c.globalAlpha = 1;
    }
  },
  famires(c, t, me, you) {
    R(c, 0, 0, AW, 30, '#f6efe0');
    R(c, 0, 4, AW, 20, '#5a4a3a'); R(c, 0, 5, AW, 18, '#bfe6f6'); R(c, 0, 16, AW, 7, '#d8eef8');
    for (let x = 0; x < AW; x += 26) R(c, x, 4, 2, 20, '#5a4a3a');
    R(c, 0, 24, AW, 6, '#f6efe0');
    R(c, 20, 30, 168, 40, '#5a1a14'); R(c, 21, 31, 166, 39, '#b8402f'); R(c, 21, 31, 166, 3, '#d6604a');
    for (let x = 32; x < 184; x += 16) for (let y = 38; y < 66; y += 10) R(c, x, y, 2, 2, '#8a2a1f');
    P.seat(c, you, 60, 34, 'down', 32); P.seat(c, me, 116, 34, 'down', 32);
    R(c, 0, 70, AW, 38, '#e0d0b0');
    for (let y = 70; y < AH; y += 10) for (let x = ((y - 70) / 10) % 2 ? 0 : 10; x < AW; x += 20) R(c, x, y, 10, 10, '#d0c098');
    // table: laminate top, thick edge, shadow
    R(c, 28, 65, 152, 1, '#6a5a4a'); R(c, 28, 66, 152, 6, '#ece4d4'); R(c, 28, 66, 152, 1, '#ffffff');
    R(c, 28, 72, 152, 10, '#c8b898'); R(c, 28, 72, 152, 1, '#a89878'); R(c, 28, 81, 152, 1, '#8a7a5a');
    R(c, 34, 82, 140, 8, 'rgba(0,0,0,0.16)'); R(c, 100, 82, 8, 22, '#5a5a66'); R(c, 88, 104, 32, 3, '#5a5a66');
    glass(c, 70, 54, '#5ee07a', '#ffffff'); R(c, 74, 52, 2, 2, '#e8384f');
    glass(c, 130, 54, '#ff9a3c');
    // parfait + call bell + menu stand
    R(c, 98, 48, 12, 1, '#5a6478'); R(c, 99, 49, 10, 11, '#e8f4f8'); R(c, 100, 57, 8, 3, '#7a4a2a'); R(c, 100, 53, 8, 4, '#fff6e0'); R(c, 100, 50, 8, 3, '#ff9ab8'); R(c, 103, 46, 3, 3, '#e8384f'); R(c, 102, 60, 4, 3, '#5a6478'); R(c, 99, 63, 10, 2, '#5a6478');
    R(c, 156, 60, 12, 6, '#ffd23f'); R(c, 156, 60, 12, 1, '#fff6a8'); R(c, 160, 58, 4, 2, '#e0a82e');
    R(c, 40, 56, 10, 10, '#3a6fd8'); R(c, 41, 57, 8, 8, '#ffffff'); R(c, 42, 59, 6, 1, '#d6304a'); R(c, 42, 62, 6, 1, '#9aa3c7');
  },
  sento(c, t, me, you) {
    R(c, 0, 0, AW, 44, '#f2ead8'); R(c, 0, 44, AW, 40, '#d8b080');
    for (let x = 0; x < AW; x += 12) R(c, x, 44, 1, 40, '#c09868');
    R(c, 0, 44, AW, 1, '#8a6a42');
    // noren with ゆ
    R(c, 74, 2, 60, 2, '#5a3418');
    R(c, 76, 4, 56, 32, '#2f4f9a'); R(c, 103, 4, 2, 32, '#24407e'); R(c, 76, 4, 56, 2, '#4a6ab8');
    text(c, 'ゆ', 104, 12, { size: 16, align: 'center', color: '#ffffff', shadow: null });
    // fridge with milk
    R(c, 6, 10, 32, 64, '#5a6478'); R(c, 7, 11, 30, 62, '#e8eef2'); R(c, 10, 16, 24, 40, '#a8d8f0');
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const bx = 12 + k * 6, by = 20 + r * 12; R(c, bx, by, 4, 8, '#ffffff'); R(c, bx, by, 4, 2, r === 1 ? '#e07a1f' : '#3a6fd8'); }
    R(c, 32, 30, 2, 8, '#8a8a9a');
    // electric fan
    R(c, 184, 52, 3, 30, '#3a3a44'); R(c, 178, 82, 15, 3, '#3a3a44');
    disc(c, 185, 44, 9, '#d8e4f0'); disc(c, 185, 44, 8, '#ffffff');
    const ang = Math.floor(t / 4) % 2;
    if (ang) { R(c, 178, 43, 15, 3, '#5fa0e0'); R(c, 184, 37, 3, 15, '#5fa0e0'); } else { for (let i = -5; i <= 5; i++) { R(c, 185 + i, 44 + i, 2, 2, '#5fa0e0'); R(c, 185 + i, 44 - i, 2, 2, '#5fa0e0'); } }
    disc(c, 185, 44, 2, '#3a3a44');
    R(c, 0, 84, AW, 24, '#c89a6a'); for (let x = 0; x < AW; x += 24) R(c, x, 84, 1, 24, '#a87a4a'); R(c, 0, 84, AW, 1, '#8a6a42');
    P.stand(c, you, 66, 48); P.stand(c, me, 110, 48);
    // milk bottles (drinking)
    const sip = Math.floor(t / 40) % 2;
    for (const bx of [88, 132]) { R(c, bx, 60 - sip * 2, 5, 10, '#ffffff'); R(c, bx, 60 - sip * 2, 5, 2, '#3a6fd8'); R(c, bx - 1, 61 - sip * 2, 1, 8, '#9aa3c7'); }
    for (let i = 0; i < 4; i++) { const k = (t + i * 25) % 100; if (k < 30) { const sx = 60 + i * 26, sy = 40 + (i % 2) * 10; R(c, sx, sy - 2, 1, 5, '#ffffff'); R(c, sx - 2, sy, 5, 1, '#ffffff'); } }
  },
  _default(c, t, me, you) {
    const bands = ['#3a3a8a', '#6a5ab0', '#c86aa0', '#ff8a6a', '#ffb36b'];
    bands.forEach((col, i) => R(c, 0, i * 14, AW, 14, col));
    for (let i = 1; i < bands.length; i++) dither(c, 0, i * 14 - 1, AW, 2, bands[i], i);
    disc(c, 104, 70, 16, '#ffe28a');
    let x = 0, i = 0;
    while (x < AW) {
      const w = 14 + Math.floor(hash2(i, 1, 5) * 18), h = 20 + Math.floor(hash2(i, 2, 5) * 36);
      R(c, x, 82 - h, w, h, '#2a2450');
      for (let yy = 86 - h; yy < 78; yy += 6) for (let xx = x + 3; xx < x + w - 3; xx += 5) if (hash2(xx, yy, 3) > 0.55) R(c, xx, yy, 2, 3, '#ffe08a');
      x += w + 1; i++;
    }
    R(c, 0, 82, AW, 26, '#8a8aa0'); R(c, 0, 82, AW, 1, '#5a5a70');
    for (let xx = 0; xx < AW; xx += 20) R(c, xx, 83, 1, 25, '#7a7a90');
    R(c, 30, 40, 2, 44, '#3a3a44'); R(c, 26, 36, 10, 5, '#3a3a44'); R(c, 28, 41, 6, 2, '#fff6a8');
    P.stand(c, you, 70, 46); P.stand(c, me, 106, 46);
  },
};

class HangoutScene {
  constructor(g, id, spotId) {
    this.g = g;
    this.id = id;
    this.def = PEOPLE[id];
    this.spot = HANGOUTS[spotId];
    this.spotId = spotId;
    this.hd = true;
    this.opaque = true;
    this.hidesHud = true;
    this.t = 0;
    this.mode = 'intro';
    this.mt = 0;
    this.wait = null;
    this.res = null;
    [this.cv, this.cx] = makeCanvas(AW, AH);
    this.hearts = [];
  }
  // Resolves on A (after `min` frames) or after `max` frames.
  waitFor(mode, min, max = Infinity) {
    this.mode = mode;
    this.mt = 0;
    return new Promise((resolve) => { this.wait = { resolve, min, max }; });
  }
  update(g) {
    this.t++;
    this.mt++;
    if (this.mode === 'result' && this.res) {
      const r = this.res;
      r.k = Math.min(1, r.k + 1 / 50);
      const shown = r.from + (r.to - r.from) * ease(r.k);
      if (!r.leveled && heartIndex(Math.round(shown)) > r.lv0) { r.leveled = true; r.flash = 90; audio.sfx('fanfare'); }
      if (r.flash) r.flash--;
      if (this.t % 9 === 0 && r.k < 1) this.hearts.push({ x: FX + 70 + Math.random() * 280, y: FY + 150, t: 0 });
    }
    for (const h of this.hearts) h.t++;
    this.hearts = this.hearts.filter((h) => h.t < 60);
    const w = this.wait;
    if (!w) return;
    if (g.auto || this.mt >= w.max || (this.mt >= w.min && (g.input.pressed('a') || g.input.pressed('b')))) {
      if (!g.auto && this.mt >= w.min && this.mt < w.max) audio.sfx('cursor');
      this.wait = null;
      w.resolve();
    }
  }
  draw(ctx, g) {
    const c = this.cx;
    const bg = cached('hang_bg', SW, SH, (b) => {
      R(b, 0, 0, SW, SH, '#141830');
      for (let y = 0; y < SH; y += 12) for (let x = (y / 12) % 2 ? 6 : 0; x < SW; x += 12) R(b, x, y, 2, 2, '#1e2448');
    });
    ctx.drawImage(bg, 0, 0);
    c.clearRect(0, 0, AW, AH);
    const me = g.state.look || {}, you = this.def.look || {};
    try { (ART[this.spotId] || ART._default)(c, this.t, me, you); } catch (e) { console.error(e); ART._default(c, this.t, me, you); }
    // frame
    box(ctx, FX - 10, FY - 10, FW + 20, FH + 20, 4, '#7a5432', '#1e140c', { hi: '#a8804e', lo: '#4a3018' });
    R(ctx, FX - 3, FY - 3, FW + 6, FH + 6, '#e8d8b0');
    R(ctx, FX - 2, FY - 2, FW + 4, FH + 4, '#1e140c');
    ctx.drawImage(this.cv, 0, 0, AW, AH, FX, FY, FW, FH);
    const name = this.spot.name;
    const pw = measure(ctx, name, 14) + 24;
    box(ctx, FX + 12, FY - 18, pw, 24, 3, '#f4ead2', '#3a2a1a', { lo: '#d8c8a4' });
    T(ctx, name, FX + 12 + pw / 2, FY - 13, 14, '#3a2a1a', 'center');
    // floating hearts
    for (const h of this.hearts) { ctx.globalAlpha = Math.max(0, 1 - h.t / 60); drawHeart(ctx, h.x + Math.sin(h.t / 6) * 4, h.y - h.t * 1.2, true, 2); ctx.globalAlpha = 1; }
    if (this.mode === 'intro') {
      const a = Math.min(1, this.mt / 15);
      ctx.globalAlpha = a;
      // 「ジローと ラーメン屋へ」 / 「ジローと 公園へおさんぽ」 (spot.go); a name that is already
      // an outing (公園で散歩) gets no へ
      const s = `${this.def.short || this.def.name}と ${this.spot.go || (/で./.test(name) ? name : name + 'へ')}`;
      panel(ctx, 120, SH - 92, SW - 240, 56, { bg: '#1d2a5e' });
      text(ctx, s, SW / 2, SH - 74, { size: 20, align: 'center', color: '#fff' });
      ctx.globalAlpha = 1;
    } else if (this.mode === 'result' && this.res) this.drawResult(ctx, g);
  }
  drawResult(ctx, g) {
    const r = this.res;
    const x = 12, y = SH - 104, w = SW - 24, h = 96;
    panel(ctx, x, y, w, h);
    // need / money chips
    let cx = x + 16;
    for (const [label, val, good] of r.chips) {
      const s = `${label} ${val}`;
      const cw = measure(ctx, s, 14) + 16;
      rrect(ctx, cx, y + 10, cw, 22, 5, good === true ? '#1e5a34' : good === false ? '#6a1e2a' : '#2a3a7a');
      text(ctx, s, cx + 8, y + 13, { size: 14, color: good === true ? '#9af0b0' : good === false ? '#ffb0b8' : '#ffffff', shadow: null });
      cx += cw + 6;
    }
    // affinity
    const shown = r.from + (r.to - r.from) * ease(r.k);
    const lv = heartIndex(Math.round(shown));
    drawFaceHD(ctx, this.def.look || {}, x + 16, y + 42, 1);
    text(ctx, this.def.name, x + 56, y + 46, { size: 16, color: COLORS.accent });
    const nx = x + 64 + measure(ctx, this.def.name, 16);
    drawHearts(ctx, nx, y + 46, lv, 2, 'dark');
    text(ctx, HEARTS[lv][1], nx + 88, y + 46, { size: 14, color: COLORS.pink });
    const bx = nx + 88 + measure(ctx, HEARTS[lv][1], 14) + 12, bw = Math.max(60, x + w - 140 - bx);
    R(ctx, bx, y + 50, bw, 8, '#000');
    R(ctx, bx + 1, y + 51, bw - 2, 6, '#3e3858');
    R(ctx, bx + 1, y + 51, Math.round((bw - 2) * levelProgress(shown)), 6, COLORS.pink);
    const d = r.to - r.from;
    text(ctx, d > 0 ? `♥+${d}` : d < 0 ? `♥${d}` : '♥±0', x + w - 16, y + 44, { size: 16, align: 'right', color: COLORS.pink });
    if (r.k >= 1 && this.mt > 30) text(ctx, 'Aで おわる', x + w - 16, y + h - 22, { size: 12, align: 'right', color: COLORS.dim });
    if (r.scruffy) text(ctx, '（身だしなみが乱れていて、少し印象が下がった…）', x + 16, y + h - 22, { size: 12, color: COLORS.dim });
    if (r.flash) {
      const a = Math.min(1, r.flash / 20);
      ctx.globalAlpha = a;
      const s = `「${HEARTS[heartIndex(r.to)][1]}」になった！`;
      const bw2 = measure(ctx, s, 24) + 56;
      panel(ctx, (SW - bw2) / 2, FY + 70, bw2, 56, { bg: '#5a1a3a', edge: '#ffc2d6' });
      text(ctx, s, SW / 2, FY + 85, { size: 24, align: 'center', color: '#fff' });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + this.t / 20;
        const rr = 80 + (90 - r.flash) * 1.2;
        drawHeart(ctx, SW / 2 + Math.cos(ang) * rr - 9, FY + 98 + Math.sin(ang) * rr * 0.45 - 8, true, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}

// Spend time together at a hangout spot (g.hangout). Returns false if not possible.
export async function hangoutUI(g, id, spotId) {
  const def = PEOPLE[id], spot = HANGOUTS[spotId];
  if (!def || !spot) { console.error('hangout: unknown', id, spotId); return false; }
  const p = g.meet(id);
  const st = g.state;
  if (st.money < spot.price) { await g.say(`お金が足りない…。（${spot.name}：${fmtMoney(spot.price)}）`); return false; }
  if (st.stamina < spot.stamina) { await g.say('体力が足りない…。今日はやめておこう。'); return false; }
  const L = st.life;
  const before = { stress: L.stress, hunger: L.hunger, clean: L.clean, aff: p.aff, stamina: st.stamina };
  st.money -= spot.price;
  st.stamina -= spot.stamina;
  p.hangDay = st.day;
  await g.fadeOut(12);
  const sc = new HangoutScene(g, id, spotId);
  g.push(sc);
  await g.fadeIn(12);
  try {
    await sc.waitFor('intro', 12, 70);
    sc.mode = 'lines';
    let own = def.hangout && (def.hangout[spotId] || def.hangout.default);
    if (typeof own === 'function') own = own(g, def, spotId);
    if (own && own.length) await sayLines(g, own, def);
    else await sayLines(g, [...(spot.lines || []).map((l) => (typeof l === 'string' && !/^[（(]/.test(l) ? { text: l, narr: true } : l)), ...[].concat(lineFor(def, 'hangBye', g))], def);
    // effects
    g.relax({ stress: spot.stress });
    hangoutMeal(g, spot); // like any food: nothing when already full
    if (spot.clean) g.addNeed('clean', spot.clean);
    const scruffy = L.clean < 30;
    g.addAff(id, spot.aff, true);
    const chips = [];
    if (spot.price) chips.push(['お金', `-${fmtMoney(spot.price)}`, null]);
    const dSt = st.stamina - before.stamina; // the outing's cost, less what a meal gave back
    if (dSt) chips.push(['体力', `${dSt > 0 ? '+' : ''}${dSt}`, dSt > 0]);
    const dS = L.stress - before.stress, dH = L.hunger - before.hunger, dC = L.clean - before.clean;
    if (dS) chips.push(['ストレス', `${dS > 0 ? '+' : ''}${dS}`, dS < 0]);
    if (dH) chips.push(['満腹', `${dH > 0 ? '+' : ''}${dH}`, dH > 0]);
    if (dC) chips.push(['身だしなみ', `${dC > 0 ? '+' : ''}${dC}`, dC > 0]);
    sc.res = { from: before.aff, to: p.aff, lv0: heartIndex(before.aff), k: 0, chips, flash: 0, scruffy };
    audio.sfx('good');
    await sc.waitFor('result', 40);
  } finally {
    await g.fadeOut(10);
    g.pop(sc);
    await g.fadeIn(10);
  }
  return true;
}

// Install the rich people UI (life.js keeps the plain fallbacks).
PEOPLE_UI.talk = talkPersonUI;
PEOPLE_UI.hangout = hangoutUI;
