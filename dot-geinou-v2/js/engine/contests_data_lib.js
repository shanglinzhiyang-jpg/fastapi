// 賞レースのデータ・共通部品 (owner: D2a) — used by contests_data_a.js / contests_data_b.js (imported via contests_data.js).
// Everything here talks to other modules only through the CONTRACT4 g.* API, always feature-detected with a local fallback:
//   g.perform / g.performSim (C), g.unit / g.unitYears / g.geireki / g.unitPower / g.shortfall / g.addStageExp (A),
//   g.contestRivals / g.contestJudges / g.contestNews / g.contestEntry (D1), MINIGAMES.ogiri (C) / 'talk' (existing).
// Parts:
//   names        fictional combi / person names (no real people; every entrant, judge and 進行役 is made up)
//   Board        an HD 640x360 backdrop scene (studio + scoreboards: ranking, 1対1 match, 100人投票, IPPON buttons, サイコロ,
//                布団, groups, bracket, chairs, awards, title card). Flows push it, update board.data, talk on top, pop it.
//   perform      the player's performance (g.perform → minigame fallback → local sim), rival scores (g.performSim → local)
//   rounds       stdRound(spec) = a whole 予選-style round (beats → perform → ranking → 実力不足 reasons → result)
//   misc         wareki, era devices, state (st.contestsData, lazy), news, お任せ prompt, eligibility helpers.
// Round run() result (what D1's runner records): { passed, score, rank, place, field, champion?, award?, note?, detail? }

import { MINIGAMES, rankFor } from './minigame.js';
import { SW, SH, clamp, mulberry32 } from './util.js';
import { text, panel, rect, measure, wrap, COLORS, sparkle } from './draw.js';
import { charSheetHD, LOOKS } from './sprites.js';
import { isRealNameLike } from './contests_gen.js'; // D1's real-name guard (pure module)
// the current in-game year (D1's contestDate is the same calendar; kept local so this file never depends on D1's load order)
export function contestYear(g) {
  try { if (g && typeof g.gameDate === 'function') { const d = g.gameDate(); if (d && Number.isFinite(d.year)) return d.year; } } catch (e) { /* fall back */ }
  const st = g && g.state;
  const base = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 }[(st && st.profile && st.profile.era) || 'reiwa'] || 2026;
  const n = Math.max(0, ((st && st.day) || 1) - 1);
  return base + Math.floor((3 + Math.floor(n / 10)) / 12);
}
const contestDate = (g) => ({ year: contestYear(g) });

// ------------------------------------------------------------------ basics
export const has = (g, fn) => !!g && typeof g[fn] === 'function';
export function rngFor(g, ...salt) {
  const s = String(salt.join('|')) + '|' + ((g && g.state && g.state.day) || 0) + '|' + ((g && g.state && g.state.name) || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return mulberry32(h >>> 0);
}
export const pickR = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
export function gauss(r) { let u = 0; for (let i = 0; i < 6; i++) u += r(); return (u - 3) / 1.0; } // ≈ N(0, 0.7)
export function shuffleR(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const yearOf = (g, ctx) => (ctx && ctx.year) || contestDate(g).year;
// D1's ctx.round is the round INDEX (ctx.cycle.rounds[i] = { idx, r, id, name, options }); accept an object too
export function roundInfo(ctx) {
  if (!ctx) return { id: '', name: '', idx: null, def: null };
  const R = ctx.round;
  if (R && typeof R === 'object') return { id: R.id || '', name: R.name || '', idx: Number.isFinite(R.idx) ? R.idx : null, def: R.r || R };
  const idx = Number.isFinite(R) ? R : null;
  const cr = idx != null && ctx.cycle && Array.isArray(ctx.cycle.rounds) ? ctx.cycle.rounds[idx] : null;
  const dr = idx != null && ctx.def && Array.isArray(ctx.def.rounds) ? ctx.def.rounds[idx] : null;
  return { id: (cr && cr.id) || (dr && dr.id) || (idx != null ? `r${idx + 1}` : ''), name: (cr && cr.name) || (dr && dr.name) || '', idx, def: dr };
}
export const rid = (ctx) => roundInfo(ctx).id;
export const rname = (ctx) => roundInfo(ctx).name;
export function wareki(y) {
  if (y >= 2019) return `令和${y - 2018 === 1 ? '元' : y - 2018}年`;
  if (y >= 1989) return `平成${y - 1988 === 1 ? '元' : y - 1988}年`;
  return `昭和${y - 1925}年`;
}
export const nendo = (y) => wareki(y).replace('年', '年度');
// era by year (the four starts: 1987 showa / 1996 heisei_early / 2004 heisei / 2026 reiwa)
export function eraOfYear(y) { return y < 1989 ? 'showa' : y < 2000 ? 'heisei_early' : y < 2019 ? 'heisei' : 'reiwa'; }
// what people carry: 手帳 (showa / early heisei) → ケータイ → スマホ
export function deviceOf(y) { return y < 1997 ? '手帳' : y < 2010 ? 'ケータイ' : 'スマホ'; }
export function mediaOf(y) { return y < 1997 ? '新聞のラテ欄' : y < 2006 ? 'ワイドショー' : y < 2012 ? 'お笑いブログ' : 'SNS（ドッター）'; }
export function ordinal(n) { return n == null ? '' : `第${n}回`; }

// ------------------------------------------------------------------ state (st.contestsData, lazy)
export function dstate(g) {
  const st = g && g.state;
  if (!st) return { seen: {}, best: {}, titles: {}, logs: {} };
  if (!st.contestsData || typeof st.contestsData !== 'object') st.contestsData = {};
  const d = st.contestsData;
  for (const k of ['seen', 'best', 'titles', 'logs']) if (!d[k] || typeof d[k] !== 'object') d[k] = {};
  return d;
}
export function yearLog(g, id, year) {
  const d = dstate(g);
  const k = `${id}:${year}`;
  if (!d.logs[k] || typeof d.logs[k] !== 'object') d.logs[k] = {};
  // keep the log small: only the last ~60 contest-years
  const keys = Object.keys(d.logs);
  if (keys.length > 60) delete d.logs[keys[0]];
  return d.logs[k];
}
export function addTitle(g, id, label) {
  const d = dstate(g);
  if (!Array.isArray(d.titles[id])) d.titles[id] = [];
  d.titles[id].push({ label, year: contestDate(g).year, day: g.state && g.state.day });
}

// ------------------------------------------------------------------ fictional names
const CA = ['ナポリ', '三日月', 'ガラパゴス', 'うどん', 'さざなみ', 'カメレオン', 'トンボ', 'クレヨン', 'おでん', 'ロケット',
  'モンブラン', 'ゴリラ', 'ジャンボ', 'たまご', 'スパイス', 'カスタネット', 'わさび', 'ネオン', 'ペンギン', 'あじさい', '銀河',
  'ポン酢', '月見', 'ハイボール', '夜行', '回転', 'すずらん', '天竺', '鉄板', 'ぬか床', '晴天', '路地裏', '雷', 'ちくわ', '琥珀',
  '湯けむり', '大吉', '百貨', '一番星', '梅干し', '駄菓子', 'メロンパン', 'ハンモック', 'たこ焼き', '屋形船'];
const CB = ['ブラザーズ', 'クラブ', '軍団', 'パンチ', 'ハウス', '座', '商会', 'エンジン', 'ドロップ', 'カーニバル', 'ステーション',
  '団地', 'ファクトリー', '劇場', 'タイフーン', 'ジェット', '食堂', 'ぶらり', '研究所', 'サーカス', 'ランド', '倶楽部', '急行', '組',
  'シスターズ', 'ハイツ', '音頭', 'ロード', '本舗', 'スタンド'];
const SOLO = ['なずな畑', 'ちりめん山椒', '令和ジャンクション', '夕焼け放送部', 'もずく酢', '粉もん同盟', 'しらす丼', 'ほうじ茶',
  'こんにゃく座', '二丁目ランプ', '朝焼けポスト', 'みかん箱', '小春日和', '大入り袋', 'ひだまり荘', 'つくだ煮'];
const FAM = ['朝霧', '柿沼', '鳴海', '早乙女', '九条', '真壁', '葛城', '久遠', '柊', '芦屋', '宍戸', '三雲', '御厨', '東雲', '鷲尾',
  '雛森', '能登', '嵯峨', '渦巻', '百目鬼', '千草', '白鷺', '桐生', '一ノ瀬', '花房', '左京', '水無瀬', '梓川', '轟', '月ヶ瀬'];
const GIV = ['典膳', 'ひかる', '総一郎', 'いずみ', '慎平', '麻里子', '剛志', 'かおる', '千景', '大吾', '晴美', '正太郎', '乙葉', '吾郎',
  '冬馬', '小夜', '銀次', 'つばさ', '茂', '佳代', '弥生', '鉄平', '若菜', '寅彦', 'ゆかり', '紋次郎', 'みどり', '健吾', '菊乃', '与一'];
const RAKUGO = ['亭', '家', '風亭', '遊亭', '舎'];
const RAKUGO_A = ['春風', '桂木', '月の', '松葉', '柳原', '三笑', '笑福', '林家', '金原', '古今']; // generic yago parts (no real name)
const realSafe = (gen) => (r) => { let n = gen(r); for (let k = 0; k < 12 && safeReal(n); k++) n = gen(r); return n; };
const safeReal = (n) => { try { return !!isRealNameLike(n) || !!isRealNameLike(String(n).replace(/\s+/g, '')); } catch (e) { return false; } };
export const combiName = realSafe((r) => (r() < 0.12 ? pickR(SOLO, r) : pickR(CA, r) + pickR(CB, r)));
export const personName = realSafe((r) => `${pickR(FAM, r)} ${pickR(GIV, r)}`);
// 亭号 made of parts that form no real 亭号 (no 春風亭・笑福亭・三遊亭・古今亭・柳亭・月亭…)
export const rakugoName = realSafe((r) => `${pickR(['梅', '竹', '鶴', '星', '霞', '雲', '汐', '楓', '萩', '凪'], r)}${pickR(['丸', '輔', '蔵', '吉', '之', '朝', '光', '波', '香', '石'], r)}亭 ${pickR(['小', '若', '新', ''], r)}${pickR(['ぽん', '鶴', '平', '喬', '虎', '蝶', '鹿', '丈', '雁', '燕'], r)}`);
void RAKUGO; void RAKUGO_A;
export const JUDGE_TITLES = ['漫才師（芸歴40年）', 'コント師', '放送作家', 'ピン芸人', '演出家', '落語家', '劇場支配人', '元・賞レース王者', '構成作家', 'お笑い評論家'];

// ------------------------------------------------------------------ the player's act
export function unitOf(g) {
  try { if (has(g, 'unit')) { const u = g.unit(); if (u) return u; } } catch (e) { console.error(e); }
  const st = (g && g.state) || {};
  return { id: 'solo', type: 'pin', name: st.name || 'あなた', members: [{ id: 'player', name: st.name || 'あなた', role: 'pin', look: st.look }], style: 'pin', harmony: 50, amateur: !st.agency, agency: st.agency || null };
}
export const unitName = (g) => (unitOf(g).name || (g.state && g.state.name) || 'あなた');
export const unitSize = (g) => { const u = unitOf(g); return (u.members && u.members.length) || (u.type === 'combi' ? 2 : u.type === 'trio' ? 3 : 1); };
export function unitYears(g, year) {
  try { if (has(g, 'unitYears')) { const v = g.unitYears(year); if (Number.isFinite(v)) return v; } } catch (e) { console.error(e); }
  return 0;
}
export function geireki(g, year) {
  try { if (has(g, 'geireki')) { const v = g.geireki(year); if (Number.isFinite(v)) return v; } } catch (e) { console.error(e); }
  return 0;
}
export function power(g, kind) {
  try { if (has(g, 'unitPower')) { const v = g.unitPower(kind); if (Number.isFinite(v)) return v; } } catch (e) { console.error(e); }
  const w = Number(g && g.state && g.state.skills && g.state.skills.warai) || 0;
  return clamp(Math.round(w * 0.6), 0, 100);
}
export function stat(g, key) {
  try { if (has(g, 'comedyStat')) { const v = g.comedyStat(key); if (Number.isFinite(v)) return v; } } catch (e) { console.error(e); }
  return power(g, 'any');
}
export const fame = (g) => Number(g && g.state && g.state.fame) || 0;
export function partnerLook(g) {
  const u = unitOf(g);
  const m = (u.members || []).find((x) => x && x.id !== 'player');
  return m && m.look;
}
export const playerLook = (g) => (g && g.state && g.state.look) || LOOKS.player;
export function isKansai(g) {
  const st = (g && g.state) || {};
  const pf = st.profile || {};
  if (/大阪|京都|兵庫|奈良|和歌山|滋賀|osaka|kyoto|hyogo|nara|wakayama|shiga|kobe/i.test(String(pf.home || pf.prefecture || pf.hometown || ''))) return true;
  if (st.agency && /osaka|namba|kansai/i.test(String(st.agencyBase || st.base || ''))) return true;
  const fl = st.flags || {};
  return !!(fl.visited && (fl.visited.namba || fl.visited.osaka_tv || fl.visited.shinkigeki));
}

// 実力不足: concrete reasons (A's g.shortfall, else a local reading of the stats)
export function shortfallText(g, kind, need = 55) {
  try {
    if (has(g, 'shortfall')) {
      const s = g.shortfall(kind, need);
      if (s && s.gaps && s.gaps.length) return s.text || s.gaps.slice(0, 3).map((x) => `${x.label}（${x.have}/${x.need}）`).join('、');
    }
  } catch (e) { console.error(e); }
  return '';
}
const FLAW = {
  low: ['ツカミが弱く、最初の30秒で客が離れた', '声量が足りず、後ろの席まで届かなかった', '大事なところで噛んだ', 'ボケの数が少なく、ネタの構成が平板だった',
    '間が詰まりすぎて、笑いを待てなかった', '尺オーバーでネタの途中で終了の合図', 'オチが弱く、拍手笑いにならなかった', 'ネタ合わせ不足でテンポがずれた'],
  mid: ['後半の展開がもう一段ほしかった', '天丼が一回多かった', '客層（年配が多い回）にネタが合わなかった', '前の組の爆笑で空気が持っていかれた',
    'ツッコミの言葉選びがありきたり', '設定の説明が長く、ボケ始めが遅い'],
  high: ['細部の精度で上位にわずかに届かなかった', '審査員の好みが割れた', '出番順（トップバッター）の不利が響いた'],
};
export function flawLines(g, kind, score, r) {
  const pool = score < 45 ? FLAW.low : score < 70 ? FLAW.mid : FLAW.high;
  const a = shuffleR(pool, r).slice(0, 2);
  const sf = shortfallText(g, kind);
  if (sf) a.push(`実力不足：${sf}`);
  return a;
}

// ------------------------------------------------------------------ other modules (feature-detected)
export function news(g, ctx, textOrFn, cat) {
  const t = typeof textOrFn === 'function' ? textOrFn(g, ctx) : textOrFn;
  if (!t) return;
  try {
    if (has(g, 'contestNews')) g.contestNews(t, { contest: ctx && ctx.id, cat: cat || 'contest' });
    else if (has(g, 'message')) g.message({ from: 'お笑いニュース', text: t, kind: 'news' });
  } catch (e) { console.error(e); }
}
const isStubName = (s) => /^(ライバル|審査員)\d+$/.test(String(s || ''));
// rivals: D1's (when it returns real-looking people) else local fictional ones around `level` (0..100 power)
export function rivals(g, ctx, n, opts = {}) {
  const level = opts.level ?? 50;
  const r = rngFor(g, ctx && ctx.id, rid(ctx), 'rivals', opts.salt || '');
  let list = null;
  try {
    if (has(g, 'contestRivals')) {
      const got = g.contestRivals(ctx && ctx.id, roundInfo(ctx).idx ?? 0, n);
      if (Array.isArray(got) && got.length && !got.every((x) => isStubName(x && x.name))) list = got.slice(0, n);
    }
  } catch (e) { console.error(e); }
  if (!list) list = [];
  // D1's world field is kept (names, tags, order) but never weaker than this round's level: a TV final's acts are strong
  if (opts.level != null) list = list.map((x) => ({ ...x, power: Math.max(Number(x.power) || 0, clamp(Math.round(level + gauss(r) * (opts.spread ?? 10)), 5, 99)) }));
  list = list.map((x) => (safeReal(x.name) ? { ...x, name: opts.rakugo ? rakugoName(r) : combiName(r) } : x));
  const seen = new Set(list.map((x) => x.name));
  while (list.length < n) {
    let name = opts.rakugo ? rakugoName(r) : combiName(r);
    for (let k = 0; seen.has(name) && k < 8; k++) name = opts.rakugo ? rakugoName(r) : combiName(r);
    seen.add(name);
    const tags = [];
    if (r() < 0.12) tags.push('初出場');
    if (r() < 0.08) tags.push('ラストイヤー');
    if (opts.amateur && r() < 0.2) tags.push('アマチュア');
    list.push({ name, unit: opts.rakugo ? 'pin' : (r() < 0.8 ? 'combi' : r() < 0.5 ? 'trio' : 'pin'), kind: opts.kind || 'manzai',
      power: clamp(Math.round(level + gauss(r) * (opts.spread ?? 12)), 5, 99), tags, agency: null });
  }
  // a spread of strengths: the head of the list a bit stronger (seeded favourites)
  return list.map((x, i) => ({ ...x, power: clamp(Math.round((x.power ?? level) + (opts.favourites && i < 2 ? 6 : 0)), 1, 99) }));
}
export function judges(g, ctx, n, titles = JUDGE_TITLES) {
  const r = rngFor(g, ctx && ctx.id, 'judges', yearOf(g, ctx));
  let list = null;
  try {
    if (has(g, 'contestJudges')) {
      const got = g.contestJudges(ctx && ctx.id, yearOf(g, ctx), n);
      if (Array.isArray(got) && got.length && !got.every((x) => isStubName(x && x.name))) list = got.slice(0, n);
    }
  } catch (e) { console.error(e); }
  if (!list) list = [];
  const seen = new Set(list.map((x) => x.name));
  while (list.length < n) {
    let name = personName(r);
    for (let k = 0; seen.has(name) && k < 8; k++) name = personName(r);
    seen.add(name);
    list.push({ name, title: pickR(titles, r), taste: pickR(['正統派好き', '発想重視', '技術重視', '熱量重視', '新しさ重視'], r) });
  }
  return list;
}
// a rival's score for this round (C's sim when present)
export function rivalScore(g, rv, o, r) {
  const pw = rv.power ?? 50;
  try {
    if (has(g, 'performSim')) {
      const res = g.performSim({ kind: o.kind || rv.kind || 'manzai', power: pw, quality: clamp(pw + gauss(r) * 8, 0, 100), rng: r, length: o.length });
      if (res && Number.isFinite(res.score)) return clamp(Math.round(res.score), 0, 100);
    }
  } catch (e) { console.error(e); }
  return clamp(Math.round(pw + gauss(r) * 9), 0, 100);
}

// ------------------------------------------------------------------ the player's performance
// o: { kind, length (sec), venue: { name, size, crowd, pressure }, title, skip, mode, minigame }
export async function perform(g, ctx, o = {}) {
  const kind = o.kind || 'manzai';
  const contest = { id: ctx && ctx.id, round: rid(ctx), name: (ctx && ctx.def && ctx.def.name) || '' };
  let res = null;
  let viaPerform = false;
  // C's minigame for this kind may not be registered yet: then simulate (おまかせ) instead of an unknown-minigame error
  let skip = !!o.skip;
  try {
    if (!skip && !g.auto && has(g, 'performKinds')) {
      const pk = g.performKinds();
      const mg = pk && pk[kind] && pk[kind].minigame;
      if (mg && !MINIGAMES[mg]) skip = true;
    }
  } catch (e) { console.error(e); }
  try {
    if (has(g, 'perform')) {
      res = await g.perform({ kind, length: o.length, venue: o.venue, contest, title: o.title, skip, ...(o.extra || {}) });
      viaPerform = true;
    }
  } catch (e) { console.error(e); }
  if (!res || !Number.isFinite(res.score)) {
    const r = rngFor(g, contest.id, contest.round, 'self');
    const s = clamp(Math.round(power(g, kind) * 0.9 + gauss(r) * 8 + 5), 0, 100);
    res = { score: s, rank: rankFor(s), laughs: Math.round(s / 8), big: Math.round(s / 30), flubs: 0, blanks: 0, overtime: 0, comment: '', highlights: [] };
  }
  res.score = clamp(Math.round(res.score), 0, 100);
  res.rank = res.rank || rankFor(res.score);
  // C's g.perform already counts the stage (addStageExp + growth); only the local fallback does it here
  if (!viaPerform) { try { if (has(g, 'addStageExp')) g.addStageExp(kind, 1); } catch (e) { console.error(e); } }
  return res;
}
// an interactive minigame with a fallback score (talk / quiz banks, C's ogiri when present)
export async function playMinigame(g, id, opts, fallbackScore = 50) {
  if (g.auto || !MINIGAMES[id]) {
    if (!g.auto && !MINIGAMES[id]) console.warn('[contests_data] minigame missing', id);
    return { score: clamp(Math.round(fallbackScore), 0, 100), rank: rankFor(fallbackScore), sim: true };
  }
  try {
    const res = await g.minigame(id, opts);
    return { ...res, score: clamp(Math.round((res && res.score) ?? fallbackScore), 0, 100) };
  } catch (e) {
    console.error(e);
    return { score: fallbackScore, rank: rankFor(fallbackScore), sim: true };
  }
}
export const hasMinigame = (id) => !!MINIGAMES[id];

// 「自分で演じる / おまかせで進める」: the first time a round is always shown in full
export async function omakase(g, ctx, label = 'ネタ') {
  if (ctx && ctx.mode) return ctx.mode === 'auto' || !!g.auto; // D1's runner already asked 「どう進める？」
  const d = dstate(g);
  const key = `${ctx && ctx.id}:${rid(ctx)}`;
  const first = !d.seen[key];
  d.seen[key] = (d.seen[key] || 0) + 1;
  if (first || g.auto) return false;
  const i = await g.ask(`${label}はどうする？`, ['自分で演じる', 'おまかせで進める（結果だけ見る）'], { cancel: 0 });
  return i === 1;
}

// ------------------------------------------------------------------ the HD board scene
export const PAL = {
  bg: '#0b0f24', wall: '#1b2350', floor: '#2a2236', gold: '#ffd23f', cyan: '#5fd7ff', pink: '#ff7eb6', red: '#ff5d6c', green: '#5ee07a',
  dim: '#9aa3c7', white: '#ffffff', ink: '#20232a', panel: '#141b3c',
};
const R = (c, x, y, w, h, col) => rect(c, x, y, w, h, col);
export function fitText(ctx, str, maxW, size = 12, min = 9) {
  let s = String(str ?? '');
  let z = size;
  while (z > min && measure(ctx, s, z) > maxW) z--;
  if (measure(ctx, s, z) > maxW) {
    const ch = Array.from(s);
    while (ch.length > 1 && measure(ctx, ch.join('') + '…', z) > maxW) ch.pop();
    s = ch.join('') + '…';
  }
  return { s, size: z };
}
export function tx(ctx, str, x, y, maxW, opt = {}) {
  const f = fitText(ctx, str, maxW, opt.size || 12, opt.min || 9);
  text(ctx, f.s, x, y + Math.round(((opt.size || 12) - f.size) / 2), { ...opt, size: f.size });
}
function fig(c, look, x, y, dir = 'down', s = 1.5) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][0]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), Math.round(32 * s), Math.round(40 * s));
  } catch (e) { /* sprites optional */ }
}

export class Board {
  // spec: { title, sub, color, label (edition / 復刻), mode, data, set: 'studio'|'theater'|'hall'|'kouza'|'live'|'cheap' }
  constructor(g, spec = {}) {
    Object.assign(this, { g, t: 0, hd: true, opaque: true, hidesHud: true, isContestBoard: true });
    this.spec = { color: '#2a3a8a', mode: 'stage', data: {}, set: 'studio', ...spec };
  }
  // animations run on the game's frame counter: the board keeps moving while a message window is on top of it
  get now() { return (this.g && Number.isFinite(this.g.frame)) ? this.g.frame : this.t; }
  set(mode, data = {}) { this.spec.mode = mode; this.spec.data = data; this.t0 = this.now; return this; }
  patch(data) { Object.assign(this.spec.data, data); if (data && (data.rolling != null || data.fly != null || data.ippon != null)) this.t0 = this.now; return this; }
  update() { this.t++; }
  draw(c, g) {
    const sp = this.spec;
    try { drawSet(c, this.now, sp, g); } catch (e) { console.error(e); }
    try {
      const fn = MODES[sp.mode] || MODES.stage;
      fn(c, this.now - (this.t0 || 0), sp.data || {}, g, sp);
    } catch (e) { console.error(e); }
    // title plate
    const title = sp.title || '';
    const w = Math.min(420, Math.max(measure(c, title, 16), measure(c, sp.sub || '', 12)) + 30);
    panel(c, 8, 6, w, sp.sub ? 46 : 30, { bg: '#10142c', edge: sp.color || '#fff' });
    tx(c, title, 20, 12, w - 24, { size: 16, color: PAL.gold });
    if (sp.sub) tx(c, sp.sub, 20, 32, w - 24, { size: 12, color: '#d8dcf0' });
    if (sp.label) {
      const lw = Math.min(200, measure(c, sp.label, 12) + 22);
      panel(c, SW - lw - 8, 6, lw, 26, { bg: sp.revival ? '#5a2a10' : '#10142c', edge: sp.revival ? PAL.gold : '#fff' });
      tx(c, sp.label, SW - lw + 3, 12, lw - 20, { size: 12, color: sp.revival ? PAL.gold : '#d8dcf0' });
    }
  }
}
function drawSet(c, t, sp, g) {
  const col = sp.color || '#2a3a8a';
  R(c, 0, 0, SW, SH, PAL.bg);
  if (sp.set === 'kouza') {
    // 寄席の高座: 赤い毛氈、金屏風、めくり
    R(c, 0, 0, SW, 200, '#3a1a12');
    for (let i = 0; i < 6; i++) R(c, 120 + i * 68, 40, 64, 150, i % 2 ? '#d8b04a' : '#e6c25e');
    R(c, 0, 190, SW, 18, '#b8202a'); R(c, 0, 208, SW, 60, '#5a1a14');
    R(c, 270, 160, 100, 34, '#7a2a1a'); R(c, 276, 156, 88, 8, '#a83a2a');
    return;
  }
  if (sp.set === 'cheap') {
    // 低予算の特設ステージ（ベニヤ板、パイプ椅子）
    R(c, 0, 0, SW, 200, '#3d4250');
    for (let i = 0; i < 10; i++) R(c, i * 64, 0, 2, 200, '#4b5162');
    R(c, 0, 200, SW, 70, '#6b5a44');
    for (let i = 0; i < 12; i++) R(c, i * 56, 214, 40, 2, '#584a38');
    return;
  }
  // studio / theater / hall / live
  R(c, 0, 0, SW, 200, sp.set === 'theater' ? '#2a1420' : '#151b40');
  for (let i = 0; i < 16; i++) R(c, i * 40 + 6, 58, 28, 136, i % 2 ? col : shadeHex(col, -0.25));
  R(c, 0, 186, SW, 14, shadeHex(col, 0.25));
  // light beams
  c.save();
  c.globalAlpha = 0.08 + 0.04 * Math.sin(t / 30);
  c.fillStyle = '#fff6c8';
  for (const bx of [120, 320, 520]) { c.beginPath(); c.moveTo(bx - 8, 48); c.lineTo(bx + 8, 48); c.lineTo(bx + 70, 260); c.lineTo(bx - 70, 260); c.closePath(); c.fill(); }
  c.restore();
  R(c, 0, 200, SW, 70, PAL.floor);
  R(c, 0, 200, SW, 2, '#4a3a56');
  if (sp.set === 'live') for (let i = 0; i < 40; i++) sparkle(c, (i * 97 + t) % SW, 52 + ((i * 53) % 30), 1 + (i % 2), i % 3 ? PAL.cyan : PAL.pink);
}
function shadeHex(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v) => clamp(Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function audience(c, t, y = 236, n = 22, seed = 1) {
  for (let i = 0; i < n; i++) {
    const x = 8 + i * (SW - 16) / n + ((i * 37 + seed) % 9);
    const bob = Math.sin((t + i * 13) / 9) > 0.7 ? -2 : 0;
    R(c, x, y + bob, 18, 30, '#0d0a14');
    R(c, x + 3, y - 12 + bob, 12, 12, '#0d0a14');
  }
}
function mic(c, x, y) { R(c, x, y, 3, 52, '#c8ccd8'); R(c, x - 4, y - 6, 11, 8, '#2a2d36'); R(c, x - 10, y + 50, 23, 4, '#c8ccd8'); }
function box(c, x, y, w, h, edge = '#fff', bg = '#10142c') { panel(c, x, y, w, h, { bg, edge }); }

const MODES = {
  // center mic + the act (+ partner), audience
  stage(c, t, d, g, sp) {
    if (sp.set === 'kouza') {
      fig(c, d.look || playerLook(g), 290, 112, 'down', 1.5);
      box(c, 530, 70, 70, 120, '#fff', '#f2ead8');
      tx(c, d.mekuri || unitName(g), 548, 80, 40, { size: 12, color: PAL.ink, shadow: null });
      audience(c, t, 240);
      return;
    }
    mic(c, SW / 2 - 1, 150);
    const pl = d.look || playerLook(g);
    const pt = d.partner === false ? null : (d.partnerLook || partnerLook(g));
    if (pt) { fig(c, pl, SW / 2 - 66, 128, 'down', 1.5); fig(c, pt, SW / 2 + 18, 128, 'down', 1.5); } else fig(c, pl, SW / 2 - 24, 128, 'down', 1.5);
    if (d.caption) { box(c, 140, 66, 360, 30, sp.color); tx(c, d.caption, 152, 74, 336, { size: 12, color: '#fff' }); }
    audience(c, t, 240);
  },
  // big title card (opening): { name, edition, catch, date }
  card(c, t, d, g, sp) {
    const a = Math.min(1, t / 20);
    c.save(); c.globalAlpha = a;
    box(c, 70, 64, SW - 140, 150, sp.color || '#fff', '#0e1230');
    tx(c, d.name || sp.title, SW / 2 - 230, 82, 460, { size: 22, color: PAL.gold, align: 'left' });
    if (d.edition) tx(c, d.edition, 94, 118, 450, { size: 14, color: '#fff' });
    if (d.catch) {
      const lines = wrap(c, d.catch, SW - 200, 12).slice(0, 3);
      lines.forEach((ln, i) => text(c, ln, 94, 144 + i * 18, { size: 12, color: '#d8dcf0' }));
    }
    for (let i = 0; i < 6; i++) sparkle(c, 90 + ((i * 89 + t * 2) % (SW - 180)), 76 + ((i * 41) % 120), 2, PAL.gold);
    c.restore();
  },
  // ranking: { rows: [{ name, score, me, tag }], passLine: index (rows above pass), unit: '点', max }
  ranking(c, t, d, g, sp) {
    let rows = (d.rows || []).slice(0, 10);
    const meRow = (d.rows || []).find((x) => x.me);
    if (meRow && !rows.includes(meRow)) rows = [...rows.slice(0, 9), meRow];
    const show = Math.min(rows.length, Math.floor(t / 6) + 1);
    box(c, 40, 58, SW - 80, 26 + rows.length * 17 + 6, sp.color);
    tx(c, d.head || '結果', 54, 64, 300, { size: 12, color: PAL.gold });
    if (d.note) tx(c, d.note, 330, 64, SW - 390, { size: 11, color: PAL.dim });
    const max = d.max || 100;
    for (let i = 0; i < show; i++) {
      const rw = rows[i];
      const y = 83 + i * 17;
      if (d.passLine != null && i === d.passLine && (rw.place ?? i + 1) === i + 1) R(c, 50, y - 2, SW - 100, 1, PAL.red);
      if (rw.me) R(c, 48, y - 1, SW - 96, 17, 'rgba(255,210,63,0.18)');
      tx(c, `${rw.place ?? i + 1}`, 56, y, 26, { size: 12, color: rw.me ? PAL.gold : '#fff' });
      tx(c, rw.name, 84, y, 210, { size: 12, color: rw.me ? PAL.gold : '#fff' });
      if (rw.tag) tx(c, rw.tag, 300, y + 1, 90, { size: 10, color: PAL.cyan });
      const bw = 150;
      const fr = clamp((rw.score || 0) / max, 0, 1);
      R(c, 396, y + 3, bw, 9, '#2a2f55'); R(c, 396, y + 3, Math.round(bw * fr), 9, rw.me ? PAL.gold : rw.out ? '#6a7090' : PAL.cyan);
      tx(c, `${rw.score ?? ''}${d.unit || ''}`, 552, y, 40, { size: 12, color: '#fff' });
    }
    audience(c, t, 244, 20);
  },
  // 1対1: { a: { name, score, votes: {3,2,1}, me }, b: {...}, max, label, reveal: 0..1 }
  match(c, t, d, g, sp) {
    const rv = d.reveal == null ? Math.min(1, t / 60) : d.reveal;
    const max = d.max || 300;
    const side = (o, x, col) => {
      if (!o) return;
      box(c, x, 64, 260, 120, o.me ? PAL.gold : col);
      tx(c, o.name, x + 14, 74, 232, { size: 16, color: o.me ? PAL.gold : '#fff' });
      if (o.tag) tx(c, o.tag, x + 14, 96, 232, { size: 11, color: PAL.dim });
      const sc = Math.round((o.score || 0) * rv);
      tx(c, `${sc}`, x + 14, 112, 120, { size: 28, color: o.win && rv >= 1 ? PAL.gold : '#fff' });
      tx(c, `/${max}`, x + 100, 126, 60, { size: 12, color: PAL.dim });
      R(c, x + 14, 152, 232, 10, '#2a2f55'); R(c, x + 14, 152, Math.round(232 * clamp(sc / max, 0, 1)), 10, o.me ? PAL.gold : col);
      if (o.votes && rv >= 1) tx(c, `3点×${o.votes[3]}　2点×${o.votes[2]}　1点×${o.votes[1]}`, x + 14, 166, 232, { size: 11, color: '#d8dcf0' });
      if (o.win && rv >= 1) { tx(c, '勝ち抜け！', x + 160, 116, 96, { size: 14, color: PAL.gold }); for (let i = 0; i < 4; i++) sparkle(c, x + 30 + i * 60, 70 + ((t + i * 7) % 10), 2, PAL.gold); }
    };
    side(d.a, 34, PAL.cyan); side(d.b, SW - 294, PAL.pink);
    tx(c, 'VS', SW / 2 - 12, 110, 40, { size: 18, color: PAL.red });
    if (d.label) { box(c, SW / 2 - 140, 194, 280, 26, sp.color); tx(c, d.label, SW / 2 - 128, 200, 256, { size: 12, color: '#fff' }); }
    audience(c, t, 240);
  },
  // n-person vote grid: { n: 100, votes: [1..3], shown, who, label }
  votes(c, t, d, g, sp) {
    if (Array.isArray(d.sides)) {
      // 1対1: both acts' 100 votes, 10×10 each, filled as they are counted
      const shown = Math.min(100, Math.floor(t * 1.5));
      d.sides.forEach((s, k) => {
        const ox = k === 0 ? 70 : SW - 70 - 140; const oy = 76; const cell = 14;
        box(c, ox - 12, 56, 164, 186, s.me ? PAL.gold : k ? PAL.pink : PAL.cyan);
        tx(c, s.who || '', ox, 60, 140, { size: 12, color: s.me ? PAL.gold : '#fff' });
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          const v = i < shown ? (s.votes || [])[i] || 0 : 0;
          sum += v;
          R(c, ox + (i % 10) * cell, oy + Math.floor(i / 10) * cell, cell - 3, cell - 3, v === 3 ? PAL.gold : v === 2 ? PAL.cyan : v === 1 ? '#6a7090' : '#2a2f55');
        }
        tx(c, `${sum}点`, ox, oy + 144, 140, { size: 14, color: '#fff' });
      });
      // the legend sits on its own dark panel (readable over any backdrop)
      box(c, SW / 2 - 92, 108, 184, 98, sp.color || '#fff', '#0b0f24');
      tx(c, d.label || '', SW / 2 - 80, 118, 160, { size: 12, color: '#ffffff' });
      tx(c, '■3点 とても面白かった', SW / 2 - 80, 144, 160, { size: 11, color: PAL.gold });
      tx(c, '■2点 面白かった', SW / 2 - 80, 162, 160, { size: 11, color: PAL.cyan });
      tx(c, '■1点 面白くなかった', SW / 2 - 80, 180, 160, { size: 11, color: '#c8cce0' });
      return;
    }
    const n = d.n || 100;
    const votes = d.votes || [];
    const shown = Math.min(votes.length, d.shown == null ? Math.floor(t * 2) : d.shown);
    const cols = 20; const cell = 13;
    const ox = SW / 2 - (cols * cell) / 2; const oy = 74;
    box(c, ox - 14, 56, cols * cell + 28, Math.ceil(n / cols) * cell + 52, sp.color);
    tx(c, d.label || `${n}人の審査員`, ox, 60, cols * cell, { size: 12, color: PAL.gold });
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = i < shown ? votes[i] : 0;
      if (i < shown) sum += v || 0;
      const x = ox + (i % cols) * cell; const y = oy + 4 + Math.floor(i / cols) * cell;
      R(c, x, y, cell - 3, cell - 3, v === 3 ? PAL.gold : v === 2 ? PAL.cyan : v === 1 ? '#6a7090' : '#2a2f55');
    }
    const y2 = oy + 10 + Math.ceil(n / cols) * cell;
    tx(c, `${d.who || ''}　合計 ${sum}点`, ox, y2, cols * cell, { size: 12, color: '#fff' });
  },
  // IPPON: { odai, answer, judges: [{ name, pts }], need: 10, ippon: bool, count: { name: n } }
  ippon(c, t, d, g, sp) {
    box(c, 30, 54, SW - 60, 56, sp.color, '#0a0d22');
    tx(c, 'お題', 44, 60, 60, { size: 11, color: PAL.dim });
    const ol = wrap(c, d.odai || '', SW - 100, 13).slice(0, 2);
    ol.forEach((ln, i) => text(c, ln, 44, 74 + i * 16, { size: 13, color: '#fff' }));
    if (d.answer) { box(c, 70, 116, SW - 140, 34, PAL.gold, '#1a1430'); tx(c, `「${d.answer}」`, 84, 125, SW - 168, { size: 14, color: PAL.gold }); }
    const js = d.judges || [];
    const bw = Math.min(70, (SW - 80) / Math.max(1, js.length));
    let total = 0;
    js.forEach((j, i) => {
      const x = SW / 2 - (js.length * bw) / 2 + i * bw;
      const p = j.pts || 0; total += p;
      R(c, x + 8, 160, bw - 16, 30, '#2a2d36');
      R(c, x + 12, 164, bw - 24, 22, p >= 2 ? PAL.gold : p === 1 ? '#ffb347' : '#454a5e');
      tx(c, p ? `${p}` : '', x + bw / 2 - 4, 168, 20, { size: 13, color: PAL.ink, shadow: null });
      tx(c, j.name || '', x + 4, 194, bw - 8, { size: 9, color: '#d8dcf0' });
    });
    const need = d.need || 10;
    R(c, 120, 214, SW - 240, 12, '#2a2f55'); R(c, 120, 214, Math.round((SW - 240) * clamp(total / need, 0, 1)), 12, total >= need ? PAL.gold : PAL.cyan);
    tx(c, `${total}/${need}`, SW - 112, 212, 60, { size: 12, color: '#fff' });
    if (d.ippon) {
      const s = 1 + 0.1 * Math.sin(t / 3);
      c.save(); c.translate(SW / 2 + 150, 92); c.scale(s * 0.7, s * 0.7); c.rotate(-0.12);
      R(c, -110, -30, 220, 60, '#c81e2a'); R(c, -104, -24, 208, 48, '#fff');
      text(c, 'IPPON', 0, -18, { size: 32, align: 'center', color: '#c81e2a', shadow: null });
      c.restore();
    }
    if (d.score) tx(c, d.score, 40, 236, SW - 80, { size: 12, color: '#fff' });
  },
  // サイコロ: { faces: [names], face: index, rolling: bool, label }
  dice(c, t, d, g, sp) {
    const faces = d.faces || ['?'];
    const idx = d.rolling ? Math.floor(t / 4) % faces.length : (d.face || 0) % faces.length;
    const sz = 120; const x = SW / 2 - sz / 2; const y = 70 + (d.rolling ? Math.abs(Math.sin(t / 5)) * -16 : 0);
    R(c, x + 6, y + 6, sz, sz, 'rgba(0,0,0,0.4)');
    R(c, x, y, sz, sz, '#f4f1e8'); R(c, x + 4, y + 4, sz - 8, sz - 8, '#fffdf6');
    const name = faces[idx] || '';
    const lines = Array.from(name).length > 7 ? [Array.from(name).slice(0, 7).join(''), Array.from(name).slice(7, 14).join('')] : [name];
    lines.forEach((ln, i) => { const f = fitText(c, ln, sz - 16, 16); text(c, f.s, x + sz / 2, y + sz / 2 - 11 * lines.length + i * 22, { size: f.size, align: 'center', color: '#c81e2a', shadow: null }); });
    // side faces
    R(c, x + sz, y + 10, 18, sz - 10, '#d8d2c0'); R(c, x + 10, y - 14, sz - 10, 14, '#ebe5d4');
    if (d.label) { box(c, SW / 2 - 170, 204, 340, 26, sp.color); tx(c, d.label, SW / 2 - 158, 210, 316, { size: 12, color: '#fff' }); }
    // the round table of tellers
    const ppl = d.people || [];
    const pw = Math.floor((SW - 40) / Math.max(1, Math.min(8, ppl.length)));
    ppl.slice(0, 8).forEach((p, i) => { tx(c, p, 20 + i * pw + 2, 238, pw - 8, { size: 10, color: i === idx ? PAL.gold : PAL.dim }); });
  },
  // 布団: { odai, answer, writers: [bool,bool,bool], fly: bool, futons: { name: n }, label }
  futon(c, t, d, g, sp) {
    box(c, 30, 54, SW - 60, 50, sp.color, '#0a0d22');
    tx(c, `お題：${d.odai || ''}`, 44, 62, SW - 90, { size: 13, color: '#fff' });
    if (d.hint) tx(c, d.hint, 44, 82, SW - 90, { size: 11, color: PAL.dim });
    if (d.answer) { box(c, 90, 110, SW - 180, 30, PAL.gold, '#1a1430'); tx(c, `「${d.answer}」`, 104, 117, SW - 208, { size: 14, color: PAL.gold }); }
    const w = d.writers || [];
    for (let i = 0; i < 3; i++) {
      const x = 170 + i * 110;
      R(c, x, 150, 80, 22, '#2a2d36'); R(c, x + 4, 154, 72, 14, w[i] ? PAL.red : '#454a5e');
      tx(c, `作家${'ABC'[i]}`, x + 18, 176, 60, { size: 10, color: PAL.dim });
    }
    // the futon
    const fy = d.fly ? 200 - Math.min(170, (t % 90) * 4) : 206;
    c.save(); c.translate(SW / 2, fy); if (d.fly) c.rotate(Math.sin(t / 6) * 0.3);
    R(c, -60, -10, 120, 24, '#d84a6a'); for (let i = 0; i < 5; i++) R(c, -56 + i * 24, -6, 12, 16, '#f2b8c8');
    c.restore();
    if (d.score) tx(c, d.score, 40, 238, SW - 80, { size: 12, color: '#fff' });
  },
  // groups: { groups: [{ label, acts: [{ name, votes, me, win }] }], label }
  groups(c, t, d, g, sp) {
    const gs = d.groups || [];
    const w = Math.floor((SW - 40) / Math.max(1, gs.length));
    gs.forEach((gr, i) => {
      const x = 20 + i * w;
      box(c, x + 4, 58, w - 8, 150, sp.color);
      tx(c, gr.label || '', x + 16, 64, w - 30, { size: 13, color: PAL.gold });
      (gr.acts || []).forEach((a, k) => {
        const y = 86 + k * 28;
        if (a.win) R(c, x + 10, y - 2, w - 20, 22, 'rgba(255,210,63,0.22)');
        tx(c, a.name, x + 16, y + 2, w - 70, { size: 12, color: a.me ? PAL.gold : '#fff' });
        if (a.votes != null) tx(c, `${a.votes}票`, x + w - 54, y + 2, 40, { size: 12, color: a.win ? PAL.gold : PAL.dim });
      });
    });
    if (d.label) { box(c, 60, 214, SW - 120, 26, sp.color); tx(c, d.label, 72, 220, SW - 144, { size: 12, color: '#fff' }); }
  },
  // tournament bracket: { rounds: [[{ a, b, w, me }]], label }
  bracket(c, t, d, g, sp) {
    const rs = d.rounds || [];
    const cw = Math.floor((SW - 40) / Math.max(1, rs.length));
    rs.forEach((ms, ri) => {
      const x = 20 + ri * cw;
      const step = 172 / Math.max(1, ms.length);
      ms.forEach((m, mi) => {
        const y = 60 + mi * step + step / 2 - 16;
        box(c, x + 4, y, cw - 12, 34, m.me ? PAL.gold : sp.color);
        tx(c, m.a || '', x + 12, y + 4, cw - 28, { size: 10, color: m.w === m.a ? PAL.gold : '#fff' });
        tx(c, m.b || '', x + 12, y + 18, cw - 28, { size: 10, color: m.w === m.b ? PAL.gold : '#fff' });
      });
    });
    if (d.label) { box(c, 60, 236, SW - 120, 22, sp.color); tx(c, d.label, 72, 240, SW - 144, { size: 11, color: '#fff' }); }
  },
  // イス取りゲーム: { chairs: n, people: [{ name, seat|null, me }], music: bool }
  chairs(c, t, d, g, sp) {
    const n = d.chairs || 5;
    const ppl = d.people || [];
    const cx = SW / 2; const cy = 140; const rx = 170; const ry = 54;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx * 0.6; const y = cy + Math.sin(a) * ry * 0.6;
      R(c, x - 10, y - 4, 20, 14, '#8a6a3a'); R(c, x - 10, y - 16, 4, 14, '#8a6a3a');
      tx(c, `${i + 1}`, x - 3, y - 2, 12, { size: 10, color: '#fff' });
    }
    ppl.forEach((p, i) => {
      const a = d.music ? ((i / ppl.length) * Math.PI * 2 + t / 25) : (p.seat != null ? (p.seat / n) * Math.PI * 2 : (i / ppl.length) * Math.PI * 2);
      const r = p.seat != null && !d.music ? 0.6 : 1;
      const x = cx + Math.cos(a) * rx * r; const y = cy + Math.sin(a) * ry * r;
      R(c, x - 6, y - 22, 12, 12, p.me ? PAL.gold : p.seat == null && !d.music ? '#6a7090' : PAL.cyan);
      R(c, x - 5, y - 10, 10, 14, p.me ? '#d64161' : '#3a4a7a');
      tx(c, p.name, x - 34, y + 6, 68, { size: 9, color: p.me ? PAL.gold : '#fff' });
    });
    if (d.music) for (let i = 0; i < 5; i++) text(c, '♪', 60 + ((i * 120 + t * 2) % (SW - 120)), 70 + ((i * 31 + t) % 40), { size: 14, color: PAL.pink });
    if (d.label) { box(c, 60, 222, SW - 120, 26, sp.color); tx(c, d.label, 72, 228, SW - 144, { size: 12, color: '#fff' }); }
  },
  // awards: { rows: [{ award, name, me }], label }
  award(c, t, d, g, sp) {
    // trophy
    R(c, 80, 96, 60, 40, PAL.gold); R(c, 96, 136, 28, 18, '#d8a92a'); R(c, 86, 154, 48, 10, '#b88a1a');
    R(c, 70, 102, 10, 20, PAL.gold); R(c, 140, 102, 10, 20, PAL.gold);
    for (let i = 0; i < 5; i++) sparkle(c, 70 + ((i * 23 + t) % 90), 80 + ((i * 17) % 40), 2, '#fff');
    const rows = d.rows || [];
    box(c, 180, 58, SW - 210, 30 + rows.length * 24, sp.color);
    tx(c, d.head || '受賞者', 194, 64, 300, { size: 12, color: PAL.gold });
    rows.slice(0, 7).forEach((rw, i) => {
      const y = 88 + i * 24;
      tx(c, rw.award, 194, y, 150, { size: 12, color: PAL.cyan });
      tx(c, rw.name, 350, y, SW - 390, { size: 13, color: rw.me ? PAL.gold : '#fff' });
    });
    if (d.label) { box(c, 60, 222, SW - 120, 26, sp.color); tx(c, d.label, 72, 228, SW - 144, { size: 12, color: '#fff' }); }
  },
  // a phone / video audition: { take, best, label }
  video(c, t, d, g, sp) {
    box(c, SW / 2 - 150, 56, 300, 170, '#fff', '#05060c');
    R(c, SW / 2 - 140, 66, 280, 150, '#1a1f2e');
    fig(c, playerLook(g), SW / 2 - (partnerLook(g) ? 56 : 24), 112, 'down', 1.5);
    if (partnerLook(g)) fig(c, partnerLook(g), SW / 2 + 8, 112, 'down', 1.5);
    if (Math.floor(t / 30) % 2 === 0) { R(c, SW / 2 + 110, 76, 10, 10, PAL.red); }
    tx(c, `REC  TAKE ${d.take || 1}`, SW / 2 - 130, 72, 140, { size: 11, color: PAL.red });
    if (d.label) tx(c, d.label, SW / 2 - 140, 232, 280, { size: 12, color: '#fff' });
  },
};

export async function withBoard(g, spec, fn) {
  const b = new Board(g, spec);
  g.push(b);
  try { return await fn(b); } finally { g.pop(b); }
}
export const pause = (g, n = 30) => (g.auto ? Promise.resolve() : g.waitFrames(n));
export function boardSpec(ctx, round, extra = {}) {
  const def = (ctx && ctx.def) || {};
  const ed = ctx && ctx.edition;
  const label = ctx && ctx.revival ? `復刻開催 ${ed ? ordinal(ed) : ''}`.trim() : (def.editionLabel ? def.editionLabel(ctx.year) : (ed ? `${ctx.year}　${ordinal(ed)}` : `${ctx && ctx.year}`));
  return { title: nameOf(def, ctx && ctx.year), sub: round || (rname(ctx)) || '', color: def.color || '#2a3a8a', label, revival: !!(ctx && ctx.revival), ...extra };
}
export function nameOf(def, year) {
  if (!def) return '';
  if (Array.isArray(def.names) && year) {
    let n = def.name;
    for (const x of def.names) if (year >= x.from && (x.to == null || year <= x.to)) n = x.name;
    return n;
  }
  return def.name;
}

// ------------------------------------------------------------------ rounds
// Rank the player's score among a sample of rivals; pass by share (0..1) or count of a known field.
export function standing(g, ctx, myScore, rvs, o) {
  const r = rngFor(g, ctx && ctx.id, rid(ctx), 'standing');
  const rows = rvs.map((x) => ({ name: x.name, score: rivalScore(g, x, o, r), tag: (x.tags || [])[0] || '' }));
  rows.push({ name: unitName(g), score: myScore, me: true, tag: 'あなた' });
  rows.sort((a, b) => b.score - a.score || (a.me ? -1 : 1));
  rows.forEach((x, i) => { x.place = i + 1; });
  const field = o.field || rows.length;
  const passN = o.pass == null ? Math.ceil(rows.length * 0.3) : o.pass < 1 ? Math.max(1, Math.round(rows.length * o.pass)) : Math.max(1, Math.round(rows.length * Math.min(1, o.pass / field)));
  const me = rows.find((x) => x.me);
  const passed = me.place <= passN;
  // the place in the whole field (an estimate from the sample)
  const estPlace = Math.max(1, Math.round(((me.place - 0.5) / rows.length) * field));
  return { rows, passN, passed, place: me.place, estPlace, field };
}
// spec: { kind, length, pass (share or count), field, level (rival power), venue, beats: [str|fn], judge: '…', label, after: fn }
export function stdRound(spec) {
  return async (g, ctx) => {
    const r = rngFor(g, ctx.id, rid(ctx), 'beats');
    const k0 = typeof spec.kind === 'function' ? spec.kind(g, ctx) : spec.kind || (ctx.def && ctx.def.kind) || 'manzai';
    const kind = k0 === 'any' || k0 === 'double' ? defaultKind(g) : k0;
    return withBoard(g, boardSpec(ctx, spec.label, { set: spec.set || 'theater' }), async (b) => {
      b.set('stage', { caption: spec.caption ? spec.caption(g, ctx) : `${rname(ctx)}　${spec.venueName ? spec.venueName(g, ctx) : ''}`.trim() });
      for (const beat of pickBeats(spec.beats, r, 2)) await g.say(typeof beat === 'function' ? beat(g, ctx) : beat);
      const skip = await omakase(g, ctx);
      const res = await perform(g, ctx, { kind, length: spec.length, venue: spec.venue, title: `${nameOf(ctx.def, ctx.year)} ${rname(ctx)}`, skip });
      const rvs = rivals(g, ctx, spec.sample || 11, { level: typeof spec.level === 'function' ? spec.level(g, ctx) : spec.level ?? 50, kind, amateur: spec.amateur });
      const st = standing(g, ctx, res.score, rvs, { kind, length: spec.length, pass: spec.pass, field: spec.field });
      b.set('ranking', { rows: st.rows, passLine: st.passN, head: spec.head || `${rname(ctx)}　結果`, note: spec.judgeText || '' });
      await pause(g, 40);
      return finishRound(g, ctx, res, st, { kind, passText: spec.passText, failText: spec.failText });
    });
  };
}
export function defaultKind(g) {
  const u = unitOf(g);
  if (u.style === 'conte') return 'conte';
  if (u.type === 'pin' || u.style === 'pin') return 'pin';
  return 'manzai';
}
export function pickBeats(beats, r, n) { return beats && beats.length ? shuffleR(beats, r).slice(0, n) : []; }
export async function finishRound(g, ctx, res, st, o = {}) {
  const r = rngFor(g, ctx.id, 'finish', rid(ctx));
  const name = rname(ctx);
  if (st.passed) {
    g.sfx('success');
    await g.say(o.passText ? o.passText(g, ctx, st) : `${name}通過！（${st.rows.length}組中${st.place}位　全体でおよそ${st.estPlace}位／${st.field}組）`);
  } else {
    g.sfx('fail');
    const why = flawLines(g, o.kind, res.score, r);
    await g.say([o.failText ? o.failText(g, ctx, st) : `${name}で敗退…（全体でおよそ${st.estPlace}位／${st.field}組）`, `敗因：${why.join('／')}`]);
  }
  return { passed: st.passed, score: res.score, rank: res.rank, place: st.estPlace, of: st.field, field: st.field, detail: { sample: st.rows.length, sampleRank: st.place } };
}
// an act's audience votes (1..3 each) from a score
export function audienceVotes(score, n, r, k = 15) {
  const out = [];
  for (let i = 0; i < n; i++) {
    // calibrated so a great set lands around 270–295 of 300 (THE SECOND's record is 294) and an average one ~200
    const v = score + gauss(r) * k * 1.4;
    out.push(v >= 72 ? 3 : v >= 42 ? 2 : 1);
  }
  return out;
}
export const sumV = (vs) => vs.reduce((a, b) => a + b, 0);
export const countV = (vs, k) => vs.filter((v) => v === k).length;

// a fixed result for selection-type rounds
export const selResult = (passed, score, extra = {}) => ({ passed, score: clamp(Math.round(score), 0, 100), rank: rankFor(score), place: extra.place ?? null, of: extra.field ?? null, field: extra.field ?? null, ...extra });

// invitation check for TV specials: fame + a stat
export function inviteScore(g, keys = ['hassou', 'adlib']) {
  const s = keys.reduce((a, k) => a + stat(g, k), 0) / Math.max(1, keys.length);
  return { fame: fame(g), stat: Math.round(s) };
}
// talk minigame scenes built from [prompt, best, ok, bad] tuples
export function talkScenes(rows) {
  return rows.map(([prompt, best, ok, bad]) => ({ prompt, answers: [{ text: best, score: 100 }, { text: ok, score: 55 }, { text: bad, score: 10 }] }));
}
// every round run() returns D1's record shape: { passed (bool), score, rank, place, of, champion?, award?, note? }
export function normalizeRuns(def) {
  for (const r of (def && def.rounds) || []) {
    if (typeof r.run !== 'function' || r.run.d2) continue;
    const f = r.run;
    const w = async (g, ctx) => {
      const res = await f(g, ctx);
      if (!res || typeof res !== 'object') return res;
      if (res.of == null && res.field != null) res.of = res.field;
      res.passed = !!res.passed;
      if (!Number.isFinite(res.score)) res.score = 0;
      if (res.champion) res.place = 1;
      return res;
    };
    w.d2 = true;
    r.run = w;
  }
  return def;
}
export { COLORS, clamp };

// ------------------------------------------------------------------ activity (selection-type awards) & past titles
// The player's results in a contest, from every source: D1's entries (g.contestEntry), the history of ANY contest incl. the
// selfRun ones (g.contestHistory → playerPlace; M-1 / KOC / R-1 / ABC keep their own world and never write a D1 entry),
// E1's g.m1().me.champion, and this module's own titles. → [{ year, champion: bool, finalist: bool, passed: bool }]
export function playerResults(g, id) {
  const out = new Map();
  const put = (y, o) => { if (!Number.isFinite(y)) return; const p = out.get(y) || { year: y, champion: false, finalist: false, passed: false }; out.set(y, { ...p, champion: p.champion || !!o.champion, finalist: p.finalist || !!o.finalist || !!o.champion, passed: p.passed || !!o.passed || !!o.finalist || !!o.champion }); };
  try {
    if (has(g, 'contestHistory')) {
      for (const row of g.contestHistory(id) || []) {
        const pl = row && row.playerPlace;
        if (pl == null || pl === false) continue;
        put(Number(row.year), { champion: pl === 1, finalist: true });
      }
    }
  } catch (e) { console.error(e); }
  try {
    if (id === 'm1' && has(g, 'm1')) { const m = g.m1(); const ch = m && m.me && m.me.champion; if (Number.isFinite(Number(ch)) && ch) put(Number(ch), { champion: true }); }
    const summary = { koc: 'koc', r1: 'r1', abcgp: 'abcgp' }[id];
    if (summary && has(g, summary)) {
      const sm = g[summary]();
      const ch = sm && ((sm.me && sm.me.champion) ?? (sm.stats && sm.stats.champion));
      if (Number.isFinite(Number(ch)) && ch) put(Number(ch), { champion: true });
      for (const row of (sm && Array.isArray(sm.history) ? sm.history : [])) if (row && (row.player === 1 || row.ch === 'me' || row.playerPlace === 1)) put(Number(row.year ?? row.y), { champion: true });
    }
  } catch (e) { console.error(e); }
  try {
    if (has(g, 'contestEntry')) {
      const y0 = contestYear(g);
      for (let y = y0 - 45; y <= y0 + 1; y++) {
        const e = g.contestEntry(id, y);
        if (!e) continue;
        const fin = (e.results || []).some((x) => x && x.passed && /final|kessho|決勝/.test(String(x.round)));
        put(y, { champion: e.status === 'champion', finalist: fin, passed: e.status === 'passed' || e.status === 'champion' || (e.results || []).some((x) => x && x.passed) });
      }
    }
  } catch (e) { console.error(e); }
  const t = dstate(g).titles[id];
  if (Array.isArray(t)) for (const x of t) if (x && /優勝|王者|大賞|チャンピオン|MVS|王$/.test(x.label)) put(Number(x.year), { champion: true });
  return [...out.values()].sort((a, b) => a.year - b.year);
}
// 0..100: fame (log scale) + this/last year's contest results + stage experience (A)
export function activityScore(g, year, ids = []) {
  let s = Math.min(60, Math.log10(1 + fame(g)) * 14);
  let bonus = 0;
  for (const id of ids) {
    for (const x of playerResults(g, id)) {
      if (x.year !== year - 1 && x.year !== year) continue;
      bonus += x.champion ? 18 : x.finalist ? 8 : x.passed ? 4 : 1;
    }
  }
  let stages = 0;
  try { if (has(g, 'owarai')) stages = Number(g.owarai().stages) || 0; } catch (e) { console.error(e); }
  s += Math.min(30, bonus) + Math.min(12, stages / 8);
  return clamp(Math.round(s), 0, 100);
}
// did the act win any of these contests before `year`? → { id, year } | null
export function pastChampion(g, ids, year) {
  for (const id of ids) {
    const hit = playerResults(g, id).find((x) => x.champion && x.year < year);
    if (hit) return { id, year: hit.year };
  }
  return null;
}
// edition numbers of a contest that never ended: held years since `founded` (minus gaps). Ended + revived contests leave
// editionOf out: D1 counts only HELD years, so a 復刻 continues from the last real edition +1 per held year (decision 10).
export function editionCounter(founded, ended = null, gaps = []) {
  const off = (y) => gaps.some(([a, b]) => y >= a && y <= b);
  return (y) => {
    if (y < founded || off(y)) return null;
    let n = 0;
    for (let k = founded; k <= y; k++) if (!off(k)) n++;
    return n;
  };
}
// eligibility helper: rules { members: [min, max], pro, amateur, unitYearsMin, unitYearsMax, geirekiMax, geirekiMin, kansai, note }
export function checkElig(g, unit, year, rules) {
  const u = unit || unitOf(g);
  const n = (u.members && u.members.length) || 1;
  const why = [];
  if (rules.members) {
    const [mn, mx] = rules.members;
    if (mn && n < mn) why.push(mn >= 2 ? '2人以上のユニットが対象（ピンは出られない）' : `${mn}人以上が対象`);
    if (mx && n > mx) why.push(mx === 1 ? 'ピン（1人）が対象' : `${mx}人以内が対象`);
  }
  if (rules.pro && !rules.amateur && u.amateur) why.push('プロ（事務所所属）が対象');
  const uy = u.type === 'pin' ? geireki(g, year) : unitYears(g, year);
  if (rules.unitYearsMin != null && uy < rules.unitYearsMin) why.push(`結成${rules.unitYearsMin}年以上が対象（いま${uy}年）`);
  if (rules.unitYearsMax != null && uy > rules.unitYearsMax) why.push(`結成${rules.unitYearsMax}年以内が対象（いま${uy}年）`);
  if (rules.unitYearsLt != null && uy >= rules.unitYearsLt) why.push(`結成${rules.unitYearsLt}年未満が対象（いま${uy}年）`);
  const gr = geireki(g, year);
  if (rules.geirekiMax != null && gr > rules.geirekiMax) why.push(`芸歴${rules.geirekiMax}年目以下が対象（いま${gr}年目）`);
  if (rules.geirekiLt != null && gr >= rules.geirekiLt) why.push(`芸歴${rules.geirekiLt}年未満が対象（いま${gr}年）`);
  if (rules.kansai && !isKansai(g)) why.push('関西を拠点に活動する芸人が対象');
  if (rules.fameMin != null && fame(g) < rules.fameMin) why.push('まだ番組から声がかかる知名度ではない');
  if (rules.fameMax != null && fame(g) > rules.fameMax) why.push('もう“無名の新人”枠ではない');
  return { ok: !why.length, why: why.join('／') };
}
