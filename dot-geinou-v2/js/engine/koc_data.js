// キングオブコント — facts, rules by era, schedule, venues and the fictional people of this world (owner: E2).
// Imported by contest_koc.js / koc_core.js / koc_flow.js / koc_art.js. No game state here: pure data + helpers.
//
// VERIFIED (WebSearch, 2026-10; sources below) — the game follows these:
//   ・創設 2008年、TBSテレビ主催・運営（通称KOC）。第1回 2008年、第19回 2026年（edition = year − 2007）。
//   ・参加資格：プロ・アマ、所属の有無を問わない。芸歴・年齢の制限なし（第1回から）。2人以上のユニットに限る（ピン不可）。
//     即席ユニット可。併願エントリー不可。満18才未満は保護者の承諾が必要（2026年の参加規定）。
//   ・エントリー料：コンビ ¥2,000／トリオ以上 ¥3,000、当日会場で支払い。シード出場者も支払う（2026年の参加規定）。
//     それ以前の年の金額は未確認 → このゲームでは同じ額を使う。
//   ・2026年：エントリー 5/15〜6/30。1回戦 7/7〜7/24（北海道・東京・大阪・愛知・福岡）、2回戦 8/1〜8/6（東京・大阪）、
//     準々決勝 8/13〜16（東京：渋谷区文化総合センター大和田 さくらホール／大阪：COOL JAPAN PARK OSAKA TTホール）、
//     準決勝 9/3・9/4（東京：ニッショーホール、準決勝進出35組）、敗者復活戦＋決勝 10/17（TBS系 生放送）。エントリー3,445組。
//   ・2025年：大阪の1回戦・2回戦は心斎橋PARCO SPACE14、準決勝はニッショーホール。エントリー3,449組（当時の史上最多）。
//   ・ネタ時間：2008年 1回戦2分／2回戦・準決勝3分／決勝5分。2017年まで準々決勝・準決勝・決勝は4分、2018年から5分
//     （1回戦・2回戦は2分）。2022年から2回戦3分。2018年から準決勝と決勝は原則同じ2ネタ（準決勝は2日間で2本）。
//   ・審査：2008年 準決勝敗退者100人が無記名で5点満点（500点）→ 8組をA・Bリーグに分け各リーグ1位が最終決戦 →
//     決勝進出8組が口頭でどちらが良かったかを発表。2009〜2013年 準決勝敗退者100人×10点（1000点）、8組が2本ずつ、
//     2本目は1本目の得点の低い順、2本の合計。2014年 決勝10組、ファーストステージは1対1（5ブロック）を準決勝敗退者
//     101人の投票で、勝った5組がファイナルステージで勝ち残り（暫定王者）方式。2015年から審査員5人×100点（500点）、
//     決勝10組、2017年まではファーストステージ上位5組、2018年から上位3組がファイナルステージ、2本の合計。
//     2018・2019年はファイナリストシークレット制度（決勝当日の生放送で発表）、2020年に廃止。
//     2026年 審査員7人（700点）、大会史上初の敗者復活戦（準決勝敗退25組の上位10組 → 芸人審査員の採点で3組 →
//     国民投票で1組 → 11組目のファイナリスト）。
//   ・シード（2022年の参加規定）：過去の準決勝進出者は2回戦から、過去の決勝進出者は準々決勝から。即席ユニットは1回戦から。
//   ・優勝賞金 1000万円。
//   ・エントリー数：2008 2,146／2009 2,584／2010 3,009／2011 3,026／2012 2,971／2013 2,988（翌年の番組内では2,991）／
//     2014 2,810／2015 2,455／2016 2,510／2019 2,413／2020 1,707／2021 3,015／2022 3,018／2023 3,036／2024 3,139／
//     2025 3,449／2026 3,445。2017・2018年は未確認 → 「約」つきの推定（このゲームの推定値）。準決勝進出：2017年38組、
//     2018年32組、2026年35組（他の年はこのゲームの推定）。
//   ・決勝の放送日：2008/10/5（TBS本社）、2010/9/23、2011/9/23、2012/9/22（準決勝 8/30・31 赤坂BLITZ）、2020/9/26
//     （第1回「お笑いの日」）、2022/10/8、2023/10/21、2024/10/12、2025/10/11、2026/10/17。2020年からTBS「お笑いの日」の中で放送。
//   ・決勝のあとの番組：『キングオブコント20XX 生・大反省会』U-NEXT独占ライブ配信（2024・2025・2026年を確認）、
//     2026年は舞台裏ドキュメンタリー『激闘の1日』もU-NEXT独占配信。『キングオブコントの会』TBS特番（2021・2022・2023年：
//     歴代王者・準優勝組が書き下ろしの新作コントを披露）。
//   ・大会公式のDVD・ツアーは確認できなかった → このゲームではつくらない（王者・ファイナリストの「ベストネタDVD」の
//     オファーは、所属先からの一般的なお仕事として扱う）。2023年以前の反省会番組も確認できない → このゲームでは
//     「打ち上げ」（番組ではない）。2025年以前の密着ドキュメントはこのゲーム内の架空の番組と明記する。
// NOT VERIFIED → generic: 準々決勝の導入年（このゲームでは2009年から）、2009〜2017年の各回戦の細かい日付と会場、
//   2008〜2025年の1回戦の会場の都市（2026年以外は東京・大阪）、各回戦の通過組数（このゲームの目安）。
// Sources: https://king-of-conte.com/about/ ・ https://king-of-conte.com/schedule/ ・ https://secure.yoshimoto.co.jp/kocentry/ ・
//   https://ja.wikipedia.org/wiki/キングオブコント ・ https://natalie.mu/owarai/award/king-of-conte ・
//   https://natalie.mu/owarai/news/283508 （2018年のルール改定）・ https://natalie.mu/owarai/news/694129 （2026年 審査員7名）・
//   https://magazine.fany.lol/287669/ （2026年 敗者復活戦）・ https://www.rbbtoday.com/article/2014/06/30/121335.html （2014年）・
//   https://www.oricon.co.jp/news/57977/full/ （2008年）・ https://x.com/koc_staff/status/1706989939152617570 （2023年 3,036組）・
//   https://www.tvguide.or.jp/feature/ott25100903/ （生・大反省会）・ https://news.mynavi.jp/article/20210611-1902872/ （キングオブコントの会）
//
// PEOPLE: every MC, judge, entrant and champion here is fictional (this game's world). Real songs are not used.

export const KOC_ID = 'koc';
export const FOUNDED = 2008;
export const KOC_NAME = 'キングオブコント';
export const PRIZE = 10000000; // 優勝賞金 1000万円 (real yen)
export const FEE = { combi: 2000, trio: 3000 }; // コンビ ¥2,000 / トリオ以上 ¥3,000 (real yen, paid at the venue)

export const SOURCES = [
  'https://king-of-conte.com/about/',
  'https://king-of-conte.com/schedule/',
  'https://ja.wikipedia.org/wiki/キングオブコント',
  'https://natalie.mu/owarai/award/king-of-conte',
  'https://natalie.mu/owarai/news/283508',
  'https://natalie.mu/owarai/news/694129',
  'https://magazine.fany.lol/287669/',
];

export const edition = (y) => (y >= FOUNDED ? y - FOUNDED + 1 : null);
export const titleOf = (y) => `${KOC_NAME}${y}`;

// ---------------------------------------------------------------- entries (verified; 2017/2018 estimated, 2027+ this world's)
const ENTRIES = { 2008: 2146, 2009: 2584, 2010: 3009, 2011: 3026, 2012: 2971, 2013: 2988, 2014: 2810, 2015: 2455, 2016: 2510, 2019: 2413, 2020: 1707, 2021: 3015, 2022: 3018, 2023: 3036, 2024: 3139, 2025: 3449, 2026: 3445 };
// The entry count of a year: { n, real (verified), approx (an estimate shown with 約) }.
export function entriesOf(y, rnd = 0.5) {
  if (ENTRIES[y]) return { n: ENTRIES[y], real: true, approx: false };
  if (y === 2017) return { n: 2400, real: false, approx: true };
  if (y === 2018) return { n: 2400, real: false, approx: true };
  // later years: this world's own numbers around the 2025-2026 level
  const n = Math.round(3300 + (rnd - 0.5) * 500 + Math.min(10, y - 2026) * 12);
  return { n, real: false, approx: false };
}
export const ENTRY_RECORD = (y) => { let best = 0; for (let k = FOUNDED; k < y; k++) best = Math.max(best, ENTRIES[k] || 0); return best; };

// ---------------------------------------------------------------- rules by year
// mode: 'league' (2008), 'sum2' (2009-2013), 'duel' (2014), 'panel' (2015-)
export function rules(y) {
  const r = { year: y, edition: edition(y), prize: PRIZE, fee: FEE, minMembers: 2, instant: true, seeds: y >= 2022 };
  if (y <= 2008) Object.assign(r, { mode: 'league', voters: 100, per: 5, max: 500, finalists: 8, finalStage: 2, judgeText: '準決勝で敗退した芸人100人が審査（ひとり5点満点・500点満点）', finalText: '8組をAリーグ・Bリーグに分け、各リーグ1位が最終決戦。最終決戦は決勝進出8組がどちらが良かったかを口頭で発表' });
  else if (y <= 2013) Object.assign(r, { mode: 'sum2', voters: 100, per: 10, max: 1000, finalists: 8, finalStage: 8, judgeText: '準決勝で敗退した芸人100人が無記名で審査（ひとり10点満点・1000点満点）', finalText: '8組が2本ずつ披露。2本目は1本目の得点が低い順。2本の合計点で優勝が決まる' });
  else if (y === 2014) Object.assign(r, { mode: 'duel', voters: 101, per: 1, max: 101, finalists: 10, finalStage: 5, judgeText: '準決勝で敗退した芸人101人が「どちらが面白かったか」を投票', finalText: 'ファーストステージは1対1の5ブロック。勝った5組がファイナルステージで勝ち残り方式（暫定王者に挑む）' });
  else if (y <= 2017) Object.assign(r, { mode: 'panel', judges: 5, per: 100, max: 500, finalists: 10, finalStage: 5, judgeText: '審査員5人（ひとり100点満点・500点満点）', finalText: 'ファーストステージ上位5組がファイナルステージへ。2本の合計点で優勝が決まる' });
  else if (y <= 2025) Object.assign(r, { mode: 'panel', judges: 5, per: 100, max: 500, finalists: 10, finalStage: 3, judgeText: '審査員5人（ひとり100点満点・500点満点）', finalText: 'ファーストステージ上位3組がファイナルステージへ。2本の合計点で優勝が決まる' });
  else Object.assign(r, { mode: 'panel', judges: 7, per: 100, max: 700, finalists: 10, finalStage: 3, revival: true, judgeText: '審査員7人（ひとり100点満点・700点満点）', finalText: '敗者復活の1組を加えた11組。ファーストステージ上位3組がファイナルステージへ。2本の合計点で優勝が決まる' });
  r.secret = y === 2018 || y === 2019; // ファイナリストシークレット制度
  r.hasQF = y >= 2009; // (introduction year unverified)
  r.twoNetaSF = y >= 2018; // 準決勝は2日間で2本（決勝と同じ2ネタ）
  r.len = {
    r1: 120,
    r2: y === 2008 ? 180 : y >= 2022 ? 180 : 120,
    qf: y >= 2018 ? 300 : 240,
    sf: y === 2008 ? 180 : y >= 2018 ? 300 : 240,
    final: y === 2008 ? 300 : y >= 2018 ? 300 : 240,
  };
  r.sfCount = y === 2017 ? 38 : y === 2018 ? 32 : y >= 2026 ? 35 : y === 2008 ? 30 : 34;
  r.revivalField = r.revival ? 10 : 0; // 準決勝敗退25組の上位10組
  r.revivalJudges = 60; // 芸人審査員（2026年の報道による）
  r.entries = entriesOf(y);
  r.oowarai = y >= 2020; // TBS「お笑いの日」の中で放送
  r.hanseikai = y >= 2024 ? `${titleOf(y)} 生・大反省会` : null; // U-NEXT 独占ライブ配信
  r.doc = y >= 2026 ? '激闘の1日' : null; // U-NEXT 独占配信の舞台裏ドキュメンタリー
  r.kai = y >= 2021; // キングオブコントの会（TBS特番）
  return r;
}
export const lenText = (sec) => (sec % 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec / 60}分`);

// ---------------------------------------------------------------- the season by year
// Game calendar: a month has 10 days (dom 1..10, ≈ real day / 3). when: [month, dom].
// Venues: { city, hall (null = 「◯◯会場」) }.
const FINAL_DAY = { 2008: [10, 2], 2009: [9, 8], 2010: [9, 8], 2011: [9, 8], 2012: [9, 8], 2013: [9, 8], 2014: [9, 8], 2015: [10, 4], 2016: [10, 1], 2017: [10, 1], 2018: [9, 8], 2019: [9, 7], 2020: [9, 9], 2021: [10, 1], 2022: [10, 3], 2023: [10, 7], 2024: [10, 4], 2025: [10, 4], 2026: [10, 6] };
export const ROUND_IDS = ['r1', 'r2', 'qf', 'sf', 'final'];
export const ROUND_NAME = { r1: '1回戦', r2: '2回戦', qf: '準々決勝', sf: '準決勝', revival: '敗者復活戦', final: '決勝' };
export const CITY_KANA = { 北海道: 'hokkaido', 東京: 'tokyo', 大阪: 'osaka', 愛知: 'aichi', 福岡: 'fukuoka' };

export function schedule(y) {
  const v = (city, hall = null) => ({ city, hall });
  const final = FINAL_DAY[y] || [10, 5];
  if (y <= 2008) {
    return {
      entry: { from: [5, 1], to: [7, 5] },
      r1: [{ when: [7, 7], ...v('東京') }, { when: [7, 8], ...v('大阪') }, { when: [7, 9], ...v('東京') }, { when: [7, 10], ...v('大阪') }],
      r2: [{ when: [8, 4], ...v('東京') }, { when: [8, 5], ...v('大阪') }],
      qf: null,
      sf: [{ when: [9, 2], ...v('大阪') }, { when: [9, 3], ...v('東京') }],
      final: { when: final, ...v('東京', 'TBS放送センター') },
    };
  }
  if (y <= 2014) {
    return {
      entry: { from: [4, 5], to: [6, 1] },
      r1: [{ when: [6, 3], ...v('東京') }, { when: [6, 4], ...v('大阪') }, { when: [6, 6], ...v('東京') }, { when: [6, 8], ...v('大阪') }, { when: [7, 1], ...v('東京') }],
      r2: [{ when: [7, 7], ...v('東京') }, { when: [7, 8], ...v('大阪') }],
      qf: [{ when: [8, 4], ...v('東京') }, { when: [8, 5], ...v('大阪') }],
      sf: [{ when: [8, 10], ...v('東京', y === 2012 ? '赤坂BLITZ' : null) }, { when: [9, 1], ...v('東京', y === 2012 ? '赤坂BLITZ' : null) }],
      final: { when: final, ...v('東京', 'TBS放送センター') },
    };
  }
  if (y <= 2017) {
    return {
      entry: { from: [5, 1], to: [6, 10] },
      r1: [{ when: [7, 1], ...v('東京') }, { when: [7, 2], ...v('大阪') }, { when: [7, 4], ...v('東京') }, { when: [7, 6], ...v('大阪') }, { when: [7, 8], ...v('東京') }],
      r2: [{ when: [8, 1], ...v('東京') }, { when: [8, 2], ...v('大阪') }],
      qf: [{ when: [8, 6], ...v('東京') }, { when: [8, 7], ...v('大阪') }],
      sf: [{ when: [9, 2], ...v('東京') }, { when: [9, 3], ...v('東京') }],
      final: { when: final, ...v('東京', 'TBS放送センター') },
    };
  }
  if (y <= 2020) {
    return {
      entry: { from: [5, 1], to: [6, 10] },
      r1: [{ when: [7, 1], ...v('東京') }, { when: [7, 2], ...v('大阪') }, { when: [7, 4], ...v('東京') }, { when: [7, 5], ...v('大阪') }, { when: [7, 7], ...v('東京') }],
      r2: [{ when: [7, 9], ...v('東京') }, { when: [7, 10], ...v('大阪') }],
      qf: [{ when: [8, 4], ...v('東京') }, { when: [8, 5], ...v('大阪') }],
      sf: [{ when: [8, 9], ...v('東京') }, { when: [8, 10], ...v('東京') }],
      final: { when: final, ...v('東京', 'TBS放送センター') },
    };
  }
  const late = y >= 2025;
  const five = y >= 2026; // 2026: 北海道・東京・大阪・愛知・福岡
  const osakaSmall = late ? '心斎橋PARCO SPACE14' : null;
  return {
    entry: { from: [5, 5], to: [6, 10] },
    r1: five
      ? [{ when: [7, 3], ...v('北海道') }, { when: [7, 4], ...v('東京') }, { when: [7, 4], ...v('大阪', osakaSmall) }, { when: [7, 5], ...v('大阪', osakaSmall) }, { when: [7, 6], ...v('東京') }, { when: [7, 7], ...v('愛知') }, { when: [7, 7], ...v('福岡') }, { when: [7, 8], ...v('東京') }]
      : [{ when: [7, 3], ...v('東京') }, { when: [7, 4], ...v('大阪', osakaSmall) }, { when: [7, 5], ...v('東京') }, { when: [7, 6], ...v('大阪', osakaSmall) }, { when: [7, 8], ...v('東京') }],
    r2: [{ when: [8, 1], ...v('東京') }, { when: [8, 2], ...v('大阪', osakaSmall) }],
    qf: [{ when: [8, 5], ...v('東京', late ? '渋谷区文化総合センター大和田 さくらホール' : null) }, { when: [8, 6], ...v('大阪', late ? 'COOL JAPAN PARK OSAKA TTホール' : null) }],
    sf: [{ when: [9, 1], ...v('東京', late ? 'ニッショーホール' : null) }, { when: [9, 2], ...v('東京', late ? 'ニッショーホール' : null) }],
    final: { when: final, ...v('東京', 'TBS放送センター') },
  };
}
export const hallText = (venue) => (venue ? venue.hall || `${venue.city}会場` : '');
export const whenKey = (w) => (w ? w[0] * 100 + w[1] : 0);

// Approximate round sizes (this game's 目安, not verified except the SF count / the final).
export function roundPlan(y) {
  const R = rules(y);
  const N = R.entries.n;
  const sf = R.sfCount;
  const qf = R.hasQF ? Math.round(sf * 5.2) : 0;
  const r2 = Math.round((R.hasQF ? qf : sf) * 4.2);
  return { r1: N, r2, qf, sf, final: R.finalists, passR1: r2 / N, passR2: (R.hasQF ? qf : sf) / r2, passQF: R.hasQF ? sf / qf : 0, passSF: R.finalists / sf };
}

// ---------------------------------------------------------------- travel (real yen, round trip, from Tokyo / Osaka)
const FARE = {
  tokyo: { 東京: 400, 大阪: 28000, 北海道: 34000, 愛知: 21000, 福岡: 42000 },
  osaka: { 東京: 28000, 大阪: 400, 北海道: 44000, 愛知: 11000, 福岡: 31000 },
};
export const fareOf = (home, city) => (FARE[home] || FARE.tokyo)[city] ?? 20000;
export const TRAVEL_STAMINA = { 東京: 2, 大阪: 8, 北海道: 10, 愛知: 6, 福岡: 10 };

// ---------------------------------------------------------------- fictional people of this world
// MC / 進行 (TBS announcers) / 審査員 — all fictional. taste: which part of a conte they weigh.
export const TASTES = {
  kousei: { name: '構成', part: 'neta', note: '展開と伏線回収' },
  engi: { name: '演技', part: 'execution', note: '役の入り方・芝居のうまさ' },
  hassou: { name: '発想', part: 'neta', note: '設定の新しさ' },
  warai: { name: '笑いの量', part: 'crowd', note: '爆発力' },
  sekai: { name: '世界観', part: 'presence', note: 'キャラと空気' },
  ma: { name: '間', part: 'timing', note: 'テンポと間' },
};
export const MC = (y) => ({
  main: { name: '宝田 ジョウ', title: '司会（コンビ「シャチホコ劇場」）', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#d4a83a' } },
  sub: y <= 2016
    ? { name: '白石 ユカリ', title: '進行（TBSアナウンサー）', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#f2f2f2', bottom: '#2a3560', skirt: true, jacket: true } }
    : { name: '森園 ナツキ', title: '進行（TBSアナウンサー）', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#e8d6ff', bottom: '#2a2430', skirt: true } },
  revival: { name: '三日月ランドリー', title: '敗者復活戦MC（コンビ）', look: { hair: 'spiky', hairColor: 'orange', skin: 'fair', top: '#ff8a3d', bottom: '#3a4a7a' } },
});
const JUDGE_POOL = [
  { id: 'tsurumaki', name: '鶴巻 ゲンジ', title: '元「月光ベーカリー」', taste: 'kousei', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#22262e', bottom: '#22262e', jacket: true, glasses: true } },
  { id: 'saotome', name: '早乙女 タカシ', title: 'トリオ「赤ちょうちん号」', taste: 'engi', look: { hair: 'bald', hairColor: 'black', skin: 'fair', top: '#3a2a4a', bottom: '#1e1e26', jacket: true } },
  { id: 'mikoshiba', name: '御子柴 レン', title: 'コンビ「ナポリタン警察」', taste: 'hassou', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#1e3a5a', bottom: '#1e1e26', jacket: true } },
  { id: 'gondawara', name: '権田原 ノボル', title: 'コンビ「おでん大臣」', taste: 'warai', look: { hair: 'afro', hairColor: 'black', skin: 'tan', top: '#5a2a2a', bottom: '#1e1e26', jacket: true, beard: true } },
  { id: 'kirishima', name: '霧島 サトコ', title: 'コンビ「満月スリッパ」', taste: 'sekai', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#2a2a3a', bottom: '#2a2a3a', skirt: true, jacket: true } },
];
// The 2026 additions are this world's own former champions (resolved from the history: champ of a given year).
const JUDGE_NEW_2026 = [{ id: 'champA', fromChamp: 2019, taste: 'ma' }, { id: 'champB', fromChamp: 2022, taste: 'engi' }];
// judges(y, champOf) → [{ name, title, taste, look }] — champOf(year) → { unit, member } (fictional) or null.
export function judgesOf(y, champOf) {
  const R = rules(y);
  if (R.mode !== 'panel') return [];
  const out = JUDGE_POOL.slice(0, 5).map((j) => ({ ...j }));
  if (R.judges >= 7) {
    for (const nj of JUDGE_NEW_2026) {
      const c = champOf ? champOf(nj.fromChamp) : null;
      const name = c && c.member ? c.member : nj.fromChamp === 2019 ? '雨宮 トオル' : '浅葱 ケイ';
      const unit = c && c.unit ? c.unit : nj.fromChamp === 2019 ? 'ペンギン不動産' : 'ゆでたまご同盟';
      out.push({ id: nj.id, name, title: `${nj.fromChamp}年王者「${unit}」`, taste: nj.taste, look: lookFor(name, true) });
    }
  }
  return out;
}

// Rival units (this world). type: 'combi' | 'trio' | 'quartet'. All names are invented for this game.
export const UNIT_NAMES = [
  'ペンギン不動産', 'ゆでたまご同盟', '月光ベーカリー', 'ナポリタン警察', 'おでん大臣', '満月スリッパ', 'シャチホコ劇場', '三日月ランドリー',
  'カニカマ王国', 'ホチキス兄弟', '真夜中の回覧板', 'こたつ探検隊', 'ガラパゴス商店', 'ちくわ会議', 'ミルフィーユ団地', '半熟マシーン',
  '七輪クラブ', 'ふとん乾燥機', '午前二時の鳩', 'マカロニ艦隊', '湯けむり探偵', '銀河ドーナツ', 'まくら投げ部', 'ツナマヨ紳士',
  '駄菓子屋ロック', 'ヘアピンカーブ', 'のど自慢荘', '粉もん倶楽部', 'みそ汁バンド', '旅館やまびこ', '豆電球', 'ふくろう便',
  '夕立ストア', 'からあげ研究所', 'パセリの気持ち', '三角コーナー', '靴下迷子', 'サボテン紳士', 'かき氷前線', '寝ぐせ番長',
  '終電ダッシュ', '半額シール', 'すきま風', 'メガネ橋', '畳の目', 'のれん分け', '換気扇', 'たまご焼き器',
  'ひなたぼっこ組', '置き配', 'コインランドリー部', '紙ふうせん座', '赤ちょうちん号', 'ねずみ花火団', 'ポンコツ探偵社', 'ゆうぐれ商会',
  'メロンパン協会', '夜明けのタマゴ', 'ペンキ塗りたて', 'ハンガー男爵', '路地裏オーケストラ', 'あさり大使', 'ドアノブ兄弟', '風呂上がり',
  '団地妻ズ', '学ラン紳士', 'おしぼり商会', '回覧板二号', 'ぬか床', '蛍光ペン', 'からくり長屋', '電気毛布',
  '昼下がりボクシング', '時刻表マニア', '山びこ書房', 'くず餅', 'ピンポンダッシュ', '朝顔観察', '油揚げ', 'ガムテープ',
  '軒下ブルース', '日めくりカレンダー', '天津飯店', '二重あご', '星空ポスト', '金魚すくい部', 'アルミホイル', '綿あめ大将',
];
// names already taken by this world's MC / judges (not entrants)
const RESERVED = new Set(['月光ベーカリー', 'ナポリタン警察', 'おでん大臣', '満月スリッパ', 'シャチホコ劇場', '三日月ランドリー', '赤ちょうちん号']);
export const POOL_NAMES = UNIT_NAMES.filter((n) => !RESERVED.has(n));
// three- or four-person units (by name), the rest are コンビ
const TRIOS = new Set(['赤ちょうちん号', 'こたつ探検隊', 'ミルフィーユ団地', 'まくら投げ部', 'みそ汁バンド', '旅館やまびこ', 'ひなたぼっこ組', 'コインランドリー部', '路地裏オーケストラ', '団地妻ズ', 'からくり長屋', '金魚すくい部', '紙ふうせん座', 'ねずみ花火団']);
const QUARTETS = new Set(['路地裏オーケストラ', 'ねずみ花火団']);
export const unitType = (name) => (QUARTETS.has(name) ? 'quartet' : TRIOS.has(name) ? 'trio' : 'combi');
export const membersOf = (type) => (type === 'quartet' ? 4 : type === 'trio' ? 3 : 2);

// Filler names for the crowded 予選 lists (amateurs, 即席ユニット, 学生コンビ …): word + word.
const FILL_A = ['ちびっこ', 'まんぷく', 'ほろ酔い', '月曜', 'ふわふわ', '真冬の', 'じわじわ', 'しょっぱい', '眠れない', '青い', 'まるい', 'となりの', '週末', '平熱', 'あったか', 'ちゃっかり', '四畳半', '二軍', '仮免', '夜行', '下町', 'はみだし', 'ぽんこつ', '雨の日', '三丁目', '放課後', '素人', '社会人', '大学', '深夜'];
const FILL_B = ['ブラザーズ', 'クラブ', '劇団', 'カンパニー', '商店', '同好会', 'ガールズ', 'ボーイズ', 'ファクトリー', 'ジャンクション', '食堂', '研究会', '工房', 'ハウス', 'ラボ', 'ポケット', '部', '組', '座', 'ズ', '大作戦', 'シアター', 'ストリート', 'バス', 'ポスト'];
export function fillerName(r) {
  const a = FILL_A[Math.floor(r() * FILL_A.length)];
  const b = FILL_B[Math.floor(r() * FILL_B.length)];
  return a + b;
}
const SUR = ['佐伯', '大槻', '久保田', '三好', '早瀬', '吉岡', '香川', '柏木', '桑原', '浜口', '真壁', '岩城', '永井', '宮前', '堤', '小此木', '日比野', '茅野', '鳴海', '戸張', '雨宮', '浅葱', '和泉', '新見', '瀬尾', '中園', '杉浦', '笹倉', '片桐', '仁科'];
const GIV = ['タクミ', 'ユウ', 'ケンタ', 'ショウ', 'リョウ', 'ダイキ', 'ハヤト', 'ミノル', 'サトシ', 'コウジ', 'アキ', 'ナオ', 'マコト', 'ジュン', 'トオル', 'ケイ', 'シン', 'ヒカル', 'ノゾミ', 'ユキ', 'カオル', 'ツヨシ', 'ゴロウ', 'マサル'];
export function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function memberNames(unitName, n = 2) {
  const r = rngOf(hashStr('m:' + unitName));
  const out = [];
  for (let i = 0; i < n; i++) out.push(`${SUR[Math.floor(r() * SUR.length)]} ${GIV[Math.floor(r() * GIV.length)]}`);
  return out;
}
const TOPS = ['#d64161', '#3f8a3a', '#2f6fd0', '#ffd23f', '#8a5ac8', '#ff8a3d', '#f2f2f2', '#3b3f48', '#5fd7ff', '#c0452f', '#2a3560', '#ff7eb6'];
const HAIRS = ['short', 'spiky', 'bob', 'slick', 'afro', 'cap', 'bald', 'long'];
const HCOL = ['black', 'brown', 'black', 'blonde', 'orange', 'silver', 'black'];
// A stable look for a fictional person.
export function lookFor(name, suit = false) {
  const r = rngOf(hashStr('l:' + name));
  const hair = HAIRS[Math.floor(r() * HAIRS.length)];
  const look = { hair, hairColor: HCOL[Math.floor(r() * HCOL.length)], skin: ['fair', 'light', 'tan'][Math.floor(r() * 3)], top: TOPS[Math.floor(r() * TOPS.length)], bottom: ['#3a4a7a', '#1e1e26', '#5a4a3a', '#2a3560'][Math.floor(r() * 4)] };
  if (hair === 'cap') look.hat = TOPS[Math.floor(r() * TOPS.length)];
  if (r() < 0.25) look.glasses = true;
  if (suit) Object.assign(look, { top: '#22262e', bottom: '#22262e', jacket: true, tie: TOPS[Math.floor(r() * TOPS.length)] });
  return look;
}
export const AGENCY_NAMES = ['よしもと', '松竹芸能', 'グレープカンパニー', 'ホリプロコム', 'フリー', 'アマチュア'];

// ---------------------------------------------------------------- コント: sets, props, cues
// Conte settings (matched to a script's setting/theme by keyword; else picked by hash).
export const CONTE_SETS = [
  { id: 'konbini', name: 'コンビニ', kw: /コンビニ|レジ|店員/, props: ['レジカウンター', 'バーコードリーダー', '店のエプロン', '商品のおにぎり'], se: '入店チャイム', light: '白い蛍光灯の明かり', look: 'shop' },
  { id: 'kouban', name: '交番', kw: /交番|警察|おまわり|刑事/, props: ['事務机', '警察官の帽子', '落とし物の財布', '町内の地図'], se: '自転車のブレーキ音', light: '夜の街灯', look: 'office' },
  { id: 'byouin', name: '病院の診察室', kw: /病院|医者|診察|看護/, props: ['白衣', '聴診器', '丸イス', 'カルテ'], se: '呼び出しのアナウンス', light: '白い明かり', look: 'clinic' },
  { id: 'kyoushitsu', name: '放課後の教室', kw: /学校|教室|先生|生徒|放課後/, props: ['机と椅子', '学生カバン', 'チョーク', '黒板消し'], se: 'チャイム', light: '夕方の西日', look: 'school' },
  { id: 'mensetsu', name: '面接会場', kw: /面接|会社|上司|部長|社長/, props: ['長机', '履歴書', 'パイプ椅子', 'ネクタイ'], se: 'ノックの音', light: 'オフィスの明かり', look: 'office' },
  { id: 'onsen', name: '温泉旅館', kw: /旅館|温泉|女将/, props: ['浴衣', '手ぬぐい', 'ちゃぶ台', '卓球のラケット'], se: '鹿威しの音', light: '暖色の明かり', look: 'ryokan' },
  { id: 'uchuu', name: '宇宙船のブリッジ', kw: /宇宙|ロケット|未来|ロボット/, props: ['操縦桿', 'ヘルメット', 'ボタンだらけのパネル'], se: '警報音', light: '青い照明', look: 'space' },
  { id: 'soba', name: '町のそば屋', kw: /そば|ラーメン|定食|食堂|寿司/, props: ['どんぶり', '出前のおかもち', 'のれん'], se: '電話のベル', light: '昼の店内', look: 'shop' },
  { id: 'kekkon', name: '結婚式の控室', kw: /結婚|披露宴|式場/, props: ['スタンドマイク', 'ブーケ', 'タキシード'], se: '拍手の音', light: '華やかな明かり', look: 'party' },
  { id: 'taxi', name: 'タクシーの車内', kw: /タクシー|車|運転/, props: ['椅子2脚', 'ハンドル', '料金メーター'], se: 'ウインカーの音', light: '流れる街の明かり', look: 'car' },
  { id: 'gym', name: 'スポーツジム', kw: /ジム|筋トレ|トレーナー/, props: ['ダンベル', 'ヨガマット', 'タオル'], se: 'ランニングマシンの音', light: '明るい照明', look: 'gym' },
  { id: 'torishirabe', name: '取調室', kw: /取調|犯人|容疑/, props: ['机', 'デスクライト', 'カツ丼'], se: '時計の秒針', light: 'スポットライト1灯', look: 'dark' },
  { id: 'koen', name: '夜の公園', kw: /公園|ベンチ|散歩/, props: ['ベンチ', '缶コーヒー', '外灯'], se: '虫の声', light: '外灯のスポット', look: 'park' },
  { id: 'fudousan', name: '不動産屋', kw: /不動産|物件|内見/, props: ['カウンター', '間取り図', '鍵の束'], se: '自動ドアの音', light: '店内の明かり', look: 'office' },
  { id: 'kaisha', name: '会議室', kw: /会議|プレゼン|企画/, props: ['ホワイトボード', '資料の束', 'プロジェクター'], se: 'ノックの音', light: 'オフィスの明かり', look: 'office' },
];
export function setFor(neta) {
  const s = neta ? `${neta.setting || ''} ${neta.theme || ''} ${neta.title || ''}` : '';
  const hit = CONTE_SETS.find((c) => c.kw.test(s));
  if (hit) return hit;
  return CONTE_SETS[hashStr(s || 'x') % CONTE_SETS.length];
}
// Conte titles for rivals (this world's).
export const CONTE_TITLES = ['引っ越し業者', '最後の晩餐会', '迷子センター', '社員旅行', '健康診断', '居酒屋の新人', '卒業式の前日', '張り込み', '結婚の挨拶', '謝罪会見', '人生ゲーム', '天気予報士', '家庭教師', 'ヒーローショー', '占い館', '合コン', '探偵事務所', '修学旅行の夜', 'ドライブスルー', '新幹線の隣の席', '鍵屋', 'クレーム係', '銭湯', '献血', '入学説明会', '催眠術', 'カーナビ', 'ペットショップ', '取材', '最終面接', '美容室', '野球部の部室', '遺言', 'お見合い', '宝くじ売り場', '自動販売機', '歯医者', '動物園の飼育員', '運転免許センター', '夜逃げ'];
// 音響・照明のきっかけ表 (cue sheet) choices.
export const CUE_ROWS = [
  { key: 'start', label: '始まり方', opts: ['板付き（暗転中に位置について明転）', '明転してから袖から登場'] },
  { key: 'se', label: '最初のSE', opts: ['あり（設定の音）', 'なし（無音で始める）'] },
  { key: 'bgm', label: 'BGM', opts: ['使わない', '場面転換で流す'] },
  { key: 'light', label: '照明', opts: ['全体の明かり（地明かり）', '場面に合わせた色の明かり'] },
  { key: 'end', label: '暗転のきっかけ', opts: ['オチのセリフの直後', 'ツッコミのあと一拍おいて'] },
];
// The cue sheet that suits a script (stable by the script's id/title).
export function idealCues(neta) {
  const r = rngOf(hashStr('cue:' + ((neta && (neta.id + neta.title)) || 'x')));
  return { start: r() < 0.7 ? 0 : 1, se: r() < 0.65 ? 0 : 1, bgm: r() < 0.8 ? 0 : 1, light: r() < 0.55 ? 0 : 1, end: r() < 0.6 ? 0 : 1 };
}

// ---------------------------------------------------------------- 審査コメント (concrete 実力不足 reasons)
export const STAT_NOTES = {
  neta: '台本の構成が一本調子。中盤から展開がない',
  boke: 'ボケの数が少なく、ひとつひとつが弱い',
  tsukkomi: 'ツッコミが状況を説明しているだけで、笑いを増幅できていない',
  ma: '間が詰まりすぎていて、客席が笑うのを待てていない',
  voice: '声が後ろの席まで届いていない。滑舌でオチのセリフが聞き取れなかった',
  act: '演技が「セリフを言っているだけ」に見える。役に入りきれていない',
  hassou: 'どこかで見た設定。コントの入り口に新しさがない',
  wagei: '会話が平板で、言葉の選び方に工夫がない',
  dokyo: '緊張で目線が泳いでいた。客席を見られていない',
  chara: '登場人物のキャラクターが薄く、記憶に残らない',
  adlib: '客席の反応に合わせる余裕がなかった',
  mane: '人物の特徴のつかみ方が甘い',
};
export const PART_NOTES = {
  tsukami: '最初の30秒で「どこで・誰が」が伝わらない（ツカミが弱い）',
  overtime: (sec, lim) => `尺オーバー：制限時間${lenText(lim)}を${sec}秒こえた`,
  cutoff: (lim) => `制限時間${lenText(lim)}で強制暗転。オチまでたどり着けなかった`,
  flubs: (n) => `噛みが${n}回。テンポが途切れた`,
  blanks: 'セリフが飛んで、数秒の空白ができた',
  crowd: '客層に合わない題材だった（平日昼の回は年配のお客さんが多い）',
  props: '小道具が客席から見えにくく、何をしているのか伝わらなかった',
  props_lost: '小道具の不備で、見せ場の段取りが崩れた',
  cue: '音響・照明のきっかけがずれて、オチの直後に間が空いた',
  position: '立ち位置が照明から外れて、表情が見えなかった',
  harmony: '二人の呼吸がずれていた（ネタ合わせ不足）',
  fresh: '同じネタを前の年にも見た、という声があった',
};

// ---------------------------------------------------------------- キャッチコピー (finalists)
const COPY_TPL = [
  (u) => `結成${u.yrs}年目の職人`, (u) => `${u.agency}の秘密兵器`, () => '準決勝常連、ついに決勝へ', () => 'コントの申し子', () => '劇場の主（ぬし）',
  () => '怪演の二人', () => '静かなる狂気', () => '最強の会話劇', () => '設定の魔術師', () => '笑いの総合格闘家', () => '下北沢の怪物', () => '大阪からの刺客',
  () => '誰も見たことのない入り口', () => 'たった一つの狂気', () => '日常をこじらせる天才', () => '伏線回収の鬼', () => '令和のコント職人',
];
const COPY_TRIO = ['トリオの完成形', '三人だから見える景色', '最強トリオ', '三位一体の暴走'];
export function catchcopyFor(u, r) {
  if (u.firstFinal && r() < 0.35) return '初出場で決勝の衝撃';
  if (u.type === 'trio' && r() < 0.5) return COPY_TRIO[Math.floor(r() * COPY_TRIO.length)];
  if (u.yrs >= 15 && r() < 0.5) return `結成${u.yrs}年、悲願の頂へ`;
  if (u.yrs <= 2 && r() < 0.5) return `結成${Math.max(1, u.yrs)}年目の超新星`;
  if (u.prevFinals >= 2 && r() < 0.6) return `${u.prevFinals + 1}度目の決勝、今年こそ`;
  return COPY_TPL[Math.floor(r() * COPY_TPL.length)](u);
}

// ---------------------------------------------------------------- news (this world's KOC; ≥ 30 unique lines)
// Each is (d) => text, d = { y, ed, n, approx, record, unit, champ, runner, score, sfCount, finalists, judges, mc, round, city, me }.
export const NEWS = {
  open: [
    (d) => `『${titleOf(d.y)}』開催決定！エントリー受付スタート。プロ・アマ問わず、2人以上のユニットなら誰でも出られるコント日本一決定戦。`,
    (d) => `第${d.ed}回『${KOC_NAME}』のエントリーが始まった。優勝賞金は1000万円。即席ユニットでの出場もOK。`,
  ],
  first: [(d) => `TBSが新しい賞レース『${KOC_NAME}』を創設。コントだけで日本一を決める大会で、第1回の決勝は準決勝で敗れた芸人100人が審査するという。`],
  closing: [(d) => `『${titleOf(d.y)}』エントリー締切が迫る。締切後の受付はない。`],
  closed: [
    (d) => `『${titleOf(d.y)}』エントリー締切。総エントリーは${d.approx ? '約' : ''}${d.n.toLocaleString('ja-JP')}組。`,
    (d) => `『${titleOf(d.y)}』エントリー数が史上最多の${d.n.toLocaleString('ja-JP')}組に。これまでの最多は${d.record.toLocaleString('ja-JP')}組だった。`,
  ],
  r1start: [
    (d) => `『${titleOf(d.y)}』予選1回戦が開幕。持ち時間は${d.len}。会場の楽屋は小道具の段ボールであふれかえった。`,
    (d) => `KOC1回戦、${d.city}会場からスタート。セットは椅子と机くらい、あとは演技とアイデアの勝負。`,
  ],
  r2: [
    (d) => `KOC2回戦の組み合わせが決定。過去の準決勝進出組もこの2回戦から登場する。`,
    (d) => `KOC2回戦、通過ラインは「笑いの量」だけでは足りないという声。審査は設定の新しさも見ている、と関係者。`,
  ],
  qf: [
    (d) => `KOC準々決勝、ここから持ち時間は${d.len}。前年のファイナリストも登場し、会場は満員。`,
    (d) => `KOC準々決勝の配信チケットが好調。「予選のほうがおもしろい」という熱心なファンも。`,
  ],
  sf: [
    (d) => `『${titleOf(d.y)}』準決勝進出${d.sfCount}組が決定。初の準決勝進出組も多く、顔ぶれが大きく入れ替わった。`,
    (d) => d.y >= 2018 ? `KOC準決勝は2日間で2本。決勝と同じ2本のネタで勝負する。` : `KOC準決勝、各組とも勝負ネタを持ち込む。`,
  ],
  finalists: [
    (d) => `『${titleOf(d.y)}』決勝進出${d.finalists}組が決定！初めての決勝進出は${d.newcomers}組。`,
    (d) => `KOC決勝進出者発表会見。「去年の悔しさを晴らしたい」とファイナリストたち。`,
  ],
  secret: [(d) => `今年のKOCは決勝進出者を当日まで明かさない「ファイナリストシークレット制度」。誰が決勝に進んだかは、生放送で発表される。`],
  judges: [
    (d) => `『${titleOf(d.y)}』決勝の審査員が決定。${d.judges}。`,
    (d) => `KOC決勝の審査は${d.judgeText}。`,
  ],
  revival: [
    (d) => `『${titleOf(d.y)}』で大会史上初の敗者復活戦。準決勝で敗れた25組のうち上位10組が、決勝の11組目を争う。`,
    (d) => `KOC敗者復活戦、決勝進出の1組は芸人審査員の採点で3組に絞り、最後は国民投票で決まる。`,
  ],
  final: [
    (d) => `今夜『${titleOf(d.y)}』決勝。${d.oowarai ? 'TBS「お笑いの日」のクライマックスとして' : 'TBS系で'}生放送。`,
    (d) => `KOC決勝の出番順が決定。トップバッターは「${d.first}」。`,
  ],
  champion: [
    (d) => `第${d.ed}代キングオブコント王者に「${d.champ}」！${d.score ? `合計${d.score}点。` : ''}${d.n ? `${d.n.toLocaleString('ja-JP')}組の頂点に立った。` : ''}`,
    (d) => `KOC準優勝は「${d.runner}」。「来年は必ず獲る」と涙。`,
    (d) => `新キング「${d.champ}」、一夜明けて仕事のオファーが殺到。「電話が鳴りやまない」とマネージャー。`,
  ],
  after: [
    (d) => d.hanseikai ? `『${d.hanseikai}』で、ファイナリストたちが本音トーク。「あの点数はいまでも納得してない」` : `KOC決勝の打ち上げは朝まで。ファイナリストたちの健闘をたたえあった。`,
    (d) => `KOC決勝の放送から一夜、SNSでは「${d.champ}」のコントの名ゼリフがトレンド入り。`,
    (d) => `歴代KOC王者の「その後」：王者の多くがコント番組やドラマで活躍の場を広げている。`,
  ],
  kai: [(d) => `TBS特番『キングオブコントの会』開催決定。歴代王者・準優勝組が書き下ろしの新作コントを披露する。`],
  me: {
    entry: (d) => `${d.me}が『${titleOf(d.y)}』にエントリー。エントリーナンバーは${d.no}。`,
    r1pass: (d) => `KOC1回戦、${d.me}が通過。「2分で世界をつくれた」と手応え。`,
    qfpass: (d) => `KOC準々決勝、${d.me}が準決勝進出！関係者「今年の台風の目」。`,
    sfpass: (d) => `${d.me}、KOC初の決勝進出！${d.firstTime ? 'キャッチコピーは「' + d.copy + '」。' : ''}`,
    champion: (d) => `【速報】第${d.ed}代キングオブコント王者は${d.me}！${d.score}点で${d.n.toLocaleString('ja-JP')}組の頂点に。`,
    runner: (d) => `KOC決勝、${d.me}は${d.place}位。審査員「来年が楽しみな2組のうちの1組」。`,
    revival: (d) => `KOC敗者復活戦、国民投票で${d.me}が決勝へ！`,
    dvd: (d) => `${d.me}のベストネタDVDが発売。KOCで披露したコントも収録。`,
    doc: (d) => `${d.doc}：${d.me}の決勝の一日に密着。`,
  },
};

// ---------------------------------------------------------------- lines (staff, partner, MC)
export const STAFF = {
  uketsuke: { name: '受付スタッフ', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#1e1e26', bottom: '#1e1e26', skirt: true } },
  butai: { name: '舞台監督', look: { hair: 'cap', hat: '#1e1e26', hairColor: 'black', skin: 'tan', top: '#1e1e26', bottom: '#1e1e26' } },
  onkyo: { name: '音響スタッフ', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#3b3f48', bottom: '#1e1e26', glasses: true } },
  shoumei: { name: '照明スタッフ', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#2a2d36', bottom: '#1e1e26' } },
  ad: { name: 'AD', look: { hair: 'cap', hat: '#c62f3a', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#3a4a7a' } },
  manager: { name: 'マネージャー', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2e3140', bottom: '#2e3140', jacket: true, tie: '#3a6fd8', glasses: true } },
  producer: { name: 'TBSのプロデューサー', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#22262e', bottom: '#22262e', jacket: true, glasses: true } },
  writer: { name: '構成作家', look: { hair: 'afro', hairColor: 'black', skin: 'fair', top: '#5a6f8a', bottom: '#3b3f48', glasses: true } },
};
