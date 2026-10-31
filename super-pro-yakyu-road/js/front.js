// スーパープロ野球ロード — 球団運営 (the front office). Everything a club does off the field, on top of the pennant:
//   money (funds in 万円, salaries paid day by day, the gate at home games, fans), sponsors (contracts with conditions),
//   trades (player for player, buying / selling for cash, free transfers, a player's own trade demand 直訴),
//   the farm (一軍 = the roster, 二軍 / 三軍 grow toward their potential), 紅白戦, waivers, conduct 素行 and body 身体
//   (incidents, injuries, suspensions), league drug tests, the players' union 選手会 (demands, strikes), the ball the
//   league uses, the manager (休養 = rest with an acting manager, 兼任監督 = a player-manager), the dark side (stimulants,
//   banned drugs, steroids, corked bats, pine tar, sticky stuff: stronger, with the risk of being caught), and the
//   off-season (salary talks 年俸更改 with arbitration 調停, free agency FA with protect lists and compensation,
//   tryouts, the next season: age, growth, retirement, the draft).
// State lives in L.front and in fields on the players (sal, years, conduct, body, pot, inj, susp). Pure logic (no DOM).
import { makeRng, clamp, gauss, pick } from './core.js';
import { TEAMS, teamOf, makeBatter, makePitcher, overall, pname, pfull, nextSeq, resetSeq } from './data.js';
import { autoOrder, makeSchedule, DAY_HOOKS, standings } from './league.js';
import { newGame, simPA, applyPA, maybeChange, fieldingSide, seasonStats } from './game.js';

const R = () => Math.random();
export const yen = (man) => { const v = Math.round(man); const oku = Math.floor(Math.abs(v) / 10000), m = Math.abs(v) % 10000; return `${v < 0 ? '−' : ''}${oku ? `${oku}億` : ''}${m || !oku ? `${m}万` : ''}円`; };

// ---------------------------------------------------------------- setup
const SPONSOR_NAMES = ['みなと飲料', 'ひかり自動車', 'さくら銀行', 'つばさ航空', 'こがね食品', 'あおば通信', 'ほしぞら電機', 'やまびこ製薬', 'はやて運輸', 'しおかぜ不動産', 'いなほ酒造', 'あかね保険'];
const MANAGER_NAMES = ['村瀬 剛', '大河内 進', '桐生 達也', '岸本 浩二', '早乙女 誠', '久我 修', '一ノ瀬 隆', '鷹野 健吾'];
export function salaryOf(p) {
  const ov = overall(p);
  return Math.max(440, Math.round((Math.max(0, ov - 32) ** 2) * 5.2 + (p.age > 30 ? (p.age - 30) * 200 : 0)) / 10 * 10);
}
function initPlayer(p) {
  if (p.sal == null) p.sal = salaryOf(p);
  if (p.years == null) p.years = Math.max(0, p.age - 22 - Math.floor(R() * 3));
  if (p.conduct == null) p.conduct = clamp(Math.round(62 + gauss() * 16), 5, 99);
  if (p.body == null) p.body = clamp(Math.round(66 + gauss() * 13 - Math.max(0, p.age - 31) * 2), 5, 99);
  if (p.pot == null) p.pot = clamp(Math.round(overall(p) + Math.max(0, 27 - p.age) * 2.2 + gauss() * 5), 20, 95);
  if (p.inj == null) p.inj = 0;
  if (p.susp == null) p.susp = 0;
}
function farmPlayer(rng, pitcher, tier, age) {
  const p = pitcher ? makePitcher(rng, rng() < 0.5 ? 'sp' : 'rp', tier - 9) : makeBatter(rng, pick(['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'], rng), tier - 9, 'bench');
  p.age = age; p.num = 0;
  return p;
}
export function ensureFront(L) {
  if (L.front) return L.front;
  const rng = makeRng((L.seed || 1) + 77);
  L.front = {
    money: 400000, fans: 50, morale: 50, union: 62, ball: 'std',
    sponsors: [], offers: [], news: [], pending: [], waivers: [], pool: [],
    mgr: { name: pick(MANAGER_NAMES, rng), skill: 58 + Math.round(rng() * 14), mode: 'normal', restDays: 0, interim: null, playerId: null },
    cheats: { stim: false, drug: false, steroid: false, cork: false, pine: false, sticky: false },
    caught: [], lastRW: -99, season: 1, off: null,
  };
  resetSeq(Math.max(nextSeq(), L.seq || 1));
  for (const t of Object.values(L.teams)) {
    t.farm2 = []; t.farm3 = [];
    for (let i = 0; i < 12; i++) { const p = farmPlayer(rng, i % 2 === 0, t.tier, 20 + Math.floor(rng() * 9)); L.P[p.id] = p; seasonStats(p); t.farm2.push(p.id); }
    for (let i = 0; i < 6; i++) { const p = farmPlayer(rng, i % 2 === 0, t.tier - 3, 18 + Math.floor(rng() * 4)); L.P[p.id] = p; seasonStats(p); t.farm3.push(p.id); }
    const used = new Set(t.roster.map((id) => L.P[id].num));
    for (const id of [...t.farm2, ...t.farm3]) { let n = 0; do { n = L.P[id].pitcher ? 11 + Math.floor(rng() * 89) : Math.floor(rng() * 99); } while (used.has(n)); used.add(n); L.P[id].num = n; }
  }
  L.seq = nextSeq();
  for (const p of Object.values(L.P)) initPlayer(p);
  makeOffers(L);
  news(L, `${L.year}年シーズン、球団運営を開始。監督は${L.front.mgr.name}`, 'info');
  updateMods(L);
  return L.front;
}
export const news = (L, text, kind = 'info') => { const F = L.front; F.news.unshift({ day: L.day, year: L.year, text, kind }); if (F.news.length > 80) F.news.length = 80; };
const myT = (L) => L.teams[L.myTeam];
export const allOf = (T) => [...T.roster, ...(T.farm2 || []), ...(T.farm3 || [])];
export const tierOf = (L, pid) => { for (const T of Object.values(L.teams)) { if (T.roster.includes(pid)) return [T.id, 1]; if ((T.farm2 || []).includes(pid)) return [T.id, 2]; if ((T.farm3 || []).includes(pid)) return [T.id, 3]; } return [null, 0]; };
export const payroll = (L, id = L.myTeam) => allOf(L.teams[id]).reduce((a, pid) => a + (L.P[pid].sal || 0), 0);
const removeFrom = (T, pid) => { for (const k of ['roster', 'farm2', 'farm3']) { const i = (T[k] || []).indexOf(pid); if (i >= 0) T[k].splice(i, 1); } T.lineup = T.lineup.filter((x) => x !== pid); };
// move a player to another club (into the same tier when it fits, else 二軍), keeping both rosters playable
export function movePlayer(L, pid, toId, tier = 0) {
  const [fromId, fromTier] = tierOf(L, pid);
  if (fromId) removeFrom(L.teams[fromId], pid);
  const T = L.teams[toId];
  const t = tier || (fromTier === 1 && T.roster.length < 28 ? 1 : 2);
  (t === 1 ? T.roster : t === 3 ? T.farm3 : T.farm2).push(pid);
  const used = new Set(allOf(T).filter((x) => x !== pid).map((x) => L.P[x].num));
  if (used.has(L.P[pid].num)) { let n = L.P[pid].num; while (used.has(n)) n = (n + 7) % 100; L.P[pid].num = n; }
  if (fromId) refill(L, fromId);
  refill(L, toId);
}
// a club keeps 28 on the roster (14 pitchers, 14 batters as near as it can) by calling up / sending down the best
export function refill(L, id) {
  const T = L.teams[id];
  const need = (pit) => T.roster.filter((x) => L.P[x].pitcher === pit).length;
  for (const pit of [true, false]) {
    while (need(pit) < 13 && T.roster.length < 30) {
      const c = [...T.farm2, ...T.farm3].filter((x) => L.P[x].pitcher === pit && !(L.P[x].inj > 0)).sort((a, b) => overall(L.P[b]) - overall(L.P[a]))[0];
      if (!c) break;
      removeFrom(T, c); T.roster.push(c);
    }
  }
  while (T.roster.length > 30) { const w = T.roster.slice().sort((a, b) => overall(L.P[a]) - overall(L.P[b]))[0]; removeFrom(T, w); T.farm2.push(w); }
  autoOrder(L, id);
}

// ---------------------------------------------------------------- the mood of the club → its form in games
export function updateMods(L) {
  const F = L.front;
  for (const T of Object.values(L.teams)) T.mod = { bat: 0, pit: 0 };
  const m = F.mgr;
  const skill = m.mode === 'rest' && m.interim ? m.interim.skill : m.skill;
  const k = (skill - 62) / 90 + (F.morale - 50) / 160 + (m.mode === 'player' ? 0.04 : 0);
  myT(L).mod = { bat: clamp(k, -0.6, 0.6), pit: clamp(k * 0.8, -0.6, 0.6) };
}

// ---------------------------------------------------------------- sponsors
export function makeOffers(L) {
  const F = L.front;
  const taken = new Set(F.sponsors.map((s) => s.name));
  const names = SPONSOR_NAMES.filter((n) => !taken.has(n));
  F.offers = [];
  for (let i = 0; i < 3 && names.length; i++) {
    const name = names.splice(Math.floor(R() * names.length), 1)[0];
    const base = Math.round((6000 + R() * 14000) * (0.6 + F.fans / 100) / 100) * 100;
    const conds = [{ t: 'none', label: '条件なし' }, { t: 'rank', v: 3, label: 'リーグ3位以内' }, { t: 'rank', v: 1, label: 'リーグ優勝' }, { t: 'pct', v: 0.5, label: '勝率5割以上' }];
    const c = conds[Math.floor(R() * conds.length)];
    const mult = c.t === 'none' ? 1 : c.t === 'rank' && c.v === 1 ? 2.6 : 1.6;
    F.offers.push({ name, base, bonus: Math.round(base * (mult - 1) / 100) * 100, cond: c });
  }
}
export function signSponsor(L, i) {
  const F = L.front, o = F.offers[i];
  if (!o || F.sponsors.length >= 3) return false;
  F.sponsors.push({ ...o, year: L.year });
  F.offers.splice(i, 1);
  F.money += o.base;
  news(L, `スポンサー「${o.name}」と契約（${yen(o.base)}${o.bonus ? `、${o.cond.label}で+${yen(o.bonus)}` : ''}）`, 'money');
  return true;
}
function scandalHitsSponsors(L, k = 0.35) {
  const F = L.front;
  F.sponsors = F.sponsors.filter((s) => { if (R() < k) { news(L, `スポンサー「${s.name}」が契約を打ち切りました`, 'bad'); return false; } return true; });
}

// ---------------------------------------------------------------- the dark side (cheats) — the deltas on the abilities
export const CHEATS = {
  stim: { name: '興奮剤', desc: '打者の集中力と走力、投手の球速が上がる。検査で見つかりやすい', risk: 0.55, test: true },
  drug: { name: '禁止薬物', desc: '打者のミートとパワー、投手のコントロールが上がる', risk: 0.65, test: true },
  steroid: { name: 'ステロイド', desc: 'パワーと球速が大きく上がる。体がむしばまれ、検査でもっとも見つかりやすい', risk: 0.8, test: true },
  cork: { name: 'コルクバット', desc: '打球が飛ぶ（パワー+）。バットが割れると一発で発覚', risk: 0.018 },
  pine: { name: '松ヤニ', desc: '投手のコントロールが上がる。審判のチェックで見つかることがある', risk: 0.02 },
  sticky: { name: '粘着物質', desc: '投手の球速とキレが上がる。審判のチェックで見つかることがある', risk: 0.03 },
};
const CHEAT_ADD = {
  stim: (p) => (p.pitcher ? { velo: 2 } : { meet: 3, speed: 4 }),
  drug: (p) => (p.pitcher ? { control: 4 } : { meet: 3, power: 4 }),
  steroid: (p) => (p.pitcher ? { velo: 4, stamina: 4 } : { power: 9 }),
  cork: (p) => (p.pitcher ? {} : { power: 6, meet: -1 }),
  pine: (p) => (p.pitcher ? { control: 5 } : {}),
  sticky: (p) => (p.pitcher ? { velo: 3, control: 3 } : {}),
};
// the boosts the player has now (cheats, and the workload of a player-manager): undo the old, apply the new
export function applyBoosts(L) {
  const F = L.front, T = myT(L);
  const mine = new Set(allOf(T));
  for (const p of Object.values(L.P)) {
    if (p.boost) { for (const [k, v] of Object.entries(p.boost)) p[k] -= v; p.boost = null; }
    if (!mine.has(p.id)) continue;
    const add = {};
    for (const [k, on] of Object.entries(F.cheats)) if (on) for (const [a, v] of Object.entries(CHEAT_ADD[k](p))) add[a] = (add[a] || 0) + v;
    if (F.mgr.mode === 'player' && F.mgr.playerId === p.id) for (const a of p.pitcher ? ['control', 'stamina'] : ['meet', 'power']) add[a] = (add[a] || 0) - 5;
    for (const [k, v] of Object.entries(add)) p[k] += v;
    if (Object.keys(add).length) p.boost = add;
  }
  for (const id of Object.keys(L.teams)) autoOrder(L, id);
}
export function setCheat(L, k, on) { L.front.cheats[k] = !!on; applyBoosts(L); if (on) news(L, `【極秘】${CHEATS[k].name}の使用を指示しました`, 'dark'); }

// ---------------------------------------------------------------- the manager
export function restManager(L) {
  const m = L.front.mgr;
  if (m.mode !== 'normal') return false;
  m.mode = 'rest'; m.restDays = 10; m.interim = { name: `${pick(['上田', '黒木', '森', '石井', '山根'])}ヘッドコーチ`, skill: 46 + Math.round(R() * 16) };
  L.front.morale = clamp(L.front.morale + 14, 0, 100);
  news(L, `${m.name}監督が休養。${m.interim.name}が監督代行に`, 'info');
  updateMods(L); return true;
}
export function returnManager(L, fire = false) {
  const m = L.front.mgr;
  if (m.mode !== 'rest') return false;
  if (fire) { news(L, `${m.name}監督を解任。${m.interim.name}が新監督に`, 'info'); m.name = m.interim.name.replace('ヘッドコーチ', ''); m.skill = m.interim.skill + 4; }
  else { news(L, `${m.name}監督が復帰`, 'info'); L.front.morale = clamp(L.front.morale - 4, 0, 100); }
  m.mode = 'normal'; m.interim = null; m.restDays = 0;
  updateMods(L); return true;
}
export const pmCandidates = (L) => myT(L).roster.map((id) => L.P[id]).filter((p) => p.age >= 32 && overall(p) >= 50);
export function makePlayerManager(L, pid) {
  const m = L.front.mgr, p = L.P[pid];
  if (!p || m.mode === 'player') return false;
  if (m.mode === 'rest') returnManager(L, false);
  m.prev = { name: m.name, skill: m.skill };
  m.mode = 'player'; m.playerId = pid; m.name = `${pfull(p)}（兼任）`; m.skill = clamp(Math.round(44 + (overall(p) - 50) * 0.7 + (p.age - 32) * 1.5 + (p.conduct - 60) * 0.15), 40, 82);
  L.front.morale = clamp(L.front.morale + 10, 0, 100);
  news(L, `${pfull(p)}が選手兼任監督に就任`, 'info');
  applyBoosts(L); updateMods(L); return true;
}
export function endPlayerManager(L) {
  const m = L.front.mgr;
  if (m.mode !== 'player') return false;
  news(L, `${m.name}の兼任監督を解き、${m.prev ? m.prev.name : '前監督'}が復帰`, 'info');
  m.mode = 'normal'; m.playerId = null; if (m.prev) { m.name = m.prev.name; m.skill = m.prev.skill; }
  applyBoosts(L); updateMods(L); return true;
}

// ---------------------------------------------------------------- trades
export function valueOf(p) {
  const ov = overall(p);
  const ageK = p.age <= 24 ? 1.25 : p.age <= 29 ? 1.1 : p.age <= 32 ? 0.85 : p.age <= 35 ? 0.55 : 0.3;
  return Math.round(Math.pow(Math.max(ov, 20) / 50, 3.2) * 9000 * ageK * (1 + Math.max(0, (p.pot || ov) - ov) / 80));
}
export const askPrice = (p) => Math.round(valueOf(p) * 1.3 / 100) * 100;
export const bidPrice = (p) => Math.round(valueOf(p) * 0.75 / 100) * 100;
// player for player: the computer accepts when it gets at least as much as it gives (and a little more)
export function tradeSwap(L, mine, theirs) {
  const pm = L.P[mine], pt = L.P[theirs], [tid] = tierOf(L, theirs);
  const ok = valueOf(pm) >= valueOf(pt) * 1.08 && pm.pitcher === pt.pitcher || valueOf(pm) >= valueOf(pt) * 1.3;
  if (!ok) return { ok: false, text: `${teamOf(tid).short}「${pname(pm)}では釣り合いません」` };
  movePlayer(L, mine, tid); movePlayer(L, theirs, L.myTeam);
  news(L, `トレード成立：${pfull(pm)} ⇔ ${pfull(pt)}（${teamOf(tid).short}）`, 'trade'); applyBoosts(L);
  return { ok: true, text: 'トレード成立！' };
}
export function tradeBuy(L, theirs) {
  const p = L.P[theirs], [tid] = tierOf(L, theirs), price = askPrice(p);
  if (L.front.money < price) return { ok: false, text: `資金が足りません（${yen(price)}）` };
  if (overall(p) >= 72 && R() < 0.5) return { ok: false, text: `${teamOf(tid).short}「${pname(p)}は手放せない」` };
  L.front.money -= price; movePlayer(L, theirs, L.myTeam);
  news(L, `金銭トレード：${pfull(p)}を${teamOf(tid).short}から獲得（${yen(price)}）`, 'trade'); applyBoosts(L);
  return { ok: true, text: `${pfull(p)}を獲得！` };
}
export function tradeSell(L, mine) {
  const p = L.P[mine], price = bidPrice(p);
  const cpu = Object.keys(L.teams).filter((id) => id !== L.myTeam);
  const tid = pick(cpu);
  if (overall(p) < 40) return { ok: false, text: 'どの球団も興味を示しません' };
  L.front.money += price; movePlayer(L, mine, tid);
  news(L, `金銭トレード：${pfull(p)}を${teamOf(tid).short}へ放出（${yen(price)}）`, 'trade'); applyBoosts(L);
  return { ok: true, text: `${teamOf(tid).short}へ放出（+${yen(price)}）` };
}
export function tradeFreeOut(L, mine) {
  const p = L.P[mine], cpu = Object.keys(L.teams).filter((id) => id !== L.myTeam);
  const tid = cpu.sort((a, b) => weakest(L, a, p.pitcher) - weakest(L, b, p.pitcher))[0];
  if (overall(p) < weakest(L, tid, p.pitcher) - 8) return { ok: false, text: 'もらってくれる球団がありません（ウェイバーへ）' };
  movePlayer(L, mine, tid); news(L, `無償トレード：${pfull(p)}を${teamOf(tid).short}へ`, 'trade'); applyBoosts(L);
  return { ok: true, text: `${teamOf(tid).short}へ無償で移籍` };
}
export function tradeFreeIn(L, theirs) {
  const p = L.P[theirs], [tid] = tierOf(L, theirs);
  if (valueOf(p) > 2500) return { ok: false, text: `${teamOf(tid).short}「タダでは出せません」` };
  movePlayer(L, theirs, L.myTeam); news(L, `無償トレード：${pfull(p)}を${teamOf(tid).short}から`, 'trade'); applyBoosts(L);
  return { ok: true, text: `${pfull(p)}を無償で獲得` };
}
const weakest = (L, id, pitcher) => Math.min(...L.teams[id].roster.map((x) => L.P[x]).filter((p) => p.pitcher === pitcher).map(overall));

// ---------------------------------------------------------------- the farm
export function swapTier(L, upId, downId) {
  const T = myT(L), [, tu] = tierOf(L, upId), [, td] = tierOf(L, downId);
  if (!tu || !td || tu === td) return false;
  const listOf = (t) => (t === 1 ? T.roster : t === 2 ? T.farm2 : T.farm3);
  const a = listOf(tu), b = listOf(td);
  a[a.indexOf(upId)] = downId; b[b.indexOf(downId)] = upId;
  autoOrder(L, L.myTeam);
  return true;
}
export function moveFarm(L, pid) { // 二軍 ⇄ 三軍
  const T = myT(L);
  let i = T.farm2.indexOf(pid);
  if (i >= 0) { T.farm2.splice(i, 1); T.farm3.push(pid); return 3; }
  i = T.farm3.indexOf(pid);
  if (i >= 0) { T.farm3.splice(i, 1); T.farm2.push(pid); return 2; }
  return 0;
}
// growth: 二軍 plays games (steady), 三軍 trains (faster for the young, nothing for the old); 一軍 regulars hold
function grow(p, k) {
  const ov = overall(p);
  if (ov >= p.pot || R() > k) return;
  const keys = p.pitcher ? ['control', 'stamina', 'velo', 'pitch'] : ['meet', 'power', 'speed', 'field', 'arm', 'catch'];
  const a = pick(keys);
  if (a === 'pitch') { const x = pick(p.pitches); if (x && x.lv < 7 && R() < 0.3) x.lv++; }
  else if (a === 'velo') p.velo = Math.min(160, p.velo + 1);
  else p[a] = Math.min(99, p[a] + 1);
}

// ---------------------------------------------------------------- 紅白戦 (the red team: the regulars; the white: the farm's best)
export function redWhite(L) {
  const T = myT(L);
  const F = L.front;
  const make = (id, ids) => {
    const ps = ids.map((x) => L.P[x]);
    const bats = ps.filter((p) => !p.pitcher).sort((a, b) => overall(b) - overall(a)).slice(0, 9);
    const pits = ps.filter((p) => p.pitcher).sort((a, b) => overall(b) - overall(a));
    L.teams[id] = { id, roster: [...bats, ...pits].map((p) => p.id), lineup: bats.map((p) => p.id), pos: {}, rotation: pits.slice(0, 1).map((p) => p.id), pen: pits.slice(1, 6).map((p) => p.id), closer: null, rot: 0 };
  };
  make('__red', T.roster); make('__white', [...T.farm2, ...T.farm3]);
  const GS = newGame(L, '__red', '__white');
  GS.used.home = [GS.pit.home]; GS.used.away = [GS.pit.away];
  let guard = 0;
  const saveP = L.teams.__red && GS;
  void saveP;
  while (!GS.over && guard++ < 300) { maybeChange(GS, L, fieldingSide(GS)); applyPA(GS, L, simPA(GS, L)); }
  delete L.teams.__red; delete L.teams.__white;
  // the stars of the day: the white team's best grow, everyone gets a little sharper
  const box = Object.entries(GS.box).map(([id, b]) => ({ id, b })).sort((a, b) => (b.b.h * 2 + b.b.hr * 3 + b.b.rbi) - (a.b.h * 2 + a.b.hr * 3 + a.b.rbi));
  const mvp = box[0] ? L.P[box[0].id] : null;
  const grew = [];
  for (const { id, b } of box.slice(0, 4)) { const p = L.P[id]; if (b.h >= 1) { grow(p, 1); grew.push(p); } }
  F.morale = clamp(F.morale + 2, 0, 100); F.lastRW = L.day;
  updateMods(L);
  news(L, `紅白戦：紅組 ${GS.score.home} − ${GS.score.away} 白組${mvp ? `（MVP ${pfull(mvp)}）` : ''}`, 'info');
  return { GS, mvp, grew };
}

// ---------------------------------------------------------------- waivers and the free-agent pool
export function waive(L, pid) {
  const T = myT(L);
  if (T.roster.length <= 25 && T.roster.includes(pid)) return false;
  const p = L.P[pid];
  removeFrom(T, pid); refill(L, L.myTeam);
  L.front.waivers.push({ pid, from: L.myTeam, days: 5 });
  L.front.union = clamp(L.front.union - 2, 0, 100);
  news(L, `${pfull(p)}をウェイバー公示`, 'info');
  return true;
}
export function claim(L, w) {
  const F = L.front, i = F.waivers.indexOf(w);
  if (i < 0) return false;
  F.waivers.splice(i, 1);
  const T = myT(L); T.farm2.push(w.pid); refill(L, L.myTeam);
  news(L, `ウェイバーで${pfull(L.P[w.pid])}（${teamOf(w.from).short}）を獲得`, 'trade');
  applyBoosts(L); return true;
}
function waiverDay(L) {
  const F = L.front;
  for (const w of F.waivers.slice()) {
    w.days--;
    const p = L.P[w.pid];
    if (w.from === L.myTeam) { // the computer clubs may claim the player you put up
      const cpu = Object.keys(L.teams).filter((id) => id !== L.myTeam).find((id) => overall(p) > weakest(L, id, p.pitcher) + 2 && R() < 0.3);
      if (cpu) { F.waivers.splice(F.waivers.indexOf(w), 1); L.teams[cpu].farm2.push(w.pid); refill(L, cpu); news(L, `${pfull(p)}は${teamOf(cpu).short}が獲得`, 'trade'); continue; }
    }
    if (w.days <= 0) { F.waivers.splice(F.waivers.indexOf(w), 1); F.pool.push(w.pid); news(L, `${pfull(p)}は自由契約に`, 'info'); }
  }
  // now and then a computer club puts a veteran from its farm on waivers
  if (R() < 0.06) {
    const cpu = pick(Object.keys(L.teams).filter((id) => id !== L.myTeam)), T = L.teams[cpu];
    const c = T.farm2.map((x) => L.P[x]).filter((p) => p.age >= 28).sort((a, b) => overall(b) - overall(a))[0];
    if (c) { removeFrom(T, c.id); F.waivers.push({ pid: c.id, from: cpu, days: 5 }); news(L, `${teamOf(cpu).short}が${pfull(c)}をウェイバー公示`, 'info'); }
  }
}

// ---------------------------------------------------------------- the day (before the games: strikes; after: everything else)
function dayBefore(L) {
  if (!L.front) return;
  const F = L.front;
  F.strikeToday = F.strike > 0;
  if (F.strike > 0) { F.strike--; news(L, '選手会のストライキ：本日の全試合が中止', 'bad'); }
}
function dayAfter(L, results) {
  if (!L.front) return;
  const F = L.front, T = myT(L);
  // money: salaries by the day, the gate at home
  const days = Math.max(1, L.games);
  F.money -= payroll(L) / days;
  const mine = (results || []).find((g) => g.mine);
  if (mine && mine.h === L.myTeam) F.money += Math.round(250000 * (0.45 + F.fans / 160) / days * 2);
  // fans and morale follow the results
  if (mine) {
    const my = mine.h === L.myTeam ? mine.hs : mine.as, op = mine.h === L.myTeam ? mine.as : mine.hs;
    if (my > op) { F.fans = clamp(F.fans + 0.25, 0, 100); F.morale = clamp(F.morale + 1.2, 0, 100); }
    else if (my < op) { F.fans = clamp(F.fans - 0.18, 0, 100); F.morale = clamp(F.morale - 1, 0, 100); }
  }
  F.morale += (50 - F.morale) * 0.02;
  // injuries and suspensions heal / run out; new injuries by body, age and steroids
  let changed = false;
  for (const id of Object.keys(L.teams)) {
    const tm = L.teams[id];
    for (const pid of allOf(tm)) {
      const p = L.P[pid];
      if (p.inj > 0) { p.inj--; if (!p.inj) changed = true; }
      if (p.susp > 0) { p.susp--; if (!p.susp) changed = true; }
      if (id === L.myTeam && F.cheats.steroid) p.body = Math.max(5, p.body - 0.15);
      const risk = 0.0016 * (1 + (60 - p.body) / 40) * (p.age > 32 ? 1.4 : 1) * (tm.roster.includes(pid) ? 1 : 0.5);
      if (!p.inj && R() < risk) {
        p.inj = Math.round(4 + R() * (p.body < 40 ? 50 : 22)); changed = true;
        if (id === L.myTeam) news(L, `${pfull(p)}が故障（全治${p.inj}日）`, 'bad');
      }
    }
  }
  // conduct: incidents (and good deeds)
  for (const pid of allOf(T)) {
    const p = L.P[pid];
    if (R() < 0.0009 * (1 + (55 - p.conduct) / 25)) {
      const ev = pick([['遅刻で罰金', 0, 50], ['SNSで炎上、謹慎', 5, 0], ['深夜の飲酒トラブルで出場停止', 10, 100], ['審判への暴言で出場停止', 3, 30], ['ファンとのトラブル', 0, 20]]);
      p.susp += ev[1]; F.money += ev[2]; F.fans = clamp(F.fans - (ev[1] ? 1.5 : 0.6), 0, 100); changed = changed || ev[1] > 0;
      news(L, `${pfull(p)}：${ev[0]}${ev[1] ? `（${ev[1]}日）` : ''}`, 'bad');
    } else if (p.conduct > 80 && R() < 0.0006) { F.fans = clamp(F.fans + 0.6, 0, 100); news(L, `${pfull(p)}が病院を慰問、ファンの評判が上がる`, 'good'); }
  }
  // the dark side: the league's drug tests, the umpires' checks, a broken bat
  darkDay(L);
  // the manager's rest runs out
  if (F.mgr.mode === 'rest' && --F.mgr.restDays <= 0 && !F.pending.some((x) => x.type === 'mgr')) F.pending.push({ type: 'mgr' });
  // a player's own trade demand (直訴)
  if (R() < 0.012) {
    const c = T.roster.filter((x) => !T.lineup.includes(x) && !T.rotation.includes(x)).map((x) => L.P[x]).concat(T.farm2.map((x) => L.P[x]).filter((p) => p.age >= 26)).filter((p) => overall(p) >= 52);
    if (c.length) { const p = pick(c); if (!F.pending.some((x) => x.pid === p.id)) F.pending.push({ type: 'demand', pid: p.id }); }
  }
  // the union
  if (F.union < 35 && R() < 0.05 && !F.pending.some((x) => x.type === 'union')) F.pending.push({ type: 'union', cost: Math.round((8000 + R() * 12000) / 100) * 100 });
  F.union += (60 - F.union) * 0.004;
  // the farm grows
  for (const id of Object.keys(L.teams)) { const tm = L.teams[id]; for (const pid of tm.farm2) grow(L.P[pid], 0.05); for (const pid of tm.farm3) grow(L.P[pid], L.P[pid].age <= 23 ? 0.08 : 0.02); }
  waiverDay(L);
  if (changed) for (const id of Object.keys(L.teams)) autoOrder(L, id);
  updateMods(L);
  // the end of the season: sponsor bonuses
  if (L.over && !F.paidBonus) {
    F.paidBonus = true;
    const lg = teamOf(L.myTeam).league, rank = standings(L, lg).findIndex((r) => r.id === L.myTeam) + 1, Tm = myT(L), pct = Tm.w + Tm.l ? Tm.w / (Tm.w + Tm.l) : 0;
    for (const s of F.sponsors) {
      const met = s.cond.t === 'none' || (s.cond.t === 'rank' && rank <= s.cond.v) || (s.cond.t === 'pct' && pct >= s.cond.v);
      if (met && s.bonus) { F.money += s.bonus; news(L, `スポンサー「${s.name}」の条件達成ボーナス ${yen(s.bonus)}`, 'money'); }
    }
  }
}
function darkDay(L) {
  const F = L.front, T = myT(L);
  const caught = (k, p, days, fine, fans) => {
    F.cheats[k] = false; p.susp = Math.max(p.susp, days); F.money -= fine; F.fans = clamp(F.fans - fans, 0, 100); F.union = clamp(F.union - 4, 0, 100); F.morale = clamp(F.morale - 8, 0, 100);
    F.caught.push({ year: L.year, day: L.day, k, pid: p.id });
    news(L, `【発覚】${pfull(p)}の${CHEATS[k].name}使用が発覚。出場停止${days}日、球団に制裁金${yen(fine)}`, 'bad');
    F.pending.push({ type: 'caught', k, pid: p.id, days, fine });
    scandalHitsSponsors(L, 0.35);
    applyBoosts(L);
  };
  // the league's drug test: three players of a club, now and then
  if (R() < 1 / 14) {
    const ps = T.roster.map((x) => L.P[x]).sort(() => R() - 0.5).slice(0, 3);
    for (const k of ['steroid', 'drug', 'stim']) {
      if (!F.cheats[k]) continue;
      const p = ps.find(() => R() < CHEATS[k].risk);
      if (p) { caught(k, p, k === 'steroid' ? 60 : k === 'drug' ? 40 : 25, k === 'steroid' ? 5000 : 3000, k === 'steroid' ? 12 : 8); return; }
    }
    if (!F.cheats.steroid && !F.cheats.drug && !F.cheats.stim && R() < 0.3) news(L, '抜き打ちの薬物検査：全員陰性', 'good');
  }
  const bat = () => L.P[pick(T.lineup)], pit = () => L.P[pick(T.rotation.concat(T.pen.slice(0, 3)))];
  if (F.cheats.cork && R() < CHEATS.cork.risk) caught('cork', bat(), 10, 500, 6);
  else if (F.cheats.pine && R() < CHEATS.pine.risk) caught('pine', pit(), 10, 300, 4);
  else if (F.cheats.sticky && R() < CHEATS.sticky.risk) caught('sticky', pit(), 10, 500, 5);
  // other clubs get caught too, sometimes
  if (R() < 0.006) {
    const cpu = pick(Object.keys(L.teams).filter((id) => id !== L.myTeam)), p = L.P[pick(L.teams[cpu].roster)];
    const k = pick(Object.keys(CHEATS)); p.susp = 20; autoOrder(L, cpu);
    news(L, `${teamOf(cpu).short}の${pfull(p)}に${CHEATS[k].name}の使用発覚、出場停止`, 'info');
  }
}
DAY_HOOKS.before.push(dayBefore);
DAY_HOOKS.after.push(dayAfter);

// ---------------------------------------------------------------- the decisions that wait for the player (Hub shows them)
export function resolvePending(L, ev, choice) {
  const F = L.front;
  F.pending.splice(F.pending.indexOf(ev), 1);
  if (ev.type === 'demand') {
    const p = L.P[ev.pid];
    if (choice === 0) { const r = tradeSell(L, ev.pid); F.union = clamp(F.union + 2, 0, 100); return r.ok ? `${pname(p)}の希望を認め、${r.text}` : `${pname(p)}：${r.text}`; }
    p.conduct = Math.max(5, p.conduct - 6); F.union = clamp(F.union - 3, 0, 100); F.morale = clamp(F.morale - 2, 0, 100);
    return `${pname(p)}を慰留しました（本人は不満そう）`;
  }
  if (ev.type === 'union') {
    if (choice === 0) { F.money -= ev.cost; F.union = clamp(F.union + 22, 0, 100); news(L, `選手会の要求を受け入れ（年俸の底上げ ${yen(ev.cost)}）`, 'money'); return '選手会と合意しました'; }
    F.union = clamp(F.union - 10, 0, 100);
    if (R() < 0.45) { F.strike = 2; news(L, '選手会がストライキを決議（2日間）', 'bad'); return '選手会がストライキを決めました'; }
    return '要求を拒否しました';
  }
  if (ev.type === 'mgr') { returnManager(L, choice === 1); return choice === 1 ? '監督代行を新監督にしました' : '監督が復帰しました'; }
  return '';
}

// ---------------------------------------------------------------- the off-season
// salary talks: the player asks by his season, the club offers by his worth; a big gap → 保留 → 調停 (the arbiter decides)
export function perfSalary(L, p) {
  const s = p.s || {};
  let k = 1;
  if (p.pitcher) { const ip = s.outs / 3; k = ip > 20 ? clamp(1 + (3.6 - (s.er * 27) / Math.max(1, s.outs)) * 0.12 + s.w * 0.02 + s.sv * 0.01, 0.7, 1.6) : 0.85; }
  else { const avg = s.ab ? s.h / s.ab : 0; k = s.pa > 60 ? clamp(1 + (avg - 0.255) * 2.2 + s.hr * 0.012 + s.rbi * 0.003, 0.7, 1.6) : 0.85; }
  return Math.max(440, Math.round((salaryOf(p) * 0.5 + p.sal * 0.5) * k / 10) * 10);
}
export function startOffseason(L) {
  const F = L.front;
  if (F.off) return F.off;
  const T = myT(L);
  const talks = allOf(T).map((id) => L.P[id]).map((p) => { const offer = perfSalary(L, p); const ask = Math.round(offer * (1 + Math.max(0, gauss() * 0.12 + (offer > p.sal ? 0.08 : 0))) / 10) * 10; return { pid: p.id, old: p.sal, offer, ask, done: false }; }).sort((a, b) => b.offer - a.offer);
  // free agents: 8+ years, good enough; some declare
  const fa = [];
  for (const [id, tm] of Object.entries(L.teams)) for (const pid of tm.roster) { const p = L.P[pid]; if (p.years >= 8 && overall(p) >= 55 && R() < (id === L.myTeam ? 0.35 : 0.22)) fa.push({ pid, from: id, ask: Math.round(perfSalary(L, p) * 1.25 / 10) * 10, rank: p.sal >= 15000 ? 'A' : p.sal >= 7000 ? 'B' : 'C', status: 'open' }); }
  F.off = { step: 0, talks, fa, protect: null, tryout: [], signedTry: 0 };
  news(L, `オフシーズン：FA宣言 ${fa.length}人`, 'info');
  return F.off;
}
export function settleTalk(L, t, mode) { // mode: 'offer' | 'ask'
  const p = L.P[t.pid];
  if (mode === 'ask' || t.ask <= t.offer * 1.08) { p.sal = mode === 'ask' ? t.ask : t.offer; t.done = 'signed'; if (mode === 'ask') L.front.union = clamp(L.front.union + 1, 0, 100); return `${pname(p)}：${yen(p.sal)}で契約更改`; }
  // 保留 → 調停: the arbiter goes near the worth, a little toward the player
  const worth = perfSalary(L, p);
  const v = Math.round((worth * 0.6 + t.ask * 0.25 + t.offer * 0.15) / 10) * 10;
  p.sal = clamp(v, Math.min(t.offer, t.ask), Math.max(t.offer, t.ask)); t.done = 'arb';
  L.front.union = clamp(L.front.union - 2, 0, 100);
  news(L, `${pfull(p)}が年俸調停を申請。調停額 ${yen(p.sal)}`, 'info');
  return `${pname(p)}：保留 → 年俸調停 ${yen(p.sal)}`;
}
export function settleAllTalks(L) { for (const t of L.front.off.talks) if (!t.done) settleTalk(L, t, 'offer'); }
// protect 28 (the best by worth, the player can swap); the unprotected may go as compensation
export function autoProtect(L, teamId) { return allOf(L.teams[teamId]).slice().sort((a, b) => valueOf(L.P[b]) - valueOf(L.P[a])).slice(0, 28); }
export function faBid(L, f, sal) {
  const p = L.P[f.pid];
  const rival = f.ask * (0.95 + R() * 0.22);
  if (sal < f.ask || sal < rival) { f.status = 'lost'; const cpu = pick(Object.keys(L.teams).filter((id) => id !== f.from && id !== L.myTeam)); movePlayer(L, f.pid, cpu); p.sal = Math.round(rival / 10) * 10; news(L, `FA：${pfull(p)}は${teamOf(cpu).short}と契約`, 'trade'); return { ok: false, text: `${pname(p)}は${teamOf(cpu).short}を選びました` }; }
  if (L.front.money < sal) return { ok: false, text: '資金が足りません' };
  p.sal = sal; movePlayer(L, f.pid, L.myTeam); f.status = 'mine';
  let comp = '';
  if (f.rank === 'A' || f.rank === 'B') { // compensation to the old club: a player from the unprotected, or money
    const prot = new Set(L.front.off.protect || autoProtect(L, L.myTeam));
    const un = allOf(myT(L)).filter((x) => !prot.has(x) && x !== f.pid).sort((a, b) => valueOf(L.P[b]) - valueOf(L.P[a]));
    if (f.rank === 'A' && un.length && R() < 0.7) { const q = L.P[un[0]]; movePlayer(L, un[0], f.from); comp = `人的補償で${pfull(q)}が${teamOf(f.from).short}へ`; }
    else { const m = Math.round(sal * 0.5 / 10) * 10; L.front.money -= m; comp = `補償金 ${yen(m)}を${teamOf(f.from).short}へ`; }
  }
  news(L, `FA：${pfull(p)}（${teamOf(f.from).short}）と${yen(sal)}で契約。${comp}`, 'trade'); applyBoosts(L);
  return { ok: true, text: `${pname(p)}と契約！${comp ? `（${comp}）` : ''}` };
}
// your own FA: keep him by meeting his ask, or let him go (and take compensation from the new club)
export function faKeep(L, f, keep) {
  const p = L.P[f.pid];
  if (keep && L.front.money >= f.ask) { p.sal = f.ask; f.status = 'stay'; news(L, `${pfull(p)}がFA残留`, 'good'); return `${pname(p)}が残留！`; }
  const cpu = pick(Object.keys(L.teams).filter((id) => id !== L.myTeam));
  movePlayer(L, f.pid, cpu); p.sal = f.ask; f.status = 'gone';
  let comp = '';
  if (f.rank === 'A') { const prot = new Set(autoProtect(L, cpu)); const un = allOf(L.teams[cpu]).filter((x) => !prot.has(x)).sort((a, b) => valueOf(L.P[b]) - valueOf(L.P[a])); if (un.length) { const q = L.P[un[0]]; movePlayer(L, un[0], L.myTeam); comp = `人的補償で${pfull(q)}を獲得`; } }
  else if (f.rank === 'B') { const m = Math.round(f.ask * 0.5 / 10) * 10; L.front.money += m; comp = `補償金 ${yen(m)}`; }
  news(L, `${pfull(p)}がFAで${teamOf(cpu).short}へ移籍。${comp}`, 'trade'); applyBoosts(L);
  return `${pname(p)}は${teamOf(cpu).short}へ。${comp}`;
}
// the tryout: the released, the unclaimed and the veterans the clubs let go
export function makeTryout(L) {
  const F = L.front, off = F.off;
  for (const [id, tm] of Object.entries(L.teams)) {
    if (id === L.myTeam) continue;
    const cut = tm.farm2.map((x) => L.P[x]).filter((p) => p.age >= 30).sort((a, b) => overall(a) - overall(b)).slice(0, 1);
    for (const p of cut) { removeFrom(tm, p.id); F.pool.push(p.id); }
  }
  off.tryout = F.pool.filter((pid) => L.P[pid]).slice(-14).map((pid) => ({ pid, sal: Math.max(440, Math.round(salaryOf(L.P[pid]) * 0.5 / 10) * 10), signed: false }));
  return off.tryout;
}
export function signTryout(L, t) {
  if (t.signed || L.front.off.signedTry >= 3) return false;
  const p = L.P[t.pid];
  p.sal = t.sal; myT(L).farm2.push(t.pid); L.front.pool = L.front.pool.filter((x) => x !== t.pid);
  t.signed = true; L.front.off.signedTry++;
  news(L, `トライアウトから${pfull(p)}と契約（${yen(t.sal)}）`, 'trade'); applyBoosts(L);
  return true;
}
// a new season: age, growth and decline, retirements, the draft, salaries settled, a fresh schedule
export function nextSeason(L) {
  const F = L.front;
  const rng = makeRng((L.seed || 1) + L.year * 13);
  L.year++; F.season++;
  // the boosts come off while the abilities change
  for (const p of Object.values(L.P)) if (p.boost) { for (const [k, v] of Object.entries(p.boost)) p[k] -= v; p.boost = null; }
  const retired = [];
  for (const [id, tm] of Object.entries(L.teams)) {
    for (const pid of allOf(tm)) {
      const p = L.P[pid];
      p.age++; p.years++;
      const d = p.age <= 25 ? 2.2 : p.age <= 29 ? 0.6 : p.age <= 32 ? -0.8 : -2.4;
      const steps = Math.round(Math.abs(d) + gauss(rng));
      for (let i = 0; i < steps; i++) { if (d > 0) grow(p, 1); else { const a = pick(p.pitcher ? ['control', 'stamina'] : ['meet', 'power', 'speed', 'field']); p[a] = Math.max(5, p[a] - 1); if (p.pitcher && rng() < 0.3) p.velo = Math.max(124, p.velo - 1); } }
      if (p.age >= 39 || (p.age >= 34 && overall(p) < 44) || (p.age >= 36 && rng() < 0.3)) retired.push([id, pid]);
      p.inj = 0; p.susp = 0; p.s = null; seasonStats(p);
    }
  }
  for (const [id, pid] of retired) { removeFrom(L.teams[id], pid); if (id === L.myTeam) news(L, `${pfull(L.P[pid])}が現役引退`, 'info'); }
  // the draft: each club refills its farm with young players
  resetSeq(Math.max(nextSeq(), L.seq || 1));
  const drafted = [];
  for (const [id, tm] of Object.entries(L.teams)) {
    const n = Math.max(3, 46 - allOf(tm).length);
    for (let i = 0; i < n; i++) {
      const p = farmPlayer(rng, i % 2 === 0, tm.tier + (i === 0 ? 8 : 0), 18 + Math.floor(rng() * 5)); initPlayer(p); p.sal = 1000 + (i === 0 ? 600 : 0); p.years = 0;
      p.pot = clamp(p.pot + (i === 0 ? 14 : 4), 20, 95);
      L.P[p.id] = p; seasonStats(p); (i < 2 ? tm.farm2 : tm.farm3).push(p.id);
      const used = new Set(allOf(tm).filter((x) => x !== p.id).map((x) => L.P[x].num)); let num = p.pitcher ? 11 : 0; while (used.has(num)) num++; p.num = num;
      if (id === L.myTeam) drafted.push(p);
    }
    refill(L, id);
    Object.assign(tm, { w: 0, l: 0, d: 0, rs: 0, ra: 0, streak: 0, last: [], rot: 0 });
  }
  L.seq = nextSeq();
  if (drafted.length) news(L, `ドラフト：1位 ${pfull(drafted[0])}ほか${drafted.length}人が入団`, 'good');
  L.day = 0; L.over = false; L.endShown = false; L.results = [];
  L.sched = makeSchedule(L.games, rng);
  F.off = null; F.paidBonus = false; F.pool = F.pool.slice(-20);
  F.sponsors = []; makeOffers(L);
  F.morale = 55;
  applyBoosts(L); updateMods(L);
  news(L, `${L.year}年シーズン開幕！`, 'info');
}
export { pfull, pname };
