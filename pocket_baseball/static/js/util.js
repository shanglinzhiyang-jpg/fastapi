/* 熱闘！ポケットベースボール — 共通ユーティリティ */
(function (PB) {
  "use strict";

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.easeOut = (t) => 1 - (1 - t) * (1 - t);
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.chance = (p) => Math.random() < p;
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.sign = (v) => (v < 0 ? -1 : 1);
  U.deg = (r) => (r * 180) / Math.PI;
  U.rad = (d) => (d * Math.PI) / 180;
  U.dist2 = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  // 標準正規分布 (Box-Muller)
  U.gauss = function () {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // シード付き乱数 (チーム生成を全端末で同じにするため)
  U.seeded = function (seed) {
    let s = seed >>> 0;
    const next = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (a, b) => a + next() * (b - a),
      int: (a, b) => Math.floor(a + next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      gauss: () => {
        let u = 0;
        while (u === 0) u = next();
        const v = next();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
    };
  };

  U.shuffle = function (arr, rnd) {
    const r = rnd || Math.random;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  };

  U.clone = (o) => JSON.parse(JSON.stringify(o));

  let uidCounter = 0;
  U.uid = (prefix) => (prefix || "id") + "_" + Date.now().toString(36) + "_" + (uidCounter++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

  // 打率表記 .312
  U.fmtAvg = function (h, ab) {
    if (!ab) return ".---";
    const v = h / ab;
    if (v >= 1) return "1.000";
    return "." + String(Math.round(v * 1000)).padStart(3, "0");
  };
  U.fmtRate = function (v) {
    if (!isFinite(v)) return "-.--";
    return v.toFixed(2);
  };
  // 投球回 (アウト数 → 6.1 形式)
  U.fmtIP = (outs) => Math.floor(outs / 3) + (outs % 3 ? "." + (outs % 3) : "");
  U.fmtERA = function (er, outs) {
    if (!outs) return er ? "∞" : "-.--";
    return ((er * 27) / outs).toFixed(2);
  };

  // HTML エスケープ
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // 簡易イベントエミッタ
  U.Emitter = class {
    constructor() {
      this._h = {};
    }
    on(ev, fn) {
      (this._h[ev] = this._h[ev] || []).push(fn);
      return this;
    }
    emit(ev, ...args) {
      (this._h[ev] || []).forEach((fn) => fn(...args));
    }
  };

  PB.U = U;
})((window.PB = window.PB || {}));
