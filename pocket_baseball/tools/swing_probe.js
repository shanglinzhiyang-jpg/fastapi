// 打撃の手ごたえの確認: 人が打つときの本塁打率 (完璧なタイミング / 現実的なずれ) をパワー別に調べる
// 使い方: node tools/swing_probe.js ['{"ev":{"top":0.08}}'] [回数]
"use strict";
const { loadEngine } = require("./load_engine.js");

const PB = loadEngine();
const cfg = JSON.parse(process.argv[2] || "{}");
const N = Number(process.argv[3] || 3000);
if (cfg.ev) Object.assign(PB.P.EV, cfg.ev);
const { P, F, U, D } = PB;
const pitcher = { throws: "R", velo: 145, control: 60, stamina: 60, pitches: [], skills: [] };
const lv = PB.AI.LEVELS.normal;

function probe(batter, sdT, sdC) {
  let hr = 0;
  let inplay = 0;
  let maxD = 0;
  for (let i = 0; i < N; i++) {
    const pc = P.make(pitcher, "FB", { x: U.rand(-0.15, 0.15), z: U.rand(0.55, 0.95) }, { stamina: 60, max: 60 }, { noError: true });
    const ideal = P.idealTime(pc);
    const bp = P.pos(pc, ideal);
    const W = P.window({ windowMul: lv.windowMul });
    const cs = P.cursor(batter, pitcher, { cursorMul: lv.cursorMul });
    // カーソルは球のやや下 (少し上がる打球) に合わせる
    const sw = { t: ideal - P.SWING_LAG + U.gauss() * sdT * W, cx: bp[0] + U.gauss() * sdC * cs.rx, cz: bp[2] - 0.3 * cs.rz + U.gauss() * sdC * cs.rz };
    const r = P.swing(pc, sw, batter, pitcher, { cursorMul: lv.cursorMul, windowMul: lv.windowMul });
    if (r.type !== "inplay") continue;
    inplay++;
    const bb = P.battedBall(r);
    const pred = F.predict(F.newBall(bb.p, bb.v), 0, 14);
    if (pred.info.hr) {
      hr++;
      maxD = Math.max(maxD, F.carry(bb.p, bb.v));
    }
  }
  return { hr: ((hr / N) * 100).toFixed(1) + "%", inplay: ((inplay / N) * 100).toFixed(0) + "%", maxD: Math.round(maxD) };
}

const rows = [
  ["投手 (パワー12 弾道1)", { power: 12, meet: 15, traj: 1, skills: [] }],
  ["パワー30 弾道2", { power: 30, meet: 50, traj: 2, skills: [] }],
  ["パワー50 弾道2", { power: 50, meet: 50, traj: 2, skills: [] }],
  ["パワー70 弾道3", { power: 70, meet: 50, traj: 3, skills: [] }],
  ["パワー90 弾道3", { power: 90, meet: 50, traj: 3, skills: [] }],
  ["パワー90 弾道4 PH", { power: 90, meet: 50, traj: 4, skills: ["powerHitter"] }],
];
console.log("cfg", JSON.stringify(PB.P.EV));
for (const [name, b] of rows) {
  const bat = Object.assign({ bats: "R", speed: 50 }, b);
  void D;
  console.log(name.padEnd(18), "完璧", JSON.stringify(probe(bat, 0, 0)), " 現実的", JSON.stringify(probe(bat, 0.35, 0.35)));
}
