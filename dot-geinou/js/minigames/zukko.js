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

import { Minigame, registerMinigame, text, wrap, COLORS } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheet, LOOKS } from '../engine/sprites.js';
import { audio } from '../engine/audio.js';
import { W, H, clamp, makeCanvas, shuffle } from '../engine/util.js';

const FOOT = 178; // y of the cast's feet on the stage floor
const LIE_SHIFT = 10; // a fallen member slides this far back toward the lead, so a solo fall never lands on a neighbour

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
const FLY_PENALTY = 4;
const FAKE_PENALTY = 12;

const chars = (s) => Array.from(s || '');

// ---------------------------------------------------------------- static stage art (cached)
let stageCache = null;
function fillDisc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y + r * 0.5));
    c.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}
function buildStage() {
  const [cv, c] = makeCanvas(W, H);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(0, 0, W, H, '#140f1f');

  // --- set: shop front (めし処)
  R(20, 18, 280, 112, '#efdcb2');
  for (let y = 40; y < 100; y += 5) for (let x = 23 + ((y / 5) % 2) * 6; x < 298; x += 13) R(x, y, 1, 1, '#e0c898');
  // roof eave (瓦)
  R(20, 18, 280, 13, '#3b4250');
  for (let x = 20; x < 300; x += 8) { R(x, 18, 1, 11, '#2c323e'); R(x + 2, 26, 5, 3, '#5a6475'); R(x + 3, 27, 3, 1, '#77829a'); }
  R(20, 29, 280, 3, '#22262e');
  // wooden beam
  R(20, 32, 280, 4, '#7a4e26'); R(20, 32, 280, 1, '#9a6a3a'); R(20, 36, 280, 1, '#4a2e14');
  // lower wainscot
  R(20, 102, 280, 28, '#8a5a2a');
  for (let x = 20; x < 300; x += 8) R(x, 104, 1, 26, '#6b4226');
  R(20, 101, 280, 3, '#a8743a'); R(20, 104, 280, 1, '#5a3a1a');
  // pillars
  for (const x of [20, 128, 186, 294]) { R(x, 32, 6, 98, '#7a4e26'); R(x + 1, 32, 1, 98, '#9a6a3a'); R(x + 5, 32, 1, 98, '#4a2e14'); }

  // window (格子窓) on the left
  R(34, 60, 66, 40, '#5a3a1a');
  R(37, 63, 60, 34, '#2a3550');
  R(37, 63, 60, 6, '#39507a');
  for (let x = 37; x < 97; x += 6) R(x, 63, 2, 34, '#a8743a');
  R(37, 79, 60, 2, '#a8743a');
  R(32, 99, 70, 3, '#6b4226');
  // potted plant under the window
  R(58, 116, 18, 12, '#b0532e'); R(56, 114, 22, 3, '#c8683a'); R(60, 127, 14, 2, '#7a3a20');
  fillDisc(c, 67, 108, 7, '#3f9a5a'); fillDisc(c, 61, 111, 4, '#2f7a44'); fillDisc(c, 73, 110, 4, '#2f7a44');
  R(64, 104, 2, 2, '#5ee07a'); R(70, 107, 2, 2, '#5ee07a');

  // sliding lattice door in the middle
  R(134, 58, 52, 72, '#5a3a1a');
  R(137, 62, 22, 68, '#c9dbe6'); R(161, 62, 22, 68, '#b6cad8');
  for (let y = 62; y < 130; y += 8) { R(137, y, 22, 1, '#6b4226'); R(161, y, 22, 1, '#6b4226'); }
  for (const x of [144, 151, 168, 175]) R(x, 62, 1, 68, '#6b4226');
  R(159, 58, 2, 72, '#3a2512');
  R(137, 112, 46, 18, '#7a4e26'); R(137, 112, 46, 1, '#a8743a');
  // noren
  R(130, 56, 60, 2, '#3a2512');
  R(132, 58, 56, 26, '#27407a');
  R(132, 58, 56, 2, '#1c2f5c');
  for (const x of [150, 169]) R(x, 75, 2, 9, '#efdcb2');
  R(132, 82, 56, 2, '#1c2f5c');

  // menu strips (お品書き) on the right
  R(220, 58, 70, 44, '#6b4226');
  for (let i = 0; i < 5; i++) {
    const x = 223 + i * 13;
    R(x, 61, 11, 38, '#fbf3dc');
    for (let y = 64; y < 90; y += 4) R(x + 4, y, 3 + ((i + y) % 3 === 0 ? 1 : 0), 2, '#3a2a20');
    R(x + 3, 92, 5, 4, '#d62f2f');
  }

  // sign board (看板)
  R(106, 37, 108, 20, '#3a2512');
  R(108, 39, 104, 16, '#6b4226');
  R(108, 39, 104, 1, '#8a5a2a');
  R(104, 37, 2, 20, '#2a1a0c'); R(214, 37, 2, 20, '#2a1a0c');

  // --- stage floor (planks, deeper = narrower spacing)
  R(20, 130, 280, 60, '#d8a960');
  R(20, 130, 280, 3, '#8a6a3a');
  const lines = [133, 138, 147, 157, 168, 180, 190];
  for (let k = 1; k < lines.length; k++) {
    const y0 = lines[k - 1], y1 = lines[k];
    if (y1 < 190) R(20, y1, 280, 1, '#b88a4c');
    for (let x = 24 + ((k * 37) % 60); x < 300; x += 60) R(x, y0 + 1, 1, y1 - y0 - 1, '#c0924f');
  }
  for (let i = 0; i < 40; i++) R(22 + ((i * 53) % 276), 134 + ((i * 29) % 54), 2, 1, '#e8bc74');
  // stage front + footlights
  R(0, 190, W, 9, '#5a3a20'); R(0, 190, W, 2, '#ddb06e'); R(0, 192, W, 1, '#3a2512');
  for (let x = 30; x < 296; x += 26) { R(x - 2, 193, 10, 4, '#3a2512'); R(x, 194, 6, 2, '#fff6a8'); }
  R(0, 199, W, 41, '#0d0a16');

  // --- side curtains
  for (const side of [0, 1]) {
    const x0 = side ? 300 : 0;
    R(x0, 0, 20, 199, '#a51f2c');
    for (let x = 0; x < 20; x += 5) { R(x0 + x, 0, 1, 199, '#7a1520'); R(x0 + x + 2, 0, 1, 199, '#d0404e'); }
    R(side ? 300 : 18, 0, 2, 199, '#5a0f18');
    R(x0, 116, 20, 5, '#e8c43a'); R(x0, 121, 20, 1, '#a07f1a');
    R(side ? 302 : 4, 122, 3, 8, '#e8c43a'); R(side ? 312 : 13, 122, 3, 6, '#e8c43a');
  }
  // valance with swags + gold fringe
  R(0, 0, W, 15, '#a51f2c');
  for (let x = 0; x < W; x += 4) R(x, 0, 1, 13, '#8a1824');
  for (let x = 0; x < W; x += 32) {
    for (let i = 0; i < 32; i++) {
      const d = Math.round(Math.sin((i / 32) * Math.PI) * 5);
      R(x + i, 15, 1, d, '#a51f2c');
      R(x + i, 15 + d, 1, 1, '#e8c43a');
    }
  }
  R(0, 13, W, 2, '#e8c43a');
  for (let x = 2; x < W; x += 6) R(x, 15, 1, 2, '#c9a227');
  stageCache = cv;
  return cv;
}

// Audience heads (fixed layout).
const AUDIENCE = [];
for (let row = 0; row < 3; row++) {
  const y = [210, 222, 236][row];
  const r = [6, 7, 8][row];
  for (let x = row % 2 ? 4 : 13; x < W + 10; x += 19 + row * 2) AUDIENCE.push({ x, y, r, row, i: AUDIENCE.length });
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
      { look: OKAMI, x: 72, side: -1 },
      { look: JII, x: 116, side: -1 },
      { look: LEAD, x: 160, side: 0, lead: true },
      { look: pl, x: 204, side: 1, player: true },
      { look: MADONNA, x: 248, side: 1 },
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
    const px = clamp(this.player.x + 6, 60, 268);
    // just above the actors' heads (FOOT - 40), clear of the 座長's speech bubble
    this.popup(def.label, px, FOOT - 54, def.color, 12);
    if (extra) this.popup(extra, px, FOOT - 42, '#ffffff', 10);
    if (this.combo >= 2 && (kind === 'perfect' || kind === 'good' || kind === 'hold')) this.popup(`${this.combo}コンボ！`, px, FOOT - 66, COLORS.pink, 10);
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
      this.popup(words[Math.floor(this.rng() * words.length)], 40 + ((this.laughN++ * 97) % 240), 206, '#ffd23f', 10);
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
        const gx = m.x + m.side * (24 - LIE_SHIFT);
        for (let k = 0; k < 7; k++) {
          this.parts.push({ x: gx + (this.rng() * 30 - 15), y: FOOT - 2, vx: (this.rng() - 0.5) * 1.6, vy: -this.rng() * 1.2, life: 0, max: 18 + Math.floor(this.rng() * 10) });
        }
      }
    }
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life++; }
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
    let size = 12;
    while (size > 9 && measure(ctx, shop, size) > 98) size--;
    text(ctx, shop, 160, 41 + Math.floor((12 - size) / 2), { size, align: 'center', color: '#fff3c4', outline: '#2a1a0c' });
    let ns = 10;
    while (ns > 8 && measure(ctx, noren, ns) > 50) ns--;
    text(ctx, noren, 160, 63, { size: ns, align: 'center', color: '#ffffff', shadow: null });
  }

  drawBackground(ctx) {
    ctx.drawImage(stageCache || buildStage(), 0, 0);
    this.drawSigns(ctx);
    this.drawLanterns(ctx, 0);
    this.drawAudience(ctx, false);
  }

  drawLanterns(ctx, t) {
    for (const [i, lx] of [[0, 108], [1, 212]]) {
      const sway = Math.round(Math.sin(t / 40 + i * 2) * 1.2);
      const x = lx + sway;
      ctx.fillStyle = '#2a1a0c';
      ctx.fillRect(lx, 37, 1, 22);
      ctx.fillStyle = '#20232a';
      ctx.fillRect(x - 4, 58, 9, 3);
      ctx.fillRect(x - 4, 79, 9, 3);
      ctx.fillStyle = '#d62f2f';
      ctx.fillRect(x - 6, 61, 13, 18);
      ctx.fillRect(x - 7, 64, 15, 12);
      ctx.fillStyle = '#ff5d6c';
      ctx.fillRect(x - 5, 63, 2, 13);
      ctx.fillStyle = '#9a1f24';
      for (const y of [65, 69, 73]) ctx.fillRect(x - 6, y, 13, 1);
    }
  }

  drawAudience(ctx, laughing) {
    const t = this.rt || 0;
    for (const a of AUDIENCE) {
      const bob = laughing ? ((a.i + Math.floor(t / 5)) % 2) * 2 : 0;
      const col = ['#2a2244', '#211a38', '#18122a'][a.row];
      ctx.fillStyle = col;
      ctx.fillRect(a.x - a.r - 4, a.y + a.r - 2 - bob, a.r * 2 + 9, 12);
      for (let y = -a.r; y <= a.r; y++) {
        const w = Math.round(Math.sqrt(a.r * a.r - y * y + a.r * 0.5));
        ctx.fillRect(a.x - w, a.y + y - bob, w * 2 + 1, 1);
      }
    }
  }

  drawPlay(ctx) {
    const r = this.round;
    const t = this.rt || 0;
    ctx.drawImage(stageCache || buildStage(), 0, 0);
    this.drawSigns(ctx);
    this.drawLanterns(ctx, this.pt);

    // spotlight on the lead
    ctx.fillStyle = 'rgba(255,240,190,0.10)';
    ctx.beginPath();
    ctx.moveTo(140, 15); ctx.lineTo(180, 15); ctx.lineTo(196, FOOT + 4); ctx.lineTo(124, FOOT + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.18)';
    for (let y = -4; y <= 4; y++) {
      const w = Math.round(38 * Math.sqrt(1 - (y * y) / 20.25));
      ctx.fillRect(160 - w, FOOT + y, w * 2, 1);
    }

    if (this.cast) this.drawCast(ctx, r, t);
    for (const p of this.parts || []) {
      ctx.globalAlpha = clamp(1 - p.life / p.max, 0, 1) * 0.9;
      ctx.fillStyle = '#efe3c8';
      const s = p.life < 6 ? 2 : 3;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
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
    const w = last ? 124 : 104;
    const x = 160 - w / 2;
    const y = Math.round(70 - (1 - k) * 8);
    ctx.globalAlpha = k;
    ctx.fillStyle = '#22202a';
    ctx.fillRect(x + 2, y + 2, w, 24);
    ctx.fillStyle = '#fbf3dc';
    ctx.fillRect(x, y, w, 24);
    ctx.fillStyle = '#d62f2f';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y + 22, w, 2);
    text(ctx, label, 160, y + 5, { size: 12, align: 'center', color: '#22202a', shadow: null });
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
      return { a: e * Math.PI / 2, hop: Math.sin(p * Math.PI) * 6, lying: e, frame: flail };
    }
    const q = clamp((pt - m.upAt) / 10, 0, 1);
    if (q >= 1) return { a: 0, hop: 0, lying: 0, frame: 0 };
    return { a: (1 - q) * Math.PI / 2, hop: Math.sin(q * Math.PI) * 3, lying: 1 - q, frame: 0 };
  }

  drawCast(ctx, r, t) {
    const talking = r && ((t >= r.tS && t < r.tSE) || (t >= r.tG && t < r.tGE));
    const realCue = r && !r.fake && t >= r.tC;
    this.overlays = [];
    const order = this.cast.filter((m) => !m.player).concat(this.player);
    for (const m of order) {
      const ps = this.poseOf(m);
      const sheet = charSheet(m.look);
      let dir = 'down';
      if (ps.lying === 0 && !m.lead) {
        // listen to the lead; face the audience once the scene has played out
        dir = r && t >= r.tS && t < r.tC + 20 ? (m.side < 0 ? 'right' : 'left') : 'down';
      }
      let bob = 0;
      if (m.lead) {
        if (talking) bob = Math.floor(t / 6) % 2;
        if (realCue && t - r.tC < 12) bob = Math.round(Math.sin(((t - r.tC) / 12) * Math.PI) * 6);
      }
      const lx = Math.round(m.x - m.side * LIE_SHIFT * ps.lying);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      if (ps.lying > 0.5) {
        const sx = m.side > 0 ? lx : lx - 40;
        ctx.fillRect(sx + 2, FOOT - 1, 38, 3);
      } else {
        ctx.fillRect(m.x - 10, FOOT - 2, 20, 3);
        ctx.fillRect(m.x - 7, FOOT + 1, 14, 1);
      }
      const img = sheet[dir][ps.frame] || sheet[dir][0];
      ctx.save();
      ctx.translate(lx, Math.round(FOOT - ps.hop - 16 * Math.sin(ps.a) - bob));
      if (ps.a) ctx.rotate((m.side || 1) * ps.a);
      ctx.drawImage(img, -16, -40, 32, 40);
      ctx.restore();

      // the lead's pose sparkles after a real gag lands
      if (m.lead && realCue && t - r.tC < 40) {
        const k = t - r.tC;
        for (let i = 0; i < 4; i++) {
          const ang = k / 6 + i * (Math.PI / 2);
          this.sparkleAt(ctx, m.x + Math.cos(ang) * 22, FOOT - 30 + Math.sin(ang) * 16, (k + i) % 8 < 4 ? 3 : 2, '#fff6a8');
        }
      }

      // head position (for markers & emotes)
      const hx = ps.lying > 0.5 ? lx + m.side * 32 : m.x;
      const hy = ps.lying > 0.5 ? FOOT - 34 : FOOT - 46 - bob;
      const emote = m.emote && t < m.emoteUntil ? m.emote : null;
      if (emote) this.overlays.push(() => this.drawEmote(ctx, hx, hy, emote, t));
      // "あなた" marker (hidden while a judgement popup floats there, and mid-fall)
      if (m.player && this.pt - this.judgeAt > 46 && (ps.lying === 0 || ps.lying === 1) && (!emote || emote === 'sweat')) {
        this.overlays.push(() => {
          const blink = Math.floor(this.pt / 16) % 2;
          const my = hy - 4;
          text(ctx, 'あなた', hx, my - 14, { size: 10, align: 'center', color: COLORS.pink, outline: '#22202a' });
          ctx.fillStyle = COLORS.pink;
          for (let i = 0; i < 4; i++) ctx.fillRect(hx - 3 + i, my - 2 + blink + i, 7 - i * 2, 1);
        });
      }
    }
  }

  sparkleAt(ctx, x, y, s, col) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = col;
    ctx.fillRect(x - s, y, s * 2 + 1, 1);
    ctx.fillRect(x, y - s, 1, s * 2 + 1);
  }

  drawEmote(ctx, x, y, e, t) {
    x = Math.round(x); y = Math.round(y);
    if (e === 'sweat') {
      const dy = Math.floor(t / 10) % 3;
      ctx.fillStyle = '#5fd7ff';
      ctx.fillRect(x + 10, y + 6 + dy, 3, 4);
      ctx.fillRect(x + 11, y + 4 + dy, 1, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 10, y + 7 + dy, 1, 1);
      return;
    }
    const w = e.length > 1 ? 22 : 18;
    ctx.fillStyle = '#22202a';
    ctx.fillRect(x - w / 2 - 1, y - 17, w + 2, 15);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - w / 2, y - 16, w, 13);
    ctx.fillRect(x - 1, y - 3, 3, 2);
    ctx.fillStyle = '#22202a';
    ctx.fillRect(x, y - 1, 1, 1);
    text(ctx, e === '…' ? '…' : e, x, y - 15, { size: 10, align: 'center', color: e === '!?' ? '#d62f2f' : '#22202a', shadow: null });
  }

  drawBubble(ctx, r, t) {
    let str, t0, gag = false;
    if (t >= r.tS && t < r.tG && r.setup) { str = r.setup; t0 = r.tS; }
    else if (t >= r.tG && t < r.tC) { str = r.cue; t0 = r.tG; gag = true; }
    else return;
    let size = 12, lh = 15;
    let lines = wrap(ctx, str, 214, size);
    if (lines.length > 2) { size = 10; lh = 12; lines = wrap(ctx, str, 214, size).slice(0, 3); }
    let maxW = 0;
    for (const l of lines) maxW = Math.max(maxW, measure(ctx, l, size));
    const w = clamp(Math.ceil(maxW) + 22, 120, 250);
    const h = 12 + lines.length * lh;
    const x = Math.round(160 - w / 2);
    const y = Math.round(gag ? 64 : 66);
    const bg = gag ? '#fff6c8' : '#ffffff';
    const ink = '#22202a';
    // body with clipped corners
    ctx.fillStyle = ink;
    ctx.fillRect(x + 2, y - 1, w - 4, h + 2);
    ctx.fillRect(x - 1, y + 2, w + 2, h - 4);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillRect(x, y + 2, w, h - 4);
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    // tail toward the lead's head
    const by = y + h;
    const tipY = FOOT - 44;
    for (let yy = by; yy < tipY; yy++) {
      const k = (yy - by) / (tipY - by);
      const half = Math.max(0, Math.round(6 * (1 - k)));
      const cx = Math.round(156 + k * 4);
      ctx.fillStyle = ink;
      ctx.fillRect(cx - half - 1, yy, half * 2 + 3, 1);
      if (half > 0) { ctx.fillStyle = bg; ctx.fillRect(cx - half, yy, half * 2 + 1, 1); }
    }
    ctx.fillStyle = bg;
    ctx.fillRect(150, by - 1, 13, 2);
    // name tag
    ctx.fillStyle = ink;
    ctx.fillRect(x + 5, y - 9, 30, 13);
    ctx.fillStyle = '#e8873a';
    ctx.fillRect(x + 6, y - 8, 28, 11);
    text(ctx, '座長', x + 20, y - 8, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    // typed text
    let n = Math.floor((t - t0) / this.spd) + 1;
    lines.forEach((l, i) => {
      const cs = chars(l);
      const s = cs.slice(0, Math.max(0, n)).join('');
      n -= cs.length;
      if (s) text(ctx, s, x + 11, y + 7 + i * lh, { size, color: ink, shadow: null });
    });
    if (gag) {
      // a red 「！」 badge on the corner: this is the punch line
      const bx = x + w - 6, by2 = y - 1;
      fillDisc(ctx, bx, by2, 7, ink);
      fillDisc(ctx, bx, by2, 6, '#d62f2f');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - 1, by2 - 4, 3, 5);
      ctx.fillRect(bx - 1, by2 + 2, 3, 2);
    }
  }

  drawCueFx(ctx, r, t) {
    if (t < r.tC) return;
    const k = t - r.tC;
    if (!r.fake) {
      if (k > 44) return;
      // white flash
      const fl = Math.max(0, 0.6 - k * 0.075);
      if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H); }
      const fade = k > 34 ? 1 - (k - 34) / 10 : 1;
      ctx.globalAlpha = clamp(fade, 0, 1);
      // starburst
      const cx = 160, cy = 58;
      ctx.fillStyle = '#ff8a3d';
      this.burst(ctx, cx, cy, 62, 34, 14, k / 30);
      ctx.fillStyle = '#ffd23f';
      this.burst(ctx, cx, cy, 52, 28, 14, k / 30 + 0.1);
      const size = k < 4 ? 40 : 32;
      this.bigText(ctx, 'ドーン！', cx, cy - size / 2, size, '#ffffff', '#d62f2f');
      ctx.globalAlpha = 1;
    } else {
      if (t > r.tUp) return;
      ctx.fillStyle = `rgba(16,24,72,${Math.min(0.35, k * 0.04)})`;
      ctx.fillRect(0, 0, W, H);
      const a = clamp(k / 8, 0, 1) * (t > r.tUp - 10 ? (r.tUp - t) / 10 : 1);
      ctx.globalAlpha = clamp(a, 0, 1);
      this.bigText(ctx, 'シーン…', 114, 72 + Math.min(8, Math.floor(k * 0.12)), 24, '#dfe9ff', '#2a3a7a');
      ctx.globalAlpha = 1;
      // a crow flies across
      const cx = Math.round(336 - k * 3.2);
      const cy = Math.round(46 + Math.sin(k / 6) * 3);
      if (cx > -20) {
        this.drawCrow(ctx, cx, cy, Math.floor(k / 6) % 2);
        if (k >= 12 && k < 36) text(ctx, 'カァー', cx + 6, cy - 20, { size: 10, color: '#dfe9ff', outline: '#14182e' });
      }
    }
  }

  burst(ctx, cx, cy, rOut, rIn, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 ? rIn : rOut * (i % 4 === 0 ? 1 : 0.85);
      const a = rot + (i / (n * 2)) * Math.PI * 2;
      const x = cx + Math.cos(a) * rr * 1.5;
      const y = cy + Math.sin(a) * rr * 0.75;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  bigText(ctx, s, x, y, size, fill, edge) {
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2], [0, 3], [2, 3], [-2, 3]]) {
      text(ctx, s, x + dx, y + dy, { size, align: 'center', color: edge, shadow: null });
    }
    text(ctx, s, x, y, { size, align: 'center', color: fill, outline: '#22202a' });
  }

  drawCrow(ctx, x, y, f) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2, 2);
    x = 0; y = 0;
    ctx.fillStyle = '#14141c';
    ctx.fillRect(x, y, 8, 3); // body
    ctx.fillRect(x - 3, y - 1, 4, 3); // head
    ctx.fillRect(x + 8, y + 1, 3, 1); // tail
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(x - 5, y, 2, 1); // beak
    ctx.fillStyle = '#14141c';
    if (f) { ctx.fillRect(x + 2, y - 4, 2, 4); ctx.fillRect(x + 4, y - 6, 2, 3); }
    else { ctx.fillRect(x + 2, y + 3, 2, 3); ctx.fillRect(x + 4, y + 5, 2, 2); }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, y, 1, 1); // eye
    ctx.restore();
  }

  drawHud(ctx) {
    const total = this.total || 0;
    if (!total) return;
    const cur = clamp(this.ri, 0, total - 1);
    text(ctx, `ネタ ${cur + 1}/${total}`, 24, 2, { size: 10, color: '#ffffff', outline: '#3a0a10' });
    const x0 = 160 - (total - 1) * 6;
    for (let i = 0; i < total; i++) {
      const x = x0 + i * 12, y = 7;
      const res = this.results[i];
      ctx.fillStyle = '#3a0a10';
      ctx.fillRect(x - 4, y - 3, 9, 7);
      ctx.fillRect(x - 3, y - 4, 7, 9);
      ctx.fillStyle = res ? DOT_COLORS[res] : '#7a2a34';
      ctx.fillRect(x - 3, y - 2, 7, 5);
      ctx.fillRect(x - 2, y - 3, 5, 7);
      if (i === cur && !res && Math.floor(this.pt / 12) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
    const s = this.realPts && this.realPts.length ? String(this.currentScore()) : '--';
    text(ctx, `スコア ${s}`, 296, 2, { size: 10, align: 'right', color: '#ffd23f', outline: '#3a0a10' });
    if (this.combo >= 2) text(ctx, `${this.combo}コンボ`, 296, 20, { size: 10, align: 'right', color: COLORS.pink, outline: '#22202a' });
    // instruction strip
    ctx.fillStyle = 'rgba(8,6,14,0.72)';
    ctx.fillRect(0, 226, W, 14);
    text(ctx, '「ドーン！」でA！　「シーン…」はガマン', 160, 227, { size: 10, align: 'center', color: '#ffffff', shadow: null });
  }
}

registerMinigame('zukko', Zukko);
