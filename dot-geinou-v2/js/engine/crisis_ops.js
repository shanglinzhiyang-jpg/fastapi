// 感染症とサイバー攻撃 (R26) — the two crises that are not a quake or a war: an epidemic (a new infection that spreads in waves; the load on the hospitals; the rules on going out and on shops; borders,
// tests, beds, a vaccine; the people's patience; the economy) and a cyber attack (a system down — transport, hospitals, banks, power; the ransom; what to say and when; whether a state is behind it; the
// defence afterwards). Whoever governs answers them: the player when they are 総理大臣 (all the actions) or 厚生労働大臣 (the epidemic, short of declaring an emergency; and デジタル／総務大臣 for the
// cyber attack); everybody else watches the government's own (imperfect) answer, and a member of the Diet can press it. The report of the data can be bent (a 隠蔽 that leaks out as a scandal in scandal.js).
//
// Rules (the same as regime.js): nothing is refused for being bad — every action shows its effect, its price and its risk first; abstract and non-graphic (numbers and words only); no real person,
// no real country is blamed (the state behind an attack is one of the fictional nations of regime.js), the infection and the attacks are invented.
//
// State g.state.crisisOps (lazy, repaired on read): { v, cur: null | crisis, past: [{ kind, name, start, end, grade, text }], defense (0..100), beds (100..175, the hospitals' room), log, cool, lastTick, lastEnd,
//   anchored (the 2020 outbreak has happened), lastEpi, lastCyber }
//   crisis (epidemic): { id, kind:'epidemic', name, start, sev (1..3), wave, stage: 'outbreak'|'peak'|'decline'|'over', cases, peak, cum, deaths, load, rules (0..3), border, test (0..2), support, econ, shocked,
//     vacc { prog, avail, rate, fund, roll }, benefitUntil, hide, comp (the government's competence 0.5..1), log, notes }
//   crisis (cyber): { id, kind:'cyber', name, start, sev, target, stage: 'down'|'recovering'|'over', outage, peakOutage, leak (万人), speed, experts, ransom: null | { amount, day }, paid, pub: null | true | 'delay',
//     attr: 'criminal'|'state', nation, evidence, attributed, cost, log }
// API (on Game): g.crisisOps() → the summary; g.crisisOpsActions() → [{ id, group, name, desc, lines, cost, why }]; g.crisisOpsAct(id, opts) → { ok, why?, text? }; g.crisisOpsStart(kind, opts) (debug / tests).
// The phone app 「対策本部」 (id 'taisaku', order 66.95). window.__crisis (tests): setCrisisRng, tick, startEpidemic, startCyber.

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { polDate, dateLabel } from './politics.js';
import { RX, NATION_ORDER, FICTIONAL_NATIONS } from './regime.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText } from './phone.js';

const COLOR = '#2f7a8a';
const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const today = (g) => (g.state && g.state.day) || 1;
let rng = () => Math.random();
export const setCrisisRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const roll = (p) => rng() < p;
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pol = (g) => (typeof g.pol === 'function' ? g.pol() : null);
const n0 = (v) => Math.round(num(v)).toLocaleString('ja-JP');

// ======================================================================== the two kinds
export const EPI_SEV = [
  null,
  { label: '季節性に近い感染症', r0: 1.5, hosp: 0.02, fat: 0.001, names: ['新型のインフルエンザ', '新しい型のインフルエンザ'] },
  { label: '重い感染症', r0: 1.7, hosp: 0.04, fat: 0.004, names: ['新型のウイルス感染症', '新型の呼吸器感染症'] },
  { label: 'きわめて重い感染症', r0: 1.9, hosp: 0.06, fat: 0.008, names: ['新種の致死性の高い感染症', '新型の重症感染症'] },
];
export const RULE_NAMES = ['制限なし', '感染対策の呼びかけ', '自粛の要請（営業時間の短縮・外出の自粛）', '緊急事態宣言（外出の自粛・休業の要請）'];
export const TARGETS = {
  transport: { name: '交通・物流', what: '鉄道・空港・物流のシステムが止まった' },
  hospital: { name: '医療', what: '病院の電子カルテと予約のシステムが止まった' },
  finance: { name: '金融', what: '銀行の決済と窓口のシステムに障害が出た' },
  power: { name: '電力・水道', what: '電力会社と水道局の制御システムに障害が出た' },
};
const CAP = 30000; // the infectious-disease beds at index 100
const POP = 125000000;

// ======================================================================== state
const posts = (g) => { const p = pol(g); return p && p.me ? p.me.posts || [] : []; };
const isPM = (g) => posts(g).includes('pm');
const isHealth = (g) => posts(g).includes('minister_health');
const isDigital = (g) => posts(g).includes('minister_digital') || posts(g).includes('minister_internal');
const inDiet = (g) => { const p = pol(g); return !!(p && p.me && (p.me.office === 'shugi' || p.me.office === 'sangi')); };
function ensure(g) {
  if (!g || !g.state || !pol(g)) return null;
  let S = g.state.crisisOps;
  if (!isObj(S)) S = g.state.crisisOps = { v: 1, cur: null, past: [], defense: 40, beds: 100, log: [], cool: {}, lastTick: 0, lastEnd: -999, anchored: false, lastEpi: 0, lastCyber: 0 };
  S.defense = clamp(num(S.defense, 40), 0, 100); S.drift = num(S.drift); S.beds = clamp(num(S.beds, 100), 100, 175);
  if (!Array.isArray(S.past)) S.past = [];
  if (S.past.length > 20) S.past.length = 20;
  if (!Array.isArray(S.log)) S.log = [];
  if (!isObj(S.cool)) S.cool = {};
  if (!isObj(S.cur) || (S.cur.kind !== 'epidemic' && S.cur.kind !== 'cyber')) S.cur = null;
  const c = S.cur;
  if (c) {
    c.sev = clamp(Math.round(num(c.sev, 2)), 1, 3); c.start = num(c.start, today(g)); if (!Array.isArray(c.log)) c.log = [];
    if (c.kind === 'epidemic' && (typeof c.name !== 'string' || !c.name)) c.name = EPI_SEV[c.sev].names[0];
    if (c.kind === 'epidemic') {
      for (const k of ['cases', 'peak', 'cum', 'deaths', 'load']) c[k] = Math.max(0, num(c[k]));
      c.rules = clamp(Math.round(num(c.rules)), 0, 3); c.test = clamp(Math.round(num(c.test)), 0, 2); c.border = c.border ? 1 : 0; c.wave = clamp(Math.round(num(c.wave, 1)), 1, 3);
      c.support = clamp(num(c.support, 70), 0, 100); c.econ = clamp(num(c.econ), 0, 100); c.comp = clamp(num(c.comp, 0.7), 0.4, 1);
      if (!isObj(c.shocked)) c.shocked = {};
      if (!isObj(c.vacc)) c.vacc = {};
      c.vacc.prog = clamp(num(c.vacc.prog), 0, 100); c.vacc.rate = clamp(num(c.vacc.rate), 0, 90); c.vacc.avail = !!c.vacc.avail; c.vacc.fund = clamp(num(c.vacc.fund), 0, 3); c.vacc.roll = num(c.vacc.roll);
      c.benefitUntil = num(c.benefitUntil); c.hide = c.hide ? 1 : 0; c.r0 = clamp(num(c.r0, EPI_SEV[c.sev].r0), 0.8, 4);
      if (!['outbreak', 'peak', 'decline', 'over'].includes(c.stage)) c.stage = 'outbreak';
    } else {
      c.outage = clamp(num(c.outage), 0, 100); c.peakOutage = Math.max(c.outage, num(c.peakOutage)); c.leak = Math.max(0, num(c.leak)); c.speed = Math.max(0.5, num(c.speed, 4));
      if (!TARGETS[c.target]) c.target = 'transport';
      if (typeof c.name !== 'string' || !c.name) c.name = `${TARGETS[c.target].name}へのサイバー攻撃`;
      c.ransom = isObj(c.ransom) ? { amount: num(c.ransom.amount), day: num(c.ransom.day, c.start) } : null;
      c.attr = c.attr === 'state' ? 'state' : 'criminal'; c.evidence = clamp(num(c.evidence), 0, 100);
      if (!NATION_ORDER.includes(c.nation)) c.nation = NATION_ORDER[0];
      if (!['down', 'recovering', 'over'].includes(c.stage)) c.stage = 'down';
    }
  }
  return S;
}
const say = (g, S, text, o = {}) => {
  S.log.unshift({ day: today(g), text }); if (S.log.length > 40) S.log.length = 40;
  if (S.cur) { S.cur.log.unshift({ day: today(g), text }); if (S.cur.log.length > 30) S.cur.log.length = 30; }
  if (o.news !== false) { try { RX.news(g, text); } catch (e) { /* no regime */ } }
  if (o.phone && S.phoneDay !== today(g)) { S.phoneDay = today(g); try { RX.phone(g, `${text}`, o.from || 'ドット新聞'); } catch (e) { /* no phone */ } } // one message a morning at most
};
const approve = (g, d, text) => { if (isPM(g)) { try { RX.bumpApproval(g, d, 0, 'crisis', text); } catch (e) { /* ignore */ } } };
const rep = (g, d) => { const p = pol(g); if (p && p.me) p.me.reputation = clamp(num(p.me.reputation) + d, -100, 100); };
const calMonth = (g) => polDate(g).month;
const nationName = (c) => (FICTIONAL_NATIONS[c.nation] || {}).name || c.nation;

// ======================================================================== starting a crisis
export function startEpidemic(g, o = {}) {
  const S = ensure(g);
  if (!S || S.cur) return null;
  const sev = clamp(num(o.sev) || (roll(0.55) ? 1 : roll(0.78) ? 2 : 3), 1, 3);
  const E = EPI_SEV[sev];
  const c = {
    id: `e${today(g)}`, kind: 'epidemic', name: o.name || E.names[rint(0, 1)], start: today(g), sev, wave: 1, stage: 'outbreak', cases: sev === 1 ? 40 : 15, peak: 0, cum: 0, deaths: 0, load: 0,
    rules: 0, border: 0, test: 0, support: 70, econ: 0, shocked: {}, vacc: { prog: 0, avail: false, rate: 0, fund: 0, roll: 0 }, benefitUntil: 0, hide: 0, comp: 0.5 + rng() * 0.5, log: [], r0: E.r0,
  };
  S.cur = c; S.lastEpi = today(g);
  say(g, S, `${c.name}の感染が国内で確認された。政府は対策本部を設けた。（${E.label}）`, { phone: true, from: 'ドット新聞 社会部' });
  return c;
}
export function startCyber(g, o = {}) {
  const S = ensure(g);
  if (!S || S.cur) return null;
  const sev = clamp(num(o.sev) || (roll(0.5) ? 1 : roll(0.7) ? 2 : 3), 1, 3);
  const target = TARGETS[o.target] ? o.target : ['transport', 'hospital', 'finance', 'power'][rint(0, 3)];
  const withRansom = o.ransom !== undefined ? !!o.ransom : roll(0.5);
  const c = {
    id: `c${today(g)}`, kind: 'cyber', name: `${TARGETS[target].name}へのサイバー攻撃`, start: today(g), sev, target, stage: 'down', outage: [0, 45, 65, 85][sev] + rint(0, 8), leak: [0, 2, 20, 120][sev] * (roll(0.5) ? 0 : 1),
    speed: 3.5, experts: 0, ransom: withRansom ? { amount: [0, 300000000, 1500000000, 6000000000][sev], day: today(g) } : null, paid: 0, pub: null, attr: o.attr || (roll(0.3) ? 'state' : 'criminal'), nation: NATION_ORDER[rint(0, NATION_ORDER.length - 1)],
    evidence: rint(5, 20), attributed: 0, cost: 0, log: [], peakOutage: 0,
  };
  c.peakOutage = c.outage; if (S.defense > 60) { c.outage *= 0.8; c.leak *= 0.5; } else if (S.defense < 30) { c.outage = Math.min(100, c.outage * 1.15); }
  c.outage = Math.round(c.outage);
  S.cur = c; S.lastCyber = today(g);
  say(g, S, `${TARGETS[target].what}。サイバー攻撃とみられる。政府は対策本部を設け、原因を調べている。`, { phone: true, from: 'ドット新聞 社会部' });
  return c;
}

// ======================================================================== the epidemic, day by day
function epiReff(g, c, S) {
  const month = calMonth(g);
  const season = 1 + 0.15 * Math.cos((2 * Math.PI * (month - 1)) / 12);
  const immune = clamp(c.cum / POP + (c.vacc.rate / 100) * 0.8, 0, 0.9);
  const eff = c.rules * (0.35 + 0.65 * c.support / 100);
  return num(c.r0, 1.7) * season * (1 - immune) * (1 - 0.2 * eff) * Math.pow(0.95, c.test) * (c.hide ? 1.03 : 1);
}
function epiStep(g, c, S) {
  const E = EPI_SEV[c.sev];
  const day = today(g);
  const reff = epiReff(g, c, S);
  const imp = (c.border ? 0.3 : 1) * (c.cases < 1 ? 2 : 0.3);
  c.cases = clamp(c.cases * Math.exp((reff - 1) * 0.45) + imp, 0, 600000);
  c.r0 = Math.max(0.9, num(c.r0, E.r0) * (c.sev === 1 ? 0.996 : 0.999)); // the virus and the people's habits settle with time
  c.cum += c.cases * 3;
  c.load = clamp(((c.cases * E.hosp * 9) / (CAP * S.beds / 100)) * 100, 0, 400);
  c.deaths += c.cases * 3 * E.fat * (1 + Math.max(0, c.load - 100) / 80);
  c.peak = Math.max(c.peak, c.cases);
  // patience and the economy
  c.support = clamp(c.support + (c.rules > 0 ? -0.25 * c.rules : 0.5) + (c.benefitUntil > day ? 0.25 : 0), 0, 100);
  const benefit = c.benefitUntil > day ? 0.5 : 1;
  c.econ = clamp(c.econ + (c.rules * 0.35 + c.border * 0.12 + c.test * 0.05) * benefit - (c.rules === 0 ? 0.5 : 0), 0, 100);
  // the vaccine
  if (!c.vacc.avail && c.sev >= 2) {
    c.vacc.prog = clamp(c.vacc.prog + 0.7 + c.vacc.fund * 0.5, 0, 100);
    if (c.vacc.prog >= 100) { c.vacc.avail = true; say(g, S, `ワクチンの承認が決まった。接種が始まる。（${c.name}）`, { phone: true }); }
  } else if (c.vacc.avail) {
    c.vacc.rate = clamp(c.vacc.rate + 0.25 + (c.vacc.roll > day ? 0.35 : 0), 0, 85);
  }
  // the data can be bent; the bending can leak
  if (c.hide && roll(0.012)) {
    c.hide = 0;
    say(g, S, '感染状況のデータの公表を絞っていたことが、内部の資料から明らかになった。', { phone: isPM(g) });
    if (isPM(g)) { try { g.politicalScandal('coverup', { who: 'player', name: '感染状況のデータの公表の操作（隠蔽の疑い）', severity: 3 }); } catch (e) { console.error(e); } }
    c.support = clamp(c.support - 15, 0, 100); approve(g, -3, 'データの公表の操作が発覚');
  }
  // the economy shocks when an emergency is first declared
  if (c.rules >= 2 && !c.shocked[c.rules]) {
    c.shocked[c.rules] = true;
    try { RX.ecoShock(g, `${c.name}の行動制限`, { growth: c.rules === 3 ? -2 : -0.9, unemployment: c.rules === 3 ? 0.6 : 0.25, len: 120, nikkei: c.rules === 3 ? -8 : -3 }); } catch (e) { /* no economy */ }
  }
  // stages and the news
  if (c.stage === 'outbreak' && c.cases >= 400) { c.stage = 'peak'; say(g, S, `${c.name}の感染が広がっている。新規の感染者は1日あたり約${n0(c.cases)}人。`, { phone: true }); }
  if (c.load >= 100 && !c.overload) { c.overload = true; say(g, S, '病院の病床が足りなくなってきた。医療の現場は、ぎりぎりの状態が続いている。', { phone: true }); }
  if (c.load < 70) c.overload = false;
  if ((c.stage === 'outbreak' || c.stage === 'peak') && c.peak >= 30 && c.cases < c.peak * 0.4) { c.stage = 'decline'; say(g, S, `感染の拡大はおさまりつつある。新規の感染者は1日あたり約${n0(c.cases)}人まで減った。`); }
  if (c.stage === 'decline' && c.cases < Math.max(10, c.peak * 0.05)) {
    const immune = c.cum / POP + c.vacc.rate / 100 * 0.8;
    if (c.wave >= 3 || immune > 0.35 || c.sev === 1 || roll(0.3)) return endCrisis(g, S);
    c.wave++; c.r0 = num(c.r0, 1.7) * 1.2; c.stage = 'outbreak'; c.cases = Math.max(c.cases, 30); c.peak = 0; c.cum += 0;
    say(g, S, `${c.name}の新しい変異が見つかり、感染がふたたび広がり始めた。（第${c.wave}波）`, { phone: true });
  }
  if (S.cur && (c.cases < 1 || day - c.start > YEAR * 12)) endCrisis(g, S);
}
function epiAuto(g, c, S) {
  // the government answers when the player does not (every 3 days, with its competence)
  const day = today(g);
  if (day % 3 !== 0) return;
  const want = c.load > 60 || c.cases > 20000 ? 3 : c.load > 30 || c.cases > 1500 ? 2 : c.cases > 50 ? 1 : 0;
  const lawOK = polDate(g).year >= 2012;
  const target = !lawOK ? Math.min(2, want) : want;
  if (target > c.rules && roll(0.35 + 0.5 * c.comp)) setRules(g, c, S, c.rules + 1, 'gov');
  else if (target < c.rules && roll(0.3 + 0.4 * c.comp)) setRules(g, c, S, c.rules - 1, 'gov');
  if (c.support < 50 && c.rules > 0 && roll(0.12 * c.comp)) { c.support = clamp(c.support + 6, 0, 100); say(g, S, '首相が記者会見を開き、対策への協力を呼びかけた。', { news: false }); }
  if (!c.border && c.sev >= 2 && c.cases < 3000 && roll(0.4 * c.comp)) { c.border = 1; say(g, S, '政府は、水際対策を強化し、入国を制限すると発表した。'); }
  if (c.test < 2 && c.cases > 200 && roll(0.12 * c.comp)) { c.test++; say(g, S, '政府は、検査と追跡の体制を拡充すると発表した。'); }
  if (!c.vacc.fund && c.sev >= 2 && roll(0.1 * c.comp)) { c.vacc.fund = 1; say(g, S, '政府は、ワクチンの開発を支援すると発表した。'); }
  if (c.vacc.avail && c.vacc.roll < day && roll(0.1 * c.comp)) { c.vacc.roll = day + 30; say(g, S, '政府は、大規模な接種会場を設けて、接種を加速すると発表した。'); }
  if (c.load > 70 && S.beds < 150 && roll(0.08 * c.comp)) { S.beds = Math.min(175, S.beds + 25); say(g, S, '政府は、病床の確保を医療機関に要請した。'); }
  if (c.rules >= 2 && c.benefitUntil < day && roll(0.1 * c.comp)) { c.benefitUntil = day + 30; say(g, S, '政府は、休業した事業者への給付金を決めた。'); }
}
function setRules(g, c, S, level, by) {
  const old = c.rules;
  c.rules = clamp(level, 0, 3);
  if (c.rules === old) return;
  say(g, S, `${by === 'gov' ? '政府は' : by === 'player' ? '対策本部は' : '政府は'}行動制限を「${RULE_NAMES[c.rules]}」にした。`, { phone: c.rules >= 2 });
}
function endCrisis(g, S) {
  const c = S.cur;
  if (!c) return;
  c.stage = 'over';
  let grade, text, score;
  if (c.kind === 'epidemic') {
    score = Math.round(clamp(100 - Math.min(45, 22 * c.deaths / [0, 1500, 15000, 150000][c.sev]) - Math.min(25, c.econ * 0.3) - Math.min(20, num(c.maxLoad, c.load) / 8) + c.support * 0.1, 0, 100));
    grade = score >= 70 ? '評価された' : score >= 45 ? '評価が分かれた' : '厳しく批判された';
    text = `${c.name}の流行はおさまった。死者は約${n0(c.deaths)}人、経済の落ち込みは${Math.round(c.econ)}／100。政府の対応は${grade}。`;
  } else {
    score = Math.round(clamp(100 - c.peakOutage * 0.3 - c.leak * 0.3 - (c.paid ? 12 : 0) - (c.pub === 'delay' || c.pub === 'late' ? 10 : 0) - (c.pub === null || c.pub === 'press' ? 8 : 0) + S.defense * 0.1, 0, 100));
    grade = score >= 70 ? '評価された' : score >= 45 ? '評価が分かれた' : '厳しく批判された';
    text = `${c.name}の復旧が終わった。流出した個人情報は約${n0(c.leak)}万件。政府の対応は${grade}。`;
  }
  say(g, S, text, { phone: true });
  if (isPM(g)) approve(g, Math.round(((score - 50) / 12) * 10) / 10, `${c.name}への対応の評価`);
  else if ((isHealth(g) && c.kind === 'epidemic') || (isDigital(g) && c.kind === 'cyber')) rep(g, Math.round((score - 50) / 12));
  c.grade = grade; c.score = score;
  S.past.unshift({ kind: c.kind, name: c.name, start: c.start, end: today(g), grade, score, text });
  S.cur = null; S.lastEnd = today(g);
}

// ======================================================================== the cyber attack, day by day
function cyberStep(g, c, S) {
  const day = today(g);
  const gd = day - c.start;
  // recovery
  const rate = c.speed * (c.experts ? 1.5 : 1) * (S.defense >= 60 ? 1.2 : 1);
  c.outage = clamp(c.outage - rate, 0, 100);
  c.evidence = clamp(c.evidence + 4 + (c.experts ? 4 : 0), 0, 95);
  c.stage = c.outage <= 0 ? 'over' : c.outage < c.peakOutage * 0.5 ? 'recovering' : 'down';
  c.cost += c.outage * 0.4;
  // the ransom: unanswered for 3 days = refused; a refusal leaks
  if (c.ransom && !c.ransom.paid && day - c.ransom.day >= 3) {
    c.ransom = null;
    c.leak = Math.round(c.leak + [0, 8, 60, 250][c.sev]);
    say(g, S, '身代金の要求に、政府は応じなかった。犯行グループは、奪った情報の一部を公開した。', { phone: true });
  }
  // the silence: a delay is found out
  if (c.pub === 'delay' && roll(0.03)) {
    c.pub = 'late';
    say(g, S, '被害の公表を遅らせていたことが、関係者の証言で明らかになった。', { phone: isPM(g) });
    if (isPM(g)) { try { g.politicalScandal('coverup', { who: 'player', name: 'サイバー攻撃の被害の公表の遅れ（隠蔽の疑い）', severity: 3 }); } catch (e) { console.error(e); } }
    approve(g, -2, '被害の公表の遅れが発覚');
  }
  // a payment is found out
  if (c.paid && !c.paidOut && roll(0.02)) { c.paidOut = true; say(g, S, '政府が身代金を支払っていたことが、報じられた。「犯罪を助長する」との批判が出ている。', { phone: isPM(g) }); approve(g, -2, '身代金の支払いが報じられた'); if (S.defense > 10) S.defense -= 5; }
  // an unannounced attack is found by the press after two days
  if (c.pub === null && gd >= 2) { c.pub = 'press'; say(g, S, '政府の発表を待たず、報道各社がサイバー攻撃の被害を伝えた。'); }
  // the economy and the people
  if (c.outage > 40 && !c.shocked) { c.shocked = true; try { RX.ecoShock(g, c.name, { growth: -0.4 * c.sev, len: 60 }); } catch (e) { /* no economy */ } }
  if (c.stage === 'over') endCrisis(g, S);
}
function cyberAuto(g, c, S) {
  const day = today(g);
  if (c.pub === null && day - c.start >= 1 && roll(0.4 + 0.3 * 0.7)) { c.pub = true; say(g, S, '政府は、被害の状況を発表した。'); }
  if (!c.experts && c.sev >= 2 && roll(0.1)) { c.experts = 1; say(g, S, '政府は、民間の専門家と同盟国の支援を受けて、復旧を急いでいる。'); }
  if (c.attr === 'state' && !c.attributed && c.evidence >= 60 && roll(0.08)) { c.attributed = 1; say(g, S, `政府は、${nationName(c)}の関与の疑いを公表し、抗議した。（${nationName(c)}は否定している）`); }
}

// ======================================================================== the morning
function tick(g) {
  const S = ensure(g);
  if (!S) return;
  const day = today(g);
  if (S.lastTick === day) return;
  S.lastTick = day;
  const c = S.cur;
  if (c) {
    c.maxLoad = Math.max(num(c.maxLoad), num(c.load));
    const mine = c.kind === 'epidemic' ? (isPM(g) || isHealth(g)) : (isPM(g) || isDigital(g));
    if (c.kind === 'epidemic') { epiStep(g, c, S); if (S.cur && !mine) epiAuto(g, S.cur, S); }
    else { cyberStep(g, c, S); if (S.cur && !mine) cyberAuto(g, S.cur, S); }
    // the player's own daily drift of the cabinet's standing
    if (S.cur && isPM(g)) {
      const k = S.cur;
      const d = k.kind === 'epidemic' ? ((k.support - 55) / 2500 - (k.load > 100 ? 0.012 : 0) - k.econ / 25000) : -k.outage / 6000;
      S.drift = num(S.drift) + d;
      if (day % 10 === 0) { approve(g, Math.round(S.drift * 100) / 100, `${k.name}への対応`); S.drift = 0; }
    }
    return;
  }
  // a new crisis: not too soon after the last, and not in the first days of a game
  if (day < 20 || day - S.lastEnd < 40) return;
  const year = polDate(g).year;
  if (!S.anchored && year === 2020 && calMonth(g) >= 2) { S.anchored = true; startEpidemic(g, { sev: 2, name: '新型コロナウイルス感染症' }); return; }
  if (year > 2020) S.anchored = true;
  if (roll(0.1 / YEAR)) { startEpidemic(g); return; }
  if (year >= 2000 && roll(((year >= 2015 ? 0.6 : 0.3) / YEAR) * (1.4 - S.defense / 100))) startCyber(g);
}
onMorning((g) => { try { tick(g); } catch (e) { console.error('crisisOps', e); } });

// ======================================================================== the actions
const price = (n) => fmtMoney(n);
function can(g, group) { // which actions the player may use: 'epi' | 'cyber' | 'diet'
  if (group === 'epi') return isPM(g) || isHealth(g);
  if (group === 'cyber') return isPM(g) || isDigital(g);
  return inDiet(g) || isPM(g);
}
export function actions(g) {
  const S = ensure(g);
  if (!S) return [];
  const c = S.cur;
  const day = today(g);
  const out = [];
  const A = (id, group, name, desc, lines, o = {}) => out.push({ id, group, name, desc, lines, cost: o.cost || 0, why: o.why || null });
  const cool = (id, n) => (S.cool[id] && day - S.cool[id] < n ? `あと${n - (day - S.cool[id])}日` : null);
  if (c && c.kind === 'epidemic') {
    const ok = can(g, 'epi'), pm = isPM(g);
    const lawOK = polDate(g).year >= 2012;
    const noRole = ok ? null : '総理大臣か厚生労働大臣のときに使える';
    A('rules_up', '行動制限', '行動制限を強める', `いまは「${RULE_NAMES[c.rules]}」。${c.rules < 3 ? `つぎは「${RULE_NAMES[c.rules + 1]}」。` : ''}`, ['感染が減る（市民の協力が高いほど効く）', '経済の落ち込みが進み、市民の自粛疲れがたまる', c.rules + 1 === 3 ? '緊急事態宣言は、特措法（2012年〜）にもとづく' : '要請であり、罰則はない'],
      { why: noRole || (c.rules >= 3 ? 'これ以上は強められない' : c.rules + 1 === 3 && !pm ? '宣言は総理大臣が決める' : c.rules + 1 === 3 && !lawOK ? '特措法がまだない（2012年〜）' : cool('rules', 3)) });
    A('rules_down', '行動制限', '行動制限をゆるめる', `いまは「${RULE_NAMES[c.rules]}」。`, ['経済が戻り、市民の協力が回復する', '感染がふたたび増える危険'], { why: noRole || (c.rules <= 0 ? 'すでに制限はない' : cool('rules', 3)) });
    A('border', '行動制限', c.border ? '水際対策を解く' : '水際対策（入国の制限）', '外国からの入国を制限する。', c.border ? ['国外からの感染の流入がふえる', '観光・留学生・貿易の支障が減る'] : ['国外からの感染の流入が7割減る', '観光・留学生・貿易に支障が出る（経済 −）'], { why: noRole });
    A('test', '医療', '検査・追跡を拡充する', `いまは水準${c.test}／2。`, ['感染の広がりが5%おさえられる', '費用がかかる'], { cost: 2000000000, why: noRole || (c.test >= 2 ? 'すでに最大' : cool('test', 10)) });
    A('beds', '医療', '病床を確保する', `いまの医療の余力は指数${S.beds}（175まで）。`, ['感染者を受け入れる病床が25%ふえる', '医療機関への補助が必要（費用大）'], { cost: 5000000000, why: noRole || (S.beds >= 175 ? 'これ以上は増やせない' : cool('beds', 8)) });
    if (!c.vacc.avail && c.sev >= 2) A('vacc_fund', '医療', 'ワクチンの開発を支援する', `開発の進み具合：${Math.round(c.vacc.prog)}%。`, ['承認までの期間が短くなる（最大3回）', '予算の支出が大きい'], { cost: 8000000000, why: noRole || (c.vacc.fund >= 3 ? 'これ以上は上積みできない' : cool('vacc', 10)) });
    if (c.vacc.avail) A('vacc_roll', '医療', '接種を加速する（大規模接種会場）', `接種率：${Math.round(c.vacc.rate)}%。`, ['30日間、接種のペースが2.4倍になる', '会場・人員の費用がかかる'], { cost: 4000000000, why: noRole || (c.vacc.roll > day ? 'いま加速している' : c.vacc.rate >= 85 ? 'すでに十分' : null) });
    A('benefit', '暮らしと情報', '給付金・休業の補償を出す', '休業した事業者と、困った世帯に、給付金を出す。', ['30日間、経済の落ち込みが半分になる', '市民の協力が少し上がる', '国の支出が大きい'], { cost: 12000000000, why: !pm ? '総理大臣が決める' : c.benefitUntil > day ? 'いま給付している' : null });
    A('explain', '暮らしと情報', '記者会見で説明する', 'いまの状況と、対策の理由を、自分の言葉で説明する。', ['市民の協力が +6', '内閣の支持が少し上がる'], { why: !ok ? noRole : cool('explain', 6) });
    A('hide', '暮らしと情報', c.hide ? 'データの公表を元に戻す' : 'データの公表を絞る', '感染者数などのデータの公表を、最小限にする。', c.hide ? ['隠蔽の疑いのリスクがなくなる'] : ['市民の不安がおさえられる（協力が +3）', '内部から漏れる危険（毎日1.2%）。漏れると隠蔽のスキャンダルになる'], { why: noRole });
  }
  if (c && c.kind === 'cyber') {
    const ok = can(g, 'cyber');
    const noRole = ok ? null : '総理大臣かデジタル大臣・総務大臣のときに使える';
    A('restore', '復旧', '復旧を急ぐ（重要インフラを優先）', `システムの停止の深さ：${Math.round(c.outage)}%。`, ['復旧が速くなる（+3／日、10日間）', '予算の支出が大きい'], { cost: 1500000000, why: noRole || (c.speed > 4 ? 'いま急いでいる' : cool('restore', 6)) });
    A('experts', '復旧', '専門家・同盟国の支援を受ける', '民間の専門家と同盟国の技術の支援を受ける。', ['復旧が1.5倍になる・原因の特定が早まる', '同盟国との関係が深まる'], { why: noRole || (c.experts ? 'すでに受けている' : null) });
    if (c.ransom) {
      A('ransom_pay', '身代金', '身代金を支払う', `要求額 ${price(c.ransom.amount)}。あと${Math.max(0, 3 - (day - c.ransom.day))}日で返事がなければ、断ったことになる。`, ['停止が7割回復し、情報の流出もおさえられる', '報じられると「犯罪を助長する」と批判される（毎日2%）。防御も下がる'], { cost: c.ransom.amount, why: noRole });
      A('ransom_refuse', '身代金', '身代金を断る', '応じないという方針を、はっきりと示す。', ['犯行グループは、奪った情報の一部を公開する（流出がふえる）', '犯罪を助長しないという立場は守られる'], { why: noRole });
    }
    if (c.pub === null) {
      A('announce', '公表', '被害と原因を、すぐに公表する', '何が起きているかを、ありのままに伝える。', ['市民の不安は出るが、信頼が保たれる', '評価が上がる'], { why: noRole });
      A('delay', '公表', '公表を遅らせる', '原因がわかるまで、公表を見合わせる。', ['当面の混乱はおさえられる', '2日以内に報じられ、遅れが批判される。公表の遅れが発覚すると隠蔽のスキャンダル（毎日3%）'], { why: noRole });
    }
    if (c.attr === 'state' && !c.attributed) A('attribute', '外交', `原因を特定して、${nationName(c)}の関与を公表する`, `証拠の確からしさ：${Math.round(c.evidence)}%（日がたつと上がる）。`, [`確からしさの分だけ成功する。成功すれば、${nationName(c)}との関係が悪化するが、防御は強まる`, '失敗すると「根拠が不十分」と批判される'], { why: noRole });
  }
  if (S.defense < 100 && (isPM(g) || isDigital(g))) A('defense', '備え', 'サイバー防御を強化する', `いまの防御の水準：${Math.round(S.defense)}／100。`, ['防御 +10（攻撃の起きにくさ・被害の小ささ）', '予算の支出が大きい'], { cost: 3000000000, why: cool('defense', 20) });
  if (c && inDiet(g) && !isPM(g)) A('grill', '国会', '国会で政府の対応を追及する', '委員会で、政府の対応の遅れや不備を質す。', ['内閣の支持 −0.5', '自分の評判 +1'], { why: cool('grill', 8) });
  return out;
}
export function act(g, id, o = {}) {
  const S = ensure(g);
  const row = actions(g).find((a) => a.id === id);
  if (!S || !row) return { ok: false, why: 'その手はない' };
  if (row.why) return { ok: false, why: row.why };
  const c = S.cur;
  const day = today(g);
  const cool = (k) => { S.cool[k] = day; };
  let text = '';
  if (id === 'defense') { S.defense = Math.min(100, S.defense + 10); cool('defense'); text = `サイバー防御を強化した。（水準 ${Math.round(S.defense)}）`; }
  else if (id === 'grill') { const p = pol(g); if (p && p.cabinet) p.cabinet.mood = clamp(num(p.cabinet.mood) - 0.5, -20, 20); rep(g, 1); cool('grill'); text = '委員会で、政府の対応を質した。'; }
  else if (c && c.kind === 'epidemic') {
    if (id === 'rules_up') { setRules(g, c, S, c.rules + 1, 'player'); cool('rules'); text = `行動制限を「${RULE_NAMES[c.rules]}」に強めた。`; }
    else if (id === 'rules_down') { setRules(g, c, S, c.rules - 1, 'player'); cool('rules'); text = `行動制限を「${RULE_NAMES[c.rules]}」にゆるめた。`; }
    else if (id === 'border') { c.border = c.border ? 0 : 1; text = c.border ? '水際対策を始めた。' : '水際対策を解いた。'; }
    else if (id === 'test') { c.test++; cool('test'); text = `検査・追跡を拡充した。（水準${c.test}）`; }
    else if (id === 'beds') { S.beds = Math.min(175, S.beds + 25); cool('beds'); text = `病床を確保した。（医療の余力 指数${S.beds}）`; }
    else if (id === 'vacc_fund') { c.vacc.fund++; cool('vacc'); text = 'ワクチンの開発を支援した。承認までの期間が短くなる。'; }
    else if (id === 'vacc_roll') { c.vacc.roll = day + 30; text = '大規模接種会場を設け、接種を加速した。'; }
    else if (id === 'benefit') { c.benefitUntil = day + 30; c.support = clamp(c.support + 4, 0, 100); text = '給付金と休業の補償を出した。'; }
    else if (id === 'explain') { c.support = clamp(c.support + 6, 0, 100); cool('explain'); approve(g, 0.8, '記者会見での説明'); rep(g, 1); text = '記者会見で、いまの状況と対策の理由を説明した。'; }
    else if (id === 'hide') { c.hide = c.hide ? 0 : 1; if (c.hide) c.support = clamp(c.support + 3, 0, 100); text = c.hide ? '感染状況のデータの公表を絞った。' : 'データの公表を元に戻した。'; }
    if (row.cost) text += `（国の支出 約${price(row.cost)}）`;
  } else if (c && c.kind === 'cyber') {
    if (id === 'restore') { c.speed += 3; cool('restore'); text = '復旧を急いだ。重要なインフラから順に回復している。'; }
    else if (id === 'experts') { c.experts = 1; text = '専門家と同盟国の技術の支援を受けることにした。'; }
    else if (id === 'ransom_pay') { c.paid = 1; c.outage *= 0.3; c.leak *= 0.3; c.ransom = null; text = `身代金（${price(row.cost)}）を支払った。システムは大きく回復した。`; }
    else if (id === 'ransom_refuse') { c.ransom = null; c.leak = Math.round(c.leak + [0, 8, 60, 250][c.sev]); text = '身代金の要求を断った。犯行グループは、奪った情報の一部を公開した。'; }
    else if (id === 'announce') { c.pub = true; approve(g, 0.5, 'サイバー攻撃の被害を速やかに公表'); text = '被害と原因を、すぐに公表した。'; }
    else if (id === 'delay') { c.pub = 'delay'; text = '公表を見合わせた。'; }
    else if (id === 'attribute') {
      c.attributed = 1;
      if (roll(c.evidence / 100)) { S.defense = Math.min(100, S.defense + 5); say(g, S, `政府は、${nationName(c)}の関与を公表し、抗議した。（${nationName(c)}は否定している）`); text = `${nationName(c)}の関与を公表した。防御への意識が高まった。`; }
      else { approve(g, -1.5, '関与の特定の根拠が不十分'); text = '根拠が不十分だとして、批判された。'; }
    }
    if (row.cost) text += `（国の支出 約${price(row.cost)}）`;
  }
  say(g, S, text, { news: false });
  return { ok: true, text };
}

// ======================================================================== the summary and the API
function lines(g, c, S) {
  if (!c) return [];
  if (c.kind === 'epidemic') {
    const E = EPI_SEV[c.sev];
    const out = [`${c.name}（${E.label}・第${c.wave}波）`, `新規の感染者：約${n0(c.cases)}人／日`, `医療の負荷：${Math.round(c.load)}%${c.load >= 100 ? '（ひっ迫）' : ''}`, `累計の死者：約${n0(c.deaths)}人`,
      `行動制限：${RULE_NAMES[c.rules]}${c.border ? '・水際対策' : ''}`, `市民の協力：${Math.round(c.support)}／100`, `経済の落ち込み：${Math.round(c.econ)}／100`];
    if (c.sev >= 2) out.push(c.vacc.avail ? `ワクチン：接種率 ${Math.round(c.vacc.rate)}%` : `ワクチン：開発 ${Math.round(c.vacc.prog)}%`);
    if (c.hide) out.push('（データの公表を絞っている）');
    return out;
  }
  return [`${c.name}`, `${TARGETS[c.target].what}`, `停止の深さ：${Math.round(c.outage)}%`, `流出した個人情報：約${n0(c.leak)}万件`, c.ransom ? `身代金の要求：${price(c.ransom.amount)}（返事の期限 あと${Math.max(0, 3 - (today(g) - c.ransom.day))}日）` : '身代金の要求：なし',
    c.attr === 'state' ? `原因：国家の関与が疑われる（確からしさ ${Math.round(c.evidence)}%）` : '原因：犯罪集団とみられる', `公表：${c.pub === null ? 'まだ' : c.pub === 'delay' ? '見合わせ中' : '済み'}`];
}
function summary(g) {
  const S = ensure(g);
  if (!S) return null;
  const c = S.cur;
  const role = isPM(g) ? '総理大臣' : isHealth(g) ? '厚生労働大臣' : isDigital(g) ? 'デジタル・総務大臣' : inDiet(g) ? '国会議員' : null;
  return { active: !!c, kind: c ? c.kind : null, name: c ? c.name : null, lines: lines(g, c, S), role, canAct: c ? can(g, c.kind === 'epidemic' ? 'epi' : 'cyber') : false, defense: Math.round(S.defense), beds: S.beds,
    past: S.past.slice(0, 8).map((p) => ({ ...p, date: dateLabel(g, p.start) })), log: S.log.slice(0, 15).map((l) => ({ date: dateLabel(g, l.day), text: l.text })), stage: c ? c.stage : null };
}
const METHODS = {
  crisisOps() { return summary(this); },
  crisisOpsActions() { return actions(this); },
  crisisOpsAct(id, o) { return act(this, id, o || {}); },
  crisisOpsStart(kind, o) { const S = ensure(this); if (!S) return null; return kind === 'cyber' ? startCyber(this, o || {}) : startEpidemic(this, o || {}); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__crisis = { setCrisisRng, tick: (g) => tick(g), startEpidemic, startCyber, epiReff: (g) => { const S = ensure(g); return S && S.cur && S.cur.kind === 'epidemic' ? epiReff(g, S.cur, S) : null; } };

// ======================================================================== the phone app 「対策本部」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 14, y + 8, 4, 16, '#f4ecd8'); R(c, x + 8, y + 14, 16, 4, '#f4ecd8');
}
async function runAct(g, a) {
  const ok = !a.why;
  const text = `${a.desc}\n\n${bulletText(a.lines)}${a.cost ? `\n\n国の支出 約${price(a.cost)}` : ''}${a.why ? `\n\n（${a.why}）` : ''}`;
  const i = await phoneConfirm(g, { title: a.name.length > 12 ? '方針' : a.name, color: COLOR, text, choices: ok ? ['実行する', 'やめる'] : ['もどる'] });
  if (!ok || i !== 0) return;
  const r = g.crisisOpsAct(a.id);
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: a.name.length > 12 ? '結果' : a.name, color: COLOR, text: r.ok ? r.text : r.why });
}
async function openApp(g) {
  for (let guard = 0; guard < 60; guard++) {
    const s = g.crisisOps();
    if (!s) { await phoneInfo(g, { title: '対策本部', color: COLOR, text: 'いまは使えない。' }); return; }
    const acts = g.crisisOpsActions();
    const rows = [];
    rows.push({ label: s.active ? '現在の危機' : '現在の危機はない', sub: s.active ? `${s.name}` : `防御${s.defense}・医療の余力${s.beds}`, run: async () => { await phoneInfo(g, { title: s.active ? s.name.slice(0, 12) : '状況', color: COLOR, text: s.active ? `${s.lines.join('\n')}\n\nあなたの立場：${s.role || 'なし'}${s.canAct ? '（対策を決められる）' : '（政府の対応を見守る）'}` : `いまは感染症もサイバー攻撃も起きていない。\n\nサイバー防御の水準：${s.defense}／100\n医療の余力：指数${s.beds}`.replace(/\n\n$/, '') }); } });
    for (const a of acts) rows.push({ label: a.name, sub: a.why ? a.why : `${a.group}${a.cost ? `・国費${price(a.cost)}` : ''}`, run: () => runAct(g, a) });
    rows.push({ label: '経過と過去の危機', sub: `${s.past.length}件`, run: async () => { await phoneInfo(g, { title: '経過', color: COLOR, text: `${s.log.length ? s.log.map((l) => `■${l.date}\n${l.text}`).join('\n\n') : 'まだ記録はない。'}${s.past.length ? `\n\n【過去の危機】\n${s.past.map((p) => `・${p.date} ${p.name}（${p.grade}）`).join('\n')}` : ''}` }); } });
    const i = await phoneList(g, { title: '対策本部', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('taisaku', {
  name: '対策本部', color: COLOR, order: 66.95,
  iconHD: icon,
  cond: (g) => { try { const S = ensure(g); return !!S && (!!S.cur || S.past.length > 0 || isPM(g) || isHealth(g) || isDigital(g)); } catch (e) { return false; } },
  open: (g) => openApp(g),
});
export { openApp as openCrisisOpsApp, tick as crisisOpsTick };
