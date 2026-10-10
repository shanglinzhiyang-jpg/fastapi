// エンジンの健全性チェック: CPU 同士の試合を回し、成績が野球らしい範囲か確かめる
"use strict";
const assert = require("assert");
const { loadEngine } = require("./load_engine.js");

const PB = loadEngine();
const N = Number(process.argv[2] || 24);
const teams = PB.D.newTeams();
const tot = { pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, r: 0, g: 0 };
for (let i = 0; i < N; i++) {
  const away = teams[i % 6];
  const home = teams[(i + 1 + Math.floor(i / 6)) % 6 === i % 6 ? (i + 2) % 6 : (i + 1 + Math.floor(i / 6)) % 6];
  const g = new PB.Game({ away: PB.U.clone(away), home: PB.U.clone(home), innings: 9 });
  g.simToEnd();
  assert.ok(g.over, "試合が終わらない");
  assert.ok(g.result, "結果がない");
  assert.ok(g.inning >= 9 && g.inning <= 12, "イニング数が異常: " + g.inning);
  if (!g.result.tie) {
    assert.ok(g.result.W && g.result.L, "勝敗投手が決まっていない");
    assert.notStrictEqual(g.score.home, g.score.away);
  }
  // 得点は塁上の走者・ボックススコアと一致する
  for (const side of ["away", "home"]) {
    const ids = new Set(g.teams[side].players.map((p) => p.id));
    const runs = Object.keys(g.box)
      .filter((id) => ids.has(id))
      .reduce((a, id) => a + (g.box[id].r || 0), 0);
    assert.strictEqual(runs, g.score[side], side + " の得点が一致しない");
    const lineSum = g.line[side].reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);
    assert.strictEqual(lineSum, g.score[side], side + " のスコアボードが一致しない");
  }
  tot.g++;
  tot.r += g.score.away + g.score.home;
  for (const id in g.box) {
    const s = g.box[id];
    tot.pa += s.pa;
    tot.ab += s.ab;
    tot.h += s.h;
    tot.hr += s.hr;
    tot.bb += s.bb;
    tot.k += s.k;
  }
}
const avg = tot.h / tot.ab;
const rpg = tot.r / tot.g / 2;
const kp = tot.k / tot.pa;
console.log(`games=${tot.g} AVG=${avg.toFixed(3)} R/G=${rpg.toFixed(2)} HR/G=${(tot.hr / tot.g / 2).toFixed(2)} K%=${(kp * 100).toFixed(1)} BB%=${((tot.bb / tot.pa) * 100).toFixed(1)}`);
assert.ok(avg > 0.2 && avg < 0.33, "打率が野球らしくない: " + avg);
assert.ok(rpg > 1.5 && rpg < 8, "得点が野球らしくない: " + rpg);
assert.ok(kp > 0.08 && kp < 0.3, "三振率が野球らしくない: " + kp);
console.log("OK");
