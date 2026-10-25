// Driving minigame — the courses (pure data builders; no DOM).  API doc: test-output/api_driving.txt
//
// buildCourse(stage, { wf, difficulty, variant, rng }) -> course:
//   path   [[x,y],...]   the centre line the player should follow (route; the autopilot and the guide arrow use it)
//   cum    cumulative length of path;  total
//   ribbons [{pts, hw}]  drivable lanes (capsule chains)   rects [{x,y,w,h}] drivable areas
//   walls  [{x,y,w,h,kind,col}] solid;  cones [{x,y}] collidable;  deco  poles / trees / buildings (no collision)
//   marks  painted things;  trig  [trigger]  rule triggers (see driving_core.js)
//   start {x,y,a};  limits [{s0,s1,kmh}];  slopes [{s0,s1,pull}];  keep [{s0,s1}]  (lane-keeping ranges)
//   script [..]  reverse manoeuvres for the autopilot (parking)
// Coordinates: x right, y down, heading a = 0 east, +π/2 south (a right turn increases a).  Left-hand traffic.

const D2R = Math.PI / 180;
const hyp = Math.hypot;

// ------------------------------------------------------------------ path builder
class PB {
  constructor(x, y, a) {
    this.pts = [[x, y]];
    this.p = { x, y, a };
    this.cum = [0];
    this.hw = 22;
    this.ribbons = [];
    this.pend = []; // marks waiting for finalize: { fn(at) }
  }
  get L() { return this.cum[this.cum.length - 1]; }
  _push(x, y) {
    const l = this.pts[this.pts.length - 1];
    this.cum.push(this.L + hyp(x - l[0], y - l[1]));
    this.pts.push([x, y]);
  }
  width(hw) { this.hw = hw; return this; }
  // a sine-wave path (slalom): lateral = amp * sin(2π u / wl), back on the centre line at the end (heading restored)
  weave(len, amp, wl, o = {}) {
    const { x, y, a } = this.p;
    const n = Math.round(len / 5);
    const seg = [[x, y]];
    for (let i = 1; i <= n; i++) {
      const u = (len * i) / n;
      const lat = amp * Math.sin((2 * Math.PI * u) / wl);
      const px = x + Math.cos(a) * u - Math.sin(a) * lat, py = y + Math.sin(a) * u + Math.cos(a) * lat;
      this._push(px, py); seg.push([px, py]);
    }
    const last = this.pts[this.pts.length - 1];
    this.p = { x: last[0], y: last[1], a };
    if (!o.noRibbon) this.ribbons.push({ pts: seg, hw: this.hw });
    return this;
  }
  line(len, o = {}) {
    const { x, y, a } = this.p;
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    const n = Math.max(1, Math.round(len / 30));
    const seg = [[x, y]];
    for (let i = 1; i <= n; i++) { const px = x + (x1 - x) * i / n, py = y + (y1 - y) * i / n; this._push(px, py); seg.push([px, py]); }
    this.p = { x: x1, y: y1, a };
    if (!o.noRibbon) this.ribbons.push({ pts: seg, hw: this.hw });
    return this;
  }
  arc(side, R, deg, o = {}) {
    const s = side === 'r' ? 1 : -1;
    const { x, y, a } = this.p;
    const n = Math.max(2, Math.ceil(deg / 9));
    const seg = [[x, y]];
    const tot = deg * D2R;
    const cx = x - s * R * Math.sin(a), cy = y + s * R * Math.cos(a); // centre: perpendicular on the turning side
    for (let i = 1; i <= n; i++) {
      const th = tot * i / n;
      const ang = a + s * th;
      const px = cx + s * R * Math.sin(ang), py = cy - s * R * Math.cos(ang);
      this._push(px, py);
      seg.push([px, py]);
    }
    const last = this.pts[this.pts.length - 1];
    this.p = { x: last[0], y: last[1], a: a + s * tot };
    if (!o.noRibbon) this.ribbons.push({ pts: seg, hw: this.hw });
    return this;
  }
  // a mark at the current length (+off)
  mark(type, props = {}, off = 0) { this.pend.push({ type, s: this.L + off, ...props }); return this; }
  // position & heading at length s
  at(s) {
    const c = this.cum;
    s = Math.max(0, Math.min(this.L, s));
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    const a = this.pts[lo], b = this.pts[hi];
    const seg = c[hi] - c[lo] || 1;
    const t = (s - c[lo]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  sOf(x, y) {
    let best = 1e9, bs = 0;
    for (let i = 0; i < this.pts.length - 1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
      const d = hyp(x - (a[0] + dx * t), y - (a[1] + dy * t));
      if (d < best) { best = d; bs = this.cum[i] + t * Math.sqrt(l2); }
    }
    return bs;
  }
}

// fillet a corner polyline: corners [[x,y,R],...] -> dense point list
function fillet(corners) {
  const out = [[corners[0][0], corners[0][1]]];
  for (let i = 1; i < corners.length - 1; i++) {
    const [x, y, R] = corners[i];
    const p0 = corners[i - 1], p2 = corners[i + 1];
    let d1 = [x - p0[0], y - p0[1]], d2 = [p2[0] - x, p2[1] - y];
    const l1 = hyp(...d1), l2 = hyp(...d2);
    d1 = [d1[0] / l1, d1[1] / l1]; d2 = [d2[0] / l2, d2[1] / l2];
    const cross = d1[0] * d2[1] - d1[1] * d2[0];
    const dot = d1[0] * d2[0] + d1[1] * d2[1];
    if (!R || Math.abs(cross) < 1e-3) { out.push([x, y]); continue; }
    const turn = Math.atan2(cross, dot); // + = right turn (screen coords)
    const t = R * Math.tan(Math.abs(turn) / 2);
    const s = cross > 0 ? 1 : -1;
    const a0 = Math.atan2(d1[1], d1[0]);
    const sx = x - d1[0] * t, sy = y - d1[1] * t;
    const cx = sx - s * R * Math.sin(a0), cy = sy + s * R * Math.cos(a0);
    const n = Math.max(3, Math.ceil(Math.abs(turn) / (8 * D2R)));
    out.push([sx, sy]);
    for (let k = 1; k <= n; k++) {
      const ang = a0 + s * Math.abs(turn) * k / n;
      out.push([cx + s * R * Math.sin(ang), cy - s * R * Math.cos(ang)]);
    }
  }
  out.push([corners[corners.length - 1][0], corners[corners.length - 1][1]]);
  return out;
}

function pbFromPts(pts) {
  const pb = new PB(pts[0][0], pts[0][1], 0);
  for (let i = 1; i < pts.length; i++) pb._push(pts[i][0], pts[i][1]);
  const l = pts[pts.length - 1], p = pts[pts.length - 2];
  pb.p = { x: l[0], y: l[1], a: Math.atan2(l[1] - p[1], l[0] - p[0]) };
  return pb;
}

// finalize: marks -> triggers.  Each mark: { type, s, ...props }
function finish(pb, extra) {
  const c = {
    path: pb.pts, cum: pb.cum, total: pb.L,
    ribbons: pb.ribbons, rects: [], walls: [], cones: [], deco: [], marks: [], trig: [], limits: [], slopes: [], keep: [],
    start: { ...pb.at(0), x: pb.pts[0][0], y: pb.pts[0][1] },
    script: null, name: '', ...extra,
  };
  c._pb = pb;
  return c;
}
const pl = (pb, s, lat = 0) => { const q = pb.at(s); return { x: q.x - Math.sin(q.a) * lat, y: q.y + Math.cos(q.a) * lat, a: q.a, dx: Math.cos(q.a), dy: Math.sin(q.a) }; };

// attach a trigger at path length s: plane (x,y,dx,dy)
function plane(pb, s) { const q = pl(pb, s); return { x: q.x, y: q.y, dx: q.dx, dy: q.dy }; }

// ------------------------------------------------------------------ yard sections (all on a PB)
const YARD_HW = 24;
function secStop(pb, c, id, at, say, opts = {}) {
  // a painted stop line ('停止線') across the lane at length `at`, and the stop-position check
  const q = pl(pb, at);
  const hw = opts.hw || pb.hw;
  c.marks.push({ t: 'stopline', x: q.x, y: q.y, dx: q.dx, dy: q.dy, hw, kind: 'mark' });
  c.trig.push({ type: 'stopmark', id, ...plane(pb, at), near: -30, far: 7, final: !!opts.final, hill: !!opts.hill, say });
}
function secSlope(pb, c, s0, s1, pull = 0.02) {
  c.slopes.push({ s0, s1, pull });
  c.marks.push({ t: 'slope', s0, s1 });
}
function secRail(pb, c, at, id = 'rail') {
  const q = pl(pb, at);
  c.marks.push({ t: 'rail', x: q.x, y: q.y, dx: q.dx, dy: q.dy, hw: pb.hw + 14 });
  c.trig.push({ type: 'rail', id, ...plane(pb, at - 36), s: at, hw: pb.hw + 14, rail: [at - 7, at + 7], say: 'rail' });
}
function secTurn(pb, c, side, R, deg, say, sigNeed = 36) {
  const s0 = pb.L;
  pb.arc(side, R, deg);
  c.trig.push({ type: 'turn', side: side === 'l' ? 'l' : 'r', ...plane(pb, s0 - 6), a1: deg, say: side === 'l' ? 'turnL' : 'turnR', need: sigNeed });
  c.marks.push({ t: 'turnsign', side, s: s0 });
}

function yardCommon(pb, c, kmh) {
  c.limits.push({ s0: 0, s1: pb.L + 1, kmh });
  // painted centre dashes are drawn from the path by the art module
  c.bounds = null;
}

// lesson 1: start, accelerate, stop at the line, wide curve, stop at the line
function buildLesson1(wf) {
  const pb = new PB(0, 0, 0);
  pb.width(YARD_HW * wf);
  const c0 = {};
  const tmp = { marks: [], trig: [] };
  pb.mark('start');
  pb.line(250);
  const sA = 238; // first stop line
  pb.line(80);
  pb.arc('r', 70, 180);
  pb.line(190);
  pb.arc('l', 60, 90);
  pb.arc('r', 60, 90);
  pb.line(100);
  const sEnd = pb.L - 10;
  const c = finish(pb, { name: 'lesson1' });
  secStop(pb, c, 'stopA', sA, 'stop');
  secStop(pb, c, 'stopB', sEnd, 'goal', { final: true });
  yardCommon(pb, c, 25);
  c.hints = [{ s: 20, key: 'stop' }, { s: 330, key: 'scurve' }, { s: 700, key: 'goal' }];
  return c;
}

// crank & S-curve
function buildCrank(wf) {
  const pb = new PB(0, 0, 0);
  pb.width(YARD_HW * wf);
  pb.line(120);
  // S-curve (two arcs)
  pb.width(20 * wf);
  const sS = pb.L;
  pb.arc('l', 56, 80); pb.arc('r', 56, 80);
  pb.arc('r', 56, 80); pb.arc('l', 56, 80);
  pb.width(YARD_HW * wf);
  pb.line(70);
  // crank: left-right then right-left
  pb.width(18 * wf);
  const sC = pb.L;
  pb.line(40);
  pb.arc('l', 24, 90); pb.line(46); pb.arc('r', 24, 90); pb.line(40);
  pb.arc('r', 24, 90); pb.line(46); pb.arc('l', 24, 90);
  pb.line(40);
  pb.width(YARD_HW * wf);
  pb.line(120);
  const c = finish(pb, { name: 'crank' });
  secStop(pb, c, 'goal', pb.L - 14, 'goal', { final: true });
  yardCommon(pb, c, 20);
  c.hints = [{ s: 10, key: 'scurve' }, { s: sC - 40, key: 'crank' }, { s: pb.L - 120, key: 'goal' }];
  // poles at the crank's outer corners (decoration; the lane edge is the 脱輪 line)
  return c;
}

// hill start + level crossing
function buildHill(wf) {
  const pb = new PB(0, 0, 0);
  pb.width(YARD_HW * wf);
  pb.line(140);
  const sH0 = pb.L;
  pb.line(250);
  const sH1 = pb.L;
  pb.line(80);
  const sR = pb.L + 130;
  pb.line(260);
  pb.line(100);
  const c = finish(pb, { name: 'hill' });
  secSlope(pb, c, sH0, sH1, 0.02);
  secStop(pb, c, 'hillstop', sH0 + 115, 'hill', { hill: true });
  secRail(pb, c, sR);
  secStop(pb, c, 'goal', pb.L - 12, 'goal', { final: true });
  yardCommon(pb, c, 25);
  c.hints = [{ s: 40, key: 'hill' }, { s: sH1 + 30, key: 'rail' }, { s: pb.L - 120, key: 'goal' }];
  return c;
}

// 修了検定: the whole 所内 course
function buildKentei1(wf) {
  const pb = new PB(0, 0, 0);
  pb.width(YARD_HW * wf);
  pb.line(150);
  const hints = [{ s: 10, key: 'stop' }];
  const c0 = { marks: [], trig: [] };
  // straight with a stop line
  pb.line(120);
  const sStop = pb.L - 12;
  pb.line(60);
  // left turn
  hints.push({ s: pb.L - 40, key: 'turnL' });
  const trigs = [];
  const turnAt = (side, R, deg, key) => { const s0 = pb.L; pb.arc(side, R, deg); trigs.push({ type: 'turn', side, ...plane(pb, s0 - 4), a1: deg, say: key, need: 36 }); };
  turnAt('l', 40, 90, 'turnL');
  pb.line(110);
  hints.push({ s: pb.L - 30, key: 'turnR' });
  turnAt('r', 46, 90, 'turnR');
  pb.line(80);
  // S-curve
  hints.push({ s: pb.L, key: 'scurve' });
  pb.width(20 * wf);
  pb.arc('l', 56, 80); pb.arc('r', 56, 80);
  pb.arc('r', 56, 80); pb.arc('l', 56, 80);
  pb.width(YARD_HW * wf);
  pb.line(60);
  // crank
  hints.push({ s: pb.L, key: 'crank' });
  pb.width(18 * wf);
  pb.line(40);
  pb.arc('l', 24, 90); pb.line(46); pb.arc('r', 24, 90); pb.line(40);
  pb.arc('r', 24, 90); pb.line(46); pb.arc('l', 24, 90);
  pb.line(40);
  pb.width(YARD_HW * wf);
  pb.line(80);
  // hill
  hints.push({ s: pb.L, key: 'hill' });
  const sH0 = pb.L;
  pb.line(250);
  const sH1 = pb.L;
  pb.line(70);
  // level crossing
  hints.push({ s: pb.L, key: 'rail' });
  const sR = pb.L + 130;
  pb.line(250);
  pb.line(60);
  const c = finish(pb, { name: 'kentei1' });
  c.trig.push(...trigs);
  secStop(pb, c, 'stopA', sStop, 'stop');
  secSlope(pb, c, sH0, sH1, 0.02);
  secStop(pb, c, 'hillstop', sH0 + 115, 'hill', { hill: true });
  secRail(pb, c, sR);
  secStop(pb, c, 'goal', pb.L - 12, 'goal', { final: true });
  yardCommon(pb, c, 25);
  c.hints = hints;
  return c;
}

// two-wheelers: 一本橋 + slalom (variants: 'ippon' = the plank only, 'slalom' = the cones only, 'basic' = start / stop, default = both)
function buildMoto(wf, variant = '') {
  const pb = new PB(0, 0, 0);
  pb.width(26 * wf);
  const hints = [];
  const marks = [];
  const trigs = [];
  let sB0 = -1, sB1 = -1, sq0 = null;
  let stopA = -1;
  pb.line(variant === 'slalom' ? 90 : 110);
  if (variant === 'basic') {
    hints.push({ s: 10, key: 'stop' });
    pb.line(70);
    stopA = pb.L - 8;
    pb.line(60);
    pb.arc('r', 52, 180);
    pb.line(120);
  } else {
    if (variant !== 'slalom') {
      sB0 = pb.L;
      pb.width(7.5 * wf);
      pb.line(120);
      sB1 = pb.L;
      pb.width(26 * wf);
      hints.push({ s: 10, key: 'bridge' });
      pb.line(variant === 'ippon' ? 90 : 80);
    }
    if (variant !== 'ippon') {
      hints.push({ s: pb.L - 20, key: 'slalom' });
      sq0 = pb.p;
      pb.weave(104 * 3, 12, 104);
      pb.line(70);
    }
  }
  const c = finish(pb, { name: 'moto' });
  if (sB0 >= 0) {
    c.trig.push({ type: 'bridge', id: 'bridge', ...plane(pb, sB0), s0: sB0, s1: sB1, end: plane(pb, sB1), say: 'bridge' });
    c.marks.push({ t: 'bridge', s0: sB0, s1: sB1 });
  }
  if (sq0) for (let i = 0; i < 6; i++) c.cones.push({ x: sq0.x + Math.cos(sq0.a) * (26 + 52 * i), y: sq0.y + Math.sin(sq0.a) * (26 + 52 * i) });
  if (stopA >= 0) secStop(pb, c, 'stopA', stopA, 'stop');
  secStop(pb, c, 'goal', pb.L - 12, 'goal', { final: true });
  c.limits.push({ s0: 0, s1: pb.L + 1, kmh: 25 });
  hints.push({ s: pb.L - 100, key: 'goal' });
  c.hints = hints.sort((a, b) => a.s - b.s);
  c.vehicle = 'moto';
  return c;
}

// ------------------------------------------------------------------ parking (absolute coordinates, two phases)
function buildPark(wf, variant = '') {
  const c = {
    name: 'park', path: [], cum: [], total: 1, ribbons: [], rects: [], walls: [], cones: [], deco: [], marks: [], trig: [], limits: [], slopes: [], keep: [],
    start: { x: 24, y: 134, a: 0 }, script: [], hints: [],
  };
  // ---- A: 方向変換 (north-side garage)
  const roadA = { x: 0, y: 96, w: 440, h: 76 };
  const bayA = { x: 238, y: 28, w: 76, h: 70 };
  c.rects.push(roadA, bayA);
  c.walls.push({ x: 160, y: 0, w: 78, h: 96, kind: 'building', col: '#8b7a6a' }, { x: 314, y: 0, w: 126, h: 96, kind: 'building', col: '#7d8a9a' }, { x: 238, y: 0, w: 76, h: 28, kind: 'building', col: '#6e6a62' });
  c.marks.push({ t: 'bay', x: bayA.x + 6, y: bayA.y + 4, w: bayA.w - 12, h: bayA.h - 4, col: '#fff' });
  c.trig.push({ type: 'park', id: 'parkA', rect: { x: bayA.x + 14, y: bayA.y + 14, w: bayA.w - 28, h: bayA.h - 18 }, a: Math.PI / 2, tol: 14 * D2R, say: 'park1', next: 'exitA' });
  c.trig.push({ type: 'reach', id: 'exitA', rect: { x: 0, y: 96, w: 70, h: 76 }, a: Math.PI, tol: 60 * D2R, needId: 'parkA', ...(variant === 'tenkan' ? { final: true } : { warp: { x: 24, y: 324, a: 0 } }) });
  // ---- B: 縦列駐車 (left curb = north side)
  const roadB = { x: 0, y: 292, w: 440, h: 62 };
  const laneB = { x: 150, y: 270, w: 220, h: 22 };
  c.rects.push(roadB, laneB);
  const cy = 270 + 5;
  c.walls.push({ x: 150, y: 262, w: 220, h: 8, kind: 'curb', col: '#8a8f9e' });
  c.walls.push({ x: 170, y: 272, w: 32, h: 14, kind: 'car', col: '#d65a7a' });
  c.walls.push({ x: 302, y: 272, w: 32, h: 14, kind: 'car', col: '#4a8ad0' });
  c.marks.push({ t: 'bay', x: 208, y: 271, w: 88, h: 21, col: '#fff' });
  c.trig.push({ type: 'park', id: 'parkB', rect: { x: 216, y: 275, w: 70, h: 16 }, a: 0, tol: 8 * D2R, say: 'park2', final: true, lenient: true });
  // ---- route / guide path (for the arrow and the autopilot)
  c.path = [[24, 134], [330, 134], [380, 134], [24, 134]];
  c.hintsA = true;
  c.limits.push({ s0: 0, s1: 1e9, kmh: 15 });
  c.hints = [{ s: 0, key: 'park1' }];
  c.phaseHints = { exitA: 'park2' };
  c.total = 1;
  c.cum = [0, 306, 356, 712];
  c.noPathProgress = true;
  c.script = true;
  c.bounds = { x0: -20, y0: -10, x1: 460, y1: 450 };
  if (variant === 'tate') { c.start = { x: 24, y: 324, a: 0 }; c.phase0 = 1; }
  return c;
}

// ------------------------------------------------------------------ the town (路上)
const ROAD_HW = 34; // half road width
const LANE = 17;
const XS = [260, 700, 1140], YS = [200, 520];
const GRID_W = 1400, GRID_H = 720;
const V = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
const left = (d) => [d[1], -d[0]];
const right = (d) => [-d[1], d[0]];

// intersection kinds (for the approach we drive): 'sig' | 'stop' | 'plain'
const KIND_A = { V1H2: 'stop', V2H2: 'sig', V2H1: 'sig', V3H1: 'stop', V3H2: 'sig', V1H1: 'plain' };
const ROUTES = {
  A: {
    // clockwise: east on H2, left up V2, right along H1 past a parked car, right down V3 (railway), right along H2 home
    steps: [['V1H2', 'S'], ['V2H2', 'L'], ['V2H1', 'R'], ['V3H1', 'R'], ['V3H2', 'R'], ['V2H2', 'S'], ['V1H2', 'S']],
    kinds: { V1H2: 'stop', V2H2: 'sig', V2H1: 'sig', V3H1: 'stop', V3H2: 'sig' },
    rail: { road: 'V3', y: 360 }, parked: { road: 'H1', x: 930 }, zebra: [{ road: 'V2', y: 370 }, { road: 'H2', x: 560 }],
    end: { x: 70, y: 537 },
  },
  B: {
    // east on H2 through the lights, left up V3 (railway), left along H1, straight over V2, left down V1, right home
    steps: [['V1H2', 'S'], ['V2H2', 'S'], ['V3H2', 'L'], ['V3H1', 'L'], ['V2H1', 'S'], ['V1H1', 'L'], ['V1H2', 'R']],
    kinds: { V1H2: 'stop', V2H2: 'sig', V3H2: 'sig', V3H1: 'stop', V2H1: 'sig', V1H1: 'stop' },
    rail: { road: 'V3', y: 360 }, parked: { road: 'H1', x: 480 }, zebra: [{ road: 'V1', y: 370 }, { road: 'H2', x: 900 }],
    end: { x: 70, y: 537 },
  },
};
const ICOORD = (id) => ({ x: XS[+id[1] - 1], y: YS[+id[3] - 1] });

function buildTown(wf, variant = 'A', opts = {}) {
  const R = ROUTES[variant] || ROUTES.A;
  const c = {
    name: 'road', variant, ribbons: [], rects: [], walls: [], cones: [], deco: [], marks: [], trig: [], limits: [], slopes: [], keep: [],
    w: GRID_W, h: GRID_H, sigs: [], zebras: [],
  };
  // roads
  for (const y of YS) c.rects.push({ x: 0, y: y - ROAD_HW, w: GRID_W, h: ROAD_HW * 2, road: true, dir: 'h' });
  for (const x of XS) c.rects.push({ x: x - ROAD_HW, y: 0, w: ROAD_HW * 2, h: GRID_H, road: true, dir: 'v' });
  // rounded kerb corners (a square patch minus a quarter disc) at every intersection
  const RC = 18;
  for (const x of XS) for (const y of YS) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const px = x + sx * ROAD_HW, py = y + sy * ROAD_HW;
    c.rects.push({ x: sx > 0 ? px : px - RC, y: sy > 0 ? py : py - RC, w: RC, h: RC, corner: true, cut: { x: px + sx * RC, y: py + sy * RC, r: RC } });
  }
  // our route as corners
  const start = { x: 60, y: YS[1] - LANE };
  const corners = [[start.x, start.y, 0]];
  let d = V.E;
  const info = [];
  for (const [id, act] of R.steps) {
    const C = ICOORD(id);
    const L = left(d);
    const kx = C.x + L[0] * LANE, ky = C.y + L[1] * LANE;
    let d2 = d, Rr = 0;
    if (act === 'L') { d2 = left(d); Rr = 26; } else if (act === 'R') { d2 = right(d); Rr = 40; }
    // the corner is where the two lane lines meet: incoming lane line passes through K (offset LANE to the left of C),
    // outgoing lane line is offset LANE to the left of the new direction.  K = C + LANE*left(d) + LANE*left(d2) projected.
    const L2 = left(d2);
    let kk;
    if (act === 'S') kk = [kx, ky];
    else {
      // intersection of line (C + LANE*L) + t*d  and  (C + LANE*L2) + u*d2
      const px = C.x + L[0] * LANE, py = C.y + L[1] * LANE;
      const qx = C.x + L2[0] * LANE, qy = C.y + L2[1] * LANE;
      // solve px + t*d0 = qx + u*d2_0, py + t*d1 = qy + u*d2_1; d and d2 are perpendicular axis vectors
      if (d[0] !== 0) kk = [qx, py]; else kk = [px, qy];
    }
    corners.push([kk[0], kk[1], Rr]);
    info.push({ id, act, C, d: [...d], d2: [...d2], kind: R.kinds[id] || 'plain' });
    d = d2;
  }
  corners.push([R.end.x, R.end.y, 0]);
  // extend to start/end of each straight so segments are collinear with the fillets
  const pts = fillet(corners);
  const pb = pbFromPts(pts);
  c.path = pb.pts; c.cum = pb.cum; c.total = pb.L; c._pb = pb;
  c.start = { x: start.x, y: start.y, a: 0 };
  c.end = R.end;
  // per-intersection rules
  const cycle = { g: 360, y: 80 };
  info.forEach((it, i) => {
    const { C, d: din, act } = it;
    const L = left(din);
    const dist = it.kind === 'sig' ? 56 : 46;
    // stop line plane on the lane, before the intersection
    const sx = C.x - din[0] * dist + L[0] * LANE, sy = C.y - din[1] * dist + L[1] * LANE;
    const sS = pb.sOf(sx, sy);
    const q = pb.at(sS);
    const pln = { x: q.x, y: q.y, dx: Math.cos(q.a), dy: Math.sin(q.a) };
    const horizontal = din[0] !== 0;
    const sigId = it.id;
    if (it.kind === 'sig' && !c.sigs.some((q) => q.id === sigId)) c.sigs.push({ id: sigId, C });
    if (it.kind === 'sig') {
      c.trig.push({ type: 'signal', id: 'sig' + i, sig: sigId, axis: horizontal ? 'h' : 'v', ...pln, say: 'signal', cyc: cycle });
      c.marks.push({ t: 'stopline', ...pln, hw: LANE, kind: 'sig' });
    } else if (it.kind === 'stop') {
      c.trig.push({ type: 'stopline', id: 'stop' + i, ...pln, say: 'stop', sign: true });
      c.marks.push({ t: 'stopline', ...pln, hw: LANE, kind: 'stop' });
      c.marks.push({ t: 'stopsign', x: pln.x + L[0] * 28, y: pln.y + L[1] * 28 });
    }
    if (act !== 'S') {
      const t = act === 'L' ? 'l' : 'r';
      c.trig.push({ type: 'turn', side: t, id: 'turn' + i, ...pln, a1: 90, need: 36, say: act === 'L' ? 'turnL' : 'turnR' });
      c.hints = c.hints || [];
    }
    it.s = sS; it.pln = pln;
    // keep-left zones: after this intersection until 90px before the next
    const sExit = pb.sOf(C.x + (act === 'S' ? din[0] : it.d2[0]) * 70 + (act === 'S' ? L[0] : left(it.d2)[0]) * LANE, C.y + (act === 'S' ? din[1] : it.d2[1]) * 70 + (act === 'S' ? L[1] : left(it.d2)[1]) * LANE);
    it.sExit = sExit;
  });
  // hints
  c.hints = [{ s: 0, key: 'stop' }];
  info.forEach((it) => {
    const key = it.kind === 'sig' ? 'signal' : it.kind === 'stop' ? 'stop' : null;
    if (it.act === 'L') c.hints.push({ s: it.s - 90, key: 'turnL' });
    else if (it.act === 'R') c.hints.push({ s: it.s - 90, key: 'turnR' });
    else if (key) c.hints.push({ s: it.s - 90, key });
  });
  // keep ranges between intersections
  let prev = 0;
  for (const it of info) { if (it.s - 90 > prev + 60) c.keep.push({ s0: prev + 20, s1: it.s - 90 }); prev = it.sExit; }
  if (pb.L > prev + 80) c.keep.push({ s0: prev + 20, s1: pb.L - 40 });
  // speed limits: 40 on H roads, 30 on V roads (by the direction we travel at that s)
  const dirAt = (s) => { const a = pb.at(s).a; return Math.abs(Math.cos(a)) > 0.7 ? 'h' : 'v'; };
  let sPrev = 0, dPrev = dirAt(5);
  for (let s = 20; s <= pb.L; s += 20) {
    const dn = dirAt(s);
    if (dn !== dPrev) { c.limits.push({ s0: sPrev, s1: s, kmh: dPrev === 'h' ? 40 : 30 }); sPrev = s; dPrev = dn; }
  }
  c.limits.push({ s0: sPrev, s1: pb.L + 1, kmh: dPrev === 'h' ? 40 : 30 });
  // zebra crossings with live pedestrians (mid-block): find where the path crosses the listed road position
  for (const z of R.zebra) {
    let pt;
    if (z.road[0] === 'V') pt = { x: XS[+z.road[1] - 1], y: z.y }; else pt = { x: z.x, y: YS[+z.road[1] - 1] };
    // find path param near pt
    const sZ = pb.sOf(pt.x, pt.y);
    const q = pb.at(sZ);
    const dx = Math.cos(q.a), dy = Math.sin(q.a);
    const ok = hyp(pb.at(sZ).x - pt.x, pb.at(sZ).y - pt.y) < LANE + 6;
    if (!ok) continue;
    const stopS = sZ - 30;
    const sq = pb.at(stopS);
    const pln = { x: sq.x, y: sq.y, dx: Math.cos(sq.a), dy: Math.sin(sq.a) };
    c.trig.push({ type: 'cross', id: 'cw' + c.trig.length, ...pln, sZ, hw: ROAD_HW, say: 'cross' });
    c.zebras.push({ x: pb.at(sZ).x, y: pb.at(sZ).y, dx, dy, len: 14, hw: ROAD_HW });
    c.marks.push({ t: 'stopline', ...pln, hw: LANE, kind: 'cw' });
    c.hints.push({ s: sZ - 120, key: 'cross' });
  }
  // railway crossing
  {
    const rx = XS[+R.rail.road[1] - 1], ry = R.rail.y;
    const sR = pb.sOf(rx, ry);
    const q = pb.at(sR);
    const lq = { x: q.x, y: q.y, dx: Math.cos(q.a), dy: Math.sin(q.a) };
    const stopS = sR - 38;
    const sq = pb.at(stopS);
    c.trig.push({ type: 'rail', id: 'rail', x: sq.x, y: sq.y, dx: Math.cos(sq.a), dy: Math.sin(sq.a), s: sR, hw: LANE + 6, rail: [sR - 8, sR + 8], say: 'rail' });
    c.marks.push({ t: 'rail', x: q.x, y: q.y, dx: lq.dx, dy: lq.dy, hw: ROAD_HW });
    c.marks.push({ t: 'stopline', x: sq.x, y: sq.y, dx: Math.cos(sq.a), dy: Math.sin(sq.a), hw: LANE, kind: 'rail' });
    c.hints.push({ s: sR - 140, key: 'rail' });
    c.railAt = { x: q.x, y: q.y, dx: lq.dx, dy: lq.dy };
  }
  // a parked car in our lane (we pass it on the right)
  {
    const px = R.parked.road[0] === 'H' ? R.parked.x : XS[+R.parked.road[1] - 1];
    const py = R.parked.road[0] === 'H' ? YS[+R.parked.road[1] - 1] : R.parked.x;
    const sP = pb.sOf(px, py);
    const q = pb.at(sP);
    const dx = Math.cos(q.a), dy = Math.sin(q.a);
    // the car sits at the left curb: lane centre is 17 from the centre line, curb 17 further left; car width 12 (+ sits 4 from the curb)
    const nl = [dy, -dx];
    const cx = q.x + nl[0] * 5, cy = q.y + nl[1] * 5;
    const horiz = Math.abs(dx) > 0.5;
    c.walls.push(horiz ? { x: cx - 16, y: cy - 6.5, w: 32, h: 13, kind: 'car', col: '#7fbf7a', parked: true } : { x: cx - 6.5, y: cy - 16, w: 13, h: 32, kind: 'car', col: '#7fbf7a', parked: true });
    const aS = sP - 90;
    const aq = pb.at(aS);
    c.trig.push({ type: 'avoid', id: 'avoid', x: aq.x, y: aq.y, dx: Math.cos(aq.a), dy: Math.sin(aq.a), sCar: sP, say: 'avoid' });
    c.hints.push({ s: sP - 200, key: 'avoid' });
    c.parkedS = sP;
    // remove keep range around the car
    c.keep = c.keep.flatMap((k) => (sP > k.s0 && sP < k.s1 ? [{ s0: k.s0, s1: sP - 130 }, { s0: sP + 90, s1: k.s1 }] : [k])).filter((k) => k.s1 > k.s0 + 20);
  }
  // pick-up / drop-off for 第二種: two kerbside stops on straights
  if (opts.passenger) {
    const longest = [];
    for (let s = 120; s < pb.L - 200; s += 20) {
      const q0 = pb.at(s), q1 = pb.at(s + 100);
      if (Math.abs(q1.a - q0.a) < 0.02 && !c.keep.every((k) => !(s > k.s0 + 20 && s + 100 < k.s1))) longest.push(s);
    }
    const pick = longest.length ? longest[Math.floor(longest.length * 0.25)] : 400;
    const drop = longest.length ? longest[Math.floor(longest.length * 0.78)] : 900;
    for (const [kind, s0] of [['pickup', pick], ['drop', drop]]) {
      const q = pb.at(s0 + 60);
      c.trig.push({ type: 'pickup', id: kind, kind, x: q.x, y: q.y, dx: Math.cos(q.a), dy: Math.sin(q.a), s: s0 + 60, near: -34, far: 10, hold: 90, say: kind });
      c.marks.push({ t: 'pickup', x: q.x, y: q.y, dx: Math.cos(q.a), dy: Math.sin(q.a), kind });
      c.hints.push({ s: s0 - 80, key: kind });
    }
  }
  // goal: stop at the end
  {
    const sEnd = pb.L - 12;
    const q = pb.at(sEnd);
    c.trig.push({ type: 'stopmark', id: 'goal', x: q.x, y: q.y, dx: Math.cos(q.a), dy: Math.sin(q.a), near: -34, far: 8, final: true, say: 'goal' });
    c.marks.push({ t: 'stopline', x: q.x, y: q.y, dx: Math.cos(q.a), dy: Math.sin(q.a), hw: LANE, kind: 'mark' });
    c.hints.push({ s: pb.L - 140, key: 'goal' });
  }
  c.hints.sort((a, b) => a.s - b.s);
  c.bounds = { x0: 0, y0: 0, x1: GRID_W, y1: GRID_H };
  c.town = true;
  return c;
}

// ------------------------------------------------------------------ entry point
export const COURSE_STAGES = ['lesson1', 'crank', 'park', 'hill', 'kentei1', 'road', 'kentei2', 'second', 'moto'];

export function buildCourse(stage, o = {}) {
  const wf = o.wf || 1;
  let c;
  switch (stage) {
    case 'lesson1': c = buildLesson1(wf); break;
    case 'crank': c = buildCrank(wf); break;
    case 'park': c = buildPark(wf, o.variant || ''); break;
    case 'hill': c = buildHill(wf); break;
    case 'kentei1': c = buildKentei1(wf); break;
    case 'moto': c = buildMoto(wf, o.variant || ''); break;
    case 'road': c = buildTown(wf, o.variant || 'A'); break;
    case 'kentei2': c = buildTown(wf, o.variant || 'B'); break;
    case 'second': c = buildTown(wf, o.variant || 'A', { passenger: true }); break;
    default: c = buildLesson1(wf);
  }
  c.stage = stage;
  c.wf = wf;
  if (c._pb && !c.noPathProgress) for (const t of c.trig) if (t.x !== undefined) { t.sp = c._pb.sOf(t.x, t.y); if (!c.town) t.lat = Math.max(t.lat || 0, 44); }
  if (!c.bounds) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of c.ribbons) for (const [x, y] of r.pts) { x0 = Math.min(x0, x - r.hw); y0 = Math.min(y0, y - r.hw); x1 = Math.max(x1, x + r.hw); y1 = Math.max(y1, y + r.hw); }
    c.bounds = { x0: x0 - 60, y0: y0 - 60, x1: x1 + 60, y1: y1 + 60 };
    // never smaller than a screenful (the view is 427 x 240 world px)
    const bw = c.bounds.x1 - c.bounds.x0, bh = c.bounds.y1 - c.bounds.y0;
    if (bw < 460) { const d = (460 - bw) / 2; c.bounds.x0 -= d; c.bounds.x1 += d; }
    if (bh < 340) { const d = (340 - bh) / 2; c.bounds.y0 -= d; c.bounds.y1 += d; }
  }
  return c;
}

export { PB, fillet, pl };
// signal phase: EW green first, then NS (offset per intersection id)
export function sigOff(id) { return ((+id[1] || 0) * 131 + (+id[3] || 0) * 57) % 300; }
export function sigState(id, axis, t, cyc = { g: 360, y: 80 }) {
  const P = 2 * (cyc.g + cyc.y);
  let ph = (t + sigOff(id)) % P;
  if (axis === 'v') ph = (ph + cyc.g + cyc.y) % P;
  return ph < cyc.g ? 'g' : ph < cyc.g + cyc.y ? 'y' : 'r';
}
export const TOWN = { XS, YS, ROAD_HW, LANE, GRID_W, GRID_H };
