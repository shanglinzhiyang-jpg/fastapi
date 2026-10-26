// 審査員AI — what the script judges REMEMBER about the player [R11-J]. Pure JS (neta_ai.js imports it; node tests import it).
//
//   ctxFor(st, o)               → jc  the judging context handed to scoreLocal as ctx.jai (panel with drifted tastes + memory)
//   sigOf(texts) / jaccard      a MinHash signature of the punch lines (12 × 12 bits) and the overlap of two
//   staleness(jc, sig, id)      → { v 0..1, from: title } how much the script looks like one seen before (見飽きた)
//   netaAdjust(jc, j, I)        → { s, d, memo } one judge's score = the taste-weighted score + bounded memory adjustments, with the
//                               breakdown d = { o (素点: the seat's plain table), a: [[label, value, kind]] } and memo lines for the comment
//   recordNeta(st, neta, ai, o) remember a scored script: the ring of the player's scripts, each judge's fondness / bar / fatigue
//
// Fair by construction: every adjustment is small and bounded (total −6 … +5 points of a 100-point judge), scaled by the judge's
// fairness, zero for a player with no history; growth and freshness are rewarded, repetition and mannerisms are called out.

import { strHash } from './contests_gen.js';
import { jstate, netaPanel, agentOf, ctr, clamp, moodOf, kindFavor, h01, DIM_JP, AXIS_DIM, DIMS, schoolOf, styleAt, descOf, goalOf } from './judges_ai.js';

const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
export const AXIS_ORDER = ['tsukami', 'kousei', 'hassou', 'kotoba', 'tsukkomi', 'tempo', 'tendon', 'dokuji', 'chara', 'shaku', 'sage', 'enji', 'mijika', 'kyori', 'settei', 'uragiri', 'uta', 'nisete', 'rinjou', 'hitori'];
export const RING = 12;
export const TIC_JP = {
  nande: '「なんでやねん」系のツッコミ', cliche: '決まり文句のツッコミ', beta: '予想どおりのボケ', tobi: '飛びすぎたボケ', open: '同じ入り方', close: '同じ締め方', pat: '同じ型のボケ', joke: 'どこかで聞いたネタ',
};

// ------------------------------------------------------------------ MinHash of a script
const MH = 12;
const SALT = Array.from({ length: MH }, (_, i) => Math.imul(0x9e3779b1, i + 1) >>> 0);
export function sigOf(texts) {
  const mins = new Array(MH).fill(0xffffffff);
  let n = 0;
  for (const t of texts) {
    const a = Array.from(String(t || ''));
    for (let i = 0; i + 4 <= a.length; i++) {
      const h = strHash(a.slice(i, i + 4).join(''));
      n++;
      for (let k = 0; k < MH; k++) { const v = Math.imul(h ^ SALT[k], 0x85ebca6b) >>> 0; if (v < mins[k]) mins[k] = v; }
    }
  }
  return n >= 6 ? mins.map((v) => v >>> 20) : null;
}
export function jaccard(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) s++;
  return s / a.length;
}
// mannerisms of a script (strings; the same string in several scripts = a habit)
export function ticsOf(f) {
  const x = [];
  if (f.nande >= 2) x.push('nande');
  if (f.clicheT > 0.35) x.push('cliche');
  if (f.beta > 0.4) x.push('beta');
  if (f.tobi > 0.4) x.push('tobi');
  if (f.jokes > 0) x.push('joke');
  if (f.pat) x.push('pat');
  const o = String(f.open || '').slice(0, 5), c = String(f.close || '').slice(-6);
  if (o.length >= 4) x.push(`open:${(strHash(o) % 46656).toString(36)}`);
  if (c.length >= 4) x.push(`close:${(strHash(c) % 46656).toString(36)}`);
  return x;
}
const ticName = (t) => TIC_JP[String(t).split(':')[0]] || t;

// ------------------------------------------------------------------ the judging context
// o: { year, day, base (JUDGES), id (script id), kind, hash (script hash) }
export function ctxFor(st, o) {
  const J = jstate(st);
  if (!J || !J.y0) return null;
  const panel = netaPanel(J, o.base, o.year);
  return { J, st, panel, ring: J.pl, year: o.year, day: o.day, id: o.id || '', kind: o.kind, hash: o.hash, kf: kindFavor(J, o.kind, o.year) };
}
// the ring entries that count for this script: other scripts (not the script itself, which is compared as a version)
const others = (jc) => jc.ring.filter((e) => e.i !== jc.id);
export function staleness(jc, sig, id) {
  if (!jc || !sig) return { v: 0, from: '', j: 0 };
  let best = 0, from = '';
  for (const e of jc.ring) {
    if (e.i === id) continue;
    const age = jc.day - num(e.d);
    if (age > 200 || !e.g) continue;
    const j = jaccard(sig, e.g) * (1 - 0.4 * clamp(age / 200, 0, 1));
    if (j > best) { best = j; from = e.ti || ''; }
  }
  return { v: clamp((best - 0.3) / 0.45, 0, 1), from, j: best };
}
// the previous version of this very script (or, failing that, the last script of the same kind): for "前回より…"
function previous(jc) {
  const same = jc.ring.find((e) => e.i === jc.id);
  if (same) return same.h === jc.hash ? (same.pv ? { ...same.pv, own: true } : null) : { t: same.t, a: same.a, d: same.d, own: true };
  const k = others(jc).filter((e) => e.k === jc.kind && jc.day - num(e.d) <= 120).sort((a, b) => num(b.d) - num(a.d))[0];
  return k ? { t: k.t, a: k.a, d: k.d, own: false, ti: k.ti } : null;
}
const axisOf = (arr) => { const o = {}; if (Array.isArray(arr)) AXIS_ORDER.forEach((a, i) => { if (arr[i] >= 0) o[a] = arr[i]; }); return o; };
export const packAxes = (ax) => AXIS_ORDER.map((a) => (Number.isFinite(ax && ax[a]) ? Math.round(ax[a]) : -1));

// ------------------------------------------------------------------ the voice of each seat (memory remarks)
const VOICE = {
  dan: {
    stale: (x) => `この組み立ては、前に拝見した${x.from ? `『${x.from}』` : '台本'}と地続きですね。`,
    tic: (x) => `また${x.name}ですね。構成を変えてみては。`,
    growth: (x) => `前回より${x.ax}が締まりました。`,
    fond: () => 'あなたの台本は毎回、設計図を読むのが楽しみです。',
    bar: () => 'ここまで拝見してきたので、もう一段上の組み立てを期待しています。',
    trend: (x) => (x.up ? `${x.kind}が追い風の時期ですね。` : `${x.kind}には向かい風の時期ですね。`),
  },
  tobishima: {
    stale: (x) => `そのボケ、${x.from ? `『${x.from}』で` : '前にも'}見たで。`,
    tic: (x) => `${x.name}ばっかりやな。そろそろ違うの見せてや。`,
    growth: (x) => `前より${x.ax}がようなったやん。`,
    fond: () => 'あんたの台本、ほんま楽しみにしとるで。',
    bar: () => 'このくらいは書ける人やろ。もっと飛んでええで。',
    trend: (x) => (x.up ? `いまは${x.kind}の時代やな。` : `いまは${x.kind}にはしんどい時代やな。`),
  },
  koiki: {
    stale: (x) => `この言い回し、${x.from ? `『${x.from}』で` : 'いつぞや'}伺いましたな。`,
    tic: (x) => `${x.name}が毎度出てきますな。`,
    growth: (x) => `前回より${x.ax}が立ってきましたな。`,
    fond: () => 'あなたの言葉は、聞いていて心地よいですな。',
    bar: () => 'もう一歩、耳に残る言葉をお願いしますよ。',
    trend: (x) => (x.up ? `いまは${x.kind}が好まれる世の中ですな。` : `いまは${x.kind}には風当たりの強い世の中ですな。`),
  },
  emihara: {
    stale: (x) => `これ、${x.from ? `『${x.from}』と` : '前のと'}似てるわね。お客さんも気づくわよ。`,
    tic: (x) => `${x.name}、毎回やないの。`,
    growth: (x) => `前よりずっと${x.ax}がようなったわ！`,
    fond: () => 'あなたの舞台、うちの劇場でまた見たいわ。',
    bar: () => '前の出来を知ってるから、これだとちょっと物足りないわね。',
    trend: (x) => (x.up ? `いまのお客さん、${x.kind}が大好きなのよ。` : `いまのお客さん、${x.kind}にはちょっと冷たいのよ。`),
  },
  shindo: {
    stale: (x) => `既視感がある。${x.from ? `『${x.from}』` : '前の台本'}と地続きだ。`,
    tic: (x) => `${x.name}は、もう癖になっている。`,
    growth: (x) => `前回から${x.ax}が更新された。`,
    fond: () => 'この書き手は追い続けると決めている。',
    bar: () => '前に見たものを超えていない。更新を期待する。',
    trend: (x) => (x.up ? `${x.kind}が追い風の時期だ。` : `${x.kind}は逆風の時期だ。`),
  },
};
const voiceOf = (id) => VOICE[id] || VOICE.dan;
const growWord = (a, AX) => AX[a] || a;

// ------------------------------------------------------------------ one judge's adjustments
// j: a panel entry (netaPanel); I: { sFull, sNoStale, sOrig, ax, axesIds, tics, stale: {v, from}, AX (labels), total0 }
export function netaAdjust(jc, j, I) {
  const J = jc.J;
  const ag = agentOf(J, j.key, false) || {};
  const tr = j.desc.tr;
  const fair = tr.fair;
  const attn = 0.55 + 0.45 * tr.mem; // how closely they remember
  const pf = clamp((1.2 - fair * 0.75) / 0.7, 0.5, 1.3); // how much of the personal side shows: a fair judge shows little
  const comps = [];
  const memo = [];
  const add = (label, v, kind, pri = 1) => { if (Math.abs(v) >= 0.05) comps.push([label, v, kind, pri]); };
  // 1. taste drift and 見飽きた (computed by the scorer)
  add('好みの変化', I.sNoStale - I.sOrig, 'drift');
  // 見飽きた: the 独自性 axis already carries it (sFull − sNoStale); an attentive judge who has seen it before adds a little more
  const staleExtra = I.stale && I.stale.v > 0.05 ? -Math.min(3.5, I.stale.v * 2.6 * attn * pf) : 0;
  add('見飽きた', I.sFull - I.sNoStale + staleExtra, 'stale');
  if (I.stale && I.stale.v > 0.25) memo.push({ k: 'stale', w: 5 + I.stale.v, x: { from: I.stale.from } });
  const voice = voiceOf(j.id);
  // 2. mannerisms: the same habit in several recent scripts
  const recent = others(jc).filter((e) => jc.day - num(e.d) <= 150 && num(e.d) >= num(j.d0)).slice(-6);
  let tic = 0;
  const habit = [];
  for (const t of I.tics || []) {
    const n = recent.filter((e) => (e.x || []).includes(t)).length;
    if (n >= 2) { habit.push([t, n]); tic -= (0.9 + 0.45 * attn) * (n >= 3 ? 1.25 : 1); }
  }
  tic = Math.max(-2.6, tic) * pf;
  if (habit.length) { add('くせ', tic, 'tic'); const h = habit.sort((a, b) => b[1] - a[1])[0]; memo.push({ k: 'tic', w: 4 + h[1] * 0.2, x: { name: ticName(h[0]) } }); }
  // 3. growth: this script against the previous one
  let growth = 0;
  const pv = previous(jc);
  if (pv) {
    const pa = axisOf(pv.a);
    const focus = I.axesIds.slice().sort((a, b) => (j.w[b] || 1) - (j.w[a] || 1)).slice(0, 4);
    let best = null;
    for (const a of focus) {
      if (!(a in pa) || !Number.isFinite(I.ax[a])) continue;
      const dlt = I.ax[a] - pa[a];
      if (dlt >= 12) { growth += 1.1 * Math.min(2, dlt / 12); if (!best || dlt > best[1]) best = [a, dlt]; }
    }
    const dt = I.total0 - num(pv.t);
    if (dt >= 8) growth += 0.8 + Math.min(1, (dt - 8) / 20);
    growth = Math.min(growth, pv.own ? 3 : 2) * (0.7 + 0.3 * attn);
    if (growth > 0 && goalOf(j.desc, ag, jc.year).id === 'discover') growth *= 1.25; // a judge who is looking for new talent is quicker to praise a rising writer
    if (growth > 0.3) { add('前回より成長', growth, 'growth'); if (best) memo.push({ k: 'growth', w: 6, x: { ax: growWord(best[0], I.AX), a: best[0] } }); else memo.push({ k: 'growth', w: 4.5, x: { ax: '全体', a: '' } }); }
  }
  // 4. fondness (bounded, never decisive)
  const fo = ctr(ag, 'fo') / 100;
  const fond = fo * 1.6 * pf * (1 + tr.warm * 0.4);
  add(fo >= 0 ? '好意' : '反感', fond, 'fond');
  if (fo > 0.35) memo.push({ k: 'fond', w: 2, x: {} });
  // 5. the bar: a judge who has seen good scripts expects more of an ordinary one
  const br = ctr(ag, 'br') / 100;
  const barline = 52 + 22 * br;
  let bar = 0;
  if (br > 0.05 && I.sNoStale < barline && growth < 0.5) bar = -Math.min(3.5, (barline - I.sNoStale) * 0.14) * (1.2 - fair * 0.5);
  add('要求の高さ', bar, 'bar');
  if (bar < -0.8) memo.push({ k: 'bar', w: 3, x: {} });
  // 6. mood and fatigue
  const mood = moodOf(J, j.key, jc.day);
  add('機嫌', mood * 0.85 * pf, 'mood');
  const fn = ctr(ag, 'fd') === jc.day ? ctr(ag, 'fn') : 0;
  let fat = 0;
  if (fn > 4) fat = -(I.sFull - 50) * 0.05 * Math.min(4, fn - 4);
  add('疲れ', fat, 'fatigue');
  // 7. the scene: which form is in vogue
  add('いまの流行', jc.kf * tr.open * 1.0, 'trend');
  if (Math.abs(jc.kf) >= 0.4 && I.KL && I.KL[jc.kind]) memo.push({ k: 'trend', w: 2, x: { kind: I.KL[jc.kind], up: jc.kf > 0 } });
  // total (bounded)
  let sum = 0;
  for (const c of comps) if (!['drift', 'stale'].includes(c[2])) sum += c[1];
  sum = clamp(sum, -6, 5) + staleExtra;
  const s = I.sFull + sum;
  return {
    s, sum,
    d: { o: I.sOrig, a: comps.map(([l, v, k]) => [l, Math.round(v * 10) / 10, k]), mood: Math.round(mood * 100) / 100, w: I.axesIds.slice().sort((a, b) => (j.w[b] || 1) - (j.w[a] || 1)).slice(0, 3).map((a) => [a, Math.round((j.w[a] || 1) * 10) / 10]) },
    memo: memo.sort((a, b) => b.w - a.w).map((m) => ({ k: m.k, text: voice[m.k] ? voice[m.k](m.x) : '' })).filter((m) => m.text),
  };
}

// ------------------------------------------------------------------ remembering
function pushLimited(arr, v, n) { arr.push(v); if (arr.length > n) arr.splice(0, arr.length - n); }
// o: { day, year, title, id, kind, hash }; ai: the result (ai.mem = { g, x }, ai.axes, ai.total, ai.judges[] with k)
export function recordNeta(st, neta, ai, o) {
  const J = jstate(st);
  if (!J || !J.y0 || !ai || !ai.judges || !ai.judges.length) return false;
  const day = o.day;
  const mem = ai.mem || {};
  const h = String(o.hash);
  const old = J.pl.find((e) => e.i === neta.id);
  if (old && old.h === h) return false; // already remembered: scoring the same script again changes nothing
  const e = { i: neta.id, d: day, k: neta.kind, h, t: Math.round(ai.total), a: packAxes(ai.axes), g: mem.g || null, x: mem.x || [], ti: Array.from(String(neta.title || '').replace(/[\u0000-\u001f\s「」『』"]/g, '')).slice(0, 10).join('') };
  if (old) {
    e.pv = { t: old.t, a: old.a, d: old.d };
    J.pl.splice(J.pl.indexOf(old), 1);
  }
  J.pl.push(e);
  if (J.pl.length > RING) J.pl.splice(0, J.pl.length - RING);
  const stale = num(ai.mem && ai.mem.stale);
  const grew = (ai.judges || []).some((j) => j.d && (j.d.a || []).some((c) => c[2] === 'growth'));
  for (const jd of ai.judges) {
    if (!jd.k) continue;
    const a = agentOf(J, jd.k);
    const dt = Math.max(0, day - ctr(a, 'l', day));
    a.l = day;
    a.fo = Math.round(clamp(ctr(a, 'fo') * 0.985 ** dt + 100 * (grew ? 0.1 : 0) + (ai.total >= 70 ? 6 : 0) + (ai.total >= 85 ? 4 : 0) - stale * 12 - (ai.total < 30 ? 4 : 0), -100, 100));
    a.br = Math.round(clamp(ctr(a, 'br') * 0.992 ** dt + 100 * Math.max(0, (ai.total - 62) / 38) * 0.14, 0, 100));
    if (ctr(a, 'fd') === day) a.fn = ctr(a, 'fn') + 1; else { a.fd = day; a.fn = 1; }
    a.se = ctr(a, 'se') + 1;
    if (grew || ai.total >= 80) a.pr = ctr(a, 'pr') + 1; // (for the goal 「新しい才能を見つけたい」)
    a.cm = a.cm || [];
    pushLimited(a.cm, [day, Math.round(jd.score), Array.from(String(jd.comment || '')).slice(0, 56).join('')], 3);
    a.fv = a.fv || [];
    const mine = a.fv.find((f) => f[0] === e.ti);
    if (mine) mine[1] = Math.max(mine[1], Math.round(jd.score)); else a.fv.push([e.ti, Math.round(jd.score)]);
    a.fv.sort((x, y) => y[1] - x[1]);
    if (a.fv.length > 3) a.fv.length = 3;
  }
  // how the judges differed (for the 相関): running mean of |score gap| per pair
  const js = ai.judges.filter((j) => j.k);
  for (let x = 0; x < js.length; x++) for (let y = x + 1; y < js.length; y++) {
    const key = js[x].k < js[y].k ? `${js[x].k}|${js[y].k}` : `${js[y].k}|${js[x].k}`;
    const r = J.rel[key] || (J.rel[key] = [0, 0]);
    r[0] = Math.min(60, r[0] + 1);
    r[1] = Math.round((r[1] * (r[0] - 1) + Math.abs(js[x].score - js[y].score) * 10) / r[0]);
  }
  const rk = Object.keys(J.rel);
  if (rk.length > 120) for (const k of rk.slice(0, rk.length - 120)) delete J.rel[k];
  return true;
}

// ------------------------------------------------------------------ for the optional Claude mode (a compressed memory of one judge)
export function memoryLines(jc, j) {
  const J = jc.J;
  const ag = agentOf(J, j.key, false);
  const seen = jc.ring.filter((e) => num(e.d) >= num(j.d0));
  const parts = [];
  parts.push(`これまでに${ag ? ctr(ag, 'se') : 0}本のネタを見た`);
  if (seen.length) { const last = seen[seen.length - 1]; parts.push(`直近は『${last.ti || '無題'}』${last.t}点`); }
  const fo = ag ? ctr(ag, 'fo') : 0;
  if (fo >= 30) parts.push('この書き手に好意を持っている'); else if (fo <= -30) parts.push('この書き手に厳しい目を向けている');
  const br = ag ? ctr(ag, 'br') : 0;
  if (br >= 40) parts.push('要求水準は高くなっている');
  const hab = {};
  for (const e of seen.slice(-5)) for (const t of e.x || []) hab[t] = (hab[t] || 0) + 1;
  const h = Object.entries(hab).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])[0];
  if (h) parts.push(`${ticName(h[0])}が続いていると感じている`);
  return `${j.name}の記憶：${parts.join('。')}。`;
}

// ------------------------------------------------------------------ the breakdown and the 座談 of a result
const KIND_WHY = {
  drift: 'この審査員の好みが、就任のころから動いたぶん', stale: '前に見たネタと似ていたぶん（独自性）', tic: '同じくせが続いているぶん', growth: '前回より良くなったと見たぶん',
  fond: 'あなたへの好意（反感）', bar: 'これまでの出来を見て、水準が上がっているぶん', mood: 'きょうの機嫌', fatigue: '長く審査して疲れているぶん', trend: 'いま評価されやすい型かどうか',
};
// one judge's number, traced: [{ label, value (rounded), why, kind }] and the 素点 that remains, so that 素点 + Σ = score
export function explain(j) {
  const d = j && j.d;
  if (!d || !Array.isArray(d.a)) return null;
  const rows = d.a.map(([label, v, kind]) => ({ label, v: Math.round(v), raw: v, kind, why: KIND_WHY[kind] || '' })).filter((r) => r.v !== 0);
  const sum = rows.reduce((a, r) => a + r.v, 0);
  return { base: Math.round(num(j.score) - sum), rows, score: num(j.score), mood: d.mood, weights: d.w || null };
}
const SEAT_FOCUS = {
  dan: ['kousei', 'tsukami', 'shaku', 'tendon', 'sage'], tobishima: ['hassou', 'dokuji', 'uragiri', 'settei', 'kyori', 'nisete'], koiki: ['kotoba', 'tsukkomi', 'enji', 'sage', 'mijika', 'uta', 'rinjou'],
  emihara: ['tsukami', 'tempo', 'chara', 'kousei', 'hitori', 'rinjou'], shindo: ['dokuji', 'hassou', 'uragiri', 'tendon'],
};
const KANSAI_SEAT = new Set(['tobishima', 'emihara']);
// the exchange when the scores split by 8 or more: who argued what (null when the panel agreed)
export function netaTalk(ai, AX) {
  const js = (ai && ai.judges || []).filter((j) => Number.isFinite(j.score));
  if (js.length < 3 || !ai.axes) return null;
  const sorted = js.slice().sort((a, b) => b.score - a.score);
  const hi = sorted[0], lo = sorted[sorted.length - 1];
  if (hi.score - lo.score < 8) return null;
  const pick = (j, best) => (SEAT_FOCUS[j.id] || []).filter((a) => a in ai.axes).sort((a, b) => (best ? ai.axes[b] - ai.axes[a] : ai.axes[a] - ai.axes[b]))[0];
  const ah = pick(hi, true), al = pick(lo, false);
  if (!ah || !al) return null;
  const rs = ai.reasons || {};
  const kh = KANSAI_SEAT.has(hi.id), kl = KANSAI_SEAT.has(lo.id);
  const lines = [];
  lines.push({ name: hi.name, id: hi.id, text: `${AX[ah]}が決め手${kh ? 'や' : 'です'}。${rs[ah] ? `${String(rs[ah]).replace(/[。]$/, '')}。` : ''}${hi.score}点を付け${kh ? 'たで' : 'ました'}。` });
  lines.push({ name: lo.name, id: lo.id, text: `${AX[al]}が引っかかる${kl ? 'んや' : 'んです'}。${rs[al] ? `${String(rs[al]).replace(/[。]$/, '')}。` : ''}${lo.score}点${kl ? 'までやな' : 'までです'}。` });
  const mid = sorted.find((j) => j !== hi && j !== lo && Math.abs(j.score - (hi.score + lo.score) / 2) <= Math.max(...sorted.filter((q) => q !== hi && q !== lo).map((q) => Math.abs(q.score - (hi.score + lo.score) / 2))));
  if (mid) lines.push({ name: mid.name, id: mid.id, text: `${KANSAI_SEAT.has(mid.id) ? 'どっちの言い分もわかるわ' : 'どちらの言い分もわかります'}。${mid.score}点で${KANSAI_SEAT.has(mid.id) ? 'まとめとくわ' : 'まとめましょう'}。` });
  lines.push({ name: lo.name, id: lo.id, text: `${AX[ah]}は${kl ? '認めるわ。' : '認めます。'}${kl ? 'せやけど' : 'ただ'}${AX[al]}は${kl ? '譲れへんな' : '譲れません'}。` });
  return { spread: hi.score - lo.score, hi: hi.id, lo: lo.id, lines };
}
