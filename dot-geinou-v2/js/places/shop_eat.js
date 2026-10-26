// 食べる・飲む [R12-S2]: the small eateries of the towns, each with its own hours, menu by era, regulars and 噂.
//
//   shop_izakaya   居酒屋 とりあえず (ドット商店街 横丁, 16:00〜26:00): お通し, drinks for 20+ only (SS drinks → 二日酔い), 宴会 with friends, 噂, ネタの種
//   shop_yakitori  焼き鳥 ドット (横丁, 17:00〜25:00, 日曜休み): the counter, お通し, おまかせ串
//   shop_chuka     中華そば 一番 (横丁, 17:00〜24:00): 大盛り, 半チャーハン, the 店主's stories by era
//   shop_tachinomi 立ち飲み ドット (横丁, 15:00〜24:00): cheap drinks and おでん, a 先輩 who treats (おごり)
//   shop_ramen_t   ラーメン屋 (東京 劇場通り, 11:00〜26:00): 「芸人さん大盛り無料」 (★250未満), ツケ for the broke
//   shop_ramen_n   ラーメン屋 (なんば NSC近く, 11:00〜25:00): 替え玉 free for an NSC student
//   shop_teishoku_n 洋食 ドット軒 (なんば 千日前, 11:00〜15:00 / 17:00〜21:00): 行列 at noon, the kitchen's 日替わり
//   shop_kushikatsu 串カツ屋 (なんば 千日前, 16:00〜24:00): 串カツ, the sauce pot (二度づけ禁止)
//   shop_horoyoi   居酒屋 ほろ酔い亭 (なんば 千日前, 16:00〜26:00): どて焼き, 宴会, 噂
// Alcohol is for 20+ (the host says no; nothing is charged). Menus and names follow the era. Prices are internal (2026 yen).

import {
  registerShop, room, npc, sign, who, SS, dayN, bumpN, firstVisit, byEra, eraId, yearNow, has, passTime, T, fmtMoney, pick, adult, ageNow,
  LOOKS, orderMenu, enkai, rumorTalk, addSeed, board, MODS,
} from '../world/shopkit.js';

const say = (g, n, t) => g.say(t, who(n));
const LOOK = {
  master: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#f2f2f2', bottom: '#20232a', apron: '#2a3a7a' },
  mama: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#ffffff', bottom: '#8a3a4a', apron: '#d8c8a0', skirt: true },
  waiter: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#ffffff', bottom: '#20232a', apron: '#20232a' },
  sarary: { ...LOOKS.salaryman, blush: true },
};
const THANKS = ['まいど！', 'ありがとうございます。', 'また来てくださいね。', 'ごゆっくり。'];
const tipTalk = (g, n, key, opening) => rumorTalk(g, key, who(n), opening);

// one eatery: build(r) paints the room; entities / events are given ready-made
function eatery(spec) {
  const r = room(spec.w, spec.h);
  spec.build(r);
  r.exit(...spec.exits);
  return registerShop({
    id: spec.id, name: spec.name, bgm: spec.bgm || 'shop_izakaya', hours: spec.hours,
    start: { room: 'main', x: spec.exits[0], y: spec.h - 2, dir: 'up' },
    rooms: {
      main: {
        floor: spec.floor, wall: spec.wall, tiles: r.rows(), legend: spec.legend,
        warps: r.warps(...spec.exits), entities: spec.entities, events: spec.events || [],
        onEnter: (g) => firstVisit(g, spec.id, spec.intro, spec.master),
      },
    },
    crime: false,
  });
}
const LEG = {
  S: 'wall_wood+shop_sakeshelf', T: 'wall_wood+machi_menutags', p: 'wall_wood+poster', c: 'wall_wood+clock', w: 'wall_wood+window',
  k: 'kitchen', F: 'fridge_drinks', G: 'shop_grill', O: 'shop_oden', C: 'counter', s: 'machi_stool', o: 'floor_tatami', z: 'floor_tatami+table_low', q: 'floor_tatami+shop_zabuton',
  t: 'table', h: 'chair', P: 'plant', W: 'water_server', B: 'bench', V: 'vending', H: 'machi_ramenpot', Y: 'shop_fryer', E: 'shop_teppan',
};

// ====================================================================== 居酒屋 とりあえず / 居酒屋 ほろ酔い亭
function izakayaMenu(g, kansai) {
  const tsumami = kansai
    ? [{ name: 'どて焼き', price: 480, heal: 16, fill: 24, stress: 4, desc: '牛すじをみそでじっくり煮こんだ、大阪の定番。', text: 'とろっとろの牛すじ。みその甘辛さが、ビールを呼ぶ。' }, { name: '串盛り（5本）', price: 780, heal: 22, fill: 30, stress: 4, desc: '串カツと焼き鳥の盛り合わせ。', text: 'サクッ、ジュワッ。…これは止まらない。' }]
    : [{ name: '焼き鳥盛り合わせ', price: 780, heal: 22, fill: 30, stress: 4, desc: 'ねぎま・つくね・皮・砂肝。', text: 'たれの香ばしさ。炭火の串は、やっぱりうまい。' }, { name: 'から揚げ', price: 580, heal: 18, fill: 26, stress: 3, desc: 'ジューシーな、塩こうじのから揚げ。', text: '熱々のから揚げに、レモンをきゅっ。' }];
  return [
    { name: kansai ? 'とりあえず生' : 'とりあえず生ビール', price: 550, stress: 12, alc: true, desc: '最初の一杯は、やっぱりこれ。', text: 'ぷはーっ！ …仕事のあとの一杯は、格別だ。' },
    { name: byEra(g, { showa: 'ホッピー', heisei_early: 'チューハイ', heisei: '酎ハイ', reiwa: 'レモンサワー' }), price: 480, stress: 10, alc: true, desc: 'さっぱりした、飲みやすい一杯。', text: 'しゅわっと、さわやか。いくらでも飲めそうで、あぶない。' },
    { name: '日本酒（ぬる燗）', price: 650, stress: 12, alc: true, desc: 'ちびちびやる、おとなの一杯。', text: 'ふわっと、からだがあたたまる。…ゆっくり飲もう。' },
    { name: 'ウーロン茶', price: 300, stress: 4, desc: 'お酒が飲めない人も、これで乾杯。', text: 'ごくごく…。これで十分、楽しい。' },
    ...(yearNow(g) >= 2009 ? [{ name: 'ノンアルコールビール', price: 420, stress: 6, desc: '二十歳未満の人も、運転する人も。', text: 'ビールみたいな味で、ちゃんと乾杯の気分になれる。' }] : []),
    { name: '枝豆', price: 350, heal: 6, fill: 10, stress: 3, desc: '塩ゆでの、たっぷり一皿。', text: 'ぷちぷち。手が止まらない。' },
    ...tsumami,
    { name: 'だし巻き卵', price: 480, heal: 12, fill: 18, stress: 3, desc: 'ふわっふわの、だし巻き。', text: 'だしの香りが、じゅわっと広がる。' },
    { name: 'お茶漬け（〆）', price: 450, heal: 14, fill: 28, stress: 3, desc: '飲んだあとは、これで〆る。', text: 'さらさら…。これで、おなかも心も落ちついた。' },
  ];
}
function izakaya(id, name, hours, K, intro, W) {
  const kansai = !!K.kansai;
  const master = { name: K.master, look: LOOK.master };
  const order = (g, n) => orderMenu(g, { title: name, entries: izakayaMenu(g, kansai), host: n || master, thanks: pick(THANKS), where: '居酒屋', cover: { id, name: 'お通し', price: 330 } });
  const menu = async (g, n) => {
    const o = who(n);
    const k = await g.ask(kansai ? 'いらっしゃい！ なんにします？' : 'いらっしゃい！ ご注文は？', ['注文する', '仲間と宴会をひらく', 'マスターの話を聞く', 'やめておく'], { ...o, cancel: 3 });
    if (k === 0) await order(g, n);
    else if (k === 1) await enkai(g, { where: name, host: n, per: 2200, title: '芸人仲間の宴会', toast: '「かんぱーい！」…グラスの音が、店じゅうにひびいた。' });
    else if (k === 2) { if (!(await tipTalk(g, n, id + '_m', K.masterOpen))) await g.say(K.masterAgain, o); }
  };
  eatery({
    id, name, hours, w: 13, h: 9, floor: 'floor_wood_dark', wall: 'wood', exits: [6, 7], legend: LEG, intro, master,
    build(r) {
      r.set(2, 1, 'S').set(3, 1, 'S').set(5, 1, 'T').set(6, 1, 'T').set(9, 1, 'p').set(10, 1, 'c').set(11, 1, 'w');
      r.set(1, 2, 'k').set(2, 2, 'F').set(4, 2, 'G').set(5, 2, 'O').set(6, 2, 'F');
      r.rect(1, 4, 6, 1, 'C').rect(1, 5, 6, 1, 's');
      r.rect(8, 2, 4, 5, 'o').set(9, 3, 'z').set(8, 3, 'q').set(10, 3, 'q').set(9, 5, 'z').set(8, 5, 'q').set(10, 5, 'q');
      r.set(11, 7, 'P').set(1, 7, 'B').set(2, 7, 'B');
    },
    entities: [
      npc(id + '_master', 3, 3, 'down', master.look, master.name, menu, { fixedDir: true }),
      npc(id + '_waiter', 9, 7, 'up', LOOK.waiter, 'お運びの店員さん', async (g, n) => { await say(g, n, W.waiter); await order(g, n); }, { wander: 1 }),
      npc(id + '_sarary', 4, 5, 'up', LOOK.sarary, '仕事帰りの会社員', W.sarary),
      npc(id + '_senpai', 2, 5, 'up', { ...LOOKS.comedian2, top: '#5a6f8a' }, '芸人の先輩', async (g, n) => {
        const o = who(n);
        if (!(await tipTalk(g, n, id + '_s', W.senpaiOpen))) await g.say(W.senpaiAgain, o);
      }),
      npc(id + '_duo', 9, 4, 'down', { ...LOOKS.comedian, top: '#ff8a3d' }, 'ネタを練る二人組', W.duo, { fixedDir: true }),
    ],
    events: [
      { x: 1, y: 3, w: 6, on: 'action', run: (g) => order(g) },
      { x: 4, y: 2, on: 'action', run: (g) => g.say('炭火の網の上で、串がじゅうじゅう焼けている。\nいい香りがする。') },
      { x: 5, y: 2, on: 'action', run: (g) => g.say('おでんの鍋が、ことこと煮えている。\n大根と卵が、いい色だ。') },
      { x: 9, y: 3, on: 'action', run: (g) => g.say('座敷の低いテーブルだ。\n宴会は、ここで開く。（マスターに声をかけよう）') },
    ],
  });
}
izakaya('shop_izakaya', '居酒屋 とりあえず', { spans: [[T(16), T(26)]], note: '' }, {
  master: '居酒屋のマスター', masterOpen: ['お客さん、最近どうだい。', '舞台の帰りに寄ってくれる子もいてね。\n…うちは、お笑いの卵の止まり木さ。'], masterAgain: 'さっきも話したとおりさ。\nまあ、一杯やっていきな。',
}, ['いらっしゃい！ ようこそ「とりあえず」へ。', 'まずは座って、なにか頼んでおくれ。\n（お酒は二十歳から。お通しがつくよ）'], {
  waiter: 'いらっしゃいませ！ ご注文は、お決まりですか？',
  sarary: ['今日はもう、一杯だけ…のつもり。\nそう言って、三杯目なんだけどね。', 'ここのマスターは、聞き上手なんだ。\n愚痴を言うと、すっきりするよ。'],
  senpaiOpen: '飲めや飲めや。…おれも若いころは、ここで先輩におごってもらった。',
  senpaiAgain: '話すことは、もうないよ。\nあとは、舞台で見せてくれ。',
  duo: ['…でな、ここでオチが弱いんだよ。', 'お通しの小鉢を、ネタに使えないかな。\n…あ、すみません。仕事の話です。'],
});
izakaya('shop_horoyoi', '居酒屋 ほろ酔い亭', { spans: [[T(16), T(26)]], note: '' }, {
  kansai: true, master: 'ほろ酔い亭のおっちゃん', masterOpen: ['おっ、いらっしゃい。にいちゃん、芸人か？', 'この辺は、劇場帰りの芸人でいっぱいや。\n…ええ話も、えげつない話も、ここに集まるで。'], masterAgain: 'さっき話した通りや。\nまあ、一杯いっとき。',
}, ['いらっしゃい！ ほろ酔い亭へようこそ。', 'どて焼きが、うちの看板や。\n（お酒は二十歳から。お通しがつくで）'], {
  waiter: 'いらっしゃい！ なんにしましょ？',
  sarary: ['劇場の帰りやねん。今日は大阪の若手が、えらい熱かった。', '昔は、ここに居酒屋の前で漫才やる子がおってな。\nそれが、いまやテレビやで。'],
  senpaiOpen: ['おう、若いの。飲んどるか。', 'ええか、ボケは勇気や。\nスベっても、次の日また舞台に立つんが芸人や。'],
  senpaiAgain: 'ほな、舞台で会おか。',
  duo: ['…そこは「なんでやねん」やなくて、間を置いてやな…', 'どて焼きの串を、フリップに使うんはどうや？\n…アカン、それ、ただのどて焼きや。'],
});

// ====================================================================== 焼き鳥 ドット
const YAKI_MASTER = { name: '焼き鳥屋の大将', look: { ...LOOK.master, top: '#d62f2f', apron: '#20232a' } };
const yakiMenu = (g) => [
  { name: 'ねぎま（2本）', price: 380, heal: 12, fill: 18, stress: 3, desc: 'もも肉とねぎ。塩かたれで。', text: 'ジューシーなもも肉に、甘いねぎ。\nたれの焦げた香りがたまらない。' },
  { name: 'つくね（2本）', price: 420, heal: 12, fill: 20, stress: 4, desc: 'ふわふわの、軟骨入りつくね。', text: 'ふわっ、こりっ。…つくねは、いい。' },
  { name: 'レバー（2本）', price: 380, heal: 12, fill: 14, stress: 3, desc: 'とろっと焼いた、新鮮なレバー。', text: 'とろけるような、レバー。\n塩でいただくのが、いちばんだ。' },
  { name: 'おまかせ5本', price: 880, heal: 26, fill: 36, stress: 6, desc: '大将が焼きたてを選ぶ、おまかせ5本。', text: '大将の、おまかせ。\nどれも焼き加減が、ばっちりだ。' },
  { name: 'ビール（中）', price: 550, stress: 11, alc: true, desc: '焼き鳥には、やっぱりこれ。', text: 'ぐびっ…。焼き鳥のあとの一杯は、たまらない。' },
  { name: 'ウーロン茶', price: 300, stress: 4, desc: '脂を流してくれる、さっぱりとした一杯。', text: 'さっぱり。次の串が、また進む。' },
  { name: 'お茶漬け（〆）', price: 450, heal: 14, fill: 26, stress: 3, desc: '〆の、あったかいお茶漬け。', text: 'さらさらっと。…ごちそうさま。' },
];
async function yakiTalk(g, n) {
  const o = who(n);
  const k = await g.ask('へい、らっしゃい！ 焼きたてあるよ！', ['注文する', '大将の話を聞く', 'やめておく'], { ...o, cancel: 2 });
  if (k === 0) await orderMenu(g, { title: '焼き鳥 ドット', entries: yakiMenu(g), host: n, thanks: pick(THANKS), where: '焼き鳥屋', cover: { id: 'shop_yakitori', name: 'お通し', price: 300 } });
  else if (k === 1) {
    if (!(await tipTalk(g, n, 'yaki', ['炭はな、備長炭。火加減が、命よ。', '焼き場に立って二十年…\n手のやけどは、勲章さ。']))) await g.say('もう話したろ。\n串が焦げちまうよ。', o);
  }
}
eatery({
  id: 'shop_yakitori', name: '焼き鳥 ドット', hours: { spans: [[T(17), T(25)]], closed: [6], note: '日曜定休' }, w: 11, h: 8, floor: 'floor_wood_dark', wall: 'cream', exits: [5, 6], legend: { ...LEG, T: 'wall_cream+machi_menutags', p: 'wall_cream+poster', c: 'wall_cream+clock', w: 'wall_cream+window' }, intro: ['へい、らっしゃい！ 焼き鳥 ドットへようこそ。', 'カウンターでどうぞ。焼きたてを、順番に出すよ。'], master: YAKI_MASTER,
  build(r) {
    r.set(2, 1, 'T').set(3, 1, 'T').set(5, 1, 'p').set(7, 1, 'c').set(9, 1, 'w');
    r.set(1, 2, 'F').set(2, 2, 'k').set(3, 2, 'G').set(4, 2, 'G').set(6, 2, 'F');
    r.rect(1, 3, 7, 1, 'C').rect(1, 4, 7, 1, 's');
    r.set(9, 3, 't').set(9, 5, 't').set(8, 3, 'h').set(8, 5, 'h').set(9, 6, 'P').set(1, 6, 'V');
  },
  entities: [
    npc('yk_master', 5, 2, 'down', YAKI_MASTER.look, YAKI_MASTER.name, yakiTalk, { fixedDir: true }),
    npc('yk_waka', 1, 3, 'right', { ...LOOKS.clerk, top: '#d62f2f', apron: '#20232a', hair: 'short' }, '見習いの青年', ['炭おこしが、おれの仕事。\n火がつくまで、三十分もかかるんです。', 'いつか、おれも串を打たせてもらうんだ。']),
    npc('yk_sarary', 3, 4, 'up', LOOK.sarary, '仕事帰りのお客さん', ['この店は、タレが絶品なんだ。\n継ぎ足し継ぎ足しで、四十年だって。', 'ビールと焼き鳥があれば、明日もがんばれる。']),
    npc('yk_obasan', 6, 4, 'up', { ...LOOKS.mom, top: '#d8a050' }, '常連のおばさん', async (g, n) => {
      if (!(await tipTalk(g, n, 'yaki_o', ['あんた、見ない顔だね。この町に来て、まだ浅いのかい。']))) await g.say('そんなに根を詰めると、からだにさわるよ。\nちゃんと食べて、ちゃんと寝な。', who(n));
    }),
  ],
  events: [
    { x: 1, y: 2, w: 7, on: 'action', run: (g) => yakiTalk(g, { name: YAKI_MASTER.name, look: YAKI_MASTER.look }) },
    { x: 3, y: 2, w: 2, on: 'action', run: (g) => g.say('炭火の上で、串がじゅうじゅう音をたてている。\n煙が、換気扇に吸いこまれていく。') },
  ],
});

// ====================================================================== 中華そば 一番
const CHUKA_TAISHO = { name: '一番の店主', look: { ...LOOK.master, top: '#e8e0c8', bottom: '#20232a', apron: '#d62f2f', hair: 'bald' } };
const chukaMenu = (g) => [
  { name: '中華そば', price: 700, heal: 28, fill: 55, stress: 4, desc: '鶏ガラと煮干しの、昔ながらのしょうゆ味。', text: 'ズルズルッ…。あっさりなのに、深い。\nスープまで飲み干したくなる味だ。' },
  { name: '中華そば（大盛）', price: 850, heal: 34, fill: 70, stress: 5, desc: 'めんが1.5倍。おなかがすいた日に。', text: 'どっさりのめんを、ズルズルッ！\nおなかが、ぱんぱんだ。' },
  { name: 'チャーシューメン', price: 1000, heal: 38, fill: 68, stress: 6, desc: 'とろとろのチャーシューが5枚。', text: 'チャーシューが、口の中でほどける…！' },
  { name: '餃子（5個）', price: 400, heal: 8, fill: 16, stress: 2, desc: 'パリッと焼いた、肉汁の餃子。', text: 'パリッ、ジュワッ。…ラーメンに、よく合う。' },
  { name: '半チャーハン', price: 450, heal: 14, fill: 28, stress: 2, desc: 'ラーメンのお供に。パラパラの半チャーハン。', text: 'パラパラの、チャーハン。\nラーメンのスープと、相性ばつぐんだ。' },
  { name: 'ビール（瓶）', price: 600, stress: 10, alc: true, desc: '餃子には、これ。', text: 'ぷはーっ。餃子と瓶ビール。…これが、至福。' },
];
eatery({
  id: 'shop_chuka', name: '中華そば 一番', hours: { spans: [[T(17), T(24)]], note: '' }, w: 11, h: 8, bgm: 'machi_shop', floor: 'floor_wood_dark', wall: 'cream', exits: [5], legend: { ...LEG, T: 'wall_cream+machi_menutags', p: 'wall_cream+poster', c: 'wall_cream+clock' }, intro: ['へい、いらっしゃい。…開店は夕方五時からだ。', 'スープが売り切れたら、閉店だよ。'], master: CHUKA_TAISHO,
  build(r) {
    r.set(2, 1, 'T').set(3, 1, 'T').set(4, 1, 'T').set(7, 1, 'p').set(9, 1, 'c');
    r.set(1, 2, 'k').set(2, 2, 'k').set(3, 2, 'H').set(4, 2, 'H').set(8, 2, 'F').set(9, 2, 'W');
    r.rect(1, 3, 6, 1, 'C').rect(1, 4, 6, 1, 's');
    r.set(8, 5, 't').set(9, 5, 't').set(8, 6, 'h').set(9, 6, 'h').set(1, 6, 'P');
  },
  entities: [
    npc('ch_master', 5, 2, 'down', CHUKA_TAISHO.look, CHUKA_TAISHO.name, async (g, n) => {
      const o = who(n);
      const k = await g.ask('いらっしゃい。…何にする？', ['注文する', '店主の話を聞く', 'やめておく'], { ...o, cancel: 2 });
      if (k === 0) await orderMenu(g, { title: '中華そば 一番', entries: chukaMenu(g), host: n, thanks: pick(['あいよ。', 'ありがとう。', '気をつけて帰んな。']), where: '中華そば屋' });
      else if (k === 1) {
        await g.say(byEra(g, {
          showa: ['この店、開けたのは昭和のはじめでな。\n一杯、百五十円のころからやってる。', 'スープの味は、親父から教わった。\n…変えたことは、一度もない。'],
          heisei_early: ['バブルのころは、出前が鳴りっぱなしだった。\nいまは、静かなもんさ。', '流行りの店ができても、うちはうち。\nこの味を、待ってる人がいる。'],
          heisei: ['ラーメンも、はやりすたりが激しい。\nでもな、しょうゆ味は、廃れない。', 'ネットの評判？ 見ねえよ。\n鍋の前に立つのが、仕事だ。'],
          reiwa: ['原材料が高くなってな、値上げしたよ。\n…それでも、味は落とさねえ。', '若いのが、スマホで写真撮って帰る。\n…まあ、悪い気はしねえ。'],
        }), o);
      }
    }, { fixedDir: true }),
    npc('ch_kyaku', 2, 4, 'up', { ...LOOKS.manager, top: '#7a6a5a' }, '常連の紳士', ['ここの中華そばを食べないと、一日がおわらない。', '昔ながらの味って、いまは貴重なんだよ。']),
    npc('ch_gakusei', 4, 4, 'up', { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#2f6fd0', bottom: '#3b3f48' }, '学生さん', async (g, n) => { if (!(await tipTalk(g, n, 'chuka', ['試験の前は、ここで大盛りって決めてるんです。']))) await g.say('おなかいっぱいで、ねむくなってきた…。', who(n)); }),
  ],
  events: [{ x: 1, y: 3, w: 6, on: 'action', run: (g) => g.say('厨房を見ると、ぴかぴかに磨かれた寸胴鍋が並んでいる。\n店主の背中が、頼もしい。') }, { x: 3, y: 2, w: 2, on: 'action', run: (g) => g.say('大きな寸胴鍋で、スープがことこと煮えている。\nいい香りがする…。') }],
});

// ====================================================================== 立ち飲み ドット
const TACHI_MASTER = { name: '立ち飲みのおやじさん', look: { ...LOOK.master, top: '#ffd23f', apron: '#20232a', hair: 'short', hairColor: 'silver' } };
const tachiMenu = (g) => [
  { name: 'ビール（小）', price: 350, stress: 8, alc: true, desc: '手早く一杯。ちょい飲み用の小さなジョッキ。', text: 'くいっ。…疲れた体に、しみる。', time: 12 },
  { name: byEra(g, { showa: 'ホッピー（セット）', any: 'ハイボール' }), price: 400, stress: 8, alc: true, desc: '立ち飲みの定番。', text: 'しゅわっ。…仕事のあとは、これ。', time: 12 },
  { name: 'おでん盛り', price: 450, heal: 14, fill: 22, stress: 4, desc: '大根・卵・こんにゃく・ちくわ。', text: 'あったか…。だしがしみて、ほっとする。', time: 12 },
  { name: 'もつ煮込み', price: 380, heal: 12, fill: 20, stress: 4, desc: 'みそ味でとろとろ。', text: 'とろっとろ…。七味をふると、また旨い。', time: 12 },
  { name: 'ポテトサラダ', price: 280, heal: 6, fill: 12, stress: 2, desc: 'やさしい味の、手作りポテサラ。', text: 'ほくほく。…お母さんの味みたいだ。', time: 10 },
  { name: 'ウーロン茶', price: 200, stress: 3, desc: '安くて、さっぱり。', text: 'ごくごく。やっぱり、お茶は落ちつく。', time: 8 },
];
eatery({
  id: 'shop_tachinomi', name: '立ち飲み ドット', hours: { spans: [[T(15), T(24)]], note: '' }, w: 11, h: 7, floor: 'floor_concrete', wall: 'dark', exits: [5], legend: { ...LEG, T: 'wall_dark+machi_menutags', p: 'wall_dark+poster', c: 'wall_dark+clock', S: 'wall_dark+shop_sakeshelf', w: 'wall_dark+window' }, intro: ['いらっしゃい。ここは立ち飲み。座る席は、ないよ。', '一杯だけのつもりが、みんな長居するんだ。'], master: TACHI_MASTER,
  build(r) {
    r.set(2, 1, 'S').set(3, 1, 'S').set(5, 1, 'T').set(6, 1, 'T').set(8, 1, 'c');
    r.set(1, 2, 'k').set(2, 2, 'F').set(4, 2, 'O').set(8, 2, 'F');
    r.rect(1, 3, 8, 1, 'C');
    r.set(1, 5, 'P').set(9, 5, 'P');
  },
  entities: [
    npc('tn_master', 4, 2, 'down', TACHI_MASTER.look, TACHI_MASTER.name, async (g, n) => {
      const o = who(n);
      const k = await g.ask('はいよ、なににします？', ['注文する', 'おやじさんの話', 'やめておく'], { ...o, cancel: 2 });
      if (k === 0) await orderMenu(g, { title: '立ち飲み ドット', entries: tachiMenu(g), host: n, thanks: pick(['あいよ。', 'どうぞ。', 'また寄ってね。']), where: '立ち飲み屋' });
      else if (k === 1) { if (!(await tipTalk(g, n, 'tachi', ['立ち飲みはな、安くて早い。\n一杯でも、二杯でも、いつでも出入り自由さ。']))) await g.say('ほれ、お客さんが待ってるよ。', o); }
    }, { fixedDir: true }),
    npc('tn_senpai', 3, 4, 'up', { ...LOOKS.comedian2, top: '#8a5ac8' }, '芸人の先輩', async (g, n) => {
      const o = who(n);
      if (dayN(g, 'ogori') < 1 && g.state.fame < 500) {
        bumpN(g, 'ogori');
        await g.say(['おっ、後輩か。腹へってんだろ。', 'ほれ、おでん盛り。おれのおごりだ。\n…そのかわり、舞台で結果を出せよ。'], o);
        const before = { st: g.state.stamina, hu: g.state.life.hunger };
        if (g.canEat()) g.eat(14, { silent: true, fill: 22 });
        g.relax({ stress: 6 });
        passTime(g, 20, '立ち飲み');
        const t = addSeed(g, '先輩の話');
        await g.say(['（おごってもらった。体力 +' + (g.state.stamina - before.st) + '　ストレス -6）', t ? `（先輩の昔話から、ネタの種を拾った：「${t}」）` : '（先輩の話は、ためになった）']);
        return;
      }
      if (!(await tipTalk(g, n, 'tachi_s', ['若いころは、この店で、先輩におごってもらってな。']))) await g.say('こんどは、おまえがおごる番だ。\n出世したらな。', o);
    }),
    npc('tn_kaisha', 5, 4, 'up', LOOK.sarary, '仕事帰りの会社員', ['一杯だけ…。ほんとに、一杯だけ。\n（もう三杯目だ）', '帰りの電車で寝てしまうんだよね。']),
    npc('tn_oji', 7, 4, 'up', { ...LOOKS.oldman, top: '#6a7a8a', blush: true }, '常連のおじいさん', ['若いの、立ち飲みはな、人間観察の場でもあるんだ。', 'ほら、あそこの二人。\n…夫婦漫才みたいだろ？']),
  ],
  events: [{ x: 1, y: 3, w: 8, on: 'action', run: async (g) => { await g.say('高いカウンターだ。立ったまま、肘をついて飲む。'); } }],
});

// ====================================================================== ラーメン屋 (東京 劇場通り) / ラーメン屋 (なんば)
const lowFame = (g) => g.state.fame < 250;
function ramenMenu(g, { big = false, kae = false } = {}) {
  const e = [
    { name: 'しょうゆラーメン', price: 800, heal: 30, fill: 60, stress: 4, bowl: true, desc: '鶏ガラしょうゆの、すっきりスープ。', text: 'ズルズルッ…！ 鶏ガラしょうゆの、やさしい味わい。' },
    { name: 'みそラーメン', price: 900, heal: 34, fill: 64, stress: 5, bowl: true, desc: 'コクのある、こってりみそ味。', text: 'こってりスープが、体にしみわたる。' },
    { name: 'チャーシューメン', price: 1100, heal: 40, fill: 70, stress: 6, bowl: true, desc: 'とろとろチャーシューが5枚。', text: 'チャーシューが、口の中でほどける…！' },
    { name: '餃子（6個）', price: 350, heal: 10, fill: 20, stress: 2, desc: 'パリッと焼けた餃子。', text: 'パリッ、ジュワッ！ 肉汁がたまらない。' },
    { name: 'ライス（小）', price: 150, heal: 6, fill: 18, desc: 'スープをかけて、〆に。', text: 'スープにごはんを、ざぶんと入れた。…至福。' },
  ];
  return e.map((x) => (x.bowl && big ? { ...x, name: x.name + '（大盛・無料）', fill: x.fill + 16, heal: x.heal + 6, desc: '「芸人さん大盛り無料」の貼り紙のおかげ。' } : x));
}
function ramenShop(id, name, spec) {
  const master = { name: spec.master, look: { ...LOOK.master, top: '#20232a', apron: '#ffffff' } };
  const talk = async (g, n) => {
    const o = who(n);
    const kansai = !!spec.kansai;
    const S = SS(g);
    // an old ツケ is settled first (a friendly reminder, never a penalty)
    if (S.tsuke > 0) {
      if (g.state.money >= S.tsuke) {
        const k0 = await g.ask(kansai ? `おっ、この前のツケ（${fmtMoney(S.tsuke)}）、払ってくれるんか？` : `この前のツケ（${fmtMoney(S.tsuke)}）、払ってくれるのかい？`, ['払う', 'あとで'], { ...o, cancel: 1 });
        if (k0 === 0) { g.spend(S.tsuke); g.sfx('coin'); S.tsuke = 0; await g.say(kansai ? 'まいど！ 気にせんでよかったのに。\n義理がたいやつは、売れるで。' : 'たしかに。義理がたいね。\nそういうやつは、売れるよ。', o); }
      } else await g.say(kansai ? 'ツケは、払えるときでええで。\n…ちゃんと食べて、ちゃんと売れてから、な。' : 'ツケは、払えるときでいいよ。\nちゃんと食べて、売れてからでいい。', o);
    }
    const rows = ['注文する', ...(spec.extra ? [spec.extra.label] : []), '大将の話を聞く', 'やめておく'];
    const k = await g.ask(kansai ? 'へい、らっしゃい！ なんにする？' : 'へい、らっしゃい！ ご注文は？', rows, { ...o, cancel: rows.length - 1 });
    const pickN = rows[k];
    if (pickN === '注文する') {
      const big = spec.bigFree && spec.bigFree(g);
      const broke = g.state.money < 800 && lowFame(g) && S.tsuke === 0 && spec.tsuke;
      if (broke) {
        const kk = await g.ask(kansai ? '金ないんか？ …しゃあない、ツケで食うていき。\n（ツケ ¥800。次に来たとき、払ってな）' : 'お金、ないのかい？ …しかたない、ツケでいいよ。\n（ツケ ¥800。次に来たとき、払ってね）', ['ツケで食べる', 'やめておく'], { ...o, cancel: 1 });
        if (kk === 0 && g.canEat()) {
          S.tsuke = 800;
          g.eat(30, { silent: true, fill: 60 });
          g.relax({ stress: 3 });
          passTime(g, 30, spec.name);
          await g.say(['ズルズルッ…。ツケでも、ラーメンはうまい。', kansai ? '（ツケ ¥800。売れたら、ちゃんと払わなあかんで）' : '（ツケ ¥800。売れたら、ちゃんと払おう）']);
        } else if (kk === 0) await g.say('おなかいっぱいで、もう入らない…。');
        return;
      }
      await orderMenu(g, { title: name, entries: ramenMenu(g, { big }), host: n, thanks: pick(['へい、まいど！', 'スープまで飲んでくれて、ありがとよ！', 'また来いよ！']), where: 'ラーメン屋' });
    } else if (spec.extra && pickN === spec.extra.label) await spec.extra.run(g, n, o);
    else if (pickN === '大将の話を聞く') { if (!(await tipTalk(g, n, id, spec.talk))) await g.say(kansai ? 'さっき話したやろ。麺がのびるで。' : 'さっき話しただろう。麺がのびるよ。', o); }
  };
  eatery({
    id, name, hours: spec.hours, w: 11, h: 8, bgm: 'machi_shop', floor: 'floor_wood_dark', wall: 'cream', exits: [5], legend: { ...LEG, T: 'wall_cream+machi_menutags', p: 'wall_cream+poster', c: 'wall_cream+clock' }, intro: spec.intro, master,
    build(r) {
      r.set(2, 1, 'T').set(3, 1, 'T').set(4, 1, 'T').set(5, 1, 'T').set(8, 1, 'p').set(9, 1, 'c');
      r.set(1, 2, 'k').set(2, 2, 'k').set(3, 2, 'H').set(4, 2, 'H').set(8, 2, 'W').set(9, 2, 'F');
      r.rect(1, 3, 7, 1, 'C').rect(1, 4, 7, 1, 's');
      r.set(2, 6, 't').set(3, 6, 't').set(7, 6, 't').set(8, 6, 't');
    },
    entities: [
      npc(id + '_master', 5, 2, 'down', master.look, master.name, talk, { fixedDir: true }),
      ...spec.cast,
    ],
    events: [{ x: 1, y: 3, w: 7, on: 'action', run: (g) => talk(g, { name: master.name, look: master.look }) }, { x: 3, y: 2, w: 2, on: 'action', run: (g) => g.say('大きな寸胴鍋で、スープがグツグツ煮えている。\nいい香り…おなかが鳴った。') }],
  });
}
ramenShop('shop_ramen_t', 'ラーメン屋（芸人通り）', {
  master: 'ラーメン屋の大将', hours: { spans: [[T(11), T(26)]], note: '' }, bigFree: (g) => lowFame(g), tsuke: true,
  intro: ['へい、らっしゃい！ ここは「芸人さん大盛り無料」の店だ。', '売れてないうちは、うちで食っていきな。\n（★250になるまで。ツケも、ちょっと効くよ）'],
  talk: ['この通りで、二十年だ。売れてった芸人も、見送ったよ。', '「おやじ、売れたらツケ払うよ」って言ったやつ。\nちゃんと、払いに来たんだ。…そういうやつは、本物だ。'],
  cast: [
    npc('rt_waka', 2, 5, 'up', { ...LOOKS.comedian, top: '#2f6fd0' }, '腹ぺこの若手芸人', ['今日は二本、ネタ見せがあって…。\nもう、おなかがぺこぺこ。', '大盛り無料のおかげで、生きのびてます。']),
    npc('rt_kyaku', 4, 5, 'up', { ...LOOKS.fan, top: '#ff9a3c' }, '劇場帰りのお客さん', ['さっきの小劇場のライブ、おもしろかったなあ。', 'あの二人、いつか売れるよ。\n…おれの目に、くるいはない。']),
  ],
});
ramenShop('shop_ramen_n', 'ラーメン屋（なんば）', {
  kansai: true, master: 'なんばのラーメン屋の大将', hours: { spans: [[T(11), T(25)]], note: '' },
  bigFree: () => false,
  intro: ['へい、らっしゃい！ ここは「NSC生は替え玉無料」の店や。', 'NSCの生徒は、替え玉一杯サービスやで。'],
  extra: {
    label: '替え玉（NSC生は無料）',
    async run(g, n, o) {
      let nsc = null;
      try { nsc = has(g, 'nsc') ? g.nsc() : null; } catch (e) { nsc = null; }
      const student = !!(nsc && nsc.status === 'enrolled');
      if (!g.canEat()) { await g.say('おなかいっぱいで、もう入らない…。', o); return; }
      if (!student) {
        const k = await g.ask('替え玉は、一杯150円や。\nNSCの生徒やったら、タダなんやけどな。', ['替え玉をたのむ', 'やめておく'], { ...o, cancel: 1 });
        if (k !== 0) return;
        if (!g.spend(150)) { await g.say('お金が足りない…。'); return; }
        g.sfx('coin');
      } else await g.say('おっ、NSCの生徒やな。ほな、替え玉一杯サービスや！\n…その代わり、ええ芸人になりや。', o);
      g.eat(10, { silent: true, fill: 24 });
      g.relax({ stress: 3 });
      passTime(g, 15, 'ラーメン');
      await g.say('替え玉を、ズルズルッ。…腹の底から、力がわいてきた。');
    },
  },
  talk: ['NSCの生徒は、みんなここで食うていくんや。\nネタ見せのあと、ここで反省会やな。', 'わしゃ、もう何十年も見てる。\n売れる子は、箸の持ち方からちゃうで。'],
  cast: [
    npc('rn_nsc', 2, 5, 'up', { ...LOOKS.comedian, top: '#e8492a', hairColor: 'black' }, 'NSC生', ['今日のネタ見せ、ほんまにしんどかった…。', '講師に「おまえの笑いは何や」って言われて、\n答えられへんかった。']),
    npc('rn_obachan', 4, 5, 'up', { ...LOOKS.oldwoman, top: '#ff7eb6', hairColor: 'purple' }, '近所のおばちゃん', ['ここの餃子はな、にんにくがきいてて、ええねん。', 'デートには向かへんけどな。']),
  ],
});

// ====================================================================== 洋食 ドット軒
const YOSHOKU = { name: '洋食屋のシェフ', look: { ...LOOKS.chef, hat: '#ffffff' } };
const yoshokuMenu = (g) => {
  const day = g.state.day % 3;
  return [
    { name: 'ふわとろオムライス', price: 980, heal: 40, fill: 62, stress: 9, desc: 'デミグラスソースの、名物オムライス。', text: 'ふわっ、とろっ。ソースのコクが、たまらない。' },
    { name: '日替わりランチ', price: 880, heal: 36, fill: 60, stress: 6, desc: `今日は「${['ハンバーグ', 'エビフライ', 'ポークカツ'][day]}」。サラダとスープつき。`, text: `本日の日替わり「${['ハンバーグ', 'エビフライ', 'ポークカツ'][day]}」。\nボリュームたっぷりで、満足だ。` },
    { name: 'ナポリタン', price: 850, heal: 32, fill: 55, stress: 6, desc: '昔ながらの、ケチャップのナポリタン。', text: 'ケチャップの甘さが、なつかしい。' },
    { name: 'ビーフシチュー', price: 1500, heal: 50, fill: 68, stress: 12, desc: 'じっくり煮こんだ、特製ビーフシチュー。', text: 'とろっとろの牛肉に、深いコク。\n…ごちそうだ。' },
    { name: 'コーヒー', price: 350, stress: 6, desc: '食後のコーヒー。', text: 'あたたかい、食後のコーヒー。' },
  ];
};
async function yoshokuQueue(g) {
  const t = (() => { try { return g.clock(); } catch (e) { return null; } })();
  if (!t) return true;
  const lunch = t.hour >= 11 && t.hour < 14, dinner = t.hour >= 18 && t.hour < 20;
  if ((lunch || dinner) && dayN(g, 'yoshoku_q') < 1) {
    bumpN(g, 'yoshoku_q');
    const k = await g.ask('お店の前には、行列ができている。\n…並ぶと、二十分ほどかかりそうだ。', ['並ぶ（20分）', 'あきらめる'], { cancel: 1 });
    if (k !== 0) return false;
    passTime(g, 20, '行列');
  }
  return true;
}
eatery({
  id: 'shop_teishoku_n', name: '洋食 ドット軒', hours: { spans: [[T(11), T(15)], [T(17), T(21)]], closed: [], note: '昼と夜の二部制' }, w: 13, h: 9, bgm: 'shop_jazz', floor: 'floor_checker', wall: 'cream', exits: [6, 7], legend: { ...LEG, T: 'wall_cream+machi_menutags', p: 'wall_cream+poster', c: 'wall_cream+clock', w: 'wall_cream+window' }, intro: ['いらっしゃいませ。洋食 ドット軒です。', 'うちのオムライスは、親の代からの味です。\nお好きなお席へ、どうぞ。'], master: YOSHOKU,
  build(r) {
    r.set(2, 1, 'w').set(5, 1, 'T').set(6, 1, 'T').set(8, 1, 'p').set(10, 1, 'c');
    r.set(1, 2, 'k').set(2, 2, 'k').set(3, 2, 'F').rect(1, 4, 4, 1, 'C');
    for (const [x, y] of [[7, 3], [10, 3], [3, 6], [7, 6], [10, 6]]) { r.set(x, y, 't'); r.set(x - 1, y, 'h'); r.set(x + 1, y, 'h'); }
    r.set(11, 2, 'P').set(11, 7, 'P');
  },
  entities: [
    npc('ys_chef', 2, 3, 'down', YOSHOKU.look, YOSHOKU.name, async (g, n) => {
      const o = who(n);
      if (!(await yoshokuQueue(g))) return;
      const k = await g.ask('いらっしゃいませ。ご注文は？', ['注文する', 'シェフの話を聞く', 'やめておく'], { ...o, cancel: 2 });
      if (k === 0) await orderMenu(g, { title: '洋食 ドット軒', entries: yoshokuMenu(g), host: n, thanks: pick(['ありがとうございます。', 'またのお越しを。', 'お気をつけて。']), where: '洋食屋' });
      else if (k === 1 && !(await tipTalk(g, n, 'yoshoku', ['デミグラスソースは、三日かけて煮こむんです。', '舞台をやる人も、よく来てくれますよ。\n本番の前は、がっつり食べるのがいい。']))) await g.say('もう話しましたよ。\n冷めないうちに、どうぞ。', o);
    }, { fixedDir: true }),
    npc('ys_waitress', 5, 5, 'down', { ...LOOKS.receptionist, top: '#ffffff', apron: '#c0392b' }, 'ホールの店員さん', async (g, n) => {
      if (!(await yoshokuQueue(g))) return;
      await say(g, n, 'いらっしゃいませ！ お好きな席へどうぞ。');
      await orderMenu(g, { title: '洋食 ドット軒', entries: yoshokuMenu(g), host: n, thanks: pick(['ごゆっくり。', 'ありがとうございます。']), where: '洋食屋' });
    }, { wander: 2 }),
    npc('ys_obaa', 6, 6, 'right', { ...LOOKS.oldwoman, top: '#c87a8a' }, '常連のおばあさん', ['ここのオムライスはね、卵の半熟加減が絶妙なの。', '主人と、この席でよく食べたわ。']),
    npc('ys_geinin', 9, 6, 'right', { ...LOOKS.comedian2, top: '#c0392b' }, '舞台前の芸人', ['本番前は、ここのオムライス。\n験かつぎなんや。', '食べすぎると、動きが重なるのが、難点やけど…。']),
  ],
  events: [{ x: 1, y: 4, w: 4, on: 'action', run: (g) => g.say('厨房との境のカウンターだ。\nフライパンを振る音と、いい香りが流れてくる。') }],
});

// ====================================================================== 串カツ屋
const KUSHI_MASTER = { name: '串カツ屋の大将', look: { ...LOOK.master, top: '#ffd23f', apron: '#8a5a33', hair: 'short', hairColor: 'black' } };
const kushiMenu = (g) => [
  { name: '串カツ（5本セット）', price: 800, heal: 26, fill: 34, stress: 6, desc: '牛・豚・えび・うずら・れんこん。', text: 'サクッ！ …ソースにつけて、もう一口。\nソースは、一回だけ！' },
  { name: '串カツ（10本セット）', price: 1500, heal: 42, fill: 56, stress: 10, desc: 'がっつり、10本。', text: 'サクサクサク…！ あっという間に、完食。' },
  { name: 'どて焼き', price: 480, heal: 14, fill: 20, stress: 4, desc: '牛すじのみそ煮こみ。', text: 'とろっとろの牛すじ。…これは、うまい。' },
  { name: 'キャベツ（おかわり自由）', price: 200, heal: 4, fill: 10, stress: 1, desc: 'ソースをすくうのは、このキャベツで。', text: 'シャキシャキ。…口の中が、さっぱりする。' },
  { name: '生ビール', price: 550, stress: 11, alc: true, desc: '串カツには、やっぱりビール。', text: 'ぷはーっ。…揚げ物とビールは、最強の組み合わせだ。' },
  { name: 'ウーロン茶', price: 300, stress: 4, desc: '揚げ物の合間に、さっぱりと。', text: 'さっぱり。…また揚げ物が食べたくなる。' },
];
eatery({
  id: 'shop_kushikatsu', name: '串カツ屋', hours: { spans: [[T(16), T(24)]], note: '' }, w: 11, h: 8, bgm: 'osaka', floor: 'floor_wood_dark', wall: 'wood', exits: [5], legend: { ...LEG, T: 'wall_wood+machi_menutags', p: 'wall_wood+poster', c: 'wall_wood+clock', w: 'wall_wood+window' }, intro: ['いらっしゃい！ 串カツ屋へようこそ。', 'ソースは共通の壺や。…二度づけ禁止やで！'], master: KUSHI_MASTER,
  build(r) {
    r.set(2, 1, 'T').set(3, 1, 'T').set(5, 1, 'p').set(7, 1, 'c').set(9, 1, 'w');
    r.set(1, 2, 'F').set(2, 2, 'Y').set(3, 2, 'Y').set(4, 2, 'k').set(8, 2, 'F');
    r.rect(1, 3, 7, 1, 'C').rect(1, 4, 7, 1, 's');
    r.set(9, 4, 't').set(9, 6, 't').set(8, 4, 'h').set(8, 6, 'h').set(1, 6, 'P').set(9, 3, 'P');
  },
  entities: [
    npc('kk_master', 5, 2, 'down', KUSHI_MASTER.look, KUSHI_MASTER.name, async (g, n) => {
      const o = who(n);
      const k = await g.ask('いらっしゃい！ なんにする？', ['注文する', '大将の話を聞く', 'やめておく'], { ...o, cancel: 2 });
      if (k === 0) await orderMenu(g, { title: '串カツ屋', entries: kushiMenu(g), host: n, thanks: pick(['まいど！', 'ありがとさん！', 'また来てや！']), where: '串カツ屋', cover: { id: 'shop_kushikatsu', name: 'お通し（キャベツと小鉢）', price: 250 } });
      else if (k === 1 && !(await tipTalk(g, n, 'kushi', ['串カツは、衣の細かさが命や。\nパン粉は、うちの秘伝やで。', 'ソースはな、全部のお客さんの共用や。\nせやから、二度づけは、あかん。']))) await g.say('さっき話したやろ。\n串が揚がるで、はよ食べ。', o);
    }, { fixedDir: true }),
    npc('kk_kyaku', 2, 4, 'up', { ...LOOKS.salaryman, top: '#7a8a9a' }, '串カツ好きの会社員', ['串カツ食べながら飲むビールが、週に一度の楽しみや。', '二度づけしてるやつ見たら、思わず声が出てまうわ。']),
    npc('kk_tourist', 4, 4, 'up', { ...LOOKS.tourist, top: '#8fd0ff' }, '観光客', ['串カツって、ソースにどぼんと入れるんじゃないの？', '…えっ、二度づけ禁止？\n早く言ってよ！ 食べちゃった…。']),
  ],
  events: [
    { x: 1, y: 3, w: 5, on: 'action', run: (g) => orderMenu(g, { title: '串カツ屋', entries: kushiMenu(g), host: { name: KUSHI_MASTER.name, look: KUSHI_MASTER.look }, where: '串カツ屋', cover: { id: 'shop_kushikatsu', name: 'お通し（キャベツと小鉢）', price: 250 } }) },
    { x: 2, y: 2, w: 2, on: 'action', run: (g) => g.say('油が、ぱちぱちと音をたてている。\nきつね色の串カツが、次々と揚がっていく。') },
    { x: 6, y: 3, w: 2, on: 'action', run: async (g) => {
      await g.say(['カウンターの上に、ソースの壺がある。\n「ソースの二度づけ禁止」の札が、でかでかと貼ってある。']);
      const k = await g.ask('…二度づけ、してみる？', ['ぜったいしない', 'ためしに…ちょっとだけ'], { cancel: 0 });
      if (k !== 1) return;
      g.emote && g.emote('player', '!');
      await g.say(['ぴちゃ。…一度かじった串を、もう一度、壺に。', '「にいちゃん！ 二度づけ禁止やで！！」\n店じゅうが、いっせいにふり向いた。']);
      g.addNeed('stress', 4);
      const t = addSeed(g, '串カツ屋での大失敗', '串カツ屋の「二度づけ禁止」');
      g.sfx('laugh');
      await g.say(['常連たちが、どっと笑った。\n「ええ度胸や！ ネタになるで！」', t ? '（ネタの種：「串カツ屋の『二度づけ禁止』」）' : '（もう、ネタにしてしまった…）', '（ストレス +4）']);
    } },
  ],
});
