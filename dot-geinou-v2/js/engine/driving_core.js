// Driving minigame — the simulation (pure: no DOM, no audio).  API doc: test-output/api_driving.txt
//
//   const sim = new Sim(course, { stage, kind: 'lesson'|'kentei', mt, practice, strict, pass, passenger, rng, time })
//   sim.step({ up, down, left, right }, { a, b })     one 60 fps frame
//   sim.points / sim.deds / sim.over / sim.done / sim.t / sim.car / sim.ev (drained by the UI)
// The car is a bicycle model on its rear axle; x right, y down, heading a (0 = east, a right turn increases a).

import { DED, KMH, LINES, PASS } from './driving_data.js';
import { sigState } from './driving_course.js';

export const VEH = {
  car: { L: 28, W: 12, wb: 17, over: 5.5, steerMax: 0.74, vmax: 2.2, rmax: 0.5, acc: 0.024, brake: 0.045, steerRate: 0.05, creep: 0.2 },
  moto: { L: 17, W: 5, wb: 11, over: 3, steerMax: 0.85, vmax: 1.9, rmax: 0.4, acc: 0.021, brake: 0.04, steerRate: 0.06, creep: 0.14 },
};
const D2R = Math.PI / 180;
const hyp = Math.hypot;
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return hyp(px - ax - dx * t, py - ay - dy * t);
}

export class Sim {
  constructor(course, o = {}) {
    this.c = course;
    this.o = o;
    this.kind = o.kind || 'lesson';
    this.practice = !!o.practice;
    this.strict = o.strict || 1;
    this.passMark = o.pass || PASS;
    this.mt = !!o.mt;
    this.passenger = !!o.passenger;
    this.rng = o.rng || Math.random;
    this.timeLimit = (o.time || 240) * 60;
    this.reverseOK = !!o.reverse;
    this.veh = VEH[course.vehicle === 'moto' ? 'moto' : 'car'];
    this.moto = this.veh === VEH.moto;
    this.ease = o.ease || 0; // 0..~0.4: wider tolerance for a skilled / well-rested player
    const st = course.start;
    this.car = { x: st.x, y: st.y, a: st.a, v: 0, steer: 0, th: 0, br: 0, gear: 'D' };
    this.t = 0;
    this.deds = [];
    this.points = 100;
    this.over = null;
    this.done = null;
    this.ev = [];
    this.say = null;
    this.peds = [];
    this.s = 0;
    this.si = 0;
    this.lat = 0;
    this.sig = 0; // -1 left, 1 right
    this.sigFrames = 0;
    this.sigA = 0;
    this.lastLook = -9999;
    this.lookT = 99;
    this.revT = 0;
    this.mtT = 0;
    this.mtGo = false;
    this.stall = 0;
    this.stillT = 0;
    this.offT = 0;
    this.onT = 99;
    this.offArmed = true;
    this.lostT = 0;
    this.cool = {};
    this.hist = [];
    this.moved = false;
    this.overT = 0;
    this.underT = 999;
    this.hintIx = 0;
    this.keepIx = {};
    this.keepT = {};
    this.slopeNow = null;
    this.phase = course.phase0 || 0;
    this.warp = null;
    this.hold = 0;
    this.maxBrakeT = 0;
    this.stat = { time: 0, dist: 0 };
    this.fade = 0;
    this.gate = { st: 'open', t: 0 };
    this.train = null;
    this.bridge = null;
    for (const t of course.trig) t.st = { ph: 'approach', minV: 9, look: false, done: false };
    this.initSamples();
    // precompute ribbon boxes
    for (const r of course.ribbons) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const [x, y] of r.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      r.bb = [x0 - r.hw, y0 - r.hw, x1 + r.hw, y1 + r.hw];
    }
    this.cones = course.cones.map((c) => ({ ...c, hit: 0 }));
    this.firstSay();
  }

  firstSay() {
    const L = LINES;
    this.setSay(this.mt ? L.startMT[0] : L.start[this.rng() < 0.5 ? 0 : 1], 360);
  }
  setSay(text, frames = 240, key = null) {
    this.say = { text, t: frames, key };
    this.ev.push({ type: 'say', text });
  }

  // ------------------------------------------------------------ geometry
  initSamples() {
    const v = this.veh;
    const pts = [];
    const nx = Math.max(2, Math.round(v.L / 7)), ny = v.W > 8 ? 2 : 1;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) pts.push([-v.L / 2 + (v.L * i) / nx, -v.W / 2 + (v.W * j) / ny]);
    this.samples = pts;
  }
  dirv() { return [Math.cos(this.car.a), Math.sin(this.car.a)]; }
  center() { const c = this.car, v = this.veh; return [c.x + Math.cos(c.a) * v.wb / 2, c.y + Math.sin(c.a) * v.wb / 2]; }
  front() { const c = this.car, v = this.veh, k = v.wb + v.over; return [c.x + Math.cos(c.a) * k, c.y + Math.sin(c.a) * k]; }
  rear() { const c = this.car, v = this.veh; return [c.x - Math.cos(c.a) * v.over, c.y - Math.sin(c.a) * v.over]; }
  toWorld(lx, ly) { // local (forward, right) from body centre
    const [cx, cy] = this.center(), a = this.car.a, ca = Math.cos(a), sa = Math.sin(a);
    return [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca];
  }
  wheels() {
    const v = this.veh, w = v.W / 2 - 1;
    if (this.moto) return [this.toWorld(v.L / 2 - 1, 0), this.toWorld(-v.L / 2 + 1, 0)];
    return [this.toWorld(v.L / 2 - 3, -w), this.toWorld(v.L / 2 - 3, w), this.toWorld(-v.L / 2 + 3, -w), this.toWorld(-v.L / 2 + 3, w)];
  }
  inSurf(x, y) {
    const c = this.c;
    for (const r of c.rects) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (r.cut && hyp(x - r.cut.x, y - r.cut.y) < r.cut.r) continue; // the kerb's rounded corner
        return true;
      }
    }
    for (const r of c.ribbons) {
      const b = r.bb;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      const hw = r.hw + (this.ease > 0 ? 0 : 0);
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], q = r.pts[i + 1];
        if (segDist(x, y, a[0], a[1], q[0], q[1]) <= hw) return true;
      }
      if (r.pts.length === 1 && hyp(x - r.pts[0][0], y - r.pts[0][1]) <= hw) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ deductions
  ded(id, o = {}) {
    const D = DED[id];
    if (!D) return;
    const cd = o.cool ?? 40;
    if (this.cool[id] && this.t - this.cool[id] < cd) return false;
    this.cool[id] = this.t;
    let pts = o.pts ?? D.pts;
    let abort = !!D.abort && this.kind === 'kentei' && !this.practice;
    if (D.abort && !abort) pts = D.assist ?? 20; // instructor's 補助ブレーキ instead
    pts = Math.round(pts * this.strict);
    const what = D.what + (o.note || '');
    this.deds.push({ id, what, pts, t: this.t });
    this.points = Math.max(0, 100 - this.deds.reduce((a, d) => a + d.pts, 0));
    this.ev.push({ type: 'ded', id, what, pts, abort, assist: D.abort && !abort });
    this.setSay(D.say, 200);
    if (abort) { this.over = { abort: true, id, what }; this.done = 'abort'; }
    else if (D.abort) this.assistBrake();
    return true;
  }
  assistBrake() {
    const c = this.car;
    c.v = 0; c.th = 0; c.br = 1;
    // step back to a state from half a second ago
    for (let i = this.hist.length - 1; i >= 0; i--) {
      const h = this.hist[i];
      if (this.t - h.t >= 25) { c.x = h.x; c.y = h.y; c.a = h.a; break; }
    }
    this.assist = 40;
    this.ev.push({ type: 'assist' });
  }

  // ------------------------------------------------------------ one frame
  step(k, press) {
    if (this.done) return;
    this.t++;
    const c = this.car, V = this.veh;
    this.ev.length = 0;
    if (this.say) { this.say.t--; if (this.say.t <= 0) this.say = null; }
    if (this.fadeIn > 0) this.fadeIn--;
    if (this.fade > 0) { this.fade--; if (this.fade === 0 && this.warp) this.doWarp(); return; }
    if (this.assist > 0) { this.assist--; c.v = 0; c.br = 1; return; }
    if (this.stall > 0) { this.stall--; c.v = Math.max(0, c.v - 0.05); }
    if (press.a) this.cycleSignal(k);
    if (press.b) { this.lastLook = this.t; this.lookT = 0; this.ev.push({ type: 'look' }); }
    this.lookT++;
    if (this.sig) { this.sigFrames++; } else this.sigFrames = 0;

    // ---- pedals & steering
    const v0 = c.v;
    const up = !!k.up, down = !!k.down;
    c.th = Math.max(0, Math.min(1, c.th + (up ? 0.065 : -0.14)));
    let brakeIn = false;
    if (c.gear === 'D') {
      if (down) {
        if (c.v > 0.03) brakeIn = true;
        else if (this.reverseOK && !up) {
          this.revT++;
          if (this.revT >= 16) { c.gear = 'R'; this.revT = 0; this.ev.push({ type: 'gear', gear: 'R' }); this.setSay('後退します（R）。後ろをよく見て。', 160); }
          brakeIn = true;
        } else brakeIn = true;
      } else this.revT = 0;
    } else { // R
      if (up) { brakeIn = c.v < -0.01; if (c.v >= -0.01 && c.th > 0.2) { c.gear = 'D'; this.ev.push({ type: 'gear', gear: 'D' }); } }
    }
    c.br = Math.max(0, Math.min(1, c.br + (brakeIn ? 0.075 : -0.2)));

    if (c.gear === 'D') {
      let acc = V.acc * Math.max(0, 1 - Math.pow(Math.max(0, c.v) / V.vmax, 1.6));
      if (this.mt && !this.mtGo && Math.abs(c.v) < 0.06 && !this.stall) {
        if (up && !down) {
          this.mtT++;
          acc = 0;
          if (this.mtT >= 24) { this.mtGo = true; this.mtT = 0; }
        } else if (this.mtT > 4 && (down || !up)) { // let go / brake while the clutch is engaging
          this.ded('stall'); this.stall = 70; this.mtT = 0;
        } else this.mtT = 0;
      }
      if (this.mt && this.mtGo && Math.abs(c.v) < 0.03 && !up) { this.mtT = -1; }
      if (this.mt && this.mtGo && c.v < 0.03 && !up && c.br > 0.3) this.mtGo = false;
      if (this.stall > 0) acc = 0;
      if (c.th > 0 && c.v >= -0.02) c.v += acc * c.th;
      else if (c.th > 0) c.v += V.brake * 0.9;
      else if (!this.mt && c.br < 0.05 && c.v > 0.05 && c.v < V.creep && !this.stall) c.v += 0.012; // AT: keeps rolling slowly once moving (no creep from a standstill)
      if (c.th === 0 && c.br < 0.05) c.v -= c.v > 0 ? 0.0035 : 0; // engine brake
      if (c.br > 0) c.v = Math.max(0, c.v - (0.008 + (V.brake - 0.008) * c.br));
    } else {
      if (down && !up) c.v = Math.max(-V.rmax, c.v - 0.02 * (this.moto ? 1 : 1)); else c.v = Math.min(0, c.v + (up ? 0.05 : 0.014));
      if (c.v >= -0.005 && !down && !up) { this.stillR = (this.stillR || 0) + 1; if (this.stillR > 40) { c.gear = 'D'; this.stillR = 0; } } else this.stillR = 0;
    }
    c.v *= 0.9985;
    // slope
    this.slopeNow = null;
    for (const sl of this.c.slopes) {
      if (this.s >= sl.s0 && this.s <= sl.s1) {
        this.slopeNow = sl;
        const tang = this.pathAt(this.s).a;
        const along = Math.cos(c.a - tang);
        if (c.br < 0.15 || Math.abs(c.v) > 0.25) c.v -= sl.pull * along * (c.br > 0.15 ? 0.2 : 1);
        if (c.br >= 0.15 && Math.abs(c.v) < 0.04) c.v = 0;
      }
    }
    c.v = Math.max(-V.rmax, Math.min(V.vmax, c.v));
    if (Math.abs(c.v) < 0.003 && c.th === 0) c.v = 0;

    const sf = 1 / (1 + 0.8 * Math.abs(c.v));
    const want = ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * V.steerMax * sf;
    if (k.left || k.right) c.steer += Math.max(-V.steerRate, Math.min(V.steerRate, want - c.steer));
    else c.steer += Math.max(-0.07, Math.min(0.07, -c.steer));
    c.steer = Math.max(-V.steerMax, Math.min(V.steerMax, c.steer));
    // passengers dislike jerks
    if (this.passenger) this.jerkCheck(v0, k);

    // ---- balance bike on the one-plank bridge
    if (this.bridge && this.bridge.on) {
      const w = Math.sin(this.t * 0.083 + 1.3) * 0.7 + Math.sin(this.t * 0.151) * 0.5;
      c.a += w * 0.0042 / (0.18 + Math.abs(c.v) * 2.5);
    }

    // ---- integrate
    const prev = { x: c.x, y: c.y, a: c.a };
    c.a += c.v * Math.tan(c.steer) / V.wb;
    c.x += Math.cos(c.a) * c.v;
    c.y += Math.sin(c.a) * c.v;
    const bnd = this.c.bounds;
    if (bnd) { c.x = Math.max(bnd.x0 + 10, Math.min(bnd.x1 - 10, c.x)); c.y = Math.max(bnd.y0 + 10, Math.min(bnd.y1 - 10, c.y)); }
    this.stat.dist += Math.abs(c.v);

    // ---- collisions
    const hit = this.collide(prev);
    if (!hit) { this.hist.push({ t: this.t, x: c.x, y: c.y, a: c.a }); if (this.hist.length > 60) this.hist.shift(); }
    if (this.done) return;

    // ---- progress along the path
    this.updateProgress();
    // ---- wheels & surface
    this.surface();
    // ---- hints
    const hs = this.c.hints || [];
    while (this.hintIx < hs.length && this.s >= hs[this.hintIx].s) { const h = hs[this.hintIx++]; if (LINES.hint[h.key] && !this.say) this.setSay(LINES.hint[h.key], 300, h.key); }
    // ---- rules
    this.speedRule();
    this.laneRule();
    this.startRule(v0);
    for (const tr of this.c.trig) { this.trigger(tr); if (this.done) return; }
    this.updatePeds();
    this.updateGate();
    this.updateSignalLever();
    if (Math.abs(c.v) < 0.02) this.stillT++; else this.stillT = 0;
    this.stat.time = this.t;
    if (this.t > this.timeLimit && !this.done) { this.ded('time', { cool: 0 }); this.done = 'timeout'; this.over = { timeout: true }; }
  }

  jerkCheck(v0, k) {
    const c = this.car;
    if (c.br > 0.85 && c.v > 0.7) { this.maxBrakeT++; if (this.maxBrakeT === 14) this.ded('jerk', { cool: 200 }); } else this.maxBrakeT = 0;
    if (v0 < 0.05 && c.v > 0.1 && c.th > 0.9 && !this.moved) { /* first start: gentle by ramp */ }
    if (Math.abs(c.steer) > 0.5 && c.v > 1.1) { this.steerJerk = (this.steerJerk || 0) + 1; if (this.steerJerk === 20) this.ded('jerk2', { cool: 240 }); } else this.steerJerk = 0;
  }

  cycleSignal(k) {
    const prev = this.sig;
    if (k.left) this.sig = this.sig === -1 ? 0 : -1;
    else if (k.right) this.sig = this.sig === 1 ? 0 : 1;
    else this.sig = this.sig === 0 ? -1 : this.sig === -1 ? 1 : 0;
    if (this.sig !== prev) { this.sigFrames = 0; this.sigA = this.car.a; this.ev.push({ type: 'sig', sig: this.sig }); }
  }
  updateSignalLever() {
    // the lever springs back after the turn
    if (this.sig && Math.abs(wrapA(this.car.a - this.sigA)) > 1.1 && Math.abs(this.car.steer) < 0.25 && this.sigFrames > 30) {
      this.sig = 0; this.sigFrames = 0; this.ev.push({ type: 'sig', sig: 0, auto: true });
    }
    if (this.sig && this.sigFrames > 1500) { this.sig = 0; this.ev.push({ type: 'sig', sig: 0, auto: true }); }
  }

  pathAt(s) {
    const c = this.c;
    if (!c.cum || c.cum.length < 2) return { x: this.car.x, y: this.car.y, a: this.car.a };
    return c._pb ? c._pb.at(s) : { x: this.car.x, y: this.car.y, a: this.car.a };
  }
  updateProgress() {
    const c = this.c, pb = c._pb;
    if (!pb || c.noPathProgress) return;
    const [cx, cy] = this.center();
    let best = 1e9, bs = this.s;
    const lo = Math.max(0, this.si - 4), hi = Math.min(pb.pts.length - 1, (this.si ?? 0) + 40);
    for (let i = lo; i < hi; i++) {
      const a = pb.pts[i], b = pb.pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((cx - a[0]) * dx + (cy - a[1]) * dy) / l2));
      const d = hyp(cx - a[0] - dx * t, cy - a[1] - dy * t);
      if (d < best) { best = d; bs = pb.cum[i] + t * Math.sqrt(l2); this.si = i; }
    }
    this.s = bs;
    const q = pb.at(bs);
    this.lat = (cx - q.x) * -Math.sin(q.a) + (cy - q.y) * Math.cos(q.a); // right-positive
    this.pdist = best;
  }

  // ------------------------------------------------------------ collisions
  collide(prev) {
    const c = this.car;
    const cd = this.c;
    let crashed = null, soft = null;
    const pts = this.samples.map(([lx, ly]) => this.toWorld(lx, ly));
    for (const w of cd.walls) {
      for (const [x, y] of pts) {
        if (x > w.x && x < w.x + w.w && y > w.y && y < w.y + w.h) { if (w.kind === 'curb') soft = soft || w; else crashed = w; break; }
      }
      if (crashed) break;
    }
    if (crashed) {
      if (this.t - (this.cool.crash || -999) > 40) {
        this.ev.push({ type: 'hit', kind: 'wall' });
        this.cool.crash = this.t;
        c.x = prev.x; c.y = prev.y; c.a = prev.a; c.v = 0;
        this.ded('crash', { cool: 0 });
        if (!this.done) { /* assist handled in ded */ }
      } else { c.x = prev.x; c.y = prev.y; c.a = prev.a; c.v = 0; }
      return true;
    }
    if (soft) {
      c.x = prev.x; c.y = prev.y; c.a = prev.a; c.v = Math.min(c.v, 0) * 0.5;
      this.ded('kerb', { cool: 60 });
      this.ev.push({ type: 'hit', kind: 'curb' });
      return true;
    }
    // cones: circle vs oriented box
    const [cx, cy] = this.center(), ca = Math.cos(c.a), sa = Math.sin(c.a), V = this.veh;
    for (const k of this.cones) {
      if (k.hit) { k.hit++; continue; }
      const dx = k.x - cx, dy = k.y - cy;
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      const ex = Math.max(Math.abs(lx) - V.L / 2, 0), ey = Math.max(Math.abs(ly) - V.W / 2, 0);
      if (hyp(ex, ey) < 3.2) { k.hit = 1; k.vx = Math.cos(c.a) * 1.2 + (Math.random() - 0.5); k.vy = Math.sin(c.a) * 1.2; this.ded('cone', { cool: 10 }); this.ev.push({ type: 'hit', kind: 'cone' }); }
    }
    // pedestrians
    for (const p of this.peds) {
      const dx = p.x - cx, dy = p.y - cy;
      const lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
      const ex = Math.max(Math.abs(lx) - V.L / 2, 0), ey = Math.max(Math.abs(ly) - V.W / 2, 0);
      if (hyp(ex, ey) < 3.6 && !p.gone) { p.hit = true; this.ded('ped', { cool: 120 }); this.ev.push({ type: 'hit', kind: 'ped' }); c.v = 0; }
    }
    return false;
  }

  // ------------------------------------------------------------ surface / 脱輪
  surface() {
    const c = this.car;
    const ws = this.wheels();
    let off = 0;
    for (const [x, y] of ws) if (!this.inSurf(x, y)) off++;
    const town = this.c.town;
    const bridgeOn = this.bridge && this.bridge.on;
    if (off) {
      this.offT++;
      this.onT = 0;
      if (!this.moto && off >= 1) c.v *= 0.985;
      if (this.offT === 5 && this.offArmed && !bridgeOn) {
        this.offArmed = false;
        this.ded(town ? 'kerb' : 'wheel', { cool: town ? 150 : 40 });
      }
      this.allOff = off === ws.length;
    } else {
      this.offT = 0; this.onT++;
      if (this.onT > (town ? 70 : 40)) this.offArmed = true;
      this.allOff = false;
    }
    // far from the course: put the car back
    const far = this.c.noPathProgress ? false : (this.pdist > 90);
    if ((this.allOff && this.c.noPathProgress) || far) { this.lostT++; if (this.lostT > 120) { this.lostT = 0; this.ded('lost', { cool: 0 }); this.toPath(); } } else this.lostT = 0;
  }
  toPath() {
    const c = this.car, q = this.pathAt(this.s);
    const back = Math.max(0, this.s - 20);
    const p = this.pathAt(back);
    c.x = p.x; c.y = p.y; c.a = p.a; c.v = 0; c.steer = 0; c.gear = 'D';
    this.sig = 0;
    this.assist = 30;
  }

  // ------------------------------------------------------------ rules: speed, lane, start
  limitNow() {
    const L = this.c.limits;
    for (const l of L) if (this.s >= l.s0 && this.s < l.s1) return l.kmh;
    return L.length ? L[L.length - 1].kmh : 30;
  }
  get kmh() { return Math.abs(this.car.v) * KMH; }
  speedRule() {
    const lim = this.limitNow();
    this.limit = lim;
    const over = this.kmh - lim;
    if (over > 1.5) {
      this.overT++;
      this.underT = 0;
      this.maxOver = Math.max(this.maxOver || 0, over);
      if (this.overT === 55) { this.ded(this.maxOver > 12 ? 'speed2' : 'speed', { cool: 300 }); }
    } else {
      this.overT = Math.max(0, this.overT - 2);
      this.underT++;
      if (this.underT > 120) { this.maxOver = 0; }
    }
  }
  laneRule() {
    const c = this.c;
    if (!c.keep.length) return;
    c.keep.forEach((k, i) => {
      if (this.s >= k.s0 && this.s <= k.s1) {
        if (this.lat > 13 && this.car.v > 0.3) {
          this.keepT[i] = (this.keepT[i] || 0) + 1;
          if (this.keepT[i] === 45 && !this.keepIx[i]) { this.keepIx[i] = 1; this.ded('lane', { cool: 0 }); }
        } else this.keepT[i] = Math.max(0, (this.keepT[i] || 0) - 2);
      }
    });
  }
  startRule(v0) {
    const c = this.car;
    if (!this.moved && Math.abs(c.v) > 0.12) {
      this.moved = true;
      if (!this.practice && this.kind !== 'x' && !this.c.noStartLook && this.c.name !== 'park' && this.t - this.lastLook > 600) this.ded('startLook', { cool: 0 });
    }
    if (c.gear === 'R' && v0 > -0.02 && c.v <= -0.02 && this.t - this.lastLook > 480) this.ded('reverseLook', { cool: 400 });
  }

  // ------------------------------------------------------------ triggers
  planeS(tr) {
    const [fx, fy] = this.front();
    const u = -(fx - tr.x) * tr.dy + (fy - tr.y) * tr.dx;
    if (Math.abs(u) > (tr.lat || 30)) return -1e4; // not in front of this line at all
    return (fx - tr.x) * tr.dx + (fy - tr.y) * tr.dy;
  }
  aligned(tr) { const c = this.car; return Math.cos(c.a) * tr.dx + Math.sin(c.a) * tr.dy > 0.3; }
  trigger(tr) {
    const st = tr.st, c = this.car;
    if (tr.sp !== undefined && Math.abs(this.s - tr.sp) > 260) { st.prevS = undefined; return; }
    switch (tr.type) {
      case 'stopline': case 'rail': {
        const s = this.planeS(tr);
        const prev = st.prevS ?? s;
        st.prevS = s;
        if (st.ph === 'approach') {
          if (tr.type === 'rail' && s > -140 && this.gate.st === 'open' && !st.gateDone) { this.gate = { st: 'closing', t: 0 }; st.gateDone = true; this.train = { x: -1, t: 0 }; this.ev.push({ type: 'bell' }); }
          if (s > -70 && s < 30) { st.minV = Math.min(st.minV, Math.abs(c.v)); if (this.t - this.lastLook < 240 && Math.abs(c.v) < 0.5) st.look = true; }
          if (s > 7 && s < 60 && Math.abs(c.v) < 0.03 && this.aligned(tr)) { if (!tr.sign && tr.type !== 'rail') { /* plain stop */ } this.ded('stopmark', { cool: 0 }); st.ph = 'passed'; st.overshoot = true; if (!st.look) { this.ded('look', { cool: 0 }); } }
          if (prev < 0 && s >= 0 && this.aligned(tr) && c.v > 0) {
            st.ph = 'passed';
            if (tr.type === 'rail' && this.gate.st !== 'open') this.ded('railgo', { cool: 0 });
            else if (st.minV > 0.12) this.ded('nostop', { cool: 0 });
            else if (!st.look) this.ded('look', { cool: 0 });
          }
        }
        if (tr.type === 'rail') {
          // never stand on the tracks
          const q = this.pathAt(tr.s);
          const [cx, cy] = this.center();
          const u = (cx - q.x) * Math.cos(q.a) + (cy - q.y) * Math.sin(q.a);
          if (Math.abs(u) < 11 && this.stillT > 40 && !this.over) this.ded('railstop', { cool: 600 });
        }
        break;
      }
      case 'signal': {
        const s = this.planeS(tr);
        const prev = st.prevS ?? s;
        st.prevS = s;
        const state = sigState(tr.sig, tr.axis, this.t, tr.cyc);
        tr.now = state;
        if (st.ph === 'approach') {
          if (s > 8 && s < 60 && Math.abs(c.v) < 0.03 && state === 'r') { this.ded('stopmark', { cool: 0 }); st.ph = 'passed'; }
          if (prev < 0 && s >= 0 && c.v > 0 && this.aligned(tr)) {
            st.ph = 'passed';
            if (state === 'r') this.ded('signal', { cool: 0 });
          }
        }
        break;
      }
      case 'turn': {
        const s = this.planeS(tr);
        const prev = st.prevS ?? s;
        st.prevS = s;
        if (st.ph === 'approach' && prev < 0 && s >= 0 && c.v > 0 && this.aligned(tr)) {
          st.ph = 'in';
          const want = tr.side === 'l' ? -1 : 1;
          if (!this.sig) this.ded('sigNone', { cool: 0 });
          else if (this.sig !== want) this.ded('sigWrong', { cool: 0 });
          else if (this.sigFrames < (tr.need || 36)) this.ded('sigLate', { cool: 0 });
          if (this.t - this.lastLook > 300) this.ded('look', { cool: 0 });
        }
        break;
      }
      case 'avoid': {
        const s = this.planeS(tr);
        const prev = st.prevS ?? s;
        st.prevS = s;
        if (st.ph === 'approach' && prev < 0 && s >= 0 && c.v > 0 && this.aligned(tr)) {
          st.ph = 'in';
          if (this.sig !== 1 || this.sigFrames < 20 || this.t - this.lastLook > 300) this.ded('avoid', { cool: 0 });
        }
        if (st.ph === 'in' && this.s > tr.sCar + 40 && this.sig === 1) { this.sig = 0; this.ev.push({ type: 'sig', sig: 0, auto: true }); st.ph = 'passed'; }
        break;
      }
      case 'cross': {
        const s = this.planeS(tr);
        const prev = st.prevS ?? s;
        st.prevS = s;
        if (!st.spawned && s > -150 && s < -60 && this.aligned(tr)) {
          st.spawned = true;
          const q = this.pathAt(tr.sZ);
          const dx = Math.cos(q.a), dy = Math.sin(q.a);
          const nx = -dy, ny = dx; // right normal
          const side = this.rng() < 0.5 ? -1 : 1;
          const off = tr.hw + 9;
          st.ped = { x: q.x + nx * off * side, y: q.y + ny * off * side, vx: -nx * side * (this.o.pedSpeed || 0.55), vy: -ny * side * (this.o.pedSpeed || 0.55), u: off * side, cx: q.x, cy: q.y, nx, ny, hw: tr.hw, look: Math.random() * 6 };
          this.peds.push(st.ped);
          this.setSay('横断歩道に歩行者です。止まって、渡り終えるのを待ちましょう。', 300);
        }
        if (st.ph === 'approach' && prev < 0 && s >= 0 && c.v > 0.05 && this.aligned(tr)) {
          st.ph = 'passed';
          const p = st.ped;
          if (p && !p.gone && Math.abs(p.u) < tr.hw + 2) this.ded('yield', { cool: 0 });
        }
        break;
      }
      case 'stopmark': {
        if (st.fin) { if (this.t - st.fin > 20 && !this.done) this.finish('goal'); break; }
        if (st.done) break;
        const s = this.planeS(tr);
        const stopped = Math.abs(c.v) < 0.04 && this.stillT >= 12;
        if (s > -110 && s < 70 && stopped && this.aligned(tr)) {
          st.done = true;
          const ok = s >= tr.near && s <= tr.far;
          if (!ok) this.ded('stopmark', { cool: 0 });
          if (tr.hill) { st.hillStop = true; st.sStop = this.s; st.done = false; st.ph = 'wait'; }
          else if (tr.final) { st.fin = this.t; }
        }
        if (tr.hill && st.hillStop) {
          // rolling back / restarting
          st.rollMax = Math.max(st.rollMax || 0, st.sStop - this.s);
          if (c.v > 0.25) {
            st.done = true;
            const r = st.rollMax;
            if (r > 20) this.ded('roll2', { cool: 0 }); else if (r > 8) this.ded('roll', { cool: 0 });
          }
        }
        if (s > 70 && !st.done) { st.done = true; this.ded('stopmark', { cool: 0 }); if (tr.final) st.fin = this.t; }
        break;
      }
      case 'pickup': {
        if (st.done) break;
        const s = this.planeS(tr);
        const stopped = Math.abs(c.v) < 0.04;
        if (s > -60 && s < 40 && stopped && this.aligned(tr)) {
          if (s >= tr.near && s <= tr.far && this.lat < -3) {
            st.hold = (st.hold || 0) + 1;
            this.hold = st.hold;
            if (st.hold === 1) this.ev.push({ type: 'door' });
            if (st.hold >= tr.hold) { st.done = true; this.hold = 0; this.setSay(tr.kind === 'pickup' ? 'ご乗車ありがとうございます。発車します。' : 'ありがとうございました。', 200); this.ev.push({ type: 'door' }); }
          } else if (st.hold) { st.hold = 0; this.hold = 0; }
        } else if (st.hold) { st.hold = 0; this.hold = 0; }
        if (s > 50 && !st.done) { st.done = true; this.ded('passenger', { cool: 0 }); }
        break;
      }
      case 'bridge': {
        const sB = this.s;
        const inside = sB >= tr.s0 + 6 && sB <= tr.s1;
        if (!this.bridge) this.bridge = { on: false };
        if (st.ph === 'approach' && sB >= tr.s0 + 4 && this.aligned(tr)) { st.ph = 'on'; st.t0 = this.t; this.bridge.on = true; this.bridge.t0 = this.t; }
        if (st.ph === 'on') {
          this.bridge.on = true;
          // fell off?
          const ws = this.wheels();
          const out = ws.some(([x, y]) => !this.inSurf(x, y));
          if (out && sB < tr.s1 - 4) {
            this.ded('fall', { cool: 0 });
            st.falls = (st.falls || 0) + 1;
            const q = this.pathAt(tr.s0 - 14);
            c.x = q.x; c.y = q.y; c.a = q.a; c.v = 0; c.steer = 0; st.ph = 'approach'; this.bridge.on = false;
            this.assist = 40;
          } else if (sB >= tr.s1 - 3) {
            st.ph = 'passed'; this.bridge.on = false;
            const sec = (this.t - st.t0) / 60;
            st.sec = sec;
            if (sec < 7 && (st.falls || 0) === 0) this.ded('bridgeFast', { cool: 0 });
          }
        }
        break;
      }
      case 'park': {
        if (st.done) break;
        if (this.phase !== (tr.id === 'parkB' ? 1 : 0)) break;
        const [cx, cy] = this.center();
        const r = tr.rect;
        const inside = cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h;
        const err = Math.abs(wrapA(c.a - tr.a));
        const okAngle = err <= tr.tol;
        if (inside && okAngle && Math.abs(c.v) < 0.04) {
          st.hold = (st.hold || 0) + 1;
          if (st.hold === 20) this.ev.push({ type: 'good' });
          if (st.hold >= 36) {
            st.done = true;
            this.parked = (this.parked || 0) + 1;
            if (tr.final) { this.finish('goal'); } else { this.setSay('うまく入りました！ 前進で出て、来た道を戻りましょう。', 300); }
          }
        } else st.hold = 0;
        st.inside = inside; st.err = err;
        break;
      }
      case 'reach': {
        if (st.done) break;
        const need = this.c.trig.find((x) => x.id === tr.needId);
        if (need && !need.st.done) break;
        const [cx, cy] = this.center();
        const r = tr.rect;
        if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h && Math.abs(wrapA(c.a - tr.a)) < tr.tol) {
          st.done = true;
          if (tr.final) this.finish('goal');
          else if (tr.warp) { this.warp = tr.warp; this.fade = 60; this.setSay('つぎは縦列駐車です。', 300); this.ev.push({ type: 'fadeout' }); }
        }
        break;
      }
      default: break;
    }
  }

  doWarp() {
    const w = this.warp, c = this.car;
    c.x = w.x; c.y = w.y; c.a = w.a; c.v = 0; c.steer = 0; c.gear = 'D';
    this.phase++;
    this.warp = null;
    this.sig = 0;
    this.hist.length = 0;
    this.ev.push({ type: 'warped' });
    this.setSay('縦列駐車：前の車と並べて止め、バックで2台の間へ入れます。', 360);
    this.fadeIn = 40;
  }

  finish(how) {
    if (this.done) return;
    this.done = how;
  }

  // ------------------------------------------------------------ pedestrians & the level crossing
  updatePeds() {
    for (const p of this.peds) {
      if (p.gone) continue;
      p.x += p.vx; p.y += p.vy; p.u += (p.vx * p.nx + p.vy * p.ny);
      p.look += 0.1;
      if (Math.abs(p.u) > p.hw + 12 && ((p.u > 0) === (p.vx * p.nx + p.vy * p.ny > 0))) p.gone = true;
    }
  }
  updateGate() {
    const g = this.gate;
    if (g.st === 'open') return;
    g.t++;
    if (this.train) {
      this.train.t++;
      this.train.x = (this.train.t - 50) / 150; // 0..1 across
    }
    if (g.st === 'closing' && g.t > 40) { g.st = 'closed'; g.t = 0; }
    else if (g.st === 'closed' && g.t > 210) { g.st = 'opening'; g.t = 0; this.train = null; }
    else if (g.st === 'opening' && g.t > 30) { g.st = 'open'; g.t = 0; }
  }

  // ------------------------------------------------------------ results
  result() {
    const points = this.deds.length ? Math.max(0, 100 - this.deds.reduce((a, d) => a + d.pts, 0)) : 100;
    const aborted = !!(this.over && this.over.abort);
    const passed = !aborted && this.done === 'goal' && points >= this.passMark;
    return { passed, points, aborted, how: this.done, seconds: Math.round(this.t / 60), deductions: this.deds.map((d) => ({ what: d.what, pts: d.pts })) };
  }
}
