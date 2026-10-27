// 世論操作とメディア戦略 (R24) — what a politician does about the press and the public's mood: the relations with the four kinds of outlet (新聞・テレビ・週刊誌・ネット), a 広報 team, honest
// ways to win favour (記者との懇談・独占取材・広報キャンペーン・世論調査) and dishonest ones (ステルスマーケティング・フェイク情報の拡散・調査結果の誘導). The dishonest ones work — and they build up a
// 気づかれる危険 that is paid in a scandal (scandal.js) when it comes out. The press also comes asking: a weekly is working on a story (取材の申し入れ) and the answer is the player's.
// Other politicians do it too, and are found out (the news, a case in scandal.js, whatever the party).
//
// Rules: nothing is refused for being bad — every action shows its effect, its price and its risk first; every person is fictional (a real named figure never has a scandal).
//
// State g.state.mediaOps (lazy, repaired on read): { v, rel: { paper, tv, weekly, net } (−100..100), staff (0..2), dirt (0..100: the risk of being found out), types: { stealth, fake, poll } (counts), pending: null | { kind: 'inquiry', topic, day },
//   cool: { id: day }, log: [{ day, text }], lastTick, campaign: null | { theme, until }, polls: n }
// API (on Game): g.mediaOps() → the summary; g.mediaOpsActions() → [{ id, group, name, desc, lines, risk, why, … }]; g.mediaOpsAct(id, opts) → { ok, why?, text? }; g.mediaOpsOptions() / g.mediaOpsRespond(choice) → the weekly's inquiry.
//   The phone app 「広報」 (id 'koho', order 66.9).

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { SEGMENT_ORDER, dateLabel, polDate } from './politics.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText, phoneText as T } from './phone.js';

const COLOR = '#b8506a';
const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const today = (g) => (g.state && g.state.day) || 1;
let rng = () => Math.random();
export const setMediaRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const roll = (p) => rng() < p;
const rint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pol = (g) => (typeof g.pol === 'function' ? g.pol() : null);
export const OUTLETS = { paper: '新聞', tv: 'テレビ', weekly: '週刊誌', net: 'ネット' };
const OKEYS = Object.keys(OUTLETS);
// R28: no internet before 1996 — the outlets are the paper, the TV and the weeklies; the net actions wait
const hasNet = (g) => { try { return polDate(g).year >= 1996; } catch (e) { return true; } };
const keysOf = (g) => (hasNet(g) ? OKEYS : OKEYS.filter((k) => k !== 'net'));

// ======================================================================== state
const politician = (p) => !!(p && p.me && (p.me.office || (p.me.posts || []).length));
function ensure(g) {
  const p = pol(g);
  if (!p || !g.state) return null;
  let M = g.state.mediaOps;
  if (!isObj(M)) M = g.state.mediaOps = { v: 1, rel: {}, staff: 0, dirt: 0, types: { stealth: 0, fake: 0, poll: 0 }, pending: null, cool: {}, log: [], lastTick: 0, campaign: null, polls: 0 };
  if (!isObj(M.rel)) M.rel = {};
  for (const k of OKEYS) M.rel[k] = clamp(num(M.rel[k]), -100, 100);
  M.staff = clamp(Math.round(num(M.staff)), 0, 2); M.dirt = clamp(num(M.dirt), 0, 100); M.polls = num(M.polls);
  if (!isObj(M.types)) M.types = {};
  for (const k of ['stealth', 'fake', 'poll']) M.types[k] = num(M.types[k]);
  if (!isObj(M.cool)) M.cool = {};
  if (!Array.isArray(M.log)) M.log = [];
  if (!isObj(M.pending) || M.pending.kind !== 'inquiry') M.pending = null;
  if (!isObj(M.campaign) || !M.campaign.until) M.campaign = null;
  return M;
}
const say = (g, p, M, text, o = {}) => {
  M.log.unshift({ day: today(g), text }); if (M.log.length > 30) M.log.length = 30;
  if (o.news) { p.news.unshift({ day: today(g), text, kind: 'politics' }); if (p.news.length > 80) p.news.length = 80; }
};
const rel = (M, k, d) => { M.rel[k] = clamp(M.rel[k] + d, -100, 100); };
const relAll = (M, d, g) => { for (const k of g ? keysOf(g) : OKEYS) rel(M, k, d); };
const avgRel = (M, g) => { const ks = g ? keysOf(g) : OKEYS; return ks.reduce((a, k) => a + M.rel[k], 0) / ks.length; };
const money = (g, n) => (num(g.state.money) >= n);
const cost = (g, n) => { g.state.money = num(g.state.money) - n; };
const fans = (g, n) => { try { if (typeof g.addFans === 'function') g.addFans(Math.round(n), true); } catch (e) { /* no fans */ } };
const fame = (g, n) => { try { if (typeof g.addFame === 'function') g.addFame(n, true); } catch (e) { /* no fame */ } };
const support = (p, id, d) => { if (!p.parties[id]) return; for (const seg of SEGMENT_ORDER) { const m = p.support.mods[seg] || (p.support.mods[seg] = {}); m[id] = clamp(num(m[id]) + d, -0.3, 0.3); } };
function mood(g, p, d, text) {
  p.cabinet.mood = clamp(num(p.cabinet.mood) + d, -20, 20);
  if (typeof g.approvalNote === 'function') { try { g.approvalNote('policy', Math.round(d * 10) / 10, text, { applied: true }); } catch (e) { /* ignore */ } }
}
const isPM = (p) => p.cabinet && p.cabinet.pm === 'player';
const riskWord = (M) => (M.dirt >= 45 ? '高い' : M.dirt >= 20 ? 'ある' : M.dirt > 0 ? '小さい' : 'ない');

// ======================================================================== the actions
const price = (g, yen) => Math.round(yen);
const ACTIONS = [
  { id: 'kondan', group: '関係づくり', name: '記者との懇談', cost: 60000, cool: 6, desc: '各社の記者を招いて、ざっくばらんに話す。',
    lines: () => ['新聞・テレビとの関係 +8', 'メディアの評価 +2'], run: (g, p, M) => { rel(M, 'paper', 8); rel(M, 'tv', 8); p.me.media = clamp(num(p.me.media) + 2, -100, 100); return '記者たちとの懇談で、距離が少し縮まった。'; } },
  { id: 'exclusive', group: '関係づくり', name: '週刊誌の独占取材に応じる', cost: 0, cool: 8, desc: '週刊誌に、素顔や私生活の話まで答える。',
    lines: () => ['週刊誌との関係 +12・知名度 +30・ファン +', '新聞との関係 −4（「軽い」と見られる）'], run: (g, p, M) => { rel(M, 'weekly', 12); rel(M, 'paper', -4); fame(g, 30); fans(g, 40 + num(g.state.fans) * 0.004); return '独占取材が載り、人柄が話題になった。'; } },
  { id: 'sns_team', group: '関係づくり', name: '広報チームを雇う', cost: 400000, cool: 0, desc: '発信を専門に担当する人を雇う（最大2人。毎月の人件費がかかる）。',
    lines: (g, M) => [`いま${M.staff}人・毎月 ${fmtMoney(150000)}／人`, hasNet(g) ? '毎日、ファンが少しずつ増える・ネットとの関係 +10' : '毎日、ファンが少しずつ増える'], why: (g, M) => (M.staff >= 2 ? '2人まで' : null), run: (g, p, M) => { M.staff++; rel(M, 'net', 10); return `広報担当を雇った（${M.staff}人）。発信が安定した。`; } },
  { id: 'campaign', group: '広報', name: '広報キャンペーン', cost: 1000000, cool: 20, desc: '実績・政策・人柄のどれかを、広告と発信で集中的に伝える。', theme: true,
    lines: () => ['約20日間、評判とファンが伸びる', '総理なら内閣の支持にも効く'], run: (g, p, M, o) => { const t = ['実績', '政策', '人柄'][clamp(num(o.theme), 0, 2)]; M.campaign = { theme: t, until: today(g) + 20 }; p.me.reputation = clamp(num(p.me.reputation) + 2, -100, 100); fans(g, 80 + num(g.state.fans) * 0.01); if (isPM(p)) mood(g, p, 1.2, `広報キャンペーン（${t}）`); relAll(M, 2, g); return `広報キャンペーン（${t}を伝える）を始めた。`; } },
  { id: 'poll', group: '広報', name: '世論調査を発注する（正直に）', cost: 800000, cool: 10, desc: '調査会社に、公平な質問で調べてもらう。いまの立ち位置がわかる。',
    lines: () => ['内閣・党・自分の支持の数字がわかる', '結果は公表しなくてもよい'], run: (g, p, M) => { M.polls++; const ap = Math.round(num(p.cabinet.approval)); const lc = Math.round(num(p.me.localSupport)); return `調査の結果：内閣の支持率 ${ap}%。自分への地元の支持 ${lc}。メディアの評価 ${Math.round(num(p.me.media))}。`; } },
  { id: 'pollbias', group: '裏の手', name: '世論調査の質問を誘導する', cost: 800000, cool: 10, desc: '答えが偏る質問の文言で調べさせ、有利な数字を公表する。', risk: 12,
    lines: () => ['評判 +2・（総理なら）内閣の支持 +1', '気づかれる危険 +12（発覚すれば、数字の信頼を損なう事件になる）'], run: (g, p, M) => { M.polls++; M.types.poll++; M.dirt = clamp(M.dirt + 12, 0, 100); p.me.reputation = clamp(num(p.me.reputation) + 2, -100, 100); if (isPM(p)) mood(g, p, 1, '有利な世論調査の公表'); return '「支持が高い」という数字を公表した。質問の文言は、公表していない。'; } },
  { id: 'stealth', net: true, group: '裏の手', name: 'ステルスマーケティング（やらせの投稿）', cost: 600000, cool: 8, desc: '報酬を払って、好意的な投稿や口コミを広めてもらう（広告とは明かさない）。', risk: 15,
    lines: (g) => [`ファン +${Math.round(60 + num(g.state.fans) * 0.02)}・ネットでの話題が高まる`, 'ネットとの関係 +6', '気づかれる危険 +15（発覚すれば、ネットとの関係が大きく落ちる）'], run: (g, p, M) => { M.types.stealth++; M.dirt = clamp(M.dirt + 15, 0, 100); fans(g, 60 + num(g.state.fans) * 0.02); fame(g, 20); rel(M, 'net', 6); return '好意的な投稿が広まり、話題になった。依頼したことは、伏せてある。'; } },
  { id: 'fake', net: true, group: '裏の手', name: '対立勢力のデマを広める', cost: 300000, cool: 10, desc: '対立する政党や候補者について、事実でない話をネットで広める。', risk: 18, party: true,
    lines: () => ['相手の支持が下がる（少し）・自分の党の支持が上がる（わずか）', '気づかれる危険 +18（発覚すれば、名誉毀損の疑いも加わる重い事件になる）'], run: (g, p, M, o) => { M.types.fake++; M.dirt = clamp(M.dirt + 18, 0, 100); if (o.target) support(p, o.target, -0.004); if (p.me.party) support(p, p.me.party, 0.001); return `${o.target && p.parties[o.target] ? `${p.parties[o.target].short || p.parties[o.target].name}についての` : '相手についての'}話が、ネットで広まっていった。出どころは、わからないようにしてある。`; } },
];
const A = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

export function actions(g) {
  const p = pol(g), M = ensure(g);
  if (!p || !M) return [];
  const day = today(g);
  return ACTIONS.map((a) => {
    let why = null;
    if (!politician(p)) why = '議員や大臣など、政治の職にいるときに使える';
    else if (a.net && !hasNet(g)) why = 'まだインターネットが広まっていない（1996年〜）';
    else if (a.why && a.why(g, M)) why = a.why(g, M);
    else if (num(M.cool[a.id]) && a.cool && day - M.cool[a.id] < a.cool) why = `あと${a.cool - (day - M.cool[a.id])}日`;
    else if (a.cost && !money(g, a.cost)) why = 'お金が足りない';
    return { id: a.id, group: a.group, name: a.name, desc: a.desc, cost: a.cost, lines: a.lines(g, M), risk: a.risk || 0, why, theme: !!a.theme, party: !!a.party };
  });
}
export function act(g, id, o = {}) {
  const p = pol(g), M = ensure(g);
  const a = A[id];
  if (!p || !M || !a) return { ok: false, why: 'その手はない' };
  const row = actions(g).find((x) => x.id === id);
  if (row.why) return { ok: false, why: row.why };
  if (a.cost) cost(g, a.cost);
  M.cool[id] = today(g);
  const text = a.run(g, p, M, o);
  say(g, p, M, text);
  return { ok: true, text };
}

// ======================================================================== the weekly's inquiry
export function inquiryOptions(g) {
  const p = pol(g), M = ensure(g);
  if (!p || !M || !M.pending) return [];
  const hidden = num(p.me.secret) > 0;
  return [
    { id: 'answer', name: '誠実に答える', desc: '聞かれたことに、ありのまま答える。', odds: null, lines: ['週刊誌との関係 +5・評判 +1', hidden ? '政治資金で載せていない金のことも聞かれる（答えれば、事実が明るみに出る）' : '記事は、大きくならない'] },
    { id: 'nocomment', name: 'ノーコメントにする', desc: '「個別のことにはお答えしない」。', odds: null, lines: ['週刊誌との関係 −5・メディアの評価 −3', '記事は予定どおり載る'] },
    { id: 'legal', name: '弁護士を通じて、掲載の中止を求める', desc: '「事実無根」と強く警告する。', odds: clamp(Math.round(55 - M.rel.weekly * 0.1), 15, 70), lines: ['成功：記事は載らない', '失敗：「圧力をかけた」と、かえって大きく報じられる（週刊誌との関係 −15・評判 −3）'] },
    { id: 'first', name: '先に自分から発表する', desc: '報じられる前に、会見や発信で説明する。', odds: null, lines: ['ダメージは小さく抑えられる', '週刊誌とネットとの関係 +3'] },
  ];
}
function respondInquiry(g, choice, auto = false) {
  const p = pol(g), M = ensure(g);
  if (!p || !M || !M.pending) return { ok: false, why: '決めることはない' };
  const o = inquiryOptions(g).find((x) => x.id === choice);
  if (!o) return { ok: false, why: 'その選択肢はない' };
  const topic = M.pending.topic, hidden = num(p.me.secret) > 0;
  M.pending = null;
  const win = o.odds == null ? true : roll(o.odds / 100);
  let text = '';
  const rep = (d) => { p.me.reputation = clamp(num(p.me.reputation) + d, -100, 100); };
  if (choice === 'answer') {
    rel(M, 'weekly', 5); rep(1);
    if (hidden) { const amt = Math.round(p.me.secret); p.me.exposed = num(p.me.exposed) + amt; p.me.secret = 0; try { g.politicalScandal('slush_fund', { who: 'player', amount: amt, severity: 3 }); } catch (e) { console.error(e); } text = `取材に誠実に答えた。政治資金の載せていない金のことも話し、記事になった（${fmtMoney(amt)}）。`; }
    else text = `${topic}について、ありのまま答えた。記事は小さく扱われた。`;
  } else if (choice === 'nocomment') { rel(M, 'weekly', -5); p.me.media = clamp(num(p.me.media) - 3, -100, 100); text = auto ? '返事が遅れ、「ノーコメント」とされた。記事は予定どおり載った。' : '「お答えできない」と返した。記事は予定どおり載り、「説明がない」と書かれた。'; rep(-1); }
  else if (choice === 'legal') {
    if (win) { text = '弁護士の警告で、記事の掲載は見送られた。'; } else { rel(M, 'weekly', -15); rep(-3); p.me.media = clamp(num(p.me.media) - 4, -100, 100); text = '警告したことが「圧力だ」と報じられ、記事はかえって大きくなった。'; }
  } else { rel(M, 'weekly', 3); rel(M, 'net', 3); rep(0.5); text = '先に自分から説明した。記事の勢いは、弱まった。'; }
  say(g, p, M, text, { news: choice === 'nocomment' || (choice === 'legal' && !win) });
  return { ok: true, text, win, auto };
}

// ======================================================================== exposure, other people, the morning
function expose(g, p, M) {
  const t = M.types;
  const kind = t.fake > 0 && roll(0.5) ? 'fake' : t.stealth > 0 && roll(0.6) ? 'stealth' : t.poll > 0 ? 'biasedpoll' : t.fake > 0 ? 'fake' : 'stealth';
  const sev = kind === 'fake' ? 4 : kind === 'stealth' ? 3 : 2;
  relAll(M, -12, g); rel(M, 'net', -10); p.me.media = clamp(num(p.me.media) - 15, -100, 100);
  if (p.me.party) support(p, p.me.party, -0.004);
  try { g.politicalScandal(kind, { who: 'player', name: ({ fake: 'フェイク情報の拡散（対立勢力へのデマ）', stealth: 'ステルスマーケティング（やらせの投稿・広告）', biasedpoll: '世論調査の結果の誘導' })[kind], severity: sev }); } catch (e) { console.error(e); }
  M.dirt = Math.max(0, M.dirt - 50); M.types = { stealth: 0, fake: 0, poll: 0 };
  say(g, p, M, '裏で行っていたことが明るみに出た。', { news: false });
}
export function exposureRate(g) {
  const p = pol(g), M = ensure(g);
  if (!p || !M || M.dirt <= 0) return 0;
  const press = typeof g.pressFreedom === 'function' ? (() => { try { return num(g.pressFreedom().value, 60); } catch (e) { return 60; } })() : 60;
  return 0.0002 * M.dirt * (0.6 + press / 100) * (1 + (M.rel.net < 0 ? 0.3 : 0) + (M.rel.weekly < 0 ? 0.3 : 0));
}
function tick(g) {
  const p = pol(g), M = p && ensure(g);
  if (!M) return;
  const day = today(g);
  if (M.lastTick === day) return;
  M.lastTick = day;
  if (M.pending && day - num(M.pending.day) >= 3) respondInquiry(g, 'nocomment', true);
  // NPC politicians also run a dirty media operation once in a while, and are found out (a case in scandal.js, whatever the party)
  if (roll(1.2 / YEAR) && typeof g.politicalScandal === 'function') {
    const pool = Object.values(p.npcs).filter((n) => !n.real && !n.dead && !n.exMp && n.office);
    if (pool.length) { const n = pool[Math.floor(rng() * pool.length) % pool.length]; const kinds = hasNet(g) ? ['stealth', 'fake', 'biasedpoll'] : ['biasedpoll']; const kind = kinds[Math.floor(rng() * kinds.length) % kinds.length]; try { g.politicalScandal(kind, { who: n.id, severity: kind === 'fake' ? 4 : kind === 'stealth' ? 3 : 2 }); } catch (e) { console.error(e); } }
  }
  if (!politician(p)) return;
  for (const k of OKEYS) M.rel[k] += (0 - M.rel[k]) * 0.01;
  p.me.media = clamp(num(p.me.media) + (avgRel(M, g) - num(p.me.media)) * 0.02, -100, 100);
  if (M.dirt > 0) { M.dirt = Math.max(0, M.dirt - 0.1); if (roll(exposureRate(g))) expose(g, p, M); }
  if (M.campaign && day > M.campaign.until) M.campaign = null;
  if (M.campaign) fans(g, 2 + num(g.state.fans) * 0.0008);
  if (M.staff) {
    fans(g, M.staff * (2 + num(g.state.fans) * 0.0012));
    if (day % 10 === 0) { const c = 150000 * M.staff; if (money(g, c)) cost(g, c); else { M.staff--; say(g, p, M, '給料が払えず、広報担当が辞めた。', { news: false }); } }
  }
  // the weekly comes asking (about once a year, more when the relation is bad or there is a hidden fund)
  if (!M.pending && roll((1 / (YEAR * 1.5)) * (1 + (M.rel.weekly < -10 ? 0.6 : 0) + (num(p.me.secret) > 0 ? 1 : 0)))) {
    const topics = num(p.me.secret) > 0 ? ['政治資金の使いみち', '後援会の会計'] : ['後援会の人たちとの関係', '過去の発言', '親族の仕事', '資産の状況'];
    M.pending = { kind: 'inquiry', topic: topics[Math.floor(rng() * topics.length) % topics.length], day };
    say(g, p, M, `週刊誌が、${M.pending.topic}について取材を申し入れてきた。（「広報」で対応を）`, { news: false });
    try { g.message({ from: '週刊誌の記者', text: `${M.pending.topic}について、お話を聞かせてください。（「広報」アプリで対応を決めてください）`, kind: 'news' }); } catch (e) { /* no phone */ }
  }
}
onMorning((g) => tick(g));

// ======================================================================== the summary and the API
function summary(g) {
  const p = pol(g), M = p && ensure(g);
  if (!M) return null;
  return {
    active: politician(p), rel: Object.fromEntries(keysOf(g).map((k) => [k, M.rel[k]])), labels: OUTLETS, staff: M.staff, risk: riskWord(M), riskLevel: M.dirt >= 45 ? 2 : M.dirt >= 20 ? 1 : 0, media: Math.round(num(p.me.media)),
    campaign: M.campaign ? { theme: M.campaign.theme, left: Math.max(0, M.campaign.until - today(g)) } : null, pending: M.pending ? { kind: 'inquiry', topic: M.pending.topic, left: Math.max(0, 3 - (today(g) - M.pending.day)) } : null,
    polls: M.polls, log: M.log.slice(0, 15).map((l) => ({ date: dateLabel(g, l.day), text: l.text })),
  };
}
const METHODS = {
  mediaOps() { return summary(this); },
  mediaOpsActions() { return actions(this); },
  mediaOpsAct(id, o) { return act(this, id, o || {}); },
  mediaOpsOptions() { return inquiryOptions(this); },
  mediaOpsRespond(choice) { return respondInquiry(this, choice); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__media = { setMediaRng, tick: (g) => tick(g), exposureRate: (g) => exposureRate(g) };

// ======================================================================== the phone app 「広報」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 8, y + 9, 16, 11, '#f4ecd8'); R(c, x + 11, y + 20, 5, 4, '#f4ecd8'); R(c, x + 11, y + 12, 10, 2, COLOR); R(c, x + 11, y + 16, 7, 2, COLOR);
}
const relCol = (v) => (v >= 20 ? '#3a9a5a' : v >= -20 ? '#d8a82e' : '#c8402e');
async function viewStatus(g) {
  const s = g.mediaOps();
  await phoneInfo(g, {
    title: 'メディアとの関係', color: COLOR,
    draw(c, a) {
      const x = a.x + 10, w = a.w - 20;
      let y = a.y + 8;
      for (const k of Object.keys(s.rel)) { const v = s.rel[k]; T(c, OUTLETS[k], x, y, 12, '#333'); T(c, `${Math.round(v)}`, x + w, y, 11, '#666', 'right'); R(c, x, y + 16, w, 8, '#c8c2b4'); R(c, x + w / 2, y + 16, 1, 8, '#555'); const bw = Math.round((w / 2) * Math.abs(v) / 100); R(c, v >= 0 ? x + w / 2 : x + w / 2 - bw, y + 16, bw, 8, relCol(v)); y += 34; }
      T(c, `メディアの評価 ${s.media}　広報担当 ${s.staff}人`, x, y, 11, '#555'); y += 16;
      T(c, `気づかれる危険：${s.risk}`, x, y, 12, s.riskLevel >= 2 ? '#b03a2a' : s.riskLevel === 1 ? '#a06a2a' : '#2f7a4a'); y += 16;
      if (s.campaign) T(c, `広報キャンペーン中（${s.campaign.theme}・あと${s.campaign.left}日）`, x, y, 11, '#555');
    },
  });
}
async function runAct(g, a, opts = {}, tail = '') {
  const ok = !a.why;
  const text = `${a.desc}\n\n${bulletText(a.lines)}${a.cost ? `\n\n費用 ${fmtMoney(a.cost)}` : ''}${tail}${a.why ? `\n\n（${a.why}）` : ''}`;
  const i = await phoneConfirm(g, { title: a.name.length > 12 ? '方針' : a.name, color: COLOR, text, choices: ok ? ['実行する', 'やめる'] : ['もどる'] });
  if (!ok || i !== 0) return;
  const r = g.mediaOpsAct(a.id, opts);
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: a.name.length > 12 ? '結果' : a.name, color: COLOR, text: r.ok ? r.text : r.why });
}
async function pickAndRun(g, a) {
  if (a.theme) {
    const i = await phoneList(g, { title: '伝えること', color: COLOR, items: [{ label: '実績' }, { label: '政策' }, { label: '人柄' }], hint: 'A:えらぶ　B:もどる' });
    if (i < 0) return;
    return runAct(g, a, { theme: i }, `\nテーマ：${['実績', '政策', '人柄'][i]}`);
  }
  if (a.party) {
    const p = g.pol();
    const ids = Object.keys(p.parties).filter((id) => id !== p.me.party && !p.parties[id].isPlayers).slice(0, 8);
    const i = await phoneList(g, { title: '誰のデマか', color: COLOR, items: ids.map((id) => ({ label: p.parties[id].name || id })), hint: 'A:えらぶ　B:もどる' });
    if (i < 0 || !ids[i]) return;
    return runAct(g, a, { target: ids[i] }, `\n対象：${p.parties[ids[i]].name || ids[i]}`);
  }
  return runAct(g, a);
}
async function answerInquiry(g) {
  const opts = g.mediaOpsOptions();
  const s = g.mediaOps();
  const i = await phoneList(g, { title: `取材：${s.pending.topic}`.slice(0, 14), color: COLOR, items: opts.map((o) => ({ label: o.name, sub: o.odds != null ? `見込み${o.odds}%` : '確実' })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0 || !opts[i]) return;
  const o = opts[i];
  const ok = await phoneConfirm(g, { title: o.name.length > 12 ? '方針' : o.name, color: COLOR, text: `${o.desc}\n\n${bulletText(o.lines)}${o.odds != null ? `\n\n成功の見込み ${o.odds}%` : ''}`, choices: ['この方針で行く', 'やめる'] });
  if (ok !== 0) return;
  const r = g.mediaOpsRespond(o.id);
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: '週刊誌の取材', color: COLOR, text: r.ok ? r.text : r.why });
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const s = g.mediaOps();
    if (!s) { await phoneInfo(g, { title: '広報', color: COLOR, text: 'いまは使えない。' }); return; }
    const acts = g.mediaOpsActions();
    const rows = [];
    if (s.pending) rows.push({ label: '★ 週刊誌の取材への対応', sub: `${s.pending.topic}・あと${s.pending.left}日`, run: () => answerInquiry(g) });
    rows.push({ label: 'メディアとの関係', sub: `評価${s.media}・危険${s.risk}`, run: () => viewStatus(g) });
    for (const a of acts) rows.push({ label: a.name, sub: a.why ? a.why : `${a.group}${a.cost ? `・${fmtMoney(a.cost)}` : ''}${a.risk ? '・危険あり' : ''}`, run: () => pickAndRun(g, a) });
    rows.push({ label: '記録', sub: `${s.log.length}件`, run: async () => { await phoneInfo(g, { title: '記録', color: COLOR, text: s.log.length ? s.log.map((l) => `■${l.date}\n${l.text}`).join('\n\n') : 'まだ記録はない。' }); } });
    const i = await phoneList(g, { title: '広報', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('koho', {
  name: '広報', color: COLOR, order: 66.9,
  iconHD: icon,
  cond: (g) => { try { const p = pol(g); return !!g && !!g.state && !!p && politician(p); } catch (e) { return false; } },
  open: (g) => openApp(g),
});
export { openApp as openMediaOpsApp, tick as mediaOpsTick };
