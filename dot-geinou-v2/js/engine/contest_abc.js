// ABC漫才・落語新人コンクール → ABCお笑い新人グランプリ → ABCお笑いグランプリ — 朝日放送の若手の賞レースの完全再現 (owner: E3).
// State st.abcgp, public g.abcgp(). The engine (season, rounds, scenes) is r1_flow.js; this file is the contest's real rules by
// era, its Osaka look, texts and news.
//
// VERIFIED (WebSearch, 2026-10; ja.wikipedia ABCお笑いグランプリ, お笑いナタリー, ORICON, ABEMA TIMES, デイリー, FANY Magazine,
// qjweb, reachhyappatu / dorama.tank.jp summaries):
//  - 1980年創設 (朝日放送). 名称: 1980–1988「ABC漫才・落語新人コンクール」, 1989–2011「ABCお笑い新人グランプリ」, 2012年 (第33回) から
//    「ABCお笑いグランプリ」. 毎年開催 (第33回=2012, 第39回=2018, 第40回=2019, 第41回=2020, 第47回=2026 → 第N回 = 年 − 1979).
//    (BRIEF4 said showa 1987 is the 新人グランプリ era; the sources say 1988 was still the コンクール — 1989 the 新人グランプリ.)
//  - 旧大会 (〜2011): 関西を中心に活動する結成5年以内のコンビが対象, 落語家はデビュー10年以内. 決勝は成人の日.
//  - 2012〜: デビュー10年以内 (メンバーの誰かがプロデビューした年から), 関西に限らず全国の若手のピン・コンビ・グループ, ジャンル不問
//    (漫才・コント・ピン芸). 決勝は1月最終週の日曜日 (第36回は第3週) → のちに7月: 2018-07-08, 2019-07-21, 2020-07-12, 2021-07-11,
//    2022-07-10, 2026-07-26 (ABCテレビ 生放送, ABEMAでも配信; 2026: 14:30〜17:30).
//  - 予選: 2018 1次選考 → 最終予選60組; 2019 最終予選 6/19; 2021 最終予選のネタ時間4分; 2023 最終予選45組; 2025 二次選考 → 準決勝42組;
//    2026 準決勝40組 (6/16 ABEMA PPV 生配信), エントリー583組 (2018: 570組).
//  - 決勝: 12組が4組ずつA・B・Cの3ブロック (2023, 2026), ブロック1位がファイナルステージ. 審査員5人×100点 (500点満点) の年がある;
//    2026 審査員7人, 新ルール「ノックアウト・サバイバル」(各ブロック1組目と2組目に審査員が投票し、勝った組が次の組と対戦), ファイナルステージは
//    700点満点 (100点×7). 優勝賞金100万円 (2026) + 副賞. 2026 決勝進出12組のポスタービジュアル, 大阪・梅田の巨大屋外広告.
//  - 朝日放送は2018年に認定放送持株会社化し、テレビは朝日放送テレビ（ABCテレビ）.
// NOT VERIFIED (kept generic, said so here): 参加費 (no fee found → この大会は参加費なしとして扱う), 2012–2016 と 2017 の決勝の時期の境目
//   (2017年から7月とした), 旧大会の決勝の組数・審査方式・賞の名前 (「優勝」と10組の一発勝負・審査員5人として扱う), 2012–2024 の各年の審査員の人数
//   (5人とした), 一次・二次選考のネタ時間 (3分とした), 決勝のネタ時間 (4分とした), 旧大会の賞金 (金額を示さず「トロフィーと副賞」). DVD・後番組は扱わない.
//   Entry counts of unverified years are this game's world (shown as 約). Everyone in the contest is fictional.
import { Game } from './game.js';
import { registerContest, CONTESTS } from './contests.js';
import { registerRegular, PEOPLE } from './life.js';
import { LOOKS } from './sprites.js';
import { registerItem } from './state.js';
import { clamp } from './util.js';
import {
  has, safe, num, n0, plainYen, toInternal, rngOf, rint, pickR, cdate, dateText, dateTextY, unitName, pinName, randomLook,
  actInfo, agencyNames, geireki, unitYears, statOf, sendOffer, runKitMorning, kitMorning, shortfallReasons, performAct,
} from './r1_kit.js';
import { makeContest, registerContestApp, fmtLen } from './r1_flow.js';
import { stage, unstage, THEMES, T } from './r1_scenes.js';

// ================================================================ the rules of each year
const CACHE = {};
const VENUE = {
  osaka: (Y, rid) => (rid === 'final' ? (Y >= 2018 ? 'ABCテレビ（大阪・福島）' : '朝日放送（大阪）') : '大阪会場'),
  tokyo: () => '東京会場',
  studio: (Y) => (Y >= 2018 ? 'ABCテレビ 決勝スタジオ' : '朝日放送 決勝スタジオ'),
};
export function nameABC(Y) { return Y <= 1988 ? 'ABC漫才・落語新人コンクール' : Y <= 2011 ? 'ABCお笑い新人グランプリ' : 'ABCお笑いグランプリ'; }
export function rulesABC(Y) {
  if (CACHE[Y]) return CACHE[Y];
  const held = Y >= 1980;
  const ed = Y - 1979;
  const name = nameABC(Y);
  const neo = Y >= 2012;
  const july = Y >= 2017;
  const P = Y - 1;
  const r = {
    Y, held, edition: held ? ed : null, name, title: `第${ed}回 ${name}`, theme: neo ? 'abcnew' : 'abcold',
    organizer: Y >= 2018 ? '朝日放送テレビ（ABCテレビ）' : '朝日放送', broadcast: Y >= 2020 ? 'ABCテレビ 生放送（ABEMAでも配信）' : Y >= 2018 ? 'ABCテレビ 生放送' : '朝日放送 生放送',
    prize: neo ? 1000000 : 0, prizeText: neo ? '優勝賞金100万円＋副賞' : 'トロフィーと副賞', fee: 0, feeText: 'なし', sub: neo ? '若手芸人の登竜門' : Y <= 1988 ? '漫才・落語の新人の登竜門' : '関西の若手の登竜門',
    tagline: neo ? '10年目までの、いちばんおもしろい奴ら。' : '浪花の新人、ここに集え。',
    formTitle: '出場申込書', formSet: 'home', boardWhere: Y >= 2010 ? '公式サイト' : '朝日放送からの通知',
    formNote: neo ? '※デビュー10年以内（メンバーのだれかがプロデビューした年から数える）' : '※関西を中心に活動する若手。漫才は結成5年以内・落語はデビュー10年以内',
    pledge: '書いた内容に、まちがいはない？\n（ネタの映像・写真は放送に使われることがある）',
    mailText: Y >= 2010 ? '申込書を送信した。\n…受付の連絡が届いた！' : '申込書を朝日放送あてに郵送した。\n…数日後、受付の通知が届いた！',
    lastPrelim: 'sf',
  };
  r.eligText = Y <= 1988 ? '関西を中心に活動する若手の漫才師（コンビ結成5年以内）と落語家（デビュー10年以内）'
    : !neo ? '関西を中心に活動する結成5年以内のコンビ（漫才・コント）と、デビュー10年以内の落語家'
      : 'デビュー10年以内の若手芸人（メンバーのだれかがプロデビューした年から）。漫才・コント・ピン芸などジャンル不問、全国から';
  r.kinds = Y <= 1988 ? ['manzai', 'rakugo'] : !neo ? ['manzai', 'conte', 'rakugo'] : ['manzai', 'conte', 'pin'];
  if (july) {
    r.cal = { announce: [Y, 3, 3], entryFrom: [Y, 4, 1], entryTo: [Y, 4, 10] };
    if (Y >= 2025) {
      r.lastPrelimName = '準決勝';
      r.rounds = [
        { id: 'r1', name: '一次選考', dates: [[Y, 5, 3, 'osaka'], [Y, 5, 5, 'tokyo']], length: 180, field: (E) => E, pass: 120, mu: 42, sd: 12, fame: 4, stamina: 15 },
        { id: 'r2', name: '二次選考', dates: [[Y, 6, 2, 'osaka'], [Y, 6, 3, 'tokyo']], length: 180, field: 120, pass: Y === 2025 ? 42 : 40, mu: 58, sd: 8, fame: 8 },
        { id: 'sf', name: '準決勝', dates: [[Y, 6, 6, 'osaka']], length: 240, field: Y === 2025 ? 42 : 40, pass: 12, mu: 66, sd: 6, fame: 15, abema: Y >= 2026 },
        { id: 'final', name: '決勝', dates: [[Y, 7, 9, 'studio']], length: 240, tv: true, final: true },
      ];
    } else {
      r.lastPrelimName = '最終予選';
      const sfN = Y === 2018 ? 60 : Y === 2023 ? 45 : 50;
      r.rounds = [
        { id: 'r1', name: '一次選考', dates: [[Y, 5, 3, 'osaka'], [Y, 5, 5, 'tokyo']], length: 180, field: (E) => E, pass: sfN, mu: 44, sd: 12, fame: 5, stamina: 15 },
        { id: 'sf', name: '最終予選', dates: [[Y, 6, 6, 'osaka']], length: 240, field: sfN, pass: 12, mu: 64, sd: 7, fame: 15 },
        { id: 'final', name: '決勝', dates: [[Y, 7, 8, 'studio']], length: 240, tv: true, final: true },
      ];
    }
  } else {
    // the January final (成人の日 until 2011, the last Sunday of January 2012–2016): the season starts the autumn before
    r.cal = { announce: [P, 9, 3], entryFrom: [P, 10, 1], entryTo: [P, 10, 10] };
    r.lastPrelimName = '最終予選';
    r.rounds = [
      { id: 'r1', name: neo ? '一次選考' : '予選', dates: neo ? [[P, 11, 4, 'osaka'], [P, 11, 6, 'tokyo']] : [[P, 11, 5, 'osaka']], length: 180, field: (E) => E, pass: neo ? 50 : 30, mu: neo ? 44 : 40, sd: 12, fame: 4, stamina: 15 },
      { id: 'sf', name: '最終予選', dates: [[P, 12, 5, 'osaka']], length: 240, field: neo ? 50 : 30, pass: neo ? 12 : 10, mu: 62, sd: 7, fame: 12 },
      { id: 'final', name: '決勝', dates: [[Y, 1, neo ? 9 : 5, 'studio']], length: 240, tv: true, final: true },
    ];
  }
  const J = Y >= 2025 ? 7 : 5;
  if (Y >= 2026) {
    r.final = {
      format: 'blockKO', blocks: 3, finalists: 12, judges: J, length: 240, judgeBase: 62, judgeK: 0.33, stage2: 'score', stage2Name: 'ファイナルステージ',
      formatText: '12組が4組ずつA・B・Cの3ブロック。「ノックアウト・サバイバル」：ブロックの1組目と2組目のネタのあと審査員7人が投票し、勝った組が次の組と対戦。勝ち残った3組がファイナルステージで、審査員7人×100点（700点満点）の得点で優勝が決まる',
    };
  } else if (neo) {
    r.final = {
      format: 'blockScore', blocks: 3, finalists: 12, judges: J, length: 240, judgeBase: 62, judgeK: 0.33, stage2: 'score', stage2Name: 'ファイナルステージ',
      formatText: `12組が4組ずつA・B・Cの3ブロックに分かれ、審査員${J}人が100点満点で採点（${J * 100}点満点）。各ブロック1位の3組がファイナルステージで、もう1本のネタの得点で優勝が決まる`,
    };
  } else {
    r.final = { format: 'oneshot', finalists: 10, judges: 5, length: 240, judgeBase: 62, judgeK: 0.33, formatText: '決勝に進んだ若手がネタを披露し、審査員の得点で優勝が決まる' };
  }
  Object.assign(r.final, {
    onair: Y >= 2026 ? '14時30分' : '昼', when: (cal) => (cal.final ? dateTextY(cal.final.y, cal.final.m, cal.final.d) : ''),
    finalistFame: neo ? 50 : 30, finalistFame2: neo ? 80 : 50, finalistFans: neo ? 3000 : 1500, champFame: neo ? 320 : 200, champFans: neo ? 15000 : 6000, studioSign: r.title,
  });
  r.notes = [
    Y === 1989 ? 'この年から「ABCお笑い新人グランプリ」に改称（それまでは「ABC漫才・落語新人コンクール」）。' : null,
    Y === 2012 ? 'この年から「ABCお笑いグランプリ」に。出場資格がデビュー10年以内に広がり、関西以外の若手・ピン芸人も出られるように。' : null,
    Y >= 2026 ? '決勝に新ルール「ノックアウト・サバイバル」。準決勝はABEMAで生配信。' : null,
    !neo ? '決勝は成人の日の生放送。' : null,
  ].filter(Boolean);
  CACHE[Y] = r;
  return r;
}
// entry counts (2018: 570組, 2026: 583組 are real; others this game's world, shown as 約)
function entriesABC(Y, rng) {
  const known = { 2018: 570, 2026: 583 };
  if (known[Y]) return known[Y];
  const base = Y <= 1988 ? 90 : Y <= 2011 ? 160 + (Y - 1989) * 4 : Y <= 2016 ? 420 : 560;
  return Math.round(base * (0.95 + rng() * 0.1));
}

// ================================================================ fictional people
const JL = {
  banjiro: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#8a6a2a', bottom: '#3a2a1a', jacket: true, glasses: true },
  yoneko: { hair: 'bob', hairColor: 'silver', skin: 'fair', top: '#c0452f', bottom: '#4a3a3a', skirt: true },
  katsumi: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#2a2a34', glasses: true },
  hajime: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#3a4a3a', bottom: '#2a2a34', jacket: true },
  fukumaru: { hair: 'bald', hairColor: 'black', skin: 'tan', top: '#3a5a8a', bottom: '#3a5a8a', kimono: '#e8b84a' },
  ken: { hair: 'cap', hat: '#0a6fd6', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#2a2a34' },
  haruka: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#ffd400', bottom: '#2a2a34', skirt: true },
  ryu: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#1e1e26', bottom: '#1e1e26', glasses: 'sun' },
};
const J0 = {
  banjiro: { name: '浪花ばんじろう', short: 'ばんじろう', title: '上方漫才の大御所', taste: 'manzai' },
  yoneko: { name: '天満ヨネ子', short: 'ヨネ子', title: '上方喜劇の女優', taste: 'conte' },
  katsumi: { name: '北浜カツミ', short: 'カツミ', title: '放送作家', taste: 'manzai' },
  hajime: { name: '住吉はじめ', short: 'はじめ', title: '漫才作家', taste: 'manzai' },
  fukumaru: { name: '笑楽亭ふく丸', short: 'ふく丸', title: '落語家', taste: 'rakugo' },
  ken: { name: '中之島ケン', short: 'ケン', title: 'コント師', taste: 'conte' },
  haruka: { name: '梅田ハルカ', short: 'ハルカ', title: '漫才師', taste: 'manzai' },
  ryu: { name: '天保山リュウ', short: 'リュウ', title: 'ピン芸人', taste: 'pin' },
};
const judgeOf = (k) => ({ ...J0[k], look: JL[k] });
function judgesABC(g, Y) {
  const champ = (y) => {
    const h = ABC.histOf(g, y) || pastHistory(y);
    return { name: h.champ, short: Array.from(h.champ).slice(0, 4).join(''), title: `元王者（第${y - 1979}回）`, taste: pickR(rngOf('ajt', y), ['manzai', 'conte']), look: randomLook(rngOf('look', h.champ, 0)) };
  };
  if (Y <= 2011) return ['banjiro', 'yoneko', 'katsumi', 'fukumaru', 'hajime'].map(judgeOf);
  if (Y <= 2024) return [...['katsumi', 'ken', 'haruka', 'hajime'].map(judgeOf), champ(2005)];
  return [...['katsumi', 'ken', 'haruka', 'hajime', 'ryu'].map(judgeOf), champ(2005), champ(2014)];
}
const MCS = {
  old: [{ name: '朝日放送アナウンサー 西宮あかね', look: LOOKS.announcer }, { name: 'お日さんアンテナ', look: LOOKS.comedian }],
  neo: [{ name: 'たこ焼きロケット', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#0a6fd6', bottom: '#1e1e26', jacket: true, tie: '#ffd400' } }, { name: 'ABCアナウンサー 芦屋ゆめ', look: LOOKS.announcer }],
};
const mcABC = (Y) => (Y <= 2011 ? MCS.old : MCS.neo);
function pastHistory(Y) {
  const r = rngOf('abchist', Y);
  const t = Y >= 2012 && r() < 0.15 ? 'pin' : r() < 0.15 ? 'trio' : 'combi';
  const champ = unitName(r, t);
  let runner = unitName(r, 'combi');
  if (runner === champ) runner = unitName(r, 'trio');
  return { champ, runner, champType: t, note: '' };
}

// ================================================================ the field
const KIND_JA = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語' };
function notableABC(rng, Y, i, ctx = {}) {
  const neo = Y >= 2012;
  const k = rng();
  const type = neo ? (k < 0.68 ? 'combi' : k < 0.82 ? 'trio' : 'pin') : k < 0.85 ? 'combi' : 'pin';
  const style = type === 'pin' ? (neo ? 'pin' : 'rakugo') : Y <= 1988 ? 'manzai' : rng() < 0.62 ? 'manzai' : 'conte';
  const tags = [];
  if (type === 'trio') tags.push('トリオ');
  if (neo && rng() < 0.3) tags.push(rng() < 0.5 ? '東京から参戦' : '大阪の劇場の若手');
  if (rng() < 0.12) tags.push(neo ? 'ラストイヤー' : '結成5年目');
  if (!ctx.dark && rng() < 0.15) tags.push('初出場');
  if (ctx.prev && ctx.prev.runner && i === 4) { tags.length = 0; tags.push('前年準優勝'); }
  const name = ctx.prev && ctx.prev.runner && i === 4 ? ctx.prev.runner : type === 'pin' && style === 'rakugo' ? `${pickR(rng, ['笑楽亭', '福来亭', '浪花亭', '天満亭'])}${pickR(rng, ['こまめ', 'ちょうちん', 'しじみ', 'たまご', 'ぽん吉', 'さくら'])}` : unitName(rng, type === 'pin' ? 'pin' : type);
  return { name, type, style, gender: rng() < 0.2 ? 'f' : 'm', tags: tags.slice(0, 2), agency: pickR(rng, agencyNames().filter((a) => a !== 'アマチュア')) };
}

// ================================================================ texts and news (≥ 25 unique lines a season)
const THEMES_NETA = ['たこ焼き屋', '大阪のおばちゃん', '新世界', '通天閣', '吉本の稽古場', '商店街の福引', '甲子園', '天神祭', '道頓堀', 'お好み焼き', '自転車の二人乗り', '関西弁講座', '銭湯', 'USJの行列', '大阪環状線', '寄席の楽屋', '家庭訪問', '動物園', '夏休みの宿題', '引退試合'];
function netaTitle(rng, kind) {
  const t = pickR(rng, THEMES_NETA);
  return kind === 'conte' ? `コント「${t}」` : kind === 'pin' ? `ピンネタ「${t}」` : kind === 'rakugo' ? `新作落語「${t}」` : `漫才「${t}」`;
}
function catchABC(g, S, id) {
  const r = rngOf('abccatch', S.Y, id);
  if (id === 'player') {
    const E = S.entry || {};
    const pool = { manzai: ['しゃべくりの新星', '浪花の掛け合いマシーン', 'センターマイクの申し子'], conte: ['コントの職人', '2人で世界を作る', '暗転の向こう側'], pin: ['ひとりで大阪を沸かす', 'マイク1本の反逆児'], rakugo: ['高座の新星', '古典を今に'] }[E.kind] || ['若手の大本命'];
    if (E.type === 'trio') pool.push('3人で、てっぺん');
    pool.push('デビュー10年以内、いちばんの衝撃');
    return pickR(r, pool);
  }
  const n = S.notables.find((x) => x.id === id) || {};
  const tagC = { 前年王者: '連覇しか見ていない', 前年準優勝: '去年の続きを、今日', ラストイヤー: '最後の年、最後の夏', 東京から参戦: '東京から殴り込み', 大阪の劇場の若手: '劇場の主役', トリオ: '3人の化学反応', ダークホース: '準決勝の台風の目', 初の決勝: '初めての大舞台' };
  for (const t of n.tags || []) if (tagC[t] && r() < 0.7) return tagC[t];
  return pickR(r, { manzai: ['しゃべくりの新星', '浪花の掛け合いマシーン'], conte: ['コントの職人', '世界観の魔術師'], pin: ['ひとりで大阪を沸かす'], rakugo: ['高座の新星'] }[n.style] || ['若手の大本命']);
}
function storyABC(g, S, rules) {
  const r = rngOf('abcstory', S.Y, g.state.day);
  const n = S.notables[rint(r, 0, Math.min(S.notables.length - 1, 30))];
  if (!n) return null;
  const neo = S.Y >= 2012;
  const L = [
    ['s1', () => `${n.name}（${n.agency}）、${rules.name}へ「今年こそ決勝の舞台へ」`],
    ['s2', () => (n.type === 'trio' ? `トリオの${n.name}、${rules.name}に「3人ならではのネタで」` : null)],
    ['s3', () => (n.tags.includes('東京から参戦') ? `東京の若手・${n.name}が大阪の賞レースに参戦「大阪の客席で笑いをとりたい」` : null)],
    ['s4', () => (n.tags.includes('大阪の劇場の若手') ? `大阪の劇場で毎日舞台に立つ${n.name}、「ホームで負けられない」` : null)],
    ['s5', () => (n.tags.includes('ラストイヤー') ? `ラストイヤーの${n.name}「${neo ? 'デビュー10年目' : '結成5年目'}、最後の挑戦」` : null)],
    ['s6', () => (n.style === 'conte' ? `${n.name}、コントの小道具を自作。段ボールでたこ焼き屋台を再現` : null)],
    ['s7', () => (n.style === 'manzai' ? `${n.name}、センターマイク一本の漫才で勝負「しゃべくりは大阪の宝」` : null)],
    ['s8', () => (n.style === 'pin' ? `ピン芸人の${n.name}、コンビ・トリオに混じって${rules.name}へ` : null)],
    ['s9', () => (n.style === 'rakugo' ? `若手落語家の${n.name}、新作落語で${rules.name}に挑む` : null)],
    ['s10', () => `${rules.name}、${rules.rounds[0].name}の会場は熱気。ネタ合わせの声が廊下まで`],
    ['s11', () => `${n.name}、劇場支配人から「今年の台風の目」と太鼓判`],
    ['s12', () => `${n.name}、ネタ見せで放送作家にダメ出しを受け「全部書き直した」`],
    ['s13', () => `${n.name}、相方の実家のたこ焼き屋でネタ合わせ`],
    ['s14', () => (neo ? `${rules.name}、全国からエントリー。デビュー10年以内の若手がしのぎを削る` : `${rules.name}、関西の若手が腕をきそう新春の舞台`)],
    ['s15', () => `${n.name}、新ネタを劇場でおろし手応え「ツカミで客席が割れた」`],
    ['s16', () => (n.tags.includes('初出場') ? `初出場の${n.name}、いきなり注目の的に` : null)],
    ['s17', () => `${n.name}「ABCの決勝は、関西の若手の夢」`],
    ['s18', () => (S.Y >= 2026 ? `${rules.name}決勝の新ルール「ノックアウト・サバイバル」に、${n.name}「1組目は不利？関係ない」` : null)],
  ];
  const free = L.filter(([k, f]) => !S.news[k] && f());
  if (!free.length) return null;
  const [k, f] = free[rint(r, 0, free.length - 1)];
  S.news[k] = g.state.day;
  return f();
}
const TEXT = {
  announce: (g, S, r, cal) => {
    const extra = r.Y === 1989 ? '今年から大会名は「ABCお笑い新人グランプリ」に。' : r.Y === 2012 ? '今年から「ABCお笑いグランプリ」に生まれ変わり、デビュー10年以内の全国の若手が対象に。' : r.Y >= 2026 ? '決勝に新ルール導入へ。' : '';
    return `${r.title}の開催が決定。出場申込は${dateTextY(cal.entryFrom.y, cal.entryFrom.m, cal.entryFrom.d)}から。${r.prize ? `優勝賞金${plainYen(r.prize)}。` : ''}${extra}`;
  },
  entryOpen: (g, S, r, cal) => `${r.title}の出場申込が始まった。${r.Y >= 2012 ? 'デビュー10年以内なら、ジャンル不問。' : '関西の若手の登竜門。'}締め切りは${dateText(cal.entryTo.m, cal.entryTo.d)}`,
  entryClose: (g, S, r) => `${r.title}、エントリーは${[2018, 2026].includes(S.Y) ? `${n0(S.entries)}組` : `約${n0(Math.round(S.entries / 10) * 10)}組`}。${r.rounds[0].name}が始まる`,
  roundDone: (g, S, rd, R0, r) => {
    const name = (id) => (id === 'player' ? (S.entry && S.entry.unitName) : (S.notables.find((x) => x.id === id) || {}).name);
    if (rd.id === 'sf') {
      const fins = R0.passed.map(name).filter(Boolean);
      return `${r.title} 決勝進出の${fins.length}組が決定！${fins.slice(0, 12).join('、')}${S.Y >= 2026 ? '。ポスタービジュアルも公開、大阪・梅田には巨大な屋外広告' : ''}`;
    }
    const next = r.rounds[r.rounds.indexOf(rd) + 1];
    const n = S.notables.find((x) => R0.passed.includes(x.id));
    return `${r.title} ${rd.name}の結果発表。${n0(R0.pass)}組が${next ? next.name : '次'}へ。${n ? `${n.name}も通過` : ''}`;
  },
  champion: (g, S, r) => {
    const F = S.final;
    if (!F) return `${r.title}の決勝が行われた`;
    if (F.champ === 'player') return `【速報】${r.title}、優勝は${F.champName}！${r.prize ? `優勝賞金${plainYen(r.prize)}を獲得` : ''}`;
    const n = S.notables.find((x) => x.id === F.champ) || {};
    return `【速報】${r.title}、優勝は${F.champName}！${KIND_JA[n.style] ? KIND_JA[n.style] + 'で頂点に。' : ''}準優勝は${F.runnerName}`;
  },
  after: (g, S, r) => (S.final && S.final.champ === 'player' ? `${r.name}王者・${S.final.champName}、関西の番組に引っ張りだこ「大阪の朝の情報番組、ぜんぶ出ました」` : `${r.name}王者・${S.final ? S.final.champName : ''}、劇場の出番が倍に`),
  story: storyABC,
};

// ================================================================ scenes of ABC's own
const MANAGER = { name: 'マネージャー', look: LOOKS.manager };
const WRITER = { name: '放送作家', look: { hair: 'cap', hat: '#0a6fd6', hairColor: 'black', skin: 'fair', top: '#5a5f6b', bottom: '#2a2a34', glasses: true } };
const ks = (p, kansai, std) => (p && p.kansai ? kansai : std);
async function unitScene(g, C, { rules, act }) {
  const members = [{ name: g.state.name, look: g.state.look }, ...act.partners.map((p) => ({ name: p.name, look: p.look, id: p.id, kansai: p.kansai }))];
  return { ok: true, unitName: act.name, solo: false, photos: members.map((m) => m.look), members };
}
async function partnerAfterABC() { /* ABC is entered as the act itself: the 相方 is there in every scene */ }
function prepItemsABC(g, C, { S, E, rules, act }) {
  const items = [];
  const neta = E.neta && has(g, 'neta') ? safe(() => g.neta(E.neta), null) : null;
  const practice = (n) => { E.prep.practice = clamp(num(E.prep.practice) + n, 0, 100); if (neta && has(g, 'practiceNeta')) safe(() => g.practiceNeta(neta.id, Math.round(n * 0.7))); g.notify(`仕上がり +${n}（${Math.round(E.prep.practice)}）`, { color: '#ffd400' }); };
  const p = act.partner;
  if (p) items.push({ label: `${p.short}とネタ合わせ`, set: 'cafe', sign: '稽古場（ネタ合わせ）', stamina: 10, cast: (gg) => [{ look: gg.state.look, x: 240, y: 150, k: 2, dir: 'right', bob: true }, ...act.partners.map((q, i) => ({ look: q.look, x: 350 + i * 70, y: 150, k: 2, dir: 'left', bob: true, phase: 6 }))],
    run: async (gg) => {
      await gg.say(ks(p, ['頭から通しで、もう一回いこか。', '…いまの間、ええやん。そこは本番も同じでいこ。'], ['頭から通しで、もう一回いこう。', '…いまの間、いいね。本番も同じでいこう。']), { name: p.name, look: p.look });
      safe(() => has(gg, 'unitHarmony') && gg.unitHarmony(1, `${rules.name}に向けてネタ合わせ`));
      practice(9);
    } });
  else items.push({ label: 'ひとりで稽古（鏡の前）', set: 'home', sign: '自宅（鏡の前で稽古）', stamina: 10, cast: (gg) => [{ look: gg.state.look, x: 330, y: 150, k: 2, dir: 'right', bob: true }, { look: gg.state.look, x: 444, y: 96, k: 2, dir: 'left' }],
    run: async (gg) => { await gg.say('鏡に向かって、頭から最後まで。\n…もう一回。'); practice(8); } });
  items.push({ label: act.agency ? '作家・マネージャーにネタ見せ' : '知り合いの作家にネタ見せ（謝礼）', set: 'cafe', sign: '事務所の会議室（ネタ見せ）', stamina: 6, cast: (gg) => [{ look: gg.state.look, x: 230, y: 150, k: 2, dir: 'right' }, { look: (act.agency ? MANAGER : WRITER).look, x: 360, y: 150, k: 2, dir: 'left' }],
    run: async (gg) => {
      const fee = act.agency ? 0 : toInternal(gg, 3000);
      if (fee && !gg.spend(fee)) { await gg.say('謝礼が払えない…。'); return; }
      const sf = shortfallReasons(gg, E.kind || 'manzai', null, { practice: E.prep.practice, need: 65 });
      await gg.say(['ネタ、見せてもらいました。', ...sf.slice(0, 2).map((x) => `${x}。`), '4分のネタは、最後の1分で勝負が決まる。'], act.agency ? MANAGER : WRITER);
      if (neta && has(gg, 'scoreNeta')) await safe(() => gg.scoreNeta(neta, { by: 'local' }), null);
      practice(5);
    } });
  if (E.kind === 'conte') items.push({ label: 'コントの小道具・衣装をそろえる', set: 'home', sign: '自宅（小道具づくり）', stamina: 6,
    run: async (gg) => {
      const cost = toInternal(gg, 2000);
      if (!gg.spend(cost)) { await gg.say('材料を買うお金がない…。'); return; }
      E.prep.flip = clamp(num(E.prep.flip) + 25, 0, 100);
      await gg.say(['段ボールと布で、セットを手作りした。', '暗転のあいだに置ける大きさに。']);
      gg.notify(`小道具の出来 ${Math.round(E.prep.flip)}`, { color: '#ffd400' });
    } });
  if (has(g, 'writeNeta')) items.push({ label: 'ネタを書き直す・新しく書く', set: 'home', sign: '自宅（ネタ帳）', stamina: 0, run: async (gg) => { const n = await safe(() => gg.writeNeta({ kind: E.kind || 'manzai', length: rules.rounds[0].length, forContest: 'abcgp' }), null); if (n && n.id) E.neta = n.id; } });
  items.push({ label: '劇場の出番で試す（ネタおろし）', set: 'hall', sign: '劇場（ネタおろし）', stamina: 15, cast: (gg) => stageCastABC(gg, E),
    run: async (gg, st) => {
      st.theme = THEMES[rules.theme];
      st.sign = '若手ライブ'; st.sub = 'ネタおろし';
      st.fx = { mic: E.kind !== 'conte' };
      await gg.say('劇場の若手ライブで、本番のネタを試す。');
      const res = await performAct(gg, { kind: E.kind || 'manzai', length: rules.rounds[0].length, practice: true, skip: !!gg.auto, title: 'ネタおろし', venue: { name: '劇場', size: 'small', crowd: 'warm', pressure: 20 } });
      await gg.say(res.score >= 70 ? 'ウケた！このくだりは本番でも使える。' : res.score >= 45 ? 'まずまず。後半を入れ替えよう。' : '…すべった。でも、どこがダメかはっきりした。');
      practice(res.score >= 70 ? 12 : 9);
    } });
  return items;
}
function stageCastABC(g, E) {
  const act = actInfo(g);
  const ps = act.partners;
  if (!ps.length) return [{ look: g.state.look, x: 288, y: 156, k: 2 }];
  const all = [{ look: g.state.look }, ...ps.map((p) => ({ look: p.look }))];
  const w = 70;
  return all.map((m, i) => ({ look: m.look, x: 320 - 32 - ((all.length - 1) / 2 - i) * w, y: 156, k: 2, dir: i === 0 ? 'right' : 'left' }));
}
async function champSceneABC(g, C, { S, E, st }) {
  const rules = rulesABC(S.Y);
  const act = actInfo(g);
  st.cast = [...stageCastABC(g, E), { look: mcABC(S.Y)[0].look, x: 500, y: 170, k: 1, dir: 'left' }];
  if (act.partner && !g.auto) await g.say(ks(act.partner, `${act.partner.short}「やった……やったで！！」\nふたりで抱き合った。`, `${act.partner.short}「やった……やったね！！」\nふたりで抱き合った。`));
  safe(() => has(g, 'unitHarmony') && g.unitHarmony(4, `${rules.name}で優勝`));
  await g.say(rules.prize ? `トロフィーと、優勝賞金${plainYen(rules.prize)}の目録を受け取った！` : 'トロフィーと副賞を受け取った！', { name: mcABC(S.Y)[0].name, look: mcABC(S.Y)[0].look });
  const k = await g.ask('MC「いまのお気持ちを！」', ['「大阪で、いちばんになれました！」', '「…（言葉にならない）」', '「賞金で、相方に焼肉おごります！」'], { cancel: 0 });
  await g.say(k === 0 ? 'スタジオがあたたかい拍手に包まれた。' : k === 1 ? 'スタジオがもらい泣き。…そして笑い。' : 'スタジオがドッと沸いた。');
  if (S.Y >= 2026) {
    const all = stageCastABC(g, E);
    const st2 = stage(g, { set: 'street', theme: THEMES.abcnew, sign: '大阪・梅田（数日後）', fx: { vision: (c, x, y, w, h) => { c.fillStyle = '#0a6fd6'; c.fillRect(x, y, w, h); c.fillStyle = '#ffd400'; c.fillRect(x, y + h - 30, w, 30); T(c, `${rules.title}　優勝`, x + w / 2, y + 8, 12, '#ffffff', 'center', w - 16); T(c, E.unitName, x + w / 2, y + h - 25, 16, '#06325e', 'center', w - 16); } }, cast: all.map((m, i) => ({ ...m, x: 320 - 16 - ((all.length - 1) / 2 - i) * 56, y: 66, k: 1, dir: 'down' })) });
    try { await g.say(['数日後──大阪・梅田。', `街頭の大きなビジョンに、${E.unitName}の顔が映っている。`]); } finally { unstage(g, st2); }
  }
}
async function afterPartyABC(g, C, { S, F, win }) {
  if (g.auto) return;
  const st = stage(g, { set: 'cafe', theme: THEMES[rulesABC(S.Y).theme], sign: '打ち上げ（福島の居酒屋）', cast: [{ look: g.state.look, x: 240, y: 150, k: 2, dir: 'right' }, ...F.order.filter((id) => id !== 'player').slice(0, 3).map((id, i) => ({ look: C.lookOf(C.find(S, id)), x: 330 + i * 60, y: 160, k: 1, dir: 'left', bob: true, phase: i * 8 }))] });
  try {
    const n = C.find(S, F.order.find((id) => id !== 'player' && id !== F.champ) || '') || C.find(S, F.champ);
    await g.say(win ? ['決勝のあとの打ち上げ。', '出場者みんなで、ジョッキを掲げた。「王者に、かんぱーい！」'] : ['決勝のあとの打ち上げ。', 'くやしさも、うれしさも、同じテーブルに。']);
    if (n) await g.say(win ? '…おめでとう。来年は、うちらが獲るで。' : 'おたくらの漫才、袖でずっと笑てたわ。\nまた劇場で会おな。', { name: n.name, look: C.lookOf(n) });
  } finally { unstage(g, st); }
}
function offersABC(g, C, { S, E }) {
  sendOffer(g, 'abc_champ_tv', `${E.unitName}さん、${rulesABC(S.Y).name}優勝おめでとうございます！\n関西の若手ネタ番組『なにわ笑いの花道』に、毎週出ていただけませんか？`, '関西の番組プロデューサー');
  sendOffer(g, 'abc_champ_radio', `${rulesABC(S.Y).name}王者に、深夜ラジオのレギュラーをお願いしたくて。\n『夜ふかし大阪』、どうでしょう！`, 'ラジオ局のディレクター');
}

// ================================================================ the contest
export const ABC = makeContest({
  id: 'abcgp', key: 'abcgp', label: 'ABC', appName: 'ABC', appTitle: 'ABCお笑いGP', color: '#0a6fd6', founded: 1980, foundedText: '1980年創設（朝日放送の若手の賞レース）',
  office: 'ABC 大会事務局', unitWord: '組', notables: 30, topStr: 82, defaultKind: 'manzai', prepSub: 'ネタ見せ・小道具', trophy: 'abc_trophy',
  rules: rulesABC, entries: entriesABC, notable: notableABC, pastHistory, kindOf: () => 'manzai',
  typeFromWorld: (u, t) => (u === 'trio' ? 'trio' : u === 'pin' ? 'pin' : 'combi'),
  kindLabel: (E) => KIND_JA[E.kind] || '漫才',
  eligibility(g, act, Y) {
    const r = rulesABC(Y);
    if (Y <= 2011) {
      if (act.type !== 'pin' && unitYears(g, Y) > 5) return { ok: false, why: `結成${unitYears(g, Y)}年。${r.name}は結成5年以内のコンビが対象。` };
      if (act.type === 'pin' && geireki(g, Y) > 10) return { ok: false, why: `芸歴${geireki(g, Y)}年。ピン（落語）はデビュー10年以内が対象。` };
      return { ok: true };
    }
    if (!act.amateur && geireki(g, Y) > 10) return { ok: false, why: `デビュー${geireki(g, Y)}年。${r.name}はデビュー10年以内の若手が対象。` };
    return { ok: true };
  },
  beforeEntry: unitScene,
  formRows(g, C, { act, pre, rules }) {
    return [
      [act.type === 'pin' ? '芸名' : act.type === 'trio' ? 'トリオ名' : 'コンビ名', pre.unitName],
      ['メンバー', pre.members.map((m) => m.name).join('・')],
      [rules.Y >= 2012 ? 'デビュー' : '結成', rules.Y >= 2012 ? `${geireki(g, rules.Y) + 1}年目` : `${unitYears(g, rules.Y) + 1}年目`],
      ['所属', act.agencyName || 'なし'],
      ['活動の拠点', g.state.profile && /大阪|京都|兵庫|奈良|和歌山|滋賀/.test(String(g.state.profile.pref || g.state.profile.home || '')) ? '関西' : rules.Y >= 2012 ? '全国' : '関西（大阪の劇場）'],
    ];
  },
  formQuestions(g, C, { rules, act }) {
    const cal = C.cal(g, rules.Y);
    let kinds = rules.kinds.filter((k) => (act.type === 'pin' ? k === 'pin' || k === 'rakugo' : k !== 'pin' && k !== 'rakugo'));
    if (!kinds.length) kinds = [rules.kinds[0]];
    const pref = act.style === 'conte' ? 'conte' : act.style === 'pin' ? 'pin' : 'manzai';
    const order = kinds.includes(pref) ? [pref, ...kinds.filter((k) => k !== pref)] : kinds;
    const qs = [{ id: 'kind', label: 'ネタのジャンル', text: 'どのジャンルで出る？', choices: order.map((k) => ({ label: KIND_JA[k], value: k })) }];
    const opts = cal.rounds.r1 || [];
    if (opts.length > 1) qs.push({ id: 'date', label: `${rules.rounds[0].name}の会場`, text: `${rules.rounds[0].name}の会場は？`, choices: opts.map((d, i) => ({ label: `${dateText(d.m, d.d)}　${VENUE[d.venue](rules.Y, 'r1')}`, value: i, show: `${dateText(d.m, d.d)} ${VENUE[d.venue](rules.Y, 'r1')}` })) });
    return qs;
  },
  entryNo(g, S, rules) {
    const cal = ABC.cal(g, rules.Y);
    const r = rngOf('abcno', rules.Y, g.state.day);
    const frac = clamp((g.state.day - cal.entryFrom.day + r()) / 10, 0, 1);
    return 1 + Math.round(frac * (S.entries - 1) * 0.9) + rint(r, 0, 8);
  },
  venueName: (Y, rid, v) => (VENUE[v] ? VENUE[v](Y, rid) : v || ''),
  roundCast: (g, S, rid) => {
    const al = ABC.alive(S, rid);
    const r = rngOf('acast', S.Y, rid, g.state.day);
    const pick = al.length ? [0, 1, 2, 3].map(() => al[rint(r, 0, al.length - 1)]) : [];
    return pick.filter((x, i, a) => x && a.indexOf(x) === i).map((n) => ({ name: n.name, look: ABC.lookOf(n), n }));
  },
  lobbyLine: (g, S) => (S.Y >= 2012 ? '\nロビーは、全国から来た若手でいっぱいだ。' : '\nロビーには、大阪の劇場でよく見る顔ぶれ。'),
  gakuyaLine: () => ['楽屋のあちこちで、コンビが向かい合ってネタ合わせ。', '関西弁のツッコミが、あちこちから聞こえる。'],
  rivalLine: (g, S, rid, o) => {
    const n = o.n || {};
    if ((n.tags || []).includes('前年王者')) return '去年獲った言うても、予選は予選。\n…いちばん緊張してるの、たぶんうちらやで。';
    if ((n.tags || []).includes('東京から参戦')) return '大阪の客席、こわいって聞いてたけど…\nあったかいですね。';
    return pickR(rngOf(S.Y, rid, n.name), ['おたがい、がんばろな。', '持ち時間、ほんま一瞬やで。', 'このあと、うちら出番やねん。手ぇ震えるわ。']);
  },
  awaseLabel: '最後のネタ合わせ',
  awase: async (g) => {
    const p = actInfo(g).partner;
    if (p) await g.say(ks(p, '頭だけ、もう一回合わせとこか。\n…よし。いける。', '頭だけ、もう一回合わせておこう。\n…よし。いける。'), { name: p.name, look: p.look });
    else await g.say('楽屋のすみで、ひとりでネタを通した。');
  },
  propsLabel: (E) => (E.kind === 'conte' ? '小道具・暗転の段取り確認' : null),
  props: async (g, C, { E }) => { await g.say(num(E.prep.flip) >= 30 ? '小道具の置き場所と、暗転の段取りを確認した。\n…ばっちり。' : '…小道具が、袖にうまく収まらない。\n手で持って出るしかない。'); },
  usesProps: (E) => E.kind === 'conte',
  soundLines: (g, E) => (E.kind === 'conte' ? ['音響です。コントの始まりは暗転から明転、きっかけは「はい」でいいですか？', '終わりの暗転は、オチのセリフのあとで。'] : ['音響です。出囃子が鳴ったら、センターマイクへどうぞ。', 'マイクの高さ、合わせておきましょうか？']),
  stageFx: (E) => ({ mic: E.kind !== 'conte', zabuton: E.kind === 'rakugo' }),
  stageCast: (g, E) => stageCastABC(g, E),
  debayashiLine: (g, E) => (E.kind === 'conte' ? '暗転──。\n明かりがつくと、コントの世界が始まる。' : E.kind === 'rakugo' ? '♪──出囃子。\n高座へ、すっと上がる。' : '♪──出囃子が鳴った！\n「どうもー！」センターマイクへ駆け出す！'),
  afterLine: (g, res, tot) => (tot.total >= 80 ? 'ドッカーン！！\n大阪の客席が、波のように揺れた！' : tot.total >= 60 ? 'ウケた！大阪の客は、ちゃんと笑ってくれた。' : '…大阪の客席は、正直だった。'),
  loseTip: '劇場で場数を踏んで、また来年。',
  chooseNextDate: async (g, C, { S, rd }) => {
    const opts = C.cal(g, S.Y).rounds[rd.id] || [];
    if (opts.length < 2 || g.auto) return 0;
    const k = await g.ask(`${rd.name}の会場は？`, opts.map((d) => `${dateText(d.m, d.d)}　${VENUE[d.venue](S.Y, rd.id)}`), { cancel: 0 });
    return clamp(k, 0, opts.length - 1);
  },
  partnerAfter: partnerAfterABC,
  mc: mcABC,
  judges: judgesABC,
  pressLines: (g, S) => [`${rulesABC(S.Y).title}、決勝進出おめでとうございます！`, S.Y >= 2026 ? 'ポスタービジュアルの撮影もありますので、このあとスタジオへ！' : '決勝への意気込みを聞かせてください！'],
  catchcopy: catchABC,
  vtr: (g, S) => {
    const E = S.entry;
    const a = actInfo(g);
    return `${S.Y >= 2012 ? `デビュー${geireki(g, S.Y) + 1}年目` : `結成${unitYears(g, S.Y) + 1}年目`}・${a.agencyName || 'フリー'}。${a.partners.length ? `${a.partners.map((p) => p.short).join('・')}と${g.state.name}の${a.type === 'trio' ? 'トリオ' : 'コンビ'}。` : ''}ネタは${KIND_JA[E.kind] || '漫才'}。`;
  },
  openLines: (g, S, r) => [`${r.title}、決勝！`, r.Y >= 2012 ? `デビュー10年以内、エントリー${[2018, 2026].includes(S.Y) ? n0(S.entries) : '約' + n0(Math.round(S.entries / 10) * 10)}組の頂点が、今日決まります！` : '関西の若手の頂点が、今日決まります！'],
  finalRivalLine: (g, S, n) => ((n.tags || []).includes('前年王者') ? '連覇しに来たで。…でも、おたくらのネタ、準決勝で見てたわ。' : '4分、全部出し切ろな。'),
  rivalNetaLine: (g, S, n, total, stageNo) => {
    const r = rngOf('arn', S.Y, n.id, stageNo);
    const how = total >= 86 ? 'スタジオが爆発した！審査員も前のめりで笑っている！' : total >= 80 ? '大きな笑いが何度も起きた！' : total >= 72 ? 'しっかりウケている。' : '後半、少し失速…。';
    return `${n.name}の${netaTitle(r, n.style)}。\n${how}`;
  },
  champScene: champSceneABC,
  champLooks: (g) => [g.state.look, ...actInfo(g).partners.map((p) => p.look)],
  afterParty: afterPartyABC,
  offers: offersABC,
  prepItems: prepItemsABC,
  text: TEXT,
});

// ================================================================ items, offers (fictional shows), the morning, the hub
registerItem('abc_trophy', { name: 'ABCのトロフィー', price: 0, desc: '大阪の若手の登竜門で、いちばんになった証。' });
registerRegular('abc_champ_tv', { title: 'なにわ笑いの花道', place: 'ktv', weekday: 3, medium: 'tv', pay: 30000, fame: 45, fans: 1800, minigame: 'tsukkomi', skill: 'warai', stamina: 16, host: '関西の番組プロデューサー', hostLook: LOOKS.director, desc: '関西の若手ネタ番組。' });
registerRegular('abc_champ_radio', { title: '夜ふかし大阪', place: 'mbs', weekday: 0, medium: 'radio', pay: 18000, fame: 25, fans: 1000, minigame: 'talk', skill: 'talk', stamina: 12, host: 'ラジオ局のディレクター', hostLook: LOOKS.ad, desc: '関西の深夜ラジオ。' });
kitMorning('abcgp', (g) => { syncDef(g); return ABC.morning(g); });
registerContestApp(ABC, { id: 'abcgp', name: 'ABC', color: '#0a6fd6', glyph: 'ABC', order: 58 });

// ================================================================ D1's registry (getters on the season in play, as for R-1)
function d1RoundsOf(Y) {
  const r = rulesABC(Y);
  const E = entriesABC(Y, () => 0.5);
  const val = (v, d) => Math.round(typeof v === 'function' ? v(E) : num(v, d));
  return r.rounds.map((rd) => ({
    id: rd.id, name: rd.name, when: rd.dates.map((d) => [d[1], d[2]]), venues: rd.dates.map((d) => (d[3] === 'tokyo' ? '東京' : '大阪')),
    length: rd.length, field: rd.final ? r.final.finalists : val(rd.field, 40), pass: rd.final ? 1 : val(rd.pass, 10), judge: rd.final ? 'panel' : 'staff', announce: 'now',
    ...(rd.final ? { tv: true, final: true, judges: r.final.judges, scoring: `100点×${r.final.judges}`, stage: 'studio', ...(r.final.format !== 'oneshot' ? { stage2: { top: 3, name: 'ファイナルステージ', judge: 'panel' } } : {}) } : {}),
  }));
}
let curY = 2026;
const DEF = {
  name: 'ABCお笑いグランプリ', names: [{ from: 1980, name: 'ABC漫才・落語新人コンクール' }, { from: 1989, name: 'ABCお笑い新人グランプリ' }, { from: 2012, name: 'ABCお笑いグランプリ' }], short: 'ABC', kind: 'any', category: 'kansai', prestige: 70, color: '#0a6fd6',
  organizer: '朝日放送テレビ（ABCテレビ）', broadcaster: 'ABCテレビ', venue: 'ABCテレビ（大阪・福島）', region: 'all', own: 'E3',
  history: { founded: 1980, ended: null, gaps: [], revived: null, note: '1980年「ABC漫才・落語新人コンクール」として創設、1989年「ABCお笑い新人グランプリ」、2012年から「ABCお笑いグランプリ」', sources: ['https://ja.wikipedia.org/wiki/ABCお笑いグランプリ', 'https://natalie.mu/owarai/news/682508', 'https://www.oricon.co.jp/news/2469479/full/'] },
  revive: false,
  editionOf: (y) => (y >= 1980 ? y - 1979 : null),
  seasonOf: (date) => (rulesABC(date.year + 1).rounds.find((x) => x.id === 'final').dates[0][0] === 1 && date.month >= 9 ? date.year + 1 : date.year),
  scheduleOf: (y) => rulesABC(y).cal, rulesOf: rulesABC, roundsOf: d1RoundsOf,
  eligibility: (g, unit, year) => { const el = ABC.cfg.eligibility(g, actInfo(g), year ?? (ABC.seasonY(g) || cdate(g).year), ABC.state(g)); return { ok: el.ok, why: el.why || '' }; },
  fee: 0,
  prize: (y) => rulesABC(y).prize, prizeText: '優勝賞金100万円＋副賞',
  perform: { kind: 'any', length: 240 },
  news: [() => `${rulesABC(curY).title}：${rulesABC(curY).eligText}`, '大阪の若手の夏（冬）が、今年も始まる。'],
  catchcopy: (g, ctx) => catchABC(g, ABC.season(g, (ctx && ctx.year) || ABC.seasonY(g) || cdate(g).year), 'player'),
  flow: (g, ctx) => ABC.go(g, ctx),
  entry: (g) => ABC.entry(g),
  onMorning: (g) => { syncDef(g); return runKitMorning(g); },
  status: (g) => ABC.status(g),
};
const sigOf = (Y) => JSON.stringify([d1RoundsOf(Y).map((x) => [x.when, x.length, x.field, x.pass]), rulesABC(Y).cal.entryFrom.slice(1), rulesABC(Y).cal.entryTo.slice(1), rulesABC(Y).name]);
let sig = '';
const yNow = () => { const y = ABC.liveY(curY); return y >= 1980 ? y : curY; };
function registerDef() {
  registerContest('abcgp', DEF);
  const d = CONTESTS.abcgp;
  if (!d) return;
  Object.defineProperty(d, 'schedule', { enumerable: true, configurable: true, get: () => { const r = rulesABC(yNow()); return { entry: { from: r.cal.entryFrom.slice(1, 3), to: r.cal.entryTo.slice(1, 3) }, final: r.rounds.find((x) => x.id === 'final').dates[0].slice(1, 3) }; } });
  Object.defineProperty(d, 'rounds', { enumerable: true, configurable: true, get: () => d1RoundsOf(yNow()) });
  Object.defineProperty(d, 'eligibilityNote', { enumerable: true, configurable: true, get: () => rulesABC(yNow()).eligText });
}
export function syncDef(g) {
  const Y = (g && g.state && safe(() => ABC.seasonY(g), null)) || null;
  curY = Y && Y >= 1980 ? Y : 2026;
  const s0 = sigOf(curY);
  if (s0 !== sig) { sig = s0; registerDef(); }
}
registerDef();
sig = sigOf(curY);

// ================================================================ g.abcgp()
const methods = {
  // the state summary: { now, season, title, edition, entry, wins, finals, entries, log, champions }
  abcgp() { syncDef(this); return ABC.status(this); },
};
export function installABC(proto) { for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k)); }
installABC(Game.prototype);
export { rulesABC as rules, TEXT as ABC_TEXT };
void PEOPLE; void pinName; void statOf; void fmtLen;
