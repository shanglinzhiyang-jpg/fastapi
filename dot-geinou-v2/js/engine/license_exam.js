// 運転免許の試験 minigames (owner: R8-L1) — HD 640x360, ○× buttons / keys / taps.
//
//   await g.minigame('license_exam', { kind: 'kari' | 'hon' | 'second' | 'gentsuki' | 'nirin', count: 50, title, out })
//      学科試験 (仮免 50問 / 本免 / 第二種 / 原付). 90% 以上で合格 (result.success; score = percent of the full marks).
//      opts.out (an object you pass) is filled: { correct, total, pts, max, pass, wrong: [{ q, a, why, yours }], seconds, played }
//      Keys: A / ← = ○, B / → = ×. Touch: the two big buttons. Time: about 8 seconds a question.
//   await g.minigame('license_check', { glasses, needGlasses, out })
//      適性検査 (視力 / 色彩識別 / 聴力 / 運動能力). opts.out filled: { vision (0.1 .. 1.2), color, hearing, motor, ok }
//      Keys: arrows (the ring's gap, the light's colour, the arrow), A for the sound. Touch: the on-screen buttons.
//   Under g.auto both end with auto.score (exam: pass when >= 90; check: ok when >= 60).

import { Minigame, registerMinigame, text, panel, rect, wrap, COLORS } from './minigame.js';
import { audio, registerSong } from './audio.js';
import { shuffle } from './util.js';
import { draw as drawQuestions, examMax, passPts } from './license_bank.js';
import { bindTap } from './quiz_studio.js';
import { ymNow } from './license.js';

const SW = 640, SH = 360;
const inRect = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const KIND_TITLE = { kari: '仮免許 学科試験', hon: '本免許 学科試験', second: '第二種 学科試験', gentsuki: '原付 学科試験', nirin: '二輪 学科試験' };
const hashOf = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ======================================================================== 学科試験
class LicenseExam extends Minigame {
  static title = '学科試験';
  static howto = ['○か×で答えよう。', 'A／←＝○（正しい）　B／→＝×（誤り）', '90%以上で合格。時間内に全問に答えよう。', 'タッチ：下の○×ボタン'];
  static skill = 'talk';
  static bgm = null;
  static hd = true;

  constructor(g, opts = {}) {
    super(g, { pass: 90, ...opts });
    this.opts.pass = 90;
    this.title = opts.title || KIND_TITLE[opts.kind] || '学科試験';
    this.kind = opts.kind || 'kari';
    this.out = opts.out && typeof opts.out === 'object' ? opts.out : {};
    this.quizTap = true;
    this.tapAt = null;
    bindTap(g);
  }

  update(g) { if (this.phase !== 'play') this.tapAt = null; super.update(g); }

  init() {
    this.played = false;
    const ym = Number.isFinite(this.opts.ym) ? this.opts.ym : (() => { try { return ymNow(this.g); } catch (e) { return 202604; } })();
    const n = Math.max(5, Math.min(60, Math.round(this.opts.count || 50)));
    this.list = drawQuestions(this.kind, ym, n, this.rng);
    this.n = this.list.length;
    this.max = examMax(this.list);
    this.need = passPts(this.list);
    this.idx = 0;
    this.pts = 0;
    this.correct = 0;
    this.answers = [];
    this.limit = Math.round(this.n * 8 * 60 * (1 + this.bonus * 0.25));
    this.left = this.limit;
    this.flash = 0;
    this.lastMark = null;
    this.btnO = { x: 70, y: 262, w: 220, h: 78 };
    this.btnX = { x: 350, y: 262, w: 220, h: 78 };
    this.seed = hashOf(this.g.state && this.g.state.name);
  }

  updatePlay(inp) {
    this.played = true;
    if (this.flash > 0) this.flash--;
    this.left--;
    let ans = null;
    const tap = this.tapAt; this.tapAt = null;
    // a tap is also an A press (input.js): the tapped button decides, not that A
    if (tap) { if (inRect(tap, this.btnO)) ans = true; else if (inRect(tap, this.btnX)) ans = false; }
    else if (inp.pressed('a') || inp.pressed('left')) ans = true;
    else if (inp.pressed('b') || inp.pressed('right')) ans = false;
    if (ans !== null) this.answer(ans);
    if (this.phase === 'play' && this.left <= 0) this.finish(true);
  }

  answer(yours) {
    const q = this.list[this.idx];
    const ok = yours === q.a;
    this.answers.push({ q, yours, ok });
    if (ok) { this.pts += q.pts; this.correct++; }
    audio.sfx('cursor');
    this.flash = 8;
    this.lastMark = yours;
    this.idx++;
    if (this.idx >= this.n) this.finish(false);
  }

  finish(timeout) {
    const unanswered = this.n - this.answers.length;
    const secs = Math.round((this.limit - Math.max(0, this.left)) / 60);
    this.fill({ timeout, unanswered, seconds: secs });
    const score = Math.round((this.pts / this.max) * 100);
    const pass = this.pts >= this.need;
    const head = `${this.n}問中${this.correct}問正解（${this.pts}／${this.max}点）`;
    const tail = pass ? '合格！　おめでとう！' : timeout ? '時間切れ…。不合格です。' : `不合格…。${this.need}点以上で合格です。`;
    this.end(pass ? Math.max(90, score) : Math.min(89, score), `${head}\n${tail}`);
  }

  fill(extra = {}) {
    const wrong = this.answers.filter((a) => !a.ok).map((a) => ({ q: a.q.q, a: a.q.a, why: a.q.why, yours: a.yours, pts: a.q.pts }));
    for (let i = this.answers.length; i < (this.list || []).length; i++) wrong.push({ q: this.list[i].q, a: this.list[i].a, why: this.list[i].why, yours: null, pts: this.list[i].pts });
    Object.assign(this.out, { played: !!this.played, correct: this.correct, total: this.n, pts: this.pts, max: this.max, need: this.need, wrong, kind: this.kind }, extra);
  }

  end(score, comment) {
    if (this.phase === 'result') return;
    if (!this.played) {
      // g.auto: no play — the score is the percentage
      const pct = Math.max(0, Math.min(100, Math.round(score)));
      const n = Math.max(5, Math.round(this.opts.count || 50));
      Object.assign(this.out, { played: false, correct: Math.round((pct / 100) * n), total: n, pts: Math.round((pct / 100) * n), max: n, need: Math.ceil(n * 0.9), wrong: [], kind: this.kind, pass: pct >= 90 });
      super.end(pct, `${n}問中${this.out.correct}問正解\n${pct >= 90 ? '合格！' : '不合格…'}`);
      return;
    }
    this.out.pass = score >= 90 && this.pts >= this.need;
    super.end(score, comment);
  }

  // ---------------------------------------------------------------- draw
  drawBackground(ctx) {
    R(ctx, 0, 0, SW, SH, '#d9d3c0');
    for (let y = 0; y < SH; y += 24) R(ctx, 0, y, SW, 1, 'rgba(0,0,0,0.05)');
    R(ctx, 0, 0, SW, 38, '#2a3a5a');
  }

  drawPlay(ctx) {
    this.drawBackground(ctx);
    text(ctx, this.title, 16, 10, { size: 18, color: '#fff', shadow: null });
    const secs = Math.max(0, Math.ceil(this.left / 60));
    text(ctx, `残り ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, SW - 16, 10, { size: 18, align: 'right', color: secs < 40 ? '#ff9a9a' : '#ffe27a', shadow: null });
    // progress dots
    const dx = (SW - 40) / this.n;
    for (let i = 0; i < this.n; i++) R(ctx, 20 + i * dx, 46, Math.max(2, dx - 2), 6, i < this.idx ? '#2f6fd0' : i === this.idx ? '#ffb02e' : '#b8b2a0');
    const q = this.list[Math.min(this.idx, this.n - 1)];
    // the answer sheet card
    R(ctx, 48, 66, SW - 96, 178, '#fbf8ee'); R(ctx, 48, 66, SW - 96, 3, '#2a3a5a'); R(ctx, 48, 241, SW - 96, 3, '#b8b2a0');
    ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 2; ctx.strokeRect(48, 66, SW - 96, 178);
    text(ctx, `問 ${Math.min(this.idx + 1, this.n)} / ${this.n}`, 64, 78, { size: 16, color: '#2a3a5a', shadow: null });
    if (q.pts > 1) text(ctx, `イラスト問題（${q.pts}点）`, SW - 64, 78, { size: 14, align: 'right', color: '#c0502a', shadow: null });
    let y0 = 104;
    if (q.cat === 'kiken') { this.drawScene(ctx, 64, 100, q); y0 = 104; }
    const lines = wrap(ctx, q.q, q.cat === 'kiken' ? SW - 96 - 16 - 190 : SW - 96 - 32, 20);
    const x0 = q.cat === 'kiken' ? 64 + 180 : 64;
    lines.slice(0, 5).forEach((l, i) => text(ctx, l, x0, y0 + i * 28, { size: 20, color: '#1a1a24', shadow: null }));
    // the buttons
    this.drawButton(ctx, this.btnO, '○', '正しい', '#2f6fd0', this.flash > 0 && this.lastMark === true);
    this.drawButton(ctx, this.btnX, '×', '誤り', '#d0402f', this.flash > 0 && this.lastMark === false);
    text(ctx, 'A／←：○　　B／→：×', SW / 2, 346, { size: 12, align: 'center', color: '#5a5640', shadow: null });
  }

  drawButton(ctx, b, mark, label, col, hit) {
    R(ctx, b.x + 4, b.y + 5, b.w, b.h, 'rgba(0,0,0,0.25)');
    R(ctx, b.x, b.y, b.w, b.h, hit ? '#ffffff' : col);
    ctx.strokeStyle = hit ? col : '#ffffff'; ctx.lineWidth = 3; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    text(ctx, mark, b.x + 56, b.y + 6, { size: 64, align: 'center', color: hit ? col : '#ffffff', shadow: null });
    text(ctx, label, b.x + 138, b.y + 28, { size: 26, align: 'center', color: hit ? col : '#ffffff', shadow: null });
  }

  // a small road scene for 危険予測 questions (a placeholder 'イラスト')
  drawScene(ctx, x, y, q) {
    const w = 170, h = 120;
    R(ctx, x, y, w, h, '#8fc8e8'); R(ctx, x, y + 70, w, h - 70, '#5a5a62'); R(ctx, x, y + 70, w, 4, '#c8c8c8');
    for (let i = 0; i < 6; i++) R(ctx, x + 6 + i * 28, y + 98, 16, 3, '#f0e060');
    const k = hashOf(q.id) % 3;
    // parked car / bus / wall on the left
    if (k === 0) { R(ctx, x + 8, y + 62, 46, 20, '#c0392b'); R(ctx, x + 14, y + 54, 28, 10, '#d95a4a'); R(ctx, x + 14, y + 80, 8, 6, '#222'); R(ctx, x + 40, y + 80, 8, 6, '#222'); }
    else if (k === 1) { R(ctx, x + 4, y + 44, 64, 38, '#e8c030'); R(ctx, x + 8, y + 50, 56, 12, '#cfe8f8'); R(ctx, x + 12, y + 80, 10, 7, '#222'); R(ctx, x + 50, y + 80, 10, 7, '#222'); }
    else { R(ctx, x + 6, y + 40, 50, 42, '#a07050'); R(ctx, x + 6, y + 40, 50, 4, '#c09070'); }
    // a person behind it
    R(ctx, x + 78, y + 56, 8, 8, '#f6c9a0'); R(ctx, x + 76, y + 64, 12, 18, '#2f6fd0'); R(ctx, x + 77, y + 82, 4, 8, '#2a2a40'); R(ctx, x + 84, y + 82, 4, 8, '#2a2a40');
    // own car coming from the right
    R(ctx, x + 112, y + 74, 50, 20, '#f5f5f5'); R(ctx, x + 120, y + 66, 28, 10, '#dcdcdc'); R(ctx, x + 118, y + 92, 9, 6, '#222'); R(ctx, x + 146, y + 92, 9, 6, '#222');
    ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }
}
registerMinigame('license_exam', LicenseExam);

// ======================================================================== 適性検査
const VISION_LEVELS = [0.3, 0.5, 0.7, 0.9, 1.0, 1.2];
const RING = [58, 42, 30, 22, 16, 12]; // outer radius by level
const DIRS4 = ['right', 'down', 'left', 'up'];
const DIR_LABEL = { right: '→', down: '↓', left: '←', up: '↑' };
const LIGHTS = [{ id: 'red', label: '赤', col: '#e03a3a', key: 'left' }, { id: 'yellow', label: '黄', col: '#f0c030', key: 'up' }, { id: 'blue', label: '青', col: '#2f9a5a', key: 'right' }];

class LicenseCheck extends Minigame {
  static title = '適性検査';
  static howto = ['視力・色彩識別・聴力・運動能力の検査。', '視力：輪のあいているほうを矢印キーで答える', '色：光の色を ←赤 ↑黄 →青 で答える', '聴力：音が聞こえたら A　運動：出た矢印と同じ向きを押す'];
  static skill = 'talk';
  static bgm = null;
  static hd = true;

  constructor(g, opts = {}) {
    super(g, opts);
    this.out = opts.out && typeof opts.out === 'object' ? opts.out : {};
    this.quizTap = true;
    this.tapAt = null;
    bindTap(g);
  }

  update(g) { if (this.phase !== 'play') this.tapAt = null; super.update(g); }

  init() {
    this.played = false;
    this.parts = ['vision', 'color', 'hearing', 'motor'];
    this.pi = 0;
    this.res = { vision: 0.1, color: false, hearing: false, motor: false };
    // a player who needs glasses sees blurred rings and only reaches 0.5 without them
    this.cap = this.opts.needGlasses && !this.opts.glasses ? 0.5 : 9;
    this.beginPart();
  }

  beginPart() {
    this.sub = 0; this.st = 0; this.msg = ''; this.msgT = 0;
    const p = this.parts[this.pi];
    if (p === 'vision') { this.level = 0; this.miss = 0; this.target = this.rng() * 4 | 0; this.best = 0.1; }
    if (p === 'color') { this.items = shuffle(LIGHTS.map((l) => l.id), this.rng); this.ok = 0; }
    if (p === 'hearing') { this.round = 0; this.heard = 0; this.waitFr = 60 + (this.rng() * 80 | 0); this.beepAt = -1; }
    if (p === 'motor') { this.seq = Array.from({ length: 4 }, () => DIRS4[this.rng() * 4 | 0]); this.ok = 0; this.askFr = 0; }
    this.pt0 = this.pt;
  }

  nextPart() {
    this.pi++;
    if (this.pi >= this.parts.length) { this.finish(); return; }
    this.beginPart();
  }

  readKey(inp) {
    if (inp.pressed('left')) return 'left';
    if (inp.pressed('right')) return 'right';
    if (inp.pressed('up')) return 'up';
    if (inp.pressed('down')) return 'down';
    const tap = this.tapAt; this.tapAt = null;
    if (tap) { for (const [k, r] of Object.entries(this.padRects())) if (inRect(tap, r)) return k; if (inRect(tap, { x: 240, y: 296, w: 160, h: 56 })) return 'a'; }
    if (inp.pressed('a')) return 'a';
    return null;
  }
  padRects() { return { left: { x: 190, y: 292, w: 76, h: 60 }, up: { x: 282, y: 292, w: 76, h: 60 }, down: { x: 374, y: 292, w: 76, h: 60 }, right: { x: 466, y: 292, w: 76, h: 60 } }; }

  updatePlay(inp) {
    this.played = true;
    this.st++;
    if (this.msgT > 0) this.msgT--;
    const p = this.parts[this.pi];
    const k = this.readKey(inp);
    if (this.sub === 9) { if (this.st > 50) this.nextPart(); return; }
    if (p === 'vision') {
      if (this.sub === 0 && this.st > 20) this.sub = 1;
      if (this.sub === 1 && k && DIRS4.includes(k)) {
        const ok = k === DIRS4[this.target];
        const lv = VISION_LEVELS[this.level];
        audio.sfx(ok ? 'cursor' : 'fail');
        if (ok && lv <= this.cap) { this.best = lv; this.level++; this.miss = 0; } else { this.miss++; if (this.miss >= 2) { this.endPart(`視力 ${this.best.toFixed(1)}`); return; } }
        if (this.level >= VISION_LEVELS.length) { this.endPart(`視力 ${this.best.toFixed(1)}`); return; }
        this.target = this.rng() * 4 | 0; this.st = 0;
      }
    } else if (p === 'color') {
      if (this.st > 24 && k && ['left', 'up', 'right'].includes(k)) {
        const cur = LIGHTS.find((l) => l.id === this.items[this.sub]);
        const ok = cur && cur.key === k;
        audio.sfx(ok ? 'cursor' : 'fail');
        if (ok) this.ok++;
        this.sub++; this.st = 0;
        if (this.sub >= this.items.length) { this.res.color = this.ok >= 3; this.endPart(this.res.color ? '色彩識別 OK' : '色彩識別 NG'); }
      }
    } else if (p === 'hearing') {
      // sub: round index; a tone after a random wait, A within 1.2 s
      if (this.beepAt < 0) {
        this.waitFr--;
        if (this.waitFr <= 0) { this.beepAt = this.st; audio.sfx('chime'); }
        if (k === 'a') { this.msg = 'まだ…'; this.msgT = 30; this.waitFr += 20; }
      } else {
        if (k === 'a') { this.heard++; this.nextRound(); } else if (this.st - this.beepAt > 80) this.nextRound();
      }
    } else if (p === 'motor') {
      this.askFr++;
      if (this.askFr > 12 && k && DIRS4.includes(k)) {
        const ok = k === this.seq[this.sub];
        audio.sfx(ok ? 'cursor' : 'fail');
        if (ok) this.ok++;
        this.sub++; this.askFr = 0;
        if (this.sub >= this.seq.length) { this.res.motor = this.ok >= 3; this.endPart(this.res.motor ? '運動能力 OK' : '運動能力 NG'); }
      } else if (this.askFr > 150) { this.sub++; this.askFr = 0; if (this.sub >= this.seq.length) { this.res.motor = this.ok >= 3; this.endPart(this.res.motor ? '運動能力 OK' : '運動能力 NG'); } }
    }
  }
  nextRound() {
    this.round++;
    this.beepAt = -1; this.waitFr = 60 + (this.rng() * 90 | 0);
    if (this.round >= 3) { this.res.hearing = this.heard >= 2; this.endPart(this.res.hearing ? '聴力 OK' : '聴力 NG'); }
  }
  endPart(label) {
    const p = this.parts[this.pi];
    if (p === 'vision') this.res.vision = this.best;
    this.msg = label; this.msgT = 90; this.sub = 9; this.st = 0;
  }

  finish() {
    const r = this.res;
    const ok = r.vision >= 0.7 && r.color && r.hearing && r.motor;
    const n = (r.vision >= 0.7 ? 1 : 0) + (r.color ? 1 : 0) + (r.hearing ? 1 : 0) + (r.motor ? 1 : 0);
    Object.assign(this.out, { played: true, vision: r.vision, color: r.color, hearing: r.hearing, motor: r.motor, ok });
    this.end(Math.round((n / 4) * 100), ok ? '適性検査は全部クリア！' : '基準に届かない検査があった…。');
  }

  end(score, comment) {
    if (this.phase === 'result') return;
    if (!this.played) {
      const ok = score >= 60;
      Object.assign(this.out, { played: false, vision: ok ? 1.0 : 0.3, color: ok, hearing: ok, motor: ok, ok });
      super.end(score, ok ? '適性検査は全部クリア！' : '基準に届かない検査があった…。');
      return;
    }
    super.end(score, comment);
  }

  // ---------------------------------------------------------------- draw
  drawBackground(ctx) {
    R(ctx, 0, 0, SW, SH, '#dfe6ea');
    R(ctx, 0, 0, SW, 38, '#2a5a6a');
  }
  drawPlay(ctx) {
    this.drawBackground(ctx);
    const p = this.parts[this.pi] || 'motor';
    const names = { vision: '視力検査', color: '色彩識別検査', hearing: '聴力検査', motor: '運動能力検査' };
    text(ctx, `適性検査　${this.pi + 1} / 4　${names[p]}`, 16, 10, { size: 18, color: '#fff', shadow: null });
    if (this.sub === 9) {
      text(ctx, this.msg, SW / 2, 150, { size: 40, align: 'center', color: /NG/.test(this.msg) ? '#d0402f' : '#2a7a4a', shadow: null });
      return;
    }
    if (p === 'vision') this.drawVision(ctx);
    else if (p === 'color') this.drawColor(ctx);
    else if (p === 'hearing') this.drawHearing(ctx);
    else this.drawMotor(ctx);
    if (this.msgT > 0 && this.sub !== 9) text(ctx, this.msg, SW / 2, 250, { size: 20, align: 'center', color: '#5a5640', shadow: null });
  }
  drawPad(ctx, keys) {
    const rects = this.padRects();
    const lab = { left: '←', up: '↑', down: '↓', right: '→' };
    for (const k of keys) { const r = rects[k]; R(ctx, r.x, r.y, r.w, r.h, '#3a6a7a'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); text(ctx, lab[k], r.x + r.w / 2, r.y + 12, { size: 34, align: 'center', color: '#fff', shadow: null }); }
  }
  drawVision(ctx) {
    const lv = Math.min(this.level, RING.length - 1);
    const r = RING[lv];
    const cx = SW / 2, cy = 150;
    text(ctx, 'あいている向きは？', SW / 2, 58, { size: 20, align: 'center', color: '#2a3a4a', shadow: null });
    ctx.save();
    if (this.cap < 9) ctx.filter = 'blur(3px)'; // (needs glasses)
    const ang = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[DIRS4[this.target]];
    ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, r * 0.42);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, ang + 0.28, ang + Math.PI * 2 - 0.28); ctx.stroke();
    ctx.restore();
    text(ctx, `${VISION_LEVELS[Math.min(this.level, VISION_LEVELS.length - 1)].toFixed(1)}`, 40, 134, { size: 26, color: '#2a3a4a', shadow: null });
    this.drawPad(ctx, ['left', 'up', 'down', 'right']);
  }
  drawColor(ctx) {
    const id = this.items[Math.min(this.sub, this.items.length - 1)];
    const l = LIGHTS.find((x) => x.id === id);
    text(ctx, '光の色は？', SW / 2, 58, { size: 20, align: 'center', color: '#2a3a4a', shadow: null });
    R(ctx, SW / 2 - 90, 92, 180, 120, '#2a2a30');
    ctx.fillStyle = this.st > 12 ? l.col : '#444'; ctx.beginPath(); ctx.arc(SW / 2, 152, 42, 0, Math.PI * 2); ctx.fill();
    const rects = this.padRects();
    for (const x of LIGHTS) { const r = rects[x.key]; R(ctx, r.x, r.y, r.w, r.h, x.col); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); text(ctx, `${x.label}${DIR_LABEL[{ left: 'left', up: 'up', right: 'right' }[x.key]]}`, r.x + r.w / 2, r.y + 14, { size: 28, align: 'center', color: '#fff', shadow: null }); }
  }
  drawHearing(ctx) {
    text(ctx, '音が聞こえたら Aボタン！', SW / 2, 58, { size: 20, align: 'center', color: '#2a3a4a', shadow: null });
    const on = this.beepAt >= 0 && this.st - this.beepAt < 40;
    ctx.fillStyle = on ? '#2f9a5a' : '#8a949a'; ctx.beginPath(); ctx.arc(SW / 2, 150, 44, 0, Math.PI * 2); ctx.fill();
    text(ctx, on ? '♪' : '…', SW / 2, 126, { size: 52, align: 'center', color: '#fff', shadow: null });
    text(ctx, `${this.round + 1} / 3`, SW / 2, 214, { size: 18, align: 'center', color: '#2a3a4a', shadow: null });
    const r = { x: 240, y: 296, w: 160, h: 56 };
    R(ctx, r.x, r.y, r.w, r.h, '#3a6a7a'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); text(ctx, '聞こえた (A)', r.x + r.w / 2, r.y + 16, { size: 20, align: 'center', color: '#fff', shadow: null });
  }
  drawMotor(ctx) {
    text(ctx, '出た矢印と同じ向きを押そう', SW / 2, 58, { size: 20, align: 'center', color: '#2a3a4a', shadow: null });
    const d = this.seq[Math.min(this.sub, this.seq.length - 1)];
    text(ctx, DIR_LABEL[d], SW / 2, 100, { size: 96, align: 'center', color: '#2a3a4a', shadow: null });
    text(ctx, `${this.sub + 1} / ${this.seq.length}`, SW / 2, 214, { size: 18, align: 'center', color: '#2a3a4a', shadow: null });
    this.drawPad(ctx, ['left', 'up', 'down', 'right']);
  }
}
registerMinigame('license_check', LicenseCheck);

// ======================================================================== music for the places
registerSong('kyoshujo', {
  bpm: 112, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'C5 . E5 . G5 . E5 . | F5 . A5 . C6 . A5 . | G5 . B5 . D6 . B5 . | E5 . G5 . C6 - - . | A4 . C5 . E5 . C5 . | D5 . F5 . A5 . F5 . | G5 . B5 . D6 . G5 . | C5 - E5 - G5 - - .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | C3 . G3 . E3 . G3 . | A2 . E3 . A2 . E3 . | D3 . A3 . D3 . A3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h . s . h h' },
  ],
});
registerSong('menkyo', {
  bpm: 96, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'E4 . G4 . B4 . G4 . | A4 . C5 . E5 . C5 . | D4 . F4 . A4 . F4 . | G4 . B4 . D5 - - . | E4 . G4 . B4 . E5 . | C5 . A4 . F4 . A4 . | D5 . B4 . G4 . B4 . | E4 - - - - - - .' },
    { wave: 'square', vol: 0.025, notes: 'E3 - - - A2 - - - | D3 - - - G2 - - - | E3 - - - A2 - - - | D3 - - - E3 - - -' },
  ],
});
registerSong('gassyuku', {
  bpm: 104, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'G4 . A4 . C5 . D5 . | E5 . D5 . C5 . A4 . | G4 . A4 . C5 . E5 . | D5 - - . G4 - - . | A4 . C5 . D5 . F5 . | E5 . D5 . C5 . D5 . | C5 . A4 . G4 . A4 . | G4 - - - - - - .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . G3 . | F2 . C3 . G2 . D3 . | C3 - - - - - - .' },
    { wave: 'drum', vol: 0.05, notes: 'k . . h s . . h' },
  ],
});

export { LicenseExam, LicenseCheck };
