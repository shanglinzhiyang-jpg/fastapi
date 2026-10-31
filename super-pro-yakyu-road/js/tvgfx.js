// スーパープロ野球ロード — the broadcast graphics package: everything on screen styled like a TV baseball broadcast.
//   scoreBug (the score in the top-left corner: club marks, scores, inning, B-S-O, bases, pitch count),
//   lowerThird (the batter's name plate with the uniform number and season line), pitcherPlate, speedGun (the pitch speed
//   after each pitch), caption (a sweeping band for ヒット / ホームラン / アウト), stinger (the inning card that wipes across),
//   and the shared shapes (slanted bars with a glossy top and a gold edge) used by the menus too.
import { W, H, txt, roundRect, clamp } from './core.js';
import { teamOf, grade } from './data.js';
import { drawEmblem } from './emblem.js';

export const TV = { navy: '#0a1430', navy2: '#13224a', gold: '#f5c542', gold2: '#ffde7a', red: '#e0283c', white: '#ffffff', ink: '#e9efff', dim: '#9fb0d6' };
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

// a slanted bar (a parallelogram): k = the slant in px
export function slant(c, x, y, w, h, k = 12) {
  c.beginPath(); c.moveTo(x + k, y); c.lineTo(x + w, y); c.lineTo(x + w - k, y + h); c.lineTo(x, y + h); c.closePath();
}
// the glossy dark plate every graphic sits on
export function plate(c, x, y, w, h, o = {}) {
  const k = o.k != null ? o.k : 12;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 14; c.shadowOffsetY = 4;
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, o.top || '#1b2c5e'); g.addColorStop(0.5, o.mid || TV.navy2); g.addColorStop(1, o.bottom || TV.navy);
  c.fillStyle = g; slant(c, x, y, w, h, k); c.fill();
  c.restore();
  // the gloss on the upper half
  c.save(); slant(c, x, y, w, h, k); c.clip();
  const gl = c.createLinearGradient(0, y, 0, y + h * 0.55); gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(1, 'rgba(255,255,255,0.02)');
  c.fillStyle = gl; c.fillRect(x, y, w, h * 0.5);
  if (o.stripe) { c.fillStyle = o.stripe; c.fillRect(x, y + h - 4, w, 4); }
  c.restore();
  if (o.edge !== false) { c.strokeStyle = o.edge || 'rgba(245,197,66,0.85)'; c.lineWidth = 1.5; slant(c, x + 0.5, y + 0.5, w - 1, h - 1, k); c.stroke(); }
}
// a small team chip: the club mark on white with the club colour behind
function teamChip(c, x, y, s, id) {
  const t = teamOf(id);
  c.fillStyle = t.c1; roundRect(c, x, y, s, s, 5); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(c, x + 2, y + 2, s - 4, s - 4, 4); c.fill();
  drawEmblem(c, x + s / 2, y + s / 2, s - 7, id);
}

// ---------------------------------------------------------------- the score bug (top-left)
export function scoreBug(c, GS, o = {}) {
  const x = 14, y = 12, w = 352, h = 76;
  plate(c, x, y, w, h, { k: 0 });
  const rows = [['away', GS.away], ['home', GS.home]];
  rows.forEach(([s, id], i) => {
    const t = teamOf(id), yy = y + 6 + i * 34;
    const batting = (s === 'away') === GS.top && !GS.over;
    c.fillStyle = t.c1; c.fillRect(x + 4, yy, 158, 30);
    const g = c.createLinearGradient(0, yy, 0, yy + 30); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.15)'); c.fillStyle = g; c.fillRect(x + 4, yy, 158, 30);
    teamChip(c, x + 7, yy + 2, 26, id);
    txt(c, t.short, x + 40, yy + 15, { size: 16, color: '#ffffff', max: 80, stroke: 'rgba(0,0,0,0.35)', strokeW: 3 });
    if (batting) { c.fillStyle = TV.gold; c.beginPath(); c.moveTo(x + 124, yy + 9); c.lineTo(x + 132, yy + 15); c.lineTo(x + 124, yy + 21); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(x + 136, yy, 26, 30);
    txt(c, String(GS.score[s]), x + 149, yy + 16, { size: 21, color: '#ffffff', align: 'center' });
  });
  // the inning
  const ix = x + 170;
  txt(c, GS.over ? '試合終了' : `${GS.inning}回`, ix + 26, y + 22, { size: 18, color: TV.gold2, align: 'center' });
  if (!GS.over) { c.fillStyle = '#ffffff'; c.beginPath(); if (GS.top) { c.moveTo(ix + 46, y + 26); c.lineTo(ix + 54, y + 26); c.lineTo(ix + 50, y + 18); } else { c.moveTo(ix + 46, y + 18); c.lineTo(ix + 54, y + 18); c.lineTo(ix + 50, y + 26); } c.fill(); }
  // B S O
  const L = [['B', GS.balls, 3, '#3ddc84'], ['S', GS.strikes, 2, '#ffd23f'], ['O', GS.outs, 2, '#ff4b4b']];
  L.forEach(([lb, n, max, col], i) => {
    const yy = y + 40 + i * 11;
    txt(c, lb, ix + 6, yy, { size: 10, color: TV.dim });
    for (let k = 0; k < max; k++) { c.beginPath(); c.arc(ix + 22 + k * 12, yy, 4.2, 0, 7); c.fillStyle = k < n ? col : 'rgba(255,255,255,0.13)'; c.fill(); }
  });
  // the bases
  const bx = x + 296, by = y + 44;
  [[bx + 15, by], [bx, by - 15], [bx - 15, by]].forEach(([px, py], i) => {
    c.save(); c.translate(px, py); c.rotate(Math.PI / 4);
    c.fillStyle = GS.bases[i] ? TV.gold : 'rgba(255,255,255,0.12)'; c.fillRect(-7, -7, 14, 14);
    c.strokeStyle = GS.bases[i] ? TV.gold2 : 'rgba(255,255,255,0.45)'; c.lineWidth = 1.2; c.strokeRect(-7, -7, 14, 14);
    c.restore();
  });
  if (o.pc != null) txt(c, `${o.pc}球`, x + w - 8, y + h - 9, { size: 10, color: TV.dim, align: 'right', bold: false });
}

// ---------------------------------------------------------------- the batter's name plate (lower third)
// p = the batter, o = { team, order, pos, season: {avg, hr, rbi}, today, abilities: [[label, v]...], t (frames shown) }
export function lowerThird(c, p, o) {
  const t = teamOf(o.team), k = ease((o.t || 99) / 14);
  const x = 14 - (1 - k) * 420, y = H - 104, w = 440, h = 88;
  c.save(); c.globalAlpha = k;
  // the number block in the club colour
  c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 12; c.fillStyle = t.c1; slant(c, x, y, 88, h, 16); c.fill(); c.restore();
  const gn = c.createLinearGradient(0, y, 0, y + h); gn.addColorStop(0, 'rgba(255,255,255,0.28)'); gn.addColorStop(0.5, 'rgba(255,255,255,0)'); c.fillStyle = gn; slant(c, x, y, 88, h, 16); c.fill();
  txt(c, String(p.num), x + 46, y + 40, { size: 40, align: 'center', color: '#ffffff', stroke: 'rgba(0,0,0,0.35)', strokeW: 4 });
  txt(c, o.pos || '', x + 42, y + 72, { size: 12, align: 'center', color: 'rgba(255,255,255,0.85)' });
  // the name bar
  plate(c, x + 76, y, w - 76, 50, { k: 16, stripe: t.c1 });
  txt(c, `${o.order}番`, x + 102, y + 25, { size: 13, color: TV.gold2 });
  txt(c, o.name, x + 140, y + 25, { size: 24, color: '#ffffff', max: 190 });
  txt(c, o.hand, x + w - 22, y + 25, { size: 12, color: TV.dim, align: 'right', bold: false });
  // the stats bar
  plate(c, x + 64, y + 52, w - 64, 36, { k: 16, top: '#f2f5fb', mid: '#e3e8f3', bottom: '#cfd6e6', edge: false });
  const S = o.season;
  const cells = [['打率', S.avg], ['本塁打', S.hr], ['打点', S.rbi]];
  cells.forEach(([lb, v], i) => { const cx = x + 96 + i * 88; txt(c, lb, cx, y + 70, { size: 11, color: '#4a5878' }); txt(c, String(v), cx + (lb.length > 2 ? 44 : 32), y + 70, { size: 17, color: TV.navy }); });
  txt(c, o.today, x + w - 24, y + 70, { size: 11, color: '#4a5878', align: 'right' });
  // the ability grades on a small tab above
  (o.abilities || []).forEach(([lb, v], i) => {
    const gd = grade(v), ax = x + 90 + i * 76, ay = y - 24;
    c.fillStyle = 'rgba(10,20,48,0.85)'; roundRect(c, ax, ay, 72, 20, 4); c.fill();
    txt(c, lb, ax + 6, ay + 10, { size: 10, color: TV.dim, bold: false });
    c.fillStyle = gd.col; roundRect(c, ax + 50, ay + 2, 18, 16, 3); c.fill();
    txt(c, gd.g, ax + 59, ay + 10, { size: 12, color: '#1a1206', align: 'center' });
  });
  c.restore();
}

// ---------------------------------------------------------------- the pitcher (top-right)
export function pitcherPlate(c, p, o) {
  const t = teamOf(o.team), x = W - 300, y = 12, w = 286, h = 62;
  plate(c, x, y, w, h, { k: 14, stripe: t.c1 });
  c.fillStyle = t.c1; slant(c, x + 6, y + 8, 46, 46, 10); c.fill();
  txt(c, String(p.num), x + 30, y + 31, { size: 22, align: 'center', color: '#ffffff' });
  txt(c, 'P', x + 62, y + 18, { size: 11, color: TV.gold2 });
  txt(c, o.name, x + 76, y + 20, { size: 17, color: '#ffffff', max: 140 });
  txt(c, `${o.hand}　最速${p.velo}km/h`, x + 62, y + 42, { size: 11, color: TV.dim, bold: false });
  // stamina
  const st = clamp(o.stamina, 0, 1);
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x + 190, y + 38, 78, 7);
  c.fillStyle = st > 0.5 ? '#3ddc84' : st > 0.2 ? '#ffd23f' : '#ff4b4b'; c.fillRect(x + 190, y + 38, 78 * st, 7);
  txt(c, `${o.pc}球`, x + w - 18, y + 20, { size: 14, color: '#ffffff', align: 'right' });
}

// ---------------------------------------------------------------- the speed gun (after a pitch)
export function speedGun(c, kmh, name, t = 99) {
  const k = ease(t / 10), x = W - 210 + (1 - k) * 230, y = 204, w = 196, h = 70;
  plate(c, x, y, w, h, { k: 14 });
  c.fillStyle = TV.red; slant(c, x + 6, y + 6, 62, 18, 6); c.fill();
  txt(c, '球速', x + 37, y + 15, { size: 11, color: '#ffffff', align: 'center' });
  txt(c, String(kmh), x + 120, y + 40, { size: 38, color: TV.gold2, align: 'right', stroke: 'rgba(0,0,0,0.4)', strokeW: 3 });
  txt(c, 'km/h', x + 126, y + 47, { size: 13, color: '#ffffff' });
  txt(c, name, x + 22, y + 58, { size: 12, color: TV.ink, bold: false });
}

// ---------------------------------------------------------------- a caption band sweeping across (ヒット・ホームラン・アウト)
// kind: 'hit' (gold) | 'hr' (red + gold, big) | 'out' (navy) | 'call' (strike / ball: small)
export function caption(c, text, kind, t, sub = '') {
  const k = ease(t / 12), big = kind === 'hr';
  const h = big ? 96 : kind === 'call' ? 52 : 70, y = big ? 160 : 150;
  const w = W * 0.78 * k;
  const x = W / 2 - w / 2;
  if (w < 4) return;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 18;
  const g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  if (kind === 'hr') { g.addColorStop(0, '#ff5a3a'); g.addColorStop(0.5, '#d0142c'); g.addColorStop(1, '#8a0b1e'); }
  else if (kind === 'hit') { g.addColorStop(0, '#ffe58a'); g.addColorStop(0.5, '#f5b82e'); g.addColorStop(1, '#c47f0c'); }
  else { g.addColorStop(0, '#2a3d78'); g.addColorStop(0.5, '#15255a'); g.addColorStop(1, '#0a1430'); }
  c.fillStyle = g; slant(c, x, y - h / 2, w, h, 26); c.fill();
  c.restore();
  // gold rules above and below
  c.fillStyle = kind === 'out' || kind === 'call' ? TV.gold : '#ffffff';
  c.fillRect(x + 26, y - h / 2 - 5, w - 26, 3); c.fillRect(x, y + h / 2 + 2, w - 26, 3);
  if (k < 0.6) return;
  const col = kind === 'hit' ? '#2a1600' : '#ffffff';
  txt(c, text, W / 2, y + (sub ? -8 : 2), { size: big ? 54 : kind === 'call' ? 28 : 38, align: 'center', color: col, stroke: kind === 'hit' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)', strokeW: big ? 6 : 4 });
  if (sub) txt(c, sub, W / 2, y + (big ? 34 : 24), { size: big ? 16 : 13, align: 'center', color: kind === 'hit' ? '#4a2a00' : TV.gold2, bold: true });
}

// ---------------------------------------------------------------- the inning card / play ball (a wipe with the club marks)
export function stinger(c, t, title, sub, teamId) {
  const k = ease(t / 14), out = t > 70 ? ease((t - 70) / 12) : 0;
  const tm = teamId ? teamOf(teamId) : null;
  const y = H / 2 - 64, h = 128;
  const x0 = -W + k * W + out * W;
  c.save();
  // the club-colour band, then the navy band over it
  c.fillStyle = tm ? tm.c1 : TV.red; slant(c, x0 - 40, y - 10, W + 80, h + 20, 60); c.fill();
  plate(c, x0 + 20, y, W - 40, h, { k: 60 });
  if (teamId) { c.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(c, x0 + 90, y + 14, 100, 100, 12); c.fill(); drawEmblem(c, x0 + 140, y + 64, 92, teamId); }
  txt(c, title, x0 + W / 2 + (teamId ? 60 : 0), y + 54, { size: 48, align: 'center', color: TV.gold2, stroke: 'rgba(0,0,0,0.5)', strokeW: 6 });
  if (sub) txt(c, sub, x0 + W / 2 + (teamId ? 60 : 0), y + 98, { size: 18, align: 'center', color: '#ffffff' });
  c.restore();
}

// ---------------------------------------------------------------- the broadcast menu pieces (used by the menus)
export function tvHeader(c, title, sub, teamId) {
  plate(c, -20, 10, 520, 46, { k: 20, stripe: teamId ? teamOf(teamId).c1 : TV.red });
  c.fillStyle = TV.gold; slant(c, 20, 18, 8, 30, 3); c.fill();
  txt(c, title, 40, 33, { size: 22, color: '#ffffff' });
  if (sub) { plate(c, W - 400, 14, 386, 38, { k: 16 }); txt(c, sub, W - 30, 33, { size: 13, align: 'right', color: TV.ink, bold: false, max: 350 }); }
}

// a club bar: the club colour, slanted, glossy, with the mark on a white chip and the short name
export function teamBar(c, x, y, w, h, id, o = {}) {
  const t = teamOf(id);
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
  c.fillStyle = t.c1; slant(c, x, y, w, h, o.k != null ? o.k : 8); c.fill();
  c.restore();
  c.save(); slant(c, x, y, w, h, o.k != null ? o.k : 8); c.clip();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.32)'); g.addColorStop(0.5, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.restore();
  const s = h - 4;
  c.fillStyle = 'rgba(255,255,255,0.95)'; roundRect(c, x + 8, y + 2, s, s, 4); c.fill();
  drawEmblem(c, x + 8 + s / 2, y + 2 + s / 2, s - 4, id);
  txt(c, o.label || t.short, x + 14 + s + (w - 22 - s) / 2, y + h / 2 + 1, { size: o.size || Math.round(h * 0.5), align: 'center', color: '#ffffff', max: w - 26 - s, stroke: 'rgba(0,0,0,0.35)', strokeW: 3 });
}
// a medal for the top three
export function medal(c, x, y, r, n) {
  const cols = [['#fff2b0', '#e0a91c'], ['#ffffff', '#a9b3c6'], ['#ffd7b0', '#b8742e']][n - 1];
  if (!cols) { txt(c, String(n), x, y, { size: r * 1.2, align: 'center', color: '#ffffff' }); return; }
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.stroke();
  txt(c, String(n), x, y + 1, { size: r * 1.1, align: 'center', color: '#3a2400' });
}
// a table row stripe (alternating), gold-edged when it is your club
export function rowStripe(c, x, y, w, h, i, mine) {
  c.fillStyle = mine ? 'rgba(245,197,66,0.2)' : i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
  slant(c, x, y, w, h, 6); c.fill();
  if (mine) { c.strokeStyle = 'rgba(245,197,66,0.85)'; c.lineWidth = 1.5; slant(c, x, y, w, h, 6); c.stroke(); }
}
