#!/usr/bin/env node
// Play a minigame headlessly with a random-input bot.
//
//   node tools/minigame.mjs <id> [--difficulty 1,3,5] [--out DIR] [--max 7200] [--opts '{"json":1}']
//
// Saves screenshots (intro, early play, late play, result) and reports console
// errors, whether the game ended on its own, and the result object.

import fs from 'node:fs';
import path from 'node:path';
import { openGame, shotCanvas, PAGE_HELPERS } from './lib.mjs';

const args = process.argv.slice(2);
const id = args[0];
if (!id) { console.error('usage: minigame.mjs <id> [--difficulty 1,3,5] [--out DIR] [--max FRAMES] [--opts JSON]'); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('--out', 'test-output');
const MAX = +opt('--max', '7200');
const DIFFS = opt('--difficulty', '1,3,5').split(',').map(Number);
const EXTRA = JSON.parse(opt('--opts', '{}'));
fs.mkdirSync(OUT, { recursive: true });

const { browser, page, errors } = await openGame('?test=1&place=home');
await page.addScriptTag({ content: PAGE_HELPERS });
let failed = false;

for (const d of DIFFS) {
  const e0 = errors.length;
  const exists = await page.evaluate((id) => !!window.__game.MINIGAMES[id], id);
  if (!exists) { console.log(`minigame "${id}" is not registered`); failed = true; break; }
  await page.evaluate(({ id, d, extra }) => {
    const g = window.__game;
    g.state.stamina = g.state.maxStamina;
    window.__mgDone = null;
    g.minigame(id, { difficulty: d, ...extra }).then((r) => { window.__mgDone = r; });
  }, { id, d, extra: EXTRA });
  await page.evaluate(() => window.__ff(20));
  await shotCanvas(page, path.join(OUT, `mg_${id}_d${d}_1intro.png`));
  const res = await page.evaluate(async ({ MAX }) => {
    const g = window.__game;
    const mg = g.top;
    g.input.press('a', 'bot'); await window.__ff(2); g.input.release('a', 'bot');
    await window.__ff(110); // countdown
    const keys = ['a', 'a', 'a', 'b', 'up', 'down', 'left', 'right'];
    const held = new Map();
    let frames = 0;
    let shots = [];
    while (frames < MAX && mg.phase !== 'result') {
      for (const [k, t] of [...held]) { if (t <= 1) { g.input.release(k, 'bot'); held.delete(k); } else held.set(k, t - 1); }
      if (Math.random() < 0.09) { const k = keys[Math.floor(Math.random() * keys.length)]; if (!held.has(k)) { g.input.press(k, 'bot'); held.set(k, 2 + Math.floor(Math.random() * 5)); } }
      await window.__ff(1);
      frames++;
      if (frames === 90 || frames === 600) shots.push(frames);
      if (frames === 90) window.__shot1 = true;
    }
    for (const k of held.keys()) g.input.release(k, 'bot');
    return { frames, phase: mg.phase, result: mg.result, title: mg.title };
  }, { MAX });
  await shotCanvas(page, path.join(OUT, `mg_${id}_d${d}_3end.png`));
  // resolve result card
  await page.evaluate(async () => { const g = window.__game; await window.__ff(50); g.input.press('a', 'bot'); await window.__ff(2); g.input.release('a', 'bot'); await window.__ff(5); });
  const done = await page.evaluate(() => window.__mgDone);
  const errs = errors.slice(e0).filter((e) => !e.startsWith('[warning]'));
  console.log(`== ${id} difficulty ${d}: ${res.phase === 'result' ? 'ended' : 'DID NOT END'} after ${res.frames} frames; result=${JSON.stringify(res.result)}; resolved=${!!done}`);
  if (res.phase !== 'result' || !done) failed = true;
  for (const e of errs) { console.log('  ' + e.split('\n')[0]); failed = true; }
}

// mid-play screenshot pass (deterministic: no input)
await page.evaluate(({ id, extra }) => { const g = window.__game; g.minigame(id, { difficulty: 2, ...extra }); }, { id, extra: EXTRA });
await page.evaluate(async () => { const g = window.__game; await window.__ff(15); g.input.press('a', 'bot'); await window.__ff(2); g.input.release('a', 'bot'); await window.__ff(220); });
await shotCanvas(page, path.join(OUT, `mg_${id}_2play.png`));
console.log(`screenshots in ${OUT}/mg_${id}_*.png`);
await browser.close();
process.exit(failed ? 1 : 0);
