/* 熱闘！ポケットベースボール — 試合の進行・記録 (描画と独立) */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const P = PB.P;
  const AI = PB.AI;

  const HIT_BASES = { H1: 1, H2: 2, H3: 3, HR: 4, IPHR: 4 };

  /* ---------- 実況の文言 ---------- */
  const Talk = {};
  Talk.POS = { P: "ピッチャー", C: "キャッチャー", "1B": "ファースト", "2B": "セカンド", "3B": "サード", SS: "ショート", LF: "レフト", CF: "センター", RF: "ライト" };
  Talk.dirOf = function (res) {
    const pt = res.landing || res.firstAt;
    if (!pt) return { pos: res.firstTouch || "CF", zone: "" };
    const th = U.deg(Math.atan2(pt[0], pt[1]));
    const r = Math.hypot(pt[0], pt[1]);
    let pos = res.firstTouch;
    if (!pos || ["LF", "CF", "RF"].indexOf(pos) < 0) pos = th < -15 ? "LF" : th > 15 ? "RF" : "CF";
    let zone = "前";
    if (th < -37 || th > 37) zone = "線";
    else if (th > -31 && th < -11 && r > 60) zone = "左中間";
    else if (th > 11 && th < 31 && r > 60) zone = "右中間";
    else if (r > 88 || res.fenceHit) zone = "オーバー";
    return { pos, zone, th, r };
  };
  Talk.desc = function (res) {
    const T = Talk.POS;
    const ft = res.firstTouch;
    const d = Talk.dirOf(res);
    const posName = T[d.pos];
    const zoneText = d.zone === "左中間" || d.zone === "右中間" ? d.zone : posName + (d.zone === "前" ? "前" : d.zone === "線" ? "線" : "オーバー");
    switch (res.type) {
      case "HR": {
        const th = res.launch ? res.launch.phi : 0;
        const where = th < -15 ? "レフト" : th > 15 ? "ライト" : "バックスクリーン";
        return where === "バックスクリーン" ? "バックスクリーンへ ホームラン！" : where + "スタンドへ ホームラン！";
      }
      case "IPHR":
        return "ランニングホームラン！";
      case "H1":
        if (ft && ["LF", "CF", "RF"].indexOf(ft) < 0) return T[ft] + "への内野安打";
        return (d.zone === "左中間" || d.zone === "右中間" ? d.zone : posName + "前") + "ヒット";
      case "H2":
        return zoneText + "ツーベース！";
      case "H3":
        return zoneText + "スリーベース！";
      case "GO":
        return (T[ft] || "内野") + "ゴロ";
      case "FO":
        return (T[ft] || "外野") + "フライ";
      case "PO":
        return (T[ft] || "内野") + "フライ";
      case "LO":
        return (T[ft] || "") + "ライナー";
      case "DP":
        return (T[ft] || "") + "ゴロ ゲッツー！";
      case "DPF":
        return (T[ft] || "") + "ライナー ダブルプレー！";
      case "TP":
        return "トリプルプレー！！";
      case "SF":
        return (T[ft] || "外野") + "への犠牲フライ";
      case "SAC":
        return "送りバント成功";
      case "FC":
        return (T[ft] || "") + "ゴロ フィルダースチョイス";
      case "E":
        return (T[(res.error && res.error.pos) || ft] || "") + "のエラー！";
      case "FFO":
        return (T[ft] || "") + "ファウルフライ";
      default:
        return "";
    }
  };
  // テレビの「きょうの成績」風の短い表記 (中フライ・左安・三振 …)
  Talk.POS1 = { P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三", SS: "遊", LF: "左", CF: "中", RF: "右" };
  Talk.short = function (res) {
    const T = Talk.POS1;
    const ft = res.firstTouch;
    const of = () => T[Talk.dirOf(res).pos] || "中";
    switch (res.type) {
      case "H1":
        return ft && ["LF", "CF", "RF"].indexOf(ft) < 0 ? (T[ft] || "") + "内安" : of() + "安";
      case "H2":
        return of() + "二";
      case "H3":
        return of() + "三";
      case "HR":
      case "IPHR": {
        const th = res.launch ? res.launch.phi : 0;
        return (res.type === "IPHR" ? of() : th < -15 ? "左" : th > 15 ? "右" : "中") + "本";
      }
      case "GO":
        return (T[ft] || "") + "ゴロ";
      case "FO":
      case "PO":
        return (T[ft] || "") + "フライ";
      case "LO":
        return (T[ft] || "") + "ライナー";
      case "DP":
        return (T[ft] || "") + "併殺";
      case "DPF":
        return (T[ft] || "") + "直併殺";
      case "TP":
        return "三重殺";
      case "SF":
        return (T[ft] || "") + "犠飛";
      case "SAC":
        return "犠打";
      case "FC":
        return "野選";
      case "E":
        return (T[(res.error && res.error.pos) || ft] || "") + "失";
      case "FFO":
        return (T[ft] || "") + "邪飛";
      default:
        return "";
    }
  };
  // 得点場面の一行 (今日の結果): 鳥谷4号先制2ラン / 矢野 同点適時二塁打 / 金本 押し出し四球で勝ち越し
  Talk.scoreText = function (o) {
    const ctx = o.walkoff ? "サヨナラ" : o.ctx;
    const n = o.n;
    const nm = o.name;
    if (o.kind === "walk") return nm + " 押し出し" + (o.hbp ? "死球" : "四球") + (ctx ? "で" + ctx : "");
    const res = o.res || {};
    switch (res.type) {
      case "HR":
        return nm + (o.hrNo ? o.hrNo + "号" : " ") + ctx + (n >= 4 ? "満塁弾" : n === 1 ? "ソロ" : n + "ラン");
      case "IPHR":
        return nm + (o.hrNo ? o.hrNo + "号" : " ") + ctx + "ランニング本塁打";
      case "H1":
      case "H2":
      case "H3":
        return nm + " " + ctx + (n > 1 ? n + "点" : "") + { H1: "適時打", H2: "適時二塁打", H3: "適時三塁打" }[res.type];
      case "SF":
        return nm + " " + ctx + "犠飛";
      default: {
        const how = { GO: "内野ゴロ", DP: "併殺打", FC: "野選", E: "敵失", SAC: "犠打", FO: "外野フライ", PO: "内野フライ", LO: "ライナー" }[res.type] || "";
        return nm + " " + (how ? how + "の間に" : "") + (ctx || n + "点");
      }
    }
  };
  PB.Talk = Talk;

  /* ---------- 試合 ---------- */
  class Game {
    constructor(o) {
      this.teams = { away: o.away, home: o.home };
      this.innings = o.innings || 9;
      this.maxInnings = o.maxInnings || (this.innings >= 9 ? 12 : this.innings + 2);
      this.user = o.user || null; // 'home' | 'away' | 'both' | null
      this.levelKey = o.level || "normal";
      this.level = AI.LEVELS[this.levelKey] || AI.LEVELS.normal;
      this.tired = o.tired || [];
      this.inning = 1;
      this.top = true;
      this.outs = 0;
      this.balls = 0;
      this.strikes = 0;
      this.bases = [null, null, null, null];
      this.score = { away: 0, home: 0 };
      this.line = { away: [], home: [] };
      this.hits = { away: 0, home: 0 };
      this.errors = { away: 0, home: 0 };
      // DH 制: 本拠地のリーグで決める (2004 年はセ・リーグ = なし, パ・リーグ = あり)
      const hdef = PB.D.teamDef ? PB.D.teamDef(o.home.id) : null;
      this.dh = o.dh != null ? !!o.dh : !(hdef && hdef.lg === "C");
      this.order = PB.D.lineupFor ? { away: PB.D.lineupFor(o.away, this.dh), home: PB.D.lineupFor(o.home, this.dh) } : { away: U.clone(o.away.lineup), home: U.clone(o.home.lineup) };
      this.bi = { away: 0, home: 0 };
      this.box = {};
      this.log = [];
      this.paLog = {}; // 打者ごとの今日の打席結果 (短い表記)
      this.scoreLog = []; // 得点場面 (今日の結果)
      this.hrLog = []; // 本塁打の記録 (ニュースの「今日のホームラン」用)
      this.hrRun = 0; // このイニングで続いている本塁打の打席数 (N者連続の判定)
      this.phIds = {}; // この半イニングに代打で出た選手
      this.paN = { away: 0, home: 0 }; // チームの打席数 (先頭打者の判定)
      this.over = false;
      this.used = { away: [], home: [] };
      this.pstate = {};
      this.record = { win: {}, lose: {}, leader: null };
      this.listeners = [];
      this.byId = {};
      for (const side of ["away", "home"]) {
        for (const p of this.teams[side].players) this.byId[p.id] = p;
        const t = this.teams[side];
        const sid = (o.starters && o.starters[side]) || t.rotation[(t.rotIdx || 0) % t.rotation.length];
        this.setPitcher(side, sid, true);
        for (const e of this.order[side]) if (e.pos === "P") e.id = this.pstate[side].id;
        this.order[side].forEach((e) => this.stat(e.id).g || (this.stat(e.id).g = 1));
      }
      this.line.away.push(0);
      this.newPA();
    }

    on(fn) {
      this.listeners.push(fn);
    }
    emit(type, data) {
      for (const fn of this.listeners) fn(type, data || {});
    }

    P(id) {
      return this.byId[id];
    }
    battingSide() {
      return this.top ? "away" : "home";
    }
    fieldingSide() {
      return this.top ? "home" : "away";
    }
    isUser(side) {
      return this.user === "both" || this.user === side;
    }
    batter() {
      const s = this.battingSide();
      const e = this.order[s][this.bi[s]];
      // DH なし: 投手の打順にはその時の投手が入る
      return e.pos === "P" ? this.pitcher(s) : this.P(e.id);
    }
    batterPos() {
      const s = this.battingSide();
      return this.order[s][this.bi[s]].pos;
    }
    onDeck(k) {
      const s = this.battingSide();
      const e = this.order[s][(this.bi[s] + (k || 1)) % 9];
      return e.pos === "P" ? this.pitcher(s) : this.P(e.id);
    }
    pitcher(side) {
      return this.P(this.pstate[side || this.fieldingSide()].id);
    }
    isTired(id) {
      return this.tired.indexOf(id) >= 0;
    }
    defense(side) {
      const s = side || this.fieldingSide();
      const m = {};
      for (const e of this.order[s]) if (e.pos !== "DH" && e.pos !== "PH" && e.pos !== "P") m[e.pos] = this.P(e.id);
      m.P = this.pitcher(s);
      return m;
    }

    stat(id) {
      if (!this.box[id]) this.box[id] = { g: 0, pa: 0, ab: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, sb: 0, cs: 0, sac: 0, sf: 0, pg: 0, gs: 0, outs: 0, ph: 0, pr: 0, er: 0, pbb: 0, pk: 0, phr: 0, np: 0, w: 0, l: 0, sv: 0 };
      return this.box[id];
    }

    setPitcher(side, id, starter) {
      const p = this.P(id);
      const max = 34 + p.stamina * 1.05;
      this.pstate[side] = { id, stamina: max, max, runs: 0, pitches: 0, enterLead: this.leadOf(side), enterInning: this.inning, outsAtEnter: 0 };
      if (this.used[side].indexOf(id) < 0) this.used[side].push(id);
      const s = this.stat(id);
      s.pg = 1;
      if (starter) s.gs = 1;
      if (!starter) {
        this.emit("pitcherChange", { side, p });
        this.addLog((this.teams[side].short || "") + " 投手交代 " + p.name);
      }
    }

    leadOf(side) {
      return side === "home" ? this.score.home - this.score.away : this.score.away - this.score.home;
    }

    ctx(forUser) {
      const fs = this.fieldingSide();
      const def = this.defense(fs);
      const bs = this.battingSide();
      const behind = this.leadOf(bs) <= 0;
      const c = {
        balls: this.balls,
        strikes: this.strikes,
        outs: this.outs,
        inning: this.inning,
        risp: !!(this.bases[2] || this.bases[3]),
        runnersOn: !!(this.bases[1] || this.bases[2] || this.bases[3]),
        runner3: !!this.bases[3],
        catcherSkill: D.has(def.C, "catcher"),
        clutchSpot: this.inning >= this.innings && behind && !this.top,
        level: AI.SIM,
      };
      const lv = this.level;
      if (forUser === "bat") {
        c.cursorMul = lv.cursorMul;
        c.windowMul = lv.windowMul;
      }
      if (forUser === "cpuBat") {
        c.level = lv;
        c.powerBonus = lv.cpuPower;
      }
      if (forUser === "cpuPitch") c.controlBonus = lv.cpuCtl;
      return c;
    }

    addLog(text, kind) {
      this.log.push({ inning: this.inning, top: this.top, text, kind: kind || "info" });
    }
    addPA(id, code) {
      (this.paLog[id] || (this.paLog[id] = [])).push(code);
    }

    newPA() {
      this.balls = 0;
      this.strikes = 0;
      this.paBunt = null;
    }

    /* ---------- 投球処理 ---------- */
    pitchThrown(pc) {
      const st = this.pstate[this.fieldingSide()];
      let cost = 1 + (this.bases[2] || this.bases[3] ? 0.25 : 0) + (pc.type !== "FB" ? 0.15 : 0);
      st.stamina = Math.max(0, st.stamina - cost);
      st.pitches++;
      this.stat(st.id).np++;
    }

    // スイング判定 (見逃し含む)
    judge(pc, sw) {
      const bat = this.batter();
      const pit = this.pitcher();
      const side = P.batSide(bat, pit);
      if (!sw || !sw.swing) {
        if (P.hitByPitch(pc, side)) return { call: "hbp" };
        return { call: pc.strike ? "strike" : "ball", look: true };
      }
      const userBat = this.isUser(this.battingSide());
      const res = P.swing(pc, sw, bat, pit, this.ctx(userBat ? "bat" : "cpuBat"));
      if (res.type === "buntmiss") return { call: res.strikeCall ? "strike" : "ball", bunt: true, res };
      if (res.type === "whiff") return { call: "strike", swinging: true, res };
      if (res.type === "foul") return { call: "foul", res };
      return { call: "inplay", res };
    }

    align(sw) {
      const b = this.bases;
      const lateClose = this.inning >= this.innings - 1 && Math.abs(this.score.home - this.score.away) <= 1;
      return {
        holdRunner: !!b[1] && !b[2],
        dpDepth: !!b[1] && this.outs < 2,
        buntShift: !!(sw && sw.bunt),
        infieldIn: !!b[3] && this.outs < 2 && lateClose,
      };
    }

    makeBattedPlay(jr, sw, stealing) {
      const bat = this.batter();
      const pit = this.pitcher();
      const bb = P.battedBall(jr.res);
      return new PB.Play({
        kind: "batted",
        ball: bb,
        defense: this.defense(),
        batter: bat,
        batSide: P.batSide(bat, pit),
        runners: this.bases,
        stealing: stealing || null,
        stealLead: stealing ? this.stealLead(stealing, jr.pc) : null,
        outs: this.outs,
        bunt: !!(sw && sw.bunt),
        align: this.align(sw),
      });
    }

    // ファウルフライとして捕れるか (捕れないなら null)
    makeFoulPlay(jr) {
      const bat = this.batter();
      const pit = this.pitcher();
      const r = jr.res;
      if (r.tip || r.la < 20) return null;
      const play = new PB.Play({
        kind: "batted",
        foul: true,
        ball: P.battedBall(r),
        defense: this.defense(),
        batter: bat,
        batSide: P.batSide(bat, pit),
        runners: [null, null, null, null],
        outs: this.outs,
        align: {},
      });
      if (play.icpt && play.icpt.air) return play;
      return null;
    }

    stealLead(stealing, pc) {
      const pit = this.pitcher();
      for (const k in stealing) {
        const r = this.bases[k];
        if (!r) continue;
        const spd = 6.4 + r.speed * 0.026;
        const jump = 0.9 + (D.has(r, "steal") ? 0.1 : 0) - (D.has(pit, "quick") ? 0.15 : 0);
        return U.clamp(3.3 + spd * (jump + (pc ? pc.T : 0.45)) - 1.2, 4, 20);
      }
      return 8;
    }

    makeStealPlay(stealing, pc) {
      const bat = this.batter();
      const pit = this.pitcher();
      const play = new PB.Play({
        kind: "steal",
        defense: this.defense(),
        batter: bat,
        batSide: P.batSide(bat, pit),
        runners: this.bases,
        stealing,
        stealLead: this.stealLead(stealing, pc),
        outs: this.outs,
        align: {},
      });
      play.fmap.C.holdT += 0.25;
      return play;
    }

    // ボール/ストライク/ファウル/死球 の適用。返り値: 'walk'|'k'|'hbp'|null
    applyCall(jr) {
      const bs = this.battingSide();
      switch (jr.call) {
        case "ball":
          this.balls++;
          if (this.balls >= 4) {
            this.walk(false);
            return "walk";
          }
          return null;
        case "strike":
          this.strikes++;
          if (this.strikes >= 3) {
            this.strikeout(jr.swinging);
            return "k";
          }
          return null;
        case "foul":
          if (jr.bunt || (jr.res && jr.res.bunt)) {
            // スリーバント失敗
            if (this.strikes >= 2) {
              this.strikeout(true, true);
              return "k";
            }
          }
          if (this.strikes < 2) this.strikes++;
          return null;
        case "hbp":
          this.walk(true);
          return "hbp";
        default:
          void bs;
          return null;
      }
    }

    walk(hbp) {
      const bat = this.batter();
      const b = this.bases;
      const nb = b.slice();
      const scored = [];
      if (b[1]) {
        if (b[2]) {
          if (b[3]) scored.push(b[3]);
          nb[3] = b[2];
        }
        nb[2] = b[1];
      }
      nb[1] = bat;
      this.bases = nb;
      const s = this.stat(bat.id);
      s.pa++;
      s.bb++;
      const ps = this.stat(this.pstate[this.fieldingSide()].id);
      ps.pbb++;
      this.addLog(bat.name + (hbp ? " デッドボール" : " フォアボール"), "walk");
      this.addPA(bat.id, hbp ? "死球" : "四球");
      this.emit("walk", { hbp });
      this.cause = { kind: "walk", hbp, bat };
      this.scoreRuns(scored, true);
      this.endPA();
    }

    strikeout(swinging, bunt) {
      const bat = this.batter();
      const s = this.stat(bat.id);
      s.pa++;
      s.ab++;
      s.k++;
      this.stat(this.pstate[this.fieldingSide()].id).pk++;
      this.outs++;
      this.pstate[this.fieldingSide()].outsAtEnter++;
      this.stat(this.pstate[this.fieldingSide()].id).outs++;
      this.addLog(bat.name + (bunt ? " スリーバント失敗" : swinging ? " 空振り三振" : " 見逃し三振"), "out");
      this.addPA(bat.id, bunt ? "バント失敗" : swinging ? "空三振" : "見三振");
      this.emit("strikeout", { swinging });
      this.endPA();
    }

    scoreRuns(players, rbiOK) {
      if (!players.length) return;
      const bs = this.battingSide();
      const fs = this.fieldingSide();
      const before = this.leadOf(bs);
      for (const p of players) {
        this.score[bs]++;
        this.line[bs][this.line[bs].length - 1]++;
        this.stat(p.id).r++;
        this.pstate[fs].runs++;
        const ps = this.stat(this.pstate[fs].id);
        ps.pr++;
        ps.er++;
      }
      if (rbiOK) this.stat(this.batter().id).rbi += players.length;
      const after = this.leadOf(bs);
      const c = this.cause;
      this.cause = null;
      if (c) {
        const total0 = this.score.home + this.score.away - players.length;
        const ctx = total0 === 0 ? "先制" : before < 0 && after === 0 ? "同点" : before < 0 && after > 0 ? "逆転" : before === 0 && after > 0 ? "勝ち越し" : "";
        const walkoff = !this.top && this.inning >= this.innings && before <= 0 && after > 0;
        this.lastCtx = { ctx, walkoff, before, after };
        const text = Talk.scoreText({ kind: c.kind, hbp: c.hbp, res: c.res, name: c.bat.name, n: players.length, ctx, walkoff, hrNo: c.hrNo });
        this.scoreLog.push({ side: bs, inning: this.inning, top: this.top, text, ctx: walkoff ? "サヨナラ" : ctx, n: players.length, hr: !!(c.res && (c.res.type === "HR" || c.res.type === "IPHR")), score: { away: this.score.away, home: this.score.home } });
      }
      // 勝利/敗戦投手の候補
      if (before <= 0 && after > 0) {
        this.record.win[bs] = this.pstate[bs].id;
        this.record.lose[fs] = this.pstate[fs].id;
        this.record.leader = bs;
      }
      this.emit("score", { side: bs, n: players.length });
    }

    applyPlay(res) {
      const bs = this.battingSide();
      const fs = this.fieldingSide();
      const bat = this.batter();
      const s = this.stat(bat.id);
      const ps = this.stat(this.pstate[fs].id);
      const desc = Talk.desc(res);
      res.desc = desc;
      if (res.error) this.errors[fs]++;
      // 成績
      s.pa++;
      const t = res.type;
      if (t === "SAC") s.sac++;
      else if (t === "SF") s.sf++;
      else s.ab++;
      if (HIT_BASES[t]) {
        s.h++;
        this.hits[bs]++;
        ps.ph++;
        if (t === "H2") s.d++;
        if (t === "H3") s.t++;
        if (t === "HR" || t === "IPHR") {
          s.hr++;
          ps.phr++;
        }
      }
      // アウト
      this.outs += res.outsAdded;
      this.pstate[fs].outsAtEnter += res.outsAdded;
      ps.outs += res.outsAdded;
      // 塁と得点
      this.bases = res.bases;
      const rbiOK = t !== "E" && t !== "DP" && t !== "DPF";
      const er = res.error ? 0 : 1;
      const isHR = HIT_BASES[t] === 4;
      const hrFlags = isHR ? this.hrFlags(bat, s, bs) : null;
      this.addPA(bat.id, Talk.short(res));
      // 本塁打の号数 (シーズン成績があるときだけ)
      if (HIT_BASES[t] === 4 && this.season) res.hrNo = ((this.season[bat.id] || {}).hr || 0) + s.hr;
      this.cause = { kind: "play", res, bat, hrNo: res.hrNo };
      this.lastCtx = null;
      this.scoreRuns(res.scorers, rbiOK);
      if (!er) ps.er -= res.scorers.length;
      if (isHR) this.recordHR(res, bat, bs, fs, hrFlags);
      this.thisPAHR = isHR;
      this.addLog(bat.name + " " + desc + (res.runs ? "（" + res.runs + "点）" : ""), HIT_BASES[t] ? "hit" : res.batterOut ? "out" : "info");
      this.lastPlay = res;
      this.emit("play", res);
      this.endPA();
    }

    applySteal(res) {
      const fs = this.fieldingSide();
      for (const st of res.steals) {
        const s = this.stat(st.p.id);
        this.bases[st.from] = null;
        if (st.ok) {
          s.sb++;
          if (st.from + 1 <= 3) this.bases[st.from + 1] = st.p;
          this.addLog(st.p.name + " 盗塁成功", "info");
        } else {
          s.cs++;
          this.outs++;
          this.pstate[fs].outsAtEnter++;
          this.stat(this.pstate[fs].id).outs++;
          this.addLog(st.p.name + " 盗塁失敗", "out");
        }
      }
      // 盗塁以外の走者 (ディレードなど) は Play の最終位置を優先
      if (res.bases && this.outs < 3) {
        const nb = [null, null, null, null];
        for (let b = 1; b <= 3; b++) if (res.bases[b]) nb[b] = res.bases[b];
        this.bases = nb;
      }
      this.emit("steal", res);
      if (this.outs >= 3) this.endHalf(true);
    }

    // 本塁打の状況 (打席の結果を記録する前に調べる。s.pa はこの打席を含む)
    hrFlags(bat, s, bs) {
      const prev = this.paLog[bat.id] || [];
      let c = 1;
      for (let i = prev.length - 1; i >= 0 && /本$/.test(prev[i]); i--) c++;
      return {
        b2b: this.hrRun > 0 ? this.hrRun + 1 : 0, // N者連続
        consec: c >= 2 ? c : 0, // N打席連続
        ph: !!this.phIds[bat.id] && s.pa === 1, // 代打 (代打で出た打席だけ)
        lead: this.paN[bs] === 0, // 先頭打者 (試合で最初の打席)
        hand: P.batSide(bat, this.pitcher(this.fieldingSide())),
      };
    }

    // 本塁打 1 本ぶんの記録 (確定した数字だけを残す)
    recordHR(res, bat, bs, fs, f) {
      const c = this.lastCtx || {};
      const n = res.scorers.length;
      const th = res.launch ? res.launch.phi : 0;
      const pid = this.pstate[fs].id;
      const e = {
        id: bat.id,
        nm: bat.name,
        tid: this.teams[bs].id,
        side: bs,
        pid,
        pn: this.P(pid).name,
        inn: this.inning,
        top: this.top,
        outs: this.outs - (res.outsAdded || 0),
        n,
        no: res.hrNo || 0,
        dist: res.dist || 0,
        dir: res.type === "IPHR" ? "" : th < -15 ? "左" : th > 15 ? "右" : "中",
        type: res.type,
        ctx: c.walkoff ? "サヨナラ" : c.ctx || "",
        game: this.stat(bat.id).hr, // この試合 何本目
        score: { away: this.score.away, home: this.score.home },
      };
      if (f) {
        if (f.b2b >= 2) e.b2b = f.b2b;
        if (f.consec >= 2) e.consec = f.consec;
        if (f.ph) e.ph = 1;
        if (f.lead) e.lead = 1;
        if (f.hand) e.hand = f.hand;
        // 両打席本塁打 (スイッチヒッターが左右両方で打った)
        if (f.hand && this.hrLog.some((x) => x.id === bat.id && x.hand && x.hand !== f.hand)) e.both = 1;
      }
      if (this.inning > this.innings) e.extra = 1;
      this.hrLog.push(e);
      return e;
    }

    endPA() {
      this.hrRun = this.thisPAHR ? this.hrRun + 1 : 0;
      this.thisPAHR = false;
      const bs = this.battingSide();
      this.paN[bs]++;
      this.bi[bs] = (this.bi[bs] + 1) % 9;
      this.newPA();
      if (this.checkWalkoff()) return;
      if (this.outs >= 3) this.endHalf(false);
    }

    checkWalkoff() {
      if (!this.top && this.inning >= this.innings && this.score.home > this.score.away) {
        this.addLog("サヨナラ！", "end");
        this.endGame(true);
        return true;
      }
      return false;
    }

    endHalf(midPA) {
      void midPA;
      this.hrRun = 0;
      // 代打は出た半イニングのあいだだけ (守備についたら代打ではない)
      this.phIds = {};
      this.outs = 0;
      this.bases = [null, null, null, null];
      this.newPA();
      if (this.top) {
        if (this.inning >= this.innings && this.score.home > this.score.away) {
          this.line.home.push("X");
          this.endGame(false);
          return;
        }
        this.top = false;
        this.line.home.push(0);
      } else {
        if (this.inning >= this.innings && this.score.home !== this.score.away) {
          this.endGame(false);
          return;
        }
        if (this.inning >= this.maxInnings) {
          this.endGame(false);
          return;
        }
        this.top = true;
        this.inning++;
        this.line.away.push(0);
      }
      this.fixPinchHitPitcher(this.fieldingSide());
      this.emit("half", { inning: this.inning, top: this.top });
    }

    endGame(walkoff) {
      this.over = true;
      const a = this.score.away;
      const h = this.score.home;
      const res = { walkoff: !!walkoff, tie: a === h };
      if (a !== h) {
        res.winner = h > a ? "home" : "away";
        res.loser = h > a ? "away" : "home";
        // 勝利投手
        let w = this.record.win[res.winner];
        const starter = this.used[res.winner][0];
        if (!w) w = this.pstate[res.winner].id;
        if (w === starter && this.stat(starter).outs < 15 && this.innings >= 9) {
          const rel = this.used[res.winner].slice(1).sort((x, y) => this.stat(y).outs - this.stat(x).outs)[0];
          if (rel) w = rel;
        }
        const l = this.record.lose[res.loser] || this.pstate[res.loser].id;
        this.stat(w).w = 1;
        this.stat(l).l = 1;
        res.W = w;
        res.L = l;
        const fin = this.pstate[res.winner];
        if (fin.id !== w && fin.enterLead >= 1 && fin.enterLead <= 3 && this.used[res.winner].length > 1) {
          this.stat(fin.id).sv = 1;
          res.S = fin.id;
        }
      }
      this.result = res;
      this.emit("gameover", res);
    }

    /* ---------- 采配 ---------- */
    changePitcher(side, id) {
      this.setPitcher(side, id, false);
    }

    // 投手に代打を出したチームが守備につくとき、救援投手をその打順に入れる
    fixPinchHitPitcher(side) {
      const slot = this.order[side].find((e) => e.pos === "PH");
      if (!slot) return;
      const pen = this.bullpenAvailable(side);
      const t = this.teams[side];
      const pick = pen.map((id) => this.P(id)).filter(Boolean).sort((a, b) => PB.D.pitOverall(b) - PB.D.pitOverall(a) - (b.role === "CL" ? 20 : 0) + (a.role === "CL" ? 20 : 0))[0];
      if (pick) this.changePitcher(side, pick.id);
      slot.id = this.pstate[side].id;
      slot.pos = "P";
      void t;
    }

    pinchHit(id) {
      const s = this.battingSide();
      const slot = this.order[s][this.bi[s]];
      const old = slot.pos === "P" ? this.pitcher(s) : this.P(slot.id);
      // 投手の代打: 次の守備で投手を交代する
      if (slot.pos === "P") slot.pos = "PH";
      slot.id = id;
      this.phIds[id] = 1;
      const st = this.stat(id);
      st.g = 1;
      this.addLog("代打 " + this.P(id).name + "（" + old.name + "）", "info");
      this.emit("pinchHit", { side: s, id });
    }

    benchAvailable(side) {
      const t = this.teams[side];
      const inUse = new Set(this.order[side].map((e) => e.id));
      return t.bench.filter((id) => !inUse.has(id) && !this.box[id]);
    }

    bullpenAvailable(side) {
      const t = this.teams[side];
      const all = t.bullpen.concat(t.rotation);
      return all.filter((id) => this.used[side].indexOf(id) < 0);
    }

    /* ---------- CPU 同士の高速シミュレーション ---------- */
    cpuManage() {
      for (const side of ["away", "home"]) {
        if (this.isUser(side) || side !== this.fieldingSide()) continue;
        const id = AI.pitchingChange(this, side);
        if (id) this.changePitcher(side, id);
      }
    }

    simPitch() {
      if (this.over) return;
      if (this.balls === 0 && this.strikes === 0 && this.paBunt === null) {
        this.cpuManage();
        this.paBunt = AI.wantBunt(this);
      }
      const fs = this.fieldingSide();
      const pit = this.pitcher();
      const bat = this.batter();
      const st = this.pstate[fs];
      const steal = this.paBunt ? null : AI.wantSteal(this);
      const pctx = this.ctx(this.isUser(fs) ? null : "cpuPitch");
      const ch = AI.choosePitch(pit, pctx);
      const pc = P.make(pit, ch.type, ch.aim, st, pctx);
      this.pitchThrown(pc);
      const bctx = this.ctx(this.isUser(this.battingSide()) ? null : "cpuBat");
      const sw = this.paBunt ? AI.buntAim(pc) : AI.decideSwing(pc, bat, pit, bctx);
      const jr = this.judge(pc, sw);
      jr.pc = pc;
      return this.resolve(jr, sw, steal);
    }

    // 判定結果を受けてプレーを最後まで進める (高速)
    resolve(jr, sw, steal) {
      if (jr.call === "inplay") {
        const play = this.makeBattedPlay(jr, sw, steal);
        Game.runPlay(play);
        this.applyPlay(play.result);
        return { jr, play };
      }
      if (jr.call === "foul") {
        const fp = this.makeFoulPlay(jr);
        if (fp) {
          Game.runPlay(fp);
          if (fp.result.type === "FFO") {
            const r = fp.result;
            r.batterOut = true;
            r.bases = this.bases;
            r.scorers = [];
            r.runs = 0;
            this.applyPlay(r);
            return { jr, play: fp };
          }
        }
        this.applyCall(jr);
        return { jr };
      }
      const out = this.applyCall(jr);
      if (steal && !out && this.outs < 3) {
        const anyLeft = Object.keys(steal).some((k) => this.bases[k]);
        if (anyLeft) {
          const sp = this.makeStealPlay(steal, jr.pc);
          Game.runPlay(sp);
          this.applySteal(sp.result);
          return { jr, play: sp };
        }
      }
      return { jr, out };
    }

    simToEnd() {
      let guard = 0;
      while (!this.over && guard++ < 2000) this.simPitch();
      if (!this.over) this.endGame(false);
    }

    static runPlay(play) {
      let n = 0;
      while (!play.done && n++ < 4000) play.step(1 / 60);
      if (!play.done) play.finish();
    }
  }

  PB.Game = Game;
})((window.PB = window.PB || {}));
