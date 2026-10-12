/* 熱闘！ポケットベースボール — 試合画面 (操作・演出・実況)
 * Game (ルール) と Play (物理) を動かし、Canvas に描画し、タッチ操作を受け付ける。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const P = PB.P;
  const F = PB.F;
  const R = PB.R;
  const A = PB.Audio;
  const AI = PB.AI;
  const UI = PB.UI;
  const Store = PB.Store;
  const Talk = PB.Talk;
  const Cam = PB.R.Cam;
  const esc = U.esc;
  const TV = () => PB.TV;

  const WINDUP = 1.0; // 投球モーション (秒)
  const RELEASE = 0.86; // モーション中のリリース位置
  const BASE_JP = { 1: "一塁", 2: "二塁", 3: "三塁", 4: "本塁" };
  // 演出の量 (設定「演出」。確認用に ?fx=more|std|less で上書きできる)
  const FX_LV = { less: 0, std: 1, more: 2 };
  function fxSetting(S) {
    let q = null;
    try {
      const mm = /[?&]fx=(more|std|less)\b/.exec(window.location.search || "");
      q = mm && mm[1];
    } catch (e) {
      q = null;
    }
    const v = FX_LV[q || S.enshutsu];
    return v == null ? 1 : v;
  }
  function teamCols(t) {
    const tt = PB.TV && PB.TV.teamOf ? PB.TV.teamOf(t) : t;
    return [tt.main || "#d83a3a", tt.sub || "#ffe25c", "#ffffff"];
  }

  class Match {
    /* opt: { game, mode:'game'|'derby'|'mini', onEnd(match), night, title,
     *        derby:{outs, batterTeam}, mini:{maxPA, onPA(res)} } */
    constructor(opt) {
      this.opt = opt;
      this.g = opt.game;
      this.mode = opt.mode || "game";
      this.S = Store.settings();
      this.state = "intro";
      this.t = 0;
      this.cur = { x: 0, z: P.ZONE.cz };
      this.bunt = false;
      this.aim = { x: 0, z: 0.7 };
      this.selPitch = "FB";
      this.camBlend = 0;
      this.camDir = 0;
      this.speed = this.S.playSpeed || 1;
      this.halfChanged = false;
      this.paCount = 0;
      this.derby = opt.derby ? { outs: 0, maxOuts: opt.derby.outs || 10, hr: 0, best: 0, total: 0, log: [] } : null;
      this.fx = [];
      this.walkAnim = 0;
      this.time = 0;
      this.lvSet = fxSetting(this.S);
      this.kLog = {}; // 投手ごとの今日の三振 ("S" 空振り / "L" 見逃し)
      this.cardSeen = {}; // 打席に向かうカードを出した打者
      this.lastPit = {}; // 側ごとに最後に紹介した投手 (交代のアナウンス用)
      this.l7 = {};
      this.cue = null;
      R.night = opt.night != null ? opt.night : this.S.night;
      R.bg = {};
      if (opt.season && !this.g.season) this.g.season = opt.season;
      this.g.on((type, d) => this.onGame(type, d));
      this.buildHUD();
      A.ambient(true);
      this.enter("intro");
    }

    /* ---------- 便利関数 ---------- */
    userBat() {
      return this.g.isUser(this.g.battingSide());
    }
    userPitch() {
      return this.g.isUser(this.g.fieldingSide());
    }
    teamsKey() {
      return { home: this.g.teams.home, away: this.g.teams.away };
    }
    enter(st) {
      this.state = st;
      this.t = 0;
      this.updateControls();
    }
    // 演出の量: 0 少なめ / 1 標準 / 2 多め (サクセスの試合・ホームラン競争は少なめ、早送り中は標準まで)
    fxLv() {
      if (this.mode !== "game" || this.derby) return 0;
      return this.speed > 1 ? Math.min(1, this.lvSet) : this.lvSet;
    }
    buzz(pattern) {
      if (this.S.vibrate) A.vibe(pattern);
    }
    // 歓声を攻撃側・守備側の応援席の方から (ホームは一塁側 = 右)
    roar(level, dur, side) {
      A.roar(level, dur, side === "home" ? 0.3 : side === "away" ? -0.3 : 0);
    }

    /* ---------- 演出の段取り (cue): 時刻つきの段を順に実行し、終わったら end。タップで飛ばせる ---------- */
    // c: { name, dur, steps: [[秒, fn], …], skip(), end(), cine: ゾーンなどを隠す }
    runCue(c) {
      c.t = 0;
      c.i = 0;
      this.cue = c;
      this.enter("cue");
    }
    updateCue(dt) {
      const c = this.cue;
      if (!c) return;
      c.t += dt;
      while (c.steps && c.i < c.steps.length && c.steps[c.i][0] <= c.t) c.steps[c.i++][1]();
      if (this.cue === c && c.t >= c.dur) this.endCue(false);
    }
    endCue(skip) {
      const c = this.cue;
      if (!c) return;
      this.cue = null;
      if (skip && c.skip) c.skip();
      if (c.end) c.end();
    }
    runSeq(list, done) {
      const next = () => {
        const c = list.shift();
        if (!c) return done();
        c.end = next;
        this.runCue(c);
      };
      next();
    }

    say(text, cls) {
      const el = this.hud.querySelector(".talk");
      el.textContent = text;
      el.className = "talk show " + (cls || "");
      clearTimeout(this.talkTimer);
      this.talkTimer = setTimeout(() => {
        el.classList.remove("show");
      }, 2600);
      A.say(text.replace(/[！!？?]/g, "、"));
    }
    // 解説のひと言 (実況の下に小さく。標準では毎回は出さない)
    kai(key, vars) {
      const lv = this.fxLv();
      if (lv < 1 || (lv < 2 && Math.random() < 0.45)) return;
      const tx = TV().kai(key, vars);
      const el = this.hud && this.hud.querySelector(".talk-sub");
      if (!tx || !el) return;
      clearTimeout(this.kaiTimer);
      this.kaiTimer = setTimeout(() => {
        el.innerHTML = "<span>解説</span>" + esc(tx);
        el.className = "talk-sub show";
        this.kaiTimer = setTimeout(() => el.classList.remove("show"), 2300);
      }, 800);
    }

    banner(text, cls, ms) {
      const el = this.hud.querySelector(".banner");
      el.innerHTML = text;
      el.className = "banner show " + (cls || "");
      clearTimeout(this.banTimer);
      this.banTimer = setTimeout(() => {
        el.className = "banner";
      }, ms || 1500);
    }

    /* ---------- HUD ---------- */
    buildHUD() {
      const hud = UI.hud;
      this.hud = hud;
      hud.hidden = false;
      hud.className = "hud" + (this.S.lefty ? " lefty" : "");
      if (this.tv) this.tv.destroy();
      this.tv = new PB.TV(this);
      hud.innerHTML =
        this.tv.html() +
        '<button class="tv-pause" data-hud="pause" aria-label="タイム">タイム</button>' +
        '<div class="talk"></div>' +
        '<div class="talk-sub"></div>' +
        '<div class="banner"></div>' +
        '<div class="ctrl"></div>';
      this.tv.mount(hud);
      hud.onpointerdown = (e) => {
        const b = e.target.closest("[data-hud]");
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        A.unlock();
        this.onButton(b.getAttribute("data-hud"), b.getAttribute("data-arg"), b);
      };
      this.updateHUD();
    }

    updateHUD() {
      if (!this.hud || !this.tv) return;
      this.tv.update();
    }

    updateControls() {
      const c = this.hud && this.hud.querySelector(".ctrl");
      if (!c) return;
      const st = this.state;
      const g = this.g;
      let html = "";
      if (st === "inplay" || st === "result") {
        html = '<div class="row-r"><button class="cbtn sm" data-hud="speed">' + (this.speed > 1 ? "等速" : "早送り ≫") + '</button><button class="cbtn sm" data-hud="skip">スキップ</button></div>';
      } else if (st === "ready" || st === "windup" || st === "pitch") {
        if (this.userBat() && (this.mode !== "mini" || this.opt.mini.side === "bat")) {
          const canSteal = !this.derby && ((g.bases[1] && !g.bases[2]) || (g.bases[2] && !g.bases[3]));
          html =
            '<div class="row-l">' +
            (this.derby ? "" : '<button class="cbtn tog' + (this.bunt ? " on" : "") + '" data-hud="bunt">バント</button>') +
            (canSteal ? '<button class="cbtn tog' + (this.stealReq ? " on" : "") + '" data-hud="steal">盗塁</button>' : "") +
            "</div>" +
            (this.bunt ? '<div class="swing-wrap"><div class="cbtn big ghost">バント構え</div></div>' : '<div class="swing-wrap"><button class="cbtn big swing" data-hud="swing">打つ</button></div>') +
            '<p class="hint">' +
            (st === "ready" ? "画面をなぞってカーソルを動かす" : "") +
            "</p>";
        } else if (this.userPitch()) {
          const pit = g.pitcher();
          const ars = P.arsenal(pit);
          html =
            '<div class="chips">' +
            ars
              .map((a) => {
                const def = D.PITCHES[a.t];
                return '<button class="chip' + (a.t === this.selPitch ? " on" : "") + '" data-hud="pitch" data-arg="' + a.t + '"><i>' + D.pitchArrow(a.t, pit.throws) + "</i>" + esc(def.short) + (a.lv ? "<b>" + a.lv + "</b>" : "") + "</button>";
              })
              .join("") +
            "</div>" +
            '<div class="swing-wrap"><button class="cbtn big throw" data-hud="throw"' +
            (st !== "ready" ? " disabled" : "") +
            ">投げる</button></div>" +
            '<p class="hint">' +
            (st === "ready" ? "なぞってミットを動かす" : "") +
            "</p>";
        } else {
          html = '<div class="row-r"><button class="cbtn sm" data-hud="speed">' + (this.speed > 1 ? "等速" : "早送り ≫") + "</button></div>";
        }
      } else if (st === "paIntro" || st === "change" || st === "intro" || st === "tvscore" || st === "cue") {
        html = '<div class="row-r"><button class="cbtn sm" data-hud="next">次へ ▶</button></div>';
      }
      c.innerHTML = html;
    }

    /* ---------- ボタン ---------- */
    onButton(act, arg) {
      const st = this.state;
      switch (act) {
        case "swing":
          if (st === "pitch" && !this.sw && this.userBat()) this.doSwing();
          break;
        case "bunt":
          if (st === "pitch") break;
          this.bunt = !this.bunt;
          this.updateControls();
          break;
        case "steal":
          if (st === "pitch") break;
          this.stealReq = this.stealReq ? null : this.stealTargets();
          if (this.stealReq) this.say("ランナー、スタートの構え！");
          this.updateControls();
          break;
        case "pitch":
          this.selPitch = arg;
          A.select();
          this.updateControls();
          break;
        case "throw":
          if (st === "ready" && this.userPitch()) this.startWindup();
          break;
        case "speed":
          this.speed = this.speed > 1 ? 1 : 2.5;
          this.S.playSpeed = this.speed;
          Store.save();
          this.updateControls();
          break;
        case "skip":
          this.skipPlay = true;
          break;
        case "next":
          if (st === "cue") this.endCue(true);
          else this.t = 99;
          break;
        case "pause":
          this.pause();
          break;
      }
    }

    stealTargets() {
      const b = this.g.bases;
      if (b[1] && b[2] && !b[3]) return { 1: true, 2: true };
      if (b[1] && !b[2]) return { 1: true };
      if (b[2] && !b[3]) return { 2: true };
      return null;
    }

    /* ---------- 入力 (キャンバス) ---------- */
    pointerDown(e) {
      A.unlock();
      if (this.drag) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
      // ゾーン内タップでミットを直接置く (投球時)
      if (this.userPitch() && this.state === "ready") {
        const z = R.zoneRect(R.cams.bat);
        const m = 40;
        if (e.clientX > z.x0 - m && e.clientX < z.x1 + m && e.clientY > z.y0 - m && e.clientY < z.y1 + m) {
          const p = R.screenToPlate(R.cams.bat, e.clientX, e.clientY);
          this.aim.x = U.clamp(p.x, -0.55, 0.55);
          this.aim.z = U.clamp(p.z, 0.15, 1.4);
          this.drag.abs = true;
        }
      }
      if ((this.state === "change" || this.state === "paIntro" || this.state === "intro" || this.state === "tvscore") && this.t > 0.3) this.t = 99;
      if (this.state === "result" && this.t > 0.5) this.t = 99;
      if (this.state === "cue" && this.cue && this.cue.t > 0.3) this.endCue(true);
      // ホームランの帯が出たあとのダイヤモンド一周はタップで飛ばせる
      const h = this.hrFx;
      if (this.state === "inplay" && h && h.shown && this.play && this.play.t > h.at + 0.8) this.skipPlay = true;
    }
    pointerMove(e) {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      const k = (0.506 / (R.zonePx || 200)) * (this.S.sens || 1) * (d.abs ? 1 : 1.15);
      if (this.userPitch() && !this.userBat()) {
        if (this.state === "ready" || this.state === "windup") {
          this.aim.x = U.clamp(this.aim.x + dx * k, -0.55, 0.55);
          this.aim.z = U.clamp(this.aim.z - dy * k, 0.15, 1.4);
        }
      } else if (this.userBat()) {
        if (this.state === "ready" || this.state === "windup" || this.state === "pitch" || this.state === "paIntro" || this.state === "cue") {
          this.cur.x = U.clamp(this.cur.x + dx * k, -0.5, 0.5);
          this.cur.z = U.clamp(this.cur.z - dy * k, 0.2, 1.35);
        }
      }
    }
    pointerUp(e) {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (this.S.swingMode === "release" && this.userBat() && this.state === "pitch" && !this.sw && !this.bunt) this.doSwing();
    }

    /* ---------- 試合の流れ ---------- */
    onGame(type, d) {
      if (type === "half") this.halfChanged = true;
      if (type === "strikeout") this.lastPAEv = { type: "K" };
      if (type === "walk") this.lastPAEv = { type: "BB" };
      if (type === "play") this.lastPAEv = { type: d.type, res: d };
      if (type === "pitcherChange") {
        // 前の投手の球速を新しい投手の 1 球目に出さない
        this.lastPitch = null;
        if (this.derby) return;
        if (this.fxLv() >= 1) this.pendChange = Object.assign({ old: this.lastPit[d.side] }, d);
        else {
          this.say("ピッチャー交代、" + d.p.name + "。");
          if (this.tv) this.tv.pitcherIntro(d.p, d.side, "change");
        }
      }
      if (type === "pinchHit") {
        this.say("代打、" + this.g.P(d.id).name + "！");
        // タイムで代打を出したときは、その打者の登場をやり直す
        if (this.paused && this.fxLv() >= 1) this.pendPH = true;
      }
    }

    startPA() {
      const g = this.g;
      this.sw = null;
      this.pc = null;
      this.lastPitch = null;
      this.stealReq = null;
      this.bunt = false;
      this.cur = { x: 0, z: P.ZONE.cz };
      if (this.derby && this.derby.log.length) {
        this.updateHUD();
        this.nextPitch();
        return;
      }
      if (!this.derby) {
        g.cpuManage();
        g.paBunt = !this.userBat() ? AI.wantBunt(g) : false;
      }
      this.updateHUD();
      const bat = g.batter();
      if (this.derby) {
        this.enter("paIntro");
        this.paIntroT = 1.1;
        this.banner('<small>ホームラン競争</small>' + esc(bat.name), "info", 1000);
        A.chant(false);
        return;
      }
      this.tv.hide("tick");
      this.chantOn();
      const fs = g.fieldingSide();
      const startSP = this.mode === "game" && !this.tv.spShown[fs] && g.used[fs].length === 1;
      if (startSP) this.tv.spShown[fs] = true;
      const chg = this.pendChange;
      this.pendChange = null;
      if (this.fxLv() === 0) {
        // 少なめ: 打者の紹介だけ (先発投手はプレイボールのパネルで紹介済み)
        this.enter("paIntro");
        this.paIntroT = 1.1;
        if (chg) {
          this.say("ピッチャー交代、" + chg.p.name + "。");
          this.tv.pitcherIntro(chg.p, chg.side, "change");
          this.paIntroT = 2.8;
        }
        this.tv.batter();
        return;
      }
      // 中継風: (先発・交代の) 投手の紹介 → 打者の登場
      const walk = () => this.walkupCue();
      if (chg) this.pitcherCue(chg.p, chg.side, "change", walk, chg.old);
      else if (startSP) this.pitcherCue(g.pitcher(), fs, "start", walk);
      else walk();
    }

    // 応援: 攻撃側の球団のリフ (相手側・観戦は小さく)。得点圏で終盤か接戦ならチャンステーマ
    chantOn() {
      const g = this.g;
      const user = this.userBat();
      if (this.derby || (!user && (this.fxLv() < 1 || this.mode !== "game"))) return A.chant(false);
      const bs = g.battingSide();
      const c = g.ctx(null);
      const chance = c.risp && (g.inning >= 7 || Math.abs(g.leadOf(bs)) <= 2);
      A.chant(true, { team: g.teams[bs].id, vol: user ? 1 : g.user ? 0.4 : 0.6, chance });
    }

    // 投手の紹介: 場内アナウンス + 下のテロップ + カード
    pitcherCue(p, side, kind, then, oldId) {
      const g = this.g;
      const lv = this.fxLv();
      const change = kind === "change";
      const old = oldId && oldId !== p.id ? g.P(oldId) : null;
      const txt = "ピッチャー " + (old ? old.name + "に代わりまして " : "") + p.name;
      const bat = g.batter();
      const side2 = P.batSide(bat, p) === "L" ? "l" : "r";
      const first = !this.cardSeen[p.id];
      this.cardSeen[p.id] = 1;
      this.lastPit[side] = p.id;
      const dur = (change ? 2.8 : 2.2) + (lv >= 2 ? 0.5 : 0);
      this.runCue({
        name: "pitcher",
        dur,
        steps: [
          [
            0,
            () => {
              A.pa(txt, true);
              this.tv.pa(txt + (p.num != null ? "　背番号 " + p.num : ""), dur * 1000 + 300);
              if (change) this.say(TV().talk("pchange", { p: p.name }));
            },
          ],
          [0.25, () => this.tv.pitcherIntro(p, side, kind)],
          [0.45, () => (first || lv >= 2) && this.tv.card(p, g.teams[side], { side: side2, home: side === "home", kind: "pit", tag: change ? "リリーフ" : "先発" })],
        ],
        skip: () => {
          this.tv.hide("pa");
          this.tv.hide("card");
        },
        end: then,
      });
    }

    // 打者の登場: 場内アナウンス「1番 セカンド 仁志」+ 打者紹介 + (初打席・代打は) カード
    walkupCue() {
      const g = this.g;
      const lv = this.fxLv();
      const bs = g.battingSide();
      const bat = g.batter();
      const pit = g.pitcher();
      const slot = (g.order[bs] || [])[g.bi[bs]];
      const ph = !!(slot && slot.pos === "PH");
      const pos = ph ? "PH" : g.batterPos();
      const ord = g.bi[bs] + 1;
      const first = !this.cardSeen[bat.id];
      const showCard = lv >= 2 || first || ph;
      this.cardSeen[bat.id] = 1;
      this.lastPit[g.fieldingSide()] = pit.id;
      const call = (ph ? "代打 " : ord + "番 " + (TV().POS_PA[pos] || "") + " ") + bat.name;
      const dur = showCard ? (lv >= 2 ? 2.6 : 2.0) : lv >= 2 ? 1.8 : 1.3;
      const side = P.batSide(bat, pit) === "L" ? "l" : "r";
      this.runCue({
        name: "walkup",
        dur,
        steps: [
          [
            0,
            () => {
              A.pa(call, ph);
              this.tv.pa(call + (first && bat.num != null ? "　背番号 " + bat.num : ""), dur * 1000 + 700);
            },
          ],
          [0.1, () => this.tv.batter()],
          [0.2, () => this.chanceCheck(showCard)],
          [0.3, () => showCard && this.tv.card(bat, g.teams[bs], { side, home: bs === "home", kind: "bat", tag: ph ? "代打" : ord + "番 " + (D.POS_JP[pos] || "") })],
        ],
        skip: () => {
          this.tv.hide("pa");
          this.tv.hide("card");
        },
        end: () => this.nextPitch(),
      });
    }

    // 得点圏に走者が出たら「チャンス！」(その回で 1 度)
    chanceCheck(cardShown) {
      const g = this.g;
      if (this.fxLv() < 1 || !g.ctx(null).risp) return;
      const key = g.inning + (g.top ? "t" : "b");
      if (this.chanceKey === key) return;
      this.chanceKey = key;
      const t = g.teams[g.battingSide()];
      const col = teamCols(t)[0];
      this.tv.later("chance", cardShown ? 1900 : 150, () => {
        this.tv.call("チャンス！", "chance", { color: col, ms: 1300 });
        this.kai("chance");
      });
    }

    // CPU が投げるまでの間合い: 場面で散らす (勝負どころは長く。打者がユーザーなら 1.6 秒まで)
    pitchDelay() {
      const g = this.g;
      const base = this.userBat() ? 0.9 : 0.6;
      if (this.fxLv() < 1 || this.speed > 1) return base;
      const c = g.ctx(null);
      let d = base + Math.random() * 0.3;
      if (c.runnersOn) d += 0.25;
      if (c.clutchSpot || (g.inning >= 7 && c.risp && Math.abs(g.leadOf(g.battingSide())) <= 2)) d += 0.6;
      if (g.balls === 3 && g.strikes === 2) d += 0.3;
      if (g.balls === 0 && g.strikes === 0) d += 0.15;
      return Math.min(this.userBat() ? 1.6 : 2.2, d);
    }

    nextPitch() {
      // タイム中の投手交代は、次の投球の前に紹介する
      if (this.pendChange && !this.derby) {
        const d = this.pendChange;
        this.pendChange = null;
        this.pitcherCue(d.p, d.side, "change", () => this.nextPitch(), d.old);
        return;
      }
      this.readyT = this.pitchDelay();
      this.sw = null;
      this.pc = null;
      this.swingT = null;
      this.stealReq = null;
      this.cpuSteal = null;
      this.updateHUD();
      this.enter("ready");
      if (!this.userBat() && !this.derby) {
        this.cpuSteal = this.g.paBunt ? null : AI.wantSteal(this.g);
      }
      if (this.g.paBunt && !this.userBat()) this.cpuBuntStance = true;
    }

    startWindup() {
      const g = this.g;
      const pit = g.pitcher();
      const st = g.pstate[g.fieldingSide()];
      let type;
      let aim;
      if (this.userPitch()) {
        type = this.selPitch;
        aim = { x: this.aim.x, z: this.aim.z };
        const ctx = g.ctx(null);
        this.pc = P.make(pit, type, aim, st, ctx);
      } else {
        if (this.derby) {
          const lv = this.opt.derby.level || "normal";
          type = lv === "hard" && Math.random() < 0.35 ? (P.arsenal(pit)[1] || { t: "FB" }).t : "FB";
          aim = { x: U.rand(-0.15, 0.15), z: U.rand(0.55, 0.95) };
          this.pc = P.make(pit, type, aim, st, { noError: lv === "easy" });
        } else {
          const ctx = g.ctx("cpuPitch");
          const ch = AI.choosePitch(pit, ctx);
          this.pc = P.make(pit, ch.type, ch.aim, st, ctx);
        }
      }
      g.pitchThrown(this.pc);
      // CPU 打者の判断
      if (!this.userBat()) {
        const bctx = g.ctx("cpuBat");
        if (this.cpuSteal && this.cpuSteal[1] && Math.random() < 0.25) bctx.hitAndRun = true;
        this.sw = g.paBunt ? AI.buntAim(this.pc) : AI.decideSwing(this.pc, g.batter(), pit, bctx);
        if (!this.sw.swing) this.sw = null;
      }
      this.steal = this.userBat() ? this.stealReq : this.cpuSteal;
      if (this.steal) this.stealStarted = false;
      this.enter("windup");
    }

    doSwing() {
      this.sw = { swing: true, t: this.pT, cx: this.cur.x, cz: this.cur.z, user: true };
      this.swingT = 0;
      A.swing();
      this.buzz(15);
    }

    resolvePitch() {
      const g = this.g;
      const pc = this.pc;
      let sw = this.sw;
      if (this.userBat() && this.bunt) sw = { swing: true, bunt: true, cx: this.cur.x, cz: this.cur.z, t: 0 };
      const jr = g.judge(pc, sw);
      jr.pc = pc;
      this.jr = jr;
      this.swUsed = sw;
      this.lastPitch = pc;
      this.tv.pitch(pc);
      if (this.derby) return this.resolveDerby(jr);
      const T = TV();
      const vars = { pit: g.pitcher().name, bat: g.batter().name };
      if (jr.call === "inplay") {
        const strong = jr.res.ev > 40 && jr.res.la > 15 && jr.res.la < 40;
        const play = g.makeBattedPlay(jr, sw, this.steal);
        A.hit2(U.clamp((jr.res.ev - 20) / 28, 0.2, 1), play.hr);
        this.buzz(strong ? 60 : 30);
        const bp = R.cams.bat.p(jr.res.bx, 0.3, jr.res.bz);
        if (bp) R.burst(bp.x, bp.y, "#fff3b0", strong ? 26 : 14, strong ? 260 : 160);
        // 本塁打でも、入ったかどうかはフェンスを越えるまで言わない
        const key = sw && sw.bunt ? null : play.hr ? "hrGo" : strong ? "hitStrong" : jr.res.la > 45 ? "hitFly" : jr.res.la < -5 ? "hitGround" : "hit";
        this.say(key ? T.talk(key, vars) : "バント！", strong || play.hr ? "hot" : "");
        this.startPlay(play, "batted");
        return;
      }
      if (jr.call === "foul") {
        A.tip();
        const fp = g.makeFoulPlay(jr);
        if (fp) {
          this.say("ファウルフライ！捕れるか！？");
          this.startPlay(fp, "foul");
          return;
        }
        this.foulBall = jr.res && !jr.res.tip ? F.newBall([jr.res.bx || 0, 0.4, jr.res.bz || 0.8], P.battedBall(jr.res).v) : null;
        this.say(T.talk("foul", vars));
        this.callShow("foul");
        return;
      }
      if (jr.call === "strike") {
        A.mitt();
        if (g.strikes === 2) this.kMoment(jr);
        else if (g.strikes === 1 && Math.random() < 0.5) this.say(T.talk("twoK", vars));
        else if (jr.swinging) this.say(T.talk("swing", vars));
        else this.say(T.talk(g.balls === 0 && g.strikes === 0 && Math.random() < 0.5 ? "strikeFirst" : "strike", vars));
      } else if (jr.call === "ball") {
        A.mitt();
        this.say(g.balls === 3 ? T.talk("bb", vars) : g.balls === 2 && g.strikes === 2 ? T.talk("full", vars) : T.talk("ball", vars));
      } else if (jr.call === "hbp") {
        A.mitt();
        this.say(T.talk("hbp", vars), "hot");
      }
      this.callShow(jr.call);
    }

    // 三振の瞬間: ズバッ + 審判の声 + 「空振り三振」の帯 + この投手の K ボード
    kMoment(jr) {
      const g = this.g;
      const pit = g.pitcher();
      const bat = g.batter();
      const sw = !!jr.swinging;
      const lv = this.fxLv();
      const list = (this.kLog[pit.id] = this.kLog[pit.id] || []);
      list.push(sw ? "S" : "L");
      this.say(TV().talk(sw ? "kSwing" : "kLook", { pit: pit.name }), "hot");
      this.kai("k", { pit: pit.name });
      A.k(g.fieldingSide() === "home" ? 0.8 : 0.45);
      if (lv >= 1) A.umpire("strike");
      this.tv.call(sw ? "空振り三振" : "見逃し三振", "k", { ms: 1500 });
      if (lv >= 1) this.tv.kBoard(pit, list, P.batSide(bat, pit) === "L" ? "l" : "r");
      if (this.userPitch()) this.buzz([20, 30, 20]);
      else if (this.userBat() && sw) this.buzz([10, 20, 10]);
    }

    callShow(call) {
      this.pendingCall = call;
      this.enter("call");
    }

    applyPendingCall() {
      const g = this.g;
      const jr = this.jr;
      const key0 = this.paKey();
      const runners = !!(g.bases[1] || g.bases[2] || g.bases[3]);
      const out = g.applyCall(jr);
      // 三振は判定の瞬間 (kMoment) に済ませている。スリーバント失敗だけここで
      if (out === "k" && jr.call === "foul") {
        this.tv.call("スリーバント失敗", "k", { ms: 1300 });
        A.out();
      } else if (out === "walk") {
        this.tv.call("フォアボール", "info", { ms: 1200 });
        if (runners) this.kai("bb");
      } else if (out === "hbp") {
        this.tv.call("デッドボール", "info", { ms: 1200 });
        A.groan();
      }
      this.updateHUD();
      // 盗塁
      if (this.steal && !out && !g.over && this.paKey() === key0 && g.outs < 3) {
        const anyLeft = Object.keys(this.steal).some((k) => g.bases[k]);
        if (anyLeft) {
          this.startPlay(g.makeStealPlay(this.steal, this.pc), "steal");
          return;
        }
      }
      this.afterApply(key0);
    }

    paKey() {
      const g = this.g;
      return g.inning + (g.top ? "t" : "b") + g.bi[g.battingSide()] + "/" + g.outs;
    }

    afterApply(key0) {
      const g = this.g;
      this.updateHUD();
      if (g.over) return this.finish();
      // 点が入ったら中継風の得点テロップ
      if (this.mode === "game" && !this.derby && g.scoreLog.length > this.tv.scoreSeen) {
        this.tv.scoreSeen = g.scoreLog.length;
        this.tvKey = key0;
        this.enter("tvscore");
        this.tv.scoreBoard("score");
        return;
      }
      this.afterTV(key0);
    }

    afterTV(key0) {
      const g = this.g;
      if (this.mode === "mini" && this.paKey().split("/")[0] !== key0.split("/")[0]) {
        this.paCount++;
        const ev = this.lastPAEv;
        this.lastPAEv = null;
        if (this.opt.mini.onPA) this.opt.mini.onPA(ev && ev.res, g, ev);
        this.halfChanged = false;
        if (this.paCount >= this.opt.mini.maxPA || this.opt.mini.done) return this.finish();
        return this.startPA();
      }
      if (this.halfChanged) {
        this.halfChanged = false;
        this.enter("change");
        A.chime();
        A.chant(false);
        this.showChange();
        return;
      }
      if (this.paKey().split("/")[0] !== key0.split("/")[0]) this.startPA();
      else this.nextPitch();
    }

    showChange() {
      const g = this.g;
      ["l3", "call", "k", "card", "pa"].forEach((k) => this.tv.hide(k));
      const n = this.tv.inningBoard();
      // 下のテロップ (その回の得点・話題) を流すぶん少し長めに
      this.changeT = n ? Math.min(5.2, 0.6 + 2.3 * Math.min(3, n)) : 2.4;
      if (this.fxLv() < 1 || this.mode !== "game") return;
      // ラッキー 7: 7 回表はビジター、7 回裏はホームの応援歌とジェット風船
      const k = g.inning + (g.top ? "t" : "b");
      if (g.inning === 7 && !this.l7[k]) {
        this.l7[k] = 1;
        const t = g.teams[g.battingSide()];
        this.tv.later("l7", 2500, () => {
          if (this.state !== "change") return;
          this.tv.hide("center");
          this.tv.lucky7(t);
          A.chant(false);
          A.anthem(t.id);
          A.balloons();
          R.balloons(teamCols(t), this.fxLv() >= 2 ? 90 : 60);
          if (g.isUser(g.battingSide())) this.buzz([8, 8, 8, 8, 8, 8]);
        });
        this.changeT = Math.max(this.changeT, 5.6);
      }
      // 次の回の打者のカードの絵を、止まっている今のうちに用意しておく
      const bs = g.battingSide();
      const ord = g.order[bs] || [];
      for (let i = 0; i < 2 && ord.length; i++) {
        const e = ord[(g.bi[bs] + i) % ord.length];
        const p = e && g.P(e.id);
        if (p && !this.cardSeen[p.id]) this.tv.prefetch(p, g.teams[bs], { home: bs === "home", kind: "bat" });
      }
    }

    /* ---------- インプレー ---------- */
    startPlay(play, kind) {
      this.play = play;
      if (this.tv) ["l3", "k", "card", "pa"].forEach((k) => this.tv.hide(k));
      this.playKind = kind;
      this.evIdx = 0;
      this.skipPlay = false;
      this.camDir = 1;
      this.hrFx = null;
      // 本塁打: ボールがフェンスを越える時刻 (予測の軌道で最初に hr が立つ所)
      if (play.hr && play.pred && kind !== "derby") {
        const s = play.pred.samples.find((x) => x.hr);
        this.hrFx = { at: s ? s.t : 0, stage: 0, shown: false };
      }
      this.enter("inplay");
      if (kind === "steal") this.say(TV().talk("steal"));
      A.chant(false);
    }

    stepPlay(dt) {
      const play = this.play;
      if (this.skipPlay) {
        let n = 0;
        while (!play.done && n++ < 5000) play.step(1 / 60);
        if (!play.done) play.finish();
      } else {
        // 本塁打の帯を出したあとのダイヤモンド一周は少し速く (演出が少ないほど速く)
        const h = this.hrFx;
        const mul = h && h.shown && play.t > h.at + 1.2 ? [2.5, 1.7, 1][this.fxLv()] : 1;
        this.acc = (this.acc || 0) + dt * this.speed * mul;
        let n = 0;
        while (this.acc >= 1 / 60 && n++ < 60 && !play.done) {
          play.step(1 / 60);
          this.acc -= 1 / 60;
        }
      }
      this.hrTick();
      this.processEvents();
      if (play.done && this.playKind !== "derby") {
        this.processEvents();
        this.onPlayDone();
      }
    }

    // 本塁打の実況と帯: 打った瞬間「大きい！」→ 外野の奥で「入るか！？」→ フェンスを越えた瞬間に帯・花火 → 飛距離
    hrTick() {
      const h = this.hrFx;
      const play = this.play;
      if (!h || !play || this.skipPlay) return;
      const b = play.ball;
      if (h.stage === 0) {
        if (play.t >= h.at) h.stage = 1;
        else if (b && b.x != null && h.at - play.t > 0.5 && Math.hypot(b.x, b.y) > 0.75 * F.fenceDist(F.angle(b.x, b.y))) {
          h.stage = 1;
          this.say(TV().talk("hrMaybe"), "hot");
        }
      }
      if (h.stage === 1 && play.t >= h.at) {
        h.stage = 2;
        this.hrCleared();
      }
      if (h.stage === 2 && play.t >= h.at + 2.9) {
        h.stage = 3;
        if (this.fxLv() >= 1 && h.dist) this.tv.dist(h.dist, h.where);
      }
    }

    hrCleared() {
      const g = this.g;
      const play = this.play;
      const h = this.hrFx;
      h.shown = true;
      const bat = g.batter();
      const bs = g.battingSide();
      const season = this.opt.season;
      const no = season ? ((season[bat.id] || {}).hr || 0) + ((g.box[bat.id] || {}).hr || 0) + 1 : 0;
      let extra = "";
      if (g.hrRun > 0) extra = g.hrRun + 1 + "者連続";
      else if (g.paN && g.paN[bs] === 0) extra = "先頭打者";
      this.say(TV().talk("hrIn", { bat: bat.name, n: no || "" }), "hot");
      this.kai("hr");
      this.tv.homeRun({ runs: play.runners.length, type: "HR" }, bat, extra);
      A.fanfare();
      this.roar(1, 3, bs);
      const cols = teamCols(g.teams[bs]);
      const nf = this.fxLv() >= 1 ? 6 : 3;
      for (let i = 0; i < nf; i++) setTimeout(() => !this.dead && R.firework(cols), 150 + i * 320);
      if (this.userBat() || this.userPitch()) this.buzz([40, 60, 40, 120]);
      // 推定飛距離と方向
      if (play.o && play.o.ball) h.dist = Math.round(F.carry(play.o.ball.p, play.o.ball.v));
      const phi = play.launch ? play.launch.phi : 0;
      h.where = phi < -28 ? "レフトポール際" : phi < -14 ? "レフトスタンド" : phi < -5 ? "左中間スタンド" : phi <= 5 ? "バックスクリーン" : phi <= 14 ? "右中間スタンド" : phi <= 28 ? "ライトスタンド" : "ライトポール際";
    }

    // 好守備の判定: ダイビング・ジャンプ (捕球の高さ)・フェンス際・内野の強いライナー
    finePlay(e) {
      const play = this.play;
      const ic = play.icpt || {};
      if (!play.pred) return null;
      const s = F.sampleAt(play.pred, play.t);
      const r = Math.hypot(s.x, s.y);
      if (ic.dive) return "dive";
      if (!ic.air) return null;
      if (s.z > 2.25) return "jump";
      if (r > F.fenceDist(F.angle(s.x, s.y)) - 5) return "wall";
      const L = play.launch;
      if (L && L.la < 20 && L.ev > 40 && ["P", "1B", "2B", "3B", "SS"].indexOf(e.pos) >= 0) return "fine";
      return null;
    }

    // きわどいアウト・セーフ (走者が塁に着くのと送球の差が 0.3 秒以内)。盗塁はいつも
    closePlay(e) {
      const play = this.play;
      const b = e.base;
      if (!play || !b || b < 1) return false;
      if (this.playKind === "steal") return true;
      if (this.playKind !== "batted") return false;
      if (e.type === "out") {
        if (e.how !== "force" && e.how !== "tag") return false;
        const r = play.runners.find((x) => x.p.name === e.runner && x.state === "out");
        if (!r) return false;
        if (r.from + 1 === b) return (F.BASE_DIST - r.d) / Math.max(1, r.speed || 7) < 0.3;
        const f = play.fielders.find((x) => x.hasBall && x.onBase === b);
        return !!(f && f.act && f.act.k === "catch" && play.t - f.act.t < 0.3);
      }
      const bl = play.ball;
      return !!(bl && bl.mode === "thrown" && bl.base === b && bl.t0 + bl.T - play.t < 0.3);
    }
    stamp(e, out) {
      const g = this.g;
      this.tv.call(BASE_JP[e.base] + (out ? (e.how === "tag" ? " タッチアウト" : " アウト") : " セーフ"), out ? "out" : "safe", { stamp: out ? "OUT" : "SAFE", ms: 1300, hold: 900 });
      if (this.fxLv() >= 1) A.umpire(out ? "out" : "safe");
      this.roar(0.6, 1.2, out ? g.fieldingSide() : g.battingSide());
      if (this.userBat()) this.buzz(out ? 10 : 25);
    }

    processEvents() {
      const evs = this.play.events;
      while (this.evIdx < evs.length) {
        const e = evs[this.evIdx++];
        if (this.skipPlay && e.type !== "end") continue;
        switch (e.type) {
          case "hr":
            // 実況は hrTick (ボールの位置) で
            break;
          case "catch": {
            A.catchBall();
            const fine = this.finePlay(e);
            if (fine) {
              this.say(TV().talk(fine), "hot");
              if (this.fxLv() >= 1 || fine === "dive") {
                this.tv.call("ファインプレー！", "fine", { ms: 1400, hold: 900 });
                this.roar(0.9, 1.4, this.g.fieldingSide());
                this.kai("fine");
              }
              if (this.userPitch()) this.buzz([15, 40]);
            } else this.say(Talk.POS[e.pos] + "、捕りました！");
            break;
          }
          case "field":
            A.catchBall();
            break;
          case "divemiss":
            this.say("飛びついたが届かない！");
            break;
          case "error":
            this.say(Talk.POS[e.pos] + (e.kind === "throw" ? "、悪送球！" : "、ボールをはじいた！"), "hot");
            break;
          case "throw":
            A.throwBall();
            break;
          case "out":
            A.out();
            if (e.how === "force" || e.how === "tag") this.say(e.base === 4 ? "ホームタッチアウト！" : "アウト！");
            if (e.how === "doubled") this.say("戻れない！ダブルプレー！");
            if (this.closePlay(e)) this.stamp(e, true);
            break;
          case "safe":
            if (this.closePlay(e)) this.stamp(e, false);
            break;
          case "score":
            this.say(TV().talk("score", { runner: e.runner }), "hot");
            A.cheer(0.6, 1.2);
            if (this.closePlay(Object.assign({ base: 4 }, e))) this.stamp({ base: 4 }, false);
            if (this.userBat()) this.buzz([30, 30, 30]);
            break;
          case "land":
            if (this.playKind === "batted" && !this.play.firstTouch) {
              const r = Math.hypot(e.x, e.y);
              if (r > 30) this.say(r > 85 ? "外野の頭を越えた！" : "落ちたー！ヒット性の当たり！");
            }
            break;
          case "fence":
            this.say("フェンス直撃！！", "hot");
            break;
          case "tagup":
            this.say("タッチアップ！");
            break;
        }
      }
    }

    onPlayDone() {
      const res = this.play.result;
      const g = this.g;
      this.enter("result");
      this.resultT = 1.5;
      // 結果は打球や走者を隠さない右下の小さな帯で (大きな文字はホームラン・サヨナラだけ)
      if (this.playKind === "steal") {
        const s = res.steals[0];
        this.tv.call(s && s.ok ? "盗塁成功" : "盗塁失敗", s && s.ok ? "safe" : "out", { ms: 1300 });
        return;
      }
      if (this.playKind === "foul") {
        if (res.type === "FFO") this.tv.call("ファウルフライ", "out", { ms: 1200 });
        return;
      }
      const desc = Talk.desc(res);
      const walkoff = !g.top && g.inning >= g.innings && g.score.home + res.runs > g.score.away && g.score.home <= g.score.away && res.runs > 0;
      const bs = g.battingSide();
      const fs = g.fieldingSide();
      if (res.type === "HR" || res.type === "IPHR") {
        if (this.hrFx && this.hrFx.shown) this.resultT = 0.9; // 帯と花火はフェンスを越えたときに出した
        else {
          A.fanfare();
          const cols = teamCols(g.teams[bs]);
          for (let i = 0; i < 6; i++) setTimeout(() => !this.dead && R.firework(cols), 200 + i * 320);
          this.tv.homeRun(res, g.batter());
          this.resultT = 2.6;
        }
      } else if (walkoff) {
        // 結果の帯は出さず、サヨナラの帯で
      } else if (["H1", "H2", "H3"].indexOf(res.type) >= 0) {
        this.roar(res.type === "H1" ? 0.6 : 0.9, 1.6, bs);
        this.tv.call(desc, "hit", { ms: 1400 });
        if (res.runs) this.kai("score");
        else this.kai("hit");
      } else if (res.type === "E" || res.type === "FC") {
        this.tv.call(desc, "info", { ms: 1400 });
      } else {
        if (res.type === "DP" || res.type === "DPF" || res.type === "TP") {
          this.roar(0.8, 1.2, fs);
          this.kai("dp");
        }
        this.tv.call(desc, "out", { ms: 1300 });
      }
      if (walkoff) this.walkoffMoment(res);
    }

    // サヨナラ: 赤い帯 + 大歓声 (+ 紙吹雪)
    walkoffMoment(res) {
      const g = this.g;
      const bat = g.batter();
      this.walkoffBy = bat.id;
      const t = res.type;
      const what = t === "HR" || t === "IPHR" ? "サヨナラホームラン" : t === "H1" || t === "H2" || t === "H3" ? "サヨナラタイムリー" : t === "SF" ? "サヨナラ犠牲フライ" : "サヨナラ勝ち";
      this.tv.walkoff(bat, what);
      this.say(bat.name + "、" + what + "！", "hot");
      this.roar(1, 4, "home");
      A.cheer(1, 3);
      if (this.fxLv() >= 1) R.confetti(teamCols(g.teams.home), this.fxLv() >= 2 ? 160 : 110);
      if (g.isUser("home")) this.buzz([60, 40, 60, 40, 200]);
      this.resultT = 3.0;
    }

    applyPlayResult() {
      const g = this.g;
      const res = this.play.result;
      const key0 = this.paKey();
      if (this.playKind === "steal") g.applySteal(res);
      else if (this.playKind === "foul") {
        if (res.type === "FFO") {
          res.batterOut = true;
          res.bases = g.bases;
          res.scorers = [];
          res.runs = 0;
          g.applyPlay(res);
        } else g.applyCall(this.jr);
      } else g.applyPlay(res);
      this.play = null;
      this.camBlend = 0;
      this.camDir = 0;
      R.bg = {};
      this.afterApply(key0);
    }

    /* ---------- ホームラン競争 ---------- */
    resolveDerby(jr) {
      const d = this.derby;
      if (jr.call === "inplay") {
        const play = this.g.makeBattedPlay(jr, this.swUsed, null);
        A.hit2(U.clamp((jr.res.ev - 20) / 28, 0.2, 1), play.hr);
        if (play.hr) this.buzz([40, 60, 40, 120]);
        this.startPlay(play, "derby");
        return;
      }
      if (jr.call === "ball" || jr.call === "hbp") {
        A.mitt();
        this.say("ボール球、見送り");
        this.derbyNext(false, 0, "見送り");
        return;
      }
      A.mitt();
      this.say(jr.call === "foul" ? "ファウル！ アウト" : jr.swinging ? "空振り！ アウト" : "見逃し！ アウト");
      this.derbyNext(true, 0, jr.call === "foul" ? "ファウル" : "空振り");
      void d;
    }

    derbyNext(out, dist, label) {
      const d = this.derby;
      if (out) d.outs++;
      d.log.push({ out, dist, label });
      this.updateHUD();
      this.pendingCall = "derby";
      this.enter("call");
    }

    derbyPlayDone() {
      const play = this.play;
      const d = this.derby;
      const pr = play.pred;
      const hr = pr && pr.info.hr;
      // 飛距離 = フェンスが無かった場合に地面に落ちる地点までの距離
      const dist = Math.round(F.carry(play.o.ball.p, play.o.ball.v));
      if (hr) {
        d.hr++;
        d.best = Math.max(d.best, dist);
        d.total += dist;
        A.fanfare();
        for (let i = 0; i < 3; i++) setTimeout(() => R.firework(), 150 + i * 300);
        this.banner('<span class="hr-t">ホームラン</span><small>飛距離 ' + dist + "m</small>", "hr", 1800);
        d.log.push({ out: false, dist, label: "HR" });
      } else {
        d.outs++;
        this.banner("アウト<small>" + (dist > 20 ? dist + "m" : "") + "</small>", "out", 1000);
        d.log.push({ out: true, dist, label: "アウト" });
      }
      this.play = null;
      this.camBlend = 0;
      this.camDir = 0;
      this.updateHUD();
      this.pendingCall = "derby";
      this.enter("call");
      this.t = -0.6;
    }

    /* ---------- タイム ---------- */
    pause() {
      if (this.state === "inplay" || this.state === "result" || this.finished) return;
      this.paused = true;
      const g = this.g;
      const canPitch = this.userPitch() && !this.derby && this.state !== "pitch" && this.state !== "windup";
      const canPH = this.userBat() && !this.derby && this.mode === "game" && (this.state === "ready" || this.state === "paIntro") && g.balls === 0 && g.strikes === 0;
      const html =
        '<h3 class="modal-title">タイム</h3><div class="col-btns">' +
        (canPitch ? '<button class="btn" data-act="pchange">投手交代</button>' : "") +
        (canPH ? '<button class="btn" data-act="ph">代打</button>' : "") +
        '<button class="btn" data-act="sound">' +
        (A.enabled ? "音を消す" : "音を出す") +
        "</button>" +
        '<button class="btn" data-act="boxscore">スコアを見る</button>' +
        '<button class="btn red" data-act="quit">' +
        (this.derby ? "競争をやめる" : "試合をやめる") +
        "</button>" +
        '<button class="btn primary" data-act="close">試合に戻る</button></div>';
      UI.modal(html, {
        onClose: () => {
          this.paused = false;
        },
        onAct: (act) => {
          if (act === "close") UI.closeModal();
          else if (act === "sound") {
            A.enabled = !A.enabled;
            this.S.sound = A.enabled;
            Store.save();
            A.ambient(A.enabled);
            UI.closeModal();
          } else if (act === "pchange") this.pitcherMenu();
          else if (act === "ph") this.pinchMenu();
          else if (act === "boxscore") this.boxModal();
          else if (act === "quit")
            UI.confirm(
              "試合を終了してタイトルに戻りますか？（この試合の記録は残りません）",
              () => {
                this.quit = true;
                this.destroy();
                if (this.opt.onQuit) this.opt.onQuit();
              },
              { yes: "やめる", danger: true, onNo: () => (this.paused = false) }
            );
        },
      });
    }

    pitcherMenu() {
      const g = this.g;
      const side = g.fieldingSide();
      const list = g.bullpenAvailable(side);
      const html =
        '<h3 class="modal-title">投手交代</h3><div class="plist">' +
        list
          .map((id) => {
            const p = g.P(id);
            const role = p.role === "CL" ? "抑" : p.role === "RP" ? "中" : "先";
            return '<button class="prow" data-act="pick" data-arg="' + id + '"><span class="role">' + role + "</span><b>" + esc(p.name) + "</b>" + UI.compactAb(p) + '<span class="pchs">' + (p.pitches || []).map((x) => D.PITCHES[x.t].short + x.lv).join(" ") + "</span></button>";
          })
          .join("") +
        '</div><div class="row-btns"><button class="btn ghost" data-act="close">やめる</button></div>';
      UI.modal(html, {
        cls: "wide",
        onClose: () => (this.paused = false),
        onAct: (act, arg) => {
          if (act === "pick") {
            g.changePitcher(side, arg);
            this.updateHUD();
            this.updateControls();
            this.selPitch = "FB";
          }
          UI.closeModal();
        },
      });
    }

    pinchMenu() {
      const g = this.g;
      const side = g.battingSide();
      const list = g.benchAvailable(side);
      const html =
        '<h3 class="modal-title">代打</h3><div class="plist">' +
        (list.length
          ? list
              .map((id) => {
                const p = g.P(id);
                return '<button class="prow" data-act="pick" data-arg="' + id + '"><span class="role">' + D.POS_JP[p.pos] + "</span><b>" + esc(p.name) + "</b>" + UI.compactAb(p) + "</button>";
              })
              .join("")
          : '<p class="muted">出場できる控え選手がいません</p>') +
        '</div><div class="row-btns"><button class="btn ghost" data-act="close">やめる</button></div>';
      UI.modal(html, {
        cls: "wide",
        onClose: () => (this.paused = false),
        onAct: (act, arg) => {
          if (act === "pick") {
            g.pinchHit(arg);
            this.updateHUD();
          }
          UI.closeModal();
        },
      });
    }

    boxModal() {
      UI.modal(PB.Screens.boxScoreHTML(this.g) + '<div class="row-btns"><button class="btn primary" data-act="close">とじる</button></div>', {
        cls: "wide",
        onClose: () => (this.paused = false),
        onAct: () => UI.closeModal(),
      });
    }

    finish() {
      if (this.finished) return;
      this.finished = true;
      A.chant(false);
      const done = () => {
        // 試合終了の演出中に「やめる」を選んだときは記録しない
        if (this.quit || this.dead) return;
        this.destroy();
        if (this.opt.onEnd) this.opt.onEnd(this);
      };
      if (this.derby || this.mode !== "game") {
        setTimeout(done, this.derby ? 1200 : 1600);
        return;
      }
      // 試合終了: 最終スコア → 勝利投手・ヒーロー → ヒーローインタビュー (どれもタップで次へ)
      const g = this.g;
      const r = g.result || {};
      const lv = this.fxLv();
      ["l3", "tick", "call", "k", "card", "pa", "dist"].forEach((k) => this.tv.hide(k));
      const user = g.user === "home" || g.user === "away" ? g.user : null;
      const won = !!(user && r.winner === user);
      const lost = !!(user && r.winner && r.winner !== user);
      const heroId = r.winner ? (r.walkoff && this.walkoffBy ? this.walkoffBy : PB.Screens && PB.Screens.mvp ? PB.Screens.mvp(g, r.winner) : null) : null;
      const cues = [];
      cues.push({
        name: "final",
        cine: true,
        dur: 3.0,
        steps: [
          [
            0,
            () => {
              this.tv.scoreBoard("final");
              if (r.winner) this.roar(0.9, 3, r.winner);
              if (lv >= 1 && r.winner && !lost) {
                A.winSong(g.teams[r.winner].id);
                this.jingled = true;
              } else if (lv >= 1 && lost) {
                A.lose();
                this.jingled = true;
              }
              if (won) this.buzz([50, 50, 50, 50, 300]);
              if (lv >= 1 && r.winner && (won || (!user && !r.walkoff))) R.confetti(teamCols(g.teams[r.winner]), 90);
            },
          ],
        ],
        skip: () => this.tv.hide("center"),
      });
      if (lv >= 1 && r.winner) {
        const hl = heroId ? this.heroLine(heroId) : "";
        cues.push({ name: "wl", cine: true, dur: 3.2, steps: [[0, () => (this.tv.hide("center"), this.tv.winLoss({ hero: heroId, heroLine: hl }))]], skip: () => this.tv.hide("wl") });
      }
      // ヒーローインタビュー: 多めは勝てば毎回、標準はサヨナラと自分のチームが勝ったとき
      if (heroId && (lv >= 2 || (lv >= 1 && (r.walkoff || won)))) {
        cues.push({
          name: "hero",
          cine: true,
          dur: 9.4,
          steps: [
            [0, () => (this.tv.hide("wl"), this.heroInterview(heroId, r.winner, !!r.walkoff))],
            [0.4, () => this.roar(0.5, 2, r.winner)],
            [8.3, () => this.roar(0.8, 1.8, r.winner)],
          ],
          skip: () => this.tv.hide("hero"),
        });
      }
      this.runSeq(cues, done);
    }

    // 今日の成績のひと言 (ヒーロー・勝利投手の帯)
    heroLine(id) {
      const g = this.g;
      const p = g.P(id);
      const s = g.box[id] || {};
      if (p.pos === "P" && (s.outs || s.np)) return U.fmtIP(s.outs || 0) + "回 " + (s.pk || 0) + "奪三振 " + (s.pr || 0) + "失点";
      return (s.ab || 0) + "打数" + (s.h || 0) + "安打" + (s.hr ? " " + s.hr + "本塁打" : "") + (s.rbi ? " " + s.rbi + "打点" : "");
    }

    heroInterview(id, side, walkoff) {
      const g = this.g;
      const p = g.P(id);
      const s = g.box[id] || {};
      const r = g.result || {};
      const isP = p.pos === "P" && (s.outs || s.np);
      const kind = walkoff ? "walkoff" : isP ? (r.S === id ? "save" : "pit") : s.hr ? "hr" : "hit";
      const chips = isP ? [U.fmtIP(s.outs || 0) + "回", (s.pk || 0) + "奪三振", (s.pr || 0) + "失点"] : [(s.ab || 0) + "打数" + (s.h || 0) + "安打"].concat(s.hr ? [s.hr + "本塁打"] : [], s.rbi ? [s.rbi + "打点"] : []);
      if (r.W === id) chips.push("勝利投手");
      if (r.S === id) chips.push("セーブ");
      const home = PB.TV.teamOf(g.teams.home);
      const last = side === "home" ? (home.stadium || "球場") + "のファンの皆さん、最高です！ありがとうございました！" : "遠くまで応援に来てくれたファンの皆さん、ありがとうございました！";
      this.tv.hero({ p, team: g.teams[side], home: side === "home", lines: this.tv.heroLines(kind, { h: s.h || 0, k: s.pk || 0 }), chips, last, ms: 9600 });
    }

    destroy() {
      A.chant(false);
      A.ambient(false);
      clearTimeout(this.kaiTimer);
      this.cue = null;
      this.dead = true;
      if (this.tv) this.tv.destroy();
      if (this.hud) {
        this.hud.hidden = true;
        this.hud.innerHTML = "";
        this.hud.onpointerdown = null;
      }
    }

    /* ---------- 更新 ---------- */
    update(dt) {
      if (this.dead || this.paused) return;
      this.time += dt;
      if (this.finished && this.state !== "cue") return;
      this.t += dt;
      const st = this.state;
      const g = this.g;
      if (st === "cue") {
        this.updateCue(dt);
      } else if (st === "intro") {
        if (!this.introShown) {
          // スタメン発表 (標準以上) → プレイボール
          if (!this.lineupDone && this.mode === "game" && this.fxLv() >= 1) {
            this.lineupDone = true;
            this.runCue(this.lineupCue());
            return;
          }
          this.introShown = true;
          const a = g.teams.away;
          const h = g.teams.home;
          if (this.derby) this.banner('<span class="chg">ホームラン競争</span><small>' + this.derby.maxOuts + "アウトまでに何本打てるか！</small>", "change", 1800);
          else if (this.mode === "game") this.tv.scoreBoard("open");
          else this.banner('<span class="vs">' + esc(a.name) + "<i>VS</i>" + esc(h.name) + "</span><small>" + esc(h.stadium || "") + "</small>", "change", 2000);
          A.cheer(0.5, 2);
        }
        // 球審の「プレイボール」
        if (!this.playCalled && this.t > 0.5 && this.mode === "game" && this.fxLv() >= 1) {
          this.playCalled = true;
          A.umpire("play");
          this.tv.pa("プレイボール！", 1900);
        }
        if (this.t > (this.mode === "game" && !this.derby ? 2.7 : 2.0)) {
          this.tv.hide("center");
          this.startPA();
        }
      } else if (st === "paIntro") {
        if (this.t > (this.paIntroT || 1.1)) this.nextPitch();
      } else if (st === "ready") {
        // タイムで代打・投手交代をしたら、その紹介から
        if (this.pendPH) {
          this.pendPH = false;
          this.walkupCue();
          return;
        }
        if (this.pendChange) {
          this.nextPitch();
          return;
        }
        if (!this.userPitch() && this.t > (this.readyT != null ? this.readyT : this.userBat() ? 0.9 : 0.6)) this.startWindup();
      } else if (st === "windup") {
        if (this.steal && !this.stealStarted && this.t > 0.3) {
          this.stealStarted = true;
          if (!this.userBat()) this.say("ランナー走った！");
        }
        if (this.t >= WINDUP * RELEASE) {
          this.enter("pitch");
          this.pT = 0;
          this.prevBall = null;
          A.throwBall();
        }
      } else if (st === "pitch") {
        const slow = this.userBat() ? g.level.slow || 1 : 1;
        this.pT += dt * slow;
        const pc = this.pc;
        // ミートアシスト
        if (this.userBat() && this.S.assist !== "off" && this.pT > pc.T * 0.4) {
          const k = this.S.assist === "strong" ? 2.4 : 1.0;
          const tz = pc.A[1] - 0.02;
          this.cur.x += (pc.A[0] - this.cur.x) * Math.min(1, k * dt);
          this.cur.z += (tz - this.cur.z) * Math.min(1, k * dt);
        }
        // ユーザーのスイング: ミートの瞬間のカーソル位置を使う
        if (this.sw && this.sw.user && !this.sw.locked && this.pT >= this.sw.t + P.SWING_LAG) {
          this.sw.cx = this.cur.x;
          this.sw.cz = this.cur.z;
          this.sw.locked = true;
        }
        // CPU のスイング
        if (this.sw && !this.sw.user && !this.sw.bunt && this.swingT == null && this.pT >= this.sw.t) {
          this.swingT = 0;
          A.swing();
        }
        if (this.swingT != null) this.swingT += dt * slow;
        let tr = pc.T + 0.04;
        if (this.sw && !this.sw.bunt) tr = Math.max(tr, this.sw.t + P.SWING_LAG + 0.01);
        if (this.pT >= tr) this.resolvePitch();
      } else if (st === "call") {
        if (this.swingT != null) this.swingT += dt;
        this.pT = (this.pT || 0) + dt;
        if (this.foulBall) F.stepBall(this.foulBall, dt);
        if (this.t > (this.pendingCall === "derby" ? 1.1 : 0.85)) {
          this.foulBall = null;
          if (this.pendingCall === "derby") {
            if (this.derby.outs >= this.derby.maxOuts) return this.finish();
            this.startPA();
            return;
          }
          this.applyPendingCall();
        }
      } else if (st === "inplay") {
        if (this.camBlend < 1) this.camBlend = Math.min(1, this.camBlend + dt / 0.55);
        if (this.camBlend > 0.25 || this.skipPlay) this.stepPlay(dt);
        if (this.playKind === "derby" && this.play && this.derbyCheck()) return this.derbyPlayDone();
      } else if (st === "result") {
        if (this.t > this.resultT) this.applyPlayResult();
      } else if (st === "change") {
        if (this.t > (this.changeT || 2.4)) {
          R.bg = {};
          this.tv.hide("center");
          this.startPA();
        }
      } else if (st === "tvscore") {
        if (this.t > 2.3) {
          this.tv.hide("center");
          this.tv.syncScore();
          this.afterTV(this.tvKey);
        }
      }
    }

    // スタメン発表: 両軍のカードが 1 枚ずつ返る (タップで飛ばせる)
    lineupCue() {
      const lv = this.fxLv();
      const dur = lv >= 2 ? 7.4 : 5.6;
      return {
        name: "lineup",
        cine: true,
        dur,
        steps: [
          [
            0,
            () => {
              A.paChime();
              A.cheer(0.4, 2);
              if (lv >= 2) setTimeout(() => A.say("本日のスターティングメンバーを発表いたします", 0.95), 760);
            },
          ],
          [0.1, () => this.tv.lineup({ title: this.opt.title, ms: dur * 1000 + 600 })],
          [dur - 0.45, () => this.tv.lineupOut()],
        ],
        skip: () => this.tv.hide("lu"),
        end: () => {
          this.tv.hide("lu");
          this.enter("intro");
        },
      };
    }

    derbyCheck() {
      const p = this.play;
      if (!p) return false;
      const b = p.ball;
      if (p.pred.info.hr) return p.t > p.pred.samples[p.pred.samples.length - 1].t - 0.6 || p.t > 4.5;
      if (p.firstTouch || p.done) return true;
      if (b.mode === "live" && !b.air && p.t > 0.4) return true;
      return p.t > 6;
    }

    /* ---------- 描画 ---------- */
    draw(ctx, dt) {
      if (this.dead) return;
      const V3 = PB.View3D;
      if (V3 && V3.active && !V3.lost) {
        const blend3 = U.smooth(this.camBlend);
        let cam3;
        if (blend3 <= 0.001) {
          cam3 = R.cams.bat;
          this.dyn = null;
        } else {
          const fc = this.dynCam(dt);
          cam3 = blend3 >= 0.999 ? fc : Cam.lerp(R.cams.bat, fc, blend3);
        }
        if (V3.renderMatch(this, cam3, dt, blend3)) {
          ctx.clearRect(0, 0, R.W, R.H);
          this.drawOverlay3D(ctx, cam3, dt, blend3);
          return;
        }
      }
      const g = this.g;
      const W = R.W;
      const H = R.H;
      const teams = this.teamsKey();
      const fieldTeam = g.teams[g.fieldingSide()];
      const batTeam = g.teams[g.battingSide()];
      const blend = U.smooth(this.camBlend);
      let cam;
      if (blend <= 0.001) {
        cam = R.cams.bat;
        ctx.drawImage(R.background("bat", cam, teams), 0, 0, W, H);
        this.dyn = null;
      } else {
        const fc = this.dynCam(dt);
        cam = blend >= 0.999 ? fc : Cam.lerp(R.cams.bat, fc, blend);
        R.drawBackground(ctx, cam, teams);
      }
      const fieldView = blend > 0.5;
      const ents = [];
      const mul = fieldView ? 1.0 + 1.5 * blend : 1;
      const play = this.play;
      // 野手
      if (play) {
        for (const f of play.fielders) {
          const moving = Math.hypot(f.vx, f.vy) > 0.3;
          let pose = moving ? "run" : f.hasBall ? "ready" : "ready";
          if (f.act && play.t - f.act.t < 0.35) pose = f.act.k === "throw" ? "throw" : f.act.k === "dive" ? "dive" : "catch";
          if (f.pos === "C" && !moving && !f.hasBall && play.kind === "batted" && play.t < 0.6) pose = "crouch";
          ents.push({ x: f.x, y: f.y, o: { team: fieldTeam, face: f.p.face, mark: fieldTeam.mark, view: R.viewFrom(cam, f.x, f.y, f.vx, f.vy), pose, phase: play.t * 14 + f.x, t: f.act ? play.t - f.act.t : 0, ball: f.hasBall, glove: f.p.throws === "L" ? "R" : "L", dir: f.vx >= 0 ? 1 : -1, num: f.p.num } });
        }
        for (const r of play.runners) {
          if (r.state === "scored" && play.t - (r.scoredAt || 0) > 1.2) continue;
          const moving = r.state === "run" || r.state === "return";
          const dirv = moving ? this.runnerDir(r) : [0, 0];
          ents.push({ x: r.x, y: r.y, o: { team: batTeam, face: r.p.face, mark: batTeam.mark, view: moving ? R.viewFrom(cam, r.x, r.y, dirv[0], dirv[1]) : "front", pose: moving && r.wait <= 0 ? "run" : r.state === "out" ? "stand" : "stand", phase: play.t * 15 + r.orig, alpha: r.state === "out" ? 0.55 : 1, num: r.p.num } });
        }
      } else {
        // 守備位置に立つ野手 (投手・捕手以外)
        const def = g.defense();
        const align = g.align(null);
        for (const pos of ["1B", "2B", "SS", "3B", "LF", "CF", "RF"]) {
          let h = PB.Play.HOME_POS[pos];
          if (align.holdRunner && pos === "1B") h = [17.6, 21.0];
          const p = def[pos];
          ents.push({ x: h[0], y: h[1], o: { team: fieldTeam, face: p.face, mark: fieldTeam.mark, view: "front", pose: "ready" } });
        }
        if (fieldView) ents.push({ x: 0, y: -1.1, o: { team: fieldTeam, face: def.C.face, view: "back", pose: "crouch" } });
        for (let b = 1; b <= 3; b++) {
          const r = g.bases[b];
          if (!r) continue;
          let off = this.state === "pitch" || this.state === "windup" ? 2.5 : 1.6;
          if (this.steal && this.steal[b] && (this.state === "pitch" || this.state === "call")) off = 3.5 + Math.min(14, (this.pT || 0) * 7.5);
          const a = F.BASES[b];
          const nb = F.BASES[b + 1];
          const L = Math.hypot(nb[0] - a[0], nb[1] - a[1]);
          const x = a[0] + ((nb[0] - a[0]) / L) * off;
          const y = a[1] + ((nb[1] - a[1]) / L) * off;
          ents.push({ x, y, o: { team: batTeam, face: r.face, view: "front", pose: this.steal && this.steal[b] && this.state === "pitch" ? "run" : "ready", phase: this.time * 15 } });
        }
      }
      // 投手 (打席視点)
      const pit = g.pitcher();
      if (!play) {
        let wt = 0;
        let pose = "stand";
        if (this.state === "windup") {
          wt = this.t / WINDUP;
          pose = "windup";
        } else if (this.state === "pitch" || this.state === "call") {
          wt = RELEASE + (this.pT || 0) / WINDUP;
          pose = "windup";
        }
        ents.push({ x: 0, y: 18.44, z: 0.25, o: { team: fieldTeam, face: pit.face, mark: fieldTeam.mark, view: "front", pose, t: wt, throwSide: pit.throws === "R" ? -1 : 1, glove: pit.throws === "R" ? "R" : "L" } });
      }
      // 描画 (遠い順)
      ents.forEach((e) => {
        const c = cam.toCam(e.x, e.y, 0);
        e.d = c[2];
      });
      ents.sort((a, b) => b.d - a.d);
      for (const e of ents) {
        const q = cam.p(e.x, e.y, e.z || 0);
        if (!q) continue;
        PB.Chara.draw(ctx, q.x, q.y, q.s * mul, e.o);
      }
      if (!fieldView) this.drawBatterView(ctx, cam);
      // ボール
      if (play) {
        const b = play.ball;
        if (b && b.x != null && !(play.pred && play.pred.info.hr && b.mode === "live" && play.t > play.pred.samples[play.pred.samples.length - 1].t)) {
          R.drawBall(ctx, cam, b.x, b.y, Math.max(0, b.z || 0), { mul: fieldView ? 3 : 1, min: 3 });
        }
        if (play.icpt && play.icpt.air && play.ball.mode === "live" && fieldView) R.drawLanding(ctx, cam, play.icpt.x, play.icpt.y, this.time);
      } else if (this.foulBall) {
        R.drawBall(ctx, cam, this.foulBall.x, this.foulBall.y, Math.max(0, this.foulBall.z), { min: 2 });
      }
      R.drawFx(ctx, dt);
    }

    // 守備ビューのカメラ: ボールと関係する選手が収まるように平行移動・ズームする
    dynCam(dt) {
      const base = R.cams.field;
      const play = this.play;
      const pts = [];
      if (play) {
        const b = play.ball;
        if (b && b.x != null && !(play.pred && play.pred.info.hr && play.t > 2.5)) pts.push([b.x, b.y]);
        if (play.icpt && b.mode === "live") pts.push([play.icpt.x, play.icpt.y]);
        if (b.mode === "thrown") pts.push([b.tx, b.ty]);
        for (const r of play.runners) if (r.state === "run" || r.state === "return") pts.push([r.x, r.y]);
        if (play.t < 0.8) pts.push([0, 6]);
      }
      if (!pts.length) pts.push([0, 30]);
      let x0 = 1e9;
      let x1 = -1e9;
      let y0 = 1e9;
      let y1 = -1e9;
      for (const p of pts) {
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
      const m = 16;
      x0 -= m;
      x1 += m;
      y0 -= m;
      y1 += m;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const ox = cx * 0.9;
      const oy = (cy - base.target[1]) * 0.9;
      const tmp = new Cam().set([base.pos[0] + ox, base.pos[1] + oy, base.pos[2]], [base.target[0] + ox, base.target[1] + oy, 0], base.f, base.cx, base.cy);
      const corners = [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ].map((p) => tmp.p(p[0], p[1], 0) || { x: base.cx, y: base.cy });
      const sx = Math.max(...corners.map((c) => Math.abs(c.x - base.cx))) * 2;
      const syU = Math.max(...corners.map((c) => base.cy - c.y));
      const syD = Math.max(...corners.map((c) => c.y - base.cy));
      const top = R.layout.top + 20;
      const bot = R.H - R.layout.bottom * 0.7;
      let zoom = Math.min((R.W * 0.92) / Math.max(1, sx), (base.cy - top) / Math.max(1, syU), (bot - base.cy) / Math.max(1, syD));
      zoom = U.clamp(zoom, 1, 2.6);
      const want = { ox, oy, zoom };
      if (!this.dyn) this.dyn = { ox: 0, oy: 0, zoom: 1 };
      const k = 1 - Math.exp(-dt * 3.2);
      this.dyn.ox += (want.ox - this.dyn.ox) * k;
      this.dyn.oy += (want.oy - this.dyn.oy) * k;
      this.dyn.zoom += (want.zoom - this.dyn.zoom) * k;
      const d = this.dyn;
      return new Cam().set([base.pos[0] + d.ox, base.pos[1] + d.oy, base.pos[2]], [base.target[0] + d.ox, base.target[1] + d.oy, 0], base.f * d.zoom, base.cx, base.cy);
    }

    // 中継の絵だけを見せる場面 (打席のゾーン・カーソルを隠す)
    cinematic() {
      const st = this.state;
      return st === "tvscore" || st === "change" || st === "intro" || st === "result" || this.finished || (st === "cue" && !!this.cue && !!this.cue.cine);
    }

    runnerDir(r) {
      const a = F.BASES[Math.min(r.from, 4)];
      const b = F.BASES[Math.min(r.from + 1, 4)];
      const s = r.state === "return" ? -1 : 1;
      return [(b[0] - a[0]) * s, (b[1] - a[1]) * s];
    }

    // 3D 描画のときの 2D 重ね描き (ゾーン・カーソル・ミット・ボールの軌跡・落下点・エフェクト)
    drawOverlay3D(ctx, cam, dt, blend) {
      const g = this.g;
      const fieldView = blend > 0.5;
      const play = this.play;
      if (!fieldView) {
        const bat = g.batter();
        const pit = g.pitcher();
        const cine = this.cinematic();
        if (this.state !== "inplay" && !cine) R.drawZone(ctx, cam, 0.85);
        if (this.userBat() && !cine) {
          const cs = P.cursor(bat, pit, g.ctx("bat"));
          R.drawCursor(ctx, cam, { x: this.cur.x, z: this.cur.z, rx: cs.rx, rz: cs.rz, bunt: this.bunt, flash: this.swingT != null && this.swingT < 0.2 });
        }
        if (this.userPitch() && (this.state === "ready" || this.state === "windup" || this.state === "pitch" || this.state === "call")) {
          const def = D.PITCHES[this.selPitch];
          const ent = (pit.pitches || []).find((x) => x.t === this.selPitch);
          const lv = ent ? ent.lv : 0;
          let dx = def.bx(lv) * (pit.throws === "R" ? 1 : -1);
          let dz = def.bz(lv);
          if (this.state !== "ready") dx = dz = 0;
          R.drawMitt(ctx, cam, this.aim, { dx: dx * 2.2, dz: dz * 2.2 });
        }
        // 投球の軌跡 (ボール本体は 3D)
        if ((this.state === "pitch" || (this.state === "call" && this.pendingCall !== "derby")) && this.pc && !this.foulBall) {
          const pT = Math.min(this.pT, this.pc.T + 0.025);
          const p = P.pos(this.pc, pT);
          const q = cam.p(p[0], p[1], p[2]);
          const prev = this.prevBall;
          if (q && prev) {
            const r = Math.max(2, 0.037 * q.s);
            ctx.strokeStyle = "rgba(255,255,255,0.28)";
            ctx.lineWidth = r * 1.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
          this.prevBall = q ? { x: q.x, y: q.y } : null;
        }
      }
      if (play && play.icpt && play.icpt.air && play.ball.mode === "live" && fieldView) R.drawLanding(ctx, cam, play.icpt.x, play.icpt.y, this.time);
      R.drawFx(ctx, dt);
    }

    drawBatterView(ctx, cam) {
      const g = this.g;
      const z = R.zoneRect(cam);
      const zw = z.x1 - z.x0;
      const zh = z.y1 - z.y0;
      const bat = g.batter();
      const pit = g.pitcher();
      const side = P.batSide(bat, pit);
      const batTeam = g.teams[g.battingSide()];
      // 打者
      const s = zh * 0.6;
      const fx = side === "R" ? z.x0 - zw * 0.32 : z.x1 + zw * 0.32;
      const fy = z.y1 + zh * 0.36;
      let pose = "bat";
      let t = 0;
      const buntStance = (this.userBat() && this.bunt) || (!this.userBat() && g.paBunt && (this.state === "windup" || this.state === "pitch"));
      if (buntStance) pose = "bunt";
      if (this.swingT != null && !(this.swUsed && this.swUsed.bunt)) {
        pose = "swing";
        t = this.swingT / 0.25;
      }
      PB.Chara.draw(ctx, fx, fy, s, { team: batTeam, face: bat.face, view: "back", pose, t, side, num: bat.num, alpha: 0.96 });
      // ゾーン・カーソル (得点パネル・攻守交代・試合前後の演出中は出さない)
      const cine = this.cinematic();
      const showZone = this.state !== "inplay" && !cine;
      if (showZone) R.drawZone(ctx, cam, 0.9);
      if (this.userBat() && !cine) {
        const cs = P.cursor(bat, pit, g.ctx("bat"));
        R.drawCursor(ctx, cam, { x: this.cur.x, z: this.cur.z, rx: cs.rx, rz: cs.rz, bunt: this.bunt, flash: this.swingT != null && this.swingT < 0.2 });
      }
      if (this.userPitch() && (this.state === "ready" || this.state === "windup" || this.state === "pitch" || this.state === "call")) {
        const def = D.PITCHES[this.selPitch];
        const ent = (pit.pitches || []).find((x) => x.t === this.selPitch);
        const lv = ent ? ent.lv : 0;
        let dx = def.bx(lv) * (pit.throws === "R" ? 1 : -1);
        let dz = def.bz(lv);
        if (this.state !== "ready") dx = dz = 0;
        R.drawMitt(ctx, cam, this.aim, { dx: dx * 2.2, dz: dz * 2.2 });
      }
      // 投球中のボール
      if ((this.state === "pitch" || (this.state === "call" && this.pendingCall !== "derby")) && this.pc && !this.foulBall) {
        const pT = Math.min(this.pT, this.pc.T + 0.025);
        const p = P.pos(this.pc, pT);
        const prev = this.prevBall;
        const q = R.drawBall(ctx, cam, p[0], p[1], p[2], { min: 2.2, trail: prev });
        this.prevBall = q ? { x: q.x, y: q.y } : null;
      }
    }
  }

  PB.Match = Match;
})((window.PB = window.PB || {}));
