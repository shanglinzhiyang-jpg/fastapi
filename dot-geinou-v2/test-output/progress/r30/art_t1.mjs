// R31: every 生活 picture paints without errors — one contact sheet (2 columns, 1x) for a visual check
import fs from 'node:fs';
import { open } from '../../r8l1/h.mjs';
const OUT = '/home/user/fastapi/dot-geinou-v2/test-output/progress/r30';
const { browser, page, errors } = await open('?test=1&rich=1&place=home', { viewport: { width: 800, height: 600 } });
const r = await page.evaluate(async () => {
  const A = await import('/js/engine/life_art.js');
  const keys = [...Object.keys(A.LIFE_ART), 'cafe', 'karaoke', 'izakaya', 'park', 'home'];
  const cols = 3, W = 320, H = 112;
  const cv = document.createElement('canvas'); cv.width = cols * (W + 4); cv.height = Math.ceil(keys.length / cols) * (H + 16);
  const c = cv.getContext('2d'); c.fillStyle = '#222'; c.fillRect(0, 0, cv.width, cv.height);
  const bad = [];
  const look = window.__game.state.look || {};
  const kid = { hair: 'twin', hairColor: 'black', skin: 'light', top: '#ff7eb6', bottom: '#8a5ac8', skirt: true };
  keys.forEach((k, i) => {
    const x = (i % cols) * (W + 4), y = Math.floor(i / cols) * (H + 16);
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    try { A.drawLifeArt(off.getContext('2d'), k, 120 + i * 13, { me: look, kid, phase: i % 5 === 3 ? 'night' : i % 5 === 4 ? 'dusk' : 'day', season: ['春', '夏', '秋', '冬'][i % 4], year: i % 2 ? 1988 : 2024, stage: k === 'jog' && i % 2 ? 'senior' : 'high', club: i % 2 ? 'soccer' : 'suisou', pct: 60, grade: 'B', market: '就職氷河期' }); } catch (e) { bad.push(k + ': ' + e.message); }
    c.drawImage(off, x, y);
    c.fillStyle = '#fff'; c.font = '11px sans-serif'; c.fillText(k, x + 4, y + H + 12);
  });
  return { url: cv.toDataURL('image/png'), bad, n: keys.length };
});
fs.writeFileSync(`${OUT}/art_sheet.png`, Buffer.from(r.url.split(',')[1], 'base64'));
console.log('pictures', r.n, 'bad', JSON.stringify(r.bad));
console.log('page errors:', errors.length ? errors.slice(0, 5).join('\n') : 'none');
console.log(r.bad.length || errors.length ? 'FAIL' : 'ALL PASS');
await browser.close();
