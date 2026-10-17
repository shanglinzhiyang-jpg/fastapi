// Base class for every minigame.
//
// Subclass it, override init / updatePlay / drawPlay, and call this.end(score) with
// a score from 0 to 100 when the game is over. The base class handles the intro
// card, the 3-2-1 countdown, the result card (rank S/A/B/C/D) and resolving the
// promise returned by g.minigame(id, opts).
//
//   export default class Quiz extends Minigame {
//     static title = 'クイズ';
//     static howto = ['正しい答えを選ぼう', '↑↓で選んでAで決定'];
//     init() { ... }
//     updatePlay(input) { ... if (done) this.end(score); }
//     drawPlay(ctx) { ... }
//   }
//   registerMinigame('quiz', Quiz);
//
// Available inside a minigame:
//   this.g            the Game (this.g.state, this.g.sfx(...))
//   this.opts         options passed by the caller (difficulty, skill, title, custom content...)
//   this.difficulty   1..5
//   this.bonus        -0.35..~1.4, bigger = player is more skilled / in better shape -> make
//                     it easier (negative: hungry or stressed -> a little harder)
//   this.ease(v, k)   v scaled by (1 + bonus * k)   e.g. timing windows
//   this.rng()        random 0..1
//   this.pt           frames since play started
//   this.popup(text, x, y, color)   floating text effect
//   this.drawTimerBar(ctx, frac), this.drawScoreBox(ctx, label, value)
//
// Static fields: title, howto (string[]), bgm (song name; null = no BGM so you can
// play your own beat with audio.tone / audio.sfx — note audio.ctx is null until the
// first user gesture), skill (default skill key used for this.bonus),
// hd (true: the minigame draws in 640x360 screen pixels; false: the v1 320x240 space,
// shown 1.5x). this.W / this.H are the drawing size either way; the base class draws
// the intro, countdown, popups, result, timer bar and score box for both.

import { W, H, SW, SH, clamp } from './util.js';
import { text, panel, rect, wrap, bar, measure, COLORS, sparkle } from './draw.js';
import { audio } from './audio.js';

export const MINIGAMES = {};
export function registerMinigame(id, cls) {
  MINIGAMES[id] = cls;
  cls.id = id;
}

export const RANKS = [['S', 90], ['A', 75], ['B', 55], ['C', 35], ['D', 0]];
export function rankFor(score) {
  for (const [r, min] of RANKS) if (score >= min) return r;
  return 'D';
}
const RANK_COLORS = { S: '#ffd23f', A: '#ff7eb6', B: '#5fd7ff', C: '#5ee07a', D: '#9aa3c7' };
const RANK_COMMENTS = {
  S: 'パーフェクト！文句なしの出来！',
  A: 'すばらしい！大成功だ！',
  B: 'まずまずの出来！',
  C: 'うーん、もう少しだった…',
  D: '今回は散々な結果に…',
};

export class Minigame {
  static title = 'ミニゲーム';
  static howto = ['Aボタンであそぶ'];
  static bgm = 'minigame';
  static hd = false;

  constructor(g, opts = {}) {
    this.g = g;
    this.opts = opts;
    this.opaque = true;
    this.hd = !!this.constructor.hd;
    this.W = this.hd ? SW : W;
    this.H = this.hd ? SH : H;
    this.difficulty = clamp(Math.round(opts.difficulty ?? 1), 1, 5);
    this.bonus = Math.max(-0.35, opts.bonus ?? 0);
    // { skill, parts: [{ label, v }] } from g.minigame: what the bonus is made of (intro card)
    this.bonusInfo = opts.bonusInfo || null;
    this.phase = 'intro';
    this.t = 0;
    this.pt = 0;
    this.result = null;
    this.popups = [];
    this.title = opts.title || this.constructor.title;
    this.rng = Math.random;
  }

  // ------------------------------------------------ override in subclasses
  init() {}
  updatePlay(input) {}
  drawPlay(ctx) {}
  drawBackground(ctx) {
    const step = this.hd ? 12 : 8;
    for (let y = 0; y < this.H; y += step) {
      ctx.fillStyle = (y / step) % 2 ? '#1b2350' : '#1e2758';
      ctx.fillRect(0, y, this.W, step);
    }
  }

  // ------------------------------------------------ helpers
  ease(v, k = 0.5) { return v * (1 + this.bonus * k); }

  popup(str, x, y, color = COLORS.accent, size = this.hd ? 18 : 12) {
    this.popups.push({ str, x, y, color, size, t: 0 });
  }

  drawTimerBar(ctx, frac, y = this.hd ? 8 : 4) {
    if (this.hd) bar(ctx, 140, y, SW - 280, 12, frac, frac > 0.3 ? COLORS.good : COLORS.bad);
    else bar(ctx, 60, y, W - 120, 8, frac, frac > 0.3 ? COLORS.good : COLORS.bad);
  }

  drawScoreBox(ctx, label, value, x = this.hd ? 8 : 4, y = this.hd ? 8 : 4) {
    if (this.hd) {
      panel(ctx, x, y, 124, 32);
      text(ctx, `${label} ${value}`, x + 12, y + 8, { size: 14 });
      return;
    }
    panel(ctx, x, y, 72, 22);
    text(ctx, `${label} ${value}`, x + 8, y + 5, { size: 10 });
  }

  end(score, comment) {
    if (this.phase === 'result') return;
    score = clamp(Math.round(score), 0, 100);
    const rank = rankFor(score);
    const pass = this.opts.pass ?? 50;
    this.result = { score, rank, success: score >= pass, comment: comment || RANK_COMMENTS[rank] };
    this.phase = 'result';
    this.t = 0;
    audio.sfx(this.result.success ? 'success' : 'fail');
  }

  // Debug / tests: skip straight to a result.
  forceEnd(score = 60) {
    if (this.phase === 'intro' || this.phase === 'count') { this.init(); this.phase = 'play'; }
    this.end(score);
  }

  // ------------------------------------------------ scene plumbing
  update(g) {
    this.t++;
    const inp = g.input;
    if (g.auto) {
      if (this.phase !== 'result') {
        if (g.auto.playFrames && this.phase !== 'play') { this.init(); this.phase = 'play'; this.pt = 0; }
        if (g.auto.playFrames && this.pt < g.auto.playFrames) {
          this.pt++;
          try { this.updatePlay(inp); } catch (e) { console.error(e); }
          if (this.phase === 'result') return;
          return;
        }
        this.forceEnd(g.auto.score ?? 70);
      } else if (this._resolve) this._resolve(this.result);
      return;
    }
    for (const p of this.popups) p.t++;
    this.popups = this.popups.filter((p) => p.t < 50);
    if (this.phase === 'intro') {
      if (this.t > 10 && inp.pressed('a')) {
        audio.sfx('ok');
        try { this.init(); } catch (e) { console.error(e); }
        this.phase = 'count';
        this.t = 0;
      }
    } else if (this.phase === 'count') {
      if (this.t % 30 === 1 && this.t < 90) audio.sfx('cursor');
      if (this.t === 90) audio.sfx('ok');
      if (this.t >= 100) { this.phase = 'play'; this.t = 0; this.pt = 0; }
    } else if (this.phase === 'play') {
      this.pt++;
      try {
        this.updatePlay(inp);
      } catch (e) {
        // never leave the player stuck in a broken minigame
        console.error(e);
        this.end(50, 'トラブル発生…でもなんとか乗り切った！');
      }
    } else if (this.phase === 'result') {
      if (this.t > 40 && inp.pressed('a')) {
        audio.sfx('ok');
        if (this._resolve) this._resolve(this.result);
      }
    }
  }

  draw(ctx) {
    if (this.phase === 'intro') {
      this.drawBackground(ctx);
      this.drawIntro(ctx);
      return;
    }
    try { this.drawPlay(ctx); } catch (e) { console.error(e); this.drawBackground(ctx); }
    const k = this.hd ? 2 : 1;
    for (const p of this.popups) {
      ctx.globalAlpha = clamp(1 - p.t / 50, 0, 1);
      text(ctx, p.str, p.x, p.y - p.t * 0.4 * k, { size: p.size, align: 'center', color: p.color, outline: '#000' });
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'count') {
      const n = 3 - Math.floor(this.t / 30);
      const label = n > 0 ? String(n) : 'スタート！';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, this.W, this.H);
      text(ctx, label, this.W / 2, this.H / 2 - 16 * k, { size: (n > 0 ? 32 : 24) * k, align: 'center', color: COLORS.accent, outline: '#000' });
    }
    if (this.phase === 'result') this.drawResult(ctx);
  }

  drawIntro(ctx) {
    if (this.hd) { this.drawIntroHD(ctx); return; }
    panel(ctx, 24, 24, W - 48, H - 48);
    text(ctx, this.title, W / 2, 38, { size: 16, align: 'center', color: COLORS.accent });
    let stars = '';
    for (let i = 1; i <= 5; i++) stars += i <= this.difficulty ? '★' : '☆';
    text(ctx, `むずかしさ ${stars}`, W / 2, 60, { size: 10, align: 'center', color: COLORS.pink });
    const howto = [].concat(this.opts.howto || this.constructor.howto);
    let y = 82;
    for (const line of howto) {
      for (const l of wrap(ctx, line, W - 80, 12)) {
        text(ctx, l, 40, y);
        y += 16;
      }
    }
    this.drawBonusLine(ctx, W / 2, H - 70, 10);
    if (Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aでスタート！', W / 2, H - 52, { align: 'center', color: COLORS.cyan });
  }

  drawIntroHD(ctx) {
    panel(ctx, 80, 24, SW - 160, SH - 48);
    text(ctx, this.title, SW / 2, 44, { size: 24, align: 'center', color: COLORS.accent });
    let stars = '';
    for (let i = 1; i <= 5; i++) stars += i <= this.difficulty ? '★' : '☆';
    text(ctx, `むずかしさ ${stars}`, SW / 2, 80, { size: 14, align: 'center', color: COLORS.pink });
    const howto = [].concat(this.opts.howto || this.constructor.howto);
    let y = 114;
    for (const line of howto) {
      for (const l of wrap(ctx, line, SW - 240, 16)) {
        text(ctx, l, 120, y, { size: 16 });
        y += 24;
      }
    }
    this.drawBonusLine(ctx, SW / 2, SH - 92, 14);
    if (Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aでスタート！', SW / 2, SH - 66, { size: 16, align: 'center', color: COLORS.cyan });
  }

  // 「スキル +12%　絶好調 +10%　はらぺこ -20%」 centred at cx: what makes this round
  // easier (green) or harder (red).
  drawBonusLine(ctx, cx, y, size) {
    const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const segs = [];
    const info = this.bonusInfo;
    if (info) {
      if (info.skill > 0.05) segs.push([`スキル ${pct(info.skill)}`, COLORS.good]);
      for (const p of info.parts || []) if (p && p.v) segs.push([`${p.label} ${pct(p.v)}`, p.v > 0 ? COLORS.good : COLORS.bad]);
    } else if (Math.abs(this.bonus) > 0.05) segs.push([`${this.bonus > 0 ? 'ボーナス' : '不調'} ${pct(this.bonus)}`, this.bonus > 0 ? COLORS.good : COLORS.bad]);
    if (!segs.length) return;
    const gap = size;
    const widths = segs.map(([t]) => measure(ctx, t, size));
    let x = Math.round(cx - (widths.reduce((a, w) => a + w, 0) + gap * (segs.length - 1)) / 2);
    segs.forEach(([t, c], i) => { text(ctx, t, x, y, { size, color: c }); x += widths[i] + gap; });
  }

  drawResult(ctx) {
    if (this.hd) { this.drawResultHD(ctx); return; }
    const r = this.result;
    const k = Math.min(1, this.t / 15);
    ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`;
    ctx.fillRect(0, 0, W, H);
    const y = Math.round(40 + (1 - k) * 40);
    panel(ctx, 40, y, W - 80, 150);
    text(ctx, this.title, W / 2, y + 10, { align: 'center', color: COLORS.dim, size: 10 });
    text(ctx, 'ランク', W / 2 - 40, y + 40, { align: 'center' });
    text(ctx, r.rank, W / 2 + 20, y + 26, { size: 40, align: 'center', color: RANK_COLORS[r.rank], outline: '#000' });
    if (r.rank === 'S') for (let i = 0; i < 4; i++) sparkle(ctx, W / 2 + 20 + Math.cos(this.t / 10 + i * 1.6) * 30, y + 46 + Math.sin(this.t / 10 + i * 1.6) * 22, 3, '#fff6a8');
    text(ctx, `スコア ${r.score}点`, W / 2, y + 80, { align: 'center', color: COLORS.accent });
    wrap(ctx, r.comment, W - 110, 12).slice(0, 2).forEach((l, i) => text(ctx, l, W / 2, y + 100 + i * 16, { align: 'center' }));
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aで次へ', W / 2, y + 134, { align: 'center', size: 10, color: COLORS.cyan });
  }

  drawResultHD(ctx) {
    const r = this.result;
    const k = Math.min(1, this.t / 15);
    ctx.fillStyle = `rgba(0,0,0,${0.5 * k})`;
    ctx.fillRect(0, 0, SW, SH);
    const y = Math.round(56 + (1 - k) * 60);
    panel(ctx, 140, y, SW - 280, 236);
    text(ctx, this.title, SW / 2, y + 16, { align: 'center', color: COLORS.dim, size: 14 });
    text(ctx, 'ランク', SW / 2 - 70, y + 66, { align: 'center', size: 20 });
    text(ctx, r.rank, SW / 2 + 36, y + 40, { size: 72, align: 'center', color: RANK_COLORS[r.rank], outline: '#000' });
    if (r.rank === 'S') for (let i = 0; i < 6; i++) sparkle(ctx, SW / 2 + 36 + Math.cos(this.t / 10 + i * 1.05) * 56, y + 78 + Math.sin(this.t / 10 + i * 1.05) * 40, 4, '#fff6a8');
    text(ctx, `スコア ${r.score}点`, SW / 2, y + 126, { align: 'center', color: COLORS.accent, size: 18 });
    wrap(ctx, r.comment, SW - 330, 16).slice(0, 2).forEach((l, i) => text(ctx, l, SW / 2, y + 156 + i * 22, { align: 'center', size: 16 }));
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aで次へ', SW / 2, y + 206, { align: 'center', size: 14, color: COLORS.cyan });
  }
}

export { text, panel, rect, wrap, bar, COLORS, sparkle };
