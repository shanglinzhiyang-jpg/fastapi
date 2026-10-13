// UI scenes: message window, choices, shop, pause menu, plus HUD helpers.
// Scenes are plain objects with update(g) / draw(ctx, g); see game.js.

import { W, H, fmtMoney, clamp } from './util.js';
import { text, wrap, panel, cursor, downArrow, bar, measure, rect, COLORS } from './draw.js';
import { drawFace } from './sprites.js';
import { audio } from './audio.js';
import { SKILLS, SKILL_MAX, ITEMS, AGENCIES, rankName, RANKS, rankIndex } from './state.js';

const BOX = { x: 4, y: 172, w: 312, h: 64 };
const LINE_H = 17;
const LINES = 3;
const TEXT_W = BOX.w - 22;

// ---------------------------------------------------------------- message window
export class MessageScene {
  constructor(g, pages, opts, resolve) {
    this.g = g;
    this.opts = opts || {};
    this.resolve = resolve;
    this.pages = [];
    for (const p of pages) {
      const lines = wrap(g.ctx, p, TEXT_W, 12);
      for (let i = 0; i < lines.length; i += LINES) this.pages.push(lines.slice(i, i + LINES));
    }
    if (!this.pages.length) this.pages.push(['']);
    this.page = 0;
    this.shown = 0;
    this.t = 0;
    this.choice = null;
    this.speed = this.opts.speed || 0.75;
    this.top = !!this.opts.top;
  }

  get pageText() { return this.pages[this.page].join(''); }

  update(g) {
    this.t++;
    const inp = g.input;
    if (g.auto) {
      if (g.auto.log) g.auto.log.push({ name: this.opts.name || '', text: this.pages.map((p) => p.join('')).join(' / '), choices: this.opts.choices || null });
      if (this.opts.choices) {
        const n = this.opts.choices.length;
        let pick = typeof g.auto.choice === 'function' ? g.auto.choice(this.opts.choices, this.pages) : (g.auto.choice ?? 0);
        pick = Math.max(0, Math.min(n - 1, pick | 0));
        this.close(pick);
      } else this.close(0);
      return;
    }
    if (this.choice) {
      this.choice.update(g);
      return;
    }
    const total = Array.from(this.pageText).length;
    if (this.shown < total) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(total, this.shown + this.speed * (inp.down('b') ? 3 : 1));
      if (Math.floor(this.shown) !== before && before % 3 === 0 && !this.opts.silent) audio.sfx('talk');
      if (inp.pressed('a') && this.t > 4) this.shown = total;
      return;
    }
    const last = this.page === this.pages.length - 1;
    if (last && this.opts.choices) {
      this.choice = new ChoiceBox(this.opts.choices, this.opts.cancel, (i) => this.close(i), this.opts.choiceStyle);
      return;
    }
    if (this.opts.auto && this.t > this.opts.auto) { this.next(); return; }
    if (inp.pressed('a') || (inp.pressed('b') && !this.opts.noSkip)) this.next();
  }

  next() {
    audio.sfx('cursor');
    if (this.page < this.pages.length - 1) {
      this.page++;
      this.shown = 0;
      this.t = 0;
    } else {
      this.close(0);
    }
  }

  close(v) {
    this.g.pop(this);
    this.resolve(v);
  }

  draw(ctx, g) {
    const by = this.top ? 4 : BOX.y;
    const name = this.opts.name;
    if (name) {
      const face = this.opts.look || this.opts.face ? 18 : 0;
      const nw = Math.max(48, measure(ctx, name, 12) + 18 + face);
      const ny = this.top ? by + BOX.h - 2 : by - 18;
      panel(ctx, BOX.x, ny, nw, 20, { bg: this.opts.nameBg || '#2a3a7a' });
      if (this.opts.face) this.opts.face(ctx, BOX.x + 5, ny + 4);
      else if (this.opts.look) drawFace(ctx, this.opts.look, BOX.x + 5, ny + 4, 1);
      text(ctx, name, BOX.x + 8 + face, ny + 4, { color: this.opts.nameColor || COLORS.accent });
    }
    panel(ctx, BOX.x, by, BOX.w, BOX.h);
    const lines = this.pages[this.page];
    let remain = Math.floor(this.shown);
    for (let i = 0; i < lines.length; i++) {
      const chars = Array.from(lines[i]);
      const vis = chars.slice(0, Math.max(0, remain)).join('');
      remain -= chars.length;
      text(ctx, vis, BOX.x + 11, by + 8 + i * LINE_H, { color: this.opts.color || COLORS.text });
    }
    const total = Array.from(this.pageText).length;
    if (this.shown >= total && !this.choice && !(this.opts.choices && this.page === this.pages.length - 1)) {
      downArrow(ctx, BOX.x + BOX.w - 16, by + BOX.h - 12, this.t);
    }
    if (this.choice) this.choice.draw(ctx, g, this.top ? by + BOX.h + 4 : by - 4);
  }
}

// ---------------------------------------------------------------- choice list
export class ChoiceBox {
  constructor(choices, cancel, onPick, style = {}) {
    this.choices = choices;
    this.cancel = cancel;
    this.onPick = onPick;
    this.idx = 0;
    this.t = 0;
    this.style = style;
  }
  update(g) {
    this.t++;
    const inp = g.input;
    const n = this.choices.length;
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; audio.sfx('cursor'); }
    if (inp.pressed('a') && this.t > 3) { audio.sfx('ok'); this.onPick(this.idx); return; }
    if (inp.pressed('b') && this.cancel != null) { audio.sfx('cancel'); this.onPick(this.cancel); }
  }
  draw(ctx, g, bottomY) {
    const n = this.choices.length;
    const w = Math.min(300, Math.max(...this.choices.map((c) => measure(ctx, c, 12))) + 30);
    const h = n * 16 + 10;
    const x = W - w - 4;
    const y = Math.max(2, bottomY - h);
    panel(ctx, x, y, w, h);
    this.choices.forEach((c, i) => {
      text(ctx, c, x + 18, y + 6 + i * 16, { color: i === this.idx ? COLORS.accent : COLORS.text });
      if (i === this.idx) cursor(ctx, x + 7, y + 8 + i * 16, this.t);
    });
  }
}

// Standalone list chooser that stays open (used by menus).
export class ListScene {
  constructor(g, { title, items, x = 8, y = 8, w = 180, cancel = -1, describe = null, onDraw = null }, resolve) {
    Object.assign(this, { g, title, items, x, y, w, cancel, describe, onDraw, resolve });
    this.idx = 0;
    this.t = 0;
  }
  update(g) {
    this.t++;
    const n = this.items.length;
    const inp = g.input;
    if (g.auto) {
      g.auto.lists = (g.auto.lists || 0) + 1;
      g.pop(this);
      const pick = typeof g.auto.list === 'function' ? g.auto.list(this.items) : (n && g.auto.lists % 3 === 1 ? 0 : this.cancel);
      this.resolve(pick);
      return;
    }
    if (n && inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; audio.sfx('cursor'); }
    if (n && inp.repeat('down')) { this.idx = (this.idx + 1) % n; audio.sfx('cursor'); }
    if (n && inp.pressed('a') && this.t > 3) { audio.sfx('ok'); g.pop(this); this.resolve(this.idx); return; }
    if (inp.pressed('b') || inp.pressed('menu')) { audio.sfx('cancel'); g.pop(this); this.resolve(this.cancel); }
  }
  draw(ctx) {
    const rows = Math.min(9, this.items.length || 1);
    const top = Math.max(0, Math.min(this.idx - rows + 1, this.items.length - rows));
    const h = rows * 16 + (this.title ? 26 : 10);
    panel(ctx, this.x, this.y, this.w, h);
    let yy = this.y + 6;
    if (this.title) { text(ctx, this.title, this.x + 10, yy, { color: COLORS.cyan }); yy += 18; }
    if (!this.items.length) text(ctx, '（なし）', this.x + 18, yy, { color: COLORS.dim });
    for (let i = top; i < Math.min(this.items.length, top + rows); i++) {
      const it = this.items[i];
      const label = typeof it === 'string' ? it : it.label;
      const right = typeof it === 'string' ? null : it.right;
      const sel = i === this.idx;
      const dim = typeof it !== 'string' && it.disabled;
      text(ctx, label, this.x + 18, yy, { color: sel ? COLORS.accent : dim ? COLORS.dim : COLORS.text });
      if (right) text(ctx, right, this.x + this.w - 10, yy, { align: 'right', color: sel ? COLORS.accent : COLORS.text });
      if (sel) cursor(ctx, this.x + 7, yy + 2, this.t);
      yy += 16;
    }
    if (this.describe && this.items.length) {
      const d = this.describe(this.idx);
      if (d) {
        panel(ctx, 4, BOX.y + 12, BOX.w, 52);
        wrap(ctx, d, TEXT_W, 12).slice(0, 2).forEach((l, i) => text(ctx, l, 15, BOX.y + 20 + i * LINE_H));
      }
    }
    if (this.onDraw) this.onDraw(ctx, this);
  }
}

// ---------------------------------------------------------------- HUD
export function drawHud(ctx, g) {
  const st = g.state;
  if (!st) return;
  panel(ctx, 2, 2, 124, 34, { bg: 'rgba(18,26,58,0.88)' });
  text(ctx, `${st.day}日目`, 9, 5, { size: 10, color: COLORS.cyan });
  text(ctx, fmtMoney(st.money), 120, 5, { size: 10, align: 'right', color: COLORS.accent });
  text(ctx, `★${st.fame}`, 9, 19, { size: 10, color: COLORS.pink });
  text(ctx, rankName(st.fame), 120, 19, { size: 10, align: 'right' });
  // stamina, with the agency (short name) on the same line: one row only, so wall
  // signs just below the HUD in small rooms stay visible
  const a = st.agency && AGENCIES[st.agency];
  const label = a ? (a.short || a.name) : '';
  const lw = a ? measure(ctx, label, 10) + 10 : 0;
  const px = W - 92 - lw;
  panel(ctx, px, 2, W - 2 - px, 22, { bg: 'rgba(18,26,58,0.88)' });
  if (a) {
    text(ctx, label, px + 7, 7, { size: 10, color: COLORS.dim });
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(W - 92, 7, 1, 12);
  }
  text(ctx, '体力', W - 86, 7, { size: 10 });
  const frac = st.stamina / st.maxStamina;
  bar(ctx, W - 60, 9, 52, 7, frac, frac > 0.5 ? COLORS.good : frac > 0.2 ? COLORS.accent : COLORS.bad);
}

export function drawToasts(ctx, g) {
  let y = 44;
  for (const t of g.toasts) {
    const a = t.t < 10 ? t.t / 10 : t.life - t.t < 15 ? (t.life - t.t) / 15 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const w = measure(ctx, t.text, 12) + 16;
    const x = Math.round((W - w) / 2);
    panel(ctx, x, y, w, 20, { bg: t.bg || '#2a3a7a' });
    text(ctx, t.text, W / 2, y + 4, { align: 'center', color: t.color || COLORS.accent });
    ctx.globalAlpha = 1;
    y += 22;
  }
}

export function drawBanner(ctx, g) {
  const b = g.banner;
  if (!b) return;
  const slide = b.t < 12 ? (12 - b.t) * 12 : b.life - b.t < 12 ? (12 - (b.life - b.t)) * 12 : 0;
  const w = Math.max(120, measure(ctx, b.text, 12) + 28);
  const x = W - w - 4 + slide;
  const y = H - 30;
  panel(ctx, x, y, w, 24, { bg: '#1d2a5e' });
  text(ctx, b.text, x + w / 2, y + 6, { align: 'center', color: '#fff' });
}

// ---------------------------------------------------------------- status screen
export class StatusScene {
  constructor(g, resolve) { this.g = g; this.resolve = resolve; this.t = 0; this.opaque = false; this.hidesHud = true; }
  update(g) {
    this.t++;
    if (g.auto) { g.pop(this); this.resolve(); return; }
    if (this.t > 3 && (g.input.pressed('a') || g.input.pressed('b') || g.input.pressed('menu'))) {
      audio.sfx('cancel');
      g.pop(this);
      this.resolve();
    }
  }
  draw(ctx, g) {
    const st = g.state;
    panel(ctx, 8, 8, W - 16, H - 16);
    drawFace(ctx, st.look || {}, 20, 18, 3);
    text(ctx, st.name, 76, 18, { size: 16, color: COLORS.accent });
    text(ctx, `${rankName(st.fame)}　★${st.fame}`, 76, 40, { color: COLORS.pink });
    const ri = rankIndex(st.fame);
    const next = RANKS[ri + 1];
    text(ctx, next ? `次の称号「${next[1]}」まで ★${next[0] - st.fame}` : '頂点に立った！', 76, 56, { size: 10, color: COLORS.dim });
    text(ctx, `所属：${st.agency ? AGENCIES[st.agency].name : 'フリー（未所属）'}`, 20, 76);
    text(ctx, `所持金：${fmtMoney(st.money)}`, 20, 92);
    text(ctx, `${st.day}日目　お仕事 ${st.stats.jobs}回`, 170, 92);
    text(ctx, `体力：${st.stamina}/${st.maxStamina}`, 170, 76);
    let y = 114;
    for (const [k, name] of Object.entries(SKILLS)) {
      text(ctx, name, 20, y);
      bar(ctx, 80, y + 3, 150, 8, st.skills[k] / SKILL_MAX, ['#ff8a3d', '#5fd7ff', '#ff7eb6', '#5ee07a'][Object.keys(SKILLS).indexOf(k)]);
      text(ctx, String(st.skills[k]), 240, y, { color: COLORS.accent });
      y += 18;
    }
    text(ctx, 'Aでもどる', W - 18, H - 30, { align: 'right', size: 10, color: COLORS.dim });
  }
}

// ---------------------------------------------------------------- shop
export class ShopScene {
  constructor(g, goods, opts, resolve) {
    this.g = g;
    this.goods = goods.map((x) => (typeof x === 'string' ? { item: x } : x));
    this.opts = opts || {};
    this.resolve = resolve;
    this.idx = 0;
    this.t = 0;
    this.msg = this.opts.greeting || 'いらっしゃいませ！';
    this.bought = 0;
    this.hidesHud = true; // MapScene skips the HUD while this is open (it has its own money panel)
  }
  price(gd) { return gd.price ?? ITEMS[gd.item]?.price ?? 0; }
  update(g) {
    this.t++;
    const n = this.goods.length + 1;
    const inp = g.input;
    if (g.auto) { g.pop(this); this.resolve(0); return; }
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; audio.sfx('cursor'); }
    if ((inp.pressed('b') || inp.pressed('menu')) || (inp.pressed('a') && this.idx === this.goods.length && this.t > 3)) {
      audio.sfx('cancel');
      g.pop(this);
      this.resolve(this.bought);
      return;
    }
    if (inp.pressed('a') && this.t > 3) {
      const gd = this.goods[this.idx];
      const p = this.price(gd);
      if (g.state.money < p) { audio.sfx('buzz'); this.msg = 'お金が足りないみたいです…'; return; }
      g.state.money -= p;
      g.giveItem(gd.item, 1, true);
      this.bought++;
      audio.sfx('coin');
      this.msg = `${ITEMS[gd.item]?.name || gd.item}を買った！（持ち数 ${g.state.items[gd.item]}）`;
    }
  }
  draw(ctx, g) {
    const x = 150, y = 8, w = 162;
    const rows = this.goods.length + 1;
    panel(ctx, x, y, w, rows * 16 + 28);
    text(ctx, this.opts.title || 'おみせ', x + 10, y + 6, { color: COLORS.cyan });
    this.goods.forEach((gd, i) => {
      const sel = i === this.idx;
      const it = ITEMS[gd.item] || { name: gd.item };
      text(ctx, it.name, x + 18, y + 24 + i * 16, { color: sel ? COLORS.accent : COLORS.text, size: 12 });
      text(ctx, fmtMoney(this.price(gd)), x + w - 8, y + 24 + i * 16, { align: 'right', size: 10, color: sel ? COLORS.accent : COLORS.dim });
      if (sel) cursor(ctx, x + 7, y + 26 + i * 16, this.t);
    });
    const ey = y + 24 + this.goods.length * 16;
    text(ctx, 'やめる', x + 18, ey, { color: this.idx === this.goods.length ? COLORS.accent : COLORS.text });
    if (this.idx === this.goods.length) cursor(ctx, x + 7, ey + 2, this.t);
    panel(ctx, 8, 8, 136, 22);
    text(ctx, '所持金 ' + fmtMoney(g.state.money), 16, 12, { color: COLORS.accent });
    panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h);
    const gd = this.goods[this.idx];
    const desc = gd ? (ITEMS[gd.item]?.desc || '') : 'お店を出る。';
    wrap(ctx, this.msg, TEXT_W, 12).slice(0, 1).forEach((l) => text(ctx, l, BOX.x + 11, BOX.y + 8, { color: COLORS.accent }));
    wrap(ctx, desc, TEXT_W, 12).slice(0, 2).forEach((l, i) => text(ctx, l, BOX.x + 11, BOX.y + 8 + (i + 1) * LINE_H));
  }
}

// ---------------------------------------------------------------- pause menu
export async function openMenu(g) {
  for (;;) {
    const items = ['ステータス', 'もちもの', 'セーブ', audio.muted ? '音：OFF' : '音：ON', 'とじる'];
    if (g.debugMenu) items.push('デバッグ');
    const i = await g.list({ items, x: W - 112, y: 46, w: 104 });
    if (i === 5 && g.debugMenu) { await g.debugMenu(); continue; }
    if (i === 0) await new Promise((r) => g.push(new StatusScene(g, r)));
    else if (i === 1) await itemMenu(g);
    else if (i === 2) {
      if (g.map && g.map.place && g.map.place.noSave) {
        await g.say('ここではセーブできないみたいだ。');
      } else if (g.save()) {
        audio.sfx('success');
        await g.say('セーブしました。');
      } else await g.say('セーブできませんでした…');
    } else if (i === 3) {
      audio.unlock();
      audio.toggleMute();
    } else return;
  }
}

async function itemMenu(g) {
  for (;;) {
    const ids = Object.keys(g.state.items).filter((k) => g.state.items[k] > 0);
    const items = ids.map((id) => ({ label: ITEMS[id]?.name || id, right: '×' + g.state.items[id] }));
    const i = await g.list({ title: `もちもの（食事 あと${g.mealsLeft()}回）`, items, x: 8, y: 46, w: 200, describe: (k) => ITEMS[ids[k]]?.desc });
    if (i < 0) return;
    const id = ids[i];
    const it = ITEMS[id] || {};
    if (it.heal) {
      if (g.state.stamina >= g.state.maxStamina) { await g.say('体力は満タンだ。'); continue; }
      // food is limited per day (g.eat); a refused item is not used up
      if (g.mealsLeft() <= 0) { await g.say('おなかいっぱいだ…\n今日はもう食べられない。\n（寝ると、また食べられるようになる）'); continue; }
      g.takeItem(id);
      const got = g.eat(it.heal, { silent: true });
      audio.sfx('good');
      await g.say(`${it.name}を使った！体力が${got}回復した。` + (g.mealsLeft() <= 0 ? '\nおなかいっぱいになった。' : ''));
    } else if (it.buff) {
      if (g.state.buffs[it.buff]) { await g.say('もう効果が出ている。'); continue; }
      g.takeItem(id);
      g.state.buffs[it.buff] = true;
      audio.sfx('good');
      await g.say(`${it.name}を使った！次の「${SKILLS[it.buff]}」のミニゲームが少しやさしくなる。`);
    } else if (it.use) {
      await it.use(g);
    } else {
      await g.say(it.desc || 'これは使うものではないようだ。');
    }
  }
}

export { BOX, LINE_H, TEXT_W, rect };
