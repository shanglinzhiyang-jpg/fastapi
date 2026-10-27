// R28: long plays of the whole game with each kind of player: a comedian, an opposition member, the PM, a dictator — in each era. Counts console errors, mornings with more than 6 messages, the time of a morning, the state size.
//   node audit_long.mjs [days=400] [era,era,...] [role,role,...]
import path from 'node:path';
import { bootScan } from '../../audit12/lib12.mjs';
const DAYS = Number(process.argv[2] || 400);
const ERAS = (process.argv[3] || 'reiwa,heisei,showa').split(',');
const ROLES = (process.argv[4] || 'comedian,opposition,pm,dictator').split(',');
const rows = [];
for (const era of ERAS) for (const role of ROLES) {
  const { browser, page, errors } = await bootScan('?test=1&place=home', {});
  await page.addScriptTag({ path: path.resolve('test-output/audit3-systems/slsetup.js') });
  const r = await page.evaluate(async ({ era, role, DAYS }) => {
    const g = window.__game, S = window.__S, A = window.__A;
    const out = { fails: [] };
    g.toTitle = () => { out.toTitle = (out.toTitle || 0) + 1; };
    S.setEra(era);
    let p = g.pol();
    if (role === 'opposition') { p.me.office = 'shugi'; p.me.district = '東京ドット区'; p.me.termEnd = g.state.day + 480; p.me.wins = 2; p.me.nationalWins = 2; const opp = Object.keys(p.parties).find((id) => !p.cabinet.partyIds.includes(id) && !p.parties[id].real) || Object.keys(p.parties).find((id) => !p.cabinet.partyIds.includes(id)); p.me.party = opp; p.me.posts = ['kokutai']; }
    else if (role === 'pm' || role === 'dictator') {
      S.makePM('own', 0.7);
      if (role === 'dictator') { const st = g.state; st.regime.steps.clause = true; st.regime.steps.clauseDay = st.day; for (const k of ['declare_emergency', 'suspend_elections', 'suspend_diet', 'national_army']) g.regimeStep(k); st.regime.queue = []; st.profile.age = 40; delete st.rule; g.rule(); }
    }
    A.msgs.length = 0;
    const ms = [];
    let stop = false; const pump = (async () => { while (!stop) { await window.__ff(6); await new Promise((o) => setTimeout(o, 5)); } })();
    let ran = 0;
    try {
      for (let i = 0; i < DAYS; i++) {
        const t = performance.now();
        const r = await Promise.race([S.mornings(1), new Promise((o) => setTimeout(() => o('TIMEOUT'), 30000))]);
        ms.push(performance.now() - t);
        if (r === 'TIMEOUT') { out.fails.push('timeout at day ' + g.state.day); break; }
        ran++;
        if (g.state.regime && g.state.regime.id === 'fallen') { out.fell = g.state.day; break; }
        // keep the player alive and solvent: this is a stress test, not a play-through
        g.state.money = Math.max(g.state.money, 100000);
      }
    } catch (e) { out.fails.push('EXC ' + String(e && e.stack || e).slice(0, 300)); } finally { stop = true; await pump; }
    out.ran = ran; out.day = g.state.day;
    const per = {}; for (const m of A.msgs) per[m.day] = (per[m.day] || 0) + 1;
    out.flood = Object.entries(per).filter(([, n]) => n > 6).map(([d, n]) => d + ':' + n);
    out.msgs = A.msgs.length;
    { const by = {}; for (const m of A.msgs) { if ((per[m.day] || 0) > 6) { const k = (m.from || '').replace(/（.*$/, ''); by[k] = (by[k] || 0) + 1; } } out.floodBy = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v); }
    ms.sort((a, b) => a - b); out.avg = Math.round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)); out.p95 = Math.round(ms[Math.floor(ms.length * 0.95)] || 0); out.max = Math.round(ms[ms.length - 1] || 0);
    out.size = Math.round(JSON.stringify(g.state).length / 1024);
    out.unsafe = A.scanUnsafe(g.state).slice(0, 6);
    const sc = g.state.scandal; out.scandals = sc ? sc.cases.length : 0;
    const co = g.state.crisisOps; out.crises = co ? co.past.length + (co.cur ? 1 : 0) : 0;
    out.issues = A.issues.slice(0, 5);
    return out;
  }, { era, role, DAYS });
  rows.push({ era, role, ...r, errors: errors.length });
  console.log(`${era}/${role}: ran ${r.ran} (day ${r.day}${r.fell ? ', fell ' + r.fell : ''}) ${r.avg}ms avg ${r.p95}ms p95 ${r.max}ms max; msgs ${r.msgs}, flood ${JSON.stringify(r.flood)} by ${JSON.stringify(r.floodBy)}; state ${r.size}KB; scandals ${r.scandals}, crises ${r.crises}; unsafe ${JSON.stringify(r.unsafe)}; issues ${JSON.stringify(r.issues)}; fails ${JSON.stringify(r.fails)}; errors ${errors.length}${errors.length ? ' ' + JSON.stringify(errors.slice(0, 2)).slice(0, 400) : ''}`);
  await browser.close();
}
const bad = rows.filter((r) => r.fails.length || r.errors || (r.unsafe && r.unsafe.length) || (r.issues && r.issues.length));
console.log(bad.length ? 'FAIL ' + bad.map((r) => r.era + '/' + r.role).join(',') : 'ALL PASS');
