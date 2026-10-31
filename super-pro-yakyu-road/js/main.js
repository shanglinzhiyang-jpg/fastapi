// スーパープロ野球ロード — boot: the engine, the title. Test helpers on window (window.__spr): the engine, __ff(n) to run
// n steps without waiting (the real-time loop keeps going unless __pause() is called).
import { Engine } from './core.js';
import { World } from './gfx/world.js';
import { Title } from './scenes/pennant.js';
import * as league from './league.js';
import * as game from './game.js';
import * as data from './data.js';

const g = new Engine(document.getElementById('game'));
// the 3D world (WebGL); without it (or with ?no3d=1) the game falls back to the 2D pictures
if (!/[?&]no3d=1/.test(location.search)) {
  try { g.world = new World(document.getElementById('gl')); g.resize(); } catch (e) { console.warn('3D off:', e && e.message); g.world = null; }
}
g.push(new Title(g));
g.start();
if (typeof window !== 'undefined') {
  window.__spr = { g, league, game, data };
  window.__ff = async (n = 1) => { for (let i = 0; i < n; i++) g.step(); g.render(); };
  window.__pause = (on = true) => { g.paused = on; };
}
