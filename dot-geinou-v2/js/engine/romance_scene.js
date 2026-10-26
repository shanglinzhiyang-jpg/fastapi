// 恋愛・結婚・家庭 (R12-L1) — the HD scene for dates, meetings, ceremonies and family moments (the art is in romance_art*.js).
//
//   await playScene(g, { art: 'cafe', title: '喫茶店', you: look, extra: {…} }, async (sc) => {
//     await sc.intro('{name}と 喫茶店でおしゃべり');   // a title card
//     await sayAs(g, rec, ['…']);                       // the person speaks (pages starting with （ are narration)
//     sc.burst();                                      // hearts
//     sc.setArt('yakei');                              // another picture
//     await sc.result({ chips: [['お金', '-¥1,200']], note: '…', name, look, hearts: 4 });
//   });
// Under g.auto (tests, bots) every wait resolves at once. The scene hides the HUD and covers the map; the dialogue boxes of
// g.say / g.ask are drawn over it (the picture is 640x224 at the top, the boxes use the rest).

import { SW, SH, makeCanvas, clamp } from './util.js';
import { text, panel, measure, COLORS } from './draw.js';
import { audio, registerSong } from './audio.js';
import { drawFaceHD, LOOKS } from './sprites.js';
import { ALL, KID_SPOTS } from './romance_art2.js';
import { AW, AH, SP, R, heart, baby } from './romance_art.js';

const FY = 6, K = 2;
const ease = (k) => k * k * (3 - 2 * k);

// ---------------------------------------------------------------- music (original chiptune)
registerSong('rom_date', {
  bpm: 96, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'E5 . G5 . A5 - G5 . | F5 . A5 . G5 - E5 . | D5 . F5 . E5 - C5 . | D5 - G4 - C5 - - . | E5 . G5 . C6 - B5 . | A5 . F5 . G5 - E5 . | F5 . E5 . D5 - B4 . | C5 - - - . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . E3 . G3 . | F3 . C4 . A3 . C4 . | G2 . D3 . B2 . D3 . | G2 . D3 . G2 . . . | C3 . G3 . E3 . G3 . | A2 . E3 . C3 . E3 . | F2 . C3 . A2 . C3 . | C3 . G3 . C3 . . .' },
    { wave: 'square', vol: 0.016, notes: 'C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 F4 C4 A3 C4 F4 C4 | B3 D4 G4 D4 B3 D4 G4 D4 | C4 E4 G4 E4 C4 . . . | C4 E4 G4 E4 C4 E4 G4 E4 | A3 C4 E4 C4 A3 C4 E4 C4 | F3 A3 C4 A3 F3 A3 C4 A3 | C4 E4 G4 E4 C4 . . .' },
  ],
});
registerSong('rom_night', {
  bpm: 72, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'A4 - C5 - E5 - - . | D5 - C5 - A4 - - . | F4 - A4 - C5 - - . | E5 - D5 - C5 - - . | A4 - C5 - E5 - G5 - | F5 - E5 - D5 - - . | C5 - D5 - E5 - C5 - | A4 - - - . . . .' },
    { wave: 'square', vol: 0.014, notes: 'A3 E4 A4 E4 A3 E4 A4 E4 | D3 A3 D4 A3 D3 A3 D4 A3 | F3 C4 F4 C4 F3 C4 F4 C4 | C3 G3 C4 G3 C3 G3 C4 G3 | A3 E4 A4 E4 A3 E4 A4 E4 | D3 A3 D4 A3 D3 A3 D4 A3 | C3 G3 C4 G3 C3 G3 C4 G3 | A3 E4 A4 E4 A3 . . .' },
    { wave: 'triangle', vol: 0.1, notes: 'A2 - - - E3 - - - | D3 - - - A2 - - - | F2 - - - C3 - - - | C3 - - - G2 - - - | A2 - - - E3 - - - | D3 - - - A2 - - - | C3 - - - G2 - - - | A2 - - - . . . .' },
  ],
});
registerSong('rom_wedding', {
  bpm: 108, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.045, notes: 'C5 . E5 . G5 . E5 . | F5 . A5 . G5 - - . | E5 . G5 . C6 . B5 . | A5 . G5 . F5 E5 D5 . | E5 . G5 . A5 . G5 . | F5 . D5 . G5 - - . | C6 . B5 . A5 . G5 . | F5 E5 D5 . C5 - - .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . C4 . G3 . | F3 . C4 . G3 . D4 . | C3 . G3 . E3 . G3 . | F3 . C4 . G2 . B2 . | C3 . G3 . F3 . C4 . | D3 . A3 . G2 . D3 . | A2 . E3 . E3 . G3 . | F3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.05, notes: 'k . . . s . . . | k . . . s . h h' },
  ],
});
registerSong('rom_lullaby', {
  bpm: 66, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'E5 - - D5 - - | C5 - - D5 - - | E5 - - E5 - - | D5 - - - . . | D5 - - C5 - - | B4 - - C5 - - | D5 - - D5 - - | C5 - - - . .' },
    { wave: 'square', vol: 0.013, notes: 'C4 G4 C5 G4 C4 G4 | G3 D4 G4 D4 G3 D4 | C4 G4 C5 G4 C4 G4 | G3 D4 G4 D4 G3 . | G3 D4 G4 D4 G3 D4 | G3 D4 G4 D4 G3 D4 | G3 D4 G4 D4 G3 D4 | C4 G4 C5 G4 C4 .' },
  ],
});
let prevBgm = null;
export function bgmOn(name) { prevBgm = audio.current ? audio.current.name : audio.wanted || null; audio.bgm(name); }
export function bgmBack() { if (prevBgm) audio.bgm(prevBgm); prevBgm = null; }

// ---------------------------------------------------------------- the scene
export class RomScene {
  constructor(g, o = {}) {
    this.g = g;
    this.hd = true;
    this.opaque = true;
    this.hidesHud = true;
    this.t = 0;
    this.mt = 0;
    this.art = o.art || 'cafe';
    this.title = o.title || '';
    this.hearts = [];
    this.wait = null;
    this.res = null;
    this.card = null;
    this.flash = 0;
    let phase = o.phase;
    if (!phase) {
      try { const c = typeof g.clock === 'function' ? g.clock() : null; phase = c ? (['evening'].includes(c.phase) ? 'dusk' : ['night', 'late'].includes(c.phase) ? 'night' : 'day') : 'day'; } catch (e) { phase = 'day'; }
    }
    let wx = 'sunny';
    try { const w = typeof g.weather === 'function' ? g.weather() : null; if (w && w.kind) wx = w.kind; } catch (e) { wx = 'sunny'; }
    this.X = { me: o.me || g.state.look || LOOKS.player, you: o.you || {}, kids: o.kids || null, phase, wx, extra: o.extra || {}, hearts: !!o.hearts, banner: o.banner };
    [this.cv, this.cx] = makeCanvas(AW, AH);
  }
  setArt(id, o = {}) { this.art = id; if (o.title != null) this.title = o.title; if (o.phase) this.X.phase = o.phase; if (o.extra) this.X.extra = { ...this.X.extra, ...o.extra }; if (o.you) this.X.you = o.you; if (o.hearts != null) this.X.hearts = o.hearts; if (o.banner !== undefined) this.X.banner = o.banner; if (o.kids !== undefined) this.X.kids = o.kids; }
  burst(n = 6) { for (let i = 0; i < n; i++) this.hearts.push({ x: 150 + Math.random() * 340, y: 190 + Math.random() * 20, t: -i * 4 }); }
  waitFor(min, max = Infinity) {
    this.mt = 0;
    return new Promise((resolve) => { this.wait = { resolve, min, max }; });
  }
  async intro(textStr, frames = 70) {
    this.card = textStr;
    await this.waitFor(14, frames);
    this.card = null;
  }
  // a result card: chips [[label, value, good]], note, name, look, hearts (1..5)
  async result(r) {
    this.res = { ...r, k: 0 };
    audio.sfx('good');
    await this.waitFor(40);
    this.res = null;
  }
  update(g) {
    this.t++;
    this.mt++;
    if (this.res && this.res.k < 1) this.res.k = Math.min(1, this.res.k + 1 / 40);
    if (this.t % 10 === 0 && this.res && this.res.k < 1) this.hearts.push({ x: 120 + Math.random() * 400, y: 200, t: 0 });
    for (const h of this.hearts) h.t++;
    this.hearts = this.hearts.filter((h) => h.t < 70);
    const w = this.wait;
    if (!w) return;
    if (g.auto || this.mt >= w.max || (this.mt >= w.min && (g.input.pressed('a') || g.input.pressed('b')))) {
      if (!g.auto && this.mt >= w.min && this.mt < w.max) audio.sfx('cursor');
      this.wait = null;
      w.resolve();
    }
  }
  draw(ctx) {
    R(ctx, 0, 0, SW, SH, '#0e0c18');
    const c = this.cx;
    c.clearRect(0, 0, AW, AH);
    const X = this.X;
    const painter = ALL[this.art] || ALL.cafe;
    try { painter(c, this.t, X); } catch (e) { console.error('[romance art]', this.art, e); }
    // children join the picture
    if (X.kids && X.kids.length && KID_SPOTS[this.art]) {
      X.kids.slice(0, 2).forEach((kd, i) => { const p = KID_SPOTS[this.art][i]; if (p) { if (kd.baby) baby(c, p[0], p[1] + 12); else SP.kid(c, kd.look, p[0], p[1], 'down', kd.k || 0.62); } });
    }
    // weather over the open-air pictures
    if (['rain', 'heavyrain', 'storm', 'typhoon'].includes(X.wx) && !['cafe', 'eiga', 'live', 'gohan', 'izakaya', 'karaoke', 'suizokukan', 'home', 'omiai', 'goukon', 'party', 'yakusho', 'shinzen', 'chapel', 'hiroen', 'sanin', 'yoru'].includes(this.art)) {
      c.globalAlpha = 0.5; c.fillStyle = '#c8d8f0';
      for (let i = 0; i < 60; i++) { const x = (i * 37 + this.t * 3) % (AW + 20) - 10, y = (i * 53 + this.t * 6) % AH; c.fillRect(x, y, 1, 4); }
      c.globalAlpha = 1;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.cv, 0, 0, AW, AH, 0, FY, AW * K, AH * K);
    // a soft frame
    R(ctx, 0, FY - 1, SW, 1, '#000'); R(ctx, 0, FY + AH * K, SW, 2, '#000');
    const g2 = ctx.createLinearGradient(0, FY, 0, FY + 26); g2.addColorStop(0, 'rgba(0,0,0,0.35)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, FY, SW, 26);
    if (this.title) {
      const pw = measure(ctx, this.title, 14) + 24;
      panel(ctx, 12, FY + 8, pw, 26, { bg: '#2a2038' });
      text(ctx, this.title, 12 + pw / 2, FY + 13, { size: 14, align: 'center', color: '#ffe8f0' });
    }
    // hearts floating
    for (const h of this.hearts) {
      if (h.t < 0) continue;
      ctx.globalAlpha = Math.max(0, 1 - h.t / 70);
      heart(ctx, h.x + Math.sin(h.t / 6) * 5, h.y - h.t * 1.5, '#ff7eb6', 3);
      ctx.globalAlpha = 1;
    }
    if (this.card) {
      const a = Math.min(1, this.mt / 14);
      ctx.globalAlpha = a;
      const s = this.g.fmt(this.card);
      const w = Math.min(SW - 80, measure(ctx, s, 20) + 56);
      panel(ctx, (SW - w) / 2, SH - 104, w, 56, { bg: '#2a1e48' });
      text(ctx, s, SW / 2, SH - 88, { size: 20, align: 'center', color: '#fff' });
      ctx.globalAlpha = 1;
    }
    if (this.res) this.drawResult(ctx);
    // the flash of a happy moment
    if (this.flash > 0) { ctx.globalAlpha = this.flash / 20; R(ctx, 0, 0, SW, SH, '#fff'); ctx.globalAlpha = 1; this.flash--; }
  }
  drawResult(ctx) {
    const r = this.res;
    const x = 12, y = SH - 104, w = SW - 24, h = 96;
    panel(ctx, x, y, w, h);
    let cx = x + 16;
    for (const [label, val, good] of r.chips || []) {
      const s = `${label} ${val}`;
      const cw = measure(ctx, s, 14) + 16;
      ctx.fillStyle = good === true ? '#1e5a34' : good === false ? '#6a1e2a' : '#2a3a7a';
      ctx.fillRect(cx, y + 10, cw, 22);
      text(ctx, s, cx + 8, y + 13, { size: 14, color: good === true ? '#9af0b0' : good === false ? '#ffb0b8' : '#ffffff', shadow: null });
      cx += cw + 6;
    }
    if (r.look) drawFaceHD(ctx, r.look, x + 16, y + 42, 1);
    if (r.name) text(ctx, r.name, x + 56, y + 46, { size: 16, color: COLORS.accent });
    const n = clamp(r.hearts || 0, 0, 5);
    const nx = x + 70 + measure(ctx, r.name || '', 16);
    for (let i = 0; i < 5; i++) { ctx.globalAlpha = i < n ? 1 : 0.25; heart(ctx, nx + i * 24, y + 46, i < n ? '#ff5d8f' : '#8a8aa8', 3); ctx.globalAlpha = 1; }
    if (r.note) text(ctx, r.note, x + 16, y + h - 26, { size: 14, color: '#ffe0ec' });
    if (r.k >= 1 && this.mt > 30) text(ctx, 'Aで おわる', x + w - 16, y + h - 22, { size: 12, align: 'right', color: COLORS.dim });
  }
}

// Run fn(sc) inside the scene (fade in / out around it; the music changes when `bgm` is given).
export async function playScene(g, o, fn) {
  await g.fadeOut(12);
  if (o.bgm) bgmOn(o.bgm);
  const sc = new RomScene(g, o);
  g.push(sc);
  await g.fadeIn(12);
  try {
    return await fn(sc);
  } finally {
    await g.fadeOut(10);
    g.pop(sc);
    if (o.bgm) bgmBack();
    await g.fadeIn(10);
  }
}

// ---------------------------------------------------------------- dialogue helpers
// The person speaks (pages that start with （ are narration).
export async function sayAs(g, who, pages) {
  let group = [], narr = false;
  const opt = who ? { name: who.name, look: who.look } : {};
  for (const s of [].concat(pages).filter((x) => x != null && x !== '')) {
    const isN = /^[（(]/.test(s);
    if (group.length && isN !== narr) { await g.say(group, narr ? {} : opt); group = []; }
    narr = isN;
    group.push(s);
  }
  if (group.length) await g.say(group, narr ? {} : opt);
}
export const askAs = (g, who, textStr, choices, cancel) => g.ask(textStr, choices, { ...(who ? { name: who.name, look: who.look } : {}), cancel: cancel === undefined ? choices.length - 1 : cancel });
