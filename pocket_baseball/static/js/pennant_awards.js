/* 熱闘！ポケットベースボール — ペナントのタイトル・表彰 (ゲーム内選考)
 * タイトルはレギュラーシーズン最終日に確定 (規定打席 = 試合数 × 3.1・規定投球回 = 試合数。同数は同時受賞)。
 * MVP・新人王・ベストナイン・ゴールデン・グラブ賞・沢村賞・月間 MVP・系列の MVP は成績と能力値から乱数を使わずに選ぶ
 * (記者投票ではない。同じ記録からは同じ結果)。結果は pen.awards に一度だけ保存する。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = PB.UI;
  const Store = PB.Store;
  const Sc = PB.Screens;
  const esc = U.esc;
  const Pen = () => PB.Pennant;
  const PA = {};
  const LG_SHORT = { C: "セ・リーグ", P: "パ・リーグ" };

  const n0 = (v) => v || 0;
  const avgOf = (s) => U.fmtAvg(n0(s.h), n0(s.ab));
  const eraOf = (s) => U.fmtERA(n0(s.er), n0(s.outs));
  const obpOf = (s) => {
    const den = n0(s.ab) + n0(s.bb) + n0(s.sf);
    return den ? U.fmtAvg(n0(s.h) + n0(s.bb), den) : ".---";
  };

  /* ---------- タイトルの表 (2004 年。確度の低いものは要確認) ---------- */
  const R = (PB.RULES_2004 = PB.RULES_2004 || {});
  R.qualPA = 3.1; // 規定打席 = チームの試合数 × 3.1 (四捨五入・要確認)
  R.qualIP = 1.0; // 規定投球回 = チームの試合数 × 1.0
  R.titles = [
    { key: "avg", name: "首位打者", kind: "bat", rate: 1, num: (s) => n0(s.h), den: (s) => n0(s.ab), qual: "pa", fmt: avgOf },
    { key: "obp", name: "最高出塁率", kind: "bat", rate: 1, num: (s) => n0(s.h) + n0(s.bb), den: (s) => n0(s.ab) + n0(s.bb) + n0(s.sf), qual: "pa", fmt: obpOf, note: "出塁率 = (安打+四死球) ÷ (打数+四死球+犠飛)" },
    { key: "hr", name: "本塁打王", kind: "bat", val: (s) => n0(s.hr), unit: "本" },
    { key: "rbi", name: "打点王", kind: "bat", val: (s) => n0(s.rbi), unit: "打点" },
    { key: "h", name: "最多安打", kind: "bat", val: (s) => n0(s.h), unit: "安打" },
    { key: "sb", name: "盗塁王", kind: "bat", val: (s) => n0(s.sb), unit: "盗塁" },
    { key: "w", name: "最多勝", kind: "pit", val: (s) => n0(s.w), unit: "勝" },
    { key: "era", name: "最優秀防御率", kind: "pit", rate: 1, low: 1, num: (s) => n0(s.er), den: (s) => n0(s.outs), qual: "ip", fmt: eraOf },
    { key: "k", name: "最多奪三振", kind: "pit", val: (s) => n0(s.pk), unit: "奪三振" },
    { key: "svp", name: "最優秀救援投手", kind: "pit", val: (s) => n0(s.sv) + n0(s.rw), unit: "SP", note: "セーブポイント（セーブ+救援勝利）。2004年の基準として実装（要確認）" },
    { key: "hp", name: "最優秀中継ぎ投手", kind: "pit", val: (s) => n0(s.hld) + n0(s.rw), unit: "HP", needs: "hld", note: "ホールドポイント（ホールド+救援勝利）。ホールドはゲームの簡易判定・基準は要確認" },
  ];
  // 規定 (チームの試合数 g から)
  PA.qualPA = (g) => Math.round((g * Math.round(R.qualPA * 10)) / 10);
  PA.qualOuts = (g) => Math.round(g * R.qualIP * 3);
  // 完投・ホールド・守備位置を最初から記録しているシーズンか (v3 より前のセーブは途中から)
  PA.fullTrack = (pen) => !pen.statsSince;

  /* ---------- 選手の一覧 ---------- */
  // リーグの選手 (今季の成績のある選手)。g = 所属球団の試合数 (レギュラーシーズン)
  function pool(pen, lg, statsIn) {
    const S = statsIn || pen.stats || {};
    const tg = {};
    for (const x of Pen().standings(pen, lg)) tg[x.id] = x.g;
    const bats = [];
    const pits = [];
    for (const t of Pen().lgTeams(pen, lg))
      for (const p of t.players) {
        const s = S[p.id];
        if (!s) continue;
        const x = { p, t, s, g: tg[t.id] || 0 };
        if (p.pos === "P") {
          if (s.pg || s.outs) pits.push(x);
        } else if (s.pa || s.g) bats.push(x);
      }
    // リーグの平均 (打撃の得点換算・防御率)
    let lin = 0;
    let pa = 0;
    for (const x of bats) {
      lin += linRaw(x.s);
      pa += n0(x.s.pa);
    }
    let er = 0;
    let outs = 0;
    for (const x of pits) {
      er += n0(x.s.er);
      outs += n0(x.s.outs);
    }
    return { bats, pits, L: { lin: pa ? lin / pa : 0, era: outs ? (er * 27) / outs : 4.0 } };
  }
  PA.pool = pool;
  const byId = (a, b) => (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0);

  /* ---------- 選手の価値 (得点換算・ゲーム内の評価) ---------- */
  const LW = { bb: 0.33, b1: 0.47, d: 0.77, t: 1.04, hr: 1.4, sb: 0.2, cs: -0.4, out: -0.27 };
  function linRaw(s) {
    const h = n0(s.h);
    const b1 = h - n0(s.d) - n0(s.t) - n0(s.hr);
    return LW.bb * n0(s.bb) + LW.b1 * b1 + LW.d * n0(s.d) + LW.t * n0(s.t) + LW.hr * n0(s.hr) + LW.sb * n0(s.sb) + LW.cs * n0(s.cs) + LW.out * (n0(s.ab) - h);
  }
  PA.linRaw = linRaw;
  // 打撃: リーグ平均との差 (得点)
  const batRuns = (s, L) => linRaw(s) - L.lin * n0(s.pa);
  const POS_ADJ = { C: 12, SS: 7, "2B": 3, CF: 3, "3B": 2, LF: -7, RF: -7, "1B": -12, DH: -15 };
  // 打者の価値 = 打撃 + 守備位置の補正 + 控え水準との差 (600 打席で 20 点)
  const batValue = (s, L, pos) => batRuns(s, L) + ((POS_ADJ[pos] || 0) + 20) * (n0(s.pa) / 600);
  // 投手の価値 = 控え水準 (リーグ防御率の 1.2 倍) より防いだ自責点 + セーブ
  const pitValue = (s, L) => (L.era * 1.2 * n0(s.outs)) / 27 - n0(s.er) + 0.4 * n0(s.sv);
  PA.batValue = batValue;
  PA.pitValue = pitValue;

  // 主な守備位置 (出場の最も多い位置。記録がなければ名簿の位置)
  const POS_ORDER = ["C", "SS", "2B", "CF", "3B", "LF", "RF", "1B", "DH"];
  function mainPos(p, s) {
    if (p.pos === "P") return "P";
    const pos = s && s.pos;
    let best = null;
    if (pos)
      for (const k of POS_ORDER)
        if (pos[k] && (!best || pos[k] > pos[best])) best = k;
    return best || p.pos;
  }
  PA.mainPos = mainPos;
  const OF = { LF: 1, CF: 1, RF: 1 };
  const ofGames = (s) => (s && s.pos ? n0(s.pos.LF) + n0(s.pos.CF) + n0(s.pos.RF) : 0);

  // 成績の一行
  function batLine(s) {
    return "打率" + avgOf(s) + " " + n0(s.hr) + "本 " + n0(s.rbi) + "打点" + (n0(s.sb) >= 10 ? " " + s.sb + "盗塁" : "");
  }
  function pitLine(s) {
    const rel = n0(s.sv) + n0(s.hld) > n0(s.gs);
    return n0(s.w) + "勝" + n0(s.l) + "敗" + (n0(s.sv) ? n0(s.sv) + "S" : "") + (rel && n0(s.hld) ? " " + s.hld + "H" : "") + " 防御率" + eraOf(s) + (rel ? "" : " " + n0(s.pk) + "奪三振");
  }
  const lineOf = (p, s) => (p.pos === "P" ? pitLine(s) : batLine(s));
  PA.lineOf = lineOf;
  const rec = (x, why, extra) => Object.assign({ id: x.p.id, tid: x.t.id, name: x.p.name, why: why || lineOf(x.p, x.s) }, extra || {});
  // 最大の 1 人 (同点は ID 順で先 = 乱数を使わない)
  function best(list, f) {
    let b = null;
    let bv = -Infinity;
    for (const x of list.slice().sort(byId)) {
      const v = f(x);
      if (v > bv + 1e-9) {
        bv = v;
        b = x;
      }
    }
    return b ? { x: b, v: bv } : null;
  }

  /* ---------- タイトル ---------- */
  // 分数の比較 (誤差なし): a/b と c/d
  const cmpFrac = (a, b) => a.num * b.den - b.num * a.den;
  function qualified(t, x) {
    if (t.qual === "pa") return n0(x.s.pa) >= PA.qualPA(x.g);
    if (t.qual === "ip") return n0(x.s.outs) >= PA.qualOuts(x.g);
    return true;
  }
  // リーグのタイトル争い: [{ t, rows: [{x, num, den, v, q}], holders: [...] }]
  PA.titles = function (pen, lg) {
    const pl = pool(pen, lg);
    const out = [];
    for (const t of R.titles) {
      if (t.needs === "hld" && !PA.fullTrack(pen)) continue;
      const cands = t.kind === "bat" ? pl.bats : pl.pits;
      let rows;
      let holders;
      if (t.rate) {
        rows = cands.filter((x) => t.den(x.s) > 0).map((x) => ({ x, num: t.num(x.s), den: t.den(x.s), q: qualified(t, x) }));
        rows.sort((a, b) => (t.low ? cmpFrac(a, b) : cmpFrac(b, a)) || byId(a.x, b.x));
        const q = rows.filter((r) => r.q);
        holders = q.length ? q.filter((r) => cmpFrac(r, q[0]) === 0) : [];
      } else {
        rows = cands.map((x) => ({ x, v: t.val(x.s), q: true })).filter((r) => r.v > 0);
        rows.sort((a, b) => b.v - a.v || byId(a.x, b.x));
        holders = rows.length ? rows.filter((r) => r.v === rows[0].v) : [];
      }
      out.push({ t, rows, holders });
    }
    return out;
  };
  const valText = (t, r) => (t.rate ? t.fmt(r.x.s) : r.v + t.unit);
  PA.valText = valText;
  // レギュラーシーズン最終日に確定して保存する (同じ成績からは同じ結果)
  PA.decideTitles = function (pen, day) {
    const A = awardsOf(pen);
    if (A.titles) return A.titles;
    const T = { day };
    for (const lg of leagues(pen))
      T[lg] = PA.titles(pen, lg).map((e) => ({
        key: e.t.key,
        name: e.t.name,
        holders: e.holders.map((r) => ({ id: r.x.p.id, tid: r.x.t.id, name: r.x.p.name, v: valText(e.t, r) })),
      }));
    A.titles = T;
    return T;
  };
  function awardsOf(pen) {
    return pen.awards || (pen.awards = { v: 1, monthly: [] });
  }
  const leagues = (pen) => Object.keys(D.LEAGUES || { C: 1, P: 1 }).filter((k) => Pen().lgTeams(pen, k).length);

  /* ---------- 年間の表彰 ---------- */
  // 2004 年の新人王は簡易判定 (実在選手の入団年・過去の出場のデータがないため): 24 歳以下・外国人以外で、
  // 名簿の 2004 年の実績 (r.stats) が少ない選手 (主力として実績のある若手を除く)。
  // 2 年目以降 (L4 のドラフトで入った選手) は入団 (rk) から 5 年以内で、前年までの出場が少ない選手
  PA.rookieRule = (pen) => ((pen.year || 2004) <= 2004 ? "2004年は簡易判定（24歳以下・外国人以外・名簿の2004年の実績が少ない選手）" : "入団5年以内・前年までの出場が少ない選手");
  function realBig(p) {
    const r = (p.real && p.real.stats) || {};
    if (p.pos === "P") return n0(r.w) + n0(r.sv) >= 10 || n0(r.ip) >= 100;
    return n0(r.g) >= 100 || n0(r.ab) >= 300 || n0(r.h) >= 100 || n0(r.hr) >= 15 || n0(r.rbi) >= 50;
  }
  PA.rookieOK = (pen, p) => rookieOK(pen, p);
  function rookieOK(pen, p) {
    const y = pen.year || 2004;
    if (y <= 2004 && p.rk == null) return !p.foreign && n0(p.age) > 0 && p.age <= 24 && !realBig(p);
    if (p.rk == null || y - p.rk > 4) return false;
    const hist = (pen.yearly && pen.yearly[p.id]) || [];
    let pa = 0;
    let outs = 0;
    for (const h of hist) if (h.y < y && h.s) (pa += n0(h.s.pa)), (outs += n0(h.s.outs));
    return pa <= 60 && outs <= 90;
  }
  // 守備の評価 (能力値 × その位置での出場 − 失策)。守備指標 (UZR など) は記録していないので使わない
  function defScore(p, pos) {
    const f = n0(p.field);
    const a = n0(p.arm);
    const c = n0(p.catch);
    const s = n0(p.speed);
    if (pos === "P") return f * 0.7 + a * 0.3;
    if (pos === "C") return a * 0.45 + f * 0.35 + c * 0.2 + (D.has(p, "catcher") ? 4 : 0);
    if (pos === "1B") return f * 0.7 + c * 0.3;
    if (pos === "2B" || pos === "SS") return f * 0.6 + a * 0.25 + s * 0.15;
    if (pos === "3B") return f * 0.55 + a * 0.35 + s * 0.1;
    return f * 0.45 + a * 0.3 + s * 0.25;
  }
  const posGames = (x, pos) => (pos === "P" ? n0(x.s.pg) : pos === "OF" ? ofGames(x.s) : x.s.pos ? n0(x.s.pos[pos]) : 0);

  // 沢村賞の 7 項目 (短いシーズンは試合数に合わせて換算)
  R.sawamura = [
    { k: "w", label: "15勝", n: 15 },
    { k: "pk", label: "150奪三振", n: 150 },
    { k: "cg", label: "10完投", n: 10 },
    { k: "era", label: "防御率2.50", max: 2.5 },
    { k: "ip", label: "200投球回", n: 200 },
    { k: "g", label: "25登板", n: 25 },
    { k: "pct", label: "勝率6割", min: 0.6 },
  ];
  R.sawamuraNeed = 5; // 7 項目のうち満たす数 (ゲームの設定)
  PA.sawamuraCheck = function (s, g, cgTracked) {
    const f = g >= 120 ? 1 : g / 140;
    const need = (n) => Math.max(1, Math.ceil(n * f));
    const out = { scaled: f < 1, labels: {} };
    for (const c of R.sawamura) out.labels[c.k] = f < 1 && c.n ? c.label.replace(String(c.n), String(need(c.n))) : c.label;
    for (const c of R.sawamura) {
      let ok = false;
      if (c.k === "w") ok = n0(s.w) >= need(c.n);
      else if (c.k === "pk") ok = n0(s.pk) >= need(c.n);
      else if (c.k === "cg") ok = cgTracked ? n0(s.cg) >= need(c.n) : null;
      else if (c.k === "era") ok = n0(s.outs) > 0 && (n0(s.er) * 27) / n0(s.outs) <= c.max;
      else if (c.k === "ip") ok = n0(s.outs) >= need(c.n) * 3;
      else if (c.k === "g") ok = n0(s.pg) >= need(c.n);
      else if (c.k === "pct") ok = n0(s.w) + n0(s.l) > 0 && n0(s.w) / (n0(s.w) + n0(s.l)) >= c.min;
      out[c.k] = ok;
    }
    out.count = R.sawamura.filter((c) => out[c.k] === true).length;
    return out;
  };

  // 1 リーグぶんの表彰 (MVP・新人王・ベストナイン・ゴールデン・グラブ)
  function leagueAwards(pen, lg) {
    const pl = pool(pen, lg);
    const L = pl.L;
    const st = Pen().standings(pen, lg);
    const pct = {};
    st.forEach((x) => (pct[x.id] = x.pct));
    const first = st[0] ? st[0].id : null;
    const val = (x) => (x.p.pos === "P" ? pitValue(x.s, L) : batValue(x.s, L, mainPos(x.p, x.s)));
    const all = pl.bats.concat(pl.pits);
    // MVP: 選手の価値 + チームの勝率 (+ 1 位)
    const mvpOK = (x) => (x.p.pos === "P" ? n0(x.s.outs) >= 2.4 * x.g || n0(x.s.sv) >= 0.15 * x.g : n0(x.s.pa) >= 2.5 * x.g);
    const mvp = best(all.filter(mvpOK), (x) => val(x) + (x.p.pos === "P" ? n0(x.s.w) : 0) + ((pct[x.t.id] || 0) - 0.5) * 40 + (x.t.id === first ? 5 : 0));
    // 新人王
    const royOK = (x) => rookieOK(pen, x.p) && (x.p.pos === "P" ? n0(x.s.outs) >= 1.5 * x.g || n0(x.s.pg) >= 0.3 * x.g : n0(x.s.pa) >= 1.5 * x.g);
    const roy = best(all.filter(royOK), val);
    // ベストナイン (セは DH なし・投手あり、パは DH あり)。守備位置は出場の最も多い位置
    const b9 = {};
    const used = new Set();
    const pickBat = (pos, n) => {
      const match = (x) => (pos === "OF" ? !!OF[mainPos(x.p, x.s)] : mainPos(x.p, x.s) === pos);
      let c = pl.bats.filter((x) => match(x) && n0(x.s.pa) >= 2.0 * x.g && !used.has(x.p.id));
      if (!c.length) c = pl.bats.filter((x) => match(x) && n0(x.s.pa) >= 1.0 * x.g && !used.has(x.p.id));
      const out = [];
      for (let i = 0; i < n; i++) {
        const b = best(
          c.filter((x) => !used.has(x.p.id)),
          (x) => batValue(x.s, L, mainPos(x.p, x.s)) + (n0(x.p.field) - 50) * 0.04
        );
        if (!b) break;
        used.add(b.x.p.id);
        out.push(rec(b.x, null, { pos: mainPos(b.x.p, b.x.s) }));
      }
      return out;
    };
    const bp = best(
      pl.pits.filter((x) => n0(x.s.outs) >= 2.1 * x.g),
      (x) => pitValue(x.s, L) + n0(x.s.w)
    ) || best(pl.pits, (x) => pitValue(x.s, L) + n0(x.s.w));
    b9.P = bp ? rec(bp.x, null, { pos: "P" }) : null;
    for (const pos of ["C", "1B", "2B", "3B", "SS"]) b9[pos] = pickBat(pos, 1)[0] || null;
    b9.OF = pickBat("OF", 3);
    if (lg === "P") b9.DH = pickBat("DH", 1)[0] || null;
    // ゴールデン・グラブ (DH なし・投手あり)
    const gg = {};
    const full = PA.fullTrack(pen);
    const ggPick = (pos, n) => {
      const out = [];
      const taken = new Set();
      for (let i = 0; i < n; i++) {
        const c = (pos === "P" ? pl.pits : pl.bats).filter((x) => {
          if (taken.has(x.p.id)) return false;
          if (pos === "P") return n0(x.s.outs) >= 1.8 * x.g;
          const main = mainPos(x.p, x.s);
          const okPos = pos === "OF" ? !!OF[main] : main === pos;
          if (!okPos) return false;
          const gp = full ? posGames(x, pos) : n0(x.s.g);
          return gp >= 0.5 * x.g;
        });
        const b = best(c, (x) => {
          const gp = full ? posGames(x, pos) : n0(x.s.g);
          return defScore(x.p, pos === "OF" ? mainPos(x.p, x.s) : pos) + 10 * Math.min(1, gp / Math.max(1, 0.8 * x.g)) - 1.2 * n0(x.s.fe);
        });
        if (!b) break;
        taken.add(b.x.p.id);
        const gp = full ? posGames(b.x, pos) : n0(b.x.s.g);
        out.push(rec(b.x, (pos === "P" ? "登板" + n0(b.x.s.pg) : (pos === "OF" ? "外野" : D.POS_FULL[pos] || pos) + "で" + gp + "試合") + (b.x.s.fe != null || full ? " 失策" + n0(b.x.s.fe) : ""), { pos }));
      }
      return out;
    };
    for (const pos of ["P", "C", "1B", "2B", "3B", "SS"]) gg[pos] = ggPick(pos, 1)[0] || null;
    gg.OF = ggPick("OF", 3);
    const why = (b, extra) => (b ? lineOf(b.x.p, b.x.s) + (extra || "") : "");
    return {
      mvp: mvp ? rec(mvp.x, why(mvp, "・チーム" + (st.findIndex((x) => x.id === mvp.x.t.id) + 1) + "位")) : null,
      roy: roy ? rec(roy.x) : null,
      b9,
      gg,
    };
  }
  // 沢村賞 (両リーグから最大 1 人・該当者なしもある)
  function sawamura(pen) {
    const cand = [];
    const cgOK = PA.fullTrack(pen);
    for (const lg of leagues(pen)) {
      const pl = pool(pen, lg);
      for (const x of pl.pits) {
        if (n0(x.s.gs) * 2 < n0(x.s.pg) || n0(x.s.outs) < 2.4 * x.g) continue;
        const c = PA.sawamuraCheck(x.s, x.g, cgOK);
        if (c.count >= R.sawamuraNeed) cand.push({ x, c, q: pitValue(x.s, pl.L) + 1.5 * n0(x.s.w) + 0.5 * n0(x.s.cg) });
      }
    }
    cand.sort((a, b) => b.c.count - a.c.count || b.q - a.q || byId(a.x, b.x));
    if (!cand.length) return { none: 1 };
    const b = cand[0];
    const met = R.sawamura.filter((c) => b.c[c.k] === true).map((c) => b.c.labels[c.k]);
    return rec(b.x, pitLine(b.x.s) + "（" + met.length + "項目: " + met.join("・") + (b.c.scaled ? "。短いシーズンは試合数で換算" : "") + "）", { met: met.length });
  }
  // 表彰式の日に一度だけ決める
  PA.decideSeason = function (pen, day) {
    const A = awardsOf(pen);
    if (!A.titles) PA.decideTitles(pen, Math.max(0, (pen.regDays || pen.schedule.length) - 1));
    if (A.season) return A.season;
    const S = { day, note: PA.rookieRule(pen) };
    for (const lg of leagues(pen)) S[lg] = leagueAwards(pen, lg);
    S.sawamura = sawamura(pen);
    A.season = S;
    return S;
  };

  /* ---------- 系列の MVP (ポストシーズン) ---------- */
  function seriesValue(s) {
    return linRaw(s) + 0.3 * n0(s.rbi) + 0.2 * n0(s.r) + 1.1 * ((4.0 * n0(s.outs)) / 27 - n0(s.er)) + n0(s.w) + 0.8 * n0(s.sv);
  }
  // fight: 敗れた球団の最も活躍した選手 (日本シリーズの敢闘選手)
  PA.seriesMVP = function (pen, s, fight) {
    const tid = fight ? s.lose : s.win;
    const S = (pen.post && pen.post.stats && pen.post.stats[s.id]) || {};
    const t = Pen().team(tid);
    if (!t) return null;
    const list = t.players.filter((p) => S[p.id]).map((p) => ({ p, t, s: S[p.id] }));
    const b = best(list, (x) => seriesValue(x.s));
    return b ? rec(b.x) : null;
  };

  /* ---------- 月間 MVP (日付のあるシーズンだけ・3・4月 / 5 / 6 / 7 / 8 / 9・10月) ---------- */
  PA.PERIODS = { 34: "3・4月", 5: "5月", 6: "6月", 7: "7月", 8: "8月", 910: "9・10月" };
  PA.periodOf = function (n) {
    const m = PB.PenSched.month(n);
    return m <= 4 ? "34" : m >= 9 ? "910" : String(m);
  };
  const M_KEYS = ["pa", "ab", "h", "d", "t", "hr", "rbi", "bb", "sb", "cs", "sf", "outs", "er", "pk", "w", "l", "sv", "pg", "gs"];
  // 試合ごと (afterGame フック): その月の成績を足す (pen.mcur。月が変わったら発表して消す)
  PA.onGame = function (pen, m, game, r) {
    if (r.ps || !pen.dates || pen.dates[r.day] == null || pen.legacyEnd || !PB.PenSched) return;
    const per = PA.periodOf(pen.dates[r.day]);
    if (!pen.mcur || pen.mcur.per !== per) {
      // 記録を途中から始めた区分 (この区分の前の日の結果がある) は表彰しない
      const partial = Pen()
        .regResults(pen)
        .some((x) => x.day < r.day && pen.dates[x.day] != null && PA.periodOf(pen.dates[x.day]) === per);
      pen.mcur = { per, partial: partial ? 1 : 0, s: {}, tg: {} };
    }
    const M = pen.mcur;
    M.tg[r.home] = (M.tg[r.home] || 0) + 1;
    M.tg[r.away] = (M.tg[r.away] || 0) + 1;
    for (const id in game.box) {
      const b = game.box[id];
      let t = null;
      for (const k of M_KEYS)
        if (b[k]) {
          t = t || M.s[id] || (M.s[id] = {});
          t[k] = (t[k] || 0) + b[k];
        }
    }
  };
  // 区分の発表 (その区分が終わった次の日)
  PA.closeMonth = function (pen, day) {
    const M = pen.mcur;
    if (!M) return;
    const A = awardsOf(pen);
    A.monthly = A.monthly || [];
    pen.mcur = null;
    if (A.monthly.some((x) => x.per === M.per)) return;
    if (M.partial) {
      A.monthly.push({ per: M.per, partial: 1, day });
      return;
    }
    for (const lg of leagues(pen)) {
      const pl = pool(pen, lg, M.s);
      const tgOf = (x) => M.tg[x.t.id] || 0;
      const b = best(
        pl.bats.filter((x) => n0(x.s.pa) >= 2.5 * tgOf(x) && tgOf(x) > 0),
        (x) => batRuns(x.s, pl.L)
      );
      const p = best(
        pl.pits.filter((x) => tgOf(x) > 0 && (n0(x.s.outs) >= 2 * tgOf(x) || n0(x.s.sv) >= Math.max(2, Math.ceil(tgOf(x) / 8)))),
        (x) => pitValue(x.s, pl.L) + 1.2 * n0(x.s.w)
      );
      if (b) A.monthly.push(Object.assign({ per: M.per, lg, kind: "bat", day }, rec(b.x, batLine(b.x.s))));
      if (p) A.monthly.push(Object.assign({ per: M.per, lg, kind: "pit", day }, rec(p.x, pitLine(p.x.s))));
    }
  };
  // その日の始め (beforeDay フック): 区分が変わったら前の区分を発表
  PA.beforeDay = function (pen, day) {
    if (!pen.mcur || !pen.dates) return;
    const rd = pen.regDays || pen.schedule.length;
    if (day >= rd || pen.dates[day] == null || PA.periodOf(pen.dates[day]) !== pen.mcur.per) PA.closeMonth(pen, day);
  };
  // 1 日の終わり (afterDay フック): レギュラーシーズン最終日にタイトル確定
  PA.afterDay = function (pen, day) {
    if (pen.legacyEnd) return;
    const rd = pen.regDays || pen.schedule.length;
    if (day === rd - 1 && !(pen.awards && pen.awards.titles)) PA.decideTitles(pen, day);
  };
  if (PB.Pennant && PB.Pennant.hooks) {
    PB.Pennant.hooks.afterGame.push((pen, m, game, r) => PA.onGame(pen, m, game, r));
    PB.Pennant.hooks.beforeDay.push((pen, day) => PA.beforeDay(pen, day));
    PB.Pennant.hooks.afterDay.push((pen, day) => PA.afterDay(pen, day));
  }

  /* ---------- 個人成績の「タイトル争い」タブ ---------- */
  PA.raceHTML = function (pen, lg) {
    const T = PA.titles(pen, lg);
    const fixed = pen.awards && pen.awards.titles;
    const tm = (x) => UI.mark(x.t, 16);
    const rows = T.map((e) => {
      const t = e.t;
      const q = e.rows.filter((r) => r.q);
      const h = e.holders;
      let main;
      let sub = "";
      if (!h.length) main = '<span class="muted">該当者なし</span>';
      else main = h.map((r) => '<span class="tr-nm" data-act="player" data-arg="' + esc(r.x.p.id) + '">' + tm(r.x) + "<b>" + esc(r.x.p.name) + "</b></span>").join("") + '<span class="tr-v">' + esc(valText(t, h[0])) + "</span>";
      // 2 位との差
      const second = (t.rate ? q : e.rows).find((r) => h.indexOf(r) < 0);
      if (h.length && second) {
        let gap;
        if (t.rate) {
          const v1 = h[0].num / h[0].den;
          const v2 = second.num / second.den;
          gap = t.key === "era" ? "差 " + Math.abs((v2 - v1) * 27).toFixed(2) : "差 " + ("" + Math.abs(v1 - v2).toFixed(3)).replace(/^0/, "");
        } else gap = "差 " + (h[0].v - second.v);
        sub += '<span class="tr-2">2位 ' + esc(second.x.p.name) + " " + esc(valText(t, second)) + "<i>" + esc(gap) + "</i></span>";
      } else if (h.length > 1) sub += '<span class="tr-2">' + h.length + "人が並ぶ（同時受賞）</span>";
      // 規定に届いていない選手が上にいるとき
      if (t.rate) {
        const nq = e.rows.find((r) => !r.q);
        const above = nq && (!h.length || (t.low ? cmpFrac(nq, h[0]) < 0 : cmpFrac(nq, h[0]) > 0));
        if (above && (t.qual === "pa" ? n0(nq.x.s.pa) * 2 >= PA.qualPA(nq.x.g) : n0(nq.x.s.outs) * 2 >= PA.qualOuts(nq.x.g))) {
          const left = t.qual === "pa" ? "あと" + (PA.qualPA(nq.x.g) - n0(nq.x.s.pa)) + "打席" : "あと" + U.fmtIP(PA.qualOuts(nq.x.g) - n0(nq.x.s.outs)) + "回";
          sub += '<span class="tr-nq"><i>規定未到達</i>' + esc(nq.x.p.name) + " " + esc(valText(t, nq)) + "（" + esc(left) + "）</span>";
        }
      }
      return '<div class="tr-row' + (h.some((r) => r.x.t.id === pen.my) ? " me" : "") + '"><div class="tr-t">' + esc(t.name) + '</div><div class="tr-1">' + main + "</div>" + (sub ? '<div class="tr-s">' + sub + "</div>" : "") + "</div>";
    }).join("");
    const st = Pen().standings(pen, lg);
    const g = st.length ? Math.max(...st.map((x) => x.g)) : 0;
    return (
      (fixed ? '<p class="tr-fixed"><i class="tr-fix">確定</i>レギュラーシーズンが終わり、タイトルが確定しました</p>' : "") +
      '<div class="tr-list">' +
      rows +
      '</div><p class="note small">規定打席は所属球団の試合数×3.1（四捨五入）、規定投球回は試合数×1.0（いま最多の球団で' +
      PA.qualPA(g) +
      "打席・" +
      PA.qualOuts(g) / 3 +
      "回）。同じ数字は同時受賞。" +
      esc(R.titles.find((t) => t.key === "svp").note) +
      "。" +
      (PA.fullTrack(pen) ? esc(R.titles.find((t) => t.key === "hp").note) + "。" : "最優秀中継ぎは記録の途中から（ホールドの記録なし）のため選びません。") +
      "</p>"
    );
  };

  /* ---------- 表彰式の画面 ---------- */
  const POS_LABEL = { P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三", SS: "遊", LF: "左", CF: "中", RF: "右", OF: "外", DH: "指" };
  // 守備位置の図 (ベストナイン / ゴールデン・グラブ)
  function diagram(pen, set, withDH) {
    if (!set) return '<p class="muted center">記録なし</p>';
    const tm = (id) => Pen().team(id) || { short: "?" };
    const chip = (r, slot, lbl) =>
      '<div class="aw-p s-' +
      slot +
      (r && r.tid === pen.my ? " me" : "") +
      '"' +
      (r ? ' data-act="player" data-arg="' + esc(r.id) + '"' : "") +
      '><span class="aw-pos">' +
      lbl +
      "</span>" +
      (r ? UI.mark(tm(r.tid), 16) + "<b>" + esc(r.name) + "</b><small>" + esc(r.why || "") + "</small>" : '<b class="muted">該当者なし</b>') +
      "</div>";
    const of = set.OF || [];
    return (
      '<div class="aw-dia"><div class="aw-diamond" aria-hidden="true"></div>' +
      chip(of[0], "LF", "外") +
      chip(of[1], "CF", "外") +
      chip(of[2], "RF", "外") +
      chip(set.SS, "SS", "遊") +
      chip(set["2B"], "2B", "二") +
      chip(set["3B"], "3B", "三") +
      chip(set["1B"], "1B", "一") +
      chip(set.P, "P", "投") +
      chip(set.C, "C", "捕") +
      (withDH ? chip(set.DH, "DH", "指") : "") +
      "</div>"
    );
  }
  PA.diagram = diagram;
  void POS_LABEL;

  // o = { ceremony, onBack, lg, tab }
  PA.screen = function (o) {
    const opt = o || {};
    const pen = Store.data.pennant;
    const N = Pen();
    const lgs = leagues(pen);
    const st = { lg: opt.lg || N.lgOf(pen.my), tab: opt.tab || "main" };
    const A = () => pen.awards || {};
    const cards = [];
    return {
      html() {
        cards.length = 0;
        const S = A().season;
        const T = A().titles;
        const lg = st.lg;
        let body = "";
        if (st.tab === "main") {
          if (!S) body = '<p class="muted center">MVP・新人王・ベストナイン・ゴールデン・グラブ賞・沢村賞はシーズン（ポストシーズン）の後の表彰式で発表します。</p>';
          else {
            const L = S[lg] || {};
            const big = (label, r, note) => {
              if (!r) return '<div class="aw-big none"><span class="aw-l">' + esc(label) + '</span><b class="muted">該当者なし</b>' + (note ? "<small>" + esc(note) + "</small>" : "") + "</div>";
              cards.push(r);
              return (
                '<div class="aw-big' +
                (r.tid === pen.my ? " me" : "") +
                '" data-act="player" data-arg="' +
                esc(r.id) +
                '"><div class="aw-pc" data-pc="' +
                esc(r.id) +
                '"></div><div class="aw-bt"><span class="aw-l">' +
                esc(label) +
                '</span><span class="aw-nm">' +
                UI.mark(N.team(r.tid) || { short: "?" }, 22) +
                "<b>" +
                esc(r.name) +
                "</b></span><small>" +
                esc((N.team(r.tid) || {}).short + "・" + (r.why || "")) +
                "</small>" +
                (note ? '<small class="aw-note">' + esc(note) + "</small>" : "") +
                "</div></div>"
              );
            };
            const sw = S.sawamura || { none: 1 };
            body =
              big(LG_SHORT[lg] + " MVP（最優秀選手）", L.mvp) +
              big(LG_SHORT[lg] + " 新人王", L.roy, S.note) +
              (sw.none
                ? '<div class="aw-row"><span class="aw-l">沢村賞（両リーグ）</span><b class="muted">該当者なし</b><small>7項目のうち' + R.sawamuraNeed + "項目以上を満たした先発投手なし（ゲーム内の選考）</small></div>"
                : '<div class="aw-row" data-act="player" data-arg="' + esc(sw.id) + '"><span class="aw-l">沢村賞（両リーグ）</span>' + UI.mark(N.team(sw.tid), 20) + "<b>" + esc(sw.name) + "</b><small>" + esc(sw.why) + "</small></div>");
            const P = pen.post;
            if (P && P.mvp)
              body += P.series
                .filter((s) => P.mvp[s.id])
                .map((s) => {
                  const m = P.mvp[s.id];
                  const f = s.id === "JS" && P.mvp.JSf ? P.mvp.JSf : null;
                  const row = (label, r) => '<div class="aw-row" data-act="player" data-arg="' + esc(r.id) + '"><span class="aw-l">' + esc(label) + "</span>" + UI.mark(N.team(r.tid), 20) + "<b>" + esc(r.name) + "</b><small>" + esc(r.why || "") + "</small></div>";
                  return row(PB.PenPost.mvpLabel(pen, s), m) + (f ? row("日本シリーズ 敢闘選手", f) : "");
                })
                .join("");
          }
        } else if (st.tab === "title") {
          const list = T ? T[lg] || [] : null;
          body = !list
            ? '<p class="muted center">タイトルはレギュラーシーズン最終日に確定します。途中経過は「個人成績」の「タイトル争い」で見られます。</p>'
            : '<div class="aw-titles">' +
              list
                .map(
                  (x) =>
                    '<div class="aw-tl' +
                    (x.holders.some((h) => h.tid === pen.my) ? " me" : "") +
                    '"><span class="aw-tn">' +
                    esc(x.name) +
                    "</span>" +
                    (x.holders.length
                      ? x.holders.map((h) => '<span class="aw-th" data-act="player" data-arg="' + esc(h.id) + '">' + UI.mark(N.team(h.tid), 18) + "<b>" + esc(h.name) + "</b></span>").join("") + '<span class="aw-tv">' + esc(x.holders[0].v) + "</span>"
                      : '<span class="muted">該当者なし</span>') +
                    "</div>"
                )
                .join("") +
              "</div>";
        } else if (st.tab === "b9" || st.tab === "gg") {
          const L = S && S[lg];
          body = !L ? '<p class="muted center">表彰式で発表します。</p>' : diagram(pen, st.tab === "b9" ? L.b9 : L.gg, st.tab === "b9" && lg === "P");
          if (L)
            body +=
              '<p class="note small">' +
              (st.tab === "b9"
                ? (lg === "P" ? "パ・リーグは指名打者を含む10人。" : "セ・リーグは指名打者なし（投手を含む9人）。") + "守備位置は今季いちばん多く出場した位置。外野は3人。打撃の得点換算（ゲーム内の評価）で選んでいます。"
                : "投手を含む9人（指名打者なし）。守備の能力値・その位置での出場試合・失策から選んでいます（守備範囲などの指標は記録していません）。" + (PA.fullTrack(pen) ? "" : "守備位置の記録が途中からのため出場は全試合数で見ています。")) +
              "</p>";
        } else {
          const list = (A().monthly || []).filter((x) => x.lg === lg || x.partial);
          const pers = Object.keys(PA.PERIODS).filter((k) => list.some((x) => x.per === k));
          body = !pen.dates
            ? '<p class="muted center">日付のない古いセーブのため月間MVPはありません。</p>'
            : !pers.length
              ? '<p class="muted center">月が終わった次の日に発表します。</p>'
              : '<div class="aw-mon">' +
                pers
                  .map((k) => {
                    const ps = list.filter((x) => x.per === k);
                    if (ps.some((x) => x.partial)) return '<div class="aw-mrow"><span class="aw-mp">' + PA.PERIODS[k] + '</span><span class="muted aw-mx">記録なし（記録の途中から）</span></div>';
                    const cell = (kind, label) => {
                      const r = ps.find((x) => x.kind === kind);
                      return r ? '<div class="aw-mc" data-act="player" data-arg="' + esc(r.id) + '"><i>' + label + "</i>" + UI.mark(N.team(r.tid), 16) + "<b>" + esc(r.name) + "</b><small>" + esc(r.why) + "</small></div>" : '<div class="aw-mc"><i>' + label + '</i><span class="muted">該当者なし</span></div>';
                    };
                    return '<div class="aw-mrow"><span class="aw-mp">' + PA.PERIODS[k] + "</span>" + cell("bat", "打者") + cell("pit", "投手") + "</div>";
                  })
                  .join("") +
                "</div>";
        }
        return (
          UI.header(opt.ceremony ? (pen.year || 2004) + "年 表彰式" : "タイトル・表彰", "back") +
          '<div class="scr-body aw-body">' +
          (opt.ceremony ? '<div class="aw-banner"><b>' + esc((pen.year || 2004) + "年 表彰式") + "</b><small>今季の活躍をたたえます</small></div>" : "") +
          (lgs.length > 1
            ? Sc.seg(
                "lg",
                lgs.map((k) => [k, D.LEAGUES[k]]),
                st.lg
              )
            : "") +
          Sc.seg(
            "tab",
            [
              ["main", "MVP・新人王"],
              ["title", "タイトル"],
              ["b9", "ベストナイン"],
              ["gg", "Gグラブ"],
              ["mon", "月間MVP"],
            ],
            st.tab
          ) +
          body +
          '<p class="note small aw-foot">ゲーム内選考（記者投票ではありません）。このペナントの成績と能力値から乱数を使わずに決めています。</p>' +
          (opt.ceremony ? '<div class="row-btns"><button class="btn primary" data-act="back">シーズン総括へ</button></div>' : "") +
          "</div>"
        );
      },
      mount(root) {
        if (!PB.Cards || !root.querySelectorAll) return;
        for (const slot of root.querySelectorAll(".aw-pc")) {
          const f = N.findPlayer(slot.getAttribute("data-pc"));
          if (f) slot.appendChild(PB.Cards.el(f.p, f.team, { w: Math.min(110, Math.round(window.innerWidth * 0.28)), mini: true }));
        }
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(opt.onBack ? opt.onBack() : N.final());
        if (act === "lg") st.lg = arg;
        else if (act === "tab") st.tab = arg;
        else if (act === "player") return N.showPlayer(arg);
        UI.refresh();
      },
    };
  };

  PB.PenAwards = PA;
})((window.PB = window.PB || {}));
