// ズッコケ — 新喜劇風。座長のギャグのオチ（ドーン！）に合わせて、一座のみんなと一緒にズッコケる。
//
//   g.minigame('zukko', { difficulty: 3, gags: [{ setup: '…', cue: '…' }], rounds: 7 })
//
// opts
//   gags   : [{ setup, cue, fake? }]  setup = 座長のフリ, cue = オチのセリフ（言い終わって少し「間」があって ドーン！）
//            fake: true のものは「シーン…」になる（押したらペナルティ）。fake が無ければ組み込みのものを使う。
//            足りない分は組み込みのネタで補う（同じネタのくり返しを避けるため）。
//   fakes  : [{ setup, cue }]         「シーン…」用のセリフだけを差し替えたい時（足りない分は組み込みで補う）
//   rounds : 合計ネタ数（3〜12）。省略時は難易度で 5〜9。
//   shop   : 舞台セットの看板の文字。省略時は「めし処 こけ屋」（新喜劇の劇場内では劇場のセット「うどん まんぷく亭」）
//   noren  : のれんの文字。省略時は「めし」（新喜劇の劇場内では「うどん」）
//
// 採点：本物のオチごとに PERFECT 100 / GOOD 75 / LATE 45 / MISS 0 の平均。
//       フライング（オチより前に押す）は -4、シーン…で押してしまうと -12。
//
// Drawn natively in 640x360 (static hd = true). The cast uses the 32x40 HD sprites at
// 2 px per art pixel (64x80); the stage set, audience and effects are fillRect pixel art.

import { Minigame, registerMinigame, text, wrap, COLORS } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheetHD, LOOKS } from '../engine/sprites.js';
import { audio } from '../engine/audio.js';
import { SW, SH, clamp, makeCanvas, shuffle } from '../engine/util.js';

const FOOT = 270; // y of the cast's feet on the stage floor
const LIE_SHIFT = 20; // a fallen member slides this far back toward the lead, so a solo fall never lands on a neighbour
const CW = 64, CH = 80; // drawn size of a cast member (HD sprite 32x40 at 2x)
const CX = SW / 2; // the lead's x, centre of the set
const INK = '#22202a';

// ---------------------------------------------------------------- built-in content (all original)
const GAGS = [
  { setup: 'このうどん、コシがすごいやろ？', cue: '打ってたら、ワシの腰がいかれたわ！' },
  { setup: '今日はとっておきの新メニューがあるで！', cue: 'その名も…きのうの残りのカレーや！' },
  { setup: '大変や！ 店の前に長い行列が！', cue: '…よう見たら、アリさんの行列やった！' },
  { setup: 'ワシな、遠いところから来たんや。', cue: '…となりの店からや！' },
  { setup: '雨がすごいから、傘を持ってきたで！', cue: '…開いてみたら、日傘やった！' },
  { setup: '新しいバイトの子、張り切ってたで。', cue: '張り切りすぎて、もう疲れて寝とる！' },
  { setup: 'ワシ、毎朝ぎょうさん本読んでるねん。', cue: '…マンガの4コマだけな！' },
  { setup: 'この店で一番高いもん、知ってるか？', cue: '…天井や！' },
  { setup: '今日はお客さんに特別サービスや！', cue: 'お水が…おかわり自由！' },
  { setup: 'ワシの特技、見せたろか？', cue: '3秒で寝られるんや！ …ぐう。' },
  { setup: 'ワシ、実は空を飛べるんや。', cue: '…飛行機に乗ったらな！' },
  { setup: 'ちょっと聞いて！ すごい発見や！', cue: '右の靴、左にはいとった！' },
  { setup: 'この時計、いま何時やと思う？', cue: '電池切れで、ずっと3時のおやつや！' },
  { setup: 'この店、創業100年の老舗やで！', cue: '…ワシが来てからは、3日目や！' },
  { setup: '見てみ！ 新しいメガネ買うたんや！', cue: '…かけてへんから、何も見えへん！' },
  { setup: 'はい、いらっしゃい！ 何名さま？', cue: '…って、鏡に映ったワシやないか！' },
  { setup: 'この店、予約がすごいんや。', cue: '3年先まで…ガラガラや！' },
  { setup: 'ワシ、今日からダイエットするで。', cue: 'おやつは、ケーキ3こまでや！' },
  { setup: 'よっしゃ、出前に行ってくるわ！', cue: '…どこに届けるか、聞いてへん！' },
  { setup: 'この電話、朝から全然鳴らへんなあ。', cue: '…線、つながってへんかった！' },
  { setup: '店のエアコン、新しくしたで！', cue: 'うちわに、電池つけただけや！' },
  { setup: 'お客さん、空いてる席へどうぞ！', cue: '…あ、椅子ぜんぶ修理に出してたわ！' },
  { setup: 'ワシ、料理の天才やねん。', cue: 'ゆで卵…3回に1回は成功や！' },
  { setup: 'いらっしゃい！ 本日はお日柄もよく…', cue: '…あかん、結婚式のスピーチや！' },
  { setup: 'よーし、店の大そうじするで！', cue: '気合い入れすぎて、ほうき折れた！' },
  { setup: 'ワシな、昔はモテモテやったんや。', cue: '…公園のハトにな！' },
  { setup: '金庫の番号、ちゃんと覚えたで！', cue: '…メモごと、金庫にしまってもうた！' },
  { setup: 'このカレー、隠し味が入ってるんや。', cue: '隠しすぎて、ワシにも見つからん！' },
];

// Lines that sound like the build-up to a gag but land flat: the cue is 「シーン…」.
const FAKES = [
  { setup: 'ここで一発、ギャグいくで！', cue: '…ふとんが、ふかふかや！' },
  { setup: 'おもろい話、思い出したわ。', cue: '…いや、ふつうの話やったわ。' },
  { setup: 'お待たせ！ 特製きつねうどんや！', cue: '…熱いから、気ぃつけてな！' },
  { setup: '今日は特別に、新ネタ見せたる！', cue: '…ちょっと待ってな、メモ探すわ。' },
  { setup: 'ワシの新ギャグ、聞いてや！', cue: '…あかん、オチ忘れてもうた。' },
  { setup: 'よーし、ここで決めたるで！', cue: '…明日は、くもりのち晴れです。' },
  { setup: 'みんな、大事な話があるんや。', cue: '…来週から、定休日が水曜や！' },
  { setup: 'すごいもん、見せたろか？', cue: '…ふつうの、えんぴつや！' },
];

// R29: more gags
GAGS.push(
  { setup: 'このたこ焼き、ほんまにうまいで！', cue: '…食べたら、中身はたこ焼きの絵やった！' },
  { setup: 'ワシ、今日から早起きすることにしたんや。', cue: '…昨日の夜から、起きっぱなしや！' },
  { setup: 'おっ、新しい靴下はいたで！', cue: '…右と左、ぜんぶ右や！' },
  { setup: 'ワシな、泳ぎは得意なんやで。', cue: '…ただし、水に入らんかったらな！' },
  { setup: 'ワシ、占いで一番の運勢やったんや。', cue: '…ただし、来世のな！' },
  { setup: 'ちょっと待ってな、今お茶いれるわ。', cue: '…お湯がないから、ただの葉っぱや！' },
  { setup: 'ほら、この前の借金、返しに来たで！', cue: '…ありがとう、の気持ちだけな！' },
  { setup: 'うちの猫、賢いんやで！', cue: '…ワシより先に、財布を持って出かけよった！' },
  { setup: '今日はええ天気やから、洗濯日和やなあ。', cue: '…って、洗濯機が壊れとるがな！' },
  { setup: 'ワシ、足が速いんやで。', cue: '…ただし、後ろ向きにな！' },
  { setup: '見てみ、このお菓子、新発売やで！', cue: '…中身、前から売っとるやつや！' },
  { setup: 'お腹すいたなあ。何か食べるもんないか？', cue: '…冷蔵庫に、やる気だけあったわ！' },
  { setup: 'ワシな、絵がうまいんやで。', cue: '…ただし、誰にも見せられへんけどな！' },
  { setup: '大事な書類、ちゃんと持ってきたで。', cue: '…白紙やけどな！' },
  { setup: 'ワシな、昨日夢の中で社長になったんや。', cue: '…夢の中でも、給料は出えへんかった！' },
  { setup: '今日はおもいっきり笑おうや！', cue: '…あかん、笑い方を忘れてもうた！' },
  { setup: 'この傘、すごい発明やで！', cue: '…雨が降ってきたら、勝手に閉じるんや！' },
  { setup: 'ワシ、道に迷うたことないねん。', cue: '…いつも、迷うた先が目的地や！' },
  { setup: 'ちょっと、このボタン押してみ。', cue: '…何も起こらへんかったやろ！ 押しただけや！' },
  { setup: 'この家、借りたら家賃が安いんや。', cue: '…だって、屋根がないんやもん！' },
  { setup: 'ワシな、一日三食、きっちり食べるんやで。', cue: '…ただし、一食あたり五人前な！' },
  { setup: 'この辺に、ええお店ないか？', cue: '…って、ここが、ええお店や！' },
  { setup: 'ワシな、毎日走ってるんやで。', cue: '…ただし、夢の中でな！' },
  { setup: 'この壁、えらいきれいに塗ったなあ。', cue: '…って、まだ乾いてへん！ ワシの手が！' },
);
FAKES.push(
  { setup: 'ここでドカンと一発、いくで！', cue: '…ちょっと、お茶にしよか。' },
  { setup: 'おもろい話があるんや。聞くか？', cue: '…って、さっきも話したな。' },
  { setup: 'ワシの必殺技、見せたるわ！', cue: '…ふつうに、おじぎや。' },
  { setup: 'とっておきのネタ、いくで〜！', cue: '…今日は、ここまで。' },
  { setup: '今日はみんなにサプライズや！', cue: '…明日も営業してます。' },
  { setup: 'ここで決めゼリフや！', cue: '…ええ天気ですなぁ。' },
);

// ---------------------------------------------------------------- cast
const LEAD = { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#e8873a', bottom: '#3b3f48', jacket: true, tie: '#d62f2f' };
const OKAMI = { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#c0452f', bottom: '#f2f2f2', skirt: true };
const JII = { ...LOOKS.oldman, top: '#6b7f4a' };
const MADONNA = { hair: 'long', hairColor: 'black', skin: 'light', top: '#ff7eb6', bottom: '#f2f2f2', skirt: true };

const RES = {
  perfect: { label: 'PERFECT!', color: '#ffd23f', pts: 100 },
  good: { label: 'GOOD!', color: '#5fd7ff', pts: 75 },
  late: { label: 'LATE', color: '#ff9a3c', pts: 45 },
  miss: { label: 'MISS…', color: '#c8ccd4', pts: 0 },
  fly: { label: 'フライング！', color: '#ff5d6c', pts: 0 },
  hold: { label: 'ガマン成功！', color: '#5ee07a' },
  oops: { label: 'ひとりズッコケ…', color: '#ff5d6c' },
};
const DOT_COLORS = { perfect: '#ffd23f', good: '#5fd7ff', late: '#ff9a3c', miss: '#5a6075', fly: '#ff5d6c', oops: '#ff5d6c', hold: '#5ee07a' };
const DOT_LIGHT = { perfect: '#fff2a8', good: '#c4f2ff', late: '#ffd09a', miss: '#8a90a8', fly: '#ffb0b8', oops: '#ffb0b8', hold: '#b8f5c4' };
const FLY_PENALTY = 4;
const FAKE_PENALTY = 12;

const chars = (s) => Array.from(s || '');

// ---------------------------------------------------------------- pixel helpers
function fillDisc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y + r * 0.5));
    c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}
// Ellipse of pixel rows (rx, ry radii), centred on (cx, cy).
function fillOval(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / ((ry + 0.5) * (ry + 0.5)))));
    if (w > 0) c.fillRect(cx - w, cy + y, w * 2, 1);
  }
}
// Box with stepped (rounded) corners: cut[i] = inset of row i from the top / bottom edge.
function pxBox(c, x, y, w, h, col, cut = [2, 1]) {
  c.fillStyle = col;
  const n = cut.length;
  for (let i = 0; i < n; i++) {
    c.fillRect(x + cut[i], y + i, w - cut[i] * 2, 1);
    c.fillRect(x + cut[i], y + h - 1 - i, w - cut[i] * 2, 1);
  }
  c.fillRect(x, y + n, w, h - n * 2);
}
// Scanline polygon fill (crisp, no anti-aliasing).
function fillPoly(c, pts) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const xs = [];
  const n = pts.length;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ay = pts[j][1], by = pts[i][1];
      if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(pts[j][0] + ((sy - ay) / (by - ay)) * (pts[i][0] - pts[j][0]));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
      if (b > a) c.fillRect(a, y, b - a, 1);
    }
  }
}
// Paint a pixel map (array of strings) with a palette; '.' is transparent.
function paintMap(c, map, pal, x0 = 0, y0 = 0) {
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x0 + x, y0 + y, 1, 1);
    }
  });
}

// ---------------------------------------------------------------- static stage art (cached, 640x360)
let stageCache = null;
function buildStage() {
  const [cv, c] = makeCanvas(SW, SH);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(0, 0, SW, SH, '#140f1f');

  // ---- set: shop front (めし処), x 40..600
  // roof eave (瓦): ridges of round tiles (丸瓦) over flat tiles, round tile ends along the eave
  R(40, 24, 560, 22, '#2c323e');
  for (let x = 40; x < 600; x += 16) {
    R(x + 3, 24, 10, 20, '#4a5262');
    R(x + 4, 24, 3, 20, '#6a7488');
    R(x + 11, 24, 2, 20, '#363c4a');
    for (let y = 29; y < 44; y += 7) { R(x + 3, y, 10, 1, '#2c323e'); R(x + 3, y + 1, 10, 1, '#5a6475'); }
  }
  R(40, 44, 560, 8, '#3b4250');
  R(40, 44, 560, 1, '#5a6475');
  for (let x = 48; x < 600; x += 16) { R(x + 2, 48, 4, 1, '#2c323e'); R(x + 6, 47, 4, 1, '#2c323e'); R(x + 10, 48, 4, 1, '#2c323e'); }
  for (let x = 40; x < 600; x += 16) {
    fillDisc(c, x + 8, 47, 6, '#1a1d24');
    fillDisc(c, x + 8, 47, 5, '#5a6475');
    fillDisc(c, x + 7, 46, 3, '#77829a');
    R(x + 7, 46, 3, 3, '#454e5e');
    R(x + 7, 46, 1, 1, '#8a96ae');
  }
  R(40, 52, 560, 2, '#1a1d24');
  // wooden beam
  R(40, 54, 560, 8, '#7a4e26');
  R(40, 54, 560, 2, '#9a6a3a');
  R(40, 61, 560, 1, '#4a2e14');
  for (let x = 46; x < 600; x += 37) R(x, 57, 12 + (x % 3) * 4, 1, '#6b4226');

  // plaster wall
  R(40, 62, 560, 94, '#efdcb2');
  R(40, 62, 560, 3, '#d8c298'); // shadow under the beam
  for (let x = 40; x < 600; x += 2) if (x % 4 === 0) R(x, 65, 1, 1, '#d8c298');
  for (let y = 70; y < 154; y += 5) {
    for (let x = 43 + ((y / 5) % 2) * 7; x < 598; x += 14) {
      R(x, y, 1, 1, '#e0c898');
      if ((x + y) % 3 === 0) R(x + 1, y, 1, 1, '#e0c898');
      if ((x * 7 + y) % 11 === 0) R(x + 4, y + 2, 1, 1, '#f8ead0');
    }
  }

  // lower wainscot (腰板)
  R(40, 156, 560, 40, '#8a5a2a');
  R(40, 156, 560, 2, '#c08a4c');
  R(40, 158, 560, 3, '#a8743a');
  R(40, 161, 560, 1, '#5a3a1a');
  for (let x = 40; x < 600; x += 16) {
    R(x, 162, 1, 30, '#6b4226');
    R(x + 1, 162, 1, 30, '#9a6a3a');
    for (let y = 166; y < 190; y += 7) R(x + 4 + ((x + y) % 5), y, 5, 1, '#7e5026');
  }
  R(40, 190, 560, 6, '#5a3a1a');
  R(40, 190, 560, 1, '#7a4e26');

  // pillars
  for (const x of [40, 254, 374, 588]) {
    R(x, 54, 12, 142, '#7a4e26');
    R(x + 1, 54, 2, 142, '#a8743a');
    R(x + 3, 54, 1, 142, '#9a6a3a');
    R(x + 10, 54, 2, 142, '#4a2e14');
    for (let y = 70; y < 190; y += 23) R(x + 5, y, 1, 9, '#6b4226');
    R(x - 1, 188, 14, 8, '#5a3a1a');
    R(x - 1, 188, 14, 1, '#8a5a2a');
  }

  // window (格子窓) on the left
  R(86, 86, 120, 66, '#3a2512');
  R(88, 88, 116, 62, '#7a4e26');
  R(88, 88, 116, 2, '#a8743a');
  R(88, 88, 2, 62, '#a8743a');
  R(94, 94, 104, 52, '#2a3550');
  R(94, 94, 104, 12, '#39507a');
  R(94, 106, 104, 2, '#334670');
  for (let i = 0; i < 9; i++) R(128 + i, 120 - i, 1, 1, '#5a78a8'); // glints
  for (let i = 0; i < 6; i++) R(160 + i, 118 - i, 1, 1, '#5a78a8');
  for (let x = 94; x < 198; x += 10) {
    R(x, 94, 3, 52, '#a8743a');
    R(x, 94, 1, 52, '#c89458');
    R(x + 3, 94, 1, 52, '#1c2338');
  }
  R(94, 118, 104, 3, '#a8743a');
  R(94, 118, 104, 1, '#c89458');
  R(94, 121, 104, 1, '#1c2338');
  // sill
  R(82, 148, 128, 6, '#6b4226');
  R(82, 148, 128, 2, '#a8743a');
  R(82, 154, 128, 2, '#3a2512');
  // beckoning cat (招き猫) on the sill
  paintMap(c, [
    '...k.......k.k..',
    '..kpk.....kpkwk.',
    '..kwwkkkkkwwkwk.',
    '.kwwwwwwwwwwkwk.',
    '.kwkwwwwkwwwkwk.',
    '.kwwwwppwwwwwwk.',
    '..kwwwwwwwwwkk..',
    '..krrrrrrrrrk...',
    '..kwwwyywwwwk...',
    '.kwwwwyywwwwwk..',
    '.kwwwwwwwwwwwk..',
    '.kwwkwwwwwkwwk..',
    '..kkkkkkkkkkk...',
  ], { k: '#3a2a20', w: '#f6f2e8', p: '#ff9aa8', r: '#d62f2f', y: '#e8c43a' }, 178, 135);

  // potted plant under the window
  R(122, 176, 40, 4, '#3a1a10');
  R(124, 172, 36, 6, '#c8683a');
  R(124, 172, 36, 1, '#e08a58');
  for (let y = 178; y < 196; y++) {
    const inset = Math.floor((y - 178) / 6);
    R(126 + inset, y, 32 - inset * 2, 1, '#b0532e');
    R(126 + inset, y, 2, 1, '#c8683a');
    R(156 - inset, y, 2, 1, '#7a3a20');
  }
  R(128, 194, 28, 2, '#5a2a14');
  fillDisc(c, 142, 160, 13, '#2f7a44');
  fillDisc(c, 141, 159, 12, '#3f9a5a');
  fillDisc(c, 129, 166, 8, '#24603a');
  fillDisc(c, 128, 165, 7, '#2f7a44');
  fillDisc(c, 155, 165, 8, '#24603a');
  fillDisc(c, 154, 164, 7, '#2f7a44');
  for (const [lx, ly] of [[136, 152], [146, 156], [139, 162], [125, 162], [151, 161], [148, 149]]) {
    R(lx, ly, 3, 2, '#5ee07a');
    R(lx + 1, ly + 2, 2, 1, '#4cc068');
  }

  // 日めくり calendar on the left wall
  R(70, 72, 1, 8, '#3a2512');
  R(68, 71, 5, 2, '#6b4226');
  R(60, 80, 22, 6, '#6b4226');
  R(60, 80, 22, 1, '#9a6a3a');
  R(61, 86, 20, 26, '#fbf3dc');
  R(61, 86, 20, 2, '#e8dcc0');
  R(80, 86, 1, 26, '#d8ccb0');
  paintMap(c, ['rrrrr', '....r', '....r', '.rrrr', '....r', '....r', 'rrrrr'], { r: '#d62f2f' }, 68, 92); // 「3」
  R(64, 104, 14, 1, '#9a8a70');
  R(64, 107, 10, 1, '#9a8a70');

  // sliding lattice door in the middle
  R(254, 92, 132, 6, '#5a3a1a');
  R(254, 92, 132, 1, '#8a5a2a');
  for (const [x0, glass] of [[266, '#c9dbe6'], [321, '#b6cad8']]) {
    R(x0, 98, 53, 98, '#7a4e26');
    R(x0, 98, 53, 2, '#a8743a');
    R(x0, 98, 2, 98, '#a8743a');
    R(x0 + 51, 98, 2, 98, '#4a2e14');
    R(x0 + 4, 102, 45, 62, glass);
    R(x0 + 4, 102, 45, 2, '#e8f0f4');
    for (let y = 102; y < 164; y += 10) R(x0 + 4, y + 8, 45, 2, '#6b4226');
    for (const dx of [15, 30]) { R(x0 + 4 + dx, 102, 2, 62, '#6b4226'); R(x0 + 4 + dx, 102, 1, 62, '#8a5a2a'); }
    R(x0 + 4, 164, 45, 28, '#7a4e26');
    R(x0 + 7, 167, 39, 22, '#6b4226');
    R(x0 + 7, 167, 39, 1, '#4a2e14');
    R(x0 + 7, 188, 39, 1, '#a8743a');
  }
  R(319, 98, 2, 98, '#3a2512');
  // noren
  R(250, 90, 140, 4, '#3a2512');
  R(250, 90, 140, 1, '#6b4226');
  R(248, 89, 4, 6, '#c9a227');
  R(388, 89, 4, 6, '#c9a227');
  R(258, 94, 124, 46, '#27407a');
  R(258, 94, 124, 4, '#1c2f5c');
  R(258, 136, 124, 4, '#1c2f5c');
  for (const x of [298, 340]) { R(x, 122, 2, 18, '#b6cad8'); R(x, 122, 2, 2, '#1c2f5c'); }
  for (const [a, b] of [[258, 298], [300, 340], [342, 382]]) {
    R(a, 98, 2, 38, '#3a5596');
    R(b - 2, 98, 2, 38, '#1a2a52');
    R(a + 10, 124, 1, 12, '#22386c');
    R(b - 12, 124, 1, 12, '#22386c');
  }

  // menu strips (お品書き) on the right
  R(450, 90, 124, 64, '#4a2e14');
  R(452, 92, 120, 60, '#6b4226');
  R(452, 92, 120, 1, '#9a6a3a');
  for (let i = 0; i < 5; i++) {
    const x = 456 + i * 23;
    R(x, 96, 20, 52, '#fbf3dc');
    R(x + 18, 96, 2, 52, '#e2d6b8');
    R(x, 96, 20, 1, '#ffffff');
    let y = 100;
    for (let k = 0; y < 132; k++) {
      const wide = (i * 3 + k) % 4;
      if (wide === 0) { R(x + 6, y, 3, 3, '#3a2a20'); R(x + 10, y, 3, 3, '#3a2a20'); } // two-part kanji
      else R(x + 6 + (wide === 1 ? 1 : 0), y, wide === 1 ? 6 : 7, 3, '#3a2a20');
      if (wide === 2) R(x + 9, y + 3, 1, 1, '#3a2a20');
      y += 5;
    }
    R(x + 5, 136, 9, 8, '#d62f2f');
    R(x + 7, 138, 5, 1, '#fbf3dc');
    R(x + 7, 141, 5, 1, '#fbf3dc');
  }

  // wall clock (3 o'clock: おやつの時間)
  const kx = 520, ky = 75;
  fillDisc(c, kx, ky, 11, '#3a2512');
  fillDisc(c, kx, ky, 10, '#7a4e26');
  fillDisc(c, kx - 1, ky - 1, 8, '#a8743a');
  fillDisc(c, kx, ky, 8, '#fbf3dc');
  for (const [dx, dy] of [[0, -7], [7, 0], [0, 6], [-7, 0]]) R(kx + dx, ky + dy, 1, 2, '#3a2a20');
  R(kx, ky - 6, 1, 7, INK);
  R(kx, ky, 5, 1, INK);
  R(kx - 1, ky - 1, 2, 2, '#d62f2f');
  R(kx - 1, ky - 13, 3, 3, '#3a2512');

  // sign board (看板) under the beam
  R(220, 62, 200, 34, '#2a1a0c');
  R(223, 65, 194, 28, '#6b4226');
  R(223, 65, 194, 2, '#8a5a2a');
  R(223, 65, 2, 28, '#8a5a2a');
  R(415, 65, 2, 28, '#4a2e14');
  R(223, 91, 194, 2, '#4a2e14');
  for (let y = 70; y < 90; y += 5) for (let x = 230 + (y % 3) * 9; x < 410; x += 31) R(x, y, 14, 1, '#5e3a1e');

  // ---- stage floor (planks, deeper = narrower spacing)
  R(40, 196, 560, 92, '#d8a960');
  R(40, 196, 560, 4, '#8a6a3a');
  R(40, 200, 560, 1, '#a07c46');
  const seams = [200, 205, 213, 224, 238, 254, 271, 288];
  for (let k = 1; k < seams.length; k++) {
    const y0 = seams[k - 1], y1 = seams[k];
    if (y1 < 288) { R(40, y1, 560, 1, '#b88a4c'); R(40, y1 + 1, 560, 1, '#e8bc74'); }
    const step = 76 + k * 6;
    for (let x = 44 + ((k * 53) % step); x < 600; x += step) {
      R(x, y0 + 2, 1, y1 - y0 - 2, '#b88a4c');
      R(x + 1, y0 + 2, 1, y1 - y0 - 2, '#e8bc74');
    }
    for (let i = 0; i < 14; i++) { // grain
      const gx = 44 + ((i * 97 + k * 41) % 548), gy = y0 + 2 + ((i * 7 + k) % Math.max(1, y1 - y0 - 3));
      R(gx, gy, 6 + (i % 4) * 3, 1, '#c99a54');
    }
  }
  // stage front + footlights
  R(0, 288, SW, 14, '#5a3a20');
  R(0, 288, SW, 2, '#ddb06e');
  R(0, 290, SW, 1, '#f0cc8a');
  R(0, 291, SW, 1, '#3a2512');
  R(0, 301, SW, 1, '#2a1a0c');
  for (let x = 64; x < 600; x += 48) {
    R(x - 9, 292, 18, 8, '#2a1a0c');
    R(x - 8, 293, 16, 6, '#3a2512');
    R(x - 6, 294, 12, 4, '#fff6a8');
    R(x - 4, 294, 6, 2, '#ffffff');
    R(x - 10, 288, 20, 2, '#ffe9a0'); // light spill on the lip
    R(x - 6, 286, 12, 2, '#efcf84');
  }
  R(0, 302, SW, SH - 302, '#0d0a16');

  // ---- side curtains
  for (const side of [0, 1]) {
    const x0 = side ? 604 : 0;
    R(x0, 0, 36, 302, '#a51f2c');
    for (let x = 0; x < 36; x += 12) {
      R(x0 + x, 0, 2, 302, '#7a1520');
      R(x0 + x + 5, 0, 2, 302, '#c43644');
      R(x0 + x + 7, 0, 1, 302, '#e05a66');
      R(x0 + x + 10, 0, 1, 302, '#8e1a26');
    }
    R(side ? 604 : 33, 0, 3, 302, '#5a0f18');
    // gold tieback + tassel
    R(x0, 166, 36, 8, '#e8c43a');
    R(x0, 166, 36, 2, '#fff0a0');
    R(x0, 172, 36, 2, '#a07f1a');
    const tx = side ? 610 : 20;
    R(tx, 174, 10, 6, '#e8c43a');
    R(tx, 174, 3, 6, '#fff0a0');
    R(tx - 2, 180, 14, 4, '#c9a227');
    for (let i = 0; i < 7; i++) R(tx - 2 + i * 2, 184, 1, 10 + (i % 2) * 3, '#e8c43a');
  }
  // valance with swags + gold fringe
  R(0, 0, SW, 26, '#a51f2c');
  for (let x = 0; x < SW; x += 8) { R(x, 0, 2, 22, '#8a1824'); R(x + 4, 0, 1, 22, '#c43644'); }
  for (let x = 0; x < SW; x += 64) {
    for (let i = 0; i < 64; i++) {
      const d = Math.round(Math.sin((i / 64) * Math.PI) * 10);
      R(x + i, 26, 1, d, '#a51f2c');
      if (i % 8 === 2 || i % 8 === 3) R(x + i, 26, 1, d, '#8a1824');
      R(x + i, 26 + d, 1, 2, '#e8c43a');
      if (i % 3 === 0) R(x + i, 28 + d, 1, 2, '#c9a227');
    }
    R(x - 3, 24, 6, 8, '#e8c43a'); // tassel knot at each swag joint
    R(x - 3, 24, 2, 8, '#fff0a0');
    for (let i = 0; i < 4; i++) R(x - 3 + i * 2, 32, 1, 6, '#c9a227');
  }
  R(0, 21, SW, 4, '#e8c43a');
  R(0, 21, SW, 1, '#fff0a0');
  R(0, 24, SW, 1, '#a07f1a');
  stageCache = cv;
  return cv;
}

// Spotlight cone on the lead + pool of light on the floor (translucent overlay).
let coneCache = null;
function buildCone() {
  const [cv, c] = makeCanvas(SW, SH);
  const y0 = 26, y1 = FOOT + 8;
  c.fillStyle = 'rgba(255,240,190,0.10)';
  for (let y = y0; y < y1; y++) {
    const k = (y - y0) / (y1 - y0);
    const xl = Math.round(CX - 24 - 52 * k), xr = Math.round(CX + 24 + 52 * k);
    c.fillRect(xl, y, xr - xl, 1);
  }
  c.fillStyle = 'rgba(255,240,190,0.18)';
  for (let y = -8; y <= 8; y++) {
    const w = Math.round(76 * Math.sqrt(1 - (y * y) / 72.25));
    c.fillRect(CX - w, FOOT + y, w * 2, 1);
  }
  coneCache = cv;
  return cv;
}

// Audience (fixed layout, seen from behind), cached in 3 states: still / odd heads up / even heads up.
const AUD_Y = 292; // top of the cached audience strip
const AUDIENCE = [];
for (let row = 0; row < 3; row++) {
  const y = [318, 336, 356][row];
  const r = [10, 11, 13][row];
  const step = [34, 37, 41][row];
  for (let x = row % 2 ? 6 : 22; x < SW + 20; x += step) AUDIENCE.push({ x, y, r, row, i: AUDIENCE.length, style: (AUDIENCE.length * 7 + row * 3) % 6 });
}
let audCache = null;
function buildAudience() {
  const out = [];
  for (let v = 0; v < 3; v++) {
    const [cv, c] = makeCanvas(SW, SH - AUD_Y);
    for (const a of AUDIENCE) {
      const bob = v === 0 ? 0 : (a.i % 2 === (v === 1 ? 1 : 0) ? 4 : 0);
      const body = ['#2a2244', '#211a38', '#18122a'][a.row];
      const rim = ['#40366a', '#332a58', '#271f42'][a.row];
      const x = a.x, y = a.y - AUD_Y - bob, r = a.r;
      // shoulders
      pxBox(c, x - r - 7, y + r - 3, r * 2 + 15, 40, rim, [3, 1]);
      pxBox(c, x - r - 6, y + r - 2, r * 2 + 14, 40, body, [3, 1]);
      // hair / head silhouettes (rim-lit from the stage on the top-left)
      const hair = (dx, dy, rr) => { fillDisc(c, x + dx, y + dy, rr, rim); fillDisc(c, x + dx + 1, y + dy + 1, rr, body); };
      if (a.style === 1) hair(0, -r - 1, Math.round(r * 0.45)); // bun
      if (a.style === 3) hair(r - 2, 3, Math.round(r * 0.5)); // ponytail
      if (a.style === 5) for (const dx of [-5, 0, 5]) hair(dx, -r + 1 - (dx ? 0 : 2), 3); // tufts
      hair(0, 0, r);
      if (a.style === 2) { hair(-r, 1, 2); hair(r - 1, 1, 2); } // ears
      if (a.style === 4) { // long hair over the shoulders
        c.fillStyle = rim; c.fillRect(x - r, y + 1, 1, r + 3);
        c.fillStyle = body; c.fillRect(x - r + 1, y + 2, r * 2 + 1, r + 2);
      }
    }
    out.push(cv);
  }
  audCache = out;
  return out;
}

// Crow (flying left), two wing frames.
const CROW = [
  [
    '................kk............',
    '...............kbbk...........',
    '..............kbhhk...........',
    '.............kbhhk............',
    '............kbbhk.............',
    '....kkk....kbbbk..............',
    '...kbbbk..kbbbbk..............',
    '..kbbwbbkkbbbbbbkk............',
    'kyybbbbbbbbbbbbbbbkkk......kk.',
    '.kyybbbbbbhhhbbbbbbbbkkkkkkbbk',
    '..kkbbbbbbbbbbbbbbbbbbbbbbbbk.',
    '....kbbbbbbbbbbbbbbbbbkkkkbbk.',
    '.....kkbbbbbbbbbbbbkkk....kk..',
    '.......kkkbbbbbbkkk...........',
    '..........kkkkkk..............',
  ],
  [
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '..............................',
    '....kkk.......................',
    '...kbbbk......................',
    '..kbbwbbkkkkkkkkk.............',
    'kyybbbbbbbbbbbbbbkkk.......kk.',
    '.kyybbbbbbhhhbbbbbbbkkkkkkkbbk',
    '..kkbbbbbbbbbbbbbbbbbbbbbbbbk.',
    '....kbbbbbbbbbbbbbbbbbkkkkbbk.',
    '.....kkbbbbbbbbbbbbbkk....kk..',
    '.......kkbbbbbbbbbkk..........',
    '..........kbbbbbbk............',
    '...........kbbbbk.............',
    '............kbbk..............',
    '.............kk...............',
  ],
];
let crowCache = null;
function buildCrow() {
  crowCache = CROW.map((map) => {
    const [cv, c] = makeCanvas(30, 18);
    paintMap(c, map, { k: '#0a0a10', b: '#1c1c2a', h: '#3a3a56', y: '#5a5a6e', w: '#ffffff' });
    return cv;
  });
  return crowCache;
}

// ---------------------------------------------------------------- the minigame
class Zukko extends Minigame {
  static title = 'ズッコケ';
  static howto = [
    'ギャグのオチで「ドーン！」→ Aボタン！',
    'みんなと一緒にズッコケよう。',
    '早く押すとフライング！',
    '「シーン…」の時は押さずにガマン！',
  ];
  static skill = 'warai';
  static bgm = 'theater';
  static hd = true;

  init() {
    const i = this.difficulty - 1;
    this.spd = [4, 3.5, 3, 2.6, 2.3][i]; // frames per character
    this.hold = [50, 44, 38, 32, 28][i]; // pause after the setup line
    this.maMin = [22, 18, 14, 12, 10][i]; // 間 between the punch line and the cue
    this.maMax = [40, 50, 62, 72, 84][i];
    // The cue comes after a random 間, so these are pure reaction windows (human reaction + input/display
    // latency is ~0.3 s): PERFECT stays reachable for an attentive player at every difficulty.
    this.winPerfect = Math.round(this.ease([28, 25, 22, 20, 18][i], 0.4));
    this.winGood = Math.round(this.ease([16, 15, 14, 13, 12][i], 0.4));
    this.winLate = 18;
    this.grace = 3; // a press this many frames before the cue still counts
    this.fakeWin = 48;

    let total, nFake;
    const wanted = Number(this.opts.rounds);
    if (Number.isFinite(wanted) && wanted > 0) {
      total = clamp(Math.round(wanted), 3, 12);
      nFake = total >= 4 ? Math.max(1, Math.round(total * 0.25)) : 0;
    } else {
      total = [5, 6, 7, 8, 9][i];
      nFake = [1, 1, 2, 2, 3][i];
    }

    const clean = (a) => (Array.isArray(a) ? a : [])
      .filter((x) => x && typeof x.cue === 'string' && x.cue)
      .map((x) => ({ setup: typeof x.setup === 'string' ? x.setup : '', cue: x.cue, fake: !!x.fake }));
    const custom = clean(this.opts.gags);
    const reals = custom.filter((x) => !x.fake);
    const fakes = custom.filter((x) => x.fake).concat(clean(this.opts.fakes));

    // Fake rounds: never first, never two in a row.
    const fakeAt = new Set();
    for (const p of shuffle(Array.from({ length: total - 1 }, (_, k) => k + 1), this.rng)) {
      if (fakeAt.size >= nFake) break;
      if (fakeAt.has(p - 1) || fakeAt.has(p + 1)) continue;
      fakeAt.add(p);
    }
    // The caller's lines come first; top up from the built-in pool so a short custom list doesn't repeat.
    const topUp = (mine, pool, need) => {
      const q = shuffle(mine, this.rng);
      if (q.length < need) q.push(...shuffle(pool, this.rng).slice(0, need - q.length));
      return q.length ? q : shuffle(pool, this.rng);
    };
    const realQ = topUp(reals, GAGS, total - fakeAt.size);
    const fakeQ = topUp(fakes, FAKES, fakeAt.size);
    let ri = 0, fi = 0;
    this.plan = [];
    for (let k = 0; k < total; k++) {
      const fake = fakeAt.has(k);
      const src = fake ? fakeQ[fi++ % fakeQ.length] : realQ[ri++ % realQ.length];
      this.plan.push({ setup: src.setup, cue: src.cue, fake });
    }
    this.total = total;

    const pl = (this.g.state && this.g.state.look) || LOOKS.player;
    this.cast = [
      { look: OKAMI, x: CX - 176, side: -1 },
      { look: JII, x: CX - 88, side: -1 },
      { look: LEAD, x: CX, side: 0, lead: true },
      { look: pl, x: CX + 88, side: 1, player: true },
      { look: MADONNA, x: CX + 176, side: 1 },
    ];
    for (const m of this.cast) Object.assign(m, { fallAt: null, upAt: null, landed: true, emote: null, emoteUntil: 0 });
    this.player = this.cast[3];
    this.lead = this.cast[2];

    this.results = [];
    this.realPts = [];
    this.flyCount = 0;
    this.fakeFails = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.parts = [];
    this.laughUntil = -1;
    this.laughN = 0;
    this.judgeAt = -999;
    this.overlays = [];
    this.ri = -1;
    this.round = null;
    this.finished = false;
    this.nextRound();
  }

  // ---------------------------------------------------------------- flow
  nextRound() {
    this.ri++;
    if (this.ri >= this.total) { this.finish(); return; }
    const p = this.plan[this.ri];
    const r = { ...p, res: null, pressT: null, flownAt: null };
    const sLen = chars(r.setup).length;
    const cLen = chars(r.cue).length;
    r.tS = 30;
    r.tSE = r.tS + Math.ceil(sLen * this.spd);
    r.tG = sLen ? r.tSE + this.hold : r.tS;
    r.tGE = r.tG + Math.ceil(cLen * this.spd);
    r.ma = Math.round(this.maMin + this.rng() * (this.maMax - this.maMin));
    r.tC = r.tGE + r.ma;
    r.tW = r.tC + (r.fake ? this.fakeWin : this.winPerfect + this.winGood + this.winLate);
    r.tUp = r.fake ? r.tW + 18 : Math.max(r.tW + 6, r.tC + 74);
    r.tEnd = r.tUp + 24;
    this.round = r;
    this.rt = 0;
    this.laughUntil = -1;
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.round = null;
    const s = this.currentScore();
    let c;
    if (s >= 95) c = '完璧なズッコケ！座長も大満足や！';
    else if (s >= 75) c = 'ええコケっぷり！客席も大爆笑や！';
    else if (s >= 55) c = 'なかなかのコケっぷりやったで！';
    else if (this.fakeFails >= 2) c = '「シーン…」でコケすぎや！';
    else if (s >= 35) c = 'タイミングがちょっとズレてたなあ…';
    else c = 'ひとりだけ浮いてもうた…';
    this.end(s, c);
  }

  currentScore() {
    const avg = this.realPts.length ? this.realPts.reduce((a, b) => a + b, 0) / this.realPts.length : 0;
    return clamp(Math.round(avg - this.flyCount * FLY_PENALTY - this.fakeFails * FAKE_PENALTY), 0, 100);
  }

  judge(kind, extra) {
    const r = this.round;
    r.res = kind;
    this.results[this.ri] = kind;
    const def = RES[kind];
    this.judgeAt = this.pt;
    if (!r.fake && def.pts !== undefined) this.realPts.push(def.pts);
    if (kind === 'fly' && !r.fake) this.flyCount++;
    if (r.fake && (kind === 'fly' || kind === 'oops')) this.fakeFails++;
    if (kind === 'perfect' || kind === 'good' || kind === 'hold') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    } else this.combo = 0;
    const px = clamp(this.player.x + 12, 120, SW - 104);
    // just above the actors' heads (FOOT - 80), clear of the 座長's speech bubble
    this.popup(def.label, px, FOOT - 108, def.color, 18);
    if (extra) this.popup(extra, px, FOOT - 86, '#ffffff', 14);
    if (this.combo >= 2 && (kind === 'perfect' || kind === 'good' || kind === 'hold')) this.popup(`${this.combo}コンボ！`, px, FOOT - 130, COLORS.pink, 14);
  }

  // ---------------------------------------------------------------- update
  updatePlay(input) {
    if (this.finished || !this.round) return;
    const r = this.round;
    this.rt++;
    const t = this.rt;

    // typing blips
    const typing = (t >= r.tS && t < r.tSE) || (t >= r.tG && t < r.tGE);
    if (typing && t % 5 === 0) audio.sfx('talk');

    // the cue
    if (t === r.tC) {
      if (r.fake) {
        this.snd('shiin');
        for (const m of this.cast) if (!m.player || r.res === null) this.setEmote(m, m.lead ? 'sweat' : '…', r.tUp);
      } else {
        this.snd('doon');
        this.g.shake(12, 2);
        for (const m of this.cast) {
          if (m.lead || m.player) continue;
          m.fallDelay = Math.floor(this.rng() * 3);
        }
        this.laughUntil = r.tC + 70;
      }
    }
    if (!r.fake && t > r.tC && t <= r.tC + 3) {
      for (const m of this.cast) if (!m.lead && !m.player && m.fallDelay === t - r.tC - 1) this.fall(m, m === this.cast[0]);
    }
    if (!r.fake && t === r.tC + 10) audio.sfx('laugh');
    if (r.fake && t === r.tC + 14) this.snd('crow');
    if (t > r.tC && t < this.laughUntil && t % 14 === 0) {
      const words = ['ワハハ！', 'ドッ！', 'アハハ', 'わはは'];
      this.popup(words[Math.floor(this.rng() * words.length)], 80 + ((this.laughN++ * 97) % 240) * 2, 308, '#ffd23f', 14);
    }

    // player input
    if (input.pressed('a') && r.res === null && t >= r.tS) {
      const early = t < r.tC - this.grace;
      if (r.fake) {
        if (t <= r.tW) {
          this.fall(this.player, true);
          this.judge(early ? 'fly' : 'oops', `-${FAKE_PENALTY}`);
          if (early) r.flownAt = t;
          this.player.emote = null;
          this.setEmote(this.lead, '!?', t + 40);
          audio.sfx('buzz');
        }
      } else if (early) {
        r.flownAt = t;
        this.fall(this.player, true);
        this.judge('fly', `-${FLY_PENALTY}`);
        this.setEmote(this.lead, '!?', t + 40);
        audio.sfx('cancel');
      } else if (t <= r.tW) {
        const d = Math.max(0, t - r.tC);
        r.pressT = t;
        this.fall(this.player, true);
        const kind = d <= this.winPerfect ? 'perfect' : d <= this.winPerfect + this.winGood ? 'good' : 'late';
        this.judge(kind, `${(d / 60).toFixed(2)}秒`);
        if (kind === 'perfect') { audio.sfx('good'); if (this.combo >= 3) audio.sfx('applause'); } else if (kind === 'good') audio.sfx('ok');
        else audio.sfx('cursor');
      }
    }

    // a flier gets back up while waiting, then is pulled down with everyone at the cue
    if (r.flownAt !== null && t === r.flownAt + 45 && t < r.tC - 8) this.getUp(this.player);
    if (r.flownAt !== null && !r.fake && t === r.tC + 1) this.fall(this.player, false);

    // windows closing
    if (t === r.tW && r.res === null) {
      if (r.fake) {
        this.judge('hold');
        audio.sfx('good');
      } else {
        this.judge('miss');
        this.setEmote(this.player, 'sweat', r.tUp);
        this.setEmote(this.lead, '?', r.tUp);
        audio.sfx('buzz');
      }
    }

    // everybody up
    if (t === r.tUp) {
      for (const m of this.cast) { this.getUp(m); m.emote = null; }
    }
    if (t >= r.tEnd) this.nextRound();

    // landing dust / finished getting up
    for (const m of this.cast) {
      if (m.upAt !== null && this.pt - m.upAt >= 10) { m.fallAt = null; m.upAt = null; m.landed = true; }
      if (m.fallAt !== null && m.upAt === null && !m.landed && this.pt - m.fallAt >= 7) {
        m.landed = true;
        const gx = m.x + m.side * (CW / 2 + 16 - LIE_SHIFT);
        for (let k = 0; k < 7; k++) {
          this.parts.push({ x: gx + (this.rng() * 60 - 30), y: FOOT - 4, vx: (this.rng() - 0.5) * 3.2, vy: -this.rng() * 2.4, life: 0, max: 18 + Math.floor(this.rng() * 10), k });
        }
      }
    }
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life++; }
    this.parts = this.parts.filter((p) => p.life < p.max);
  }

  fall(m, sound) {
    if (m.fallAt !== null && m.upAt === null) return;
    m.fallAt = this.pt;
    m.upAt = null;
    m.landed = false;
    if (sound) this.snd('fall');
  }

  getUp(m) {
    if (m.fallAt === null || m.upAt !== null) return;
    m.upAt = this.pt;
  }

  setEmote(m, e, until) { m.emote = e; m.emoteUntil = until; }

  // Custom one-shot sounds (built from the engine's synth voices).
  snd(name) {
    const a = audio;
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime + 0.005;
    try {
      if (name === 'doon') {
        a.tone(98, t, 0.5, { wave: 'square', vol: 0.08, slideTo: 42 });
        a.tone(196, t, 0.3, { wave: 'triangle', vol: 0.14, slideTo: 80 });
        a.noise(t, 0.45, { vol: 0.2, filter: 'lowpass', freq: 380 });
        for (const f of [523, 659, 784]) a.tone(f, t, 0.2, { wave: 'sawtooth', vol: 0.025 });
      } else if (name === 'fall') {
        a.tone(1300, t, 0.13, { wave: 'sine', vol: 0.07, slideTo: 260 });
        a.noise(t + 0.11, 0.14, { vol: 0.13, filter: 'lowpass', freq: 650 });
      } else if (name === 'shiin') {
        a.tone(1568, t, 0.6, { wave: 'sine', vol: 0.025 });
        for (let i = 0; i < 6; i++) a.tone(4200, t + 0.25 + i * 0.09 + (i > 2 ? 0.35 : 0), 0.03, { wave: 'sine', vol: 0.03 });
      } else if (name === 'crow') {
        a.tone(820, t, 0.2, { wave: 'sawtooth', vol: 0.035, slideTo: 540 });
        a.tone(800, t + 0.32, 0.24, { wave: 'sawtooth', vol: 0.035, slideTo: 500 });
      }
    } catch (e) { /* audio is best-effort */ }
  }

  // ---------------------------------------------------------------- drawing
  // shop sign + noren text (opts.shop / opts.noren; the 新喜劇 theatre's own set by default there)
  signs() {
    if (!this._signs) {
      const theatre = !!(this.g && this.g.map && this.g.map.placeId === 'shinkigeki');
      this._signs = {
        shop: String(this.opts.shop || (theatre ? 'うどん まんぷく亭' : 'めし処 こけ屋')),
        noren: String(this.opts.noren || (theatre ? 'うどん' : 'めし')),
      };
    }
    return this._signs;
  }

  drawSigns(ctx) {
    const { shop, noren } = this.signs();
    let size = 20;
    while (size > 14 && measure(ctx, shop, size) > 184) size--;
    text(ctx, shop, CX, 69 + Math.floor((20 - size) / 2), { size, align: 'center', color: '#fff3c4', outline: '#2a1a0c' });
    let ns = 18;
    while (ns > 12 && measure(ctx, noren, ns) > 104) ns--;
    text(ctx, noren, CX, 100 + Math.floor((18 - ns) / 2), { size: ns, align: 'center', color: '#ffffff', shadow: '#1c2f5c' });
  }

  drawBackground(ctx) {
    ctx.drawImage(stageCache || buildStage(), 0, 0);
    this.drawSigns(ctx);
    this.drawLanterns(ctx, 0);
    ctx.drawImage(coneCache || buildCone(), 0, 0);
    this.drawAudience(ctx, false);
  }

  drawLanterns(ctx, t) {
    const R = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    for (const [i, lx] of [[0, 206], [1, 434]]) {
      const sway = Math.round(Math.sin(t / 40 + i * 2) * 2);
      const x = lx + sway;
      R(lx, 62, 2, 20, '#2a1a0c');
      // top cap
      R(x - 9, 82, 20, 6, '#14161c');
      R(x - 8, 83, 18, 2, '#3a3e4a');
      // body (paper over ribs), lit from the top-left
      R(x - 12, 88, 26, 38, '#9a1f24');
      R(x - 14, 92, 30, 30, '#9a1f24');
      R(x - 11, 88, 22, 38, '#d62f2f');
      R(x - 13, 92, 24, 30, '#d62f2f');
      R(x - 10, 90, 4, 34, '#ff5d6c');
      R(x - 9, 92, 2, 8, '#ffb0b0');
      for (const y of [93, 99, 105, 111, 117]) { R(x - 13, y, 28, 1, '#9a1f24'); R(x - 11, y + 1, 6, 1, '#ff7a84'); }
      // a big 「笑」-ish mark would be too busy: a gold band instead
      R(x - 14, 106, 30, 2, '#e8c43a');
      R(x - 14, 106, 8, 1, '#fff0a0');
      // bottom cap + tassel
      R(x - 9, 126, 20, 6, '#14161c');
      R(x - 8, 127, 18, 2, '#3a3e4a');
      R(x, 132, 2, 4, '#e8c43a');
      R(x - 2, 136, 6, 6, '#e8c43a');
      R(x - 2, 136, 2, 6, '#fff0a0');
    }
  }

  drawAudience(ctx, laughing) {
    const cache = audCache || buildAudience();
    const t = this.rt || 0;
    const v = laughing ? 1 + (Math.floor(t / 5) % 2) : 0;
    ctx.drawImage(cache[v], 0, AUD_Y);
  }

  drawPlay(ctx) {
    const r = this.round;
    const t = this.rt || 0;
    ctx.drawImage(stageCache || buildStage(), 0, 0);
    this.drawSigns(ctx);
    this.drawLanterns(ctx, this.pt);
    // spotlight on the lead
    ctx.drawImage(coneCache || buildCone(), 0, 0);

    if (this.cast) this.drawCast(ctx, r, t);
    for (const p of this.parts || []) {
      ctx.globalAlpha = clamp(1 - p.life / p.max, 0, 1) * 0.9;
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.life < 6) {
        ctx.fillStyle = '#fff6e0';
        ctx.fillRect(x - 1, y - 1, 3, 3);
      } else {
        ctx.fillStyle = (p.k || 0) % 2 ? '#d8c8a8' : '#efe3c8';
        ctx.fillRect(x - 2, y - 1, 5, 3);
        ctx.fillRect(x - 1, y - 2, 3, 5);
      }
    }
    ctx.globalAlpha = 1;

    if (r) {
      if (t > 4 && t < r.tS - 2) this.drawRoundCard(ctx, t);
      this.drawBubble(ctx, r, t);
    }
    for (const f of this.overlays || []) f();
    this.drawAudience(ctx, r && t > (r.tC || 0) && t < this.laughUntil);
    if (r) this.drawCueFx(ctx, r, t);
    this.drawHud(ctx);
  }

  drawRoundCard(ctx, t) {
    const last = this.ri === this.total - 1;
    const label = last ? 'ラストのネタ！' : `ネタ その${this.ri + 1}`;
    const k = Math.min(1, t / 6);
    const w = last ? 236 : 200, h = 44;
    const x = CX - w / 2;
    const y = Math.round(106 - (1 - k) * 16);
    ctx.globalAlpha = k;
    pxBox(ctx, x + 4, y + 4, w, h, 'rgba(10,6,16,0.55)', [2, 1]);
    pxBox(ctx, x - 2, y - 2, w + 4, h + 4, INK, [3, 1]);
    pxBox(ctx, x, y, w, h, '#fbf3dc', [2, 1]);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
    ctx.fillStyle = '#d62f2f';
    ctx.fillRect(x + 1, y + 3, w - 2, 4);
    ctx.fillRect(x + 1, y + h - 7, w - 2, 4);
    ctx.fillStyle = '#ff6a6a';
    ctx.fillRect(x + 1, y + 3, w - 2, 1);
    // little red diamonds on both sides of the label
    for (const dx of [16, w - 16]) {
      for (let i = 0; i < 4; i++) ctx.fillRect(x + dx - i, y + h / 2 - 3 + i, i * 2 + 1, 1);
      for (let i = 0; i < 3; i++) ctx.fillRect(x + dx - 2 + i, y + h / 2 + 1 + i, 5 - i * 2, 1);
    }
    text(ctx, label, CX, y + 12, { size: 20, align: 'center', color: INK, shadow: null });
    ctx.globalAlpha = 1;
  }

  // Character pose: rotation (0 = standing, ±90° = lying), hop, frame.
  poseOf(m) {
    const pt = this.pt;
    if (m.fallAt === null) return { a: 0, hop: 0, lying: 0, frame: 0 };
    if (m.upAt === null) {
      const p = clamp((pt - m.fallAt) / 7, 0, 1);
      const e = 1 - (1 - p) * (1 - p);
      const since = pt - m.fallAt;
      const flail = since > 8 && since < 46 ? 1 + (Math.floor(since / 4) % 2) : 0;
      return { a: e * Math.PI / 2, hop: Math.sin(p * Math.PI) * 12, lying: e, frame: flail };
    }
    const q = clamp((pt - m.upAt) / 10, 0, 1);
    if (q >= 1) return { a: 0, hop: 0, lying: 0, frame: 0 };
    return { a: (1 - q) * Math.PI / 2, hop: Math.sin(q * Math.PI) * 6, lying: 1 - q, frame: 0 };
  }

  drawCast(ctx, r, t) {
    const talking = r && ((t >= r.tS && t < r.tSE) || (t >= r.tG && t < r.tGE));
    const realCue = r && !r.fake && t >= r.tC;
    this.overlays = [];
    const order = this.cast.filter((m) => !m.player).concat(this.player);
    for (const m of order) {
      const ps = this.poseOf(m);
      const sheet = charSheetHD(m.look);
      let dir = 'down';
      if (ps.lying === 0 && !m.lead) {
        // listen to the lead; face the audience once the scene has played out
        dir = r && t >= r.tS && t < r.tC + 20 ? (m.side < 0 ? 'right' : 'left') : 'down';
      }
      let bob = 0;
      if (m.lead) {
        if (talking) bob = (Math.floor(t / 6) % 2) * 2;
        if (realCue && t - r.tC < 12) bob = Math.round(Math.sin(((t - r.tC) / 12) * Math.PI) * 12);
      }
      const lx = Math.round(m.x - m.side * LIE_SHIFT * ps.lying);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      if (ps.lying > 0.5) {
        const sx = m.side > 0 ? lx : lx - CH;
        ctx.fillRect(sx + 4, FOOT - 3, CH - 4, 5);
        ctx.fillRect(sx + 8, FOOT + 2, CH - 12, 2);
      } else {
        const sw = m.lead && bob > 4 ? 14 : 20;
        ctx.fillRect(m.x - sw, FOOT - 3, sw * 2, 5);
        ctx.fillRect(m.x - sw + 5, FOOT + 2, sw * 2 - 10, 2);
      }
      const img = sheet[dir][ps.frame] || sheet[dir][0];
      ctx.save();
      ctx.translate(lx, Math.round(FOOT - ps.hop - (CW / 2) * Math.sin(ps.a) - bob));
      if (ps.a) ctx.rotate((m.side || 1) * ps.a);
      ctx.drawImage(img, -CW / 2, -CH, CW, CH);
      ctx.restore();

      // the lead's pose sparkles after a real gag lands
      if (m.lead && realCue && t - r.tC < 40) {
        const k = t - r.tC;
        for (let i = 0; i < 4; i++) {
          const ang = k / 6 + i * (Math.PI / 2);
          this.sparkleAt(ctx, m.x + Math.cos(ang) * 46, FOOT - 56 + Math.sin(ang) * 32, (k + i) % 8 < 4 ? 6 : 4, '#fff6a8');
        }
      }

      // head position (for markers & emotes)
      const hx = ps.lying > 0.5 ? lx + m.side * 64 : m.x;
      const hy = ps.lying > 0.5 ? FOOT - 68 : FOOT - 90 - bob;
      const emote = m.emote && t < m.emoteUntil ? m.emote : null;
      if (emote) this.overlays.push(() => this.drawEmote(ctx, hx, hy, emote, t));
      // "あなた" marker (hidden while a judgement popup floats there, and mid-fall)
      if (m.player && this.pt - this.judgeAt > 46 && (ps.lying === 0 || ps.lying === 1) && (!emote || emote === 'sweat')) {
        this.overlays.push(() => {
          const blink = Math.floor(this.pt / 16) % 2;
          const my = hy - 6;
          text(ctx, 'あなた', hx, my - 26, { size: 14, align: 'center', color: COLORS.pink, outline: INK });
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = INK;
            ctx.fillRect(hx - 6 + i, my - 6 + blink * 2 + i, 13 - i * 2, 1);
          }
          ctx.fillStyle = INK;
          ctx.fillRect(hx - 1, my + blink * 2, 3, 1);
          ctx.fillStyle = COLORS.pink;
          for (let i = 0; i < 5; i++) ctx.fillRect(hx - 4 + i, my - 5 + blink * 2 + i, 9 - i * 2, 1);
          ctx.fillStyle = '#ffc0dc';
          ctx.fillRect(hx - 4, my - 5 + blink * 2, 3, 1);
        });
      }
    }
  }

  sparkleAt(ctx, x, y, s, col) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = col;
    ctx.fillRect(x - s, y, s * 2 + 2, 2);
    ctx.fillRect(x, y - s, 2, s * 2 + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y, 4, 2);
    ctx.fillRect(x, y - 1, 2, 4);
  }

  drawEmote(ctx, x, y, e, t) {
    x = Math.round(x); y = Math.round(y);
    if (e === 'sweat') {
      const dy = (Math.floor(t / 10) % 3) * 2;
      const sx = x + 20, sy = y + 8 + dy;
      ctx.fillStyle = '#1c4a7a';
      ctx.fillRect(sx + 2, sy - 1, 2, 2);
      ctx.fillRect(sx + 1, sy + 1, 4, 2);
      ctx.fillRect(sx, sy + 3, 6, 5);
      ctx.fillRect(sx + 1, sy + 8, 4, 1);
      ctx.fillStyle = '#5fd7ff';
      ctx.fillRect(sx + 2, sy, 2, 2);
      ctx.fillRect(sx + 1, sy + 2, 4, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx + 2, sy + 3, 1, 3);
      return;
    }
    const w = e.length > 1 ? 44 : 36, h = 30;
    const bx = x - w / 2, by = y - 36;
    pxBox(ctx, bx - 2, by - 2, w + 4, h + 4, INK, [3, 1]);
    pxBox(ctx, bx, by, w, h, '#ffffff', [2, 1]);
    ctx.fillStyle = '#e4e6f0';
    ctx.fillRect(bx + 2, by + h - 3, w - 4, 2);
    // tail
    ctx.fillStyle = INK;
    ctx.fillRect(x - 4, by + h + 2, 9, 2);
    ctx.fillRect(x - 2, by + h + 4, 5, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, by + h, 5, 2);
    ctx.fillRect(x - 1, by + h + 2, 3, 2);
    text(ctx, e, x, by + 6, { size: 18, align: 'center', color: e === '!?' ? '#d62f2f' : INK, shadow: null });
  }

  drawBubble(ctx, r, t) {
    let str, t0, gag = false;
    if (t >= r.tS && t < r.tG && r.setup) { str = r.setup; t0 = r.tS; }
    else if (t >= r.tG && t < r.tC) { str = r.cue; t0 = r.tG; gag = true; }
    else return;
    let size = 18, lh = 24;
    let lines = wrap(ctx, str, 380, size);
    if (lines.length > 2) { size = 16; lh = 20; lines = wrap(ctx, str, 400, size).slice(0, 3); }
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, measure(ctx, l, size));
    const w = clamp(Math.ceil(maxW) + 44, 240, 470);
    const h = 24 + lines.length * lh;
    const x = Math.round(CX - w / 2);
    const y = gag ? 96 : 100;
    const bg = gag ? '#fff6c8' : '#ffffff';
    const shadeCol = gag ? '#f0e2a0' : '#e4e6f0';
    // drop shadow + body with stepped corners, 2 px ink border
    pxBox(ctx, x + 2, y + 4, w + 4, h + 4, 'rgba(10,6,16,0.35)', [4, 2, 1, 1]);
    pxBox(ctx, x - 2, y - 2, w + 4, h + 4, INK, [4, 2, 1, 1]);
    pxBox(ctx, x, y, w, h, bg, [3, 1]);
    ctx.fillStyle = shadeCol;
    ctx.fillRect(x + 3, y + h - 3, w - 6, 2);
    ctx.fillRect(x + w - 3, y + 3, 2, h - 6);
    // tail toward the lead's head
    const by = y + h;
    const tipY = FOOT - 86;
    for (let yy = by + 2; yy < tipY; yy++) {
      const k = (yy - by) / (tipY - by);
      const half = Math.max(0, Math.round(11 * (1 - k)));
      const cx = Math.round(CX - 8 + k * 8);
      ctx.fillStyle = INK;
      ctx.fillRect(cx - half - 2, yy, half * 2 + 5, 1);
      if (half > 0) { ctx.fillStyle = bg; ctx.fillRect(cx - half, yy, half * 2 + 1, 1); }
    }
    ctx.fillStyle = bg;
    ctx.fillRect(CX - 20, by - 3, 25, 5);
    // name tag
    pxBox(ctx, x + 8, y - 16, 56, 24, INK, [2, 1]);
    pxBox(ctx, x + 10, y - 14, 52, 20, '#e8873a', [1]);
    ctx.fillStyle = '#ffb070';
    ctx.fillRect(x + 11, y - 14, 50, 2);
    ctx.fillStyle = '#b8601e';
    ctx.fillRect(x + 11, y + 4, 50, 2);
    text(ctx, '座長', x + 36, y - 12, { size: 14, align: 'center', color: '#ffffff', shadow: '#8a4010' });
    // typed text
    let n = Math.floor((t - t0) / this.spd) + 1;
    lines.forEach((l, i) => {
      const cs = chars(l);
      const s = cs.slice(0, Math.max(0, n)).join('');
      n -= cs.length;
      if (s) text(ctx, s, x + 22, y + 13 + i * lh, { size, color: INK, shadow: null });
    });
    if (gag) {
      // a red 「！」 badge on the corner: this is the punch line
      const bx = x + w - 8, by2 = y - 2;
      fillDisc(ctx, bx, by2, 14, INK);
      fillDisc(ctx, bx, by2, 12, '#d62f2f');
      fillDisc(ctx, bx - 2, by2 - 2, 8, '#ec4a4a');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - 2, by2 - 8, 5, 10);
      ctx.fillRect(bx - 1, by2 + 2, 3, 1);
      ctx.fillRect(bx - 2, by2 + 5, 5, 4);
      ctx.fillStyle = '#ffd8d8';
      ctx.fillRect(bx + 2, by2 - 8, 1, 9);
    }
  }

  drawCueFx(ctx, r, t) {
    if (t < r.tC) return;
    const k = t - r.tC;
    if (!r.fake) {
      if (k > 44) return;
      // white flash
      const fl = Math.max(0, 0.6 - k * 0.075);
      if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, SW, SH); }
      const fade = k > 34 ? 1 - (k - 34) / 10 : 1;
      ctx.globalAlpha = clamp(fade, 0, 1);
      // starburst with an ink outline
      const cx = CX, cy = 104;
      ctx.fillStyle = INK;
      this.burst(ctx, cx, cy, 66, 37, 14, k / 30);
      ctx.fillStyle = '#ff8a3d';
      this.burst(ctx, cx, cy, 62, 34, 14, k / 30);
      ctx.fillStyle = '#ffd23f';
      this.burst(ctx, cx, cy, 52, 28, 14, k / 30 + 0.1);
      ctx.fillStyle = '#fff2a0';
      this.burst(ctx, cx - 6, cy - 4, 30, 18, 14, k / 30 + 0.1);
      const size = k < 4 ? 80 : 64;
      this.bigText(ctx, 'ドーン！', cx, cy - size / 2, size, '#ffffff', '#d62f2f');
      ctx.globalAlpha = 1;
    } else {
      if (t > r.tUp) return;
      ctx.fillStyle = `rgba(16,24,72,${Math.min(0.35, k * 0.04)})`;
      ctx.fillRect(0, 0, SW, SH);
      const a = clamp(k / 8, 0, 1) * (t > r.tUp - 10 ? (r.tUp - t) / 10 : 1);
      ctx.globalAlpha = clamp(a, 0, 1);
      this.bigText(ctx, 'シーン…', CX - 92, 74 + Math.min(12, Math.floor(k * 0.18)), 48, '#dfe9ff', '#2a3a7a');
      ctx.globalAlpha = 1;
      // a crow flies across
      const cx = Math.round(SW + 32 - k * 6.4);
      const cy = Math.round(66 + Math.sin(k / 6) * 6);
      if (cx > -40) {
        this.drawCrow(ctx, cx, cy, Math.floor(k / 6) % 2);
        if (k >= 12 && k < 36) text(ctx, 'カァー', cx + 16, cy - 42, { size: 16, color: '#dfe9ff', outline: '#14182e' });
      }
    }
  }

  burst(ctx, cx, cy, rOut, rIn, n, rot) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 ? rIn : rOut * (i % 4 === 0 ? 1 : 0.85);
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * rr * 3, cy + Math.sin(a) * rr * 1.5]);
    }
    fillPoly(ctx, pts);
  }

  bigText(ctx, s, x, y, size, fill, edge) {
    const e = size >= 64 ? 4 : 3;
    for (const [dx, dy] of [[-e, 0], [e, 0], [0, -e], [0, e], [-e, -e], [e, -e], [-e, e], [e, e], [0, e + 2], [e, e + 2], [-e, e + 2]]) {
      text(ctx, s, x + dx, y + dy, { size, align: 'center', color: edge, shadow: null });
    }
    text(ctx, s, x, y, { size, align: 'center', color: fill, outline: INK });
  }

  drawCrow(ctx, x, y, f) {
    // 2 px per art pixel, like the cast
    const img = (crowCache || buildCrow())[f ? 1 : 0];
    ctx.drawImage(img, Math.round(x) - 8, Math.round(y) - 18, 60, 36);
  }

  drawHud(ctx) {
    const total = this.total || 0;
    if (!total) return;
    const cur = clamp(this.ri, 0, total - 1);
    text(ctx, `ネタ ${cur + 1}/${total}`, 48, 2, { size: 16, color: '#ffffff', outline: '#3a0a10' });
    const x0 = CX - (total - 1) * 12;
    for (let i = 0; i < total; i++) {
      const x = x0 + i * 24, y = 11;
      const res = this.results[i];
      pxBox(ctx, x - 9, y - 9, 18, 18, '#3a0a10', [3, 1]);
      pxBox(ctx, x - 7, y - 7, 14, 14, res ? DOT_COLORS[res] : '#7a2a34', [2, 1]);
      ctx.fillStyle = res ? DOT_LIGHT[res] : '#94404a';
      ctx.fillRect(x - 5, y - 6, 5, 2);
      ctx.fillRect(x - 6, y - 5, 2, 4);
      if (i === cur && !res && Math.floor(this.pt / 12) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    const s = this.realPts && this.realPts.length ? String(this.currentScore()) : '--';
    text(ctx, `スコア ${s}`, SW - 48, 2, { size: 16, align: 'right', color: '#ffd23f', outline: '#3a0a10' });
    if (this.combo >= 2) text(ctx, `${this.combo}コンボ`, SW - 48, 28, { size: 14, align: 'right', color: COLORS.pink, outline: INK });
    // instruction strip
    ctx.fillStyle = 'rgba(8,6,14,0.72)';
    ctx.fillRect(0, SH - 20, SW, 20);
    text(ctx, '「ドーン！」でA！　「シーン…」はガマン', CX, SH - 18, { size: 14, align: 'center', color: '#ffffff', shadow: null });
  }
}

registerMinigame('zukko', Zukko);
