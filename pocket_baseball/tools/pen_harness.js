// ペナントのモジュール (pennant.js・pennant_sched.js・news.js …) を node で動かすための共通の土台。
// エンジン (load_engine.js) を読み、ブラウザ側のモジュール (Store / UI / Screens / Audio) を最小限のスタブで置き換える。
// ペナントのモジュールは index.html の並び (js/pennant.js 〜 js/news.js) から拾うので、後で足したモジュールも読まれる。
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadEngine } = require("./load_engine.js");

const STATIC = path.join(__dirname, "..", "static");
const ENGINE = new Set(["util.js", "data.js", "npb.js", "rosters2004.js", "field.js", "pitch.js", "play.js", "ai.js", "game.js", "bip_table.js", "quicksim.js"]);

// index.html の js/pennant.js から js/news.js までのスクリプト (エンジンの分は除く)
function pennantFiles() {
  const html = fs.readFileSync(path.join(STATIC, "index.html"), "utf8");
  const all = [...html.matchAll(/<script src="js\/([^"]+)"><\/script>/g)].map((m) => m[1]);
  const a = all.indexOf("pennant.js");
  const b = all.indexOf("news.js");
  const list = a >= 0 && b >= a ? all.slice(a, b + 1) : ["pennant.js", "pennant_sched.js", "news.js"];
  return list.filter((f) => !ENGINE.has(f));
}

function makeHarness() {
  const PB = loadEngine();
  const teams = PB.D.newTeams();
  const Store = {
    data: { pennant: null, records: { games: 0, wins: 0, losses: 0, ties: 0 }, settings: {} },
    saves: 0,
    teams: () => teams,
    team: (id) => teams.find((t) => t.id === id),
    save() {
      Store.saves++;
    },
    settings: () => ({ level: "normal", night: true }),
    migrations: [],
    migrate() {
      for (const fn of Store.migrations) fn(Store.data);
    },
  };
  PB.Store = Store;
  const esc = PB.U.esc;
  PB.UI = {
    cur: null,
    mark: (t) => '<i class="tm">' + esc((t && t.short) || "") + "</i>",
    header: (t) => "<h1>" + esc(t) + "</h1>",
    go(s) {
      PB.UI.cur = s;
    },
    refresh() {},
    showPlayer() {},
    confirm() {},
    toast() {},
    hideScreen() {},
  };
  PB.Screens = {
    seg: (name, opts, val) => '<div class="seg">' + opts.map((o) => '<button class="' + (String(o[0]) === String(val) ? "on" : "") + '" data-act="' + name + '" data-arg="' + o[0] + '">' + esc(o[1]) + "</button>").join("") + "</div>",
    teamPicker: (name) => '<div class="tpick" data-name="' + name + '"></div>',
    title: () => ({ html: () => "<title-screen>" }),
    order: () => ({ html: () => "<order-screen>" }),
    result: () => ({ html: () => "<result-screen>" }),
  };
  PB.Audio = { victory() {}, click() {} };
  const ctx = vm.createContext({ window: { PB }, PB, console, Math, Date, JSON, Object, Array, Number, String, Set, Map, setTimeout, clearTimeout });
  const files = pennantFiles();
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(STATIC, "js", f), "utf8"), ctx, { filename: f });
  const Pen = PB.Pennant;
  return { PB, Pen, News: PB.News, Sched: PB.PenSched, Store, teams, I: Pen._internal, files };
}

// 同期で 1 日ずつ進める (自分の試合もシミュレーション。quick: 高速版)
function playDays(H, pen, n, quick) {
  const { I } = H;
  for (let d = 0; d < n && !pen.finished; d++) {
    const m = I.myMatch(pen);
    let g = null;
    if (m) {
      g = I.makeGame(pen, m, null, { quick: quick != null ? quick : H.Pen.useQuick(pen) });
      g.simToEnd();
    }
    I.finishDay(pen, g);
  }
}
// シーズンの終わりまで
function playSeason(H, pen, quick) {
  playDays(H, pen, 1e9, quick);
}
// Pen.simUntil を Promise に
function simUntil(H, pen, stopFn, onProgress) {
  return new Promise((resolve) => H.Pen.simUntil(pen, stopFn, onProgress, (ctl) => resolve(ctl)));
}

module.exports = { makeHarness, playDays, playSeason, simUntil, pennantFiles };
