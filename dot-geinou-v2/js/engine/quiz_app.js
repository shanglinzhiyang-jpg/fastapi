// クイズ対策アプリ (owner: R7-D) — practice for the TV quiz shows on the phone, and the 雑学・知識 level.
//
// The app (id 'quiz', order 69): 手帳 eras 「クイズ本」 (a 問題集), ケータイ 「ケータイクイズ」 (icon 「クイズ」),
// スマホ 「クイズ対策」.
//   きょうのドリル   10 mixed questions; the first one of a day adds a bonus and keeps a 連続日数
//   番組別の対策     the quiz programs on the air this game month (クイズ!ヘキサゴン / II, ネプリーグ, 短縮鉄道の夜,
//                    オールスター感謝祭, クイズ$ミリオネア …): 10 questions of the show's genres, or 本番形式
//                    (the HD format minigame 'quizstudio', 体力 -5); plus the formats on their own (ペーパーテスト,
//                    1対1 早押し, 5文字リレー, 2択トロッコ, 略語) in any era
//   ジャンル別       one category (漢字の読み … 芸能) — 10 questions
//   苦手を復習       the questions you got wrong (a right answer takes one off the list), then the weakest genre
//   成績             per category: answered, accuracy, level; 7-day history
// Questions are true in the game year (quiz_bank.js from/to).
//
// 雑学・知識 (state.quiz): every answer (practice ×1, a real show ×0.5) gives xp to its category, with diminishing
// returns within a day (× 1 / (1 + today's xp / 30)). quizLevel 0..10 from the total; category level 0..5.
//   g.quizBonus(show) → { v (0..0.45, added to the minigame bonus), pts (0..10, added to the score), level, k }
//     from the overall level, the show's genres and the show's format practice. The quiz minigames read it:
//     easier (more time, slower rivals) and a better rank → better pay / fame through g.job.
//   g.quizRecord(question, ok, { practice, show }), g.quizLevel(), g.quizState()
// Morning: クイズ!ヘキサゴンII ends in 2011-09 — a regular slot on it ends with its last broadcast.
// API doc: test-output/api_quiz.txt.

import { registerPhoneApp, onMorning, REGULARS } from './life.js';
import { Game } from './game.js';
import { phoneView, phoneConfirm, phoneInfo, closePhoneThen, appTile, rrect, phoneText as T, fitText, PC } from './phone.js';
import { panelView, drawRow, devOf } from './phone_apps.js';
import { audio } from './audio.js';
import { wrap, measure } from './draw.js';
import { clamp, shade } from './util.js';
import * as B from './quiz_bank.js';
import { gameYM, STAGE_LABELS } from './quiz_studio.js';

B.loadTanshuku(); // agent C's 短縮鉄道 word bank when it exists (feature-detected)

// ======================================================================== state
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const READY = new WeakSet();
export function qs(g) {
  const st = g.state;
  if (!isObj(st.quiz)) st.quiz = {};
  const q = st.quiz;
  if (READY.has(q)) return q;
  for (const k of ['xp', 'show', 'stat', 'best', 'day', 'drill', 'total']) if (!isObj(q[k])) q[k] = {};
  for (const k of Object.keys(q.xp)) { q.xp[k] = num(q.xp[k]); if (!B.CATS[k]) delete q.xp[k]; }
  for (const k of Object.keys(q.show)) q.show[k] = num(q.show[k]);
  for (const k of Object.keys(q.stat)) { const s = q.stat[k]; if (!isObj(s) || !B.CATS[k]) { delete q.stat[k]; continue; } s.n = num(s.n); s.ok = Math.min(s.n, num(s.ok)); }
  for (const k of Object.keys(q.best)) q.best[k] = num(q.best[k]);
  q.day.d = num(q.day.d, -1); q.day.xp = num(q.day.xp); q.day.n = num(q.day.n);
  q.drill.day = num(q.drill.day, -1); q.drill.streak = num(q.drill.streak); q.drill.best = num(q.drill.best);
  q.total.n = num(q.total.n); q.total.ok = Math.min(q.total.n, num(q.total.ok));
  q.miss = Array.isArray(q.miss) ? q.miss.filter((id) => typeof id === 'string' && B.BY_ID.has(id)).slice(-60) : [];
  q.hist = Array.isArray(q.hist) ? q.hist.filter((h) => isObj(h)).map((h) => ({ day: num(h.day), n: num(h.n), ok: num(h.ok) })).slice(-14) : [];
  q.runs = num(q.runs);
  READY.add(q);
  return q;
}
const LV_XP = [0, 15, 40, 80, 140, 220, 320, 440, 580, 750, 950];
const CAT_XP = [0, 8, 25, 50, 90, 140];
const lvOf = (xp, tab) => { let l = 0; for (let i = 0; i < tab.length; i++) if (xp >= tab[i]) l = i; return l; };
export function totalXp(g) { const q = qs(g); return Object.values(q.xp).reduce((a, v) => a + num(v), 0); }
export function quizLevel(g) { return lvOf(totalXp(g), LV_XP); }
export function catLevel(g, cat) { return lvOf(num(qs(g).xp[cat]), CAT_XP); }
export function levelTitle(l) { return l >= 9 ? 'クイズ王' : l >= 7 ? 'インテリ' : l >= 5 ? 'クイズ通' : l >= 3 ? '物知り' : l >= 1 ? '物知り見習い' : 'ビギナー'; }
// next level progress 0..1
export function levelFrac(g) {
  const xp = totalXp(g), l = quizLevel(g);
  if (l >= LV_XP.length - 1) return 1;
  return clamp((xp - LV_XP[l]) / (LV_XP[l + 1] - LV_XP[l]), 0, 1);
}
// today's multiplier (diminishing returns within a day)
export function dayMult(g) {
  const q = qs(g);
  if (q.day.d !== g.state.day) return 1;
  return 1 / (1 + q.day.xp / 30);
}
function gainXp(g, cat, base) {
  const q = qs(g);
  if (q.day.d !== g.state.day) { q.day.d = g.state.day; q.day.xp = 0; q.day.n = 0; }
  const v = Math.round(base * dayMult(g) * 100) / 100;
  if (cat && B.CATS[cat]) q.xp[cat] = Math.round((num(q.xp[cat]) + v) * 100) / 100;
  q.day.xp = Math.round((q.day.xp + v) * 100) / 100;
  return v;
}
// one answer
export function recordAnswer(g, src, ok, o = {}) {
  if (!g || !g.state || !src) return 0;
  const q = qs(g);
  const cat = B.CATS[src.cat] ? src.cat : 'joshiki';
  const s = q.stat[cat] || (q.stat[cat] = { n: 0, ok: 0 });
  s.n++; if (ok) s.ok++;
  q.total.n++; if (ok) q.total.ok++;
  const day = g.state.day;
  let h = q.hist[q.hist.length - 1];
  if (!h || h.day !== day) { h = { day, n: 0, ok: 0 }; q.hist.push(h); while (q.hist.length > 14) q.hist.shift(); }
  h.n++; if (ok) h.ok++;
  if (B.BY_ID.has(src.id)) {
    const i = q.miss.indexOf(src.id);
    if (!ok && i < 0) { q.miss.push(src.id); while (q.miss.length > 60) q.miss.shift(); }
    if (ok && i >= 0 && o.review) q.miss.splice(i, 1);
  }
  const before = quizLevel(g);
  const v = gainXp(g, cat, (ok ? 3 : 1) * (o.practice === false ? 0.5 : 1));
  if (o.show && B.SHOWS[o.show]) q.show[o.show] = Math.round((num(q.show[o.show]) + v * 0.5) * 100) / 100;
  q.day.n++;
  const after = quizLevel(g);
  if (after > before) q.lvUp = { from: before, to: after, day };
  return v;
}
const showKey = (x) => (B.SHOWS[x] ? x : B.showOf(x));
// what the knowledge is worth on a show (or a format / null: the overall level only)
export function quizBonus(g, show) {
  if (!g || !g.state) return { v: 0, pts: 0, level: 0, k: 0 };
  const L = quizLevel(g);
  const id = showKey(show);
  let k;
  if (id) {
    const S = B.SHOWS[id];
    const cats = S.cats && S.cats.length ? S.cats : B.CAT_IDS;
    const rel = cats.reduce((a, c) => a + catLevel(g, c), 0) / cats.length / 5;
    const fam = clamp(num(qs(g).show[id]) / 120, 0, 1);
    k = 0.45 * (L / 10) + 0.35 * rel + 0.2 * fam;
  } else k = 0.6 * (L / 10);
  k = clamp(k, 0, 1);
  return { v: Math.round(0.45 * k * 100) / 100, pts: Math.round(10 * k), level: L, k, show: id };
}
Game.prototype.quizBonus = function (show) { return quizBonus(this, show); };
Game.prototype.quizRecord = function (src, ok, o = {}) { return recordAnswer(this, src, ok, o); };
Game.prototype.quizLevel = function () { return this.state ? quizLevel(this) : 0; };
Game.prototype.quizState = function () { return this.state ? qs(this) : null; };

// ======================================================================== the shows of this month
export function showsNow(g) {
  const { y, m } = gameYM(g);
  return Object.keys(B.SHOWS).filter((id) => B.onAir(id, y, m));
}
// the format practice rows (always there; a show's name only while it is on the air)
const FORMATS = [
  { id: 'f_paper', label: 'ペーパーテスト形式', sub: '10問・制限時間つき・順位発表', stages: ['paper'], cats: ['kanji', 'keisan', 'chiri', 'rekishi', 'joshiki', 'kotowaza', 'rika', 'eigo'] },
  { id: 'f_league', label: '1対1 早押しリーグ', sub: '4人と早押しで対決', stages: ['league'], cats: ['joshiki', 'chiri', 'rekishi', 'rika', 'kanji', 'geino'] },
  { id: 'f_five', label: '5文字リレー', sub: '5人で1文字ずつ答えを完成', stages: ['five'], cats: ['katakana'] },
  { id: 'f_trolley', label: '2択トロッコ', sub: '正しいレールを選べ！5問', stages: ['trolley'], cats: ['joshiki', 'kanji'] },
  { id: 'f_tanshuku', label: '略語クイズ', sub: '略語 → 元の言葉', stages: ['tanshuku'], cats: ['katakana'] },
  { id: 'f_hexa6', label: '六角形の心理戦', sub: 'だれが間違えるかを見抜く', stages: ['hexa6'], cats: ['joshiki', 'kanji', 'chiri', 'geino'] },
];

// ======================================================================== the look by device
const DEV = {
  techo: { name: 'クイズ本', title: '問題集「クイズ本」', color: '#a8662a', bg: '#f6f1e2', card: '#fffaf0', ink: '#3a2a1a', dim: '#8a7a5a', acc: '#c0632a', line: '#d8cdb0', good: '#2f8a4a', bad: '#c8303c' },
  keitai: { name: 'クイズ', title: 'ケータイクイズ', color: '#2f6fd0', bg: '#eef4ff', card: '#ffffff', ink: '#1a2a4a', dim: '#6a7a9a', acc: '#e07a1f', line: '#c8d6f0', good: '#2f9a4a', bad: '#d6304a' },
  smart: { name: 'クイズ対策', title: 'クイズ対策', color: '#7a3ad8', bg: '#151a30', card: '#20284a', ink: '#f0f4ff', dim: '#9aa6d0', acc: '#ffb020', line: '#2e3a66', good: '#5ee07a', bad: '#ff5d6c' },
};
const look = (g) => DEV[devOf(g)] || DEV.smart;
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function iconQuiz(c, x, y, g) {
  const L = look(g);
  appTile(c, x, y, L.color);
  rrect(c, x + 6, y + 5, 20, 22, 4, '#ffffff');
  rrect(c, x + 7, y + 6, 18, 20, 3, devOf(g) === 'techo' ? '#fff3d8' : '#f2ecff');
  // a big ?
  const Q = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'];
  Q.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') R(c, x + 10 + i * 2, y + 8 + j * 2, 2, 2, L.color); });
}

// ======================================================================== the in-phone drill
// items: questions from quiz_bank (or generated); o: { title, mode: 'daily'|'cat'|'review'|'show', show }
function drillView(g, items, o) {
  const L = look(g);
  const rng = Math.random;
  const list = items.map((x) => B.asChoices(x, rng));
  return {
    title: o.title, color: L.color, bg: L.bg, cancel: null, i: 0, sel: 0, picked: -1, ok: 0, xp: 0, done: false, t: 0, rows: null,
    hint() { return this.done ? 'A:おわる' : this.picked >= 0 ? 'A:つぎへ　B:やめる' : '↑↓:えらぶ　A:こたえる　B:やめる'; },
    headerRight() { return this.done ? '' : `${this.i + 1}/${list.length}`; },
    enter() { this.lvBefore = quizLevel(g); },
    answer(ph) {
      const it = list[this.i];
      this.picked = this.sel;
      const good = this.picked === it.answer;
      if (good) this.ok++;
      this.xp += recordAnswer(g, it.src, good, { practice: true, review: o.mode === 'review', show: o.show });
      audio.sfx(good ? 'good' : 'buzz');
    },
    next(ph) {
      this.i++; this.picked = -1; this.sel = 0;
      if (this.i >= list.length) this.finish(ph);
    },
    finish(ph) {
      this.done = true;
      this.i = list.length - 1;
      const q = qs(g);
      if (o.mode === 'daily' && q.drill.day !== g.state.day) {
        q.drill.streak = q.drill.day === g.state.day - 1 ? q.drill.streak + 1 : 1;
        q.drill.best = Math.max(q.drill.best, q.drill.streak);
        q.drill.day = g.state.day;
        // the daily bonus goes to the weakest category
        const weak = B.CAT_IDS.slice().sort((a, b) => num(q.xp[a]) - num(q.xp[b]))[0];
        this.xp += gainXp(g, weak, 6);
        this.daily = true;
      }
      q.runs++;
      this.lvAfter = quizLevel(g);
      audio.sfx(this.ok >= list.length * 0.7 ? 'fanfare' : 'ok');
    },
    update(ph, inp) {
      this.t++;
      if (this.done) { if (inp.pressed('a') || inp.pressed('b')) { audio.sfx('ok'); ph.back(this.ok); } return; }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); return; }
      if (this.picked >= 0) { if (inp.pressed('a')) { audio.sfx('cursor'); this.next(ph); } return; }
      if (inp.repeat('up')) { this.sel = (this.sel + 3) % 4; audio.sfx('cursor'); }
      if (inp.repeat('down')) { this.sel = (this.sel + 1) % 4; audio.sfx('cursor'); }
      if (inp.pressed('a')) this.answer(ph);
    },
    tap(ph, x, y) {
      if (this.done || this.picked >= 0) return true; // A: next / close
      const rows = this.rows || [];
      const i = rows.findIndex((r) => y >= r.y && y < r.y + r.h && x >= r.x && x < r.x + r.w);
      if (i < 0) return false;
      this.sel = i;
      return true;
    },
    draw(c, ph, a) {
      const x = a.x + 8, w = a.w - 16;
      if (this.done) { this.drawEnd(c, a); return; }
      const it = list[this.i];
      const cat = B.CATS[it.src.cat];
      // the category chip
      const chip = cat ? cat.short : 'クイズ';
      const cw = measure(c, chip, 12) + 10;
      rrect(c, x, a.y + 6, cw, 16, 4, cat ? cat.color : L.acc);
      T(c, chip, x + cw / 2, a.y + 8, 12, '#ffffff', 'center');
      T(c, fitText(c, `Lv.${quizLevel(g)} ${levelTitle(quizLevel(g))}`, w - cw - 8, 12), x + w, a.y + 8, 12, L.dim, 'right');
      // the question
      const lines = wrap(c, it.q, w, 12).slice(0, 5);
      lines.forEach((l, k) => T(c, l, x, a.y + 30 + k * 15, 12, L.ink));
      // the choices
      const rh = 30, y0 = a.y + a.h - rh * 4 - 22;
      this.rows = [];
      it.choices.forEach((ch, k) => {
        const y = y0 + k * rh;
        const r = { x: a.x + 6, y, w: a.w - 12, h: rh - 4 };
        this.rows.push(r);
        let bg = L.card, edge = L.line, ink = L.ink;
        if (this.picked < 0 && k === this.sel) { bg = shade(L.acc, devOf(g) === 'smart' ? -0.35 : 0.75); edge = L.acc; }
        if (this.picked >= 0) {
          if (k === it.answer) { bg = shade(L.good, devOf(g) === 'smart' ? -0.4 : 0.7); edge = L.good; }
          else if (k === this.picked) { bg = shade(L.bad, devOf(g) === 'smart' ? -0.4 : 0.7); edge = L.bad; }
        }
        rrect(c, r.x, r.y, r.w, r.h, 5, edge);
        rrect(c, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 4, bg);
        T(c, ['ア', 'イ', 'ウ', 'エ'][k], r.x + 12, r.y + 6, 12, L.acc, 'center');
        T(c, fitText(c, String(ch), r.w - 32, 12), r.x + 24, r.y + 6, 12, ink);
        if (this.picked >= 0 && k === it.answer) T(c, '○', r.x + r.w - 8, r.y + 6, 12, L.good, 'right');
        else if (this.picked >= 0 && k === this.picked) T(c, '×', r.x + r.w - 8, r.y + 6, 12, L.bad, 'right');
      });
      if (this.picked >= 0) {
        const good = this.picked === it.answer;
        T(c, fitText(c, good ? 'せいかい！' : `ざんねん…正解は「${it.choices[it.answer]}」`, w, 12), x, a.y + a.h - 18, 12, good ? L.good : L.bad);
      } else T(c, fitText(c, `正解 ${this.ok}　きょうの伸び ×${dayMult(g).toFixed(2)}`, w, 12), x, a.y + a.h - 18, 12, L.dim);
    },
    drawEnd(c, a) {
      const x = a.x + 10, w = a.w - 20;
      let y = a.y + 14;
      T(c, 'おつかれさま！', a.x + a.w / 2, y, 14, L.acc, 'center'); y += 26;
      T(c, `${list.length}問中 ${this.ok}問正解`, a.x + a.w / 2, y, 14, L.ink, 'center'); y += 26;
      T(c, fitText(c, `雑学の経験値 +${Math.round(this.xp * 10) / 10}`, w, 12), x, y, 12, L.ink); y += 18;
      if (this.daily) { T(c, fitText(c, `きょうのドリル達成！ 連続${qs(g).drill.streak}日`, w, 12), x, y, 12, L.good); y += 18; }
      if (this.lvAfter > this.lvBefore) { T(c, fitText(c, `レベルアップ！ Lv.${this.lvAfter}「${levelTitle(this.lvAfter)}」`, w, 12), x, y, 12, L.acc); y += 18; }
      const m = dayMult(g);
      y += 6;
      const tip = m < 0.5 ? '今日はもう頭がいっぱい。続きは明日のほうが身につく。' : 'くり返すほど、本番の問題に強くなる。';
      wrap(c, tip, w, 12).slice(0, 2).forEach((l) => { T(c, l, x, y, 12, L.dim); y += 15; });
      y += 6;
      const bq = quizBonus(g, o.show);
      if (o.show && B.SHOWS[o.show]) wrap(c, `『${B.SHOWS[o.show].title}』本番での助け：やさしさ +${Math.round(bq.v * 100)}%・得点 +${bq.pts}`, w, 12).slice(0, 2).forEach((l) => { T(c, l, x, y, 12, L.ink); y += 15; });
    },
  };
}
export function runDrill(g, items, o) {
  if (!items.length) return phoneInfo(g, { title: o.title, color: look(g).color, text: 'いまの年に出せる問題がありません。' });
  return phoneView(g, drillView(g, items, o));
}
const yearOf = (g) => gameYM(g).y;
function lvTarget(g) { const l = quizLevel(g); return l >= 7 ? 3 : l >= 3 ? 2 : 1; }
export function dailyItems(g, n = 10) { return B.pick({ n, year: yearOf(g), lv: lvTarget(g) }); }
export function reviewItems(g, n = 10) {
  const q = qs(g);
  const weak = B.CAT_IDS.slice().sort((a, b) => acc(g, a) - acc(g, b) || num(q.xp[a]) - num(q.xp[b])).slice(0, 2);
  const prefer = q.miss.slice().reverse();
  const out = B.pick({ cats: B.CAT_IDS, n: Math.min(n, prefer.length), year: yearOf(g), prefer }).filter((x) => q.miss.includes(x.id));
  if (out.length < n) out.push(...B.pick({ cats: weak, n: n - out.length, year: yearOf(g), lv: lvTarget(g), avoid: new Set(out.map((x) => x.id)) }));
  return out.slice(0, n);
}
function acc(g, cat) { const s = qs(g).stat[cat]; return s && s.n ? s.ok / s.n : 0.5; }

// ======================================================================== 本番形式 (the HD format minigame)
async function practiceFormat(g, o) {
  const st = g.state;
  if (st.stamina < 5) return phoneInfo(g, { title: '本番形式で練習', color: look(g).color, text: '体力が足りない…。\n休んでからにしよう。（体力 5 必要）' });
  const ok = await phoneConfirm(g, { title: o.label, color: look(g).color, text: `${o.label}を本番形式で練習する？\n（体力 -5・お金はかからない）`, choices: ['練習する', 'やめておく'] });
  if (ok !== 0) return null;
  return closePhoneThen(g, async (gg) => {
    gg.state.stamina = Math.max(0, gg.state.stamina - 5);
    const before = quizLevel(gg);
    const res = await gg.minigame('quizstudio', { showId: o.show || null, show: o.show ? B.SHOWS[o.show].title : o.label, stages: o.stages, cats: o.cats, practice: true, difficulty: clamp(2 + Math.floor(quizLevel(gg) / 3), 1, 5), title: `${o.label}（練習）` });
    const q = qs(gg);
    const key = o.show || o.id;
    if (res && Number.isFinite(res.score)) q.best[key] = Math.max(num(q.best[key]), res.score);
    // finishing a run teaches the format itself (diminishing within a day)
    if (o.show && B.SHOWS[o.show]) q.show[o.show] = Math.round((num(q.show[o.show]) + 12 * dayMult(gg)) * 100) / 100;
    gainXp(gg, (o.cats || [])[0], 2);
    q.runs++;
    const after = quizLevel(gg);
    const lines = [`練習おわり！ スコア ${res ? res.score : 0}点（自己ベスト ${num(q.best[key])}点）`];
    if (after > before) lines.push(`雑学レベルが上がった！ Lv.${after}「${levelTitle(after)}」`);
    if (o.show) { const bq = quizBonus(gg, o.show); lines.push(`本番での助け：やさしさ +${Math.round(bq.v * 100)}%・得点 +${bq.pts}`); }
    await gg.say(lines.join('\n'));
    return res;
  });
}

// ======================================================================== screens
function topPanel(c, a, g) {
  const L = look(g);
  const l = quizLevel(g);
  const dark = devOf(g) === 'smart';
  R(c, a.x, a.y, a.w, a.h, dark ? '#20284a' : shade(L.color, 0.85));
  T(c, fitText(c, `雑学 Lv.${l}「${levelTitle(l)}」`, a.w - 16, 14), a.x + 8, a.y + 5, 14, dark ? '#ffffff' : shade(L.color, -0.5));
  const bw = a.w - 16;
  R(c, a.x + 8, a.y + 24, bw, 6, dark ? '#0e1430' : '#ffffff');
  R(c, a.x + 8, a.y + 24, Math.round(bw * levelFrac(g)), 6, L.acc);
  const q = qs(g);
  const rate = q.total.n ? Math.round((q.total.ok / q.total.n) * 100) : 0;
  const m = dayMult(g);
  T(c, fitText(c, `正答率${rate}%・連続${q.drill.day >= g.state.day - 1 ? q.drill.streak : 0}日・きょうの伸び×${m.toFixed(2)}`, a.w - 16, 12), a.x + 8, a.y + 34, 12, dark ? '#c8d0ff' : PC.dim);
}
export async function quizApp(g) {
  const L = look(g);
  qs(g);
  const view = panelView(g, {
    title: L.title, color: L.color, rowH: 38, top: 52,
    drawTop: (c, a) => topPanel(c, a, g),
    items: () => {
      const q = qs(g);
      const done = q.drill.day === g.state.day;
      const shows = showsNow(g);
      return [
        { id: 'daily', label: 'きょうのドリル', sub: done ? 'きょうは達成済み（もう一度もOK）' : '10問・まずはここから', right: done ? '済' : 'NEW', rightColor: done ? PC.dim : PC.bad, chip: ['毎日', '#d6463a'] },
        { id: 'shows', label: '番組別の対策', sub: shows.length ? shows.map((id) => B.SHOWS[id].short).join('・') : '形式ごとの練習', chip: ['番組', '#7a3ad8'] },
        { id: 'cats', label: 'ジャンル別', sub: '漢字・ことわざ・地理・歴史 …', chip: ['分野', '#2f8a5e'] },
        { id: 'review', label: '苦手を復習', sub: q.miss.length ? `まちがえた問題 ${q.miss.length}問` : '苦手なジャンルを中心に', chip: ['復習', '#c0632a'] },
        { id: 'stats', label: devOf(g) === 'techo' ? '成績表' : '成績', sub: `解いた問題 ${q.total.n}問`, chip: ['成績', '#3a6ab0'] },
        { id: 'help', label: 'つかいかた', sub: '練習と本番のしくみ', chip: ['？', '#6a7080'] },
      ];
    },
    pick: (ph, row) => ph.run(view, async () => {
      if (row.id === 'daily') await runDrill(g, dailyItems(g), { title: 'きょうのドリル', mode: 'daily' });
      else if (row.id === 'shows') await showsScreen(g);
      else if (row.id === 'cats') await catsScreen(g);
      else if (row.id === 'review') await runDrill(g, reviewItems(g), { title: '苦手を復習', mode: 'review' });
      else if (row.id === 'stats') await statsScreen(g);
      else if (row.id === 'help') await helpScreen(g);
    }),
  });
  return phoneView(g, view);
}
async function showsScreen(g) {
  const L = look(g);
  const { y, m } = gameYM(g);
  const rows = () => {
    const out = showsNow(g).map((id) => {
      const S = B.SHOWS[id];
      const st = (B.showStages(id, y, m) || []).map((s) => STAGE_LABELS[s] || (s === 'classic' ? '4択クイズ' : s)).join('・');
      const bq = quizBonus(g, id);
      return { kind: 'show', id, label: S.parent ? `${S.title}（${S.parent}）` : S.title, sub: st, right: `+${bq.pts}点`, rightColor: PC.good };
    });
    for (const f of FORMATS) out.push({ kind: 'format', ...f, right: num(qs(g).best[f.id]) ? `${num(qs(g).best[f.id])}点` : '' });
    return out;
  };
  const view = panelView(g, {
    title: '番組別の対策', color: L.color, rowH: 38, hint: 'A:えらぶ　B:もどる',
    items: rows,
    pick: (ph, row) => ph.run(view, async () => {
      if (row.kind === 'show') {
        const S = B.SHOWS[row.id];
        const stages = B.showStages(row.id, y, m);
        const classic = stages.includes('classic');
        const k = await phoneConfirm(g, { title: S.title, color: L.color, text: `『${S.title}』の対策。\n出やすいジャンル：${S.cats.map((c) => B.CATS[c].short).join('・')}`, choices: ['問題を解く（10問）', classic ? '本番形式で練習（4択）' : '本番形式で練習', 'もどる'] });
        if (k === 0) await runDrill(g, B.pick({ cats: S.cats, n: 10, year: yearOf(g), lv: lvTarget(g) }), { title: `${S.short}対策`, mode: 'show', show: row.id });
        else if (k === 1) {
          if (classic) await practiceClassic(g, row.id);
          else await practiceFormat(g, { show: row.id, label: S.title, stages, cats: S.cats });
        }
        return;
      }
      await practiceFormat(g, { id: row.id, label: row.label, stages: row.stages, cats: row.cats });
    }),
  });
  return phoneView(g, view);
}
// オールスター感謝祭 / ミリオネア: the 4択 quiz minigame as played on the show
async function practiceClassic(g, id) {
  const S = B.SHOWS[id];
  if (g.state.stamina < 5) return phoneInfo(g, { title: S.title, color: look(g).color, text: '体力が足りない…。（体力 5 必要）' });
  return closePhoneThen(g, async (gg) => {
    gg.state.stamina = Math.max(0, gg.state.stamina - 5);
    const res = await gg.minigame('quiz', { show: S.title, category: S.cats, count: 8, difficulty: 3, practice: true, title: `${S.title}（練習）` });
    const q = qs(gg);
    q.show[id] = Math.round((num(q.show[id]) + 12 * dayMult(gg)) * 100) / 100;
    if (res && Number.isFinite(res.score)) q.best[id] = Math.max(num(q.best[id]), res.score);
    await gg.say(`練習おわり！ スコア ${res ? res.score : 0}点`);
    return res;
  });
}
async function catsScreen(g) {
  const L = look(g);
  const counts = B.countByCat(yearOf(g));
  const view = panelView(g, {
    title: 'ジャンル別', color: L.color, rowH: 38,
    items: () => B.CAT_IDS.map((c) => {
      const s = qs(g).stat[c] || { n: 0, ok: 0 };
      return { id: c, label: B.CATS[c].label, sub: `Lv.${catLevel(g, c)}・正答率${s.n ? Math.round((s.ok / s.n) * 100) : 0}%（${s.n}問）`, right: `${counts[c]}問`, chip: [B.CATS[c].short, B.CATS[c].color] };
    }),
    pick: (ph, row) => ph.run(view, async () => { await runDrill(g, B.pick({ cats: [row.id], n: 10, year: yearOf(g), lv: lvTarget(g) }), { title: B.CATS[row.id].label, mode: 'cat' }); }),
  });
  return phoneView(g, view);
}
function statsScreen(g) {
  const L = look(g);
  return phoneView(g, {
    title: devOf(g) === 'techo' ? '成績表' : '成績', color: L.color, bg: L.bg, cancel: true, hint: 'A/B:もどる',
    update(ph, inp) { if (inp.pressed('a') || inp.pressed('b')) { audio.sfx('cancel'); ph.back(true); } },
    draw(c, ph, a) {
      const q = qs(g);
      const x = a.x + 8, w = a.w - 16;
      let y = a.y + 6;
      T(c, fitText(c, `解いた問題 ${q.total.n}問・正解 ${q.total.ok}問`, w, 12), x, y, 12, L.ink); y += 16;
      // per category: level dots + accuracy bar
      for (const cat of B.CAT_IDS) {
        const s = q.stat[cat] || { n: 0, ok: 0 };
        const rate = s.n ? s.ok / s.n : 0;
        T(c, B.CATS[cat].short, x, y, 12, L.ink);
        for (let i = 0; i < 5; i++) R(c, x + 58 + i * 7, y + 4, 5, 5, i < catLevel(g, cat) ? B.CATS[cat].color : L.line);
        R(c, x + 100, y + 4, 70, 6, L.line);
        R(c, x + 100, y + 4, Math.round(70 * rate), 6, B.CATS[cat].color);
        T(c, s.n ? `${Math.round(rate * 100)}%` : '—', x + w, y, 12, L.dim, 'right');
        y += 15;
      }
      y += 4;
      T(c, '最近7日（解いた数）', x, y, 12, L.dim); y += 14;
      const days = [];
      for (let d = g.state.day - 6; d <= g.state.day; d++) days.push(q.hist.find((h) => h.day === d) || { day: d, n: 0, ok: 0 });
      const max = Math.max(10, ...days.map((h) => h.n));
      const bh = Math.max(10, a.y + a.h - y - 16);
      days.forEach((h, i) => {
        const bx = x + 4 + i * 30;
        const hh = Math.round((bh * h.n) / max), ho = Math.round((bh * h.ok) / max);
        R(c, bx, y + bh - hh, 18, hh, L.line);
        R(c, bx, y + bh - ho, 18, ho, L.acc);
        T(c, h.day === g.state.day ? '今日' : `${h.day}`, bx + 9, y + bh + 2, 12, L.dim, 'center');
      });
    },
  });
}
function helpScreen(g) {
  const L = look(g);
  const d = devOf(g);
  const what = d === 'techo' ? 'この問題集' : d === 'keitai' ? 'このケータイサイト' : 'このアプリ';
  return phoneInfo(g, {
    title: 'つかいかた', color: L.color,
    text: [
      `${what}で問題を解くと「雑学レベル」が上がる。`,
      'クイズ番組に出たとき、レベルと番組のジャンルの得意さで、問題がやさしくなり（時間に余裕・相手が押すのがおそくなる）、得点にもボーナスがつく。いい結果はギャラと知名度にひびく。',
      '同じ日にたくさん解くほど、身につく量はへっていく（きょうの伸び）。毎日少しずつが一番。',
      '「本番形式で練習」は体力を5つかう。番組の形式に慣れるほど、本番に強くなる。',
      '問題はいまの年の事実にそっている。',
    ].join('\n\n'),
  });
}

registerPhoneApp('quiz', {
  name: (g) => look(g).name, color: '#7a3ad8', order: 69,
  iconHD: (c, x, y, g) => iconQuiz(c, x, y, g),
  badge: (g) => (g && g.state && qs(g).drill.day !== g.state.day ? 1 : 0),
  open: (g) => quizApp(g),
});

// ======================================================================== mornings
// クイズ!ヘキサゴンII ended in 2011-09: a regular slot on it ends with the last broadcast.
onMorning((g) => {
  const st = g.state;
  if (!st || !st.regulars) return;
  const id = 'prog_hexagon2';
  const s = st.regulars[id];
  if (!s || s.dropped || s.since == null || !REGULARS[id]) return;
  const { y, m } = gameYM(g);
  if (y * 12 + m <= 2011 * 12 + 9) return;
  s.dropped = true;
  s.ended = st.day;
  g.message({ from: REGULARS[id].host || 'プロデューサー', look: REGULARS[id].hostLook, kind: 'news', text: `『${REGULARS[id].title}』は、2011年9月の放送で最終回をむかえました。\nレギュラー出演、本当におつかれさまでした！` });
});

export { FORMATS };
