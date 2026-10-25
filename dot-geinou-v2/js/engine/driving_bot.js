// Driving minigame — an autopilot (tests, `quickRun`, the practice demo).  Pure: reads a Sim, returns key states.
//   const bot = new Bot(sim);  const { k, p } = bot.act();  sim.step(k, p);
// `skill` 0..1: how sloppy it is (0 = flawless).  API doc: test-output/api_driving.txt

import { KMH } from './driving_data.js';
import { sigState } from './driving_course.js';

const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// reverse manoeuvre scripts for the two parking tasks: [ {until, keys} ... ] (found by search, see tools in test-output/driving)
export const PARK_SCRIPT = {
  A: null,
  B: null,
};

export class Bot {
  constructor(sim, o = {}) {
    this.sim = sim;
    this.o = o;
    this.t = 0;
    this.wait = 0;
    this.pressedLook = false;
    this.step = 0;
    this.stepT = 0;
    this.sloppy = o.sloppy || 0;
  }

  act() {
    const sim = this.sim, c = sim.car;
    const k = { up: false, down: false, left: false, right: false };
    const p = { a: false, b: false };
    this.t++;
    if (sim.c.name === 'park') return this.parking(k, p);
    if (sim.assist > 0 || sim.fade > 0) return { k, p };
    const V = sim.veh;
    const pb = sim.c._pb;
    // ---- steering: pure pursuit on the rear axle
    const Ld = sim.moto ? 12 + 10 * Math.abs(c.v) : 22 + 14 * Math.abs(c.v);
    const q = pb.at(sim.s + Ld);
    const dx = q.x - c.x, dy = q.y - c.y;
    const alpha = wrapA(Math.atan2(dy, dx) - c.a);
    let delta = Math.atan2(2 * V.wb * Math.sin(alpha), Math.hypot(dx, dy));
    if (this.t === 1 || this.sloppy) delta += (Math.sin(this.t * 0.05) * this.sloppy) * 0.15;
    const err = delta - c.steer;
    if (err > 0.025) k.right = true; else if (err < -0.025) k.left = true;

    // ---- target speed
    const lim = (sim.limitNow ? sim.limitNow() : 25) / KMH;
    let vd = Math.min(lim * 0.86, 1.6);
    const a0 = pb.at(sim.s).a, a1 = pb.at(sim.s + 70).a;
    const bend = Math.abs(wrapA(a1 - a0));
    vd = Math.min(vd, Math.max(sim.moto ? 0.42 : 0.5, 1.5 - bend * 2.2));
    if (sim.moto) vd = Math.min(vd, 0.9);
    // narrow lane / crank / bridge sections
    if (sim.c.name === 'moto' && sim.bridge && sim.bridge.on) vd = 0.26;
    const bridge = sim.c.trig.find((t) => t.type === 'bridge');
    if (bridge && sim.s > bridge.s0 - 40 && sim.s < bridge.s1 + 4) vd = Math.min(vd, sim.s > bridge.s0 ? 0.26 : 0.5);

    let stopDist = null; // distance (front to plane) we must be able to stop within
    let holdAtStop = false;
    let waitUntil = null;
    for (const tr of this.o.reckless ? [] : sim.c.trig) {
      const st = tr.st;
      if (!st || (tr.sp !== undefined && Math.abs(sim.s - tr.sp) > 260)) continue;
      const dd = -sim.planeS(tr);
      const near = dd > -30 && dd < 150;
      switch (tr.type) {
        case 'stopline': if (st.ph === 'approach' && near) { stopDist = Math.min(stopDist ?? 1e9, dd - 7); holdAtStop = true; tr._need = 'look'; } break;
        case 'rail': if (st.ph === 'approach' && near) { stopDist = Math.min(stopDist ?? 1e9, dd - 7); holdAtStop = true; tr._need = 'rail'; } break;
        case 'signal': {
          if (st.ph === 'approach' && near) {
            const s0 = sigState(tr.sig, tr.axis, sim.t, tr.cyc);
            const s1 = sigState(tr.sig, tr.axis, sim.t + Math.min(120, Math.round(Math.max(0, dd) / Math.max(0.3, c.v))), tr.cyc);
            if (s0 !== 'g' || s1 !== 'g') { stopDist = Math.min(stopDist ?? 1e9, dd - 7); holdAtStop = true; tr._need = 'sig'; }
          }
          break;
        }
        case 'cross': {
          const ped = st.ped && !st.ped.gone;
          if (st.ph === 'approach' && dd > -5 && dd < 170 && (ped || !st.spawned)) { stopDist = Math.min(stopDist ?? 1e9, dd - 7); holdAtStop = true; tr._need = 'ped'; }
          break;
        }
        case 'stopmark': if (st.fin) { stopDist = 0; holdAtStop = true; } else if (!st.done && near && !(tr.final && false)) { stopDist = Math.min(stopDist ?? 1e9, dd - 12); holdAtStop = true; tr._need = tr.hill ? 'hill' : 'mark'; } break;
        case 'pickup': if (!st.done && dd > -40 && dd < 160) { stopDist = Math.min(stopDist ?? 1e9, dd - 18); holdAtStop = true; tr._need = 'pick'; } break;
        case 'turn': {
          if (st.ph === 'approach' && dd > 0 && dd < 120) {
            const want = tr.side === 'l' ? -1 : 1;
            if (sim.sig !== want && this.t - (this._sigT || -99) > 20) { p.a = true; k.left = want < 0; k.right = want > 0; this._sigT = this.t; }
            if (dd < 70 && sim.t - sim.lastLook > 120) p.b = true;
            vd = Math.min(vd, 0.9);
          }
          break;
        }
        case 'avoid': {
          if (st.ph === 'approach' && dd > 0 && dd < 130) {
            if (sim.sig !== 1 && this.t - (this._sigT || -99) > 20) { p.a = true; k.right = true; k.left = false; this._sigT = this.t; }
            if (dd < 80 && sim.t - sim.lastLook > 120) p.b = true;
          }
          break;
        }
        default: break;
      }
    }
    // the avoid manoeuvre: shift right of the parked car
    const av = sim.c.trig.find((t) => t.type === 'avoid');
    let shift = 0;
    if (av) {
      const u = sim.s - av.sCar;
      shift = 13.5 * Math.max(0, Math.min(1, (u + 120) / 50)) * Math.max(0, Math.min(1, (60 - u) / 30));
    }
    if (shift) {
      const qq = pb.at(sim.s + Ld);
      const tx = qq.x - Math.sin(qq.a) * shift, ty = qq.y + Math.cos(qq.a) * shift;
      const al = wrapA(Math.atan2(ty - c.y, tx - c.x) - c.a);
      const dl = Math.atan2(2 * V.wb * Math.sin(al), Math.hypot(tx - c.x, ty - c.y));
      const e2 = dl - c.steer;
      k.right = e2 > 0.025; k.left = e2 < -0.025;
    }
    // pickup: pull to the kerb
    const pk = sim.c.trig.find((t) => t.type === 'pickup' && !t.st.done);
    if (pk) {
      const dd = -sim.planeS(pk);
      if (dd < 110 && dd > -40) {
        const qq = pb.at(sim.s + Ld);
        const tx = qq.x + Math.sin(qq.a) * 6, ty = qq.y - Math.cos(qq.a) * 6;
        const al = wrapA(Math.atan2(ty - c.y, tx - c.x) - c.a);
        const dl = Math.atan2(2 * V.wb * Math.sin(al), Math.hypot(tx - c.x, ty - c.y));
        const e2 = dl - c.steer;
        k.right = e2 > 0.025; k.left = e2 < -0.025;
      }
    }
    if (stopDist !== null) {
      const dist = Math.max(0, stopDist);
      const vstop = Math.sqrt(2 * 0.022 * dist);
      vd = Math.min(vd, vstop < 0.05 ? 0 : vstop);
    }
    // ---- at a standstill in front of a requirement
    const still = Math.abs(c.v) < 0.04;
    let hold = false;
    if (still && holdAtStop && stopDist !== null && stopDist < 14) {
      hold = true;
      for (const tr of sim.c.trig) {
        if (!tr.st || (tr.sp !== undefined && Math.abs(sim.s - tr.sp) > 260)) continue;
        const dd = -sim.planeS(tr);
        if (!(dd > -20 && dd < 40)) continue;
        if (['stopline', 'rail', 'signal', 'cross', 'stopmark', 'pickup'].includes(tr.type)) {
          if (sim.t - sim.lastLook > 200 && ['stopline', 'rail'].includes(tr.type)) p.b = true;
        }
      }
    }
    this.wantStop = hold;
    // stop conditions release
    const rel = this.release(sim, hold);
    if (rel && rel.hold === false) { hold = false; vd = Math.min(rel.vd, lim * 0.86); }
    // first move: look
    if (!sim.moved && this.t === 5 && !this.o.reckless) p.b = true;
    // ---- pedals
    if (hold || vd === 0) {
      if (c.v > 0.02 || hold) k.down = true;
      if (vd === 0 && Math.abs(c.v) <= 0.02) k.down = true;
    } else if (c.v < vd - 0.04) k.up = true;
    else if (c.v > vd + 0.07) k.down = c.v > 0.1;
    // hill start: hold the brake until we have started the engine
    return { k, p };
  }

  // decide when to leave a stop
  release(sim, hold) {
    const c = sim.car;
    for (const tr of sim.c.trig) {
      const st = tr.st;
      if (!st) continue;
      const dd = -sim.planeS(tr);
      if (!(dd > -20 && dd < 40)) continue;
      if (tr.type === 'signal' && st.ph === 'approach') {
        const s0 = sigState(tr.sig, tr.axis, sim.t, tr.cyc);
        if (s0 === 'g' && dd > 0) return { hold: false, vd: 0.8 };
      }
      if (this.latch && this.latch.has(tr)) { if (st.ph === 'approach') return { hold: false, vd: 0.8 }; this.latch.delete(tr); }
      if (tr.type === 'stopline' && st.ph === 'approach' && Math.abs(c.v) < 0.04 && sim.stillT > 24 && st.look) { (this.latch ||= new Set()).add(tr); return { hold: false, vd: 0.8 }; }
      if (tr.type === 'rail' && st.ph === 'approach' && Math.abs(c.v) < 0.04 && sim.stillT > 24 && st.look && sim.gate.st === 'open' && st.gateDone) { (this.latch ||= new Set()).add(tr); return { hold: false, vd: 0.8 }; }
      if (tr.type === 'cross' && st.ph === 'approach') {
        if (!st.ped || st.ped.gone) return { hold: false, vd: 0.8 };
      }
      if (tr.type === 'stopmark' && tr.hill && st.hillStop) {
        if (sim.stillT > 60) { this.hillGo = true; }
        if (this.hillGo) return { hold: false, vd: 0.9 };
        return null;
      }
      if (tr.type === 'stopmark' && !tr.final && !st.done) return null;
      if (tr.type === 'stopmark' && st.done && !tr.final) return { hold: false, vd: 0.9 };
      if (tr.type === 'pickup' && st.done) return { hold: false, vd: 0.9 };
    }
    return null;
  }

  // ---- the two parking tasks: a small state machine (closed loop on the heading)
  parking(k, p) {
    const sim = this.sim, c = sim.car;
    if (sim.fade > 0 || sim.assist > 0) return { k, p };
    const ps = (this.ps ||= { st: 'approach', n: 0, ph: -1 });
    if (ps.ph !== sim.phase) { ps.ph = sim.phase; ps.st = 'approach'; ps.n = 0; }
    ps.n++;
    const go = (st) => { ps.st = st; ps.n = 0; };
    const steerTo = (d) => { const e = d - c.steer; if (e > 0.03) k.right = true; else if (e < -0.03) k.left = true; };
    const [cx, cy] = sim.center();
    const PI2 = Math.PI / 2;
    const A = ps.ph === 0;
    const Ytarget = A ? 134 : 325;
    const Xstop = A ? 302 : 294;
    switch (ps.st) {
      case 'approach': {
        steerTo(Math.max(-0.3, Math.min(0.3, -1.5 * c.a - 0.02 * (c.y - Ytarget))));
        if (c.x >= Xstop - 22) go('brake');
        else if (c.v < 0.55) k.up = true;
        break;
      }
      case 'brake': { if (c.v > 0.02 || ps.n < 6) k.down = true; else go('look'); break; }
      case 'look': { if (ps.n === 1) p.b = true; k.down = true; if (ps.n > 20) go('rev1'); break; }
      case 'rev1': {
        k.down = true;
        if (A) { k.left = true; if (c.a >= PI2 - 0.04) go('rev2'); }
        else { k.left = true; if (c.a >= 1.0) go('rev1b'); }
        break;
      }
      case 'rev1b': { k.down = true; k.right = true; if (c.a <= 0.03) go('rev2'); break; }
      case 'rev2': {
        k.down = true;
        if (A) {
          const at = PI2 - Math.max(-0.2, Math.min(0.2, 0.02 * (cx - 276)));
          const e = c.a - at;
          if (e > 0.015) k.right = true; else if (e < -0.015) k.left = true;
          if (cy <= 62) go('stop');
        } else {
          const e = c.a - 0.0;
          if (e > 0.015) k.right = true; else if (e < -0.015) k.left = true;
          if (cx <= 246) go('stop');
        }
        break;
      }
      case 'stop': {
        if (c.v < -0.01) k.up = true;
        else if (ps.n > 80) go(A ? 'wait' : 'wait');
        break;
      }
      case 'wait': {
        const t = sim.c.trig.find((x) => x.id === (A ? 'parkA' : 'parkB'));
        if (t && t.st.done) go('exit');
        else if (ps.n > 240) go('rev3'); // nudge forward / back again
        break;
      }
      case 'rev3': { k.up = true; if (ps.n > 30) go('wait'); break; }
      case 'exit': {
        if (!A) break;
        k.up = c.v < 0.55;
        if (c.a < Math.PI - 0.1 && cy > 90) k.right = true;
        else if (c.a < Math.PI - 0.1) { /* still inside the bay: straight out first */ }
        else steerTo(Math.max(-0.3, Math.min(0.3, 1.5 * wrapA(Math.PI - c.a) + 0.02 * (c.y - 134))));
        break;
      }
      default: break;
    }
    return { k, p };
  }
}
