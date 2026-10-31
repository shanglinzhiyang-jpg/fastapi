// スーパープロ野球ロード — a ball in play, worked out by physics instead of dice:
//   1) the flight: exit speed, launch angle and spray → gravity, air drag (k = ½ρCdA/m ≈ 0.0061 /m) and backspin lift;
//      it lands, bounces, rolls, hits the wall or leaves the park; fair or foul by where it is when it passes the bags.
//   2) the fielders: each runs (speed by 走力, a reaction time by 守備力) to the earliest point he can reach the ball —
//      in the air (a catch) or on the ground (a pick-up); 捕球 decides a clean catch or a bobble.
//   3) the throws (肩力: 24–40 m/s, a relay on long throws) against the runners (走力: 6.4–8.7 m/s, a start delay, turns at the
//      bases): outs at first, force outs, double plays, tag-ups, extra bases taken or thrown out.
// The result is a timeline (the ball, every fielder, every runner, every throw, in seconds) that the 3D view plays back,
// and a play the rules apply exactly (game.js applyPlay). Pure logic (no DOM): node tests run it.
import { clamp, gauss } from './core.js';

export const G = 9.8, DT = 1 / 120, BALL_R = 0.037;
export const DRAG_K = 0.0061, LIFT_RATIO = 0.42;
export const BASES = [[0, 0], [19.4, 19.4], [0, 38.8], [-19.4, 19.4]]; // home, 1B, 2B, 3B
export const FENCE_H = 4.2;
export const fenceR = (deg) => 100 + 22 * Math.cos((clamp(deg, -45, 45) / 45) * (Math.PI / 2));
export const HOME_SPOTS = { P: [0, 17.2], C: [0, -1.2], '1B': [20.5, 26.5], '2B': [11.5, 39.5], SS: [-11.5, 39.5], '3B': [-19.5, 25.5], LF: [-40, 80], CF: [0, 95], RF: [40, 80] };
const INF = ['P', 'C', '1B', '2B', 'SS', '3B'];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const angOf = (x, y) => (Math.atan2(x, y) * 180) / Math.PI;

// ---------------------------------------------------------------- 1) the flight
// bb = { v (km/h), angle (deg), spray (deg, + toward right field) } → { f: [[x, y, h]] 60 a second, land, hr, foul, wall, rest }
export function flyBall(bb, o = {}) {
  const v0 = bb.v / 3.6, th = (bb.angle * Math.PI) / 180, ph = (bb.spray * Math.PI) / 180;
  let x = 0, y = 0.5, h = 0.9;
  let vx = v0 * Math.cos(th) * Math.sin(ph), vy = v0 * Math.cos(th) * Math.cos(ph), vh = v0 * Math.sin(th);
  const k = DRAG_K * (o.drag || 1);
  const lift = bb.angle > 6 ? LIFT_RATIO * clamp((bb.angle - 6) / 20, 0, 1) * (o.lift || 1) : bb.angle < -2 ? -0.15 : 0;
  const f = [[x, y, h]];
  let land = null, hr = false, foul = null, wall = null, rolling = false, step = 0, t = 0, fairDecided = false, bounces = 0;
  const out = (why) => ({ f, land, hr, foul: foul === true, wall, rest: [x, y], end: why, t });
  while (t < 14) {
    const sp = Math.hypot(vx, vy, vh);
    if (!rolling) {
      let ax = -k * sp * vx, ay = -k * sp * vy, ah = -G - k * sp * vh;
      if (lift && h > BALL_R + 0.01) { // lift: perpendicular to the velocity, in the vertical plane (backspin)
        const vhz = Math.hypot(vx, vy) || 1e-6, L = lift * k * sp * sp;
        ax += (-vh * vx) / vhz / sp * L; ay += (-vh * vy) / vhz / sp * L; ah += (vhz / sp) * L;
      }
      vx += ax * DT; vy += ay * DT; vh += ah * DT;
      x += vx * DT; y += vy * DT; h += vh * DT;
      if (h <= BALL_R) { // a bounce
        h = BALL_R;
        if (!land) { land = { t, x, y, i: f.length }; if (!fairDecided && Math.hypot(x, y) > 28) { fairDecided = true; foul = Math.abs(angOf(x, y)) > 45; if (foul) { f.push([x, y, h]); return out('foul'); } } }
        bounces++;
        const dirt = Math.hypot(x, y - 18) < 29 || Math.hypot(x, y) < 28;
        vh = -vh * (dirt ? 0.38 : 0.45); vx *= dirt ? 0.8 : 0.72; vy *= dirt ? 0.8 : 0.72;
        if (Math.abs(vh) < 1.4) { vh = 0; rolling = true; }
      }
    } else {
      const s2 = Math.hypot(vx, vy);
      const dirt = Math.hypot(x, y - 18) < 29 || Math.hypot(x, y) < 28;
      const dec = (dirt ? 3.0 : 1.9) * DT;
      if (s2 <= dec) { vx = 0; vy = 0; } else { vx -= (vx / s2) * dec; vy -= (vy / s2) * dec; }
      x += vx * DT; y += vy * DT;
      if (s2 < 0.25) { f.push([x, y, BALL_R]); if (!fairDecided) foul = Math.abs(angOf(x, y)) > 45 && Math.hypot(x, y) > 1.5; return out('rest'); }
    }
    // passing the bags decides fair / foul for the balls that land in the infield
    if (!fairDecided && land && Math.hypot(x, y) >= 27.4) { fairDecided = true; foul = Math.abs(angOf(x, y)) > 45; if (foul) { f.push([x, y, h]); return out('foul'); } }
    // the fence (or the stands beyond the foul lines)
    const r = Math.hypot(x, y), deg = angOf(x, y);
    if (r >= fenceR(deg)) {
      if (Math.abs(deg) > 45) { foul = true; f.push([x, y, h]); return out('stands'); }
      if (h > FENCE_H && !land) { hr = true; foul = false; f.push([x, y, h]); for (let i = 0; i < 40 && h > 0; i++) { x += vx / 60; y += vy / 60; h = Math.max(0, h + vh / 60); vh -= G / 60; f.push([x, y, Math.max(h, 0)]); } return out('hr'); }
      if (h > FENCE_H) { hr = true; foul = false; f.push([x, y, h]); return out('hr'); } // a bouncing ball over the wall: called a home run here
      if (!wall) wall = { t, i: f.length };
      const ux = x / r, uy = y / r, vr = vx * ux + vy * uy;
      if (vr > 0) { vx -= 1.4 * vr * ux; vy -= 1.4 * vr * uy; vx *= 0.7; vy *= 0.7; }
      x = ux * (fenceR(deg) - 0.05); y = uy * (fenceR(deg) - 0.05);
      if (!fairDecided) { fairDecided = true; foul = false; }
    }
    t += DT; step++;
    if (step % 2 === 0) f.push([x, y, h]);
  }
  return out('time');
}

// ---------------------------------------------------------------- 2) the fielders
const runSpeed = (p) => 6.4 + (p ? p.speed : 50) * 0.024; // m/s
const reaction = (p) => 0.42 - (p ? p.field : 50) * 0.0022; // s
const armSpeed = (p) => 24 + (p ? p.arm : 50) * 0.16; // m/s
const transfer = (p, of) => 1.0 - (p ? p.field : 50) * 0.003 + (of ? 0.4 : 0); // gather, set the feet, release
// how far a fielder gets in time t: accelerating (ACCEL m/s²) to his top speed sp
export const OF_READ = 0.12; // outfielders read the ball off the bat a moment longer
export const ACCEL = { inf: 9, of: 5.5 }; // infielders: a quick first step; outfielders: a longer run up
const runDist = (t, sp, a) => { const ta = sp / a; return t < ta ? 0.5 * a * t * t : 0.5 * sp * ta + sp * (t - ta); };
// the earliest a fielder (at spot, with player p) reaches the ball along its path: in the air below `catchH`, or on the ground
function intercept(F, fl, o) {
  const sp = runSpeed(F.p) * o.rangeK, re = reaction(F.p) + (F.pos === 'P' ? 0.25 : 0) + (INF.includes(F.pos) ? 0 : OF_READ);
  const reach = (0.75 + (F.p ? F.p.field : 50) * 0.005) * o.rangeK;
  const n = fl.f.length, landI = fl.land ? fl.land.i : n;
  const look = (i) => {
    const t = i / 60, [x, y, h] = fl.f[i];
    const air = i < landI;
    if (air && h > 2.7) return null;
    if (!air && h > 1.9) return null;
    const ballSp = Math.hypot(x - fl.f[i - 1][0], y - fl.f[i - 1][1]) * 60;
    const rch = reach - (air ? 0 : Math.max(0, ballSp - 22) * 0.03);
    const need = Math.max(0, dist([x, y], F.at) - Math.max(0.3, rch));
    const can = runDist(Math.max(0, t - re), sp, INF.includes(F.pos) ? ACCEL.inf : ACCEL.of);
    return { t, i, x, y, h, air, need, can, slack: (can - need) / sp, ballSp };
  };
  for (let i = 1; i < n; i++) {
    if (fl.hr && i >= n - 41) break;
    const c = look(i);
    if (!c || c.can < c.need) continue;
    if (!c.air) return c;
    // in the air: he settles under it and takes it at the last catchable moment before it lands (the slack there = time
    // to spare, in seconds: a lot = a routine catch, little = a running or diving catch)
    let best = c;
    for (let j = i + 1; j < landI; j++) { const d = look(j); if (d && d.can >= d.need && d.h <= 2.2) best = d; }
    return best;
  }
  return null;
}

// ---------------------------------------------------------------- 3) the play
// s = { bat (player), runners: [id|null x3], outs, def: { pos: player }, rng, bal, speedOf(id) }
export function resolveBall(bb, s) {
  const rng = s.rng || Math.random, bal = s.bal || { hit: 1, hr: 1 };
  const fl = flyBall(bb);
  const T = { fl, fielders: {}, runners: [], throws: [], ball: [], notes: [] };
  const o = { rangeK: 1 / Math.pow(bal.hit, 0.9) };
  const F = Object.entries(HOME_SPOTS).map(([pos, at]) => ({ pos, at, p: s.def[pos] }));
  for (const x of F) T.fielders[x.pos] = { from: x.at, path: [[0, x.at[0], x.at[1]]], pose: 'ready' };
  if (fl.hr) { // the trot around the bases
    T.runners.push({ id: s.bat.id, path: [[0, ...batBox(s.bat)], [0.9, ...batBox(s.bat)], ...runPath(0, 4, 0.9, 6.2).slice(1)] });
    s.runners.forEach((id, i) => { if (id) T.runners.push({ id, path: runPath(i + 1, 4, 0.6, 6.0, true) }); });
    return finish(T, s, { kind: 'HR', batterTo: 4, runners: s.runners.map((id, i) => (id ? { i, to: 4 } : null)).filter(Boolean) }, fl.f.length / 60 + 2.6);
  }
  // who gets to it first
  let best = null;
  // a ball in the air goes to whoever has the most time to spare (the outfielder camped under it, not the infielder racing
  // back); a ball on the ground to whoever gets to it first
  for (const x of F) {
    const c = intercept(x, fl, o); if (!c) continue;
    if (!best) { best = { F: x, c }; continue; }
    const b = best.c;
    if (c.air && !b.air) best = { F: x, c };
    else if (c.air && b.air ? c.slack > b.slack : !c.air && !b.air && c.t < b.t) best = { F: x, c };
  }
  const foulBall = fl.foul;
  if (foulBall && (!best || !best.c.air)) return finish(T, s, { kind: 'FOUL' }, Math.min(fl.f.length / 60, 3) + 0.5, true);
  if (!best) best = { F: F.find((x) => x.pos === 'CF'), c: { t: fl.f.length / 60, i: fl.f.length - 1, x: fl.rest[0], y: fl.rest[1], h: 0.04, air: false } };
  const { F: catcher, c } = best;
  T.fielders[catcher.pos].path.push([Math.max(c.t - 0.05, reaction(catcher.p)), c.x, c.y]);
  T.fielders[catcher.pos].pose = c.air ? 'catch' : 'field';
  T.who = catcher.pos; T.at = c;
  // a routine catch is almost always made (捕球 shaves the rare drop); with little time to spare it is a running / diving catch
  const cv = catcher.p ? catcher.p.catch : 50;
  const sure = c.slack >= 0.6 ? 0.997 - (99 - cv) * 0.00012 : clamp(0.45 + c.slack * 0.9 + (cv - 50) * 0.002, 0.3, 0.99);
  const caught = c.air && rng() < sure;
  const spdOf = (id) => runSpeed(id && s.speedOf ? { speed: s.speedOf(id) } : null);
  const bSpd = runSpeed(s.bat);
  const of = !INF.includes(catcher.pos);
  // the rest of the defence covers the bases
  const cover = (pos, base, t0 = 0.4) => { if (pos !== catcher.pos) { const b = BASES[base]; T.fielders[pos].path.push([t0 + dist(T.fielders[pos].from, b) / 7, b[0] + (base === 1 ? 0.6 : 0), b[1] + (base === 2 ? -0.5 : 0)]); } };
  // ------------------------------------------------ caught in the air
  if (caught || (c.air && foulBall && caught)) {
    const kind = !of && bb.angle > 45 ? 'PO' : bb.angle < 20 ? 'LO' : 'FO';
    const play = { kind, batterTo: -1, where: catcher.pos, runners: [] };
    const tc = c.t;
    // the batter runs anyway (and stops); runners go halfway with <2 outs, then tag up if they can make it
    T.runners.push({ id: s.bat.id, path: [[0, ...batBox(s.bat)], [0.75, ...batBox(s.bat)], [tc, ...lerpB(0, 1, clamp((tc - 0.75) * bSpd / 27.43, 0, 0.8))], [tc + 1.2, ...lerpB(0, 1, clamp((tc - 0.75) * bSpd / 27.43, 0, 0.8))]], out: tc });
    let outs = s.outs + 1;
    const arm = armSpeed(catcher.p);
    for (let i = 2; i >= 0; i--) {
      const id = s.runners[i]; if (!id) continue;
      const lead = leadPos(i);
      if (outs >= 3 || i === 0) { T.runners.push({ id, path: [[0, ...lead], [tc + 0.8, ...BASES[i + 1]]] }); play.runners.push({ i, to: i + 1 }); continue; }
      // tag up from 2nd or 3rd
      const tgt = BASES[(i + 2) % 4];
      const tRun = tc + 0.25 + 27.43 / spdOf(id);
      const tThrow = tc + transfer(catcher.p, of) + throwTime(dist([c.x, c.y], tgt), arm);
      const go = tRun + 0.35 + gauss(rng) * 0.2 < tThrow;
      if (go && !(i === 1 && play.runners.some((r) => r.i === 2 && r.to === 3))) {
        const safe = tRun < tThrow + gauss(rng) * 0.12;
        T.runners.push({ id, path: [[0, ...lead], [tc, ...BASES[i + 1]], [tRun, ...tgt]], out: safe ? null : tThrow });
        T.throws.push({ t0: tc + transfer(catcher.p, of), t1: tThrow, from: [c.x, c.y], to: tgt });
        if (safe) play.runners.push({ i, to: i + 2 }); else { play.runners.push({ i, to: -1 }); outs++; }
        if (i === 2 && safe) play.sf = true;
      } else { T.runners.push({ id, path: [[0, ...lead], [tc + 0.6, ...BASES[i + 1]]] }); play.runners.push({ i, to: i + 1 }); }
    }
    const end = Math.max(tc + 1.6, ...T.throws.map((x) => x.t1 + 0.8));
    return finish(T, s, play, end);
  }
  // ------------------------------------------------ a dropped fly: it falls in (scored as a hit off the glove)
  // ------------------------------------------------ fielded on the ground (or picked up after it falls in)
  const tf = c.t + (c.air ? 0.6 : 0) + (!c.air && c.slack < 0.25 ? 0.3 : 0) + (rng() < 0.012 + (c.ballSp > 30 ? 0.02 : 0) - ((catcher.p ? catcher.p.catch : 50) - 50) * 0.0002 ? 0.9 : 0); // a bobble
  const pf = [c.x, c.y];
  const arm = armSpeed(catcher.p);
  // an outfielder who ran back toward the wall has to stop and turn before he throws
  const wentBack = of && Math.hypot(c.x, c.y) > Math.hypot(catcher.at[0], catcher.at[1]) + 3;
  const tr = transfer(catcher.p, of) + (wentBack ? 0.45 : 0) + (fl.wall && c.t > fl.wall.t ? 0.3 : 0);
  const infield = !of && Math.hypot(c.x, c.y) < 42 && !(c.air);
  const startB = 0.65, tB = (b) => startB + (27.43 * b) / bSpd + 0.3 * Math.max(0, b - 1);
  const tR = (i, b, id, start) => start + ((27.43 * (b - i)) - 2.4) / spdOf(id) + 0.3 * Math.max(0, b - i - 1);
  if (infield) {
    // infield grounder: covers; the forced runners; the out at first or the double play
    cover('1B', 1, 0.2); if (catcher.pos === '1B') cover('P', 1, 0.3);
    cover(c.x > 0 ? 'SS' : '2B', 2, 0.2); cover('C', 0, 0); if (catcher.pos === '3B' || catcher.pos === 'P') cover('SS', 3, 0.3);
    const forced = [!!s.runners[0], !!s.runners[0] && !!s.runners[1], !!s.runners[0] && !!s.runners[1] && !!s.runners[2]];
    const tThrow = (b) => tf + tr + throwTime(dist(pf, BASES[b]), arm) + (b === 1 && catcher.pos === '1B' ? -tr - throwTime(dist(pf, BASES[1]), arm) + Math.max(0.2, dist(pf, BASES[1]) / 7) : 0);
    const play = { kind: 'GO', batterTo: 1, where: catcher.pos, runners: [] };
    let outs = s.outs;
    const runStart = 0.15;
    // a double play: the lead force at second, then the relay to first
    const t2 = tThrow(2), r1 = s.runners[0];
    if (r1 && outs < 2 && dist(pf, BASES[2]) > 4) {
      const tr1 = tR(1, 2, r1, runStart);
      if (t2 < tr1 - 0.05) {
        const relay = t2 + 0.62 + throwTime(27.43, armSpeed(s.def[c.x > 0 ? 'SS' : '2B']));
        const dp = relay < tB(1) + gauss(rng) * 0.1;
        T.throws.push({ t0: tf + tr, t1: t2, from: pf, to: BASES[2] });
        if (dp) T.throws.push({ t0: t2 + 0.62, t1: relay, from: BASES[2], to: BASES[1] });
        T.runners.push({ id: r1, path: [[0, ...leadPos(0)], [tr1, ...BASES[2]]], out: t2 });
        play.runners.push({ i: 0, to: -1 }); outs++;
        if (dp) { play.kind = 'DP'; play.batterTo = -1; outs++; T.runners.push({ id: s.bat.id, path: [[0, ...batBox(s.bat)], [startB, ...batBox(s.bat)], [tB(1), ...BASES[1]], [tB(1) + 0.6, BASES[1][0] + 2, BASES[1][1] - 1]], out: relay }); }
        else { play.kind = 'FC'; T.runners.push({ id: s.bat.id, path: [[0, ...batBox(s.bat)], [startB, ...batBox(s.bat)], [tB(1), ...BASES[1]], [tB(1) + 0.6, BASES[1][0] + 2, BASES[1][1] - 1]] }); }
        advanceOthers(T, play, s, [1, 2], outs, tf, tR, runStart, forced);
        return finish(T, s, play, Math.max(...T.throws.map((x) => x.t1)) + 1.2);
      }
    }
    // the out at first
    const t1 = tThrow(1);
    const safe = tB(1) < t1 + gauss(rng) * 0.08;
    T.throws.push({ t0: catcher.pos === '1B' ? t1 - 0.01 : tf + tr, t1, from: pf, to: BASES[1], walk: catcher.pos === '1B' });
    T.runners.push({ id: s.bat.id, path: [[0, ...batBox(s.bat)], [startB, ...batBox(s.bat)], [tB(1), ...BASES[1]], [tB(1) + 0.6, BASES[1][0] + 2, BASES[1][1] - 1]], out: safe ? null : t1 });
    if (safe) { play.kind = '1B'; play.infieldHit = true; } else { play.batterTo = -1; outs++; }
    advanceOthers(T, play, s, [0, 1, 2], outs, tf, tR, runStart, forced, safe);
    return finish(T, s, play, Math.max(t1, tB(1)) + 1.2);
  }
  // ------------------------------------------------ a hit to the outfield (or past the infield): extra bases or not
  const play = { kind: '1B', batterTo: 1, runners: [], where: catcher.pos };
  if (catcher.pos === 'CF' || catcher.pos === 'LF' || catcher.pos === 'RF') { cover('SS', 2, 0.3); cover('2B', 2, 0.3); }
  cover('1B', 1, 0.2); cover('C', 0, 0); cover('3B', 3, 0.3);
  const relayK = (d) => (d > 58 ? 0.25 : 0);
  const tThrowTo = (b) => tf + tr + throwTime(dist(pf, BASES[b % 4]), arm) + relayK(dist(pf, BASES[b % 4]));
  // the batter: as far as he can go before the throw (a cautious margin, a little randomness)
  let bBase = 1;
  for (let b = 2; b <= 4; b++) { if (tB(b) + 0.35 + gauss(rng) * 0.15 < tThrowTo(b)) bBase = b; else break; }
  // runners, the lead first; a trailing runner stops behind the one ahead
  let ahead = 5, sendT = null, outs = s.outs;
  const decide = [];
  for (let i = 2; i >= 0; i--) {
    const id = s.runners[i]; if (!id) continue;
    const start = bb.angle > 18 && outs < 2 ? Math.max(0.2, c.t - 0.6) : 0.15; // on a fly they wait to see it drop
    let base = i + 2; // one base at least (forced or not, on a clean hit)
    for (let b = i + 3; b <= 4; b++) { if (b >= ahead) break; if (tR(i + 1, b, id, start) + 0.35 + gauss(rng) * 0.25 < tThrowTo(b % 4 === 0 ? 0 : b)) base = b; else break; }
    base = Math.min(base, ahead - 1, 4);
    if (ahead <= 4 && base >= ahead) base = ahead - 1;
    decide.push({ i, id, base, start });
    ahead = base;
  }
  if (bBase >= ahead) bBase = Math.max(1, ahead - 1);
  // the throw goes to the lead runner who is trying for home (or third); he may be out
  const tgt = decide.find((d) => d.base === 4) || decide.find((d) => d.base === 3);
  for (const d of decide) {
    const tb = d.base === 4 ? 0 : d.base;
    const tArr = tR(d.i + 1, d.base, d.id, d.start);
    let out = null;
    if (d === tgt) { sendT = tThrowTo(tb); T.throws.push({ t0: tf + tr, t1: sendT, from: pf, to: BASES[tb] }); if (tArr > sendT + gauss(rng) * 0.15 && outs < 3) { out = sendT; outs++; } }
    T.runners.push({ id: d.id, path: runPath(d.i + 1, d.base, d.start, spdOf(d.id), true), out });
    play.runners.push({ i: d.i, to: out ? -1 : d.base });
  }
  if (!tgt) { const b = Math.min(bBase + 1, 4) % 4; sendT = tThrowTo(bBase >= 3 ? 0 : b); T.throws.push({ t0: tf + tr, t1: sendT, from: pf, to: BASES[bBase >= 3 ? 0 : b] }); }
  play.batterTo = bBase;
  play.kind = bBase >= 4 ? 'HR' : ['1B', '2B', '3B'][bBase - 1];
  if (bBase >= 4) play.inside = true;
  T.runners.push({ id: s.bat.id, path: [[0, ...batBox(s.bat)], [startB, ...batBox(s.bat)], ...runPath(0, bBase, startB, bSpd).slice(1)] });
  const end = Math.max(...T.runners.map((r) => r.path[r.path.length - 1][0]), sendT || 0) + 1.0;
  return finish(T, s, play, end);
}
// runners not involved in the out at first: forced ones move up; others go on a grounder when it is safe
function advanceOthers(T, play, s, idxs, outs, tf, tR, start, forced, batterSafe = true) {
  for (const i of [2, 1, 0]) {
    if (!idxs.includes(i)) continue;
    const id = s.runners[i]; if (!id || play.runners.some((r) => r.i === i)) continue;
    let to = i + 1;
    if (!forced[i]) { // a free runner: 3rd goes home on a slow grounder or with 2 outs; 2nd moves up on a ball to the right side
      const go = outs >= 2 || (tR(i + 1, i + 2, id, start) + 0.4 < tf + 0.9);
      to = go ? i + 2 : i + 1;
      if (!go) { T.runners.push({ id, path: [[0, ...leadPos(i)], [0.8, ...BASES[i + 1]]] }); play.runners.push({ i, to: i + 1 }); continue; }
    } else to = i + 2;
    if (outs >= 3) { T.runners.push({ id, path: runPath(i + 1, to, start, 7.5, true) }); play.runners.push({ i, to }); continue; }
    T.runners.push({ id, path: runPath(i + 1, to, start, 7.5, true) });
    play.runners.push({ i, to });
  }
  void batterSafe;
}
const throwTime = (d, v) => (d / v) * 1.08 + 0.05;
const lerpB = (a, b, k) => [BASES[a % 4][0] + (BASES[b % 4][0] - BASES[a % 4][0]) * k, BASES[a % 4][1] + (BASES[b % 4][1] - BASES[a % 4][1]) * k];
const leadPos = (i) => lerpB(i + 1, i + 2, 2.4 / 27.43);
const batBox = (p) => [p && p.bats === 'L' ? 0.95 : -0.95, 0.05];
// a runner's waypoints from base `fromB` (1..3, or 0 = home) to base `toB` (… 4 = home), starting at `start` s
function runPath(fromB, toB, start, sp, lead = false) {
  const path = [[0, ...(lead ? lerpB(fromB, fromB + 1, 2.4 / 27.43) : BASES[fromB % 4])]];
  let t = start;
  path.push([start, ...path[0].slice(1)]);
  for (let b = fromB + 1; b <= toB; b++) { t += (27.43 - (b === fromB + 1 && lead ? 2.4 : 0)) / sp + (b > fromB + 1 ? 0.3 : 0); path.push([t, ...BASES[b % 4]]); }
  return path;
}
// the end of the play: pad the timelines and hand back the play
function finish(T, s, play, end, foul = false) {
  T.end = end;
  T.play = play;
  T.foul = foul;
  return T;
}
// sample a path [[t, x, y]...] at time t
export function pathAt(path, t) {
  if (!path || !path.length) return null;
  if (t <= path[0][0]) return [path[0][1], path[0][2]];
  for (let i = 1; i < path.length; i++) {
    const [t1, x1, y1] = path[i], [t0, x0, y0] = path[i - 1];
    if (t <= t1) { const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1; return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, true]; }
  }
  const l = path[path.length - 1]; return [l[1], l[2]];
}
// where the ball is at t: flying (the flight), in a glove, or thrown (an arc)
export function ballAt(T, t) {
  const fl = T.fl, c = T.at;
  if (!c || T.foul) { const i = Math.min(fl.f.length - 1, Math.floor(t * 60)); return fl.f[i]; }
  if (t < c.t) { const i = Math.min(fl.f.length - 1, Math.floor(t * 60)); return fl.f[i]; }
  // after the catch: thrown, or in the glove of whoever has it last
  let pos = [c.x, c.y, 1.0];
  for (const th of T.throws) {
    if (t < th.t0) break;
    if (t <= th.t1) { const k = (t - th.t0) / Math.max(0.01, th.t1 - th.t0); const d = dist(th.from, th.to); return [th.from[0] + (th.to[0] - th.from[0]) * k, th.from[1] + (th.to[1] - th.from[1]) * k, 1.4 + Math.sin(k * Math.PI) * d * 0.04]; }
    pos = [th.to[0], th.to[1], 1.0];
  }
  if (T.throws.length === 0 || t < T.throws[0].t0) { const fp = pathAt(T.fielders[T.who].path, t); if (fp) pos = [fp[0], fp[1], 1.0]; }
  return pos;
}

// ---------------------------------------------------------------- the contact: how the bat meets the ball
// q: quality 0..1 (the sweet spot and the timing), dyN: the ball below (+) / above (−) the sweet spot (→ the launch angle),
// e: timing in frames (− early → pulled), win: the timing window, power: 強振. → { v (km/h), angle, spray }
export function contactBall({ bat, q, dyN, e, win, power: pw, bal, rng = Math.random }) {
  const pull = bat.bats === 'L' ? 1 : -1; // a right-handed batter pulls to left field (negative spray)
  const v = clamp(CONTACT.v0 + CONTACT.vq * q + (bat.power - 50) * CONTACT.vp + (pw ? 8 : 0) + gauss(rng) * 5 + ((bal ? bal.hr : 1) - 1) * 11, 40, 194);
  const angle = CONTACT.a0 - dyN * CONTACT.ad + gauss(rng) * 7 + (pw ? 4 : 0);
  const spray = clamp((-e / win) * 34 * -pull + gauss(rng) * 16, -58, 58);
  return { v, angle, spray };
}
export const CONTACT = { v0: 80, vq: 96, vp: 0.42, a0: 9, ad: 48 };
