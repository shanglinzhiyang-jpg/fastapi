// The Game object: main loop, scene stack and the async scripting API used by
// every place / event. Scripts are async functions that receive `g`:
//
//   talk: async (g, npc) => {
//     await g.say('こんにちは！', { name: '受付', look: npc.look });
//     const i = await g.ask('オーディションを受けますか？', ['受ける', 'やめる']);
//     if (i === 0) await g.audition({ agency: 'yoshimoto', minigame: 'tsukkomi' });
//   }
//
// See README.md (開発者向け) for the full list.

import { W, H, SW, SH, UNIT, LEGACY_SCALE, LEGACY_X, TILE, DIRS, OPP, fmtMoney, yenText, clamp, display, makeCanvas } from './util.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { MapScene, PLACES, doorIndexFor, entryFor } from './map.js';
import { MessageScene, ListScene, ShopScene, openMenu, drawHud, HUD_H } from './ui.js';
import { MINIGAMES } from './minigame.js';
import { text, panel, COLORS } from './draw.js';
import { drawLogo, LOGOS } from './logos.js';
import { charSheet, drawChar } from './sprites.js';
import {
  SKILLS, SKILL_MAX, ITEMS, AGENCIES, RANKS, FINALE_FAME,
  rankIndex, rankName, saveGame, payText, storageMode,
} from './state.js';
import { installLife, REGULARS, SCRUFFY, ACTIVITY, showWords } from './life.js';
import { eraOf, fullName, personalityMult } from './profile.js';
// The two cores (crime.js: justice and debts, politics.js: politics) are NOT imported here:
// main.js loads them with a dynamic import and installs them on Game.prototype
// (installJustice, then installPolitics), so a core that fails to load cannot take the
// whole game down (everything else reads them guarded).

const RANK_MULT = { S: 1.5, A: 1.2, B: 1.0, C: 0.7, D: 0.4 };
// A job's mood swing on top of ACTIVITY.job.stress: a great result lifts it, a bad one weighs.
const RANK_STRESS = { S: -4, D: 3 };
// The minigame bonus (skill + condition) never goes below this (a hungry, stressed beginner).
const MIN_BONUS = -0.35;

// Side bands beside an opaque v1-size scene (cached per device scale).
let bands = null;
function drawSideBands(ctx, S) {
  if (!bands || bands.S !== S) {
    const bw = LEGACY_X;
    const [cv, c] = makeCanvas(bw * S, SH * S);
    c.scale(S, S);
    c.fillStyle = '#0b0f24';
    c.fillRect(0, 0, bw, SH);
    c.fillStyle = '#121a3a';
    for (let y = 0; y < SH; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < bw; x += 8) c.fillRect(x, y, 2, 2);
    // gold rim next to the picture, with small bulbs
    c.fillStyle = '#6a5420';
    c.fillRect(bw - 6, 0, 2, SH);
    c.fillStyle = '#ffd23f';
    c.fillRect(bw - 5, 0, 1, SH);
    for (let y = 6; y < SH; y += 16) { c.fillStyle = '#fff6a8'; c.fillRect(bw - 14, y, 3, 3); c.fillStyle = '#b8902a'; c.fillRect(bw - 13, y + 3, 1, 1); }
    bands = { S, cv };
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bands.cv, 0, 0);
  ctx.translate(SW * S, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(bands.cv, 0, 0);
  ctx.restore();
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.scenes = [];
    this.frame = 0;
    this.busy = 0;
    this.state = null;
    this.map = new MapScene(this);
    this.fade = 0;
    this.toasts = [];
    this.banner = null;
    this.timers = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.S = 1;
    this.pendingRankUp = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.input.onAnyKey = () => audio.unlock();
    this.input.onMute = () => { audio.unlock(); const m = audio.toggleMute(); this.notify(m ? '音：OFF' : '音：ON', { color: '#fff' }); };
  }

  // ---------------------------------------------------------------- display
  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    // narrow phones: use the full width so the canvas is not drawn below 1x
    const availW = Math.max(160, box.width < 400 ? box.width : box.width - 8);
    const availH = Math.max(120, box.height - 8);
    let s = Math.min(availW / SW, availH / SH);
    if (s >= 2) { const f = Math.floor(s); if (f / s > 0.85) s = f; }
    const dpr = window.devicePixelRatio || 1;
    const S = Math.max(1, Math.ceil(s * dpr - 0.01));
    this.canvas.width = SW * S;
    this.canvas.height = SH * S;
    this.canvas.style.width = Math.round(SW * s) + 'px';
    this.canvas.style.height = Math.round(SH * s) + 'px';
    this.canvas.style.imageRendering = S > s * dpr + 0.01 ? 'auto' : 'pixelated';
    this.S = S;
    display.S = S;
    // Tall portrait phones (style.css shows #hudbar): the HUD is drawn in its own bar above
    // the game screen, out of the spare height, so it never covers the map.
    const bar = document.getElementById('hudbar');
    this.hudOut = !!bar && getComputedStyle(bar).display !== 'none';
    this.hudCtx = null;
    if (this.hudOut) {
      bar.width = SW * S;
      bar.height = HUD_H * S;
      bar.style.width = this.canvas.style.width;
      bar.style.height = Math.round(HUD_H * s) + 'px';
      bar.style.imageRendering = this.canvas.style.imageRendering;
      this.hudCtx = bar.getContext('2d');
    }
  }

  start() {
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;
    const tick = (now) => {
      acc += Math.min(250, now - last);
      last = now;
      let n = 0;
      while (acc >= STEP && n < 5 && !this.paused) {
        this.update();
        acc -= STEP;
        n++;
      }
      if (n >= 5) acc = 0;
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Advance the simulation by n frames without rendering (tests).
  tick(n = 1) { for (let i = 0; i < n; i++) this.update(); this.render(); }

  get top() { return this.scenes[this.scenes.length - 1]; }

  push(scene) { this.scenes.push(scene); this.input.consume(); return scene; }

  pop(scene) {
    const i = scene ? this.scenes.lastIndexOf(scene) : this.scenes.length - 1;
    if (i >= 0) this.scenes.splice(i, 1);
    this.input.consume();
  }

  // g.state: assigning a state (new game, continue, tests) also sets the era's price level
  // for money on screen (util.js display.priceRate); update() keeps it in step after that.
  get state() { return this._state; }
  set state(s) {
    this._state = s;
    display.priceRate = eraOf(s).priceRate || 1;
  }

  setBase(scene) {
    this.scenes = [scene];
    this.input.consume();
  }

  update() {
    this.frame++;
    if (this.state && this.frame % 3600 === 0) this.state.playMinutes++;
    if (this._state) display.priceRate = eraOf(this._state).priceRate || 1;
    for (const tm of this.timers) tm.left--;
    const done = this.timers.filter((t) => t.left <= 0);
    this.timers = this.timers.filter((t) => t.left > 0);
    for (const t of done) t.resolve();
    const top = this.top;
    if (top) {
      try { top.update(this); } catch (e) { console.error(e); }
    }
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < t.life);
    if (this.banner && ++this.banner.t > this.banner.life) this.banner = null;
    if (this.shakeT > 0) this.shakeT--;
    // a need crossed a line while walking: explain it as soon as the player is free
    if (this.pendingTips && this.pendingTips.length && !this.busy && this.state && this.top === this.map && this.map.place) this.afterScript();
    this.input.update();
  }

  // Scenes with `hd: true` draw in screen pixels (SW x SH). Older scenes draw in
  // the v1 320x240 space, shown LEGACY_SCALE x larger in the middle of the
  // screen; an opaque one gets decorated side bands.
  render() {
    const ctx = this.ctx;
    const S = this.S;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SW, SH);
    // shake offset in v1 pixels (= world units)
    let ox = 0, oy = 0;
    if (this.shakeT > 0) {
      const m = this.shakeMag;
      ox = Math.round((Math.random() * 2 - 1) * m);
      oy = Math.round((Math.random() * 2 - 1) * m);
    }
    let from = 0;
    for (let i = this.scenes.length - 1; i >= 0; i--) {
      if (this.scenes[i].opaque) { from = i; break; }
    }
    for (let i = from; i < this.scenes.length; i++) {
      const sc = this.scenes[i];
      ctx.save();
      if (sc.hd) {
        ctx.setTransform(S, 0, 0, S, ox * UNIT * S, oy * UNIT * S);
      } else {
        if (sc.opaque) drawSideBands(ctx, S);
        const k = S * LEGACY_SCALE;
        ctx.setTransform(k, 0, 0, k, LEGACY_X * S + ox * k, oy * k);
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.clip();
      }
      try { sc.draw(ctx, this); } catch (e) { console.error(e); }
      ctx.restore();
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(this.fade, 0, 1)})`;
      ctx.fillRect(0, 0, SW, SH);
    }
    if (this.hudCtx) {
      // the HUD bar (portrait phones): the HUD while the map shows it, else empty
      const hc = this.hudCtx;
      hc.setTransform(S, 0, 0, S, 0, 0);
      hc.imageSmoothingEnabled = false;
      hc.clearRect(0, 0, SW, HUD_H);
      const m = this.map;
      if (m && m.room && this.scenes.indexOf(m) >= from && m.hudShown(this) && this.fade < 1) {
        hc.globalAlpha = clamp(1 - this.fade, 0, 1); // fades with the screen
        try { drawHud(hc, this); } catch (e) { console.error(e); }
        hc.globalAlpha = 1;
      }
    }
  }

  // ---------------------------------------------------------------- scripting core
  async run(fn) {
    this.busy++;
    try {
      return await fn(this);
    } catch (e) {
      console.error(e);
      return undefined;
    } finally {
      this.busy--;
      if (this.busy === 0 && this.state) this.afterScript();
    }
  }

  afterScript() {
    if (this.pendingTips && this.pendingTips.length) {
      const tips = this.pendingTips.splice(0);
      this.run(async () => { for (const t of tips) await this.say(t); });
      return;
    }
    if (this.pendingRankUp) {
      const r = this.pendingRankUp;
      this.pendingRankUp = null;
      this.run(async () => {
        audio.sfx('fanfare');
        await this.say(`称号が「${r}」になった！\nもっともっと上を目指そう！`);
      });
      return;
    }
    if (this.state.fame >= FINALE_FAME && !this.state.flags.finaleInvited && this.map.place && this.map.place.kind === 'town') {
      this.state.flags.finaleInvited = true;
      this.run(async () => {
        audio.sfx('chime');
        await this.say('プルルル…プルルル…\n電話だ！');
        await this.say(['もしもし？NHKの番組プロデューサーです。', `${this.state.name}さん、今年の年末の大型歌番組に、ぜひ出演していただけませんか！？`, '準備ができたらNHK放送センターまでお越しください！'], { name: '電話の声' });
        await this.say('ついに…国民的な大舞台だ！\nNHK放送センターへ向かおう！');
      });
    }
  }

  wait(ms) {
    return new Promise((resolve) => this.timers.push({ left: Math.max(1, Math.round(ms / (1000 / 60))), resolve }));
  }

  waitFrames(n) {
    return new Promise((resolve) => this.timers.push({ left: Math.max(1, n), resolve }));
  }

  tweenFade(to, frames) {
    const from = this.fade;
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        i++;
        this.fade = from + (to - from) * (i / frames);
        if (i >= frames) { this.fade = to; resolve(); } else this.timers.push({ left: 1, resolve: step });
      };
      this.timers.push({ left: 1, resolve: step });
    });
  }
  fadeOut(frames = 14) { return this.tweenFade(1, frames); }
  fadeIn(frames = 14) { return this.tweenFade(0, frames); }

  // Placeholders: {name} (what people call you: the given name), {fullname} (姓 名),
  // {familyname} (姓), {agency}. Then the era: the SNS name (ドッター in 令和) and every
  // literal amount of money (¥1,500 / 100円) in the era's prices (util.js yenText; amounts
  // made with fmtMoney are already scaled and stay as they are).
  fmt(str) {
    const st = this.state || {};
    const p = st.profile;
    let s = String(str)
      .replaceAll('{name}', st.name || 'あなた')
      .replaceAll('{fullname}', p ? fullName(p) : st.name || 'あなた')
      .replaceAll('{familyname}', p ? p.familyName : '')
      .replaceAll('{agency}', st.agency ? AGENCIES[st.agency].name : 'フリー');
    const sns = eraOf(st).sns;
    if (sns && sns !== 'ドッター') s = s.replaceAll('ドッター', sns);
    return yenText(s);
  }

  // text: string | string[]. opts: { name, look, top, speed, color }
  say(textOrPages, opts = {}) {
    const pages = [].concat(textOrPages).filter((p) => p != null).map((p) => this.fmt(p));
    return new Promise((resolve) => this.push(new MessageScene(this, pages, opts, resolve)));
  }

  // Returns the chosen index. opts.cancel = index returned on B (default: last choice).
  ask(textOrPages, choices, opts = {}) {
    const pages = [].concat(textOrPages).map((p) => this.fmt(p));
    const cancel = opts.cancel === undefined ? choices.length - 1 : opts.cancel;
    return new Promise((resolve) => this.push(new MessageScene(this, pages, { ...opts, choices: choices.map((c) => this.fmt(c)), cancel }, resolve)));
  }

  list(opts) { return new Promise((resolve) => this.push(new ListScene(this, opts, resolve))); }

  notify(str, opts = {}) {
    this.toasts.push({ text: this.fmt(str), t: 0, life: opts.life || 100, color: opts.color, bg: opts.bg });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  showBanner(str) { this.banner = { text: str, t: 0, life: 140 }; }
  sfx(name) { audio.sfx(name); }
  bgm(name) { audio.bgm(name); }
  shake(frames = 20, mag = 3) { this.shakeT = frames; this.shakeMag = mag; }

  // Big logo card. Waits for A.
  async showLogo(id, caption) {
    const scene = {
      t: 0,
      hd: true,
      update: (g) => { scene.t++; if (g.auto || (scene.t > 10 && (g.input.pressed('a') || g.input.pressed('b'))) ) { audio.sfx('cursor'); g.pop(scene); scene.resolve(); } },
      draw: (ctx) => {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, SW, SH);
        panel(ctx, 120, 28, SW - 240, 250, { bg: '#ffffff', edge: '#20232a' });
        drawLogo(ctx, id, 136, 44, SW - 272, 190, {});
        text(ctx, caption || (LOGOS[id] && LOGOS[id].name) || '', SW / 2, 246, { size: 16, align: 'center', color: '#20232a', shadow: null });
      },
    };
    return new Promise((resolve) => { scene.resolve = resolve; this.push(scene); });
  }

  // ---------------------------------------------------------------- movement / cutscenes
  npc(id) { return this.map.npc(id); }

  // steps: 'up up left' or ['up', 'face:down', ...]
  moveNpc(id, steps, speed = 1) {
    const e = this.npc(id);
    if (!e) { console.error('moveNpc: no npc', id); return Promise.resolve(); }
    const path = Array.isArray(steps) ? steps.slice() : String(steps).trim().split(/\s+/);
    return new Promise((resolve) => {
      e.path.push(...path);
      e.speed = speed;
      e.pathDone = resolve;
    });
  }

  movePlayer(steps, speed = 1.6) {
    const p = this.map.player;
    const path = Array.isArray(steps) ? steps.slice() : String(steps).trim().split(/\s+/);
    return new Promise((resolve) => {
      p.path = path;
      p.speed = speed;
      p.pathDone = resolve;
      if (!p.moving) this.map.stepPath(p);
    });
  }

  facePlayer(dir) { this.map.player.dir = dir; }

  // Teleport an NPC / the player (cutscenes).
  placeNpc(id, x, y, dir) {
    const e = this.npc(id);
    if (!e) { console.error('placeNpc: no npc', id); return; }
    Object.assign(e, { x, y, px: x * TILE, py: y * TILE, moving: false, t: 0 });
    if (dir) e.dir = dir;
    // cancel a scripted walk that was still running
    e.path.length = 0;
    if (e.pathDone) { const r = e.pathDone; e.pathDone = null; r(); }
  }
  showNpc(id, visible = true) {
    const e = this.npc(id);
    if (e) e.hidden = !visible;
  }
  placePlayer(x, y, dir) {
    const p = this.map.player;
    Object.assign(p, { x, y, px: x * TILE, py: y * TILE, moving: false, t: 0 });
    if (dir) p.dir = dir;
    this.map.updateCamera(true);
  }

  // Walk an NPC to (x, y) along a shortest free path (BFS). Resolves when it
  // arrives, or immediately when no path exists.
  walkNpcTo(id, x, y, speed = 1) {
    const e = this.npc(id);
    if (!e) { console.error('walkNpcTo: no npc', id); return Promise.resolve(); }
    const m = this.map;
    const key = (a, b) => a + ',' + b;
    const prev = new Map([[key(e.x, e.y), null]]);
    const q = [[e.x, e.y]];
    while (q.length) {
      const [cx, cy] = q.shift();
      if (cx === x && cy === y) break;
      for (const [d, [dx, dy]] of Object.entries(DIRS)) {
        const nx = cx + dx, ny = cy + dy;
        if (prev.has(key(nx, ny)) || m.blocked(nx, ny, e)) continue;
        prev.set(key(nx, ny), [cx, cy, d]);
        q.push([nx, ny]);
      }
    }
    if (!prev.has(key(x, y))) return Promise.resolve();
    const steps = [];
    let cur = key(x, y);
    while (prev.get(cur)) { const [px, py, d] = prev.get(cur); steps.unshift(d); cur = key(px, py); }
    return steps.length ? this.moveNpc(id, steps, speed) : Promise.resolve();
  }

  // kind: '!' '?' '♪' '♥' '…' '💢' 'w'
  emote(target, kind = '!', frames = 50) {
    const e = target === 'player' ? this.map.player : this.npc(target);
    if (!e) return Promise.resolve();
    // a new emote replaces the old one: let anything waiting on the old one continue
    if (e.emote && e.emote.resolve) e.emote.resolve();
    return new Promise((resolve) => { e.emote = { kind, t: 0, life: frames, resolve }; });
  }

  // ---------------------------------------------------------------- places
  async goto(placeId, roomId, x, y, dir = 'down', { fade = true } = {}) {
    const place = PLACES[placeId];
    if (!place) { console.error('goto: unknown place', placeId); return; }
    roomId = roomId || place.start.room;
    if (x == null) {
      const e = roomId === place.start.room ? place.start : entryFor(place, roomId);
      x = e.x; y = e.y; dir = e.dir || dir;
    }
    const changedPlace = this.map.placeId !== placeId;
    // てちょう「ばしょ」: remember every place the player has been to (old saves simply lack it)
    const fl = this.state && this.state.flags;
    if (fl && !(fl.visited && fl.visited[placeId])) fl.visited = { ...(fl.visited || {}), [placeId]: true };
    if (fade && this.fade < 1) await this.fadeOut();
    this.map.load(placeId, roomId, x, y, dir);
    if (this.scenes[0] !== this.map) this.setBase(this.map);
    else this.scenes.length = 1;
    const room = this.map.room.def;
    audio.bgm(room.bgm || place.bgm || (place.kind === 'town' ? 'town' : 'office'));
    if (changedPlace && place.name) this.showBanner(place.name);
    if (fade) await this.fadeIn();
    // outside a script (new game / continue / test start) run it as one so the player cannot move meanwhile
    if (room.onEnter) await (this.busy > 0 ? room.onEnter(this) : this.run(room.onEnter));
    // regular shows recorded here today: offer to go straight to the studio (one after
    // the other when two fall on the same day; あとにする stops asking)
    if (changedPlace && this.state && roomId === place.start.room && this.regularsToday(placeId).length) {
      const ask = async () => {
        const asked = new Set();
        for (;;) {
          const id = this.regularsToday(placeId).find((x) => !asked.has(x));
          if (!id) return;
          asked.add(id);
          const r = REGULARS[id];
          const w = showWords(r);
          const i = await this.ask(`今日は『${r.title}』の${w.day}だ！\n${w.where}へ向かう？（体力 -${r.stamina}）`, [w.go, 'あとにする'], { cancel: 1 });
          if (i !== 0 || !(await this.doRegular(id))) return;
        }
      };
      await (this.busy > 0 ? ask() : this.run(ask));
    }
  }

  enterPlace(placeId) {
    const p = PLACES[placeId];
    if (!p) {
      console.error('enterPlace: unknown place', placeId);
      return this.say('（まだ準備中のようだ…）');
    }
    return this.goto(placeId, p.start.room, p.start.x, p.start.y, p.start.dir || 'up');
  }

  async exitPlace() {
    const loc = doorIndexFor(this.map.placeId);
    if (!loc) { console.error('exitPlace: no door for', this.map.placeId); return; }
    await this.goto(loc.town, loc.room, loc.x, loc.y, 'down');
    this.save(true);
  }

  // ---------------------------------------------------------------- player state
  get st() { return this.state; }

  addMoney(n, silent = false) {
    this.state.money = Math.max(0, this.state.money + Math.round(n));
    if (!silent && n) this.notify(`${n > 0 ? '+' : '-'}${fmtMoney(Math.abs(n))}`, { color: COLORS.accent });
  }

  spend(n) {
    if (this.state.money < n) return false;
    this.state.money -= n;
    return true;
  }

  // A new title is announced once: dropping below it (a missed show) and climbing back
  // does not announce it again (stats.bestRank = the highest title reached).
  addFame(n, silent = false) {
    const st = this.state;
    const stats = st.stats || (st.stats = {});
    const before = rankIndex(st.fame);
    const best = Math.max(before, Number.isFinite(stats.bestRank) ? stats.bestRank : before);
    st.fame = Math.max(0, st.fame + Math.round(n));
    if (!silent && n) this.notify(`知名度 ${n > 0 ? '+' : ''}${Math.round(n)}`, { color: COLORS.pink });
    const after = rankIndex(st.fame);
    stats.bestRank = Math.max(best, after);
    if (after > best) this.pendingRankUp = RANKS[after][1];
  }

  addSkill(key, n, silent = false) {
    if (!SKILLS[key]) { console.error('addSkill: unknown skill', key); return; }
    const v = clamp(this.state.skills[key] + Math.round(n), 0, SKILL_MAX);
    const d = v - this.state.skills[key];
    this.state.skills[key] = v;
    if (!silent && d) this.notify(`${SKILLS[key]} +${d}`, { color: COLORS.cyan });
  }

  // Non-food recovery (bath, bed, events). Food goes through eat().
  heal(n) {
    this.state.stamina = clamp(this.state.stamina + n, 0, this.state.maxStamina);
  }

  // Food (g.eat / g.mealsLeft / g.canEat), needs, people, rent etc. are in life.js.

  // Returns false (and changes nothing) when there is not enough stamina.
  useStamina(n) {
    if (this.state.stamina < n) return false;
    this.state.stamina -= n;
    return true;
  }

  giveItem(id, n = 1, silent = false) {
    this.state.items[id] = (this.state.items[id] || 0) + n;
    if (!silent) this.notify(`${ITEMS[id]?.name || id}を手に入れた！`, { color: '#fff' });
  }
  hasItem(id, n = 1) { return (this.state.items[id] || 0) >= n; }
  takeItem(id, n = 1) {
    if (!this.hasItem(id, n)) return false;
    this.state.items[id] -= n;
    if (this.state.items[id] <= 0) delete this.state.items[id];
    return true;
  }

  flag(k) { return this.state.flags[k]; }
  setFlag(k, v = true) { this.state.flags[k] = v; }

  // 0..~1.3 bonus for minigames, consuming a buff item effect if present.
  skillBonus(key, consume = true) {
    if (!key || !this.state) return 0;
    let b = (this.state.skills[key] || 0) / SKILL_MAX;
    if (this.state.buffs[key]) {
      b += 0.3;
      if (consume) delete this.state.buffs[key];
    }
    return b;
  }

  save(silent = true) {
    if (!this.state || !this.map.place) return false;
    if (this.map.place.noSave) return false;
    const p = this.map.player;
    return saveGame(this.state, { place: this.map.placeId, room: this.map.roomId, x: p.x, y: p.y, dir: p.dir });
  }

  // ---------------------------------------------------------------- minigames & activities
  minigame(id, opts = {}) {
    const Cls = MINIGAMES[id];
    if (!Cls) {
      console.error('unknown minigame', id);
      return Promise.resolve({ score: 50, rank: 'C', success: true, comment: '' });
    }
    const prevBgm = audio.current ? audio.current.name : (audio.wanted || null);
    const skill = opts.skill || Cls.skill;
    // skill (+ a buff item) and the player's condition, shown apart on the intro card
    let bonus = opts.bonus;
    let bonusInfo = opts.bonusInfo || null;
    if (bonus == null) {
      const sb = this.skillBonus(skill);
      const parts = this.state ? this.lifeBonusParts(skill) : [];
      bonus = Math.max(MIN_BONUS, sb + parts.reduce((a, p) => a + p.v, 0));
      bonusInfo = { skill: sb, parts };
    }
    return new Promise((resolve) => {
      let mg;
      try {
        mg = new Cls(this, { ...opts, bonus, bonusInfo });
      } catch (e) {
        console.error(e);
        resolve({ score: 50, rank: 'C', success: true, comment: '' });
        return;
      }
      mg._resolve = (res) => {
        // the waiting script must always continue, even if the bookkeeping throws
        try {
          const stats = this.state.stats;
          stats.minigames = (stats.minigames || 0) + 1;
          const best = stats.bestRanks || (stats.bestRanks = {});
          if (!best[id] || 'SABCD'.indexOf(res.rank) < 'SABCD'.indexOf(best[id])) best[id] = res.rank;
        } catch (e) {
          console.error(e);
        } finally {
          this.pop(mg);
          if (prevBgm) audio.bgm(prevBgm);
          resolve(res);
        }
      };
      audio.bgm(Cls.bgm === undefined ? 'minigame' : Cls.bgm); // static bgm = null -> silence (play your own sounds)
      this.push(mg);
    });
  }

  shop(goods, opts = {}) {
    return new Promise((resolve) => this.push(new ShopScene(this, goods, opts, resolve)));
  }

  // r: { agency: true | id | [ids], fame, skills: { k: min }, flag, flagText, anyOf: [r1, r2, ...] }
  // Returns null when allowed, otherwise the reason to show.
  checkRequires(r) {
    const st = this.state;
    if (!r) return null;
    if (Array.isArray(r.anyOf) && r.anyOf.length) {
      const reasons = r.anyOf.map((alt) => this.checkRequires(alt));
      if (!reasons.includes(null)) return r.anyOfText || reasons[0];
      const { anyOf, anyOfText, ...rest } = r;
      return this.checkRequires(Object.keys(rest).length ? rest : null);
    }
    if (r.agency === true && !st.agency) return '事務所に所属していないと、このお仕事は受けられないみたいだ…。\nまずはどこかの事務所のオーディションに合格しよう。';
    if (typeof r.agency === 'string' && st.agency !== r.agency) return `${AGENCIES[r.agency]?.name || r.agency}所属のタレント限定のお仕事のようだ。`;
    if (Array.isArray(r.agency) && !r.agency.includes(st.agency)) return `${r.agency.map((a) => AGENCIES[a]?.name || a).join('か')}所属のタレント限定のお仕事のようだ。`;
    if (r.fame && st.fame < r.fame) return `知名度が★${r.fame}以上ないと受けられないようだ。\n（いまは★${st.fame}）`;
    if (r.skills) {
      for (const [k, v] of Object.entries(r.skills)) {
        if ((st.skills[k] || 0) < v) return `${SKILLS[k]}のスキルが${v}以上必要だ。\n（いまは${st.skills[k] || 0}）`;
      }
    }
    if (r.flag && !st.flags[r.flag]) return r.flagText || 'まだこのお仕事は受けられないようだ。';
    return null;
  }

  // 'ギャラ 目安¥3,000（出来で変動）': how to advertise a job's base pay (rank B).
  payText(pay) { return payText(pay); }

  // Standard paid job. Returns the minigame result or null if not done.
  // def: { id, title, desc, stamina=20, minigame, opts={}, pay=3000, fame=10, skill, gain=2, requires, confirm=true, client, clientLook,
  //   fans (default fame x 3) }
  async job(def) {
    const st = this.state;
    const stamina = def.stamina ?? 20;
    const why = this.checkRequires(def.requires) || this.lifeRefusal();
    if (why) { await this.say(why); return null; }
    if (def.confirm !== false) {
      const desc = def.desc ? def.desc + '\n' : '';
      const i = await this.ask(`${desc}「${def.title}」\n${payText(def.pay ?? 3000)}／体力 -${stamina}・ストレス +${ACTIVITY.job.stress}`, ['受ける', 'やめておく'], { name: def.client, look: def.clientLook });
      if (i !== 0) return null;
    }
    if (st.stamina < stamina) {
      await this.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。');
      return null;
    }
    st.stamina -= stamina;
    st.life.workDay = st.day;
    const res = await this.minigame(def.minigame, { ...(def.opts || {}), skill: def.skill, title: def.title });
    const agencyBonus = st.agency && AGENCIES[st.agency] && AGENCIES[st.agency].skill === def.skill ? 1.1 : 1;
    const mult = RANK_MULT[res.rank] * agencyBonus;
    const pay = Math.round(((def.pay ?? 3000) * mult) / 10) * 10;
    const scruffy = st.life.clean < SCRUFFY;
    // personality 負けず嫌い: an S rank brings a little more fame (profile.js rankS)
    const fame = Math.max(1, Math.round((def.fame ?? 10) * mult * (scruffy ? 0.8 : 1) * (res.rank === 'S' ? personalityMult(st, 'rankS') : 1)));
    const fans = Math.max(1, Math.round((def.fans ?? (def.fame ?? 10) * 3) * mult * (scruffy ? 0.8 : 1)));
    const gain = Math.max(1, Math.round((def.gain ?? 2) * (res.rank === 'S' ? 2 : res.rank === 'A' ? 1.5 : res.rank === 'D' ? 0.5 : 1)));
    st.jobs[def.id || def.title] = (st.jobs[def.id || def.title] || 0) + 1;
    st.stats.jobs++;
    this.addMoney(pay, true);
    this.addFame(fame, true);
    this.addFans(fans, true);
    if (def.skill) this.addSkill(def.skill, gain, true);
    const L = st.life;
    const was = { hunger: L.hunger, stress: L.stress, clean: L.clean };
    this.lifeTick('job');
    // a great result lifts the mood, a bad one weighs on it
    if (RANK_STRESS[res.rank]) this.addNeed('stress', RANK_STRESS[res.rank]);
    audio.sfx('coin');
    const sign = (v) => (v > 0 ? '+' : '') + v;
    const needs = [['満腹', L.hunger - was.hunger], ['ストレス', L.stress - was.stress], ['身だしなみ', L.clean - was.clean]].filter(([, v]) => v).map(([k, v]) => `${k} ${sign(v)}`).join('・');
    const lines = [`お仕事終了！ランク${res.rank}` + (def.skill ? `　${SKILLS[def.skill]} +${gain}` : ''), `ギャラ ${fmtMoney(pay)}　知名度 +${fame}　ファン +${fans}`];
    if (needs) lines.push(`（${needs}）`);
    if (scruffy) lines.push('（身だしなみが乱れていて、少し評価が下がった…）');
    await this.say(lines.join('\n'));
    return res;
  }

  // Paid lesson that raises a skill. def: { title, skill, price=2000, stamina=10, gain=3, minigame?, opts?, teacher }
  async lesson(def) {
    const st = this.state;
    const price = def.price ?? 2000;
    const stamina = def.stamina ?? 10;
    const i = await this.ask(`「${def.title || SKILLS[def.skill] + 'レッスン'}」\nレッスン料 ${fmtMoney(price)}／体力 -${stamina}`, ['受ける', 'やめておく'], { name: def.teacher });
    if (i !== 0) return null;
    if (st.money < price) { await this.say(`レッスン料（${fmtMoney(price)}）が足りない…。\nお仕事でお金をためてからにしよう。`); return null; }
    if (st.stamina < stamina) { await this.say('体力が足りない…。休んでからにしよう。'); return null; }
    const tired = this.lifeRefusal();
    if (tired) { await this.say(tired); return null; }
    st.money -= price;
    st.stamina -= stamina;
    st.life.workDay = st.day;
    this.lifeTick('lesson');
    let gain = def.gain ?? 3;
    let res = null;
    if (def.minigame) {
      res = await this.minigame(def.minigame, { ...(def.opts || {}), skill: def.skill, title: def.title });
      gain = Math.max(1, Math.round(gain * ({ S: 2, A: 1.5, B: 1.2, C: 1, D: 0.6 }[res.rank])));
    } else {
      await this.fadeOut(10);
      audio.sfx('drum');
      await this.wait(500);
      await this.fadeIn(10);
    }
    gain = Math.max(1, Math.round(gain * personalityMult(st, 'lesson'))); // personality まじめ
    this.addSkill(def.skill, gain, true);
    audio.sfx('good');
    await this.say(`レッスン終了！\n${SKILLS[def.skill]}が${gain}上がった！（${st.skills[def.skill]}）`);
    return res || { score: 60, rank: 'B', success: true };
  }

  // Agency audition. def: { agency, title, minigame, opts, pass=55, stamina=15, requires,
  //   confirm=true, client, clientLook, beforeResult: async (g, res, passed) => {} }
  // Returns true when the player is (now) a member. g.lastAudition tells why:
  // 'passed' | 'already' | 'failed' | 'declined' | 'nostamina' | 'blocked' | 'transferDeclined'
  async audition(def) {
    const st = this.state;
    const ag = AGENCIES[def.agency];
    this.lastAudition = 'blocked';
    if (!ag) { console.error('audition: unknown agency', def.agency); return false; }
    if (st.agency === def.agency) { this.lastAudition = 'already'; await this.say(`もう${ag.name}に所属しているよ。`); return true; }
    const why = this.checkRequires(def.requires);
    if (why) { await this.say(why); return false; }
    const stamina = def.stamina ?? 15;
    if (def.confirm !== false) {
      const i = await this.ask(`「${def.title || ag.name + 'オーディション'}」\n合格すると${ag.name}所属になれる。（体力 -${stamina}）`, ['受ける', 'やめておく'], { name: def.client, look: def.clientLook });
      if (i !== 0) { this.lastAudition = 'declined'; return false; }
    }
    if (st.stamina < stamina) { this.lastAudition = 'nostamina'; await this.say('体力が足りない…。万全の状態で挑もう。'); return false; }
    const tired = this.lifeRefusal();
    if (tired) { this.lastAudition = 'nostamina'; await this.say(tired); return false; }
    st.stamina -= stamina;
    st.life.workDay = st.day;
    this.lifeTick('audition');
    const pass = def.pass ?? 55;
    const res = await this.minigame(def.minigame, { ...(def.opts || {}), skill: def.skill || (MINIGAMES[def.minigame] && MINIGAMES[def.minigame].skill) || ag.skill, title: def.title || ag.name + 'オーディション', pass });
    this.lastAuditionResult = res;
    if (def.beforeResult) await def.beforeResult(this, res, res.score >= pass);
    if (res.score < pass) {
      this.lastAudition = 'failed';
      await this.say(`不合格…。（${res.score}点／合格ライン${pass}点）\nレッスンで腕を磨いて、また挑戦しよう！`);
      return false;
    }
    if (st.agency) {
      const old = AGENCIES[st.agency].name;
      const j = await this.ask(`合格！\nいまは${old}に所属している。${ag.name}に移籍する？`, ['移籍する', 'やめておく']);
      if (j !== 0) { this.lastAudition = 'transferDeclined'; await this.say('今回は辞退した。'); return false; }
    }
    st.agency = def.agency;
    this.lastAudition = 'passed';
    this.addNeed('stress', -15);
    audio.sfx('fanfare');
    this.addFame(10, true);
    await this.say(`合格！おめでとう！\n今日から${ag.name}所属のタレントだ！`);
    return true;
  }

  // Sleep: restores stamina, advances the day, runs the morning (needs, rent,
  // messages: see life.js), shows the morning notes (rent paid, a poor night…), autosaves.
  // opts: { save, away (default: when not in your own home's place), shower, sleepStress,
  //   notes: false (do not show the notes; they stay in g.morningNotes) }
  async sleep(opts = {}) {
    const hungerAtNight = this.state.life.hunger;
    const placeId = this.map && this.map.placeId;
    const home = this.housing().place;
    const away = opts.away ?? !!(placeId && home && placeId !== home && PLACES[placeId]);
    await this.fadeOut(20);
    audio.sfx('sleep');
    await this.wait(1200);
    this.state.day++;
    this.state.stamina = this.state.maxStamina;
    await this.morning(hungerAtNight, { away, place: placeId, shower: opts.shower, sleepStress: opts.sleepStress });
    await this.fadeIn(20);
    // [R7-C clock] the morning toast with the wake-up time and the weather when the clock module is loaded
    let mt = `${this.dayLabel()}の朝`;
    if (typeof this.morningToast === 'function') { try { mt = this.morningToast() || mt; } catch (e) { console.error(e); } }
    this.notify(mt, { color: '#fff' });
    // what the night did to the needs (the stress part is in the bed's own message)
    const m = this.lastMorning;
    if (m) {
      const sign = (v) => (v > 0 ? '+' : '') + v;
      const bits = [];
      if (m.hunger) bits.push(`満腹 ${sign(m.hunger)}`);
      // a shower that only made up for the night (net 0) must not read as 「身だしなみ 0」
      if (m.clean) bits.push(`身だしなみ ${sign(m.clean)}${m.shower ? '（朝シャワー）' : ''}`);
      else if (m.shower) bits.push('朝シャワーでさっぱり');
      if (bits.length) this.notify(bits.join('　'), { color: '#fff', life: 200 });
    }
    if (opts.notes !== false && this.morningNotes && this.morningNotes.length) {
      const notes = this.morningNotes.splice(0);
      await this.say(notes); // one page each
    }
    if (opts.save !== false) {
      // a place without saving (noSave) is fine; a save the browser refused is told, not lost silently
      const canSave = !!(this.state && this.map.place && !this.map.place.noSave);
      if (canSave && !this.save()) this.notify('セーブできなかった…（データを文字にできませんでした。メニューの「データ」から書き出しを試してください）', { color: '#ff5d6c', life: 260 });
      else if (canSave && storageMode() === 'memory' && !(this._memSaveWarnDay > this.state.day - 20)) {
        // the browser refuses to keep saves (a content:// file, private window): say so now and every 20 days, point to 書き出し
        this._memSaveWarnDay = this.state.day;
        this.notify(this._memSaveWarned ? '前の書き出しから日がたっています。メニュー → データ → 書き出す で残しておきましょう' : 'このブラウザではセーブが保存されません。メニュー → データ → 書き出す で残せます', { color: '#ffd23f', life: 420 });
        this._memSaveWarned = true;
      }
    }
  }

  // ---------------------------------------------------------------- ending
  // Credits (staff roll). The game itself no longer calls this: the ★4000 year-end show
  // (nhk.js) is a milestone and the career goes on (higher titles, the yearly award…).
  // Kept, harmless, for screenshots / old test scripts.
  ending() {
    return new Promise((resolve) => {
      const g = this;
      const st = g.state;
      const C = COLORS;
      // HD art helpers are loaded lazily so a broken title.js never blocks the ending
      let logoFn = null, hdSheet = null;
      import('../title.js').then((m) => { logoFn = m.drawTitleLogo || null; }).catch(() => {});
      import('./sprites.js').then((m) => { hdSheet = m.charSheetHD ? m.charSheetHD(st.look || {}) : null; }).catch(() => {});
      const sheet = charSheet(st.look || {});
      const fans = Math.max(0, Math.round(st.fans || 0));
      let friends = 0;
      try { friends = this.friends ? this.friends(2).length : 0; } catch (e) { friends = 0; }
      const gap = (h) => ({ h });
      const items = [
        { logo: true, h: 104 },
        gap(16),
        { t: `${st.name}は ついに`, h: 28 },
        { t: '国民的スターになった！', size: 24, c: C.accent, h: 34 },
        gap(30),
        { t: `かかった日数　${st.day}日` },
        { t: `こなしたお仕事　${st.stats.jobs}回` },
        { t: `知名度　★${st.fame}` },
        fans ? { t: `ファン　${fans.toLocaleString('ja-JP')}人` } : null,
        friends ? { t: `なかよしの仲間　${friends}人` } : null,
        (() => { try { const f = typeof g.romanceSummary === 'function' ? g.romanceSummary() : ''; return f ? { t: f } : null; } catch (e) { return null; } })(), // [R12-L1] 家族
        gap(30),
        { t: '― お世話になった場所 ―', c: C.cyan, h: 34 },
        { logos: ['yoshimoto', 'shinkigeki', 'bs_yoshimoto', 'shochiku', 'grape'], h: 54 },
        { logos: ['nhk', 'toei', 'horipro', 'toho'], h: 60 },
        { t: 'よしもと / よしもと新喜劇 / BSよしもと', size: 14, h: 22 },
        { t: '松竹芸能 / グレープカンパニー', size: 14, h: 22 },
        { t: 'NHK / 東映 / ホリプロ / 東宝', size: 14, h: 22 },
        gap(30),
        { t: '※実在の企業名・ロゴは', size: 14, c: C.dim, h: 22 },
        { t: 'それぞれの権利者に帰属します。', size: 14, c: C.dim, h: 22 },
        gap(44),
        { t: 'THANK YOU FOR PLAYING!', size: 24, c: C.accent, h: 34, last: true },
      ].filter(Boolean);
      let acc = 0;
      for (const it of items) { it.y = acc; acc += it.h || 26; }
      const lastItem = items[items.length - 1];
      // the credits stop with the last line near the top, then the player takes a bow on a stage
      const SPEED = 0.6;
      const LAST_Y = 76;
      const maxScroll = SH + 10 + lastItem.y - LAST_Y;
      const stopT = maxScroll / SPEED;
      const R = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
      const hash = (i, k) => { let h = Math.imul(i + 1, 374761393) ^ Math.imul(k + 7, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const ellipse = (ctx, cx, cy, rx, ry, col) => {
        ctx.fillStyle = col;
        for (let dy = -ry; dy <= ry; dy++) {
          const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
          if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
        }
      };
      const FLOOR = 312; // top of the stage floor
      // red curtains: vertical folds in three tones, a scalloped valance with a gold fringe
      const curtain = (ctx, x0, x1, side) => {
        const TONES = ['#5a0e1e', '#8a1a2c', '#b02a3a', '#d04454', '#b02a3a', '#8a1a2c'];
        for (let x = x0; x < x1; x++) {
          const f = Math.floor(((x - x0) * (side < 0 ? 1 : -1) + 400) / 4) % TONES.length;
          const edge = side < 0 ? x1 - 1 - x : x - x0;
          const hem = SH - 8 + (edge < 6 ? -2 : 0);
          R(ctx, x, 0, 1, hem, TONES[f]);
          R(ctx, x, hem, 1, 3, '#3a0812');
        }
        R(ctx, side < 0 ? x1 - 1 : x0, 0, 1, SH - 6, '#2a0610');
        // tie-back: a gold cord wrapped across the whole curtain (lit from the top), the
        // cloth gathering under it, and a knot with a tassel at the inner edge
        const bw = x1 - x0;
        if (bw < 12) return;
        R(ctx, x0, 186, bw, 1, '#22202a');
        R(ctx, x0, 187, bw, 2, '#ffe27a');
        R(ctx, x0, 189, bw, 3, '#c9a227');
        R(ctx, x0, 192, bw, 2, '#8a6a1a');
        R(ctx, x0, 194, bw, 1, '#22202a');
        R(ctx, x0, 195, bw, 1, '#3a0812');
        for (let x = x0 + 2; x < x1 - 1; x += 4) R(ctx, x, 188, 2, 1, '#fff6c8'); // twist of the cord
        const tx = side < 0 ? x1 - 10 : x0 + 4; // knot + tassel, 6 px wide
        R(ctx, tx - 1, 184, 8, 13, '#22202a');
        R(ctx, tx, 185, 6, 11, '#c9a227');
        R(ctx, tx, 185, 6, 1, '#ffe27a');
        R(ctx, tx, 186, 1, 9, '#ffe27a');
        R(ctx, tx + 5, 186, 1, 10, '#8a6a1a');
        R(ctx, tx + 2, 197, 2, 6, '#22202a');
        R(ctx, tx + 2, 197, 1, 6, '#c9a227');
        R(ctx, tx - 1, 203, 8, 4, '#22202a');
        R(ctx, tx, 204, 6, 2, '#ffe27a');
        R(ctx, tx - 2, 207, 10, 15, '#22202a');
        R(ctx, tx - 1, 207, 8, 14, '#c9a227');
        R(ctx, tx - 1, 207, 8, 1, '#ffe27a');
        for (let i = 0; i < 4; i++) R(ctx, tx + i * 2, 208, 1, 13, '#8a6a1a');
      };
      const valance = (ctx) => {
        R(ctx, 0, 0, SW, 22, '#8a1a2c');
        R(ctx, 0, 0, SW, 3, '#5a0e1e');
        R(ctx, 0, 8, SW, 2, '#b02a3a');
        for (let x = 0; x < SW; x += 40) {
          ellipse(ctx, x + 20, 22, 20, 8, '#8a1a2c');
          R(ctx, x + 6, 24, 28, 2, '#b02a3a');
          R(ctx, x, 22, 1, 4, '#5a0e1e');
        }
        ctx.fillStyle = '#c9a227';
        for (let x = 0; x < SW; x += 3) ctx.fillRect(x, 30 - Math.round(Math.abs(((x % 40) - 20) / 20) * 6), 1, 3);
      };
      // the scrolling credits; the last line is drawn over the stage, the others fade out
      const drawCredits = (ctx, t, k, last) => {
        const scroll = Math.min(t * SPEED, maxScroll);
        if (!last && k >= 1) return;
        ctx.globalAlpha = last ? 1 : 1 - k;
        for (const it of items) {
          if (!!it.last !== last) continue;
          const y = Math.round(SH + 10 + it.y - scroll);
          if (y < -110 || y > SH + 20) continue;
          if (it.logo) {
            if (logoFn) logoFn(ctx, SW / 2, y, t);
            else text(ctx, 'ドット芸能界', SW / 2, y + 20, { align: 'center', size: 40, color: C.accent, outline: '#3a1030' });
          } else if (it.logos) {
            const BW = 76, BH = 42, GAPX = 10;
            const x0 = Math.round(SW / 2 - (it.logos.length * BW + (it.logos.length - 1) * GAPX) / 2);
            it.logos.forEach((id, i) => {
              const x = x0 + i * (BW + GAPX);
              R(ctx, x + 2, y + 2, BW, BH, 'rgba(0,0,0,0.5)');
              drawLogo(ctx, id, x, y, BW, BH, { board: true, pad: 3, frame: '#22202a' });
            });
          } else if (it.t) {
            text(ctx, it.t, SW / 2, y, { align: 'center', size: it.size || 16, color: it.c || '#ffffff', shadow: '#000000' });
          }
        }
        ctx.globalAlpha = 1;
      };
      const CONF = ['#ff5d8f', '#ffd23f', '#5fd7ff', '#5ee07a', '#ffffff', '#b48cff', '#ff8a3d'];
      const scene = {
        opaque: true,
        hd: true,
        t: 0,
        update(gg) {
          scene.t++;
          if (gg.auto || (scene.t > 60 * 20 && scene.t >= stopT && gg.input.pressed('a'))) {
            // cut to black, then fade back into whatever is underneath
            gg.fade = 1;
            gg.pop(scene);
            gg.fadeIn(30);
            resolve();
          }
        },
        draw(ctx) {
          const t = scene.t;
          R(ctx, 0, 0, SW, SH, '#0b0d1a');
          // stars drifting slowly, three layers
          for (let i = 0; i < 90; i++) {
            const layer = i % 3;
            const x = ((hash(i, 1) * SW - t * (0.08 + layer * 0.08)) % SW + SW) % SW;
            const y = Math.floor(hash(i, 2) * SH);
            if ((i * 5 + Math.floor(t / 10)) % 19 === 0) continue;
            const col = layer === 2 ? (i % 4 ? '#c8ccff' : '#fff6a8') : layer === 1 ? '#6a74b8' : '#3a4a8a';
            R(ctx, x, y, 1, 1, col);
            if (layer === 2 && i % 9 === 0 && (t >> 4) % 3 === 0) { R(ctx, x - 1, y, 3, 1, col); R(ctx, x, y - 1, 1, 3, col); }
          }
          const k = t >= stopT ? Math.min(1, (t - stopT) / 50) : 0;
          drawCredits(ctx, t, k, false);
          // the stage appears once the credits stop
          if (k > 0) {
            ctx.globalAlpha = k;
            // floor
            R(ctx, 0, FLOOR - 1, SW, 1, '#2a140c');
            R(ctx, 0, FLOOR, SW, SH - FLOOR, '#7a4824');
            R(ctx, 0, FLOOR, SW, 1, '#d09858');
            R(ctx, 0, FLOOR + 1, SW, 9, '#a86a38');
            R(ctx, 0, FLOOR + 10, SW, 1, '#6a3c1c');
            for (let x = 0; x < SW; x += 52) { R(ctx, x, FLOOR + 1, 1, 9, '#8a5428'); R(ctx, x + 26, FLOOR + 11, 1, SH - FLOOR - 11, '#64381a'); }
            R(ctx, 0, FLOOR + 22, SW, 1, '#6a3c1c');
            // spotlight beam from the lamp under the valance (row by row: a wide
            // outer cone and a brighter core) and its pool
            const cx = SW / 2;
            const LAMP_Y = 40;
            for (const [w0, kk, col, a] of [[12, 0.36, '#fff2c0', 0.08], [6, 0.2, '#fff6d8', 0.08]]) {
              ctx.globalAlpha = a * k;
              ctx.fillStyle = col;
              for (let y = LAMP_Y; y < FLOOR + 10; y++) {
                const hw = Math.round(w0 + (y - LAMP_Y) * kk);
                ctx.fillRect(Math.round(cx - hw), y, hw * 2, 1);
              }
            }
            ctx.globalAlpha = 0.3 * k;
            ellipse(ctx, cx, FLOOR + 8, 104, 10, '#fff2b0');
            ellipse(ctx, cx, FLOOR + 8, 64, 6, '#fffbe0');
            ctx.globalAlpha = k;
            // the player, 3x, hopping and turning to the audience
            const tt = t - stopT;
            const beat = Math.floor(tt / 20) % 12;
            const hop = beat === 1 || beat === 7 ? 6 : beat === 2 || beat === 8 ? 2 : 0;
            const dir = beat >= 3 && beat < 5 ? 'left' : beat >= 9 && beat < 11 ? 'right' : 'down';
            const frame = beat >= 3 && beat < 5 ? [1, 2][beat % 2] : beat >= 9 && beat < 11 ? [1, 2][beat % 2] : 0;
            // soft contact shadow (a pixel ellipse) under the feet
            ctx.globalAlpha = 0.4 * k;
            ellipse(ctx, cx, FLOOR + 8, 30, 3, '#1c0a10');
            ctx.globalAlpha = k;
            if (hdSheet) {
              const img = hdSheet[dir][frame] || hdSheet.down[0];
              ctx.drawImage(img, Math.round(cx - 48), Math.round(FLOOR + 8 - 117 - hop), 96, 120);
            } else {
              ctx.save();
              ctx.translate(Math.round(cx - 48), Math.round(FLOOR + 8 - 120 - hop));
              ctx.scale(6, 6);
              drawChar(ctx, sheet, dir, frame, 0, 4);
              ctx.restore();
            }
            // curtains slide in from the sides
            const cw = Math.round(80 * k);
            curtain(ctx, 0, cw, -1);
            curtain(ctx, SW - cw, SW, 1);
            valance(ctx);
            // the lamp: bracket, housing (lit from the top-left) and the glowing lens
            R(ctx, cx - 1, 26, 2, 6, '#22202a');
            R(ctx, cx - 11, 31, 22, 10, '#22202a');
            R(ctx, cx - 10, 32, 20, 7, '#4a4858');
            R(ctx, cx - 10, 32, 20, 1, '#8a889c');
            R(ctx, cx - 10, 33, 1, 5, '#6a687c');
            R(ctx, cx + 7, 33, 3, 6, '#38364a');
            R(ctx, cx - 8, 39, 16, 2, '#fff6c8');
            R(ctx, cx - 6, 39, 6, 1, '#ffffff');
            ctx.globalAlpha = 1;
            // confetti
            if (tt > 30) {
              for (let i = 0; i < 70; i++) {
                const sp = 0.6 + hash(i, 3) * 0.9;
                const fall = (tt - 30) * sp - hash(i, 4) * 420; // staggered starts from the top
                if (fall < 0) continue;
                const y = (fall % 400) - 12;
                const x = Math.round(hash(i, 5) * SW + Math.sin((tt + i * 20) / 24) * 6);
                const flip = Math.floor((tt + i * 7) / 8) % 2;
                R(ctx, x, y, flip ? 3 : 2, flip ? 2 : 3, CONF[i % CONF.length]);
              }
            }
          }
          drawCredits(ctx, t, k, true);
          if (t > 60 * 20 && t >= stopT) {
            const blink = Math.floor(t / 30) % 2;
            const w = 132;
            R(ctx, SW / 2 - w / 2, SH - 30, w, 22, 'rgba(10,6,4,0.7)');
            text(ctx, 'Aでつづける', SW / 2, SH - 27, { align: 'center', size: 14, color: blink ? C.cyan : '#ffffff', shadow: null });
          }
        },
      };
      audio.bgm('ending');
      g.push(scene);
    });
  }
}

installLife(Game.prototype);
