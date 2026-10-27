// R28: the phone with every new app (スクープ・選挙制度・自治体・派閥資金・広報・対策本部) in desktop and touch (412x915) layout: the home grid, then each app opened and its first screens
// scanned by the text scan (bootScan installs audit6/scan.js: clipped / offscreen / squeezed text).   node audit_phone.mjs [era]
import path from 'node:path';
import { bootScan, shotCanvas } from '../../audit12/lib12.mjs';
const ERA = process.argv[2] || 'heisei';
const OUT = path.resolve('test-output/progress/r28');
const APPS = ['scoop', 'senkyo', 'jichi', 'habatsu', 'koho', 'taisaku'];
const rows = [];
for (const touch of [false, true]) {
  const { browser, page, errors } = await bootScan('?test=1&place=home', { touch });
  await page.addScriptTag({ path: path.resolve('test-output/audit3-systems/slsetup.js') });
  const ev = (f, a) => page.evaluate(f, a);
  const T = touch ? 'touch' : 'desk';
  await ev(async (era) => {
    const g = window.__game, S = window.__S;
    S.setEra(era); S.makePM('own', 0.7); S.session();
    const p = g.pol(); const off = p.me.office;
    g.politicalScandal('affair', { who: 'player', severity: 3 });
    g.state.money = 50000000; p.me.funds = 20000000;
    p.me.office = 'shicho'; g.localGov(); p.me.office = off;
    g.factionMoney();
    g.mediaOpsAct('kondan');
    g.crisisOpsStart('epidemic', { sev: 2 });
    await window.__closeAll(60); g.auto = null;
    window.__scanLog = [];
  }, ERA);
  await ev(async () => { const g = window.__game, ph = await import('/js/engine/phone.js'); window.__bg(async () => { await ph.openPhone(g); }); for (let i = 0; i < 300 && !ph.activePhone(g); i++) await window.__ff(10); await window.__ff(20); });
  await shotCanvas(page, path.join(OUT, `phone_home_${T}.png`));
  const list = await ev(async () => { const ph = await import('/js/engine/phone.js'); const g = window.__game; return ph.phoneApps(g).map((a) => a.id); });
  console.log(T, 'apps on the phone:', list.length, APPS.map((id) => id + ':' + (list.includes(id) ? 'yes' : 'NO')).join(' '));
  await ev(async () => { const g = window.__game, ph = await import('/js/engine/phone.js'); const v = ph.activePhone(g); if (v && v.back) v.back(true); await window.__ff(10); });
  const K = async (k, n = 1) => { for (let i = 0; i < n; i++) { await ev((k) => window.__key(k, 1, 6), k); await ev(() => window.__ff(14)); } };
  const scan = () => ev(() => { const r = window.__tscan.frame(); return { n: r.texts.length, flags: (r.flags || []).slice(0, 6).map((f) => (typeof f === 'string' ? f : JSON.stringify(f)).slice(0, 150)) }; });
  for (const id of APPS) {
    const res = { T, id, screens: [] };
    await ev(async (id) => { const g = window.__game; try { await window.__openApp(id); } catch (e) { window.__openErr = String(e); } await window.__ff(30); }, id);
    res.screens.push({ at: 'list', ...(await scan()) });
    await shotCanvas(page, path.join(OUT, `app_${id}_${T}.png`)).catch(() => {});
    for (let step = 0; step < 4; step++) {
      await K('a'); res.screens.push({ at: 'a' + step, ...(await scan()) });
      await shotCanvas(page, path.join(OUT, `app_${id}_${T}_${step}.png`)).catch(() => {});
      await K('b'); await K('down');
    }
    res.openErr = await ev(() => window.__openErr || null);
    rows.push(res);
    const bad = res.screens.filter((x) => x.flags.length);
    console.log(T, id, 'screens', res.screens.length, 'flagged', bad.length, JSON.stringify(bad.map((x) => x.at + ':' + x.flags.join(' | ')).slice(0, 3)), res.openErr || '');
    await ev(async () => { const g = window.__game; await window.__closeAll(60); g.auto = null; window.__openErr = null; });
    await ev(async () => { const g = window.__game, ph = await import('/js/engine/phone.js'); window.__bg(async () => { await ph.openPhone(g); }); for (let i = 0; i < 300 && !ph.activePhone(g); i++) await window.__ff(10); });
  }
  console.log(T, 'errors', JSON.stringify(errors.slice(0, 4)));
  rows.push({ T, errors: errors.length });
  await browser.close();
}
