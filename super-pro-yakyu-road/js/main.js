// スーパープロ野球ロード — boot: the engine, the title. Test helpers on window (window.__spr): the engine, __ff(n) to run
// n steps without waiting (the real-time loop keeps going unless __pause() is called).
import { Engine } from './core.js';
import { Title } from './scenes/pennant.js';
import * as league from './league.js';
import * as game from './game.js';
import * as data from './data.js';

const g = new Engine(document.getElementById('game'));
g.push(new Title(g));
g.start();
if (typeof window !== 'undefined') {
  window.__spr = { g, league, game, data };
  window.__ff = async (n = 1) => { for (let i = 0; i < n; i++) g.step(); g.render(); };
  window.__pause = (on = true) => { g.paused = on; };
}
