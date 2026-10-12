// Map exploration scene: tile maps, the player, NPCs, doors and events.
//
// A *place* (building / town) is registered with registerPlace(def):
//
// {
//   id: 'nhk', name: 'NHK放送センター', kind: 'town' | 'building',
//   bgm: 'studio',                    // default BGM for its rooms
//   start: { room: 'lobby', x, y, dir: 'up' },   // where you appear when entering
//   legend: { ... },                  // shared legend for all rooms (optional)
//   rooms: {
//     lobby: {
//       floor: 'floor_marble', wall: 'white',     // used by the default legend
//       tiles: [ '#########', '=========', '...', ... ],   // one char per tile
//       legend: { C: 'counter', P: 'plant' },     // char -> tile id or 'a+b' stack
//       entities: [ ... ], warps: [ ... ], events: [ ... ],
//       onEnter: async (g) => {}, bgm, bg, drawUnder(ctx,g,cam), drawOver(ctx,g,cam)
//     },
//   },
// }
//
// Default legend: '.' floor, '#' wall top, '=' wall face, 'w' window, 'p' poster,
// 'c' clock, 'M' exit mat, 'd' wooden door, 'g' glass door, ' ' void.
//
// entities:
//   { type:'npc', id, x, y, dir, look, name, text: '...'|[...], talk: async (g, npc) => {}, wander: radius, cond: g => bool }
//   { type:'sign', x, y, text|talk }                       (invisible interaction point)
//   { type:'prop', x, y, w, h, solid, draw(ctx, sx, sy, g, e), text|talk }
//   { type:'logo', x, y, w, h, logo, board, text|talk }    (x/y/w/h in tiles, may be fractional)
//   { type:'building', ... }                               (towns, see buildings.js)
// warps:  { x, y, to: 'exit' }  |  { x, y, room, tx, ty, dir }  |  { x, y, place, room, tx, ty, dir }
//         optional: check: async g => bool (false = walk back), sfx
// events: { x, y, w, h, on: 'step'|'action', run: async g => {}, once: 'flagName', cond }

import { TILE, W, H, DIRS, OPP, clamp, hash2 } from './util.js';
import { TILES, tileImage } from './tiles.js';
import { charSheet, drawChar, drawShadow } from './sprites.js';
import { drawBuilding } from './buildings.js';
import { drawLogo } from './logos.js';
import { audio } from './audio.js';
import { drawHud, drawToasts, drawBanner, openMenu } from './ui.js';
import { text, panel } from './draw.js';

export const PLACES = {};
export function registerPlace(def) {
  if (!def || !def.id) throw new Error('registerPlace: missing id');
  PLACES[def.id] = def;
}

const DEFAULT_LEGEND = {
  ' ': 'void',
  M: 'exit_mat',
  d: 'door_wood',
  g: 'door_glass',
};

function legendFor(place, def) {
  const wall = def.wall || place.wall || 'white';
  const floor = def.floor || place.floor || 'floor_wood';
  return {
    ...DEFAULT_LEGEND,
    '.': floor,
    '#': 'walltop_' + wall,
    '=': 'wall_' + wall,
    w: 'wall_' + wall + '+window',
    p: 'wall_' + wall + '+poster',
    c: 'wall_' + wall + '+clock',
    ...(place.legend || {}),
    ...(def.legend || {}),
  };
}

function toLayers(v, floor) {
  let layers = Array.isArray(v) ? v.slice() : String(v).split('+');
  if (layers.length && TILES[layers[0]] && TILES[layers[0]].obj) layers.unshift(floor);
  return layers;
}

export function buildRoom(place, roomId) {
  const def = place.rooms && place.rooms[roomId];
  if (!def) throw new Error(`room "${place.id}/${roomId}" not found`);
  if (def._built) return def._built;
  const floor = def.floor || place.floor || 'floor_wood';
  let w, h, cells;
  let entities = (def.entities || []).slice();
  let warps = (def.warps || []).slice();
  let events = (def.events || []).slice();
  if (def.generate) {
    const gen = def.generate();
    w = gen.w; h = gen.h;
    cells = gen.cells.map((row) => row.map((v) => toLayers(v, floor)));
    entities = entities.concat(gen.entities || []);
    warps = warps.concat(gen.warps || []);
    events = events.concat(gen.events || []);
  } else {
    const legend = legendFor(place, def);
    const rows = def.tiles.map((r) => Array.from(r));
    h = rows.length;
    w = Math.max(...rows.map((r) => r.length));
    cells = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x] ?? ' ';
        const v = legend[ch];
        if (v == null) {
          console.error(`[map] ${place.id}/${roomId}: unknown legend char "${ch}" at ${x},${y}`);
          row.push(['missing']);
        } else row.push(toLayers(v, floor));
      }
      cells.push(row);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (const id of cells[y][x]) if (!TILES[id]) console.error(`[map] ${place.id}/${roomId}: unknown tile "${id}" at ${x},${y}`);
    }
  }
  def._built = { id: roomId, w, h, cells, entities, warps, events, def };
  return def._built;
}

// A sensible spawn point for a room when none is given:
// room.entry, else next to the first warp, else the first walkable tile.
export function entryFor(place, roomId) {
  const room = buildRoom(place, roomId);
  if (room.def.entry) return room.def.entry;
  const solid = (x, y) => x < 0 || y < 0 || x >= room.w || y >= room.h || room.cells[y][x].some((id) => TILES[id] && TILES[id].solid);
  const isWarp = (x, y) => room.warps.some((w) => w.x === x && w.y === y);
  for (const w of room.warps) {
    for (const [dx, dy, dir] of [[0, -1, 'up'], [0, 1, 'down'], [1, 0, 'right'], [-1, 0, 'left']]) {
      if (!solid(w.x + dx, w.y + dy) && !isWarp(w.x + dx, w.y + dy)) return { x: w.x + dx, y: w.y + dy, dir };
    }
  }
  for (let y = room.h - 1; y >= 0; y--) for (let x = 0; x < room.w; x++) if (!solid(x, y)) return { x, y, dir: 'up' };
  return { x: 0, y: 0, dir: 'down' };
}

// placeId -> { town, room, x, y } (the tile right in front of the building's door)
let doorIndex = null;
export function doorIndexFor(placeId) {
  if (!doorIndex) {
    doorIndex = {};
    for (const p of Object.values(PLACES)) {
      if (p.kind !== 'town') continue;
      for (const roomId of Object.keys(p.rooms)) {
        const room = buildRoom(p, roomId);
        for (const e of room.entities) {
          if (e.type === 'building' && e.place) {
            const dx = e.door ?? Math.floor(e.w / 2);
            doorIndex[e.place] = { town: p.id, room: roomId, x: e.x + dx, y: e.y + e.h };
          }
        }
      }
    }
  }
  return doorIndex[placeId];
}

function buildingDoors(b) {
  if (b.doors) return b.doors;
  const d = b.door ?? Math.floor(b.w / 2);
  if (b.kind === 'theater' || b.kind === 'station') return [d - 1, d, d + 1];
  return [d];
}

const TILE_TEXT = {
  bookshelf: '本がぎっしり並んでいる。芸能界の歴史の本もあるぞ。',
  tv: 'テレビでバラエティ番組をやっている。いつか自分も出てみたい！',
  tv_wall: 'モニターに番組が映っている。',
  monitor: 'たくさんのモニターに、いろんな映像が映っている。',
  poster: 'ポスターが貼ってある。人気タレントの笑顔がまぶしい。',
  poster_wide: '番組の告知ポスターだ。',
  window: '窓の外には街並みが広がっている。',
  plant: '観葉植物だ。よく手入れされている。',
  trash: 'ゴミはゴミ箱へ。マナーは大事。',
  mailbox: 'ポストだ。実家に手紙を書こうかな。',
  clock: '時計がチクタク動いている。',
  whiteboard: 'ホワイトボードにスケジュールがびっしり書かれている。',
  mirror: '鏡にうつる自分…なかなかイケてる！',
  camera: '大きなテレビカメラだ。勝手に触らないでおこう。',
  mic: 'スタンドマイクだ。「あー、あー、マイクテスト」',
  spotlight: 'まぶしいライトだ。',
  piano: 'ピアノだ。ポロン♪',
  trophy: 'トロフィーがずらりと並んでいる。',
  fridge: '冷蔵庫だ。中は…ほぼ空っぽ。',
  locker: 'ロッカーだ。鍵がかかっている。',
  painting: '立派な絵が飾られている。',
  onair: '「ON AIR」のランプ。本番中は静かに！',
  exit_sign: '非常口のマーク。いざという時はここから。',
  sign_board: '立て看板だ。',
  nobori: 'のぼりがはためいている。',
  boxes: '段ボールが積まれている。',
  box: '段ボール箱だ。',
  water_server: 'ウォーターサーバーだ。ごくごく…おいしい！',
  clothes_rack: '衣装がたくさん掛かっている。',
  makeup: 'メイク道具が並んでいる。',
  curtain: '重たそうな幕だ。',
  seat: '客席だ。ここからステージを見るとワクワクする。',
  shelf_goods: 'おにぎりやお菓子が並んでいる。買い物はレジでどうぞ。',
  fridge_drinks: '冷たい飲み物がずらり。買い物はレジでどうぞ。',
  magazine: '雑誌が並んでいる。表紙はどれも人気タレントだ。',
  kitchen: 'キッチンだ。',
  bed_top: 'ふかふかのベッドだ。',
  bed_bottom: 'ふかふかのベッドだ。',
  rope: 'ロープで仕切られている。',
  director_chair: '監督のイスだ。座ってみたい…けどやめておこう。',
  lantern: '赤ちょうちんが揺れている。',
  kanban_takoyaki: 'たこ焼きの看板だ。おいしそう！',
  green_screen: '合成用のグリーンバックだ。',
};

export class MapScene {
  constructor(g) {
    this.g = g;
    this.place = null;
    this.room = null;
    this.player = { x: 0, y: 0, px: 0, py: 0, dir: 'down', moving: false, t: 0, tx: 0, ty: 0, speed: 1.6, anim: 0, turnT: 0, wasMoving: false, hidden: false };
    this.cam = { x: 0, y: 0 };
    this.entities = [];
    this.t = 0;
  }

  load(placeId, roomId, x, y, dir = 'down') {
    const place = PLACES[placeId];
    if (!place) throw new Error(`place "${placeId}" not registered`);
    this.place = place;
    this.placeId = placeId;
    this.roomId = roomId;
    this.room = buildRoom(place, roomId);
    this.entities = this.room.entities.map((d) => this.instantiate(d));
    const p = this.player;
    Object.assign(p, { x, y, px: x * TILE, py: y * TILE, dir, moving: false, t: 0, turnT: 0, wasMoving: false, emote: null });
    this.updateCamera(true);
  }

  instantiate(d) {
    const e = { ...d, def: d };
    if (e.type === 'npc') {
      e.px = e.x * TILE; e.py = e.y * TILE;
      e.dir = e.dir || 'down';
      e.home = { x: e.x, y: e.y };
      e.sheet = charSheet(e.look || {});
      e.path = [];
      e.wanderT = 60 + Math.floor(Math.random() * 120);
      e.anim = 0;
      e.moving = false;
      e.speed = e.speed || 1;
      e.face = (dir) => { e.dir = dir; };
    }
    return e;
  }

  visible(e) {
    if (e.hidden) return false;
    if (e.cond) {
      try { return !!e.cond(this.g); } catch (err) { console.error(err); return false; }
    }
    return true;
  }

  // ---------------------------------------------------------------- queries
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.room.w && y < this.room.h; }

  tileSolid(x, y) {
    if (!this.inBounds(x, y)) return true;
    return this.room.cells[y][x].some((id) => TILES[id] && TILES[id].solid);
  }

  topTile(x, y) {
    if (!this.inBounds(x, y)) return null;
    const c = this.room.cells[y][x];
    return c[c.length - 1];
  }

  buildingAt(x, y) {
    for (const e of this.entities) {
      if (e.type !== 'building' || !this.visible(e)) continue;
      if (x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h) return e;
    }
    return null;
  }

  isDoor(b, x, y) {
    return y === b.y + b.h - 1 && buildingDoors(b).some((d) => b.x + d === x);
  }

  blocked(x, y, self = null) {
    if (this.tileSolid(x, y)) return true;
    for (const e of this.entities) {
      if (e === self || !this.visible(e)) continue;
      if (e.type === 'npc') {
        if ((e.x === x && e.y === y) || (e.moving && e.tx === x && e.ty === y)) return true;
      } else if (e.type === 'building') {
        if (x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h && (!(e.place || e.enter) || !this.isDoor(e, x, y))) return true;
      } else if (e.type === 'prop' && e.solid !== false) {
        const w = e.w || 1, h = e.h || 1;
        if (x >= e.x && x < e.x + w && y >= e.y && y < e.y + h) return true;
      } else if (e.type === 'sign' && e.solid) {
        if (e.x === x && e.y === y) return true;
      }
    }
    if (self) {
      const p = this.player;
      if ((p.x === x && p.y === y) || (p.moving && p.tx === x && p.ty === y)) return true;
    }
    return false;
  }

  interactableAt(x, y) {
    for (const e of this.entities) {
      if (!this.visible(e)) continue;
      if (e.type === 'npc' && e.x === x && e.y === y) return e;
    }
    for (const e of this.entities) {
      if (!this.visible(e) || !(e.talk || e.text)) continue;
      if (e.type === 'sign' && e.x === x && e.y === y) return e;
      if (e.type === 'prop' || e.type === 'logo' || e.type === 'building') {
        const w = e.w || 1, h = e.h || 1;
        if (x >= Math.floor(e.x) && x < Math.ceil(e.x + w) && y >= Math.floor(e.y) && y < Math.ceil(e.y + h)) return e;
      }
    }
    return null;
  }

  eventsAt(x, y, kind) {
    return this.room.events.filter((ev) => {
      if ((ev.on || 'action') !== kind) return false;
      const w = ev.w || 1, h = ev.h || 1;
      if (x < ev.x || x >= ev.x + w || y < ev.y || y >= ev.y + h) return false;
      if (ev.once && this.g.flag(ev.once)) return false;
      if (ev.cond && !ev.cond(this.g)) return false;
      return true;
    });
  }

  warpAt(x, y) {
    return this.room.warps.find((w) => w.x === x && w.y === y && (!w.cond || w.cond(this.g)));
  }

  npc(id) { return this.entities.find((e) => e.id === id); }

  // ---------------------------------------------------------------- update
  canControl() {
    const g = this.g;
    return g.busy === 0 && g.top === this && g.fade === 0;
  }

  update(g) {
    this.t++;
    this.updatePlayer(g);
    for (const e of this.entities) if (e.type === 'npc') this.updateNpc(e);
    for (const e of [this.player, ...this.entities]) {
      if (e.emote) { e.emote.t++; if (e.emote.t > e.emote.life) { const r = e.emote.resolve; e.emote = null; if (r) r(); } }
    }
    this.updateCamera();
  }

  updatePlayer(g) {
    const p = this.player;
    const inp = g.input;
    if (p.moving) {
      p.t += p.speed;
      p.anim += p.speed;
      if (p.t >= TILE) {
        p.moving = false;
        p.x = p.tx; p.y = p.ty;
        p.t = 0;
        p.px = p.x * TILE; p.py = p.y * TILE;
        if ((p.path && p.path.length) || p.pathDone) { this.stepPath(p); return; }
        this.onStep();
      } else {
        const [dx, dy] = DIRS[p.dir];
        p.px = (p.x + dx * p.t / TILE) * TILE;
        p.py = (p.y + dy * p.t / TILE) * TILE;
      }
      return;
    }
    if (!this.canControl()) { p.wasMoving = false; return; }
    if (inp.pressed('menu')) { g.run(openMenu); return; }
    if (inp.pressed('a')) { this.interact(); return; }
    const d = inp.dir();
    if (!d) { p.wasMoving = false; p.turnT = 0; return; }
    if (d !== p.dir && !p.wasMoving) { p.dir = d; p.turnT = 5; return; }
    if (p.turnT > 0) { p.turnT--; return; }
    p.dir = d;
    p.speed = inp.down('b') ? 3.2 : 1.6;
    const [dx, dy] = DIRS[d];
    const tx = p.x + dx, ty = p.y + dy;
    if (this.blocked(tx, ty, null)) {
      p.wasMoving = false;
      if (this.t % 20 === 0) audio.sfx('cursor');
      return;
    }
    p.moving = true; p.tx = tx; p.ty = ty; p.t = 0; p.wasMoving = true;
  }

  // Scripted player movement (cutscenes): ignores collisions.
  stepPath(ent) {
    while (ent.path && ent.path.length) {
      const d = ent.path.shift();
      if (DIRS[d]) {
        ent.dir = d;
        const [dx, dy] = DIRS[d];
        ent.moving = true; ent.tx = ent.x + dx; ent.ty = ent.y + dy; ent.t = 0;
        return;
      }
      const f = String(d).replace('face:', '');
      if (DIRS[f]) ent.dir = f;
    }
    if (ent.pathDone) { const r = ent.pathDone; ent.pathDone = null; r(); }
  }

  onStep() {
    const g = this.g;
    const p = this.player;
    const b = this.buildingAt(p.x, p.y);
    if (b && b.place && this.isDoor(b, p.x, p.y)) {
      g.run(async () => {
        audio.sfx('door');
        if (b.enter) await b.enter(g);
        else await g.enterPlace(b.place);
      });
      return;
    }
    const w = this.warpAt(p.x, p.y);
    if (w) {
      g.run(async () => {
        if (w.check && !(await w.check(g))) {
          // walk back where we came from
          await g.movePlayer([OPP[p.dir]]);
          return;
        }
        audio.sfx(w.sfx || 'door');
        if (w.to === 'exit') await g.exitPlace();
        else if (w.place) await g.goto(w.place, w.room, w.tx, w.ty, w.dir || p.dir);
        else await g.goto(this.placeId, w.room, w.tx, w.ty, w.dir || p.dir);
      });
      return;
    }
    for (const ev of this.eventsAt(p.x, p.y, 'step')) {
      g.run(async () => {
        if (ev.once) g.setFlag(ev.once);
        await ev.run(g, ev);
      });
      return;
    }
  }

  interact() {
    const g = this.g;
    const p = this.player;
    const [dx, dy] = DIRS[p.dir];
    let tx = p.x + dx, ty = p.y + dy;
    let target = this.interactableAt(tx, ty);
    if (!target) {
      const top = this.topTile(tx, ty);
      if (top && TILES[top] && TILES[top].talkThrough) {
        const behind = this.interactableAt(tx + dx, ty + dy);
        if (behind) target = behind;
      }
    }
    if (target) {
      g.run(async () => {
        if (target.type === 'npc' && !target.fixedDir) target.dir = OPP[p.dir];
        if (target.talk) await target.talk(g, target);
        else await g.say(target.text, { name: target.name, look: target.type === 'npc' ? target.look : undefined });
      });
      return;
    }
    const evs = this.eventsAt(tx, ty, 'action');
    if (evs.length) {
      const ev = evs[0];
      g.run(async () => {
        if (ev.once) g.setFlag(ev.once);
        await ev.run(g, ev);
      });
      return;
    }
    const top = this.topTile(tx, ty);
    if (top === 'vending') {
      g.run(async () => {
        const i = await g.ask('自動販売機だ。ジュースを買う？（¥150・体力+10）', ['買う', 'やめる'], { cancel: 1 });
        if (i !== 0) return;
        if (!g.spend(150)) { await g.say('お金が足りない…'); return; }
        audio.sfx('coin');
        g.heal(10);
        await g.say('ガコン！ジュースを飲んだ。体力が10回復した。');
      });
      return;
    }
    if (top && TILE_TEXT[top]) {
      g.run(() => g.say(TILE_TEXT[top]));
    }
  }

  updateNpc(e) {
    if (!this.visible(e)) {
      // a hidden NPC cannot walk: finish any scripted path at once
      if (e.path.length || e.pathDone) {
        console.warn(`[map] moveNpc on hidden npc "${e.id}" finished immediately`);
        e.path.length = 0;
        if (e.pathDone) { const r = e.pathDone; e.pathDone = null; r(); }
      }
      return;
    }
    if (e.waitT > 0) { e.waitT--; if (e.waitT === 0 && e.path.length) this.tryNpcStep(e); return; }
    if (e.moving) {
      e.t += e.speed;
      e.anim += e.speed;
      if (e.t >= TILE) {
        e.moving = false; e.x = e.tx; e.y = e.ty; e.t = 0;
        e.px = e.x * TILE; e.py = e.y * TILE;
        if (e.path.length) this.tryNpcStep(e);
        else if (e.pathDone) { const r = e.pathDone; e.pathDone = null; r(); }
      } else {
        const [dx, dy] = DIRS[e.dir];
        e.px = (e.x + dx * e.t / TILE) * TILE;
        e.py = (e.y + dy * e.t / TILE) * TILE;
      }
      return;
    }
    if (e.path.length) { this.tryNpcStep(e); return; }
    if (e.pathDone) { const r = e.pathDone; e.pathDone = null; r(); return; }
    if (e.wander && this.g.busy === 0) {
      if (--e.wanderT <= 0) {
        e.wanderT = 90 + Math.floor(Math.random() * 150);
        const dirs = Object.keys(DIRS);
        const d = dirs[Math.floor(Math.random() * 4)];
        const [dx, dy] = DIRS[d];
        const nx = e.x + dx, ny = e.y + dy;
        const rad = typeof e.wander === 'number' ? e.wander : 2;
        e.dir = d;
        if (Math.abs(nx - e.home.x) <= rad && Math.abs(ny - e.home.y) <= rad && !this.blocked(nx, ny, e) && !this.warpAt(nx, ny)) {
          e.moving = true; e.tx = nx; e.ty = ny; e.t = 0;
        }
      }
    }
  }

  tryNpcStep(e) {
    const d = e.path[0];
    if (d === 'wait') { e.path.shift(); e.waitT = 15; return; }
    if (!DIRS[d]) { e.path.shift(); e.dir = String(d).replace('face:', ''); return; }
    const [dx, dy] = DIRS[d];
    e.dir = d;
    if (this.blocked(e.x + dx, e.y + dy, e)) {
      e.blockedT = (e.blockedT || 0) + 1;
      if (e.blockedT > 90) { e.path.shift(); e.blockedT = 0; }
      return;
    }
    e.blockedT = 0;
    e.path.shift();
    e.moving = true; e.tx = e.x + dx; e.ty = e.y + dy; e.t = 0;
  }

  updateCamera(snap = false) {
    const p = this.player;
    const mw = this.room.w * TILE, mh = this.room.h * TILE;
    let cx = mw <= W ? -(W - mw) / 2 : clamp(p.px + 8 - W / 2, 0, mw - W);
    // small rooms: centre, but keep the top wall clear of the HUD when there is room
    // big rooms: room.def.topPad (px) lets the camera scroll above row 0 so the HUD does not hide it
    const pad = this.room.def.topPad || 0;
    let cy = mh <= H ? -Math.max((H - mh) / 2, Math.min(40, H - mh)) : clamp(p.py + 8 - H / 2, -pad, mh - H);
    if (this.camOverride) { cx = this.camOverride.x; cy = this.camOverride.y; }
    this.cam.x = Math.round(cx);
    this.cam.y = Math.round(cy);
  }

  // ---------------------------------------------------------------- draw
  draw(ctx, g) {
    const room = this.room;
    const cam = this.cam;
    ctx.fillStyle = room.def.bg || '#000';
    ctx.fillRect(0, 0, W, H);
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(room.w - 1, Math.floor((cam.x + W) / TILE)), y1 = Math.min(room.h - 1, Math.floor((cam.y + H) / TILE));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (const id of room.cells[y][x]) {
          const def = TILES[id] || TILES.missing;
          const frame = def.frames > 1 ? Math.floor(g.frame / def.speed) % def.frames : 0;
          const variant = def.variants > 1 ? Math.floor(hash2(x, y, 7) * def.variants) : 0;
          ctx.drawImage(tileImage(id, frame, variant), x * TILE - cam.x, y * TILE - cam.y);
        }
      }
    }
    if (room.def.drawUnder) room.def.drawUnder(ctx, g, cam);

    // wall-mounted logos first
    for (const e of this.entities) {
      if (e.type !== 'logo' || !this.visible(e)) continue;
      drawLogo(ctx, e.logo, e.x * TILE - cam.x, e.y * TILE - cam.y, (e.w || 2) * TILE, (e.h || 1) * TILE, { board: e.board !== false, bg: e.bg, lights: e.lights });
    }

    const list = [];
    for (const e of this.entities) {
      if (!this.visible(e)) continue;
      if (e.type === 'building') list.push({ y: (e.y + e.h) * TILE, draw: () => drawBuilding(ctx, e, e.x * TILE - cam.x, e.y * TILE - cam.y, g.frame) });
      else if (e.type === 'prop' && e.draw) list.push({ y: (e.y + (e.h || 1)) * TILE + (e.z || 0), draw: () => e.draw(ctx, e.x * TILE - cam.x, e.y * TILE - cam.y, g, e) });
      else if (e.type === 'npc') list.push({ y: e.py + TILE + 0.5, draw: () => this.drawActor(ctx, e, e.sheet) });
    }
    const p = this.player;
    if (!p.hidden) list.push({ y: p.py + TILE + 0.6, draw: () => this.drawActor(ctx, p, charSheet(g.state.look || {})) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();

    if (room.def.drawOver) room.def.drawOver(ctx, g, cam);
    for (const e of [p, ...this.entities]) if (e.emote && (e === p || this.visible(e))) this.drawEmote(ctx, e);
    if (!room.def.hideHud && !this.place.hideHud) drawHud(ctx, g);
    drawBanner(ctx, g);
    drawToasts(ctx, g);
  }

  drawActor(ctx, e, sheet) {
    const x = e.px - this.cam.x, y = e.py - this.cam.y;
    if (x < -20 || y < -24 || x > W + 4 || y > H + 4) return;
    drawShadow(ctx, x, y);
    let frame = 0;
    if (e.moving) frame = [1, 0, 2, 0][Math.floor(e.anim / 8) % 4];
    if (e.sprite) e.sprite(ctx, x, y, this.g, e);
    else drawChar(ctx, sheet, e.dir, frame, x, y);
  }

  drawEmote(ctx, e) {
    const x = Math.round(e.px - this.cam.x), y = Math.round(e.py - this.cam.y) - 20;
    const k = e.emote.kind;
    const bob = e.emote.t < 6 ? 6 - e.emote.t : 0;
    ctx.fillStyle = '#22202a';
    ctx.fillRect(x + 2, y - 2 + bob, 13, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 3, y - 1 + bob, 11, 10);
    ctx.fillRect(x + 6, y + 9 + bob, 3, 2);
    const col = k === '!' ? '#d62f2f' : k === '♥' ? '#ff4f8b' : k === '💢' ? '#d62f2f' : '#22202a';
    const label = k === '💢' ? '#' : k;
    text(ctx, label, x + 9, y - 1 + bob, { size: 10, align: 'center', color: col, shadow: null });
  }
}

export { panel };
