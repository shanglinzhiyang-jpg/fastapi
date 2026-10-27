// 独裁の統治 (R17-A) — what ruling a dictatorship is like once the elections and the Diet have stopped (regime.js makes the dictatorship; this module is
// the long life inside it): who keeps the regime standing (国軍・治安機関・党と官僚 — and the people, read from the approval), the 人事 and 恩賞 and 摘発
// that keep them in line, the cult of personality, the 国家計画, the 国家行事, the 後継者, and what happens when the base cracks: a plot in the army
// (クーデター), a challenge inside the party (党内の政変), a security agency that stops obeying, an attempt on the ruler's life, and the ruler's own age.
//
// Rules (the same as regime.js, see its header): nothing is refused for being bad — every step shows its effect, its price and its odds first; real parties
// never decide such a path (the player breaks away in regime.js); all of it is told abstractly and non-graphically (no body, no torture, no violence is drawn or
// described: 摘発・拘束・解任 are words and numbers); the people and the institutions are fictional and anonymous.
//
// State g.state.rule (lazy; one per dictatorship — it is made again when regime.since changes):
//   { v, since, started, pillars: { army, police, party } (0..100 loyalty), fear (0..100), shield (days: plots are less likely), cult (0..5), plan: null |
//     { focus, start, end, q }, heir: null | { kind, day }, cool: { id: day }, purges: [days], detained, armsBonus, lastPlot / lastAttempt / lastPolice /
//     lastParty / lastScare, pending: null | { kind, day }, log: [{ day, text }], lastTick }
// The people's side is not stored: it is the cabinet approval (RX.approvalOf).
//
// API (on Game): g.rule() → the summary (active, pillars, people, fear, shield, cult, plan, heir, coupRisk, log); g.ruleActions() → [{ id, group, name, desc,
//   lines, odds, why }]; g.ruleAct(id, opts) → { ok, why?, text? } (opts: { target } for 摘発, { focus } for 国家計画, { kind } for 後継者);
//   g.ruleRespond(kind, choice) → the answer to a pending event ('plot' | 'police' | 'party' | 'attempt'); g.ruleLog().
// The phone app 「統治」 (id 'touchi', order 62.4) shows with a dictatorship; the scenes are registered with regime.js (registerRegimeScene).

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { ageOf } from './profile.js';
import { clamp } from './util.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText, phoneText as T } from './phone.js';
import { RX, WAR_MODS, registerRegimeScene, queueRegimeScene, showRegimeScene } from './regime.js';
import '../world/rule_art.js';

const { num, roll, rint, today } = RX;
const COLOR = '#a8323e';
export const PILLAR_NAMES = { army: '国軍', police: '治安機関', party: '党と官僚' };
export const FOCUS = {
  heavy: { name: '重工業', desc: '製鉄・機械・エネルギーに力を入れる。' },
  farm: { name: '農業', desc: '農地と食糧の増産に力を入れる。' },
  arms: { name: '軍需', desc: '兵器の生産と軍の整備に力を入れる。' },
  goods: { name: '消費財', desc: '生活物資の増産に力を入れる。' },
};
export const HEIRS = {
  party: { name: '党の筆頭幹部', line: '党の筆頭幹部を後継者に指名した。' },
  army: { name: '軍の司令官', line: '軍の司令官を後継者に指名した。' },
  family: { name: '身内（子ども）', line: '身内を後継者に指名した。' },
};
const CULT_STEPS = [
  { name: '肖像と標語', line: '役所・学校・駅に、指導者の肖像と標語が掲げられた。', approval: 2, lasting: 0.5, intl: 0.5 },
  { name: '記念日と式典', line: '指導者をたたえる記念日が定められ、各地で式典が開かれた。', approval: 3, lasting: 0.6, intl: 1, army: 2 },
  { name: '教科書と放送', line: '教科書と放送が、指導者の功績を大きく伝えるようになった。', approval: 3, lasting: 0.8, intl: 2, press: -3 },
  { name: '巨大な記念碑', line: '首都の広場に、巨大な記念碑と像がつくられた。費用は国庫から出た。', approval: 4, lasting: 0.8, intl: 2.5, unrest: -1 },
  { name: '「国父」の称号', line: '指導者は「国父」の称号と、終身の地位を与えられた。', approval: 5, lasting: 1, intl: 4, party: -3 },
];
// the yearly chance of dying by age (a rough table); the game's year is YEAR_DAYS days
const MORT = [[50, 0.004], [60, 0.012], [65, 0.02], [70, 0.035], [75, 0.06], [80, 0.1], [85, 0.17], [95, 0.35]];
const YEAR = 120;
const qx = (age) => { if (age <= MORT[0][0]) return MORT[0][1] * 0.5; for (let i = 1; i < MORT.length; i++) if (age <= MORT[i][0]) { const [a0, q0] = MORT[i - 1], [a1, q1] = MORT[i]; return q0 + ((q1 - q0) * (age - a0)) / (a1 - a0); } return MORT[MORT.length - 1][1]; };

// ======================================================================== state
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function fresh(g, r) {
  return {
    v: 1, since: r.since, started: today(g),
    pillars: { army: 52 + (r.steps.army ? 10 : 0), police: 52 + (r.steps.opposition ? 6 : 0) + (r.steps.censor ? 4 : 0), party: 50 },
    fear: 0, shield: 0, cult: 0, plan: null, heir: null, cool: {}, purges: [], detained: 0, armsBonus: 0,
    lastPlot: -99, lastAttempt: -99, lastPolice: -99, lastParty: -99, lastScare: -99, pending: null, log: [], lastTick: 0,
  };
}
function normal(u) {
  for (const k of ['army', 'police', 'party']) u.pillars[k] = clamp(num(u.pillars[k], 50), 0, 100);
  u.fear = clamp(num(u.fear), 0, 100); u.shield = Math.max(0, num(u.shield)); u.cult = clamp(Math.round(num(u.cult)), 0, 5);
  u.detained = Math.max(0, Math.round(num(u.detained))); u.armsBonus = clamp(num(u.armsBonus), 0, 0.2);
  if (!isObj(u.cool)) u.cool = {};
  if (!Array.isArray(u.purges)) u.purges = [];
  if (!Array.isArray(u.log)) u.log = [];
  for (const k of ['lastPlot', 'lastAttempt', 'lastPolice', 'lastParty', 'lastScare', 'lastTick']) u[k] = num(u[k], -99);
  if (u.plan && (!isObj(u.plan) || !FOCUS[u.plan.focus])) u.plan = null;
  if (u.heir && (!isObj(u.heir) || !HEIRS[u.heir.kind])) u.heir = null;
  if (u.pending && (!isObj(u.pending) || !u.pending.kind)) u.pending = null;
  return u;
}
// the stored rule state (old or current) or null
export function rule(g) {
  const st = g && g.state;
  if (!st || !isObj(st.rule) || !isObj(st.rule.pillars)) return null;
  return normal(st.rule);
}
export const active = (g) => { const r = g && g.state ? RX.R(g) : null; return !!r && r.id === 'dictatorship' && !r.lifeOver; };
// the state of the dictatorship now (made when a new one begins)
function ensure(g) {
  const r = RX.R(g);
  let u = g.state.rule;
  if (!isObj(u) || !isObj(u.pillars) || u.since !== r.since) u = g.state.rule = fresh(g, r);
  return normal(u);
}
const people = (g) => Math.round(RX.approvalOf(g));
function logRule(g, u, text, opts = {}) {
  u.log.unshift({ day: today(g), text });
  if (u.log.length > 40) u.log.length = 40;
  if (opts.news !== false) RX.news(g, text);
}
const shift = (u, k, d) => { u.pillars[k] = clamp(u.pillars[k] + d, 0, 100); };
const label = (v) => (v >= 75 ? '盤石' : v >= 55 ? '安定' : v >= 40 ? '不安' : v >= 25 ? '危うい' : 'きわめて危うい');

// ---------------------------------------------------------------------- the risks
// the daily chance of a plot in the army (the cult and a 粛清 keep it down; a losing war and a rival general raise it)
export function coupChance(g, u = rule(g)) {
  if (!u) return 0;
  const a = u.pillars.army;
  if (a >= 30) return 0;
  const w = RX.R(g).war;
  const lost = w && w.phase === 'war' && RX.avgFront(w) < -40 ? 1.5 : 1;
  const rival = u.heir && u.heir.kind === 'army' ? 1.2 : 1;
  return Math.pow((30 - a) / 30, 2) * 0.05 * (u.shield > 0 ? 0.35 : 1) * (1 - u.cult * 0.07) * lost * rival;
}
const riskLabel = (c) => (c < 0.0015 ? '低い' : c < 0.008 ? 'やや高い' : c < 0.025 ? '高い' : 'きわめて高い');
const RISK_ORDER = ['低い', 'やや高い', '高い', 'きわめて高い'];
// what the ruler is told: with the cult at 4 or more, the staff report one grade better than it is ("側近は耳ざわりのよい報告ばかりする")
export function coupRisk(g, u = rule(g)) {
  const real = riskLabel(coupChance(g, u));
  if (!u || u.cult < 4) return { label: real, told: real, flattered: false };
  const told = RISK_ORDER[Math.max(0, RISK_ORDER.indexOf(real) - 1)];
  return { label: real, told, flattered: told !== real };
}

// ======================================================================== the player's actions
const ACTIONS = {};
const add = (a) => { ACTIONS[a.id] = { cool: 0, group: '人事', ...a }; };
function base(g, u) {
  if (!active(g)) return '独裁体制のあいだだけ使える';
  if (!RX.isPM(g)) return '政権の首班のときだけ使える';
  return null;
}
const coolWhy = (g, u, a) => { const left = num(u.cool[a.id]) - today(g); return left > 0 ? `あと${left}日は、続けてできない` : null; };

add({
  id: 'reward_army', name: '軍への恩賞（昇進・特別手当）', desc: '軍の幹部に昇進と特別手当を与えて、忠誠を買う。', cool: 15,
  lines: () => ['国軍の忠誠 +12', '代償：民衆の支持 −（小）・不満 +0.5'],
  run(g, u) { shift(u, 'army', 12); RX.bumpApproval(g, -1.5, -0.2, 'regime', '軍への恩賞'); RX.R(g).unrest = clamp(RX.R(g).unrest + 0.5, 0, 100); return '軍の幹部に昇進と特別手当を与えた。軍の忠誠が高まった。'; },
});
add({
  id: 'reshuffle_army', name: '軍幹部の人事刷新', desc: '軍の要職に、自分に忠実な者を置き直す。うまくいかないと、反発を招く。', cool: 30,
  odds: (g, u) => clamp(0.55 + (u.pillars.army - 30) / 150, 0.3, 0.8),
  lines: (g, u) => ['うまくいけば：国軍の忠誠 +8・クーデターを抑える効果が20日続く・恐怖 +6', '失敗すると：国軍の忠誠 −10・将校の不満', '代償：不満 +0.5'],
  run(g, u) {
    const p = ACTIONS.reshuffle_army.odds(g, u);
    RX.R(g).unrest = clamp(RX.R(g).unrest + 0.5, 0, 100);
    if (roll(p)) { shift(u, 'army', 8); u.shield = Math.max(u.shield, 20); u.fear = clamp(u.fear + 6, 0, 100); return '軍の要職が入れ替わった。新しい幹部たちは、忠誠を誓った。'; }
    shift(u, 'army', -10);
    return '人事は反発を招いた。外された将校たちの不満が、軍の中にくすぶっている。';
  },
});
add({
  id: 'purge', name: '反対派の摘発', desc: '疑わしい幹部や反対派を解任・拘束して、見せしめにする。恐怖が広がり、しばらくは動きを封じられるが、続けるほど疑心暗鬼になる。', cool: 20,
  targets: { army: '軍の幹部', police: '治安機関の幹部', party: '党と官僚の幹部', society: '民間の反対派' },
  odds: (g, u) => clamp(0.5 + u.pillars.police / 250 - u.fear / 400, 0.25, 0.85),
  lines: (g, u) => {
    const n = u.purges.filter((d) => today(g) - d < YEAR).length;
    return ['うまくいけば：恐怖 +14・クーデターを抑える効果が40日続く・対象の忠誠 +8（民間なら不満 −3）', '失敗すると：対象の忠誠 −10・不満 +3・恐怖 +8', '代償：国際社会の懸念 +3・民衆の支持 −2', n >= 2 ? `※この1年で${n}回目。重ねるほど、全員が互いを疑いはじめる（3回目から基盤が −4）` : '※重ねるほど、全員が互いを疑いはじめる'];
  },
  run(g, u, o = {}) {
    const key = ACTIONS.purge.targets[o.target] ? o.target : 'society';
    const p = ACTIONS.purge.odds(g, u);
    const r = RX.R(g);
    u.purges.push(today(g));
    u.purges = u.purges.filter((d) => today(g) - d < YEAR);
    RX.raiseIntl(g, 3, '摘発');
    RX.bumpApproval(g, -2, -0.2, 'regime', '摘発');
    const n = rint(20, 160);
    let text;
    if (roll(p)) {
      u.shield = Math.max(u.shield, 40); u.fear = clamp(u.fear + 14, 0, 100); u.detained += n;
      if (key === 'society') r.unrest = clamp(r.unrest - 3, 0, 100); else shift(u, key, 8);
      text = `${ACTIONS.purge.targets[key]}の摘発が行われた。解任・拘束は${n}人。恐怖が広がり、しばらくは動きを封じられそうだ。`;
    } else {
      if (key !== 'society') shift(u, key, -10);
      r.unrest = clamp(r.unrest + 3, 0, 100); u.fear = clamp(u.fear + 8, 0, 100);
      text = `${ACTIONS.purge.targets[key]}の摘発は不手際に終わり、かえって不信が広がった。`;
    }
    if (u.purges.length >= 3) { for (const k of ['army', 'police', 'party']) shift(u, k, -4); text += '\n摘発が重なり、だれもが互いを疑いはじめている。'; }
    return text;
  },
});
add({
  id: 'expand_police', name: '治安機関の拡充', desc: '治安機関の人員と権限を増やし、取り締まりを強める。', cool: 25,
  lines: () => ['治安機関の忠誠 +10・不満 −1.5', '代償：報道の自由度 −2・国際社会の懸念 +1・民衆の支持 −（小）'],
  run(g, u) { shift(u, 'police', 10); const r = RX.R(g); r.unrest = clamp(r.unrest - 1.5, 0, 100); RX.press(g, -2, '治安機関の拡充'); RX.raiseIntl(g, 1, '治安機関の拡充'); RX.bumpApproval(g, -1, 0, 'regime', '治安機関の拡充'); return '治安機関の人員と権限が増えた。街の取り締まりが強まった。'; },
});
add({
  id: 'party_congress', name: '党大会と人事', desc: '党大会を開き、党と官僚の幹部を入れ替えて、結束を固める。', cool: 25,
  lines: () => ['党と官僚の忠誠 +10', '代償：国軍の忠誠 −2（党への優遇に反発）'],
  run(g, u) { shift(u, 'party', 10); shift(u, 'army', -2); RX.bumpApproval(g, 0.5, 0, 'regime', '党大会'); return '党大会が開かれた。幹部は入れ替わり、党の結束が固まった。'; },
});
add({
  id: 'cult', group: '個人崇拝', name: '個人崇拝を進める', desc: '指導者への崇拝を広げる。民衆の支持は得られるが、国際社会の目は冷たくなり、側近は耳ざわりのよい報告ばかりするようになる。', cool: 20,
  step: (u) => CULT_STEPS[u.cult] || null,
  lines: (g, u) => {
    const s = CULT_STEPS[u.cult];
    if (!s) return ['もう、これ以上の段階はない。'];
    const l = [`民衆の支持 +${s.approval}（続く効果 +${s.lasting}）`, `代償：国際社会の懸念 +${s.intl}`];
    if (s.press) l.push(`報道の自由度 ${s.press}`);
    if (s.army) l.push(`国軍の忠誠 +${s.army}`);
    if (s.unrest) l.push(`不満 ${s.unrest}`);
    if (s.party) l.push(`党と官僚の忠誠 ${s.party}（党の権威が薄れる）`);
    l.push('効果：クーデターが起きにくくなる（段階ごとに −7%）。4段階めからは、側近の報告が甘くなる');
    return l;
  },
  why: (g, u) => (CULT_STEPS[u.cult] ? null : '個人崇拝は、もう最終段階'),
  run(g, u) {
    const s = CULT_STEPS[u.cult];
    u.cult += 1;
    RX.bumpApproval(g, s.approval, s.lasting, 'regime', '個人崇拝');
    RX.raiseIntl(g, s.intl, '個人崇拝');
    if (s.press) RX.press(g, s.press, '個人崇拝');
    if (s.army) shift(u, 'army', s.army);
    if (s.party) shift(u, 'party', s.party);
    if (s.unrest) RX.R(g).unrest = clamp(RX.R(g).unrest + s.unrest, 0, 100);
    return `${s.line}（個人崇拝 ${u.cult}／5）${u.cult === 4 ? '\n側近の報告は、しだいに耳ざわりのよいものばかりになってきた。' : ''}`;
  },
});
add({
  id: 'plan', group: '国家計画', name: '国家計画を立てる', desc: '重点を決めて、90日の国家計画を動かす。民衆を動員するほどうまくいくが、制裁と恐怖は足を引っぱる。', cool: 0,
  odds: (g, u) => clamp(0.5 + u.cult * 0.03 - RX.R(g).sanctions * 0.07 - u.fear / 400 + (u.pillars.police - 50) / 400, 0.2, 0.85),
  lines: (g, u) => ['90日後に、結果が出る（成功の見込みは右）', '重工業：国軍の忠誠 +4・景気 ↑ ／ 農業：不満 −3・民衆の支持 +3 ／ 軍需：国軍の忠誠 +6・戦力 +4% ／ 消費財：民衆の支持 +5・不満 −3', '失敗すると：不満 +3.5・民衆の支持 −3・党の忠誠 −3', '代償：重工業・軍需は、民衆に犠牲を強いる（民衆の支持 −1）'],
  why: (g, u) => (u.plan ? `いまは「${FOCUS[u.plan.focus].name}」の計画の最中（あと${Math.max(0, u.plan.end - today(g))}日）` : null),
  run(g, u, o = {}) {
    const focus = FOCUS[o.focus] ? o.focus : 'heavy';
    const q = ACTIONS.plan.odds(g, u);
    u.plan = { focus, start: today(g), end: today(g) + 90, q };
    if (focus === 'heavy' || focus === 'arms') RX.bumpApproval(g, -1, 0, 'regime', '国家計画');
    return `「${FOCUS[focus].name}」の国家計画が始まった。${FOCUS[focus].desc}\n結果は90日後に出る。`;
  },
});
add({
  id: 'parade', group: '国家行事', name: '軍事パレードと国民大会', desc: '首都で軍事パレードと国民大会を開き、体制の力を内外に見せつける。', cool: 40,
  lines: () => ['国軍の忠誠 +4・民衆の支持 +2.5', '代償：国際社会の懸念 +2.5'],
  run(g, u) { shift(u, 'army', 4); RX.bumpApproval(g, 2.5, 0.2, 'regime', '国家行事'); RX.raiseIntl(g, 2.5, '軍事パレード'); const w = RX.R(g).war; if (w && w.phase === 'war') w.weariness = clamp(num(w.weariness) - 2, 0, 100); return '首都で軍事パレードと国民大会が開かれた。旗の波の前で、指導者は手を振った。'; },
});
add({
  id: 'heir', group: '後継者', name: '後継者を指名する', desc: '体制を引き継ぐ者を決める。決めておけば、病や老いが怖くなくなるが、選ばれなかった側は不満をもつ。', cool: 60,
  lines: () => ['党の筆頭幹部：党の忠誠 +10・国軍の忠誠 −3', '軍の司令官：国軍の忠誠 +10・党の忠誠 −3（軍の中で、クーデターを企てやすくなる）', '身内（子ども）：党・軍とも忠誠 −3・民衆の支持 −1', '決めていないと、病のうわさが出たとき、党と軍の忠誠が −3 ずつ'],
  run(g, u, o = {}) {
    const kind = HEIRS[o.kind] ? o.kind : 'party';
    u.heir = { kind, day: today(g) };
    if (kind === 'party') { shift(u, 'party', 10); shift(u, 'army', -3); }
    else if (kind === 'army') { shift(u, 'army', 10); shift(u, 'party', -3); }
    else { shift(u, 'party', -3); shift(u, 'army', -3); RX.bumpApproval(g, -1, 0, 'regime', '世襲'); }
    return HEIRS[kind].line;
  },
});

const GROUP_ORDER = ['人事', '個人崇拝', '国家計画', '国家行事', '後継者'];
export function actions(g) {
  const u = rule(g);
  return Object.values(ACTIONS).map((a) => {
    let why = u ? base(g, u) : (active(g) ? null : '独裁体制のあいだだけ使える');
    if (!why && u) why = coolWhy(g, u, a) || (a.why ? a.why(g, u) : null);
    const uu = u || (active(g) ? ensure(g) : null);
    return { id: a.id, group: a.group, name: a.name, desc: a.desc, cool: a.cool, targets: a.targets ? Object.entries(a.targets).map(([id, name]) => ({ id, name })) : null, odds: a.odds && uu ? Math.round(a.odds(g, uu) * 100) : null, lines: uu ? a.lines(g, uu) : [], why };
  }).sort((x, y) => GROUP_ORDER.indexOf(x.group) - GROUP_ORDER.indexOf(y.group));
}
export function act(g, id, opts = {}) {
  const a = ACTIONS[id];
  if (!a) return { ok: false, why: 'そんな操作はない' };
  if (!active(g)) return { ok: false, why: '独裁体制のあいだだけ使える' };
  const u = ensure(g);
  const why = base(g, u) || coolWhy(g, u, a) || (a.why ? a.why(g, u) : null);
  if (why) return { ok: false, why };
  if (id === 'purge' && opts.target && !a.targets[opts.target]) return { ok: false, why: 'その対象はない' };
  u.cool[id] = today(g) + a.cool;
  const text = a.run(g, u, opts);
  logRule(g, u, text.split('\n')[0], { news: id === 'parade' || id === 'cult' || id === 'purge' });
  return { ok: true, text };
}

// ======================================================================== events (each: a scene the player answers; unanswered ones resolve themselves)
function queue(g, u, kind, data = {}) {
  u.pending = { kind, day: today(g), ...data };
  queueRegimeScene(g, `rule_${kind}`, { day: today(g), ...data }, { front: true });
}
// the options of an event: [{ id, label, odds? }]
function eventOptions(g, u, kind) {
  const p = u ? u.pillars : { army: 50, police: 50, party: 50 };
  if (kind === 'plot') return [
    { id: 'detain', label: '首謀者を拘束する', odds: clamp(0.45 + p.police / 200 - u.fear / 500, 0.25, 0.85) },
    { id: 'appease', label: '軍に特別手当と昇進を約束する', odds: 0.6 },
    { id: 'speech', label: '国民に直接訴える', odds: clamp(0.25 + people(g) / 200 + u.cult * 0.04, 0.2, 0.7) },
  ];
  if (kind === 'party') return [
    { id: 'confront', label: '正面から対決する', odds: clamp(0.4 + (p.army - 40) / 150 + u.cult * 0.04, 0.15, 0.85) },
    { id: 'concede', label: '要求をのむ' },
  ];
  if (kind === 'police') return [
    { id: 'reshuffle', label: '幹部を入れ替える', odds: 0.6 },
    { id: 'bonus', label: '手当を出して引きとめる' },
  ];
  if (kind === 'attempt') return [
    { id: 'speech', label: '国民に語りかける' },
    { id: 'crack', label: '治安機関に徹底的な捜査を命じる' },
    { id: 'hide', label: '警護を厚くして、表に出ない' },
  ];
  return [];
}
// resolve an event (choice null = the player let it pass): returns { ok, text, fell? }
export function respond(g, kind, choice) {
  if (!active(g)) return { ok: false, why: '独裁体制ではない' };
  const u = ensure(g);
  const r = RX.R(g);
  const opt = eventOptions(g, u, kind).find((o) => o.id === choice) || null;
  u.pending = null;
  const out = (text, extra = {}) => ({ ok: true, text, ...extra });
  if (kind === 'plot') {
    const held = opt ? roll(opt.odds) : !roll(0.65); // letting it pass: a two in three chance that the army moves
    if (!held) { logRule(g, u, '軍の一部が動いた。クーデターが起きた'); RX.fall(g, 'coup'); return out('企ては、止められなかった。夜が明けるころ、軍の部隊が首都を押さえた。', { fell: true }); }
    if (!opt) { shift(u, 'army', -2); return out('将校たちの動きは、結局、おさまった。だが、軍の中の不満は残っている。'); }
    if (choice === 'detain') { shift(u, 'army', 6); u.shield = Math.max(u.shield, 30); u.fear = clamp(u.fear + 10, 0, 100); u.detained += rint(20, 80); RX.raiseIntl(g, 2, '軍幹部の拘束'); return out('首謀者とされた将校たちは拘束された。軍は、いっせいに口をつぐんだ。'); }
    if (choice === 'appease') { shift(u, 'army', 16); RX.bumpApproval(g, -2, -0.2, 'regime', '軍への特別手当'); return out('特別手当と昇進を約束すると、将校たちの動きはおさまった。'); }
    shift(u, 'army', 4); RX.bumpApproval(g, 4, 0.3, 'regime', '国民への呼びかけ'); return out('指導者は、国民に直接語りかけた。街が静まり、軍も動きをとめた。');
  }
  if (kind === 'party') {
    if (choice === 'concede') { shift(u, 'party', 10); shift(u, 'army', -4); RX.bumpApproval(g, -2, 0, 'regime', '党への譲歩'); u.cult = Math.max(0, u.cult - 1); return out('幹部会の要求をのんだ。党の結束は戻ったが、指導者の権威は少し下がった。'); }
    const odds = eventOptions(g, u, 'party')[0].odds;
    if (!roll(choice === 'confront' ? odds : Math.max(0.1, odds - 0.15))) { logRule(g, u, '党の最高幹部会が、指導者の解任を決めた'); RX.fall(g, 'ousted'); return out('対決は、失敗に終わった。幹部会は、解任を決議した。', { fell: true }); }
    shift(u, 'party', 14); u.fear = clamp(u.fear + 10, 0, 100); return out('対決は、指導者の勝ちに終わった。党の幹部は、黙って席についた。');
  }
  if (kind === 'police') {
    if (choice === 'reshuffle') {
      if (roll(opt.odds)) { shift(u, 'police', 14); u.fear = clamp(u.fear - 8, 0, 100); r.unrest = clamp(r.unrest + 1, 0, 100); return out('治安機関の幹部が入れ替わった。指揮系統は、もとに戻った。'); }
      shift(u, 'police', -5); r.unrest = clamp(r.unrest + 4, 0, 100); return out('人事は混乱を呼んだ。治安機関の動きは、にぶいままだ。');
    }
    if (choice === 'bonus') { shift(u, 'police', 10); RX.bumpApproval(g, -1.5, 0, 'regime', '治安機関への手当'); return out('手当を出すと、幹部たちは任務に戻った。'); }
    shift(u, 'police', -3); r.unrest = clamp(r.unrest + 3, 0, 100); return out('命令に従わない幹部が増えた。街の取り締まりが、にぶっている。');
  }
  if (kind === 'attempt') {
    if (choice === 'speech') { RX.bumpApproval(g, 6, 0.5, 'regime', '襲撃事件'); return out('指導者は無事な姿を見せ、国民に語りかけた。同情と結束が広がった。'); }
    if (choice === 'crack') { shift(u, 'police', 4); RX.press(g, -3, '襲撃事件の捜査'); r.unrest = clamp(r.unrest - 2, 0, 100); u.detained += rint(30, 150); RX.raiseIntl(g, 2, '捜査'); return out('治安機関は、関係者の一斉拘束に動いた。街から、抗議の声が消えた。'); }
    if (choice === 'hide') { u.fear = clamp(u.fear + 6, 0, 100); RX.bumpApproval(g, -2, 0, 'regime', '指導者が姿を見せない'); return out('警護が厚くなり、指導者は人前に出なくなった。「姿を見せない」とうわさされている。'); }
    RX.bumpApproval(g, -1, 0, 'regime', '襲撃事件'); return out('事件は、うやむやのまま忘れられていった。');
  }
  return { ok: false, why: 'そんな出来事はない' };
}

// the scenes (the player answers inside them)
const SCENE_TEXT = {
  plot: { art: 'plot', title: '軍の動き', sub: '夜の報告', pages: () => ['夜ふけ、側近が声をひそめて告げた。', '「軍の一部の将校が、ひそかに集まっています。このまま待てば、何が起きるかわかりません」', '手を打つなら、今夜のうちだ。'] },
  party: { art: 'kantei', title: '党内の政変', sub: '最高幹部会', pages: () => ['党の最高幹部会が、緊急に招集された。', '幹部たちは、指導者の退陣と権限の分散を求めている。', '席に着けば、答えを迫られる。'] },
  police: { art: 'army', title: '治安機関の動揺', sub: '命令が届かない', pages: () => ['治安機関の幹部たちが、命令に従わなくなった。', '「現場が動きません。給与も人事も、不満がたまっています」と側近は言う。'] },
  attempt: { art: 'palace', title: '官邸の近くで', sub: '襲撃事件', pages: () => ['指導者の車列が通る道の近くで、爆発があった。', '指導者は無事だった。けが人が出たと伝えられている。', '国じゅうが、次の言葉を待っている。'] },
};
const PROMPTS = { plot: '手を打つ？', party: 'どう向き合う？', police: 'どうする？', attempt: 'どう応える？' };
for (const kind of Object.keys(SCENE_TEXT)) {
  registerRegimeScene(`rule_${kind}`, async (g, data) => {
    if (!active(g)) return;
    const u = ensure(g);
    if (!u.pending || u.pending.kind !== kind) return; // already answered (or timed out)
    const S = SCENE_TEXT[kind];
    const opts = eventOptions(g, u, kind).map((o) => ({ label: o.odds != null ? `${o.label}（見込み${Math.round(o.odds * 100)}%）` : o.label, value: o.id }));
    opts.push({ label: 'このまま様子を見る', value: null });
    let res = null;
    await showRegimeScene(g, {
      art: S.art, title: S.title, sub: S.sub, pages: S.pages(g), options: opts, prompt: PROMPTS[kind],
      then: async (v) => { res = respond(g, kind, v); if (res && res.text) await RX.say(g, res.text); },
    });
  });
}

// ======================================================================== the morning
function tick(g) {
  if (!g || !g.state || !active(g)) return;
  const r = RX.R(g);
  const u = ensure(g);
  if (u.lastTick >= today(g)) return;
  u.lastTick = today(g);
  const w = r.war && r.war.phase === 'war' ? r.war : null;
  const front = w ? RX.avgFront(w) : 0;
  const P = u.pillars;
  // the drift of each pillar toward its own level
  P.army = clamp(P.army + ((55 + (u.heir && u.heir.kind === 'army' ? 4 : 0)) - P.army) * 0.012 + front / 1500 - (w ? num(w.weariness) / 3000 : 0) - (u.fear > 60 ? 0.04 : 0), 0, 100);
  P.police = clamp(P.police + (55 - P.police) * 0.01 - (r.unrest > 60 ? 0.03 : 0) - (u.fear > 60 ? 0.03 : 0), 0, 100);
  P.party = clamp(P.party + ((50 + (u.heir && u.heir.kind === 'party' ? 3 : 0)) - P.party) * 0.01 - (r.unrest > 50 ? 0.03 : 0) - r.sanctions * 0.01 - (u.fear > 60 ? 0.03 : 0), 0, 100);
  u.fear = Math.max(0, u.fear - 0.3);
  u.shield = Math.max(0, u.shield - 1);
  // an event the player has not answered for three days resolves itself (the scene may have been dropped)
  if (u.pending && today(g) - u.pending.day >= 3) { const k = u.pending.kind; respond(g, k, null); if (!active(g)) return; }
  // the plan comes due
  if (u.plan && today(g) >= u.plan.end) finishPlan(g, u);
  else if (u.plan && (today(g) - u.plan.start) === 45) RX.news(g, `国家計画（${FOCUS[u.plan.focus].name}）は半分まで進んだ。各地の報告は「順調」とされている。`);
  // the base cracks
  const e = coupChance(g, u);
  if (!u.pending && e > 0 && today(g) - u.lastPlot >= 25 && roll(e)) { u.lastPlot = today(g); queue(g, u, 'plot'); RX.news(g, '軍の一部で不穏な動きがあるとの情報が、官邸に入った'); }
  if (!u.pending && P.police < 22 && today(g) - u.lastPolice >= 40 && roll(0.03)) { u.lastPolice = today(g); queue(g, u, 'police'); }
  if (!u.pending && P.party < 22 && today(g) - u.lastParty >= 40 && roll(0.025)) { u.lastParty = today(g); queue(g, u, 'party'); RX.news(g, '与党の最高幹部会が、緊急に招集された'); }
  if (!u.pending && today(g) - u.lastAttempt >= 30 && roll((0.0004 + (r.unrest / 100) * 0.0012) * (u.cult >= 3 ? 1.2 : 1))) { u.lastAttempt = today(g); queue(g, u, 'attempt'); RX.news(g, '首都で爆発事件があった。指導者は無事と伝えられる'); RX.phone(g, '【速報】首都で爆発事件。指導者は無事。', 'ドット新聞 社会部'); }
  // the ruler's age: the rumour, then the end
  const age = ageOf(g.state);
  if (age >= 58 && today(g) - u.lastScare >= 60 && roll(1 / (YEAR * 2))) {
    u.lastScare = today(g);
    if (u.heir) RX.news(g, '指導者の健康不安がうわさされている。後継者が、体制を引き継ぐ準備を進めているという');
    else { shift(u, 'army', -3); shift(u, 'party', -3); RX.news(g, '指導者の健康不安がうわさされている。後継者が決まっていないことが、党と軍に不安を広げている'); }
  }
  if (age >= 55 && roll((qx(age) / YEAR) * (u.fear > 70 ? 1.2 : 1))) {
    u.heirAtEnd = u.heir ? u.heir.kind : null;
    logRule(g, u, `${g.state.name}が死去した`);
    RX.fall(g, 'death');
  }
}
function finishPlan(g, u) {
  const p = u.plan;
  u.plan = null;
  const r = RX.R(g);
  const name = FOCUS[p.focus].name;
  if (roll(p.q)) {
    if (p.focus === 'heavy') { shift(u, 'army', 4); RX.ecoShock(g, '国家計画（重工業）', { growth: 1, inflation: 0.2, len: 120 }); RX.bumpApproval(g, 2, 0.2, 'regime', '国家計画'); }
    else if (p.focus === 'farm') { r.unrest = clamp(r.unrest - 3, 0, 100); RX.bumpApproval(g, 3, 0.2, 'regime', '国家計画'); RX.ecoShock(g, '国家計画（農業）', { growth: 0.3, len: 120 }); }
    else if (p.focus === 'arms') { shift(u, 'army', 6); u.armsBonus = clamp(u.armsBonus + 0.04, 0, 0.12); RX.raiseIntl(g, 2, '軍備増強'); }
    else { RX.bumpApproval(g, 5, 0.3, 'regime', '国家計画'); r.unrest = clamp(r.unrest - 3, 0, 100); RX.ecoShock(g, '国家計画（消費財）', { growth: 0.5, inflation: -0.2, len: 120 }); }
    logRule(g, u, `国家計画（${name}）は、目標を達成したと発表された`);
    RX.phone(g, `【国家計画】${name}の計画は、目標を達成した。\n指導部は成果をたたえている。`, 'ドット新聞 政治部');
  } else {
    r.unrest = clamp(r.unrest + 3.5, 0, 100); shift(u, 'party', -3); RX.bumpApproval(g, -3, -0.2, 'regime', '計画の失敗');
    logRule(g, u, `国家計画（${name}）は未達に終わり、担当の幹部が更迭された`);
    RX.phone(g, `【国家計画】${name}の計画は、目標に届かなかった。\n担当の幹部は責任を問われた。`, 'ドット新聞 政治部');
  }
}
onMorning((g) => { try { tick(g); } catch (e) { console.error('[rule] morning', e); } });
// a 軍需 plan that succeeded makes the army stronger at every front
WAR_MODS.push((g) => { const u = rule(g); return u && u.armsBonus > 0 && active(g) ? { own: 1 + u.armsBonus } : null; });

// ======================================================================== the summary and the Game API
export function summary(g) {
  const on = active(g);
  const u = on ? ensure(g) : rule(g);
  if (!u) return { active: on, pillars: null };
  const r = coupRisk(g, u);
  return {
    active: on, pillars: { ...u.pillars }, labels: { army: label(u.pillars.army), police: label(u.pillars.police), party: label(u.pillars.party) }, people: people(g), fear: Math.round(u.fear), shield: u.shield,
    cult: u.cult, plan: u.plan ? { ...u.plan, name: FOCUS[u.plan.focus].name, left: Math.max(0, u.plan.end - today(g)) } : null, heir: u.heir ? { ...u.heir, name: HEIRS[u.heir.kind].name } : null,
    coupRisk: r.told, coupRiskReal: r.label, flattered: r.flattered, pending: u.pending ? u.pending.kind : null, detained: u.detained, armsBonus: u.armsBonus, log: u.log.slice(0, 20),
  };
}
const METHODS = {
  rule() { return summary(this); },
  ruleActions() { return actions(this); },
  ruleAct(id, opts) { return act(this, id, opts || {}); },
  ruleRespond(kind, choice) { return respond(this, kind, choice); },
  ruleLog() { const u = rule(this); return u ? u.log.slice() : []; },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });

// ======================================================================== the phone app 「統治」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 7, y + 17, 18, 6, '#f2d060'); R(c, x + 7, y + 10, 3, 8, '#f2d060'); R(c, x + 14, y + 8, 4, 10, '#f2d060'); R(c, x + 22, y + 10, 3, 8, '#f2d060');
  R(c, x + 8, y + 24, 16, 2, '#7a5a1a');
}
function bar(c, x, y, w, v, col) {
  R(c, x, y, w, 8, '#c8c2b4'); R(c, x, y, Math.round((w * clamp(v, 0, 100)) / 100), 8, col);
  R(c, x, y, w, 1, 'rgba(0,0,0,0.15)');
}
const barColor = (v) => (v >= 55 ? '#3a9a5a' : v >= 35 ? '#d8a82e' : '#c8402e');
async function viewBase(g) {
  const s = summary(g);
  if (!s.pillars) return;
  await phoneInfo(g, {
    title: '権力の基盤', color: COLOR,
    draw(c, a) {
      const x = a.x + 10, w = a.w - 20;
      let y = a.y + 8;
      const row = (name, v, note) => { T(c, name, x, y, 12, '#333'); T(c, `${Math.round(v)}　${note}`, x + w, y, 11, '#666', 'right'); bar(c, x, y + 16, w, v, barColor(v)); y += 34; };
      row('国軍', s.pillars.army, s.labels.army);
      row('治安機関', s.pillars.police, s.labels.police);
      row('党と官僚', s.pillars.party, s.labels.party);
      row('民衆の支持', s.people, '内閣支持率');
      T(c, `恐怖 ${s.fear}　　摘発の効果 ${s.shield ? `あと${s.shield}日` : 'なし'}`, x, y, 11, '#555'); y += 18;
      T(c, `個人崇拝 ${s.cult}／5　　拘束・解任 ${s.detained.toLocaleString('ja-JP')}人`, x, y, 11, '#555'); y += 18;
      T(c, `クーデターの危険：${s.coupRisk}${s.flattered ? '（側近の報告）' : ''}`, x, y, 12, s.coupRisk === '低い' ? '#2f7a4a' : '#b03a2a'); y += 18;
      if (s.flattered) T(c, '※個人崇拝が進み、側近は甘い報告をしている', x, y, 10, '#a06a2a');
    },
  });
}
async function viewLog(g) {
  const lines = g.ruleLog().map((l) => `${l.text}`);
  await phoneInfo(g, { title: '統治の記録', color: COLOR, lines: lines.length ? lines : ['まだ記録はない。'] });
}
async function runAction(g, a, opts = {}, tail = '') {
  const ok = !a.why;
  const odds = a.odds != null ? `\n成功の見込み ${a.odds}%` : '';
  const text = `${a.desc}\n\n${bulletText(a.lines)}${odds}${tail}${a.why ? `\n\n（${a.why}）` : ''}`;
  const i = await phoneConfirm(g, { title: a.name, color: COLOR, text, choices: ok ? ['実行する', 'やめる'] : ['もどる'] });
  if (!ok || i !== 0) return;
  const r = g.ruleAct(a.id, opts);
  if (!r.ok) { g.sfx('buzz'); await phoneInfo(g, { title: a.name, color: COLOR, text: r.why }); return; }
  g.sfx('ok');
  await phoneInfo(g, { title: a.name, color: COLOR, text: r.text });
}
async function pickAndRun(g, a) {
  if (a.id === 'purge') {
    const i = await phoneList(g, { title: '摘発の対象', color: COLOR, items: a.targets.map((t) => ({ label: t.name })), hint: 'A:えらぶ　B:もどる' });
    if (i < 0 || !a.targets[i]) return;
    return runAction(g, a, { target: a.targets[i].id }, `\n対象：${a.targets[i].name}`);
  }
  if (a.id === 'plan') {
    const keys = Object.keys(FOCUS);
    const i = await phoneList(g, { title: '国家計画の重点', color: COLOR, items: keys.map((k) => ({ label: FOCUS[k].name, sub: FOCUS[k].desc })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !keys[i]) return;
    return runAction(g, a, { focus: keys[i] }, `\n重点：${FOCUS[keys[i]].name}`);
  }
  if (a.id === 'heir') {
    const keys = Object.keys(HEIRS);
    const i = await phoneList(g, { title: '後継者', color: COLOR, items: keys.map((k) => ({ label: HEIRS[k].name })), hint: 'A:えらぶ　B:もどる' });
    if (i < 0 || !keys[i]) return;
    return runAction(g, a, { kind: keys[i] }, `\n指名：${HEIRS[keys[i]].name}`);
  }
  return runAction(g, a);
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const s = summary(g);
    if (!s.active) { await phoneInfo(g, { title: '統治', color: COLOR, text: '独裁体制のあいだだけ使える。' }); return; }
    const acts = g.ruleActions();
    const rows = [
      { label: '権力の基盤', sub: `軍${Math.round(s.pillars.army)}・治安${Math.round(s.pillars.police)}・党${Math.round(s.pillars.party)}・民衆${s.people}`, run: () => viewBase(g) },
      ...acts.map((a) => ({
        label: a.name, sub: a.why ? a.why : a.odds != null ? `${a.group}・見込み${a.odds}%` : a.group, run: () => pickAndRun(g, a),
      })),
      { label: '統治の記録', sub: `${s.log.length}件`, run: () => viewLog(g) },
    ];
    const i = await phoneList(g, { title: '統治', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('touchi', {
  name: '統治', color: COLOR, order: 62.4,
  iconHD: icon,
  cond: (g) => !!g && !!g.state && active(g),
  open: (g) => openApp(g),
});
export { openApp as openRuleApp };
