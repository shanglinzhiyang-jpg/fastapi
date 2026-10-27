// 地方政治 (R20) — what it is to run a ward (ドット区長) or a prefecture (知事) or to sit in an assembly (区議・都議): a budget that has to be split between five needs (福祉・教育・防災・産業・
// 交通), 条例 that the assembly has to pass, a debt that grows if the head spends more than comes in, 国 that gives and withholds money, the residents' approval (which feeds 地元の支持, so
// the next election), and the crises of the office: a 不信任決議 from the assembly, a 住民投票 demanded by residents, a request or a quarrel with the national government.
//
// Rules: nothing is refused for being bad — the odds and the prices are shown first; the ward and its people are fictional (the budget is in rough 億円); the national side is read, not
// changed (the player's party in the national coalition makes the 陳情 easier). Scandals of the head go through scandal.js like anyone's.
//
// State g.state.localGov (lazy; made again when the office changes or after a gap of more than 40 days out of office):
//   { v, off, since, last, alloc: { welfare, edu, disaster, industry, infra } (% of the budget, sums to 100), sat: { …same keys } (0..100), approval (0..100), coop (the assembly's goodwill, 0..100),
//     ordinances: [{ id, day }], debt (億円), friction (0..100, with the national government), grant { mul, until }, pending: null | { kind, day, … }, cool: { id: day }, log: [{ day, text }], tally }
// API (on Game): g.localGov() → the summary (null when not in a local office); g.localGovOrdinances() → the catalogue with odds; g.localGovPropose(id); g.localGovBudget({ up, down }); g.localGovLobby();
//   g.localGovPlead(); g.localGovRespond(choice) → the answer to the pending crisis. The phone app 「自治体」 (id 'jichi', order 66.7).

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp } from './util.js';
import { OFFICES } from './politics.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText, phoneText as T } from './phone.js';

const COLOR = '#3f8a7a';
const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const today = (g) => (g.state && g.state.day) || 1;
let rng = () => Math.random();
export const setLocalRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const roll = (p) => rng() < p;
const pol = (g) => (typeof g.pol === 'function' ? g.pol() : null);

export const AREAS = { welfare: '福祉・子育て', edu: '教育', disaster: '防災・安全', industry: '産業・観光', infra: '交通・まちづくり' };
const KEYS = Object.keys(AREAS);
const NEED = { welfare: 30, edu: 15, disaster: 12, industry: 13, infra: 30 }; // the share of the budget that keeps the residents content
const SCALE = { shicho: { base: 1200, name: 'ドット区', assembly: 'kugi', head: '区長' }, chiji: { base: 80000, name: '東京都', assembly: 'togi', head: '知事' } };
const HEADS = new Set(['shicho', 'chiji']);
const SEATS = new Set(['kugi', 'togi']);

// the 条例 (cost: % of the budget a year; eff: the satisfaction it adds to its area; pop: the approval at once; hot: a controversial one, residents may demand a vote)
export const ORDINANCES = [
  { id: 'childcare', area: 'welfare', name: '子ども医療費の無料化', cost: 1.5, eff: 8, pop: 4, desc: '子どもの医療費を、中学卒業まで無料にする。' },
  { id: 'elderly', area: 'welfare', name: '高齢者の移動支援', cost: 0.8, eff: 5, pop: 2, desc: '高齢者の通院やお買い物の足を支える。' },
  { id: 'classsize', area: 'edu', name: '少人数学級の拡大', cost: 1.2, eff: 7, pop: 3, desc: '学級の人数を減らし、先生を増やす。' },
  { id: 'scholar', area: 'edu', name: '給付型奨学金の創設', cost: 0.8, eff: 5, pop: 2, desc: '返さなくてよい奨学金をつくる。' },
  { id: 'shelter', area: 'disaster', name: '避難所と備蓄の整備', cost: 1.0, eff: 8, pop: 2, desc: '避難所の耐震化と、食料・水の備蓄を進める。' },
  { id: 'embank', area: 'disaster', name: '防災インフラの強化', cost: 1.8, eff: 10, pop: 3, desc: '堤防・排水・無電柱化に力を入れる。' },
  { id: 'tourism', area: 'industry', name: '観光PRと宿泊支援', cost: 0.8, eff: 6, pop: 2, desc: '観光客を呼び、地元の店を元気にする。' },
  { id: 'startup', area: 'industry', name: '創業支援と企業誘致', cost: 1.0, eff: 7, pop: 2, desc: '起業する人と、進出する会社を支援する。' },
  { id: 'bus', area: 'infra', name: '地域バスと自転車道の整備', cost: 1.2, eff: 7, pop: 3, desc: '地域の足を整える。' },
  { id: 'redevelop', area: 'infra', name: '駅前の再開発', cost: 2.2, eff: 10, pop: 1, hot: true, desc: '駅前を建て替える。にぎわうが、立ち退きなど反対の声も強い。' },
  { id: 'taxcut', area: null, name: '住民税の軽減', cost: 1.5, eff: 0, pop: 5, desc: '住民の負担を軽くする。税収が減る。' },
  { id: 'closure', area: 'infra', name: '公共施設の統廃合', cost: -1.2, eff: -5, pop: -3, hot: true, desc: '使われない施設を減らして、経費を節約する。反対の声が出やすい。' },
  { id: 'opendata', area: null, name: '情報公開条例の強化', cost: 0.2, eff: 0, pop: 2, desc: '公文書と予算の公開を進める。不祥事が見つかりやすくなる（自分にも）。' },
];
const ORD = Object.fromEntries(ORDINANCES.map((o) => [o.id, o]));

// ======================================================================== state
const office = (p) => (p && p.me ? p.me.office : null);
const active = (g) => { const p = pol(g); const o = office(p); return !!o && (HEADS.has(o) || SEATS.has(o)); };
const isHead = (g) => HEADS.has(office(pol(g)));
function assemblyShare(p, o) {
  const A = p.local && p.local[SCALE[o] ? SCALE[o].assembly : o];
  if (!A || !A.seats) return 0.2;
  const tot = Object.values(A.seats).reduce((a, b) => a + num(b), 0) || 1;
  return num(A.seats[p.me.party]) / tot;
}
const baseCoop = (p, o) => clamp(20 + assemblyShare(p, o) * 140, 15, 85);
function fresh(g, p) {
  const o = office(p);
  const base = baseCoop(p, HEADS.has(o) ? o : 'kugi');
  return {
    v: 1, off: o, since: today(g), last: today(g), alloc: { ...NEED }, sat: Object.fromEntries(KEYS.map((k) => [k, 55])), approval: clamp(50 + num(p.me.localSupport) / 6, 35, 70), coop: base,
    ordinances: [], debt: 0, friction: 0, grant: { mul: 1, until: 0 }, pending: null, cool: {}, log: [], tally: { passed: 0, failed: 0 },
  };
}
function ensure(g) {
  const p = pol(g);
  if (!p || !g.state) return null;
  const o = office(p);
  if (!o || !(HEADS.has(o) || SEATS.has(o))) return null;
  let L = g.state.localGov;
  if (!isObj(L) || L.off !== o || today(g) - num(L.last) > 40) L = g.state.localGov = fresh(g, p);
  L.last = today(g);
  L.alloc = isObj(L.alloc) ? L.alloc : { ...NEED };
  L.sat = isObj(L.sat) ? L.sat : {};
  for (const k of KEYS) { L.alloc[k] = clamp(num(L.alloc[k], NEED[k]), 0, 80); L.sat[k] = clamp(num(L.sat[k], 55), 0, 100); }
  const sum = KEYS.reduce((a, k) => a + L.alloc[k], 0) || 100;
  if (Math.abs(sum - 100) > 0.5) for (const k of KEYS) L.alloc[k] = Math.round((L.alloc[k] * 100) / sum);
  L.approval = clamp(num(L.approval, 50), 0, 100); L.coop = clamp(num(L.coop, 40), 0, 100); L.debt = Math.max(0, num(L.debt)); L.friction = clamp(num(L.friction), 0, 100);
  if (!isObj(L.grant)) L.grant = { mul: 1, until: 0 };
  if (!Array.isArray(L.ordinances)) L.ordinances = [];
  L.ordinances = L.ordinances.filter((x) => isObj(x) && ORD[x.id]);
  if (!Array.isArray(L.log)) L.log = [];
  if (!isObj(L.cool)) L.cool = {};
  if (!isObj(L.tally)) L.tally = { passed: 0, failed: 0 };
  if (!isObj(L.pending) || !L.pending.kind) L.pending = null;
  return L;
}
const sc = (p) => SCALE[office(p)] || (office(p) === 'togi' ? SCALE.chiji : SCALE.shicho);
const say = (g, p, L, text, o = {}) => {
  L.log.unshift({ day: today(g), text }); if (L.log.length > 30) L.log.length = 30;
  if (o.news !== false) { p.news.unshift({ day: today(g), text: `【${sc(p).name}】${text}`, kind: 'politics' }); if (p.news.length > 80) p.news.length = 80; }
};
const spendRate = (L) => 100 + L.ordinances.reduce((a, x) => a + ORD[x.id].cost, 0);
const gain = (p, k, d) => { p.me[k] = clamp(num(p.me[k]) + d, k === 'reputation' ? -100 : 0, 100); };

// ======================================================================== the vote on an ordinance
export function ordinanceOdds(g, id) {
  const p = pol(g), L = ensure(g), O = ORD[id];
  if (!p || !L || !O) return 0;
  const head = HEADS.has(office(p));
  const need = O.area ? (60 - L.sat[O.area]) * 0.3 : 3;
  const base = head ? 28 + L.coop * 0.55 : 10 + assemblyShare(p, office(p)) * 100 * 0.9; // a member needs the assembly's majority
  return Math.round(clamp(base + need - Math.max(0, O.cost) * 6 + (O.pop > 3 ? 3 : 0) - (L.debt > 20 ? 10 : 0), 6, 92));
}
function propose(g, id) {
  const p = pol(g), L = ensure(g), O = ORD[id];
  if (!p || !L) return { ok: false, why: '地方の職にいない' };
  if (!O) return { ok: false, why: 'その条例はない' };
  if (L.ordinances.some((x) => x.id === id)) return { ok: false, why: 'すでに条例がある' };
  if (L.pending) return { ok: false, why: 'いま決めることがある（先に対応を）' };
  if (num(L.cool[id]) && today(g) - L.cool[id] < 20) return { ok: false, why: `否決されたばかり（あと${20 - (today(g) - L.cool[id])}日）` };
  const odds = ordinanceOdds(g, id);
  const win = roll(odds / 100);
  const head = isHead(g);
  if (win) {
    L.ordinances.push({ id, day: today(g) });
    L.tally.passed++;
    L.approval = clamp(L.approval + O.pop, 0, 100);
    if (head) L.coop = clamp(L.coop + 3, 0, 100);
    gain(p, 'reputation', head ? 2 : 1);
    const text = `「${O.name}」の条例が議会で可決された。${O.cost > 0 ? `毎年、予算の${O.cost}%がかかる。` : `毎年、予算の${-O.cost}%を節約できる。`}`;
    say(g, p, L, text);
    // a controversial one: residents may demand a vote
    if (O.hot && head && !L.pending && roll(0.5)) L.pending = { kind: 'referendum', day: today(g), id };
    return { ok: true, win: true, text };
  }
  L.tally.failed++;
  L.cool[id] = today(g);
  if (head) L.coop = clamp(L.coop - 5, 0, 100);
  gain(p, 'reputation', -1);
  const text = `「${O.name}」の条例案は、議会で否決された。`;
  say(g, p, L, text);
  return { ok: true, win: false, text };
}

// ======================================================================== the budget and the other acts
function budget(g, { up, down, pts = 5 } = {}) {
  const p = pol(g), L = ensure(g);
  if (!p || !L) return { ok: false, why: '地方の職にいない' };
  if (!isHead(g)) return { ok: false, why: '予算を組むのは首長' };
  if (!AREAS[up] || !AREAS[down] || up === down) return { ok: false, why: '分野を選びなおしてください' };
  if (L.alloc[down] - pts < 3) return { ok: false, why: `${AREAS[down]}はこれ以上減らせない` };
  if (num(L.cool.budget) && today(g) - L.cool.budget < 6) return { ok: false, why: '予算を組みかえたばかり' };
  L.alloc[up] += pts; L.alloc[down] -= pts; L.cool.budget = today(g);
  const text = `予算を組みかえた。${AREAS[up]}を+${pts}%、${AREAS[down]}を−${pts}%。`;
  say(g, p, L, text, { news: false });
  return { ok: true, text };
}
function lobby(g) {
  const p = pol(g), L = ensure(g);
  if (!p || !L) return { ok: false, why: '地方の職にいない' };
  if (!isHead(g)) return { ok: false, why: '議会対策は首長の仕事' };
  if (num(L.cool.lobby) && today(g) - L.cool.lobby < 5) return { ok: false, why: '根回しをしたばかり' };
  const cost = Math.round(num(g.state.money) > 300000 ? 100000 : 0);
  if (cost && g.state.money < cost) return { ok: false, why: 'お金が足りない' };
  if (cost) g.state.money -= cost;
  L.cool.lobby = today(g);
  L.coop = clamp(L.coop + 8, 0, 100);
  gain(p, 'standing', 0);
  const text = `各会派をまわって根回しをした。議会との関係が少し良くなった。${cost ? `（経費 ${g.fmt ? g.fmt(`¥${cost}`) : cost}）` : ''}`;
  say(g, p, L, text, { news: false });
  return { ok: true, text };
}
export function pleadOdds(g) {
  const p = pol(g), L = ensure(g);
  if (!p || !L) return 0;
  const ruling = (p.cabinet.partyIds || []).includes(p.me.party) || p.cabinet.pm === 'player';
  return Math.round(clamp(30 + (ruling ? 30 : 0) - L.friction * 0.4 + L.approval * 0.1, 8, 85));
}
function plead(g) {
  const p = pol(g), L = ensure(g);
  if (!p || !L) return { ok: false, why: '地方の職にいない' };
  if (!isHead(g)) return { ok: false, why: '国への陳情は首長の仕事' };
  if (num(L.cool.plead) && today(g) - L.cool.plead < 30) return { ok: false, why: `陳情したばかり（あと${30 - (today(g) - L.cool.plead)}日）` };
  L.cool.plead = today(g);
  if (roll(pleadOdds(g) / 100)) {
    L.grant = { mul: 1.08, until: today(g) + 90 };
    const text = '国に陳情し、補助金の上積みが決まった。しばらく、使えるお金が増える。';
    say(g, p, L, text);
    return { ok: true, win: true, text };
  }
  L.approval = clamp(L.approval - 1, 0, 100);
  const text = '国への陳情は、受け入れられなかった。';
  say(g, p, L, text, { news: false });
  return { ok: true, win: false, text };
}

// ======================================================================== the crises
export function respondOptions(g) {
  const L = ensure(g);
  if (!L || !L.pending) return [];
  const k = L.pending.kind;
  if (k === 'noconf') return [
    { id: 'dissolve', name: '議会を解散する', desc: '議会を解散して、住民に信を問う（議会の選挙になる）。', odds: Math.round(clamp(L.approval * 0.9, 10, 85)), lines: ['成功：議会との関係 +25・支持 +5', '失敗：失職する'] },
    { id: 'talk', name: '各会派と話して、撤回を求める', desc: '不信任を出した会派と、条件を詰める。', odds: Math.round(clamp(25 + L.coop * 0.7, 10, 85)), lines: ['成功：議会との関係 +15', '失敗：不信任が可決され、失職する', '代償：支持 −5（条件をのんだ形）'] },
    { id: 'resign', name: '自分から辞職する', desc: '潔く職を辞す。', odds: null, lines: ['首長の職を失う'] },
  ];
  if (k === 'referendum') return [
    { id: 'vote', name: '住民投票を行う', desc: '条例の是非を、住民に直接問う。', odds: Math.round(clamp(L.approval * 0.8 + 10, 15, 85)), lines: ['賛成多数：支持 +3・議会との関係 +4', '反対多数：条例は廃止・支持 −3'] },
    { id: 'repeal', name: '条例を自分から廃止する', desc: '反対の声を受けて、条例を取り下げる。', odds: null, lines: ['条例は廃止', '支持 −2'] },
    { id: 'reject', name: '請求を退ける', desc: '議会の力で、住民投票を行わない。', odds: null, lines: ['支持 −6・議会との関係 −3', '請求した住民の怒りが残る'] },
  ];
  if (k === 'dispute') return [
    { id: 'accept', name: '国の要請に協力する', desc: '国の事業に協力して、補助金をもらう。', odds: null, lines: ['補助金の上積み（90日）', '支持 −3'] },
    { id: 'conditional', name: '条件をつけて協力する', desc: '地元の要望をのませて、協力する。', odds: Math.round(clamp(30 + L.coop * 0.3 - L.friction * 0.3, 10, 80)), lines: ['成功：補助金の上積み・支持 +2', '失敗：国との関係がこじれる（摩擦 +10）'] },
    { id: 'refuse', name: '要請に反対する', desc: '地元の声を盾に、国に反対する。', odds: null, lines: ['支持 +5（地元で人気）', '国との摩擦 +15・補助金が減る（120日）'] },
  ];
  return [];
}
function respond(g, choice, auto = false) {
  const p = pol(g), L = ensure(g);
  if (!p || !L || !L.pending) return { ok: false, why: '決めることはない' };
  const P = L.pending;
  const o = respondOptions(g).find((x) => x.id === choice);
  if (!o) return { ok: false, why: 'その選択肢はない' };
  L.pending = null;
  const win = o.odds == null ? true : roll(o.odds / 100);
  const apr = (d) => { L.approval = clamp(L.approval + d, 0, 100); };
  const coop = (d) => { L.coop = clamp(L.coop + d, 0, 100); };
  let text = '', lose = false;
  if (P.kind === 'noconf') {
    if (choice === 'dissolve') { if (win) { coop(25); apr(5); text = '議会を解散し、選挙で首長に近い会派が勝った。不信任は流れた。'; } else { lose = true; text = '議会を解散したが、選挙で反対派が勝ち、再び不信任が可決された。'; } }
    else if (choice === 'talk') { if (win) { coop(15); apr(-5); text = '各会派と話し合い、条件つきで不信任が取り下げられた。'; } else { lose = true; text = '話し合いはまとまらず、不信任決議が可決された。'; } }
    else { lose = true; text = '首長の職を辞することにした。'; }
  } else if (P.kind === 'referendum') {
    const O = ORD[P.id];
    if (choice === 'vote') {
      if (win) { apr(3); coop(4); text = `住民投票は「賛成」が多数だった。「${O.name}」はそのまま進む。`; }
      else { L.ordinances = L.ordinances.filter((x) => x.id !== P.id); apr(-3); text = `住民投票は「反対」が多数だった。「${O.name}」は廃止された。`; }
    } else if (choice === 'repeal') { L.ordinances = L.ordinances.filter((x) => x.id !== P.id); apr(-2); text = `「${O.name}」を廃止した。`; }
    else { apr(-6); coop(-3); text = '住民投票の請求を退けた。「住民の声を聞かない」との批判が出ている。'; }
  } else if (P.kind === 'dispute') {
    if (choice === 'accept') { L.grant = { mul: 1.08, until: today(g) + 90 }; apr(-3); text = '国の要請に協力することにした。補助金が上積みされる。'; }
    else if (choice === 'conditional') { if (win) { L.grant = { mul: 1.08, until: today(g) + 90 }; apr(2); text = '地元の要望をのませたうえで協力することで合意した。'; } else { L.friction = clamp(L.friction + 10, 0, 100); text = '条件が折り合わず、国との関係がこじれた。'; } }
    else { apr(5); L.friction = clamp(L.friction + 15, 0, 100); L.grant = { mul: 0.94, until: today(g) + 120 }; text = '国の要請に反対した。地元では歓迎されたが、国との関係は冷えこんだ。'; }
  }
  if (auto) text = `決めるのが遅れ、${text}`;
  say(g, p, L, text);
  if (lose && HEADS.has(office(p))) { try { g.resignOffice('不信任'); } catch (e) { console.error(e); } }
  return { ok: true, text, win, lose };
}

// ======================================================================== the morning
function tick(g) {
  const p = pol(g);
  const L = p && ensure(g);
  if (!L) return;
  const day = today(g);
  if (L.lastTick === day) return;
  L.lastTick = day;
  const head = HEADS.has(office(p));
  const S = sc(p);
  // the unanswered crisis is answered by its default after 3 days
  if (L.pending && day - num(L.pending.day) >= 3) {
    const dflt = L.pending.kind === 'noconf' ? 'talk' : L.pending.kind === 'referendum' ? 'reject' : 'accept';
    respond(g, dflt, true);
    if (!ensure(g)) return;
  }
  if (num(L.grant.until) && day > L.grant.until) L.grant = { mul: 1, until: 0 };
  if (head) {
    // money: the budget grows with the economy; ordinances and a grant change what is left
    const rev = 100 * (1 + num(p.economy && p.economy.growth) * 0.01) * (1 - (L.ordinances.some((x) => x.id === 'taxcut') ? 0.015 : 0)) * L.grant.mul;
    const spend = spendRate(L);
    L.debt = Math.max(0, L.debt + (spend - rev) / YEAR * 3);
    if (L.debt > 25 && L.cool.debtWarn !== Math.floor(day / 60)) { L.cool.debtWarn = Math.floor(day / 60); say(g, p, L, `借金（地方債）が予算の${Math.round(L.debt)}%に膨らんだ。議会から「財政再建を」と求める声が出ている。`); }
    // satisfaction drifts toward what the budget buys
    for (const k of KEYS) {
      const bonus = L.ordinances.reduce((a, x) => a + (ORD[x.id].area === k ? ORD[x.id].eff : 0), 0);
      const target = clamp(50 + (L.alloc[k] - NEED[k]) * 2.2 + bonus - (L.debt > 25 ? 4 : 0), 5, 95);
      L.sat[k] += (target - L.sat[k]) * 0.03;
    }
    const avg = KEYS.reduce((a, k) => a + L.sat[k] * (NEED[k] / 100), 0);
    const taxcut = L.ordinances.some((x) => x.id === 'taxcut') ? 4 : 0;
    let apTarget = avg + taxcut - (L.debt > 40 ? 8 : 0);
    try { const sc2 = typeof g.scandals === 'function' ? g.scandals() : null; if (sc2 && sc2.cases.some((c) => c.mine && c.stage !== 'closed' && c.heat > 50)) apTarget -= 10; } catch (e) { /* no scandals */ }
    L.approval = clamp(L.approval + (apTarget - L.approval) * 0.03, 0, 100);
    // the assembly drifts back to the party seats
    L.coop += (baseCoop(p, office(p)) - L.coop) * 0.01;
    L.friction = Math.max(0, L.friction - 0.15);
    // what the residents think is what the next election sees
    gain(p, 'localSupport', (L.approval - 50) * 0.004);
    gain(p, 'reputation', (L.approval - 50) * 0.001);
    // the crises (one at a time, rarely)
    if (!L.pending) {
      if (L.coop < 28 && L.approval < 38 && roll(0.03)) { L.pending = { kind: 'noconf', day }; say(g, p, L, `議会の反対派が、${S.head}に対する不信任決議案を出した。`); }
      else if (roll(1 / (YEAR * 1.5))) {
        L.pending = { kind: 'dispute', day };
        say(g, p, L, pick(['国が、広域の事業への協力を求めてきた。', '国が、新しい制度の実施を自治体に求めてきた。', '国の補助事業を受け入れるかどうか、決める時期が来た。']));
      }
    }
  } else {
    // a member: the head of the day is somebody else's; the support slowly follows the member's own work
    L.approval += (50 + num(p.me.reputation) * 0.3 - L.approval) * 0.02;
  }
}
const pick = (a) => a[Math.floor(rng() * a.length) % a.length];
onMorning((g) => tick(g));

// ======================================================================== summary and API
export function summary(g) {
  const p = pol(g), L = ensure(g);
  if (!p || !L) return null;
  const o = office(p), head = HEADS.has(o), S = sc(p);
  return {
    office: o, officeName: OFFICES[o] ? OFFICES[o].label : o, head, headName: S.head, place: S.name, base: S.base,
    alloc: { ...L.alloc }, sat: Object.fromEntries(KEYS.map((k) => [k, Math.round(L.sat[k])])), approval: Math.round(L.approval), coop: Math.round(L.coop), debt: Math.round(L.debt),
    friction: Math.round(L.friction), grant: L.grant.until ? { mul: L.grant.mul, left: Math.max(0, L.grant.until - today(g)) } : null,
    ordinances: L.ordinances.map((x) => ({ id: x.id, name: ORD[x.id].name, area: ORD[x.id].area, day: x.day })), tally: { ...L.tally },
    pending: L.pending ? { kind: L.pending.kind, left: Math.max(0, 3 - (today(g) - L.pending.day)), id: L.pending.id || null } : null, log: L.log.slice(0, 15), spend: Math.round(spendRate(L)),
    seatShare: Math.round(assemblyShare(p, o) * 100),
  };
}
const METHODS = {
  localGov() { return summary(this); },
  localGovOrdinances() { const L = ensure(this); if (!L) return []; return ORDINANCES.map((o) => ({ ...o, odds: ordinanceOdds(this, o.id), done: L.ordinances.some((x) => x.id === o.id), areaName: o.area ? AREAS[o.area] : '全体' })); },
  localGovPropose(id) { return propose(this, id); },
  localGovBudget(o) { return budget(this, o || {}); },
  localGovLobby() { return lobby(this); },
  localGovPlead() { return plead(this); },
  localGovPleadOdds() { return pleadOdds(this); },
  localGovOptions() { return respondOptions(this); },
  localGovRespond(choice) { return respond(this, choice); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__local = { setLocalRng, tick: (g) => tick(g), ORDINANCES };

// ======================================================================== the phone app 「自治体」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 7, y + 20, 18, 5, '#f4ecd8'); R(c, x + 9, y + 12, 3, 8, '#f4ecd8'); R(c, x + 14, y + 12, 3, 8, '#f4ecd8'); R(c, x + 19, y + 12, 3, 8, '#f4ecd8'); R(c, x + 7, y + 9, 18, 3, '#f4ecd8'); R(c, x + 14, y + 6, 4, 3, '#f4ecd8');
}
const barCol = (v) => (v >= 60 ? '#3a9a5a' : v >= 40 ? '#d8a82e' : '#c8402e');
function bar(c, x, y, w, v) { R(c, x, y, w, 8, '#c8c2b4'); R(c, x, y, Math.round((w * clamp(v, 0, 100)) / 100), 8, barCol(v)); }
async function viewStatus(g) {
  const s = summary(g);
  if (!s) return;
  await phoneInfo(g, {
    title: s.place === 'ドット区' ? '区の状況' : '都の状況', color: COLOR,
    draw(c, a) {
      const x = a.x + 10, w = a.w - 20;
      let y = a.y + 6;
      const row = (name, v, note) => { T(c, name, x, y, 11, '#333'); T(c, note, x + w, y, 10, '#666', 'right'); bar(c, x, y + 14, w, v); y += 27; };
      row('住民の支持', s.approval, `${s.approval}`);
      if (s.head) row('議会との関係', s.coop, `${s.coop}（与党の議席 ${s.seatShare}%）`);
      for (const k of KEYS) row(`${AREAS[k]}の満足`, s.sat[k], `${s.sat[k]}${s.head ? `　予算${s.alloc[k]}%` : ''}`);
      if (s.head) { T(c, `借金 予算の${s.debt}%　支出 ${s.spend}%${s.grant ? `　補助金×${s.grant.mul}` : ''}`, x, y, 10, s.debt > 25 ? '#b03a2a' : '#555'); y += 14; T(c, `国との摩擦 ${s.friction}`, x, y, 10, '#555'); }
    },
  });
}
async function viewBudget(g) {
  const s = summary(g);
  if (!s.head) { await phoneInfo(g, { title: '予算', color: COLOR, text: '予算を組むのは首長。議員は、条例案や質問で動かす。' }); return; }
  const a = await phoneList(g, { title: '増やす分野', color: COLOR, items: KEYS.map((k) => ({ label: AREAS[k], sub: `いま${s.alloc[k]}%・満足${s.sat[k]}` })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (a < 0) return;
  const rest = KEYS.filter((k) => k !== KEYS[a]);
  const b = await phoneList(g, { title: `${AREAS[KEYS[a]]}を増やす：減らす分野`, color: COLOR, items: rest.map((k) => ({ label: AREAS[k], sub: `いま${s.alloc[k]}%` })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (b < 0) return;
  const ok = await phoneConfirm(g, { title: '予算の組みかえ', color: COLOR, text: `${AREAS[KEYS[a]]} +5%\n${AREAS[rest[b]]} −5%\n\n・満足度は、予算の配分が暮らしの必要に合っているほど上がる\n・すぐには変わらず、じわじわ動く`, choices: ['組みかえる', 'やめる'] });
  if (ok !== 0) return;
  const r = g.localGovBudget({ up: KEYS[a], down: rest[b] });
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: '予算の組みかえ', color: COLOR, text: r.ok ? r.text : r.why });
}
async function viewOrdinances(g) {
  const list = g.localGovOrdinances();
  const i = await phoneList(g, { title: '条例を提案', color: COLOR, items: list.map((o) => ({ label: `${o.done ? '✓ ' : ''}${o.name}`, sub: o.done ? '制定ずみ' : `${o.areaName}・可決の見込み${o.odds}%` })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0 || !list[i]) return;
  const o = list[i];
  const ok = await phoneConfirm(g, { title: o.name.length > 12 ? '条例案' : o.name, color: COLOR, text: `${o.desc}\n\n${bulletText([`費用：予算の${o.cost > 0 ? `${o.cost}%（毎年）` : `${-o.cost}%を節約`}`, `${o.area ? `${AREAS[o.area]}の満足 ${o.eff >= 0 ? '+' : ''}${o.eff}` : '住民への影響は暮らし全般'}`, `住民の支持 ${o.pop >= 0 ? '+' : ''}${o.pop}`, ...(o.hot ? ['反対の声が強く、住民投票を求められることがある'] : [])])}\n\n可決の見込み ${o.odds}%`, choices: ['議会に出す', 'やめる'] });
  if (ok !== 0) return;
  const r = g.localGovPropose(o.id);
  g.sfx(r.ok && r.win ? 'ok' : 'buzz');
  await phoneInfo(g, { title: o.name.length > 12 ? '条例案' : o.name, color: COLOR, text: r.ok ? r.text : r.why });
}
async function answerPending(g) {
  const opts = g.localGovOptions();
  const s = g.localGov();
  const head = { noconf: '不信任決議', referendum: '住民投票の請求', dispute: '国からの要請' }[s.pending.kind] || '決めること';
  const i = await phoneList(g, { title: head, color: COLOR, items: opts.map((o) => ({ label: o.name, sub: o.odds != null ? `見込み${o.odds}%` : '確実' })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0 || !opts[i]) return;
  const o = opts[i];
  const ok = await phoneConfirm(g, { title: o.name.length > 12 ? '方針' : o.name, color: COLOR, text: `${o.desc}\n\n${bulletText(o.lines)}${o.odds != null ? `\n\n成功の見込み ${o.odds}%` : ''}`, choices: ['この方針で行く', 'やめる'] });
  if (ok !== 0) return;
  const r = g.localGovRespond(o.id);
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: head, color: COLOR, text: r.ok ? r.text : r.why });
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const s = g.localGov();
    if (!s) { await phoneInfo(g, { title: '自治体', color: COLOR, text: '区議・都議・区長・知事のあいだだけ使える。' }); return; }
    const rows = [];
    if (s.pending) rows.push({ label: `★ ${{ noconf: '不信任決議への対応', referendum: '住民投票の請求', dispute: '国の要請への返事' }[s.pending.kind]}`, sub: `あと${s.pending.left}日`, run: () => answerPending(g) });
    rows.push({ label: '状況', sub: `支持${s.approval}${s.head ? `・議会${s.coop}・借金${s.debt}%` : ''}`, run: () => viewStatus(g) });
    rows.push({ label: s.head ? '条例を提案' : '議員提案の条例', sub: `制定${s.ordinances.length}件・可決${s.tally.passed}／否決${s.tally.failed}`, run: () => viewOrdinances(g) });
    if (s.head) {
      rows.push({ label: '予算の配分', sub: KEYS.map((k) => `${AREAS[k].slice(0, 2)}${s.alloc[k]}`).join(' '), run: () => viewBudget(g) });
      rows.push({ label: '議会に根回しする', sub: `議会との関係${s.coop}・経費10万円`, run: async () => { const r = g.localGovLobby(); g.sfx(r.ok ? 'ok' : 'buzz'); await phoneInfo(g, { title: '根回し', color: COLOR, text: r.ok ? r.text : r.why }); } });
      rows.push({ label: '国に陳情する', sub: `見込み${g.localGovPleadOdds()}%`, run: async () => { const r = g.localGovPlead(); g.sfx(r.ok && r.win ? 'ok' : 'buzz'); await phoneInfo(g, { title: '国への陳情', color: COLOR, text: r.ok ? r.text : r.why }); } });
    }
    rows.push({ label: '記録', sub: `${s.log.length}件`, run: async () => { await phoneInfo(g, { title: '記録', color: COLOR, text: s.log.length ? s.log.map((l) => `・${l.text}`).join('\n\n') : 'まだ記録はない。' }); } });
    const i = await phoneList(g, { title: s.place === 'ドット区' ? 'ドット区' : s.place, color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('jichi', {
  name: '自治体', color: COLOR, order: 66.7,
  iconHD: icon,
  cond: (g) => { try { return !!g && !!g.state && active(g); } catch (e) { return false; } },
  open: (g) => openApp(g),
});
export { openApp as openLocalGovApp, tick as localGovTick };
