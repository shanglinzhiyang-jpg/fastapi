// コマンド演技 — 殺陣・変身ポーズ・怪獣・感情演技・ダンスのコマンド入力 (skill: engi)
//
//   await g.minigame('command', { theme: 'tate', difficulty: 3 })
//
// opts
//   theme   'tate'    時代劇の殺陣（江戸の町で悪党を斬り伏せる）
//           'henshin' 特撮ヒーロー（変身ポーズ → 戦闘員とのアクション → 必殺技）
//           'kaiju'   怪獣のスーツアクター（ミニチュアの街のビルを壊す）
//           'acting'  ドラマの撮影（監督のかけ声どおりに 笑う・泣く・怒る… を演じる）
//           'dance'   ダンスステージ
//           default 'tate' (unknown themes fall back to it)
//   rounds  number of rounds (default 5..8 by difficulty)
//   calls   optional custom banner lines, one per round (string[])
//   scenes  acting only: custom scenes [{ title, beats }] where beats is a string of
//           W(笑う) N(泣く) O(怒る) D(驚く) K(キメ) T(照れる), e.g. 'DWTKDNOW'
//
// Each round shows 3..8 commands (← ↑ → ↓ A B). Input them from left to right before the
// time bar runs out. A wrong button costs 12% of the round's time. Clearing a round earns
// 75% of its share plus up to 25% for speed (full bonus with ≥40% of the time left), minus
// 12% per mistake. Running out of time earns at most 30% (for the commands already done).

import { Minigame, registerMinigame, text, panel, rect, bar, COLORS, sparkle } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheet, LOOKS, SKIN } from '../engine/sprites.js';
import { audio, registerSong } from '../engine/audio.js';
import { makeCanvas, mulberry32, shuffle, clamp, mix, shade, hash2, W, H } from '../engine/util.js';

const INK = '#22202a';
const KEYS = ['up', 'down', 'left', 'right', 'a', 'b'];
const ARROWS = ['up', 'down', 'left', 'right'];
const CMD_COLOR = { up: '#ffd23f', down: '#5ee07a', left: '#5fd7ff', right: '#ff7eb6', a: '#ff5d6c', b: '#7f8cff' };

// ------------------------------------------------------------------ tuning
const DIFF = {
  rounds: [5, 6, 6, 7, 8],
  len: [[3, 4], [3, 5], [4, 6], [5, 7], [6, 8]],
  base: [1.5, 1.25, 1.05, 0.9, 0.8], // seconds per round …
  per: [0.95, 0.78, 0.64, 0.54, 0.46], // … plus seconds per command
};
const PENALTY = 0.12; // share of the round's time lost per mistake
const SPEED_FULL = 0.4; // time left (fraction) needed for the full speed bonus
const SLIDE = 16; // frames for the command chips to slide in
const RESULT_LEN = 66;
const CLOSE_LEN = 120;

// ------------------------------------------------------------------ layout
const CHIP = 26, GAP = 4, CHIP_Y = 164;
const TIMER_Y = 204, LEGEND_Y = 213;

// ------------------------------------------------------------------ content
// Acting: emotions mapped to the buttons.
const EMO = {
  up: { name: '笑う', kanji: '笑', call: '笑って！', say: 'あはは！' },
  down: { name: '泣く', kanji: '泣', call: '泣いて！', say: 'うぅっ…' },
  left: { name: '怒る', kanji: '怒', call: '怒って！', say: 'なにっ！' },
  right: { name: '驚く', kanji: '驚', call: '驚いて！', say: 'ええっ！？' },
  a: { name: 'キメ', kanji: '決', call: 'キメ顔！', say: 'フッ…' },
  b: { name: '照れ', kanji: '照', call: '照れて！', say: 'えへへ…' },
};
const BEAT_KEY = { W: 'up', N: 'down', O: 'left', D: 'right', K: 'a', T: 'b' };
const CO_REACT = { up: '♪', down: '…', left: '！？', right: '！', a: '♥', b: '♪' };
// Each scene is a little story told in 8 emotional beats (shorter rounds use the first beats).
const SCENES = [
  { title: '宝くじが当たった！', beats: 'DWTKDNOW' },
  { title: '初めてのデート', beats: 'TWDTKNWT' },
  { title: '名探偵のなぞとき', beats: 'DKOWDNKW' },
  { title: '親友とのケンカ', beats: 'ONDNTWKW' },
  { title: '卒業式の日', beats: 'NWNTKDWN' },
  { title: 'テストで0点！', beats: 'DNOTNWKD' },
  { title: '刑事ドラマの取り調べ', beats: 'OKDONKWK' },
  { title: '家族との再会', beats: 'DNWNTWKN' },
  { title: 'ライバルとの対決', beats: 'KODOKWNK' },
  { title: 'サプライズパーティー', beats: 'DWTNWKTW' },
  { title: 'お化け屋敷でデート', beats: 'DNTDOWKT' },
  { title: '料理コンテストの審査', beats: 'TKDWONWK' },
];

const TATE_CALLS = ['悪党ども、かかってこい！', '囲まれた！斬り抜けろ！', '屋根から刺客が！', '一気に片づけるぞ！', '背後にも気をつけろ！', '用心棒のおでましだ！', 'まだまだ来るぞ！'];
const HERO_CALLS = ['戦闘員がおそってきた！', 'ヒーローのアクション！', '囲まれた！切り抜けろ！', 'みんなの声援が力に！', 'ジャンプでかわせ！', 'ヒーローは負けない！'];
const DANCE_CALLS = ['イントロ、いくよ！', 'Aメロのステップ！', 'Bメロ！テンポアップ！', 'サビの振り付け！', '間奏でアピール！', '2番もノリノリで！', 'ラストのサビ！', 'フィニッシュポーズ！'];

const BLD = {
  office: { w: 34, h: 66, name: 'オフィスビル' },
  tower: { w: 40, h: 96, name: '電波塔' },
  dept: { w: 54, h: 46, name: 'デパート' },
  apartment: { w: 40, h: 56, name: 'マンション' },
  factory: { w: 50, h: 34, name: '工場' },
  castle: { w: 50, h: 62, name: 'お城' },
  house: { w: 22, h: 18 },
  shop: { w: 26, h: 22 },
};
const BLD_TARGETS = ['office', 'tower', 'dept', 'apartment', 'factory', 'castle'];

const THEMES = {
  tate: {
    title: '殺陣アクション',
    howto: ['悪党たちを、華麗な殺陣で斬り伏せろ！', '出てきたコマンドを左から順に入力！', '十字キーとA・Bを使うよ', 'ミスは時間が減る。早いほど高得点！'],
    song: 'command_tate', roundName: '立ち回り',
    accent: '#e8b830', chip: '#2a2342', panelBg: '#17122a', panelEdge: '#e8d8a8', bannerBg: '#2a1d3a', bannerFg: '#ffe9a8',
    legend: [[['left', 'right'], '斬る'], [['up'], '跳ぶ'], [['down'], '足払い'], [['a'], '突き'], [['b'], '受け']],
    scale: [659, 698, 880, 988, 1047, 1319, 1397, 1760],
    good: ['成敗！', 'お見事！', '峰打ちでござる！', '一刀両断！'],
    comments: ['見事な殺陣！客席から拍手喝采だ！', '迫力の立ち回り！いい太刀筋だ！', 'まずまずの立ち回り！その調子！', '動きがもたついたかも…稽古あるのみ！', 'まずは稽古からやり直しだ！'],
  },
  henshin: {
    title: '変身ヒーロー',
    howto: ['特撮ヒーローの変身ポーズをキメろ！', '出てきたコマンドを左から順に入力！', '十字キーとA・Bを使うよ', 'ミスは時間が減る。早いほど高得点！'],
    song: 'command_henshin', roundName: 'シーン',
    accent: '#ff5d6c', chip: '#26304e', panelBg: '#121a3a', panelEdge: '#ffffff', bannerBg: '#c0182c', bannerFg: '#ffffff',
    legend: [[['up', 'down', 'left', 'right'], 'ポーズ'], [['a'], 'キメ'], [['b'], 'ため']],
    scale: [523, 659, 784, 1047, 1175, 1319, 1568, 2093],
    comments: ['完璧な変身！子どもたちも大興奮！', 'かっこいい！ヒーローそのものだ！', 'ヒーローらしくなってきた！', 'ポーズがちょっとぎこちない…', '変身失敗…！？特訓だ！'],
  },
  kaiju: {
    title: '怪獣スーツアクター',
    howto: ['怪獣になって、ミニチュアの街で大暴れ！', '出てきたコマンドを左から順に入力！', '十字キーとA・Bを使うよ', 'ミスは時間が減る。早いほど高得点！'],
    song: 'command_kaiju', roundName: 'カット',
    accent: '#5ee07a', chip: '#1c2a2a', panelBg: '#0f1a1c', panelEdge: '#bfe8b0', bannerBg: '#1d3a24', bannerFg: '#d8ffb8',
    legend: [[['down'], 'ふみつけ'], [['up'], 'ほえる'], [['left', 'right'], 'しっぽ'], [['a'], '光線'], [['b'], 'いかく']],
    scale: [262, 311, 349, 392, 415, 523, 622, 698],
    comments: ['大迫力！特撮スタッフも大喜び！', 'ド迫力の暴れっぷり！', 'なかなかの怪獣っぷり！', 'ちょっと迫力不足かも…', 'ミニチュアより自分がこけた…'],
  },
  acting: {
    title: '感情演技',
    howto: ['監督のかけ声どおりに表情を演じよう！', '↑笑う ↓泣く ←怒る →驚く', 'Aキメ顔 B照れる。左から順に入力！', 'ミスは時間が減る。早いほど高得点！'],
    song: 'command_acting', roundName: 'シーン',
    accent: '#ffd23f', chip: '#2a2a34', panelBg: '#141418', panelEdge: '#f0f0f0', bannerBg: '#1a1a22', bannerFg: '#ffffff',
    legend: [[['up'], '笑う'], [['down'], '泣く'], [['left'], '怒る'], [['right'], '驚く'], [['a'], 'キメ'], [['b'], '照れ']],
    scale: [587, 659, 784, 880, 988, 1175, 1319, 1568],
    comments: ['名演技！監督も思わず涙ぐんでいる！', '表情ゆたかな、いいお芝居！', 'いい感じ！感情をもっと大胆に！', 'NGが多かったね…次はがんばろう', '台本を読み直してこよう…'],
  },
  dance: {
    title: 'ダンスステップ',
    howto: ['キラキラのステージで踊ろう！', '出てきたステップを左から順に入力！', '十字キーとA・Bを使うよ', 'ミスは時間が減る。早いほど高得点！'],
    song: 'command_dance', roundName: 'パート',
    accent: '#ff7eb6', chip: '#2c1a4a', panelBg: '#160c2c', panelEdge: '#ffc8e8', bannerBg: '#5a1a6a', bannerFg: '#ffffff',
    legend: [[['left', 'right'], 'ステップ'], [['up'], 'ジャンプ'], [['down'], 'しゃがむ'], [['a'], 'ターン'], [['b'], '拍手']],
    scale: [440, 523, 659, 784, 880, 1047, 1319, 1568],
    good: ['キマった！', 'ナイスステップ！', '最高のノリ！'],
    comments: ['キレッキレ！会場総立ちだ！', 'ノリノリのステップ！', 'リズムに乗れてきた！', 'ステップがちょっと乱れたかも', '足がもつれちゃった…'],
  },
};

// ------------------------------------------------------------------ music
registerSong('command_tate', {
  bpm: 144, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'E5 . F5 . A5 . B5 A5 | C6 - B5 . A5 . F5 . | E5 . F5 A5 B5 . C6 . | B5 - A5 - F5 - E5 . | A5 . B5 . C6 . E6 . | C6 - B5 . A5 . F5 . | E5 . F5 . A5 F5 E5 . | E5 - - - . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'E2 . E3 . E2 . E3 . | A2 . A3 . A2 . A3 . | F2 . F3 . F2 . F3 . | E2 . E3 . B2 . E3 .' },
    { wave: 'drum', vol: 0.11, notes: 'k . . k s . k . | k . k . s s k .' },
  ],
});
registerSong('command_henshin', {
  bpm: 160, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'G4 . C5 . E5 . G5 - | A5 . G5 . E5 . C5 . | F5 . A5 . C6 - A5 . | G5 - - - . . G5 . | A5 . A5 . G5 . E5 . | F5 . F5 . E5 . D5 . | E5 . G5 . C6 . B5 . | C6 - - - . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . C3 G2 C3 . C3 G2 | C3 . C3 G2 C3 . E3 . | F2 . F2 C3 F2 . F2 C3 | G2 . G2 D3 G2 . B2 . | F2 . F2 C3 F2 . F2 C3 | D3 . D3 A2 G2 . G2 D3 | C3 . C3 G2 G2 . G2 B2 | C3 . G2 . C3 . . .' },
    { wave: 'drum', vol: 0.1, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});
registerSong('command_kaiju', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'C4 . . . Eb4 . . . | D4 . . . C4 . . . | G4 . . . Ab4 . G4 . | F4 . Eb4 . D4 - - . | C4 . . . Eb4 . . . | D4 . . . C4 . . . | Ab4 . . . G4 . F4 . | G4 - - - . . . .' },
    { wave: 'triangle', vol: 0.14, notes: 'C2 - - . C2 - Db2 - | C2 - - . Bb1 - - . | C2 - - . C2 - Db2 - | Eb2 - D2 - Db2 - C2 -' },
    { wave: 'drum', vol: 0.12, notes: 'k . . . s . . . | k . k . s . . k' },
  ],
});
registerSong('command_acting', {
  bpm: 116, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'E5 . D5 . C5 . D5 E5 | G5 - E5 . D5 - - . | C5 . D5 . E5 . G5 A5 | G5 - - - . . . . | A5 . G5 . E5 . G5 A5 | C6 - A5 . G5 - - . | E5 . G5 . D5 . E5 C5 | D5 - - - . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | G2 . D3 . G2 . B2 .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h . s . h h' },
  ],
});
registerSong('command_dance', {
  bpm: 128, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'A4 . C5 . E5 . A5 G5 | . E5 . D5 E5 . . . | F5 . E5 . D5 . C5 . | D5 . E5 . G5 - - . | A4 . C5 . E5 . A5 G5 | . E5 . D5 E5 . G5 . | A5 . G5 . E5 . D5 . | E5 - - - . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'A2 A3 A2 A3 A2 A3 A2 A3 | F2 F3 F2 F3 F2 F3 F2 F3 | D2 D3 D2 D3 D2 D3 D2 D3 | E2 E3 E2 E3 E2 E3 G#2 G#3' },
    { wave: 'drum', vol: 0.1, notes: 'k . k . k . k .' },
    { wave: 'drum', vol: 0.07, notes: '. h s h . h s h' },
  ],
});
const DANCE_BEAT = 3600 / 128; // frames per beat

// ------------------------------------------------------------------ pixel helpers
// Scanline polygon fill: crisp pixels, no anti-aliasing.
function fillPoly(ctx, pts, color) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  ctx.fillStyle = color;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
      if (b > a) ctx.fillRect(a, y, b - a, 1);
    }
  }
}

// Outlined polygon (1px INK border) in the current transform.
function polyOut(ctx, pts, color) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) fillPoly(ctx, pts.map(([x, y]) => [x + dx, y + dy]), INK);
  fillPoly(ctx, pts, color);
}

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  rx = Math.max(0, rx); ry = Math.max(1, Math.round(ry));
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (hw > 0) ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
  }
}

function starPts(cx, cy, rx, ry, spikes, inner, rot = 0) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i * Math.PI) / spikes;
    const r = i % 2 ? inner : 1;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
}

// Rounded box with a 1px outline.
function roundBox(ctx, x, y, w, h, fill, edge = INK) {
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x + 2, y, w - 4, h, edge);
  rect(ctx, x, y + 2, w, h - 4, edge);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, edge);
  rect(ctx, x + 2, y + 1, w - 4, h - 2, fill);
  rect(ctx, x + 1, y + 2, w - 2, h - 4, fill);
}

function vgrad(c, x, y, w, h, stops, step = 2) {
  for (let yy = 0; yy < h; yy += step) {
    const f = yy / Math.max(1, h - 1);
    let i = 0;
    while (i < stops.length - 2 && f > stops[i + 1][0]) i++;
    const [f0, c0] = stops[i];
    const [f1, c1] = stops[i + 1];
    c.fillStyle = mix(c0, c1, clamp((f - f0) / (f1 - f0 || 1), 0, 1));
    c.fillRect(x, y + yy, w, Math.min(step, h - yy));
  }
}

// 2px arm (or leg) with a 1px outline from (x0,y0) to (x1,y1), ending in a hand/shoe block.
function limb(ctx, x0, y0, x1, y1, col, hand) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)]);
  ctx.fillStyle = INK;
  for (const [x, y] of pts) ctx.fillRect(x - 1, y - 1, 4, 4);
  ctx.fillStyle = col;
  for (const [x, y] of pts) ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = hand;
  ctx.fillRect(x1, y1, 2, 2);
}

// Katana held in a 2x2 hand at (hx,hy), pointing along (dx,dy) ∈ {-1,0,1}².
function katana(ctx, hx, hy, dx, dy, len) {
  const bx = hx + (dx > 0 ? 2 : dx < 0 ? -1 : 0);
  const by = hy + (dy > 0 ? 2 : dy < 0 ? -1 : 0);
  ctx.fillStyle = '#e8b830';
  if (dy === 0) ctx.fillRect(bx, by - 1, 1, 4);
  else if (dx === 0) ctx.fillRect(bx - 1, by, 4, 1);
  else ctx.fillRect(bx, by, 2, 2);
  for (let i = 1; i <= len; i++) {
    const x = bx + dx * i, y = by + dy * i;
    ctx.fillStyle = '#f4f8ff';
    ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = '#8f9bb0';
    ctx.fillRect(x + (dx === 0 ? 1 : 0), y + (dx === 0 ? 0 : 1), 1, 1);
  }
}

// Text with a thick (2px) outline for big shouts.
function bigText(ctx, str, x, y, size, color, outline = INK) {
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      if ((dx || dy) && Math.abs(dx) + Math.abs(dy) < 4) text(ctx, str, x + dx, y + dy, { size, align: 'center', color: outline, shadow: null });
    }
  }
  text(ctx, str, x, y, { size, align: 'center', color, shadow: null });
}

function shadowAt(ctx, cx, y, rx, ry = 3) {
  ctx.globalAlpha = 0.32;
  fillEllipse(ctx, cx, y, rx, ry, '#000');
  ctx.globalAlpha = 1;
}

const easeIO = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const pickR = (arr, r) => arr[Math.floor(r() * arr.length)];

// The default down-facing sprite with its two hanging arms removed (for raised-arm poses).
const armlessCache = new WeakMap();
function armless(img) {
  let cv = armlessCache.get(img);
  if (cv) return cv;
  let c;
  [cv, c] = makeCanvas(16, 20);
  c.drawImage(img, 0, 0);
  c.clearRect(2, 13, 2, 2);
  c.clearRect(12, 13, 2, 2);
  c.fillStyle = INK;
  c.fillRect(3, 13, 1, 1);
  c.fillRect(12, 13, 1, 1);
  armlessCache.set(img, cv);
  return cv;
}

// Arrow bitmaps (pointing right), rotated for the other directions.
const ARROW_BIG = [
  '.............',
  '......x......',
  '......xx.....',
  '......xxx....',
  '......xxxx...',
  '.xxxxxxxxxx..',
  '.xxxxxxxxxxx.',
  '.xxxxxxxxxx..',
  '......xxxx...',
  '......xxx....',
  '......xx.....',
  '......x......',
  '.............',
];
const ARROW_SMALL = [
  '.........',
  '....x....',
  '....xx...',
  'xxxxxxx..',
  'xxxxxxxx.',
  'xxxxxxx..',
  '....xx...',
  '....x....',
  '.........',
];
const arrowCache = new Map();
function arrowImg(dir, big, color) {
  const key = `${dir}|${big}|${color}`;
  let cv = arrowCache.get(key);
  if (cv) return cv;
  const pat = big ? ARROW_BIG : ARROW_SMALL;
  const n = pat.length;
  let c;
  [cv, c] = makeCanvas(n + 2, n + 2);
  const pts = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (pat[y][x] !== 'x') continue;
      let rx = x, ry = y;
      if (dir === 'left') rx = n - 1 - x;
      else if (dir === 'up') { rx = y; ry = n - 1 - x; }
      else if (dir === 'down') { rx = n - 1 - y; ry = x; }
      pts.push([rx, ry]);
    }
  }
  c.fillStyle = INK;
  for (const [x, y] of pts) c.fillRect(x, y, 3, 3);
  c.fillStyle = color;
  for (const [x, y] of pts) c.fillRect(x + 1, y + 1, 1, 1);
  arrowCache.set(key, cv);
  return cv;
}

// Command icon centered at (cx, cy).
function drawIcon(ctx, key, cx, cy, big = true, dim = false, ink = null) {
  if (key === 'a' || key === 'b') {
    const r = big ? 8 : 5;
    const base = key === 'a' ? (dim ? '#6a4a54' : '#d64161') : (dim ? '#4a4e6a' : '#4157d6');
    fillEllipse(ctx, cx, cy, r + 1, r + 1, INK);
    fillEllipse(ctx, cx, cy, r, r, base);
    if (!dim) fillEllipse(ctx, cx - Math.round(r / 3), cy - Math.round(r / 2), Math.max(1, Math.round(r / 3)), 1, shade(base, 0.4));
    const size = big ? 12 : 10;
    text(ctx, key.toUpperCase(), cx + 1, cy - Math.round(size / 2) - (big ? 0 : 1), { size, align: 'center', color: dim ? '#a8a8b8' : '#ffffff', shadow: null });
    return;
  }
  const img = arrowImg(key, big, ink || (dim ? '#7a7a8a' : '#fff8e0'));
  ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
}

function heroColor(top) {
  if (!top || !/^#[0-9a-f]{6}$/i.test(top)) return '#d62f2f';
  const n = parseInt(top.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  return lum > 0.22 && lum < 0.8 && sat > 0.3 ? top : '#d62f2f';
}

// ------------------------------------------------------------------ the game
class CommandAction extends Minigame {
  static title = 'コマンド演技';
  static howto = ['表示されたコマンドを、左から順に入力！', '十字キーとA・Bを使うよ', 'ミスは時間が減る。早いほど高得点！'];
  static skill = 'engi';
  static bgm = 'command_tate';

  constructor(g, opts = {}) {
    const theme = THEMES[opts.theme] ? opts.theme : 'tate';
    const T = THEMES[theme];
    super(g, opts.howto ? opts : { ...opts, howto: T.howto });
    this.theme = theme;
    this.T = T;
    if (!opts.title) this.title = T.title;
    this.bg = this.renderBg();
  }

  // Each theme has its own BGM; the static one is only the default.
  update(g) {
    if (!this.songSet) {
      this.songSet = true;
      if (this.T.song !== CommandAction.bgm) audio.bgm(this.T.song);
    }
    super.update(g);
  }

  drawBackground(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    rect(ctx, 0, 0, W, H, 'rgba(6,8,20,0.45)');
  }

  hook(name, ...a) {
    const f = this[`${this.theme}_${name}`];
    return f ? f.apply(this, a) : undefined;
  }

  // ---------------------------------------------------------------- setup
  init() {
    const d = this.difficulty - 1;
    this.d = d;
    this.R = this.opts.rounds ? clamp(Math.round(this.opts.rounds), 1, 12) : DIFF.rounds[d];
    const st = this.g.state || {};
    this.look = st.look || LOOKS.player;
    this.parts = [];
    this.sched = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.flash = 0;
    this.shout = null;
    this.banner = null;
    this.grade = null;
    this.pose = { kind: 'idle', t: 0, len: 0 };
    this.poseLog = [];
    this.earned = 0;
    this.shown = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0, mistakes: 0 };
    this.lastSide = 'right';
    this.ri = -1;
    this.cur = null;
    this.walkLen = 0;
    this.cueLen = SLIDE;
    this.rounds = this.buildRounds(d);
    this.hook('setup');
    this.state = 'opening';
    this.st = 0;
    this.openLen = 84;
    this.hook('open');
  }

  buildRounds(d) {
    const [lo, hi] = DIFF.len[d];
    const R = this.R;
    const scenes = this.theme === 'acting' ? this.pickScenes(R) : null;
    const out = [];
    for (let i = 0; i < R; i++) {
      const f = R > 1 ? i / (R - 1) : 1;
      const n0 = Math.round(lo + (hi - lo) * f);
      const seq = scenes ? scenes[i].beats.slice(0, n0) : this.randomSeq(n0, d, i === R - 1);
      const n = seq.length;
      const limit = Math.round(this.ease((DIFF.base[d] + DIFF.per[d] * n) * 60, 0.45));
      out.push({ seq, n, limit, scene: scenes ? scenes[i] : null });
    }
    return out;
  }

  randomSeq(n, d, final) {
    const r = this.rng;
    const mid = d === 0 ? ARROWS : d === 1 ? [...ARROWS, 'b'] : KEYS;
    const seq = [];
    for (let i = 0; i < n; i++) {
      let k = pickR(mid, r);
      for (let tries = 0; tries < 8 && i >= 1 && (k === seq[i - 1] && (i >= 2 && seq[i - 2] === k || r() < 0.5)); tries++) k = pickR(mid, r);
      seq.push(k);
    }
    // finish on A (キメ) at low difficulty, on the final round, and often otherwise
    if (d <= 1 || final || r() < 0.5) seq[n - 1] = 'a';
    if (n >= 3 && seq[n - 1] === 'a' && seq[n - 2] === 'a' && seq[n - 3] === 'a') seq[n - 2] = pickR(ARROWS, r);
    return seq;
  }

  pickScenes(R) {
    let list = [];
    if (Array.isArray(this.opts.scenes)) {
      for (const s of this.opts.scenes) {
        if (!s) continue;
        const raw = Array.isArray(s.beats) ? s.beats : Array.from(String(s.beats || ''));
        const beats = raw.map((b) => (KEYS.includes(b) ? b : BEAT_KEY[String(b).toUpperCase()])).filter(Boolean);
        if (beats.length) list.push({ title: String(s.title || '特別なシーン'), beats });
      }
    }
    const builtin = shuffle(SCENES, this.rng).map((s) => ({ title: s.title, beats: Array.from(s.beats).map((b) => BEAT_KEY[b]) }));
    while (list.length < R) list.push(builtin[list.length % builtin.length]);
    return list.slice(0, R);
  }

  // ---------------------------------------------------------------- flow
  later(frames, fn) { this.sched.push({ at: this.pt + frames, fn }); }

  setState(s) { this.state = s; this.st = 0; }

  setPose(kind, len = 20) {
    this.pose = { kind, t: 0, len };
    this.poseLog.push({ kind, at: this.pt, len });
    if (this.poseLog.length > 16) this.poseLog.shift();
  }

  // The pose the player had `delay` frames ago (backup dancers copy it).
  poseAgo(delay) {
    const now = this.pt - delay;
    for (let i = this.poseLog.length - 1; i >= 0; i--) {
      const p = this.poseLog[i];
      if (p.at <= now) return now - p.at <= p.len ? { kind: p.kind, t: now - p.at } : { kind: 'idle', t: 0 };
    }
    return { kind: 'idle', t: 0 };
  }

  shake(frames, mag) {
    this.shakeT = Math.max(this.shakeT, frames);
    this.shakeMag = Math.max(mag, this.shakeT > 0 ? this.shakeMag * 0.5 : 0);
  }

  doShout(str, color = '#ffe680', size = 24, len = 56) {
    this.shout = { str, color, size, t: 0, len };
  }

  spawn(p) {
    this.parts.push({ t: 0, life: 30, vx: 0, vy: 0, layer: 'front', ...p });
  }

  callFor(i) {
    const c = this.opts.calls;
    if (Array.isArray(c) && c[i]) return String(c[i]);
    return this.hook('call', i) || 'コマンドを入力！';
  }

  startRound(i) {
    this.ri = i;
    const r = this.rounds[i];
    this.cur = { ...r, idx: 0, mistakes: 0, left: r.limit, missT: 0, hitAt: [], endP: 0 };
    this.walkLen = this.hook('walkLen', i) ?? 8;
    this.cueLen = this.walkLen + SLIDE;
    this.grade = null;
    this.setState('cue');
    this.hook('round', i);
    this.banner = { text: this.callFor(i), t: 0 };
  }

  updatePlay(inp) {
    this.st++;
    const due = this.sched.filter((e) => e.at <= this.pt);
    if (due.length) {
      this.sched = this.sched.filter((e) => e.at > this.pt);
      for (const e of due) e.fn();
    }
    this.tick();
    switch (this.state) {
      case 'opening':
        if (this.st >= this.openLen) this.startRound(0);
        break;
      case 'cue':
        if (this.st >= this.cueLen) {
          this.setState('input');
          this.hook('go');
        }
        break;
      case 'input':
        this.updateInput(inp);
        break;
      case 'clear':
      case 'fail':
        if (this.st >= RESULT_LEN) {
          if (this.ri + 1 < this.R) this.startRound(this.ri + 1);
          else this.startClosing();
        }
        break;
      case 'closing':
        if (this.st >= CLOSE_LEN) {
          this.setState('done');
          this.end(this.finalScore(), this.comment());
        }
        break;
      default:
        break;
    }
  }

  updateInput(inp) {
    const c = this.cur;
    c.left--;
    for (const k of KEYS) {
      if (c.idx >= c.n) break;
      if (!inp.pressed(k)) continue;
      if (k === c.seq[c.idx]) this.onHit(k);
      else this.onMistake(k);
    }
    if (c.idx >= c.n) this.onClear();
    else if (c.left <= 0) this.onTimeout();
  }

  onHit(k) {
    const c = this.cur;
    c.hitAt[c.idx] = this.pt;
    c.idx++;
    this.note(c.idx - 1);
    this.hook('hit', k, c.idx - 1);
  }

  onMistake(k) {
    const c = this.cur;
    c.mistakes++;
    this.counts.mistakes++;
    c.left = Math.max(0, c.left - Math.round(c.limit * PENALTY));
    c.missT = 14;
    this.combo = 0;
    this.g.sfx('buzz');
    const x = this.chipX(c.idx) + CHIP / 2;
    this.popup('ミス！', x, CHIP_Y - 14, COLORS.bad, 10);
    this.hook('miss', k);
  }

  onClear() {
    const c = this.cur;
    const leftFrac = clamp(c.left / c.limit, 0, 1);
    c.endP = 1 - leftFrac;
    const sc = clamp(0.75 + 0.25 * clamp(leftFrac / SPEED_FULL, 0, 1) - 0.12 * c.mistakes, 0.3, 1);
    const grade = c.mistakes === 0 && leftFrac >= SPEED_FULL ? 'PERFECT' : sc >= 0.85 ? 'GREAT' : 'GOOD';
    this.earned += sc;
    this.counts[grade.toLowerCase()]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const col = grade === 'PERFECT' ? COLORS.accent : grade === 'GREAT' ? COLORS.pink : COLORS.good;
    this.grade = { text: grade + '!', color: col, pts: Math.round((sc * 100) / this.R), t: 0 };
    this.setState('clear');
    this.hook('clear', grade);
  }

  onTimeout() {
    const c = this.cur;
    c.endP = 1;
    const sc = clamp((0.3 * c.idx) / c.n - 0.05 * c.mistakes, 0, 0.3);
    this.earned += sc;
    this.counts.miss++;
    this.combo = 0;
    this.grade = { text: 'タイムアップ…', color: COLORS.dim, pts: Math.round((sc * 100) / this.R), t: 0 };
    this.g.sfx('cancel');
    this.setState('fail');
    this.hook('fail');
  }

  startClosing() {
    this.setState('closing');
    this.cur = null;
    this.banner = null;
    this.grade = null;
    this.hook('close', this.finalScore() >= 55);
  }

  finalScore() { return clamp((this.earned / this.R) * 100, 0, 100); }

  comment() {
    const s = this.finalScore();
    const c = this.T.comments;
    return s >= 90 ? c[0] : s >= 75 ? c[1] : s >= 55 ? c[2] : s >= 35 ? c[3] : c[4];
  }

  tick() {
    this.pose.t++;
    if (this.pose.len && this.pose.t > this.pose.len) this.pose = { kind: 'idle', t: 0, len: 0 };
    if (this.shakeT > 0) this.shakeT--;
    if (this.flash > 0) this.flash--;
    if (this.shout) this.shout.t++;
    if (this.banner) this.banner.t++;
    if (this.grade) this.grade.t++;
    if (this.cur && this.cur.missT > 0) this.cur.missT--;
    for (const p of this.parts) {
      p.t++;
      p.x += p.vx;
      p.y += p.vy;
      if (p.g) p.vy += p.g;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    this.shown += (this.earned / this.R - this.shown) * 0.1;
    this.hook('tick');
  }

  // ---------------------------------------------------------------- sound
  note(i) {
    if (!audio.ctx || audio.muted) return;
    const sc = this.T.scale;
    audio.tone(sc[Math.min(i, sc.length - 1)], audio.ctx.currentTime + 0.005, 0.08, { wave: this.theme === 'kaiju' ? 'triangle' : 'square', vol: this.theme === 'kaiju' ? 0.1 : 0.045 });
  }

  snd(name) {
    const a = audio;
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime + 0.005;
    switch (name) {
      case 'clang': a.tone(1760, t, 0.05, { wave: 'square', vol: 0.05 }); a.tone(2637, t + 0.02, 0.14, { wave: 'triangle', vol: 0.06 }); break;
      case 'sheathe': a.noise(t, 0.08, { vol: 0.06, filter: 'highpass', freq: 4000 }); a.tone(2093, t + 0.08, 0.05, { wave: 'square', vol: 0.05 }); break;
      case 'roar': a.tone(170, t, 0.6, { wave: 'sawtooth', vol: 0.07, slideTo: 70 }); a.tone(118, t, 0.6, { wave: 'square', vol: 0.04, slideTo: 52 }); a.noise(t, 0.55, { vol: 0.1, filter: 'lowpass', freq: 650 }); break;
      case 'growl': a.tone(120, t, 0.28, { wave: 'sawtooth', vol: 0.06, slideTo: 85 }); a.noise(t, 0.25, { vol: 0.05, filter: 'lowpass', freq: 400 }); break;
      case 'stomp': a.tone(95, t, 0.2, { wave: 'sine', vol: 0.24, slideTo: 36 }); a.noise(t, 0.18, { vol: 0.1, filter: 'lowpass', freq: 380 }); break;
      case 'swish': a.noise(t, 0.14, { vol: 0.09, filter: 'bandpass', freq: 1300 }); break;
      case 'beam': a.tone(320, t, 0.35, { wave: 'sawtooth', vol: 0.05, slideTo: 1500 }); a.noise(t, 0.3, { vol: 0.05, filter: 'highpass', freq: 3000 }); break;
      case 'crash':
        a.noise(t, 0.7, { vol: 0.16, filter: 'lowpass', freq: 900 });
        a.tone(80, t, 0.4, { wave: 'sine', vol: 0.2, slideTo: 30 });
        for (let i = 0; i < 6; i++) a.noise(t + 0.08 * i, 0.06, { vol: 0.06, filter: 'bandpass', freq: 2000 + i * 300 });
        break;
      case 'power':
        for (let i = 0; i < 8; i++) a.tone(392 * Math.pow(2, i / 4), t + i * 0.04, 0.06, { wave: 'square', vol: 0.045 });
        a.tone(1568, t + 0.32, 0.4, { wave: 'triangle', vol: 0.07 });
        break;
      case 'boom': a.noise(t, 0.6, { vol: 0.15, filter: 'lowpass', freq: 1200 }); a.tone(110, t, 0.45, { wave: 'sine', vol: 0.18, slideTo: 35 }); break;
      case 'fizzle': a.tone(320, t, 0.3, { wave: 'square', vol: 0.04, slideTo: 90 }); a.noise(t + 0.05, 0.25, { vol: 0.06, filter: 'highpass', freq: 2500 }); break;
      case 'clap': a.noise(t, 0.06, { vol: 0.13, filter: 'bandpass', freq: 1500 }); a.noise(t + 0.015, 0.05, { vol: 0.08, filter: 'bandpass', freq: 2300 }); break;
      case 'clapper': a.noise(t, 0.03, { vol: 0.15, filter: 'highpass', freq: 2500 }); a.tone(1400, t, 0.03, { wave: 'square', vol: 0.05 }); break;
      case 'step': a.noise(t, 0.05, { vol: 0.07, filter: 'highpass', freq: 6000 }); break;
      case 'kick': a.noise(t, 0.08, { vol: 0.1, filter: 'lowpass', freq: 2000 }); a.tone(200, t, 0.08, { wave: 'square', vol: 0.05, slideTo: 90 }); break;
      case 'voice': a.tone(700 + Math.random() * 150, t, 0.04, { wave: 'square', vol: 0.035 }); a.tone(640 + Math.random() * 150, t + 0.06, 0.04, { wave: 'square', vol: 0.03 }); break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- characters
  // Draw a charSheet character. x = left edge, feet = soles' y, s = scale.
  // info: { dir, dx, dy (sprite px), crouch, armless, frame, arms: [[sx,sy,hx,hy]], legs: [[...]] }
  // o: { frame, rot, pop (0..1 arm extension), under(c), over(c), after(c, hands), sleeve, hand }
  drawPerson(ctx, sheet, look, x, feet, s, info, o = {}) {
    const dir = info.dir || 'down';
    const frames = sheet[dir] || sheet.down;
    let img = frames[o.frame ?? info.frame ?? 0] || frames[0];
    if (info.armless && dir === 'down') img = armless(img);
    ctx.save();
    ctx.translate(Math.round(x + (info.dx || 0) * s), Math.round(feet - 20 * s + (info.dy || 0) * s));
    ctx.scale(s, s);
    if (o.rot) {
      ctx.translate(8, 20 - 6 * Math.abs(Math.sin(o.rot)));
      ctx.rotate(o.rot);
      ctx.translate(-8, -20);
    }
    if (o.under) o.under(ctx);
    if (info.crouch) {
      ctx.drawImage(img, 0, 15, 16, 5, 0, 15, 16, 5);
      ctx.drawImage(img, 0, 0, 16, 15, 0, 3, 16, 15);
    } else {
      ctx.drawImage(img, 0, 0);
    }
    if (o.over) o.over(ctx);
    const skin = SKIN[look.skin] || look.skin || SKIN.fair;
    const k = o.pop ?? 1;
    for (const [sx, sy, fx, fy] of info.legs || []) limb(ctx, sx, sy, fx, fy, look.bottom || '#3a4a7a', look.shoes || '#3b2a20');
    const hands = [];
    for (const [sx, sy, hx, hy] of info.arms || []) {
      const ex = Math.round(sx + (hx - sx) * k), ey = Math.round(sy + (hy - sy) * k);
      limb(ctx, sx, sy, ex, ey, o.sleeve || look.top || '#d64161', o.hand || skin);
      hands.push([ex, ey]);
    }
    if (o.after) o.after(ctx, hands);
    ctx.restore();
  }

  // Generic poses shared by the human characters.
  basePose(kind, t) {
    const jump = Math.round(Math.sin(Math.min(1, t / 14) * Math.PI) * 3);
    switch (kind) {
      case 'left': return { dir: 'left', arms: [[5, 12, -4, 11]] };
      case 'right': return { dir: 'right', arms: [[10, 12, 19, 11]] };
      case 'up': return { dir: 'down', armless: true, dy: -jump, arms: [[3, 12, 1, 2], [12, 12, 14, 2]] };
      case 'down': return { dir: 'down', armless: true, crouch: true, arms: [[3, 15, 0, 17], [12, 15, 15, 17]] };
      case 'a': return { dir: 'down', armless: true, dy: -Math.min(1, jump), arms: [[12, 12, 18, 4], [3, 12, 2, 16]] };
      case 'b': return { dir: 'down', armless: true, arms: [[3, 13, 11, 9], [12, 13, 4, 9]] };
      case 'win': return { dir: 'down', armless: true, arms: [[3, 12, -1, 3], [12, 12, 16, 3]] };
      case 'shrug': return { dir: 'down', armless: true, arms: [[3, 12, 12, 4], [12, 12, 15, 15]] };
      default: return { dir: 'down' };
    }
  }

  drawDizzy(ctx, cx, cy, t, n = 3) {
    for (let i = 0; i < n; i++) {
      const a = t / 7 + (i * Math.PI * 2) / n;
      sparkle(ctx, cx + Math.cos(a) * 12, cy + Math.sin(a) * 4, 2, i % 2 ? '#fff6a8' : '#ffffff');
    }
  }

  drawEmote(ctx, x, y, ch, t) {
    const dy = t < 5 ? 5 - t : 0;
    const w = Math.max(16, Math.ceil(measure(ctx, ch, 10)) + 8);
    roundBox(ctx, x, y + dy, w, 15, '#ffffff');
    rect(ctx, x + 3, y + dy + 14, 3, 2, '#ffffff');
    rect(ctx, x + 2, y + dy + 14, 1, 3, INK);
    rect(ctx, x + 3, y + dy + 16, 2, 1, INK);
    text(ctx, ch, x + w / 2, y + dy + 2, { size: 10, align: 'center', color: ch === '！' || ch === '！？' ? '#d6243a' : '#1a1a28', shadow: null });
  }

  // ---------------------------------------------------------------- particles & effects
  drawParts(ctx, layer) {
    for (const p of this.parts) {
      if (p.layer !== layer || p.t < 0) continue;
      const k = p.t / p.life;
      switch (p.type) {
        case 'spark':
          sparkle(ctx, p.x, p.y, Math.max(1, Math.round((p.r || 3) * (1 - k * 0.7))), p.color || '#fff');
          break;
        case 'sq':
          ctx.globalAlpha = clamp(1.4 - k, 0, 1);
          rect(ctx, p.x, p.y, p.s || 2, p.s || 2, p.color);
          ctx.globalAlpha = 1;
          break;
        case 'confetti': {
          const flip = Math.floor((p.t + p.ph) / 5) % 2;
          rect(ctx, p.x, p.y, flip ? 3 : 2, flip ? 2 : 3, p.color);
          break;
        }
        case 'dust': {
          const r = p.r + p.t * (p.grow ?? 0.35);
          ctx.globalAlpha = clamp(1 - k, 0, 1) * (p.a ?? 0.8);
          fillEllipse(ctx, p.x, p.y, r, r * 0.6, p.color || '#d8d0c0');
          ctx.globalAlpha = 1;
          break;
        }
        case 'puff': {
          const r = p.r * (0.35 + 0.65 * Math.min(1, p.t / 8));
          ctx.globalAlpha = clamp((1 - k) * 1.6, 0, 1);
          fillEllipse(ctx, p.x, p.y, r, r * 0.85, p.color);
          fillEllipse(ctx, p.x - r * 0.3, p.y - r * 0.3, r * 0.4, r * 0.3, shade(p.color, 0.35));
          ctx.globalAlpha = 1;
          break;
        }
        case 'ring': {
          const r = (p.r || 4) + p.t * (p.vr || 2);
          ctx.globalAlpha = clamp(1 - k, 0, 1);
          ctx.fillStyle = p.color;
          const n = Math.max(12, Math.round(r * 1.2));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y + Math.sin(a) * r * (p.flat || 1)), 2, 2);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'arc': {
          const vis = Math.min(1, (p.t + 1) / 3);
          ctx.globalAlpha = clamp(1.25 - k, 0, 1);
          ctx.fillStyle = p.color || '#ffffff';
          const N = 34;
          for (let i = 0; i <= N * vis; i++) {
            const f = i / N;
            const a = p.a0 + (p.a1 - p.a0) * f;
            const w = 1 + Math.round(Math.sin(f * Math.PI) * 3);
            ctx.fillRect(Math.round(p.x + Math.cos(a) * p.rx - w / 2), Math.round(p.y + Math.sin(a) * p.ry - w / 2), w, w);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'line': {
          const n = Math.ceil(Math.hypot(p.x2 - p.x, p.y2 - p.y) / 2);
          const vis = Math.min(1, (p.t + 1) / 3);
          ctx.globalAlpha = clamp(1.3 - k, 0, 1);
          ctx.fillStyle = p.color || '#ffffff';
          for (let i = 0; i <= n * vis; i++) {
            const f = i / n;
            const w = Math.max(1, Math.round(Math.sin(f * Math.PI) * (p.w || 4)));
            ctx.fillRect(Math.round(p.x + (p.x2 - p.x) * f - w / 2), Math.round(p.y + (p.y2 - p.y) * f - w / 2), w, w);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'beam': {
          const x0 = Math.min(p.x, p.x2), x1 = Math.max(p.x, p.x2);
          const fl = (p.t >> 1) % 2;
          ctx.globalAlpha = clamp((1 - k) * 2, 0, 1);
          rect(ctx, x0, p.y - 5 - fl, x1 - x0, 10 + fl * 2, 'rgba(95,215,255,0.45)');
          rect(ctx, x0, p.y - 3, x1 - x0, 6, '#8fe8ff');
          rect(ctx, x0, p.y - 1, x1 - x0, 2, '#ffffff');
          fillEllipse(ctx, p.x, p.y, 6 + fl, 6 + fl, '#e8fbff');
          ctx.globalAlpha = 1;
          break;
        }
        case 'burst': {
          const a0 = p.t * 0.03;
          ctx.globalAlpha = clamp((1 - k) * 0.7, 0, 0.7);
          for (let i = 0; i < 16; i++) {
            const a = a0 + (i * Math.PI) / 8;
            const col = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#ffffff'][i % 4];
            fillPoly(ctx, [[p.x, p.y], [p.x + Math.cos(a - 0.09) * 260, p.y + Math.sin(a - 0.09) * 260], [p.x + Math.cos(a + 0.09) * 260, p.y + Math.sin(a + 0.09) * 260]], col);
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'note':
          ctx.globalAlpha = clamp(1.3 - k, 0, 1);
          text(ctx, p.ch || '♪', p.x, p.y, { size: p.size || 12, align: 'center', color: p.color, outline: INK });
          ctx.globalAlpha = 1;
          break;
        default:
          break;
      }
    }
  }

  sparkBurst(x, y, n, colors, speed = 2, layer = 'front', life = 26) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const v = speed * (0.4 + this.rng() * 0.8);
      this.spawn({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.92, r: 2 + Math.floor(this.rng() * 2), color: pickR(colors, this.rng), life: life - Math.floor(this.rng() * 8), layer });
    }
  }

  confetti(n, x0 = 0, x1 = W) {
    const cols = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#5ee07a', '#ffffff', '#ff8a3d'];
    for (let i = 0; i < n; i++) {
      this.spawn({ type: 'confetti', x: x0 + this.rng() * (x1 - x0), y: 14 - this.rng() * 30, vx: (this.rng() - 0.5) * 1.2, vy: 0.6 + this.rng() * 1.2, color: pickR(cols, this.rng), ph: Math.floor(this.rng() * 10), life: 110 });
    }
  }

  explosion(x, y, n, layer = 'back', spread = 26) {
    const cols = ['#ff5d3a', '#ffd23f', '#ff9a3a', '#5fd7ff', '#ff7eb6', '#ffffff'];
    for (let i = 0; i < n; i++) {
      this.spawn({ type: 'puff', x: x + (this.rng() - 0.5) * spread * 2, y: y + (this.rng() - 0.6) * spread, vx: (this.rng() - 0.5) * 0.6, vy: -0.3 - this.rng() * 0.4, r: 9 + this.rng() * 12, color: pickR(cols, this.rng), life: 30 + Math.floor(this.rng() * 18), layer, t: -Math.floor(this.rng() * 6) });
    }
  }

  // ---------------------------------------------------------------- drawing
  drawPlay(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    rect(ctx, 0, 0, W, H, '#05060c');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 17, W, 141);
    ctx.clip();
    if (this.shakeT > 0) {
      const m = this.shakeMag * Math.min(1, this.shakeT / 6);
      ctx.translate(Math.round((this.rng() - 0.5) * 2 * m), Math.round((this.rng() - 0.5) * 2 * m));
    }
    this.hook('draw', ctx);
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.flash / 6) * 0.85;
      rect(ctx, -8, 0, W + 16, H, '#ffffff');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (this.state === 'cue' || this.state === 'input' || this.state === 'opening') this.drawBanner(ctx);
    this.drawShout(ctx);
    this.drawPanel(ctx);
    this.drawHud(ctx);
    ctx.restore();
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const k = easeIO(Math.min(1, b.t / 8));
    let size = 12;
    let tw = measure(ctx, b.text, size);
    if (tw > 270) { size = 10; tw = measure(ctx, b.text, size); }
    const w = Math.ceil(tw) + 28;
    const x = Math.round(W / 2 - w / 2);
    const y = 21 - Math.round((1 - k) * 22);
    roundBox(ctx, x, y, w, 17, this.T.bannerBg);
    rect(ctx, x + 2, y + 2, w - 4, 1, 'rgba(255,255,255,0.2)');
    rect(ctx, x + 4, y + 7, 3, 3, this.T.accent);
    rect(ctx, x + w - 7, y + 7, 3, 3, this.T.accent);
    text(ctx, b.text, W / 2, y + (size === 12 ? 3 : 4), { size, align: 'center', color: this.T.bannerFg, shadow: null });
  }

  drawShout(ctx) {
    const s = this.shout;
    if (!s || s.t > s.len) return;
    let size = s.t < 6 ? Math.round(s.size * (0.55 + s.t * 0.09)) : s.size;
    while (size > 10 && measure(ctx, s.str, size) > W - 24) size--;
    ctx.globalAlpha = s.t > s.len - 10 ? clamp((s.len - s.t) / 10, 0, 1) : 1;
    bigText(ctx, s.str, W / 2, 56 - Math.round(size / 2), size, s.color);
    ctx.globalAlpha = 1;
  }

  chipX(i) {
    const n = this.cur ? this.cur.n : 1;
    const tw = n * CHIP + (n - 1) * GAP;
    return Math.round(W / 2 - tw / 2) + i * (CHIP + GAP);
  }

  drawPanel(ctx) {
    const T = this.T;
    panel(ctx, 4, 158, W - 8, 70, { bg: T.panelBg, edge: T.panelEdge });
    const c = this.cur;
    if (!c) {
      let msg = '出てきたコマンドを、左から順に入力しよう！';
      let sub = '十字キー と A・B ボタンを使うよ';
      if (this.state === 'closing' || this.state === 'done') {
        const n = this.counts;
        msg = `PERFECT ${n.perfect}　GREAT ${n.great}　GOOD ${n.good}　MISS ${n.miss}`;
        sub = this.maxCombo >= 2 ? `最大 ${this.maxCombo}連続クリア！` : 'おつかれさまでした！';
      }
      text(ctx, msg, W / 2, 176, { size: 12, align: 'center', color: COLORS.text });
      text(ctx, sub, W / 2, 196, { size: 10, align: 'center', color: COLORS.dim });
      this.drawLegend(ctx);
      return;
    }
    const n = c.n;
    const result = this.state === 'clear' || this.state === 'fail';
    for (let i = 0; i < n && !result; i++) {
      let x = this.chipX(i);
      let y = CHIP_Y;
      if (this.state === 'cue') {
        const k = this.st - this.walkLen - i * 2;
        if (k < 0) continue;
        y += Math.max(0, 8 - k * 2);
      }
      let st = i < c.idx ? 'done' : i === c.idx && this.state === 'input' ? 'now' : 'todo';
      if (this.state === 'fail' && i >= c.idx) st = 'failed';
      if (st === 'done' && c.hitAt[i] != null && this.pt - c.hitAt[i] < 5) y -= 3;
      if (st === 'now' && c.missT > 0) x += c.missT % 4 < 2 ? -2 : 2;
      this.drawChip(ctx, c.seq[i], x, y, st, result);
      const cx = x + CHIP / 2;
      if (this.theme === 'acting' && !result) {
        const col = st === 'done' ? '#7a7a88' : st === 'now' ? T.accent : '#e8e8f0';
        text(ctx, EMO[c.seq[i]].name, cx, 192, { size: 10, align: 'center', color: col, shadow: null });
      } else if (st === 'now') {
        const by = 194 + (Math.floor(this.pt / 8) % 2);
        ctx.fillStyle = T.accent;
        for (let r = 0; r < 4; r++) ctx.fillRect(cx - r, by + r, r * 2 + 1, 1);
      }
    }
    // time bar
    const frac = this.state === 'cue' ? 1 : clamp(c.left / c.limit, 0, 1);
    const col = frac > 0.5 ? COLORS.good : frac > 0.25 ? COLORS.accent : COLORS.bad;
    text(ctx, 'のこり', 12, TIMER_Y - 2, { size: 10, color: COLORS.dim, shadow: null });
    ctx.globalAlpha = this.state === 'cue' ? 0.5 : frac <= 0.25 && this.state === 'input' && Math.floor(this.pt / 6) % 2 ? 0.6 : 1;
    bar(ctx, 46, TIMER_Y, 262, 7, frac, col);
    ctx.globalAlpha = 1;
    this.drawLegend(ctx);
    if (this.grade) {
      const g = this.grade;
      const size = g.text.length > 8 ? 16 : 20;
      const pop = g.t < 6 ? 0.6 + g.t * 0.07 : 1;
      bigText(ctx, g.text, W / 2, CHIP_Y + 13 - Math.round((size * pop) / 2), Math.round(size * pop), g.color);
      if (g.t > 6) text(ctx, `+${g.pts}点`, W / 2, 192, { size: 10, align: 'center', color: g.pts > 0 ? COLORS.accent : COLORS.dim, outline: INK });
    }
  }

  drawChip(ctx, key, x, y, st, result) {
    const T = this.T;
    let bg = T.chip;
    if (st === 'done') bg = T.accent;
    else if (st === 'now') bg = this.cur.missT > 0 ? '#a8283a' : shade(T.chip, 0.22);
    else if (st === 'failed') bg = '#33333c';
    if (st === 'now') {
      const blink = Math.floor(this.pt / 6) % 2;
      roundBox(ctx, x - 2, y - 2, CHIP + 4, CHIP + 4, blink ? '#ffffff' : T.accent);
    }
    roundBox(ctx, x, y, CHIP, CHIP, bg);
    rect(ctx, x + 2, y + 2, CHIP - 4, 1, 'rgba(255,255,255,0.28)');
    rect(ctx, x + 2, y + CHIP - 3, CHIP - 4, 1, 'rgba(0,0,0,0.3)');
    drawIcon(ctx, key, x + CHIP / 2, y + CHIP / 2, true, st === 'failed', st === 'done' ? shade(T.accent, -0.6) : null);
  }

  drawLegend(ctx) {
    const L = this.T.legend;
    if (!L) return;
    let total = 0;
    const items = L.map(([keys, label]) => {
      const lw = Math.ceil(measure(ctx, label, 10));
      const w = keys.length * 12 + 2 + lw;
      total += w;
      return { keys, label, w };
    });
    total += (items.length - 1) * 10;
    let x = Math.round(W / 2 - total / 2);
    for (const it of items) {
      it.keys.forEach((k, i) => drawIcon(ctx, k, x + 6 + i * 12, LEGEND_Y + 6, false));
      text(ctx, it.label, x + it.keys.length * 12 + 2, LEGEND_Y + 1, { size: 10, color: '#d8dcf0', shadow: null });
      x += it.w + 10;
    }
  }

  drawHud(ctx) {
    rect(ctx, 0, 0, W, 16, '#0b0d1e');
    rect(ctx, 0, 16, W, 1, shade(this.T.accent, -0.35));
    const n = clamp(this.ri + 1, 1, this.R);
    text(ctx, `${this.T.roundName} ${n}/${this.R}`, 6, 3, { size: 10, color: COLORS.text });
    text(ctx, 'スコア', 96, 3, { size: 10, color: COLORS.accent });
    const frac = clamp(this.shown, 0, 1);
    bar(ctx, 130, 4, 110, 8, frac, frac >= 0.9 ? COLORS.accent : frac >= 0.55 ? COLORS.pink : COLORS.cyan);
    text(ctx, String(Math.round(frac * 100)), 246, 3, { size: 10, color: COLORS.text });
    if (this.combo >= 2) text(ctx, `${this.combo}連続！`, W - 6, 3, { size: 10, align: 'right', color: COLORS.pink });
    rect(ctx, 0, 229, W, 11, '#0b0d1e');
    text(ctx, '左から順にコマンド入力！ミスすると時間が減るよ', W / 2, 229, { size: 10, align: 'center', color: '#c8cce6', shadow: null });
  }

  // ---------------------------------------------------------------- backgrounds
  renderBg() {
    const [cv, c] = makeCanvas(W, H);
    const r = mulberry32(this.theme.length * 977 + 11);
    rect(c, 0, 0, W, H, '#05060c');
    const f = this[`${this.theme}_bg`];
    if (f) f.call(this, c, r);
    rect(c, 0, 158, W, H - 158, '#0b0d1e');
    return cv;
  }

  // ================================================================ TATE (殺陣)
  tate_bg(c, r) {
    vgrad(c, 0, 16, W, 84, [[0, '#1d1440'], [0.5, '#5a2a5a'], [0.8, '#c0566a'], [1, '#f0a066']]);
    for (let i = 0; i < 26; i++) rect(c, Math.floor(r() * W), 18 + Math.floor(r() * 36), 1, 1, 'rgba(255,240,220,0.7)');
    // moon
    c.globalAlpha = 0.18;
    fillEllipse(c, 262, 40, 17, 17, '#fff1c8');
    c.globalAlpha = 1;
    fillEllipse(c, 262, 40, 11, 11, '#fff1c8');
    fillEllipse(c, 258, 37, 3, 2, '#efdcaa');
    fillEllipse(c, 266, 44, 2, 2, '#efdcaa');
    // far roofs
    for (let x = -10; x < W; x += 20 + Math.floor(r() * 16)) {
      const w = 26 + Math.floor(r() * 18), h = 6 + Math.floor(r() * 9);
      fillPoly(c, [[x, 98], [x + 5, 96 - h], [x + w - 5, 96 - h], [x + w, 98]], '#2a1838');
    }
    rect(c, 0, 94, W, 10, '#2a1838');
    // town houses
    const signs = ['宿', '茶', '酒', '米', '薬'];
    for (let i = 0; i < 5; i++) this.tate_machiya(c, -8 + i * 72, 72, i, signs[i]);
    // ground
    vgrad(c, 0, 132, W, 26, [[0, '#7c5c3e'], [1, '#5a4028']]);
    rect(c, 0, 132, W, 2, '#3e2a1a');
    for (let i = 0; i < 260; i++) rect(c, Math.floor(r() * W), 134 + Math.floor(r() * 24), 1, 1, r() < 0.5 ? '#8e6e4c' : '#4e3622');
    for (let i = 0; i < 9; i++) fillEllipse(c, Math.floor(r() * W), 140 + Math.floor(r() * 16), 2, 1, '#9a8a78');
  }

  tate_machiya(c, x, w, i, sign) {
    // upper roof
    fillPoly(c, [[x - 2, 59], [x + 6, 46], [x + w - 6, 46], [x + w + 2, 59]], '#2c2d38');
    for (let xx = x + 2; xx < x + w; xx += 4) rect(c, xx, 48, 1, 10, '#3e4050');
    rect(c, x + 6, 45, w - 12, 2, '#3e4050');
    rect(c, x - 2, 58, w + 4, 2, '#1c1d26');
    // upper floor (plaster) with a slatted window
    rect(c, x, 60, w, 14, '#d8c8a4');
    rect(c, x, 60, w, 1, '#b8a888');
    rect(c, x + w / 2 - 15, 62, 30, 9, '#3a2a1a');
    for (let xx = x + w / 2 - 14; xx < x + w / 2 + 14; xx += 4) rect(c, xx, 62, 2, 9, '#cdbc96');
    // eave
    fillPoly(c, [[x - 4, 82], [x, 74], [x + w, 74], [x + w + 4, 82]], '#2c2d38');
    for (let xx = x; xx < x + w; xx += 4) rect(c, xx, 75, 1, 6, '#3e4050');
    rect(c, x - 4, 81, w + 8, 2, '#1c1d26');
    // ground floor: wood, lattice, doorway with noren
    rect(c, x, 83, w, 49, '#6b4a2e');
    rect(c, x, 83, 3, 49, '#4a3020');
    rect(c, x + w - 3, 83, 3, 49, '#4a3020');
    const lw = Math.floor(w / 2) - 6;
    rect(c, x + 5, 88, lw, 40, '#3a2414');
    for (let xx = x + 6; xx < x + 5 + lw; xx += 3) rect(c, xx, 88, 2, 40, '#7a5634');
    rect(c, x + 5, 88, lw, 1, '#4a3020');
    rect(c, x + 5, 127, lw, 1, '#4a3020');
    const dx = x + Math.floor(w / 2) + 2, dw = Math.floor(w / 2) - 7;
    rect(c, dx, 86, dw, 46, '#1a120c');
    const noren = i % 2 ? '#2a3a7a' : '#7a2a3a';
    rect(c, dx - 1, 85, dw + 2, 17, noren);
    rect(c, dx - 1, 85, dw + 2, 2, shade(noren, -0.3));
    rect(c, dx + Math.floor(dw / 3), 90, 1, 12, shade(noren, -0.4));
    rect(c, dx + Math.floor((2 * dw) / 3), 90, 1, 12, shade(noren, -0.4));
    fillEllipse(c, dx + dw / 2, 94, 3, 3, '#f0e8d8');
    // hanging sign
    roundBox(c, x + 6, 86, 12, 15, '#e8d8b0', '#3a2414');
    text(c, sign, x + 12, 88, { size: 10, align: 'center', color: '#2a1a10', shadow: null });
    // paper lantern
    const lx = x + Math.floor(w / 2) - 1;
    c.globalAlpha = 0.16;
    fillEllipse(c, lx, 93, 12, 12, '#ffc070');
    c.globalAlpha = 1;
    rect(c, lx - 1, 82, 2, 2, INK);
    rect(c, lx - 3, 84, 6, 2, INK);
    fillEllipse(c, lx, 92, 5, 6, i % 2 ? '#e8503a' : '#f4e8c8');
    for (let yy = 88; yy <= 96; yy += 2) rect(c, lx - 4, yy, 8, 1, i % 2 ? '#b8382a' : '#d8c8a0');
    rect(c, lx - 3, 98, 6, 2, INK);
  }

  tate_setup() {
    const L = this.look;
    this.samLook = { ...L, top: '#2a3a6a', bottom: '#5a5f6b', skirt: true, jacket: true, tie: null, glasses: L.glasses === 'sun' ? false : L.glasses || false };
    this.samSheet = charSheet(this.samLook);
    this.enemyLooks = [
      { hair: 'mage', hairColor: 'black', skin: 'tan', top: '#6a4a3a', bottom: '#3b3f48', skirt: true, beard: true },
      { ...LOOKS.ninja },
      { hair: 'mage', hairColor: 'brown', skin: 'fair', top: '#4a5a3a', bottom: '#5a4a3a', skirt: true },
      { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#7a2a2a', bottom: '#3b3f48', skirt: true, glasses: false },
      { hair: 'bald', hairColor: 'black', skin: 'brown', top: '#5a3a6a', bottom: '#2a2d36', skirt: true, beard: true },
    ];
    this.enemies = [];
    this.calls = shuffle(TATE_CALLS, this.rng);
  }

  tate_open() {
    this.banner = { text: '月夜の大立ち回り、本番！', t: 0 };
    this.setPose('sheathe', 34);
    this.later(30, () => { this.g.sfx('sword'); this.setPose('win', 40); this.doShout('いざ、勝負！'); });
  }

  tate_walkLen() { return 24; }

  tate_call(i) { return i === this.R - 1 && this.R > 1 ? '親分のおでましだ！決めろ！' : this.calls[i % this.calls.length]; }

  tate_round(i) {
    const n = this.cur.n;
    const count = n <= 4 ? 2 : n <= 6 ? 3 : 4;
    this.enemies = [];
    for (let k = 0; k < count; k++) {
      const look = this.enemyLooks[(i * 3 + k) % this.enemyLooks.length];
      this.enemies.push({ side: k % 2 ? 1 : -1, front: k < 2, look, sheet: charSheet(look), knock: 0, fallT: 0 });
    }
    this.lastSide = 'right';
  }

  tate_p() {
    const c = this.cur;
    if (!c) return 0;
    if (this.state === 'cue') return Math.min(0, -1 + this.st / this.walkLen);
    if (this.state === 'input') return 1 - c.left / c.limit;
    if (this.state === 'fail') return c.endP;
    return c.endP;
  }

  tate_enemyPos(e) {
    const s = e.front ? 3 : 2;
    const feet = e.front ? 150 : 137;
    const L = e.side < 0;
    const off = L ? -16 * s - 6 : W + 6;
    const start = L ? (e.front ? 30 : 56) : e.front ? W - 30 - 48 : W - 56 - 32;
    const near = L ? (e.front ? 92 : 106) : e.front ? 180 : 182;
    const p = this.tate_p();
    let x = p < 0 ? lerp(start, off, -p) : lerp(start, near, p);
    x += e.side * e.knock * 9;
    if (e.fallT > 0) x += e.side * Math.min(e.fallT, 10) * 0.6;
    return { x, feet, s };
  }

  tate_tick() {
    for (const e of this.enemies) {
      e.knock *= 0.84;
      if (e.fallT > 0) e.fallT++;
    }
  }

  tate_pose(kind, t) {
    const side = this.lastSide;
    const jump = Math.round(Math.sin(Math.min(1, t / 16) * Math.PI) * 5);
    switch (kind) {
      case 'left': return { dir: 'left', arms: [[5, 12, -4, 11]], sword: [-1, 0, 11] };
      case 'right': return { dir: 'right', arms: [[10, 12, 19, 11]], sword: [1, 0, 11] };
      case 'up': return { dir: 'down', armless: true, dy: -jump, arms: [[3, 12, 2, 3], [12, 12, 13, 3]], sword: [0, -1, 11], hand: 1 };
      case 'down': return { dir: 'down', armless: true, crouch: true, arms: [[3, 15, 1, 17], [12, 15, 16, 17]], sword: [1, 0, 11], hand: 1 };
      case 'a': return side === 'left'
        ? { dir: 'left', dx: -3, arms: [[5, 12, -6, 12]], sword: [-1, 0, 15] }
        : { dir: 'right', dx: 3, arms: [[10, 12, 21, 12]], sword: [1, 0, 15] };
      case 'b': return { dir: 'down', armless: true, arms: [[3, 12, 1, 1], [12, 12, 14, 1]], sword: [-1, 0, 15], hand: 1 };
      case 'win': return { dir: 'down', armless: true, arms: [[12, 12, 15, 3], [3, 12, 2, 16]], sword: [0, -1, 11] };
      case 'hurt': return { dir: 'down', armless: true, crouch: true, arms: [[3, 15, 4, 6], [12, 15, 11, 6]] };
      case 'sheathe': return { dir: 'down' };
      default: return { dir: 'down', sword: [1, -1, 8], handAt: [12, 14] };
    }
  }

  tate_hit(k) {
    this.g.sfx('sword');
    if (k === 'left' || k === 'right') this.lastSide = k;
    const side = this.lastSide === 'left' ? -1 : 1;
    const cx = 160, cy = 118;
    const arc = (rx, ry, a0, a1, ox, oy) => this.spawn({ type: 'arc', x: cx + ox, y: cy + oy, rx, ry, a0, a1, life: 12 });
    const knock = (sd, pow) => { for (const e of this.enemies) if (e.side === sd) e.knock = Math.max(e.knock, e.front ? pow : pow * 0.6); };
    this.setPose(k, 18);
    switch (k) {
      case 'left': arc(34, 30, 4.0, 2.2, -14, 0); knock(-1, 1); break;
      case 'right': arc(34, 30, -0.9, 0.9, 14, 0); knock(1, 1); break;
      case 'up': arc(30, 20, 3.5, 5.9, 0, -26); break;
      case 'down': arc(48, 10, 2.9, 0.25, 0, 24); knock(-1, 0.6); knock(1, 0.6); this.spawn({ type: 'dust', x: 160, y: 148, r: 4, life: 16, color: '#b89a74' }); break;
      case 'a':
        this.spawn({ type: 'line', x: cx + side * 26, y: cy - 4, x2: cx + side * 86, y2: cy - 4, w: 4, life: 10 });
        this.sparkBurst(cx + side * 80, cy - 4, 4, ['#ffffff', '#fff6a8'], 1.5);
        knock(side, 1.5);
        break;
      case 'b':
        this.snd('clang');
        this.sparkBurst(152, 92, 7, ['#fff6a8', '#ffd23f', '#ffffff'], 2.2);
        this.popup('キン！', 160, 72, '#fff6a8', 10);
        knock(-1, 0.4); knock(1, 0.4);
        break;
      default: break;
    }
  }

  tate_clear() {
    this.flash = 5;
    this.setPose('a', 28);
    this.enemies.forEach((e, k) => this.later(k * 3, () => {
      const { x, feet, s } = this.tate_enemyPos(e);
      const ex = x + 8 * s, ey = feet - 11 * s;
      const q = s / 3;
      this.spawn({ type: 'line', x: ex - 24 * q, y: ey - 26 * q, x2: ex + 24 * q, y2: ey + 20 * q, w: 5, life: 14 });
      this.g.sfx('sword');
    }));
    this.later(11, () => {
      this.g.sfx('hit');
      this.shake(8, 3);
      for (const e of this.enemies) e.fallT = 1;
      this.doShout(pickR(this.T.good, this.rng));
    });
    this.later(32, () => { this.snd('sheathe'); this.setPose('sheathe', 34); this.popup('チャキン', 196, 118, '#ffffff', 10); });
  }

  tate_fail() {
    this.later(6, () => { this.g.sfx('hit'); this.shake(6, 2); this.popup('ポカッ', 160, 76, '#ffffff', 12); });
    this.later(14, () => this.g.sfx('zukko'));
    this.later(18, () => this.doShout('まいった〜！', '#9ad0ff', 22));
  }

  tate_close(good) {
    this.enemies = this.enemies.filter((e) => e.fallT > 0);
    this.setPose(good ? 'win' : 'sheathe', 999);
    if (good) {
      this.doShout('一件落着！', '#ffe680', 28, 100);
      this.g.sfx('applause');
      this.sparkBurst(160, 100, 14, ['#ffffff', '#fff6a8', '#ffd23f'], 2.5, 'front', 40);
    } else {
      this.doShout('まだまだ修行が足りぬ…', '#c8d0ff', 18, 100);
    }
  }

  tate_draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    // lantern flicker
    ctx.globalAlpha = 0.06 + 0.04 * Math.sin(this.pt / 5);
    for (let i = 0; i < 5; i++) fillEllipse(ctx, -8 + i * 72 + 35, 93, 18, 16, '#ffb050');
    ctx.globalAlpha = 1;
    this.drawParts(ctx, 'back');
    for (const e of this.enemies) if (!e.front) this.tate_drawEnemy(ctx, e);
    for (const e of this.enemies) if (e.front) this.tate_drawEnemy(ctx, e);
    this.tate_drawPlayer(ctx);
    this.drawParts(ctx, 'front');
  }

  tate_drawEnemy(ctx, e) {
    const { x, feet, s } = this.tate_enemyPos(e);
    const face = e.side < 0 ? 'right' : 'left';
    let rot = 0, frame = 0, dy = 0;
    if (e.fallT > 0) rot = e.side * (Math.PI / 2) * Math.min(1, e.fallT / 8);
    else if (this.state === 'cue') frame = 1 + (Math.floor(this.st / 5) % 2);
    else if (this.state === 'fail' && this.st > 12) dy = -Math.abs(Math.round(Math.sin((this.st + e.side * 3) / 3) * 2));
    else if (this.state === 'input') frame = Math.floor((this.pt + (e.front ? 0 : 7)) / 14) % 2;
    if (!e.fallT) shadowAt(ctx, x + 8 * s, feet - 1, 6 * s, s);
    const fw = face === 'right';
    this.drawPerson(ctx, e.sheet, e.look, x, feet, s, { dir: face, dy }, {
      frame, rot,
      after: (c) => { if (e.fallT < 3) katana(c, fw ? 9 : 5, 13, fw ? 1 : -1, -1, 7); },
    });
    if (e.knock > 0.6) sparkle(ctx, x + 8 * s - e.side * 4 * s, feet - 12 * s, 3, '#ffffff');
    if (e.fallT > 10) this.drawDizzy(ctx, x + 8 * s + e.side * 12 * s / 3 * 2, feet - 8, this.pt + e.side * 9, 2);
  }

  tate_drawPlayer(ctx) {
    const s = 3, x = 136, feet = 150;
    let kind = this.pose.kind;
    const t = this.pose.t;
    const rot = 0;
    if (this.state === 'fail' && this.st >= 8) kind = 'hurt';
    const info = this.tate_pose(kind, t);
    shadowAt(ctx, x + 24, feet - 1, 18, 3);
    this.drawPerson(ctx, this.samSheet, this.samLook, x, feet, s, info, {
      rot,
      pop: Math.min(1, (t + 1) / 3),
      over: (c) => {
        c.fillStyle = '#f4f4f4';
        c.fillRect(3, 4, 10, 1);
        if (info.dir === 'left') { c.fillRect(13, 5, 2, 1); c.fillRect(14, 6, 2, 1); }
        if (info.dir === 'right') { c.fillRect(1, 5, 2, 1); c.fillRect(0, 6, 2, 1); }
        if (info.dir === 'down') { c.fillStyle = '#d63a3a'; c.fillRect(7, 4, 2, 1); }
      },
      after: (c, hands) => {
        if (!info.sword) return;
        const h = info.handAt || hands[info.hand ?? 0] || hands[0];
        if (h) katana(c, h[0], h[1], ...info.sword);
      },
    });
    if (kind === 'hurt' && this.st > 10) this.drawDizzy(ctx, x + 24, feet - 58, this.pt);
  }

  // ================================================================ HENSHIN (変身ヒーロー)
  henshin_bg(c, r) {
    vgrad(c, 0, 16, W, 104, [[0, '#2f7fd8'], [0.6, '#8fcaf4'], [1, '#d8f0fc']]);
    const cloud = (cx, cy, s) => {
      for (const [dx, dy, rr] of [[-14, 2, 7], [-4, -3, 9], [8, -1, 8], [17, 3, 6], [2, 4, 8]]) fillEllipse(c, cx + dx * s, cy + dy * s, rr * s, rr * s * 0.7, '#ffffff');
      rect(c, cx - 18 * s, cy + 6 * s, 38 * s, 2, '#e4f2fb');
    };
    cloud(50, 34, 1);
    cloud(196, 28, 1.3);
    cloud(286, 52, 0.8);
    fillPoly(c, [[0, 86], [40, 66], [90, 80], [150, 62], [210, 78], [270, 62], [320, 76], [320, 104], [0, 104]], '#86a8cc');
    // quarry cliffs: high on both sides, low in the middle
    const top = (x) => {
      const edge = x < 120 ? 44 + (x / 120) * 30 : x > 210 ? 50 + ((320 - x) / 110) * 28 : 86;
      return Math.round(edge + Math.sin(x * 0.21) * 3 + Math.sin(x * 0.53) * 2);
    };
    const bands = ['#c9ad82', '#b3976c', '#d2b88e', '#bea075'];
    for (let x = 0; x < W; x += 2) {
      const ty = top(x);
      for (let y = ty; y < 124; y++) {
        const b = Math.floor((y + Math.sin(x * 0.05) * 3) / 7) % bands.length;
        c.fillStyle = bands[b];
        c.fillRect(x, y, 2, 1);
      }
      rect(c, x, ty, 2, 2, '#e8d4ae');
      if (hash2(x, 3, 7) < 0.12) rect(c, x, ty + 6, 1, 14 + Math.floor(hash2(x, 5, 1) * 18), '#8a7050');
    }
    // ground
    vgrad(c, 0, 120, W, 38, [[0, '#d4bd94'], [1, '#b8a078']]);
    rect(c, 0, 120, W, 1, '#a08860');
    for (let i = 0; i < 220; i++) rect(c, Math.floor(r() * W), 122 + Math.floor(r() * 36), 1 + Math.floor(r() * 2), 1, r() < 0.5 ? '#a89070' : '#e2cca4');
    for (const [bx, by, bw] of [[24, 128, 14], [296, 134, 18], [70, 140, 8], [250, 124, 10]]) {
      fillEllipse(c, bx, by, bw, bw * 0.6, '#8f8577');
      fillEllipse(c, bx - bw * 0.3, by - bw * 0.25, bw * 0.45, bw * 0.25, '#b2a898');
      rect(c, bx - bw, by + Math.round(bw * 0.6) - 1, bw * 2, 1, '#6a6256');
    }
  }

  henshin_setup() {
    const L = this.look;
    this.casSheet = charSheet(L);
    const hc = heroColor(L.top);
    this.heroLk = { hair: 'helmet', hat: hc, skin: L.skin || 'fair', top: hc, bottom: '#f2f2f2', shoes: '#f2f2f2' };
    this.heroSh = charSheet(this.heroLk);
    this.gruntLk = { hair: 'helmet', hat: '#454a58', skin: 'fair', top: '#2a2d36', bottom: '#2a2d36', shoes: '#16161c' };
    this.gruntSh = charSheet(this.gruntLk);
    this.grunts = [-1, 1].map((side) => ({ side, state: 'gone', t: 0, knock: 0, flyT: 0 }));
    this.transformed = false;
    this.tries = 0;
    this.calls = shuffle(HERO_CALLS, this.rng);
    this.kickSide = 'right';
  }

  henshin_open() {
    this.banner = { text: '特撮ヒーロー、撮影開始！', t: 0 };
    for (const g of this.grunts) { g.state = 'in'; g.t = -20; }
    this.later(34, () => { this.setPose('a', 40); this.doShout('悪は許さない！'); this.snd('voice'); });
  }

  henshin_walkLen() { return 20; }

  henshin_round(i) {
    const final = i === this.R - 1;
    this.cur.kind = !this.transformed ? 'henshin' : final ? 'hissatsu' : 'battle';
    for (const g of this.grunts) if (g.state !== 'idle') { g.state = 'in'; g.t = 0; g.flyT = 0; }
  }

  henshin_call(i) {
    const k = this.cur.kind;
    if (k === 'henshin') return this.tries++ === 0 ? '変身ポーズ、いくぞ！' : 'もう一度、変身だ！';
    if (k === 'hissatsu') return '必殺技で決めろ！';
    return this.calls[i % this.calls.length];
  }

  henshin_gruntX(g) {
    const idle = g.side < 0 ? 26 : 246;
    const off = g.side < 0 ? -56 : W + 8;
    let x = idle;
    if (g.state === 'in') x = lerp(off, idle, easeIO(clamp(g.t / 18, 0, 1)));
    else if (g.state === 'fly') x = idle + g.side * g.flyT * 6;
    else if (g.state === 'gone') x = off;
    if (g.state === 'idle' && this.state === 'fail' && this.cur && this.cur.kind !== 'henshin') {
      const near = g.side < 0 ? 94 : 178;
      x = this.st < 36 ? lerp(idle, near, Math.min(1, this.st / 8)) : lerp(near, off, Math.min(1, (this.st - 36) / 20));
    }
    return x + g.side * g.knock * 8;
  }

  henshin_tick() {
    for (const g of this.grunts) {
      g.t++;
      g.knock *= 0.85;
      if (g.state === 'in' && g.t >= 18) g.state = 'idle';
      if (g.state === 'fly') { g.flyT++; if (g.flyT > 26) g.state = 'gone'; }
    }
    if (this.state === 'fail' && this.st === 56 && this.cur && this.cur.kind !== 'henshin') for (const g of this.grunts) if (g.state === 'idle') g.state = 'gone';
  }

  henshin_hit(k) {
    const kind = this.cur.kind;
    this.setPose(k, 20);
    this.spawn({ type: 'ring', x: 160, y: 136, r: 3, vr: 2.4, life: 14, color: CMD_COLOR[k], flat: 0.6 });
    const hp = { left: [124, 118], right: [196, 118], up: [160, 94], down: [160, 142], a: [190, 98], b: [160, 112] }[k];
    this.sparkBurst(hp[0], hp[1], 4, [CMD_COLOR[k], '#ffffff'], 1.6);
    if (kind === 'henshin') return;
    if (k === 'left' || k === 'right') {
      const g = this.grunts.find((q) => q.side === (k === 'left' ? -1 : 1));
      if (g) g.knock = 1.4;
      this.g.sfx('hit');
      this.popup('バシッ', k === 'left' ? 70 : 250, 92, '#ffffff', 10);
    } else if (k === 'b') {
      this.snd('clang');
    } else if (k === 'a') {
      for (const g of this.grunts) g.knock = Math.max(g.knock, 0.8);
    }
  }

  henshin_clear() {
    const kind = this.cur.kind;
    if (kind === 'henshin') {
      this.flash = 10;
      this.snd('power');
      this.spawn({ type: 'burst', x: 160, y: 118, life: 44, layer: 'back' });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        this.spawn({ type: 'spark', x: 160 + Math.cos(a) * 10, y: 120 + Math.sin(a) * 14, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.2, drag: 0.94, r: 3, color: i % 2 ? '#fff6a8' : '#ffffff', life: 34 });
      }
      this.setPose('b', 12);
      this.later(10, () => {
        this.transformed = true;
        this.setPose('a', 50);
        this.doShout('変身！', '#ffe680', 30);
        this.snd('boom');
        this.explosion(160, 104, 9, 'back', 40);
        this.shake(10, 3);
        for (const g of this.grunts) if (g.state === 'idle') { g.state = 'fly'; g.flyT = 0; }
      });
    } else if (kind === 'battle') {
      this.kickSide = this.rng() < 0.5 ? 'left' : 'right';
      this.setPose('kick', 30);
      this.later(4, () => {
        this.g.sfx('hit');
        this.snd('kick');
        this.shake(6, 2);
        this.popup('ドカッ！', this.kickSide === 'left' ? 70 : 250, 86, '#ffe680', 14);
        for (const g of this.grunts) if (g.state === 'idle') { g.state = 'fly'; g.flyT = 0; }
      });
      this.later(8, () => this.doShout(pickR(['ヒーローアタック！', '決まった！', '正義の一撃！'], this.rng)));
    } else {
      this.setPose('hissatsu', 64);
      this.snd('power');
      this.later(24, () => {
        this.flash = 8;
        this.snd('boom');
        this.explosion(40, 110, 8, 'front', 22);
        this.explosion(280, 110, 8, 'front', 22);
        this.explosion(160, 96, 6, 'back', 60);
        this.shake(18, 4);
        for (const g of this.grunts) if (g.state === 'idle') { g.state = 'fly'; g.flyT = 0; }
        this.doShout('必殺！ドットキック！', '#ffe680', 22);
      });
      this.later(32, () => this.snd('boom'));
    }
  }

  henshin_fail() {
    if (this.cur.kind === 'henshin') {
      this.snd('fizzle');
      for (let i = 0; i < 5; i++) this.spawn({ type: 'dust', x: 156 + this.rng() * 8, y: 134, vx: (this.rng() - 0.5) * 0.6, vy: -0.5 - this.rng() * 0.4, r: 3, grow: 0.25, life: 34, color: '#b8b8c0' });
      this.popup('プスン…', 214, 120, '#d8d8e0', 12);
      this.setPose('shrug', 60);
      this.later(14, () => this.doShout('あれっ！？', '#c8d0ff', 22));
    } else {
      this.later(8, () => { this.g.sfx('hit'); this.shake(5, 2); this.popup('ポカッ', 160, 78, '#ffffff', 12); });
      this.later(14, () => this.g.sfx('zukko'));
      this.later(18, () => this.doShout('くっ…まだまだ！', '#c8d0ff', 20));
    }
  }

  henshin_close(good) {
    this.setPose(good ? 'win' : 'idle', 999);
    if (good) {
      this.doShout('正義は勝つ！', '#ffe680', 26, 100);
      this.g.sfx('applause');
      this.explosion(160, 92, 7, 'back', 70);
      this.later(4, () => this.snd('boom'));
    } else {
      this.doShout('つづく…！', '#c8d0ff', 22, 100);
    }
  }

  henshin_draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    this.drawParts(ctx, 'back');
    for (const g of this.grunts) this.henshin_drawGrunt(ctx, g);
    this.henshin_drawPlayer(ctx);
    this.drawParts(ctx, 'front');
  }

  henshin_drawGrunt(ctx, g) {
    if (g.state === 'gone') return;
    const s = 3, feet = 150;
    const x = this.henshin_gruntX(g);
    const face = g.side < 0 ? 'right' : 'left';
    let rot = 0, dy = 0, frame = 0;
    if (g.state === 'fly') { rot = g.side * g.flyT * 0.35; dy = -Math.round(Math.sin(Math.min(1, g.flyT / 22) * Math.PI) * 10); }
    else if (g.state === 'in' || (this.state === 'fail' && this.st > 36)) frame = 1 + (Math.floor(this.pt / 5) % 2);
    else dy = Math.floor((this.pt + g.side * 7) / 16) % 2 ? -1 : 0;
    if (g.state !== 'fly') shadowAt(ctx, x + 24, feet - 1, 16, 3);
    const info = g.state === 'fly' ? { dir: face, dy } : { dir: face, dy, arms: face === 'right' ? [[10, 12, 15, 8]] : [[5, 12, 0, 8]] };
    this.drawPerson(ctx, this.gruntSh, this.gruntLk, x, feet, s, info, { frame, rot });
    if (g.state === 'fly' && g.flyT < 16) this.drawDizzy(ctx, x + 24, feet - 66 + dy * 3, this.pt, 2);
  }

  henshin_belt(c, dir, glow) {
    const core = mix('#5a2030', '#ff4058', glow);
    if (dir === 'down' || dir === 'up') {
      c.fillStyle = '#3a3d48'; c.fillRect(3, 15, 10, 1);
      c.fillStyle = INK; c.fillRect(5, 14, 6, 3);
      c.fillStyle = '#c8ccd4'; c.fillRect(6, 14, 4, 3);
      c.fillStyle = core; c.fillRect(7, 15, 2, 1);
    } else {
      const fx = dir === 'left' ? 3 : 10;
      c.fillStyle = '#3a3d48'; c.fillRect(4, 15, 8, 1);
      c.fillStyle = INK; c.fillRect(fx - 1, 14, 4, 3);
      c.fillStyle = '#c8ccd4'; c.fillRect(fx, 14, 2, 3);
      c.fillStyle = core; c.fillRect(fx, 15, 2, 1);
    }
  }

  henshin_drawPlayer(ctx) {
    const s = 3, x = 136, feet = 150;
    const hero = this.transformed;
    const sheet = hero ? this.heroSh : this.casSheet;
    const look = hero ? this.heroLk : this.look;
    let kind = this.pose.kind;
    const t = this.pose.t;
    let rot = 0;
    let info;
    if (kind === 'kick') {
      const sd = this.kickSide === 'left' ? -1 : 1;
      info = sd < 0
        ? { dir: 'left', dx: -8, dy: -4, arms: [[5, 12, 1, 8]], legs: [[7, 16, -5, 14]] }
        : { dir: 'right', dx: 8, dy: -4, arms: [[10, 12, 14, 8]], legs: [[8, 16, 20, 14]] };
    } else if (kind === 'hissatsu') {
      if (t < 6) info = { dir: 'down', armless: true, crouch: true, arms: [[3, 15, 1, 12], [12, 15, 14, 12]] };
      else if (t < 24) {
        const k = (t - 6) / 18;
        const dy = -Math.round(Math.sin(k * Math.PI) * 26);
        info = t < 14 ? { dir: 'down', armless: true, dy, arms: [[3, 12, -1, 3], [12, 12, 16, 3]] } : { dir: 'right', dy, dx: Math.round((k - 0.5) * 10), arms: [[10, 12, 14, 8]], legs: [[8, 16, 19, 19]] };
      } else info = this.basePose('a', 10);
    } else {
      info = this.basePose(kind, t);
    }
    if (this.state === 'fail' && this.st >= 10 && this.cur && this.cur.kind !== 'henshin') { rot = -(Math.PI / 2) * Math.min(1, (this.st - 10) / 6); info = { dir: 'down' }; kind = 'hurt'; }
    const air = (info.dy || 0) < -6;
    if (!rot) shadowAt(ctx, x + 24, feet - 1, air ? 12 : 18, air ? 2 : 3);
    const glow = this.cur && this.state === 'input' ? this.cur.idx / this.cur.n : hero ? 0.8 : 0.2;
    const flick = this.state === 'input' && (this.pt >> 2) % 2 ? 0.15 : 0;
    this.drawPerson(ctx, sheet, look, x, feet, s, info, {
      rot,
      pop: Math.min(1, (t + 1) / 3),
      under: hero ? (c) => {
        if (info.dir !== 'down') return;
        const w = (this.pt >> 3) % 2;
        c.fillStyle = INK; c.fillRect(11, 9, 5, 4); c.fillRect(14, 10 + w, 5, 4);
        c.fillStyle = '#ffd23f'; c.fillRect(12, 10, 3, 2); c.fillRect(15, 11 + w, 3, 2);
      } : null,
      over: (c) => this.henshin_belt(c, info.dir, clamp(glow + flick, 0, 1)),
    });
    if (kind === 'hurt' && this.st > 16) this.drawDizzy(ctx, x + 2, feet - 14, this.pt);
    if (this.state === 'input' && this.cur && this.cur.kind === 'henshin' && this.cur.idx > 0) {
      // charging aura
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.pt / 3);
      for (let i = 0; i < this.cur.idx; i++) {
        const a = this.pt / 10 + (i * Math.PI * 2) / this.cur.n;
        sparkle(ctx, 160 + Math.cos(a) * 30, 120 + Math.sin(a) * 34, 2, CMD_COLOR[this.cur.seq[i]]);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ================================================================ KAIJU (怪獣スーツアクター)
  kaiju_bg(c, r) {
    vgrad(c, 0, 16, W, 112, [[0, '#060918'], [0.6, '#152050'], [1, '#2e3e78']]);
    for (let i = 0; i < 60; i++) rect(c, Math.floor(r() * W), 18 + Math.floor(r() * 60), 1, 1, r() < 0.3 ? '#ffffff' : '#8890c8');
    // painted moon on the backdrop
    fillEllipse(c, 56, 40, 9, 9, '#f2eccf');
    fillEllipse(c, 59, 38, 8, 8, '#1a2452');
  }

  kaiju_setup() {
        this.kFace = 'left';
    this.kFallT = 0;
    this.camX = 60;
    this.camFrom = 60;
    this.camTo = 0;
    const kinds = shuffle(BLD_TARGETS, this.rng);
    this.blds = [];
    for (let i = 0; i < this.R; i++) {
      const kind = kinds[i % kinds.length];
      const wx = 96 - i * 120;
      this.blds.push({ ...BLD[kind], kind, wx, target: true, round: i, dmg: 0, col: 0, colT: 0, hitT: 0, seed: i * 17 + 3 });
      this.blds.push({ ...BLD.house, kind: 'house', wx: wx - 50, seed: i * 31 + 5, dmg: 0, col: 0 });
      this.blds.push({ ...BLD.shop, kind: 'shop', wx: wx - 84, seed: i * 29 + 7, dmg: 0, col: 0 });
    }
    for (const [wx, kind] of [[164, 'shop'], [200, 'house'], [236, 'apartment'], [286, 'house'], [316, 'shop']]) {
      this.blds.push({ ...BLD[kind], kind, wx, h: kind === 'apartment' ? 44 : BLD[kind].h, seed: wx, dmg: 0, col: 0 });
    }
    this.blds.sort((a, b) => a.wx - b.wx);
    this.skyFar = this.kaiju_skyline(mulberry32(41), '#121a3e', 60, 20, 46, '#ffd870', 0.25);
    this.skyNear = this.kaiju_skyline(mulberry32(73), '#1c2754', 44, 14, 34, '#ffe9a0', 0.35);
    this.street = this.kaiju_street();
  }

  kaiju_skyline(r, col, hMax, hMin, wMax, lit, litP) {
    const [cv, c] = makeCanvas(640, 80);
    for (let x = 0; x < 640;) {
      const w = 10 + Math.floor(r() * (wMax - 10));
      const h = hMin + Math.floor(r() * (hMax - hMin));
      rect(c, x, 80 - h, w, h, col);
      if (r() < 0.25) rect(c, x + Math.floor(w / 2), 80 - h - 6, 1, 6, col);
      for (let yy = 80 - h + 3; yy < 78; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) if (r() < litP) rect(c, xx, yy, 1, 2, lit);
      x += w + Math.floor(r() * 3);
    }
    return cv;
  }

  kaiju_street() {
    const [cv, c] = makeCanvas(640, 32);
    const r = mulberry32(99);
    rect(c, 0, 0, 640, 6, '#7a7e88');
    rect(c, 0, 6, 640, 1, '#a8acb4');
    rect(c, 0, 7, 640, 16, '#373a44');
    for (let x = 0; x < 640; x += 16) rect(c, x, 14, 8, 1, '#e8e8e8');
    rect(c, 0, 23, 640, 1, '#a8acb4');
    rect(c, 0, 24, 640, 4, '#7a7e88');
    for (let x = 0; x < 640; x += 6) rect(c, x, 24, 1, 4, '#6a6e78');
    rect(c, 0, 28, 640, 4, '#3a2a1e');
    rect(c, 0, 28, 640, 1, '#5a4430');
    // tiny cars
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * 620), y = r() < 0.5 ? 9 : 16;
      const col = pickR(['#d84a3a', '#3a8ad8', '#e8e8e8', '#ffd23f', '#5ee07a'], r);
      rect(c, x, y, 9, 4, INK);
      rect(c, x + 1, y, 7, 3, col);
      rect(c, x + 2, y, 4, 1, '#bfe4ff');
    }
    // street lamps & tiny trees on the back sidewalk
    for (let x = 12; x < 640; x += 40) {
      rect(c, x, 0, 1, 5, '#9aa0aa');
      fillEllipse(c, x + 20, 3, 3, 2, '#2f6b34');
    }
    return cv;
  }

  kaiju_open() {
    this.banner = { text: '大怪獣、ミニチュアの街に上陸！', t: 0 };
    this.later(26, () => { this.setPose('up', 40); this.snd('roar'); this.shake(14, 3); this.doShout('ガオー！', '#d8ffb8', 30); });
  }

  kaiju_walkLen(i) { return i === 0 ? 30 : 44; }

  kaiju_target() { return this.blds.find((b) => b.target && b.round === this.ri); }

  kaiju_call(i) {
    const b = this.kaiju_target();
    const name = b ? b.name : 'ビル';
    if (i === this.R - 1 && this.R > 1) return `最後は ${name}だ！`;
    return `${name}を ${pickR(['こわせ！', 'ふみつぶせ！', 'なぎたおせ！'], this.rng)}`;
  }

  kaiju_round(i) {
    this.camFrom = this.camX;
    this.camTo = -i * 120;
    this.kFace = 'left';
    this.kFallT = 0;
  }

  kaiju_tick() {
    if (this.state === 'cue' && this.st <= this.walkLen) {
      const k = this.st / this.walkLen;
      this.camX = lerp(this.camFrom, this.camTo, easeIO(k));
      if (this.st % 14 === 7 && this.st < this.walkLen - 4) { this.snd('stomp'); this.shake(4, 2); this.spawn({ type: 'dust', x: 210 + (this.rng() - 0.5) * 30, y: 151, r: 4, life: 18, color: '#9a9aa8' }); }
    }
    for (const b of this.blds) {
      if (b.colT > 0) { b.colT++; b.col = Math.min(1, b.colT / 28); }
      if (b.hitT > 0) b.hitT--;
    }
    if (this.kFallT > 0) this.kFallT++;
  }

  kaiju_hit(k) {
    const b = this.kaiju_target();
    if (b) { b.dmg = this.cur.idx / this.cur.n; b.hitT = 6; }
    this.setPose(k, 18);
    const faceL = this.kFace === 'left';
    switch (k) {
      case 'left':
      case 'right':
        this.kFace = k;
        this.snd('swish');
        this.popup('ブンッ', k === 'left' ? 284 : 150, 122, '#d8ffb8', 10);
        break;
      case 'down':
        this.snd('stomp');
        this.shake(6, 3);
        for (let i = 0; i < 3; i++) this.spawn({ type: 'dust', x: (this.kFace === 'left' ? 196 : 240) + i * 10 - 10, y: 151, vx: (i - 1) * 0.5, r: 4, life: 20, color: '#a8a8b4' });
        this.popup('ズシン！', this.kFace === 'left' ? 196 : 236, 132, '#ffffff', 10);
        break;
      case 'up':
        this.snd('growl');
        this.shake(4, 2);
        this.popup('ガオー！', faceL ? 162 : 274, 84, '#d8ffb8', 10);
        break;
      case 'a': {
        this.snd('beam');
        const mx = faceL ? 176 : 260;
        this.spawn({ type: 'beam', x: mx, y: 101, x2: faceL ? -10 : W + 10, life: 16 });
        break;
      }
      case 'b':
        this.snd('growl');
        this.popup('グルル…', faceL ? 246 : 194, 56, '#d8ffb8', 10);
        break;
      default: break;
    }
  }

  kaiju_clear() {
    const b = this.kaiju_target();
    this.kFace = 'left';
    this.setPose('up', 40);
    this.snd('roar');
    this.doShout('ガオーッ！', '#d8ffb8', 28);
    this.later(6, () => {
      if (b) {
        b.colT = 1;
        const sx = b.wx - this.camX;
        for (let i = 0; i < 10; i++) this.spawn({ type: 'dust', x: sx + this.rng() * b.w, y: 124 - this.rng() * 10, vx: (this.rng() - 0.5) * 0.8, vy: -0.2 - this.rng() * 0.4, r: 4 + this.rng() * 4, grow: 0.4, life: 40, color: '#b8b4c0', a: 0.9 });
        for (let i = 0; i < 14; i++) this.spawn({ type: 'sq', x: sx + this.rng() * b.w, y: 128 - b.h * this.rng(), vx: (this.rng() - 0.5) * 3, vy: -1.5 - this.rng() * 2, g: 0.25, floor: 128, s: 2 + Math.floor(this.rng() * 2), color: pickR(['#7d8db0', '#a8a8b0', '#6a6a72', '#c8b8a0'], this.rng), life: 46 });
        this.popup('ドガーン！', sx + b.w / 2, 80, '#ffe680', 14);
      }
      this.snd('crash');
      this.shake(16, 4);
    });
  }

  kaiju_fail() {
    this.kFallT = 1;
    this.later(7, () => { this.snd('stomp'); this.shake(10, 3); this.g.sfx('zukko'); this.popup('ドテーン！', 150, 120, '#ffffff', 12); });
    this.later(16, () => this.doShout('カット！あいたた…', '#c8d0ff', 20));
  }

  kaiju_close(good) {
    this.kFace = 'left';
    if (good) {
      this.setPose('up', 60);
      this.snd('roar');
      this.shake(16, 3);
      this.doShout('ガオオオーッ！', '#d8ffb8', 28, 100);
      this.later(20, () => this.g.sfx('applause'));
    } else {
      this.setPose('idle', 10);
      this.doShout('カット！おつかれさま！', '#c8d0ff', 18, 100);
    }
  }

  kaiju_draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    // searchlights
    ctx.globalAlpha = 0.09;
    for (let i = 0; i < 2; i++) {
      const bx = i ? 286 : 30;
      const a = -Math.PI / 2 + Math.sin(this.pt / 70 + i * 2) * 0.55;
      const tx = bx + Math.cos(a) * 200, ty = 126 + Math.sin(a) * 200;
      fillPoly(ctx, [[bx - 2, 126], [bx + 2, 126], [tx + 14, ty], [tx - 14, ty]], '#e8f0ff');
    }
    ctx.globalAlpha = 1;
    const off = (k, w) => -((((this.camX * k) % w) + w) % w);
    const o1 = off(0.25, 640), o2 = off(0.5, 640), o3 = off(1, 640);
    ctx.drawImage(this.skyFar, o1, 52); ctx.drawImage(this.skyFar, o1 + 640, 52);
    ctx.drawImage(this.skyNear, o2, 50); ctx.drawImage(this.skyNear, o2 + 640, 50);
    ctx.drawImage(this.street, o3, 126); ctx.drawImage(this.street, o3 + 640, 126);
    // miniature buildings
    for (const b of this.blds) {
      const sx = b.wx - this.camX;
      if (sx > W + 10 || sx + b.w < -40) continue;
      this.kaiju_drawBuilding(ctx, b, sx, 128);
    }
    // target marker
    const tb = this.kaiju_target();
    if (tb && !tb.colT && (this.state === 'input' || (this.state === 'cue' && this.st > this.walkLen))) {
      const mx = tb.wx - this.camX + tb.w / 2;
      const my = 128 - tb.h - 14 - (Math.floor(this.pt / 8) % 2) * 2;
      ctx.fillStyle = INK;
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(mx - 6 + i), my + i - 1, 13 - i * 2, 2);
      ctx.fillStyle = '#ff5d6c';
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(mx - 5 + i), my + i, 11 - i * 2, 1);
    }
    this.drawParts(ctx, 'back');
    this.kaiju_drawMonster(ctx);
    this.drawParts(ctx, 'front');
  }

  kaiju_drawBuilding(ctx, b, sx, base) {
    const x = Math.round(sx);
    if (b.col >= 1) { this.kaiju_rubble(ctx, x, base, b.w, 1); return; }
    ctx.save();
    if (b.hitT > 0) ctx.translate(b.hitT % 2 ? 1 : -1, 0);
    if (b.col > 0) {
      ctx.beginPath();
      ctx.rect(x - 30, 0, b.w + 60, base);
      ctx.clip();
      ctx.translate(x + b.w / 2, base + b.col * b.h);
      ctx.rotate(Math.sin(b.col * 10) * 0.06);
      ctx.translate(-(x + b.w / 2), -base);
    }
    this.kaiju_drawBld(ctx, b, x, base);
    if (b.dmg > 0) {
      const nC = Math.ceil(b.dmg * 4);
      for (let i = 0; i < nC; i++) {
        const rr = mulberry32(b.seed * 13 + i * 7);
        let cx = x + 4 + rr() * (b.w - 8), cy = base - b.h * (0.3 + rr() * 0.6);
        ctx.fillStyle = INK;
        for (let j = 0; j < 7; j++) { ctx.fillRect(Math.round(cx), Math.round(cy), 1, 2); cx += (rr() - 0.5) * 4; cy += 2; }
      }
    }
    ctx.restore();
    if (b.col > 0) this.kaiju_rubble(ctx, x, base, b.w, b.col);
  }

  kaiju_rubble(ctx, x, base, w, k) {
    const h = Math.round(4 + 8 * k);
    fillPoly(ctx, [[x - 4, base], [x + 4, base - h], [x + w * 0.4, base - h - 2], [x + w - 6, base - h + 1], [x + w + 4, base]], '#5e5e68');
    for (let i = 0; i < 6; i++) rect(ctx, x + 2 + ((i * 37) % Math.max(4, w - 4)), base - 3 - ((i * 5) % h), 4, 3, i % 2 ? '#8a8a96' : '#73737e');
  }

  kaiju_drawBld(ctx, b, x, base) {
    const { w, h } = b;
    const top = base - h;
    const cx = x + Math.floor(w / 2);
    switch (b.kind) {
      case 'office':
        rect(ctx, x, top, w, h, '#7d8db0');
        rect(ctx, x + w - 4, top, 4, h, '#5d6d90');
        rect(ctx, x, top, w, 2, '#a8b8d8');
        for (let yy = top + 5; yy < base - 8; yy += 6) for (let xx = x + 3; xx < x + w - 6; xx += 5) rect(ctx, xx, yy, 3, 3, hash2(xx, yy, b.seed) < 0.55 ? '#ffe08a' : '#34405e');
        rect(ctx, cx - 4, base - 7, 8, 7, '#34405e');
        rect(ctx, cx, top - 8, 1, 8, '#c8ccd4');
        if ((this.pt >> 4) % 2) rect(ctx, cx - 1, top - 10, 3, 2, '#ff4040');
        break;
      case 'tower': {
        const legTop = top + 20;
        for (let yy = legTop; yy < base; yy++) {
          const f = (yy - legTop) / (base - legTop);
          const half = Math.round(4 + f * (w / 2 - 4));
          const col = Math.floor((base - yy) / 10) % 2 ? '#f2f2f2' : '#e04a3a';
          rect(ctx, cx - half, yy, 2, 1, col);
          rect(ctx, cx + half - 2, yy, 2, 1, col);
          if ((base - yy) % 10 === 0) rect(ctx, cx - half, yy, half * 2, 1, col);
          if ((base - yy) % 10 < 9) {
            const q = ((base - yy) % 10) / 10;
            rect(ctx, Math.round(cx - half + q * half * 2), yy, 1, 1, col);
            rect(ctx, Math.round(cx + half - q * half * 2), yy, 1, 1, col);
          }
        }
        rect(ctx, cx - 9, top + 34, 18, 7, '#e8e8f0');
        rect(ctx, cx - 8, top + 36, 16, 2, '#5fd7ff');
        rect(ctx, cx - 6, top + 54, 12, 4, '#e8e8f0');
        for (let yy = top; yy < legTop; yy++) rect(ctx, cx - 1, yy, 3, 1, Math.floor(yy / 5) % 2 ? '#f2f2f2' : '#e04a3a');
        if ((this.pt >> 4) % 2) rect(ctx, cx - 1, top - 2, 3, 2, '#ff4040');
        break;
      }
      case 'dept':
        rect(ctx, x, top, w, h, '#e6d6b4');
        rect(ctx, x + w - 4, top, 4, h, '#c6b694');
        rect(ctx, x, top, w, 3, '#f6ecd4');
        rect(ctx, x + 4, top + 6, w - 8, 9, '#d83a4a');
        for (let i = 0; i < 5; i++) rect(ctx, x + 9 + i * 8, top + 9, 4, 3, '#ffffff');
        for (let yy = top + 19; yy < base - 14; yy += 7) {
          rect(ctx, x + 3, yy, w - 7, 4, '#7ab0d8');
          for (let xx = x + 8; xx < x + w - 6; xx += 7) rect(ctx, xx, yy, 1, 4, '#c6b694');
        }
        for (let i = 0; i < Math.floor((w - 4) / 4); i++) rect(ctx, x + 2 + i * 4, base - 13, 4, 3, i % 2 ? '#ffffff' : '#d83a4a');
        rect(ctx, cx - 7, base - 10, 14, 10, '#5a8ab0');
        rect(ctx, cx, base - 10, 1, 10, '#c6b694');
        break;
      case 'apartment':
        rect(ctx, x, top, w, h, '#ddd2bc');
        rect(ctx, x + w - 4, top, 4, h, '#bdb29c');
        rect(ctx, x - 1, top, w + 2, 2, '#9a8f7a');
        for (let yy = top + 4; yy < base - 6; yy += 8) {
          for (let xx = x + 3; xx < x + w - 8; xx += 9) rect(ctx, xx, yy, 6, 4, hash2(xx, yy, b.seed) < 0.5 ? '#ffe08a' : '#6a8ab8');
          rect(ctx, x + 2, yy + 5, w - 6, 1, '#8a8070');
          if (hash2(yy, x, b.seed) < 0.4) rect(ctx, x + 4 + Math.floor(hash2(x, yy, 3) * (w - 12)), yy + 3, 2, 2, pickR(['#ff7eb6', '#5fd7ff', '#ffd23f'], mulberry32(yy)));
        }
        rect(ctx, cx - 3, base - 6, 6, 6, '#6a5a48');
        break;
      case 'factory': {
        const n = Math.floor((w - 12) / 10);
        for (let i = 0; i < n; i++) fillPoly(ctx, [[x + i * 10, top + 8], [x + i * 10 + 10, top], [x + i * 10 + 10, top + 8]], i % 2 ? '#8a8a92' : '#9a9aa2');
        rect(ctx, x, top + 8, w, h - 8, '#a2a2a8');
        rect(ctx, x, top + 8, w, 1, '#c8c8d0');
        rect(ctx, x + 3, top + 14, w - 18, 4, '#5a6a80');
        rect(ctx, x + 6, base - 10, 10, 10, '#5a5f6b');
        for (let yy = base - 9; yy < base; yy += 2) rect(ctx, x + 6, yy, 10, 1, '#4a4e58');
        const chx = x + w - 10;
        rect(ctx, chx, top - 26, 6, h + 26, '#c8c8d0');
        rect(ctx, chx + 4, top - 26, 2, h + 26, '#a8a8b0');
        rect(ctx, chx, top - 26, 6, 3, '#e04a3a');
        rect(ctx, chx, top - 18, 6, 3, '#e04a3a');
        if (!b.col) {
          for (let i = 0; i < 3; i++) {
            const ph = ((this.pt + i * 20) % 60) / 60;
            ctx.globalAlpha = 0.6 * (1 - ph);
            fillEllipse(ctx, chx + 3 + ph * 10, top - 30 - ph * 22, 3 + ph * 5, 2 + ph * 3, '#c8c8d8');
          }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'castle': {
        fillPoly(ctx, [[x, base], [x + 6, base - 18], [x + w - 6, base - 18], [x + w, base]], '#8f897c');
        for (let yy = base - 15; yy < base; yy += 4) rect(ctx, x + 3, yy, w - 6, 1, '#77716a');
        const tier = (y0, hw, hh) => {
          rect(ctx, cx - hw, y0 - hh, hw * 2, hh, '#f2f0e6');
          for (let xx = cx - hw + 3; xx < cx + hw - 2; xx += 5) rect(ctx, xx, y0 - hh + 3, 2, 3, '#3a4a5c');
          fillPoly(ctx, [[cx - hw - 5, y0 - hh + 1], [cx - hw + 1, y0 - hh - 4], [cx + hw - 1, y0 - hh - 4], [cx + hw + 5, y0 - hh + 1]], '#3a4a5c');
          rect(ctx, cx - hw - 5, y0 - hh, hw * 2 + 10, 1, '#5a6a7c');
        };
        tier(base - 18, w / 2 - 8, 11);
        tier(base - 33, w / 2 - 13, 9);
        tier(base - 46, w / 2 - 17, 8);
        rect(ctx, cx - 9, top + 1, 2, 3, '#ffd23f');
        rect(ctx, cx + 7, top + 1, 2, 3, '#ffd23f');
        break;
      }
      case 'house':
        rect(ctx, x, base - 11, w, 11, '#e8dcc8');
        fillPoly(ctx, [[x - 3, base - 10], [x + w / 2, base - h], [x + w + 3, base - 10]], '#a8483a');
        rect(ctx, x + 3, base - 8, 4, 4, '#6a8ab8');
        rect(ctx, x + w - 8, base - 7, 4, 7, '#7a5634');
        break;
      case 'shop':
        rect(ctx, x, top, w, h, '#c8a878');
        rect(ctx, x, top, w, 2, '#e0c898');
        rect(ctx, x + 3, top + 4, w - 6, 4, '#5fd7ff');
        for (let i = 0; i < Math.floor(w / 4); i++) rect(ctx, x + i * 4, top + 10, 4, 3, i % 2 ? '#ffffff' : '#3a9a5a');
        rect(ctx, x + 4, base - 7, w - 8, 7, '#8ab8d8');
        break;
      default: break;
    }
  }

  // The monster suit (drawn from pixel primitives, facing left in a 32x30 box).
  kaiju_drawMonster(ctx) {
    const s = 3, x = 170, feet = 152;
    const kind = this.pose.kind, t = this.pose.t;
    const face = this.kFace;
    let mouth = 0, tail = 0, claws = false, step = 0, headUp = 0, glow = false;
    if (this.state === 'cue' && this.st < this.walkLen && this.ri > 0) step = Math.floor(this.st / 7) % 2 ? 1 : -1;
    switch (kind) {
      case 'down': step = t < 6 ? 1 : 0; break;
      case 'up': mouth = 2; headUp = t < 26 ? 1 : 0; break;
      case 'left':
      case 'right': tail = Math.sin(Math.min(1, t / 14) * Math.PI * 2) * 0.45; break;
      case 'a': mouth = t < 16 ? 1 : 0; glow = t < 16; break;
      case 'b': claws = true; mouth = 1; break;
      default: break;
    }
    if (this.state === 'cue' && this.st < this.walkLen && this.ri > 0) glow = false;
    // tripped: plops down on its bottom, dizzy
    const sit = this.kFallT > 0 && this.kFallT < 52 ? Math.min(1, this.kFallT / 5) * (this.kFallT > 44 ? (52 - this.kFallT) / 8 : 1) : 0;
    const back = Math.round(sit * 3) * (face === 'left' ? 1 : -1);
    const breathe = kind === 'idle' && !step && Math.floor(this.pt / 24) % 2 ? 1 : 0;
    shadowAt(ctx, x + 50, feet - 1, 42, 4);
    const G = '#4f9a48', D = '#3a7a36', L = '#7cc65e', P = glow && (this.pt >> 1) % 2 ? '#bff4ff' : glow ? '#8fe8ff' : '#c8f088';
    const E = (cx, cy, rx, ry, col) => { fillEllipse(ctx, cx, cy, rx + 1, ry + 1, INK); fillEllipse(ctx, cx, cy, rx, ry, col); };
    ctx.save();
    ctx.translate(x + 16 * s + back * s, feet);
    ctx.scale(s, sit > 0 ? (s * 25) / 30 : s);
    ctx.translate(-16, -30);
    if (face === 'right') { ctx.translate(32, 0); ctx.scale(-1, 1); }
    // tail
    const ca = Math.cos(tail), sa = Math.sin(-tail);
    const tp = [[18, 16], [24, 19], [29, 23], [33, 29], [27, 29.5], [21, 27], [16, 24]].map(([px, py]) => {
      const dx = px - 19, dyy = py - 22;
      return [19 + dx * ca - dyy * sa, 22 + dx * sa + dyy * ca];
    });
    polyOut(ctx, tp, D);
    // back leg
    const bl = step < 0 ? -3 : 0;
    E(20, 25 + bl, 3, 4, D);
    rect(ctx, 16, 27 + bl, 9, 3, INK);
    rect(ctx, 17, 27 + bl, 7, 2, D);
    // dorsal plates
    const hy = -headUp - breathe * 0;
    for (const tri of [[[14, 3 + hy], [18, -1 + hy], [19, 4 + hy]], [[18, 7], [23, 4], [23, 10]], [[21, 11], [27, 9], [25, 15]], [[23, 16], [29, 15], [25, 20]]]) polyOut(ctx, tri, P);
    // body
    E(16, 19 + breathe, 8, 8, G);
    rect(ctx, 18, 13 + breathe, 4, 1, L);
    // head & snout
    E(11, 9 + hy, 7, 6, G);
    E(5, 11 + hy, 4, 3, G);
    rect(ctx, 8, 4 + hy, 5, 1, L);
    rect(ctx, 3, 9 + hy, 3, 1, L);
    // eye
    if (sit > 0.5) {
      for (const [ex, ey] of [[7, 5], [9, 5], [8, 6], [7, 7], [9, 7]]) rect(ctx, ex, ey + hy, 1, 1, INK);
    } else {
      rect(ctx, 7, 6 + hy, 4, 3, INK);
      rect(ctx, 8, 6 + hy, 3, 2, '#ffe14a');
      rect(ctx, 8, 6 + hy, 1, 2, INK);
    }
    rect(ctx, 6, 5 + hy, 6, 1, D);
    rect(ctx, 2, 10 + hy, 1, 1, INK);
    // mouth
    if (mouth) {
      const m = mouth + 1;
      rect(ctx, 1, 12 + hy, 8, m + 1, INK);
      rect(ctx, 2, 13 + hy, 6, m - 1, '#d83a4a');
      rect(ctx, 2, 12 + hy, 1, 1, '#ffffff');
      rect(ctx, 5, 12 + hy, 1, 1, '#ffffff');
      rect(ctx, 3, 12 + hy + m, 1, 1, '#ffffff');
    } else {
      rect(ctx, 1, 13 + hy, 7, 1, INK);
      rect(ctx, 4, 14 + hy, 1, 1, '#ffffff');
    }
    // front leg
    const fl = step > 0 ? -3 : 0;
    E(12, 25 + fl, 3, 4, G);
    rect(ctx, 7, 27 + fl, 9, 3, INK);
    rect(ctx, 8, 27 + fl, 7, 2, G);
    rect(ctx, 7, 28 + fl, 1, 1, '#ffffff');
    rect(ctx, 9, 29 + fl, 1, 1, '#ffffff');
    // belly
    fillEllipse(ctx, 13, 21 + breathe, 4, 5, '#d8e8a0');
    for (const yy of [18, 21, 24]) rect(ctx, 10, yy + breathe, 7, 1, '#b4c87c');
    // arm
    if (claws) {
      limb(ctx, 11, 16, 5, 9, G, G);
      rect(ctx, 4, 8, 1, 1, '#ffffff');
      rect(ctx, 6, 8, 1, 1, '#ffffff');
    } else {
      limb(ctx, 11, 16, 7, 19, G, G);
      rect(ctx, 6, 20, 1, 1, '#ffffff');
    }
    ctx.restore();
    if (this.kFallT > 8 && this.kFallT < 46) this.drawDizzy(ctx, face === 'left' ? 206 : 230, 74, this.pt);
    if (glow) for (let i = 0; i < 3; i++) sparkle(ctx, (face === 'left' ? x + 66 : x + 30) + Math.cos(this.pt / 4 + i * 2) * 10, 80 + i * 12, 2, '#bff4ff');
  }

  // ================================================================ ACTING (感情演技)
  acting_bg(c, r) {
    rect(c, 0, 16, W, 142, '#17131c');
    // lighting rig
    rect(c, 0, 18, W, 3, '#3a3d48');
    for (let x = 0; x < W; x += 8) rect(c, x, 18, 1, 3, '#5a5f6b');
    for (const lx of [40, 120, 200, 280]) {
      rect(c, lx - 1, 21, 2, 4, '#2a2d36');
      rect(c, lx - 6, 25, 12, 7, '#2a2d36');
      rect(c, lx - 4, 31, 8, 2, '#ffe9a0');
    }
    // set wall (flat)
    const x0 = 20, x1 = 300, y0 = 38;
    rect(c, x0, y0, x1 - x0, 104, '#e9dfc4');
    for (let y = y0 + 4; y < 112; y += 8) for (let x = x0 + 4 + ((y >> 3) % 2) * 4; x < x1; x += 8) rect(c, x, y, 1, 1, '#d6c8a6');
    rect(c, x0, 112, x1 - x0, 30, '#8a6440');
    rect(c, x0, 112, x1 - x0, 2, '#6a4a2e');
    for (let x = x0 + 4; x < x1 - 20; x += 28) { rect(c, x, 117, 22, 21, '#7a5636'); rect(c, x, 117, 22, 1, '#6a4a2e'); }
    rect(c, x0 - 3, y0 - 3, x1 - x0 + 6, 3, '#5a4030');
    rect(c, x0 - 3, y0, 3, 104, '#5a4030');
    rect(c, x1, y0, 3, 104, '#5a4030');
    // window with curtains
    rect(c, 42, 50, 54, 46, '#f4f0e8');
    vgrad(c, 45, 53, 48, 40, [[0, '#7ec0f0'], [1, '#c8e8fa']]);
    fillEllipse(c, 60, 66, 7, 3, '#ffffff');
    fillEllipse(c, 80, 74, 6, 2, '#ffffff');
    rect(c, 68, 53, 2, 40, '#f4f0e8');
    rect(c, 45, 72, 48, 2, '#f4f0e8');
    for (const cx of [38, 90]) {
      rect(c, cx, 46, 10, 52, '#c85a5a');
      for (let x = cx + 2; x < cx + 10; x += 3) rect(c, x, 46, 1, 52, '#a84040');
    }
    rect(c, 34, 45, 68, 2, '#6a4a2e');
    // clock
    fillEllipse(c, 150, 56, 9, 9, '#6a4a2e');
    fillEllipse(c, 150, 56, 7, 7, '#fbf8f0');
    rect(c, 150, 51, 1, 5, INK);
    rect(c, 150, 56, 4, 1, INK);
    // framed picture
    rect(c, 196, 50, 34, 26, '#c8a040');
    rect(c, 199, 53, 28, 20, '#9fd0f0');
    fillPoly(c, [[199, 73], [210, 60], [218, 66], [227, 58], [227, 73]], '#4f9a48');
    // floor
    rect(c, 0, 142, W, 16, '#a87a4a');
    for (let y = 145; y < 158; y += 4) rect(c, 0, y, W, 1, '#93683c');
    for (let i = 0; i < 18; i++) rect(c, (i * 47) % W, 142 + (i % 4) * 4, 1, 4, '#7a5430');
    rect(c, 0, 142, W, 1, '#6a4a2e');
    // sofa
    roundBox(c, 104, 104, 104, 22, '#3e6a9c');
    rect(c, 108, 107, 96, 2, '#5a8ac0');
    roundBox(c, 100, 118, 112, 22, '#36608e');
    roundBox(c, 98, 112, 12, 26, '#4a78aa');
    roundBox(c, 202, 112, 12, 26, '#4a78aa');
    rect(c, 112, 120, 88, 2, '#4a78aa');
    rect(c, 104, 139, 4, 3, '#3a2a1e');
    rect(c, 204, 139, 4, 3, '#3a2a1e');
    // side table & lamp
    rect(c, 64, 124, 26, 3, '#7a5430');
    rect(c, 66, 127, 3, 15, '#6a4a2e');
    rect(c, 85, 127, 3, 15, '#6a4a2e');
    rect(c, 76, 110, 2, 14, '#c8a040');
    fillPoly(c, [[70, 112], [72, 100], [82, 100], [84, 112]], '#f6e8c0');
    c.globalAlpha = 0.18;
    fillEllipse(c, 77, 106, 16, 12, '#fff2b0');
    c.globalAlpha = 1;
    // plant
    rect(c, 226, 128, 14, 14, '#c0603a');
    rect(c, 225, 127, 16, 2, '#a04a2a');
    for (const [lx, ly, lr] of [[233, 118, 6], [227, 112, 5], [239, 110, 5], [233, 104, 4]]) fillEllipse(c, lx, ly, lr, lr * 0.8, '#3f8a3a');
    rect(c, 232, 110, 1, 18, '#2f6b34');
    // director's chair
    rect(c, 4, 134, 2, 22, '#5a4030');
    rect(c, 36, 134, 2, 22, '#5a4030');
    rect(c, 4, 124, 34, 9, '#2a2d36');
    rect(c, 4, 140, 34, 3, '#2a2d36');
    fillPoly(c, [[4, 156], [36, 143], [38, 143], [6, 156]], '#5a4030');
    fillPoly(c, [[36, 156], [4, 143], [6, 143], [38, 156]], '#5a4030');
    // camera on a tripod
    for (const [ax, bx] of [[288, 270], [292, 306], [290, 290]]) fillPoly(c, [[ax - 1, 124], [ax + 1, 124], [bx + 1, 157], [bx - 1, 157]], '#3a3d48');
    rect(c, 272, 104, 40, 20, '#2a2d36');
    rect(c, 272, 104, 40, 2, '#4a4e5a');
    rect(c, 262, 108, 12, 12, '#1a1c22');
    fillEllipse(c, 262, 114, 4, 6, '#3a4a6a');
    rect(c, 260, 111, 2, 3, '#8fe8ff');
    rect(c, 300, 98, 10, 6, '#3a3d48');
    // boom mic
    fillPoly(c, [[318, 20], [320, 22], [212, 46], [210, 44]], '#8a909c');
    roundBox(c, 196, 42, 18, 9, '#9a9aa4');
    for (let x = 198; x < 212; x += 2) rect(c, x, 44, 1, 5, '#7a7a84');
  }

  acting_setup() {
    this.plSheet = charSheet(this.look);
    this.coLook = { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#5a6fb0', skirt: true };
    this.coSheet = charSheet(this.coLook);
    this.dirLook = LOOKS.director;
    this.dirSheet = charSheet(this.dirLook);
    this.emo = null;
    this.dirSay = null;
    this.coEmote = null;
    this.clapT = 0;
    this.ngT = 0;
    this.closeEmo = null;
  }

  acting_open() {
    this.banner = { text: 'ドラマ撮影、本番いきます！', t: 0 };
    this.dirSay = { text: 'よろしく！', t: 0 };
    this.later(36, () => { this.coEmote = { ch: '♪', t: 0 }; this.snd('voice'); });
  }

  acting_walkLen() { return 18; }

  acting_call(i) { return `シーン${i + 1}「${this.cur.scene ? this.cur.scene.title : '本番'}」`; }

  acting_round() {
    this.emo = null;
    this.dirSay = null;
    this.coEmote = null;
    this.ngT = 0;
  }

  acting_go() {
    this.clapT = 1;
    this.snd('clapper');
  }

  acting_tick() {
    if (this.clapT > 0) { this.clapT++; if (this.clapT > 26) this.clapT = 0; }
    if (this.ngT > 0) this.ngT++;
    if (this.emo) this.emo.t++;
    if (this.coEmote) this.coEmote.t++;
    if (this.dirSay) this.dirSay.t++;
  }

  acting_dirText() {
    if (this.dirSay) return this.dirSay.text;
    if (this.state === 'cue') return 'よーい…';
    if (this.state === 'input') {
      if (this.st < 18) return 'アクション！';
      const c = this.cur;
      return c && c.idx < c.n ? EMO[c.seq[c.idx]].call : '';
    }
    return '';
  }

  acting_hit(k) {
    this.emo = { key: k, t: 0 };
    this.coEmote = { ch: CO_REACT[k], t: 0 };
    this.snd('voice');
    this.popup(EMO[k].say, 196, 82, '#ffffff', 10);
    if (k === 'a') this.sparkBurst(200, 104, 5, ['#ffffff', '#fff6a8'], 1.4);
    if (k === 'left') this.shake(4, 1);
  }

  acting_clear() {
    this.clapT = 1;
    this.snd('clapper');
    this.dirSay = { text: pickR(['カット！最高！', 'OK！いい表情！', 'カット！完璧だ！'], this.rng), t: 0 };
    this.later(3, () => this.doShout('カット！', '#ffe680', 26));
    this.later(10, () => { this.g.sfx('applause'); this.sparkBurst(196, 100, 8, ['#ffffff', '#ffd23f'], 2); });
    this.later(18, () => { this.emo = { key: 'up', t: 0 }; this.coEmote = { ch: '♪', t: 0 }; });
  }

  acting_fail() {
    this.ngT = 1;
    this.g.sfx('buzz');
    this.dirSay = { text: 'NG！もう一回！', t: 0 };
    this.emo = { key: 'b', t: 0 };
    this.coEmote = { ch: '…', t: 0 };
    this.later(14, () => this.g.sfx('laugh'));
  }

  acting_close(good) {
    this.dirSay = { text: good ? 'オールアップ！' : 'おつかれさま！', t: 0 };
    this.emo = { key: good ? 'up' : 'b', t: 0 };
    this.coEmote = { ch: good ? '♥' : '♪', t: 0 };
    if (good) {
      this.doShout('オールアップ！', '#ffe680', 26, 100);
      this.g.sfx('applause');
      this.confetti(30, 60, 260);
    } else {
      this.doShout('また次の現場で！', '#c8d0ff', 20, 100);
    }
  }

  acting_pose(k, t) {
    switch (k) {
      case 'up': return { dir: 'down', armless: true, dy: (t >> 2) % 2 ? -1 : 0, arms: [[3, 12, 5, 15], [12, 12, 10, 15]] };
      case 'down': return { dir: 'down', armless: true, dy: 1, arms: [[3, 12, 4, 8], [12, 12, 11, 8]] };
      case 'left': return { dir: 'down', armless: true, dx: t < 16 ? ((t >> 1) % 2 ? 1 : -1) / 3 : 0, arms: [[3, 12, 1, 6], [12, 12, 14, 6]] };
      case 'right': return { dir: 'down', armless: true, dy: -Math.round(Math.sin(Math.min(1, t / 10) * Math.PI) * 3), arms: [[3, 12, -1, 4], [12, 12, 16, 4]] };
      case 'a': return { dir: 'down', armless: true, arms: [[12, 12, 18, 6], [3, 12, 2, 16]] };
      case 'b': return { dir: 'down', armless: true, arms: [[12, 12, 12, 3], [3, 12, 2, 16]] };
      default: return { dir: 'down' };
    }
  }

  // Facial expression over a down-facing 16x20 sprite (current transform = sprite pixels).
  acting_face(c, k, t, look) {
    const skin = SKIN[look.skin] || look.skin || SKIN.fair;
    const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
    const clearEyes = () => { c.fillStyle = skin; c.fillRect(5, 6, 1, 2); c.fillRect(10, 6, 1, 2); };
    switch (k) {
      case 'up':
        clearEyes();
        for (const [x, y] of [[4, 7], [5, 6], [6, 7], [9, 7], [10, 6], [11, 7]]) px(x, y, INK);
        c.fillStyle = INK; c.fillRect(6, 8, 4, 2);
        c.fillStyle = '#e04050'; c.fillRect(7, 9, 2, 1);
        break;
      case 'down': {
        clearEyes();
        c.fillStyle = INK; c.fillRect(4, 7, 3, 1); c.fillRect(9, 7, 3, 1);
        const d = (t >> 2) % 3;
        c.fillStyle = '#5fd7ff'; c.fillRect(5, 8, 1, 1 + d); c.fillRect(10, 8, 1, 1 + d);
        c.fillStyle = INK; c.fillRect(7, 9, 2, 1);
        break;
      }
      case 'left':
        c.fillStyle = 'rgba(255,60,60,0.28)'; c.fillRect(3, 3, 10, 7);
        c.fillStyle = INK; c.fillRect(4, 5, 2, 1); c.fillRect(10, 5, 2, 1); px(6, 6, INK); px(9, 6, INK);
        c.fillRect(6, 9, 4, 1);
        px(7, 9, '#ffffff'); px(8, 9, '#ffffff');
        c.fillStyle = '#ff3048'; c.fillRect(12, 1, 1, 3); c.fillRect(11, 2, 3, 1);
        break;
      case 'right':
        c.fillStyle = INK; c.fillRect(4, 5, 3, 3); c.fillRect(9, 5, 3, 3);
        c.fillStyle = '#ffffff'; c.fillRect(4, 5, 1, 1); c.fillRect(9, 5, 1, 1);
        c.fillStyle = INK; c.fillRect(7, 8, 2, 2);
        break;
      case 'a':
        clearEyes();
        c.fillStyle = INK; c.fillRect(4, 7, 3, 1); c.fillRect(10, 6, 1, 2);
        px(8, 9, INK); px(9, 8, INK);
        break;
      case 'b':
        clearEyes();
        c.fillStyle = INK; c.fillRect(4, 6, 1, 2); c.fillRect(9, 6, 1, 2);
        c.fillStyle = '#ff8aa8'; c.fillRect(3, 8, 3, 1); c.fillRect(10, 8, 3, 1);
        px(7, 9, INK); px(8, 9, INK);
        break;
      default: break;
    }
  }

  acting_draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    // tally light on the camera
    if (this.state === 'input' || (this.pt >> 4) % 2) rect(ctx, 304, 100, 3, 3, '#ff3040');
    this.drawParts(ctx, 'back');
    // co-star
    const co = this.coEmote;
    let coInfo = { dir: 'right' };
    if (co && co.t < 40 && (co.ch === '♪' || co.ch === '♥')) coInfo = { dir: 'right', dy: (co.t >> 2) % 2 ? -1 : 0 };
    if (co && co.t < 30 && co.ch.includes('！')) coInfo = { dir: 'right', dx: -1, arms: [[10, 12, 14, 7]] };
    shadowAt(ctx, 124, 149, 18, 3);
    this.drawPerson(ctx, this.coSheet, this.coLook, 100, 150, 3, coInfo, {});
    if (co && co.t < 50) this.drawEmote(ctx, 140, 74, co.ch, co.t);
    // player
    const e = this.emo && this.emo.t < 90 ? this.emo : null;
    const info = e ? this.acting_pose(e.key, e.t) : { dir: 'down' };
    shadowAt(ctx, 196, 149, 18, 3);
    this.drawPerson(ctx, this.plSheet, this.look, 172, 150, 3, info, {
      pop: e ? Math.min(1, (e.t + 1) / 3) : 1,
      over: e ? (c) => this.acting_face(c, e.key, e.t, this.look) : null,
    });
    if (e && e.key === 'a' && e.t < 30) sparkle(ctx, 184, 106, 2 + ((e.t >> 2) % 2), '#ffffff');
    if (e && e.key === 'right' && e.t < 30) {
      ctx.fillStyle = '#ffffff';
      for (const [lx, ly, lw, lh] of [[184, 80, 2, 6], [196, 76, 2, 7], [208, 80, 2, 6]]) { rect(ctx, lx - 1, ly - 1, lw + 2, lh + 2, INK); rect(ctx, lx, ly, lw, lh, '#ffffff'); }
    }
    // director
    const dLook = this.dirLook;
    const talking = this.acting_dirText();
    this.drawPerson(ctx, this.dirSheet, dLook, 6, 156, 2, talking ? { dir: 'right', arms: [[10, 12, 14, 8]] } : { dir: 'right' }, {
      after: talking ? (c, hands) => { const h = hands[0]; if (h) { c.fillStyle = INK; c.fillRect(h[0] + 1, h[1] - 2, 5, 5); c.fillStyle = '#ffd23f'; c.fillRect(h[0] + 2, h[1] - 1, 4, 3); } } : null,
    });
    if (talking) this.acting_bubble(ctx, talking);
    this.drawParts(ctx, 'front');
    this.acting_pip(ctx, e);
    if (this.clapT > 0) this.acting_clapper(ctx, this.clapT);
    if (this.ngT > 0 && this.ngT < 64) this.acting_ng(ctx, this.ngT);
  }

  acting_bubble(ctx, str) {
    const w = Math.max(44, Math.ceil(measure(ctx, str, 10)) + 14);
    const x = 4, y = 76;
    for (let i = 0; i < 18; i++) {
      const hw = Math.max(0, Math.round((1 - i / 18) * 4));
      rect(ctx, 22 - hw - 1, y + 15 + i, hw * 2 + 2, 1, INK);
      if (hw > 0) rect(ctx, 22 - hw, y + 15 + i, hw * 2, 1, '#ffffff');
    }
    roundBox(ctx, x, y, w, 17, '#ffffff');
    rect(ctx, 18, y + 15, 8, 1, '#ffffff');
    text(ctx, str, x + w / 2, y + 3, { size: 10, align: 'center', color: str.startsWith('NG') ? '#d6243a' : '#1a1a28', shadow: null });
  }

  acting_pip(ctx, e) {
    const x = 248, y = 42, w = 66, h = 54;
    rect(ctx, x - 1, y - 1, w + 2, h + 2, INK);
    rect(ctx, x, y, w, h, '#3a3d48');
    rect(ctx, x + 1, y + 1, w - 2, h - 2, '#101018');
    const sheet = this.plSheet;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 1, y + 1, 64, 48);
    ctx.clip();
    vgrad(ctx, x + 1, y + 1, 64, 48, [[0, '#e9dfc4'], [1, '#d8c8a8']]);
    ctx.translate(x + 1, y + 2);
    ctx.scale(4, 4);
    const img = sheet.down[0];
    ctx.drawImage(img, 0, 0);
    if (e) this.acting_face(ctx, e.key, e.t, this.look);
    ctx.restore();
    rect(ctx, x + 1, y + h - 5, w - 2, 4, '#101018');
    text(ctx, 'CAM1', x + 3, y + 2, { size: 10, color: '#ffffff', outline: INK });
    if ((this.pt >> 4) % 2 || this.state === 'input') fillEllipse(ctx, x + w - 7, y + 7, 3, 3, '#ff3040');
  }

  acting_clapper(ctx, t) {
    const x = 100, y = 44;
    const open = t < 6 ? 0.5 - t * 0.08 : 0;
    ctx.save();
    roundBox(ctx, x, y + 8, 56, 30, '#2a2a30');
    text(ctx, `S${this.ri + 1}`, x + 8, y + 14, { size: 10, color: '#ffffff', shadow: null });
    text(ctx, 'TAKE 1', x + 24, y + 14, { size: 10, color: '#ffffff', shadow: null });
    rect(ctx, x + 4, y + 27, 48, 1, '#8a8a96');
    ctx.translate(x + 2, y + 8);
    ctx.rotate(-open);
    rect(ctx, -1, -9, 58, 10, INK);
    for (let i = 0; i < 7; i++) rect(ctx, i * 8, -8, 8, 8, i % 2 ? '#ffffff' : '#2a2a30');
    ctx.restore();
    if (t >= 6 && t < 12) this.sparkBurst(x + 4, y + 8, 2, ['#ffffff'], 1.2, 'front', 10);
  }

  acting_ng(ctx, t) {
    const k = Math.min(1, t / 6);
    const r = Math.round(22 * (1.6 - 0.6 * k));
    ctx.globalAlpha = t > 50 ? (64 - t) / 14 : 1;
    fillEllipse(ctx, 160, 68, r + 2, r + 2, INK);
    fillEllipse(ctx, 160, 68, r, r, '#e83a4a');
    fillEllipse(ctx, 160, 68, r - 3, r - 3, '#ffffff');
    bigText(ctx, 'NG', 160, 68 - Math.round(r * 0.45), Math.round(r * 0.9), '#e83a4a', '#ffffff');
    ctx.globalAlpha = 1;
  }

  // ================================================================ DANCE (ダンスステップ)
  dance_bg(c, r) {
    vgrad(c, 0, 16, W, 96, [[0, '#0c0620'], [1, '#2a0f4a']]);
    for (let x = 6; x < W; x += 22) rect(c, x, 26, 2, 84, 'rgba(255,255,255,0.04)');
    // truss
    rect(c, 0, 17, W, 2, '#8a909c');
    rect(c, 0, 25, W, 2, '#8a909c');
    for (let x = 0; x < W; x += 8) for (let i = 0; i < 6; i++) rect(c, x + i, 19 + i, 1, 1, '#6a707c');
    // LED screen frame
    rect(c, 70, 30, 180, 70, '#2a2d36');
    rect(c, 72, 32, 176, 66, '#06040e');
    // speakers
    for (const sx of [6, 286]) {
      rect(c, sx, 72, 28, 70, '#1a1a20');
      rect(c, sx, 72, 28, 1, '#3a3a44');
      for (const [cy, rr] of [[86, 8], [112, 10], [132, 6]]) {
        fillEllipse(c, sx + 14, cy, rr, rr, '#2a2a34');
        fillEllipse(c, sx + 14, cy, rr - 3, rr - 3, '#121218');
        fillEllipse(c, sx + 14, cy, 2, 2, '#3a3a44');
      }
    }
    // stage floor
    rect(c, 0, 110, W, 48, '#1e1238');
    rect(c, 0, 110, W, 2, '#5a3a8a');
    for (const y of [124, 138]) rect(c, 0, y, W, 1, '#2e1e50');
    for (let x = 40; x < W; x += 40) rect(c, x, 112, 1, 42, '#2e1e50');
    rect(c, 0, 154, W, 4, '#4a2a6a');
    for (let x = 10; x < W; x += 24) rect(c, x, 155, 6, 2, '#ffe9a0');
  }

  dance_setup() {
    this.plSheet = charSheet(this.look);
    this.bkLooks = [
      { hair: 'twin', hairColor: 'pink', skin: 'light', top: '#ff7eb6', bottom: '#f2f2f2', skirt: true },
      { hair: 'cap', hat: '#5fd7ff', hairColor: 'black', skin: 'tan', top: '#5fd7ff', bottom: '#2a2d36' },
    ];
    this.bkSheets = this.bkLooks.map((l) => charSheet(l));
    this.tiles = [];
    for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 8; cc++) this.tiles.push({ r: rr, c: cc, a: 0, col: '#ffffff' });
    this.screenMode = 'eq';
    this.screenT = 0;
    this.focus = 0;
  }

  dance_open() {
    this.banner = { text: 'ダンスステージ、スタート！', t: 0 };
    this.later(24, () => { this.doShout('ミュージック、スタート！', '#ffe680', 20); this.screenMode = 'flash'; this.screenT = 0; this.setPose('win', 30); });
    this.later(40, () => { this.popup('キャー！', 44, 96, '#ff7eb6', 10); this.popup('キャー！', 276, 96, '#5fd7ff', 10); });
    this.later(60, () => { this.screenMode = 'eq'; });
  }

  dance_walkLen() { return 10; }

  dance_call(i) {
    const L = DANCE_CALLS;
    if (i === this.R - 1) return L[L.length - 1];
    const j = this.R > 2 ? Math.round((i * (L.length - 2)) / (this.R - 2)) : i;
    return L[Math.min(L.length - 2, j)];
  }

  dance_round() { this.screenMode = 'eq'; this.focus = 0; }

  dance_tick() {
    for (const t of this.tiles) t.a *= 0.9;
    this.screenT++;
    const beat = Math.floor(this.pt / DANCE_BEAT);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      const t = this.tiles[Math.floor(this.rng() * this.tiles.length)];
      t.a = Math.max(t.a, 0.35);
      t.col = pickR(['#ff7eb6', '#5fd7ff', '#ffd23f', '#8a5ac8'], this.rng);
    }
    this.focus = this.state === 'clear' || (this.state === 'closing' && this.finalScore() >= 55) ? Math.min(1, this.focus + 0.08) : Math.max(0, this.focus - 0.05);
  }

  dance_light(rr, cc, col) {
    const t = this.tiles.find((q) => q.r === rr && q.c === cc);
    if (t) { t.a = 1; t.col = col; }
  }

  dance_hit(k) {
    this.setPose(k, 22);
    const col = CMD_COLOR[k];
    const cc = k === 'left' ? 2 : k === 'right' ? 5 : this.rng() < 0.5 ? 3 : 4;
    const rr = k === 'up' ? 1 : 2;
    this.dance_light(rr, cc, col);
    if (k === 'a') { this.dance_light(2, 3, col); this.dance_light(2, 4, col); this.sparkBurst(160, 110, 6, ['#ffffff', col], 1.8); }
    if (k === 'b') { this.snd('clap'); this.popup('パン！', 160, 84, '#ffffff', 10); this.sparkBurst(160, 116, 4, ['#ffffff'], 1.4); }
    else this.snd('step');
    this.spawn({ type: 'note', x: 150 + this.rng() * 20, y: 92, vy: -0.6, vx: (this.rng() - 0.5) * 0.6, ch: this.rng() < 0.5 ? '♪' : '♫', color: col, life: 30 });
  }

  dance_clear() {
    this.setPose('win', 50);
    this.doShout(pickR(this.T.good, this.rng), '#ffe680', 26);
    this.confetti(36);
    this.g.sfx('applause');
    this.screenMode = 'heart';
    this.screenT = 0;
    for (const t of this.tiles) { t.a = 0.8; t.col = pickR(['#ff7eb6', '#5fd7ff', '#ffd23f'], this.rng); }
    this.popup('キャー！', 44, 96, '#ff7eb6', 10);
    this.later(8, () => this.popup('最高！', 276, 96, '#5fd7ff', 10));
  }

  dance_fail() {
    this.setPose('stumble', 50);
    this.g.sfx('zukko');
    this.popup('おっとっと…', 160, 82, '#c8d0ff', 12);
    this.screenMode = 'noise';
    this.screenT = 0;
  }

  dance_close(good) {
    this.setPose(good ? 'win' : 'idle', 999);
    this.screenMode = good ? 'heart' : 'eq';
    this.screenT = 0;
    if (good) {
      this.doShout('ありがとう！', '#ffe680', 28, 100);
      this.g.sfx('applause');
      this.confetti(50);
    } else {
      this.doShout('ありがとう…！', '#c8d0ff', 22, 100);
    }
  }

  dance_pose(kind, t) {
    switch (kind) {
      case 'left': return { dir: 'left', dx: -4, frame: 1, arms: [[5, 12, -4, 8]] };
      case 'right': return { dir: 'right', dx: 4, frame: 1, arms: [[10, 12, 19, 8]] };
      case 'up': return this.basePose('up', t);
      case 'down': return { dir: 'down', armless: true, crouch: true, arms: [[3, 15, -1, 14], [12, 15, 16, 14]] };
      case 'a': {
        if (t < 12) { const dirs = ['down', 'left', 'up', 'right']; return { dir: dirs[Math.floor(t / 3) % 4] }; }
        return this.basePose('a', 6);
      }
      case 'b': return { dir: 'down', armless: true, arms: t < 10 ? [[3, 12, 7, 8], [12, 12, 8, 8]] : [[3, 12, 3, 8], [12, 12, 12, 8]] };
      case 'win': return this.basePose('win', t);
      case 'stumble': return { dir: 'left', frame: 2, arms: [[5, 12, 0, 6]] };
      default: {
        const beat = Math.floor(this.pt / DANCE_BEAT);
        return { dir: 'down', frame: beat % 2 ? 1 : 2, dy: (this.pt % DANCE_BEAT) < 6 ? -1 : 0 };
      }
    }
  }

  dance_draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    this.dance_screen(ctx);
    // par lights on the truss
    const cols = ['#ff7eb6', '#5fd7ff', '#ffd23f', '#5ee07a', '#ff7eb6', '#5fd7ff'];
    for (let i = 0; i < 6; i++) {
      const lx = 28 + i * 53;
      rect(ctx, lx - 4, 26, 8, 6, '#2a2d36');
      const on = (Math.floor(this.pt / DANCE_BEAT) + i) % 2;
      rect(ctx, lx - 3, 31, 6, 2, on ? cols[i] : shade(cols[i], -0.5));
    }
    // dance floor tiles
    for (const t of this.tiles) {
      if (t.a < 0.03) continue;
      const y = [112, 125, 139][t.r], h = [12, 13, 15][t.r];
      ctx.globalAlpha = t.a * 0.7;
      rect(ctx, t.c * 40 + 1, y, 39, h, t.col);
      ctx.globalAlpha = 1;
    }
    // spotlights
    ctx.globalAlpha = 0.13;
    for (let i = 0; i < 3; i++) {
      const lx = 60 + i * 100;
      let tx = lx + Math.sin(this.pt / 40 + i * 2.1) * 60;
      tx = lerp(tx, 160, this.focus);
      fillPoly(ctx, [[lx - 3, 28], [lx + 3, 28], [tx + 22, 154], [tx - 22, 154]], cols[i]);
    }
    ctx.globalAlpha = 1;
    this.drawParts(ctx, 'back');
    // backup dancers copy the player a beat later
    const bp = this.poseAgo(8);
    this.bkSheets.forEach((sh, i) => {
      const x = i ? 222 : 66;
      let info = this.dance_pose(bp.kind === 'stumble' ? 'idle' : bp.kind, bp.t);
      if (this.state === 'fail' && this.st > 10 && this.st < 50) info = { dir: i ? 'left' : 'right' };
      shadowAt(ctx, x + 16, 131, 12, 2);
      this.drawPerson(ctx, sh, this.bkLooks[i], x, 132, 2, info, { pop: Math.min(1, (bp.t + 1) / 3) });
      if (this.state === 'fail' && this.st > 14 && this.st < 50) this.drawEmote(ctx, x + 18, 76, '？', this.st - 14);
    });
    // player
    const k = this.pose.kind, t = this.pose.t;
    const info = this.dance_pose(k, t);
    shadowAt(ctx, 160, 149, 18, 3);
    this.drawPerson(ctx, this.plSheet, this.look, 136, 150, 3, info, {
      pop: Math.min(1, (t + 1) / 3),
      rot: k === 'stumble' && t < 40 ? Math.sin(t / 4) * 0.18 : 0,
    });
    this.drawParts(ctx, 'front');
  }

  dance_screen(ctx) {
    const x0 = 72, y0 = 32, w = 176, h = 66;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    const mode = this.screenMode;
    if (mode === 'heart') {
      const HEART = ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'];
      const s = 6 + ((this.screenT >> 3) % 2);
      const hx = 160 - (9 * s) / 2, hy = 65 - (8 * s) / 2;
      rect(ctx, x0, y0, w, h, '#2a0a2a');
      HEART.forEach((row, yy) => { for (let xx = 0; xx < 9; xx++) if (row[xx] === 'x') rect(ctx, hx + xx * s, hy + yy * s, s - 1, s - 1, '#ff5d9c'); });
    } else if (mode === 'noise') {
      for (let yy = y0; yy < y0 + h; yy += 3) for (let xx = x0; xx < x0 + w; xx += 3) rect(ctx, xx, yy, 2, 2, hash2(xx, yy, this.pt >> 1) < 0.5 ? '#3a3a4a' : '#1a1a24');
    } else if (mode === 'thanks') {
      rect(ctx, x0, y0, w, h, '#1a0a2e');
      bigText(ctx, 'ありがとう！', 160, 56, 16, (this.pt >> 3) % 2 ? '#ffd23f' : '#ff7eb6');
    } else if (mode === 'flash') {
      rect(ctx, x0, y0, w, h, (this.screenT >> 2) % 2 ? '#ffffff' : '#ff7eb6');
    } else {
      const pulse = 1 - ((this.pt % DANCE_BEAT) / DANCE_BEAT);
      for (let i = 0; i < 17; i++) {
        const v = 0.5 + 0.5 * Math.sin(this.pt * 0.13 + i * 0.75) * Math.cos(this.pt * 0.05 + i * 0.3);
        const bh = Math.round(6 + v * 44 * (0.65 + 0.35 * pulse));
        const col = mix('#ff7eb6', '#5fd7ff', i / 16);
        for (let yy = y0 + h - 4; yy > y0 + h - 4 - bh; yy -= 3) rect(ctx, x0 + 4 + i * 10, yy, 8, 2, col);
      }
    }
    // scanlines
    ctx.globalAlpha = 0.18;
    for (let yy = y0; yy < y0 + h; yy += 2) rect(ctx, x0, yy, w, 1, '#000000');
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

registerMinigame('command', CommandAction);
