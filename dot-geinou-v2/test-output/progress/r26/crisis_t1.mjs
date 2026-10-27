// R26: 感染症とサイバー攻撃 — the epidemic's dynamics and every action, the roles (総理大臣 / 厚生労働大臣 / 国会議員 / the government's own answer), the data bending that leaks, the cyber attack with
// its ransom, announcement, attribution and recovery, the 2020 outbreak, old saves, a long random run.
import path from 'node:path';
import { bootScan } from '../../audit12/lib12.mjs';
const { browser, page, errors } = await bootScan('?test=1&place=home', {});
await page.addScriptTag({ path: path.resolve('test-output/audit3-systems/slsetup.js') });
page.on('console', (m) => { const t = m.text(); if (t.startsWith('STEP')) console.error(t); });
const r = await page.evaluate(async () => {
  const g = window.__game, S = window.__S, CR = window.__crisis;
  const fails = [];
  try {
    const ok = (c, m) => { if (!c) fails.push(m); };
    const bad = /NaN|undefined|\[object|Infinity/;
    const info = {};
    const P = await import('/js/engine/politics.js');
    const dice = (v) => CR.setCrisisRng(() => v);
    const st = () => g.state.crisisOps;
    const nextDay = (n = 1) => { for (let i = 0; i < n; i++) { g.state.day++; CR.tick(g); } };
    console.log('STEP setup');
    S.setEra('reiwa'); S.makePM('own', 0.75); S.session();
    const p = () => g.pol();
    dice(0.99);
    let sum = g.crisisOps();
    ok(sum && !sum.active && sum.role === '総理大臣' && !bad.test(JSON.stringify(sum)), 'no crisis: ' + JSON.stringify(sum).slice(0, 120));
    ok(g.crisisOpsActions().map((a) => a.id).join() === 'defense', 'only the defence outside a crisis: ' + g.crisisOpsActions().map((a) => a.id));
    ok(g.crisisOpsAct('defense').ok && st().defense === 50 && !g.crisisOpsAct('defense').ok, 'defence +10, then a cooldown');

    console.log('STEP epidemic');
    const c = g.crisisOpsStart('epidemic', { sev: 2 });
    ok(c && c.kind === 'epidemic' && g.crisisOps().active && g.crisisOps().lines.length >= 7 && !bad.test(JSON.stringify(g.crisisOps())), 'started: ' + JSON.stringify(g.crisisOps().lines));
    ok(g.crisisOpsStart('cyber') === null, 'one crisis at a time');
    const acts = g.crisisOpsActions();
    ok(['rules_up', 'rules_down', 'border', 'test', 'beds', 'vacc_fund', 'benefit', 'explain', 'hide', 'defense'].every((id) => acts.find((a) => a.id === id)) && acts.every((a) => a.name && a.desc && a.lines.length && !bad.test(JSON.stringify(a))), 'the actions: ' + acts.map((a) => a.id));
    ok(!g.crisisOpsActions().find((a) => a.id === 'rules_down').why === false || /制限はない/.test(g.crisisOpsActions().find((a) => a.id === 'rules_down').why), 'no rule to relax at level 0');
    ok(!g.crisisOpsAct('zzz').ok, 'unknown refused');
    // the rules cut the reproduction number
    const R0 = CR.epiReff(g);
    ok(g.crisisOpsAct('rules_up').ok && st().cur.rules === 1, 'rules 1');
    const R1 = CR.epiReff(g); ok(R1 < R0, 'rules lower Reff: ' + R0 + ' -> ' + R1);
    ok(/あと/.test(g.crisisOpsAct('rules_up').why || ''), 'cooldown');
    nextDay(3); ok(g.crisisOpsAct('rules_up').ok && st().cur.rules === 2, 'rules 2');
    nextDay(3); ok(g.crisisOpsAct('rules_up').ok && st().cur.rules === 3, 'rules 3 (a PM can declare an emergency)');
    ok(g.crisisOpsActions().find((a) => a.id === 'rules_up').why === 'これ以上は強められない', 'no more');
    const R3 = CR.epiReff(g); ok(R3 < R1, 'level 3 lowers it more');
    nextDay(3); g.crisisOpsAct('rules_down'); ok(st().cur.rules === 2, 'relax');
    // support falls under rules; the economy falls
    const sup0 = st().cur.support; nextDay(20); ok(st().cur.support < sup0 && st().cur.econ > 0, 'patience and the economy: ' + sup0 + ' -> ' + st().cur.support + ' econ ' + st().cur.econ);
    // other actions
    ok(g.crisisOpsAct('border').ok && st().cur.border === 1 && g.crisisOpsActions().find((a) => a.id === 'border').name === '水際対策を解く', 'border on');
    ok(g.crisisOpsAct('border').ok && st().cur.border === 0, 'border off');
    ok(g.crisisOpsAct('test').ok && st().cur.test === 1, 'test'); 
    const beds0 = st().beds; ok(g.crisisOpsAct('beds').ok && st().beds === beds0 + 25, 'beds +25'); ok(!g.crisisOpsAct('beds').ok, 'beds cooldown');
    ok(g.crisisOpsAct('vacc_fund').ok && st().cur.vacc.fund === 1, 'vaccine fund');
    ok(g.crisisOpsAct('benefit').ok && st().cur.benefitUntil > g.state.day && !g.crisisOpsAct('benefit').ok, 'benefit');
    const sp = st().cur.support; ok(g.crisisOpsAct('explain').ok && st().cur.support >= Math.min(100, sp + 5.9), 'explain +6'); ok(!g.crisisOpsAct('explain').ok, 'explain cooldown');
    ok(g.crisisOpsAct('hide').ok && st().cur.hide === 1 && g.crisisOpsActions().find((a) => a.id === 'hide').name === 'データの公表を元に戻す', 'hide on');
    // the leak -> a coverup scandal
    const cases0 = (g.scandals ? g.scandals().cases.length : 0);
    dice(0.0001); st().cur.hide = 1; nextDay(1); dice(0.99);
    ok(st().cur.hide === 0 && g.scandals().cases.length > cases0 && g.scandals().cases.some((x) => x.kind === 'coverup' && x.mine), 'the bending leaks into a scandal');
    // no support loss below zero, load computed
    nextDay(40); ok(!bad.test(JSON.stringify(g.crisisOps())), 'no NaN');

    console.log('STEP dynamics');
    // 60 days with no rules vs rules 3: the same dice
    const run = (rules, sev) => { delete g.state.crisisOps; g.crisisOps(); dice(0.99); const k = g.crisisOpsStart('epidemic', { sev }); k.comp = 0.5; k.support = 80; k.rules = rules; if (rules >= 2) k.shocked = { 2: true, 3: true }; let m = 0; for (let i = 0; i < 40; i++) { g.state.day++; CR.tick(g); if (!st().cur) break; m = Math.max(m, st().cur.cases); } const cur = st().cur; return { cum: cur ? cur.cum : -1, m, deaths: cur ? cur.deaths : -1 }; };
    p().me.posts = ['pm']; // the PM acts: nothing is automatic
    const free = run(0, 3), tight = run(3, 3);
    ok(free.m > tight.m * 3 && free.deaths > tight.deaths, `rules help: peak ${Math.round(free.m)} vs ${Math.round(tight.m)}, deaths ${Math.round(free.deaths)} vs ${Math.round(tight.deaths)}`);
    info.free = free; info.tight = tight;
    // the hospital load beyond 100% raises the death rate; the beds lower the load
    delete g.state.crisisOps; g.crisisOps(); let k = g.crisisOpsStart('epidemic', { sev: 3 }); k.cases = 60000; nextDay(1); const load1 = st().cur.load; st().beds = 175; k.cases = 60000; nextDay(1);
    ok(load1 > 100 && st().cur.load < load1, 'beds lower the load: ' + load1 + ' -> ' + st().cur.load);
    // a vaccine arrives and is rolled out
    delete g.state.crisisOps; g.crisisOps(); k = g.crisisOpsStart('epidemic', { sev: 2 }); k.rules = 3; k.shocked = { 2: true, 3: true }; k.vacc.prog = 99.9; k.support = 90; nextDay(2);
    ok(st().cur.vacc.avail && g.crisisOpsActions().find((a) => a.id === 'vacc_roll') && !g.crisisOpsActions().find((a) => a.id === 'vacc_fund'), 'the vaccine is available');
    const r0v = st().cur.vacc.rate; nextDay(10); const r1v = st().cur.vacc.rate - r0v; ok(g.crisisOpsAct('vacc_roll').ok, 'roll out'); const r2v0 = st().cur.vacc.rate; nextDay(10); ok(st().cur.vacc.rate - r2v0 > r1v, 'faster with the rollout');
    // the end: grade, the past, the cabinet
    delete g.state.crisisOps; g.crisisOps(); k = g.crisisOpsStart('epidemic', { sev: 1 }); const ap0 = p().cabinet.approval;
    k.cases = 3; k.peak = 100; k.stage = 'decline'; k.wave = 3; nextDay(2);
    ok(!st().cur && st().past.length === 1 && st().past[0].grade && st().past[0].text && /おさまった/.test(st().past[0].text), 'the end is recorded: ' + JSON.stringify(st().past[0]));
    ok(typeof p().cabinet.approval === 'number', 'approval fine');
    ok(g.crisisOps().past.length === 1 && g.crisisOps().past[0].date, 'summary past');

    console.log('STEP roles');
    // the health minister: all but declaring an emergency and the benefit
    delete g.state.crisisOps; g.crisisOps(); g.crisisOpsStart('epidemic', { sev: 2 }); p().me.posts = ['minister_health']; st().cur.rules = 2;
    let a2 = g.crisisOpsActions();
    ok(a2.find((a) => a.id === 'rules_up').why === '宣言は総理大臣が決める' && a2.find((a) => a.id === 'benefit').why && !a2.find((a) => a.id === 'test').why && !a2.find((a) => a.id === 'explain').why, 'a health minister is limited: ' + a2.filter((a) => a.why).map((a) => a.id));
    ok(g.crisisOps().role === '厚生労働大臣' && g.crisisOps().canAct, 'role');
    // a member of the Diet: everything refused, but the grilling
    p().me.posts = []; p().me.office = 'shugi'; a2 = g.crisisOpsActions();
    ok(a2.filter((a) => a.id !== 'grill' && a.id !== 'defense').every((a) => a.why) && !a2.find((a) => a.id === 'grill').why && !g.crisisOps().canAct, 'a Diet member can only grill');
    const mood0 = p().cabinet.mood; ok(g.crisisOpsAct('grill').ok && p().cabinet.mood < mood0, 'grill'); ok(!g.crisisOpsAct('grill').ok, 'grill cooldown');
    // the government answers on its own: the rules rise and fall, the epidemic ends, no NaN
    delete g.state.crisisOps; g.crisisOps(); g.crisisOpsStart('epidemic', { sev: 3 }); st().cur.comp = 1; let maxRules = 0, ended = -1;
    dice(0.5);
    for (let i = 0; i < 1500 && ended < 0; i++) { g.state.day++; CR.tick(g); if (!st().cur) { ended = i; break; } maxRules = Math.max(maxRules, st().cur.rules); }
    ok(maxRules >= 2 && ended > 0 && st().past.length === 1, `the government's own answer: max rules ${maxRules}, ended after ${ended}, ` + (st().past[0] && st().past[0].text));
    info.auto = { maxRules, ended, text: st().past[0] && st().past[0].text };
    // before 2012 there is no 特措法: the auto answer stops at 2
    S.setEra('showa'); S.makePM('own', 0.75); S.session(); dice(0.99);
    g.crisisOpsStart('epidemic', { sev: 3 }); p().me.posts = ['pm']; st().cur.rules = 2; st().cur.shocked = { 2: true };
    ok(/根拠となる法律がまだない/.test(g.crisisOpsActions().find((a) => a.id === 'rules_up').why || ''), 'no 特措法 in the showa era: ' + g.crisisOpsActions().find((a) => a.id === 'rules_up').why);

    console.log('STEP cyber');
    S.setEra('reiwa'); S.makePM('own', 0.75); S.session(); dice(0.99);
    delete g.state.crisisOps; g.crisisOps(); p().me.posts = ['pm'];
    let cy = g.crisisOpsStart('cyber', { sev: 2, target: 'finance', ransom: true, attr: 'state' });
    ok(cy && cy.outage >= 65 && cy.ransom && cy.ransom.amount > 0 && g.crisisOps().lines.length >= 6 && !bad.test(JSON.stringify(g.crisisOps())), 'cyber started: ' + JSON.stringify(g.crisisOps().lines));
    let ca = g.crisisOpsActions();
    ok(['restore', 'experts', 'ransom_pay', 'ransom_refuse', 'announce', 'delay', 'attribute', 'defense'].every((id) => ca.find((a) => a.id === id)) && ca.every((a) => a.lines.length && !bad.test(JSON.stringify(a))), 'cyber actions: ' + ca.map((a) => a.id));
    // announce
    ok(g.crisisOpsAct('announce').ok && st().cur.pub === true && !g.crisisOpsActions().find((a) => a.id === 'announce'), 'announced');
    // experts and restore
    ok(g.crisisOpsAct('experts').ok && !g.crisisOpsAct('experts').ok, 'experts once'); ok(g.crisisOpsAct('restore').ok && st().cur.speed > 4, 'restore'); ok(!g.crisisOpsAct('restore').ok, 'restore cooldown');
    // attribution: the evidence rises with the days
    nextDay(1); const ev1 = st().cur.evidence; ok(ev1 >= 13, 'evidence rises: ' + ev1);
    dice(0.0001); ok(g.crisisOpsAct('attribute').ok && st().cur.attributed, 'attribution (success)'); dice(0.99);
    ok(!g.crisisOpsActions().find((a) => a.id === 'attribute'), 'only once');
    // pay the ransom: most of the outage and the leak go away; the payment may be reported
    const o0 = st().cur.outage; ok(st().cur && st().cur.ransom, 'the ransom is still open'); ok(g.crisisOpsAct('ransom_pay').ok && st().cur.outage < o0 * 0.5 && st().cur.paid && !st().cur.ransom, 'paid: ' + o0 + ' -> ' + st().cur.outage);
    dice(0.0001); nextDay(1); dice(0.99); ok(!st().cur || st().cur.paidOut, 'the payment is reported (or the recovery had already ended)');
    // the recovery ends
    nextDay(40); ok(!st().cur && st().past[0] && st().past[0].kind === 'cyber' && /復旧が終わった/.test(st().past[0].text), 'recovered: ' + (st().past[0] && st().past[0].text));
    // the ransom refused and the unanswered default; the delay found out
    delete g.state.crisisOps; g.crisisOps(); cy = g.crisisOpsStart('cyber', { sev: 3, target: 'hospital', ransom: true, attr: 'criminal' });
    const l0 = cy.leak; ok(g.crisisOpsAct('ransom_refuse').ok && st().cur.leak > l0 && !st().cur.ransom, 'refused: the leak grows');
    ok(!g.crisisOpsActions().find((a) => a.id === 'attribute'), 'no attribution for criminals');
    const cases1 = g.scandals().cases.length;
    ok(g.crisisOpsAct('delay').ok && st().cur.pub === 'delay', 'delayed'); dice(0.0001); nextDay(1); dice(0.99);
    ok(st().cur.pub === 'late' && g.scandals().cases.length > cases1, 'the delay is found out and is a scandal');
    // unanswered ransom; the press finds an unannounced attack
    delete g.state.crisisOps; g.crisisOps(); g.crisisOpsStart('cyber', { sev: 2, target: 'power', ransom: true, attr: 'criminal' }); const leakA = st().cur.leak; nextDay(3);
    ok(st().cur && !st().cur.ransom && st().cur.leak > leakA && st().cur.pub === 'press', 'unanswered = refused; the press reports: ' + JSON.stringify({ r: st().cur.ransom, l: st().cur.leak, pub: st().cur.pub }));
    // the digital minister can act, a Diet member cannot
    p().me.posts = ['minister_digital']; ok(!g.crisisOpsActions().find((a) => a.id === 'restore').why, 'the digital minister acts');
    p().me.posts = []; p().me.office = 'shugi'; ok(g.crisisOpsActions().find((a) => a.id === 'restore').why, 'a Diet member cannot'); 
    // the government's own answer finishes it
    dice(0.5); for (let i = 0; i < 80 && st().cur; i++) { g.state.day++; CR.tick(g); } ok(!st().cur, 'the government recovers it on its own');
    // a strong defence softens a new attack
    delete g.state.crisisOps; g.crisisOps(); st().defense = 90; const strong = g.crisisOpsStart('cyber', { sev: 3, target: 'transport', ransom: false }).outage; delete g.state.crisisOps; g.crisisOps(); st().defense = 10; const weak = g.crisisOpsStart('cyber', { sev: 3, target: 'transport', ransom: false }).outage;
    ok(strong < weak, 'defence softens: ' + strong + ' < ' + weak);

    console.log('STEP 2020');
    S.setEra('heisei'); S.session(); delete g.state.crisisOps; g.crisisOps(); dice(0.99); p().me.posts = [];
    let started = null, guard = 0;
    while (!started && guard++ < 4000) { g.state.day++; CR.tick(g); if (st().cur) started = st().cur; }
    const yr = P.polDate(g).year;
    ok(started && started.name === '新型コロナウイルス感染症' && yr === 2020, 'the 2020 outbreak is anchored: ' + (started && started.name) + ' ' + yr + ' after ' + guard);
    info.anchoredYear = yr;

    console.log('STEP long');
    delete g.state.crisisOps; g.crisisOps(); CR.setCrisisRng(null);
    let eps = 0, cybs = 0;
    for (let i = 0; i < 4000; i++) { g.state.day++; try { CR.tick(g); } catch (e) { fails.push('tick ' + e); break; } const cur = st() && st().cur; if (cur && cur.start === g.state.day) { if (cur.kind === 'epidemic') eps++; else cybs++; } if (i % 400 === 0 && !bad.test(JSON.stringify(g.crisisOps()))) { /* ok */ } }
    ok(!bad.test(JSON.stringify(g.crisisOps())) && st().past.length >= 1, `long random run: ${eps}+ epidemics and ${cybs}+ cyber attacks started, past ${st().past.length}`);
    info.long = { eps, cybs, past: st().past.length };

    console.log('STEP old saves');
    delete g.state.crisisOps; ok(g.crisisOps() && !g.crisisOps().active, 'no state: made again');
    g.state.crisisOps = { v: 1, cur: { kind: 'epidemic', sev: 9, cases: 'x', rules: 7, support: -50, vacc: 3, stage: 'zz', log: 'no' }, past: 5, defense: 900, beds: 'x', log: 'no', cool: 3 };
    let fx = g.crisisOps(); ok(fx && !bad.test(JSON.stringify(fx)) && st().cur.rules === 3 && st().cur.sev === 3 && st().defense === 100 && st().beds === 100 && st().cur.stage === 'outbreak', 'damaged epidemic repaired: ' + JSON.stringify(fx).slice(0, 160));
    g.state.crisisOps = { v: 1, cur: { kind: 'cyber', sev: 2, target: 'zz', outage: 400, ransom: 5, nation: 'x', pub: 7, stage: 'q' }, past: [], defense: 40, beds: 100, log: [], cool: {} };
    fx = g.crisisOps(); ok(fx && !bad.test(JSON.stringify(fx)) && st().cur.outage === 100 && st().cur.target === 'transport' && st().cur.ransom === null && /サイバー攻撃/.test(st().cur.name), 'damaged cyber repaired: ' + JSON.stringify(fx).slice(0, 160));
    g.state.crisisOps = { v: 1, cur: { kind: 'zzz' } }; ok(g.crisisOps() && st().cur === null, 'unknown kind dropped');
    return { ...info, fails };
  } catch (e) { return { fails: [...fails, 'EXC ' + String((e && e.stack) || e).slice(0, 900)] }; }
});
r.errors = errors.slice(0, 6);
console.log(JSON.stringify(r, null, 1));
console.log(r.fails.length || r.errors.length ? 'FAIL' : 'ALL PASS');
await browser.close();
