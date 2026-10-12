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
    enshutsu: "std", // 試合の演出: more (多め) | std (標準) | less (少なめ)
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

  // セーブの移行: 各モジュールが読み込み時に fn(data) を登録する (何度呼んでも同じ結果になること)
  S.migrations = [];
  S.migrate = function () {
    for (const fn of S.migrations) {
      try {
        fn(S.data);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // 球団の定義 (名前・色・ユニフォーム・球場・ロゴ…) はセーブに入れない。
  // 1 ファイル版では画像が data URI なので、入れると 1 回の保存が 2MB 近くになり、ペナントの途中で容量を超える。
  // 保存では定義の項目を外し (id は残す)、読み込みでは定義の項目を今の定義から付け直す (古いセーブの data URI も消える)
  function teamDefOf(t) {
    return t && typeof t === "object" && Array.isArray(t.players) && PB.D && PB.D.teamDef ? PB.D.teamDef(t.id) : null;
  }
  function packTeam(t) {
    const def = teamDefOf(t);
    if (!def) return t;
    const o = {};
    for (const k of Object.keys(t)) if (k === "id" || !(k in def)) o[k] = t[k];
    return o;
  }
  function unpackTeam(t) {
    const def = teamDefOf(t);
    if (def) for (const k of Object.keys(def)) t[k] = def[k];
    return t;
  }
  // 球団の配列があるところ: data.teams と (球団ごとの写しを持つ場合の) data.pennant.teams
  S.packed = function (d) {
    const out = Object.assign({}, d);
    if (Array.isArray(d.teams)) out.teams = d.teams.map(packTeam);
    if (d.pennant && Array.isArray(d.pennant.teams)) out.pennant = Object.assign({}, d.pennant, { teams: d.pennant.teams.map(packTeam) });
    return out;
  };
  S.unpack = function (d) {
    if (d && Array.isArray(d.teams)) d.teams.forEach(unpackTeam);
    if (d && d.pennant && Array.isArray(d.pennant.teams)) d.pennant.teams.forEach(unpackTeam);
    return d;
  };

  S.load = function () {
    try {
      const raw = window.localStorage.getItem(S.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.version === 1) {
          S.data = Object.assign(fresh(), d);
          S.data.settings = Object.assign({}, S.DEFAULT_SETTINGS, d.settings || {});
          S.unpack(S.data);
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
    S.migrate();
    return S.data;
  };

  let pushTimer = null;
  S.save = function () {
    S.data.updated = Date.now();
    // サーバーへは保存した時点の内容を送る (日程の消化途中の状態を送らない)
    S._saved = JSON.stringify(S.packed(S.data));
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
          // 画質 (gfx) は端末ごとの設定なので、ほかの端末の値で上書きしない
          const localGfx = (S.data.settings && S.data.settings.gfx) || "auto";
          S.data = Object.assign(fresh(), j.data);
          S.data.settings = Object.assign({}, S.DEFAULT_SETTINGS, j.data.settings || {});
          S.data.settings.gfx = localGfx;
          S.unpack(S.data);
          S.migrate();
          try {
            window.localStorage.setItem(S.KEY, JSON.stringify(S.packed(S.data)));
          } catch (e) {
            /* 無視 */
          }
          return true;
        }
        return false;
      })
      .catch(() => false);
  };

  // サーバーへ送るセーブ (端末ごとの画質の設定は除く)
  function syncJSON() {
    const raw = S._saved || JSON.stringify(S.packed(S.data));
    try {
      const d = JSON.parse(raw);
      if (d.settings) delete d.settings.gfx;
      return JSON.stringify(d);
    } catch (e) {
      return raw;
    }
  }
  S.push = function () {
    if (!S.server) return Promise.resolve(false);
    return fetch("api/saves/" + encodeURIComponent(S.slot), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"data":' + syncJSON() + "}",
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
