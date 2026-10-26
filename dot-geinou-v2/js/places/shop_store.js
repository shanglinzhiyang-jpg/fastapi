// 買う [R12-S2]: the shops with shelves — 本屋・古本屋・薬局・100円ショップ・八百屋・和菓子屋・古着屋. Items are registered here (ids shop_*).
//
//   shop_shoten      ドット書店 (ドット商店街, 10:00〜21:00): new books → read them (skill + 芸の力 + ネタの種), 立ち読み (a ネタの種, twice and the clerk frowns)
//   shop_furuhon_t   古本屋 (東京 劇場通り, 11:00〜19:00, 水曜休み) / shop_furuhon_n 古本屋 (なんば, 11:00〜20:00): cheap old books, the stock changes daily
//   shop_yakkyoku    ドラッグストア ドット (ドット商店街, 9:00〜22:00): 栄養ドリンク・胃腸薬 (cures the morning after: shopkit's 二日酔い)・湿布, 健康相談
//   shop_hyakuen     100円ショップ (なんば 千日前, 10:00〜21:00): everything is 100円 (the era's price): メモ帳 (ネタの種)・小道具 (a buff for コント)
//   shop_yaoya       八百屋 みどりや (ドット商店街, 8:00〜19:00, 日曜休み): vegetables and fruit of the season, haggling (まけてくれる？)
//   shop_wagashi     和菓子 あんこ堂 (ドット商店街 アーケード, 9:00〜18:00, 水曜休み): the seasonal sweet, a cup of tea on the bench, 菓子折り for the 楽屋
//   shop_furugi_t    古着屋 (東京 芸人通り, 12:00〜21:00) / shop_furugi_n 古着屋 ミナミ (なんば, 12:00〜21:00): 衣装 you keep: wearing one (once a day) raises 身だしなみ
//                    and gives the next stage a buff (state.buffs: the same one nodoame / ネタ帳 give); 試着 with the mirror
// Prices are internal (2026 yen). Real prices that the name promises (100円) are converted to the era's yen (toInternal) so the label is true.

import {
  registerShop, registerItem, room, npc, sign, who, SS, dayN, bumpN, firstVisit, byEra, eraId, yearNow, monthNow, has, passTime, T, hm, nowTotal,
  fmtMoney, pick, adult, LOOKS, ITEMS, orderMenu, addSeed, rumorTalk, shelf, goodsOf, diffText, clamp, hash2, MODS,
} from '../world/shopkit.js';
import { display } from '../engine/util.js';
import { INGREDIENTS } from '../world/cooking.js';

const say = (g, n, t) => g.say(t, who(n));
const toInternal = (shown) => Math.max(1, Math.round(shown / (display.priceRate || 1)));
const SKILL_JA = { warai: 'お笑い', engi: '演技', uta: '歌', talk: 'トーク' };
const STAT_JA = { boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間・テンポ', voice: '声量・滑舌', act: '演技力', hassou: '発想力', wagei: '話芸', dokyo: '度胸', chara: 'キャラ・華', adlib: 'アドリブ', mane: 'ものまね', neta: 'ネタ作り', kosei: '構成力', kankyaku: '客席を読む力' };

// ====================================================================== books
const BOOKS = {
  shop_bk_manzai: { name: '『漫才のつくりかた』', price: 1400, stats: { neta: 1.6, ma: 0.8, kosei: 0.6 }, skill: 'warai', seeds: 1, desc: 'ツカミ、フリ、オチ。基本の型を、やさしく解説した入門書。' },
  shop_bk_engi: { name: '『演技のきほん』', price: 1400, stats: { act: 1.8, kankyaku: 0.4 }, skill: 'engi', seeds: 1, desc: '役に入る、セリフを立てる、間をとる。稽古場の知恵。' },
  shop_bk_voice: { name: '『声がよく通る本』', price: 1200, stats: { voice: 1.8, dokyo: 0.5 }, skill: 'uta', seeds: 0, desc: '腹式呼吸、滑舌、のどのケア。声は、楽器だ。' },
  shop_bk_talk: { name: '『人を笑顔にする会話術』', price: 1200, stats: { kankyaku: 1.2, wagei: 0.8, chara: 0.5 }, skill: 'talk', seeds: 1, desc: '聞く、うなずく、ひとこと足す。会話の達人の習慣。' },
  shop_bk_hassou: { name: '『アイデアが降ってくる』', price: 1000, stats: { hassou: 1.8, adlib: 0.5 }, skill: null, seeds: 2, desc: '日常を「もしも」でひっくり返す練習帳。' },
  shop_bk_rakugo: { name: '『はじめての落語』', price: 1100, stats: { wagei: 1.8, ma: 0.9 }, skill: 'talk', seeds: 1, desc: 'まくら、本題、サゲ。古典の名作を、あらすじで読む。' },
  // old books (cheap, rougher)
  shop_bk_zasshi: { name: '古い演芸雑誌', price: 300, stats: { wagei: 0.5, kankyaku: 0.3 }, skill: null, seeds: 2, desc: '昔の寄席の写真と、芸人の座談会。黄ばんでいる。' },
  shop_bk_pamph: { name: '劇場のパンフレット', price: 200, stats: { kankyaku: 0.7 }, skill: null, seeds: 1, desc: '昔の公演のパンフ。出演者の一言コメントがおもしろい。' },
  shop_bk_gikyoku: { name: '戯曲集（古本）', price: 500, stats: { act: 1.0, kosei: 1.0 }, skill: 'engi', seeds: 1, desc: '舞台の台本をそのまま読める。書きこみつき。' },
  shop_bk_kouza: { name: 'お笑い講座（ぼろぼろ）', price: 400, stats: { neta: 1.0, boke: 0.6 }, skill: null, seeds: 1, desc: '前の持ち主の書きこみだらけ。…それがまた、役に立つ。' },
};
async function readBook(g, id) {
  const B = BOOKS[id];
  if (!B) return;
  if (dayN(g, 'read') >= 2) { await g.say('今日はもう、二冊も読んだ。\n…目が疲れて、字が頭に入ってこない。\n（本は、また明日）'); return; }
  if (g.state.stamina < 2) { await g.say('体力が足りない…。\nページをめくる元気も、ない。'); return; }
  g.takeItem(id);
  bumpN(g, 'read');
  const S = SS(g);
  const first = !S.read[id];
  S.read[id] = 1;
  g.state.stamina -= 2;
  await g.fadeOut(10); g.sfx('cursor'); await g.wait(400); await g.fadeIn(10);
  passTime(g, 60, '読書');
  const before = {};
  for (const k of Object.keys(B.stats)) before[k] = has(g, 'comedyStat') ? g.comedyStat(k) : 0;
  const mult = first ? 1 : 0.4;
  for (const [k, v] of Object.entries(B.stats)) { try { g.addComedyStat(k, v * mult, true); } catch (e) { /* optional */ } }
  const ups = Object.keys(B.stats).filter((k) => has(g, 'comedyStat') && g.comedyStat(k) > before[k]).map((k) => STAT_JA[k]);
  let sk = '';
  if (first && B.skill) { g.addSkill(B.skill, 1, true); sk = `　${SKILL_JA[B.skill]} +1`; }
  const seeds = [];
  for (let i = 0; i < B.seeds; i++) { const t = addSeed(g, `${B.name}より`); if (t) seeds.push(t); }
  g.relax({ stress: 3 });
  await g.say([`${B.name}を、じっくり読んだ。`, `（${ups.length ? ups.join('・') + 'が少し伸びた' : first ? '読んだことが、体にたまっていく' : '一度読んだ内容だ。復習になった'}${sk}）`, seeds.length ? `（ネタの種：${seeds.map((t) => `「${t}」`).join('')}）` : '（ネタの種は、今回は見つからなかった）']);
}
for (const [id, B] of Object.entries(BOOKS)) {
  registerItem(id, { name: B.name, price: B.price, desc: `${B.desc}\n使うと、1時間かけて読む。（1日2冊まで・体力-2）`, use: (g) => readBook(g, id) });
}

// ====================================================================== medicine and small goods
const sameDay = (g, key, limit) => dayN(g, key) < limit;
registerItem('shop_vita', {
  name: '栄養ドリンク', price: 600, desc: '瓶入りの栄養ドリンク。使うと体力 +18。\n（よく効くのは1日1本まで）',
  use: async (g) => {
    g.takeItem('shop_vita');
    const full = sameDay(g, 'vita', 1); bumpN(g, 'vita');
    const heal = full ? 18 : 6;
    const before = g.state.stamina;
    g.heal(heal); g.relax({ stress: full ? 2 : 0 });
    g.sfx('good');
    await g.say([`ごくごく…。瓶のふたを開けて、一気に飲みほした。`, `体力 +${g.state.stamina - before}${full ? '' : '\n（もう何本も飲んでいる。効き目は、うすい…）'}`]);
  },
});
registerItem('shop_stomach', {
  name: '胃腸薬', price: 800, desc: '飲みすぎ・食べすぎの朝の、強い味方。\n飲んだ日の夜に使えば、翌朝がぐっと楽になる。',
  use: async (g) => {
    const S = SS(g);
    if (S.hang === g.state.day) {
      g.takeItem('shop_stomach');
      S.hang = 0;
      g.sfx('good');
      await g.say(['寝る前に、胃腸薬を飲んだ。', '…これで、明日の朝は、だいじょうぶそうだ。\n（二日酔いを防いだ）']);
    } else if (S.hangDay === g.state.day) {
      g.takeItem('shop_stomach');
      S.hangDay = 0;
      const before = g.state.stamina;
      g.heal(10); g.addNeed('stress', -3);
      g.sfx('good');
      await g.say(['頭の重さに、胃腸薬を飲んだ。', `だいぶ、楽になった。（体力 +${g.state.stamina - before}　ストレス -3）`]);
    } else await g.say('いまは、飲む必要がなさそうだ。\n（飲みすぎた日の夜か、二日酔いの朝に使おう）');
  },
});
registerItem('shop_plaster', {
  name: '湿布', price: 500, desc: '肩と腰に貼る。使うと体力 +12。\n（立ち稽古のあとに）',
  use: async (g) => {
    g.takeItem('shop_plaster');
    const before = g.state.stamina;
    g.heal(12); g.relax({ stress: 1 });
    g.sfx('good');
    await g.say(['ひんやり…。肩と腰に、湿布を貼った。', `体力 +${g.state.stamina - before}`]);
  },
});
registerItem('shop_facewash', {
  name: '洗顔料と化粧水', price: 700, desc: '朝晩のスキンケア。使うと身だしなみ +12。\n（1日1回）',
  use: async (g) => {
    g.takeItem('shop_facewash');
    const full = sameDay(g, 'facewash', 1); bumpN(g, 'facewash');
    const d = g.bathe(full ? 12 : 3, true);
    g.sfx('good');
    await g.say(['丁寧に洗って、化粧水をぱたぱた。', `身だしなみ +${Math.round(d)}`]);
  },
});

// ====================================================================== 100円
const H1 = () => toInternal(100);
const H2 = () => toInternal(200);
registerItem('shop_note100', {
  name: 'メモ帳', price: 100, desc: '思いつきを書きとめる、小さなメモ帳。\n使うと、ネタの種が一つ見つかる。',
  use: async (g) => {
    g.takeItem('shop_note100');
    const t = addSeed(g, '自分のメモ');
    passTime(g, 15, 'メモ');
    await g.say(t ? ['日常のできごとを、ひとつ、書きとめた。', `（ネタの種：「${t}」）`] : ['メモ帳を開いたけれど、書くことが思いつかない。\n（ネタの種は、もういっぱいだ）']);
  },
});
registerItem('shop_towel100', {
  name: 'ミニタオル', price: 100, desc: '汗をぬぐうミニタオル。使うと身だしなみ +8。\n（1日1回）',
  use: async (g) => { g.takeItem('shop_towel100'); const full = sameDay(g, 'towel', 1); bumpN(g, 'towel'); const d = g.bathe(full ? 8 : 2, true); g.sfx('good'); await g.say(`汗をふいて、顔をさっぱり。\n身だしなみ +${Math.round(d)}`); },
});
registerItem('shop_hairband100', {
  name: 'ヘアゴムとピン', price: 100, desc: '髪をまとめる。使うと身だしなみ +8。',
  use: async (g) => { g.takeItem('shop_hairband100'); const d = g.bathe(8, true); g.sfx('good'); await g.say(`髪をきゅっとまとめた。\n身だしなみ +${Math.round(d)}`); },
});
registerItem('shop_snack100', { name: 'おやつのお菓子', price: 100, heal: 6, fill: 14, desc: '100円のお菓子。体力が6回復する。' });
registerItem('shop_tea100', { name: 'ペットボトルのお茶', price: 100, heal: 4, fill: 8, desc: 'ひとやすみのお茶。体力が4回復する。' });
registerItem('shop_props', { name: 'コント小道具セット', price: 200, buff: 'engi', desc: 'つけひげ、ハリセン、小さな紙の王冠。\n次の「演技」のミニゲームが少しやさしくなる。' });
registerItem('shop_flip', { name: 'フリップ用スケッチブック', price: 200, buff: 'warai', desc: '大きな字で、お題と答えを書く。\n次の「お笑い」のミニゲームが少しやさしくなる。' });

// ====================================================================== 八百屋・和菓子
registerItem('shop_mikan', { name: 'みかん（ふくろ）', price: 250, heal: 8, fill: 16, desc: 'ビタミンたっぷり。体力が8回復する。' });
registerItem('shop_ringo', { name: 'りんご', price: 200, heal: 7, fill: 14, desc: 'シャキッとした、赤いりんご。体力が7回復する。' });
registerItem('shop_season', { name: '旬の果物', price: 350, heal: 10, fill: 18, desc: 'その季節のおいしい果物。体力が10回復する。' });
registerItem('shop_daifuku', { name: '大福', price: 180, heal: 8, fill: 14, desc: 'やわらかい、こしあん大福。体力が8回復する。' });
registerItem('shop_dorayaki', { name: 'どら焼き', price: 200, heal: 9, fill: 15, desc: 'ふんわり生地のどら焼き。体力が9回復する。' });
registerItem('shop_dango', { name: '三色団子', price: 250, heal: 8, fill: 14, desc: 'ピンク・白・みどりの団子。体力が8回復する。' });
registerItem('shop_yokan', { name: 'ようかん', price: 500, heal: 12, fill: 18, desc: 'しっとりした、小倉ようかん。体力が12回復する。' });
registerItem('shop_seasonal', { name: '季節の生菓子', price: 350, heal: 10, fill: 14, desc: '季節のはなを形にした、上品な生菓子。体力が10回復する。' });
registerItem('shop_kashiori', { name: '菓子折り', price: 2000, heal: 10, fill: 20, desc: 'ていねいに包んだ、和菓子の詰め合わせ。\n楽屋への差し入れや、人へのおくりものに。' });
const SEASONAL = (g) => {
  const m = monthNow(g);
  if (m === 3 || m === 4) return '桜餅';
  if (m === 5) return '柏餅';
  if (m === 6 || m === 7 || m === 8) return '水ようかん';
  if (m === 9 || m === 10 || m === 11) return '栗きんとん';
  return 'いちご大福';
};
const FRUIT = (g) => {
  const m = monthNow(g);
  if (m >= 6 && m <= 8) return 'スイカ';
  if (m === 9 || m === 10) return 'ぶどう';
  if (m === 11 || m === 12 || m === 1) return 'みかん（箱）';
  if (m === 2 || m === 3) return 'いちご';
  return 'びわ';
};

// ====================================================================== 古着 (wardrobe items: kept, worn once a day)
const CLOTHES = {
  shop_cl_jacket: { name: '派手なジャケット', price: 3800, color: '#ff4f8b', clean: 20, buff: 'talk', desc: 'ド派手な柄のジャケット。着ると、不思議と声が大きくなる。' },
  shop_cl_suit: { name: '古着のスーツ', price: 5200, color: '#3a4a7a', clean: 30, buff: 'warai', desc: '漫才の定番。着ると背すじがのびる。' },
  shop_cl_stage: { name: 'ステージ衣装（ラメ）', price: 6500, color: '#c8a0ff', clean: 30, buff: 'uta', desc: 'ラメの入った、キラキラの衣装。照明に映える。' },
  shop_cl_kigurumi: { name: '着ぐるみパジャマ', price: 3000, color: '#ffd23f', clean: 10, buff: 'engi', desc: 'コントの衣装にもなる、かぶりもの系のパジャマ。' },
  shop_cl_coat: { name: 'ヴィンテージのコート', price: 4500, color: '#8a6a4a', clean: 35, buff: null, desc: '昔のコート。ただ着ているだけで、様になる。' },
  shop_cl_hyo: { name: 'ヒョウ柄のジャケット', price: 4200, color: '#c8782a', clean: 20, buff: 'warai', desc: '大阪のおばちゃんも、思わず振り返るヒョウ柄。' },
  shop_cl_gold: { name: '金色のスニーカー', price: 3600, color: '#ffd23f', clean: 15, buff: 'talk', desc: '足もとだけ、ひときわ目立つ。' },
};
for (const [id, C] of Object.entries(CLOTHES)) {
  registerItem(id, {
    name: C.name, price: C.price,
    desc: `${C.desc}\n使うと着替える。身だしなみ +${C.clean}${C.buff ? `・次の「${SKILL_JA[C.buff]}」のミニゲームが少しやさしくなる` : ''}。（1日1回・衣装は消えない）`,
    use: async (g) => {
      const S = SS(g);
      if (S.wearDay === g.state.day && S.wear) { await g.say(`今日は、もう「${ITEMS[S.wear] ? ITEMS[S.wear].name : '衣装'}」に着替えた。\n（効き目は、次の舞台まで続く）`); return; }
      S.wear = id; S.wearDay = g.state.day;
      const d = g.bathe(C.clean, true);
      let note = '';
      if (C.buff) { if (!g.state.buffs[C.buff]) { g.state.buffs[C.buff] = true; note = `\n次の「${SKILL_JA[C.buff]}」のミニゲームが少しやさしくなる。`; } else note = '\n（すでに同じ効き目が出ている）'; }
      g.sfx('good');
      await g.say(['衣装に着替えた。', `「${C.name}」…鏡の中の自分が、ちょっと別人みたいだ。`], { name: g.state.name, look: { ...(g.state.look || {}), top: C.color } });
      await g.say(`身だしなみ +${Math.round(d)}${note}`);
    },
  });
}

// ====================================================================== the store builder
function store(S) {
  const r = room(S.w, S.h);
  S.build(r);
  r.exit(...S.exits);
  const clerk = S.clerk;
  const talk = (g, n) => S.talk(g, n);
  registerShop({
    id: S.id, name: S.name, bgm: S.bgm || 'machi_shop', hours: S.hours,
    start: { room: 'main', x: S.exits[0], y: S.h - 2, dir: 'up' },
    rooms: {
      main: {
        floor: S.floor, wall: S.wall, tiles: r.rows(), legend: S.legend, warps: r.warps(...S.exits),
        entities: [npc(S.id + '_clerk', S.clerkAt[0], S.clerkAt[1], 'down', clerk.look, clerk.name, talk, { fixedDir: true }), ...S.cast],
        events: [...(S.counter ? [{ x: S.counter.x, y: S.counter.y, w: S.counter.w, on: 'action', run: (g) => talk(g, clerk) }] : []), ...S.events],
        onEnter: (g) => firstVisit(g, S.id, S.intro, clerk),
      },
    },
    crime: S.crime || { label: '店内（店員の目）', detect: 1.1, cam: 1.15, hide: -0.12 },
  });
}
const LEG = { R: 'register', C: 'counter', B: 'shop_bookrack', G: 'magazine', P: 'plant', H: 'bench', K: 'shop_pharm', Y: 'shop_hyaku', J: 'machi_produce', X: 'shop_wagashi', L: 'clothes_rack', F: 'shop_fitting', Q: 'mirror', N: 'table', V: 'vending', b: 'boxes', x: 'box', w: 'window', p: 'poster', c: 'clock', h: 'chair', D: 'desk' };
const liftOf = (where, items) => ({ where, items });

// ---------------------------------------------------------------- 書店
const SHOTEN_CLERK = { name: '書店の店員さん', look: { ...LOOKS.clerk, top: '#2a3a7a', apron: '#2a3a7a', glasses: true } };
const newBooks = ['shop_bk_manzai', 'shop_bk_engi', 'shop_bk_voice', 'shop_bk_talk', 'shop_bk_hassou', 'shop_bk_rakugo'];
async function standRead(g) {
  const n = bumpN(g, 'tachiyomi');
  if (n === 3) { await g.say('…店員さんが、咳ばらいをした。\n「立ち読みは、ほどほどに」と、目が言っている。'); return; }
  if (n > 3) { await g.say('これ以上の立ち読みは、気まずい。\n（買って帰ろう）'); return; }
  passTime(g, 15, '立ち読み');
  const t = addSeed(g, '雑誌の立ち読み');
  g.relax({ stress: 1 });
  await g.say([byEra(g, { showa: 'テレビ情報誌をぱらぱらめくった。\nバラエティの特集に、芸人の座談会が載っている。', heisei_early: '週刊誌をぱらぱらめくった。\n「今、売れてる芸人」のランキングが、気になる。', heisei: 'お笑い雑誌をぱらぱらめくった。\nブログからブレイクした若手の特集だ。', reiwa: '紙の雑誌を、ぱらぱらめくった。\nネットで炎上した芸人の話が、堂々と載っている。' }), t ? `（ネタの種：「${t}」）` : '（めぼしい記事は、なかった）']);
}
store({
  id: 'shop_shoten', name: 'ドット書店', hours: { spans: [[T(10), T(21)]], note: '' }, w: 12, h: 9, floor: 'floor_wood', wall: 'cream', exits: [5, 6], legend: LEG,
  clerk: SHOTEN_CLERK, clerkAt: [3, 2], counter: { x: 2, y: 3, w: 3 },
  intro: ['いらっしゃいませ。ドット書店です。', '芸の本は、奥の棚に。立ち読みは、ほどほどにお願いしますね。'],
  talk: async (g, n) => {
    const o = who(n);
    const k = await g.ask('いらっしゃいませ。本をお探しですか？', ['本を買う', 'おすすめを聞く', 'やめておく'], { ...o, cancel: 2 });
    if (k === 0) await shelf(g, { title: 'ドット書店', greeting: '「読む」のも、芸のうちですよ。', items: newBooks.concat(['manga', 'book', 'cd', 'wadai']), lift: liftOf('ドット書店', ['shop_bk_manzai', 'shop_bk_engi', 'manga']) });
    else if (k === 1) await g.say(['最近は、「ネタの作り方」の本を買っていく若い人が多いですよ。', '書いて、見せて、直す。\n本はその「型」を教えてくれます。', '読んだら、ネタの種をメモするといいですよ。\n（使うと、1時間かけて読む）'], o);
  },
  build(r) {
    r.set(2, 1, 'w').set(5, 1, 'p').set(8, 1, 'c').set(10, 1, 'w');
    r.rect(1, 2, 1, 1, 'P').rect(2, 3, 3, 1, 'C').set(3, 4, 'R');
    r.rect(7, 2, 4, 1, 'B').rect(7, 4, 2, 1, 'B').set(10, 4, 'G').set(10, 5, 'G').rect(2, 6, 3, 1, 'G').set(8, 6, 'H').set(9, 6, 'H').set(1, 7, 'P');
  },
  cast: [
    npc('st_kyaku1', 8, 5, 'right', { ...LOOKS.fan, top: '#c87a8a', glasses: true }, '本をえらぶ学生', ['芸能の本棚、ここの店は充実してるんだ。', '「読むだけで笑いが上手くなる」なんて、ない。\nでも、笑いの考え方は、学べるよ。']),
    npc('st_kyaku2', 3, 7, 'up', LOOKS.salaryman, '立ち読みの会社員', ['…あ、すみません。立ち読みしすぎですよね。', '週刊誌の連載を、ここで追ってるんです。']),
  ],
  events: [
    { x: 7, y: 3, w: 4, on: 'action', run: (g) => shelf(g, { title: '芸の本の棚', greeting: '芸の棚です。', items: newBooks, lift: liftOf('ドット書店', ['shop_bk_manzai', 'shop_bk_engi']) }) },
    { x: 2, y: 5, w: 3, on: 'action', run: (g) => standRead(g) },
    { x: 10, y: 3, w: 1, h: 3, on: 'action', run: (g) => standRead(g) },
  ],
});

// ---------------------------------------------------------------- 古本屋
const FURUHON_OLD = ['shop_bk_zasshi', 'shop_bk_pamph', 'shop_bk_gikyoku', 'shop_bk_kouza'];
const todaysOld = (g) => { const l = FURUHON_OLD.filter((_, i) => hash2(g.state.day, i, 31) < 0.7); return l.length ? l : FURUHON_OLD.slice(0, 2); };
function furuhon(F) {
  store({
    id: F.id, name: F.name, hours: F.hours, w: 10, h: 8, floor: 'floor_wood_dark', wall: 'wood', exits: [4], legend: { ...LEG, w: 'window', p: 'poster' }, bgm: 'shop_quiet',
    clerk: F.clerk, clerkAt: [2, 2], counter: { x: 1, y: 3, w: 3 },
    intro: F.intro,
    talk: async (g, n) => {
      const o = who(n);
      const k = await g.ask(F.greet, ['本を見る', '店主の話を聞く', 'やめておく'], { ...o, cancel: 2 });
      if (k === 0) { const items = todaysOld(g); await shelf(g, { title: F.name, greeting: `今日の入荷は、${items.length}冊だよ。`, items, lift: liftOf(F.name, items) }); }
      else if (k === 1 && !(await rumorTalk(g, F.id, o, F.talkOpen))) await g.say(F.talkAgain, o);
    },
    build(r) {
      r.set(2, 1, 'p').set(5, 1, 'w').set(7, 1, 'p');
      r.rect(1, 3, 3, 1, 'C').set(2, 4, 'R').rect(5, 2, 4, 1, 'B').rect(5, 4, 4, 1, 'B').rect(5, 6, 2, 1, 'b').set(8, 6, 'x').set(1, 6, 'x').set(1, 5, 'P');
    },
    cast: F.cast,
    events: [
      { x: 5, y: 3, w: 4, on: 'action', run: (g) => { const items = todaysOld(g); return shelf(g, { title: F.name, greeting: '今日の棚は、これだけだ。', items, lift: liftOf(F.name, items) }); } },
      { x: 5, y: 5, w: 4, on: 'action', run: (g) => { const items = todaysOld(g); return shelf(g, { title: F.name, greeting: '掘り出し物が、あるかもしれない。', items, lift: liftOf(F.name, items) }); } },
    ],
  });
}
furuhon({
  id: 'shop_furuhon_t', name: '古本屋（劇場通り）', hours: { spans: [[T(11), T(19)]], closed: [2], note: '水曜定休' },
  clerk: { name: '古本屋の店主', look: { ...LOOKS.oldman, top: '#5a4a3a', glasses: true } },
  intro: ['……いらっしゃい。', '昔の演芸雑誌なら、そこの奥。\n（棚の中身は、日によって変わるよ）'], greet: '…何か、探してるのかい。',
  talkOpen: ['この商売を、四十年やっている。', '芸人は、よく来るよ。売れる前も、売れたあとも。\n…売れたあとは、古い雑誌を買いに来るんだ。昔の自分を、探しに。'], talkAgain: '…話すことは、もうないよ。ゆっくり見ていきな。',
  cast: [npc('fh_t_kyaku', 6, 5, 'down', { ...LOOKS.comedian2, top: '#8a5ac8' }, '古雑誌を探す芸人', ['昔の先輩のネタを、活字で読むのが好きなんだ。', '映像だと、見えない「間」が、活字だと見えることがある。'])],
});
furuhon({
  id: 'shop_furuhon_n', name: '古本屋（なんば）', hours: { spans: [[T(11), T(20)]], note: '' },
  clerk: { name: '古本屋のおっちゃん', look: { ...LOOKS.oldman, top: '#6a5a4a', glasses: false } },
  intro: ['いらっしゃい。古本屋や。', '劇場のパンフと、昔の演芸雑誌が、一冊百円からやで。\n（棚の中身は、日によって変わるで）'], greet: 'いらっしゃい。探してるもん、あるか？',
  talkOpen: ['この辺は、劇場の街やろ。', '昔の公演のパンフレットが、よう出てくるんや。\n…死んだ芸人の名前を見つけたら、ちょっと手が止まるわ。'], talkAgain: 'もう話したやろ。ゆっくり見ていき。',
  cast: [npc('fh_n_kyaku', 6, 5, 'down', { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, '本を探すNSC生', ['ここで買うた本は、全部ネタ作りの教科書や。', '一冊三百円で、先輩の知恵が手に入るんやで。'])],
});

// ---------------------------------------------------------------- ドラッグストア
const YAKU_CLERK = { name: '薬剤師さん', look: { ...LOOKS.receptionist, top: '#ffffff', bottom: '#2f9a4a', jacket: true, skirt: false, hair: 'bob' } };
async function healthCheck(g, n) {
  const o = who(n);
  const L = g.state.life;
  const lines = [];
  if (L.stress >= 100) lines.push('…ストレスが、限界ですね。\nお薬より、まず休むことです。好きなことを、してください。');
  else if (L.stress >= 70) lines.push('ストレスが、かなりたまっていますね。\nお風呂、カラオケ、散歩…何でもいいので、気分転換を。');
  else if (L.stress >= 40) lines.push('少し、疲れが出ていますね。\n早めに寝るのが、いちばんの薬です。');
  else lines.push('ストレスは、落ちついていますね。\nいい調子ですよ。');
  if (L.hunger < 20) lines.push('それと、おなかがぺこぺこですね。\nお薬より、まず食事を。');
  if (L.clean < 30) lines.push('身だしなみが乱れていますね。\nお風呂と洗顔で、気分も上がりますよ。');
  if (g.state.stamina < g.state.maxStamina * 0.4) lines.push('体力もだいぶ落ちています。\n栄養ドリンクより、睡眠が先ですよ。');
  await g.say(['血圧と体重を、はかってもらった。', ...lines], o);
  if (dayN(g, 'sample') < 1 && SS(g).sampleDay !== g.state.day && (SS(g).sampleAt || -9) <= g.state.day - 3 && L.stress >= 40) {
    SS(g).sampleAt = g.state.day; SS(g).sampleDay = g.state.day; bumpN(g, 'sample');
    g.giveItem('nodoame', 1, true);
    await g.say('「これ、よかったらどうぞ。のどあめのサンプルです」\n（のどあめをもらった）', o);
  }
}
store({
  id: 'shop_yakkyoku', name: 'ドラッグストア ドット', hours: { spans: [[T(9), T(22)]], note: '' }, w: 12, h: 9, floor: 'floor_tile', wall: 'green', exits: [5, 6], legend: { ...LEG, w: 'wall_green+window', p: 'wall_green+poster', c: 'wall_green+clock' }, bgm: 'machi_shop',
  clerk: YAKU_CLERK, clerkAt: [3, 2], counter: { x: 2, y: 3, w: 3 },
  intro: ['いらっしゃいませ。ドラッグストア ドットです。', 'お薬のご相談は、カウンターで。\n体力ドリンクは、入口のワゴンにも。'],
  talk: async (g, n) => {
    const o = who(n);
    const k = await g.ask('いらっしゃいませ。どうされましたか？', ['お薬・日用品を買う', '健康相談（血圧と体重）', 'やめておく'], { ...o, cancel: 2 });
    if (k === 0) await shelf(g, { title: 'ドラッグストア ドット', greeting: 'お大事に。', items: ['shop_vita', 'shop_stomach', 'shop_plaster', 'shop_facewash', 'nodoame', 'machi_wax', 'machi_bathsalt', 'machi_aroma'], lift: liftOf('ドラッグストア ドット', ['shop_vita', 'machi_wax']) });
    else if (k === 1) await healthCheck(g, n);
  },
  build(r) {
    r.set(2, 1, 'w').set(5, 1, 'p').set(8, 1, 'c').set(10, 1, 'w');
    r.rect(2, 3, 3, 1, 'C').set(3, 4, 'R');
    r.rect(7, 2, 4, 1, 'K').rect(7, 4, 4, 1, 'K').rect(2, 6, 3, 1, 'K').rect(7, 6, 3, 1, 'K').set(1, 2, 'P').set(10, 7, 'P').set(1, 7, 'V');
  },
  cast: [
    npc('yk_kyaku', 8, 5, 'down', { ...LOOKS.mom, top: '#8ac0a0' }, '買い物中のお客さん', ['のどあめは、舞台に立つ人は必需品なんですって。', '湿布は、肩こりだけじゃなくて、立ち稽古の腰にも効くのよ。']),
    npc('yk_sarary', 4, 5, 'up', { ...LOOKS.salaryman, top: '#6a7a8a' }, '疲れた会社員', ['昨日、飲みすぎちゃって…。\n胃腸薬、ください…。', '「夜のうちに飲んでおくと、朝が楽」って、薬剤師さんが。']),
  ],
  events: [
    { x: 7, y: 3, w: 4, on: 'action', run: (g) => shelf(g, { title: '薬の棚', greeting: 'お大事に。', items: ['shop_vita', 'shop_stomach', 'shop_plaster', 'nodoame'], lift: liftOf('ドラッグストア ドット', ['shop_vita', 'nodoame']) }) },
    { x: 7, y: 5, w: 4, on: 'action', run: (g) => shelf(g, { title: '日用品の棚', greeting: '身だしなみ用品も、そろっています。', items: ['shop_facewash', 'machi_wax', 'machi_bathsalt', 'machi_aroma'], lift: liftOf('ドラッグストア ドット', ['machi_wax', 'machi_bathsalt']) }) },
    { x: 2, y: 5, w: 3, on: 'action', run: (g) => shelf(g, { title: 'ドリンクと栄養補助', greeting: '元気の素です。', items: ['shop_vita', 'drink', 'shop_plaster'], lift: liftOf('ドラッグストア ドット', ['shop_vita']) }) },
  ],
});

// ---------------------------------------------------------------- 100円ショップ
const HYAKU_CLERK = { name: '100円ショップの店員さん', look: { ...LOOKS.clerk, top: '#d62f2f', apron: '#ffd23f' } };
const hyakuItems = (g) => [
  { item: 'shop_note100', price: H1() }, { item: 'shop_towel100', price: H1() }, { item: 'shop_hairband100', price: H1() }, { item: 'shop_snack100', price: H1() }, { item: 'shop_tea100', price: H1() },
  { item: 'shop_props', price: H2() }, { item: 'shop_flip', price: H2() }, { item: 'nodoame', price: ITEMS.nodoame ? ITEMS.nodoame.price : 200 },
];
const hyakuName = (g) => byEra(g, { showa: '100円均一', any: '100円ショップ' });
store({
  id: 'shop_hyakuen', name: '100円ショップ', hours: { spans: [[T(10), T(21)]], note: '' }, w: 12, h: 9, floor: 'floor_tile', wall: 'yellow', exits: [5, 6], legend: { ...LEG, w: 'wall_yellow+window', p: 'wall_yellow+poster', c: 'wall_yellow+clock' }, bgm: 'machi_shop',
  clerk: HYAKU_CLERK, clerkAt: [8, 3], counter: { x: 7, y: 4, w: 3 },
  intro: ['いらっしゃいませ！ 100円ショップです！', 'なんでも100円。メモ帳も、小道具も、お菓子もありますよ。'],
  talk: async (g, n) => {
    const o = who(n);
    await g.say(byEra(g, { showa: 'いらっしゃいませ！ うちは「100円均一」。なんでも100円ですよ！', heisei_early: 'いらっしゃいませ！ 100円ショップへようこそ。最近、ずいぶん増えましたよ。', heisei: 'いらっしゃいませ！ 100円で、これだけそろうんです。', reiwa: 'いらっしゃいませ！ 100円ショップへようこそ。\n最近は、300円や500円の商品も増えましたけどね。' }), o);
    await shelf(g, { title: hyakuName(g), greeting: 'ごゆっくり！', items: hyakuItems(g), lift: liftOf(hyakuName(g), ['shop_note100', 'shop_snack100', 'shop_props']) });
  },
  build(r) {
    r.set(2, 1, 'w').set(5, 1, 'p').set(8, 1, 'c').set(10, 1, 'w');
    r.rect(1, 2, 4, 1, 'Y').rect(1, 4, 4, 1, 'Y').rect(1, 6, 4, 1, 'Y').rect(6, 6, 3, 1, 'Y').set(10, 6, 'x').set(10, 7, 'b').rect(7, 4, 3, 1, 'C').set(8, 5, 'R').set(10, 2, 'P');
  },
  cast: [
    npc('hy_kyaku1', 6, 5, 'right', { ...LOOKS.comedian2, top: '#ff7eb6' }, 'コント小道具を探す芸人', ['コントの小道具は、ここでそろえるのが、いちばんなんだ。', 'ハリセンも、つけひげも、紙の王冠も。\n全部、100円。…いや、200円のもあるけど。']),
    npc('hy_kyaku2', 2, 7, 'up', { ...LOOKS.mom, top: '#ffa860' }, '買い物かごいっぱいのお客さん', ['100円でも、いっぱい買うと、結局お金がかかるのよね。', '…わかってるけど、やめられないの。']),
  ],
  events: [
    { x: 1, y: 3, w: 4, on: 'action', run: (g) => shelf(g, { title: '文具・雑貨', greeting: 'ごゆっくり！', items: [{ item: 'shop_note100', price: H1() }, { item: 'shop_towel100', price: H1() }, { item: 'shop_hairband100', price: H1() }], lift: liftOf('100円ショップ', ['shop_note100']) }) },
    { x: 1, y: 5, w: 4, on: 'action', run: (g) => shelf(g, { title: 'おかし・飲み物', greeting: 'ごゆっくり！', items: [{ item: 'shop_snack100', price: H1() }, { item: 'shop_tea100', price: H1() }], lift: liftOf('100円ショップ', ['shop_snack100']) }) },
    { x: 1, y: 7, w: 4, on: 'action', run: (g) => shelf(g, { title: 'パーティ・小道具コーナー', greeting: 'コントにも、使えますよ。', items: [{ item: 'shop_props', price: H2() }, { item: 'shop_flip', price: H2() }], lift: liftOf('100円ショップ', ['shop_props']) }) },
    { x: 6, y: 7, w: 3, on: 'action', run: (g) => g.say('ワゴンセールだ。\n「本日のお買い得」の札。…全部、100円だけれど。') },
  ],
});

// ---------------------------------------------------------------- 八百屋
const YAOYA_CLERK = { name: '八百屋のおやじさん', look: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#ffffff', bottom: '#2a3a5a', apron: '#2f9a4a' } };
async function yaoyaShop(g, n, sale) {
  const items = [{ item: 'ing_cabbage', price: 120 }, { item: 'ing_veg', price: 130 }, { item: 'ing_egg', price: 40 }, { item: 'machi_banana', price: 60 }, { item: 'shop_mikan', price: 250 }, { item: 'shop_ringo', price: 200 }, { item: 'shop_season', price: 350 }]
    .map((x) => ({ item: x.item, price: Math.round(x.price * sale / 10) * 10 || 10 }));
  await shelf(g, { title: `八百屋 みどりや${sale < 1 ? '（おまけ価格）' : ''}`, greeting: sale < 1 ? 'しょうがねえ、まけとくよ！' : '今日の野菜は、朝どれだよ！', items });
}
store({
  id: 'shop_yaoya', name: '八百屋 みどりや', hours: { spans: [[T(8), T(19)]], closed: [6], note: '日曜定休' }, w: 10, h: 7, floor: 'floor_concrete', wall: 'green', exits: [4], legend: { ...LEG, w: 'wall_green+window', p: 'wall_green+poster', c: 'wall_green+clock' }, bgm: 'machi_shop',
  clerk: YAOYA_CLERK, clerkAt: [7, 3], counter: { x: 6, y: 4, w: 2 },
  intro: ['へい、らっしゃい！ 八百屋 みどりやだ。', '今日の野菜は、朝どれ。果物は、旬のをそろえてるよ。\n（「まけてよ」も、言うだけ言ってごらん）'],
  talk: async (g, n) => {
    const o = who(n);
    const k = await g.ask(`へい、らっしゃい！ 今日のおすすめは「${FRUIT(g)}」だよ！`, ['買い物する', 'まけてもらう', '店主の話を聞く', 'やめておく'], { ...o, cancel: 3 });
    if (k === 0) await yaoyaShop(g, n, 1);
    else if (k === 1) {
      if (dayN(g, 'haggle') >= 1) { await g.say('おいおい、今日はもうまけたろ。\nこれ以上は、うちが潰れちまう。', o); return; }
      bumpN(g, 'haggle');
      const talk = (g.state.skills && g.state.skills.talk || 0) / 100;
      const chance = clamp(0.25 + talk * 0.5 + (g.state.fame >= 250 ? 0.15 : 0), 0.1, 0.9);
      if (Math.random() < chance) { await g.say(['「しょうがねえなあ、あんたの笑顔に免じて…」', '一割まけてもらった！\n（トークのスキルが、ここで役に立つ）'], o); await yaoyaShop(g, n, 0.9); }
      else { await g.say(['「だめだめ、これ以上は、まけられねえ」', 'ふられた…。でも、おやじさんは、にやりと笑った。\n「また来な。次は、まけるかもしれねえぞ」'], o); await yaoyaShop(g, n, 1); }
    } else if (k === 2 && !(await rumorTalk(g, 'yaoya', o, ['野菜はな、嘘をつかねえ。', '手をかけりゃ、かけたぶんだけ、ちゃんと育つ。\n…芸人も、おんなじだろ？']))) await g.say('さっき話したろ。\n大根が、待ってるよ。', o);
  },
  build(r) {
    r.set(2, 1, 'w').set(5, 1, 'p').set(7, 1, 'c');
    r.rect(1, 2, 3, 1, 'J').rect(1, 4, 3, 1, 'J').rect(5, 2, 2, 1, 'J').rect(6, 4, 2, 1, 'C').set(7, 5, 'R').set(8, 2, 'x').set(8, 5, 'b');
  },
  cast: [
    npc('yo_okusan', 3, 5, 'up', { ...LOOKS.mom, top: '#e8c058', apron: '#ffffff' }, '買い物中の奥さん', ['このお店は、朝いちばんに来ると、いいのが残ってるのよ。', '水曜は、スーパーのほうが安いけどね。\n…でも、野菜は、ここがおいしいの。']),
    npc('yo_kid', 5, 5, 'down', LOOKS.kid, 'こども', ['ぼく、ピーマン、きらい！\nでも、おじさんがくれたミニトマトは、おいしかった。']),
  ],
  events: [
    { x: 1, y: 3, w: 3, on: 'action', run: (g) => g.say('野菜がずらりと並んでいる。\n朝どれのキャベツに、ツヤツヤのなす。') },
    { x: 1, y: 5, w: 3, on: 'action', run: (g) => yaoyaShop(g, YAOYA_CLERK, 1) },
    { x: 5, y: 3, w: 2, on: 'action', run: (g) => yaoyaShop(g, YAOYA_CLERK, 1) },
  ],
});

// ---------------------------------------------------------------- 和菓子
const WAGASHI_CLERK = { name: '和菓子屋の女将さん', look: { hair: 'bob', hairColor: 'black', skin: 'fair', top: '#ffffff', bottom: '#8a3a4a', apron: '#d8c8a0', skirt: true } };
const wagashiItems = (g) => [{ item: 'shop_daifuku', price: 180 }, { item: 'shop_dorayaki', price: 200 }, { item: 'shop_dango', price: 250 }, { item: 'shop_yokan', price: 500 }, { item: 'shop_seasonal', price: 350 }, { item: 'shop_kashiori', price: 2000 }];
async function wagashiTea(g, n) {
  const o = who(n);
  if (dayN(g, 'wagashi_tea') >= 1) { await g.say('お茶は、さっきお出ししましたよ。\nお腹がいっぱいになってしまいます。', o); return; }
  if (!g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。'); return; }
  const price = 400;
  const k = await g.ask(`ベンチで、お茶と「${SEASONAL(g)}」はいかがですか？（${fmtMoney(price)}）`, ['いただく', 'やめておく'], { ...o, cancel: 1 });
  if (k !== 0) return;
  if (!g.spend(price)) { await g.say('お金が足りない…。', o); return; }
  g.sfx('coin'); bumpN(g, 'wagashi_tea');
  const a = { st: g.state.stamina, hu: g.state.life.hunger, sr: g.state.life.stress, cl: g.state.life.clean };
  g.eat(10, { silent: true, fill: 14 }); g.relax({ stress: 7 });
  passTime(g, 25, 'お茶');
  await g.say([`ほうじ茶と「${SEASONAL(g)}」。\n…ほっとする甘さだ。`, diffText(g, a)]);
}
store({
  id: 'shop_wagashi', name: '和菓子 あんこ堂', hours: { spans: [[T(9), T(18)]], closed: [2], note: '水曜定休' }, w: 9, h: 7, floor: 'floor_tatami', wall: 'cream', exits: [4], legend: { ...LEG, w: 'wall_cream+window', p: 'wall_cream+poster', c: 'wall_cream+clock' }, bgm: 'machi_cafe',
  clerk: WAGASHI_CLERK, clerkAt: [3, 2], counter: { x: 2, y: 3, w: 3 },
  intro: ['いらっしゃいませ。和菓子 あんこ堂です。', '季節のお菓子は、日がわりで。\nベンチで、お茶もどうぞ。'],
  talk: async (g, n) => {
    const o = who(n);
    const k = await g.ask(`いらっしゃいませ。いまの季節は「${SEASONAL(g)}」ですよ。`, ['お菓子を買う', 'ベンチでお茶をいただく', 'お話を聞く', 'やめておく'], { ...o, cancel: 3 });
    if (k === 0) { await shelf(g, { title: '和菓子 あんこ堂', greeting: '甘いものは、元気の素ですよ。', items: wagashiItems(g), lift: liftOf('和菓子 あんこ堂', ['shop_daifuku']) }); if (dayN(g, 'sample') < 1) { bumpN(g, 'sample'); g.relax({ stress: 2 }); await g.say('「これ、試食です」と、小さなお菓子をひとつ、くれた。\n（ストレス -2）', o); } }
    else if (k === 1) await wagashiTea(g, n);
    else if (k === 2 && !(await rumorTalk(g, 'wagashi', o, ['楽屋への差し入れに、うちの菓子折りを選んでくださる方が、多いんですよ。', '「舞台の前は、甘いものが力になる」って。\n…芸人さんは、みなさん、甘党ですね。']))) await g.say('さっきお話ししたとおりです。\nどうぞ、ごゆっくり。', o);
  },
  build(r) {
    r.set(2, 1, 'w').set(4, 1, 'p').set(6, 1, 'c');
    r.rect(2, 3, 3, 1, 'X').set(5, 3, 'R').set(1, 2, 'P').set(1, 5, 'H').set(2, 5, 'H').set(6, 5, 'N').set(7, 5, 'h');
  },
  cast: [
    npc('wg_obaa', 6, 4, 'left', { ...LOOKS.oldwoman, top: '#e86f8a' }, 'お茶を飲むおばあさん', ['ここの大福はね、こしあんが絶品なの。', '孫の運動会の前には、必ず買っていくのよ。']),
    npc('wg_geinin', 3, 5, 'up', { ...LOOKS.comedian2, top: '#2f6fd0' }, '差し入れを選ぶ芸人', ['先輩への差し入れ、毎回ここで買うんだ。', '甘いものを渡すと、先輩の機嫌がいいんだよ。']),
  ],
  events: [
    { x: 1, y: 4, w: 2, on: 'action', run: (g) => wagashiTea(g, WAGASHI_CLERK) },
  ],
});

// ---------------------------------------------------------------- 古着屋
async function fitting(g, n, kansai) {
  const o = who(n);
  const owned = Object.keys(CLOTHES).filter((id) => g.state.items[id] > 0);
  if (!owned.length) { await g.say(kansai ? 'まだ、衣装を持ってへんな。\n気に入ったの、あったら買うてき。試着は、タダやで。' : 'まだ、衣装を持っていないね。\n気に入ったのがあれば、買っていって。試着は無料だよ。', o); return; }
  const i = await g.list({ title: '試着：どれを着る？', cancel: owned.length, items: [...owned.map((id) => ({ label: CLOTHES[id].name })), { label: 'やめる' }], x: 12, y: 44, w: 360, px: true });
  if (i < 0 || i >= owned.length) return;
  const C = CLOTHES[owned[i]];
  g.sfx('good');
  await g.say([`「${C.name}」を、試着してみた。`, `（${C.buff ? `${SKILL_JA[C.buff]}の舞台で、気合が入りそうだ。` : 'ただ着ているだけで、様になる。'}）`], { name: g.state.name, look: { ...(g.state.look || {}), top: C.color } });
}
function furugi(F) {
  const stock = F.stock;
  store({
    id: F.id, name: F.name, hours: { spans: [[T(12), T(21)]], note: '' }, w: 11, h: 8, floor: 'floor_wood', wall: 'dark', exits: [5], legend: { ...LEG, w: 'wall_dark+window', p: 'wall_dark+poster', c: 'wall_dark+clock', Q: 'wall_dark+mirror' }, bgm: 'machi_cafe',
    clerk: F.clerk, clerkAt: [6, 3], counter: { x: 6, y: 4, w: 2 },
    intro: F.intro,
    talk: async (g, n) => {
      const o = who(n);
      const k = await g.ask(F.greet, ['衣装を見る・買う', '試着する', 'コーディネートの相談', 'やめておく'], { ...o, cancel: 3 });
      if (k === 0) await shelf(g, { title: F.name, greeting: F.shelfGreet, items: stock, lift: liftOf(F.name, stock.slice(0, 2)) });
      else if (k === 1) await fitting(g, n, !!F.kansai);
      else if (k === 2) {
        const clean = g.state.life.clean;
        await g.say(clean < 40 ? F.adviceRough : clean < 70 ? F.adviceOk : F.adviceGood, o);
        await g.say(F.adviceTail, o);
      }
    },
    build(r) {
      r.set(2, 1, 'w').set(4, 1, 'Q').set(6, 1, 'Q').set(8, 1, 'p').set(9, 1, 'c');
      r.rect(1, 2, 4, 1, 'L').rect(1, 4, 4, 1, 'L').rect(6, 2, 2, 1, 'L').set(9, 2, 'F').set(9, 4, 'F').rect(6, 4, 2, 1, 'C').set(7, 5, 'R').set(1, 6, 'P').set(9, 6, 'x');
    },
    cast: F.cast,
    events: [
      { x: 1, y: 3, w: 4, on: 'action', run: (g) => shelf(g, { title: F.name, greeting: 'じっくり見ていってね。', items: stock, lift: liftOf(F.name, stock.slice(0, 2)) }) },
      { x: 1, y: 5, w: 4, on: 'action', run: (g) => shelf(g, { title: F.name, greeting: '奥のほうに、掘り出し物があるよ。', items: stock, lift: liftOf(F.name, stock.slice(0, 2)) }) },
      { x: 9, y: 3, on: 'action', run: (g) => fitting(g, F.clerk, !!F.kansai) },
      { x: 9, y: 5, on: 'action', run: (g) => fitting(g, F.clerk, !!F.kansai) },
    ],
  });
}
furugi({
  id: 'shop_furugi_t', name: '古着屋（芸人通り）', stock: ['shop_cl_suit', 'shop_cl_jacket', 'shop_cl_stage', 'shop_cl_kigurumi', 'shop_cl_coat'],
  clerk: { name: '古着屋の店員さん', look: { hair: 'spiky', hairColor: 'orange', skin: 'fair', top: '#20232a', bottom: '#3a4a7a', glasses: 'sun' } },
  greet: 'いらっしゃい。衣装探し？ 芸人さんは、目立つのがいちばんだよ。', shelfGreet: '全部、一点もの。早いもの勝ちだよ。',
  intro: ['いらっしゃい。古着屋だよ。', '芸人さんも、役者さんも、衣装探しに来る。\n衣装は着替えて使う。何度でも着られるよ。（1日1回）'],
  adviceRough: '…ちょっと、身なりが乱れてるね。\n衣装より先に、お風呂とヘアメイク。\n服は、清潔感があってこそ映えるんだ。', adviceOk: 'うん、普段着としては悪くない。\nでも、舞台では、もうひと押し。\n衣装を着ると、客席からの見え方が変わるよ。', adviceGood: 'おっ、いい感じ。身なりが整ってる。\nそこに衣装を足せば、無敵だ。',
  adviceTail: '漫才はスーツ、コントは着ぐるみ、歌は光りもの。\nそんなふうに、種目で選ぶといい。',
  cast: [
    npc('fg_t_kyaku', 3, 5, 'right', { ...LOOKS.idol, top: '#ff7eb6' }, '衣装を探す女の子', ['ステージ衣装は、ここで探すの。\n新品より、古着のほうが、味があるでしょ。', 'ラメの服、見つけたんだ。\nあとは、ライブのリハ次第！']),
    npc('fg_t_geinin', 6, 5, 'up', { ...LOOKS.comedian, top: '#2f6fd0' }, '衣装合わせ中の芸人', ['漫才の衣装は、揃えたほうが、画が決まる。', '安い古着でも、揃えると「コンビ」に見えるんだ。']),
  ],
});
furugi({
  id: 'shop_furugi_n', name: '古着屋 ミナミ', kansai: true, stock: ['shop_cl_hyo', 'shop_cl_gold', 'shop_cl_suit', 'shop_cl_jacket', 'shop_cl_kigurumi'],
  clerk: { name: '古着屋のあんちゃん', look: { hair: 'afro', hairColor: 'brown', skin: 'tan', top: '#d62f2f', bottom: '#20232a', glasses: 'sun' } },
  greet: 'いらっしゃい！ 大阪の古着は、声が大きいで。', shelfGreet: 'どれもド派手やで。一点ものや。',
  intro: ['いらっしゃい！ 古着屋ミナミや。', 'ヒョウ柄に、金色のスニーカー。\n衣装は着替えて使うんや。何度でも着られるで。（1日1回）'],
  adviceRough: 'あんた、ちょっと身なり乱れとるで。\n服より、まず風呂や。きれいにしてから来てな。', adviceOk: 'まあ、普段着としてはええわ。\nせやけど、舞台やったら、もうひと押ししたいとこやな。', adviceGood: 'ええやん！ きれいにしてるやん。\nそこにヒョウ柄足したら、もう最強や。',
  adviceTail: '大阪の客はな、見た目で笑ってくれるんや。\n「なんやそのカッコ！」って、突っ込まれたら勝ちやで。',
  cast: [
    npc('fg_n_kyaku', 3, 5, 'right', { ...LOOKS.oldwoman, top: '#ff8a3d', hairColor: 'purple' }, 'ヒョウ柄のおばちゃん', ['ヒョウ柄は、大阪の正装やで。', 'あんた、舞台に立つなら、これくらい派手にせな！']),
    npc('fg_n_nsc', 6, 5, 'up', { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, 'NSC生', ['卒業公演の衣装、ここで探してるんや。', '金色のスニーカーが、気になって…\nでも、高いんよ。']),
  ],
});
