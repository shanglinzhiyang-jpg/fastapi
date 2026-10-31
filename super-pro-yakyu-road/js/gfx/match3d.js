// スーパープロ野球ロード 3D — the match on the 3D field: the actors (the pitcher on the mound, the batter in the box, the
// catcher, the seven fielders, the runners on base), the ball and its shadow, the pitch in flight (a real arc: the drop of
// gravity for its speed plus the late break of the pitch), the strike zone in metres, and the batted ball seen from the
// broadcast camera. The scene (match.js) keeps the rules; this file only shows them.
import * as THREE from '../vendor/three.module.min.js';
import { V, BASES, MOUND } from './stadium.js';
import { Player3D } from './player3d.js';

// the strike zone at the plate, in metres (half width with the ball's radius, centre height, half height) for these
// chibi batters; zone coords (zx, zy) are -1..1 across it, +zy is low
export const Z3 = { hw: 0.27, cy: 0.74, hh: 0.3, y: 0.1 };
export const zoneField = (zx, zy) => ({ x: zx * Z3.hw, y: Z3.y, h: Z3.cy - zy * Z3.hh });
export const MOUND_H = 0.245;
export const SPOTS = { '1B': [17.5, 25], '2B': [9, 35], SS: [-9, 35], '3B': [-17.5, 24], LF: [-33, 76], CF: [0, 90], RF: [33, 76] };
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
    this.batLefty = lefty; this.pitLefty = pit.throws === 'L';
    // the fielders by their positions in today's lineup
    const T = L.teams[ft], byPos = {};
    for (const id of GS.lineup[fs]) { const pos = (T.pos && T.pos[id]) || L.P[id].pos; byPos[pos] = L.P[id]; }
    const cat = byPos.C;
    this.cat = this.actor('C', { ...lookOf(cat, ft), away: fs === 'away', gear: 'glove' });
    this.cat.setPos(0, -1.2); this.cat.face(0, 18);
    ghost(this.cat, true);
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
      this.runners.push({ p: r, i, x: ax + (bx - ax) * k, y: ay + (by - ay) * k });
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
  // the batted ball, the broadcast camera following it: o = { tt (0..1 to landing), j (the judged result), bb, f, t (frames) }
  playBip(o) {
    const { j, bb, tt, t } = o;
    const lx = j.land.x, ly = j.land.y;
    const ground = !!j.ground;
    // the ball: a parabola to the landing spot (grounders skip along the ground)
    let bx = lerp(0, lx, tt), by = lerp(0.4, ly, tt), bh;
    if (ground) bh = 0.07 + Math.abs(Math.sin(tt * Math.PI * 3)) * (1 - tt) * 1.2;
    else { const apex = (j.land.d * Math.tan((clamp(bb.angle, 2, 75) * Math.PI) / 180)) / 4; bh = 0.9 + apex * 4 * tt * (1 - tt) - 0.9 * tt; }
    if (tt >= 1 && j.kind !== 'HR') { // after the landing: caught, or it rolls on a little
      if (['GO', 'FO', 'LO', 'PO', 'DP'].includes(j.kind)) bh = 1.2;
      else { const k = Math.min(1, (t - o.hang) / 40); bx = lx + Math.sin((j.land.deg * Math.PI) / 180) * 6 * k; by = ly + Math.cos((j.land.deg * Math.PI) / 180) * 6 * k; bh = 0.07; }
    }
    this.showBall({ x: bx, y: by, h: Math.max(0.07, bh) });
    // the nearest fielder runs to the ball; on an out he catches it
    let near = null, nd = 1e9;
    for (const [k, F] of Object.entries(this.fielders)) { const d = Math.hypot(F.hx - lx, F.hy - ly); if (d < nd) { nd = d; near = k; } }
    const out = ['GO', 'FO', 'LO', 'PO', 'DP'].includes(j.kind);
    for (const [k, F] of Object.entries(this.fielders)) {
      if (k === near && j.kind !== 'HR') {
        const kk = clamp(tt * 1.12, 0, 1) * (out ? 1 : 0.85);
        const x = lerp(F.hx, lx, kk), y = lerp(F.hy, ly, kk);
        F.p.setPos(x, y);
        if (kk < 1 && nd > 1.5) { F.p.face(lx, ly); F.p.pose('run', t / 22); } else { F.p.face(0, 4); F.p.pose(out ? 'catch' : 'ready', 0); }
      } else { F.p.setPos(F.hx, F.hy); F.p.face(bx, by); F.p.pose('ready', 0); }
    }
    // the batter runs to first, the runners move up on a hit
    const run = Math.min(1, t / 230);
    const bxs = this.batLefty ? 0.95 : -0.95;
    this.bat.setGear('none'); this.bat.setHelmet(true);
    this.bat.setPos(lerp(bxs, BASES.first[0], run), lerp(0, BASES.first[1], run)); this.bat.face(BASES.first[0], BASES.first[1]); this.bat.pose(run < 1 ? 'run' : 'stand', t / 16);
    const hit = ['1B', '2B', '3B', 'HR'].includes(j.kind);
    for (const R of this.runners) {
      const k = hit ? Math.min(1, t / 230) : 0;
      const [ax, ay] = BASE_LIST[R.i + 1];
      R.p.setPos(lerp(R.x, ax, k), lerp(R.y, ay, k)); R.p.face(ax, ay); R.p.pose(k > 0 && k < 1 ? 'run' : 'ready', t / 16);
    }
    this.pit.pose('ready', 0); this.pit.face(bx, by);
    this.cat.pose('stand', 0); ghost(this.cat, false);
    // the camera: up behind home, turning to keep the ball and the play in the frame
    const look = { x: bx * 0.8, y: Math.max(14, by * 0.8), h: Math.min(bh, 12) * 0.5 };
    const from = { x: look.x * 0.25, y: Math.min(look.y * 0.35, 40) - 30, h: 20 + Math.min(bh, 30) * 0.2 };
    this.w.follow(from, look, 40, t < 2 ? 1 : 0.1);
    return { near, ball: { x: bx, y: by, h: bh } };
  }
}
