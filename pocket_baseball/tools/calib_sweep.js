// 打撃バランスの調整用: 指定した係数で 2004 年の実在 12 球団を対戦させ、実成績と比べる
// 使い方: node tools/calib_sweep.js '{"ev":{"base":44,"slope":0.085,"noise":1.8},"calib":{"power":0}}' 150
"use strict";
const { loadEngine } = require("./load_engine.js");
const PB = loadEngine();
const cfg = JSON.parse(process.argv[2] || "{}");
const N = Number(process.argv[3] || 120);
if (cfg.ev) Object.assign(PB.P.EV, cfg.ev);
if (cfg.calib) Object.assign(PB.D.CALIB, cfg.calib);
const teams = PB.D.newTeams();
const box = {};
let runs = 0, games = 0;
for (let i = 0; i < N; i++) {
  const a = teams[i % 12];
  const lg = PB.D.teamDef(a.id).lg;
  const same = teams.filter((t) => t !== a && PB.D.teamDef(t.id).lg === lg);
  const h = same[(i * 7 + Math.floor(i / 12)) % same.length];
  const g = new PB.Game({ away: PB.U.clone(a), home: PB.U.clone(h), innings: 9 });
  g.simToEnd();
  runs += g.score.away + g.score.home;
  games++;
  for (const id in g.box) {
    const s = g.box[id];
    const b = box[id] || (box[id] = {});
    for (const k in s) b[k] = (b[k] || 0) + s[k];
  }
}
let pa = 0, ab = 0, h = 0, hr = 0, bb = 0, k = 0;
const pts = [];
for (const t of teams)
  for (const p of t.players) {
    const s = box[p.id];
    if (!s || p.pos === "P") continue;
    pa += s.pa; ab += s.ab; h += s.h; hr += s.hr; bb += s.bb; k += s.k;
    const r = p.real && p.real.stats;
    if (r && r.hr != null && r.g >= 60 && s.pa >= 40) pts.push({ sim: (s.hr / s.pa) * 600, real: (r.hr / (r.g * 3.9)) * 600, simAvg: s.ab ? s.h / s.ab : 0, realAvg: r.avg, power: p.power, name: p.name });
  }
// 実成績との回帰 (傾き・相関)
const n = pts.length;
const mx = pts.reduce((a, x) => a + x.real, 0) / n;
const my = pts.reduce((a, x) => a + x.sim, 0) / n;
let sxy = 0, sxx = 0, syy = 0;
for (const x of pts) { sxy += (x.real - mx) * (x.sim - my); sxx += (x.real - mx) ** 2; syy += (x.sim - my) ** 2; }
const slope = sxy / sxx;
const corr = sxy / Math.sqrt(sxx * syy);
const top = pts.slice().sort((a, b) => b.sim - a.sim).slice(0, 5).map((x) => x.name + Math.round(x.sim) + "/" + Math.round(x.real)).join(" ");
const out = { cfg, games, RG: +(runs / games / 2).toFixed(2), AVG: +(h / ab).toFixed(3), HRpg: +(hr / games).toFixed(2), BBp: +((bb / pa) * 100).toFixed(1), Kp: +((k / pa) * 100).toFixed(1), simHR600: +my.toFixed(1), realHR600: +mx.toFixed(1), slope: +slope.toFixed(2), corr: +corr.toFixed(2), top };
console.log(JSON.stringify(out));
