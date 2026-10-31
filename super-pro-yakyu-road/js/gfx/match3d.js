// スーパープロ野球ロード 3D — the match on the 3D field: the actors (the pitcher on the mound, the batter in the box, the
// catcher, the seven fielders, the runners on base), the ball and its shadow, the pitch in flight (a real arc: the drop of
// gravity for its speed plus the late break of the pitch), the strike zone in metres, and the batted ball seen from the
// broadcast camera. The scene (match.js) keeps the rules; this file only shows them.
import * as THREE from '../vendor/three.module.min.js';
import { V, BASES, MOUND } from './stadium.js';
import { Player3D } from './player3d.js';
import { HOME_SPOTS, pathAt, ballAt } from '../play.js';

// the strike zone at the plate, in metres (half width with the ball's radius, centre height, half height) for these
// chibi batters; zone coords (zx, zy) are -1..1 across it, +zy is low
export const Z3 = { hw: 0.27, cy: 0.74, hh: 0.3, y: 0.1 };
export const zoneField = (zx, zy) => ({ x: zx * Z3.hw, y: Z3.y, h: Z3.cy - zy * Z3.hh });
export const MOUND_H = 0.245;
export const SPOTS = Object.fromEntries(['1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'].map((k) => [k, HOME_SPOTS[k]]));
const BASE_LIST = [BASES.first, BASES.second, BASES.third, BASES.home];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// where the pitched ball is at tt (0 release .. 1 the plate). The break comes late (tt^2.6, as the 2D game) and the arc is
// the gravity drop for the real flight time (T = 18.44 m / speed): the chord bulges by g T^2 / 8.
export function pitchPoint(pi, tt, throwsL) {
  const bk = Math.pow(tt, 2.6);
  const zx = pi.fx - pi.hx + pi.hx * bk, zy = pi.fy - pi.vy + pi.vy * bk;
  const E = zoneField(zx, zy);
  const R = { x: throwsL ? 0.55 : -0.55, y: MOUND[1] - 1.4, h: MOUND_H + 1.75 };
  const T = 17 / (pi.kmh / 3.6);
  const arc = (9.8 * T * T) / 8;
  return { x: lerp(R.x, E.x, tt), y: lerp(R.y, E.y, tt), h: lerp(R.h, E.h, tt) + arc * 4 * tt * (1 - tt), zx, zy };
}

// see-through (the catcher in front of the zone): swap each mesh's material for a faded copy, and back
const ghosts = new Map();
function ghost(p, on) {
  if (p.ghost === on) return;
  p.ghost = on;
  p.root.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      o.userData.mat = o.material;
      if (!ghosts.has(o.material)) { const m = o.material.clone(); m.transparent = true; m.opacity = o.material.side === THREE.BackSide ? 0.12 : 0.3; m.depthWrite = false; ghosts.set(o.material, m); }
      o.material = ghosts.get(o.material); o.castShadow = false;
    } else if (o.userData.mat) { o.material = o.userData.mat; o.castShadow = true; }
  });
}
function disposeActor(p) { p.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); p.root.removeFromParent(); }

export class MatchView {
  constructor(world, o = {}) {
    this.w = world;
    if (!!o.night !== world.night) world.build({ night: !!o.night });
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.slots = {};
    const ballGeo = new THREE.SphereGeometry(0.075, 18, 12);
    this.ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 24), new THREE.MeshBasicMaterial({ color: 0xd8383a }));
    seam.rotation.x = 1.1; this.ball.add(seam);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.11, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.group.add(this.ball, this.shadow);
    this.showBall(null);
    this.boardKey = '';
    world.setView('catcher');
  }
  destroy() {
    for (const k of Object.keys(this.slots)) disposeActor(this.slots[k].p);
    this.slots = {};
    this.group.removeFromParent();
    this.w.drawBoard({});
  }
  // an actor in a slot, rebuilt only when its look changes
  actor(slot, look) {
    const key = JSON.stringify(look);
    const a = this.slots[slot];
    if (a && a.key === key) { a.p.root.visible = true; return a.p; }
    if (a) disposeActor(a.p);
    const p = new Player3D(look);
    this.group.add(p.root);
    this.slots[slot] = { key, p };
    return p;
  }
  hide(slot) { const a = this.slots[slot]; if (a) a.p.root.visible = false; }
  showBall(pt, o = {}) {
    if (!pt) { this.ball.visible = false; this.shadow.visible = false; return; }
    this.ball.visible = true; this.shadow.visible = o.shadow !== false;
    this.ball.position.copy(V(pt.x, pt.y, pt.h));
    this.ball.rotation.y += 0.6; this.ball.rotation.z += 0.35;
    this.shadow.position.copy(V(pt.x, pt.y, (o.ground || 0) + 0.015));
    const k = clamp(1 - pt.h / 40, 0.35, 1); this.shadow.scale.setScalar(0.8 + (1 - k) * 2); this.shadow.material.opacity = 0.32 * k;
  }
  // the board over center field, redrawn when the score or the count changes
  board(GS, teamOf) {
    const key = `${GS.score.away}-${GS.score.home}-${GS.line.away.join(',')}|${GS.line.home.join(',')}-${GS.balls}${GS.strikes}${GS.outs}`;
    if (key === this.boardKey) return;
    this.boardKey = key;
    this.w.drawBoard({ away: teamOf(GS.away).short, home: teamOf(GS.home).short, line: GS.line, score: GS.score, b: GS.balls, s: GS.strikes, o: GS.outs });
  }
  // the standing cast for this pitch: s = { GS, L, lookOf, teamOf, fieldingSide, battingSide, pitcherOf, batterOf, f }
  cast(s) {
    const { GS, L, lookOf } = s;
    const fs = s.fieldingSide(GS), bs = s.battingSide(GS);
    const ft = GS[fs], bt = GS[bs];
    const pit = s.pitcherOf(GS, L), bat = s.batterOf(GS, L);
    this.pit = this.actor('P', { ...lookOf(pit, ft), away: fs === 'away', lefty: pit.throws === 'L', gear: 'glove' });
    this.pit.setPos(MOUND[0], MOUND[1], MOUND_H); this.pit.face(0, 0);
    const lefty = bat.bats === 'L';
    this.bat = this.actor('B', { ...lookOf(bat, bt), away: bs === 'away', lefty, helmet: true, gear: 'bat' });
    this.bat.setPos(lefty ? 0.95 : -0.95, 0.05); this.bat.face(lefty ? -0.5 : 0.5, 0.05);
    if (this.bat.gear !== 'bat') this.bat.setGear('bat');
    this.batLefty = lefty; this.pitLefty = pit.throws === 'L'; this.batId = bat.id;
    // the fielders by their positions in today's lineup
    const T = L.teams[ft], byPos = {};
    for (const id of GS.lineup[fs]) { const pos = (T.pos && T.pos[id]) || L.P[id].pos; byPos[pos] = L.P[id]; }
    const cat = byPos.C;
    this.cat = this.actor('C', { ...lookOf(cat, ft), away: fs === 'away', gear: 'glove' });
    this.cat.setPos(0, -1.2); this.cat.face(0, 18);
    ghost(this.cat, true); this.bipInit = false;
    this.fielders = {};
    for (const [pos, [x, y]] of Object.entries(SPOTS)) {
      const p = this.actor(pos, { ...lookOf(byPos[pos] || { num: pos.length * 7 }, ft), away: fs === 'away', gear: 'glove', lefty: false });
      p.setPos(x, y); p.face(0, 4);
      this.fielders[pos] = { p, x, y, hx: x, hy: y };
    }
    // the runners lead off their bases
    this.runners = [];
    for (let i = 0; i < 3; i++) {
      const id = GS.bases[i];
      if (!id) { this.hide(`R${i}`); continue; }
      const r = this.actor(`R${i}`, { ...lookOf(L.P[id], bt), away: bs === 'away', helmet: true, gear: 'none' });
      const [ax, ay] = BASE_LIST[i], [bx, by] = BASE_LIST[i + 1];
      const d = Math.hypot(bx - ax, by - ay), k = 2.4 / d;
      r.setPos(ax + (bx - ax) * k, ay + (by - ay) * k); r.face(0, 18);
      this.runners.push({ p: r, i, id, x: ax + (bx - ax) * k, y: ay + (by - ay) * k });
    }
  }
  // the batting / pitching view each frame: o = { pitchT (0..1 the delivery, null = set), swing (0..1 or null), f, ball: pt|null }
  pose(o) {
    const f = o.f || 0;
    this.pit.pose(o.pitchT == null ? 'stand' : 'windup', o.pitchT || 0);
    if (o.swing != null) this.bat.pose('swing', o.swing); else this.bat.pose('stance', f / 60);
    this.cat.pose('crouch', 0);
    if (o.catchUp) this.cat.armL.sh.rotation.x = -1.7;
    for (const k of Object.keys(this.fielders)) { const F = this.fielders[k]; F.p.setPos(F.hx, F.hy); F.p.face(0, 4); F.p.pose('ready', 0); F.p.body.position.y += Math.sin(f * 0.05 + F.hx) * 0.01; }
    for (const R of this.runners) { R.p.setPos(R.x, R.y); R.p.face(0, 18); R.p.pose('ready', 0); }
    this.showBall(o.ball || null, { shadow: !!o.ball });
  }
  // a ball in play, played back from the physics timeline (play.js): o = { T, bb, t (seconds since contact), f }
  playBip(o) {
    const { T, t } = o;
    if (!this.bipInit) { // the bat is dropped, the catcher stands up and is solid again
      this.bipInit = true;
      ghost(this.cat, false);
    }
    const b = ballAt(T, t);
    this.lastBall = b;
    this.showBall({ x: b[0], y: b[1], h: Math.max(0.07, b[2]) });
    // the fielders along their paths: running while they move, the catch, the throw
    const F = { ...this.fielders, P: { p: this.pit }, C: { p: this.cat } };
    for (const [pos, plan] of Object.entries(T.fielders)) {
      const A = F[pos] && F[pos].p; if (!A) continue;
      const q = pathAt(plan.path, t), q2 = pathAt(plan.path, t + 0.1);
      A.setPos(q[0], q[1], pos === 'P' && Math.hypot(q[0], q[1] - MOUND[1]) < 2.5 ? MOUND_H : 0);
      const moving = Math.hypot(q2[0] - q[0], q2[1] - q[1]) > 0.02;
      const myThrow = T.throws.find((th) => Math.hypot(th.from[0] - q[0], th.from[1] - q[1]) < 1.5 && t > th.t0 - 0.3 && t < th.t0 + 0.25 && !th.walk);
      const gets = T.throws.find((th) => Math.hypot(th.to[0] - q[0], th.to[1] - q[1]) < 2.5 && t > th.t1 - 0.35 && t < th.t1 + 0.4);
      if (myThrow) { A.face(myThrow.to[0], myThrow.to[1]); A.pose('throw', clamp((t - (myThrow.t0 - 0.3)) / 0.45, 0, 1)); }
      else if (moving) { A.face(q2[0], q2[1]); A.pose('run', t * 1.6 + q[0] * 0.1); }
      else if (gets || (pos === T.who && T.at && Math.abs(t - T.at.t) < 0.35)) { A.face(b[0], b[1]); A.pose(T.at && T.at.air && pos === T.who && !gets ? 'catch' : 'ready', 0); }
      else { A.face(b[0], b[1]); A.pose('ready', 0); }
    }
    // the runners (and the batter) along their paths; an out runner stops and walks off
    for (const R of T.runners) {
      const A = R.id === this.batId ? this.bat : (this.runners.find((x) => x.id === R.id) || {}).p;
      if (!A) continue;
      if (A === this.bat && A.gear !== 'none') A.setGear('none');
      const q = pathAt(R.path, t), q2 = pathAt(R.path, t + 0.08);
      A.setPos(q[0], q[1]);
      const moving = Math.hypot(q2[0] - q[0], q2[1] - q[1]) > 0.01;
      if (R.out != null && t > R.out) { A.face(0, -10); A.pose('stand', 0); }
      else if (moving) { A.face(q2[0], q2[1]); A.pose('run', t * 1.9); }
      else if (A === this.bat && t < 0.6) A.pose('swing', 1);
      else { A.face(0, 18); A.pose('stand', 0); }
    }
    // the camera: up behind home, turning to keep the ball (and the play around it) in the frame
    // the camera: behind the play and closing in — it follows the ball and, as a fly comes down, turns toward the spot
    // where it will be caught, so the fielder and the ball meet in the frame
    const bx = b[0], by = b[1], bh = Math.max(0, b[2]);
    let fx = bx, fy = by;
    if (T.at && t < T.at.t) { const k = Math.pow(clamp(t / T.at.t, 0, 1), 1.4) * 0.65; fx = lerp(bx, T.at.x, k); fy = lerp(by, T.at.y, k); }
    const r = Math.max(1, Math.hypot(fx, fy - 6)), ux = fx / r, uy = (fy - 6) / r;
    const D = clamp(26 + r * 0.18, 26, 44);
    const look = { x: fx, y: Math.max(6, fy), h: Math.min(bh, 36) * 0.7 };
    const from = { x: fx - ux * D, y: Math.max(6, fy) - uy * D, h: 11 + r * 0.06 + Math.min(bh, 40) * 0.3 };
    const dt = Math.max(0, t - (this.camT == null || t < this.camT ? t : this.camT)); this.camT = t;
    this.w.follow(from, look, 36, t < 0.05 ? 1 : 1 - Math.pow(0.88, dt * 60));
  }
}
