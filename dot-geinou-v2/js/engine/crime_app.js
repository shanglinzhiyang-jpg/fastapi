// 裏アプリ — crime mode's phone app (GTA-like layer over the justice core js/engine/crime.js).
//
// The player asked: crime is not certain arrest (people often get away), show the odds, no peaceful moralizing once in
// crime mode, and crime mode is not only bad — good things happen too. This module is the underworld side:
//   - the app (era-framed): 昭和 / 平成のはじめ「裏ページ」(the 手帳's back page; jobs come by 伝言ダイヤル, 1986〜),
//     平成なかごろ「闇サイト」(a board on the ケータイ), 令和「キリ」(a fictional encrypted chat whose messages vanish).
//     No real app or service is named.
//   - jobs board (odds / reward / 手配度 for each job, live as the time of day, 下見, 仲間 and 変装 change), 手配度 ★ and
//     「ほとぼりを冷ます」 (lying low), 裏の信用 (rep) with contacts that unlock (情報屋・故買屋・運び屋・不動産屋・洗い屋・
//     弁護士・元締め), the 隠し場所 (stash of 盗品), 資金洗浄, the 隠れ家, a loan from the 元締め, history, 足を洗う.
//   - good and bad turns on mornings in crime mode: a 情報屋's tip, a debt repaid, a rival crew busted, an alibi;
//     betrayal by an accomplice, a rival's demand, a stolen stash, a loan coming due, talk of easy money, family worry.
//   - the HUD's ★ (shown only while the 手配度 is above 0), drawn under the HUD by wrapping MapScene#draw (no
//     rendering file is edited), and 職務質問 while walking in town with ★ (g.shokushitsu in the core).
// Everything is abstract: odds, choices and outcomes — never a method.
//
// API (exports): URA_JOBS, URA_CONTACTS, ura(g) (the state, repaired), uraApp(g), jobOdds(g, jobId, opts), runJob(g,
//   jobId, opts), rankOf(rep), uraMorning(g), appLabel(g). window.__ura = { ...same }.
// State g.state.ura = { v, rep, skill, dirty, laundered, earned, contacts{id: day}, stash[{ id, name, value, day,
//   crime, kept }], safehouse { until, rent, since } | null, debt { amount, due, missed, day } | null, rival { name,
//   day } | null, tip { job, until } | null, alibi (day) | 0, log[{ day, text }] (≤60), board { day, jobs[] },
//   done{ jobId: n }, intro (day the app came), lastEvent, lastShoku, steps, nextId }.
// Facts (checked 2026-10, WebSearch): 伝言ダイヤル (NTT) 1986〜 (pedia.3rd-in.co.jp 伝言ダイヤル); 歌舞伎町の街頭防犯カメラ
//   2002-02-27 (keishicho.metro.tokyo.lg.jp gaitocamera); 組織的犯罪処罰法の犯罪収益等隠匿 (10条) 2000-02 施行、法定刑の引上げ
//   2022-12-29 (pref.kumamoto.jp 239203, moj.go.jp 001364884); 商標法78条 10年以下・1000万円以下 (平成18年法律第55号,
//   jpo.go.jp tokkyo_kaisei18_55). Laws and penalties are in crime.js CRIMES.

import { registerPhoneApp, onMorning, PHONE_APPS } from './life.js';
import { phoneView, closePhoneThen, phoneOverMapOnly, appTile, rrect, PC, fitText } from './phone.js';
import { CRIMES, onJustice, lawDate, drawStars, starsOf, WANTED_MAX } from './crime.js';
import { Game } from './game.js';
import { MapScene, PLACES } from './map.js';
import { SW, SH, clamp, fmtMoney } from './util.js';
import { text, measure, panel, rect, wrap, COLORS } from './draw.js';
import { LOOKS, charSheetHD } from './sprites.js';
import { ageOf } from './profile.js';
import { HUD_H } from './ui.js';
import { audio } from './audio.js';

// ======================================================================== basics
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
let RNG = Math.random;
const rnd = () => RNG();
const roll = (p) => rnd() < p;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pickOne = (a) => a[Math.floor(rnd() * a.length)];
const r1000 = (n) => Math.max(0, Math.round(num(n) / 1000) * 1000);
const ERA_IDS = ['showa', 'heisei_early', 'heisei', 'reiwa'];
const eraId = (g) => { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_IDS.includes(e) ? e : 'reiwa'; };
const ld = (g) => { try { return lawDate(g); } catch (e) { return { year: 2026, month: 4, ym: 202604 }; } };
const since = (g, y, m = 1) => ld(g).ym >= y * 100 + m;
const jus = (g) => { try { return typeof g.jus === 'function' ? g.jus() : null; } catch (e) { console.error(e); return null; } };
const free = (g) => { const j = jus(g); return !j || (j.status !== 'detained' && j.status !== 'prison'); };
const wantedOf = (g) => { try { return typeof g.wanted === 'function' ? g.wanted() : 0; } catch (e) { return 0; } };
const crimeMode = (g) => { try { return typeof g.crimeMode === 'function' && g.crimeMode(); } catch (e) { return false; } };
const LOG_MAX = 60;
const COL = { app: '#2a2438', top: '#141220', text: '#f0ecff', dim: '#a49cc0', good: '#4fd08a', bad: '#ff5a6a', warn: '#ffb43c', gold: '#ffd23f', line: '#3a3450' };

// ======================================================================== state
function blank() {
  return { v: 1, rep: 0, skill: 0, dirty: 0, laundered: 0, earned: 0, contacts: {}, stash: [], safehouse: null, debt: null, rival: null, tip: null, alibi: 0, log: [], board: { day: 0, jobs: [] }, listings: [], done: {}, intro: 0, lastEvent: 0, lastShoku: 0, steps: 0, nextId: 1 };
}
const READY = new WeakSet();
export function ura(g) {
  const st = g.state;
  if (!isObj(st.ura)) st.ura = blank();
  const u = st.ura;
  if (READY.has(u)) return u;
  const b = blank();
  for (const k of Object.keys(b)) if (u[k] === undefined) u[k] = b[k];
  for (const k of ['rep', 'skill']) u[k] = clamp(num(u[k]), 0, 100);
  for (const k of ['dirty', 'laundered', 'earned', 'intro', 'lastEvent', 'lastShoku', 'steps', 'alibi']) u[k] = Math.max(0, num(u[k]));
  u.nextId = Math.max(1, Math.floor(num(u.nextId, 1)));
  u.contacts = isObj(u.contacts) ? u.contacts : {};
  for (const k of Object.keys(u.contacts)) if (!URA_CONTACTS[k]) delete u.contacts[k];
  u.stash = Array.isArray(u.stash) ? u.stash.filter(isObj).map((s) => ({ id: Math.floor(num(s.id, u.nextId++)), name: String(s.name || '盗品'), value: Math.max(0, Math.round(num(s.value))), day: num(s.day), crime: CRIMES[s.crime] ? s.crime : 'theft', kept: !!s.kept })).filter((s) => s.value > 0).slice(0, 20) : [];
  u.safehouse = isObj(u.safehouse) && num(u.safehouse.until) > 0 ? { until: num(u.safehouse.until), rent: Math.max(0, num(u.safehouse.rent)), since: num(u.safehouse.since) } : null;
  u.debt = isObj(u.debt) && num(u.debt.amount) > 0 ? { amount: Math.round(num(u.debt.amount)), due: num(u.debt.due), missed: Math.max(0, num(u.debt.missed)), day: num(u.debt.day) } : null;
  u.rival = isObj(u.rival) ? { name: String(u.rival.name || 'よそのグループ'), day: num(u.rival.day) } : null;
  u.tip = isObj(u.tip) && (URA_JOBS[u.tip.job] || /^L\d+$/.test(String(u.tip.job))) ? { job: String(u.tip.job), until: num(u.tip.until) } : null;
  u.log = Array.isArray(u.log) ? u.log.filter(isObj).map((l) => ({ day: num(l.day), text: String(l.text || '') })).slice(-LOG_MAX) : [];
  u.board = isObj(u.board) ? { day: num(u.board.day), jobs: Array.isArray(u.board.jobs) ? u.board.jobs.filter((id) => URA_JOBS[id]) : [] } : { day: 0, jobs: [] };
  u.done = isObj(u.done) ? u.done : {};
  u.listings = Array.isArray(u.listings) ? u.listings.filter((l) => isObj(l) && URA_JOBS[l.base]).map((l) => ({ id: String(l.id), base: l.base, title: String(l.title || URA_JOBS[l.base].name).slice(0, 40), from: String(l.from || ''), kind: String(l.kind || ''), day: num(l.day), until: num(l.until) })).slice(-6) : [];
  READY.add(u);
  return u;
}
function log(g, t) {
  const u = ura(g);
  u.log.push({ day: g.state.day, text: t });
  if (u.log.length > LOG_MAX) u.log.splice(0, u.log.length - LOG_MAX);
}
export const RANKS = [[0, '新入り'], [10, '顔見知り'], [25, '使える奴'], [45, '一目置かれる'], [70, '顔役']];
export function rankOf(rep) { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (rep >= n) r = name; return r; }
function addRep(g, d) {
  const u = ura(g);
  const before = u.rep;
  u.rep = clamp(u.rep + d, 0, 100);
  if (d > 0) for (const [id, c] of Object.entries(URA_CONTACTS)) if (!u.contacts[id] && c.rep > before && c.rep <= u.rep && (!c.exists || c.exists(g))) newContact(g, id);
  return u.rep;
}
function addSkill(g, d) { const u = ura(g); u.skill = clamp(u.skill + d, 0, 100); }
function addDirty(g, n) { const u = ura(g); n = Math.round(num(n)); if (n > 0) { u.dirty += n; u.earned += n; } }

// ======================================================================== era framing
const APP = {
  showa: { name: '裏ページ', title: '手帳の裏ページ', board: '伝言ダイヤルの伝言', from: '？？？（伝言ダイヤル）', glyph: '裏', color: '#3a2a2a',
    intro: '話は聞いた。仕事がほしけりゃ、伝言ダイヤルを聞け。\nボックス番号は、手帳の裏ページに控えておけ。', how: '（公衆電話から伝言ダイヤルにかけた。録音された声が、仕事の中身を告げる…）' },
  heisei_early: { name: '裏ページ', title: '手帳の裏ページ', board: '伝言ダイヤルの伝言', from: '？？？（伝言ダイヤル）', glyph: '裏', color: '#3a2a2a',
    intro: '話は聞いた。ポケベルに番号を送る。\n仕事は伝言ダイヤルに入れておく。手帳の裏ページに控えろ。', how: '（ポケベルが鳴った。公衆電話から伝言ダイヤルを聞く…）' },
  heisei: { name: '闇サイト', title: '闇サイト', board: '掲示板の書き込み', from: '？？？（闇サイト）', glyph: '闇', color: '#1e2a24',
    intro: 'ケータイにURLを送った。パスワードは「ドット」。\n仕事はそこに書きこむ。足のつく話はするな。', how: '（ケータイで闇サイトの掲示板を開いた。「高額バイト」の書き込みが並んでいる…）' },
  reiwa: { name: 'キリ', title: 'キリ（秘匿チャット）', board: 'チャンネルの募集', from: '？？？（キリ）', glyph: '霧', color: '#20263a',
    intro: '「キリ」の招待を送った。メッセージは24時間で消える。\n仕事はそこで流す。本名は出すな。', how: '（秘匿チャット「キリ」を開いた。消える前に、募集を読む…）' },
};
export const appLabel = (g) => APP[eraId(g)];
const bigMoneyWord = (g) => (eraId(g) === 'reiwa' ? '闇バイト' : eraId(g) === 'heisei' ? '高額バイト' : '割のいい仕事');

// ======================================================================== contacts
export const URA_CONTACTS = {
  joho: { name: '情報屋', rep: 0, does: 'ネタを売る（成功率が上がる）', who: { hair: 'cap', hat: '#3a3a44', hairColor: 'black', skin: 'tan', top: '#4a4038', bottom: '#2a2620' } },
  koubai: { name: '故買屋', rep: 5, does: '盗品を買い取る', who: { hair: 'bald', hairColor: 'silver', skin: 'fair', top: '#5a4a3a', bottom: '#3a3028', glasses: true } },
  hakobiya: { name: '運び屋', rep: 15, does: '逃げ道を用意・盗品を預かる', who: { hair: 'spiky', hairColor: 'brown', skin: 'tan', top: '#1e1e26', bottom: '#2a2a32', glasses: 'sun' } },
  fudosan: { name: '不動産屋', rep: 20, does: '隠れ家を貸す（早く冷める）', who: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#3a3e4a', bottom: '#2a2c38', jacket: true, tie: '#7a2f2f' } },
  arai: { name: '洗い屋', rep: 25, does: '汚れた金を洗う（手数料）', who: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#c9a227', glasses: true } },
  bengoshi: { name: '弁護士', rep: 35, does: '捕まったら、半額で弁護', who: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#c9a227' } },
  motojime: { name: '元締め', rep: 45, does: '大きな仕事・金を貸す', who: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#2a2a32', bottom: '#2a2a32', jacket: true, tie: '#5a1a2a', glasses: true } },
};
function newContact(g, id) {
  const u = ura(g), c = URA_CONTACTS[id];
  if (!c || u.contacts[id]) return;
  u.contacts[id] = g.state.day;
  log(g, `連絡先に「${c.name}」が加わった`);
  try { g.message({ from: `${c.name}（${appLabel(g).name}）`, kind: 'chat', text: `${{ joho: 'ネタがほしけりゃ、いつでも言え。タダじゃないがな。', koubai: '品物があるなら持ってこい。値段は、こっちで決める。', hakobiya: '追われたら呼べ。逃げ道くらいは、用意してやる。', fudosan: '人目につかない部屋がある。家賃さえ払えば、何も聞かない。', arai: '汚れた金は、そのままじゃ使えないだろ。手数料はもらう。', bengoshi: 'あんたの名前は聞いてる。何かあったら、まず私を呼べ。', motojime: '腕のいい奴は、大事にする。大きい仕事を回してやろう。' }[id]}` }); } catch (e) { console.error(e); }
}

// ======================================================================== jobs
// crime: a CRIMES id. reward [min, max] (internal yen, cash) or goods [min, max] (盗品 to the stash). spot: the scene
// for the odds. stamina: the cost. rep: the 裏の信用 needed. contact: who must be known. exists(g). scene: the backdrop.
export const URA_JOBS = {
  hakobi: { name: '荷物の運び', crime: 'stolen_goods', rep: 0, reward: [50000, 120000], stamina: 10, scene: 'locker',
    desc: '中身を聞かずに、荷物を指定の場所まで運ぶ', spot: { label: '駅のコインロッカー', detect: 1.05, cam: 1.2, hide: 0.05 } },
  nuki: { name: '倉庫の荷抜き', crime: 'theft', rep: 0, goods: [150000, 400000], stamina: 16, scene: 'warehouse', crew: true,
    desc: '夜の倉庫から品物を持ち出す（品物は隠し場所へ）', spot: { label: '夜の倉庫街', detect: 0.95, cam: 0.9, hide: 0.15 }, goodsName: ['家電の箱', '工具のセット', '高級時計', 'ブランドのバッグ'] },
  ukeko: { get name() { return '受け子'; }, crime: 'fraud_courier', rep: 0, reward: [30000, 80000], stamina: 10, scene: 'street', exists: (g) => since(g, 2003, 1),
    desc: '指示された家で、封筒を受け取ってくるだけ', spot: { label: '住宅街', detect: 1, cam: 1.1, hide: 0.05 }, unpaid: 0.15 },
  ganpu: { name: '口座を売る', crime: 'account_sale', rep: 0, reward: [30000, 50000], stamina: 4, scene: 'cafe', exists: (g) => since(g, 2004, 12), once: true,
    desc: '自分名義の通帳とカードを渡す（一度きり）', spot: { label: '喫茶店', detect: 1, cam: 0.8, hide: 0 } },
  tobaku: { name: '闇カジノで遊ぶ', crime: 'gambling', rep: 0, stake: [10000, 50000, 100000], stamina: 8, scene: 'casino',
    desc: '違法な賭場で、現金を賭ける（胴元が勝つようにできている）', spot: { label: '雑居ビルの賭場', detect: 1, cam: 0.5, hide: -0.05 } },
  mitsubai: { name: '偽ブランド品の密売', crime: 'counterfeit', rep: 8, reward: [80000, 200000], stamina: 12, scene: 'street', crew: true,
    desc: '偽物のブランド品を、本物の顔をして売りさばく', spot: { label: '繁華街の路上', detect: 1, cam: 1.1, hide: 0.15 } },
  kyokatsu: { name: '口止め料の取り立て', crime: 'extortion', rep: 10, reward: [100000, 300000], stamina: 12, scene: 'cafe', crew: true,
    desc: '弱みのある相手から「口止め料」をとる', spot: { label: '喫茶店の奥の席', detect: 1, cam: 0.8, hide: 0 } },
  koubai: { name: '盗品の買い取りと転売', crime: 'fence', rep: 15, reward: [80000, 250000], stamina: 10, scene: 'warehouse', contact: 'koubai',
    desc: '出どころの怪しい品を安く買い、高く流す', spot: { label: '貸し倉庫', detect: 1, cam: 0.8, hide: 0.05 } },
  kakeko: { name: 'かけ子', crime: 'fraud_caller', rep: 20, reward: [150000, 400000], stamina: 14, scene: 'room', exists: (g) => since(g, 2003, 1),
    desc: 'アジトの部屋から、筋書きどおりに電話をかける', spot: { label: '雑居ビルの一室（アジト）', detect: 1, cam: 0.5, hide: -0.1 } },
  doumoto: { name: '賭場を仕切る', crime: 'gambling_den', rep: 30, reward: [200000, 500000], stamina: 16, scene: 'casino', contact: 'motojime',
    desc: '一晩、賭場の胴元をつとめる（上がりの一部が取り分）', spot: { label: '雑居ビルの賭場', detect: 1, cam: 0.5, hide: -0.05 } },
  tataki: { name: '強盗の実行役', crime: 'robbery', rep: 0, reward: [300000, 1000000], stamina: 22, scene: 'street', exists: (g) => since(g, 2021, 1), crew: true, unpaid: 0.3, big: true,
    desc: '「指示役」の言うとおりに押し入る（顔も名前も向こうに握られている）', spot: { label: '住宅街', detect: 1.05, cam: 1.2, hide: 0.05 } },
};
// A job id is a URA_JOBS key, or 'L<n>' for a listing another module posted (addListing): the base job with its own title.
function jobOf(g, id) {
  if (URA_JOBS[id]) return URA_JOBS[id];
  if (typeof id !== 'string' || id[0] !== 'L' || !g || !g.state) return null;
  const l = ura(g).listings.find((x) => x.id === id);
  if (!l || !URA_JOBS[l.base]) return null;
  const base = URA_JOBS[l.base];
  return Object.assign(Object.create(base), { title: l.title, listing: l, once: true });
}
const jobName = (g, j) => (j && j.title ? j.title : j === URA_JOBS.tobaku ? (since(g, 2000, 1) ? '闇カジノで遊ぶ' : '裏の賭場で遊ぶ') : j === URA_JOBS.tataki ? `${bigMoneyWord(g)}（${j.name}）` : j === URA_JOBS.ukeko && since(g, 2004, 12) ? `${since(g, 2011, 1) ? '特殊詐欺' : '振り込め詐欺'}の受け子` : j.name);
function jobAvailable(g, id) {
  const j = jobOf(g, id), u = ura(g);
  if (!j) return { ok: false, why: '' };
  const def = CRIMES[j.crime];
  if (!def || (def.exists && !def.exists(g)) || (j.exists && !j.exists(g))) return { ok: false, hidden: true };
  if (j.once && num(u.done[id]) > 0) return { ok: false, hidden: true };
  if (j.listing && j.listing.until < g.state.day) return { ok: false, hidden: true };
  if (u.rep < j.rep) return { ok: false, why: `裏の信用 ${j.rep} から` };
  if (j.contact && !u.contacts[j.contact]) return { ok: false, why: `${URA_CONTACTS[j.contact].name}を知らない` };
  if (ageOf(g.state) < 18 && (j.crime === 'gambling' || j.crime === 'gambling_den' || j.crime === 'robbery')) return { ok: false, hidden: true };
  return { ok: true };
}
// The board: up to 5 jobs a day, picked by the day (so a reload shows the same board).
function board(g) {
  const u = ura(g), day = g.state.day;
  const posted = u.listings.map((l) => l.id).filter((id) => !jobAvailable(g, id).hidden);
  if (u.board.day === day && u.board.jobs.length) return [...posted, ...u.board.jobs.filter((id) => !jobAvailable(g, id).hidden)];
  const ids = Object.keys(URA_JOBS).filter((id) => !jobAvailable(g, id).hidden);
  const seed = (n) => ((day * 9301 + n * 49297) % 233280) / 233280;
  const sorted = ids.map((id, i) => [id, seed(i + 1)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  u.board = { day, jobs: sorted.slice(0, 5) };
  return [...posted, ...u.board.jobs];
}
const PHASE_IDS = ['day', 'night', 'late'];
const PHASE_LABEL = { day: '昼', night: '夜', late: '深夜' };
// [R7-C clock] the 時間帯 defaults to the clock's (clock.js g.crimePhaseNow: day < 17:00 ≤ night < 24:00 ≤ late);
// an earlier time of today cannot be chosen any more; a job at a later time moves the clock there (night 21:00, late
// 1:00) and the job itself takes about an hour and a half. Without the clock module: 'night', as before.
const phaseNow = (g) => { try { const p = typeof g.crimePhaseNow === 'function' ? g.crimePhaseNow() : null; return PHASE_IDS.includes(p) ? p : 'night'; } catch (e) { return 'night'; } };
const PHASE_START = { day: 0, night: 21 * 60, late: 25 * 60 };
const JOB_MINUTES = 90;
function jobCtx(g, id, o = {}) {
  const j = jobOf(g, id), u = ura(g);
  const amount = j.goods ? Math.round((j.goods[0] + j.goods[1]) / 2) : j.reward ? Math.round((j.reward[0] + j.reward[1]) / 2) : num(o.stake, 10000);
  return {
    job: id, spot: j.spot, amount, where: j.spot.label, crew: j.crew ? clamp(num(o.crew), 0, 2) : 0, prep: o.prep ? 0.6 : 0, prepLabel: '下見',
    disguise: !!o.disguise, tip: !!(u.tip && u.tip.job === id && u.tip.until >= g.state.day),
  };
}
export function jobOdds(g, id, o = {}) {
  const prev = g._crimePhase;
  g._crimePhase = PHASE_IDS.includes(o.phase) ? o.phase : 'night';
  try { return g.crimeOdds(jobOf(g, id).crime, jobCtx(g, id, o)); } finally { if (prev === undefined) delete g._crimePhase; else g._crimePhase = prev; }
}
const jobCost = (j, o) => num(j.stamina) + (o.prep ? 8 : 0) + (o.phase === 'late' ? 6 : 0);
function rewardText(g, j, o = {}) {
  if (j.stake) return `賭け金 ${fmtMoney(num(o.stake, j.stake[0]))}`;
  const [a, b] = j.goods || j.reward;
  const share = j.crew && o.crew ? `（仲間に${o.crew * 20}%）` : '';
  return `${j.goods ? '品物' : '報酬'} ${fmtMoney(a)}〜${fmtMoney(b)}${share}`;
}

// ======================================================================== the job, in the world
// A small backdrop for the job (HD overlay): abstract silhouettes; the player stands in it.
class JobScene {
  constructor(g, kind, opts = {}) { Object.assign(this, { g, kind, opts, t: 0, hd: true, opaque: true, hidesHud: true }); }
  update() { this.t++; }
  draw(c, g) {
    const k = this.kind, t = this.t, o = this.opts;
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const day = o.phase === 'day';
    for (let y = 0; y < 150; y++) R(0, y, SW, 1, day ? `rgb(${140 + y * 0.4},${178 + y * 0.3},220)` : `rgb(${12 + y * 0.12},${12 + y * 0.12},${30 + y * 0.2})`);
    R(0, 150, SW, SH - 150, day ? '#7a7a80' : '#22222a');
    if (k === 'warehouse') { for (let i = 0; i < 4; i++) { R(30 + i * 160, 60, 140, 90, day ? '#9a8e7a' : '#3a3630'); R(50 + i * 160, 96, 100, 54, day ? '#6a6050' : '#1e1c18'); for (let s = 0; s < 6; s++) R(50 + i * 160, 98 + s * 9, 100, 2, '#00000040'); } }
    else if (k === 'locker') { R(80, 40, 480, 120, day ? '#c8ccd4' : '#4a4e58'); for (let x = 0; x < 12; x++) for (let y = 0; y < 3; y++) { R(90 + x * 39, 48 + y * 37, 35, 33, day ? '#e0e4ea' : '#5a5e68'); R(118 + x * 39, 62 + y * 37, 4, 4, '#d8b040'); } }
    else if (k === 'casino') { R(0, 0, SW, 150, '#1a1018'); R(120, 120, 400, 50, '#1e5a32'); R(120, 120, 400, 4, '#c9a227'); for (let i = 0; i < 5; i++) R(150 + i * 75 + ((t >> 3) % 2), 134, 20, 12, ['#d62f2f', '#f2f2f2', '#2f6fd0', '#ffd23f', '#2f9a4a'][i]); R(0, 0, SW, 16, '#000'); }
    else if (k === 'room') { R(0, 0, SW, 150, '#2a2a30'); R(60, 40, 120, 70, '#141418'); for (let i = 0; i < 3; i++) { R(220 + i * 120, 120, 90, 30, '#5a4a3a'); R(240 + i * 120, 112, 30, 10, '#1a1a1e'); } R(500, 30, 90, 60, '#2a3048'); for (let y = 32; y < 88; y += 6) R(500, y, 90, 3, '#141418'); }
    else if (k === 'cafe') { R(0, 0, SW, 150, '#4a3a2a'); for (let i = 0; i < 4; i++) { R(40 + i * 150, 30, 100, 60, '#6a8a9a'); R(40 + i * 150, 58, 100, 2, '#4a3a2a'); } R(200, 140, 240, 18, '#6a4a2a'); }
    else { for (let i = 0; i < 6; i++) { const bh = 60 + (i % 3) * 20; R(i * 110, 150 - bh, 100, bh, day ? '#a8a8b0' : '#2a2a3a'); for (let w = 0; w < 3; w++) R(i * 110 + 12 + w * 28, 160 - bh, 14, 10, day ? '#c8d8e8' : (i + w) % 3 ? '#ffd88a' : '#3a3c58'); } }
    try {
      const sh = charSheetHD((g.state && g.state.look) || LOOKS.player);
      c.drawImage(sh[o.dir || 'right'][0] || sh.down[0], 280, 112, 64, 80);
      if (o.contact) { const s2 = charSheetHD(o.contact); c.drawImage(s2.left[0] || s2.down[0], 360, 112, 64, 80); }
    } catch (e) { /* sprites optional */ }
    if (o.title) {
      const w = Math.min(SW - 24, Math.max(measure(c, o.title, 16), measure(c, o.sub || '', 12)) + 28);
      panel(c, 8, 8, w, o.sub ? 50 : 32, { bg: '#1a1424' });
      text(c, o.title, 22, 15, { size: 16, color: COLORS.accent });
      if (o.sub) text(c, o.sub, 22, 36, { size: 12, color: '#d8dcf0' });
    }
  }
}
const GOOD_LINES = ['（段取りどおりに、仕事は終わった）', '（だれにも見られずに済んだ。…手際がよくなってきた）', '（思ったより、あっけなかった）'];
// Runs one job (as a script, outside the phone). o: { phase, prep, crew, disguise, stake }. Returns the commit result.
export async function runJob(g, id, o = {}) {
  const j = jobOf(g, id), u = ura(g), st = g.state;
  if (!j || !jobAvailable(g, id).ok || !free(g)) return null;
  const cost = jobCost(j, o);
  if (st.stamina < cost) { await g.say('（体力が足りない…。今日はもう動けない）'); return null; }
  st.stamina = Math.max(0, st.stamina - cost);
  if (o.disguise) { const dc = disguiseCost(g); if (!g.spend(dc)) { await g.say('（変装の用意をするお金が足りない…）'); return null; } }
  const phase = PHASE_IDS.includes(o.phase) ? o.phase : 'night';
  // [R7-C clock] wait until the chosen time of the day
  const startDay = st.day;
  try { if (typeof g.advanceTo === 'function') g.advanceTo(PHASE_START[phase] || 0, 'crime_wait'); } catch (e) { console.error(e); }
  const scene = g.push(new JobScene(g, j.scene, { title: jobName(g, j), sub: `${j.spot.label}・${PHASE_LABEL[phase]}`, phase }));
  let res = null;
  try {
    await g.say(appLabel(g).how);
    if (o.prep) await g.say('（先に下見をすませた。人の出入りと、逃げ道を頭に入れておく）');
    if (j.crew && o.crew) await g.say(`（仲間を${o.crew}人つれていく。見張りは、多いほどいい。…口の数も増えるが）`);
    let stakeWin = 0;
    if (j.stake) {
      const stake = Math.min(num(o.stake, j.stake[0]), st.money);
      if (stake <= 0) { await g.say('（賭けるお金がない…）'); return null; }
      st.money -= stake;
      const r = rnd();
      stakeWin = r < 0.42 ? stake * 2 : r < 0.47 ? stake * 4 : 0; // the house edge; now and then a big night
      await g.say(stakeWin ? `（${stakeWin >= stake * 4 ? '大勝ちだ！' : '勝った！'} ${fmtMoney(stakeWin)}が手元に来た）` : '（…負けた。チップは胴元のほうへ消えていった）');
    }
    g._crimePhase = phase;
    const ctx = jobCtx(g, id, o);
    let cash = 0, goods = 0;
    if (j.reward) cash = r1000(rint(j.reward[0], j.reward[1]) * (1 - 0.2 * ctx.crew));
    if (j.goods) goods = r1000(rint(j.goods[0], j.goods[1]));
    if (j.stake) cash = stakeWin;
    const unpaid = j.unpaid && roll(j.unpaid);
    ctx.amount = j.goods ? goods : j.stake ? num(o.stake, 10000) : Math.max(cash, ctx.amount);
    ctx.gain = cash > 0 && !unpaid ? { money: cash } : undefined;
    scene.hide = true;
    g.pop(scene);
    res = await g.commitCrime(j.crime, ctx);
    delete g._crimePhase;
    u.done[id] = num(u.done[id]) + 1;
    if (u.tip && u.tip.job === id) u.tip = null;
    if (j.listing) u.listings = u.listings.filter((l) => l.id !== id);
    if (!res || res.report && res.report.none) return res;
    if (res.caught) {
      addRep(g, -3);
      addSkill(g, 1);
      log(g, `${jobName(g, j)}：捕まった`);
      return res;
    }
    const s2 = g.push(new JobScene(g, j.scene, { title: jobName(g, j), sub: res.report && res.report.chase === 'escaped' ? '逃げ切った' : '仕事を終えた', phase }));
    try {
      const lines = [];
      if (res.report && res.report.chase === 'escaped') lines.push('（顔を見られたかもしれない。…手配度が上がった）');
      else lines.push(pickOne(GOOD_LINES));
      if (goods) {
        const name = pickOne(j.goodsName || ['盗品']);
        u.stash.push({ id: u.nextId++, name, value: goods, day: st.day, crime: j.crime, kept: !!(u.safehouse && u.safehouse.until >= st.day) });
        lines.push(`（「${name}」を手に入れた。時価${fmtMoney(goods)}ほど。隠し場所に置いた）`);
      }
      if (unpaid) {
        lines.push('（…報酬は、振り込まれなかった。連絡先は、もう消えていた）');
        if (j.big) lines.push('（「顔も住所も知っている」――最後に届いたのは、それだけだった）');
        g.addNeed('stress', 12);
        log(g, `${jobName(g, j)}：報酬は払われなかった`);
      } else if (cash > 0) {
        addDirty(g, cash);
        let bonus = 0;
        if (!j.stake && roll(0.12)) { bonus = r1000(cash * 0.5); g.state.money += bonus; addDirty(g, bonus); }
        lines.push(`（${j.stake ? '払い戻し' : '取り分'} ${fmtMoney(cash)}${bonus ? `、さらに「おまけ」で${fmtMoney(bonus)}` : ''}。汚れた金だ）`);
        log(g, `${jobName(g, j)}：成功 ${fmtMoney(cash + bonus)}`);
      } else log(g, `${jobName(g, j)}：${j.stake ? '負け' : '成功'}`);
      await g.say(lines);
      if (phase === 'late') g.addNeed('stress', 4);
      addRep(g, 2 + Math.min(4, (CRIMES[j.crime].severity || 1)));
      addSkill(g, 3);
    } finally { g.pop(s2); }
  } finally {
    delete g._crimePhase;
    if (g.scenes.includes(scene)) g.pop(scene);
    // [R7-C clock] the job's own time (not when the day changed meanwhile: custody)
    try { if (st.day === startDay && typeof g.advanceTime === 'function') g.advanceTime(JOB_MINUTES, 'crime'); } catch (e) { console.error(e); }
  }
  return res;
}
const disguiseCost = (g) => 3000;

// ======================================================================== the app (phone)
// A list screen in the app's dark colours with an info panel on top.
function uraView(g, o) {
  return {
    title: o.title, color: COL.app, bg: '#1c1828', hint: o.hint || 'A:えらぶ　B:もどる', idx: o.index | 0, sy: 0, cancel: -1, topRow: 0,
    rows() { try { return (typeof o.items === 'function' ? o.items(this) : o.items) || []; } catch (e) { console.error(e); return []; } },
    update(ph, inp) {
      const rows = this.rows(), n = rows.length;
      if (n) {
        this.idx = clamp(this.idx, 0, n - 1);
        if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; audio.sfx('cursor'); }
        if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; audio.sfx('cursor'); }
        const it = rows[this.idx];
        if (o.lr && it && (inp.pressed('left') || inp.pressed('right'))) { o.lr(ph, it, inp.pressed('left') ? -1 : 1, this); return; }
        if (inp.pressed('a')) {
          if (!it || it.disabled) { audio.sfx('buzz'); if (it && it.why) ph.toast(it.why, '#9aa3c7'); } else { audio.sfx('ok'); o.pick(ph, it, this.idx, this); }
          return;
        }
      }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(o.cancel ?? -1); }
    },
    tap(ph, x, y) {
      const L = this.lay;
      if (!L || y < L.y || y >= L.y + L.h) return false;
      const i = Math.floor((y - L.y + L.sy) / L.rh);
      const rows = this.rows();
      if (i < 0 || i >= rows.length) return false;
      this.idx = i;
      return true;
    },
    draw(c, ph, a) {
      R0(c, a.x, a.y, a.w, a.h, '#1c1828');
      const th = typeof o.top === 'function' ? o.top(this) : o.top || 0;
      if (th && o.drawTop) { c.save(); c.beginPath(); c.rect(a.x, a.y, a.w, th); c.clip(); try { o.drawTop(c, { x: a.x, y: a.y, w: a.w, h: th }, this); } catch (e) { console.error(e); } c.restore(); }
      const rows = this.rows();
      const L = { x: a.x, y: a.y + th, w: a.w, h: a.h - th };
      if (!rows.length) { text(c, o.empty || '（なし）', a.x + a.w / 2, L.y + 20, { size: 12, color: COL.dim, align: 'center' }); this.lay = null; return; }
      const rh = o.rowH || 34;
      const vis = Math.max(1, Math.floor(L.h / rh));
      const idx = clamp(this.idx, 0, rows.length - 1);
      let top = this.topRow;
      if (idx < top) top = idx;
      if (idx >= top + vis) top = idx - vis + 1;
      top = clamp(top, 0, Math.max(0, rows.length - vis));
      this.topRow = top;
      this.sy = top * rh;
      this.lay = { y: L.y, h: L.h, rh, sy: this.sy };
      c.save(); c.beginPath(); c.rect(L.x, L.y, L.w, L.h); c.clip();
      for (let i = top; i < Math.min(rows.length, top + vis + 1); i++) {
        const y = L.y + (i - top) * rh, it = rows[i], sel = i === idx;
        if (sel) { R0(c, L.x, y, L.w, rh, '#3a3058'); R0(c, L.x, y, 3, rh, COL.gold); }
        const col = it.disabled ? '#6a6480' : COL.text;
        const rw = it.right ? Math.ceil(measure(c, it.right, 12)) + 10 : 0;
        if (it.wrap) {
          const ls = wrap(c, it.label, L.w - 18 - rw, 12).slice(0, 2);
          ls.forEach((l, k) => text(c, l, L.x + 9, y + (ls.length > 1 ? 3 + k * 15 : Math.round((rh - 12) / 2)), { size: 12, color: col }));
        } else if (it.sub) {
          text(c, fitText(c, it.label, L.w - 18 - rw, 14), L.x + 9, y + 3, { size: 14, color: col });
          text(c, fitText(c, it.sub, L.w - 16, 12), L.x + 9, y + 19, { size: 12, color: it.subColor || COL.dim });
        } else text(c, fitText(c, it.label, L.w - 18 - rw, 14), L.x + 9, y + Math.round((rh - 14) / 2) - 1, { size: 14, color: col });
        if (it.right) text(c, it.right, L.x + L.w - 7, y + (it.sub ? 5 : Math.round((rh - 12) / 2)), { size: 12, color: it.rightColor || (it.disabled ? '#8a7a90' : COL.dim), align: 'right' });
        R0(c, L.x + 6, y + rh - 1, L.w - 12, 1, COL.line);
      }
      c.restore();
    },
  };
}
const R0 = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const uraList = (g, o) => phoneView(g, uraView(g, o));
// A dark confirm: the text on top, the choices as rows. Returns the index (B = the last choice).
const estLines = (s, per = 17) => String(s).split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(Array.from(l).length / per)), 0);
function uraConfirm(g, { title, text: body = '', choices = ['もどる'], index = 0 }) {
  const top = Math.min(200, 12 + estLines(g.fmt(body)) * 16);
  const items = choices.map((c) => ({ label: c }));
  return uraList(g, {
    title, items, index, top, rowH: 28, cancel: choices.length - 1,
    drawTop: (c, a) => { R0(c, a.x, a.y, a.w, a.h, COL.top); wrap(c, g.fmt(body), a.w - 16, 12).forEach((l, i) => text(c, l, a.x + 8, a.y + 6 + i * 16, { size: 12, color: COL.text })); R0(c, a.x, a.y + a.h - 1, a.w, 1, COL.line); },
    pick: (ph, it, idx) => ph.back(idx),
  });
}
const uraInfo = (g, title, body) => uraConfirm(g, { title, text: body, choices: ['もどる'] });
// The top panel: ★, rep, money.
function drawStatus(c, a, g) {
  const u = ura(g), lv = wantedOf(g);
  R0(c, a.x, a.y, a.w, a.h, COL.top);
  text(c, '手配度', a.x + 8, a.y + 6, { size: 12, color: COL.dim });
  drawStars(c, a.x + 52, a.y + 6, lv, 12);
  text(c, `信用 ${Math.round(u.rep)}「${rankOf(u.rep)}」`, a.x + 8, a.y + 23, { size: 12, color: COL.text });
  text(c, `経験 ${Math.round(u.skill)}`, a.x + a.w - 8, a.y + 23, { size: 12, color: COL.dim, align: 'right' });
  text(c, `汚れた金 ${fmtMoney(Math.min(u.dirty, g.state.money))}`, a.x + 8, a.y + 40, { size: 12, color: COL.warn });
  R0(c, a.x, a.y + a.h - 1, a.w, 1, COL.line);
}
export async function uraApp(g) {
  const u = ura(g);
  if (!crimeMode(g) && !u.intro && !liveListings(g).length) { await uraInfo(g, appLabel(g).title, '（まだ、何も届いていない）'); return; }
  let last = 0;
  for (;;) {
    const items = menuItems(g);
    const i = await uraList(g, { title: appLabel(g).title, items, index: last, top: 58, drawTop: (c, a) => drawStatus(c, a, g), pick: (ph, it, idx) => ph.back(idx) });
    if (i < 0) return;
    last = i;
    const it = items[i];
    if (!it) return;
    const r = await it.run();
    if (r === 'leave') return;
  }
}
function menuItems(g) {
  const u = ura(g), lv = wantedOf(g), on = crimeMode(g), day = g.state.day;
  const n = Object.keys(u.contacts).length;
  const kept = u.stash.reduce((a, s) => a + s.value, 0);
  const rows = [];
  if (!on) {
    const posts = liveListings(g);
    if (posts.length) rows.push({ label: '届いた募集', sub: posts[posts.length - 1].title, right: `${posts.length}件`, run: () => jobsScreen(g, { only: posts.map((l) => l.id) }) });
    rows.push(u.intro
      ? { label: 'また裏の仕事を受ける', sub: '足を洗ってからは、何も届いていない', run: async () => { g.setCrimeMode(true, 'app'); await uraInfo(g, appLabel(g).title, '（また、仕事の連絡が届くようになった）'); } }
      : { label: '裏の仕事を受ける', sub: 'ほかの仕事の連絡も届くようになる', run: async () => { g.setCrimeMode(true, 'app'); await uraInfo(g, appLabel(g).title, '（仕事の連絡が届くようになった）'); } });
  } else rows.push({ label: '仕事を探す', sub: appLabel(g).board, right: `${board(g).length}件`, run: () => jobsScreen(g) });
  if (!u.intro && !on) return rows; // only the posts so far: nothing else to show
  rows.push({ label: '手配度・ほとぼり', sub: lv > 0 ? `★${starsOf(lv)}　ほとぼりを冷ます` : '警察の目は向いていない', right: lv > 0 ? '★'.repeat(starsOf(lv)) : '', rightColor: COL.gold, run: () => heatScreen(g) });
  rows.push({ label: '連絡先', sub: `${n}人${u.tip && u.tip.until >= day ? '・ネタあり' : ''}`, run: () => contactsScreen(g) });
  rows.push({ label: '隠し場所', sub: u.stash.length ? `${u.stash.length}点・時価${fmtMoney(kept)}` : 'からっぽ', run: () => stashScreen(g) });
  rows.push({ label: '資金洗浄', sub: u.contacts.arai ? `汚れた金 ${fmtMoney(Math.min(u.dirty, g.state.money))}` : '洗い屋を知らない', disabled: !u.contacts.arai, why: `洗い屋は、裏の信用${URA_CONTACTS.arai.rep}から`, run: () => launderScreen(g) });
  rows.push({ label: '隠れ家', sub: u.safehouse && u.safehouse.until >= day ? `借りている（あと${u.safehouse.until - day}日）` : u.contacts.fudosan ? '借りられる' : '不動産屋を知らない', disabled: !u.contacts.fudosan && !u.safehouse, why: `不動産屋は、裏の信用${URA_CONTACTS.fudosan.rep}から`, run: () => safehouseScreen(g) });
  if (u.contacts.motojime || u.debt) rows.push({ label: '元締めからの借り', sub: u.debt ? `残り${fmtMoney(u.debt.amount)}・期日まで${Math.max(0, u.debt.due - day)}日` : '借りていない', rightColor: COL.bad, run: () => debtScreen(g) });
  rows.push({ label: '履歴', sub: u.log.length ? u.log[u.log.length - 1].text : 'まだ何もない', run: () => historyScreen(g) });
  if (on) rows.push({ label: '足を洗う', sub: '裏の仕事から手を引く', run: async () => leave(g) });
  return rows;
}
const liveListings = (g) => { try { return ura(g).listings.filter((l) => !jobAvailable(g, l.id).hidden); } catch (e) { return []; } };
async function jobsScreen(g, opts = {}) {
  for (;;) {
    const ids = opts.only ? board(g).filter((id) => opts.only.includes(id)) : board(g);
    const items = ids.map((id) => {
      const j = jobOf(g, id), av = jobAvailable(g, id), o = jobOdds(g, id, { phase: phaseNow(g) });
      return { id, label: jobName(g, j), sub: av.ok ? `成功${o.pct.success}%・捕${o.pct.now}%・後${o.pct.later}%` : av.why, right: j.listing ? '募集' : j.stake ? '賭け' : fmtMoney(j.reward ? j.reward[1] : j.goods[1]), disabled: !av.ok, why: av.why, subColor: av.ok ? (o.pct.success >= 60 ? COL.good : o.pct.success >= 35 ? COL.warn : COL.bad) : COL.dim };
    });
    const i = await uraList(g, { title: appLabel(g).board, items, index: jobsScreen.last || 0, empty: '（今日の募集はない）', pick: (ph, it, idx) => ph.back(idx) });
    if (i < 0) return;
    jobsScreen.last = i;
    const r = await jobDetail(g, ids[i]);
    if (r === 'go') return 'leave';
  }
}
// The job card: live odds as the options change (←→ on a row, or A to step it).
async function jobDetail(g, id) {
  const j = jobOf(g, id), u = ura(g);
  const o = { phase: phaseNow(g), prep: false, crew: 0, disguise: false, stake: j.stake ? j.stake[0] : 0 };
  const step = (key, d) => {
    if (key === 'phase') { const ok = PHASE_IDS.slice(PHASE_IDS.indexOf(phaseNow(g))); o.phase = ok[(Math.max(0, ok.indexOf(o.phase)) + d + ok.length) % ok.length]; }
    else if (key === 'prep') o.prep = !o.prep;
    else if (key === 'crew') o.crew = (o.crew + d + 3) % 3;
    else if (key === 'disguise') o.disguise = !o.disguise;
    else if (key === 'stake') { const k = j.stake.indexOf(o.stake); o.stake = j.stake[(k + d + j.stake.length) % j.stake.length]; }
  };
  const rows = () => {
    const cost = jobCost(j, o);
    const tired = g.state.stamina < cost;
    const R = [{ key: 'go', label: '実行する', sub: tired ? `体力が足りない（${cost}必要）` : `体力 -${cost}`, disabled: tired, why: '体力が足りない' }];
    R.push({ key: 'phase', label: `時間帯：${PHASE_LABEL[o.phase]}`, sub: '←→で変える', right: '◀▶' });
    R.push({ key: 'prep', label: `下見：${o.prep ? 'する' : 'しない'}`, sub: '体力 -8 で見つかりにくく', right: '◀▶' });
    if (j.crew) R.push({ key: 'crew', label: `仲間：${o.crew}人`, sub: '見張りが増える・口も増える', right: '◀▶' });
    R.push({ key: 'disguise', label: `変装：${o.disguise ? 'する' : 'しない'}`, sub: `${fmtMoney(disguiseCost(g))}で顔を隠す`, right: '◀▶' });
    if (j.stake) R.push({ key: 'stake', label: `賭け金：${fmtMoney(o.stake)}`, sub: '勝てば倍・負ければ没収', right: '◀▶' });
    R.push({ key: 'back', label: 'もどる' });
    return R;
  };
  let result = null;
  const pickRow = (ph, it) => {
    if (it.key === 'back') { ph.back('back'); return; }
    if (it.key === 'go') { ph.back('go'); return; }
    step(it.key, 1);
  };
  const k = await uraList(g, {
    title: jobName(g, j), items: rows, rowH: 32, top: 118,
    drawTop: (c, a) => drawJobTop(c, a, g, id, o),
    lr: (ph, it, d) => { if (!['go', 'back'].includes(it.key)) step(it.key, d); },
    pick: pickRow,
  });
  if (k !== 'go') return null;
  if (!phoneOverMapOnly(g)) { await uraInfo(g, jobName(g, j), 'いまは動けない。'); return null; }
  result = 'go';
  closePhoneThen(g, async () => { await runJob(g, id, { ...o }); });
  return result;
}
function drawJobTop(c, a, g, id, o) {
  const j = jobOf(g, id);
  const odds = jobOdds(g, id, o);
  R0(c, a.x, a.y, a.w, a.h, COL.top);
  const lines = wrap(c, j.desc, a.w - 16, 12);
  lines.slice(0, 2).forEach((l, i) => text(c, l, a.x + 8, a.y + 5 + i * 15, { size: 12, color: COL.dim }));
  if (!odds.ok) { text(c, odds.why || '', a.x + 8, a.y + 40, { size: 12, color: COL.bad }); return; }
  const by = a.y + 38, bw = a.w - 16;
  const ws = Math.round((bw * odds.pct.success) / 100), wn = Math.round((bw * odds.pct.now) / 100);
  R0(c, a.x + 8, by, bw, 10, '#2a3048');
  R0(c, a.x + 8, by, ws, 10, COL.good);
  R0(c, a.x + 8 + ws, by, wn, 10, COL.bad);
  R0(c, a.x + 8 + ws + wn, by, Math.max(0, bw - ws - wn), 10, odds.pct.later ? COL.warn : '#2a3048');
  text(c, `成功 ${odds.pct.success}%`, a.x + 8, by + 14, { size: 14, color: odds.pct.success >= 60 ? COL.good : odds.pct.success >= 35 ? COL.warn : COL.bad });
  text(c, `捕${odds.pct.now}%・後${odds.pct.later}%`, a.x + a.w - 8, by + 16, { size: 12, color: COL.text, align: 'right' });
  text(c, odds.chase ? `見つかっても逃げ切り${Math.round(odds.escape * 100)}%` : '見つかれば、その場で終わり', a.x + 8, by + 34, { size: 12, color: COL.dim });
  text(c, fitText(c, rewardText(g, j, o), a.w - 16, 12), a.x + 8, by + 50, { size: 12, color: COL.gold });
  text(c, `手配度 +${Math.round(odds.heat * 10) / 10}`, a.x + a.w - 8, by + 50, { size: 12, color: COL.warn, align: 'right' });
  if (ura(g).tip && ura(g).tip.job === id && ura(g).tip.until >= g.state.day) text(c, 'ネタあり', a.x + a.w - 8, a.y + 5, { size: 12, color: COL.good, align: 'right' });
  R0(c, a.x, a.y + a.h - 1, a.w, 1, COL.line);
}
async function heatScreen(g) {
  const lv = wantedOf(g), u = ura(g), day = g.state.day;
  const safe = u.safehouse && u.safehouse.until >= day;
  const per = (low) => (low ? (safe ? 1.0 : 0.75) : safe ? 0.4 : 0.3);
  const lines = [
    '★が多いほど、現場で見つかりやすく、職務質問に会いやすく、あとで足がつきやすい。★4からは捜査が一気に進むことがある。',
    `何もしなければ1日に${per(false)}ずつ、こもれば${per(true)}ずつ下がる${safe ? '（隠れ家）' : ''}。`,
  ];
  if (lv <= 0) lines.push('いまは、警察の目は向いていない。');
  const choices = lv > 0 ? ['1日こもる', '3日こもる', '5日こもる', 'もどる'] : ['もどる'];
  const k = await uraList(g, {
    title: '手配度・ほとぼり', items: choices.map((c) => ({ label: c })), rowH: 28, cancel: choices.length - 1,
    top: 30 + estLines(lines.join('\n')) * 16,
    drawTop: (c, a) => {
      R0(c, a.x, a.y, a.w, a.h, COL.top);
      text(c, '手配度', a.x + 8, a.y + 7, { size: 12, color: COL.dim });
      drawStars(c, a.x + 52, a.y + 6, lv, 14);
      text(c, `${Math.round(lv * 10) / 10}`, a.x + a.w - 8, a.y + 7, { size: 12, color: COL.dim, align: 'right' });
      let y = a.y + 28;
      for (const l of lines) for (const w of wrap(c, l, a.w - 16, 12)) { text(c, w, a.x + 8, y, { size: 12, color: COL.text }); y += 16; }
    },
    pick: (ph, it, idx) => ph.back(idx),
  });
  if (lv <= 0 || k < 0 || k > 2) return null;
  if (!phoneOverMapOnly(g)) { await uraInfo(g, '手配度・ほとぼり', 'いまは、こもれない。'); return null; }
  const n = [1, 3, 5][k];
  closePhoneThen(g, async () => {
    await g.say(`（${safe ? '隠れ家' : '部屋'}にこもって、外に出ないことにした。…${n}日）`);
    log(g, `${n}日間、ほとぼりを冷ました`);
    await g.lieLow(n);
    const left = wantedOf(g);
    await g.say(left > 0 ? `（手配度は★${starsOf(left)}まで下がった）` : '（手配度は消えた。…しばらくは、外を歩ける）');
  });
  return 'leave';
}
async function contactsScreen(g) {
  for (;;) {
    const u = ura(g), day = g.state.day;
    const ids = Object.keys(URA_CONTACTS).filter((id) => !URA_CONTACTS[id].exists || URA_CONTACTS[id].exists(g));
    const items = ids.map((id) => {
      const c = URA_CONTACTS[id], known = !!u.contacts[id];
      return { id, label: known ? c.name : '？？？', sub: known ? c.does : `裏の信用 ${c.rep} で知り合える`, disabled: !known, why: `裏の信用 ${c.rep} から`, right: id === 'joho' && known ? (u.tip && u.tip.until >= day ? 'ネタあり' : '') : '' };
    });
    const i = await uraList(g, { title: '連絡先', items, pick: (ph, it, idx) => ph.back(idx) });
    if (i < 0) return null;
    const id = ids[i];
    if (id === 'joho') await buyTip(g);
    else if (id === 'koubai') await stashScreen(g);
    else if (id === 'arai') await launderScreen(g);
    else if (id === 'fudosan') await safehouseScreen(g);
    else if (id === 'motojime') await debtScreen(g);
    else await uraInfo(g, URA_CONTACTS[id].name, URA_CONTACTS[id].does);
  }
}
const tipPrice = (g) => 20000;
async function buyTip(g) {
  const u = ura(g), day = g.state.day;
  if (u.tip && u.tip.until >= day) { await uraInfo(g, '情報屋', `「${jobName(g, jobOf(g, u.tip.job))}」のネタは、もう買ってある。\n（あと${u.tip.until - day}日）`); return; }
  const k = await uraConfirm(g, { title: '情報屋', color: COL.app, text: `今日の募集のどれかについて、\n現場の様子を教えてくれる。\n（見つかりにくくなる・3日間）\n${fmtMoney(tipPrice(g))}`, choices: ['ネタを買う', 'やめる'] });
  if (k !== 0) return;
  const ids = board(g).filter((id) => jobAvailable(g, id).ok);
  if (!ids.length) { await uraInfo(g, '情報屋', '「いまは、売れるネタがねえな」'); return; }
  if (!g.spend(tipPrice(g))) { await uraInfo(g, '情報屋', 'お金が足りない。'); return; }
  const id = pickOne(ids);
  u.tip = { job: id, until: day + 3 };
  log(g, `情報屋から「${jobName(g, jobOf(g, id))}」のネタを買った`);
  await uraInfo(g, '情報屋', `「${jobName(g, jobOf(g, id))}」の現場は、いま手薄だ。\n…3日のうちにやれ。`);
}
const fenceRate = (g) => 0.4 + 0.15 * (ura(g).rep / 100);
async function stashScreen(g) {
  for (;;) {
    const u = ura(g);
    const items = u.stash.map((s) => ({ s, label: s.name, sub: `時価${fmtMoney(s.value)}・${g.state.day - s.day}日前${s.kept ? '・預けてある' : ''}`, right: u.contacts.koubai ? fmtMoney(r1000(s.value * fenceRate(g))) : '' }));
    const i = await uraList(g, { title: '隠し場所', items, empty: '（何も隠していない）', pick: (ph, it, idx) => ph.back(idx) });
    if (i < 0) return null;
    const s = u.stash[i];
    if (!s) continue;
    const price = r1000(s.value * fenceRate(g));
    const ch = [];
    if (u.contacts.koubai) ch.push(`故買屋に売る（${fmtMoney(price)}）`);
    if (u.contacts.hakobiya && !s.kept) ch.push('運び屋に預ける');
    ch.push('捨てる', 'もどる');
    const k = await uraConfirm(g, { title: s.name, color: COL.app, text: `時価${fmtMoney(s.value)}。\n${s.kept ? '人目につかない所に預けてある。' : '持ち歩いている（職務質問で見つかるおそれ）。'}`, choices: ch });
    const pick = ch[k] || 'もどる';
    if (pick.startsWith('故買屋')) {
      u.stash.splice(i, 1);
      g.state.money += price;
      addDirty(g, price);
      addRep(g, 1);
      log(g, `「${s.name}」を${fmtMoney(price)}で売った`);
      await uraInfo(g, '故買屋', `「…まあ、こんなもんだ」\n${fmtMoney(price)}を受け取った。`);
    } else if (pick === '運び屋に預ける') {
      s.kept = true;
      log(g, `「${s.name}」を運び屋に預けた`);
    } else if (pick === '捨てる') {
      u.stash.splice(i, 1);
      log(g, `「${s.name}」を処分した`);
    }
  }
}
const launderFee = (g) => (ura(g).rep >= 60 ? 0.2 : 0.25);
async function launderScreen(g) {
  const u = ura(g), st = g.state;
  const dirty = Math.min(u.dirty, st.money);
  if (!u.contacts.arai) { await uraInfo(g, '資金洗浄', '洗い屋を知らない。'); return null; }
  if (dirty < 10000) { await uraInfo(g, '資金洗浄', '洗うほどの汚れた金はない。'); return null; }
  const fee = launderFee(g);
  const crimeOk = CRIMES.laundering && (!CRIMES.laundering.exists || CRIMES.laundering.exists(g));
  const odds = crimeOk ? g.crimeOdds('laundering', { amount: dirty, spot: { label: '洗い屋の店', detect: 1, cam: 0.5 } }) : null;
  const text0 = [`汚れた金 ${fmtMoney(dirty)}`, `手数料 ${Math.round(fee * 100)}%（${fmtMoney(r1000(dirty * fee))}）`, odds && odds.ok ? odds.text : '（この時代、出どころを隠すこと自体を罰する法律は、まだない）'];
  const k = await uraConfirm(g, { title: '資金洗浄', color: COL.app, text: text0.join('\n'), choices: ['全部洗う', '半分洗う', 'やめる'] });
  if (k !== 0 && k !== 1) return null;
  const amount = r1000(k === 0 ? dirty : dirty / 2);
  if (!phoneOverMapOnly(g)) return null;
  closePhoneThen(g, async () => {
    const cost = r1000(amount * fee);
    let ok = true;
    if (crimeOk) {
      const r = await g.commitCrime('laundering', { amount, where: '洗い屋の店', spot: { label: '洗い屋の店', detect: 1, cam: 0.5 } });
      ok = !r.caught;
    }
    if (!ok) { log(g, '資金洗浄：捕まった'); return; }
    g.state.money = Math.max(0, g.state.money - cost);
    u.dirty = Math.max(0, u.dirty - amount);
    u.laundered += amount - cost;
    log(g, `${fmtMoney(amount)}を洗った（手数料${fmtMoney(cost)}）`);
    await g.say(`（${fmtMoney(amount)}が、きれいな金になって戻ってきた。手数料は${fmtMoney(cost)}）`);
  });
  return 'leave';
}
const safehouseRent = (g) => 30000;
async function safehouseScreen(g) {
  const u = ura(g), day = g.state.day;
  const on = u.safehouse && u.safehouse.until >= day;
  const text0 = on
    ? `隠れ家を借りている（あと${u.safehouse.until - day}日、毎週${fmtMoney(u.safehouse.rent)}）。\n・ほとぼりが早く冷める\n・盗品はここに置ける\n・明け方の捜査員と、すれ違えることがある`
    : `${fmtMoney(safehouseRent(g))}／週。\n・ほとぼりが早く冷める\n・盗品はここに置ける\n・明け方の捜査員と、すれ違えることがある`;
  const ch = on ? ['解約する', 'もどる'] : ['借りる', 'もどる'];
  const k = await uraConfirm(g, { title: '隠れ家', color: COL.app, text: text0, choices: ch });
  if (k !== 0) return null;
  if (on) { u.safehouse = null; log(g, '隠れ家を解約した'); for (const s of u.stash) s.kept = false; return null; }
  if (!u.contacts.fudosan) return null;
  if (!g.spend(safehouseRent(g))) { await uraInfo(g, '隠れ家', 'お金が足りない。'); return null; }
  u.safehouse = { until: day + 7, rent: safehouseRent(g), since: day };
  for (const s of u.stash) s.kept = true;
  log(g, '隠れ家を借りた');
  await uraInfo(g, '不動産屋', '「鍵だ。だれが住んでるかは、だれも聞かない」');
  return null;
}
async function debtScreen(g) {
  const u = ura(g), day = g.state.day;
  if (u.debt) {
    const k = await uraConfirm(g, { title: '元締めからの借り', color: COL.app, text: `残り ${fmtMoney(u.debt.amount)}\n期日まで ${Math.max(0, u.debt.due - day)}日（10日ごとに1割）\n所持金 ${fmtMoney(g.state.money)}`, choices: ['全部返す', 'もどる'] });
    if (k === 0) {
      if (!g.spend(u.debt.amount)) { await uraInfo(g, '元締め', 'お金が足りない。'); return null; }
      log(g, `元締めに${fmtMoney(u.debt.amount)}を返した`);
      u.debt = null;
      addRep(g, 2);
      await uraInfo(g, '元締め', '「きっちり返す奴は、信用できる」');
    }
    return null;
  }
  if (!u.contacts.motojime) return null;
  const k = await uraConfirm(g, { title: '元締め', color: COL.app, text: '「金がいるなら貸してやる。\n10日で1割。遅れたら…わかるな」', choices: [`${fmtMoney(100000)}借りる`, `${fmtMoney(500000)}借りる`, 'やめる'] });
  if (k !== 0 && k !== 1) return null;
  const amt = k === 0 ? 100000 : 500000;
  g.state.money += amt;
  u.debt = { amount: Math.round(amt * 1.1), due: day + 10, missed: 0, day };
  log(g, `元締めから${fmtMoney(amt)}を借りた`);
  await uraInfo(g, '元締め', `${fmtMoney(amt)}を受け取った。\n10日後に${fmtMoney(u.debt.amount)}を返す。`);
  return null;
}
async function historyScreen(g) {
  const u = ura(g), j = jus(g);
  const stt = j && j.stats ? j.stats : {};
  const items = u.log.slice(-40).reverse().map((l) => ({ label: l.text, wrap: true, right: `${l.day}日目` }));
  await uraList(g, {
    title: '履歴', items, empty: '（まだ何もない）', top: 40,
    drawTop: (c, a) => {
      R0(c, a.x, a.y, a.w, a.h, COL.top);
      text(c, `逃げ切り ${num(stt.escaped)}回／追われた ${num(stt.chases)}回`, a.x + 8, a.y + 5, { size: 12, color: COL.text });
      text(c, fitText(c, `稼いだ汚れた金 ${fmtMoney(u.earned)}・洗った ${fmtMoney(u.laundered)}`, a.w - 16, 12), a.x + 8, a.y + 21, { size: 12, color: COL.dim });
    },
    pick: () => {},
  });
}
async function leave(g) {
  const k = await uraConfirm(g, { title: '足を洗う', color: COL.app, text: '裏の仕事から手を引く。\n連絡先はしばらく残るが、仕事は来なくなる。\n（あとで、また受けることもできる）', choices: ['手を引く', 'やめる'] });
  if (k !== 0) return null;
  g.setCrimeMode(false, 'app');
  log(g, '足を洗った');
  await uraInfo(g, appLabel(g).title, '「…そうか。気が変わったら、連絡しな」');
  return null;
}

// ======================================================================== phone app registration
registerPhoneApp('ura', {
  name: (g) => appLabel(g).name,
  color: '#2a2438',
  order: 48,
  cond: (g) => { try { const u = g.state && g.state.ura; return crimeMode(g) || !!(u && (u.intro || (Array.isArray(u.listings) && u.listings.some((l) => l && num(l.until) >= g.state.day)))); } catch (e) { return false; } },
  badge: (g) => { try { const u = ura(g); return (crimeMode(g) || liveListings(g).length) && u.board.day !== g.state.day ? 1 : 0; } catch (e) { return 0; } },
  iconHD(c, x, y, g) {
    const A = appLabel(g);
    appTile(c, x, y, A.color);
    if (eraId(g) === 'reiwa') {
      // a grey cloud (霧)
      for (const [cx, cy, r] of [[11, 18, 5], [17, 15, 6], [22, 19, 4], [16, 20, 5]]) { c.fillStyle = '#c8cce0'; c.beginPath(); c.arc(x + cx, y + cy, r, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#20263a'; c.fillRect(x + 8, y + 22, 16, 2);
    } else text(c, A.glyph, x + 16, y + 7, { size: 16, color: '#f0e0e0', align: 'center' });
    const lv = wantedOf(g);
    if (lv > 0) { c.fillStyle = '#ffd23f'; c.fillRect(x + 24, y + 3, 5, 5); }
  },
  open: (g) => uraApp(g),
});

// ======================================================================== hooks
// Entering crime mode: the contact sends the app (once per life; later entries just bring it back).
onJustice('crime_mode', (g, info) => {
  const u = ura(g);
  if (!info.on) return;
  if (!u.intro) {
    u.intro = g.state.day;
    log(g, '裏の仕事の連絡が届くようになった');
    try { g.message({ from: appLabel(g).from, kind: 'chat', text: appLabel(g).intro }); } catch (e) { console.error(e); }
    if (!u.contacts.joho) u.contacts.joho = g.state.day;
    try { g.notify(`${appLabel(g).name}が届いた`, { color: '#ffd23f' }); } catch (e) { /* notify optional */ }
  }
});
// Every crime in crime mode: the experience, the history; money from the underworld is dirty.
onJustice('committed', (g, info) => {
  try {
    if (!crimeMode(g) || info.job) return;
    const def = CRIMES[info.crime];
    if (!def || def.kind !== 'crime') return;
    const u = ura(g);
    if (!info.caught) { addSkill(g, 1); if (['shoplifting', 'robbery', 'theft', 'stolen_goods', 'fraud_courier', 'extortion', 'assault'].includes(info.crime)) addRep(g, 1); }
    if (!info.caught && info.gain && info.gain.money > 0 && !def.political) addDirty(g, info.gain.money);
    log(g, `${def.name}：${info.caught ? '捕まった' : info.chase === 'escaped' ? '見つかったが逃げ切った' : 'うまくいった'}`);
  } catch (e) { console.error(e); }
});
// A case: an alibi a friend gave (good), the stash taken as evidence; serving time earns respect (箔).
onJustice('arrested', (g, info) => {
  try {
    const u = ura(g), j = jus(g);
    if (u.alibi && j) { const cs = (j.cases || []).find((c) => c.id === info.caseId); if (cs) { cs.evidence = clamp(num(cs.evidence) - 0.1, 0.3, 1); u.alibi = 0; log(g, '仲間が「アリバイ」を証言してくれた'); } }
    const lost = u.stash.filter((s) => !s.kept);
    if (lost.length) { u.stash = u.stash.filter((s) => s.kept); log(g, `持ち歩いていた盗品${lost.length}点が押収された`); }
    if (u.safehouse) { u.safehouse = null; for (const s of u.stash) s.kept = false; }
  } catch (e) { console.error(e); }
});
onJustice('released', (g, info) => { try { if (info.prison && ura(g).intro) { addRep(g, 6); log(g, '出所した。裏では「箔がついた」と言われた'); } } catch (e) { console.error(e); } });
onJustice('stash_found', (g) => { try { const u = ura(g); u.stash = u.stash.filter((s) => s.kept); } catch (e) { console.error(e); } });

// Mornings in crime mode: the money, the 隠れ家's rent, the 元締め's loan, and now and then a turn of luck.
export const URA_EVENTS = {
  tip: { good: true, ok: (g, u) => !!u.contacts.joho, run: (g, u) => { const ids = board(g).filter((id) => jobAvailable(g, id).ok); if (!ids.length) return false; const id = pickOne(ids); u.tip = { job: id, until: g.state.day + 3 }; msg(g, '情報屋', `タダでいいネタだ。「${jobName(g, jobOf(g, id))}」の現場、いま手薄だぞ。`); log(g, `情報屋から「${jobName(g, jobOf(g, id))}」のネタ（タダ）`); return true; } },
  windfall: { good: true, ok: (g, u) => u.rep >= 10, run: (g, u) => { const n = r1000(rint(20000, 80000) * (1 + u.rep / 50)); g.state.money += n; addDirty(g, n); msg(g, '昔の仲間', `前に助けてもらった礼だ。${fmtMoney(n)}、いつもの場所に置いておいた。`); log(g, `昔の仲間から礼金${fmtMoney(n)}`); return true; } },
  rival_busted: { good: true, ok: (g, u) => !!u.rival, run: (g, u) => { msg(g, '情報屋', `${u.rival.name}が、まとめて挙げられたらしい。シマが空いたぞ。`); log(g, `${u.rival.name}が摘発された`); u.rival = null; addRep(g, 5); return true; } },
  alibi: { good: true, ok: (g, u) => u.rep >= 15 && !u.alibi && wantedOf(g) >= 1, run: (g, u) => { u.alibi = g.state.day; msg(g, '昔の仲間', 'いざとなったら、「あの夜はおれと飲んでた」って言ってやるよ。'); log(g, '仲間がアリバイを申し出た'); return true; } },
  betrayal: { good: false, ok: (g, u) => { const j = jus(g); return !!(j && Object.keys(j.heat || {}).some((id) => CRIMES[id] && CRIMES[id].kind === 'crime' && !j.heat[id].queued)); }, run: (g, u) => { const j = jus(g); const ids = Object.keys(j.heat).filter((id) => CRIMES[id] && CRIMES[id].kind === 'crime' && !j.heat[id].queued); const id = pickOne(ids); msg(g, '情報屋', `悪い知らせだ。いっしょに組んだ奴が別件でパクられて、しゃべってるらしい。「${CRIMES[id].name}」の件だ。`); log(g, `仲間が「${CRIMES[id].name}」の件をしゃべった`); try { g.investigate(id, {}); } catch (e) { console.error(e); } addRep(g, -2); return true; } },
  rival: { good: false, ok: (g, u) => !u.rival && u.rep >= 8, run: (g, u) => { u.rival = { name: pickOne(['南口のグループ', '川向こうの連中', '新顔のグループ']), day: g.state.day }; msg(g, '？？？', 'このへんで稼いでるのは、おまえか。…シマ荒らしは、ただじゃすまねえぞ。'); log(g, `${u.rival.name}に目をつけられた`); return true; } },
  stash_stolen: { good: false, ok: (g, u) => u.stash.some((s) => !s.kept) && !!u.rival, run: (g, u) => { const i = u.stash.findIndex((s) => !s.kept); const s = u.stash.splice(i, 1)[0]; msg(g, '情報屋', `${u.rival.name}の仕業だな。おまえの「${s.name}」、持っていかれたぞ。`); log(g, `「${s.name}」を${u.rival.name}に盗られた`); g.addNeed('stress', 8); return true; } },
  rumor: { good: false, ok: (g, u) => Math.min(u.dirty, g.state.money) >= 1500000, run: (g, u) => { msg(g, '情報屋', '派手に金を使いすぎだ。「あいつの金の出どころは？」って、うわさになってるぞ。'); g.addWanted(1, 'rumor'); log(g, '金づかいが、うわさになった'); return true; } },
  family: { good: false, ok: (g, u) => wantedOf(g) >= 3, run: (g) => { try { g.message({ from: '家族', kind: 'chat', text: g.fmt('最近、元気にしてる？\nなんだか変なうわさを聞いて、心配で…。\nたまには、顔を見せてね。') }); } catch (e) { console.error(e); } log(g, '家族から、心配する連絡が来た'); return true; } },
};
function msg(g, from, t) { try { g.message({ from: `${from}（${appLabel(g).name}）`, kind: 'chat', text: t }); } catch (e) { console.error(e); } }
export function uraMorning(g) {
  const st = g.state;
  if (!st || !isObj(st.ura) || !free(g)) return;
  const u = ura(g), day = st.day;
  u.dirty = Math.min(u.dirty, Math.max(0, st.money));
  if (u.safehouse) {
    if (u.safehouse.until < day) {
      if (crimeMode(g) && st.money >= u.safehouse.rent) { st.money -= u.safehouse.rent; u.safehouse.until = day + 7; log(g, `隠れ家の家賃${fmtMoney(u.safehouse.rent)}を払った`); }
      else { u.safehouse = null; for (const s of u.stash) s.kept = false; (g.morningNotes || (g.morningNotes = [])).push('（隠れ家の家賃が払えず、部屋を引き払った）'); log(g, '隠れ家を引き払った'); }
    }
  }
  if (u.debt && u.debt.due <= day) {
    u.debt.amount = Math.round(u.debt.amount * 1.1);
    u.debt.due = day + 10;
    u.debt.missed += 1;
    msg(g, '元締め', u.debt.missed >= 2 ? `二度目だぞ。${fmtMoney(u.debt.amount)}。…次は、迎えをやる。` : `期日だ。利息が乗って${fmtMoney(u.debt.amount)}。忘れるなよ。`);
    g.addNeed('stress', 6 * u.debt.missed);
    if (u.debt.missed >= 3) { addRep(g, -6); st.stamina = Math.max(1, Math.round(st.stamina * 0.6)); (g.morningNotes || (g.morningNotes = [])).push('（元締めの若い衆が、部屋の前で待っていた。…体じゅうが痛む）'); log(g, '元締めの若い衆に痛めつけられた'); }
  }
  if (!crimeMode(g) || day - u.lastEvent < 4 || day - u.intro < 2 || !roll(0.3)) return;
  const pool = Object.entries(URA_EVENTS).filter(([, e]) => { try { return e.ok(g, u); } catch (err) { return false; } });
  if (!pool.length) return;
  // balanced: good and bad turns are equally likely, when both are possible
  const goods = pool.filter(([, e]) => e.good), bads = pool.filter(([, e]) => !e.good);
  const side = goods.length && bads.length ? (roll(0.5) ? goods : bads) : goods.length ? goods : bads;
  const [id, e] = pickOne(side);
  try { if (e.run(g, u)) { u.lastEvent = day; u.lastId = id; } } catch (err) { console.error(err); }
}
onMorning(uraMorning);

// ======================================================================== the HUD's ★ (only while the 手配度 > 0)
// Drawn under the HUD's left panel (or at the top in portrait mode, where the HUD has its own bar), by wrapping
// MapScene#draw: no rendering file changes.
(function installHud() {
  const P = MapScene && MapScene.prototype;
  if (!P || typeof P.draw !== 'function' || P.draw.__ura) return;
  const draw = P.draw;
  const f = function (ctx, g) {
    const r = draw.call(this, ctx, g);
    try {
      if (g && g.state && g.state.justice && this.hudShown && this.hudShown(g) && !g.scenes.some((s) => s.hidesHud)) {
        const lv = wantedOf(g);
        if (lv > 0) {
          const y = g.hudOut ? 4 : HUD_H + 2;
          panel(ctx, 4, y, 118, 22, { bg: 'rgba(40,16,24,0.9)' });
          text(ctx, '手配', 12, y + 4, { size: 12, color: '#ffb4b4' });
          const blink = starsOf(lv) >= 4 && Math.floor(g.frame / 20) % 2 === 0;
          if (!blink) drawStars(ctx, 42, y + 4, lv, 12);
        }
      }
    } catch (e) { console.error(e); }
    return r;
  };
  f.__ura = true;
  P.draw = f;
})();

// ======================================================================== 職務質問 while walking in town with ★
(function installWalk() {
  const P = Game && Game.prototype;
  if (!P || typeof P.onWalkStep !== 'function' || P.onWalkStep.__ura) return;
  const walk = P.onWalkStep;
  const f = function (...a) {
    const r = walk.apply(this, a);
    try {
      const g = this;
      if (g.state && g.state.ura && g.map && g.map.place && g.map.place.kind === 'town' && !g.busy && free(g)) {
        const lv = wantedOf(g);
        const u = ura(g);
        if (lv > 0) {
          u.steps += 1;
          if (u.steps >= 40) {
            u.steps = 0;
            const carried = u.stash.filter((s) => !s.kept).reduce((n, s) => n + s.value, 0);
            const p = 0.025 * lv + (carried > 0 ? 0.02 : 0);
            if (g.state.day - u.lastShoku >= 2 && roll(p)) {
              u.lastShoku = g.state.day;
              g.run(async () => {
                const j = jus(g);
                const theft = j && j.heat && (j.heat.theft || j.heat.shoplifting);
                const r2 = await g.shokushitsu({ stash: carried, foundCrime: theft ? (j.heat.theft ? 'theft' : 'shoplifting') : 'stolen_goods' });
                log(g, `職務質問：${{ ok: '何も出なかった', bluffed: 'うまくごまかした', escaped: '逃げ切った', arrested: '盗品が見つかった', found: '盗品が見つかった', held: '長く引きとめられた' }[r2] || '…'}`);
              });
            }
          }
        }
      }
    } catch (e) { console.error(e); }
    return r;
  };
  f.__ura = true;
  P.onWalkStep = f;
})();

// ======================================================================== listings posted by other modules
// addListing(g, { kind, crime, from, title, days }) — another module (js/world/yami.js: the 闇バイト ad a fan answered) puts a
// recruitment post on the board. It becomes a normal job: the URA_JOBS entry for that crime (fraud_courier → 受け子,
// stolen_goods → 荷物の運び, …) under the post's own title, for `days` (default 10), once. Returns the listing or null.
const CRIME_JOB = { fraud_courier: 'ukeko', fraud_caller: 'kakeko', stolen_goods: 'hakobi', theft: 'nuki', robbery: 'tataki', account_sale: 'ganpu', extortion: 'kyokatsu', counterfeit: 'mitsubai', gambling: 'tobaku', gambling_den: 'doumoto', fence: 'koubai' };
export function addListing(g, listing = {}) {
  try {
    if (!g || !g.state || !isObj(listing)) return null;
    const u = ura(g);
    const base = CRIME_JOB[listing.crime] || (URA_JOBS[listing.job] ? listing.job : null) || 'hakobi';
    const title = String(listing.title || jobName(g, URA_JOBS[base])).slice(0, 40);
    if (u.listings.some((l) => l.title === title && l.until >= g.state.day)) return null; // the same post is already up
    const l = { id: `L${u.nextId++}`, base, title, from: String(listing.from || ''), kind: String(listing.kind || ''), day: g.state.day, until: g.state.day + Math.max(1, Math.round(num(listing.days, 10))) };
    u.listings.push(l);
    if (u.listings.length > 6) u.listings.splice(0, u.listings.length - 6);
    log(g, `募集が届いた：${title}`);
    return { ...l };
  } catch (e) { console.error(e); return null; }
}
if (typeof window !== 'undefined') window.__crimeApp = { addListing, addOffer: addListing, ura: (g) => ura(g), jobOdds, runJob };
if (typeof window !== 'undefined') window.__ura = { URA_JOBS, URA_CONTACTS, URA_EVENTS, ura, uraApp, jobOdds, runJob, rankOf, uraMorning, appLabel, addListing, jobOf, setRng: (fn) => { RNG = fn || Math.random; } };
