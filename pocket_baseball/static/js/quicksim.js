/* 熱闘！ポケットベースボール — 高速シミュレーション (ペナントの他球場・一括消化)
 * PB.Game の resolve() だけを置き換える。投球・スイング・打球の初速/角度は物理版と同じなので三振・四球は同じ。
 * 本塁打は打球の軌道から物理版と同じ規則 (フェンスを空中で越える) で決め、飛距離・方向も同じ式。
 * それ以外の打球は bip_table.js (物理版の守備を回して作った表) の割合から結果と最初の野手を引き、
 * 走者の進塁・併殺・犠飛・盗塁・ファウルフライも表の割合で決める。
 * 結果は applyPlay / applySteal に渡すので、ボックススコア・本塁打の記録・得点経過・勝敗投手・継投は Game のまま。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const F = PB.F;
  const P = PB.P;
  const POS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  const OF = { LF: 1, CF: 1, RF: 1 };
  const HITS = { a: "H1", b: "H2", c: "H3", d: "IPHR" };
  const OUTS = { g: "GO", h: "FO", i: "PO", j: "LO" };
  const K_DEF = 0.5; // 守備力の効き (平均との差 10 で ±5%)

  // 表を使いやすい形に直す (最初に使うときに 1 回だけ)
  let T = null;
  function parseCell(s) {
    const list = [];
    let tot = 0;
    const re = /([a-j])(\d)(\d+)/g;
    let m;
    while ((m = re.exec(s || ""))) {
      const n = Number(m[3]);
      list.push({ o: m[1], pos: POS[Number(m[2]) - 1] || null, n });
      tot += n;
    }
    return { list, tot };
  }
  function table() {
    if (T) return T;
    const B = PB.BIP;
    if (!B) throw new Error("bip_table.js が読み込まれていません");
    const cells = B.cells.map(parseCell);
    // 一塁走者がいるときの守備位置 (一塁手がベースに付く・併殺の位置)。無い区分は通常の表
    const cells1 = B.cells.map((s, i) => (B.cells1 && B.cells1[i] ? parseCell(B.cells1[i]) : cells[i]));
    T = { B, cells, cells1 };
    return T;
  }

  function binOf(v, g) {
    return U.clamp(Math.floor((v - g[0]) / g[1]), 0, g[2] - 1);
  }
  function cellIndex(B, ei, li, pi) {
    return (ei * B.la[2] + li) * B.ph[2] + pi;
  }
  // 空の区分 (本塁打しか出なかった など) は少し弱い打球・近い角度の区分を使う
  function findCell(ev, la, phi, shifted) {
    const { B } = table();
    const cells = shifted ? T.cells1 : T.cells;
    const ei = binOf(ev, B.ev);
    const li = binOf(la, B.la);
    const pi = binOf(phi, B.ph);
    for (let de = 0; de <= 3; de++)
      for (const dl of [0, -1, 1]) {
        const e = ei - de;
        const l = li + dl;
        if (e < 0 || l < 0 || l >= B.la[2]) continue;
        const idx = cellIndex(B, e, l, pi);
        if (cells[idx].tot) return { idx, cell: cells[idx] };
      }
    return null;
  }

  // 本塁打か (物理版の F.predict と同じ規則: 跳ねる前に空中でフェンスを越える)
  function isHomeRun(bb, la) {
    if (la <= 0) return false;
    const b = F.newBall(bb.p, bb.v);
    for (let i = 0; i < 14 / F.PRED_DT && !b.dead; i++) {
      F.stepBall(b, F.PRED_DT);
      if (b.hr) return true;
      if (!b.air || b.bounces > 0 || b.fenceHit) return false;
    }
    return !!b.hr;
  }

  const spd = (p) => p.speed + (D.has(p, "baserun") ? 8 : 0);
  // 走者の進塁率 (表の割合 + 走力の傾き)
  function rate(key, p, add) {
    const a = table().B.adv[key];
    if (!a) return 0;
    return U.clamp(a[0] + a[1] * (spd(p) - a[2]) + (add || 0), 0, 0.97);
  }
  const chance = (p) => Math.random() < p;

  class QuickGame extends PB.Game {
    // 判定結果を受けてプレーを最後まで進める (表を引くだけ)
    resolve(jr, sw, steal) {
      if (jr.call === "inplay") {
        this.applyPlay(this.quickBatted(jr, sw, steal));
        return { jr };
      }
      if (jr.call === "foul") {
        const r = jr.res;
        // 物理版と同じ条件 (かすった打球以外・角度 20 度以上) で捕れるか
        if (r && !r.tip && r.la >= 20) {
          const ff = this.foulFly(r);
          if (ff) {
            this.applyPlay(ff);
            return { jr };
          }
        }
        this.applyCall(jr);
        return { jr };
      }
      const out = this.applyCall(jr);
      if (steal && !out && this.outs < 3) {
        const st = this.quickSteal(steal);
        if (st) {
          this.applySteal(st);
          return { jr };
        }
      }
      return { jr, out };
    }

    /* ---------- 結果の形 (Play.finish と同じ項目) ---------- */
    mkRes(type, o) {
      const outsAdded = o.outsAdded || 0;
      const over = this.outs + outsAdded >= 3;
      // 3 アウト目が打者・フォースアウトなら得点は入らない
      const scorers = over ? [] : o.scorers || [];
      const bases = over ? [null, null, null, null] : o.bases;
      const res = {
        kind: "batted",
        quick: true,
        type,
        hr: type === "HR",
        outsAdded,
        outList: [],
        error: o.error || null,
        firstTouch: o.pos || null,
        firstAir: !!o.air,
        firstAt: o.at || null,
        launch: o.launch,
        landing: null,
        fenceHit: false,
        steals: [],
        scorers,
        runs: scorers.length,
        bases,
        batterOut: !!o.batterOut,
        batterBase: o.batterBase || 0,
      };
      if (o.dist) res.dist = o.dist;
      return res;
    }

    // 守備位置から実況用のおおよその捕球位置
    spot(pos, phi, far) {
      const r = OF[pos] ? (far ? 92 : 72) : pos === "P" || pos === "C" ? 14 : 34;
      const th = U.rad(phi);
      return [Math.sin(th) * r, Math.cos(th) * r];
    }

    /* ---------- インプレーの打球 ---------- */
    quickBatted(jr, sw, steal) {
      const r = jr.res;
      const bb = P.battedBall(r);
      const v = bb.v;
      const launch = { ev: Math.hypot(v[0], v[1], v[2]), la: U.deg(Math.atan2(v[2], Math.hypot(v[0], v[1]))), phi: U.deg(Math.atan2(v[0], v[1])) };
      const bat = this.batter();
      const b = this.bases;
      if (sw && sw.bunt) return this.quickBunt(launch, bat);
      if (isHomeRun(bb, launch.la)) {
        const scorers = [b[3], b[2], b[1]].filter(Boolean).concat([bat]);
        return this.mkRes("HR", { scorers, bases: [null, null, null, null], launch, dist: Math.round(F.carry(bb.p, bb.v)), batterBase: 4 });
      }
      const running = !!(steal && b[1] && steal[1]);
      const found = findCell(launch.ev, launch.la, launch.phi, !!b[1]);
      if (!found) {
        // 表に無い打球 (起きないはず): 方向の外野フライ
        const pos = launch.phi < -15 ? "LF" : launch.phi > 15 ? "RF" : "CF";
        return this.outPlay("h", pos, null, launch, bat, running);
      }
      const def = this.defense();
      const B = table().B;
      // 守備力で少しだけ重みを変える
      let tot = 0;
      const ws = found.cell.list.map((e) => {
        let w = e.n;
        const f = e.pos && def[e.pos];
        if (f) {
          const d = (f.field - (B.avg.field[e.pos] || 60)) / 100;
          if (HITS[e.o]) w *= 1 - K_DEF * d;
          else if (OUTS[e.o]) w *= 1 + K_DEF * 0.5 * d;
          else w *= U.clamp((100 - f.catch) / Math.max(5, 100 - (B.avg.catch[e.pos] || 60)), 0.5, 2);
        }
        w = Math.max(0, w);
        tot += w;
        return w;
      });
      let x = Math.random() * tot;
      let e = found.cell.list[found.cell.list.length - 1];
      for (let i = 0; i < ws.length; i++) {
        x -= ws[i];
        if (x <= 0) {
          e = found.cell.list[i];
          break;
        }
      }
      if (HITS[e.o]) return this.hitPlay(HITS[e.o], e.pos, launch, bat, running);
      if (e.o === "e" || e.o === "f") return this.errorPlay(e.o === "f" ? 2 : 1, e.pos, launch, bat);
      return this.outPlay(e.o, e.pos, found.idx, launch, bat, running);
    }

    // 安打: 走者は表の割合で進む (二塁走者の生還・一塁走者の三塁到達 など)
    hitPlay(type, pos, launch, bat, running) {
      const b = this.bases;
      const nb = [null, null, null, null];
      const sc = [];
      const o2 = this.outs === 2 ? "2" : "01";
      if (type === "H1" && !OF[pos]) {
        // 内野安打: 押し出される走者だけ進む
        if (b[1] && b[2] && b[3]) sc.push(b[3]);
        else if (b[3]) nb[3] = b[3];
        if (b[1] && b[2]) nb[3] = b[2];
        else if (b[2]) nb[2] = b[2];
        if (b[1]) nb[2] = b[1];
        nb[1] = bat;
      } else if (type === "H1") {
        if (b[3]) sc.push(b[3]);
        let third = false;
        if (b[2]) {
          if (chance(rate("h1r2_" + o2, b[2]))) sc.push(b[2]);
          else {
            nb[3] = b[2];
            third = true;
          }
        }
        if (b[1]) {
          if (!third && chance(rate("h1r1_" + o2, b[1], running ? 0.25 : 0))) nb[3] = b[1];
          else nb[2] = b[1];
        }
        // 走者がいると送球の間に打者が二塁へ進むことがある (物理版では二塁打になる)
        if ((b[1] || b[2] || b[3]) && !nb[2] && chance(rate("h1bat_" + (b[2] ? "2" : b[1] ? "1" : "3"), bat))) {
          nb[2] = bat;
          return this.mkRes("H2", { scorers: sc, bases: nb, pos, at: this.spot(pos, launch.phi, true), launch, batterBase: 2 });
        }
        nb[1] = bat;
      } else if (type === "H2") {
        if (b[3]) sc.push(b[3]);
        if (b[2]) sc.push(b[2]);
        if (b[1]) {
          if (chance(rate("h2r1_" + o2, b[1], running ? 0.3 : 0))) sc.push(b[1]);
          else nb[3] = b[1];
        }
        nb[2] = bat;
      } else {
        for (const k of [3, 2, 1]) if (b[k]) sc.push(b[k]);
        if (type === "IPHR") sc.push(bat);
        else nb[3] = bat;
      }
      const base = { H1: 1, H2: 2, H3: 3, IPHR: 4 }[type];
      return this.mkRes(type, { scorers: sc, bases: nb, pos, air: false, at: this.spot(pos, launch.phi, type !== "H1"), launch, batterBase: base });
    }

    // 失策: 打者は一塁 (または二塁) へ、走者は同じだけ進む
    errorPlay(n, pos, launch, bat) {
      const b = this.bases;
      const nb = [null, null, null, null];
      const sc = [];
      for (const k of [3, 2, 1]) {
        if (!b[k]) continue;
        if (k + n >= 4) sc.push(b[k]);
        else nb[k + n] = b[k];
      }
      nb[n] = bat;
      return this.mkRes("E", { scorers: sc, bases: nb, pos, at: this.spot(pos, launch.phi), launch, error: { pos: pos || "SS", kind: "fumble" }, batterBase: n });
    }

    // 凡打 (ゴロ・外野フライ・内野フライ・ライナー)
    outPlay(o, pos, idx, launch, bat, running) {
      const b = this.bases;
      const B = table().B;
      const at = this.spot(pos, launch.phi);
      const two = this.outs >= 2;
      if (o === "g") {
        const nb = [null, b[1], b[2], b[3]];
        const sc = [];
        // 押し出し (一塁から詰まっている走者だけ)
        const forceAdv = () => {
          if (b[1] && b[2] && b[3]) sc.push(b[3]);
          if (b[1] && b[2]) nb[3] = b[2];
          if (b[1]) nb[2] = b[1];
          nb[1] = null;
        };
        if (b[1] && !two) {
          const c = (B.dp && B.dp[idx]) || [76, 20, 4];
          let pDP = c[0] / (c[0] + c[1] + c[2] || 1);
          let pFC = c[1] / (c[0] + c[1] + c[2] || 1);
          if (running) {
            pDP *= 0.25; // エンドラン: 走者はスタートを切っている
            pFC *= 0.5;
          } else pDP = U.clamp(pDP * (1 - (spd(bat) - (B.avg.speed || 59)) * 0.006), 0, 1);
          const x = Math.random();
          if (x < pDP) {
            // 併殺: 一塁走者と打者がアウト
            forceAdv();
            nb[2] = null;
            if (b[3] && !(b[1] && b[2]) && chance(rate("goR3", b[3]))) {
              sc.push(b[3]);
              nb[3] = b[2] && b[1] ? nb[3] : null;
            }
            return this.mkRes("DP", { outsAdded: 2, scorers: sc, bases: nb, pos, at, launch, batterOut: true });
          }
          if (x < pDP + pFC) {
            // 野選: 一塁走者が二塁でアウト、打者は一塁へ
            forceAdv();
            nb[2] = null;
            nb[1] = bat;
            return this.mkRes("FC", { outsAdded: 1, scorers: sc, bases: nb, pos, at, launch, batterBase: 1 });
          }
          forceAdv();
          return this.mkRes("GO", { outsAdded: 1, scorers: sc, bases: nb, pos, at, launch, batterOut: true });
        }
        if (two && b[1] && chance(0.9)) {
          // 2 死: 二塁で封殺して 3 アウト (打者は記録上 野選)
          return this.mkRes("FC", { outsAdded: 1, scorers: [], bases: nb, pos, at, launch, batterBase: 1 });
        }
        if (!two) {
          // 押し出されない走者: 表の割合で進む
          if (b[3] && chance(rate("goR3", b[3]))) {
            sc.push(b[3]);
            nb[3] = null;
          }
          if (b[2] && !nb[3] && chance(rate("goR2", b[2]))) {
            nb[3] = b[2];
            nb[2] = null;
          }
        }
        return this.mkRes("GO", { outsAdded: 1, scorers: sc, bases: nb, pos, at, launch, batterOut: true });
      }
      // フライ・ライナー
      const nb = [null, b[1], b[2], b[3]];
      const sc = [];
      if (o === "j" && running && !two && chance(0.5)) {
        // エンドランでライナー: 一塁走者が戻れず併殺
        nb[1] = null;
        return this.mkRes("DPF", { outsAdded: 2, scorers: [], bases: nb, pos, air: true, at, launch, batterOut: true });
      }
      if (o === "h" && !two) {
        // タッチアップ (犠飛は区分ごとの割合)
        if (b[3]) {
          const c = B.sf && B.sf[idx];
          const a = B.adv.foR3 || [0.45, 0, 60];
          const base = c && c[1] ? c[0] / c[1] : a[0];
          if (chance(U.clamp(base + a[1] * (spd(b[3]) - a[2]), 0, 0.98))) {
            sc.push(b[3]);
            nb[3] = null;
          }
        }
        if (b[2] && !nb[3] && chance(rate("foR2", b[2]))) {
          nb[3] = b[2];
          nb[2] = null;
        }
      }
      const type = o === "h" ? (sc.length ? "SF" : "FO") : o === "i" ? "PO" : "LO";
      return this.mkRes(type, { outsAdded: 1, scorers: sc, bases: nb, pos, air: true, at, launch, batterOut: true });
    }

    /* ---------- 送りバント ---------- */
    quickBunt(launch, bat) {
      const B = table().B;
      const g = B.bunt.la;
      let li = binOf(launch.la, [g[0], g[1], g[2]]);
      let c = B.bunt.c[li];
      for (let d = 1; d < g[2] && !Object.keys(c).length; d++) c = B.bunt.c[U.clamp(li + (li >= g[2] / 2 ? -d : d), 0, g[2] - 1)];
      const keys = Object.keys(c);
      let tot = 0;
      for (const k of keys) tot += c[k];
      let x = Math.random() * tot;
      let ty = keys[0] || "SAC";
      for (const k of keys) {
        x -= c[k];
        if (x <= 0) {
          ty = k;
          break;
        }
      }
      const b = this.bases;
      const pos = U.pick(["P", "P", "1B", "3B", "C"]);
      const at = this.spot(pos, launch.phi);
      const adv1 = () => {
        const nb = [null, null, null, null];
        const sc = [];
        for (const k of [3, 2, 1]) if (b[k]) (k === 3 ? sc.push(b[k]) : (nb[k + 1] = b[k]));
        return { nb, sc };
      };
      // 先頭の走者 (押し出される一番先の走者)
      const lead = b[1] && b[2] ? 2 : b[1] ? 1 : b[2] ? 2 : 0;
      if (ty === "SAC" && lead) {
        const { nb, sc } = adv1();
        return this.mkRes("SAC", { outsAdded: 1, scorers: sc, bases: nb, pos, at, launch, batterOut: true });
      }
      if (ty === "H1" || ty === "E") {
        const { nb, sc } = adv1();
        nb[1] = bat;
        if (ty === "E") return this.mkRes("E", { scorers: sc, bases: nb, pos, at, launch, error: { pos, kind: "fumble" }, batterBase: 1 });
        return this.mkRes("H1", { scorers: sc, bases: nb, pos, at, launch, batterBase: 1 });
      }
      if ((ty === "FC" || ty === "DP") && lead) {
        const { nb, sc } = adv1();
        nb[lead + 1] = null; // 先頭の走者がアウト
        if (ty === "FC") {
          nb[1] = bat;
          return this.mkRes("FC", { outsAdded: 1, scorers: sc, bases: nb, pos, at, launch, batterBase: 1 });
        }
        return this.mkRes("DP", { outsAdded: 2, scorers: sc, bases: nb, pos, at, launch, batterOut: true });
      }
      // 小フライ・走者が進めなかったゴロ
      const type = ty === "PO" || ty === "LO" || ty === "FO" ? (ty === "FO" ? "PO" : ty) : "GO";
      return this.mkRes(type, { outsAdded: 1, scorers: [], bases: b.slice(), pos, air: type !== "GO", at, launch, batterOut: true });
    }

    /* ---------- ファウルフライ ---------- */
    foulFly(r) {
      const B = table().B;
      const f = B.ffo;
      const li = binOf(r.la, f.la);
      const ap = Math.abs(r.phi);
      let pj = f.ph.length - 2;
      for (let j = 0; j < f.ph.length - 1; j++)
        if (ap < f.ph[j + 1]) {
          pj = j;
          break;
        }
      const c = f.c[li * (f.ph.length - 1) + pj];
      if (!c || !c[1] || !chance(c[0] / c[1])) return null;
      const pos = r.phi < 0 ? c[2] : c[3];
      const res = this.mkRes("FFO", { outsAdded: 1, scorers: [], bases: this.bases, pos, air: true, at: this.spot(pos, r.phi), launch: { ev: r.ev, la: r.la, phi: r.phi }, batterOut: true });
      res.kind = "batted";
      return res;
    }

    /* ---------- 盗塁 (走力 + 盗塁◯ × 捕手の肩 × クイック) ---------- */
    quickSteal(steal) {
      const B = table().B;
      const S = B.steal;
      const def = this.defense();
      const c = def.C;
      const pit = this.pitcher();
      const nb = this.bases.slice();
      const steals = [];
      for (const k of [2, 1]) {
        if (!steal[k] || !this.bases[k]) continue;
        const p = this.bases[k];
        const eff = p.speed + (D.has(p, "steal") ? 12 : 0);
        // 走力と肩の区分の間を補間する
        const fs = U.clamp((eff - S.spd[0]) / S.spd[1] - 0.5, 0, S.spd[2] - 1);
        const fa = U.clamp((c.arm - S.arm[0]) / S.arm[1] - 0.5, 0, S.arm[2] - 1);
        const q = D.has(pit, "quick") ? 1 : 0;
        const at = (si, ai) => S.c[(((k - 1) * 2 + q) * S.spd[2] + si) * S.arm[2] + ai];
        const s0 = Math.floor(fs);
        const a0 = Math.floor(fa);
        const s1 = Math.min(S.spd[2] - 1, s0 + 1);
        const a1 = Math.min(S.arm[2] - 1, a0 + 1);
        const us = fs - s0;
        const ua = fa - a0;
        const p0 = U.lerp(U.lerp(at(s0, a0), at(s0, a1), ua), U.lerp(at(s1, a0), at(s1, a1), ua), us);
        const ok = chance(p0);
        nb[k] = null;
        if (ok && k + 1 <= 3) nb[k + 1] = p;
        steals.push({ p, from: k, ok });
      }
      if (!steals.length) return null;
      return { kind: "steal", quick: true, type: "STEAL", steals, bases: nb, outsAdded: 0, scorers: [], runs: 0 };
    }
  }

  QuickGame.table = table;
  QuickGame.isHomeRun = isHomeRun;
  PB.QuickGame = QuickGame;
})((window.PB = window.PB || {}));
