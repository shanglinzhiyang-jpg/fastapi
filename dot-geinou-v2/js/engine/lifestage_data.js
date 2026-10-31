// ライフステージ (R30) — data shared by lifestage.js (the player's own stages), lifestage_kids.js (親キャリア: the children's
// stages), lifestage_origin.js (生い立ち: the player's childhood, played turn by turn) and life_screen.js (the 生活 screen).
// Everything here is plain data + small pure helpers (no game state). Amounts of money are internal yen (the era's
// priceRate scales what is shown), sized to the game's compressed week (ドット荘 is ¥8,000 a week), not to real salaries.

// ---------------------------------------------------------------- the six life stats (0..100)
// name: what a child / student sees; adult: the word once you work (the same number).
export const STATS = {
  gaku: { name: '学力', adult: '知識', color: '#3a7bd5', desc: '勉強・知識。成績、受験、就職、仕事の評価に効く' },
  tai: { name: '体力', adult: '体力', color: '#e0574a', desc: '運動・体の強さ。部活、運動会、きつい仕事に効く' },
  kan: { name: '感性', adult: '感性', color: '#b558cf', desc: '芸術・表現。音楽、美術、文化祭、芸能の仕事に効く' },
  yu: { name: '友情', adult: '人望', color: '#ef9a2b', desc: '友だち・人づきあい。学校生活、チームの仕事に効く' },
  sei: { name: '生活力', adult: '生活力', color: '#38a46a', desc: '家事・お金・段取り。一人暮らし、家計、子育てに効く' },
  ken: { name: '健康', adult: '健康', color: '#22a4b5', desc: '体の調子。下がると疲れやすくなる（中年から大事）' },
};
export const STAT_ORDER = ['gaku', 'tai', 'kan', 'yu', 'sei', 'ken'];

// ---------------------------------------------------------------- stages
export const STAGES = {
  baby: { name: '赤ちゃん・幼児', short: '幼児', ages: '0〜5歳', color: '#f08cb0', icon: 'baby' },
  elem: { name: '小学生', short: '小学生', ages: '6〜11歳', color: '#f2a33a', icon: 'randoseru' },
  mid: { name: '中学生', short: '中学生', ages: '12〜14歳', color: '#3fa6d8', icon: 'gakuran' },
  high: { name: '高校生', short: '高校生', ages: '15〜17歳', color: '#4a72d8', icon: 'book' },
  uni: { name: '大学生', short: '大学生', ages: '18〜21歳', color: '#7a5bd0', icon: 'cap' },
  work: { name: '社会人', short: '社会人', ages: '18〜39歳', color: '#2f9a6a', icon: 'bag' },
  middle: { name: '中年', short: '中年', ages: '40〜64歳', color: '#c0763a', icon: 'tea' },
  senior: { name: 'シニア', short: 'シニア', ages: '65歳〜', color: '#8a6ac0', icon: 'cane' },
};
export const STAGE_ORDER = ['baby', 'elem', 'mid', 'high', 'uni', 'work', 'middle', 'senior'];
export const kidStageOf = (age) => (age < 6 ? 'baby' : age < 12 ? 'elem' : age < 15 ? 'mid' : age < 18 ? 'high' : 'adult');

// ---------------------------------------------------------------- high schools (the player's, from 生い立ち or chosen)
// days: school days a week (通信制 goes 2 days); req: the attendance a term needs before the teacher worries.
export const HIGH_TYPES = {
  futsu: { name: '普通科', days: 5, req: 0.75, gain: 1, desc: 'ふつうの全日制の高校。授業・部活・行事、いろいろ。' },
  shingaku: { name: '進学校', days: 5, req: 0.8, gain: 1.25, desc: '勉強に力を入れる学校。学力が伸びやすいが、テストがきびしい。' },
  jitsugyo: { name: '商業・工業科', days: 5, req: 0.75, gain: 1, sei: 1, desc: '資格や実習の多い学校。生活力が伸び、就職に強い。' },
  geino: { name: '芸能コース（通信制）', days: 2, req: 0.6, gain: 0.85, desc: 'レポートとスクーリングで単位をとる。芸能の仕事と両立しやすい。' },
};

// ---------------------------------------------------------------- clubs (中学・高校) and circles (大学)
// g: stat gains of one practice; skill: a game skill that sometimes goes up (+1) — 演劇部 grows 演技, and so on.
export const CLUBS = {
  soccer: { name: 'サッカー部', g: { tai: 2, yu: 1 }, sport: true },
  yakyu: { name: '野球部', g: { tai: 2, yu: 1 }, sport: true },
  basket: { name: 'バスケットボール部', g: { tai: 2, yu: 1 }, sport: true },
  rikujo: { name: '陸上部', g: { tai: 3 }, sport: true },
  tennis: { name: 'テニス部', g: { tai: 2, yu: 1 }, sport: true },
  suisou: { name: '吹奏楽部', g: { kan: 2, yu: 1 }, skill: 'uta' },
  engeki: { name: '演劇部', g: { kan: 2, yu: 1 }, skill: 'engi' },
  keion: { name: '軽音楽部', g: { kan: 2, yu: 1 }, skill: 'uta' },
  bijutsu: { name: '美術部', g: { kan: 3 } },
  housou: { name: '放送部', g: { kan: 1, gaku: 1 }, skill: 'talk' },
  kitaku: { name: '帰宅部', g: {}, none: true },
};
export const CLUB_ORDER = ['soccer', 'yakyu', 'basket', 'rikujo', 'tennis', 'suisou', 'engeki', 'keion', 'bijutsu', 'housou', 'kitaku'];
export const CIRCLES = {
  tennis: { name: 'テニスサークル', g: { tai: 1, yu: 2 } },
  owarai: { name: 'お笑いサークル', g: { kan: 1, yu: 1 }, skill: 'warai' },
  eiken: { name: '映画研究会', g: { kan: 2 }, skill: 'engi' },
  band: { name: '軽音サークル', g: { kan: 2 }, skill: 'uta' },
  volunteer: { name: 'ボランティアサークル', g: { yu: 1, sei: 1 } },
  jikkou: { name: '学園祭実行委員会', g: { yu: 2 }, skill: 'talk' },
  none: { name: '入らない', g: {}, none: true },
};
export const CIRCLE_ORDER = ['tennis', 'owarai', 'eiken', 'band', 'volunteer', 'jikkou', 'none'];

// ---------------------------------------------------------------- 習いごと (the children's; also in 生い立ち)
// fee: a week. from: the first year it is common as a children's lesson.
export const LESSONS = {
  piano: { name: 'ピアノ', g: { kan: 2 }, fee: 2500, show: 'ピアノの発表会' },
  swim: { name: 'スイミング', g: { tai: 1, ken: 1 }, fee: 2200, show: 'スイミングの進級テスト' },
  soroban: { name: 'そろばん', g: { gaku: 2 }, fee: 1800, show: 'そろばんの検定' },
  shuji: { name: '習字', g: { kan: 1, gaku: 1 }, fee: 1800, show: '書き初め展' },
  soccer: { name: 'サッカークラブ', g: { tai: 1, yu: 1 }, fee: 2200, show: 'サッカーの大会' },
  eikaiwa: { name: '英会話', g: { gaku: 1, kan: 1 }, fee: 3200, show: '英語のスピーチ発表' },
  ballet: { name: 'バレエ', g: { kan: 1, tai: 1 }, fee: 3500, show: 'バレエの発表会' },
  karate: { name: '空手', g: { tai: 2 }, fee: 2000, show: '空手の昇級審査' },
  dance: { name: 'ダンス', g: { tai: 1, kan: 1 }, fee: 2800, show: 'ダンスの発表会', from: 2000 },
  program: { name: 'プログラミング教室', g: { gaku: 2 }, fee: 3500, show: '作品の発表会', from: 2016 },
};
export const LESSON_ORDER = ['piano', 'swim', 'soroban', 'shuji', 'soccer', 'eikaiwa', 'ballet', 'karate', 'dance', 'program'];
export const lessonsFor = (year) => LESSON_ORDER.filter((id) => !LESSONS[id].from || year >= LESSONS[id].from);

// ---------------------------------------------------------------- work: industries and the company ladder
// pay: × the rank's weekly salary; hours: minutes of a work day; strain: × stress of a day's work; from: first year.
export const INDUSTRIES = {
  koumu: { name: '公務員（市役所）', pay: 0.95, hours: 480, strain: 0.8, stat: 'sei', desc: '安定して休みもとりやすい。昇進はゆっくり。' },
  maker: { name: 'メーカー', pay: 1, hours: 510, strain: 1, stat: 'gaku', desc: 'ものづくりの会社。ふつうの勤め先。' },
  shosha: { name: '商社', pay: 1.3, hours: 570, strain: 1.3, stat: 'yu', desc: '給料は高いが、忙しく付き合いも多い。' },
  bank: { name: '銀行', pay: 1.15, hours: 540, strain: 1.2, stat: 'gaku', desc: 'お金を扱うかたい仕事。転勤が多い。' },
  it: { name: 'IT企業', pay: 1.1, hours: 540, strain: 1.1, stat: 'gaku', from: 1995, desc: '新しい業界。働き方が自由なところも。' },
  koukoku: { name: '広告・出版', pay: 1.05, hours: 570, strain: 1.2, stat: 'kan', desc: 'アイデア勝負の仕事。芸能界ともつながりがある。' },
};
export const INDUSTRY_ORDER = ['koumu', 'maker', 'shosha', 'bank', 'it', 'koukoku'];
export const industriesFor = (year) => INDUSTRY_ORDER.filter((id) => !INDUSTRIES[id].from || year >= INDUSTRIES[id].from);
// need: evaluation points for the next step (earned at the yearly 査定); pay: a week before the industry factor
export const CO_RANKS = [
  { id: 'shinjin', name: '新入社員', pay: 30000, need: 0 },
  { id: 'ippan', name: '一般社員', pay: 36000, need: 6 },
  { id: 'shunin', name: '主任', pay: 44000, need: 14 },
  { id: 'kakari', name: '係長', pay: 54000, need: 24 },
  { id: 'kacho', name: '課長', pay: 68000, need: 36 },
  { id: 'jicho', name: '次長', pay: 80000, need: 50 },
  { id: 'bucho', name: '部長', pay: 96000, need: 66 },
  { id: 'honbu', name: '本部長', pay: 118000, need: 86 },
  { id: 'yakuin', name: '役員', pay: 150000, need: 110 },
];
export const PART_TIME = { high: { name: 'アルバイト', pay: 3000, min: 240 }, uni: { name: 'アルバイト', pay: 4200, min: 300 }, work: { name: 'アルバイト（シフト）', pay: 5200, min: 360 } };

// ---------------------------------------------------------------- 親キャリア
export const PARENT_RANKS = [[0, '新米'], [30, 'かけだし'], [90, 'すっかり慣れた'], [200, '頼れる'], [380, '子育て名人']];
export const parentWord = (gender) => (gender === 'm' ? 'パパ' : gender === 'f' ? 'ママ' : '親');
export function parentRank(pts, gender) {
  let i = 0;
  PARENT_RANKS.forEach(([min], k) => { if (pts >= min) i = k; });
  const next = PARENT_RANKS[i + 1] || null;
  const r = PARENT_RANKS[i][1];
  const name = gender === 'm' || gender === 'f' ? `${r}${parentWord(gender)}` : i === 4 ? r : i <= 1 ? `${r}の親` : `${r}親`;
  return { i, name, next: next ? next[0] : null, min: PARENT_RANKS[i][0] };
}
// weekly costs of raising a child (internal yen)
export const KID_FEES = { hoiku: 3500, juku: 4800, uniSemester: 52000 };

// ---------------------------------------------------------------- the calendar of school and work (game months: 10 days each)
// term of a month: 1 (4-7), 2 (9-12), 3 (1-3); 0 = 夏休み (8).
export const termOf = (month) => (month >= 4 && month <= 7 ? 1 : month >= 9 && month <= 12 ? 2 : month <= 3 ? 3 : 0);
export const schoolYearOf = (d) => (d.month >= 4 ? d.year : d.year - 1);
// Saturdays: classes until 1992, every other Saturday off 1992-2001 (月1回 then 月2回), all off from 2002 (学校週5日制).
export function saturdayClass(year, week) {
  if (year >= 2002) return false;
  if (year >= 1995) return week % 2 === 1;
  if (year >= 1992) return week % 4 !== 2;
  return true;
}
// the national university entrance test of a year
export function entranceTest(year) {
  if (year >= 2021) return '大学入学共通テスト';
  if (year >= 1990) return '大学入試センター試験';
  if (year >= 1979) return '共通一次試験';
  return '大学の入学試験';
}
// the job market for new graduates (a multiplier on the chance of an offer) and its name
export function jobMarket(year) {
  if (year >= 1987 && year <= 1991) return { k: 1.4, name: 'バブル景気の売り手市場' };
  if (year >= 1993 && year <= 2005) return { k: 0.62, name: '就職氷河期' };
  if (year >= 2009 && year <= 2013) return { k: 0.8, name: '不況で採用がしぼられた時期' };
  if (year >= 2014 && year <= 2019) return { k: 1.2, name: '人手不足の売り手市場' };
  if (year >= 2020 && year <= 2021) return { k: 0.9, name: '感染症の影響で採用が慎重な時期' };
  return { k: 1, name: 'ふつうの就職状況' };
}
// how 就活 runs in a year: start (grade, month) of the information sessions, and the month offers come
export function shukatsuRule(year) {
  if (year <= 1996) return { start: [4, 6], offer: [4, 10], text: '就職協定の時代。4年生の夏から会社訪問、秋に内定。' };
  if (year <= 2015) return { start: [3, 10], offer: [4, 5], text: '3年生の秋からエントリー。4年生の春に面接、内定。' };
  return { start: [3, 3], offer: [4, 7], text: '3年生の3月に説明会が解禁、4年生の6月から選考。' };
}
// ---------------------------------------------------------------- 定年・年金・長寿のお祝い (R31)
// the company retirement age of a year (55 → 60: 努力義務 1986, 義務 1998) and how long a company may keep you on after it
// (継続雇用: phased in from 2006, for everyone who asks up to 65 from 2013, an effort to 70 from 2021)
export const teinenAge = (year) => (year < 1986 ? 55 : 60);
export const rehireUntil = (year) => (year >= 2021 ? 70 : year >= 2006 ? 65 : 0);
// the public pension begins at (厚生年金: 60 until 2000, then raised step by step to 65; simplified here)
export const pensionAge = (year) => (year <= 2000 ? 60 : 65);
// a week's pension (internal yen): the 国民年金 base and the 厚生年金 part by the years at a company
export const pensionWeek = (coYears) => 5500 + Math.min(12000, Math.round(coYears * 340));
export const CHOJU = { 60: ['還暦', '家族が、赤いちゃんちゃんこを用意してくれた。照れくさいけれど、うれしい。'], 70: ['古希', '「古来まれなり」の70歳。家族がお祝いの食事会を開いてくれた。'], 77: ['喜寿', '喜寿のお祝い。紫のちゃんちゃんこを着て、写真を撮った。'], 80: ['傘寿', '傘寿。ここまでの道のりを、ゆっくり思い返した。'], 88: ['米寿', '米寿のお祝い。金色のちゃんちゃんこに、みんなが拍手してくれた。'], 90: ['卒寿', '卒寿。まだまだ、毎日が新しい。'], 99: ['白寿', '白寿。「百まで、あと一歩だね」と笑いあった。'] };
export const HOBBIES = {
  igo: { name: '囲碁・将棋', g: { gaku: 1, yu: 1 } },
  bonsai: { name: '盆栽', g: { kan: 1, sei: 1 } },
  haiku: { name: '俳句', g: { kan: 2 } },
  dance: { name: '社交ダンス', g: { tai: 1, yu: 1 } },
  tougei: { name: '陶芸', g: { kan: 1, sei: 1 } },
  karaoke: { name: 'カラオケ教室', g: { kan: 1, yu: 1 } },
};
export const HOBBY_ORDER = ['igo', 'bonsai', 'haiku', 'dance', 'tougei', 'karaoke'];
export const GRAND_NAMES = { m: ['湊', '蓮', '陽翔', '律', '蒼', '暖'], f: ['陽葵', '凛', '紬', '澪', '結菜', '芽依'] };

// a tidy little scale of school marks from a 0..100 score
export const mark5 = (v) => (v >= 82 ? 5 : v >= 64 ? 4 : v >= 44 ? 3 : v >= 26 ? 2 : 1);
export const SUBJECTS = [
  ['国語', { gaku: 0.7, kan: 0.3 }], ['数学', { gaku: 1 }], ['英語', { gaku: 0.8, kan: 0.2 }], ['理科', { gaku: 0.9, sei: 0.1 }],
  ['社会', { gaku: 0.8, yu: 0.2 }], ['体育', { tai: 0.85, yu: 0.15 }], ['芸術', { kan: 1 }],
];
export const ELEM_SUBJECTS = [['こくご', { gaku: 0.7, kan: 0.3 }], ['さんすう', { gaku: 1 }], ['りか', { gaku: 0.9, sei: 0.1 }], ['しゃかい', { gaku: 0.8, yu: 0.2 }], ['たいいく', { tai: 1 }], ['おんがく', { kan: 1 }], ['ずこう', { kan: 0.8, sei: 0.2 }]];
// the teacher's line on a report card (by the strongest and the weakest stat)
export const TEACHER = {
  gaku: '授業への集中力があります。調べ学習もていねいでした。',
  tai: '体育や行事で、いつも元気に活躍しました。',
  kan: '表現することが得意で、作品にあなたらしさが光ります。',
  yu: '友だちを大切にし、クラスのまとめ役になってくれました。',
  sei: '係の仕事をきちんとやりとげ、まわりから頼りにされています。',
  ken: '休まず元気に過ごせました。',
};
export const TEACHER_WEAK = {
  gaku: '家での復習の時間を、少しずつ増やしていきましょう。',
  tai: '体を動かす時間を、もう少しとれるといいですね。',
  kan: '好きなことを見つけて、のびのび表現してみましょう。',
  yu: '自分から声をかけると、もっと友だちの輪が広がります。',
  sei: '身の回りの整理整頓を、心がけていきましょう。',
  ken: '早寝早起きで、体調を整えていきましょう。',
};

// ---------------------------------------------------------------- the play of a childhood in the year it happened (no brand names)
export function childPlay(year) {
  if (year >= 2012) return ['スマホのゲーム', '動画サイトのまね', 'カードゲーム'];
  if (year >= 2004) return ['携帯ゲーム機の通信対戦', 'カードゲーム', 'ベーゴマ風のおもちゃ'];
  if (year >= 1996) return ['育てるゲームのおもちゃ', 'ミニカーのレース', '携帯ゲーム機'];
  if (year >= 1983) return ['テレビゲーム', 'シール集め', 'ラジコン'];
  return ['ゴム跳び', 'ベーゴマ', 'メンコ'];
}
