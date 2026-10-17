// Cooking at home: buy ingredients at the supermarket (ドット商店街 → スーパー まるどっと),
// cook them in your kitchen. cookMenu(g) is called by every home kitchen (see housing).
//
// Ingredients are items with `ingredient: true` (ids ing_*). A recipe uses them up and
// makes a dish that is eaten right away (stamina + hunger fill + a little stress relief)
// or packed as a lunchbox item (bento_<recipe>, eaten later from もちもの).
// The cheap ¥100 もやし炒め needs no ingredients and is always there.
//
// flags: cook_seen { recipeId: true } (cooked at least once; new ones show ★),
//        cook_count (dishes cooked: the cooking rank gives a stamina / stress bonus).

import { registerItem, ITEMS } from '../engine/state.js';

// ---------------------------------------------------------------- ingredients
// section: the kind of shelf (the supermarket's sections are listed in machi.js).
export const INGREDIENTS = {
  ing_rice: { name: 'お米', price: 120, section: 'staple', desc: '1食分のお米。炊きたてごはんは自炊の基本。' },
  ing_noodle: { name: '焼きそば麺', price: 100, section: 'staple', desc: '蒸し焼きそば麺。1玉。' },
  ing_curry: { name: 'カレールウ', price: 180, section: 'staple', desc: '中辛のカレールウ。2皿分のカレーが作れる。' },
  ing_miso: { name: 'みそ', price: 120, section: 'staple', desc: '小分けのみそ。みそ汁や焼き魚の定食に。' },
  ing_egg: { name: '卵', price: 50, section: 'chilled', desc: '新鮮な卵。1個。' },
  ing_tofu: { name: '豆腐', price: 90, section: 'chilled', desc: 'もめん豆腐。みそ汁にもマーボーにも。' },
  ing_pork: { name: '豚こま肉', price: 260, section: 'meat', desc: '豚のこま切れ肉。いろんな料理に使える。' },
  ing_chicken: { name: '鶏もも肉', price: 240, section: 'meat', desc: 'ジューシーな鶏もも肉。' },
  ing_fish: { name: '鮭の切り身', price: 230, section: 'meat', desc: '脂ののった鮭。焼くだけでごちそう。' },
  ing_cabbage: { name: 'キャベツ', price: 150, section: 'veg', desc: 'シャキシャキのキャベツ（1/4玉）。' },
  ing_veg: { name: '野菜セット', price: 160, section: 'veg', desc: 'にんじん・玉ねぎ・じゃがいも。カレーや炒め物に。' },
};
for (const [id, def] of Object.entries(INGREDIENTS)) {
  registerItem(id, { ...def, desc: def.desc + '\n（家のキッチンで料理に使う食材）', ingredient: true });
}

// ---------------------------------------------------------------- recipes
// heal: stamina, fill: hunger, stress: stress removed. serves: dishes made at once
// (the extra ones go into lunchboxes). box: false = cannot be packed as a lunchbox.
export const RECIPES = [
  { id: 'tkg', name: '卵かけごはん', needs: { ing_rice: 1, ing_egg: 1 }, heal: 20, fill: 35, stress: 3, box: false,
    text: 'ほかほかごはんに卵を割って、しょうゆをひとたらし。\nシンプルだけど、これがうまい！' },
  { id: 'tamagoyaki', name: '卵焼き', needs: { ing_egg: 2 }, heal: 14, fill: 20, stress: 4, bento: '卵焼き弁当',
    text: 'くるくる巻いて、ふっくら卵焼き。\nちょっと甘めの、実家の味だ。' },
  { id: 'misoshiru', name: 'とうふのみそ汁', needs: { ing_tofu: 1, ing_miso: 1 }, heal: 12, fill: 18, stress: 8, box: false,
    text: 'だしの香りがふわっと広がる。\n…ほっとする味だ。' },
  { id: 'yasai', name: '肉野菜炒め', needs: { ing_pork: 1, ing_cabbage: 1 }, heal: 35, fill: 45, stress: 4, bento: '野菜炒め弁当',
    text: '強火で一気に炒めて、シャキシャキに仕上げた！' },
  { id: 'mabo', name: 'マーボー豆腐', needs: { ing_tofu: 1, ing_pork: 1 }, heal: 32, fill: 42, stress: 6, bento: 'マーボー弁当',
    text: 'ピリッと辛くて、ごはんがほしくなる！' },
  { id: 'yakisoba', name: 'ソース焼きそば', needs: { ing_noodle: 1, ing_cabbage: 1, ing_pork: 1 }, heal: 42, fill: 55, stress: 6, bento: '焼きそば弁当',
    text: 'ジュワーッ！ソースのこげる香りがたまらない。' },
  { id: 'okonomi', name: 'お好み焼き', needs: { ing_cabbage: 1, ing_egg: 1, ing_pork: 1 }, heal: 40, fill: 55, stress: 8, bento: 'お好み焼き弁当',
    text: 'えいっ！…ひっくり返すのも、うまくいった！\nなんばの味に、ちょっと近づいたかも。' },
  { id: 'oyakodon', name: '親子丼', needs: { ing_rice: 1, ing_egg: 1, ing_chicken: 1 }, heal: 45, fill: 60, stress: 6, bento: '親子丼弁当',
    text: 'とろとろ卵と、ジューシーな鶏肉。\n丼をかきこむ手が止まらない！' },
  { id: 'shake', name: '焼き鮭定食', needs: { ing_rice: 1, ing_fish: 1, ing_miso: 1 }, heal: 48, fill: 60, stress: 8, bento: '鮭弁当',
    text: 'こんがり焼けた鮭に、みそ汁とごはん。\n体にやさしい、ちゃんとした朝ごはんだ。' },
  { id: 'omurice', name: 'オムライス', needs: { ing_rice: 1, ing_egg: 2, ing_chicken: 1 }, heal: 52, fill: 62, stress: 12, bento: 'オムライス弁当',
    text: 'ケチャップライスを、ふわふわ卵でつつんだ！\nケチャップで星マークも描いておこう。' },
  { id: 'curry', name: 'カレーライス', needs: { ing_rice: 2, ing_curry: 1, ing_veg: 1, ing_pork: 1 }, heal: 50, fill: 65, stress: 10, serves: 2, bento: 'カレー弁当',
    text: 'コトコト煮こんだ、具だくさんのカレー！\n部屋じゅうに、いいにおいが広がる。' },
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// The fallback: no ingredients needed, always affordable for ¥100.
const MOYASHI = { id: 'moyashi', name: 'もやし炒め', price: 100, needs: {}, heal: 15, fill: 30, stress: 2, box: false,
  text: 'もやしをさっと炒めて、塩こしょう。\n安い！早い！そこそこうまい！' };

// Lunchbox items, one per recipe that can be packed.
export const bentoId = (r) => 'bento_' + r.id;
for (const r of RECIPES) {
  if (r.box === false) continue;
  registerItem(bentoId(r), {
    name: r.bento || r.name + '弁当', price: 0, heal: r.heal, fill: r.fill, homemade: true,
    desc: `手作りの${r.name}をつめたお弁当。\n体力が${r.heal}回復する。（満腹 +${r.fill}）`,
  });
}

// ---------------------------------------------------------------- cooking rank
export const COOK_RANKS = [
  { min: 0, name: '料理ビギナー', bonus: 0 },
  { min: 10, name: '自炊じょうず', bonus: 0.1 },
  { min: 30, name: '家庭料理の達人', bonus: 0.2 },
];
export function cookCount(g) { return Math.max(0, Number(g.flag('cook_count')) || 0); }
export function cookRank(g) {
  const n = cookCount(g);
  let r = COOK_RANKS[0];
  for (const k of COOK_RANKS) if (n >= k.min) r = k;
  return r;
}
function seen(g) {
  const s = g.flag('cook_seen');
  return s && typeof s === 'object' ? s : {};
}

// How many times the recipe can be made with what you have (0 = missing something).
export function canCook(g, r) {
  let n = Infinity;
  for (const [id, k] of Object.entries(r.needs)) n = Math.min(n, Math.floor((g.state.items[id] || 0) / k));
  return n === Infinity ? 1 : n;
}
// "お米×1・卵×1" with a mark on what is missing.
function needsText(g, r) {
  const parts = Object.entries(r.needs).map(([id, k]) => {
    const have = g.state.items[id] || 0;
    const nm = (ITEMS[id] && ITEMS[id].name) || id;
    return `${nm}×${k}` + (have < k ? '（不足）' : '');
  });
  return parts.join('・');
}
function effectText(g, r) {
  const b = cookRank(g).bonus;
  const heal = Math.round(r.heal * (1 + b)), stress = Math.round(r.stress * (1 + b));
  return `体力+${heal}　満腹+${r.fill}` + (stress ? `　ストレス-${stress}` : '');
}

// A short "cooking..." beat on the map.
async function cookingBeat(g) {
  await g.fadeOut(10);
  g.sfx('hit');
  await g.wait(260);
  g.sfx('hit');
  await g.wait(260);
  g.sfx('drum');
  await g.wait(300);
  await g.fadeIn(10);
}

function markCooked(g, r) {
  const s = { ...seen(g) };
  const first = !s[r.id];
  s[r.id] = true;
  g.setFlag('cook_seen', s);
  const before = cookRank(g);
  g.setFlag('cook_count', cookCount(g) + 1);
  const after = cookRank(g);
  return { first, rankUp: after !== before ? after : null };
}

// Eat a dish now: stamina (+rank bonus), hunger, stress. Returns a result line.
function eatDish(g, r) {
  const b = cookRank(g).bonus;
  const before = { st: g.state.stamina, hu: g.state.life.hunger, sr: g.state.life.stress };
  g.eat(Math.round(r.heal * (1 + b)), { silent: true, fill: r.fill });
  g.relax({ stress: Math.round(r.stress * (1 + b)) });
  const d = { st: g.state.stamina - before.st, hu: g.state.life.hunger - before.hu, sr: before.sr - g.state.life.stress };
  const parts = [];
  if (d.st > 0) parts.push(`体力+${d.st}`);
  if (d.hu > 0) parts.push(`満腹+${d.hu}`);
  if (d.sr > 0) parts.push(`ストレス-${d.sr}`);
  return parts.length ? parts.join('　') : 'おなかが満たされた。';
}

async function cookOne(g, r) {
  const fallback = r === MOYASHI;
  const hungry = g.canEat();
  const boxable = r.box !== false;
  // what to do with it
  let mode = 0; // 0 = eat now, 1 = lunchbox
  if (r.serves > 1) {
    if (!hungry) {
      const i = await g.ask(`おなかいっぱいだ。\n${r.name}を作って、${r.serves}皿ともお弁当につめておく？`, ['お弁当にする', 'やめておく'], { cancel: 1 });
      if (i !== 0) return false;
      mode = 1;
    } else {
      const i = await g.ask(`${r.name}を作る？\n（${r.serves}皿分できる。1皿食べて、残りはお弁当に）`, ['つくる', 'やめておく'], { cancel: 1 });
      if (i !== 0) return false;
    }
  } else if (hungry && boxable) {
    const i = await g.ask(`${r.name}を作ろう。\nできたらどうする？`, ['いま食べる', 'お弁当につめる', 'やめておく'], { cancel: 2 });
    if (i === 2 || i < 0) return false;
    mode = i;
  } else if (!hungry) {
    if (!boxable) { await g.say('おなかいっぱいだ…。\nこれはお弁当にはできないし、またにしよう。'); return false; }
    const i = await g.ask(`おなかいっぱいだ。\n${r.name}を作って、お弁当につめておく？`, ['お弁当にする', 'やめておく'], { cancel: 1 });
    if (i !== 0) return false;
    mode = 1;
  }
  // pay / use ingredients
  if (fallback) {
    if (!g.spend(r.price)) { await g.say('もやしを買うお金もない…。\nなにか仕事をして、かせがないと。'); return false; }
  } else {
    if (canCook(g, r) < 1) { await g.say(`材料が足りない…。\n（${needsText(g, r)}）\n商店街のスーパーで買ってこよう。`); return false; }
    for (const [id, k] of Object.entries(r.needs)) g.takeItem(id, k);
  }
  await cookingBeat(g);
  const { first, rankUp } = fallback ? { first: false, rankUp: null } : markCooked(g, r);
  const pages = [];
  pages.push(`${r.name}ができた！` + (first ? '\n（はじめて作った料理だ！レシピをおぼえた）' : ''));
  if (r.text) pages.push(r.text);
  if (mode === 1) {
    const n = Math.max(1, r.serves || 1);
    g.giveItem(bentoId(r), n, true);
    g.sfx('good');
    pages.push(`お弁当箱につめた！\n「${ITEMS[bentoId(r)].name}」を${n > 1 ? n + 'つ' : ''}手に入れた。\n（もちものから、いつでも食べられる）`);
  } else {
    const res = eatDish(g, r);
    g.sfx('good');
    pages.push(`いただきます！\n${res}`);
    if (r.serves > 1) {
      g.giveItem(bentoId(r), r.serves - 1, true);
      pages.push(`残りの${r.serves - 1}皿分は、お弁当箱につめた。\n「${ITEMS[bentoId(r)].name}」を手に入れた。`);
    }
  }
  if (rankUp) pages.push(`料理の腕が上がった！\n「${rankUp.name}」になった。\n（自炊の回復量 +${Math.round(rankUp.bonus * 100)}%）`);
  await g.say(pages);
  if (first && g.map && g.map.player) g.emote('player', '♪', 40);
  return true;
}

// The kitchen menu. opts: { title } (e.g. the name of the kitchen).
export async function cookMenu(g, opts = {}) {
  let index = 0;
  for (;;) {
    const rank = cookRank(g);
    const known = seen(g);
    const entries = [MOYASHI, ...RECIPES];
    const items = entries.map((r) => {
      if (r === MOYASHI) return { label: `${r.name}（¥${r.price}）`, right: g.state.money >= r.price ? 'つくれる' : 'お金不足', disabled: g.state.money < r.price };
      const n = canCook(g, r);
      return { label: (known[r.id] ? '　' : '★') + r.name, right: n ? (n > 1 ? `×${n}` : 'つくれる') : '材料不足', disabled: !n };
    });
    const full = !g.canEat();
    const k = await g.list({
      title: `${opts.title || 'キッチン'}（${rank.name}・満腹${g.state.life.hunger}%）`,
      items, x: 12, y: 44, w: 380, px: true, index,
      describe: (i) => {
        const r = entries[i];
        if (r === MOYASHI) return `材料いらず！もやし代 ¥${r.price}\n${effectText(g, r)}`;
        const tag = known[r.id] ? '' : '★まだ作ったことのない料理　';
        const extra = r.serves > 1 ? `　${r.serves}皿分` : r.box === false ? '　（お弁当にはできない）' : '';
        return `${tag}${needsText(g, r)}\n${effectText(g, r)}${extra}` + (full && r.box === false ? '\nいまはおなかいっぱい…' : '');
      },
    });
    if (k < 0) return;
    index = k;
    const r = entries[k];
    if (r !== MOYASHI && canCook(g, r) < 1) {
      await g.say(`材料が足りない…。\n（${needsText(g, r)}）\n商店街のスーパー「まるどっと」で買えるよ。`);
      if (g.auto) return;
      continue;
    }
    const ok = await cookOne(g, r);
    if (g.auto) return;
    if (ok && !g.canEat() && !RECIPES.some((x) => x.box !== false && canCook(g, x) > 0)) return;
  }
}

// Recipe hints for a flyer / sign (machi.js uses it at the supermarket).
export function recipeHint(g) {
  const known = seen(g);
  const todo = RECIPES.filter((r) => !known[r.id]);
  const r = todo.length ? todo[Math.floor(Math.random() * todo.length)] : RECIPES[Math.floor(Math.random() * RECIPES.length)];
  const need = Object.entries(r.needs).map(([id, k]) => `${(ITEMS[id] && ITEMS[id].name) || id}${k > 1 ? '×' + k : ''}`).join('・');
  return `【きょうのおすすめレシピ】${r.name}\n材料：${need}`;
}
