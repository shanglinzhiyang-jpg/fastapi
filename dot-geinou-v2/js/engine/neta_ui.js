// 台本作成とAI審査員の画面 (owner: B; the editor: R10-A): HD screens (640x360) + the phone app 「ネタ帳」. Only g.* methods of neta.js are
// called back (no import of neta.js: it imports this file).
//
//   openEditor(g, draft, opts)  → Promise<Neta|null>   the script editor (台本エディタ — EditorScene lives in neta_editor.js; its
//                                                      logic in neta_editor_core.js, skins in neta_editor_skin.js, drawing in
//                                                      neta_editor_view.js, 読み上げプレビュー in neta_editor_read.js)
//   openResult(g, neta, ai)     → Promise              the AI審査員's result (総評・審査員・行ごと・アドバイス)
//   openPicker(g, opts)         → Promise<Neta|null>   choose a script to perform (+ 新しく書く / おまかせ)
//   openSettings(g)             → Promise              AI審査員の設定 (ローカルAI / Claude with the player's API key)
//   openWaiting(g, run)         → Promise<result>      「審査中…」 while Claude reads (B: やめてローカルAIで)
//   installNetaApp()            registers the phone app 'neta' (all three devices)
// The shared visual tokens, text helpers, the screen base class, the pick / confirm modal and the parts picker are in neta_ui_kit.js.
// Keys: ↑↓ choose, A act, B back, ←→ tabs / toolbar / (editor list) change the speaker; MENU closes. Taps: rows (first tap
// selects, second acts), toolbar buttons, tabs, ×, modal rows / buttons. Under g.auto the screens do not open unless
// g.auto.netaui (tests); test hook: window.__netaui = { top(), EditorScene, ResultScene, PickerScene, SettingsScene, partsModal }.

import { SW, SH, clamp } from './util.js';
import { measure } from './draw.js';
import { registerPhoneApp } from './life.js';
import { askText } from './textinput.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, withPhone } from './phone.js';
import { estimate, structureCheck, KINDS, AXES, AXES_BY_KIND, JUDGES, mmss, netaHash, rankLabel } from './neta_ai.js';
import { keyState, setKey, setRemember, clearKey, setMode, getMode, CLAUDE } from './neta_claude.js';
import {
  has, safe, sfx, num, R, inR, short, K, KIND_LABEL, ROLE_OPTS, ROLE_LONG, ROLE_SHORT, ROLE_COL, BEAT_OPTS, BEAT_LONG, BEAT_SHORT, BEAT_COL, GENERIC_PRESETS,
  lengthPresets, fit, T, jwrap, para, box, chip, scoreCol, CLOSE, drawClose, TB, isTouch, bindTap, Base, modal, partsModal,
} from './neta_ui_kit.js';
import { EditorScene } from './neta_editor.js';
import * as JM from './judges_ai_mem.js'; // [R11-J] the breakdown and the 座談 of a result (pure)

// re-exported for the other modules and the tests (they imported these from here before the kit was split out)
export { KIND_LABEL, ROLE_OPTS, BEAT_OPTS, GENERIC_PRESETS, lengthPresets, EditorScene };

// ================================================================ the result
const TABS_R = ['総評', '審査員', '行ごと', 'アドバイス'];
export class ResultScene extends Base {
  constructor(g, neta, ai, resolve) {
    super(g, resolve);
    this.n = neta; this.ai = ai;
    this.tab = 0; this.scroll = [0, 0, 0, 0]; this.lsel = 0;
    this.jsel = 0; this.cardPos = []; // [R11-J] the selected judge on the 審査員 tab
    this.kind = KINDS[neta.kind] ? neta.kind : 'manzai';
    const sentLines = (neta.lines || []).map((l, i) => ({ ...l, i })).filter((l) => String(l.text || '').trim());
    const by = new Map((ai.lines || []).map((x) => [x.i, x]));
    this.rows = sentLines.map((l) => ({ ...l, r: by.get(l.i) || null }));
  }
  updateBody(inp) {
    if (inp.pressed('menu') || inp.pressed('b')) { sfx('cancel'); this.close(); return; }
    if (inp.repeat('left')) { this.tab = (this.tab + TABS_R.length - 1) % TABS_R.length; sfx('cursor'); return; }
    if (inp.repeat('right')) { this.tab = (this.tab + 1) % TABS_R.length; sfx('cursor'); return; }
    // [R11-J] 審査員 tab: ↑↓ choose a judge, A = 内訳 / この審査員にたずねる / 審査員名鑑
    if (this.tab === 1 && (this.ai.judges || []).length) {
      const n = this.ai.judges.length;
      if (inp.repeat('up') && this.jsel > 0) { this.jsel--; sfx('cursor'); this.scrollToJudge(); }
      else if (inp.repeat('down') && this.jsel < n - 1) { this.jsel++; sfx('cursor'); this.scrollToJudge(); }
      else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.judgeMenu()); }
      return;
    }
    if (this.tab === 2) {
      if (inp.repeat('up') && this.lsel > 0) { this.lsel--; sfx('cursor'); }
      if (inp.repeat('down') && this.lsel < this.rows.length - 1) { this.lsel++; sfx('cursor'); }
    } else {
      if (inp.repeat('up')) this.scroll[this.tab] = Math.max(0, this.scroll[this.tab] - 16);
      if (inp.repeat('down')) this.scroll[this.tab] = Math.min(this.maxScroll || 0, this.scroll[this.tab] + 16);
    }
    if (inp.pressed('a')) { if (this.tab < TABS_R.length - 1) { this.tab++; sfx('cursor'); } else { sfx('ok'); this.close(); } }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, CLOSE)) { sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < (this.tabRects || []).length; i++) if (inR(tap.x, tap.y, this.tabRects[i])) { this.tab = i; sfx('cursor'); return true; }
    if (this.tab === 1) { // [R11-J] tap a judge card: first tap selects, second opens the menu
      for (let i = 0; i < this.cardPos.length; i++) { const r = this.cardPos[i]; if (r && inR(tap.x, tap.y, r)) { if (i === this.jsel) { sfx('ok'); this.act(() => this.judgeMenu()); } else { this.jsel = i; sfx('cursor'); } return true; } }
    }
    if (this.tab === 2 && this.listRect && inR(tap.x, tap.y, this.listRect)) { const j = (this.ltop || 0) + Math.floor((tap.y - this.listRect.y) / 18); if (j >= 0 && j < this.rows.length) { this.lsel = j; sfx('cursor'); } return true; }
    if (this.tab !== 2 && tap.y > 40) { const half = tap.y > 200; this.scroll[this.tab] = clamp(this.scroll[this.tab] + (half ? 48 : -48), 0, this.maxScroll || 0); }
    return true;
  }
  // touch: the tabs are the 70-unit bar (as the 芸人手帳)
  get touchY0() { return 40; }
  touchBarTap(tap) { const i = (this.touchTabs || []).findIndex((r) => inR(tap.x, tap.y, r)); if (i >= 0 && i !== this.tab) { this.tab = i; sfx('cursor'); } }
  drawTouchBar(c) {
    this.touchTabs = [];
    const tw = (SW - TB) / TABS_R.length;
    TABS_R.forEach((lb, i) => {
      const x = Math.round(i * tw), w = Math.round((i + 1) * tw) - x, on = i === this.tab;
      R(c, x + 1, 0, w - 2, TB - 2, on ? K.gold : '#1a1222');
      T(c, lb, x + w / 2, TB / 2 - 8, 14, on ? K.ink : K.text, 'center', w - 8);
      this.touchTabs.push({ x, y: 0, w, h: TB });
    });
  }
  drawScreen(c) {
    const ai = this.ai;
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, 'AI審査員の採点', 8, 3, 12, K.gold);
    T(c, `『${this.n.title || '無題'}』${KIND_LABEL[this.kind]}`, 112, 4, 10, K.text, 'left', 300);
    const badge = ai.by === 'claude' ? 'Claude（APIキー使用）' : 'ローカルAI';
    const bw = measure(c, badge, 10) + 12;
    R(c, SW - 32 - bw, 3, bw, 14, ai.by === 'claude' ? '#c06a3a' : '#3a5a8a');
    T(c, badge, SW - 32 - bw / 2, 4, 10, '#ffffff', 'center');
    drawClose(c);
    this.tabRects = [];
    const tw = Math.floor(SW / TABS_R.length);
    TABS_R.forEach((lb, i) => { const x = i * tw, on = i === this.tab; R(c, x + 1, 21, tw - 2, 18, on ? K.gold : '#1a1222'); T(c, lb, x + tw / 2, 24, 12, on ? K.ink : K.text, 'center', tw - 8); this.tabRects.push({ x, y: 20, w: tw, h: 20 }); });
    c.save(); c.beginPath(); c.rect(0, 40, SW, 300); c.clip();
    if (this.tab === 0) this.drawSummary(c);
    else if (this.tab === 1) this.drawJudges(c);
    else if (this.tab === 2) this.drawLines(c);
    else this.drawAdvice(c);
    c.restore();
    R(c, 0, 340, SW, 20, '#0c0812');
    T(c, '←→ タブ　↑↓ ' + (this.tab === 2 ? '行をえらぶ' : this.tab === 1 ? '審査員をえらぶ' : 'スクロール') + (this.tab === 1 ? '　A 内訳・たずねる・名鑑' : '　A 次へ') + '　B 閉じる', SW - 8, 345, 10, K.faint, 'right', 400);
    if (ai.notice) T(c, ai.notice, 8, 345, 10, K.warn, 'left', 330);
  }
  drawSummary(c) {
    const ai = this.ai;
    const axes = AXES_BY_KIND[this.kind].filter((a) => a in (ai.axes || {}));
    // radar
    const cx = 146, cy = 192, r = 88;
    const n = axes.length;
    const pt = (i, v) => { const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(ang) * r * v, cy + Math.sin(ang) * r * v]; };
    c.save();
    c.lineWidth = 1;
    for (const ring of [0.25, 0.5, 0.75, 1]) { c.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, ring); if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.strokeStyle = ring === 1 ? K.edgeHi : K.edge; c.stroke(); }
    for (let i = 0; i < n; i++) { const [x, y] = pt(i, 1); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.strokeStyle = K.edge; c.stroke(); }
    c.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = pt(i % n, clamp(num(ai.axes[axes[i % n]]) / 100, 0.02, 1)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.fillStyle = 'rgba(255,207,74,0.30)'; c.fill(); c.strokeStyle = K.gold; c.lineWidth = 2; c.stroke();
    c.restore();
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, 1.2);
      const v = num(ai.axes[axes[i]]);
      const lb = AXES[axes[i]];
      const al = Math.abs(x - cx) < 10 ? 'center' : x < cx ? 'right' : 'left';
      T(c, lb, x, y - 9, 10, K.text, al, 76);
      T(c, String(v), x, y + 2, 10, scoreCol(v), al);
    }
    // total and judges
    const X = 318;
    T(c, '総合', X, 48, 12, K.dim);
    T(c, `${ai.total}`, X + 40, 44, 40, scoreCol(ai.total));
    T(c, '点', X + 44 + measure(c, String(ai.total), 40), 66, 12, K.dim);
    T(c, ai.rank || rankLabel(ai.total), X + 140, 52, 12, K.gold, 'left', SW - X - 150);
    para(c, ai.summary || (ai.comments || [])[0] || '', X + 140, 70, SW - X - 150, 10, K.dim, 13, 2);
    let y = 100;
    T(c, `審査員5人（${JUDGES.length * 100}点満点：${(ai.judges || []).reduce((s, j) => s + num(j.score), 0)}点）`, X, y, 10, K.gold, 'left', SW - X - 8);
    y += 15;
    for (const j of ai.judges || []) {
      T(c, j.name, X, y, 12, K.text, 'left', 124);
      T(c, j.taste || '', X + 128, y + 1, 10, K.dim, 'left', 54);
      R(c, X + 186, y + 3, 100, 8, '#2a2236'); R(c, X + 186, y + 3, Math.round(num(j.score)), 8, scoreCol(num(j.score)));
      T(c, String(j.score), SW - 10, y, 12, scoreCol(num(j.score)), 'right');
      y += 18;
    }
    y += 6;
    T(c, 'ひとこと', X, y, 10, K.gold);
    y += 14;
    const adv = (ai.advice || [])[0] || '';
    para(c, adv, X, y, SW - X - 10, 12, K.text, 15, 4);
    const best = (ai.best || [])[0];
    if (best != null && this.n.lines[best]) { y += 66; T(c, `★ いちばんの行：${best + 1}行目「${short(this.n.lines[best].text, 26)}」`, X, Math.min(y, 322), 10, K.green, 'left', SW - X - 10); }
  }
  // [R11-J] each judge's card shows how the number was made (素点 + the memory adjustments); the 座談 follows when the panel split by 8+
  scrollToJudge() {
    const r = this.cardAbs && this.cardAbs[this.jsel];
    if (!r) return;
    if (r.y - this.scroll[1] < 44) this.scroll[1] = Math.max(0, r.y - 46);
    else if (r.y + r.h - this.scroll[1] > 334) this.scroll[1] = Math.min(this.maxScroll || 0, r.y + r.h - 332);
  }
  // A on a judge: 内訳 (how the number was made) / この審査員にたずねる / 審査員名鑑
  async judgeMenu() {
    const j = (this.ai.judges || [])[this.jsel];
    if (!j) return;
    const k = await this.pick({ title: `${j.name}（${j.score}点）`, items: [{ label: '点数の内訳を見る' }, { label: 'この審査員にたずねる' }, { label: '審査員名鑑を開く' }, { label: 'やめる' }] });
    if (k === 0) {
      const e = JM.explain(j);
      if (!e) { await this.info(`${j.name}の内訳`, ['この採点には内訳の記録がありません（ClaudeまたはAI採点の古い結果です）。']); return; }
      const w = (j.d && j.d.w) || null;
      void w;
      await this.info(`${j.name}の内訳`, [
        `素点（この席の好みのとおり）：${e.base}点`,
        ...e.rows.map((r) => `${r.label}：${r.v > 0 ? '+' : '−'}${Math.abs(r.v)}　${r.why}`),
        `合計：${e.score}点`,
        ...(e.weights ? [`この審査員が重く見る項目：${e.weights.map(([a, wv]) => `${AXES[a] || a}×${wv}`).join('・')}`] : []),
        '※好みの変化・記憶による補正は、合わせて−6〜+5点まで。',
      ]);
    } else if (k === 1) {
      const key = j.k;
      const p = key && has(this.g, 'judgeProfile') ? this.g.judgeProfile(key) : null;
      if (!p) { await this.info(j.name, ['この審査員は、もう審査員席にいない。（席は後任に引き継がれた）']); return; }
      const qs = [['impression', '最近の私のネタをどう思いますか？'], ['taste', 'いま、どんなネタが好きですか？'], ['advice', 'どこを直せばいいですか？']];
      const q = await this.pick({ title: `${j.name}にたずねる`, lines: ['（APIキーを設定していれば、Claudeが審査員の記憶をもとに答えます）'], items: [...qs.map(([, l]) => ({ label: l })), { label: 'やめる' }] });
      if (q < 0 || q >= qs.length) return;
      this.toast('審査員が考えています…', K.dim);
      const r = await this.g.judgeAsk(key, qs[q][0], { profile: p });
      await this.info(`${j.name}（${r.by === 'claude' ? 'Claude' : p.school}）`, [`「${r.text}」`, ...(r.notice ? [`※${r.notice}`] : [])]);
    } else if (k === 2) {
      if (has(this.g, 'openJudgeBook')) await this.g.openJudgeBook({ scope: 'neta', key: j.k });
    }
  }
  breakdownText(j) {
    const e = JM.explain(j);
    if (!e) return null;
    const parts = [`素点${e.base}`];
    for (const r of e.rows) parts.push(`${r.label}${r.v > 0 ? '+' : '−'}${Math.abs(r.v)}`);
    return `${parts.join('　')}　→　${e.score}点`;
  }
  drawJudges(c) {
    const ai = this.ai;
    const off = this.scroll[1];
    let y = 46 - off;
    this.cardPos = []; this.cardAbs = [];
    (ai.judges || []).forEach((j, ji) => {
      const lines = jwrap(c, j.comment || '（コメントなし）', SW - 140, 12);
      const bd = this.breakdownText(j);
      const h = Math.max(54, 24 + lines.length * 15 + (bd ? 17 : 0) + 4);
      const on = ji === this.jsel;
      box(c, 8, y, SW - 16, h - 4, '', on ? { accent: K.gold } : {});
      if (on) { R(c, 8, y, 3, h - 4, K.gold); }
      T(c, j.name, 16, y + 6, 12, K.gold, 'left', 200);
      T(c, `${j.title || ''}・${j.taste || ''}`, 16 + Math.min(200, measure(c, j.name, 12)) + 8, y + 7, 10, K.dim, 'left', 220);
      T(c, String(j.score), SW - 20, y + 10, 24, scoreCol(num(j.score)), 'right');
      lines.forEach((l, k) => T(c, l, 16, y + 24 + k * 15, 12, K.text));
      if (bd) T(c, bd, 16, y + 25 + lines.length * 15, 10, on ? K.cyan : K.faint, 'left', SW - 120);
      this.cardPos[ji] = { x: 8, y, w: SW - 16, h: h - 4 };
      this.cardAbs[ji] = { y: y + off, h };
      y += h;
    });
    const talk = JM.netaTalk(ai, AXES);
    if (talk) {
      const x0 = 8, w = SW - 16;
      const ls = talk.lines.map((l) => jwrap(c, `${l.name}「${l.text}」`, w - 24, 11));
      const hh = 22 + ls.reduce((a, l) => a + l.length * 14, 0);
      box(c, x0, y, w, hh - 4, `審査員コメント座談（点が${talk.spread}点割れた）`, { accent: K.cyan });
      let yy = y + 20;
      ls.forEach((l) => { l.forEach((t, k) => { T(c, t, x0 + 12 + (k ? 8 : 0), yy, 11, K.text); yy += 14; }); });
      y += hh;
    }
    this.maxScroll = Math.max(0, y + off - 330);
  }
  drawLines(c) {
    const ai = this.ai;
    const L = { x: 6, y: 44, w: SW - 12, h: 236 };
    this.listRect = L;
    const vis = Math.floor(L.h / 18);
    if (this.lsel < (this.ltop || 0)) this.ltop = this.lsel;
    if (this.lsel >= (this.ltop || 0) + vis) this.ltop = this.lsel - vis + 1;
    const top = this.ltop || 0;
    const best = new Set(ai.best || []), worst = new Set(ai.worst || []);
    for (let k = 0; k < vis && top + k < this.rows.length; k++) {
      const row = this.rows[top + k];
      const y = L.y + k * 18;
      const sel = top + k === this.lsel;
      R(c, L.x, y, L.w, 17, sel ? K.sel : k % 2 ? '#1a1222' : '#1d1426');
      T(c, String(row.i + 1), L.x + 20, y + 4, 10, K.faint, 'right');
      chip(c, L.x + 24, y + 2, ROLE_SHORT[row.role] || '?', ROLE_COL[row.role] || K.dim, 34);
      const s = row.r ? num(row.r.s) : null;
      R(c, L.x + 62, y + 5, 40, 7, '#2a2236');
      if (s != null) R(c, L.x + 62, y + 5, Math.round(s * 0.4), 7, scoreCol(s));
      const mark = best.has(row.i) ? '★' : worst.has(row.i) ? '▼' : '';
      if (mark) T(c, mark, L.x + 108, y + 3, 10, mark === '★' ? K.green : K.red);
      const tag = row.r && row.r.tag ? row.r.tag : '';
      const tw2 = tag ? Math.min(120, measure(c, tag, 10) + 8) : 0;
      T(c, row.text, L.x + 122, y + 3, 12, K.text, 'left', L.w - 128 - tw2);
      if (tag) T(c, tag, L.x + L.w - 6, y + 4, 10, best.has(row.i) ? K.green : worst.has(row.i) ? K.red : K.dim, 'right', 120);
    }
    const cur = this.rows[this.lsel];
    box(c, 6, 284, SW - 12, 52, cur ? `${cur.i + 1}行目${cur.r ? `　${cur.r.s}点${cur.r.tag ? '・' + cur.r.tag : ''}` : ''}` : '');
    if (cur) para(c, cur.text, 14, 302, SW - 28, 12, K.text, 15, 2);
  }
  drawAdvice(c) {
    const ai = this.ai;
    const off = this.scroll[3];
    let y = 46 - off;
    T(c, '改善のアドバイス', 12, y, 12, K.gold);
    y += 18;
    (ai.advice || []).forEach((a, i) => { T(c, `${i + 1}.`, 14, y, 12, K.gold); y += para(c, a, 34, y, SW - 50, 12, K.text, 16) + 4; });
    y += 8;
    T(c, '項目ごとの評価', 12, y, 12, K.gold);
    y += 18;
    for (const a of AXES_BY_KIND[this.kind]) {
      if (!(a in (ai.axes || {}))) continue;
      const v = num(ai.axes[a]);
      T(c, AXES[a], 14, y, 12, K.text, 'left', 110);
      R(c, 130, y + 4, 100, 8, '#2a2236'); R(c, 130, y + 4, v, 8, scoreCol(v));
      T(c, String(v), 254, y, 12, scoreCol(v), 'right');
      T(c, (ai.reasons || {})[a] || '', 264, y + 1, 10, K.dim, 'left', SW - 276);
      y += 17;
    }
    const st = ai.stats || {};
    if (st.sec != null) { y += 6; T(c, `推定の尺 ${mmss(st.sec)}／目安 ${mmss(st.target || this.n.target)}・ボケ ${st.punches ?? '-'}個・1分あたり ${st.perMin ?? '-'}個`, 14, y, 10, K.dim, 'left', SW - 28); y += 14; }
    if (ai.by === 'local') { T(c, '※ローカルAIは辞書と規則で読む採点。言葉遊び・韻はかなで書かれたところだけ見える。', 14, y, 10, K.faint, 'left', SW - 28); y += 14; }
    this.maxScroll = Math.max(0, y + off - 330);
  }
}

// ================================================================ the chooser (g.pickNeta)
export class PickerScene extends Base {
  constructor(g, opts, resolve) {
    super(g, resolve);
    this.opts = opts;
    this.kind = opts.kind || 'manzai';
    this.idx = 0; this.top = 0;
    this.reload();
    // start on the best fitting script
    let best = -1, bq = -1;
    this.items.forEach((it, i) => { if (it.neta) { const q = num(safe(() => g.netaQuality(it.neta, { contest: opts.forContest }), 0)); if (q > bq) { bq = q; best = i; } } });
    if (best >= 0) this.idx = best;
  }
  reload() {
    const g = this.g;
    const list = g.netaList(this.kind);
    this.items = [...list.map((x) => ({ neta: x })), { id: 'new', label: '＋ 新しく書く' }, { id: 'auto', label: 'おまかせ（その場で組む）' }, { id: 'cancel', label: 'やめる' }];
  }
  updateBody(inp) {
    const n = this.items.length;
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.choose(this.idx)); }
    else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); this.close(null); }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, CLOSE)) { sfx('cancel'); this.close(null); return true; }
    if (this.listRect && inR(tap.x, tap.y, this.listRect)) { const j = this.top + Math.floor((tap.y - this.listRect.y) / 32); if (j >= 0 && j < this.items.length) { if (j === this.idx) { sfx('ok'); this.act(() => this.choose(j)); } else { this.idx = j; sfx('cursor'); } } }
    return true;
  }
  async choose(i) {
    const it = this.items[i];
    const g = this.g, o = this.opts;
    if (!it || it.id === 'cancel') { this.close(null); return; }
    if (it.id === 'new') {
      const x = await g.writeNeta({ kind: this.kind === 'any' || this.kind === 'double' ? 'manzai' : this.kind, length: o.length, title: o.title, forContest: o.forContest });
      this.reload();
      if (x) { const j = this.items.findIndex((y) => y.neta && y.neta.id === x.id); if (j >= 0) this.idx = j; const k = await this.confirm({ title: 'このネタでいく？', lines: [`『${x.title}』`], choices: ['このネタでいく', 'えらびなおす'] }); if (k === 0) this.close(x); }
      return;
    }
    if (it.id === 'auto') {
      const q = Math.round(clamp(20 + num(has(g, 'comedyStat') ? safe(() => g.comedyStat('neta'), 30) : 30) * 0.6, 15, 75));
      const x = g.autoNeta(this.kind === 'any' || this.kind === 'double' ? 'manzai' : this.kind, q, { length: o.length });
      const k = await this.confirm({ title: 'おまかせ', lines: [`その場で組んだネタ『${x.title}』（目安${q}点）でいく。自分で書いた台本のほうが、ふつうは強い。`], choices: ['これでいく', 'やめる'] });
      if (k === 0) this.close(x);
      return;
    }
    const x = it.neta;
    const est = estimate(x, { target: o.length || x.target });
    const target = Number(o.length) || x.target;
    if (o.length && est.sec > target * 1.1) {
      const k = await this.confirm({ title: '尺オーバー', lines: [`『${x.title}』は推定${mmss(est.sec)}。持ち時間${mmss(target)}を${est.sec - target}秒こえる。オーバーは大きく減点される。`], choices: ['それでもいく', 'えらびなおす'], danger: true });
      if (k !== 0) return;
    }
    this.close(x);
  }
  get touchY0() { return 24; }
  onCloseTap() { this.close(null); }
  drawTouchBar(c) {
    const o = this.opts;
    T(c, 'ネタをえらぶ', 12, 8, 16, K.gold);
    T(c, `${o.title ? o.title + '・' : ''}${KIND_LABEL[this.kind] || 'なんでも'}${o.length ? `・持ち時間 ${mmss(o.length)}` : ''}`, 12, 40, 12, K.text, 'left', SW - TB - 24);
  }
  drawScreen(c) {
    const g = this.g, o = this.opts;
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, 'ネタをえらぶ', 8, 3, 12, K.gold);
    T(c, `${o.title ? o.title + '・' : ''}${KIND_LABEL[this.kind] || 'なんでも'}${o.length ? `・持ち時間 ${mmss(o.length)}` : ''}`, 100, 4, 10, K.text, 'left', SW - 140);
    drawClose(c);
    const L = { x: 6, y: 26, w: 378, h: 306 };
    this.listRect = L;
    const vis = Math.floor(L.h / 32);
    if (this.idx < this.top) this.top = this.idx;
    if (this.idx >= this.top + vis) this.top = this.idx - vis + 1;
    for (let k = 0; k < vis && this.top + k < this.items.length; k++) {
      const it = this.items[this.top + k];
      const y = L.y + k * 32;
      const sel = this.top + k === this.idx;
      R(c, L.x, y, L.w, 30, sel ? K.sel : '#1a1222');
      if (sel) R(c, L.x, y, 2, 30, K.gold);
      if (!it.neta) { T(c, it.label, L.x + 12, y + 8, 12, it.id === 'new' ? K.cyan : it.id === 'auto' ? K.gold : K.dim, 'left', L.w - 20); continue; }
      const x = it.neta;
      const q = num(safe(() => g.netaQuality(x, { contest: o.forContest }), 0));
      const est = estimate(x, { target: o.length || x.target });
      const over = (o.length || x.target) && est.sec > (Number(o.length) || x.target) * 1.05;
      T(c, x.title || '無題', L.x + 12, y + 3, 12, K.text, 'left', 230);
      T(c, `${KIND_LABEL[x.kind]}・${mmss(est.sec)}${over ? '（尺オーバー）' : ''}・${x.ai ? `AI ${x.ai.total}点` : '未採点'}・仕上がり${num(x.practice)}`, L.x + 12, y + 17, 10, over ? K.red : K.dim, 'left', 290);
      T(c, `${q}`, L.x + L.w - 10, y + 7, 16, scoreCol(q), 'right');
    }
    // detail
    const it = this.items[this.idx];
    box(c, 390, 26, 244, 306, it && it.neta ? '台本のようす' : '');
    if (it && it.neta) {
      const x = it.neta;
      const f = g.netaFreshness(x, o.forContest);
      let y = 46;
      T(c, x.title || '無題', 398, y, 12, K.gold, 'left', 228); y += 18;
      T(c, `出来（本番の見込み）${num(safe(() => g.netaQuality(x, { contest: o.forContest }), 0))}`, 398, y, 10, K.text, 'left', 228); y += 14;
      T(c, `仕上がり ${num(x.practice)}`, 398, y, 10, K.text); R(c, 480, y + 3, 140, 6, '#2a2236'); R(c, 480, y + 3, Math.round(1.4 * num(x.practice)), 6, K.cyan); y += 14;
      T(c, `鮮度：${f.label}`, 398, y, 10, f.same ? K.red : f.value < 70 ? K.warn : K.green, 'left', 228); y += 16;
      for (const ch of structureCheck(x)) { T(c, `${ch.ok ? '✔' : '・'} ${ch.label}`, 400, y, 10, ch.ok ? K.text : K.faint, 'left', 220); y += 13; }
      y += 4;
      if (x.ai && x.ai.advice && x.ai.advice[0]) { T(c, 'AIのアドバイス', 398, y, 10, K.gold); y += 14; para(c, x.ai.advice[0], 398, y, 228, 10, K.dim, 13, 5); }
    } else if (it) para(c, it.id === 'new' ? 'その場で台本エディタを開いて、新しいネタを書く。書き終えたら、そのネタを選べる。' : it.id === 'auto' ? '部品を組み合わせたネタで出る。手っ取り早いが、独自性は低い。' : '今回はネタを選ばない。', 398, 48, 228, 12, K.dim, 16);
    R(c, 0, 340, SW, 20, '#0c0812');
    T(c, '↑↓ えらぶ　A 決定　B やめる', SW - 8, 345, 10, K.faint, 'right');
  }
}

// ================================================================ the settings (ローカルAI / Claude + API key)
export class SettingsScene extends Base {
  constructor(g, resolve) { super(g, resolve); this.idx = 0; this.rowRects = []; this.toastY = 214; }
  rows() {
    const ks = keyState();
    return [
      { id: 'mode', label: '採点するAI', value: ks.mode === 'claude' ? 'Claude（APIキー使用）' : 'ローカルAI（ふつう）' },
      { id: 'key', label: 'APIキー', value: ks.has ? ks.masked : '未設定（ここで入力）' },
      { id: 'remember', label: 'この端末に保存する', value: ks.remember ? '☑ 保存する' : '☐ 保存しない（ゲームを閉じると消える）', lock: !ks.has },
      { id: 'clear', label: 'キーを削除', value: ks.has ? '削除する' : '—', lock: !ks.has },
      { id: 'close', label: '閉じる', value: '' },
    ];
  }
  updateBody(inp) {
    const n = this.rows().length;
    if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
    else if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.act(() => this.run(this.rows()[this.idx].id)); }
    else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); this.close(); }
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    now.a = false;
    if (inR(tap.x, tap.y, CLOSE)) { sfx('cancel'); this.close(); return true; }
    for (let i = 0; i < this.rowRects.length; i++) if (inR(tap.x, tap.y, this.rowRects[i])) { if (this.idx === i) { sfx('ok'); this.act(() => this.run(this.rows()[i].id)); } else { this.idx = i; sfx('cursor'); } return true; }
    return true;
  }
  async run(id) {
    const ks = keyState();
    if (id === 'mode') {
      if (ks.mode === 'claude') { setMode('local'); this.toast('ローカルAIで採点する', K.green); return; }
      if (!ks.has) { const ok = await this.enterKey(); if (!ok) return; }
      const k = await this.confirm({ title: 'Claudeで採点する', lines: ['台本の文章がAnthropicのAPIに送信され、あなたのAPIキーに課金されます。', `モデル：${CLAUDE.model}。つながらない時はローカルAIで採点します。`], choices: ['Claudeにする', 'やめる'] });
      if (k === 0) { setMode('claude'); this.toast('Claude（APIキー使用）で採点する', K.gold); }
    } else if (id === 'key') await this.enterKey();
    else if (id === 'remember' && ks.has) { const v = setRemember(!ks.remember); this.toast(v ? 'この端末に保存した' : 'この端末から消した（今回だけ使う）', K.cyan); }
    else if (id === 'clear' && ks.has) { const k = await this.confirm({ title: 'キーを削除', lines: ['APIキーをゲームから消す（保存していれば端末からも消える）。'], choices: ['削除する', 'やめる'], danger: true }); if (k === 0) { clearKey(); this.toast('キーを削除した', K.green); } }
    else if (id === 'close') this.close();
  }
  async enterKey() {
    const v = await askText(this.g, { title: 'AnthropicのAPIキー', value: '', max: 200, type: 'password', placeholder: 'sk-ant-…', note: '入力したキーは画面にふせ字でしか出ない。台本を採点するときだけ api.anthropic.com に送る。' });
    if (v == null || !v.trim()) return false;
    const ok = setKey(v, keyState().remember);
    if (!ok) { await this.info('APIキー', ['キーの形が正しくないようだ（空白なし・16文字以上）。']); return false; }
    this.toast('キーを設定した（' + keyState().masked + '）', K.green);
    return true;
  }
  get touchY0() { return 28; }
  get touchTitle() { return 'AI審査員の設定'; }
  drawScreen(c) {
    R(c, 0, 0, SW, SH, K.bg);
    R(c, 0, 0, SW, 20, K.head);
    T(c, 'AI審査員の設定', 8, 3, 12, K.gold);
    drawClose(c);
    box(c, 40, 32, SW - 80, 200, '採点するAI');
    this.rowRects = [];
    this.rows().forEach((r, i) => {
      const y = 52 + i * 34;
      const sel = i === this.idx;
      R(c, 50, y, SW - 100, 30, sel ? K.sel : '#1d1426');
      if (sel) R(c, 50, y, 2, 30, K.gold);
      T(c, r.label, 62, y + 8, 12, r.lock ? K.faint : K.text, 'left', 170);
      T(c, r.value, 236, y + 8, 12, r.lock ? K.faint : r.id === 'mode' && keyState().mode === 'claude' ? K.gold : K.cyan, 'left', SW - 300);
      this.rowRects.push({ x: 50, y, w: SW - 100, h: 30 });
    });
    box(c, 40, 240, SW - 80, 94, '注意');
    para(c, '台本の文章がAnthropicのAPIに送信され、あなたのAPIキーに課金されます。', 50, 260, SW - 100, 12, K.warn, 15, 2);
    para(c, `キーはふせ字でしか表示せず、記録にも残さない。「この端末に保存する」をえらばなければ、ゲームを閉じると消える。モデル：${CLAUDE.model}。失敗したときはローカルAIで採点する（ふだんはローカルAIで十分）。`, 50, 280, SW - 100, 10, K.dim, 13, 4);
    R(c, 0, 340, SW, 20, '#0c0812');
    T(c, '↑↓ えらぶ　A 決定　B 閉じる', SW - 8, 345, 10, K.faint, 'right');
  }
}

// ================================================================ waiting for Claude
class WaitingScene {
  constructor(g, resolve) { Object.assign(this, { g, resolve, hd: true, opaque: false, hidesHud: true, isNetaUI: true, t: 0, closed: false, tapAt: null }); }
  update(g) { this.t++; const tap = this.tapAt; this.tapAt = null; if (this.t > 10 && (g.input.pressed('b') || g.input.pressed('menu') || tap)) { const now = g.input.pressedNow || {}; now.a = false; this.cancel(); } }
  draw(c) {
    R(c, 0, 0, SW, SH, 'rgba(8,4,14,0.78)');
    const w = 360, x = (SW - w) / 2, y = 130;
    box(c, x, y, w, 96, 'AI審査員（Claude）');
    const dots = '・'.repeat(1 + (Math.floor(this.t / 20) % 3));
    T(c, `審査員が台本を読んでいます${dots}`, x + w / 2, y + 30, 12, K.text, 'center', w - 20);
    T(c, `${Math.floor(this.t / 60)}秒`, x + w / 2, y + 50, 10, K.dim, 'center');
    T(c, 'B：やめてローカルAIで採点する', x + w / 2, y + 72, 10, K.faint, 'center');
  }
}
export function openWaiting(g, run) {
  if (g.auto) return run(undefined);
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  return new Promise((resolve) => {
    const sc = new WaitingScene(g, resolve);
    bindTap(g);
    let done = false;
    const finish = (r) => { if (done) return; done = true; if (!sc.closed) { sc.closed = true; g.pop(sc); } resolve(r); };
    sc.cancel = () => { if (ac) ac.abort(); finish({ ok: false, code: 'offline', notice: '採点をやめました' }); };
    g.push(sc);
    Promise.resolve().then(() => run(ac ? ac.signal : undefined)).then(finish, () => finish({ ok: false, code: 'offline', notice: 'Claudeに接続できません' }));
  });
}

// ================================================================ entry points
const allowUI = (g) => !g.auto || g.auto.netaui;
export function openEditor(g, draft, opts = {}) {
  if (!allowUI(g)) return Promise.resolve(null);
  sfx('ok');
  return new Promise((resolve) => { const sc = new EditorScene(g, draft, opts, resolve); g.push(sc); sc.start(); });
}
export function openResult(g, neta, ai) {
  if (!allowUI(g) || !ai) return Promise.resolve(null);
  sfx(ai.total >= 70 ? 'fanfare' : 'ok');
  return new Promise((resolve) => g.push(new ResultScene(g, neta, ai, resolve)));
}
export function openPicker(g, opts = {}) {
  if (!allowUI(g)) return Promise.resolve(null);
  return new Promise((resolve) => g.push(new PickerScene(g, opts, resolve)));
}
export function openSettings(g) {
  if (!allowUI(g)) return Promise.resolve(null);
  return new Promise((resolve) => g.push(new SettingsScene(g, resolve)));
}
if (typeof window !== 'undefined') window.__netaui = { top: () => { const g = window.__game; return g && g.top && g.top.isNetaUI ? g.top : null; }, EditorScene, ResultScene, PickerScene, SettingsScene, partsModal };

// ================================================================ the phone app 「ネタ帳」 (手帳 / ケータイ / スマホ)
const devOf = (g) => { const e = g.state && g.state.profile && g.state.profile.era; return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; };
const APP = { smart: { color: '#c0562a', bg: null, title: 'ネタ帳' }, keitai: { color: '#9a5a3a', bg: null, title: 'ネタ帳（メモ）' }, techo: { color: '#7a5230', bg: '#f6efd8', title: 'ネタ帳（手帳のページ）' } };
async function netaApp(g) {
  const A = APP[devOf(g)];
  let index = 0;
  for (;;) {
    const list = g.netaList();
    const ks = keyState();
    const items = [
      { label: '＋ 新しく書く', sub: '漫才・コント・ピン・落語・大喜利…' },
      { label: 'AI審査員の設定', sub: ks.mode === 'claude' && ks.has ? 'Claude（APIキー使用）' : 'ローカルAI' },
      ...list.map((x) => ({ label: x.title || '無題', sub: `${KIND_LABEL[x.kind]}・${mmss(x.length || 0)}・${x.ai ? `AI ${x.ai.total}点` : '未採点'}・仕上がり${num(x.practice)}`, right: x.ai ? String(x.ai.total) : '' })),
    ];
    const i = await phoneList(g, { title: A.title, color: A.color, bg: A.bg, index, items, describe: (k) => (k >= 2 && list[k - 2] ? `${list[k - 2].theme ? 'テーマ：' + list[k - 2].theme + '　' : ''}${list[k - 2].ai ? list[k - 2].ai.rank || '' : 'まだAI採点していない'}` : k === 0 ? '台本エディタで書く（部品から・自分で）' : 'ローカルAI／Claude（自分のAPIキー）') });
    if (i < 0) return;
    index = i;
    if (i === 0) {
      const kinds = Object.keys(KIND_LABEL);
      const k = await phoneList(g, { title: 'どのネタを書く？', color: A.color, bg: A.bg, items: kinds.map((x) => ({ label: KIND_LABEL[x] })) });
      if (k >= 0) await g.writeNeta({ kind: kinds[k] });
      continue;
    }
    if (i === 1) { await openSettings(g); continue; }
    const x = list[i - 2];
    if (x) await scriptActions(g, x, A);
  }
}
async function scriptActions(g, x, A) {
  for (;;) {
    const acts = [{ id: 'view', label: '台本を見る' }, { id: 'edit', label: '書きなおす（エディタ）' }, { id: 'score', label: 'AI採点する' }, ...(x.ai ? [{ id: 'result', label: '採点結果を見る', sub: `${x.ai.total}点・${x.ai.by === 'claude' ? 'Claude' : 'ローカルAI'}` }] : []), { id: 'practice', label: 'ネタ合わせ（体力 -8）', sub: `仕上がり ${num(x.practice)}` }, { id: 'del', label: '削除する' }];
    const k = await phoneList(g, { title: short(x.title || '無題', 12), color: A.color, bg: A.bg, items: acts });
    if (k < 0) return;
    const id = acts[k].id;
    if (id === 'view') await phoneInfo(g, { title: short(x.title || '無題', 12), color: A.color, lines: [`${KIND_LABEL[x.kind]}　推定${mmss(x.length || 0)}／目安${mmss(x.target)}`, x.theme ? `テーマ：${x.theme}` : null, x.setting ? `設定：${x.setting}` : null, '', ...x.lines.map((l, j) => `${j + 1}.【${(x.chars && x.chars[l.role]) || (x.kind === 'ogiri' && l.role === 'pin' ? '回答' : ROLE_LONG[l.role]) || l.role}】${l.text}`)].filter((s) => s != null) });
    else if (id === 'edit') await g.writeNeta({ id: x.id, kind: x.kind });
    else if (id === 'score') { const ai = await g.scoreNeta(x, { show: true, ui: true }); if (g.auto && ai) await phoneInfo(g, { title: 'AI採点', color: A.color, lines: [`${ai.total}点（${ai.rank}）`, ...(ai.advice || []).slice(0, 3)] }); }
    else if (id === 'result') await g.showNetaResult(x);
    else if (id === 'practice') { const r = await g.netaRehearse(x.id); await phoneInfo(g, { title: 'ネタ合わせ', color: A.color, lines: r && r.ok ? [`ネタ合わせをした。`, `仕上がり ${r.before} → ${r.after}`, `（今日はあと${r.left}回できる）`] : [(r && r.why) || 'できなかった'] }); }
    else if (id === 'del') { const c = await phoneConfirm(g, { title: '削除', color: A.color, text: `『${x.title || '無題'}』をネタ帳から消す？`, choices: ['消す', 'やめる'] }); if (c === 0) { g.deleteNeta(x.id); return; } }
    if (!g.neta(x.id)) return;
  }
}
export function installNetaApp() {
  registerPhoneApp('neta', {
    name: 'ネタ帳', color: '#c0562a', order: 35,
    iconHD(c, x, y, g) {
      const d = g ? devOf(g) : 'smart';
      appTile(c, x, y, d === 'techo' ? '#7a5230' : '#c0562a');
      // a notebook with ruled lines and a red ribbon
      R(c, x + 8, y + 6, 17, 21, '#2a1608'); R(c, x + 9, y + 7, 15, 19, d === 'techo' ? '#f6efd8' : '#ffffff');
      for (let j = 0; j < 4; j++) R(c, x + 11, y + 11 + j * 4, 11, 1, '#9ab0d0');
      R(c, x + 8, y + 6, 3, 21, '#5a3010');
      R(c, x + 19, y + 5, 3, 8, '#e0303a'); R(c, x + 20, y + 13, 1, 1, '#e0303a');
    },
    badge: (g) => { try { return g.netaList().filter((x) => !x.ai && x.lines.length).length ? 1 : 0; } catch (e) { return 0; } },
    open: (g) => netaApp(g),
  });
  installNetaApp.openBook = (g) => withPhone(g, () => netaApp(g));
}

// the year-independent list (generic targets only); lengthPresets(g) adds the contests' own lengths for the game year
export const PRESETS = GENERIC_PRESETS;
