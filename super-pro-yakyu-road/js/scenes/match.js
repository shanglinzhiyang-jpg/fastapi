// スーパープロ野球ロード — the playable game. Your club bats (the meet cursor: move it with the pad, A = ミート打ち,
// B = 強振, by the timing of the pitch) and fields (choose a pitch, aim, throw; the computer batter decides). Balls in play fly
// on the field seen from above and become hits, outs or home runs by the batted-ball model below; the rules, the count, the
// runners and the stats are game.js. START: the menu (オート for the inning / to the end, 投手交代, 試合にもどる).
import { W, H, clamp, lerp, gauss, sound, txt, panel, menuList, inRect, roundRect } from '../core.js';
import { teamOf, PITCHES, pname, pfull, grade } from '../data.js';
import { newGame, applyPA, simPA, battingSide, fieldingSide, batterOf, pitcherOf, nextBatters, maybeChange, fatigue, addPitches, commitGame, defenseOf, balOf } from '../game.js';
import { drawChibi, lookOf, drawBattingView, drawZone, drawBall, drawCursor, zoneToScreen, ZONE, RELEASE, drawField, fieldToScreen, fenceDist, FIELDER_SPOTS, drawScoreboard, badge, pitchChip, posShort } from '../draw.js';
import { avg, fmt3, era } from '../league.js';
import { MatchView, pitchPoint, zoneField } from '../gfx/match3d.js';

const SLOW = 1.75; // the pitch takes this many times its real flight time (playable)
const KIND_TEXT = { '1B': 'ヒット！', '2B': 'ツーベース！', '3B': 'スリーベース！', HR: 'ホームラン！！', GO: 'ゴロアウト', FO: 'フライアウト', LO: 'ライナーアウト', PO: 'ポップフライ', DP: 'ゲッツー' };

// ---------------------------------------------------------------- the batted-ball model (shared by you and the computer)
// q: contact quality 0..1, dyN: the ball below (+) / above (−) the sweet spot, e: timing (frames, − early), win: the timing window
export function battedBall({ bat, q, dyN, e, win, power: pw, bal, rng = Math.random }) {
  const pull = bat.bats === 'L' ? 1 : -1; // a right-handed batter pulls to left field (negative angle)
  const angle = 14 - dyN * 30 + gauss(rng) * 5 + (pw ? 5 : 0);
  const spray = clamp((-e / win) * 32 * -pull + gauss(rng) * 9, -60, 60);
  const v = (98 + bat.power * 0.42 + (pw ? 15 : 0)) * (0.48 + 0.52 * q) * (1 + (bal.hr - 1) * 0.06);
  const vm = v / 3.6, th = (clamp(angle, -10, 80) * Math.PI) / 180;
  const dist = angle <= 4 ? clamp(vm * 1.2, 12, 50) : (vm * vm * Math.sin(2 * th)) / 9.8 * 0.8;
  return { angle, spray, v, dist };
}
const IF_POS = { '1B': 27, '2B': 12, SS: -12, '3B': -27 };
const OF_POS = { LF: -28, CF: 0, RF: 28 };
export function judge(bb, GS, L, rng = Math.random) {
  const bal = balOf(L), def = defenseOf(GS, L), bat = batterOf(GS, L);
  const deg = bb.spray, dist = bb.dist;
  if (Math.abs(deg) > 45) return { kind: 'FOUL', land: land(deg, Math.min(dist, 60)) };
  const fence = fenceDist(deg) / (1 + (bal.hr - 1) * 0.16);
  const nearIF = Object.entries(IF_POS).sort((a, b) => Math.abs(a[1] - deg) - Math.abs(b[1] - deg))[0];
  const nearOF = Object.entries(OF_POS).sort((a, b) => Math.abs(a[1] - deg) - Math.abs(b[1] - deg))[0];
  const dAdj = -(def - 58) / 300 + (bat.speed - 55) / 600;
  const H = (p) => rng() < clamp(p * bal.hit + dAdj, 0.02, 0.97);
  if (bb.angle < 8) {
    const gap = Math.min(...Object.values(IF_POS).map((a) => Math.abs(a - deg))) / 14;
    if (H(0.16 + (bb.v - 110) / 200 + gap * 0.22)) return { kind: Math.abs(deg) > 38 && bb.v > 140 && rng() < 0.4 ? '2B' : '1B', land: land(deg, clamp(dist + 30, 40, 70)), ground: true };
    return { kind: 'GO', where: posName(nearIF[0]), land: land(deg, clamp(dist, 18, 34)), ground: true, fielder: nearIF[0] };
  }
  if (bb.angle > 52) return { kind: 'PO', where: posName(dist < 30 ? nearIF[0] : nearOF[0]), land: land(deg, clamp(dist, 10, 60)), fielder: dist < 30 ? nearIF[0] : nearOF[0] };
  if (dist >= fence) return { kind: 'HR', land: land(deg, dist + 6) };
  const gapOF = Math.min(...Object.values(OF_POS).map((a) => Math.abs(a - deg))) / 14;
  if (bb.angle < 22) {
    if (dist < 32) { if (H(0.25)) return { kind: '1B', land: land(deg, 40) }; return { kind: 'LO', where: posName(nearIF[0]), land: land(deg, dist), fielder: nearIF[0] }; }
    if (H(0.62 + (bb.v - 120) / 260 + gapOF * 0.1)) return { kind: dist > 82 && gapOF > 0.6 ? (rng() < 0.12 + (bat.speed - 55) / 300 ? '3B' : '2B') : '1B', land: land(deg, dist) };
    return { kind: 'LO', where: posName(nearOF[0]), land: land(deg, dist), fielder: nearOF[0] };
  }
  if (dist > fence - 10 && gapOF > 0.5 && H(0.7)) return { kind: rng() < 0.18 + (bat.speed - 55) / 250 ? '3B' : '2B', land: land(deg, fence - 3) };
  if (dist > 42 && dist < 66 && H(0.42 + gapOF * 0.1)) return { kind: '1B', land: land(deg, dist) };
  if (H(0.05)) return { kind: '1B', land: land(deg, dist) };
  return { kind: 'FO', where: posName(dist < 50 ? nearIF[0] : nearOF[0]), land: land(deg, dist), fielder: dist < 50 ? nearIF[0] : nearOF[0] };
}
const land = (deg, d) => ({ x: Math.sin((deg * Math.PI) / 180) * d, y: Math.cos((deg * Math.PI) / 180) * d, deg, d });
const posName = (k) => ({ '1B': 'ファースト', '2B': 'セカンド', SS: 'ショート', '3B': 'サード', LF: 'レフト', CF: 'センター', RF: 'ライト' })[k] || '';

// the computer pitcher's choice: a pitch and where it ends up
function cpuPitch(GS, L, rng = Math.random) {
  const p = pitcherOf(GS, L);
  const list = [{ t: 'st', lv: 0 }, ...p.pitches];
  const ws = list.map((x) => (x.t === 'st' ? 45 : x.lv * 7));
  let r = rng() * ws.reduce((a, b) => a + b, 0), i = 0;
  while (r > ws[i]) { r -= ws[i]; i++; }
  const pt = list[Math.min(i, list.length - 1)];
  let tx, ty;
  if (GS.balls === 3) { tx = gauss(rng) * 0.35; ty = gauss(rng) * 0.35; }
  else if (GS.strikes === 2) { tx = (rng() < 0.5 ? -1 : 1) * (0.7 + rng() * 0.6); ty = 0.4 + rng() * 0.8; }
  else { tx = (rng() * 2 - 1) * 1.15; ty = (rng() * 2 - 1) * 1.1; }
  return makePitch(GS, L, pt, tx, ty, rng);
}
// a thrown pitch: the type, its speed (fatigue costs a few km/h), the spot it ends (target + scatter by control)
function makePitch(GS, L, pt, tx, ty, rng = Math.random) {
  const p = pitcherOf(GS, L), P = PITCHES[pt.t] || PITCHES.st;
  const fat = fatigue(GS, L, fieldingSide(GS));
  const tired = Math.max(0, fat - 0.85);
  const sd = (0.36 - p.control / 330) * (1 + tired * 1.5);
  const fx = tx + gauss(rng) * sd * 0.6, fy = ty + gauss(rng) * sd * 0.6;
  const kmh = Math.round((p.velo - tired * 8) * P.spd + gauss(rng) * 1.2);
  const flip = p.throws === 'L' ? -1 : 1;
  const k = pt.t === 'st' ? 1 : 0.55 + pt.lv * 0.09;
  return { t: pt.t, lv: pt.lv || 0, name: P.name, kmh, fx, fy, hx: P.hx * k * flip, vy: P.vy * k, dur: Math.round((18.44 / (kmh / 3.6)) * 60 * SLOW) };
}
// where the ball is on the screen at tt (0..1): from the release to the plate, the break coming late
function ballAt(pi, tt) {
  const e = Math.pow(tt, 1.75);
  const bk = Math.pow(tt, 2.6);
  const zx = pi.fx - pi.hx + pi.hx * bk, zy = pi.fy - pi.vy + pi.vy * bk;
  const end = zoneToScreen(zx, zy);
  const startY = RELEASE.y - 8;
  return { x: lerp(RELEASE.x, end.x, e), y: lerp(startY, end.y, e), r: 2 + 9 * tt * tt, zx, zy };
}
const inZone = (x, y) => Math.abs(x) <= 1.02 && Math.abs(y) <= 1.02;

export class Match {
  constructor(g, L, opts) {
    this.g = g; this.L = L; this.opts = opts;
    this.opaque = true;
    this.GS = newGame(L, opts.home, opts.away);
    this.mine = opts.home === L.myTeam ? 'home' : 'away';
    this.ph = 'intro'; this.t = 0; this.f = 0;
    this.cur = { x: 0, y: 0 }; this.aim = { x: 0, y: 0 }; this.sel = 0;
    this.pi = null; this.swing = null; this.msg = null; this.bip = null; this.menu = null; this.auto = null;
    this.night = (L.day % 3) !== 0;
    this.resolveCb = opts.done;
  }
  get myBat() { return battingSide(this.GS) === this.mine; }
  // ---------------------------------------------------------------- the 3D view (when the engine has a world)
  leave() { if (this.v3) { this.v3.destroy(); this.v3 = null; } }
  draw3d(world) {
    if (!this.v3) this.v3 = new MatchView(world, { night: this.night });
    const v = this.v3, GS = this.GS, L = this.L;
    v.board(GS, teamOf);
    if (this.ph === 'bip' && this.bip) { const B = this.bip; v.playBip({ j: B.j, bb: B.bb, tt: clamp(B.t / B.hang, 0, 1), t: B.t, hang: B.hang, f: this.f }); return; }
    if (world.mode !== 'catcher') world.setView('catcher');
    if (GS.over && this.ph === 'over') return;
    v.cast({ GS, L, lookOf, teamOf, fieldingSide, battingSide, pitcherOf, batterOf });
    const pitchT = this.ph === 'windup' ? (this.t / 46) * 0.7 : this.ph === 'flight' ? 0.7 + Math.min(1, this.t / 12) * 0.3 : null;
    let ball = null;
    if (this.ph === 'flight' && this.pi) ball = pitchPoint(this.pi, Math.min(1, this.t / this.pi.dur), v.pitLefty);
    else if (this.ph === 'call' && this.pi && (!this.msg || this.msg.text !== 'ファウル')) { const e = zoneField(this.pi.fx, this.pi.fy); ball = { x: e.x, y: e.y - 0.15, h: e.h }; }
    v.pose({ pitchT, swing: this.swingT(), f: this.f, ball, catchUp: this.ph === 'call' });
  }
  // how far the batter is through his swing (0..1), or null
  swingT() {
    if (this.swing && this.ph === 'flight') return clamp((this.t - this.swing.frame) / 9, 0, 1);
    if (this.swing && this.ph === 'call') return 1;
    if (!this.myBat && this.cpuSwing && this.ph === 'flight' && this.t >= (this.cpuSwing.at || 1e9)) return clamp((this.t - this.cpuSwing.at) / 9, 0, 1);
    if (!this.myBat && this.cpuSwing && this.ph === 'call') return 1;
    return null;
  }
  // a zone point on the screen (3D: projected from the plate), and the pixels per zone unit
  zs(zx, zy) {
    if (this.v3) { const p = zoneField(zx, zy); return this.g.world.project(p.x, p.y, p.h) || { x: -99, y: -99 }; }
    return zoneToScreen(zx, zy);
  }
  zk() { if (!this.v3) return { kx: ZONE.hw, ky: ZONE.hh }; const a = this.zs(0, 0), b = this.zs(1, 0), d = this.zs(0, 1); return { kx: b.x - a.x, ky: d.y - a.y }; }
  drawZone3(c) {
    const P = (x, y) => this.zs(x, y);
    const q = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
    c.save();
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.32)'; c.lineWidth = 1;
    for (const k of [-1 / 3, 1 / 3]) { let a = P(k, -1), b = P(k, 1); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); a = P(-1, k); b = P(1, k); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    c.restore();
  }
  set(ph) { this.ph = ph; this.t = 0; }
  // ---------------------------------------------------------------- flow
  startPA() {
    const GS = this.GS, L = this.L;
    if (GS.over) { this.finish(); return; }
    // the computer manages its own side; your tired pitcher is changed for you only when he is well past it
    const fs = fieldingSide(GS);
    if (fs !== this.mine) { const np = maybeChange(GS, L, fs); if (np) this.g.toast(`${teamOf(GS[fs]).short}：ピッチャー交代 ${pname(np)}`, '#ffd23f'); }
    else if (fatigue(GS, L, fs) > 1.45) { const np = maybeChange(GS, L, fs, true); if (np) this.g.toast(`ピッチャー交代：${pname(np)}（疲れが限界）`, '#ffd23f'); }
    this.set('pa');
  }
  nextPitch() {
    if (this.myBat) { this.pi = cpuPitch(this.GS, this.L); this.swing = null; this.set('windup'); }
    else { this.set('select'); }
  }
  throwPitch() {
    const p = pitcherOf(this.GS, this.L);
    const list = [{ t: 'st', lv: 0 }, ...p.pitches];
    this.pi = makePitch(this.GS, this.L, list[this.sel] || list[0], this.aim.x, this.aim.y);
    this.cpuSwing = this.cpuDecide(this.pi);
    this.set('windup');
  }
  cpuDecide(pi) {
    const GS = this.GS, bat = batterOf(GS, this.L);
    const z = inZone(pi.fx, pi.fy);
    const brk = pi.t === 'st' ? 0 : pi.lv * 0.022;
    const pSw = z ? 0.66 + (GS.strikes === 2 ? 0.18 : 0) - (GS.balls === 3 ? 0.12 : 0) : clamp(0.27 - bat.meet / 420 + (GS.strikes === 2 ? 0.16 : 0) + brk, 0.04, 0.6);
    if (Math.random() > pSw) return null;
    const nasty = (pi.kmh - 140) / 110 + brk * 1.3 + (Math.abs(pi.fx) + Math.abs(pi.fy)) / 6 + (z ? 0 : 0.22);
    const pc = clamp(0.8 + (bat.meet - 55) / 230 - nasty, 0.25, 0.95);
    if (Math.random() > pc) return { miss: true };
    if (Math.random() < 0.36) return { foul: true };
    const q = clamp(0.3 + Math.random() * 0.5 + (bat.meet - 55) / 200 + (z ? 0.1 : -0.1), 0.05, 1);
    return { q, dyN: gauss() * 0.42, e: gauss() * 4.5, win: 10, power: bat.power > 70 && Math.random() < 0.4 };
  }
  // the pitch reaches the plate
  resolvePitch() {
    const GS = this.GS, L = this.L, pi = this.pi;
    addPitches(GS, 1);
    const bat = batterOf(GS, L);
    let res;
    if (this.myBat) {
      const s = this.swing;
      if (!s) res = { call: inZone(pi.fx, pi.fy) ? 'strike' : 'ball' };
      else {
        const win = (8 + bat.meet / 20) * (s.power ? 0.72 : 1);
        const rx = (0.3 + bat.meet / 220) * (s.power ? 0.62 : 1), ry = rx * 0.82;
        const dx = (pi.fx - s.x) / rx, dy = (pi.fy - s.y) / ry, nd = dx * dx + dy * dy;
        const e = s.frame - pi.dur;
        if (nd > 1 || Math.abs(e) > win * 1.9) res = { call: 'miss' };
        else if (Math.abs(e) > win || nd > 0.82 && Math.random() < 0.5) res = { call: 'foul' };
        else res = { call: 'inplay', bb: battedBall({ bat, q: clamp(1 - Math.sqrt(nd) * 0.55 - (Math.abs(e) / win) * 0.45, 0, 1), dyN: dy, e, win, power: s.power, bal: balOf(L) }) };
      }
    } else {
      const d = this.cpuSwing;
      if (!d) res = { call: inZone(pi.fx, pi.fy) ? 'strike' : 'ball' };
      else if (d.miss) res = { call: 'miss' };
      else if (d.foul) res = { call: 'foul' };
      else res = { call: 'inplay', bb: battedBall({ bat, q: d.q, dyN: d.dyN, e: d.e, win: d.win, power: d.power, bal: balOf(L) }) };
    }
    if (res.call === 'inplay') {
      const j = judge(res.bb, GS, L);
      if (j.kind === 'FOUL') res = { call: 'foul', bb: res.bb, j };
      else { this.bip = { bb: res.bb, j, t: 0, hang: clamp(Math.round(30 + res.bb.dist * 0.7 + (res.bb.angle > 30 ? 30 : 0)), 34, 120) }; sound.sfx(j.kind === 'HR' || res.bb.v > 140 ? 'bighit' : 'hit'); this.set('bip'); return; }
    }
    const c = res.call;
    let word = '';
    if (c === 'ball') { GS.balls++; word = 'ボール'; sound.sfx('mitt'); }
    else if (c === 'strike') { GS.strikes++; word = 'ストライク'; sound.sfx('mitt'); }
    else if (c === 'miss') { GS.strikes++; word = '空振り'; sound.sfx('mitt'); }
    else if (c === 'foul') { if (GS.strikes < 2) GS.strikes++; word = 'ファウル'; sound.sfx('hit'); }
    this.msg = { text: word, col: c === 'ball' ? '#7af0a0' : c === 'foul' ? '#ffffff' : '#ffd23f' };
    this.set('call');
  }
  afterCall() {
    const GS = this.GS;
    if (GS.balls >= 4) { this.endPA({ kind: 'BB' }); return; }
    if (GS.strikes >= 3) { this.endPA({ kind: 'K' }); return; }
    this.nextPitch();
  }
  endPA(oc) {
    const GS = this.GS, inn = GS.inning, top = GS.top;
    const text = applyPA(GS, this.L, oc);
    this.msg = { text: text || '', col: '#ffffff', big: oc.kind === 'HR' };
    if (oc.kind === 'K') sound.sfx('out');
    this.changed = GS.over || GS.inning !== inn || GS.top !== top;
    this.set('result');
  }
  finish() {
    if (this.done) return;
    this.done = true;
    commitGame(this.GS, this.L);
    this.set('over');
    sound.sfx(this.GS.score[this.mine] > this.GS.score[this.mine === 'home' ? 'away' : 'home'] ? 'fanfare' : 'out');
  }
  // ---------------------------------------------------------------- auto play (the inning / the rest)
  runAuto() {
    const GS = this.GS, L = this.L;
    const inn = this.auto.inn;
    for (let i = 0; i < 2 && !GS.over; i++) {
      if (this.auto.mode === 'inning' && (GS.inning > inn)) { this.auto = null; this.g.toast('オート終了', '#7af0a0'); this.startPA(); return; }
      maybeChange(GS, L, fieldingSide(GS));
      const t = applyPA(GS, L, simPA(GS, L));
      this.autoLine = t;
    }
    if (GS.over) { this.auto = null; this.finish(); }
  }
  // ---------------------------------------------------------------- update
  update(g) {
    const inp = g.input;
    this.f++; this.t++;
    if (this.menu) { this.updateMenu(inp); return; }
    if (this.auto) { if (inp.pressed('start') || inp.pressed('b')) { this.auto = null; this.startPA(); return; } this.runAuto(); return; }
    if (inp.pressed('start') && this.ph !== 'over' && this.ph !== 'bip') { this.openMenu(); return; }
    switch (this.ph) {
      case 'intro': if (this.t > 90 || inp.pressed('a')) { sound.sfx('cheer'); this.startPA(); } break;
      case 'pa': if (this.t > 50 || inp.pressed('a')) this.nextPitch(); break;
      case 'select': {
        const list = [{ t: 'st' }, ...pitcherOf(this.GS, this.L).pitches];
        if (inp.rep('up') || inp.rep('left')) { this.sel = (this.sel - 1 + list.length) % list.length; sound.sfx('cursor'); }
        if (inp.rep('down') || inp.rep('right')) { this.sel = (this.sel + 1) % list.length; sound.sfx('cursor'); }
        if (inp.pressed('a')) { sound.sfx('ok'); this.set('aim'); }
        break;
      }
      case 'aim': {
        const sp = 0.045;
        if (inp.held('left')) this.aim.x = clamp(this.aim.x - sp, -1.6, 1.6);
        if (inp.held('right')) this.aim.x = clamp(this.aim.x + sp, -1.6, 1.6);
        if (inp.held('up')) this.aim.y = clamp(this.aim.y - sp, -1.6, 1.6);
        if (inp.held('down')) this.aim.y = clamp(this.aim.y + sp, -1.6, 1.6);
        if (inp.pressed('b')) { this.set('select'); break; }
        if (inp.pressed('a')) this.throwPitch();
        break;
      }
      case 'windup':
        if (this.myBat) this.moveCursor(inp);
        if (this.t >= 46) { this.set('flight'); this.trail = []; }
        break;
      case 'flight': {
        const pi = this.pi;
        if (this.myBat) {
          this.moveCursor(inp);
          if (!this.swing && (inp.pressed('a') || inp.pressed('b'))) { this.swing = { frame: this.t, x: this.cur.x, y: this.cur.y, power: inp.pressed('b') }; sound.sfx('swing'); }
        } else if (this.cpuSwing && !this.cpuSwing.at) { this.cpuSwing.at = pi.dur - 6; }
        const b = ballAt(pi, Math.min(1, this.t / pi.dur));
        this.trail.push([b.x, b.y, b.r * 0.7]); if (this.trail.length > 5) this.trail.shift();
        if (this.t >= pi.dur + (this.swing && this.swing.frame > pi.dur ? 0 : 0)) this.resolvePitch();
        break;
      }
      case 'call': if (this.t > 38 || (this.t > 10 && inp.pressed('a'))) this.afterCall(); break;
      case 'bip': {
        const B = this.bip; B.t++;
        if (B.t === B.hang) { const k = B.j.kind; this.msg = { text: KIND_TEXT[k] || '', col: ['1B', '2B', '3B', 'HR'].includes(k) ? '#ffd23f' : '#cfd8ee', big: k === 'HR' }; if (k === 'HR') sound.sfx('cheer'); else if (['GO', 'FO', 'LO', 'PO'].includes(k)) sound.sfx('out'); }
        if (B.t > B.hang + 55 || (B.t > B.hang + 12 && inp.pressed('a'))) { const j = B.j; this.bip = null; this.endPA({ kind: j.kind, where: j.where }); }
        break;
      }
      case 'result': if (this.t > (this.msg && this.msg.big ? 90 : 55) || (this.t > 14 && inp.pressed('a'))) { if (this.GS.over) this.finish(); else if (this.changed) this.set('change'); else this.startPA(); } break;
      case 'change': if (this.t > 70 || (this.t > 15 && inp.pressed('a'))) this.startPA(); break;
      case 'over': if (this.t > 30 && inp.pressed('a')) { this.g.pop(this); if (this.resolveCb) this.resolveCb(this.GS); } break;
      default: break;
    }
  }
  moveCursor(inp) {
    const sp = 0.06;
    if (inp.held('left')) this.cur.x = clamp(this.cur.x - sp, -1.5, 1.5);
    if (inp.held('right')) this.cur.x = clamp(this.cur.x + sp, -1.5, 1.5);
    if (inp.held('up')) this.cur.y = clamp(this.cur.y - sp, -1.5, 1.5);
    if (inp.held('down')) this.cur.y = clamp(this.cur.y + sp, -1.5, 1.5);
  }
  openMenu() {
    const items = [{ id: 'back', label: '試合にもどる' }, { id: 'inning', label: 'この回をオートで進める' }, { id: 'all', label: '試合終了までオート' }];
    const fs = fieldingSide(this.GS);
    if (fs === this.mine) items.push({ id: 'relief', label: '投手交代', sub: `いまの投手：${pname(pitcherOf(this.GS, this.L))}（疲れ ${Math.round(fatigue(this.GS, this.L, fs) * 100)}%）` });
    this.menu = { items, sel: 0, mode: 'main' };
    sound.sfx('ok');
  }
  updateMenu(inp) {
    const m = this.menu;
    if (inp.rep('up')) { m.sel = (m.sel - 1 + m.items.length) % m.items.length; sound.sfx('cursor'); }
    if (inp.rep('down')) { m.sel = (m.sel + 1) % m.items.length; sound.sfx('cursor'); }
    if (inp.pressed('b') || inp.pressed('start')) { if (m.mode === 'relief') { this.openMenu(); return; } this.menu = null; sound.sfx('cancel'); return; }
    if (inp.pressed('a')) this.pickMenu(m.items[m.sel]);
  }
  pickMenu(it) {
    const m = this.menu;
    if (!it) return;
    if (m.mode === 'relief') {
      if (it.id === 'cancel') { this.openMenu(); return; }
      const GS = this.GS, side = this.mine;
      GS.pit[side] = it.id; GS.used[side].push(it.id);
      this.menu = null; this.g.toast(`ピッチャー交代：${pname(this.L.P[it.id])}`, '#ffd23f'); sound.sfx('ok');
      if (this.ph === 'select' || this.ph === 'aim') this.sel = 0;
      return;
    }
    if (it.id === 'back') { this.menu = null; return; }
    if (it.id === 'inning' || it.id === 'all') { this.menu = null; this.auto = { mode: it.id, inn: this.GS.inning }; this.GS.balls = 0; this.GS.strikes = 0; sound.sfx('ok'); return; }
    if (it.id === 'relief') {
      const T = this.L.teams[this.GS[this.mine]];
      const avail = T.pen.concat(T.rotation).filter((id) => !this.GS.used[this.mine].includes(id));
      this.menu = { mode: 'relief', sel: 0, items: [...avail.slice(0, 7).map((id) => { const p = this.L.P[id]; return { id, label: pfull(p), sub: `${p.role === 'cl' ? '抑え' : p.role === 'sp' ? '先発' : '中継ぎ'}・${p.velo}km/h・コントロール${grade(p.control).g}・スタミナ${grade(p.stamina).g}${p.tired ? '・疲れあり' : ''}` }; }), { id: 'cancel', label: 'やめる' }] };
    }
  }
  onTap(x, y) {
    if (this.menu) { const i = (this.menuRects || []).findIndex((r) => inRect(x, y, r)); if (i >= 0) { this.menu.sel = i; this.pickMenu(this.menu.items[i]); } return; }
    // taps act as A (the pad is the way to move)
    this.g.input.press('a', 't'); setTimeout(() => this.g.input.release('a', 't'), 60);
  }

  // ================================================================ draw
  draw(c) {
    const GS = this.GS, L = this.L;
    const v3 = !!this.v3;
    if (this.ph === 'bip' && this.bip) { if (v3) this.drawBipInfo(c); else this.drawBip(c); }
    else {
      const bt = teamOf(GS[battingSide(GS)]), ft = teamOf(GS[fieldingSide(GS)]);
      const pit = pitcherOf(GS, L), bat = batterOf(GS, L);
      if (!v3) this.draw2dActors(c, bt, ft, pit, bat);
      else if (['select', 'aim', 'windup', 'flight', 'call', 'pa'].includes(this.ph)) this.drawZone3(c);
      if (this.ph === 'aim' || this.ph === 'select') { const a = this.zs(this.aim.x, this.aim.y); c.strokeStyle = '#7af0ff'; c.lineWidth = 3; c.beginPath(); c.arc(a.x, a.y, 14, 0, 7); c.stroke(); c.beginPath(); c.moveTo(a.x - 20, a.y); c.lineTo(a.x + 20, a.y); c.moveTo(a.x, a.y - 20); c.lineTo(a.x, a.y + 20); c.stroke(); }
      if (this.myBat && ['windup', 'flight', 'pa'].includes(this.ph)) {
        const k = this.zk(), rz = 0.3 + bat.meet / 220;
        const p = this.zs(this.cur.x, this.cur.y);
        const power = this.g.input.held('b') && !this.swing;
        drawCursor(c, p.x, p.y, rz * k.kx * (power ? 0.62 : 1), rz * 0.82 * k.ky * (power ? 0.62 : 1), power, this.f);
      }
      if (!v3 && this.ph === 'flight' && this.pi) { const b = ballAt(this.pi, Math.min(1, this.t / this.pi.dur)); drawBall(c, b.x, b.y, b.r, { trail: this.trail }); }
      if (this.ph === 'call' && this.pi) { const e = this.zs(this.pi.fx, this.pi.fy); if (!v3) drawBall(c, e.x, e.y, 9); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(e.x, e.y, 14, 0, 7); c.stroke(); }
      if ((this.ph === 'call' || this.ph === 'result') && this.pi) txt(c, `${this.pi.kmh}km/h　${this.pi.name}`, W - 22, 196, { size: 18, align: 'right', color: '#ffffff', stroke: 'rgba(0,0,0,0.7)', strokeW: 5 });
      this.drawHud(c, bat, pit);
    }
    this.drawTop(c);
  }
  // the 2D pictures (no WebGL)
  draw2dActors(c, bt, ft, pit, bat) {
      const GS = this.GS;
      drawBattingView(c, this.f, { night: this.night, c1: ft.c1, c2: bt.c1, cheer: this.ph === 'result' });
      // the pitcher
      const pt = this.ph === 'windup' ? this.t / 46 * 0.45 : this.ph === 'flight' ? 0.45 + Math.min(1, this.t / 10) * 0.55 : 0;
      drawChibi(c, 482, 232, 0.78, lookOf(pit, GS[fieldingSide(GS)]), this.ph === 'windup' || this.ph === 'flight' ? 'pitch' : 'stand', pt, { flip: pit.throws === 'L', glove: true, away: fieldingSide(GS) === 'away' });
      // the zone, the aim, the cursor, the ball
      const showZone = ['select', 'aim', 'windup', 'flight', 'call', 'pa'].includes(this.ph);
      if (showZone) drawZone(c);
      // the batter (from behind)
      const left = bat.bats !== 'L';
      const sw = this.swing && this.ph === 'flight' ? clamp((this.t - this.swing.frame) / 9, 0, 1) : this.swing && this.ph === 'call' ? 1 : 0;
      const csw = !this.myBat && this.cpuSwing && this.ph === 'flight' && this.t >= (this.cpuSwing.at || 1e9) ? clamp((this.t - this.cpuSwing.at) / 9, 0, 1) : 0;
      drawChibi(c, left ? 398 : 562, 512, 1.75, lookOf(bat, GS[battingSide(GS)]), sw || csw ? 'swing' : 'ready', sw || csw || this.f / 60, { view: 'back', flip: !left, helmet: true, away: battingSide(GS) === 'away' });
  }
  // the scoreboard, the messages, the menus (both views)
  drawTop(c) {
    const GS = this.GS, L = this.L;
    drawScoreboard(c, GS);
    // the messages
    if (this.ph === 'call' && this.msg) txt(c, this.msg.text, W / 2, 150, { size: 40, align: 'center', color: this.msg.col, stroke: 'rgba(0,0,0,0.75)', strokeW: 8 });
    if ((this.ph === 'result' || (this.ph === 'bip' && this.bip && this.bip.t >= this.bip.hang)) && this.msg) {
      const big = this.msg.big;
      const k = Math.min(1, this.t / 10);
      c.save(); c.translate(W / 2, big ? 190 : 150); c.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      txt(c, this.msg.text, 0, 0, { size: big ? 56 : 34, align: 'center', color: big ? '#ffd23f' : this.msg.col, stroke: 'rgba(0,0,0,0.8)', strokeW: big ? 10 : 7 });
      c.restore();
    }
    if (this.ph === 'intro') this.banner(c, 'プレイボール！', `${teamOf(GS.away).full} 対 ${teamOf(GS.home).full}`);
    if (this.ph === 'change') this.banner(c, GS.top ? `${GS.inning}回表` : `${GS.inning}回裏`, `攻撃：${teamOf(GS[battingSide(GS)]).full}`);
    if (this.ph === 'pa') { const b = batterOf(GS, L); txt(c, `${GS.idx[battingSide(GS)] % 9 + 1}番　${posShort(GS.lineup[battingSide(GS)] && this.L.teams[GS[battingSide(GS)]].pos ? this.L.teams[GS[battingSide(GS)]].pos[b.id] || b.pos : b.pos)}　${pfull(b)}`, W / 2, 140, { size: 30, align: 'center', stroke: 'rgba(0,0,0,0.75)', strokeW: 7 }); }
    if (this.ph === 'select' || this.ph === 'aim') this.drawPitchPanel(c);
    if (this.myBat && (this.ph === 'windup' || this.ph === 'flight') && this.t < 40 && this.GS.balls + this.GS.strikes === 0) txt(c, '十字キーでカーソル　A：ミート打ち　B：強振', W / 2, H - 16, { size: 14, align: 'center', color: 'rgba(255,255,255,0.75)' });
    if (this.auto) { panel(c, 250, 210, 460, 120); txt(c, this.auto.mode === 'all' ? '試合終了までオート中…' : 'この回をオート中…', W / 2, 245, { size: 22, align: 'center', color: '#ffd23f' }); txt(c, this.autoLine || '', W / 2, 285, { size: 16, align: 'center', max: 420 }); txt(c, 'B / START で止める', W / 2, 314, { size: 12, align: 'center', color: '#9fb6e8' }); }
    if (this.ph === 'over') this.drawOver(c);
    if (this.menu) this.drawMenu(c);
  }
  banner(c, a, b) {
    const k = Math.min(1, this.t / 12);
    c.fillStyle = `rgba(6,12,30,${0.7 * k})`; c.fillRect(0, 200, W, 120);
    txt(c, a, W / 2 - (1 - k) * 200, 245, { size: 44, align: 'center', color: '#ffd23f', stroke: '#1a1206', strokeW: 6 });
    txt(c, b, W / 2, 292, { size: 18, align: 'center', color: '#ffffff' });
  }
  drawHud(c, bat, pit) {
    const GS = this.GS, L = this.L;
    // the batter card (bottom left)
    panel(c, 14, H - 124, 290, 110, { r: 12 });
    const bs = bat.s || {};
    txt(c, `${pfull(bat)}`, 28, H - 104, { size: 18, max: 170 });
    txt(c, `${bat.bats === 'L' ? '左打' : '右打'}　打率${fmt3(avg(bs))}　${bs.hr || 0}本`, 28, H - 80, { size: 13, color: '#cfd8ee', bold: false });
    badge(c, 26, H - 66, bat.meet, 'ミート', { w: 86 }); badge(c, 116, H - 66, bat.power, 'パワー', { w: 86 }); badge(c, 206, H - 66, bat.speed, '走力', { w: 86 });
    const g0 = GS.box[bat.id];
    txt(c, g0 ? `今日 ${g0.ab}打数${g0.h}安打${g0.rbi ? ` ${g0.rbi}打点` : ''}` : '今日 第1打席', 28, H - 30, { size: 12, color: '#9fb6e8', bold: false });
    // the pitcher card (top right)
    panel(c, W - 274, 12, 260, 92, { r: 12 });
    txt(c, pfull(pit), W - 260, 32, { size: 17, max: 160 });
    txt(c, `${pit.throws === 'L' ? '左' : '右'}投　最速${pit.velo}km/h`, W - 260, 54, { size: 12, color: '#cfd8ee', bold: false });
    const fs = fieldingSide(GS), fat = clamp(1 - fatigue(GS, L, fs), 0, 1);
    txt(c, 'スタミナ', W - 260, 78, { size: 11, color: '#cfd8ee', bold: false });
    c.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(c, W - 200, 72, 120, 10, 5); c.fill();
    c.fillStyle = fat > 0.5 ? '#5ee07a' : fat > 0.2 ? '#ffd23f' : '#ff5a5a'; roundRect(c, W - 200, 72, 120 * fat, 10, 5); c.fill();
    txt(c, `${(GS.pbox[pit.id] || { pc: 0 }).pc}球`, W - 30, 78, { size: 12, align: 'right', color: '#cfd8ee', bold: false });
    // the next batters
    const nb = nextBatters(GS, L, 3).slice(1);
    txt(c, `次：${nb.map((p) => pname(p)).join('・')}`, W - 20, H - 22, { size: 12, color: 'rgba(255,255,255,0.7)', bold: false, align: 'right' });
  }
  drawPitchPanel(c) {
    const p = pitcherOf(this.GS, this.L);
    const list = [{ t: 'st', lv: 0 }, ...p.pitches];
    panel(c, W - 196, 118, 182, 40 + list.length * 32, { r: 12 });
    txt(c, this.ph === 'select' ? '球種をえらぶ' : 'コースを決めて A', W - 186, 136, { size: 13, color: '#ffd23f' });
    list.forEach((x, i) => pitchChip(c, W - 186, 152 + i * 32, x, { on: i === this.sel, w: 162 }));
    txt(c, this.ph === 'select' ? '↑↓ 球種　A 決定' : '十字キー コース　A 投げる　B もどる', W / 2, H - 16, { size: 14, align: 'center', color: 'rgba(255,255,255,0.8)' });
  }
  // the batted ball on the 3D field: just the numbers (the field itself is 3D)
  drawBipInfo(c) {
    const bb = this.bip.bb;
    txt(c, `打球速度 ${Math.round(bb.v)}km/h　角度 ${Math.round(bb.angle)}°　飛距離 ${Math.round(bb.dist)}m`, W / 2, H - 16, { size: 13, align: 'center', color: '#ffffff', stroke: 'rgba(0,0,0,0.6)', strokeW: 4 });
  }
  drawBip(c) {
    const B = this.bip, GS = this.GS, L = this.L;
    drawField(c, { night: this.night });
    const tt = clamp(B.t / B.hang, 0, 1);
    const j = B.j, bb = B.bb;
    const lx = j.land.x, ly = j.land.y;
    // the fielders (the defending club) run toward the ball; the nearest catches it
    const fside = fieldingSide(GS), ft = GS[fside];
    const tlook = (pos) => lookOf({ num: pos.length * 7 }, ft, { away: fside === 'away' });
    let nearest = null, nd = 1e9;
    for (const [pos, [fx, fy]] of Object.entries(FIELDER_SPOTS)) { const d = Math.hypot(fx - lx, fy - ly); if (d < nd) { nd = d; nearest = pos; } }
    for (const [pos, [fx, fy]] of Object.entries(FIELDER_SPOTS)) {
      let x = fx, y = fy;
      if (pos === nearest && j.kind !== 'HR') { const k = clamp(tt * 1.15, 0, 1); x = lerp(fx, lx, k * (['GO', 'FO', 'LO', 'PO'].includes(j.kind) ? 1 : 0.8)); y = lerp(fy, ly, k * (['GO', 'FO', 'LO', 'PO'].includes(j.kind) ? 1 : 0.8)); }
      const p = fieldToScreen(x, y);
      drawChibi(c, p.x, p.y, 0.42, tlook(pos), pos === nearest && tt < 1 ? 'run' : 'stand', this.f / 20, { glove: true, away: fside === 'away' });
    }
    // the batter runs to first
    const runK = clamp(B.t / 70, 0, 1);
    const rp = fieldToScreen(lerp(0, 19.4, runK), lerp(0, 19.4, runK));
    const bat = batterOf(GS, L);
    drawChibi(c, rp.x, rp.y, 0.42, lookOf(bat, GS[battingSide(GS)], { away: battingSide(GS) === 'away' }), 'run', this.f / 12, { helmet: true });
    // the ball and its shadow
    const gx = lerp(0, lx, tt), gy = lerp(0, ly, tt);
    const hmax = j.ground ? 0 : bb.dist * Math.tan((clamp(bb.angle, 0, 70) * Math.PI) / 180) * 0.25 + 4;
    const h = 4 * hmax * tt * (1 - tt);
    const sp = fieldToScreen(gx, gy);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(sp.x, sp.y, 5, 2.5, 0, 0, 7); c.fill();
    drawBall(c, sp.x, sp.y - h * 3, 4 + h * 0.04);
    if (tt >= 1) { const p = fieldToScreen(lx, ly); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 12, 0, 7); c.stroke(); }
    txt(c, `打球速度 ${Math.round(bb.v)}km/h　角度 ${Math.round(bb.angle)}°　飛距離 ${Math.round(bb.dist)}m`, W / 2, H - 16, { size: 13, align: 'center', color: 'rgba(255,255,255,0.8)' });
  }
  drawOver(c) {
    const GS = this.GS, L = this.L;
    c.fillStyle = 'rgba(4,8,20,0.82)'; c.fillRect(0, 0, W, H);
    panel(c, 150, 60, 660, 420);
    const my = GS.score[this.mine], op = GS.score[this.mine === 'home' ? 'away' : 'home'];
    txt(c, GS.draw ? '引き分け' : my > op ? 'ゲームセット　勝利！' : 'ゲームセット　敗戦…', W / 2, 104, { size: 34, align: 'center', color: my > op ? '#ffd23f' : '#cfd8ee' });
    // the line score
    const inns = Math.max(9, GS.line.away.length);
    const x0 = 190, cw = Math.min(36, 420 / inns);
    txt(c, '', x0, 150);
    for (let i = 0; i < inns; i++) txt(c, String(i + 1), x0 + 120 + i * cw, 150, { size: 13, align: 'center', color: '#9fb6e8' });
    txt(c, 'R', x0 + 130 + inns * cw, 150, { size: 13, align: 'center', color: '#ffd23f' }); txt(c, 'H', x0 + 160 + inns * cw, 150, { size: 13, align: 'center', color: '#9fb6e8' });
    [['away', GS.away], ['home', GS.home]].forEach(([s, id], r) => {
      const y = 182 + r * 34;
      const t = teamOf(id);
      c.fillStyle = t.c1; roundRect(c, x0, y - 13, 100, 26, 6); c.fill(); txt(c, t.short, x0 + 50, y, { size: 14, align: 'center' });
      for (let i = 0; i < inns; i++) { const v = GS.line[s][i]; txt(c, v === undefined ? '' : String(v), x0 + 120 + i * cw, y, { size: 16, align: 'center' }); }
      txt(c, String(GS.score[s]), x0 + 130 + inns * cw, y, { size: 20, align: 'center', color: '#ffd23f' });
      const hits = Object.entries(GS.box).filter(([id2]) => GS.lineup[s].includes(id2)).reduce((a, [, b]) => a + b.h, 0);
      txt(c, String(hits), x0 + 160 + inns * cw, y, { size: 16, align: 'center' });
    });
    const d = GS.dec;
    const line = [d.win ? `勝：${pname(L.P[d.win])}` : '', d.lose ? `負：${pname(L.P[d.lose])}` : '', d.save ? `S：${pname(L.P[d.save])}` : ''].filter(Boolean).join('　');
    txt(c, line || '（勝敗なし）', W / 2, 270, { size: 18, align: 'center' });
    // the home runs
    const hrs = Object.entries(GS.box).filter(([, b]) => b.hr > 0).map(([id, b]) => `${pname(L.P[id])}${b.hr > 1 ? `（${b.hr}本）` : ''}`);
    txt(c, hrs.length ? `本塁打：${hrs.join('、')}` : '本塁打：なし', W / 2, 306, { size: 15, align: 'center', color: '#cfd8ee', max: 600 });
    // your club's top hitter today
    const mineIds = GS.lineup[this.mine];
    const best = mineIds.map((id) => [id, GS.box[id] || { h: 0, rbi: 0, ab: 0 }]).sort((a, b) => b[1].h * 2 + b[1].rbi - (a[1].h * 2 + a[1].rbi))[0];
    if (best && best[1].h) txt(c, `今日のヒーロー：${pfull(L.P[best[0]])}（${best[1].ab}打数${best[1].h}安打${best[1].rbi ? ` ${best[1].rbi}打点` : ''}）`, W / 2, 340, { size: 15, align: 'center', color: '#ffd23f', max: 600 });
    txt(c, 'A で次へ', W / 2, 440, { size: 16, align: 'center', color: '#9fb6e8' });
  }
  drawMenu(c) {
    const m = this.menu;
    c.fillStyle = 'rgba(4,8,20,0.6)'; c.fillRect(0, 0, W, H);
    const h = 60 + m.items.length * 52;
    panel(c, 260, (H - h) / 2, 440, h);
    txt(c, m.mode === 'relief' ? '投手交代' : 'メニュー', 280, (H - h) / 2 + 26, { size: 18, color: '#ffd23f' });
    this.menuRects = menuList(c, 276, (H - h) / 2 + 46, 408, m.items, m.sel, { rowH: 52 });
  }
}
