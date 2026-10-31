// ライフステージ (R30) — the player's own life stages as careers: 高校生 → 大学生 → 社会人 → 中年, each with its days (登校・出勤),
// its numbers (出席・通知表・単位・就活・査定・役職・健康), its events (行事・受験・卒業・入社・昇進・健康診断・同窓会・介護) and the
// six life stats (data: lifestage_data.js). 赤ちゃん・小学生・中学生 are played in 生い立ち (lifestage_origin.js); the children's
// stages and the 親キャリア are lifestage_kids.js; the 生活 screen that shows all of it is life_screen.js.
//
// Nothing here is forced on a player who ignores it: school and work days only remind (日課 = 'remind'), unless the player sets
// 「毎朝きく」 or 「自動で行く」 in the 生活 screen. Absences only lower the attendance / the evaluation; a company job is opt-in.
//
// State: g.state.flags.ls (lazy, repaired):
//   { v, made, stats { gaku tai kan yu sei ken }, high, uni, ronin, job, mid, routine { school, work }, today { day, did, school, work },
//     hist [{ d, a, t, k }], inbox [{ id, kind, title, text, choices, def, until, data }], origin, kids, parent, ledger [{ w, items }],
//     last { month, week, rank, age }, seq }
//   high = { type, entry (school year), club, cram, att { n, p }, tatt { n, p }, reports [], plan, exam, grad }
//   uni  = { kind ('koku'|'shi'), entry, load, credits, tcred, att, tatt, circle, zemi, shk { pts, offers [], chosen }, thesis, grad, loan }
//   job  = { ind, rank, pts, joined, wk { n, p }, streak, evals [], leave (有給 left), lastLeave }
//   mid  = { check { day, grade }, reunion, care }
// API (Game.prototype): lifeStage() lifeStats() lifeActions() lifeAct(id, o) lifeInbox() lifeRespond(id, i) lifeHistory()
//   lifeLedger() lifeRoutine(kind, mode) lifeCareer() lifeAddHist(t, k)    window.__ls (tests: tick, ensure, setRng, schoolDay, D)
import { Game } from './game.js';
import { onMorning, weekdayOf, weekOf } from './life.js';
import { ageOf, profileOf, YEAR_DAYS } from './profile.js';
import { clamp, fmtMoney } from './util.js';
import { RANKS, rankIndex, AGENCIES } from './state.js';
import { OFFICES } from './politics.js';
import * as D from './lifestage_data.js';

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (g, k) => !!g && typeof g[k] === 'function';
let rng = Math.random;
export function setLsRng(f) { rng = typeof f === 'function' ? f : Math.random; }
export const lsRand = () => rng();

// ---------------------------------------------------------------- dates
export function dateOf(g, day) {
  try { if (has(g, 'gameDate')) { const d = g.gameDate(day == null ? g.state.day : day); if (d && Number.isFinite(d.year)) return d; } } catch (e) { /* tests without politics */ }
  const dd = day == null ? num(g && g.state && g.state.day, 1) : day;
  const doy = (dd - 1) % 120;
  return { year: 2026 + Math.floor((dd - 1) / 120), month: Math.floor(doy / 10) + 1, dom: (doy % 10) * 3 + 1, doy };
}
export const yearNow = (g) => dateOf(g).year;
const dayOfMonth = (d) => num(d.dom, 1); // 1, 4, … 28

// ---------------------------------------------------------------- state
const DEF_STATS = (age) => ({ gaku: 30, tai: 45, kan: 30, yu: 35, sei: age >= 18 ? 35 : 20, ken: age >= 40 ? 66 : 82 });
export function ensure(g) {
  const st = g && g.state;
  if (!st || !st.flags) return null;
  let L = st.flags.ls;
  if (!isObj(L)) {
    const age = ageOf(st);
    L = st.flags.ls = { v: 1, made: num(st.day, 1), stats: DEF_STATS(age), routine: { school: 'remind', work: 'remind' }, today: { day: 0, did: {} }, hist: [], inbox: [], origin: { done: false }, kids: {}, parent: { pts: 0, log: [] }, ledger: [], last: {}, seq: 1, high: null, uni: null, ronin: null, job: null, mid: { check: null, reunion: 0, care: null } };
    // a little of who you already are: the skills show in the stats
    const sk = st.skills || {};
    L.stats.kan = clamp(L.stats.kan + Math.round((num(sk.uta) + num(sk.engi)) / 6), 0, 100);
    L.stats.yu = clamp(L.stats.yu + Math.round((num(sk.talk) + num(sk.warai)) / 6), 0, 100);
    if (age <= 17) L.high = newHigh(g, 'futsu', age);
    addHist(g, `${age}歳。ここから、この物語が始まった`, 'start');
  }
  // repair
  if (!isObj(L.stats)) L.stats = DEF_STATS(ageOf(st));
  for (const k of D.STAT_ORDER) L.stats[k] = clamp(Math.round(num(L.stats[k], 40)), 0, 100);
  if (!isObj(L.routine)) L.routine = { school: 'remind', work: 'remind' };
  if (!isObj(L.today)) L.today = { day: 0, did: {} };
  if (!isObj(L.today.did)) L.today.did = {};
  for (const k of ['hist', 'inbox', 'ledger']) if (!Array.isArray(L[k])) L[k] = [];
  if (!isObj(L.origin)) L.origin = { done: false };
  if (!isObj(L.kids)) L.kids = {};
  if (!isObj(L.parent)) L.parent = { pts: 0, log: [] };
  if (!Array.isArray(L.parent.log)) L.parent.log = [];
  if (!isObj(L.last)) L.last = {};
  if (!isObj(L.mid)) L.mid = { check: null, reunion: 0, care: null };
  if (L.hist.length > 160) L.hist.splice(0, L.hist.length - 160);
  if (L.ledger.length > 10) L.ledger.splice(0, L.ledger.length - 10);
  return L;
}
function newHigh(g, type, age) {
  const sy = D.schoolYearOf(dateOf(g));
  const grade = clamp(num(age, 15) - 14, 1, 3);
  return { type: D.HIGH_TYPES[type] ? type : 'futsu', entry: sy - (grade - 1), club: null, cram: false, att: { n: 0, p: 0 }, tatt: { n: 0, p: 0 }, reports: [], plan: null, exam: null, grad: false };
}
function newUni(g, kind) {
  const sy = D.schoolYearOf(dateOf(g)) + (dateOf(g).month >= 4 ? 0 : 1);
  return { kind: kind === 'koku' ? 'koku' : 'shi', entry: sy, load: 'normal', credits: 0, tcred: 0, att: { n: 0, p: 0 }, tatt: { n: 0, p: 0 }, circle: null, zemi: false, shk: { pts: 0, offers: [], chosen: null }, thesis: 0, grad: false, loan: { total: 0, left: 0 }, started: false };
}

// ---------------------------------------------------------------- history (年表)
export function addHist(g, t, k = 'life', o = {}) {
  const st = g.state, L = st.flags.ls;
  if (!L || !Array.isArray(L.hist)) return;
  L.hist.push({ d: num(o.day, st.day), a: num(o.age, ageOf(st)), t: String(t), k });
}

// ---------------------------------------------------------------- stats
export function gain(L, g0, mult = 1) {
  const out = [];
  for (const k of D.STAT_ORDER) {
    const v = num(g0 && g0[k]);
    if (!v) continue;
    const before = L.stats[k];
    let dv;
    if (v > 0) { const f = clamp(1 - before / 125, 0.12, 1), x = v * mult * f; dv = Math.floor(x) + (rng() < x % 1 ? 1 : 0); }
    else dv = Math.round(v * mult);
    L.stats[k] = clamp(before + dv, 0, 100);
    const d = L.stats[k] - before;
    if (d) out.push(`${D.STATS[k].name}${d > 0 ? '+' : ''}${d}`);
  }
  return out;
}
const statWord = (k, adult) => (adult ? D.STATS[k].adult : D.STATS[k].name);

// ---------------------------------------------------------------- the stage you are in
export function stageOf(g) {
  const L = ensure(g);
  if (!L) return 'work';
  const age = ageOf(g.state);
  if (L.high && !L.high.grad) return 'high';
  if (L.uni && !L.uni.grad && !L.uni.quit) return 'uni';
  if (age >= 65) return 'senior';
  if (age >= 40) return 'middle';
  return 'work';
}
export const highGrade = (g, H) => clamp(D.schoolYearOf(dateOf(g)) - H.entry + 1, 1, 9);
export const uniGrade = (g, U) => clamp(D.schoolYearOf(dateOf(g)) - U.entry + 1, 1, 9);
export function stageLabel(g) {
  const L = ensure(g), s = stageOf(g);
  if (s === 'high') return `${D.HIGH_TYPES[L.high.type].name}の${Math.min(3, highGrade(g, L.high))}年生`;
  if (s === 'uni') return L.uni.started ? `大学${uniGrade(g, L.uni)}年生（${L.uni.kind === 'koku' ? '国公立' : '私立'}）` : '大学の入学待ち';
  if (L.ronin) return '浪人生（予備校）';
  if (L.pendingInd && !L.job) return `${D.INDUSTRIES[L.pendingInd].name}に入社予定`;
  if (L.job) return `${D.INDUSTRIES[L.job.ind].name}の${L.job.rehire ? '嘱託（再雇用）' : D.CO_RANKS[L.job.rank].name}`;
  if (s === 'senior') return L.pension ? 'シニア（年金ぐらし）' : 'シニア';
  return s === 'middle' ? '中年（働きざかり）' : '社会人';
}

// ---------------------------------------------------------------- school and work days
function inBreakSchool(d) {
  const m = d.month, dm = dayOfMonth(d);
  if (m === 8) return '夏休み';
  if ((m === 12 && dm >= 25) || (m === 1 && dm < 7)) return '冬休み';
  if ((m === 3 && dm >= 22) || (m === 4 && dm < 7)) return '春休み';
  return null;
}
function inBreakUni(d) {
  const m = d.month, dm = dayOfMonth(d);
  if (m === 8 || m === 9) return '夏休み';
  if (m === 2 || m === 3) return '春休み';
  if ((m === 12 && dm >= 25) || (m === 1 && dm < 7)) return '冬休み';
  return null;
}
// → null | { kind: 'school'|'uni'|'work', label, start (minute), end (minute) }
export function dutyOf(g, day) {
  const L = ensure(g);
  if (!L) return null;
  const dd = day == null ? g.state.day : day;
  const d = dateOf(g, dd), wd = weekdayOf(dd), s = stageOf(g);
  if (s === 'high') {
    const H = L.high, T = D.HIGH_TYPES[H.type];
    if (inBreakSchool(d)) return null;
    if (T.days === 2) return wd === 1 || wd === 3 ? { kind: 'school', label: 'スクーリング', start: 540, end: 930 } : null;
    if (wd <= 4) return { kind: 'school', label: '学校', start: 510, end: 930 };
    if (wd === 5 && D.saturdayClass(d.year, weekOf(dd))) return { kind: 'school', label: '学校（土曜・半日）', start: 510, end: 750, half: true };
    return null;
  }
  if (s === 'uni' && L.uni.started) {
    if (inBreakUni(d)) return null;
    const days = L.uni.load === 'light' ? [1, 3] : L.uni.load === 'heavy' ? [0, 1, 2, 3, 4] : [0, 2, 4];
    return days.includes(wd) ? { kind: 'uni', label: '大学の授業', start: 540, end: 990 } : null;
  }
  if (L.job && wd <= 4) {
    const I = D.INDUSTRIES[L.job.ind];
    return { kind: 'work', label: '会社', start: 540, end: 540 + I.hours };
  }
  return null;
}
export function breakOf(g) {
  const L = ensure(g), s = stageOf(g), d = dateOf(g);
  if (s === 'high') return inBreakSchool(d);
  if (s === 'uni') return inBreakUni(d);
  return null;
}

// ---------------------------------------------------------------- the inbox: choices that wait for you in the 生活 screen
const HANDLERS = {};
export function onInbox(kind, fn) { HANDLERS[kind] = fn; }
export function addInbox(g, item) {
  const L = ensure(g);
  if (!L) return null;
  if (item.key && L.inbox.some((x) => x.key === item.key)) return null;
  const it = { id: `in${L.seq++}`, day: g.state.day, until: g.state.day + num(item.days, 10), def: num(item.def, item.choices ? item.choices.length - 1 : 0), ...item };
  delete it.days;
  L.inbox.push(it);
  if (L.inbox.length > 12) L.inbox.splice(0, L.inbox.length - 12);
  return it;
}
export function respond(g, id, idx, quiet = false) {
  const L = ensure(g);
  const i = L ? L.inbox.findIndex((x) => x.id === id) : -1;
  if (i < 0) return { ok: false, text: 'もう、おわった話だ。' };
  const it = L.inbox[i];
  L.inbox.splice(i, 1);
  const fn = HANDLERS[it.kind];
  let text = '';
  try { text = fn ? fn(g, it, clamp(num(idx, it.def), 0, Math.max(0, (it.choices || []).length - 1)), quiet) || '' : ''; } catch (e) { console.error('[ls] inbox', it.kind, e); }
  return { ok: true, text: String(text) };
}
const pushNote = (g, t) => { (g.morningNotes || (g.morningNotes = [])).push(t); };

// ---------------------------------------------------------------- player actions
// each: { id, name, group, when(g, L) → '' | reason (locked) | null (hidden), sub(g, L) → cost line, run(g, L, o) → text }
const ACTS = [];
const act = (def) => ACTS.push(def);
const did = (L, id) => num(L.today.did[id]);
const mark = (L, id) => { L.today.did[id] = did(L, id) + 1; };
const clockMin = (g) => { try { const c = has(g, 'clock') ? g.clock() : null; return c && Number.isFinite(c.total) ? c.total : 540; } catch (e) { return 540; } };
const passTo = (g, m, why) => { try { if (has(g, 'advanceTo')) g.advanceTo(m, why); } catch (e) { /* tests */ } };
const passFor = (g, min, why) => { try { if (has(g, 'advanceTime')) g.advanceTime(min, why); } catch (e) { /* tests */ } };
const tired = (g, n) => { if (g.state.stamina < n) return `体力が足りない（${n}必要）`; return ''; };
const useSt = (g, n) => { g.state.stamina = Math.max(0, g.state.stamina - n); };
const stress = (g, n) => { try { if (n > 0) g.addNeed('stress', n); else g.relax({ stress: -n }); } catch (e) { /* tests */ } };
const hunger = (g, n) => { try { g.addNeed('hunger', -n); } catch (e) { /* tests */ } };
const skillUp = (g, key, chance) => (key && rng() < chance ? (g.addSkill(key, 1, true), [`${({ warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' })[key] || key}+1`]) : []);
const joinG = (a) => (a.length ? `（${a.join('　')}）` : '');

function attendSchool(g, L, auto = false) {
  const s = stageOf(g), du = dutyOf(g);
  if (!du || (du.kind !== 'school' && du.kind !== 'uni')) return { ok: false, text: '今日は授業がない日だ。' };
  if (L.today.school) return { ok: false, text: '今日は、もう行ってきた。' };
  const now = clockMin(g);
  if (now >= du.end - 120) return { ok: false, text: '今からでは、もう授業に間にあわない…' };
  const late = now > du.start + 60;
  const n = du.half ? 7 : 12;
  if (g.state.stamina < n) return { ok: false, text: tired(g, n) };
  useSt(g, n); hunger(g, 6);
  passTo(g, du.end, du.kind === 'uni' ? 'uni' : 'school');
  L.today.school = late ? 'late' : 'present';
  const T = s === 'high' ? D.HIGH_TYPES[L.high.type] : { gain: 1 };
  const rec = s === 'high' ? L.high : L.uni;
  rec.att.p++; rec.tatt.p++;
  const gs = gain(L, { gaku: du.half ? 1 : 2, yu: 1, ...(T.sei ? { sei: 1 } : {}) }, T.gain || 1);
  stress(g, du.half ? 1 : 3);
  const where = du.kind === 'uni' ? '大学の授業に出た' : du.label === 'スクーリング' ? 'スクーリングに行ってきた' : '学校に行ってきた';
  return { ok: true, text: `${auto ? '（日課）' : ''}${where}${late ? '（遅刻…）' : ''}。${joinG(gs)}` };
}
function goWork(g, L, auto = false) {
  const du = dutyOf(g);
  if (!du || du.kind !== 'work') return { ok: false, text: '今日は休みの日だ。' };
  if (L.today.work) return { ok: false, text: '今日は、もう出勤した。' };
  const now = clockMin(g);
  if (now > du.start + 120) return { ok: false, text: '今から出勤しても、遅すぎる…（有給をとるなら、生活画面から）' };
  const I = D.INDUSTRIES[L.job.ind];
  const n = Math.round(18 * I.strain);
  if (g.state.stamina < n) return { ok: false, text: tired(g, n) };
  useSt(g, n); hunger(g, 10);
  passTo(g, du.end, 'work');
  L.today.work = 'present';
  L.job.wk.p++;
  L.job.streak = 0;
  L.job.pts += 0.35 + L.stats[I.stat] / 400;
  const gs = gain(L, { [I.stat]: 1, sei: rng() < 0.3 ? 1 : 0 });
  stress(g, Math.round(6 * I.strain));
  return { ok: true, text: `${auto ? '（日課）' : ''}会社で一日、働いた。${joinG(gs)}` };
}

act({ id: 'school', name: '学校へ行く', group: 'day',
  when: (g, L) => { const s = stageOf(g); if (s !== 'high' && !(s === 'uni' && L.uni.started)) return null; const du = dutyOf(g); if (!du) return `今日は休み（${breakOf(g) || '休日'}）`; return L.today.school ? '今日は、もう行った' : ''; },
  name2: (g) => (stageOf(g) === 'uni' ? '大学の授業に出る' : dutyOf(g) && dutyOf(g).label === 'スクーリング' ? 'スクーリングに行く' : '学校へ行く'),
  sub: (g) => { const du = dutyOf(g); return du ? `${hm(du.start)}〜${hm(du.end)}・体力 -${du.half ? 7 : 12}・学力と友情が伸びる` : ''; },
  run: (g, L) => attendSchool(g, L).text });
act({ id: 'work', name: '出勤する', group: 'day',
  when: (g, L) => { if (!L.job) return null; const du = dutyOf(g); if (!du) return '今日は会社が休み'; return L.today.work ? (L.today.work === 'leave' ? '今日は有給休暇' : '今日は、もう出勤した') : ''; },
  sub: (g, L) => { const du = dutyOf(g); return du && L.job ? `${hm(du.start)}〜${hm(du.end)}・体力 -${Math.round(18 * D.INDUSTRIES[L.job.ind].strain)}・評価と給料` : ''; },
  run: (g, L) => goWork(g, L).text });
act({ id: 'overtime', name: '残業する', group: 'day',
  when: (g, L) => { if (!L.job) return null; if (L.today.work !== 'present') return '出勤した日だけ'; if (did(L, 'overtime')) return '今日は、もう残業した'; return tired(g, 8); },
  sub: (g, L) => `2時間・体力 -8・ストレス +6・評価 少し・残業代 ${fmtMoney(Math.round(D.CO_RANKS[L.job.rank].pay * 0.06))}`,
  run: (g, L) => {
    mark(L, 'overtime'); useSt(g, 8); stress(g, 6); passFor(g, 120, 'overtime');
    L.job.pts += 0.3; const pay = Math.round(D.CO_RANKS[L.job.rank].pay * 0.06 * D.INDUSTRIES[L.job.ind].pay);
    g.addMoney(pay, true);
    const yr = yearNow(g);
    return `残業して、仕事を片づけた。（残業代 ${fmtMoney(pay)}）${yr >= 2019 ? '\n（働き方改革で、残業には上限がある。ほどほどに）' : yr <= 1991 ? '\n（「24時間働けますか」の時代。まわりも、まだ残っている）' : ''}`;
  } });
act({ id: 'leave', name: '有給休暇をとる', group: 'day',
  when: (g, L) => { if (!L.job) return null; const du = dutyOf(g); if (!du) return '今日は会社が休み'; if (L.today.work) return '今日は、もう決まっている'; return L.job.leave > 0 ? '' : '有給が残っていない'; },
  sub: (g, L) => `残り ${L.job ? L.job.leave : 0}日・休んでも欠勤にならない`,
  run: (g, L) => { L.job.leave--; L.today.work = 'leave'; L.job.lastLeave = g.state.day; stress(g, -6); return `有給休暇をとった。今日は自由に使える。（残り ${L.job.leave}日）`; } });
act({ id: 'study', name: '勉強する', group: 'grow',
  when: (g, L) => (did(L, 'study') >= 2 ? '今日は、もう十分勉強した' : tired(g, 8)),
  name2: (g, L) => (stageOf(g) === 'work' || stageOf(g) === 'middle' ? (L.ronin ? '予備校で勉強する' : '本を読んで学ぶ') : '勉強する'),
  sub: (g, L) => `1時間半・体力 -8・${statWord('gaku', !L.high && !L.uni && !L.ronin)}が伸びる${(L.high && L.high.cram) || L.ronin ? '（塾の分 +1）' : ''}`,
  run: (g, L) => {
    mark(L, 'study'); useSt(g, 8); passFor(g, 90, 'study'); stress(g, 2);
    const extra = (L.high && L.high.cram) || L.ronin ? 1 : 0;
    const gs = gain(L, { gaku: 2 + extra }, stageOf(g) === 'high' ? D.HIGH_TYPES[L.high.type].gain : 1);
    if (L.high) L.high.study = num(L.high.study) + 1;
    if (L.ronin) L.ronin.study = num(L.ronin.study) + 1;
    return `机に向かって、集中した。${joinG(gs)}`;
  } });
act({ id: 'club', name: '部活に出る', group: 'grow',
  when: (g, L) => { if (stageOf(g) !== 'high' || D.HIGH_TYPES[L.high.type].days < 5) return null; if (!L.high.club) return '部活を決めていない（下の「部活をえらぶ」）'; if (D.CLUBS[L.high.club].none) return null; if (did(L, 'club')) return '今日は、もう出た'; if (breakOf(g) !== '夏休み' && !L.today.school) return '学校に行った日の放課後に'; return tired(g, 10); },
  name2: (g, L) => `${D.CLUBS[L.high.club] ? D.CLUBS[L.high.club].name : '部活'}に出る`,
  sub: () => '2時間・体力 -10・部活の能力が伸びる',
  run: (g, L) => { const C = D.CLUBS[L.high.club]; mark(L, 'club'); useSt(g, 10); hunger(g, 8); passFor(g, 120, 'club'); stress(g, -3); const gs = gain(L, C.g).concat(skillUp(g, C.skill, 0.18)); L.high.clubN = num(L.high.clubN) + 1; return `${C.name}で、汗を流した。${joinG(gs)}`; } });
act({ id: 'clubpick', name: '部活をえらぶ', group: 'set',
  when: (g, L) => (stageOf(g) === 'high' && D.HIGH_TYPES[L.high.type].days === 5 ? '' : null),
  sub: (g, L) => (L.high && L.high.club ? `いま：${D.CLUBS[L.high.club].name}` : 'まだ決めていない'),
  pick: () => ({ title: '入る部活', items: D.CLUB_ORDER.map((id) => ({ label: D.CLUBS[id].name, sub: Object.entries(D.CLUBS[id].g).map(([k, v]) => `${D.STATS[k].name}+${v}`).join(' ') + (D.CLUBS[id].skill ? `・${({ warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' })[D.CLUBS[id].skill]}も` : '') || '放課後は自由' })) }),
  run: (g, L, o) => { const id = D.CLUB_ORDER[clamp(num(o && o.pick), 0, D.CLUB_ORDER.length - 1)]; const before = L.high.club; L.high.club = id; if (before !== id) addHist(g, `${D.CLUBS[id].name}に${D.CLUBS[id].none ? 'なった' : '入った'}`, 'school'); return `${D.CLUBS[id].name}${D.CLUBS[id].none ? 'になった。放課後は自由だ' : 'に入った！'}`; } });
act({ id: 'circle', name: 'サークルに顔を出す', group: 'grow',
  when: (g, L) => { if (stageOf(g) !== 'uni' || !L.uni.started) return null; if (!L.uni.circle) return 'サークルを決めていない（下の「サークルをえらぶ」）'; if (D.CIRCLES[L.uni.circle].none) return null; if (did(L, 'circle')) return '今日は、もう行った'; return tired(g, 6); },
  name2: (g, L) => `${D.CIRCLES[L.uni.circle] ? D.CIRCLES[L.uni.circle].name : 'サークル'}に行く`,
  sub: () => '2時間・体力 -6・¥1,000・仲間ができる',
  run: (g, L) => { const C = D.CIRCLES[L.uni.circle]; mark(L, 'circle'); useSt(g, 6); passFor(g, 120, 'circle'); g.spend(1000); stress(g, -6); const gs = gain(L, C.g).concat(skillUp(g, C.skill, 0.2)); return `${C.name}のみんなと過ごした。${joinG(gs)}`; } });
act({ id: 'circlepick', name: 'サークルをえらぶ', group: 'set',
  when: (g, L) => (stageOf(g) === 'uni' && L.uni.started ? '' : null),
  sub: (g, L) => (L.uni && L.uni.circle ? `いま：${D.CIRCLES[L.uni.circle].name}` : 'まだ決めていない'),
  pick: () => ({ title: '入るサークル', items: D.CIRCLE_ORDER.map((id) => ({ label: D.CIRCLES[id].name, sub: Object.entries(D.CIRCLES[id].g).map(([k, v]) => `${D.STATS[k].name}+${v}`).join(' ') || '入らない' })) }),
  run: (g, L, o) => { const id = D.CIRCLE_ORDER[clamp(num(o && o.pick), 0, D.CIRCLE_ORDER.length - 1)]; L.uni.circle = id; if (!D.CIRCLES[id].none) addHist(g, `大学で${D.CIRCLES[id].name}に入った`, 'school'); return D.CIRCLES[id].none ? 'サークルには入らないことにした。' : `${D.CIRCLES[id].name}に入った！`; } });
act({ id: 'load', name: '履修の量をきめる', group: 'set',
  when: (g, L) => (stageOf(g) === 'uni' && L.uni.started ? '' : null),
  sub: (g, L) => `いま：${({ light: 'ゆるめ（週2日・16単位）', normal: 'ふつう（週3日・20単位）', heavy: 'がっつり（週5日・26単位）' })[L.uni.load]}`,
  pick: () => ({ title: '履修の量（前期・後期ごとにとれる単位）', items: [{ label: 'ゆるめ', sub: '週2日・最大16単位' }, { label: 'ふつう', sub: '週3日・最大20単位' }, { label: 'がっつり', sub: '週5日・最大26単位' }] }),
  run: (g, L, o) => { L.uni.load = ['light', 'normal', 'heavy'][clamp(num(o && o.pick), 0, 2)]; return `履修を「${({ light: 'ゆるめ', normal: 'ふつう', heavy: 'がっつり' })[L.uni.load]}」にした。卒業には124単位が必要だ。`; } });
act({ id: 'cram', name: '塾に通う', group: 'set',
  when: (g, L) => (stageOf(g) === 'high' ? '' : null),
  name2: (g, L) => (L.high.cram ? '塾をやめる' : '塾に通う'),
  sub: (g, L) => (L.high.cram ? 'いま通っている（週 ¥3,000）' : '週 ¥3,000・勉強の効果 +1'),
  run: (g, L) => { L.high.cram = !L.high.cram; if (L.high.cram) addHist(g, '塾に通いはじめた', 'school'); return L.high.cram ? '塾に通うことにした。（月曜に週の月謝 ¥3,000）' : '塾をやめた。'; } });
act({ id: 'friends', name: '友だちと遊ぶ', group: 'grow',
  when: (g, L) => (did(L, 'friends') ? '今日は、もう遊んだ' : tired(g, 6)),
  name2: (g) => (ageOf(g.state) >= 22 ? '友人と会う' : '友だちと遊ぶ'),
  sub: () => '2時間・体力 -6・¥1,500・ストレス -12',
  run: (g, L) => {
    mark(L, 'friends'); useSt(g, 6); passFor(g, 120, 'friends');
    if (!g.spend(1500)) return 'お金が足りない…。公園で、ただしゃべって過ごした。（ストレス -6）' + (stress(g, -6), '');
    stress(g, -12);
    const gs = gain(L, { yu: 2 });
    const yr = yearNow(g), a = ageOf(g.state);
    const where = a < 18 ? (yr >= 2012 ? ['ファストフード店でおしゃべり', 'カラオケ', 'ショッピングモール'] : yr >= 1995 ? ['カラオケ', 'プリクラを撮りに', 'ファストフード店'] : ['喫茶店でおしゃべり', 'ゲームセンター', 'ボウリング']) : ['居酒屋', '映画', 'カフェでゆっくり'];
    return `${where[Math.floor(rng() * where.length)]}で、楽しく過ごした。${joinG(gs)}`;
  } });
act({ id: 'parttime', name: 'アルバイトする', group: 'grow',
  when: (g, L) => { const s = stageOf(g); if (L.job) return null; if (!D.PART_TIME[ptKey(s)]) return null; if (did(L, 'parttime')) return '今日は、もうシフトに入った'; return tired(g, 12); },
  sub: (g) => { const P = D.PART_TIME[ptKey(stageOf(g))]; return `${P.min / 60}時間・体力 -12・${fmtMoney(P.pay)}・生活力`; },
  run: (g, L) => { const P = D.PART_TIME[ptKey(stageOf(g))]; mark(L, 'parttime'); useSt(g, 12); hunger(g, 8); passFor(g, P.min, 'parttime'); stress(g, 4); g.addMoney(P.pay, true); const gs = gain(L, { sei: 1, yu: rng() < 0.4 ? 1 : 0 }); const yr = yearNow(g); const job = yr >= 1995 ? ['コンビニのレジ', '飲食店のホール', '倉庫の仕分け'] : ['喫茶店のウェイター', '新聞配達', '家庭教師']; return `${job[Math.floor(rng() * job.length)]}のアルバイト。（${fmtMoney(P.pay)}）${joinG(gs)}`; } });
act({ id: 'shukatsu', name: '就職活動をする', group: 'grow',
  when: (g, L) => { if (L.job) return null; const s = stageOf(g); if (s === 'high') return null; if (L.pendingInd) return `${D.INDUSTRIES[L.pendingInd].name}に4月から入社する`; if (s === 'uni') { const ph = shukatsuPhase(g, L.uni); if (!ph) return `就活はまだ先（${D.shukatsuRule(yearNow(g)).text}）`; } if (did(L, 'shukatsu')) return '今日は、もう動いた'; return tired(g, 10); },
  name2: (g) => (stageOf(g) === 'uni' ? '就活（説明会・面接）' : '会社をさがす（中途採用）'),
  sub: () => '2時間・体力 -10・交通費 ¥1,000・内定に近づく',
  run: (g, L) => {
    mark(L, 'shukatsu'); useSt(g, 10); passFor(g, 120, 'shukatsu'); g.spend(1000); stress(g, 5);
    const S = stageOf(g) === 'uni' ? L.uni.shk : (L.shk = isObj(L.shk) ? L.shk : { pts: 0, offers: [], chosen: null });
    const p = 2 + (L.stats.gaku + L.stats.yu + L.stats.sei) / 60;
    S.pts = num(S.pts) + p;
    const mk = D.jobMarket(yearNow(g));
    // a chance of an offer once enough is done (a 中途 search makes its own offers here; students wait for the season)
    if (stageOf(g) !== 'uni' && S.pts >= 6 && rng() < 0.22 * mk.k) makeOffer(g, L, S, false);
    const steps = ['会社説明会に出た', 'エントリーシートを書いた', '面接を受けた', 'OB・OG訪問をした'];
    return `${steps[Math.floor(rng() * steps.length)]}。（就活の手ごたえ ${Math.round(S.pts)}）${stageOf(g) === 'uni' ? `\n（${mk.name}）` : ''}`;
  } });
act({ id: 'thesis', name: '卒業論文を書く', group: 'grow',
  when: (g, L) => { if (stageOf(g) !== 'uni' || !L.uni.started) return null; if (uniGrade(g, L.uni) < 4) return '4年生になってから'; if (L.uni.thesis >= 100) return '卒論は書きあがった'; if (did(L, 'thesis')) return '今日は、もう書いた'; return tired(g, 10); },
  sub: (g, L) => `3時間・体力 -10・いま ${L.uni ? L.uni.thesis : 0}%`,
  run: (g, L) => { mark(L, 'thesis'); useSt(g, 10); passFor(g, 180, 'thesis'); stress(g, 4); const p = Math.round(7 + L.stats.gaku / 14); L.uni.thesis = Math.min(100, L.uni.thesis + p); gain(L, { gaku: 1 }); if (L.uni.thesis >= 100) addHist(g, '卒業論文を書きあげた', 'school'); return L.uni.thesis >= 100 ? '卒業論文が、書きあがった！' : `卒論を書きすすめた。（${L.uni.thesis}%）`; } });
act({ id: 'exercise', name: '運動する', group: 'grow',
  when: (g, L) => (ageOf(g.state) < 18 ? null : did(L, 'exercise') ? '今日は、もう体を動かした' : tired(g, 8)),
  name2: (g) => (ageOf(g.state) >= 60 ? '散歩・体操をする' : '運動する'),
  sub: (g) => `1時間・体力 -8・健康 +2${ageOf(g.state) >= 40 ? '（年を重ねるほど健康が大事）' : ''}`,
  run: (g, L) => { mark(L, 'exercise'); useSt(g, 8); passFor(g, 60, 'exercise'); stress(g, -5); const gs = gain(L, { ken: 2, tai: rng() < 0.5 ? 1 : 0 }); const w = ageOf(g.state) >= 40 ? ['ウォーキング', 'スポーツジム', 'ラジオ体操と散歩'] : ['ジョギング', 'スポーツジム', '自転車']; return `${w[Math.floor(rng() * w.length)]}で、いい汗をかいた。${joinG(gs)}`; } });
act({ id: 'housework', name: '家事をする', group: 'grow',
  when: (g, L) => (ageOf(g.state) < 18 ? null : did(L, 'housework') ? '今日は、もう片づけた' : tired(g, 4)),
  sub: () => '45分・体力 -4・生活力 +2・身だしなみ +5',
  run: (g, L) => { mark(L, 'housework'); useSt(g, 4); passFor(g, 45, 'housework'); stress(g, -2); try { g.addNeed('clean', 5); } catch (e) { /* tests */ } const gs = gain(L, { sei: 2 }); return `そうじ・洗たく・買い出し。部屋がすっきりした。${joinG(gs)}`; } });
act({ id: 'checkup', name: '人間ドックを受ける', group: 'grow',
  when: (g, L) => (ageOf(g.state) < 35 ? null : L.mid.dock && g.state.day - L.mid.dock < YEAR_DAYS ? '今年は、もう受けた' : g.state.money < 12000 ? `お金が足りない（${fmtMoney(12000)}）` : ''),
  sub: () => `${fmtMoney(12000)}・年に1回・体をくわしく調べる`,
  run: (g, L) => { g.spend(12000); L.mid.dock = g.state.day; passFor(g, 240, 'dock'); const gr = checkGrade(L); gain(L, { ken: 3 }); addHist(g, `人間ドックを受けた（判定 ${gr}）`, 'health'); return `人間ドックを受けた。判定は「${gr}」。\n${gr <= 'B' ? 'おおむね良好。この調子で。' : '気になるところを早めに見てもらった。生活を見直そう。'}（健康+3）`; } });
act({ id: 'routine', name: '日課の設定', group: 'set',
  when: (g, L) => (dutyKindNow(g) ? '' : null),
  sub: (g, L) => { const k = dutyKindNow(g); return `いま：${ROUTINE_NAMES[L.routine[k]] || '知らせるだけ'}`; },
  pick: (g) => ({ title: dutyKindNow(g) === 'work' ? '会社の日の朝' : '授業のある日の朝', items: [{ label: '知らせるだけ', sub: '朝にひとこと。自分で生活画面から行く' }, { label: '毎朝きく', sub: '起きたら「行く？休む？」と聞く' }, { label: '自動で行く', sub: '起きたら、そのまま行って帰ってくる（時間が進む）' }] }),
  run: (g, L, o) => { const k = dutyKindNow(g); L.routine[k] = ['remind', 'ask', 'auto'][clamp(num(o && o.pick), 0, 2)]; return `日課を「${ROUTINE_NAMES[L.routine[k]]}」にした。`; } });
act({ id: 'enroll', name: '大学を受験する', group: 'set',
  when: (g, L) => { if (stageOf(g) === 'high' || stageOf(g) === 'uni' || L.ronin) return null; if (ageOf(g.state) > 45) return null; return L.exam ? `受験の準備中（${L.exam.label}）` : ''; },
  sub: (g) => `2月の試験に向けて準備（${D.entranceTest(yearNow(g) + (dateOf(g).month >= 2 ? 1 : 0))}など）`,
  pick: () => ({ title: 'どこを受ける？', items: [{ label: '国公立大学', sub: '学費が安い。合格は学力しだい（きびしめ）' }, { label: '私立大学', sub: '学費は高め。国公立より合格しやすい' }] }),
  run: (g, L, o) => { const kind = num(o && o.pick) === 0 ? 'koku' : 'shi'; L.exam = { kind, label: kind === 'koku' ? '国公立大学' : '私立大学', day: g.state.day }; return `${L.exam.label}を受けることにした。2月に試験がある。それまで「勉強する」で学力を上げておこう。`; } });
act({ id: 'quitjob', name: '会社をやめる', group: 'set',
  when: (g, L) => (L.job ? '' : null),
  sub: (g, L) => `いま：${D.INDUSTRIES[L.job.ind].name}・${D.CO_RANKS[L.job.rank].name}`,
  pick: () => ({ title: 'ほんとうに会社をやめる？', items: [{ label: 'やめる', sub: '給料はなくなる。あとで「会社をさがす」から再就職できる' }, { label: 'やめない', sub: '' }] }),
  run: (g, L, o) => { if (num(o && o.pick) !== 0) return 'もう少し、がんばってみることにした。'; const j = L.job; addHist(g, `${D.INDUSTRIES[j.ind].name}を退職した（${D.CO_RANKS[j.rank].name}）`, 'work'); L.job = null; return '会社をやめた。新しい道を、さがそう。'; } });
act({ id: 'uniquit', name: '大学をやめる', group: 'set',
  when: (g, L) => (stageOf(g) === 'uni' && L.uni.started ? '' : null),
  sub: (g, L) => `いま ${L.uni.credits}単位`,
  pick: () => ({ title: 'ほんとうに大学をやめる？', items: [{ label: 'やめる（中退）', sub: '社会人として、別の道に進む' }, { label: 'やめない', sub: '' }] }),
  run: (g, L, o) => { if (num(o && o.pick) !== 0) return 'もう少し、続けてみることにした。'; L.uni.quit = true; addHist(g, `大学を中退した（${L.uni.credits}単位）`, 'school'); return '大学をやめた。ここからは、社会人だ。'; } });
act({ id: 'hobbypick', name: '趣味の教室をえらぶ', group: 'set',
  when: (g) => (ageOf(g.state) >= 55 ? '' : null),
  sub: (g, L) => (L.hobby ? `いま：${D.HOBBIES[L.hobby].name}` : 'まだ決めていない'),
  pick: () => ({ title: '通う趣味の教室', items: D.HOBBY_ORDER.map((id) => ({ label: D.HOBBIES[id].name, sub: Object.entries(D.HOBBIES[id].g).map(([k, v]) => `${D.STATS[k].name}+${v}`).join(' ') })) }),
  run: (g, L, o) => { const id = D.HOBBY_ORDER[clamp(num(o && o.pick), 0, D.HOBBY_ORDER.length - 1)]; if (L.hobby !== id) addHist(g, `${D.HOBBIES[id].name}の教室に通いはじめた`, 'life'); L.hobby = id; return `${D.HOBBIES[id].name}の教室に通うことにした。`; } });
act({ id: 'hobby', name: '趣味の教室に行く', group: 'grow',
  when: (g, L) => { if (ageOf(g.state) < 55) return null; if (!L.hobby) return '教室を決めていない（「趣味の教室をえらぶ」）'; if (did(L, 'hobby')) return '今日は、もう行った'; return tired(g, 5); },
  name2: (g, L) => (L.hobby ? `${D.HOBBIES[L.hobby].name}の教室に行く` : '趣味の教室に行く'),
  sub: () => '2時間・体力 -5・¥1,000・仲間ができる',
  run: (g, L) => { const H = D.HOBBIES[L.hobby]; mark(L, 'hobby'); useSt(g, 5); passFor(g, 120, 'hobby'); g.spend(1000); stress(g, -8); const gs = gain(L, H.g); return `${H.name}の教室で、仲間と楽しい時間を過ごした。${joinG(gs)}`; } });
act({ id: 'volunteer', name: '地域のボランティアに出る', group: 'grow',
  when: (g, L) => (ageOf(g.state) < 55 ? null : did(L, 'volunteer') ? '今日は、もう出た' : tired(g, 6)),
  sub: () => '2時間・体力 -6・人望と生活力',
  run: (g, L) => { mark(L, 'volunteer'); useSt(g, 6); passFor(g, 120, 'volunteer'); stress(g, -6); const gs = gain(L, { yu: 2, sei: 1 }); const w = ['通学路の見守り', '公園のそうじ', '子ども食堂の手伝い', '町内会のお祭りの準備']; return `${w[Math.floor(rng() * w.length)]}に参加した。「いつもありがとうございます」と声をかけられた。${joinG(gs)}`; } });
act({ id: 'grandkid', name: '孫と遊ぶ', group: 'grow',
  when: (g, L) => (!(L.grand || []).length ? null : did(L, 'grandkid') ? '今日は、もう遊んだ' : tired(g, 5)),
  sub: (g, L) => `1時間・体力 -5・ストレス -10・孫 ${(L.grand || []).length}人`,
  run: (g, L) => { mark(L, 'grandkid'); useSt(g, 5); passFor(g, 60, 'grandkid'); stress(g, -10); const gk = L.grand[Math.floor(rng() * L.grand.length)]; const a = Math.floor((g.state.day - gk.b) / YEAR_DAYS); const gs = gain(L, { yu: 1, ken: 1 }); return `${a < 3 ? `${gk.n}を抱っこして、ゆらゆら。小さな手が、指をぎゅっとにぎる。` : a < 10 ? `${gk.n}と、公園でかくれんぼ。「みーつけた！」` : `${gk.n}と、お茶を飲みながら学校の話を聞いた。`}${joinG(gs)}`; } });
act({ id: 'jibunshi', name: '自分史を書く', group: 'grow',
  when: (g, L) => (ageOf(g.state) < 60 ? null : did(L, 'jibunshi') ? '今日は、もう書いた' : tired(g, 3)),
  sub: (g, L) => `1時間・体力 -3・感性・いま ${num(L.jibunshi)}ページ`,
  run: (g, L) => { mark(L, 'jibunshi'); useSt(g, 3); passFor(g, 60, 'jibunshi'); stress(g, -3); L.jibunshi = num(L.jibunshi) + 1; const gs = gain(L, { kan: 1 }); const hs = L.hist.length ? L.hist[Math.floor(rng() * L.hist.length)] : null; if (L.jibunshi === 1) addHist(g, '自分史を書きはじめた', 'life'); if (L.jibunshi === 30) addHist(g, '自分史を一冊にまとめた', 'life'); return `${hs ? `「${hs.a}歳のころ、${hs.t.replace(/。$/, '')}」…` : ''}思い出しながら、ゆっくり書いた。（${L.jibunshi}ページ）${joinG(gs)}`; } });
const ptKey = (s) => (s === 'middle' || s === 'senior' ? 'work' : s);
const ROUTINE_NAMES = { remind: '知らせるだけ', ask: '毎朝きく', auto: '自動で行く' };
export const dutyKindNow = (g) => { const L = ensure(g); if (!L) return null; const s = stageOf(g); return s === 'high' || (s === 'uni' && L.uni.started) ? 'school' : L.job ? 'work' : null; };
export const hm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

export function actions(g) {
  const L = ensure(g);
  if (!L) return [];
  const out = [];
  for (const a of ACTS) {
    let why;
    try { why = a.when(g, L); } catch (e) { console.error('[ls] when', a.id, e); why = null; }
    if (why === null || why === undefined) continue;
    let name = a.name, sub = '';
    try { if (a.name2) name = a.name2(g, L) || a.name; sub = a.sub ? a.sub(g, L) || '' : ''; } catch (e) { console.error('[ls] sub', a.id, e); }
    out.push({ id: a.id, name, sub, why: why || '', group: a.group, pick: a.pick ? safePick(a, g) : null });
  }
  return out;
}
const safePick = (a, g) => { try { return a.pick(g); } catch (e) { return null; } };
export function doAct(g, id, o = {}) {
  const L = ensure(g);
  const a = ACTS.find((x) => x.id === id);
  if (!L || !a) return { ok: false, text: 'その行動はない。' };
  let why;
  try { why = a.when(g, L); } catch (e) { why = 'いまはできない'; }
  if (why === null || why === undefined) return { ok: false, text: 'いまは、その行動はできない。' };
  if (why) return { ok: false, text: why };
  if (a.pick && !Number.isFinite(Number(o.pick))) return { ok: false, text: 'えらんでください。', needPick: true };
  let text = '';
  try { text = a.run(g, L, o) || ''; } catch (e) { console.error('[ls] act', id, e); return { ok: false, text: 'うまくいかなかった…' }; }
  return { ok: true, text };
}

// ---------------------------------------------------------------- school year logic (高校 / 大学), 就活, 会社
function shukatsuPhase(g, U) {
  if (!U || !U.started || U.shk.chosen) return null;
  const d = dateOf(g), gr = uniGrade(g, U), R = D.shukatsuRule(d.year);
  const idx = (m) => (m >= 4 ? m - 4 : m + 8); // school months run 4..3
  return gr * 12 + idx(d.month) >= R.start[0] * 12 + idx(R.start[1]) ? 'on' : null;
}
function makeOffer(g, L, S, newGrad) {
  const yr = yearNow(g);
  const pool = D.industriesFor(yr).filter((id) => !S.offers.some((o) => o.ind === id));
  if (!pool.length) return null;
  // the stats that fit an industry make it likelier
  pool.sort((a, b) => L.stats[D.INDUSTRIES[b].stat] - L.stats[D.INDUSTRIES[a].stat] + (rng() - 0.5) * 30);
  const ind = pool[0];
  const o = { ind, day: g.state.day, newGrad: !!newGrad };
  S.offers.push(o);
  addInbox(g, { kind: 'offer', key: `offer_${ind}_${g.state.day}`, title: `内定のお知らせ：${D.INDUSTRIES[ind].name}`, text: `${D.INDUSTRIES[ind].name}から、内定の連絡がきた。\n${D.INDUSTRIES[ind].desc}\n（週給の目安 ${fmtMoney(Math.round(D.CO_RANKS[0].pay * D.INDUSTRIES[ind].pay))}${newGrad ? '・卒業後の4月から' : '・すぐに働ける'}）`, choices: ['この会社に決める', 'ことわる'], def: 1, days: 20, data: { ind, newGrad: !!newGrad } });
  return o;
}
onInbox('offer', (g, it, i) => {
  const L = ensure(g);
  if (i !== 0) return '内定を、ていねいにことわった。';
  const { ind, newGrad } = it.data;
  if (newGrad && L.uni && !L.uni.grad) { L.uni.shk.chosen = ind; addHist(g, `${D.INDUSTRIES[ind].name}に内定した`, 'work'); return `${D.INDUSTRIES[ind].name}に決めた！ 卒業したら、4月から社会人だ。`; }
  if (newGrad && L.high && !L.high.grad) { L.high.jobInd = ind; addHist(g, `${D.INDUSTRIES[ind].name}に就職が決まった`, 'work'); return `${D.INDUSTRIES[ind].name}に決めた！ 卒業したら、4月から働く。`; }
  if (L.job) return 'いまの会社がある。（まずは「会社をやめる」から）';
  startJob(g, L, ind);
  return `${D.INDUSTRIES[ind].name}で働くことになった！ 会社の日は生活画面の「出勤する」から。`;
});
function startJob(g, L, ind) {
  L.job = { ind, rank: 0, pts: 0, joined: g.state.day, wk: { n: 0, p: 0 }, streak: 0, evals: [], leave: 10, lastLeave: 0 };
  if (L.shk) L.shk = { pts: 0, offers: [], chosen: null };
  addHist(g, `${D.INDUSTRIES[ind].name}に入社した`, 'work');
}
function checkGrade(L) {
  const k = L.stats.ken;
  return k >= 80 ? 'A' : k >= 64 ? 'B' : k >= 46 ? 'C' : k >= 30 ? 'D' : 'E';
}
function reportCard(L, subjects, attRate) {
  const s = L.stats;
  const rows = subjects.map(([name, w]) => {
    let v = 0;
    for (const [k, x] of Object.entries(w)) v += s[k] * x;
    v = v * (0.75 + 0.25 * attRate) + (rng() - 0.5) * 12;
    return [name, D.mark5(v)];
  });
  const avg = rows.reduce((a, r) => a + r[1], 0) / rows.length;
  const ks = D.STAT_ORDER.filter((k) => k !== 'ken');
  const best = ks.reduce((a, k) => (s[k] > s[a] ? k : a), ks[0]);
  const worst = ks.reduce((a, k) => (s[k] < s[a] ? k : a), ks[0]);
  return { rows, avg: Math.round(avg * 10) / 10, comment: `${D.TEACHER[best]}${s[worst] < 40 ? D.TEACHER_WEAK[worst] : ''}`, att: Math.round(attRate * 100) };
}

// month-change handlers for the player (called from the morning tick)
function monthTurn(g, L, d, prev) {
  const s = stageOf(g), notes = [];
  // ---- 高校
  if (s === 'high') {
    const H = L.high, gr = highGrade(g, H);
    const termEnd = (prev === 7 && d.month === 8) || (prev === 12 && d.month === 1) || (prev === 3 && d.month === 4);
    if (termEnd) {
      const rate = H.tatt.p + H.tatt.n ? H.tatt.p / (H.tatt.p + H.tatt.n) : 1;
      const rc = reportCard(L, D.SUBJECTS, rate);
      const term = prev === 7 ? 1 : prev === 12 ? 2 : 3;
      H.reports.push({ d: g.state.day, label: `${Math.min(3, gr - (prev === 3 ? 1 : 0))}年 ${term}学期`, ...rc });
      if (H.reports.length > 9) H.reports.shift();
      notes.push(`（${term}学期の通知表をもらった。平均 ${rc.avg}・出席 ${rc.att}%。くわしくは生活画面で）`);
      if (rate < D.HIGH_TYPES[H.type].req && H.tatt.p + H.tatt.n >= 6) notes.push('（担任の先生から「出席が足りていないよ。困っていることがあったら相談してね」と言われた）');
      H.tatt = { n: 0, p: 0 };
    }
    if (d.month === 4 && gr === 1 && !H.entered) { H.entered = true; addHist(g, `${D.HIGH_TYPES[H.type].name}に入学した`, 'school'); notes.push('（高校の入学式。新しい制服、新しい教室。ここから3年間だ）'); }
    if (d.month === 5 && D.HIGH_TYPES[H.type].days === 5) notes.push(L.stats.tai >= 60 ? '（体育祭！ リレーでごぼう抜き。クラスが大盛りあがりだった）' : '（体育祭。クラスみんなで大声で応援した）');
    if (d.month === 9 && D.HIGH_TYPES[H.type].days === 5) addInbox(g, { kind: 'bunkasai', key: `bunka_${d.year}`, title: '文化祭の出し物', text: 'クラスの文化祭の出し物を決めることになった。何をやる？', choices: ['劇をやる（感性）', '模擬店をやる（生活力・友情）', '展示をやる（学力）'], def: 1, days: 9 });
    if (d.month === 10 && gr === 2 && D.HIGH_TYPES[H.type].days === 5) { const where = d.year >= 2000 ? (rng() < 0.5 ? '沖縄' : '北海道') : '京都・奈良'; gain(L, { yu: 3, kan: 1 }); addHist(g, `修学旅行で${where}へ`, 'school'); notes.push(`（修学旅行で${where}へ！ 班のみんなと、忘れられない思い出ができた）`); }
    if (d.month === 10 && gr === 3 && !H.plan) addInbox(g, { kind: 'shinro', key: `shinro_${d.year}`, title: '進路希望調査', text: '卒業後の進路を、決める時期だ。', choices: ['大学に進学する（国公立を目指す）', '大学に進学する（私立）', '就職する', '芸能の道に専念する'], def: 3, days: 15 });
    if (d.month === 11 && gr === 3 && H.plan === 'job' && !H.jobInd) { const S = { offers: [] }; for (let i = 0; i < 2; i++) makeOffer(g, L, S, true); }
    if (d.month === 2 && gr === 3 && (H.plan === 'koku' || H.plan === 'shi') && !H.exam) H.exam = examResult(g, L, H.plan, num(H.study));
    if (d.month === 3 && gr >= 3) { gradHigh(g, L, notes); }
  }
  // ---- 浪人 / 社会人の受験
  if ((L.ronin || L.exam) && d.month === 2 && prev === 1) {
    const kind = L.ronin ? L.ronin.kind : L.exam.kind;
    const r = examResult(g, L, kind, num(L.ronin ? L.ronin.study : 0) + 4);
    if (r.pass) { L.uni = newUni(g, kind); L.uni.entry = D.schoolYearOf(d) + 1; notes.push(`（合格発表！ ${kind === 'koku' ? '国公立大学' : '私立大学'}に合格した！ 4月から大学生だ）`); addHist(g, `${kind === 'koku' ? '国公立' : '私立'}大学に合格した`, 'school'); L.ronin = null; L.exam = null; }
    else { notes.push('（合格発表…。今年は、届かなかった）'); if (L.ronin) addInbox(g, { kind: 'ronin', key: `ronin_${d.year}`, title: 'これからのこと', text: 'もう一年、がんばる？', choices: ['もう一年、浪人する', '就職・芸能の道に進む'], def: 1, days: 15, data: { kind } }); else L.exam = null; }
  }
  // ---- 大学
  if (L.uni && !L.uni.grad && !L.uni.quit) {
    const U = L.uni;
    if (!U.started && d.month === 4 && D.schoolYearOf(d) >= U.entry) { U.started = true; addHist(g, `${U.kind === 'koku' ? '国公立' : '私立'}大学に入学した`, 'school'); notes.push('（大学の入学式。広いキャンパス、自由な時間割。生活画面で履修とサークルを決めよう）'); }
    if (U.started && (d.month === 4 || d.month === 10)) tuition(g, L, U, notes);
    if (U.started && ((prev === 7 && d.month === 8) || (prev === 1 && d.month === 2))) {
      const rate = U.tatt.p + U.tatt.n ? U.tatt.p / (U.tatt.p + U.tatt.n) : 0;
      const max = U.load === 'light' ? 16 : U.load === 'heavy' ? 26 : 20;
      const got = Math.round(max * clamp(rate * 0.75 + L.stats.gaku / 400 + 0.05, 0, 1));
      U.credits += got; U.tatt = { n: 0, p: 0 };
      notes.push(`（${prev === 7 ? '前期' : '後期'}の試験の結果。${got}/${max}単位をとった。合計 ${U.credits}単位）`);
    }
    if (U.started && d.month === 4 && uniGrade(g, U) === 3 && !U.zemi) { U.zemi = true; gain(L, { gaku: 2 }); notes.push('（3年生。ゼミに入った。先生と仲間と、ひとつのテーマを深めていく）'); }
    // 就活: offers in the season
    if (U.started && !U.shk.chosen) {
      const R = D.shukatsuRule(d.year), gr = uniGrade(g, U);
      if (gr === R.offer[0] && d.month === R.offer[1]) {
        const mk = D.jobMarket(d.year);
        const tries = clamp(Math.floor(num(U.shk.pts) / 7), 0, 4);
        let made = 0;
        for (let i = 0; i < tries; i++) if (rng() < 0.55 * mk.k) { if (makeOffer(g, L, U.shk, true)) made++; }
        notes.push(made ? `（就活の結果、${made}社から内定の連絡がきた！ 生活画面のお知らせで決めよう）` : `（就活の結果…内定は、まだない。${mk.name}だ。卒業後も「会社をさがす」で続けられる）`);
      }
    }
    if (U.started && d.month === 3 && uniGrade(g, U) >= 4) gradUni(g, L, notes);
  }
  // ---- 社会人の入社（4月）
  if (d.month === 4 && L.pendingInd && !L.job) { startJob(g, L, L.pendingInd); notes.push(`（入社式。今日から${D.INDUSTRIES[L.pendingInd].name}の社員だ。会社の日は生活画面の「出勤する」から）`); L.pendingInd = null; }
  // ---- 会社: 査定（4月）・ボーナス（6月・12月）
  if (L.job) {
    const J = L.job;
    if (d.month === 4 && g.state.day - J.joined > 40) evaluate(g, L, notes);
    if (d.month === 6 || d.month === 12) {
      const last = J.evals.length ? J.evals[J.evals.length - 1].score : 3;
      const amt = Math.round(D.CO_RANKS[J.rank].pay * D.INDUSTRIES[J.ind].pay * (0.8 + last * 0.25));
      g.addMoney(amt, true);
      notes.push(`（${d.month === 6 ? '夏' : '冬'}のボーナスが出た！ ${fmtMoney(amt)}）`);
      ledgerAdd(g, L, [`${d.month === 6 ? '夏' : '冬'}のボーナス`, amt]);
    }
    if (d.month === 12 && rng() < 0.6) { stress(g, -4); notes.push('（会社の忘年会。上司のカラオケに手拍子した）'); }
  }
  // ---- 中年・大人の年中行事
  const age = ageOf(g.state);
  if (age >= 22 && d.month === 5 && L.job) { L.mid.check = { day: g.state.day, grade: checkGrade(L) }; notes.push(`（会社の健康診断。判定は「${L.mid.check.grade}」${L.mid.check.grade >= 'D' ? '。要精密検査…生活を見直そう' : ''}）`); }
  if (age >= 40 && d.month === 8 && age % 5 === 0 && L.mid.reunion !== age) { L.mid.reunion = age; addInbox(g, { kind: 'reunion', key: `reunion_${age}`, title: '同窓会の案内', text: `高校の同窓会の案内がきた。（${age}歳の同窓会）`, choices: ['参加する（¥6,000）', '今回は欠席する'], def: 1, days: 10 }); }
  if (age >= 65 && d.month === 9 && L.mid.keiro !== d.year) { L.mid.keiro = d.year; notes.push((L.grand || []).length ? `（敬老の日。孫の${L.grand[0].n}から、似顔絵の手紙が届いた）` : '（敬老の日。町内会から、お祝いの記念品が届いた）'); }
  if (s === 'middle' && d.month === 11 && !L.mid.care && caregiverNeeded(g)) addInbox(g, { kind: 'care', key: `care_${d.year}`, title: '親のこと', text: '実家の親が、このごろ足腰が弱ってきたらしい。どうする？', choices: ['帰省して手伝う（体力 -15）', '介護サービスを調べて頼む（¥20,000）', 'きょうだい・親戚と相談する'], def: 2, days: 15 });
  if (L.job && !L.job.rehire && s !== 'high' && rng() < 0.06 && g.state.day - L.job.joined > 200) addInbox(g, { kind: 'transfer', key: `transfer_${d.year}_${d.month}`, title: '人事異動の打診', text: '上司から「別の部署に行ってみないか」と言われた。', choices: ['引き受ける（評価 +・ストレス +）', 'いまの部署に残りたい'], def: 1, days: 8 });
  return notes;
}
function caregiverNeeded(g) {
  const fam = (profileOf(g.state).family || []).filter((m) => m && m.alive !== false && (m.rel === 'father' || m.rel === 'mother'));
  return fam.length > 0;
}
function examResult(g, L, kind, study) {
  const H = L.high, type = H ? H.type : 'futsu';
  const base = kind === 'koku' ? 0.1 : 0.32;
  const p = clamp(base + (L.stats.gaku - (kind === 'koku' ? 55 : 38)) / 70 + study / 140 + (type === 'shingaku' ? 0.08 : 0), 0.04, 0.95);
  return { kind, pass: rng() < p, p: Math.round(p * 100) };
}
function gradHigh(g, L, notes) {
  const H = L.high;
  if (H.grad) return;
  H.grad = true;
  addHist(g, `${D.HIGH_TYPES[H.type].name}を卒業した`, 'school');
  notes.push('（卒業式。体育館に、仰げば尊し…いや、いまどきの歌が流れた。3年間、ありがとう）');
  if ((H.plan === 'koku' || H.plan === 'shi') && H.exam) {
    if (H.exam.pass) { L.uni = newUni(g, H.plan); notes.push(`（そして春から、${H.plan === 'koku' ? '国公立' : '私立'}大学へ！）`); addHist(g, `${H.plan === 'koku' ? '国公立' : '私立'}大学に合格した`, 'school'); }
    else addInbox(g, { kind: 'ronin', key: `ronin_h_${dateOf(g).year}`, title: '受験の結果', text: `${D.entranceTest(dateOf(g).year)}…残念ながら、志望校には届かなかった。これから、どうする？`, choices: ['浪人して、来年もう一度', '就職・芸能の道に進む'], def: 1, days: 15, data: { kind: H.plan } });
  }
  if (H.plan === 'job' && H.jobInd) L.pendingInd = H.jobInd;
}
function gradUni(g, L, notes) {
  const U = L.uni;
  if (U.credits >= 124 && U.thesis >= 100) {
    U.grad = true;
    addHist(g, `大学を卒業した（${U.credits}単位）`, 'school');
    notes.push('（大学の卒業式。はかま・スーツの人波。学生生活が、終わる）');
    if (U.shk.chosen) L.pendingInd = U.shk.chosen;
    if (U.loan.left > 0) notes.push(`（奨学金の返済が始まる。残り ${fmtMoney(U.loan.left)}・毎週 ${fmtMoney(1500)}）`);
  } else if (!U.heldBack || U.heldBack !== dateOf(g).year) {
    U.heldBack = dateOf(g).year;
    U.extra = num(U.extra) + 1;
    notes.push(`（卒業に必要なものが足りなかった…（${U.credits}/124単位・卒論 ${U.thesis}%）。もう1年、大学に残る）`);
    addHist(g, '留年が決まった', 'school');
  }
}
function tuition(g, L, U, notes) {
  const key = `${dateOf(g).year}_${dateOf(g).month}`;
  if (U.paid === key) return;
  U.paid = key;
  const fee = U.kind === 'koku' ? 36000 : 62000;
  if (g.spend(fee)) { notes.push(`（${dateOf(g).month === 4 ? '前期' : '後期'}の学費 ${fmtMoney(fee)} をはらった）`); ledgerAdd(g, L, ['大学の学費', -fee]); }
  else { U.loan.total += fee; U.loan.left += fee; notes.push(`（学費 ${fmtMoney(fee)} は、奨学金（貸与）でまかなった。卒業後に返していく）`); }
}
function evaluate(g, L, notes) {
  const J = L.job, I = D.INDUSTRIES[J.ind];
  const key = dateOf(g).year;
  if (J.evalYear === key) return;
  J.evalYear = key;
  const rate = J.wk.p + J.wk.n ? J.wk.p / (J.wk.p + J.wk.n) : 1;
  const score = clamp(Math.round(1 + rate * 2 + L.stats[I.stat] / 50 + (rng() - 0.4)), 1, 5);
  J.evals.push({ d: g.state.day, score });
  if (J.evals.length > 12) J.evals.shift();
  J.pts += score * 2;
  J.leave = Math.min(20, num(J.leave) + 10 + Math.min(10, J.evals.length));
  J.wk = { n: 0, p: 0 };
  const next = D.CO_RANKS[J.rank + 1];
  const need = next ? next.need * (J.ind === 'koumu' ? 1.2 : 1) : Infinity;
  notes.push(`（年に一度の査定。評価は ${'★'.repeat(score)}${'☆'.repeat(5 - score)}）`);
  if (next && J.pts >= need && !J.rehire) { J.rank++; addHist(g, `${D.CO_RANKS[J.rank].name}に昇進した`, 'work'); notes.push(`（辞令！ ${D.CO_RANKS[J.rank].name}に昇進した！ 週給 ${fmtMoney(Math.round(D.CO_RANKS[J.rank].pay * I.pay))}）`); if (J.rank >= 4) stress(g, 4); }
}

// ---------------------------------------------------------------- inbox handlers
onInbox('bunkasai', (g, it, i) => { const L = ensure(g); const gs = gain(L, [{ kan: 3, yu: 1 }, { sei: 2, yu: 2 }, { gaku: 3 }][i]); addHist(g, ['文化祭でクラス劇をやった', '文化祭で模擬店を出した', '文化祭で研究展示をした'][i], 'school'); return `${['クラス劇は、大きな拍手をもらった！', '模擬店は、大行列で完売！', '展示は、先生にほめられた！'][i]}${joinG(gs)}`; });
onInbox('shinro', (g, it, i) => { const L = ensure(g); L.high.plan = ['koku', 'shi', 'job', 'geino'][i]; addHist(g, `進路を「${['国公立大学', '私立大学', '就職', '芸能の道'][i]}」に決めた`, 'school'); return ['国公立大学を目指す。2月の試験まで、生活画面の「勉強する」で学力を上げよう。', '私立大学を目指す。2月の試験に向けて、勉強しよう。', '就職する。11月ごろ、学校に求人が届く。', '卒業したら、芸能の道に専念する！'][i]; });
onInbox('ronin', (g, it, i) => { const L = ensure(g); if (i === 0) { L.ronin = { kind: it.data && it.data.kind ? it.data.kind : 'shi', since: g.state.day, study: 0 }; addHist(g, '浪人生になった', 'school'); return '予備校に通って、もう一年がんばる。（2月にもう一度試験）'; } return '別の道に進むことにした。'; });
onInbox('reunion', (g, it, i) => { const L = ensure(g); if (i !== 0) return '今回は欠席にした。'; if (!g.spend(6000)) return 'お金が足りなくて、行けなかった…'; stress(g, -15); const gs = gain(L, { yu: 3 }); addHist(g, `${ageOf(g.state)}歳の同窓会に出た`, 'life'); return `なつかしい顔ぶれ。「変わってないね！」…おたがい、少し白髪がふえた。${joinG(gs)}`; });
onInbox('care', (g, it, i) => {
  const L = ensure(g);
  L.mid.care = { day: g.state.day, how: i };
  if (i === 0) { useSt(g, 15); stress(g, 4); gain(L, { sei: 2 }); addHist(g, '親の暮らしを手伝いに、帰省した', 'family'); return '週末に帰省して、手すりをつけたり、買い物をしたり。「助かるよ」と笑ってくれた。'; }
  if (i === 1) { if (!g.spend(20000)) { L.mid.care = null; return 'お金が足りない…。もう少し考えよう。'; } addHist(g, '親のために、介護サービスを頼んだ', 'family'); return 'ケアマネジャーさんと相談して、通いのサービスを頼んだ。親も、少し安心したようだ。'; }
  addHist(g, '親のことを、家族で話しあった', 'family');
  return 'きょうだいや親戚と電話で話しあった。できることを、分けあっていこう。';
});
onInbox('transfer', (g, it, i) => { const L = ensure(g); if (!L.job) return ''; if (i === 0) { L.job.pts += 3; stress(g, 8); addHist(g, '別の部署に異動した', 'work'); return '新しい部署へ。覚えることは多いが、評価は上がった。'; } return 'いまの部署に残ることにした。'; });

// ---------------------------------------------------------------- weekly money (給料・月謝・返済) and the household ledger
function ledgerAdd(g, L, item) {
  const w = weekOf(g.state.day);
  let row = L.ledger.find((r) => r.w === w);
  if (!row) { row = { w, items: [] }; L.ledger.push(row); if (L.ledger.length > 10) L.ledger.shift(); }
  row.items.push(item);
}
function weekly(g, L, notes) {
  const bits = [];
  if (L.job) {
    const J = L.job;
    const worked = num(J.paidDays);
    const pay = Math.round(D.CO_RANKS[J.rank].pay * D.INDUSTRIES[J.ind].pay * (J.rehire ? 0.6 : 1) * clamp(worked / 5, 0, 1.2));
    J.paidDays = 0;
    if (pay > 0) { g.addMoney(pay, true); bits.push(`給料 +${fmtMoney(pay)}`); ledgerAdd(g, L, ['給料', pay]); }
  }
  if (L.pension && L.pension.week > 0) { g.addMoney(L.pension.week, true); bits.push(`年金 +${fmtMoney(L.pension.week)}`); ledgerAdd(g, L, ['年金', L.pension.week]); }
  if (L.high && !L.high.grad && L.high.cram) { if (g.spend(3000)) { bits.push(`塾 -${fmtMoney(3000)}`); ledgerAdd(g, L, ['塾の月謝', -3000]); } else { L.high.cram = false; bits.push('（塾の月謝がはらえず、やめた）'); } }
  if (L.ronin) { if (g.spend(4000)) { bits.push(`予備校 -${fmtMoney(4000)}`); ledgerAdd(g, L, ['予備校', -4000]); } }
  const loan = L.uni && L.uni.grad && L.uni.loan && L.uni.loan.left > 0 ? L.uni.loan : null;
  if (loan) { const r = Math.min(1500, loan.left); if (g.spend(r)) { loan.left -= r; bits.push(`奨学金の返済 -${fmtMoney(r)}`); ledgerAdd(g, L, ['奨学金の返済', -r]); if (loan.left <= 0) addHist(g, '奨学金を返しおえた', 'money'); } }
  try { const kidBits = KID_WEEKLY.map((fn) => fn(g, L, ledgerAdd)).flat().filter(Boolean); bits.push(...kidBits); } catch (e) { console.error('[ls] kids weekly', e); }
  if (bits.length) toastLater(L, `今週のくらし：${bits.join('・')}`);
}
export const KID_WEEKLY = []; // lifestage_kids.js: fn(g, L, ledgerAdd) → [text]
export const KID_TICK = []; // lifestage_kids.js: fn(g, L, d, monthChanged, prevMonth, notes)

// ---------------------------------------------------------------- the morning
export function tick(g) {
  const L = ensure(g);
  if (!L) return;
  const st = g.state, day = st.day;
  if (L.last.day === day) return;
  const yday = day - 1;
  const notes = [];
  // yesterday's duty: present, on leave, or absent
  if (L.today.day === yday) {
    const du = L.dutyY;
    if (du && (du.kind === 'school' || du.kind === 'uni')) {
      const rec = du.kind === 'uni' ? L.uni : L.high;
      if (rec && !L.today.school) { rec.att.n++; rec.tatt.n++; }
    }
    if (du && du.kind === 'work' && L.job) {
      if (L.today.work === 'present' || L.today.work === 'leave') L.job.paidDays = num(L.job.paidDays) + 1;
      else { L.job.wk.n++; L.job.streak = num(L.job.streak) + 1; L.job.pts = Math.max(0, L.job.pts - 0.5); if (L.job.streak === 3) addInbox(g, { kind: 'absent', key: `absent_${day}`, title: '上司からの電話', text: '「3日も連絡なしで休んで、どうしたんだ？」', choices: ['あやまって、明日から出る', '会社をやめる'], def: 0, days: 3 }); }
    }
  }
  L.today = { day, did: {}, school: false, work: false };
  L.dutyY = dutyOf(g, day);
  const d = dateOf(g, day);
  const prev = num(L.last.month, d.month);
  const monthChanged = L.last.month != null && L.last.month !== d.month;
  if (monthChanged) notes.push(...monthTurn(g, L, d, prev));
  // a new week (月曜): pay and fees
  const w = weekOf(day);
  if (L.last.week != null && L.last.week !== w) weekly(g, L, notes);
  if (L.job) L.coDays = num(L.coDays) + 1;
  // birthdays: health after 40, 厄年, 定年, 年金, 長寿のお祝い
  const age = ageOf(st);
  if (L.last.age != null && age > L.last.age) {
    if (age >= 40) { const drop = age >= 65 ? 5 : age >= 55 ? 4 : 3; gain(L, { ken: -(drop + (num(st.life && st.life.stress) > 70 ? 2 : 0)) }); }
    const yr = d.year;
    if (L.job && !L.job.rehire && age >= D.teinenAge(yr)) addInbox(g, { kind: 'teinen', key: `teinen_${age}`, title: '定年退職', text: `${age}歳。会社の定年をむかえた。${D.rehireUntil(yr) > age ? `\n会社から「${D.rehireUntil(yr)}歳まで、嘱託として続けないか」と言われた（給料は今の6割）。` : ''}`, choices: D.rehireUntil(yr) > age ? ['再雇用で働き続ける', '退職して、第二の人生へ'] : ['退職して、第二の人生へ'], def: D.rehireUntil(yr) > age ? 1 : 0, days: 12, data: { until: D.rehireUntil(yr) } });
    if (L.job && L.job.rehire && age >= num(L.job.until, 65)) { notes.push(`（${age}歳。再雇用の期間が終わった。長いあいだ、おつかれさまでした）`); addHist(g, `${age}歳で会社勤めを終えた`, 'work'); L.job = null; }
    if (!L.pension && age >= D.pensionAge(yr)) { L.pension = { since: st.day, week: D.pensionWeek(num(L.coDays) / YEAR_DAYS) }; notes.push(`（${age}歳。年金の受け取りが始まった。毎週 ${fmtMoney(L.pension.week)}${yr >= 2001 && yr <= 2025 ? '・厚生年金の支給開始は段階的に65歳へ引き上げ中' : ''}）`); addHist(g, `年金の受け取りが始まった（週 ${fmtMoney(L.pension.week)}）`, 'money'); }
    if (D.CHOJU[age]) { const [nm, tx] = D.CHOJU[age]; notes.push(`（${nm}のお祝い。${tx}）`); addHist(g, `${nm}（${age}歳）のお祝い`, 'family'); stress(g, -10); }
    if (age === 40) { addHist(g, '40歳。人生の折り返し地点', 'life'); notes.push('（40歳の誕生日。不惑…と言うけれど、迷うことはまだまだある）'); }
    const gender = profileOf(st).gender;
    if ((gender === 'm' && age === 41) || (gender === 'f' && age === 32)) notes.push('（今年は数えで本厄の年らしい。気になるなら、神社でお祓いを受けてもいい）');
  }
  // the 知名度 title: a line in the 年表 when it goes up
  const ri = rankIndex(num(st.fame));
  if (L.last.rank != null && ri > L.last.rank) addHist(g, `知名度の称号が「${RANKS[ri][1]}」になった`, 'geino');
  // health: a low 健康 makes the mornings heavier
  if (L.stats.ken < 40 && st.maxStamina) st.stamina = Math.min(st.stamina, Math.round(st.maxStamina * (L.stats.ken < 25 ? 0.78 : 0.88)));
  // the inbox: what waited too long is decided by its default
  for (const it of L.inbox.slice()) if (day > it.until) { const r = respond(g, it.id, it.def, true); if (r.text) notes.push(`（${it.title}：${r.text.split('\n')[0]}）`); }
  for (const fn of KID_TICK) { try { fn(g, L, d, monthChanged, prev, notes); } catch (e) { console.error('[ls] kids tick', e); } }
  L.last.day = day; L.last.month = d.month; L.last.week = w; L.last.age = age; L.last.rank = ri;
  // the day's duty, as a word in the morning (日課 'remind')
  const du = L.dutyY;
  if (du && L.routine[du.kind === 'work' ? 'work' : 'school'] === 'remind') toastLater(L, `今日は${du.label}の日（${hm(du.start)}〜）。生活画面から行けます`);
  if (L.inbox.some((x) => x.day === day)) toastLater(L, `生活画面に お知らせ：${L.inbox.filter((x) => x.day === day).map((x) => x.title).join('・')}`);
  // keep it short: at most 4 pages a morning from here
  for (const t of notes.slice(0, 4)) pushNote(g, t);
  if (notes.length > 4) pushNote(g, `（ほか${notes.length - 4}件。生活画面の「年表」と「きょう」で）`);
}
onInbox('teinen', (g, it, i) => {
  const L = ensure(g);
  if (!L.job) return '';
  const J = L.job, years = num(L.coDays) / YEAR_DAYS;
  const severance = Math.round(D.CO_RANKS[J.rank].pay * D.INDUSTRIES[J.ind].pay * clamp(years, 1, 40) * 2.2);
  if (!J.severed) { J.severed = true; g.addMoney(severance, true); ledgerAdd(g, L, ['退職金', severance]); }
  const canStay = (it.choices || []).length > 1;
  if (canStay && i === 0) { J.rehire = true; J.until = num(it.data && it.data.until, 65); addHist(g, `定年をむかえ、${J.until}歳まで再雇用で働くことにした`, 'work'); return `退職金 ${fmtMoney(severance)} を受けとった。${J.until}歳まで、嘱託として働き続ける。（給料は6割）`; }
  addHist(g, `${D.INDUSTRIES[J.ind].name}を定年退職した（${D.CO_RANKS[J.rank].name}）`, 'work');
  L.job = null;
  stress(g, -12);
  return `長いあいだ、おつかれさまでした。退職金 ${fmtMoney(severance)} を受けとった。花束を抱えて、会社をあとにした。`;
});
onInbox('absent', (g, it, i) => { const L = ensure(g); if (!L.job) return ''; if (i === 0) { L.job.streak = 0; return '「すみませんでした」。明日から、ちゃんと出よう。'; } addHist(g, `${D.INDUSTRIES[L.job.ind].name}を退職した`, 'work'); L.job = null; return '会社をやめることにした。'; });
onMorning((g) => tick(g));

// after waking: the 日課 'ask' / 'auto' (one question, no more)
export const toastLater = (L, t) => { L.toasts = Array.isArray(L.toasts) ? L.toasts : []; if (L.toasts.length < 4) L.toasts.push(String(t)); };
async function afterWake(g) {
  const L = ensure(g);
  if (!L || !g.state) return;
  if (Array.isArray(L.toasts) && L.toasts.length) { for (const t of L.toasts.splice(0)) g.notify(t, { color: '#ffe9a8', life: 300 }); }
  const du = dutyOf(g);
  if (!du) return;
  const kind = du.kind === 'work' ? 'work' : 'school';
  const mode = L.routine[kind];
  if (mode !== 'ask' && mode !== 'auto') return;
  if (kind === 'school' ? L.today.school : L.today.work) return;
  if (mode === 'ask') {
    const i = await g.ask(`今日は${du.label}の日（${hm(du.start)}〜${hm(du.end)}）。どうする？`, [du.kind === 'work' ? '出勤する' : '行く', '今日は休む', '今後は聞かない（知らせるだけ）'], { cancel: 1 });
    if (i === 2) { L.routine[kind] = 'remind'; return; }
    if (i !== 0) return;
  }
  const r = kind === 'work' ? goWork(g, L, true) : attendSchool(g, L, true);
  if (r.text) g.notify(r.text.split('\n')[0], { color: r.ok ? '#bfe8ff' : '#ffd23f', life: 260 });
}
const origSleep = Game.prototype.sleep;
if (typeof origSleep === 'function' && !origSleep.__ls) {
  const w = async function (...a) {
    const r = await origSleep.apply(this, a);
    try { await afterWake(this); } catch (e) { console.error('[ls] afterWake', e); }
    return r;
  };
  w.__ls = true;
  Game.prototype.sleep = w;
}

// ---------------------------------------------------------------- what the 社会人 page shows about the other careers
export function careerSummary(g) {
  const st = g.state, out = [];
  const fame = num(st.fame);
  if (fame > 0 || st.agency) out.push({ k: 'geino', label: '芸能', value: `${RANKS[rankIndex(fame)][1]}（知名度 ${fame}）`, sub: st.agency && AGENCIES[st.agency] ? `${AGENCIES[st.agency].name}所属` : 'フリー' });
  try {
    const p = has(g, 'pol') ? g.pol() : null;
    const me = p && p.me;
    if (me && me.office) out.push({ k: 'pol', label: '政治', value: (OFFICES[me.office] && OFFICES[me.office].name) || String(me.office), sub: (me.posts || []).length ? `役職 ${(me.posts || []).length}` : '' });
  } catch (e) { /* no politics */ }
  const L = ensure(g);
  if (L && L.job) out.push({ k: 'job', label: '会社', value: `${D.INDUSTRIES[L.job.ind].name}・${D.CO_RANKS[L.job.rank].name}`, sub: `週給 ${fmtMoney(Math.round(D.CO_RANKS[L.job.rank].pay * D.INDUSTRIES[L.job.ind].pay))}` });
  if (L && L.pension) out.push({ k: 'pension', label: '年金', value: `週 ${fmtMoney(L.pension.week)}`, sub: `会社勤め 約${Math.round(num(L.coDays) / YEAR_DAYS)}年` });
  return out;
}
export function weeklyCosts(g) {
  const L = ensure(g), out = [];
  try { const h = g.housing(); if (h && h.rent) out.push(['家賃（' + (h.name || '住まい') + '）', -h.rent]); } catch (e) { /* tests */ }
  if (L.job) out.push([L.job.rehire ? '給料（再雇用・出勤5日の目安）' : '給料（出勤5日の目安）', Math.round(D.CO_RANKS[L.job.rank].pay * D.INDUSTRIES[L.job.ind].pay * (L.job.rehire ? 0.6 : 1))]);
  if (L.pension) out.push(['年金', L.pension.week]);
  if (L.high && !L.high.grad && L.high.cram) out.push(['塾の月謝', -3000]);
  if (L.ronin) out.push(['予備校', -4000]);
  if (L.uni && L.uni.grad && L.uni.loan && L.uni.loan.left > 0) out.push(['奨学金の返済', -1500]);
  for (const fn of KID_COSTS) { try { out.push(...fn(g, L)); } catch (e) { /* ignore */ } }
  return out;
}
export const KID_COSTS = []; // lifestage_kids.js: fn(g, L) → [[label, amount]]

// ---------------------------------------------------------------- the API
const METHODS = {
  lifeStage() {
    const L = ensure(this);
    if (!L) return null;
    const id = stageOf(this), S = D.STAGES[id], st = this.state;
    const age = ageOf(st);
    return { id, name: S.name, color: S.color, label: stageLabel(this), age, toBirthday: YEAR_DAYS - ((num(st.day, 1) - 1) % YEAR_DAYS), duty: dutyOf(this), off: breakOf(this), stats: { ...L.stats }, high: L.high, uni: L.uni, job: L.job, ronin: L.ronin, exam: L.exam, mid: L.mid, pension: L.pension || null, grand: (L.grand || []).slice(), hobby: L.hobby || null, coYears: Math.round(num(L.coDays) / YEAR_DAYS), routine: { ...L.routine }, today: { ...L.today } };
  },
  lifeStats() { const L = ensure(this); return L ? { ...L.stats } : null; },
  lifeActions() { return actions(this); },
  lifeAct(id, o) { return doAct(this, id, o || {}); },
  lifeInbox() { const L = ensure(this); return L ? L.inbox.slice() : []; },
  lifeRespond(id, i) { return respond(this, id, i); },
  lifeHistory() { const L = ensure(this); return L ? L.hist.slice() : []; },
  lifeLedger() { const L = ensure(this); return L ? { weeks: L.ledger.slice(), costs: weeklyCosts(this) } : { weeks: [], costs: [] }; },
  lifeRoutine(kind, mode) { const L = ensure(this); if (!L || !ROUTINE_NAMES[mode] || (kind !== 'school' && kind !== 'work')) return false; L.routine[kind] = mode; return true; },
  lifeCareer() { return careerSummary(this); },
  lifeAddHist(t, k) { if (ensure(this)) addHist(this, t, k); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__ls = { tick: (g) => tick(g), ensure, setRng: setLsRng, dutyOf, stageOf, D, addInbox, respond, startJob: (g, ind) => startJob(g, ensure(g), ind), newUni, newHigh, monthTurn, evaluate, examResult, ACTS };
