// 原稿読み（アナウンサー） — minigame id 'announce' (skill: talk)
//
// The player reads a script on a fictional program (by default the evening news
// 「ドットニュース」). A sentence scrolls through the prompter toward the red reading line. One
// difficult word is highlighted; pick its correct reading (↑↓ + A) before the
// word reaches the line. Correct → smooth reading (faster answer = more points).
// Wrong answer / time up → 「噛んだ！」 (「NG！」 in the dubbing booth).
//
// opts:
//   words: [{ word, reading, wrong: ['…', '…'], sentence? }]   custom pool
//          (sentence must contain `word`; otherwise a template sentence is used.
//           If fewer words than `count` are given, built-in words fill the rest.)
//   count: number of words to read (default 5 + difficulty; with custom words: how many
//          were given, at least 4 and at most 5 + difficulty)
//   set:   'news'    (default) evening news desk 「ドットニュース」, night skyline, ON AIR
//          'morning' bright morning info show, sunny town on the video wall, ON AIR
//          'afureko' anime dubbing booth: anime on the screen, stand mics + script
//                    stands, no news desk, REC lamp, misreadings are 「NG！」
//   show:  program name on screen (alias: program). Defaults: news 'ドットニュース',
//          morning 'ドットモーニング', afureko 'ドット冒険記'
//   opening / closing: first / last line read on the prompter. Defaults per set,
//          e.g. news 'こんばんは。<show>です。' / '以上、<show>でした。',
//          morning 'おはようございます。まずは、今朝のニュースです。' / '今朝のニュースは以上です。'
//   partner: look of the co-host / co-star (default per set)
// With no set/show/opening/closing/partner the game is the original evening news.

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
  ['白湯', 'さゆ', ['しろゆ', 'はくゆ'], '朝に白湯を飲む人が増えています。', 2],
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
  ['言質', 'げんち', ['ごんち', 'ごんしつ'], '交渉で相手の言質は取れませんでした。', 3],
  ['蘊蓄', 'うんちく', ['おんちく', 'うんたく'], '店主が料理の蘊蓄を語りました。', 3],
].map(([word, reading, wrong, sentence, lv]) => ({ word, reading, wrong, sentence, lv }));

// ------------------------------------------------------------------ layout & tuning
const PR ={ x: 4, y: 132, w: 312, h: 44 }; // prompter monitor
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
// sentences for custom words given without one (X = the word, kept near the front)
const FALLBACK = ['次は「X」に関するニュースです。', '続いて「X」の話題をお伝えします。', '今日のキーワードは「X」です。'];

// ------------------------------------------------------------------ program sets (opts.set)
// comments: [all correct, >=80%, >=60%, >=30%, less] — `${c}/${n}問正解` is prefixed except for the first
const SETS = {
  news: {
    show: 'ドットニュース',
    opening: (s) => `こんばんは。${s}です。`,
    closing: (s) => `以上、${s}でした。`,
    partner: LOOKS.announcer,
    jacket: true,
    desk: 'DOT NEWS',
    lamp: 'ON AIR',
    kamu: '噛んだ！',
    sorry: '失礼しました！',
    over: '放送終了',
    fallback: FALLBACK,
    comments: ['全問正解！噛まずに読み切った！', '！安心して聞けるニュース！', '。少し噛んだけど無事放送！', '…原稿の下読みは大事！', '…放送事故寸前！？'],
  },
  morning: {
    show: 'ドットモーニング',
    // the news corner of the show (the show itself goes on after it)
    opening: () => 'おはようございます。まずは、今朝のニュースです。',
    closing: () => '今朝のニュースは以上です。',
    partner: { ...LOOKS.announcer, hair: 'long', hairColor: 'brown', top: '#ffb347', bottom: '#ffffff' },
    jacket: true,
    desk: 'GOOD MORNING',
    lamp: 'ON AIR',
    kamu: '噛んだ！',
    sorry: '失礼しました！',
    over: '放送終了',
    fallback: ['続いては「X」の話題です。', '今朝のキーワードは「X」です。', '次は「X」についてお伝えします。'],
    comments: ['全問正解！さわやかな朝をお届け！', '！朝から安心して聞ける！', '。少し噛んだけど無事放送！', '…原稿の下読みは大事！', '…放送事故寸前！？'],
  },
  afureko: {
    show: 'ドット冒険記',
    opening: () => '本番、よろしくお願いします！',
    closing: () => 'おつかれさまでした！',
    partner: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#2f6fd0', bottom: '#3b3f48' },
    jacket: false,
    desk: null,
    lamp: '● REC',
    kamu: 'NG！',
    sorry: 'すみません！',
    over: '収録終了',
    title: 'アフレコ',
    howto: ['台本の黄色い漢字の読みを3つから選ぼう！', '↑↓でえらんで Aで読む！', '赤い線に届く前に答えよう。', '読み間違えたらNG！'],
    fallback: ['「これが…X…！」', '「X――それが答えだ」', '「X、か…悪くない」'],
    comments: ['全問正解！すべて一発OKの名演技！', '！ほぼ一発OKの名演技！', '。リテイクもあったけど無事収録！', '…台本の下読みは大事！', '…リテイクの嵐！？'],
  },
};

// Largest font size in maxS..minS at which s fits maxW; still too wide -> cut with '…'.
function fitText(ctx, s, maxW, maxS, minS) {
  let size = maxS;
  while (size > minS && measure(ctx, s, size) > maxW) size -= 1;
  if (measure(ctx, s, size) > maxW) {
    const ch = Array.from(s);
    while (ch.length > 1 && measure(ctx, ch.join('') + '…', size) > maxW) ch.pop();
    s = ch.join('') + '…';
  }
  return { s, size };
}

// ------------------------------------------------------------------ cached studio art
const ART = {};
function art(set) {
  if (!ART[set]) {
    if (set === 'morning') ART[set] = { bg: buildMorningBg(), desk: buildMorningDesk() };
    else if (set === 'afureko') ART[set] = { bg: buildBoothBg(), desk: null };
    else ART[set] = { bg: buildBg(), desk: buildDesk() };
  }
  return ART[set];
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

// morning info show: bright studio, sunny town on the video wall
function buildMorningBg() {
  const [cv, c] = makeCanvas(W, 136);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(0, 0, W, 136, '#f3e6cf');
  for (let x = 0; x < W; x += 16) R(x, 0, 1, 136, 'rgba(120,80,30,0.06)');
  R(0, 0, W, 7, '#b9bfd0');
  for (let x = 0; x < W; x += 8) { R(x, 2, 4, 1, '#eef0f6'); R(x + 4, 4, 4, 1, '#eef0f6'); }
  const vx = 12, vy = 10, vw = 296, vh = 72;
  R(vx - 3, vy - 3, vw + 6, vh + 6, '#ffb347');
  R(vx - 1, vy - 1, vw + 2, vh + 2, '#ffffff');
  for (let y = 0; y < vh; y++) {
    const t = y / (vh - 1);
    R(vx, vy + y, vw, 1, t < 0.6 ? mix('#5fb4f0', '#bfe6fb', t / 0.6) : mix('#bfe6fb', '#fff0c0', (t - 0.6) / 0.4));
  }
  // morning sun with rays (right of the co-host)
  const sx = vx + 280, sy = vy + 30;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    for (let r = 11; r < 16; r++) R(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 1, 1, '#ffd86a');
  }
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
    const d = dx * dx + dy * dy;
    if (d <= 64 && sx + dx < vx + vw) R(sx + dx, sy + dy, 1, 1, d <= 30 ? '#fff6c8' : '#ffd23f');
  }
  // clouds
  const cloud = (x, y, w) => {
    R(x + 3, y, w - 6, 3, '#ffffff');
    R(x, y + 3, w, 4, '#ffffff');
    R(x + 1, y + 7, w - 2, 1, '#dcefff');
  };
  cloud(vx + 70, vy + 12, 22); cloud(vx + 118, vy + 30, 16); cloud(vx + 188, vy + 8, 26); cloud(vx + 22, vy + 40, 14);
  // far hills + town
  for (let x = vx; x < vx + vw; x++) {
    const h = 10 + Math.round(Math.sin((x - vx) / 23) * 4 + Math.sin((x - vx) / 9) * 2);
    R(x, vy + vh - 18 - h, 1, h, '#a8d8a0');
  }
  let x = vx, i = 0;
  const pastel = ['#ffffff', '#ffe6c8', '#d8e8ff', '#ffd6dc', '#e6f2d8'];
  while (x < vx + vw) {
    const bw = Math.min(10 + Math.floor(hash2(i, 8, 6) * 14), vx + vw - x);
    const bh = 10 + Math.floor(hash2(i, 9, 6) * 22);
    const by = vy + vh - bh;
    R(x, by, bw, bh, pastel[i % pastel.length]);
    R(x, by, bw, 1, '#c8b8a0');
    for (let wy = by + 3; wy < vy + vh - 4; wy += 4) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) R(wx, wy, 2, 2, hash2(wx, wy, 13) < 0.5 ? '#8ec8f0' : '#bcd8ec');
    }
    x += bw + 1; i++;
  }
  // street trees along the bottom
  for (let tx = vx + 4; tx < vx + vw - 6; tx += 22) {
    R(tx + 2, vy + vh - 4, 2, 4, '#7a5a3a');
    R(tx, vy + vh - 9, 6, 5, '#5fbf5a');
    R(tx + 1, vy + vh - 10, 4, 1, '#7fd77a');
  }
  for (let k = 1; k < 4; k++) R(vx + Math.round((vw * k) / 4), vy, 1, vh, 'rgba(255,255,255,0.35)');
  R(0, 7, 8, 121, '#ffffff'); R(312, 7, 8, 121, '#ffffff');
  R(4, 7, 1, 121, '#ffb347'); R(315, 7, 1, 121, '#ffb347');
  R(0, 128, W, 8, '#d8c6a4');
  return cv;
}

function buildMorningDesk() {
  const [cv, c] = makeCanvas(W, 50);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  for (let r = 0; r < 7; r++) R(16 - r, 2 + r, 288 + r * 2, 1, mix('#ffffff', '#e8dcc6', r / 6));
  R(9, 9, 302, 2, '#d0a870');
  for (let y = 11; y < 46; y++) R(10, y, 300, 1, mix('#ffb347', '#f0782a', (y - 11) / 35));
  R(10, 17, 300, 1, 'rgba(255,255,255,0.45)');
  R(10, 18, 300, 2, '#ffffff');
  R(10, 20, 300, 1, 'rgba(255,255,255,0.45)');
  R(10, 41, 300, 1, '#ffd23f');
  for (let x = 58; x < 300; x += 48) R(x, 21, 1, 20, 'rgba(120,40,0,0.18)');
  R(8, 46, 304, 3, '#7a3a14');
  R(122, 23, 76, 15, '#e0a060');
  R(123, 24, 74, 13, '#fffaf0');
  R(72, 3, 24, 3, '#ffffff'); R(74, 6, 24, 1, '#e0d6c4');
  R(234, 3, 22, 3, '#ffffff'); R(236, 6, 22, 1, '#e0d6c4');
  return cv;
}

// anime dubbing booth: acoustic panels, the anime on the big screen, carpet floor
const BOOTH_FLOOR = 92;
function buildBoothBg() {
  const [cv, c] = makeCanvas(W, 136);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(0, 0, W, 136, '#2a2633');
  for (let row = 0, y = 7; y < BOOTH_FLOOR; row++, y += 12) {
    for (let x = row % 2 ? -6 : 0; x < W; x += 12) {
      R(x, y, 11, 11, '#332e3e');
      R(x, y, 11, 1, '#433c52'); R(x, y, 1, 11, '#433c52');
      R(x, y + 10, 11, 1, '#1d1a24'); R(x + 10, y, 1, 11, '#1d1a24');
      R(x + 4, y + 4, 3, 3, '#2c2836');
    }
  }
  R(0, 0, W, 7, '#141218');
  for (const lx of [40, 120, 200, 280]) { R(lx - 4, 5, 9, 2, '#3a3646'); R(lx - 2, 7, 5, 1, '#fff2c0'); }
  // the screen with the anime scene
  const vx = 24, vy = 10, vw = 272, vh = 70;
  R(vx - 3, vy - 3, vw + 6, vh + 6, '#0c0b10');
  R(vx - 1, vy - 1, vw + 2, vh + 2, '#4a4858');
  for (let y = 0; y < vh; y++) {
    const t = y / (vh - 1);
    R(vx, vy + y, vw, 1, t < 0.5 ? mix('#26307a', '#c8508a', t / 0.5) : mix('#c8508a', '#ffc070', (t - 0.5) / 0.5));
  }
  // light burst behind the hero
  const cx = vx + vw / 2, cy = vy + 44;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    for (let r = 10; r < 130; r += 1) {
      const px = Math.round(cx + Math.cos(a) * r), py = Math.round(cy + Math.sin(a) * r * 0.6);
      if (px >= vx && px < vx + vw && py >= vy && py < vy + vh) R(px, py, 1, 1, 'rgba(255,240,200,0.35)');
    }
  }
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) {
    const d = dx * dx + dy * dy;
    if (d <= 81) R(cx + dx, cy + dy, 1, 1, d <= 25 ? '#ffffff' : 'rgba(255,246,200,0.7)');
  }
  // mountains
  for (let x = vx; x < vx + vw; x++) {
    const h = 14 + Math.round(Math.abs(Math.sin((x - vx) / 31)) * 14 + Math.sin((x - vx) / 7) * 2);
    R(x, vy + vh - h, 1, h, '#5a3a78');
    R(x, vy + vh - Math.max(4, h - 10), 1, Math.max(4, h - 10), '#3a2658');
  }
  // the hero on a rock (silhouette with a flowing scarf)
  const hx = cx, hy = vy + vh - 6;
  R(hx - 14, hy, 28, 6, '#1a1430'); R(hx - 10, hy - 2, 20, 2, '#1a1430');
  R(hx - 2, hy - 16, 5, 14, '#1a1430');   // body + legs
  R(hx - 3, hy - 21, 7, 6, '#1a1430');    // head
  R(hx - 2, hy - 23, 2, 2, '#1a1430'); R(hx + 2, hy - 24, 2, 3, '#1a1430'); // spiky hair
  R(hx + 3, hy - 14, 3, 2, '#d62f2f'); R(hx + 6, hy - 15, 4, 2, '#d62f2f'); R(hx + 10, hy - 17, 3, 2, '#d62f2f');
  R(hx - 5, hy - 13, 2, 6, '#1a1430');    // arm
  R(hx - 3, hy - 21, 1, 6, '#ffd890');    // rim light
  for (let y = vy; y < vy + vh; y += 2) R(vx, y, vw, 1, 'rgba(0,0,0,0.06)');
  // carpet floor
  R(0, BOOTH_FLOOR, W, 136 - BOOTH_FLOOR, '#3b3548');
  R(0, BOOTH_FLOOR, W, 2, '#17151c');
  for (let y = BOOTH_FLOOR + 4; y < 136; y += 4) {
    for (let x = (y / 4) % 2 ? 2 : 0; x < W; x += 4) R(x, y, 1, 1, '#443d52');
  }
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

  constructor(g, opts = {}) {
    super(g, opts);
    // per-set title card (callers' own title / howto win)
    const S = SETS[opts.set];
    if (S && S.title && !opts.title) this.title = S.title;
    if (S && S.howto && !opts.howto) this.opts = { ...opts, howto: S.howto };
  }

  init() {
    this.mctx = makeCanvas(4, 4)[1];
    this.set = SETS[this.opts.set] ? this.opts.set : 'news';
    const S = (this.S = SETS[this.set]);
    this.show = String(this.opts.show || this.opts.program || S.show);
    this.opening = String(this.opts.opening || S.opening(this.show));
    this.closing = String(this.opts.closing || S.closing(this.show));
    this.items = this.pickItems();
    this.count = this.items.length;
    this.T = Math.round(this.ease(BASE_T[this.difficulty], 0.35));
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
    this.mainLook = S.jacket ? { ...look, jacket: true } : { ...look };
    this.coLook = this.opts.partner && typeof this.opts.partner === 'object' ? { ...this.opts.partner } : S.partner;
    this.setLine(this.opening, null);
    this.line.x = MARK + 4;
    this.stage = 'open';
    this.st = 0;
  }

  // ---------------------------------------------------------------- content
  pickItems() {
    const custom = [].concat(this.opts.words || []).map((w) => this.normalize(w)).filter(Boolean);
    // custom words replace the built-in pool (like quiz's custom questions); built-ins only pad
    // a very short list or an explicit larger count
    const def = custom.length ? clamp(custom.length, 4, 5 + this.difficulty) : 5 + this.difficulty;
    const count = clamp(Math.round(this.opts.count ?? def), 1, 40);
    let chosen = shuffle(custom, this.rng).slice(0, count);
    if (chosen.length < count) {
      const used = new Set(chosen.map((c) => c.word));
      const wt = LV_W[this.difficulty];
      const pool = BUILTIN.filter((b) => !used.has(b.word)).map((b) => {
        const w = wt[b.lv] || 0;
        return { b, k: w > 0 ? Math.pow(this.rng(), 1 / w) : this.rng() - 2 };
      });
      pool.sort((a, b) => b.k - a.k);
      let extra = pool.slice(0, count - chosen.length).map((p) => p.b);
      // the built-in sentences are news copy; other sets read the word in their own template
      if (this.set === 'afureko') extra = extra.map((b) => this.normalize({ ...b, sentence: null }));
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
    const fb = (this.S || SETS.news).fallback;
    const tpl = fb[Math.floor(hash2(word.length, word.charCodeAt(0), 5) * fb.length)];
    const sentence = x.sentence && String(x.sentence).includes(word) ? String(x.sentence) : tpl.replace('X', () => word);
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
    this.bubble = null; // don't leave the previous reading on screen
    this.coEmote = null;
    this.answer = null;
    this.ok = false;
    this.rem = 1;
    if (this.idx >= this.count) {
      this.setLine(this.closing, null);
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
    // start the sentence just right of the line when possible, but never let the word
    // itself appear off the right edge (long custom sentences start partly read)
    const fit = PR.x + PR.w - 8 - MARK - L.wordW;
    this.D = Math.max(Math.min(Math.max(MAX_DIST, L.preW + 10), fit), 40);
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
      this.bubble = { str: this.S.sorry, color: OUT, t: 0 };
    }
    this.stage = 'flow';
    this.st = 0;
  }

  finish() {
    const c = this.correct, n = this.count;
    const r = c / n;
    const C = this.S.comments;
    const k = c === n ? 0 : r >= 0.8 ? 1 : r >= 0.6 ? 2 : r >= 0.3 ? 3 : 4;
    this.end(Math.round(this.score), k === 0 ? C[0] : `${c}/${n}問正解${C[k]}`);
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
  // set id usable before init() (the title card draws the background)
  get setId() { return SETS[this.opts.set] ? this.opts.set : 'news'; }

  drawBackground(ctx) {
    const A = art(this.setId);
    rect(ctx, 0, 0, W, H, '#0a0e22');
    ctx.drawImage(A.bg, 0, 0);
    if (A.desk) ctx.drawImage(A.desk, 0, DESK_Y);
    ctx.fillStyle = 'rgba(6,9,20,0.55)';
    ctx.fillRect(0, 0, W, H);
  }

  drawPlay(ctx) {
    const A = art(this.set);
    rect(ctx, 0, 0, W, H, '#0a0e22');
    ctx.save();
    if (this.stage === 'kamu' && this.st < 18) {
      ctx.translate(Math.round((hash2(this.st, 1, 9) - 0.5) * 6), Math.round((hash2(this.st, 2, 9) - 0.5) * 4));
    }
    ctx.drawImage(A.bg, 0, 0);
    this.drawWall(ctx);
    this.drawAnchors(ctx);
    if (A.desk) {
      ctx.drawImage(A.desk, 0, DESK_Y);
      this.drawDeskLive(ctx);
    } else this.drawBooth(ctx);
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
    if (this.set === 'afureko') {
      // the anime's title card on the screen
      const f = fitText(ctx, `『${this.show}』`, 150, 14, 8);
      text(ctx, f.s, 160, 14 + (14 - f.size) / 2, { size: f.size, align: 'center', color: '#fff6a8', outline: '#8a1f3a' });
      return;
    }
    // program logo board (grows a little for long names)
    const f = fitText(ctx, this.show, 136, 12, 8);
    const bw = clamp(Math.ceil(measure(ctx, f.s, f.size)) + 14, 100, 148);
    const bx = 160 - Math.round(bw / 2);
    const morning = this.set === 'morning';
    rect(ctx, bx, 13, bw, 20, morning ? '#ffd23f' : '#5fd7ff');
    rect(ctx, bx + 1, 14, bw - 2, 18, morning ? '#ff8a3d' : '#0a1030');
    rect(ctx, bx + 1, 14, bw - 2, 1, morning ? '#ffc070' : '#2a5a9a');
    text(ctx, f.s, 160, 17 + (12 - f.size) / 2, { size: f.size, align: 'center', color: '#ffffff', outline: morning ? '#b8401a' : '#1d3f8a' });
    if (morning) {
      // studio clock in the corner of the video wall
      const mm = String(clamp(15 + Math.floor(this.pt / 600), 15, 59)).padStart(2, '0');
      rect(ctx, 14, 70, 34, 11, 'rgba(255,255,255,0.85)');
      text(ctx, `7:${mm}`, 31, 71, { size: 10, align: 'center', color: '#e0603a', shadow: null });
    } else if (bx + bw < 222 && Math.floor(this.pt / 30) % 2 === 0) {
      // tower beacon
      rect(ctx, 225, 12, 3, 2, '#ff4d5e');
    }
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
    // behind a desk only the top 16 rows show; in the booth they stand full-length
    const rows = this.set === 'afureko' ? 20 : 16;
    ctx.drawImage(sheet[dir][0], 0, 0, 16, rows, x, y, 48, rows * 3);
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
    text(ctx, this.S.desk, 160, DESK_Y + 25, { size: 10, align: 'center', color: this.set === 'morning' ? '#e0603a' : '#1d3f8a', shadow: null });
    // desk microphones
    for (const mx of [MAIN.x + 40, CO.x + 4]) {
      rect(ctx, mx, DESK_Y - 6, 1, 9, '#20232a');
      rect(ctx, mx - 2, DESK_Y + 2, 5, 2, '#20232a');
      rect(ctx, mx - 1, DESK_Y - 10, 3, 5, '#3b3f48');
      rect(ctx, mx - 1, DESK_Y - 10, 1, 4, '#7a8090');
    }
  }

  // dubbing booth foreground: a script stand in front of each actor and a stand mic beside the face
  drawBooth(ctx) {
    const floor = BOOTH_FLOOR + 22;
    for (const [ax, side] of [[MAIN.x, 1], [CO.x, -1]]) {
      const cx = ax + 24;
      rect(ctx, cx - 1, 82, 2, floor - 82, '#16151b');
      rect(ctx, cx - 8, floor - 1, 16, 2, '#16151b');
      rect(ctx, cx - 16, 72, 32, 11, '#2b2a33');
      rect(ctx, cx - 15, 73, 14, 8, '#f6f3e6');
      rect(ctx, cx + 1, 73, 14, 8, '#ebe6d4');
      for (let ly = 75; ly < 80; ly += 2) { rect(ctx, cx - 13, ly, 10, 1, '#b8b4a8'); rect(ctx, cx + 3, ly, 10, 1, '#b8b4a8'); }
      rect(ctx, cx - 16, 82, 32, 1, '#111016');
      const mx = side > 0 ? ax + 46 : ax + 1;
      rect(ctx, mx, 70, 1, floor - 70, '#20232a');
      rect(ctx, mx - 4, floor - 1, 9, 2, '#20232a');
      rect(ctx, mx - 1, 58, 3, 12, '#3b3f48');
      rect(ctx, mx - 1, 58, 1, 11, '#7a8090');
      rect(ctx, mx - 2, 68, 5, 2, '#20232a');
    }
  }

  drawBubble(ctx) {
    const b = this.bubble;
    if (!b || b.t > 80) return;
    const { s: str, size } = fitText(ctx, b.str, 104, 12, 8);
    const w = Math.ceil(Math.min(measure(ctx, str, size), 104)) + 12;
    const x = 118, y = 52, h = 20;
    const pop = b.t < 4 ? 2 : 0;
    rect(ctx, x - 1, y - 1 - pop, w + 2, h + 2, OUT);
    rect(ctx, x, y - pop, w, h, '#ffffff');
    // tail toward the anchor's mouth
    rect(ctx, x - 4, y + 9 - pop, 5, 4, OUT);
    rect(ctx, x - 8, y + 12 - pop, 5, 3, OUT);
    rect(ctx, x - 3, y + 10 - pop, 4, 2, '#ffffff');
    rect(ctx, x - 7, y + 13 - pop, 4, 1, '#ffffff');
    text(ctx, str, x + w / 2, y + (h - size) / 2 - pop, { size, align: 'center', color: b.color, shadow: null });
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
    text(ctx, this.S.lamp, 282, 7, { size: 10, align: 'center', color: '#ffffff', shadow: '#5a0a14' });
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
      text(ctx, this.S.over, 57, 190, { size: 10, align: 'center', color: COLORS.dim });
      text(ctx, 'おつかれ！', 57, 206, { size: 12, align: 'center', color: COLORS.accent });
      text(ctx, `正解 ${this.correct}/${this.count}`, 124, 190, { size: 12 });
      text(ctx, `最大 ${this.maxCombo} れんぞく`, 124, 210, { size: 12, color: COLORS.pink });
      return;
    }
    const it = this.cur;
    if (!it) return;
    // left: the word + time left
    text(ctx, '読みは？', 57, 186, { size: 10, align: 'center', color: COLORS.dim });
    const wf = fitText(ctx, it.word, 94, 20, 8);
    text(ctx, wf.s, 57, 210 - wf.size / 2, { size: wf.size, align: 'center', color: COLORS.accent });
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
      const f = fitText(ctx, ch, 154, 12, 8);
      text(ctx, f.s, 136, y + (12 - f.size) / 2, { size: f.size, color: col });
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
    text(ctx, this.S.kamu, 0, -size / 2, { size: Math.round(size), align: 'center', color: COLORS.bad, outline: '#ffffff' });
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
