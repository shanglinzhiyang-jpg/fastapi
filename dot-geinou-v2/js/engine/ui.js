// UI scenes: message window, choices, shop, pause menu, plus HUD helpers.
// Scenes are plain objects with update(g) / draw(ctx, g); see game.js.
// Everything here is an `hd` scene: coordinates are screen pixels (SW x SH).

import { SW, SH, fmtMoney, yenText, clamp } from './util.js';
import { text, wrap, panel, cursor, downArrow, bar, measure, rect, COLORS } from './draw.js';
import { drawFaceHD } from './sprites.js';
import { audio } from './audio.js';
import { SKILLS, SKILL_MAX, ITEMS, AGENCIES, rankName, RANKS, rankIndex } from './state.js';
import { NotebookScene } from './notebook.js';
import { HUNGRY, STRESSED, SCRUFFY } from './life.js';
import { openPhone } from './phone.js';
import { eraOf, fullName, ageOf, prefecture, GENDERS, PERSONALITIES } from './profile.js';

const FS = 16; // body text size
const BOX = { x: 12, y: SH - 96, w: SW - 24, h: 86 };
const LINE_H = 23;
const LINES = 3;
const TEXT_W = BOX.w - 40;
const ROW = 24; // list row height

// ---------------------------------------------------------------- message window
export class MessageScene {
  constructor(g, pages, opts, resolve) {
    this.hd = true;
    this.g = g;
    this.opts = opts || {};
    this.resolve = resolve;
    this.pages = [];
    for (const p of pages) {
      const lines = wrap(g.ctx, p, TEXT_W, FS);
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
    const by = this.top ? 8 : BOX.y;
    const name = this.opts.name;
    if (name) {
      const face = this.opts.look || this.opts.face ? 38 : 0;
      const nh = face ? 34 : 28;
      const nw = Math.max(80, measure(ctx, name, FS) + 26 + face);
      const ny = this.top ? by + BOX.h - 2 : by - nh + 2;
      panel(ctx, BOX.x, ny, nw, nh, { bg: this.opts.nameBg || '#2a3a7a' });
      if (this.opts.face) {
        // content face drawers draw 16x12 v1 pixels: show them at 2x
        ctx.save();
        ctx.translate(BOX.x + 8, ny + 5);
        ctx.scale(2, 2);
        this.opts.face(ctx, 0, 0);
        ctx.restore();
      } else if (this.opts.look) drawFaceHD(ctx, this.opts.look, BOX.x + 8, ny + 5, 1);
      text(ctx, name, BOX.x + 12 + face, ny + (nh - FS) / 2, { size: FS, color: this.opts.nameColor || COLORS.accent });
    }
    panel(ctx, BOX.x, by, BOX.w, BOX.h);
    const lines = this.pages[this.page];
    let remain = Math.floor(this.shown);
    for (let i = 0; i < lines.length; i++) {
      const chars = Array.from(lines[i]);
      const vis = chars.slice(0, Math.max(0, remain)).join('');
      remain -= chars.length;
      text(ctx, vis, BOX.x + 18, by + 10 + i * LINE_H, { size: FS, color: this.opts.color || COLORS.text });
    }
    const total = Array.from(this.pageText).length;
    if (this.shown >= total && !this.choice && !(this.opts.choices && this.page === this.pages.length - 1)) {
      downArrow(ctx, BOX.x + BOX.w - 22, by + BOX.h - 16, this.t);
    }
    if (this.choice) this.choice.draw(ctx, g, this.top ? by + BOX.h + 6 : by - 6, this.top);
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
  // bottomY: the edge the box hangs from (its bottom, or its top when below = true)
  draw(ctx, g, bottomY, below = false) {
    const n = this.choices.length;
    const w = Math.min(SW - 24, Math.max(...this.choices.map((c) => measure(ctx, c, FS))) + 44);
    const h = n * ROW + 14;
    const x = SW - w - 12;
    const y = below ? Math.min(SH - h - 4, bottomY) : Math.max(4, bottomY - h);
    panel(ctx, x, y, w, h);
    this.choices.forEach((c, i) => {
      text(ctx, c, x + 28, y + 8 + i * ROW, { size: FS, color: i === this.idx ? COLORS.accent : COLORS.text });
      if (i === this.idx) cursor(ctx, x + 12, y + 12 + i * ROW, this.t);
    });
  }
}

// Standalone list chooser that stays open (used by menus).
// x, y, w are v1 (320x240) positions, mapped onto the screen; pass px: true to
// give screen pixels instead.
export class ListScene {
  constructor(g, { title, items, x = 8, y = 8, w = 180, cancel = -1, describe = null, onDraw = null, index = 0, px = false }, resolve) {
    if (!px) { x = Math.round(x * 2); y = Math.round(y * 1.5); w = Math.round(w * 2); }
    w = Math.min(w, SW - 8 - x);
    Object.assign(this, { g, title, items, x, y, w, cancel, describe, onDraw, resolve });
    this.hd = true;
    this.idx = clamp(index | 0, 0, Math.max(0, items.length - 1)); // index: where the cursor starts
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
    const g = this.g;
    const head = this.title ? 34 : 14;
    const bottom = this.describe ? BOX.y + 10 - 6 : SH - 6;
    // a long list is pulled up to show more rows, but never over the map's HUD (it shows fewer rows instead)
    const hud = g && g.map && g.scenes[0] === g.map && g.state && !g.scenes.some((s) => s.hidesHud) ? HUD_H + 4 : 4;
    const y = Math.max(hud, Math.min(this.y, bottom - head - Math.min(9, this.items.length || 1) * ROW));
    const rows = Math.max(1, Math.min(9, this.items.length || 1, Math.floor((bottom - y - head) / ROW)));
    const top = Math.max(0, Math.min(this.idx - rows + 1, this.items.length - rows));
    const h = rows * ROW + head;
    const more = top + rows < this.items.length || top > 0; // scroll arrows at the right edge
    panel(ctx, this.x, y, this.w, h);
    let yy = y + 8;
    if (this.title) { text(ctx, this.title, this.x + 14, yy, { size: FS, color: COLORS.cyan }); yy += 26; }
    if (!this.items.length) text(ctx, '（なし）', this.x + 28, yy, { size: FS, color: COLORS.dim });
    for (let i = top; i < Math.min(this.items.length, top + rows); i++) {
      const it = this.items[i];
      // literal prices in labels (「もやし炒め（¥100）」) follow the era like g.fmt texts
      const label = yenText(typeof it === 'string' ? it : it.label);
      const right = typeof it === 'string' || it.right == null ? null : yenText(it.right);
      const sel = i === this.idx;
      const dim = typeof it !== 'string' && it.disabled;
      text(ctx, label, this.x + 28, yy, { size: FS, color: sel ? COLORS.accent : dim ? COLORS.dim : COLORS.text });
      if (right) text(ctx, right, this.x + this.w - (more ? 30 : 14), yy, { size: FS, align: 'right', color: sel ? COLORS.accent : COLORS.text });
      if (sel) cursor(ctx, this.x + 12, yy + 4, this.t);
      yy += ROW;
    }
    // more rows above / below
    if (top > 0) downArrowUp(ctx, this.x + this.w - 24, y + 10, this.t);
    if (top + rows < this.items.length) downArrow(ctx, this.x + this.w - 24, y + h - 14, this.t);
    if (this.describe && this.items.length) {
      const d0 = this.describe(this.idx);
      const d = d0 ? yenText(d0) : d0;
      if (d) {
        panel(ctx, BOX.x, BOX.y + 10, BOX.w, BOX.h - 10);
        wrap(ctx, d, TEXT_W, FS).slice(0, 3).forEach((l, i) => text(ctx, l, BOX.x + 18, BOX.y + 18 + i * 21, { size: FS }));
      }
    }
    if (this.onDraw) this.onDraw(ctx, this);
  }
}

// ---------------------------------------------------------------- HUD
// Top-left: day, money, fame and title. Top-right: agency and stamina. Both stay
// within HUD_H pixels so the map can keep small rooms clear of them.
export const HUD_H = 46;
const HUD_BG = 'rgba(18,26,58,0.88)';
export function drawHud(ctx, g) {
  const st = g.state;
  if (!st) return;
  panel(ctx, 4, 4, 236, HUD_H - 4, { bg: HUD_BG });
  text(ctx, g.dayLabel(), 14, 9, { size: 14, color: COLORS.cyan });
  text(ctx, fmtMoney(st.money), 228, 9, { size: 14, align: 'right', color: COLORS.accent });
  text(ctx, `★${st.fame}`, 14, 26, { size: 14, color: COLORS.pink });
  text(ctx, rankName(st.fame), 228, 26, { size: 14, align: 'right' });
  // right: agency + stamina, then the three needs
  const a = st.agency && AGENCIES[st.agency];
  const label = a ? (a.short || a.name) : 'フリー';
  const pw = 250;
  const px = SW - 4 - pw;
  panel(ctx, px, 4, pw, HUD_H - 4, { bg: HUD_BG });
  text(ctx, label, px + 12, 9, { size: 12, color: COLORS.dim });
  const unread = g.unread();
  if (unread) {
    const blink = Math.floor(g.frame / 30) % 2;
    rect(ctx, px + 96, 10, 18, 12, blink ? '#ffd23f' : '#ffffff');
    rect(ctx, px + 97, 11, 16, 10, '#2a3a7a');
    for (let i = 0; i < 4; i++) { rect(ctx, px + 98 + i * 2, 12 + i, 2, 1, '#fff'); rect(ctx, px + 110 - i * 2, 12 + i, 2, 1, '#fff'); }
    text(ctx, String(unread), px + 118, 9, { size: 12, color: COLORS.accent });
  }
  text(ctx, '体力', px + 134, 9, { size: 12 });
  const frac = st.stamina / st.maxStamina;
  bar(ctx, px + 164, 12, pw - 176, 9, frac, frac > 0.5 ? COLORS.good : frac > 0.2 ? COLORS.accent : COLORS.bad);
  // the three needs: a short label (red and blinking past its penalty line) and a bar
  const L = st.life;
  const warn = Math.floor(g.frame / 20) % 2 === 0;
  let nx = px + 10;
  nx = needGauge(ctx, nx, 26, '満腹', L.hunger / 100, '#ff9a3c', L.hunger < HUNGRY, warn);
  nx = needGauge(ctx, nx, 26, 'ストレス', L.stress / 100, L.stress >= STRESSED ? COLORS.bad : L.stress >= 40 ? COLORS.accent : '#b48cff', L.stress >= STRESSED, warn);
  needGauge(ctx, nx, 26, '身なり', L.clean / 100, COLORS.cyan, L.clean < SCRUFFY, warn);
}

// One need on the HUD; returns the x where the next one starts.
const NEED_BAR_W = 32;
function needGauge(ctx, x, y, label, frac, color, alert, blink) {
  const lw = measure(ctx, label, 12);
  text(ctx, label, x, y, { size: 12, color: alert ? (blink ? COLORS.bad : '#ffffff') : COLORS.dim });
  bar(ctx, x + lw + 3, y + 3, NEED_BAR_W, 9, frac, color);
  return x + lw + 3 + NEED_BAR_W + 8;
}

export function drawToasts(ctx, g) {
  let y = HUD_H + 10;
  for (const t of g.toasts) {
    const a = t.t < 10 ? t.t / 10 : t.life - t.t < 15 ? (t.life - t.t) / 15 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const w = measure(ctx, t.text, FS) + 28;
    const x = Math.round((SW - w) / 2);
    panel(ctx, x, y, w, 30, { bg: t.bg || '#2a3a7a' });
    text(ctx, t.text, SW / 2, y + 7, { size: FS, align: 'center', color: t.color || COLORS.accent });
    ctx.globalAlpha = 1;
    y += 34;
  }
}

export function drawBanner(ctx, g) {
  const b = g.banner;
  if (!b) return;
  const slide = b.t < 12 ? (12 - b.t) * 24 : b.life - b.t < 12 ? (12 - (b.life - b.t)) * 24 : 0;
  const w = Math.max(200, measure(ctx, b.text, FS) + 44);
  const x = SW - w - 12 + slide; // right edge in line with the message window
  const y = SH - 44;
  panel(ctx, x, y, w, 34, { bg: '#1d2a5e' });
  text(ctx, b.text, x + w / 2, y + 9, { size: FS, align: 'center', color: '#fff' });
}

// ---------------------------------------------------------------- status screen
// The compact 政治 / 法 line of the status screen: [label, text, color] pairs, only when they
// matter (an office, a party or a candidacy; a record, a sentence, a case). Read once when the
// screen opens; each core is optional (an old save simply has nothing to show).
function civicLines(g) {
  const out = [];
  const st = g.state || {};
  try {
    const p = st.politics;
    const me = p && p.me;
    if (me && (me.office || me.party || me.candidacy) && typeof g.partyName === 'function') {
      const OFFICE = { kugi: '区議会議員', togi: '都議会議員', shicho: '区長', chiji: '都知事', shugi: '衆議院議員', sangi: '参議院議員' };
      const posts = Array.isArray(me.posts) ? me.posts : [];
      // the highest post first: 総理 → 大臣・官房長官 → 党首
      const cab = posts.includes('pm') ? 'pm' : posts.find((x) => x === 'kanbo' || /^minister_/.test(x)) || (posts.includes('party_leader') ? 'party_leader' : null);
      const top = cab && typeof g.postLabel === 'function' ? g.postLabel(cab) : null;
      const office = top || (me.office ? OFFICE[me.office] || me.office : me.candidacy ? '立候補中' : '党員');
      const party = me.party ? g.partyName(me.party, true) : '無所属';
      out.push(['政治', `${office}・${party}`, COLORS.cyan]);
    }
  } catch (e) { console.error('[status] politics', e); }
  try {
    const j = st.justice;
    if (j && typeof g.justiceStatus === 'function') {
      const s = g.justiceStatus();
      const day = st.day;
      const left = (d) => (d > day ? `（あと${d - day}日）` : '');
      let t = null, c = COLORS.accent;
      if (s.status === 'prison') { t = `服役中${left(s.prisonUntil)}`; c = COLORS.bad; }
      else if (s.status === 'detained') { t = '身柄拘束中'; c = COLORS.bad; }
      else if (s.status === 'trial' || (s.cases && s.cases.length)) { t = '事件の手続き中'; c = COLORS.bad; }
      else if (s.suspendUntil) t = `執行猶予中${left(s.suspendUntil)}`;
      // after 仮釈放 (or a juvenile 保護観察) the status is 'probation' without a suspended sentence
      else if (s.probationUntil) t = `保護観察中${left(s.probationUntil)}`;
      // a 公民権停止 matters more than the bare record: shown together when both apply
      else if (s.hasRecord) t = s.civicBanUntil ? `前科あり・公民権停止${left(s.civicBanUntil)}` : '前科あり';
      else if (s.civicBanUntil) t = `公民権停止${left(s.civicBanUntil)}`;
      if (t) out.push(['法', t, c]);
    }
  } catch (e) { console.error('[status] justice', e); }
  return out;
}

export class StatusScene {
  constructor(g, resolve) { this.g = g; this.resolve = resolve; this.t = 0; this.opaque = false; this.hidesHud = true; this.hd = true; this.civic = civicLines(g); }
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
    const X = 40, Y = 12, PW = SW - 80, PH = SH - 24;
    panel(ctx, X, Y, PW, PH);
    rect(ctx, X + 18, Y + 18, 76, 60, '#0b1030');
    drawFaceHD(ctx, st.look || {}, X + 24, Y + 24, 2);
    // the profile card (top right): age, gender, hometown, personality, era
    const pf = st.profile;
    const BX = X + PW - 190, BW = 172;
    const nameW = BX - 14 - (X + 110);
    const full = pf ? fullName(pf) : st.name;
    const ns = [24, 20, 16].find((z) => measure(ctx, full, z) <= nameW) || 16;
    text(ctx, full, X + 110, Y + 18 + (24 - ns) / 2, { size: ns, color: COLORS.accent });
    if (pf) {
      const era = eraOf(st);
      rect(ctx, BX, Y + 16, BW, 76, '#0b1030');
      rect(ctx, BX, Y + 16, 2, 76, era.name === '昭和' ? '#c98a3a' : era.name === '平成' ? '#5fd7ff' : COLORS.pink);
      const lines = [
        [`${ageOf(st)}さい・${(GENDERS[pf.gender] || GENDERS.x).name}`, COLORS.text],
        [`${prefecture(pf.hometown).name}出身`, COLORS.text],
        [`性格：${(PERSONALITIES[pf.personality] || {}).name || ''}`, COLORS.cyan],
        [`時代：${era.label}`, COLORS.dim],
      ];
      lines.forEach(([l, c], i) => text(ctx, l, BX + 10, Y + 20 + i * 17, { size: 13, color: c }));
    }
    text(ctx, `${rankName(st.fame)}　★${st.fame}`, X + 110, Y + 50, { size: FS, color: COLORS.pink });
    const ri = rankIndex(st.fame);
    const next = RANKS[ri + 1];
    text(ctx, next ? `次の称号「${next[1]}」まで あと★${next[0] - st.fame}` : '頂点に立った！', X + 110, Y + 72, { size: 12, color: COLORS.dim });
    const c2 = X + PW / 2 + 10;
    text(ctx, `所属：${st.agency ? AGENCIES[st.agency].name : 'フリー（未所属）'}`, X + 24, Y + 100, { size: FS });
    text(ctx, `体力：${st.stamina}/${st.maxStamina}`, c2, Y + 100, { size: FS });
    text(ctx, `所持金：${fmtMoney(st.money)}`, X + 24, Y + 126, { size: FS });
    text(ctx, `${st.day}日目　お仕事 ${st.stats.jobs}回`, c2, Y + 126, { size: FS });
    text(ctx, `ファン ${st.fans.toLocaleString('ja-JP')}人`, X + 24, Y + 152, { size: FS, color: COLORS.pink });
    text(ctx, `住まい：${g.housing().name}`, c2, Y + 152, { size: FS });
    let y = Y + 186;
    for (const [k, name] of Object.entries(SKILLS)) {
      text(ctx, name, X + 24, y, { size: 14 });
      bar(ctx, X + 100, y + 3, 120, 10, st.skills[k] / SKILL_MAX, ['#ff8a3d', '#5fd7ff', '#ff7eb6', '#5ee07a'][Object.keys(SKILLS).indexOf(k)]);
      text(ctx, String(st.skills[k]), X + 250, y, { size: 14, align: 'right', color: COLORS.accent });
      y += 26;
    }
    // needs
    const L = st.life;
    const COND = { great: ['絶好調！', COLORS.good], normal: ['ふつう', COLORS.text], hungry: ['はらぺこ…', COLORS.bad], stressed: ['ストレスぎみ…', COLORS.bad], scruffy: ['身だしなみが乱れている', COLORS.accent], burnout: ['燃え尽きた…', COLORS.bad], edge: ['燃え尽き寸前！', COLORS.bad] };
    const cond = g.condition();
    const [cl, cc] = COND[cond === 'stressed' && L.stress >= 90 ? 'edge' : cond] || COND.normal;
    const nx = X + 300;
    text(ctx, `調子：${cl}`, nx, Y + 186, { size: 14, color: cc });
    [['満腹', L.hunger, '#ff9a3c'], ['ストレス', L.stress, L.stress >= 70 ? COLORS.bad : '#b48cff'], ['身だしなみ', L.clean, COLORS.cyan]].forEach(([n, v, col], i) => {
      text(ctx, n, nx, Y + 212 + i * 26, { size: 14 });
      bar(ctx, nx + 86, Y + 215 + i * 26, 80, 10, v / 100, col);
      text(ctx, String(v), nx + 196, Y + 212 + i * 26, { size: 14, align: 'right', color: COLORS.dim });
    });
    // 政治 / 法 (only when relevant): one compact row under the skills
    this.civic.slice(0, 2).forEach(([label, v, col], i) => {
      // side by side when both apply; a single row may use the whole width
      const x = i ? c2 : X + 24, w = i || this.civic.length < 2 ? X + PW - 24 - x : c2 - 24 - (X + 24);
      let s = v;
      while (s.length > 1 && measure(ctx, `${label}：${s}`, 14) > w) s = s.slice(0, -2) + '…';
      text(ctx, `${label}：`, x, Y + 296, { size: 14, color: COLORS.dim });
      text(ctx, s, x + measure(ctx, `${label}：`, 14), Y + 296, { size: 14, color: col });
    });
    text(ctx, 'Aでもどる', X + PW - 18, Y + PH - (this.civic.length > 1 ? 20 : 26), { align: 'right', size: 12, color: COLORS.dim });
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
    this.hd = true;
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
    const w = 330, x = SW - w - 12, y = 12;
    const n = this.goods.length + 1;
    const rows = Math.min(n, Math.floor((BOX.y - 8 - y - 36) / ROW));
    const top = Math.max(0, Math.min(this.idx - rows + 1, n - rows));
    panel(ctx, x, y, w, rows * ROW + 42);
    text(ctx, this.opts.title || 'おみせ', x + 14, y + 9, { size: FS, color: COLORS.cyan });
    for (let i = top; i < top + rows; i++) {
      const ry = y + 36 + (i - top) * ROW;
      const sel = i === this.idx;
      if (i === this.goods.length) {
        text(ctx, 'やめる', x + 28, ry, { size: FS, color: sel ? COLORS.accent : COLORS.text });
      } else {
        const gd = this.goods[i];
        const it = ITEMS[gd.item] || { name: gd.item };
        text(ctx, it.name, x + 28, ry, { size: FS, color: sel ? COLORS.accent : COLORS.text });
        text(ctx, fmtMoney(this.price(gd)), x + w - (rows < n ? 30 : 14), ry + 2, { align: 'right', size: 14, color: sel ? COLORS.accent : COLORS.dim });
      }
      if (sel) cursor(ctx, x + 12, ry + 4, this.t);
    }
    if (top > 0) downArrowUp(ctx, x + w - 24, y + 12, this.t);
    if (top + rows < n) downArrow(ctx, x + w - 24, y + rows * ROW + 30, this.t);
    panel(ctx, 12, 12, 220, 34);
    text(ctx, '所持金 ' + fmtMoney(g.state.money), 26, 21, { size: FS, color: COLORS.accent });
    panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h);
    const gd = this.goods[this.idx];
    const desc = gd ? (ITEMS[gd.item]?.desc || '') : 'お店を出る。';
    wrap(ctx, yenText(this.msg), TEXT_W, FS).slice(0, 1).forEach((l) => text(ctx, l, BOX.x + 18, BOX.y + 10, { size: FS, color: COLORS.accent }));
    wrap(ctx, yenText(desc), TEXT_W, FS).slice(0, 2).forEach((l, i) => text(ctx, l, BOX.x + 18, BOX.y + 10 + (i + 1) * LINE_H, { size: FS }));
  }
}

// ---------------------------------------------------------------- pause menu
export async function openMenu(g) {
  let last = 0; // back from a sub-screen, the cursor stays on that entry
  for (;;) {
    const unread = g.unread();
    const entries = [
      // the phone is called what the era calls it (手帳と電話 / ケータイ / スマホ; not just
      // 手帳, which would read like てちょう below)
      [unread ? `${eraOf(g.state).device}（${unread}）` : eraOf(g.state).device, 'phone'],
      ['ステータス', 'status'], ['もちもの', 'items'], ['てちょう', 'notebook'], ['セーブ', 'save'],
      [audio.muted ? '音：OFF' : '音：ON', 'sound'], ['とじる', 'close'],
    ];
    if (g.debugMenu) entries.push(['デバッグ', 'debug']);
    const i = await g.list({ items: entries.map((e) => e[0]), x: SW - 200, y: 56, w: 188, index: last, px: true });
    if (i >= 0) last = i;
    const act = i >= 0 && entries[i] ? entries[i][1] : 'close';
    if (act === 'debug') { await g.debugMenu(); continue; }
    if (act === 'phone') {
      // MENU inside the phone goes straight back to the map (B returns here)
      if ((await openPhone(g)) === 'menu') return;
    } else if (act === 'status') await new Promise((r) => g.push(new StatusScene(g, r)));
    else if (act === 'items') await itemMenu(g);
    else if (act === 'notebook') await new Promise((r) => g.push(new NotebookScene(g, r)));
    else if (act === 'save') {
      if (g.map && g.map.place && g.map.place.noSave) {
        await g.say('ここではセーブできないみたいだ。');
      } else if (g.save()) {
        audio.sfx('success');
        await g.say('セーブしました。');
      } else await g.say('セーブできませんでした…');
    } else if (act === 'sound') {
      audio.unlock();
      audio.toggleMute();
    } else return;
  }
}

async function itemMenu(g) {
  for (;;) {
    const ids = Object.keys(g.state.items).filter((k) => g.state.items[k] > 0);
    const items = ids.map((id) => ({ label: ITEMS[id]?.name || id, right: '×' + g.state.items[id] }));
    const i = await g.list({ title: `もちもの（満腹 ${g.state.life.hunger}%）`, items, x: 12, y: 56, w: 360, px: true, describe: (k) => ITEMS[ids[k]]?.desc });
    if (i < 0) return;
    const id = ids[i];
    const it = ITEMS[id] || {};
    if (it.heal) {
      // food fills the stomach (g.eat); a refused item is not used up
      if (!g.canEat()) { await g.say('おなかいっぱいだ…\nいまはもう食べられない。\n（お仕事や移動でおなかが空いたら、また食べられる）'); continue; }
      g.takeItem(id);
      const got = g.eat(it.heal, { silent: true, fill: it.fill });
      audio.sfx('good');
      const half = got > 0 && g.lastEatRatio < 0.75; // a nearly full stomach wastes most of it
      await g.say(`${it.name}を食べた！` + (got > 0 ? `体力が${got}回復した。` : 'おなかが満たされた。') + (half ? '\n（おなかがいっぱい気味で、あまり回復しなかった）' : !g.canEat() ? '\nおなかいっぱいになった。' : ''));
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

// Small up arrow (more rows above).
function downArrowUp(ctx, x, y, t = 0, color = '#fff') {
  const o = Math.floor(t / 10) % 2;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i, y - o + 3 - i, 7 - i * 2, 1);
}

export { BOX, LINE_H, TEXT_W, FS, ROW, rect };
