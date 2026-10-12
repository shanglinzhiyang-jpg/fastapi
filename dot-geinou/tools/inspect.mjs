#!/usr/bin/env node
// Inspect one place end-to-end in a headless browser.
//
//   node tools/inspect.mjs <placeId> [--out DIR] [--agency yoshimoto] [--quick]
//
// For every room it: screenshots the room, checks reachability of warps and
// interactables from the arrival points, talks to every NPC / sign / action
// event with the autopilot (exploring different first choices), steps on every
// warp, and reports console errors, scripts that never finish, unreachable
// things and the full dialogue log (DIR/<place>_dialog.txt).
//
// Requires a static server for the game (default http://localhost:8765/):
//   python3 -m http.server 8765 --directory dot-geinou

import fs from 'node:fs';
import path from 'node:path';
import { openGame, shotCanvas, PAGE_HELPERS } from './lib.mjs';

const args = process.argv.slice(2);
const pid = args[0];
if (!pid) { console.error('usage: inspect.mjs <placeId> [--out DIR] [--agency ID] [--quick]'); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = opt('--out', 'test-output');
const AGENCY = opt('--agency', '');
const QUICK = args.includes('--quick');
fs.mkdirSync(OUT, { recursive: true });

const report = { place: pid, modes: [], errors: [], issues: [], screenshots: [] };
const dialog = [];

async function runMode(mode) {
  const q = `?test=1&place=${pid}` + (mode.rich ? '&rich=1' : '') + (mode.agency ? `&agency=${mode.agency}` : '');
  const { browser, page, errors } = await openGame(q);
  await page.addScriptTag({ content: PAGE_HELPERS });
  const errStart = () => errors.length;
  const errSince = (n) => errors.slice(n);

  const rooms = await page.evaluate((pid) => {
    const p = window.__game.PLACES[pid];
    return p ? Object.keys(p.rooms) : null;
  }, pid);
  if (!rooms) {
    report.issues.push(`[${mode.name}] place "${pid}" is not registered`);
    report.errors.push(...errors);
    await browser.close();
    return;
  }

  for (const roomId of rooms) {
    let e0 = errStart();
    const info = await page.evaluate(async ({ pid, roomId }) => {
      const g = window.__game;
      const enterLog = [];
      g.auto = { log: enterLog, score: 70, choice: 0 };
      await g.goto(pid, roomId, undefined, undefined, 'down', { fade: false });
      window.__freeze = () => { for (const e of g.map.entities) if (e.type === 'npc' && e.wander) e.wander = 0; };
      window.__freeze();
      await window.__settle(4000);
      g.auto = null;
      const m = g.map;
      const place = g.PLACES[pid];
      // arrival points
      const arrivals = [];
      if (place.start.room === roomId) arrivals.push([place.start.x, place.start.y]);
      for (const r of Object.keys(place.rooms)) {
        let built;
        try { built = m.room.id === r ? m.room : null; } catch (e) { built = null; }
        const def = place.rooms[r];
        const warps = (def._built ? def._built.warps : def.warps) || [];
        for (const w of warps) if (w.room === roomId && !w.place) arrivals.push([w.tx, w.ty]);
      }
      if (!arrivals.length) arrivals.push([m.player.x, m.player.y]);
      const W = m.room.w, H = m.room.h;
      const key = (x, y) => x + ',' + y;
      const isWarp = (x, y) => m.room.warps.some((w) => w.x === x && w.y === y);
      const seen = new Set();
      const q = [];
      const badArrivals = [];
      for (const [x, y] of arrivals) {
        if (m.blocked(x, y, null)) badArrivals.push([x, y]);
        seen.add(key(x, y)); q.push([x, y]);
      }
      while (q.length) {
        const [x, y] = q.shift();
        if (isWarp(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(key(nx, ny))) continue;
          if (m.blocked(nx, ny, null)) continue;
          seen.add(key(nx, ny)); q.push([nx, ny]);
        }
      }
      const reachable = (x, y) => seen.has(key(x, y));
      const DIR = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' };
      const standFor = (cells) => {
        for (const [tx, ty] of cells) {
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const sx = tx + dx, sy = ty + dy;
            if (reachable(sx, sy) && !isWarp(sx, sy)) return { x: sx, y: sy, dir: DIR[`${-dx},${-dy}`] };
            // across a talk-through counter
            const mx = tx + dx, my = ty + dy, fx = tx + 2 * dx, fy = ty + 2 * dy;
            const top = m.topTile(mx, my);
            if (top && g.TILES[top] && g.TILES[top].talkThrough && reachable(fx, fy)) return { x: fx, y: fy, dir: DIR[`${-dx},${-dy}`] };
          }
        }
        return null;
      };
      const targets = [];
      m.entities.forEach((e, i) => {
        if (!m.visible(e)) return;
        const hasTalk = e.type === 'npc' || e.talk || e.text;
        if (!hasTalk || e.type === 'building') return;
        const cells = [];
        const w = Math.ceil(e.w || 1), h = Math.ceil(e.h || 1);
        for (let yy = Math.floor(e.y); yy < Math.floor(e.y) + h; yy++) for (let xx = Math.floor(e.x); xx < Math.floor(e.x) + w; xx++) cells.push([xx, yy]);
        targets.push({ kind: 'entity', idx: i, label: `${e.type}:${e.id || e.name || ''}@${e.x},${e.y}`, stand: standFor(cells) });
      });
      m.room.events.forEach((ev, i) => {
        const cells = [];
        for (let yy = ev.y; yy < ev.y + (ev.h || 1); yy++) for (let xx = ev.x; xx < ev.x + (ev.w || 1); xx++) cells.push([xx, yy]);
        if ((ev.on || 'action') === 'action') targets.push({ kind: 'event', idx: i, label: `event:action@${ev.x},${ev.y}`, stand: standFor(cells) });
        else targets.push({ kind: 'step', idx: i, label: `event:step@${ev.x},${ev.y}`, stand: cells.find(([x, y]) => reachable(x, y)) ? { x: cells.find(([x, y]) => reachable(x, y))[0], y: cells.find(([x, y]) => reachable(x, y))[1], dir: 'down' } : null });
      });
      const warps = m.room.warps.map((w, i) => ({ idx: i, label: `warp@${w.x},${w.y}->${w.to || (w.place || '') + '/' + (w.room || '')}`, reachable: reachable(w.x, w.y), x: w.x, y: w.y }));
      return { w: W, h: H, arrivals, badArrivals, targets, warps, reachableCount: seen.size, enterLog };
    }, { pid, roomId });

    if (mode.shots) report.screenshots.push(await shotCanvas(page, path.join(OUT, `${pid}_${roomId}.png`)));
    for (const e of errSince(e0)) report.errors.push(`[${mode.name}] room ${roomId} load: ${e}`);
    if (info.enterLog.length) {
      dialog.push(`### [${mode.name}] ${roomId} (on enter)`);
      for (const l of info.enterLog) dialog.push(`${l.name ? l.name + '：' : ''}${l.text}${l.choices ? '  [' + l.choices.join(' / ') + ']' : ''}`);
      dialog.push('');
    }
    for (const a of info.badArrivals) report.issues.push(`[${mode.name}] ${roomId}: arrival point ${a} is blocked`);
    for (const w of info.warps) if (!w.reachable) report.issues.push(`[${mode.name}] ${roomId}: ${w.label} is not reachable`);
    for (const t of info.targets) if (!t.stand) report.issues.push(`[${mode.name}] ${roomId}: ${t.label} cannot be reached/talked to`);

    // ---- interactions
    for (const t of info.targets) {
      if (!t.stand) continue;
      const firstChoices = [0, 1, 2, 3, 4];
      let repeated = false;
      for (let fi = 0; fi < (QUICK ? 1 : firstChoices.length); fi++) {
        const first = firstChoices[fi];
        e0 = errStart();
        const res = await page.evaluate(async ({ pid, roomId, t, first }) => {
          const g = window.__game;
          let asks = 0;
          let firstN = 0;
          const log = [];
          g.auto = {
            log,
            score: 70,
            choice: (choices) => {
              asks++;
              if (asks === 1) { firstN = choices.length; return first; }
              if (asks < 5) return 0;
              return choices.length - 1;
            },
          };
          if (g.map.placeId !== pid || g.map.roomId !== roomId) { await g.goto(pid, roomId, undefined, undefined, 'down', { fade: false }); window.__freeze(); }
          g.state.stamina = g.state.maxStamina;
          const m = g.map;
          const p = m.player;
          Object.assign(p, { x: t.stand.x, y: t.stand.y, px: t.stand.x * 16, py: t.stand.y * 16, dir: t.stand.dir, moving: false, path: [], pathDone: null });
          if (t.kind === 'step') {
            m.onStep();
          } else if (t.kind === 'event') {
            const ev = m.room.events[t.idx];
            g.run(async () => { await ev.run(g, ev); });
          } else {
            m.interact();
          }
          const frames = await window.__settle(9000);
          const where = g.map.placeId + '/' + g.map.roomId;
          g.auto = null;
          return { frames, log, firstN, where, asks };
        }, { pid, roomId, t, first });
        const errs = errSince(e0);
        for (const e of errs) report.errors.push(`[${mode.name}] ${roomId} ${t.label} (first choice ${first}): ${e}`);
        if (res.frames < 0) report.issues.push(`[${mode.name}] ${roomId} ${t.label} (first choice ${first}): script did not finish within 9000 frames`);
        dialog.push(`### [${mode.name}] ${roomId} ${t.label} (first choice ${first}) -> ended in ${res.where}`);
        for (const l of res.log) dialog.push(`${l.name ? l.name + '：' : ''}${l.text}${l.choices ? '  [' + l.choices.join(' / ') + ']' : ''}`);
        dialog.push('');
        if (res.where !== `${pid}/${roomId}`) {
          await page.evaluate(async ({ pid, roomId }) => { const g = window.__game; await g.goto(pid, roomId, undefined, undefined, 'down', { fade: false }); await window.__settle(2000); }, { pid, roomId });
        }
        // a one-time intro with no question: talk again so later menus get explored
        if (res.asks === 0 && !repeated && !QUICK) { repeated = true; fi--; continue; }
        if (first + 1 >= Math.max(1, res.firstN)) break;
      }
    }

    // ---- warps
    for (const w of info.warps) {
      e0 = errStart();
      const res = await page.evaluate(async ({ pid, roomId, w }) => {
        const g = window.__game;
        const log = [];
        g.auto = { score: 70, log, choice: 0 };
        if (g.map.placeId !== pid || g.map.roomId !== roomId) await g.goto(pid, roomId, undefined, undefined, 'down', { fade: false });
        const m = g.map;
        const p = m.player;
        Object.assign(p, { x: w.x, y: w.y, px: w.x * 16, py: w.y * 16, moving: false, path: [], pathDone: null });
        m.onStep();
        const frames = await window.__settle(3000);
        const where = g.map.placeId + '/' + g.map.roomId + '@' + g.map.player.x + ',' + g.map.player.y;
        const blockedArrival = g.map.blocked(g.map.player.x, g.map.player.y, null);
        g.auto = null;
        await g.goto(pid, roomId, undefined, undefined, 'down', { fade: false });
        window.__freeze();
        await window.__settle(1000);
        return { frames, where, blockedArrival, log };
      }, { pid, roomId, w });
      for (const e of errSince(e0)) report.errors.push(`[${mode.name}] ${roomId} ${w.label}: ${e}`);
      if (res.frames < 0) report.issues.push(`[${mode.name}] ${roomId} ${w.label}: did not settle`);
      if (res.blockedArrival) report.issues.push(`[${mode.name}] ${roomId} ${w.label}: arrives on a blocked tile (${res.where})`);
      report.modes.push({ mode: mode.name, room: roomId, warp: w.label, to: res.where });
      if (res.log.length) {
        dialog.push(`### [${mode.name}] ${roomId} ${w.label} -> ${res.where}`);
        for (const l of res.log) dialog.push(`${l.name ? l.name + '：' : ''}${l.text}${l.choices ? '  [' + l.choices.join(' / ') + ']' : ''}`);
        dialog.push('');
      }
    }
  }
  report.errors.push(...errors.filter((e) => !report.errors.some((r) => r.endsWith(e))).map((e) => `[${mode.name}] ${e}`));
  await browser.close();
}

const modes = [{ name: 'fresh', rich: false, shots: true }];
if (!QUICK) modes.push({ name: 'rich', rich: true, agency: AGENCY || undefined, shots: false });
for (const m of modes) await runMode(m);

const uniq = (a) => [...new Set(a)];
report.errors = uniq(report.errors);
report.issues = uniq(report.issues);
fs.writeFileSync(path.join(OUT, `${pid}_report.json`), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, `${pid}_dialog.txt`), dialog.join('\n'));
console.log(`== inspect ${pid} ==`);
console.log(`screenshots: ${report.screenshots.join(', ')}`);
console.log(`dialogue log: ${path.join(OUT, `${pid}_dialog.txt`)}`);
console.log(`errors (${report.errors.length}):`);
for (const e of report.errors.slice(0, 60)) console.log('  ' + e.split('\n')[0]);
console.log(`issues (${report.issues.length}):`);
for (const e of report.issues.slice(0, 60)) console.log('  ' + e);
process.exit(report.errors.length ? 1 : 0);
