/* 熱闘！ポケットベースボール — メニュー画面 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = PB.UI;
  const Store = PB.Store;
  const A = PB.Audio;
  const esc = U.esc;
  const Sc = {};

  /* ---------- タイトル ---------- */
  Sc.title = function () {
    return {
      cls: "title",
      html() {
        const sv = Store.server ? '<span class="srv">サーバー保存 ON</span>' : "";
        const pen = Store.data.pennant && !Store.data.pennant.finished;
        return (
          '<div class="title-wrap">' +
          '<div class="logo"><span class="logo-sub">熱闘！</span><h1>ポケット<br>ベースボール</h1><span class="logo-en">POCKET BASEBALL</span></div>' +
          '<nav class="menu">' +
          '<button class="mbtn red" data-act="exhibition"><b>クイック対戦</b><small>好きなチームで1試合</small></button>' +
          '<button class="mbtn" data-act="pennant"><b>ペナント</b><small>' +
          (pen ? "シーズンの続きから" : "セ・パ12球団で2004年シーズン") +
          "</small></button>" +
          '<button class="mbtn" data-act="success"><b>サクセス</b><small>自分だけの選手を育てる</small></button>' +
          '<button class="mbtn" data-act="derby"><b>ホームラン競争</b><small>10アウトまで打ちまくれ</small></button>' +
          '<div class="mrow"><button class="mbtn sm" data-act="roster">選手名鑑</button><button class="mbtn sm" data-act="howto">あそびかた</button><button class="mbtn sm" data-act="settings">設定</button></div>' +
          "</nav>" +
          '<p class="foot">' +
          sv +
          "通算 " +
          Store.data.records.wins +
          "勝 " +
          Store.data.records.losses +
          "敗 " +
          Store.data.records.ties +
          "分</p></div>"
        );
      },
      onAct(act) {
        A.unlock();
        if (act === "exhibition") UI.go(Sc.exhibition());
        else if (act === "pennant") UI.go(PB.Pennant.hub());
        else if (act === "success") UI.go(PB.Success.menu());
        else if (act === "derby") UI.go(Sc.derbySetup());
        else if (act === "roster") UI.go(Sc.roster());
        else if (act === "howto") UI.go(Sc.howto());
        else if (act === "settings") UI.go(Sc.settings());
      },
    };
  };

  /* ---------- チーム選択カード ---------- */
  function teamPicker(name, selected, exclude) {
    return (
      '<div class="tpick">' +
      Store.teams()
        .map((t) => {
          const dis = exclude && exclude === t.id;
          return (
            '<button class="tcard' +
            (t.id === selected ? " on" : "") +
            '" data-act="' +
            name +
            '" data-arg="' +
            t.id +
            '"' +
            (dis ? " disabled" : "") +
            ' style="--tm:' +
            t.main +
            ";--ts:" +
            t.sub +
            ";--tc:" +
            t.cap +
            '">' +
            UI.mark(t, 30) +
            "<b>" +
            esc(t.short) +
            "</b><small>" +
            esc(t.en) +
            "</small>" +
            teamPower(t) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function teamPower(t) {
    const bats = t.lineup.map((e) => t.players.find((p) => p.id === e.id));
    const pits = t.rotation.map((id) => t.players.find((p) => p.id === id));
    const avg = (arr, f) => arr.reduce((a, p) => a + f(p), 0) / arr.length;
    const bat = D.rank(avg(bats, (p) => (p.meet + p.power) / 2) + 6);
    const spd = D.rank(avg(bats, (p) => p.speed));
    const pit = D.rank(avg(pits, (p) => (p.control + (p.velo - 120) * 1.6 + p.pitches.reduce((a, b) => a + b.lv * 4, 0)) / 2.2));
    return '<span class="tpow"><i>打</i><b style="color:' + bat.color + '">' + bat.r + "</b><i>走</i><b style=\"color:" + spd.color + '">' + spd.r + "</b><i>投</i><b style=\"color:" + pit.color + '">' + pit.r + "</b></span>";
  }
  Sc.teamPicker = teamPicker;

  function seg(name, opts, val) {
    return (
      '<div class="seg">' +
      opts
        .map((o) => '<button class="' + (String(o[0]) === String(val) ? "on" : "") + '" data-act="' + name + '" data-arg="' + o[0] + '">' + esc(o[1]) + "</button>")
        .join("") +
      "</div>"
    );
  }
  Sc.seg = seg;

  /* ---------- クイック対戦 ---------- */
  Sc.exhibition = function () {
    const S = Store.settings();
    const st = Sc._exh || (Sc._exh = { my: "t", opp: "g", side: "home", innings: S.innings || 9, level: S.level, night: S.night });
    return {
      html() {
        return (
          UI.header("クイック対戦", "back") +
          '<div class="scr-body">' +
          '<h3 class="lbl">あなたのチーム</h3>' +
          teamPicker("my", st.my, null) +
          '<h3 class="lbl">対戦相手</h3>' +
          teamPicker("opp", st.opp, st.my) +
          '<h3 class="lbl">操作</h3>' +
          seg(
            "side",
            [
              ["away", "先攻"],
              ["home", "後攻"],
              ["watch", "観戦"],
            ],
            st.side
          ) +
          '<h3 class="lbl">イニング</h3>' +
          seg(
            "innings",
            [
              [3, "3回"],
              [6, "6回"],
              [9, "9回"],
            ],
            st.innings
          ) +
          '<h3 class="lbl">難易度</h3>' +
          seg(
            "level",
            Object.keys(PB.AI.LEVELS).map((k) => [k, PB.AI.LEVELS[k].name]),
            st.level
          ) +
          '<h3 class="lbl">時間帯</h3>' +
          seg(
            "night",
            [
              ["1", "ナイター"],
              ["0", "デーゲーム"],
            ],
            st.night ? "1" : "0"
          ) +
          '<div class="row-btns stick"><button class="btn" data-act="order">オーダー</button><button class="btn red big" data-act="play">プレイボール！</button></div>' +
          "</div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Sc.title());
        if (act === "my") {
          st.my = arg;
          if (st.opp === arg) st.opp = Store.teams().find((t) => t.id !== arg).id;
        } else if (act === "opp") st.opp = arg;
        else if (act === "side") st.side = arg;
        else if (act === "innings") st.innings = Number(arg);
        else if (act === "level") st.level = arg;
        else if (act === "night") st.night = arg === "1";
        else if (act === "order") return UI.go(Sc.order(Store.team(st.my), { onBack: () => UI.go(Sc.exhibition()) }));
        else if (act === "play") {
          const S2 = Store.settings();
          S2.innings = st.innings;
          S2.level = st.level;
          S2.night = st.night;
          Store.save();
          return Sc.startGame({
            my: Store.team(st.my),
            opp: Store.team(st.opp),
            side: st.side,
            innings: st.innings,
            level: st.level,
            night: st.night,
            onFinish: (match) => UI.go(Sc.result(match, { onDone: () => UI.go(Sc.title()), again: () => UI.go(Sc.exhibition()) })),
          });
        }
        UI.refresh();
      },
    };
  };

  // 試合開始の共通処理
  Sc.startGame = function (o) {
    const my = U.clone(o.my);
    const opp = U.clone(o.opp);
    let away;
    let home;
    let user;
    if (o.side === "away") {
      away = my;
      home = opp;
      user = "away";
    } else if (o.side === "home") {
      away = opp;
      home = my;
      user = "home";
    } else {
      away = opp;
      home = my;
      user = null;
    }
    const game = new PB.Game({ away, home, innings: o.innings, user, level: o.level, starters: o.starters, tired: o.tired });
    UI.hideScreen();
    PB.main.startMatch({
      game,
      night: o.night,
      season: o.season,
      onEnd: (m) => {
        if (o.side !== "watch" && !o.noRecord) {
          const r = Store.data.records;
          r.games++;
          if (game.result.tie) r.ties++;
          else if (game.result.winner === user) r.wins++;
          else r.losses++;
          Store.save();
        }
        PB.main.stopMatch();
        o.onFinish(m);
      },
      onQuit: () => {
        PB.main.stopMatch();
        if (o.onQuit) o.onQuit();
        else UI.go(Sc.title());
      },
    });
  };

  /* ---------- オーダー ---------- */
  // 守備位置の図での場所 (%: 左, 上)
  const FIELD_XY = { P: [50, 67], C: [50, 89], "1B": [80, 69], "2B": [70, 46], SS: [30, 46], "3B": [20, 69], LF: [15, 23], CF: [50, 16], RF: [85, 23], DH: [86, 89] };
  // 守備位置の図の背景 (外野の芝・内野の土・ベース)
  const FIELD_SVG =
    '<svg class="of-bg" viewBox="0 0 100 125" preserveAspectRatio="none" aria-hidden="true">' +
    '<path d="M50 110 L1 61 Q50 -12 99 61 Z" fill="#2f7a3a" stroke="#e8f0e0" stroke-width=".6"/>' +
    '<path d="M50 110 L1 61 Q50 -12 99 61 Z" fill="url(#ofs)" opacity=".5"/>' +
    '<defs><pattern id="ofs" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="5" fill="#3b8a45"/></pattern></defs>' +
    '<path d="M50 108 L22 80 Q50 42 78 80 Z" fill="#b8865a"/>' +
    '<path d="M50 100 L68 82 L50 64 L32 82 Z" fill="#3a8a46" stroke="#f4f4f4" stroke-width=".5"/>' +
    '<circle cx="50" cy="83" r="3.4" fill="#b8865a"/>' +
    '<g fill="#fff"><rect x="66.6" y="80.6" width="2.8" height="2.8" transform="rotate(45 68 82)"/><rect x="48.6" y="62.6" width="2.8" height="2.8" transform="rotate(45 50 64)"/><rect x="30.6" y="80.6" width="2.8" height="2.8" transform="rotate(45 32 82)"/><path d="M48.6 100 h2.8 v1.4 l-1.4 1.4 l-1.4 -1.4 Z"/></g>' +
    "</svg>";
  const ORDER_VIEWS = [
    ["list", "打順"],
    ["field", "守備位置"],
    ["cards", "スタメン"],
  ];
  Sc.order = function (team, opts) {
    let sel = null;
    let pickStarter = false;
    const st = { view: (opts && opts.view) || "list" };
    // スタメンと守備位置 (DH 制でない打順の「投」は次の先発)
    const starters = () => {
      const next = team.rotation[(team.rotIdx || 0) % team.rotation.length];
      const out = team.lineup.map((e, i) => ({ id: e.pos === "P" ? next : e.id, pos: e.pos, ord: i + 1 }));
      if (!out.some((e) => e.pos === "P")) out.push({ id: next, pos: "P", ord: 0 });
      return out;
    };
    const cardsView = () => {
      if (st.view === "field") {
        return (
          '<div class="ofield">' +
          FIELD_SVG +
          starters()
            .map((e) => {
              const xy = FIELD_XY[e.pos] || [50, 50];
              return '<button class="fslot" data-act="info" data-arg="' + esc(e.id) + '" data-card="' + esc(e.id) + '" data-pos="' + e.pos + '" style="left:' + xy[0] + "%;top:" + xy[1] + '%"><span class="fs-pos">' + (e.ord ? e.ord + " " : "") + D.POS_JP[e.pos] + "</span></button>";
            })
            .join("") +
          "</div>"
        );
      }
      return (
        '<div class="ocards">' +
        starters()
          .filter((e) => e.ord)
          .map((e) => '<button class="ocard" data-act="info" data-arg="' + esc(e.id) + '" data-card="' + esc(e.id) + '" data-pos="' + e.pos + '"><span class="oc-n">' + e.ord + '</span><span class="oc-p">' + D.POS_JP[e.pos] + "</span></button>")
          .join("") +
        "</div>"
      );
    };
    return {
      html() {
        if (st.view !== "list" && PB.Cards) {
          return (
            UI.header(team.name + " オーダー", "back") +
            '<div class="scr-body">' +
            seg("view", ORDER_VIEWS, st.view) +
            cardsView() +
            '<p class="note">カードをタップすると詳しい能力を表示します。打順の入れ替えは「打順」から。</p>' +
            '<div class="row-btns stick"><button class="btn primary" data-act="done">決定</button></div></div>'
          );
        }
        const P = (id) => D.player(team, id);
        const rows = team.lineup
          .map((e, i) => {
            const p = P(e.id);
            return (
              '<button class="orow' +
              (sel === "L" + i ? " on" : "") +
              '" data-act="lu" data-arg="' +
              i +
              '"><span class="on-n">' +
              (i + 1) +
              '</span><span class="on-p">' +
              D.POS_JP[e.pos] +
              "</span><b>" +
              esc(p.name) +
              (p.custom ? '<em class="badge">育</em>' : "") +
              "</b>" +
              abMini(p) +
              "</button>"
            );
          })
          .join("");
        const bench = team.bench
          .map((id) => {
            const p = P(id);
            return '<button class="orow bench' + (sel === "B" + id ? " on" : "") + '" data-act="bn" data-arg="' + id + '"><span class="on-n">控</span><span class="on-p">' + D.POS_JP[p.pos] + "</span><b>" + esc(p.name) + (p.custom ? '<em class="badge">育</em>' : "") + "</b>" + abMini(p) + "</button>";
          })
          .join("");
        const rot = team.rotation
          .map((id, i) => {
            const p = P(id);
            const isNext = i === (team.rotIdx || 0) % team.rotation.length;
            return '<button class="orow' + (isNext ? " on" : "") + '" data-act="sp" data-arg="' + i + '"><span class="on-n">' + (isNext ? "先発" : i + 1) + '</span><span class="on-p">投</span><b>' + esc(p.name) + "</b>" + abMini(p) + "</button>";
          })
          .join("");
        return (
          UI.header(team.name + " オーダー", "back") +
          '<div class="scr-body">' +
          (PB.Cards
            ? seg("view", ORDER_VIEWS, st.view)
            : "") +
          '<p class="note">2人をタップすると打順を入れ替え。スタメンと控えを順にタップすると交代。名前を長押し（または右の i）で能力を確認。</p>' +
          '<div class="olist">' +
          rows +
          '</div><h3 class="lbl">控え</h3><div class="olist">' +
          (bench || '<p class="muted">控えなし</p>') +
          '</div><h3 class="lbl">先発ローテーション（タップで次の先発を指名）</h3><div class="olist">' +
          rot +
          '</div><div class="row-btns stick"><button class="btn" data-act="auto">おまかせ</button><button class="btn primary" data-act="done">決定</button></div></div>'
        );
      },
      onAct(act, arg) {
        if (act === "back" || act === "done") {
          Store.save();
          return opts.onBack();
        }
        if (act === "view") {
          st.view = arg;
          sel = null;
        } else if (act === "auto") {
          const keep = team.rotIdx;
          D.autoOrder(team);
          team.rotIdx = keep;
          sel = null;
        } else if (act === "info") {
          UI.showPlayer(arg);
          return;
        } else if (act === "lu") {
          const i = Number(arg);
          if (sel == null) sel = "L" + i;
          else if (sel[0] === "L") {
            const j = Number(sel.slice(1));
            const tmp = team.lineup[i];
            team.lineup[i] = team.lineup[j];
            team.lineup[j] = tmp;
            sel = null;
          } else if (sel[0] === "B") {
            const bid = sel.slice(1);
            const out = team.lineup[i].id;
            team.lineup[i] = { id: bid, pos: team.lineup[i].pos };
            team.bench = team.bench.map((x) => (x === bid ? out : x));
            sel = null;
          }
        } else if (act === "bn") {
          if (sel && sel[0] === "L") {
            const i = Number(sel.slice(1));
            const out = team.lineup[i].id;
            team.lineup[i] = { id: arg, pos: team.lineup[i].pos };
            team.bench = team.bench.map((x) => (x === arg ? out : x));
            sel = null;
          } else sel = sel === "B" + arg ? null : "B" + arg;
        } else if (act === "sp") {
          team.rotIdx = Number(arg);
        }
        void pickStarter;
        UI.refresh();
      },
      mount(root) {
        // 選手カード (守備位置の図・スタメン)
        root.querySelectorAll("[data-card]").forEach((el) => {
          const p = D.player(team, el.getAttribute("data-card"));
          if (!p) return;
          const field = el.classList.contains("fslot");
          const w = field ? Math.min(68, Math.round(el.parentNode.clientWidth * 0.18)) : Math.min(120, Math.floor((el.parentNode.clientWidth - 16) / 3));
          const pos = el.getAttribute("data-pos");
          // 守備位置の図では捕手は構えた姿 (防具つき)
          el.insertBefore(PB.Cards.el(p, team, { w, mini: true, pos, kind: field && pos === "C" ? "cat" : undefined }), el.firstChild);
        });
        // 長押しで能力表示
        let timer = null;
        root.querySelectorAll(".orow").forEach((el) => {
          el.addEventListener("pointerdown", () => {
            timer = setTimeout(() => {
              const a = el.getAttribute("data-act");
              const arg = el.getAttribute("data-arg");
              let id = arg;
              if (a === "lu") id = team.lineup[Number(arg)].id;
              if (a === "sp") id = team.rotation[Number(arg)];
              sel = null;
              UI.showPlayer(id);
              timer = "fired";
            }, 550);
          });
          el.addEventListener("pointerup", () => {
            if (timer && timer !== "fired") clearTimeout(timer);
          });
          el.addEventListener("pointerleave", () => {
            if (timer && timer !== "fired") clearTimeout(timer);
          });
          el.addEventListener(
            "click",
            (e) => {
              if (timer === "fired") {
                e.stopPropagation();
                timer = null;
              }
            },
            true
          );
        });
      },
    };
  };
  function abMini(p) {
    if (p.pos === "P") {
      return '<span class="abm"><i>' + p.velo + "km</i>" + rk(p.control, "制") + rk(p.stamina, "ス") + "</span>";
    }
    return '<span class="abm"><i>弾' + p.traj + "</i>" + rk(p.meet, "ミ") + rk(p.power, "パ") + rk(p.speed, "走") + rk(p.field, "守") + "</span>";
  }
  function rk(v, l) {
    const r = D.rank(v);
    return "<span>" + l + '<b style="color:' + r.color + '">' + r.r + "</b></span>";
  }
  Sc.abMini = abMini;

  /* ---------- 結果・スコア ---------- */
  Sc.lineScoreHTML = function (g) {
    const n = Math.max(g.line.away.length, g.line.home.length, g.innings);
    const row = (side) => {
      let s = "<tr><th>" + UI.mark(g.teams[side], 18) + '<span class="tn">' + esc(g.teams[side].short) + "</span></th>";
      for (let i = 0; i < n; i++) {
        const v = g.line[side][i];
        s += "<td>" + (v == null ? "" : v) + "</td>";
      }
      return s + '<td class="r">' + g.score[side] + "</td><td>" + g.hits[side] + "</td><td>" + g.errors[side] + "</td></tr>";
    };
    return '<div class="ls-wrap"><table class="ls big"><tr><th></th>' + Array.from({ length: n }, (_, i) => "<td>" + (i + 1) + "</td>").join("") + '<td class="r">R</td><td>H</td><td>E</td></tr>' + row("away") + row("home") + "</table></div>";
  };

  Sc.boxScoreHTML = function (g) {
    let html = Sc.lineScoreHTML(g);
    for (const side of ["away", "home"]) {
      const t = g.teams[side];
      html += '<h3 class="lbl">' + UI.mark(t, 18) + " " + esc(t.name) + "</h3>";
      html += '<div class="tbl-wrap"><table class="box"><tr><th>打者</th><th>打</th><th>安</th><th>点</th><th>本</th><th>振</th><th>四</th></tr>';
      const seen = new Set();
      for (const e of g.order[side]) {
        const ids = [e.id];
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          const p = g.P(id);
          const s = g.box[id] || {};
          html += "<tr><th>" + D.POS_JP[e.pos] + " " + esc(p.name) + "</th><td>" + (s.ab || 0) + "</td><td>" + (s.h || 0) + "</td><td>" + (s.rbi || 0) + "</td><td>" + (s.hr || 0) + "</td><td>" + (s.k || 0) + "</td><td>" + (s.bb || 0) + "</td></tr>";
        }
      }
      html += "</table></div>";
      html += '<div class="tbl-wrap"><table class="box"><tr><th>投手</th><th>回</th><th>球</th><th>安</th><th>振</th><th>四</th><th>失</th></tr>';
      for (const id of g.used[side]) {
        const p = g.P(id);
        const s = g.box[id] || {};
        const mark = g.result && g.result.W === id ? "○" : g.result && g.result.L === id ? "●" : g.result && g.result.S === id ? "S" : "";
        html += "<tr><th>" + mark + esc(p.name) + "</th><td>" + U.fmtIP(s.outs || 0) + "</td><td>" + (s.np || 0) + "</td><td>" + (s.ph || 0) + "</td><td>" + (s.pk || 0) + "</td><td>" + (s.pbb || 0) + "</td><td>" + (s.pr || 0) + "</td></tr>";
      }
      html += "</table></div>";
    }
    return html;
  };

  Sc.mvp = function (g, side) {
    let best = null;
    let bv = -1;
    for (const e of g.order[side]) {
      const s = g.box[e.id] || {};
      const v = (s.h || 0) * 2 + (s.d || 0) + (s.t || 0) * 2 + (s.hr || 0) * 4 + (s.rbi || 0) * 2 + (s.r || 0) + (s.sb || 0);
      if (v > bv) {
        bv = v;
        best = e.id;
      }
    }
    for (const id of g.used[side]) {
      const s = g.box[id] || {};
      const v = (s.outs || 0) / 2 + (s.pk || 0) - (s.pr || 0) * 2 + (s.w ? 4 : 0) + (s.sv ? 3 : 0);
      if (v > bv) {
        bv = v;
        best = id;
      }
    }
    return best;
  };

  Sc.result = function (match, opts) {
    const g = match.g;
    const res = g.result || {};
    const user = g.user === "both" ? null : g.user;
    let head;
    if (res.tie) head = "引き分け";
    else if (!user) head = g.teams[res.winner].short + " の勝利";
    else head = res.winner === user ? "勝利！" : "敗戦…";
    const mvpSide = res.winner || "home";
    const mvp = Sc.mvp(g, mvpSide);
    // 試合の終わりに球団の勝利の歌を流したときは、ここでは鳴らさない
    if (user && !res.tie && !match.jingled) {
      if (res.winner === user) A.victory();
      else A.lose();
    }
    return {
      cls: "result",
      html() {
        const W = res.W ? g.P(res.W).name : "-";
        const L = res.L ? g.P(res.L).name : "-";
        const S = res.S ? g.P(res.S).name : "";
        const mp = mvp ? g.P(mvp) : null;
        const ms = mp ? g.box[mp.id] : null;
        let mline = "";
        if (mp && ms) mline = mp.pos === "P" ? U.fmtIP(ms.outs || 0) + "回 " + (ms.pk || 0) + "奪三振 " + (ms.pr || 0) + "失点" : (ms.ab || 0) + "打数" + (ms.h || 0) + "安打 " + (ms.rbi || 0) + "打点" + (ms.hr ? " " + ms.hr + "本塁打" : "");
        return (
          '<div class="scr-body res-body"><div class="res-head ' +
          (user && res.winner === user ? "win" : user && !res.tie ? "lose" : "") +
          '"><h2>' +
          esc(head) +
          "</h2>" +
          (res.walkoff ? '<p class="walkoff">サヨナラゲーム</p>' : "") +
          "</div>" +
          Sc.lineScoreHTML(g) +
          '<p class="wls">勝 <b>' +
          esc(W) +
          "</b>　敗 <b>" +
          esc(L) +
          "</b>" +
          (S ? "　S <b>" + esc(S) + "</b>" : "") +
          "</p>" +
          (mp ? '<div class="mvp res-in' + (PB.Cards ? ' has-card"><div class="mvp-pc"></div>' : '"><canvas class="pc-face" width="72" height="72" data-face="' + esc(mp.id) + '"></canvas>') + '<div><span class="mvp-l">今日のヒーロー</span><b>' + esc(mp.full || mp.name) + "</b><small>" + esc(mline) + "</small></div></div>" : "") +
          '<details class="box-det"><summary>スコアブック</summary>' +
          Sc.boxScoreHTML(g) +
          "</details>" +
          (opts.extra ? '<div class="row-btns"><button class="btn res-extra" data-act="extra">' + esc(opts.extra.label) + "</button></div>" : "") +
          '<div class="row-btns stick">' +
          (opts.again ? '<button class="btn" data-act="again">もう一度</button>' : "") +
          '<button class="btn primary" data-act="done">' +
          esc(opts.doneLabel || "タイトルへ") +
          "</button></div></div>"
        );
      },
      mount(root) {
        const lookup = (id) => {
          const p = g.P(id);
          const side = g.teams.home.players.indexOf(p) >= 0 ? "home" : "away";
          return { p, team: g.teams[side] };
        };
        UI.drawFaces(root, lookup);
        // 今日のヒーローは選手カードで
        const slot = root.querySelector(".mvp-pc");
        if (slot && mvp) {
          const r = lookup(mvp);
          slot.appendChild(PB.Cards.el(r.p, r.team, { w: Math.min(132, Math.round(window.innerWidth * 0.34)), home: r.team === g.teams.home }));
        }
      },
      onAct(act) {
        if (act === "done") opts.onDone();
        else if (act === "again" && opts.again) opts.again();
        else if (act === "extra" && opts.extra) opts.extra.onTap();
      },
    };
  };

  /* ---------- ホームラン競争 ---------- */
  Sc.derbySetup = function () {
    const st = Sc._derby || (Sc._derby = { team: "g", batter: null, level: "normal" });
    return {
      html() {
        const t = Store.team(st.team);
        const bats = t.players.filter((p) => p.pos !== "P").sort((a, b) => b.power - a.power);
        if (!st.batter || !bats.find((p) => p.id === st.batter)) st.batter = bats[0].id;
        const rec = Store.data.derby;
        return (
          UI.header("ホームラン競争", "back") +
          '<div class="scr-body"><p class="note">10アウトになるまでに何本ホームランを打てるか。ホームラン以外を打つか、ストライクを見逃すとアウト。</p>' +
          (rec.best ? '<p class="rec">自己ベスト <b>' + rec.best + "本</b>（" + esc(rec.bestBy) + "）最長 " + rec.bestDist + "m</p>" : "") +
          '<h3 class="lbl">チーム</h3>' +
          teamPicker("team", st.team, null) +
          '<h3 class="lbl">バッター</h3><div class="olist">' +
          bats.map((p) => '<button class="orow' + (p.id === st.batter ? " on" : "") + '" data-act="bat" data-arg="' + p.id + '"><span class="on-p">' + D.POS_JP[p.pos] + "</span><b>" + esc(p.name) + (p.custom ? '<em class="badge">育</em>' : "") + "</b>" + abMini(p) + "</button>").join("") +
          '</div><h3 class="lbl">ピッチャー</h3>' +
          seg(
            "level",
            [
              ["easy", "打ちごろ"],
              ["normal", "ふつう"],
              ["hard", "変化球まじり"],
            ],
            st.level
          ) +
          '<div class="row-btns stick"><button class="btn red big" data-act="go">スタート！</button></div></div>'
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Sc.title());
        if (act === "team") {
          st.team = arg;
          st.batter = null;
        } else if (act === "bat") st.batter = arg;
        else if (act === "level") st.level = arg;
        else if (act === "go") return Sc.startDerby(st);
        UI.refresh();
      },
    };
  };

  Sc.startDerby = function (st) {
    const t = U.clone(Store.team(st.team));
    const opp = U.clone(Store.teams().find((x) => x.id !== st.team));
    // 打者を1番に
    const idx = t.lineup.findIndex((e) => e.id === st.batter);
    if (idx >= 0) {
      const e = t.lineup.splice(idx, 1)[0];
      t.lineup.unshift(e);
    } else {
      t.lineup[0] = { id: st.batter, pos: "DH" };
    }
    // 打撃投手 (球速を調整)
    const bp = opp.players.find((p) => p.id === opp.rotation[opp.rotation.length - 1]);
    bp.velo = st.level === "easy" ? 118 : st.level === "normal" ? 132 : 142;
    bp.control = 100;
    bp.stamina = 100;
    opp.rotIdx = opp.rotation.length - 1;
    const game = new PB.Game({ away: t, home: opp, innings: 99, user: "away", level: "normal" });
    UI.hideScreen();
    PB.main.startMatch({
      game,
      mode: "derby",
      derby: { outs: 10, level: st.level },
      night: Store.settings().night,
      onEnd: (m) => {
        PB.main.stopMatch();
        const d = m.derby;
        const rec = Store.data.derby;
        const bat = game.P(st.batter);
        let newRec = false;
        if (d.hr > rec.best || (d.hr === rec.best && d.best > rec.bestDist)) {
          rec.best = d.hr;
          rec.bestBy = bat.name;
          newRec = true;
        }
        rec.bestDist = Math.max(rec.bestDist || 0, d.best);
        Store.save();
        UI.go({
          cls: "result",
          html() {
            return (
              '<div class="scr-body res-body"><div class="res-head win"><h2>' +
              d.hr +
              ' 本</h2><p class="walkoff">' +
              (newRec ? "自己ベスト更新！" : "ホームラン競争 結果") +
              '</p></div><p class="wls">' +
              esc(bat.name) +
              "　最長 <b>" +
              d.best +
              "m</b>　合計 <b>" +
              d.total +
              'm</b></p><div class="dlog">' +
              d.log.map((x) => '<span class="' + (x.label === "HR" ? "hr" : x.out ? "out" : "") + '">' + (x.label === "HR" ? x.dist + "m" : esc(x.label)) + "</span>").join("") +
              '</div><div class="row-btns stick"><button class="btn" data-act="again">もう一度</button><button class="btn primary" data-act="done">タイトルへ</button></div></div>'
            );
          },
          onAct(act) {
            if (act === "again") Sc.startDerby(st);
            else UI.go(Sc.title());
          },
        });
      },
      onQuit: () => UI.go(Sc.derbySetup()),
    });
  };

  /* ---------- 選手名鑑 ---------- */
  Sc.roster = function () {
    const st = Sc._roster || (Sc._roster = { team: "t", tab: "bat" });
    return {
      html() {
        const t = Store.team(st.team);
        const list = t.players.filter((p) => (st.tab === "bat" ? p.pos !== "P" : p.pos === "P"));
        const season = Store.data.pennant ? Store.data.pennant.stats : null;
        return (
          UI.header("選手名鑑", "back") +
          '<div class="scr-body">' +
          teamPicker("team", st.team, null) +
          seg(
            "tab",
            [
              ["bat", "野手"],
              ["pit", "投手"],
            ],
            st.tab
          ) +
          '<div class="olist">' +
          list
            .map((p) => {
              const s = season && season[p.id];
              let sl = "";
              if (s) sl = p.pos === "P" ? '<span class="sl">' + (s.w || 0) + "勝 " + U.fmtERA(s.er || 0, s.outs || 0) + "</span>" : '<span class="sl">' + U.fmtAvg(s.h || 0, s.ab || 0) + " " + (s.hr || 0) + "本</span>";
              return '<button class="orow" data-act="p" data-arg="' + p.id + '"><span class="on-n">' + p.num + '</span><span class="on-p">' + D.POS_JP[p.pos] + "</span><b>" + esc(p.name) + (p.custom ? '<em class="badge">育</em>' : "") + "</b>" + abMini(p) + sl + "</button>";
            })
            .join("") +
          "</div></div>"
        );
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Sc.title());
        if (act === "team") st.team = arg;
        else if (act === "tab") st.tab = arg;
        else if (act === "p") {
          const season = Store.data.pennant ? Store.data.pennant.stats : null;
          return UI.showPlayer(arg, season ? season[arg] : null);
        }
        UI.refresh();
      },
    };
  };

  /* ---------- 設定 ---------- */
  const GFX_NAME = { "2d": "2D", low: "低", mid: "中", high: "高", auto: "自動" };
  // 画質 (3D 表示)。3D の無い版 (1 ファイル版) では出さない
  function gfxBlock(S) {
    const M = PB.main;
    const V3 = PB.View3D;
    if (!M || !M.gfxLevel || !V3 || !V3.init) return "";
    const cur = S.gfx || "auto";
    let note = "重いときは「低」か「2D」に。高は新しい機種向けです。";
    if (cur === "auto") {
      const a = M.autoGfx();
      const gpu = String(a.gpu || "")
        .replace(/^ANGLE \(/, "")
        .replace(/\)$/, "")
        .slice(0, 40);
      // 「自動」で重すぎたときは一段下げた画質を覚えている (main.js の onPoor)
      note = "この端末の判定: <b>" + GFX_NAME[a.lvl] + "</b>" + (gpu ? '<span class="gfx-gpu">（' + esc(gpu) + "）</span>" : "") + (a.slow ? "<br>描画が重かったので一段下げました。" : "") + "<br>" + note;
    }
    if (M.gfxLevel() !== "2d" && !V3.ok) note = "この端末では 3D 表示を使えないため、2D で表示しています。";
    return (
      '<h3 class="lbl">画質（3D 表示）</h3><div class="gfx-seg">' +
      seg(
        "gfx",
        ["2d", "low", "mid", "high", "auto"].map((k) => [k, GFX_NAME[k]]),
        cur
      ) +
      '</div><p class="note gfx-note">' +
      note +
      "</p>"
    );
  }
  Sc.settings = function () {
    const S = Store.settings();
    return {
      html() {
        const tog = (k, label) => '<label class="tg"><span>' + label + '</span><button class="sw' + (S[k] ? " on" : "") + '" data-act="tog" data-arg="' + k + '" aria-pressed="' + !!S[k] + '"><i></i></button></label>';
        return (
          UI.header("設定", "back") +
          '<div class="scr-body">' +
          '<h3 class="lbl">難易度（クイック対戦・ペナント）</h3>' +
          seg(
            "level",
            Object.keys(PB.AI.LEVELS).map((k) => [k, PB.AI.LEVELS[k].name]),
            S.level
          ) +
          '<h3 class="lbl">スイングの操作</h3>' +
          seg(
            "swingMode",
            [
              ["button", "打つボタン"],
              ["release", "指を離して打つ"],
            ],
            S.swingMode
          ) +
          '<h3 class="lbl">ミートアシスト（カーソルがボールに寄る）</h3>' +
          seg(
            "assist",
            [
              ["off", "なし"],
              ["weak", "弱"],
              ["strong", "強"],
            ],
            S.assist
          ) +
          '<h3 class="lbl">カーソル感度 <b id="sensv">' +
          S.sens.toFixed(1) +
          '</b></h3><input id="sens" type="range" min="0.5" max="2" step="0.1" value="' +
          S.sens +
          '">' +
          '<h3 class="lbl">プレー速度</h3>' +
          seg(
            "playSpeed",
            [
              ["1", "等速"],
              ["2.5", "早送り"],
            ],
            String(S.playSpeed)
          ) +
          '<h3 class="lbl">演出（スタメン発表・選手の登場・ヒーローインタビューなど）</h3>' +
          seg(
            "enshutsu",
            [
              ["more", "多め"],
              ["std", "標準"],
              ["less", "少なめ"],
            ],
            S.enshutsu || "std"
          ) +
          gfxBlock(S) +
          '<div class="tgs">' +
          tog("sound", "効果音") +
          tog("bgm", "応援トランペット") +
          tog("voice", "実況ボイス（端末の読み上げ）") +
          tog("vibrate", "振動") +
          tog("lefty", "左手用レイアウト（打つボタンを左に）") +
          "</div>" +
          (Store.server
            ? '<h3 class="lbl">サーバー保存のセーブ名</h3><div class="slot"><input id="slot" maxlength="32" value="' +
              esc(Store.slot) +
              '"><button class="btn" data-act="slot">切り替え</button></div><p class="note">同じセーブ名を入力すると、別の端末でも同じデータで遊べます。</p>'
            : "") +
          '<h3 class="lbl">データ</h3><div class="row-btns"><button class="btn red" data-act="reset">セーブデータを消去</button></div>' +
          "</div>"
        );
      },
      mount(root) {
        const r = root.querySelector("#sens");
        r.addEventListener("input", () => {
          S.sens = Number(r.value);
          root.querySelector("#sensv").textContent = S.sens.toFixed(1);
          Store.save();
        });
      },
      onAct(act, arg) {
        if (act === "back") return UI.go(Sc.title());
        if (act === "tog") {
          S[arg] = !S[arg];
          PB.main.applySettings();
        } else if (["level", "swingMode", "assist", "enshutsu"].indexOf(act) >= 0) S[act] = arg;
        else if (act === "playSpeed") S.playSpeed = Number(arg);
        else if (act === "gfx") {
          // 画質はすぐに反映する (タイトル画面の背景が切り替わる)
          S.gfx = arg;
          if (!PB.main.applyGfx(true) && arg !== "2d") UI.toast("この端末では 3D 表示を使えないため 2D で表示します");
        } else if (act === "slot") {
          const v = (document.getElementById("slot").value || "").trim().replace(/[^\w\-ぁ-んァ-ヶ一-龠]/g, "");
          Store.setSlot(v || "default");
          Store.pull().then((changed) => {
            UI.toast(changed ? "サーバーのデータを読み込みました" : "セーブ名を切り替えました");
            if (!changed) Store.save();
          });
        } else if (act === "reset") {
          return UI.confirm(
            "ペナント・サクセス選手・記録をすべて消去します。よろしいですか？",
            () => {
              Store.resetAll();
              UI.toast("セーブデータを消去しました");
              UI.go(Sc.title());
            },
            { yes: "消去する", danger: true }
          );
        }
        Store.save();
        UI.refresh();
      },
    };
  };

  /* ---------- あそびかた ---------- */
  Sc.howto = function () {
    return {
      html() {
        return (
          UI.header("あそびかた", "back") +
          '<div class="scr-body howto">' +
          '<section><h3>打つ</h3><ol><li>画面のどこかを指でなぞると、黄色い<b>ミートカーソル</b>が動きます。</li><li>ボールが来たら右下の<b>「打つ」</b>をタップ。早いと引っ張り、遅いと流し打ちになります。</li><li>ボールがカーソルの<b>上側</b>に当たるとフライ、<b>下側</b>だとゴロ。中心（芯）に近いほど強い打球になります。</li><li>カーソルの大きさはミート、打球の速さはパワーで決まります。</li></ol></section>' +
          '<section><h3>バント・盗塁</h3><p>「バント」でバントの構え。ボールにカーソルを合わせるだけで転がせます。ランナーがいるときは「盗塁」を押してから投球を待つとスタートを切ります。</p></section>' +
          '<section><h3>投げる</h3><ol><li>下の球種ボタンで変化球を選ぶ（矢印が曲がる方向、数字が変化量）。</li><li>ゾーンをタップ、または画面をなぞって<b>ミット</b>を動かし、狙う場所を決めます。</li><li>「投げる」で投球。コントロールが低い投手やスタミナが減った投手は狙いがずれます。</li></ol></section>' +
          '<section><h3>守備・走塁</h3><p>打球を打った後や打たれた後は、野手とランナーが自動で動きます。「早送り」「スキップ」で時間を短縮できます。「タイム」から投手交代・代打ができます。</p></section>' +
          '<section><h3>能力の見かた</h3><p>S（最高）→ A → B → C → D → E → F → G の8段階。弾道は打球の上がりやすさ（1〜4）です。</p><div class="rk-legend">' +
          D.RANKS.map((r) => '<b style="--rk:' + r.color + '">' + r.r + "</b>").join("") +
          "</div></section>" +
          '<section><h3>サクセス</h3><p>練習を選んで経験点をため、能力に振り分けて選手を育てます。体力が少ないとケガをしやすくなります。試合イベントでは実際に打席・マウンドに立ちます。完成した選手はチームに登録して試合で使えます。</p></section>' +
          "</div>"
        );
      },
      onAct(act) {
        if (act === "back") UI.go(Sc.title());
      },
    };
  };

  PB.Screens = Sc;
})((window.PB = window.PB || {}));
