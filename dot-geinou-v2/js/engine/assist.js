// 政治ナビ（ことは先生）: a friendly, neutral guide for players who find politics hard.
//
// The character: 七海 ことは（ななみ ことは）, a FICTIONAL lecturer in political science at the fictional
// ドット大学. She explains, she never tells the player what to believe, and she always shows 賛成の声 and
// 反対の声. Her sprite is a game LOOK (charSheetHD), so she is drawn in the game's own style.
//
// ---------------------------------------------------------------- for other modules
//   import { NAVI, installAssist } from '../engine/assist.js';   (self-installed at import time)
//   g.navi(topic?)            open the phone app 政治ナビ (topic: 'home' | 'advice' | 'news' | 'glossary' |
//                             'glossary:<term>' | 'ideology' | 'ideology:<id>' | 'quiz' | 'lessons' |
//                             'lesson:<id>' | 'missions' | 'settings' | 'intro')
//   g.assistTip(key, opts)    a small portrait + speech bubble, once per key (help level; tips off; never
//                             during cutscenes or dialogue; never takes input). opts: { text, level: 1|2|3,
//                             silent (record only), force (again even if seen) }. Returns true when queued.
//                             The key is also recorded as "seen" (missions read it) even when nothing shows.
//   g.helpLevel() / g.setHelpLevel('beginner'|'normal'|'expert')
//   g.explain(term)           glossary card over any screen (map, phone, politics UI); resolves when closed
//   g.nextStepAdvice()        array of short advice lines (what to do next, from the player's state)
//   g.naviTalk(where)         the character as an NPC: a line and a short menu into the app's sections
//   g.naviLook()              her LOOK (for NPC entities that want her sprite)
//   g.assistState()           g.state.assist (created with defaults; old saves get them on first use)
// State g.state.assist = { v, help, tips{key: day}, seen{key: day}, missions{id: { done, claimed }},
//   terms{term: day}, lessons{id: day}, ideo{id: day}, newsRead, quiz, intro, showFuture, tipsOff }
//
// Content rules kept here: neutral wording, 賛成・反対 for every policy question, no real living
// politicians, historical names only inside the ideology encyclopedia (ideology.js), fictional
// characters only. Era-aware: the device is スマホ / ケータイ / 手帳 (profile.js ERAS), glossary terms
// that do not exist yet are hidden (or marked) by the game year, lessons and advice read the year.

import { Game } from './game.js';
import { SW, SH, clamp, fmtMoney, shade, mix, makeCanvas, hash2 } from './util.js';
import { text, wrap, measure, COLORS, panel, downArrow, cursor } from './draw.js';
import { audio } from './audio.js';
import { charSheetHD, drawFaceHD, LOOKS } from './sprites.js';
import { registerPhoneApp, onMorning } from './life.js';
import { eraOf, ageOf, YEAR_DAYS } from './profile.js';
import { registerItem } from './state.js';
import * as PH from './phone.js';
import {
  GLOSSARY, GLOSSARY_CATS, glossaryLookup, glossaryFind, termStatus, termText, glossaryTermsByCat, glossaryKanaOrder,
  termSince, termUntil, eraTerm,
} from './glossary.js';

// ---------------------------------------------------------------- optional cores (guarded, literal paths)
let POL = null;
let IDEO = null;
import('./politics.js').then((m) => { POL = m; hookPolitics(m); }).catch(() => { POL = null; });
import('./crime.js').then((m) => { hookJustice(m); }).catch(() => {});
export const ideologyReady = import('./ideology.js').then((m) => { IDEO = m; return m; }).catch(() => { IDEO = null; return null; });

// ================================================================ the character
export const NAVI = {
  id: 'navi',
  name: '七海 ことは',
  kana: 'ななみ ことは',
  short: 'ことは先生',
  title: 'ドット大学の講師（政治学）',
  color: '#2a9d8f',
  look: { hair: 'long', hairColor: '#3a2a4a', skin: 'light', top: '#2f7f74', bottom: '#33384a', jacket: true, skirt: true, glasses: true, glassesColor: '#a83a3a', ribbon: '#ffd23f', tie: '#ffd23f' },
  profile: 'ドット大学で政治学を教える講師。選挙や国会のしくみを、だれにでもわかる言葉で話すのが得意。どの政党の味方もしないのがポリシー。',
};
const NAVI_SAY = { name: NAVI.short, look: NAVI.look };
registerItem('navi_cert', { name: '政治ナビの修了証', price: 0, desc: 'ことは先生からもらった修了証。\n「政治のはじめの一歩、おめでとう！」と書いてある。' });

// ================================================================ small helpers
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
function sfx(n) { try { audio.sfx(n); } catch (e) { /* tests */ } }
function safe(fn, d = null) { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } }
const today = (g) => (g && g.state ? g.state.day : 1);
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export function yearOf(g) {
  try { if (g && typeof g.polDate === 'function') return g.polDate().year; } catch (e) { /* fall back */ }
  const era = (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
  return (ERA_BASE[era] || 2026) + Math.floor((today(g) - 1 + 30) / 120);
}
function dateText(g, day) { try { if (POL && POL.dateLabel) return POL.dateLabel(g, day).replace(/^\d+年/, ''); } catch (e) { /* */ } return `${day}日目`; }
export function deviceWord(g) { return (g && g.state ? eraOf(g.state).deviceShort : '') || 'スマホ'; }
// 「スマホの『政治ナビ』」 / 「手帳の『政治ナビ』」
function naviWhere(g) { return `${deviceWord(g)}の「政治ナビ」`; }
const vAge = (g) => safe(() => (POL && POL.votingAge ? POL.votingAge(yearOf(g), (g.state.politics || {}).flags || {}) : (yearOf(g) >= 2016 ? 18 : 20)), yearOf(g) >= 2016 ? 18 : 20);
function polState(g) { if (!g || !g.state || typeof g.pol !== 'function') return null; return safe(() => g.pol(), null); }
// The game's own 「いま」 for the glossary (glossary.js ctx): 消費税率, 選挙権年齢, 衆議院の選挙制度と定数,
// constitutional amendments made in this game, 郵政. Every core is feature-detected; a missing one
// leaves its fields out and the glossary falls back to the real timeline for them. Cached per game day.
const AMEND_NAMES = { amend_sdf: '自衛隊の明記', amend_emergency: '緊急事態条項', amend_education: '教育の無償化', amend_environment: '環境権' };
function glossCtx(g) {
  if (!g || !g.state) return null;
  const p = polState(g);
  // recomputed when the day, the 消費税 rate, the laws or the flags change (a bill passed today)
  const key = `${g.state.day}|${p ? `${p.economy && p.economy.taxRate}|${(p.laws || []).length}|${Object.keys(p.flags || {}).length}` : '-'}`;
  if (g._naviCtx && g._naviCtx.key === key && g._naviCtx.st === g.state) return g._naviCtx.c;
  const yr = yearOf(g);
  const era = (g.state.profile && g.state.profile.era) || 'reiwa';
  const c = { year: yr, month: safe(() => (typeof g.polDate === 'function' ? g.polDate().month : null), null), startYear: ERA_BASE[era] || 2026 };
  if (p) {
    const F = p.flags || {};
    if (p.economy && Number.isFinite(Number(p.economy.taxRate))) c.taxRate = Number(p.economy.taxRate);
    if (F.taxPlan && !F.taxPlan.done && Number(F.taxPlan.rate) > 0) c.taxPlan = { rate: Number(F.taxPlan.rate), year: F.taxPlan.year, month: F.taxPlan.month };
    c.reducedRate = !!F.reducedRate;
    c.age18 = !!F.age18 && yr < 2016;
    c.votingAge = vAge(g);
    c.heiritsuGame = !!F.heiritsuFrom && Number(F.heiritsuFrom) <= 1995;
    c.heiritsuLaw = c.heiritsuGame || yr >= 1994;
    c.referendumLawGame = !!F.referendumLaw;
    c.referendumLaw = !!F.referendumLaw || yr >= 2010;
    const next = safe(() => (POL && POL.shugiRules ? POL.shugiRules(yr, F) : null), null);
    const sh = p.diet && p.diet.shugi;
    if (next || sh) c.shugi = { now: (sh && sh.system) || (next && next.system) || null, next: next ? next.system : null, total: (next && next.total) || (sh && sh.total) || null, smd: next ? next.smd : null, pr: next ? next.pr : null };
    const am = Object.keys(AMEND_NAMES).filter((id) => F['done_' + id]).map((id) => safe(() => POL.POLICIES[id].name, null) || `憲法改正（${AMEND_NAMES[id]}）`);
    c.amendments = am;
    if (F.done_amend_emergency) c.emergencyClause = safe(() => POL.POLICIES.amend_emergency.name, null) || '緊急事態条項';
  }
  const r = safe(() => (typeof g.regime === 'function' ? g.regime() : null), null);
  if (r && r.steps && r.steps.clause) {
    c.amendments = [...(c.amendments || []), '強権型の緊急事態条項'];
    c.emergencyClause = '強権型の緊急事態条項（もしもの世界のシミュレーション）';
  }
  if (c.taxRate == null) {
    const rows = safe(() => (typeof g.taxRates === 'function' ? g.taxRates() : null), null);
    const sh = Array.isArray(rows) ? rows.find((x) => x && x.id === 'shohi') : null;
    if (sh && Number.isFinite(Number(sh.rate))) c.taxRate = Number(sh.rate);
  }
  if (!c.taxPlan) {
    const tr = safe(() => (typeof g.taxReform === 'function' ? g.taxReform() : null), null);
    const pl = tr && Array.isArray(tr.plan) ? tr.plan.find((x) => x && x.id === 'shohi' && Number(x.rate) > num(c.taxRate)) : null;
    if (pl) c.taxPlan = { rate: Number(pl.rate), year: pl.year, month: pl.month };
  }
  const ps = safe(() => (typeof g.postal === 'function' ? g.postal() : null), null);
  if (ps && ps.stage) c.postal = { stage: ps.stage, law: ps.inForce || null, privatized: ps.privatized ? { year: ps.privatized.year, month: ps.privatized.month } : null };
  g._naviCtx = { key, st: g.state, c };
  return c;
}
// glossary helpers bound to the game (year + ctx)
const gStatus = (g, e) => termStatus(e, yearOf(g), glossCtx(g));
const gText = (g, e) => termText(e, yearOf(g), glossCtx(g));
const gTerm = (g, term) => eraTerm(term, yearOf(g), glossCtx(g));

// ================================================================ state
const HELP_LEVELS = ['beginner', 'normal', 'expert'];
export const HELP_NAMES = { beginner: 'はじめて', normal: 'ふつう', expert: 'くわしい' };
const HELP_DESC = {
  beginner: 'ヒントの吹き出しを多めに出す。',
  normal: 'ふつうの量のヒントを出す。',
  expert: 'ヒントは大事なものだけ。アドバイスもやることが中心。',
};
export function assistState(g) {
  const st = g && g.state;
  if (!st) return null;
  let a = st.assist;
  if (a && a.v === 1 && a.tips && a.seen && a.missions && a.terms && a.lessons && a.ideo) return a;
  if (!a || typeof a !== 'object' || Array.isArray(a)) a = st.assist = {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  a.v = 1;
  if (!HELP_LEVELS.includes(a.help)) a.help = 'normal';
  for (const k of ['tips', 'seen', 'missions', 'terms', 'lessons', 'ideo']) a[k] = obj(a[k]);
  a.newsRead = num(a.newsRead);
  a.quiz = a.quiz && typeof a.quiz === 'object' ? a.quiz : null;
  a.intro = !!a.intro;
  a.showFuture = !!a.showFuture;
  a.tipsOff = !!a.tipsOff;
  return a;
}
function markSeen(g, key) { const a = assistState(g); if (a && !a.seen[key]) a.seen[key] = today(g); }

// ================================================================ text helpers (shared by every screen)
// Japanese line breaking for small screens: a closing mark / small kana never starts a line (it hangs),
// an opening bracket never ends one, and a run of ASCII (numbers, words, 1.004%) is never split
// unless it is wider than the line.
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
function tokens(par) {
  const out = [];
  // numbers keep their unit (3分の2, 1800万人, 10日以内), ASCII words stay whole
  const re = /[0-9０-９]+(?:[.,][0-9]+)*(?:分の[0-9]+|[%％年月日歳人分万億兆円倍回本条号割]+)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
  let m;
  while ((m = re.exec(par))) out.push(m[0]);
  return out;
}
export function wrapJ(c, str, w, size = 12) {
  measure(c, '', size); // sets the font
  const W = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = tokens(par);
    let line = '';
    for (let i = 0; i < toks.length; i++) {
      let t = toks[i];
      if (!line && /^\s+$/.test(t) && out.length) continue;
      if (W(line + t) <= w || !line) {
        if (!line && W(t) > w) {
          // a token wider than the line: split it by characters
          for (const ch of Array.from(t)) { if (line && W(line + ch) > w) { out.push(line); line = ''; } line += ch; }
          continue;
        }
        line += t;
        continue;
      }
      // the token does not fit. A closing mark never starts a line: the last character of this line
      // goes down with it (追い出し), so no line is ever wider than w
      let carry = '';
      if (t.length === 1 && NO_START.has(t)) {
        const a0 = Array.from(line);
        let k = a0.length - 1;
        while (k > 0 && NO_START.has(a0[k])) k--;
        if (k > 0) { carry = a0.slice(k).join(''); line = a0.slice(0, k).join(''); } else { line += t; continue; }
      }
      // an opening bracket at the end of the line moves down with the next token
      while (line.length > 1 && NO_END.has(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
      out.push(line.replace(/\s+$/, ''));
      line = carry + (/^\s+$/.test(t) ? '' : t);
      if (W(line) > w) {
        const chars = Array.from(line);
        line = '';
        for (const ch of chars) { if (line && W(line + ch) > w) { out.push(line); line = ''; } line += ch; }
      }
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out;
}
function T(c, s, x, y, size = 12, color = '#2a2a3a', align = 'left', shadow = null) { text(c, String(s), Math.round(x), Math.round(y), { size, color, align, shadow }); }
function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function frame(c, x, y, w, h, fill, edge) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  R(c, x + 1, y, w - 2, 1, edge); R(c, x + 1, y + h - 1, w - 2, 1, edge); R(c, x, y + 1, 1, h - 2, edge); R(c, x + w - 1, y + 1, 1, h - 2, edge);
  if (fill) R(c, x + 1, y + 1, w - 2, h - 2, fill);
}
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
}
function line(c, x0, y0, x1, y1, col) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (let k = 0; k < 1000; k++) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// ---------------------------------------------------------------- her portrait (the HD sprite, crisp)
// A bust: the top 30 rows of the 32x40 HD frame at an integer scale (k), on a small framed card.
export function drawNaviBust(c, x, y, k = 2, o = {}) {
  const sheet = charSheetHD(NAVI.look);
  const img = sheet.down[0];
  const w = 32 * k, h = 30 * k;
  if (o.card !== false) {
    frame(c, x - 2, y - 2, w + 4, h + 4, o.bg || '#d8efe9', o.edge || '#1f6f66');
    // a little blackboard behind her
    R(c, x, y, w, Math.round(h * 0.55), '#2d5a4a');
    R(c, x, y + Math.round(h * 0.55), w, 1, '#8a6a3a');
    for (let i = 0; i < 3; i++) R(c, x + 4 + i * Math.round(w / 3.2), y + 5 + (i % 2) * 4, Math.round(w / 5), 1, '#a8d8c0');
  }
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0, 32, 30, Math.round(x), Math.round(y), w, h);
  c.restore();
}

// ================================================================ context tips (portrait + bubble)
// TIPS[key] = { lv: 1 (はじめて only) | 2 (はじめて・ふつう) | 3 (every level), text: string | (g) => string }
// text '' = record only (missions read the key).
export const TIPS = {
  // the player's first steps
  phone_open: { lv: 3, ctx: 'phone', text: (g) => (deviceWord(g) === '手帳' ? '手帳に「政治ナビ」のページをはさんでおいたよ。政治でこまったら、いつでも開いてね。' : `${deviceWord(g)}に「政治ナビ」を入れておいたよ。政治でこまったら、いつでも開いてね。`) },
  polui_open: { lv: 2, ctx: 'ui', text: () => '政治アプリでは、選挙・政党・国会・内閣が見られるよ。まずは「選挙」で、立候補の条件をチェック！' },
  navi_first: { lv: 1, text: () => 'まずは「いま何をすればいい？」を見てみて。あなたの状況にあわせて答えるよ。' },
  // places
  nagatacho: { lv: 2, text: () => 'ここは永田町。国会議事堂、首相官邸、党本部が集まる、日本の政治の中心だよ。' },
  kokkai: { lv: 2, text: () => '国会議事堂の参観ロビー。見学（参観）はだれでも無料。国会の会期中は、本会議の傍聴もできるよ。' },
  kuyakusho: { lv: 1, text: () => '区役所の2階は選挙管理委員会。立候補の届出や、選挙のときの投票ができるよ。' },
  senkan: { lv: 2, text: () => `ここが選挙管理委員会。立候補の届出は本来、公示・告示の日だけ（ゲームでは投票日の${FILING_DAYS()}日前から受付）。供託金もここで納めるよ。` },
  senkan_counter: { lv: 3, text: '' },
  kokkai_bocho: { lv: 3, text: '' },
  party_hq: { lv: 2, text: () => '党本部の1階で入党できるよ。2階の選挙対策本部では、選挙の「公認」をお願いできる。' },
  myparty_hq: { lv: 2, text: (g) => `自分の党をつくるなら、ここ。国会議員5人以上か、国会議員1人以上で得票率2%以上あると、${yearOf(g) >= 1994 ? '「政党」と認められるよ（政党要件（せいとうようけん））' : 'このゲームでは「政党」として扱われるよ'}。` },
  kantei: { lv: 2, text: () => '首相官邸。総理大臣が仕事をするところで、閣議や記者会見もここで行われるよ。' },
  saibansho: { lv: 2, text: () => '裁判は公開が原則（憲法82条）。法廷の傍聴は、だれでもできるよ。' },
  keisatsu: { lv: 1, text: () => '警察署。逮捕には、原則として裁判官の令状がいるんだ。困りごとの相談もできるよ。' },
  shohisha: { lv: 3, text: (g) => (yearOf(g) >= 2010 ? 'お金を借りる前に、利息と返す計画を確かめて。借りられるのは原則、年収の3分の1まで（総量規制）。' : 'お金を借りる前に、利息と返す計画をよく確かめて。返せなくなったら、区役所3階の相談室へ。') },
  yamikin: { lv: 3, text: () => 'ここは登録のない違法な業者（ヤミ金）かもしれない。借りてしまったら、返す前に警察か弁護士に相談して。' },
  // politics events
  first_elected: { lv: 3, text: (g) => { const o = safe(() => polState(g).me.office, null); return o === 'shugi' || o === 'sangi' ? '当選おめでとう！会期中は本会議に出て、採決に加わろう。地元回りと後援会も大切だよ。' : '当選おめでとう！議会の定例会で質問して、住民の声を届けよう。'; } },
  minister: { lv: 3, text: () => '大臣になったら、閣議に出て、国会で答弁するのが仕事。役所の説明も、よく聞いてね。' },
  pm: { lv: 3, text: () => '総理大臣になったね。内閣支持率と国会の議席をよく見て。予算は年度内に成立させるのが大事だよ。' },
  scandal: { lv: 3, text: () => 'スキャンダルが出たら、事実をはっきり説明することが大切。かくすほど信頼を失うよ。' },
  dissolve: { lv: 2, text: () => '衆議院が解散！40日以内に総選挙だよ。立候補するなら、公示日までに届出を。' },
  session: { lv: 1, text: () => '国会が始まったよ。法律案は、委員会で審査してから本会議で採決するんだ。' },
  vote_day: { lv: 2, text: () => '今日は投票日！区役所2階の投票所で投票できるよ。' },
  filing_open: { lv: 2, text: () => `選挙の届出の受付が始まったよ（本来の届出は公示・告示の日。ゲームでは投票日の${FILING_DAYS()}日前から受け付ける）。立候補するなら、区役所の選管か党本部へ。` },
  quiz_done: { lv: 1, text: () => '結果は目安だよ。考えは変わっていいし、どれが正しいということもないんだ。' },
  // for the government console (js/engine/govt_ui.js) and the regime / security screens
  govt_open: { lv: 2, text: () => '政府の中枢の画面。予算・税・省庁・世論が一度に見られるよ。わからない言葉は「？」で用語じてんへ。' },
  govt_budget: { lv: 2, text: (g) => `予算づくりは、概算要求（8月）→${yearOf(g) >= 2001 ? '財務省' : '大蔵省'}原案（12月）→閣議決定→国会。衆議院が先に審議するよ。` },
  govt_tax: { lv: 2, text: () => '税率を上げると財源はふえるけど、くらしの負担も重くなる。賛成・反対の両方の声を見て決めよう。' },
  govt_ministries: { lv: 1, text: () => '省庁のトップは大臣。法律の細かいことは、政令（内閣）や省令（大臣）で決めるんだ。' },
  govt_voices: { lv: 1, text: () => '世論の声は、立場によってちがう。ひとつの声だけで決めつけないでね。' },
  govt_demo: { lv: 2, text: () => 'デモは表現の自由（憲法21条）で守られている。政府は力でおさえず、対話で応えるのが基本だよ。' },
  govt_approval: { lv: 1, text: () => '支持率は世論調査の数字。層ごとの内わけを見ると、どこで支持を失ったかがわかるよ。' },
  govt_seats: { lv: 1, text: () => '法律を通すには、衆参それぞれで過半数。衆議院だけなら、3分の2で再可決もできるよ。' },
  govt_postal: { lv: 2, text: () => '郵政民営化は、効率化に期待する声と、地方のサービスを心配する声に分かれた大きな議論だよ。' },
  govt_religion: { lv: 2, text: () => '信教の自由と政教分離（憲法20条・89条）。国は、特定の宗教を優遇も弾圧もしてはいけないんだ。' },
  govt_resign: { lv: 2, text: () => '総辞職しても、次の総理が国会で指名されるまでは、いまの内閣が仕事を続けるよ。' },
  govt_change: { lv: 2, text: () => '政権交代は、選挙で国民が政権を選び直せるしるし。新しい与党は、公約の実行が問われるよ。' },
  opposition: { lv: 1, text: () => '野党の仕事は、政府のチェックと、ちがう選択肢を示すこと。' },
  amendment: { lv: 2, text: () => '憲法改正は、衆参それぞれ3分の2で発議して、国民投票で過半数。とても高いハードルだよ。' },
  regime_emergency: { lv: 3, text: () => '非常事態でも、憲法と法律の手続きを守るのが立憲主義。権力が1か所に集まるのは、とても危険なんだ。' },
  regime_press: { lv: 3, text: () => '報道への圧力は、民主主義の土台を弱めるよ。強い反発や、裁判所の違憲判断も覚悟して。' },
  regime_dictator: { lv: 3, text: () => '（もしもの話）独裁は、チェックする人がいなくなる体制。歴史では、たくさんの悲劇につながったよ。' },
  sdf_order: { lv: 2, text: () => '自衛隊の最高指揮官は総理大臣。防衛出動には国会の承認がいる（文民統制（ぶんみんとうせい））。' },
  disaster_first: { lv: 3, text: () => '災害のときは、まず命を守ること。国は対策本部をつくり、知事などの要請で自衛隊が災害派遣に出るよ。' },
  war_warning: { lv: 3, text: () => '（もしもの話）戦争は、たくさんの命とくらしを失わせる。勝っても、制裁や孤立が待っているんだ。' },
};
// where a place shows its first tip (places owned by other modules; kokkai / kuyakusho / parties call
// g.assistTip themselves)
const PLACE_TIPS = { nagatacho: 'nagatacho', kantei: 'kantei', saibansho: 'saibansho', keisatsu: 'keisatsu', shohisha: 'shohisha', yamikin: 'yamikin' };
// tips about a place are dropped when the player leaves it before the tip was shown (or while it shows)
const PLACE_BOUND = new Set(['kokkai', 'kuyakusho', 'senkan', 'party_hq', 'myparty_hq', ...Object.values(PLACE_TIPS)]);

function tipBox(g) { return g._naviTips || (g._naviTips = { queue: [], cur: null, lastPlace: null, watchT: 0 }); }
function helpOf(g) { const a = assistState(g); return a ? a.help : 'normal'; }
function tipAllowed(g, lv) {
  const a = assistState(g);
  if (!a || a.tipsOff) return false;
  const h = a.help;
  return h === 'beginner' ? true : h === 'normal' ? lv >= 2 : lv >= 3;
}
function tipText(g, key, opts) {
  const t = opts && opts.text != null ? opts.text : TIPS[key] ? TIPS[key].text : '';
  try { return [].concat(typeof t === 'function' ? t(g) : t).filter(Boolean).join('\n'); } catch (e) { return ''; }
}
// The tip is drawn only where the player is free: walking around (no script, no fade), or inside the
// phone / the politics UI / another UI scene that sets allowTips. Never over a dialogue or a cutscene.
function tipContext(g) {
  if (!g.state || g.auto || g.fade > 0.01) return null;
  const top = g.top;
  if (!top) return null;
  if (top === g.map) return g.busy === 0 && g.map.place ? 'map' : null;
  if (top.isPhone && !top.closing && !top.dismissed) return 'phone';
  if (top.isPolUI || top.isGovtUI || top.allowTips) return 'ui';
  return null;
}
export function assistTip(g, key, opts = {}) {
  if (!g || !g.state || !key) return false;
  const a = assistState(g);
  markSeen(g, key);
  checkMissions(g);
  if (opts.silent) return false;
  if (g.auto) return false;
  if (a.tips[key] && !opts.force) return false;
  const def = TIPS[key] || {};
  const lv = opts.level || def.lv || 2;
  if (!opts.force && !tipAllowed(g, lv)) return false;
  const txt = tipText(g, key, opts);
  if (!txt) return false;
  const b = tipBox(g);
  if ((b.cur && b.cur.key === key) || b.queue.some((q) => q.key === key)) return false;
  const place = opts.place || (PLACE_BOUND.has(key) && g.map ? g.map.placeId : null) || null;
  b.queue.push({ key, text: txt, place, ctx: opts.ctx || def.ctx || null });
  if (b.queue.length > 4) b.queue.shift();
  return true;
}
function stepTips(g) {
  const b = g._naviTips;
  if (!b || (!b.cur && !b.queue.length)) return;
  const ctx = tipContext(g);
  const here = g.map ? g.map.placeId : null;
  if (b.cur && b.cur.place && here !== b.cur.place) b.cur = null;
  if (b.cur && b.cur.ctx && ctx && ctx !== b.cur.ctx) b.cur = null; // its screen was closed: it has been seen
  if (b.queue.length && here) b.queue = b.queue.filter((q) => !q.place || q.place === here);
  if (!b.cur) {
    if (!ctx || !b.queue.length) return;
    const k = b.queue.findIndex((q) => !q.ctx || q.ctx === ctx);
    if (k < 0) return;
    const next = b.queue.splice(k, 1)[0];
    const a = assistState(g);
    if (!a) return;
    a.tips[next.key] = today(g);
    const n = Array.from(next.text).length;
    b.cur = { ...next, t: 0, life: clamp(240 + n * 5, 300, 660) };
    sfx('cursor');
    return;
  }
  if (ctx && (!b.cur.ctx || b.cur.ctx === ctx)) { b.cur.t++; if (b.cur.t >= b.cur.life) b.cur = null; }
}
function drawTip(c, g) {
  const b = g._naviTips;
  if (!b || !b.cur) return;
  const ctx = tipContext(g);
  if (!ctx || (b.cur.ctx && b.cur.ctx !== ctx)) return;
  const t = b.cur.t, life = b.cur.life;
  const a = t < 10 ? t / 10 : life - t < 16 ? (life - t) / 16 : 1;
  // geometry by context: on the map bottom-left; with the phone open, the free strip left of it;
  // over a full-screen UI, above its footer on the left
  let x = 8, w = 312, y;
  if (ctx === 'phone') { x = 6; w = (PH.PHONE ? PH.PHONE.x : 200) - 12; }
  else if (ctx === 'ui') x = SW - w - 8; // over a full-screen UI: top right, under its header
  const pw = 44;
  const tw = w - pw - 22;
  const lines = wrapJ(c, b.cur.text, tw, 12).slice(0, ctx === 'phone' ? 9 : 5);
  const h = Math.max(54, 24 + lines.length * 16);
  y = ctx === 'phone' ? 40 : ctx === 'ui' ? 30 : SH - 10 - h;
  const slide = t < 10 ? Math.round((1 - t / 10) * 12) : 0;
  c.save();
  c.globalAlpha = clamp(a, 0, 1);
  c.translate(-slide, 0);
  // portrait
  R(c, x + 2, y + 2, pw, pw, 'rgba(0,0,0,0.35)');
  frame(c, x, y, pw, pw, '#d8efe9', '#1f6f66');
  c.save();
  c.beginPath(); c.rect(x + 1, y + 1, pw - 2, pw - 2); c.clip();
  drawFaceHD(c, NAVI.look, x + 2 - 4, y + 6, 1.5);
  c.restore();
  // bubble
  const bx = x + pw + 8;
  const bw = w - pw - 8;
  R(c, bx + 2, y + 2, bw, h, 'rgba(0,0,0,0.35)');
  frame(c, bx, y, bw, h, '#fbfaf3', '#1f6f66');
  // tail
  for (let i = 0; i < 6; i++) R(c, bx - 6 + i, y + 16 + i - 0, 1, 12 - i * 2, i === 0 ? '#1f6f66' : '#fbfaf3');
  R(c, bx - 6, y + 16, 6, 1, '#1f6f66');
  T(c, NAVI.short, bx + 8, y + 4, 12, '#1f6f66');
  const hint = '政治ナビ';
  T(c, hint, bx + bw - 8, y + 4, 12, '#8a9a96', 'right');
  lines.forEach((l, i) => T(c, l, bx + 8, y + 20 + i * 16, 12, '#2a2a3a'));
  // time left
  R(c, bx + 6, y + h - 4, Math.round((bw - 12) * (1 - t / life)), 1, '#9ad0c4');
  c.restore();
}

// watch where the player is (first visits of places, the politics UI, the phone), a few times a second
function watchContext(g) {
  const b = tipBox(g);
  if (++b.watchT % 20) return;
  if (!g.state || g.auto) return;
  const top = g.top;
  const a = assistState(g);
  if (!a) return;
  if (top && top.isPolUI && !a.seen.polui_open) assistTip(g, 'polui_open');
  if (top && top.isPhone && !a.seen.phone_open) assistTip(g, 'phone_open');
  const pid = g.map && g.map.placeId;
  if (pid && pid !== b.lastPlace) {
    b.lastPlace = pid;
    if (PLACE_TIPS[pid] && !a.tips[PLACE_TIPS[pid]]) assistTip(g, PLACE_TIPS[pid]);
  }
}

// ================================================================ the glossary card (g.explain)
const CARD = { w: 452, h: 300 };
class ExplainScene {
  constructor(g, term, resolve) {
    Object.assign(this, { g, hd: true, isExplain: true, t: 0, resolve, stack: [], sy: 0, chip: 0 });
    this.show(term);
  }
  show(term) {
    const yr = yearOf(this.g);
    const e = glossaryLookup(gTerm(this.g, term));
    this.cur = e ? { term: e.term, e } : { term: String(term || ''), e: null };
    this.sy = 0;
    this.chip = 0;
    this.yr = yr;
    if (e) { const a = assistState(this.g); if (a && !a.terms[e.term]) a.terms[e.term] = today(this.g); checkMissions(this.g); }
  }
  related() {
    const e = this.cur.e;
    if (!e) return [];
    const a = assistState(this.g);
    return (e.related || []).map((r) => gTerm(this.g, r)).filter((r, i, arr) => GLOSSARY[r] && arr.indexOf(r) === i && r !== this.cur.term && (a.showFuture || gStatus(this.g, GLOSSARY[r]) !== 'future'));
  }
  update(g) {
    this.t++;
    const inp = g.input;
    if (g.auto) { this.close(); return; }
    if (this.t < 4) return;
    const rel = this.related();
    if (inp.repeat('down') && this.maxScroll > 0) this.sy = Math.min(this.maxScroll, this.sy + 16);
    if (inp.repeat('up') && this.sy > 0) this.sy = Math.max(0, this.sy - 16);
    if (rel.length) {
      if (inp.repeat('left')) { this.chip = (this.chip + rel.length - 1) % rel.length; sfx('cursor'); }
      if (inp.repeat('right')) { this.chip = (this.chip + 1) % rel.length; sfx('cursor'); }
    }
    if (inp.pressed('a')) {
      if (rel.length) { sfx('ok'); this.stack.push(this.cur.term); this.show(rel[clamp(this.chip, 0, rel.length - 1)]); } else { sfx('cancel'); this.close(); }
      return;
    }
    if (inp.pressed('b') || inp.pressed('menu')) {
      sfx('cancel');
      if (this.stack.length && !inp.pressed('menu')) this.show(this.stack.pop()); else this.close();
    }
  }
  close() { if (this.closed) return; this.closed = true; this.g.pop(this); this.resolve(this.cur.term); }
  draw(c) {
    const k = clamp(this.t / 8, 0, 1);
    c.fillStyle = `rgba(6,10,20,${(0.55 * k).toFixed(3)})`;
    c.fillRect(0, 0, SW, SH);
    // the card is as tall as its text needs (the body scrolls beyond CARD.h)
    const e = this.cur.e;
    const n = e ? wrapJ(c, gText(this.g, e), CARD.w - 36, 12).length : 3;
    const h = clamp(104 + n * 17 + (this.related().length ? 26 : 0) + 28 + (e && cardSplit(c, this.g, e, CARD.w) ? 16 : 0), 190, CARD.h);
    const x = Math.round((SW - CARD.w) / 2), y = Math.round((SH - h) / 2) + Math.round((1 - k) * 16);
    drawTermCard(c, this.g, this.cur, { x, y, w: CARD.w, h }, this);
  }
}
function catOf(id) { return GLOSSARY_CATS.find((x) => x.id === id) || { name: '', color: '#888' }; }
function sinceLabel(e, yr, ctx = null) {
  const st = termStatus(e, yr, ctx);
  const since = termSince(e, yr, ctx), until = termUntil(e, yr, ctx);
  if (st === 'future') return { text: `この時代にはまだない（${since || '―'}〜）`, color: '#b05a2a' };
  if (st === 'past') return { text: `いまはない（${until || 'かつてあった'}）`, color: '#6a6a7a' };
  if (since) return { text: /た$/.test(since) ? since : `${since}から`, color: '#2a7a6a' };
  return null;
}
// The card's kana and since label share a row only when both fit; otherwise the label gets its own row.
function cardSplit(c, g, e, w) {
  const sl = sinceLabel(e, yearOf(g), glossCtx(g));
  if (!sl) return false;
  return measure(c, e.kana, 12) + measure(c, sl.text, 12) + 12 > w - 32;
}
// The card used by g.explain (also reused by the phone entry page for the header block).
function drawTermCard(c, g, cur, r, view) {
  const { x, y, w, h } = r;
  R(c, x + 4, y + 4, w, h, 'rgba(0,0,0,0.45)');
  frame(c, x, y, w, h, '#fbf8ee', '#1f6f66');
  R(c, x + 1, y + 1, w - 2, 24, '#2a9d8f');
  T(c, '用語じてん', x + 10, y + 5, 12, '#ffffff');
  T(c, `${NAVI.short}の政治ナビ`, x + w - 10, y + 5, 12, '#d8f4ee', 'right');
  const e = cur.e;
  const yr = yearOf(g);
  let yy = y + 32;
  if (!e) {
    T(c, fit(c, cur.term || '？', w - 40, 16), x + 16, yy, 16, '#2a2a3a');
    const ls = wrapJ(c, 'この言葉は、まだ用語じてんにのっていないみたい。政治ナビの「用語じてん」から、近い言葉をさがしてみてね。', w - 32, 12);
    ls.forEach((l, i) => T(c, l, x + 16, yy + 28 + i * 16, 12, '#4a4a5a'));
    T(c, 'A/B:とじる', x + w - 10, y + h - 18, 12, '#8a8a96', 'right');
    return;
  }
  const cat = catOf(e.cat);
  const cw = Math.round(measure(c, cat.name, 12)) + 10;
  T(c, fit(c, cur.term, w - 32 - cw - 8, 16), x + 16, yy, 16, '#1a1a28');
  frame(c, x + w - 16 - cw, yy, cw, 16, cat.color, shade(cat.color, -0.4));
  T(c, cat.name, x + w - 16 - cw + 5, yy + 2, 12, '#ffffff');
  const sl = sinceLabel(e, yr, glossCtx(g));
  // the reading and the 「…から」 label: one row when both fit, else the label on its own row below
  const split = cardSplit(c, g, e, w);
  if (sl && !split) {
    const lw = Math.round(measure(c, sl.text, 12));
    T(c, fit(c, e.kana, w - 32 - lw - 12, 12), x + 16, yy + 20, 12, '#7a7a88');
    T(c, sl.text, x + w - 16, yy + 20, 12, sl.color, 'right');
  } else {
    T(c, fit(c, e.kana, w - 32, 12), x + 16, yy + 20, 12, '#7a7a88');
    if (sl) T(c, fit(c, sl.text, w - 32, 12), x + w - 16, yy + 36, 12, sl.color, 'right');
  }
  yy += split ? 56 : 40;
  // the short line
  frame(c, x + 12, yy, w - 24, 22, '#e2f3ee', '#9ad0c4');
  T(c, fit(c, e.short, w - 40, 12), x + 20, yy + 5, 12, '#1f5f56');
  yy += 30;
  // the body (scrolls)
  const rel = view.related ? view.related() : [];
  const relH = rel.length ? 26 : 0;
  const bodyH = y + h - 22 - relH - yy;
  const body = gText(g, e);
  const lines = wrapJ(c, body, w - 36, 12);
  view.maxScroll = Math.max(0, lines.length * 17 - bodyH + 2);
  c.save();
  c.beginPath(); c.rect(x + 12, yy, w - 24, bodyH); c.clip();
  lines.forEach((l, i) => T(c, l, x + 18, yy + i * 17 - (view.sy || 0), 12, '#2a2a3a'));
  c.restore();
  if (view.maxScroll > 0) {
    const bh = Math.max(10, Math.round((bodyH * bodyH) / (lines.length * 17)));
    const by = yy + Math.round(((bodyH - bh) * (view.sy || 0)) / view.maxScroll);
    R(c, x + w - 10, yy, 3, bodyH, '#e4ddcc'); R(c, x + w - 10, by, 3, bh, '#2a9d8f');
  }
  // related chips
  if (rel.length) {
    const ry = y + h - 22 - relH + 4;
    T(c, '関連', x + 14, ry + 3, 12, '#7a7a88');
    let cx = x + 48;
    const sel = clamp(view.chip || 0, 0, rel.length - 1);
    // keep the selected chip visible: start from a chip so that it fits
    let first = 0;
    const widths = rel.map((r0) => Math.round(measure(c, r0, 12)) + 12);
    const avail = x + w - 14 - cx;
    while (first < sel && widths.slice(first, sel + 1).reduce((s, v) => s + v + 4, 0) > avail) first++;
    if (first > 0) T(c, '◀', cx - 2, ry + 3, 12, '#2a9d8f');
    for (let i = first; i < rel.length; i++) {
      const cw2 = widths[i];
      if (cx + cw2 > x + w - 14) { T(c, '▶', x + w - 14, ry + 3, 12, '#2a9d8f'); break; }
      const on = i === sel;
      frame(c, cx, ry, cw2, 18, on ? '#2a9d8f' : '#ffffff', on ? '#1f6f66' : '#b8c8c4');
      T(c, rel[i], cx + 6, ry + 3, 12, on ? '#ffffff' : '#2a5a54');
      cx += cw2 + 4;
    }
  }
  const hint = rel.length ? `↑↓:よむ　←→:関連　A:関連へ　B:${(view.stack && view.stack.length) ? 'もどる' : 'とじる'}` : '↑↓:よむ　A/B:とじる';
  T(c, hint, x + w - 10, y + h - 17, 12, '#8a8a96', 'right');
}
export function explain(g, term) {
  if (!g || !g.state) return Promise.resolve(null);
  const e = glossaryLookup(gTerm(g, term));
  if (e) { const a = assistState(g); if (a && !a.terms[e.term]) a.terms[e.term] = today(g); checkMissions(g); }
  if (g.auto) return Promise.resolve(e ? e.term : null);
  return new Promise((resolve) => g.push(new ExplainScene(g, term, resolve)));
}

// ================================================================ いま何をすればいい？ (advice)
// adviceItems(g) → [{ prio, text, detail, go }] (go: { navi: topic } | { politics: screen } | { term } | null)
const kojiWord = (kind) => (kind === 'shugi' || kind === 'sangi' ? '公示' : '告示');
const FILING_DAYS = () => (POL && Number(POL.FILING_DAYS) > 0 ? Number(POL.FILING_DAYS) : 30);
function ageOnDay(g, day) {
  const st = g.state;
  const now = ageOf(st);
  // birthdays come every YEAR_DAYS days (profile.js); count the ones before `day`
  const into = (st.day - 1) % YEAR_DAYS;
  return now + Math.floor((into + Math.max(0, day - st.day)) / YEAR_DAYS);
}
function daysToAge(g, age) {
  const st = g.state;
  const now = ageOf(st);
  if (now >= age) return 0;
  return (age - now) * YEAR_DAYS - ((st.day - 1) % YEAR_DAYS);
}
const OFFICE_AGE = { kugi: 25, togi: 25, shicho: 25, chiji: 30, shugi: 25, sangi: 30 };
export function adviceItems(g) {
  const out = [];
  if (!g || !g.state) return out;
  const st = g.state;
  const add = (prio, text, detail = '', go = null) => out.push({ prio, text, detail, go });
  const age = ageOf(st);
  const va = vAge(g);
  const yr = yearOf(g);
  // ---- justice: custody, trial, prison, probation, 公民権停止
  try {
    const j = typeof g.jus === 'function' ? g.jus() : null;
    if (j) {
      if (j.status === 'prison') add(100, 'いまは刑に服している。まずは刑期をつとめよう。', '服役中は政治活動も選挙もできない。罪によっては、出たあとも一定の期間、選挙権・被選挙権がない（公民権停止）。', { term: '公民権停止' });
      else if (j.status === 'detained') add(100, 'いまは身柄を拘束されている。', '取り調べや手続きが進んでいる。弁護士の話をよく聞こう。有罪が決まるまでは無罪として扱われる（推定無罪）。', { term: '推定無罪' });
      else if (j.status === 'trial') add(95, '裁判が続いている。判決を待とう。', '判決が出るまでは、目立つ行動はひかえよう。判決に不服なら、上の裁判所にうったえられる（三審制）。', { term: '三審制' });
      else if (j.status === 'probation') add(62, '執行猶予中。新しい罪を犯さないように。', '期間中にまた罪を犯すと、猶予が取り消されて刑を受けることになる。', { term: '執行猶予' });
    }
    if (typeof g.civicBanned === 'function' && g.civicBanned('candidacy')) {
      const why = typeof g.civicBanReason === 'function' ? g.civicBanReason('candidacy') : '';
      add(90, '公民権停止中。いまは立候補できない。', why || '罪によって、一定の期間、選挙権・被選挙権がなくなっている。', { term: '公民権停止' });
    }
  } catch (e) { console.error(e); }
  // ---- money: 闇金, loans, rent
  try {
    const yami = typeof g.loanTotal === 'function' ? num(g.loanTotal('yamikin')) : 0;
    const all = typeof g.loanTotal === 'function' ? num(g.loanTotal()) : 0;
    if (yami > 0) add(93, 'ヤミ金から借りている。返す前に警察か弁護士へ！', 'ヤミ金は違法な業者。区役所3階の相談室、警察、弁護士に相談すれば、取り立てを止められる。', { term: 'ヤミ金' });
    else if (all > 0) add(68, `借金が ${fmtMoney(all)} ある。返す計画を立てよう。`, '返せなくなりそうなら、早めに区役所3階の相談室か弁護士へ。任意整理や自己破産などの方法がある。', { term: '多重債務' });
    if (st.rent && st.rent.debt > 0) add(74, `家賃の滞納が ${fmtMoney(st.rent.debt)} ある。`, 'まずは家賃を払おう。お仕事でお金をかせぐのが先。', null);
  } catch (e) { console.error(e); }
  // ---- politics
  const p = polState(g);
  if (p && p.me) {
    const me = p.me;
    const day = st.day;
    try {
      if (p.cabinet && p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline' && p.cabinet.pm === 'player') add(99, '内閣不信任案が可決！解散か総辞職を決める。', '憲法69条で、10日以内に衆議院を解散するか、内閣総辞職しなければならない。', { politics: 'dashboard' });
      const offers = (me.offers || []).filter((o) => !o.answered);
      if (offers.length) add(88, '打診への返事を待っている人がいる。', '政治アプリのお知らせから、引き受けるかどうか決めよう。返事には期限がある。', { politics: 'dashboard' });
      if (num(me.secret) > 0) add(86, `裏金 ${fmtMoney(me.secret)} がある。見つかる危険がある。`, '政治資金収支報告書にのせないお金は違法。報告書を訂正して公開すれば、そのぶん正しい状態にもどせる。', { term: '裏金' });
      if (me.scandalDay && day - num(me.scandalDay) <= 20) add(77, 'スキャンダルの直後。説明責任を果たそう。', '記者会見で事実をはっきり説明することが、信頼を取りもどす第一歩。', { politics: 'activities' });
    } catch (e) { console.error(e); }
    let ups = [];
    try { ups = typeof g.upcomingElections === 'function' ? g.upcomingElections() : []; } catch (e) { ups = []; }
    const pub = ups.filter((e) => !e.newsOnly && e.kind !== 'sosaisen' && e.office);
    // my race
    const mine = pub.find((e) => e.declared);
    if (mine) {
      if (day < mine.koji) add(84, `${mine.label}に届出ずみ。${kojiWord(mine.kind)}まであと${mine.koji - day}日。`, `${kojiWord(mine.kind)}の前は「政治活動」だけ。選挙運動は${kojiWord(mine.kind)}の日から（事前運動の禁止）。`, { politics: 'campaign' });
      else if (day <= mine.day) add(91, `選挙運動中！投票日まであと${mine.day - day}日。`, '街頭演説やポスターで支持を広げよう。お金や物を配る買収、家を回る戸別訪問は犯罪。', { politics: 'campaign' });
    }
    // voting (選挙権 on 投票日; not during 公民権停止 for voting)
    try {
      const banned = typeof g.civicBanned === 'function' && g.civicBanned('vote');
      const full = (p.elections && p.elections.upcoming) || [];
      for (const e of pub) {
        const raw = full.find((x) => x.id === e.id);
        if (!raw || raw.voted || banned) continue;
        if (ageOnDay(g, e.day) < va) continue;
        if (day === e.day) { add(87, `今日は${e.label}の投票日！`, '区役所2階の投票所で投票できる。あなたの1票が、政治を決める。', { term: '選挙権' }); break; }
        if (day > e.koji && day < e.day && yr >= 2004) { add(56, `${e.label}の期日前投票ができる。`, '区役所2階の期日前投票所へ。投票日に行けなくても大丈夫。', { term: '期日前投票' }); break; }
      }
    } catch (e) { console.error(e); }
    // not in office and not running: what the next election needs
    if (!me.office && !mine) {
      try {
        if (age < va) add(32, `選挙権は${va}歳から。いまは政治を学ぶチャンス！`, '「政治のしくみ」や「用語じてん」で、選挙や国会のことを知っておこう。', { navi: 'lessons' });
        if (age < 25) add(40, `立候補は25歳から（あと${daysToAge(g, 25)}日）。`, '参議院と知事は30歳から。それまでに政党の活動や勉強をしておこう。', { term: '被選挙権' });
        else {
          const fd = FILING_DAYS();
          const cands = pub.filter((e) => e.kind !== 'hosen' && day <= e.koji && ageOnDay(g, e.day) >= (OFFICE_AGE[e.office] || 25));
          const ok = cands.filter((e) => safe(() => g.eligible(e.office, { noMoney: true, day: e.day }), null) == null);
          const open = ok.find((e) => day >= e.day - fd);
          if (open) {
            const dep = num(safe(() => g.depositInternal(open.office), 0));
            const have = num(st.money) + num(me.funds);
            if (dep > have) add(80, `${open.label}の届出を受付中。でも供託金が足りない。`, `供託金は${fmtMoney(dep)}（あと${fmtMoney(dep - have)}）。届出は${open.kojiDate}まで。政治資金を集めるか、お金をためよう。`, { term: '供託金' });
            else add(81, `${open.label}の届出を受付中（${dateText(g, open.koji)}まで）。`, `立候補するなら、区役所2階の選挙管理委員会か、党本部の選挙対策本部へ。供託金は${fmtMoney(dep)}。`, { politics: 'elections' });
          } else if (ok.length) {
            const e = ok[0];
            add(44, `つぎは${e.label}（投票 ${dateText(g, e.day)}）。`, `本来の届出は${kojiWord(e.kind)}の日。ゲームでは投票日の${fd}日前から受け付ける。それまでに政党の公認をめざそう。`, { politics: 'elections' });
          }
        }
        if (!me.party && age >= va) {
          let fee = 4000;
          try { if (typeof g.partyFee === 'function') fee = num(g.partyFee(), 4000); } catch (e) { fee = 4000; }
          add(48, '政党に入ると、選挙で公認がもらいやすい。', `永田町の党本部の受付で入党できる（党費 年${fmtMoney(fee)}）。どの党にも入らず、無所属で立候補することもできる。`, { term: '公認' });
        }
      } catch (e) { console.error(e); }
    }
    // in office
    if (me.office) {
      try {
        const S = p.diet && p.diet.session;
        const posts = me.posts || [];
        if (posts.includes('pm')) {
          const ap = Math.round(num(p.cabinet && p.cabinet.approval));
          add(83, `総理大臣。内閣支持率は${ap}%。`, ap < 30 ? '30%を切ると「危険水域」といわれる。政策の中身と、ていねいな説明で信頼を取りもどそう。' : '予算を年度内に成立させることと、国会の過半数を保つことが大事。', { politics: 'cabinet' });
        } else if (posts.some((x) => x === 'kanbo' || /^minister_/.test(x))) add(72, '大臣のつとめ：閣議に出て、国会で答弁。', '政治アプリの「内閣」から閣議へ。国会の委員会では、大臣として答弁する。', { politics: 'cabinet' });
        if (me.office === 'shugi' || me.office === 'sangi') {
          if (p.diet && p.diet.shugi && p.diet.shugi.dissolved && me.office === 'shugi') add(85, '衆議院は解散中。総選挙に向けて準備を！', '解散で議員の身分はなくなった。もう一度立候補するなら、公示日までに届出を。', { politics: 'elections' });
          else if (S) add(78, `国会の会期中（${S.kind}）。本会議の採決に出よう。`, '国会議事堂の議場の自分の席で採決に加わる。委員会での質問も大切。欠席が続くと批判される。', { politics: 'diet' });
          else add(42, '国会は閉会中。地元回りと後援会づくりの好機。', '政治アプリの「資金・活動」から。次の選挙に向けて、地元の支持を固めよう。', { politics: 'activities' });
        } else if (me.office === 'kugi' || me.office === 'togi') add(46, '議会の定例会で、住民の声を質問にしよう。', '区議会の定例会は2・6・9・11月。会期中は区役所5階の議場へ。', null);
        else add(46, '首長の仕事：予算と条例を議会に出して説明する。', '議会と首長は、住民がそれぞれ選ぶ（二元代表制）。おたがいにチェックしあう関係。', { term: '二元代表制' });
      } catch (e) { console.error(e); }
    }
  } else add(20, '政治の情報はまだない。', '「政治のしくみ」で、基本から学んでみよう。', { navi: 'lessons' });
  // ---- learning
  const a = assistState(g);
  if (a && !a.quiz && IDEO) add(16, '「思想しんだん」で、自分の考えの位置を見てみよう。', 'いくつかの質問に答えると、近い考え方がわかる。結果は目安で、正しい答えはない。', { navi: 'quiz' });
  const m = MISSIONS.find((x) => !missionDone(g, x.id) && (!x.locked || !x.locked(g)));
  if (m) add(13, `ミッション：${m.label}`, m.hint(g), { navi: 'missions' });
  add(5, '「政治のしくみ」で、基本を学ぼう。', '選挙・法律・内閣・予算…。短いスライドで、ひとつずつ説明するよ。', { navi: 'lessons' });
  out.sort((x, y) => y.prio - x.prio);
  // くわしい: fewer study hints when there are real things to do
  const help = a ? a.help : 'normal';
  const list = help === 'expert' && out.filter((x) => x.prio >= 30).length >= 2 ? out.filter((x) => x.prio >= 30) : out;
  return list.slice(0, 8);
}
export function nextStepAdvice(g) { return adviceItems(g).map((x) => x.text); }

// ================================================================ ニュースをやさしく
const NEWS_RULES = [
  [/採決を強行|強行採決/, '反対を押し切って採決した、という報道。多数決のルールどおりだ、という声と、議論が足りない、という声がある。'],
  [/主催|デモ|集会/, 'デモや集会は、表現の自由（憲法21条）で守られている。政府がその声にどう応えるかが問われる。'],
  [/宗教法人|解散命令|報告徴収/, '宗教法人法にもとづく手続き。信教の自由を守りながら、法令違反があるときは裁判所が判断する。'],
  [/予備費/, '予算の中の「予備費」を使った。急な支出のためのお金で、あとで国会の承諾を受ける（憲法87条）。'],
  [/諮問/, '大臣などが審議会に意見を求めた（諮問）。審議会の答えを「答申」という。'],
  [/税制改正|税制調査会|大綱/, '税のしくみを見直す話。与党の税制調査会などが案をまとめ、法律として国会で決める。'],
  [/閣議決定/, '内閣が閣議で、政府として正式に決めた。法律が必要なものは、このあと国会で審議される。'],
  [/政令|省令/, '法律の細かい決まりを、内閣（政令）や大臣（省令）が決めた。'],
  [/首班指名/, '国会で「総理大臣はこの人」と決めた（首班指名）。新しい総理大臣は、これから大臣を選んで内閣をつくる（組閣）。'],
  [/内閣の顔ぶれ|組閣/, '総理大臣が大臣を選び、新しい内閣ができた。だれがどの大臣になったかで、政府が力を入れる分野がわかる。'],
  [/内閣改造/, '総理大臣はそのままで、大臣の顔ぶれを入れかえた。支持率の立て直しや、党内のバランスのために行うことが多い。'],
  [/不信任決議案が可決/, '衆議院が「この内閣は信任できない」と決めた。内閣は10日以内に、衆議院を解散して選挙をするか、全員やめる（総辞職）かを選ばなければならない。'],
  [/不信任決議案は否決/, '野党が出した「内閣を信任しない」という決議は、賛成が足りずに通らなかった。内閣はこのまま続く。'],
  [/不信任決議案を提出/, '野党が「この内閣は信任できない」という決議案を出した。否決されることが多いが、政府への抗議の意味がある。'],
  [/総辞職/, '総理大臣と大臣の全員がやめた。国会で新しい総理大臣が指名されるまで、いまの内閣が仕事を続ける。'],
  [/大義なき/, '解散の理由がはっきりしない、という批判。解散は内閣が決められるが、その使い方が問われている。'],
  [/衆議院が解散|衆議院を解散/, '衆議院議員の任期が途中で終わり、総選挙が行われる。国民が、どの政党に政治をまかせるかを選び直す。'],
  [/が解散した|活動を終え/, '政党が活動を終えた。所属していた議員は、無所属になったり、ほかの党に移ったりする。'],
  [/暫定予算/, '4月までに本予算が決まらなかったので、とりあえず必要なお金だけを使える「つなぎの予算」を組んだ。'],
  [/補正予算/, '年度のとちゅうで予算を追加・修正した。景気対策や災害への対応に使われることが多い。'],
  [/予算.*成立|一般会計/, '国の1年間のお金の使い道（予算）が、国会で決まった。社会保障・公共事業・防衛などに使われる。'],
  [/が成立した/, '法律案が衆議院と参議院の両方で可決されて、法律になった。公布されたあと、決められた日から効力を持つ。'],
  [/国民投票/, '憲法を変えるかどうかを、国民が直接投票で決めた。有効投票の過半数が賛成なら、改正が決まる。'],
  [/発議/, '国会が、衆議院・参議院それぞれ3分の2以上の賛成で、憲法改正の案を国民に示した。次は国民投票。'],
  [/召集/, '国会が始まった。会期のあいだに、法律案や予算を審議する。'],
  [/閉会/, '国会が終わった。決まらなかった法律案は、原則としてなくなる（廃案）。'],
  [/会期が延長/, '決めることが残っているので、国会の会期をのばした。'],
  [/補欠選挙|欠員/, '議員がいなくなったので、その席をうめる選挙（補欠選挙）が行われる。'],
  [/繰上補充/, '比例代表の議員が欠けたので、同じ政党の名簿の次の人が繰り上げで議員になった。'],
  [/ねじれ/, '衆議院と参議院で、多数をにぎる勢力がちがう状態（ねじれ国会）。法律が通りにくくなる。'],
  [/定数|改選/, '選挙の結果、各政党がとった議席の数。過半数をとった勢力が、法律や予算を決めやすくなる。'],
  [/当選/, '選挙の結果、当選した人が決まった。当選した人は、任期のあいだ、住民（国民）の代表として仕事をする。'],
  [/出馬|立候補を表明/, '選挙に出ることを発表した。正式な届出は、公示・告示の日に行う。'],
  [/入党|新党|結成/, '政党の動き。どの政党に入るか、どんな政党をつくるかは、政治家の考えと選挙の戦略で決まる。'],
  [/辞任/, '役職をやめた。責任をとってやめることもあれば、体調などの理由のこともある。'],
  [/発覚|疑い|スクープ/, '問題が報じられた。事実かどうかは、本人の説明や捜査で明らかになる。有罪と決まるまでは、無罪として扱われる（推定無罪）。'],
  [/欠席/, '国会議員のいちばん大事な仕事は、国会に出て審議し、採決すること。欠席が続くと批判される。'],
  [/消費税/, '物やサービスにかかる消費税の税率が変わった。国の大きな財源である一方、くらしの負担にも直結する。'],
  [/元号/, '元号（年の呼び名）が新しくなった。'],
  [/省庁が再編/, '国の役所の組み立てが大きく変わった（中央省庁再編）。仕事の重なりを減らすのがねらい。'],
  [/政党交付金/, '国が政党にお金をくばるしくみが始まった。企業献金にたよらない政治をめざすため。'],
  [/選挙権年齢|18歳/, '投票できる年齢が18歳に下がった。若い人の声を政治に届けるため。'],
  [/シミュレーション/, '経済や社会に大きな出来事があった（このゲームのシミュレーション）。政府は景気対策などの対応を考える。'],
];
export function explainNews(g, n) {
  const s = String((n && n.text) || n || '');
  const rule = NEWS_RULES.find(([re]) => re.test(s));
  const yr = yearOf(g);
  const terms = glossaryFind(s, assistState(g).showFuture ? null : yr, glossCtx(g)).map((x) => x.term);
  return { text: s, plain: rule ? rule[1] : 'このニュースに出てくる言葉を、下で調べてみよう。わからない言葉がわかると、ニュースはぐっと読みやすくなるよ。', terms };
}
function newsList(g) {
  const out = [];
  try { const p = polState(g); if (p && Array.isArray(p.news)) for (const n of p.news.slice(0, 20)) out.push({ day: n.day, text: n.text, kind: n.kind || 'politics' }); } catch (e) { /* */ }
  try {
    if (typeof g.govtNews === 'function') {
      for (const n of [].concat(g.govtNews(10) || [])) {
        const t = typeof n === 'string' ? n : n && n.text;
        if (t && !out.some((o) => o.text === t)) out.push({ day: (n && n.day) || today(g), text: t, kind: 'govt' });
      }
    }
  } catch (e) { /* */ }
  return out.sort((a, b) => b.day - a.day).slice(0, 24);
}

// ================================================================ はじめての政治ミッション
const flagAny = (g, re) => Object.keys(g.state.flags || {}).some((k) => re.test(k) && g.state.flags[k]);
export const MISSIONS = [
  { id: 'open', label: '政治ナビを開く', reward: 500, hint: (g) => `${naviWhere(g)}を開くだけ。もう達成！`, check: (g, a) => !!a.seen.navi_open },
  { id: 'senkan', label: '選管で話を聞く', reward: 1000, hint: () => 'ドット区役所の2階、選挙管理委員会の窓口で、選挙のことを聞いてみよう。', check: (g, a) => !!(a.seen.senkan_counter || g.flag('senkan_proc')) },
  { id: 'kokkai', label: '国会を見学・傍聴する', reward: 1000, hint: () => '永田町の国会議事堂へ。参観ロビーの左の受付で見学、会期中は右の受付で傍聴券がもらえる。', check: (g, a) => !!(g.flag('kokkai_toured') || g.flag('kokkai_ticket') || a.seen.kokkai_bocho) },
  { id: 'party', label: '党本部を見学する', reward: 1000, hint: () => '永田町の党本部に入ってみよう。1階の受付で、党の案内が聞ける。', check: (g) => flagAny(g, /^parties_welcome_/) },
  { id: 'news', label: '政治ニュースを読む', reward: 500, hint: () => '政治ナビの「ニュースをやさしく」で、ニュースをひとつ読んでみよう。', check: (g, a) => a.newsRead >= 1 },
  { id: 'terms', label: '用語を5つ調べる', reward: 500, hint: () => '「用語じてん」や、ニュースに出てきた言葉を調べよう。', check: (g, a) => Object.keys(a.terms).length >= 5 },
  { id: 'lessons', label: 'しくみを3つ学ぶ', reward: 1000, hint: () => '「政治のしくみ」のスライドを、最後まで3つ見よう。', check: (g, a) => Object.keys(a.lessons).length >= 3 },
  { id: 'quiz', label: '思想しんだんをする', reward: 500, hint: () => '「思想しんだん」の質問に、最後まで答えてみよう。', check: (g, a) => !!a.quiz },
  { id: 'polapp', label: '政治アプリを開く', reward: 500, hint: (g) => `${deviceWord(g)}の「政治」アプリで、選挙の予定を見てみよう。`, check: (g, a) => !!(a.seen.polui_open || (g.state.flags.polui && g.state.flags.polui.introSeen)) },
  { id: 'vote', label: '選挙で投票する', reward: 1000, hint: (g) => `選挙の日（期日前投票の期間）に、区役所2階の投票所へ。投票は${vAge(g)}歳から。`, check: (g, a) => !!(a.seen.voted || g.flag('kuya_vote')), locked: (g) => ageOf(g.state) < vAge(g) - 1 },
];
export function missionDone(g, id) { const a = assistState(g); return !!(a && a.missions[id] && a.missions[id].done); }
// marks newly achieved missions (a toast once each; the reward is claimed in the app)
export function checkMissions(g) {
  const a = assistState(g);
  if (!a) return [];
  const fresh = [];
  for (const m of MISSIONS) {
    if (a.missions[m.id] && a.missions[m.id].done) continue;
    let ok = false;
    try { ok = !!m.check(g, a); } catch (e) { ok = false; }
    if (ok) { a.missions[m.id] = { done: today(g), claimed: 0 }; fresh.push(m); }
  }
  if (fresh.length && !g.auto) { for (const m of fresh) g.notify(`達成！${m.label}`, { color: '#9af0d8', life: 160 }); }
  return fresh;
}
function claimMission(g, id) {
  const a = assistState(g);
  const m = MISSIONS.find((x) => x.id === id);
  const r = a && a.missions[id];
  if (!m || !r || !r.done || r.claimed) return null;
  r.claimed = today(g);
  g.addMoney(m.reward, true);
  const all = MISSIONS.every((x) => a.missions[x.id] && a.missions[x.id].claimed);
  if (all && !a.seen.navi_cert) { a.seen.navi_cert = today(g); g.giveItem('navi_cert', 1, true); }
  return { m, all };
}

// ================================================================ the NPC (国会の参観ロビー・区役所の選管)
const NPC_LINES = {
  kokkai: ['あら、見学に来たの？ここは国会議事堂の参観ロビー。', '左の受付で国会見学、会期中は右の受付で本会議の傍聴ができるよ。'],
  kuyakusho: ['こんにちは。選挙管理委員会は、選挙を公正に行うための役所なんだ。', '立候補の届出も、投票も、ここが窓口。わからないことは窓口の人に聞いてみてね。'],
  default: ['こんにちは。政治のことで、わからないことはある？'],
};
export async function naviTalk(g, where = 'default') {
  if (!g || !g.state) return;
  const a = assistState(g);
  markSeen(g, `navi_npc_${where}`);
  if (!a.intro) {
    a.intro = true;
    await g.say([`はじめまして！ドット大学で政治学を教えている、${NAVI.name}です。`, 'みんなには「ことは先生」って呼ばれてる。政治のことなら、なんでも聞いてね。', 'わたしは、どの政党がいいとか、どの考えが正しいとかは言わない。賛成の声も反対の声も、両方見せるのがわたしの仕事。', `${naviWhere(g)}にも、わたしの解説を入れておいたよ。`], NAVI_SAY);
  } else await g.say(NPC_LINES[where] || NPC_LINES.default, NAVI_SAY);
  const items = [['いま何をすればいい？', 'advice'], ['用語を調べたい', 'glossary'], ['政治のしくみを学ぶ', 'lessons'], ['思想しんだん', 'quiz'], ['ミッション', 'missions'], ['またね', null]];
  const k = await g.ask('なにが知りたい？', items.map((x) => x[0]), { ...NAVI_SAY, cancel: items.length - 1 });
  const topic = items[k] && items[k][1];
  if (!topic) { await g.say('またいつでも声をかけてね。', NAVI_SAY); return; }
  await openNavi(g, topic);
}

// ================================================================ hooks into the cores (registered when they load)
function hookPolitics(m) {
  if (!m || typeof m.onPolitics !== 'function') return;
  m.onPolitics('elected', (g, d) => { if (d && d.office && d.office !== 'party_leader') assistTip(g, 'first_elected'); });
  m.onPolitics('cabinet', (g, d) => {
    const p = polState(g);
    if (!p) return;
    if (d && d.pm === 'player') assistTip(g, 'pm');
    else if ((p.me.posts || []).some((x) => x === 'kanbo' || /^minister_/.test(x))) assistTip(g, 'minister');
  });
  m.onPolitics('scandal', (g, rec) => { if (rec && (rec.who === 'player' || rec.who == null) && rec.kind !== 'stepdown') assistTip(g, 'scandal'); });
  m.onPolitics('dissolve', (g) => assistTip(g, 'dissolve'));
  m.onPolitics('session', (g, d) => { if (d && d.open) assistTip(g, 'session'); });
}
function hookJustice(m) {
  if (!m || typeof m.onJustice !== 'function') return;
  // nothing is shown at the arrest itself (a cutscene); the advice screen explains the situation
}
// mornings: voting day / filing window reminders and the mission check
onMorning((g) => {
  if (!g || !g.state) return;
  try {
    checkMissions(g);
    const p = g.state.politics;
    if (!p || typeof g.upcomingElections !== 'function') return;
    const day = g.state.day;
    const pub = g.upcomingElections().filter((e) => !e.newsOnly && e.kind !== 'sosaisen' && e.office);
    const va = vAge(g);
    if (pub.some((e) => e.day === day && ageOnDay(g, e.day) >= va)) assistTip(g, 'vote_day');
    const fd = FILING_DAYS();
    if (ageOf(g.state) >= 25 && pub.some((e) => e.day - fd === day)) assistTip(g, 'filing_open');
  } catch (e) { console.error(e); }
});

// ================================================================ the phone app 政治ナビ
const NC = NAVI.color;
const ND = '#1f6f66';
const NL = '#e2f3ee';
const PCx = Object.assign({ bg: '#f4f1e8', text: '#2a2a3a', dim: '#7c7a88', line: '#dcd5c4', sel: '#fff1c2', selEdge: '#e0a82e', good: '#2f9a4a', bad: '#d6304a', accent: '#e07a1f', foot: '#e7e1d1' }, PH.PC || {});
const LH = 16; // body line height in the phone

// tiny 14x14 glyphs for the home menu
const GLYPH = {
  advice(c, x, y, col) { disc(c, x + 7, y + 6, 5, col); R(c, x + 5, y + 11, 5, 3, '#8a8f99'); R(c, x + 6, y + 3, 2, 2, '#ffffff'); },
  news(c, x, y, col) { R(c, x + 1, y + 2, 12, 11, '#ffffff'); frame(c, x + 1, y + 2, 12, 11, null, col); R(c, x + 3, y + 4, 8, 2, col); for (let i = 0; i < 3; i++) R(c, x + 3, y + 7 + i * 2, 8, 1, '#8a8f99'); },
  glossary(c, x, y, col) { R(c, x + 2, y + 1, 10, 12, col); R(c, x + 3, y + 2, 8, 10, '#ffffff'); R(c, x + 2, y + 1, 2, 12, shade(col, -0.3)); T(c, 'あ', x + 4, y + 1, 12, col); },
  ideology(c, x, y, col) { R(c, x + 1, y + 3, 3, 10, col); R(c, x + 5, y + 1, 3, 12, shade(col, 0.25)); R(c, x + 9, y + 4, 4, 9, shade(col, -0.25)); R(c, x, y + 13, 14, 1, '#6a6070'); },
  quiz(c, x, y, col) { disc(c, x + 7, y + 7, 6, col); disc(c, x + 7, y + 7, 4, '#ffffff'); line(c, x + 7, y + 7, x + 10, y + 3, '#d6304a'); line(c, x + 7, y + 7, x + 4, y + 11, col); },
  lessons(c, x, y, col) { R(c, x + 1, y + 1, 12, 9, '#2d5a4a'); frame(c, x, y, 14, 11, null, '#8a6a3a'); R(c, x + 3, y + 3, 6, 1, '#d8f0e0'); R(c, x + 3, y + 6, 4, 1, '#d8f0e0'); R(c, x + 3, y + 11, 1, 3, '#8a6a3a'); R(c, x + 10, y + 11, 1, 3, '#8a6a3a'); },
  missions(c, x, y, col) { R(c, x + 2, y + 1, 1, 13, '#6a6070'); R(c, x + 3, y + 1, 9, 6, col); R(c, x + 3, y + 7, 5, 1, shade(col, -0.3)); },
  settings(c, x, y, col) { disc(c, x + 7, y + 7, 6, col); disc(c, x + 7, y + 7, 2, '#ffffff'); for (const [dx, dy] of [[0, -7], [0, 6], [-7, 0], [6, 0]]) R(c, x + 6 + dx, y + 6 + dy, 2, 2, col); },
};
const HOME_ITEMS = [
  { id: 'advice', label: 'いま何をすればいい？', color: '#e0a03a' },
  { id: 'news', label: 'ニュースをやさしく', color: '#4a78d8' },
  { id: 'glossary', label: '用語じてん', color: '#2a9d8f' },
  { id: 'ideology', label: '思想じてん', color: '#8a5ac8' },
  { id: 'quiz', label: '思想しんだん', color: '#d0507a' },
  { id: 'lessons', label: '政治のしくみ', color: '#3aa86a' },
  { id: 'missions', label: 'はじめてのミッション', color: '#e07a1f' },
  { id: 'settings', label: 'ナビの設定', color: '#7a7a8a' },
];
function homeBadge(g, id) {
  const a = assistState(g);
  if (id === 'missions') { const n = MISSIONS.filter((m) => a.missions[m.id] && a.missions[m.id].done && !a.missions[m.id].claimed).length; if (n) return [`受取${n}`, PCx.bad]; return [`${MISSIONS.filter((m) => a.missions[m.id] && a.missions[m.id].done).length}/${MISSIONS.length}`, PCx.dim]; }
  if (id === 'lessons') return [`${Object.keys(a.lessons).length}/${LESSONS.length}`, PCx.dim];
  if (id === 'quiz') return a.quiz ? ['済', PCx.good] : IDEO ? ['', ''] : ['準備中', PCx.dim];
  if (id === 'ideology') return IDEO ? ['', ''] : ['準備中', PCx.dim];
  if (id === 'glossary') return [`${visibleTerms(g, Object.keys(GLOSSARY)).length}語`, PCx.dim];
  if (id === 'settings') return [HELP_NAMES[a.help], PCx.dim];
  return ['', ''];
}
function greeting(g) {
  const nm = g.state.name || 'あなた';
  const first = safe(() => adviceItems(g)[0], null);
  const hello = ['こんにちは', 'おつかれさま', 'やあ', 'いらっしゃい'][today(g) % 4];
  return `${hello}、${nm}さん。${first ? `いまは「${first.text.replace(/。$/, '')}」` : '今日は何を学ぶ？'}`;
}
function homeView(g) {
  return {
    title: '政治ナビ', color: NC, idx: 0, cancel: undefined,
    hint: 'A:ひらく　B:とじる',
    enter() { this.bubble = greeting(g); },
    update(ph, inp) {
      const n = HOME_ITEMS.length;
      if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) {
        sfx('ok');
        const id = HOME_ITEMS[this.idx].id;
        openTopic(g, ph, id).then(() => { this.bubble = greeting(g); });
        return;
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(undefined); }
    },
    draw(c, ph, a) {
      // her bust + speech bubble
      drawNaviBust(c, a.x + 8, a.y + 6, 2);
      const bx = a.x + 80, bw = a.w - 86, by = a.y + 6, bh = 62;
      frame(c, bx, by, bw, bh, '#ffffff', ND);
      for (let i = 0; i < 5; i++) R(c, bx - 5 + i, by + 16 + i, 1, 10 - i * 2, i === 0 ? ND : '#ffffff');
      const ls = wrapJ(c, this.bubble || '', bw - 12, 12);
      ls.slice(0, 4).forEach((l, i) => T(c, i === 3 && ls.length > 4 ? fit(c, l + '…', bw - 12, 12) : l, bx + 6, by + 4 + i * 14, 12, PCx.text));
      // the menu
      const y0 = a.y + 72, rh = 20;
      HOME_ITEMS.forEach((it, i) => {
        const y = y0 + i * rh;
        const sel = i === this.idx;
        if (sel) { R(c, a.x, y, a.w, rh, PCx.sel); R(c, a.x, y, 3, rh, PCx.selEdge); }
        try { GLYPH[it.id](c, a.x + 8, y + 3, it.color); } catch (e) { /* */ }
        const [b, bc] = homeBadge(g, it.id);
        const bw2 = b ? Math.round(measure(c, b, 12)) + 8 : 0;
        T(c, fit(c, it.label, a.w - 34 - bw2 - 6, 14), a.x + 28, y + 2, 14, sel ? '#1a1a28' : PCx.text);
        if (b) T(c, b, a.x + a.w - 8, y + 4, 12, bc, 'right');
        R(c, a.x + 6, y + rh - 1, a.w - 12, 1, PCx.line);
      });
    },
  };
}

// ---------------------------------------------------------------- her introduction (big bust + pages)
function introPages(g) {
  const book = deviceWord(g) === '手帳';
  return [
    `はじめまして！ドット大学で政治学を教えている、${NAVI.name}（${NAVI.kana}）です。「ことは先生」って呼んでね。`,
    '政治って、むずかしそう？だいじょうぶ。選挙、国会、お金のこと…ひとつずつ、やさしく説明するね。',
    'わたしは、どの政党がいいとか、どの考えが正しいとかは言わない。賛成の声も反対の声も、両方を見せるのがわたしの仕事。決めるのは、あなた。',
    book ? `この手帳に「政治ナビ」のページをはさんでおいたよ。${((g.state.profile || {}).era === 'heisei_early') ? 'ポケベルを鳴らしてくれてもいいけどね（笑）。' : ''}まずは「いま何をすればいい？」から開いてみて！` : `この${deviceWord(g)}に「政治ナビ」を入れておいたよ。まずは「いま何をすればいい？」から開いてみて！`,
  ];
}
function talkView(g, pages, title = '政治ナビ') {
  return {
    title, color: NC, page: 0, cancel: true,
    hint: () => 'A:つぎへ　B:とばす',
    update(ph, inp) {
      if (inp.pressed('a')) { sfx('cursor'); if (this.page < pages.length - 1) this.page++; else ph.back(true); return; }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(true); }
    },
    draw(c, ph, a) {
      R(c, a.x, a.y, a.w, 104, '#d8efe9');
      // a classroom: blackboard + desk
      R(c, a.x + 12, a.y + 8, a.w - 24, 56, '#2d5a4a'); frame(c, a.x + 10, a.y + 6, a.w - 20, 60, null, '#8a6a3a');
      T(c, '政治ナビ', a.x + 24, a.y + 14, 14, '#e8f8f0');
      T(c, '〜はじめの一歩〜', a.x + 24, a.y + 32, 12, '#a8d8c0');
      drawNaviBust(c, a.x + a.w - 106, a.y + 12, 3, { card: false });
      R(c, a.x, a.y + 102, a.w, 2, ND);
      T(c, NAVI.name, a.x + 10, a.y + 108, 12, ND);
      const nw = Math.round(measure(c, NAVI.name, 12));
      T(c, fit(c, 'ドット大学の講師', a.w - nw - 30, 12), a.x + a.w - 10, a.y + 108, 12, PCx.dim, 'right');
      const bx = a.x + 8, by = a.y + 126, bw = a.w - 16, bh = a.h - 132;
      frame(c, bx, by, bw, bh, '#ffffff', ND);
      const ls = wrapJ(c, g.fmt(pages[this.page] || ''), bw - 16, 12);
      ls.slice(0, 6).forEach((l, i) => T(c, l, bx + 8, by + 6 + i * LH, 12, PCx.text));
      T(c, `${this.page + 1}/${pages.length}`, bx + bw - 8, by + bh - 16, 12, PCx.dim, 'right');
      if (Math.floor(ph.t / 20) % 2 === 0) T(c, '▼', bx + bw - 40, by + bh - 16, 12, NC);
    },
  };
}

// ---------------------------------------------------------------- a list view (own copy, phone style)
// o: { title, color, items: [] | () => [], index, rowH, describe(i), pick(ph, it, i, view) → (optional),
//      keys(ph, inp, view) → true when handled, empty, drawRow(c, it, x, y, w, rh, sel), hint }
function listView(g, o) {
  return {
    title: o.title, color: o.color || NC, hint: o.hint || 'A:えらぶ　B:もどる', idx: o.index | 0, sy: null, cancel: -1, topRow: 0,
    rows() { return (typeof o.items === 'function' ? o.items() : o.items) || []; },
    update(ph, inp) {
      const rows = this.rows(), n = rows.length;
      if (o.keys && o.keys(ph, inp, this)) return;
      if (n) {
        this.idx = clamp(this.idx, 0, n - 1);
        if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) {
          const it = rows[this.idx];
          if (it && it.disabled) { sfx('buzz'); if (it.why) ph.toast(it.why, '#9aa3c7'); return; }
          sfx('ok');
          if (o.pick) o.pick(ph, it, this.idx, this); else ph.back(this.idx);
          return;
        }
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      const rows = this.rows();
      const descH = o.describe && rows.length ? 42 : 0;
      const lh = a.h - descH;
      if (!rows.length) {
        const ls = wrapJ(c, o.empty || '（なし）', a.w - 32, 12);
        ls.forEach((l, i) => T(c, l, a.x + a.w / 2, a.y + a.h / 2 - ls.length * 8 + i * 16, 12, PCx.dim, 'center'));
        return;
      }
      const rh = o.rowH || (rows.some((r) => r && r.sub) ? 36 : 24);
      const vis = Math.max(1, Math.floor(lh / rh));
      const idx = clamp(this.idx, 0, rows.length - 1);
      const maxTop = Math.max(0, rows.length - vis);
      let top = this.topRow;
      if (idx < top) top = idx;
      if (idx >= top + vis) top = idx - vis + 1;
      top = clamp(top, 0, maxTop);
      this.topRow = top;
      const target = top * rh;
      this.sy = this.sy == null ? target : Math.abs(target - this.sy) < 1 ? target : this.sy + (target - this.sy) * 0.4;
      c.save();
      c.beginPath(); c.rect(a.x, a.y, a.w, lh); c.clip();
      const from = Math.max(0, Math.floor(this.sy / rh)), to = Math.min(rows.length, from + vis + 2);
      for (let i = from; i < to; i++) {
        const y = Math.round(a.y + i * rh - this.sy);
        const sel = i === idx;
        if (sel) { R(c, a.x, y, a.w, rh, PCx.sel); R(c, a.x, y, 3, rh, PCx.selEdge); }
        if (o.drawRow) o.drawRow(c, rows[i], a.x, y, a.w - (rows.length > vis ? 4 : 0), rh, sel, i);
        else drawRow(c, rows[i], a.x, y, a.w - (rows.length > vis ? 4 : 0), rh, sel);
        R(c, a.x + 6, y + rh - 1, a.w - 12, 1, PCx.line);
      }
      c.restore();
      if (rows.length > vis) {
        const bh = Math.max(12, Math.round((lh * vis) / rows.length));
        const by = a.y + Math.round(((lh - bh) * top) / Math.max(1, maxTop));
        R(c, a.x + a.w - 3, a.y, 3, lh, '#e4ddcc');
        R(c, a.x + a.w - 3, by, 3, bh, '#a8a090');
      }
      if (descH) {
        const d = o.describe(idx);
        const dy = a.y + a.h - descH;
        R(c, a.x, dy, a.w, descH, '#ebe5d6');
        R(c, a.x, dy, a.w, 1, '#cfc6b0');
        if (d) { const ls = wrapJ(c, d, a.w - 16, 12); ls.slice(0, 2).forEach((l, i) => T(c, i === 1 && ls.length > 2 ? fit(c, l + '…', a.w - 16, 12) : l, a.x + 8, dy + 5 + i * 16, 12, PCx.text)); }
      }
    },
  };
}
function drawRow(c, it, x, y, w, rh, sel) {
  if (typeof it === 'string') it = { label: it };
  let lx = x + 10;
  if (it.icon) { try { it.icon(c, x + 8, y + Math.floor((rh - 14) / 2)); } catch (e) { /* */ } lx = x + 28; }
  if (it.tagColor) { R(c, x + 6, y + 6, 3, rh - 12, it.tagColor); lx = Math.max(lx, x + 14); }
  const rw = it.right ? Math.round(measure(c, it.right, 12)) + 12 : 0;
  const col = it.disabled ? PCx.dim : it.labelColor || (sel ? '#1a1a28' : PCx.text);
  if (it.sub) {
    T(c, fit(c, it.label, x + w - lx - rw - 4, 14), lx, y + 3, 14, col);
    T(c, fit(c, it.sub, x + w - lx - 8, 12), lx, y + 20, 12, it.subColor || PCx.dim);
  } else T(c, fit(c, it.label, x + w - lx - rw - 4, 14), lx, y + Math.floor((rh - 14) / 2) - 1, 14, col);
  if (it.right) T(c, it.right, x + w - 8, y + (it.sub ? 5 : Math.floor((rh - 12) / 2)), 12, it.rightColor || PCx.dim, 'right');
}
// a scrolling text page: o = { title, color, head(c, a, view) → height, body() → string, chips() → [labels],
//   chip(ph, i, label), tabs: [{ label, body() | items() + pick(ph, i) }], hint }
function pageView(g, o) {
  const v = {
    title: o.title, color: o.color || NC, cancel: -1, sy: 0, chip: 0, tab: o.tab | 0, li: 0, maxScroll: 0, opts: o,
    hint: () => {
      const tabs = o.tabs && o.tabs.length;
      const t = tabs ? o.tabs[v.tab | 0] : null;
      if (t && t.items) return '←→:タブ　A:ひらく　B:もどる';
      if (tabs) return '←→:タブ　↑↓:よむ　B:もどる';
      const ch = o.chips ? o.chips() : [];
      return ch.length ? '←→:関連　A:ひらく　B:もどる' : '↑↓:よむ　B:もどる';
    },
    update(ph, inp) {
      const tabs = o.tabs || null;
      if (tabs && tabs.length) {
        if (inp.repeat('left')) { this.tab = (this.tab + tabs.length - 1) % tabs.length; this.sy = 0; this.li = 0; sfx('cursor'); }
        if (inp.repeat('right')) { this.tab = (this.tab + 1) % tabs.length; this.sy = 0; this.li = 0; sfx('cursor'); }
        const t = tabs[this.tab];
        if (t.items) {
          const it = t.items();
          if (it.length) {
            if (inp.repeat('up')) { this.li = (this.li + it.length - 1) % it.length; sfx('cursor'); }
            if (inp.repeat('down')) { this.li = (this.li + 1) % it.length; sfx('cursor'); }
            if (inp.pressed('a') && t.pick) { sfx('ok'); t.pick(ph, this.li, it[this.li]); return; }
          }
        } else {
          if (inp.repeat('down') && this.maxScroll > 0) this.sy = Math.min(this.maxScroll, this.sy + LH);
          if (inp.repeat('up')) this.sy = Math.max(0, this.sy - LH);
        }
      } else {
        if (inp.repeat('down') && this.maxScroll > 0) this.sy = Math.min(this.maxScroll, this.sy + LH);
        if (inp.repeat('up')) this.sy = Math.max(0, this.sy - LH);
        const ch = o.chips ? o.chips() : [];
        if (ch.length) {
          if (inp.repeat('left')) { this.chip = (this.chip + ch.length - 1) % ch.length; sfx('cursor'); }
          if (inp.repeat('right')) { this.chip = (this.chip + 1) % ch.length; sfx('cursor'); }
          if (inp.pressed('a') && o.chip) { sfx('ok'); o.chip(ph, this.chip, ch[this.chip]); return; }
        }
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      let y = a.y;
      const tabs = o.tabs && o.tabs.length ? o.tabs : null;
      if (tabs) {
        const tw = Math.floor(a.w / tabs.length);
        tabs.forEach((t, i) => {
          const on = i === this.tab;
          R(c, a.x + i * tw, y, tw - 1, 18, on ? NC : '#e4ddcc');
          T(c, fit(c, t.label, tw - 4, 12), a.x + i * tw + tw / 2, y + 3, 12, on ? '#ffffff' : PCx.dim, 'center');
        });
        y += 20;
      }
      if (o.head) y += o.head(c, { x: a.x, y, w: a.w }, this) || 0;
      const ch = !tabs && o.chips ? o.chips() : [];
      const chipH = ch.length ? 24 : 0;
      const bh = a.y + a.h - y - chipH;
      const t = tabs ? tabs[this.tab] : null;
      if (t && t.items) {
        const it = t.items();
        const rh = 22;
        const vis = Math.max(1, Math.floor(bh / rh));
        const top = clamp(this.li - vis + 1, 0, Math.max(0, it.length - vis));
        if (!it.length) T(c, t.empty || '（なし）', a.x + 10, y + 8, 12, PCx.dim);
        it.slice(top, top + vis).forEach((s, k) => {
          const i = top + k;
          const yy = y + k * rh;
          if (i === this.li) { R(c, a.x, yy, a.w, rh, PCx.sel); R(c, a.x, yy, 3, rh, PCx.selEdge); }
          T(c, fit(c, s, a.w - 30, 14), a.x + 12, yy + 3, 14, PCx.text);
          T(c, '›', a.x + a.w - 10, yy + 3, 14, PCx.dim, 'right');
          R(c, a.x + 6, yy + rh - 1, a.w - 12, 1, PCx.line);
        });
      } else {
        const body = t ? (typeof t.body === 'function' ? t.body() : t.body) : o.body ? o.body() : '';
        const lines = wrapJ(c, body, a.w - 20, 12);
        this.maxScroll = Math.max(0, lines.length * LH + 8 - bh);
        c.save();
        c.beginPath(); c.rect(a.x, y, a.w, bh); c.clip();
        lines.forEach((l, i) => {
          const ly = y + 6 + i * LH - this.sy;
          if (ly < y - LH || ly > y + bh) return;
          const head = /^【.*】$/.test(l);
          if (head) R(c, a.x + 6, ly - 1, a.w - 12, LH, NL);
          T(c, l, a.x + 10, ly, 12, head ? ND : PCx.text);
        });
        c.restore();
        if (this.maxScroll > 0) {
          const sh = Math.max(10, Math.round((bh * bh) / (lines.length * LH + 8)));
          const sy2 = y + Math.round(((bh - sh) * this.sy) / this.maxScroll);
          R(c, a.x + a.w - 3, y, 3, bh, '#e4ddcc'); R(c, a.x + a.w - 3, sy2, 3, sh, NC);
          if (this.sy < this.maxScroll && Math.floor(ph.t / 20) % 2 === 0) T(c, '▼', a.x + a.w - 16, y + bh - 14, 12, NC);
        }
      }
      if (ch.length) {
        const cy = a.y + a.h - chipH + 3;
        R(c, a.x, cy - 3, a.w, chipH, '#ebe5d6');
        R(c, a.x, cy - 3, a.w, 1, '#cfc6b0');
        const sel = clamp(this.chip, 0, ch.length - 1);
        const widths = ch.map((s) => Math.round(measure(c, s, 12)) + 10);
        let first = 0;
        const avail = a.w - 20;
        while (first < sel && widths.slice(first, sel + 1).reduce((s, v) => s + v + 3, 0) > avail) first++;
        let cx = a.x + 8;
        if (first > 0) T(c, '◀', a.x + 1, cy + 2, 12, NC);
        for (let i = first; i < ch.length; i++) {
          if (cx + widths[i] > a.x + a.w - 10) { T(c, '▶', a.x + a.w - 10, cy + 2, 12, NC); break; }
          const on = i === sel;
          frame(c, cx, cy, widths[i], 18, on ? NC : '#ffffff', on ? ND : '#b8c8c4');
          T(c, ch[i], cx + 5, cy + 3, 12, on ? '#ffffff' : '#2a5a54');
          cx += widths[i] + 3;
        }
      }
    },
  };
  return v;
}

// ---------------------------------------------------------------- sections
async function openTopic(g, ph, topic) {
  const [id, arg] = String(topic || 'home').split(':');
  try {
    if (id === 'advice') return await ph.open(adviceView(g));
    if (id === 'news') return await newsSection(g, ph);
    if (id === 'glossary') { if (arg) return await ph.open(termView(g, arg)); return await glossarySection(g, ph); }
    if (id === 'ideology') { if (arg) return await openIdeology(g, ph, arg); return await ideologySection(g, ph); }
    if (id === 'quiz') return await quizSection(g, ph);
    if (id === 'lessons') return await lessonsSection(g, ph);
    if (id === 'lesson') return await ph.open(lessonView(g, arg));
    if (id === 'missions') return await ph.open(missionsView(g));
    if (id === 'settings') return await ph.open(settingsView(g));
    if (id === 'intro') return await ph.open(talkView(g, introPages(g)));
  } catch (e) { console.error(e); }
  return null;
}
export async function openNavi(g, topic = 'home') {
  if (!g || !g.state) return null;
  markSeen(g, 'navi_open');
  checkMissions(g);
  if (g.auto && !g.auto.navi) return null;
  if (typeof PH.withPhone !== 'function') return null;
  return PH.withPhone(g, async (ph) => {
    const a = assistState(g);
    if (topic === 'intro') { await ph.open(talkView(g, introPages(g))); a.intro = true; return null; }
    if (!a.intro) { a.intro = true; await ph.open(talkView(g, introPages(g))); if (ph.dismissed) return null; assistTip(g, 'navi_first'); }
    const home = homeView(g);
    const done = ph.open(home);
    if (topic && topic !== 'home') openTopic(g, ph, topic).then(() => { home.bubble = greeting(g); });
    return done;
  });
}

// ---- いま何をすればいい？
function adviceView(g) {
  let items = adviceItems(g);
  const v = {
    title: 'いま何をすればいい？', color: '#d08a2a', idx: 0, cancel: -1, sy: 0,
    hint: () => { const it = items[v.idx | 0]; return it && it.go ? 'A:くわしく　B:もどる' : '↑↓:えらぶ　B:もどる'; },
    update(ph, inp) {
      const n = items.length;
      if (n) {
        if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) {
          const it = items[this.idx];
          if (!it || !it.go) { sfx('buzz'); return; }
          sfx('ok');
          followGo(g, ph, it.go).then(() => { items = adviceItems(g); this.idx = clamp(this.idx, 0, items.length - 1); });
          return;
        }
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      // cards with wrapped detail; scroll so the selected card is visible
      const W = a.w - 16;
      const cards = items.map((it) => {
        const tl = wrapJ(c, it.text, W - 16, 12);
        const dl = wrapJ(c, it.detail || '', W - 16, 12);
        return { it, tl, dl, h: 10 + tl.length * 15 + (dl.length ? 4 + dl.length * 14 : 0) + (it.go ? 14 : 0) };
      });
      let yy = 0;
      const pos = cards.map((cd) => { const p = yy; yy += cd.h + 6; return p; });
      const total = yy;
      const sel = clamp(this.idx, 0, Math.max(0, cards.length - 1));
      const want = cards.length ? clamp(pos[sel] + cards[sel].h - (a.h - 8), 0, Math.max(0, total - a.h + 8)) : 0;
      const minTop = cards.length ? Math.min(pos[sel], want) : 0;
      this.sy = clamp(this.sy, want, minTop);
      this.sy = clamp(this.sy, 0, Math.max(0, total - a.h + 8));
      c.save();
      c.beginPath(); c.rect(a.x, a.y, a.w, a.h); c.clip();
      cards.forEach((cd, i) => {
        const y = a.y + 6 + pos[i] - this.sy;
        if (y > a.y + a.h || y + cd.h < a.y) return;
        const on = i === sel;
        const col = cd.it.prio >= 85 ? PCx.bad : cd.it.prio >= 60 ? '#d08a2a' : NC;
        frame(c, a.x + 8, y, W, cd.h, on ? '#fff8de' : '#ffffff', on ? PCx.selEdge : '#d6cfbf');
        R(c, a.x + 9, y + 1, 3, cd.h - 2, col);
        cd.tl.forEach((l, k) => T(c, l, a.x + 16, y + 5 + k * 15, 12, '#1a1a28'));
        let ly = y + 5 + cd.tl.length * 15 + 3;
        cd.dl.forEach((l, k) => T(c, l, a.x + 16, ly + k * 14, 12, PCx.dim));
        ly += cd.dl.length * 14;
        if (cd.it.go) T(c, goLabel(cd.it.go), a.x + 8 + W - 6, ly, 12, on ? PCx.accent : '#9a8a70', 'right');
      });
      c.restore();
      if (!cards.length) T(c, 'いまは、とくにやることはないみたい。', a.x + 10, a.y + 10, 12, PCx.dim);
    },
  };
  return v;
}
function goLabel(go) {
  if (go.term) return `▶用語「${go.term}」`;
  if (go.politics) return '▶政治アプリで見る';
  if (go.navi) return `▶${({ lessons: '政治のしくみ', quiz: '思想しんだん', missions: 'ミッション', glossary: '用語じてん' })[go.navi] || 'ひらく'}`;
  return '';
}
async function followGo(g, ph, go) {
  if (!go) return null;
  if (go.term) return ph.open(termView(g, go.term));
  if (go.navi) return openTopic(g, ph, go.navi);
  if (go.politics && typeof g.politicsScreen === 'function') {
    // the politics UI is a full-screen scene above the phone; the phone stays open under it
    try { return await g.politicsScreen(go.politics === 'dashboard' ? 'dashboard' : go.politics); } catch (e) { console.error(e); }
  }
  return null;
}

// ---- ニュースをやさしく
async function newsSection(g, ph) {
  const list = newsList(g);
  const v = listView(g, {
    title: 'ニュースをやさしく', color: '#4a78d8', rowH: 44,
    items: () => list,
    empty: 'まだ政治のニュースはないみたい。日がたつと、選挙や国会のニュースが届くよ。',
    drawRow(c, it, x, y, w, rh, sel) {
      T(c, dateText(g, it.day), x + 10, y + 3, 12, PCx.dim);
      if (it.kind === 'govt') T(c, '行政', x + w - 8, y + 3, 12, '#4a78d8', 'right');
      const ls = wrapJ(c, it.text, w - 20, 12);
      ls.slice(0, 2).forEach((l, i) => T(c, i === 1 && ls.length > 2 ? fit(c, l + '…', w - 20, 12) : l, x + 10, y + 17 + i * 13, 12, sel ? '#1a1a28' : PCx.text));
    },
    pick(ph2, it) { ph2.open(newsDetail(g, it)); },
  });
  return ph.open(v);
}
function newsDetail(g, n) {
  const a = assistState(g);
  a.newsRead++;
  checkMissions(g);
  const ex = explainNews(g, n);
  return pageView(g, {
    title: 'ニュースをやさしく', color: '#4a78d8',
    head(c, r) {
      const ls = wrapJ(c, ex.text, r.w - 28, 12).slice(0, 4);
      const h = 10 + ls.length * 15 + 6;
      frame(c, r.x + 8, r.y + 4, r.w - 16, h, '#ffffff', '#9ab0d8');
      R(c, r.x + 9, r.y + 5, 3, h - 2, '#4a78d8');
      ls.forEach((l, i) => T(c, l, r.x + 16, r.y + 9 + i * 15, 12, '#1a1a28'));
      return h + 8;
    },
    body: () => `【かんたんに言うと】\n${ex.plain}${ex.terms.length ? `\n【出てきた言葉】\n${ex.terms.map((t) => `・${t}：${GLOSSARY[t].short}`).join('\n')}` : ''}`,
    chips: () => ex.terms,
    chip(ph, i, term) { ph.open(termView(g, term)); },
  });
}

// ---- 用語じてん
function visibleTerms(g, list) {
  const a = assistState(g);
  const yr = yearOf(g);
  return list.filter((k) => a.showFuture || termStatus(GLOSSARY[k], yr, glossCtx(g)) !== 'future');
}
async function glossarySection(g, ph) {
  const a = assistState(g);
  const cats = () => {
    const recent = Object.keys(a.terms).filter((k) => GLOSSARY[k]).sort((x, y) => a.terms[y] - a.terms[x]);
    return [
      ...GLOSSARY_CATS.map((ct) => ({ label: ct.name, right: `${visibleTerms(g, glossaryTermsByCat(ct.id)).length}語`, tagColor: ct.color, cat: ct.id })),
      { label: '50音順（ぜんぶ）', right: `${visibleTerms(g, glossaryKanaOrder()).length}語`, tagColor: '#5a5a6a', cat: '*' },
      { label: '調べた言葉', right: `${recent.length}語`, tagColor: '#2a9d8f', cat: 'recent', disabled: !recent.length, why: 'まだ調べた言葉はない' },
    ];
  };
  const v = listView(g, {
    title: '用語じてん', color: NC, rowH: 22,
    items: cats,
    describe: () => (a.showFuture ? 'この時代にまだない言葉も、印をつけてのせている。' : 'この時代にまだない言葉は、のせていない（設定で変えられる）。'),
    pick(ph2, it) { ph2.open(termListView(g, it.cat, it.label)); },
  });
  return ph.open(v);
}
function termListView(g, cat, title) {
  const a = assistState(g);
  const yr = yearOf(g);
  const keys = () => {
    if (cat === '*') return visibleTerms(g, glossaryKanaOrder());
    if (cat === 'recent') return Object.keys(a.terms).filter((k) => GLOSSARY[k]).sort((x, y) => a.terms[y] - a.terms[x]);
    return visibleTerms(g, glossaryTermsByCat(cat));
  };
  return listView(g, {
    title, color: NC, rowH: 36,
    items: () => keys().map((k) => {
      const e = GLOSSARY[k];
      const st = termStatus(e, yr, glossCtx(g));
      return { label: k, sub: e.short, term: k, right: st === 'future' ? 'まだない' : st === 'past' ? '歴史' : a.terms[k] ? '✓' : '', rightColor: st === 'future' ? '#b05a2a' : st === 'past' ? PCx.dim : PCx.good, labelColor: st === 'future' ? PCx.dim : null };
    }),
    pick(ph, it) { ph.open(termView(g, it.term)); },
  });
}
function termView(g, term) {
  const e0 = glossaryLookup(gTerm(g, term));
  const yr = yearOf(g);
  const a = assistState(g);
  if (e0 && !a.terms[e0.term]) { a.terms[e0.term] = today(g); checkMissions(g); }
  const key = e0 ? e0.term : String(term);
  const e = e0 ? GLOSSARY[key] : null;
  const rel = () => (e ? (e.related || []).map((r) => gTerm(g, r)).filter((r, i, arr) => GLOSSARY[r] && arr.indexOf(r) === i && r !== key && (a.showFuture || gStatus(g, GLOSSARY[r]) !== 'future')) : []);
  return pageView(g, {
    title: '用語じてん', color: NC,
    head(c, r) {
      if (!e) { T(c, fit(c, key, r.w - 20, 16), r.x + 10, r.y + 6, 16, PCx.text); return 28; }
      const cat = catOf(e.cat);
      const cw = Math.round(measure(c, cat.name, 12)) + 8;
      // the title never runs under the category tag: beside it when it fits at 16px, else on its own
      // row (16px, or 14px for the longest names) with the tag moved down to the since label's row
      const beside = measure(c, key, 16) <= r.w - 20 - cw - 8;
      const ts = beside || measure(c, key, 16) <= r.w - 20 ? 16 : 14;
      T(c, fit(c, key, beside ? r.w - 20 - cw - 8 : r.w - 20, ts), r.x + 10, r.y + 4 + (16 - ts), ts, '#1a1a28');
      const tag = (ty) => { frame(c, r.x + r.w - 8 - cw, ty, cw, 16, cat.color, shade(cat.color, -0.4)); T(c, cat.name, r.x + r.w - 8 - cw + 4, ty + 2, 12, '#ffffff'); };
      if (beside) tag(r.y + 4);
      // the reading and the since label wrap (2 lines at most each) instead of being cut
      const kl = wrapJ(c, e.kana, r.w - 20, 12).slice(0, 2);
      kl.forEach((l, i) => T(c, l, r.x + 10, r.y + 22 + i * 14, 12, PCx.dim));
      let h = 22 + Math.max(16, kl.length * 14) + 2;
      const sl = sinceLabel(e, yr, glossCtx(g));
      // a long title: the tag goes beside the since label when that still fits in 2 lines, else on its own row
      const narrow = sl && !beside ? wrapJ(c, sl.text, r.w - 20 - cw - 8, 12) : null;
      const withTag = !beside && (!sl || narrow.length <= 2);
      const sls = sl ? (withTag ? narrow : wrapJ(c, sl.text, r.w - 20, 12)).slice(0, 2) : [];
      sls.forEach((l, i) => T(c, l, r.x + 10, r.y + h + i * 14, 12, sl.color));
      if (withTag) { tag(r.y + h - 1); h += Math.max(16, sls.length * 14) + 2; }
      else { if (sls.length) h += sls.length * 14 + 2; if (!beside) { tag(r.y + h - 1); h += 18; } }
      const ls = wrapJ(c, e.short, r.w - 28, 12);
      frame(c, r.x + 8, r.y + h, r.w - 16, 8 + ls.length * 15, NL, '#9ad0c4');
      ls.forEach((l, i) => T(c, l, r.x + 14, r.y + h + 4 + i * 15, 12, '#1f5f56'));
      return h + 8 + ls.length * 15 + 4;
    },
    body: () => (e ? gText(g, e) : 'この言葉は、まだ用語じてんにのっていないみたい。'),
    chips: rel,
    chip(ph, i, t) { ph.open(termView(g, t)); },
  });
}

// ---- 思想じてん (reads ideology.js; feature-detected)
const FAMILY_JA = {
  conservative: '保守', conservatism: '保守', liberal: '自由主義', liberalism: '自由主義', socialist: '社会主義', socialism: '社会主義',
  communism: '共産主義', anarchist: '無政府主義', anarchism: '無政府主義', nationalist: '民族・国家', nationalism: '民族・国家',
  authoritarian: '権威主義', fascist: 'ファシズム', democratic: '民主主義', democracy: '民主主義', left: '左派', right: '右派', center: '中道',
  centre: '中道', radical: '急進', social: '社会', economic: '経済', other: 'そのほか', green: '環境', identity: '平等・権利', state: '国家',
};
function ideoGet(id) { if (!IDEO) return null; return (IDEO.IDEOLOGIES && IDEO.IDEOLOGIES[id]) || (IDEO.COMMUNISM_SCHOOLS && IDEO.COMMUNISM_SCHOOLS[id]) || null; }
function ideoName(id) { const d = ideoGet(id); return d ? d.name || id : id; }
function familyName(f) {
  if (!f) return 'そのほか';
  const F = IDEO && (IDEO.IDEO_FAMILIES || IDEO.FAMILIES);
  if (F) {
    if (Array.isArray(F)) { const x = F.find((y) => y && (y.id === f || y === f)); if (x) return x.name || x.label || String(f); }
    else if (F[f]) return typeof F[f] === 'string' ? F[f] : F[f].name || F[f].label || String(f);
  }
  return FAMILY_JA[f] || String(f);
}
function ideoGroups() {
  if (!IDEO) return [];
  const I = IDEO.IDEOLOGIES || {};
  const order = Array.isArray(IDEO.IDEOLOGY_ORDER) ? IDEO.IDEOLOGY_ORDER.filter((k) => I[k]) : Object.keys(I);
  const groups = [];
  for (const id of order) {
    const f = I[id].family || 'other';
    let gr = groups.find((x) => x.family === f);
    if (!gr) groups.push(gr = { family: f, name: familyName(f), ids: [] });
    gr.ids.push(id);
  }
  const CS = IDEO.COMMUNISM_SCHOOLS || {};
  const cord = Array.isArray(IDEO.COMMUNISM_ORDER) ? IDEO.COMMUNISM_ORDER.filter((k) => CS[k]) : Object.keys(CS);
  if (cord.length) groups.push({ family: '__schools', name: `共産主義の諸派（${cord.length}）`, ids: cord });
  return groups;
}
async function ideologySection(g, ph) {
  await ideologyReady;
  if (!IDEO || !(IDEO.IDEOLOGIES || IDEO.COMMUNISM_SCHOOLS)) {
    return ph.open(pageView(g, { title: '思想じてん', color: '#8a5ac8', body: () => '思想じてんは、まだ準備中みたい。\nもう少し待っていてね。' }));
  }
  const all = ideoGroups();
  const total = all.reduce((s, x) => s + x.ids.length, 0);
  return ph.open(listView(g, {
    title: '思想じてん', color: '#8a5ac8', rowH: 24,
    items: () => all.map((gr) => ({ label: gr.name, right: `${gr.ids.length}`, tagColor: gr.family === '__schools' ? '#c83a3a' : '#8a5ac8', gr })),
    describe: () => `${total}の思想を、考え方と歴史の両方でのせている。`,
    pick(ph2, it) {
      ph2.open(listView(g, {
        title: it.gr.name, color: '#8a5ac8', rowH: 36,
        items: () => it.gr.ids.map((id) => { const d = ideoGet(id) || {}; const a = assistState(g); return { label: d.name || id, sub: oneLine(d.summary || d.kana || ''), right: d.selectable === false ? '学習用' : a.ideo[id] ? '✓' : '', rightColor: d.selectable === false ? '#b05a2a' : PCx.good, id }; }),
        pick(ph3, x) { openIdeology(g, ph3, x.id); },
      }));
    },
  }));
}
const oneLine = (s) => String(s || '').replace(/\s*\n\s*/g, ' ');
function listText(arr) {
  const items = [];
  for (const x of [].concat(arr || [])) {
    if (x == null || x === '') continue;
    if (typeof x === 'string' && /^[\u3000 ]/.test(x) && items.length && typeof items[items.length - 1] === 'string') items[items.length - 1] += x.replace(/^[\u3000 ]+/, '');
    else items.push(x);
  }
  if (!items.length) return '（なし）';
  return items.map((x) => {
    if (typeof x === 'string') return `・${x}`;
    const yr = x.year != null ? `${x.year}${/年/.test(String(x.year)) ? '' : '年'}　` : x.when ? `${x.when}　` : '';
    const t = x.text || x.label || x.desc || x.title || '';
    return `・${yr}${t}`;
  }).join('\n');
}
async function openIdeology(g, ph, id) {
  await ideologyReady;
  const d = ideoGet(id);
  if (!d) return ph.open(pageView(g, { title: '思想じてん', color: '#8a5ac8', body: () => 'この思想は、まだじてんにのっていないみたい。' }));
  const a = assistState(g);
  a.ideo[id] = today(g);
  const yr = yearOf(g);
  const rel = [].concat(d.related || []).filter((r) => ideoGet(r));
  const src = [].concat(d.sources || []).map((s) => (typeof s === 'string' ? s : s.title || s.name || s.url || '')).filter(Boolean);
  const prop = d.selectable === false;
  const note = prop ? `\n【この項目について】\n${d.note || 'この思想は、歴史を学ぶための項目。ゲームでは、政党の理念に選ぶことはできない。'}` : '';
  // the sections and their neutral titles come from ideology.js (実際に起きたこと / 支持する人の考え /
  // 批判する人の考え; 当時の宣伝・批判と歴史の評価 for ファシズム・ナチズム); lines about events later than
  // the game year are left out (the setting 「この時代にない用語」 shows them, marked) — like the glossary
  const secs = typeof IDEO.ideologySections === 'function' ? IDEO.ideologySections(id, yr, { showFuture: !!a.showFuture }) : [];
  const sec = (key, fb) => secs.find((x) => x.key === key) || fb;
  const fbLines = (k) => ({ lines: [].concat(d[k] || []), hidden: 0 });
  const later = (x) => (!x.hidden ? '' : a.showFuture ? `\n（「ゲームの年より後のできごと」の印は、${yr}年より後のこと）`
    : `\n（${yr}年より後のできごとは、のせていない。ナビの設定の「この時代にない用語」で表示できる）`);
  const body = (key, title, fb) => () => { const x = sec(key, { title, ...fbLines(fb) }); return `【${x.title}】\n${listText(x.lines)}${later(x)}`; };
  const supportNote = prop ? '' : '\n※その思想を支持する人が、どう考えるかの紹介。どの思想が正しいということはない。';
  const tabs = [
    { label: '概要', body: () => `${String(d.summary || '').replace(/\s*\n\s*/g, '')}${note}${src.length ? `\n【出典】\n${src.map((s) => `・${s}`).join('\n')}${yr < 2026 ? '\n（出典は2026年に調べた資料。ゲームの年より後のことも書かれている）' : ''}` : ''}` },
    { label: '考え', body: body('ideas', '主な考え', 'ideas') },
    { label: '歴史', body: body('history', '歴史', 'history') },
    { label: '記録', body: body('record', '実際に起きたこと', 'record') },
    { label: prop ? '宣伝' : '支持', body: () => body('pro', prop ? '当時の宣伝（支持の集め方）' : '支持する人の考え', 'pro')() + supportNote },
    { label: '批判', body: body('con', prop ? '批判・歴史の評価' : '批判する人の考え', 'con') },
    { label: '関連', items: () => rel.map((r) => ideoName(r)), empty: '（関連する項目はない）', pick: (ph2, i) => { openIdeology(g, ph2, rel[i]); } },
  ];
  return ph.open(pageView(g, {
    title: d.name || id, color: '#8a5ac8', tabs,
    head(c, r, view) {
      if (view.tab !== 0) return 0;
      // row 1: the short name (≤ 9 characters) and the family tag; row 2 (wrapped): the other name and
      // the reading — nothing is cut with 「…」
      const fam = d.family ? familyName(d.family) : '';
      const fw = fam ? Math.round(measure(c, fam, 12)) + 8 : 0;
      const nm = d.name || id;
      const avail = r.w - 20 - (fw ? fw + 8 : 0);
      const ts = measure(c, nm, 16) <= avail ? 16 : measure(c, nm, 14) <= avail ? 14 : 12;
      T(c, fit(c, nm, avail, ts), r.x + 10, r.y + 3 + (16 - ts), ts, '#1a1a28');
      if (fam) { frame(c, r.x + r.w - 8 - fw, r.y + 4, fw, 16, '#8a5ac8', '#5a3a8a'); T(c, fam, r.x + r.w - 8 - fw + 4, r.y + 6, 12, '#ffffff'); }
      const sub = [d.alt, d.kana].filter(Boolean).join('／');
      const ls = wrapJ(c, sub, r.w - 20, 12).slice(0, 2);
      ls.forEach((l, i) => T(c, l, r.x + 10, r.y + 22 + i * 14, 12, PCx.dim));
      return ls.length > 1 ? 52 : 38;
    },
  }));
}

// ---- 思想しんだん (the quiz UI for ideology.js QUIZ)
const LIKERT = [['とても賛成', 1], ['どちらかといえば賛成', 0.5], ['どちらともいえない', 0], ['どちらかといえば反対', -0.5], ['とても反対', -1]];
function quizQuestions() {
  if (!IDEO || !IDEO.QUIZ) return [];
  const Q = IDEO.QUIZ;
  const raw = Array.isArray(Q) ? Q : Array.isArray(Q.questions) ? Q.questions : Object.values(Q);
  const fx = (o) => (o && (o.axes || o.effects || o.effect || o.fx || o.weights)) || {};
  return raw.map((q, i) => {
    if (!q) return null;
    const text0 = q.text || q.q || q.question || q.label || q.statement || '';
    const ch = q.choices || q.answers || q.options;
    if (Array.isArray(ch) && ch.length) {
      return { id: q.id ?? i, text: text0, likert: false, choices: ch.map((c) => ({ label: typeof c === 'string' ? c : c.text || c.label || '', axes: typeof c === 'string' ? {} : fx(c) })) };
    }
    const ax = fx(q);
    return { id: q.id ?? i, text: text0, likert: true, choices: LIKERT.map(([label, v]) => ({ label, v, axes: Object.fromEntries(Object.entries(ax).map(([k, w]) => [k, num(w) * v])) })) };
  }).filter((q) => q && q.text);
}
function axesList() { return IDEO && Array.isArray(IDEO.IDEO_AXES) ? IDEO.IDEO_AXES : []; }
function compassAxes() {
  const ax = axesList();
  if (!ax.length) return [null, null];
  const find = (re) => ax.find((a) => re.test(String(a.id)) || re.test(String(a.name || '')));
  const x = find(/econ|keizai|market|経済|市場/) || ax[0];
  const y = find(/auth|lib|free|power|state|jiyu|kenryoku|権力|自由|統制|権威/i) || ax.find((a) => a !== x) || null;
  return [x, y === x ? ax.find((a) => a !== x) || null : y];
}
function normTop(top) {
  return [].concat(top || []).map((t) => (typeof t === 'string' ? { id: t } : t && (t.id || t.ideology) ? { id: t.id || t.ideology, dist: t.dist ?? t.d ?? null, pct: t.match ?? null } : null)).filter((t) => t && ideoGet(t.id)).slice(0, 3);
}
function quizCompute(g, qs, answers) {
  const sum = {}, max = {};
  qs.forEach((q, i) => {
    const ch = q.choices[answers[i]];
    const keys = new Set(q.choices.flatMap((c) => Object.keys(c.axes)));
    for (const k of keys) {
      max[k] = (max[k] || 0) + Math.max(...q.choices.map((c) => Math.abs(num(c.axes[k]))));
      sum[k] = (sum[k] || 0) + num(ch && ch.axes[k]);
    }
  });
  let axes = {};
  for (const k of Object.keys(max)) axes[k] = max[k] > 0 ? clamp(sum[k] / max[k], -1, 1) : 0;
  let top = [];
  let res = null;
  // taking the quiz changes nothing in the game: the result is only shown. The player may choose
  // afterwards, on the result screen, to let it move their own ideology (applyQuiz, with a warning).
  if (typeof g.ideologyQuizResult === 'function') {
    try { res = g.ideologyQuizResult(answers.slice()); } catch (e) { console.error(e); res = null; }
  }
  if (res && typeof res === 'object') {
    const ra = res.axes || res.vector || (res.ideology && res.ideology.axes);
    if (ra && typeof ra === 'object') axes = { ...axes, ...ra };
    top = normTop(res.top3 || (res.nearest && res.nearest.top3) || res.top || (res.id ? [res.id] : []));
  }
  const explainLines = res && Array.isArray(res.explain) ? res.explain.slice() : [];
  const school = res && res.school && res.school.id ? { id: res.school.id, name: res.school.name } : null;
  if (!top.length && IDEO && typeof IDEO.nearestIdeology === 'function') {
    try { const n = IDEO.nearestIdeology(axes); top = normTop((n && n.top3) || (n && n.id ? [n] : [])); } catch (e) { console.error(e); }
  }
  if (!top.length && IDEO && IDEO.IDEOLOGIES) {
    // fallback: plain distance over the shared axes
    const I = IDEO.IDEOLOGIES;
    const d = (id) => { const v = I[id].axes || {}; let s = 0; for (const k of Object.keys(axes)) s += (num(v[k]) - axes[k]) ** 2; return Math.sqrt(s); };
    top = Object.keys(I).filter((id) => I[id].selectable !== false).map((id) => ({ id, dist: d(id) })).sort((x, y) => x.dist - y.dist).slice(0, 3);
  }
  const n = Math.max(1, Object.keys(axes).length);
  for (const t of top) {
    if (t.dist == null) { const v = (ideoGet(t.id) || {}).axes || {}; let s = 0; for (const k of Object.keys(axes)) s += (num(v[k]) - axes[k]) ** 2; t.dist = Math.sqrt(s); }
    if (t.pct == null) t.pct = clamp(Math.round(100 * (1 - t.dist / (2 * Math.sqrt(n)))), 0, 100);
  }
  return { axes, top, day: 0, label: top[0] ? ideoName(top[0].id) : '', explain: explainLines, school };
}
async function quizSection(g, ph) {
  await ideologyReady;
  const qs = quizQuestions();
  if (!qs.length) return ph.open(pageView(g, { title: '思想しんだん', color: '#d0507a', body: () => '思想しんだんは、まだ準備中みたい。\nもう少し待っていてね。' }));
  const a = assistState(g);
  if (a.quiz) {
    const k = await ph.open(listView(g, {
      title: '思想しんだん', color: '#d0507a', rowH: 26,
      items: [{ label: 'この前の結果を見る' }, { label: 'もう一度しんだんする' }],
      describe: () => `この前の結果：${a.quiz.label || '―'}（${a.quiz.day ? `${a.quiz.day}日目` : ''}）`,
    }));
    if (k === 0) return ph.open(resultView(g, a.quiz));
    if (k !== 1) return null;
  }
  const answers = await ph.open(quizView(g, qs));
  if (!Array.isArray(answers)) return null;
  const r = quizCompute(g, qs, answers);
  r.day = today(g);
  r.answers = answers;
  a.quiz = r;
  checkMissions(g);
  assistTip(g, 'quiz_done');
  return ph.open(resultView(g, r));
}
// the cursor starts on the middle answer (どちらともいえない), so it never nudges the answers
const mid = (q) => Math.floor((q.choices.length - 1) / 2);
function quizView(g, qs) {
  const v = {
    title: '思想しんだん', color: '#d0507a', cancel: null, q: -1, idx: 0, answers: [],
    hint: () => (v.q < 0 ? 'A:はじめる　B:やめる' : 'A:えらぶ　B:ひとつもどる'),
    update(ph, inp) {
      if (v.q < 0) {
        if (inp.pressed('a')) { sfx('ok'); v.q = 0; v.idx = mid(qs[0]); }
        else if (inp.pressed('b')) { sfx('cancel'); ph.back(null); }
        return;
      }
      const q = qs[v.q];
      const n = q.choices.length;
      if (inp.repeat('up')) { v.idx = (v.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down')) { v.idx = (v.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) {
        sfx('ok');
        v.answers[v.q] = v.idx;
        if (v.q + 1 >= qs.length) { ph.back(v.answers.slice(0, qs.length)); return; }
        v.q++;
        v.idx = v.answers[v.q] != null ? v.answers[v.q] : mid(qs[v.q]);
        return;
      }
      if (inp.pressed('b')) {
        sfx('cancel');
        if (v.q === 0) { v.q = -1; return; }
        v.q--;
        v.idx = v.answers[v.q] ?? 0;
      }
    },
    draw(c, ph, a) {
      if (v.q < 0) {
        drawNaviBust(c, a.x + 8, a.y + 8, 2);
        const ls = wrapJ(c, `${qs.length}の質問に答えると、あなたの考えがどの思想に近いかを、ざっくり示すよ。`, a.w - 92, 12);
        ls.forEach((l, i) => T(c, l, a.x + 82, a.y + 8 + i * 15, 12, PCx.text));
        const notes = ['・正しい答えも、まちがった答えもない。結果は目安。', '・答えるだけでは、ゲームの中のあなたは何も変わらない。', '・何度でもやり直せる。実在の政党や政治家とは関係ない。'];
        let y = a.y + 80;
        for (const n of notes) { const l2 = wrapJ(c, n, a.w - 24, 12); l2.forEach((l, i) => T(c, l, a.x + 12, y + i * 15, 12, PCx.text)); y += l2.length * 15 + 4; }
        frame(c, a.x + 40, a.y + a.h - 34, a.w - 80, 24, '#d0507a', '#8a2a4a');
        T(c, 'はじめる', a.x + a.w / 2, a.y + a.h - 29, 14, '#ffffff', 'center');
        return;
      }
      const q = qs[v.q];
      // progress
      T(c, `質問 ${v.q + 1}/${qs.length}`, a.x + 10, a.y + 4, 12, PCx.dim);
      R(c, a.x + 90, a.y + 9, a.w - 100, 4, '#e4ddcc');
      R(c, a.x + 90, a.y + 9, Math.round((a.w - 100) * (v.q / qs.length)), 4, '#d0507a');
      const ql = wrapJ(c, q.text, a.w - 28, 12);
      const qh = 10 + ql.length * 15;
      frame(c, a.x + 8, a.y + 22, a.w - 16, qh, '#ffffff', '#d8a0b8');
      ql.forEach((l, i) => T(c, l, a.x + 14, a.y + 27 + i * 15, 12, '#1a1a28'));
      let y = a.y + 22 + qh + 8;
      const rest = a.y + a.h - y;
      const rows = q.choices.map((ch) => wrapJ(c, ch.label, a.w - 44, 12));
      const need = rows.reduce((s, r) => s + 8 + r.length * 14, 0) + rows.length * 3;
      const tight = need > rest;
      q.choices.forEach((ch, i) => {
        const ls = tight ? [fit(c, ch.label, a.w - 44, 12)] : rows[i];
        const h = 6 + ls.length * 14;
        const on = i === v.idx;
        frame(c, a.x + 12, y, a.w - 24, h, on ? '#d0507a' : '#ffffff', on ? '#8a2a4a' : '#d6cfbf');
        if (v.answers[v.q] === i && !on) R(c, a.x + 14, y + 2, 3, h - 4, '#d0507a');
        ls.forEach((l, k) => T(c, l, a.x + 22, y + 3 + k * 14, 12, on ? '#ffffff' : PCx.text));
        y += h + 3;
      });
    },
  };
  return v;
}
function resultView(g, r) {
  const [ax, ay] = compassAxes();
  const top = (r.top || []).filter((t) => ideoGet(t.id));
  const COL = ['#d6304a', '#e0a03a', '#4a78d8'];
  // the last row: 「この結果を自分の考え方に反映する」 — only on the player's explicit choice, after a
  // confirmation that says what it changes (it never happens just by taking the quiz)
  const canApply = () => typeof g.ideologyQuizResult === 'function' && Array.isArray(r.answers) && r.answers.length > 0;
  const nRows = () => top.length + (canApply() ? 1 : 0);
  const applyQuiz = async (ph) => {
    if (r.applied) { ph.toast('もう反映してある', PCx.dim); return; }
    const k = await PH.phoneConfirm(g, {
      title: '考え方に反映する？', color: '#d0507a', choices: ['反映する', 'やめておく'],
      text: 'この結果を、ゲームの中のあなたの考え方（政治家としての立ち位置）に反映する？\n・あなたの考え方が、この結果のほうへ少し動く。\n・政党に入っていて党の路線から大きくずれると、党内の評価が少しずつ下がることがある。\n・反映しなければ、何も変わらない。',
    });
    if (k !== 0) return;
    let res = null;
    try { res = g.ideologyQuizResult(r.answers.slice(), { apply: true }); } catch (e) { console.error(e); }
    if (res) { r.applied = today(g); sfx('ok'); ph.toast('考え方に反映した', '#d0507a'); }
  };
  const v = {
    title: 'しんだん結果', color: '#d0507a', cancel: -1, idx: 0, page: 0, sy: 0, maxScroll: 0,
    hint: () => (v.page === 1 ? '←:図にもどる　↑↓:よむ　B:もどる' : v.idx >= top.length && canApply() ? 'A:えらぶ　→:説明　B:もどる' : top.length ? 'A:じてんで見る　→:説明' : '→:説明　B:もどる'),
    update(ph, inp) {
      if (inp.pressed('right') && v.page === 0) { v.page = 1; v.sy = 0; sfx('cursor'); return; }
      if (inp.pressed('left') && v.page === 1) { v.page = 0; sfx('cursor'); return; }
      if (v.page === 1) {
        if (inp.repeat('down') && v.maxScroll > 0) v.sy = Math.min(v.maxScroll, v.sy + LH);
        if (inp.repeat('up')) v.sy = Math.max(0, v.sy - LH);
      } else if (nRows()) {
        const n = nRows();
        if (inp.repeat('up')) { v.idx = (v.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { v.idx = (v.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) {
          if (v.idx >= top.length) { sfx('ok'); applyQuiz(ph); return; }
          sfx('ok'); openIdeology(g, ph, top[v.idx].id); return;
        }
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      if (v.page === 1) {
        const e0 = top[0] ? ideoGet(top[0].id) : null;
        const lines0 = [`いちばん近いのは「${r.label || '―'}」。`, ...(e0 && e0.summary ? [String(e0.summary).replace(/\s*\n\s*/g, '')] : []),
          ...(r.school ? [`共産主義の流れの中では「${r.school.name}」が近い。`] : []),
          '', '【軸ごとの位置】',
          ...axesList().map((x) => { const val = num((r.axes || {})[x.id]); const pos = Math.abs(val) < 0.2 ? 'まんなか' : `${val < 0 ? x.left : x.right}寄り`; return `${x.name}：${pos}`; }),
          '', '※考え方の傾向の目安。どの思想が正しいということはない。考えは変わっていい。',
          '※答えただけでは、ゲームの中のあなたは変わらない。反映するかは、図の画面の下で選べる。',
          ...(IDEO && IDEO.QUIZ_INFO && IDEO.QUIZ_INFO.limits ? [`※${IDEO.QUIZ_INFO.limits}`] : [])];
        const lines = lines0.flatMap((l) => (l ? wrapJ(c, l, a.w - 20, 12) : ['']));
        v.maxScroll = Math.max(0, lines.length * LH + 10 - a.h);
        c.save(); c.beginPath(); c.rect(a.x, a.y, a.w, a.h); c.clip();
        lines.forEach((l, i) => { const y = a.y + 6 + i * LH - v.sy; const head = /^【.*】$/.test(l); if (head) R(c, a.x + 6, y - 1, a.w - 12, LH, NL); T(c, l, a.x + 10, y, 12, head ? ND : PCx.text); });
        c.restore();
        return;
      }
      // the 2-axis compass: x = the first axis (left → right), y = the second (its right label on top)
      const S = 88, cx0 = a.x + Math.round((a.w - S) / 2), cy0 = a.y + 18;
      R(c, cx0, cy0, S / 2, S / 2, '#f6dede'); R(c, cx0 + S / 2, cy0, S / 2, S / 2, '#dee6f6');
      R(c, cx0, cy0 + S / 2, S / 2, S / 2, '#def6e4'); R(c, cx0 + S / 2, cy0 + S / 2, S / 2, S / 2, '#f6f2de');
      frame(c, cx0 - 1, cy0 - 1, S + 2, S + 2, null, '#8a8f99');
      R(c, cx0, cy0 + S / 2, S, 1, '#8a8f99'); R(c, cx0 + S / 2, cy0, 1, S, '#8a8f99');
      const px = (val) => cx0 + Math.round(((clamp(num(val), -1, 1) + 1) / 2) * (S - 1));
      const py = (val) => cy0 + Math.round(((1 - clamp(num(val), -1, 1)) / 2) * (S - 1));
      if (ax) {
        const lw = cx0 - a.x - 6;
        wrapJ(c, ax.left || '', lw, 12).slice(0, 2).forEach((l, i) => T(c, l, cx0 - 4, cy0 + S / 2 - 14 + i * 14, 12, PCx.dim, 'right'));
        wrapJ(c, ax.right || '', lw, 12).slice(0, 2).forEach((l, i) => T(c, l, cx0 + S + 4, cy0 + S / 2 - 14 + i * 14, 12, PCx.dim));
      }
      if (ay) {
        T(c, fit(c, ay.right || '', a.w - 20, 12), cx0 + S / 2, cy0 - 15, 12, PCx.dim, 'center');
        T(c, fit(c, ay.left || '', a.w - 20, 12), cx0 + S / 2, cy0 + S + 2, 12, PCx.dim, 'center');
      }
      top.forEach((t, i) => {
        const d = ideoGet(t.id) || {};
        const v2 = d.axes || {};
        const x = px(ax ? v2[ax.id] : 0), y = ay ? py(v2[ay.id]) : cy0 + S / 2;
        disc(c, x, y, 4, COL[i]);
      });
      const me = r.axes || {};
      const mx = px(ax ? me[ax.id] : 0), my = ay ? py(me[ay.id]) : cy0 + S / 2;
      disc(c, mx, my, 5, '#1a1a28');
      if (Math.floor(ph.t / 15) % 2 === 0) disc(c, mx, my, 3, '#ffffff');
      // top 3
      let y = cy0 + S + 18;
      T(c, 'あなたに近い考え方', a.x + 10, y, 12, ND);
      T(c, '●=あなた', a.x + a.w - 10, y, 12, PCx.dim, 'right');
      y += 16;
      top.forEach((t, i) => {
        const on = i === v.idx;
        if (on) { R(c, a.x, y - 1, a.w, 19, PCx.sel); R(c, a.x, y - 1, 3, 19, PCx.selEdge); }
        disc(c, a.x + 14, y + 8, 6, COL[i]);
        T(c, String(i + 1), a.x + 14, y + 2, 12, '#ffffff', 'center');
        T(c, fit(c, ideoName(t.id), a.w - 76, 14), a.x + 26, y + 1, 14, PCx.text);
        T(c, `${t.pct ?? '―'}%`, a.x + a.w - 10, y + 3, 12, PCx.dim, 'right');
        y += 19;
      });
      if (!top.length) T(c, '（近い思想が見つからなかった）', a.x + 10, y, 12, PCx.dim);
      if (canApply()) {
        const on = v.idx >= top.length;
        const by = y + 3;
        frame(c, a.x + 8, by, a.w - 16, 20, on ? '#d0507a' : '#ffffff', on ? '#8a2a4a' : '#d6cfbf');
        T(c, fit(c, r.applied ? '自分の考え方に反映ずみ' : '自分の考え方に反映する…', a.w - 28, 12), a.x + a.w / 2, by + 4, 12, on ? '#ffffff' : r.applied ? PCx.dim : '#8a2a4a', 'center');
      } else T(c, fit(c, '目安だよ。答えただけでは何も変わらない。', a.w - 20, 12), a.x + 10, a.y + a.h - 15, 12, PCx.dim);
    },
  };
  return v;
}

// ---- 政治のしくみ (lessons: short slides with pixel diagrams)
// slide: { h: heading, art: key, text: string | (year) => string }
export const LESSONS = [
  { id: 'senkyo', title: '選挙のしくみ', slides: [
    { h: '選挙ってなに？', art: 'ballot', text: '選挙は、わたしたちの代わりに政治をする人を、投票で選ぶしくみ。だれに投票したかは秘密（秘密投票）。' },
    { h: '何歳から？', art: 'age', text: (y, c) => `投票できるのは${(c && c.votingAge) || (y >= 2016 ? 18 : 20)}歳から（選挙権）。立候補は25歳から。参議院と知事は30歳から（被選挙権）。` },
    { h: '衆議院の選挙', art: 'twoBallots', text: (y, c) => ((c && c.shugi && c.shugi.next ? c.shugi.next === 'heiritsu' : y >= 1996) ? '衆議院の選挙では2票を書く。小選挙区は1人だけ当選。比例代表は、政党の票の割合で議席を分ける。' : 'いまの衆議院は中選挙区制。1つの選挙区から3〜5人が当選する。参議院には比例代表もある。') },
    { h: '立候補するには', art: 'deposit', text: '公示・告示の日に届け出て、供託金（きょうたくきん）を預ける。票が少ないと没収。選挙運動は、その日から投票日の前日まで。' },
  ] },
  { id: 'houritsu', title: '法律ができるまで', slides: [
    { h: '法律案を出す', art: 'billFlow', text: '法律案を出すのは、内閣（閣法）か国会議員（議員立法）。成立する法律の多くは、内閣が出したもの。' },
    { h: '委員会と本会議', art: 'committee', text: 'まず委員会でくわしく審査し、それから本会議で採決する。出席議員の過半数が賛成すれば可決。' },
    { h: 'もう一つの院へ', art: 'twoHouses', text: '衆議院と参議院の両方で可決すると成立。参議院が否決しても、衆議院が3分の2で再可決すれば成立する。' },
    { h: '公布と施行', art: 'promulgate', text: '成立した法律は、天皇が公布して国民に知らせる。決められた日から効力が始まる（施行）。' },
  ] },
  { id: 'naikaku', title: '内閣と総理大臣', slides: [
    { h: '総理大臣の選び方', art: 'shimei', text: '総理大臣は、国会議員の中から国会が指名する（首班指名（しゅはんしめい））。衆参で別の人を指名したら、衆議院が優先。' },
    { h: '内閣をつくる', art: 'cabinet', text: '総理大臣は大臣を選んで内閣をつくる（組閣（そかく））。大臣たちは閣議（かくぎ）で、政府の方針を全員一致で決める。' },
    { h: '不信任と解散', art: 'confidence', text: '衆議院が内閣不信任を可決すると、内閣は10日以内に、衆議院の解散か総辞職を選ぶ（憲法69条）。' },
    { h: '支持率', art: 'poll', text: '内閣は国会の信任の上に立つ（議院内閣制（ぎいんないかくせい））。世論の支持を失うと、政権の運営は苦しくなる。' },
  ] },
  { id: 'yosan', title: '予算と税', slides: [
    { h: '予算づくりの1年', art: 'budgetFlow', text: (y) => `8月に各省が概算要求（がいさんようきゅう）、12月に${y >= 2001 ? '財務省' : '大蔵省'}が原案。閣議決定して、1月からの国会で審議する。` },
    { h: '国の収入', art: 'pieIn', text: (y, c) => `国の収入（歳入（さいにゅう））は、税金と国債（借金）。税には所得税・法人税${(c && c.taxRate != null ? c.taxRate > 0 : y >= 1989) ? '・消費税' : ''}などがある。` },
    { h: '国の支出', art: 'pieOut', text: (y) => (y >= 2005 ? '支出（歳出（さいしゅつ））でいちばん多いのは社会保障。国債の返済や、地方にくばるお金（地方交付税）も大きい。'
      : '支出（歳出（さいしゅつ））では、社会保障、国債の返済と利子（国債費）、地方にくばるお金（地方交付税）の3つが大きい。') },
    { h: '予算を決める', art: 'diet', text: '予算は衆議院が先に審議。参議院が30日以内に議決しないと、衆議院の議決で成立する（自然成立：衆議院の優越）。' },
  ] },
  { id: 'chiho', title: '地方自治', slides: [
    { h: '首長と議会', art: 'local', text: '知事や区長（首長）と、地方議会の議員を、住民がそれぞれ選挙で選ぶ（二元代表制（にげんだいひょうせい））。' },
    { h: '条例', art: 'jorei', text: '地方議会は、その地域だけの決まり（条例（じょうれい））をつくり、予算を決め、首長の仕事をチェックする。' },
    { h: '住民の力', art: 'signature', text: '住民は署名を集めて、条例づくりや、首長・議員をやめさせること（リコール）を求められる（直接請求（ちょくせつせいきゅう））。' },
    { h: '地方のお金', art: 'pieLocal', text: '地方の収入は、地方税だけでは足りないことが多い。国からの地方交付税や補助金にたよっている。' },
  ] },
  { id: 'sanken', title: '三権分立', slides: [
    { h: '3つの力', art: 'triangle', text: '国の力を、国会（立法）・内閣（行政）・裁判所（司法）の3つに分ける。' },
    { h: 'おたがいにチェック', art: 'triangle2', text: '国会は内閣不信任ができ、内閣は衆議院を解散できる。裁判所は、法律が憲法に合っているか判断できる。' },
    { h: 'なぜ分けるの？', art: 'balance', text: '力が1か所に集まると、自由がうばわれやすい。おたがいにおさえあうことで、それを防ぐ。' },
  ] },
  { id: 'kenpo', title: '憲法', slides: [
    { h: '日本国憲法', art: 'book', text: '日本国憲法は、1947年5月3日に施行された、国のいちばん大もとの決まり（最高法規）。' },
    { h: '3つの原則', art: 'three', text: '国民主権・基本的人権の尊重・平和主義。この3つが、日本国憲法の柱。' },
    { h: '憲法を変えるには', art: 'amend', text: '衆議院と参議院それぞれで総議員の3分の2が賛成して発議（はつぎ）し、国民投票で過半数の賛成が必要。' },
    { h: '立憲主義', art: 'shieldPeople', text: '憲法は、国民が国の権力をしばるもの（立憲主義）。表現の自由や信教の自由も、憲法が守っている。' },
  ] },
  { id: 'seito', title: '政党と派閥', slides: [
    { h: '政党とは', art: 'party', text: '政党は、考えの近い人が集まり、選挙で議席をとって政策を実現しようとするグループ。' },
    { h: '公認と無所属', art: 'ballot', text: '選挙では政党の「公認」をもらうと、党の応援が受けられる。どの党にも入らず、無所属でも立候補できる。' },
    { h: '党の中のグループ', art: 'factions', text: '党の中には派閥やグループがある。人事や選挙の応援で力を持つ一方、なれ合いを批判されることもある。' },
    { h: '党議拘束', art: 'partyVote', text: '国会の採決では、党が決めた方針どおりに投票する（党議拘束（とうぎこうそく））のがふつう。' },
  ] },
  { id: 'yoron', title: '世論と支持率', slides: [
    { h: '世論調査', art: 'poll', text: '世論調査は、選んだ人に質問して、社会の意見を数字にする。質問のしかたで結果が変わることもある。' },
    { h: '支持率', art: 'bars', text: '内閣支持率は、内閣の「通知表」のようなもの。30%を切ると「危険水域」といわれることもある。' },
    { h: 'いろいろな声', art: 'voices', text: '同じ政策にも、賛成の声と反対の声がある。立場がちがえば、見え方もちがう。' },
    { h: '報道の自由', art: 'tv', text: '報道の自由は、権力をチェックする大切なしくみ。いろいろなニュースを見くらべよう。' },
  ] },
  { id: 'anpo', title: '安全保障と自衛隊', slides: [
    { h: '自衛隊', art: 'shield', text: (y) => `自衛隊は1954年にできた、日本を守る組織。陸・海・空の3つ。${y >= 2007 ? '2007年から防衛省が管理する。' : '防衛庁が管理している。'}` },
    { h: '文民統制', art: 'chain', text: '最高指揮官は総理大臣。防衛出動には国会の承認がいる。政治が軍事をおさえる「文民統制（ぶんみんとうせい）」。' },
    { h: '憲法9条', art: 'nine', text: '憲法9条のもと、日本の防衛は「専守防衛（せんしゅぼうえい）」。侵略のための戦争はできない。' },
    { h: '災害と国際協力', art: 'rescue', text: (y) => `災害のときの救助（災害派遣）も大切な仕事。${y >= 1992 ? '1992年からは、国連の平和維持活動（PKO）にも参加している。' : '人命救助や給水、物資の輸送を行う。'}` },
  ] },
  { id: 'saigai', title: '災害と政府', slides: [
    { h: 'まず命を守る', art: 'alert', text: (y) => `${y >= 2007 ? '緊急地震速報や' : ''}警報が出たら、まず命を守る行動を。市町村長が、住民に避難を指示する。` },
    { h: '国の対策本部', art: 'hq', text: (y) => `大きな災害では、国が対策本部をつくる。${y >= 2001 ? '内閣府の防災担当大臣' : '国土庁長官'}が中心になり、特に大きいときは総理大臣が本部長。` },
    { h: '自衛隊の災害派遣', art: 'rescue', text: '知事などの要請を受けて、自衛隊が災害派遣に出る。救助、給水、物資の輸送などを行う。' },
    { h: 'くらしの再建', art: 'house', text: (y) => `避難所や仮設住宅は、災害救助法による支援。${y >= 1998 ? '家を失った世帯には、被災者生活再建支援法で支援金も出る。' : '復旧の費用は、国が手厚く補助することもある（激甚災害）。'}` },
  ] },
  { id: 'minshu', title: '民主主義と独裁', slides: [
    { h: '民主主義', art: 'voices', text: '民主主義では、選挙で代表を選び、自由に意見を言い、話し合って決める。時間はかかる。' },
    { h: '独裁', art: 'one', text: '独裁は、1人や1つの党が権力をにぎり、選挙・裁判・報道のチェックを受けない体制。' },
    { h: '歴史が示すこと', art: 'silence', text: '独裁では、言論がおさえられ、反対する人がつかまる。歴史では、多くの人が命を落とした。' },
    { h: '民主主義を守るもの', art: 'balance', text: '法の支配、権力の分立、報道の自由。そして、選挙で投票する一人ひとり。' },
  ] },
  { id: 'okane', title: '政治とお金', slides: [
    { h: '政治にはお金がかかる', art: 'coins', text: (y) => `事務所、秘書、選挙…。献金やパーティー${y >= 1995 ? '、政党交付金' : ''}などでまかなう。` },
    { h: '収支報告書', art: 'report', text: '政治のお金の出入りは、毎年、政治資金収支報告書で公開される。だれでも見られる。' },
    { h: '犯罪になること', art: 'cross', text: '報告書にのせない「裏金」や、仕事に関係してわいろを受け取る「収賄（しゅうわい）」は犯罪。' },
    { h: '罪の重さ', art: 'court', text: '有罪になると、議員の職を失い、一定の期間、選挙権・被選挙権がなくなる（公民権停止（こうみんけんていし））。' },
  ] },
  { id: 'shiho', title: '裁判のしくみ', slides: [
    { h: '裁判所', art: 'court', text: '裁判所は、法律にもとづいて争いや罪を裁く。裁判官は、良心と憲法・法律だけにしたがう。' },
    { h: '三審制', art: 'steps', text: '判決に不服なら、上の裁判所にうったえられる。3回まで裁判を受けられる（三審制（さんしんせい））。' },
    { h: '国民の参加', art: 'jurors', text: (y) => (y >= 2009 ? '重い刑事事件では、国民が裁判員として裁判に参加する（2009年から）。' : '裁判は原則として公開。法廷の傍聴は、だれでもできる。') },
    { h: '推定無罪', art: 'scale', text: '有罪が決まるまでは、無罪として扱う（推定無罪（すいていむざい））。逮捕されただけで、犯人と決めつけてはいけない。' },
  ] },
];

// ---- the pixel diagrams (each draws inside x, y, w (≈208), h (≈100))
const INK = '#3a3f4a';
function abox(c, x, y, w, h, label, bg = '#ffffff', fg = PCx.text, edge = '#8a8f99') {
  frame(c, x, y, w, h, bg, edge);
  const ls = String(label).split('\n');
  ls.forEach((l, i) => T(c, l, x + w / 2, y + Math.round((h - ls.length * 14) / 2) + i * 14, 12, fg, 'center'));
}
function arrowR(c, x, y, len, col = '#5a6070') { R(c, x, y, len - 3, 2, col); for (let i = 0; i < 4; i++) R(c, x + len - 4 + i, y - 3 + i, 1, 8 - i * 2, col); }
function arrowL(c, x, y, len, col = '#5a6070') { R(c, x + 3, y, len - 3, 2, col); for (let i = 0; i < 4; i++) R(c, x + 3 - i, y - 3 + i, 1, 8 - i * 2, col); }
function arrowD(c, x, y, len, col = '#5a6070') { R(c, x, y, 2, len - 3, col); for (let i = 0; i < 4; i++) R(c, x - 3 + i, y + len - 4 + i, 8 - i * 2, 1, col); }
function arrowU(c, x, y, len, col = '#5a6070') { R(c, x, y + 3, 2, len - 3, col); for (let i = 0; i < 4; i++) R(c, x - 3 + i, y + 3 - i, 8 - i * 2, 1, col); }
const CROWD = [LOOKS.salaryman, LOOKS.mom, LOOKS.kid, LOOKS.oldman, LOOKS.clerk, LOOKS.oldwoman, LOOKS.fan];
function mini(c, look, x, y, dir = 'down') {
  try { const sh = charSheetHD(look); c.drawImage(sh[dir][0], 0, 0, 32, 40, Math.round(x), Math.round(y), 16, 20); } catch (e) { /* */ }
}
function face(c, look, x, y) { try { drawFaceHD(c, look, x, y, 1); } catch (e) { /* */ } }
function paperArt(c, x, y, w, h, lines = 3, col = '#ffffff') { frame(c, x, y, w, h, col, '#8a8f99'); for (let i = 0; i < lines; i++) R(c, x + 4, y + 6 + i * 5, w - 8 - (i === lines - 1 ? 6 : 0), 1, '#a8aeb8'); }
function dietArt(c, x, y, s = 1) {
  const W = (n) => Math.round(n * s);
  R(c, x, y + W(18), W(64), W(14), '#ece6d4'); R(c, x, y + W(31), W(64), W(2), '#a89c80');
  R(c, x + W(22), y + W(8), W(20), W(12), '#e2dac4'); R(c, x + W(25), y + W(3), W(14), W(6), '#d6ccb0'); R(c, x + W(28), y, W(8), W(4), '#c4b896');
  for (let i = 0; i < 7; i++) R(c, x + W(4 + i * 8.5), y + W(21), W(2), W(9), '#8a92b0');
  R(c, x + W(30), y + W(12), W(4), W(8), '#8a92b0');
}
function courtArt(c, x, y) {
  R(c, x, y + 30, 56, 4, '#9aa0aa'); R(c, x + 2, y + 10, 52, 20, '#e6e2d8');
  for (let i = 0; i < 5; i++) R(c, x + 6 + i * 10, y + 12, 4, 17, '#c8c2b4');
  for (let i = 0; i < 10; i++) R(c, x + 28 - i * 3, y + i, (i * 3) * 2, 1, '#b8b2a4');
  R(c, x, y + 9, 56, 2, '#a8a294');
}
function houseArt(c, x, y, broken = false) {
  for (let i = 0; i < 10; i++) R(c, x + 14 - i * 1.5, y + i, i * 3, 1, '#c0503a');
  R(c, x + 2, y + 10, 24, 16, '#f0e6d0'); R(c, x + 10, y + 16, 7, 10, '#8a6a4a'); R(c, x + 4, y + 13, 5, 5, '#8ac0e0');
  if (broken) { line(c, x + 2, y + 12, x + 26, y + 24, '#5a4a3a'); line(c, x + 20, y + 10, x + 14, y + 26, '#5a4a3a'); }
}
function coinArt(c, x, y) { disc(c, x + 6, y + 6, 6, '#c8a020'); disc(c, x + 6, y + 6, 4, '#f0d060'); T(c, '¥', x + 6, y, 12, '#8a6a10', 'center'); }
function pie(c, cx, cy, r, parts) {
  const total = parts.reduce((s, p) => s + p[0], 0);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    let ang = Math.atan2(dx, -dy); if (ang < 0) ang += Math.PI * 2;
    let f = ang / (Math.PI * 2) * total, k = 0;
    while (k < parts.length - 1 && f > parts[k][0]) { f -= parts[k][0]; k++; }
    c.fillStyle = parts[k][1]; c.fillRect(cx + dx, cy + dy, 1, 1);
  }
}
function legend(c, x, y, parts) { parts.forEach((p, i) => { R(c, x, y + i * 16 + 2, 10, 10, p[1]); T(c, p[2], x + 14, y + i * 16, 12, PCx.text); }); }
function shieldArt(c, x, y, col = '#3a6a8a') {
  for (let i = 0; i < 34; i++) { const w = i < 20 ? 30 : Math.max(2, 30 - (i - 20) * 2.2); R(c, x + 15 - w / 2, y + i, w, 1, i === 0 || w <= 4 ? shade(col, -0.4) : col); }
  R(c, x + 14, y + 4, 2, 24, '#ffffff'); R(c, x + 6, y + 12, 18, 2, '#ffffff');
}
function scaleArt(c, x, y) {
  R(c, x + 29, y + 4, 2, 34, INK); R(c, x + 20, y + 38, 20, 3, INK); R(c, x + 6, y + 8, 48, 2, INK);
  for (const sx of [x + 6, x + 52]) { line(c, sx, y + 10, sx - 6, y + 24, INK); line(c, sx, y + 10, sx + 6, y + 24, INK); R(c, sx - 8, y + 24, 16, 3, '#c8a020'); }
  disc(c, x + 30, y + 5, 3, '#c8a020');
}
function tvArt(c, x, y) { frame(c, x, y, 50, 36, '#2a2e3a', '#1a1d26'); R(c, x + 4, y + 4, 42, 26, '#5a8ac8'); R(c, x + 8, y + 22, 34, 6, '#ffffff'); R(c, x + 10, y + 24, 20, 2, '#3a3f4a'); R(c, x + 20, y + 36, 10, 4, '#2a2e3a'); face(c, LOOKS.announcer, x + 9, y + 3); }
function bubbleArt(c, x, y, s, col = '#ffffff', fg = PCx.text) { const w = Math.round(measure(c, s, 12)) + 10; frame(c, x, y, w, 18, col, '#8a8f99'); T(c, s, x + 5, y + 3, 12, fg); R(c, x + 6, y + 18, 3, 3, '#8a8f99'); return w; }
const ART = {
  ballot(c, x, y, w, h) {
    for (let i = 0; i < 3; i++) mini(c, CROWD[i], x + 8 + i * 22, y + 50, 'right');
    const bx = x + w / 2 + 6;
    R(c, bx, y + 40, 60, 40, '#e8e4dc'); frame(c, bx, y + 40, 60, 40, null, '#8a8f99'); R(c, bx + 18, y + 44, 24, 3, '#3a3f4a');
    T(c, '投票箱', bx + 30, y + 58, 12, PCx.dim, 'center');
    paperArt(c, bx + 22, y + 18 + Math.round(Math.sin(Date.now() / 300) * 2), 16, 22, 3);
    arrowR(c, x + 76, y + 60, 24);
    T(c, '投票は秘密（秘密投票）', x + w / 2, y + 86, 12, ND, 'center');
  },
  age(c, x, y, w, h, yr) {
    const cols = [[yr >= 2016 ? '18' : '20', '投票できる', '（選挙権）'], ['25', '衆議院など', 'に立候補'], ['30', '参院・知事', 'に立候補']];
    cols.forEach((cc, i) => {
      const cx = x + 36 + i * 68;
      disc(c, cx, y + 26, 20, i === 0 ? '#4a78d8' : '#e0a03a'); disc(c, cx, y + 26, 17, '#ffffff');
      T(c, cc[0], cx, y + 15, 16, i === 0 ? '#4a78d8' : '#c07a1a', 'center'); T(c, '歳', cx, y + 33, 12, PCx.dim, 'center');
      T(c, cc[1], cx, y + 54, 12, PCx.text, 'center'); T(c, cc[2], cx, y + 70, 12, PCx.dim, 'center');
    });
  },
  twoBallots(c, x, y, w, h, yr) {
    if (yr >= 1996) {
      abox(c, x + 12, y + 8, 84, 60, '小選挙区\n――――\n候補者の名前', '#fffdf4');
      abox(c, x + w - 96, y + 8, 84, 60, '比例代表\n――――\n政党の名前', '#f4fbff');
      T(c, '1人だけ当選', x + 54, y + 76, 12, PCx.dim, 'center'); T(c, '票の割合で議席', x + w - 54, y + 76, 12, PCx.dim, 'center');
    } else {
      abox(c, x + 60, y + 6, 88, 60, '中選挙区\n――――\n候補者の名前', '#fffdf4');
      T(c, '1つの選挙区から3〜5人当選', x + w / 2, y + 76, 12, PCx.dim, 'center');
    }
  },
  deposit(c, x, y, w, h) {
    for (let i = 0; i < 4; i++) coinArt(c, x + 10 + (i % 2) * 8, y + 30 - i * 6);
    arrowR(c, x + 34, y + 30, 30);
    abox(c, x + 68, y + 14, 72, 36, '法務局\n（供託）', '#f4f1e8');
    arrowR(c, x + 144, y + 30, 22);
    abox(c, x + 168, y + 18, 36, 28, '立候\n補！', '#fff1c2');
    arrowL(c, x + 60, y + 66, 90, '#d6304a');
    T(c, '票が少ないと没収', x + 104, y + 74, 12, PCx.bad, 'center');
  },
  billFlow(c, x, y, w, h) {
    abox(c, x + 6, y + 6, 54, 26, '内閣', '#fff1e4'); abox(c, x + 6, y + 40, 54, 26, '議員', '#eef4ff');
    arrowR(c, x + 62, y + 18, 26); arrowR(c, x + 62, y + 52, 26);
    paperArt(c, x + 94, y + 18, 34, 42, 5);
    T(c, '法律案', x + 111, y + 64, 12, PCx.dim, 'center');
    arrowR(c, x + 132, y + 38, 22);
    dietArt(c, x + 156, y + 20, 0.75);
    T(c, '国会', x + 180, y + 50, 12, PCx.dim, 'center');
    T(c, '閣法と議員立法', x + w / 2, y + 84, 12, ND, 'center');
  },
  committee(c, x, y, w, h) {
    abox(c, x + 8, y + 10, 80, 50, '委員会\n（くわしく\n審査）', '#eef8f4');
    arrowR(c, x + 92, y + 34, 26);
    abox(c, x + 122, y + 10, 80, 50, '本会議\n（全員で\n採決）', '#f4eefc');
    for (let i = 0; i < 4; i++) mini(c, CROWD[i], x + 20 + i * 14, y + 66, 'up');
    T(c, '過半数で可決', x + 162, y + 72, 12, PCx.good, 'center');
  },
  twoHouses(c, x, y, w, h) {
    abox(c, x + 4, y + 8, 56, 30, '衆議院', '#eef4ff'); arrowR(c, x + 62, y + 22, 22);
    abox(c, x + 86, y + 8, 56, 30, '参議院', '#fff4ee'); arrowR(c, x + 144, y + 22, 22);
    abox(c, x + 168, y + 8, 36, 30, '成立', '#e8f8e8', PCx.good);
    frame(c, x + 4, y + 50, w - 8, 40, '#fffbe8', '#e0c070');
    T(c, '参議院が否決しても…', x + 12, y + 54, 12, PCx.text);
    T(c, '衆議院の3分の2で再可決', x + 12, y + 70, 12, PCx.bad);
  },
  promulgate(c, x, y, w, h) {
    paperArt(c, x + 20, y + 10, 44, 56, 7, '#fffdf4');
    T(c, '公布', x + 42, y + 72, 12, ND, 'center');
    arrowR(c, x + 72, y + 36, 50);
    frame(c, x + 132, y + 12, 52, 52, '#ffffff', '#8a8f99'); R(c, x + 133, y + 13, 50, 12, '#d6304a');
    T(c, '施行日', x + 158, y + 13, 12, '#ffffff', 'center'); T(c, '○月○日', x + 158, y + 34, 12, PCx.text, 'center');
    T(c, '施行', x + 158, y + 72, 12, ND, 'center');
  },
  shimei(c, x, y, w, h) {
    dietArt(c, x + 4, y + 20, 0.9);
    T(c, '国会が指名', x + 33, y + 56, 12, PCx.dim, 'center');
    arrowR(c, x + 66, y + 34, 26);
    mini(c, LOOKS.manager, x + 100, y + 20);
    R(c, x + 100, y + 30, 16, 2, '#d6304a');
    T(c, '総理大臣', x + 108, y + 46, 12, PCx.text, 'center');
    arrowR(c, x + 132, y + 34, 22);
    abox(c, x + 156, y + 18, 48, 34, '天皇が\n任命', '#f8f4e8');
    T(c, '首班指名（しゅはんしめい）', x + w / 2, y + 80, 12, ND, 'center');
  },
  cabinet(c, x, y, w, h) {
    const cx = x + w / 2, cy = y + 46;
    for (let i = 0; i < 9; i++) { const ang = (i / 9) * Math.PI * 2; face(c, i === 0 ? LOOKS.manager : CROWD[i % CROWD.length], cx + Math.cos(ang) * 70 - 16, cy + Math.sin(ang) * 30 - 12); }
    R(c, cx - 44, cy - 10, 88, 20, '#8a6a4a'); R(c, cx - 42, cy - 8, 84, 16, '#a8845a');
    T(c, '閣議', cx, cy - 7, 12, '#ffffff', 'center');
  },
  confidence(c, x, y, w, h) {
    abox(c, x + 4, y + 26, 54, 30, '衆議院', '#eef4ff');
    arrowR(c, x + 60, y + 40, 30, PCx.bad); T(c, '不信任', x + 75, y + 24, 12, PCx.bad, 'center');
    abox(c, x + 94, y + 26, 50, 30, '内閣', '#fff1e4');
    arrowR(c, x + 146, y + 32, 16); arrowR(c, x + 146, y + 50, 16);
    abox(c, x + 164, y + 10, 42, 30, '解散', '#eef4ff'); abox(c, x + 164, y + 46, 42, 30, '総辞\n職', '#fff4ee');
    T(c, '10日以内にどちらか', x + 100, y + 84, 12, ND, 'center');
  },
  poll(c, x, y, w, h) {
    const X0 = x + 28, Y0 = y + 76, W = w - 40, H = 66;
    R(c, X0, Y0, W, 1, INK); R(c, X0, Y0 - H, 1, H, INK);
    for (let k = 0; k < W; k += 4) R(c, X0 + k, Y0 - Math.round(H * 0.3 / 0.7), 2, 1, PCx.bad);
    T(c, '30%', X0 - 4, Y0 - Math.round(H * 0.3 / 0.7) - 7, 12, PCx.bad, 'right');
    const pts = [55, 52, 48, 50, 44, 39, 36, 31, 28, 33, 35];
    for (let i = 1; i < pts.length; i++) line(c, X0 + ((i - 1) * W) / (pts.length - 1), Y0 - (pts[i - 1] / 70) * H, X0 + (i * W) / (pts.length - 1), Y0 - (pts[i] / 70) * H, '#4a78d8');
    T(c, '支持率', X0 + 4, Y0 - H - 2, 12, '#4a78d8');
    T(c, '危険水域', X0 + W - 2, Y0 - 16, 12, PCx.bad, 'right');
  },
  bars(c, x, y, w, h) {
    const data = [['支持する', 42, '#4a78d8'], ['支持しない', 38, '#d6304a'], ['わからない', 20, '#9a9aa8']];
    data.forEach(([l, v, col], i) => { const yy = y + 12 + i * 26; T(c, l, x + 8, yy + 2, 12, PCx.text); R(c, x + 80, yy, Math.round((w - 120) * v / 50), 16, col); T(c, `${v}%`, x + w - 8, yy + 2, 12, PCx.dim, 'right'); });
    T(c, '（数字はたとえ）', x + w / 2, y + 88, 12, PCx.dim, 'center');
  },
  budgetFlow(c, x, y, w, h) {
    const st = [['8月', '概算\n要求'], ['12月', '原案'], ['12月末', '閣議\n決定'], ['1〜3月', '国会']];
    st.forEach(([m, l], i) => { const bx = x + 4 + i * 52; T(c, m, bx + 21, y + 8, 12, PCx.dim, 'center'); abox(c, bx, y + 24, 42, 40, l, i === 3 ? '#eef4ff' : '#fff8e8'); if (i < 3) arrowR(c, bx + 43, y + 44, 9); });
    T(c, '3月末までに成立させたい', x + w / 2, y + 80, 12, ND, 'center');
  },
  // shares by era (当初予算の目安; 公債依存度: 1987年度 19.4%, バブル期は10%前後, 2000年代は40%台, 令和は30%前後→20%台)
  pieIn(c, x, y, w, h, yr = 2026) {
    const b = yr < 1990 ? 19 : yr < 1993 ? 10 : yr < 1998 ? 27 : yr < 2013 ? 45 : yr < 2020 ? 34 : yr < 2025 ? 30 : 25;
    const P = [[95 - b, '#4a9a6a', '税金など'], [b, '#d6304a', '国債（借金）'], [5, '#9a9aa8', 'その他']];
    pie(c, x + 54, y + 46, 38, P); legend(c, x + 108, y + 18, P);
    T(c, '（割合は目安）', x + 108, y + 72, 12, PCx.dim);
  },
  // 2004年度ごろまでは社会保障・国債費・地方交付税がほぼ同じくらい（どれも約2割）、その後は社会保障がいちばん大きい
  pieOut(c, x, y, w, h, yr = 2026) {
    const S = yr < 2005 ? [20, 21, 20] : yr < 2015 ? [28, 22, 19] : [33, 23, 15];
    const P = [[S[0], '#e0a03a', '社会保障'], [S[1], '#d6304a', '国債費'], [S[2], '#4a78d8', '地方交付税'], [100 - S[0] - S[1] - S[2], '#9a9aa8', 'その他']];
    pie(c, x + 54, y + 46, 38, P); legend(c, x + 108, y + 10, P);
    T(c, '（割合は目安）', x + 108, y + 76, 12, PCx.dim);
  },
  pieLocal(c, x, y, w, h) {
    const P = [[40, '#4a9a6a', '地方税'], [35, '#4a78d8', '国からのお金'], [25, '#9a9aa8', '借金など']];
    pie(c, x + 54, y + 46, 38, P); legend(c, x + 108, y + 18, P);
    T(c, '（割合は目安）', x + 108, y + 72, 12, PCx.dim);
  },
  diet(c, x, y, w, h) {
    dietArt(c, x + w / 2 - 48, y + 6, 1.5);
    T(c, '衆議院', x + w / 2 - 50, y + 58, 12, '#4a78d8', 'center'); T(c, '参議院', x + w / 2 + 50, y + 58, 12, '#c0503a', 'center');
    T(c, '国会議事堂', x + w / 2, y + 78, 12, PCx.dim, 'center');
  },
  local(c, x, y, w, h) {
    abox(c, x + 10, y + 4, 80, 30, '首長\n（知事・区長）', '#fff1e4'); abox(c, x + w - 90, y + 4, 80, 30, '議会', '#eef4ff');
    arrowR(c, x + 92, y + 14, 24); arrowL(c, x + 92, y + 24, 24);
    for (let i = 0; i < 6; i++) mini(c, CROWD[i], x + 44 + i * 20, y + 66, 'up');
    arrowU(c, x + 50, y + 38, 26, PCx.good); arrowU(c, x + w - 50, y + 38, 26, PCx.good);
    T(c, '選挙', x + 64, y + 44, 12, PCx.good); T(c, '選挙', x + w - 36, y + 44, 12, PCx.good);
  },
  jorei(c, x, y, w, h) {
    paperArt(c, x + 30, y + 6, 56, 70, 9, '#fffdf4'); T(c, '条例', x + 58, y + 78, 12, ND, 'center');
    disc(c, x + 150, y + 30, 12, '#d6304a'); disc(c, x + 150, y + 30, 5, '#ffffff'); for (let i = 0; i < 14; i++) R(c, x + 150 - (14 - i) / 2, y + 40 + i, 14 - i, 1, '#d6304a');
    T(c, 'その地域だけの決まり', x + 150, y + 64, 12, PCx.dim, 'center');
  },
  signature(c, x, y, w, h) {
    frame(c, x + 12, y + 6, 54, 70, '#fffdf4', '#8a8f99'); R(c, x + 30, y + 3, 18, 6, '#8a8f99');
    for (let i = 0; i < 6; i++) { R(c, x + 18, y + 16 + i * 9, 8, 1, '#3a3f4a'); R(c, x + 30, y + 16 + i * 9, 30, 1, '#a8aeb8'); }
    T(c, '署名', x + 39, y + 80, 12, ND, 'center');
    for (let i = 0; i < 5; i++) mini(c, CROWD[i], x + 80 + i * 18, y + 50, 'up');
    abox(c, x + 86, y + 6, 116, 32, 'リコール・\n条例づくりを求める', '#fff8e8');
  },
  triangle(c, x, y, w, h) {
    const A = [x + w / 2, y + 14], B = [x + 40, y + 74], Cc = [x + w - 40, y + 74];
    line(c, A[0], A[1], B[0], B[1], '#8a8f99'); line(c, A[0], A[1], Cc[0], Cc[1], '#8a8f99'); line(c, B[0], B[1], Cc[0], Cc[1], '#8a8f99');
    abox(c, A[0] - 36, A[1] - 10, 72, 22, '国会（立法）', '#eef4ff'); abox(c, B[0] - 38, B[1] - 8, 76, 22, '内閣（行政）', '#fff1e4'); abox(c, Cc[0] - 38, Cc[1] - 8, 76, 22, '裁判所（司法）', '#f4eefc');
    disc(c, x + w / 2, y + 54, 8, '#4a9a6a'); T(c, '国民', x + w / 2, y + 64, 12, PCx.good, 'center');
  },
  triangle2(c, x, y, w, h) {
    ART.triangle(c, x, y, w, h);
    T(c, '不信任', x + 52, y + 32, 12, PCx.bad); T(c, '違憲審査', x + w - 54, y + 32, 12, '#8a5ac8', 'right'); T(c, '解散', x + w / 2 - 14, y + 82, 12, '#c07a1a');
  },
  balance(c, x, y, w, h) {
    scaleArt(c, x + w / 2 - 30, y + 14);
    T(c, '権力', x + w / 2 - 50, y + 46, 12, PCx.bad, 'center'); T(c, 'チェック', x + w / 2 + 52, y + 46, 12, PCx.good, 'center');
    T(c, 'つりあいが大切', x + w / 2, y + 76, 12, ND, 'center');
  },
  book(c, x, y, w, h) {
    R(c, x + 62, y + 6, 84, 70, '#2a4a7a'); R(c, x + 66, y + 10, 76, 62, '#3a5a8a'); R(c, x + 62, y + 6, 8, 70, '#1a3a6a');
    T(c, '日本国', x + 106, y + 22, 14, '#f0e0a0', 'center'); T(c, '憲法', x + 106, y + 40, 14, '#f0e0a0', 'center');
    T(c, '1947年5月3日 施行', x + w / 2, y + 82, 12, PCx.dim, 'center');
  },
  three(c, x, y, w, h) {
    R(c, x + 10, y + 10, w - 20, 8, '#c8c2b4'); R(c, x + 10, y + 76, w - 20, 6, '#c8c2b4');
    ['国民\n主権', '基本的\n人権', '平和\n主義'].forEach((l, i) => { const px = x + 24 + i * 60; R(c, px, y + 18, 40, 58, '#ece6d8'); R(c, px + 4, y + 18, 3, 58, '#d8d0c0'); abox(c, px - 2, y + 30, 44, 34, l, '#ffffff'); });
  },
  amend(c, x, y, w, h) {
    abox(c, x + 4, y + 6, 66, 30, '衆議院\n3分の2', '#eef4ff'); abox(c, x + 4, y + 46, 66, 30, '参議院\n3分の2', '#fff4ee');
    arrowR(c, x + 72, y + 40, 22);
    abox(c, x + 96, y + 26, 40, 30, '発議', '#fff8e8');
    arrowR(c, x + 138, y + 40, 18);
    abox(c, x + 158, y + 16, 48, 50, '国民\n投票\n過半数', '#e8f8e8', PCx.good);
  },
  shieldPeople(c, x, y, w, h) {
    abox(c, x + 70, y + 4, 68, 24, '権力（国）', '#f6e4e4', PCx.bad);
    paperArt(c, x + 86, y + 34, 36, 26, 3, '#fffdf4'); T(c, '憲法', x + 104, y + 38, 12, ND, 'center');
    for (let i = 0; i < 6; i++) mini(c, CROWD[i], x + 50 + i * 18, y + 66, 'up');
    arrowU(c, x + 70, y + 30, 26); arrowU(c, x + 136, y + 30, 26);
  },
  party(c, x, y, w, h) {
    R(c, x + 40, y + 6, 2, 50, INK); R(c, x + 42, y + 6, 36, 22, '#2a9d8f'); disc(c, x + 60, y + 17, 6, '#ffffff');
    for (let i = 0; i < 6; i++) mini(c, { ...CROWD[i % CROWD.length], top: '#2a9d8f' }, x + 30 + i * 22, y + 60, 'down');
    T(c, '同じ考えの仲間', x + 150, y + 20, 12, PCx.dim, 'center');
  },
  factions(c, x, y, w, h) {
    disc(c, x + w / 2, y + 46, 42, '#e2f3ee'); disc(c, x + w / 2 - 18, y + 36, 14, '#f6dede'); disc(c, x + w / 2 + 20, y + 34, 12, '#dee6f6'); disc(c, x + w / 2 + 2, y + 66, 10, '#f6f2de');
    T(c, '政党', x + w / 2 + 52, y + 8, 12, ND); T(c, 'A', x + w / 2 - 18, y + 30, 12, PCx.text, 'center'); T(c, 'B', x + w / 2 + 20, y + 28, 12, PCx.text, 'center'); T(c, 'C', x + w / 2 + 2, y + 60, 12, PCx.text, 'center');
    T(c, '派閥・グループ', x + 30, y + 84, 12, PCx.dim);
  },
  partyVote(c, x, y, w, h) {
    for (let i = 0; i < 8; i++) mini(c, { ...CROWD[i % CROWD.length], top: '#2a9d8f' }, x + 10 + i * 24, y + 30, 'up');
    T(c, '賛成のかたは起立！', x + w / 2, y + 8, 12, PCx.text, 'center');
    T(c, '党の方針どおりに投票', x + w / 2, y + 66, 12, ND, 'center');
  },
  voices(c, x, y, w, h) {
    const ls = [['賛成！', '#e8f8e8'], ['反対！', '#f8e8e8'], ['うーん…', '#ffffff']];
    for (let i = 0; i < 3; i++) { mini(c, CROWD[i], x + 30 + i * 66, y + 56); bubbleArt(c, x + 16 + i * 66, y + 22 + (i % 2) * 10, ls[i][0], ls[i][1]); }
    T(c, '立場がちがえば、意見もちがう', x + w / 2, y + 84, 12, PCx.dim, 'center');
  },
  tv(c, x, y, w, h) { tvArt(c, x + 30, y + 10); tvArt(c, x + 120, y + 10); T(c, 'いろいろなニュースを見くらべよう', x + w / 2, y + 66, 12, ND, 'center'); },
  shield(c, x, y, w, h) {
    shieldArt(c, x + 40, y + 10);
    ['陸', '海', '空'].forEach((l, i) => abox(c, x + 100 + i * 34, y + 18, 28, 28, l, ['#c8d8a8', '#a8c8e8', '#d8e8f8'][i]));
    T(c, '自衛隊', x + 140, y + 56, 12, ND, 'center');
  },
  chain(c, x, y, w, h, yr) {
    // 国民 → 国会 → 総理大臣 ↓ 防衛大臣（2007年までは防衛庁長官） ← 自衛隊 (政治が軍事をおさえる)
    const P = [['国民', 4, 6], ['国会', 74, 6], ['総理大臣', 144, 6], [yr >= 2007 ? '防衛大臣' : '防衛庁長官', 142, 50], ['自衛隊', 74, 50]];
    P.forEach(([l, bx, by], i) => abox(c, x + bx, y + by, i === 3 ? 64 : 60, 26, l, i === 4 ? '#e4ece4' : '#ffffff'));
    arrowR(c, x + 65, y + 19, 9); arrowR(c, x + 135, y + 19, 9);
    arrowD(c, x + 173, y + 33, 17);
    arrowL(c, x + 134, y + 63, 10);
    T(c, '政治が軍事をおさえる', x + 104, y + 84, 12, ND, 'center');
  },
  nine(c, x, y, w, h) {
    paperArt(c, x + 30, y + 8, 60, 70, 8, '#fffdf4'); T(c, '第9条', x + 60, y + 12, 12, ND, 'center');
    shieldArt(c, x + 130, y + 14);
    T(c, '専守防衛', x + 145, y + 54, 12, ND, 'center');
  },
  rescue(c, x, y, w, h) {
    R(c, x + 20, y + 40, 70, 24, '#5a7a4a'); R(c, x + 70, y + 30, 22, 20, '#5a7a4a'); R(c, x + 74, y + 33, 14, 8, '#a8d0e8');
    disc(c, x + 34, y + 66, 6, '#2a2e3a'); disc(c, x + 78, y + 66, 6, '#2a2e3a'); T(c, '災害派遣', x + 50, y + 44, 12, '#ffffff', 'center');
    for (let i = 0; i < 4; i++) { R(c, x + 130 + i * 16, y + 24, 10, 22, '#4a8ac8'); R(c, x + 132 + i * 16, y + 22, 6, 3, '#2a5a9a'); }
    T(c, '給水・救助・物資', x + 154, y + 56, 12, PCx.dim, 'center');
  },
  alert(c, x, y, w, h, yr = 2026) {
    if (yr < 2007) {
      // before the phone alerts (緊急地震速報 2007-10): the town's 防災無線 (outdoor loudspeakers)
      R(c, x + 48, y + 22, 4, 52, '#8a8f99'); R(c, x + 40, y + 74, 20, 4, '#6a6f79');
      frame(c, x + 30, y + 8, 18, 14, '#e8e8e0', '#6a6f79'); frame(c, x + 52, y + 8, 18, 14, '#e8e8e0', '#6a6f79');
      for (let i = 0; i < 3; i++) { R(c, x + 74 + i * 5, y + 10 - i * 2, 2, 10 + i * 4, '#d6304a'); R(c, x + 22 - i * 5, y + 10 - i * 2, 2, 10 + i * 4, '#d6304a'); }
      T(c, '防災無線', x + 50, y + 82, 12, PCx.dim, 'center');
    } else {
      frame(c, x + 30, y + 6, 40, 68, '#2a2e3a', '#1a1d26'); R(c, x + 34, y + 14, 32, 48, '#ffffff'); R(c, x + 34, y + 14, 32, 12, '#d6304a');
      T(c, '!', x + 50, y + 14, 12, '#ffffff', 'center'); T(c, '避難', x + 50, y + 34, 12, PCx.bad, 'center');
    }
    arrowR(c, x + (yr < 2007 ? 88 : 80), y + 40, yr < 2007 ? 24 : 30);
    houseArt(c, x + 120, y + 20);
    for (let i = 0; i < 3; i++) mini(c, CROWD[i], x + 156 + i * 14, y + 40, 'right');
  },
  hq(c, x, y, w, h) {
    abox(c, x + 4, y + 30, 54, 30, '市町村', '#ffffff'); arrowR(c, x + 60, y + 45, 12);
    abox(c, x + 74, y + 30, 54, 30, '都道府県', '#ffffff'); arrowR(c, x + 130, y + 45, 12);
    abox(c, x + 144, y + 22, 62, 46, '国の\n対策本部', '#fff1e4', PCx.bad);
    T(c, '情報をあげ、助けを求める', x + w / 2, y + 80, 12, ND, 'center');
  },
  house(c, x, y, w, h) {
    houseArt(c, x + 20, y + 20, true); T(c, '被災した家', x + 34, y + 54, 12, PCx.dim, 'center');
    arrowR(c, x + 66, y + 34, 30);
    for (let i = 0; i < 3; i++) { R(c, x + 108 + i * 32, y + 26, 26, 20, '#e8e8e0'); R(c, x + 108 + i * 32, y + 24, 26, 3, '#8a8f99'); R(c, x + 117 + i * 32, y + 34, 7, 12, '#8a6a4a'); }
    T(c, '仮設住宅', x + 152, y + 54, 12, PCx.dim, 'center');
  },
  one(c, x, y, w, h) {
    R(c, x + 80, y + 50, 48, 20, '#5a4a3a');
    mini(c, { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#3a3a3a', bottom: '#2a2a2a', jacket: true }, x + 96, y + 30);
    for (let i = 0; i < 6; i++) mini(c, CROWD[i], x + 10 + (i < 3 ? i * 20 : 130 + (i - 3) * 20), y + 64, 'up');
    T(c, '選挙・裁判・報道のチェックがない', x + w / 2, y + 6, 12, PCx.bad, 'center');
  },
  silence(c, x, y, w, h) {
    for (let i = 0; i < 5; i++) { mini(c, CROWD[i], x + 20 + i * 36, y + 46); bubbleArt(c, x + 12 + i * 36, y + 20, '…', '#eeeeee', PCx.dim); }
    line(c, x + 10, y + 16, x + w - 10, y + 76, '#d6304a'); line(c, x + 10, y + 17, x + w - 10, y + 77, '#d6304a');
    T(c, '言論の自由がなくなる', x + w / 2, y + 84, 12, PCx.bad, 'center');
  },
  coins(c, x, y, w, h) {
    for (let i = 0; i < 6; i++) coinArt(c, x + 10 + (i % 3) * 14, y + 50 - Math.floor(i / 3) * 12);
    arrowR(c, x + 60, y + 50, 30);
    abox(c, x + 96, y + 30, 108, 40, '事務所・秘書\n選挙のお金', '#fff8e8');
  },
  report(c, x, y, w, h) {
    paperArt(c, x + 40, y + 6, 56, 72, 9, '#fffdf4'); T(c, '収支報告書', x + 68, y + 80, 12, ND, 'center');
    disc(c, x + 140, y + 34, 16, '#8a8f99'); disc(c, x + 140, y + 34, 12, '#e8f4ff'); R(c, x + 151, y + 45, 12, 4, '#8a8f99');
    T(c, 'だれでも見られる', x + 150, y + 64, 12, PCx.dim, 'center');
  },
  cross(c, x, y, w, h) {
    disc(c, x + 70, y + 46, 26, '#a8845a'); R(c, x + 60, y + 16, 20, 10, '#8a6a4a'); T(c, '裏金', x + 70, y + 40, 12, '#ffffff', 'center');
    for (let k = -1; k <= 1; k++) { line(c, x + 120 + k, y + 16, x + 180 + k, y + 76, PCx.bad); line(c, x + 180 + k, y + 16, x + 120 + k, y + 76, PCx.bad); }
    T(c, '犯罪', x + 150, y + 82, 12, PCx.bad, 'center');
  },
  court(c, x, y, w, h) { courtArt(c, x + w / 2 - 28, y + 10); scaleArt(c, x + 16, y + 26); T(c, '裁判所', x + w / 2, y + 54, 12, ND, 'center'); },
  steps(c, x, y, w, h) {
    const st = ['地方裁判所', '高等裁判所', '最高裁判所'];
    st.forEach((l, i) => { R(c, x + 10 + i * 64, y + 70 - i * 22, 64, 14 + i * 22, ['#e4ddcc', '#d8d0c0', '#c8c2b4'][i]); T(c, l, x + 42 + i * 64, y + 56 - i * 22, 12, PCx.text, 'center'); });
  },
  jurors(c, x, y, w, h) {
    R(c, x + 10, y + 46, w - 20, 10, '#8a6a4a');
    for (let i = 0; i < 9; i++) mini(c, i >= 3 && i < 6 ? { ...LOOKS.manager, top: '#1a1a1a', bottom: '#1a1a1a' } : CROWD[i % CROWD.length], x + 18 + i * 20, y + 26);
    T(c, '裁判官と裁判員が並んで座る', x + w / 2, y + 66, 12, PCx.dim, 'center');
  },
  scale(c, x, y, w, h) { scaleArt(c, x + w / 2 - 30, y + 10); T(c, '有罪が決まるまでは無罪', x + w / 2, y + 60, 12, ND, 'center'); },
};
function lessonView(g, id) {
  const L = LESSONS.find((x) => x.id === id) || LESSONS[0];
  const v = {
    title: L.title, color: '#3aa86a', cancel: -1, k: 0,
    hint: () => (v.k < L.slides.length - 1 ? '←→:めくる　A:つぎ　B:もどる' : 'A:おわり　←:もどる　B:とじる'),
    update(ph, inp) {
      const n = L.slides.length;
      if (inp.repeat('left') && v.k > 0) { v.k--; sfx('cursor'); }
      if ((inp.repeat('right') || inp.pressed('a')) && v.k < n - 1) { v.k++; sfx('cursor'); return; }
      if (inp.pressed('a') && v.k === n - 1) {
        const a = assistState(g);
        const fresh = !a.lessons[L.id];
        a.lessons[L.id] = today(g);
        checkMissions(g);
        sfx(fresh ? 'chime' : 'ok');
        if (fresh) ph.toast(`「${L.title}」を学んだ！`, '#3aa86a');
        ph.back(1);
        return;
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(-1); }
    },
    draw(c, ph, a) {
      const s = L.slides[v.k];
      const yr = yearOf(g);
      T(c, fit(c, s.h, a.w - 60, 14), a.x + 10, a.y + 3, 14, '#2a6a4a');
      T(c, `${v.k + 1}/${L.slides.length}`, a.x + a.w - 10, a.y + 5, 12, PCx.dim, 'right');
      const bx = a.x + 8, by = a.y + 22, bw = a.w - 16, bh = 100;
      frame(c, bx - 1, by - 1, bw + 2, bh + 2, '#ffffff', '#c8d8c8');
      c.save();
      c.beginPath(); c.rect(bx, by, bw, bh); c.clip();
      try { (ART[s.art] || ART.balance)(c, bx, by, bw, bh, yr); } catch (e) { console.error(e); }
      c.restore();
      const txt = typeof s.text === 'function' ? s.text(yr, glossCtx(g)) : s.text;
      const ls = wrapJ(c, txt, a.w - 20, 12);
      ls.slice(0, 6).forEach((l, i) => T(c, l, a.x + 10, by + bh + 8 + i * LH, 12, PCx.text));
      // page dots
      const dy = a.y + a.h - 8;
      L.slides.forEach((_, i) => R(c, a.x + a.w / 2 - L.slides.length * 5 + i * 10, dy, 6, 4, i === v.k ? '#3aa86a' : '#c8d8c8'));
    },
  };
  return v;
}
async function lessonsSection(g, ph) {
  const a = assistState(g);
  return ph.open(listView(g, {
    title: '政治のしくみ', color: '#3aa86a', rowH: 24,
    items: () => LESSONS.map((L, i) => ({ label: `${i + 1}. ${L.title}`, right: a.lessons[L.id] ? '✓' : `${L.slides.length}枚`, rightColor: a.lessons[L.id] ? PCx.good : PCx.dim, id: L.id })),
    describe: () => `学んだしくみ：${Object.keys(a.lessons).length}/${LESSONS.length}。スライドは←→でめくれるよ。`,
    pick(ph2, it) { ph2.open(lessonView(g, it.id)); },
  }));
}

// ---- はじめてのミッション
function missionsView(g) {
  const a = assistState(g);
  checkMissions(g);
  return listView(g, {
    title: 'はじめてのミッション', color: '#e07a1f', rowH: 24,
    items: () => MISSIONS.map((m) => {
      const r = a.missions[m.id];
      const locked = m.locked && m.locked(g) && !(r && r.done);
      const state = r && r.claimed ? 'claimed' : r && r.done ? 'done' : locked ? 'locked' : 'todo';
      return {
        label: m.label, m, state,
        icon: (c, x, y) => { frame(c, x, y + 1, 12, 12, '#ffffff', state === 'todo' || state === 'locked' ? '#a8a090' : PCx.good); if (state !== 'todo' && state !== 'locked') { line(c, x + 2, y + 7, x + 5, y + 10, PCx.good); line(c, x + 5, y + 10, x + 10, y + 3, PCx.good); } },
        right: state === 'claimed' ? '済' : state === 'done' ? '受け取る' : locked ? 'まだ' : fmtMoney(m.reward),
        rightColor: state === 'done' ? PCx.bad : state === 'claimed' ? PCx.good : PCx.dim,
        labelColor: state === 'claimed' ? PCx.dim : null,
      };
    }),
    describe: (i) => { const m = MISSIONS[i]; if (!m) return ''; const r = a.missions[m.id]; return r && r.done ? (r.claimed ? '達成！ごほうびは受け取ったよ。' : 'Aでごほうびを受け取ろう！') : m.hint(g); },
    pick(ph, it) {
      if (it.state !== 'done') { sfx('buzz'); ph.toast(it.state === 'claimed' ? 'もう受け取ったよ' : 'まだ達成していないよ', '#9aa3c7'); return; }
      const r = claimMission(g, it.m.id);
      if (!r) return;
      sfx('coin');
      ph.toast(`ごほうび ${fmtMoney(it.m.reward)} を受け取った！`, '#e07a1f');
      if (r.all) { sfx('fanfare'); ph.open(talkView(g, ['ミッションをぜんぶクリア！すごい！', '「政治ナビの修了証」をどうぞ。政治のはじめの一歩、おめでとう！', 'これからは、ニュースを見たり、選挙で投票したり…あなたのペースで、政治とつきあっていってね。'], 'ミッションクリア')); }
    },
  });
}

// ---- ナビの設定
function settingsView(g) {
  const a = assistState(g);
  const rows = () => [
    { id: 'help', label: 'ヘルプのレベル', right: `◀ ${HELP_NAMES[a.help]} ▶`, rightColor: NC },
    { id: 'tips', label: 'ヒントの吹き出し', right: a.tipsOff ? 'OFF' : 'ON', rightColor: a.tipsOff ? PCx.dim : PCx.good },
    { id: 'future', label: 'この時代にない用語', right: a.showFuture ? '見せる' : 'かくす', rightColor: PCx.dim },
    { id: 'reset', label: 'ヒントをもう一度見る' },
    { id: 'intro', label: 'ことは先生の自己紹介' },
  ];
  const cycle = (d) => { const i = HELP_LEVELS.indexOf(a.help); a.help = HELP_LEVELS[(i + d + HELP_LEVELS.length) % HELP_LEVELS.length]; sfx('cursor'); };
  return listView(g, {
    title: 'ナビの設定', color: '#7a7a8a', rowH: 26,
    items: rows,
    keys(ph, inp, view) {
      if (rows()[view.idx] && rows()[view.idx].id === 'help') {
        if (inp.repeat('left')) { cycle(-1); return true; }
        if (inp.repeat('right')) { cycle(1); return true; }
      }
      return false;
    },
    describe: (i) => {
      const id = rows()[i] && rows()[i].id;
      if (id === 'help') return `${HELP_NAMES[a.help]}：${HELP_DESC[a.help]}`;
      if (id === 'tips') return '場所やできごとに合わせて、ことは先生が小さな吹き出しで説明するよ。';
      if (id === 'future') return a.showFuture ? 'この時代にまだない言葉や、ゲームの年より後のできごとも、印をつけてじてんにのせる。' : 'この時代にまだない言葉や、ゲームの年より後のできごとは、じてんにのせない。';
      if (id === 'reset') return '一度見たヒントを、もう一度見られるようにする。';
      return 'ことは先生の自己紹介を、もう一度見る。';
    },
    pick(ph, it) {
      if (it.id === 'help') cycle(1);
      else if (it.id === 'tips') a.tipsOff = !a.tipsOff;
      else if (it.id === 'future') a.showFuture = !a.showFuture;
      else if (it.id === 'reset') { a.tips = {}; ph.toast('ヒントを、もう一度見られるようにした', NC); }
      else if (it.id === 'intro') ph.open(talkView(g, introPages(g)));
    },
  });
}

// ================================================================ install
const METHODS = {
  navi(topic) { return openNavi(this, topic || 'home'); },
  assistTip(key, opts) { return assistTip(this, key, opts || {}); },
  helpLevel() { const a = assistState(this); return a ? a.help : 'normal'; },
  setHelpLevel(level) { const a = assistState(this); if (!a || !HELP_LEVELS.includes(level)) return false; a.help = level; return true; },
  explain(term) { return explain(this, term); },
  nextStepAdvice() { return nextStepAdvice(this); },
  naviTalk(where) { return naviTalk(this, where); },
  naviLook() { return NAVI.look; },
  assistState() { return assistState(this); },
};
export function installAssist(proto) {
  for (const [k, fn] of Object.entries(METHODS)) proto[k] = fn;
  if (!proto._naviWrapped) {
    proto._naviWrapped = true;
    const up0 = proto.update;
    proto.update = function updateWithNavi() {
      up0.call(this);
      try { stepTips(this); watchContext(this); } catch (e) { console.error(e); }
    };
    const draw0 = proto.render;
    proto.render = function renderWithNavi() {
      draw0.call(this);
      if (!this._naviTips || !this._naviTips.cur) return;
      try {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        drawTip(ctx, this);
        ctx.restore();
      } catch (e) { console.error(e); }
    };
    // the player's own ballot (for the 投票 mission)
    if (typeof proto.castVote === 'function') {
      const cv0 = proto.castVote;
      proto.castVote = function castVoteWithNavi(...args) {
        const r = cv0.apply(this, args);
        try { if (r == null) { markSeen(this, 'voted'); checkMissions(this); } } catch (e) { /* */ }
        return r;
      };
    }
  }
}
installAssist(Game.prototype);

registerPhoneApp('navi', {
  name: '政治ナビ', color: NC, order: 61,
  iconHD(c, x, y) {
    if (PH.appTile) PH.appTile(c, x, y, '#238a7e'); else R(c, x, y, 32, 32, NC);
    // a speech bubble with a book: 「ナビ」
    R(c, x + 5, y + 6, 22, 15, '#ffffff'); R(c, x + 6, y + 5, 20, 1, '#ffffff'); R(c, x + 6, y + 21, 20, 1, '#ffffff');
    R(c, x + 9, y + 22, 3, 3, '#ffffff'); R(c, x + 9, y + 25, 1, 1, '#ffffff');
    R(c, x + 9, y + 9, 6, 9, '#2a9d8f'); R(c, x + 17, y + 9, 6, 9, '#2a9d8f'); R(c, x + 15, y + 9, 2, 9, '#1f6f66');
    R(c, x + 10, y + 11, 4, 1, '#d8f4ee'); R(c, x + 18, y + 11, 4, 1, '#d8f4ee'); R(c, x + 10, y + 14, 3, 1, '#d8f4ee'); R(c, x + 18, y + 14, 3, 1, '#d8f4ee');
    R(c, x + 23, y + 23, 4, 4, '#ffd23f');
  },
  badge: (g) => {
    const a = g.state && g.state.assist;
    if (!a || !a.intro) return 1;
    const m = a.missions || {};
    return Object.values(m).filter((r) => r && r.done && !r.claimed).length;
  },
  open: (g) => openNavi(g, 'home'),
});
