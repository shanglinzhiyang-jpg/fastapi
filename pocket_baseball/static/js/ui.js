/* 熱闘！ポケットベースボール — 画面遷移と共通 UI 部品 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const UI = {};
  const esc = U.esc;

  UI.init = function () {
    UI.root = document.getElementById("screen");
    UI.hud = document.getElementById("hud");
    UI.modalRoot = document.getElementById("modal");
    UI.toastEl = document.getElementById("toast");
    UI.root.addEventListener("click", (e) => UI.dispatch(e, UI.cur));
    UI.modalRoot.addEventListener("click", (e) => {
      // 開いた直後のクリックは、モーダルを開いたタップの残り (ゴーストクリック) なので無視する
      if (performance.now() - UI.modalAt < 350) return;
      if (e.target === UI.modalRoot && UI.modalOpts && UI.modalOpts.dismiss !== false) UI.closeModal();
      UI.dispatch(e, UI.modalOpts);
    });
  };

  UI.dispatch = function (e, handler) {
    const el = e.target.closest("[data-act]");
    if (!el || !handler) return;
    const act = el.getAttribute("data-act");
    const arg = el.getAttribute("data-arg");
    if (el.disabled) return;
    if (PB.Audio) PB.Audio.click();
    if (handler.onAct) handler.onAct(act, arg, el, e);
  };

  /* screen = { html():string, mount?(root), onAct?(act,arg,el), unmount?(), keepCanvas?:bool } */
  UI.go = function (screen) {
    if (UI.cur && UI.cur.unmount) UI.cur.unmount();
    UI.closeModal();
    UI.cur = screen;
    UI.root.hidden = false;
    UI.root.className = "screen " + (screen.cls || "");
    UI.root.innerHTML = screen.html();
    UI.root.scrollTop = 0;
    if (screen.mount) screen.mount(UI.root);
  };
  UI.refresh = function () {
    if (!UI.cur) return;
    const st = UI.root.scrollTop;
    UI.root.innerHTML = UI.cur.html();
    if (UI.cur.mount) UI.cur.mount(UI.root);
    UI.root.scrollTop = st;
  };
  UI.hideScreen = function () {
    if (UI.cur && UI.cur.unmount) UI.cur.unmount();
    UI.cur = null;
    UI.root.hidden = true;
    UI.root.innerHTML = "";
  };

  /* ---------- モーダル ---------- */
  UI.modal = function (html, opts) {
    UI.modalOpts = opts || {};
    UI.modalAt = performance.now();
    UI.modalRoot.innerHTML = '<div class="modal-box ' + (UI.modalOpts.cls || "") + '">' + html + "</div>";
    UI.modalRoot.hidden = false;
    if (UI.modalOpts.mount) UI.modalOpts.mount(UI.modalRoot.firstChild);
  };
  UI.closeModal = function () {
    if (!UI.modalRoot) return;
    UI.modalRoot.hidden = true;
    UI.modalRoot.innerHTML = "";
    const o = UI.modalOpts;
    UI.modalOpts = null;
    if (o && o.onClose) o.onClose();
  };
  UI.confirm = function (text, yes, opts) {
    const o = opts || {};
    UI.modal(
      '<p class="modal-text">' +
        esc(text) +
        '</p><div class="row-btns"><button class="btn ghost" data-act="no">' +
        esc(o.no || "やめる") +
        '</button><button class="btn ' +
        (o.danger ? "red" : "primary") +
        '" data-act="yes">' +
        esc(o.yes || "OK") +
        "</button></div>",
      {
        onAct(act) {
          UI.closeModal();
          if (act === "yes") yes();
          else if (o.onNo) o.onNo();
        },
      }
    );
  };

  let toastTimer = null;
  UI.toast = function (text, ms) {
    const el = UI.toastEl;
    el.textContent = text;
    el.hidden = false;
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      el.hidden = true;
    }, ms || 1800);
  };

  /* ---------- 部品 ---------- */
  UI.mark = function (team, size) {
    const s = size || 28;
    const def = PB.D.teamDef ? PB.D.teamDef(team.id) : null;
    const logo = team.logo || (def && def.logo);
    // 球団ロゴ (背景を抜いた画像) をそのまま置く
    if (logo) return '<img class="tmark tmark-img" src="' + logo + '" alt="' + esc(team.short || "") + '" style="width:' + s + "px;height:" + s + 'px" loading="lazy" draggable="false">';
    return (
      '<span class="tmark" style="width:' +
      s +
      "px;height:" +
      s +
      "px;font-size:" +
      Math.round(s * 0.55) +
      "px;background:" +
      team.main +
      ";color:" +
      team.sub +
      ";border-color:" +
      team.cap +
      '">' +
      esc(team.mark) +
      "</span>"
    );
  };

  UI.rank = function (v, label, opts) {
    const r = D.rank(v);
    const o = opts || {};
    return (
      '<span class="ab' +
      (o.compact ? " compact" : "") +
      '"><span class="ab-l">' +
      esc(label) +
      '</span><b class="ab-r" style="--rk:' +
      r.color +
      '">' +
      r.r +
      "</b>" +
      (o.noNum ? "" : '<span class="ab-n">' + Math.round(v) + "</span>") +
      "</span>"
    );
  };

  UI.trajIcon = function (t) {
    return '<span class="traj" title="弾道' + t + '">弾道<b>' + t + "</b></span>";
  };

  UI.handText = (p) => (p.throws === "L" ? "左" : "右") + "投" + (p.bats === "S" ? "両" : p.bats === "L" ? "左" : "右") + "打";

  UI.skills = function (p) {
    if (!p.skills || !p.skills.length) return '<span class="muted small">特殊能力なし</span>';
    return p.skills
      .map((s) => {
        const d = D.SKILLS[s];
        if (!d) return "";
        return '<span class="skill ' + (d.good ? "good" : "bad") + '" title="' + esc(d.desc) + '">' + esc(d.name) + "</span>";
      })
      .join("");
  };

  UI.pitchList = function (p) {
    const items = [{ t: "FB", lv: 0 }].concat(p.pitches || []);
    return items
      .map((it) => {
        const def = D.PITCHES[it.t];
        const arrow = D.pitchArrow(it.t, p.throws);
        return '<span class="pch"><i>' + arrow + "</i>" + esc(def.name) + (it.lv ? "<b>" + it.lv + "</b>" : "") + "</span>";
      })
      .join("");
  };

  UI.abilities = function (p) {
    if (p.pos === "P") {
      return (
        '<div class="ab-grid">' +
        '<span class="ab velo"><span class="ab-l">球速</span><b class="velo-n">' +
        p.velo +
        '</b><span class="ab-n">km/h</span></span>' +
        UI.rank(p.control, "コントロール") +
        UI.rank(p.stamina, "スタミナ") +
        '</div><div class="pch-list">' +
        UI.pitchList(p) +
        "</div>"
      );
    }
    return (
      '<div class="ab-grid">' +
      UI.trajIcon(p.traj) +
      UI.rank(p.meet, "ミート") +
      UI.rank(p.power, "パワー") +
      UI.rank(p.speed, "走力") +
      UI.rank(p.arm, "肩力") +
      UI.rank(p.field, "守備力") +
      UI.rank(p.catch, "捕球") +
      "</div>"
    );
  };

  UI.compactAb = function (p) {
    if (p.pos === "P") return '<span class="cab">' + p.velo + "km " + D.rank(p.control).r + D.rank(p.stamina).r + "</span>";
    return (
      '<span class="cab">' +
      ["meet", "power", "speed"]
        .map((k) => {
          const r = D.rank(p[k]);
          return '<b style="color:' + r.color + '">' + r.r + "</b>";
        })
        .join("") +
      "</span>"
    );
  };

  // 選手カード (詳細)
  UI.playerCard = function (p, team, season) {
    const ov = D.overallRank(p);
    let stat = "";
    if (season) {
      if (p.pos === "P") {
        stat =
          '<div class="pc-stats"><span>登板<b>' +
          (season.pg || 0) +
          "</b></span><span>勝<b>" +
          (season.w || 0) +
          "</b></span><span>敗<b>" +
          (season.l || 0) +
          "</b></span><span>S<b>" +
          (season.sv || 0) +
          "</b></span><span>防御率<b>" +
          U.fmtERA(season.er || 0, season.outs || 0) +
          "</b></span><span>奪三振<b>" +
          (season.pk || 0) +
          "</b></span></div>";
      } else {
        stat =
          '<div class="pc-stats"><span>打率<b>' +
          U.fmtAvg(season.h || 0, season.ab || 0) +
          "</b></span><span>本塁打<b>" +
          (season.hr || 0) +
          "</b></span><span>打点<b>" +
          (season.rbi || 0) +
          "</b></span><span>安打<b>" +
          (season.h || 0) +
          "</b></span><span>盗塁<b>" +
          (season.sb || 0) +
          "</b></span></div>";
      }
    }
    return (
      '<div class="pcard" style="--tm:' +
      team.main +
      ";--ts:" +
      team.sub +
      '">' +
      // 顔の代わりに球団マーク
      '<div class="pc-head"><span class="pc-face pc-logo">' +
      UI.mark(team, 52) +
      '</span><div class="pc-name"><span class="pc-num">' +
      p.num +
      '</span><b>' +
      esc(p.full || p.name) +
      "</b><span class=\"pc-sub\">" +
      esc(D.POS_FULL[p.pos]) +
      " / " +
      UI.handText(p) +
      (p.custom ? ' / <em class="badge">サクセス</em>' : "") +
      '</span></div><span class="ov" style="--rk:' +
      ov.color +
      '">' +
      ov.r +
      "</span></div>" +
      UI.abilities(p) +
      '<div class="skills">' +
      UI.skills(p) +
      "</div>" +
      stat +
      "</div>"
    );
  };

  UI.drawFaces = function (root, lookup) {
    root.querySelectorAll("canvas[data-face]").forEach((cv) => {
      const id = cv.getAttribute("data-face");
      const r = lookup(id);
      if (r) PB.Chara.portrait(cv, r.p, r.team);
    });
  };

  UI.findPlayer = function (id) {
    // ペナントの画面 (cur.pen) ではペナントの球団の写し (二軍・状態つき) を先に見る
    const pr = UI.cur && UI.cur.pen && PB.Pennant && PB.Pennant.findPlayer ? PB.Pennant.findPlayer(id) : null;
    if (pr) return pr;
    for (const t of PB.Store.teams()) {
      const p = t.players.find((x) => x.id === id);
      if (p) return { p, team: t };
    }
    return null;
  };

  UI.showPlayer = function (id, season) {
    const r = UI.findPlayer(id);
    if (!r) return;
    UI.modal((PB.Cards ? '<div class="pbslot"></div>' : "") + UI.playerCard(r.p, r.team, season) + '<div class="row-btns"><button class="btn primary" data-act="close">とじる</button></div>', {
      cls: "wide",
      onAct(act) {
        if (act === "close") UI.closeModal();
      },
      mount(box) {
        UI.drawFaces(box, UI.findPlayer);
        // 選手カード (派手な切り抜き)
        const slot = box.querySelector(".pbslot");
        if (slot) slot.appendChild(PB.Cards.el(r.p, r.team, { w: Math.min(280, window.innerWidth - 80) }));
      },
    });
  };

  UI.header = function (title, back) {
    return '<header class="scr-head">' + (back ? '<button class="back" data-act="' + back + '" aria-label="戻る">‹</button>' : "") + "<h2>" + esc(title) + "</h2></header>";
  };

  PB.UI = UI;
})((window.PB = window.PB || {}));
