// Crime, money trouble and justice (裁判所・刑務所・警察): CONTRACT written by the lead;
// the justice-core pass implements it. Other modules may rely on every name below.
//
// ---------------------------------------------------------------- principles
// - Japan's reality, shown seriously: crimes have real legal names, statutes and penalty
//   ranges (verify; era-aware: 懲役・禁錮 merged into 拘禁刑 from 2025-06 → reiwa uses 拘禁刑),
//   detection chances, and the real procedure: 逮捕 (48h) → 送検 (24h) → 勾留 (10+10日) →
//   起訴/不起訴/略式起訴 → 公判 → 判決 (罰金・執行猶予・実刑) → 控訴/上告 → 刑務所 (刑務作業, 仮釈放).
//   Consequences: 前科, agency contract ends, TV/regular shows dropped, politicians lose office
//   (禁錮以上 / 公職選挙法・政治資金規正法 → 公民権停止), fans and reputation fall.
// - No real-world how-to detail: crimes are abstract choices with outcomes.
// - Terrorism and assassination are NEVER player actions: they exist only as events by
//   fictional antagonists (threats, foiled plots, crisis response) — see darkside.js.
// - Money trouble: 消費者金融 (legal: 上限金利 15-20%, 総量規制 年収の1/3), 闇金 (illegal: トイチ,
//   harassment), 自己破産 (裁判所: 破産手続 → 免責; effects), 個人再生, 任意整理.
// - Smoking/drinking: 20+ only (younger = 補導 / 違反); 路上喫煙 fines in some districts.
//
// ---------------------------------------------------------------- state (g.state.justice)
// {
//   v: 1,
//   status: 'free'|'detained'|'trial'|'prison'|'probation',
//   record: [{ crime, day, outcome: 'fine'|'suspended'|'prison'|'acquitted'|'not_indicted', years?, fine? }],
//   heat: { [crimeId]: { n, day } },          // undetected offences that may still surface
//   custody: null | { crime, since: day, stage },
//   prison: null | { until: day, place: 'keimusho', work: n, parole: day|null },
//   probationUntil: day|null,
//   civicBanUntil: day|null,                  // 公民権停止 (cannot vote/run)
//   loans: [{ lender: 'shohisha'|'yamikin'|'bank', principal, rate, due: day, missed: n }],
//   bankrupt: null | { filed: day, discharged: bool, until: day },
//   smoker: 0..100,                           // habit level
//   flags: {},
// }
//
// ---------------------------------------------------------------- registries (exports)
// CRIMES { [id]: { name, law (罪名と条文), penalty (era-aware text + numbers), detect (base chance), severity 1..5,
//          political?: bool, civicBan?: bool } }
//   ids at least: shoplifting (窃盗), robbery (強盗), fare_evasion (鉄道営業法違反/詐欺), assault (暴行・傷害),
//   tax_evasion (所得税法違反), slush_fund (政治資金規正法違反・不記載), bribery_take (収賄), bribery_give (贈賄),
//   vote_buying (公職選挙法違反・買収), door_to_door (戸別訪問), underage_smoking (補導), street_smoking (路上喫煙・過料),
//   antisocial_ties (暴排条例・反社との交際 — not a crime for citizens in all cases; career sanctions), drunk (泥酔・迷惑行為),
//   loan_shark_use? (borrowing from 闇金 is not a crime for the borrower — model as trouble, not a crime)
//
// ---------------------------------------------------------------- g.* API (installJustice(Game.prototype))
// jus()                               -> g.state.justice (created on demand)
// commitCrime(id, ctx)                -> async; asks nothing; decides detection now or later (heat); returns { caught, report }
// arrest(id, ctx)                     -> async; the full procedure with scenes (警察署 → 検察 → 裁判所 → 刑務所 places)
// trial(caseObj)                      -> async; courtroom flow (起訴状朗読, 証拠, 被告人質問, 弁護, 判決); the player
//                                       chooses 認める/否認/反省 etc.; a lawyer (国選/私選) affects the outcome
// serveSentence()                     -> prison loop: days pass, 刑務作業, behaviour → 仮釈放
// hasRecord(), isFree(), civicBanned()
// fine(amount, reason)                -> pays or turns into 労役場留置 when unpaid
// borrow(lender, amount) / repay(loanIndex, amount) / loanTick(g)  (interest, harassment events for 闇金)
// fileBankruptcy()                    -> async court procedure; clears debts, sets restrictions
// smoke() / canSmokeHere(place)       -> stress relief, health cost, legality checks
// onJustice(event, fn)                -> hooks: 'arrested','convicted','released','acquitted','bankrupt'
// justiceTick(g)                      -> onMorning: heat surfacing (investigations), loans, prison days, probation end
//
// Places (police/検察/裁判所/刑務所) and the underworld town call only these.
//
// ======================================================================== IMPLEMENTATION NOTES
// (justice core; everything above is the lead's contract and still holds — names are only added)
//
// Time. Short legal periods counted in days are game days 1:1 up to two weeks (逮捕48時間 = 2 days,
// 勾留10日 = 10 days); longer day counts are compressed with realToGameDays(). Months and years
// use the game calendar: 1 year = YEAR_DAYS (120) days, 1 month = MONTH_DAYS (10) days
// (sentences, 執行猶予, 公民権停止, 公訴時効, 信用情報). The law in force follows lawDate(g):
// ERA_BASE_YEAR[era] + elapsed game years (or g.gameDate() if the politics core provides one),
// so e.g. the 2006 theft fine, the 2007 drink-driving penalties, 2010 総量規制 and 2025 拘禁刑 switch on
// by date.
//
// Flow. commitCrime() decides detection; when caught it runs the matching flow itself
// (ctx.handle === false to skip): 過料 on the spot (路上喫煙), 補導 (minors' smoking/drinking),
// the store's back office (万引き), the station office (無賃乗車), otherwise arrest(). Undetected
// offences become heat; justiceTick (onMorning) lets heat surface (防犯カメラ, 被害届, 税務調査,
// 告発, 週刊誌) and queues events (dawn arrest, summons, 税務調査, 闇金 visits, court dates). Queued
// events run right after the player wakes up (installJustice wraps g.sleep) or via g.justiceEvents().
// Custody / prison advance st.day themselves (custodyDay): rent is not charged, loans keep running,
// other content morning hooks are skipped (no phone inside), g.politicsTick runs if present.
//
// Scenes. If places 'keisatsu' / 'kensatsu' / 'saibansho' / 'keimusho' are registered the flow
// teleports there with g.goto (room hints: JUSTICE_PLACES[stage].rooms); otherwise it runs on HD
// overlays (StageScene: 取調室, 留置場, 検察庁, 法廷, 面会室, 刑務所, 門, 弁護士事務所 …). Every choice
// works with g.auto (the first choice is the cautious / lawful one).
//
// Career / politics / life. careerSanction(level): fans and ★ fall, regular shows dropped,
// agency contract ends (severity / 反社), 謹慎 (no entertainment jobs; part-time jobs ok), then a TV
// ban (only stage / live work comes back first). Politicians: 失職 on 禁錮以上の実刑, or 公民権停止 for
// 公職選挙法・政治資金規正法 crimes (罰金: 5年, 禁錮: 刑の執行終了まで＋5年, 執行猶予: 猶予期間中) and for
// 在職中の収賄; via g.loseOffice(reason) when the politics core provides it, else the state directly.
// Family send messages; the trial may call a parent as 情状証人; prison has 面会 and letters.
//
// ---------------------------------------------------------------- final API (justice core)
// Exports: CRIMES, CRIME_ORDER, crimeLaw(g, id, ctx), penaltyOf(g, id, ctx), limitYears(g, id, ctx), LENDERS,
//   lenderRate(g, lender, principal), rateLawText(g), loanBalance(loan), loanTick(g, opts), LABOR_YEN, CIG_PRICE,
//   SMOKING_RULES, registerSmokingRule(placeId, rule | (g, placeDef) => rule), JUSTICE_PLACES (set
//   JUSTICE_PLACES.police.rooms.torishirabe = '<room id>' etc. when the places exist), StageScene,
//   careerSanction(g, level 1..5, info), sentenceText(g, sentence), onJustice(event, fn), justiceTick(g),
//   newJusticeState(), installJustice(proto), lawDate(g, day?), lawYear(g), wareki(year, month), kokinEra(g),
//   fmtTerm(months), realToGameDays(d), years(n), monthsToDays(n), MONTH_DAYS, ERA_BASE_YEAR, isPolitician(g),
//   isDietMember(g), JUSTICE_CONTRACT_VERSION.
// g.* (all from installJustice):
//   jus() · commitCrime(id, ctx) → { caught, report, outcome } (ctx: amount, where, injury, request, gain:
//   { money, item }, detect, risk, forceCaught, neverCaught, handle:false, rule, private) · arrest(id, ctx) → case
//   (ctx: via 'genkouhan'|'warrant', evidence, amount, plea, caseId) · trial(caseOrId, opts) · serveSentence() ·
//   hasRecord() (前科) · hasHistory() · isFree() · civicBanned() · civicBanReason() · fine(amount, reason,
//   { kind: 'bakkin'|'karyo'|'kare'|'tsuicho'|'tax'|'civil' }) → { paid, labor, unpaid } · borrow(lender, amount)
//   → { ok, reason, loan, received } · repay(loanIndex|id|loan, amount) → { paid, left, cleared } · loanTick() ·
//   loanTotal(lender?) · loanLimit(lender) · annualIncome() · creditBlacklisted(lender) · loanCounter(lender) ·
//   consultLawyer(topic 'debt'|'yamikin') · debtRelief('nini'|'saisei'|'hasan') · fileBankruptcy({ force }) ·
//   policeConsult(topic) · smoke({ place, anyway, smokingArea, silent }) · canSmokeHere(place?) ·
//   buyCigarettes(n, { counter }) · canSmoke() · canDrink() · drinkAlcohol({ private, heavy, relief, where }) ·
//   onJustice(event, fn) · justiceTick() · justiceEvents() · justiceRefusal(kind 'job'|'regular'|'audition'|
//   'candidacy'|'vote', def) · careerSanction(level, info) · investigate(id, { amount, now }) · coverUp(id, ctx) ·
//   justiceStatus() · justiceLines() · lawDate() · lawYear() · crimeLaw(id, ctx).
// Wrapped (behaviour kept): g.job / g.audition / g.doRegular refuse during 謹慎 / TV ban; g.sleep runs the
// queued events after waking; g.addMoney records income (年収) and takes 差押え.
// Shops selling cigarettes should call g.buyCigarettes() (age checks), not g.shop(['tabako']).
//
// Sources checked (2026-10, WebSearch; amounts/dates as encoded below):
//   拘禁刑: 2022年6月17日公布・2025年6月1日施行（懲役・禁錮を一本化）— keiyaku-watch.jp/media/hourei/202506-kokinkei,
//     courts.go.jp 福岡地裁 2025 QUIZ; 有期刑は1か月以上20年以下（2005年1月1日施行の改正で上限15→20年: moj.go.jp 001413633.pdf）
//   窃盗罪の罰金刑（50万円以下）新設: 2006年改正（moj.go.jp/content/000008292.pdf; 略式命令の上限100万円も同改正）
//   逮捕48時間・送致後24時間（通算72時間）・勾留10日＋延長10日: 刑訴法203・205・208条（law-lib.jp, daylight-law.jp）
//   保釈は起訴後のみ（207条1項）・権利保釈89条・保証金の相場150〜300万円（daylight-law.jp, mc-law.jp）
//   略式命令: 100万円以下の罰金・科料、被疑者の同意（刑訴法461条・462条; daylight-law.jp）
//   被疑者国選: 2006年10月（重大事件）→2009年5月（長期3年超）→2018年6月1日 勾留全事件（moj.go.jp 000115559.pdf ほか）
//   執行猶予: 3年以下の拘禁刑又は50万円以下の罰金、1年以上5年以下（刑法25条; wikibooks 刑法25条, daylight-law.jp）
//   仮釈放: 有期刑は刑期の3分の1経過後（刑法28条）、実務では刑期の8割以上が多い（令和6年版犯罪白書 via wikibooks 刑法28条）
//   労役場留置: 罰金1日以上2年以下・科料30日以下（刑法18条）、1日あたりおおむね5000円（wikibooks 刑法18条）
//   公訴時効: 刑訴法250条2項（長期15年以上10年・15年未満7年・10年未満5年…）（law-lib.jp, daylight-law.jp）
//   収賄5年以下・受託収賄7年以下・贈賄3年以下又は250万円以下（刑法197・198条; wikibooks）
//   所得税ほ脱: 10年以下又は1000万円以下（脱税額1000万円超は脱税額まで）（所得税法238条; zeiken.co.jp）、
//     平成22年度改正で引上げ（nta.go.jp 税大ジャーナル22号）、重加算税35%（無申告40%）（mof.go.jp 2023-12 資料）
//   政治資金規正法: 不記載・虚偽記入 5年以下の禁錮又は100万円以下の罰金（25条）、公民権停止（28条）
//     （pref.hiroshima.lg.jp 648386.pdf, pref.kumamoto.jp 59604.pdf）; 2024年改正（令和6年法律第64号）で確認書
//   公職選挙法: 買収 3年以下の懲役若しくは禁錮又は50万円以下の罰金（221条1項; soumu.go.jp なるほど!選挙）、
//     戸別訪問 1年以下の禁錮又は30万円以下の罰金（138条・239条; kotobank, city.okayama.jp）、
//     禁錮以上の刑の執行を終わるまでは選挙権・被選挙権なし・執行猶予中は除く（11条1項2・3号; sn-hoki.co.jp）、
//     連座制（251条の2）、公民権停止（252条）
//   不逮捕特権: 憲法50条・国会法33条（会期中は院の許諾が必要、院外の現行犯は例外）（kotobank, ben54.jp）
//   出資法の上限金利: 73%（1983年11月）→54.75%（1986年11月）→40.004%（1991年11月）→29.2%（2000年6月）
//     →20%（2010年6月）（acom.co.jp Business Outline, mhlw.go.jp ss2-1.pdf）; 総量規制 年収の3分の1・
//     改正貸金業法 2010年6月18日完全施行・銀行カードローンは対象外（eloan.co.jp, nishi.or.jp）;
//     利息制限法 10万円未満20%・100万円未満18%・100万円以上15%
//   闇金: 年109.5%超の契約は無効（貸金業法42条）、元本も返還不要（最高裁平成20年6月10日）（fsa.go.jp yamikin/01.pdf）
//   自己破産: 同時廃止／少額管財（予納金20万円）、自由財産は現金99万円まで（vs-group.jp, mc-law.jp）;
//     信用情報 CIC・JICC 約5年、KSC 7年（2022年11月に10年→7年）（pay-route.co.jp ほか）
//   喫煙: 二十歳未満ノ者ノ喫煙ノ禁止ニ関スル法律（本人に罰則なし・没収、親権者は科料、販売者50万円以下）（hourei.net）;
//     改正健康増進法 2020年4月1日全面施行・原則屋内禁煙（mhlw 受動喫煙サイトほか）; taspo 2008年導入
//     （j-cast.com 2008-05）; 千代田区 2002年10月から・過料2,000円・2010年4月から区内全域（media.monex.co.jp）;
//     大阪市 2025年1月27日から市内全域禁止・過料1,000円（city.osaka.lg.jp）; 港区は禁止だが過料なし（city.minato.tokyo.jp）
//   暴力団排除条例: 2011年10月1日 東京都・沖縄県で施行し47都道府県で出そろう（toyokeizai.net, city.shinjuku.lg.jp）
//   特定少年（18・19歳）: 2022年4月1日改正少年法、短期1年以上の罪（強盗等）は原則逆送、起訴後は実名報道可（moj.go.jp）
//   鉄道営業法29条（2万円以下の罰金又は科料・親告罪）・増運賃（運賃の2倍、合計3倍）（ben54.jp, jr-central 旅客営業規則）
//   飲酒運転: 2002年6月以前は酒気帯び3月以下又は5万円以下、現行は酒気帯び3年以下又は50万円以下・酒酔い5年以下又は100万円以下
//     （police.pref.aomori.jp, bestcarweb.jp）
//   賭博罪 50万円以下の罰金又は科料・常習賭博3年以下（刑法185・186条; wikibooks）
//   証拠隠滅等罪 3年以下又は30万円以下（旧2年以下又は20万円以下）（刑法104条; law-lib.jp, kotobank）
//   預貯金通帳等の不正譲渡: 2026年7月10日から3年以下又は500万円以下（それまで1年以下又は100万円以下）（犯収法; miyake.gr.jp, shinkin.co.jp）

import { SW, SH, clamp, fmtMoney, makeCanvas, hash2, mulberry32 } from './util.js';
import { text, wrap, panel, measure, rect, COLORS } from './draw.js';
import { audio } from './audio.js';
import { ITEMS, AGENCIES, registerItem } from './state.js';
import { PLACES } from './map.js';
import { onMorning, PEOPLE, REGULARS, HOUSING, registerPhoneApp, PHONE_APPS, weekOf } from './life.js';
import { ageOf, eraOf, YEAR_DAYS, isBirthday, birthdayFlag, RELATIONS, sortFamily, familyLook, regionOf, fullName } from './profile.js';
import { charSheetHD, LOOKS } from './sprites.js';
import { phoneList, phoneInfo, phoneConfirm } from './phone.js';
import * as POL from './politics.js'; // read lazily (OFFICES); politics may import this module too

export const JUSTICE_CONTRACT_VERSION = 1;

// ======================================================================== time & the law in force
export const MONTH_DAYS = YEAR_DAYS / 12; // 10 game days
// Where each era's game starts (April of that year; the same calendar as the politics core's polDate,
// which lawDate prefers when it is loaded).
export const ERA_BASE_YEAR = { showa: 1987, heisei_early: 1995, heisei: 2004, reiwa: 2026 };
const ERA_START_MONTH = 4;
export const years = (n) => Math.round(n * YEAR_DAYS);
export const monthsToDays = (n) => Math.round(n * MONTH_DAYS);
// Real-world day counts → game days: 1:1 up to two weeks, then compressed to the game year.
export function realToGameDays(d) {
  d = Math.max(0, Number(d) || 0);
  return d <= 14 ? Math.max(1, Math.round(d)) : Math.round(14 + ((d - 14) * YEAR_DAYS) / 365);
}
// The date the law is read at: { year, month, ym } (ym = year * 100 + month).
export function lawDate(g, day) {
  const st = g && g.state;
  if (g && typeof g.gameDate === 'function') {
    try {
      const d = day == null ? g.gameDate() : g.gameDate(day);
      if (d && Number.isFinite(d.year)) { const month = clamp(Math.round(d.month || 1), 1, 12); return { year: d.year, month, ym: d.year * 100 + month }; }
    } catch (e) { /* fall back */ }
  }
  const era = (st && st.profile && st.profile.era) || 'reiwa';
  const n = Math.max(0, ((day ?? (st && st.day)) || 1) - 1);
  const idx = ERA_START_MONTH - 1 + Math.floor(n / MONTH_DAYS);
  const year = (ERA_BASE_YEAR[era] ?? 2026) + Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return { year, month, ym: year * 100 + month };
}
export const lawYear = (g) => lawDate(g).year;
const since = (g, y, m = 1) => lawDate(g).ym >= y * 100 + m;
// 和暦 (courts write dates this way): 昭和 / 平成 / 令和.
export function wareki(year, month) {
  let s;
  if (year >= 2019 && !(year === 2019 && month && month < 5)) s = `令和${year - 2018 === 1 ? '元' : year - 2018}年`;
  else if (year >= 1989) s = `平成${year - 1988 === 1 ? '元' : year - 1988}年`;
  else s = `昭和${year - 1925}年`;
  return month ? `${s}${month}月` : s;
}
// 懲役 / 禁錮 → 拘禁刑 (2025-06-01).
export const kokinEra = (g) => since(g, 2025, 6);
function laborWord(g, labor) {
  if (kokinEra(g)) return '拘禁刑';
  return labor === 'kinko' ? '禁錮' : labor === 'both' ? '懲役若しくは禁錮' : '懲役';
}
// "1年6月" / "10月" (courts write 月 for months).
export function fmtTerm(months) {
  months = Math.max(0, Math.round(months));
  const y = Math.floor(months / 12), m = months % 12;
  return (y ? `${y}年` : '') + (m ? `${m}月` : '') || '0月';
}
const pct = (v) => `${Math.round(v * 1000) / 10}%`;
const man = (yen) => (yen >= 10000 && yen % 10000 === 0 ? `${(yen / 10000).toLocaleString('ja-JP')}万円` : `${yen.toLocaleString('ja-JP')}円`);
const rnd = (g) => (g && g._jusRng ? g._jusRng() : Math.random());
const roll = (g, p) => rnd(g) < p;
const pickR = (g, arr) => arr[Math.floor(rnd(g) * arr.length)];
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);

// ======================================================================== crimes
// def: {
//   name, short (罪名), law(g) → 罪名と条文と法定刑 (the law in force at lawDate(g)),
//   severity 1..5, kind: 'crime' | 'admin' (過料) | 'hodo' (補導: no penalty for the minor) | 'career' (not
//     prosecuted; contracts end),
//   detect(g, ctx) → chance of being caught at the scene, later(g, h) → daily chance a hot offence surfaces,
//   hotDays: days the daily chance stays at full strength (then it fades to a quarter),
//   victim: 示談 possible, political / civicBan / bribery: 公民権 rules,
//   exists(g): the offence exists at that date (account selling 2004-, 暴排条例 2011-, …),
//   penalty(g, ctx) → { prison: [minMonths, maxMonths] | null, labor: 'choeki' | 'kinko' | 'both', fine: [min, max] | null,
//     kouryu, karyo, kare (過料 amount) },
//   facts(cs, g) → 公訴事実 (one sentence, abstract), typical(g, cs) → the usual outcome for these facts:
//     { charge (起訴 chance for a cooperative first offender), fine, months, suspendOk, extraFine, tsuicho } }
// cs (a case) has { crime, amount, injury, priors (前科), same (前科 of this crime), n (times committed), … }.
const T = (o) => o;
export const CRIMES = {
  shoplifting: T({
    name: '万引き', short: '窃盗',
    law: (g) => `窃盗罪（刑法235条）：10年以下の${laborWord(g, 'choeki')}${since(g, 2006, 5) ? '又は50万円以下の罰金' : '（当時は罰金刑がない）'}`,
    severity: 1, kind: 'crime', victim: true, hotDays: 20,
    detect: (g, ctx) => clamp(0.22 + 0.05 * Math.min(6, ctx.n || 0) + (ctx.amount > 5000 ? 0.08 : 0) + (eraKey(g) === 'reiwa' ? 0.05 : 0), 0.05, 0.75),
    later: (g, h) => 0.012 * (h.amount > 5000 ? 2 : 1) * famous(g),
    penalty: (g) => ({ prison: [1, 120], labor: 'choeki', fine: since(g, 2006, 5) ? [10000, 500000] : null }),
    facts: (cs) => `${cs.where || '店内'}で、商品（販売価格合計${fmtMoney(cs.amount || 500)}）を窃取した`,
    typical(g, cs) {
      const fineOk = since(g, 2006, 5);
      const k = (cs.same || 0) + Math.min(2, cs.hist || 0); // 前科 and 前歴 (微罪処分・不起訴) of theft
      if (!k && !cs.priors) return fineOk ? { charge: 0.35, fine: 200000, suspendOk: true } : { charge: 0.15, months: 10, suspendOk: true };
      if (k <= 1) return fineOk ? { charge: 0.85, fine: 300000 + Math.min(200000, (cs.amount || 0) * 10), suspendOk: true } : { charge: 0.75, months: 12, suspendOk: true };
      if (cs.same === 2) return { charge: 0.95, months: 12, suspendOk: true };
      return { charge: 1, months: 18 + 6 * Math.min(4, cs.same - 3), suspendOk: true };
    },
  }),
  robbery: T({
    name: '強盗', short: '強盗',
    law: (g) => `強盗罪（刑法236条）：5年以上の有期${laborWord(g, 'choeki')}（上限${since(g, 2005, 1) ? 20 : 15}年）`,
    severity: 5, kind: 'crime', victim: true, hotDays: 60,
    detect: (g, ctx) => clamp(0.4 + 0.05 * Math.min(4, ctx.n || 0), 0.3, 0.8),
    later: (g) => 0.03 * famous(g),
    penalty: (g) => ({ prison: [60, since(g, 2005, 1) ? 240 : 180], labor: 'choeki', fine: null }),
    facts: (cs) => `${cs.where || '店舗'}で、店員に暴行・脅迫を加えて反抗を抑圧し、現金${fmtMoney(cs.amount || 50000)}を強取した`,
    typical: (g, cs) => ({ charge: 1, months: 72 + 12 * Math.min(4, cs.priors) + ((cs.amount || 0) >= 1000000 ? 12 : 0), suspendOk: false, reducible: true }),
  }),
  fare_evasion: T({
    name: '無賃乗車', short: '鉄道営業法違反',
    law: (g) => `鉄道営業法29条：${eraKey(g) === 'showa' ? '罰金又は科料' : '2万円以下の罰金又は科料'}（鉄道会社の告訴が必要）。くり返しのキセル乗車などは詐欺罪（刑法246条）にも。運賃の2倍の増運賃（合計3倍）を請求される`,
    severity: 1, kind: 'crime', hotDays: 10,
    detect: (g, ctx) => ({ showa: 0.1, heisei_early: 0.16, heisei: 0.24, reiwa: 0.3 }[eraKey(g)] || 0.25) + 0.03 * Math.min(5, ctx.n || 0),
    later: () => 0.002,
    penalty: () => ({ prison: null, fine: [1000, 20000], karyo: true }),
    facts: (cs) => `${cs.where || '駅'}で、正規の乗車券を持たずに列車に乗車した`,
    typical: (g, cs) => (cs.n >= 6 ? { charge: 0.7, months: 10, suspendOk: true, label: '詐欺' } : cs.n >= 3 ? { charge: 0.5, fine: 10000 + 2000 * Math.min(5, cs.n - 3), suspendOk: false } : { charge: 0, fine: 0 }),
  }),
  assault: T({
    name: '暴行・傷害', short: '暴行',
    law: (g) => `暴行罪（刑法208条）：2年以下の${laborWord(g, 'choeki')}若しくは${eraKey(g) === 'showa' ? '罰金' : '30万円以下の罰金'}又は拘留若しくは科料。けがをさせれば傷害罪（刑法204条）：${since(g, 2005, 1) ? 15 : 10}年以下の${laborWord(g, 'choeki')}又は${since(g, 2005, 1) ? '50万円' : eraKey(g) === 'showa' ? '' : '30万円'}以下の罰金`.replace('又は以下の罰金', '又は罰金'),
    severity: 2, kind: 'crime', victim: true, hotDays: 30,
    detect: (g, ctx) => clamp(0.45 + (ctx.injury ? 0.1 : 0) + 0.04 * Math.min(4, ctx.n || 0), 0.2, 0.85),
    later: (g, h) => 0.02 * (h.injury ? 1.5 : 1) * famous(g),
    penalty: (g, ctx = {}) => (ctx.injury
      ? { prison: [1, since(g, 2005, 1) ? 180 : 120], labor: 'choeki', fine: [10000, since(g, 2005, 1) ? 500000 : eraKey(g) === 'showa' ? 50000 : 300000] }
      : { prison: [1, 24], labor: 'choeki', fine: [10000, eraKey(g) === 'showa' ? 30000 : 300000], kouryu: true, karyo: true }),
    facts: (cs) => (cs.injury ? `${cs.where || '路上'}で、被害者に暴行を加え、全治2週間のけがを負わせた` : `${cs.where || '路上'}で、被害者の胸を突くなどの暴行を加えた`),
    typical(g, cs) {
      if (cs.injury) return cs.priors ? { charge: 0.95, months: 18, suspendOk: true } : { charge: 0.75, fine: 400000, months: 0, suspendOk: true };
      return cs.priors ? { charge: 0.8, fine: 300000, suspendOk: true } : { charge: 0.5, fine: 200000, suspendOk: true };
    },
  }),
  tax_evasion: T({
    name: '脱税', short: '所得税法違反',
    law: (g) => `所得税法違反（ほ脱犯・238条）：${since(g, 2010, 6) ? `10年以下の${laborWord(g, 'choeki')}若しくは1000万円以下の罰金` : '5年以下の懲役若しくは500万円以下の罰金'}又はその併科（免れた税額が大きければ罰金は税額まで）。刑事事件にならなくても、重加算税35%と延滞税がかかる`,
    severity: 3, kind: 'crime', hotDays: 240,
    detect: () => 0,
    later: (g, h) => clamp(0.0025 * (1 + Math.log10(1 + (h.amount || 0) / 1000000)) * famous(g, 0.5), 0, 0.03),
    penalty: (g) => ({ prison: [1, since(g, 2010, 6) ? 120 : 60], labor: 'choeki', fine: [10000, since(g, 2010, 6) ? 10000000 : 5000000] }),
    facts: (cs) => `所得の一部を秘匿して過少に申告し、所得税${fmtMoney(cs.amount || 1000000)}を免れた`,
    typical: (g, cs) => ({ charge: 1, months: clamp(12 + Math.round((cs.amount || 0) / 10000000) * 2, 12, 60), suspendOk: true, extraFine: Math.round((cs.amount || 0) * 0.2 / 10000) * 10000 }),
  }),
  slush_fund: T({
    name: '裏金（不記載）', short: '政治資金規正法違反',
    law: (g) => `政治資金規正法違反（収支報告書の不記載・虚偽記入・25条）：5年以下の${laborWord(g, 'kinko')}又は100万円以下の罰金。刑に処せられると公民権停止（28条）${since(g, 2024, 7) ? '。2024年改正で、議員本人の「確認書」の責任も問われる' : ''}`,
    severity: 3, kind: 'crime', political: true, civicBan: true, hotDays: 360,
    detect: () => 0,
    later: (g, h) => clamp(0.002 * (1 + Math.log10(1 + (h.amount || 0) / 1000000)) * famous(g, 0.5) * (isPolitician(g) ? 1.3 : 1), 0, 0.03),
    penalty: () => ({ prison: [1, 60], labor: 'kinko', fine: [10000, 1000000] }),
    facts: (cs) => `政治団体の収支報告書に、収入${fmtMoney(cs.amount || 1000000)}を記載しなかった`,
    typical: (g, cs) => ((cs.amount || 0) < 5000000 ? { charge: 0.7, fine: 1000000, suspendOk: true } : { charge: 1, months: clamp(12 + Math.round((cs.amount || 0) / 20000000) * 6, 12, 48), suspendOk: true }),
  }),
  bribery_take: T({
    name: '収賄', short: '収賄',
    law: (g) => `収賄罪（刑法197条）：5年以下の${laborWord(g, 'choeki')}（請託を受けた受託収賄は7年以下）。受け取った賄賂は没収・追徴（197条の5）。在職中の収賄は公民権停止の対象`,
    severity: 4, kind: 'crime', political: true, bribery: true, civicBan: true, hotDays: 360,
    detect: () => 0,
    later: (g, h) => clamp(0.0025 * (1 + Math.log10(1 + (h.amount || 0) / 1000000)), 0, 0.03),
    penalty: (g, ctx = {}) => ({ prison: [1, ctx.request ? 84 : 60], labor: 'choeki', fine: null }),
    facts: (cs) => `その職務に関し、${cs.request !== false ? '請託を受けて、' : ''}業者から現金${fmtMoney(cs.amount || 1000000)}の供与を受けた`,
    typical: (g, cs) => ({ charge: 1, months: clamp(18 + Math.round((cs.amount || 0) / 5000000) * 6, 18, 60), suspendOk: true, tsuicho: cs.amount || 0 }),
  }),
  bribery_give: T({
    name: '贈賄', short: '贈賄',
    law: (g) => `贈賄罪（刑法198条）：3年以下の${laborWord(g, 'choeki')}又は${eraKey(g) === 'showa' ? '罰金' : '250万円以下の罰金'}`,
    severity: 3, kind: 'crime', hotDays: 360,
    detect: () => 0,
    later: (g, h) => clamp(0.0025 * (1 + Math.log10(1 + (h.amount || 0) / 1000000)), 0, 0.03),
    penalty: (g) => ({ prison: [1, 36], labor: 'choeki', fine: [10000, eraKey(g) === 'showa' ? 500000 : 2500000] }),
    facts: (cs) => `公務員に対し、その職務に関し、現金${fmtMoney(cs.amount || 1000000)}を供与した`,
    typical: (g, cs) => ((cs.amount || 0) < 2000000 ? { charge: 0.8, fine: 1000000, suspendOk: true } : { charge: 1, months: 12, suspendOk: true }),
  }),
  vote_buying: T({
    name: '買収（選挙）', short: '公職選挙法違反（買収）',
    law: (g) => `公職選挙法違反（買収罪・221条）：3年以下の${laborWord(g, 'both')}又は50万円以下の罰金。刑に処せられると公民権停止（252条）。秘書や総括主宰者の買収で候補者の当選が無効になる連座制（251条の2）も`,
    severity: 3, kind: 'crime', political: true, civicBan: true, hotDays: 40,
    detect: (g, ctx) => clamp(0.08 + 0.03 * Math.min(5, ctx.n || 0), 0.05, 0.4),
    later: (g, h) => 0.012 * (1 + Math.min(3, (h.n || 1) - 1) * 0.3),
    penalty: () => ({ prison: [1, 36], labor: 'both', fine: [10000, 500000] }),
    facts: (cs) => `選挙に関し、投票を得る目的で、選挙人らに現金${fmtMoney(cs.amount || 300000)}を供与した`,
    typical: (g, cs) => ((cs.amount || 0) < 500000 && !cs.priors ? { charge: 0.9, fine: 400000, suspendOk: true } : { charge: 1, months: 12 + 6 * Math.min(3, Math.floor((cs.amount || 0) / 3000000)), suspendOk: true }),
  }),
  door_to_door: T({
    name: '戸別訪問', short: '公職選挙法違反（戸別訪問）',
    law: (g) => `公職選挙法違反（戸別訪問の禁止・138条、罰則239条）：1年以下の${laborWord(g, 'kinko')}又は30万円以下の罰金。刑に処せられると公民権停止（252条）`,
    severity: 2, kind: 'crime', political: true, civicBan: true, hotDays: 20, warnFirst: true,
    detect: (g, ctx) => clamp(0.22 + 0.05 * Math.min(4, ctx.n || 0), 0.1, 0.5),
    later: () => 0.006,
    penalty: () => ({ prison: [1, 12], labor: 'kinko', fine: [10000, 300000] }),
    facts: () => '選挙に関し、投票を得る目的で、選挙人の家を一軒ずつ訪ねて投票を依頼した（戸別訪問）',
    typical: (g, cs) => ({ charge: cs.priors ? 0.9 : 0.6, fine: 200000, suspendOk: true }),
  }),
  underage_smoking: T({
    name: '未成年の喫煙', short: '喫煙（二十歳未満）',
    law: (g) => `${since(g, 2022, 4) ? '二十歳未満ノ者ノ喫煙ノ禁止ニ関スル法律' : '未成年者喫煙禁止法'}：本人への罰則はないが、たばこは没収され、補導される。知りながら止めなかった親権者は科料、売った店は50万円以下の罰金`,
    severity: 1, kind: 'hodo', hotDays: 7,
    detect: (g, ctx) => (ctx.private ? 0.03 : 0.14),
    later: (g) => 0.004 * famous(g, 1.5),
    penalty: () => ({ prison: null, fine: null }),
    facts: () => '二十歳未満で喫煙した',
  }),
  underage_drinking: T({
    name: '未成年の飲酒', short: '飲酒（二十歳未満）',
    law: (g) => `${since(g, 2022, 4) ? '二十歳未満ノ者ノ飲酒ノ禁止ニ関スル法律' : '未成年者飲酒禁止法'}：本人への罰則はないが、補導される。提供した店や止めなかった親権者は処罰の対象`,
    severity: 1, kind: 'hodo', hotDays: 7,
    detect: (g, ctx) => (ctx.private ? 0.03 : 0.12),
    later: (g) => 0.004 * famous(g, 1.5),
    penalty: () => ({ prison: null, fine: null }),
    facts: () => '二十歳未満で飲酒した',
  }),
  street_smoking: T({
    name: '路上喫煙', short: '路上喫煙（条例違反）',
    law: (g, ctx = {}) => `${(ctx.rule && ctx.rule.law) || '区や市の条例'}：路上喫煙禁止地区での喫煙は${(ctx.rule && ctx.rule.fine) ? `過料${man(ctx.rule.fine)}（行政上の罰で、前科にはならない）` : '指導の対象（過料はない）'}`,
    severity: 1, kind: 'admin', hotDays: 0,
    detect: (g, ctx) => (ctx.rule && ctx.rule.patrol != null ? ctx.rule.patrol : 0.15),
    later: () => 0,
    penalty: (g, ctx = {}) => ({ prison: null, fine: null, kare: (ctx.rule && ctx.rule.fine) || 0 }),
    facts: () => '路上喫煙禁止地区で喫煙した',
  }),
  antisocial_ties: T({
    name: '反社会的勢力との交際', short: '反社会的勢力との交際',
    law: (g) => (since(g, 2011, 10)
      ? '暴力団排除条例（2011年10月までに全都道府県で施行）：暴力団への利益供与は条例違反。交際そのものは犯罪ではないが、事務所や番組の契約にある「反社条項」で契約解除になる'
      : since(g, 1992, 3) ? '暴力団対策法（1992年施行）の時代。交際そのものは犯罪ではないが、発覚すれば仕事を失う' : '交際そのものは犯罪ではないが、発覚すれば世間の信用を失う'),
    severity: 3, kind: 'career', hotDays: 120,
    detect: () => 0,
    later: (g, h) => (g.state.fame < 250 && !isPolitician(g) ? 0.0005 : clamp(0.004 * famous(g, 2) * (1 + Math.min(3, (h.n || 1) - 1) * 0.25), 0, 0.03)),
    penalty: () => ({ prison: null, fine: null }),
    facts: () => '反社会的勢力と交際していた',
  }),
  drunk: T({
    name: '泥酔・迷惑行為', short: '酩酊防止法違反',
    law: () => '酒に酔つて公衆に迷惑をかける行為の防止等に関する法律（4条）：拘留又は科料。泥酔して動けなければ警察に保護される',
    severity: 1, kind: 'crime', hotDays: 0,
    detect: (g, ctx) => clamp(0.3 + 0.05 * Math.min(4, ctx.n || 0), 0.1, 0.6),
    later: () => 0,
    penalty: () => ({ prison: null, fine: null, kouryu: true, karyo: true }),
    facts: (cs) => `${cs.where || '駅前'}で、酒に酔って通行人に大声で絡むなどし、公衆に迷惑をかけた`,
    typical: (g, cs) => (cs.n >= 3 ? { charge: 0.5, fine: 9000, karyo: true } : { charge: 0, fine: 0 }),
  }),
  gambling: T({
    name: '賭博（闇カジノ等）', short: '賭博',
    law: (g) => `賭博罪（刑法185条）：${eraKey(g) === 'showa' ? '罰金' : '50万円以下の罰金'}又は科料。常習なら常習賭博罪（186条）：3年以下の${laborWord(g, 'choeki')}`,
    severity: 2, kind: 'crime', hotDays: 60,
    detect: (g, ctx) => clamp(0.05 + 0.01 * Math.min(5, ctx.n || 0), 0.03, 0.15),
    later: (g, h) => 0.004 * famous(g, 1.2) * (1 + Math.min(4, (h.n || 1) - 1) * 0.2),
    penalty: (g, ctx = {}) => ((ctx.n || 0) >= 4 ? { prison: [1, 36], labor: 'choeki', fine: null } : { prison: null, fine: [10000, eraKey(g) === 'showa' ? 50000 : 500000], karyo: true }),
    facts: () => '違法な賭博場で、現金を賭けて賭博をした',
    typical: (g, cs) => (cs.n >= 4 ? { charge: 0.9, months: 12, suspendOk: true, label: '常習賭博' } : { charge: 0.7, fine: 200000 }),
  }),
  drunk_driving: T({
    name: '飲酒運転', short: '道路交通法違反（酒気帯び運転）',
    law: (g) => `道路交通法違反（酒気帯び運転）：${since(g, 2007, 9) ? `3年以下の${laborWord(g, 'choeki')}又は50万円以下の罰金（酒酔い運転は5年以下又は100万円以下）` : since(g, 2002, 6) ? '1年以下の懲役又は30万円以下の罰金' : '3月以下の懲役又は5万円以下の罰金'}。免許の取消し・停止も`,
    severity: 2, kind: 'crime', hotDays: 0,
    detect: () => 0.2,
    later: () => 0,
    penalty: (g) => (since(g, 2007, 9) ? { prison: [1, 36], labor: 'choeki', fine: [10000, 500000] } : since(g, 2002, 6) ? { prison: [1, 12], labor: 'choeki', fine: [10000, 300000] } : { prison: [1, 3], labor: 'choeki', fine: [10000, 50000] }),
    facts: () => '酒気を帯びた状態で自動車を運転した',
    typical: (g, cs) => (cs.same ? { charge: 1, months: 6, suspendOk: true } : { charge: 0.95, fine: since(g, 2007, 9) ? 300000 : since(g, 2002, 6) ? 200000 : 40000 }),
  }),
  traffic_injury: T({
    name: '交通事故（人身）', short: '過失運転致傷',
    law: (g) => (since(g, 2014, 5) ? `過失運転致死傷罪（自動車運転死傷処罰法5条）：7年以下の${laborWord(g, 'both')}又は100万円以下の罰金`
      : since(g, 2007, 6) ? '自動車運転過失致死傷罪（刑法211条2項）：7年以下の懲役若しくは禁錮又は100万円以下の罰金'
        : `業務上過失致死傷罪（刑法211条）：5年以下の懲役若しくは禁錮又は${since(g, 2006, 5) ? '100万円' : eraKey(g) === 'showa' ? '' : '50万円'}以下の罰金`.replace('又は以下の罰金', '又は罰金')),
    severity: 2, kind: 'crime', hotDays: 0, victim: true,
    detect: () => 0.95,
    later: () => 0,
    penalty: (g) => ({ prison: [1, since(g, 2007, 6) ? 84 : 60], labor: 'both', fine: [10000, since(g, 2006, 5) ? 1000000 : 500000] }),
    facts: () => '自動車を運転中、前方の確認を怠って歩行者に衝突し、けがを負わせた',
    typical: (g, cs) => (cs.priors ? { charge: 0.9, months: 12, suspendOk: true, labor: 'kinko' } : { charge: 0.5, fine: 400000 }),
  }),
  account_sale: T({
    name: '口座の売却', short: '犯罪収益移転防止法違反',
    law: (g) => (since(g, 2026, 7) ? '犯罪収益移転防止法違反（預貯金通帳等の譲渡・26条）：3年以下の拘禁刑又は500万円以下の罰金（2026年7月10日から）'
      : since(g, 2011, 4) ? `犯罪収益移転防止法違反（預貯金通帳等の譲渡）：1年以下の${laborWord(g, 'choeki')}又は100万円以下の罰金`
        : '本人確認法・犯罪収益移転防止法違反（通帳の譲渡）：50万円以下の罰金'),
    exists: (g) => since(g, 2004, 12),
    severity: 2, kind: 'crime', hotDays: 90,
    detect: () => 0.02,
    later: () => 0.012,
    penalty: (g) => (since(g, 2026, 7) ? { prison: [1, 36], labor: 'choeki', fine: [10000, 5000000] } : since(g, 2011, 4) ? { prison: [1, 12], labor: 'choeki', fine: [10000, 1000000] } : { prison: null, fine: [10000, 500000] }),
    facts: () => '自分名義の預金通帳とキャッシュカードを、他人に有償で譲り渡した',
    typical: (g) => ({ charge: 0.9, fine: since(g, 2011, 4) ? 500000 : 300000, months: 0, suspendOk: true }),
  }),
  fraud_courier: T({
    name: '特殊詐欺の受け子', short: '詐欺',
    law: (g) => `詐欺罪（刑法246条）：10年以下の${laborWord(g, 'choeki')}（罰金刑はない）。特殊詐欺の「受け子」は初犯でも実刑になることが多い`,
    exists: (g) => since(g, 2003, 1),
    severity: 4, kind: 'crime', victim: true, hotDays: 60,
    detect: () => 0.35,
    later: () => 0.025,
    penalty: () => ({ prison: [1, 120], labor: 'choeki', fine: null }),
    facts: (cs) => `氏名不詳者らと共謀のうえ、高齢の被害者から現金${fmtMoney(cs.amount || 2000000)}をだまし取った（受け子）`,
    typical: (g, cs) => ({ charge: 1, months: 30 + 6 * Math.min(4, cs.priors), suspendOk: true, hard: true }),
  }),
  stolen_goods: T({
    name: '盗品の運搬', short: '盗品等運搬',
    law: (g) => `${since(g, 1995, 6) ? '盗品等運搬罪' : '贓物運搬罪'}（刑法256条2項）：10年以下の${laborWord(g, 'choeki')}及び${eraKey(g) === 'showa' ? '罰金' : '50万円以下の罰金'}`,
    severity: 3, kind: 'crime', hotDays: 60,
    detect: () => 0.15,
    later: () => 0.012,
    penalty: () => ({ prison: [1, 120], labor: 'choeki', fine: [10000, 500000], both: true }),
    facts: () => '盗品であることを知りながら、その運搬を引き受けた',
    typical: () => ({ charge: 0.95, months: 12, suspendOk: true, extraFine: 200000 }),
  }),
  cover_up: T({
    name: '証拠隠滅（もみ消し）', short: '証拠隠滅教唆',
    law: (g) => `証拠隠滅等罪（刑法104条）：${since(g, 2023, 6) ? `3年以下の${laborWord(g, 'choeki')}又は30万円以下の罰金` : '2年以下の懲役又は20万円以下の罰金'}。自分の事件の証拠を自分で隠しても罪にならないが、他人にやらせれば教唆犯になりうる`,
    severity: 2, kind: 'crime', hotDays: 120,
    detect: () => 0.05,
    later: () => 0.006,
    penalty: (g) => ({ prison: [1, since(g, 2023, 6) ? 36 : 24], labor: 'choeki', fine: [10000, since(g, 2023, 6) ? 300000 : 200000] }),
    facts: () => '自己の刑事事件に関する証拠を、関係者に依頼して隠滅させた',
    typical: () => ({ charge: 0.8, months: 12, suspendOk: true }),
  }),
  assen: T({
    name: '口利き（あっせん利得）', short: 'あっせん利得処罰法違反',
    law: (g) => `あっせん利得処罰法（2001年施行）：議員が公務員への口利きの見返りに報酬を受けると3年以下の${laborWord(g, 'choeki')}。報酬は没収・追徴`,
    exists: (g) => since(g, 2001, 3),
    severity: 3, kind: 'crime', political: true, hotDays: 300,
    detect: () => 0,
    later: (g, h) => clamp(0.002 * (1 + Math.log10(1 + (h.amount || 0) / 1000000)), 0, 0.02),
    penalty: () => ({ prison: [1, 36], labor: 'choeki', fine: null }),
    facts: (cs) => `公務員にその職務上の行為をさせるよう口利きをした見返りに、現金${fmtMoney(cs.amount || 1000000)}を受け取った`,
    typical: (g, cs) => ({ charge: 1, months: 12 + 6 * Math.min(3, Math.floor((cs.amount || 0) / 5000000)), suspendOk: true, tsuicho: cs.amount || 0 }),
  }),
};
export const CRIME_ORDER = Object.keys(CRIMES);
for (const [id, def] of Object.entries(CRIMES)) def.id = id;

// Text of the law in force (罪名・条文・法定刑).
export function crimeLaw(g, id, ctx) {
  const def = CRIMES[id];
  if (!def) return '';
  try { return def.law(g, ctx || {}); } catch (e) { console.error(e); return def.short || def.name; }
}
export function penaltyOf(g, id, ctx = {}) {
  const def = CRIMES[id];
  return def ? def.penalty(g, ctx) : { prison: null, fine: null };
}
// 公訴時効 in years for this offence at that date (刑訴法250条; the 2005 revision lengthened it).
export function limitYears(g, id, ctx = {}) {
  const p = penaltyOf(g, id, ctx);
  const hi = p.prison ? p.prison[1] : 0;
  if (!hi) return p.fine ? 3 : 1;
  if (since(g, 2005, 1)) return hi >= 180 ? 10 : hi >= 120 ? 7 : hi >= 60 ? 5 : 3;
  return hi >= 120 ? 7 : hi >= 60 ? 5 : 3;
}
const eraKey = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
// Famous people are recognised (cameras, witnesses) and chased by the weeklies.
function famous(g, k = 1) {
  const f = (g && g.state && g.state.fame) || 0;
  return 1 + k * (f >= 4000 ? 1 : f >= 1000 ? 0.6 : f >= 250 ? 0.3 : 0);
}

// ======================================================================== state
export function newJusticeState() {
  return {
    v: 1,
    status: 'free', // 'free' | 'detained' | 'trial' | 'prison' | 'probation'
    record: [], // { crime, day, outcome, years?, months?, fine?, suspend?, label, juvenile? }
    heat: {}, // crimeId -> { n, day, first, amount, injury, evidence }
    custody: null, // { crime, since, stage, caseId }
    prison: null, // { until, place, work, parole, start, days, behaviour, reward, kind, caseId }
    probationUntil: null,
    civicBanUntil: null,
    loans: [], // { id, lender, company, principal, interest, rate, due, missed, borrowed, cycle, status, harass, late }
    bankrupt: null, // { filed, discharged, until, stage, next, kind }
    smoker: 0, // habit 0..100
    flags: {},
    // --- extensions (justice core)
    cases: [], // open cases (在宅・保釈中・控訴中): see newCase()
    queue: [], // events that run right after the player wakes up (justiceEvents)
    career: { kinshinUntil: 0, tvBanUntil: 0, agencyBanUntil: 0, scandals: 0, lostFans: 0 },
    credit: { blackUntil: 0, bankBlackUntil: 0, accidents: 0 },
    income: [], // [day, amount] for the last YEAR_DAYS days (年収の推定)
    garnish: null, // { left, rate, by } 給料の差押え
    unpaid: 0, // unpaid 過料 / 増運賃 (collected from income later)
    suspendUntil: 0, // 執行猶予 ends
    supervision: false, // 保護観察付き
    smoke: { cigs: 0, day: 0, today: 0, yesterday: 0, load: 0, lost: 0, clean: 0, total: 0 },
    stats: { committed: {}, caught: {}, arrests: 0, convictions: 0, hodo: 0 },
    nextId: 1,
  };
}
const normalized = new WeakSet();
function normalizeJustice(j) {
  const d = newJusticeState();
  for (const k of Object.keys(d)) if (j[k] === undefined) j[k] = d[k];
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
  j.record = arr(j.record);
  j.loans = arr(j.loans).map((l) => ({ ...l, principal: Math.max(0, num(l.principal)), interest: Math.max(0, num(l.interest)), rate: Math.max(0, num(l.rate, l.lender === 'yamikin' ? 0.1 : l.lender === 'bank' ? 0.145 : 0.18)), due: num(l.due, 1), missed: Math.max(0, num(l.missed)), cycle: Math.max(1, num(l.cycle, MONTH_DAYS)), id: l.id || j.nextId++ }));
  j.cases = arr(j.cases);
  j.queue = arr(j.queue);
  j.heat = obj(j.heat);
  for (const k of Object.keys(j.heat)) { const h = obj(j.heat[k]); j.heat[k] = { ...h, n: Math.max(1, num(h.n, 1)), day: num(h.day, 1), first: num(h.first, num(h.day, 1)), amount: Math.max(0, num(h.amount)) }; }
  j.flags = obj(j.flags);
  j.career = { ...d.career, ...obj(j.career) };
  j.credit = { ...d.credit, ...obj(j.credit) };
  j.smoke = { ...d.smoke, ...obj(j.smoke) };
  j.stats = { ...d.stats, ...obj(j.stats) };
  j.stats.committed = obj(j.stats.committed);
  j.stats.caught = obj(j.stats.caught);
  j.income = Array.isArray(j.income) ? j.income.filter((x) => Array.isArray(x) && x.length === 2) : [];
  j.smoker = clamp(num(j.smoker), 0, 100);
  j.unpaid = Math.max(0, num(j.unpaid));
  j.nextId = Math.max(1, num(j.nextId, 1), ...j.loans.map((l) => num(l.id) + 1), ...j.cases.map((c) => num(c.id) + 1));
  if (!['free', 'detained', 'trial', 'prison', 'probation'].includes(j.status)) j.status = 'free';
  // a save made in the middle of a custody flow (should not happen: flows do not save) is released
  if ((j.status === 'detained' || j.status === 'trial') && !j.cases.some((c) => c.bail)) { j.status = 'free'; j.custody = null; }
  if (j.status === 'prison' && !j.prison) j.status = 'free';
  return j;
}
let polHooked = false;
function hookPolitics() {
  if (polHooked) return;
  polHooked = true;
  try {
    const on = POL.onPolitics;
    if (typeof on !== 'function') return;
    on('scandal', (g, rec) => {
      if (!g || !g.state || !rec || rec.who !== 'player' || !rec.crime || !CRIMES[rec.crime]) return;
      const h = addHeat(g, rec.crime, { amount: rec.amount || 0 });
      h.boost = Math.max(h.boost || 1, 4 + Math.max(0, (rec.severity || 3) - 3) * 2); // the prosecutors read the papers too
      h.weekly = true;
      h.n = Math.max(1, h.n - 1);
    });
  } catch (e) { polHooked = false; }
}
function J(g) {
  hookPolitics();
  const st = g.state;
  if (!st.justice || typeof st.justice !== 'object') st.justice = newJusticeState();
  if (!normalized.has(st.justice)) { normalizeJustice(st.justice); normalized.add(st.justice); }
  return st.justice;
}

// ======================================================================== hooks
const HOOKS = {};
// Events: 'arrested' 'convicted' 'released' 'acquitted' 'bankrupt' and also 'caught' 'exposed' 'fined'
// 'jailed' 'probation_end' 'hodo' 'scandal' 'loan' 'loan_missed' 'harassment' 'discharged' 'lost_office'
// 'not_indicted'. fn(g, info), may not be async (the flow does not wait).
export function onJustice(event, fn) { (HOOKS[event] || (HOOKS[event] = [])).push(fn); }
function emit(g, event, info = {}) {
  for (const fn of HOOKS[event] || []) {
    try { fn(g, info); } catch (e) { console.error(e); }
  }
}

// ======================================================================== politics (only if present)
function polState(g) {
  try { if (typeof g.pol === 'function') return g.pol(); } catch (e) { console.error(e); }
  return (g.state && g.state.politics) || null;
}
function nsGet(k) { try { return POL[k]; } catch (e) { return undefined; } }
export function isPolitician(g) { const p = polState(g); return !!(p && p.me && p.me.office); }
function officeLabel(g) {
  const p = polState(g);
  const o = p && p.me && p.me.office;
  if (!o) return '';
  const O = nsGet('OFFICES');
  return (O && O[o] && O[o].name) || '議員';
}
export function isDietMember(g) {
  const p = polState(g);
  const o = p && p.me && p.me.office;
  if (!o) return false;
  const O = nsGet('OFFICES');
  const d = O && O[o];
  if (d) return !!d.house || d.level === 'national';
  return /shugi|sangi|diet|kokkai|national/.test(String(o));
}
function dietInSession(g) {
  const p = polState(g);
  const s = p && p.diet && p.diet.session;
  if (!s) return false;
  const d = g.state.day;
  return (s.start == null || d >= s.start) && (s.end == null || d <= s.end);
}
// 失職: the politics core's own method when it has one, else the state directly.
function loseOffice(g, reason) {
  const p = polState(g);
  if (!p || !p.me || !p.me.office) return false;
  const name = officeLabel(g);
  let done = false;
  for (const k of ['loseOffice', 'resignOffice']) {
    if (typeof g[k] === 'function') {
      try { g[k](reason, { by: 'justice' }); done = !p.me.office; break; } catch (e) { console.error(e); }
    }
  }
  if (!done) {
    p.me.office = null;
    p.me.termEnd = null;
    p.me.posts = [];
    g.message({ from: '選挙管理委員会', kind: 'news', text: `${name}の職を失いました。（${reason}）` });
  }
  p.me.reputation = clamp(num(p.me.reputation) - 40, -100, 100);
  (p.flags || (p.flags = {})).lostOfficeBy = reason;
  emit(g, 'lost_office', { reason, office: name });
  return true;
}
function politicalHit(g, rep, support = 0) {
  const p = polState(g);
  if (!p || !p.me) return;
  p.me.reputation = clamp(num(p.me.reputation) - rep, -100, 100);
  if (support) p.me.localSupport = clamp(num(p.me.localSupport) - support, 0, 100);
}
// Leaving the party after an arrest (離党). Uses g.leaveParty() when present.
function leavePartyAfterScandal(g) {
  const p = polState(g);
  if (!p || !p.me || !p.me.party) return null;
  const party = p.parties && p.parties[p.me.party];
  if (party && party.isPlayers) return null; // your own party
  const name = (party && party.name) || '所属政党';
  if (typeof g.leaveParty === 'function') { try { g.leaveParty({ reason: 'scandal' }); } catch (e) { console.error(e); } }
  if (p.me.party) p.me.party = null;
  if (Array.isArray(p.me.posts)) p.me.posts = [];
  return name;
}

// ======================================================================== family
function family(g) {
  const st = g.state;
  const fam = sortFamily(((st.profile && st.profile.family) || []).filter((m) => m && m.alive !== false && RELATIONS[m.rel]));
  const first = ['mother', 'father', 'grandmother', 'grandfather', 'sister_older', 'brother_older', 'sister_younger', 'brother_younger'];
  return fam.sort((a, b) => first.indexOf(a.rel) - first.indexOf(b.rel));
}
const famKansai = (g) => { try { return regionOf(g.state.profile.hometown).dialect === 'kansai'; } catch (e) { return false; } };
const FAMILY_LINES = {
  arrested: ['ニュースを見て、心臓が止まるかと思った…。\n{name}、いまはしっかり自分のしたことと向き合いなさい。\nわたしたちは待ってるから。', 'ニュース見て、腰抜かしたわ…。\n{name}、自分のしたこととちゃんと向き合いや。\nうちらは待っとるからな。'],
  suspended: ['判決のこと、聞いたよ。\nもう二度とこんなことはしないって、約束して。\n困ったら、いつでも帰っておいで。', '判決のこと聞いたで。\nもう二度とせえへんって約束しい。\n困ったら、いつでも帰っておいでや。'],
  prison: ['手紙を書くからね。\n体に気をつけて、ちゃんと務めておいで。\n出てくる日は、迎えに行くから。', '手紙書くからな。\n体に気ぃつけて、ちゃんと務めておいで。\n出てくる日は迎えに行くで。'],
  released: ['おかえり。よく頑張ったね。\nこれからのことは、いっしょに考えよう。\nまずは、あったかいごはんを食べて。', 'おかえり。よう頑張ったな。\nこれからのことは一緒に考えよ。\nまずはあったかいごはん食べ。'],
  fined: ['罰金のこと、聞いたよ。\nちゃんと反省してるなら、それでいい。\n体だけは大事にしてね。', '罰金のこと聞いたで。\nちゃんと反省しとるんなら、それでええ。\n体だけは大事にしいや。'],
  hodo: ['警察から電話があったよ！\nタバコなんて二十歳になってから！\n…心配させないで。体を大事にしてね。', '警察から電話あったで！\nタバコなんか二十歳になってからや！\n…心配させんといて。体大事にしいや。'],
  hodo_drink: ['警察から電話があったよ！\nお酒は二十歳になってから！\n…心配させないでね。', '警察から電話あったで！\nお酒は二十歳になってからや！\n…心配させんといて。'],
  debt: ['知らない人から、取り立ての電話がうちにまで来たよ…。\nお金のこと、ひとりで抱えこまないで。\n警察か弁護士さんに相談して。', '知らん人から取り立ての電話がうちにまで来たで…。\nお金のこと、ひとりで抱えこんだらあかん。\n警察か弁護士さんに相談しい。'],
  bankrupt: ['破産のこと、聞いたよ。\nやり直せばいいんだから、気にしすぎないで。\nごはんはちゃんと食べてる？', '破産のこと聞いたで。\nやり直したらええねん、気にしすぎたらあかん。\nごはんちゃんと食べとる？'],
  scandal: ['週刊誌に名前が出てて、びっくりしたよ。\n本当のことを、ちゃんと話してね。\n味方だからね。', '週刊誌に名前出とって、びっくりしたわ。\nほんまのこと、ちゃんと話してや。\nうちらは味方やで。'],
  acquitted: ['無罪だって聞いて、涙が出たよ。\nよく耐えたね。\n今度ゆっくり帰っておいで。', '無罪やって聞いて、涙出たわ。\nよう耐えたな。\n今度ゆっくり帰っておいで。'],
};
function familyMessage(g, kind) {
  const m = family(g)[0];
  const lines = FAMILY_LINES[kind];
  if (!m || !lines) return false;
  const text = g.fmt(lines[famKansai(g) ? 1 : 0]);
  const def = PEOPLE[m.id];
  g.message({ from: def ? def.name : RELATIONS[m.rel].call, person: def ? m.id : undefined, family: m.id, look: def ? def.look : familyLook(m, g.state.look), kind: 'chat', text });
  return true;
}

// ======================================================================== speakers
const LK = {
  keiji: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#4a4a52', bottom: '#3a3a40', jacket: true, tie: '#7a2f2f' },
  keiji2: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#5a5248', bottom: '#3a3630', jacket: true, tie: '#2f4a7a', glasses: true },
  police: { hair: 'cap', hat: '#1e2a50', hairColor: 'black', skin: 'fair', top: '#2a3a6a', bottom: '#1e2a50', tie: '#14182a' },
  kenji: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a2c38', bottom: '#2a2c38', jacket: true, tie: '#5a5f6b', glasses: true },
  jimukan: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3a3e4a', bottom: '#2a2c38', jacket: true, skirt: true },
  judge: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#151518', bottom: '#151518', jacket: true, glasses: true },
  judge2: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#151518', bottom: '#151518', jacket: true },
  judge3: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#151518', bottom: '#151518', jacket: true },
  kokusen: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3a4a7a', bottom: '#2a3560', jacket: true, skirt: true },
  shisen: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#c9a227' },
  yameken: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#8a1a2c', glasses: true },
  keimukan: { hair: 'cap', hat: '#1e2a4a', hairColor: 'black', skin: 'fair', top: '#2a3a5a', bottom: '#1e2a4a', tie: '#20232a' },
  inmate: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#7a8078', bottom: '#5a6058' },
  hogoshi: { hair: 'bald', hairColor: 'white', skin: 'tan', top: '#6a5a4a', bottom: '#4a4038', jacket: true, glasses: true },
  tenchou: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2f9a4a', bottom: '#3b3f48', glasses: true },
  ekiin: { hair: 'cap', hat: '#2a4a8a', hairColor: 'black', skin: 'fair', top: '#2a4a8a', bottom: '#1e2a50', tie: '#d62f2f' },
  collector: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#5a1a2a', bottom: '#1e1e26', glasses: 'sun' },
  collector2: { hair: 'spiky', hairColor: 'blonde', skin: 'fair', top: '#1e1e26', bottom: '#2a2a2a' },
  chosakan: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3b3f48', bottom: '#3b3f48', jacket: true, tie: '#3a5a3a', glasses: true },
  kisha: { hair: 'cap', hat: '#5a4a3a', hairColor: 'brown', skin: 'tan', top: '#8a7a5a', bottom: '#4a4038' },
  soudan: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#3a4a7a', jacket: true },
  chosa: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#5a6a8a', bottom: '#3a4a6a', jacket: true, skirt: true },
};
const SP = {
  keiji: { name: '刑事', look: LK.keiji },
  keiji2: { name: '刑事', look: LK.keiji2 },
  police: { name: '警察官', look: LK.police },
  ryuchi: { name: '留置係', look: LK.police },
  kenji: { name: '検察官', look: LK.kenji },
  judge: { name: '裁判官', look: LK.judge },
  chief: { name: '裁判長', look: LK.judge },
  kokusen: { name: '国選弁護人', look: LK.kokusen },
  toban: { name: '当番弁護士', look: LK.kokusen },
  shisen: { name: '弁護士', look: LK.shisen },
  yameken: { name: '弁護士（元検事）', look: LK.yameken },
  keimukan: { name: '刑務官', look: LK.keimukan },
  hogoshi: { name: '保護司', look: LK.hogoshi },
  tenchou: { name: '店長', look: LK.tenchou },
  ekiin: { name: '駅員', look: LK.ekiin },
  collector: { name: '取り立ての男', look: LK.collector },
  yamikin: { name: '090金融', look: LK.collector },
  chosakan: { name: '税務調査官', look: LK.chosakan },
  satsu: { name: '査察官', look: LK.chosakan },
  kisha: { name: '週刊誌の記者', look: LK.kisha },
  soudan: { name: '相談員', look: LK.soudan },
  chosa: { name: '家裁調査官', look: LK.chosa },
  shinpan: { name: '裁判官（少年審判）', look: LK.judge2 },
  hasan: { name: '裁判官（破産）', look: LK.judge3 },
  kanzai: { name: '破産管財人', look: LK.shisen },
  shidoin: { name: '巡回指導員', look: { hair: 'cap', hat: '#ffd23f', hairColor: 'black', skin: 'tan', top: '#ffd23f', bottom: '#3b3f48' } },
};
const say = (g, who, text) => g.say(text, who ? { name: who.name, look: who.look } : {});
const ask = (g, who, text, choices, opts = {}) => g.ask(text, choices, { ...(who ? { name: who.name, look: who.look } : {}), ...opts });
const narrate = (g, text) => g.say(text);

// ======================================================================== HD stages (overlays)
// A full-screen backdrop for the justice scenes when no place is registered for them.
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function fig(c, look, x, y, dir = 'down', s = 2, frame = 0) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
  } catch (e) { /* sprites optional */ }
}
const playerLook = (g) => (g.state && g.state.look) || LOOKS.player;
const FLOOR_Y = 168;
function wallFloor(c, wall, wallLo, floor, floorLine) {
  R(c, 0, 0, SW, FLOOR_Y, wall);
  R(c, 0, FLOOR_Y - 34, SW, 34, wallLo);
  R(c, 0, FLOOR_Y - 35, SW, 1, '#00000040');
  R(c, 0, FLOOR_Y, SW, SH - FLOOR_Y, floor);
  for (let y = FLOOR_Y + 14; y < SH; y += 18) R(c, 0, y, SW, 1, floorLine);
  for (let x = 0; x < SW; x += 64) R(c, x + ((x / 64) % 2 ? 32 : 0), FLOOR_Y, 1, SH - FLOOR_Y, floorLine);
}
function windowBox(c, x, y, w, h, sky = '#9ccbe8', bars = false) {
  R(c, x - 3, y - 3, w + 6, h + 6, '#3a3e48');
  R(c, x, y, w, h, sky);
  R(c, x, y + h * 0.6, w, h * 0.4, '#b8dcef');
  if (bars) for (let i = 1; i < 5; i++) R(c, x + (w * i) / 5 - 1, y, 3, h, '#2a2e36');
  else { R(c, x + w / 2 - 1, y, 2, h, '#3a3e48'); R(c, x, y + h / 2 - 1, w, 2, '#3a3e48'); }
}
function desk(c, x, y, w, h, top = '#7a5a3a', front = '#5a3e26') {
  R(c, x, y, w, 6, top);
  R(c, x, y + 6, w, h - 6, front);
  R(c, x, y + 6, w, 1, '#00000050');
  R(c, x + 2, y + h, w - 4, 3, '#00000040');
}
function shelf(c, x, y, w, h) {
  R(c, x, y, w, h, '#5a3e26');
  const cols = ['#8a2f2f', '#2f4a8a', '#3a6a3a', '#7a6a3a', '#5a3a6a', '#2f2f2f'];
  for (let row = 0; row < Math.floor(h / 22); row++) {
    R(c, x + 3, y + 3 + row * 22, w - 6, 18, '#3a2818');
    for (let bx = x + 5; bx < x + w - 8; bx += 6) R(c, bx, y + 6 + row * 22, 5, 15, cols[(bx * 7 + row * 3) % cols.length]);
  }
}
function bars(c, x0, x1, y0, y1) {
  for (let x = x0; x < x1; x += 22) { R(c, x, y0, 5, y1 - y0, '#3a3e46'); R(c, x + 1, y0, 2, y1 - y0, '#7a808c'); }
  R(c, x0, y0 + 8, x1 - x0, 6, '#3a3e46');
  R(c, x0, y1 - 26, x1 - x0, 6, '#3a3e46');
}
const STAGES = {
  torishirabe(c, t, g, o) {
    wallFloor(c, '#8a8e96', '#6a6e78', '#4a4e58', '#3e424c');
    windowBox(c, 470, 38, 96, 56, '#a8c8e0', true);
    R(c, 300, 40, 26, 26, '#e8e8e0'); R(c, 312, 44, 2, 10, '#222'); R(c, 312, 52, 8, 2, '#222'); // clock
    fig(c, o.officer || LK.keiji, SW / 2 - 32, 96, 'down');
    desk(c, SW / 2 - 110, 160, 220, 40, '#8a8e86', '#5e625a');
    R(c, SW / 2 + 50, 146, 14, 14, '#2a2a2a'); R(c, SW / 2 + 44, 140, 26, 8, '#d8c060'); // lamp
    R(c, SW / 2 - 70, 152, 50, 8, '#e8e0c8'); // papers
    fig(c, playerLook(g), SW / 2 - 32, 190, 'up');
  },
  ryuchi(c, t, g, o) {
    wallFloor(c, o.wall || '#5a5e66', '#4a4e56', '#6e6c58', '#5e5c48');
    windowBox(c, 280, 30, 80, 30, '#6a8aa8', true);
    R(c, 70, 178, 120, 28, '#7a7f8a'); R(c, 70, 178, 120, 6, '#9aa0aa'); // folded futon
    R(c, 500, 120, 90, 90, '#4a4e56'); // toilet partition
    fig(c, playerLook(g), SW / 2 - 32, 150, 'down');
    bars(c, 0, SW, 0, 264);
  },
  kensatsu(c, t, g, o) {
    wallFloor(c, '#d8d4c8', '#b8b2a2', '#6a5a4a', '#5a4a3a');
    shelf(c, 30, 30, 140, 132);
    windowBox(c, 420, 34, 150, 70, '#a8d0f0');
    for (let y = 36; y < 102; y += 8) R(c, 420, y, 150, 3, '#e8e8e8'); // blinds
    fig(c, LK.kenji, SW / 2 - 32, 92, 'down');
    desk(c, SW / 2 - 100, 156, 200, 40);
    fig(c, LK.jimukan, 196, 120, 'right');
    R(c, 180, 168, 70, 30, '#7a5a3a'); R(c, 200, 150, 30, 20, '#2a2e36'); // clerk desk + pc
    fig(c, playerLook(g), SW / 2 - 32, 192, 'up');
  },
  houtei(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#8a6038');
    for (let x = 0; x < SW; x += 40) R(c, x, 0, 2, 120, '#7a5230');
    R(c, 0, 0, SW, 26, '#6a4426');
    // bench
    R(c, 110, 64, 420, 54, '#5a3a20'); R(c, 110, 64, 420, 6, '#9a6a40');
    const judges = o.judges === 3 ? [[SW / 2 - 132, LK.judge3], [SW / 2 - 32, LK.judge], [SW / 2 + 68, LK.judge2]] : [[SW / 2 - 32, LK.judge]];
    for (const [x, lk] of judges) fig(c, lk, x, 6, 'down');
    R(c, 110, 98, 420, 20, '#5a3a20');
    R(c, 220, 118, 200, 26, '#6a4426'); R(c, 220, 118, 200, 4, '#9a6a40'); // clerk
    R(c, 0, 140, SW, SH - 140, '#7a6a5a');
    for (let y = 150; y < SH; y += 16) R(c, 0, y, SW, 1, '#6a5a4a');
    fig(c, LK.kenji, 70, 120, 'right'); desk(c, 40, 170, 150, 34);
    fig(c, o.lawyer || LK.kokusen, 506, 120, 'left'); desk(c, 450, 170, 150, 34);
    R(c, SW / 2 - 30, 196, 60, 30, '#6a4426'); R(c, SW / 2 - 30, 196, 60, 4, '#9a6a40'); // 証言台
    fig(c, playerLook(g), SW / 2 - 32, 160, 'up');
    R(c, 0, 248, SW, 8, '#5a3a20'); // bar to the gallery
    for (let x = 30; x < SW; x += 56) { R(c, x, 256, 30, 18, '#3a3a44'); R(c, x + 6, 250, 18, 12, '#e0b890'); }
  },
  kasai(c, t, g, o) {
    wallFloor(c, '#e0dccc', '#c8c2b0', '#8a7a64', '#7a6a54');
    windowBox(c, 470, 36, 110, 60);
    R(c, 150, 140, 340, 60, '#9a7a52'); R(c, 150, 140, 340, 6, '#b89a6a'); // round-ish table
    fig(c, LK.judge2, SW / 2 - 32, 70, 'down');
    fig(c, LK.chosa, 120, 96, 'right');
    fig(c, playerLook(g), SW / 2 - 32, 186, 'up');
    const m = family(g)[0];
    if (m) fig(c, familyLook(m, playerLook(g)), SW / 2 + 70, 186, 'up');
  },
  menkai(c, t, g, o) {
    wallFloor(c, '#c8c4b8', '#aaa696', '#8a8478', '#7a7468');
    if (o.visitor) fig(c, o.visitor, SW / 2 - 32, 74, 'down');
    R(c, 60, 150, 520, 24, '#8a8070'); R(c, 60, 150, 520, 4, '#b0a890'); // counter
    c.fillStyle = 'rgba(200,230,255,0.25)'; c.fillRect(60, 20, 520, 130);
    R(c, 60, 20, 520, 3, '#d8e8f0'); R(c, 60, 20, 3, 130, '#d8e8f0'); R(c, 577, 20, 3, 130, '#d8e8f0');
    for (let i = 0; i < 9; i++) R(c, SW / 2 - 16 + (i % 3) * 14, 100 + Math.floor(i / 3) * 10, 3, 3, '#7a8a9a'); // speaking holes
    fig(c, playerLook(g), SW / 2 - 32, 170, 'up');
    if (o.guard) fig(c, LK.keimukan, 520, 168, 'left');
  },
  keimusho(c, t, g, o) {
    wallFloor(c, '#b8b8ae', '#9a9a90', '#7a7a70', '#6a6a60');
    for (let x = 40; x < SW; x += 150) windowBox(c, x, 20, 90, 40, '#b8d0e0', true);
    R(c, 520, 96, 100, 40, '#6a5a44'); fig(c, LK.keimukan, 538, 50, 'down'); // 担当台
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 120, y = 128 + row * 64;
        const me = row === 1 && i === 1;
        fig(c, me ? { ...playerLook(g), top: '#7a8078', bottom: '#5a6058', hat: undefined } : LK.inmate, x + 10, y - 40, 'up');
        R(c, x, y + 30, 100, 10, '#8a6a44'); R(c, x, y + 40, 100, 14, '#6a5034');
      }
    }
  },
  gate(c, t, g, o) {
    for (let y = 0; y < 150; y++) R(c, 0, y, SW, 1, `rgb(${150 + y * 0.5},${190 + y * 0.3},${230})`);
    R(c, 0, 60, SW, 110, '#b8b4a8'); R(c, 0, 60, SW, 6, '#d0ccc0');
    for (let x = 0; x < SW; x += 48) R(c, x, 66, 1, 104, '#a09c90');
    R(c, SW / 2 - 90, 80, 180, 90, '#5a5e66'); R(c, SW / 2 - 2, 80, 4, 90, '#3a3e46');
    for (let x = SW / 2 - 86; x < SW / 2 + 90; x += 12) R(c, x, 84, 2, 82, '#4a4e56');
    R(c, 0, 170, SW, SH - 170, '#8a8a82'); R(c, 0, 210, SW, 3, '#e8e8e0');
    fig(c, playerLook(g), SW / 2 - 32, 178, 'down');
    if (o.welcome) fig(c, o.welcome, SW / 2 + 60, 182, 'left');
  },
  genkan(c, t, g, o) {
    for (let y = 0; y < 100; y++) R(c, 0, y, SW, 1, `rgb(${60 + y},${80 + y},${130 + y * 0.8})`);
    R(c, 0, 100, SW, 70, '#c8b89a'); R(c, 0, 100, SW, 4, '#e0d4b8');
    R(c, 260, 72, 90, 98, '#7a5a3a'); R(c, 264, 76, 82, 94, '#8a6a44'); R(c, 334, 120, 6, 6, '#d8c060'); // door
    R(c, 0, 170, SW, SH - 170, '#9a9a90');
    fig(c, LK.keiji, 380, 120, 'left');
    fig(c, LK.keiji2, 440, 124, 'left');
    fig(c, LK.police, 500, 128, 'left');
    if (!o.noPlayer) fig(c, playerLook(g), 268, 118, 'down');
    text(c, o.clock || '午前6時', SW - 90, 44, { size: 14, color: '#fff' });
  },
  store(c, t, g, o) {
    wallFloor(c, '#e8e4d8', '#c8c2b0', '#9a9a90', '#8a8a80');
    for (let i = 0; i < 4; i++) { R(c, 380 + (i % 2) * 90, 30 + Math.floor(i / 2) * 60, 80, 50, '#20232a'); R(c, 384 + (i % 2) * 90, 34 + Math.floor(i / 2) * 60, 72, 42, i === (t >> 5) % 4 ? '#5a7a6a' : '#3a5a4a'); }
    fig(c, o.officer || LK.tenchou, 150, 100, 'right');
    desk(c, 120, 168, 260, 30, '#c8c8c0', '#9a9a92');
    fig(c, playerLook(g), 270, 120, 'left');
  },
  eki(c, t, g, o) {
    wallFloor(c, '#d8dce4', '#b8bcc8', '#7a7e88', '#6a6e78');
    R(c, 40, 30, 200, 80, '#2a3a6a'); for (let i = 0; i < 5; i++) R(c, 50, 40 + i * 14, 180, 8, '#d8d040'); // timetable
    desk(c, 100, 168, 440, 26, '#a8acb4', '#7a7e88');
    fig(c, LK.ekiin, 300, 96, 'down');
    fig(c, playerLook(g), 300, 196, 'up');
  },
  bengoshi(c, t, g, o) {
    wallFloor(c, '#e8e0d0', '#c8bea8', '#5a4a3a', '#4a3a2a');
    shelf(c, 20, 26, 180, 136); shelf(c, 440, 26, 180, 136);
    fig(c, o.lawyer || LK.shisen, SW / 2 - 32, 96, 'down');
    desk(c, SW / 2 - 110, 160, 220, 36, '#6a4a2a', '#4a3020');
    fig(c, playerLook(g), SW / 2 - 32, 192, 'up');
  },
  yamikin(c, t, g, o) {
    wallFloor(c, '#3a3436', '#2a2426', '#3a3a3a', '#2a2a2a');
    windowBox(c, 420, 30, 150, 70, '#2a3048');
    for (let y = 32; y < 98; y += 6) R(c, 420, y, 150, 3, '#1a1a1a');
    R(c, 60, 150, 200, 40, '#141414'); R(c, 60, 140, 200, 14, '#202020'); // sofa
    fig(c, LK.collector, 320, 100, 'down');
    fig(c, LK.collector2, 420, 108, 'left');
    fig(c, playerLook(g), 300, 190, 'up');
  },
  door(c, t, g, o) {
    for (let y = 0; y < 100; y++) R(c, 0, y, SW, 1, `rgb(${30 + y * 0.3},${30 + y * 0.3},${50 + y * 0.4})`);
    R(c, 0, 100, SW, 70, '#a89a7a'); R(c, 260, 72, 90, 98, '#5a4a3a');
    R(c, 0, 170, SW, SH - 170, '#6a6a62');
    fig(c, LK.collector, 380, 120, 'left'); fig(c, LK.collector2, 440, 124, 'left');
    fig(c, playerLook(g), 268, 118, 'down');
  },
  hearing(c, t, g, o) {
    wallFloor(c, '#e4e0d4', '#c4beae', '#7a6a58', '#6a5a48');
    R(c, 140, 140, 360, 50, '#8a6a44'); R(c, 140, 140, 360, 5, '#aa8a5a');
    fig(c, o.judge || LK.judge3, SW / 2 - 32, 74, 'down');
    if (o.second) fig(c, o.second, 150, 90, 'right');
    fig(c, playerLook(g), SW / 2 - 32, 180, 'up');
    if (o.lawyer) fig(c, o.lawyer, SW / 2 + 60, 180, 'up');
  },
  chosa(c, t, g, o) {
    wallFloor(c, '#dcd8cc', '#bcb6a6', '#7a7468', '#6a6458');
    R(c, 90, 140, 460, 44, '#7a5a3a'); R(c, 90, 140, 460, 5, '#9a7a4a');
    for (let i = 0; i < 4; i++) { R(c, 120 + i * 30, 112 - (i % 2) * 10, 26, 28 + (i % 2) * 10, '#b89a6a'); R(c, 120 + i * 30, 112 - (i % 2) * 10, 26, 3, '#d8b88a'); }
    fig(c, LK.chosakan, 330, 72, 'down'); fig(c, LK.chosa, 420, 76, 'down');
    fig(c, playerLook(g), 360, 186, 'up');
  },
  press(c, t, g, o) {
    wallFloor(c, '#2a2a3a', '#20202c', '#3a3a44', '#2e2e38');
    R(c, 160, 40, 320, 60, '#3a4a7a'); R(c, 164, 44, 312, 52, '#2e3c66');
    text(c, o.banner || '会見', SW / 2, 58, { size: 16, align: 'center', color: '#e8ecff', shadow: null });
    fig(c, playerLook(g), SW / 2 - 32, 104, 'down');
    for (let i = 0; i < 7; i++) {
      fig(c, i % 2 ? LK.kisha : { ...LK.kisha, top: '#3a3a3a', hat: '#2a2a2a' }, 40 + i * 84, 196, 'up');
      if (((t >> 3) + i * 3) % 7 === 0) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(56 + i * 84, 186, 30, 20); }
    }
  },
  kouban(c, t, g, o) {
    wallFloor(c, '#d8d4c4', '#b8b2a0', '#8a8a80', '#7a7a70');
    R(c, 40, 30, 160, 100, '#e8e8d8'); for (let i = 0; i < 6; i++) R(c, 50 + i * 24, 40, 18, 80, ['#c8e0c0', '#e0d8b0', '#c0d0e8'][i % 3]); // area map
    R(c, 500, 30, 40, 30, '#d62f2f'); // red lamp
    desk(c, 220, 160, 220, 32, '#8a8e86', '#5e625a');
    fig(c, o.officer || LK.police, 300, 96, 'down');
    fig(c, playerLook(g), 300, 194, 'up');
  },
  street(c, t, g, o) {
    for (let y = 0; y < 120; y++) R(c, 0, y, SW, 1, o.night ? `rgb(${20 + y * 0.2},${24 + y * 0.2},${48 + y * 0.3})` : `rgb(${150 + y * 0.4},${190 + y * 0.3},230)`);
    for (let i = 0; i < 6; i++) R(c, i * 110, 30 + (i % 3) * 14, 100, 100 - (i % 3) * 14, o.night ? '#2a2a3a' : '#a8a8b0');
    R(c, 0, 130, SW, 40, '#9a9a92'); R(c, 0, 170, SW, SH - 170, '#5a5a62');
    fig(c, o.officer || SP.shidoin.look, 380, 116, 'left');
    fig(c, playerLook(g), 300, 112, 'right');
  },
};
// A stage behind the dialogue. opts: { title, sub, officer, lawyer, visitor, guard, judges, welcome, wall, night }
export class StageScene {
  constructor(g, kind, opts = {}) {
    Object.assign(this, { g, kind, opts, t: 0, hd: true, opaque: true, hidesHud: true });
  }
  update() { this.t++; }
  draw(ctx, g) {
    const fn = STAGES[this.kind] || STAGES.torishirabe;
    try { fn(ctx, this.t, g, this.opts); } catch (e) { console.error(e); }
    const title = this.opts.title;
    if (title) {
      const w = Math.min(SW - 24, Math.max(measure(ctx, title, 16), measure(ctx, this.opts.sub || '', 12)) + 28);
      panel(ctx, 8, 8, w, this.opts.sub ? 50 : 32, { bg: '#1a1f38' });
      text(ctx, title, 22, 15, { size: 16, color: COLORS.accent });
      if (this.opts.sub) text(ctx, this.opts.sub, 22, 36, { size: 12, color: '#d8dcf0' });
    }
    const st = g.state;
    if (st) {
      const d = lawDate(g);
      const label = `${wareki(d.year, d.month)}　${g.dayLabel()}`;
      const w = measure(ctx, label, 12) + 20;
      panel(ctx, SW - w - 8, 8, w, 26, { bg: '#1a1f38' });
      text(ctx, label, SW - w + 2, 14, { size: 12, color: '#d8dcf0' });
    }
  }
}
// "― 10日後 ―" card while days pass in custody.
class DaysCard {
  constructor(g, label, sub, resolve) { Object.assign(this, { g, label, sub, resolve, t: 0, hd: true, hidesHud: true }); }
  update(g) {
    this.t++;
    if (g.auto || this.t > 80 || (this.t > 12 && (g.input.pressed('a') || g.input.pressed('b')))) { g.pop(this); this.resolve(); }
  }
  draw(ctx) {
    const a = Math.min(1, this.t / 10);
    ctx.globalAlpha = a * 0.92;
    R(ctx, 0, 0, SW, SH, '#05060c');
    ctx.globalAlpha = a;
    text(ctx, this.label, SW / 2, SH / 2 - 22, { size: 16, align: 'center', color: '#ffffff' });
    if (this.sub) text(ctx, this.sub, SW / 2, SH / 2 + 6, { size: 12, align: 'center', color: '#9aa3c7' });
    ctx.globalAlpha = 1;
  }
}
function daysCard(g, label, sub) { return new Promise((r) => g.push(new DaysCard(g, label, sub, r))); }

// Justice places built by other modules (registered with registerPlace). A flow teleports there
// when the place exists; set rooms[stage] to a room id of the place for each stage.
export const JUSTICE_PLACES = {
  police: { place: 'keisatsu', rooms: {} }, // torishirabe, ryuchi, kouban
  prosecutor: { place: 'kensatsu', rooms: {} }, // kensatsu
  court: { place: 'saibansho', rooms: {} }, // houtei, kasai, hearing, menkai (拘置所)
  prison: { place: 'keimusho', rooms: {} }, // keimusho, menkai, gate
};
const STAGE_INSTITUTION = {
  torishirabe: 'police', ryuchi: 'police', kouban: 'police',
  kensatsu: 'prosecutor', houtei: 'court', kasai: 'court', hearing: 'court',
  keimusho: 'prison', gate: 'prison',
};
const SKIP_GOTO = new Set(['menkai']); // the visiting room stays an overlay (it shows the visitor)

// ======================================================================== flows
// One justice flow: the stage (a registered place via g.goto, else an HD overlay), days passing in
// custody, and where the player ends up (home after custody; where they were for small things).
class Flow {
  constructor(g) {
    this.g = g;
    this.stage = null;
    this.fromMap = g.scenes.length >= 1 && g.scenes[g.scenes.length - 1] === g.map && !!g.map.place;
    this.moved = false;
  }
  async show(kind, opts = {}) {
    const g = this.g;
    const inst = STAGE_INSTITUTION[kind];
    const jp = inst && JUSTICE_PLACES[inst];
    if (this.fromMap && jp && PLACES[jp.place] && !SKIP_GOTO.has(kind) && !opts.overlay) {
      if (this.stage) { g.pop(this.stage); this.stage = null; }
      const place = PLACES[jp.place];
      const room = jp.rooms[kind];
      const target = room && place.rooms && place.rooms[room] ? room : undefined;
      if (g.map.placeId !== jp.place || (target && g.map.roomId !== target)) {
        await g.goto(jp.place, target);
        this.moved = true;
      }
      if (opts.title) g.showBanner(opts.title);
      return;
    }
    if (this.stage && g.scenes.includes(this.stage)) { this.stage.kind = kind; this.stage.opts = opts; this.stage.t = 0; return; }
    this.stage = g.push(new StageScene(g, kind, opts));
  }
  hide() { if (this.stage) { this.g.pop(this.stage); this.stage = null; } }
  // home: true after custody (the player is let out and goes home).
  async end({ home = false } = {}) {
    const g = this.g;
    this.hide();
    if (this.fromMap && (home || this.moved)) await goHome(g);
    if (this.fromMap && g.map.place) g.save(true);
  }
}
async function goHome(g) {
  try {
    const h = g.housing();
    const place = PLACES[h.place] ? h.place : PLACES.home ? 'home' : null;
    if (place) await g.goto(place, h.room);
  } catch (e) { console.error(e); }
}
function placeName(g) {
  const p = g.map && g.map.place;
  return (p && p.name) || '店';
}
const courtCity = (g) => (/namba|osaka|mbs|ktv|shinkigeki|shochiku|takoyaki|hotel/.test(String(g.map && g.map.placeId)) ? '大阪' : '東京');
const policeName = (g) => (PLACES.keisatsu && PLACES.keisatsu.name) || '警察署';
const prisonName = (g) => (PLACES.keimusho && PLACES.keimusho.name) || '刑務所';

// One day inside (留置場・拘置所・刑務所・労役場・少年院): the day goes on without the content's
// morning hooks (no phone inside). Rent is charged on Mondays while detained (a lease is
// cancelled when a prison term begins: see enterPrison).
async function custodyDay(g, mode = 'detained') {
  const st = g.state, j = J(g), L = st.life;
  st.day++;
  if (isBirthday(st)) { const f = birthdayFlag(ageOf(st)); if (!st.flags[f]) { st.flags[f] = true; j.flags.insideBirthday = ageOf(st); } }
  L.hunger = clamp(Math.max(L.hunger, 50), 0, 70);
  L.clean = mode === 'prison' ? 60 : clamp(L.clean - 5, 35, 100);
  L.stress = clamp(L.stress + (mode === 'prison' ? (L.stress > 45 ? -2 : 1) : 3), 0, 92);
  L.workDay = st.day; // no rest-day bonus inside
  st.stamina = st.maxStamina;
  if (mode === 'prison') st.rent.paidWeek = weekOf(st.day);
  else if (((st.day - 1) % 7) === 0 && st.rent.paidWeek < weekOf(st.day)) { try { g.chargeRent(); } catch (e) { console.error(e); } }
  if (mode === 'prison' && st.fans > 0) st.fans = Math.max(0, st.fans - Math.ceil(st.fans * 0.001));
  loanTick(g, { inside: true });
  heatCool(g);
  if (typeof g.politicsTick === 'function') {
    try { const r = g.politicsTick(g, { inside: true }); if (r && typeof r.then === 'function') await r; } catch (e) { console.error(e); }
  }
}
// n days inside, with a card ("― 10日後 ―") unless opts.card === false.
async function passDays(g, n, opts = {}) {
  n = Math.max(0, Math.round(n));
  for (let i = 0; i < n; i++) await custodyDay(g, opts.mode);
  if (n > 0 && opts.card !== false) await daysCard(g, opts.label || `― ${n}日後 ―`, opts.sub || g.dayLabel());
}

// ---------------------------------------------------------------- cases
function priorsOf(g, crime) {
  const r = J(g).record.filter((x) => ['fine', 'suspended', 'prison'].includes(x.outcome) && !x.juvenile);
  return { priors: r.length, same: r.filter((x) => x.crime === crime).length };
}
function newCase(g, crime, ctx = {}) {
  const j = J(g), st = g.state;
  const age = ageOf(st);
  const { priors, same } = priorsOf(g, crime);
  const hist = j.record.filter((x) => x.crime === crime && ['bizai', 'not_indicted', 'juvenile_kan', 'juvenile_fusho', 'warning', 'zoun', 'hogo'].includes(x.outcome)).length; // 前歴
  const cs = {
    id: j.nextId++, crime, day: ctx.day ?? st.day, opened: st.day,
    amount: Math.max(0, Math.round(num(ctx.amount))), injury: !!ctx.injury, request: ctx.request,
    evidence: clamp(num(ctx.evidence, ctx.via === 'genkouhan' ? 0.95 : 0.75), 0, 1), via: ctx.via || 'warrant',
    where: ctx.where || placeName(g), n: Math.max(1, num(ctx.n, num(j.stats.committed[crime], 1))),
    juvenile: age < 20, specific: age >= 18 && age < 20 && since(g, 2022, 4), age,
    lawyer: null, plea: null, remorse: 0, jidan: false, detained: false, custodyDays: 0, bail: null,
    stage: 'arrest', priors, same, hist, appeals: 0, fame: st.fame, politician: isPolitician(g),
    coverUp: !!(j.heat.cover_up && j.heat.cover_up.of === crime), label: ctx.label || null,
  };
  j.cases.push(cs);
  return cs;
}
function closeCase(g, cs, outcome) {
  const j = J(g);
  cs.closed = true;
  cs.outcome = outcome;
  j.cases = j.cases.filter((c) => c !== cs && !c.closed);
  if (j.custody && j.custody.caseId === cs.id) j.custody = null;
  delete j.heat[cs.crime];
}
// Fictional surnames for the people of a case (never real persons).
const SURNAMES = ['高村', '三浦', '片山', '早瀬', '石丸', '久保田', '永井', '浅野', '宮本', '杉浦', '岡部', '小野寺'];
const surname = (g, k = 0) => SURNAMES[(Math.abs(Math.round(num(g.state.day) * 7 + k * 13 + num(J(g).nextId) * 3))) % SURNAMES.length];
const LAWYER_Q = { none: 0, toban: 0.15, kokusen: 0.45, shisen: 0.72, yameken: 0.9 };
const lawyerQ = (cs) => LAWYER_Q[cs.lawyer || 'none'] || 0;
const lawyerSp = (cs) => (cs.lawyer === 'yameken' ? SP.yameken : cs.lawyer === 'shisen' ? SP.shisen : cs.lawyer === 'toban' ? SP.toban : SP.kokusen);
const lawyerLook = (cs) => lawyerSp(cs).look;
// 被疑者国選 (before indictment): 2006-10 (重い事件) → 2009-05 (長期3年超) → 2018-06 (勾留された全事件).
function suspectKokusen(g, cs) {
  const p = penaltyOf(g, cs.crime, cs);
  if (since(g, 2018, 6)) return true;
  if (since(g, 2009, 5)) return !!(p.prison && p.prison[1] > 36);
  if (since(g, 2006, 10)) return !!(p.prison && p.prison[0] >= 12);
  return false;
}
const tobanOk = (g) => since(g, 1992, 10); // 当番弁護士: 1990年に始まり、1992年10月までに全国へ
function lawyerFee(g, cs, kind) {
  const sev = CRIMES[cs.crime].severity;
  if (kind === 'yameken') return 1500000 + sev * 500000;
  return 300000 + sev * 100000 + (cs.plea === 'deny' ? 300000 : 0);
}
const inSuspension = (g) => J(g).suspendUntil > g.state.day;
function recentPrison(g, yrs) {
  const day = g.state.day;
  return J(g).record.some((r) => r.outcome === 'prison' && !r.juvenile && day - (r.release || r.day) < years(yrs));
}
function typicalOf(g, cs) {
  const def = CRIMES[cs.crime];
  try { return (def.typical && def.typical(g, cs)) || { charge: 0.8, months: 12, suspendOk: true }; } catch (e) { console.error(e); return { charge: 0.8, months: 12, suspendOk: true }; }
}
function mitigation(g, cs) {
  let m = 0;
  if (cs.plea === 'admit') m += 0.6; else if (cs.plea === 'deny') m -= 0.6;
  m += (cs.remorse || 0) * 0.4;
  if (cs.jidan) m += 1.2;
  m += lawyerQ(cs);
  if (cs.witness) m += 0.4;
  if (cs.sanctioned) m += 0.3; // 社会的制裁（報道・解雇・失職）
  m -= cs.priors * 0.7;
  if (inSuspension(g)) m -= 0.8;
  if (cs.coverUp) m -= 0.8;
  return m;
}
const round1 = (n, unit = 10000) => Math.max(unit, Math.round(n / unit) * unit);
// The sentence a court would give (and the 求刑, about a quarter more).
function computeSentence(g, cs) {
  const pen = penaltyOf(g, cs.crime, cs);
  const t = typicalOf(g, cs);
  const m = mitigation(g, cs);
  let months = t.months || 0;
  let fineAmt = pen.fine || pen.karyo ? t.fine || 0 : 0;
  if (!months && !fineAmt) months = pen.prison ? Math.max(pen.prison[0], 6) : 0;
  if (!months && !fineAmt && pen.karyo) fineAmt = 9000;
  if (months && pen.prison) {
    months = Math.round(months * clamp(1 - 0.1 * m, 0.55, 1.5));
    let min = pen.prison[0];
    if (m >= 1.5 && (t.reducible || min >= 12)) min = Math.ceil(min / 2); // 酌量減軽（刑法66・68条）
    months = clamp(months, min, pen.prison[1]);
  } else months = 0;
  if (!months && fineAmt) {
    const lo = pen.fine ? pen.fine[0] : 1000, hi = pen.fine ? pen.fine[1] : 9900;
    fineAmt = clamp(fineAmt >= 10000 ? round1(fineAmt * (1 - 0.08 * m)) : Math.round(fineAmt), lo, hi);
  }
  let suspend = 0, supervision = false;
  if (months) {
    const again = inSuspension(g);
    const ok = months <= 36 && t.suspendOk !== false && !recentPrison(g, 5) && (!again || (months <= (kokinEra(g) ? 24 : 12) && m >= 1));
    const p = ok ? clamp(0.55 + 0.15 * m - (t.hard ? 0.35 : 0) - 0.12 * cs.priors, 0.02, 0.97) : 0;
    if (roll(g, p)) {
      suspend = months <= 12 ? 3 : months <= 24 ? 4 : 5;
      supervision = again || cs.priors >= 1;
    }
  }
  const extraFine = months && t.extraFine && pen.fine ? clamp(round1(t.extraFine), pen.fine[0], Math.max(pen.fine[1], t.extraFine)) : 0;
  const labor = t.labor || pen.labor || 'choeki';
  const kind = months ? (suspend ? 'suspended' : 'prison') : 'fine';
  return { kind, months, fine: months ? 0 : fineAmt, extraFine, suspend, supervision, tsuicho: t.tsuicho || 0, labor, karyo: !months && fineAmt < 10000, label: t.label || null };
}
function demandOf(g, sen) {
  if (sen.kind === 'fine') return `罰金${fmtMoney(round1(sen.fine * 1.2, sen.fine < 10000 ? 1000 : 10000))}`;
  return `${laborWord(g, sen.labor)}${fmtTerm(Math.round((sen.months * 1.25) / 2) * 2)}`;
}
export function sentenceText(g, sen) {
  if (!sen) return '';
  if (sen.kind === 'fine') return `${sen.karyo ? '科料' : '罰金'}${fmtMoney(sen.fine)}`;
  let s = `${laborWord(g, sen.labor)}${fmtTerm(sen.months)}`;
  if (sen.suspend) s += `、執行猶予${sen.suspend}年${sen.supervision ? '（保護観察付き）' : ''}`;
  if (sen.extraFine) s += `及び罰金${fmtMoney(sen.extraFine)}`;
  return s;
}
function addRecord(g, cs, outcome, extra = {}) {
  const j = J(g);
  const rec = { crime: cs.crime, day: g.state.day, outcome, court: cs.court || null, juvenile: !!extra.juvenile, ...extra };
  j.record.push(rec);
  if (j.record.length > 60) j.record.splice(0, j.record.length - 60);
  return rec;
}

// ======================================================================== consequences
function news(g, text, from = 'ニュース') { g.message({ from, kind: 'news', text: g.fmt(text) }); }
const knownFigure = (g) => g.state.fame >= 100 || isPolitician(g);
function whoInNews(g, word = '容疑者') {
  const st = g.state;
  if (isPolitician(g)) return `${officeLabel(g)}の{fullname}${word}（${ageOf(st)}）`;
  return `タレントの{fullname}${word}（${ageOf(st)}）`;
}
// The entertainment career after a scandal or a case.
// level 1 小さな騒ぎ / 2 スキャンダル（週刊誌・書類送検・罰金・補導の報道）/ 3 逮捕 / 4 有罪（執行猶予）/ 5 実刑
// info: { crime, extraDays (days inside before the comeback can start), force, quiet }
export function careerSanction(g, level, info = {}) {
  const st = g.state, j = J(g), day = st.day;
  level = clamp(Math.round(level), 1, 5);
  const def = info.crime && CRIMES[info.crime];
  const sev = def ? def.severity : 2;
  const res = { level, fansLost: 0, fameLost: 0, dropped: [], agency: null, kinshinUntil: j.career.kinshinUntil, tvBanUntil: j.career.tvBanUntil };
  if (!knownFigure(g) && !info.force && level < 4) return res;
  const fanK = [0, 0.03, 0.12, 0.25, 0.35, 0.5][level] * (info.soft ? 0.6 : 1);
  const fameK = [0, 0.02, 0.08, 0.18, 0.25, 0.4][level] * (info.soft ? 0.6 : 1);
  res.fansLost = Math.round(st.fans * fanK);
  res.fameLost = Math.round(st.fame * fameK);
  g.addFans(-res.fansLost, true);
  g.addFame(-res.fameLost, true);
  j.career.lostFans = (j.career.lostFans || 0) + res.fansLost;
  const dropAll = level >= 3 || (info.crime === 'antisocial_ties');
  for (const id of Object.keys(st.regulars || {})) {
    const s = st.regulars[id];
    if (!s || s.dropped || s.since == null) continue;
    if (dropAll || (level === 2 && roll(g, 0.5))) { s.dropped = true; res.dropped.push(id); }
  }
  if (res.dropped.length) {
    const titles = res.dropped.map((id) => (REGULARS[id] && REGULARS[id].title) || '番組').slice(0, 3).map((t) => `『${t}』`).join('');
    g.message({ from: 'プロデューサー', kind: 'news', text: `今回の件を受けて、${titles}${res.dropped.length > 3 ? 'など' : ''}への出演は見合わせることになりました。` });
  }
  const ag = st.agency && AGENCIES[st.agency];
  const terminate = ag && (info.crime === 'antisocial_ties' || (level >= 4 && sev >= 2) || (level >= 3 && sev >= 3) || (level >= 3 && j.career.scandals >= 1) || level >= 5);
  if (terminate) {
    res.agency = st.agency;
    g.message({ from: ag.name, kind: 'news', text: g.fmt(`{fullname}さんとのマネジメント契約を、本日付で解除いたしました。関係者の皆さまに深くお詫び申し上げます。`) });
    st.agency = null;
  } else if (ag && level >= 2) {
    g.message({ from: ag.name, kind: 'news', text: `しばらくの間、芸能活動を自粛してもらいます。\n今後のことは、落ち着いてから話しましょう。` });
  }
  const extra = Math.max(0, num(info.extraDays));
  const kin = [0, 0, 14, 45, 60, 0][level];
  const tv = [0, 0, 30, 90, years(1), years(1.5)][level];
  const agb = [0, 0, 0, 60, years(1), years(1.5)][level];
  if (kin) j.career.kinshinUntil = Math.max(j.career.kinshinUntil || 0, day + extra + kin);
  if (tv) j.career.tvBanUntil = Math.max(j.career.tvBanUntil || 0, day + extra + tv);
  if (agb) j.career.agencyBanUntil = Math.max(j.career.agencyBanUntil || 0, day + extra + agb);
  j.career.scandals = (j.career.scandals || 0) + 1;
  g.addNeed('stress', [0, 5, 12, 20, 15, 10][level]);
  res.kinshinUntil = j.career.kinshinUntil;
  res.tvBanUntil = j.career.tvBanUntil;
  emit(g, 'scandal', { level, ...info, ...res });
  return res;
}
// Some fans come back after 不起訴 / 無罪.
function careerRecover(g, k = 0.3) {
  const j = J(g);
  const back = Math.round((j.career.lostFans || 0) * k);
  if (back > 0) { g.addFans(back, true); j.career.lostFans -= back; }
  j.career.kinshinUntil = Math.min(j.career.kinshinUntil || 0, g.state.day + 7);
  j.career.tvBanUntil = Math.min(j.career.tvBanUntil || 0, g.state.day + 30);
  j.career.agencyBanUntil = Math.min(j.career.agencyBanUntil || 0, g.state.day);
  return back;
}
// What an arrest does outside the cell: the news, the career, the party, the family.
function arrestFallout(g, cs) {
  const st = g.state;
  emit(g, 'arrested', { crime: cs.crime, caseId: cs.id, day: st.day });
  if (cs.juvenile && !cs.specific) {
    // 少年法61条: no names in the news (the agency still hears of it)
    if (knownFigure(g)) news(g, `${CRIMES[cs.crime].short}の疑いで、${cs.age}歳の少年を逮捕。（少年のため氏名は報じられない）`);
    careerSanction(g, 2, { crime: cs.crime, soft: true });
  } else if (knownFigure(g)) {
    news(g, `【速報】${whoInNews(g)}を、${CRIMES[cs.crime].short}の疑いで逮捕。`);
    careerSanction(g, 3, { crime: cs.crime });
    cs.sanctioned = true;
  }
  if (isPolitician(g)) {
    politicalHit(g, 30, 15);
    const left = leavePartyAfterScandal(g);
    if (left) news(g, `${left}は、逮捕された{fullname}議員の離党届を受理した。`);
  }
  familyMessage(g, 'arrested');
}

// ======================================================================== small flows when caught
// 万引き: the store's back office → 警察. A first small case of an adult who admits it and pays
// for the goods ends as 微罪処分 (police only: 前歴 but no 前科).
async function storeCaught(g, c) {
  const st = g.state, j = J(g);
  const flow = new Flow(g);
  const guard = { name: '保安員', look: LK.keiji2 };
  await flow.show('store', { title: `${c.where || '店'}　事務所`, sub: '店を出たところで呼び止められた', officer: LK.tenchou });
  await say(g, guard, 'すみません、お客さま。\nお会計がまだの商品がありますよね？\n事務所まで来ていただけますか。');
  const i = await ask(g, null, '（どうする…？）', ['正直に謝る', 'しらを切る']);
  const plea = i === 0 ? 'admit' : 'deny';
  const amount = Math.max(100, Math.round(c.amount || 500));
  if (plea === 'deny') await say(g, guard, '防犯カメラに、全部映っていますよ。\n…警察を呼びます。');
  else {
    await say(g, SP.tenchou, eraKey(g) === 'reiwa' || eraKey(g) === 'heisei' ? '…そうですか。申し訳ないけど、\nうちは万引きは全部、警察に届けることにしているんです。' : '…まったく。今回は警察を呼びますよ。\nこういうことは、きちんとしないと。');
    if (st.money >= amount) { st.money -= amount; await narrate(g, `（商品の代金 ${fmtMoney(amount)} を支払った）`); c.paidBack = true; }
  }
  const history = j.record.some((r) => r.crime === 'shoplifting' && r.outcome !== 'acquitted');
  const age = ageOf(st);
  await flow.show('kouban', { title: policeName(g), sub: '事情聴取' });
  await say(g, SP.police, `${policeName(g)}の者です。\nお店の方から事情は聞きました。話を聞かせてもらいます。`);
  if (!history && amount <= 10000 && plea === 'admit' && c.paidBack !== false && age >= 20) {
    await say(g, SP.police, ['被害が少なく、初めてで、反省もしている。\nお店も代金を受け取った。', '今回は「微罪処分」にします。\n検察には送らず、警察で手続きを終わらせます。', '前科にはならないが、記録は残る。\n二度とやるんじゃないぞ。']);
    const m = family(g)[0];
    if (m) await narrate(g, `（身元引受人として、${RELATIONS[m.rel].call}が迎えに来てくれた。\n帰り道、ほとんど話はしなかった…）`);
    else if (st.agency) await narrate(g, `（身元引受人として、${AGENCIES[st.agency].name}のマネージャーが迎えに来た）`);
    addRecord(g, { crime: 'shoplifting' }, 'bizai', { label: '微罪処分' });
    delete j.heat.shoplifting;
    g.addNeed('stress', 12);
    if (st.fame >= 1000 && roll(g, 0.25)) queueEvent(g, { type: 'weekly', crime: 'shoplifting', day: st.day + 2, text: '万引きで警察沙汰' });
    await flow.end({ home: true });
    return 'bizai';
  }
  if (age < 20 && !history && amount <= 10000 && plea === 'admit') {
    await say(g, SP.police, ['少年の事件は、すべて家庭裁判所に送られる。\n今回は軽い事件として「簡易送致」の手続きをとる。', '保護者の方に連絡するからね。']);
    addRecord(g, { crime: 'shoplifting' }, 'juvenile_kan', { juvenile: true, label: '簡易送致（審判不開始）' });
    familyMessage(g, 'arrested');
    delete j.heat.shoplifting;
    await flow.end({ home: true });
    return 'kanni';
  }
  await say(g, SP.police, `${since(g, 2006, 5) ? '' : '（この時代の窃盗罪には罰金刑がない…）\n'}窃盗の現行犯で逮捕します。`);
  const cs = await arrestFlow(g, 'shoplifting', { ...c, amount, via: 'genkouhan', evidence: 0.95, plea, flow, skipArrestScene: true });
  return cs ? cs.outcome || 'arrest' : 'arrest';
}
// 無賃乗車: the station office. 増運賃 (2倍, total 3倍); habitual cases are reported (告訴).
async function stationCaught(g, c) {
  const st = g.state, j = J(g);
  const flow = new Flow(g);
  await flow.show('eki', { title: '駅事務室', sub: '改札で止められた' });
  const fare = Math.max(140, Math.round(c.fare || 400));
  const pay = fare * 3;
  await say(g, SP.ekiin, ['恐れ入ります、乗車券を拝見します。\n…有効な乗車券をお持ちではないですね。', `規則により、正規の運賃${fmtMoney(fare)}に加えて、\nその2倍の増運賃をいただきます。合計${fmtMoney(pay)}です。`]);
  if (st.money >= pay) { st.money -= pay; audio.sfx('coin'); await narrate(g, `（${fmtMoney(pay)}を支払った…）`); }
  else { j.unpaid += pay; await say(g, SP.ekiin, 'お支払いいただけないなら、\n住所と名前を書いてください。後日、請求書をお送りします。'); }
  const n = c.n || 1;
  if (n >= 3 && roll(g, 0.6)) {
    await say(g, SP.ekiin, '…何度目ですか。\n記録が残っていますよ。今回は警察に届けます。');
    flow.hide();
    const cs = await arrestFlow(g, 'fare_evasion', { ...c, via: 'genkouhan', evidence: 0.9, flow: null, zaitaku: true });
    return cs ? 'reported' : 'reported';
  }
  await say(g, SP.ekiin, '不正乗車は、鉄道営業法違反です。\n次は警察に届けますからね。');
  addRecord(g, { crime: 'fare_evasion' }, 'zoun', { label: '増運賃', fine: pay });
  delete j.heat.fare_evasion;
  g.addNeed('stress', 5);
  await flow.end();
  return 'zoun';
}
// 補導 (minors' smoking / drinking): no penalty for the minor; tobacco confiscated, family told.
async function hodoFlow(g, id, c) {
  const st = g.state, j = J(g);
  const flow = new Flow(g);
  const smoke = id === 'underage_smoking';
  await flow.show(c.private ? 'kouban' : 'street', { title: '補導', sub: c.where || '', night: true, officer: LK.police });
  await say(g, SP.police, [`ちょっと君、いくつ？\n…${ageOf(st)}さいか。${smoke ? 'タバコ' : 'お酒'}は二十歳になってからだよ。`, `${smoke ? 'これは没収します。' : ''}おうちの人にも連絡しておくからね。`]);
  await narrate(g, '（補導票に名前と住所を書かれた…）');
  if (smoke) { delete st.items.tabako; j.smoke.cigs = 0; }
  j.stats.hodo = (j.stats.hodo || 0) + 1;
  addRecord(g, { crime: id }, 'hodo', { juvenile: true, label: '補導' });
  familyMessage(g, smoke ? 'hodo' : 'hodo_drink');
  g.addNeed('stress', 8);
  if (st.fame >= 250 && roll(g, 0.35)) queueEvent(g, { type: 'weekly', crime: id, day: st.day + 1 + Math.floor(rnd(g) * 4), text: smoke ? '未成年なのに喫煙' : '未成年なのに飲酒' });
  emit(g, 'hodo', { crime: id });
  await flow.end();
  return 'hodo';
}
// 路上喫煙: 巡回指導員, 過料 on the spot where the ordinance has one.
async function streetSmokingCaught(g, c) {
  const flow = new Flow(g);
  const rule = c.rule || {};
  await flow.show('street', { title: '路上喫煙禁止地区', sub: rule.area || '', officer: SP.shidoin.look });
  if (rule.fine) {
    await say(g, SP.shidoin, [`ここは路上喫煙禁止地区です。\n${rule.law || '条例'}により、過料${man(rule.fine)}をお支払いいただきます。`, '（過料は行政上の罰で、前科にはなりません）']);
    await g.fine(rule.fine, '路上喫煙の過料', { kind: 'kare', quiet: true });
    addRecord(g, { crime: 'street_smoking' }, 'kare', { fine: rule.fine, label: '過料' });
  } else {
    await say(g, SP.shidoin, `ここは路上喫煙禁止です。\n${rule.smokingArea ? '喫煙所をご利用ください。' : 'ご協力をお願いします。'}`);
    addRecord(g, { crime: 'street_smoking' }, 'warning', { label: '指導' });
  }
  if (g.state.fame >= 1000 && roll(g, 0.15)) queueEvent(g, { type: 'weekly', crime: 'street_smoking', day: g.state.day + 2, text: '禁止地区で歩きタバコ', level: 1 });
  await flow.end();
  return rule.fine ? 'kare' : 'warning';
}
// 戸別訪問 the first time: a warning (警告) from the police / 選挙管理委員会.
async function warningFlow(g, id, c) {
  const flow = new Flow(g);
  await flow.show('kouban', { title: policeName(g), sub: '選挙違反の警告' });
  await say(g, SP.police, [`${CRIMES[id].name}は、${CRIMES[id].short}にあたります。`, '今回は警告にとどめます。\nくり返せば検挙します。陣営の皆さんにも徹底してください。']);
  J(g).flags['warned_' + id] = g.state.day;
  addRecord(g, { crime: id }, 'warning', { label: '警告' });
  politicalHit(g, 5, 3);
  await flow.end();
  return 'warning';
}
// 泥酔: 保護 overnight; repeated → 科料 (酩酊防止法).
async function drunkFlow(g, c) {
  const st = g.state;
  const flow = new Flow(g);
  await flow.show('ryuchi', { title: `${policeName(g)}　保護室`, wall: '#6a6e76' });
  await narrate(g, '（…気がつくと、警察署の保護室で寝ていた）');
  await passDays(g, 1, { label: '― 翌朝 ―' });
  await say(g, SP.police, [`ゆうべは${c.where || '駅前'}で泥酔して、大声で騒いでいたんですよ。\n覚えていますか？`, '今回は保護しただけです。お酒はほどほどに。']);
  let out = 'hogo';
  if ((c.n || 1) >= 3) {
    await say(g, SP.police, '…でも、これで何度目ですか。\n酩酊防止法違反として、検察庁に送ります。');
    const cs = newCase(g, 'drunk', { ...c, via: 'genkouhan', evidence: 0.9 });
    cs.plea = 'admit';
    cs.detained = false;
    flow.hide();
    await decisionStage(g, new Flow(g), cs, { zaitaku: true });
    out = 'karyo';
  } else {
    addRecord(g, { crime: 'drunk' }, 'hogo', { label: '保護' });
  }
  if (knownFigure(g) && roll(g, 0.4)) { news(g, `${whoInNews(g, 'さん')}が泥酔し、警察に保護されていたことが分かった。`); careerSanction(g, 1, { crime: 'drunk' }); }
  g.addNeed('stress', 10);
  await flow.end({ home: true });
  return out;
}

// ======================================================================== the procedure
const rint = (g, a, b) => a + Math.floor(rnd(g) * (b - a + 1));
function statusNow(g) {
  const j = J(g), d = g.state.day;
  if (j.prison) return 'prison';
  if (j.custody) return 'detained';
  if (j.cases.some((c) => !c.closed && (c.bail || ['indicted', 'verdict_wait', 'appeal_wait'].includes(c.stage)))) return 'trial';
  if (num(j.probationUntil) > d || num(j.suspendUntil) > d) return 'probation';
  return 'free';
}
async function release(g, flow, cs, line) {
  const j = J(g);
  const inside = !!(cs && cs.detained) || j.status === 'detained' || j.status === 'prison';
  if (j.custody && (!cs || j.custody.caseId === cs.id)) j.custody = null;
  if (cs) cs.detained = false;
  j.status = statusNow(g);
  if (line) await narrate(g, line);
  if (inside) emit(g, 'released', { caseId: cs && cs.id, day: g.state.day });
  await flow.end({ home: inside });
  return 'released';
}
function queueEvent(g, ev) {
  const j = J(g);
  j.queue.push({ day: g.state.day, ...ev });
  j.queue.sort((a, b) => a.day - b.day);
}
const caseById = (g, id) => J(g).cases.find((c) => c.id === id && !c.closed) || null;

async function arrestFlow(g, id, ctx = {}) {
  const st = g.state, j = J(g), def = CRIMES[id];
  if (!def) { console.error('arrest: unknown crime', id); return null; }
  if (j.status === 'detained' || j.status === 'prison') return null;
  let cs = ctx.caseId ? caseById(g, ctx.caseId) : null;
  if (!cs) cs = newCase(g, id, ctx);
  if (ctx.plea) cs.plea = ctx.plea;
  const flow = ctx.flow || new Flow(g);
  // 不逮捕特権 (憲法50条・国会法33条): during the session a Diet member is arrested only with the
  // house's consent, unless caught in the act outside the house.
  if (isDietMember(g) && dietInSession(g) && cs.via !== 'genkouhan' && !cs.kyodaku) {
    cs.kyodaku = st.day;
    cs.stage = 'kyodaku';
    news(g, '政府は、{fullname}議員の逮捕許諾請求を国会に提出した。（会期中の国会議員は、院の許諾がなければ逮捕されない）');
    await narrate(g, ['（ニュース速報が流れた。\n会期中の国会議員は、院の許諾がなければ逮捕されない）', '（本会議で許諾が議決されれば、逮捕状が出る…）']);
    queueEvent(g, { type: 'arrest', caseId: cs.id, crime: id, day: st.day + 3, via: 'warrant' });
    flow.hide();
    return cs;
  }
  // a new arrest while on bail: the bail is revoked and the money forfeited (保釈の取消し・保証金の没取)
  for (const o of j.cases) if (o !== cs && o.bail && !o.closed) { j.flags.bailForfeited = (j.flags.bailForfeited || 0) + o.bail.amount; g.message({ from: `${courtCity(g)}地方裁判所`, kind: 'bill', text: `保釈中の再犯により、保釈を取り消しました。保釈保証金${fmtMoney(o.bail.amount)}は没取されます。` }); o.bail = null; }
  j.status = 'detained';
  j.custody = { crime: id, since: st.day, stage: 'police', caseId: cs.id };
  cs.detained = true;
  cs.stage = 'police';
  j.stats.arrests = (j.stats.arrests || 0) + 1;
  try {
    if (!ctx.skipArrestScene) await arrestScene(g, flow, cs);
    arrestFallout(g, cs);
    const done = await policeStage(g, flow, cs, ctx);
    if (done) return cs;
    if (cs.juvenile) {
      const r = await juvenileStage(g, flow, cs);
      if (r !== 'adult') return cs;
      await indictStage(g, flow, cs);
      return cs;
    }
    await prosecutorStage(g, flow, cs);
  } catch (e) {
    console.error(e);
  } finally {
    if (j.status === 'detained' && !j.prison) { j.custody = null; j.status = statusNow(g); }
    flow.hide();
  }
  return cs;
}
async function arrestScene(g, flow, cs) {
  const def = CRIMES[cs.crime];
  if (cs.via === 'genkouhan') {
    await flow.show('street', { title: '現行犯逮捕', sub: cs.where, officer: LK.police, night: true });
    await say(g, SP.police, `${def.short}の現行犯で、逮捕する！`);
    await narrate(g, '（手錠をかけられ、パトカーの後部座席に乗せられた…）');
  } else {
    await flow.show('genkan', { title: '早朝の自宅', sub: '玄関のチャイムが鳴った', clock: '午前6時' });
    await say(g, SP.keiji, [`${policeName(g)}です。\n${def.short}の容疑で、逮捕状が出ています。`, '家の中も捜索させてもらう。\nこれが捜索差押許可状だ。']);
    await narrate(g, '（スマホやパソコン、手帳が次々と段ボール箱に詰められていく…）');
    if (knownFigure(g)) await narrate(g, '（外には、もう報道陣が集まっていた。\nフラッシュの光の中を、捜査車両に乗せられた）');
  }
  audio.sfx('buzz');
}
// The police: rights, a lawyer, the plea, the first night in the cell. Returns true when the
// case left custody here (書類送検 of a small case).
async function policeStage(g, flow, cs, ctx = {}) {
  const def = CRIMES[cs.crime];
  await flow.show('torishirabe', { title: `${policeName(g)}　取調室`, sub: '逮捕から1日目' });
  await say(g, SP.keiji, [`${def.short}の容疑で、話を聞く。`, 'あなたには黙秘権がある。\n言いたくないことは、言わなくていい。', 'それから、弁護人を頼むこともできる。']);
  await chooseLawyer(g, cs, 'police');
  if (!cs.plea || ctx.askPlea !== false) {
    const k = await ask(g, SP.keiji, '…それで、やったのか？', ['事実を認める', '否認する', '黙秘する'], { cancel: 2 });
    cs.plea = ['admit', 'deny', 'silent'][k];
  }
  if (cs.plea === 'admit') {
    await say(g, SP.keiji, '…そうか。最初から順に話してもらおう。');
    await narrate(g, '（話したことが供述調書にまとめられた。\n読み聞かされたあと、署名して指印を押した）');
    cs.evidence = clamp(cs.evidence + 0.03, 0, 1);
    cs.remorse = Math.max(cs.remorse, 0.5);
  } else if (cs.plea === 'deny') {
    await say(g, SP.keiji, '本当にやっていないと言うんだな。\n…証拠は、こっちもそろえてあるんだがな。');
  } else {
    await narrate(g, '（何も答えなかった。取調べは夜まで続いた…）');
  }
  if (ctx.zaitaku && def.severity <= 2) {
    await say(g, SP.keiji, '今日のところは帰っていい。\n事件の書類は検察庁に送る――「書類送検」だ。\n呼び出しには必ず応じること。');
    toZaitaku(g, cs);
    await release(g, flow, cs, '（警察署を出た。事件は、まだ終わっていない…）');
    return true;
  }
  await flow.show('ryuchi', { title: `${policeName(g)}　留置場`, sub: '逮捕から1日目の夜' });
  await narrate(g, ['（所持品を預け、身体検査を受けた。\nここでは名前ではなく、留置番号で呼ばれる）', '（スマホは取り上げられたまま。\n固い布団の上で、ほとんど眠れなかった…）']);
  g.addNeed('stress', 15);
  await passDays(g, 1, { label: '― 翌朝 ―', sub: '逮捕から2日目' });
  cs.custodyDays += 1;
  return false;
}
function toZaitaku(g, cs) {
  const j = J(g);
  cs.detained = false;
  cs.stage = 'zaitaku';
  cs.next = g.state.day + realToGameDays(rint(g, 25, 50));
  if (j.custody && j.custody.caseId === cs.id) j.custody = null;
  queueEvent(g, { type: 'decision', caseId: cs.id, day: cs.next });
}
// phase: 'police' (当番弁護士 / 私選), 'kouryu' (被疑者国選), 'court' (被告人国選 / 私選)
async function chooseLawyer(g, cs, phase) {
  const st = g.state;
  if (cs.lawyer && cs.lawyer !== 'toban') return cs.lawyer;
  const fee = lawyerFee(g, cs, 'shisen');
  const yfee = lawyerFee(g, cs, 'yameken');
  const items = [];
  if (phase === 'police' && tobanOk(g) && !cs.lawyer) items.push(['当番弁護士を呼ぶ（無料）', 'toban']);
  if (phase === 'kouryu' && suspectKokusen(g, cs)) items.push(['国選弁護人をつける（無料）', 'kokusen']);
  if (phase === 'court') items.push(['国選弁護人をつける（無料）', 'kokusen']);
  items.push(['いまは頼まない', null]);
  items.push([`私選弁護人に頼む（約${fmtMoney(fee)}）`, 'shisen']);
  if (st.money >= yfee || st.fame >= 2000) items.push([`元検事の弁護士（約${fmtMoney(yfee)}）`, 'yameken']);
  if (items.length <= 1) return null;
  const q = phase === 'court' ? '（裁判では、弁護人がつく。\nどうしよう…）' : phase === 'kouryu' ? '（勾留が決まると、国選弁護人をつけてもらえる。）' : '（弁護士を頼もうか…）';
  const k = await ask(g, null, q, items.map((x) => x[0]), { cancel: items.findIndex((x) => x[1] === null) });
  const pick = items[k] ? items[k][1] : null;
  if (pick === 'shisen' || pick === 'yameken') {
    const f = pick === 'yameken' ? yfee : fee;
    if (st.money < f) { await narrate(g, `（お金が足りない…。着手金だけで${fmtMoney(f)}かかる）`); return chooseLawyer(g, cs, phase === 'police' ? 'none' : phase); }
    st.money -= f;
    cs.lawyer = pick;
    cs.lawyerFee = f;
    await say(g, lawyerSp(cs), pick === 'yameken' ? ['検事をしていた頃は、取り調べる側でした。\n相手の手の内は分かっています。', 'まずは、話していいことと、いけないことを整理しましょう。'] : [`弁護士の${surname(g, 1)}です。今日から、あなたの弁護人です。`, '取調べで、分からないことにサインはしないでください。\nまずは事実を、私にだけ正直に話してください。']);
    return pick;
  }
  if (pick === 'toban') {
    cs.lawyer = 'toban';
    await say(g, SP.toban, ['弁護士会から来ました、当番弁護士です。\n一度目の面会は無料です。', '黙秘権があること、調書の内容に納得できなければ\nサインしなくていいことを、覚えておいてください。']);
    return 'toban';
  }
  if (pick === 'kokusen') {
    cs.lawyer = 'kokusen';
    await say(g, SP.kokusen, [`国選弁護人に選ばれた、弁護士の${surname(g, 2)}です。\n費用は国が負担します。`, phase === 'court' ? '裁判の準備をしましょう。\n反省の気持ちを、どう伝えるかも大切です。' : 'これからの取調べと、処分の見通しを説明しますね。']);
    return 'kokusen';
  }
  return null;
}
function detainChance(g, cs) {
  const sev = CRIMES[cs.crime].severity;
  let p = [0, 0.12, 0.35, 0.65, 0.85, 1][sev];
  if (cs.plea === 'deny') p += 0.25; else if (cs.plea === 'silent') p += 0.1;
  if (cs.priors) p += 0.12;
  if (cs.via === 'warrant' && sev >= 3) p += 0.1;
  if (CRIMES[cs.crime].political && sev >= 3) p += 0.1;
  return clamp(p, 0, 1);
}
async function prosecutorStage(g, flow, cs) {
  const st = g.state, j = J(g);
  await flow.show('kensatsu', { title: `${courtCity(g)}地方検察庁`, sub: '送致（逮捕から2日目）' });
  await narrate(g, '（護送車で検察庁へ。手錠と腰縄をつけられたまま、\n待合室で長い時間、順番を待った…）');
  await say(g, SP.kenji, ['検察官です。警察から事件の送致を受けました。', `${cs.plea === 'admit' ? '警察で話したことに、間違いはありませんか。' : 'あなたの言い分を聞かせてください。'}`]);
  if (!roll(g, detainChance(g, cs))) {
    await say(g, SP.kenji, ['勾留の請求はしません。今日は帰ってかまいません。', 'ただし、捜査は続きます。\n呼び出しには必ず応じてください。']);
    toZaitaku(g, cs);
    return release(g, flow, cs, '（およそ2日ぶりに、外の空気を吸った…）');
  }
  await flow.show('hearing', { title: `${courtCity(g)}地方裁判所　勾留質問`, judge: LK.judge, second: LK.police });
  await say(g, SP.judge, ['検察官から、あなたの勾留の請求がありました。\n何か言っておきたいことはありますか。', `…逃亡や証拠隠滅のおそれがあると認めます。\n勾留を決定します。期間は10日間です。`]);
  cs.stage = 'kouryu';
  if (j.custody) j.custody.stage = 'kouryu';
  await chooseLawyer(g, cs, 'kouryu');
  cs.noVisits = cs.plea !== 'admit' && CRIMES[cs.crime].severity >= 3;
  if (cs.noVisits) await narrate(g, '（「接見禁止」がついた。弁護士のほかは、\n家族とも面会できない…）');
  await kouryuDays(g, flow, cs, 10, false);
  const def = CRIMES[cs.crime];
  if (cs.plea === 'deny' || def.severity >= 4 || def.political || cs.crime === 'tax_evasion') {
    await say(g, SP.kenji, 'まだ捜査が必要です。\n勾留の延長を請求しました。');
    await narrate(g, '（勾留が10日間、延長された…）');
    await kouryuDays(g, flow, cs, 10, true);
  }
  return decisionStage(g, flow, cs);
}
function jidanCost(cs) {
  const a = cs.amount || 0;
  switch (cs.crime) {
    case 'shoplifting': return a + 100000;
    case 'assault': return cs.injury ? 500000 : 200000;
    case 'robbery': return a + 1000000;
    case 'fraud_courier': return a + 300000;
    case 'traffic_injury': return 300000;
    default: return a + 200000;
  }
}
// 示談 through the lawyer (the victim will not talk to the suspect directly). In custody the lawyer
// comes to the visiting room; in a 在宅 case the player can still hire one before the decision.
async function jidanOffer(g, flow, cs, where = 'menkai') {
  const st = g.state;
  if (!CRIMES[cs.crime].victim || cs.jidan || cs.jidanTried) return false;
  const cost = jidanCost(cs);
  if (!cs.lawyer || cs.lawyer === 'toban') {
    if (where === 'menkai') return false;
    const fee = lawyerFee(g, cs, 'shisen');
    if (st.money < fee + cost) return false;
    const k = await ask(g, null, [`（被害者との示談は、弁護士を通さないと進められない。\n弁護士費用${fmtMoney(fee)}と示談金${fmtMoney(cost)}ほど…）`], ['弁護士に示談を頼む', 'やめておく']);
    if (k !== 0) { cs.jidanTried = true; return false; }
    st.money -= fee;
    cs.lawyer = 'shisen';
    cs.lawyerFee = fee;
  }
  cs.jidanTried = true;
  await flow.show(where === 'menkai' ? 'menkai' : 'bengoshi', where === 'menkai' ? { title: '接見室', sub: '弁護人との面会', visitor: lawyerLook(cs) } : { title: '弁護士事務所', sub: '示談の相談', lawyer: lawyerLook(cs) });
  const can = st.money >= cost;
  const k = await ask(g, lawyerSp(cs), [`被害者の方と、示談の話を進められそうです。\n被害の弁償と示談金で、${fmtMoney(cost)}ほど。`, '示談が成立すれば、処分はかなり軽くなります。'], can ? ['示談をお願いする', 'やめておく'] : ['（お金が足りない）']);
  if (!can || k !== 0) return false;
  st.money -= cost;
  const ok = roll(g, cs.crime === 'robbery' ? 0.6 : 0.85);
  cs.jidan = ok;
  await say(g, lawyerSp(cs), ok ? '示談が成立しました。\n被害者の方から「許す」という書面もいただきました。' : '…被害者の方の気持ちが、まだ収まらないようです。\nお金は被害弁償として受け取ってもらいました。');
  if (!ok) cs.remorse = Math.min(2, cs.remorse + 0.5);
  return ok;
}
async function kouryuDays(g, flow, cs, n, extended) {
  const st = g.state;
  const half = Math.ceil(n / 2);
  await flow.show('ryuchi', { title: `${policeName(g)}　留置場`, sub: extended ? '勾留延長' : '勾留中' });
  await passDays(g, half, { label: `― ${half}日後 ―`, sub: extended ? '勾留延長' : '勾留中' });
  cs.custodyDays += half;
  // the lawyer: 示談 with the victim
  await jidanOffer(g, flow, cs, 'menkai');
  // a family visit (not with 接見禁止): the first time the closest one, then someone else (or no one)
  cs.visits = (cs.visits || 0) + 1;
  const m = family(g)[cs.visits - 1];
  if (m && !cs.noVisits) {
    const look = familyLook(m, playerLook(g));
    await flow.show('menkai', { title: '面会室', sub: `${RELATIONS[m.rel].call}が来てくれた`, visitor: look });
    const k = famKansai(g);
    const older = RELATIONS[m.rel].older;
    await say(g, { name: RELATIONS[m.rel].call, look }, older && cs.visits === 1
      ? (k ? ['…元気にしとるか。ちゃんと食べとる？', 'うちらのことは心配せんでええ。\nしっかり反省して、ちゃんと帰ってきい。'] : ['…元気にしてる？ちゃんと食べてる？', 'わたしたちのことは心配しないで。\nしっかり反省して、ちゃんと帰ってきなさい。'])
      : older ? (k ? ['……。（しばらく、何も言わずに座っていた）', 'やってしもたことは、消えへん。\nせやけど、やり直すことはできる。待っとるで。'] : ['……。（しばらく、何も言わずに座っていた）', 'やってしまったことは、消えない。\nでも、やり直すことはできる。待ってるからな。'])
      : (k ? ['…ニュースで見て、びっくりしたわ。', 'ちゃんと反省して、はよ帰ってきてな。\n待っとるから。'] : ['…ニュースで見て、びっくりしたよ。', 'ちゃんと反省して、早く帰ってきてね。\n待ってるから。']));
    g.addNeed('stress', -10);
    cs.witness = true;
  } else {
    await flow.show('torishirabe', { title: `${policeName(g)}　取調室`, sub: '取調べが続く' });
    await narrate(g, '（連日の取調べ。同じことを何度も聞かれる…）');
  }
  await passDays(g, n - half, { label: `― ${n - half}日後 ―`, sub: '勾留満期' });
  cs.custodyDays += n - half;
}
// 不起訴 (嫌疑不十分 / 起訴猶予) / 略式起訴 / 公判請求.
function decide(g, cs) {
  const def = CRIMES[cs.crime];
  if (cs.evidence < 0.45 && roll(g, 0.5 + (0.45 - cs.evidence) * 2)) return 'kengi';
  if (cs.plea === 'deny' && cs.evidence < 0.6 && roll(g, 0.15 + lawyerQ(cs) * 0.3)) return 'kengi';
  const t = typicalOf(g, cs);
  let p = t.charge ?? 0.8;
  p += 0.08 * cs.priors + 0.1 * Math.min(3, cs.hist || 0);
  if (cs.jidan) p -= 0.35;
  if (cs.plea === 'admit') p -= 0.06;
  p -= (cs.remorse || 0) * 0.05 + lawyerQ(cs) * 0.08;
  if (cs.sanctioned) p -= 0.05;
  if (def.severity >= 4) p = Math.max(p, def.severity >= 5 ? 0.97 : 0.95); // 重い事件は、示談があってもほぼ起訴
  if (def.political && cs.politician) p = Math.max(p, 0.97); // 候補者・議員本人の選挙違反・政治資金事件
  if (!roll(g, clamp(p, 0.02, 1))) return 'yuyo';
  const sen = computeSentence(g, cs);
  if (sen.kind === 'fine' && sen.fine <= 1000000 && !cs.wantsTrial) { cs.sentence = sen; return 'ryakushiki'; }
  return 'kohan';
}
async function decisionStage(g, flow, cs, opts = {}) {
  if (!cs.detained) await jidanOffer(g, flow, cs, 'office');
  const kind = decide(g, cs);
  cs.decision = kind;
  await flow.show('kensatsu', { title: `${courtCity(g)}地方検察庁`, sub: cs.detained ? '勾留満期' : '呼び出し' });
  if (kind === 'kengi' || kind === 'yuyo') {
    await say(g, SP.kenji, kind === 'kengi'
      ? ['今回の件は、不起訴処分とします。', '起訴するだけの証拠がそろわなかった――「嫌疑不十分」です。']
      : ['今回は、起訴を見送ります。「起訴猶予」です。', `${cs.jidan ? '被害者と示談が成立していること、' : ''}反省していることなどを考えました。\n…二度と、ここに来ることのないように。`]);
    addRecord(g, cs, 'not_indicted', { label: kind === 'kengi' ? '不起訴（嫌疑不十分）' : '不起訴（起訴猶予）' });
    emit(g, 'not_indicted', { crime: cs.crime, caseId: cs.id, reason: kind });
    careerRecover(g, kind === 'kengi' ? 0.5 : 0.25);
    if (knownFigure(g) && (cs.sanctioned || cs.via !== 'summons')) news(g, `${whoInNews(g, 'さん')}について、検察は不起訴処分とした。`);
    closeCase(g, cs, 'not_indicted');
    return release(g, flow, cs, cs.detained ? '（釈放された。何日ぶりかの、外の空気だった…）' : null);
  }
  if (kind === 'ryakushiki') {
    const sen = cs.sentence;
    const k = await ask(g, SP.kenji, [`この事件は「略式起訴」にしたいと考えています。\n公開の法廷を開かず、書面だけで${sentenceText(g, sen)}になる見込みです。`, '法廷には出なくてすみますが、前科はつきます。\n略式の手続きに同意しますか？'], ['同意する', '正式な裁判を求める']);
    if (k === 0) {
      cs.court = `${courtCity(g)}簡易裁判所`;
      await narrate(g, `（${cs.court}から略式命令が出た。${sentenceText(g, sen)}――）`);
      return finalize(g, flow, cs, sen);
    }
    cs.wantsTrial = true;
  }
  cs.sentence = null;
  return indictStage(g, flow, cs);
}
function bailAmount(g, cs) {
  const sev = CRIMES[cs.crime].severity;
  let a = [0, 1500000, 1500000, 2000000, 3000000, 5000000][sev];
  a += Math.min(30000000, Math.round(g.state.money * 0.15 / 100000) * 100000);
  if (g.state.fame >= 4000) a *= 2;
  return Math.round(a / 100000) * 100000;
}
function bailChance(g, cs) {
  const sev = CRIMES[cs.crime].severity;
  let p = cs.plea === 'admit' ? 0.75 : cs.plea === 'deny' ? 0.35 : 0.5;
  if (sev >= 5) p -= 0.3; // 短期1年以上の罪: 権利保釈の例外（89条1号）
  if (cs.priors) p -= 0.15;
  p += lawyerQ(cs) * 0.2;
  return clamp(p, 0.05, 0.95);
}
async function indictStage(g, flow, cs) {
  const st = g.state, j = J(g), def = CRIMES[cs.crime];
  cs.stage = 'indicted';
  cs.court = `${courtCity(g)}地方裁判所`;
  await flow.show('kensatsu', { title: `${courtCity(g)}地方検察庁`, sub: '起訴' });
  await say(g, SP.kenji, `${def.short}の罪で、あなたを起訴しました。\nこれからは「被告人」として、裁判を受けることになります。`);
  if (knownFigure(g)) news(g, `${whoInNews(g, '被告')}を、${def.short}の罪で起訴。`);
  if (isPolitician(g)) {
    const r = await ask(g, null, '（議員を続けるか、辞めるか…。\n世間の目は厳しい）', ['議員を続ける', '議員辞職する']);
    if (r === 1) { loseOffice(g, '議員辞職'); cs.sanctioned = true; } else politicalHit(g, 15, 10);
  }
  if (!cs.lawyer || cs.lawyer === 'toban') await chooseLawyer(g, cs, 'court');
  const firstHearing = realToGameDays(rint(g, 30, 45));
  if (cs.detained && cs.lawyer && cs.lawyer !== 'toban') {
    const out = await bailStage(g, flow, cs, firstHearing);
    if (out === 'bail') return 'bail';
  }
  if (!cs.detained) {
    cs.trialDay = st.day + firstHearing;
    queueEvent(g, { type: 'trial', caseId: cs.id, day: cs.trialDay });
    j.status = statusNow(g);
    await narrate(g, `（裁判所から呼出状が届いた。初公判は${firstHearing}日後だ）`);
    await flow.end();
    return 'kiso';
  }
  await flow.show('ryuchi', { title: '拘置所', sub: '起訴後の勾留', wall: '#6a6e74' });
  await narrate(g, '（起訴されると、勾留はさらに続く。\n留置場から拘置所に移された）');
  await passDays(g, firstHearing, { label: '― 約1か月後 ―', sub: '初公判の日' });
  cs.custodyDays += firstHearing;
  return trialFlow(g, cs, { flow });
}
async function bailStage(g, flow, cs, firstHearing) {
  const st = g.state, j = J(g);
  const amt = bailAmount(g, cs);
  await flow.show('menkai', { title: '接見室', sub: '弁護人との面会', visitor: lawyerLook(cs) });
  const can = st.money >= amt;
  const k = await ask(g, lawyerSp(cs), [`保釈を請求しましょう。\n保釈保証金は${fmtMoney(amt)}ほどになりそうです。`, '裁判にきちんと出れば、終わったあとに返ってきます。'], can ? ['保釈を請求する', 'やめておく'] : ['（お金が足りない）']);
  if (!can) { await say(g, lawyerSp(cs), '保証金を用意できないと、保釈は難しいですね…。'); return 'no'; }
  if (k !== 0) return 'no';
  if (!roll(g, bailChance(g, cs))) {
    await say(g, lawyerSp(cs), '…保釈請求は却下されました。\n「罪証を隠滅するおそれ」があると判断されたようです。');
    return 'no';
  }
  st.money -= amt;
  cs.bail = { amount: amt, day: st.day };
  cs.detained = false;
  j.custody = null;
  cs.trialDay = st.day + firstHearing;
  queueEvent(g, { type: 'trial', caseId: cs.id, day: cs.trialDay });
  await say(g, lawyerSp(cs), ['保釈が認められました。', '住む場所を変えないこと、事件の関係者に会わないこと。\n条件を破れば、保証金は没収されます。', `初公判は${firstHearing}日後です。必ず出廷してください。`]);
  if (knownFigure(g)) news(g, `${whoInNews(g, '被告')}が保釈された。保釈保証金は${fmtMoney(amt)}。`);
  j.status = 'trial';
  emit(g, 'released', { caseId: cs.id, bail: amt });
  await flow.end({ home: true });
  return 'bail';
}
// 少年事件: 家庭裁判所 (観護措置 → 少年審判), or 逆送 to the adult procedure.
async function juvenileStage(g, flow, cs) {
  const st = g.state, j = J(g), def = CRIMES[cs.crime];
  const pen = penaltyOf(g, cs.crime, cs);
  const short1 = !!(pen.prison && pen.prison[0] >= 12);
  const gyakuso = (cs.specific && short1) || (cs.age >= 16 && def.severity >= 5 && roll(g, 0.08)); // 20条1項（刑事処分相当）は16・17歳ではまれ
  await flow.show('kensatsu', { title: `${courtCity(g)}地方検察庁`, sub: '少年事件' });
  await say(g, SP.kenji, ['20歳未満の事件は、すべて家庭裁判所に送られます。', cs.specific ? 'あなたは18歳以上の「特定少年」です。\n重い事件なら、大人と同じ裁判になることもあります。' : '家庭裁判所が、あなたの立ち直りに何が必要かを決めます。']);
  if (def.severity >= 2 || cs.priors) {
    await flow.show('ryuchi', { title: '少年鑑別所', sub: '観護措置', wall: '#7a8a7a' });
    await narrate(g, '（少年鑑別所に移された。心理検査や面接、\n日記を書く毎日…）');
    const d = realToGameDays(28);
    await passDays(g, d, { label: '― 約4週間後 ―', sub: '少年審判の日' });
    cs.custodyDays += d;
  }
  if (gyakuso) {
    await flow.show('kasai', { title: `${courtCity(g)}家庭裁判所`, sub: '検察官送致（逆送）' });
    await say(g, SP.shinpan, ['事件の重さを考え、刑事処分が相当と認めます。', '事件を検察官に送致します。\n大人と同じ、刑事裁判を受けることになります。']);
    cs.juvenile = false;
    cs.gyakuso = true;
    if (cs.specific && knownFigure(g)) news(g, '18歳以上の「特定少年」は、起訴されると実名で報道される。（改正少年法・2022年4月から）');
    return 'adult';
  }
  await flow.show('kasai', { title: `${courtCity(g)}家庭裁判所　少年審判`, sub: '非公開の審判廷' });
  await say(g, SP.chosa, ['家庭裁判所調査官です。\nあなたの生活や家族のこと、事件のことを調べてきました。']);
  const k = await ask(g, SP.shinpan, '自分のしたことを、どう思っていますか。', ['深く反省しています', 'よく分かりません', '話したくない']);
  cs.remorse = [1.5, 0.5, 0][k];
  const juvPriors = j.record.filter((r) => r.juvenile && /juvenile_(hogo|in)/.test(r.outcome)).length;
  const score = def.severity + juvPriors * 1.2 - cs.remorse * 0.8 - (family(g).length ? 0.5 : 0) - (cs.jidan ? 0.8 : 0);
  let outcome, label, days = 0;
  if (score <= 1.5) { outcome = 'juvenile_fusho'; label = '不処分'; }
  else if (score <= 3.2) { outcome = 'juvenile_hogo'; label = '保護観察'; }
  else { outcome = 'juvenile_in'; label = score > 4.5 ? '少年院送致（長期）' : '少年院送致（短期）'; days = score > 4.5 ? years(1) : monthsToDays(6); }
  await say(g, SP.shinpan, outcome === 'juvenile_fusho'
    ? ['今回は「不処分」とします。', 'あなたの反省と、家族の支えがあれば、\n立ち直れると考えたからです。']
    : outcome === 'juvenile_hogo' ? ['あなたを「保護観察」に付します。', '保護司の先生と定期的に会い、約束を守って生活してください。']
      : [`あなたを、少年院に送致します。（${label.replace('少年院送致', '')}）`, '罰ではなく、立ち直るための教育を受ける場所です。']);
  addRecord(g, cs, outcome, { juvenile: true, label });
  if (knownFigure(g)) careerSanction(g, outcome === 'juvenile_in' ? 3 : 2, { crime: cs.crime, soft: true });
  closeCase(g, cs, outcome);
  if (outcome === 'juvenile_hogo') {
    j.probationUntil = Math.max(num(j.probationUntil), st.day + years(1));
    j.supervision = true;
  }
  if (outcome === 'juvenile_in') {
    j.custody = null;
    j.prison = { kind: 'shonenin', place: 'shonenin', start: st.day, days, until: st.day + days, behaviour: 55, reward: 0, parole: null, caseId: cs.id, labor: 'choeki' };
    await serveSentenceFlow(g, flow);
    return 'shonenin';
  }
  return release(g, flow, cs, '（家庭裁判所を出た。迎えに来た家族の顔が、まともに見られなかった）');
}
// 任意の事情聴取 (a small case surfacing later): questions at the station, 書類送検, decision later.
async function voluntaryCase(g, id, ctx = {}) {
  const st = g.state, j = J(g), def = CRIMES[id];
  const flow = new Flow(g);
  const cs = newCase(g, id, { ...ctx, via: 'summons', evidence: ctx.evidence ?? 0.7 });
  cs.detained = false;
  await flow.show('torishirabe', { title: `${policeName(g)}　取調室`, sub: '任意の事情聴取' });
  await say(g, SP.keiji, [`${ctx.source ? `${ctx.source}をきっかけに、` : ''}${def.name}の件で、話を聞かせてもらいたい。`, 'これは任意の事情聴取だ。\n逮捕ではないが、正直に話してほしい。']);
  const k = await ask(g, SP.keiji, '…心当たりは、あるな？', ['認める', '否認する', '黙秘する'], { cancel: 2 });
  cs.plea = ['admit', 'deny', 'silent'][k];
  if (cs.plea === 'admit') { cs.remorse = 0.5; cs.evidence = clamp(cs.evidence + 0.1, 0, 1); }
  await say(g, SP.keiji, '事件の書類は、検察庁に送る。「書類送検」だ。\n処分が決まったら、連絡が行く。');
  if (knownFigure(g)) { news(g, `${whoInNews(g, '容疑者')}を、${def.short}の疑いで書類送検。`); careerSanction(g, 2, { crime: id }); cs.sanctioned = true; }
  toZaitaku(g, cs);
  j.status = statusNow(g);
  await flow.end();
  return cs;
}

// ---------------------------------------------------------------- the trial
function jobTitle(g) {
  const st = g.state;
  if (isPolitician(g)) return officeLabel(g);
  if (st.agency) return 'タレント';
  return st.fame >= 30 ? 'タレント（休業中）' : '無職';
}
const lawShort = (g, id) => { const head = String(crimeLaw(g, id)).split('：')[0]; const m = head.match(/（([^）]*?\d+条[^）]*)）/); return m ? m[1].replace(/^(刑法|所得税法|公職選挙法)(\d)/, '$1第$2').replace(/・.*$/, '') : head; };
function evidenceLine(cs) {
  if (cs.via === 'genkouhan') return '現行犯で逮捕した警察官の証言、防犯カメラの映像、\n被害届などによって証明します。';
  if (['tax_evasion', 'slush_fund', 'bribery_take', 'bribery_give', 'assen'].includes(cs.crime)) return '押収した帳簿、銀行口座の取引記録、\n関係者の供述などによって証明します。';
  return '防犯カメラの映像、関係者の供述、\n押収した証拠品などによって証明します。';
}
function defenseLine(g, cs) {
  if (cs.plea === 'deny') return ['被告人が犯人であるという証拠は、\nいずれも決め手を欠いています。', '「疑わしきは被告人の利益に」。\n無罪の判決を求めます。'];
  const pts = [cs.remorse >= 1 ? '被告人は、深く反省しています。' : '被告人は、事実を認めています。'];
  if (cs.jidan) pts.push('被害者との示談も成立しています。');
  if (cs.witness) pts.push('家族も、今後の監督を約束しています。');
  if (cs.sanctioned) pts.push('仕事を失うなど、すでに社会的な制裁も受けています。');
  return [pts.slice(0, 3).join('\n'), (pts[3] ? pts[3] + '\n' : '') + '寛大な判決を求めます。'];
}
function reasonLine(g, cs, sen) {
  const good = [];
  if (cs.remorse >= 1) good.push('反省の態度を示していること');
  if (cs.jidan) good.push('示談が成立していること');
  if (cs.witness) good.push('家族が監督を約束していること');
  if (cs.sanctioned) good.push('社会的制裁を受けていること');
  const bad = cs.priors ? '前科があるにもかかわらず、再び犯行に及んだ。' : '被告人の刑事責任は、軽くない。';
  return `${bad}${good.length ? `\nしかし、${good.slice(0, 2).join('、')}などを考え、` : '\n'}主文の刑が相当と判断した。`;
}
const creditDays = (cs) => Math.max(0, (cs.custodyDays || 0) - 10); // 未決勾留日数の算入
async function trialFlow(g, cs, opts = {}) {
  const st = g.state, j = J(g);
  if (!cs || cs.closed) return null;
  const def = CRIMES[cs.crime];
  const flow = opts.flow || new Flow(g);
  cs.stage = 'trial';
  cs.court = cs.court || `${courtCity(g)}地方裁判所`;
  const pen = penaltyOf(g, cs.crime, cs);
  if (!cs.lawyer && pen.prison && pen.prison[1] > 36) cs.lawyer = 'kokusen'; // 必要的弁護事件（刑訴法289条）
  const judges = def.severity >= 5 ? 3 : 1; // 法定合議（短期1年以上の罪）
  const chief = judges === 3 ? SP.chief : SP.judge;
  const d = lawDate(g, cs.day);
  await flow.show('houtei', { title: `${cs.court}　第1回公判`, sub: knownFigure(g) ? '傍聴券を求めて長い列ができた' : '刑事法廷', judges, lawyer: lawyerLook(cs) });
  if (cs.lawyer === 'kokusen' && !cs.kokusenTold && !opts.quietLawyer) { cs.kokusenTold = true; }
  await say(g, chief, ['開廷します。被告人は、証言台の前に立ってください。', '名前と生年月日、本籍、住所、職業を言ってください。']);
  await narrate(g, `（「${fullName(st.profile) || st.name}です。職業は、${jobTitle(g)}です」）`);
  await say(g, SP.kenji, [`公訴事実。被告人は、${wareki(d.year, d.month)}ころ、${def.facts(cs, g)}ものである。`, `罪名及び罰条。${def.short}、${lawShort(g, cs.crime)}。`]);
  await say(g, chief, ['被告人には黙秘権があります。\n答えたくない質問には、答えなくてかまいません。', '今、検察官が読んだ事実について、\n何か違うところはありますか。']);
  const k = await ask(g, null, '（罪状認否）', ['間違いありません', 'やっていません', '何も話しません'], { cancel: 2 });
  cs.plea = ['admit', 'deny', 'silent'][k];
  if (cs.lawyer) await say(g, lawyerSp(cs), cs.plea === 'deny' ? '弁護人も、被告人は無罪であると考えます。' : '弁護人も、被告人と同じ意見です。');
  await say(g, SP.kenji, ['検察官が証拠によって証明しようとする事実は、\n次のとおりです。', evidenceLine(cs)]);
  if (cs.plea === 'deny') {
    await narrate(g, '（目撃者が証人として呼ばれた。\n弁護人が、証言のあいまいな点を突いていく…）');
    const shake = lawyerQ(cs) * 0.25 * (0.5 + rnd(g));
    cs.evidence = clamp(cs.evidence - shake, 0.2, 1);
    if (shake > 0.12) await say(g, lawyerSp(cs), '…証人の記憶は、ずいぶんあいまいなようですね。');
  }
  const m = family(g)[0];
  if (m && cs.plea !== 'deny') {
    const look = familyLook(m, playerLook(g));
    await say(g, { name: `情状証人（${RELATIONS[m.rel].call}）`, look }, famKansai(g)
      ? ['…この子は、小さいころから、人の気持ちがわかる子でした。', 'これからは家族みんなで見守っていきます。\nどうか、やり直す機会をやってください。']
      : ['…この子は、小さいころから、人の気持ちがわかる子でした。', 'これからは家族みんなで見守っていきます。\nどうか、やり直す機会をください。']);
    cs.witness = true;
  }
  const q = await ask(g, cs.lawyer ? lawyerSp(cs) : SP.kenji, '（被告人質問）\nなぜ、このようなことをしたのですか。', cs.plea === 'deny' ? ['やっていません', '答えません'] : ['深く反省しています', '仕方がなかった', '答えません']);
  if (cs.plea !== 'deny') cs.remorse = clamp((cs.remorse || 0) + [1, -0.3, -0.2][q], 0, 2);
  const demand = computeSentence(g, cs);
  await say(g, SP.kenji, ['論告。…本件は身勝手な動機による犯行で、\n酌量の余地は乏しい。', `よって、被告人を${demandOf(g, demand)}に処するのが相当と考えます。`]);
  if (cs.lawyer) await say(g, lawyerSp(cs), defenseLine(g, cs));
  else await narrate(g, '（弁護人はいない。自分の言葉で話すしかない）');
  const f = await ask(g, chief, '最後に、何か言っておきたいことはありますか。', cs.plea === 'deny' ? ['私は無実です', '特にありません'] : ['申し訳ありませんでした', '特にありません']);
  if (cs.plea !== 'deny' && f === 0) cs.remorse = clamp(cs.remorse + 0.3, 0, 2);
  cs.sentence = computeSentence(g, cs);
  await say(g, chief, '判決は、2週間後に言い渡します。\nこれで閉廷します。');
  cs.stage = 'verdict_wait';
  if (!cs.detained) {
    queueEvent(g, { type: 'verdict', caseId: cs.id, day: st.day + 14 });
    j.status = statusNow(g);
    await flow.end({ home: true });
    return 'waiting';
  }
  await passDays(g, 14, { label: '― 2週間後 ―', sub: '判決の日' });
  cs.custodyDays += 14;
  return verdictFlow(g, cs, { flow });
}
function acquitChance(cs) { return clamp((0.62 - cs.evidence) * 1.6 + lawyerQ(cs) * 0.15, 0.01, 0.7); }
function verdictLines(g, cs, sen) {
  const out = [];
  if (sen.kind === 'fine') {
    out.push(`主文。被告人を${sentenceText(g, sen)}に処する。`);
    out.push(`その${sen.karyo ? '科料' : '罰金'}を完納することができないときは、\n金${fmtMoney(LABOR_YEN)}を1日に換算した期間、\n被告人を労役場に留置する。`);
  } else {
    out.push(`主文。被告人を${laborWord(g, sen.labor)}${fmtTerm(sen.months)}に処する。`);
    const credit = sen.kind === 'prison' ? creditDays(cs) : 0;
    if (credit) out.push(`未決勾留日数中${credit}日を、その刑に算入する。`);
    if (sen.suspend) out.push(`この裁判が確定した日から${sen.suspend}年間、その刑の執行を猶予する。${sen.supervision ? '\nその猶予の期間中、被告人を保護観察に付する。' : ''}`);
    if (sen.extraFine) out.push(`被告人を罰金${fmtMoney(sen.extraFine)}に処する。`);
  }
  if (sen.tsuicho) out.push(`被告人から${fmtMoney(sen.tsuicho)}を追徴する。`);
  if (cs.lawyer === 'kokusen' && g.state.money >= 300000 && sen.kind !== 'fine') out.push('訴訟費用は、被告人の負担とする。');
  out.push(`理由の要旨。${reasonLine(g, cs, sen)}`);
  return out;
}
async function verdictFlow(g, cs, opts = {}) {
  if (!cs || cs.closed) return null;
  const def = CRIMES[cs.crime];
  const flow = opts.flow || new Flow(g);
  const judges = def.severity >= 5 ? 3 : 1;
  const chief = judges === 3 ? SP.chief : SP.judge;
  await flow.show('houtei', { title: `${cs.court || '地方裁判所'}　判決`, sub: '判決の言い渡し', judges, lawyer: lawyerLook(cs) });
  await say(g, chief, '被告人は、前に出てください。\n判決を言い渡します。');
  if (cs.plea === 'deny' && roll(g, acquitChance(cs))) return acquitFlow(g, flow, cs, chief);
  const sen = cs.sentence || computeSentence(g, cs);
  cs.sentence = sen;
  await say(g, chief, verdictLines(g, cs, sen));
  if (sen.kind === 'prison') audio.sfx('fail');
  const a = await ask(g, cs.lawyer ? lawyerSp(cs) : null, ['この判決に不服があれば、\n14日以内に控訴することができます。', sen.kind === 'prison' ? '実刑判決です。控訴すれば、高等裁判所で\nもう一度争えます。どうしますか？' : '控訴しますか？'], ['控訴しない', '控訴する']);
  if (a === 1) return appealFlow(g, flow, cs, 'koso');
  return finalize(g, flow, cs, sen);
}
async function acquitFlow(g, flow, cs, chief) {
  const st = g.state;
  await say(g, chief, ['主文。被告人は、無罪。', '検察官の提出した証拠によっては、被告人が犯人であると\n認めるには、合理的な疑いが残る。']);
  audio.sfx('fanfare');
  addRecord(g, cs, 'acquitted', { label: '無罪' });
  emit(g, 'acquitted', { crime: cs.crime, caseId: cs.id });
  careerRecover(g, 0.6);
  if (cs.custodyDays > 0) {
    const comp = cs.custodyDays * 10000;
    st.money += comp;
    await narrate(g, `（勾留されていた${cs.custodyDays}日分について、\n刑事補償として${fmtMoney(comp)}が支払われることになった）`);
  }
  if (cs.bail) { st.money += cs.bail.amount; await narrate(g, `（保釈保証金${fmtMoney(cs.bail.amount)}が返ってきた）`); cs.bail = null; }
  if (knownFigure(g)) news(g, `${whoInNews(g, 'さん')}に無罪判決。検察は控訴を見送った。`);
  familyMessage(g, 'acquitted');
  closeCase(g, cs, 'acquitted');
  return release(g, flow, cs, cs.detained ? '（拘置所を出た。長い日々だった…）' : null);
}
async function appealFlow(g, flow, cs, level = 'koso') {
  const st = g.state, j = J(g);
  cs.appeals = (cs.appeals || 0) + 1;
  const court = level === 'koso' ? `${courtCity(g)}高等裁判所` : '最高裁判所';
  if (level === 'koso' && cs.lawyer && cs.lawyer !== 'toban' && CRIMES[cs.crime].victim && !cs.jidan) {
    const cost = jidanCost(cs);
    if (st.money >= cost) {
      const k = await ask(g, lawyerSp(cs), [`控訴審までに、もう一度示談を目指しましょう。\n${fmtMoney(cost)}ほど必要です。`], ['示談をお願いする', 'やめておく']);
      if (k === 0) { st.money -= cost; cs.jidan = roll(g, 0.7); cs.jidanLate = cs.jidan; await say(g, lawyerSp(cs), cs.jidan ? '示談が成立しました。控訴審で主張します。' : '…示談は、まとまりませんでした。'); }
    }
  }
  const wait = realToGameDays(level === 'koso' ? rint(g, 90, 120) : rint(g, 120, 180));
  if (cs.detained) {
    await flow.show('ryuchi', { title: '拘置所', sub: `${level === 'koso' ? '控訴審' : '上告審'}を待つ`, wall: '#6a6e74' });
    await passDays(g, wait, { label: `― 約${Math.max(1, Math.round(wait / MONTH_DAYS))}か月後 ―`, sub: court });
    cs.custodyDays += wait;
    return appealHearing(g, flow, cs, level);
  }
  cs.stage = 'appeal_wait';
  cs.appealLevel = level;
  queueEvent(g, { type: 'appeal', caseId: cs.id, day: st.day + wait, level });
  j.status = statusNow(g);
  await narrate(g, `（${level === 'koso' ? '控訴' : '上告'}した。${court}の判決は、${wait}日ほど先になる）`);
  await flow.end({ home: true });
  return 'appeal_wait';
}
async function appealHearing(g, flow, cs, level) {
  flow = flow || new Flow(g);
  const court = level === 'koso' ? `${courtCity(g)}高等裁判所` : '最高裁判所';
  cs.court = court;
  await flow.show('houtei', { title: `${court}　判決`, sub: level === 'koso' ? '控訴審' : '上告審', judges: 3, lawyer: lawyerLook(cs) });
  const sen = cs.sentence || computeSentence(g, cs);
  if (cs.plea === 'deny' && roll(g, acquitChance(cs) * (level === 'koso' ? 0.5 : 0.15))) {
    await say(g, SP.chief, '主文。原判決を破棄する。');
    return acquitFlow(g, flow, cs, SP.chief);
  }
  const pRev = level === 'koso' ? 0.1 + lawyerQ(cs) * 0.1 + (cs.jidanLate ? 0.3 : 0) : 0.03;
  if (roll(g, pRev)) {
    const s2 = { ...sen };
    if (s2.kind === 'prison' && s2.months <= 36) { s2.kind = 'suspended'; s2.suspend = 4; }
    else if (s2.kind !== 'fine') s2.months = Math.max(1, Math.round(s2.months * 0.8));
    else s2.fine = round1(s2.fine * 0.8, s2.fine < 10000 ? 1000 : 10000);
    await say(g, SP.chief, ['主文。原判決を破棄する。', `被告人を${sentenceText(g, s2)}に処する。`, '原判決の量刑は、その後の事情も考えると、重すぎる。']);
    cs.sentence = s2;
  } else {
    await say(g, SP.chief, level === 'koso'
      ? ['主文。本件控訴を棄却する。', '原判決に、事実の誤認も、法令の適用の誤りもない。\n量刑も不当とはいえない。']
      : ['主文。本件上告を棄却する。', '上告の理由は、憲法違反や判例違反をいうものではなく、\n上告の理由にあたらない。']);
    cs.sentence = sen;
  }
  if (level === 'koso') {
    const k = await ask(g, cs.lawyer ? lawyerSp(cs) : null, '最高裁判所に上告することもできます。\nただ、上告が認められることは、ごくまれです。', ['上告しない', '上告する']);
    if (k === 1) return appealFlow(g, flow, cs, 'jokoku');
  }
  return finalize(g, flow, cs, cs.sentence);
}
// The judgment becomes final (確定): the record, the consequences, then the sentence is carried out.
function applyCivicBan(g, cs, sen, prisonDays) {
  const j = J(g), def = CRIMES[cs.crime], day = g.state.day;
  let until = 0, why = '';
  const termDays = sen.kind === 'prison' ? Math.max(1, prisonDays) : 0; // 刑期の満了まで（仮釈放中も刑の執行中）
  if (def.political && def.civicBan) {
    why = `${def.short}の刑に処せられたため（${cs.crime === 'slush_fund' ? '政治資金規正法28条' : '公職選挙法252条'}）`;
    until = sen.kind === 'fine' ? day + years(5) : sen.kind === 'suspended' ? day + years(sen.suspend) : day + termDays + years(5);
  } else if (def.bribery && cs.politician) {
    why = '公職にある間に犯した収賄罪の刑に処せられたため（公職選挙法11条1項4号）';
    until = sen.kind === 'suspended' ? day + years(sen.suspend) : sen.kind === 'prison' ? day + termDays + years(5) : 0;
  } else if (sen.kind === 'prison') {
    why = '禁錮以上の刑の執行を終わるまで（公職選挙法11条1項2号）';
    until = day + termDays;
  }
  if (until > num(j.civicBanUntil)) { j.civicBanUntil = until; j.civicBanWhy = why; }
  return until;
}
async function politicsAfterConviction(g, cs, sen) {
  if (!isPolitician(g)) return;
  const j = J(g);
  if (num(j.civicBanUntil) > g.state.day) { loseOffice(g, `公民権停止：${j.civicBanWhy || '被選挙権を失ったため'}`); return; }
  if (sen.kind === 'prison') { loseOffice(g, '禁錮以上の実刑判決が確定したため'); return; }
  const k = await ask(g, null, '（法律の上では、議員を続けることができる。\nでも、世間の目は厳しい…）', ['議員を続ける', '議員辞職する']);
  if (k === 1) loseOffice(g, '議員辞職'); else politicalHit(g, sen.kind === 'suspended' ? 30 : 15, 15);
}
async function finalize(g, flow, cs, sen) {
  const st = g.state, j = J(g);
  flow = flow || new Flow(g);
  cs.stage = 'final';
  const label = sentenceText(g, sen);
  let revoked = null;
  if (sen.kind === 'prison' && inSuspension(g) && j.suspended) { revoked = j.suspended; j.suspendUntil = 0; j.suspended = null; } // 執行猶予の取消し（刑法26条）
  const prisonDays = sen.kind === 'prison' ? Math.max(1, monthsToDays(sen.months) - creditDays(cs)) + (revoked ? monthsToDays(revoked.months) : 0) : 0;
  addRecord(g, cs, sen.kind, { months: sen.months || 0, fine: sen.fine || 0, suspend: sen.suspend || 0, label, release: st.day + prisonDays });
  j.stats.convictions = (j.stats.convictions || 0) + 1;
  emit(g, 'convicted', { crime: cs.crime, caseId: cs.id, sentence: { ...sen }, label });
  if (cs.bail) { st.money += cs.bail.amount; await narrate(g, `（保釈保証金${fmtMoney(cs.bail.amount)}が返ってきた）`); cs.bail = null; }
  if (knownFigure(g)) news(g, `${whoInNews(g, '被告')}に${label}の${cs.court && /簡易/.test(cs.court) ? '略式命令' : '判決'}。`);
  careerSanction(g, sen.kind === 'prison' ? 5 : sen.kind === 'suspended' ? 4 : 2, { crime: cs.crime, extraDays: prisonDays, force: sen.kind !== 'fine' });
  applyCivicBan(g, cs, sen, prisonDays);
  await politicsAfterConviction(g, cs, sen);
  familyMessage(g, sen.kind === 'prison' ? 'prison' : sen.kind === 'suspended' ? 'suspended' : 'fined');
  closeCase(g, cs, sen.kind);
  if (revoked) await narrate(g, `（前の事件の執行猶予が取り消された。\n${laborWord(g, revoked.labor)}${fmtTerm(revoked.months)}も、あわせて服役することになる）`);
  if (sen.tsuicho) await fineImpl(g, sen.tsuicho, '追徴金', { kind: 'tsuicho', flow });
  if (sen.kind === 'fine') {
    await fineImpl(g, sen.fine, sen.karyo ? '科料' : '罰金', { kind: sen.karyo ? 'karyo' : 'bakkin', flow });
    return release(g, flow, cs, cs.detained ? '（罰金を納めて、釈放された…）' : null);
  }
  if (sen.extraFine) await fineImpl(g, sen.extraFine, '罰金', { kind: 'bakkin', flow });
  if (sen.kind === 'suspended') {
    j.suspendUntil = st.day + years(sen.suspend);
    j.suspended = { months: sen.months, labor: sen.labor, crime: cs.crime };
    j.supervision = !!sen.supervision;
    if (sen.supervision) j.probationUntil = Math.max(num(j.probationUntil), j.suspendUntil);
    await narrate(g, `（執行猶予${sen.suspend}年。この間にまた罪を犯せば、\n猶予は取り消され、刑務所に入ることになる）`);
    return release(g, flow, cs, cs.detained ? '（拘置所から釈放された…）' : null);
  }
  j.custody = null;
  j.prison = { kind: kokinEra(g) ? 'kokin' : sen.labor === 'kinko' ? 'kinko' : 'choeki', labor: sen.labor, place: 'keimusho', start: st.day, days: prisonDays, until: st.day + prisonDays, behaviour: 50, reward: 0, parole: null, caseId: cs.id, months: sen.months + (revoked ? revoked.months : 0) };
  await serveSentenceFlow(g, flow);
  return 'prison';
}

// ---------------------------------------------------------------- prison (and 少年院・労役場)
function housingOnEntry(g, pr) {
  const st = g.state, j = J(g);
  if (pr.days <= monthsToDays(2) || pr.kind === 'roueki') return null;
  j.flags.leaseCancelled = st.housing || 'dotsou';
  return j.flags.leaseCancelled;
}
function visitorOf(g) {
  const st = g.state;
  const m = family(g)[0];
  if (m) {
    const k = famKansai(g);
    return { name: RELATIONS[m.rel].call, look: familyLook(m, playerLook(g)), lines: k ? ['…ちゃんと食べとるか？顔色、悪いで。', 'あと少しや。出てくる日、迎えに行くからな。'] : ['…ちゃんと食べてる？顔色、よくないよ。', 'あと少しだからね。出てくる日は、迎えに行くから。'] };
  }
  const pid = st.partner || Object.keys(st.people || {}).find((id) => st.people[id].special) || (g.friends ? g.friends(3)[0] : null);
  const def = pid && PEOPLE[pid];
  if (def) return { name: def.name, look: def.look, lines: st.partner === pid ? ['お前のおらん舞台、ほんまにつまらんわ。', '帰ってきたら、また一緒にやろな。待っとるで。'] : ['手紙、届いてる？…みんな待ってるよ。', 'ちゃんと戻ってきてね。'] };
  return null;
}
async function prisonEvent(g, flow, pr, k, place) {
  const st = g.state;
  const juvenile = pr.kind === 'shonenin';
  const types = ['work', 'visit', 'trouble', 'letter', 'reflect', 'training', 'visit'];
  const type = types[k % types.length];
  if (type === 'work') {
    await flow.show('keimusho', { title: place, sub: juvenile ? '職業指導' : '刑務作業' });
    if (pr.kind === 'kinko') {
      const i = await ask(g, SP.keimukan, '禁錮刑には、作業の義務はない。\n希望すれば作業ができるが、どうする？', ['作業をする（請願作業）', '作業はしない']);
      if (i === 0) { pr.behaviour += 6; pr.petition = true; await narrate(g, '（何もしない時間のほうが、ずっとつらかった）'); }
      return;
    }
    const i = await ask(g, SP.keimukan, pr.kind === 'kokin' ? '今日から、この工場で作業をしてもらう。\n立ち直りのための指導も、あわせて受けること。' : juvenile ? '今日から、職業指導の授業に出てもらう。' : '今日から、この工場で作業をしてもらう。', ['まじめに取り組む', 'ほどほどにこなす']);
    pr.behaviour += i === 0 ? 8 : 2;
    pr.diligent = i === 0;
    await narrate(g, juvenile ? '（規則正しい生活。作文、運動、資格の勉強…）' : '（ミシンの音だけが響く工場で、黙々と手を動かした。\n作業報奨金は、ひと月に数千円ほど）');
  } else if (type === 'visit') {
    const v = visitorOf(g);
    if (!v) { await flow.show('keimusho', { title: place, sub: '面会日' }); await narrate(g, '（面会に来る人は、だれもいなかった…）'); g.addNeed('stress', 5); return; }
    await flow.show('menkai', { title: '面会室', sub: `${v.name}が面会に来た`, visitor: v.look, guard: true });
    await say(g, { name: v.name, look: v.look }, v.lines);
    g.addNeed('stress', -10);
    pr.behaviour += 2;
  } else if (type === 'trouble') {
    await flow.show('keimusho', { title: place, sub: juvenile ? '寮' : '工場' });
    const i = await ask(g, { name: juvenile ? '同じ寮の少年' : '同じ工場の受刑者', look: LK.inmate }, st.fame >= 250 ? '…おい。テレビに出てたからって、\nいい気になるなよ。' : '…おい、新入り。\nあいさつもなしか？', ['相手にしない', '言い返す']);
    if (i === 0) { pr.behaviour += 4; await narrate(g, '（目を合わせずに、やり過ごした）'); }
    else { pr.behaviour -= 25; await say(g, SP.keimukan, '何をしている！\n…懲罰の審査にかける。'); await narrate(g, '（懲罰で、しばらく独居房に入れられた。\n仮釈放が遠のいた…）'); g.addNeed('stress', 15); }
  } else if (type === 'letter') {
    await flow.show('keimusho', { title: place, sub: '手紙' });
    const m = family(g)[0];
    if (m) await narrate(g, `（${RELATIONS[m.rel].call}から手紙が届いた。\n「ふるさとは変わりないよ。体に気をつけて」）`);
    else if (st.fans >= 1000) await narrate(g, '（ファンから手紙が届いた。\n「いつまでも待っています」――）');
    else await narrate(g, '（だれからも手紙は来なかった…）');
    g.addNeed('stress', -5);
  } else if (type === 'reflect') {
    await flow.show('keimusho', { title: place, sub: '内省の時間' });
    const i = await ask(g, null, '（被害者のこと、家族のこと、これからのこと…）', ['謝罪の手紙を書く', '考えないようにする']);
    pr.behaviour += i === 0 ? 6 : -2;
  } else {
    await flow.show('keimusho', { title: place, sub: juvenile ? '教科指導' : '職業訓練' });
    const i = await ask(g, SP.keimukan, juvenile ? '資格の試験を受けてみるか？' : '職業訓練の受講者を募集している。\n希望するか？', ['参加する', 'やめておく']);
    if (i === 0) { pr.behaviour += 5; g.addSkill('talk', 1, true); await narrate(g, '（講習を最後までやりとげた。\n少しだけ、自信がついた）'); }
  }
  pr.behaviour = clamp(pr.behaviour, 0, 100);
}
async function serveSentenceFlow(g, flow) {
  const st = g.state, j = J(g);
  const pr = j.prison;
  if (!pr) return null;
  flow = flow || new Flow(g);
  j.status = 'prison';
  j.custody = null;
  const juvenile = pr.kind === 'shonenin';
  const place = juvenile ? '少年院' : prisonName(g);
  emit(g, 'jailed', { days: pr.days, kind: pr.kind });
  await flow.show('gate', { title: place, sub: juvenile ? '入院' : '入所' });
  await narrate(g, juvenile
    ? ['（少年院に入った。規則正しい生活、授業、\n職業指導、そして自分と向き合う時間…）']
    : [`（${place}に入所した。番号で呼ばれ、灰色の服に着替えた）`, pr.kind === 'kokin' ? '（2025年から、懲役と禁錮は「拘禁刑」になった。\n作業だけでなく、立ち直るための指導も受ける）' : pr.kind === 'kinko' ? '（禁錮刑には、作業の義務がない）' : '（懲役刑には、刑務作業が義務づけられている）']);
  if (housingOnEntry(g, pr)) await narrate(g, family(g).length ? '（長い刑期のあいだに、部屋は解約された。\n荷物は家族が引き取ってくれた）' : '（長い刑期のあいだに、部屋は解約された。\n大家さんが、荷物を預かってくれるという）');
  const total = Math.max(0, pr.until - st.day);
  const nScenes = clamp(Math.round(total / (MONTH_DAYS * 3)), 1, 7);
  const sceneDays = [];
  for (let i = 1; i <= nScenes; i++) sceneDays.push(pr.start + Math.round((total * i) / (nScenes + 1)));
  const legalMin = pr.start + Math.ceil(pr.days / 3); // 刑法28条（少年院の仮退院も同様に扱う）
  const reviews = [[Math.max(legalMin, pr.start + Math.ceil(pr.days * (juvenile ? 0.5 : 2 / 3))), 75], [pr.start + Math.ceil(pr.days * 0.8), 55]];
  let k = 0;
  while (st.day < pr.until && !pr.parole) {
    const marks = [...sceneDays.filter((d) => d > st.day), ...reviews.map((r) => r[0]).filter((d) => d > st.day), pr.until];
    const next = Math.min(...marks);
    const n = next - st.day;
    await flow.show('keimusho', { title: place, sub: `刑期 ${pr.days}日` });
    await passDays(g, n, { mode: 'prison', label: `― ${n >= MONTH_DAYS ? `約${Math.round(n / MONTH_DAYS)}か月` : `${n}日`}後 ―`, sub: `${place}　残り${Math.max(0, pr.until - st.day - n)}日` });
    if (st.day >= pr.until) break;
    if (sceneDays.includes(st.day)) await prisonEvent(g, flow, pr, k++, place);
    const rv = reviews.find((r) => r[0] === st.day);
    if (rv && pr.kind !== 'roueki') {
      await flow.show('hearing', { title: juvenile ? '仮退院の面接' : '地方更生保護委員会の面接', judge: LK.hogoshi, second: LK.keimukan });
      await say(g, { name: '委員', look: LK.hogoshi }, ['刑務所での生活の様子は、聞いています。', '社会に戻ったら、どう暮らしていくつもりですか。']);
      const a = await ask(g, null, '（どう答えよう）', ['迷惑をかけた人に償いたい', '早く仕事に戻りたい', '特にない']);
      pr.behaviour += [6, 2, -4][a];
      if (pr.behaviour >= rv[1]) { pr.parole = st.day; audio.sfx('good'); await say(g, { name: '委員', look: LK.hogoshi }, juvenile ? '仮退院を認めます。' : '仮釈放を認めます。\n残りの刑期は、保護観察を受けながら社会で過ごしてください。'); }
      else await say(g, { name: '委員', look: LK.hogoshi }, '…今回は、仮釈放は見送ります。');
    }
  }
  return prisonRelease(g, flow, pr, place);
}
async function prisonRelease(g, flow, pr, place) {
  const st = g.state, j = J(g);
  const parole = !!pr.parole && pr.parole < pr.until;
  // 作業報奨金: a few thousand yen a month for the months worked (禁錮 only with 請願作業)
  const worked = Math.floor(Math.max(0, st.day - pr.start) / MONTH_DAYS);
  if (pr.kind !== 'shonenin' && pr.kind !== 'roueki' && (pr.kind !== 'kinko' || pr.petition)) pr.reward = Math.max(pr.reward || 0, worked * (pr.diligent === false ? 2500 : 4500));
  j.prison = null;
  if (parole) { j.probationUntil = Math.max(num(j.probationUntil), pr.until); j.supervision = true; }
  j.status = statusNow(g);
  if (pr.reward) st.money += pr.reward;
  const m = family(g)[0];
  await flow.show('gate', { title: place, sub: parole ? (pr.kind === 'shonenin' ? '仮退院' : '仮釈放') : '出所', welcome: m ? familyLook(m, playerLook(g)) : null });
  await narrate(g, parole ? (pr.kind === 'shonenin' ? '（仮退院が決まった。重い門が、ゆっくりと開いた）' : '（仮釈放の日。重い門が、ゆっくりと開いた）') : '（刑期を終えた。重い門が、ゆっくりと開いた）');
  if (pr.reward) await narrate(g, `（作業報奨金 ${fmtMoney(pr.reward)} を受け取った）`);
  if (m) {
    const look = familyLook(m, playerLook(g));
    await say(g, { name: RELATIONS[m.rel].call, look }, famKansai(g) ? ['…おかえり。', 'さ、帰ろか。あったかいごはん作ったるからな。'] : ['…おかえり。', 'さあ、帰ろう。あったかいごはんを作るからね。']);
    familyMessage(g, 'released');
  } else await narrate(g, '（迎えはいなかった。…まずは、帰る場所を探そう）');
  if (parole) await say(g, SP.hogoshi, [`保護司の${surname(g, 3)}です。これから月に何度か、\n生活の様子を聞かせてもらいます。`, '困ったことがあったら、ひとりで抱えこまないこと。']);
  if (j.flags.leaseCancelled) {
    if (g.state.housing !== 'dotsou') g.moveHousing('dotsou');
    delete j.flags.leaseCancelled;
    g.message({ from: 'ドット荘の大家さん', kind: 'chat', text: g.fmt('{name}ちゃん、おかえり。\n前の部屋、ちょうど空いてるよ。家賃は払えるようになってからでいいからね。') });
  }
  st.rent.paidWeek = weekOf(st.day);
  st.life.stress = clamp(st.life.stress - 10, 0, 100);
  emit(g, 'released', { prison: true, parole, day: st.day });
  await flow.end({ home: true });
  return parole ? 'parole' : 'released';
}

// ---------------------------------------------------------------- fines and 労役場
export const LABOR_YEN = 5000; // 労役場留置: 1日あたりの換算額（おおむね5000円の運用）
const FINE_WORDS = { bakkin: '罰金', karyo: '科料', kare: '過料', tsuicho: '追徴金', tax: '税金', civil: '支払い' };
async function fineImpl(g, amount, reason, opts = {}) {
  const st = g.state, j = J(g);
  amount = Math.max(0, Math.round(num(amount)));
  if (!amount) return { paid: 0, labor: 0, unpaid: 0 };
  const kind = opts.kind || 'bakkin';
  const word = FINE_WORDS[kind] || '罰金';
  if (st.money >= amount) {
    st.money -= amount;
    audio.sfx('coin');
    if (!opts.quiet) g.notify(`${word} -${fmtMoney(amount)}`, { color: COLORS.bad });
    emit(g, 'fined', { amount, reason, kind, paid: amount });
    return { paid: amount, labor: 0, unpaid: 0 };
  }
  const paid = Math.max(0, st.money);
  st.money = 0;
  let rest = amount - paid;
  if (kind === 'bakkin' || kind === 'karyo') {
    const m = family(g)[0];
    let k = 0;
    if (m && !opts.noFamily) k = await g.ask(`${word}${fmtMoney(amount)}のうち、${fmtMoney(rest)}が払えない…。\n払えなければ、労役場に留置される。`, ['労役場に入る', `${RELATIONS[m.rel].call}に頼む`]);
    if (k === 1) {
      if (PEOPLE[m.id]) g.addAff(m.id, -3, true);
      await narrate(g, `（${RELATIONS[m.rel].call}が、黙って立て替えてくれた…）`);
      rest = 0;
    }
    let realDays = 0;
    if (rest > 0) {
      realDays = Math.min(kind === 'karyo' ? 30 : 730, Math.ceil(rest / LABOR_YEN)); // 刑法18条
      await laborFlow(g, opts.flow, realToGameDays(realDays), realDays, word);
    }
    emit(g, 'fined', { amount, reason, kind, paid, labor: realDays });
    return { paid, labor: realDays, unpaid: 0 };
  }
  j.unpaid += rest;
  g.message({ from: kind === 'tax' ? '税務署' : kind === 'tsuicho' ? '検察庁' : kind === 'kare' ? '区役所' : '請求元', kind: 'bill', text: `${reason}（${word}）${fmtMoney(rest)}が未納です。\n期限までに納付がない場合、財産の差押えを行います。（収入の一部から差し押さえられます）` });
  emit(g, 'fined', { amount, reason, kind, paid, unpaid: rest });
  return { paid, labor: 0, unpaid: rest };
}
async function laborFlow(g, outer, gameDays, realDays, word) {
  const st = g.state, j = J(g);
  const flow = outer || new Flow(g);
  j.prison = { kind: 'roueki', place: 'rouekijo', start: st.day, days: gameDays, until: st.day + gameDays, behaviour: 60, reward: 0, parole: null };
  j.status = 'prison';
  await flow.show('keimusho', { title: '労役場（刑事施設）', sub: `${word}が払えなかった` });
  await narrate(g, [`（${word}が払えない分は、労役場で働くことになる。\n1日${fmtMoney(LABOR_YEN)}の換算で、${realDays}日分――）`, '（刑事施設の中で、受刑者と同じように作業をする…）']);
  await passDays(g, gameDays, { mode: 'prison', label: `― ${gameDays}日後 ―`, sub: '労役場留置の満了' });
  j.prison = null;
  j.status = statusNow(g);
  await narrate(g, `（労役場を出た。${word}は、これで納めたことになる）`);
  if (!outer) await flow.end({ home: true });
}

// ======================================================================== money trouble: loans
// 消費者金融 (legal, the rate of the time, 総量規制 from 2010-06-18), 銀行カードローン (2000s-, not under
// 総量規制), 闇金 (illegal: トイチ = 10% every 10 days, 先引き, harassment; the contract is void and even
// the principal need not be repaid: 貸金業法42条・最高裁平成20年6月10日).
export const LENDERS = {
  shohisha: { name: '消費者金融', legal: true, cycle: MONTH_DAYS, companies: ['ドットローン', 'まねきキャッシング', 'すまいるクレジット', 'ひまわりファイナンス', 'あおぞらローン'] },
  bank: { name: '銀行カードローン', legal: true, cycle: MONTH_DAYS, companies: ['ドット銀行カードローン'] },
  yamikin: { name: '闇金', legal: false, cycle: 10, companies: ['090金融', 'ドット商事', 'クイック融資'] },
};
// Annual rate (yamikin: per 10 days).
export function lenderRate(g, lender, principal = 0) {
  if (lender === 'yamikin') return 0.1;
  if (lender === 'bank') return 0.145;
  if (since(g, 2010, 6)) return principal < 100000 ? 0.2 : principal < 1000000 ? 0.18 : 0.15; // 利息制限法
  if (since(g, 2000, 6)) return 0.28; // 出資法の上限29.2%（利息制限法を超える「グレーゾーン金利」）
  if (since(g, 1991, 11)) return 0.385; // 上限40.004%
  if (since(g, 1986, 11)) return 0.52; // 上限54.75%
  return 0.68; // 上限73%（1983年11月から）
}
export function rateLawText(g) {
  if (since(g, 2010, 6)) return '上限金利は利息制限法の15〜20%（2010年6月18日に改正貸金業法が完全施行）。貸金業者からの借入れは「総量規制」で年収の3分の1まで';
  if (since(g, 2000, 6)) return '出資法の上限は29.2%。利息制限法の上限（15〜20%）との間の「グレーゾーン金利」で貸すのが当たり前の時代';
  if (since(g, 1991, 11)) return '出資法の上限は40.004%（1991年11月から）。年収による借入れの制限はまだない';
  if (since(g, 1986, 11)) return '出資法の上限は54.75%（1986年11月から）。「サラ金」の多重債務が社会問題に';
  return '出資法の上限は73%（1983年11月から）。「サラ金地獄」という言葉が生まれた時代';
}
const bankruptInProgress = (j) => !!(j.bankrupt && !j.bankrupt.discharged && !j.bankrupt.closed);
const activeLoans = (g, lenders) => J(g).loans.filter((l) => l.status !== 'void' && l.status !== 'paid' && (!lenders || lenders.includes(l.lender)));
export function loanBalance(l) { return Math.max(0, Math.round((l.principal || 0) + (l.interest || 0))); }
function loanTotalImpl(g, lender) { return activeLoans(g, lender ? [].concat(lender) : null).reduce((a, l) => a + loanBalance(l), 0); }
// 年収: income over the last game year (scaled up early in the game); a politician's 歳費 counts.
function annualIncomeImpl(g) {
  const st = g.state, j = J(g);
  const from = st.day - YEAR_DAYS;
  const sum = j.income.filter(([d]) => d > from).reduce((a, [, n]) => a + n, 0);
  const span = clamp(st.day - 1, 1, YEAR_DAYS);
  let inc = span >= YEAR_DAYS ? sum : Math.round((sum * YEAR_DAYS) / Math.max(14, span));
  const p = polState(g);
  const O = nsGet('OFFICES');
  const sal = p && p.me && p.me.office && O && O[p.me.office] && O[p.me.office].salary;
  if (sal) inc = Math.max(inc, sal * 12);
  return Math.max(0, inc);
}
function recordIncome(g, n) {
  const j = J(g), day = g.state.day;
  const last = j.income[j.income.length - 1];
  if (last && last[0] === day) last[1] += n; else j.income.push([day, n]);
  while (j.income.length && j.income[0][0] <= day - YEAR_DAYS) j.income.shift();
}
function creditBlack(g, lender) {
  const j = J(g), day = g.state.day;
  if (lender === 'bank') return Math.max(num(j.credit.bankBlackUntil), num(j.credit.blackUntil)) > day;
  return num(j.credit.blackUntil) > day;
}
function loanLimitImpl(g, lender) {
  const j = J(g);
  if (lender === 'yamikin') return 300000;
  const inc = annualIncomeImpl(g);
  if (lender === 'bank') return Math.max(0, Math.floor((since(g, 2017, 4) ? inc / 3 : inc / 2) / 10000) * 10000 - loanTotalImpl(g, 'bank'));
  if (since(g, 2010, 6)) return Math.max(0, Math.floor(inc / 3 / 10000) * 10000 - loanTotalImpl(g, 'shohisha'));
  const companies = new Set(activeLoans(g, ['shohisha']).map((l) => l.company)).size;
  return companies >= 5 ? 0 : 500000; // 1社あたりの新規の目安（総量規制の前は、ほかの会社でも借りられた）
}
function borrowImpl(g, lender, amount, opts = {}) {
  const st = g.state, j = J(g), L = LENDERS[lender];
  GAME = g;
  if (!L) return { ok: false, reason: 'その貸し手はいない。' };
  amount = Math.round(num(amount) / 1000) * 1000;
  if (amount <= 0) return { ok: false, reason: '金額が正しくない。' };
  if (j.status === 'detained' || j.status === 'prison') return { ok: false, reason: 'いまは借りられない。' };
  const age = ageOf(st);
  if (lender !== 'yamikin') {
    if (lender === 'bank' && !since(g, 2000, 1)) return { ok: false, reason: 'この時代、銀行は個人に気軽にお金を貸してくれない…。' };
    if (age < 20) return { ok: false, reason: '20歳以上でないと申し込めない。' };
    if (bankruptInProgress(j)) return { ok: false, reason: '破産の手続き中は、借入れはできない。' };
    if (creditBlack(g, lender)) return { ok: false, reason: '審査に通らなかった…。\n（信用情報に、延滞や破産などの事故情報が残っている）' };
    const inc = annualIncomeImpl(g);
    if (inc <= 0) return { ok: false, reason: '審査に通らなかった…。\n（安定した収入がないと、お金は借りられない）' };
    if (activeLoans(g).some((l) => l.legal !== false && l.missed > 0 && LENDERS[l.lender] && LENDERS[l.lender].legal)) return { ok: false, reason: '審査に通らなかった…。\n（ほかの借入れを延滞している）' };
    if (lender === 'bank' && inc < 2000000 && st.fame < 250) return { ok: false, reason: '審査に通らなかった…。\n（年収の条件を満たしていない）' };
    const limit = loanLimitImpl(g, lender);
    if (amount > limit) {
      const why = lender === 'shohisha' && since(g, 2010, 6) ? `総量規制で、貸金業者からの借入れは年収の3分の1まで。\nあと${fmtMoney(limit)}までしか借りられない。` : limit <= 0 ? 'もう、どこも貸してくれない…。' : `いま借りられるのは${fmtMoney(limit)}までだ。`;
      return { ok: false, reason: why, limit };
    }
  }
  const used = new Set(activeLoans(g, [lender]).map((l) => l.company));
  const company = opts.company || L.companies.find((c) => !used.has(c)) || L.companies[0];
  const rate = lenderRate(g, lender, amount + loanTotalImpl(g, lender));
  const received = lender === 'yamikin' ? Math.round((amount * 0.9) / 1000) * 1000 : amount; // 闇金の「先引き」
  const loan = { id: j.nextId++, lender, company, principal: amount, interest: 0, rate, cycle: L.cycle, due: st.day + L.cycle, missed: 0, borrowed: st.day, status: 'ok', harass: 0, first: amount, paid: 0 };
  j.loans.push(loan);
  st.money += received;
  if (lender === 'yamikin') g.addNeed('stress', 6);
  emit(g, 'loan', { lender, amount, received, loan });
  ensureLoanApp();
  return { ok: true, loan, received };
}
function repayImpl(g, which, amount) {
  const st = g.state, j = J(g);
  const loan = typeof which === 'object' ? which : j.loans.find((l) => l.id === which) || j.loans[which];
  if (!loan || loan.status === 'void' || loan.status === 'paid') return { paid: 0, left: 0, cleared: true };
  const bal = loanBalance(loan);
  const pay = Math.max(0, Math.min(Math.round(num(amount, bal)), bal, st.money));
  if (pay <= 0) return { paid: 0, left: bal, cleared: false };
  st.money -= pay;
  const toInt = Math.min(pay, loan.interest || 0);
  loan.interest = Math.max(0, (loan.interest || 0) - toInt);
  loan.principal = Math.max(0, loan.principal - (pay - toInt));
  loan.paid = (loan.paid || 0) + pay;
  const left = loanBalance(loan);
  if (left <= 0) {
    loan.status = 'paid';
    j.loans = j.loans.filter((l) => l !== loan);
    if (j.garnish && j.garnish.loanId === loan.id) j.garnish = null;
  } else if (loan.missed && pay >= Math.min(left + pay, minPayment(loan))) { loan.missed = 0; if (loan.status === 'late') loan.status = 'ok'; }
  audio.sfx('coin');
  return { paid: pay, left, cleared: left <= 0 };
}
function minPayment(l) {
  const bal = loanBalance(l);
  if (l.lender === 'yamikin') return Math.min(bal, Math.round(l.interest || l.principal * 0.1));
  if (l.fixed) return Math.min(bal, l.fixed);
  return Math.min(bal, Math.max(2000, Math.round(bal * 0.03 / 1000) * 1000));
}
const YAMI_LINES = [
  '期日だぞ。払えないなら、どうなるか分かってるよな？',
  '利息も払えねえのか？\n事務所にも電話してやろうか。',
  'おまえの実家の番号、分かってるからな。',
  'いまから、家に行くわ。逃げんなよ。',
];
// Interest, payment days, collection. Runs every day (also inside: loans do not stop).
export function loanTick(g, opts = {}) {
  const st = g.state, j = J(g), day = st.day;
  const notes = g.morningNotes || (g.morningNotes = []);
  for (const l of j.loans.slice()) {
    if (l.status === 'void' || l.status === 'paid' || l.status === 'frozen') continue;
    if (l.lender === 'yamikin') l.interest += l.principal * 0.01; // トイチ: 10日で1割
    else if (!l.fixed) l.interest += (l.principal * (l.missed ? Math.max(l.rate, since(g, 2010, 6) ? 0.2 : l.rate) : l.rate)) / YEAR_DAYS;
    if (day < l.due) continue;
    if (l.prepaid === l.due) { l.due = day + l.cycle; l.prepaid = null; continue; } // paid early from the phone
    l.due = day + l.cycle;
    const due = minPayment(l);
    const legal = LENDERS[l.lender] && LENDERS[l.lender].legal;
    if (st.money >= due && !l.stopped) {
      repayImpl(g, l, due);
      if (l.lender === 'yamikin') {
        g.message({ from: l.company, kind: 'bill', text: `利息${fmtMoney(due)}、確かに受け取った。元金${fmtMoney(l.principal)}は来週もそのままな。（ジャンプ）` });
        if (!opts.inside) notes.push(`（闇金に利息${fmtMoney(due)}を払った。元金は減っていない…）`);
      } else if (l.status !== 'paid') {
        g.message({ from: l.company, kind: 'bill', text: `ご返済${fmtMoney(due)}を口座から引き落としました。残高${fmtMoney(loanBalance(l))}。` });
      }
      continue;
    }
    l.missed = (l.missed || 0) + 1;
    emit(g, 'loan_missed', { loan: l, missed: l.missed });
    if (legal) {
      if (l.missed === 1) { l.status = 'late'; g.message({ from: l.company, kind: 'bill', text: `ご返済日を過ぎています。（${fmtMoney(due)}）\n遅延損害金がかかりますので、至急ご入金ください。` }); }
      if (l.missed === 2) {
        j.credit.blackUntil = Math.max(num(j.credit.blackUntil), day + years(5));
        j.credit.accidents = (j.credit.accidents || 0) + 1;
        g.message({ from: l.company, kind: 'bill', text: '延滞が続いているため、信用情報機関に「異動」として登録されました。\n今後、新しい借入れやローンの審査に通りにくくなります。' });
      }
      if (l.missed === 3) { l.status = 'accelerated'; g.message({ from: l.company, kind: 'bill', text: `期限の利益を喪失しました。\n残額${fmtMoney(loanBalance(l))}を一括でお支払いください。` }); }
      if (l.missed >= 4 && l.status !== 'court') {
        l.status = 'court';
        g.message({ from: `${courtCity(g)}簡易裁判所`, kind: 'bill', text: `${l.company}からの申立てにより、支払督促を発付しました。\n異議がなければ強制執行（給料・預金の差押え）が可能になります。` });
        const seize = Math.min(Math.floor(st.money * 0.5), loanBalance(l));
        if (seize > 0) { st.money -= seize; repayIntoLoan(l, seize); }
        j.garnish = { left: loanBalance(l), rate: 0.25, by: l.company, loanId: l.id };
        if (!opts.inside) notes.push(`（預金が差し押さえられた…。これからは収入の4分の1も差し押さえられる）`);
      }
      if (eraKey(g) === 'showa' && l.missed >= 2 && st.agency) g.message({ from: AGENCIES[st.agency].name, kind: 'chat', text: '事務所に、サラ金から何度も電話がかかってきています…。\n大丈夫ですか？' });
      g.addNeed('stress', 6);
    } else {
      l.harass = (l.harass || 0) + 1;
      const lv = Math.min(4, l.harass);
      g.message({ from: l.company, kind: 'chat', text: YAMI_LINES[lv - 1] });
      g.addNeed('stress', 6 + lv * 3);
      emit(g, 'harassment', { loan: l, level: lv });
      if (lv >= 2 && st.agency) g.message({ from: AGENCIES[st.agency].name, kind: 'chat', text: '事務所に、取り立てのような電話が何度もかかってきています。\n何かトラブルですか？ちゃんと話してください。' });
      if (lv >= 3) familyMessage(g, 'debt');
      if (lv >= 4 && !j.queue.some((e) => e.type === 'yamikin_visit')) queueEvent(g, { type: 'yamikin_visit', loanId: l.id, day: day + (opts.inside ? 0 : 1) });
      if (((l.missed >= 4 && !l.policeWarned) || l.missed >= 6) && !l.offered && !j.queue.some((e) => e.type === 'crime_offer')) { l.offered = day; queueEvent(g, { type: 'crime_offer', loanId: l.id, day: day + 1 }); }
      if (!opts.inside) notes.push('（闇金への支払いができなかった。取り立てが激しくなっていく…）');
    }
  }
}
function repayIntoLoan(l, n) {
  const toInt = Math.min(n, l.interest || 0);
  l.interest -= toInt;
  l.principal = Math.max(0, l.principal - (n - toInt));
}
// Money coming in: income for 総量規制, and 差押え (garnish 1/4 of income; unpaid 過料・税・追徴).
function incomeHook(g, n) {
  const st = g.state, j = J(g);
  recordIncome(g, n);
  let take = 0;
  if (j.garnish) {
    const l = j.loans.find((x) => x.id === j.garnish.loanId);
    if (!l || l.status === 'void' || l.status === 'paid') j.garnish = null;
    else {
      const t = Math.min(Math.floor(n * j.garnish.rate), loanBalance(l), st.money);
      if (t > 0) { st.money -= t; repayIntoLoan(l, t); take += t; }
      if (loanBalance(l) <= 0) { l.status = 'paid'; j.loans = j.loans.filter((x) => x !== l); j.garnish = null; }
    }
  }
  if (j.unpaid > 0) {
    const t = Math.min(Math.floor(n * 0.25), j.unpaid, st.money);
    if (t > 0) { st.money -= t; j.unpaid -= t; take += t; }
  }
  if (take > 0) g.notify(`差押え -${fmtMoney(take)}`, { color: COLORS.bad });
}

// ---------------------------------------------------------------- 闇金 at the door, offers of "work"
async function yamikinVisit(g, ev) {
  const st = g.state, j = J(g);
  const l = j.loans.find((x) => x.id === ev.loanId) || activeLoans(g, ['yamikin'])[0];
  if (!l || l.status === 'void') return;
  const flow = new Flow(g);
  await flow.show('door', { title: '自宅の前', sub: '夜遅く、ドアが激しく叩かれた' });
  const due = minPayment(l);
  await say(g, SP.collector, ['おい、いるんだろ！開けろ！', `利息だけでも${fmtMoney(due)}、今すぐ払え。\n近所にも、おまえのこと話してやろうか？`]);
  const k = await ask(g, null, '（どうする…？）', ['警察に通報する', 'あるだけ払う', 'ドアを開けずに耐える']);
  if (k === 0) {
    await narrate(g, '（110番に電話した。しばらくしてパトカーのサイレンが近づくと、男たちは舌打ちして去っていった）');
    await say(g, SP.police, ['大丈夫ですか。あれは闇金ですね。', '法外な利息での貸付けは犯罪です。\n闇金の契約は無効で、返す必要もないとされています。', '警察署の生活安全課と、弁護士に相談してください。']);
    l.policeWarned = st.day;
    l.harass = Math.max(0, l.harass - 2);
  } else if (k === 1) {
    const pay = Math.min(st.money, loanBalance(l));
    if (pay > 0) repayImpl(g, l, pay);
    await say(g, SP.collector, pay > 0 ? `…${fmtMoney(pay)}か。今日はこれで帰ってやる。\nまた来るからな。` : 'ゼロ？なめてんのか！\n…また来るぞ。');
    l.harass = Math.max(0, l.harass - 1);
  } else {
    await narrate(g, '（息を殺して、ドアが静かになるのを待った。\n眠れない夜だった…）');
    g.addNeed('stress', 15);
  }
  await flow.end();
}
async function crimeOffer(g, ev) {
  const st = g.state, j = J(g);
  const l = j.loans.find((x) => x.id === ev.loanId) || activeLoans(g, ['yamikin'])[0];
  if (!l || l.status === 'void') return;
  const flow = new Flow(g);
  const crime = since(g, 2004, 12) && roll(g, 0.5) ? 'account_sale' : since(g, 2003, 1) ? 'fraud_courier' : 'stolen_goods';
  const what = { account_sale: '通帳とキャッシュカードを売る', fraud_courier: '荷物を受け取ってくる', stolen_goods: '荷物を運ぶ' }[crime];
  await flow.show('yamikin', { title: '雑居ビルの一室', sub: '「話がある」と呼び出された' });
  await say(g, SP.collector, ['金がないなら、仕事を手伝え。', `${what}だけでいい。\nそれで、借金はチャラにしてやる。`]);
  const k = await ask(g, null, `（${CRIMES[crime].name}…犯罪だ。\nどうする…？）`, ['断る', '引き受ける']);
  if (k === 0) {
    await say(g, SP.collector, '…そうか。後悔するなよ。');
    await narrate(g, '（ひとりで抱えこんではいけない。\n警察か弁護士に相談しよう…）');
    l.harass += 1;
    await flow.end();
    return;
  }
  flow.hide();
  const amount = crime === 'fraud_courier' ? 2000000 : crime === 'stolen_goods' ? 500000 : 0;
  const res = await g.commitCrime(crime, { amount, pressured: true, where: '待ち合わせ場所' });
  if (!res.caught) {
    l.status = 'void';
    j.loans = j.loans.filter((x) => x !== l);
    j.flags.yamikinHook = (j.flags.yamikinHook || 0) + 1;
    await narrate(g, '（借金は「チャラ」になった。…でも、あの男たちとの縁は、もう切れない気がした）');
    g.addNeed('stress', 15);
  }
  await flow.end();
}

// ---------------------------------------------------------------- consultations and debt relief
const consultPlace = (g) => (since(g, 2006, 10) ? '法テラス（日本司法支援センター）' : '弁護士会の法律相談センター');
// The counter of a lender (places call this): terms, the law of the time, amount, borrow.
async function loanCounterImpl(g, lender, opts = {}) {
  const st = g.state, j = J(g), L = LENDERS[lender];
  if (!L) return null;
  const who = lender === 'yamikin' ? SP.yamikin : { name: `${L.companies[0]}の窓口`, look: LK.soudan };
  const rate = lenderRate(g, lender);
  await say(g, who, lender === 'yamikin'
    ? ['ウチは審査なし、即日融資。ブラックでもOKだよ。', '利息は「トイチ」――10日で1割。\n手数料は先に引かせてもらう。']
    : [`${L.name}の${L.companies[0]}です。\n実質年率は${pct(rate)}になります。`, rateLawText(g) + '。']);
  const amounts = lender === 'yamikin' ? [30000, 50000, 100000, 300000] : [50000, 100000, 300000, 500000, 1000000];
  const items = amounts.map((a) => `${fmtMoney(a)}借りる`).concat(['やめておく']);
  const k = await ask(g, who, '（いくら借りよう…）', items, { cancel: items.length - 1 });
  if (k < 0 || k >= amounts.length) return null;
  const res = borrowImpl(g, lender, amounts[k]);
  if (!res.ok) { await say(g, who, res.reason); return res; }
  await say(g, who, lender === 'yamikin'
    ? [`はい、${fmtMoney(amounts[k])}。手数料を引いて${fmtMoney(res.received)}な。`, `10日後に利息${fmtMoney(amounts[k] * 0.1)}。遅れたら…分かってるよな？`]
    : [`ご契約ありがとうございます。${fmtMoney(res.received)}をお貸しします。`, `返済日は${L.cycle}日ごとです。口座から自動で引き落とします。`]);
  return res;
}
async function consultImpl(g, topic = 'debt') {
  const st = g.state, j = J(g);
  const flow = new Flow(g);
  const free = since(g, 2006, 10) && annualIncomeImpl(g) < 3000000;
  await flow.show('bengoshi', { title: consultPlace(g), sub: topic === 'yamikin' ? '闇金の相談' : '借金の相談' });
  const sp = { name: '弁護士', look: LK.shisen };
  await say(g, sp, [`${consultPlace(g)}の相談窓口です。${free ? '\n収入が少ない方は、相談は無料です。' : ''}`, '借金の状況を、すべて正直に話してください。']);
  const yami = activeLoans(g, ['yamikin']);
  const legal = activeLoans(g, ['shohisha', 'bank']);
  if (yami.length) {
    const fee = 50000 * yami.length;
    const k = await ask(g, sp, ['闇金の契約は無効です。\n元金も含めて、返す必要はないとされています（最高裁 平成20年）。', `受任通知を送って、取り立てを止めましょう。\n費用は${fmtMoney(fee)}です。`], ['お願いする', 'やめておく']);
    if (k === 0) {
      if (st.money >= fee || free) {
        if (!free) st.money -= fee; else j.unpaid += fee;
        for (const l of yami) { l.status = 'void'; l.stopped = true; }
        j.loans = j.loans.filter((l) => l.status !== 'void');
        j.queue = j.queue.filter((e) => e.type !== 'yamikin_visit' && e.type !== 'crime_offer');
        await say(g, sp, ['闇金業者に通知を送り、警察にも連絡しました。\nもう払わなくていい。電話にも出ないでください。', free ? '（費用は法テラスの立替制度で、あとから少しずつ返す）' : '']);
        g.addNeed('stress', -20);
      } else await say(g, sp, `費用の${fmtMoney(fee)}が用意できないようですね…。\nまずは警察の生活安全課にも相談してください。`);
    }
  }
  if (!legal.length) { await flow.end(); return 'done'; }
  const total = loanTotalImpl(g, ['shohisha', 'bank']);
  const inc = annualIncomeImpl(g);
  const gray = since(g, 2007, 1) && legal.some((l) => l.rate > 0.2);
  const lines = [`借入れは${legal.length}件、合計${fmtMoney(total)}。年収は${fmtMoney(inc)}ほどですね。`];
  if (gray) lines.push('利息制限法の上限（15〜20%）を超える金利で払ってきた分は、\n計算し直して減らせます。払いすぎなら「過払い金」が戻ります。');
  await say(g, sp, lines);
  const opts = ['任意整理', ...(since(g, 2001, 4) ? ['個人再生'] : []), '自己破産', 'やめておく'];
  const k = await ask(g, sp, ['方法は、大きく分けて3つです。', '任意整理：利息をカットして、3年ほどで分割返済。\n自己破産：裁判所に免責を認めてもらい、借金をなくす。' + (since(g, 2001, 4) ? '\n個人再生：借金を大きく減らして、3年で返す。' : '')], opts, { cancel: opts.length - 1 });
  const pick = opts[k];
  await flow.end();
  if (pick === '任意整理') return debtReliefImpl(g, 'nini');
  if (pick === '個人再生') return debtReliefImpl(g, 'saisei');
  if (pick === '自己破産') return fileBankruptcyImpl(g);
  return 'none';
}
async function debtReliefImpl(g, kind) {
  const st = g.state, j = J(g);
  const legal = activeLoans(g, ['shohisha', 'bank']);
  if (!legal.length) return null;
  const flow = new Flow(g);
  const sp = { name: '弁護士', look: LK.shisen };
  const free = since(g, 2006, 10) && annualIncomeImpl(g) < 3000000;
  await flow.show('bengoshi', { title: kind === 'nini' ? '任意整理' : '個人再生', sub: consultPlace(g) });
  // 引き直し計算 (grey-zone interest recalculated to 利息制限法 after the 2006 Supreme Court ruling)
  let refund = 0;
  if (since(g, 2007, 1)) for (const l of legal) if (l.rate > 0.2) {
    const over = Math.round(((l.paid || 0) * (l.rate - 0.18)) / l.rate);
    const cut = Math.min(over, loanBalance(l));
    l.principal = Math.max(0, l.principal - Math.max(0, cut - (l.interest || 0)));
    l.interest = 0;
    refund += Math.max(0, over - cut);
  }
  if (refund > 0) { st.money += refund; await say(g, sp, `計算し直したところ、払いすぎていた利息がありました。\n過払い金${fmtMoney(refund)}が戻ってきます。`); }
  const total = loanTotalImpl(g, ['shohisha', 'bank']);
  if (kind === 'nini') {
    const fee = 40000 * legal.length;
    if (!free && st.money < fee) { await say(g, sp, `弁護士費用${fmtMoney(fee)}が必要です…。`); await flow.end(); return null; }
    if (free) j.unpaid += fee; else st.money -= fee;
    for (const l of legal) { l.rate = 0; l.interest = 0; l.fixed = Math.max(1000, Math.ceil(l.principal / 36 / 1000) * 1000); l.missed = 0; l.status = 'settled'; l.stopped = false; l.harass = 0; }
    j.garnish = null;
    j.credit.blackUntil = Math.max(num(j.credit.blackUntil), st.day + years(5));
    await say(g, sp, ['各社と交渉し、これからの利息をなくしてもらいました。', `残り${fmtMoney(total)}を、36回に分けて返していきます。\n（信用情報には5年ほど記録が残ります）`]);
    g.addNeed('stress', -15);
    await flow.end();
    return 'nini';
  }
  // 個人再生（2001年4月施行）: 最低弁済額（借金500万円以下なら100万円、それ以上は5分の1）
  if (annualIncomeImpl(g) <= 0) { await say(g, sp, '個人再生は、安定した収入があることが条件です…。'); await flow.end(); return null; }
  const fee = 400000;
  if (!free && st.money < fee) { await say(g, sp, `弁護士費用${fmtMoney(fee)}が必要です…。`); await flow.end(); return null; }
  if (free) j.unpaid += fee; else st.money -= fee;
  await flow.show('hearing', { title: `${courtCity(g)}地方裁判所`, sub: '再生計画の認可', judge: LK.judge3, lawyer: LK.shisen });
  const reduced = total <= 1000000 ? total : total <= 5000000 ? 1000000 : Math.max(1000000, Math.round(total / 5));
  await say(g, SP.hasan, ['再生計画を認可します。', `借金${fmtMoney(total)}のうち、${fmtMoney(reduced)}を\n3年かけて返済してください。`]);
  const keep = legal[0];
  j.loans = j.loans.filter((l) => !legal.includes(l) || l === keep);
  Object.assign(keep, { company: '個人再生（再生計画）', principal: reduced, interest: 0, rate: 0, fixed: Math.ceil(reduced / 36 / 1000) * 1000, missed: 0, status: 'settled', lender: 'shohisha' });
  j.garnish = null;
  j.credit.blackUntil = Math.max(num(j.credit.blackUntil), st.day + years(5));
  j.credit.bankBlackUntil = Math.max(num(j.credit.bankBlackUntil), st.day + years(since(g, 2022, 11) ? 7 : 10));
  g.addNeed('stress', -20);
  await flow.end();
  return 'saisei';
}
// 自己破産: 申立て → 破産手続開始決定（同時廃止 / 少額管財）→ 免責審尋 → 免責許可決定.
async function fileBankruptcyImpl(g, opts = {}) {
  const st = g.state, j = J(g);
  const debts = loanTotalImpl(g) + (st.rent.debt || 0);
  const flow = new Flow(g);
  const sp = { name: '弁護士', look: LK.shisen };
  if (bankruptInProgress(j)) { await narrate(g, '（破産の手続きは、もう始まっている）'); return null; }
  await flow.show('bengoshi', { title: consultPlace(g), sub: '自己破産の相談' });
  if (debts <= 0) { await say(g, sp, '借金はないようですね。'); await flow.end(); return null; }
  const inc = annualIncomeImpl(g);
  const insolvent = debts > st.money + inc; // 支払不能: about three years of a third of the income cannot cover it
  await say(g, sp, ['自己破産は、裁判所に「支払不能」と認めてもらい、\n借金の支払いを免除してもらう（免責）手続きです。', '現金は99万円まで手元に残せます。\nただし、税金や罰金は免責されません。', '手続き中は、一部の仕事（警備員など）に就けません。\n官報に名前がのり、信用情報にも記録が残ります。']);
  if (!insolvent && !opts.force) { await say(g, sp, `収入から見ると、返せない額ではありません。\n（借金${fmtMoney(debts)}・年収${fmtMoney(inc)}）任意整理を考えましょう。`); await flow.end(); return null; }
  const kanzai = st.money > 990000;
  const fee = kanzai ? 500000 + 200000 : 300000; // 弁護士費用（＋少額管財の予納金20万円）
  const terasu = since(g, 2006, 10) && inc < 3000000;
  const k = await ask(g, sp, `費用は${fmtMoney(fee)}ほど${terasu ? '。法テラスの立替制度も使えます' : ''}。\n申し立てますか？`, ['申し立てる', 'やめておく']);
  if (k !== 0) { await flow.end(); return null; }
  if (!terasu && st.money < fee) { await say(g, sp, 'まず費用を用意しないと…。\n（自分で申し立てることもできるが、手続きは大変だ）'); await flow.end(); return null; }
  if (terasu && st.money < fee) j.unpaid += fee; else st.money -= fee;
  await flow.show('hearing', { title: `${courtCity(g)}地方裁判所　破産係`, sub: '破産手続開始の決定', judge: LK.judge3, lawyer: LK.shisen });
  await say(g, SP.hasan, ['あなたについて、破産手続の開始を決定します。', kanzai ? '財産があるため、破産管財人を選任します（管財事件）。' : '配当できる財産がないため、同時に破産手続を終わらせます（同時廃止）。', 'このあと、免責について審尋を行います。']);
  for (const l of activeLoans(g)) { l.status = l.lender === 'yamikin' ? 'void' : 'frozen'; l.stopped = true; }
  j.loans = j.loans.filter((l) => l.status !== 'void');
  j.garnish = null;
  j.queue = j.queue.filter((e) => e.type !== 'yamikin_visit' && e.type !== 'crime_offer');
  j.bankrupt = { filed: st.day, discharged: false, until: null, stage: 'opened', kind: kanzai ? 'kanzai' : 'doji', debts };
  queueEvent(g, { type: 'bankruptcy', day: st.day + realToGameDays(rint(g, 60, 90)), stage: 'shinjin' });
  emit(g, 'bankrupt', { debts, kind: j.bankrupt.kind });
  g.message({ from: 'ドット・キャッシュ', kind: 'chat', text: '官報を拝見しました。破産された方でもすぐ融資OK！\nお電話ください。（※闇金の勧誘に注意）' });
  if (knownFigure(g)) { news(g, `${whoInNews(g, 'さん')}が自己破産を申し立てていたことが分かった。`); politicalHit(g, 10, 5); }
  familyMessage(g, 'bankrupt');
  g.addNeed('stress', -15);
  await flow.end();
  return 'opened';
}
async function bankruptcyStep(g, ev) {
  const st = g.state, j = J(g);
  const b = j.bankrupt;
  if (!bankruptInProgress(j)) return;
  const flow = new Flow(g);
  await flow.show('hearing', { title: `${courtCity(g)}地方裁判所`, sub: b.kind === 'kanzai' ? '債権者集会・免責審尋' : '免責審尋', judge: LK.judge3, lawyer: LK.shisen, second: b.kind === 'kanzai' ? LK.shisen : null });
  if (b.kind === 'kanzai') {
    const take = Math.max(0, st.money - 990000);
    if (take > 0) { st.money -= take; await say(g, SP.kanzai, `破産管財人です。99万円を超える財産${fmtMoney(take)}は、\n換価して債権者への配当にあてました。`); }
  }
  const k = await ask(g, SP.hasan, '借金が増えた理由を、話してください。', ['正直に話して反省を伝える', 'ごまかす']);
  const gamble = (j.stats.committed.gambling || 0) > 0;
  const repeat = j.flags.lastDischarge && st.day - j.flags.lastDischarge < years(7);
  let p = k === 0 ? 0.97 : 0.6;
  if (gamble) p -= 0.15; // 浪費・ギャンブルは免責不許可事由（裁量免責が多い）
  if (repeat) p -= 0.35;
  if (roll(g, p)) {
    await say(g, SP.hasan, ['免責を許可します。', gamble || repeat ? '免責不許可事由はありますが、反省の態度などを考え、\n裁量で免責を認めます。' : 'これで、借金の支払い義務はなくなります。']);
    for (const l of j.loans) if (l.status === 'frozen' || LENDERS[l.lender]) l.status = 'void';
    j.loans = [];
    st.rent.debt = 0;
    st.rent.late = 0;
    b.discharged = true;
    b.until = st.day;
    j.flags.lastDischarge = st.day;
    j.credit.blackUntil = Math.max(num(j.credit.blackUntil), st.day + years(5));
    j.credit.bankBlackUntil = Math.max(num(j.credit.bankBlackUntil), st.day + years(since(g, 2022, 11) ? 7 : 10));
    emit(g, 'discharged', { day: st.day });
    await narrate(g, '（借金がなくなった。肩の荷が、すっと下りた。\nもう二度と、同じことはくり返さない――）');
    g.addNeed('stress', -30);
  } else {
    await say(g, SP.hasan, '免責は、許可しません。');
    for (const l of j.loans) if (l.status === 'frozen') { l.status = 'late'; l.stopped = false; }
    j.bankrupt = { ...b, stage: 'refused', discharged: false, closed: true, until: st.day };
    await narrate(g, '（免責は認められなかった。借金は残ったままだ…）');
  }
  await flow.end();
}

// ======================================================================== smoking (and drinking)
let GAME = null; // the running game (item prices by era)
// A pack of 20 by era, in internal yen (shown ×priceRate: 昭和 ¥220, 平成90s ¥250, 平成00s ¥300, 令和 ¥600).
export const CIG_PRICE = { showa: 370, heisei_early: 335, heisei: 355, reiwa: 600 };
const cigPrice = (g) => CIG_PRICE[eraKey(g)] || 600;
registerItem('tabako', {
  name: 'タバコ（20本入り）',
  get price() { return GAME ? cigPrice(GAME) : 600; },
  desc: 'ひと箱20本。吸えるのは二十歳から。ストレスが少し減るが、体にはよくない。',
  use: async (g) => { await g.smoke(); },
});
// placeId -> rule | (g, placeDef) => rule. rule: { ok, area, law, fine (過料), patrol (chance a
// patrol sees you), smokingArea (a 喫煙所 nearby), indoor, private }. A place def may also carry
// `smoking: rule | (g) => rule`.
export const SMOKING_RULES = {};
export function registerSmokingRule(placeId, rule) { SMOKING_RULES[placeId] = rule; }
registerSmokingRule('tokyo', (g) => (since(g, 2002, 10)
  ? { ok: false, area: '千代田区（東京駅の周辺）', law: '千代田区生活環境条例', fine: 2000, patrol: 0.25, smokingArea: true }
  : { ok: true, area: '東京駅前' }));
registerSmokingRule('namba', (g) => (since(g, 2025, 1)
  ? { ok: false, area: '大阪市（市内全域）', law: '大阪市路上喫煙の防止に関する条例', fine: 1000, patrol: 0.2, smokingArea: true }
  : since(g, 2007, 4) ? { ok: false, area: '大阪市の路上喫煙禁止地区（御堂筋・なんば周辺）', law: '大阪市路上喫煙の防止に関する条例', fine: 1000, patrol: 0.15, smokingArea: true }
    : { ok: true, area: 'なんば' }));
registerSmokingRule('minato', (g) => (since(g, 2014, 7)
  ? { ok: false, area: '港区', law: '港区の喫煙マナー条例（みなとタバコルール）', fine: 0, patrol: 0.2, smokingArea: true }
  : { ok: true, area: 'テレビ局エリア' }));
registerSmokingRule('machi', (g) => (since(g, 2020, 4)
  ? { ok: false, area: 'ドット商店街', law: '（架空の）ドット区路上喫煙防止条例', fine: 2000, patrol: 0.2, smokingArea: true }
  : { ok: true, area: 'ドット商店街' }));
const JUSTICE_PLACE_IDS = new Set(['keisatsu', 'kensatsu', 'saibansho', 'keimusho']);
function defaultSmokingRule(g, pid, def) {
  const homes = new Set(['home', 'jikka', ...Object.values(HOUSING).map((h) => h.place)]);
  if (homes.has(pid)) return { ok: true, private: true, area: '自分の部屋' };
  if (JUSTICE_PLACE_IDS.has(pid)) return { ok: false, area: (def && def.name) || '', law: '施設の中は全面禁煙', fine: 0, patrol: 0.9, indoor: true };
  if (/station|eki/.test(String(pid))) return since(g, 2009, 4) ? { ok: false, area: '駅', law: '駅の構内は全面禁煙（鉄道会社のルール）', fine: 0, patrol: 0.4 } : { ok: true, area: '駅の喫煙コーナー' };
  if (def && def.kind === 'building') {
    if (since(g, 2020, 4)) return { ok: false, indoor: true, area: def.name, law: '改正健康増進法（2020年4月全面施行）：原則屋内禁煙', fine: 0, patrol: 0.5, smokingArea: true };
    if (since(g, 2003, 5)) return { ok: true, area: def.name, note: '（建物の中の喫煙所で吸った）' };
    return { ok: true, area: def.name, note: '（このころは、建物の中でもどこでも吸えた）' };
  }
  return { ok: true, area: (def && def.name) || '' };
}
function canSmokeImpl(g, place) {
  const pid = typeof place === 'string' ? place : place && place.id ? place.id : g.map && g.map.placeId;
  const def = PLACES[pid];
  let rule = SMOKING_RULES[pid];
  if (typeof rule === 'function') { try { rule = rule(g, def); } catch (e) { console.error(e); rule = null; } }
  if (!rule && def && def.smoking) rule = typeof def.smoking === 'function' ? def.smoking(g) : def.smoking;
  if (!rule) rule = defaultSmokingRule(g, pid, def);
  return { ok: true, fine: 0, ...rule, place: pid, minor: ageOf(g.state) < 20 };
}
const SMOKE_LINES = {
  showa: ['ふうっと煙を吐いた。…うまい。', '紫煙が、ゆっくり天井へのぼっていく。'],
  heisei_early: ['ふうっと煙を吐いた。', 'ライターの火が、ぽっとともった。'],
  heisei: ['ふうっと煙を吐いた。', '一服すると、少し落ち着いた。'],
  reiwa: ['ふうっと煙を吐いた。', '一服すると、少し落ち着いた。'],
};
async function smokeImpl(g, opts = {}) {
  const st = g.state, j = J(g), s = j.smoke;
  GAME = g;
  if (j.status === 'detained' || j.status === 'prison') { if (!opts.silent) await narrate(g, '（ここでは、タバコは吸えない）'); return { ok: false, reason: 'inside' }; }
  if (s.cigs <= 0) {
    if (g.hasItem('tabako')) { g.takeItem('tabako'); s.cigs = 20; }
    else { if (!opts.silent) await narrate(g, '（タバコを持っていない）'); return { ok: false, reason: 'none' }; }
  }
  const rule = canSmokeImpl(g, opts.place);
  let violated = false;
  if (!rule.ok) {
    const choices = ['やめておく', ...(rule.smokingArea ? ['喫煙所で吸う'] : []), 'かまわず吸う'];
    let k = opts.anyway ? choices.length - 1 : opts.smokingArea && rule.smokingArea ? 1 : 0;
    if (!opts.silent && opts.anyway == null && opts.smokingArea == null) k = await g.ask(`（ここは禁煙だ。${rule.law || ''}${rule.fine ? `\n違反すると過料${man(rule.fine)}` : ''}）\nどうする？`, choices, { cancel: 0 });
    const pick = choices[k];
    if (pick === 'やめておく') return { ok: false, reason: 'banned', rule };
    if (pick === 'かまわず吸う') violated = true;
    else if (!opts.silent) await narrate(g, '（少し歩いて、指定の喫煙所で吸うことにした）');
  }
  s.cigs -= 1;
  s.total = (s.total || 0) + 1;
  if (s.day !== st.day) { s.day = st.day; s.today = 0; }
  s.today += 1;
  j.smoker = clamp(j.smoker + (j.smoker < 30 ? 4 : 2), 0, 100);
  const relief = s.today === 1 ? 10 : s.today === 2 ? 6 : 3;
  g.addNeed('stress', -relief);
  if (!opts.silent) await narrate(g, `（${pickR(g, SMOKE_LINES[eraKey(g)] || SMOKE_LINES.reiwa)}　ストレス -${relief}）${rule.note && rule.ok ? `\n${rule.note}` : ''}`);
  const res = { ok: true, relief, rule, minor: rule.minor, caught: false };
  if (violated) {
    if (rule.indoor && !rule.fine) {
      if (roll(g, rule.patrol ?? 0.5)) { if (!opts.silent) await say(g, { name: '施設の人', look: LK.soudan }, 'ここは禁煙です！\n喫煙は、喫煙所でお願いします。'); g.addNeed('stress', 4); res.caught = true; }
    } else {
      const r = await commitCrimeImpl(g, 'street_smoking', { rule, place: rule.place });
      res.caught = r.caught;
    }
  }
  if (rule.minor) {
    const r = await commitCrimeImpl(g, 'underage_smoking', { private: !!rule.private, where: rule.area });
    res.caught = res.caught || r.caught;
  }
  return res;
}
function buyCigarettesImpl(g, n = 1, opts = {}) {
  const st = g.state;
  GAME = g;
  n = Math.max(1, Math.round(n));
  const price = cigPrice(g) * n;
  if (ageOf(st) < 20) {
    if (since(g, 2008, 7)) return { ok: false, reason: '年齢確認で断られた…。\n（二十歳未満には売れない。自販機もtaspoがないと買えない）' };
    if (opts.counter) return { ok: false, reason: '「未成年には売れないよ」と断られた。' };
  }
  if (st.money < price) return { ok: false, reason: 'お金が足りない。' };
  st.money -= price;
  g.giveItem('tabako', n, true);
  return { ok: true, price, packs: n, vending: ageOf(st) < 20 };
}
// Every morning: cravings, and the long-term cost (the body: less stamina each morning).
function smokeTick(g) {
  const st = g.state, j = J(g), s = j.smoke;
  const notes = g.morningNotes || (g.morningNotes = []);
  const y = s.day === st.day - 1 ? s.today : 0;
  s.yesterday = y;
  if (y > 0) { s.clean = 0; s.load = (s.load || 0) + y; }
  else { s.clean = (s.clean || 0) + 1; j.smoker = Math.max(0, j.smoker - 3); }
  if (j.smoker >= 25 && y === 0) {
    g.addNeed('stress', Math.round(j.smoker / 8));
    if (!s.cravedDay || st.day - s.cravedDay > 3) { s.cravedDay = st.day; notes.push('（タバコが吸いたくて、そわそわする…）'); }
  }
  while (s.load >= 150) {
    s.load -= 150;
    if (s.lost < 20) { s.lost += 1; if (s.lost % 3 === 1) notes.push(`（最近、すぐ息が切れる…。タバコのせいかもしれない。\n体力の最大値 -${s.lost}）`); }
  }
  if (s.clean >= 30 && s.lost > 0 && s.clean % 30 === 0) { s.lost -= 1; notes.push('（タバコをやめて、体が軽くなってきた）'); }
  if (s.lost > 0) st.stamina = Math.min(st.stamina, Math.max(1, st.maxStamina - s.lost));
}
async function drinkImpl(g, opts = {}) {
  const st = g.state;
  if (ageOf(st) < 20) {
    const r = await commitCrimeImpl(g, 'underage_drinking', { private: !!opts.private, where: opts.where });
    return { ok: true, minor: true, caught: r.caught };
  }
  if (opts.relief) g.addNeed('stress', -opts.relief);
  if (opts.heavy && roll(g, 0.2)) { const r = await commitCrimeImpl(g, 'drunk', { where: opts.where }); return { ok: true, drunk: true, caught: r.caught }; }
  return { ok: true };
}

// ======================================================================== commit, heat, surfacing
function addHeat(g, id, c = {}) {
  const j = J(g), day = g.state.day;
  const h = j.heat[id] || (j.heat[id] = { n: 0, day, first: day, amount: 0 });
  h.n += 1;
  h.day = day;
  h.amount += Math.max(0, Math.round(num(c.amount)));
  if (c.injury) h.injury = true;
  if (c.of) h.of = c.of;
  if (c.where) h.where = c.where;
  if (c.request != null) h.request = c.request;
  h.queued = false;
  return h;
}
function applyGain(g, gain = {}) {
  if (gain.money) g.state.money += Math.round(gain.money); // not income: it is not counted for 年収
  if (gain.item) g.giveItem(gain.item, gain.n || 1, true);
}
async function commitCrimeImpl(g, id, ctx = {}) {
  const st = g.state, j = J(g), def = CRIMES[id];
  GAME = g;
  if (!def) { console.error('commitCrime: unknown crime', id); return { caught: false, report: null }; }
  if (def.exists && !def.exists(g)) return { caught: false, report: { crime: id, none: true, text: 'この時代には、まだその罪はない' } };
  if (j.status === 'detained' || j.status === 'prison') return { caught: false, report: { crime: id, none: true, text: 'いまはできない' } };
  const prev = num(j.stats.committed[id]);
  j.stats.committed[id] = prev + 1;
  const c = { ...ctx, n: prev, where: ctx.where || placeName(g), age: ageOf(st) };
  if (id === 'street_smoking' && !c.rule) c.rule = canSmokeImpl(g);
  if (def.warnFirst && !j.flags['warned_' + id]) c.warnFirst = true;
  let p = ctx.detect != null ? ctx.detect : def.detect(g, c);
  if (ctx.risk != null) p *= ctx.risk;
  if (ctx.forceCaught) p = 1;
  if (ctx.neverCaught) p = 0;
  p = clamp(p, 0, 1);
  const caught = roll(g, p);
  const report = { crime: id, name: def.name, law: crimeLaw(g, id, c), chance: Math.round(p * 1000) / 1000, caught, when: caught ? 'now' : 'later', day: st.day };
  if (!caught) {
    if (def.kind !== 'admin') addHeat(g, id, c);
    if (ctx.gain) applyGain(g, ctx.gain);
    return { caught: false, report };
  }
  j.stats.caught[id] = num(j.stats.caught[id]) + 1;
  emit(g, 'caught', report);
  if (ctx.handle === false) return { caught: true, report };
  let outcome;
  try {
    if (def.kind === 'admin') outcome = await streetSmokingCaught(g, c);
    else if (def.kind === 'hodo') outcome = await hodoFlow(g, id, c);
    else if (def.kind === 'career') outcome = await weeklyEvent(g, { crime: id, text: def.name });
    else if (id === 'shoplifting') outcome = await storeCaught(g, c);
    else if (id === 'fare_evasion') outcome = await stationCaught(g, { ...c, n: prev + 1 });
    else if (c.warnFirst) outcome = await warningFlow(g, id, c);
    else if (id === 'drunk') outcome = await drunkFlow(g, { ...c, n: prev + 1 });
    else if (id === 'tax_evasion') { addHeat(g, id, c); queueEvent(g, { type: 'tax_audit', day: st.day }); outcome = 'audit'; }
    else {
      const cs = await arrestFlow(g, id, { ...c, via: 'genkouhan', evidence: 0.95 });
      outcome = cs ? cs.outcome || cs.stage : 'arrest';
    }
  } catch (e) { console.error(e); }
  report.outcome = outcome;
  return { caught: true, report, outcome };
}
// Hot offences past the 公訴時効 are gone.
function heatCool(g) {
  const j = J(g), day = g.state.day;
  for (const id of Object.keys(j.heat)) {
    const h = j.heat[id];
    if (!CRIMES[id]) { delete j.heat[id]; continue; }
    if (day - num(h.day) >= years(limitYears(g, id, h))) delete j.heat[id];
  }
}
const SOURCES = {
  shoplifting: ['防犯カメラの映像'], robbery: ['防犯カメラの映像', '目撃証言'], assault: ['被害届', '目撃証言'],
  fare_evasion: ['改札の記録'], slush_fund: ['市民団体の告発', '元秘書の内部告発'], bribery_take: ['業者の供述'], bribery_give: ['業者の帳簿'],
  vote_buying: ['陣営関係者の証言'], door_to_door: ['対立陣営の通報'], fraud_courier: ['防犯カメラの映像', '共犯者の供述'],
  account_sale: ['口座の不正利用の捜査'], stolen_goods: ['共犯者の供述'], gambling: ['違法賭博店の摘発'], cover_up: ['関係者の供述'], assen: ['関係者の供述'],
};
function planSurface(g, id, h) {
  const st = g.state, def = CRIMES[id];
  const famous = st.fame >= 1000 || isPolitician(g);
  if (def.kind === 'career' || def.kind === 'hodo') {
    if (famous || (def.kind === 'career' && st.fame >= 250)) queueEvent(g, { type: 'weekly', crime: id, day: st.day, text: def.kind === 'hodo' ? `未成年なのに${id === 'underage_smoking' ? '喫煙' : '飲酒'}` : def.name, level: def.kind === 'career' ? 3 : 2 });
    else delete J(g).heat[id];
    return;
  }
  if (famous && !h.weekly && ['slush_fund', 'bribery_take', 'bribery_give', 'assen', 'gambling', 'vote_buying', 'antisocial_ties'].includes(id) && roll(g, 0.6)) {
    h.weekly = true;
    h.queued = false;
    h.boost = 3;
    queueEvent(g, { type: 'weekly', crime: id, day: st.day, text: `${def.name}の疑い` });
    return;
  }
  if (id === 'tax_evasion') { queueEvent(g, { type: 'tax_audit', day: st.day }); return; }
  if (id === 'cover_up' && h.of && J(g).heat[h.of]) { const o = J(g).heat[h.of]; o.boost = 4; o.coveredUntil = 0; o.queued = false; }
  const source = pickR(g, SOURCES[id] || ['関係者の供述']);
  if (def.severity >= 3) queueEvent(g, { type: 'arrest', crime: id, day: st.day, source, amount: h.amount, injury: h.injury, request: h.request, evidence: 0.75 + (h.boost ? 0.1 : 0) });
  else queueEvent(g, { type: 'summons', crime: id, day: st.day, source, amount: h.amount, injury: h.injury, evidence: 0.7 });
}
function surfaceHeat(g) {
  const st = g.state, j = J(g);
  heatCool(g);
  for (const id of Object.keys(j.heat)) {
    const def = CRIMES[id], h = j.heat[id];
    if (h.queued) continue;
    let p = 0;
    try { p = def.later(g, h) || 0; } catch (e) { console.error(e); }
    p *= h.boost || 1;
    if (st.day - num(h.day) > (def.hotDays ?? 30)) p *= 0.25;
    if (num(h.coveredUntil) > st.day) p *= 0.3;
    if (!roll(g, clamp(p, 0, 0.6))) continue;
    h.queued = true;
    emit(g, 'exposed', { crime: id, heat: { ...h } });
    planSurface(g, id, h);
  }
}
// The politics core's 裏金 (pol().me.secret) is an undetected 政治資金規正法違反.
function syncPoliticsHeat(g) {
  const p = polState(g);
  if (!p || !p.me) return;
  const j = J(g);
  const secret = num(p.me.secret), exposed = num(p.me.exposed);
  const h0 = j.heat.slush_fund;
  // the money was written into a proper report (訂正) without being exposed: the risk mostly goes away
  if (h0 && h0.fromPol && secret < num(h0.polSecret) && exposed <= num(h0.polExposed)) {
    h0.amount = Math.max(0, h0.amount - (num(h0.polSecret) - secret) * 0.8);
    h0.polSecret = secret;
    if (h0.amount < 100000) delete j.heat.slush_fund;
  }
  if (!(secret > 0)) return;
  const h = j.heat.slush_fund || (j.heat.slush_fund = { n: 1, day: g.state.day, first: g.state.day, amount: 0 });
  h.fromPol = true;
  h.polExposed = exposed;
  if (secret > num(h.polSecret)) { h.amount += secret - num(h.polSecret); h.day = g.state.day; }
  h.polSecret = secret;
}
async function weeklyEvent(g, ev) {
  const st = g.state, j = J(g), id = ev.crime, def = CRIMES[id] || { name: ev.text || 'スキャンダル', kind: 'career' };
  const flow = new Flow(g);
  const mag = '週刊ドット';
  await flow.show('press', { title: `${mag}　直撃取材`, sub: '家を出たところで、記者に囲まれた' });
  await say(g, SP.kisha, [`${mag}です！\n「${ev.text || def.name}」について、ひと言お願いします！`, '写真もあるんですよ。事実なんですか？']);
  const k = await ask(g, null, '（どう答える…？）', ['事実を認めて謝罪する', 'ノーコメント', '否定する'], { cancel: 1 });
  const level = ev.level || (def.kind === 'career' ? 3 : 2);
  news(g, `【${mag}】${whoInNews(g, 'さん')}に「${ev.text || def.name}」の疑い。`);
  careerSanction(g, level, { crime: CRIMES[id] ? id : null, soft: k === 0 });
  if (isPolitician(g)) politicalHit(g, 10 + level * 5, 8);
  if (k === 0) await narrate(g, '（記者会見を開いて、深く頭を下げた。\nフラッシュの光が、いつまでも止まなかった）');
  else if (k === 2) { j.flags.denied = (j.flags.denied || 0) + 1; await narrate(g, '（「事実ではありません」と言い切った。\n…でも、記者の目は笑っていなかった）'); }
  familyMessage(g, 'scandal');
  const h = j.heat[id];
  if (h && CRIMES[id] && CRIMES[id].kind === 'crime') { h.boost = Math.max(h.boost || 1, 3); h.queued = false; }
  else if (h) delete j.heat[id];
  await flow.end();
  return 'weekly';
}
async function taxAudit(g, ev) {
  const st = g.state, j = J(g);
  const h = j.heat.tax_evasion;
  if (!h) return null;
  const tax = Math.max(10000, h.amount || 0);
  const flow = new Flow(g);
  await flow.show('chosa', { title: '税務調査', sub: '税務署の調査官が来た' });
  await say(g, SP.chosakan, ['税務署の者です。過去の申告について、\n調査させていただきます。', '帳簿と通帳、領収書を見せてください。']);
  const k = await ask(g, null, '（どうする…？）', ['正直に話す', 'しらを切る']);
  if (k === 1) await say(g, SP.chosakan, '…この口座への入金は、何の収入ですか？\n取引先の記録とも突き合わせますよ。');
  const big = tax >= 10000000 || (k === 1 && tax >= 3000000 && roll(g, 0.4));
  const kasan = Math.round((tax * 0.35) / 1000) * 1000; // 重加算税（仮装・隠ぺい）35%
  const entai = Math.round((tax * 0.08) / 1000) * 1000; // 延滞税（おおよそ）
  await say(g, SP.chosakan, [`申告もれの所得税${fmtMoney(tax)}に、仮装・隠ぺいがありました。\n重加算税${fmtMoney(kasan)}と延滞税${fmtMoney(entai)}がかかります。`, '修正申告をして、納めてください。']);
  await fineImpl(g, tax + kasan + entai, '所得税の修正申告（本税・重加算税・延滞税）', { kind: 'tax' });
  delete j.heat.tax_evasion;
  if (big) {
    await narrate(g, '（後日、国税局の査察部――「マルサ」が来た。\n悪質な脱税として、検察庁に告発されることになった…）');
    await flow.end();
    if (tax >= 50000000) queueEvent(g, { type: 'arrest', crime: 'tax_evasion', day: st.day + 7, amount: tax, evidence: 0.92, source: '国税局の告発' });
    else await voluntaryCase(g, 'tax_evasion', { amount: tax, evidence: 0.9, source: '国税局の告発' });
    return 'satsu';
  }
  addRecord(g, { crime: 'tax_evasion' }, 'tax_admin', { label: '修正申告・重加算税', fine: tax + kasan + entai });
  if (knownFigure(g) && roll(g, 0.5)) { news(g, `${whoInNews(g, 'さん')}に${fmtMoney(tax)}の申告漏れ。重加算税を含めて追徴課税。`); careerSanction(g, 1, { crime: 'tax_evasion' }); }
  await flow.end();
  return 'admin';
}
async function coverUpImpl(g, id, ctx = {}) {
  const st = g.state, j = J(g), h = j.heat[id];
  if (!h || !CRIMES[id]) { await narrate(g, '（もみ消すようなことは、何もない）'); return false; }
  const cost = Math.round(ctx.cost ?? clamp(Math.round(h.amount * 0.3) + 500000, 300000, 30000000));
  const k = await g.ask([`（${CRIMES[id].name}の件を、もみ消すか…。\n関係者に${fmtMoney(cost)}を渡して、証拠を処分してもらう）`, '（自分の事件でも、他人に証拠を隠させれば\n証拠隠滅の教唆になりうる。ばれたら、もっと重くなる）'], ['やめておく', 'もみ消す'], { cancel: 0 });
  if (k !== 1) return false;
  if (st.money < cost) { await narrate(g, '（お金が足りない…）'); return false; }
  st.money -= cost;
  h.coveredUntil = st.day + years(1);
  h.boost = 1;
  const r = await commitCrimeImpl(g, 'cover_up', { amount: cost, of: id, where: ctx.where });
  return !r.caught;
}
async function investigateImpl(g, id, ctx = {}) {
  const j = J(g);
  if (!CRIMES[id]) return null;
  const h = j.heat[id] || addHeat(g, id, ctx);
  if (ctx.amount && h.amount < ctx.amount) h.amount = ctx.amount;
  h.queued = true;
  planSurface(g, id, h);
  if (ctx.now) return runEvents(g);
  return h;
}

// ======================================================================== the daily tick and queued events
export async function justiceTick(g) {
  const st = g.state;
  if (!st) return;
  const j = J(g), day = st.day;
  GAME = g;
  const notes = g.morningNotes || (g.morningNotes = []);
  if (j.suspendUntil && j.suspendUntil <= day) { j.suspendUntil = 0; j.suspended = null; notes.push('（執行猶予の期間が、何ごともなく満了した。\n刑の言渡しは効力を失った――刑法27条）'); }
  if (j.probationUntil && j.probationUntil <= day) { j.probationUntil = null; j.supervision = false; notes.push('（保護観察の期間が終わった）'); emit(g, 'probation_end', { day }); }
  if (j.civicBanUntil && j.civicBanUntil <= day) { j.civicBanUntil = null; j.civicBanWhy = null; notes.push('（公民権停止の期間が終わった。選挙権と被選挙権が戻った）'); }
  if (j.career.kinshinUntil && j.career.kinshinUntil === day) g.message({ from: st.agency ? AGENCIES[st.agency].name : 'マネージャー', kind: 'chat', text: '活動自粛の期間が明けました。\nまずは小さな舞台から、少しずつ信頼を取り戻していきましょう。' });
  if (j.supervision && j.probationUntil && (j.probationUntil - day) % (MONTH_DAYS * 3) === 0) g.message({ from: '保護司', kind: 'chat', text: g.fmt('{name}さん、変わりはないですか。\n今月の面接の日は、また連絡しますね。') });
  if (j.status !== 'detained' && j.status !== 'prison') j.status = statusNow(g);
  // banned from TV: new offers fall through
  if (j.career.tvBanUntil > day || j.career.kinshinUntil > day) {
    let n = 0;
    for (const m of st.phone.inbox) if (m && m.kind === 'offer' && !m.answered) { m.answered = 'expired'; n++; }
    if (n) notes.push('（活動自粛中のため、届いていたオファーは白紙になった…）');
  }
  syncPoliticsHeat(g);
  surfaceHeat(g);
  loanTick(g);
  smokeTick(g);
  if (j.loans.length || j.record.length || j.unpaid) ensureLoanApp();
}
onMorning(justiceTick);
async function runEvents(g) {
  const st = g.state;
  if (!st || g._jusRunning) return;
  const j = J(g);
  g._jusRunning = true;
  try {
    for (let guard = 0; guard < 8; guard++) {
      if (j.status === 'detained' || j.status === 'prison') break;
      const i = j.queue.findIndex((e) => e.day <= st.day);
      if (i < 0) break;
      const ev = j.queue.splice(i, 1)[0];
      try { await runEvent(g, ev); } catch (e) { console.error(e); }
    }
  } finally { g._jusRunning = false; }
}
async function runEvent(g, ev) {
  const cs = ev.caseId ? caseById(g, ev.caseId) : null;
  switch (ev.type) {
    case 'arrest':
      if (ev.caseId && !cs) return;
      if (cs && cs.kyodaku) news(g, `${cs.politician ? '国会は本会議で、' : ''}{fullname}議員の逮捕を許諾した。`);
      return arrestFlow(g, ev.crime, { caseId: ev.caseId, via: 'warrant', evidence: ev.evidence ?? 0.75, amount: ev.amount, injury: ev.injury, request: ev.request, source: ev.source });
    case 'summons': return voluntaryCase(g, ev.crime, ev);
    case 'decision': return cs ? decisionStage(g, new Flow(g), cs) : null;
    case 'trial': return cs ? trialFlow(g, cs) : null;
    case 'verdict': return cs ? verdictFlow(g, cs) : null;
    case 'appeal': return cs ? appealHearing(g, new Flow(g), cs, ev.level || 'koso') : null;
    case 'weekly': return weeklyEvent(g, ev);
    case 'tax_audit': return taxAudit(g, ev);
    case 'yamikin_visit': return yamikinVisit(g, ev);
    case 'crime_offer': return crimeOffer(g, ev);
    case 'bankruptcy': return bankruptcyStep(g, ev);
    default: return null;
  }
}

// ======================================================================== refusals, status, police
const TV_PLACES = new Set(['nhk', 'ntv', 'tbs', 'tvasahi', 'fujitv', 'tvtokyo', 'mbs', 'ktv', 'bs_yoshimoto']);
function isMediaJob(g, id) {
  if (TV_PLACES.has(g.map && g.map.placeId)) return true;
  return /^(prog_|regular_)|(^|_)(tv|cm|drama|radio|news|kanmuri|quiz|wipe|loke|maesetsu|kanran|report|voice|special|kansai_local|morning_drama|model_cm|cm_extra|conte_tv|radio_guest)($|_)/.test(id);
}
function refusalImpl(g, kind = 'job', def = {}) {
  const st = g.state;
  if (!st) return null;
  const j = J(g), day = st.day;
  if (j.status === 'detained' || j.status === 'prison') return '（いまは身柄を拘束されていて、何もできない…）';
  if (kind === 'job' || kind === 'regular') {
    const id = String((def && (def.id || def.title)) || '');
    const partTime = /baito|store_help|yobikomi/.test(id);
    if (j.career.kinshinUntil > day && !partTime) return [`いまは活動自粛中だ…。（あと${j.career.kinshinUntil - day}日）`, '（芸能のお仕事は受けられない。\nアルバイトなら、できるかもしれない）'];
    const onStage = kind === 'regular' && ['stage', 'event'].includes(def && def.medium);
    if (j.career.tvBanUntil > day && !onStage && (kind === 'regular' || isMediaJob(g, id))) return [`テレビ局が、起用を見送っているようだ…。\n（あと${j.career.tvBanUntil - day}日ほど）`, '（劇場やライブのお仕事から、少しずつ信頼を取り戻そう）'];
  }
  if (kind === 'audition') {
    if (j.career.kinshinUntil > day) return `いまは活動自粛中だ…。（あと${j.career.kinshinUntil - day}日）`;
    if (j.career.agencyBanUntil > day) return ['事件のことがあって、どこの事務所も、いまは契約に慎重なようだ…。', `（あと${j.career.agencyBanUntil - day}日ほど）`];
  }
  if ((kind === 'candidacy' || kind === 'vote') && civicBannedImpl(g)) return civicReasonImpl(g);
  return null;
}
function civicBannedImpl(g) { const j = J(g); return num(j.civicBanUntil) > g.state.day || j.status === 'prison'; }
function civicReasonImpl(g) {
  const j = J(g), day = g.state.day;
  if (j.status === 'prison') return '刑の執行中は、選挙権も被選挙権もない（公職選挙法11条）。';
  if (num(j.civicBanUntil) > day) return `公民権停止中（あと${j.civicBanUntil - day}日）：${j.civicBanWhy || '選挙権・被選挙権がない'}`;
  return null;
}
function statusImpl(g) {
  const st = g.state, j = J(g), day = st.day;
  return {
    status: j.status, free: j.status !== 'detained' && j.status !== 'prison',
    record: j.record.slice(), hasRecord: j.record.some((r) => ['fine', 'suspended', 'prison'].includes(r.outcome) && !r.juvenile),
    cases: j.cases.filter((c) => !c.closed).map((c) => ({ id: c.id, crime: c.crime, stage: c.stage, bail: !!c.bail, next: c.next || c.trialDay || null })),
    suspendUntil: j.suspendUntil > day ? j.suspendUntil : null, probationUntil: num(j.probationUntil) > day ? j.probationUntil : null,
    civicBanUntil: num(j.civicBanUntil) > day ? j.civicBanUntil : null, prisonUntil: j.prison ? j.prison.until : null,
    kinshinUntil: j.career.kinshinUntil > day ? j.career.kinshinUntil : null, tvBanUntil: j.career.tvBanUntil > day ? j.career.tvBanUntil : null,
    agencyBanUntil: j.career.agencyBanUntil > day ? j.career.agencyBanUntil : null,
    loans: activeLoans(g).map((l) => ({ id: l.id, lender: l.lender, company: l.company, balance: loanBalance(l), rate: l.rate, due: l.due, missed: l.missed, status: l.status })),
    debt: loanTotalImpl(g), unpaid: j.unpaid, garnish: j.garnish ? { ...j.garnish } : null,
    creditBlackUntil: num(j.credit.blackUntil) > day ? j.credit.blackUntil : null, bankrupt: j.bankrupt ? { ...j.bankrupt } : null,
    smoker: j.smoker, cigs: j.smoke.cigs, lostStamina: j.smoke.lost, heat: Object.keys(j.heat),
  };
}
const RECORD_WORDS = { fine: '罰金・科料（前科）', suspended: '執行猶予つき有罪（前科）', prison: '実刑（前科）', acquitted: '無罪', not_indicted: '不起訴', bizai: '微罪処分', hodo: '補導', warning: '警告・指導', kare: '過料', zoun: '増運賃', hogo: '保護', tax_admin: '修正申告', juvenile_fusho: '少年審判：不処分', juvenile_hogo: '少年審判：保護観察', juvenile_in: '少年院送致', juvenile_kan: '簡易送致' };
function justiceLinesImpl(g) {
  const st = g.state, j = J(g), day = st.day, s = statusImpl(g);
  const L = [];
  L.push(`いまの状態：${{ free: 'ふつう', detained: '身柄拘束中', trial: '裁判中', prison: '服役中', probation: '執行猶予・保護観察中' }[j.status] || j.status}`);
  if (s.suspendUntil) L.push(`執行猶予：あと${s.suspendUntil - day}日${j.supervision ? '（保護観察つき）' : ''}`);
  if (s.probationUntil) L.push(`保護観察：あと${s.probationUntil - day}日`);
  if (s.civicBanUntil) L.push(`公民権停止：あと${s.civicBanUntil - day}日`);
  if (s.kinshinUntil) L.push(`活動自粛：あと${s.kinshinUntil - day}日`);
  if (s.tvBanUntil) L.push(`テレビの起用見送り：あと${s.tvBanUntil - day}日`);
  if (s.creditBlackUntil) L.push(`信用情報の事故記録：あと${s.creditBlackUntil - day}日`);
  if (j.unpaid) L.push(`未納（過料・税・費用など）：${fmtMoney(j.unpaid)}`);
  if (j.garnish) L.push(`差押え中：${j.garnish.by}（収入の4分の1）`);
  if (s.debt) L.push(`借入れの合計：${fmtMoney(s.debt)}`);
  for (const c of s.cases) L.push(`事件：${CRIMES[c.crime].name}（${{ zaitaku: '在宅捜査中', indicted: '起訴', verdict_wait: '判決待ち', appeal_wait: '控訴中', kyodaku: '逮捕許諾請求中' }[c.stage] || c.stage}${c.bail ? '・保釈中' : ''}）`);
  const recs = j.record.slice(-6).reverse();
  if (recs.length) { L.push('― 記録 ―'); for (const r of recs) L.push(`${r.day}日目　${CRIMES[r.crime] ? CRIMES[r.crime].name : r.crime}：${r.label || RECORD_WORDS[r.outcome] || r.outcome}`); }
  if (j.smoker >= 20) L.push(`タバコの習慣：${j.smoker}${j.smoke.lost ? `（体力の最大値 -${j.smoke.lost}）` : ''}`);
  return L;
}
async function policeConsultImpl(g, topic = 'yamikin') {
  const flow = new Flow(g);
  await flow.show('kouban', { title: policeName(g), sub: '生活安全課の相談窓口' });
  if (topic === 'yamikin') {
    const yami = activeLoans(g, ['yamikin']);
    await say(g, SP.police, ['闇金ですね。法外な利息での貸付けは、出資法違反などの犯罪です。', '業者に警告の電話を入れます。\n脅されたら、すぐに110番してください。', '返済の義務についても、弁護士に相談するといいですよ。']);
    for (const l of yami) { l.policeWarned = g.state.day; l.harass = Math.max(0, l.harass - 2); if (roll(g, 0.4)) { l.status = 'void'; l.stopped = true; } }
    J(g).loans = J(g).loans.filter((l) => l.status !== 'void');
    g.addNeed('stress', -8);
  } else {
    await say(g, SP.police, ['お話を聞かせてください。', '危ないと思ったら、ためらわずに110番を。\nひとりで抱えこまないでくださいね。']);
  }
  await flow.end();
  return topic;
}

// ======================================================================== phone app (借入・返済)
function ensureLoanApp() {
  if (PHONE_APPS.justice) return;
  registerPhoneApp('justice', {
    name: '借入・返済', order: 47, color: '#8a5a2a',
    badge: (g) => { try { const j = g.state && g.state.justice; return j ? (j.loans || []).filter((l) => l.missed > 0 && l.status !== 'void').length : 0; } catch (e) { return 0; } },
    icon(c, x, y) {
      c.fillStyle = '#ffd23f'; c.fillRect(x + 5, y + 3, 14, 18); c.fillRect(x + 3, y + 5, 18, 14);
      c.fillStyle = '#b8902a'; c.fillRect(x + 7, y + 19, 10, 2);
      c.fillStyle = '#5a3a10'; c.fillRect(x + 8, y + 7, 2, 4); c.fillRect(x + 14, y + 7, 2, 4); c.fillRect(x + 10, y + 11, 4, 2); c.fillRect(x + 11, y + 11, 2, 7); c.fillRect(x + 8, y + 13, 8, 1); c.fillRect(x + 8, y + 15, 8, 1);
    },
    open: (g) => loansApp(g),
  });
}
async function loansApp(g) {
  for (;;) {
    const st = g.state;
    const loans = activeLoans(g);
    const items = loans.map((l) => ({ label: l.company, sub: `残高${fmtMoney(loanBalance(l))}・${l.lender === 'yamikin' ? 'トイチ（10日で1割）' : `年${pct(l.rate)}`}${l.missed ? `・延滞${l.missed}回` : ''}`, right: l.status === 'frozen' ? '停止中' : `${Math.max(0, l.due - st.day)}日後` }));
    items.push({ label: '法律相談', sub: consultPlace(g) });
    items.push({ label: '記録と手続き', sub: '前科・猶予・公民権・信用情報' });
    const i = await phoneList(g, { title: '借入・返済', color: '#8a5a2a', items });
    if (i < 0) return;
    if (i === loans.length) { await consultImpl(g, loans.some((l) => l.lender === 'yamikin') ? 'yamikin' : 'debt'); continue; }
    if (i === loans.length + 1) { await phoneInfo(g, { title: '記録と手続き', color: '#8a5a2a', lines: justiceLinesImpl(g) }); continue; }
    const l = loans[i];
    if (!l) continue;
    const bal = loanBalance(l), min = minPayment(l);
    const k = await phoneConfirm(g, { title: l.company, color: '#8a5a2a', text: `残高 ${fmtMoney(bal)}\n次の返済日まで ${Math.max(0, l.due - st.day)}日（最低${fmtMoney(min)}）\n所持金 ${fmtMoney(st.money)}`, choices: [`最低額を払う`, `全額を返す`, 'もどる'] });
    if (k === 0 || k === 1) {
      const r = repayImpl(g, l, k === 0 ? min : bal);
      if (r.paid && k === 0) l.prepaid = l.due;
      await phoneInfo(g, { title: l.company, color: '#8a5a2a', text: r.paid ? `${fmtMoney(r.paid)}を返した。${r.cleared ? '\n完済した！' : `\n残り${fmtMoney(r.left)}`}` : 'お金が足りない…。' });
    }
  }
}

// ======================================================================== g.* (installJustice)
const methods = {
  jus() { GAME = this; return J(this); },
  commitCrime(id, ctx) { return commitCrimeImpl(this, id, ctx); },
  arrest(id, ctx) { return arrestFlow(this, id, ctx); },
  trial(caseObj, opts) { const cs = caseObj && typeof caseObj === 'object' ? caseObj : caseById(this, caseObj); return trialFlow(this, cs, opts); },
  serveSentence(opts = {}) { return serveSentenceFlow(this, opts.flow); },
  hasRecord() { return J(this).record.some((r) => ['fine', 'suspended', 'prison'].includes(r.outcome) && !r.juvenile); },
  hasHistory() { return J(this).record.length > 0; },
  isFree() { const s = J(this).status; return s !== 'detained' && s !== 'prison'; },
  civicBanned() { return civicBannedImpl(this); },
  civicBanReason() { return civicReasonImpl(this); },
  fine(amount, reason, opts) { return fineImpl(this, amount, reason, opts); },
  borrow(lender, amount, opts) { return borrowImpl(this, lender, amount, opts); },
  repay(loanIndex, amount) { return repayImpl(this, loanIndex, amount); },
  loanTick(opts) { return loanTick(this, opts); },
  loanTotal(lender) { return loanTotalImpl(this, lender); },
  loanLimit(lender) { return loanLimitImpl(this, lender); },
  annualIncome() { return annualIncomeImpl(this); },
  creditBlacklisted(lender = 'shohisha') { return creditBlack(this, lender); },
  loanCounter(lender, opts) { return loanCounterImpl(this, lender, opts); },
  consultLawyer(topic) { return consultImpl(this, topic); },
  debtRelief(kind) { return kind === 'hasan' ? fileBankruptcyImpl(this) : debtReliefImpl(this, kind); },
  fileBankruptcy(opts) { return fileBankruptcyImpl(this, opts); },
  policeConsult(topic) { return policeConsultImpl(this, topic); },
  smoke(opts) { return smokeImpl(this, opts); },
  canSmokeHere(place) { return canSmokeImpl(this, place); },
  buyCigarettes(n, opts) { return buyCigarettesImpl(this, n, opts); },
  canSmoke() { return ageOf(this.state) >= 20; },
  canDrink() { return ageOf(this.state) >= 20; },
  drinkAlcohol(opts) { return drinkImpl(this, opts); },
  onJustice(event, fn) { onJustice(event, fn); },
  justiceTick() { return justiceTick(this); },
  justiceEvents() { return runEvents(this); },
  justiceRefusal(kind, def) { return refusalImpl(this, kind, def); },
  careerSanction(level, info) { return careerSanction(this, level, info); },
  investigate(id, ctx) { return investigateImpl(this, id, ctx); },
  coverUp(id, ctx) { return coverUpImpl(this, id, ctx); },
  justiceStatus() { return statusImpl(this); },
  justiceLines() { return justiceLinesImpl(this); },
  lawDate() { return lawDate(this); },
  lawYear() { return lawDate(this).year; },
  crimeLaw(id, ctx) { return crimeLaw(this, id, ctx); },
};
export function installJustice(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
  const wrap = (name, make) => {
    const orig = proto[name];
    if (typeof orig !== 'function' || orig.__justice) return;
    const w = make(orig);
    w.__justice = true;
    proto[name] = w;
  };
  // 謹慎 / TV ban: entertainment jobs, auditions and regular shows are refused (part-time jobs are not)
  wrap('job', (orig) => async function (def) {
    const why = this.state ? refusalImpl(this, 'job', def || {}) : null;
    if (why) { await this.say(why); return null; }
    return orig.call(this, def);
  });
  wrap('audition', (orig) => async function (def) {
    const why = this.state ? refusalImpl(this, 'audition', def || {}) : null;
    if (why) { this.lastAudition = 'blocked'; await this.say(why); return false; }
    return orig.call(this, def);
  });
  wrap('doRegular', (orig) => async function (id) {
    const why = this.state ? refusalImpl(this, 'regular', { id: 'regular_' + id, medium: REGULARS[id] && REGULARS[id].medium }) : null;
    if (why) { await this.say(why); return null; }
    return orig.call(this, id);
  });
  // queued events (a dawn arrest, a court date, a collector at the door) run when you wake up
  wrap('sleep', (orig) => async function (opts) {
    const r = await orig.call(this, opts);
    if (this.state) { try { await runEvents(this); } catch (e) { console.error(e); } }
    return r;
  });
  // income (年収 for 総量規制) and 差押え
  wrap('addMoney', (orig) => function (n, silent) {
    const r = orig.call(this, n, silent);
    if (n > 0 && this.state) { try { incomeHook(this, Math.round(n)); } catch (e) { console.error(e); } }
    return r;
  });
}
