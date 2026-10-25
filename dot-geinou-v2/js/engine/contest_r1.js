// R-1ぐらんぷり / R-1グランプリ — ひとり芸日本一決定戦の完全再現 (owner: E3). State st.r1, public g.r1().
// The engine (season, rounds, scenes) is r1_flow.js; this file is the contest's real rules by era, its texts and news.
//
// VERIFIED (WebSearch, 2026-10; ja.wikipedia R-1グランプリ, r-1gp.com / note.com/r_1gp, お笑いナタリー, ORICON, マイナビニュース,
// デイリー, ktv.jp/r-1, FANY Magazine, weblio, atwiki):
//  - 主催 吉本興業・関西テレビ. 2002年創設 (第1回 2002, 351人エントリー, 決勝12人の一発勝負, 座布団の上で落語スタイルの決まり —
//    「R」は落語のR. その決まりは第2回から廃止). 第2回は2004年 (2003年は開催なし: 第13回=2015 … 第19回=2021 … 第24回=2026).
//  - 第2回まで関西ローカル・優勝賞金100万円 → 全国放送化とともに500万円 (2025・2026 も500万円). 放送: カンテレ・フジテレビ系 (2024・2026: 18:30〜生放送).
//  - 名称: 2021年 (第19回) に「R-1ぐらんぷり」→「R-1グランプリ」(ロゴ刷新). (BRIEF4 said 2016; the sources say 2021 — 2021 is used.)
//  - 出場資格: 2020年まで プロ・アマ・事務所不問. 2021–2023: プロは芸歴10年以内 (2021: 2010年1月1日以降に活動開始, 養成所・休止期間は除く),
//    アマチュアは出場10回目以内. 2024年から芸歴制限を撤廃 (2026: プロ・アマ・事務所・芸歴不問). 2021年は芸歴11年以上向けの
//    「R-1ぐらんぷりクラシック」が別に行われた.
//  - 参加費: 1組2,000円 (2021の募集要項). 他の年は未確認のため同額で扱う. 提出物: 専用エントリー用紙と写真（胸から上・L版）;
//    2026: 公式エントリーフォーム or 専用用紙の郵送, 受付 2025-10-01〜10-31, 重複・再エントリー不可.
//  - ネタ時間: 2021 = 1回戦・2回戦 2分 / 準々決勝・準決勝・敗者復活・決勝 3分. 2024 決勝 3分→4分. 2026 = 1回戦2分・2回戦3分・準々決勝以降4分.
//    2026: 前回・前々回の準々決勝進出者は1回戦免除 (シード).
//  - 2026 日程: 東京1回戦 11〜12月 (シダックスカルチャーホール ほか), 大阪1回戦 11月 (インディペンデントシアター2nd), 2回戦 1月,
//    準々決勝 1月下旬 (122人), 準決勝 2月, 決勝 3月21日. エントリー 6,171人 (史上最多); 2025: 5,511人.
//  - 決勝: 2010 上位3人がファイナルステージ (3位→2位→1位の順). ブロック制: 持ち点3の振り分け, ファイナルは2014年まで1人1票・2015年から
//    ブロックと同じ方式. お茶の間（dボタン）投票 2014〜 (2019年を除く). 復活ステージ: 2015–2017 上位3人, 2018–2019 2人, 2020〜 1人, 2024年に廃止.
//    2021 決勝 3ポイント振り分け → 100点満点の採点に. 2024: 9人, 審査員5人×100点 → 上位3人 → 決選投票. 2025・2026: 9人, 審査員7人.
//    第3回 (2005) 審査員5人.
// NOT VERIFIED (kept generic, said so here): 2005–2020 の準々決勝の有無・予選の人数, 2005–2012 の決勝の人数, 各年の審査員の人数 (2005, 2024–26 以外),
//   古い大会の日程の月 (冬に予選・2〜3月に決勝として扱う), 決勝会場の名前 (「決勝スタジオ」), 平均視聴率など. DVD・公式の後番組は扱わない
//   (確認できない). 打ち上げはこのゲームの独自シーン. Entry counts of unverified years are this game's world (shown as 約).
// Everyone in the contest (entrants, judges, MCs, staff, past champions) is fictional. The tagline 「一番面白い、一人が決まる。」 is the
// contest's own 2026 slogan (a phrase, not a person).
import { Game } from './game.js';
import { registerContest } from './contests.js';
import { registerRegular, PEOPLE, isKansai } from './life.js';
import { LOOKS } from './sprites.js';
import { registerItem } from './state.js';
import { clamp } from './util.js';
import {
  has, safe, num, n0, nameGender, realYen, plainYen, toInternal, rngOf, gauss, rint, pickR, cdate, dateText, dateTextY, pinName,
  randomLook, actInfo, agencyNames, geireki, playerAge, statOf, sendOffer, runKitMorning, kitMorning, devWord, shortfallReasons, performAct,
} from './r1_kit.js';
import { makeContest, registerContestApp, fmtLen } from './r1_flow.js';
import { stage, unstage, card, T, para, R, box, alpha, drawBig, faceAt, THEMES, sizeFor } from './r1_scenes.js';

// ================================================================ the rules of each year
const CACHE = {};
const VENUE = {
  tokyo: (Y, rid) => (Y >= 2026 && rid === 'r1' ? '東京・シダックスカルチャーホール' : '東京会場'),
  osaka: (Y, rid) => (Y >= 2026 && rid === 'r1' ? '大阪・インディペンデントシアター2nd' : Y <= 2004 ? '大阪会場' : '大阪会場'),
  studio: () => '決勝スタジオ（生放送）',
};
export function rulesR1(Y) {
  if (CACHE[Y]) return CACHE[Y];
  const held = Y === 2002 || Y >= 2004;
  const P = Y - 1;
  const neo = Y >= 2021;
  const name = neo ? 'R-1グランプリ' : 'R-1ぐらんぷり';
  const national = Y >= 2005;
  const r = {
    Y, held, edition: Y === 2002 ? 1 : Y >= 2004 ? Y - 2002 : null, name, title: `${name}${Y}`, theme: neo ? 'r1new' : 'r1old',
    organizer: '吉本興業・関西テレビ', broadcast: national ? '関西テレビ・フジテレビ系 全国ネット' : '関西テレビ（関西ローカル）',
    prize: Y <= 2004 ? 1000000 : 5000000, fee: 2000, sub: neo ? 'ひとり芸日本一決定戦' : 'ピン芸日本一決定戦',
    tagline: Y >= 2026 ? '一番面白い、一人が決まる。' : neo ? 'ひとり芸の、頂点へ。' : 'たったひとりで、日本一。',
    formTitle: 'エントリー用紙', formSet: 'home', boardWhere: Y >= 2010 ? '公式サイト' : '会場の掲示',
    formNote: Y === 2002 ? '※第1回は座布団の上で演じること（落語スタイル）。重複エントリー・再エントリー不可' : '※重複エントリー・再エントリー不可。写真は胸から上（L版）',
    pledge: '重複エントリー・再エントリーはできません。\n書いた内容に、まちがいはない？',
    mailText: Y >= 2021 ? 'エントリーを送信した。\n…受付完了のメールが届いた！' : 'エントリー用紙と写真を封筒に入れ、ポストへ。\n…数日後、受付の通知が届いた！',
    lastPrelim: 'sf', lastPrelimName: '準決勝',
  };
  // who may enter
  r.eligText = Y === 2002 ? 'プロ・アマ、所属事務所を問わない。ひとりで演じる芸（ピン芸）で、座布団の上で演じる（第1回のみ）'
    : Y <= 2020 ? 'プロ・アマ、所属事務所を問わない。ひとりで演じる芸（ピン芸）。コンビ・グループの芸人も、ひとりでなら出られる'
      : Y <= 2023 ? `プロは芸歴10年以内（${Y - 11}年1月1日以降に活動開始。養成所の期間・活動休止期間は除く）、アマチュアはR-1への出場が10回目以内。ひとり芸`
        : 'プロ・アマ、所属事務所の有無、芸歴を問わない（2024年に芸歴制限を撤廃）。ひとり芸';
  // the calendar (game months of 10 days; d = 1..10)
  if (Y >= 2021) {
    const L2 = Y >= 2026 ? 180 : 120, L4 = Y >= 2026 ? 240 : 180, LF = Y >= 2024 ? 240 : 180;
    const fin = Y >= 2024 ? 9 : 8;
    r.cal = { announce: [P, 9, 5], entryFrom: [P, 10, 1], entryTo: [P, 10, 10] };
    r.rounds = [
      { id: 'r1', name: '1回戦', dates: [[P, 11, 3, 'osaka'], [P, 11, 5, 'tokyo'], [P, 11, 8, 'tokyo'], [P, 12, 2, 'tokyo']], length: 120, field: (E) => E, pass: (E) => Math.round(E * 0.16), mu: 34, sd: 13, fame: 3, stamina: 15 },
      { id: 'r2', name: '2回戦', dates: [[Y, 1, 2, 'osaka'], [Y, 1, 4, 'tokyo']], length: L2, field: (E) => Math.round(E * 0.16), pass: (E) => Math.max(80, Math.round(122 * E / 6171)), mu: 56, sd: 8, fame: 5 },
      { id: 'qf', name: '準々決勝', dates: [[Y, 1, 8, 'tokyo'], [Y, 1, 9, 'osaka']], length: L4, field: (E) => Math.max(80, Math.round(122 * E / 6171)), pass: 32, mu: 64, sd: 6, fame: 10 },
      { id: 'sf', name: '準決勝', dates: [[Y, 2, 5, 'tokyo']], length: L4, field: 32, pass: fin, mu: 70, sd: 5, fame: 20, rehearsal: false },
      ...(Y <= 2023 ? [{ id: 'rev', name: '復活ステージ', dates: [[Y, 3, 7, 'studio']], length: L4, field: 10, pass: 1, mu: 72, sd: 4, tv: true }] : []),
      { id: 'final', name: '決勝', dates: [[Y, 3, 7, 'studio']], length: LF, tv: true, final: true },
    ];
    const J = Y >= 2025 ? 7 : 5;
    r.final = {
      format: 'score', finalists: 9, advance: 3, judges: J, length: LF, judgeBase: 62, judgeK: 0.33, stage1Name: 'ファーストステージ', stage2Name: 'ファイナルステージ', stage2: 'vote',
      formatText: `ファイナリスト9人（${Y <= 2023 ? '準決勝から8人＋復活ステージから1人' : '準決勝から9人'}）が${fmtLen(LF)}のネタ。審査員${J}人が100点満点で採点し、上位3人がファイナルステージへ。もう1本のネタのあと、審査員の決選投票で優勝が決まる`,
      onair: Y >= 2024 ? '18時30分' : '夜', when: (cal) => (cal.final ? dateTextY(cal.final.y, cal.final.m, cal.final.d) : '3月'),
    };
  } else {
    const fm = Y >= 2018 ? [3, 3] : [2, 9];
    r.cal = { announce: [P, 10, 5], entryFrom: [P, 11, 1], entryTo: [P, 11, 10] };
    if (Y <= 2004) {
      r.rounds = [
        { id: 'r1', name: '予選', dates: [[P, 12, 3, 'osaka'], [P, 12, 6, 'tokyo']], length: 120, field: (E) => E, pass: 48, mu: 30, sd: 13, fame: 3, stamina: 15 },
        { id: 'sf', name: '準決勝', dates: [[Y, 1, 6, 'osaka']], length: 180, field: 48, pass: 12, mu: 62, sd: 7, fame: 15 },
        { id: 'final', name: '決勝', dates: [[Y, 2, 8, 'studio']], length: 180, tv: true, final: true },
      ];
      r.final = { format: 'oneshot', finalists: 12, judges: 5, length: 180, judgeBase: 62, judgeK: 0.33, formatText: '決勝進出者12人の一発勝負。審査員の採点の合計で優勝が決まる', onair: '夜', when: (cal) => (cal.final ? dateTextY(cal.final.y, cal.final.m, cal.final.d) : '2月') };
    } else {
      const rev = Y >= 2015 ? (Y <= 2017 ? 3 : Y <= 2019 ? 2 : 1) : 0;
      const fin = Y >= 2013 ? 12 : 8;
      r.rounds = [
        { id: 'r1', name: '予選1回戦', dates: [[P, 12, 2, 'osaka'], [P, 12, 4, 'tokyo'], [P, 12, 7, 'tokyo']], length: 120, field: (E) => E, pass: (E) => Math.round(E * 0.2), mu: 32, sd: 13, fame: 3, stamina: 15 },
        { id: 'r2', name: '予選2回戦', dates: [[Y, 1, 3, 'osaka'], [Y, 1, 5, 'tokyo']], length: 120, field: (E) => Math.round(E * 0.2), pass: 48, mu: 55, sd: 8, fame: 6 },
        { id: 'sf', name: '準決勝', dates: [[Y, 2, 1, 'tokyo']], length: 180, field: 48, pass: fin - rev, mu: 66, sd: 6, fame: 15 },
        ...(rev ? [{ id: 'rev', name: '復活ステージ', dates: [[Y, fm[0], fm[1], 'studio']], length: 180, field: 10, pass: rev, mu: 70, sd: 4, tv: true }] : []),
        { id: 'final', name: '決勝', dates: [[Y, fm[0], fm[1], 'studio']], length: 180, tv: true, final: true },
      ];
      if (Y >= 2013) {
        r.final = {
          format: 'block3pt', blocks: 3, finalists: 12, judges: 5, length: 180, judgeBase: 62, judgeK: 0.33, audience: Y >= 2014 && Y !== 2019, stage2Name: 'ファイナルステージ', stage2: Y >= 2015 ? '3pt' : 'vote',
          formatText: `12人がA・B・Cの3ブロック（4人ずつ）に分かれ、審査員が持ち点3を振り分ける${Y >= 2014 && Y !== 2019 ? '（お茶の間のdボタン投票も1票分）' : ''}。各ブロックの1位がファイナルステージへ進み、${Y >= 2015 ? 'ブロックと同じ持ち点3の振り分け' : '審査員1人1票の投票'}で優勝が決まる`,
          onair: '夜', when: (cal) => (cal.final ? dateTextY(cal.final.y, cal.final.m, cal.final.d) : '冬'),
        };
      } else {
        r.final = { format: 'score', finalists: 8, advance: 3, judges: 5, length: 180, judgeBase: 62, judgeK: 0.33, stage1Name: 'ファーストステージ', stage2Name: 'ファイナルステージ', stage2: 'vote', formatText: '決勝進出者がネタを披露し、得点の上位3人がファイナルステージへ（3位通過→2位通過→1位通過の順に、もう1本）。審査員の投票で優勝が決まる', onair: '夜', when: (cal) => (cal.final ? dateTextY(cal.final.y, cal.final.m, cal.final.d) : '2月') };
      }
    }
  }
  Object.assign(r.final, { finalistFame: 80, finalistFame2: 150, finalistFans: Y >= 2005 ? 6000 : 2000, champFame: Y >= 2005 ? 700 : 300, champFans: Y >= 2005 ? 40000 : 8000 });
  r.notes = [
    Y === 2002 ? '「R」は落語のR。第1回は座布団の上でネタをする決まりだった。' : null,
    Y === 2021 ? 'この年から大会名を「R-1グランプリ」に改め、出場資格を芸歴10年以内にした（芸歴11年以上の芸人には「R-1ぐらんぷりクラシック」が別に行われた）。' : null,
    Y === 2024 ? 'この年から芸歴制限を撤廃し、復活ステージを廃止した。決勝のネタ時間は4分に。' : null,
    Y >= 2026 ? '前回・前々回の準々決勝進出者は1回戦が免除（シード）。' : null,
  ].filter(Boolean);
  r.eligibility = Y <= 2020 ? 'open' : Y <= 2023 ? 'geireki10' : 'open';
  CACHE[Y] = r;
  return r;
}

// entry counts (2002: 351, 2025: 5,511, 2026: 6,171 are real; the others are this game's world, shown as 「約」)
function entriesR1(Y, rng) {
  const known = { 2002: 351, 2025: 5511, 2026: 6171 };
  if (known[Y]) return known[Y];
  let base;
  if (Y <= 2004) base = 650;
  else if (Y <= 2010) base = 1500 + (Y - 2005) * 250;
  else if (Y <= 2020) base = 2800 + (Y - 2010) * 60;
  else if (Y <= 2023) base = 2600 + (Y - 2021) * 300;
  else if (Y === 2024) base = 5000;
  else base = 6171 * Math.pow(1.025, Y - 2026);
  return Math.round(base * (0.96 + rng() * 0.08));
}

// ================================================================ fictional people
const JLOOK = {
  yumeno: { hair: 'slick', hairColor: 'silver', skin: 'tan', top: '#3a2a4a', bottom: '#1e1e26', jacket: true, tie: '#c8102e' },
  kozuchi: { hair: 'bald', hairColor: 'black', skin: 'fair', top: '#4a3a6a', bottom: '#4a3a6a', kimono: '#d8b04a' },
  hanabusa: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#c8102e', bottom: '#2a2a34', skirt: true },
  kuroiwa: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#20232a', bottom: '#20232a', glasses: true },
  gondawara: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#8a6a2a', bottom: '#3a2a1a', jacket: true, beard: true },
  mikazuki: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#20232a', glasses: 'sun' },
  odagiri: { hair: 'cap', hat: '#3a6fd8', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#2a2a34' },
  tsukishima: { hair: 'long', hairColor: 'black', skin: 'light', top: '#8a5ac8', bottom: '#20232a', skirt: true, glasses: true },
  naruto: { hair: 'afro', hairColor: 'brown', skin: 'tan', top: '#ff8a3d', bottom: '#3a4a7a' },
};
const J0 = {
  yumeno: { name: '夢野ハジメ', short: '夢野', title: 'ベテラン漫談家', taste: 'mandan' },
  kozuchi: { name: '福来亭こづち', short: 'こづち', title: '落語家', taste: 'solo' },
  hanabusa: { name: '花房タマエ', short: '花房', title: '喜劇女優', taste: 'solo' },
  kuroiwa: { name: '黒岩ショウゾウ', short: '黒岩', title: '放送作家', taste: 'flip' },
  gondawara: { name: '権田原ヤスシ', short: '権田原', title: '上方漫才の大御所', taste: 'mandan' },
  mikazuki: { name: '三日月ジロー', short: 'ジロー', title: 'ピン芸人', taste: 'flip' },
  odagiri: { name: '小田切ヨウ', short: '小田切', title: 'コント作家', taste: 'solo' },
  tsukishima: { name: '月島ミサ', short: '月島', title: '脚本家', taste: 'utaneta' },
  naruto: { name: '鳴門ゴロー', short: '鳴門', title: 'ものまね芸人', taste: 'utaneta' },
};
const judgeOf = (k) => ({ ...J0[k], look: JLOOK[k] });
function judgesR1(g, Y) {
  const champ = (y) => {
    const h = R1.histOf(g, y) || pastHistory(y);
    return { name: h.champ, short: Array.from(h.champ).slice(0, 4).join(''), title: `元王者（${y}年）`, taste: pickR(rngOf('jt', y), ['flip', 'solo', 'mandan']), look: randomLook(rngOf('look', h.champ, 0)) };
  };
  if (Y <= 2012) return ['yumeno', 'kozuchi', 'hanabusa', 'kuroiwa', 'gondawara'].map(judgeOf);
  if (Y <= 2020) return ['yumeno', 'kuroiwa', 'mikazuki', 'odagiri', 'hanabusa'].map(judgeOf);
  if (Y <= 2023) return [...['mikazuki', 'odagiri', 'tsukishima', 'naruto'].map(judgeOf), champ(2010)];
  if (Y === 2024) return [...['mikazuki', 'odagiri', 'tsukishima'].map(judgeOf), champ(2010), champ(2016)];
  return [...['mikazuki', 'odagiri', 'tsukishima', 'naruto', 'hanabusa'].map(judgeOf), champ(2010), champ(2016)];
}
const MCS = {
  old: [{ name: '汐見ゆかり（アナウンサー）', look: LOOKS.announcer }, { name: 'ひだまり一座', look: LOOKS.comedian }],
  mid: [{ name: 'シャンデリア商会', look: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: '#20232a', jacket: true, tie: '#c8102e' } }, { name: '小春（タレント）', look: LOOKS.idol }],
  neo: [{ name: 'スパイス大臣', look: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#e60033' } }, { name: '汐月れな（女優）', look: LOOKS.actress }],
};
const mcR1 = (Y) => (Y <= 2004 ? MCS.old : Y <= 2020 ? MCS.mid : MCS.neo);
// this world's champions before the game (fictional names, real edition years)
function pastHistory(Y) {
  const r = rngOf('r1hist', Y);
  const champ = pinName(r);
  let runner = pinName(r);
  if (runner === champ) runner = pinName(r);
  return { champ, runner, note: Y === 2002 ? '座布団の上で演じた第1回' : '' };
}

// ================================================================ the field (notables with storylines)
const STYLES = ['flip', 'flip', 'solo', 'solo', 'mandan', 'utaneta'];
const STYLE_JA = { flip: 'フリップ芸', solo: '一人コント', mandan: '漫談', utaneta: '歌ネタ', pin: 'ピン芸' };
function notableR1(rng, Y, i, ctx = {}) {
  const name = pinName(rng);
  const combo = name.includes(' ');
  const g0 = rng() < 0.28 ? 'f' : 'm';
  const gender = nameGender(name) || g0; // a name that reads as a man's never gets the 女性ピン tag
  const amateur = !combo && rng() < (Y <= 2004 ? 0.25 : 0.1);
  const tags = [];
  if (amateur) tags.push(rng() < 0.35 ? '学生' : 'アマチュア');
  if (combo) tags.push('コンビの片割れ');
  if (gender === 'f' && rng() < 0.5) tags.push('女性ピン');
  if (Y >= 2021 && Y <= 2023 && !amateur && rng() < 0.14) tags.push('ラストイヤー');
  if ((Y <= 2020 || Y >= 2024) && !amateur && rng() < 0.1) tags.push('ベテラン');
  if (!ctx.dark && rng() < 0.15) tags.push('初出場');
  if (ctx.prev && ctx.prev.runner && i === 4) { tags.length = 0; tags.push('前年準優勝'); }
  const n = { name: ctx.prev && ctx.prev.runner && i === 4 ? ctx.prev.runner : name, type: 'pin', style: pickR(rng, STYLES), gender, tags: tags.slice(0, 2), agency: amateur ? 'アマチュア' : pickR(rng, agencyNames().filter((a) => a !== 'アマチュア')) };
  if (Y >= 2026 && i < 18 && !amateur) n.skip = ['r1']; // 前回・前々回の準々決勝進出者は1回戦免除
  n.gender = nameGender(n.name) || n.gender;
  return n;
}

// ================================================================ texts and news (≥ 25 unique lines a season)
// [topic, first year it can be a topic] (「婚活」 is a word of 2007/08)
const THEMES_NETA = ['コンビニの深夜バイト', ['婚活パーティー', 2008], '引っ越しの見積もり', '運動会の実況', '就職の面接', '歯医者の待合室', '新幹線の車内販売', '修学旅行の夜', '結婚式のスピーチ', '町内会の回覧板', '家電量販店', 'カーナビの声', '天気予報', 'タクシーの運転手', '美容院の会話', '交番', '迷子のアナウンス', '鍋奉行', '社員食堂', '昭和の歌謡ショー', '占い師', 'ラジオ体操', '駅のホーム', '書道教室'];
function netaTitle(rng, style, Y) {
  const t = [].concat(pickR(rng, THEMES_NETA.filter((x) => !Array.isArray(x) || !Y || Y >= x[1])))[0];
  return style === 'flip' ? `フリップ「${t}あるある」` : style === 'solo' ? `一人コント「${t}」` : style === 'mandan' ? `漫談「${t}の話」` : `歌ネタ「${t}のうた」`;
}
function catchR1(g, S, id) {
  const r = rngOf('r1catch', S.Y, id);
  if (id === 'player') {
    const E = S.entry || {};
    const pool = [];
    if (E.solo) pool.push('相方のいない夜に、ひとりで勝つ', 'コンビの片割れが、ひとりで頂へ');
    if (E.style === 'flip') pool.push('めくるたび、世界が裏返る', '一枚の紙で、日本を笑わせる');
    if (E.style === 'solo') pool.push('ひとりで全員を演じる怪物', '舞台に、もうひとり見える');
    if (E.style === 'mandan') pool.push('しゃべりだけで景色を変える', 'マイク一本の職人');
    if (E.style === 'utaneta') pool.push('歌いだしたら止まらない', '笑いのメロディメーカー');
    if (num(E.prep && E.prep.practice) >= 70) pool.push('稽古の鬼、ここに立つ');
    if (actInfo(g).amateur) pool.push('会社員の皮をかぶった天才');
    pool.push('いま、いちばん見たいひとり');
    return pickR(r, pool);
  }
  const n = S.notables.find((x) => x.id === id) || {};
  const pool = { flip: ['めくるたび、世界が裏返る', 'フリップに魂を描く', '画用紙の魔術師'], solo: ['ひとりで全員を演じる怪物', '舞台にもうひとり見える', '憑依型ひとりコント'], mandan: ['マイク一本の職人', 'しゃべりで景色を変える', '毒舌は愛'], utaneta: ['笑いのメロディメーカー', '歌いだしたら止まらない', 'ギター1本の反逆児'] }[n.style] || ['ひとり芸の新星'];
  const tagC = { 学生: '教室から来た刺客', アマチュア: '会社員の皮をかぶった天才', 前年王者: '連覇への挑戦者', 前年準優勝: 'あの日の続きを、今夜', ラストイヤー: '最後の挑戦、10年目の覚悟', 女性ピン: 'ひとりで舞台を支配する女王', コンビの片割れ: '相方は客席で見ている', ベテラン: '芸歴の重みで殴る', ダークホース: '準決勝の台風の目', 初の決勝: '初めての大舞台' };
  for (const t of n.tags || []) if (tagC[t] && r() < 0.7) return tagC[t];
  return pickR(r, pool);
}
function storyR1(g, S, rules) {
  const r = rngOf('r1story', S.Y, g.state.day);
  const n = S.notables[rint(r, 0, Math.min(S.notables.length - 1, 30))];
  if (!n) return null;
  const L = [
    ['s1', () => `${n.name}（${n.agency}）、${rules.title}へ「今年こそ決勝の舞台へ」`],
    ['s2', () => (n.tags.includes('学生') ? `現役大学生の${n.name}、${rules.title}にエントリー「授業より稽古」` : null)],
    ['s3', () => (n.tags.includes('コンビの片割れ') ? `コンビの片割れ・${n.name}がピンで${rules.name}に挑戦。相方は「客席で見守る」` : null)],
    ['s4', () => (n.style === 'flip' ? `${n.name}、自作のフリップ300枚を公開「ほとんどボツです」` : null)],
    ['s5', () => (n.tags.includes('前年王者') ? `前年王者${n.name}、連覇へ「同じネタは使わない」` : null)],
    ['s6', () => (n.tags.includes('ラストイヤー') ? `ラストイヤーの${n.name}「10年分を${fmtLen(rules.final.length)}にぶつける」` : null)],
    ['s7', () => (n.style === 'utaneta' ? `${n.name}の歌ネタ新作が劇場で話題に` : null)],
    ['s8', () => (n.tags.includes('アマチュア') ? `会社員と芸の二刀流、アマチュアの${n.name}が快進撃` : null)],
    ['s9', () => `${rules.title}、大阪会場も熱気。出番を待つピン芸人の列がロビーの外まで`],
    ['s10', () => (n.tags.includes('女性ピン') ? `${n.name}、「女王」の称号を狙う。ネタは${STYLE_JA[n.style]}` : null)],
    ['s11', () => `${n.name}、得意のものまねを封印して${STYLE_JA[n.style]}で勝負`],
    ['s12', () => `${n.name}「${fmtLen(rules.rounds[0].length)}は短い。ツカミで全部決まる」`],
    ['s13', () => (n.style === 'solo' ? `${n.name}、一人コントの小道具が段ボール3箱に` : null)],
    ['s14', () => `劇場支配人「今年の${rules.name}は粒ぞろい」。注目は${n.name}`],
    ['s15', () => (n.tags.includes('ベテラン') ? `ベテラン${n.name}、若手に交じって予選へ「場数なら負けない」` : null)],
    ['s16', () => `${n.name}、ネタ見せで放送作家に絶賛される`],
    ['s17', () => (n.style === 'mandan' ? `${n.name}、漫談一本で${rules.name}に挑む「しゃべりは裏切らない」` : null)],
    ['s18', () => `${rules.title}の予選、ネタ時間オーバーで失格寸前の芸人も。持ち時間${fmtLen(rules.rounds[0].length)}の壁`],
    ['s19', () => `${n.name}、ネタ作りのために一週間ひとり旅`],
    ['s20', () => (n.tags.includes('初出場') ? `初出場の${n.name}、いきなり注目の的に` : null)],
  ];
  const free = L.filter(([k, f]) => !S.news[k] && f());
  if (!free.length) return null;
  const [k, f] = free[rint(r, 0, free.length - 1)];
  S.news[k] = g.state.day;
  return f();
}
const TEXT = {
  announce: (g, S, r, cal) => {
    const extra = r.Y === 2021 ? '大会名を「R-1グランプリ」に改め、出場資格を芸歴10年以内に。' : r.Y === 2024 ? '芸歴制限を撤廃し、芸歴を問わず出場できるように。' : r.Y === 2005 ? '今回から全国ネットで放送、優勝賞金は500万円に。' : r.Y >= 2026 ? '前回・前々回の準々決勝進出者は1回戦が免除。' : '';
    return `${r.title}（第${r.edition}回）開催決定！エントリー受付は${dateTextY(cal.entryFrom.y, cal.entryFrom.m, cal.entryFrom.d)}から。優勝賞金${plainYen(r.prize)}。${extra}`;
  },
  entryOpen: (g, S, r, cal) => `${r.title}のエントリー受付が始まった。${r.eligibility === 'geireki10' ? 'プロは芸歴10年以内、' : 'プロ・アマ問わず、'}参加費${plainYen(r.fee)}。締め切りは${dateText(cal.entryTo.m, cal.entryTo.d)}`,
  entryClose: (g, S, r) => `${r.title}、エントリー総数は${S.Y === 2026 ? '6,171人で史上最多' : `約${n0(Math.round(S.entries / 10) * 10)}人`}。ひとり芸の頂点をめざす長い冬が始まる`,
  roundDone: (g, S, rd, R0, r) => {
    const n = S.notables.find((x) => R0.passed.includes(x.id) && x.tags && x.tags.length) || S.notables.find((x) => R0.passed.includes(x.id));
    if (rd.id === 'sf') {
      const fins = R0.passed.map((id) => (id === 'player' ? (S.entry && S.entry.unitName) : (S.notables.find((x) => x.id === id) || {}).name)).filter(Boolean);
      return `${r.title} 決勝進出者${fins.length}人が決定！${fins.slice(0, 9).join('、')}${r.rounds.some((x) => x.id === 'rev') ? '。残りの枠は決勝当日の復活ステージで決まる' : ''}`;
    }
    const next = r.rounds[r.rounds.indexOf(rd) + 1];
    return `${r.title} ${rd.name}が終了。約${n0(R0.field)}人から${n0(R0.pass)}人が${next ? next.name : '次'}へ。${n ? `${n.name}${n.tags.includes('アマチュア') ? '（アマチュア）' : ''}も通過` : ''}`;
  },
  champion: (g, S, r) => {
    const F = S.final;
    if (!F) return `${r.title}の決勝が行われた`;
    if (F.champ === 'player') return `【速報】${r.title} 第${r.edition}代王者は${F.champName}！優勝賞金${plainYen(r.prize)}を獲得`;
    const n = S.notables.find((x) => x.id === F.champ) || {};
    return `【速報】${r.title} 第${r.edition}代王者は${F.champName}！${n.tags && n.tags.length ? `（${n.tags[0]}）` : ''}${STYLE_JA[n.style] ? STYLE_JA[n.style] + 'で頂点に' : ''}。準優勝は${F.runnerName}`;
  },
  after: (g, S, r) => (S.final && S.final.champ === 'player' ? `${r.name}王者・${S.final.champName}に仕事のオファーが殺到。「寝る時間がない」` : `${r.name}王者・${S.final ? S.final.champName : ''}、優勝翌日から朝の情報番組をはしご`),
  story: storyR1,
};

// ================================================================ scenes of R-1's own
const MANAGER = { name: 'マネージャー', look: LOOKS.manager };
const WRITER = { name: '放送作家', look: { hair: 'cap', hat: '#2a2d36', hairColor: 'black', skin: 'fair', top: '#5a5f6b', bottom: '#2a2a34', glasses: true } };
const ks = (p, kansai, std) => (p && p.kansai ? kansai : std);
function bestStyle(g) {
  const s = { flip: statOf(g, 'hassou') + statOf(g, 'neta'), solo: statOf(g, 'act') * 2, mandan: statOf(g, 'wagei') * 2, utaneta: statOf(g, 'mane') + statOf(g, 'voice') };
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}
async function pinChallenge(g, C, { rules, act, st, quick }) {
  const p = act.partner;
  if (act.type === 'pin' || !p) return { ok: true, unitName: act.name, solo: false, photos: [g.state.look], kind: 'pin' };
  // ピンでの挑戦: the 相方 hears about it
  st.set = 'cafe'; st.sign = '喫茶店（相方とネタ打ち合わせ）';
  st.cast = [{ look: g.state.look, x: 230, y: 150, k: 2, dir: 'right' }, { look: p.look, x: 350, y: 150, k: 2, dir: 'left' }];
  if (!quick) {
    await g.say(`${rules.name}は、ひとり芸の大会だ。\nコンビの${act.name}としてではなく、ひとりで出ることになる。`);
    const k = await g.ask(`相方の${p.short}に、話してみる？`, ['「R-1に、ひとりで出たいんだ」', 'やっぱりやめておく'], { cancel: 1 });
    if (k !== 0) return { ok: false };
    const h = num(act.unit && act.unit.harmony, 50);
    const who = { name: p.name, look: p.look };
    if (h >= 60) await g.say(ks(p, ['ええやん！お前のピンネタ、ずっと見てみたかってん。', 'その代わり、優勝したら焼肉おごりな。'], ['いいじゃん！ひとりのネタ、ずっと見てみたかった。', 'そのかわり優勝したら焼肉おごりね。']), who);
    else if (h >= 30) await g.say(ks(p, ['…ふーん。まあ、ええんちゃう。', 'コンビのネタ合わせは、サボらんといてや。'], ['…ふーん。まあ、いいんじゃない。', 'コンビのネタ合わせは、サボらないでよ。']), who);
    else await g.say(ks(p, ['…勝手にしたらええやん。', '…ひとりの方が、楽しいんやろ。'], ['…勝手にすれば。', '…ひとりの方が、楽しいんでしょ。']), who);
    if (h >= 60 && has(g, 'addAff')) safe(() => g.addAff(p.id, 1, true));
  }
  st.set = rules.formSet || 'home'; st.sign = '自宅（エントリー用紙を書く）';
  st.cast = [{ look: g.state.look, x: 520, y: 236, k: 1, dir: 'left' }];
  return { ok: true, unitName: `${act.name} ${g.state.name}`, solo: true, photos: [g.state.look], kind: 'pin', partner: p };
}
async function partnerAfter(g, C, { E, passed, final, champion, place }) {
  const p = actInfo(g).partner;
  if (!p) return;
  const text = champion ? ks(p, 'おめでとう！！ほんまにすごいわ…。\n次はコンビで、てっぺん獲ろな！', 'おめでとう！！ほんとにすごい…。\n次はコンビで、てっぺん獲ろうね！')
    : final && !passed ? ks(p, `テレビで見てたで。${place ? place + '位' : ''}…胸張ってええ。\nほな、コンビのネタ合わせしよか。`, `テレビで見てたよ。${place ? place + '位' : ''}…胸を張っていい。\nじゃあ、コンビのネタ合わせしようか。`)
      : final ? ks(p, '決勝やて！？…やるやん。\nおれも客席で見とくからな。', '決勝！？…やるじゃん。\n客席で見てるからね。')
        : passed ? ks(p, 'おっ、通ったんか。…ちょっと悔しいわ。', 'お、通ったんだ。…ちょっと悔しいな。')
          : ks(p, 'あかんかったか。…まあ、コンビで取り返そ。', 'だめだったか。…まあ、コンビで取り返そう。');
  g.message({ from: p.name, person: PEOPLE[p.id] ? p.id : undefined, text, kind: 'chat' });
}
function prepItemsR1(g, C, { S, E, rules, act }) {
  const items = [];
  const neta = E.neta && has(g, 'neta') ? safe(() => g.neta(E.neta), null) : null;
  const practice = (n, msg) => { E.prep.practice = clamp(num(E.prep.practice) + n, 0, 100); if (neta && has(g, 'practiceNeta')) safe(() => g.practiceNeta(neta.id, Math.round(n * 0.7))); g.notify(`仕上がり +${n}（${Math.round(E.prep.practice)}）`, { color: '#ffd23f' }); if (msg) return g.say(msg); return null; };
  items.push({ label: '鏡の前で、ひとりネタ合わせ', set: 'home', sign: '自宅（鏡の前で稽古）', stamina: 10, cast: (gg) => [{ look: gg.state.look, x: 330, y: 150, k: 2, dir: 'right', bob: true }, { look: gg.state.look, x: 444, y: 96, k: 2, dir: 'left' }],
    run: async (gg) => {
      await gg.say(['鏡の中の自分に向かって、頭からネタを通す。', '…表情がかたい。目線が泳ぐ。\nもう一回。もう一回。']);
      safe(() => has(gg, 'addComedyStat') && gg.addComedyStat('ma', 1, true));
      await practice(8, null);
    } });
  if (act.agency) items.push({ label: 'マネージャーに見てもらう', set: 'cafe', sign: '事務所の会議室', stamina: 8, cast: (gg) => [{ look: gg.state.look, x: 240, y: 150, k: 2, dir: 'right' }, { look: MANAGER.look, x: 350, y: 150, k: 2, dir: 'left' }],
    run: async (gg) => {
      const sf = shortfallReasons(gg, 'pin', null, { practice: E.prep.practice });
      await gg.say([`…ふむ。${sf[0] ? sf[0].replace(/：.*$/, '') + 'が、まだ弱いですね。' : 'いい仕上がりです。'}`, '本番まで、毎日1回は通しましょう。'], MANAGER);
      await practice(6, null);
    } });
  items.push({ label: act.agency || g.state.fame >= 100 ? '放送作家にダメ出ししてもらう' : '知り合いの作家に見てもらう（謝礼）', set: 'cafe', sign: '喫茶店（作家とネタ打ち合わせ）', stamina: 6, cast: (gg) => [{ look: gg.state.look, x: 240, y: 150, k: 2, dir: 'right' }, { look: WRITER.look, x: 350, y: 150, k: 2, dir: 'left' }],
    run: async (gg) => {
      const fee = act.agency || g.state.fame >= 100 ? 0 : toInternal(gg, 3000);
      if (fee && !gg.spend(fee)) { await gg.say('謝礼が払えない…。'); return; }
      if (fee) gg.notify(`謝礼 -${plainYen(3000)}`, { color: "#ff9aa8" });
      const sf = shortfallReasons(gg, 'pin', null, { practice: E.prep.practice, need: 65 });
      await gg.say(['ネタ、見せてもらいました。', ...sf.slice(0, 2).map((x) => `${x}。`), '2分のネタは、最初の10秒で決まる。ツカミを磨こう。'], WRITER);
      if (neta && has(gg, 'scoreNeta')) await safe(() => gg.scoreNeta(neta, { by: 'local' }), null);
      E.prep.notes = num(E.prep.notes) + 1;
      await practice(5, null);
    } });
  if (E.style === 'flip') items.push({ label: 'フリップを描く（画用紙・マジック代）', set: 'home', sign: '自宅（フリップ作り）', stamina: 6,
    run: async (gg) => {
      const cost = toInternal(gg, 1000);
      if (!gg.spend(cost)) { await gg.say('画用紙を買うお金がない…。'); return; }
      E.prep.flip = clamp(num(E.prep.flip) + 25, 0, 100);
      await gg.say(['スケッチブックに、太いマジックで一枚ずつ。', '客席のいちばん後ろからでも読める字で。\n…絵は、わざとヘタなほうが笑える。']);
      gg.notify(`フリップの出来 ${Math.round(E.prep.flip)}`, { color: '#ffd23f' });
    } });
  else if (E.style === 'solo' || E.style === 'utaneta') items.push({ label: E.style === 'solo' ? '小道具・衣装をそろえる' : '音源を作る（カラオケ・ギター）', set: 'home', sign: '自宅（小道具づくり）', stamina: 6,
    run: async (gg) => {
      const cost = toInternal(gg, 1500);
      if (!gg.spend(cost)) { await gg.say('材料を買うお金がない…。'); return; }
      E.prep.flip = clamp(num(E.prep.flip) + 25, 0, 100);
      await gg.say(E.style === 'solo' ? ['100円ショップの帽子と、段ボールのカウンター。', '着替えは一瞬で。何度も練習した。'] : ['替え歌の伴奏を録音した。', '歌いだしの音程は、絶対にはずさない。']);
      gg.notify(`小道具の出来 ${Math.round(E.prep.flip)}`, { color: '#ffd23f' });
    } });
  if (has(g, 'writeNeta')) items.push({ label: 'ネタを書き直す・新しく書く', set: 'home', sign: '自宅（ネタ帳）', stamina: 0, run: async (gg) => { const n = await safe(() => gg.writeNeta({ kind: 'pin', length: rules.rounds[0].length, forContest: 'r1' }), null); if (n && n.id) E.neta = n.id; } });
  items.push({ label: '劇場の出番で試す（ネタおろし）', set: 'hall', sign: 'ライブハウス（ネタおろし）', stamina: 15, cast: (gg) => [{ look: gg.state.look, x: 288, y: 156, k: 2 }],
    run: async (gg, st) => {
      st.theme = THEMES[rules.theme];
      st.sign = 'ピン芸人ライブ'; st.sub = 'ネタおろし';
      st.fx = { mic: true, flip: E.style === 'flip' ? '新ネタ' : null };
      await gg.say('小さなライブハウスの出番で、本番のネタを試す。');
      const res = await performAct(gg, { kind: 'pin', length: rules.rounds[0].length, style: E.style, practice: true, skip: !!gg.auto, title: 'ネタおろし', venue: { name: 'ライブハウス', size: 'small', crowd: 'warm', pressure: 20 } });
      await gg.say(res.score >= 70 ? 'ウケた！このくだりは本番でも使える。' : res.score >= 45 ? 'まずまず。後半のボケを入れ替えよう。' : '…すべった。でも、どこがダメかはっきりした。');
      await practice(res.score >= 70 ? 12 : 9, null);
    } });
  return items;
}
async function champSceneR1(g, C, { S, E, F, st }) {
  const rules = rulesR1(S.Y);
  const p = actInfo(g).partner;
  st.cast = [{ look: g.state.look, x: 288, y: 156, k: 2 }, { look: mcR1(S.Y)[0].look, x: 470, y: 170, k: 1, dir: 'left' }, ...(p && E.solo ? [{ look: p.look, x: 150, y: 170, k: 1, dir: 'right', bob: true }] : [])];
  if (p && E.solo && !g.auto) await g.say(ks(p, `客席から${p.short}が飛び出してきた！\n「やったなぁ！！」`, `客席から${p.short}が飛び出してきた！\n「やったね！！」`));
  await g.say(`トロフィーと、優勝賞金${plainYen(rules.prize)}のボードを受け取った！`, { name: mcR1(S.Y)[0].name, look: mcR1(S.Y)[0].look });
  const k = await g.ask('MC「いまの気持ちを、ひと言！」', ['「ひとりでも、笑わせられました！」', '「…（涙で言葉にならない）」', '「賞金で焼肉いきます！」'], { cancel: 0 });
  await g.say(k === 0 ? '会場から、あたたかい拍手。' : k === 1 ? '会場がもらい泣き。…そして笑い。' : '会場がドッと沸いた。');
}
async function afterPartyR1(g, C, { S, E, F, win }) {
  if (g.auto) return;
  const st = stage(g, { set: 'cafe', theme: THEMES[rulesR1(S.Y).theme], sign: '打ち上げ（居酒屋）', cast: [{ look: g.state.look, x: 240, y: 150, k: 2, dir: 'right' }, ...F.order.filter((id) => id !== 'player').slice(0, 3).map((id, i) => ({ look: C.lookOf(C.find(S, id)), x: 330 + i * 60, y: 160, k: 1, dir: 'left', bob: true, phase: i * 8 }))] });
  try {
    const n = C.find(S, F.order.find((id) => id !== 'player' && id !== F.champ) || '') || C.find(S, F.champ);
    await g.say(win ? ['決勝のあとの打ち上げ。', 'ファイナリストたちが、ジョッキを掲げた。「王者に、かんぱーい！」'] : ['決勝のあとの打ち上げ。', 'くやしさも、うれしさも、みんな同じテーブルに。']);
    if (n) await g.say(win ? '…おめでとう。来年は、おれが獲る。' : 'あんたのネタ、袖で見ててめっちゃ笑ったわ。\nまた、どこかの舞台で。', { name: n.name, look: C.lookOf(n) });
  } finally { unstage(g, st); }
}
function offersR1(g, C, { S, E }) {
  const Y = S.Y;
  sendOffer(g, 'r1_champ_tv', `${E.unitName}さん、${rulesR1(Y).name}優勝おめでとうございます！\n関西テレビの深夜バラエティ『ひとり芸人の夜明け』に、毎週出演していただけませんか？`, '関西テレビのプロデューサー');
  sendOffer(g, 'r1_champ_radio', `${rulesR1(Y).name}王者の${E.unitName}さんに、ラジオのレギュラーをお願いしたくて。\n深夜のひとりしゃべり番組です！`, 'ラジオ局のディレクター');
}

// ================================================================ the contest
const ROUND_CAST = (g, S, rid) => {
  const al = R1.alive(S, rid);
  const r = rngOf('cast', S.Y, rid, g.state.day);
  const pick = al.length ? [0, 1, 2, 3].map(() => al[rint(r, 0, al.length - 1)]) : [];
  return pick.filter((x, i, a) => x && a.indexOf(x) === i).map((n) => ({ name: n.name, look: R1.lookOf(n), n }));
};
export const R1 = makeContest({
  id: 'r1', key: 'r1', label: 'R-1', appName: 'R-1', appTitle: 'R-1', color: '#c8102e', founded: 2002, foundedText: '2002年創設（吉本興業・関西テレビ主催のピン芸日本一決定戦）',
  office: 'R-1事務局', unitWord: '人', notables: 36, topStr: 86, defaultKind: 'pin', prepSub: 'フリップ・小道具', trophy: 'r1_trophy',
  // a comedian with a 相方 performs alone: C's g.perform gets the player's pin view of A's unit
  performExtra: (g, E) => (E && E.solo && has(g, 'unit') ? { unit: safe(() => g.unit('pin'), null) || undefined } : {}),
  kindLabel: (E) => `ピン芸（${STYLE_JA[E.style] || 'ピン芸'}）`,
  typeFromWorld: () => 'pin',
  rules: rulesR1, entries: entriesR1, notable: notableR1, pastHistory, kindOf: () => 'pin',
  gapNote: (Y) => (Y === 2003 ? '2003年は開催なし（第1回は2002年、第2回は2004年）' : null),
  aboutNotYet: () => 'ピン芸人の日本一を決める大会は、まだない。',
  eligibility(g, act, Y, s) {
    const r = rulesR1(Y);
    if (r.eligibility === 'geireki10') {
      if (!act.amateur) {
        const gr = geireki(g, Y);
        if (gr > 10) return { ok: false, why: `芸歴${gr}年。${Y}年大会のプロの出場資格は芸歴10年以内（${Y - 11}年1月1日以降に活動を始めた人）。` };
      } else if (num(s.me.amateur) >= 10) return { ok: false, why: 'アマチュアのR-1出場は10回目まで。もう出場できない。' };
    }
    return { ok: true };
  },
  beforeEntry: pinChallenge,
  formRows(g, C, { act, pre, S, rules }) {
    const Y = rules.Y;
    return [
      ['芸名', pre.unitName],
      ['本名', g.fmt('{fullname}')],
      ['年齢', `${playerAge(g, Y)}歳`],
      ['所属', act.agencyName || 'なし（アマチュア）'],
      ['芸歴', act.amateur ? '—' : `${geireki(g, Y)}年`],
      ['出場回数', `${num(C.state(g).me.entries) + 1}回目`],
      ...(pre.solo ? [['コンビ名', act.name]] : []),
    ];
  },
  formQuestions(g, C, { rules, S }) {
    const cal = C.cal(g, rules.Y);
    const best = bestStyle(g);
    const order = ['flip', 'solo', 'mandan', 'utaneta'];
    return [
      ...(rules.Y >= 2021 ? [{ id: 'method', label: '申込方法', text: '申し込み方法は？', choices: [{ label: '公式エントリーフォーム（Web）', value: 'web', show: 'Webフォーム' }, { label: '専用用紙を郵送する', value: 'mail', show: '郵送' }] }] : []),
      { id: 'style', label: 'ネタのジャンル', text: 'どんなネタで勝負する？', choices: order.map((k) => ({ label: STYLE_JA[k] + (k === best ? '（得意）' : ''), value: k, show: STYLE_JA[k] })), auto: order.indexOf(best) },
      { id: 'date', label: `${rules.rounds[0].name}の希望`, text: `${rules.rounds[0].name}の日程と会場は？`, choices: (cal.rounds.r1 || []).map((d, i) => ({ label: `${dateText(d.m, d.d)}　${VENUE[d.venue](rules.Y, 'r1')}`, value: i, show: `${dateText(d.m, d.d)} ${VENUE[d.venue](rules.Y, 'r1')}` })) },
    ];
  },
  entryNo(g, S, rules) {
    const cal = R1.cal(g, rules.Y);
    const r = rngOf('r1no', rules.Y, g.state.day);
    const frac = clamp((g.state.day - cal.entryFrom.day + r()) / 10, 0, 1);
    return 1 + Math.round(frac * (S.entries - 1) * 0.92) + rint(r, 0, Math.max(1, Math.round(S.entries * 0.05)));
  },
  venueName: (Y, rid, v) => (VENUE[v] ? VENUE[v](Y, rid) : v || ''),
  roundCast: ROUND_CAST,
  lobbyLine: () => '\nロビーには出番待ちの芸人。…みんな、ひとりだ。',
  gakuyaLine: () => ['楽屋は、妙に静かだ。', 'みんなひとりで壁に向かい、ぶつぶつネタを繰っている。\nR-1の楽屋は、孤独な場所だ。'],
  rivalLine: (g, S, rid, o) => {
    const n = o.n || {};
    if ((n.tags || []).includes('前年王者')) return '去年の王者や言うても、予選は予選。\n…いちばん緊張してるの、たぶんおれやで。';
    if ((n.tags || []).includes('学生')) return 'あ、あの、緊張しますね…！\nぼく、今日が初めての舞台なんです。';
    if ((n.tags || []).includes('コンビの片割れ')) return '相方、客席に来てんねん。\nすべったら一生いじられるわ。';
    return pickR(rngOf(S.Y, rid, n.name), ['…ピンの出番前って、話し相手おらんのよな。', 'おたがい、がんばりましょう。', '持ち時間、ほんま一瞬やで。']);
  },
  awaseLabel: '壁に向かって、ひとりでネタ合わせ',
  awase: async (g) => { await g.say(['楽屋のすみで、壁に向かってネタを通す。', 'R-1のネタ合わせは、いつもひとりだ。']); },
  propsLabel: (E) => (E.style === 'flip' ? 'フリップの順番を確認' : E.style === 'solo' ? '小道具・衣装の確認' : E.style === 'utaneta' ? '音源を音響さんに渡す' : null),
  props: async (g, C, { E }) => {
    const ok = num(E.prep.flip) >= 30;
    if (E.style === 'flip') await g.say(ok ? 'フリップを1枚ずつめくって、順番を確かめた。\n…よし、完璧。' : 'フリップを確かめた。\n…字が小さい。客席の奥から読めるだろうか。');
    else if (E.style === 'solo') await g.say(ok ? '帽子、メガネ、段ボールのカウンター。\n置き場所もばっちり。' : '…しまった、小道具がひとつ足りない。\nあるもので何とかするしかない。');
    else await g.say('「この音源、きっかけはマイクの前に立ったらでお願いします」\n音響さんが親指を立てた。');
  },
  usesProps: (E) => ['flip', 'solo', 'utaneta'].includes(E.style),
  soundLines: (g, E, rid, rules) => [
    '音響です。登場の出囃子と、ネタ終わりの暗転のきっかけを確認させてください。',
    E.style === 'flip' ? 'フリップ台は、マイクの右に置きます。めくる音はマイクが拾いますので。' : E.style === 'utaneta' ? '歌の音源は、イントロからでいいですか？' : 'スタンドマイク1本です。動き回るなら、ハンドマイクにもできます。',
  ],
  stageFx: (E, rules) => ({ mic: true, flip: E.style === 'flip' ? 'R-1' : null, zabuton: rules.Y === 2002 }),
  debayashiLine: (g, E, rid) => (rulesR1(R1.seasonY(g) || cdate(g).year).Y === 2002 ? '♪──出囃子。\n座布団の上に、すっと座る。' : '♪──出囃子が鳴った！\nスポットライトの中へ、ひとりで歩き出す。'),
  afterLine: (g, res, tot) => (tot.total >= 80 ? 'ドッカーン！！\nひとりで、劇場全体を揺らした！' : tot.total >= 60 ? 'ウケた！笑い声が、ちゃんと返ってきた。' : '…静かだ。自分の声だけが、劇場に響いていた。'),
  loseTip: 'ネタを書き直し、場数を踏んで、また来年。',
  chooseNextDate: async (g, C, { S, E, rd }) => {
    const opts = C.cal(g, S.Y).rounds[rd.id] || [];
    if (opts.length < 2 || g.auto) return 0;
    const k = await g.ask(`${rd.name}の会場は？`, opts.map((d) => `${dateText(d.m, d.d)}　${VENUE[d.venue](S.Y, rd.id)}`), { cancel: 0 });
    return clamp(k, 0, opts.length - 1);
  },
  partnerAfter,
  mc: mcR1,
  judges: judgesR1,
  pressLines: (g, S) => [`${rulesR1(S.Y).title}、決勝進出おめでとうございます！`, 'ひとりで戦ってきて、いまの気持ちは？'],
  catchcopy: catchR1,
  vtr: (g, S) => {
    const E = S.entry;
    const s = R1.state(g);
    const a = actInfo(g);
    return `${a.amateur ? 'アマチュア' : `芸歴${geireki(g, S.Y)}年・${a.agencyName || 'フリー'}`}。${E.solo ? `コンビ「${a.name}」の${g.state.name}が、ひとりで挑む。` : ''}${num(s.me.entries) > 1 ? `R-1出場${s.me.entries}回目。` : '初出場で決勝へ。'}ネタは${STYLE_JA[E.style] || 'ピン芸'}。`;
  },
  openLines: (g, S, r) => [`さあ始まりました、${r.title}！`, `エントリー総数${S.Y === 2026 ? '6,171人' : '約' + n0(Math.round(S.entries / 10) * 10) + '人'}。その頂点に立つ、たったひとりが今夜決まります！`],
  finalRivalLine: (g, S, n) => ((n.tags || []).includes('前年王者') ? '連覇しに来たで。…でも、あんたのネタ、準決勝で見てたわ。' : 'ひとりで4分。…お互い、最高のやつ見せよ。'),
  rivalNetaLine: (g, S, n, total, stageNo) => {
    const r = rngOf('rn', S.Y, n.id, stageNo);
    const how = total >= 86 ? '会場が爆発した！審査員も手をたたいて笑っている！' : total >= 80 ? '大きな笑いが何度も起きた！' : total >= 72 ? 'しっかりウケている。' : '後半、少し失速…。';
    return `${n.name}の${netaTitle(r, n.style, S.Y)}。\n${how}`;
  },
  finalNote: (g, S, F) => (S.Y === 2002 ? '座布団の上の第1回' : ''),
  champScene: champSceneR1,
  afterParty: afterPartyR1,
  offers: offersR1,
  prepItems: prepItemsR1,
  text: TEXT,
});

// ================================================================ items, offers (fictional shows), the morning, the hub
registerItem('r1_trophy', { name: 'R-1のトロフィー', price: 0, desc: 'ひとり芸日本一の証。\nたったひとりで、日本中を笑わせた夜の記念。' });
registerRegular('r1_champ_tv', { title: 'ひとり芸人の夜明け', place: 'ktv', weekday: 2, medium: 'tv', pay: 45000, fame: 60, fans: 2500, minigame: 'tsukkomi', skill: 'warai', stamina: 18, host: '関西テレビのプロデューサー', hostLook: LOOKS.director, desc: '関西テレビの深夜バラエティ。ピン芸人がひとりで体を張る。' });
registerRegular('r1_champ_radio', { title: 'ひとりしゃべりの夜', place: 'mbs', weekday: 4, medium: 'radio', pay: 25000, fame: 30, fans: 1500, minigame: 'talk', skill: 'talk', stamina: 12, host: 'ラジオ局のディレクター', hostLook: LOOKS.ad, desc: '深夜のひとりしゃべりラジオ。' });
kitMorning('r1', (g) => R1.morning(g));
registerContestApp(R1, { id: 'r1', name: 'R-1', color: '#c8102e', glyph: 'R-1', order: 57 });

// ================================================================ D1's registry (def.selfRun: R-1 runs its own world)
// D1 never simulates R-1, posts none of its generic news and freezes nothing; it reads status / historyList / rivalsOf, and the
// format of each year through roundsOf / scheduleOf (our 復活ステージ = D1's `revival` on the final round, shown on its calendar).
function d1RoundsOf(Y) {
  const r = rulesR1(Y);
  if (!r.held) return null;
  const E = entriesR1(Y, () => 0.5);
  const val = (v, d) => Math.round(typeof v === 'function' ? v(E) : num(v, d));
  const rev = r.rounds.find((x) => x.id === 'rev');
  return r.rounds.filter((x) => x.id !== 'rev').map((rd) => ({
    id: rd.id, name: rd.name, when: rd.dates.map((d) => [d[1], d[2]]), venues: rd.dates.map((d) => (d[3] === 'osaka' ? '大阪' : d[3] === 'studio' ? (Y <= 2004 ? '大阪' : '東京') : '東京')),
    length: rd.length, field: rd.final ? r.final.finalists : val(rd.field, 40), pass: rd.final ? 1 : val(rd.pass, 10), judge: rd.final ? 'panel' : 'staff', announce: 'now',
    ...(rd.final ? { tv: true, final: true, judges: r.final.judges, scoring: r.final.format === 'block3pt' ? '持ち点3の振り分け' : '100点×' + r.final.judges, stage: 'studio', ...(r.final.advance ? { stage2: { top: r.final.advance, name: 'ファイナルステージ', judge: 'vote' } } : {}) } : {}),
    ...(rd.final && rev ? { revival: true, revivalPass: rev.pass, revivalName: '復活ステージ', revivalJudge: 'panel' } : {}),
  }));
}
function d1ScheduleOf(Y) {
  const r = rulesR1(Y);
  if (!r.held) return null;
  return { entry: { from: r.cal.entryFrom.slice(1, 3), to: r.cal.entryTo.slice(1, 3) }, final: r.rounds.find((x) => x.id === 'final').dates[0].slice(1, 3) };
}
const ENTRY_COUNT = { 2002: 351, 2025: 5511, 2026: 6171 }; // the real totals we could verify
registerContest('r1', {
  name: 'R-1グランプリ', names: [{ from: 2002, name: 'R-1ぐらんぷり' }, { from: 2021, name: 'R-1グランプリ' }], short: 'R-1', kind: 'pin', category: 'major', color: '#c8102e',
  organizer: '吉本興業・関西テレビ', broadcaster: '関西テレビ・フジテレビ系', venue: '決勝スタジオ（生放送）', region: 'all', own: 'E3', labelStyle: 'year',
  history: { founded: 2002, ended: null, gaps: [[2003, 2003]], revived: null, note: '', sources: ['https://ja.wikipedia.org/wiki/R-1グランプリ', 'https://www.r-1gp.com/', 'https://natalie.mu/owarai/award/r-1gp'] },
  revive: false, selfRun: true, repeat: true, // repeat winners were real (2007 and 2008)
  editionOf: (y) => rulesR1(y).edition,
  // the defaults (D1 asks roundsOf / scheduleOf with each cycle's year)
  schedule: d1ScheduleOf(2027), rounds: d1RoundsOf(2027), roundsOf: (y) => safe(() => d1RoundsOf(y), null), scheduleOf: (y) => safe(() => d1ScheduleOf(y), null),
  entryCount: (y) => ENTRY_COUNT[y] ?? null,
  eligibility: Object.assign((g, unit, year) => safe(() => { const el = R1.cfg.eligibility(g, actInfo(g), year ?? (R1.seasonY(g) || cdate(g).year), R1.state(g)); return { ok: !!el.ok, why: el.why || '' }; }, { ok: true, why: '' }), { note: 'ひとりで演じる芸（ピン芸）。細かな出場資格はその年の募集要項のとおり' }),
  fee: { pro: 2000, amateur: 2000 }, feeText: '1人2,000円',
  prize: (y) => rulesR1(y).prize,
  perform: { kind: 'pin', length: 240 },
  news: [(g, ctx) => safe(() => `${rulesR1((ctx && ctx.year) || 2027).title}：${rulesR1((ctx && ctx.year) || 2027).eligText}`, '')],
  catchcopy: (g, ctx) => safe(() => catchR1(g, R1.season(g, (ctx && ctx.year) || R1.seasonY(g) || cdate(g).year), 'player'), ''),
  // D1's 「今日の予定」 calls flow without a mode (ask); g.contestGo-style calls carry ctx.option and ctx.mode
  flow: (g, ctx) => R1.go(g, { mode: ctx && ctx.option ? ctx.mode : undefined }),
  entry: (g) => R1.entry(g),
  onMorning: (g) => runKitMorning(g),
  status: (g) => safe(() => R1.d1Status(g), null),
  historyList: (g) => safe(() => R1.historyList(g), []),
  rivalsOf: (g, round, n, year) => safe(() => R1.rivalsOf(g, round, n, year), []),
  rulesOf: rulesR1,
});

// ================================================================ g.r1()
const methods = {
  // the state summary (the notebook, other modules, the README): { now, season, title, edition, entry, wins, finals, entries, log, champions }
  r1() { return R1.status(this); },
};
export function installR1(proto) { for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k)); }
installR1(Game.prototype);
export { rulesR1 as rules, TEXT as R1_TEXT };
void sizeFor; void card; void T; void para; void R; void box; void alpha; void drawBig; void faceAt; void gauss; void isKansai; void devWord; void randomLook;
