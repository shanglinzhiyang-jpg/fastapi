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

import { W, H, SW, SH, UNIT, LEGACY_SCALE, LEGACY_X, TILE, DIRS, OPP, fmtMoney, clamp, display, makeCanvas } from './util.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { MapScene, PLACES, doorIndexFor, entryFor } from './map.js';
import { MessageScene, ListScene, ShopScene, openMenu } from './ui.js';
import { MINIGAMES } from './minigame.js';
import { text, panel, COLORS } from './draw.js';
import { drawLogo, LOGOS } from './logos.js';
import { charSheet, drawChar } from './sprites.js';
import {
  SKILLS, SKILL_MAX, ITEMS, AGENCIES, RANKS, FINALE_FAME,
  rankIndex, rankName, saveGame, payText,
} from './state.js';
import { installLife, REGULARS, SCRUFFY } from './life.js';

const RANK_MULT = { S: 1.5, A: 1.2, B: 1.0, C: 0.7, D: 0.4 };

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

  setBase(scene) {
    this.scenes = [scene];
    this.input.consume();
  }

  update() {
    this.frame++;
    if (this.state && this.frame % 3600 === 0) this.state.playMinutes++;
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

  fmt(str) {
    const st = this.state || {};
    return String(str)
      .replaceAll('{name}', st.name || 'あなた')
      .replaceAll('{agency}', st.agency ? AGENCIES[st.agency].name : 'フリー');
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
    // a regular show recorded here today: offer to go straight to the studio
    if (changedPlace && this.state && roomId === place.start.room) {
      const due = this.regularsToday(placeId);
      if (due.length) {
        const ask = async () => {
          const r = REGULARS[due[0]];
          const i = await this.ask(`今日は『${r.title}』の収録日だ！\nスタジオへ向かう？（体力 -${r.stamina}）`, ['収録へ行く', 'あとにする'], { cancel: 1 });
          if (i === 0) await this.doRegular(due[0]);
        };
        await (this.busy > 0 ? ask() : this.run(ask));
      }
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

  addFame(n, silent = false) {
    const before = rankIndex(this.state.fame);
    this.state.fame = Math.max(0, this.state.fame + Math.round(n));
    if (!silent && n) this.notify(`知名度 ${n > 0 ? '+' : ''}${Math.round(n)}`, { color: COLORS.pink });
    const after = rankIndex(this.state.fame);
    if (after > before) this.pendingRankUp = RANKS[after][1];
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
    const bonus = opts.bonus ?? Math.max(0, this.skillBonus(skill) + (this.state ? this.lifeBonus(skill) : 0));
    return new Promise((resolve) => {
      let mg;
      try {
        mg = new Cls(this, { ...opts, bonus });
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
      const i = await this.ask(`${desc}「${def.title}」\n${payText(def.pay ?? 3000)}／体力 -${stamina}`, ['受ける', 'やめておく'], { name: def.client, look: def.clientLook });
      if (i !== 0) return null;
    }
    if (st.stamina < stamina) {
      await this.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。');
      return null;
    }
    st.stamina -= stamina;
    const res = await this.minigame(def.minigame, { ...(def.opts || {}), skill: def.skill, title: def.title });
    const agencyBonus = st.agency && AGENCIES[st.agency] && AGENCIES[st.agency].skill === def.skill ? 1.1 : 1;
    const mult = RANK_MULT[res.rank] * agencyBonus;
    const pay = Math.round(((def.pay ?? 3000) * mult) / 10) * 10;
    const scruffy = st.life.clean < SCRUFFY;
    const fame = Math.max(1, Math.round((def.fame ?? 10) * mult * (scruffy ? 0.8 : 1)));
    const fans = Math.max(1, Math.round((def.fans ?? (def.fame ?? 10) * 3) * mult * (scruffy ? 0.8 : 1)));
    const gain = Math.max(1, Math.round((def.gain ?? 2) * (res.rank === 'S' ? 2 : res.rank === 'A' ? 1.5 : res.rank === 'D' ? 0.5 : 1)));
    st.jobs[def.id || def.title] = (st.jobs[def.id || def.title] || 0) + 1;
    st.stats.jobs++;
    this.addMoney(pay, true);
    this.addFame(fame, true);
    this.addFans(fans, true);
    if (def.skill) this.addSkill(def.skill, gain, true);
    this.lifeTick('job');
    // a great result lifts the mood, a bad one weighs on it
    if (res.rank === 'S') this.addNeed('stress', -10);
    else if (res.rank === 'D') this.addNeed('stress', 6);
    audio.sfx('coin');
    const lines = [`お仕事終了！ランク${res.rank}`, `ギャラ ${fmtMoney(pay)}　知名度 +${fame}　ファン +${fans}` + (def.skill ? `\n${SKILLS[def.skill]} +${gain}` : '')];
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
  // messages: see life.js), autosaves.
  async sleep(opts = {}) {
    const hungerAtNight = this.state.life.hunger;
    await this.fadeOut(20);
    audio.sfx('sleep');
    await this.wait(1200);
    this.state.day++;
    this.state.stamina = this.state.maxStamina;
    await this.morning(hungerAtNight);
    await this.fadeIn(20);
    this.notify(`${this.dayLabel()}の朝`, { color: '#fff' });
    if (opts.save !== false) this.save();
  }

  // ---------------------------------------------------------------- ending
  ending() {
    return new Promise((resolve) => {
      const g = this;
      const st = g.state;
      const lines = [
        'ドット芸能界',
        '',
        `${st.name}は ついに`,
        '国民的スターになった！',
        '',
        `かかった日数　${st.day}日`,
        `こなしたお仕事　${st.stats.jobs}回`,
        `知名度　★${st.fame}`,
        '',
        '― お世話になった場所 ―',
        'よしもと / よしもと新喜劇 / BSよしもと',
        '松竹芸能 / グレープカンパニー',
        'NHK / 東映 / ホリプロ / 東宝',
        '',
        '※実在の企業名・ロゴは',
        'それぞれの権利者に帰属します。',
        '登場人物はすべて架空です。',
        '',
        'THANK YOU FOR PLAYING!',
      ];
      // the credits stop with the last line in the upper half, then the player takes a bow
      const SPEED = 0.42;
      const LAST_Y = 84;
      const maxScroll = H + 10 + (lines.length - 1) * 20 - LAST_Y;
      const sheet = charSheet(st.look || {});
      const scene = {
        opaque: true,
        t: 0,
        update(gg) {
          scene.t++;
          if (gg.auto || (scene.t > 60 * 20 && scene.t * SPEED >= maxScroll && gg.input.pressed('a'))) {
            // cut to black, then fade back into whatever is underneath
            gg.fade = 1;
            gg.pop(scene);
            gg.fadeIn(30);
            resolve();
          }
        },
        draw(ctx) {
          ctx.fillStyle = '#0b0d1a';
          ctx.fillRect(0, 0, W, H);
          for (let i = 0; i < 40; i++) {
            const x = (i * 97 + scene.t * (0.2 + (i % 3) * 0.1)) % W;
            const y = (i * 53) % H;
            ctx.fillStyle = i % 5 ? '#3a4a8a' : '#fff6a8';
            ctx.fillRect(Math.round(x), y, 1, 1);
          }
          const scroll = Math.min(scene.t * SPEED, maxScroll);
          lines.forEach((l, i) => {
            const y = Math.round(H + 10 + i * 20 - scroll);
            if (y < -20 || y > H + 20) return;
            text(ctx, l, W / 2, y, { align: 'center', size: i === 0 ? 20 : 12, color: i === 0 ? COLORS.accent : '#fff' });
          });
          const stopT = maxScroll / SPEED;
          if (scene.t >= stopT) {
            // spotlight + the player, 3x, hopping a little
            const k = Math.min(1, (scene.t - stopT) / 40);
            ctx.globalAlpha = k;
            ctx.fillStyle = 'rgba(255,246,168,0.16)';
            ctx.beginPath();
            ctx.moveTo(W / 2 - 10, 100); ctx.lineTo(W / 2 + 10, 100);
            ctx.lineTo(W / 2 + 44, 196); ctx.lineTo(W / 2 - 44, 196);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,246,168,0.3)';
            ctx.fillRect(W / 2 - 40, 190, 80, 6);
            const hop = Math.floor((scene.t - stopT) / 20) % 4 === 1 ? 3 : 0;
            ctx.save();
            ctx.translate(W / 2 - 24, 132 - hop);
            ctx.scale(3, 3);
            drawChar(ctx, sheet, 'down', 0, 0, 4);
            ctx.restore();
            ctx.globalAlpha = 1;
          }
          if (scene.t > 60 * 20 && scene.t >= stopT) text(ctx, 'Aでつづける', W / 2, H - 24, { align: 'center', size: 10, color: COLORS.cyan });
        },
      };
      audio.bgm('ending');
      g.push(scene);
    });
  }
}

installLife(Game.prototype);
