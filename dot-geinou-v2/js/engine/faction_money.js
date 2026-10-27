// 派閥と政治資金パーティー (R21) — the money of the factions (派閥, kind 'faction'; the 'group's of a party that has none do not hold parties). A faction holds a 政治資金パーティー once a year:
// every member has a ticket quota (ノルマ), and what a member sells beyond it is sent back to them (キックバック). Reported in the 収支報告書 it is legal; left out of it, it is a slush fund
// (裏金) for the member and a 不記載 for the faction. A faction may run the second scheme for years — until it is found out: the news, the searches, the boss and the members who took the money
// (each one a case in scandal.js, whatever the party), the faction's dissolution, and a more careful world afterwards. The player may be a member (an offer to answer: take it and report it, take it
// and hide it, refuse, or blow the whistle), the boss of a faction (the scheme and the quota are theirs to set), or neither (they only read the news and the rumours).
//
// Rules: nothing is refused for being bad — every answer shows its odds and its price first; every faction, boss and member is a fictional person (a real named figure, n.real, never has a
// scandal: politics.js refuses it), the sums are rough.
//
// State g.state.factionMoney (lazy, repaired on read): { v, f: { [factionId]: { scheme: 'clean'|'kick', quota (円), last (day of the last party), unreported (円), years, exposed (day) | null, cascade: [{ day, who, amount }],
//   reportedByMember, whistle, dissolved (day) | null } }, pending: null | { kind: 'offer', fid, amount, day }, mine: { took, hidden } , log: [{ day, text }], lastTick }
// API (on Game): g.factionMoney() → the summary; g.factionMoneyOptions() → the answers to the pending offer; g.factionMoneyRespond(choice) → { ok, text }; g.factionMoneySet({ scheme, quota }) (the boss);
//   g.factionMoneyDissolve() (the boss); g.factionMoneyForce(fid, 'party' | 'expose') (tests). The phone app 「派閥資金」 (id 'habatsu', order 66.8).

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { dateLabel } from './politics.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText, phoneText as T } from './phone.js';

const COLOR = '#8a6a2a';
const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const today = (g) => (g.state && g.state.day) || 1;
let rng = () => Math.random();
export const setFactionRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const roll = (p) => rng() < p;
const pol = (g) => (typeof g.pol === 'function' ? g.pol() : null);
const hash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

// ======================================================================== state
const factionsOf = (p) => { const out = []; for (const pt of Object.values(p.parties || {})) for (const f of pt.factions || []) if (f && f.kind === 'faction') out.push({ f, pt }); return out; };
const find = (p, fid) => factionsOf(p).find((x) => x.f.id === fid) || null;
function ensure(g) {
  const p = pol(g);
  if (!p || !g.state) return null;
  let M = g.state.factionMoney;
  if (!isObj(M)) M = g.state.factionMoney = { v: 1, f: {}, pending: null, mine: { took: 0, hidden: 0 }, log: [], lastTick: 0 };
  if (!isObj(M.f)) M.f = {};
  if (!Array.isArray(M.log)) M.log = [];
  if (!isObj(M.mine)) M.mine = { took: 0, hidden: 0 };
  M.mine.took = num(M.mine.took); M.mine.hidden = num(M.mine.hidden);
  const day = today(g);
  for (const { f, pt } of factionsOf(p)) {
    let S = M.f[f.id];
    if (!isObj(S)) {
      // the first time the faction is seen: whether it runs the scheme (about 4 in 10; the big old ones more often), when its party falls
      const big = num(f.size) >= 12 ? 0.1 : 0;
      const strict = num(p.flags && p.flags.moneyStrict) * 0.1;
      const kick = (hash(`${f.id}|k`) % 100) / 100 < clamp(0.38 + big - strict, 0.05, 0.7);
      S = M.f[f.id] = { scheme: kick ? 'kick' : 'clean', quota: 1500000 + (hash(f.id) % 4) * 500000, last: day - (hash(`${f.id}|d`) % YEAR), unreported: kick ? 4000000 * (1 + (hash(`${f.id}|y`) % 3)) : 0, years: kick ? 1 + (hash(`${f.id}|y`) % 3) : 0, exposed: null, cascade: [], reportedByMember: 0, whistle: 0, dissolved: null };
    }
    S.quota = clamp(num(S.quota, 1500000), 500000, 5000000);
    S.unreported = Math.max(0, num(S.unreported)); S.years = Math.max(0, num(S.years));
    if (!Array.isArray(S.cascade)) S.cascade = [];
    if (S.scheme !== 'kick' && S.scheme !== 'clean') S.scheme = 'clean';
    void pt;
  }
  if (!isObj(M.pending) || !M.pending.fid || !find(p, M.pending.fid)) M.pending = null;
  return M;
}
const say = (g, p, M, text, o = {}) => {
  const day = today(g);
  M.log.unshift({ day, text }); if (M.log.length > 30) M.log.length = 30;
  if (o.news !== false) { p.news.unshift({ day, text, kind: 'politics' }); if (p.news.length > 80) p.news.length = 80; }
  if (o.msg) { try { g.message({ from: 'ドット新聞 政治部', text, kind: 'news' }); } catch (e) { /* no phone */ } }
};
const myFaction = (g, p) => { const pt = p.parties[p.me.party]; const f = pt && (pt.factions || []).find((x) => x.id === p.me.faction && x.kind === 'faction'); return f ? { f, pt } : null; };
const isBoss = (g, p, f) => f && f.leader === 'player';
const members = (p, f) => Object.values(p.npcs).filter((n) => n.faction === f.id && !n.real && !n.dead && !n.exMp && (n.office === 'shugi' || n.office === 'sangi'));

// ======================================================================== the party of a faction (once a year)
function holdParty(g, p, M, F) {
  const { f, pt } = F, S = M.f[f.id], day = today(g);
  S.last = day;
  const size = Math.max(2, num(f.size));
  const pool = Math.round(size * S.quota * 0.4); // what is sent back to the members
  const meIn = myFaction(g, p) && p.me.faction === f.id && (p.me.office === 'shugi' || p.me.office === 'sangi');
  if (S.scheme === 'kick') { S.unreported += pool; S.years++; }
  else f.funds = num(f.funds) + Math.round(pool * 0.1);
  // a boss of the player's own: the surplus
  if (isBoss(g, p, f)) {
    if (S.scheme === 'kick') { try { g.addSecretFunds(Math.round(pool * 0.25), `${f.name}のパーティー`); } catch (e) { console.error(e); } M.mine.hidden += Math.round(pool * 0.25); say(g, p, M, `${f.name}のパーティーを開いた。ノルマの超過分は、収支報告書に載せないまま、会員に戻した。あなたの手元に ${fmtMoney(Math.round(pool * 0.25))}。`, { news: false });
    } else say(g, p, M, `${f.name}のパーティーを開いた。収入はすべて収支報告書に載せた。`, { news: false });
    return;
  }
  // a member of the player's: an offer (only when the scheme runs; a clean faction's money is reported by the faction)
  if (meIn && S.scheme === 'kick' && !M.pending) {
    const share = Math.round(pool / size);
    M.pending = { kind: 'offer', fid: f.id, amount: share, day };
    say(g, p, M, `${f.name}のパーティー。ノルマを超えた分として、${fmtMoney(share)}が戻される。派閥の事務方は「記載は不要」と言っている。（「派閥資金」で対応を）`, { news: false, msg: true });
  } else if (meIn && S.scheme === 'clean') {
    say(g, p, M, `${f.name}のパーティー。ノルマを超えた分は、収支報告書に載せたうえで、きちんと処理された。`, { news: false });
  }
  void pt;
}

// ======================================================================== exposure and what follows
export function exposureRate(g, p, M, F) {
  const { f } = F, S = M.f[f.id];
  if (!S || S.scheme !== 'kick' || S.exposed || S.dissolved || S.unreported <= 0) return 0;
  const pool = Math.max(1, Math.round(Math.max(2, num(f.size)) * S.quota * 0.4));
  const press = typeof g.pressFreedom === 'function' ? (() => { try { return num(g.pressFreedom().value, 60); } catch (e) { return 60; } })() : 60;
  let h = 0.0012 * (1 + Math.min(4, S.unreported / pool)) * (0.6 + press / 100) * (1 + 0.5 * num(p.flags && p.flags.moneyStrict));
  h *= 1 + 1.5 * clamp(num(S.reportedByMember), 0, 2) + 3 * clamp(num(S.whistle), 0, 1);
  return h;
}
function expose(g, p, M, F) {
  const { f, pt } = F, S = M.f[f.id], day = today(g);
  if (S.exposed) return;
  S.exposed = day;
  const years = Math.max(1, S.years);
  const total = S.unreported;
  const src = ['新聞の調査報道', '市民団体の告発', '元秘書の内部告発'][hash(`${f.id}|s`) % 3];
  say(g, p, M, `【政治資金】${pt.short || pt.name}の${f.name}が、政治資金パーティーの収入の一部を、${years}年にわたり収支報告書に載せていなかったと${src}で明らかになった。総額は約${fmtMoney(total)}。所属議員の約${Math.max(2, Math.round(Math.max(2, num(f.size)) * 0.45))}人に、同じ扱いがあったという。東京地検が関係先の捜索に入った。`, { msg: false });
  // the boss
  const boss = p.npcs[f.leader];
  if (f.leader === 'player') { const hid = Math.round(M.mine.hidden); if (hid > 0) { try { g.politicalScandal('slush_fund', { who: 'player', amount: Math.max(hid, 1000000), severity: 5 }); } catch (e) { console.error(e); } } }
  else if (boss && !boss.real) { try { g.politicalScandal('slush_fund', { who: boss.id, amount: total, severity: 5 }); } catch (e) { console.error(e); } }
  // the members: a few at once, the others over the next days (each a case in scandal.js)
  const mem = members(p, f).filter((n) => n.id !== f.leader);
  const k = Math.min(mem.length, Math.max(2, Math.round(Math.max(2, num(f.size)) * 0.45)));
  const share = Math.round(total / Math.max(2, num(f.size)));
  const picked = mem.slice().sort((a, b) => hash(a.id + f.id) - hash(b.id + f.id)).slice(0, k);
  picked.forEach((n, i) => S.cascade.push({ day: day + (i < 2 ? 0 : 1 + Math.floor(i * 1.5)), who: n.id, amount: share }));
  // the player: a member who hid the money is named
  const meIn = p.me.faction === f.id && (p.me.office === 'shugi' || p.me.office === 'sangi');
  if (meIn && f.leader !== 'player' && num(p.me.secret) > 0) {
    const amt = Math.round(p.me.secret);
    p.me.exposed = num(p.me.exposed) + amt; p.me.secret = 0;
    try { g.politicalScandal('slush_fund', { who: 'player', amount: amt, severity: 4 }); } catch (e) { console.error(e); }
    try { g.message({ from: 'ドット新聞 政治部', text: `【政治資金】${f.name}の不記載が発覚。あなたが受け取っていた ${fmtMoney(amt)} も報じられた。`, kind: 'news' }); } catch (e) { /* no phone */ }
  }
  p.cabinet.scandal = num(p.cabinet.scandal) - (boss && p.cabinet.pm === boss.id ? 4 : 1);
  // the other factions of the world take care afterwards
  for (const o of factionsOf(p)) if (o.f.id !== f.id) { const T2 = M.f[o.f.id]; if (T2 && T2.scheme === 'kick' && roll(0.5)) { T2.scheme = 'clean'; T2.unreported = Math.round(T2.unreported); } }
  // the faction dissolves (most do)
  if (roll(0.85) || f.leader === 'player') S.dissolveAt = day + 20 + Math.floor(rng() * 20);
}
function dissolve(g, p, M, F, why) {
  const { f, pt } = F, S = M.f[f.id], day = today(g);
  if (S.dissolved) return false;
  S.dissolved = day;
  f.kind = 'group'; f.name = String(f.name).replace(/派$/, 'グループ'); f.funds = 0; f.size = Math.round(num(f.size) * 0.6);
  say(g, p, M, `${pt.short || pt.name}の${F.f.name.replace(/グループ$/, '派')}は、${why}、解散を決めた。所属の議員は、政策グループとして活動を続ける。`);
  return true;
}

// ======================================================================== the morning
function tick(g) {
  const p = pol(g);
  const M = p && ensure(g);
  if (!M) return;
  const day = today(g);
  if (M.lastTick === day) return;
  M.lastTick = day;
  // the unanswered offer: refused for the player after 3 days
  if (M.pending && day - num(M.pending.day) >= 3) respond(g, 'refuse', true);
  for (const F of factionsOf(p)) {
    const S = M.f[F.f.id];
    if (!S || S.dissolved) continue;
    if (day - S.last >= YEAR) holdParty(g, p, M, F);
    // the cascade: the members named in the news, one after another
    while (S.cascade.length && S.cascade[0].day <= day) {
      const c = S.cascade.shift();
      const n = p.npcs[c.who];
      if (n && !n.real && !n.dead) { try { g.politicalScandal('slush_fund', { who: c.who, amount: c.amount, severity: 3 }); } catch (e) { console.error(e); } }
    }
    if (S.exposed && S.dissolveAt && day >= S.dissolveAt && !S.dissolved) { dissolve(g, p, M, F, '不記載の責任をとって'); S.dissolveAt = null; }
    else if (!S.exposed) { const h = exposureRate(g, p, M, F); if (h && roll(h)) expose(g, p, M, F); }
  }
  void dateLabel;
}
onMorning((g) => tick(g));

// ======================================================================== the player's answers
export function offerOptions(g) {
  const p = pol(g), M = p && ensure(g);
  if (!M || !M.pending) return [];
  const a = M.pending.amount;
  return [
    { id: 'report', name: '受け取って、収支報告書に載せる', desc: '戻された金を、ありのままに報告する。', odds: null, lines: ['法律の上では、まっとうなやり方', '派閥の記載と食い違い、派閥の不記載が見つかりやすくなる（危険 ×2.5）', '代償：派閥内の立場 −4'] },
    { id: 'hide', name: '受け取って、載せない（裏金）', desc: `${fmtMoney(a)}を、収支報告書に載せずに受け取る。`, odds: null, lines: [`手元の裏金 +${fmtMoney(a)}（使い道は自由）`, '派閥が露見すれば、あなたも名指しされる（不記載・政治資金規正法違反）', '代償：派閥内の立場 +2（「仲間」とみなされる）'] },
    { id: 'refuse', name: '受け取らない', desc: '「私は結構です」と断る。', odds: null, lines: ['危険はない', '代償：派閥内の立場 −5（領袖と事務方の不興）'] },
    { id: 'whistle', name: '内部告発する', desc: '検察と報道機関に、資料を持ちこむ。', odds: 65, lines: ['成功：派閥の不記載が明るみに出る（あなたは「告発者」）。評判 +10', '失敗：握りつぶされ、「裏切り者」として派閥を追われる', '代償：派閥内の立場 −20・派閥を出ることになる'] },
  ];
}
function respond(g, choice, auto = false) {
  const p = pol(g), M = p && ensure(g);
  if (!M || !M.pending) return { ok: false, why: '決めることはない' };
  const P = M.pending;
  const o = offerOptions(g).find((x) => x.id === choice);
  if (!o) return { ok: false, why: 'その選択肢はない' };
  const F = find(p, P.fid);
  M.pending = null;
  if (!F) return { ok: true, text: '派閥はすでにない。' };
  const S = M.f[F.f.id];
  const win = o.odds == null ? true : roll(o.odds / 100);
  const stand = (d) => { p.me.standing = clamp(num(p.me.standing) + d, 0, 100); };
  let text = '';
  if (choice === 'report') { S.reportedByMember = Math.min(2, num(S.reportedByMember) + 1); stand(-4); text = '戻された金を、ありのままに報告した。派閥の事務方は、苦い顔をした。'; }
  else if (choice === 'hide') { try { g.addSecretFunds(P.amount, `${F.f.name}のパーティー`); } catch (e) { console.error(e); } M.mine.took++; M.mine.hidden += P.amount; stand(2); text = `${fmtMoney(P.amount)}を受け取った。収支報告書には載せていない。`; }
  else if (choice === 'refuse') { stand(-5); text = auto ? '返事が遅れ、金は受け取らないことになった。' : '「私は結構です」と断った。領袖の顔が、少し曇った。'; }
  else if (choice === 'whistle') {
    if (win) { S.whistle = 1; p.me.reputation = clamp(num(p.me.reputation) + 10, -100, 100); text = '資料を持ちこんだ。派閥の不記載が、まもなく報じられる。'; if (!S.exposed && roll(0.8)) { S.exposed = null; expose(g, p, M, F); text = '資料を持ちこんだ。派閥の不記載が、ただちに報じられた。'; } }
    else { stand(-20); text = '告発は握りつぶされた。「裏切り者」と呼ばれ、派閥を追われた。'; }
    try { g.leaveFaction(); } catch (e) { console.error(e); }
  }
  say(g, p, M, text, { news: false });
  return { ok: true, text, win, auto };
}
function setScheme(g, { scheme, quota } = {}) {
  const p = pol(g), M = p && ensure(g);
  const mf = p && myFaction(g, p);
  if (!M || !mf || !isBoss(g, p, mf.f)) return { ok: false, why: '自分が領袖の派閥がない' };
  const S = M.f[mf.f.id];
  if (S.dissolved) return { ok: false, why: '派閥はすでに解散した' };
  if (scheme && scheme !== 'clean' && scheme !== 'kick') return { ok: false, why: '方針が正しくない' };
  if (scheme) S.scheme = scheme;
  if (quota != null) S.quota = clamp(Math.round(num(quota)), 500000, 5000000);
  const text = `${mf.f.name}の方針：${S.scheme === 'kick' ? 'ノルマ超過分を会員に戻し、収支報告書に載せない' : '収入はすべて収支報告書に載せる'}。ノルマ ${fmtMoney(S.quota)}。`;
  say(g, p, M, text, { news: false });
  return { ok: true, text };
}
function dissolveMine(g) {
  const p = pol(g), M = p && ensure(g);
  const mf = p && myFaction(g, p);
  if (!M || !mf || !isBoss(g, p, mf.f)) return { ok: false, why: '自分が領袖の派閥がない' };
  const ok = dissolve(g, p, M, mf, '領袖の判断で');
  if (ok) { p.me.reputation = clamp(num(p.me.reputation) + 3, -100, 100); p.me.standing = clamp(num(p.me.standing) - 5, 0, 100); }
  return ok ? { ok: true, text: '派閥の解散を決めた。' } : { ok: false, why: 'すでに解散している' };
}

// ======================================================================== the summary and the API
const rumorOf = (g, M, F) => { const S = M.f[F.f.id]; if (!S) return 0; const k = S.scheme === 'kick' ? 0.55 : 0.08; return (hash(`${F.f.id}|r|${Math.floor(today(g) / YEAR)}`) % 100) / 100 < k ? 1 : 0; };
function summary(g) {
  const p = pol(g), M = p && ensure(g);
  if (!p || !M) return null;
  const mf = myFaction(g, p);
  const rows = factionsOf(p).map((F) => {
    const S = M.f[F.f.id];
    const boss = p.npcs[F.f.leader];
    return { id: F.f.id, name: F.f.name, party: F.pt.id, partyName: F.pt.short || F.pt.name, boss: F.f.leader === 'player' ? g.state.name : boss ? boss.name : '（空席）', size: num(F.f.size), funds: num(F.f.funds), exposed: S.exposed ? dateLabel(g, S.exposed) : null, dissolved: !!S.dissolved, rumor: !S.exposed && !S.dissolved && rumorOf(g, M, F) === 1, mine: !!(mf && mf.f.id === F.f.id), mineBoss: F.f.leader === 'player', scheme: F.f.leader === 'player' ? S.scheme : null, quota: F.f.leader === 'player' ? S.quota : null };
  });
  // the factions that have dissolved are 'group's now: list them from the state
  const gone = Object.entries(M.f).filter(([id, S]) => S.dissolved && !rows.some((r) => r.id === id)).map(([id, S]) => ({ id, dissolved: true, date: dateLabel(g, S.dissolved) }));
  return { mine: mf ? rows.find((r) => r.id === mf.f.id) || null : null, factions: rows, gone, pending: M.pending ? { fid: M.pending.fid, amount: M.pending.amount, left: Math.max(0, 3 - (today(g) - M.pending.day)) } : null, took: M.mine.took, hidden: Math.round(M.mine.hidden), log: M.log.slice(0, 15).map((l) => ({ date: dateLabel(g, l.day), text: l.text })) };
}
const METHODS = {
  factionMoney() { return summary(this); },
  factionMoneyOptions() { return offerOptions(this); },
  factionMoneyRespond(choice) { return respond(this, choice); },
  factionMoneySet(o) { return setScheme(this, o || {}); },
  factionMoneyDissolve() { return dissolveMine(this); },
  factionMoneyForce(fid, what) { const p = pol(this), M = p && ensure(this); const F = p && find(p, fid); if (!F) return false; if (what === 'party') holdParty(this, p, M, F); else if (what === 'expose') expose(this, p, M, F); return true; },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__fmoney = { setFactionRng, tick: (g) => tick(g), exposureRate: (g, fid) => { const p = pol(g), M = ensure(g); return exposureRate(g, p, M, find(p, fid)); } };

// ======================================================================== the phone app 「派閥資金」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 8, y + 8, 16, 16, '#f4ecd8'); R(c, x + 11, y + 12, 10, 2, COLOR); R(c, x + 11, y + 16, 10, 2, COLOR); R(c, x + 11, y + 20, 6, 2, COLOR);
}
async function answer(g) {
  const opts = g.factionMoneyOptions();
  const i = await phoneList(g, { title: 'パーティー券の戻し', color: COLOR, items: opts.map((o) => ({ label: o.name, sub: o.odds != null ? `見込み${o.odds}%` : '確実' })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0 || !opts[i]) return;
  const o = opts[i];
  const ok = await phoneConfirm(g, { title: o.name.length > 12 ? '方針' : o.name, color: COLOR, text: `${o.desc}\n\n${bulletText(o.lines)}${o.odds != null ? `\n\n成功の見込み ${o.odds}%` : ''}`, choices: ['この方針で行く', 'やめる'] });
  if (ok !== 0) return;
  const r = g.factionMoneyRespond(o.id);
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: '派閥の資金', color: COLOR, text: r.ok ? r.text : r.why });
}
async function bossMenu(g, s) {
  const i = await phoneList(g, { title: `${s.mine.name}（領袖）`, color: COLOR, items: [
    { label: '方針：収入はすべて報告する', sub: s.mine.scheme === 'clean' ? 'いまの方針' : '' },
    { label: '方針：超過分を戻し、載せない（裏金）', sub: s.mine.scheme === 'kick' ? 'いまの方針' : '露見の危険がある・あなたにも手元の金' },
    { label: 'ノルマを上げる／下げる', sub: `いま ${fmtMoney(s.mine.quota)}` },
    { label: '派閥を解散する', sub: '立場 −5・評判 +3' },
  ], hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0) return;
  let r;
  if (i === 0 || i === 1) {
    const ok = await phoneConfirm(g, { title: i ? '裏金の方針' : '報告の方針', color: COLOR, text: i ? `ノルマを超えた分を会員に戻し、収支報告書に載せない。\n\n・毎年のパーティーで、あなたの手元に金が入る\n・会員にも金が回り、派閥はまとまる\n・毎日少しずつ露見する危険（年に3割ほど）。露見すれば、あなたが名指しされ、派閥は解散する` : `収入をすべて収支報告書に載せる。\n\n・露見の危険はない\n・手元に入る金はない（派閥の資金が少し増える）`, choices: ['この方針にする', 'やめる'] });
    if (ok !== 0) return;
    r = g.factionMoneySet({ scheme: i ? 'kick' : 'clean' });
  } else if (i === 2) {
    const j = await phoneList(g, { title: 'ノルマ（1人あたり）', color: COLOR, items: [100, 150, 200, 300, 400].map((m) => ({ label: `${m}万円` })), hint: 'A:えらぶ　B:もどる' });
    if (j < 0) return;
    r = g.factionMoneySet({ quota: [1000000, 1500000, 2000000, 3000000, 4000000][j] });
  } else {
    const ok = await phoneConfirm(g, { title: '派閥の解散', color: COLOR, text: '派閥を解散し、政策グループにする。\n\n・露見の危険はなくなる\n・領袖としての力を失う（立場 −5）\n・評判 +3', choices: ['解散する', 'やめる'] });
    if (ok !== 0) return;
    r = g.factionMoneyDissolve();
  }
  g.sfx(r.ok ? 'ok' : 'buzz');
  await phoneInfo(g, { title: '領袖の判断', color: COLOR, text: r.ok ? r.text : r.why });
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const s = g.factionMoney();
    if (!s) { await phoneInfo(g, { title: '派閥資金', color: COLOR, text: 'いまは使えない。' }); return; }
    const rows = [];
    if (s.pending) rows.push({ label: '★ パーティー券の戻しへの対応', sub: `${fmtMoney(s.pending.amount)}・あと${s.pending.left}日`, run: () => answer(g) });
    if (s.mine && s.mine.mineBoss) rows.push({ label: `${s.mine.name}（領袖）の運営`, sub: `${s.mine.scheme === 'kick' ? '載せない方針' : '報告する方針'}・ノルマ${fmtMoney(s.mine.quota)}`, run: () => bossMenu(g, s) });
    for (const r of s.factions) rows.push({ label: `${r.partyName} ${r.name}`, sub: `${r.exposed ? `露見（${r.exposed}）` : r.rumor ? '資金の流れに噂' : '目立った噂はない'}・${r.size}人・領袖${r.boss}${r.mine ? '・所属' : ''}`, run: async () => { await phoneInfo(g, { title: r.name, color: COLOR, text: `${r.partyName}の派閥（領袖 ${r.boss}、${r.size}人、資金 ${fmtMoney(r.funds)}）\n\n${r.exposed ? `政治資金パーティーの不記載が露見した（${r.exposed}）。` : r.rumor ? '「パーティーの収入の扱いが不透明だ」という噂が、永田町に流れている。' : '目立った噂はない。'}${r.mineBoss ? `\n\nあなたの方針：${r.scheme === 'kick' ? '超過分を戻し、載せない' : 'すべて報告する'}` : ''}` }); } });
    if (!s.factions.length) rows.push({ label: 'いま、派閥はない', sub: '政党の派閥は、政策グループになっている', run: async () => {} });
    rows.push({ label: '記録', sub: `${s.log.length}件`, run: async () => { await phoneInfo(g, { title: '記録', color: COLOR, text: s.log.length ? s.log.map((l) => `■${l.date}\n${l.text}`).join('\n\n') : 'まだ記録はない。' }); } });
    const i = await phoneList(g, { title: '派閥資金', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('habatsu', {
  name: '派閥資金', color: COLOR, order: 66.8,
  iconHD: icon,
  cond: (g) => { try { const p = pol(g); return !!g && !!g.state && !!p && !!(p.me && p.me.office && p.me.party && (myFaction(g, p) || factionsOf(p).length > 0)); } catch (e) { return false; } },
  open: (g) => openApp(g),
});
export { openApp as openFactionMoneyApp, tick as factionMoneyTick };
