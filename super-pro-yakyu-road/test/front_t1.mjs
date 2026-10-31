// 球団運営: two seasons with every front-office action — no errors, rosters stay sound, money moves, the off-season works
import { newLeague, advanceDay, standings } from '../js/league.js';
import * as F from '../js/front.js';
import { overall } from '../js/data.js';
const L = newLeague({ seed: 5, myTeam: 'carp', games: 60 });
const fr = F.ensureFront(L);
const check = (tag) => {
  for (const [id, t] of Object.entries(L.teams)) {
    const all = F.allOf(t); if (new Set(all).size !== all.length) throw new Error(`${tag}: dup in ${id}`);
    if (t.lineup.length !== 9) throw new Error(`${tag}: lineup ${id} ${t.lineup.length}`);
    if (!t.rotation.length) throw new Error(`${tag}: rotation ${id}`);
    for (const pid of all) if (!L.P[pid]) throw new Error(`${tag}: missing ${pid}`);
  }
  const owners = {}; for (const [id, t] of Object.entries(L.teams)) for (const pid of F.allOf(t)) { if (owners[pid]) throw new Error(`${tag}: ${pid} in ${owners[pid]} and ${id}`); owners[pid] = id; }
};
check('init');
console.log('money', F.yen(fr.money), 'payroll', F.yen(F.payroll(L)), 'farm', L.teams.carp.farm2.length, L.teams.carp.farm3.length, 'mgr', fr.mgr.name, fr.mgr.skill);
F.signSponsor(L, 0);
const T = L.teams.carp;
// trades
const other = L.teams.giants;
console.log('swap', F.tradeSwap(L, T.roster[0], other.roster[1]).text);
console.log('buy', F.tradeBuy(L, other.farm2[0]).text);
console.log('sell', F.tradeSell(L, T.farm2[0]).text);
console.log('freeOut', F.tradeFreeOut(L, T.farm3[0]).text);
console.log('freeIn', F.tradeFreeIn(L, other.farm3[0]).text);
check('trades');
F.swapTier(L, T.roster[5], T.farm2[1]); F.moveFarm(L, T.farm2[2]);
console.log('waive', F.waive(L, T.farm2[3]));
F.setCheat(L, 'steroid', true); F.setCheat(L, 'sticky', true); F.setCheat(L, 'cork', true);
F.restManager(L);
L.front.ball = 'fly';
const rw = F.redWhite(L); console.log('紅白戦', rw.GS.score.home, '-', rw.GS.score.away, rw.mvp && rw.mvp.fam);
check('actions');
let caught = 0, pend = 0;
while (!L.over) {
  advanceDay(L, null, true);
  while (L.front.pending.length) { const ev = L.front.pending[0]; pend++; if (ev.type === 'caught') caught++; F.resolvePending(L, ev, Math.random() < 0.5 ? 0 : 1); }
}
check('season');
console.log('season over: money', F.yen(fr.money), 'fans', fr.fans.toFixed(1), 'morale', fr.morale.toFixed(1), 'union', fr.union.toFixed(1), 'caught', caught, 'events', pend, 'news', fr.news.length);
console.log(fr.news.slice(0, 8).map((n) => n.text).join('\n'));
const r = standings(L, 'C').map((x) => `${x.id} ${x.w}-${x.l}`).join(' | '); console.log(r);
// off-season
const off = F.startOffseason(L);
console.log('talks', off.talks.length, 'fa', off.fa.length);
for (const t of off.talks.slice(0, 5)) console.log(F.settleTalk(L, t, 'offer'));
F.settleAllTalks(L);
off.protect = F.autoProtect(L, 'carp');
for (const f of off.fa) console.log(f.from === 'carp' ? F.faKeep(L, f, Math.random() < 0.5) : F.faBid(L, f, f.ask * 1.2).text);
F.makeTryout(L); for (const t of off.tryout.slice(0, 2)) F.signTryout(L, t);
check('off');
F.nextSeason(L);
check('next');
console.log('year', L.year, 'day', L.day, 'roster', T.roster.length, 'farm', T.farm2.length, T.farm3.length, 'payroll', F.yen(F.payroll(L)), 'money', F.yen(fr.money));
for (let d = 0; d < 20; d++) { advanceDay(L, null, true); while (L.front.pending.length) F.resolvePending(L, L.front.pending[0], 1); }
check('season2');
console.log('ok', JSON.stringify(L).length >> 10, 'KB');
