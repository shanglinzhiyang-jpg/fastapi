// ツッコミ漫才 — hit A right after your partner's ボケ, let normal lines (フリ) pass.
//
// opts:
//   lines:  [{ boke: 'セリフ', punch: true|false, tsukkomi?: 'ツッコミ' }]  custom script (played in order)
//   rounds: number of lines (default 6..10 by difficulty; custom lines are topped up from the built-in pool;
//           at least 3 lines are always played)
//   partner: partner's display name (default '相方'), partnerLook: sprite look for the partner
//   dialect: 'kansai' | 'std' for the partner's reactions and the closing line (default: Kansai-ben,
//            or standard Japanese when a custom script's ツッコミ contain no Kansai-ben)
//
// Timing: t = frames since the line finished typing.
//   pressed while typing        -> 早すぎ (boke ruined, small penalty)
//   t <= winP (+4 frames grace) -> PERFECT 100%
//   t <= winG                   -> GOOD     75%
//   t <= winL                   -> LATE     40%
//   t >  winL / B               -> スルー (boke) or ナイス見送り (フリ, small bonus)
// Pressing on a フリ costs points. Score = earned / total weight (boke 1, フリ <= 0.4).

import { Minigame, registerMinigame, text, rect, wrap, bar, COLORS, sparkle } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheet, drawChar, LOOKS, SKIN } from '../engine/sprites.js';
import { audio, registerSong } from '../engine/audio.js';
import { makeCanvas, mulberry32, shuffle, clamp, mix, W, H } from '../engine/util.js';

// ------------------------------------------------------------------ content
// Each bit: one normal setup line (フリ) and ボケ that follow naturally from it.
// Every ボケ also works on its own (bits with furi: null are stand-alone ボケ).
const BITS = [
  { furi: '最近、健康のために走ってるねん。', boke: [
    { boke: '富士山を、毎朝ジョギングで登ってるねん。', tsukkomi: 'どんな体力やねん！' },
    { boke: '走りすぎて、新幹線を追い越してもうた。', tsukkomi: 'そんなわけあるかい！' },
  ] },
  { furi: 'ぼく、毎日筋トレしてるねん。', boke: [
    { boke: '腕立て伏せは、一年に一回やってるで。', tsukkomi: '少なすぎるわ！' },
    { boke: '鍛えすぎて、あくびで風船ふくらむねん。', tsukkomi: 'どんな肺活量やねん！' },
  ] },
  { furi: 'ぼく、料理するのが好きやねん。', boke: [
    { boke: '得意料理は、ゆで卵を生卵に戻すことや。', tsukkomi: 'ノーベル賞もんや！' },
    { boke: 'アイスクリームは、レンジで温める派や。', tsukkomi: '溶けてまうわ！' },
  ] },
  { furi: 'たこ焼きって、ほんまにおいしいよな。', boke: [
    { boke: 'たこ焼きに、たこの代わりにたこ焼き入れた。', tsukkomi: 'ややこしいわ！' },
    { boke: 'こないだ、たこ焼きからたこが逃げてん。', tsukkomi: '生きとったんかい！' },
  ] },
  { furi: 'ぼく、食べるのが大好きやねん。', boke: [
    { boke: 'きのうの晩ごはん、ドーナツの穴だけ食べた。', tsukkomi: '何も食べてへんがな！' },
    { boke: 'ラーメンは、ストローで一気に吸うねん。', tsukkomi: '熱いやろ！' },
    { boke: '晩ごはん、おかずがごはんやってん。', tsukkomi: 'ごはんでごはんか！' },
  ] },
  { furi: '最近、ペットを飼い始めてん。', boke: [
    { boke: 'うちの金魚、九九を全部言えるねん。', tsukkomi: 'しゃべられへんやろ！' },
    { boke: 'カバンの中で、ゾウを一頭飼ってるねん。', tsukkomi: '入るかい！' },
  ] },
  { furi: 'こないだ、家族で動物園に行ってん。', boke: [
    { boke: 'ペンギンに、泳ぎ方を教えてきてん。', tsukkomi: '向こうがプロや！' },
    { boke: 'パンダの白黒、ぼくが毎年ぬってるねん。', tsukkomi: 'そんな仕事ないわ！' },
  ] },
  { furi: '最近、早起きするようにしてるねん。', boke: [
    { boke: '目覚まし時計は、ぼくが毎朝起こしてる。', tsukkomi: '立場が逆や！' },
    { boke: '毎朝、太陽に「おはよう」言われるねん。', tsukkomi: '太陽しゃべらんわ！' },
  ] },
  { furi: '休みの日は、家でゴロゴロしてるねん。', boke: [
    { boke: 'ゴロゴロしすぎて、床に人の形の跡ついた。', tsukkomi: 'どんだけ寝とんねん！' },
    { boke: '家では、自分の影と鬼ごっこしてるねん。', tsukkomi: '一生つかまらんわ！' },
    { boke: '寝言で、毎晩落語を一席やってるらしい。', tsukkomi: '寝ながら稽古すな！' },
  ] },
  { furi: 'きのう、ひさしぶりに自転車に乗ってん。', boke: [
    { boke: '自転車、ハンドルだけ持って走ってきた。', tsukkomi: '本体どこやねん！' },
    { boke: '道に迷ったから、地図に道を聞いてん。', tsukkomi: '地図はしゃべらん！' },
  ] },
  { furi: 'この前、新しい靴を買うてん。', boke: [
    { boke: 'この靴な、左右とも左足用やねん。', tsukkomi: '歩きにくいわ！' },
    { boke: '大きめ買うたら、家族全員入ってん。', tsukkomi: 'それもう家や！' },
  ] },
  { furi: 'ぼく、雨の日も意外と好きやねん。', boke: [
    { boke: '雨の音を聞いたら、つい洗濯物を干してまうねん。', tsukkomi: 'しまえや！' },
    { boke: '雨つぶを全部数えてから、家を出るねん。', tsukkomi: '一生出られへんわ！' },
  ] },
  { furi: 'やっぱり、夏が一番好きやねん。', boke: [
    { boke: 'かき氷は、温めてから食べるのが好きや。', tsukkomi: 'ただの水や！' },
    { boke: '夏休みの宿題、去年のがまだ終わらんねん。', tsukkomi: '一年遅れとるがな！' },
    { boke: 'セミといっしょに、毎朝ミンミン鳴いてる。', tsukkomi: '近所迷惑や！' },
  ] },
  { furi: '週末、おばあちゃんちに遊びに行ってん。', boke: [
    { boke: 'うちのおばあちゃん、毎朝バク転してるで。', tsukkomi: '元気すぎるやろ！' },
    { boke: 'おばあちゃんちの庭、山がひとつあるねん。', tsukkomi: 'どんな庭やねん！' },
  ] },
  { furi: 'お正月に、親戚がみんな集まってん。', boke: [
    { boke: 'お年玉、親戚の犬にもあげてん。', tsukkomi: '何に使うねん！' },
    { boke: 'お正月に、サンタさんが来てくれてん。', tsukkomi: '一週間遅刻や！' },
  ] },
  { furi: 'ぼく、こう見えて特技があるねん。', boke: [
    { boke: '百メートルを、百分で走れるねん。', tsukkomi: '遅すぎるわ！' },
    { boke: 'ハトと将棋さして、三連敗中やねん。', tsukkomi: 'ハト強すぎやろ！' },
  ] },
  { furi: '子どものころの夢、聞いてくれる？', boke: [
    { boke: '信号機の青に、なりたかってん。', tsukkomi: 'なられへんわ！' },
    { boke: '雲の上に、家を建てたかってん。', tsukkomi: '落ちてまうわ！' },
  ] },
  { furi: 'ぼく、占いとか信じるタイプやねん。', boke: [
    { boke: '前世はな、カブトムシやったらしいねん。', tsukkomi: '誰に聞いてん！' },
    { boke: '今日のラッキーアイテム、冷蔵庫やって。', tsukkomi: '持ち歩かれへんわ！' },
  ] },
  { furi: '最近、お風呂でよく歌うねん。', boke: [
    { boke: 'お風呂は、服を着たまま入る派やねん。', tsukkomi: '派閥とかないわ！' },
    { boke: 'ぼくが歌うと、近所の犬が全員ハモるねん。', tsukkomi: '犬の合唱団か！' },
  ] },
  { furi: '今度、みんなでカラオケ行こうや。', boke: [
    { boke: 'カラオケで、校歌を三時間歌ってん。', tsukkomi: '愛校心すごいな！' },
    { boke: 'カラオケの点数、いつもマイナスやねん。', tsukkomi: 'どうやったらなるねん！' },
  ] },
  { furi: 'この前、旅行で写真いっぱい撮ってん。', boke: [
    { boke: 'カメラ向けられたら、まばたき百回するねん。', tsukkomi: '目ぇつぶっとるがな！' },
    { boke: '旅行の写真、全部ぼくの親指やってん。', tsukkomi: '景色どこやねん！' },
  ] },
  { furi: '最近、新しいスマホに変えてん。', boke: [
    { boke: 'ぼくのスマホ、おにぎりで充電できるねん。', tsukkomi: 'できるかい！' },
    { boke: '電話かけたら、自分のスマホが鳴ってん。', tsukkomi: '自分にかけとるがな！' },
  ] },
  { furi: null, boke: [
    { boke: 'きのうは、月までスキップで行ってきた。', tsukkomi: '行けるかい！' },
    { boke: 'サンタさんに、お歳暮を贈っといたで。', tsukkomi: '気ぃつかいすぎや！' },
    { boke: 'お弁当箱あけたら、お弁当箱が入っててん。', tsukkomi: 'マトリョーシカか！' },
  ] },
];
const ALL_BOKE = BITS.flatMap((b) => b.boke);

// Partner / tsukkomi words in two flavours. Built-in material is Kansai-ben; a caller's
// script written in standard Japanese (e.g. a Tokyo duo) gets the 'std' set automatically.
const WORDS = {
  kansai: {
    tsukkomi: ['なんでやねん！', 'どういうことやねん！', 'そんなわけあるかい！', 'おかしいやろ！', 'どないやねん！', 'なんでそうなるねん！', 'ありえへんやろ！', '聞いたことないわ！'],
    early: ['まだ途中やがな！', '最後まで聞いてや！', '話の途中やで！'],
    fake: ['え、ふつうの話やで？', 'まだボケてへんで？', 'ツッコむとこちゃうで！'],
    miss: ['…ツッコんでや！', '…あれ？スルー？', 'いや、何か言うてや！'],
    closer: 'もうええわ！',
    comments: ['劇場が大爆笑！最高の間やったで！', 'ええツッコミ！お客さんも大喜びや！', 'まずまずウケた！間をもっと磨こう！', 'ちょっとスベったかも…次こそ！', 'シーン…。ネタ合わせからやり直しや！'],
  },
  std: {
    tsukkomi: ['なんでだよ！', 'どういうことだよ！', 'そんなわけないだろ！', 'おかしいだろ！', 'ありえないだろ！', '聞いたことないよ！'],
    early: ['まだ途中だって！', '最後まで聞いてよ！', '話の途中だよ！'],
    fake: ['え、ふつうの話だよ？', 'まだボケてないよ？', 'ツッコむとこじゃないよ！'],
    miss: ['…ツッコんでよ！', '…あれ？スルー？', 'いや、何か言ってよ！'],
    closer: 'いいかげんにしろ！',
    comments: ['劇場が大爆笑！最高の間だった！', 'いいツッコミ！お客さんも大喜び！', 'まずまずウケた！間をもっと磨こう！', 'ちょっとスベったかも…次こそ！', 'シーン…。ネタ合わせからやり直し！'],
  },
};
const KANSAI_RE = /やねん|ねん|へん|やろ|やない|やで|かい[！!]|がな|ちゃう|あかん|[やわ][！!？?]/;
const CROWD = ['ワハハ', 'アハハ', 'ドッ！', 'ハハハ', 'ウフフ', 'ワハハハ'];

export const TSUKKOMI_CONTENT = { BITS, WORDS };

// ------------------------------------------------------------------ tuning
const DIFF = {
  rounds: [6, 7, 8, 9, 10],
  fakes: [1, 2, 3, 3, 4],
  charF: [4.2, 3.6, 3.0, 2.6, 2.2], // frames per character
  perfect: [26, 22, 18, 15, 12], // frames after the line ends
  good: [22, 19, 16, 14, 12],
  late: [26, 23, 20, 18, 16],
  pre: [40, 34, 30, 26, 22], // pause before each line
};
const GRACE = 4; // pressing this many frames before the last character still counts as on time
const NORMAL_W = 0.4; // weight of a フリ (letting it pass = small bonus)
const FAKE_PENALTY = 0.5; // pressing on a フリ
const EARLY_PENALTY = 0.25; // pressing while a ボケ is still being said (worse than letting it pass)
const MIN_LINES = 3;

// ------------------------------------------------------------------ stage layout
const FEET_Y = 176;
const SCALE = 3;
const PARTNER_X = 96; // left edge of the 48px wide sprite
const PLAYER_X = 176;
const MIC_X = 160;
const PARTNER_HEAD = { x: 120, y: 116 };
const PLAYER_HEAD = { x: 200, y: 116 };
const PARTNER_LOOK = { hair: 'afro', hairColor: 'brown', skin: 'fair', top: '#2f6fd0', bottom: '#24305e', jacket: true, tie: '#ffd23f' };
const INK = '#22202a';

registerSong('tsukkomi_debayashi', {
  bpm: 136, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . F5 D5 . | E5 . G5 C6 . G5 E5 . | D5 E5 F5 E5 D5 . G4 . | C5 . E5 G5 . E5 C5 . | A4 . C5 F5 . A5 G5 . | F5 E5 D5 C5 B4 . D5 . | C5 - - . G4 . C5 .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});

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

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
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

const pickFrom = (arr, r) => arr[Math.floor(r() * arr.length)];

// ------------------------------------------------------------------ the game
class TsukkomiManzai extends Minigame {
  static title = 'ツッコミ漫才';
  static howto = [
    'ボケが言い終わったら Aでツッコミ！',
    '直後ほど高得点！早すぎはダメ',
    'ふつうの話（フリ）はBで見送ろう',
  ];
  static skill = 'warai';
  static bgm = 'tsukkomi_debayashi';

  init() {
    const d = this.difficulty - 1;
    this.charF = this.ease(DIFF.charF[d], 0.35);
    this.winP = Math.round(this.ease(DIFF.perfect[d], 0.5));
    this.winG = this.winP + Math.round(this.ease(DIFF.good[d], 0.4));
    this.winL = this.winG + Math.round(this.ease(DIFF.late[d], 0.3));
    this.preF = DIFF.pre[d];
    this.mctx = makeCanvas(8, 8)[1];

    this.script = this.buildScript(d);
    if (!this.script.some((l) => l.punch)) this.script.push(this.builtin(1, 0)[0]);
    this.words = WORDS[this.dialect] || WORDS.kansai;
    // フリ are worth a little; capped so that doing nothing never scores more than ~23
    const nBoke = this.script.filter((l) => l.punch).length;
    const nFuri = this.script.length - nBoke;
    this.normalW = nFuri ? Math.min(NORMAL_W, (0.3 * nBoke) / nFuri) : NORMAL_W;
    this.totalW = nBoke + nFuri * this.normalW;
    this.earned = 0;
    this.shown = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, good: 0, late: 0, early: 0, miss: 0, fake: 0, pass: 0 };

    this.idx = -1;
    this.cur = null;
    this.state = 'opening';
    this.st = 0;
    this.bubble = null;
    this.burst = null;
    this.emote = null;
    this.slap = null;
    this.knock = 0;
    this.knockPow = 1;
    this.stars = 0;
    this.impact = 0;
    this.shakeT = 0;
    this.laugh = 0;
    this.silenceT = 0;
    this.pressMark = null;
    this.crowd = [];
    this.sched = [];

    const st = this.g.state || {};
    this.partnerName = this.opts.partner || '相方';
    this.partnerLook = this.opts.partnerLook || PARTNER_LOOK;
    this.playerLook = st.look || LOOKS.player;
    this.boSheet = charSheet(this.partnerLook);
    this.tsSheet = charSheet(this.playerLook);
    this.bg = this.renderStage();
    this.audience = this.makeAudience();
  }

  // ---------------------------------------------------------------- script
  buildScript(d) {
    const custom = Array.isArray(this.opts.lines)
      ? this.opts.lines.filter((l) => l && l.boke).map((l) => ({ text: String(l.boke), punch: !!l.punch, tsukkomi: l.tsukkomi ? String(l.tsukkomi) : null }))
      : [];
    // dialect of the partner's reactions / the closing line: explicit opts.dialect, else
    // standard Japanese when a custom script has its own ツッコミ and none of it is Kansai-ben
    const std = custom.some((l) => l.tsukkomi) && !custom.some((l) => KANSAI_RE.test(l.text + (l.tsukkomi || '')));
    this.dialect = this.opts.dialect === 'std' || this.opts.dialect === 'kansai' ? this.opts.dialect : std ? 'std' : 'kansai';
    const ratio = DIFF.fakes[d] / DIFF.rounds[d];
    const want = Number(this.opts.rounds);
    let rounds = Number.isFinite(want) && want > 0 ? clamp(Math.round(want), MIN_LINES, 16) : null;
    if (custom.length) {
      rounds = rounds ?? Math.max(MIN_LINES, custom.length);
      if (custom.length >= rounds) return custom.slice(0, rounds);
      const k = rounds - custom.length;
      return custom.concat(this.builtin(k, Math.floor(k * ratio)));
    }
    if (rounds == null) return this.builtin(DIFF.rounds[d], DIFF.fakes[d]);
    return this.builtin(rounds, Math.round(rounds * ratio));
  }

  // n lines with `fakes` フリ. A フリ is always followed by a ボケ from the same bit;
  // the first and last lines are always ボケ.
  builtin(n, fakes) {
    const r = this.rng;
    // フリ go in slots 1..n-2, never two in a row (random greedy, retried until it fits)
    let fakeAt = new Set();
    for (let tries = 0; tries < 30; tries++) {
      const set = new Set();
      for (const s of shuffle(Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1), r)) {
        if (set.size >= fakes) break;
        if (set.has(s - 1) || set.has(s + 1)) continue;
        set.add(s);
      }
      if (set.size > fakeAt.size) fakeAt = set;
      if (fakeAt.size >= fakes) break;
    }
    const bits = shuffle(BITS.filter((b) => b.furi), r);
    const used = new Set();
    const out = new Array(n).fill(null);
    let bi = 0;
    for (const s of [...fakeAt].sort((a, b) => a - b)) {
      const bit = bits[bi++ % bits.length];
      const b = shuffle(bit.boke, r).find((x) => !used.has(x));
      if (!b) continue;
      used.add(b);
      out[s] = { text: bit.furi, punch: false, tsukkomi: null };
      out[s + 1] = { text: b.boke, punch: true, tsukkomi: b.tsukkomi };
    }
    const rest = shuffle(ALL_BOKE, r).filter((b) => !used.has(b));
    for (let i = 0; i < n; i++) {
      if (out[i]) continue;
      const b = rest.pop() || pickFrom(ALL_BOKE, r);
      out[i] = { text: b.boke, punch: true, tsukkomi: b.tsukkomi };
    }
    return out;
  }

  // Lay out a line for the speech bubble and compute when each character appears.
  prep(line) {
    const { lines, size } = this.fit(line.text);
    const chars = lines.flatMap((l) => Array.from(l));
    const revealAt = [];
    let t = 0;
    chars.forEach((ch, i) => {
      const prev = chars[i - 1];
      t += this.charF;
      if (prev && '、，…'.includes(prev)) t += this.charF * 2.5;
      else if (prev && '。！？'.includes(prev)) t += this.charF * 1.5;
      revealAt.push(t);
    });
    return { ...line, lines, size, chars, revealAt, finishT: Math.ceil(t), shown: 0 };
  }

  // 12px text in rows of up to 196px; a long custom line that would need more than
  // 3 rows switches to 10px so the bubble never covers the stage (the width stays
  // clear of the judgement popups on the right).
  fit(str) {
    const lines = this.layout(str, 12, 196);
    if (lines.length <= 3) return { lines, size: 12 };
    return { lines: this.layout(str, 10, 206), size: 10 };
  }

  // Wrap for the bubble: phrases ending in 、。！？ are packed greedily into rows so
  // lines break at natural points (readable at speed); an over-long phrase is wrapped
  // by character. Explicit "\n" is respected.
  layout(str, size = 12, maxW = 196) {
    const m = (x) => measure(this.mctx, x, size);
    const out = [];
    for (const para of String(str).split('\n')) {
      const segs = para.match(/[^、。！？]+[、。！？]*|[、。！？]+/g) || [''];
      let cur = '';
      for (const seg of segs) {
        if (m(cur + seg) <= maxW) { cur += seg; continue; }
        if (cur) out.push(cur);
        if (m(seg) <= maxW) { cur = seg; continue; }
        const rows = wrap(this.mctx, seg, maxW, size);
        cur = rows.pop();
        out.push(...rows);
      }
      out.push(cur);
    }
    return out;
  }

  makeBubble(textOrLines, { bar: withBar = false, tails = [PARTNER_HEAD], name = this.partnerName, cx = null, size = null } = {}) {
    let lines = textOrLines;
    if (!Array.isArray(lines)) ({ lines, size } = this.fit(textOrLines));
    size = size || 12;
    const lh = size + 3;
    let tw = 0;
    for (const l of lines) tw = Math.max(tw, measure(this.mctx, l, size));
    const w = Math.min(W - 16, Math.max(withBar ? 140 : 60, Math.ceil(tw) + 20));
    const h = 8 + lines.length * lh + (withBar ? 12 : 0) + 3;
    const center = cx ?? tails[0].x;
    const x = clamp(Math.round(center - w / 2), 8, W - 8 - w);
    const total = lines.reduce((k, l) => k + Array.from(l).length, 0);
    return { lines, size, lh, w, h, x, y: 28, bar: withBar, tails, name, n: Infinity, total };
  }

  // ---------------------------------------------------------------- flow
  // Run fn after `frames` play frames (independent of state changes).
  later(frames, fn) { this.sched.push({ at: this.pt + frames, fn }); }

  setState(s) { this.state = s; this.st = 0; }

  nextLine() {
    this.idx++;
    this.bubble = null;
    this.burst = null;
    this.emote = null;
    this.pressMark = null;
    this.sched = [];
    if (this.idx >= this.script.length) { this.startClosing(); return; }
    if (this.idx === 0) audio.stopBgm(); // the act itself is played without music
    this.cur = this.prep(this.script[this.idx]);
    this.setState('pre');
  }

  updatePlay(inp) {
    this.st++;
    // scheduled one-shots (sounds, reactions)
    const due = this.sched.filter((e) => e.at <= this.pt);
    if (due.length) {
      this.sched = this.sched.filter((e) => e.at > this.pt);
      for (const e of due) e.fn();
    }
    this.tickFx();

    switch (this.state) {
      case 'opening': {
        if (this.st === 1) {
          this.bubble = this.makeBubble('はいどうもー！よろしくお願いしますー！');
          this.bubble.n = 0;
          this.g.sfx('applause');
          this.laugh = 0.6;
        }
        if (this.bubble && this.st % 2 === 0 && this.bubble.n < this.bubble.total) { this.bubble.n++; if (this.bubble.n % 2) this.voice(false); }
        if (this.st >= 96) this.nextLine();
        break;
      }
      case 'pre':
        if (this.st >= this.preF) {
          this.bubble = this.makeBubble(this.cur.lines, { bar: true, size: this.cur.size });
          this.bubble.n = 0;
          this.setState('type');
        }
        break;
      case 'type': {
        const c = this.cur;
        let n = c.shown;
        while (n < c.chars.length && c.revealAt[n] <= this.st) n++;
        if (n > c.shown) {
          const ch = c.chars[n - 1];
          if (!'、。！？…'.includes(ch) && n % 2 === 1) this.voice(false);
          c.shown = n;
          this.bubble.n = n;
        }
        if (inp.pressed('a')) {
          if (this.st >= c.finishT - GRACE) { this.bubble.n = Infinity; this.onPress(0); } else this.onEarly();
        } else if (this.st >= c.finishT) {
          this.bubble.n = Infinity;
          this.cue();
          this.setState('window');
        }
        break;
      }
      case 'window':
        if (inp.pressed('a')) this.onPress(this.st);
        else if (inp.pressed('b')) this.onLetGo(true);
        else if (this.st > this.winL) this.onLetGo(false);
        break;
      case 'react':
        if (this.st >= this.reactLen) this.nextLine();
        break;
      case 'closing':
        if (this.st >= 150) {
          this.setState('done');
          this.end(this.finalScore(), this.comment());
        }
        break;
      default:
        break;
    }
  }

  react(len) { this.setState('react'); this.reactLen = len; }

  // A pressed after (or right at the end of) the line.
  onPress(t) {
    const c = this.cur;
    this.pressMark = { t };
    if (!c.punch) { this.onFake(); return; }
    const grade = t <= this.winP ? 'PERFECT' : t <= this.winG ? 'GOOD' : 'LATE';
    const pts = grade === 'PERFECT' ? 1 : grade === 'GOOD' ? 0.75 : 0.4;
    this.earned += pts;
    this.counts[grade.toLowerCase()]++;
    if (grade === 'LATE') this.combo = 0;
    else this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const phrase = c.tsukkomi || pickFrom(this.words.tsukkomi, this.rng);
    this.burst = { text: grade === 'LATE' ? '…' + phrase : phrase, t: 0, size: grade === 'PERFECT' ? 14 : 12, weak: grade === 'LATE' };
    this.startSlap(grade === 'PERFECT' ? 2 : grade === 'GOOD' ? 1.3 : 0.7);
    this.g.sfx('hit');
    this.voice(true);
    const lv = grade === 'PERFECT' ? 1 : grade === 'GOOD' ? 0.7 : 0.35;
    this.later(6, () => { this.g.sfx('laugh'); this.laugh = Math.max(this.laugh, lv); this.spawnCrowd(grade === 'PERFECT' ? 6 : grade === 'GOOD' ? 4 : 2); });
    if (grade === 'PERFECT' && this.combo >= 3) this.later(16, () => this.g.sfx('applause'));
    if (grade === 'PERFECT') this.stars = 46;
    const col = grade === 'PERFECT' ? COLORS.accent : grade === 'GOOD' ? COLORS.good : COLORS.cyan;
    this.popup(grade === 'LATE' ? 'LATE…' : grade + '!', 274, 58, col, grade === 'PERFECT' ? 14 : 12);
    if (this.combo >= 2) this.popup(`${this.combo}コンボ！`, 274, 76, COLORS.pink, 10);
    this.react(74);
  }

  // A pressed while the line was still being spoken.
  onEarly() {
    const c = this.cur;
    if (!c.punch) { this.pressMark = null; this.onFake(); return; }
    this.counts.early++;
    this.earned -= EARLY_PENALTY;
    this.combo = 0;
    this.pressMark = null;
    // cut the line off where it was
    const cut = Math.max(1, c.shown);
    this.bubble = this.makeBubble(c.chars.slice(0, cut).join('') + '…', { bar: false });
    this.burst = { text: 'なん…', t: 0, size: 12, weak: true };
    this.startSlap(0, true);
    this.g.sfx('buzz');
    this.popup('早すぎ！', 274, 58, COLORS.bad, 12);
    this.later(18, () => {
      this.burst = null;
      this.bubble = this.makeBubble(pickFrom(this.words.early, this.rng));
      this.emote = { ch: '！', t: 0 };
      this.silenceT = 60;
      this.voice(false);
    });
    this.react(86);
  }

  // A pressed on a normal line (フリ).
  onFake() {
    this.earned -= FAKE_PENALTY;
    this.counts.fake++;
    this.combo = 0;
    this.bubble.n = Infinity;
    this.burst = { text: pickFrom(this.words.tsukkomi, this.rng), t: 0, size: 12 };
    this.startSlap(1);
    this.g.sfx('hit');
    this.voice(true);
    this.popup('それはフリ！', 274, 58, COLORS.bad, 12);
    this.later(14, () => { this.g.sfx('buzz'); this.emote = { ch: '？', t: 0 }; this.silenceT = 60; });
    this.later(26, () => {
      this.burst = null;
      this.bubble = this.makeBubble(pickFrom(this.words.fake, this.rng));
      this.voice(false);
    });
    this.react(90);
  }

  // Window ran out, or B pressed: correct for a フリ, a miss for a ボケ.
  onLetGo(byB) {
    const c = this.cur;
    if (c.punch) {
      this.counts.miss++;
      this.combo = 0;
      this.g.sfx('cancel');
      this.popup('スルー…', 274, 58, COLORS.dim, 12);
      this.silenceT = 60;
      this.later(10, () => {
        this.emote = { ch: '…', t: 0 };
        this.bubble = this.makeBubble(pickFrom(this.words.miss, this.rng));
        this.voice(false);
      });
      this.react(78);
    } else {
      this.earned += this.normalW;
      this.counts.pass++;
      this.g.sfx('good');
      this.popup('ナイス見送り', 274, 58, COLORS.good, 10);
      this.react(byB ? 20 : 16);
    }
  }

  startClosing() {
    this.setState('closing');
    this.bubble = null;
    this.burst = { text: this.words.closer, t: 0, size: 14 };
    this.startSlap(1.6);
    this.g.sfx('hit');
    this.voice(true);
    this.later(6, () => { this.g.sfx('laugh'); this.laugh = Math.max(this.laugh, 0.8); this.spawnCrowd(4); });
    this.later(44, () => {
      this.burst = null;
      this.bubble = this.makeBubble('どうも、ありがとうございましたー！', { tails: [PARTNER_HEAD, PLAYER_HEAD], name: null, cx: MIC_X });
      this.g.sfx('applause');
      this.laugh = 0.7;
      audio.bgm(TsukkomiManzai.bgm);
    });
    this.later(80, () => this.g.sfx('applause'));
  }

  finalScore() { return clamp((Math.max(0, this.earned) / this.totalW) * 100, 0, 100); }

  comment() {
    const s = Math.round(this.finalScore());
    const c = this.words.comments;
    return c[s >= 90 ? 0 : s >= 75 ? 1 : s >= 55 ? 2 : s >= 35 ? 3 : 4];
  }

  // ---------------------------------------------------------------- effects
  startSlap(power, weak = false) {
    this.slap = { t: 0, power, weak };
  }

  tickFx() {
    if (this.slap) {
      const s = this.slap;
      s.t++;
      if (s.t === 4 && !s.weak) {
        this.knock = 1;
        this.knockPow = s.power;
        this.impact = 9;
        this.shakeT = s.power >= 2 ? 8 : s.power >= 1 ? 5 : 2;
      }
      if (s.t > 32) this.slap = null;
    }
    if (this.knock > 0) this.knock = Math.max(0, this.knock - 0.05);
    if (this.impact > 0) this.impact--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.stars > 0) this.stars--;
    if (this.silenceT > 0) this.silenceT--;
    if (this.burst) this.burst.t++;
    if (this.emote) this.emote.t++;
    this.laugh = Math.max(0, this.laugh - 0.008);
    if (this.laugh > 0.25 && this.st % 7 === 0 && this.rng() < this.laugh) this.spawnCrowd(1);
    for (const c of this.crowd) c.t++;
    this.crowd = this.crowd.filter((c) => c.t < 44);
    const target = Math.max(0, this.earned) / this.totalW;
    this.shown += (target - this.shown) * 0.12;
  }

  // Laughter text rising from the audience; one per column so they never pile up.
  spawnCrowd(n) {
    for (let i = 0; i < n; i++) {
      const free = [];
      for (let col = 0; col < 6; col++) if (!this.crowd.some((c) => c.col === col && c.t < 26)) free.push(col);
      if (!free.length) return;
      const col = pickFrom(free, this.rng);
      this.crowd.push({ col, str: pickFrom(CROWD, this.rng), x: 34 + col * 50 + Math.round((this.rng() - 0.5) * 10), y: 200 + Math.round(this.rng() * 10), t: -Math.floor(this.rng() * 8) });
    }
  }

  // Little chiptune "voice" blips (audio.ctx is null until the first user gesture).
  voice(player) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    const f = player ? 760 + this.rng() * 120 : 420 + this.rng() * 90;
    audio.tone(f, t, 0.035, { wave: 'square', vol: player ? 0.04 : 0.035 });
  }

  // Soft cue played when every line finishes (ボケ and フリ alike).
  cue() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    audio.tone(1175, t, 0.05, { wave: 'triangle', vol: 0.07 });
  }

  // ---------------------------------------------------------------- static stage
  renderStage() {
    const [cv, c] = makeCanvas(W, H);
    // back wall
    for (let y = 16; y < 152; y += 2) {
      c.fillStyle = mix('#5c1628', '#2a0812', (y - 16) / 136);
      c.fillRect(0, y, W, 2);
    }
    for (let x = 4; x < W; x += 12) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, 30, 2, 122); }
    // gold folding screen (金屏風)
    const bx = 64, by = 52, bw = 192, bh = 100;
    rect(c, bx - 2, by - 3, bw + 4, bh + 3, '#2a160c');
    for (let p = 0; p < 6; p++) {
      const px = bx + p * 32;
      for (let y = 0; y < bh; y += 2) {
        c.fillStyle = mix(p % 2 ? '#d7a73a' : '#cf9d33', '#8f6a1e', y / bh);
        c.fillRect(px, by + y, 32, 2);
      }
      rect(c, px, by, 1, bh, '#f2d27a');
      rect(c, px + 31, by, 1, bh, '#6e4f14');
    }
    // stylised mist bands
    const mist = [[70, 62, 70], [150, 70, 90], [88, 112, 60], [176, 124, 66], [120, 92, 40]];
    for (const [mx, my, mw] of mist) {
      rect(c, mx + 3, my, mw - 6, 1, '#f6dc8c');
      rect(c, mx, my + 1, mw, 5, '#ecc865');
      rect(c, mx + 3, my + 6, mw - 6, 1, '#b8892a');
    }
    // pine branch on the right panels
    rect(c, 214, 80, 30, 3, '#5a3a1a');
    rect(c, 228, 72, 3, 14, '#5a3a1a');
    for (const [x, y] of [[206, 74], [222, 66], [238, 76], [214, 86]]) fillEllipse(c, x + 6, y + 3, 9, 4, '#2f6b34');
    // valance
    for (let x = 0; x < W; x += 10) {
      rect(c, x, 16, 10, 14, x % 20 ? '#b31f34' : '#9a1a2c');
      rect(c, x + 9, 16, 1, 14, '#6e0f1e');
      fillEllipse(c, x + 5, 30, 5, 3, x % 20 ? '#b31f34' : '#9a1a2c');
    }
    rect(c, 0, 16, W, 2, '#ffd23f');
    for (let x = 0; x < W; x += 10) rect(c, x + 2, 33, 6, 1, '#e8b830');
    // stage floor
    rect(c, 0, 150, W, 2, '#1a0a08');
    for (let y = 152, row = 0; y < 184; y += 8, row++) {
      rect(c, 0, y, W, 8, row % 2 ? '#a46f38' : '#b07a40');
      rect(c, 0, y, W, 1, row % 2 ? '#b98448' : '#c48d50');
      for (let x = (row * 37) % 64; x < W; x += 64) rect(c, x, y, 1, 8, '#7a4f26');
    }
    // spotlight cone + pool
    c.globalAlpha = 0.07;
    fillPoly(c, [[132, 18], [188, 18], [276, 184], [44, 184]], '#fff2c8');
    c.globalAlpha = 0.16;
    fillEllipse(c, 160, 172, 104, 12, '#fff0c0');
    c.globalAlpha = 1;
    // stage lip + footlights
    rect(c, 0, 184, W, 8, '#4a2a14');
    rect(c, 0, 184, W, 1, '#e0a868');
    for (let x = 14; x < W; x += 28) { rect(c, x, 187, 6, 3, '#ffe9a0'); rect(c, x + 1, 186, 4, 1, '#fff8d8'); }
    rect(c, 0, 192, W, H - 192, '#0d0a16');
    // side curtains
    for (const side of [0, 1]) {
      for (let i = 0; i < 6; i++) {
        const w = 5;
        const x = side ? W - 30 + i * w : i * w;
        const col = ['#a01a2c', '#c02438', '#8a1424'][i % 3];
        rect(c, x, 16, w, 136, col);
        rect(c, x, 16, 1, 136, '#6e0f1e');
      }
      const ex = side ? W - 31 : 30;
      rect(c, ex, 16, 1, 136, '#5a0c18');
      rect(c, side ? W - 32 : 0, 92, 32, 4, '#e8b830');
      rect(c, side ? W - 32 : 0, 96, 32, 1, '#9a7420');
    }
    // めくり (name stand)
    rect(c, 272, 156, 2, 24, '#4a2a14');
    rect(c, 284, 156, 2, 24, '#4a2a14');
    rect(c, 268, 178, 22, 2, '#3a1f0e');
    rect(c, 266, 108, 26, 50, INK);
    rect(c, 267, 109, 24, 48, '#f4efe0');
    rect(c, 266, 106, 26, 3, '#3a1f0e');
    text(c, '漫', 279, 114, { size: 14, align: 'center', color: '#1a1a1a', shadow: null });
    text(c, '才', 279, 134, { size: 14, align: 'center', color: '#1a1a1a', shadow: null });
    rect(c, 274, 151, 10, 3, '#c0303a');
    return cv;
  }

  makeAudience() {
    const r = mulberry32(1234);
    const heads = [];
    for (let x = 6; x < W; x += 21) heads.push({ x: x + Math.floor(r() * 6), y: 206, rad: 8 + Math.floor(r() * 2), row: 0, style: Math.floor(r() * 4), ph: r() * 6.28 });
    for (let x = -6; x < W + 10; x += 27) heads.push({ x: x + Math.floor(r() * 6), y: 228, rad: 10 + Math.floor(r() * 2), row: 1, style: Math.floor(r() * 4), ph: r() * 6.28 });
    return heads;
  }

  // ---------------------------------------------------------------- drawing
  drawPlay(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shakeT > 0) ctx.translate(Math.round((this.rng() - 0.5) * this.shakeT), Math.round((this.rng() - 0.5) * this.shakeT * 0.6));
    ctx.drawImage(this.bg, 0, 0);
    this.drawPartner(ctx);
    this.drawMic(ctx);
    this.drawPlayer(ctx);
    this.drawImpact(ctx);
    this.drawAudience(ctx);
    ctx.restore();

    if (this.bubble) this.drawBubble(ctx, this.bubble);
    if (this.burst) this.drawBurst(ctx, this.burst);
    if (this.emote) this.drawEmote(ctx);
    this.drawHud(ctx);
  }

  bob(phase) {
    return Math.floor((this.pt + phase) / 30) % 2;
  }

  drawPartner(ctx) {
    let x = PARTNER_X;
    let y = FEET_Y - 20 * SCALE;
    let rot = 0;
    if (this.knock > 0) {
      const k = this.knock * this.knock;
      x -= k * 7 * Math.min(2, this.knockPow);
      rot = -k * 0.16 * Math.min(2, this.knockPow);
    }
    const talking = this.state === 'type' || (this.state === 'opening' && this.bubble && this.bubble.n < this.bubble.total);
    if (!talking && this.knock === 0) y += this.bob(0);
    if (this.state === 'closing' && this.st > 50 && this.st < 110) y -= Math.max(0, Math.round(Math.sin(((this.st - 50) / 60) * Math.PI * 3) * 3));
    ctx.save();
    ctx.translate(Math.round(x + 24), Math.round(y + 60));
    if (rot) ctx.rotate(rot);
    ctx.scale(SCALE, SCALE);
    drawChar(ctx, this.boSheet, 'down', 0, -8, -16);
    // mouth
    const open = talking && Math.floor(this.st / 4) % 2 === 0;
    const reacting = this.emote && this.emote.t < 60;
    if (open || reacting || this.knock > 0.3) {
      ctx.fillStyle = INK;
      ctx.fillRect(-1, -12, 2, open || this.knock > 0.3 ? 2 : 1);
    }
    ctx.restore();
    // dizzy stars after a perfect tsukkomi
    if (this.stars > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.pt / 7 + i * 2.1;
        sparkle(ctx, PARTNER_X + 24 + Math.cos(a) * 16 - this.knock * 8, 112 + Math.sin(a) * 4, 2, i % 2 ? '#fff6a8' : '#ffffff');
      }
    }
  }

  drawPlayer(ctx) {
    let x = PLAYER_X;
    let y = FEET_Y - 20 * SCALE;
    let dir = 'down';
    let arm = 0;
    const s = this.slap;
    if (s) {
      const reach = s.weak ? 0.45 : 1;
      let lunge;
      if (s.t < 4) lunge = s.t / 4;
      else if (s.t < 16) lunge = 1;
      else lunge = Math.max(0, 1 - (s.t - 16) / 12);
      x -= Math.round(lunge * 8 * reach);
      dir = s.t < 30 ? 'left' : 'down';
      arm = s.t < 18 ? lunge * reach : 0;
    } else {
      y += this.bob(15);
    }
    if (this.state === 'closing' && this.st > 50 && this.st < 110) y -= Math.max(0, Math.round(Math.sin(((this.st - 50) / 60) * Math.PI * 3 + 0.6) * 3));
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(SCALE, SCALE);
    drawChar(ctx, this.tsSheet, dir, 0, 0, 4);
    if (arm > 0) {
      const look = this.playerLook;
      const skin = SKIN[look.skin] || look.skin || SKIN.fair;
      const top = look.top || '#d64161';
      const L = Math.round(arm * 9);
      ctx.fillStyle = INK;
      ctx.fillRect(4 - L, 11, L, 4);
      ctx.fillStyle = top;
      ctx.fillRect(4 - L, 12, L, 2);
      ctx.fillStyle = INK;
      ctx.fillRect(4 - L - 4, 10, 4, 5);
      ctx.fillStyle = skin;
      ctx.fillRect(4 - L - 3, 11, 3, 3);
    }
    ctx.restore();
  }

  drawMic(ctx) {
    fillEllipse(ctx, MIC_X, 178, 9, 2, '#2a2d36');
    rect(ctx, MIC_X - 6, 176, 12, 2, '#5a5f6b');
    rect(ctx, MIC_X - 1, 139, 3, 38, '#7a808c');
    rect(ctx, MIC_X - 1, 139, 1, 38, '#e0e4ea');
    rect(ctx, MIC_X - 3, 136, 7, 4, '#3a3d48');
    // head
    rect(ctx, MIC_X - 4, 124, 9, 13, INK);
    rect(ctx, MIC_X - 5, 126, 11, 9, INK);
    rect(ctx, MIC_X - 3, 125, 7, 11, '#c8ccd4');
    rect(ctx, MIC_X - 4, 127, 9, 7, '#c8ccd4');
    for (let yy = 127; yy < 135; yy += 2) rect(ctx, MIC_X - 3, yy, 7, 1, '#8a909c');
    rect(ctx, MIC_X - 2, 126, 1, 4, '#ffffff');
  }

  drawImpact(ctx) {
    if (this.impact <= 0) return;
    const cx = 140, cy = 150;
    const r = 6 + (9 - this.impact) * 0.8;
    fillPoly(ctx, starPts(cx, cy, r + 2, r + 2, 8, 0.45, this.impact * 0.2), INK);
    fillPoly(ctx, starPts(cx, cy, r, r, 8, 0.45, this.impact * 0.2), '#fff6a8');
    fillPoly(ctx, starPts(cx, cy, r * 0.5, r * 0.5, 8, 0.5, this.impact * 0.2), '#ffffff');
    // speed lines
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) ctx.fillRect(cx + 14 + i * 3, cy - 8 + i * 8, 8, 1);
  }

  drawAudience(ctx) {
    const amp = this.laugh;
    for (const h of this.audience) {
      let dy = 0;
      if (amp > 0.05) dy = -Math.round(Math.abs(Math.sin(this.pt * 0.35 + h.ph)) * 3 * amp);
      const body = h.row ? '#130e1e' : '#211a30';
      const rim = h.row ? '#2a2240' : '#3a3052';
      const x = h.x, y = h.y + dy;
      fillEllipse(ctx, x, y + h.rad + 8, h.rad + 7, 8, body);
      fillEllipse(ctx, x, y, h.rad, h.rad, body);
      rect(ctx, x - h.rad + 3, y - h.rad, (h.rad - 3) * 2, 1, rim);
      if (h.style === 1) { fillEllipse(ctx, x, y - h.rad - 2, 4, 3, body); rect(ctx, x - 2, y - h.rad - 5, 4, 1, rim); }
      if (h.style === 2) { rect(ctx, x - h.rad - 2, y - 3, h.rad * 2 + 4, 2, body); }
    }
    // laughter text
    for (const c of this.crowd) {
      if (c.t < 0) continue;
      ctx.globalAlpha = clamp(1 - c.t / 44, 0, 1);
      text(ctx, c.str, c.x, c.y - c.t * 0.5, { size: 10, align: 'center', color: '#ffe680', outline: '#3a1a00' });
      ctx.globalAlpha = 1;
    }
    if (this.silenceT > 0) {
      ctx.globalAlpha = clamp(this.silenceT / 30, 0, 1);
      text(ctx, 'シーン…', 160, 204, { size: 12, align: 'center', color: '#9aa3c7', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  }

  drawBubble(ctx, b) {
    const { x, y, w, h } = b;
    // tails first (their outline is covered by the box)
    for (const tgt of b.tails) {
      const bx = clamp(tgt.x, x + 12, x + w - 12);
      const top = y + h - 2;
      const len = tgt.y - 6 - top;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const cx = Math.round(bx + (tgt.x - bx) * t);
        const hw = Math.round((1 - t) * 5);
        rect(ctx, cx - hw - 1, top + i, hw * 2 + 2, 1, INK);
        if (hw > 0) rect(ctx, cx - hw, top + i, hw * 2, 1, '#ffffff');
      }
    }
    roundBox(ctx, x, y, w, h, '#ffffff');
    for (const tgt of b.tails) {
      const bx = clamp(tgt.x, x + 12, x + w - 12);
      rect(ctx, bx - 5, y + h - 2, 10, 2, '#ffffff');
    }
    // name tab
    if (b.name) {
      const nw = Math.ceil(measure(ctx, b.name, 10)) + 10;
      roundBox(ctx, x + 6, y - 9, nw, 12, '#ff8a3d');
      text(ctx, b.name, x + 11, y - 8, { size: 10, color: '#ffffff', shadow: null });
    }
    // text (typewriter)
    let left = b.n;
    b.lines.forEach((line, i) => {
      if (left <= 0) return;
      const chars = Array.from(line);
      const s = left >= chars.length ? line : chars.slice(0, left).join('');
      left -= chars.length;
      text(ctx, s, x + 10, y + 7 + i * b.lh, { size: b.size, color: '#1a1a28', shadow: null });
    });
    if (b.bar) this.drawMaBar(ctx, x + 8, y + h - 14, w - 16);
  }

  // The "間" gauge inside the bubble: shown for every line, ボケ and フリ alike.
  drawMaBar(ctx, x, y, w) {
    text(ctx, '間', x, y - 1, { size: 10, color: '#6a6680', shadow: null });
    const bx = x + 14, bw = w - 14;
    const active = this.state === 'window' || this.state === 'react';
    ctx.globalAlpha = active ? 1 : 0.35;
    rect(ctx, bx, y + 2, bw, 6, INK);
    const zones = [[0, this.winP, '#ffd23f'], [this.winP, this.winG, '#5ee07a'], [this.winG, this.winL, '#5fd7ff']];
    for (const [a, b, col] of zones) {
      const x0 = bx + 1 + Math.round((a / this.winL) * (bw - 2));
      const x1 = bx + 1 + Math.round((b / this.winL) * (bw - 2));
      rect(ctx, x0, y + 3, Math.max(1, x1 - x0), 4, col);
    }
    ctx.globalAlpha = 1;
    let t = null;
    if (this.state === 'window') t = this.st;
    else if (this.state === 'react' && this.pressMark) t = this.pressMark.t;
    if (t != null) {
      const mx = bx + 1 + Math.round((clamp(t, 0, this.winL) / this.winL) * (bw - 3));
      rect(ctx, mx - 1, y, 4, 10, INK);
      rect(ctx, mx, y + 1, 2, 8, '#ffffff');
    }
  }

  // Lay out a burst once: shrink to 11px, then wrap a long (custom) ツッコミ into rows.
  burstLayout(ctx, b) {
    if (b.rows) return;
    const MAX = 132;
    let size = b.size || 12;
    while (measure(ctx, b.text, size) > MAX && size > 11) size--;
    const rows = measure(ctx, b.text, size) > MAX ? wrap(ctx, b.text, MAX, size) : [b.text];
    let tw = 0;
    for (const r of rows) tw = Math.max(tw, measure(ctx, r, size));
    Object.assign(b, { rows, fs: size, tw });
  }

  drawBurst(ctx, b) {
    this.burstLayout(ctx, b);
    const { rows, fs: size, tw } = b;
    const lh = size + 2;
    const pop = b.t < 6 ? 0.6 + b.t * 0.07 : 1;
    const rx = (tw / 2 + 16) * pop;
    const ry = ((b.weak ? 12 : 15) + (rows.length - 1) * lh * 0.6) * pop;
    const cx = Math.min(W - 6 - rx, 236);
    let cy = 98;
    // keep clear of a tall speech bubble
    const bb = this.bubble;
    if (bb && bb.x + bb.w > cx - rx) cy = clamp(bb.y + bb.h + ry + 3, 98, 128);
    const rot = b.t * 0.01;
    fillPoly(ctx, starPts(cx, cy, rx + 2, ry + 2, 14, 0.8, rot), INK);
    fillPoly(ctx, starPts(cx, cy, rx, ry, 14, 0.8, rot), b.weak ? '#e8e4f0' : '#fff2a0');
    if (b.t < 5) return; // text appears once the burst has (almost) fully popped
    const top = cy - (rows.length * lh) / 2;
    rows.forEach((r, i) => text(ctx, r, cx, top + i * lh, { size, align: 'center', color: b.weak ? '#4a4660' : '#c0182c', shadow: null }));
  }

  drawEmote(ctx) {
    const e = this.emote;
    if (e.t > 70) return;
    const x = PARTNER_X + 40, y = 98 - (e.t < 6 ? 6 - e.t : 0);
    roundBox(ctx, x, y, 16, 16, '#ffffff');
    rect(ctx, x + 3, y + 15, 3, 2, '#ffffff');
    rect(ctx, x + 2, y + 15, 1, 3, INK);
    rect(ctx, x + 3, y + 17, 2, 1, INK);
    text(ctx, e.ch, x + 8, y + 2, { size: 12, align: 'center', color: e.ch === '！' ? COLORS.bad : '#1a1a28', shadow: null });
  }

  drawHud(ctx) {
    rect(ctx, 0, 0, W, 16, '#0b0d1e');
    rect(ctx, 0, 16, W, 1, '#3a3060');
    const total = this.script.length;
    const n = clamp(this.idx + 1, 0, total);
    text(ctx, `ネタ ${n}/${total}`, 6, 3, { size: 10, color: COLORS.text });
    text(ctx, '爆笑', 92, 3, { size: 10, color: COLORS.accent });
    const frac = clamp(this.shown, 0, 1);
    bar(ctx, 116, 4, 120, 8, frac, frac >= 0.9 ? COLORS.accent : frac >= 0.55 ? COLORS.pink : COLORS.cyan);
    text(ctx, String(Math.round(frac * 100)), 240, 3, { size: 10, color: COLORS.text });
    if (this.combo >= 2) text(ctx, `${this.combo}コンボ`, W - 6, 3, { size: 10, align: 'right', color: COLORS.pink });
    // control hint
    rect(ctx, 0, 229, W, 11, 'rgba(0,0,0,0.6)');
    text(ctx, 'ボケの直後に A でツッコミ！　フリは B で見送り', W / 2, 229, { size: 10, align: 'center', color: '#c8cce6', shadow: null });
  }
}

registerMinigame('tsukkomi', TsukkomiManzai);
