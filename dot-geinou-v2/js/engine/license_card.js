// 運転免許証 — the card art and the 交付 scene (owner: R8-L1).
//
//   drawLicenseCard(ctx, x, y, card, look, { scale, t })    card = g.licenseCard(); 320x200 units × scale
//   showLicenseCard(g, { title, fanfare })                   a full-screen HD scene: the card slides in (A / tap closes)
//
// The card follows the real one: 氏名・生年月日・住所・交付・有効期限（ブルー／ゴールドの帯）・免許の条件等・免許証の番号・
// 区分・公安委員会・顔写真・種類欄（普通 / 二輪 / 原付 / 二種…）. All names and numbers are fictional.

import { text } from './draw.js';
import { drawFaceHD, LOOKS } from './sprites.js';
import { audio } from './audio.js';
import { bindTap } from './quiz_studio.js';

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const SW = 640, SH = 360;
const THEME = {
  blue: { bg: '#d6e8f4', bg2: '#bcd8ec', ink: '#1a2a3a', band: '#2f6fd0', bandInk: '#ffffff', line: '#8fb4d0', stamp: '#c0392b' },
  gold: { bg: '#f4e6b4', bg2: '#ead493', ink: '#3a2a10', band: '#d4a017', bandInk: '#3a2a10', line: '#c8b068', stamp: '#c0392b' },
};

export function drawLicenseCard(ctx, x0, y0, card, look, opt = {}) {
  if (!card) return;
  const th = THEME[card.color] || THEME.blue;
  const s = opt.scale || 1;
  const t = opt.t || 0;
  ctx.save();
  ctx.translate(Math.round(x0), Math.round(y0));
  ctx.scale(s, s);
  const T = (str, x, y, size, o = {}) => text(ctx, str, x, y, { size, color: th.ink, shadow: null, ...o });
  // body + rounded corners (cut by hand), a guilloche pattern
  R(ctx, 4, 0, 312, 200, th.bg); R(ctx, 0, 4, 320, 192, th.bg); R(ctx, 2, 2, 316, 196, th.bg);
  ctx.strokeStyle = th.line; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(160, 100, 40 + i * 18, 30 + i * 11, 0, 0, Math.PI * 2); ctx.globalAlpha = 0.28; ctx.stroke(); }
  ctx.globalAlpha = 1;
  R(ctx, 0, 0, 320, 3, th.bg2); R(ctx, 0, 197, 320, 3, th.bg2);
  // top line: 氏名 / 生年月日
  T('氏名', 12, 9, 8, { color: '#5a6a7a' });
  T(card.name, 36, 7, 17, { color: th.ink });
  T(`${card.birth}生`, 12, 30, 12);
  T(card.address, 12, 48, 10);
  // 交付 + band
  T('交付', 12, 68, 8, { color: '#5a6a7a' });
  T(card.issued, 36, 66, 11);
  R(ctx, 12, 86, 200, 20, th.band);
  T(`${card.expires}まで有効`, 112, 90, 11, { align: 'center', color: th.bandInk });
  T(card.kind === 2 ? '二種' : '', 150, 108, 9, { color: th.stamp });
  // 免許の条件等 / 番号
  T('条件等', 12, 122, 8, { color: '#5a6a7a' });
  T(card.conditions.length ? card.conditions.join('　') : '', 46, 120, 11);
  T('番号', 12, 140, 8, { color: '#5a6a7a' });
  T(card.number, 40, 138, 11);
  // 種類欄
  const order = ['gentsuki', 'nirin', 'futsu', 'junchu', 'futsu2'];
  const lab = { gentsuki: '原', nirin: '二輪', futsu: '普通', junchu: '準中', futsu2: '二種' };
  T('種類', 12, 160, 8, { color: '#5a6a7a' });
  order.forEach((id, i) => {
    const on = card.classes.includes(id);
    R(ctx, 40 + i * 34, 156, 32, 18, on ? th.band : th.bg2);
    T(lab[id], 40 + i * 34 + 16, 159, 10, { align: 'center', color: on ? th.bandInk : '#8a9aa8' });
  });
  T(card.commission, 12, 182, 9, { color: '#4a5a6a' });
  // 顔写真
  R(ctx, 226, 24, 82, 100, '#5a8fd0'); R(ctx, 226, 24, 82, 100, '#6aa0e0');
  R(ctx, 226, 24, 82, 3, '#8abaf0');
  ctx.save(); ctx.beginPath(); ctx.rect(226, 24, 82, 100); ctx.clip();
  try { drawFaceHD(ctx, look || LOOKS.player, 226 - 4, 36, 2.8); } catch (e) { /* no sprite */ }
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(226.5, 24.5, 81, 99);
  // the seal + IC mark
  ctx.strokeStyle = th.stamp; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(276, 160, 18, 0, Math.PI * 2); ctx.stroke();
  T('公安', 276, 147, 9, { align: 'center', color: th.stamp });
  T('委員会', 276, 158, 9, { align: 'center', color: th.stamp });
  R(ctx, 290, 134, 22, 14, '#c8b878'); R(ctx, 293, 137, 16, 8, '#a89858');
  // hologram shimmer
  const hx = 212 + ((t * 0.6) % 120) - 20;
  ctx.globalAlpha = 0.16; R(ctx, hx, 4, 14, 192, '#ffffff'); ctx.globalAlpha = 1;
  ctx.strokeStyle = '#7a8a9a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 318, 198);
  ctx.restore();
}

// ---------------------------------------------------------------- the full-screen card
class CardScene {
  constructor(g, opts, resolve) {
    this.g = g; this.opts = opts; this.resolve = resolve;
    this.opaque = true; this.hd = true; this.t = 0; this.card = g.licenseCard();
    this.look = (g.state && g.state.look) || LOOKS.player;
    this.quizTap = true; this.tapAt = null;
    bindTap(g);
    if (opts.fanfare) audio.sfx('fanfare');
  }
  update(g) {
    this.t++;
    const tap = this.tapAt; this.tapAt = null;
    if (g.auto || (this.t > 30 && (g.input.pressed('a') || g.input.pressed('b') || tap))) { g.pop(this); this.resolve(); }
  }
  draw(ctx) {
    const th = THEME[(this.card && this.card.color) || 'blue'];
    for (let i = 0; i < 18; i++) R(ctx, 0, i * 20, SW, 20, i % 2 ? '#1c2a44' : '#1f2e4a');
    const k = Math.min(1, this.t / 24);
    const e = 1 - Math.pow(1 - k, 3);
    text(ctx, this.opts.title || '運転免許証', SW / 2, 20, { size: 22, align: 'center', color: '#ffe27a' });
    const sc = 1.35;
    drawLicenseCard(ctx, SW / 2 - 160 * sc, 52 + (1 - e) * 220, this.card, this.look, { scale: sc, t: this.t });
    if (this.card) {
      const cls = this.card.classNames.join('・');
      text(ctx, `${cls}　${this.card.colorName}`, SW / 2, 336 - 0, { size: 14, align: 'center', color: th.band === '#2f6fd0' ? '#9cc8ff' : '#ffe27a' });
    }
    if (this.t > 30 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aで閉じる', SW - 16, 338, { size: 12, align: 'right', color: '#9cf0ff' });
  }
}
export function showLicenseCard(g, opts = {}) {
  return new Promise((resolve) => g.push(new CardScene(g, opts, resolve)));
}
