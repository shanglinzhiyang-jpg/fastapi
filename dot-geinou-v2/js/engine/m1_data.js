// M-1グランプリ — the facts by year, the fictional people of this game's world, name / catch-copy / news generators.
// Pure data + pure functions (no DOM, no game state): contest_m1.js and the other m1_*.js files build on it.
//
// FACTS (checked with web searches, 2026-10; ja.wikipedia / m-1gp.com could not be fetched from this session, so news
// sites were used — sources per item):
//  - 第1回 2001年 → 第10回 2010年; 2011–2014 not held (THE MANZAI ran in those years); revived 2015 as 第11回;
//    2024 = 第20回 (oricon 2024), 2025 = 第21回, 2026 = 第22回.                     [oricon.co.jp/news/2360487, allabout 34962]
//  - 出場資格: 第1・2回「結成10年未満」, 第3〜10回「結成10年以内」, 第11回〜「結成15年以内」(2025: 2010年1月1日以降の結成);
//    2人以上、プロ・アマ・所属事務所の有無を問わない.                               [all-senmonka moneyizm 79128, oricon 2392127]
//    2001: a combo formed for the contest counted as 結成1年目 (即席コンビ reached the 準決勝).  [allabout 34962]
//  - エントリーフィー: 2019・2020 は「1組2,000円」(compe.japandesign m-1gp-2019 / -2020); 2025 から「1人1,000円」
//    (oricon 2392127). Earlier years: NOT verified — this game assumes 1組2,000円 (said so in the code below).
//  - シード: 2020 の要項「過去大会で準決勝進出者は1回戦免除」(compe.japandesign m-1gp-2020) — applied from 2020.
//  - ネタ時間 (2019, 2025/26 要項): 1回戦2分, 2回戦・3回戦3分, 準々決勝・準決勝4分, 敗者復活戦・決勝4分.
//  - エントリー数: 2001 1,603組 / 2007 4,239組 (当時最多) / 2019 5,040組 / 2020 5,081組 / 2022 7,261組 / 2023 8,540組 /
//    2024 10,330組 (初の5桁) / 2025 11,521組 / 2026 12,663組 (再エントリー含む)   [oricon, mynavi 2007, thetv, nikkan-gendai,
//    sakigake 2026-10-04]. Other years are rounded estimates, shown as 「約」.
//  - 2026: エントリー 6/22〜8/31, 1回戦 8/1〜10/3 全国12地区 (熊本・長野を追加), 東京1回戦 シダックスカルチャーホール,
//    2回戦 10/12〜 (東京 雷5656会館ときわホール).                                     [sakigake 2026-10-04, ticketjam]
//    2025: 大阪3回戦 10/27〜29, 東京3回戦 11/4〜6 (東京最終日 KANDA SQUARE HALL), 準々決勝 ルミネtheよしもと / なんばグランド花月,
//    準決勝 12/4 NEW PIER HALL (2019〜2025 も同所), 敗者復活戦・決勝 12/21.          [natalie, allabout, oricon]
//  - 決勝組数: 第1回10組, 第2〜12回 9組 (うち敗者復活1), 第13回〜 10組 (9+敗者復活1).  [oricon special 66068]
//  - 審査員: 2001 7人+3会場(札幌・大阪・福岡)の一般客各100人が1人1点 (第2回で廃止); 2015 9人; 2016 5人; 2017〜2023 7人;
//    2024・2025 9人. 2002〜2010 are taken as 7 (not individually verified).          [allabout 88321, daily 2016-12-04, mdpr]
//  - 敗者復活戦: 2002〜, 準決勝敗退者. 2002 一般審査員100人+プロ5人; 2009 大井競馬場 (特別審査員+一般100人);
//    第11回(2015)〜 視聴者投票1位; 〜2022 六本木ヒルズアリーナ (屋外); 2023 新宿住友ビル三角広場 (初の屋内), 21組を3ブロック,
//    観客の投票による勝ち残り方式→芸人審査員5名の投票で1組; 2025 EX THEATER ROPPONGI, 21組3ブロック, 700人中200人の観客 →
//    芸人審査員.                                                                        [allabout 34962/73242, daily 2023-11-17]
//  - 笑神籤 (えみくじ): 2017〜. 敗者復活の1組が冒頭に決まり、10組がそろったところで籤を引いて出番を決める. [oricon 2100743]
//    Before: the order was fixed beforehand and the 敗者復活 slot criticised as an advantage.
//  - ワイルドカード: 2015〜, 準々決勝敗退者から視聴者投票1位が準決勝へ (2025: TVer で準々決勝ネタ公開).  [allabout 72510/87397]
//  - 準決勝進出は30組前後 (2024: 30組).                                                 [allabout 87397]
//  - 出囃子 (決勝ファーストラウンドの登場曲): Fatboy Slim「Because We Can」(1998). Named only.   [ototoy, wiki3]
//  - 優勝賞金 1000万円. 決勝: ABCテレビ・テレビ朝日系 全国ネット生放送 (2023〜2025 18:30〜). 朝日放送 became 朝日放送テレビ in 2018.
//  - Before テレビ朝日 joined the production the final came from パナソニックセンター有明スタジオ (years not verified: unused).
//  - After the final: 「M-1グランプリ2022 世界最速大反省会」(GYAO!, 22:10〜) and 「M-1打ち上げ」(生配信 ~24:00); 2023
//    「イブより熱い大反省会!」(Lemino). 「アナザーストーリー」= the documentary after the final (named by the 2022 champion).
//    A nationwide tour with finalists in Feb–Mar is listed by ぴあ (2024). 「M-1グランプリ リターンズ」 and 「M-1 アフター
//    座談会」 could NOT be verified: in this game they are this world's own specials, described generically.
//  - Champions can not enter again (well known rule; applied).
// Everything else (dates inside a month, halls outside the ones above, pass counts below 準決勝) is a rounded estimate.
// Every person (entrants, judges, MC, past champions) is fictional — this game's world.

export const M1 = {
  id: 'm1',
  founded: 2001,
  hiatus: [2011, 2014],
  revived: 2015,
  song: 'Fatboy Slim「Because We Can」',
  prizeNominal: 10000000,
  prizeText: '優勝賞金1000万円',
};

// ---------------------------------------------------------------- rng / hashing (deterministic worlds)
export function hstr(s) {
  let h = 2166136261 >>> 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hstr(seed)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a uniform 0..1 from any key parts
export const h01 = (...k) => hstr(k.join('|')) / 4294967296;
export const pickH = (arr, ...k) => arr[Math.floor(h01(...k) * arr.length) % arr.length];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// approx normal from a uniform source
export function gauss(r) { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / 0.577; }

// ---------------------------------------------------------------- the year's rules
export function editionOf(year) {
  if (year < 2001) return null;
  if (year <= 2010) return year - 2000;
  if (year < 2015) return null;
  return year - 2004; // 2015 = 11, 2024 = 20, 2026 = 22
}
export function m1Held(year) { return editionOf(year) != null; }

const ENTRIES = {
  2001: [1603, true], 2002: [1750, false], 2003: [1900, false], 2004: [2600, false], 2005: [3400, false], 2006: [3900, false],
  2007: [4239, true], 2008: [4500, false], 2009: [4600, false], 2010: [4800, false],
  2015: [3500, false], 2016: [3500, false], 2017: [4100, false], 2018: [4600, false], 2019: [5040, true], 2020: [5081, true],
  2021: [6000, false], 2022: [7261, true], 2023: [8540, true], 2024: [10330, true], 2025: [11521, true], 2026: [12663, true],
};
// { n, verified }. Future years grow by roughly a thousand a year (the trend since 2020), slowing down.
export function entriesOf(year) {
  if (ENTRIES[year]) return { n: ENTRIES[year][0], verified: ENTRIES[year][1] };
  if (year > 2026) {
    let n = 12663;
    for (let y = 2027; y <= year; y++) n += Math.round(1100 * Math.pow(0.88, y - 2027) + 120 + h01('m1entries', y) * 300);
    return { n, verified: false };
  }
  return { n: 0, verified: false };
}
export const entriesText = (year) => {
  const e = entriesOf(year);
  return e.verified ? `${e.n.toLocaleString('ja-JP')}組` : `約${(Math.round(e.n / 100) * 100).toLocaleString('ja-JP')}組`;
};

// era of the rules
export function ruleEra(year) {
  if (year <= 2010) return 'heisei';
  if (year <= 2018) return 'revival';
  return 'reiwa';
}

// The real-ish calendar: month + slot (0..9; a game month is 10 days, slot k = real day k*3+1).
// Rounds hold [month, slot, city, hall] options (the player picks a 1回戦 date/venue; later rounds: one of the dates).
function calendar(year) {
  if (year <= 2010) {
    // NOT verified for these years: generic summer entry, autumn rounds, final in late December.
    return {
      entry: [[7, 0], [8, 8]],
      r1: [[8, 2, '東京', '東京会場'], [8, 4, '大阪', '大阪会場'], [8, 6, '名古屋', '名古屋会場'], [8, 8, '福岡', '福岡会場'], [9, 1, '札幌', '札幌会場'], [9, 3, '東京', '東京会場'], [9, 5, '大阪', '大阪会場']],
      r2: [[10, 2, '東京', '東京会場'], [10, 4, '大阪', '大阪会場']],
      r3: [[11, 1, '東京', '東京会場'], [11, 3, '大阪', '大阪会場']],
      sf: [[12, 1, '東京', '準決勝会場（東京）']],
      final: [12, 8],
      finalLabel: '12月下旬',
    };
  }
  const early = year <= 2018; // 2015 12/6, 2016 12/4 (2017・2018 taken as early December too)
  if (early) {
    return {
      entry: [[6, 5], [8, 6]],
      r1: [[8, 1, '東京', '東京会場'], [8, 3, '大阪', '大阪会場'], [8, 5, '名古屋', '名古屋会場'], [8, 7, '福岡', '福岡会場'], [8, 9, '札幌', '札幌会場'], [9, 1, '仙台', '仙台会場'], [9, 3, '広島', '広島会場'], [9, 5, '東京', '東京会場']],
      r2: [[9, 8, '大阪', '大阪会場'], [10, 1, '東京', '東京会場']],
      r3: [[10, 5, '大阪', '大阪会場'], [10, 7, '東京', '東京会場']],
      qf: [[11, 2, '東京', '東京会場'], [11, 3, '大阪', '大阪会場']],
      sf: [[11, 6, '東京', '準決勝会場（東京）']],
      final: [12, 1],
      finalLabel: year === 2015 ? '12月6日' : year === 2016 ? '12月4日' : '12月上旬',
    };
  }
  const kumamoto = year >= 2026; // 熊本・長野 added in 2026 (12 地区)
  const r1 = [[8, 1, '東京', 'シダックスカルチャーホール'], [8, 3, '大阪', '大阪会場'], [8, 5, '名古屋', '名古屋会場'], [8, 7, '福岡', '福岡会場'], [8, 9, '札幌', '札幌会場'], [9, 1, '仙台', '仙台会場'], [9, 3, '広島', '広島会場'], [9, 7, '東京', 'シダックスカルチャーホール'], [9, 9, '大阪', '大阪会場']];
  if (kumamoto) r1.splice(7, 0, [9, 4, '熊本', '熊本会場'], [9, 5, '長野', '長野会場']);
  const sfVenue = 'NEW PIER HALL';
  return {
    entry: [[6, 7], [8, 9]],
    r1,
    r2: [[10, 3, '東京', year >= 2026 ? '雷5656会館 ときわホール' : '東京会場'], [10, 5, '大阪', '大阪会場']],
    r3: [[10, 8, '大阪', '大阪会場'], [11, 1, '東京', year >= 2025 ? 'KANDA SQUARE HALL' : '東京会場']],
    qf: [[11, 5, '東京', 'ルミネtheよしもと'], [11, 6, '大阪', 'なんばグランド花月']],
    sf: [[12, 1, '東京', sfVenue]],
    final: [12, 6],
    finalLabel: { 2019: '12月22日', 2020: '12月20日', 2021: '12月19日', 2022: '12月18日', 2023: '12月24日', 2024: '12月22日', 2025: '12月21日' }[year] || '12月下旬',
  };
}

// Distances from Tokyo for the 交通費 (往復, 令和の目安, game yen; shown in the era's prices).
export const FARE = { 東京: 0, 大阪: 28000, 名古屋: 22000, 福岡: 46000, 札幌: 42000, 仙台: 22000, 広島: 38000, 熊本: 46000, 長野: 16000 };

// The full rule set of a year (null when not held).
export function m1Rules(year) {
  const ed = editionOf(year);
  if (ed == null) return null;
  const cal = calendar(year);
  const era = ruleEra(year);
  const limit = year <= 2002 ? 9 : year <= 2010 ? 10 : 15; // 10年未満 → formed within the last 9 years (counting like the later rules)
  const limitText = year <= 2002 ? '結成10年未満' : year <= 2010 ? '結成10年以内' : '結成15年以内';
  const finalists = year === 2001 ? 10 : year <= 2016 ? 9 : 10;
  const revival = year >= 2002;
  const judges = year <= 2014 ? 7 : year === 2015 ? 9 : year === 2016 ? 5 : year <= 2023 ? 7 : 9;
  const hasQF = year >= 2015;
  const E = entriesOf(year).n;
  const rounds = [];
  const R = (id, name, len, opts, pass, extra = {}) => rounds.push({ id, name, length: len, opts: opts.map(([m, k, city, hall]) => ({ m, k, city, hall })), pass, ...extra });
  R('r1', '1回戦', 120, cal.r1, Math.round(E * (year <= 2010 ? 0.2 : 0.165)), { judge: '予選審査員（作家・スタッフ）' });
  R('r2', '2回戦', 180, cal.r2, year <= 2010 ? Math.round(E * 0.05) : Math.round(E * 0.048), { judge: '予選審査員' });
  R('r3', '3回戦', 180, cal.r3, year <= 2010 ? 50 : Math.min(140, Math.max(90, Math.round(E * 0.011))), { judge: '予選審査員' });
  if (hasQF) R('qf', '準々決勝', 240, cal.qf, 30, { judge: '予選審査員', wildcard: true });
  R('sf', '準決勝', year <= 2010 ? 240 : 240, cal.sf, finalists - (revival ? 1 : 0), { judge: '予選審査員', press: true });
  // texts carry the word joiner (util.js YEN_MARK) so the era's price scaling (yenText) leaves the real amount alone
  const fee = year >= 2025 ? { per: 'person', nominal: 1000, text: '1人\u20601,000円', verified: true }
    : { per: 'unit', nominal: 2000, text: '1組\u20602,000円', verified: year >= 2019 };
  const revivalFormat = !revival ? null
    : year <= 2010 ? { kind: 'outdoor', venue: year === 2009 ? '大井競馬場（東京）' : '屋外の特設会場（東京）', judge: year === 2002 ? '一般審査員100人＋プロの審査員5人' : '特別審査員＋一般審査員100人', outdoor: true }
      : year <= 2022 ? { kind: 'vote', venue: '六本木ヒルズアリーナ（屋外）', judge: '視聴者投票（得票1位が決勝へ）', outdoor: true }
        : { kind: 'blocks', venue: year === 2023 ? '新宿住友ビル 三角広場（屋内）' : year === 2024 ? '都内の特設会場（屋内）' : 'EX THEATER ROPPONGI', judge: year === 2023 ? '観客500人の投票（勝ち残り）→芸人審査員5名' : '観客の投票（勝ち残り）→芸人審査員', blocks: 3, field: 21, outdoor: false };
  return {
    year, edition: ed, era, label: `M-1グランプリ${year}`, edLabel: `第${ed}回`,
    organizer: year >= 2018 ? '朝日放送テレビ・吉本興業' : '朝日放送・吉本興業',
    broadcast: year >= 2018 ? 'ABCテレビ・テレビ朝日系 全国ネット生放送' : '朝日放送・テレビ朝日系 全国ネット生放送',
    limit, limitText, members: 2, pro: true, amateur: true,
    eligibilityText: `${limitText}（${year >= 2015 ? `${year - 15}年1月1日以降の結成` : `${year - limit}年以降の結成`}）・2人以上・プロアマ・所属事務所の有無を問わない`,
    fee, entries: E, entriesText: entriesText(year),
    entryMethod: year <= 2010 ? '応募用紙（郵送）' : 'WEBエントリー（公式サイト）',
    confirm: year <= 2010 ? 'hagaki' : 'mail',
    results: year <= 2010 ? '会場の掲示と公式サイト' : '公式サイト',
    seeds: year >= 2020,
    entry: { from: cal.entry[0], to: cal.entry[1] },
    rounds, finalAt: cal.final, finalLabel: cal.finalLabel,
    finalists, revival: revivalFormat, judges, judgeScoring: year === 2001 ? '審査員7人×100点＋一般客300人（1人1点）＝1000点満点' : `${judges}人×100点＝${judges * 100}点満点`,
    audience2001: year === 2001,
    finalRound: year !== 2001, // 2001: decided by the one round (no 最終決戦 in this game; not verified)
    emikuji: year >= 2017,
    wildcard: year >= 2015,
    wildcardMedia: year >= 2025 ? 'TVer' : '公式の動画配信',
    finalVenue: year >= 2015 ? 'テレビ朝日のスタジオ（東京・六本木）' : '東京の決勝スタジオ',
    onAir: year >= 2023 ? '18:30' : null,
    prizeText: M1.prizeText,
    hansei: year >= 2023 ? '大反省会' : year >= 2022 ? '世界最速大反省会' : null, // a live stream after the final: 2022 (GYAO!) / 2023〜 (Lemino)
    sns: year <= 2010 ? '掲示板' : 'SNS',
  };
}

// ---------------------------------------------------------------- names (fictional)
const K1 = ['ネオン', 'ミント', 'ポップコーン', 'サンセット', 'ドロップ', 'ランプ', 'ペリカン', 'ラッキー', 'シャイン', 'ポンコツ', 'バニラ', 'ロケット', 'マッハ', 'スパイス', 'ハニー', 'メロン', 'ペンギン', 'カラフル', 'モノクロ', 'パラレル', 'トリプル', 'ジャンボ', 'エンドレス', 'ファニー', 'タイフーン', 'サニー', 'レイニー', 'グリーン', 'ミラーボール', 'シャボン', 'オーロラ', 'ハリケーン', 'パイナップル', 'キャラメル', 'ブルーベリー', 'マーブル', 'プラネット', 'ジャングル', 'カメレオン', 'フラミンゴ', 'ドルフィン', 'コアラ', 'パンダ', 'ゴリラ', 'ラクダ', 'トナカイ', 'ハムスター', 'ピーナッツ', 'ビスケット', 'ワッフル'];
const K2 = ['ボーイズ', 'ブラザーズ', 'ドーナツ', 'ステーション', 'ハウス', 'カンパニー', 'クラブ', 'パーク', 'ホテル', 'ランド', 'タウン', 'エンジン', 'ブレーキ', 'タクシー', 'ライト', 'ベル', 'スター', 'ムーン', 'ボム', 'ラジオ', 'キッチン', 'ベーカリー', 'マーケット', 'ギア', 'ノート', 'ダイス', 'パズル', 'サーカス', 'ジャンクション', 'トンネル', 'エレベーター', 'リモコン', 'スニーカー', 'シャッター', 'ポスト', 'カーテン'];
const KJ = ['月見', '夕焼け', '三日月', '風車', '鈴虫', '金魚', '線香花火', '手羽先', '焼きそば', '雪見', '七味', '番茶', '大福', '一番星', '路地裏', '回覧板', '改札', '終電', '始発', '屋上', '縁側', '下駄箱', '職員室', '放課後', '三輪車', '湯けむり', '紙風船', '竹とんぼ', '駄菓子', 'ちくわ', 'はんぺん', '昆布', '金平糖', '扇風機', '炊飯器', '電話帳', '物干し', '豆電球', '鉛筆', '消しゴム', '時刻表', '万華鏡', '虫めがね', '雷おこし', '五目並べ', '神社', '団地'];
const KJS = ['', 'ズ', '兄弟', '姉妹', '商会', '組', '屋', '堂', '座', '工房', '本舗', '劇場', 'ボーイ'];
const HG = ['ひだまり', 'のりしお', 'ぽかぽか', 'ぺらぺら', 'ぐるぐる', 'きらきら', 'もぐもぐ', 'すやすや', 'ほくほく', 'わくわく', 'ぴよぴよ', 'ふわふわ', 'ころころ', 'てくてく', 'ぱたぱた', 'しとしと', 'もちもち', 'ちょこちょこ'];
const AB = ['NEON', 'BOX', 'ZERO', 'HOP', 'JET', 'LOOP', 'MIX', 'POP', 'TONE', 'CUBE', 'FLAT', 'NOVA', 'VOLT', 'WAVE'];
const AB2 = ['STEP', 'DAYS', 'LIFE', 'LINE', 'GATE', 'PARK', 'MAN', 'CLUB', 'TALK', 'HOUSE'];
// real combo names this generator must never produce (famous names; the list keeps the world fictional)
const BLOCK = new RegExp("2700|3時のヒロイン|9番街レトロ|Aマッソ|COWCOW|DonDokoDon|EXIT|GAG|NON|POISON|STYLE|TKO|U字工事|うるとらブギーズ|おいでやすこが|おぎやはぎ|かが屋|かまいたち|ぎょうぶ|くらげ|くりぃむしちゅー|さまぁ|さや香|さらば|さらば青春の光|しずる|たくろう|とろサーモン|とんねるず|どぶろっく|ぺこぱ|ぼる塾|ますだおかだ|やすよともこ|や団|ゆにばーす|ゆりやん|アインシュタイン|アキナ|アメリカザリガニ|アンジャッシュ|アンタッチャブル|インディアンス|インパルス|ウエストランド|ウッチャンナンチャン|ウーマンラッシュアワー|エバース|オズワルド|オダウエダ|オードリー|オール阪神|カナリア|カミナリ|ガクテンソク|キャン×キャン|キングオブコメディ|キングコング|ギャロップ|ケビンス|コットン|サンドウィッチマン|ザブングル|ザ・ぼんち|ザ・ギース|ザ・ドリームマッチ|ザ・パンチ|ザ・マミィ|シティホール|ジェラードン|ジグザグジギー|ジパング上陸作戦|ジャルジャル|ジャングル|ジャングルポケット|ジョックロック|ストリーク|ストレッチーズ|スピードワゴン|スリムクラブ|スーパーマラドーナ|ゼンモンキー|ゾフィー|タイムマシーン|タモンズ|ダイアン|ダイタク|ダウ90000|ダウンタウン|ダブルブッキング|ダンビラムーチョ|チュートリアル|チョコレートプラネット|トット|トムブラウン|トム・ブラウン|トレンディエンジェル|ドドん|ドランクドラゴン|ドンデコルテ|ナイチンゲールダンス|ナイツ|ナインティナイン|ニッポン|ニッポンの社長|ニューヨーク|ネルソンズ|ノンスタ|ハイキング|ハイキングウォーキング|ハイツ友の会|ハイヒール|ハナコ|ハマカーン|ハライチ|ハリガネロック|ハリセンボン|ハンジロウ|バイきんぐ|バッテリィズ|バナナマン|パンクブーブー|パンサー|ヒコロヒー|ビスケットブラザーズ|ピース|ファイヤー|ファイヤーサンダー|フットボールアワー|フースーヤ|ブラックマヨネーズ|プラス・マイナス|ペンギンズ|マシンガンズ|マヂカルラブリー|ママタルト|マユリカ|ミキ|ミルクボーイ|メイプル超合金|モグライダー|モンスターエンジン|ヤーレンズ|ヨネダ|ヨネダ2000|ライス|ラバーガール|ラブレターズ|ラランド|ランジャタイ|レギュラー|ロザン|ロバート|ロングコート|ロングコートダディ|ロンドンブーツ|三四郎|三拍子|中川家|中田カウス|令和|令和ロマン|千鳥|南海キャンディーズ|吉住|和牛|品川庄司|四千頭身|囲碁|囲碁将棋|変ホ長調|大木こだま|天才ピアニスト|天竺|天竺鼠|学天即|宮川大助|平成ノブシコブシ|我が家|東京03|東京ダイナマイト|東京ホテイソン|流れ星|海原|滝音|爆笑問題|爛々|男性ブランコ|相席スタート|真空ジェシカ|磁石|空気階段|笑い飯|紅しょうが|納言|華山|蛙亭|見取り図|豪快キャプテン|超新塾|酒井くにお|金属|金属バット|銀シャリ|錦鯉|隣人|霜降り明星|馬鹿よ貴方は|麒麟");
// another module may supply a real-name check (contests.js isRealNameLike, feature-detected by contest_m1.js)
let NAME_FILTER = null;
export function setNameFilter(fn) { NAME_FILTER = typeof fn === 'function' ? fn : null; }
const realish = (n) => BLOCK.test(n) || (NAME_FILTER ? !!(() => { try { return NAME_FILTER(n); } catch (e) { return false; } })() : false);
export function comboName(...key) {
  const r = rng(hstr(key.join('|')));
  for (let t = 0; t < 8; t++) {
    const f = r();
    let n;
    if (f < 0.34) n = pickR(K1, r) + pickR(K2, r);
    else if (f < 0.62) n = pickR(KJ, r) + pickR(KJS, r);
    else if (f < 0.72) n = pickR(KJ, r) + 'と' + pickR(KJ, r);
    else if (f < 0.84) n = pickR(HG, r) + pickR(['', 'ず', 'ぼーい', 'がーる', 'くらぶ', '団'], r);
    else if (f < 0.93) n = pickR(AB, r) + ' ' + pickR(AB2, r);
    else n = pickR(K1, r) + pickR(['', '・', ''], r) + pickR(KJ, r);
    if (!realish(n) && Array.from(n).length <= 10) return n;
  }
  return pickR(KJ, r) + '座';
}
function pickR(arr, r = Math.random) { return arr[Math.floor(r() * arr.length) % arr.length]; }

const SUR = ['佐伯', '大河内', '森下', '宮里', '仲宗根', '宇喜多', '鬼頭', '湯川', '西岡', '東海林', '真壁', '若松', '汐見', '栗原', '朽木', '堀之内', '三好', '舘野', '岩永', '籾山', '小野寺', '能登', '柿沼', '樋口', '春野', '戸川', '鴫原', '椚田', '姥沢', '赤城', '筧田', '白鳥', '狐塚', '日比野', '綿貫', '芹沢', '桑原', '江藤', '島袋', '仁科', '早瀬', '木暮', '浅見', '花岡', '五十嵐', '中野渡', '霧島', '鶴見'];
const GIV_M = ['ケンタ', 'ユウジ', 'タクミ', 'ショウタ', 'リョウ', 'ダイキ', 'コウヘイ', 'ヒロト', 'マサキ', 'ソウタ', 'ジュン', 'カズマ', 'トオル', 'ノボル', 'テツヤ', 'ゴロウ', 'イッペイ', 'ハヤト'];
const GIV_F = ['アヤ', 'ミホ', 'ユキ', 'サキ', 'ナナ', 'マリ', 'カナ', 'リエ', 'ハルカ', 'チヒロ', 'モモ', 'エミ'];
// Stage names: a rare surname alone, a katakana given name alone, or both (katakana given names keep them clear of real
// people, whose given names are written in kanji); the optional filter (real-name check) rejects any match.
export function personName(gender, ...key) {
  const r = rng(hstr(['p', ...key].join('|')));
  for (let t = 0; t < 6; t++) {
    const f = r();
    const n = f < 0.45 ? pickR(SUR, r) : f < 0.8 ? pickR(gender === 'f' ? GIV_F : GIV_M, r) : pickR(SUR, r) + ' ' + pickR(gender === 'f' ? GIV_F : GIV_M, r);
    if (!realish(n)) return n;
  }
  return pickR(SUR, r) + pickR(['丸', '坊', '介'], r);
}

// Looks for HD sprites (sprites.js look objects), deterministic per person key.
const HAIRS = ['short', 'spiky', 'slick', 'bald', 'afro', 'cap', 'long', 'bob'];
const HCOL = ['black', 'brown', 'black', 'blonde', 'black', 'silver', 'orange', 'brown'];
const TOPS = ['#2e3140', '#d64161', '#3a6fd8', '#2f9a4a', '#ffd23f', '#8a5ac8', '#f2f2f2', '#c0452f', '#1e1e26', '#ff8a3d', '#5fd7ff', '#7a4824'];
export function lookFor(gender, ...key) {
  const r = rng(hstr(['look', ...key].join('|')));
  const fem = gender === 'f';
  const suit = r() < 0.55; // most manzai acts wear suits
  const top = suit ? pickR(['#2e3140', '#1e1e26', '#3a4a7a', '#5a4a3a', '#8a1a2c', '#f2f2f2', '#2f6b34'], r) : pickR(TOPS, r);
  return {
    hair: fem ? pickR(['long', 'bob', 'twin', 'short'], r) : pickR(HAIRS, r),
    hairColor: pickR(HCOL, r), skin: pickR(['fair', 'light', 'tan', 'fair', 'brown'], r),
    top, bottom: suit ? top : pickR(['#3a4a7a', '#2a2d36', '#5a4a3a', '#3b3f48'], r),
    jacket: suit, tie: suit && r() < 0.7 ? pickR(['#d62f2f', '#3a6fd8', '#ffd23f', '#2f9a4a', '#ff7eb6'], r) : undefined,
    glasses: r() < 0.22 ? true : undefined, skirt: fem && r() < 0.5 ? true : undefined, beard: !fem && r() < 0.08 ? true : undefined,
  };
}

// ---------------------------------------------------------------- judges & MC (fictional people of this world)
// taste: what they reward (matched against an act's style), bias: strict (-) / generous (+)
export const JUDGES = [
  { id: 'kazama', name: '風間ゲンジ', title: '漫才師（関西の大御所）', taste: 'しゃべくり', bias: -1.2, from: 2001, to: 2099, line: 'しゃべくりの技術と間を見とる。' },
  { id: 'miyanoshita', name: '宮ノ下マコト', title: '漫才師', taste: '正統派', bias: -0.4, from: 2001, to: 2010, line: '漫才はやっぱり、二人の会話やからね。' },
  { id: 'ohashi', name: '大橋みどり', title: 'タレント（元漫才師）', taste: '人間味', bias: 0.6, from: 2001, to: 2099, line: '人柄が見える漫才が好きよ。' },
  { id: 'kuroda', name: '黒田テツ', title: '放送作家', taste: '構成', bias: -1.6, from: 2001, to: 2018, line: 'ネタの設計図、伏線の回収を見ています。' },
  { id: 'shiraishi', name: '白石ハルオ', title: '落語家', taste: '話芸', bias: 0.2, from: 2001, to: 2016, line: '言葉の運び、間の取り方ですな。' },
  { id: 'kobayakawa', name: '小早川ナミ', title: 'コント師', taste: 'コント漫才', bias: 0.4, from: 2002, to: 2099, line: '設定の面白さと演技の細かさ。' },
  { id: 'mishima', name: '三島カズヤ', title: '漫才師（ベテラン）', taste: 'テンポ', bias: 0, from: 2002, to: 2099, line: 'テンポ、そして最後の4分間の爆発力。' },
  { id: 'chiyoda', name: '千代田リュウ', title: '漫才師', taste: '新しさ', bias: 0.8, from: 2015, to: 2099, line: '見たことない漫才を見せてほしい。' },
  { id: 'togo', name: '東郷マサル', title: '漫才師', taste: 'ボケ数', bias: -0.6, from: 2015, to: 2099, line: '笑いの量、手数の多さも大事や。' },
  { id: 'hayama', name: '葉山レイ', title: '漫才師（女性コンビ）', taste: '人間味', bias: 0.5, from: 2017, to: 2099, line: '二人の関係性が見える瞬間が好き。' },
  { id: 'nanjo', name: '南条カンジ', title: '漫才師', taste: 'システム', bias: -0.3, from: 2017, to: 2099, line: '発明があるかどうか。' },
  { id: 'umeda', name: '梅田ジョー', title: '漫才師（大阪の劇場の顔）', taste: 'しゃべくり', bias: 0.3, from: 2019, to: 2099, line: '大阪の劇場で鍛えた漫才は強いで。' },
  { id: 'kanda', name: '神田ミツル', title: '漫才師', taste: '変則', bias: 0.1, from: 2023, to: 2099, line: '型を壊しにくる人を応援したい。' },
  { id: 'naniwa', name: '浪花ノリオ', title: '漫才師', taste: '正統派', bias: -0.8, from: 2024, to: 2099, line: '基本ができてるかどうかは、すぐわかる。' },
  { id: 'edogawa', name: '江戸川ヨシ', title: '漫才師（東京の劇場の顔）', taste: 'ボケ数', bias: 0.6, from: 2024, to: 2099, line: '後半の畳みかけがあるかどうか。' },
];
export function judgesFor(year) {
  const n = m1Rules(year) ? m1Rules(year).judges : 7;
  const pool = JUDGES.filter((j) => year >= j.from && year <= j.to);
  // a stable order per year (the veterans first), n judges
  const sorted = pool.slice().sort((a, b) => (a.from - b.from) || (h01('jo', year, a.id) - h01('jo', year, b.id)));
  const out = sorted.slice(0, n);
  while (out.length < n) out.push({ id: 'guest' + out.length, name: personName('m', 'judge', year, out.length) + '（漫才師）', title: '漫才師', taste: '正統派', bias: 0, line: '面白いかどうか、それだけです。' });
  return out.map((j) => ({ ...j, y: year })); // [R11-J] the year, for the judge agents (taste drift since the debut)
}
export const MC = {
  main: { name: '浜坂トオル', title: '司会（漫才師）', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#ffd23f' } },
  sub: { name: '月岡ミナ', title: '司会（アナウンサー）', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#8a1a2c', skirt: true } },
  revival: { name: '本町アキラ', title: '敗者復活戦の司会（アナウンサー）', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#2a3560', jacket: true, tie: '#3a6fd8', glasses: true } },
  staff: { name: 'M-1事務局', look: { hair: 'cap', hat: '#d62f2f', hairColor: 'black', skin: 'tan', top: '#1e1e26', bottom: '#2a2d36' } },
  ad: { name: 'フロアディレクター', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#3b3f48', bottom: '#2a2d36', glasses: true } },
  writer: { name: '予選審査員（放送作家）', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#5a4a3a', bottom: '#3b3f48', glasses: true } },
  director: { name: 'アナザーストーリーのディレクター', look: { hair: 'cap', hat: '#2f6fd0', hairColor: 'black', skin: 'tan', top: '#f2f2f2', bottom: '#5a4a3a' } },
};

// ---------------------------------------------------------------- styles, origins, regions
export const STYLES = ['しゃべくり', '正統派', 'コント漫才', 'システム', '変則', 'ボケ数', '話芸'];
export const ORIGINS = {
  nsc_osaka: 'NSC大阪', nsc_tokyo: 'NSC東京', univ: '大学のお笑いサークル', net: 'ネットで出会った', pin: '元ピン芸人同士',
  friends: '幼なじみ', school: '高校の同級生', work: '元会社員同士', amateur: 'アマチュア（会社員）', family: 'きょうだい', other: '劇場の先輩後輩',
};
export const REGIONS = ['大阪', '東京', '東京', '大阪', '福岡', '名古屋', '札幌', '広島', '仙台', '沖縄', '京都', '神戸', '静岡', '新潟'];
export const AGENCY_NAMES = ['吉本興業', '吉本興業', '吉本興業', '松竹芸能', 'ワタナベエンターテインメント', '太田プロダクション', 'マセキ芸能社', 'ケイダッシュステージ', 'サンミュージック', 'フリー', 'アマチュア'];

// ---------------------------------------------------------------- catch copies (unique per act and year)
// facts: { name, years (結成何年目), last (ラストイヤー), amateur, origin, region, style, revival (敗者復活), firstFinal,
//          finals (past finals), semis (past 準決勝 count), runnerUpBefore, mixed, trio, oldest, rookie, player }
export function catchCopy(f, year) {
  const k = (s) => h01('cc', year, f.name, s);
  const opts = [];
  if (f.last) opts.push('ラストイヤーの逆襲', '最後の冬、最初の決勝', '15年目の決着'.replace('15', String(f.years)), 'これが最後のM-1', '終わらせない、終われない');
  if (f.revival) opts.push('這い上がった者たち', '敗者復活の奇跡', '寒空の下から来た刺客', 'もう一度、この舞台へ');
  if (f.amateur) opts.push('最強のアマチュア', '会社帰りの頂点', '素人と呼ぶな', '平日はスーツ、週末は漫才師');
  if (f.rookie) opts.push(`結成${f.years}年目の衝撃`, '怖いもの知らず', '超新星', '早すぎる到着');
  if (f.origin === 'net') opts.push(f.era === 'heisei' ? '掲示板から決勝へ' : 'ネットで出会ったふたり', '画面越しの相方', 'つながったのはネットだった');
  if (f.origin === 'nsc_osaka' || f.origin === 'nsc_tokyo') opts.push(`${ORIGINS[f.origin]}の星`, '養成所の教室から', '同期の誇り');
  if (f.origin === 'univ') opts.push('学生お笑いの怪物', 'サークル出身の秀才');
  if (f.origin === 'pin') opts.push('ピン芸人だったふたり', '一人と一人が二人になった');
  if (f.origin === 'family') opts.push('血のつながった漫才', '兄弟げんかは芸になる');
  if (f.origin === 'friends' || f.origin === 'school') opts.push('教室の人気者、全国へ', '幼なじみの完成形');
  if (f.region && f.region !== '東京' && f.region !== '大阪') opts.push(`${f.region}から来た刺客`, `${f.region}の希望`);
  if (f.region === '大阪') opts.push('大阪の劇場の看板', 'なにわのしゃべくり職人');
  if (f.region === '東京') opts.push('東京漫才の新しい顔', '東京ライブシーンの主役');
  if (f.style === 'しゃべくり') opts.push('しゃべくりの申し子', '会話だけで勝負する');
  if (f.style === 'コント漫才') opts.push('コント漫才の新星', '設定ひとつで世界を変える');
  if (f.style === 'システム') opts.push('漫才を発明した男たち', '新システム搭載');
  if (f.style === '変則') opts.push('異端の漫才', '型破り', '漫才の常識を疑え');
  if (f.style === 'ボケ数') opts.push('手数の暴力', '4分間に笑いを詰めこめ');
  if (f.style === '正統派') opts.push('ど真ん中の漫才', '王道を往く');
  if (f.style === '話芸') opts.push('言葉の魔術師', '間で笑わせる');
  if (f.finals >= 2) opts.push(`${f.finals + 1}度目の正直`, '常連から王者へ', '今年こそ');
  if (f.runnerUpBefore) opts.push('準優勝の先へ', 'あと一歩を越えに来た');
  if (!f.finals && f.semis >= 3) opts.push('準決勝の壁を越えて', `${f.semis}度跳ね返された壁`, '待たせたな');
  if (f.firstFinal && !opts.length) opts.push('初陣', '無名の挑戦者');
  if (f.mixed) opts.push('男女コンビの革命', 'ふたりの距離感');
  if (f.trio) opts.push('三人寄れば', 'トリオの意地');
  if (f.oldest) opts.push('遅咲きの大輪', '年齢なんて関係ない');
  if (!opts.length) opts.push('笑いの求道者', '今年いちばん面白い', '漫才に恋した', '静かなる刺客', '覚醒', 'まだ誰も知らない');
  // a stable but year-dependent pick
  let best = opts[0], bv = -1;
  for (const o of opts) { const v = k(o); if (v > bv) { bv = v; best = o; } }
  return best;
}

// ---------------------------------------------------------------- 審査コメント (実力不足の具体的な理由)
export const SHORTFALL_LINES = {
  neta: ['ネタの構成が弱い。前半で設定を説明しすぎて、笑いが少ない。', 'ボケの発想が既視感のあるものばかりだった。'],
  boke: ['ボケが弱く、笑いどころが少ない。', 'ボケの強さが足りない。もう一段、飛躍がほしい。'],
  tsukkomi: ['ツッコミのワードが平凡で、ボケを生かしきれていない。', 'ツッコミが遅れて、笑いが散った。'],
  ma: ['間が詰まりすぎて、客が笑う隙がなかった。', 'テンポが一定で、後半に向けた盛り上がりがない。'],
  voice: ['声量が足りず、後ろの客まで届いていない。', '滑舌が悪く、大事なワードが聞き取れなかった。'],
  dokyo: ['緊張で表情が固く、最初の一言で客をつかめなかった。'],
  chara: ['二人のキャラクターが見えない。何者なのかが伝わらない。'],
  adlib: ['客席の反応に合わせる余裕がなかった。'],
  hassou: ['発想が平凡。設定に「この二人ならでは」がない。'],
  wagei: ['言葉選びが雑で、説明が長い。'],
  act: ['演技が硬く、コントに入った部分が嘘っぽい。'],
  flub: ['噛んでしまい、そこで流れが止まった。'],
  blank: ['ネタが飛んだ。間が空いて客席が冷えた。'],
  overtime: ['尺オーバー。持ち時間を守れていない（減点）。'],
  tsukami: ['ツカミが弱く、最初の30秒で客が乗ってこなかった。'],
  crowd: ['客層に合っていなかった。年齢層の高い客席で内輪ネタは届かない。'],
  same: ['昨年と同じネタ。新しさがない。'],
};

// ---------------------------------------------------------------- news bank (≥ 40 distinct lines; {x} filled in)
export const NEWS = {
  open: ['{label}、エントリー受付スタート。出場資格は{limit}、プロ・アマ問わず2人以上。', '{label}のエントリーが始まった。{method}で受け付け、エントリー料は{fee}。'],
  open2001: ['漫才の新しい大会「M-1グランプリ」創設。結成10年未満なら誰でも出場でき、優勝賞金は1000万円。'],
  open2015: ['M-1グランプリが5年ぶりに復活！出場資格は「結成15年以内」に広がった。'],
  feeChange: ['M-1のエントリー料が「1組\u20602,000円」から「1人\u20601,000円」に変わった。'],
  close: ['{label}のエントリーが締め切られ、{entries}が参戦。', 'M-1エントリー総数は{entries}。{record}'],
  r1open: ['{label}の1回戦が{hall}で開幕。持ち時間は2分。', '1回戦初日、会社員コンビや学生コンビ、親子コンビまで2分間の真剣勝負。'],
  r1amateur: ['1回戦でアマチュアの「{x}」が会場をどよめかせた。', '大学生コンビ「{x}」、1回戦で爆笑をさらう。'],
  upset: ['準決勝常連の「{x}」が{round}で敗退。波乱のM-1。', 'まさか…前年ファイナリスト「{x}」が{round}で姿を消す。'],
  r2: ['M-1の2回戦が開幕。シード組も登場し、レベルが一気に上がる。', '2回戦、結成{y}年目の「{x}」が突破。'],
  r3: ['3回戦の結果発表。勝ち残ったのは{n}組。', '3回戦で「{x}」が会場の空気を一変させた。'],
  qf: ['準々決勝の結果が出た。準決勝に進むのは{n}組。', '準々決勝、ルミネtheよしもととなんばグランド花月で熱戦。'],
  wildcard: ['ワイルドカードは「{x}」。ネット投票で準決勝へ復活。'],
  sf: ['M-1準決勝、{venue}で{n}組が激突。', '準決勝、「{x}」のネタで会場が揺れた。'],
  finalists: ['M-1決勝進出者発表：{list}。', '初の決勝進出は{k}組。「{x}」はラストイヤーで悲願の決勝へ。', '決勝の顔ぶれがそろった。最年長は結成{y}年目の「{x}」。'],
  amateurFinal: ['アマチュアの「{x}」が決勝進出！異例の快挙。'],
  semiTears: ['準決勝常連の「{x}」、今年も決勝に届かず。'],
  revival: ['敗者復活戦を勝ち抜いたのは「{x}」！決勝最後の1枠をつかんだ。', '敗者復活戦、{venue}に{n}組が集結。'],
  revivalCold: ['敗者復活戦の会場は冷たい風。白い息の漫才師たち。'],
  revivalNew: ['敗者復活戦が新方式に。3ブロックに分かれて、観客の投票で勝ち残りを決める。'],
  emikuji: ['笑神籤でトップバッターに選ばれたのは「{x}」。', '笑神籤、最後に呼ばれたのは「{x}」だった。'],
  topScore: ['「{x}」がファーストラウンド{s}点。今大会の最高得点。'],
  judgeTalk: ['審査員・{j}の{s}点が話題に。', '審査員{j}「{line}」のコメントに反響。'],
  champion: ['第{ed}代王者は「{x}」！{label}を制した。', '「{x}」、結成{y}年目でM-1王者に。優勝賞金1000万円。', '「{x}」、最終決戦で審査員{v}票を集め優勝。'],
  championRevival: ['敗者復活から頂点へ！「{x}」が優勝。'],
  championLast: ['ラストイヤーの「{x}」が頂点に。涙の優勝。'],
  runnerUp: ['準優勝の「{x}」にもオファーが殺到。'],
  rating: ['M-1決勝の視聴率は関西{p}%。今年も年末の顔に。'],
  trend: ['{sns}で「{x}」の話題が止まらない。', 'M-1の翌朝、「{x}」のネタのフレーズが流行語に。'],
  another: ['「アナザーストーリー」で「{x}」の一年を放送。'],
  tour: ['M-1ツアーが開幕。{city}公演は即完売。'],
  dvd: ['{label}のDVDが発売。'],
  lastYearTears: ['ラストイヤーの「{x}」、M-1を卒業。「この大会に育ててもらった」。'],
  graduated: ['昨年がラストイヤーだった「{x}」、M-1を卒業。「この大会に育ててもらった」。', '結成年数の上限を迎えた「{x}」、今年からM-1に出られない。「次の舞台で勝負する」。'],
  disband: ['M-1常連の「{x}」が解散を発表。'],
  ended: ['M-1グランプリ、今年の第10回で一区切り。大会の終了が発表された。'],
  hiatus: ['今年はM-1グランプリの開催なし（2010年の第10回で一区切り）。年末の漫才番組はTHE MANZAIへ。'],
  newJudge: ['M-1決勝の審査員に{j}が初登場。'],
  record: ['エントリー数は過去最多を更新。'],
};
