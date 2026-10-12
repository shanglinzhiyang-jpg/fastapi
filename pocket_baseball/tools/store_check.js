// セーブ (store.js) の確認: 球団の定義 (色・ユニフォーム・ロゴなど) をセーブに入れず、読み込みで付け直す。
// 1 ファイル版では画像が data URI なので、入れると 1 回の保存が 2MB 近くになり、ペナントの途中で容量を超える。
// 使い方: node tools/store_check.js
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadEngine } = require("./load_engine.js");

const PB = loadEngine();
const D = PB.D;
// 1 ファイル版と同じく、球団の定義の画像を data URI にする
const FAKE = "data:image/webp;base64," + "A".repeat(60000);
const walk = (o, d) => {
  if (!o || typeof o !== "object" || d > 5) return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === "string" && /^img\//.test(v)) o[k] = FAKE;
    else walk(v, d + 1);
  }
};
D.TEAMS.forEach((t) => walk(t, 0));

// ブラウザの localStorage の代わり
const mem = {};
const localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => {
    mem[k] = String(v);
  },
  removeItem: (k) => {
    delete mem[k];
  },
};
const win = { PB, localStorage, location: { protocol: "file:" } };
const sandbox = { window: win, PB, localStorage, location: win.location, console, setTimeout, clearTimeout, fetch: () => Promise.reject(new Error("offline")), btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary") };
const src = fs.readFileSync(path.join(__dirname, "..", "static", "js", "store.js"), "utf8");
vm.runInNewContext(src, sandbox, { filename: "store.js" });
const S = PB.Store;
assert.ok(S && S.save && S.load && S.packed && S.unpack, "store.js が読めない");

S.load();
const teams = S.teams();
assert.strictEqual(teams.length, D.TEAMS.length);
assert.ok(teams[0].logo === FAKE, "前提: 定義の画像が data URI");
// 遊んで変わる項目 (打順) は残る
const t0 = teams[0];
const order0 = JSON.stringify(t0.lineup);
S.save();
const raw = mem[S.KEY];
assert.ok(raw, "保存されていない");
assert.ok(raw.indexOf("data:image") < 0, "セーブに画像 (data URI) が入っている");
const saved = JSON.parse(raw);
for (const k of Object.keys(D.TEAMS[0])) if (k !== "id") assert.ok(!(k in saved.teams[0]), "定義の項目がセーブに入っている: " + k);
assert.ok(saved.teams[0].players && saved.teams[0].players.length, "選手がセーブにない");
assert.ok(raw.length < 400 * 1024, "セーブが大きすぎる: " + Math.round(raw.length / 1024) + "KB");
console.log("セーブの大きさ (球団 12)", Math.round(raw.length / 1024) + "KB");

// 読み込むと定義の項目が付き、ほかは保存した値のまま
S.data = null;
S.load();
const t1 = S.data.teams[0];
for (const k of Object.keys(D.TEAMS[0])) assert.ok(t1[k] === D.TEAMS[0][k], "読み込みで定義の項目が付かない: " + k);
assert.strictEqual(JSON.stringify(t1.lineup), order0, "打順が変わった");
assert.strictEqual(t1.players.length, t0.players.length);

// 古いセーブ (定義の項目と画像を含む) も読めて、次の保存で小さくなる
const old = JSON.parse(raw);
old.teams = old.teams.map((t) => Object.assign({}, D.teamDef(t.id), t, { logo: "data:image/webp;base64,OLD", name: "古い名前" }));
mem[S.KEY] = JSON.stringify(old);
S.load();
assert.strictEqual(S.data.teams[0].name, D.TEAMS[0].name, "古いセーブの定義の項目が今の定義に置き換わらない");
assert.strictEqual(S.data.teams[0].logo, D.TEAMS[0].logo);
S.save();
assert.ok(mem[S.KEY].indexOf("data:image") < 0, "古いセーブの画像が次の保存でも残る");

// ペナントが球団の写しを持つ場合も同じ
S.data.pennant = { teams: S.data.teams.map((t) => Object.assign({}, t)), day: 3 };
S.save();
assert.ok(mem[S.KEY].indexOf("data:image") < 0, "ペナントの球団の写しに画像が入っている");
S.load();
assert.strictEqual(S.data.pennant.teams[0].logo, D.TEAMS[0].logo, "ペナントの球団の写しに定義の項目が付かない");
assert.strictEqual(S.data.pennant.day, 3);
console.log("OK");
