// Shared helpers for the headless test tools (Playwright + Chromium).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

export function loadPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    const root = execSync('npm root -g').toString().trim();
    return require(path.join(root, 'playwright'));
  }
}

export const BASE = process.env.GAME_URL || 'http://localhost:8765/';

export async function openGame(query, { viewport = { width: 960, height: 760 } } = {}) {
  const { chromium } = loadPlaywright();
  const opts = { args: ['--autoplay-policy=no-user-gesture-required'] };
  if (fs.existsSync('/opt/pw-browsers/chromium')) {
    // let playwright pick its bundled build first; fall back to the generic path
  }
  let browser;
  try {
    browser = await chromium.launch(opts);
  } catch (e) {
    browser = await chromium.launch({ ...opts, executablePath: '/opt/pw-browsers/chromium' });
  }
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 30000 });
  return { browser, page, errors };
}

export async function shotCanvas(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.locator('#game').screenshot({ path: file });
  return file;
}

// In-page helper source: fast-forward the game n frames while letting promises settle.
// Injecting it pauses the real-time loop, so only __ff advances the game (deterministic).
export const PAGE_HELPERS = `
window.__game.paused = true;
window.__ff = async function (n) {
  const g = window.__game;
  for (let i = 0; i < n; i++) {
    g.update();
    for (let k = 0; k < 8; k++) await Promise.resolve();
  }
  g.render();
};
window.__settle = async function (max = 4000) {
  const g = window.__game;
  let i = 0;
  while (i < max) {
    await window.__ff(10);
    i += 10;
    if (g.busy === 0 && g.top === g.map && g.fade === 0) { await window.__ff(5); if (g.busy === 0 && g.top === g.map) return i; }
  }
  return -1;
};
`;
