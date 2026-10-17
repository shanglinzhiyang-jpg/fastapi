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
import { TitleScene, CreateScene, drawTitleBackdrop } from './title.js';
import { SW, SH, hash2 } from './engine/util.js';
import { text, panel, measure, COLORS } from './engine/draw.js';
import { audio } from './engine/audio.js';
import * as ui from './engine/ui.js';
import { TILES } from './engine/tiles.js';

const params = new URLSearchParams(location.search);

// Plain HD backdrop with an optional message: 'よみこみ中…' at boot (with bouncing
// dots), an empty base under dialogs, or an error ({ error: true, detail }).
// opts.title: the dimmed title backdrop instead of the starfield (title-flow dialogs).
function loadingScene(msg, opts = {}) {
  return {
    opaque: true,
    hd: true,
    t: 0,
    update() { this.t++; },
    draw(ctx) {
      const t = this.t;
      let drawn = false;
      if (opts.title) {
        try { drawTitleBackdrop(ctx, t + 500); drawn = true; } catch (e) { drawn = false; }
      }
      if (!drawn) {
        ctx.fillStyle = '#0b0d1a';
        ctx.fillRect(0, 0, SW, SH);
        for (let i = 0; i < 60; i++) {
          if ((i * 7 + Math.floor(t / 12)) % 17 === 0) continue;
          ctx.fillStyle = i % 5 ? '#2a3366' : '#5a64a8';
          ctx.fillRect(Math.floor(hash2(i, 1, 9) * SW), Math.floor(hash2(i, 2, 9) * SH), 1, 1);
        }
      }
      if (!msg) return;
      if (opts.error) {
        const lines = [msg, opts.detail].filter(Boolean);
        const w = Math.min(SW - 40, 64 + Math.max(...lines.map((l, i) => measure(ctx, l, i ? 13 : 16))));
        const h = 34 + lines.length * 24;
        panel(ctx, Math.round((SW - w) / 2), Math.round((SH - h) / 2), w, h, { bg: '#3a1424' });
        lines.forEach((l, i) => text(ctx, l, SW / 2, (SH - h) / 2 + 17 + i * 24, { size: i ? 13 : 16, align: 'center', color: i ? '#f0c8d0' : COLORS.bad }));
        return;
      }
      text(ctx, msg, SW / 2, SH / 2 - 14, { size: 16, align: 'center', color: '#ffffff' });
      for (let i = 0; i < 3; i++) {
        const hop = Math.floor(t / 8 + 6 - i * 2) % 6 === 0 ? 3 : 0;
        ctx.fillStyle = [COLORS.pink, COLORS.accent, COLORS.cyan][i];
        ctx.fillRect(SW / 2 - 14 + i * 12, SH / 2 + 14 - hop, 4, 4);
      }
    },
  };
}

function showBootError(g, msg, detail) {
  try { if (g) g.setBase(loadingScene(msg, { error: true, detail })); } catch (e) { /* nothing left to show it with */ }
}

function richState(st) {
  st.money = 999999;
  st.fame = 2500;
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
      g.setBase(loadingScene('', { title: true }));
      await g.say('セーブデータを読み込めませんでした。');
      continue;
    }
    if (hasSave()) {
      g.setBase(loadingScene('', { title: true }));
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

// Touch devices: block what CSS (touch-action / user-select) cannot. iOS Safari
// ignores user-scalable=no, so cancel its pinch gestures and multi-finger moves
// (pointer events for the pad still fire), and long-press menus on the pad.
// Desktop (no body.touch) keeps trackpad / browser zoom.
function guardTouch() {
  const touch = () => document.body.classList.contains('touch');
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => { if (touch()) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && e.cancelable && touch()) e.preventDefault(); }, { passive: false });
  document.getElementById('pad').addEventListener('contextmenu', (e) => e.preventDefault());
}

// Small fullscreen toggle on the pad (CSS shows it only with body.fs-ok, and
// the pad itself only on touch devices). Skipped where the API is missing
// (e.g. iPhone Safari).
function setupFullscreen(g) {
  const btn = document.getElementById('fs');
  const root = document.documentElement;
  const canRequest = root.requestFullscreen || root.webkitRequestFullscreen;
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (!btn || !canRequest || !exit || !(document.fullscreenEnabled || document.webkitFullscreenEnabled)) return;
  const current = () => document.fullscreenElement || document.webkitFullscreenElement;
  const sync = () => {
    const on = !!current();
    document.body.classList.toggle('fullscreen', on);
    btn.setAttribute('aria-label', on ? '全画面を終了' : '全画面');
    btn.setAttribute('aria-pressed', String(on));
  };
  btn.addEventListener('pointerdown', (e) => e.preventDefault()); // no focus, no text selection
  btn.addEventListener('click', () => {
    btn.blur();
    try {
      const p = current() ? exit.call(document)
        : root.requestFullscreen ? root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* refused: stay as is */ }
  });
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
    document.addEventListener(ev, () => { sync(); g.resize(); setTimeout(() => g.resize(), 250); });
  }
  sync();
  document.body.classList.add('fs-ok');
}

// Portrait phones: a hint to turn the phone (CSS shows it), dismissed by a tap for
// the rest of the session.
function setupRotateHint(g) {
  const el = document.getElementById('rotate');
  if (!el) return;
  let off = false;
  try { off = sessionStorage.getItem('dotgeinou_rotate_off') === '1'; } catch (e) { off = false; }
  const hide = () => {
    document.body.classList.add('rotate-off');
    try { sessionStorage.setItem('dotgeinou_rotate_off', '1'); } catch (e) { /* private mode */ }
    g.resize();
    setTimeout(() => g.resize(), 50);
  };
  if (off) document.body.classList.add('rotate-off');
  el.addEventListener('click', hide);
  // turning the phone counts as having read it
  window.addEventListener('orientationchange', () => setTimeout(() => { if (window.matchMedia('(orientation: landscape)').matches) hide(); }, 300));
}

async function boot() {
  const canvas = document.getElementById('game');
  // On-screen pad: phones/tablets (coarse primary pointer) get it from the start.
  // Touchscreen laptops get it on their first touch and lose it again on a key press.
  const coarse = window.matchMedia('(pointer: coarse)').matches || params.has('touch');
  if (coarse) document.body.classList.add('touch');
  const g = new Game(canvas);
  if (!coarse) {
    const setTouch = (on) => {
      if (document.body.classList.contains('touch') === on) return;
      document.body.classList.toggle('touch', on);
      g.resize();
    };
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setTouch(true); }, true);
    window.addEventListener('keydown', () => setTouch(false), true);
  }
  window.__game = g;
  g.PLACES = PLACES;
  g.MINIGAMES = MINIGAMES;
  g.TILES = TILES;
  g.newState = newState;
  g.input.bindTouch({
    dpad: document.getElementById('dpad'),
    buttons: Array.from(document.querySelectorAll('#pad button[data-k]')),
    screen: canvas,
  });
  guardTouch();
  setupFullscreen(g);
  setupRotateHint(g);
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
    if (!p) { console.error('unknown place', place); showBootError(g, `場所「${place}」が見つかりません`, 'URLの place= を確かめてください'); return; }
    const room = params.get('room') || p.start.room;
    const x = params.has('x') ? +params.get('x') : (room === p.start.room ? p.start.x : undefined);
    const y = params.has('y') ? +params.get('y') : (room === p.start.room ? p.start.y : undefined);
    await g.goto(place, room, x, y, params.get('dir') || p.start.dir || 'down', { fade: false });
    return;
  }
  await titleFlow(g);
}

boot().catch((e) => {
  console.error(e);
  showBootError(window.__game, 'ゲームを読み込めませんでした…', 'ページを再読み込みしてください');
});
