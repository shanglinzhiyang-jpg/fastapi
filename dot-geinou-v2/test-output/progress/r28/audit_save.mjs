// R28 (通し検査 of R17–R27): fill every new system with data, save, reload the page and continue from the save, then compare each module's state; scan the state for NaN / functions / cycles;
// play 200 mornings on the restored game (with the regime's scenes pumped); sizes of the new states.   node audit_save.mjs [era]
import path from 'node:path';
import { bootScan, reloadContinue12, inject } from '../../audit12/lib12.mjs';
const ERA = process.argv[2] || 'heisei';
const { browser, page, errors } = await bootScan('?test=1&place=home', {});
await page.addScriptTag({ path: path.resolve('test-output/audit3-systems/slsetup.js') });
page.on('console', (m) => { const t = m.text(); if (t.startsWith('STEP')) console.error(t); });
const KEYS = ['scandal', 'localGov', 'factionMoney', 'mediaOps', 'crisisOps', 'rule', 'regime', 'govt'];
const before = await page.evaluate(async (era) => {
  const g = window.__game, S = window.__S;
  const out = { fails: [], info: {} };
  const ok = (c, m) => { if (!c) out.fails.push(m); };
  S.setEra(era); const mp = S.makePM('own', 0.7); S.session();
  const p = g.pol();
  // scandal
  g.politicalScandal('affair', { who: 'player', severity: 3 });
  const npc = Object.values(p.npcs).find((n) => !n.real && n.office);
  g.politicalScandal('bribery', { who: npc.id, severity: 3 });
  // the election system
  g.electionSystem();
  // local government (briefly the head of a ward)
  const off = p.me.office; p.me.office = 'shicho'; try { g.localGov(); g.localGovOrdinances(); } catch (e) { out.fails.push('localGov ' + e); } p.me.office = off;
  // faction money (needs a faction: heisei and earlier)
  try { g.factionMoney(); } catch (e) { out.fails.push('factionMoney ' + e); }
  // media ops
  g.state.money = 50000000; g.mediaOpsAct('kondan'); g.mediaOpsAct('stealth'); g.mediaOpsAct('sns_team');
  // a crisis
  p.me.posts = [...new Set([...(p.me.posts || []), 'pm'])];
  g.crisisOpsStart('epidemic', { sev: 2 }); g.crisisOpsAct('rules_up'); g.crisisOpsAct('benefit');
  // the dictatorship's rule
  const st = g.state; st.regime.steps.clause = true; st.regime.steps.clauseDay = st.day;
  for (const k of ['declare_emergency', 'suspend_elections', 'suspend_diet', 'national_army']) g.regimeStep(k);
  st.regime.queue = []; g.rule(); g.ruleAct('reward_army'); g.ruleAct('party_congress');
  ok(g.regime().id === 'dictatorship', 'dictatorship: ' + g.regime().id);
  for (let i = 0; i < 20; i++) { st.day++; await g.morning(80, {}); g.morningNotes = []; if (st.regime.id === 'fallen') break; }
  const snap = {}; for (const k of ['scandal', 'localGov', 'factionMoney', 'mediaOps', 'crisisOps', 'rule', 'regime', 'govt']) snap[k] = st[k] === undefined ? null : JSON.stringify(st[k]);
  snap.flagsElec = JSON.stringify(g.pol().flags.elec || null);
  out.snap = snap;
  out.have = Object.fromEntries(Object.keys(snap).map((k) => [k, snap[k] !== null && snap[k] !== 'null']));
  out.unsafe = window.__A.scanUnsafe(st).slice(0, 12);
  out.saved = g.save();
  out.day = st.day;
  return out;
}, ERA);
console.log('before: have', JSON.stringify(before.have), 'saved', before.saved, 'unsafe', JSON.stringify(before.unsafe), 'fails', JSON.stringify(before.fails));
await reloadContinue12(page);
await page.addScriptTag({ path: path.resolve('test-output/audit3-systems/slsetup.js') });
const after = await page.evaluate(async (snap) => {
  const g = window.__game, S = window.__S, st = g.state;
  const out = { fails: [], same: {}, sizes: {} };
  const ok = (c, m) => { if (!c) out.fails.push(m); };
  g.toTitle = () => {};
  const noQueue = (j) => { if (j === null) return null; const o = JSON.parse(j); delete o.queue; return JSON.stringify(o); }; // a scene queued at the save is shown on the first free moment after loading
  for (const k of Object.keys(snap)) {
    if (k === 'regime') { out.same[k] = noQueue(JSON.stringify(st[k])) === noQueue(snap[k]); continue; }
    if (k === 'flagsElec') { out.same[k] = JSON.stringify(g.pol().flags.elec || null) === snap[k]; continue; }
    out.same[k] = (st[k] === undefined ? null : JSON.stringify(st[k])) === snap[k];
  }
  { const a = JSON.parse(snap.regime), b = JSON.parse(JSON.stringify(st.regime)); out.regimeDiff = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => k + ': ' + JSON.stringify(a[k]).slice(0, 80) + ' -> ' + JSON.stringify(b[k]).slice(0, 80)); }
  out.unsafe = window.__A.scanUnsafe(st).slice(0, 12);
  // the APIs on the restored state
  try { ok(g.crisisOps() && g.crisisOps().active, 'crisis restored'); ok(g.mediaOps() && g.mediaOps().staff === 1, 'media restored'); ok(g.scandals().cases.length >= 2, 'scandals restored: ' + g.scandals().cases.length); ok(g.rule() && g.rule().active !== undefined, 'rule'); ok(g.electionSystem() !== undefined, 'elec'); } catch (e) { out.fails.push('api ' + e); }
  // play on
  const day0 = st.day;
  let stop = false; const pump = (async () => { while (!stop) { await window.__ff(6); await new Promise((o) => setTimeout(o, 5)); } })();
  try { const r = await Promise.race([S.mornings(200), new Promise((o) => setTimeout(() => o('TIMEOUT'), 120000))]); if (r === 'TIMEOUT') out.fails.push('mornings timeout'); } finally { stop = true; await pump; }
  out.played = g.state.day - day0;
  const s2 = g.state;
  for (const k of ['scandal', 'localGov', 'factionMoney', 'mediaOps', 'crisisOps', 'rule', 'regime', 'govt', 'politics']) out.sizes[k] = s2[k] === undefined ? 0 : JSON.stringify(s2[k]).length;
  out.sizes.TOTAL = JSON.stringify(s2).length;
  out.unsafe2 = window.__A.scanUnsafe(s2).slice(0, 12);
  return out;
}, before.snap);
console.log('regimeDiff', JSON.stringify(after.regimeDiff));
console.log('after: same', JSON.stringify(after.same), 'played', after.played);
console.log('sizes(KB)', JSON.stringify(Object.fromEntries(Object.entries(after.sizes).map(([k, v]) => [k, Math.round(v / 1024)]))));
console.log('unsafe', JSON.stringify(after.unsafe), JSON.stringify(after.unsafe2), 'fails', JSON.stringify(after.fails), 'errors', JSON.stringify(errors.slice(0, 5)));
const bad = Object.entries(after.same).filter(([, v]) => !v).map(([k]) => k);
console.log(before.fails.length || after.fails.length || bad.length || errors.length ? `FAIL ${bad.join(',')}` : 'ALL PASS');
await browser.close();
