// whole games where every ball in play is worked out by the physics (play.js → applyPlay), the rest by simPA: no errors,
// the bases always consistent, and runs / averages in a pro range.
import { newLeague } from '../js/league.js';
import { newGame, simPA, applyPA, applyPlay, batterOf, pitcherOf, fieldingSide, balOf, maybeChange } from '../js/game.js';
import { resolveBall, contactBall } from '../js/play.js';
import { clamp, gauss } from '../js/core.js';
const N = Number(process.argv[2] || 120), bal = process.argv[3] || 'normal';
const L = newLeague({ seed: 31, myTeam: 'baystars', balance: bal });
const ids = Object.keys(L.teams);
let runs = 0, h = 0, ab = 0, hr = 0, games = 0, d2 = 0, dp = 0, sf = 0, errs = 0;
for (let gI = 0; gI < N; gI++) {
  const GS = newGame(L, ids[gI % 12], ids[(gI + 3) % 12]);
  let guard = 0;
  while (!GS.over && guard++ < 400) {
    maybeChange(GS, L, fieldingSide(GS));
    const oc = simPA(GS, L);
    if (['K', 'BB', 'HBP'].includes(oc.kind)) { applyPA(GS, L, oc); continue; }
    const bat = batterOf(GS, L), fs = fieldingSide(GS), T = L.teams[GS[fs]], def = {};
    for (const id of GS.lineup[fs]) { const pos = (T.pos && T.pos[id]) || L.P[id].pos; if (pos !== 'DH') def[pos] = L.P[id]; }
    def.P = pitcherOf(GS, L);
    let res, tries = 0;
    do {
      const bb = contactBall({ bat, q: clamp(0.3 + Math.random() * 0.5 + (bat.meet - 55) / 200, 0.05, 1), dyN: gauss() * 0.42, e: gauss() * 4.5, win: 10, power: bat.power > 70 && Math.random() < 0.4, bal: balOf(L) });
      res = resolveBall(bb, { bat, runners: GS.bases.slice(), outs: GS.outs, def, bal: balOf(L), speedOf: (id) => L.P[id].speed });
    } while (res.play.kind === 'FOUL' && ++tries < 20);
    if (res.play.kind === 'FOUL') continue;
    const before = GS.bases.filter(Boolean).length;
    try { applyPlay(GS, L, res.play); } catch (e) { errs++; console.log('ERR', e.message, JSON.stringify(res.play)); break; }
    const ids2 = GS.bases.filter(Boolean); if (new Set(ids2).size !== ids2.length) { errs++; console.log('dup runner', JSON.stringify(res.play), before); }
    if (res.play.kind === 'DP') dp++; if (res.play.sf) sf++;
  }
  games++; runs += GS.score.home + GS.score.away;
  for (const b of Object.values(GS.box)) { h += b.h; ab += b.ab; hr += b.hr; d2 += b.d2; }
}
console.log(`${bal}: games ${games}  R/team-game ${(runs / games / 2).toFixed(2)}  AVG ${(h / ab).toFixed(3)}  HR/team-game ${(hr / games / 2).toFixed(2)}  2B/team-game ${(d2 / games / 2).toFixed(2)}  DP/game ${(dp / games).toFixed(2)}  SF ${sf}  errors ${errs}`);
