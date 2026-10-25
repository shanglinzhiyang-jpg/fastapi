// R-1 / ABC の共通エンジン (owner: E3) — calendar, seeded randomness, fictional names, the player's act,
// performance scoring (feature-detected: A owarai / B neta / C perform / D1 contests), news with a morning digest,
// offers, refusals, a fallback phone-app helper. contest_r1.js and contest_abc.js import it.
//
// Every other module is reached ONLY through feature-detected g.* calls with local fallbacks:
//   g.unit / g.unitPower / g.shortfall / g.geireki / g.unitYears / g.addComedyStat / g.addStageExp   (A)
//   g.netaList / g.pickNeta / g.netaQuality / g.practiceNeta / g.markNetaUsed / g.autoNeta / g.writeNeta (B)
//   g.perform / g.performSim                                                                        (C)
//   g.contestNews / g.contestEntry / g.contestVenue                                                 (D1)
// Everyone in the contests' world (entrants, judges, MCs, staff, past champions) is fictional.
import { YEN_MARK, mulberry32, clamp } from './util.js';
import { eraOf } from './profile.js';
import { PEOPLE, isKansai, onMorning, REGULARS, PHONE_APPS } from './life.js';
import { AGENCIES } from './state.js';
import { LOOKS } from './sprites.js';
import * as CT from './contests.js';

export const has = (g, k) => !!g && typeof g[k] === 'function';
export const safe = (fn, d = null) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } };
export const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
export const n0 = (n) => Math.max(0, Math.round(num(n))).toLocaleString('ja-JP');

// ================================================================ money (real yen of the time)
// Texts said with g.say are run through yenText (era price level). A historical amount must stay as it was:
// realYen() marks it (YEN_MARK) so it is never scaled; toInternal() is what to charge / pay in game money.
export function realYen(n) { n = Math.round(num(n)); return n % 10000 === 0 && n >= 10000 ? `${(n / 10000).toLocaleString('ja-JP')}万円` : `${YEN_MARK}${n.toLocaleString('ja-JP')}円`; }
export const plainYen = (n) => { n = Math.round(num(n)); return n % 10000 === 0 && n >= 10000 ? `${(n / 10000).toLocaleString('ja-JP')}万円` : `${n.toLocaleString('ja-JP')}円`; };
export function toInternal(g, real) { const r = num(eraOf(g && g.state).priceRate, 1) || 1; return Math.round(num(real) / r); }
export const eraId = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
export const devWord = (g) => eraOf(g && g.state).deviceShort || 'スマホ';

// ================================================================ seeded randomness
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export const rngOf = (...parts) => mulberry32(hashStr(parts.join('|')));
export function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
export const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const pickR = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export function shuffleR(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ================================================================ calendar (1 game month = 10 days, d = 1..10)
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
// { year, month, d (1..10), day }. g.gameDate (politics core) gives doy; its dom is 1, 4, 7 … 28, so d is
// taken from doy. Without the core: the same calendar from April of the era's first year.
export function cdate(g, day) {
  const st = g && g.state;
  const dd = day ?? (st && st.day) ?? 1;
  try {
    if (has(g, 'gameDate')) {
      const x = g.gameDate(dd);
      if (x && Number.isFinite(x.year) && Number.isFinite(x.month)) {
        const d = Number.isFinite(x.doy) ? (x.doy % 10) + 1 : num(x.dom, 1) > 10 ? Math.floor((num(x.dom) - 1) / 3) + 1 : num(x.dom, 1);
        return { year: x.year, month: x.month, d: clamp(d, 1, 10), day: dd };
      }
    }
  } catch (e) { /* fall back */ }
  const n = Math.max(0, dd - 1);
  const idx = 3 + Math.floor(n / 10);
  return { year: (ERA_BASE[eraId(g)] ?? 2026) + Math.floor(idx / 12), month: (idx % 12) + 1, d: (n % 10) + 1, day: dd };
}
export const absIdx = (y, m, d) => (y * 12 + (m - 1)) * 10 + (d - 1);
// The game day number of a date (the calendar is linear: 10 days a month).
export function dayOf(g, y, m, d) { const now = cdate(g); return now.day + absIdx(y, m, d) - absIdx(now.year, now.month, now.d); }
export const domOf = (d) => (d - 1) * 3 + 1;
export const dateText = (m, d) => `${m}月${domOf(d)}日`;
export const dateTextY = (y, m, d) => `${y}年${m}月${domOf(d)}日`;
export const junOf = (d) => (d <= 3 ? '上旬' : d <= 7 ? '中旬' : '下旬');

// ================================================================ fictional names (this game's world)
// (surnames tied to one famous person — 柳葉・布袋・鳳・九十九… — are left out on purpose)
const SUR = ['小豆沢', '雲母坂', '胡桃沢', '鰐渕', '梅ヶ枝', '狸穴', '千石', '七尾', '灯籠', '鍋島', '戸隠', '白樺', '蓬莱', '猿渡', '牛窓', '藪原', '桐ヶ谷', '鷹番', '鵜飼', '百目鬼', '薬袋', '一ツ橋', '雪谷', '蒲生', '笹ヶ峰', '駒込', '亀甲', '天王寺', '若狭', '御堂', '朝霧', '十六夜'];
const GIV = ['ジョニー', 'キャサリン', 'ポン太', 'マサル', 'ミドリ', 'ヤスオ', 'カナブン', 'トメ子', 'ハルキ', 'サブレ', 'ゴンザレス', 'ペペ', 'ヨシコ', 'チャーリー', 'タモツ', 'ノブ', 'ジュリア', 'ダンディ', 'ペコ', 'スナオ', 'ミツオ', 'チカラ', 'マドカ', 'モモ', 'ピエール', 'ローズ', 'ヒカル', 'ゲン', 'ナナ', 'ケンタ', 'リリー', 'ソウタ'];
const SOLO = ['もやし定食', 'ひとり会議', 'すきま風太郎', 'おにぎり左衛門', '深海ちゃん', '満月バター', 'ぬか床ミナミ', '単三電池', '三角定規', 'メロンパン太郎', 'ねじまき先輩', 'ラジオ体操第三', '回覧板', 'ぽんかん大王', 'わたあめ課長', '麦茶のみ子', '冷やし中華はじめ', 'スリッパ王子', 'ハンコ注意報', '土曜のサバ', '消しゴム職人', '段ボール伯爵', 'エレベーター大佐', '金曜ナポリタン', '湯たんぽ姫', '扇風機ヨシオ', '目覚まし時計子', 'ちくわぶ男爵', '半熟たまご', '二度寝のプロ', '踏切ジョージ', '路線図マニア', '雨合羽サトシ', '豆腐屋ラッパ'];
const UNIT2 = ['月面ピクニック', '三丁目サーカス', 'シャッター通り', 'レモン配達便', 'はるかぜ急行', 'からくり定食', '平熱ボーイズ', 'ハチミツ工場', '夕焼け事務所', 'ドドンパ通信', 'ちくわ大臣', '金曜ロッカー', '蛍光ペンズ', 'おかわり自由', 'すずめ銀行', 'オーロラ横丁', 'まめでんきゅう', 'ナポリタン協会', 'こたつ会議', '午前三時', 'ワカメ学級', '背伸び団地', '改札ダッシュ', '洗濯日和', '縁側パーティー', '給食当番', '半額シール', '空き地クラブ', '竹とんぼ通信', 'しおり堂', '屋上ラジオ', '寝ぐせアンテナ', '合鍵商会', 'ビー玉商店', '鉄板ホイル', '迷子センター', '十円玉ズ', '電柱ファイブ', '湯けむり探偵', 'カレーの国', '傘立て', '観覧車ジャンプ'];
const UNIT3 = ['回転木馬団', '三色だんご', '信号機トリオ', 'おでん三兄弟', '雷おこし団', '三輪車クラブ', 'トライアングル商会', '鉛筆削り団', '三日月ブラザーズ', 'ちゃぶ台ファミリー'];
const SHORT = ['ハルキ', 'ヨシダ', 'まこと', 'ケン', 'たろう', 'みのる', 'ユウ', 'サトシ', 'コウ', 'のぶ', 'リョウ', 'しんご', 'アキ', 'ミナミ', 'かおり', 'マリ', 'ゆうこ', 'てつ'];
const FAM = ['青柳', '赤羽', '朝比奈', '石狩', '稲葉', '宇佐美', '江波', '大鷹', '岡安', '鏑木', '神威', '北浜', '久留米', '黒部', '小早川', '早乙女', '鴫原', '白鳥', '須磨', '瀬戸口', '高砂', '月岡', '鶴見', '手塚原', '豊岡', '中之島', '夏目坂', '鳴海', '西陣', '野々宮', '萩原', '花菱', '日向', '藤ノ森', '星野原', '真鍋', '水無瀬', '御影', '紫野', '桃井', '八雲', '柚木', '夜久', '若宮'];
// rarer given names (rare surname × rare given name: no well-known real person)
const GIVM = ['柊吾', '颯斗', '灯真', '蒼汰', '嵐士', '律哉', '朔也', '凌雅', '爽介', '伊織', '漣', '玄道', '燈太', '迅之介', '晴臣'];
const GIVF = ['千景', '栞那', '紬希', '澪央', '灯花', '柚葉', '琴音', '朱里', '凛々子', '寧々', '芙美', '小夜子', '詠美', '帆乃香', '絃'];
// No generated name may match a well-known real person (BRIEF4): D1's isRealNameLike when it exports one, and our list.
const FAMOUS = new Set(['前田健太', '松本人志', '浜田雅功', '明石家さんま', '北野武', 'ビートたけし', 'タモリ', '所ジョージ', '志村けん', '加藤茶', '島田紳助', '今田耕司', '東野幸治', '陣内智則', 'バカリズム', '友近', '小籔千豊', '野田クリスタル', '佐久間一行', '間寛平', '大平サブロー', '月亭八方', '伊東四朗', 'ダンカン', '桂文枝', '笑福亭鶴瓶', '山里亮太', '本田望結', '霜降り明星', '粗品', 'せいや', '広瀬アリス', 'ゆりやんレトリィバァ', 'アキラ100%', '濱田祐太郎', '街裏ぴんく', '友田オレ', '田津原理音', 'だいたひかる', '浅越ゴエ', 'ほっしゃん。', '博多華丸', 'なだぎ武', '中山功太', 'あべこうじ', '三浦マイルド', 'やまもとまさみ', 'じゅんいちダビッドソン', 'ハリウッドザコシショウ', 'おいでやす小田', '今井らいぱち', '吉住', '柳葉敏郎', '布袋寅泰', '鳳啓助', '九十九一', '桃井かおり', '萩原健一', '西城秀樹', '草彅剛', '真鍋かをり', '橋本環奈', '大谷翔平', 'イチロー', '長嶋茂雄', '王貞治', '松井秀喜', '羽生結弦', '浅田真央', '木村拓哉', '中居正広', '黒柳徹子', '和田アキ子', '美空ひばり', '石原裕次郎', '吉永小百合', '高倉健', '渥美清', '萩本欽一', '坂上二郎', 'ゼロカラン', '金魚番長', '豆鉄砲', 'ドンデコルテ', 'ミルクボーイ', 'ダイアン', 'かまいたち', 'ハナコ', 'ニッポンの社長', 'かもめんたる', 'マヂカルラブリー', 'ダウ90000', '令和ロマン', 'ヨネダ2000']);
export function realNameLike(name) {
  const s = String(name || '').replace(/[\s　・]/g, '');
  if (!s) return false;
  try { if (typeof CT.isRealNameLike === 'function' && CT.isRealNameLike(name)) return true; } catch (e) { /* D1's filter failed: ours only */ }
  return FAMOUS.has(s);
}
const clean = (r, make) => { let n = make(); for (let i = 0; i < 8 && realNameLike(n); i++) n = make(); return n; };
export function personName(r, gender) { const f = (gender || (r() < 0.5 ? 'm' : 'f')) === 'f'; return clean(r, () => pickR(r, FAM) + ' ' + pickR(r, f ? GIVF : GIVM)); }
export function pinName(r) {
  return clean(r, () => {
    const k = r();
    if (k < 0.45) return pickR(r, SUR) + pickR(r, GIV);
    if (k < 0.8) return pickR(r, SOLO);
    return `${pickR(r, UNIT2)} ${pickR(r, SHORT)}`; // コンビの片方がピンで出る
  });
}
export function unitName(r, type = 'combi') { return type === 'pin' ? pinName(r) : clean(r, () => pickR(r, type === 'trio' ? UNIT3 : UNIT2)); }
const HAIRS = ['short', 'long', 'bob', 'spiky', 'twin', 'slick', 'afro', 'cap', 'bald', 'mage'];
const HCOL = ['black', 'black', 'brown', 'brown', 'blonde', 'red', 'silver', 'pink', 'blue', 'orange'];
const TOPS = ['#d64161', '#3a6fd8', '#2f9a4a', '#ffd23f', '#8a5ac8', '#ff8a3d', '#1e1e26', '#f2f2f2', '#5fd7ff', '#c0452f', '#6a6a78', '#ff7eb6'];
export function randomLook(r, o = {}) {
  const f = o.gender === 'f' || (o.gender == null && r() < 0.3);
  const hair = f ? pickR(r, ['long', 'bob', 'twin', 'bob']) : pickR(r, HAIRS);
  const look = { hair, hairColor: pickR(r, HCOL), skin: pickR(r, ['light', 'fair', 'fair', 'tan']), top: pickR(r, TOPS), bottom: pickR(r, ['#3a4a7a', '#2a2a34', '#5a4a3a', '#3b3f48', '#d8d0c0']) };
  if (f && r() < 0.6) look.skirt = true;
  if (r() < 0.25) look.glasses = r() < 0.2 ? 'sun' : true;
  if (r() < 0.2) look.jacket = true;
  if (hair === 'cap') look.hat = pickR(r, TOPS);
  if (!f && r() < 0.12) look.beard = true;
  return look;
}
export const agencyNames = () => [...Object.values(AGENCIES).map((a) => a.name), 'フリー', 'アマチュア'];

// ================================================================ the player's act
// What the player performs as, from A's g.unit() (a stub may still be there) with fallbacks.
export function actInfo(g) {
  const st = g.state;
  const u = safe(() => (has(g, 'unit') ? g.unit() : null), null);
  const members = u && Array.isArray(u.members) && u.members.length ? u.members : [{ id: 'player', name: st.name, role: 'pin' }];
  const others = members.filter((m) => m && m.id !== 'player');
  let type = (u && u.type) || (others.length ? (others.length > 1 ? 'trio' : 'combi') : 'pin');
  if (u && u.dissolved) type = 'pin';
  const pinfo = (m) => {
    const def = PEOPLE[m.id] || null;
    return { id: m.id, name: m.name || (def && def.name) || '相方', short: m.short || (def && (def.short || def.name)) || m.name || '相方', look: m.look || (def && def.look) || LOOKS.comedian, kansai: def ? isKansai(def) : false, role: m.role || 'boke' };
  };
  let partners = type === 'pin' ? [] : others.map(pinfo);
  if (type !== 'pin' && !partners.length && st.partner && PEOPLE[st.partner]) partners = [pinfo({ id: st.partner })];
  const style = (u && u.style) || (type === 'pin' ? 'pin' : 'manzai');
  const name = (u && u.name) || st.name;
  const agency = (u && u.agency !== undefined ? u.agency : st.agency) || null;
  return { unit: u, type, name, style, partners, partner: partners[0] || null, agency, agencyName: agency && AGENCIES[agency] ? AGENCIES[agency].name : agency ? String(agency) : null, amateur: u ? !!u.amateur : !st.agency, formed: (u && u.formed) || null };
}
export function geireki(g, year) { const v = safe(() => (has(g, 'geireki') ? g.geireki(year) : null), null); return Number.isFinite(Number(v)) ? Number(v) : 0; }
export function unitYears(g, year) { const v = safe(() => (has(g, 'unitYears') ? g.unitYears(year) : null), null); return Number.isFinite(Number(v)) ? Number(v) : 0; }
export function playerAge(g, year) { const v = safe(() => (has(g, 'playerAge') ? g.playerAge(year) : null), null); return Number.isFinite(Number(v)) ? Number(v) : 20; }
export function powerOf(g, kind) {
  const v = safe(() => (has(g, 'unitPower') ? g.unitPower(kind) : null), null);
  if (Number.isFinite(Number(v))) return clamp(Number(v), 0, 100);
  return clamp(Math.round((num(g.state.skills && g.state.skills.warai)) * 0.5), 0, 100);
}
export function statOf(g, key) { const v = safe(() => (has(g, 'comedyStat') ? g.comedyStat(key) : null), null); return Number.isFinite(Number(v)) ? Number(v) : clamp(Math.round(num(g.state.skills && g.state.skills.warai) * 0.5), 0, 100); }
export function qualityOf(g, neta) {
  if (!neta) return 40;
  const v = safe(() => (has(g, 'netaQuality') ? g.netaQuality(neta) : null), null);
  if (Number.isFinite(Number(v))) return clamp(Number(v), 0, 100);
  return clamp(num(neta.ai && neta.ai.total, 45) * 0.7 + num(neta.practice) * 0.3, 0, 100);
}

// A script for a performance. g.auto (tests / おまかせ): the best one in the ネタ帳, else a generated one.
export async function chooseNeta(g, { kind, length, cid, title, auto }) {
  const list = safe(() => (has(g, 'netaList') ? g.netaList(kind) : []), []) || [];
  const gen = () => safe(() => (has(g, 'autoNeta') ? g.autoNeta(kind, clamp(Math.round(powerOf(g, kind) * 0.7 + 18), 10, 90)) : null), null)
    || { id: 'auto', kind, title: 'いつものネタ', length: length || 120, lines: [], ai: { total: 45 }, practice: 40, uses: {}, auto: true };
  if (g.auto && g.auto.neta) return g.auto.neta;
  if (g.auto || auto) {
    const best = list.slice().sort((a, b) => qualityOf(g, b) - qualityOf(g, a))[0];
    return best || gen();
  }
  if (has(g, 'pickNeta')) {
    const n = await safe(() => g.pickNeta({ kind, length, title, forContest: cid }), null);
    if (n) return n;
  }
  if (list.length) {
    const i = await g.ask('どのネタでいく？', [...list.slice(0, 3).map((n) => `「${n.title || 'ネタ'}」`), 'いつものネタ（おまかせ）'], { cancel: Math.min(3, list.length) });
    if (i >= 0 && i < Math.min(3, list.length)) return list[i];
  }
  return gen();
}
export const netaUsedBefore = (neta, cid) => !!(neta && neta.uses && num(neta.uses[cid]) > 0);

// ================================================================ performing
function localSim(g, o, rng) {
  const power = o.power ?? powerOf(g, o.kind);
  const quality = o.quality ?? qualityOf(g, o.neta);
  const r = rng ? rng() : Math.random();
  const score = clamp(Math.round(power * 0.5 + quality * 0.4 + (r - 0.5) * 20), 0, 100);
  return { score, rank: score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D', laughs: Math.round(score / 8), big: Math.round(score / 30), flubs: 0, blanks: 0, overtime: 0, adlib: 0, heat: [score], parts: { neta: quality, execution: power, presence: power, timing: power, crowd: 50 }, comment: '', highlights: [] };
}
function norm(r) {
  const s = clamp(num(r && r.score, 40), 0, 100);
  return { score: s, rank: (r && r.rank) || (s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 55 ? 'B' : s >= 35 ? 'C' : 'D'), laughs: num(r && r.laughs), big: num(r && r.big), flubs: num(r && r.flubs), blanks: num(r && r.blanks), overtime: num(r && r.overtime), adlib: num(r && r.adlib), heat: (r && Array.isArray(r.heat) && r.heat.length ? r.heat : [s]), parts: { neta: s, execution: s, presence: s, timing: s, crowd: 50, ...((r && r.parts) || {}) }, comment: (r && r.comment) || '', highlights: (r && r.highlights) || [] };
}
// The performance itself (C's g.perform: the minigame, or a simulation when opts.skip / g.auto).
export async function performAct(g, o) {
  let r = null;
  if (g._r1sim) o = { ...o, skip: true }; // test hook: every scene shown, the performance simulated (C's minigame is tested by C)
  if (has(g, 'perform')) {
    try { r = await g.perform(o); } catch (e) { console.error(e); r = null; }
  }
  if (!r || !Number.isFinite(Number(r.score))) r = localSim(g, o);
  return norm(r);
}
// A simulated performance (rivals): C's model when there, so both sides use the same scale.
export function simPerf(g, o, rng) {
  if (has(g, 'performSim')) {
    try { const r = g.performSim({ ...o, rng }); if (r && Number.isFinite(Number(r.score))) return norm(r); } catch (e) { console.error(e); }
  }
  return norm(localSim(g, o, rng));
}
// The total a round is judged on (0..100): the moment (the performance) and the act's real strength (power and the
// script), plus preparation, minus mistakes. Rivals are scored with the same formula (rivalTotal).
export function playerTotal(g, res, o) {
  const base = clamp(o.power * 0.55 + o.quality * 0.45, 0, 100);
  let t = res.score * 0.55 + base * 0.45 + num(o.prep);
  const pen = [];
  // the performance score already counts the mistakes; the contest adds a little on top (尺オーバー is a rule of the round)
  if (res.overtime > 0) { const p = Math.min(4, res.overtime * 0.25); t -= p; pen.push(['尺オーバー', p]); }
  if (res.flubs > 0) { const p = Math.min(2, res.flubs * 0.5); t -= p; pen.push(['噛み', p]); }
  if (res.blanks > 0) { const p = Math.min(3, res.blanks); t -= p; pen.push(['ネタが飛んだ', p]); }
  if (o.same) { t -= 5; pen.push(['同じネタ', 5]); }
  return { total: clamp(Math.round(t * 10) / 10, 0, 100), base, pen };
}
export function rivalTotal(g, strength, rng, kind) {
  const r = simPerf(g, { kind, power: strength, quality: clamp(strength + gauss(rng) * 6, 0, 100) }, rng);
  return clamp(Math.round((r.score * 0.55 + strength * 0.45 + rng() * 4) * 10) / 10, 0, 100);
}
// The score that `pass` of `field` entrants reach in a round whose strengths are N(mu, sd) (seeded, so the same
// season always has the same cut).
export function cutScore(g, { mu, sd, field, pass, kind, seed }) {
  const r = rngOf('cut', seed);
  const n = 240;
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(rivalTotal(g, clamp(mu + gauss(r) * sd, 1, 99), r, kind));
  xs.sort((a, b) => b - a);
  const q = clamp(pass / Math.max(1, field), 0.001, 1);
  return xs[clamp(Math.round(q * n) - 1, 0, n - 1)];
}

// 実力不足 — concrete reasons, from A's g.shortfall and from the performance itself.
export function shortfallReasons(g, kind, res, o = {}) {
  const out = [];
  const sf = safe(() => (has(g, 'shortfall') ? g.shortfall(kind, o.need || 60) : null), null);
  if (sf && Array.isArray(sf.gaps)) for (const x of sf.gaps.slice(0, 3)) out.push(`${x.label}：${Math.round(num(x.have))}（目安${Math.round(num(x.need))}）`);
  if (res) {
    if (res.overtime > 0) out.push(`尺オーバー：${Math.round(res.overtime)}秒こえた（持ち時間を守れていない）`);
    if (res.flubs > 0) out.push(`噛み：${res.flubs}回（声量・滑舌の稽古不足）`);
    if (res.blanks > 0) out.push(`ネタが飛んだ：${res.blanks}回（ネタ合わせが足りない）`);
    const p = res.parts || {};
    if (num(p.neta, 60) < 50) out.push('ネタの構成：ボケの数が少なく、後半に山がない');
    if (num(p.timing, 60) < 50) out.push('間：笑いを待たずに次へいってしまう');
    if (num(p.crowd, 60) < 45) out.push('客層：客席の空気をつかめず、ツカミが弱かった');
    if (num(p.presence, 60) < 45) out.push('華：舞台に立ったときの存在感が足りない');
  }
  if (o.same) out.push('同じネタ：この大会で前にかけたネタ。新鮮さがない');
  if (num(o.practice, 50) < 30) out.push('仕上がり：ネタ合わせの回数が少なく、まだ体に入っていない');
  if (!out.length) out.push('ほんの紙一重。どのネタも粒ぞろいで、あと一歩の爆発が足りなかった');
  return out.slice(0, 6);
}

// ================================================================ news, morning notes, the digest
// Both contests' morning work runs once a day (from D1's def.onMorning or this module's own hook), and what they
// want to say goes out as at most 2 messages + 1 merged digest a morning (BRIEF4: no message floods).
const KIT_MORNING = [];
export function kitMorning(id, fn) { if (!KIT_MORNING.some((m) => m.id === id)) KIT_MORNING.push({ id, fn }); }
const kitState = (st) => {
  if (!st.r1 || typeof st.r1 !== 'object') st.r1 = {};
  if (!st.r1.kit || typeof st.r1.kit !== 'object') st.r1.kit = { lastDay: 0 };
  return st.r1.kit;
};
export async function runKitMorning(g) {
  if (!g || !g.state) return;
  const k = kitState(g.state);
  if (k.lastDay === g.state.day) return;
  k.lastDay = g.state.day;
  const out = [];
  for (const m of KIT_MORNING) {
    try { const lines = await m.fn(g); if (Array.isArray(lines)) out.push(...lines.filter(Boolean)); } catch (e) { console.error('[r1_kit] morning', m.id, e); }
  }
  emitNews(g, out);
}
onMorning((g) => runKitMorning(g));
// items: [{ cid, text, prio, cat }] (strings are fine too)
export function emitNews(g, items) {
  const list = items.map((x) => (typeof x === 'string' ? { text: x, prio: 1 } : x)).filter((x) => x && x.text);
  if (!list.length) return;
  list.sort((a, b) => num(b.prio, 1) - num(a.prio, 1));
  const solo = list.slice(0, 2), rest = list.slice(2);
  for (const x of solo) newsOut(g, x.text, x.cid, x.cat);
  if (rest.length) newsOut(g, `【お笑い賞レース まとめ】\n${rest.map((x) => '・' + x.text.replace(/\n/g, ' ')).join('\n')}`, rest[0].cid, 'digest');
}
export function newsOut(g, text, cid, cat) {
  if (has(g, 'contestNews')) { try { g.contestNews(text, { contest: cid, cat }); return; } catch (e) { console.error(e); } }
  g.message({ from: 'お笑いニュース', text, kind: 'news' });
}
export function morningNote(g, s) { if (Array.isArray(g.morningNotes)) g.morningNotes.push(s); }

// An offer of a registered regular (life.js REGULARS) — the phone's offer flow answers it.
export function sendOffer(g, id, text, from) {
  const r = REGULARS[id];
  if (!r) return false;
  const st = g.state;
  const cur = st.regulars && st.regulars[id];
  if (cur && !cur.dropped && cur.since != null) return false;
  if ((st.phone.inbox || []).some((m) => m && m.kind === 'offer' && m.regular === id && !m.answered)) return false;
  g.message({ from: from || r.host || 'プロデューサー', look: r.hostLook, kind: 'offer', regular: id, text: g.fmt(text || r.offer || `『${r.title}』に出演しませんか？`) });
  return true;
}

// Why the player cannot go to a contest venue today (null: free to go).
export function goRefusal(g) {
  const tx = (v) => (v ? [].concat(v).join('\n') : null);
  try {
    if (has(g, 'lifeRefusal')) { const w = tx(g.lifeRefusal()); if (w) return w; }
    if (has(g, 'justiceRefusal')) { const w = tx(g.justiceRefusal('job', { id: 'contest' })); if (w) return w; }
    if (has(g, 'politicsRefusal')) { const w = tx(g.politicsRefusal('job', { id: 'contest' })); if (w) return w; }
  } catch (e) { console.error(e); }
  return null;
}

// D1's hub: is a phone app for the 賞レース registered? (Then our own apps only show during a season.)
export function d1Hub() { return Object.values(PHONE_APPS).some((a) => a && a.id !== 'r1' && a.id !== 'abcgp' && (a.contestHub || /^(contests?|shourace)$/.test(a.id))); }

// Keep D1's entry record (if D1 keeps one) in step with ours.
export function syncEntry(g, cid, year, rec) {
  if (!has(g, 'contestEntry')) return;
  try {
    const e = g.contestEntry(cid, year);
    // D1's own record keeps its shape (numeric round, its results) through contestRecord; only the identity is shared
    if (e && e !== rec && typeof e === 'object') Object.assign(e, { no: rec.no, unitName: rec.unitName });
  } catch (e) { console.error(e); }
}

// ================================================================ D1 (contests.js) integration — all feature-detected
// D1 keeps the player's entry record (st.contests.entries) that drives its 賞レース hub, reminders and 「会場へ向かう」
// (which calls our def.flow). We register our entry there, record every round (rewards off: we give our own), and keep
// D1's world history and generic news in step with our own season (we are the authority for R-1 / ABC).
export const d1On = (g) => has(g, 'contestRegister') && has(g, 'contestRecord') && has(g, 'contestEntry');
export function d1Entry(g, cid, Y) { return d1On(g) ? safe(() => g.contestEntry(cid, Y), null) : null; }
export function d1Register(g, cid, Y, fields) {
  if (!d1On(g)) return null;
  return safe(() => g.contestRegister(cid, { year: Y, ...fields }), null);
}
export function d1Record(g, cid, Y, idx, res) {
  if (!d1On(g) || idx < 0) return null;
  if (!d1Entry(g, cid, Y)) return null;
  return safe(() => g.contestRecord(cid, idx, res, { year: Y, reward: false, news: false }), null);
}
// patch D1's entry record (picks of the next round, the 復活ステージ) — the record of our own contest
export function d1Patch(g, cid, Y, fn) { const e = d1Entry(g, cid, Y); if (e) safe(() => fn(e)); return e; }
const d1State = (g) => (has(g, 'contestState') ? safe(() => g.contestState(), null) : null);
// D1 announces every contest's rounds / finalists / champion from its own simulation; ours are announced by us, so
// those keys are marked as sent for our contest-years (D1's pushNews skips a sent key).
export function d1Claim(g, cid, Y, nRounds) {
  const c = d1State(g);
  if (!c || !c.sent || typeof c.sent !== 'object') return;
  const day = (g.state && g.state.day) || 1;
  const keys = [`count|${cid}|${Y}`, `finalists|${cid}|${Y}`, `champ|${cid}|${Y}`, `lastyear|${cid}|${Y}`];
  for (let i = 0; i < nRounds + 1; i++) keys.push(`round|${cid}|${Y}|${i}`, `upset|${cid}|${Y}|${i}`);
  for (const k of keys) if (!c.sent[k]) c.sent[k] = day;
}
// D1's later lines (王者の会見, ネットの反応) of our contests are its own champion's: drop them (we send our own)
export function d1PurgeLater(g, cid) { const c = d1State(g); if (c && Array.isArray(c.later)) c.later = c.later.filter((x) => !x || x.contest !== cid); }
// write our final into D1's frozen history (its 歴代王者 / 結果 screens read it)
export function d1Freeze(g, cid, Y, row) {
  const c = d1State(g);
  if (!c || !c.hist || typeof c.hist !== 'object') return;
  if (!c.hist[cid]) c.hist[cid] = {};
  c.hist[cid][Y] = { ...(c.hist[cid][Y] || {}), ...row };
}
// this world's history before the game (D1's simulation of every registered contest): { [year]: row }
export function d1History(g, cid) {
  if (!has(g, 'contestHistory')) return null;
  const rows = safe(() => g.contestHistory(cid, { all: true }), null);
  if (!Array.isArray(rows) || !rows.length) return null;
  const out = {};
  for (const r of rows) if (r && r.held !== false && r.champion) out[r.year] = r;
  return out;
}
// entrants of D1's world for our contest-year (names, looks, tags, agencies): strongest first
export function d1Field(g, cid, roundIdx, n, Y) {
  if (!has(g, 'contestRivals')) return [];
  const list = safe(() => g.contestRivals(cid, roundIdx, n, Y), []) || [];
  return list.filter((x) => x && x.name && !x.anon && !realNameLike(x.name)).sort((a, b) => num(b.power) - num(a.power));
}
