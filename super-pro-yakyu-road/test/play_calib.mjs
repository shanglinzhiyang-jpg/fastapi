// the physics of balls in play, against pro numbers: BABIP ~.300, HR ~3% of fair balls, 2B ~6%, 3B <1%, DP on grounders
// with a runner on first and less than two outs ~ 15-20%, ground balls ~45%, the exit speed ~140 km/h.
import { newLeague } from '../js/league.js';
import { resolveBall, contactBall, CONTACT } from '../js/play.js';
import { BALANCE } from '../js/data.js';
import { clamp, gauss, makeRng } from '../js/core.js';
const N = Number(process.argv[2] || 6000), balKey = process.argv[3] || 'normal';
if (process.argv[4]) Object.assign(CONTACT, JSON.parse(process.argv[4]));
const L = newLeague({ seed: 99, myTeam: 'baystars' });
const rng = makeRng(5);
const T = Object.values(L.teams);
const tally = {}; let fair = 0, n = 0, v = 0, hrD = 0, gb = 0, dpOpp = 0, dp = 0, ld = 0, fb = 0, pu = 0;
const t0 = Date.now(); const bucket = {};
for (let k = 0; k < N; k++) {
  const bt = T[k % 12], ft = T[(k + 5) % 12];
  const bat = L.P[bt.lineup[k % 9]];
  const def = {}; for (const id of ft.lineup) def[(ft.pos && ft.pos[id]) || L.P[id].pos] = L.P[id]; def.P = L.P[ft.rotation[0]];
  const z = rng() < 0.6;
  const q = clamp(0.3 + rng() * 0.5 + (bat.meet - 55) / 200 + (z ? 0.1 : -0.1), 0.05, 1);
  const bb = contactBall({ bat, q, dyN: gauss(rng) * 0.42, e: gauss(rng) * 4.5, win: 10, power: bat.power > 70 && rng() < 0.4, bal: BALANCE[balKey], rng });
  const runners = [rng() < 0.3 ? bt.lineup[(k + 1) % 9] : null, rng() < 0.2 ? bt.lineup[(k + 2) % 9] : null, rng() < 0.12 ? bt.lineup[(k + 3) % 9] : null];
  const outs = Math.floor(rng() * 3);
  const res = resolveBall(bb, { bat, runners, outs, def, rng, bal: BALANCE[balKey], speedOf: (id) => L.P[id].speed });
  const kd = res.play.kind; n++;
  tally[kd] = (tally[kd] || 0) + 1;
  if (kd === 'FOUL') continue;
  if (res.play.infieldHit) tally.IFH = (tally.IFH || 0) + 1;
  fair++; v += bb.v;
  if (bb.angle < 10) gb++; else if (bb.angle < 25) ld++; else if (bb.angle < 50) fb++; else pu++;
  const bk = bb.angle < 10 ? 'GB' : bb.angle < 25 ? 'LD' : bb.angle < 50 ? 'FB' : 'PU'; bucket[bk] = bucket[bk] || [0, 0, 0]; bucket[bk][0]++; if (['1B', '2B', '3B'].includes(kd)) bucket[bk][1]++; if (kd === 'HR') bucket[bk][2]++;
  if (kd === 'HR') hrD += Math.hypot(...res.fl.rest);
  if (bb.angle < 10 && runners[0] && outs < 2 && !['1B', '2B', '3B', 'HR', 'FOUL'].includes(kd)) { dpOpp++; if (kd === 'DP') dp++; }
}
const H = (tally['1B'] || 0) + (tally['2B'] || 0) + (tally['3B'] || 0), hr = tally.HR || 0;
const pct = (a, b = fair) => (a / b * 100).toFixed(1) + '%';
console.log(`balance ${balKey}  N ${N}  ${Date.now() - t0}ms`);
console.log('foul', pct(tally.FOUL || 0, n), 'BABIP', (H / (fair - hr)).toFixed(3), 'HR', pct(hr), 'avgHRdist', (hrD / Math.max(1, hr)).toFixed(0), 'm', 'exit', (v / fair).toFixed(0), 'km/h');
console.log('1B', pct(tally['1B'] || 0), '2B', pct(tally['2B'] || 0), '3B', pct(tally['3B'] || 0), 'GO', pct(tally.GO || 0), 'FO', pct(tally.FO || 0), 'LO', pct(tally.LO || 0), 'PO', pct(tally.PO || 0), 'DP', pct(tally.DP || 0), 'FC', pct(tally.FC || 0), 'IFhit', pct(tally.IFH || 0));
console.log('GB', pct(gb), 'LD', pct(ld), 'FB', pct(fb), 'PU', pct(pu), 'DP rate (r1,<2 outs, grounder outs)', pct(dp, Math.max(1, dpOpp)));
console.log('hit rate by type (non-HR hits / balls, HR):', Object.entries(bucket).map(([k, [a, h, r]]) => `${k} ${(h / (a - r)).toFixed(3)} hr ${r}`).join('  '));
