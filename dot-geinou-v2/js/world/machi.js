// ドット商店街 ('machi'): the shopping street west of 東京エリア, its shops, hobbies and
// the residential side (ドットレジデンス / ドットタワー, by the housing agent).
//
// Town (48x36): a covered 商店街 arcade (north) with スーパー・はなや・ラーメン・カフェ・
//   美容院・コインランドリー・たい焼き; the shops along the main road (不動産屋・家具屋・
//   ファミレス・ジム・カラオケ); the residential side and ドット中央公園 with a jogging course
//   (south). The main road's east end walks back to Tokyo (its west edge).
// Places (this file):
//   super    スーパー まるどっと  ingredients (cooking.js), deli, daily goods, book/CD corner.
//                                 水曜は特売日（食材・お惣菜 2割引）
//   cafe     CAFE ドット          drinks & sweets: stress relief, a little hunger
//   karaoke  カラオケ ドットボックス  free time ¥1,200/day → sing (the 'rhythm' minigame):
//                                 歌 +1 (3 times a day) and stress -25 on a good rank (S/A/B),
//                                 fading with each song of the day (25/15/8/4, bad 10/6/3/2)
//   gym      DOT GYM              ¥1,000 a day: workout (stress -15, hunger -10, clean -20);
//                                 every 5 training days max stamina +2 (up to +20); shower
//   salon    hair salon ドット     ¥4,000 cut (once every SALON_CUT_DAYS days): clean 100 +
//                                 'styled' (the next day's work earns +10% fame, up to 300:
//                                 paid the next morning by an onMorning hook); ¥1,500 shampoo
//   ramen    らーめん まるどっと亭  ramen (hunger +60, stamina +30), stamp card
//   famires  ファミレス ドットキッチン  cheap meals, drink bar
//   hanaya   フラワー＆ギフト はなや   gifts (shared ids registered by people.js)
// Hangouts: cafe, karaoke, famires, sento (+ nicer lines for ramen / park).
//
// flags (all prefixed machi_): machi_karaoke_day, machi_karaoke_songs (`${day}:${n}`),
//   machi_gym_day, machi_gym_count, machi_gym_bonus, machi_styled ({ day, fame, jobs }),
//   machi_cut_day (day of the last salon cut),
//   machi_ramen_stamps, machi_jog (`${day}:${n}`), machi_bench_day, machi_drinkbar_day,
//   machi_met_* (first-visit lines), machi_cat_day, machi_gym_done (day of the counted
//   workout), machi_treat_<drink|aroma|bathsalt|salon|laundry|shower> (`${day}:${n}`: paid
//   relief fades after a couple a day), machi_intro, machi_kaicho.
// Every person, shop and brand here is fictional.

import { registerPlace, PLACES } from '../engine/map.js';
import { defineTile, R, P, disc, oval, outline, inset, dither, shadowEllipse } from '../engine/tiles.js';
import { LOOKS } from '../engine/sprites.js';
import { registerItem, ITEMS, SKILLS } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { registerHangout, onMorning, weekdayOf, WEEKDAYS, HUNGRY } from '../engine/life.js';
import { text } from '../engine/draw.js';
import { TILE, makeCanvas, shade, fmtMoney, pick } from '../engine/util.js';
import { grid, set, put, fill, hroad, vroad, border, unstick, ekiEnter } from './townkit.js';
import { busStop, house, commuterTrain } from './props.js';
import { INGREDIENTS, recipeHint } from './cooking.js';

// ====================================================================== small helpers
const OUT = '#22202a';
const who = (n) => ({ name: n.name, look: n.look });
const today = (g, k) => g.flag(k) === g.state.day;
// `${day}:${n}` counters that reset every day
function dayCount(g, k) {
  const v = String(g.flag(k) || '');
  const [d, n] = v.split(':').map(Number);
  return d === g.state.day ? n || 0 : 0;
}
function bumpDay(g, k) { const n = dayCount(g, k) + 1; g.setFlag(k, `${g.state.day}:${n}`); return n; }
const isWed = (g) => weekdayOf(g.state.day) === 2;

// Paid treats that only relax (drinks, aroma, bath salts) work fully `full` times a day
// (counted per kind in machi_treat_<kind>); after that a quarter of the effect, so stress
// cannot simply be bought away and hobbies, friends and rest stay worth it.
const TREAT_NOTE = '（今日はもう何度も気分転換した。効果は小さめ…）';
function treat(g, kind, stress, full = 2) {
  const n = bumpDay(g, 'machi_treat_' + kind);
  return n <= full ? { stress, tired: false } : { stress: Math.max(1, Math.round(stress / 4)), tired: true };
}
// A small side relief (laundry, a shower) that only counts once a day.
const onceADay = (g, kind, stress) => (bumpDay(g, 'machi_treat_' + kind) === 1 ? stress : 0);

// A short "time passes" beat.
async function beat(g, sfx = ['drum'], ms = 300) {
  await g.fadeOut(10);
  for (const s of [].concat(sfx)) { g.sfx(s); await g.wait(ms); }
  await g.fadeIn(10);
}

// Change readouts after an activity: "体力+10　ストレス-8".
function snap(g) { const L = g.state.life; return { st: g.state.stamina, hu: L.hunger, sr: L.stress, cl: L.clean, mo: g.state.money }; }
function diffText(g, a) {
  const b = snap(g), out = [];
  if (b.st !== a.st) out.push(`体力${b.st > a.st ? '+' : ''}${b.st - a.st}`);
  if (b.hu !== a.hu) out.push(`満腹${b.hu > a.hu ? '+' : ''}${b.hu - a.hu}`);
  if (b.sr !== a.sr) out.push(`ストレス${b.sr > a.sr ? '+' : ''}${b.sr - a.sr}`);
  if (b.cl !== a.cl) out.push(`身だしなみ${b.cl > a.cl ? '+' : ''}${b.cl - a.cl}`);
  return out.join('　');
}

// A menu of things to eat / drink on the spot (no items). entries: [{ name, price, heal,
// fill, stress, clean, text, food: bool (needs an empty stomach) }]. Returns the entry or null.
async function orderMenu(g, { title, entries, host, thanks, sale = 1 }) {
  const price = (e) => Math.round((e.price * (e.sale === false ? 1 : sale)) / 10) * 10;
  const effects = (e) => {
    const p = [];
    if (e.heal) p.push(`体力+${e.heal}`);
    if (e.fill) p.push(`満腹+${e.fill}`);
    if (e.stress) p.push(`ストレス-${e.stress}`);
    if (e.clean) p.push(`身だしなみ+${e.clean}`);
    return p.join('　');
  };
  const k = await g.list({
    title: `${title}（所持金 ${fmtMoney(g.state.money)}）`,
    items: entries.map((e) => ({ label: e.name, right: fmtMoney(price(e)), disabled: g.state.money < price(e) })),
    x: 12, y: 44, w: 420, px: true,
    describe: (i) => [entries[i].desc, effects(entries[i])].filter(Boolean).join('\n') + (entries[i].fill && !g.canEat() ? '\nいまはおなかいっぱい…' : ''),
  });
  if (k < 0) return null;
  const e = entries[k];
  const p = price(e);
  if (g.state.money < p) { await g.say('お金が足りない…。'); return null; }
  if (e.fill && !g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。\n（おなかが空いたら、また来よう）'); return null; }
  g.state.money -= p;
  g.sfx('coin');
  const a = snap(g);
  if (e.heal || e.fill) g.eat(e.heal || 0, { silent: true, fill: e.fill || 0 });
  // a drink (nothing to eat) is a treat: full relief twice a day, then less
  // food relieves stress only as much as the stomach could take (g.lastEatRatio)
  const t = e.stress && !e.fill ? treat(g, 'drink', e.stress) : { stress: Math.round((e.stress || 0) * (e.fill ? g.lastEatRatio : 1)), tired: false };
  g.relax({ stress: t.stress, clean: e.clean || 0 });
  const res = diffText(g, a);
  await g.say([e.text || `${e.name}をいただいた。`, (res || 'ほっとひと息。') + (t.tired ? '\n' + TREAT_NOTE : '')]);
  if (thanks && host) await g.say(thanks, who(host));
  return e;
}

// Shop list that skips items that are not registered (e.g. people.js failed to load).
function goods(list, sale = 1) {
  return list.filter((x) => ITEMS[typeof x === 'string' ? x : x.item]).map((x) => {
    const id = typeof x === 'string' ? x : x.item;
    const base = typeof x === 'string' ? ITEMS[id].price : x.price;
    return sale === 1 ? { item: id, price: base } : { item: id, price: Math.round((base * sale) / 10) * 10 };
  });
}

// ====================================================================== items
registerItem('machi_korokke', { name: 'お惣菜コロッケ', price: 100, heal: 10, fill: 18, desc: '揚げたてサクサク！\n体力が10回復する。（満腹 +18）' });
registerItem('machi_bento', { name: 'まるどっと弁当', price: 380, heal: 35, fill: 55, desc: 'スーパーの手作り弁当。からあげ入り。\n体力が35回復する。' });
registerItem('machi_cupmen', { name: 'カップめん', price: 180, heal: 12, fill: 35, desc: 'お湯を入れて3分。\n体力が12回復する。（満腹 +35）' });
registerItem('machi_banana', { name: 'バナナ', price: 60, heal: 6, fill: 12, desc: 'トレーニングのおともに。\n体力が6回復する。' });
registerItem('machi_taiyaki', { name: 'たい焼き', price: 150, heal: 12, fill: 20, desc: 'しっぽまであんこ入り！\n体力が12回復する。' });
registerItem('machi_bathsalt', {
  name: '入浴剤', price: 300, desc: 'ゆずの香りの入浴剤。\n使うと ストレス -8・身だしなみ +15。',
  use: async (g) => {
    g.takeItem('machi_bathsalt');
    const t = treat(g, 'bathsalt', 8, 1);
    const a = snap(g);
    g.relax({ stress: t.stress, clean: 15 });
    g.sfx('good');
    await g.say(['お湯に入浴剤をとかして、ゆっくりつかった。\nゆずのいい香り…。', (diffText(g, a) || 'さっぱりした。') + (t.tired ? '\n' + TREAT_NOTE : '')]);
  },
});
registerItem('machi_aroma', {
  name: 'アロマキャンドル', price: 800, desc: 'ラベンダーの香り。\n使うと ストレス -18。（よく効くのは1日1回）',
  use: async (g) => {
    g.takeItem('machi_aroma');
    const t = treat(g, 'aroma', 18, 1);
    const a = snap(g);
    g.relax({ stress: t.stress });
    g.sfx('good');
    await g.say(['アロマキャンドルに火をともした。\nやさしい香りに、心がほどけていく…。', (diffText(g, a) || 'ほっとした。') + (t.tired ? '\n' + TREAT_NOTE : '')]);
  },
});
registerItem('machi_wax', {
  name: 'ヘアワックス', price: 600, desc: '寝ぐせもこれでバッチリ。\n使うと 身だしなみ +25。',
  use: async (g) => {
    g.takeItem('machi_wax');
    g.relax({ clean: 25 });
    g.sfx('good');
    await g.say('鏡を見ながら、髪を整えた。\n…よし、キマった！\n（身だしなみ +25）');
  },
});

// ====================================================================== hangouts
registerHangout('ramen', {
  name: 'ラーメン屋', price: 900, stress: 12, aff: 5, fill: 45, place: 'ramen',
  lines: ['（湯気の向こうで、ふたりでズルズル…）', '仕事の話、くだらない話。\nスープまで飲み干した。'],
});
registerHangout('park', {
  name: '公園で散歩', go: '公園へおさんぽ', price: 0, stress: 10, aff: 4, place: 'machi',
  lines: ['（ドット中央公園を、のんびり歩いた）', 'ベンチに座って、とりとめのない話をした。\n池のカモが、すいーっと泳いでいく。'],
});
registerHangout('cafe', {
  name: 'カフェ', price: 1200, stress: 15, aff: 6, fill: 15, place: 'cafe',
  lines: ['（CAFE ドットの、窓ぎわの席に座った）', 'ラテアートのハートを見せ合って、笑った。\n時間がゆっくり流れていく。'],
});
registerHangout('karaoke', {
  name: 'カラオケ', price: 1500, stress: 22, aff: 6, stamina: 10, place: 'karaoke',
  lines: ['（カラオケ ドットボックスで、マイクをにぎった）', 'デュエットに、タンバリン。\nふたりで声がかれるまで歌った！'],
});
registerHangout('famires', {
  name: 'ファミレス', price: 1000, stress: 12, aff: 5, fill: 40, place: 'famires',
  lines: ['（ファミレス ドットキッチンのボックス席へ）', 'ドリンクバーをおかわりしながら、\nずいぶん長く話しこんだ。'],
});
registerHangout('sento', {
  name: '銭湯', price: 500, stress: 15, aff: 5, clean: 40, place: 'sento',
  lines: ['（銭湯 ドットの湯で、ひとっ風呂）', 'お風呂あがりに、並んでコーヒー牛乳。\n腰に手をあてて、ぷはーっ！'],
});

// ====================================================================== music
registerSong('machi_shop', {
  bpm: 104, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . F5 D5 . | E5 . G5 C6 . B5 A5 G5 | F5 . E5 . D5 - - . | C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . F5 D5 . | G5 . F5 E5 . D5 E5 . | C5 - - . . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | C3 . G3 . A2 . E3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | G2 . D3 . G2 . D3 . | C3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.07, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});
registerSong('machi_cafe', {
  bpm: 84, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.08, notes: 'E5 - - D5 C5 - A4 - | G4 - - - . . . . | F4 - A4 - C5 - E5 - | D5 - - - . . . . | E5 - G5 - E5 D5 C5 - | A4 - - C5 B4 - G4 - | A4 - C5 - B4 - G4 - | C5 - - - . . . .' },
    { wave: 'square', vol: 0.018, notes: 'C4 E4 G4 B4 C4 E4 G4 B4 | A3 C4 E4 G4 A3 C4 E4 G4 | F3 A3 C4 E4 F3 A3 C4 E4 | G3 B3 D4 F4 G3 B3 D4 F4' },
    { wave: 'triangle', vol: 0.09, notes: 'C3 - - - G2 - - - | A2 - - - E2 - - - | F2 - - - C3 - - - | G2 - - - D3 - - -' },
    { wave: 'drum', vol: 0.03, notes: 'h . . h . . h . | h . . h . . h h' },
  ],
});
registerSong('machi_gym', {
  bpm: 128, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.038, notes: 'A4 . A4 . C5 . A4 . | G4 . G4 . E4 . G4 . | F4 . F4 . A4 . C5 . | E5 . D5 . C5 . B4 . | A4 . A4 . C5 . E5 . | G5 . E5 . D5 . C5 . | F5 . E5 . D5 . C5 . | B4 - - - E5 - - .' },
    { wave: 'triangle', vol: 0.12, notes: 'A2 A2 A3 A2 A2 A2 A3 A2 | G2 G2 G3 G2 G2 G2 G3 G2 | F2 F2 F3 F2 F2 F2 F3 F2 | E2 E2 E3 E2 E2 E2 E3 E2' },
    { wave: 'drum', vol: 0.1, notes: 'k . h . k . h . | k . h . k . h h' },
  ],
});

// ====================================================================== HD tiles
// Every tile here is painted natively at 32x32 (hd); the 16px draw() is the same art
// sampled down (only used where something asks for tileImage()).
function tile(id, def, hd) {
  defineTile(id, {
    ...def,
    hd,
    draw(c, r, f, v) {
      const [cv, c2] = makeCanvas(32, 32);
      hd(c2, r, f, v);
      c.drawImage(cv, 0, 0, 16, 16);
    },
  });
}
const W8 = { d: '#5a3a20', m: '#8a5a33', l: '#b07a48', h: '#d09a62' }; // warm wood
const CHROME = { d: '#7d8391', m: '#b8bec8', l: '#dfe3ea', h: '#f6f8fb' };

// ---- arcade paving: big square slabs, a few terracotta accents
tile('machi_arcade', { variants: 4 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#b3a184');
  const PAT = [[0, 1, 1, 0], [1, 0, 0, 1], [0, 0, 1, 2], [2, 1, 0, 0]][v];
  const COL = ['#efe5cf', '#e4d6b8', '#d99a7c'];
  for (let k = 0; k < 4; k++) {
    const x = 1 + (k % 2) * 16, y = 1 + (k >> 1) * 16, col = COL[PAT[k]];
    R(c, x, y, 15, 15, col);
    R(c, x, y, 15, 1, shade(col, 0.1)); R(c, x, y + 1, 1, 14, shade(col, 0.06));
    R(c, x, y + 14, 15, 1, shade(col, -0.09)); R(c, x + 14, y + 1, 1, 13, shade(col, -0.06));
    for (let i = 0; i < 3; i++) P(c, x + 2 + Math.floor(r() * 11), y + 2 + Math.floor(r() * 11), shade(col, -0.07));
  }
});

// ---- produce stand (crates of vegetables on a slanted wooden stand)
function crate(c, x, y, w, h) {
  R(c, x, y, w, h, '#b07a48');
  R(c, x, y, w, 1, '#d09a62'); R(c, x, y + h - 1, w, 1, '#7a5028');
  R(c, x + 1, y + h - 4, w - 2, 1, '#8a5a33');
  R(c, x, y, 1, h, '#c48a52'); R(c, x + w - 1, y, 1, h, '#8a5a33');
}
function veg(c, kind, x, y) {
  if (kind === 'cabbage') { disc(c, x + 3, y + 3, 3, '#5f9f45'); disc(c, x + 3, y + 2, 2, '#86c862'); P(c, x + 2, y + 1, '#c4ec9a'); R(c, x + 3, y + 3, 1, 3, '#4f8a3a'); }
  else if (kind === 'tomato') { disc(c, x + 2, y + 3, 2, '#e0402a'); P(c, x + 1, y + 2, '#ffa08a'); P(c, x + 2, y + 1, '#3f8a3a'); }
  else if (kind === 'carrot') { R(c, x + 1, y + 2, 3, 4, '#ff8a2a'); R(c, x + 2, y + 6, 1, 1, '#ff8a2a'); R(c, x + 1, y + 2, 1, 4, '#ffb060'); R(c, x + 1, y, 1, 2, '#4f9a3a'); R(c, x + 3, y, 1, 2, '#3f8a3a'); }
  else if (kind === 'eggplant') { oval(c, x, y + 2, 5, 5, '#5a2f7a'); P(c, x + 1, y + 3, '#9a6ac0'); R(c, x + 1, y + 1, 3, 1, '#3f8a3a'); }
  else if (kind === 'onion') { disc(c, x + 2, y + 3, 2, '#d8a35a'); P(c, x + 1, y + 2, '#f2d090'); P(c, x + 2, y, '#a8743f'); }
  else if (kind === 'potato') { oval(c, x, y + 2, 5, 4, '#c8a068'); P(c, x + 1, y + 3, '#e0c088'); P(c, x + 3, y + 4, '#9a7448'); }
}
function vegRow(c, kind, x0, y, w) {
  const step = { cabbage: 7, tomato: 5, carrot: 4, eggplant: 5, onion: 5, potato: 5 }[kind];
  for (let i = 0, x = x0 + 1; x + step <= x0 + w; x += step, i++) veg(c, kind, x, y - (i % 2));
}
tile('machi_produce', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 30, 14, 1);
  R(c, 3, 25, 3, 5, W8.d); R(c, 26, 25, 3, 5, W8.d);
  const sets = [['cabbage', 'carrot', 'tomato', 'eggplant'], ['onion', 'cabbage', 'potato', 'tomato']][v];
  crate(c, 1, 3, 15, 10); crate(c, 16, 3, 15, 10);
  vegRow(c, sets[0], 1, 2, 15); vegRow(c, sets[1], 16, 3, 15);
  crate(c, 0, 12, 16, 11); crate(c, 16, 12, 16, 11);
  vegRow(c, sets[2], 0, 11, 16); vegRow(c, sets[3], 16, 11, 16);
  R(c, 0, 22, 32, 4, W8.m); R(c, 0, 22, 32, 1, W8.h); R(c, 0, 25, 32, 1, W8.d);
  for (const x of [3, 19]) { R(c, x, 21, 9, 4, '#ffffff'); R(c, x + 1, 22, 4, 1, '#d62f2f'); R(c, x + 6, 22, 2, 2, '#d62f2f'); R(c, x + 1, 24, 7, 1, '#e4e7ec'); }
  outline(c);
});

// ---- refrigerated case (meat / fish, or eggs / tofu)
tile('machi_meatcase', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 7, '#3a4a5a'); R(c, 0, 0, 32, 1, '#5a6a7a'); R(c, 2, 2, 28, 2, '#eaf6ff'); R(c, 2, 4, 28, 1, '#b8d0e0');
  R(c, 0, 7, 32, 15, '#cfe6f2'); R(c, 0, 7, 32, 1, '#a8c8dc');
  R(c, 0, 14, 32, 1, '#8aa4b8'); R(c, 0, 15, 32, 1, '#e8f4fa');
  if (v === 0) {
    for (let x = 1; x < 30; x += 8) { R(c, x, 9, 7, 5, '#ffffff'); R(c, x + 1, 9, 5, 4, '#d8606a'); R(c, x + 1, 9, 5, 1, '#f49aa0'); R(c, x + 2, 11, 2, 1, '#f8d0d0'); R(c, x + 4, 12, 2, 1, '#ffd23f'); }
    for (let x = 1; x < 30; x += 8) { R(c, x, 16, 7, 5, '#ffffff'); R(c, x + 1, 16, 5, 4, '#f0885a'); R(c, x + 1, 17, 5, 1, '#ffd0b0'); R(c, x + 1, 19, 5, 1, '#ffd0b0'); R(c, x + 5, 16, 1, 1, '#2f6fd0'); }
  } else {
    for (let x = 1; x < 30; x += 10) { R(c, x, 9, 9, 5, '#f2d9a8'); for (let i = 0; i < 4; i++) { R(c, x + 1 + i * 2, 9, 2, 2, '#fff6e8'); P(c, x + 1 + i * 2, 9, '#ffffff'); } R(c, x, 12, 9, 2, '#e0a840'); }
    for (let x = 1; x < 30; x += 8) { R(c, x, 16, 7, 5, '#9ad0ea'); R(c, x + 1, 17, 5, 3, '#fbfaf2'); R(c, x + 1, 17, 5, 1, '#ffffff'); R(c, x + 1, 19, 5, 1, '#e4e2d4'); }
  }
  R(c, 0, 21, 32, 2, '#f4f8fb'); R(c, 0, 21, 32, 1, '#ffffff');
  R(c, 0, 23, 32, 9, '#e4e8ee'); R(c, 0, 23, 32, 1, '#ffffff'); R(c, 0, 25, 32, 2, '#2f6fd0'); R(c, 0, 25, 32, 1, '#5f8fe6');
  for (let x = 3; x < 30; x += 4) R(c, x, 29, 2, 1, '#9aa0aa');
  R(c, 0, 31, 32, 1, '#9aa0aa');
  outline(c);
});

// ---- staples shelf (rice bags, noodles, curry roux, miso)
tile('machi_staples', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, W8.m); R(c, 2, 0, 28, 30, '#f2ead8'); R(c, 2, 0, 28, 1, '#d8ccb0');
  const rows = v ? ['roux', 'rice', 'miso'] : ['rice', 'noodle', 'roux'];
  rows.forEach((kind, row) => {
    const y = 1 + row * 10;
    for (let i = 0, x = 3; x < 28; i++) {
      if (kind === 'rice') { R(c, x, y + 1, 7, 7, '#fbf6ea'); R(c, x, y + 1, 7, 1, '#ffffff'); R(c, x + 6, y + 2, 1, 6, '#d8d0bc'); R(c, x + 1, y + 4, 5, 2, i % 2 ? '#2f6fd0' : '#d62f2f'); R(c, x + 2, y, 3, 1, '#c8b890'); x += 8; }
      else if (kind === 'noodle') { R(c, x, y + 3, 6, 5, '#f2c230'); R(c, x, y + 3, 6, 1, '#ffe07a'); R(c, x + 1, y + 4, 4, 2, '#fff2c0'); P(c, x + 2, y + 6, '#d62f2f'); x += 6; }
      else if (kind === 'roux') { const col = i % 2 ? '#7a3a1a' : '#e07a1f'; R(c, x, y + 2, 6, 6, col); R(c, x, y + 2, 6, 1, shade(col, 0.35)); R(c, x + 5, y + 3, 1, 5, shade(col, -0.25)); R(c, x + 1, y + 4, 3, 2, '#ffd23f'); x += 7; }
      else { R(c, x, y + 3, 5, 5, '#efe2c4'); R(c, x, y + 2, 5, 2, '#c0452f'); R(c, x, y + 2, 5, 1, '#e0705a'); R(c, x + 1, y + 5, 3, 1, '#8a6a4a'); x += 6; }
    }
    R(c, 2, y + 8, 28, 2, W8.l); R(c, 2, y + 8, 28, 1, W8.h);
    R(c, 6, y + 9, 4, 1, '#ffd23f');
  });
  R(c, 0, 30, 32, 2, W8.d);
});

// ---- deli counter (惣菜): glass case with croquettes, karaage and bento
tile('machi_deli', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 2, 32, 14, '#d4ecf6'); R(c, 0, 2, 32, 1, '#ffffff'); R(c, 0, 3, 32, 1, '#eaf6fb');
  R(c, 1, 8, 30, 1, '#b8d4e0');
  for (let x = 2; x < 13; x += 5) { oval(c, x, 4, 5, 4, '#c8862a'); oval(c, x + 1, 4, 3, 2, '#e8b050'); P(c, x + 2, 6, '#9a6020'); }
  for (let x = 16; x < 30; x += 4) { disc(c, x + 1, 6, 2, '#a8581e'); P(c, x, 5, '#d8904a'); }
  for (const x of [2, 12, 22]) { R(c, x, 10, 8, 5, '#20232a'); R(c, x + 1, 11, 3, 3, '#ffffff'); R(c, x + 4, 11, 3, 2, '#c8762a'); R(c, x + 4, 13, 1, 1, '#3f9a4a'); R(c, x + 6, 13, 1, 1, '#e0402a'); R(c, x, 10, 8, 1, '#3a3f4a'); }
  R(c, 0, 16, 32, 16, '#f4f4f4'); R(c, 0, 16, 32, 2, '#d84a3a'); R(c, 0, 18, 32, 1, '#b83a2a');
  for (let x = 2; x < 30; x += 6) { R(c, x, 22, 4, 4, '#d84a3a'); R(c, x + 1, 23, 2, 2, '#ffffff'); }
  R(c, 0, 30, 32, 2, '#b8bec8');
  outline(c);
});

// ---- CD rack (book / CD corner)
tile('machi_cdrack', { solid: true, obj: true }, (c) => {
  R(c, 1, 0, 30, 31, '#3a3f4a'); R(c, 1, 0, 30, 1, '#5a5f6b');
  R(c, 3, 2, 26, 6, '#ff4f8b'); R(c, 3, 2, 26, 1, '#ff9ac0');
  // "CD" in pixels
  R(c, 11, 3, 1, 4, '#ffffff'); R(c, 12, 3, 2, 1, '#ffffff'); R(c, 12, 6, 2, 1, '#ffffff');
  R(c, 17, 3, 1, 4, '#ffffff'); R(c, 18, 3, 2, 1, '#ffffff'); R(c, 18, 6, 2, 1, '#ffffff'); R(c, 20, 4, 1, 2, '#ffffff');
  const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#f4f4f4', '#8a5ac8', '#ff8a3d', '#5fd7ff'];
  for (let row = 0; row < 3; row++) {
    const y = 10 + row * 7;
    for (let i = 0; i < 12; i++) { const col = cols[(i * 3 + row * 5) % cols.length]; R(c, 4 + i * 2, y, 2, 5, col); P(c, 4 + i * 2, y, shade(col, 0.4)); }
    R(c, 3, y + 5, 26, 1, '#7d8391');
  }
  R(c, 1, 30, 30, 1, '#20232a');
  outline(c);
});

// ---- stacked shopping baskets
tile('machi_baskets', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 11, 2);
  for (let i = 0; i < 4; i++) {
    const y = 18 - i * 4;
    R(c, 6, y, 20, 10, '#d84a3a'); R(c, 6, y, 20, 1, '#ff7a6a'); R(c, 25, y + 1, 1, 9, '#a8302a');
    for (let x = 8; x < 24; x += 3) R(c, x, y + 3, 2, 3, '#a8302a');
  }
  R(c, 9, 4, 1, 4, '#3b3f48'); R(c, 22, 4, 1, 4, '#3b3f48'); R(c, 9, 4, 14, 1, '#3b3f48');
  outline(c);
});

// ---- cafe counter with an espresso machine
tile('machi_espresso', { solid: true, obj: true, talkThrough: true }, (c) => {
  R(c, 0, 2, 32, 14, '#c8a070'); R(c, 0, 2, 32, 1, '#e8c898'); R(c, 0, 14, 32, 2, '#9a7448');
  R(c, 0, 16, 32, 16, '#5a3a26'); R(c, 0, 16, 32, 2, '#3e2818'); R(c, 0, 30, 32, 2, '#2e1c10');
  for (const x of [3, 18]) inset(c, x, 20, 11, 8, '#5a3a26', '#6e4a30', '#3e2818');
  // the machine
  R(c, 5, -2 + 2, 22, 13, '#c8ccd4'); R(c, 5, 0, 22, 1, '#f0f2f6'); R(c, 5, 1, 1, 12, '#e4e7ec'); R(c, 26, 1, 1, 12, '#9aa0aa');
  R(c, 7, 2, 18, 3, '#d62f2f'); R(c, 7, 2, 18, 1, '#ff6a5a');
  for (const x of [9, 19]) { R(c, x, 6, 4, 3, '#7d8391'); R(c, x + 1, 9, 2, 2, '#3b3f48'); R(c, x - 2, 7, 3, 1, '#20232a'); }
  R(c, 7, 12, 18, 1, '#7d8391');
  for (const x of [10, 20]) { R(c, x, 10, 3, 2, '#ffffff'); P(c, x + 1, 10, '#6e4428'); }
  P(c, 15, 7, '#5ee07a');
  outline(c);
});

// ---- glass showcase with cakes (cafe, gift shop)
tile('machi_cakecase', { solid: true, obj: true, talkThrough: true, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 2, 32, 15, '#e2f2f8'); R(c, 0, 2, 32, 1, '#ffffff'); R(c, 0, 3, 32, 1, '#f4fbfd');
  R(c, 1, 9, 30, 1, '#b8d4e0');
  const top = v ? ['#f2c8d8', '#7a4a2a', '#fff2d0'] : ['#fff6ea', '#e8c058', '#7a4a2a'];
  for (let i = 0; i < 4; i++) {
    const x = 2 + i * 7, col = top[i % 3];
    R(c, x, 5, 5, 4, col); R(c, x, 5, 5, 1, '#ffffff'); R(c, x, 7, 5, 1, '#f2d9a8');
    if (col === '#fff6ea') { R(c, x + 2, 4, 2, 2, '#e0303a'); P(c, x + 2, 4, '#ff8a8a'); }
    if (col === '#7a4a2a') { R(c, x, 5, 5, 1, '#9a6a40'); P(c, x + 2, 4, '#ffffff'); }
  }
  for (let i = 0; i < 3; i++) { const x = 3 + i * 10; R(c, x, 11, 7, 5, i === 1 ? '#f2c8d8' : '#fff2d0'); R(c, x, 11, 7, 1, '#ffffff'); R(c, x + 1, 13, 5, 1, i === 1 ? '#ff7eb6' : '#e8c058'); P(c, x + 3, 10, '#e0303a'); }
  R(c, 0, 17, 32, 15, '#f2e6dc'); R(c, 0, 17, 32, 2, '#c87a8a'); R(c, 0, 19, 32, 1, '#a85a6a');
  for (let x = 2; x < 30; x += 4) R(c, x, 22, 2, 7, '#e8d8cc');
  R(c, 0, 30, 32, 2, '#a89888');
  outline(c);
});

// ---- round cafe table with a cup, and a wooden cafe chair
tile('machi_cafetable', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 28, 8, 2);
  R(c, 15, 16, 3, 12, '#3b3f48'); R(c, 15, 16, 1, 12, '#5a5f6b');
  R(c, 10, 27, 13, 2, '#2a2d36');
  oval(c, 3, 7, 26, 12, '#8a5a33'); oval(c, 3, 6, 26, 11, '#c48a52'); oval(c, 5, 7, 22, 8, '#d49a62');
  if (v === 0) { oval(c, 8, 9, 9, 4, '#f4f4f4'); R(c, 10, 6, 5, 5, '#ffffff'); R(c, 10, 6, 5, 1, '#6e4428'); R(c, 15, 7, 2, 2, '#ffffff'); R(c, 20, 9, 5, 3, '#fff2d0'); R(c, 20, 9, 5, 1, '#e0303a'); }
  else { R(c, 9, 7, 4, 5, '#ffffff'); R(c, 9, 7, 4, 1, '#e8c898'); R(c, 18, 6, 4, 6, '#d4ecf6'); R(c, 18, 7, 4, 3, '#f0a040'); P(c, 20, 5, '#3f9a4a'); }
  outline(c);
});
tile('machi_cafechair', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 8, 1);
  R(c, 9, 4, 14, 3, '#8a5a33'); R(c, 9, 4, 14, 1, '#b07a48');
  R(c, 10, 7, 2, 10, '#6b4526'); R(c, 20, 7, 2, 10, '#6b4526');
  R(c, 13, 8, 6, 1, '#8a5a33'); R(c, 13, 11, 6, 1, '#8a5a33');
  R(c, 8, 17, 16, 4, '#b07a48'); R(c, 8, 17, 16, 1, '#d09a62'); R(c, 8, 20, 16, 1, '#7a5028');
  R(c, 9, 21, 2, 8, '#5a3a20'); R(c, 21, 21, 2, 8, '#5a3a20');
  outline(c);
});

// ---- wall overlays: chalkboard menu, shelf with mugs, menu tags (ramen)
tile('machi_menuboard', { obj: true }, (c) => {
  R(c, 3, 3, 26, 21, W8.m); R(c, 3, 3, 26, 1, W8.h); R(c, 28, 4, 1, 20, W8.d); R(c, 3, 23, 26, 1, W8.d);
  R(c, 5, 5, 22, 17, '#2a3a30');
  R(c, 8, 7, 10, 1, '#f4f0e0'); R(c, 8, 7, 1, 2, '#f4f0e0');
  for (let i = 0; i < 4; i++) { R(c, 7, 11 + i * 3, 8 + (i % 2) * 3, 1, '#e8f0e0'); R(c, 21, 11 + i * 3, 3, 1, ['#ffd23f', '#ff9ac0', '#9af0b0', '#ffffff'][i]); }
  R(c, 21, 7, 4, 2, '#ff9ac0');
  outline(c);
});
tile('machi_wallshelf', { obj: true }, (c) => {
  for (const y of [9, 20]) { R(c, 2, y, 28, 3, W8.m); R(c, 2, y, 28, 1, W8.h); R(c, 2, y + 2, 28, 1, W8.d); R(c, 5, y + 3, 2, 2, W8.d); R(c, 25, y + 3, 2, 2, W8.d); }
  const mugs = ['#ffffff', '#d84a3a', '#2f6b4f', '#ffd23f'];
  for (let i = 0; i < 4; i++) { const x = 4 + i * 7; R(c, x, 4, 5, 5, mugs[i]); R(c, x, 4, 5, 1, shade(mugs[i], 0.3)); R(c, x + 5, 5, 1, 3, mugs[i]); }
  for (let i = 0; i < 3; i++) { const x = 5 + i * 8; R(c, x, 13, 6, 7, '#e8f2f4'); R(c, x + 1, 15, 4, 5, ['#5a3a20', '#7a4a2a', '#3e2818'][i]); R(c, x, 13, 6, 2, '#b07a48'); }
  outline(c);
});
tile('machi_menutags', { obj: true }, (c) => {
  for (let i = 0; i < 5; i++) {
    const x = 1 + i * 6, red = i === 1;
    R(c, x, 4, 5, 19, red ? '#d62f2f' : '#f2e2c0'); R(c, x, 4, 5, 1, red ? '#ff6a5a' : '#fff6e0'); R(c, x + 4, 5, 1, 18, red ? '#a82020' : '#c8b088');
    for (let y = 7; y < 20; y += 3) R(c, x + 1 + (y % 2), y, 2, 2, red ? '#ffffff' : '#20232a');
  }
  R(c, 0, 3, 32, 1, W8.d);
  outline(c);
});

// ---- gym equipment
tile('machi_treadmill', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 13, 1);
  R(c, 5, 12, 22, 18, '#3b3f48'); R(c, 7, 13, 18, 15, '#20232a');
  for (let y = 14; y < 28; y += 3) R(c, 7, y, 18, 1, '#3a3d46');
  R(c, 5, 12, 2, 18, '#5a5f6b'); R(c, 25, 12, 2, 18, '#5a5f6b');
  R(c, 5, 29, 22, 2, '#2a2d36');
  R(c, 4, 4, 2, 10, CHROME.m); R(c, 26, 4, 2, 10, CHROME.m); R(c, 4, 4, 24, 2, CHROME.l);
  R(c, 9, 1, 14, 6, '#2a2d36'); R(c, 10, 2, 12, 3, '#3fd07a'); R(c, 11, 3, 4, 1, '#c8ffd8'); R(c, 17, 3, 3, 1, '#c8ffd8');
  outline(c);
});
tile('machi_bench', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 11, 2);
  R(c, 3, 3, 2, 18, CHROME.d); R(c, 27, 3, 2, 18, CHROME.d); R(c, 3, 3, 1, 18, CHROME.l); R(c, 27, 3, 1, 18, CHROME.l);
  R(c, 0, 6, 32, 2, CHROME.m); R(c, 0, 6, 32, 1, CHROME.h);
  for (const x of [0, 27]) { R(c, x, 2, 5, 10, '#20232a'); R(c, x + 1, 3, 1, 8, '#4a4e58'); }
  R(c, 10, 10, 12, 18, '#c0302a'); R(c, 10, 10, 12, 2, '#e85a50'); R(c, 21, 12, 1, 16, '#8a1e1a');
  R(c, 14, 28, 4, 3, '#3b3f48');
  outline(c);
});
tile('machi_dumbbells', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 13, 1);
  R(c, 2, 8, 28, 3, '#5a5f6b'); R(c, 2, 8, 28, 1, '#7d8391'); R(c, 2, 19, 28, 3, '#5a5f6b'); R(c, 2, 19, 28, 1, '#7d8391');
  R(c, 3, 11, 2, 19, '#3b3f48'); R(c, 27, 11, 2, 19, '#3b3f48');
  for (const y of [3, 14]) for (let i = 0; i < 3; i++) {
    const x = 6 + i * 7, s = 3 - (i === 1 ? 0 : 1);
    R(c, x, y + 2, 6, 1, CHROME.m);
    R(c, x - 1, y + 2 - s, 2, s * 2 + 1, '#20232a'); R(c, x + 5, y + 2 - s, 2, s * 2 + 1, '#20232a');
    P(c, x - 1, y + 2 - s, '#4a4e58'); P(c, x + 5, y + 2 - s, '#4a4e58');
  }
  outline(c);
});
tile('machi_yogamat', { obj: true, variants: 2 }, (c, r, f, v) => {
  const col = v ? '#5fb8a8' : '#9a7ad0';
  R(c, 4, 3, 24, 27, col); R(c, 4, 3, 24, 1, shade(col, 0.3)); R(c, 27, 4, 1, 26, shade(col, -0.2)); R(c, 4, 29, 24, 1, shade(col, -0.25));
  dither(c, 6, 6, 20, 22, shade(col, 0.08), 0);
  R(c, 4, 1, 24, 3, shade(col, -0.15)); R(c, 4, 1, 24, 1, shade(col, 0.15));
});
tile('machi_shower', { solid: true, obj: true }, (c) => {
  R(c, 0, 0, 32, 32, '#d8e8f2');
  for (let y = 0; y < 32; y += 6) R(c, 0, y, 32, 1, '#b8cede');
  for (let x = 0; x < 32; x += 6) R(c, x, 0, 1, 26, '#c4d8e6');
  R(c, 20, 3, 2, 10, CHROME.d); R(c, 16, 3, 6, 2, CHROME.m); disc(c, 15, 5, 2, CHROME.l); P(c, 14, 8, '#8ad0f0'); P(c, 16, 10, '#8ad0f0'); P(c, 15, 12, '#8ad0f0');
  R(c, 2, 14, 28, 18, '#eef6fb'); R(c, 2, 14, 28, 2, '#ffffff');
  for (let x = 4; x < 30; x += 5) R(c, x, 16, 2, 16, '#dcebf4');
  R(c, 1, 13, 30, 1, CHROME.d);
  R(c, 0, 30, 32, 2, '#9ab0c0');
  outline(c);
});

// ---- salon: styling chair (seen from behind) and shampoo station
tile('machi_salonchair', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 9, 2);
  R(c, 14, 22, 4, 6, CHROME.m); R(c, 9, 27, 14, 2, CHROME.d); R(c, 9, 27, 14, 1, CHROME.l);
  R(c, 7, 13, 18, 10, '#2a2d36'); R(c, 7, 13, 18, 1, '#4a4e58');
  R(c, 9, 2, 14, 13, '#1e1e26'); R(c, 10, 3, 12, 1, '#4a4e58'); R(c, 10, 4, 1, 9, '#3b3f48');
  R(c, 12, 0, 8, 3, '#1e1e26'); R(c, 13, 0, 6, 1, '#4a4e58');
  R(c, 5, 15, 4, 3, '#3b3f48'); R(c, 23, 15, 4, 3, '#3b3f48'); R(c, 5, 15, 4, 1, CHROME.m); R(c, 23, 15, 4, 1, CHROME.m);
  outline(c);
});
tile('machi_shampoo', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 12, 2);
  R(c, 4, 2, 24, 10, '#f6f6f8'); R(c, 4, 2, 24, 1, '#ffffff'); oval(c, 8, 4, 16, 6, '#d5d9e0'); oval(c, 10, 5, 12, 3, '#bfe6ff');
  R(c, 15, 1, 2, 3, CHROME.d);
  R(c, 6, 12, 20, 8, '#c8a6d8'); R(c, 6, 12, 20, 1, '#e8d0f2'); R(c, 25, 13, 1, 7, '#9a7aa8');
  R(c, 4, 19, 24, 7, '#b090c4'); R(c, 4, 19, 24, 1, '#d8bce8');
  R(c, 8, 26, 3, 4, '#5a5f6b'); R(c, 21, 26, 3, 4, '#5a5f6b');
  outline(c);
});

// ---- ramen: stove with stock pots (steam animates), counter stools
tile('machi_ramenpot', { solid: true, obj: true, frames: 2, speed: 24 }, (c, r, f) => {
  R(c, 0, 14, 32, 18, '#9aa0aa'); R(c, 0, 14, 32, 2, '#dfe3ea'); R(c, 0, 16, 32, 1, '#7d8391');
  for (const x of [4, 18]) { R(c, x, 22, 10, 6, '#3b3f48'); R(c, x + 1, 23, 8, 4, '#20232a'); P(c, x + 2, 26, '#ff6a2a'); P(c, x + 5, 26, '#ffb02a'); P(c, x + 7, 26, '#ff6a2a'); }
  R(c, 2, 4, 13, 11, '#c8ccd4'); R(c, 2, 4, 13, 1, '#f0f2f6'); R(c, 2, 5, 1, 10, '#e4e7ec'); R(c, 14, 5, 1, 10, '#8a90a0');
  oval(c, 3, 3, 11, 3, '#e8c890'); R(c, 0, 8, 2, 2, CHROME.d); R(c, 15, 8, 2, 2, CHROME.d);
  R(c, 18, 7, 11, 8, '#b8bec8'); R(c, 18, 7, 11, 1, '#e4e7ec'); oval(c, 19, 6, 9, 3, '#f2e6c8');
  R(c, 22, 1, 1, 7, '#8a5a33'); R(c, 21, 0, 3, 2, CHROME.l);
  const s = f ? 1 : 0;
  for (const [x, y] of [[5 + s, 0], [9 - s, 1], [7, -1 + s], [22 + s, 3]]) { R(c, x, y, 2, 1, 'rgba(255,255,255,0.75)'); P(c, x + s, y + 1, 'rgba(255,255,255,0.5)'); }
  outline(c);
});
tile('machi_stool', { obj: true }, (c) => {
  shadowEllipse(c, 16, 28, 6, 1);
  R(c, 15, 15, 2, 12, CHROME.d); R(c, 15, 15, 1, 12, CHROME.l); R(c, 11, 26, 10, 2, CHROME.d);
  oval(c, 9, 10, 14, 7, '#a8202a'); oval(c, 9, 9, 14, 6, '#d8303a'); R(c, 12, 10, 5, 1, '#ff7a80');
  outline(c);
});

// ---- family restaurant: booth seats (left / right), table with plates, drink bar
function booth(c, flip) {
  c.save();
  if (flip) { c.translate(32, 0); c.scale(-1, 1); }
  shadowEllipse(c, 16, 30, 13, 1);
  R(c, 2, 2, 9, 27, '#b8303a'); R(c, 2, 2, 9, 2, '#e85a60'); R(c, 2, 4, 2, 25, '#d84a50'); R(c, 10, 4, 1, 25, '#8a1e28');
  R(c, 11, 12, 18, 16, '#c8383f'); R(c, 11, 12, 18, 2, '#ee6a70'); R(c, 11, 26, 18, 2, '#8a1e28');
  for (const y of [8, 16, 24]) R(c, 4, y, 5, 1, '#9a2630');
  R(c, 2, 28, 27, 3, '#5a3a20'); R(c, 2, 28, 27, 1, '#8a5a33');
  c.restore();
  outline(c);
}
tile('machi_booth_l', { solid: true, obj: true }, (c) => booth(c, false));
tile('machi_booth_r', { solid: true, obj: true }, (c) => booth(c, true));
tile('machi_famtable', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 29, 12, 2);
  R(c, 14, 20, 4, 9, '#5a5f6b'); R(c, 9, 28, 14, 2, '#3b3f48');
  R(c, 1, 6, 30, 14, '#e8dcc4'); R(c, 1, 6, 30, 1, '#fff6e0'); R(c, 1, 19, 30, 2, '#b8a888');
  if (v === 0) {
    oval(c, 3, 8, 13, 9, '#ffffff'); oval(c, 6, 10, 7, 5, '#7a3a1e'); P(c, 8, 11, '#b8683a'); R(c, 11, 9, 3, 2, '#ffd23f'); R(c, 4, 13, 3, 2, '#3f9a4a');
    R(c, 20, 6, 5, 9, '#d4ecf6'); R(c, 20, 9, 5, 6, '#5ed07a'); R(c, 20, 9, 5, 1, '#ffffff'); P(c, 23, 5, '#e0303a');
  } else {
    oval(c, 3, 8, 12, 8, '#ffffff'); R(c, 5, 10, 8, 4, '#f2c230'); R(c, 5, 10, 8, 1, '#ffe07a'); R(c, 8, 9, 2, 3, '#e0303a');
    R(c, 19, 7, 6, 9, '#fff6f0'); R(c, 19, 7, 6, 3, '#ff9ac0'); P(c, 21, 6, '#e0303a'); R(c, 26, 9, 3, 6, '#d4ecf6'); R(c, 26, 11, 3, 4, '#7a3a1e');
  }
  outline(c);
});
tile('machi_drinkbar', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 13, 1);
  R(c, 2, 0, 28, 30, '#c8ccd4'); R(c, 2, 0, 28, 1, '#f0f2f6'); R(c, 2, 1, 1, 28, '#e4e7ec'); R(c, 29, 1, 1, 28, '#8a90a0');
  R(c, 4, 2, 24, 8, '#2a3a5a'); R(c, 5, 3, 22, 2, '#5f8fe6');
  const cols = ['#e0303a', '#ff8a2a', '#5ed07a', '#7a3a1e'];
  for (let i = 0; i < 4; i++) { R(c, 5 + i * 6, 6, 4, 3, cols[i]); P(c, 5 + i * 6, 6, '#ffffff'); }
  R(c, 4, 11, 24, 3, '#5a5f6b');
  for (let i = 0; i < 4; i++) R(c, 6 + i * 6, 14, 2, 3, '#3b3f48');
  R(c, 4, 20, 24, 3, '#7d8391'); R(c, 4, 20, 24, 1, '#b8bec8');
  for (let x = 5; x < 27; x += 2) P(c, x, 21, '#5a5f6b');
  R(c, 13, 16, 5, 4, '#d4ecf6'); R(c, 13, 18, 5, 2, '#ff8a2a');
  R(c, 2, 24, 28, 6, '#9aa0aa'); R(c, 2, 24, 28, 1, '#b8bec8');
  outline(c);
});

// ---- gift shop: flower buckets and a shelf of gifts
tile('machi_flowers', { solid: true, obj: true, variants: 3 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 30, 13, 1);
  R(c, 1, 20, 30, 10, W8.m); R(c, 1, 20, 30, 1, W8.h); R(c, 1, 29, 30, 1, W8.d);
  R(c, 3, 13, 26, 7, W8.l); R(c, 3, 13, 26, 1, W8.h);
  const sets = [['#ff5d8f', '#ffd23f', '#ffffff'], ['#e0303a', '#ff9ac0', '#8a5ac8'], ['#ff8a2a', '#5fd7ff', '#ffd23f']][v];
  for (let i = 0; i < 4; i++) {
    const x = 2 + i * 7, by = i % 2 ? 14 : 21;
    R(c, x + 1, by, 5, 6, i % 2 ? '#9aa0aa' : '#7d8391'); R(c, x + 1, by, 5, 1, '#dfe3ea');
    R(c, x + 3, by - 6, 1, 6, '#3f8a3a');
    const col = sets[i % 3], fy = by - 9;
    disc(c, x + 2, fy + 2, 2, col); disc(c, x + 5, fy + 3, 2, sets[(i + 1) % 3]); disc(c, x + 3, fy, 2, col);
    P(c, x + 2, fy + 2, '#ffd23f'); P(c, x + 3, fy, shade(col, 0.4));
    R(c, x + 1, fy + 5, 2, 1, '#4f9a3a'); R(c, x + 5, fy + 5, 2, 1, '#4f9a3a');
  }
  outline(c);
});
tile('machi_giftshelf', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#f2e6dc'); R(c, 0, 0, 32, 2, '#c87a8a'); R(c, 2, 2, 28, 28, '#fff8f2');
  for (const y of [11, 21]) { R(c, 2, y, 28, 2, W8.l); R(c, 2, y, 28, 1, W8.h); }
  // top: wrapped boxes with ribbons
  const box = (x, y, w, h, col, rib) => { R(c, x, y, w, h, col); R(c, x, y, w, 1, shade(col, 0.3)); R(c, x + (w >> 1), y, 1, h, rib); R(c, x, y + (h >> 1), w, 1, rib); P(c, x + (w >> 1) - 1, y - 1, rib); P(c, x + (w >> 1) + 1, y - 1, rib); };
  if (v === 0) { box(4, 5, 7, 6, '#ff9ac0', '#ffffff'); box(13, 4, 6, 7, '#5fd7ff', '#ffd23f'); box(21, 6, 7, 5, '#ffd23f', '#e0303a'); }
  else { for (let i = 0; i < 4; i++) { const x = 4 + i * 6; R(c, x, 5, 5, 6, ['#2f6b4f', '#c0452f', '#2a3a7a', '#e8c058'][i]); R(c, x, 5, 5, 1, '#e8c058'); R(c, x + 1, 8, 3, 1, '#ffffff'); } }
  // middle: plush bears / tea tins
  for (let i = 0; i < 3; i++) {
    const x = 4 + i * 9;
    if (v === 0) { disc(c, x + 3, 17, 3, '#c8864a'); disc(c, x + 1, 14, 1, '#c8864a'); disc(c, x + 5, 14, 1, '#c8864a'); P(c, x + 2, 16, OUT); P(c, x + 4, 16, OUT); P(c, x + 3, 18, '#7a4a2a'); }
    else { R(c, x, 14, 6, 7, ['#d84a3a', '#2f6fd0', '#8a5ac8'][i]); R(c, x, 14, 6, 1, '#ffffff'); R(c, x + 1, 16, 4, 3, '#fff2d0'); }
  }
  // bottom: boxes of sweets
  for (let i = 0; i < 3; i++) { const x = 3 + i * 9; R(c, x, 24, 8, 5, ['#f2e2c0', '#e0c0d0', '#c8e0c8'][i]); R(c, x, 24, 8, 1, '#ffffff'); R(c, x + 2, 26, 4, 1, '#a8743f'); }
  R(c, 0, 30, 32, 2, '#a89888');
  outline(c);
});

// ---- karaoke room: sofa pieces in a dark booth are built-ins; the screen is a prop below.
// ---- town: a bench facing down already exists ('bench'); a small sandbox edge for the playground:
tile('machi_sandbox', { obj: false, variants: 8 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#e8d29a');
  for (let i = 0; i < 40; i++) P(c, Math.floor(r() * 32), Math.floor(r() * 32), i % 2 ? '#d8bf86' : '#f4e2b0');
  if (v === 1) { oval(c, 6, 9, 14, 9, '#d0b478'); oval(c, 7, 8, 12, 7, '#ecd8a4'); P(c, 10, 9, '#fff6d0'); }
  if (v === 2) { R(c, 18, 17, 5, 4, '#e0402a'); R(c, 18, 17, 5, 1, '#ff8a6a'); R(c, 19, 15, 3, 1, '#3b3f48'); R(c, 8, 8, 1, 6, '#2f6fd0'); R(c, 7, 13, 3, 3, '#2f6fd0'); }
  if (v === 3) { for (let i = 0; i < 4; i++) R(c, 6 + i * 6, 20 - (i % 2), 3, 1, '#c8ae78'); }
});

// ====================================================================== town props
// Static art is painted once on a 2x canvas (1 px = half a unit = 1 screen px).
const baked = new Map();
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (!cv) {
    const [c2, c] = makeCanvas(w * 2, h * 2);
    paint(c);
    cv = c2;
    baked.set(key, cv);
  }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2);
const U = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }; // unit-space rect

// 商店街の入口アーチ: two posts (tiles x and x+4 of row y) and a sign over the passage.
function paintGate(c) {
  // canvas: 80 x 70 units; the posts stand on y = 70 (the bottom of the tile row)
  const G = '#2f6b4f', GL = '#4f9a74', GD = '#1e4a36';
  for (const px of [12, 140]) {
    R(c, px, 40, 10, 96, G); R(c, px, 40, 2, 96, GL); R(c, px + 8, 40, 2, 96, GD);
    R(c, px - 3, 130, 16, 8, '#9aa0aa'); R(c, px - 3, 130, 16, 2, '#c8ccd4'); R(c, px - 3, 136, 16, 2, '#6d717b');
    for (let y = 56; y < 128; y += 18) R(c, px, y, 10, 2, GD);
  }
  // arched beam
  for (let x = 4; x < 156; x++) {
    const t = (x - 80) / 76, y = Math.round(30 + t * t * 10);
    R(c, x, y, 1, 7, '#d62f2f'); R(c, x, y, 1, 1, '#ff6a5a'); R(c, x, y + 6, 1, 1, '#8a1e1a');
  }
  // sign panel
  R(c, 22, 4, 116, 30, '#3a2512'); R(c, 24, 6, 112, 26, '#fff6e0'); R(c, 24, 6, 112, 2, '#ffffff');
  R(c, 26, 28, 108, 2, '#f2dfb8');
  // star on top, small flags on the beam ends
  R(c, 76, 0, 8, 6, '#ffd23f'); R(c, 78, -2 + 2, 4, 2, '#fff2a0');
  for (const [x, col] of [[8, '#ffd23f'], [146, '#2f6fd0']]) { R(c, x, 14, 2, 24, '#5a5f6b'); R(c, x + 2, 14, 8, 6, col); R(c, x + 2, 20, 5, 3, col); }
  outline(c, { tint: 0.3 });
}
function gate(x, y) {
  return {
    type: 'prop', x, y, w: 5, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('machi_gate', 80, 70, paintGate), sx, sy - 54);
      text(ctx, 'ドット商店街', sx + 40, sy - 49.5, { size: 9, align: 'center', color: '#c0302a', shadow: null });
      // lanterns under the beam, swaying a little
      for (let i = 0; i < 3; i++) {
        const lx = sx + 22 + i * 18, ly = sy - 31 + (i === 1 ? 1 : 0), s = Math.round(Math.sin(g.frame / 30 + i) * 1) / 2;
        U(ctx, lx + 1.5 + s, ly - 3, 0.5, 3, '#3a2512');
        U(ctx, lx + s, ly, 4, 5, i === 1 ? '#ffd23f' : '#e8402a'); U(ctx, lx + s, ly, 4, 0.5, '#3a2512'); U(ctx, lx + s, ly + 4.5, 4, 0.5, '#3a2512');
        U(ctx, lx + 0.5 + s, ly + 1, 1, 3, i === 1 ? '#fff2a0' : '#ff8a6a');
      }
    },
  };
}

// Arcade pillar with a hanging banner (1 tile, solid), colours cycle with i.
const BANNER = ['#d62f2f', '#2f6fd0', '#2f9a4a', '#ff8a2a'];
function paintPillar(i) {
  return (c) => {
    // canvas 16 x 48 units, base at the bottom
    const col = BANNER[i % 4];
    R(c, 13, 6, 6, 86, '#7d8391'); R(c, 13, 6, 2, 86, '#b8bec8'); R(c, 17, 6, 2, 86, '#5a5f6b');
    R(c, 9, 84, 14, 10, '#9aa0aa'); R(c, 9, 84, 14, 2, '#c8ccd4'); R(c, 9, 92, 14, 2, '#6d717b');
    R(c, 6, 2, 20, 5, '#5a5f6b'); R(c, 6, 2, 20, 1, '#9aa0aa');
    R(c, 9, 7, 14, 3, '#fff2a0'); R(c, 9, 9, 14, 1, '#e8c058');
    // banner on the side arm
    R(c, 19, 14, 10, 2, '#5a5f6b');
    R(c, 20, 16, 10, 34, col); R(c, 20, 16, 2, 34, shade(col, 0.3)); R(c, 28, 16, 2, 34, shade(col, -0.25));
    R(c, 20, 50, 4, 4, col); R(c, 26, 50, 4, 4, col);
    disc(c, 25, 22, 3, '#ffffff'); R(c, 24, 21, 2, 2, col);
    for (let y = 29; y < 47; y += 4) R(c, 23, y, 4, 2, '#ffffff');
    outline(c, { tint: 0.3 });
  };
}
function pillar(x, y, i, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: ['アーケードの柱だ。', '「ドット商店街」ののぼりが、風にゆれている。'],
    draw(ctx, sx, sy) { blit(ctx, bake('machi_pillar' + (i % 4), 16, 48, paintPillar(i)), sx, sy - 32); },
    ...extra,
  };
}

// 看板ネコ「コロッケ」: sits, blinks, flicks its tail.
function paintCat(c) {
  const O = '#e8963a', D = '#c06a20', L = '#ffd09a';
  oval(c, 6, 12, 18, 12, O); oval(c, 8, 14, 14, 9, L);
  disc(c, 10, 10, 6, O);
  R(c, 5, 2, 3, 5, O); R(c, 13, 2, 3, 5, O); P(c, 6, 4, '#ff9ab8'); P(c, 14, 4, '#ff9ab8');
  for (const [x, y] of [[8, 13], [14, 12], [20, 16]]) R(c, x, y, 3, 1, D);
  R(c, 8, 6, 1, 2, D); R(c, 11, 5, 1, 2, D);
  R(c, 8, 22, 4, 2, L); R(c, 15, 22, 4, 2, L);
  outline(c, { tint: 0.3 });
}
function cat(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy, g) {
      U(ctx, sx + 2, sy + 13, 12, 1, 'rgba(0,0,0,0.22)');
      const t = Math.floor(g.frame / 10) % 24;
      const tail = t < 3 ? -1 : 0;
      U(ctx, sx + 11.5, sy + 10 + tail, 3, 1.5, '#e8963a'); U(ctx, sx + 13.5, sy + 8 + tail, 1.5, 3, '#e8963a'); U(ctx, sx + 13.5, sy + 8 + tail, 1.5, 0.5, '#c06a20');
      blit(ctx, bake('machi_cat', 14, 13, paintCat), sx + 1, sy + 1);
      const blink = Math.floor(g.frame / 8) % 30 === 0;
      U(ctx, sx + 4.5, sy + 5.5, 1, blink ? 0.5 : 1, '#22202a'); U(ctx, sx + 7.5, sy + 5.5, 1, blink ? 0.5 : 1, '#22202a');
      U(ctx, sx + 6, sy + 7, 1, 0.5, '#d86a7a');
    },
    ...extra,
  };
}

// Playground: slide (2x2) and swings (3x2).
function paintSlide(c) {
  // canvas 32 x 44 units, base at the bottom (y 88 px)
  R(c, 8, 30, 3, 58, '#5a5f6b'); R(c, 20, 30, 3, 58, '#5a5f6b');
  for (let y = 38; y < 86; y += 8) R(c, 8, y, 15, 2, '#9aa0aa');
  R(c, 4, 24, 24, 8, '#2f6fd0'); R(c, 4, 24, 24, 2, '#5f8fe6'); R(c, 4, 30, 24, 2, '#1e4a9a');
  R(c, 6, 14, 2, 10, '#ffd23f'); R(c, 24, 14, 2, 10, '#ffd23f'); R(c, 6, 12, 20, 3, '#ffd23f');
  for (let i = 0; i < 26; i++) { const x = 28 + i * 1.3, y = 28 + i * 2.2; R(c, Math.round(x), Math.round(y), 10, 3, '#e8402a'); R(c, Math.round(x), Math.round(y), 10, 1, '#ff8a6a'); }
  R(c, 52, 84, 10, 3, '#e8402a');
  outline(c, { tint: 0.3 });
}
function paintSwings(c) {
  // canvas 48 x 40 units
  const F = '#2f9a4a';
  R(c, 4, 8, 88, 4, F); R(c, 4, 8, 88, 1, '#5ed07a');
  for (const x of [6, 86]) { for (let i = 0; i < 64; i++) { R(c, x - Math.round(i / 12), 10 + i, 3, 1, '#3f8a5a'); R(c, x + Math.round(i / 12), 10 + i, 3, 1, F); } }
  outline(c, { tint: 0.3 });
}
function slide(x, y) {
  return {
    type: 'prop', x, y, w: 2, h: 2,
    text: ['すべり台だ。', 'てっぺんから見ると、商店街のアーケードが見えるらしい。'],
    draw(ctx, sx, sy) { U(ctx, sx + 2, sy + 30, 30, 2, 'rgba(0,0,0,0.18)'); blit(ctx, bake('machi_slide', 32, 44, paintSlide), sx, sy - 12); },
  };
}
function swings(x, y) {
  return {
    type: 'prop', x, y, w: 3, h: 2,
    text: ['ブランコだ。', 'キイ…コ…キイ…コ…。\n子どものころを思い出す。'],
    draw(ctx, sx, sy, g) {
      U(ctx, sx + 4, sy + 30, 40, 2, 'rgba(0,0,0,0.18)');
      blit(ctx, bake('machi_swings', 48, 40, paintSwings), sx, sy - 8);
      for (let i = 0; i < 2; i++) {
        const sw = Math.sin(g.frame / (28 + i * 6) + i * 2) * (i ? 1.5 : 3);
        const ax = sx + 16 + i * 16;
        for (const dx of [-3, 3]) for (let k = 0; k < 18; k++) U(ctx, ax + dx + (sw * k) / 18, sy - 2 + k, 0.5, 1, '#5a5f6b');
        U(ctx, ax - 4 + sw, sy + 16, 9, 2, '#8a5a33'); U(ctx, ax - 4 + sw, sy + 16, 9, 0.5, '#b07a48');
      }
    },
  };
}

// Ducks on the pond (non-solid, drawn over the water).
function ducks(x, y, w, h) {
  return {
    type: 'prop', x, y, w, h, solid: false,
    text: ['カモの親子が、すいすい泳いでいる。', '…ピヨ。'],
    draw(ctx, sx, sy, g) {
      const t = g.frame / 240;
      for (let i = 0; i < 3; i++) {
        const k = t - i * 0.06;
        const cx = sx + (w * 16) / 2 + Math.cos(k * Math.PI * 2) * (w * 16 * 0.32);
        const cy = sy + (h * 16) / 2 + Math.sin(k * Math.PI * 2) * (h * 16 * 0.28);
        const big = i === 0, s = big ? 1 : 0.7, left = Math.sin(k * Math.PI * 2) > 0;
        U(ctx, cx - 4 * s, cy + 2 * s, 8 * s, 0.5, '#bfe6ff');
        U(ctx, cx - 3 * s, cy - 1 * s, 6 * s, 3 * s, big ? '#8a6a4a' : '#e8c058');
        U(ctx, cx + (left ? -3 : 1) * s, cy - 3.5 * s, 2.5 * s, 2.5 * s, big ? '#2f7a4a' : '#e8c058');
        U(ctx, cx + (left ? -4.5 : 3.5) * s, cy - 2.5 * s, 1.5 * s, 1, '#ff9a2a');
      }
    },
  };
}

// Park gazebo (あずまや), 2x2: four posts, a bench inside, a hip roof.
function paintGazebo(c) {
  // canvas 32 x 44 units, the floor at the bottom 32 units
  R(c, 4, 60, 56, 26, '#c8b088'); R(c, 4, 60, 56, 2, '#e0caa0'); R(c, 4, 84, 56, 2, '#9a8460');
  for (const x of [8, 52]) { R(c, x, 34, 4, 50, '#7a5028'); R(c, x, 34, 1, 50, '#a8743f'); }
  R(c, 16, 66, 32, 6, '#8a5a33'); R(c, 16, 66, 32, 1, '#b07a48'); R(c, 18, 72, 3, 8, '#5a3a20'); R(c, 43, 72, 3, 8, '#5a3a20');
  // roof
  for (let i = 0; i < 26; i++) { const w = 18 + i * 2; R(c, 32 - w, 8 + i, w * 2, 1, i < 4 ? '#3f7a5a' : i % 6 === 5 ? '#2a5a40' : '#2f6b4f'); }
  R(c, 4, 34, 56, 3, '#2a5a40'); R(c, 4, 34, 56, 1, '#4f9a74');
  R(c, 29, 2, 6, 7, '#c9a227'); R(c, 30, 2, 2, 7, '#ffd23f');
  outline(c, { tint: 0.3 });
}
function gazebo(x, y) {
  return {
    type: 'prop', x, y, w: 2, h: 2,
    text: ['池のほとりの「あずまや」だ。', '屋根の下のベンチで、近所のお年寄りが\n将棋をさしていることもあるらしい。'],
    draw(ctx, sx, sy) { U(ctx, sx + 1, sy + 30, 31, 2, 'rgba(0,0,0,0.2)'); blit(ctx, bake('machi_gazebo', 32, 44, paintGazebo), sx, sy - 12); },
  };
}

// Signboards: a wooden board on a post (1 tile, solid), the label drawn live.
function paintBoard(c) {
  R(c, 14, 20, 4, 28, '#6b4526'); R(c, 14, 20, 1, 28, '#8a5a33');
  R(c, 1, 2, 30, 22, '#8a5a33'); R(c, 1, 2, 30, 2, '#b07a48'); R(c, 3, 5, 26, 17, '#fbf3df'); R(c, 3, 5, 26, 1, '#ffffff');
  outline(c, { tint: 0.3 });
}
function board(x, y, label, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy) {
      blit(ctx, bake('machi_board', 16, 24, paintBoard), sx, sy - 8);
      text(ctx, label, sx + 8, sy - 5.5, { size: label.length > 3 ? 4 : 5, align: 'center', color: '#3a2512', shadow: null });
    },
    ...extra,
  };
}
// Community notice board (掲示板): several papers pinned on a wide board.
function paintNotice(c) {
  for (const x of [4, 26]) { R(c, x, 22, 3, 26, '#6b4526'); R(c, x, 22, 1, 26, '#8a5a33'); }
  R(c, 0, 2, 32, 24, '#6b4526'); R(c, 0, 2, 32, 2, '#8a5a33'); R(c, 2, 5, 28, 19, '#c8a070');
  const papers = [[4, 7, 8, 9, '#ffffff'], [14, 6, 7, 7, '#fff2a0'], [22, 8, 6, 10, '#ffd8e4'], [5, 17, 7, 5, '#d8f0ff'], [14, 15, 7, 7, '#ffffff']];
  for (const [x, y, w, h, col] of papers) { R(c, x, y, w, h, col); for (let k = y + 2; k < y + h - 1; k += 2) R(c, x + 1, k, w - 2, 1, '#b8b0a0'); P(c, x + (w >> 1), y, '#d62f2f'); }
  outline(c, { tint: 0.3 });
}
function notice(x, y, extra = {}) {
  return { type: 'prop', x, y, w: 1, h: 1, draw(ctx, sx, sy) { blit(ctx, bake('machi_notice', 16, 24, paintNotice), sx, sy - 8); }, ...extra };
}
// Direction post with two arrow boards.
function paintPost(c) {
  R(c, 14, 6, 4, 42, '#6b4526'); R(c, 14, 6, 1, 42, '#8a5a33');
  for (const [y, left] of [[6, true], [20, false]]) {
    const x0 = left ? 1 : 3;
    R(c, x0 + (left ? 4 : 0), y, 24, 11, '#fbf3df'); R(c, x0 + (left ? 4 : 0), y, 24, 1, '#ffffff');
    for (let k = 0; k < 5; k++) R(c, left ? x0 + 4 - k : x0 + 24 + k, y + k, 1, 11 - k * 2, '#fbf3df');
    R(c, x0 + (left ? 4 : 0), y + 10, 24, 1, '#d8c8a8');
  }
  outline(c, { tint: 0.3 });
}
function post(x, y, top, bottom, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy) {
      blit(ctx, bake('machi_post', 16, 24, paintPost), sx, sy - 8);
      text(ctx, top, sx + 9.5, sy - 5, { size: 4, align: 'center', color: '#3a2512', shadow: null });
      text(ctx, bottom, sx + 7, sy + 2, { size: 4, align: 'center', color: '#3a2512', shadow: null });
    },
    ...extra,
  };
}

// Washing machines in the laundromat window (building decorate hook, world units).
function washers(ctx, px, py, t) {
  for (const x of [5, 16, 52, 63]) {
    const y = py + 43;
    U(ctx, px + x, y, 10, 12, '#e8ecf0'); U(ctx, px + x, y, 10, 0.5, '#ffffff'); U(ctx, px + x + 9.5, y, 0.5, 12, '#9aa0aa');
    U(ctx, px + x + 2, y + 3, 6, 6, '#5a5f6b'); U(ctx, px + x + 2.5, y + 3.5, 5, 5, '#8ad0f0');
    const k = Math.floor(t / 6 + x) % 4;
    U(ctx, px + x + 3 + (k % 2) * 2, y + 4 + (k >> 1) * 2, 2, 1.5, '#ffffff');
    U(ctx, px + x + 1, y + 1, 2, 1, '#2f6fd0');
  }
}

// ====================================================================== town interactions
const KAICHO = { name: '商店街の会長', look: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#3a58a8', bottom: '#2a2d36', glasses: true } };
const TAIYAKI = { name: 'たい焼き屋のおやじさん', look: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#ffffff', bottom: '#2a3560', apron: '#2a3a7a' } };

const NOTICES = [
  '【お知らせ】毎週水曜日は「スーパー まるどっと」の特売日！\n食材とお惣菜が2割引です。',
  '【住まいのこと】家賃は毎週月曜日の朝にお支払い。\nお部屋さがしは「ドット不動産」へ。',
  '【健康づくり】DOT GYMで5日トレーニングするたびに、\n体力の最大値がアップ！（最大+20）',
  '【気分転換】カラオケ、ジョギング、カフェ…。\nストレスがたまると、お仕事の調子も落ちますよ。',
  '【身だしなみ】hair salon ドットで整えた日は、\nお仕事の評判が上がるかも？',
  '【自炊のすすめ】スーパーで食材を買って、家で料理しよう。\nカレーは2皿分できて、お弁当にもなります。',
  '【迷いネコ】…ではありません。看板ネコの「コロッケ」です。\nシャッターの前で、よくひなたぼっこしています。',
  '【なかよし】カフェやファミレスに友だちをさそうと、\nもっと仲良くなれるかも。',
];
let noticeIdx = 0;
async function readNotice(g) {
  await g.say(['商店街の掲示板だ。', NOTICES[noticeIdx++ % NOTICES.length]]);
}

async function laundry(g) {
  const i = await g.ask('コインランドリーだ。\n服をまとめて洗濯する？\n（¥300・身だしなみ +25）', ['洗濯する', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(300)) { await g.say('小銭が足りない…。'); return; }
  g.sfx('coin');
  const a = snap(g);
  await beat(g, ['cursor', 'cursor', 'cursor', 'chime'], 260);
  g.relax({ clean: 25, stress: onceADay(g, 'laundry', 3) });
  await g.say(['ゴウン、ゴウン…。\n待っているあいだ、置いてあったマンガを読んだ。', `洗いたてのシャツは、お日さまのにおい！\n${diffText(g, a)}`]);
}

async function buyTaiyaki(g) {
  const o = who(TAIYAKI);
  const i = await g.ask('へい、らっしゃい！\n焼きたてのたい焼き、1匹¥150だよ！', ['ここで食べる', '持ち帰る', 'やめておく'], { ...o, cancel: 2 });
  if (i === 2 || i < 0) { await g.say('またおいで！\nしっぽまで、あんこぎっしりだよ！', o); return; }
  if (i === 0 && !g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。\n（持ち帰りもできるよ）'); return; }
  if (!g.spend(150)) { await g.say('おっと、¥150足りないみたいだね。\nまた今度！', o); return; }
  g.sfx('coin');
  if (i === 1) { g.giveItem('machi_taiyaki'); await g.say('まいど！\n熱いうちに食べなよ！', o); return; }
  const a = snap(g);
  g.eat(12, { silent: true, fill: 20 });
  g.relax({ stress: 3 });
  await g.say(['はふはふ…あつっ！\n外はカリッ、中はあんこたっぷり！', diffText(g, a)]);
}

async function takeBus(g) {
  const i = await g.ask('バス停だ。\n「東京駅前」行きのバスが来た！\n乗っていく？（¥210）', ['乗る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(210)) { await g.say('運賃が足りない…。\n歩いていこう。（東の大通りを行けば東京エリア）'); return; }
  g.sfx('coin');
  await g.fadeOut(16);
  g.sfx('door');
  await g.wait(600);
  await g.goto('tokyo', 'main', 53, 31, 'down');
  await g.say('ブロロロ…。\n東京駅前でバスを降りた。');
}

async function jog(g) {
  const n = dayCount(g, 'machi_jog');
  const i = await g.ask('「ドット中央公園 ジョギングコース\n1周 約400m」\n走ってみる？（無料・体力 -8）', ['走る', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (g.state.stamina < 8) { await g.say('体力が足りない…。\n走るのは、休んでからにしよう。'); return; }
  g.useStamina(8);
  const a = snap(g);
  await beat(g, ['cursor', 'cursor', 'cursor', 'cursor'], 180);
  const relief = [15, 8, 3][Math.min(2, n)];
  g.relax({ stress: relief });
  g.addNeed('hunger', -6);
  g.addNeed('clean', -10);
  bumpDay(g, 'machi_jog');
  const line = n === 0 ? 'タッタッタッ…。\n池のまわりを、気持ちよく1周走った！' : n === 1 ? 'もう1周！\n…ちょっと息が上がってきた。' : 'ぜえ、ぜえ…。\n今日はもう、走りすぎかも…。';
  const pages = [line, (diffText(g, a) || 'いい汗をかいた。') + (n >= 2 ? '\n（気分転換の効果は、1日に何周もすると小さくなる）' : '')];
  if (g.state.life.hunger < HUNGRY) pages.push('…おなかがペコペコだ。\n何か食べないと、力が出ない。');
  await g.say(pages);
}

async function restBench(g) {
  if (today(g, 'machi_bench_day')) { await g.say('ベンチに座って、ぼーっと池をながめた。\n…いい天気だ。'); return; }
  g.setFlag('machi_bench_day', g.state.day);
  const a = snap(g);
  g.relax({ stress: 4 });
  await g.say(['ベンチに座って、ひと休み。\n風が気持ちいい…。', diffText(g, a) || 'のんびりした。']);
}

async function petCat(g) {
  if (today(g, 'machi_cat_day')) { await g.say('コロッケは、まるくなって寝ている。\n…すぴー。'); return; }
  g.setFlag('machi_cat_day', g.state.day);
  g.sfx('cursor');
  const a = snap(g);
  g.relax({ stress: 3 });
  const lines = ['看板ネコの「コロッケ」だ。\nなでると、ゴロゴロのどを鳴らした。', 'にゃ〜ん。'];
  if (g.state.fame >= 2000) lines.push('…商店街の人気者の座は、\nまだこのネコにはかなわない気がする。');
  lines.push(diffText(g, a) || 'ほっこりした。');
  await g.say(lines);
}

// The same 会長 who looks for festival acts at よしもと 東京本部 (places/yoshimoto.js):
// same look, same Kansai voice.
async function kaichoTalk(g, npc) {
  const o = who(npc);
  const lines = [];
  const matsuri = Number(g.state.jobs && g.state.jobs.yoshimoto_matsuri) || 0;
  if (!g.flag('machi_kaicho')) {
    g.setFlag('machi_kaicho');
    lines.push(g.flag('yoshimoto_matsuri_met')
      ? 'おっ、{name}さんやないか！\nよう来てくれたな。\nここが、うちの商店街や！'
      : 'おっ、見ん顔やな。\nようこそ、ドット商店街へ！\nわしは、この商店街の会長や。');
    lines.push('こんなしゃべり方やけど、生まれは大阪でな。\nこの商店街に来て、もう四十年や。\nすっかり東京の商店街の顔やで！');
  }
  lines.push(
    '食材ならスーパー、腹ごしらえはラーメン屋。\n疲れたらカフェでひと休み、\n汗を流すならジムやで。',
    'お部屋さがしはドット不動産、\n家具ならドット家具。\n暮らしのことなら、なんでもそろうで！',
  );
  if (matsuri) lines.push('お祭りのステージ、ほんまおおきに！\n商店街のみんな、いまだに\nあの話で盛り上がっとるで。');
  else if (g.state.agency) lines.push('ときどき、よしもと 東京本部のロビーで\nお祭りに出てくれる芸人さんを探しとるんや。\n見かけたら、声かけてや！');
  if (g.state.fame >= 1000) lines.push('{name}さんが来てくれるおかげで、\n商店街もずいぶんにぎやかになったわ！\nわっはっは。');
  else lines.push('暮らしを整えるのも、芸の肥やしや。\nよう食べて、よう休んで、よう笑う！\nこれがいちばんやで。');
  await g.say(lines, o);
}

// ====================================================================== the town
// [R9-A] The town grew (round 9): x 48..75 east of the old map (the station with its tracks behind
// it, the 駅前広場, ドット区役所 moved from the old north-east corner to the main street, 郵便局・
// 銀行・コンビニ, a 横丁 of small eateries and ドット小学校) and rows 34..53 to the south (a 住宅街
// with lanes and houses). The old map's x 0..47 / rows 0..33 keep their coordinates (the arcade is
// longer: two more shops where the 区役所 stood). The layout is written in these "old" rows; MACHI_TOP
// extra rows are added on top at the end of generate() (the tracks and the rooftops beyond them).
export const MACHI_W = 76;
export const MACHI_H = 54;
export const MACHI_TOP = 2;
const STATION = { x: 52, y: 1, w: 12, h: 4, door: 6 };          // ドット商店街駅 (old rows)
// [R9-A] the station entrance: a train arrival appears in front of the station's door
export const EKI = { x: STATION.x + STATION.door, y: STATION.y + STATION.h + MACHI_TOP, dir: 'down' };

function machiSmoking() {
  const api = PLACES.kanraku && PLACES.kanraku.api;
  if (!api || !api.smokingSpot) return [];
  return [api.smokingSpot(36, 12, { town: 'machi' }), api.smokingPost(20, 18, { town: 'machi' }), api.smokingPost(12, 14, { town: 'machi' })];
}

// ---- the 住宅街 (rows 34..53): two rows of houses along lanes; N-S lanes at x 19, 33..34 and 62..63
const HOUSE_SEGS = [[1, 18], [20, 32], [35, 46], [52, 61], [64, 74]];
const NAMES = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '松本', '井上', '木村', '林', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川'];
const HOUSE_TALK = [
  '庭先で、植木に水をやった跡がある。', '家の中から、ピアノの練習の音が聞こえる。', '玄関の前に、子どもの自転車がとめてある。',
  'ワンワン！…庭で犬がしっぽをふっている。', '夕ごはんの、いいにおいがする…。', 'ベランダで洗濯物がゆれている。',
  'テレビの音が聞こえる。…バラエティ番組みたいだ。', '「回覧板」が、門のところにはさまっている。',
];
function residents() {
  const out = [];
  let n = 0;
  for (const [row, y] of [[0, 38], [1, 45]]) {
    for (const [a, b] of HOUSE_SEGS) {
      let x = a + (row && a > 1 ? 1 : 0) + (a === 1 ? 1 : 0);
      while (x + 4 <= b) {
        const w = Math.min(b - x + 1, (n + row) % 3 === 0 ? 6 : 5);
        if (w < 4) break;
        const k = n * 7 + row;
        const name = NAMES[n % NAMES.length];
        // one of every few is a small アパート (the engine's two-storey flats), the rest are 一軒家
        if (n % 7 === 3) {
          out.push({ type: 'building', x, y, w, h: 4, door: 1, name: `アパート ${['メゾンさくら', 'コーポ若葉', 'ハイツ緑町', 'ドット荘別館'][(n >> 2) % 4]}`, kind: 'house', wall: ['#efe2bf', '#e6eef2', '#f2e6d0', '#e8dcc0'][n % 4], roof: ['#8a5a33', '#5a6f8a', '#6a4a33', '#4a5568'][n % 4],
            text: ['小さなアパートだ。', HOUSE_TALK[n % HOUSE_TALK.length]] });
        } else {
          out.push(house(x, y, { w, h: 4, k, name, text: [`「${name}」と表札が出ている。`, HOUSE_TALK[n % HOUSE_TALK.length]] }));
        }
        x += w + 1 + ((n + row) % 4 === 0 ? 1 : 0);
        n++;
      }
    }
  }
  return out;
}

function generate() {
  const W = MACHI_W, H = MACHI_H;
  const c = grid(W, H, 'grass');

  // ---- main road (its east end walks to 東京エリア)
  hroad(c, 15, 1, W - 1); // sidewalk 14, road 15..17, sidewalk 18
  for (const x of [14, 15, 16, 29, 30, 31, 57, 58, 59]) for (let y = 15; y <= 17; y++) set(c, x, y, 'crosswalk_h');
  // ---- the 住宅街's road (rows 35..36) and the east street (x 48..50) down to it and the lanes
  for (let x = 0; x < W; x++) for (const y of [35, 36]) set(c, x, y, 'road');
  vroad(c, 48, 15, 50);
  for (let x = 48; x <= 50; x++) { set(c, x, 19, 'crosswalk_v'); set(c, x, 34, 'crosswalk_v'); }

  // ---- 商店街 arcade street (y 5..8; x 1..47, two more shops at its east end) and the passage under the gate
  fill(c, 1, 5, 47, 4, 'machi_arcade');
  fill(c, 13, 9, 5, 5, 'machi_arcade');
  for (let x = 2; x <= 40; x++) if (x < 13 || x > 17) put(c, x, 9, x % 5 === 0 ? 'planter' : 'hedge');
  for (let y = 10; y <= 12; y++) { put(c, 13, y, 'planter'); put(c, 17, y, 'planter'); }
  fill(c, 1, 9, 1, 5, 'sidewalk'); // west alley
  fill(c, 41, 9, 3, 5, 'sidewalk'); // east lane (arcade -> main road)
  // bicycle parking
  fill(c, 36, 10, 5, 4, 'stone');
  for (let x = 36; x <= 39; x++) put(c, x, 10, 'bicycle');
  put(c, 40, 10, 'vending');
  for (let y = 1; y <= 4; y++) put(c, 1, y, 'hedge');
  // arcade benches between the pillars, a produce stand and a wagon on the south side
  for (const x of [6, 21, 31]) put(c, x, 8, 'bench');
  put(c, 35, 8, 'trash');
  put(c, 9, 8, 'machi_produce'); put(c, 10, 8, 'machi_produce');

  // ---- 駅前: the station plaza (x 48..74, rows 5..8), the 交番 and the bicycle parking beside the station
  fill(c, 48, 1, 27, 8, 'stone');
  for (let x = 70; x <= 74; x++) put(c, x, 4, 'bicycle');
  fill(c, 44, 9, 31, 5, 'stone');                      // forecourts of the 駅前 buildings
  for (const x of [44, 48, 57, 59, 66, 73]) put(c, x, 9, 'planter');
  put(c, 74, 9, 'vending'); put(c, 66, 13, 'mailbox');
  for (const x of [50, 66]) put(c, x, 8, 'bench');
  put(c, 49, 5, 'sign_board');

  // ---- street furniture along the road
  for (const x of [7, 25, 39, 55, 64]) put(c, x, 14, 'lamp');
  for (const x of [6, 23, 36, 44, 56, 68]) put(c, x, 18, 'lamp');

  // ---- south of the road: hedge line, residential side (west), ドット中央公園, the 横丁 and the school (east)
  for (let x = 1; x <= 74; x++) if (![10, 11, 18, 19, 29, 30, 31].includes(x) && !(x >= 47 && x <= 51)) put(c, x, 19, 'hedge');
  fill(c, 10, 19, 2, 9, 'sidewalk');
  fill(c, 18, 19, 2, 9, 'sidewalk');
  fill(c, 1, 28, 21, 2, 'sidewalk'); // residential lane
  // greenery behind the apartment buildings
  for (let x = 2; x <= 9; x++) { put(c, x, 20, x % 2 ? 'tree' : 'bush'); put(c, x, 21, 'bush'); }
  for (let x = 12; x <= 17; x++) { put(c, x, 20, x % 2 ? 'bush' : 'tree'); put(c, x, 21, 'bush'); put(c, x, 22, 'bush'); }
  for (let y = 20; y <= 27; y++) put(c, 1, y, y % 2 ? 'tree' : 'bush');
  // small garden, the garbage corner by the houses, a path down to the 住宅街
  fill(c, 16, 30, 3, 2, 'flowers');
  fill(c, 19, 30, 1, 5, 'path');
  put(c, 18, 32, 'trash');
  put(c, 1, 30, 'tree'); put(c, 8, 32, 'mailbox'); put(c, 15, 32, 'bicycle');
  fill(c, 1, 34, 19, 1, 'path'); // the lane in front of コーポひだまり / ハイツこもれび

  // park
  for (let y = 20; y <= 34; y++) if (y !== 28 && y !== 29) put(c, 20, y, 'hedge');
  fill(c, 20, 28, 2, 2, 'path');
  fill(c, 29, 19, 3, 2, 'path');
  fill(c, 22, 21, 23, 1, 'path'); fill(c, 22, 33, 23, 1, 'path');
  fill(c, 22, 21, 1, 13, 'path'); fill(c, 44, 21, 1, 13, 'path');
  fill(c, 33, 34, 2, 1, 'path');                       // the park's south gate
  // pond
  fill(c, 24, 23, 8, 6, 'stone');
  fill(c, 25, 24, 6, 4, 'water');
  // playground
  fill(c, 35, 23, 5, 3, 'machi_sandbox');
  for (const [x, y] of [[21, 22], [21, 32], [45, 21], [45, 25], [45, 30], [33, 23], [42, 31], [24, 31], [32, 31], [43, 22], [23, 34], [37, 34], [40, 34]]) put(c, x, y, x % 2 ? 'tree' : 'sakura');
  for (const [x, y] of [[33, 29], [34, 29], [33, 30], [34, 30], [41, 28], [42, 28], [27, 30], [28, 30], [36, 31], [37, 31]]) set(c, x, y, 'flowers');
  for (const x of [25, 29]) put(c, x, 29, 'bench');
  for (const [x, y] of [[31, 25], [34, 25], [31, 28], [34, 28], [32, 28], [33, 28]]) set(c, x, y, 'flowers');
  for (const [x, y] of [[40, 30], [43, 27], [36, 30], [24, 22]]) put(c, x, y, x % 2 ? 'tree' : 'sakura');
  put(c, 38, 32, 'bench'); put(c, 26, 32, 'trash');
  for (let x = 21; x <= 46; x++) if (!c[34][x][1] && x !== 33 && x !== 34) put(c, x, 34, x % 4 ? 'bush' : 'tree');
  for (let y = 20; y <= 33; y++) if (!c[y][46][1]) put(c, 46, y, y % 3 ? 'bush' : 'tree');
  for (let y = 22; y <= 32; y += 2) if (!c[y][45][1]) put(c, 45, y, 'bush');

  // the 横丁 (rows 20..23): small eateries facing a lantern-lit lane; the school (rows 24..34)
  fill(c, 52, 20, 23, 4, 'stone');
  for (let x = 52; x <= 74; x++) put(c, x, 24, [52, 57, 62, 67, 72].includes(x) ? 'lantern' : 'fence');
  fill(c, 52, 25, 23, 9, 'grass');
  for (const [x, y] of [[53, 25], [53, 28], [67, 25], [70, 26], [73, 25], [72, 28], [68, 28]]) put(c, x, y, (x + y) % 2 ? 'sakura' : 'tree');
  fill(c, 53, 30, 21, 4, 'sand');                      // 校庭
  for (let x = 52; x <= 74; x++) if (x !== 60 && x !== 61) put(c, x, 34, 'fence');
  for (let y = 25; y <= 33; y++) if (y !== 30 && y !== 31) put(c, 52, y, 'fence');
  fill(c, 52, 30, 1, 2, 'path'); fill(c, 60, 34, 2, 1, 'path');
  for (const x of [56, 62, 68]) put(c, x, 33, 'bench');
  for (let y = 30; y <= 33; y++) put(c, 74, y, y % 2 ? 'tree' : 'sakura');

  // ---- 住宅街 (rows 37..53): back gardens, houses on two rows, lanes, N-S connectors
  for (const y of [37, 44]) for (let x = 1; x <= 74; x++) put(c, x, y, (x * 3 + y) % 5 === 0 ? 'tree' : 'hedge');
  fill(c, 1, 42, 74, 2, 'sidewalk');
  fill(c, 1, 49, 74, 2, 'sidewalk');
  for (const x of [19, 33, 34, 62, 63]) for (let y = 37; y <= 48; y++) set(c, x, y, 'path');
  for (const x of [47, 51]) for (let y = 37; y <= 50; y++) set(c, x, y, 'sidewalk');
  for (let x = 1; x <= 74; x++) { put(c, x, 51, (x * 7) % 4 ? 'bush' : 'tree'); put(c, x, 52, (x * 5) % 3 ? 'tree' : 'sakura'); }
  for (const [x, y] of [[8, 43], [27, 43], [41, 50], [57, 43], [70, 50], [14, 50]]) put(c, x, y, 'bicycle');
  for (const [x, y] of [[4, 50], [38, 43], [66, 43]]) put(c, x, y, 'mailbox');
  for (const [x, y] of [[23, 50], [55, 50]]) put(c, x, y, 'vending');

  border(c, 'tree');
  // the tracks behind the arcade and the station run on past both edges (row 0 here, one more above)
  for (let x = 0; x < W; x++) set(c, x, 0, 'rail');
  // the road ends at the town's edges: the residential road runs on (a barrier), the main road to Tokyo
  for (const x of [0, W - 1]) { set(c, x, 35, 'road', 'cone'); set(c, x, 36, 'road', 'cone'); }
  for (let y = 14; y <= 18; y++) set(c, W - 1, y, y === 14 || y === 18 ? 'sidewalk' : y === 16 ? 'road_line_h' : 'road');
  const warps = [];
  for (let y = 14; y <= 18; y++) warps.push({ x: W - 1, y, place: 'tokyo', room: 'main', tx: 1, ty: y + 5, dir: 'right' });

  const ARC = { type: 'building', y: 1, h: 4, kind: 'arcade' };
  const SMALL = { type: 'building', y: 20, h: 3, kind: 'small' };
  const entities = [
    // ---- 商店街 (arcade row, doors on y 4)
    { ...ARC, x: 2, w: 4, door: 2, place: 'hanaya', name: 'フラワー＆ギフト はなや', sign: { text: 'はなや', bg: '#ffffff', color: '#2f9a4a' }, awning: ['#2f9a4a', '#ffffff'], display: 'flowers', wall: '#f4efe6' },
    { ...ARC, x: 6, w: 7, door: 3, place: 'super', name: 'スーパー まるどっと', sign: { text: 'スーパーまるどっと', bg: '#ffffff', color: '#d62f2f' }, display: 'produce', awning: ['#d84a3a', '#ffffff'] },
    { ...ARC, x: 13, w: 4, door: 2, place: 'ramen', name: 'らーめん まるどっと亭', sign: { text: 'らーめん', bg: '#d62f2f', color: '#ffffff' }, display: 'counter', doorKind: 'noren', noren: '#2a2d36', awning: ['#20232a', '#d62f2f'], wall: '#f4e6cc', lanterns: true },
    { ...ARC, x: 17, w: 5, door: 2, place: 'cafe', name: 'CAFE ドット', sign: { text: 'CAFE ドット', bg: '#3a2c24', color: '#fff3dc' }, display: 'cafe', doorKind: 'woodglass', awning: ['#2f6b4f', '#f4efe6'], wall: '#efe4d4' },
    { ...ARC, x: 22, w: 5, door: 2, place: 'salon', name: 'hair salon ドット', sign: { text: 'hair salon ドット', bg: '#ffffff', color: '#8a5ac8' }, display: 'mirrors', awning: ['#b890d0', '#ffffff'], wall: '#f6eef4' },
    { ...ARC, x: 27, w: 5, door: 2, name: 'コインランドリー', sign: { text: 'コインランドリー', bg: '#2f6fd0', color: '#ffffff' }, display: 'plain', awning: ['#5fb8e8', '#ffffff'], wall: '#eef4f8', talk: laundry, decorate: washers },
    { ...ARC, x: 32, w: 4, door: 2, name: 'たい焼き 金ドット', sign: { text: 'たい焼き', bg: '#2a3a7a', color: '#ffffff' }, display: 'counter', awning: ['#2a3a7a', '#ffffff'], wall: '#f6ead2', talk: buyTaiyaki },
    { ...ARC, x: 36, w: 4, door: 2, name: '空き店舗', sign: { text: '貸店舗', bg: '#e8e4dc', color: '#5a5f6b' }, display: 'plain', doorKind: 'shutter', awning: ['#9aa0aa', '#d5d9e0'], wall: '#e4e0d8',
      text: ['シャッターが閉まっている。\n「貸店舗　お問い合わせはドット不動産まで」', '…シャッターの前は、看板ネコの特等席らしい。'] },
    { ...ARC, x: 40, w: 4, door: 2, name: 'ドット書店', sign: { text: 'ドット書店', bg: '#ffffff', color: '#2a3a7a' }, display: 'books', awning: ['#2a3a7a', '#ffffff'], wall: '#f2ece0',
      text: ['町の本屋さん「ドット書店」だ。', '店先に、今週のテレビ情報誌と週刊誌が平積みになっている。\n…芸能ニュースの見出しが、やけに大きい。'] },
    { ...ARC, x: 44, w: 4, door: 2, name: 'ドラッグストア ドット', sign: { text: 'ドラッグストア', bg: '#2f9a4a', color: '#ffffff' }, display: 'goods', awning: ['#2f9a4a', '#ffffff'], wall: '#eef6ee',
      text: ['ドラッグストアだ。', '「本日ポイント5倍」の貼り紙。\nのどあめに湿布、日用品…店先のワゴンがにぎやかだ。'] },

    // ---- along the main road (doors on y 13)
    { type: 'building', x: 2, y: 10, w: 5, h: 4, door: 2, place: 'fudousan', name: 'ドット不動産', kind: 'shop', wall: '#eef2f6', roof: '#2f6fd0', sign: { text: 'ドット不動産', bg: '#2f6fd0', color: '#ffffff' }, display: 'listings' },
    { type: 'building', x: 7, y: 10, w: 6, h: 4, door: 3, place: 'kagu', name: 'ドット家具', kind: 'shop', wall: '#e9dfd0', roof: '#6b4a2e', sign: { text: 'ドット家具', bg: '#6b4a2e', color: '#fff3e0' }, display: 'furniture', awning: '#6b4a2e' },
    { type: 'building', x: 18, y: 10, w: 7, h: 4, door: 3, place: 'famires', name: 'ファミレス ドットキッチン', kind: 'restaurant', sign: { text: 'ドットキッチン', bg: '#ffffff', color: '#c0392b' } },
    { type: 'building', x: 25, y: 10, w: 6, h: 4, door: 3, place: 'gym', name: 'DOT GYM', kind: 'gym', sign: { text: 'DOT GYM' } },
    { type: 'building', x: 31, y: 10, w: 5, h: 4, door: 2, place: 'karaoke', name: 'カラオケ ドットボックス', kind: 'shop', wall: '#3a2a4a', roof: '#ff4f8b', sign: { text: 'カラオケ', bg: '#20232a', color: '#ff7eb6' }, display: 'karaoke', neon: '#ff7eb6' },

    // ---- 駅前 (x 44..74): the station, the 交番, 郵便局・ドット区役所 (js/places/kuyakusho.js)・銀行・コンビニ
    { type: 'building', ...STATION, place: 'machi_eki', name: 'ドット商店街駅', kind: 'station', wall: '#ece4d4', roof: '#3a5a8a', sign: { text: 'ドット商店街駅', bg: '#ffffff', color: '#20232a' }, signW: 96, enter: ekiEnter('machi') },
    { type: 'building', x: 66, y: 2, w: 4, h: 3, door: 2, name: '駅前交番', kind: 'shop', wall: '#f4f4f0', roof: '#3a4a6a', sign: { text: '交番', bg: '#ffffff', color: '#2a3a7a' }, display: 'plain',
      text: ['駅前の交番だ。', 'おまわりさんがパトロールに出ているようだ。\n「パトロール中」の札がかかっている。'] },
    { type: 'building', x: 44, y: 10, w: 5, h: 4, door: 2, name: 'ドット郵便局', kind: 'shop', wall: '#f6f2ec', roof: '#c8281c', stripes: ['#c8281c', '#ffffff'], sign: { text: '〒 郵便局', bg: '#ffffff', color: '#c8281c' }, display: 'plain',
      text: ['郵便局だ。', '窓口には、小包を出す人と、\n通帳を手にした人が並んでいる。'] },
    { type: 'building', x: 49, y: 9, w: 8, h: 5, door: 3, place: 'kuyakusho', name: 'ドット区役所', kind: 'office', rise: 1, wall: '#e4e2d8', roof: '#5a6a7a', canopy: '#2a5088', plants: true, sign: { text: 'ドット区役所', bg: '#2a3a5a', color: '#ffffff' }, signH: 16 },
    // (期日前投票 from 2003-12; before it, the same floor is the 不在者投票 office — kuyakusho.js)
    { type: 'sign', x: 50, y: 13, talk: (g) => {
      let y = 2026;
      try { y = typeof g.lawDate === 'function' ? g.lawDate().ym : 202604; } catch (e) { y = 202604; }
      const vote = y >= 200312 ? '期日前投票所' : '不在者投票の受付';
      return g.say(['入口のわきに「ドット区役所」の各階の案内が掲げてある。', `1階：住民課・税務課（確定申告の相談）\n2階：選挙管理委員会・${vote}`, '3階：区民相談室（暮らしやお金の相談）\n5階：区議会']);
    } },
    { type: 'building', x: 60, y: 10, w: 6, h: 4, door: 3, name: 'ドット銀行', kind: 'office', rise: 0, wall: '#e8ecf2', roof: '#2a4a7a', canopy: '#2a4a7a', sign: { text: 'ドット銀行', bg: '#2a4a7a', color: '#ffffff' },
      text: ['銀行だ。「ドット銀行 商店街支店」。', 'ATMコーナーに、短い行列ができている。'] },
    { type: 'building', x: 67, y: 10, w: 6, h: 4, door: 3, name: 'ドットマート 商店街駅前店', kind: 'konbini', sign: { text: 'ドットマート' },
      text: ['コンビニ「ドットマート」。', '駅前の店は、朝と夕方がいちばん混む。\n…食べ物を買うなら、商店街のスーパーが安い。'] },

    // ---- the 横丁 (doors on row 22)
    { ...SMALL, x: 52, w: 4, door: 2, name: '居酒屋 とりあえず', wall: '#f4e6cc', roof: '#3a2a20', sign: { text: '居酒屋', bg: '#2a3a7a', color: '#ffffff' }, noren: '#2a3a7a',
      text: ['居酒屋「とりあえず」。', '「とりあえず、生！」の声が、外まで聞こえてくる。'] },
    { ...SMALL, x: 57, w: 4, door: 2, name: '焼き鳥 ドット', wall: '#f6e7c8', roof: '#5a3a20', sign: { text: '焼き鳥', bg: '#d62f2f', color: '#ffffff' }, noren: '#d62f2f',
      text: ['焼き鳥屋だ。', 'けむりと、たれのこげる香り…。\nカウンターは、仕事帰りの人でいっぱいだ。'] },
    { ...SMALL, x: 62, w: 4, door: 2, name: '中華そば 一番', kind: 'ramen', wall: '#f4e6cc', sign: { text: '中華そば', bg: '#d62f2f', color: '#ffffff' },
      text: ['昔ながらの中華そば屋だ。', '「開店は夕方5時から」と書いてある。'] },
    { ...SMALL, x: 67, w: 4, door: 2, name: '立ち飲み ドット', wall: '#efe2bf', roof: '#3a3a40', sign: { text: '立ち飲み', bg: '#ffd23f', color: '#20232a' }, noren: '#20232a',
      text: ['立ち飲みの店だ。', 'ビール一杯と、おでんひと皿。\n…「一杯だけ」のはずが、みんな長居している。'] },
    { ...SMALL, x: 71, w: 4, door: 2, name: 'スナック 夕顔', wall: '#e8dcd8', roof: '#5a3a5a', sign: { text: 'スナック', bg: '#3a1a3a', color: '#ffb0e0' }, noren: '#7a1a5a',
      text: ['スナック「夕顔」。', 'まだ準備中だ。\n…夜になると、カラオケの歌声が聞こえてくるらしい。'] },
    // ---- ドット小学校 (door on row 29; the 校庭 south of it)
    { type: 'building', x: 54, y: 26, w: 12, h: 4, door: 6, name: 'ドット小学校', kind: 'office', rise: 0, wall: '#f2efe6', roof: '#7a8a9a', glass: '#9fc8e0', sign: { text: 'ドット小学校', bg: '#ffffff', color: '#2a5a3a' }, signH: 16,
      text: ['区立ドット小学校だ。', '校舎の時計の下に、「元気に　なかよく　かしこく」。\n校庭から、子どもたちの声が聞こえる。'] },

    // ---- residential side (doors on y 27 / 33) and neighbours' houses
    { type: 'building', x: 2, y: 22, w: 8, h: 6, door: 4, place: 'mansion', name: 'ドットレジデンス', kind: 'mansion', sign: { text: 'ドットレジデンス' } },
    { type: 'building', x: 12, y: 23, w: 6, h: 5, door: 3, place: 'tower', name: 'ドットタワー', kind: 'tower', style: 'residential', rise: 3, sign: { text: 'DOT TOWER' } },
    { type: 'building', x: 2, y: 30, w: 6, h: 4, door: 2, name: 'コーポひだまり', kind: 'house', wall: '#f2e6d0', roof: '#5a6f8a', sign: { text: 'コーポひだまり', bg: '#fff6e0' },
      text: ['木造のアパート「コーポひだまり」。', 'ベランダで、ふとんがのんびり干されている。'] },
    { type: 'building', x: 9, y: 30, w: 6, h: 4, door: 3, name: 'ハイツこもれび', kind: 'house', wall: '#e6eef2', roof: '#8a5a33', sign: { text: 'ハイツこもれび', bg: '#ffffff' },
      text: ['アパート「ハイツこもれび」。', 'どこかの部屋から、ギターの練習の音が聞こえる。\n…同じフレーズばかりだ。'] },
    ...residents(),

    // ---- 喫煙所 by the bicycle parking and 路上喫煙禁止 plates (ネオン街's shared props, js/world/kanraku.js;
    // the rule itself is the justice core's 'machi' smoking rule: the street is no-smoking from 2020-04)
    ...machiSmoking(),
    // ---- props & signs
    gate(13, 13),
    { type: 'sign', x: 13, y: 13, solid: true, text: ['「ドット商店街」の入口アーチだ。', 'はなや・スーパー・ラーメン・カフェ・美容院…\nアーケードの下に、お店がずらりと並んでいる。'] },
    { type: 'sign', x: 17, y: 13, solid: true, text: ['入口アーチの柱に、案内図が貼ってある。', '【アーケード】はなや／スーパー まるどっと／らーめん／\nCAFE ドット／hair salon／コインランドリー／たい焼き／\nドット書店／ドラッグストア', '【大通り】ドット不動産／ドット家具／ドットキッチン／\nDOT GYM／カラオケ　【東・駅前】駅／郵便局／区役所／\n銀行／コンビニ／横丁　【南】公園／小学校／住宅街'] },
    ...[3, 8, 12, 18, 23, 28, 33, 38, 43].map((x, i) => pillar(x, 8, i)),
    commuterTrain(64, -1, { text: ['電車が駅に入ってきた。', '駅の改札は、駅舎の入口から。'] }),
    cat(38, 5, { talk: petCat }),
    notice(40, 13, { talk: readNotice }),
    post(74, 13, '商店街', '東京', { text: ['道しるべだ。', '← ドット商店街（アーケード・駅）\n→ 東京エリア（ドット荘・事務所・テレビ局）'] }),
    { type: 'sign', x: 49, y: 5, text: ['「ドット商店街駅」の案内板だ。', '← アーケード（ドット商店街）\n↓ 区役所・郵便局・銀行・コンビニ／大通り', '大通りの南：横丁・ドット小学校・住宅街\n大通りを東へ行けば、東京エリア。'] },
    busStop(38, 19, { text: undefined, talk: takeBus }),
    board(32, 20, '公園', { text: undefined, talk: jog }),
    slide(40, 23),
    swings(35, 27),
    ducks(25, 24, 6, 4),
    gazebo(32, 26),
    { type: 'sign', x: 28, y: 20, text: ['「ドット中央公園」', '池のまわりは、1周約400mのジョギングコース。\n入口の看板の前から走れます。'] },
    { type: 'sign', x: 18, y: 32, text: ['ゴミ捨て場の看板だ。', '「燃えるゴミは月・木。\n　ゴミ出しは朝8時までに！」\n…カラスよけのネットがかかっている。'] },
    { type: 'sign', x: 60, y: 34, text: ['ドット小学校の裏門だ。', '「下校の時間です。車に気をつけて帰りましょう」\n…と放送が聞こえる。'] },

    // ---- people
    { type: 'npc', id: 'machi_kaicho', x: 18, y: 14, dir: 'down', look: KAICHO.look, name: KAICHO.name, talk: kaichoTalk },
    { type: 'npc', id: 'machi_shufu', x: 8, y: 6, dir: 'down', look: { ...LOOKS.mom, top: '#e8c058', apron: '#ff9ab8' }, name: '買い物中の主婦', wander: 2,
      text: ['今日の晩ごはん、カレーにしようかしら。', 'カレーはね、多めに作って\n次の日のお弁当にするのがコツなのよ。', '水曜日はスーパーの特売日。\n食材が2割引になるの、見逃せないわ！'] },
    { type: 'npc', id: 'machi_ramenfan', x: 16, y: 6, dir: 'up', look: { ...LOOKS.salaryman, tie: '#d62f2f' }, name: 'ラーメン好きの会社員',
      text: ['ここのラーメンは腹持ちがいいんだ。\nおなかがすいてると、仕事に集中できないからね。', 'スタンプを10個集めると、1杯タダになるんだ。\nあと3個…！'] },
    { type: 'npc', id: 'machi_jk', x: 35, y: 14, dir: 'left', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#2a3560', bottom: '#5a6f8a', skirt: true, ribbon: '#d62f2f' }, name: '女子高生',
      text: ['カラオケで思いっきり歌うと、\nストレスなんて吹っ飛ぶよ！', '採点で高い点が出ると、\n歌もうまくなってる気がするんだよね〜。'] },
    { type: 'npc', id: 'machi_oneesan', x: 26, y: 6, dir: 'down', look: { hair: 'bob', hairColor: 'purple', skin: 'light', top: '#ffffff', bottom: '#8a5ac8', skirt: true }, name: '美容院帰りのお姉さん', wander: 1,
      text: ['髪を切ったら、気分まで軽くなっちゃった！', '身だしなみが整ってると、\nお仕事の評判もいいんだって。\nあなたも行ってみたら？'] },
    { type: 'npc', id: 'machi_heyasagashi', x: 6, y: 14, dir: 'up', look: { ...LOOKS.salaryman, top: '#5a6f8a', tie: '#ffd23f' }, name: '部屋さがし中の人',
      text: ['いま、部屋さがし中なんです。\nドットレジデンスか、ドットタワーか…。', '家賃は毎週月曜の朝に払うでしょう？\n高い部屋は、そのぶんしっかり稼がないと…。'] },
    { type: 'npc', id: 'machi_resident', x: 8, y: 28, dir: 'down', look: { hair: 'cap', hat: '#2f6b4f', hairColor: 'black', skin: 'fair', top: '#5a8a6a', bottom: '#3b3f48', apron: '#e8c058' }, name: '掃除当番の住人さん',
      text: ['ドットレジデンスの住人です。\n今日はマンションの掃除当番なんですよ。', '入居したいなら、商店街の「ドット不動産」で\n相談するといいですよ。\n広いお部屋は、ぐっすり眠れますから。'] },
    { type: 'npc', id: 'machi_jogger', x: 44, y: 27, dir: 'up', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#2f9a4a', bottom: '#20232a' }, name: 'ジョギング中の人', wander: 3,
      text: ['ハッ、ハッ…。\nジョギングは、お金のかからない気分転換さ！', '走ったあとは汗だくだから、\nお風呂かシャワーを忘れずにね！'] },
    { type: 'npc', id: 'machi_obaachan', x: 27, y: 30, dir: 'up', look: { ...LOOKS.oldwoman, top: '#e86f8a' }, name: 'ベンチのおばあちゃん',
      text: ['カモさんたちを見てるとね、\n時間を忘れちゃうのよ。', 'お仕事がつらいときは、\nここでぼーっとするといいわよ。\nお金もかからないしねえ。'] },
    { type: 'npc', id: 'machi_painter', x: 30, y: 22, dir: 'down', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#e8c058', bottom: '#5a6f8a', hat: '#c0452f' }, name: 'スケッチ中の画家さん',
      text: ['池のカモを描いてるの。\n…動くから、なかなかむずかしいのよ。', '仕事のほかに、夢中になれる趣味があるとね、\n心のバランスがとれるの。\nあなたの趣味は、なあに？'] },
    { type: 'npc', id: 'machi_kid', x: 37, y: 26, dir: 'down', look: { ...LOOKS.kid, top: '#5fd7ff' }, name: 'こども', wander: 2,
      text: ['すべり台のてっぺんで、\nヒーローの決めポーズの練習してるんだ！', 'ねえ、テレビの人？\n…ちがうの？じゃあ、これからなる人？'] },
    { type: 'npc', id: 'machi_fan', x: 11, y: 6, dir: 'down', look: { ...LOOKS.fan, top: '#ff9ab8' }, name: 'ファンの子', cond: (g) => g.state.fame >= 250,
      talk: async (g, npc) => {
        await g.emote(npc.id, '!');
        const lines = ['あっ…！{name}さんですよね！？\nテレビで見ました！', 'まさか商店街で会えるなんて…！\nこれからも応援してます！'];
        if (g.state.fame >= 2000) lines.push('この商店街の自慢なんですよ、{name}さん！');
        await g.say(lines, who(npc));
        g.emote(npc.id, '♥');
      } },
    { type: 'npc', id: 'machi_taiyaki', x: 34, y: 5, dir: 'down', look: TAIYAKI.look, name: TAIYAKI.name, talk: buyTaiyaki },
    // 駅前・横丁・小学校・住宅街
    { type: 'npc', id: 'machi_ekiin', x: 61, y: 6, dir: 'down', look: { ...LOOKS.guard, top: '#2a3a5a', hat: '#2a3a5a' }, name: '駅員さん',
      text: ['ドット商店街駅です。', '駅を出て左が、アーケードの商店街。\n区役所や銀行は、駅前の大通りぞいですよ。'] },
    { type: 'npc', id: 'machi_kuyakusho_visitor', x: 54, y: 14, dir: 'up', look: { ...LOOKS.oldman, top: '#6a5a4a' }, name: '手続き帰りのおじいさん', wander: 1,
      text: ['住民票をとりに来たんじゃ。', '区役所は、むかしは商店街のいちばん奥にあってのう。\n駅前に移って、ずいぶん便利になったわい。'] },
    { type: 'npc', id: 'machi_yokocho', x: 66, y: 23, dir: 'down', look: { ...LOOKS.salaryman, top: '#4a4a5a', tie: '#c0452f', blush: true }, name: '仕事帰りの会社員', wander: 2,
      text: ['いやあ、この横丁は落ち着くねえ。', '一杯だけ…一杯だけのつもりなんだけどね。'] },
    { type: 'npc', id: 'machi_pupil1', x: 58, y: 31, dir: 'down', look: { ...LOOKS.kid, top: '#ff8a3d' }, name: '小学生', wander: 3,
      text: ['休み時間は、ドッジボール！', 'きのうテレビで見た芸人さんのギャグ、\nクラスでみんなマネしてるんだ！'] },
    { type: 'npc', id: 'machi_pupil2', x: 66, y: 32, dir: 'left', look: { ...LOOKS.kid, top: '#ff7eb6', hairColor: 'black' }, name: '小学生', wander: 2,
      text: ['大きくなったら、なにになろうかなあ。', 'テレビに出る人？\n…それとも、テレビを作る人？'] },
    { type: 'npc', id: 'machi_dogwalk', x: 28, y: 43, dir: 'right', look: { ...LOOKS.oldwoman, top: '#5a8ac8' }, name: '犬の散歩中のおばあさん', wander: 4,
      text: ['この子と朝夕、町内をひとまわりするのが日課なの。', 'このへんはね、古い家と新しい家がまじってて、\n歩いてるだけで楽しいのよ。'] },
    { type: 'npc', id: 'machi_kairanban', x: 56, y: 49, dir: 'up', look: { ...LOOKS.mom, top: '#e8a0b8' }, name: '回覧板をまわす人',
      text: ['町内会の回覧板です。', '「来月の第一日曜日は、ドット中央公園の清掃です。\n　ご協力をお願いします」…ですって。'] },
  ];

  const events = [
    { x: 25, y: 29, on: 'action', run: restBench },
    { x: 29, y: 29, on: 'action', run: restBench },
    { x: 38, y: 32, on: 'action', run: restBench },
  ];
  // two rows above the shops: the second track and the rooftops beyond it
  c.unshift(Array.from({ length: W }, () => ['rail']));
  c.unshift(Array.from({ length: W }, (_, x) => ['grass', x % 4 === 1 ? 'bush' : 'tree']));
  for (const list of [entities, events, warps]) for (const e of list) e.y += MACHI_TOP;
  return { w: W, h: H + MACHI_TOP, cells: c, entities, warps, events };
}

registerPlace({
  id: 'machi',
  name: 'ドット商店街',
  kind: 'town',
  bgm: 'town',
  start: { room: 'main', x: MACHI_W - 2, y: 16 + MACHI_TOP, dir: 'left' },
  rooms: {
    main: {
      generate,
      bg: '#62b35b',
      topPad: 24,
      // a save made on a tile the town has since built over steps to the nearest free tile
      onEnter: async (g) => {
        unstick(g);
        if (g.flag('machi_intro')) return;
        g.setFlag('machi_intro');
        await g.wait(250);
        await g.say([
          'にぎやかな通りに出た。\nアーケードの入口に「ドット商店街」の文字が見える。',
          '食材、カフェ、ジム、カラオケ…。\n暮らしのことなら、ここでそろいそうだ。',
          ...(PLACES.kuyakusho ? ['駅前の大通りぞいには「ドット区役所」。\n選挙の届出や、お金・暮らしの相談はそこでできるらしい。'] : []),
        ]);
      },
    },
  },
});

// ====================================================================== interiors: shared bits
// A sale banner on a wall (world units), drawn live so the label can change.
function wallBanner(x, y, w, label, colors = ['#ffd23f', '#d62f2f']) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy, g) {
      const [bg, fg] = colors;
      U(ctx, sx + 1, sy + 1, w * 16 - 2, 10, '#3a2512');
      U(ctx, sx + 1.5, sy + 1.5, w * 16 - 3, 9, bg); U(ctx, sx + 1.5, sy + 1.5, w * 16 - 3, 0.5, '#ffffff');
      for (let i = 0; i < w * 4 - 1; i++) U(ctx, sx + 2 + i * 4, sy + 10.5, 2, 1.5, fg);
      text(ctx, typeof label === 'function' ? label(g) : label, sx + w * 8, sy + 2.5, { size: 6, align: 'center', color: fg, shadow: null });
    },
  };
}
const firstVisit = async (g, key, lines, n) => {
  if (g.flag('machi_met_' + key)) return;
  g.setFlag('machi_met_' + key);
  await g.wait(200);
  await g.say(lines, n ? who(n) : {});
};

// ====================================================================== スーパー まるどっと
const SUPER_CLERK = { name: 'レジの店員さん', look: { ...LOOKS.clerk, top: '#ffffff', apron: '#d84a3a' } };
const DELI_LADY = { name: 'お惣菜のおばちゃん', look: { ...LOOKS.mom, top: '#ffffff', apron: '#ffd23f', hairColor: 'brown' } };
const SECTIONS = {
  meat: { title: '精肉・鮮魚・たまご', items: ['ing_pork', 'ing_chicken', 'ing_fish', 'ing_egg', 'ing_tofu'], sale: true },
  staple: { title: 'お米・めん・調味料', items: ['ing_rice', 'ing_noodle', 'ing_curry', 'ing_miso'], sale: true },
  veg: { title: '青果コーナー', items: ['ing_cabbage', 'ing_veg', 'machi_banana'], sale: true },
  daily: { title: '日用品・インスタント', items: ['machi_bathsalt', 'machi_aroma', 'machi_wax', 'machi_cupmen'] },
  books: { title: '本・CDコーナー', items: ['manga', 'book', 'cd'] },
  deli: { title: 'お惣菜', items: ['machi_korokke', 'machi_bento'], sale: true },
  all: { title: '食材（全部）', items: Object.keys(INGREDIENTS), sale: true },
};
const GREET = {
  meat: '今日のお肉もお魚も、新鮮ですよ〜！',
  staple: 'お米とカレールウは、自炊の強い味方！',
  veg: 'シャキシャキの野菜、入ってます！',
  daily: '暮らしのお役立ち品、そろってます。',
  books: '話題の本とCD、入荷しました！',
  deli: '揚げたてコロッケ、おいしいよ〜！',
  all: 'いらっしゃいませ！',
};
async function superShop(g, key) {
  const s = SECTIONS[key];
  const sale = s.sale && isWed(g) ? 0.8 : 1;
  const list = goods(s.items, sale);
  if (!list.length) { await g.say('（いまは品切れのようだ…）'); return 0; }
  return g.shop(list, { title: s.title + (sale < 1 ? '（水曜特売 2割引）' : ''), greeting: sale < 1 ? '本日は特売日！2割引ですよ！' : GREET[key] });
}
// The daily-goods shelf: shopping, or 「万引きする…？」 (a clear warning first, then
// g.commitCrime('shoplifting') — ネオン街's shared api, looked up when used).
async function superDaily(g) {
  const api = PLACES.kanraku && PLACES.kanraku.api;
  if (!api) return superShop(g, 'daily');
  const k = await g.ask('日用品やインスタント食品の棚だ。', ['買い物する', 'ながめるだけ', '万引きする…？'], { cancel: 1 });
  if (k === 0) return superShop(g, 'daily');
  if (k === 2) return api.shoplift(g, { where: 'スーパー まるどっと', items: ['machi_cupmen', 'machi_bathsalt', 'machi_wax'] });
  return 0;
}
async function superClerk(g, npc) {
  const o = who(npc);
  const i = await g.ask(isWed(g) ? 'いらっしゃいませ！\n本日水曜日は特売日、\n食材とお惣菜が2割引です！' : 'いらっしゃいませ！\n毎週水曜日は特売日ですよ〜。', ['食材をまとめて買う', 'おすすめレシピ', '自炊のコツ', 'なんでもない'], { ...o, cancel: 3 });
  if (i === 0) await superShop(g, 'all');
  else if (i === 1) await g.say(['レシピのチラシをくれた。', recipeHint(g), 'お家のキッチンで作ってみてくださいね！'], o);
  else if (i === 2) {
    await g.say([
      '食材をそろえて、お家のキッチンで料理すると\nお惣菜より安上がりで、体にもいいんですよ。',
      'はじめてなら、肉野菜炒めがおすすめ！\n豚こま肉とキャベツがあれば、できますよ。\nお米と卵なら、卵かけごはんも。',
      '食材の説明には、その食材を使う料理が\n書いてあります。お買い物の参考にどうぞ！',
      'カレーは2皿分できるから、1皿はお弁当に。\nお弁当は、お仕事の合間に食べられます。',
      '作ったことのない料理には「★」がついてます。\nいろいろ挑戦すると、料理の腕も上がりますよ！',
    ], o);
  } else await g.say('ありがとうございました〜！', o);
}

registerPlace({
  id: 'super',
  name: 'スーパー まるどっと',
  kind: 'building',
  bgm: 'machi_shop',
  start: { room: 'store', x: 7, y: 8, dir: 'up' },
  rooms: {
    store: {
      floor: 'floor_tile',
      wall: 'white',
      tiles: [
        '################',
        '#=w==p=====p=c=#',
        '#NNNN.SS.SS.BBD#',
        '#..............#',
        '#.VV..SS..GG...#',
        '#.VV..SS..GG...#',
        '#..............#',
        '#LLL.....RR.KK.#',
        '#..............#',
        '#######MM#######',
      ],
      legend: {
        N: 'machi_meatcase', S: 'machi_staples', B: 'bookshelf', D: 'machi_cdrack', V: 'machi_produce',
        G: 'shelf_goods', L: 'machi_deli', R: 'register', K: 'machi_baskets',
      },
      warps: [{ x: 7, y: 9, to: 'exit' }, { x: 8, y: 9, to: 'exit' }],
      entities: [
        wallBanner(6, 1, 4, (g) => (isWed(g) ? '本日特売日！2割引' : '毎週水曜は特売日')),
        { type: 'sign', x: 8, y: 1, talk: async (g) => { await g.say(['特売のお知らせが貼ってある。', '「毎週水曜日は特売日！\n　食材・お惣菜 2割引」', isWed(g) ? '…今日は水曜日だ！' : `（今日は${WEEKDAYS[weekdayOf(g.state.day)]}曜日）`]); } },
        { type: 'npc', id: 'super_clerk', x: 9, y: 6, dir: 'down', look: SUPER_CLERK.look, name: SUPER_CLERK.name, talk: superClerk },
        { type: 'npc', id: 'super_deli', x: 2, y: 6, dir: 'down', look: DELI_LADY.look, name: DELI_LADY.name,
          talk: async (g, npc) => { const n = await superShop(g, 'deli'); await g.say(n ? '毎度ありがと！\nコロッケは、おやつにもいいわよ〜。' : 'また寄ってってね〜。\n揚げたては、いまだけよ！', who(npc)); } },
        { type: 'npc', id: 'super_mom', x: 12, y: 4, dir: 'left', look: { ...LOOKS.mom, top: '#5fb8a8' }, name: 'お客さん', wander: 1,
          text: ['お米と卵と鶏肉があれば、親子丼。\nお米とお魚とみそなら、焼き鮭定食。', '組み合わせを考えるのが、楽しいのよね。'] },
        { type: 'npc', id: 'super_student', x: 4, y: 5, dir: 'left', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#2f6fd0', bottom: '#3b3f48' }, name: '一人暮らしの学生',
          text: ['お金がピンチのときは、もやし炒めっす。\nキッチンがあれば¥100で作れるっすよ。', 'でも、たまにはちゃんと肉も食べたい…。'] },
      ],
      events: [
        { x: 1, y: 2, w: 4, on: 'action', run: (g) => superShop(g, 'meat') },
        { x: 6, y: 2, w: 2, on: 'action', run: (g) => superShop(g, 'staple') },
        { x: 9, y: 2, w: 2, on: 'action', run: (g) => superShop(g, 'staple') },
        { x: 6, y: 4, w: 2, h: 2, on: 'action', run: (g) => superShop(g, 'staple') },
        { x: 2, y: 4, w: 2, h: 2, on: 'action', run: (g) => superShop(g, 'veg') },
        { x: 10, y: 4, w: 2, h: 2, on: 'action', run: superDaily },
        { x: 12, y: 2, w: 3, on: 'action', run: (g) => superShop(g, 'books') },
        { x: 12, y: 7, w: 2, on: 'action', run: (g) => g.say('買い物かごが積んである。\n…今日は何を作ろうかな？') },
      ],
      onEnter: (g) => firstVisit(g, 'super', ['いらっしゃいませ〜！\nスーパー まるどっとへようこそ！', '食材は棚の前で、お惣菜はおばちゃんに。\n奥には本とCDのコーナーもありますよ。'], SUPER_CLERK),
    },
  },
});

// ====================================================================== CAFE ドット
const BARISTA = { name: 'カフェのマスター', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#ffffff', bottom: '#3a2c24', apron: '#2f6b4f', beard: true } };
const CAKE_OF_DAY = ['いちごのショートケーキ', 'ガトーショコラ', 'チーズケーキ', 'モンブラン', 'フルーツタルト', 'シフォンケーキ', 'ロールケーキ'];
function cafeMenu(g) {
  const cake = CAKE_OF_DAY[weekdayOf(g.state.day)];
  return [
    { name: 'ブレンドコーヒー', price: 400, stress: 8, desc: 'マスター自慢の、深いりブレンド。', text: '香ばしい香り…。\nひと口ごとに、頭がすっきりしていく。' },
    { name: 'カフェラテ', price: 480, stress: 10, desc: 'ミルクたっぷり。ラテアートつき。', text: 'ラテアートのハートが、こっちを見ている。\n…かわいくて飲めない。（飲んだ）' },
    { name: 'ハーブティー', price: 450, stress: 12, desc: 'カモミールのブレンド。リラックス効果大。', text: 'カモミールのやさしい香り。\n肩の力が、ふっとぬけていく…。' },
    { name: 'ケーキセット', price: 900, heal: 12, fill: 22, stress: 15, desc: `本日のケーキ「${cake}」とドリンクのセット。`, text: `本日のケーキは「${cake}」！\nあまい幸せが、口いっぱいに広がる…。` },
    { name: 'パンケーキ', price: 850, heal: 15, fill: 35, stress: 10, desc: '3段重ねのふわふわパンケーキ。', text: 'ふわっふわ…！\nメープルシロップを、たっぷりかけた。' },
    { name: 'たまごサンド', price: 550, heal: 18, fill: 30, stress: 3, desc: '厚焼き卵のサンドイッチ。軽食に。', text: 'ふかふかのパンに、厚焼き卵。\n…これは、おかわりしたくなる。' },
  ];
}
async function cafeOrder(g, npc) {
  await orderMenu(g, { title: 'CAFE ドット メニュー', entries: cafeMenu(g), host: npc || BARISTA, thanks: pick(['ごゆっくりどうぞ。', 'またのお越しを、お待ちしております。', 'いい顔になりましたね。']) });
}

registerPlace({
  id: 'cafe',
  name: 'CAFE ドット',
  kind: 'building',
  bgm: 'machi_cafe',
  start: { room: 'main', x: 5, y: 7, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_wood_dark',
      wall: 'wood',
      tiles: [
        '############',
        '#=w=m=hh=w=#',
        '#...P.....P#',
        '#ct..EKKKX.#',
        '#..........#',
        '#ct..ct....#',
        '#..........#',
        '#ct......ct#',
        '#####MM#####',
      ],
      legend: {
        m: 'wall_wood+machi_menuboard', h: 'wall_wood+machi_wallshelf', P: 'plant',
        c: 'machi_cafechair', t: 'machi_cafetable', E: 'machi_espresso', K: 'counter', X: 'machi_cakecase',
      },
      warps: [{ x: 5, y: 8, to: 'exit' }, { x: 6, y: 8, to: 'exit' }],
      entities: [
        { type: 'npc', id: 'cafe_master', x: 7, y: 2, dir: 'down', look: BARISTA.look, name: BARISTA.name, talk: (g, n) => cafeOrder(g, n) },
        { type: 'npc', id: 'cafe_writer', x: 7, y: 5, dir: 'left', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#c87a8a', bottom: '#3a3f4a', skirt: true, glasses: true }, name: '脚本家志望のお客さん',
          text: ['ここで脚本を書いてるの。\nいつか、テレビドラマになるのが夢。', 'うまくいかないときは、ハーブティーを一杯。\nストレスがたまると、いいセリフが出てこないのよね。'] },
        { type: 'npc', id: 'cafe_regular', x: 3, y: 7, dir: 'left', look: { ...LOOKS.oldman, top: '#5a6f8a' }, name: '常連のおじいさん',
          text: ['ここのマスターのコーヒーは、町いちばんじゃ。', '若いもんは、がんばりすぎるからのう。\nたまには、こうしてぼんやりするのも仕事のうちじゃよ。'] },
      ],
      events: [
        { x: 9, y: 3, on: 'action', run: async (g) => { await g.say(`ショーケースにケーキが並んでいる。\n本日のケーキは「${CAKE_OF_DAY[weekdayOf(g.state.day)]}」だ。`); await cafeOrder(g); } },
        { x: 5, y: 3, on: 'action', run: (g) => g.say('ピカピカのエスプレッソマシンだ。\nシューッと、ミルクをあたためる音がする。') },
        { x: 2, y: 3, on: 'action', run: (g) => g.say('窓ぎわの席だ。\n商店街を行き交う人たちが見える。') },
      ],
      onEnter: (g) => firstVisit(g, 'cafe', ['いらっしゃいませ。\nCAFE ドットへ、ようこそ。', 'ご注文は、カウンターでどうぞ。\nお疲れのときは、ハーブティーがおすすめですよ。'], BARISTA),
    },
  },
});

// ====================================================================== カラオケ ドットボックス
const KARAOKE_PRICE = 1200;
const KARAOKE_CLERK = { name: 'カラオケの店員さん', look: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#8a5ac8', bottom: '#2a2430' } };
const SONG_LIST = [
  { name: 'ぽかぽか日だまりバラード', label: 'しっとりバラード', difficulty: 1, lanes: 1, desc: 'ゆったりしたテンポ。初心者にもおすすめ。' },
  { name: '夏色サイダー', label: 'アイドルソング', difficulty: 2, lanes: 2, desc: '元気いっぱいのアイドルソング。' },
  { name: 'ネオンシティ・ロック', label: 'ロックナンバー', difficulty: 3, lanes: 4, desc: 'ノリノリのロック。ちょっとむずかしい。' },
  { name: '早口ことばラプソディ', label: '早口ソング', difficulty: 4, lanes: 4, desc: '舌をかみそうな早口ソング。上級者向け！' },
];
const karaokePaid = (g) => today(g, 'machi_karaoke_day');
async function karaokeDesk(g, npc) {
  const o = who(npc);
  if (karaokePaid(g)) { await g.say(['3番のお部屋でーす！\n今日は何曲でも歌い放題っすよ！', '奥のドアからどうぞ〜。'], o); return; }
  const i = await g.ask(`いらっしゃいませ〜！\nフリータイム、今日1日歌い放題で\n${fmtMoney(KARAOKE_PRICE)}っす！`, ['歌う', 'やめておく'], { ...o, cancel: 1 });
  if (i !== 0) { await g.say('また来てくださいね〜！', o); return; }
  if (!g.spend(KARAOKE_PRICE)) { await g.say('あ〜、お金が足りないみたいっすね…。\nまたのお越しを〜！', o); return; }
  g.sfx('coin');
  g.setFlag('machi_karaoke_day', g.state.day);
  await g.say(['3番のお部屋へどうぞ〜！\n奥のドアっす。', '採点モードで高得点が出ると、\n歌がうまくなるって評判っすよ！'], o);
}
async function sing(g) {
  if (!karaokePaid(g)) { await g.say('（受付をすませてから歌おう）'); return; }
  if (g.state.stamina < 5) { await g.say('体力が足りない…。\nのどもカラカラだ。少し休もう。'); return; }
  const k = await g.list({
    title: '曲をえらぶ（体力 -5）',
    items: SONG_LIST.map((s) => ({ label: s.label, right: '★'.repeat(s.difficulty) })),
    x: 12, y: 44, w: 340, px: true,
    describe: (j) => `「${SONG_LIST[j].name}」\n${SONG_LIST[j].desc}`,
  });
  if (k < 0) return;
  const s = SONG_LIST[k];
  g.useStamina(5);
  const res = await g.minigame('rhythm', { difficulty: s.difficulty, lanes: s.lanes, song: s.name, title: 'カラオケ', skill: 'uta' });
  const good = 'SAB'.includes(res.rank);
  const n = bumpDay(g, 'machi_karaoke_songs');
  const a = snap(g);
  // singing song after song still feels good, but less each time (like jogging laps)
  g.relax({ stress: (good ? [25, 15, 8, 4] : [10, 6, 3, 2])[Math.min(3, n - 1)] });
  const lines = [`採点結果…${res.score}点！（ランク${res.rank}）`];
  lines.push(res.rank === 'S' ? '画面に「プロ級！」の文字が光った！\n思わずガッツポーズ！' : good ? 'いい感じに歌えた！\n声を出すって、気持ちいい！' : 'うーん、音程がちょっと…。\nでも、思いきり歌ってすっきりした！');
  const parts = [diffText(g, a)];
  let tail = n >= 3 ? '\n（何曲も歌うと、気分転換の効果は小さくなる）' : '';
  if (good && n <= 3) { g.addSkill('uta', 1, true); parts.push(`${SKILLS.uta}+1（${g.state.skills.uta}）`); }
  else if (good) tail += '\n（今日はたくさん歌った。歌の練習効果は、また明日）';
  lines.push((parts.filter(Boolean).join('　') || 'すっきりした！') + tail);
  g.sfx(good ? 'applause' : 'cursor');
  await g.say(lines);
}
// The big screen in the booth (2 tiles), with scrolling lyrics.
function karaokeScreen(x, y) {
  return {
    type: 'prop', x, y, w: 2, h: 1,
    text: undefined, talk: sing,
    draw(ctx, sx, sy, g) {
      U(ctx, sx - 2, sy - 6, 36, 22, '#20232a'); U(ctx, sx - 1.5, sy - 5.5, 35, 0.5, '#4a4e58');
      U(ctx, sx, sy - 4, 32, 17, '#2a1a4a');
      const t = g.frame;
      for (let i = 0; i < 5; i++) { const px = (i * 9 + t / 4) % 34; U(ctx, sx + px - 1, sy - 3 + i * 3, 2, 1, ['#ff7eb6', '#5fd7ff', '#ffd23f', '#9af0b0', '#ffffff'][i]); }
      const k = (t / 2) % 28;
      U(ctx, sx + 2, sy + 7, 28, 2, '#ffffff'); U(ctx, sx + 2, sy + 7, k, 2, '#5fd7ff');
      U(ctx, sx + 4, sy + 10.5, 24, 1, '#c8c0e0');
      U(ctx, sx + 12, sy + 14, 8, 2, '#20232a');
    },
  };
}
// Mirror ball + sweeping coloured spots over the booth.
function karaokeLights(ctx, g, cam) {
  const t = g.frame;
  const cx = 6.5 * TILE - cam.x, cy = 1.9 * TILE - cam.y;
  U(ctx, cx - 0.25, cy - 16, 0.5, 11, '#9aa0aa');
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 10) U(ctx, cx + i * 1.5 - 0.75, cy + j * 1.5 - 0.75, 1.5, 1.5, (i + j + Math.floor(t / 8)) % 3 ? '#c8ccd4' : '#ffffff');
  const cols = ['rgba(255,126,182,0.22)', 'rgba(95,215,255,0.22)', 'rgba(255,210,63,0.2)'];
  for (let i = 0; i < 3; i++) {
    const a = t / 60 + i * 2.1;
    const x = 5 * TILE + Math.cos(a) * 52 - cam.x, y = 3.6 * TILE + Math.sin(a * 1.3) * 18 - cam.y;
    ctx.fillStyle = cols[i];
    for (let r = 0; r <= 6; r++) { const w = Math.round(Math.sqrt(36 - (6 - r) * (6 - r)) * 2); ctx.fillRect(Math.round(x - w), Math.round(y - 6 + r), w * 2, 1); if (r < 6) ctx.fillRect(Math.round(x - w), Math.round(y + 6 - r), w * 2, 1); }
  }
}

registerPlace({
  id: 'karaoke',
  name: 'カラオケ ドットボックス',
  kind: 'building',
  bgm: 'night',
  start: { room: 'lobby', x: 4, y: 6, dir: 'up' },
  rooms: {
    lobby: {
      floor: 'floor_carpet_purple',
      wall: 'purple',
      tiles: [
        '##########',
        '#=p=w=p=d#',
        '#........#',
        '#BB.RRR..#',
        '#........#',
        '#SS....DP#',
        '#........#',
        '####MM####',
      ],
      legend: { B: 'bookshelf', R: 'counter_white', S: 'sofa_blue', D: 'machi_drinkbar', P: 'plant' },
      warps: [
        { x: 4, y: 7, to: 'exit' }, { x: 5, y: 7, to: 'exit' },
        { x: 8, y: 1, room: 'booth', tx: 4, ty: 5, dir: 'up', check: async (g) => { if (karaokePaid(g)) return true; await g.say('（3番の部屋だ。受付をすませてから入ろう）'); return false; } },
      ],
      entities: [
        { type: 'npc', id: 'karaoke_clerk', x: 5, y: 2, dir: 'down', look: KARAOKE_CLERK.look, name: KARAOKE_CLERK.name, talk: karaokeDesk },
        { type: 'npc', id: 'karaoke_band', x: 2, y: 4, dir: 'right', look: { hair: 'spiky', hairColor: 'red', skin: 'fair', top: '#20232a', bottom: '#3a4a7a' }, name: 'バンドマン',
          text: ['ここで毎日、声出しの練習してんだ。', 'うまく歌えた日は、気分がいいぜ。\n…ストレス？カラオケで吹っ飛ばすのさ！'] },
      ],
      events: [
        { x: 1, y: 3, w: 2, on: 'action', run: (g) => g.say(['分厚い曲名リストだ。', '「ぽかぽか日だまりバラード」「夏色サイダー」\n「ネオンシティ・ロック」「早口ことばラプソディ」…']) },
        { x: 7, y: 5, on: 'action', run: (g) => g.say('ドリンクバーだ。\nフリータイムのお客さんは飲み放題らしい。') },
      ],
      onEnter: (g) => firstVisit(g, 'karaoke', ['いらっしゃいませ〜！\nカラオケ ドットボックスへようこそ！', 'フリータイムなら、1日何曲でも歌い放題っす。\n受付はこちらで〜！'], KARAOKE_CLERK),
    },
    booth: {
      floor: 'floor_carpet_purple',
      wall: 'dark',
      bgm: 'night',
      tiles: [
        '##########',
        '#=p====p=#',
        '#S..m...S#',
        '#........#',
        '#BBttBB..#',
        '#........#',
        '####M#####',
      ],
      legend: { S: 'speaker', m: 'mic', B: 'sofa', t: 'table_low' },
      warps: [{ x: 4, y: 6, room: 'lobby', tx: 8, ty: 2, dir: 'down' }],
      entities: [karaokeScreen(3, 1)],
      events: [
        { x: 4, y: 2, on: 'action', run: sing },
        { x: 2, y: 4, w: 2, on: 'action', run: (g) => g.say('ふかふかのソファだ。\nテーブルの上に、タンバリンとマラカスがある。') },
      ],
      drawOver: karaokeLights,
      onEnter: async (g) => { if (!g.flag('machi_met_booth')) { g.setFlag('machi_met_booth'); await g.wait(200); await g.say('うす暗い部屋に、ミラーボールが回っている。\nマイクの前に立って、歌おう！'); } },
    },
  },
});

// ====================================================================== DOT GYM
const GYM_PRICE = 1000;
const GYM_STAMINA = 10;
const GYM_STAFF = { name: 'ジムの受付さん', look: { hair: 'twin', hairColor: 'black', skin: 'tan', top: '#ff8a3d', bottom: '#2a2d36' } };
const TRAINER = { name: 'トレーナー', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#20232a', bottom: '#20232a', beard: false } };
export function gymBonus(g) { return Math.max(0, Math.min(20, Number(g.flag('machi_gym_bonus')) || 0)); }
const gymCount = (g) => Math.max(0, Number(g.flag('machi_gym_count')) || 0);
async function gymPay(g) {
  if (today(g, 'machi_gym_day')) return true;
  const i = await g.ask(`ビジター利用（今日1日）は${fmtMoney(GYM_PRICE)}です。\nトレーニングとシャワーが使えます。`, ['利用する', 'やめておく'], { ...who(GYM_STAFF), cancel: 1 });
  if (i !== 0) return false;
  if (!g.spend(GYM_PRICE)) { await g.say('あら、お金が足りないみたい…。\nまたお待ちしてます！', who(GYM_STAFF)); return false; }
  g.sfx('coin');
  g.setFlag('machi_gym_day', g.state.day);
  return true;
}
const WORKOUT = {
  run: { name: 'ランニングマシン', text: 'ランニングマシンで、ひたすら走った！\nタッタッタッ…汗がふき出す。' },
  bench: { name: 'ベンチプレス', text: 'ベンチプレスに挑戦！\nふんっ…！ふんっ…！腕がぷるぷるする。' },
  dumbbell: { name: 'ダンベル', text: 'ダンベルで、腕と肩をきたえた！\n鏡の中の自分が、ちょっとたくましく見える。' },
  yoga: { name: 'ストレッチ', text: 'マットの上で、じっくりストレッチ。\n体も心も、ほぐれていく…。' },
};
async function workout(g, kind) {
  const w = WORKOUT[kind];
  if (today(g, 'machi_gym_done')) { await g.say('今日のトレーニングは、もう終わった。\n休むのもトレーニングのうち！'); return; }
  const i = await g.ask(`${w.name}でトレーニングする？\n（体力 -${GYM_STAMINA}・ストレス -15・満腹 -10・身だしなみ -20）`, ['トレーニング', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (g.state.stamina < GYM_STAMINA) { await g.say('体力が足りない…。\nこれ以上は、ケガのもとだ。'); return; }
  if (!(await gymPay(g))) return;
  g.useStamina(GYM_STAMINA);
  const a = snap(g);
  await beat(g, ['hit', 'hit', 'drum'], 260);
  g.relax({ stress: 15 });
  g.addNeed('hunger', -10);
  g.addNeed('clean', -20);
  g.setFlag('machi_gym_done', g.state.day);
  const count = gymCount(g) + 1;
  g.setFlag('machi_gym_count', count);
  const lines = [w.text, diffText(g, a)];
  if (count % 5 === 0 && gymBonus(g) < 20) {
    g.setFlag('machi_gym_bonus', gymBonus(g) + 2);
    g.state.maxStamina += 2;
    g.state.stamina = Math.min(g.state.maxStamina, g.state.stamina + 2);
    g.sfx('fanfare');
    lines.push(`トレーニングの成果が出た！\n体力の最大値が2上がった！（${g.state.maxStamina}）`);
  } else if (gymBonus(g) < 20) lines.push(`トレーニング記録：${count}日目\n（あと${5 - (count % 5)}日で、体力の最大値アップ）`);
  else lines.push(`トレーニング記録：${count}日目\n（体力アップは最大まで達した。いい体だ！）`);
  lines.push('汗をかいたら、シャワーを浴びていこう。');
  if (g.state.life.hunger < HUNGRY) lines.push('…おなかがペコペコだ。\n何か食べないと、力が出ない。');
  await g.say(lines);
}
async function gymShower(g) {
  if (!today(g, 'machi_gym_day')) {
    const i = await g.ask(`シャワーだけ使う？（${fmtMoney(300)}）`, ['使う', 'やめておく'], { cancel: 1 });
    if (i !== 0) return;
    if (!g.spend(300)) { await g.say('お金が足りない…。'); return; }
    g.sfx('coin');
  }
  const a = snap(g);
  await beat(g, ['cursor', 'cursor', 'chime'], 240);
  g.bathe(100, true);
  g.relax({ stress: onceADay(g, 'shower', 3) });
  await g.say(['シャー…。\n熱めのシャワーで、汗を流した。', `さっぱり！\n${diffText(g, a) || 'すっきりした。'}`]);
}
async function gymDesk(g, npc) {
  const o = who(npc);
  const lines = [];
  const i = await g.ask(today(g, 'machi_gym_day') ? '今日は利用中ですね！\nいい汗、かいてください！' : `DOT GYMへようこそ！\nビジター利用は1日${fmtMoney(GYM_PRICE)}です。`, ['ドリンクを買う', 'ジムのしくみ', 'なんでもない'], { ...o, cancel: 2 });
  if (i === 0) {
    await orderMenu(g, {
      title: 'ジムのドリンク', host: npc, thanks: 'がんばってください！',
      entries: [
        { name: 'プロテインシェイク', price: 300, heal: 10, fill: 15, desc: 'バナナ味のプロテイン。' , text: 'ゴクゴク…。\nバナナ味で、思ったより飲みやすい！' },
        { name: 'スポーツドリンク', price: 200, stress: 3, desc: '汗をかいたら、水分補給。', text: 'ごくごく…。\n体にしみわたる！' },
      ],
    });
  } else if (i === 1) {
    lines.push(
      `マシンやマットでトレーニングできます。\n1日1回、体力 -${GYM_STAMINA}。ストレス解消にぴったり！`,
      '5日トレーニングするごとに、\n体力の最大値が2アップ！（最大+20まで）',
      `いまの記録：${gymCount(g)}日　体力アップ：+${gymBonus(g)}`,
      '汗をかいたら、奥のシャワーをどうぞ。',
    );
    await g.say(lines, o);
  } else await g.say('またどうぞ〜！', o);
}

registerPlace({
  id: 'gym',
  name: 'DOT GYM',
  kind: 'building',
  bgm: 'machi_gym',
  start: { room: 'floor', x: 7, y: 8, dir: 'up' },
  rooms: {
    floor: {
      floor: 'floor_concrete',
      wall: 'gray',
      tiles: [
        '################',
        '#=w=QQQQQQ=w=pc#',
        '#.TT.TT..DD..LL#',
        '#..............#',
        '#.yy.yy..BB....#',
        '#..............#',
        '#............HH#',
        '#RRR...........#',
        '#P...........WP#',
        '#######MM#######',
      ],
      legend: {
        Q: 'wall_gray+mirror', T: 'machi_treadmill', D: 'machi_dumbbells', L: 'locker', y: 'machi_yogamat',
        B: 'machi_bench', H: 'machi_shower', R: 'counter_white', W: 'water_server', P: 'plant',
      },
      warps: [{ x: 7, y: 9, to: 'exit' }, { x: 8, y: 9, to: 'exit' }],
      entities: [
        { type: 'npc', id: 'gym_staff', x: 2, y: 6, dir: 'down', look: GYM_STAFF.look, name: GYM_STAFF.name, talk: gymDesk },
        { type: 'npc', id: 'gym_trainer', x: 7, y: 3, dir: 'down', look: TRAINER.look, name: TRAINER.name, wander: 2,
          talk: async (g, n) => {
            const lines = ['体は資本！\nきたえた体は、ウソをつかない！'];
            if (gymBonus(g) >= 10) lines.push('おっ、いい体になってきたな！\nその調子だ！');
            else lines.push('毎日コツコツ通うのが、いちばんの近道だ。\n5日通うごとに、体力がグッと上がるぞ！');
            lines.push('トレーニングのあとは、ちゃんと食べること。\n腹ペコだと、力が出ないからな！');
            await g.say(lines, who(n));
          } },
        { type: 'npc', id: 'gym_macho', x: 11, y: 4, dir: 'left', look: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#d62f2f', bottom: '#20232a' }, name: '常連のマッチョさん',
          text: ['ふんっ！ふんっ！\n…お、新入りか？', 'ストレスがたまったら、筋肉にぶつけるんだ。\nするとどうだ、悩みが筋肉になる！', '…意味はよくわからんが、気分はいいぞ！'] },
      ],
      events: [
        { x: 2, y: 2, w: 2, on: 'action', run: (g) => workout(g, 'run') },
        { x: 5, y: 2, w: 2, on: 'action', run: (g) => workout(g, 'run') },
        { x: 9, y: 2, w: 2, on: 'action', run: (g) => workout(g, 'dumbbell') },
        { x: 9, y: 4, w: 2, on: 'action', run: (g) => workout(g, 'bench') },
        { x: 2, y: 4, w: 2, on: 'action', run: (g) => workout(g, 'yoga') },
        { x: 5, y: 4, w: 2, on: 'action', run: (g) => workout(g, 'yoga') },
        { x: 13, y: 6, w: 2, on: 'action', run: gymShower },
        { x: 13, y: 2, w: 2, on: 'action', run: (g) => g.say('ロッカーだ。\nだれかのタオルに「根性」と刺しゅうしてある。') },
      ],
      onEnter: (g) => firstVisit(g, 'gym', ['DOT GYMへようこそ！', `ビジター利用は1日${fmtMoney(GYM_PRICE)}。\nトレーニングを続けると、体力の最大値が上がりますよ！`], GYM_STAFF),
    },
  },
});

// ====================================================================== hair salon ドット
const SALON_PRICE = 4000;
// A cut lasts: the next one (and its fame bonus) is possible SALON_CUT_DAYS days later.
const SALON_CUT_DAYS = 3;
const SALON_BONUS_MAX = 300;
const STYLIST = { name: 'スタイリストさん', look: { hair: 'bob', hairColor: 'blonde', skin: 'light', top: '#1e1e26', bottom: '#1e1e26', apron: '#5a5f6b' } };
const SALON_DESK = { name: '受付さん', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#8a5ac8', skirt: true } };
const isStyled = (g) => { const s = g.flag('machi_styled'); return !!(s && typeof s === 'object'); };
// days until the hair has grown enough for the next cut (0 = can cut today)
function cutWait(g) {
  const d = g.flag('machi_cut_day');
  if (typeof d !== 'number') return 0;
  return Math.max(0, d + SALON_CUT_DAYS - g.state.day);
}
async function salonMenu(g, npc) {
  const o = who(npc || STYLIST);
  const i = await g.ask((isStyled(g) ? 'ヘアスタイル、まだばっちりキマってますよ。' : 'いらっしゃいませ！今日はどうなさいますか？') + '\nカット：次のお仕事の評判がアップ\nシャンプー：ヘッドスパでリラックス', [`カット＆ブロー ${fmtMoney(SALON_PRICE)}`, `シャンプー ${fmtMoney(1500)}`, 'やめておく'], { ...o, cancel: 2 });
  if (i === 2 || i < 0) { await g.say('またお待ちしてますね！', o); return; }
  if (i === 0 && cutWait(g) > 0) {
    const w = cutWait(g);
    await g.say([`カットは、${w >= SALON_CUT_DAYS ? '今日' : 'この前'}したばかりですよ〜。\nいまの髪型、ちゃんとキマってます！`, `髪がのびたころ（${w === 1 ? 'あした' : `${w}日後`}）に、またどうぞ。\nシャンプーなら、いつでも大歓迎です！`], o);
    return;
  }
  const price = i === 0 ? SALON_PRICE : 1500;
  if (!g.spend(price)) { await g.say('あら…お会計が足りないみたいです。\nまたいらしてくださいね。', o); return; }
  g.sfx('coin');
  const a = snap(g);
  if (i === 0) {
    await g.say('かしこまりました！\nお席へどうぞ〜。', o);
    await beat(g, ['snare', 'snare', 'snare', 'chime'], 240);
    g.bathe(100, true);
    const t = treat(g, 'salon', 15, 1);
    g.relax({ stress: t.stress });
    g.setFlag('machi_cut_day', g.state.day);
    g.setFlag('machi_styled', { day: g.state.day, fame: g.state.fame, jobs: (g.state.stats && g.state.stats.jobs) || 0 });
    await g.say(['チョキチョキ…ブォーン…。', 'はい、できあがりです！\nすっごく似合ってますよ！'], o);
    await g.say('鏡の中の自分…すっきり！\n別人みたいだ！');
    g.emote('player', '♪');
    await g.say([(diffText(g, a) || 'さっぱりした。') + (t.tired ? '\n' + TREAT_NOTE : ''), '（ヘアスタイルが決まった！\n次のお仕事の評判がアップする。\n評判は、次の朝にとどくよ）']);
  } else {
    await beat(g, ['cursor', 'cursor', 'chime'], 240);
    g.bathe(100, true);
    const t = treat(g, 'salon', 12, 1);
    g.relax({ stress: t.stress });
    await g.say(['シャカシャカ…。\nヘッドスパつきのシャンプーで、頭がすっきり！', (diffText(g, a) || 'さっぱりした。') + (t.tired ? '\n' + TREAT_NOTE : '')]);
  }
}

registerPlace({
  id: 'salon',
  name: 'hair salon ドット',
  kind: 'building',
  bgm: 'machi_cafe',
  start: { room: 'main', x: 5, y: 6, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_marble',
      wall: 'pink',
      tiles: [
        '############',
        '#=Q==Q==Q=w#',
        '#.C..C..C..#',
        '#..........#',
        '#SS........#',
        '#.....RR...#',
        '#BB......PP#',
        '#####MM#####',
      ],
      legend: { Q: 'wall_pink+mirror', C: 'machi_salonchair', S: 'machi_shampoo', R: 'counter_white', B: 'sofa_beige', P: 'plant' },
      warps: [{ x: 5, y: 7, to: 'exit' }, { x: 6, y: 7, to: 'exit' }],
      entities: [
        { type: 'npc', id: 'salon_stylist', x: 3, y: 3, dir: 'down', look: STYLIST.look, name: STYLIST.name, talk: salonMenu },
        { type: 'npc', id: 'salon_desk', x: 6, y: 4, dir: 'down', look: SALON_DESK.look, name: SALON_DESK.name,
          talk: async (g, n) => {
            await g.say(['hair salon ドットへようこそ。', `カット＆ブローは${fmtMoney(SALON_PRICE)}。\n身だしなみが整うと、お仕事の評価も、\n人からの印象も、ぐっと良くなりますよ。`], who(n));
            await salonMenu(g, STYLIST);
          } },
        { type: 'npc', id: 'salon_guest', x: 9, y: 3, dir: 'left', look: { hair: 'long', hairColor: 'pink', skin: 'light', top: '#ffffff', bottom: '#ff7eb6', skirt: true }, name: 'お客さん', wander: 1,
          text: ['明日、大事なオーディションなの。\nだから、髪を整えに来たんだ！', '身だしなみがボロボロだと、\nせっかくの実力も伝わらないもんね。'] },
      ],
      events: [
        { x: 2, y: 2, on: 'action', run: (g) => salonMenu(g) },
        { x: 5, y: 2, on: 'action', run: (g) => salonMenu(g) },
        { x: 8, y: 2, on: 'action', run: (g) => salonMenu(g) },
        { x: 1, y: 4, w: 2, on: 'action', run: (g) => salonMenu(g) },
        { x: 1, y: 6, w: 2, on: 'action', run: (g) => g.say('待合のソファだ。\nヘアカタログが置いてある。') },
      ],
    },
  },
});

// ====================================================================== らーめん まるどっと亭
const TAISHO = { name: 'ラーメン屋の大将', look: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#20232a', bottom: '#20232a', apron: '#ffffff' } };
const stamps = (g) => Math.max(0, Number(g.flag('machi_ramen_stamps')) || 0);
async function ramenOrder(g, npc) {
  const host = npc || TAISHO;
  const free = stamps(g) >= 10;
  const base = [
    { name: 'しょうゆラーメン', price: 800, heal: 30, fill: 60, stress: 4, bowl: true, desc: '鶏ガラしょうゆの、すっきりスープ。', text: 'ズルズルッ…！\n鶏ガラしょうゆの、やさしい味わい。' },
    { name: 'チャーシューメン', price: 1100, heal: 40, fill: 70, stress: 6, bowl: true, desc: 'とろとろチャーシューが5枚。', text: 'とろっとろのチャーシューが、口の中でほどける…！\nこれはごちそうだ。' },
    { name: '餃子（6個）', price: 350, heal: 10, fill: 20, stress: 2, desc: 'パリッと焼けた、肉汁たっぷりの餃子。', text: 'パリッ、ジュワッ…！\n肉汁がたまらない。' },
  ];
  const entries = base.map((e) => (free && e.bowl ? { ...e, price: 0, sale: false, name: e.name + '（無料）', desc: 'スタンプ10個で、1杯サービス！' } : e));
  const e = await orderMenu(g, { title: 'らーめん まるどっと亭', entries, host, thanks: pick(['へい、まいど！', 'スープまで飲んでくれて、ありがとよ！', 'また来いよ！']) });
  if (!e || !e.bowl) return;
  if (free) {
    g.setFlag('machi_ramen_stamps', 0);
    await g.say('スタンプカードがいっぱいだったから、\n今日の一杯はサービスだ！\n（スタンプカードが新しくなった）', who(host));
  } else {
    const n = stamps(g) + 1;
    g.setFlag('machi_ramen_stamps', n);
    await g.say(n >= 10 ? 'スタンプが10個たまったな！\n次の一杯は、おごりだ！' : `スタンプ押しとくぜ。（${n}/10）\n10個たまったら、一杯サービスだ！`, who(host));
  }
}

registerPlace({
  id: 'ramen',
  name: 'らーめん まるどっと亭',
  kind: 'building',
  bgm: 'machi_shop',
  start: { room: 'main', x: 5, y: 6, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_wood_dark',
      wall: 'cream',
      tiles: [
        '###########',
        '#=TTTTT=pc#',
        '#KK.HH..WF#',
        '#CCCCCCC..#',
        '#sssssss..#',
        '#.........#',
        '#.tt...tt.#',
        '#####M#####',
      ],
      legend: {
        T: 'wall_cream+machi_menutags', K: 'kitchen', H: 'machi_ramenpot', W: 'water_server', F: 'fridge_drinks',
        C: 'counter', s: 'machi_stool', t: 'table',
      },
      warps: [{ x: 5, y: 7, to: 'exit' }],
      entities: [
        { type: 'npc', id: 'ramen_taisho', x: 6, y: 2, dir: 'down', look: TAISHO.look, name: TAISHO.name, talk: (g, n) => ramenOrder(g, n) },
        { type: 'npc', id: 'ramen_deshi', x: 3, y: 2, dir: 'down', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#ffffff', bottom: '#20232a', apron: '#20232a' }, name: '見習いさん',
          text: ['いらっしゃいませっ！\n…まだ、どんぶり洗いの修行中です！', 'スープは大将が毎朝、12時間煮こんでるんです。\nラーメンは腹持ちがいいから、仕事前におすすめですよ！'] },
        { type: 'npc', id: 'ramen_guest', x: 2, y: 4, dir: 'up', look: { ...LOOKS.staff, hat: '#2f6fd0' }, name: 'お客さん',
          text: ['ズルズル…。\n（夢中で食べている）', '…ぷはーっ！\n撮影の前は、ここで腹ごしらえって決めてんだ。'] },
      ],
      events: [
        { x: 4, y: 2, w: 2, on: 'action', run: (g) => g.say('大きな寸胴鍋で、スープがグツグツ煮えている。\nいい香り…おなかが鳴った。') },
        { x: 1, y: 2, w: 2, on: 'action', run: (g) => g.say('年季の入った厨房だ。\nピカピカに磨かれている。') },
        { x: 2, y: 6, w: 2, on: 'action', run: (g) => ramenOrder(g) },
        { x: 7, y: 6, w: 2, on: 'action', run: (g) => ramenOrder(g) },
      ],
      onEnter: (g) => firstVisit(g, 'ramen', ['へい、らっしゃい！\nカウンターに座って、注文してくんな！'], TAISHO),
    },
  },
});

// ====================================================================== ファミレス ドットキッチン
const WAITRESS = { name: 'ウェイトレスさん', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#d84a3a', skirt: true, apron: '#ff9a3c' } };
const LUNCH = ['ハンバーグ', 'からあげ', 'オムライス', 'しょうが焼き', 'カレー', 'エビフライ', 'ナポリタン'];
function famiresMenu(g) {
  const lunch = LUNCH[weekdayOf(g.state.day)];
  return [
    { name: `日替わりランチ（${lunch}）`, price: 600, heal: 32, fill: 55, stress: 3, desc: `今日の日替わりは「${lunch}」。ライス・スープつき。`, text: `日替わりランチの「${lunch}」！\nボリュームたっぷりで、この値段はうれしい。` },
    { name: 'ハンバーグセット', price: 950, heal: 42, fill: 65, stress: 6, desc: '鉄板でジュージュー。看板メニュー。', text: 'ジュージュー…！\n肉汁あふれるハンバーグ、最高だ！' },
    { name: 'チーズドリア', price: 450, heal: 22, fill: 45, stress: 3, desc: 'とろーりチーズの、お手ごろドリア。', text: 'あつあつ、とろーり。\nお財布にもやさしい一皿。' },
    { name: 'お子さまランチ', price: 500, heal: 25, fill: 45, stress: 8, desc: '旗つき。大人も注文OK…らしい。', text: 'ちいさな旗が立っている…！\nなんだか童心にかえった。' },
    { name: 'いちごパフェ', price: 580, heal: 8, fill: 15, stress: 10, desc: 'いちごとクリームたっぷり。', text: 'いちごとクリームの山を、てっぺんから攻略！\nあまくて幸せ…。' },
  ];
}
async function famiresOrder(g, npc) {
  await orderMenu(g, { title: 'ドットキッチン メニュー', entries: famiresMenu(g), host: npc || WAITRESS, thanks: pick(['ごゆっくりどうぞ〜！', 'ドリンクバーもいかがですか？', 'ありがとうございました〜！']) });
}
async function drinkBar(g) {
  if (today(g, 'machi_drinkbar_day')) {
    await g.say(pick([
      'ドリンクバーでおかわり！\nメロンソーダとオレンジを…まぜてみた。\n…うん、これは事件だ。',
      'ドリンクバーでおかわり！\nホットココアで、ほっこり。',
      'ドリンクバーでおかわり！\n…何杯目かは、数えないことにした。',
    ]));
    return;
  }
  const i = await g.ask('ドリンクバーだ。\n今日1日、飲み放題で¥250。', ['注文する', 'やめておく'], { cancel: 1 });
  if (i !== 0) return;
  if (!g.spend(250)) { await g.say('お金が足りない…。'); return; }
  g.sfx('coin');
  g.setFlag('machi_drinkbar_day', g.state.day);
  const a = snap(g);
  g.relax({ stress: 6, stamina: 4 });
  await g.say(['シュワシュワのメロンソーダ！\nのどがスカッとした。', `${diffText(g, a)}\n（今日はこのあと、おかわり自由）`]);
}

registerPlace({
  id: 'famires',
  name: 'ファミレス ドットキッチン',
  kind: 'building',
  bgm: 'machi_shop',
  start: { room: 'main', x: 7, y: 8, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_checker',
      wall: 'orange',
      tiles: [
        '##############',
        '#=w=w=w=w==pc#',
        '#btB.btB...DD#',
        '#............#',
        '#btB.btB...XX#',
        '#............#',
        '#btB.btB.....#',
        '#.........RR.#',
        '#P..........P#',
        '######MM######',
      ],
      legend: { b: 'machi_booth_l', t: 'machi_famtable', B: 'machi_booth_r', D: 'machi_drinkbar', X: 'machi_cakecase', R: 'register', P: 'plant' },
      warps: [{ x: 6, y: 9, to: 'exit' }, { x: 7, y: 9, to: 'exit' }],
      entities: [
        { type: 'npc', id: 'famires_waitress', x: 8, y: 5, dir: 'down', look: WAITRESS.look, name: WAITRESS.name, wander: 2, talk: (g, n) => famiresOrder(g, n) },
        { type: 'npc', id: 'famires_cashier', x: 10, y: 6, dir: 'down', look: { ...WAITRESS.look, hair: 'short', hairColor: 'black', skirt: false, bottom: '#3b3f48' }, name: 'レジの店員さん',
          text: ['ありがとうございました〜！', 'ドリンクバーは、今日1日おかわり自由です。\nお仕事の合間の作戦会議にどうぞ！'] },
        { type: 'npc', id: 'famires_geinin', x: 9, y: 5, dir: 'left', look: { ...LOOKS.comedian2, top: '#5a6f8a', glasses: true }, name: 'ネタ作り中の若手芸人',
          text: ['ファミレスはな、若手芸人の第二の稽古場や。\nドリンクバー頼んだら、何時間でもおれる。', '…今日のネタ？\n「ドリンクバーで全部まぜたら、何味？」\n…あかん、オチが思いつかへん。'] },
        { type: 'npc', id: 'famires_kid', x: 10, y: 3, dir: 'right', look: { ...LOOKS.kid, top: '#ff8a3d' }, name: 'こども',
          text: ['お子さまランチの旗、集めてるんだ！\nこれで12本目！', 'ドリンクバーで、メロンソーダと\nオレンジジュースをまぜると、おいしいんだよ！'] },
      ],
      events: [
        { x: 11, y: 2, w: 2, on: 'action', run: drinkBar },
        { x: 11, y: 4, w: 2, on: 'action', run: async (g) => { await g.say('デザートのショーケースだ。\nパフェにケーキ…どれもおいしそう。'); await famiresOrder(g); } },
        { x: 2, y: 2, on: 'action', run: (g) => famiresOrder(g) },
        { x: 6, y: 2, on: 'action', run: (g) => famiresOrder(g) },
        { x: 2, y: 4, on: 'action', run: (g) => famiresOrder(g) },
        { x: 6, y: 4, on: 'action', run: (g) => famiresOrder(g) },
        { x: 2, y: 6, on: 'action', run: (g) => famiresOrder(g) },
        { x: 6, y: 6, on: 'action', run: (g) => famiresOrder(g) },
      ],
      onEnter: (g) => firstVisit(g, 'famires', ['いらっしゃいませ〜！\nドットキッチンへようこそ！', 'お好きなお席へどうぞ。\nご注文は、テーブルか店員まで！'], WAITRESS),
    },
  },
});

// ====================================================================== フラワー＆ギフト はなや
const FLORIST = { name: 'はなやの店員さん', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#ffffff', bottom: '#e0c48a', skirt: true, apron: '#2f9a4a' } };
const GIFT_TIP = 'プレゼントは、相手に話しかけて「プレゼント」で渡せますよ。\n人によって、好きなものはちがうみたい。';
async function giftShop(g, key) {
  const sets = {
    flowers: { title: '花束', items: ['hanataba'], greeting: 'お好きな色で、お作りしますね！' },
    sweets: { title: 'スイーツ・お菓子', items: ['cake', 'okashi', 'tea'], greeting: 'おいしいもの、そろってます！' },
    goods: { title: '雑貨・ギフト', items: ['plushie', 'accessory', 'tea'], greeting: 'ラッピングは無料ですよ〜。' },
    all: { title: 'フラワー＆ギフト はなや', items: ['hanataba', 'cake', 'okashi', 'tea', 'plushie', 'accessory'], greeting: 'いらっしゃいませ！' },
  };
  const s = sets[key];
  const list = goods(s.items);
  if (!list.length) { await g.say('（いまは品切れのようだ…）'); return 0; }
  return g.shop(list, { title: s.title, greeting: s.greeting });
}

registerPlace({
  id: 'hanaya',
  name: 'フラワー＆ギフト はなや',
  kind: 'building',
  bgm: 'machi_cafe',
  start: { room: 'main', x: 4, y: 6, dir: 'up' },
  rooms: {
    main: {
      floor: 'floor_wood',
      wall: 'green',
      tiles: [
        '##########',
        '#=w=pp=w=#',
        '#FF.....G#',
        '#FF.....G#',
        '#...XXR..#',
        '#........#',
        '#FF....PP#',
        '####MM####',
      ],
      legend: { F: 'machi_flowers', G: 'machi_giftshelf', X: 'machi_cakecase', R: 'register', P: 'plant' },
      warps: [{ x: 4, y: 7, to: 'exit' }, { x: 5, y: 7, to: 'exit' }],
      entities: [
        { type: 'npc', id: 'hanaya_clerk', x: 5, y: 3, dir: 'down', look: FLORIST.look, name: FLORIST.name,
          talk: async (g, n) => {
            const n2 = await giftShop(g, 'all');
            await g.say(n2 ? ['ありがとうございます！\nきっと喜ばれますよ。', GIFT_TIP] : ['ゆっくり見ていってくださいね。', GIFT_TIP], who(n));
          } },
        { type: 'npc', id: 'hanaya_guest', x: 3, y: 5, dir: 'left', look: { ...LOOKS.salaryman, top: '#8a6a4a', tie: '#ff7eb6' }, name: 'お客さん',
          text: ['妻の誕生日なんです。\n花束にするか、ケーキにするか…。', '相手の好きなものを知ってると、\nプレゼント選びも楽しいですよね。'] },
      ],
      events: [
        { x: 1, y: 2, w: 2, h: 2, on: 'action', run: (g) => giftShop(g, 'flowers') },
        { x: 1, y: 6, w: 2, on: 'action', run: (g) => giftShop(g, 'flowers') },
        { x: 8, y: 2, h: 2, on: 'action', run: (g) => giftShop(g, 'goods') },
        { x: 4, y: 4, w: 2, on: 'action', run: (g) => giftShop(g, 'sweets') },
      ],
      onEnter: (g) => firstVisit(g, 'hanaya', ['いらっしゃいませ！\nフラワー＆ギフト はなやです。', 'お花にスイーツ、ちょっとした雑貨まで。\n大切な人への贈りものに、どうぞ。'], FLORIST),
    },
  },
});

// ====================================================================== morning hooks
// The gym's max-stamina bonus survives anything that resets maxStamina to a base value
// (home upgrades, housing): every morning, make sure it is at least base + bonus.
const HOME_MAX = [100, 110, 120, 130];
onMorning((g) => {
  const bonus = gymBonus(g);
  if (!bonus) return;
  const lv = Math.max(0, Math.min(3, Math.floor(Number(g.flag('home_level')) || 0)));
  // fitness furniture (housing.js keeps what it granted in flags.housing_fit)
  const fit = g.flag('housing_fit');
  const fx = fit && typeof fit === 'object' ? Object.values(fit).reduce((a, v) => a + (Number(v) || 0), 0) : 0;
  const want = HOME_MAX[lv] + fx + bonus;
  const st = g.state;
  if (st.maxStamina < want) {
    const d = want - st.maxStamina;
    st.maxStamina = want;
    st.stamina = Math.min(want, st.stamina + d);
  }
});
// Styled at the salon: the next work day's fame earns +10% (paid the next morning).
onMorning((g) => {
  const s = g.flag('machi_styled');
  if (!s || typeof s !== 'object') return;
  const st = g.state;
  const jobs = st.stats.jobs || 0;
  if (jobs > (s.jobs || 0)) {
    const gained = Math.max(0, st.fame - (s.fame || 0));
    const bonus = Math.max(1, Math.min(SALON_BONUS_MAX, Math.round(gained * 0.1)));
    g.addFame(bonus, true);
    g.addFans(bonus * 2, true);
    g.setFlag('machi_styled', null);
    g.message({ from: 'hair salon ドット', kind: 'fan', text: `昨日のお仕事、ヘアスタイルが好評だったみたいですね！\nSNSでも話題になってますよ♪\n（知名度 +${bonus}・ファン +${bonus * 2}）` });
    g.notify(`ヘアスタイルが好評！ 知名度 +${bonus}`, { color: '#ff7eb6' });
  } else if (st.day - (s.day || 0) > 2) {
    g.setFlag('machi_styled', null); // the style did not last until the next job
  } else {
    g.setFlag('machi_styled', { ...s, fame: st.fame, jobs });
  }
});
// Wednesday: the supermarket's sale (once the player has shopped there: its point card).
onMorning((g) => {
  if (weekdayOf(g.state.day) !== 2) return;
  const v = g.state.flags.visited;
  if (!v || !v.super) return;
  g.message({ from: 'スーパー まるどっと', kind: 'news', text: '本日水曜日は特売日！\n食材・お惣菜がぜんぶ2割引です。\nドット商店街で、お待ちしております♪' });
});
