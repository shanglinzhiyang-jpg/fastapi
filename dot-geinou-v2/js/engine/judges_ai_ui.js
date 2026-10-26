// 審査員名鑑 — the HD screen of the judge agents [R11-J] (640x360, keys + taps, 412x915 portrait via the neta kit's touch layout).
// Era-skinned like the 賞レース broadcast package (contests_tv.js: 昭和 blue telop + ブラウン管, 平成 red→orange variety bands, 令和 red/gold).
//   scopes (←→ on the top row): ネタの審査員 (the five seats) · M-1 · キングオブコント · each contest with a judges' panel
//   pages (←→ on the list): プロフィール (portrait, 肩書, 審査員歴, mood, taste radar: the debut outline against today's) · 好みの推移
//     (a small history chart of the six taste dimensions + the scene) · あなたとの関係 (what they think of you, their last comments,
//     favourite acts, 「この審査員にたずねる」) · 席の相関 (who agrees with whom)
// Keys: ↑↓ judge, ←→ page / scope, A たずねる (Claude when the player's key is set, else the judge's own memory), B back, MENU close.
// openJudgeBook(g, opts: { scope, key }) → Promise.

import { SW, SH, clamp, shade } from './util.js';
import { measure } from './draw.js';
import { drawFaceHD } from './sprites.js';
import * as TVG from './contests_tv.js';
import { Base, T, R, box, chip, para, jwrap, K, inR, sfx, num, CLOSE, drawClose, TB, isTouch, safe } from './neta_ui_kit.js';
import { DIMS, DIM_JP } from './judges_ai.js';
import { QUESTIONS } from './judges_ai_claude.js';

const DIM_COL = ['#5fd7ff', '#ff7eb6', '#ffd23f', '#7fe08a', '#ff9a3c', '#c49cff'];
const PAGES = ['プロフィール', '好みの推移', 'あなたとの関係', '席の相関', '動向'];
const ROW_H = 42;

export class JudgeBookScene extends Base {
  constructor(g, opts, resolve) {
    super(g, resolve);
    this.isJudgeBook = true;
    this.opts = opts || {};
    this.scopes = g.judgeScopes();
    this.si = Math.max(0, this.scopes.findIndex((s) => s.id === (opts && opts.scope)));
    this.page = 0; this.focus = 'list'; this.sel = 0; this.top = 0;
    this.load();
    if (opts && opts.key) { const i = this.data.judges.findIndex((j) => j.key === opts.key); if (i >= 0) this.sel = i; }
    this.touchY0 = 28;
    this.toastY = 330;
  }
  load() {
    const sc = this.scopes[this.si];
    this.data = this.g.judgeBook(sc ? sc.id : 'neta') || { scope: sc, scopes: this.scopes, year: sc ? sc.year : 2026, judges: [], corr: [], scene: { tops: [], lows: [], kinds: {}, vec: [] }, log: [] };
    this.sel = clamp(this.sel, 0, Math.max(0, this.data.judges.length - 1));
    this.top = 0;
  }
  get cur() { return this.data.judges[this.sel] || null; }
  setScope(d) {
    const n = this.scopes.length;
    if (n < 2) return;
    this.si = (this.si + d + n) % n; this.sel = 0; this.load(); sfx('cursor');
  }
  updateBody(inp) {
    if (inp.pressed('menu')) { sfx('cancel'); this.close(); return; }
    if (inp.pressed('b')) { sfx('cancel'); if (this.focus === 'list') this.focus = 'scope'; else this.close(); return; }
    const n = this.data.judges.length;
    if (this.focus === 'scope') {
      if (inp.repeat('left')) this.setScope(-1);
      else if (inp.repeat('right')) this.setScope(1);
      else if (inp.repeat('down') || inp.pressed('a')) { if (n) { this.focus = 'list'; sfx('cursor'); } }
      return;
    }
    if (inp.repeat('up')) { if (this.sel > 0) { this.sel--; sfx('cursor'); } else { this.focus = 'scope'; sfx('cursor'); } }
    else if (inp.repeat('down')) { if (this.sel < n - 1) { this.sel++; sfx('cursor'); } }
    else if (inp.repeat('left')) { this.page = (this.page + PAGES.length - 1) % PAGES.length; sfx('cursor'); }
    else if (inp.repeat('right')) { this.page = (this.page + 1) % PAGES.length; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.ask(); }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, CLOSE)) { sfx('cancel'); this.close(); return true; }
    if (this.scopeL && inR(tap.x, tap.y, this.scopeL)) { this.focus = 'scope'; this.setScope(-1); return true; }
    if (this.scopeR && inR(tap.x, tap.y, this.scopeR)) { this.focus = 'scope'; this.setScope(1); return true; }
    for (let i = 0; i < (this.pageRects || []).length; i++) if (inR(tap.x, tap.y, this.pageRects[i])) { this.page = i; this.focus = 'list'; sfx('cursor'); return true; }
    if (this.askRect && inR(tap.x, tap.y, this.askRect)) { sfx('ok'); this.ask(); return true; }
    for (let k = 0; k < (this.rowRects || []).length; k++) {
      if (!inR(tap.x, tap.y, this.rowRects[k])) continue;
      const i = this.top + k;
      this.focus = 'list';
      if (i === this.sel) { if (this.page === 2) { sfx('ok'); this.ask(); } } else { this.sel = i; sfx('cursor'); }
      return true;
    }
    return true;
  }
  // 「この審査員にたずねる」: pick a question; the answer comes from Claude (the player's key) or from the judge's own memory
  async ask() {
    const p = this.cur;
    if (!p) return;
    await this.act(async () => {
      const i = await this.pick({ title: `${p.name}にたずねる`, lines: ['（APIキーを設定していれば、Claudeが審査員の記憶をもとに答えます。なければ審査員が自分の記憶で答えます）'], items: [...QUESTIONS.map((q) => ({ label: q.label })), { label: 'やめる' }] });
      if (i < 0 || i >= QUESTIONS.length) return;
      this.toast('審査員が考えています…', K.dim);
      const r = await this.g.judgeAsk(p.key, QUESTIONS[i].id, { profile: p });
      await this.info(`${p.name}（${r.by === 'claude' ? 'Claude' : p.school}）`, [`「${r.text}」`, ...(r.notice ? [`※${r.notice}`] : [])]);
    });
  }
  touchBarTap(tap) {
    if (this.scopeL && tap.x < SW / 4) this.setScope(-1);
    else if (tap.x > SW / 2 && tap.x < SW - TB) this.setScope(1);
  }
  drawTouchBar(c) {
    const sc = this.data.scope || {};
    T(c, '審査員名鑑', 12, 10, 16, K.gold, 'left', 200);
    T(c, `◀ ${sc.label || ''} ▶`, 12, 38, 14, K.text, 'left', SW - TB - 24);
  }
  // ------------------------------------------------------------------ drawing
  drawScreen(c) {
    const D = this.data;
    const st = TVG.tvStyle(D.year);
    this.st = st;
    TVG.backdrop(c, st);
    TVG.beams(c, this.t, st, 0, 26, SW, SH - 26, 0.8);
    TVG.band(c, 0, 0, SW, 26, shade(st.band0, -0.1), shade(st.band1, -0.2));
    R(c, 0, 25, SW, 2, st.accent);
    TVG.sheen(c, this.t, 0, 0, SW, 25, 240);
    TVG.telop(c, '審査員名鑑', 10, 4, 16, st.telop, st.telopLine, 'left');
    const sc = D.scope || {};
    T(c, `${D.year}年　${sc.label || ''}`, 118, 7, 12, '#ffffff', 'left', SW - 190);
    drawClose(c);
    // scope bar
    const isTouchL = isTouch();
    R(c, 0, 28, SW, 18, 'rgba(0,0,0,0.35)');
    const fS = this.focus === 'scope';
    this.scopeL = { x: 4, y: 28, w: 60, h: 18 }; this.scopeR = { x: SW - 64, y: 28, w: 60, h: 18 };
    T(c, '◀', 34, 31, 12, fS ? st.accent : K.dim, 'center'); T(c, '▶', SW - 34, 31, 12, fS ? st.accent : K.dim, 'center');
    T(c, `${sc.label || ''}（${this.si + 1}/${this.scopes.length}）　${D.judges.length}人`, SW / 2, 31, 12, fS ? st.accent : K.text, 'center', SW - 160);
    if (isTouchL) { /* the scope also sits in the touch bar */ }
    this.drawList(c, st);
    this.drawPageTabs(c, st);
    const p = this.cur;
    if (!p) { T(c, 'この大会に審査員はいません。', 420, 180, 12, K.dim, 'center'); }
    else if (this.page === 0) this.pageProfile(c, st, p);
    else if (this.page === 1) this.pageTrend(c, st, p);
    else if (this.page === 2) this.pageRelation(c, st, p);
    else if (this.page === 3) this.pageCorr(c, st);
    else this.pageLog(c, st);
    R(c, 0, 342, SW, 18, 'rgba(0,0,0,0.55)');
    T(c, '↑↓ 審査員　←→ ページ　A たずねる　B もどる', SW - 8, 346, 10, K.faint, 'right', 360);
    const sceneTxt = D.scene && D.scene.tops && D.scene.tops.length ? `いまのはやり：${D.scene.tops.join('・')}${D.scene.lows && D.scene.lows.length ? `（${D.scene.lows.join('・')}は下火）` : ''}` : 'いまのはやり：はっきりした流行はない';
    T(c, sceneTxt, 8, 346, 10, st.accent, 'left', 250);
    TVG.crt(c, st, this.t);
  }
  drawList(c, st) {
    const L = { x: 6, y: 50, w: 190, h: 288 };
    const vis = Math.floor(L.h / ROW_H);
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + vis) this.top = this.sel - vis + 1;
    this.rowRects = [];
    const J = this.data.judges;
    for (let k = 0; k < vis && this.top + k < J.length; k++) {
      const p = J[this.top + k];
      const y = L.y + k * ROW_H;
      const on = this.top + k === this.sel;
      TVG.band(c, L.x, y, L.w, ROW_H - 3, on ? st.sel0 : st.row0, on ? st.sel1 : st.row1, { vertical: true, gloss: false });
      if (on) { R(c, L.x, y, 3, ROW_H - 3, st.accent); if (this.focus === 'list') R(c, L.x + L.w - 3, y, 3, ROW_H - 3, st.accent); }
      R(c, L.x + 6, y + 4, 36, 34, '#0a0a14');
      safe(() => drawFaceHD(c, p.look, L.x + 8, y + 9, 1));
      T(c, p.name, L.x + 48, y + 4, 12, '#ffffff', 'left', L.w - 56);
      T(c, String(p.title).replace(/（芸歴.*$/, ''), L.x + 48, y + 18, 10, K.dim, 'left', L.w - 56);
      chip(c, L.x + 48, y + 29, p.school, st.accent, 0, 9);
      const mc = p.mood > 0.2 ? K.green : p.mood < -0.2 ? K.red : K.dim;
      R(c, L.x + L.w - 12, y + 6, 6, 6, mc);
      this.rowRects.push({ x: L.x, y, w: L.w, h: ROW_H - 3 });
    }
    if (J.length > vis) { const bh = Math.max(14, (vis / J.length) * L.h); R(c, L.x + L.w + 1, L.y + (this.top / J.length) * L.h, 2, bh, st.rule); }
  }
  drawPageTabs(c, st) {
    this.pageRects = [];
    const x0 = 204, w = (SW - 8 - x0) / PAGES.length;
    PAGES.forEach((lb, i) => {
      const on = i === this.page;
      const x = Math.round(x0 + i * w);
      TVG.band(c, x, 50, Math.round(w) - 2, 18, on ? st.tabOn0 : st.tab0, on ? st.tabOn1 : st.tab1, { vertical: true, gloss: false });
      T(c, lb, x + w / 2 - 1, 54, 11, on ? st.ink : '#ffffff', 'center', w - 6);
      this.pageRects.push({ x, y: 50, w: Math.round(w) - 2, h: 18 });
    });
  }
  // --- page 0
  pageProfile(c, st, p) {
    const X = 206, Y = 72, W = SW - 8 - X;
    R(c, X, Y, W, 266, 'rgba(8,8,20,0.72)');
    R(c, X + 8, Y + 8, 72, 56, '#0a0a14');
    safe(() => drawFaceHD(c, p.look, X + 12, Y + 12, 2));
    T(c, p.name, X + 90, Y + 6, 16, '#ffffff', 'left', 132);
    para(c, p.title, X + 90, Y + 28, 132, 10, K.dim, 12, 2);
    const yrs = p.scope === 'neta' && p.seat ? `ネタの審査員歴 ${p.years + 1}年目` : `審査員歴 ${p.years + 1}年目`;
    T(c, yrs, X + 90, Y + 54, 10, st.accent, 'left', 132);
    T(c, `いまは「${p.school}」`, X + 8, Y + 72, 12, '#ffffff', 'left', 214);
    let y = Y + 88;
    if (p.baseSchool !== p.school) { T(c, `（就任時は${p.baseSchool}）`, X + 8, y, 10, K.dim, 'left', 214); y += 13; }
    y += para(c, p.drift ? `この数年の変化：${p.drift}` : 'この数年、好みはほとんど変わっていない', X + 8, y, 214, 10, p.drift ? st.accent : K.dim, 12, 2) + 3;
    const mc = p.mood > 0.2 ? K.green : p.mood < -0.2 ? K.red : K.dim;
    R(c, X + 8, y + 3, 6, 6, mc);
    T(c, `きょうの機嫌：${p.moodWord}`, X + 20, y, 10, K.text, 'left', 200);
    y += 15;
    if (p.seat) {
      T(c, `${p.seat.gen ? `${p.seat.gen + 1}代目の席` : '初代の席'}${p.seat.mentor ? `・師匠は${p.seat.mentor}` : ''}`, X + 8, y, 10, K.dim, 'left', 214); y += 12;
      if (p.seat.prev && p.seat.prev.length) { T(c, `前任：${p.seat.prev[p.seat.prev.length - 1].name}`, X + 8, y, 10, K.dim, 'left', 214); y += 12; }
    } else if (p.alumni) { T(c, '元王者が審査員席に座っている', X + 8, y, 10, K.dim, 'left', 214); y += 12; }
    // the main goal and its progress
    if (p.goal) {
      const gy = Math.max(y + 4, Y + 150);
      T(c, `いまの目標：${p.goal.label}`, X + 8, gy, 10, st.accent, 'left', 214);
      R(c, X + 8, gy + 14, 214, 5, '#1a1a2c'); R(c, X + 8, gy + 14, Math.round(214 * clamp(p.goal.progress, 0, 1)), 5, st.rule);
      T(c, p.goal.note, X + 8, gy + 22, 10, K.dim, 'left', 214);
      y = gy + 34;
    }
    // traits
    const tr = p.tr || {};
    const bars = [['公平さ', tr.fair, 0.3, 0.97], ['流行への敏感さ', tr.open, 0.4, 1.2], ['頑固さ', tr.stub, 0, 1], ['記憶力', tr.mem, 0.5, 1.2]];
    const by = Math.max(y + 2, Y + 186);
    bars.forEach(([lb, v, lo, hi], i) => {
      const yy = by + i * 16;
      T(c, lb, X + 8, yy, 10, K.dim, 'left', 90);
      R(c, X + 100, yy + 3, 110, 7, '#1a1a2c'); R(c, X + 100, yy + 3, Math.max(6, Math.round(110 * clamp(((v ?? 0.5) - lo) / (hi - lo), 0, 1))), 7, st.rule);
    });
    // radar: the debut outline against today's
    const cx = X + 232 + (W - 240) / 2;
    this.radar(c, cx, Y + 128, 64, p, st);
    R(c, cx - 78, Y + 226, 16, 2, K.faint); T(c, '就任時', cx - 58, Y + 221, 10, K.faint, 'left');
    R(c, cx + 10, Y + 226, 16, 3, st.accent); T(c, 'いま', cx + 30, Y + 221, 10, st.accent, 'left');
    if (p.line) para(c, `「${p.line}」`, X + 236, Y + 238, W - 244, 10, K.dim, 12, 2);
  }
  radar(c, cx, cy, r, p, st) {
    c.save();
    c.lineWidth = 1;
    for (const ring of [0.34, 0.67, 1]) { c.beginPath(); for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i % 6) * Math.PI / 3; const x = cx + Math.cos(a) * r * ring, y = cy + Math.sin(a) * r * ring; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.strokeStyle = ring === 1 ? st.rule : 'rgba(255,255,255,0.18)'; c.stroke(); }
    const pt = (v, i, k = 1) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * r * clamp(v, 0.04, 1) * k, cy + Math.sin(a) * r * clamp(v, 0.04, 1) * k]; };
    const poly = (vec) => { c.beginPath(); for (let i = 0; i <= 6; i++) { const [x, y] = pt(vec[i % 6], i % 6); if (i) c.lineTo(x, y); else c.moveTo(x, y); } };
    poly(p.tasteBase); c.setLineDash([3, 3]); c.strokeStyle = 'rgba(200,200,220,0.7)'; c.stroke(); c.setLineDash([]);
    poly(p.tasteNow); c.fillStyle = 'rgba(255,207,74,0.30)'; c.fill(); c.strokeStyle = st.accent; c.lineWidth = 2; c.stroke();
    c.restore();
    for (let i = 0; i < 6; i++) {
      const [x, y] = pt(1, i, 1.2);
      const al = Math.abs(x - cx) < 8 ? 'center' : x < cx ? 'right' : 'left';
      T(c, DIM_JP[DIMS[i]], x, y - 6, 10, DIM_COL[i], al, 70);
    }
  }
  // --- page 1
  pageTrend(c, st, p) {
    const X = 206, Y = 72, W = SW - 8 - X;
    R(c, X, Y, W, 266, 'rgba(8,8,20,0.72)');
    T(c, `${p.name}の好みの移り変わり`, X + 8, Y + 6, 12, '#ffffff', 'left', W - 16);
    const cx0 = X + 34, cy0 = Y + 28, cw = W - 130, ch = 150;
    R(c, cx0, cy0, cw, ch, 'rgba(0,0,0,0.35)');
    const H = p.hist;
    const n = H.length;
    // the vertical range zooms to the data (at least 0.3 wide) so that small drifts are visible
    let lo = 1, hi = 0;
    for (const [, v] of H) for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    for (const x of p.tasteBase) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    const span = Math.max(0.3, hi - lo + 0.1), mid = (hi + lo) / 2;
    const vlo = clamp(mid - span / 2, 0, 1 - span), vhi = vlo + span;
    const yOf = (v) => cy0 + ch - ((clamp(v, vlo, vhi) - vlo) / span) * ch;
    if (n >= 2) for (const f of [0, 0.5, 1]) { R(c, cx0, cy0 + ch - f * ch, cw, 1, 'rgba(255,255,255,0.12)'); T(c, String(Math.round((vlo + f * span) * 100)), cx0 - 4, cy0 + ch - f * ch - 5, 10, K.faint, 'right'); }
    if (n < 2) { // only the debut year on record: today's taste against the debut, as bars
      DIMS.forEach((k, di) => {
        const yy = cy0 + 8 + di * 23;
        T(c, DIM_JP[k], cx0 + 8, yy, 10, DIM_COL[di], 'left', 80);
        R(c, cx0 + 92, yy + 3, cw - 110, 8, '#1a1a2c'); R(c, cx0 + 92, yy + 3, Math.round((cw - 110) * clamp(p.tasteNow[di], 0, 1)), 8, DIM_COL[di]);
        R(c, cx0 + 92 + Math.round((cw - 110) * clamp(p.tasteBase[di], 0, 1)), yy, 2, 14, '#ffffff');
      });
      T(c, '白い印が就任時の好み', cx0 + cw - 6, cy0 + ch - 14, 10, K.faint, 'right');
    }
    c.save(); c.lineWidth = 2;
    if (n < 2) c.globalAlpha = 0;
    DIMS.forEach((k, di) => {
      c.beginPath();
      H.forEach(([y, v], i) => { const x = cx0 + (n > 1 ? (i / (n - 1)) * cw : cw / 2), yy = yOf(v[di]); if (i) c.lineTo(x, yy); else c.moveTo(x, yy); });
      c.strokeStyle = DIM_COL[di]; c.stroke();
      const last = H[n - 1][1][di];
      c.fillStyle = DIM_COL[di]; c.fillRect(Math.round(cx0 + (n > 1 ? cw : cw / 2)) - 2, Math.round(yOf(last)) - 2, 4, 4);
    });
    c.restore();
    if (n < 2) { /* no lines yet */ }
    // years
    const step = Math.max(1, Math.ceil(n / 6));
    if (n >= 2) H.forEach(([y], i) => { if (i % step === 0 || i === n - 1) T(c, String(y), cx0 + (n > 1 ? (i / (n - 1)) * cw : cw / 2), cy0 + ch + 4, 10, K.dim, 'center'); });
    // legend + now values
    DIMS.forEach((k, di) => {
      const y = cy0 + di * 24;
      R(c, cx0 + cw + 12, y + 4, 10, 3, DIM_COL[di]);
      T(c, DIM_JP[k], cx0 + cw + 26, y, 10, K.text, 'left', 70);
      const dlt = Math.round((p.tasteNow[di] - p.tasteBase[di]) * 100);
      T(c, `${Math.round(p.tasteNow[di] * 100)}${dlt ? `（${dlt > 0 ? '+' : ''}${dlt}）` : ''}`, cx0 + cw + 26, y + 11, 10, dlt > 0 ? K.green : dlt < 0 ? K.red : K.dim, 'left', 80);
    });
    const sc = this.data.scene;
    para(c, n < 2 ? 'この審査員の好みはまだ動き始めたばかり。年を重ねるごとに、流行・歴代王者・年齢で少しずつ動く。' : `${p.drift ? `${p.drift}。` : '好みは大きく動いていない。'}${sc.tops.length ? `世の中では${sc.tops.join('・')}が評価されやすい時期。` : ''}`, X + 10, Y + 216, W - 20, 10, K.dim, 13, 3);
    const kinds = sc.kinds || {};
    const kl = [['漫才', 'manzai'], ['コント', 'conte'], ['一人芸', 'pin'], ['落語', 'rakugo']].map(([lb, k]) => `${lb}${kinds[k] > 0.15 ? '↑' : kinds[k] < -0.15 ? '↓' : '→'}`).join('　');
    T(c, `近年の王者の型：${kl}`, X + 10, Y + 250, 10, st.accent, 'left', W - 20);
  }
  // --- page 2
  pageRelation(c, st, p) {
    const X = 206, Y = 72, W = SW - 8 - X;
    R(c, X, Y, W, 266, 'rgba(8,8,20,0.72)');
    T(c, `${p.name}から見たあなた`, X + 8, Y + 6, 12, '#ffffff', 'left', W - 16);
    para(c, p.thinks, X + 8, Y + 24, W - 16, 12, st.accent, 15, 2);
    const bar = (lb, v, y, col, mid = false) => {
      T(c, lb, X + 8, y, 10, K.dim, 'left', 70);
      R(c, X + 80, y + 3, 140, 7, '#1a1a2c');
      if (mid) { R(c, X + 150, y + 1, 1, 11, K.faint); const w = Math.round(70 * clamp(v, -1, 1)); R(c, v >= 0 ? X + 150 : X + 150 + w, y + 3, Math.abs(w), 7, v >= 0 ? K.green : K.red); } else R(c, X + 80, y + 3, Math.round(140 * clamp(v, 0, 1)), 7, col);
    };
    bar('好意', p.fo, Y + 58, K.green, true);
    bar('要求の高さ', p.br, Y + 74, st.rule);
    T(c, `見た回数 ${p.se}回`, X + 232, Y + 58, 10, K.text, 'left', 120);
    T(c, `機嫌：${p.moodWord}`, X + 232, Y + 74, 10, K.text, 'left', 120);
    T(c, 'これまでのコメント', X + 8, Y + 94, 10, st.accent);
    const cms = p.cm.slice().reverse();
    if (!cms.length) T(c, 'まだ、あなたのネタについて何も言っていない。', X + 8, Y + 110, 10, K.dim, 'left', W - 16);
    let y = Y + 108;
    cms.slice(0, 3).forEach((m) => { T(c, `${m[0]}日目・${m[1]}点`, X + 8, y, 10, K.faint, 'left', 90); y += 12; y += para(c, `「${m[2]}」`, X + 14, y, W - 28, 10, K.text, 12, 2) + 4; });
    if (p.fv.length) { T(c, `お気に入り：${p.fv.map((f) => `『${f[0]}』${f[1]}点`).join('　')}`, X + 8, Y + 208, 10, K.green, 'left', W - 16); }
    this.askRect = { x: X + 8, y: Y + 232, w: W - 16, h: 28 };
    TVG.band(c, this.askRect.x, this.askRect.y, this.askRect.w, this.askRect.h, st.band0, st.band1, { slant: 8 });
    T(c, 'この審査員にたずねる　（A）', X + W / 2, Y + 239, 12, '#ffffff', 'center', W - 40);
  }
  // --- page 3
  pageCorr(c, st) {
    const X = 206, Y = 72, W = SW - 8 - X;
    R(c, X, Y, W, 266, 'rgba(8,8,20,0.72)');
    const J = this.data.judges, M = this.data.corr, n = J.length;
    T(c, '審査員席の相関（好みの近さ＋これまでの採点の近さ）', X + 8, Y + 6, 12, '#ffffff', 'left', W - 16);
    if (n < 2) { T(c, '比べる相手がいない。', X + 8, Y + 40, 10, K.dim); return; }
    const cs = Math.min(30, Math.floor(190 / n)), x0 = X + 60, y0 = Y + 44;
    for (let j = 0; j < n; j++) T(c, String(J[j].name).split(' ')[0].slice(0, 2), x0 + j * cs + cs / 2, y0 - 14, 10, j === this.sel ? st.accent : K.dim, 'center');
    for (let i = 0; i < n; i++) {
      T(c, String(J[i].name).split(' ')[0].slice(0, 3), x0 - 4, y0 + i * cs + cs / 2 - 5, 10, i === this.sel ? st.accent : K.dim, 'right', 54);
      for (let j = 0; j < n; j++) {
        const v = M[i][j];
        const col = i === j ? '#2a2a3a' : v >= 66 ? '#2f9a5a' : v >= 48 ? '#8a8a3a' : '#a04050';
        R(c, x0 + j * cs, y0 + i * cs, cs - 2, cs - 2, col);
        if (i !== j) T(c, String(v), x0 + j * cs + (cs - 2) / 2, y0 + i * cs + (cs - 2) / 2 - 5, 10, '#ffffff', 'center');
        if (i === this.sel || j === this.sel) R(c, x0 + j * cs, y0 + i * cs, cs - 2, 1, st.accent);
      }
    }
    const i = this.sel;
    const others = J.map((q, j) => [j, M[i][j]]).filter(([j]) => j !== i).sort((a, b) => b[1] - a[1]);
    if (others.length) {
      const ally = others[0], rival = others[others.length - 1];
      const ty = y0 + n * cs + 10;
      T(c, `${J[i].name}と気が合うのは`, X + 8, ty, 10, K.dim, 'left', 150); T(c, `${J[ally[0]].name}（${ally[1]}）`, X + 150, ty, 12, K.green, 'left', W - 160);
      T(c, `${J[i].name}と割れやすいのは`, X + 8, ty + 16, 10, K.dim, 'left', 150); T(c, `${J[rival[0]].name}（${rival[1]}）`, X + 150, ty + 16, 12, K.red, 'left', W - 160);
    }
  }
  // --- page 4: 動向 (what the judges decided: seats, panels, the scene), newest first
  pageLog(c, st) {
    const X = 206, Y = 72, W = SW - 8 - X;
    R(c, X, Y, W, 266, 'rgba(8,8,20,0.72)');
    T(c, '審査員の動向（自分で決めたこと）', X + 8, Y + 6, 12, '#ffffff', 'left', W - 16);
    const log = this.data.log || [];
    if (!log.length) { para(c, 'まだ動きはない。年が変わると、審査員の交代・引退の理由・世の中のはやりの変化がここに記録される。', X + 10, Y + 30, W - 20, 12, K.dim, 16, 4); return; }
    let y = Y + 26;
    for (const l of log.slice(0, 8)) {
      if (y > Y + 244) break;
      const col = l.k === 'seat' ? st.accent : l.k === 'panel' ? K.cyan : K.green;
      chip(c, X + 8, y, l.k === 'seat' ? '交代' : l.k === 'panel' ? '大会' : 'はやり', col, 40, 10);
      T(c, `${l.d}日目`, X + W - 8, y + 2, 10, K.faint, 'right');
      y += 18;
      y += para(c, String(l.s), X + 12, y, W - 24, 10, K.text, 12, 2) + 4;
    }
  }
}

export function openJudgeBook(g, opts = {}) {
  if (!g || !g.state) return Promise.resolve(null);
  const open = g.scenes.find((s) => s.isJudgeBook && !s.closed);
  if (open) return Promise.resolve(null);
  sfx('ok');
  return new Promise((resolve) => { const sc = new JudgeBookScene(g, opts, resolve); g.push(sc); });
}
if (typeof window !== 'undefined') window.__judgeui = { scene: () => (window.__game && window.__game.scenes.find((s) => s.isJudgeBook && !s.closed)) || null, open: openJudgeBook };
void measure; void jwrap; void box; void num;
