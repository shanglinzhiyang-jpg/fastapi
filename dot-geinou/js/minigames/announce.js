// 原稿読み（アナウンサー） — minigame id 'announce' (skill: talk)
//
// The player is the news anchor of the fictional program 「ドットニュース」.
// A sentence scrolls through the prompter toward the red reading line. One
// difficult word is highlighted; pick its correct reading (↑↓ + A) before the
// word reaches the line. Correct → smooth reading (faster answer = more points).
// Wrong answer / time up → 「噛んだ！」.
//
// opts:
//   words: [{ word, reading, wrong: ['…', '…'], sentence? }]   custom pool
//          (sentence must contain `word`; otherwise a template sentence is used.
//           If fewer words than `count` are given, built-in words fill the rest.)
//   count: number of words to read (default 5 + difficulty)

import { Minigame, registerMinigame, text, panel, rect, bar, COLORS, sparkle } from '../engine/minigame.js';
import { setFont, measure, cursor as drawCursor } from '../engine/draw.js';
import { charSheet, LOOKS, SKIN } from '../engine/sprites.js';
import { W, H, clamp, makeCanvas, hash2, mix, shuffle } from '../engine/util.js';
import { audio } from '../engine/audio.js';

// ------------------------------------------------------------------ built-in words
// [word, correct reading, [wrong, wrong], news sentence containing the word, level 1-3]
// Wrong options are common misreadings that are NOT accepted readings.
const BUILTIN = [
  // level 1
  ['雰囲気', 'ふんいき', ['ふいんき', 'ふんいけ'], '会場は和やかな雰囲気に包まれました。', 1],
  ['進捗', 'しんちょく', ['しんぽ', 'しんしょう'], '工事の進捗は順調だということです。', 1],
  ['遵守', 'じゅんしゅ', ['そんしゅ', 'じゅんしゅう'], '交通ルールの遵守を呼びかけています。', 1],
  ['境内', 'けいだい', ['きょうない', 'けいない'], '神社の境内で秋祭りが開かれました。', 1],
  ['措置', 'そち', ['しょち', 'そうち'], '市は大雪に備えて特別な措置をとりました。', 1],
  ['有無', 'うむ', ['ゆうむ', 'うぶ'], 'イベント参加の有無をお知らせください。', 1],
  ['為替', 'かわせ', ['ためがえ', 'いがえ'], '為替の動きに注目が集まっています。', 1],
  ['老舗', 'しにせ', ['ろうてん', 'おいみせ'], '創業百年の老舗旅館が改装されました。', 1],
  ['健気', 'けなげ', ['けんき', 'けんげ'], '子犬の健気な姿が話題になっています。', 1],
  ['寄席', 'よせ', ['きせき', 'よりせき'], '寄席で新春の特別公演が開かれます。', 1],
  ['千秋楽', 'せんしゅうらく', ['せんあきらく', 'ちあきらく'], '人気の舞台が今日、千秋楽を迎えました。', 1],
  ['定石', 'じょうせき', ['ていせき', 'ていいし'], '定石どおりの作戦で勝利をつかみました。', 1],
  ['風情', 'ふぜい', ['ふうじょう', 'かぜなさけ'], '雪化粧した町並みに風情が漂います。', 1],
  ['小豆', 'あずき', ['こまめ', 'しょうまめ'], '今年は小豆が豊作となりました。', 1],
  ['雪崩', 'なだれ', ['ゆきくずれ', 'せつほう'], '山沿いでは雪崩に注意してください。', 1],
  ['五月雨', 'さみだれ', ['ごがつあめ', 'ごがつう'], '五月雨の季節を迎え、花が見頃です。', 1],
  ['一期一会', 'いちごいちえ', ['いっきいっかい', 'いちごいっかい'], '旅先での一期一会を描いた番組です。', 1],
  ['案山子', 'かかし', ['あんざんし', 'あんやまこ'], '田んぼに案山子がずらりと並びました。', 1],
  ['滑舌', 'かつぜつ', ['こつぜつ', 'かっした'], '新人アナが滑舌の特訓に励んでいます。', 1],
  ['年俸', 'ねんぽう', ['ねんぼう', 'ねんほう'], '選手の来季の年俸が発表されました。', 1],
  ['示唆', 'しさ', ['じさ', 'しさく'], '専門家は景気の回復を示唆しました。', 1],
  ['拍子木', 'ひょうしぎ', ['はくしぎ', 'ひょうしこ'], '拍子木の音とともに幕が開きました。', 1],
  // level 2
  ['相殺', 'そうさい', ['そうさつ', 'そうせつ'], '貸し借りを相殺する形で合意しました。', 2],
  ['凡例', 'はんれい', ['ぼんれい', 'ぼんれつ'], '新しい地図の凡例が見直されました。', 2],
  ['続柄', 'つづきがら', ['ぞくへい', 'つづきえ'], '書類には世帯主との続柄を記入します。', 2],
  ['他人事', 'ひとごと', ['たにんじ', 'ひとじ'], '防災は決して他人事ではありません。', 2],
  ['御用達', 'ごようたし', ['おんようたつ', 'ごようだて'], '料亭御用達の八百屋が人気です。', 2],
  ['発足', 'ほっそく', ['はつあし', 'ほつあし'], '新しい委員会が発足しました。', 2],
  ['舌鼓', 'したつづみ', ['ぜっこ', 'したばやし'], '観光客が名物料理に舌鼓を打ちました。', 2],
  ['汎用', 'はんよう', ['ぼんよう', 'ほうよう'], '汎用性の高いロボットが登場しました。', 2],
  ['脆弱', 'ぜいじゃく', ['きじゃく', 'もろじゃく'], 'システムの脆弱性が見つかりました。', 2],
  ['割愛', 'かつあい', ['わりあい', 'かつえ'], '時間の都合で詳細は割愛します。', 2],
  ['出納', 'すいとう', ['しゅつのう', 'でのう'], '町の出納係が帳簿を点検しました。', 2],
  ['間髪', 'かんはつ', ['かんぱつ', 'まがみ'], '選手は間髪を入れずに走り出しました。', 2],
  ['生粋', 'きっすい', ['なまいき', 'せいすい'], '生粋の職人が見事な技を披露しました。', 2],
  ['悪寒', 'おかん', ['あっかん', 'あくかん'], '悪寒を感じたら早めに休みましょう。', 2],
  ['歩合', 'ぶあい', ['ほあい', 'ほごう'], '営業の歩合が見直されました。', 2],
  ['遊説', 'ゆうぜい', ['ゆうせつ', 'ゆうぜつ'], '候補者が駅前で遊説を行いました。', 2],
  ['補填', 'ほてん', ['ほしん', 'ほちん'], '赤字を補填する予算が組まれました。', 2],
  ['貪欲', 'どんよく', ['ひんよく', 'どんらく'], '選手たちは貪欲に勝利を目指します。', 2],
  ['惜敗', 'せきはい', ['しゃくはい', 'おしはい'], '地元チームは決勝で惜敗しました。', 2],
  ['黎明', 'れいめい', ['りめい', 'しめい'], '宇宙開発の黎明期を振り返ります。', 2],
  ['流布', 'るふ', ['りゅうふ', 'りゅうぬの'], '誤った情報が流布しています。', 2],
  ['更迭', 'こうてつ', ['こうそう', 'こうしつ'], '担当の責任者が更迭されました。', 2],
  ['殺陣', 'たて', ['せつじん', 'さつじ'], '時代劇の殺陣を体験できる催しです。', 2],
  ['緞帳', 'どんちょう', ['だんちょう', 'たんちょう'], '劇場の緞帳が新しくなりました。', 2],
  ['桟敷', 'さじき', ['せんしき', 'さんしき'], '桟敷席から花火を楽しめます。', 2],
  ['心太', 'ところてん', ['しんた', 'しんぶと'], '夏の味覚、心太が人気です。', 2],
  ['時化', 'しけ', ['じか', 'ときばけ'], '時化のため漁を見合わせました。', 2],
  ['白湯', 'さゆ', ['はくとう', 'しろゆ'], '朝に白湯を飲む人が増えています。', 2],
  ['初陣', 'ういじん', ['しょじん', 'はつじん'], '新人選手が初陣を勝利で飾りました。', 2],
  ['煮沸', 'しゃふつ', ['にふつ', 'にわき'], '使う前に容器を煮沸しましょう。', 2],
  ['杞憂', 'きゆう', ['こゆう', 'きうれい'], '心配は杞憂に終わりました。', 2],
  ['発端', 'ほったん', ['はったん', 'はつたん'], '騒動の発端は一通の手紙でした。', 2],
  ['金字塔', 'きんじとう', ['きんじどう', 'かなじとう'], 'その作品は映画界の金字塔です。', 2],
  ['囃子', 'はやし', ['そうし', 'はやこ'], 'お囃子の音が町に響きました。', 2],
  // level 3
  ['漸次', 'ぜんじ', ['ざんじ', 'せんじ'], '新制度は漸次導入される予定です。', 3],
  ['一矢', 'いっし', ['いちや', 'ひとや'], '最終回に一矢を報いました。', 3],
  ['定款', 'ていかん', ['じょうかん', 'ていけん'], '会社の定款が変更されました。', 3],
  ['市井', 'しせい', ['いちい', 'しい'], '市井の人々の声をお伝えします。', 3],
  ['未曾有', 'みぞう', ['みぞうゆう', 'みそうゆう'], '未曾有の大雪となりました。', 3],
  ['恣意的', 'しいてき', ['じいてき', 'しきてき'], '恣意的な運用を防ぐ仕組みです。', 3],
  ['一入', 'ひとしお', ['いちにゅう', 'ひといり'], '優勝の喜びも一入です。', 3],
  ['杜撰', 'ずさん', ['とせん', 'もりせん'], '杜撰な管理が問題となりました。', 3],
  ['斡旋', 'あっせん', ['かんせん', 'ほせん'], '仕事の斡旋を行う窓口です。', 3],
  ['吹聴', 'ふいちょう', ['すいちょう', 'ふきちょう'], 'うわさを吹聴しないよう呼びかけました。', 3],
  ['行脚', 'あんぎゃ', ['ぎょうきゃく', 'こうきゃく'], '知事が県内各地を行脚しました。', 3],
  ['頒布', 'はんぷ', ['ぶんぷ', 'りょうふ'], '記念冊子が無料で頒布されます。', 3],
  ['婉曲', 'えんきょく', ['わんきょく', 'ぼうきょく'], '婉曲な表現で申し出を断りました。', 3],
  ['反故', 'ほご', ['はんこ', 'はんご'], '約束を反故にしないよう求めました。', 3],
  ['拘泥', 'こうでい', ['こうどろ', 'くでい'], '勝敗に拘泥しない姿勢が話題です。', 3],
  ['好事家', 'こうずか', ['こうしか', 'すきごとか'], '好事家に人気の古いカメラです。', 3],
  ['言質', 'げんち', ['げんしつ', 'ごんしつ'], '交渉で相手の言質は取れませんでした。', 3],
  ['蘊蓄', 'うんちく', ['おんちく', 'うんたく'], '店主が料理の蘊蓄を語りました。', 3],
].map(([word, reading, wrong, sentence, lv]) => ({ word, reading, wrong, sentence, lv }));

// ------------------------------------------------------------------ layout & tuning
const PROGRAM = 'ドットニュース';
const OPENING = 'こんばんは。ドットニュースです。';
const CLOSING = '以上、ドットニュースでした。';
const PR = { x: 4, y: 132, w: 312, h: 44 }; // prompter monitor
const MARK = 48;                          // the red reading line
const TEXT_Y = 154;
const RUBY_Y = 139;
const FS = 16;                            // prompter font size
const MAX_DIST = 196;                     // px between the word and the line when it appears
const BASE_T = [0, 330, 290, 250, 215, 185]; // frames until the word reaches the line
const FAST = 0.45;                        // answer with this much time left = full speed bonus
// sampling weight of word levels 1..3 per difficulty
const LV_W = [null, [0, 1, 0.15, 0], [0, 1, 0.6, 0.1], [0, 0.6, 1, 0.4], [0, 0.3, 1, 0.8], [0, 0.15, 0.8, 1]];
const MAIN = { x: 64, y: 42 };            // anchor (player), drawn 3x
const CO = { x: 228, y: 42 };             // co-anchor, drawn 3x
const DESK_Y = 82;
const OPT_Y = 186;                        // first option row
const OUT = '#22202a';

// ------------------------------------------------------------------ cached studio art
let ART = null;
function art() {
  if (!ART) ART = { bg: buildBg(), desk: buildDesk() };
  return ART;
}

function buildBg() {
  const [cv, c] = makeCanvas(W, 136);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(0, 0, W, 136, '#121a40');
  for (let x = 0; x < W; x += 16) R(x, 0, 1, 136, 'rgba(255,255,255,0.035)');
  // ceiling truss + lights
  R(0, 0, W, 7, '#070a1a');
  for (let x = 0; x < W; x += 8) { R(x, 2, 4, 1, '#2a2f48'); R(x + 4, 4, 4, 1, '#2a2f48'); }
  // video wall with a night skyline
  const vx = 12, vy = 10, vw = 296, vh = 72;
  R(vx - 3, vy - 3, vw + 6, vh + 6, '#2a3358');
  R(vx - 1, vy - 1, vw + 2, vh + 2, '#05070f');
  for (let y = 0; y < vh; y++) {
    const t = y / (vh - 1);
    R(vx, vy + y, vw, 1, t < 0.55 ? mix('#081038', '#26286a', t / 0.55) : mix('#26286a', '#7a4880', (t - 0.55) / 0.45));
  }
  for (let i = 0; i < 46; i++) {
    const sx = vx + Math.floor(hash2(i, 1, 7) * vw);
    const sy = vy + 2 + Math.floor(hash2(i, 2, 7) * vh * 0.45);
    R(sx, sy, 1, 1, hash2(i, 3, 7) > 0.7 ? '#ffffff' : '#7f8fd0');
  }
  // moon
  const mx = vx + 192, my = vy + 32;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    if (dx * dx + dy * dy <= 25) R(mx + dx, my + dy, 1, 1, (dx + 2) * (dx + 2) + (dy + 1) * (dy + 1) <= 14 ? '#fff6d0' : '#e8d9a0');
  }
  // far buildings
  let x = vx, i = 0;
  while (x < vx + vw) {
    const bw = 8 + Math.floor(hash2(i, 5, 3) * 12);
    const bh = 16 + Math.floor(hash2(i, 6, 3) * 22);
    R(x, vy + vh - bh, Math.min(bw, vx + vw - x), bh, '#2b2558');
    x += bw; i++;
  }
  // broadcast tower
  const tx = vx + 214, top = vy + 10, bot = vy + vh;
  for (let y = top; y < bot; y++) {
    const t = (y - top) / (bot - top);
    const hw = Math.round(1 + t * t * 9);
    R(tx - hw, y, hw * 2 + 1, 1, (y - top) % 4 === 2 ? '#4a3c84' : '#3d3070');
  }
  R(tx - 5, top + 20, 11, 3, '#55479a');
  R(tx - 3, top + 34, 7, 2, '#55479a');
  R(tx, top - 7, 1, 7, '#3d3070');
  // near buildings with lit windows
  x = vx; i = 0;
  while (x < vx + vw) {
    const bw = Math.min(10 + Math.floor(hash2(i, 8, 4) * 14), vx + vw - x);
    const bh = 8 + Math.floor(hash2(i, 9, 4) * 22);
    const by = vy + vh - bh;
    R(x, by, bw, bh, '#161838');
    R(x, by, bw, 1, '#272a62');
    for (let wy = by + 3; wy < vy + vh - 2; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
        const h = hash2(wx, wy, 11);
        if (h < 0.45) R(wx, wy, 2, 2, h < 0.1 ? '#9fd0ff' : '#ffd86a');
      }
    }
    x += bw + 1; i++;
  }
  // panel seams + scanlines
  for (let k = 1; k < 4; k++) R(vx + Math.round((vw * k) / 4), vy, 1, vh, 'rgba(0,0,0,0.35)');
  R(vx, vy + vh / 2, vw, 1, 'rgba(0,0,0,0.25)');
  for (let y = vy; y < vy + vh; y += 2) R(vx, y, vw, 1, 'rgba(0,0,0,0.08)');
  // side pillars with LED strips
  R(0, 7, 8, 121, '#1b2350'); R(312, 7, 8, 121, '#1b2350');
  R(4, 7, 1, 121, '#5fd7ff'); R(315, 7, 1, 121, '#5fd7ff');
  // floor
  R(0, 128, W, 8, '#0a0e22');
  return cv;
}

function buildDesk() {
  const [cv, c] = makeCanvas(W, 50);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  // top surface (screen y 84..90)
  for (let r = 0; r < 7; r++) R(16 - r, 2 + r, 288 + r * 2, 1, mix('#f4f7fc', '#b9c4da', r / 6));
  R(9, 9, 302, 2, '#7a86a6');
  // front panel
  for (let y = 11; y < 46; y++) R(10, y, 300, 1, mix('#2350a8', '#0e1f4a', (y - 11) / 35));
  R(10, 17, 300, 1, 'rgba(95,215,255,0.35)');
  R(10, 18, 300, 2, '#5fd7ff');
  R(10, 20, 300, 1, 'rgba(95,215,255,0.35)');
  R(10, 41, 300, 1, '#3a6fd8');
  for (let x = 58; x < 300; x += 48) R(x, 21, 1, 20, 'rgba(0,0,0,0.25)');
  R(8, 46, 304, 3, '#060914');
  // name plate (text drawn live)
  R(122, 23, 76, 15, '#9aa6c0');
  R(123, 24, 74, 13, '#eef2fa');
  // scripts on the desk
  R(72, 3, 24, 3, '#ffffff'); R(74, 6, 24, 1, '#d6dcea');
  R(234, 3, 22, 3, '#ffffff'); R(236, 6, 22, 1, '#d6dcea');
  return cv;
}

// ------------------------------------------------------------------ the game
class Announce extends Minigame {
  static title = '原稿読み';
  static howto = [
    '黄色い漢字の読みを3つから選ぼう！',
    '↑↓でえらんで Aで読む！',
    '赤い線に届く前に答えよう。',
    '早く答えるほど高得点！',
  ];
  static skill = 'talk';
  static bgm = 'studio';

  init() {
    this.mctx = makeCanvas(4, 4)[1];
    this.items = this.pickItems();
    this.count = this.items.length;
    this.T = Math.round(this.ease(BASE_T[this.difficulty], 0.4));
    this.idx = -1;
    this.score = 0;
    this.correct = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.cur = null;
    this.choices = [];
    this.sel = 1;
    this.answer = null;
    this.ok = false;
    this.rem = 1;
    this.bubble = null;
    this.coEmote = null;
    const look = (this.g.state && this.g.state.look) || LOOKS.player;
    this.mainLook = { ...look, jacket: true };
    this.coLook = LOOKS.announcer;
    this.setLine(OPENING, null);
    this.line.x = MARK + 4;
    this.stage = 'open';
    this.st = 0;
  }

  // ---------------------------------------------------------------- content
  pickItems() {
    const count = clamp(Math.round(this.opts.count ?? 5 + this.difficulty), 1, 40);
    const custom = [].concat(this.opts.words || []).map((w) => this.normalize(w)).filter(Boolean);
    let chosen = shuffle(custom, this.rng).slice(0, count);
    if (chosen.length < count) {
      const used = new Set(chosen.map((c) => c.word));
      const wt = LV_W[this.difficulty];
      const pool = BUILTIN.filter((b) => !used.has(b.word)).map((b) => {
        const w = wt[b.lv] || 0;
        return { b, k: w > 0 ? Math.pow(this.rng(), 1 / w) : this.rng() - 2 };
      });
      pool.sort((a, b) => b.k - a.k);
      const extra = pool.slice(0, count - chosen.length).map((p) => p.b);
      // gentle ramp: easier built-in words first
      extra.sort((a, b) => a.lv - b.lv);
      chosen = custom.length ? shuffle(chosen.concat(extra), this.rng) : extra;
    }
    return chosen;
  }

  normalize(x) {
    if (!x || !x.word || !x.reading) return null;
    const word = String(x.word);
    const reading = String(x.reading);
    let wrong = [...new Set([].concat(x.wrong || []).map(String))].filter((w) => w && w !== reading);
    if (wrong.length > 2) wrong = shuffle(wrong, this.rng).slice(0, 2);
    // not enough distractors: borrow readings of other words
    for (const b of shuffle(BUILTIN, this.rng)) {
      if (wrong.length >= 2) break;
      if (b.reading !== reading && !wrong.includes(b.reading)) wrong.push(b.reading);
    }
    const sentence = x.sentence && String(x.sentence).includes(word) ? String(x.sentence) : `次は「${word}」に関するニュースです。`;
    return { word, reading, wrong, sentence, lv: x.lv || 2 };
  }

  mw(s) {
    setFont(this.mctx, FS);
    return this.mctx.measureText(s).width;
  }

  setLine(sentence, item) {
    let pre = sentence, word = '', post = '';
    if (item) {
      const i = sentence.indexOf(item.word);
      pre = sentence.slice(0, i);
      word = item.word;
      post = sentence.slice(i + word.length);
    }
    const preW = this.mw(pre), wordW = this.mw(word), postW = this.mw(post);
    this.line = { pre, word, post, preW, wordW, w: preW + wordW + postW, x: 0 };
  }

  wordX() { return this.line.x + this.line.preW; }

  // ---------------------------------------------------------------- flow
  nextItem() {
    this.idx++;
    this.answer = null;
    this.ok = false;
    this.rem = 1;
    if (this.idx >= this.count) {
      this.setLine(CLOSING, null);
      this.line.x = MARK + 4;
      this.outroLen = Math.ceil((this.line.w + 6) / 3) + 60;
      this.g.sfx('chime');
      this.stage = 'outro';
      this.st = 0;
      return;
    }
    const it = (this.cur = this.items[this.idx]);
    this.setLine(it.sentence, it);
    const L = this.line;
    const fit = PR.x + PR.w - 8 - MARK - L.wordW; // keep the whole word on screen
    this.D = Math.max(Math.min(MAX_DIST, fit), L.preW + 10, 40);
    L.x = MARK + this.D - L.preW;
    this.v = this.D / this.T;
    this.choices = shuffle([it.reading, ...it.wrong.slice(0, 2)], this.rng);
    this.sel = Math.min(1, this.choices.length - 1);
    this.stage = 'ask';
    this.st = 0;
  }

  choose(i) {
    this.answer = i;
    this.ok = this.choices[i] === this.cur.reading;
    this.rem = clamp((this.wordX() - MARK) / this.D, 0, 1);
    if (this.ok) {
      const k = clamp(this.rem / FAST, 0, 1);
      const pts = (100 / this.count) * (0.7 + 0.3 * k);
      this.score += pts;
      this.correct++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.g.sfx('good');
      const px = clamp(this.wordX() + this.line.wordW / 2, 70, 250);
      this.popup(`${k >= 1 ? 'はやい！' : 'せいかい！'}+${Math.round(pts)}`, px, 116, COLORS.good, 12);
    } else {
      this.combo = 0;
      this.g.sfx('buzz');
    }
    this.vGo = Math.max(4, (this.wordX() - MARK) / 20);
    this.stage = 'go';
    this.st = 0;
  }

  timeout() {
    this.answer = -1;
    this.ok = false;
    this.rem = 0;
    this.combo = 0;
    this.line.x = MARK - this.line.preW;
    this.startKamu('え、えーと…');
  }

  stutter(r) {
    const s = Array.from(r);
    return `${s[0]}、${r}…！？`;
  }

  startKamu(str) {
    this.stage = 'kamu';
    this.st = 0;
    this.bubble = { str, color: '#c0202f', t: 0 };
    this.coEmote = { ch: '！', color: COLORS.bad, t: 0 };
    this.sfxKamu();
  }

  startFlow() {
    const L = this.line;
    this.vFlow = clamp((L.x + L.w - MARK) / 36, 3, 12);
    if (this.ok) {
      this.bubble = { str: this.cur.reading, color: '#1d7a3a', t: 0 };
      this.coEmote = { ch: '♪', color: COLORS.pink, t: 0 };
    } else {
      this.bubble = { str: '失礼しました！', color: OUT, t: 0 };
    }
    this.stage = 'flow';
    this.st = 0;
  }

  finish() {
    const c = this.correct, n = this.count;
    const r = c / n;
    let comment;
    if (c === n) comment = '全問正解！噛まずに読み切った！';
    else if (r >= 0.8) comment = `${c}/${n}問正解！安心して聞けるニュース！`;
    else if (r >= 0.6) comment = `${c}/${n}問正解。少し噛んだけど無事放送！`;
    else if (r >= 0.3) comment = `${c}/${n}問正解…原稿の下読みは大事！`;
    else comment = `${c}/${n}問正解…放送事故寸前！？`;
    this.end(Math.round(this.score), comment);
  }

  sfxKamu() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.01;
    audio.tone(560, t, 0.07, { wave: 'square', vol: 0.06, slideTo: 380 });
    audio.tone(560, t + 0.09, 0.07, { wave: 'square', vol: 0.06, slideTo: 380 });
    audio.tone(320, t + 0.2, 0.38, { wave: 'sawtooth', vol: 0.05, slideTo: 90 });
  }

  talking() {
    const L = this.line;
    if (!['open', 'ask', 'go', 'flow', 'outro'].includes(this.stage)) return false;
    return L.x < MARK && L.x + L.w > MARK;
  }

  blip() {
    if (this.pt % 6 === 0 && this.talking()) this.g.sfx('talk');
  }

  updatePlay(inp) {
    this.st++;
    if (this.pt === 1) this.g.sfx('chime');
    if (this.bubble) this.bubble.t++;
    if (this.coEmote) this.coEmote.t++;
    const L = this.line;
    switch (this.stage) {
      case 'open':
        if (this.st > 20) L.x -= 3;
        this.blip();
        if (L.x + L.w < MARK - 2) this.nextItem();
        break;
      case 'ask': {
        L.x -= this.v;
        this.blip();
        const n = this.choices.length;
        if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; this.g.sfx('cursor'); }
        if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; this.g.sfx('cursor'); }
        if (inp.pressed('a')) this.choose(this.sel);
        else if (this.wordX() <= MARK) this.timeout();
        break;
      }
      case 'go':
        L.x -= this.vGo;
        this.blip();
        if (this.wordX() <= MARK) {
          L.x = MARK - L.preW;
          if (this.ok) this.startFlow();
          else this.startKamu(this.stutter(this.choices[this.answer]));
        }
        break;
      case 'kamu':
        if (this.st >= 56) this.startFlow();
        break;
      case 'flow':
        L.x -= this.vFlow;
        this.blip();
        if (L.x + L.w < MARK - 2) { this.stage = 'gap'; this.st = 0; }
        break;
      case 'gap':
        L.x -= this.vFlow;
        if (this.st >= 18) this.nextItem();
        break;
      case 'outro':
        if (this.st > 10) L.x -= 3;
        this.blip();
        if (this.st >= this.outroLen) this.finish();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- drawing
  drawBackground(ctx) {
    const A = art();
    rect(ctx, 0, 0, W, H, '#0a0e22');
    ctx.drawImage(A.bg, 0, 0);
    ctx.drawImage(A.desk, 0, DESK_Y);
    ctx.fillStyle = 'rgba(6,9,20,0.55)';
    ctx.fillRect(0, 0, W, H);
  }

  drawPlay(ctx) {
    const A = art();
    rect(ctx, 0, 0, W, H, '#0a0e22');
    ctx.save();
    if (this.stage === 'kamu' && this.st < 18) {
      ctx.translate(Math.round((this.rng() - 0.5) * 6), Math.round((this.rng() - 0.5) * 4));
    }
    ctx.drawImage(A.bg, 0, 0);
    this.drawWall(ctx);
    this.drawAnchors(ctx);
    ctx.drawImage(A.desk, 0, DESK_Y);
    this.drawDeskLive(ctx);
    this.drawBubble(ctx);
    this.drawEmote(ctx);
    ctx.restore();
    if (this.stage === 'kamu' && this.st < 6) {
      ctx.fillStyle = 'rgba(255,40,60,0.18)';
      ctx.fillRect(0, 0, W, 132);
    }
    this.drawHud(ctx);
    this.drawPrompter(ctx);
    this.drawChoices(ctx);
    if (this.stage === 'kamu') this.drawKamu(ctx);
  }

  drawWall(ctx) {
    // program logo board
    rect(ctx, 110, 13, 100, 20, '#5fd7ff');
    rect(ctx, 111, 14, 98, 18, '#0a1030');
    rect(ctx, 111, 14, 98, 1, '#2a5a9a');
    text(ctx, PROGRAM, 160, 17, { size: 12, align: 'center', color: '#ffffff', outline: '#1d3f8a' });
    // tower beacon
    if (Math.floor(this.pt / 30) % 2 === 0) rect(ctx, 225, 12, 3, 2, '#ff4d5e');
  }

  drawAnchors(ctx) {
    const talking = this.talking();
    const kamu = this.stage === 'kamu';
    this.drawAnchor(ctx, this.mainLook, MAIN.x, MAIN.y, 'down', kamu ? 'panic' : talking ? 'talk' : this.stage === 'outro' && this.st > 40 ? 'smile' : 'idle');
    // co-anchor: turns to look when you bite, nods when you read well
    let dir = 'down', dy = 0, mood = 'idle';
    if (kamu) mood = 'surprise';
    else if (this.stage === 'flow' && this.ok && this.st < 24) { dy = Math.floor(this.st / 6) % 2 ? 2 : 0; mood = 'smile'; }
    else if (this.stage === 'outro' && this.st > 40) mood = 'smile';
    this.drawAnchor(ctx, this.coLook, CO.x, CO.y + dy, dir, mood);
  }

  drawAnchor(ctx, look, x, y, dir, mood) {
    const sheet = charSheet(look);
    ctx.drawImage(sheet[dir][0], 0, 0, 16, 16, x, y, 48, 48);
    if (dir !== 'down') return;
    const mouth = '#7a2a35';
    if (mood === 'panic') {
      const skin = SKIN[look.skin] || look.skin || SKIN.fair;
      rect(ctx, x + 12, y + 18, 24, 6, skin);
      rect(ctx, x + 12, y + 20, 9, 2, OUT);
      rect(ctx, x + 27, y + 20, 9, 2, OUT);
      rect(ctx, x + 9, y + 24, 6, 2, '#ff8a9a');
      rect(ctx, x + 33, y + 24, 6, 2, '#ff8a9a');
      for (let i = 0; i < 4; i++) rect(ctx, x + 17 + i * 4, y + 26 + (i % 2) * 2, 4, 2, mouth);
      // sweat drops
      const s = (this.st % 20) / 2;
      rect(ctx, x + 42, y + 6 + s, 3, 5, '#9fe0ff');
      rect(ctx, x + 43, y + 4 + s, 1, 2, '#9fe0ff');
      rect(ctx, x + 2, y + 12 + s * 0.6, 3, 4, '#9fe0ff');
    } else if (mood === 'talk') {
      if (Math.floor(this.pt / 5) % 2 === 0) rect(ctx, x + 21, y + 26, 6, 3, mouth);
      else rect(ctx, x + 21, y + 27, 6, 1, mouth);
    } else if (mood === 'surprise') {
      rect(ctx, x + 21, y + 25, 6, 4, mouth);
      rect(ctx, x + 42, y + 8, 3, 5, '#9fe0ff');
    } else if (mood === 'smile') {
      rect(ctx, x + 18, y + 26, 3, 1, mouth);
      rect(ctx, x + 21, y + 27, 6, 1, mouth);
      rect(ctx, x + 27, y + 26, 3, 1, mouth);
    }
  }

  drawDeskLive(ctx) {
    text(ctx, 'DOT NEWS', 160, DESK_Y + 25, { size: 10, align: 'center', color: '#1d3f8a', shadow: null });
    // desk microphones
    for (const mx of [MAIN.x + 40, CO.x + 4]) {
      rect(ctx, mx, DESK_Y - 6, 1, 9, '#20232a');
      rect(ctx, mx - 2, DESK_Y + 2, 5, 2, '#20232a');
      rect(ctx, mx - 1, DESK_Y - 10, 3, 5, '#3b3f48');
      rect(ctx, mx - 1, DESK_Y - 10, 1, 4, '#7a8090');
    }
  }

  drawBubble(ctx) {
    const b = this.bubble;
    if (!b || b.t > 80) return;
    let size = 12;
    while (size > 8 && measure(ctx, b.str, size) > 104) size -= 1;
    const w = Math.ceil(Math.min(measure(ctx, b.str, size), 104)) + 12;
    const x = 118, y = 52, h = 20;
    const pop = b.t < 4 ? 2 : 0;
    rect(ctx, x - 1, y - 1 - pop, w + 2, h + 2, OUT);
    rect(ctx, x, y - pop, w, h, '#ffffff');
    // tail toward the anchor's mouth
    rect(ctx, x - 4, y + 9 - pop, 5, 4, OUT);
    rect(ctx, x - 8, y + 12 - pop, 5, 3, OUT);
    rect(ctx, x - 3, y + 10 - pop, 4, 2, '#ffffff');
    rect(ctx, x - 7, y + 13 - pop, 4, 1, '#ffffff');
    text(ctx, b.str, x + w / 2, y + (h - size) / 2 - pop, { size, align: 'center', color: b.color, shadow: null });
  }

  drawEmote(ctx) {
    const e = this.coEmote;
    if (!e || e.t > 50) return;
    const x = CO.x + 30, y = CO.y - 14 - (e.t < 6 ? 6 - e.t : 0);
    rect(ctx, x - 1, y - 1, 16, 15, OUT);
    rect(ctx, x, y, 14, 13, '#ffffff');
    rect(ctx, x + 3, y + 13, 4, 2, OUT);
    rect(ctx, x + 4, y + 13, 2, 1, '#ffffff');
    text(ctx, e.ch, x + 7, y + 1, { size: 10, align: 'center', color: e.color, shadow: null });
  }

  drawHud(ctx) {
    panel(ctx, 4, 4, 82, 34);
    text(ctx, '得点', 11, 10, { size: 10, color: COLORS.dim });
    text(ctx, String(Math.round(this.score)), 79, 8, { size: 12, align: 'right', color: COLORS.accent });
    text(ctx, '原稿', 11, 23, { size: 10, color: COLORS.dim });
    const n = clamp(this.idx + 1, 0, this.count);
    text(ctx, `${n}/${this.count}`, 79, 23, { size: 10, align: 'right' });
    if (this.combo >= 2) {
      const bob = Math.floor(this.pt / 8) % 2;
      text(ctx, `${this.combo}れんぞく！`, 8, 42 + bob, { size: 10, color: COLORS.pink, outline: '#000' });
    }
    // ON AIR lamp
    const lit = 0.75 + 0.25 * Math.sin(this.pt / 12);
    rect(ctx, 248, 2, 68, 20, 'rgba(255,60,70,0.18)');
    rect(ctx, 250, 4, 64, 16, '#3a0a10');
    rect(ctx, 251, 5, 62, 14, mix('#8a1a24', '#ff2a3a', lit));
    rect(ctx, 252, 6, 60, 1, 'rgba(255,255,255,0.35)');
    text(ctx, 'ON AIR', 282, 7, { size: 10, align: 'center', color: '#ffffff', shadow: '#5a0a14' });
  }

  drawPrompter(ctx) {
    const { x: px, y: py, w: pw, h: ph } = PR;
    rect(ctx, px, py, pw, ph, '#2a2f45');
    rect(ctx, px + 1, py + 1, pw - 2, ph - 2, '#4a506c');
    rect(ctx, px + 3, py + 3, pw - 6, ph - 6, '#05070d');
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 3, py + 3, pw - 6, ph - 6);
    ctx.clip();
    for (let y = py + 3; y < py + ph - 3; y += 2) rect(ctx, px + 3, y, pw - 6, 1, 'rgba(255,255,255,0.025)');
    rect(ctx, px + 3, py + 3, MARK - px - 3, ph - 6, 'rgba(255,77,94,0.07)');
    const L = this.line;
    const tx = Math.round(L.x);
    const wx = tx + Math.round(L.preW);
    const answered = this.answer !== null;
    const rem = this.stage === 'ask' ? clamp((this.wordX() - MARK) / this.D, 0, 1) : this.rem;
    if (L.word) {
      let box = COLORS.accent;
      if (this.stage === 'ask') box = rem < 0.3 && Math.floor(this.pt / 5) % 2 ? '#ff9a3c' : COLORS.accent;
      else if (this.ok) box = COLORS.good;
      else if (answered) box = COLORS.bad;
      rect(ctx, wx - 2, TEXT_Y - 2, Math.round(L.wordW) + 4, FS + 4, box);
      if (this.stage === 'flow' && this.ok && this.st < 24) {
        for (let i = 0; i < 3; i++) {
          const a = this.st / 4 + i * 2.1;
          sparkle(ctx, wx + L.wordW / 2 + Math.cos(a) * (L.wordW / 2 + 6), TEXT_Y + 8 + Math.sin(a) * 12, 2, '#fff6a8');
        }
      }
    }
    const draw = (cPre, cWord, cPost) => {
      text(ctx, L.pre, tx, TEXT_Y, { size: FS, color: cPre, shadow: null });
      if (L.word) text(ctx, L.word, wx, TEXT_Y, { size: FS, color: cWord, shadow: null });
      text(ctx, L.post, wx + Math.round(L.wordW), TEXT_Y, { size: FS, color: cPost, shadow: null });
    };
    draw('#ffffff', '#1a1a2a', '#ffffff');
    // already-read part (left of the line) is dimmed
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 3, py + 3, MARK - px - 3, ph - 6);
    ctx.clip();
    rect(ctx, px + 3, TEXT_Y - 2, MARK - px - 3, FS + 4, 'rgba(5,7,13,0.55)');
    draw('#59607c', '#1a1a2a', '#59607c');
    ctx.restore();
    // furigana
    if (L.word) {
      let ruby = '？？？', col = COLORS.accent;
      if (this.stage === 'ask') { if (rem < 0.3 && Math.floor(this.pt / 5) % 2) col = '#ff9a3c'; }
      else if (this.ok) { ruby = this.cur.reading; col = COLORS.good; }
      else if (this.stage === 'go' || this.stage === 'kamu') {
        if (this.answer >= 0) ruby = this.choices[this.answer];
        col = COLORS.bad;
      } else { ruby = this.cur.reading; col = COLORS.pink; }
      text(ctx, ruby, wx + L.wordW / 2, RUBY_Y, { size: 10, align: 'center', color: col, shadow: null });
    }
    ctx.restore();
    // the reading line
    rect(ctx, MARK, py + 5, 1, ph - 10, '#ff4d5e');
    rect(ctx, MARK - 2, py + 3, 5, 1, '#ff4d5e');
    rect(ctx, MARK - 1, py + 4, 3, 1, '#ff4d5e');
    rect(ctx, MARK - 2, py + ph - 4, 5, 1, '#ff4d5e');
    rect(ctx, MARK - 1, py + ph - 5, 3, 1, '#ff4d5e');
  }

  drawChoices(ctx) {
    panel(ctx, 4, 180, 106, 58);
    panel(ctx, 114, 180, 202, 58);
    if (this.stage === 'open') {
      text(ctx, 'まもなく', 57, 190, { size: 10, align: 'center', color: COLORS.dim });
      text(ctx, '本番！', 57, 206, { size: 16, align: 'center', color: COLORS.accent });
      text(ctx, '黄色い漢字の読みを選ぼう', 124, 190, { size: 12 });
      text(ctx, '↑↓でえらんで Aで読む！', 124, 210, { size: 12, color: COLORS.cyan });
      return;
    }
    if (this.stage === 'outro') {
      text(ctx, '放送終了', 57, 190, { size: 10, align: 'center', color: COLORS.dim });
      text(ctx, 'おつかれ！', 57, 206, { size: 12, align: 'center', color: COLORS.accent });
      text(ctx, `正解 ${this.correct}/${this.count}`, 124, 190, { size: 12 });
      text(ctx, `最大 ${this.maxCombo} れんぞく`, 124, 210, { size: 12, color: COLORS.pink });
      return;
    }
    const it = this.cur;
    if (!it) return;
    // left: the word + time left
    text(ctx, '読みは？', 57, 186, { size: 10, align: 'center', color: COLORS.dim });
    let size = 20;
    while (size > 10 && measure(ctx, it.word, size) > 96) size -= 2;
    text(ctx, it.word, 57, 210 - size / 2, { size, align: 'center', color: COLORS.accent });
    const rem = this.stage === 'ask' ? clamp((this.wordX() - MARK) / this.D, 0, 1) : this.rem;
    bar(ctx, 12, 225, 90, 6, rem, rem > 0.3 ? COLORS.good : COLORS.bad);
    // right: the three readings
    const answered = this.answer !== null;
    for (let i = 0; i < this.choices.length; i++) {
      const y = OPT_Y + i * 16;
      const ch = this.choices[i];
      const isRight = ch === it.reading;
      let col = '#ffffff';
      if (!answered && i === this.sel) {
        rect(ctx, 120, y - 2, 190, 15, '#2a3a7a');
        drawCursor(ctx, 124, y + 2, this.pt);
        col = COLORS.accent;
      }
      if (answered) {
        if (isRight) { rect(ctx, 120, y - 2, 190, 15, '#1e5a34'); col = '#ffffff'; }
        else if (i === this.answer) { rect(ctx, 120, y - 2, 190, 15, '#6a1e2a'); col = '#ffd0d6'; }
        else col = '#6a7090';
      }
      let s = 12;
      while (s > 8 && measure(ctx, ch, s) > 150) s -= 1;
      text(ctx, ch, 136, y + (12 - s) / 2, { size: s, color: col });
      if (answered && isRight) text(ctx, '○', 300, y, { size: 12, align: 'center', color: COLORS.good });
      if (answered && i === this.answer && !isRight) text(ctx, '×', 300, y, { size: 12, align: 'center', color: COLORS.bad });
    }
  }

  drawKamu(ctx) {
    const t = this.st;
    const size = t < 6 ? 34 - t * 1.5 : 26;
    ctx.save();
    ctx.translate(160, 100);
    ctx.rotate(-0.1 + Math.sin(t / 4) * 0.03);
    text(ctx, '噛んだ！', 0, -size / 2, { size: Math.round(size), align: 'center', color: COLORS.bad, outline: '#ffffff' });
    ctx.restore();
    // impact lines
    if (t < 20) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, PR.y - 2);
      ctx.clip();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const r0 = 60 + t * 2, r1 = r0 + 10;
        for (let r = r0; r < r1; r += 2) rect(ctx, 160 + Math.cos(a) * r, 100 + Math.sin(a) * r * 0.45, 2, 2, '#ffffff');
      }
      ctx.restore();
    }
  }
}

registerMinigame('announce', Announce);
