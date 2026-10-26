// 審査員AI — the contest judges [R11-J]. Pure JS (contests.js, koc_core.js and m1_*.js import it; node imports it for the tests).
//
//   ensure(st)                         start the system for a save (reference year, seed); null when it cannot
//   decorate(st, list, cid, year)      the pool judges of a contest-year with their agents' fields (drifted taste mix, strictness, school)
//   adjust(st, j, pl)                  → { d, parts, shrink } the points (on the judges' 0..100 base) a judge adds to one act:
//                                      the fit of their drifted taste to a rival act (drift only: 0 at the debut) or, for the
//                                      player, what they remember (fondness, growth, 見飽きた, mood) — bounded, never decisive alone
//   discuss(st, judges, per, pl, r)    the 座談 when the panel split: who argued what, who changed their mind (≤ ±1 point, in place)
//   stage2Score(st, j, act)            a judge's lean in the 最終決戦 vote (their own rule: taste + fondness)
//   record(st, judges, per, pl)        remember the player's act (per-judge memory ring, fondness, 相関)
//   alumni(...)                        former champions who now sit on the panel
// pl (the act being judged): { me, v (style vector), fs, day, year, kind, nh (script hash), ti, cid, order, of, parts }

import {
  goalOf, jstate, initState, agentOf, ctr, clamp, moodOf, decorateJudge, descOfJudge, descOfTable, partMix, styleAt, fit, driftFit, actVec, partsVec, simParts, schoolOf, h01,
  PARTS, PART_JP, DIMS, DIM_JP, topDims,
} from './judges_ai.js';
import { rngOf, personName, isRealNameLike, strHash } from './contests_gen.js';

const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
// (tests can switch the whole judge-agent layer off to compare against the plain tables)
let ENABLED = true;
export const setEnabled = (b) => { ENABLED = !!b; };
export const ensure = (st) => { try { if (!ENABLED) return null; const J = initState(st); return J && J.y0 ? J : null; } catch (e) { return null; } };

export function decorate(st, list, cid, year) {
  const J = ensure(st);
  if (!J) return list;
  return list.map((j) => decorateJudge(J, j, cid, year));
}
// the version of the judge world (cache keys of the callers include it)
export const nhOf = (id, h) => (strHash(`${id}|${h || ''}`) % 99991) + 1;
export const verOf = (st) => { const J = ensure(st); return J ? num(J.sv) : 0; };

// ------------------------------------------------------------------ one act, one judge
// pl.me → the player (what the judge remembers); a rival (pl.sim) → only the drift of taste since the debut
export function adjust(st, j, pl) {
  const J = ensure(st);
  if (!J || !pl || !j || !j.key) return { d: 0, parts: [], shrink: 1 };
  const d = descOfJudge(J, j);
  if (!pl.me) {
    const av = pl.v || actVec(J.seed, pl.act);
    const x = clamp(driftFit(styleAt(J, d, pl.year), d.b, av) * 12, -5, 5); // ±1 point of a 100-point judge at the very most; 0 for the average act
    return { d: x, parts: x ? [['好みの変化', x]] : [], shrink: 1 };
  }
  const ag = agentOf(J, j.key, false) || {};
  const tr = d.tr;
  const attn = 0.55 + 0.45 * tr.mem;
  const pf = clamp((1.2 - tr.fair * 0.75) / 0.7, 0.5, 1.3);
  const parts = [];
  const fo = ctr(ag, 'fo') / 100;
  // (field-scale points: 5 of them are about one point of a 100-point judge)
  parts.push(['好意', fo * 4.8 * pf * (1 + tr.warm * 0.4)]);
  const pm = ag.pm || [];
  const last = pm[pm.length - 1];
  if (last && pl.day - last[0] <= 400 && pl.day - last[0] >= 1) {
    const dl = num(pl.fs) - last[1];
    if (dl >= 6) parts.push(['前より成長', Math.min(4.4, dl * 0.32) * (0.7 + 0.3 * attn)]);
  }
  if (pl.nh) {
    const n = pm.filter((x) => x[3] === pl.nh).length;
    if (n >= 1) parts.push(['見飽きた', -Math.min(4.8, 2.2 * n * (0.6 + 0.4 * attn))]);
  }
  parts.push(['機嫌', moodOf(J, j.key, pl.day) * 1.6 * pf]);
  const sum = clamp(parts.reduce((a, p) => a + p[1], 0), -6.5, 6);
  // a tired panel (late in a long order) judges a little more alike: the deviations shrink
  const fat = pl.order && pl.of ? clamp(((pl.order - 1) / Math.max(1, pl.of)) * 1.3 * (1.1 - tr.mem * 0.3), 0, 1.4) : 0;
  return { d: sum, parts: parts.filter((p) => Math.abs(p[1]) >= 0.08), shrink: 1 - 0.06 * fat, fat };
}
// parts for a rival's performance (the style of the act), for the drifted-taste term
export function rivalPl(st, act, year) {
  const J = ensure(st);
  return J ? { st, me: false, act, year, v: actVec(J.seed, act) } : null;
}
export function playerPl(st, o) {
  const J = ensure(st);
  if (!J) return null;
  return { st, me: true, day: o.day, year: o.year, fs: o.fs, kind: o.kind, nh: o.nh || 0, ti: Array.from(String(o.ti || '').replace(/[\u0000-\u001f\s「」『』"]/g, '')).slice(0, 10).join(''), cid: o.cid, order: o.order, of: o.of, v: partsVec(o.parts, o.fs), parts: o.parts };
}

// ------------------------------------------------------------------ the 座談
const PRAISE = {
  timing: ['入りのツカミと間がよかった', 'テンポに乗れた'], neta: ['ネタの組み立てがよく出来ていた', '発想とオチがきれいにつながった'],
  execution: ['言葉の粒が立っていた', '技術の高さが光った'], presence: ['出てきた瞬間の華があった', 'キャラが立っていた'], crowd: ['客席の笑いが途切れなかった', 'お客さんをつかんでいた'],
};
const PRAISE_K = {
  timing: ['ツカミもええし、間もよかったで', 'テンポに乗れたわ'], neta: ['ネタの組み立てがよう出来とった', '発想もオチもきれいにつながっとった'],
  execution: ['言葉の粒が立っとった', '技術がもう一級品や'], presence: ['出てきた瞬間の華があったな', 'キャラがちゃんと立っとった'], crowd: ['客席が途切れんと笑っとった', 'お客さんをがっちりつかんどった'],
};
const CRIT = {
  timing: ['間が詰まって笑う余白がなかった', 'ツカミが少し弱かった'], neta: ['ネタの軸がもう少し欲しかった', '後半の展開が薄かった'],
  execution: ['言葉のつまずきが気になった', '声の通りがもう一歩'], presence: ['華がもう一歩だった', 'キャラが見えにくかった'], crowd: ['客席の反応が伸びきらなかった', '爆発までは届かなかった'],
};
const CRIT_K = {
  timing: ['間が詰まって笑う余白がなかったな', 'ツカミがちょっと弱かったな'], neta: ['ネタの軸がもうちょい欲しかったな', '後半の展開が薄かったわ'],
  execution: ['言葉でつまずいたのが気になったわ', '声の通りがもう一歩やな'], presence: ['華がもう一歩やな', 'キャラが見えにくかったで'], crowd: ['客席の反応が伸びきらんかったな', '爆発まで届かんかった'],
};
const PART_NOUN = { timing: '間とツカミ', neta: 'ネタの組み立て', execution: '技術', presence: '華', crowd: '客席の反応' };
const pickAt = (a, r) => a[Math.floor(r() * a.length) % a.length];
// judges: decorated judges; per: [{ pts, max }] aligned with judges; pl: the player's act (parts); r: rng. Mutates per[i].pts (±1) and returns
// { spread, lines: [{ name, short, text }], changes: [{ i, from, to }] } or null when the panel agreed.
export function discuss(st, judges, per, pl, r, vspread) {
  const J = ensure(st);
  if (!J || judges.length < 3 || !per.length || !pl || !pl.parts) return null;
  const max = per[0].max || 100;
  const pts = per.map((p) => p.pts);
  let hi = 0, lo = 0;
  pts.forEach((v, i) => { if (v > pts[hi]) hi = i; if (v < pts[lo]) lo = i; });
  if (hi === lo || pts[hi] === pts[lo]) return null;
  if (vspread != null && vspread < 9) return null; // the panel's points differ by 9 (field scale; about 2 points of a 100-point judge) or more
  const parts = pl.parts;
  const avg = PARTS.reduce((a, p) => a + num(parts[p]), 0) / PARTS.length;
  const H = judges[hi], L = judges[lo];
  // H praises the best part among those they care about; L names the weakest part they care about
  const care = (j) => { const w = j.mix || { [j.tastePart || 'neta']: 0.25 }; return (p) => (w[p] || 0.02); };
  const best = PARTS.slice().sort((a, b) => (num(parts[b]) - avg) * care(H)(b) - (num(parts[a]) - avg) * care(H)(a))[0];
  const worst = PARTS.slice().sort((a, b) => (num(parts[a]) - avg) * care(L)(a) - (num(parts[b]) - avg) * care(L)(b))[0];
  const kH = H.dialect === 'kansai', kL = L.dialect === 'kansai';
  const lines = [];
  lines.push({ name: H.name, short: H.short || H.name, text: `${pickAt((kH ? PRAISE_K : PRAISE)[best], r)}。${pts[hi]}点は${kH ? '妥当やで' : '妥当です'}。` });
  lines.push({ name: L.name, short: L.short || L.name, text: `${pickAt((kL ? CRIT_K : CRIT)[worst], r)}。${kL ? 'せやから' : 'それで'}${pts[lo]}点${kL ? 'にしたんや' : 'にしました'}。` });
  // who changes their mind: the one with the lower stubbornness, if the other's point was fair (one point, in place)
  const changes = [];
  const trL = L.tr || { stub: 0.5 }, trH = H.tr || { stub: 0.5 };
  const rr = r();
  if (max >= 50) {
    if (trL.stub < 0.55 && rr < 0.75) { per[lo].pts = Math.min(max, per[lo].pts + 1); changes.push({ i: lo, from: pts[lo], to: per[lo].pts }); }
    else if (trH.stub < 0.4 && rr < 0.5) { per[hi].pts = Math.max(1, per[hi].pts - 1); changes.push({ i: hi, from: pts[hi], to: per[hi].pts }); }
  }
  if (changes.length) {
    const c = changes[0], cj = judges[c.i], k = cj.dialect === 'kansai';
    const other = c.i === lo ? H : L;
    lines.push({ name: cj.name, short: cj.short || cj.name, text: c.i === lo ? (k ? `なるほど、${other.short || other.name}さんの言う通り、${PART_NOUN[best]}は確かによかったな。${c.to}点に直すわ。` : `${other.short || other.name}さんの言う通り、${PART_NOUN[best]}は確かによかったです。${c.to}点に直します。`) : (k ? `${other.short || other.name}さんの指摘も分かるわ。${c.to}点にしとく。` : `${other.short || other.name}さんの指摘ももっともです。${c.to}点に改めます。`) });
  } else {
    lines.push({ name: L.name, short: L.short || L.name, text: kL ? 'ここは譲れんな。点は変えへん。' : 'ここは譲れません。点はこのままで。' });
  }
  return { spread: pts[hi] - pts[lo], hi, lo, lines, changes, best, worst };
}

// ------------------------------------------------------------------ a remark from memory (appended to the judge's comment)
export function remark(st, j, pl) {
  const J = ensure(st);
  if (!J || !j || !j.key || !pl || !pl.me) return '';
  const ag = agentOf(J, j.key, false);
  if (!ag) return '';
  const pm = ag.pm || [];
  const last = pm[pm.length - 1];
  const k = j.dialect === 'kansai';
  if (pl.nh && pm.some((x) => x[3] === pl.nh)) return k ? 'このネタ、前にも見たな。' : 'このネタは前にも拝見しました。';
  if (last && pl.day - last[0] >= 1 && pl.day - last[0] <= 400) {
    const dl = num(pl.fs) - last[1];
    if (dl >= 8) return k ? '前に見たときより、一段上がったな。' : '前に見たときより一段上がりましたね。';
    if (dl <= -10) return k ? '前の方がキレがあったで。' : '前回の方が切れがありました。';
  }
  if (ctr(ag, 'fo') >= 40) return k ? 'あんたの舞台は毎回楽しみにしとるで。' : 'あなたの舞台は毎回楽しみにしています。';
  return '';
}

// ------------------------------------------------------------------ the 最終決戦 vote
// a judge's lean for an act (added to the score the plain rule uses): taste fit + fondness for the player; reasons for the log
export function stage2Lean(st, j, act, year) {
  const J = ensure(st);
  if (!J || !j.key) return { d: 0, why: '' };
  const d = descOfJudge(J, j);
  const av = act.v || DIMS.map(() => 0.5);
  const f = fit(styleAt(J, d, year), av);
  let x = f * 2.2;
  if (act.me) { const fo = ctr(agentOf(J, j.key, false), 'fo') / 100; x += fo * 1.4; }
  // the dimension that decided it for this judge
  const sty = styleAt(J, d, year);
  let bi = 0, bv = -9;
  DIMS.forEach((k, i) => { const c = (sty[i] - 0.5) * (av[i] - 0.5); if (c > bv) { bv = c; bi = i; } });
  return { d: x, why: DIM_JP[DIMS[bi]] };
}

// ------------------------------------------------------------------ remembering the player's act
export function record(st, judges, per, pl, comments) {
  const J = ensure(st);
  if (!J || !pl || !pl.me) return;
  const good = pl.fs >= 75, bad = pl.fs < 45;
  judges.forEach((j, i) => {
    if (!j.key) return;
    const a = agentOf(J, j.key);
    const dt = Math.max(0, pl.day - ctr(a, 'l', pl.day));
    a.l = pl.day;
    const pm = a.pm || (a.pm = []);
    const last = pm[pm.length - 1];
    const grew = last && pl.fs - last[1] >= 6;
    const same = pl.nh && pm.some((x) => x[3] === pl.nh);
    a.fo = Math.round(clamp(ctr(a, 'fo') * 0.985 ** dt + (grew ? 8 : 0) + (good ? 4 : 0) - (bad ? 3 : 0) - (same ? 6 : 0), -100, 100));
    pm.push([pl.day, Math.round(pl.fs), pl.kind === 'conte' ? 1 : pl.kind === 'pin' ? 2 : 0, pl.nh || 0]);
    if (pm.length > 6) pm.splice(0, pm.length - 6);
    a.se = ctr(a, 'se') + 1;
    if (grew || good) a.pr = ctr(a, 'pr') + 1;
    if (comments && comments[i]) { a.cm = a.cm || []; a.cm.push([pl.day, per[i] ? per[i].pts : 0, Array.from(String(comments[i].text || '')).slice(0, 56).join('')]); if (a.cm.length > 3) a.cm.splice(0, a.cm.length - 3); }
    if (pl.fs >= 60) { a.fv = a.fv || []; const m = a.fv.find((f) => f[0] === pl.ti); if (m) m[1] = Math.max(m[1], Math.round(pl.fs)); else a.fv.push([pl.ti || '（ネタ）', Math.round(pl.fs)]); a.fv.sort((x, y) => y[1] - x[1]); if (a.fv.length > 3) a.fv.length = 3; }
  });
  // 相関: the gaps between the panel's points (running mean, 100-scale)
  for (let x = 0; x < judges.length; x++) for (let y = x + 1; y < judges.length; y++) {
    if (!judges[x].key || !judges[y].key || !per[x] || !per[y]) continue;
    const k = judges[x].key < judges[y].key ? `${judges[x].key}|${judges[y].key}` : `${judges[y].key}|${judges[x].key}`;
    const rr = J.rel[k] || (J.rel[k] = [0, 0]);
    const gap = (Math.abs(per[x].pts - per[y].pts) / Math.max(1, per[x].max || 100)) * 1000;
    rr[0] = Math.min(60, rr[0] + 1);
    rr[1] = Math.round((rr[1] * (rr[0] - 1) + gap) / rr[0]);
  }
  const rk = Object.keys(J.rel);
  if (rk.length > 120) for (const k of rk.slice(0, rk.length - 120)) delete J.rel[k];
}

// ------------------------------------------------------------------ former champions on the panel
// cands: [{ year, name, unit, contest }] champions (members' names) of years that are old enough; returns pool entries
export function alumniPool(seed, cid, year, cands, taken) {
  const out = [];
  for (const c of cands) {
    if (!c.name || isRealNameLike(c.name) || taken.has(c.name)) continue;
    const r = rngOf(seed, 'alumni', cid, c.year);
    const from = c.year + 6 + Math.floor(r() * 5);
    const to = from + 4 + Math.floor(r() * 8);
    if (year < from || year > to) continue;
    out.push({ ...c, cy: c.year, from, to, r });
  }
  return out;
}
export { partsVec, simParts, actVec, schoolOf, topDims, h01, personName };

// ------------------------------------------------------------------ M-1's and KOC's own panels (tables of named judges)
// They have no `g`: the active save is bound by the entry points (bind) or read from window.__game (the browser's game object).
let ACTIVE = null;
export const bind = (st) => { ACTIVE = st; };
export function activeState() {
  try { const w = typeof window !== 'undefined' && window.__game && window.__game.state; if (w) return w; } catch (e) { /* node */ }
  return ACTIVE; // (a loaded save replaces g.state: the browser's own game object is always the truth)
}
// the points (on the table's own scale, fractional) one judge of a table panel adds to an act: the drift of their taste since the
// debut (M-1: how the act's style fits; KOC: the parts mix when the performance parts are known) and, for the player, their memory
// (fondness / growth / 見飽きた, bounded to ±1.2). Zero for a fresh game, without the system, or on any problem.
export function tableMod(scope, j, o) {
  try {
    const st = activeState();
    const J = st && ensure(st);
    if (!J || !j || !j.name) return 0;
    const year = num(j.y, J.y0);
    const d = descOfTable(J, scope, j);
    let x = 0;
    if (scope === 'm1' && o.act) x += clamp(driftFit(styleAt(J, d, year), d.b, actVec(J.seed, o.act)) * 0.8, -1.2, 1.2);
    if (scope === 'koc' && o.parts && j.part) {
      const mix = partMix(J, d, year, j.part);
      if (mix) { let s = 0; for (const p of PARTS) if (Number.isFinite(o.parts[p])) s += (mix[p] - (p === j.part ? 0.25 : 0)) * (o.parts[p] - o.perf); x += clamp(s * 0.24, -1.5, 1.5); }
    }
    if (o.me) {
      const ag = agentOf(J, d.key, false);
      if (ag) {
        const tr = d.tr;
        const pf = clamp((1.2 - tr.fair * 0.75) / 0.7, 0.5, 1.3);
        const pm = ag.pm || [];
        const last = pm[pm.length - 1];
        let y = ctr(ag, 'fo') / 100 * 0.9 * pf;
        if (last && o.perf - last[1] >= 8) y += 0.5;
        x += clamp(y, -1.2, 1.2);
      }
    }
    return x;
  } catch (e) { return 0; }
}
export function tableRecord(scope, judges, pts, o) {
  try {
    const st = activeState();
    const J = st && ensure(st);
    if (!J) return;
    const keys = judges.map((j) => descOfTable(J, scope, j).key);
    const decorated = judges.map((j, i) => ({ key: keys[i], name: j.name }));
    const per = pts.map((p) => ({ pts: p, max: o.max || 100 }));
    record(st, decorated, per, { me: true, day: st.day || 1, fs: o.fs, kind: o.kind || 'manzai', nh: o.nh || 0, ti: o.ti || '' }, null);
  } catch (e) { /* never blocks a contest */ }
}
