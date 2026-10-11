/* 熱闘！ポケットベースボール — セーブデータ
 * 端末内 (localStorage) に保存し、FastAPI サーバーで遊んでいるときはサーバーにも同期する。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const S = {};
  S.KEY = "pocket_baseball_v1";
  S.server = false;
  S.slot = "default";

  S.DEFAULT_SETTINGS = {
    level: "normal",
    swingMode: "button", // button | release
    sens: 1.0,
    assist: "weak", // off | weak | strong
    sound: true,
    voice: false,
    bgm: true,
    vibrate: true,
    night: true,
    innings: 9,
    playSpeed: 1,
    lefty: false,
    gfx: "auto", // 画質: auto | 2d | low | mid | high ("auto" は端末ごとに判定)
  };

  function fresh() {
    return {
      version: 1,
      updated: 0,
      settings: Object.assign({}, S.DEFAULT_SETTINGS),
      teams: null,
      pennant: null,
      success: { players: [], run: null },
      derby: { best: 0, bestDist: 0, bestBy: "" },
      records: { games: 0, wins: 0, losses: 0, ties: 0 },
    };
  }

  S.data = fresh();

  S.load = function () {
    try {
      const raw = window.localStorage.getItem(S.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.version === 1) {
          S.data = Object.assign(fresh(), d);
          S.data.settings = Object.assign({}, S.DEFAULT_SETTINGS, d.settings || {});
        }
      }
    } catch (e) {
      S.data = fresh();
    }
    try {
      const slot = window.localStorage.getItem(S.KEY + "_slot");
      if (slot) S.slot = slot;
    } catch (e) {
      /* ストレージ無効 */
    }
    return S.data;
  };

  let pushTimer = null;
  S.save = function () {
    S.data.updated = Date.now();
    // サーバーへは保存した時点の内容を送る (日程の消化途中の状態を送らない)
    S._saved = JSON.stringify(S.data);
    try {
      window.localStorage.setItem(S.KEY, S._saved);
    } catch (e) {
      /* 容量不足・プライベートモードなど */
    }
    if (S.server) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(S.push, 800);
    }
  };

  S.teams = function () {
    // 球団の定義が変わった (旧バージョンの架空球団など) ときは作り直す
    const D = PB.D;
    if (S.data.teams && (S.data.teams.length !== D.TEAMS.length || S.data.teams.some((t) => !D.teamDef(t.id)))) {
      S.data.teams = null;
      S.data.pennant = null;
    }
    if (!S.data.teams) {
      S.data.teams = PB.D.newTeams();
      S.data.calibVer = D.CALIB_VER;
      S.save();
    }
    // 能力の補正が変わったら、実在選手の能力だけ名簿から作り直す (打順・登録した選手などはそのまま)
    if (D.CALIB_VER && S.data.calibVer !== D.CALIB_VER) {
      for (const t of S.data.teams) {
        const ro = D.ROSTERS && D.ROSTERS[t.id];
        const def = D.teamDef(t.id);
        if (!ro || !def || !D.rosterTeam) continue;
        const rebuilt = D.rosterTeam(def, ro);
        const byId = {};
        for (const p of rebuilt.players) byId[p.id] = p;
        for (const p of t.players) {
          const f = byId[p.id];
          if (!f || !p.real) continue;
          for (const k of D.RATING_KEYS) if (f[k] !== undefined) p[k] = Array.isArray(f[k]) ? f[k].map((x) => Object.assign({}, x)) : f[k];
        }
      }
      S.data.calibVer = D.CALIB_VER;
      S.save();
    }
    return S.data.teams;
  };
  S.team = (id) => S.teams().find((t) => t.id === id);
  S.settings = () => S.data.settings;

  S.resetAll = function () {
    const keep = S.data.settings;
    S.data = fresh();
    S.data.settings = keep;
    S.save();
  };

  /* ---------- サーバー同期 (FastAPI) ---------- */
  S.detectServer = function () {
    if (window.PB_STANDALONE || !/^https?:$/.test(location.protocol)) return Promise.resolve(false);
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const tm = setTimeout(() => ctrl && ctrl.abort(), 1500);
    return fetch("api/ping", { signal: ctrl ? ctrl.signal : undefined })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        clearTimeout(tm);
        S.server = !!(j && j.app === "pocket-baseball");
        return S.server;
      })
      .catch(() => {
        clearTimeout(tm);
        return false;
      });
  };

  S.pull = function () {
    if (!S.server) return Promise.resolve(false);
    return fetch("api/saves/" + encodeURIComponent(S.slot))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.data && j.data.version === 1 && (j.data.updated || 0) > (S.data.updated || 0)) {
          S.data = Object.assign(fresh(), j.data);
          S.data.settings = Object.assign({}, S.DEFAULT_SETTINGS, j.data.settings || {});
          try {
            window.localStorage.setItem(S.KEY, JSON.stringify(S.data));
          } catch (e) {
            /* 無視 */
          }
          return true;
        }
        return false;
      })
      .catch(() => false);
  };

  S.push = function () {
    if (!S.server) return Promise.resolve(false);
    return fetch("api/saves/" + encodeURIComponent(S.slot), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"data":' + (S._saved || JSON.stringify(S.data)) + "}",
    })
      .then((r) => r.ok)
      .catch(() => false);
  };

  S.setSlot = function (slot) {
    S.slot = slot || "default";
    try {
      window.localStorage.setItem(S.KEY + "_slot", S.slot);
    } catch (e) {
      /* 無視 */
    }
  };

  /* ---------- 選手パスワード (サクセス選手の書き出し/読み込み) ---------- */
  S.encodePlayer = function (p) {
    const json = JSON.stringify(p);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return "PB1-" + b64;
  };
  S.decodePlayer = function (code) {
    try {
      const c = String(code).trim();
      if (c.indexOf("PB1-") !== 0) return null;
      const json = decodeURIComponent(escape(atob(c.slice(4))));
      const p = JSON.parse(json);
      if (!p || !p.name || !p.pos) return null;
      p.id = U.uid("sx");
      return p;
    } catch (e) {
      return null;
    }
  };

  PB.Store = S;
})((window.PB = window.PB || {}));
