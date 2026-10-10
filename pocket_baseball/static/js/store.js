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
    try {
      window.localStorage.setItem(S.KEY, JSON.stringify(S.data));
    } catch (e) {
      /* 容量不足・プライベートモードなど */
    }
    if (S.server) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(S.push, 800);
    }
  };

  S.teams = function () {
    if (!S.data.teams) {
      S.data.teams = PB.D.newTeams();
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
      body: JSON.stringify({ data: S.data }),
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
