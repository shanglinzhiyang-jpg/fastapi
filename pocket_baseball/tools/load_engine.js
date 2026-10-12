// Node から ブラウザ用スクリプトを読み込むための小さなローダー (テスト・バランス調整用)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ENGINE_FILES = ["util.js", "data.js", "npb.js", "rosters2004.js", "field.js", "pitch.js", "play.js", "ai.js", "game.js", "bip_table.js", "quicksim.js"];

function loadEngine(files) {
  const ctx = { console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, isFinite, setTimeout, clearTimeout };
  ctx.window = ctx;
  vm.createContext(ctx);
  const dir = path.join(__dirname, "..", "static", "js");
  for (const f of files || ENGINE_FILES) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
  }
  return ctx.PB;
}

module.exports = { loadEngine };
