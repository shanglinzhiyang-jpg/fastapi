// スーパープロ野球ロード — the pictures, drawn as smooth vector shapes (no pixel art): the chibi players (an original design:
// a big round head, a cap in the club colour, round eyes, a short body), the batting view (from behind the catcher: the
// stands, the outfield, the mound, the pitcher, the batter, the strike zone), the field from above (fielders, the ball and its
// shadow), the scoreboard, the count lights, the bases, grade badges and player cards.
import { W, H, clamp, lerp, roundRect, txt } from './core.js';
import { grade, teamOf, PITCHES, POS_SHORT } from './data.js';

const SKINS = ['#f6d2b0', '#f1c39d', '#e8b48a', '#f8dcc0'];
export const lookOf = (p, teamId, o = {}) => { const t = teamOf(teamId); return { c1: t.c1, c2: t.c2, mark: t.mark, num: p ? p.num : 0, skin: SKINS[(p ? p.num : 0) % SKINS.length], hair: p && p.num % 3 === 0 ? '#5a3a22' : '#1e1a1a', ...o }; };
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const f = (v) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255); r = f(r); g = f(g); b = f(b); return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`; };
function ell(c, x, y, rx, ry, fill, line = '#1d1a24', lw = 2) { c.beginPath(); c.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (line) { c.lineWidth = lw; c.strokeStyle = line; c.stroke(); } }
function limb(c, x1, y1, x2, y2, w, fill) { c.lineCap = 'round'; c.lineWidth = w + 3; c.strokeStyle = '#1d1a24'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.lineWidth = w; c.strokeStyle = fill; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

// ---------------------------------------------------------------- the chibi player
// pose: 'stand' | 'ready' (batting stance) | 'swing' (t 0..1) | 'pitch' (t 0..1) | 'run' (t) | 'crouch' (catcher) | 'field'
// view: 'front' | 'back' (seen from behind: no face, the number on the back); flip: mirror (a left-handed batter / pitcher)
export function drawChibi(c, x, y, s, L, pose = 'stand', t = 0, o = {}) {
  c.save();
  c.translate(x, y);
  c.scale(s * (o.flip ? -1 : 1), s);
  const back = o.view === 'back';
  const uni = o.away ? '#d8dde8' : '#fbfbfd', uniD = o.away ? '#aab2c4' : '#d8dce6';
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 2, 26, 7, 0, 0, Math.PI * 2); c.fill();
  let lean = 0, legA = 0, armL = [-14, -32, -26, -14], armR = [14, -32, 26, -14], bat = null;
  if (pose === 'run') { legA = Math.sin(t * Math.PI * 2) * 0.9; armL = [-14, -32, -22 - Math.sin(t * 6.28) * 8, -18]; armR = [14, -32, 22 + Math.sin(t * 6.28) * 8, -18]; lean = 0.15; }
  if (pose === 'ready') { armL = [-10, -34, 6, -46]; armR = [12, -34, 8, -46]; bat = { x: 7, y: -46, a: -2.1 - Math.sin(t * 3) * 0.05 }; }
  if (pose === 'swing') { const k = clamp(t, 0, 1); const a = lerp(-2.1, 1.3, k); armL = [-10, -34, 7 + Math.cos(a) * 12, -38 + Math.sin(a) * 8]; armR = [12, -34, 9 + Math.cos(a) * 12, -38 + Math.sin(a) * 8]; bat = { x: 8 + Math.cos(a) * 12, y: -38 + Math.sin(a) * 8, a: a - 0.3 }; lean = (k - 0.5) * 0.25; }
  if (pose === 'pitch') {
    const k = clamp(t, 0, 1);
    if (k < 0.45) { const q = k / 0.45; legA = -q * 1.2; armR = [14, -32, 26 - q * 10, -14 - q * 34]; armL = [-14, -32, -20, -30 + q * 6]; }
    else { const q = (k - 0.45) / 0.55; legA = lerp(-1.2, 0.6, q); armR = [14, -32, lerp(16, -18, q), lerp(-48, -8, q)]; armL = [-14, -32, -24 + q * 6, -20]; lean = q * 0.35; }
  }
  if (pose === 'crouch') { armL = [-12, -26, -18, -16]; armR = [12, -26, 20, -18]; }
  c.rotate(lean);
  const crouch = pose === 'crouch';
  const hipY = crouch ? -10 : -18;
  // legs
  const legLen = crouch ? 10 : 18;
  for (const side of [-1, 1]) {
    const a = side * legA;
    const fx = side * 7 + Math.sin(a) * legLen, fy = hipY + Math.cos(a) * legLen;
    limb(c, side * 6, hipY, fx, fy, 9, uni);
    limb(c, fx, fy - 3, fx, fy, 9, L.c1); // socks
    ell(c, fx + side * 2, fy + 2, 7, 4, '#2a2a34', '#1d1a24', 1.5); // shoes
  }
  // body
  c.beginPath(); roundRect(c, -15, hipY - 26, 30, 30, 12); c.fillStyle = uni; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1d1a24'; c.stroke();
  c.fillStyle = uniD; c.fillRect(-14, hipY - 4, 28, 3);
  c.fillStyle = L.c1; c.fillRect(-14, hipY - 6, 28, 3); // belt
  if (back) { txt(c, String(L.num), 0, hipY - 13, { size: 14, color: L.c1, align: 'center', stroke: '#ffffff', strokeW: 2 }); }
  else { c.fillStyle = L.c1; c.fillRect(-1, hipY - 26, 2, 20); txt(c, L.mark, -7, hipY - 17, { size: 9, color: L.c1, align: 'center' }); }
  // arms
  limb(c, armL[0], armL[1], armL[2], armL[3], 7, uni); ell(c, armL[2], armL[3], 4, 4, L.skin, '#1d1a24', 1.5);
  if (bat) { c.save(); c.translate(bat.x, bat.y); c.rotate(bat.a); c.lineCap = 'round'; c.strokeStyle = '#1d1a24'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, 0); c.lineTo(38, 0); c.stroke(); const gr = c.createLinearGradient(0, 0, 38, 0); gr.addColorStop(0, '#6a4426'); gr.addColorStop(1, '#d8a868'); c.strokeStyle = gr; c.lineWidth = 4; c.beginPath(); c.moveTo(1, 0); c.lineTo(37, 0); c.stroke(); c.restore(); }
  limb(c, armR[0], armR[1], armR[2], armR[3], 7, uni); ell(c, armR[2], armR[3], 4, 4, L.skin, '#1d1a24', 1.5);
  if (o.glove) ell(c, armL[2] - 3, armL[3], 7, 6, '#a0602a', '#1d1a24', 1.5);
  // head
  const hy = hipY - 48;
  if (back) { ell(c, -22, hy + 4, 4, 6, L.skin); ell(c, 22, hy + 4, 4, 6, L.skin); ell(c, 0, hy + 14, 9, 5, L.skin, null); }
  ell(c, 0, hy, 23, 21, back ? L.hair : L.skin);
  if (!back) {
    // eyes, blush, mouth
    for (const sx of [-8, 8]) { ell(c, sx, hy + 2, 3.6, 5, '#1d1a24', null); ell(c, sx + 1.2, hy - 0.5, 1.3, 1.5, '#ffffff', null); }
    c.fillStyle = 'rgba(255,120,120,0.35)'; c.beginPath(); c.ellipse(-14, hy + 9, 4, 2.5, 0, 0, 7); c.ellipse(14, hy + 9, 4, 2.5, 0, 0, 7); c.fill();
    c.strokeStyle = '#1d1a24'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, hy + 9, 3, 0.2, Math.PI - 0.2); c.stroke();
  }
  // cap or helmet
  const helmet = o.helmet;
  c.beginPath(); c.ellipse(0, hy - 6, helmet ? 25 : 24, helmet ? 19 : 16, 0, Math.PI, 0); c.closePath();
  const cg = c.createLinearGradient(0, hy - 24, 0, hy - 4); cg.addColorStop(0, shade(L.c1, 0.25)); cg.addColorStop(1, L.c1);
  c.fillStyle = cg; c.fill(); c.lineWidth = 2; c.strokeStyle = '#1d1a24'; c.stroke();
  if (helmet && !back) { c.fillStyle = L.c1; c.beginPath(); c.ellipse(-18, hy - 2, 9, 10, 0, 0, 7); c.fill(); c.stroke(); }
  if (back) { c.beginPath(); c.ellipse(0, hy - 6, 24, 4, 0, 0, Math.PI); c.fillStyle = shade(L.c1, -0.3); c.fill(); }
  if (!back) { c.beginPath(); c.ellipse(0, hy - 6, 26, 6, 0, 0, Math.PI); c.fillStyle = shade(L.c1, -0.25); c.fill(); c.stroke(); txt(c, L.mark, 0, hy - 14, { size: 13, color: L.c2, align: 'center', stroke: '#1d1a24', strokeW: 2 }); }
  c.restore();
}

// ---------------------------------------------------------------- the batting view (from behind the catcher)
export const ZONE = { cx: 480, cy: 372, hw: 62, hh: 78 }; // the strike zone at the plate (half width / height in px)
export const RELEASE = { x: 482, y: 214 };
export function zoneToScreen(zx, zy) { return { x: ZONE.cx + zx * ZONE.hw, y: ZONE.cy + zy * ZONE.hh }; }
export function drawBattingView(c, f, o = {}) {
  const night = o.night;
  // sky
  const sk = c.createLinearGradient(0, 0, 0, 160);
  if (night) { sk.addColorStop(0, '#060c22'); sk.addColorStop(1, '#1a2a5a'); } else { sk.addColorStop(0, '#5aa8f0'); sk.addColorStop(1, '#bfe2fb'); }
  c.fillStyle = sk; c.fillRect(0, 0, W, 170);
  if (night) for (const lx of [90, 870]) { c.fillStyle = '#2a3048'; c.fillRect(lx - 3, 20, 6, 70); c.fillStyle = '#fff8d0'; c.shadowColor = '#fff8d0'; c.shadowBlur = 20; roundRect(c, lx - 34, 6, 68, 22, 4); c.fill(); c.shadowBlur = 0; }
  // the stands with the crowd
  const st = c.createLinearGradient(0, 70, 0, 170); st.addColorStop(0, night ? '#22264a' : '#5a6a8a'); st.addColorStop(1, night ? '#30365e' : '#7a8aa8');
  c.fillStyle = st; c.beginPath(); c.moveTo(0, 170); c.lineTo(0, 92); c.quadraticCurveTo(480, 52, W, 92); c.lineTo(W, 170); c.fill();
  for (let i = 0; i < 520; i++) {
    const x = (i * 97) % W, yy = 96 + ((i * 53) % 70) - Math.cos(((x - 480) / 480) * 1.2) * 18;
    const bob = Math.sin(f * 0.08 + i) * (o.cheer ? 2 : 0.4);
    c.fillStyle = ['#ff6a6a', '#ffd23f', '#ffffff', '#6ab0ff', o.c1 || '#1b3c8f', o.c2 || '#ffd23f'][i % 6];
    c.fillRect(x, yy + bob, 3, 3);
  }
  // the outfield wall and the ads (made-up sponsors)
  const wy = 168;
  c.fillStyle = '#1b5a3a'; c.fillRect(0, wy - 12, W, 16);
  const ads = ['ドットフーズ', 'スター電機', 'ロード飲料', 'ドリーム保険', 'ベース通信', 'ホームラン食堂'];
  for (let i = 0; i < 6; i++) { c.fillStyle = ['#e04a3a', '#2a6ad8', '#f0a020', '#2aa86a', '#8a4ad8', '#d83a8a'][i]; roundRect(c, 20 + i * 158, wy - 11, 142, 13, 3); c.fill(); txt(c, ads[i], 91 + i * 158, wy - 4, { size: 10, color: '#ffffff', align: 'center' }); }
  // the outfield with the mowing stripes
  const gy = wy + 4;
  for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#3fa25a' : '#48b064'; c.beginPath(); const a = lerp(0, W, i / 9), b = lerp(0, W, (i + 1) / 9); c.moveTo(a, gy); c.lineTo(b, gy); c.lineTo(lerp(-900, W + 900, (i + 1) / 9), H); c.lineTo(lerp(-900, W + 900, i / 9), H); c.fill(); }
  // the infield dirt
  c.fillStyle = '#c99a62'; c.beginPath(); c.moveTo(480, 206); c.lineTo(870, 340); c.lineTo(480, 560); c.lineTo(90, 340); c.closePath(); c.fill();
  c.fillStyle = '#4bb066'; c.beginPath(); c.moveTo(480, 236); c.lineTo(770, 342); c.lineTo(480, 500); c.lineTo(190, 342); c.closePath(); c.fill();
  // the bases
  for (const [bx, by] of [[820, 340], [480, 214], [140, 340]]) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(bx, by - 6); c.lineTo(bx + 10, by); c.lineTo(bx, by + 6); c.lineTo(bx - 10, by); c.fill(); }
  // the mound
  const mg = c.createRadialGradient(482, 236, 4, 482, 236, 44); mg.addColorStop(0, '#dcae74'); mg.addColorStop(1, '#c08e56');
  c.fillStyle = mg; c.beginPath(); c.ellipse(482, 238, 46, 14, 0, 0, 7); c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(472, 234, 20, 3);
  // home plate and the batter's boxes
  c.fillStyle = '#d8b07a'; c.beginPath(); c.ellipse(480, 480, 230, 54, 0, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3;
  c.strokeRect(318, 440, 108, 70); c.strokeRect(534, 440, 108, 70);
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(452, 470); c.lineTo(508, 470); c.lineTo(508, 482); c.lineTo(480, 496); c.lineTo(452, 482); c.closePath(); c.fill();
}
export function drawZone(c, o = {}) {
  const { cx, cy, hw, hh } = ZONE;
  c.save();
  c.fillStyle = o.fill || 'rgba(255,255,255,0.06)'; c.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
  c.strokeStyle = o.line || 'rgba(255,255,255,0.75)'; c.lineWidth = 2; c.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
  c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1;
  for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(cx - hw + (hw * 2 * i) / 3, cy - hh); c.lineTo(cx - hw + (hw * 2 * i) / 3, cy + hh); c.stroke(); c.beginPath(); c.moveTo(cx - hw, cy - hh + (hh * 2 * i) / 3); c.lineTo(cx + hw, cy - hh + (hh * 2 * i) / 3); c.stroke(); }
  c.restore();
}
// the ball (with a white glow; r grows as it comes)
export function drawBall(c, x, y, r, o = {}) {
  if (o.trail) { c.fillStyle = 'rgba(255,255,255,0.18)'; for (const [tx, ty, tr] of o.trail) { c.beginPath(); c.arc(tx, ty, tr, 0, 7); c.fill(); } }
  c.save();
  c.shadowColor = 'rgba(255,255,255,0.8)'; c.shadowBlur = r * 1.2;
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8dce6');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.restore();
  if (r > 5) { c.strokeStyle = '#e0484a'; c.lineWidth = Math.max(1, r / 7); c.beginPath(); c.arc(x - r * 0.9, y, r * 0.75, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(x + r * 0.9, y, r * 0.75, Math.PI - 0.9, Math.PI + 0.9); c.stroke(); }
}
// the meet cursor (an oval with a core); power: the 強振 look (smaller, red)
export function drawCursor(c, x, y, rx, ry, power, f) {
  c.save();
  const col = power ? 'rgba(255,90,90,' : 'rgba(255,220,80,';
  c.fillStyle = `${col}0.22)`; c.strokeStyle = `${col}0.95)`; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = `${col}${0.55 + Math.sin(f * 0.3) * 0.2})`;
  c.beginPath(); c.ellipse(x, y, rx * 0.32, ry * 0.32, 0, 0, 7); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- the field from above (a batted ball)
// field coords: home (0,0), +y toward center field, metres; screen: home at (480, 500), 2.9 px per metre
export const FIELD = { hx: 480, hy: 505, k: 3.15 };
export const fieldToScreen = (x, y) => ({ x: FIELD.hx + x * FIELD.k, y: FIELD.hy - y * FIELD.k * 0.92 });
export const fenceDist = (deg) => 100 + 22 * Math.cos((deg / 45) * (Math.PI / 2));
export function drawField(c, o = {}) {
  c.fillStyle = o.night ? '#0e1e3a' : '#3a7ad0'; c.fillRect(0, 0, W, H);
  // the stands ring
  c.fillStyle = o.night ? '#262c50' : '#6a7aa0';
  c.beginPath(); for (let d = -52; d <= 52; d += 2) { const r = fenceDist(clamp(d, -45, 45)) + 22, rad = (d * Math.PI) / 180; const p = fieldToScreen(Math.sin(rad) * r, Math.cos(rad) * r); if (d === -52) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); } c.lineTo(FIELD.hx, FIELD.hy + 60); c.closePath(); c.fill();
  // the grass inside the fence
  c.fillStyle = '#46ad62';
  c.beginPath(); c.moveTo(FIELD.hx, FIELD.hy); for (let d = -45; d <= 45; d += 1.5) { const r = fenceDist(d), rad = (d * Math.PI) / 180; const p = fieldToScreen(Math.sin(rad) * r, Math.cos(rad) * r); c.lineTo(p.x, p.y); } c.closePath(); c.fill();
  // the fence
  c.strokeStyle = '#1b5a3a'; c.lineWidth = 6; c.beginPath(); for (let d = -45; d <= 45; d += 1.5) { const r = fenceDist(d), rad = (d * Math.PI) / 180; const p = fieldToScreen(Math.sin(rad) * r, Math.cos(rad) * r); if (d === -45) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); } c.stroke();
  // the infield dirt and the diamond
  const b1 = fieldToScreen(19.4, 19.4), b2 = fieldToScreen(0, 38.8), b3 = fieldToScreen(-19.4, 19.4), hp = fieldToScreen(0, 0);
  c.fillStyle = '#c99a62'; c.beginPath(); c.moveTo(hp.x, hp.y + 8); const big = 1.32; c.lineTo(hp.x + (b1.x - hp.x) * big, hp.y + (b1.y - hp.y) * big); c.quadraticCurveTo(b2.x, b2.y - 70, hp.x + (b3.x - hp.x) * big, hp.y + (b3.y - hp.y) * big); c.closePath(); c.fill();
  c.fillStyle = '#46ad62'; c.beginPath(); c.moveTo(hp.x, hp.y - 14); c.lineTo(b1.x - 10, b1.y); c.lineTo(b2.x, b2.y + 10); c.lineTo(b3.x + 10, b3.y); c.closePath(); c.fill();
  c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); const fl = fieldToScreen(-71, 71), fr = fieldToScreen(71, 71); c.moveTo(fl.x, fl.y); c.lineTo(hp.x, hp.y); c.lineTo(fr.x, fr.y); c.stroke();
  for (const b of [b1, b2, b3]) { c.fillStyle = '#ffffff'; c.fillRect(b.x - 5, b.y - 5, 10, 10); }
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(hp.x - 6, hp.y - 4); c.lineTo(hp.x + 6, hp.y - 4); c.lineTo(hp.x + 6, hp.y + 2); c.lineTo(hp.x, hp.y + 6); c.lineTo(hp.x - 6, hp.y + 2); c.fill();
  const md = fieldToScreen(0, 18.4); c.fillStyle = '#d8aa70'; c.beginPath(); c.ellipse(md.x, md.y, 14, 9, 0, 0, 7); c.fill();
}
// the nine fielders' standard spots (metres)
export const FIELDER_SPOTS = { P: [0, 18], C: [0, -2], '1B': [18, 24], '2B': [10, 36], SS: [-10, 36], '3B': [-18, 24], LF: [-34, 78], CF: [0, 92], RF: [34, 78] };

// ---------------------------------------------------------------- HUD: the scoreboard, the count, the bases
export function drawScoreboard(c, GS, x = 14, y = 12) {
  c.save();
  c.fillStyle = 'rgba(6,12,30,0.86)'; roundRect(c, x, y, 268, 92, 12); c.fill();
  c.strokeStyle = 'rgba(140,180,255,0.4)'; c.lineWidth = 2; roundRect(c, x + 1, y + 1, 266, 90, 11); c.stroke();
  const rows = [['away', GS.away], ['home', GS.home]];
  rows.forEach(([s, id], i) => {
    const t = teamOf(id), yy = y + 22 + i * 30;
    c.fillStyle = t.c1; roundRect(c, x + 10, yy - 11, 78, 22, 6); c.fill();
    txt(c, t.short, x + 49, yy, { size: 14, color: '#ffffff', align: 'center' });
    const batting = (s === 'away') === GS.top;
    if (batting && !GS.over) { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(x + 94, yy - 5); c.lineTo(x + 102, yy); c.lineTo(x + 94, yy + 5); c.fill(); }
    txt(c, String(GS.score[s]), x + 128, yy, { size: 22, color: '#ffffff', align: 'center' });
  });
  txt(c, GS.over ? '試合終了' : `${GS.inning}回${GS.top ? '表' : '裏'}`, x + 196, y + 22, { size: 16, color: '#ffd23f', align: 'center' });
  // B S O
  const lights = [['B', GS.balls, 3, '#3ad06a'], ['S', GS.strikes, 2, '#ffcf3a'], ['O', GS.outs, 2, '#ff4a4a']];
  lights.forEach(([lb, n, max, col], i) => {
    const yy = y + 42 + i * 15;
    txt(c, lb, x + 160, yy, { size: 11, color: '#cfd8ee' });
    for (let k = 0; k < max; k++) { c.beginPath(); c.arc(x + 180 + k * 15, yy, 5, 0, 7); c.fillStyle = k < n ? col : 'rgba(255,255,255,0.12)'; c.fill(); }
  });
  // bases
  const bx = x + 240, by = y + 58;
  [[bx + 12, by], [bx, by - 12], [bx - 12, by]].forEach(([px, py], i) => {
    c.save(); c.translate(px, py); c.rotate(Math.PI / 4);
    c.fillStyle = GS.bases[i] ? '#ffd23f' : 'rgba(255,255,255,0.14)'; c.fillRect(-6, -6, 12, 12);
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.strokeRect(-6, -6, 12, 12);
    c.restore();
  });
  c.restore();
}
export function badge(c, x, y, v, label, o = {}) {
  const gd = grade(v);
  const w = o.w || 58;
  c.fillStyle = 'rgba(255,255,255,0.07)'; roundRect(c, x, y, w, 22, 6); c.fill();
  txt(c, label, x + 6, y + 11, { size: 11, color: '#cfd8ee', bold: false });
  c.fillStyle = gd.col; roundRect(c, x + w - 24, y + 2, 20, 18, 5); c.fill();
  txt(c, gd.g, x + w - 14, y + 11, { size: 13, color: '#1a1206', align: 'center' });
}
export function pitchChip(c, x, y, p, o = {}) {
  const P = PITCHES[p.t] || PITCHES.st;
  c.fillStyle = o.on ? '#ffd23f' : 'rgba(255,255,255,0.1)'; roundRect(c, x, y, o.w || 150, 26, 8); c.fill();
  txt(c, P.name, x + 10, y + 13, { size: 13, color: o.on ? '#1a1206' : '#eef3ff' });
  if (p.lv) { for (let i = 0; i < 7; i++) { c.fillStyle = i < p.lv ? (o.on ? '#1a1206' : P.col) : 'rgba(255,255,255,0.15)'; c.fillRect(x + (o.w || 150) - 56 + i * 7, y + 9, 5, 9); } }
}
export const posShort = (pos) => POS_SHORT[pos] || pos;
