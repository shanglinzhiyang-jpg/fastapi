// Boot: load assets & content, then show the title screen.
//
// URL parameters (for development / tests):
//   ?test=1                         skip the title with a fresh save (no intro)
//   ?test=1&place=nhk&room=lobby    start inside a place (x, y, dir optional)
//   ?minigame=quiz&difficulty=3     play one minigame repeatedly
//   ?rich=1                         lots of money / fame / skills (with test=1)
//   ?debug=1                        adds a debug entry to the pause menu

import { Game } from './engine/game.js';
import { loadLogos } from './engine/logos.js';
import { loadAll } from './registry.js';
import { newState, loadGame, hasSave, deleteSave, AGENCIES } from './engine/state.js';
import { PLACES } from './engine/map.js';
import { MINIGAMES } from './engine/minigame.js';
import { TitleScene, CreateScene } from './title.js';
import { W, H } from './engine/util.js';
import { text, COLORS } from './engine/draw.js';
import { audio } from './engine/audio.js';
import * as ui from './engine/ui.js';
import { TILES } from './engine/tiles.js';

const params = new URLSearchParams(location.search);

function loadingScene(msg) {
  return { opaque: true, update() {}, draw(ctx) { ctx.fillStyle = '#0b0d1a'; ctx.fillRect(0, 0, W, H); text(ctx, msg, W / 2, H / 2 - 6, { align: 'center', color: '#fff' }); } };
}

function richState(st) {
  st.money = 999999;
  st.fame = 1500;
  st.skills = { warai: 60, engi: 60, uta: 60, talk: 60 };
  st.items = { drink: 5, bento: 3, nodoame: 2 };
  return st;
}

async function newGame(g) {
  const res = await new Promise((r) => g.push(new CreateScene(g, r)));
  g.state = newState(res.name, res.look);
  await g.goto('home', 'room', 4, 6, 'up');
}

async function titleFlow(g) {
  for (;;) {
    g.setBase(new TitleScene(g, () => {}));
    const choice = await new Promise((r) => { g.scenes[0].resolve = r; });
    if (choice === 'continue') {
      const data = loadGame();
      if (data && data.location && PLACES[data.location.place]) {
        g.state = data.state;
        const L = data.location;
        await g.goto(L.place, L.room, L.x, L.y, L.dir || 'down');
        g.notify('つづきから再開しました', { color: '#fff' });
        return;
      }
      await g.say('セーブデータを読み込めませんでした。');
      continue;
    }
    if (hasSave()) {
      g.setBase(loadingScene(''));
      const i = await g.ask('セーブデータがあります。\nはじめから遊ぶと上書きされます。いいですか？', ['はじめから遊ぶ', 'もどる'], { cancel: 1 });
      if (i !== 0) continue;
      deleteSave();
    }
    await newGame(g);
    return;
  }
}

async function minigameLab(g, id) {
  g.state = newState('テスト');
  g.setBase(loadingScene(''));
  for (;;) {
    const res = await g.minigame(id, { difficulty: +(params.get('difficulty') || 1), skill: params.get('skill') || undefined });
    window.__lastResult = res;
    await g.say(`結果：${JSON.stringify(res)}\nもう一度あそびます。`);
  }
}

async function debugMenu(g) {
  const ids = Object.keys(PLACES);
  const i = await g.list({ title: 'デバッグ', items: ['場所へワープ', 'お金+10万', '知名度+500', 'スキル+20', '体力全快', '所属を変える'], x: 8, y: 8, w: 160 });
  const st = g.state;
  if (i === 0) {
    const j = await g.list({ title: 'ワープ先', items: ids, x: 8, y: 8, w: 200 });
    if (j >= 0) await g.enterPlace(ids[j]);
  } else if (i === 1) g.addMoney(100000);
  else if (i === 2) g.addFame(500);
  else if (i === 3) for (const k of Object.keys(st.skills)) g.addSkill(k, 20);
  else if (i === 4) st.stamina = st.maxStamina;
  else if (i === 5) {
    const ag = [null, ...Object.keys(AGENCIES)];
    const j = await g.list({ title: '所属', items: ag.map((a) => (a ? AGENCIES[a].name : 'フリー')), x: 8, y: 8, w: 200 });
    if (j >= 0) st.agency = ag[j];
  }
}

async function boot() {
  const canvas = document.getElementById('game');
  if (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || params.has('touch')) document.body.classList.add('touch');
  const g = new Game(canvas);
  window.__game = g;
  g.PLACES = PLACES;
  g.MINIGAMES = MINIGAMES;
  g.TILES = TILES;
  g.newState = newState;
  g.input.bindTouch({
    dpad: document.getElementById('dpad'),
    buttons: Array.from(document.querySelectorAll('#pad button')),
    screen: canvas,
  });
  g.setBase(loadingScene('よみこみ中…'));
  g.start();
  try {
    await Promise.race([document.fonts.load('12px "DotGothic16"'), new Promise((r) => setTimeout(r, 5000))]);
  } catch (e) { /* font optional */ }
  setTimeout(() => g.resize(), 50);
  await loadLogos();
  g.failedModules = await loadAll();

  if (params.has('debug')) {
    const orig = ui.openMenu;
    g.debugMenu = () => debugMenu(g);
  }

  g.ready = true;
  const mg = params.get('minigame');
  if (mg) {
    if (!MINIGAMES[mg]) console.error('unknown minigame', mg);
    minigameLab(g, mg);
    return;
  }
  if (params.has('test')) {
    g.state = newState(params.get('name') || 'テスト', { hair: 'spiky', hairColor: 'brown', top: '#d64161', bottom: '#3a4a7a' });
    if (!params.has('intro')) g.state.flags.intro = true;
    if (params.has('rich')) richState(g.state);
    if (params.get('agency')) g.state.agency = params.get('agency');
    const place = params.get('place') || 'tokyo';
    const p = PLACES[place];
    if (!p) { console.error('unknown place', place); return; }
    const room = params.get('room') || p.start.room;
    const x = params.has('x') ? +params.get('x') : (room === p.start.room ? p.start.x : undefined);
    const y = params.has('y') ? +params.get('y') : (room === p.start.room ? p.start.y : undefined);
    await g.goto(place, room, x, y, params.get('dir') || p.start.dir || 'down', { fade: false });
    return;
  }
  await titleFlow(g);
}

boot().catch((e) => console.error(e));
