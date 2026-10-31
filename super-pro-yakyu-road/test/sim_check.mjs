// a whole 143-game season by the computer: league batting/pitching averages should look like pro baseball
import { newLeague, advanceDay, standings, leaders, avg, era } from '../js/league.js';
const t0 = Date.now();
const L = newLeague({ seed: Number(process.argv[3] || 12345), myTeam: 'baystars', balance: process.argv[4] || 'normal', games: Number(process.argv[2] || 143) });
while (!L.over) advanceDay(L, null, true);
const P = Object.values(L.P);
const sum = (k) => P.reduce((a, p) => a + (p.s[k] || 0), 0);
const games = Object.values(L.teams).reduce((a, t) => a + t.w + t.l + t.d, 0) / 2;
const runs = Object.values(L.teams).reduce((a, t) => a + t.rs, 0);
console.log('days', L.day, 'games', games, 'ms', Date.now() - t0);
console.log('AVG', (sum('h') / sum('ab')).toFixed(3), 'HR/team-game', (sum('hr') / games / 2).toFixed(2), 'R/team-game', (runs / games / 2).toFixed(2), 'K%', (sum('so') / sum('pa') * 100).toFixed(1), 'BB%', (sum('bb') / sum('pa') * 100).toFixed(1), 'ERA', (sum('er') * 27 / sum('outs')).toFixed(2));
const draws = Object.values(L.teams).reduce((a, t) => a + t.d, 0) / 2;
console.log('draws', draws, 'saves', sum('sv'), 'wins', sum('w'), 'losses', sum('l'));
for (const lg of ['C', 'P']) console.log(lg, standings(L, lg).map((r) => `${r.id} ${r.w}-${r.l}-${r.d} ${r.gb}`).join(' | '));
for (const k of ['avg', 'hr', 'era', 'w', 'sv']) { const b = leaders(L, k, null, 3); console.log(b.name, b.rows.map((r) => `${r.p.fam}(${r.team}) ${r.v}`).join(', ')); }
const json = JSON.stringify(L);
console.log('save size', (json.length / 1024).toFixed(0), 'KB');
