// 本塁打のタグ (N者連続・N打席連続・代打・先頭打者・サヨナラ・満塁・延長・両打席・号数) を
// 作った場面で確かめる
"use strict";
const assert = require("assert");
const { loadEngine } = require("./load_engine.js");

const PB = loadEngine();
const teams = PB.D.newTeams();
const U = PB.U;

function newGame(a, h) {
  const g = new PB.Game({ away: U.clone(a || teams[0]), home: U.clone(h || teams[1]), innings: 9 });
  g.season = {};
  return g;
}
// 本塁打を 1 本打たせる (塁上の走者 + 打者が生還)
function homer(g, phi) {
  const scorers = [];
  for (let b = 3; b >= 1; b--) if (g.bases[b]) scorers.push(g.bases[b]);
  scorers.push(g.batter());
  const res = { type: "HR", hr: true, scorers, runs: scorers.length, outsAdded: 0, outList: [], bases: [null, null, null, null], launch: { ev: 45, la: 28, phi: phi || 0 }, dist: 120, steals: [], batterOut: false };
  g.applyPlay(res);
  return g.hrLog[g.hrLog.length - 1];
}
function out(g) {
  g.strikeout(true);
}
// 同じ打者にもう一度打席を回す (同じ半イニングのまま打順を一つ戻す)
function again(g) {
  const s = g.battingSide();
  g.bi[s] = (g.bi[s] + 8) % 9;
}

// N者連続とイニングをまたいだリセット
{
  const g = newGame();
  const e1 = homer(g);
  assert.ok(!e1.b2b);
  assert.strictEqual(e1.lead, 1, "先頭打者");
  assert.strictEqual(e1.ctx, "先制");
  const e2 = homer(g);
  assert.strictEqual(e2.b2b, 2, "2者連続");
  assert.ok(!e2.lead);
  const e3 = homer(g);
  assert.strictEqual(e3.b2b, 3, "3者連続");
  out(g);
  const e4 = homer(g);
  assert.ok(!e4.b2b, "アウトを挟むと途切れる");
  out(g);
  out(g); // チェンジ
  assert.strictEqual(g.top, false);
  // 裏の先頭も先頭打者 (初回)
  const e5 = homer(g);
  assert.strictEqual(e5.lead, 1, "裏の先頭打者");
  assert.ok(!e5.b2b, "イニングをまたがない");
}

// N打席連続・1試合N本・号数
{
  const g = newGame();
  const bat = g.batter();
  g.season = { [bat.id]: { hr: 9 } };
  const e1 = homer(g);
  assert.strictEqual(e1.no, 10, "号数 = シーズン + 試合内");
  again(g);
  assert.strictEqual(g.batter().id, bat.id);
  const e2 = homer(g);
  assert.strictEqual(e2.id, bat.id);
  assert.strictEqual(e2.consec, 2, "2打席連続");
  assert.strictEqual(e2.game, 2, "1試合2本目");
  assert.strictEqual(e2.no, 11);
}

// 代打 (野手の代わり) は代打で出た打席だけ
{
  const g = newGame();
  const side = g.battingSide();
  const bench = g.benchAvailable(side)[0];
  assert.ok(bench, "控えがいない");
  g.pinchHit(bench);
  const e = homer(g);
  assert.strictEqual(e.ph, 1, "代打本塁打");
  again(g);
  assert.strictEqual(g.batter().id, bench);
  const e2 = homer(g);
  assert.ok(!e2.ph, "2打席目は代打ではない");
}

// サヨナラ満塁・延長
{
  const g = newGame();
  // 9回裏 同点
  g.inning = 9;
  g.top = false;
  g.score = { away: 3, home: 3 };
  g.line = { away: [0, 0, 0, 0, 0, 0, 0, 0, 3], home: [0, 0, 0, 0, 0, 0, 0, 0, 0] };
  const side = g.battingSide();
  const ord = g.order[side];
  g.bases = [null, g.P(ord[1].id), g.P(ord[2].id), g.P(ord[3].id)];
  const e = homer(g);
  assert.strictEqual(e.n, 4, "満塁");
  assert.strictEqual(e.ctx, "サヨナラ");
  assert.ok(g.over && g.result.walkoff, "サヨナラで試合終了");
  assert.ok(!e.extra);
  const sc = g.scoreLog[g.scoreLog.length - 1];
  assert.ok(/サヨナラ満塁弾/.test(sc.text), "得点経過の文言: " + sc.text);
}
{
  const g = newGame();
  g.inning = 10;
  g.top = true;
  g.score = { away: 1, home: 1 };
  g.line = { away: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0], home: [0, 0, 0, 0, 0, 0, 0, 0, 1] };
  const e = homer(g);
  assert.strictEqual(e.extra, 1, "延長");
  assert.strictEqual(e.ctx, "勝ち越し");
}

// 両打席 (スイッチヒッターが右投手・左投手から)
{
  const g = newGame();
  const side = g.battingSide();
  const fs = g.fieldingSide();
  const bat = g.batter();
  bat.bats = "S";
  const pits = g.teams[fs].players.filter((p) => p.pos === "P");
  const R = pits.find((p) => p.throws === "R" && p.id !== g.pstate[fs].id) || pits.find((p) => p.throws === "R");
  const L = pits.find((p) => p.throws === "L");
  assert.ok(R && L, "左右の投手がいない");
  g.setPitcher(fs, R.id, false);
  const e1 = homer(g);
  assert.strictEqual(e1.hand, "L");
  assert.ok(!e1.both);
  again(g);
  g.setPitcher(fs, L.id, false);
  assert.strictEqual(g.batter().id, bat.id);
  const e2 = homer(g);
  assert.strictEqual(e2.hand, "R");
  assert.strictEqual(e2.both, 1, "両打席本塁打");
  void side;
}

// ランニング本塁打にも号数が付く
{
  const txt = PB.Talk.scoreText({ kind: "play", res: { type: "IPHR" }, name: "赤星", n: 1, ctx: "", hrNo: 3 });
  assert.ok(/3号/.test(txt), txt);
}
console.log("OK");
