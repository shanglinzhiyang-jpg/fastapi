// CPU 同士の試合を大量にシミュレーションしてリーグ成績を出す (バランス調整用)
"use strict";
const { loadEngine } = require("./load_engine.js");
const PB = loadEngine();
const N = Number(process.argv[2] || 60);
const teams = PB.D.newTeams();
const tot = { g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, bb: 0, k: 0, r: 0, sb: 0, cs: 0, e: 0, sf: 0, sac: 0, np: 0 };
const types = {};
let extra = 0, ties = 0, maxRuns = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const a = teams[i % 6], h = teams[(i * 5 + 1) % 6 === i % 6 ? (i + 1) % 6 : (i * 5 + 1) % 6];
  a.rotIdx = i; h.rotIdx = i + 2;
  const g = new PB.Game({ away: a, home: h, innings: 9 });
  const orig = g.applyPlay.bind(g);
  g.applyPlay = (res) => { types[res.type] = (types[res.type] || 0) + 1; return orig(res); };
  g.simToEnd();
  tot.g++;
  if (g.inning > 9) extra++;
  if (g.result.tie) ties++;
  tot.r += g.score.away + g.score.home;
  maxRuns = Math.max(maxRuns, g.score.away, g.score.home);
  tot.e += g.errors.away + g.errors.home;
  for (const id in g.box) {
    const s = g.box[id];
    for (const k of ["pa", "ab", "h", "d", "t", "hr", "bb", "k", "sb", "cs", "sf", "sac", "np"]) tot[k] += s[k];
  }
}
const per = (v) => (v / tot.g / 2).toFixed(2);
console.log(`games=${tot.g} time=${Date.now() - t0}ms`);
console.log(`AVG=${(tot.h / tot.ab).toFixed(3)} OBP=${((tot.h + tot.bb) / tot.pa).toFixed(3)} SLG=${((tot.h + tot.d + 2 * tot.t + 3 * tot.hr) / tot.ab).toFixed(3)}`);
console.log(`per team-game: R=${per(tot.r)} H=${per(tot.h)} HR=${per(tot.hr)} BB=${per(tot.bb)} K=${per(tot.k)} 2B=${per(tot.d)} 3B=${per(tot.t)} SB=${per(tot.sb)} CS=${per(tot.cs)} E=${per(tot.e)} SF=${per(tot.sf)} SAC=${per(tot.sac)} PA=${per(tot.pa)} NP=${per(tot.np)}`);
console.log(`K%=${(tot.k / tot.pa * 100).toFixed(1)} BB%=${(tot.bb / tot.pa * 100).toFixed(1)} extra=${extra} ties=${ties} maxRuns=${maxRuns}`);
console.log(Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ":" + (v / tot.g / 2).toFixed(2)).join(" "));
