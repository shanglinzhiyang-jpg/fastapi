// 松竹芸能（なんば）: an Osaka talent agency with a long history.
// Rooms: lobby (reception + logo), office (manager / audition), keiko (rehearsal
// room with lessons) and theater (a small stage for 若手ライブ).
//
// Progression here:
//   anyone  : 劇場の呼び込み手伝い (theater), lessons (keiko), audition (office),
//             watching the daily 若手ライブ, free tea / mirror practice once a day
//   member  : 劇場の若手ライブ (theater), ラジオ番組のゲスト (office, any agency)
//   ★250    : 関西ローカル番組   ★1000 : 全国ネットのバラエティ
//   ★2000 + 松竹芸能 : 冠ラジオ番組スタート！ (celebration with a kusudama)

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet } from '../engine/sprites.js';
import { defineTile, R, P, speckle } from '../engine/tiles.js';
import { registerItem } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { text, measure } from '../engine/draw.js';
import { DIRS, OPP, W, H, shade, pick, shuffle } from '../engine/util.js';

// ------------------------------------------------------------------ palette
const RED = '#d8101c';
const RED_D = '#8e0c16';
const RED_L = '#f0505a';
const WOOD = '#9b6638';
const WOOD_D = '#5a3a20';
const WOOD_L = '#c08a52';
const GOLD = '#e8c43a';
const PLASTER = '#f4eee2';
const CARPET = '#b51f2b';

// ------------------------------------------------------------------ tiles
defineTile('shochiku_walltop', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#3a2416');
    R(c, 0, 0, 16, 1, '#4c3020');
    R(c, 0, 15, 16, 1, '#7a4a2a');
  },
});
// upper half of the tall lobby wall: plaster with a wooden crown molding
defineTile('shochiku_wall_up', {
  solid: true,
  draw(c, r) {
    R(c, 0, 0, 16, 16, PLASTER);
    speckle(c, r, ['#ebe3d2'], 8);
    R(c, 0, 0, 16, 2, WOOD_D);
    R(c, 0, 2, 16, 1, WOOD_L);
    R(c, 0, 3, 16, 1, '#fffaf0');
  },
});
// wall face: plaster on top, red pinstripe, wooden wainscot
defineTile('shochiku_wall', {
  solid: true,
  draw(c, r) {
    R(c, 0, 0, 16, 16, PLASTER);
    R(c, 0, 0, 16, 1, '#fffaf0');
    speckle(c, r, ['#ebe3d2'], 4, 0, 1, 16, 4);
    R(c, 0, 5, 16, 1, RED);
    R(c, 0, 6, 16, 7, WOOD);
    R(c, 0, 6, 16, 1, WOOD_L);
    R(c, 0, 6, 1, 7, WOOD_D);
    R(c, 8, 6, 1, 7, WOOD_D);
    R(c, 2, 8, 5, 3, shade(WOOD, -0.1));
    R(c, 10, 8, 5, 3, shade(WOOD, -0.1));
    R(c, 0, 13, 16, 3, '#3a2416');
    R(c, 0, 13, 16, 1, '#24160c');
  },
});
// office double door (wood)
function doorLeaf(c, right) {
  R(c, 0, 0, 16, 16, '#3a2416');
  R(c, 0, 0, 16, 2, WOOD_D);
  R(c, right ? 14 : 0, 0, 2, 16, WOOD_D);
  const x0 = right ? 0 : 2;
  R(c, x0, 2, 14, 14, '#7a4a26');
  R(c, x0, 2, 14, 1, '#a06a3a');
  R(c, x0 + 2, 9, 10, 6, '#8a5a30');
  R(c, x0 + 2, 9, 10, 1, '#6a3e1e');
  R(c, right ? 0 : 15, 2, 1, 14, '#24160c');
  R(c, right ? 2 : 13, 9, 1, 3, GOLD);
}
defineTile('shochiku_door_l', { draw(c) { doorLeaf(c, false); } });
defineTile('shochiku_door_r', { draw(c) { doorLeaf(c, true); } });
// rehearsal room: sliding shoji door
function shoji(c, right) {
  R(c, 0, 0, 16, 16, WOOD_D);
  const x0 = right ? 0 : 2;
  R(c, x0, 2, 14, 14, '#f6f0e0');
  for (let x = x0 + 3; x < x0 + 14; x += 4) R(c, x, 2, 1, 10, '#a0703f');
  for (let y = 5; y < 12; y += 3) R(c, x0, y, 14, 1, '#a0703f');
  R(c, x0, 12, 14, 4, '#8a5a30');
  R(c, x0, 12, 14, 1, WOOD_L);
  R(c, right ? 0 : 15, 2, 1, 14, '#3a2416');
}
defineTile('shochiku_shoji_l', { draw(c) { shoji(c, false); } });
defineTile('shochiku_shoji_r', { draw(c) { shoji(c, true); } });
// theater entrance: red noren curtain (two halves)
function noren(c, right) {
  R(c, 0, 0, 16, 16, '#24160c');
  R(c, 0, 12, 16, 4, '#4a3020');
  R(c, 0, 0, 16, 2, '#6e4428');
  R(c, 0, 2, 16, 1, '#3a2416');
  R(c, right ? 14 : 0, 0, 2, 16, WOOD_D);
  const x0 = right ? 0 : 2, w = 14;
  R(c, x0, 3, w, 9, RED);
  R(c, x0, 3, w, 1, RED_L);
  R(c, x0, 11, w, 1, RED_D);
  R(c, right ? 6 : 9, 4, 1, 8, RED_D);
  R(c, right ? 0 : 15, 4, 1, 8, '#24160c');
}
defineTile('shochiku_noren_l', { draw(c) { noren(c, false); } });
defineTile('shochiku_noren_r', { draw(c) { noren(c, true); } });
// reception counter: wooden top, red front with gold lines
defineTile('shochiku_counter', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 6, '#c89a6a');
    R(c, 0, 1, 16, 1, '#e6bd8a');
    R(c, 0, 6, 16, 1, '#8a5a30');
    R(c, 0, 7, 16, 8, RED);
    R(c, 0, 7, 16, 1, RED_D);
    R(c, 0, 9, 16, 1, GOLD);
    R(c, 0, 13, 16, 1, GOLD);
    R(c, 0, 15, 16, 1, '#5a0a10');
  },
});
// red carpet with gold edges
function carpetBase(c, r) {
  R(c, 0, 0, 16, 16, CARPET);
  speckle(c, r, [shade(CARPET, -0.12), shade(CARPET, 0.08)], 18);
}
defineTile('shochiku_carpet', { draw(c, r) { carpetBase(c, r); } });
defineTile('shochiku_carpet_l', {
  draw(c, r) {
    carpetBase(c, r);
    R(c, 0, 0, 2, 16, GOLD);
    R(c, 2, 0, 1, 16, '#7a1018');
    for (let y = 1; y < 16; y += 4) P(c, 0, y, '#fff3a0');
  },
});
defineTile('shochiku_carpet_r', {
  draw(c, r) {
    carpetBase(c, r);
    R(c, 14, 0, 2, 16, GOLD);
    R(c, 13, 0, 1, 16, '#7a1018');
    for (let y = 3; y < 16; y += 4) P(c, 15, y, '#fff3a0');
  },
});
// wooden lattice screen (koshi)
defineTile('shochiku_koshi', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 15, 14, 1, 'rgba(0,0,0,0.22)');
    R(c, 1, 0, 2, 15, WOOD_D);
    R(c, 13, 0, 2, 15, WOOD_D);
    R(c, 1, 0, 14, 2, WOOD_D);
    R(c, 1, 12, 14, 3, WOOD_D);
    for (let x = 4; x < 13; x += 3) R(c, x, 2, 1, 10, '#8a5a30');
    R(c, 1, 0, 14, 1, WOOD_L);
  },
});
// desk you can talk across (manager, audition, 部長)
defineTile('shochiku_desk', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 14, 16, 1, 'rgba(0,0,0,0.22)');
    R(c, 0, 2, 16, 8, '#b98552');
    R(c, 0, 2, 16, 1, '#d6a06a');
    R(c, 0, 10, 16, 4, '#7a4a26');
    R(c, 0, 10, 16, 1, WOOD_D);
    if (v === 0) { R(c, 3, 4, 5, 4, '#ffffff'); R(c, 4, 5, 3, 1, '#9aa0aa'); R(c, 4, 7, 2, 1, '#9aa0aa'); R(c, 10, 5, 3, 2, RED); }
    else if (v === 1) { R(c, 4, 3, 7, 5, '#20232a'); R(c, 5, 4, 5, 3, '#5fd7ff'); R(c, 6, 5, 2, 1, '#ffffff'); }
    else { R(c, 3, 5, 4, 3, '#3b3f48'); R(c, 4, 4, 2, 1, '#3b3f48'); R(c, 9, 4, 4, 4, '#ffffff'); R(c, 10, 5, 2, 2, RED); }
  },
});
// sofa seen from behind (backrest towards the camera)
defineTile('shochiku_sofa_up', {
  solid: true, obj: true,
  draw(c) {
    const col = '#c8323f';
    R(c, 0, 14, 16, 1, 'rgba(0,0,0,0.22)');
    R(c, 0, 3, 16, 6, col);
    R(c, 0, 3, 16, 1, shade(col, 0.25));
    R(c, 7, 3, 1, 6, shade(col, -0.2));
    R(c, 0, 8, 16, 6, shade(col, -0.25));
    R(c, 0, 8, 16, 1, shade(col, 0.1));
    R(c, 0, 13, 16, 1, shade(col, -0.45));
  },
});
// free-standing photo panel (history display)
defineTile('shochiku_photo', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    R(c, 2, 15, 12, 1, 'rgba(0,0,0,0.22)');
    R(c, 3, 11, 2, 4, WOOD_D);
    R(c, 11, 11, 2, 4, WOOD_D);
    R(c, 1, 1, 14, 11, WOOD_D);
    R(c, 2, 2, 12, 9, '#f2ead8');
    const cols = v ? ['#9aa0aa', '#c9a227', RED] : ['#6d7280', RED, '#9aa0aa'];
    R(c, 3, 3, 4, 3, cols[0]); R(c, 9, 3, 4, 3, cols[1]);
    R(c, 3, 7, 4, 3, cols[2]); R(c, 9, 7, 4, 3, cols[0]);
    P(c, 5, 4, '#ffe0c4'); P(c, 10, 4, '#ffe0c4'); P(c, 11, 4, '#ffe0c4'); P(c, 4, 8, '#ffe0c4'); P(c, 11, 8, '#ffe0c4');
  },
});
// red "若手ライブ" poster on the wall
defineTile('shochiku_poster', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 1, 10, 12, '#20232a');
    R(c, 4, 2, 8, 10, RED);
    R(c, 4, 3, 8, 3, '#ffffff');
    R(c, 5, 4, 6, 1, RED);
    R(c, 5, 7, 2, 2, '#ffe0c4'); R(c, 9, 7, 2, 2, '#ffe0c4');
    R(c, 5, 9, 2, 2, '#ffd23f'); R(c, 9, 9, 2, 2, '#20232a');
  },
});
// a stack of zabuton cushions
defineTile('shochiku_zabuton', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 15, 14, 1, 'rgba(0,0,0,0.22)');
    const cols = ['#8a1f4a', '#6b2a7a', '#8a1f4a', '#6b2a7a'];
    for (let i = 0; i < 4; i++) {
      const y = 12 - i * 3;
      R(c, 2, y, 12, 3, cols[i]);
      R(c, 2, y, 12, 1, shade(cols[i], 0.3));
      P(c, 8, y + 1, GOLD);
    }
  },
});
// sound / light console
defineTile('shochiku_console', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 14, 16, 1, 'rgba(0,0,0,0.25)');
    R(c, 0, 4, 16, 10, '#2e3038');
    R(c, 0, 4, 16, 1, '#5a5f6b');
    R(c, 0, 12, 16, 2, '#1e1e24');
    for (let x = 2; x < 15; x += 3) { R(c, x, 6, 1, 5, '#15151a'); R(c, x - 1, 7 + (x % 3), 3, 2, '#d5d9e0'); }
    P(c, 2, 5, '#5ee07a'); P(c, 5, 5, '#5ee07a'); P(c, 8, 5, '#ffd23f'); P(c, 11, 5, '#ff5d6c'); P(c, 14, 5, '#5ee07a');
  },
});

// ------------------------------------------------------------------ items & music
registerItem('shochiku_meishi', {
  name: '松竹芸能の名刺', price: 0, desc: '所属タレントのあかし。ながめると、ちょっと誇らしい。',
  use: async (g) => { await g.say('名刺をながめた。\n「松竹芸能　{name}」\n…なんだか誇らしい気持ちになった！'); },
});
registerItem('shochiku_senbei', { name: '劇場せんべい', price: 200, desc: '劇場の売店で人気のおせんべい。体力が20回復する。', heal: 20 });
const LETTERS = [
  '「いつも元気をもらってます！これからもずっと応援してます！」',
  '「劇場で見た漫才、家族みんなで大笑いしました！」',
  '「ラジオ聞いてます。テスト勉強のおともです。がんばってください！」',
  '「なんばで見かけたとき、緊張して声かけられませんでした…。大ファンです！」',
];
registerItem('shochiku_fanletter', {
  name: 'ファンレター', price: 0, desc: 'ファンからの手紙。読むと元気が出る。',
  use: async (g) => { await g.say(['ファンレターを読んだ。', pick(LETTERS), 'よし、がんばろう！']); },
});
registerItem('shochiku_tate', {
  name: '冠番組記念の盾', price: 0, desc: '冠ラジオ番組スタートの記念の盾。ピカピカだ。',
  use: async (g) => { await g.say('記念の盾だ。\n『{name}の いっぺん聞いてみ！』と刻まれている。\nピカピカに光っている！'); },
});

registerSong('shochiku_debayashi', {
  bpm: 168, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.045, notes: 'D5 . E5 . G5 A5 G5 E5 | D5 . E5 G5 A5 . . . | B5 . A5 G5 A5 . G5 E5 | D5 E5 D5 B4 A4 . . . | D5 . E5 . G5 A5 G5 E5 | D5 . E5 G5 A5 . B5 . | D6 . B5 A5 G5 . E5 G5 | A5 - - . D5 . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'D3 . A3 . D3 . A3 . | G2 . D3 . G2 . D3 . | E3 . B3 . E3 . B3 . | A2 . E3 . A2 . E3 . | D3 . A3 . D3 . A3 . | G2 . D3 . G2 . D3 . | B2 . F#3 . B2 . F#3 . | A2 . E3 . D3 . . .' },
    { wave: 'drum', vol: 0.1, notes: 'k . h k s . h . | k k h . s . h h' },
  ],
});

// ------------------------------------------------------------------ characters
const L = {
  uketsuke: { ...LOOKS.receptionist, top: RED, bottom: '#2a2430' },
  annai: { hair: 'long', hairColor: 'black', skin: 'light', top: '#f2f2f2', bottom: RED, skirt: true, jacket: true },
  guard: { ...LOOKS.guard },
  wakate: { ...LOOKS.comedian, hair: 'short', hairColor: 'black', top: RED, bottom: '#3a4a7a' },
  fan: { ...LOOKS.oldwoman, top: '#e8a33a', hairColor: 'purple' },
  chikoku: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#5fd7ff', bottom: '#3b3f48' },
  manager: { ...LOOKS.manager, tie: RED },
  bucho: { ...LOOKS.president, tie: RED },
  shinsa: { hair: 'long', hairColor: 'black', skin: 'light', top: '#3b3f48', bottom: '#3b3f48', skirt: true, jacket: true, glasses: true },
  koho: { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#ffb3c1', bottom: '#5a4a6a', skirt: true },
  ocha: { hair: 'bob', hairColor: 'black', skin: 'fair', top: '#f6f1e7', bottom: '#8a5a33', skirt: true },
  veteran: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#6b2a7a', bottom: '#2a2430', glasses: true },
  ad: { ...LOOKS.ad },
  producer: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#2a3560', jacket: true, glasses: 'sun' },
  shabeT: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#8a1f2a', bottom: '#2a2430', skirt: true, glasses: true },
  manzaiT: { ...LOOKS.comedian2, top: RED, bottom: '#1e1e26' },
  maru: { hair: 'afro', hairColor: 'brown', skin: 'fair', top: '#ffd23f', bottom: RED },
  kaku: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: RED, glasses: true },
  shihainin: { hair: 'slick', hairColor: 'silver', skin: 'tan', top: '#2a2430', bottom: '#2a2430', jacket: true, tie: RED },
  kantoku: { ...LOOKS.staff, hat: RED },
  mogiri: { hair: 'short', hairColor: 'brown', skin: 'fair', top: RED, bottom: '#2a2430' },
  uriko: { ...LOOKS.mom, top: '#f6f1e7', bottom: RED },
  onkyo: { ...LOOKS.cameraman, hat: '#3b3f48' },
};
const UKETSUKE = { name: '受付さん', look: L.uketsuke };
const CHIKOKU = { name: '新人芸人', look: L.chikoku };
const MANAGER = { name: 'マネージャー', look: L.manager };
const BUCHO = { name: '部長', look: L.bucho };
const MARU = { name: 'まる', look: L.maru };
const KAKU = { name: 'かく', look: L.kaku };
const KANTOKU = { name: '舞台監督', look: L.kantoku };

const sayAs = (g, who, t) => g.say(t, { name: who.name, look: who.look });
const askAs = (g, who, t, choices, extra = {}) => g.ask(t, choices, { name: who.name, look: who.look, ...extra });
const today = (g, k) => g.flag(k) === g.state.day;
const markToday = (g, k) => g.setFlag(k, g.state.day);
const isMember = (g) => g.state.agency === 'shochiku';
const jobCount = (g, id) => (g.state.jobs && g.state.jobs[id]) || 0;

// ------------------------------------------------------------------ minigame content
const AUDITION_SCENES = [
  { prompt: '審査員「ほな、自己紹介してもらおか」', answers: [
    { text: '元気だけは負けません！', score: 100 },
    { text: 'あ…えっと…以上です', score: 10 },
    { text: '特技は早寝早起きです', score: 60 },
  ] },
  { prompt: '審査員「大阪の好きなとこ、どこ？」', answers: [
    { text: '人があったかいところ', score: 80 },
    { text: 'みんなツッコんでくれる', score: 100 },
    { text: '特にないです', score: 0 },
  ] },
  { prompt: '審査員「最近あった、おもろい話して」', answers: [
    { text: '…特にないです', score: 0 },
    { text: '靴を左右逆にはいてた', score: 70 },
    { text: '犬にお手されました', score: 100 },
  ] },
  { prompt: '審査員「好きな食べ物は？」', answers: [
    { text: 'お好み焼き定食です', score: 100 },
    { text: 'ふつうに、ごはん', score: 40 },
    { text: '審査員さんの笑顔です', score: 70 },
  ] },
  { prompt: '審査員「最後にひとこと、どうぞ！」', answers: [
    { text: 'おなかすきました', score: 30 },
    { text: 'ここで天下とります！', score: 100 },
    { text: 'よろしくお願いします', score: 70 },
  ] },
];

const YOBIKOMI_SCENES = [
  { prompt: 'おばちゃん「あら、何やってんの？」', answers: [
    { text: '若手ライブ、開演です！', score: 100 },
    { text: '…見たらわかるやろ', score: 0 },
    { text: 'アメちゃんください', score: 50 },
  ] },
  { prompt: '学生さん「おもろいんですか？」', answers: [
    { text: 'たぶん…', score: 20 },
    { text: '笑いすぎ注意です！', score: 100 },
    { text: '自分で確かめて', score: 50 },
  ] },
  { prompt: '観光客「What is this?」', answers: [
    { text: 'Comedy show! Fun!', score: 100 },
    { text: 'ノー、イングリッシュ', score: 20 },
    { text: '笑いは世界共通です！', score: 80 },
  ] },
  { prompt: '会社員「ごめん、時間ないねん」', answers: [
    { text: 'ほな、さいなら', score: 20 },
    { text: '時間は作るもんです', score: 60 },
    { text: '1本だけでもどうぞ！', score: 100 },
  ] },
];

// Manzai material for the tsukkomi minigame, as short bits (フリ + ボケ kept together).
// Each performance picks a few bits at random, so the script changes every time.
const furi = (boke) => ({ boke, punch: false });
const boke = (b, tsukkomi) => ({ boke: b, punch: true, tsukkomi });
const LIVE_BITS = [
  [boke('ぼく、大阪城に住んでるんです', '住まれへんわ！')],
  [furi('最近、料理にハマってまして'), boke('たこ焼き、タコ抜きで作りました', 'ただの焼きや！')],
  [furi('お好み焼きをおかずにご飯食べます'), boke('そのご飯をおかずに、お好み焼きです', '終わらへんがな！')],
  [furi('朝は毎日ジョギングしてます'), boke('家から駅まで、側転で通ってます', '目ぇ回るわ！')],
  [boke('通天閣、ポケットに入れてきました', '入るかい！')],
  [boke('趣味は、ハトに道を教えることです', '飛んで行けるわ！')],
  [furi('今日はお客さんがあったかいなあ'), boke('お客さん全員、ぼくの親戚です', 'そんなわけあるか！')],
];
const LESSON_BITS = [
  [boke('こんにちは。今、夜の8時です', 'こんばんはや！')],
  [furi('ぼく、犬を飼ってまして'), boke('名前は「ネコ」です', 'ややこしいわ！')],
  [furi('昨日、カレーを作りました'), boke('隠し味に、カレーを入れました', 'カレーやないか！')],
  [furi('好きな季節は夏です'), boke('理由は、冬が寒いからです', '夏の理由ちゃうやん！')],
];
function manzaiScript(opener, bits, n) {
  const lines = [furi(opener), ...shuffle(bits).slice(0, n).flat()];
  return { lines, rounds: lines.length };
}

// ------------------------------------------------------------------ jobs & lessons
const JOBS = {
  yobikomi: {
    id: 'shochiku_yobikomi', title: '劇場の呼び込み手伝い', desc: '劇場の前で、お客さんに声をかけよう！', client: '劇場支配人',
    stamina: 15, minigame: 'talk', opts: { difficulty: 1, scenes: YOBIKOMI_SCENES }, pay: 1000, fame: 5, skill: 'talk', gain: 1,
  },
  wakate: {
    id: 'shochiku_wakate_live', title: '劇場の若手ライブ', desc: '若手ライブの舞台で漫才を披露しよう！', client: '舞台監督',
    stamina: 25, minigame: 'tsukkomi', opts: { difficulty: 2 }, pay: 4500, fame: 18, skill: 'warai', gain: 2,
    requires: { agency: 'shochiku' },
  },
  radio: {
    id: 'shochiku_radio_guest', title: 'ラジオ番組のゲスト', desc: '関西のラジオ番組で、楽しくトーク！', client: 'マネージャー',
    stamina: 20, minigame: 'talk', opts: { difficulty: 2, topic: 'radio' }, pay: 4000, fame: 15, skill: 'talk', gain: 2,
    requires: { agency: true },
  },
  local: {
    id: 'shochiku_kansai_local', title: '関西ローカル番組', desc: '大阪のクイズ番組に回答者で出演！', client: 'マネージャー',
    stamina: 25, minigame: 'quiz', opts: { difficulty: 3, category: 'osaka', show: 'クイズ！なんばでドン！' }, pay: 12000, fame: 45, skill: 'talk', gain: 3,
    requires: { fame: 250 },
  },
  zenkoku: {
    id: 'shochiku_zenkoku_variety', title: '全国ネットのバラエティ', desc: '全国放送のひな壇で、しゃべりを見せろ！', client: 'マネージャー',
    stamina: 30, minigame: 'talk', opts: { difficulty: 4 }, pay: 30000, fame: 120, skill: 'talk', gain: 4,
    requires: { fame: 1000 },
  },
  kanmuri: {
    id: 'shochiku_kanmuri_radio', title: '冠ラジオ番組スタート！', desc: '自分の名前がついたラジオ番組！', client: 'マネージャー',
    stamina: 30, minigame: 'talk', opts: { difficulty: 5, topic: 'radio' }, pay: 65000, fame: 250, skill: 'talk', gain: 5,
    requires: { agency: 'shochiku', fame: 2000 },
  },
};
const LESSONS = {
  talk: { title: 'しゃべりレッスン', skill: 'talk', price: 2500, stamina: 12, gain: 4, minigame: 'talk', opts: { difficulty: 1 }, teacher: 'しゃべり講師' },
  manzai: { title: '漫才レッスン', skill: 'warai', price: 2500, stamina: 12, gain: 4, minigame: 'tsukkomi', opts: { difficulty: 1, partner: '漫才講師' }, teacher: '漫才講師' },
};
const AUDITION = {
  agency: 'shochiku', title: '松竹芸能オーディション', minigame: 'talk',
  opts: { difficulty: 2, scenes: AUDITION_SCENES }, pass: 55, stamina: 15,
};

// ------------------------------------------------------------------ cutscene helpers
// Breadth-first path for an NPC on the current map to any tile where goal(x, y) is true.
function findPath(g, ent, goal) {
  const m = g.map;
  const RW = m.room.w, RH = m.room.h;
  const key = (x, y) => y * RW + x;
  if (goal(ent.x, ent.y)) return [];
  const prev = new Map([[key(ent.x, ent.y), null]]);
  const q = [[ent.x, ent.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d of ['up', 'down', 'left', 'right']) {
      const [dx, dy] = DIRS[d];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= RW || ny >= RH || prev.has(key(nx, ny))) continue;
      if (m.blocked(nx, ny, ent)) continue;
      const done = goal(nx, ny);
      if (m.warpAt(nx, ny) && !done) continue;
      prev.set(key(nx, ny), [x, y, d]);
      if (done) {
        const path = [];
        let k = key(nx, ny);
        while (prev.get(k)) { const [px, py, pd] = prev.get(k); path.unshift(pd); k = key(px, py); }
        return path;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function dirTo(fx, fy, tx, ty) {
  const dx = tx - fx, dy = ty - fy;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

async function walkTo(g, id, tx, ty, speed = 2) {
  const e = g.npc(id);
  if (!e || !g.map.visible(e)) return;
  const path = findPath(g, e, (x, y) => x === tx && y === ty);
  if (path && path.length) await g.moveNpc(id, path, speed);
  e.speed = 1;
}

// Walk an NPC next to the player and turn them towards each other.
async function approach(g, id, speed = 2) {
  const e = g.npc(id);
  if (!e || !g.map.visible(e)) return;
  const p = g.map.player;
  let path = findPath(g, e, (x, y) => Math.abs(x - p.x) + Math.abs(y - p.y) === 1);
  if (!path) path = findPath(g, e, (x, y) => Math.abs(x - p.x) <= 2 && Math.abs(y - p.y) <= 2);
  if (path && path.length) await g.moveNpc(id, path, speed);
  e.speed = 1;
  e.dir = dirTo(e.x, e.y, p.x, p.y);
  if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1) g.facePlayer(OPP[e.dir]);
}

function placeEnt(e, x, y, dir) {
  Object.assign(e, { x, y, px: x * 16, py: y * 16, moving: false, t: 0 });
  e.path = [];
  if (dir) e.dir = dir;
}

// A small name plate (drawUnder helpers). cx, y in screen pixels.
function plate(ctx, cx, y, label, opt = {}) {
  const size = opt.size || 10;
  const w = Math.ceil(measure(ctx, label, size)) + 8;
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = opt.edge || '#3a2416';
  ctx.fillRect(x, y, w, size + 4);
  ctx.fillStyle = opt.bg || '#f6f1e7';
  ctx.fillRect(x + 1, y + 1, w - 2, size + 2);
  text(ctx, label, Math.round(cx), y + 2, { size, align: 'center', color: opt.color || '#3a2416', shadow: null });
}

// pixel disc; side -1 = left half only, 1 = right half only
function pdisc(ctx, cx, cy, r, col, side = 0) {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    if (side <= 0) ctx.fillRect(cx - w, cy + y, w, 1);
    if (side >= 0) ctx.fillRect(cx, cy + y, w, 1);
  }
}

// Audience member sitting in a theater seat (seen from behind).
function seated(ctx, x, y, g, e) {
  x = Math.round(x); y = Math.round(y);
  const sheet = charSheet(e.look || {});
  const img = (sheet[e.dir] || sheet.down)[0];
  ctx.drawImage(img, 0, 0, 16, 13, x, y - 3, 16, 13);
  ctx.fillStyle = '#7a1520';
  ctx.fillRect(x + 1, y + 8, 14, 6);
  ctx.fillStyle = '#c8323f';
  ctx.fillRect(x + 2, y + 9, 12, 3);
  ctx.fillStyle = '#e05462';
  ctx.fillRect(x + 2, y + 9, 12, 1);
}

let quiet = false; // suppresses the room banner when a cutscene reloads a room
const roomBanner = (label) => async (g) => { if (!quiet) g.showBanner(label); };

// ================================================================== LOBBY
async function lobbyIntro(g) {
  const p = g.map.player;
  const late = g.npc('chikoku');
  if (!late) return;
  const sx = p.x === 11 ? 10 : 11;
  placeEnt(late, sx, 12, 'up');
  late.hidden = false;
  g.sfx('door');
  await g.wait(200);
  await g.emote('chikoku', '!', 30);
  await sayAs(g, CHIKOKU, 'うわわわ、遅刻や遅刻〜！');
  const run = walkTo(g, 'chikoku', 16, 3, 2.6);
  await g.wait(450);
  await Promise.all([run, g.emote('uketsuke', '💢', 60)]);
  await sayAs(g, UKETSUKE, 'こらー！ロビーは走ったらあかんで〜！');
  late.dir = 'down';
  await g.emote('chikoku', '…', 40);
  await sayAs(g, CHIKOKU, ['す、すんません！', '…あれ？見ない顔やね。見学の人？', 'ほな、またな〜！劇場で待ってるで〜！']);
  await g.moveNpc('chikoku', 'up', 2);
  g.sfx('door');
  late.hidden = true;
  await g.wait(250);
  await sayAs(g, UKETSUKE, ['…もう、あの子は。', 'あっ、いらっしゃいませ！']);
  await g.showLogo('shochiku', '松竹芸能へようこそ！');
  await sayAs(g, UKETSUKE, ['ここは大阪・なんばの芸能事務所、松竹芸能です。', 'わからんことがあったら、なんでも受付で聞いてね〜。']);
}

async function uketsukeTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (isMember(g)) {
    if (g.flag('shochiku_kanmuri_started')) return s(['おはようございます！冠ラジオ、毎週聞いてますよ〜。', '受付のみんなでハガキ送ったんです。読まれへんかなあ…。']);
    if (st.fame >= 2000) return s(['おはようございます、{name}さん！', 'マネージャーが「ごっつい話が来た」言うて、そわそわしてはりましたよ。事務所に行ってみて！']);
    if (st.fame >= 1000) return s(['おはようございます！全国ネットの番組、見ましたよ！', '東京に行っても、大阪のノリは忘れんといてくださいね。']);
    if (st.fame >= 250) return s(['おはようございます！最近、人気出てきましたね〜。', '関西ローカル番組のお話、マネージャーに聞いてみてください！']);
    return s(['おはようございます、{name}さん！', '若手ライブは劇場の舞台監督さん、ラジオのお仕事は事務所のマネージャーに声かけてくださいね。']);
  }
  if (st.agency) {
    return s(['いらっしゃいませ。よその事務所の方ですね？', 'ラジオや番組のお話なら、奥の事務所でマネージャーに聞いてみてください。', 'うちのオーディションも受けられますけど、合格したら移籍のご相談になりますよ〜。']);
  }
  return s([
    '松竹芸能へようこそ〜。',
    'うちに入りたい人は、事務所でオーディションを受けてね。審査はトーク、しゃべりの腕を見るんよ。',
    '自信なかったら、まずは稽古場でレッスンやね。劇場では呼び込みのお手伝いも募集してますよ〜。',
  ]);
}

async function annaiTalk(g, npc) {
  const i = await askAs(g, npc, '館内のご案内です。どちらへ行かれますか？', ['事務所', '稽古場', '劇場', 'だいじょうぶ']);
  if (i === 0) return sayAs(g, npc, ['事務所は左奥、木のドアの部屋です。', 'マネージャーとオーディション担当がいてます。お仕事の相談もそちらでどうぞ。']);
  if (i === 1) return sayAs(g, npc, ['稽古場は事務所のおとなり、障子の戸の奥です。', 'しゃべりと漫才のレッスンが受けられますよ。鏡の前で自主練もできます。']);
  if (i === 2) return sayAs(g, npc, ['劇場は右奥、赤いのれんの奥です。', '毎日、若手ライブをやってます。入り口のもぎりに言うたら見られますよ〜。']);
  return sayAs(g, npc, 'ごゆっくりどうぞ〜。');
}

async function guardTalk(g, npc) {
  if (isMember(g)) {
    return sayAs(g, npc, ['おっ、おはようさん！今日もがんばりや。', '売れても、あいさつだけは忘れたらあかんで。それが一番の芸や。']);
  }
  return sayAs(g, npc, [
    'おつかれさん！ここは松竹芸能やで。',
    'ワシも若い頃は芸人目指しとってな…。ツッコミの間（ま）が悪うて、今はここで入り口を守っとる。',
    '体力が切れたら無理したらあかん。なんばのホテルでしっかり休むんやで。',
  ]);
}

async function wakateTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (st.fame >= 1000) return s(['うわ、{name}や…！もう売れっ子やん。', 'ええなあ〜。ボクも負けへんで！今日もネタ合わせや！']);
  if (isMember(g)) return s(['同期やな！これからよろしゅう！', '若手ライブ、舞台監督に声かけたら出番もらえるで。', 'お客さんの前に立つのが、一番の稽古やからな！']);
  return s([
    'オーディション受けるん？審査はトークやで。',
    '質問に「おっ」と思わせる返しができるかが勝負や。',
    'しゃべりは稽古場のレッスンで鍛えられるで。ボクも毎日通っとる！',
  ]);
}

async function fanTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (st.fame >= 500) {
    await g.emote('fan', '♥');
    return s(['いや〜！{name}ちゃんやんか！テレビで見たで！', 'サインちょうだい！孫に自慢するわ〜！']);
  }
  if (st.fame >= 100 && !g.flag('shochiku_fan_gift')) {
    g.setFlag('shochiku_fan_gift');
    await s(['あら！あんた、最近ちょいちょい見かけるようになったなあ！', 'がんばってる子には差し入れや！']);
    g.giveItem('drink');
    g.sfx('coin');
    return s('しっかり食べて、しっかり笑わせてな！');
  }
  return s([
    'うち、「まるかく」いうコンビの大ファンやねん！',
    'あの子ら、毎日劇場でがんばってんねんで。あんたも芸人さん目指してるん？',
    'ほな応援したるわ！売れたら、ちゃんとサインちょうだいや！',
  ]);
}

const LOBBY = {
  floor: 'floor_marble',
  wall: 'white',
  bgm: 'osaka',
  tiles: [
    '####################',
    '#UUUUUUUUUUUUUUUUUU#',
    '#=EeqKk=======cLNnL#',
    '#P......CF..FC....P#',
    '#.......CCCCCC.b...#',
    '#........[__]......#',
    '#P.......[__]...RRR#',
    '#.SSS..Y.[__].....V#',
    '#mTTT..Y.[__].HH...#',
    '#.sss..Y.[__].....P#',
    '#P.......[__]......#',
    '#........[__]......#',
    '##########MM########',
  ],
  legend: {
    '#': 'shochiku_walltop', U: 'shochiku_wall_up', '=': 'shochiku_wall',
    c: 'shochiku_wall+clock', q: 'shochiku_wall+shochiku_poster', L: 'shochiku_wall+lantern',
    E: 'shochiku_door_l', e: 'shochiku_door_r', K: 'shochiku_shoji_l', k: 'shochiku_shoji_r',
    N: 'shochiku_noren_l', n: 'shochiku_noren_r',
    C: 'shochiku_counter', F: 'flower_stand', P: 'plant', b: 'sign_board', R: 'trophy', V: 'vending',
    '[': 'shochiku_carpet_l', _: 'shochiku_carpet', ']': 'shochiku_carpet_r',
    S: 'sofa', T: 'table_low', s: 'shochiku_sofa_up', m: 'magazine', Y: 'shochiku_koshi', H: 'shochiku_photo',
  },
  warps: [
    { x: 10, y: 12, to: 'exit' },
    { x: 11, y: 12, to: 'exit' },
    { x: 2, y: 2, room: 'office', tx: 9, ty: 11, dir: 'up' },
    { x: 3, y: 2, room: 'office', tx: 10, ty: 11, dir: 'up' },
    { x: 5, y: 2, room: 'keiko', tx: 8, ty: 10, dir: 'up' },
    { x: 6, y: 2, room: 'keiko', tx: 8, ty: 10, dir: 'up' },
    { x: 16, y: 2, room: 'theater', tx: 9, ty: 13, dir: 'up' },
    { x: 17, y: 2, room: 'theater', tx: 9, ty: 13, dir: 'up' },
  ],
  entities: [
    { type: 'logo', x: 8, y: 1.1, w: 6, h: 1.8, logo: 'shochiku', board: true },
    { type: 'npc', id: 'uketsuke', x: 10, y: 3, dir: 'down', look: L.uketsuke, name: '受付さん', talk: uketsukeTalk },
    { type: 'npc', id: 'annai', x: 11, y: 3, dir: 'down', look: L.annai, name: '案内係', talk: annaiTalk },
    { type: 'npc', id: 'guard', x: 13, y: 11, dir: 'left', look: L.guard, name: '警備員さん', talk: guardTalk },
    { type: 'npc', id: 'wakate', x: 5, y: 8, dir: 'left', look: L.wakate, name: '若手芸人', talk: wakateTalk },
    { type: 'npc', id: 'fan', x: 14, y: 9, dir: 'up', look: L.fan, name: 'ファンのおばちゃん', talk: fanTalk },
    { type: 'npc', id: 'chikoku', x: 11, y: 12, dir: 'up', look: L.chikoku, name: '新人芸人', hidden: true, text: '…' },
    { type: 'sign', x: 4, y: 2, text: '若手ライブのポスターだ。\n「毎日公演！笑いの本場で腕だめし」と書いてある。' },
    {
      type: 'sign', x: 15, y: 4,
      talk: async (g) => {
        const pages = ['立て看板だ。\n「本日の若手ライブ　出演：まるかく ほか」', '劇場は右奥の、のれんの先。入り口のもぎりで見学できるらしい。'];
        if (jobCount(g, 'shochiku_wakate_live') > 0) pages.push('出演者の欄に、小さく{name}の名前も書いてある…！');
        await g.say(pages);
      },
    },
    {
      type: 'sign', x: 14, y: 8,
      talk: async (g) => {
        const pages = ['事務所の歩みを紹介する写真パネルだ。', '古い白黒写真から最近の写真まで、たくさんの芸人さんの笑顔が並んでいる。'];
        if (g.flag('shochiku_kanmuri_started')) pages.push('すみっこに、{name}の写真も貼られている！');
        await g.say(pages);
      },
    },
    { type: 'sign', x: 15, y: 8, text: '写真パネルだ。舞台の上の芸人さんたちが、みんないい顔で笑っている。' },
    { type: 'sign', x: 16, y: 6, text: '記念の盾や賞状が飾られている。\nみんなの努力のあかしだ。' },
    { type: 'sign', x: 17, y: 6, text: 'ピカピカのトロフィーだ。\nいつか自分も…！' },
    { type: 'sign', x: 18, y: 6, text: '記念の盾や賞状が飾られている。\nみんなの努力のあかしだ。' },
    { type: 'sign', x: 9, y: 3, text: 'お祝いのスタンド花だ。いい香りがする。' },
    { type: 'sign', x: 12, y: 3, text: 'お祝いのスタンド花だ。いい香りがする。' },
  ],
  events: [
    { x: 1, y: 10, w: 18, h: 1, on: 'step', once: 'shochiku_intro', run: lobbyIntro },
  ],
  drawUnder(ctx, g, cam) {
    const sx = (tx) => tx * 16 - cam.x, sy = (ty) => ty * 16 - cam.y;
    plate(ctx, sx(3), sy(1) + 6, '事務所');
    plate(ctx, sx(6), sy(1) + 6, '稽古場', { bg: '#3a2416', edge: '#c9a227', color: '#f6f1e7' });
    text(ctx, '劇場', sx(17), sy(2) + 4, { size: 10, align: 'center', color: '#ffffff', shadow: RED_D });
  },
};

// ================================================================== OFFICE
async function welcome(g) {
  if (g.flag('shochiku_welcomed')) return;
  g.setFlag('shochiku_welcomed');
  if (g.npc('manager')) {
    await approach(g, 'manager', 2);
    await g.emote('manager', '!');
  }
  await sayAs(g, MANAGER, [
    'おっ、キミが今日から入った子やな！',
    'マネージャーの南（みなみ）や。よろしゅう頼むで！',
    'これ、うちの名刺や。今日からキミも松竹芸能の一員やで。',
  ]);
  g.giveItem('shochiku_meishi');
  g.giveItem('netacho');
  g.sfx('coin');
  await sayAs(g, MANAGER, [
    'まずは劇場の若手ライブで場数ふもか。舞台監督に声かけてな。',
    'ラジオのゲストの仕事も、ワシが取ってきたる。いつでも相談においで！',
  ]);
  await g.say('{name}は、松竹芸能の一員になった！');
  const mgr = g.npc('manager');
  if (mgr && (mgr.x !== 3 || mgr.y !== 3)) {
    await walkTo(g, 'manager', 3, 3, 2);
    mgr.dir = 'down';
  }
}

function managerGreeting(g) {
  const st = g.state;
  if (!st.agency) return ['マネージャーの南や。…キミ、まだどこにも所属してへんのか。', 'うちに入りたいんやったら、オーディション担当に声かけてな。', 'まあ、番組からの依頼の話くらいは聞かせたるで。'];
  if (!isMember(g)) return ['よその事務所の子やな。ラジオや番組の依頼、うちにも来とるで。', '条件さえ合えば、つないだるわ。'];
  if (g.flag('shochiku_kanmuri_started')) return '冠ラジオ、評判ええで！今週の収録もよろしく頼むわ。';
  if (st.fame >= 2000) return ['{name}、ちょっとええか。', '…ごっつい話が来とるんや。'];
  if (st.fame >= 1000) return '全国ネットのバラエティから出演依頼や！ええ流れが来とるで。';
  if (st.fame >= 250) return 'おっ、注目されてきたな！関西ローカルの番組から声かかっとるで。';
  return 'おはようさん！まずは若手ライブとラジオで、顔を売っていこか。';
}

async function managerTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (isMember(g) && !g.flag('shochiku_welcomed')) await welcome(g);
  await s(managerGreeting(g));
  const started = !!g.flag('shochiku_kanmuri_started');
  const i = await askAs(g, npc, 'どの仕事の話にする？', ['ラジオのゲスト', '関西ローカル番組', '全国ネット番組', started ? '冠ラジオの収録' : '冠ラジオ番組', 'またにする']);
  if (i === 0) {
    const r = await g.job(JOBS.radio);
    if (r) await s('ラジオはしゃべりの修行になるやろ。リスナーさんは耳がこえとるからな！');
  } else if (i === 1) {
    const r = await g.job(JOBS.local);
    if (r) await s('関西のお客さんに顔を覚えてもろたら、もう怖いもんなしや！');
  } else if (i === 2) {
    if (st.fame >= 1000) await s('全国ネットや。気張っていきや！…でも、いつもどおりでええからな。');
    const r = await g.job(JOBS.zenkoku);
    if (r) await s(r.rank === 'S' || r.rank === 'A' ? '見たで！スタジオ、大ウケやったやんか！' : 'ええ経験になったな。次はもっとかましたれ！');
  } else if (i === 3) {
    const ready = isMember(g) && st.fame >= 2000;
    if (ready && today(g, 'shochiku_kanmuri_day')) { await s('今日の収録はもう終わったで。また明日、よろしゅうな！'); return; }
    if (ready && !started) {
      await s(['実はな…ラジオ局から話が来とんねん。', '{name}の名前がついた番組…冠番組や！']);
      await g.emote('player', '!');
    }
    if (!isMember(g) && st.fame >= 2000) { await s('冠番組の話はな、うちの所属タレントにしか回されへんのや。堪忍な。'); return; }
    const r = await g.job({ ...JOBS.kanmuri, title: started ? '冠ラジオ番組の収録' : JOBS.kanmuri.title });
    if (!r) return;
    markToday(g, 'shochiku_kanmuri_day');
    if (!started) {
      g.setFlag('shochiku_kanmuri_started');
      await kanmuriParty(g);
    } else {
      await s('今週もええ放送やったで！リスナーのハガキ、どっさり来とる！');
    }
  } else {
    await s('ほな、またな。体だけは大事にしいや。');
  }
}

async function shinsaTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (isMember(g)) {
    return s(['あら、{name}さん。オーディションはもう卒業やね。', '最近の新人さんも、みんなキミにあこがれてがんばってるんよ。']);
  }
  await s([
    'オーディション担当です。松竹芸能のオーディションでは、しゃべりの腕を見させてもらいます。',
    '審査員の質問に、どう返すか。場の空気を読んで、いちばんええ返しを選んでね。',
  ]);
  if (st.agency) await s('よその事務所の人も受けられるけど、合格したら移籍の相談になるからね。');
  const before = st.stamina;
  const ok = await g.audition(AUDITION);
  if (ok && isMember(g)) {
    await welcome(g);
  } else if (!ok && st.stamina < before && !st.agency) {
    await s('しゃべりは、稽古場のしゃべりレッスンで鍛えられるよ。また待ってるからね！');
  }
}

async function buchoTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (g.flag('shochiku_kanmuri_started')) {
    await s(['冠番組、毎週聞いとるで。', 'わしの若い頃の失敗談、ネタにしてもええで。…いや、やっぱりあかん！']);
    return g.emote('bucho', 'w');
  }
  if (isMember(g) && st.fame >= 1000) return s(['全国区になってきたなあ。', 'せやけど、なんばの劇場のお客さんを忘れたらあかんで。あそこがキミの原点や。']);
  if (isMember(g)) return s(['おう、{name}。がんばっとるか。', '芸は一日にしてならず、や。毎日ちょっとずつ積み重ねるんやで。']);
  return s([
    'わしがここの部長や。',
    'うちは大阪で長いこと続いてきた事務所でな、しゃべりの芸を大事にしとるんや。',
    'おもろい子はいつでも大歓迎やで。オーディション、待っとるわ。',
  ]);
}

async function kohoTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (st.fame >= 500 && !g.flag('shochiku_letter')) {
    g.setFlag('shochiku_letter');
    await s(['{name}さん宛てに、ファンレターが届いてますよ！', 'はい、どうぞ。大事に読んであげてくださいね。']);
    g.giveItem('shochiku_fanletter');
    g.sfx('coin');
    return;
  }
  if (st.fame >= 500) return s('ファンレター、毎日ちょっとずつ増えてますよ〜。人気者ですね！');
  return s([
    '広報担当です。所属タレントの宣伝のお仕事をしてます。',
    '知名度が上がってきたら、事務所にファンレターも届くようになりますよ。楽しみですね！',
  ]);
}

async function ochaTalk(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  if (today(g, 'shochiku_tea_day')) return s('お茶のおかわりは、また明日ね〜。今日はもうゆっくりしいや。');
  markToday(g, 'shochiku_tea_day');
  await s('おつかれさま〜。ほうじ茶いれたから、飲んでいき。');
  g.heal(15);
  g.sfx('good');
  g.notify('体力 +15', { color: '#5ee07a' });
  return s('ほっこりした？また明日もおいでな〜。');
}

async function veteranTalk(g, npc) {
  const st = g.state;
  const s = (t) => sayAs(g, npc, t);
  if (st.fame >= 2000) return s(['ほぉ…もうスターやないか。', 'せやけど、てっぺんはまだ先や。国民的スターっちゅうのは、日本中の人を笑顔にする人のことやで。']);
  if (st.skills.talk >= 30) return s(['しゃべりがだいぶ板についてきたなあ。', 'あとは「間（ま）」や。言うタイミングひとつで、同じ言葉でも笑いは倍になるんやで。']);
  return s([
    'わしはここで何十年もしゃべりで食うてきた芸人や。',
    'ええか、しゃべりの半分は「聞く力」や。相手の話をよう聞いてから返すんやで。',
    'トークの仕事は、相手の言うたことにどう返すかが勝負や。覚えときや。',
  ]);
}

async function adTalk(g, npc) {
  return sayAs(g, npc, [
    '関西ローカル番組のADです！打ち合わせに来ました！',
    '大阪にまつわるクイズ番組なんです。地元ネタに強いと有利ですよ〜。',
    '出演のお話は、マネージャーさんに通してありますんで！',
  ]);
}

async function producerTalk(g, npc) {
  return sayAs(g, npc, [
    '東京から来た、全国ネット番組のプロデューサーです。',
    'キミのしゃべり、なかなか評判ですよ。ひな壇でガンガン前に出てください！',
    '詳しくはマネージャーさんとお話しさせてもらってます。',
  ]);
}

function scheduleBoard(g) {
  const st = g.state;
  const pages = [];
  if (!isMember(g)) {
    pages.push('ホワイトボードだ。\n「オーディション受付中！審査はトーク」と大きく書いてある。');
    pages.push('「練習生へ：しゃべりレッスン・漫才レッスンは稽古場で」');
    return pages;
  }
  pages.push(`ホワイトボードのスケジュール表に、{name}の名前がある！`);
  const next = [];
  next.push('・若手ライブ（劇場の舞台監督）');
  next.push('・ラジオのゲスト（マネージャー）');
  pages.push(next.join('\n'));
  if (st.fame < 250) pages.push('すみっこに「★250で関西ローカル番組」と書いてある。');
  else if (st.fame < 1000) pages.push('「関西ローカル番組 出演中！」\nすみっこに「次は★1000で全国ネット」と書いてある。');
  else if (st.fame < 2000) pages.push('「全国ネット 出演決定！」\nすみっこに「★2000で…？ ひみつ」と書いてある。');
  else if (!g.flag('shochiku_kanmuri_started')) pages.push('赤ペンで大きく「冠番組!!」と書いて、丸で囲んである！');
  else pages.push('「毎週収録：『{name}の いっぺん聞いてみ！』」と書いてある！');
  return pages;
}

// ---- 冠ラジオ celebration (kusudama + confetti)
const party = { on: false, t0: 0, openT: -1 };

async function kanmuriParty(g) {
  const p = g.map.player;
  const home = { x: p.x, y: p.y, dir: p.dir };
  await g.fadeOut();
  // まる & かく come in from the door
  for (const [id, x, y] of [['party_maru', 9, 11], ['party_kaku', 10, 11]]) {
    const e = g.npc(id);
    if (!e) continue;
    let tx = x, ty = y;
    if (g.map.blocked(tx, ty, e)) { tx = x; ty = y - 1; }
    placeEnt(e, tx, ty, 'up');
    e.hidden = false;
  }
  party.on = true;
  party.t0 = g.frame;
  party.openT = -1;
  await g.fadeIn();
  await g.say('「{name}、おめでとうーー！！」');
  for (const id of ['manager', 'bucho', 'shinsa', 'koho', 'party_maru', 'party_kaku']) await approach(g, id, 2.6);
  party.openT = g.frame;
  g.sfx('fanfare');
  g.shake(12, 1);
  await g.wait(1000);
  g.sfx('applause');
  await sayAs(g, BUCHO, ['{name}、冠番組スタートおめでとう！', 'キミの名前がついた番組や。これからは毎週、キミのしゃべりが電波に乗るんやで。']);
  await sayAs(g, MANAGER, ['番組名は…『{name}の いっぺん聞いてみ！』や！', 'オーディションの日から見とったけど…ほんまに、ようがんばったなあ。']);
  await g.emote('manager', '…', 60);
  await sayAs(g, MARU, '先輩！ゲストで呼んでくださいね〜！');
  g.sfx('hit');
  await sayAs(g, KAKU, 'ちゃっかり出演交渉すな！…でも、ほんまにおめでとうございます！');
  await Promise.all(['party_maru', 'party_kaku', 'koho', 'shinsa'].map((id) => g.emote(id, '♥', 60)));
  g.giveItem('shochiku_tate');
  g.sfx('coin');
  await g.say(['記念の盾をもらった！', '{name}の冠ラジオ番組が、ついにスタートした！']);
  await g.fadeOut();
  party.on = false;
  quiet = true;
  await g.goto('shochiku', 'office', home.x, home.y, home.dir, { fade: false });
  quiet = false;
  await g.fadeIn();
}

function drawParty(ctx, g) {
  if (!party.on) return;
  const cx = W / 2;
  const opened = party.openT >= 0;
  const ot = opened ? g.frame - party.openT : 0;
  if (opened) {
    const cols = ['#ff5d6c', '#ffd23f', '#5fd7ff', '#5ee07a', '#ff7eb6', '#ffffff'];
    for (let i = 0; i < 80; i++) {
      const sp = 0.45 + (i % 7) * 0.12;
      const y = Math.round(((ot * sp + i * 29) % (H + 20)) - 20);
      const x = Math.round(((i * 71) % W) + Math.sin((ot + i * 13) / 16) * 6);
      ctx.fillStyle = cols[i % cols.length];
      if (Math.floor((ot + i * 3) / 8) % 2) ctx.fillRect(x, y, 2, 2);
      else ctx.fillRect(x, y, 3, 1);
    }
  }
  // kusudama
  const by = 58;
  ctx.fillStyle = '#20232a';
  ctx.fillRect(cx, 38, 1, by - 49);
  if (!opened) {
    pdisc(ctx, cx, by, 11, '#b8901a');
    pdisc(ctx, cx, by, 10, GOLD);
    ctx.fillStyle = RED;
    ctx.fillRect(cx - 10, by - 1, 21, 3);
    ctx.fillStyle = '#fff6a8';
    ctx.fillRect(cx - 5, by - 7, 3, 2);
  } else {
    const d = Math.min(9, Math.floor(ot / 2));
    pdisc(ctx, cx - d, by + 1, 10, GOLD, -1);
    pdisc(ctx, cx + 1 + d, by + 1, 10, GOLD, 1);
    ctx.fillStyle = RED;
    ctx.fillRect(cx - d - 10, by, 10, 2);
    ctx.fillRect(cx + 1 + d, by, 10, 2);
    // banner unrolls
    const bw = Math.min(176, ot * 6);
    if (bw > 4) {
      const bx = Math.round(cx - bw / 2), byy = by + 14;
      ctx.fillStyle = RED_D;
      ctx.fillRect(bx - 1, byy - 1, bw + 2, 22);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx, byy, bw, 20);
      if (bw >= 176) text(ctx, '祝！冠ラジオ番組スタート！', cx, byy + 4, { size: 12, align: 'center', color: RED, shadow: null });
    }
  }
}

const OFFICE = {
  floor: 'floor_carpet_gray',
  wall: 'white',
  bgm: 'office',
  tiles: [
    '####################',
    '#=w=c=BB======w=q=w#',
    '#CC.....P....R...OO#',
    '#........XXX.......#',
    '#.XXX..........XXX.#',
    '#.................a#',
    '#..................#',
    '#.....QQQ..........#',
    '#f.............SSS.#',
    '#k.............TTT.#',
    '#W.............sss.#',
    '#P................P#',
    '#########MM#########',
  ],
  legend: {
    '#': 'shochiku_walltop', '=': 'shochiku_wall', w: 'shochiku_wall+window', c: 'shochiku_wall+clock',
    B: 'shochiku_wall+whiteboard', q: 'shochiku_wall+shochiku_poster',
    C: 'cabinet', O: 'bookshelf', P: 'plant', R: 'trophy', X: 'shochiku_desk', Q: 'desk_pc', a: 'camera',
    f: 'fridge', k: 'kitchen', W: 'water_server', S: 'sofa', T: 'table', s: 'shochiku_sofa_up',
  },
  warps: [
    { x: 9, y: 12, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
    { x: 10, y: 12, room: 'lobby', tx: 3, ty: 3, dir: 'down' },
  ],
  entities: [
    { type: 'logo', x: 8.5, y: 1.05, w: 4, h: 0.9, logo: 'shochiku', board: true },
    { type: 'npc', id: 'manager', x: 3, y: 3, dir: 'down', look: L.manager, name: 'マネージャー', talk: managerTalk },
    { type: 'npc', id: 'bucho', x: 10, y: 2, dir: 'down', look: L.bucho, name: '部長', talk: buchoTalk },
    { type: 'npc', id: 'shinsa', x: 16, y: 3, dir: 'down', look: L.shinsa, name: 'オーディション担当', talk: shinsaTalk },
    { type: 'npc', id: 'koho', x: 7, y: 8, dir: 'up', look: L.koho, name: '広報さん', talk: kohoTalk },
    { type: 'npc', id: 'ocha', x: 2, y: 9, dir: 'right', look: L.ocha, name: '事務員さん', talk: ochaTalk },
    { type: 'npc', id: 'veteran', x: 14, y: 9, dir: 'right', look: L.veteran, name: 'ベテラン芸人', talk: veteranTalk },
    { type: 'npc', id: 'local_ad', x: 12, y: 6, dir: 'left', look: L.ad, name: '番組AD', talk: adTalk, cond: (g) => g.state.fame >= 250 && g.state.fame < 1000 },
    { type: 'npc', id: 'producer', x: 12, y: 6, dir: 'left', look: L.producer, name: 'プロデューサー', talk: producerTalk, cond: (g) => g.state.fame >= 1000 && !g.flag('shochiku_kanmuri_started') },
    { type: 'npc', id: 'party_maru', x: 9, y: 11, dir: 'up', look: L.maru, name: 'まる', hidden: true, text: 'おめでとうございます！' },
    { type: 'npc', id: 'party_kaku', x: 10, y: 11, dir: 'up', look: L.kaku, name: 'かく', hidden: true, text: 'おめでとうございます！' },
    { type: 'sign', x: 18, y: 5, text: 'オーディション撮影用のカメラだ。\n審査のようすを記録しているらしい。' },
  ],
  events: [
    { x: 6, y: 1, w: 2, h: 1, on: 'action', run: async (g) => { await g.say(scheduleBoard(g)); } },
  ],
  onEnter: roomBanner('松竹芸能　事務所'),
  drawOver(ctx, g) { drawParty(ctx, g); },
};

// ================================================================== KEIKO (rehearsal room)
async function shabeTeacher(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  const i = await askAs(g, npc, ['しゃべりの稽古をつけたるわ。', '話す力は、芸人にもタレントにも一生もんやで。'], ['レッスンを受ける', 'コツを聞く', 'やめておく']);
  if (i === 0) {
    const r = await g.lesson(LESSONS.talk);
    if (r) await s(r.rank === 'S' || r.rank === 'A' ? 'ええ返しや！その調子やで。' : 'まだまだ伸びるで。毎日の積み重ねや。');
  } else if (i === 1) {
    await s([
      'トークはな、相手の話をよう聞くことから始まるんよ。',
      '場の空気に合う返しを選ぶのがコツや。ウケ狙いばっかりでもあかん。',
      'スキルが上がると、本番のミニゲームもちょっとやさしくなるで。',
    ]);
  } else {
    await s('ほな、またおいで。');
  }
}

async function manzaiTeacher(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  const i = await askAs(g, npc, 'よっしゃ、漫才の稽古いこか！', ['レッスンを受ける', 'コツを聞く', 'やめておく']);
  if (i === 0) {
    const r = await g.lesson({ ...LESSONS.manzai, opts: { ...LESSONS.manzai.opts, partnerLook: L.manzaiT, ...manzaiScript('ほな、いくで。よろしくお願いします！', LESSON_BITS, 3) } });
    if (r) await s(r.rank === 'S' || r.rank === 'A' ? 'ツッコミのキレ、ばっちりや！' : '間（ま）がちょっと惜しいな。また稽古しよ。');
  } else if (i === 1) {
    await s([
      'ツッコミは間（ま）が命や。早すぎても遅すぎてもウケへん。',
      'ボケてへんとこでツッコんだらあかんで。よう聞いてから、ビシッと！',
      '劇場の若手ライブは、ここで鍛えた腕の見せどころや。',
    ]);
  } else {
    await s('おう、いつでも来いや。');
  }
}

async function duoPractice(g) {
  await sayAs(g, MARU, 'なあなあ、ぼくな、毎朝5時に起きてんねん。');
  await sayAs(g, KAKU, 'えらいやん。');
  await sayAs(g, MARU, 'で、5時1分に二度寝すんねん。');
  const kaku = g.npc('kaku');
  if (kaku) kaku.dir = 'left';
  g.sfx('hit');
  g.shake(6, 1);
  await sayAs(g, KAKU, '起きた意味ないやろ！');
  await g.emote('maru', 'w', 40);
  if (isMember(g)) await sayAs(g, KAKU, ['…とまあ、毎日こうやってネタ合わせしてるねん。', 'ライブで一緒になったら、よろしくな！']);
  else await sayAs(g, KAKU, ['…とまあ、ぼくら「まるかく」いうコンビやねん。', '劇場の若手ライブに出てるから、よかったら見に来てな！']);
}

async function shinjinTalk(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  if (g.flag('shochiku_intro')) await s(['あっ、さっきロビーで会うた人！', 'あのときは走ってすんませんでした…。受付さんに、めっちゃ怒られました。']);
  else await s('ど、どうも！新人芸人です！');
  return s([
    'ここの鏡の前では、毎日一回、自主練ができるんです。',
    'ボクはまだまだやけど…いつか劇場の真ん中に立ちたいんです！',
  ]);
}

async function mirrorPractice(g) {
  if (today(g, 'shochiku_mirror_day')) {
    await g.say('鏡の中の自分と目が合った。\n今日の自主練はもう済ませた。また明日やろう。');
    return;
  }
  const i = await g.ask('大きな鏡だ。鏡に向かって自主練する？\n（無料・体力 -10）', ['しゃべりの練習', 'ツッコミの練習', 'やめておく']);
  if (i !== 0 && i !== 1) return;
  if (!g.useStamina(10)) { await g.say('体力が足りない…。今日はもう休もう。'); return; }
  markToday(g, 'shochiku_mirror_day');
  await g.fadeOut(10);
  g.sfx(i === 0 ? 'talk' : 'hit');
  await g.wait(400);
  await g.fadeIn(10);
  const key = i === 0 ? 'talk' : 'warai';
  g.addSkill(key, 1, true);
  g.sfx('good');
  await g.say(i === 0
    ? `鏡に向かって、しゃべりの練習をした！\nトークが1上がった。（${g.state.skills.talk}）`
    : `「なんでやねん！」鏡に向かってツッコミの練習をした！\nお笑いが1上がった。（${g.state.skills.warai}）`);
}

const KEIKO = {
  floor: 'floor_wood',
  wall: 'white',
  bgm: 'studio',
  tiles: [
    '#################',
    '#===mmmmmmmmmB==#',
    '#.............LL#',
    '#...............#',
    '#.......i.......#',
    '#...............#',
    '#...............#',
    '#z..............#',
    '#z.............s#',
    '#P.............W#',
    '#...............#',
    '########M########',
  ],
  legend: {
    '#': 'shochiku_walltop', '=': 'shochiku_wall', m: 'shochiku_wall+mirror', B: 'shochiku_wall+whiteboard',
    L: 'locker', i: 'mic', z: 'shochiku_zabuton', s: 'speaker', P: 'plant', W: 'water_server',
  },
  warps: [{ x: 8, y: 11, room: 'lobby', tx: 5, ty: 3, dir: 'down' }],
  entities: [
    { type: 'npc', id: 'shabe_t', x: 4, y: 3, dir: 'down', look: L.shabeT, name: 'しゃべり講師', talk: shabeTeacher },
    { type: 'npc', id: 'manzai_t', x: 12, y: 3, dir: 'down', look: L.manzaiT, name: '漫才講師', talk: manzaiTeacher },
    { type: 'npc', id: 'maru', x: 10, y: 7, dir: 'right', look: L.maru, name: 'まる', fixedDir: true, talk: duoPractice },
    { type: 'npc', id: 'kaku', x: 11, y: 7, dir: 'left', look: L.kaku, name: 'かく', fixedDir: true, talk: duoPractice },
    { type: 'npc', id: 'shinjin', x: 4, y: 8, dir: 'up', look: L.chikoku, name: '新人芸人', wander: 1, talk: shinjinTalk },
    { type: 'sign', x: 13, y: 1, text: 'ホワイトボードだ。\n「今週の目標：あいさつは元気よく！ツッコミは愛をこめて！」' },
    { type: 'sign', x: 1, y: 7, text: '座布団が積んである。\n落語の稽古にも使うらしい。' },
    { type: 'sign', x: 1, y: 8, text: '座布団が積んである。\nふかふかだ。' },
    { type: 'sign', x: 15, y: 8, text: '稽古用のスピーカーだ。\n出囃子（でばやし）を流して、本番さながらに練習するらしい。' },
  ],
  events: [
    { x: 4, y: 1, w: 9, h: 1, on: 'action', run: mirrorPractice },
    {
      x: 8, y: 4, on: 'action',
      run: async (g) => {
        await g.say(['稽古用のセンターマイクだ。', 'この前に立つと、なんだか背筋がのびる。']);
        if (isMember(g)) await g.say('{name}は、マイクに向かって一礼した。\n「よろしくお願いします！」');
      },
    },
    { x: 1, y: 1, w: 3, h: 1, on: 'action', run: async (g) => { await g.say(['「笑門来福」と書かれた額だ。', 'わらう門には福きたる。ここの芸人さんたちの合言葉らしい。']); } },
  ],
  onEnter: roomBanner('松竹芸能　稽古場'),
  drawUnder(ctx, g, cam) {
    plate(ctx, 2.5 * 16 - cam.x, 16 - cam.y + 2, '笑門来福', { bg: '#3a2416', edge: '#c9a227', color: '#f6f1e7' });
  },
};

// ================================================================== THEATER
const show = { on: false };
const AUDIENCE = ['kyaku1', 'kyaku2', 'kyaku3'];

const SKITS = [
  [
    [MARU, 'いや〜、ぼく最近、たこ焼き焼くの上手なってん。'],
    [KAKU, 'へえ、ええやん。'],
    [MARU, 'タコ入れ忘れて、ただの丸い焼きになったけどな。'],
    [KAKU, 'それ、ただの「まる」やないか！', true],
    [MARU, 'せやから、コンビ名も「まるかく」やねん。'],
    [KAKU, '関係あるかい！もうええわ！', true],
  ],
  [
    [MARU, 'この前、観光客の人に道きかれてん。'],
    [KAKU, 'おお、親切に教えたったんか？'],
    [MARU, '「通天閣はどこですか」って言うから、「あっちです」て。'],
    [KAKU, 'ええやん。'],
    [MARU, '指さしたの、たこ焼き屋さんの看板やった。'],
    [KAKU, '食べに行かせてどないすんねん！もうええわ！', true],
  ],
  [
    [MARU, 'ぼく、ダイエット始めてん。'],
    [KAKU, 'ええこっちゃ。何してんの？'],
    [MARU, '毎朝10キロ走ってる。…タクシーで。'],
    [KAKU, 'それ乗ってるだけや！', true],
    [MARU, '帰りは歩いてるで。…動く歩道で。'],
    [KAKU, '一歩も歩いてへんやないか！もうええわ！', true],
  ],
];

async function audienceReact(g, kind, sfx) {
  if (sfx) g.sfx(sfx);
  await Promise.all(AUDIENCE.map((id) => g.emote(id, kind, 45)));
}

async function performSkit(g) {
  const maru = g.npc('show_maru'), kaku = g.npc('show_kaku');
  if (!maru || !kaku) return;
  maru.hidden = false;
  kaku.hidden = false;
  g.bgm('shochiku_debayashi');
  await Promise.all([
    g.moveNpc('show_maru', 'right right right right right right face:down', 1.5),
    g.moveNpc('show_kaku', 'right right right right right right right right down face:down', 1.5),
  ]);
  g.bgm('theater');
  await sayAs(g, MARU, 'どうもー！まるかくです！よろしくお願いしますー！');
  await audienceReact(g, '♪', 'applause');
  const skit = SKITS[g.state.day % SKITS.length];
  for (const [who, line, tsukkomi] of skit) {
    if (tsukkomi) {
      kaku.dir = 'left';
      g.sfx('hit');
      g.shake(6, 1);
    }
    await sayAs(g, who, line);
    if (tsukkomi) {
      await audienceReact(g, 'w', 'laugh');
      kaku.dir = 'down';
    }
  }
  await g.say('まる・かく「どうも、ありがとうございましたー！」');
  await audienceReact(g, '♥', 'applause');
  await Promise.all([
    g.moveNpc('show_maru', 'left left left left left left', 2),
    g.moveNpc('show_kaku', 'up left left left left left left left left', 2),
  ]);
  maru.hidden = true;
  kaku.hidden = true;
}

async function watchShow(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  if (today(g, 'shochiku_watch_day')) return s('今日の公演はもう終わったで〜。また明日来てな！');
  const member = isMember(g);
  const i = await askAs(g, npc, member
    ? ['おつかれさまです！今日の若手ライブ、袖から見ていきます？', '先輩らのネタ見るのも勉強ですよ！']
    : ['いらっしゃい！本日の若手ライブ、まもなく開演です！', '入場料は¥500。見ていきます？'], [member ? '見ていく' : '見る（¥500）', 'やめておく']);
  if (i !== 0) return s('またいつでも来てな〜！');
  if (!member && !g.spend(500)) return s('あら、お金が足りへんみたいやね…。また今度な！');
  if (!member) g.sfx('coin');
  markToday(g, 'shochiku_watch_day');
  await s('開演です！ごゆっくりどうぞ〜！');
  const p = g.map.player;
  const home = { x: p.x, y: p.y, dir: p.dir };
  await g.fadeOut();
  quiet = true;
  await g.goto('shochiku', 'theater', 9, 7, 'up', { fade: false });
  quiet = false;
  show.on = true;
  await g.fadeIn();
  await performSkit(g);
  await g.fadeOut();
  show.on = false;
  quiet = true;
  await g.goto('shochiku', 'theater', home.x, home.y, home.dir, { fade: false });
  quiet = false;
  await g.fadeIn();
  g.addSkill('warai', 1, true);
  g.sfx('good');
  await g.say(`プロの間（ま）を間近で見て、勉強になった！\nお笑いが1上がった。（${g.state.skills.warai}）`);
}

async function kantokuTalk(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  if (!isMember(g)) {
    await s(['ここは松竹芸能の若手が腕を磨く舞台や。', '出番がほしいんやったら、まずはオーディションに合格してからやな。']);
    await s('呼び込みの手伝いやったら、うしろの支配人に聞いてみ。誰でも歓迎やで。');
    return;
  }
  await s(jobCount(g, 'shochiku_wakate_live') ? 'おっ、{name}。今日も出番いっとくか？' : ['おう、新人やな！舞台監督や。', '若手ライブは毎日やっとる。ネタができたらいつでも言うてや！']);
  const r = await g.job({ ...JOBS.wakate, opts: { ...JOBS.wakate.opts, ...manzaiScript('どうも〜！よろしくお願いします！', LIVE_BITS, 4) } });
  if (!r) return;
  if (r.rank === 'S' || r.rank === 'A') {
    await audienceReact(g, '♥', 'applause');
    await s('大ウケやったな！お客さん、手ぇ痛なるくらい拍手しとったで！');
  } else if (r.rank === 'B') {
    await audienceReact(g, 'w', 'laugh');
    await s('ええ感じや！この調子で場数ふんでいこ。');
  } else {
    await audienceReact(g, '…');
    await s('まあ、スベる日もある。稽古場で漫才レッスン受けてみ。');
  }
}

async function shihaininTalk(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  const i = await askAs(g, npc, ['劇場支配人です。いらっしゃい！', 'ちょうど呼び込みの人手が足らんのや。手伝うてくれへんか？'], ['手伝う', '劇場のこと', 'やめておく']);
  if (i === 0) {
    const r = await g.job(JOBS.yobikomi);
    if (r) await s(r.rank === 'S' || r.rank === 'A' ? 'おおきに！お客さん、ようけ入ったわ！' : 'おおきに！また頼むわな。');
  } else if (i === 1) {
    await s([
      'ここは若手芸人のための小さな劇場や。毎日ライブをやっとる。',
      '所属の芸人は、舞台監督に言うたら出番がもらえる。',
      'お客さんとして見るんやったら、入り口のもぎりに声かけてな。',
    ]);
  } else {
    await s('ほな、ゆっくりしていき。');
  }
}

async function urikoTalk(g, npc) {
  await g.shop(['shochiku_senbei', 'drink', 'netacho', 'wadai'], { title: '劇場の売店', greeting: 'いらっしゃい！劇場せんべい、名物やで！' });
  await sayAs(g, npc, 'おおきに〜！ライブ、楽しんでってな！');
}

async function onkyoTalk(g, npc) {
  const s = (t) => sayAs(g, npc, t);
  const i = await askAs(g, npc, ['音響さんや。出囃子（でばやし）流すのが、ワシの仕事やねん。', 'ちょっと聞いてみるか？'], ['聞いてみる', 'またこんど']);
  if (i !== 0) return s('ほな、また本番でな。');
  g.bgm('shochiku_debayashi');
  await s('♪チャンチャカ、チャンチャン…\nどや、ワクワクしてくるやろ？');
  await g.wait(800);
  g.bgm('theater');
  return s('この音が鳴ったら、芸人の出番や。いつかキミの出囃子も流したるわ！');
}

const KYAKU = [
  { id: 'kyaku1', x: 7, y: 9, look: LOOKS.fan, name: 'お客さん', lines: (g) => (jobCount(g, 'shochiku_wakate_live') ? ['あっ、この前ライブに出てた人や！', 'あのネタ、めっちゃおもろかったで！'] : ['まるかくが出てくるの、待ってるねん！', '入り口のもぎりのお兄さんに言うたら、ライブ見れるで。']) },
  { id: 'kyaku2', x: 11, y: 8, look: LOOKS.salaryman, name: 'お客さん', lines: () => ['仕事帰りに、若手ライブ見るのが楽しみでなあ。', '笑うと一日の疲れが吹っ飛ぶんや。'] },
  { id: 'kyaku3', x: 2, y: 11, look: LOOKS.kid, name: 'こども', lines: (g) => (g.state.fame >= 250 ? ['テレビで見たことある！', 'サインちょうだい！'] : ['おもろい芸人さんになったら、サインちょうだいな！']) },
];

const THEATER = {
  floor: 'floor_carpet_red',
  wall: 'black',
  bgm: 'theater',
  tiles: [
    '###################',
    '#KTTTTTTTTTTTTTTTK#',
    '#KoooooooooooooooK#',
    '#KoooooooooooooooK#',
    '#KoooooooioooooooK#',
    '#KoooooooooooooooK#',
    '#EEEEEEEEEEEEEE^EE#',
    '#.................#',
    '#.SSSSSS...SSSSSS.#',
    '#.SSSSSS...SSSSSS.#',
    '#.SSSSSS...SSSSSS.#',
    '#.SSSSSS...SSSSSS.#',
    '#.................#',
    '#C.............lQq#',
    '########MMM########',
  ],
  legend: {
    K: 'floor_stage+curtain', T: 'curtain_top', o: 'floor_stage', i: 'floor_stage+mic', E: 'stage_edge', '^': 'stairs_up',
    S: 'seat', C: 'clothes_rack', l: 'spotlight', Q: 'shochiku_console', q: 'speaker',
  },
  warps: [
    { x: 8, y: 14, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
    { x: 9, y: 14, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
    { x: 10, y: 14, room: 'lobby', tx: 17, ty: 3, dir: 'down' },
  ],
  entities: [
    { type: 'logo', x: 7.5, y: 1.15, w: 4, h: 1.35, logo: 'shochiku', board: true },
    {
      type: 'prop', x: 3, y: 5, w: 1, h: 1, solid: true,
      text: 'めくり（出演者の名前の札）だ。\n「まるかく」と書いてある。',
      draw(ctx, sx, sy) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx + 3, sy + 14, 10, 2);
        ctx.fillStyle = WOOD_D; ctx.fillRect(sx + 4, sy + 6, 1, 9); ctx.fillRect(sx + 11, sy + 6, 1, 9);
        ctx.fillStyle = '#3a2416'; ctx.fillRect(sx + 2, sy - 7, 12, 15);
        ctx.fillStyle = '#fbf6ea'; ctx.fillRect(sx + 3, sy - 6, 10, 13);
        ctx.fillStyle = '#20232a';
        for (let k = 0; k < 4; k++) { ctx.fillRect(sx + 6, sy - 4 + k * 3, 4, 1); ctx.fillRect(sx + 7, sy - 5 + k * 3, 1, 3); }
      },
    },
    { type: 'npc', id: 'kantoku', x: 16, y: 3, dir: 'left', look: L.kantoku, name: '舞台監督', talk: kantokuTalk },
    { type: 'npc', id: 'shihainin', x: 6, y: 13, dir: 'right', look: L.shihainin, name: '劇場支配人', talk: shihaininTalk },
    { type: 'npc', id: 'mogiri', x: 12, y: 13, dir: 'left', look: L.mogiri, name: 'もぎり', talk: watchShow },
    { type: 'npc', id: 'uriko', x: 2, y: 13, dir: 'up', look: L.uriko, name: '売店のおばちゃん', talk: urikoTalk },
    { type: 'npc', id: 'onkyo', x: 16, y: 12, dir: 'down', look: L.onkyo, name: '音響さん', talk: onkyoTalk },
    ...KYAKU.map((k) => ({
      type: 'npc', id: k.id, x: k.x, y: k.y, dir: 'up', look: k.look, name: k.name, sprite: seated,
      talk: async (g, npc) => { await sayAs(g, npc, k.lines(g)); npc.dir = 'up'; },
    })),
    { type: 'npc', id: 'show_maru', x: 2, y: 4, dir: 'right', look: L.maru, name: 'まる', hidden: true, text: '…' },
    { type: 'npc', id: 'show_kaku', x: 2, y: 3, dir: 'right', look: L.kaku, name: 'かく', hidden: true, text: '…' },
    { type: 'sign', x: 1, y: 13, text: '若手芸人のグッズTシャツが並んでいる。\n売店のおばちゃんが店番をしているようだ。' },
    { type: 'sign', x: 15, y: 13, text: '舞台を照らすスポットライトだ。' },
    { type: 'sign', x: 17, y: 13, text: '大きなスピーカーだ。\nここから出囃子が流れるらしい。' },
  ],
  events: [
    {
      x: 9, y: 4, on: 'action',
      run: async (g) => {
        await g.say(['舞台のセンターマイクだ。', 'ここに立つ日を夢見て、みんな稽古してるんや…。']);
        if (isMember(g)) await g.say('若手ライブに出るなら、舞台のそでにいる舞台監督に声をかけよう。');
        else await g.say('この舞台に立つには、松竹芸能のオーディションに合格しないと…！');
      },
    },
  ],
  onEnter: roomBanner('松竹芸能　劇場'),
  drawOver(ctx, g, cam) {
    if (!show.on) return;
    const y0 = 6 * 16 - cam.y;
    ctx.fillStyle = 'rgba(6,4,18,0.55)';
    ctx.fillRect(0, y0, W, H - y0);
    ctx.fillStyle = 'rgba(6,4,18,0.3)';
    ctx.fillRect(0, 0, 5 * 16 - cam.x, y0);
    ctx.fillRect(14 * 16 - cam.x, 0, W, y0);
    // warm spotlight pool around the center mic
    const cx = Math.round(9.5 * 16 - cam.x), cy = Math.round(4.7 * 16 - cam.y);
    ctx.fillStyle = 'rgba(255,240,170,0.16)';
    for (let y = -14; y <= 14; y++) {
      const w = Math.round(52 * Math.sqrt(1 - (y * y) / (14.5 * 14.5)));
      ctx.fillRect(cx - w, cy + y, w * 2, 1);
    }
  },
};

// ================================================================== place
registerPlace({
  id: 'shochiku',
  name: '松竹芸能',
  kind: 'building',
  bgm: 'osaka',
  start: { room: 'lobby', x: 10, y: 11, dir: 'up' },
  rooms: {
    lobby: LOBBY,
    office: OFFICE,
    keiko: KEIKO,
    theater: THEATER,
  },
});
