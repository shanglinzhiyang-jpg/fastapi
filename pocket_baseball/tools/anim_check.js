// 第 2 段の動き (js/three/clips.js) の点検 (ブラウザなし): 選手モデルの骨の長さで、
// 手足が届くか・足首が地面の上か・バットを握ったままか (握りの補正のあと)・印の時刻・狙った点 (芯・リリース・ポケット・ベース) に届くか。
// 使い方: node tools/anim_check.js [--clip <名前>] [--json] [--verbose]   失敗があれば終了コード 1
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "static");
const args = process.argv.slice(2);
const opt = { clip: null, json: false, verbose: false };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--clip") opt.clip = args[++i];
  else if (args[i] === "--json") opt.json = true;
  else if (args[i] === "--verbose" || args[i] === "-v") opt.verbose = true;
}
const T0 = Date.now();

/* ---------- 読み込み (three.js・anim.js・clips.js を vm で) ---------- */
const ctx = { console, Math, Date, JSON, Set, Map, WeakMap, Object, Array, Number, String, Boolean, Error, Float64Array, Float32Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array, ArrayBuffer, DataView, Symbol, Promise, isFinite, isNaN, parseFloat, parseInt, performance };
ctx.window = ctx;
ctx.self = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ["vendor/three.min.js", "js/three/anim.js", "js/three/clips.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
const T = ctx.THREE;
const A = ctx.PB.Anim;

/* ---------- 骨 (models/player.json の休止姿勢) ---------- */
const J = JSON.parse(fs.readFileSync(path.join(ROOT, "models/player.json"), "utf8"));
const REST = {};
const PARENT = {};
for (const b of J.bones) REST[b.name] = new T.Vector3().fromArray(b.pos);
J.bones.forEach((b) => (PARENT[b.name] = b.parent >= 0 ? J.bones[b.parent].name : null));
const ARM = REST.lowerarm_l.distanceTo(REST.upperarm_l) + REST.hand_l.distanceTo(REST.lowerarm_l);
const LEG = REST.calf_l.distanceTo(REST.thigh_l) + REST.foot_l.distanceTo(REST.calf_l);
const D2R = Math.PI / 180;
const GRIP_MAX = 0.53; // hrig.js と同じ
const NAMES = ["Root", "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r", "thigh_l", "thigh_r"];
const LOCAL = {};
for (const n of NAMES) LOCAL[n] = n === "Root" ? new T.Vector3() : REST[n].clone().sub(REST[PARENT[n]]);
const EYE = new T.Vector3(0, J.extra.eyeL[1], J.extra.eyeL[2]).sub(REST.head);
const _q = new T.Quaternion();
const _e = new T.Euler();
const _s1 = new T.Vector3(1, 1, 1);
const M = {};
for (const n of NAMES) M[n] = new T.Matrix4();
const _lm = new T.Matrix4();
const _p = new T.Vector3();
const qE = (e, k) => _q.setFromEuler(_e.set(e[0] * D2R * k, e[1] * D2R * k, e[2] * D2R * k, "YXZ"));

// ポーズ → 肩・股関節・目の位置 (キャラクター空間)、手首の目標 (バット・握りの補正込み)。hrig.js の apply と同じ順
function fk(p, lb) {
  const rot = { pelvis: [p.hips, 1], spine_01: [p.spine, 0.5], spine_02: [p.spine, 0.5], spine_03: [p.chest, 1], neck_01: [p.neck, 1], head: [p.head, 1] };
  let armL = p.armL.t;
  let armR = p.armR.t;
  const on = !!p.bat.on;
  const one = on && !!(p.flags && p.flags.batOne);
  const th = p.bat.th == null ? 0.085 : p.bat.th;
  const d = on ? A.nrm(p.bat.d) : null;
  const g = on ? p.bat.g.slice() : null;
  let top = null;
  if (on) {
    top = [g[0] + d[0] * th, g[1] + d[1] * th, g[2] + d[2] * th];
    if (lb) {
      armR = g;
      if (!one) armL = top;
    } else {
      armL = g;
      if (!one) armR = top;
    }
  }
  const clav = {};
  for (const s of ["l", "r"]) {
    const t = s === "l" ? armL : armR;
    const lift = Math.max(0, Math.min(1, (t[1] - 1.25) / 0.6));
    const fw = Math.max(-0.5, Math.min(1, t[2] / 0.5));
    clav["clavicle_" + s] = [-fw * 8, 0, (s === "l" ? 1 : -1) * lift * 16];
  }
  for (const n of NAMES) {
    const par = PARENT[n];
    _p.copy(LOCAL[n]);
    if (n === "pelvis") _p.set(_p.x + p.root[0], _p.y + p.root[1], _p.z + p.root[2]);
    const r = rot[n] || (clav[n] ? [clav[n], 1] : null);
    if (r) qE(r[0], r[1]);
    else _q.identity();
    _lm.compose(_p, _q, _s1);
    if (par) M[n].multiplyMatrices(M[par], _lm);
    else M[n].copy(_lm);
  }
  const P = (n) => new T.Vector3().setFromMatrixPosition(M[n]);
  const w = { shL: P("upperarm_l"), shR: P("upperarm_r"), hipL: P("thigh_l"), hipR: P("thigh_r"), eye: EYE.clone().applyMatrix4(M.head), armL, armR, g, d, th, on, one, fix: 0, rawL: armL, rawR: armR };
  // 握りの補正 (新しいクリップ = flags があるとき。hrig.js と同じ)
  if (on && p.flags) {
    const sB = lb ? w.shR : w.shL;
    const sT = lb ? w.shL : w.shR;
    const gg = g.slice();
    const tt = top.slice();
    const clampTo = (v, s) => {
      const dx = v[0] - s.x;
      const dy = v[1] - s.y;
      const dz = v[2] - s.z;
      const dd = Math.hypot(dx, dy, dz);
      if (dd <= GRIP_MAX) return 0;
      const k = GRIP_MAX / dd;
      v[0] = s.x + dx * k;
      v[1] = s.y + dy * k;
      v[2] = s.z + dz * k;
      return dd - GRIP_MAX;
    };
    let fix = 0;
    for (let it = 0; it < 3; it++) {
      fix += clampTo(gg, sB);
      for (let i = 0; i < 3; i++) tt[i] = gg[i] + d[i] * th;
      const mv = one ? 0 : clampTo(tt, sT);
      if (!mv) break;
      fix += mv;
      for (let i = 0; i < 3; i++) gg[i] = tt[i] - d[i] * th;
    }
    for (let i = 0; i < 3; i++) tt[i] = gg[i] + d[i] * th;
    w.g = gg;
    w.fix = fix;
    if (lb) {
      w.armR = gg;
      if (!one) w.armL = tt;
    } else {
      w.armL = gg;
      if (!one) w.armR = tt;
    }
  }
  return w;
}
const dist = (a, b) => Math.hypot(a[0] - (b.x != null ? b.x : b[0]), a[1] - (b.y != null ? b.y : b[1]), a[2] - (b.z != null ? b.z : b[2]));
// 手首の実際の位置 (届かなければ肩から腕の長さの所)
function wristAt(sh, t) {
  const v = [t[0] - sh.x, t[1] - sh.y, t[2] - sh.z];
  const d = Math.hypot(v[0], v[1], v[2]);
  const k = d > ARM ? ARM / d : 1;
  return [sh.x + v[0] * k, sh.y + v[1] * k, sh.z + v[2] * k];
}
// グラブのポケット: 手首 + 指 8.5 cm + 手のひら 3 cm (手の向き h はキャラクター空間。標準の手: 指 −Y・手のひら −X (左) / +X (右))
function pocketAt(w, p, side) {
  const sh = side === "L" ? w.shL : w.shR;
  const t = side === "L" ? w.armL : w.armR;
  const h = side === "L" ? p.armL.h : p.armR.h;
  const wr = wristAt(sh, t);
  _q.setFromEuler(_e.set(h[0] * D2R, h[1] * D2R, h[2] * D2R, "YXZ"));
  const f = new T.Vector3(0, -1, 0).applyQuaternion(_q);
  const n = new T.Vector3(side === "L" ? -1 : 1, 0, 0).applyQuaternion(_q);
  return [wr[0] + 0.085 * f.x + 0.03 * n.x, wr[1] + 0.085 * f.y + 0.03 * n.y, wr[2] + 0.085 * f.z + 0.03 * n.z];
}

/* ---------- 1 本のクリップの点検 ---------- */
const KINDS = { idle: 1, swing: 1, follow: 1, take: 1, bunt: 1, pitch: 1, throw: 1, field: 1, run: 1, slide: 1, dive: 1, jump: 1, umpire: 1, cheer: 1 };
const AIR = { dive: 1, slide: 1, jump: 1 };
const LIM = { keyHeld: 1.0, keyArm: 2.0, keyLeg: 1.5, sBat: 3.0, sArm: 12.0, sLeg: 3.0, ground: 0.05, release: 0.1, sweet: 0.03, bunt: 0.04, pocket: 0.05, bag: 0.1 };
const results = [];
let nFail = 0;
let nSamples = 0;
function checkClip(label, clip, o) {
  o = o || {};
  const lb = !!o.lb;
  const issues = [];
  const worst = { key: 0, keyWhat: "", bat: 0, batAt: "", arm: 0, armAt: "", leg: 0, legAt: "", ground: 9, groundAt: "", fix: 0 };
  const v = A.validate(clip);
  for (const e of v.errors) issues.push(e);
  if (!KINDS[clip.kind]) issues.push("kind " + clip.kind + " is not in the C2 list");
  for (const e of clip.events || []) if (e.set && e.set.kind && !KINDS[e.set.kind]) issues.push("event kind " + e.set.kind);
  const len = A.clipLength(clip);
  const marks = clip.marks || {};
  const gs = lb ? "R" : "L"; // グラブの手 (右投げで作ったクリップは左)
  const catchT = clip.target && clip.target.what === "pocket" ? clip.target.t : null;
  // キー: 届くか (バット・捕る瞬間のグラブは 1 cm、ほかの腕 2 cm、脚 1.5 cm)
  clip.forEach((k, i) => {
    const p = A.sample(clip, k.t);
    const w = fk(p, lb);
    const raw = { L: w.rawL, R: w.rawR };
    for (const s of ["L", "R"]) {
      const sh = s === "L" ? w.shL : w.shR;
      const over = (dist(raw[s], sh) - ARM) * 100;
      const bat = w.on && (!w.one || s === (lb ? "R" : "L"));
      const glove = catchT != null && Math.abs(k.t - catchT) < 1e-6 && s === gs;
      const lim = bat || glove ? LIM.keyHeld : LIM.keyArm;
      if (over > worst.key) {
        worst.key = over;
        worst.keyWhat = "k" + i + " arm" + s;
      }
      if (over > lim) issues.push(`key ${i} (t ${k.t}) arm${s} over ${over.toFixed(1)}cm` + (bat ? " (bat)" : glove ? " (glove at catch)" : ""));
    }
    for (const s of ["L", "R"]) {
      const over = (dist(p["leg" + s].t, s === "L" ? w.hipL : w.hipR) - LEG) * 100;
      if (over > LIM.keyLeg) issues.push(`key ${i} (t ${k.t}) leg${s} over ${over.toFixed(1)}cm`);
    }
  });
  // 120 Hz で動きの途中も (バットを持つ手は握りの補正のあと 3 cm、ほかの腕 12 cm、脚 3 cm、足首は地面の上)
  const kindAt = (p) => p.kind;
  const out = A.basePose();
  let bagWorst = 0;
  for (let i = 0, n = Math.ceil(len * 120); i <= n; i++) {
    const t = Math.min(len, i / 120);
    const p = A.sample(clip, t, out);
    const w = fk(p, lb);
    nSamples++;
    if (w.fix * 100 > worst.fix) worst.fix = w.fix * 100;
    for (const s of ["L", "R"]) {
      const sh = s === "L" ? w.shL : w.shR;
      const tt = s === "L" ? w.armL : w.armR;
      const over = (dist(tt, sh) - ARM) * 100;
      const bat = w.on && (!w.one || s === (lb ? "R" : "L"));
      if (bat) {
        if (over > worst.bat) {
          worst.bat = over;
          worst.batAt = "t" + t.toFixed(3) + " arm" + s;
        }
      } else if (over > worst.arm) {
        worst.arm = over;
        worst.armAt = "t" + t.toFixed(3) + " arm" + s;
      }
      const lo = (dist(p["leg" + s].t, s === "L" ? w.hipL : w.hipR) - LEG) * 100;
      if (lo > worst.leg) {
        worst.leg = lo;
        worst.legAt = "t" + t.toFixed(3) + " leg" + s;
      }
      const y = p["leg" + s].t[1];
      if (!AIR[kindAt(p)] && y < worst.ground) {
        worst.ground = y;
        worst.groundAt = "t" + t.toFixed(3) + " leg" + s;
      }
    }
    if (clip.bag) {
      const bf = lb ? p.legL.t : p.legR.t;
      const bd = Math.hypot(bf[0] - clip.bag[0], bf[2] - clip.bag[2]);
      if (bd > bagWorst) bagWorst = bd;
    }
  }
  if (worst.bat > LIM.sBat) issues.push(`sampled bat hand over ${worst.bat.toFixed(1)}cm at ${worst.batAt} (after the grip clamp)`);
  if (worst.arm > LIM.sArm) issues.push(`sampled arm over ${worst.arm.toFixed(1)}cm at ${worst.armAt}`);
  if (worst.leg > LIM.sLeg) issues.push(`sampled leg over ${worst.leg.toFixed(1)}cm at ${worst.legAt}`);
  if (worst.ground < LIM.ground) issues.push(`ankle y ${worst.ground.toFixed(3)} < ${LIM.ground} at ${worst.groundAt}`);
  if (clip.bag && bagWorst > LIM.bag) issues.push(`back foot ${(bagWorst * 100).toFixed(1)}cm from the bag`);
  // 狙った点
  const tg = clip.target;
  const res = {};
  if (tg) {
    const p = A.sample(clip, tg.t);
    const w = fk(p, lb);
    const S = tg.p;
    if (tg.what === "sweet" || tg.what === "bunt") {
      const along = tg.what === "sweet" ? A.BAT_SWEET : 0.55;
      const sp = [w.g[0] + w.d[0] * along, w.g[1] + w.d[1] * along, w.g[2] + w.d[2] * along];
      res.err = dist(sp, S);
      const lim = tg.what === "sweet" ? LIM.sweet : LIM.bunt;
      if (res.err > lim) issues.push(`${tg.what} spot ${(res.err * 100).toFixed(1)}cm from the target at t ${tg.t}`);
    } else if (tg.what === "release") {
      const want = lb ? [-A.PIT_REL_WRIST[0], A.PIT_REL_WRIST[1], A.PIT_REL_WRIST[2]] : A.PIT_REL_WRIST;
      const s = lb ? "L" : "R";
      const wr = wristAt(s === "L" ? w.shL : w.shR, s === "L" ? w.armL : w.armR);
      res.err = dist(wr, want);
      if (res.err > LIM.release) issues.push(`release wrist ${(res.err * 100).toFixed(1)}cm from the physics release`);
    } else if (tg.what === "pocket") {
      const pk = pocketAt(w, p, gs);
      res.err = dist(pk, S);
      if (res.err > LIM.pocket) issues.push(`glove pocket ${(res.err * 100).toFixed(1)}cm from the ball at t ${tg.t}`);
    }
  }
  if (clip.bag) res.bag = bagWorst;
  const ok = issues.length === 0;
  if (!ok) nFail++;
  results.push({ label, name: clip.name, ok, issues, worst, res, warns: v.warns, len, marks });
  return ok;
}

/* ---------- いろいろな型・パラメータで作って点検する ---------- */
const want = (n) => !opt.clip || n === opt.clip || n.indexOf(opt.clip + ".") === 0 || opt.clip.split(",").indexOf(n) >= 0;
function run(label, name, params, o) {
  if (!want(name)) return;
  let c;
  try {
    c = A.get(name, params);
  } catch (e) {
    nFail++;
    results.push({ label, name, ok: false, issues: ["build failed: " + e.message], worst: {}, res: {}, warns: [] });
    return;
  }
  checkClip(label, c, o);
  if (o && o.mirror) checkClip(label + " ~m", A.mirrorClip(c), { lb: true });
}
const S0 = A.STYLE0;
// 試合と同じ 2004 年の選手 (data.js の rosterTeam) の型
function rosterPlayers() {
  const ectx = { console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, isFinite, setTimeout, clearTimeout };
  ectx.window = ectx;
  vm.createContext(ectx);
  for (const f of ["util.js", "data.js", "npb.js", "rosters2004.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), ectx, { filename: f });
  const D = ectx.PB.D;
  const out = [];
  for (const t of D.newTeams()) for (const p of t.players) out.push(p);
  return out;
}
const players = rosterPlayers();
const styles = [];
const seen = new Set();
for (const p of players) {
  for (const side of p.bats === "S" ? ["R", "L"] : [p.bats === "L" ? "L" : "R"]) {
    const s = A.style(p, side);
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    styles.push({ p, s });
  }
}
// 名前の型が試合の選手に当たっているか
const formHits = Object.keys(A.FORMS).filter((n) => players.some((p) => A.formFor(p) === A.FORMS[n]));
const formMiss = Object.keys(A.FORMS).filter((n) => formHits.indexOf(n) < 0);

// 打撃
const MID = A.swingSolve({ bz: 0.8, away: 0, phi: 0 });
run("bat.stance default", "bat.stance", {}, { mirror: true });
run("bat.load default", "bat.load", {}, { mirror: true });
run("bat.take default", "bat.take", {});
run("bat.check default", "bat.check", {});
for (const bz of [0.45, 0.6, 0.8, 1.0, 1.15])
  for (const away of [-0.25, 0, 0.25])
    for (const az of [-30, 0, 30]) {
      const ct = A.swingSolve({ bz, away, phi: -az, side: "R" });
      run(`bat.swing bz${bz} away${away} az${az}`, "bat.swing", { ct }, { mirror: bz === 0.8 && away === 0 && az === 0 });
    }
for (const early of [-0.006, 0.0045]) run(`bat.swing early ${early}`, "bat.swing", { ct: A.swingSolve({ bz: 0.8, away: 0, phi: 0, vball: 38, early }) });
run("bat.swing whiff early", "bat.swing", { ct: A.swingSolve({ bz: 0.7, away: 0.1, e: -0.08, W: 0.085, inside: -0.1 }) });
run("bat.swing one-hand power", "bat.swing", { style: { power: 0.9, finish: "one" }, ct: A.swingSolve({ bz: 0.75, away: 0.08, phi: -10 }) }, { mirror: true });
run("bat.swing slap", "bat.swing", { style: { slap: true, open: 10, crouch: 0.4, handsH: 1.3, kick: "tap" }, ct: MID }, { mirror: true });
run("bat.swing uppercut", "bat.swing", { style: { uppercut: 1, power: 1 }, ct: MID });
for (const cz of [0.5, 0.8, 1.1]) for (const away of [-0.2, 0, 0.2]) run(`bat.bunt cz${cz} away${away}`, "bat.bunt", { S: [0.3, cz, A.BOX_X + away] }, { mirror: cz === 0.8 && away === 0 });
{
  const sw2 = A.get("bat.swing", { ct: MID });
  const sw1 = A.get("bat.swing", { style: { power: 0.9, finish: "one" }, ct: MID });
  const swS = A.get("bat.swing", { style: { slap: true }, ct: MID });
  const bu = A.get("bat.bunt", { S: [0.3, 0.8, A.BOX_X] });
  run("bat.dropRun two-hand", "bat.dropRun", { swing: sw2 }, { mirror: true });
  run("bat.dropRun one-hand", "bat.dropRun", { swing: sw1, style: { power: 0.9, finish: "one" } });
  run("bat.dropRun slap (L)", "bat.dropRun", { swing: swS, lhb: true, style: { slap: true } }, { mirror: true });
  run("bat.dropRun bunt", "bat.dropRun", { swing: bu });
}
// 名前の型と試合の全選手の型 (構え・始動・スイング (真ん中)・見送り)
for (const n in A.FORMS) {
  const s = A.fullStyle(A.FORMS[n]);
  run("bat.stance " + n, "bat.stance", { style: s });
  run("bat.load " + n, "bat.load", { style: s });
  run("bat.swing " + n, "bat.swing", { style: s, ct: MID });
  run("pit.windup " + n, "pit.windup", { style: s });
  run("pit.stretch " + n, "pit.stretch", { style: s });
}
let rosterBad = 0;
const nRes0 = results.length;
for (const { p, s } of styles) {
  const nm = (p.full || p.name) + " " + s.side;
  if (p.pos === "P") {
    run("pit.windup roster " + nm, "pit.windup", { style: s });
    run("pit.stretch roster " + nm, "pit.stretch", { style: s });
  } else {
    run("bat.load roster " + nm, "bat.load", { style: s });
    run("bat.swing roster " + nm, "bat.swing", { style: s, ct: MID });
    run("bat.take roster " + nm, "bat.take", { style: s });
  }
}
for (let i = nRes0; i < results.length; i++) if (!results[i].ok) rosterBad++;

// 投球
run("pit.stretch default", "pit.stretch", {}, { mirror: true });
run("pit.windup default", "pit.windup", {}, { mirror: true });
run("pit.windup chest", "pit.windup", { style: { handsOver: false } });
run("pit.windup lift 0.5 pause", "pit.windup", { style: { lift: 0.5, pause: 0.08 } });
run("pit.windup two-step", "pit.windup", { style: { pause: 0.15, pause2: true } });
run("pit.windup sub", "pit.windup", { style: { slot: "sub" } }, { mirror: true });
run("pit.stretch headDown", "pit.stretch", { style: { headDown: true } });
// 捕手 (ストライクゾーンの 9 点 + ワンバウンド 2 点。構えはボールの所 / 真ん中)
for (const x of [-0.2, 0, 0.2])
  for (const z of [0.5, 0.76, 1.05]) {
    run(`cat.receive ${x},${z}`, "cat.receive", { ball: [x, z], aim: [x, z] });
    run(`cat.receive ${x},${z} aim mid`, "cat.receive", { ball: [x, z], aim: [0, 0.76] });
  }
run("cat.receive dirt 0,0.15", "cat.receive", { ball: [0, 0.15], aim: [0, 0.6] });
run("cat.receive dirt 0.2,0.2", "cat.receive", { ball: [0.2, 0.2], aim: [0.15, 0.55] }, { mirror: true });
run("cat.throw2B", "cat.throw2B", {}, { mirror: true });
// 守備
for (const x of [-0.2, 0.12, 0.4]) for (const y of [0.04, 0.45, 0.9]) run(`fld.grounder ${x},${y}`, "fld.grounder", { ball: [x, y, 0.44] }, { mirror: x === 0.12 && y === 0.04 });
for (const v of ["quick", "hop", "long"]) run("fld.throw " + v, "fld.throw", { variant: v }, { mirror: v === "hop" });
run("fld.fly", "fld.fly", {}, { mirror: true });
for (const bz of [0.4, 0.8, 1.2, 1.6])
  for (const side of [-0.3, 0, 0.3]) {
    run(`fld.firstStretch ${bz},${side}`, "fld.firstStretch", { ballZ: bz, side }, { mirror: bz === 1.2 && side === 0 });
    run(`fld.receive ${bz},${side}`, "fld.receive", { ballZ: bz, side });
  }
// 走塁・審判
run("run.slideFeet", "run.slideFeet", {}, { mirror: true });
run("ump.strike", "ump.strike", {});
run("ump.safe", "ump.safe", {});

/* ---------- 走り v2 (速さごとに 3 秒: 0 から加速、途中で曲がる) ---------- */
const runRes = [];
if (want("run.cycle")) {
  for (const v of [1.4, 3.0, 6.2, 8.5, 9.2]) {
    const mem = {};
    const p = A.basePose();
    let steps = 0;
    let prevPh = null;
    const issues = [];
    const worst = { arm: 0, leg: 0, ground: 9, slip: 0 };
    let yaw = 0;
    for (let i = 0; i < 360; i++) {
      const dt = 1 / 120;
      if (i > 240) yaw += dt * 0.8; // 最後の 1 秒は曲がる
      A.runCycle(mem, v, dt, { arms: "run", yaw }, p);
      const w = fk(p, false);
      for (const s of ["L", "R"]) {
        const sh = s === "L" ? w.shL : w.shR;
        worst.arm = Math.max(worst.arm, (dist(p["arm" + s].t, sh) - ARM) * 100);
        worst.leg = Math.max(worst.leg, (dist(p["leg" + s].t, s === "L" ? w.hipL : w.hipR) - LEG) * 100);
        worst.ground = Math.min(worst.ground, p["leg" + s].t[1]);
      }
      const ph = (((mem.ph / (Math.PI * 2)) % 1) + 1) % 1;
      // 歩数 (半周ごと) は加速が終わった最後の 1.5 秒で数える
      if (i >= 180 && prevPh != null && ((prevPh < 0.5 && ph >= 0.5) || ph < prevPh)) steps++;
      prevPh = ph;
    }
    const sps = steps / 1.5;
    const want2 = { 3.0: 2.8, 6.2: 3.9, 8.5: 4.3 }[v];
    if (want2 && Math.abs(sps - want2) > 0.35) issues.push(`cadence ${sps.toFixed(2)} steps/s (want ${want2})`);
    if (worst.arm > LIM.sArm) issues.push(`arm over ${worst.arm.toFixed(1)}cm`);
    if (worst.leg > LIM.sLeg) issues.push(`leg over ${worst.leg.toFixed(1)}cm`);
    if (worst.ground < LIM.ground) issues.push(`ankle y ${worst.ground.toFixed(3)}`);
    // 接地している足は地面で止まっている: 1 歩のあいだのキャラクター空間の後ろ向きの速さ = 体の速さ
    const ok = !issues.length;
    if (!ok) nFail++;
    runRes.push({ v, sps, worst, issues, ok });
    results.push({ label: "run.cycle v" + v, name: "run.cycle", ok, issues, worst: { arm: worst.arm, leg: worst.leg, ground: worst.ground }, res: { sps }, warns: [] });
  }
}

/* ---------- 作る速さ (キャッシュなし) ---------- */
const speed = {};
if (!opt.clip) {
  const names = A.clipNames();
  for (let rep = 0; rep < 2; rep++)
    for (const n of names) {
      const N = rep ? 40 : 5;
      const t0 = performance.now();
      for (let i = 0; i < N; i++) {
        A.clearCache();
        A.get(n, n === "bat.swing" ? { ct: A.swingSolve({ bz: 0.5 + i * 0.01 }) } : {});
      }
      if (rep) speed[n] = (performance.now() - t0) / N;
    }
}
const speedMax = Math.max(0, ...Object.values(speed));
const speedMean = Object.values(speed).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(speed).length);

/* ---------- 今の動き (参考: 第 1 段の LIB / swingClip / pitchClip / throwClip) ---------- */
const legacy = [];
if (!opt.clip) {
  const audit = (name, p) => {
    const w = fk(p, false);
    const out = [];
    for (const s of ["L", "R"]) {
      const over = (dist(s === "L" ? w.armL : w.armR, s === "L" ? w.shL : w.shR) - ARM) * 100;
      if (over > 0.4) out.push(`arm${s} over ${over.toFixed(1)}cm`);
      const lo = (dist(p["leg" + s].t, s === "L" ? w.hipL : w.hipR) - LEG) * 100;
      if (lo > 0.4) out.push(`leg${s} over ${lo.toFixed(1)}cm`);
    }
    if (out.length) legacy.push(name + ": " + out.join(", "));
  };
  for (const k of Object.keys(A.LIB)) audit("LIB." + k, A.LIB[k]);
  A.swingClip(0.8, 0).forEach((k, i) => audit(`swing k${i} t${k.t}`, k.pose));
  A.pitchClip().forEach((k, i) => audit(`pitch k${i} t${k.t}`, k.pose));
  A.throwClip().forEach((k, i) => audit(`throw k${i} t${k.t}`, k.pose));
  // 第 1 段の投球のリリース (手首の目標) と物理のリリース点の差
  const rel = A.pitchClip()[4].pose.armR.t;
  legacy.push(`pitch release wrist ${rel.map((x) => x.toFixed(2)).join(",")} vs physics ${A.PIT_REL_WRIST.join(",")} (${(dist(rel, A.PIT_REL_WRIST) * 100).toFixed(0)}cm)`);
}

/* ---------- 出力 ---------- */
const secs = (Date.now() - T0) / 1000;
const summary = { ok: nFail === 0, clips: results.length, failed: nFail, samples: nSamples, rosterStyles: styles.length, rosterFailed: rosterBad, formsUsed: formHits.length, formsUnused: formMiss, buildMs: { mean: +speedMean.toFixed(3), max: +speedMax.toFixed(3), per: speed }, cache: A.cacheSize(), seconds: secs };
if (opt.json) {
  console.log(JSON.stringify({ summary, results, run: runRes, legacy }, null, 1));
} else {
  const byName = {};
  for (const r of results) {
    const b = byName[r.name] || (byName[r.name] = { n: 0, bad: 0, key: 0, bat: 0, arm: 0, leg: 0, ground: 9, err: 0, fix: 0 });
    b.n++;
    if (!r.ok) b.bad++;
    const w = r.worst || {};
    b.key = Math.max(b.key, w.key || 0);
    b.bat = Math.max(b.bat, w.bat || 0);
    b.arm = Math.max(b.arm, w.arm || 0);
    b.leg = Math.max(b.leg, w.leg || 0);
    b.fix = Math.max(b.fix, w.fix || 0);
    if (w.ground != null) b.ground = Math.min(b.ground, w.ground);
    if (r.res && r.res.err != null) b.err = Math.max(b.err, r.res.err);
  }
  console.log("clip               cases fail  key-over  bat(clamped)  arm   leg   ankle-y  grip-fix  target-err");
  for (const n of Object.keys(byName)) {
    const b = byName[n];
    console.log(
      `${n.padEnd(18)} ${String(b.n).padStart(5)} ${String(b.bad).padStart(4)}  ${b.key.toFixed(1).padStart(6)}cm  ${b.bat.toFixed(1).padStart(8)}cm  ${b.arm.toFixed(1).padStart(4)}  ${b.leg.toFixed(1).padStart(4)}  ${b.ground.toFixed(3).padStart(6)}  ${b.fix.toFixed(1).padStart(6)}cm  ${(b.err * 100).toFixed(1).padStart(6)}cm`
    );
  }
  for (const r of runRes) console.log(`run.cycle v${r.v}: ${r.sps.toFixed(2)} steps/s, arm ${r.worst.arm.toFixed(1)}cm leg ${r.worst.leg.toFixed(1)}cm ankle ${r.worst.ground.toFixed(3)} ${r.ok ? "ok" : r.issues.join("; ")}`);
  const warnSet = new Set();
  for (const r of results) for (const w of r.warns || []) warnSet.add((r.name || "") + ": " + w);
  if (warnSet.size) console.log("warnings (hand/foot euler jumps):\n  " + [...warnSet].slice(0, 20).join("\n  "));
  for (const r of results) if (!r.ok || opt.verbose) console.log((r.ok ? "  ok   " : "  FAIL ") + r.label + (r.issues.length ? ": " + r.issues.join("; ") : ""));
  if (!opt.clip) {
    console.log(`styles: ${styles.length} roster styles (${rosterBad} failed); named forms used by roster players ${formHits.length}/${Object.keys(A.FORMS).length}` + (formMiss.length ? " (unused: " + formMiss.join(", ") + ")" : ""));
    console.log(`A.get build (no cache): mean ${speedMean.toFixed(3)} ms, max ${speedMax.toFixed(3)} ms (${Object.entries(speed).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + " " + v.toFixed(3)).join(", ")})`);
    console.log("legacy motions (phase 1, informational):\n  " + legacy.join("\n  "));
  }
  console.log(`${nFail ? "FAIL" : "OK"}: ${results.length} clip checks, ${nFail} failed, ${nSamples} sampled frames, ${secs.toFixed(1)} s`);
}
process.exit(nFail ? 1 : 0);
