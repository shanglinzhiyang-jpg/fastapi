/* 熱闘！ポケットベースボール — テレビ中継風のテロップ
   カウント表示 (SBO)・打者紹介・球速・得点・ホームラン・今日の結果 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const esc = U.esc;

  const PROGRAM = "POCKET BASEBALL";

  /* ---------- 小物 ---------- */
  function teamOf(t) {
    const def = D.teamDef ? D.teamDef(t.id) : null;
    return def ? Object.assign({}, def, t) : t;
  }
  function abbr(t) {
    return t.abbr || String(t.short || t.name || "?").slice(0, 1);
  }
  function logoImg(t, cls) {
    const tt = teamOf(t);
    if (tt.logo) return '<img class="' + cls + '" src="' + tt.logo + '" alt="" draggable="false">';
    return '<span class="' + cls + ' tv-txtlogo" style="background:' + (tt.main || "#333") + ";color:" + (tt.sub || "#fff") + '">' + esc(tt.mark || abbr(tt)) + "</span>";
  }
  function hexRgb(h) {
    const s = String(h || "#444").replace("#", "");
    const v = s.length === 3 ? s.replace(/./g, (c) => c + c) : s;
    const n = parseInt(v, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(h, k) {
    const c = hexRgb(h).map((x) => Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k)));
    return "rgb(" + c.join(",") + ")";
  }
  // 選手名を「姓　名」で (外国人選手は「名・姓」)
  function fullName(p) {
    if (!p.given) return p.name;
    return p.foreign ? p.given + "・" + p.name : p.name + "　" + p.given;
  }
  function avg3(v) {
    if (v == null || isNaN(v)) return "----";
    return v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, "");
  }
  function innLong(inning, top) {
    return inning + "回" + (top ? "オモテ" : "ウラ");
  }
  // 金属調の数字 (金・銀)
  function mnum(n, metal) {
    return '<b class="mnum ' + metal + '" data-t="' + n + '">' + n + "</b>";
  }

  /* ---------- テレビ中継グラフィック ---------- */
  class TV {
    constructor(match) {
      this.m = match;
      this.g = match.g;
      this.l3q = [];
      this.timers = {};
      this.scoreSeen = 0;
      this.spShown = {};
    }

    html() {
      return (
        '<div class="tv-bug">' +
        '<div class="tvb-sbo">' +
        '<svg class="tvb-dia" viewBox="0 0 46 46" aria-hidden="true"><path d="M23 4 L42 23 L23 42 L4 23 Z"/></svg>' +
        '<i class="tvb-base b2"></i><i class="tvb-base b3"></i><i class="tvb-base b1"></i>' +
        '<div class="tvb-l s"><b>S</b><i></i><i></i></div>' +
        '<div class="tvb-l b"><b>B</b><i></i><i></i><i></i></div>' +
        '<div class="tvb-l o"><b>O</b><i></i><i></i></div>' +
        "</div>" +
        '<div class="tvb-sc"><div class="tvb-inn"></div>' +
        '<div class="tvb-t" data-side="away"><span class="tvb-ab"></span><b></b></div>' +
        '<div class="tvb-t" data-side="home"><span class="tvb-ab"></span><b></b></div>' +
        "</div></div>" +
        '<div class="tv-spd"></div>' +
        '<div class="tv-mu"><div class="mu-row mu-p"></div><div class="mu-stam"><i></i></div><div class="mu-row mu-b"></div></div>' +
        '<div class="tv-l3"></div>' +
        '<div class="tv-center"></div>' +
        '<div class="tv-hr"></div>' +
        '<div class="tv-tick"></div>'
      );
    }

    mount(hud) {
      this.hud = hud;
      const q = (s) => hud.querySelector(s);
      this.el = {
        bug: q(".tv-bug"),
        inn: q(".tvb-inn"),
        spd: q(".tv-spd"),
        mu: q(".tv-mu"),
        muP: q(".mu-p"),
        muB: q(".mu-b"),
        stam: q(".mu-stam i"),
        l3: q(".tv-l3"),
        center: q(".tv-center"),
        hr: q(".tv-hr"),
        tick: q(".tv-tick"),
      };
    }

    later(key, ms, fn) {
      clearTimeout(this.timers[key]);
      this.timers[key] = setTimeout(fn, ms);
    }

    destroy() {
      for (const k in this.timers) clearTimeout(this.timers[k]);
      this.timers = {};
      this.l3q = [];
    }

    // 表示 → 一定時間後に退場アニメ
    flash(el, html, ms, key, cls) {
      clearTimeout(this.timers[key + "x"]);
      el.innerHTML = html;
      el.className = el.className.split(" ")[0] + (cls ? " " + cls : "");
      void el.offsetWidth;
      el.classList.add("show");
      this.later(key, ms, () => {
        el.classList.remove("show");
        el.classList.add("out");
        this.later(key + "x", 450, () => {
          el.classList.remove("out");
          el.innerHTML = "";
        });
      });
    }
    hide(key) {
      const el = this.el[key];
      if (!el) return;
      clearTimeout(this.timers[key]);
      clearTimeout(this.timers[key + "x"]);
      el.classList.remove("show", "out");
      el.innerHTML = "";
      if (key === "l3") {
        this.l3q = [];
        this.l3busy = false;
      }
    }

    /* ---------- カウント表示 (左上) ---------- */
    update() {
      const g = this.g;
      const m = this.m;
      const el = this.el;
      if (!el) return;
      const bug = el.bug;
      const lamp = (cls, n) => bug.querySelectorAll(".tvb-l." + cls + " i").forEach((e, i) => e.classList.toggle("on", i < n));
      lamp("s", g.strikes);
      lamp("b", g.balls);
      lamp("o", g.outs);
      ["b1", "b2", "b3"].forEach((k, i) => bug.querySelector(".tvb-base." + k).classList.toggle("on", !!g.bases[i + 1]));
      if (m.derby) {
        el.inn.textContent = "HR競争";
        const rows = bug.querySelectorAll(".tvb-t");
        rows[0].querySelector(".tvb-ab").textContent = "本";
        rows[0].querySelector("b").textContent = m.derby.hr;
        rows[1].querySelector(".tvb-ab").textContent = "残";
        rows[1].querySelector("b").textContent = Math.max(0, m.derby.maxOuts - m.derby.outs);
      } else {
        el.inn.textContent = g.inning + (g.top ? "表" : "裏");
        for (const side of ["away", "home"]) {
          const t = teamOf(g.teams[side]);
          const row = bug.querySelector('.tvb-t[data-side="' + side + '"]');
          row.classList.toggle("atbat", g.battingSide() === side);
          row.style.setProperty("--tc", t.main || "#c00");
          row.querySelector(".tvb-ab").textContent = abbr(t);
          const b = row.querySelector("b");
          const v = String(g.score[side]);
          if (b.textContent !== v) {
            b.textContent = v;
            b.classList.remove("pop");
            void b.offsetWidth;
            b.classList.add("pop");
          }
        }
      }
      this.updateMatchup();
    }

    /* ---------- 対戦表示 (右上): 投手・打者 ---------- */
    updateMatchup() {
      const g = this.g;
      const m = this.m;
      const el = this.el;
      const bat = g.batter();
      const pit = g.pitcher();
      const st = g.pstate[g.fieldingSide()];
      const ratio = U.clamp(st.stamina / st.max, 0, 1);
      el.muP.innerHTML =
        '<span class="mu-k">投</span><b class="mu-n">' +
        esc(pit.name) +
        '</b><span class="mu-h">' +
        (pit.throws === "L" ? "左" : "右") +
        '</span><span class="mu-x">' +
        st.pitches +
        "<small>球</small></span>";
      el.stam.style.width = Math.round(ratio * 100) + "%";
      el.stam.style.background = ratio > 0.5 ? "linear-gradient(90deg,#1fbf6a,#7dffb0)" : ratio > 0.25 ? "linear-gradient(90deg,#e0a800,#ffe27a)" : "linear-gradient(90deg,#d42020,#ff8080)";
      const bs = g.box[bat.id] || {};
      const season = m.opt.season ? m.opt.season[bat.id] : null;
      let sub;
      if (m.derby) sub = "HR " + m.derby.hr;
      else if (season && season.ab) sub = U.fmtAvg(season.h || 0, season.ab || 0);
      else sub = (bs.ab || 0) + "-" + (bs.h || 0);
      const order = m.derby ? "HR" : g.bi[g.battingSide()] + 1;
      el.muB.innerHTML =
        '<span class="mu-k">' +
        order +
        '</span><b class="mu-n">' +
        esc(bat.name) +
        '</b><span class="mu-h">' +
        (PB.P.batSide(bat, pit) === "L" ? "左" : "右") +
        '</span><span class="mu-x">' +
        esc(sub) +
        "</span>" +
        '<span class="mu-ab">' +
        PB.UI.compactAb(bat) +
        "<em>弾" +
        bat.traj +
        "</em></span>";
    }

    /* ---------- 球速 ---------- */
    pitch(pc) {
      if (!pc || !this.el) return;
      const html = "<b>" + Math.round(pc.speedKmh) + "</b><small>km/h</small><span>" + esc(pc.name || "") + "</span>";
      this.flash(this.el.spd, html, 2300, "spd");
    }

    /* ---------- 下部テロップ (打者紹介・投手紹介) ---------- */
    l3(html, ms, cls) {
      this.l3q.push({ html, ms, cls });
      if (!this.l3busy) this.l3next();
    }
    l3next() {
      const it = this.l3q.shift();
      if (!it) {
        this.l3busy = false;
        return;
      }
      this.l3busy = true;
      const el = this.el.l3;
      el.innerHTML = it.html;
      el.className = "tv-l3" + (it.cls ? " " + it.cls : "");
      void el.offsetWidth;
      el.classList.add("show");
      this.later("l3", it.ms, () => {
        el.classList.remove("show");
        el.classList.add("out");
        this.later("l3x", 380, () => {
          el.classList.remove("out");
          this.l3next();
        });
      });
    }

    l3html(team, num, name, pre, tab, chips, tabCls) {
      return (
        (pre ? '<div class="l3-pre">' + pre + "</div>" : "") +
        '<div class="l3-top">' +
        '<div class="l3-logo">' +
        logoImg(team, "l3-img") +
        "</div>" +
        '<div class="l3-main">' +
        (num != null && num !== "" ? '<b class="l3-num">' + esc(num) + "</b>" : "") +
        '<span class="l3-nm">' +
        esc(name) +
        "</span></div>" +
        '<div class="l3-tab' +
        (tabCls ? " " + tabCls : "") +
        '">' +
        esc(tab) +
        "</div></div>" +
        '<div class="l3-sub">' +
        chips.map((c) => '<span class="l3-chip">' + esc(c) + "</span>").join("") +
        "</div>"
      );
    }

    batter() {
      const g = this.g;
      const m = this.m;
      if (m.derby) return;
      const side = g.battingSide();
      const bat = g.batter();
      const t = g.teams[side];
      const ord = g.bi[side] + 1;
      const pos = g.batterPos();
      const slot = (g.order[side] || [])[g.bi[side]];
      const ph = slot && slot.pos === "PH";
      const today = g.paLog[bat.id] || [];
      const season = m.opt.season ? m.opt.season[bat.id] : null;
      const real = bat.real && bat.real.stats;
      let tab = "きょうの成績";
      let chips = today.slice();
      if (!today.length) {
        if (season && season.ab) {
          tab = "今季成績";
          chips = ["打率 " + U.fmtAvg(season.h || 0, season.ab || 0), (season.hr || 0) + "本塁打", (season.rbi || 0) + "打点"];
        } else if (real && real.avg != null) {
          tab = (bat.real.season || 2004) + "年成績";
          chips = ["打率 " + avg3(real.avg)];
          if (real.hr != null) chips.push(real.hr + "本塁打");
          if (real.rbi != null) chips.push(real.rbi + "打点");
        } else {
          chips = ["第1打席"];
        }
      }
      const pre = '<span class="l3-ord">' + ord + "番</span>" + esc(ph ? "代打" : D.POS_FULL[pos] || "") + '<span class="l3-hand">' + (bat.bats === "L" ? "左打" : bat.bats === "S" ? "両打" : "右打") + "</span>";
      this.l3(this.l3html(t, bat.num, fullName(bat), pre, ph ? "代打" : tab, chips, ph ? "red" : ""), 3400);
    }

    pitcherIntro(p, side, kind) {
      const g = this.g;
      const m = this.m;
      const t = g.teams[side];
      const season = m.opt.season ? m.opt.season[p.id] : null;
      const real = p.real && p.real.stats;
      let tab;
      let chips;
      if (season && (season.pg || season.outs)) {
        tab = "今季成績";
        const era = season.outs ? (season.er * 27) / season.outs : 0;
        chips = [(season.w || 0) + "勝" + (season.l || 0) + "敗" + (season.sv ? season.sv + "S" : ""), "防御率 " + era.toFixed(2)];
      } else if (real && (real.w != null || real.era != null)) {
        tab = (p.real.season || 2004) + "年成績";
        chips = [];
        if (real.w != null) chips.push(real.w + "勝" + (real.l || 0) + "敗" + (real.sv ? real.sv + "S" : ""));
        if (real.era != null) chips.push("防御率 " + Number(real.era).toFixed(2));
      } else {
        tab = "球速";
        chips = ["最速 " + p.velo + "km/h"];
      }
      const pre = '<span class="l3-ord">' + (kind === "change" ? "ピッチャー交代" : "先発") + "</span>" + (p.throws === "L" ? "左投" : "右投");
      this.l3(this.l3html(t, p.num, fullName(p), pre, tab, chips, kind === "change" ? "red" : ""), kind === "change" ? 2600 : 2400);
    }

    /* ---------- ホームラン ---------- */
    homeRun(res, bat) {
      const g = this.g;
      const m = this.m;
      const season = m.opt.season;
      const n = res.runs || 1;
      const label = n >= 4 ? "満塁" : n === 1 ? "ソロ" : n + "ラン";
      const walkoff = !g.top && g.inning >= g.innings && g.score.home + n > g.score.away && g.score.home <= g.score.away;
      let no = "";
      if (season && !m.derby) no = ((season[bat.id] || {}).hr || 0) + ((g.box[bat.id] || {}).hr || 0) + 1;
      const title = n >= 4 ? "GRAND SLAM" : "HOME RUN";
      const html =
        '<div class="hr-wrap">' +
        '<div class="hr-rail t"></div><div class="hr-rail b"></div>' +
        '<div class="hr-bar"><span class="hr-nm">' +
        esc(bat.name) +
        "</span>" +
        (no ? '<span class="hr-no">' + no + "<small>号</small></span>" : '<span class="hr-no lbl">' + esc(label) + "</span>") +
        '<span class="hr-kind">' +
        esc(walkoff ? "サヨナラ" : no ? label : res.type === "IPHR" ? "ランニング" : "") +
        "</span></div>" +
        '<div class="hr-title"><span data-t="' +
        title +
        '">' +
        title +
        "</span></div>" +
        '<div class="hr-shine"></div>' +
        "</div>";
      this.hide("l3");
      this.flash(this.el.hr, html, 2700, "hr", res.type === "IPHR" ? "iphr" : "");
    }

    /* ---------- 得点 (中央の大きなスコア) ---------- */
    // kind: "score" | "final" | "open"
    scoreBoard(kind) {
      const g = this.g;
      const m = this.m;
      const last = g.scoreLog[g.scoreLog.length - 1];
      let gold = null;
      let mid;
      if (kind === "final") {
        mid = "試合終了";
        if (g.score.home !== g.score.away) gold = g.score.home > g.score.away ? "home" : "away";
      } else if (kind === "open") {
        mid = "プレイボール";
      } else {
        gold = last ? last.side : g.battingSide();
        mid = last ? innLong(last.inning, last.top) : innLong(g.inning, g.top);
      }
      const panel = (side) => {
        const t = teamOf(g.teams[side]);
        const c = t.main || "#335";
        const bg = "linear-gradient(160deg," + shade(c, 0.35) + " 0%," + shade(c, 0.08) + " 42%," + shade(c, -0.35) + " 100%)";
        const nm = String(t.short || t.name);
        let body;
        if (kind === "open") {
          const sp = g.P(g.pstate[side].id);
          body = '<div class="sp-k">先発</div><div class="sp-n">' + esc(sp.name) + "</div>";
        } else {
          const cur = g.score[side];
          const prev = kind === "score" && last && last.side === side ? cur - last.n : cur;
          body = '<div class="sc-num" data-side="' + side + '" data-to="' + cur + '">' + mnum(prev, side === gold ? "gold" : "silver") + "</div>";
        }
        return (
          '<div class="sc-panel ' +
          side +
          (side === gold ? " win" : "") +
          '" style="--pc:' +
          c +
          ";background:" +
          bg +
          '">' +
          '<div class="sc-logo">' +
          logoImg(t, "sc-img") +
          "</div>" +
          '<div class="sc-name' +
          (nm.length >= 4 ? " long" : "") +
          '">' +
          esc(nm) +
          "</div>" +
          body +
          '<div class="sc-gloss"></div></div>'
        );
      };
      const extra =
        kind === "score" && last
          ? '<div class="sc-ctx">' + esc(last.text) + "</div>"
          : kind === "open"
            ? '<div class="sc-ctx">' + esc(teamOf(g.teams.home).stadium || "") + "</div>"
            : kind === "final" && g.result
              ? '<div class="sc-ctx">' + this.finalPitchers() + "</div>"
              : "";
      // 中継の慣習どおり ホーム球団を左に
      const html = '<div class="sc-row">' + panel("home") + '<div class="sc-mid"><div class="sc-inn">' + esc(mid) + '</div><div class="sc-prog">' + PROGRAM + "</div></div>" + panel("away") + "</div>" + extra;
      const ms = kind === "final" ? 2900 : kind === "open" ? 2600 : 2300;
      this.flash(this.el.center, html, ms, "center", "k-" + kind);
      // 点が入った側の数字を差し替える
      if (kind === "score") {
        this.later("scnum", 650, () => {
          this.el.center.querySelectorAll(".sc-num").forEach((e) => {
            const to = e.getAttribute("data-to");
            const b = e.querySelector(".mnum");
            if (b && b.textContent !== to) {
              b.textContent = to;
              b.setAttribute("data-t", to);
              b.classList.add("pop");
            }
          });
        });
      }
    }

    finalPitchers() {
      const g = this.g;
      const r = g.result;
      const nm = (id) => (id ? esc(g.P(id).name) : "");
      let s = "";
      if (r.W) s += '<span class="fp w">勝</span>' + nm(r.W);
      if (r.L) s += '<span class="fp l">敗</span>' + nm(r.L);
      if (r.S) s += '<span class="fp s">S</span>' + nm(r.S);
      return s || "引き分け";
    }

    /* ---------- 今日の結果 (下部の流れるテロップ) ---------- */
    tickerLine(e) {
      const g = this.g;
      const ab = (side) => esc(abbr(teamOf(g.teams[side])));
      return (
        '<span class="tk-who">(' +
        ab(e.side) +
        ")" +
        e.inning +
        (e.top ? "表" : "裏") +
        "</span>" +
        esc(e.text) +
        '<span class="tk-sc">(' +
        ab("home") +
        e.score.home +
        "－" +
        e.score.away +
        ab("away") +
        ")</span>"
      );
    }
    ticker(entries, label) {
      if (!entries.length) return;
      const el = this.el.tick;
      let i = 0;
      const per = 2300;
      const render = () => {
        el.innerHTML = '<div class="tk-tab">' + esc(label || "今日の結果") + '</div><div class="tk-body"><div class="tk-line">' + this.tickerLine(entries[i]) + "</div></div>";
        const line = el.querySelector(".tk-line");
        const body = el.querySelector(".tk-body");
        // 長い行は横に流す
        requestAnimationFrame(() => {
          const over = line.scrollWidth - body.clientWidth;
          if (over > 4) {
            line.style.setProperty("--dx", -over - 8 + "px");
            line.classList.add("scroll");
          }
        });
      };
      render();
      el.className = "tv-tick";
      void el.offsetWidth;
      el.classList.add("show");
      const step = () => {
        i++;
        if (i >= entries.length) {
          el.classList.remove("show");
          el.classList.add("out");
          this.later("tickx", 450, () => {
            el.classList.remove("out");
            el.innerHTML = "";
          });
          return;
        }
        render();
        this.later("tick", per, step);
      };
      this.later("tick", per, step);
    }

    /* ---------- 攻守交代: 中継風のスコアボード ---------- */
    inningBoard() {
      const g = this.g;
      // 終わったイニング
      const endInn = g.top ? g.inning - 1 : g.inning;
      const endTop = !g.top;
      const n = Math.max(g.line.away.length, g.line.home.length, g.innings);
      const row = (side) => {
        const t = teamOf(g.teams[side]);
        let s = '<tr><th><span class="bd-logo">' + logoImg(t, "bd-img") + "</span>" + esc(t.short || "") + "</th>";
        for (let i = 0; i < n; i++) {
          const v = g.line[side][i];
          s += "<td" + (i === endInn - 1 && ((side === "away" && endTop) || (side === "home" && !endTop)) ? ' class="cur"' : "") + ">" + (v == null ? "" : v) + "</td>";
        }
        return s + '<td class="r">' + g.score[side] + '</td><td class="h">' + g.hits[side] + '</td><td class="h">' + g.errors[side] + "</td></tr>";
      };
      const head = "<tr><th></th>" + Array.from({ length: n }, (_, i) => "<td>" + (i + 1) + "</td>").join("") + '<td class="r">R</td><td class="h">H</td><td class="h">E</td></tr>';
      const html =
        '<div class="bd"><div class="bd-head"><span class="bd-tab">' +
        endInn +
        "回" +
        (endTop ? "表" : "裏") +
        '終了</span><span class="bd-prog">' +
        PROGRAM +
        '</span></div><div class="bd-tbl"><table>' +
        head +
        row("away") +
        row("home") +
        "</table></div></div>";
      this.flash(this.el.center, html, 2500, "center", "k-board");
      const list = g.scoreLog.slice(-3);
      if (list.length) this.ticker(list, "今日の結果");
    }
  }

  PB.TV = TV;
  PB.TV.fullName = fullName;
})(window.PB);
