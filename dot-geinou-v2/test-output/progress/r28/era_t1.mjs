// R28: the new politics systems in the SHOWA era (1987): no internet (media_ops net outlet and net actions, scandal sources), no cyber defence, the device word, and nothing NaN.
import path from 'node:path';
import { bootScan } from '../../audit12/lib12.mjs';
const { browser, page, errors } = await bootScan('?test=1&place=home', {});
await page.addScriptTag({ path: path.resolve('test-output/audit3-systems/slsetup.js') });
const r = await page.evaluate(async () => {
  const g = window.__game, S = window.__S, MD = window.__media, CR = window.__crisis;
  const fails = [];
  try {
    const ok = (c, m) => { if (!c) fails.push(m); };
    const bad = /NaN|undefined|\[object|Infinity/;
    S.setEra('showa'); S.makePM('own', 0.7); S.session();
    const p = g.pol();
    // media
    g.state.money = 50000000; p.me.posts = ['pm'];
    const s0 = g.mediaOps();
    ok(!('net' in s0.rel) && Object.keys(s0.rel).length === 3 && !bad.test(JSON.stringify(s0)), 'no net outlet in 1987: ' + Object.keys(s0.rel));
    const a = g.mediaOpsActions();
    ok(/インターネット/.test(a.find((x) => x.id === 'stealth').why || '') && /インターネット/.test(a.find((x) => x.id === 'fake').why || ''), 'net actions wait: ' + a.find((x) => x.id === 'stealth').why);
    ok(!a.find((x) => x.id === 'pollbias').why && !a.find((x) => x.id === 'sns_team').lines.some((l) => /ネット/.test(l)), 'the others are open and net-free');
    ok(g.mediaOpsAct('pollbias').ok, 'a biased poll works in 1987');
    // scandals read without the net
    for (let i = 0; i < 40; i++) { g.politicalScandal(['private', 'antisocial', 'resume', 'carusage'][i % 4], { who: 'player', severity: 2 }); g.state.day += 7; }
    const txt = JSON.stringify(g.scandals().cases) + JSON.stringify(p.news.slice(0, 80)) + JSON.stringify((g.state.scandal.cases || []).map((c) => c.log));
    ok(!/ネット/.test(txt), '1987 scandals mention no net: ' + (txt.match(/.{20}ネット.{10}/) || [''])[0]);
    // the device word
    const msgs = []; const m0 = g.message.bind(g); g.message = (m) => { msgs.push(m.text || ''); return m0(m); };
    g.state.scandal.cases = []; g.state.scandal.pending = null; g.politicalScandal('affair', { who: 'player', severity: 3 });
    ok(!msgs.some((t) => /スマホ/.test(t)), 'no スマホ in 1987: ' + msgs.filter((t) => /スマホ|ケータイ|手帳/.test(t)).join('|').slice(0, 100));
    // the crisis: no cyber defence
    ok(!g.crisisOpsActions().some((x) => x.id === 'defense'), 'no cyber defence in 1987');
    g.message = m0;
    // heisei 1999: the net, but no cyber attacks yet
    S.setEra('heisei'); p.cal; 
    return { fails };
  } catch (e) { return { fails: [...fails, 'EXC ' + String((e && e.stack) || e).slice(0, 700)] }; }
});
r.errors = errors.slice(0, 6);
console.log(JSON.stringify(r, null, 1));
console.log(r.fails.length || r.errors.length ? 'FAIL' : 'ALL PASS');
await browser.close();
