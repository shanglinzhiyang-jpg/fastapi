// Government core (政府・行政・社会): 税率と税制改正, 予算（歳入・歳出・予算編成）, 行政（省庁・架空の官僚・
// 審議会・政令/省令・行政改革・天下り・官僚答弁）, 郵政民営化, 宗教（架空の団体・政教分離・宗教法人法）, 野党と与党の
// 国会戦術, 世論の声, デモ, 支持率の内訳と推移, 議席の詳細, 政権交代・総辞職の記録 (scenes: js/world/seiken.js).
// Agent A1 (govt core). API doc: test-output/api_govt.txt.
//
// ---------------------------------------------------------------- rules (non-negotiable)
// - Real parties (自由民主党, 民主党 1998-2016) appear only as the politics core shows them; this module never
//   attributes misconduct to them, never links a religious group's votes to them, and names no real person.
//   Bureaucrats, citizens, religious groups, demo organisers and every NPC are fictional.
// - Even-handed: every tax, budget item, ordinance, policy and demo shows 賛成の声 and 反対の声; no stance is "correct".
// - Religion: only FICTIONAL groups (names checked with WebSearch in 2026-10: no real group uses them). Faith is
//   respected; the law (信教の自由・政教分離・宗教法人法) is real; a problem group is shown abstractly (高額献金トラブル)
//   and lawful religion is kept apart from unlawful conduct. A 解散命令 removes the legal personality only.
// - Demos are lawful and peaceful (表現の自由, 公安条例の許可). 強制排除 by a democratic government has backlash.
// - Era correctness: rates, budgets, ministries and laws follow the date (showa 1987 / heisei_early 1996 /
//   heisei 2004 / reiwa 2026 starts; the game goes on past them and history may diverge).
//
// ---------------------------------------------------------------- facts used (WebSearch, 2026-10)
// Numbers marked 目安 are approximations for the game (not checked against an official table).
// 消費税: 1989-04 3% → 1997-04 5% → 2014-04 8% → 2019-10 10%（軽減税率8%）. (politics.js; nippon.com, zeiken.co.jp)
// 所得税の最高税率: ～1986 70%（15段階）→ 1987 60%（12段階、2年かけて6段階に）→ 1989 50%（5段階）→ 1999 37%（4段階）
//   → 2007 40%（6段階、税源移譲）→ 2015 45%. 2013-2037 は復興特別所得税（2.1%）が上乗せ。2026年3月31日成立の
//   令和8年度改正（防衛財源確保法の改正）で、2027年1月から防衛特別所得税1%を新設し、復興特別所得税を1.1%に下げて
//   2047年まで延長（合計2.1%は当面同じ）。sources: nenkin.go.jp 2027fuyoukami zeigaku.pdf, mof.go.jp zeisei26_05.pdf
//   sources: mof.go.jp tax_information/qanda019（かつては70%・平成27年分から45%）, ipp.hit-u.ac.jp tajika-060228
//   （87年度に70→60%、89年に60→50%・5段階）, 国税庁の情報を引く記事（平成11～18年分は4区分・最高37%、平成19年に6区分・40%）
// 住民税（所得割）の最高税率: 1987年度 18%（4.5～18%の14段階、soumu.go.jp 000874330）→ 1988年度 16%（目安）→ 1989年度
//   15%（3段階、目安）→ 1999年度 13%（目安）。平成18年度まで 5%・10%・13% の3段階、2007年度から 10% の比例税率
//   （道府県民税4%＋市町村民税6%。三位一体改革の税源移譲、約3兆円）。sources: soumu.go.jp, pref.osaka.lg.jp zeikai17/18
// 法人税の基本税率: 1984 43.3% → 1987 42% → 1989 40% → 1990 37.5% → 1998 34.5% → 1999 30% → 2012 25.5% → 2015 23.9%
//   → 2016 23.4% → 2018 23.2%（現行）。sources: mof.go.jp tax_policy/summary/corporation/c01（現行23.2%）, murc.jp watch_1907
//   （89年に40%）, cao.go.jp zei-cho 4zen18kai1（平成23年度改正 30.0→25.5%、平成27・28年度改正 25.5→23.2%）。
//   2026年度から防衛特別法人税（防衛力強化の財源）。source: dlri.co.jp 560687
// 相続税の最高税率: 1975-1987 75% → 1988 70%（13段階）→ 2003 50% → 2015 55%。sources: mof.go.jp property/146.pdf,
//   cao.go.jp a04kai_1, legacy.ne.jp（2015年55%）
// ガソリン税（揮発油税＋地方揮発油税。2009年3月までは地方道路税、2009年度改正で道路特定財源の一般財源化とともに改称）:
//   本則 28.7円/L、暫定（特例）税率で 53.8円/L（1979年6月から。1974年4月に「暫定的」な上乗せが始まる: 34.5円、
//   1976年7月 43.1円）。2008年4月に1か月だけ期限切れ。2025年12月31日に暫定税率を廃止（与野党合意
//   2025年11月5日）、年約1.5兆円の減収。sources: sakigake.jp 20251031, mynavi 20251208, coki.jp, ja.wikid.org 揮発油税
// 酒税（ビール 350ml缶あたり）: 77円 → 2020年10月 70円 → 2023年10月 63.35円 → 2026年10月 54.25円（平成29年度改正で
//   ビール系飲料は155,000円/kLに一本化）。1994年5月にビール増税。それより前の額（1987年 84円・1989年 73円）は 目安。
//   sources: brewers.or.jp, ht-tax.or.jp syuzeikaisei-2026
// 一般会計（当初予算）: FY1987 54兆1010億円（公債依存度19.4%: 翌年度15.6%が3.8ポイント低下, mof.go.jp 財政史 2_1）,
//   防衛関係費 3兆5174億円（GNP比1.004%, csmonitor 1986-12-31）, 国債費 約11.3兆・一般歳出 32.6兆（ndl.go.jp 目安）;
//   FY1996 75兆1049億円（pref.miyazaki.lg.jp の推移表）; FY2004 82兆1109億円・一般歳出 47兆6320億円（総務省 情報通信白書 h16）;
//   FY2026 122兆3092億円: 社会保障 39兆559億・国債費 31兆2758億・地方交付税交付金等 20兆8778億・防衛 8兆9843億・
//   公共事業 6兆1078億・文教及び科学振興 6兆406億・予備費 1兆・その他 8兆9670億（mof.go.jp 日本の財政関係資料 2026年4月）;
//   税収 83兆7350億（所得税 25兆3250億・法人税 20兆6960億, mof.go.jp 租税及び印紙収入 2026）, 新規国債 29兆5840億。
//   2025年12月26日閣議決定、2026年2月20日国会提出、年度内に成立せず3月27日に暫定予算（11日分）を閣議決定。
//   これ以外の費目別・税目別の内訳（1987・1996・2004年度）は 目安。
// 予算の流れ: 概算要求（8月末）→ 財務省原案の内示（12月下旬）→ 政府案の閣議決定 → 通常国会（衆議院が先, 憲法60条）。
//   2026年度の概算要求は122兆4454億円（kaiketsu-j.com 17920）。予備費の使用は内閣の責任で、事後に国会の承諾（憲法87条）。
// 中央省庁: 2001年1月6日に1府22省庁→1府12省庁（politics.js）。内閣人事局は2014年5月30日発足（幹部人事の一元管理）。
//   2007年の国家公務員法改正（平成19年法律第108号）で各府省による再就職のあっせんを禁止。
//   sources: cas.go.jp jinji_j, shugiin.go.jp 法律案, 人事院資料
// 郵政: 郵政省 → 2001年1月 郵政事業庁（総務省の外局）→ 2003年4月 日本郵政公社 → 2005年7月 衆院可決（233対228）→
//   8月8日 参院否決 → 衆院解散 → 9月11日 総選挙 → 10月14日 郵政民営化関連6法成立 → 2007年10月1日 民営化（日本郵政
//   グループ）→ 2012年4月27日 改正郵政民営化法成立（5月8日公布）→ 2012年10月 郵便事業会社と郵便局会社が統合して
//   日本郵便（4社体制）。sources: soumu.go.jp 白書 h18/h24, go2senkyo.com 9403, fsa.go.jp 20050808, 日本郵政 有価証券報告書,
//   ir.lib.shimane-u.ac.jp 年表
// 宗教: 憲法20条（信教の自由・政教分離）・89条（公金を宗教上の組織に支出しない）。宗教法人法: 所轄庁は原則 都道府県知事、
//   複数の都道府県にまたがる法人などは文部科学大臣（5条）。1995年改正（平成7年法律第134号、1995年12月15日公布、1996年
//   施行）で報告徴収・質問権（78条の2）を新設、行使の前に宗教法人審議会の意見を聞く。81条: 法令に違反して著しく公共の
//   福祉を害する行為などがあれば、裁判所が所轄庁・利害関係人・検察官の請求または職権で解散を命じられる（解散命令は法人格を
//   失わせるもので、信仰そのものを禁じるものではない）。2022年12月16日公布「法人等による寄附の不当な勧誘の防止等に関する
//   法律」（令和4年法律第105号、2023年1月5日施行・6月1日全面施行）。sources: shugiin.go.jp 13419951215134,
//   isvd.or.jp, jiji.com, caa.go.jp 白書2023, japaneselawtranslation.go.jp 4640
// 国会: 質問主意書は議長の承認を経て内閣に転送され、内閣は受け取った日から7日以内に答弁（国会法74条・75条）。答弁書は
//   閣議決定する。sources: sangiin.go.jp situmon, shugiin.go.jp 質問主意書
// デモ: 憲法21条（集会・表現の自由）。東京都では「集会、集団行進及び集団示威運動に関する条例」（昭和25年東京都条例第44号）
//   により東京都公安委員会の許可が必要、申請先は管轄の警察署（警視庁の審査基準）。多くの県の条例は72時間前までの申請。
//   警察は都道府県公安委員会の管理の下にあり、内閣が直接指揮するものではない。sources: keishicho.metro.tokyo.lg.jp,
//   sangiin.go.jp 答弁書 t169143, pref.ibaraki.jp
// 会派: 衆院「自由民主党・無所属の会」（2016年以降の資料で確認）、「民主党・無所属クラブ」（第148回国会から）。
//   source: gender.go.jp 1-1-a-4, shugiin.go.jp 会派別所属議員数
// Fictional: ドット仏教会, ドット明神 氏子会, ドット坂キリスト教会, 和光修養会, 蒼穹の泉 (no real group has these names;
// the problem group was 天環の泉 (てんかん…) until 2026-10: renamed so its reading is not the word for epilepsy. Its
// internal id stays 'tenkan' for old saves; it is never shown),
// every bureaucrat, citizen, demo, scandal and council report.
//
// ---------------------------------------------------------------- model in short
// - Taxes: TAXES[id] carry their real history (hist) and a revenue coefficient (兆円 per unit at the era's GDP). The
//   消費税 rate is the politics core's economy.taxRate; the rest live in g.state.govt.taxes. Changes go through
//   与党税制調査会 (proposals, Oct-Dec) → 税制改正大綱 (12月中旬) → 「所得税法等の一部を改正する法律案」 (a cabinet bill
//   that the politics core carries through the Diet, policy 'zeisei_kaisei') → in force on the date in the law (April,
//   or the month of the change). NPC cabinets follow history (HIST_REFORMS) with a probability.
// - Budget: each 一般会計 the politics core compiles (economy.budget) gets a detailed breakdown (BUDGET_ITEMS, real
//   shares of the four anchor years, interpolated), a revenue breakdown (税目別・税外収入・公債金) calibrated to the real
//   FY1987/1996/2004/2026 figures, the player's allocation (decided at the 閣議決定) and the tax deltas. The politics
//   core's areas (economy.budget.items) are kept in step, so its screens stay right.
// - Approval: politics.js computes it weekly (C.parts hook); this module adds a reason ledger (tax, budget, demos, Diet
//   tactics, religion, administration, disasters noted by other cores) and a by-segment estimate.

import { clamp, fmtMoney } from './util.js';
import { onMorning } from './life.js';
import { YEAR_DAYS, ERAS } from './profile.js';
import { Game } from './game.js';

// The politics core is optional: read through a guarded dynamic import with a literal path (one module instance,
// shared with main.js). Until it resolves (or when it failed) POL is null and every reader falls back.
let POL = null;
let polHooked = false;
let REG = null; // regime.js (A2), only when the registry lists it (read for REGIME_STEPS names)
export const GOVT_READY = import('./politics.js').then((m) => { POL = m; hookPolitics(); return true; }).catch((e) => { console.warn('[govt] politics core not loaded:', e && e.message); return false; });

export const GOVT_VERSION = 1;
const MONTH = 10; // game days per month (YEAR_DAYS / 12)
const INF = 1e9;
const ERA_START = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };

// ================================================================ small helpers
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const r1 = (v) => Math.round(num(v) * 10) / 10;
const r2 = (v) => Math.round(num(v) * 100) / 100;
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fmtCho = (n) => `${(Math.round(num(n) * 10) / 10).toLocaleString('ja-JP')}兆円`;
const sgn = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
const fmtD = (v, unit = '') => `${sgn(v)}${Math.abs(r1(v))}${unit}`;
const today = (g) => (g && g.state && g.state.day) || 1;
const eraKey = (g) => (g && g.state && g.state.profile && ERA_START[g.state.profile.era] ? g.state.profile.era : 'reiwa');
function lerpAnchors(year, anchors) {
  const ys = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  if (year <= ys[0]) return anchors[ys[0]];
  if (year >= ys[ys.length - 1]) return anchors[ys[ys.length - 1]];
  for (let i = 0; i < ys.length - 1; i++) if (year >= ys[i] && year <= ys[i + 1]) {
    const t = (year - ys[i]) / (ys[i + 1] - ys[i]);
    const a = anchors[ys[i]], b = anchors[ys[i + 1]];
    if (typeof a === 'number') return a + (b - a) * t;
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = num(a[k]) + (num(b[k]) - num(a[k])) * t;
    return out;
  }
  return anchors[ys[0]];
}

// The politics state (null when the core is missing).
function pol(g) {
  try { if (g && typeof g.pol === 'function') return g.pol(); } catch (e) { console.error(e); }
  return (g && g.state && g.state.politics) || null;
}
// The simulated date: { year, month, dom, doy (0..119 from 1 January), fy (fractional year), label, short }.
function gdate(g, day) {
  try { if (g && typeof g.polDate === 'function') return g.polDate(day); } catch (e) { /* fall back */ }
  const d = day ?? today(g);
  const abs = d - 1 + 3 * MONTH; // the game starts in April
  const year = ERA_START[eraKey(g)] + Math.floor(abs / YEAR_DAYS);
  const doy = ((abs % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  const month = Math.floor(doy / MONTH) + 1;
  return { year, month, dom: (doy % MONTH) * 3 + 1, doy, fy: year + doy / YEAR_DAYS, label: `${year}年${month}月`, short: `${year}年${month}月` };
}
const ym = (y, m) => num(y) * 12 + (num(m, 1) - 1);
const nowYM = (g) => { const d = gdate(g); return ym(d.year, d.month); };
const dateText = (y, m) => `${y}年${m}月`;
// The game day of a future (year, month) (first day of that month), from today.
function dayOfYM(g, y, m) { const d = gdate(g); return today(g) + (ym(y, m) - ym(d.year, d.month)) * MONTH - Math.floor((d.doy % MONTH)); }
function dLabel(g, day) {
  const d = gdate(g, day);
  return `${d.year}年${d.month}月${d.dom <= 10 ? '上旬' : d.dom <= 20 ? '中旬' : '下旬'}`;
}
const isPMg = (p) => !!(p && p.cabinet && p.cabinet.pm === 'player');
const myPosts = (p) => (p && p.me && Array.isArray(p.me.posts) ? p.me.posts : []);
const isNational = (p) => !!(p && p.me && (p.me.office === 'shugi' || p.me.office === 'sangi'));
const isRulingParty = (p, id) => !!(p && p.cabinet && (p.cabinet.partyIds || []).includes(id));
const realParty = (id) => !!(POL && POL.PARTY_DEFS && POL.PARTY_DEFS[id] && POL.PARTY_DEFS[id].real);
// The real-party rule in one place (politics.js govIncludesRealParty): the government includes 自民 or 民主 in any role
// (the PM's party or a partner). Without the politics core there is no government, so false.
const realInGovt = (p) => { try { return !!(POL && typeof POL.govIncludesRealParty === 'function' && POL.govIncludesRealParty(p)); } catch (e) { return false; } };
// The reason a government with a real party does not take a step the game presents as wrong (強行採決, デモの強制排除):
// the real party's organ does not agree (a lawful, neutral refusal; the same shape as regime.js's). null = no real party.
function realPartyNo(g, p, what) {
  if (!realInGovt(p)) return null;
  const ids = [...new Set([...(p.cabinet.partyIds || []), cabinetCore(p)].filter((id) => id && (realParty(id) || (p.parties[id] && p.parties[id].real))))];
  const mine = p.me && p.me.party && ids.includes(p.me.party) ? p.me.party : null;
  const id = mine || ids[0];
  const name = partyNameOf(g, id, false);
  const organ = id === 'jimin' ? `${name}の総務会は` : `${name}は党の機関で`;
  return mine
    ? `${organ}「${what}」を了承しなかった。（このゲームでは、実在の政党がこうした手段をとる場面は描かない）`
    : `連立を組む${name}が「${what}」に同意しなかった。（このゲームでは、実在の政党を含む政府がこうした手段をとる場面は描かない）`;
}
const partyNameOf = (g, id, short = true) => { try { if (typeof g.partyName === 'function') return g.partyName(id, short); } catch (e) { /* */ } return id || '無所属'; };
const npcNameOf = (g, id) => { try { if (typeof g.npcName === 'function') return g.npcName(id); } catch (e) { /* */ } return ''; };
const segWeightsOf = (year) => (POL && POL.segWeights ? POL.segWeights(year) : null);
const SEGS = () => (POL && POL.SEGMENTS) || FALLBACK_SEGMENTS;
const SEG_IDS = () => Object.keys(SEGS());
const FALLBACK_SEGMENTS = {
  young: { name: '若者' }, families: { name: '子育て世帯' }, elderly: { name: '高齢者' }, employees: { name: '会社員' }, selfemployed: { name: '自営業' },
  business: { name: '企業経営者' }, farmers: { name: '農林漁業' }, unions: { name: '労働組合' }, urban: { name: '都市住民' }, rural: { name: '地方住民' }, floating: { name: '無党派層' },
};
function postOf(p, post) { return myPosts(p).includes(post); }
function postNameNow(g, post) { try { const p = pol(g); return POL ? POL.postName(post, gdate(g).fy, p && p.me && p.me.party) : post; } catch (e) { return post; } }
// The player holds one of these cabinet posts (the PM counts for all).
function hasPost(p, ...posts) { return isPMg(p) || posts.some((x) => postOf(p, x)); }
const financeMinister = (p) => hasPost(p, 'minister_finance');

// ================================================================ hooks
const HOOKS = {};
// onGovt(event, fn(g, data)) -> unsubscribe. Events: 'tax' 'taxReform' 'budget' 'supplementary' 'reserve' 'ordinance'
// 'council' 'bureaucrat' 'admin' 'postal' 'religion' 'opposition' 'ruling' 'keyBill' 'voices' 'demo' 'approval' 'seiken'.
export function onGovt(event, fn) { (HOOKS[event] || (HOOKS[event] = [])).push(fn); return () => { HOOKS[event] = (HOOKS[event] || []).filter((f) => f !== fn); }; }
function emit(g, event, data) {
  for (const fn of HOOKS[event] || []) {
    try { const r = fn(g, data); if (r && typeof r.catch === 'function') r.catch((e) => console.error(e)); } catch (e) { console.error(e); }
  }
}

// ================================================================ TAXES
// hist: [year, month, rate, opts?] (the rate in force from that month; opts.law = year the law passed, opts.est = 目安).
// coef: 兆円 of national revenue per +1 unit at the era's GDP (目安; 法人税 0.5兆/ポイント as politics.js corp_tax_cut).
// seg: support shift per +1 unit (the scale politics.js uses for law effects: -10..10 per law); eco: per +1 unit.
export const TAXES = {
  shohi: {
    id: 'shohi', maxStep: 3, name: '消費税', short: '消費税', unit: '%', step: 1, min: 0, max: 25, kind: '間接税（国税＋地方消費税）', owner: 'politics',
    hist: [[1989, 4, 3], [1997, 4, 5, { law: 1994 }], [2014, 4, 8, { law: 2012 }], [2019, 10, 10, { law: 2012 }]], before: 0,
    // law: the real text by year (the g.taxRates() row uses the game's own history: shohiLawText)
    law: (y) => (y < 1989 ? '消費税法はまだない（大型間接税の導入が争点。1987年2月に政府が売上税法案を国会に提出した）' : '消費税法（1988年12月成立、1989年4月施行）'),
    explain: (y) => (y < 1989 ? 'ものやサービスを買うときに広くかかる税（大型間接税）。いまの日本にはまだない。導入するかどうかが大きな争点になっている。'
      : `ものやサービスを買うときに広くかかる税。景気に左右されにくく、社会保障の財源とされる。${y >= 1997 ? '税率は国税と地方消費税の合計。' : ''}${y >= 2020 ? '2019年10月からは食料品などに軽減税率（8%）がある。' : ''}`),
    pro: ['景気に左右されにくい安定した財源で、高齢化で増える社会保障を支えられる', '働く世代だけでなく、すべての世代が広く負担する', '所得税や法人税に比べ、経済活動をゆがめにくい'],
    con: ['所得の低い人ほど負担が重くなる（逆進性）', '税率を上げると消費が冷え込み、景気を悪くするおそれ', '中小の事業者には事務の負担が大きい'],
    seg: { young: -0.6, families: -1.2, elderly: -0.4, employees: -0.6, selfemployed: -1.0, business: 0.2, unions: -0.6, urban: -0.3, rural: -0.3, floating: -0.8 },
    eco: { growth: -0.12, inflation: 0.45 }, coef: 2.6,
  },
  shotoku: {
    id: 'shotoku', maxStep: 15, name: '所得税（最高税率）', short: '所得税', unit: '%', step: 1, min: 10, max: 75, kind: '直接税（国税・累進課税）',
    hist: [[1984, 1, 70], [1987, 1, 60], [1989, 1, 50], [1999, 1, 37], [2007, 1, 40], [2015, 1, 45]],
    law: '所得税法',
    // 2026: the 令和8年度改正 (所得税法等の一部を改正する法律, 成立 2026-03-31) amended the 防衛財源確保法: 防衛特別所得税 1%
    // from 2027-01 and 復興特別所得税 2.1% → 1.1%, its period extended by 10 years to 2047 (nenkin.go.jp 2027fuyoukami
    // zeigaku.pdf, mof.go.jp zeisei2026 zeisei26_05.pdf)
    note: (y) => (y >= 2027 ? '2013年から復興特別所得税が上乗せされている。2027年からは復興特別所得税1.1%（2047年まで）と防衛特別所得税1%（2026年3月成立の改正）'
      : y >= 2026 ? '2013年から復興特別所得税（所得税額の2.1%）が上乗せされている。2026年3月成立の改正で、2027年からは復興特別所得税1.1%（2047年まで延長）＋防衛特別所得税1%になる'
        : y >= 2013 ? '2013年から2037年までは復興特別所得税（所得税額の2.1%）が上乗せされる' : ''),
    explain: '個人の所得にかかる国の税。所得が多いほど高い税率がかかる累進課税で、ここでは一番上の段階（最高税率）を扱う。',
    pro: ['所得の多い人に多く負担してもらい、格差をやわらげる（所得の再分配）', '税収を増やして、財政や社会保障にまわせる'],
    con: ['働く意欲や起業の意欲をそぐおそれ', '高い所得の人や会社が海外に移るおそれ', '税率を上げても、税収の増え方は限られる'],
    seg: { business: -0.4, selfemployed: -0.2, employees: -0.05, unions: 0.3, young: 0.15, floating: 0.1, families: 0.05 },
    eco: { growth: -0.006 }, coef: 0.10,
  },
  jumin: {
    id: 'jumin', maxStep: 5, name: '住民税（所得割の最高税率）', short: '住民税', unit: '%', step: 1, min: 5, max: 20, kind: '地方税（都道府県民税＋市区町村民税）', local: true,
    hist: [[1986, 6, 18], [1988, 6, 16, { est: true }], [1989, 6, 15, { est: true }], [1999, 6, 13, { est: true }], [2007, 6, 10]],
    law: '地方税法', note: (y) => `${y >= 2007 ? '2007年度から10%の比例税率（道府県民税4%＋市町村民税6%）。' : ''}地方の財源なので、国の一般会計には入らない`,
    explain: (y) => `住んでいる都道府県と市区町村に納める税。税率は地方税法で決まる。${y < 1988 ? 'いまは14段階（最高18%）。' : y < 2007 ? '所得に応じた段階的な税率（累進）。' : '1987年度は14段階（最高18%）、平成18年度までは5・10・13%の3段階、2007年度からは一律10%。'}`,
    pro: ['地域の行政サービス（学校・ごみ・福祉）の財源になる', '税率を上げれば、地方が国に頼らず自分の財源で仕事ができる'],
    con: ['ほとんどの住民に広くかかり、家計の負担が増える', '地域によって行政サービスの差が出やすい'],
    seg: { employees: -0.5, families: -0.4, elderly: -0.2, young: -0.3, unions: -0.2, selfemployed: -0.3, urban: -0.2, rural: -0.1, floating: -0.3 },
    eco: { growth: -0.02 }, coef: 0, localCoef: 1.2,
  },
  hojin: {
    id: 'hojin', maxStep: 8, name: '法人税（基本税率）', short: '法人税', unit: '%', step: 0.1, min: 10, max: 50, kind: '直接税（国税）',
    hist: [[1984, 4, 43.3], [1987, 4, 42], [1989, 4, 40], [1990, 4, 37.5], [1998, 4, 34.5], [1999, 4, 30], [2012, 4, 25.5], [2015, 4, 23.9], [2016, 4, 23.4], [2018, 4, 23.2]],
    law: '法人税法', note: (y) => `中小法人の一定以下の所得には軽減税率がある。${y >= 2026 ? '2026年度から防衛特別法人税が上乗せされる' : ''}`,
    explain: '会社などの法人の所得（もうけ）にかかる国の税。ここでは普通法人の基本税率を扱う。',
    pro: ['もうけている企業に応分の負担を求め、暮らしの財源にできる', '税率を下げれば、企業の投資や賃上げ、海外からの進出を呼びこめる（下げる側の主張）'],
    con: ['税率を上げると、企業の投資や雇用が海外に逃げるおそれ', '税率を下げると税収が減り、財政が苦しくなる（上げる側の主張）'],
    seg: { business: -0.8, employees: -0.1, selfemployed: -0.1, unions: 0.3, families: 0.05, floating: 0.05, young: 0.05 },
    eco: { growth: -0.03, nikkei: -0.8, unemployment: 0.02 }, coef: 0.5,
  },
  sozoku: {
    id: 'sozoku', maxStep: 20, name: '相続税（最高税率）', short: '相続税', unit: '%', step: 1, min: 10, max: 80, kind: '直接税（国税）',
    hist: [[1975, 1, 75], [1988, 1, 70], [2003, 1, 50], [2015, 1, 55]],
    law: '相続税法',
    explain: '亡くなった人から財産を受け継いだときにかかる税。財産が大きいほど税率が高い。',
    pro: ['親の財産による格差が世代をこえて続くのをおさえる', 'お金持ちの財産に応分の負担を求められる'],
    con: ['中小企業や農家が、事業や土地を受け継ぎにくくなる', '一生かけて税を払ったあとの財産に、もう一度かかる（二重課税という批判）'],
    seg: { elderly: -0.3, business: -0.2, selfemployed: -0.3, farmers: -0.2, young: 0.2, unions: 0.2 },
    eco: {}, coef: 0.05,
  },
  kihatsu: {
    // 地方揮発油税 was 地方道路税 until the 2009 改正 (道路特定財源の一般財源化, 2009-04): names by year
    id: 'kihatsu', maxStep: 25.1, name: 'ガソリン税（揮発油税＋地方揮発油税）', names: [[0, 'ガソリン税（揮発油税＋地方道路税）'], [2009.25, 'ガソリン税（揮発油税＋地方揮発油税）']], short: 'ガソリン税', unit: '円/L', step: 0.1, min: 0, max: 80, kind: '間接税（国税）',
    hist: [[1974, 4, 34.5], [1976, 7, 43.1], [1979, 6, 53.8], [2008, 4, 28.7], [2008, 5, 53.8], [2026, 1, 28.7, { law: 2025 }]],
    law: (y) => (y >= 2009.25 ? '揮発油税法・地方揮発油税法（暫定税率は租税特別措置法）' : '揮発油税法・地方道路税法（暫定税率は租税特別措置法）'),
    // note(y, { rate }): the rate in force in this game (history may diverge from the real one)
    note: (y, c) => {
      const rate = c && c.rate != null ? num(c.rate) : taxRateAt('kihatsu', Math.floor(y), 4);
      if (rate <= 28.7 + 1e-6) return y >= 2026 && Math.abs(rate - 28.7) < 1e-6 ? '本則28.7円に上乗せされていた「暫定税率」25.1円は、2025年12月31日に廃止された' : '本則28.7円（上乗せ分はない）';
      return Math.abs(rate - 53.8) < 1e-6 ? '本則28.7円に、暫定的な上乗せ（1974年から。1979年6月からは25.1円）が加わって53.8円' : `本則28.7円に、暫定的な上乗せ分が加わって${rate}円`;
    },
    explain: (y) => `ガソリン1リットルにかかる税。${y >= 2009 ? 'もとは道路を整備するための財源だった（2009年度から一般財源）。' : '道路を整備するための財源（道路特定財源）。'}`,
    pro: ['安定した税収になる', '車の利用をおさえ、二酸化炭素の排出を減らす効果がある'],
    con: (y) => ['車が欠かせない地方の暮らしや、運送業の負担が重い', ...(y >= 1989.25 ? ['税金に消費税がかかる「二重課税」との批判'] : ['道路をつくるための税なのに、使い道が硬直しているという声'])],
    seg: { rural: -0.15, selfemployed: -0.1, farmers: -0.1, employees: -0.04, young: -0.04, families: -0.04, urban: 0.02 },
    eco: { inflation: 0.006, growth: -0.002 }, coef: 0.06,
  },
  sake: {
    id: 'sake', maxStep: 25, name: '酒税（ビール350ml缶あたり）', short: '酒税', unit: '円', step: 0.01, min: 0, max: 150, kind: '間接税（国税）',
    hist: [[1987, 1, 84, { est: true }], [1989, 4, 73, { est: true }], [1994, 5, 77], [2020, 10, 70, { law: 2017 }], [2023, 10, 63.35, { law: 2017 }], [2026, 10, 54.25, { law: 2017 }]],
    law: '酒税法', note: (y) => (y >= 2017 ? '2017年の改正で、ビール・発泡酒・新ジャンルの税は2026年10月に一本化（350mlあたり54.25円）' : ''),
    explain: (y) => `お酒にかかる税。ビールは昔から税が重い。${y >= 2017 ? '発泡酒などとの差をなくす改正が段階的に進められた。' : ''}`,
    pro: ['お酒の飲みすぎによる健康の問題をおさえる', '安定した税収になる'],
    con: ['お酒の値段が上がり、酒屋や飲食店の売り上げが落ちる', '庶民の楽しみへの増税との批判'],
    seg: { employees: -0.05, selfemployed: -0.06, elderly: -0.02, young: -0.02, families: 0.01 },
    eco: { inflation: 0.002 }, coef: 0.012,
  },
};
export const TAX_ORDER = Object.keys(TAXES);
// The rate in force at (year, month) from the real history (before the first entry: def.before ?? first rate).
export function taxRateAt(id, year, month = 4) {
  const T = TAXES[id];
  if (!T) return 0;
  let v = T.before ?? (T.hist[0] ? T.hist[0][2] : 0);
  for (const [y, m, r] of T.hist) if (ym(y, m) <= ym(year, month)) v = r;
  return v;
}
// History reforms the NPC 与党税調 tends to put in the 大綱 (year = the year the change takes effect; the 大綱 is the
// December before). Each item is taken with a probability; history may diverge. (rates as in TAXES.hist)
const HIST_REFORMS = [
  { year: 1988, changes: { sozoku: 70, jumin: 16 }, why: '相続税・住民税の負担の見直し（抜本的税制改革）' },
  { year: 1989, changes: { shotoku: 50, jumin: 15, hojin: 40, sake: 73 }, why: '所得・資産・消費のバランスのとれた税体系へ（抜本的税制改革）', needShohi: true },
  { year: 1990, changes: { hojin: 37.5 }, why: '法人税率の段階的な引き下げ' },
  { year: 1994, month: 5, changes: { sake: 77 }, why: 'ビールなどの酒税の見直し' },
  { year: 1998, changes: { hojin: 34.5 }, why: '法人課税の国際的な水準への見直し' },
  { year: 1999, changes: { shotoku: 37, jumin: 13, hojin: 30 }, why: '景気対策の「恒久的な減税」' },
  { year: 2003, changes: { sozoku: 50 }, why: '相続税・贈与税の税率構造の見直し' },
  { year: 2007, month: 1, changes: { shotoku: 40 }, also: { jumin: [2007, 6, 10] }, why: '国から地方への税源移譲（三位一体の改革）' },
  { year: 2012, changes: { hojin: 25.5 }, why: '法人税率の引き下げ（成長戦略）' },
  { year: 2015, changes: { shotoku: 45, sozoku: 55, hojin: 23.9 }, why: '所得の再分配機能の回復と、法人税改革' },
  { year: 2016, changes: { hojin: 23.4 }, why: '成長志向の法人税改革（2年目）' },
  { year: 2017, plan: { sake: [[2020, 10, 70], [2023, 10, 63.35], [2026, 10, 54.25]] }, why: 'ビール系飲料の税率の一本化（段階的に）' },
  { year: 2018, changes: { hojin: 23.2 }, why: '法人税率の引き下げ（3年目）' },
];

// ================================================================ BUDGET (一般会計)
// Anchors (兆円, 当初予算): FY1987 / 1996 / 2004 / 2026. 2026 items, the four totals and 1987 防衛 are verified; the
// rest are 目安 (see the facts above). その他 is the remainder so each year sums to the real total.
const BUDGET_TOTAL = { 1987: 54.101, 1996: 75.1049, 2004: 82.1109, 2026: 122.3092 };
const BUDGET_ANCHORS = {
  1987: { shakaihosho: 10.09, kokusai: 11.32, kofuzei: 10.18, kokyo: 6.08, bunkyo: 4.85, boei: 3.517, keizai: 0.68, shokuryo: 0.5, energy: 0.56, chusho: 0.21, onkyu: 1.86, yobi: 0.35 },
  1996: { shakaihosho: 14.29, kokusai: 16.38, kofuzei: 13.6, kokyo: 9.62, bunkyo: 6.31, boei: 4.85, keizai: 1.06, shokuryo: 0.27, energy: 0.68, chusho: 0.19, onkyu: 1.66, yobi: 0.35 },
  2004: { shakaihosho: 19.8, kokusai: 17.57, kofuzei: 16.91, kokyo: 7.82, bunkyo: 6.13, boei: 4.88, keizai: 0.76, shokuryo: 0.68, energy: 0.49, chusho: 0.17, onkyu: 1.05, yobi: 0.35 },
  2026: { shakaihosho: 39.0559, kokusai: 31.2758, kofuzei: 20.8778, kokyo: 6.1078, bunkyo: 6.0406, boei: 8.9843, keizai: 0.51, shokuryo: 1.27, energy: 0.84, chusho: 0.17, onkyu: 0.06, yobi: 1.0 },
};
for (const [y, a] of Object.entries(BUDGET_ANCHORS)) a.sonota = Math.round((BUDGET_TOTAL[y] - Object.values(a).reduce((s, v) => s + v, 0)) * 1000) / 1000;
// Shares of the total (interpolated by year).
const BUDGET_SHARE_ANCHORS = {};
for (const [y, a] of Object.entries(BUDGET_ANCHORS)) { BUDGET_SHARE_ANCHORS[y] = {}; for (const [k, v] of Object.entries(a)) BUDGET_SHARE_ANCHORS[y][k] = v / BUDGET_TOTAL[y]; }
// fixed: 'debt' (国債費: cannot be cut), 'formula' (地方交付税: 法定率), 'entitlement' (社会保障: 自然増), 'reserve', 'discretionary'.
// area: the politics core's budget area key (economy.budget.items) the item is counted in.
// seg / eco: per +1兆円 against the baseline (support shift scale like law effects; economy like a law).
export const BUDGET_ITEMS = {
  shakaihosho: {
    id: 'shakaihosho', name: '社会保障関係費', area: 'welfare', fixed: 'entitlement', min: -0.02, max: 0.15, ministry: 'minister_health',
    explain: '年金・医療・介護・子育て・生活保護など。高齢化で毎年「自然増」があり、給付の多くは法律で決まっているので、大きくは削れない。',
    pro: ['老後や病気のときの安心を支える', '子育て支援を手厚くすれば少子化対策になる'], con: ['毎年ふくらみ、ほかの予算や財政を圧迫する', '現役世代の負担が重くなる'],
    seg: { elderly: 0.8, families: 0.35, young: -0.15, business: -0.15, employees: -0.05 }, eco: { growth: 0.01 },
  },
  kokusai: {
    id: 'kokusai', name: '国債費', area: 'finance', fixed: 'debt', min: 0, max: 0, ministry: 'minister_finance',
    explain: '過去に発行した国債の返済（債務償還費）と利払い。借金の契約と法律で決まるので、予算で減らすことはできない。金利が上がるとふくらむ。',
    pro: ['国債をきちんと返すことで、国の信用が保たれる'], con: ['歳出の大きな割合を占め、政策に使えるお金を圧迫する'],
    seg: {}, eco: {},
  },
  kofuzei: {
    id: 'kofuzei', name: '地方交付税交付金等', area: 'regional', fixed: 'formula', min: -0.03, max: 0.03, ministry: 'minister_internal', ministries: [[0, 'minister_home'], [2001, 'minister_internal']],
    explain: '自治体の財源の差をならすために国が配るお金。国税の一定の割合（法定率）で決まるので、大きく変えるには地方交付税法の改正がいる。',
    pro: ['どこに住んでいても、一定の行政サービスを受けられる'], con: ['自治体が国に頼り、自分で財源を増やす努力をしにくい'],
    seg: { rural: 0.8, farmers: 0.2, elderly: 0.1, urban: -0.3, business: -0.1 }, eco: { growth: 0.01 },
  },
  kokyo: {
    id: 'kokyo', name: '公共事業関係費', area: 'regional', fixed: 'discretionary', min: -0.25, max: 0.3, ministry: 'minister_transport', ministries: [[0, 'minister_construction'], [2001, 'minister_transport']],
    explain: '道路・河川・港・空港・住宅・防災などのインフラ整備。景気対策として増やされることも多い。',
    pro: ['地方の雇用を生み、景気を下支えする', '防災・減災で命と暮らしを守る'], con: ['むだな事業や「ばらまき」との批判', '完成後の維持費が将来の負担になる'],
    seg: { rural: 0.8, selfemployed: 0.4, business: 0.3, farmers: 0.1, urban: -0.3, young: -0.2, floating: -0.2 }, eco: { growth: 0.04, unemployment: -0.02 },
  },
  bunkyo: {
    id: 'bunkyo', name: '文教及び科学振興費', area: 'education', fixed: 'discretionary', min: -0.15, max: 0.3, ministry: 'minister_education',
    explain: '義務教育の先生の給与（国の負担分）、国立大学、奨学金、科学技術の研究など。',
    pro: ['教育と研究は将来の成長の土台になる', '家庭の教育費の負担を減らせる'], con: ['効果が出るまで時間がかかり、成果が見えにくい'],
    seg: { families: 0.6, young: 0.6, elderly: -0.1, unions: 0.1 }, eco: { growth: 0.015 },
  },
  boei: {
    id: 'boei', name: '防衛関係費', area: 'diplomacy', fixed: 'discretionary', min: -0.15, max: 0.3, ministry: 'minister_defense',
    explain: (y) => `自衛隊の人件費・装備・訓練、基地の対策など。1976年の閣議決定で「GNP比1%」が目安とされ、1987年度予算で1%をこえた。${y >= 2023 ? '2022年に「2027年度にGDP比2%」をめざす方針が決まった。' : ''}`,
    pro: ['安全保障の環境に備え、国民の命と領土を守る', '災害派遣など、自衛隊の活動を支える'], con: ['ほかの予算を圧迫し、増税や国債につながる', '周辺国との軍拡競争になるおそれ'],
    seg: { elderly: 0.2, business: 0.2, rural: 0.1, unions: -0.4, young: -0.1, families: -0.1, floating: -0.1 }, eco: { growth: 0.01 },
  },
  keizai: {
    id: 'keizai', name: '経済協力費', area: 'diplomacy', fixed: 'discretionary', min: -0.3, max: 0.5, ministry: 'minister_foreign',
    explain: 'ODA（政府開発援助）など、途上国への援助。',
    pro: ['国際社会での信頼を高め、日本企業の進出も助ける'], con: ['国内が苦しいときに海外にお金を出すのかという声'],
    seg: { business: 0.3, urban: 0.1, rural: -0.2, elderly: -0.1 }, eco: {},
  },
  shokuryo: {
    id: 'shokuryo', name: '食料安定供給関係費', area: 'agriculture', fixed: 'discretionary', min: -0.25, max: 0.4, ministry: 'minister_agri',
    explain: (y) => (y < 1995 ? '主食のコメなどを国が管理する「食糧管理費」と、農業・漁業の支援。' : '農業・漁業の支援、主食のコメの需給の安定など。昭和のころは「食糧管理費」と呼ばれた。'),
    pro: ['食料を自分の国で確保できる（食料安全保障）', '農村と地域の暮らしを守る'], con: ['市場の競争をゆがめ、食品の値段が下がりにくい'],
    seg: { farmers: 1.0, rural: 0.5, urban: -0.2, business: -0.05 }, eco: {},
  },
  energy: {
    id: 'energy', name: 'エネルギー対策費', area: 'economy', fixed: 'discretionary', min: -0.3, max: 0.5, ministry: 'minister_trade',
    explain: '石油の備蓄、エネルギーの安定供給、省エネ・再生可能エネルギーなど。',
    pro: ['エネルギーの安定と脱炭素に役立つ'], con: ['補助が業界の既得権になりやすい'],
    seg: { business: 0.3, families: 0.15, young: 0.1 }, eco: { inflation: -0.01 },
  },
  chusho: {
    id: 'chusho', name: '中小企業対策費', area: 'economy', fixed: 'discretionary', min: -0.3, max: 1.0, ministry: 'minister_trade',
    explain: '中小企業の資金繰り（信用保証など）、事業の承継、経営の支援。',
    pro: ['雇用の7割を支える中小企業を守る'], con: ['競争力のない企業の延命になるという批判'],
    seg: { selfemployed: 1.0, business: 0.3, employees: 0.1 }, eco: { unemployment: -0.01 },
  },
  onkyu: {
    // 恩給: 総理府恩給局 → 総務庁恩給局 (1984-07) → 総務省 (2001)
    id: 'onkyu', name: '恩給関係費', area: 'other', fixed: 'entitlement', min: 0, max: 0, ministry: 'minister_internal', ministries: [[0, 'minister_mgmt'], [2001, 'minister_internal']],
    explain: '旧軍人などの恩給。受給者が少なくなるにつれて、年々減っている。法律で決まった給付なので、予算では変えられない。',
    pro: ['国のために働いた人への約束を守る'], con: ['受給者が減るなか、制度を動かす事務の費用も見直すべきという声'], seg: {}, eco: {},
  },
  sonota: {
    id: 'sonota', name: 'その他', area: 'other', fixed: 'discretionary', min: -0.1, max: 0.2, ministry: null, ministryLabel: '各府省',
    explain: (y) => `各省の事務費、司法・警察、外交${y >= 2021 ? '、デジタル、こども政策の一部' : ''}など、上の分類に入らない経費。`,
    pro: ['行政を動かすのに欠かせない経費'], con: ['見えにくく、むだが入りこみやすい'],
    seg: { floating: -0.05 }, eco: {},
  },
  yobi: {
    id: 'yobi', name: '予備費', area: 'other', fixed: 'reserve', min: 0.1, max: 5, abs: true, ministry: 'minister_finance',
    explain: '予想できない支出（災害など）にそなえるお金。使うときは内閣の判断（閣議決定）で、あとで国会の承諾を得る（憲法87条）。',
    pro: ['災害や急な危機にすぐ対応できる'], con: ['国会の審議を経ずに使えるので、額が大きいと「白紙委任」との批判'],
    seg: {}, eco: {},
  },
};
export const BUDGET_ORDER = Object.keys(BUDGET_ITEMS);
// 歳入 (revenue): 税目別 shares of the tax revenue other than 消費税 (目安 except 2026 所得税・法人税), 税外収入, 公債金.
const TAX_SHARE_ANCHORS = {
  1987: { shotoku: 0.42, hojin: 0.32, sozoku: 0.04, kihatsu: 0.036, sake: 0.05, tabako: 0.024 },
  1996: { shotoku: 0.43, hojin: 0.31, sozoku: 0.06, kihatsu: 0.044, sake: 0.047, tabako: 0.023 },
  2004: { shotoku: 0.43, hojin: 0.30, sozoku: 0.043, kihatsu: 0.09, sake: 0.052, tabako: 0.028 },
  2026: { shotoku: 25.325 / 57.0, hojin: 20.696 / 57.0, sozoku: 0.06, kihatsu: 0.021, sake: 0.019, tabako: 0.016 },
};
// 税外収入 as a share of spending and the calibration of the politics core's revenue to the real 税収 of the era's
// first budget (FY1987 41.2 / FY1996 51.3 / FY2004 41.7 / FY2026 83.7兆円, 目安 except 2026).
const NONTAX_SHARE = { 1987: 0.044, 1996: 0.037, 2004: 0.046, 2026: 0.0735 };
const REV_CAL = { showa: 41.2 / 46.8, heisei_early: 51.3 / 52.1, heisei: 1, reiwa: 1 };
export const REVENUE_ITEMS = {
  shotoku: { name: '所得税' }, hojin: { name: '法人税' }, shohi: { name: '消費税' }, sozoku: { name: '相続税' }, kihatsu: { name: '揮発油税' },
  sake: { name: '酒税' }, tabako: { name: 'たばこ税' }, sonotazei: { name: 'その他の税（物品税・関税など）' }, zeigai: { name: '税外収入（その他収入）' },
  kosai: { name: '公債金（国債）' },
};

// era-gated text: a string, or fn(year, ctx) -> string; arr: a list, or fn(year) -> list; byYear: [[fromYear, v], ...]
const txt = (v, year, ctx) => (typeof v === 'function' ? v(year, ctx) : v || '');
const arr = (v, year) => (typeof v === 'function' ? v(year) : Array.isArray(v) ? v : []);
const byYear = (rows, fy, def) => { let out = def; for (const [y, v] of rows || []) if (fy >= y) out = v; return out; };
// A tax's name in a (fractional) year (names: [[from, name]]; else name).
const taxName = (id, fy) => (TAXES[id] ? byYear(TAXES[id].names, fy, TAXES[id].name) : id);

// ================================================================ ADMINISTRATION (行政)
// The ministry (府省庁) a cabinet post heads, by year ([fromYear, name]). Posts come from politics.js POSTS.
export const MINISTRY_OF_POST = {
  kanbo: [[0, '内閣官房']], minister_internal: [[2001, '総務省']], minister_home: [[0, '自治省']], minister_posts: [[0, '郵政省']],
  minister_mgmt: [[0, '行政管理庁'], [1984.5, '総務庁']], minister_justice: [[0, '法務省']], minister_foreign: [[0, '外務省']],
  minister_finance: [[0, '大蔵省'], [2001, '財務省']], minister_education: [[0, '文部省'], [2001, '文部科学省']],
  minister_health: [[0, '厚生省'], [2001, '厚生労働省']], minister_labor: [[0, '労働省']], minister_agri: [[0, '農林水産省']],
  minister_trade: [[0, '通商産業省'], [2001, '経済産業省']], minister_transport: [[0, '運輸省'], [2001, '国土交通省']],
  minister_construction: [[0, '建設省']], minister_env: [[0, '環境庁'], [2001, '環境省']], minister_defense: [[0, '防衛庁'], [2007, '防衛省']],
  minister_npsc: [[0, '警察庁']], minister_epa: [[0, '経済企画庁']], minister_sci: [[0, '科学技術庁']], minister_land: [[0, '国土庁']],
  minister_hokkaido: [[0, '北海道開発庁']], minister_okinawa: [[0, '沖縄開発庁']], minister_econ: [[2001, '内閣府（経済財政）']],
  minister_special: [[2001, '内閣府']], minister_reconstruction: [[2012.1, '復興庁']], minister_digital: [[2021.67, 'デジタル庁']],
};
// The top official and a few senior posts (only long-standing titles).
const TOP_TITLE = { kanbo: '内閣官房副長官（事務）', minister_npsc: '警察庁長官', minister_digital: 'デジタル監' };
// The second senior post of a body, by year: 大臣官房長 in a 省; 長官官房長 in a 庁 headed by a 国務大臣 (警察庁, 防衛庁,
// 環境庁, 総務庁…); 統括官 in 復興庁・デジタル庁 (no 大臣官房); in the 内閣官房 the 内閣官房副長官補 from the 2001
// reorganisation, before it the 内政審議室長 (1986-2001). 北海道開発庁 総務監理官 / 沖縄開発庁 総務局長 (目安).
const SECOND_TITLE = {
  kanbo: [[0, '内閣内政審議室長'], [2001, '内閣官房副長官補']],
  minister_npsc: [[0, '長官官房長']], minister_mgmt: [[0, '長官官房長']], minister_epa: [[0, '長官官房長']], minister_sci: [[0, '長官官房長']],
  minister_land: [[0, '長官官房長']], minister_env: [[0, '長官官房長'], [2001, '大臣官房長']], minister_defense: [[0, '長官官房長'], [2007, '大臣官房長']],
  minister_hokkaido: [[0, '総務監理官']], minister_okinawa: [[0, '総務局長']], minister_reconstruction: [[0, '統括官']], minister_digital: [[0, '統括官']],
};
const secondTitle = (post, fy) => byYear(SECOND_TITLE[post], fy, '大臣官房長');
// An official who answers on a topic outside the ministries' standing posts (天下り: 総務庁人事局 → 総務省人事・恩給局 →
// 内閣人事局 2014-05-30): [post (ministry name), title] by year.
const TOPIC_OFFICIAL = { amakudari: [[0, ['minister_mgmt', '人事局長']], [2001, ['minister_internal', '人事・恩給局長']], [2014.42, ['kanbo', '内閣人事局 人事政策統括官']]] };
const BUREAUS = {
  minister_finance: ['主計局長', '主税局長'], minister_internal: ['自治財政局長'], minister_home: ['財政局長'], minister_justice: ['刑事局長'],
  minister_foreign: ['北米局長'], minister_health: ['保険局長'], minister_education: ['初等中等教育局長'], minister_npsc: ['警備局長'],
};
export function ministryName(post, fy = 2026) {
  const rows = MINISTRY_OF_POST[post];
  if (!rows) return '';
  let n = '';
  for (const [y, name] of rows) if (fy >= y) n = name;
  // before the first row: the bodies of the 2001 reorganisation did not exist yet (総務省・内閣府…); an agency that a
  // law of this game set up early (復興庁, デジタル庁: flag posts) keeps its name
  return n || (rows[0][0] === 2001 ? '' : rows[0][1]);
}
// The ministry (府省庁 name) that carries a budget item in a year.
function itemMinistry(it, fy) {
  if (!it.ministry && !it.ministries) return it.ministryLabel || '';
  return ministryName(byYear(it.ministries, fy, it.ministry), fy) || it.ministryLabel || '';
}
// 審議会・会議 (posts: who may ask; the PM may ask any). years: [from, to). report effects are small and even-handed.
export const COUNCILS = {
  zeicho: { name: '税制調査会（政府税調）', posts: ['pm', 'minister_finance'], years: [1959, INF], areas: ['tax'], topic: '税制のあり方', desc: (y) => `総理の諮問に答えて税制の基本を議論する${y >= 2001 ? '（2001年から内閣府に置かれる）' : ''}。毎年の税率を実際に決めるのは、与党の税制調査会の色合いが強い。` },
  zaiseishin: { name: (y) => (y >= 2001 ? '財政制度等審議会' : '財政制度審議会'), posts: ['minister_finance'], years: [1950, INF], areas: ['finance'], topic: '予算と財政健全化', desc: '予算編成の考え方や財政の健全化について、財務（大蔵）大臣に意見を出す。' },
  keizaizaisei: { name: '経済財政諮問会議', posts: ['pm', 'minister_econ'], years: [2001, INF], areas: ['economy', 'finance'], topic: '経済財政運営の基本方針', desc: '議長は総理大臣。毎年、経済財政運営の基本方針（いわゆる「骨太の方針」）をまとめ、予算の大枠を示す。' },
  // 社会保障制度審議会 (1949-2001) sat in the 総理府 and answered the PM (関係大臣 also had to hear it); 社会保障審議会
  // (2001-) is the 厚生労働省's
  shakaihosho: { name: (y) => (y >= 2001 ? '社会保障審議会' : '社会保障制度審議会'), posts: ['pm', 'minister_health'], years: [1949, INF], areas: ['welfare', 'health', 'childcare'], topic: '年金・医療・介護の制度', desc: (y) => (y >= 2001 ? '厚生労働省に置かれ、社会保障の制度について厚生労働大臣の諮問に答え、意見を出す。' : '総理府に置かれ、総理大臣の諮問に答えて社会保障の制度を審議し、勧告もする（関係する大臣も意見を聞く）。') },
  chuikyo: { name: '中央社会保険医療協議会（中医協）', posts: ['minister_health'], years: [1950, INF], areas: ['health'], topic: '診療報酬の改定', desc: '診療報酬（医療の値段）の改定について、厚生（労働）大臣の諮問に答える。答申を受けて大臣が告示する。' },
  chukyoshin: { name: '中央教育審議会', posts: ['minister_education'], years: [1952, INF], areas: ['education'], topic: '学校教育のあり方', desc: (y) => (y >= 2001 ? '教育の制度や学習指導要領について答申する（2001年に教育課程審議会などを統合）。' : '教育の制度の基本について答申する。') },
  // the 学習指導要領 was revised on the report of the 教育課程審議会 until it was merged into the 中教審 (2001-01):
  // its 1987-12 report led to the 1989 revision, its 1998 report to the 1998 revision
  kyoikukatei: { name: '教育課程審議会', posts: ['minister_education'], years: [1950, 2001], areas: ['education'], topic: '学習指導要領の改訂', desc: '学校で教える内容の基準（学習指導要領）の改訂について、文部大臣の諮問に答える。' },
  hoseishin: { name: '法制審議会', posts: ['minister_justice'], years: [1949, INF], areas: ['society', 'safety'], topic: '民法・刑法などの見直し', desc: '民法や刑事法などの基本的な法律の改正について、法務大臣の諮問に答える。' },
  chiseicho: { name: '地方制度調査会', posts: ['pm', 'minister_home', 'minister_internal'], years: [1952, INF], areas: ['regional'], topic: '地方自治の制度', desc: '総理大臣の諮問を受け、地方自治の制度について答申する。' },
  // 行革審: 第1次 1983-07〜1986-06, 第2次 1987-04〜1990-04, 第3次 1990-10〜1993-10 (ranges: the council sits only then)
  gyokakushin: { name: '臨時行政改革推進審議会（行革審）', posts: ['pm', 'minister_mgmt'], years: [1983.5, 1993.8], ranges: [[1983.5, 1986.45], [1987.3, 1990.3], [1990.75, 1993.8]], areas: ['admin'], topic: '行政改革の推進', desc: '第二臨調の答申を受けて行政改革を進めるための審議会（期限つきで3次にわたって置かれた）。' },
  gyokakukaigi: { name: '行政改革会議', posts: ['pm'], years: [1996.9, 1998.5], areas: ['admin'], topic: '中央省庁の再編', desc: '中央省庁の再編などを議論した会議（会長は総理大臣）。最終報告が2001年の省庁再編のもとになった。' },
  energy: { name: (y) => (y >= 2001 ? '総合資源エネルギー調査会' : '総合エネルギー調査会'), posts: ['minister_trade'], years: [1965, INF], areas: ['energy'], topic: 'エネルギー政策', desc: 'エネルギーの需給や政策の方向について審議する。' },
  kankyo: { name: (y) => (y >= 1993 ? '中央環境審議会' : '中央公害対策審議会'), posts: ['minister_env'], years: [1971, INF], areas: ['environment'], topic: '環境の基準と対策', desc: '環境基準や公害・環境対策について答申する。' },
  shukyo: { name: '宗教法人審議会', posts: ['minister_education'], years: [1951.4, INF], areas: ['society'], topic: '宗教法人法の運用', desc: (y) => `宗教法人法の運用について、所轄庁に意見を述べる。${y >= 1996 ? '報告徴収・質問権を使う前には、この審議会の意見を聞く（1995年の改正から）。' : ''}` },
  // 地域別最低賃金: 都道府県労働基準局長 → 都道府県労働局長 (都道府県労働局 2000-04)
  saichin: { name: '中央最低賃金審議会', posts: ['minister_labor', 'minister_health'], years: [1959, INF], areas: ['labor'], topic: '最低賃金の引き上げの目安', desc: (y) => `毎年、地域別最低賃金の改定の目安を答申する。各都道府県の審議会を経て、${y >= 2000.25 ? '都道府県労働局長' : '都道府県労働基準局長'}が決める。` },
  // 選挙制度審議会 (設置法 1961): members are appointed by term (第8次 1989-06〜1991); between terms it does not sit, and a PM
  // who wants it appoints the members first
  senkyoseido: { name: '選挙制度審議会', posts: ['pm'], years: [1961, 1992], areas: ['admin'], topic: '選挙制度の改革', desc: (y) => `選挙制度について総理大臣に答申する。委員は期ごとに任命される${y >= 1989.5 ? '（第8次審議会は1989年から1991年）' : '（いまは委員がおらず、総理が任命すると動き出す）'}。` },
};
export const COUNCIL_ORDER = Object.keys(COUNCILS);
// 政令・省令・告示・認可 a minister (or the cabinet) can issue without the Diet, within the law that delegates it.
// options: { key: { label, seg (support shift per segment), eco (economy shock), cost (兆円/年 on this budget), mood } }.
export const ORDINANCES = {
  shinryo: {
    name: '診療報酬の改定（告示）', kind: '告示', posts: ['minister_health'], basis: '健康保険法', cooldown: 240, needCouncil: 'chuikyo',
    desc: '病院や薬局が受け取る医療の値段（診療報酬）は、中医協の答申を受けて厚生（労働）大臣が告示で決める。原則2年ごと。',
    options: {
      up: { label: 'プラス改定（+1%程度）', seg: { elderly: 1.2, families: 0.3, young: -0.4, employees: -0.3, business: -0.2 }, cost: 0.15 },
      down: { label: 'マイナス改定（−1%程度）', seg: { elderly: -1.2, young: 0.4, employees: 0.3, business: 0.2 }, cost: -0.15 },
    },
    pro: ['医療の質と、医師・看護師の待遇を守る（プラス改定）', '医療費の伸びをおさえ、保険料の負担を軽くする（マイナス改定）'],
    con: ['保険料と税の負担が増える（プラス改定）', '病院の経営が苦しくなり、地域医療が細る（マイナス改定）'],
  },
  yakka: {
    name: '薬価の引き下げ（告示）', kind: '告示', posts: ['minister_health'], basis: '健康保険法', cooldown: 120,
    desc: '公的医療保険で使う薬の値段（薬価）を、市場での実際の取引価格に合わせて引き下げる。',
    options: { down: { label: '実勢価格に合わせて引き下げる', seg: { young: 0.4, employees: 0.3, elderly: 0.2, business: -0.6 }, cost: -0.1, eco: { nikkei: -0.3 } } },
    pro: ['医療費と保険料の伸びをおさえる'], con: ['製薬会社の研究開発の意欲をそぐ。新しい薬が日本に入りにくくなるおそれ'],
  },
  denki: {
    name: '電気料金の値上げ申請の審査（認可）', kind: '認可', posts: ['minister_trade'], basis: '電気事業法', cooldown: 120,
    desc: '規制のある電気料金の値上げは、電力会社の申請を経済産業（通商産業）大臣が審査して認可する。',
    options: {
      approve: { label: '申請どおり認可する', seg: { families: -0.8, elderly: -0.5, selfemployed: -0.4, business: 0.3 }, eco: { inflation: 0.08 } },
      trim: { label: '値上げ幅を圧縮して認可する', seg: { families: 0.4, elderly: 0.3, selfemployed: 0.2, business: -0.4 }, eco: { inflation: 0.03 } },
    },
    pro: ['燃料費の上昇を料金に反映し、電力の安定供給を守る（認可）', '家計の負担をやわらげる（圧縮）'],
    con: ['家計と中小企業の負担が増える（認可）', '電力会社の経営が悪化し、投資が遅れる（圧縮）'],
  },
  bichiku: {
    name: '政府備蓄米の放出', kind: '大臣の判断', posts: ['minister_agri'], years: [1995.9, INF], basis: '主要食糧の需給及び価格の安定に関する法律（食糧法）', cooldown: 120,
    desc: '不作や価格の高騰のとき、国が備蓄しているコメを市場に出す。',
    options: { release: { label: '備蓄米を市場に放出する', seg: { families: 0.6, urban: 0.5, elderly: 0.3, farmers: -0.8, rural: -0.2 }, eco: { inflation: -0.05 } } },
    pro: ['コメの値段を落ちつかせ、家計を助ける'], con: ['農家の手取りが減る。いざというときの備蓄が減る'],
  },
  visa: {
    name: '短期滞在ビザ（査証）の発給要件の緩和', kind: '運用の見直し', posts: ['minister_foreign'], years: [2003, INF], basis: '出入国管理及び難民認定法・外務省の運用', cooldown: 240,
    desc: '観光客などの短期滞在ビザの要件をゆるめ、海外からの旅行者を増やす。',
    options: { ease: { label: '発給要件を緩和する', seg: { selfemployed: 0.6, business: 0.6, urban: 0.1, elderly: -0.3, rural: 0.2 }, eco: { growth: 0.03, yen: 0.5 } } },
    // 「オーバーツーリズム」 came into Japanese use around 2017-2018
    pro: ['観光客が増え、地域の商店やホテルがうるおう'], con: (y) => [y >= 2017 ? '観光地の混雑やマナーの問題（オーバーツーリズム）' : '観光地の混雑やマナーの問題'],
  },
  shidoyoryo: {
    name: '学習指導要領の改訂（告示）', kind: '告示', posts: ['minister_education'], basis: '学校教育法施行規則', cooldown: 600, needCouncil: (fy) => (fy >= 2001 ? 'chukyoshin' : 'kyoikukatei'),
    desc: (y) => `学校で教える内容の基準。${y >= 2001 ? '中央教育審議会' : '教育課程審議会'}の答申を受けて、${y >= 2001 ? '文部科学大臣' : '文部大臣'}が告示する（おおむね10年ごと）。`,
    options: { revise: { label: '新しい学習指導要領を告示する', seg: { families: 0.4, young: 0.2, unions: -0.2, elderly: -0.1 } } },
    pro: ['時代に合った学びにできる'], con: ['現場の先生の負担が増える。ころころ変わると混乱する'],
  },
  kankyokijun: {
    name: '環境基準の見直し（告示）', kind: '告示', posts: ['minister_env'], basis: (y) => (y >= 1993 ? '環境基本法' : '公害対策基本法'), cooldown: 240,
    desc: '大気や水の汚れの基準（環境基準）を見直して告示する。',
    options: { tighten: { label: '基準を厳しくする', seg: { families: 0.6, young: 0.3, urban: 0.3, business: -0.6, selfemployed: -0.2 }, eco: { growth: -0.01 } } },
    pro: ['健康と自然を守る'], con: ['企業の対策の費用がかさむ'],
  },
  jouriku: {
    // the 上陸許可基準 省令 (平成2年法務省令第16号) came with the 1989 amendment, in force 1990-06-01
    name: '上陸許可基準の見直し（法務省令）', kind: '省令', posts: ['minister_justice'], years: [1990.41, INF], basis: '出入国管理及び難民認定法', cooldown: 240,
    desc: '外国人が日本で働くときの在留資格の基準のうち、省令で決まる部分を見直す。',
    options: {
      widen: { label: '人手不足の分野で受け入れを広げる', seg: { business: 0.6, selfemployed: 0.3, farmers: 0.3, unions: -0.4, elderly: -0.2 }, eco: { growth: 0.02 } },
      tighten: { label: '基準を厳しくする', seg: { unions: 0.3, elderly: 0.2, business: -0.6, farmers: -0.3, selfemployed: -0.2 }, eco: { growth: -0.01 } },
    },
    pro: ['人手不足を補い、地域の産業を支える（拡大）', '国内の働き手の待遇を守る（厳格化）'],
    con: ['日本人の賃金が上がりにくくなるという声（拡大）', '介護や農業の現場が人手不足に苦しむ（厳格化）'],
  },
  teiin: {
    name: '国家公務員の定員合理化計画（閣議決定）', kind: '閣議決定', posts: ['minister_mgmt', 'minister_internal', 'kanbo'], basis: '行政機関の職員の定員に関する法律', cooldown: 360,
    desc: '各府省の定員を計画的に減らし、必要な部署に振り向ける。',
    options: { cut: { label: '定員を計画的に削減する', seg: { floating: 0.5, business: 0.3, urban: 0.2, unions: -0.8 }, cost: -0.05 } },
    pro: ['行政のむだを減らし、人件費をおさえる'], con: ['行政サービスや災害対応の人手が足りなくなる'],
  },
  saichin: {
    name: '最低賃金の引き上げの目安（審議会の答申を受けて）', kind: (y) => `審議会の答申 → ${y >= 2000.25 ? '労働局長' : '労働基準局長'}の決定`, posts: ['minister_labor', 'minister_health'], basis: '最低賃金法', cooldown: 120, needCouncil: 'saichin',
    desc: '中央最低賃金審議会の目安をもとに、各都道府県で最低賃金が改定される。',
    options: {
      up3: { label: '目安どおり3%程度の引き上げ', seg: { young: 0.6, unions: 0.6, employees: 0.2, selfemployed: -0.6, business: -0.4 }, eco: { inflation: 0.03 } },
      up5: { label: '大幅な5%程度の引き上げ', seg: { young: 1.0, unions: 1.0, employees: 0.3, selfemployed: -1.0, business: -0.7 }, eco: { inflation: 0.05, unemployment: 0.02 } },
    },
    pro: ['働く人の暮らしを底上げし、消費を増やす'], con: ['中小企業や商店の経営を圧迫し、雇用が減るおそれ'],
  },
};
export const ORDINANCE_ORDER = Object.keys(ORDINANCES);

// ================================================================ RELIGION (宗教: all groups FICTIONAL)
// kind / members (公称、目安) / activities are the game's own. endorse: the group may recommend candidates (never of a real
// party). problem: the group around which an abstract 高額献金トラブル can arise (lawful faith is never the problem).
export const RELIGIOUS_GROUPS = {
  dot_bukkyo: {
    id: 'dot_bukkyo', name: 'ドット仏教会', kana: 'どっとぶっきょうかい', kind: '伝統仏教系（宗派をこえた地域の寺院の会）', members: 12000, fictional: true,
    desc: 'ドット区とその周りの寺院が、宗派をこえてつくる会（架空）。お盆の合同法要や、年末の炊き出し、ひとり暮らしの高齢者の見守りを続けている。',
    activities: ['お盆の合同法要', '年末の炊き出し', '高齢者の見守り', '除夜の鐘'], segments: { elderly: 0.6, rural: 0.3 }, endorse: false,
  },
  dot_myojin: {
    id: 'dot_myojin', name: 'ドット明神 氏子会', kana: 'どっとみょうじん うじこかい', kind: '神社の氏子の会', members: 3000, fictional: true,
    desc: 'ドット区の鎮守の神社（架空）を支える氏子の会。例大祭のみこしと、境内の清掃、子ども会の行事を担う。',
    activities: ['例大祭のみこし', '境内の清掃', '子ども会の夏祭り'], segments: { elderly: 0.4, selfemployed: 0.4, families: 0.2 }, endorse: false,
  },
  dotzaka_church: {
    id: 'dotzaka_church', name: 'ドット坂キリスト教会', kana: 'どっとざかきりすときょうかい', kind: 'キリスト教系（プロテスタントの小さな教会）', members: 180, fictional: true,
    desc: 'ドット坂の小さな教会（架空）。日曜の礼拝のほか、こども食堂と、外国人住民の生活相談を開いている。',
    activities: ['日曜礼拝', 'こども食堂', '外国人住民の生活相談', 'クリスマスの音楽会'], segments: { families: 0.3, urban: 0.3 }, endorse: false,
  },
  wako: {
    id: 'wako', name: '和光修養会', kana: 'わこうしゅうようかい', kind: '新宗教（在家の修養団体・全国組織）', members: 850000, fictional: true,
    desc: '日々の心の修養と奉仕活動をかかげる全国組織（架空）。選挙では、考えの近い候補者を個別に推薦することがある（特定の政党の支持団体ではない）。宗教団体が政治活動をすること自体は、憲法で禁じられていない。',
    activities: ['朝の修養会', '清掃奉仕', '被災地へのボランティア', '青年部の勉強会'], segments: { elderly: 0.3, families: 0.3, selfemployed: 0.2 }, endorse: true, votePower: 1,
  },
  tenkan: {
    id: 'tenkan', name: '蒼穹の泉', kana: 'そうきゅうのいずみ', kind: '新宗教（小規模）', members: 6000, fictional: true, problem: true,
    desc: '1970年代にできたとされる小さな宗教団体（架空）。複数の都道府県に施設があるため、所轄庁は文部（科学）大臣。信仰の内容とは別に、一部の信者の家族から「高額な献金を求められた」という相談が寄せられることがある。',
    activities: ['集会', '機関紙の発行'], segments: {}, endorse: false,
  },
};
export const RELIGION_ORDER = Object.keys(RELIGIOUS_GROUPS);
// The law in short (era-gated in religionStatus()).
const RELIGION_LAW = {
  art20: '憲法20条：信教の自由はだれにでも保障される。宗教団体は国から特権を受けず、政治上の権力を行使してはならない。国とその機関は宗教的活動をしてはならない（政教分離）。',
  art89: '憲法89条：公金その他の公の財産を、宗教上の組織・団体の使用、便益、維持のために支出してはならない。',
  politicalActivity: '政教分離は国家と宗教を分けるもので、宗教団体や信者が選挙で候補者を応援することまで禁じてはいない（政府の解釈）。',
  shokatsu: '宗教法人の所轄庁は、原則として都道府県知事。複数の都道府県に建物がある法人などは文部（科学）大臣（宗教法人法5条）。',
  reform1995: '1995年の改正（1996年施行）で、所轄庁が、宗教法人審議会の意見を聞いたうえで、法令違反の疑いがあるときに報告を求め質問できる「報告徴収・質問権」（78条の2）ができた。',
  dissolution: '宗教法人法81条：法令に違反して著しく公共の福祉を害する行為などがあると、裁判所が、所轄庁・利害関係人・検察官の請求または職権で解散を命じることができる。解散命令は法人格を失わせるもので、信仰そのものを禁じるものではない。',
  kifu2022: '2022年12月に「法人等による寄附の不当な勧誘の防止等に関する法律」が公布され（2023年1月から施行）、不安をあおる寄附の勧誘を禁じ、取り消しの権利を定めた。',
};

// ================================================================ DEMOS (デモ)
const DEMO_PLACES = ['国会議事堂前', '首相官邸前', '日比谷公園', 'ドット区 駅前広場'];
// against: what the demo opposes (or 'rally' support) -> cause label templates
const DEMO_CAUSES = {
  government: { label: '内閣の退陣を求めるデモ', seg: 'floating' },
  policy: { label: '「{title}」に反対するデモ', seg: 'unions' },
  tax: { label: '増税に反対するデモ', seg: 'families' },
  scandal: { label: '政治とカネの問題に抗議するデモ', seg: 'floating' },
  war: { label: '戦争に反対するデモ', seg: 'young' },
  speech: { label: '言論の自由を守れと訴えるデモ', seg: 'urban' },
  religion: { label: '高額献金の被害の救済を求める集会', seg: 'families' },
  disaster: { label: '被災地の支援を求める集会', seg: 'rural' },
  other: { label: '{cause}', seg: 'floating' },
  rally: { label: '政府を応援する集会', seg: 'elderly' },
};
// DEMO_RESPONSES: how the government answers a demo. An extendable registry (regime.js adds the dictatorship ones):
// id -> { label, desc, available(g, demo) -> true | false | reason string, apply(g, demo) -> { text, mood? } }.
// The democratic ones are defined below (after the demo logic).
export const DEMO_RESPONSES = {};

// ================================================================ VOICES (世論の声: fictional citizens)
const VOICE_WHO = {
  young: ['大学生（20歳）', '会社員（20代）', '専門学校生（19歳）', 'アルバイト（20代）'],
  families: ['会社員（30代・子ども2人）', 'パート（40代・子育て中）', '保育園に通う子の親（30代）'],
  elderly: ['年金生活（70代）', '元教員（60代）', '自営業を引退（70代）'],
  employees: ['会社員（40代）', '会社員（50代・管理職）', '営業職（30代）'],
  selfemployed: ['商店主（50代）', '飲食店経営（40代）', '町工場の経営（60代）'],
  business: ['中小企業の社長（60代）', 'IT企業の経営者（40代）', '建設会社の役員（50代）'],
  farmers: ['農業（60代）', '漁業（50代）', '酪農家（40代）'],
  unions: ['労働組合の役員（50代）', '工場勤務（30代）', '介護職（40代）'],
  urban: ['ドット区在住（30代）', '都内の会社員（30代）', 'マンション住まい（40代）'],
  rural: ['地方在住（50代）', '山あいの町に住む（60代）', '地方の公務員（40代）'],
  floating: ['主婦（40代）', '会社員（30代・支持政党なし）', 'フリーランス（30代）'],
};
const VOICE_CONCERN = {
  young: '若い世代として言うと、', families: '子育て中の家としては、', elderly: '年金で暮らす身としては、', employees: '給料で暮らす身としては、',
  selfemployed: '小さな店をやっている立場では、', business: '会社を経営する立場では、', farmers: '農林漁業で暮らす身としては、', unions: '働く者の立場では、',
  urban: '都会で暮らしていると、', rural: '地方で暮らしていると、', floating: '支持政党はないけど、',
};
// The era's media: showa 新聞の投書・街頭インタビュー / 1990s 投書・ワイドショー / 2000s 掲示板・ブログ / 2010s- SNS.
export const VOICE_MEDIA = {
  letter: { label: '新聞の投書', head: (w) => `【投書】${w}` },
  street: { label: '街頭インタビュー', head: (w) => `【街の声】${w}` },
  widesho: { label: 'ワイドショー', head: (w) => `【ワイドショーの街頭インタビュー】${w}` },
  bbs: { label: 'ネットの掲示板', head: () => '【掲示板の書き込み】名無しさん' },
  blog: { label: 'ブログ', head: (w) => `【ブログ】${w}` },
  sns: { label: 'SNS', head: (w, era) => (era === 'reiwa' ? `【${ERAS.reiwa.sns}】${w}` : `【SNS】${w}`) },
  video: { label: '動画のコメント', head: () => '【動画のコメント欄】' },
};
function mediumFor(year) {
  if (year < 1995) return pickOne(['letter', 'letter', 'street']);
  if (year < 2000) return pickOne(['letter', 'widesho', 'street']);
  if (year < 2005) return pickOne(['bbs', 'bbs', 'street', 'letter']);
  if (year < 2010) return pickOne(['bbs', 'blog', 'blog', 'street']);
  if (year < 2019) return pickOne(['sns', 'sns', 'blog', 'street']);
  return pickOne(['sns', 'sns', 'video', 'street']);
}
// kind -> { pro: [...], con: [...], neutral?: [...] }. {title} {concern} {item} {who} are filled in. No hate, no real people.
const VOICE_TEXT = {
  law: {
    pro: ['「{title}」は必要だと思う。ようやく前に進んだ', '{concern}「{title}」は助かる。中身をきちんと実行してほしい', '賛否はあっても、決めるべきことを決めたのは評価したい'],
    con: ['「{title}」は、もっと議論してからにしてほしかった', '{concern}負担ばかり増える気がする。「{title}」には反対', '反対の声をちゃんと聞いたのか疑問'],
  },
  tax_up: {
    pro: ['将来の世代につけを回さないためなら、仕方ないと思う', '社会保障の財源なら、負担も必要だと思う', '{concern}負担は重いけど、財政の立て直しは避けられない'],
    con: ['{concern}また負担が増える。暮らしが苦しい', '景気がよくないのに増税はやめてほしい', '増税の前に、むだづかいを減らしてほしい'],
  },
  tax_down: {
    pro: ['{concern}少しでも手取りが増えるのはありがたい', '減税で景気がよくなってほしい', 'がんばった人が報われる税制にしてほしい'],
    con: ['減税の財源はどうするのか。結局、借金では', '{concern}社会保障が削られないか心配', 'お金持ちばかり得をする減税ではないか'],
  },
  budget: {
    pro: ['{item}に予算を回したのは評価したい', '必要なところに、きちんとお金を使ってほしい', '{concern}暮らしに届く予算になってほしい'],
    con: ['予算がふくらむばかり。借金はどうするのか', '{item}ばかり手厚くて、ほかが置き去りでは', '{concern}自分たちに関係のある予算が削られた'],
  },
  scandal: {
    neutral: ['本人の説明をきちんと聞いてから判断したい', '事実がはっきりするまで、決めつけはよくないと思う'],
    con: ['また政治とカネの問題。説明責任を果たしてほしい', '政治への不信が深まるばかり', 'こういうことがあると、投票に行く気がなくなる'],
    pro: ['問題は問題として、政策の議論も止めないでほしい'],
  },
  cabinet: {
    pro: ['新しい総理に期待したい', '{concern}暮らしをよくする政治をお願いしたい', 'まずはお手並み拝見'],
    con: ['顔が変わっても、政治は変わらないのでは', '総理が代わるなら、選挙で信を問うべきだと思う', '総理がころころ代わるのは困る'],
  },
  kotai: {
    pro: ['政権が変わって、新しい風が吹いてほしい', '選挙で政権が変わるのは民主主義らしい'],
    con: ['経験の少ない政権で大丈夫か不安', '政策が急に変わって混乱しないか心配'],
  },
  resign: {
    pro: ['よく決断したと思う。次の人に期待したい', '行き詰まったなら、引くのも責任のとり方'],
    con: ['途中で投げ出すのは無責任では', '政治の空白が心配。暮らしの問題は待ってくれない'],
  },
  dissolve: {
    pro: ['国民に信を問うのは当然。一票で意思を示したい', '選挙でいまの政治を評価したい'],
    con: ['なぜいま解散なのか、よくわからない', '選挙より先にやることがあるのでは'],
  },
  election: {
    pro: ['投票に行ってきた。結果を見守りたい', '選ばれた人には、約束を守ってほしい'],
    con: ['投票率の低さが気になる', '{concern}自分たちの声が政治に届いている気がしない'],
  },
  demo: {
    pro: ['声をあげることは大事。応援したい', '{concern}デモの人たちの気持ちはよくわかる', '平和的なデモは民主主義の一部だと思う'],
    con: ['デモより、選挙で意思を示すべきでは', '交通規制で困った。場所を考えてほしい', '{concern}主張にはあまり共感できない'],
  },
  demo_celeb: {
    pro: ['有名人が声をあげるのは勇気がいる。よく言ってくれた', '芸能人にも、意見を言う自由はあるはず'],
    con: ['芸能人は政治の話をしないでほしい', '影響力のある人は、発言に気をつけてほしい'],
  },
  rally: {
    pro: ['いまの政府をしっかり応援したい', '{concern}安定した政治が続いてほしい'],
    con: ['政府を応援する集会には、ちょっと違和感がある', '応援も批判も自由。でも冷静に見たい'],
  },
  kyoko: {
    pro: ['決めるべきときに決めないと、前に進まない', '審議を拒否する側にも問題がある'],
    con: ['数の力で押し切るのは、民主主義とは言えない', 'もっと時間をかけて審議してほしかった'],
  },
  boycott: {
    pro: ['野党が体を張って抵抗するのも、ひとつのやり方', '強引な国会運営への抗議としては当然'],
    con: ['審議拒否は、国会議員の仕事の放棄では', '反対なら、議論の場で示してほしい'],
  },
  disaster: {
    pro: ['自衛隊や消防、自治体の人たちに感謝したい', '支援が一日も早く届いてほしい。政府には全力で'],
    con: ['政府の対応が遅いのでは', '{concern}現場の声をもっと聞いてほしい'],
  },
  war: {
    pro: ['（もしもの世界）攻撃されたなら守らなければ、という声も', '早く終わってほしい。政府には冷静な判断を'],
    con: ['戦争はやめてほしい。家族が心配', '話し合いで解決する道はないのか', '{concern}物価が上がって暮らしが苦しい'],
  },
  emergency: {
    pro: ['非常時だから、政府にしっかり対応してほしい'],
    con: ['緊急事態を理由に権利が制限されるのはこわい', '期限と歯止めをきちんと決めてほしい'],
  },
  dictatorship: {
    pro: ['「決められる政治」になったと言う人もいるが…'],
    con: ['選挙がなくなるなんて、おかしい', '自由に意見が言えなくなるのがこわい', '憲法を守ってほしい'],
  },
  press: {
    pro: ['報道にも行き過ぎがあると思う人もいる'],
    con: ['報道への圧力は許されない', '知る権利が守られなくなる', '自由に批判できない社会はこわい'],
  },
  religion: {
    neutral: ['まじめに信仰している人まで悪く言うのはちがうと思う', '信教の自由と被害者の救済、どちらも大事'],
    con: ['被害にあった家族を、早く救ってほしい', '高額な献金を強いるのは許されない'],
    pro: ['国がきちんと調べるのは当然', '法律にもとづいて、冷静に対応してほしい'],
  },
  religion_state: {
    pro: ['法にもとづいた手続きなら、国が対応するのは必要'],
    con: ['国が宗教に立ち入りすぎるのは心配', '信教の自由を守る歯止めも大事'],
  },
  postal: {
    pro: ['民間にできることは民間に。サービスもよくなるはず', 'お金の流れが変われば、経済も元気になる'],
    con: ['{concern}地方の郵便局がなくなったら困る', '全国どこでも同じサービスが受けられるのか心配'],
  },
  amakudari: {
    con: ['天下りはもうやめるべき', '役所と業界のなれ合いが心配'],
    pro: ['官僚の経験を社会で生かすこと自体は、悪いことばかりではない'],
  },
  economy: {
    pro: ['景気が少しよくなってきた気がする', '街に活気が戻ってきたように見える'],
    con: ['{concern}先行きが不安', '景気がよくなった実感がない'],
  },
  economy_prices: {
    pro: ['給料も少しずつ上がってきたので、なんとかやれている'],
    con: ['物価ばかり上がって、給料が上がらない', '{concern}毎月の買い物がきつい'],
  },
  economy_jobs: {
    pro: ['求人が少しずつ戻ってきた気がする'],
    con: ['仕事が見つからない。就職が厳しい', '{concern}雇用の不安が大きい'],
  },
  ordinance: {
    pro: ['{item}は、必要な判断だと思う'],
    con: ['{item}は、国会で議論してから決めてほしかった'],
  },
  reserve: {
    pro: ['災害や急な事態には、すぐ対応してほしい'],
    con: ['国会を通さずに大きなお金を使うのは心配'],
  },
  opposition: {
    pro: ['野党が政府をきちんとチェックするのは大事', '{concern}対案を出す野党には期待したい'],
    con: ['批判ばかりで、対案が見えない', '揚げ足取りより、政策の議論をしてほしい'],
  },
};

// ================================================================ STATE (g.state.govt)
// Laws this module adds that are already in force at an era's start ({ policyId: year passed }).
const GOVT_IN_FORCE = {
  showa: {},
  heisei_early: { shukyo_hojin_kaisei: 1995 },
  heisei: { shukyo_hojin_kaisei: 1995 },
  reiwa: { shukyo_hojin_kaisei: 1995, amakudari_ban: 2007, jinjikyoku: 2014, kifu_kanyu: 2022, postal_privatization: 2005, postal_revision: 2012 },
};
const IN_FORCE_FLAG = { shukyo_hojin_kaisei: 'shukyoReport', amakudari_ban: 'amakudariBan', jinjikyoku: 'jinjikyoku', kifu_kanyu: 'kifuLaw', postal_privatization: 'postal', postal_revision: 'postalRevised' };
// fictional names for bureaucrats (never a real person; common surnames and given names)
const B_SUR = ['相沢', '新井', '石原', '市川', '今井', '上田', '遠藤', '大塚', '岡本', '小野', '片山', '川口', '菊池', '北村', '工藤', '久保', '小島', '斉藤', '坂本', '佐野', '柴田', '島田', '杉山', '関口', '高木', '竹内', '田村', '千葉', '土屋', '寺田', '中川', '永井', '西田', '野口', '服部', '浜田', '平野', '福井', '藤本', '星野', '前川', '松井', '丸山', '三浦', '水野', '宮本', '村上', '森田', '矢野', '山内', '横山', '吉川', '渡部'];
const B_GIV_M = ['健一', '浩二', '誠司', '隆之', '和彦', '正樹', '博之', '剛史', '修平', '達也', '秀明', '哲也', '雅人', '英樹', '克己', '昌弘', '信也', '智之', '洋平', '大輔', '慎吾', '孝明', '裕介', '直樹'];
const B_GIV_F = ['恵子', '由美', '真理子', '裕子', '智子', '美穂', '典子', '京子', '陽子', '理恵', '直美', '香織'];
function bName(year) {
  const f = Math.random() < (year < 2000 ? 0.03 : year < 2015 ? 0.08 : 0.15);
  return { name: `${pickOne(B_SUR)} ${pickOne(f ? B_GIV_F : B_GIV_M)}`, gender: f ? 'f' : 'm' };
}
function newBureaucrat(s, year, title, ministryPost, day) {
  const n = bName(year);
  const age = irnd(55, 60);
  return { id: 'bu' + s.nextId++, name: n.name, gender: n.gender, title, post: ministryPost, age, since: day, entered: year - (age - 23), fictional: true };
}
function staffMinistry(s, post, year, day, fy = year) {
  const top = TOP_TITLE[post] || '事務次官';
  const rec = { top: newBureaucrat(s, year, top, post, day), kanbo: newBureaucrat(s, year, secondTitle(post, fy), post, day), bureaus: (BUREAUS[post] || []).map((t) => newBureaucrat(s, year, t, post, day)) };
  rec.kanbo.age = Math.max(50, rec.top.age - irnd(2, 4));
  for (const b of rec.bureaus) b.age = Math.max(50, rec.top.age - irnd(1, 4));
  return rec;
}
// The ministries of a (fractional) year: the cabinet posts that exist then (内閣府 once).
function ministryPosts(g, fy) {
  const p = pol(g);
  let posts = [];
  try { posts = POL ? POL.cabinetPosts(fy, (p && p.flags) || {}) : Object.keys(MINISTRY_OF_POST).filter((k) => MINISTRY_OF_POST[k][0][0] <= fy); } catch (e) { posts = []; }
  return ['kanbo', ...posts.filter((x) => x !== 'kanbo' && x !== 'minister_econ' && MINISTRY_OF_POST[x])];
}

function newGovtState(g) {
  const d = gdate(g);
  const era = eraKey(g);
  const day = today(g);
  const s = {
    v: GOVT_VERSION, era, startYear: d.year, init: day, lastTick: day - 1, nextId: 1,
    news: [], events: [],
    taxes: {}, taxPlan: [], taxHistory: [],
    taxReform: { year: null, stage: 'idle', proposals: {}, npc: {}, rejected: {}, taiko: null, billId: null, day: null, log: [], zeichoBonus: 0 },
    budget: { stage: 'passed', ceilingYear: d.year - 1, requestYear: d.year - 1, genanYear: d.year - 1, decidedYear: d.year - 1, fyStarted: d.doy >= 30 ? d.year : d.year - 1, requests: null, draft: null, decided: null, history: [], supplementary: [], reserve: { fy: d.year, used: [] } },
    admin: { bureaucrats: {}, councils: {}, ordinances: {}, amakudari: { heat: 15, cases: [] }, reforms: {}, personnelYear: d.year - (d.doy >= 65 ? 0 : 1), picks: 0, answers: 0, officials: {} },
    postal: { law: null, privatized: null, revised: null, log: [], key: null },
    religion: { groups: {}, cult: { stage: 0, next: day + irnd(100, 320), complaints: 0, day: null, reported: false, questioned: null, requested: null, decided: null, victims: 0 }, log: [], endorsements: [] },
    opposition: { questions: [], alliance: null, boycott: null, budgetQ: {}, log: [], lastQ: 0 },
    voices: { feed: [], seq: 0 },
    demos: { list: [], seq: 0, lastAuto: day },
    approval: { ledger: [], segLedger: {}, weekly: [], lastPoll: 0 },
    seiken: { last: null, log: [], queue: [] },
    keyBills: {},
    watch: {},
    settings: { scenes: 'auto' },
    seeded: false,
  };
  for (const id of TAX_ORDER) {
    if (TAXES[id].owner === 'politics') continue;
    const r = taxRateAt(id, d.year, d.month);
    s.taxes[id] = { rate: r, base: r, adj: 0, history: [{ day, year: d.year, month: d.month, rate: r, why: 'ゲーム開始時の税率' }] };
  }
  // changes already set by law for a later date (e.g. reiwa: ビールの酒税 54.25円 from 2026-10, decided in 2017)
  for (const id of TAX_ORDER) {
    if (TAXES[id].owner === 'politics') continue;
    for (const [y, m, r, o] of TAXES[id].hist) if (o && o.law && o.law <= d.year && ym(y, m) > ym(d.year, d.month)) s.taxPlan.push({ id, rate: r, year: y, month: m, law: o.law, by: 'law', why: `${o.law}年の法律で決まっている` });
  }
  for (const id of RELIGION_ORDER) {
    const R = RELIGIOUS_GROUPS[id];
    s.religion.groups[id] = { members: R.members, trust: R.problem ? 40 : 60, relation: 0, status: 'normal', visits: 0, endorse: null };
  }
  for (const post of ministryPosts(g, d.fy)) s.admin.bureaucrats[post] = staffMinistry(s, post, d.year, day, d.fy);
  const IF = GOVT_IN_FORCE[era] || {};
  if (IF.postal_privatization) { s.postal.law = { year: 2005, month: 10, real: true }; s.postal.privatized = { year: 2007, month: 10, real: true }; }
  if (IF.postal_revision) s.postal.revised = { year: 2012, month: 4, real: true };
  if (IF.amakudari_ban) s.admin.reforms.amakudariBan = { year: 2007, real: true };
  if (IF.jinjikyoku) s.admin.reforms.jinjikyoku = { year: 2014, month: 5, real: true };
  if (d.year >= 2001) s.admin.reforms.reorg2001 = { year: 2001, month: 1, real: true };
  if (IF.shukyo_hojin_kaisei) s.religion.reportPowerFrom = { year: 1996, month: 9 }; // 施行の月は 目安
  if (IF.kifu_kanyu) s.religion.kifuLaw = { year: 2022, real: true };
  return s;
}
const normalized = new WeakSet();
function normalizeGovt(g, s) {
  const fresh = newGovtState(g);
  for (const k of Object.keys(fresh)) if (s[k] === undefined || s[k] === null || typeof s[k] !== typeof fresh[k] || Array.isArray(s[k]) !== Array.isArray(fresh[k])) s[k] = fresh[k];
  for (const k of ['taxReform', 'budget', 'admin', 'postal', 'religion', 'opposition', 'voices', 'demos', 'approval', 'seiken', 'settings']) for (const kk of Object.keys(fresh[k])) if (s[k][kk] === undefined) s[k][kk] = fresh[k][kk];
  for (const id of Object.keys(fresh.taxes)) if (!obj(s.taxes[id])) s.taxes[id] = fresh.taxes[id];
  for (const id of Object.keys(s.taxes)) { const t = s.taxes[id]; t.rate = num(t.rate, fresh.taxes[id] ? fresh.taxes[id].rate : 0); t.base = num(t.base, t.rate); t.adj = num(t.adj); if (!Array.isArray(t.history)) t.history = []; }
  for (const id of RELIGION_ORDER) if (!obj(s.religion.groups[id])) s.religion.groups[id] = fresh.religion.groups[id];
  if (!obj(s.religion.cult)) s.religion.cult = fresh.religion.cult;
  if (!Array.isArray(s.demos.list)) s.demos.list = [];
  if (!Array.isArray(s.voices.feed)) s.voices.feed = [];
  if (!Array.isArray(s.approval.weekly)) s.approval.weekly = [];
  if (!Array.isArray(s.approval.ledger)) s.approval.ledger = [];
  if (!obj(s.approval.segLedger)) s.approval.segLedger = {};
  if (!obj(s.admin.bureaucrats) || !Object.keys(s.admin.bureaucrats).length) s.admin.bureaucrats = fresh.admin.bureaucrats;
  s.nextId = Math.max(num(s.nextId, 1), fresh.nextId);
  s.v = GOVT_VERSION;
  return s;
}
// g.state.govt (created on demand; old saves get defaults).
function GS(g) {
  const st = g.state;
  if (!st) return null;
  if (!obj(st.govt)) st.govt = newGovtState(g);
  if (!normalized.has(st.govt)) { normalizeGovt(g, st.govt); normalized.add(st.govt); }
  if (!st.govt.seeded && POL) seedPolitics(g, st.govt);
  return st.govt;
}
// One-time: laws this module adds that are already in force (p.flags.inForce + their flags).
function seedPolitics(g, s) {
  const p = pol(g);
  if (!p || !p.flags) return;
  s.seeded = true;
  const IF = GOVT_IN_FORCE[s.era] || {};
  if (!obj(p.flags.inForce)) p.flags.inForce = {};
  for (const [id, y] of Object.entries(IF)) { if (p.flags.inForce[id] == null) p.flags.inForce[id] = y; if (IN_FORCE_FLAG[id]) p.flags[IN_FORCE_FLAG[id]] = true; }
  if (!s.seiken.last && p.cabinet && p.cabinet.pm) s.seiken.last = govSnapshot(g, p);
}
function govtNews(g, s, text, opts = {}) {
  const day = today(g);
  s.news.unshift({ day, text, kind: opts.kind || 'govt' });
  if (s.news.length > 100) s.news.length = 100;
  if (opts.politics !== false) { const p = pol(g); if (p && Array.isArray(p.news)) { p.news.unshift({ day, text, kind: 'govt' }); if (p.news.length > 80) p.news.length = 80; } }
  if (opts.phone) { try { g.message({ from: opts.from || 'ドット新聞', text: opts.phone === true ? `【${opts.head || 'ニュース'}】${text}` : opts.phone, kind: 'news' }); } catch (e) { /* no phone in tests */ } }
}
function addEvent(g, s, kind, label, data = {}) {
  const ev = { id: 'e' + s.nextId++, day: today(g), kind, label, segs: data.segs || null, data: data.data || null };
  s.events.unshift(ev);
  if (s.events.length > 60) s.events.length = 60;
  try { makeVoices(g, s, ev, data.n ?? 4); } catch (e) { console.error(e); }
  return ev;
}

// ================================================================ policies added to the politics core (at load)
function addPolicy(id, area, name, desc, d = {}) {
  const P = POL.POLICIES;
  if (P[id]) return P[id];
  const def = { id, area, name, desc, kind: 'law', lasting: 3, ideo: {}, ...d };
  def.params = d.params || null;
  def.defaults = {};
  const costOf = d.costOf || (() => d.cost || 0);
  def.costOf = (params = {}, ctx = {}) => { const v = Number(costOf({ ...(params || {}) }, ctx)); return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0; };
  def.cost = def.costOf({}, {});
  def.effects = (params = {}, era = 'reiwa', ctx = {}) => {
    const fx = d.effectsFn ? d.effectsFn(params || {}, ctx) : { segments: { ...(d.seg || {}) }, economy: { ...(d.eco || {}) } };
    const c = def.costOf(params, ctx);
    if (c > 0 && POL.FISCAL_BURDEN) for (const [sg, w] of Object.entries(POL.FISCAL_BURDEN)) fx.segments[sg] = r1(num(fx.segments[sg]) - w * Math.min(25, c));
    return fx;
  };
  def.eras = Object.keys(POL.ERA_POLITICS).filter((e) => !def.years || def.years[1] >= POL.ERA_POLITICS[e].start);
  def.govt = true;
  P[id] = def;
  if (!d.hidden && Array.isArray(POL.POLICY_ORDER) && !POL.POLICY_ORDER.includes(id)) POL.POLICY_ORDER.push(id);
  return def;
}
function registerPolicies() {
  // the yearly tax bill: built only by the 税制改正大綱 (never through proposeBill)
  addPolicy('zeisei_kaisei', 'tax', '税制改正（所得税法等の一部を改正する法律案）', '与党の税制改正大綱をもとに、税率などを改める毎年の法律案。', {
    hidden: true, ministry: 'minister_finance', lasting: 2,
    check: () => '税率の変更は、与党の税制調査会 → 税制改正大綱 → 内閣の法律案、の順で決まる（g.setTaxRate で提案）',
    effectsFn: (prm) => taxLawEffects(prm),
    apply: (pol, prm, g) => { try { taxLawEnacted(g, prm); } catch (e) { console.error(e); } },
  });
  addPolicy('amakudari_ban', 'admin', '天下り（再就職あっせん）の規制', '各府省が、職員やOBの再就職を企業などにあっせんすることを禁じ、監視する仕組みをつくる。', {
    years: [1987, 2007], ideo: { econ: 0.3, social: -0.2 }, ministry: 'minister_mgmt',
    check: (pol) => (pol.flags.amakudariBan ? 'すでにある' : null),
    seg: { floating: 3, urban: 1, young: 1, unions: -1, business: -1 },
    apply: (pol, prm, g) => { pol.flags.amakudariBan = true; const s = g && GS(g); if (s) { s.admin.reforms.amakudariBan = { day: today(g), year: gdate(g).year }; s.admin.amakudari.heat = Math.max(0, s.admin.amakudari.heat - 25); } },
  });
  addPolicy('jinjikyoku', 'admin', '内閣人事局の設置（幹部人事の一元管理）', '各府省の幹部職員の人事を、内閣官房の内閣人事局で一元的に管理する。', {
    years: [1987, 2014.4], ideo: { econ: 0.3, social: 0.2 }, ministry: 'kanbo',
    check: (pol) => (pol.flags.jinjikyoku ? 'すでにある' : null),
    seg: { floating: 1, business: 1, unions: -1 },
    apply: (pol, prm, g) => { pol.flags.jinjikyoku = true; const s = g && GS(g); if (s) s.admin.reforms.jinjikyoku = { day: today(g), year: gdate(g).year }; },
  });
  addPolicy('shukyo_hojin_kaisei', 'society', '宗教法人法の改正（報告徴収・質問権の新設）', '法令違反の疑いがある宗教法人に、所轄庁が宗教法人審議会の意見を聞いたうえで報告を求め、質問できるようにする。', {
    years: [1987, 1995], ideo: { social: 0.3 }, ministry: 'minister_education',
    check: (pol) => (pol.flags.shukyoReport ? 'すでにある' : null),
    seg: { families: 2, floating: 1, urban: 1, elderly: -1 },
    apply: (pol, prm, g) => { pol.flags.shukyoReport = true; const s = g && GS(g); if (s) { const d = gdate(g); s.religion.reportPowerFrom = { year: d.month >= 10 ? d.year + 1 : d.year, month: d.month >= 10 ? 1 : d.month + 3 }; } },
  });
  addPolicy('kifu_kanyu', 'society', '不当な寄附の勧誘の防止（被害者の救済）', '不安をあおるなどして寄附を求めることを禁じ、困惑して寄附した人が取り消せるようにする。', {
    years: [1987, 2022], ideo: { social: -0.2 }, ministry: 'minister_special',
    check: (pol) => (pol.flags.kifuLaw ? 'すでにある' : !pol.flags.kifuIssue ? '寄附の勧誘をめぐる被害が、まだ社会の問題になっていない' : null),
    seg: { families: 2, elderly: 1, floating: 1, business: -1 },
    apply: (pol, prm, g) => { pol.flags.kifuLaw = true; const s = g && GS(g); if (s) { s.religion.kifuLaw = { day: today(g), year: gdate(g).year }; s.religion.cult.complaints = Math.round(num(s.religion.cult.complaints) * 0.5); } },
  });
  addPolicy('postal_revision', 'economy', '郵政民営化の見直し（郵便事業会社と郵便局会社の統合など）', '民営化のあとの郵政グループの体制を見直し、郵便局のサービスを全国で保つ。', {
    years: [2007.75, INF], ideo: { econ: -0.6 }, ministry: 'minister_internal',
    check: (pol, prm, y) => (!pol.flags.postal ? 'まだ民営化されていない' : pol.flags.postalRevised ? 'すでに見直しずみ' : null),
    seg: { rural: 2, elderly: 1, unions: 1, urban: -1, business: -1 },
    apply: (pol, prm, g) => { pol.flags.postalRevised = true; const s = g && GS(g); if (s) { const d = gdate(g); s.postal.revised = { day: today(g), year: d.year, month: d.month }; } },
  });
}

// ================================================================ TAXES: rates, revenue, the reform cycle
function shohiRate(g) { const p = pol(g); return p && p.economy ? num(p.economy.taxRate) : (() => { const d = gdate(g); return taxRateAt('shohi', d.year, d.month); })(); }
function rateNow(g, s, id) { return id === 'shohi' ? shohiRate(g) : num(s.taxes[id] && s.taxes[id].rate); }
function eraGdp(g) { const p = pol(g); return (p && p.economy && p.economy.base && num(p.economy.base.gdp)) || (POL ? POL.eraPolitics(eraKey(g)).eco.gdp : 500); }
function gdpScale(g) { const p = pol(g); return p && p.economy ? num(p.economy.gdp, 500) / Math.max(50, eraGdp(g)) : 1; }
// 兆円 of national revenue from this module's rate changes (the politics core's own tax laws are in adj).
function taxRevenueDelta(g, s) {
  let v = 0;
  for (const id of TAX_ORDER) { const T = TAXES[id]; if (T.owner === 'politics' || !s.taxes[id]) continue; v += num(T.coef) * (s.taxes[id].rate - s.taxes[id].base - s.taxes[id].adj); }
  return v * gdpScale(g);
}
function localRevenueDelta(g, s) { const t = s.taxes.jumin; return t ? num(TAXES.jumin.localCoef) * (t.rate - t.base - t.adj) * gdpScale(g) : 0; }
function stepRate(id, v) { const T = TAXES[id]; const st = T.step || 1; return Math.round(Math.round(num(v) / st) * st * 100) / 100; }
// The effects of a tax law (segments / economy) from params.changes { id: rate } against params.from { id: rate }.
function taxLawEffects(prm) {
  const segments = {}, economy = {};
  const ch = (prm && prm.changes) || {}, from = (prm && prm.from) || {};
  for (const [id, rate] of Object.entries(ch)) {
    const T = TAXES[id];
    if (!T) continue;
    const dlt = num(rate) - num(from[id], rate);
    for (const [sg, k] of Object.entries(T.seg || {})) segments[sg] = r1(num(segments[sg]) + k * dlt);
    for (const [e, k] of Object.entries(T.eco || {})) economy[e] = r2(num(economy[e]) + k * dlt);
  }
  for (const k of Object.keys(segments)) segments[k] = clamp(segments[k], -8, 8);
  return { segments, economy };
}
// When a tax change takes effect: April of the bill's year, or the month the change names (酒税 10月), or the next month
// when the law passes later than that. A calendar-year tax (所得税・相続税) set for January of this year applies to this
// year from January (retro: applied at once, recorded as January).
function inForceDate(g, y, m, id) {
  const d = gdate(g);
  if (ym(y, m) > ym(d.year, d.month)) return { year: y, month: m };
  if (CAL_YEAR_TAX[id] && m === 1 && y === d.year) return { year: d.year, month: d.month, asOf: { year: y, month: 1 } };
  return { year: d.month === 12 ? d.year + 1 : d.year, month: d.month === 12 ? 1 : d.month + 1 };
}
const atLabel = (at) => (at.asOf ? `${at.asOf.year}年分から（1月にさかのぼって）` : `${dateText(at.year, at.month)}から`);
function taxLawEnacted(g, prm) {
  const s = GS(g);
  if (!s) return;
  const sched = Array.isArray(prm && prm.schedule) ? prm.schedule : [];
  const d = gdate(g);
  for (const it of sched) {
    const at = inForceDate(g, it.year, it.month, it.id);
    s.taxPlan = s.taxPlan.filter((x) => !(x.id === it.id && !x.done && x.by !== 'law'));
    s.taxPlan.push({ id: it.id, rate: it.rate, year: at.year, month: at.month, asOf: at.asOf || null, law: d.year, by: prm.by || 'cabinet', why: prm.why || '税制改正', title: prm.title || '' });
  }
  const R = s.taxReform;
  if (!prm.urgent) R.stage = 'enacted';
  R.log.push({ day: today(g), text: prm.urgent ? '臨時の税制改正法案が成立した' : '税制改正法案が成立した' });
  const lines = sched.map((it) => `${TAXES[it.id].short} ${it.rate}${TAXES[it.id].unit}（${atLabel(inForceDate(g, it.year, it.month, it.id))}）`);
  govtNews(g, s, `税制改正法案が成立。${lines.join('・')}`);
  emit(g, 'taxReform', { stage: 'enacted', schedule: sched });
}
// Apply the tax changes whose date has come.
function taxInForce(g, s) {
  const now = nowYM(g);
  // a 消費税 change made by the politics core (its laws, or a rate already set by law: taxPlan) joins the history
  const sh = shohiRate(g);
  if (s.lastShohi != null && sh !== s.lastShohi && pol(g)) { const d = gdate(g); s.taxHistory.unshift({ day: today(g), id: 'shohi', from: s.lastShohi, to: sh, why: '法律による改正', year: d.year, month: d.month }); }
  s.lastShohi = sh;
  for (const it of s.taxPlan) {
    if (it.done || ym(it.year, it.month) > now) continue;
    it.done = today(g);
    applyTaxChange(g, s, it.id, it.rate, it.why || '法律による改正', { law: it.law, phone: true, asOf: it.asOf || null });
  }
  s.taxPlan = s.taxPlan.filter((x) => !x.done || today(g) - x.done < 240);
}
function applyTaxChange(g, s, id, rate, why, opts = {}) {
  const T = TAXES[id];
  const p = pol(g);
  const d = gdate(g);
  const before = rateNow(g, s, id);
  // asOf: a calendar-year tax applied from an earlier January of this year (recorded as that month)
  const at = opts.asOf && num(opts.asOf.year) === d.year ? { year: d.year, month: num(opts.asOf.month, 1) } : { year: d.year, month: d.month };
  if (id === 'shohi') {
    if (!p) return;
    p.economy.taxRate = rate;
    const TP = p.flags && p.flags.taxPlan;
    if (TP && !TP.done && num(TP.rate) <= rate) TP.done = today(g);
    if (rate >= 8 && p.flags && !p.flags.reducedRate && d.year >= 2019 && opts.reduced) p.flags.reducedRate = true;
  } else {
    const t = s.taxes[id];
    if (!t) return;
    t.rate = rate;
    t.history.push({ day: today(g), year: at.year, month: at.month, rate, why });
    if (t.history.length > 30) t.history.splice(0, t.history.length - 30);
    if (id === 'kihatsu' && p && p.flags && rate <= 28.7 && obj(p.flags.inForce) && p.flags.inForce.gasoline_tax == null) p.flags.inForce.gasoline_tax = d.year;
    // this fiscal year's budget feels the change at once (full-year figure, a simplification)
    const B = p && p.economy && p.economy.budget;
    if (B && B.govt) {
      const dv = num(T.coef) * (rate - before) * gdpScale(g);
      B.revenue = r1(num(B.revenue) + dv);
      B.deficit = r1(num(B.deficit) - dv);
      B.govt.taxDelta = r1(num(B.govt.taxDelta) + dv);
    }
  }
  s.taxHistory.unshift({ day: today(g), id, from: before, to: rate, why, year: at.year, month: at.month });
  if (s.taxHistory.length > 60) s.taxHistory.length = 60;
  const up = rate > before;
  const text = `${at.month !== d.month ? `${at.year}年分（${at.month}月にさかのぼって）` : dateText(d.year, d.month)}から${taxName(id, d.fy)}が${before}${T.unit}→${rate}${T.unit}になった（${why}）`;
  govtNews(g, s, text, { phone: opts.phone && (id === 'shohi' || id === 'sake' || id === 'kihatsu') ? `【税金】${dateText(d.year, d.month)}から、${T.short}が${before}${T.unit}から${rate}${T.unit}になりました。` : false, from: 'ドット新聞 経済部' });
  if (id === 'shohi' && p) { s.lastShohi = rate; ledgerAdd(g, s, 'tax', { mood: -(rate - before) * 0.8, text: `${T.short}の${up ? '引き上げ' : '引き下げ'}` }); }
  addEvent(g, s, up ? 'tax_up' : 'tax_down', `${T.short} ${before}${T.unit}→${rate}${T.unit}`, { segs: scaleSegs(T.seg, rate - before) });
  emit(g, 'tax', { id, from: before, to: rate, why });
}
const scaleSegs = (seg, k) => { const o = {}; for (const [sg, v] of Object.entries(seg || {})) o[sg] = r1(v * k); return o; };
// The party that leads the cabinet.
function cabinetCore(p) {
  if (!p || !p.cabinet) return null;
  if (p.cabinet.pm === 'player') return p.me.party || (p.cabinet.partyIds || [])[0] || null;
  const n = p.npcs && p.npcs[p.cabinet.pm];
  return (n && n.party) || (p.cabinet.partyIds || [])[0] || null;
}
function inSessionP(p, day) { const S = p && p.diet && p.diet.session; return !!(S && day >= S.start && day <= S.end); }
// A cabinet bill (閣法) built by this module (a draft waits for the next session; politics.js submitDrafts sends it).
function addCabinetBill(g, p, { title, policy, params, ministry, draft = false, delay, key = false }) {
  const day = today(g);
  const inS = inSessionP(p, day);
  const stage = inS && !draft ? 'committee' : 'draft';
  const by = (p.cabinet.ministers && p.cabinet.ministers[ministry]) || p.cabinet.pm;
  const b = { id: 'b' + p.nextId++, title, policy, params: params || {}, sponsor: 'cabinet', by, party: cabinetCore(p), stage, house: 'shugi', step: 'committee', votes: {}, created: day, next: day + (delay ?? irnd(3, 6)), kind: 'law', supporters: 0, need: 0, ministry, cost: 0, carry: 0, log: [] };
  if (stage === 'draft') b.ready = true;
  b.log.push({ day, text: stage === 'draft' ? '閣議決定（次の国会に提出）' : '内閣が国会に提出（閣法）' });
  if (key) b.key = true;
  p.diet.bills.push(b);
  return b;
}
// The NPC 与党税調's items for the reform that takes effect in `year`.
function npcTaxItems(g, s, year) {
  const p = pol(g);
  const core = cabinetCore(p);
  const k = core === 'jimin' ? 0.72 : 0.45;
  const out = {}, plan = [];
  let why = '';
  for (const R of HIST_REFORMS) {
    if (R.year !== year) continue;
    if (R.needShohi && !(shohiRate(g) > 0 || (p && p.diet.bills.some((b) => /^shohizei_intro/.test(String(b.policy)) && !['rejected', 'shelved'].includes(b.stage))))) continue;
    if (Math.random() > k) continue;
    why = R.why;
    for (const [id, r] of Object.entries(R.changes || {})) if (Math.abs(r - rateNow(g, s, id)) > 0.001) out[id] = { rate: r, year: R.year, month: R.month || TAX_MONTH[id] || 4 };
    for (const [id, [y, m, r]] of Object.entries(R.also || {})) if (Math.abs(r - rateNow(g, s, id)) > 0.001) out[id] = { rate: r, year: y, month: m };
    for (const [id, steps] of Object.entries(R.plan || {})) for (const [y, m, r] of steps) plan.push({ id, rate: r, year: y, month: m });
  }
  return { items: out, plan, why };
}
// The month a rate change takes effect: 住民税 June (年度の課税), 所得税・相続税 January (暦年: 「○年分の所得」, 「○年1月1日
//以後の相続」, as TAXES.hist), the rest April. A calendar-year change in a law passed in March of that year applies
// from that January (the year's income / inheritances), as the real 1989, 1999, 2003 and 2015 changes did.
const TAX_MONTH = { jumin: 6, shotoku: 1, sozoku: 1 };
const CAL_YEAR_TAX = { shotoku: true, sozoku: true };
// The 与党税調 decides on a proposal: the PM / 財務大臣 / the party's 政調会長 carry more weight; a change against the
// leading party's economic line is harder; the 政府税調's report helps.
function zeichoAccepts(g, s, id, rate) {
  const p = pol(g);
  const core = cabinetCore(p);
  const pt = p && p.parties[core];
  const econ = num(pt && pt.ideology && pt.ideology.econ);
  const before = rateNow(g, s, id);
  const redistributive = ['shotoku', 'hojin', 'sozoku'].includes(id);
  const raise = rate > before;
  let conflict = 0;
  if (redistributive && raise && econ > 0.5) conflict = 0.15 * econ;
  if (redistributive && !raise && econ < -0.5) conflict = 0.15 * -econ;
  if (id === 'shohi' && raise) conflict += 0.1;
  const size = Math.abs(rate - before) / Math.max(0.5, num(TAXES[id].maxStep, 5));
  const leader = pt && pt.leader === 'player';
  let pr = 0.5 + (isPMg(p) ? 0.25 : financeMinister(p) ? 0.15 : 0.05) + num(p && p.me && p.me.standing) / 400 + num(s.taxReform.zeichoBonus) - conflict - Math.min(0.35, size * 0.3);
  if (leader && pt.isPlayers) pr = 0.97;
  return Math.random() < clamp(pr, 0.08, 0.95);
}
function taxReformCycle(g, s) {
  const p = pol(g);
  if (!p || !POL) return;
  const d = gdate(g);
  const R = s.taxReform;
  const target = d.year + 1;
  // October: the 与党税制調査会 starts on next year's reform
  if (d.doy >= 90 && d.doy < 114 && R.year !== target && R.stage !== 'bill') {
    const carry = Object.fromEntries(Object.entries(R.proposals || {}).filter(([, v]) => v && num(v.target) <= target));
    Object.assign(R, { year: target, stage: 'chosakai', npc: npcTaxItems(g, s, target), taiko: null, billId: null, day: today(g), rejected: {}, proposals: carry, zeichoBonus: num(R.zeichoBonus) });
    R.log.push({ day: today(g), text: `与党の税制調査会が${target}年度の税制改正の議論を始めた` });
    govtNews(g, s, `与党の税制調査会が、${target}年度の税制改正の議論を始めた`);
    emit(g, 'taxReform', { stage: 'chosakai', year: target });
  }
  // mid-December: the 税制改正大綱
  if (d.doy >= 114 && R.stage === 'chosakai' && R.year === target) {
    const items = {};
    const npc = R.npc || { items: {}, plan: [] };
    for (const [id, it] of Object.entries(npc.items || {})) items[id] = it;
    const acc = [], rej = [];
    for (const [id, pr] of Object.entries(R.proposals || {})) {
      if (!pr || num(pr.target) !== target) continue;
      if (zeichoAccepts(g, s, id, pr.rate)) { items[id] = { rate: pr.rate, year: target, month: TAX_MONTH[id] || 4, player: true }; acc.push(id); } else { rej.push(id); R.rejected[id] = pr.rate; delete items[id]; }
    }
    const schedule = Object.entries(items).map(([id, it]) => ({ id, rate: it.rate, year: it.year, month: it.month, player: !!it.player }));
    for (const it of npc.plan || []) schedule.push({ ...it });
    R.taiko = { day: today(g), year: target, schedule, why: npc.why || (acc.length ? '政府・与党の提案による見直し' : ''), accepted: acc, rejected: rej };
    R.proposals = Object.fromEntries(Object.entries(R.proposals || {}).filter(([, v]) => v && num(v.target) > target));
    R.zeichoBonus = 0;
    if (!schedule.length) {
      R.stage = 'none';
      govtNews(g, s, `${target}年度の税制改正大綱がまとまった（主な税率は据え置き）${rej.length ? `。${rej.map((id) => TAXES[id].short).join('・')}の税率の見直しは見送られた` : ''}`);
    } else {
      R.stage = 'bill';
      const from = {}, changes = {};
      for (const it of schedule) { if (from[it.id] == null) from[it.id] = rateNow(g, s, it.id); changes[it.id] = it.rate; }
      const title = '所得税法等の一部を改正する法律案';
      const b = addCabinetBill(g, p, { title, policy: 'zeisei_kaisei', params: { changes, from, schedule, why: R.taiko.why || '税制改正', year: target, title }, ministry: POL.postExists('minister_finance', d.fy, p.flags) ? 'minister_finance' : 'kanbo', draft: true });
      R.billId = b.id;
      const lines = schedule.slice(0, 4).map((it) => `${TAXES[it.id].short} ${rateNow(g, s, it.id)}→${it.rate}${TAXES[it.id].unit}`);
      govtNews(g, s, `${target}年度の税制改正大綱が決まった：${lines.join('・')}${rej.length ? `（${rej.map((id) => TAXES[id].short).join('・')}は見送り）` : ''}`, { phone: involved(g) ? `【税制改正大綱】${target}年度の大綱がまとまりました。\n${lines.join('\n')}${rej.length ? `\n見送り：${rej.map((id) => TAXES[id].short).join('・')}` : ''}\n法律案は1月の通常国会に提出されます。` : false, from: '財務省（大蔵省）' });
      addEvent(g, s, schedule.some((it) => it.rate > rateNow(g, s, it.id)) ? 'tax_up' : 'tax_down', `${target}年度の税制改正大綱`, { segs: taxLawEffects({ changes, from }).segments });
    }
    R.log.push({ day: today(g), text: `税制改正大綱：${schedule.length ? schedule.map((it) => `${TAXES[it.id].short}${it.rate}${TAXES[it.id].unit}`).join('・') : '税率は据え置き'}` });
    emit(g, 'taxReform', { stage: 'taiko', year: target, taiko: R.taiko });
  }
  // the bill died (dissolution, end of session): try again in the next session while it is still timely
  if (R.stage === 'bill' && R.billId) {
    const b = p.diet.bills.find((x) => x.id === R.billId);
    if (!b || ['rejected', 'shelved'].includes(b.stage)) {
      if (b && b.stage === 'rejected') { R.stage = 'failed'; govtNews(g, s, '税制改正法案が国会で否決された。税率はいまのまま'); emit(g, 'taxReform', { stage: 'failed' }); }
      else if (num(R.year) >= d.year && (R.retries || 0) < 2) {
        R.retries = (R.retries || 0) + 1;
        const nb = addCabinetBill(g, p, { title: b ? b.title : '所得税法等の一部を改正する法律案', policy: 'zeisei_kaisei', params: b ? b.params : {}, ministry: (b && b.ministry) || 'minister_finance', draft: true });
        R.billId = nb.id;
        R.log.push({ day: today(g), text: '廃案になった税制改正法案を、次の国会に出し直すことにした' });
      } else { R.stage = 'failed'; govtNews(g, s, '税制改正法案は成立しなかった'); }
    }
  }
}
// Is the player in politics at all (for phone messages about political process)?
function involved(g) { const p = pol(g); const me = p && p.me; return !!(me && (me.office || me.party || me.wins || me.losses || me.candidacy || me.formerOffice || me.posts.length)); }

// ================================================================ approval ledger & support shifts
// Contributions this module (or another core through g.approvalNote) makes to the cabinet's mood (policy) or
// scandal terms of the politics core's weekly poll. Entries fade like those terms (0.85 / 0.8 a week).
function ledgerAdd(g, s, reason, { mood = 0, scandal = 0, text = '', segs = null } = {}) {
  const p = pol(g);
  if (p && p.cabinet) {
    if (mood) p.cabinet.mood = clamp(num(p.cabinet.mood) + mood, -20, 20);
    if (scandal) p.cabinet.scandal = num(p.cabinet.scandal) + scandal;
  }
  if (!mood && !scandal && !segs) return;
  s.approval.ledger.push({ day: today(g), reason, mood: r2(mood), scandal: r2(scandal), text });
  if (s.approval.ledger.length > 80) s.approval.ledger.splice(0, s.approval.ledger.length - 80);
  if (segs) for (const [sg, v] of Object.entries(segs)) s.approval.segLedger[sg] = clamp(num(s.approval.segLedger[sg]) + v, -30, 30);
}
function ledgerDecay(s) {
  for (const e of s.approval.ledger) { e.mood = r2(num(e.mood) * 0.85); e.scandal = r2(num(e.scandal) * 0.8); }
  s.approval.ledger = s.approval.ledger.filter((e) => Math.abs(e.mood) + Math.abs(e.scandal) >= 0.05);
  for (const k of Object.keys(s.approval.segLedger)) { s.approval.segLedger[k] = r2(num(s.approval.segLedger[k]) * 0.85); if (Math.abs(s.approval.segLedger[k]) < 0.05) delete s.approval.segLedger[k]; }
}
// Shift the support of parties (default: the cabinet's) in segments (the scale politics.js uses for law effects).
function shiftSupport(p, segs, k = 0.004, parties = null) {
  if (!p || !p.support || !p.support.mods) return;
  const ids = parties || (p.cabinet && p.cabinet.partyIds) || [];
  for (const [sg, d] of Object.entries(segs || {})) {
    if (!SEGS()[sg]) continue;
    const m = p.support.mods[sg] || (p.support.mods[sg] = {});
    for (const id of ids) if (p.parties[id]) m[id] = clamp(num(m[id]) + d * k, -0.3, 0.3);
  }
}
function moodOfSegs(g, segs, k = 1) {
  const W = segWeightsOf(gdate(g).year);
  let m = 0;
  for (const [sg, d] of Object.entries(segs || {})) m += (W ? num(W[sg]) : 1 / 11) * d;
  return m * k;
}
// A small, fading push to the economy (an entry in the politics core's economy.shocks).
function ecoShock(g, name, fx, len = 60) {
  const p = pol(g);
  if (!p || !p.economy || !Array.isArray(p.economy.shocks)) return;
  const d = gdate(g);
  const abs = (d.year - p.cal.year) * YEAR_DAYS + d.doy;
  const e = { kind: 'govt', name, until: abs + len, len, growth: 0, inflation: 0, unemployment: 0, yen: 0 };
  for (const k of ['growth', 'inflation', 'unemployment', 'yen']) e[k] = clamp(num(fx && fx[k]), -2, 2);
  if (fx && fx.nikkei) p.economy.nikkei *= 1 + clamp(num(fx.nikkei), -10, 10) / 100;
  if (e.growth || e.inflation || e.unemployment || e.yen) p.economy.shocks.push(e);
}

// ================================================================ BUDGET
const AREA_ITEM = { welfare: 'shakaihosho', health: 'shakaihosho', childcare: 'shakaihosho', education: 'bunkyo', culture: 'bunkyo', regional: 'kokyo', disaster: 'kokyo', diplomacy: 'boei', agriculture: 'shokuryo', energy: 'energy', economy: 'chusho', finance: 'sonota', labor: 'shakaihosho' };
const LAW_ITEM = { local_grant: 'kofuzei', oda: 'keizai', defense_up: 'boei', defense_cut: 'boei', public_works: 'kokyo', public_works_cut: 'kokyo', disaster_prep: 'kokyo', reconstruction: 'kokyo', research: 'bunkyo', space: 'bunkyo', free_tuition: 'bunkyo', scholarship: 'bunkyo', education_reform: 'bunkyo', farm_income: 'shokuryo', fisheries: 'shokuryo', energy_subsidy: 'energy', renewables: 'energy', nuclear_exit: 'energy', stimulus: 'sonota', bank_rescue: 'sonota' };
const budgetShares = (year) => lerpAnchors(year, BUDGET_SHARE_ANCHORS);
// Law costs inside a compiled budget (the same rule as politics.js compileBudget), by budget item.
function lawSpending(p, year) {
  const byItem = {};
  let total = 0;
  if (!p || !POL || !Array.isArray(p.laws)) return { byItem, total };
  const absJan = (year - p.cal.year) * YEAR_DAYS;
  for (const L of p.laws) {
    const def = POL.POLICIES[L.policy];
    const c = num(L.cost);
    if (!def || !c || def.area === 'tax') continue;
    const one = num(L.lasting, 3) <= 1;
    const life = Math.max(1, num(L.lasting, 3));
    const yearsIn = (absJan - num(L.abs)) / YEAR_DAYS;
    if (yearsIn < 0 || (one && yearsIn > 1) || (!one && yearsIn > life + 20)) continue;
    const item = LAW_ITEM[L.policy] || AREA_ITEM[def.area] || 'sonota';
    byItem[item] = num(byItem[item]) + c;
    total += c;
  }
  return { byItem, total };
}
// The detailed 歳出 of a compiled budget before the player's allocation.
function baselineDetail(g, B) {
  const p = pol(g);
  const year = num(B.year, gdate(g).year);
  const sh = budgetShares(year);
  const L = lawSpending(p, year);
  const base = Math.max(10, num(B.spending) - L.total);
  const out = {};
  for (const k of BUDGET_ORDER) out[k] = num(sh[k]) * base + num(L.byItem[k]);
  return out;
}
function itemsToAreas(detail) {
  const a = { welfare: 0, finance: 0, regional: 0, diplomacy: 0, education: 0, economy: 0, agriculture: 0, other: 0 };
  for (const k of BUDGET_ORDER) a[BUDGET_ITEMS[k].area] = num(a[BUDGET_ITEMS[k].area]) + num(detail[k]);
  for (const k of Object.keys(a)) a[k] = r1(a[k]);
  return a;
}
const sumObj = (o) => Object.values(o || {}).reduce((a, v) => a + num(v), 0);
// A budget the politics core compiled (economy.budget without our marker): detail, allocation, revenue calibration.
function syncBudget(g, s) {
  const p = pol(g);
  const B = p && p.economy && p.economy.budget;
  if (!B) return null;
  if (B.govt && B.govt.v === 1) { reconcileBudget(g, s, B); return B; }
  const year = num(B.year, gdate(g).year);
  const base = baselineDetail(g, B);
  const detail = { ...base };
  const D = s.budget.decided;
  let allocated = false;
  if (D && num(D.fy) === year && obj(D.ratios)) {
    for (const k of BUDGET_ORDER) if (D.ratios[k] != null && BUDGET_ITEMS[k].fixed !== 'debt') detail[k] = Math.max(0, base[k] * num(D.ratios[k], 1));
    allocated = true;
  }
  for (const k of BUDGET_ORDER) detail[k] = Math.round(detail[k] * 1000) / 1000;
  const spending = sumObj(detail);
  const revModel = num(B.revenue);
  const cal = REV_CAL[s.era] || 1;
  const taxDelta = taxRevenueDelta(g, s);
  const revenue = Math.max(5, revModel * cal + taxDelta);
  const nontax = spending * num(lerpAnchors(year, NONTAX_SHARE));
  B.spending = r1(spending);
  B.revenue = r1(revenue);
  B.deficit = r1(spending - revenue - nontax);
  B.items = { ...(B.items || {}), ...itemsToAreas(detail) };
  B.govt = { v: 1, fy: year, detail, base, revModel, cal, taxDelta: r1(taxDelta), nontax: r1(nontax), allocated, day: today(g) };
  recordBudgetHistory(g, s, B);
  return B;
}
// The politics UI (or a law) changed the budget's areas: scale our detail to match.
function reconcileBudget(g, s, B) {
  const G2 = B.govt;
  if (!obj(G2.detail)) return;
  const areas = itemsToAreas(G2.detail);
  let changed = false;
  for (const [a, v] of Object.entries(areas)) {
    const want = num(B.items && B.items[a], v);
    if (Math.abs(want - v) < 0.05 || v <= 0) continue;
    const k = want / v;
    for (const it of BUDGET_ORDER) if (BUDGET_ITEMS[it].area === a && BUDGET_ITEMS[it].fixed !== 'debt') G2.detail[it] = Math.round(G2.detail[it] * k * 1000) / 1000;
    changed = true;
  }
  if (changed) recordBudgetHistory(g, s, B);
}
function recordBudgetHistory(g, s, B) {
  const G2 = B.govt || {};
  const row = { fy: num(B.year), total: r1(B.spending), items: {}, revenue: r1(B.revenue), bonds: r1(B.deficit), nontax: r1(G2.nontax), passed: !!B.passed, provisional: !!B.provisional, allocated: !!G2.allocated };
  for (const k of BUDGET_ORDER) row.items[k] = r2(num(G2.detail && G2.detail[k]));
  const H = s.budget.history;
  const i = H.findIndex((h) => h.fy === row.fy);
  if (i >= 0) H[i] = { ...H[i], ...row, supplementary: H[i].supplementary || 0 }; else H.push({ ...row, supplementary: 0 });
  H.sort((a, b) => a.fy - b.fy);
  if (H.length > 40) H.splice(0, H.length - 40);
}
// 歳入 by item (兆円) for a budget.
function revenueDetail(g, s, B) {
  const year = num(B.year, gdate(g).year);
  const tax = num(B.revenue);
  const shohi = Math.min(tax * 0.6, POL ? 2.6 * shohiRate(g) * num(pol(g).economy.gdp, 600) / 600 : 0);
  const rest = Math.max(0, tax - shohi);
  const sh = lerpAnchors(year, TAX_SHARE_ANCHORS);
  const out = {};
  let used = 0;
  // this module's rate changes go to their own tax
  const delta = {};
  for (const id of ['shotoku', 'hojin', 'sozoku', 'kihatsu', 'sake']) { const t = s.taxes[id]; delta[id] = t ? num(TAXES[id].coef) * (t.rate - t.base - t.adj) * gdpScale(g) : 0; }
  const restBase = Math.max(0, rest - sumObj(delta));
  for (const id of ['shotoku', 'hojin', 'sozoku', 'kihatsu', 'sake', 'tabako']) { out[id] = Math.max(0, num(sh[id]) * restBase + num(delta[id])); used += out[id]; }
  out.shohi = shohi;
  out.sonotazei = Math.max(0, tax - used - shohi);
  const G2 = B.govt || {};
  out.zeigai = num(G2.nontax, num(B.spending) * 0.07);
  out.kosai = num(B.deficit);
  for (const k of Object.keys(out)) out[k] = r2(out[k]);
  return out;
}
// Next fiscal year's starting point (概算要求の前提): this year's detail with the usual growth.
// The same rule as politics.js compileBudget (base × 1.2%/year × the economy's size, plus the laws in force), so the
// 政府案 decided in December matches the budget the core compiles in January.
function previewNext(g, s) {
  const p = pol(g);
  const E = p && p.economy;
  const d = gdate(g);
  const next = d.year + 1;
  const out = {};
  const b0 = E && E.base;
  let sp = 0;
  if (b0 && num(b0.gdp) > 0) sp = num(b0.spending) * Math.pow(1.012, Math.max(0, next - num(b0.year))) * (0.6 + 0.4 * (num(E.gdp) / Math.max(50, num(b0.gdp))));
  else sp = num(E && E.budget && E.budget.spending, 100) * 1.012;
  const L = lawSpending(p, next);
  const sh = budgetShares(next);
  for (const k of BUDGET_ORDER) out[k] = Math.round((num(sh[k]) * Math.max(10, sp) + num(L.byItem[k])) * 1000) / 1000;
  return out;
}
function budgetCycle(g, s) {
  const p = pol(g);
  if (!p || !POL) return;
  const d = gdate(g);
  const S = s.budget;
  const next = d.year + 1;
  // late July: the 概算要求基準 (シーリング) is set by the cabinet
  if (d.doy >= 67 && num(S.ceilingYear) < d.year) {
    S.ceilingYear = d.year;
    govtNews(g, s, `${next}年度予算の概算要求基準（シーリング）を閣議了解した`, { politics: false });
  }
  // end of August: the ministries' 概算要求
  if (d.doy >= 79 && num(S.requestYear) < d.year) {
    S.requestYear = d.year;
    const preview = previewNext(g, s);
    const req = {};
    for (const k of BUDGET_ORDER) { const it = BUDGET_ITEMS[k]; req[k] = Math.round(preview[k] * (1 + (it.fixed === 'discretionary' ? rnd(0.03, 0.1) : 0)) * 1000) / 1000; }
    S.requests = { fy: next, items: req, total: r1(sumObj(req)), day: today(g) };
    S.draft = { fy: next, items: { ...preview }, preview: { ...preview }, by: null, day: today(g) };
    S.stage = 'request';
    govtNews(g, s, `各府省庁の${next}年度予算の概算要求が出そろった（一般会計で約${fmtCho(S.requests.total)}）`);
    emit(g, 'budget', { stage: 'request', fy: next, total: S.requests.total });
  }
  // late December: the 財務省原案 and the 政府案 (閣議決定)
  if (d.doy >= 116 && num(S.genanYear) < d.year && S.draft && S.draft.fy === next) {
    S.genanYear = d.year;
    S.stage = 'genan';
    // the 財務省原案 starts from the latest estimate (laws passed since August count); the player's choices keep their ratio
    const fresh = previewNext(g, s);
    const set = S.draft.set || {};
    for (const k of BUDGET_ORDER) {
      const old = num(S.draft.preview[k]);
      if (set[k] && old > 0) S.draft.items[k] = Math.round(fresh[k] * (num(S.draft.items[k]) / old) * 1000) / 1000;
      else S.draft.items[k] = Math.round(fresh[k] * (BUDGET_ITEMS[k].fixed === 'discretionary' && !S.draft.by ? rnd(0.985, 1.01) : 1) * 1000) / 1000;
      if (BUDGET_ITEMS[k].abs && set[k]) S.draft.items[k] = num(S.draft.items[k]);
    }
    if (set.yobi) S.draft.items.yobi = num(S.draft.yobiSet, S.draft.items.yobi);
    S.draft.preview = fresh;
    govtNews(g, s, `${postNameNow(g, 'minister_finance').replace(/大臣$/, '省')}原案が各府省に内示された。大臣どうしの「復活折衝」が続く`, { politics: false });
    emit(g, 'budget', { stage: 'genan', fy: next });
  }
  if (d.doy >= 117 && num(S.decidedYear) < d.year && S.draft && S.draft.fy === next) {
    S.decidedYear = d.year;
    S.stage = 'cabinet';
    const ratios = {};
    for (const k of BUDGET_ORDER) ratios[k] = S.draft.preview[k] > 0 ? r2(S.draft.items[k] / S.draft.preview[k]) : 1;
    const total = r1(sumObj(S.draft.items));
    S.decided = { fy: next, ratios, items: { ...S.draft.items }, total, by: S.draft.by || 'npc', day: today(g) };
    govtNews(g, s, `${next}年度予算の政府案を閣議決定した（一般会計 ${fmtCho(total)}）`);
    if (S.draft.by === 'player') budgetDecidedEffects(g, s, S.draft);
    else addEvent(g, s, 'budget', `${next}年度予算の政府案`, { segs: { elderly: 0.5, young: -0.3, floating: -0.3 }, data: { item: BUDGET_ITEMS.shakaihosho.name } });
    emit(g, 'budget', { stage: 'cabinet', fy: next, total, by: S.decided.by });
  }
  // the Diet (politics.js 年度予算案) → passed / 暫定予算
  const B = p.economy.budget;
  if (B && B.govt && num(B.year) === d.year) {
    const bill = p.diet.bills.find((b) => b.kind === 'budget' && !b.policy && String(b.title || '').startsWith(`${d.year}年度`));
    const stage = B.passed ? 'passed' : B.provisional ? 'provisional' : bill && !['enacted', 'rejected', 'shelved'].includes(bill.stage) ? 'diet' : S.stage;
    if (stage !== S.stage && ['passed', 'provisional', 'diet'].includes(stage)) { S.stage = stage; emit(g, 'budget', { stage, fy: d.year }); recordBudgetHistory(g, s, B); }
  }
  // April: the fiscal year starts; an allocation that moved money pushes the economy a little
  if (d.doy >= 30 && num(S.fyStarted) < d.year) {
    S.fyStarted = d.year;
    S.reserve = { fy: d.year, used: [] };
    if (B && B.govt && B.govt.allocated) {
      const fx = { growth: 0, inflation: 0, unemployment: 0 };
      let dTot = 0;
      for (const k of BUDGET_ORDER) { const dv = num(B.govt.detail[k]) - num(B.govt.base[k]); dTot += dv; for (const [e, v] of Object.entries(BUDGET_ITEMS[k].eco || {})) fx[e] = num(fx[e]) + v * dv; }
      fx.growth += dTot * 0.01;
      ecoShock(g, '予算の配分の見直し', fx, YEAR_DAYS);
    }
  }
}
function budgetDecidedEffects(g, s, draft) {
  const p = pol(g);
  const segs = {};
  let dTot = 0;
  const big = [];
  for (const k of BUDGET_ORDER) {
    const dv = num(draft.items[k]) - num(draft.preview[k]);
    if (!dv) continue;
    dTot += dv;
    for (const [sg, v] of Object.entries(BUDGET_ITEMS[k].seg || {})) segs[sg] = num(segs[sg]) + v * dv;
    if (Math.abs(dv) >= 0.1) big.push([k, dv]);
  }
  if (dTot > 0 && POL && POL.FISCAL_BURDEN) for (const [sg, w] of Object.entries(POL.FISCAL_BURDEN)) segs[sg] = num(segs[sg]) - w * Math.min(25, dTot);
  for (const k of Object.keys(segs)) segs[k] = clamp(r1(segs[k]), -6, 6);
  shiftSupport(p, segs, 0.004);
  ledgerAdd(g, s, 'budget', { mood: clamp(moodOfSegs(g, segs, 1.2), -4, 4), text: '予算の配分', segs });
  big.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const top = big[0] ? BUDGET_ITEMS[big[0][0]].name : BUDGET_ITEMS.shakaihosho.name;
  addEvent(g, s, 'budget', `${draft.fy}年度予算の政府案（${big.slice(0, 2).map(([k, dv]) => `${BUDGET_ITEMS[k].name}${fmtD(dv, '兆円')}`).join('・') || '前年なみ'}）`, { segs, data: { item: top } });
  if (p && p.me) p.me.reputation = clamp(num(p.me.reputation) + 2, -100, 100);
}
// The budget the player can still change (the 政府案 being drafted for next fiscal year), or why not.
function budgetBlock(g, s) {
  const p = pol(g);
  if (!p || !POL) return '政治のしくみが読み込まれていない';
  if (!(isPMg(p) || financeMinister(p))) return `予算案をつくるのは内閣。配分を決められるのは総理大臣か${postNameNow(g, 'minister_finance')}のときだけ`;
  if (p.cabinet.resigned) return '総辞職した内閣は、次の総理が決まるまでの仕事だけを行う';
  const d = gdate(g);
  const S = s.budget;
  if (!S.draft || S.draft.fy !== d.year + 1 || num(S.requestYear) < d.year) return '来年度予算の編成は、8月末の概算要求のあとから（12月下旬に閣議決定）';
  if (num(S.decidedYear) >= d.year) return `${d.year + 1}年度予算の政府案は、もう閣議決定した（次は来年の夏の概算要求から）`;
  return null;
}

// ---------------------------------------------------------------- 補正予算・予備費
function supplementaryImpl(g, s, def = {}) {
  const p = pol(g);
  if (!p || !POL) return { ok: false, why: '政治のしくみが読み込まれていない' };
  if (!(isPMg(p) || financeMinister(p))) return { ok: false, why: `補正予算案を出せるのは内閣（総理大臣か${postNameNow(g, 'minister_finance')}が閣議に出す）。憲法73条・86条` };
  const amount = clamp(Math.round(num(def.amount, 10) / 2) * 2, 2, 40);
  const purpose = String(def.purpose || '経済対策').slice(0, 12);
  const fy = gdate(g).year;
  const title = `${fy}年度補正予算案（${purpose}・${amount}兆円）`;
  let id = null;
  try { id = g.proposeBill({ policy: 'stimulus', params: { amount }, title }); } catch (e) { console.error(e); }
  if (!id) return { ok: false, why: g.lastPoliticsError || '補正予算案を出せなかった' };
  s.budget.supplementary.push({ day: today(g), fy, billId: id, amount, purpose, title, by: 'player', status: 'submitted' });
  govtNews(g, s, `内閣が「${title}」を閣議決定した`);
  emit(g, 'supplementary', { stage: 'submitted', billId: id, amount, purpose });
  return { ok: true, billId: id, title, amount };
}
function reserveLeft(g, s) {
  const p = pol(g);
  const B = p && p.economy && p.economy.budget;
  const yobi = num(B && B.govt && B.govt.detail && B.govt.detail.yobi);
  const used = (s.budget.reserve.used || []).reduce((a, u) => a + num(u.amount), 0);
  return r2(Math.max(0, yobi - used));
}
const RESERVE_PURPOSES = {
  disaster: { label: '災害の復旧・被災者の支援', segs: { rural: 1.2, elderly: 0.6, families: 0.4 }, eco: { growth: 0.02 } },
  prices: { label: '物価高への緊急の対策', segs: { families: 0.8, elderly: 0.5, selfemployed: 0.4 }, eco: { inflation: -0.05 } },
  health: { label: '感染症など、急な健康危機への対応', segs: { elderly: 0.8, families: 0.5 }, eco: {} },
  other: { label: '急を要するそのほかの経費', segs: { floating: 0.1 }, eco: {} },
};
function useReserveImpl(g, s, amount, purpose = 'other') {
  const p = pol(g);
  if (!p || !POL) return { ok: false, why: '政治のしくみが読み込まれていない' };
  if (!(isPMg(p) || financeMinister(p))) return { ok: false, why: `予備費の使用を決めるのは内閣（総理大臣か${postNameNow(g, 'minister_finance')}が閣議に出す）` };
  const B = p.economy.budget;
  if (!B || !(B.passed || B.provisional)) return { ok: false, why: '今年度の予算がまだ成立していない' };
  const P = RESERVE_PURPOSES[purpose] || RESERVE_PURPOSES.other;
  const a = r2(num(amount));
  if (!(a > 0)) return { ok: false, why: '金額を決める' };
  const left = reserveLeft(g, s);
  if (a > left) return { ok: false, why: `予備費の残りは${fmtCho(left)}（足りなければ補正予算を組む）` };
  s.budget.reserve.used.push({ day: today(g), amount: a, purpose, label: P.label });
  shiftSupport(p, P.segs, 0.003 * Math.min(3, a));
  ledgerAdd(g, s, purpose === 'disaster' ? 'disaster' : 'budget', { mood: clamp(0.4 + a * 0.2, 0, 2), text: `予備費の使用（${P.label}）` });
  ecoShock(g, '予備費の使用', Object.fromEntries(Object.entries(P.eco).map(([k, v]) => [k, v * a])), 60);
  govtNews(g, s, `予備費から${fmtCho(a)}の使用を閣議決定した（${P.label}）。あとで国会の承諾を求める（憲法87条）`);
  addEvent(g, s, 'reserve', `予備費の使用（${P.label}）`, { segs: P.segs });
  emit(g, 'reserve', { amount: a, purpose });
  return { ok: true, amount: a, left: reserveLeft(g, s), text: `予備費から${fmtCho(a)}を使うことを閣議決定した（${P.label}）。国会には事後に承諾を求める（憲法87条）。` };
}

// ================================================================ ADMINISTRATION logic
function councilExists(id, fy) { const C = COUNCILS[id]; return !!C && fy >= C.years[0] && fy < C.years[1] && (!C.ranges || C.ranges.some(([a, b]) => fy >= a && fy < b)); }
// The council an ordinance needs in a year (needCouncil: id | fn(fy) -> id).
const needCouncilOf = (O, fy) => (typeof O.needCouncil === 'function' ? O.needCouncil(fy) : O.needCouncil || null);
function canAsk(p, posts) { return isPMg(p) || (posts || []).some((x) => x !== 'pm' && postOf(p, x)); }
function ordinanceExists(id, fy) { const O = ORDINANCES[id]; return !!O && (!O.years || (fy >= O.years[0] && fy < O.years[1])); }
// Keep the staff in step with the ministries of the year (2001 再編, 2007 防衛省, 2012 復興庁, 2021 デジタル庁).
function syncMinistries(g, s) {
  const d = gdate(g);
  const posts = ministryPosts(g, d.fy);
  const made = [];
  for (const post of posts) if (!s.admin.bureaucrats[post]) { s.admin.bureaucrats[post] = staffMinistry(s, post, d.year, today(g), d.fy); made.push(post); }
  for (const post of Object.keys(s.admin.bureaucrats)) if (!posts.includes(post)) delete s.admin.bureaucrats[post];
  // titles follow reorganisations (2001: 内政審議室長 → 内閣官房副長官補; 2007: 防衛庁 → 防衛省) and old saves
  for (const [post, rec] of Object.entries(s.admin.bureaucrats)) if (rec && rec.kanbo) rec.kanbo.title = secondTitle(post, d.fy);
  if (made.length && today(g) > s.init + 1) {
    const names = made.map((x) => ministryName(x, d.fy)).filter(Boolean);
    if (names.length) govtNews(g, s, `${names.slice(0, 4).join('・')}${names.length > 4 ? 'など' : ''}の${made.some((x) => TOP_TITLE[x]) ? '幹部' : '事務次官'}が任命された（組織の発足・再編）`, { politics: false });
    if (d.year >= 2001 && !s.admin.reforms.reorg2001) s.admin.reforms.reorg2001 = { day: today(g), year: 2001, month: 1 };
  }
}
// 夏の人事 (July): the 事務次官 usually serve a year or two; with the 内閣人事局 the cabinet has the last word (picks).
const AMAKUDARI_ORGS = ['一般財団法人 ドット公益協会', '公益社団法人 全国ドット振興会', '一般社団法人 ドット技術センター', 'ドット保証機構（特殊法人・架空）', '一般財団法人 ドット建設情報研究所'];
function personnelTick(g, s) {
  const d = gdate(g);
  if (d.doy < 60 || num(s.admin.personnelYear) >= d.year) return;
  s.admin.personnelYear = d.year;
  const p = pol(g);
  const changed = [];
  const ban = !!(p && p.flags && p.flags.amakudariBan);
  for (const [post, rec] of Object.entries(s.admin.bureaucrats)) {
    const t = rec.top;
    const yrs = (today(g) - num(t.since)) / YEAR_DAYS;
    if (yrs < 0.8 && Math.random() < 0.7) { t.age++; continue; }
    if (!(yrs >= 2 || Math.random() < 0.6)) { t.age++; continue; }
    const pick = rec.pick || (rec.bureaus.length && Math.random() < 0.5 ? 'bureau' : 'kanbo');
    let next = pick === 'bureau' && rec.bureaus.length ? rec.bureaus.shift() : rec.kanbo;
    if (pick === 'outside') next = newBureaucrat(s, d.year, '', post, today(g));
    next = { ...next, title: TOP_TITLE[post] || '事務次官', since: today(g) };
    // the retiree: 再就職 (天下り) to a related body, rarer under the 2007 rules
    if (Math.random() < (ban ? 0.12 : 0.55)) {
      const org = pickOne(AMAKUDARI_ORGS);
      s.admin.amakudari.cases.unshift({ day: today(g), name: t.name, from: `${ministryName(post, d.fy)}の${t.title}`, to: `${org}の理事長`, fictional: true });
      if (s.admin.amakudari.cases.length > 20) s.admin.amakudari.cases.length = 20;
      s.admin.amakudari.heat = clamp(num(s.admin.amakudari.heat) + (ban ? 1 : 3), 0, 100);
    }
    rec.top = next;
    if (pick !== 'bureau' || next === rec.kanbo) rec.kanbo = newBureaucrat(s, d.year, secondTitle(post, d.fy), post, today(g));
    while (rec.bureaus.length < (BUREAUS[post] || []).length) rec.bureaus.push(newBureaucrat(s, d.year, (BUREAUS[post] || [])[rec.bureaus.length], post, today(g)));
    rec.bureaus.forEach((b, i) => { b.title = (BUREAUS[post] || [])[i] || b.title; });
    rec.pick = null;
    changed.push(post);
  }
  if (changed.length) govtNews(g, s, `中央省庁の夏の幹部人事：${changed.length}府省庁で事務次官などが交代した${s.admin.reforms.jinjikyoku ? '（内閣人事局が幹部人事を一元管理）' : ''}`, { politics: false });
  // 天下り as an issue: a fictional case surfaces when the heat is high
  const A = s.admin.amakudari;
  if (A.heat >= 55 && Math.random() < 0.35 && (!A.lastScandal || today(g) - A.lastScandal > 200)) {
    A.lastScandal = today(g);
    A.heat = Math.max(0, A.heat - 30);
    govtNews(g, s, '中央省庁のOBが、所管の業界や関連団体（架空）に次々と再就職していることが報じられ、「天下り」への批判が高まっている', { phone: true, head: '天下り批判' });
    ledgerAdd(g, s, 'admin', { scandal: -3, text: '天下りへの批判' });
    addEvent(g, s, 'amakudari', '天下りへの批判', { segs: { floating: -2, urban: -1, young: -1 } });
  }
  emit(g, 'bureaucrat', { changed });
}
function councilConsultImpl(g, s, id, topic) {
  const C = COUNCILS[id];
  const p = pol(g);
  const d = gdate(g);
  if (!C) return { ok: false, why: 'そんな審議会はない' };
  const name = txt(C.name, d.year);
  if (!councilExists(id, d.fy)) return { ok: false, why: `${name}は、いまの時代にはない` };
  if (!p) return { ok: false, why: '政治のしくみが読み込まれていない' };
  if (!canAsk(p, C.posts)) return { ok: false, why: `${name}に諮問できるのは、${C.posts.filter((x) => x !== 'pm').map((x) => postNameNow(g, x)).slice(0, 2).join('か') || '総理大臣'}${C.posts.includes('pm') || !C.posts.length ? '' : 'か総理大臣'}` };
  const st = s.admin.councils[id];
  if (st && st.status === 'pending') return { ok: false, why: `いま審議中（答申は${dLabel(g, st.due)}ごろ）` };
  if (st && st.reportDay && today(g) - st.reportDay < 30) return { ok: false, why: '答申が出たばかり' };
  const t = String(topic || C.topic).slice(0, 30);
  s.admin.councils[id] = { status: 'pending', topic: t, asked: today(g), due: today(g) + irnd(5, 12), by: 'player' };
  govtNews(g, s, `${name}に「${t}」について諮問した`, { politics: false });
  emit(g, 'council', { id, stage: 'asked', topic: t });
  return { ok: true, due: s.admin.councils[id].due, text: `${name}に「${t}」を諮問した。答申は${dLabel(g, s.admin.councils[id].due)}ごろ。` };
}
function councilTick(g, s) {
  const d = gdate(g);
  for (const [id, st] of Object.entries(s.admin.councils)) {
    if (!st || st.status !== 'pending' || today(g) < num(st.due)) continue;
    const C = COUNCILS[id];
    const name = txt(C.name, d.year);
    st.status = 'reported';
    st.reportDay = today(g);
    st.validUntil = today(g) + YEAR_DAYS;
    const split = pickOne(['委員の多くは見直しの必要性を認めたが、慎重な意見も付記された', '方向性では一致したが、時期と負担のあり方については両論が併記された', '急な見直しには慎重な意見が多く、段階的に進めるよう求めた']);
    st.report = { day: today(g), text: `「${st.topic}」について答申：${split}。` };
    if (id === 'zeicho') s.taxReform.zeichoBonus = 0.15;
    const p = pol(g);
    if (p && p.me && st.by === 'player') p.me.reputation = clamp(num(p.me.reputation) + 1, -100, 100);
    ledgerAdd(g, s, 'admin', { mood: 0.3, text: `${name}の答申` });
    govtNews(g, s, `${name}が「${st.topic}」について答申した。${split}`);
    emit(g, 'council', { id, stage: 'reported', topic: st.topic, report: st.report });
  }
}
function ordinanceBlock(g, s, id, opt) {
  const O = ORDINANCES[id];
  const p = pol(g);
  const d = gdate(g);
  if (!O) return 'そんな政令・省令はない';
  if (!ordinanceExists(id, d.fy)) return 'いまの時代には、まだその仕組みがない';
  if (!p || !POL) return '政治のしくみが読み込まれていない';
  if (!canAsk(p, O.posts)) return `${O.kind === '閣議決定' ? '閣議決定は内閣で。担当' : '担当'}の大臣（${O.posts.map((x) => postNameNow(g, x)).filter((x, i, a) => x && a.indexOf(x) === i && POL.postExists(O.posts[i], d.fy, p.flags)).join('・') || '担当大臣'}）か総理大臣でないと出せない`;
  if (p.cabinet.resigned) return '総辞職した内閣は、新しい政策を決められない';
  const st = s.admin.ordinances[id];
  if (st && today(g) - num(st.last) < O.cooldown) return `前回から間がない（次は${dLabel(g, num(st.last) + O.cooldown)}ごろから）`;
  const need = needCouncilOf(O, d.fy);
  if (need) { const c = s.admin.councils[need]; if (!c || c.status !== 'reported' || today(g) > num(c.validUntil)) return `先に${txt(COUNCILS[need].name, d.year)}に諮問し、答申を受ける必要がある`; }
  if (opt != null && !O.options[opt]) return 'その選択肢はない';
  return null;
}
function issueOrdinanceImpl(g, s, id, opts = {}) {
  const O = ORDINANCES[id];
  const keys = O ? Object.keys(O.options) : [];
  const opt = opts.option || keys[0];
  const why = ordinanceBlock(g, s, id, opt);
  if (why) return { ok: false, why };
  const P = O.options[opt];
  const p = pol(g);
  const d = gdate(g);
  s.admin.ordinances[id] = { last: today(g), count: num(s.admin.ordinances[id] && s.admin.ordinances[id].count) + 1, option: opt };
  shiftSupport(p, P.seg || {}, 0.004);
  ledgerAdd(g, s, 'admin', { mood: clamp(moodOfSegs(g, P.seg, 1.0), -3, 3), text: O.name, segs: P.seg });
  if (P.eco) ecoShock(g, O.name, P.eco, 90);
  const B = p.economy && p.economy.budget;
  if (P.cost && B) B.deficit = r1(num(B.deficit) + P.cost);
  const rec = s.admin.bureaucrats[O.posts.find((x) => s.admin.bureaucrats[x]) || 'kanbo'];
  const who = rec ? `${rec.top.name}${rec.top.title}` : '事務方';
  const kind = txt(O.kind, d.fy);
  govtNews(g, s, `${O.name}：${P.label}（${kind}、根拠：${txt(O.basis, d.year)}）`);
  addEvent(g, s, 'ordinance', `${O.name}（${P.label}）`, { segs: P.seg, data: { item: O.name.replace(/（.*$/, '') } });
  emit(g, 'ordinance', { id, option: opt });
  return { ok: true, id, option: opt, text: `${who}「${kind === '閣議決定' ? '閣議にお諮りする手続き' : `${kind}の手続き`}を進めます」\n${O.name}：${P.label}。国会の議決はいらないが、もとになる法律（${txt(O.basis, d.year)}）の範囲の中でだけ決められる。` };
}
// 官僚答弁: a fictional official's careful answer (政府委員 before 2000, 政府参考人 after: 目安).
const KANRYO = {
  generic: ['ご指摘の点につきましては、関係省庁と緊密に連携しつつ、適切に対応してまいりたいと考えております。', '現時点で予断をもってお答えすることは、差し控えさせていただきます。', '個別の事案についてのお答えは差し控えますが、一般論として申し上げれば、法令に基づき適切に対処してまいります。', '引き続き、さまざまなご意見を踏まえながら、検討を進めてまいります。'],
  tax: ['税制のあり方につきましては、与党の税制調査会でのご議論も踏まえ、政府として総合的に検討してまいります。'],
  budget: ['予算の編成にあたりましては、歳出全般にわたる見直しを行い、真に必要な分野に重点的に配分したところでございます。'],
  religion: ['宗教法人法の規定に基づき、信教の自由に十分配慮しつつ、適切に対応してまいります。'],
  amakudari: { before: ['再就職につきましては、人事院の承認など、所定の手続きにのっとって行われているものと承知しております。'], after: ['再就職につきましては、国家公務員法の規制にのっとり、適正に行われているものと承知しております。'] },
  postal: ['郵政事業のあり方につきましては、利用者の利便を損なわないよう、総合的に検討してまいります。'],
  disaster: ['被災された方々の生活の再建に向けて、関係機関と緊密に連携し、全力を挙げて取り組んでまいります。'],
  defense: ['我が国の防衛につきましては、憲法の範囲内で、必要な体制を整えてまいります。'],
  economy: ['経済の動向につきましては、引き続き緊張感をもって注視し、必要に応じて機動的に対応してまいります。'],
  scandal: ['ご指摘の件につきましては、事実関係を確認したうえで、適切に対処してまいります。'],
};
const ANSWER_POST = { tax: 'minister_finance', budget: 'minister_finance', religion: 'minister_education', amakudari: 'minister_mgmt', postal: 'minister_posts', defense: 'minister_defense', economy: 'minister_trade', disaster: 'kanbo', scandal: 'kanbo' };
function bureaucratAnswerImpl(g, s, topic = 'generic') {
  const d = gdate(g);
  let post = ANSWER_POST[topic] || 'kanbo';
  if (!s.admin.bureaucrats[post]) { const alt = { minister_mgmt: 'minister_internal', minister_posts: 'minister_internal' }[post]; post = alt && s.admin.bureaucrats[alt] ? alt : 'kanbo'; }
  const rec = s.admin.bureaucrats[post] || Object.values(s.admin.bureaucrats)[0];
  let person = rec ? (rec.bureaus[0] || rec.kanbo) : null;
  // a topic with its own office (天下り): a fictional official of that office, kept in s.admin.officials
  const TO = TOPIC_OFFICIAL[topic] ? byYear(TOPIC_OFFICIAL[topic], d.fy, null) : null;
  if (TO) {
    const [tp, title] = TO;
    const O = obj(s.admin.officials) ? s.admin.officials : (s.admin.officials = {});
    if (!O[topic] || O[topic].title !== title || O[topic].post !== tp) O[topic] = newBureaucrat(s, d.year, title, tp, today(g));
    post = tp;
    person = O[topic];
  }
  let pool = KANRYO[topic] || KANRYO.generic;
  if (topic === 'amakudari') { const p = pol(g); pool = p && p.flags && p.flags.amakudariBan ? KANRYO.amakudari.after : KANRYO.amakudari.before; }
  s.admin.answers = num(s.admin.answers) + 1;
  return { who: person ? person.name : '担当の局長', title: person ? `${ministryName(post, d.fy)} ${person.title}` : '', role: d.year < 2000 ? '政府委員' : '政府参考人', text: pickOne([...pool, ...KANRYO.generic.slice(0, 2)]), fictional: true };
}
// In the 予算委員会 the PM or the minister answers (from the officials' draft).
function ministerAnswer(g, s, topic) {
  const p = pol(g);
  const d = gdate(g);
  const base = bureaucratAnswerImpl(g, s, topic);
  let post = ANSWER_POST[topic] || 'pm';
  if (post !== 'pm' && POL && !POL.postExists(post, d.fy, (p && p.flags) || {})) post = { minister_mgmt: 'minister_internal', minister_posts: 'minister_internal' }[post] || 'pm';
  if (post === 'kanbo' || !(p && p.cabinet && p.cabinet.ministers[post])) post = 'pm';
  const who = post === 'pm' ? p && p.cabinet && p.cabinet.pm : p.cabinet.ministers[post];
  const name = who === 'player' ? g.state.name : npcNameOf(g, who);
  return { ...base, who: name || base.who, title: post === 'pm' ? '内閣総理大臣' : postNameNow(g, post), role: '答弁' };
}
function adminActionImpl(g, s, kind, opts = {}) {
  const p = pol(g);
  const d = gdate(g);
  if (!p || !POL) return { ok: false, why: '政治のしくみが読み込まれていない' };
  if (kind === 'kanbu_jinji') {
    if (!s.admin.reforms.jinjikyoku) return { ok: false, why: '幹部人事を内閣が一元管理する仕組み（内閣人事局）がまだない' };
    if (!(isPMg(p) || postOf(p, 'kanbo'))) return { ok: false, why: '幹部人事を決めるのは総理大臣と官房長官（内閣人事局）' };
    const post = opts.post;
    if (!s.admin.bureaucrats[post]) return { ok: false, why: 'その府省はない' };
    const pick = ['kanbo', 'bureau', 'outside'].includes(opts.pick) ? opts.pick : 'kanbo';
    s.admin.bureaucrats[post].pick = pick;
    s.admin.picks = num(s.admin.picks) + 1;
    s.admin.sontaku = clamp(num(s.admin.sontaku) + 4, 0, 100);
    if (s.admin.sontaku >= 30 && Math.random() < 0.2) {
      govtNews(g, s, '「官邸の意向に官僚が過度に配慮しているのではないか（忖度）」との指摘が出ている', { politics: true });
      ledgerAdd(g, s, 'admin', { scandal: -1.5, text: '人事への批判' });
      s.admin.sontaku -= 15;
    }
    return { ok: true, text: `${ministryName(post, d.fy)}の次の${TOP_TITLE[post] || '事務次官'}は、夏の人事で${pick === 'kanbo' ? '官房長から' : pick === 'bureau' ? '局長から' : '外部から'}起用する方針を伝えた。政治主導が進む一方、「官僚が官邸の顔色をうかがうようになる」との懸念もある。` };
  }
  if (kind === 'amakudari_check') {
    if (!(isPMg(p) || postOf(p, 'kanbo') || postOf(p, 'minister_mgmt') || postOf(p, 'minister_internal'))) return { ok: false, why: '公務員制度を担当する大臣か、総理・官房長官が指示する' };
    const A = s.admin.amakudari;
    if (A.checked && today(g) - A.checked < 60) return { ok: false, why: '前回の点検から間がない' };
    A.checked = today(g);
    const found = A.cases.filter((c) => today(g) - c.day < 240).length;
    A.heat = clamp(A.heat - 10, 0, 100);
    ledgerAdd(g, s, 'admin', { mood: 0.5, text: '再就職の実態調査' });
    govtNews(g, s, `政府が中央省庁OBの再就職の実態を調査した（最近の再就職 ${found}件）`);
    return { ok: true, found, text: `各府省に、OBの再就職の実態を報告させた（最近の例 ${found}件）。${p.flags.amakudariBan ? '2007年の改正にもとづく監視を強めるよう指示した。' : 'あっせんを禁じる法律はまだない。規制の法律（「天下りの規制」）を出すこともできる。'}` };
  }
  return { ok: false, why: 'そんな指示はない' };
}

// ================================================================ 郵政民営化
const POSTAL_FACTS = [
  { year: 1949, month: 6, text: '郵政省が発足（郵便・郵便貯金・簡易保険の「郵政三事業」を国が直営）' },
  { year: 2001, month: 1, text: '中央省庁再編で郵政事業庁（総務省の外局）に' },
  { year: 2003, month: 4, text: '日本郵政公社が発足' },
  { year: 2005, month: 7, text: '郵政民営化関連法案が衆議院で可決（233対228の僅差）', real: true },
  { year: 2005, month: 8, text: '参議院で否決。総理は衆議院を解散した', real: true },
  { year: 2005, month: 9, text: '総選挙（9月11日）。与党が大きく議席を伸ばした', real: true },
  { year: 2005, month: 10, text: '特別国会で郵政民営化関連6法が成立（10月14日）', real: true },
  { year: 2007, month: 10, text: '民営化。日本郵政グループ（日本郵政・郵便事業・郵便局・ゆうちょ銀行・かんぽ生命保険）が発足', real: true },
  { year: 2012, month: 4, text: '改正郵政民営化法が成立（4月27日）。10月に郵便事業会社と郵便局会社が統合して日本郵便に（4社体制）', real: true },
];
const POSTAL_PRO = ['「民間にできることは民間に」。経営の自由度が上がり、サービスがよくなる', '郵便貯金・簡易保険の巨額の資金が、国の事業（財政投融資）ではなく民間の経済に回る', '公務員の数が減り、税金や手数料の上乗せのない競争になる'];
const POSTAL_CON = ['採算のとれない地方の郵便局が減り、過疎地のサービスが落ちる', '全国一律の郵便サービス（ユニバーサルサービス）が守られるのか不安', '巨額の資金が市場に出ることのリスク。急ぐ必要はないという声'];
function postalStatus(g, s) {
  const d = gdate(g);
  const p = pol(g);
  const now = ym(d.year, d.month);
  const P = s.postal;
  let stage = 'ministry';
  if (P.revised && ym(P.revised.year, P.revised.month || 4) <= now) stage = 'revised';
  else if (P.privatized && ym(P.privatized.year, P.privatized.month || 4) <= now) stage = 'private';
  else if (P.law) stage = 'law';
  else if (now >= ym(2003, 4)) stage = 'corp';
  else if (now >= ym(2001, 1)) stage = 'agency';
  const LABEL = {
    ministry: '郵政省（郵便・郵便貯金・簡易保険の三事業を国が直営）', agency: '郵政事業庁（総務省の外局）', corp: '日本郵政公社',
    law: P.law ? `郵政民営化法が成立（${P.law.year}年）。${P.privatized ? `${P.privatized.year}年${P.privatized.month}月の民営化に向けて準備中` : ''}` : '',
    private: '民営化（日本郵政グループ）', revised: '民営化後の見直しずみ（日本郵便などの4社体制）',
  };
  const timeline = POSTAL_FACTS.filter((f) => ym(f.year, f.month) <= now && (!f.real || (P.law && P.law.real))).map((f) => ({ ...f }));
  for (const l of P.log || []) timeline.push({ year: l.year, month: l.month, text: l.text, game: true });
  timeline.sort((a, b) => ym(a.year, a.month) - ym(b.year, b.month));
  let block = null;
  try { block = typeof g.policyBlock === 'function' ? g.policyBlock('postal_privatization') : null; } catch (e) { block = '—'; }
  const bill = p && p.diet.bills.find((b) => b.policy === 'postal_privatization' && !['enacted', 'rejected', 'shelved'].includes(b.stage));
  return {
    stage, label: LABEL[stage], open: !block && !['law', 'private', 'revised'].includes(stage), block, inForce: P.law ? P.law.year : null,
    privatized: P.privatized ? { ...P.privatized } : null, revised: P.revised ? { ...P.revised } : null,
    timeline, pro: POSTAL_PRO, con: POSTAL_CON,
    segments: { pro: ['urban', 'business', 'young', 'floating'], con: ['rural', 'elderly', 'unions'] },
    bill: bill ? { id: bill.id, title: bill.title, stage: bill.stage, key: !!bill.key } : null,
    note: '民営化の法律の実際の経緯（2005年）は、史実の日付だけを示している（実在の政治家は登場しない）',
  };
}
function postalTick(g, s) {
  const d = gdate(g);
  const P = s.postal;
  const now = ym(d.year, d.month);
  for (const [k, y, m, text] of [['agencyNews', 2001, 1, '郵政省の事業は、総務省の外局の郵政事業庁に引き継がれた'], ['corpNews', 2003, 4, '日本郵政公社が発足した（郵政事業庁から移行）']]) {
    if (!P[k] && now >= ym(y, m) && s.startYear * 12 + 3 < ym(y, m) && !P.law) { P[k] = today(g); govtNews(g, s, text); }
  }
  if (P.privatized && !P.privatized.real && !P.privatizedNews && now >= ym(P.privatized.year, P.privatized.month)) {
    P.privatizedNews = today(g);
    P.log.push({ year: d.year, month: d.month, text: '郵政が民営化され、持株会社のもとに郵便・窓口・貯金・保険の会社が発足した' });
    govtNews(g, s, '郵政が民営化され、新しい郵政グループが発足した（ゲームの中の出来事）', { phone: true, head: '郵政民営化' });
    addEvent(g, s, 'postal', '郵政の民営化', { segs: { urban: 2, business: 2, rural: -2, elderly: -1 } });
    emit(g, 'postal', { stage: 'private' });
  }
}

// ================================================================ RELIGION logic
function reportPowerOK(g, s) {
  const F = s.religion.reportPowerFrom;
  return !!F && nowYM(g) >= ym(F.year, F.month);
}
function cultTick(g, s) {
  const C = s.religion.cult;
  const R = RELIGIOUS_GROUPS.tenkan;
  const grp = s.religion.groups.tenkan;
  const day = today(g);
  const p = pol(g);
  if (C.stage >= 1 && p && p.flags && !p.flags.kifuIssue) p.flags.kifuIssue = true;
  if (C.stage === 0 && day >= num(C.next)) {
    C.stage = 1; C.day = day; C.complaints = irnd(25, 60); C.nextStep = day + irnd(10, 20);
    if (p && p.flags) p.flags.kifuIssue = true;
    govtNews(g, s, `消費生活センターや弁護士会に、宗教団体「${R.name}」（架空）への高額な献金をめぐる家族からの相談が増えている`, { phone: true, head: '社会' });
    addEvent(g, s, 'religion', `「${R.name}」への高額献金の相談`, { segs: { families: -1 } });
    emit(g, 'religion', { stage: 'complaints', group: 'tenkan' });
    return;
  }
  if (C.stage >= 1 && C.stage <= 3) C.complaints = Math.max(0, num(C.complaints) + (s.religion.kifuLaw ? rnd(-0.6, 0.6) : rnd(0, 1.6)));
  if (C.stage === 1 && day >= num(C.nextStep) && (C.complaints >= 45 || C.asked)) {
    C.stage = 2; C.reported = day; C.nextStep = day + irnd(15, 40);
    grp.trust = clamp(grp.trust - 15, 0, 100);
    govtNews(g, s, `「${R.name}」の高額献金の問題が国会でも取り上げられた。被害の救済と、信教の自由への配慮のバランスが焦点に`);
    addEvent(g, s, 'religion', '高額献金の問題が国会で取り上げられる');
    emit(g, 'religion', { stage: 'reported', group: 'tenkan' });
    // the government's bill for the victims (if there is none yet)
    if (p && p.flags && !p.flags.kifuLaw && p.cabinet.pm !== 'player' && POL && POL.POLICIES.kifu_kanyu && !p.diet.bills.some((b) => b.policy === 'kifu_kanyu' && !['rejected', 'shelved', 'enacted'].includes(b.stage))) {
      addCabinetBill(g, p, { title: '法人等による寄附の不当な勧誘の防止等に関する法律案', policy: 'kifu_kanyu', params: {}, ministry: POL.postExists('minister_special', gdate(g).fy, p.flags) ? 'minister_special' : 'minister_justice', draft: !inSessionP(p, day) });
    }
    return;
  }
  // an NPC 所轄庁 acts on its own after a while
  if (C.stage === 2 && day >= num(C.nextStep) && !(p && hasPost(p, 'minister_education'))) {
    if (reportPowerOK(g, s)) doQuestionPower(g, s, 'npc');
    else if (C.complaints >= 140) doRequestDissolution(g, s, 'npc');
    else C.nextStep = day + irnd(20, 40);
    return;
  }
  if (C.stage === 3 && day >= num(C.nextStep)) {
    if (num(C.questions) < 3 && Math.random() < 0.6 && !(p && hasPost(p, 'minister_education'))) { doQuestionPower(g, s, 'npc'); return; }
    if (C.complaints >= 70 && num(C.questions) >= 2 && !(p && hasPost(p, 'minister_education'))) doRequestDissolution(g, s, 'npc');
    else C.nextStep = day + irnd(20, 40);
    return;
  }
  if (C.stage === 4 && day >= num(C.decideDay)) {
    const prob = clamp(0.35 + num(C.complaints) / 300 + num(C.questions) * 0.08, 0.3, 0.88);
    if (Math.random() < prob) {
      C.stage = 5; C.decided = { day, result: 'ordered' };
      grp.status = 'ordered'; grp.members = Math.round(grp.members * 0.7);
      govtNews(g, s, `裁判所が「${R.name}」に宗教法人の解散を命じた（宗教法人法81条）。法人格を失い清算に入るが、信者が信仰を続けることは禁じられない`, { phone: true, head: '解散命令' });
      addEvent(g, s, 'religion', '解散命令', { segs: { families: 1 } });
      ledgerAdd(g, s, 'religion', { mood: 0.8, text: '被害の救済に前進' });
    } else {
      C.stage = 6; C.decided = { day, result: 'dismissed' };
      grp.status = 'normal';
      govtNews(g, s, `裁判所は「${R.name}」への解散命令の請求を退けた（「著しく公共の福祉を害する」とまでは認められないと判断）`);
      addEvent(g, s, 'religion_state', '解散命令の請求が退けられる');
    }
    emit(g, 'religion', { stage: C.decided.result, group: 'tenkan' });
  }
}
function doQuestionPower(g, s, by) {
  const C = s.religion.cult;
  const R = RELIGIOUS_GROUPS.tenkan;
  C.stage = Math.max(3, C.stage);
  C.questions = num(C.questions) + 1;
  C.questioned = { day: today(g), by };
  C.nextStep = today(g) + irnd(30, 60);
  s.religion.groups.tenkan.status = 'questioned';
  govtNews(g, s, `所轄庁が「${R.name}」に、宗教法人法にもとづく報告徴収・質問権を行使した（${C.questions}回目。宗教法人審議会の意見を聞いたうえで）`);
  addEvent(g, s, 'religion_state', '報告徴収・質問権の行使');
  emit(g, 'religion', { stage: 'questioned', group: 'tenkan', count: C.questions, by });
}
function doRequestDissolution(g, s, by) {
  const C = s.religion.cult;
  const R = RELIGIOUS_GROUPS.tenkan;
  C.stage = 4; C.requested = { day: today(g), by }; C.decideDay = today(g) + irnd(60, 120);
  s.religion.groups.tenkan.status = 'requested';
  govtNews(g, s, `所轄庁が「${R.name}」の解散命令を裁判所に請求した（宗教法人法81条）。裁判所が審理する`, { phone: true, head: '解散命令の請求' });
  addEvent(g, s, 'religion_state', '解散命令の請求');
  ledgerAdd(g, s, 'religion', { mood: 0.6, text: '解散命令の請求' });
  emit(g, 'religion', { stage: 'requested', group: 'tenkan', by });
}
// The 組織票 of a religious group never goes to a candidate tied to a real party (the real-party rule): one of a real
// party, put up (公認・推薦) by one, in a cabinet or coalition that includes one, or in an election alliance with one.
function realPartyTie(g, s, p, R) {
  const me = p && p.me;
  if (!me) return null;
  const isReal = (id) => !!id && (realParty(id) || !!(p.parties && p.parties[id] && p.parties[id].real));
  const nom = me.candidacy && me.nominations ? me.nominations[me.candidacy] : null;
  if (isReal(me.party) || isReal(nom)) return `「${R.name}」は、実在の政党に所属する（公認・推薦を受けた）候補者の推薦はしない（このゲームの設定）`;
  if (me.party && isRulingParty(p, me.party) && realInGovt(p)) return `「${R.name}」は、実在の政党と連立を組む政党の候補者の推薦はしない（このゲームの設定）`;
  const A = s.opposition && s.opposition.alliance;
  if (A && me.party && (A.parties || []).includes(me.party) && (A.parties || []).some(isReal)) return `「${R.name}」は、実在の政党と選挙協力をしている政党の候補者の推薦はしない（このゲームの設定）`;
  return null;
}
// religionAction kinds and their govtRefusal kinds (one check for both: the UI never guesses).
export const RELIGION_ACTIONS = { visit: 'religion_visit', ask_support: 'religion_endorse', public_money: 'religion_funds', report: 'religion_report', victim_support: 'religion_victim', diet_question: 'religion_question', question_power: 'religion_question_power', request_dissolution: 'religion_dissolution' };
const RELIGION_ACTION_OF = Object.fromEntries(Object.entries(RELIGION_ACTIONS).map(([a, k]) => [k, a]));
const PROBLEM_ACTIONS = ['report', 'victim_support', 'diet_question', 'question_power', 'request_dissolution'];
// Why a religion action cannot be taken now (null = it can). Side-effect free; religionActionImpl runs it first.
function religionBlock(g, s, groupId, kind) {
  const R = RELIGIOUS_GROUPS[groupId];
  const st = s.religion.groups[groupId];
  const p = pol(g);
  const day = today(g);
  const C = s.religion.cult;
  if (kind === 'public_money') return RELIGION_LAW.art89;
  if (!R || !st) return 'そんな団体はない';
  if (kind === 'visit') {
    if (st.lastVisit === day) return '今日はもう訪ねた';
    return num(g.state && g.state.stamina) < 10 ? '体力が足りない' : null;
  }
  if (kind === 'ask_support') {
    if (!R.endorse) return `「${R.name}」は、選挙で候補者を推薦する活動はしていない`;
    if (!p || !p.me) return '政治のしくみが読み込まれていない';
    const tie = realPartyTie(g, s, p, R);
    if (tie) return tie;
    const e = p.me.candidacy && p.elections.upcoming.find((x) => x.id === p.me.candidacy);
    if (!e) return '立候補を届け出てから、推薦をお願いできる';
    if (s.religion.endorsements.some((x) => x.election === e.id)) return 'この選挙では、もう推薦をもらっている';
    if (num(st.relation) < 40) return `まだ「${R.name}」との信頼関係が足りない（行事に参加して、考えを伝えるところから）`;
    return null;
  }
  if (!PROBLEM_ACTIONS.includes(kind)) return 'そんな行動はない';
  if (!R.problem) return 'この団体には、その対応は関係ない';
  if (C.stage === 0) return 'いまのところ、この団体をめぐる被害の相談は表に出ていない';
  if (C.stage >= 5) return C.stage === 5 ? 'すでに解散命令が出ている' : '裁判所の判断が出たあと';
  if (kind === 'report') return null;
  if (kind === 'victim_support') return num(g.state && g.state.stamina) < 10 ? '体力が足りない' : null;
  if (kind === 'diet_question') {
    if (!isNational(p)) return '国会で質問できるのは国会議員だけ';
    if (!inSessionP(p, day)) return '国会の会期中に';
    return C.lastQ && day - C.lastQ < 10 ? '前の質問から間がない' : null;
  }
  if (kind === 'question_power') {
    if (!p || !hasPost(p, 'minister_education')) return `報告徴収・質問権を使うのは所轄庁（この団体は${postNameNow(g, 'minister_education')}）`;
    if (!reportPowerOK(g, s)) return '宗教法人法に、報告徴収・質問権の規定がまだない（法改正「宗教法人法の改正」が必要）';
    if (C.stage === 4) return 'すでに裁判所が審理している';
    const cs = s.admin.councils.shukyo;
    if (!cs || cs.status !== 'reported' || day > num(cs.validUntil)) return '先に宗教法人審議会の意見を聞く（審議会に諮問する）';
    return C.questioned && day - num(C.questioned.day) < 15 ? '前回の質問への回答を待っている' : null;
  }
  // request_dissolution
  if (!p || !hasPost(p, 'minister_education')) return `解散命令を請求するのは所轄庁（${postNameNow(g, 'minister_education')}）か検察官など`;
  if (C.stage === 4) return 'すでに裁判所が審理している';
  return num(C.questions) >= 2 || C.complaints >= 140 ? null : '請求には、法令違反と「著しく公共の福祉を害する」ことを示す十分な証拠がいる（報告徴収・質問で実態を確かめてから）';
}
function religionActionImpl(g, s, groupId, kind, opts = {}) {
  const why = religionBlock(g, s, groupId, kind);
  if (why) return { ok: false, why };
  const R = RELIGIOUS_GROUPS[groupId];
  const st = s.religion.groups[groupId];
  const p = pol(g);
  const day = today(g);
  const C = s.religion.cult;
  const gs = g.state;
  const d = gdate(g);
  void opts;
  if (kind === 'visit') {
    gs.stamina -= 10;
    st.lastVisit = day; st.visits = num(st.visits) + 1; st.relation = clamp(num(st.relation) + 8, 0, 100);
    const act = pickOne(R.activities);
    let extra = '';
    if (p && p.me && p.me.office && !R.problem) { p.me.localSupport = clamp(num(p.me.localSupport) + 0.6, 0, 100); extra = '地元の人たちと顔を合わせられた。'; }
    if (R.problem && C.stage >= 2 && p && p.me && p.me.office) { p.me.reputation = clamp(num(p.me.reputation) - 4, -100, 100); extra = '問題が指摘されている団体との関係を、記者にたずねられた…（問われているのは信仰ではなく、献金をめぐる行為）'; }
    try { if (typeof g.addNeed === 'function') g.addNeed('stress', -4); } catch (e) { /* */ }
    return { ok: true, text: `「${R.name}」の${act}に参加した。${extra}`, relation: st.relation };
  }
  if (kind === 'ask_support') {
    const e = p.elections.upcoming.find((x) => x.id === p.me.candidacy);
    const camp = p.me.campaign && p.me.campaign.election === e.id ? p.me.campaign : (p.me.campaign = { election: e.id, points: 0, actions: {}, spent: 0, day });
    const pts = Math.round(12 + num(st.relation) / 8) * num(R.votePower, 1);
    camp.points = num(camp.points) + pts;
    s.religion.endorsements.push({ day, group: groupId, election: e.id, points: pts });
    govtNews(g, s, `「${R.name}」（架空）が、${e.label}で${g.state.name}候補を推薦した`, { politics: true });
    addEvent(g, s, 'religion_politics', '宗教団体が候補者を推薦', { segs: { elderly: 0.5, families: 0.3, floating: -0.8, young: -0.5 } });
    return { ok: true, points: pts, text: `「${R.name}」から推薦をもらった（選挙運動の力 +${pts}）。宗教団体が選挙で候補者を応援すること自体は憲法で禁じられていないが、「組織票に頼るのか」という声もある。` };
  }
  if (kind === 'report') {
    C.complaints = num(C.complaints) + 4;
    return { ok: true, text: '被害の家族の話を聞き、消費生活センターと弁護士会の相談窓口につないだ。（信仰の自由は尊重しながら、違法な勧誘には法律で対応する）' };
  }
  if (kind === 'victim_support') {
    gs.stamina -= 10;
    C.victims = num(C.victims) + 1;
    if (p && p.me && p.me.office) p.me.reputation = clamp(num(p.me.reputation) + 1, -100, 100);
    // 法テラス（日本司法支援センター）: 業務開始 2006-10-02 (houterasu.or.jp)
    return { ok: true, text: `被害にあった家族の相談会を手伝った。${d.fy >= 2006.75 ? '法テラスや弁護士会の窓口を紹介した。' : '弁護士会や消費生活センターの窓口を紹介した。'}` };
  }
  if (kind === 'diet_question') {
    C.lastQ = day; C.asked = true;
    p.me.reputation = clamp(num(p.me.reputation) + 2, -100, 100);
    const ans = bureaucratAnswerImpl(g, s, 'religion');
    return { ok: true, answer: ans, text: `委員会で、高額献金の被害の救済について質問した。\n${ans.role}（${ans.title} ${ans.who}）「${ans.text}」` };
  }
  if (kind === 'question_power') {
    doQuestionPower(g, s, 'player');
    return { ok: true, text: '宗教法人審議会の意見を聞いたうえで、報告徴収・質問権を行使した。信教の自由に配慮しつつ、献金の勧誘の実態について報告を求めた。' };
  }
  if (kind === 'request_dissolution') {
    doRequestDissolution(g, s, 'player');
    return { ok: true, text: '裁判所に解散命令を請求した。判断するのは裁判所。解散命令は法人格を失わせるもので、信仰そのものを禁じるものではない。' };
  }
  return { ok: false, why: 'そんな行動はない' };
}
// An endorsement already given is withdrawn when the candidate becomes tied to a real party before the vote (joins a
// coalition with one, an alliance...): the real-party rule holds on every day, not only on the day of the request.
function endorsementsTick(g, s) {
  const p = pol(g);
  if (!p || !p.me || !Array.isArray(s.religion.endorsements)) return;
  for (const E of s.religion.endorsements) {
    if (E.withdrawn) continue;
    const e = p.elections && p.elections.upcoming.find((x) => x.id === E.election && x.status !== 'done');
    if (!e) continue;
    const R = RELIGIOUS_GROUPS[E.group] || RELIGIOUS_GROUPS.wako;
    if (!realPartyTie(g, s, p, R)) continue;
    E.withdrawn = today(g);
    const camp = p.me.campaign;
    if (camp && camp.election === E.election) camp.points = Math.max(0, num(camp.points) - num(E.points));
    govtNews(g, s, `「${R.name}」（架空）は、${e.label}での${g.state.name}候補の推薦を取り下げた（候補者の政党が実在の政党と連携したため。このゲームの設定）`, { politics: true });
  }
}
function religionStatus(g, s) {
  const d = gdate(g);
  const p = pol(g);
  const C = s.religion.cult;
  const law = [RELIGION_LAW.art20, RELIGION_LAW.art89, RELIGION_LAW.politicalActivity, RELIGION_LAW.shokatsu, RELIGION_LAW.dissolution];
  if (reportPowerOK(g, s) || (s.religion.reportPowerFrom && d.year >= 1995)) law.splice(4, 0, RELIGION_LAW.reform1995);
  if (s.religion.kifuLaw && s.religion.kifuLaw.real) law.push(RELIGION_LAW.kifu2022);
  else if (s.religion.kifuLaw) law.push('寄附の不当な勧誘を禁じる法律が成立した（ゲームの中の出来事）。');
  const STAGE = ['表に出た問題はない', '被害の相談が増えている', '国会・報道で取り上げられている', '所轄庁が報告徴収・質問権を行使', '解散命令の請求 → 裁判所が審理中', '解散命令（法人格を失い清算へ）', '裁判所の判断が出た（請求は退けられた）'];
  return {
    groups: RELIGION_ORDER.map((id) => ({ ...RELIGIOUS_GROUPS[id], ...s.religion.groups[id] })),
    law, reportPower: reportPowerOK(g, s), kifuLaw: !!(p && p.flags && p.flags.kifuLaw),
    cult: { group: 'tenkan', stage: C.stage, label: STAGE[C.stage] || '', complaints: Math.round(num(C.complaints)), questions: num(C.questions), requested: C.requested, decided: C.decided },
    endorsements: s.religion.endorsements.slice(-10),
    note: '宗教団体はすべて架空。信仰そのものではなく、違法な勧誘・献金の強要が問題として扱われる',
  };
}

// ================================================================ THE DIET: opposition & ruling tactics
export const QUESTION_TOPICS = {
  generic: '政府の方針', tax: '税制', budget: '予算', economy: '物価と景気', scandal: '政治とカネ', amakudari: '天下り', religion: '高額献金の被害', postal: '郵政', defense: '防衛', disaster: '災害への備え',
};
export const OPPOSITION_ACTIONS = {
  shitsumon_shuisho: { label: '質問主意書を出す', law: '国会法74条・75条', desc: '議長の承認を経て内閣に文書で質問する。内閣は7日以内に答弁書を閣議決定して答える。' },
  yosan_shitsugi: { label: '予算委員会で質問する', law: '国会法・衆議院規則', desc: '予算の審議では、テレビ中継のある予算委員会で、総理や大臣にあらゆる問題をただせる。' },
  taian: { label: '対案（議員立法）を出す', law: '国会法56条', desc: '反対するだけでなく、自分たちの案を法律案として出す。' },
  kyoto: { label: '野党共闘（選挙協力）', law: '—', desc: '野党どうしで候補者を一本化し、与党に対抗する。「野合」との批判もある。' },
  shingi_kyohi: { label: '審議拒否', law: '—', desc: '委員会の審議に応じず、強引な国会運営に抗議する。「仕事の放棄」との批判もある。' },
  fushinnin: { label: '内閣不信任決議案を出す', law: '憲法69条', desc: '衆議院議員50人以上の賛成で提出。可決されれば内閣は10日以内に解散か総辞職。' },
};
export const RULING_ACTIONS = {
  kokutai: { label: '国対の与野党協議（修正協議）', law: '—', desc: '国会対策委員長どうしで日程や法案の修正を話し合い、野党の賛成を広げる。' },
  kyoko: { label: '採決を急ぐ（いわゆる強行採決）', law: '—', desc: '野党の反対を押し切って委員会の採決を行う。数の力で決められるが、強い批判を浴びる。' },
  key_bill: { label: '政権の最重要法案に位置づける', law: '—', desc: '参議院で否決されたら、衆議院を解散して国民に信を問う、という覚悟を示す。' },
};
const liveBill = (b) => b && !['enacted', 'rejected', 'shelved', 'draft', 'referendum'].includes(b.stage);
function playerPartyRole(p) {
  const me = p && p.me;
  const pt = me && me.party && p.parties[me.party];
  return { pt, leader: !!(pt && pt.leader === 'player'), kokutai: myPosts(p).includes('kokutai'), kanjicho: myPosts(p).includes('kanjicho'), sentai: myPosts(p).includes('sentai'), ruling: !!(me && me.party && isRulingParty(p, me.party)) };
}
function oppositionImpl(g, s, kind, opts = {}) {
  const p = pol(g);
  if (!p || !POL) return { ok: false, why: '政治のしくみが読み込まれていない' };
  const day = today(g);
  const me = p.me;
  const role = playerPartyRole(p);
  const O = s.opposition;
  if (kind === 'fushinnin') { try { return g.noConfidence(opts); } catch (e) { return { ok: false, why: String(e && e.message) }; } }
  if (kind === 'shitsumon_shuisho') {
    if (!isNational(p)) return { ok: false, why: '質問主意書を出せるのは国会議員だけ' };
    if (!inSessionP(p, day)) return { ok: false, why: '質問主意書は国会の会期中に出す（国会法74条）' };
    if (day - num(O.lastQ, -99) < 2) return { ok: false, why: '前の質問主意書から間がない' };
    const topic = QUESTION_TOPICS[opts.topic] ? opts.topic : 'generic';
    O.lastQ = day;
    const q = { id: 'q' + s.nextId++, day, topic, title: `${QUESTION_TOPICS[topic]}に関する質問主意書`, due: day + 3, answered: null };
    O.questions.unshift(q);
    if (O.questions.length > 20) O.questions.length = 20;
    me.reputation = clamp(num(me.reputation) + 1, -100, 100);
    let note = '';
    if (role.ruling) { me.standing = clamp(num(me.standing) - 2, 0, 100); note = '（与党の議員が質問主意書を出すのは珍しい。党内では少し目立ってしまった）'; }
    emit(g, 'opposition', { kind, question: q });
    return { ok: true, question: q, text: `「${q.title}」を議長に提出した。承認されると内閣に送られ、7日以内に答弁書が届く。${note}` };
  }
  if (kind === 'yosan_shitsugi') {
    if (!isNational(p)) return { ok: false, why: '予算委員会で質問できるのは国会議員だけ' };
    const S = p.diet.session;
    const bud = p.diet.bills.find((b) => b.kind === 'budget' && !b.policy && liveBill(b));
    if (!S || !inSessionP(p, day) || !bud) return { ok: false, why: '予算委員会の審議（通常国会の前半、予算案が審議中のとき）に' };
    if (day - num(O.budgetQ.day, -99) < 5) return { ok: false, why: '予算委員会の質問の時間は、次は数日後（各会派に割り振られる）' };
    O.budgetQ = { day };
    const talk = num(g.state.skills && g.state.skills.talk);
    const score = clamp(num(opts.score, 30 + talk * 0.5 + rnd(-10, 15)), 0, 100);
    const topic = QUESTION_TOPICS[opts.topic] ? opts.topic : 'generic';
    try { if (typeof g.addFame === 'function') g.addFame(Math.round(60 + score * 2), true); } catch (e) { /* */ }
    me.reputation = clamp(num(me.reputation) + (score - 40) / 10, -100, 100);
    if (!role.ruling) ledgerAdd(g, s, 'diet', { mood: -clamp((score - 45) / 15, -1, 3), text: '予算委員会での追及' });
    else ledgerAdd(g, s, 'diet', { mood: clamp((score - 50) / 30, -1, 1.5), text: '予算委員会での質疑' });
    const ans = ministerAnswer(g, s, topic);
    if (topic === 'religion') s.religion.cult.asked = true;
    if (topic === 'amakudari') s.admin.amakudari.heat = clamp(num(s.admin.amakudari.heat) + 5, 0, 100);
    addEvent(g, s, 'opposition', `予算委員会の質疑（${QUESTION_TOPICS[topic]}）`, { segs: role.ruling ? {} : { floating: 0.5, young: 0.3 }, n: 2 });
    emit(g, 'opposition', { kind, topic, score });
    return { ok: true, score: Math.round(score), answer: ans, text: `テレビ中継の予算委員会で「${QUESTION_TOPICS[topic]}」について質問した（出来 ${Math.round(score)}点）。\n${ans.title}（${ans.who}）「${ans.text}」` };
  }
  if (kind === 'taian') {
    if (!isNational(p)) return { ok: false, why: '対案（議員立法）を出せるのは国会議員だけ' };
    if (role.ruling) return { ok: false, why: '与党の議員は、政府の法案の中身を党の事前審査で変えるのが普通（対案は野党の手段）' };
    if (!opts.policy) return { ok: false, why: '対案にする政策を選ぶ（opts.policy）' };
    let id = null;
    try { id = g.proposeBill({ policy: opts.policy, params: opts.params, title: opts.title }); } catch (e) { console.error(e); }
    if (!id) return { ok: false, why: g.lastPoliticsError || '対案を出せなかった' };
    const b = p.diet.bills.find((x) => x.id === id);
    if (b) b.taian = true;
    if (me.party) shiftSupport(p, { floating: 0.6, urban: 0.3 }, 0.003, [me.party]);
    addEvent(g, s, 'opposition', `対案「${b ? b.title : ''}」`, { segs: { floating: 0.5 }, n: 2 });
    emit(g, 'opposition', { kind, billId: id });
    return { ok: true, billId: id, text: `対案として「${b ? b.title : opts.policy}」をまとめた。「批判だけでなく案を出す野党」と受けとめる声もある。` };
  }
  if (kind === 'kyoto') {
    if (!role.pt || role.ruling) return { ok: false, why: '野党共闘は、野党の党首・幹事長・選挙対策委員長が進める' };
    if (!(role.leader || role.kanjicho || role.sentai)) return { ok: false, why: '選挙協力を決めるのは、党首か幹事長・選挙対策委員長' };
    const e = p.elections.upcoming.filter((x) => (x.kind === 'shugi' || x.kind === 'sangi') && x.status !== 'done').sort((a, b) => a.day - b.day)[0];
    if (!e) return { ok: false, why: '次の国政選挙の予定がまだない' };
    const partners = (Array.isArray(opts.partners) ? opts.partners : Object.keys(p.parties)).filter((id) => id !== me.party && p.parties[id] && !isRulingParty(p, id));
    if (!partners.length) return { ok: false, why: '組める野党がない' };
    if (O.alliance && O.alliance.election === e.id) return { ok: false, why: 'この選挙では、もう選挙協力を決めている' };
    O.alliance = { parties: [me.party, ...partners], day, until: e.day, election: e.id, label: e.label };
    shiftSupport(p, { floating: 2.5, urban: 1.5, young: 1, unions: 1 }, 0.004, [me.party]);
    shiftSupport(p, { floating: -0.8, unions: -0.5 }, 0.004, partners);
    shiftSupport(p, { business: -0.6, elderly: -0.3 }, 0.004, [me.party, ...partners]);
    govtNews(g, s, `${partyNameOf(g, me.party)}など野党${partners.length + 1}党が、${e.label}で候補者を一本化する選挙協力に合意した`);
    addEvent(g, s, 'opposition', '野党の選挙協力', { segs: { floating: 0.8, business: -0.6 } });
    emit(g, 'opposition', { kind, alliance: O.alliance });
    return { ok: true, alliance: { ...O.alliance }, text: `${partners.map((id) => partyNameOf(g, id)).join('・')}と、${e.label}の${e.kind === 'sangi' ? '1人区（定数1の選挙区）' : '小選挙区'}で候補者を一本化することで合意した。与党への対抗軸ができる一方、「政策の違う党の野合だ」という批判もある。` };
  }
  if (kind === 'shingi_kyohi') {
    if (!role.pt || role.ruling) return { ok: false, why: '審議拒否は野党が決める' };
    if (!(role.leader || role.kokutai || role.kanjicho)) return { ok: false, why: '審議に応じるかどうかは、党首か国会対策委員長・幹事長が決める' };
    if (!inSessionP(p, day)) return { ok: false, why: '国会の会期中に' };
    const b = p.diet.bills.find((x) => x.id === opts.billId) || p.diet.bills.find((x) => x.sponsor === 'cabinet' && liveBill(x) && x.kind !== 'noconfidence');
    if (!b || !liveBill(b) || b.sponsor !== 'cabinet') return { ok: false, why: '審議中の政府の法案がない' };
    if (O.boycott && O.boycott.until >= day) return { ok: false, why: 'すでに審議を拒否している' };
    O.boycott = { billId: b.id, until: day + 4, party: me.party, day };
    b.next = num(b.next) + irnd(3, 5);
    b.log.push({ day, text: '野党が審議を拒否し、委員会が空転' });
    shiftSupport(p, { floating: -1.5, business: -0.5, unions: 0.8 }, 0.004, [me.party]);
    ledgerAdd(g, s, 'diet', { mood: -0.6, text: '国会の空転' });
    govtNews(g, s, `野党が「${b.title}」の審議を拒否し、国会が空転`);
    addEvent(g, s, 'boycott', `「${b.title}」の審議拒否`, { segs: { unions: 0.5, floating: -0.8 } });
    emit(g, 'opposition', { kind, billId: b.id });
    return { ok: true, billId: b.id, text: `「${b.title}」の審議に応じないことを決めた。採決は遅れるが、「審議拒否は仕事の放棄」との批判も出ている。` };
  }
  return { ok: false, why: 'そんな行動はない' };
}
function kyokoImpl(g, s, b, by) {
  const p = pol(g);
  const day = today(g);
  if (realInGovt(p)) return false; // the real-party rule (callers refuse first; this is the last guard)
  b.next = day;
  b.log.push({ day, text: '野党の反対を押し切って採決へ（いわゆる強行採決）' });
  b.kyoko = day;
  if (s.opposition.boycott && s.opposition.boycott.billId === b.id) s.opposition.boycott = null;
  ledgerAdd(g, s, 'diet', { mood: -rnd(3, 5), text: `「${b.title}」の強行採決` });
  govtNews(g, s, `与党が「${b.title}」の採決を強行した。野党は「数の横暴」と強く反発`, { phone: involved(g) });
  addEvent(g, s, 'kyoko', `「${b.title}」の強行採決`, { segs: { floating: -1.5, young: -0.8, urban: -0.6, business: 0.3, elderly: 0.2 } });
  if (Math.random() < 0.4) spawnDemoImpl(g, s, { against: 'policy', title: b.title, policy: b.policy, segment: 'urban', size: irnd(3000, 15000) });
  emit(g, 'ruling', { kind: 'kyoko', billId: b.id, by });
  return true;
}
function rulingImpl(g, s, kind, opts = {}) {
  const p = pol(g);
  if (!p || !POL) return { ok: false, why: '政治のしくみが読み込まれていない' };
  const day = today(g);
  const role = playerPartyRole(p);
  if (!role.ruling) return { ok: false, why: '与党の国会運営の手段（与党の議員でないと使えない）' };
  const b = p.diet.bills.find((x) => x.id === opts.billId) || p.diet.bills.find((x) => x.sponsor === 'cabinet' && liveBill(x) && x.kind !== 'noconfidence' && x.kind !== 'budget');
  if (kind === 'key_bill') {
    if (!isPMg(p)) return { ok: false, why: '最重要法案と位置づけられるのは総理大臣' };
    if (!b || !liveBill(b) || b.sponsor !== 'cabinet') return { ok: false, why: '審議中の政府の法案を選ぶ' };
    b.key = true;
    s.keyBills[b.id] = { title: b.title, day, policy: b.policy };
    govtNews(g, s, `総理が「${b.title}」を「政権の最重要法案」と位置づけた`);
    return { ok: true, text: `「${b.title}」を政権の最重要法案と位置づけた。参議院で否決されれば、衆議院を解散して国民に信を問う道もある（g.keyBillDissolve）。` };
  }
  if (!(isPMg(p) || role.kokutai || role.kanjicho)) return { ok: false, why: '国会運営を仕切るのは、総理か与党の国会対策委員長・幹事長' };
  if (!inSessionP(p, day)) return { ok: false, why: '国会の会期中に' };
  if (!b || !liveBill(b)) return { ok: false, why: '審議中の法案がない' };
  if (kind === 'kokutai') {
    if (b.kokutai) return { ok: false, why: 'この法案の協議はもう済んだ' };
    b.kokutai = day;
    const bloc = b.bloc || (b.bloc = {});
    const agreed = [];
    for (const id of Object.keys(p.parties)) {
      if (isRulingParty(p, id)) continue;
      if (Math.random() < (bloc[id] ? 1 : 0.45)) { bloc[id] = 1; agreed.push(id); }
    }
    if (s.opposition.boycott && s.opposition.boycott.billId === b.id) s.opposition.boycott = null;
    b.log.push({ day, text: `与野党の国対委員長が協議し、法案の一部修正で${agreed.length ? `${agreed.map((id) => partyNameOf(g, id)).join('・')}が賛成に` : '折り合わず'}` });
    p.me.standing = clamp(num(p.me.standing) + (agreed.length ? 2 : 0) - 1, 0, 100);
    ledgerAdd(g, s, 'diet', { mood: agreed.length ? 0.6 : 0, text: '与野党の修正協議' });
    emit(g, 'ruling', { kind, billId: b.id, agreed });
    return { ok: true, agreed, text: agreed.length ? `野党と修正協議をまとめた。${agreed.map((id) => partyNameOf(g, id)).join('・')}が賛成に回る見通し。中身の一部を譲ったので、党内には不満の声も。` : '協議したが、野党とは折り合えなかった。' };
  }
  if (kind === 'kyoko') {
    const real = realPartyNo(g, p, '採決の強行');
    if (real) return { ok: false, why: real };
    const house = b.house;
    const rulingSeats = (p.cabinet.partyIds || []).reduce((a, id) => a + num(p.diet[house].seats[id]), 0);
    if (rulingSeats <= p.diet[house].total / 2) return { ok: false, why: `${house === 'shugi' ? '衆' : '参'}議院で与党が過半数に届かず、採決を強行しても可決できない` };
    if (b.kyoko && day - b.kyoko < 5) return { ok: false, why: 'すでに採決を急いでいる' };
    if (!kyokoImpl(g, s, b, 'player')) return { ok: false, why: 'いまは採決を急げない' };
    p.me.standing = clamp(num(p.me.standing) + 1, 0, 100);
    return { ok: true, text: `「${b.title}」の採決を急がせた。成立には近づくが、「数の横暴」との批判で支持率が下がるおそれがある。` };
  }
  return { ok: false, why: 'そんな行動はない' };
}
function questionsTick(g, s) {
  for (const q of s.opposition.questions) {
    if (q.answered || today(g) < q.due) continue;
    const a = bureaucratAnswerImpl(g, s, q.topic);
    q.answered = today(g);
    q.answer = { ...a, text: `答弁書（閣議決定）：${a.text}` };
    if (q.topic === 'scandal') ledgerAdd(g, s, 'diet', { scandal: -0.5, text: '質問主意書での追及' });
    if (q.topic === 'religion') s.religion.cult.asked = true;
    if (q.topic === 'amakudari') s.admin.amakudari.heat = clamp(num(s.admin.amakudari.heat) + 4, 0, 100);
    try { g.message({ from: '内閣（答弁書）', kind: 'news', text: `【答弁書】「${q.title}」への答弁書が閣議決定されました。\n${a.text}` }); } catch (e) { /* */ }
  }
  const O = s.opposition;
  if (O.boycott && today(g) > O.boycott.until) {
    const p = pol(g);
    const b = p && p.diet.bills.find((x) => x.id === O.boycott.billId);
    O.boycott = null;
    // an NPC cabinet may push the vote — never one that includes a real party (the real-party rule): there the
    // 国対委員長s talk and the committee resumes (an ordinary, neutral end of a boycott)
    if (b && liveBill(b) && p.cabinet.pm !== 'player' && !realInGovt(p) && Math.random() < 0.4) kyokoImpl(g, s, b, 'npc');
    else if (b && liveBill(b) && realInGovt(p)) { b.log.push({ day: today(g), text: '与野党の国会対策委員長が協議し、審議が再開された' }); govtNews(g, s, `与野党の国会対策委員長が協議し、「${b.title}」の審議が再開された`, { politics: false }); }
    else if (b) b.log.push({ day: today(g), text: '野党が審議に復帰した' });
  }
  if (O.alliance && today(g) > num(O.alliance.until) + 3) O.alliance = null;
}
// Key bills (重要法案): divisive ones get rebels in the ruling party; a key bill voted down in the 参院 may lead to a
// dissolution (NPC PM: politics.js npcDissolve hook; player PM: g.keyBillDissolve).
const DIVISIVE = { postal_privatization: [0.08, 0.3], shohizei_up: [0, 0.08], farm_import: [0.02, 0.12], fta: [0, 0.08] };
function keyBillsTick(g, s) {
  const p = pol(g);
  if (!p) return;
  for (const b of p.diet.bills) {
    if (b.sponsor === 'cabinet' && DIVISIVE[b.policy] && !b.govtMarked && liveBill(b)) {
      b.govtMarked = true;
      const core = cabinetCore(p);
      const [lo, hi] = DIVISIVE[b.policy];
      if (hi > 0) { b.rebel = { [core]: r2(rnd(lo, hi)) }; }
      if (b.policy === 'postal_privatization') { b.key = true; s.keyBills[b.id] = { title: b.title, day: today(g), policy: b.policy }; s.postal.key = b.id; }
    }
    if (!b.key || b.keyHandled) continue;
    const v = b.votes && b.votes.sangi;
    if (b.first === 'shugi' && v && !v.passed) {
      b.keyHandled = today(g);
      const K = s.keyBills[b.id] || (s.keyBills[b.id] = { title: b.title, day: today(g), policy: b.policy });
      K.rejected = today(g);
      K.core = cabinetCore(p);
      K.params = { ...(b.params || {}) };
      govtNews(g, s, `政府の最重要法案「${b.title}」が参議院で否決された（${v.yes}対${v.no}）`, { phone: true, head: '速報' });
      emit(g, 'keyBill', { stage: 'rejected', billId: b.id });
      if (p.cabinet.pm === 'player') {
        K.offer = today(g);
        try { g.message({ from: '総理大臣官邸', kind: 'news', text: `【最重要法案の否決】「${b.title}」が参議院で否決されました。衆議院での再可決には3分の2が必要です。\n衆議院を解散して国民に信を問うこともできます（政府中枢 → 解散）。` }); } catch (e) { /* */ }
      } else if (num(p.cabinet.approval) >= 25 && Math.random() < 0.55 && typeof g.npcDissolve === 'function') {
        const id = g.npcDissolve(`「${b.title}」の参議院での否決を受けて、国民に信を問う`);
        if (id) { K.dissolved = today(g); K.resubmit = true; addEvent(g, s, 'dissolve', '最重要法案の否決を受けた解散'); }
      }
    }
  }
}
function keyBillDissolveImpl(g, s, billId) {
  const p = pol(g);
  if (!p) return { ok: false, why: '政治のしくみが読み込まれていない' };
  const K = s.keyBills[billId];
  if (!isPMg(p)) return { ok: false, why: '衆議院を解散できるのは総理大臣（憲法7条による解散）' };
  if (!K || !K.rejected) return { ok: false, why: '参議院で否決された最重要法案がない' };
  if (today(g) - K.rejected > 30) return { ok: false, why: '否決から時間がたちすぎた' };
  let id = null;
  try { id = g.dissolve(`「${K.title}」が参議院で否決されたため、国民に信を問う`); } catch (e) { console.error(e); }
  if (!id) return { ok: false, why: g.lastPoliticsError || '解散できなかった' };
  K.dissolved = today(g);
  K.resubmit = true;
  return { ok: true, electionId: id, text: `衆議院を解散した。「${K.title}」への賛否を問う総選挙になる。` };
}
// After the election: the same ruling party brings the key bill back to the special session.
function resubmitKeyBills(g, s) {
  const p = pol(g);
  if (!p || !inSessionP(p, today(g))) return;
  for (const [id, K] of Object.entries(s.keyBills)) {
    if (!K.resubmit || K.resubmitted) continue;
    K.resubmitted = today(g);
    if (cabinetCore(p) !== K.core || !POL || !POL.POLICIES[K.policy]) { govtNews(g, s, `「${K.title}」は、選挙のあと再び提出されなかった`); continue; }
    const pl = POL.POLICIES[K.policy];
    const b = addCabinetBill(g, p, { title: K.title, policy: K.policy, params: K.params || {}, ministry: pl.ministry || 'kanbo', key: false, delay: 2 });
    b.govtMarked = true;
    govtNews(g, s, `総選挙の結果を受けて、「${K.title}」が国会に再び提出された`);
    void id;
  }
}

// ================================================================ VOICES
function fillText(t, v) {
  return String(t).replace(/\{title\}/g, v.title || '').replace(/\{item\}/g, v.item || '').replace(/\{concern\}/g, v.concern || '').replace(/「」/g, 'この件');
}
function makeVoices(g, s, ev, n = 4) {
  const T = VOICE_TEXT[ev.kind] || VOICE_TEXT.law;
  const segs = ev.segs || {};
  const ids = SEG_IDS();
  const pros = ids.filter((x) => num(segs[x]) > 0.05).sort((a, b) => segs[b] - segs[a]);
  const cons = ids.filter((x) => num(segs[x]) < -0.05).sort((a, b) => segs[a] - segs[b]);
  const year = gdate(g).year;
  const era = eraKey(g);
  const out = [];
  for (let i = 0; i < n; i++) {
    let stance = i % 2 === 0 ? (T.con ? 'con' : 'neutral') : (T.pro ? 'pro' : 'neutral');
    if (T.neutral && i === n - 1 && n >= 3) stance = 'neutral';
    const pool = stance === 'pro' ? pros : stance === 'con' ? cons : [];
    const seg = pool.length ? pool[Math.min(pool.length - 1, Math.floor(i / 2) + (Math.random() < 0.3 ? 1 : 0))] || pool[0] : pickOne(ids);
    const lines = T[stance] || T.con || T.pro;
    const raw = pickOne(lines);
    const vars = { title: (ev.data && ev.data.title) || ev.label, item: (ev.data && ev.data.item) || '', concern: VOICE_CONCERN[seg] || '' };
    const who = pickOne(VOICE_WHO[seg] || ['会社員（40代）']);
    const m = mediumFor(year);
    const v = {
      id: 'v' + (++s.voices.seq), day: today(g), event: ev.label, kind: ev.kind, seg, segName: (SEGS()[seg] || {}).name || '', who, medium: m, mediumLabel: VOICE_MEDIA[m].label,
      header: VOICE_MEDIA[m].head(who, era), text: fillText(raw, vars), stance, fictional: true,
    };
    out.push(v);
  }
  s.voices.feed.unshift(...out);
  if (s.voices.feed.length > 120) s.voices.feed.length = 120;
  emit(g, 'voices', { event: ev, voices: out });
  return out;
}
// General voices when nothing new happened: about the cabinet and the economy, by segment approval.
function generalVoices(g, s, n = 4) {
  const br = approvalBreakdownImpl(g, s);
  const segs = {};
  for (const r of br.bySegment) segs[r.seg] = (r.approval - br.approval) / 5;
  const p = pol(g);
  const E = p && p.economy;
  const kind = !E ? 'cabinet' : E.inflation > 2.5 ? 'economy_prices' : E.unemployment > 4.5 ? 'economy_jobs' : E.growth < 0 ? 'economy' : 'cabinet';
  return makeVoices(g, s, { kind, label: kind === 'cabinet' ? 'いまの内閣' : '景気と暮らし', segs }, n);
}

// ================================================================ DEMOS
const DEMO_SIZE = { small: [500, 3000], medium: [5000, 20000], large: [30000, 80000] };
const ORGANISERS = (year) => ['市民団体（架空）', '労働組合の連合体（架空）', '学生のグループ（架空）', '子育て世代の会（架空）', ...(year >= 2010 ? ['SNSで呼びかけた有志'] : ['地域の住民の会（架空）'])];
const qd = (c) => (/^「/.test(String(c)) ? String(c) : `「${c}」`);
function demoLabel(def, against) {
  const C = DEMO_CAUSES[against] || DEMO_CAUSES.other;
  let cause = def.cause ? String(def.cause) : '';
  if (/^[a-z0-9_]+$/i.test(cause)) cause = REG && REG.REGIME_STEPS && REG.REGIME_STEPS[cause] ? `「${REG.REGIME_STEPS[cause].name}」に抗議するデモ` : '';
  if (cause && !/デモ|集会|行進/.test(cause)) cause = /反対|抗議|要求|求め|守れ|なくそう|やめ|撤回|守ろう|救済|支援/.test(cause) ? `「${cause}」を訴える${against === 'rally' ? '集会' : 'デモ'}` : `「${cause}」${against === 'rally' ? 'を支持する集会' : 'に反対するデモ'}`;
  return cause || C.label.replace('{title}', def.title || '政府の方針').replace('{cause}', '抗議のデモ');
}
function spawnDemoImpl(g, s, def = {}) {
  const day = today(g);
  const d0 = gdate(g);
  const against = DEMO_CAUSES[def.against] ? def.against : def.against ? 'other' : 'government';
  const seg = SEGS()[def.segment] ? def.segment : (DEMO_CAUSES[against] || DEMO_CAUSES.other).seg;
  const range = DEMO_SIZE[def.size];
  const size = Math.max(50, Math.round(range ? rnd(range[0], range[1]) : num(def.size, rnd(800, 6000))));
  const start = Math.max(day, num(def.start, day));
  let regimeId = 'democracy';
  try { if (typeof g.regime === 'function') regimeId = (g.regime() || {}).id || 'democracy'; } catch (e) { /* */ }
  const d = {
    id: 'd' + (++s.demos.seq), day, start, until: start + irnd(3, 8), cause: demoLabel(def, against), against, policy: def.policy || null, step: /^[a-z0-9_]+$/i.test(String(def.cause || '')) ? def.cause : null,
    segment: seg, size, peak: size, stance: against === 'rally' ? 'rally' : 'protest', place: DEMO_PLACES.includes(def.place) ? def.place : pickOne(DEMO_PLACES),
    organiser: def.organiser || pickOne(ORGANISERS(d0.year)), permit: def.permit !== false, joined: null, responses: [], status: start > day ? 'planned' : 'active',
    momentum: num(def.momentum, rnd(0.9, 1.15)), log: [{ day, text: start > day ? '開催の許可を申請' : 'はじまった' }], by: def.by || 'auto', regime: regimeId, fictional: true,
  };
  s.demos.list.unshift(d);
  if (s.demos.list.length > 30) s.demos.list.length = 30;
  if (d.status === 'active') demoStarted(g, s, d);
  emit(g, 'demo', { stage: d.status === 'active' ? 'start' : 'planned', demo: d });
  return d;
}
function demoStarted(g, s, d) {
  govtNews(g, s, `${d.place}で${qd(d.cause)}（主催：${d.organiser}、約${d.size.toLocaleString('ja-JP')}人）`, { politics: d.size >= 3000 });
  const segs = { [d.segment]: d.stance === 'rally' ? -0.5 : 1.5, floating: d.stance === 'rally' ? -0.3 : 0.3, business: -0.4 };
  addEvent(g, s, d.stance === 'rally' ? 'rally' : 'demo', d.cause, { segs, data: { title: d.cause } });
}
function demoPopularity(g, s, d) {
  const p = pol(g);
  const appr = p ? num(p.cabinet.approval, 45) : 45;
  if (d.stance === 'rally') return (appr - 50) / 50;
  if (d.against === 'government' || d.against === 'scandal') return (50 - appr) / 45;
  if (d.against === 'war' || d.against === 'speech') return 0.4;
  return 0.1 + (50 - appr) / 120;
}
function demoTick(g, s) {
  const day = today(g);
  const p = pol(g);
  let moodSum = 0;
  for (const d of s.demos.list) {
    if (d.status === 'planned' && day >= d.start) { d.status = 'active'; d.log.push({ day, text: 'はじまった' }); demoStarted(g, s, d); }
    if (d.status !== 'active') continue;
    const pop = demoPopularity(g, s, d);
    const grow = (1 + clamp(pop, -0.6, 0.8) * 0.25 * num(d.momentum, 1)) * (day - d.start > 2 ? 0.85 : 1.05);
    d.size = Math.max(0, Math.round(d.size * grow * rnd(0.92, 1.08)));
    d.peak = Math.max(d.peak, d.size);
    d.momentum = num(d.momentum, 1) * 0.97;
    const m = d.stance === 'rally' ? Math.min(0.6, d.size / 60000) : -Math.min(1.5, d.size / 40000);
    moodSum += m;
    if (day >= d.until || d.size < 80) {
      d.status = 'ended';
      d.ended = day;
      d.log.push({ day, text: `終わった（最大 約${d.peak.toLocaleString('ja-JP')}人）` });
      if (d.peak >= 5000) govtNews(g, s, `${qd(d.cause)}は${d.place}などで続き、最大で約${d.peak.toLocaleString('ja-JP')}人が参加した（主催者発表をもとにした推計）`, { politics: d.peak >= 20000 });
      emit(g, 'demo', { stage: 'end', demo: d });
    }
  }
  if (moodSum && p) ledgerAdd(g, s, 'demo', { mood: clamp(moodSum, -3, 1), text: 'デモ・集会' });
  s.demos.list = s.demos.list.filter((d) => d.status !== 'ended' || day - num(d.ended) < 60);
}
// Demos that arise by themselves: unpopular laws, a tax rise, scandals, a cabinet far below 25%, a popular one.
function demoAuto(g, s, trigger) {
  const day = today(g);
  if (day - num(s.demos.lastAuto) < 8) return null;
  if (s.demos.list.filter((d) => d.status !== 'ended').length >= 3) return null;
  let def = null;
  if (trigger && trigger.kind === 'law') {
    const segs = trigger.segs || {};
    const worst = Object.entries(segs).sort((a, b) => a[1] - b[1])[0];
    if (worst && worst[1] <= -4 && Math.random() < 0.55) def = { against: 'policy', title: trigger.title, policy: trigger.policy, segment: worst[0], size: irnd(1500, 12000) };
  } else if (trigger && trigger.kind === 'tax' && Math.random() < 0.5) def = { against: 'tax', segment: 'families', size: irnd(2000, 15000) };
  else if (trigger && trigger.kind === 'scandal' && Math.random() < 0.35) def = { against: 'scandal', segment: 'floating', size: irnd(800, 5000) };
  else if (!trigger) {
    const p = pol(g);
    const a = p ? num(p.cabinet.approval, 45) : 45;
    if (a < 22 && Math.random() < 0.08) def = { against: 'government', segment: 'floating', size: irnd(3000, 20000) };
    else if (a > 62 && Math.random() < 0.02) def = { against: 'rally', segment: 'elderly', size: irnd(1000, 6000), organiser: '支持者の会（架空）' };
  }
  if (!def) return null;
  s.demos.lastAuto = day;
  return spawnDemoImpl(g, s, def);
}
function regimeId(g) { try { return typeof g.regime === 'function' ? ((g.regime() || {}).id || 'democracy') : 'democracy'; } catch (e) { return 'democracy'; } }
function joinDemoImpl(g, s, id, opts = {}) {
  const d = s.demos.list.find((x) => x.id === id);
  const st = g.state;
  const day = today(g);
  if (!d || d.status === 'ended') return { ok: false, why: 'そのデモはもう終わっている' };
  try { if (typeof g.isFree === 'function' && !g.isFree()) return { ok: false, why: '身柄を拘束されていて参加できない' }; } catch (e) { /* */ }
  if (regimeId(g) === 'dictatorship' && d.stance !== 'rally') return { ok: false, why: 'いまは集会やデモが禁じられている。法律に反する参加は、ここではできない' };
  if (d.joined && d.joined.day === day) return { ok: false, why: '今日はもう参加した' };
  if (num(st.stamina) < 15) return { ok: false, why: '体力が足りない' };
  st.stamina -= 15;
  const role = opts.role === 'speaker' ? 'speaker' : 'participant';
  const fame = num(st.fame);
  const p = pol(g);
  const out = [];
  d.joined = { day, role, count: num(d.joined && d.joined.count) + 1 };
  const draw = Math.round(Math.log10(1 + fame) * (role === 'speaker' ? 600 : 200));
  d.size += draw;
  d.peak = Math.max(d.peak, d.size);
  if (role === 'speaker' && fame >= 300) {
    try { if (typeof g.addFame === 'function') g.addFame(Math.round(40 + Math.log10(1 + fame) * 20), true); } catch (e) { /* */ }
    const lost = Math.round(num(st.fans) * rnd(0.005, 0.02));
    const gain = Math.round(num(st.fans) * rnd(0.003, 0.02));
    try { if (typeof g.addFans === 'function') g.addFans(gain - lost, true); } catch (e) { /* */ }
    out.push(`スピーチが報じられた（知名度アップ。ファン ${gain >= lost ? '+' : ''}${gain - lost}人）`);
    if (fame >= 2000) { st.flags = st.flags || {}; st.flags.govtSponsorWorry = day; out.push('スポンサーや事務所からは「政治的な発言には気をつけて」と言われた'); }
    addEvent(g, s, 'demo_celeb', `${st.name}さんが${qd(d.cause)}でスピーチ`, { n: 4 });
  }
  if (p && p.me && p.me.party && p.me.office) {
    const ruling = isRulingParty(p, p.me.party);
    if (d.stance === 'protest' && ruling) { p.me.standing = clamp(num(p.me.standing) - 6, 0, 100); out.push('与党の議員が政府への抗議に加わったことで、党内の評価が下がった'); }
    else if (d.stance === 'protest') { p.me.standing = clamp(num(p.me.standing) + 2, 0, 100); p.me.localSupport = clamp(num(p.me.localSupport) + 0.5, 0, 100); }
    else if (ruling) p.me.standing = clamp(num(p.me.standing) + 1, 0, 100);
  }
  try { if (typeof g.addNeed === 'function') g.addNeed('stress', -3); } catch (e) { /* */ }
  emit(g, 'demo', { stage: 'joined', demo: d, role });
  return { ok: true, role, size: d.size, text: `${d.place}の${qd(d.cause)}に${role === 'speaker' ? 'スピーチで' : '一人の参加者として'}加わった（憲法21条：集会・表現の自由）。${out.join('。')}` };
}
function organizeDemoImpl(g, s, def = {}) {
  const st = g.state;
  const day = today(g);
  try { if (typeof g.isFree === 'function' && !g.isFree()) return { ok: false, why: '身柄を拘束されていて主催できない' }; } catch (e) { /* */ }
  if (regimeId(g) === 'dictatorship') return { ok: false, why: 'いまは集会やデモが禁じられている（体制）。法律に反する主催は、ここではできない' };
  if (s.demos.list.some((d) => d.by === 'player' && d.status !== 'ended')) return { ok: false, why: 'すでに主催しているデモがある' };
  const cost = 30000;
  if (num(st.money) < cost) return { ok: false, why: `準備のお金（音響・プラカード）が足りない（${fmtMoney(cost)}）` };
  st.money -= cost;
  const against = DEMO_CAUSES[def.against] ? def.against : 'other';
  const fame = num(st.fame);
  const size = Math.round(200 + Math.log10(1 + fame) * 900 + rnd(0, 800));
  const d = spawnDemoImpl(g, s, { ...def, against, size, start: day + 1, by: 'player', organiser: `${st.name}さんの呼びかけ`, permit: true });
  d.log.push({ day, text: '公安委員会に集団示威運動の許可を申請し、許可を得た（道路を使う日時・経路の条件つき）' });
  if (fame >= 2000) { st.flags = st.flags || {}; st.flags.govtSponsorWorry = day; }
  return { ok: true, demo: d, text: `${qd(d.cause)}を呼びかけた。開催は${dLabel(g, d.start)}、場所は${d.place}。東京都の公安条例にもとづき公安委員会に許可を申請した（多くの県の条例では72時間前までの申請）。暴力や施設の占拠はしない、平和的な集会にする。` };
}
function respondBlock(g, s, d, how) {
  const R = DEMO_RESPONSES[how];
  const p = pol(g);
  if (!d || d.status === 'ended') return 'そのデモはもう終わっている';
  if (!R) return 'そんな対応はない';
  if (!p || !(isPMg(p) || postOf(p, 'kanbo') || postOf(p, 'minister_npsc'))) return '政府として対応を決めるのは、総理・官房長官・国家公安委員長';
  if (d.responses.some((x) => x.how === how && today(g) - x.day < 2)) return 'その対応はもうとった';
  let av = true;
  try { av = R.available ? R.available(g, d) : true; } catch (e) { av = false; }
  if (av !== true) return typeof av === 'string' ? av : 'いまはその対応はとれない';
  return null;
}
function respondDemoImpl(g, s, id, how) {
  const d = s.demos.list.find((x) => x.id === id);
  const why = respondBlock(g, s, d, how);
  if (why) return { ok: false, why };
  let r = null;
  try { r = DEMO_RESPONSES[how].apply(g, d) || {}; } catch (e) { console.error(e); return { ok: false, why: 'うまく対応できなかった' }; }
  d.responses.push({ day: today(g), how, by: 'player' });
  d.log.push({ day: today(g), text: `政府の対応：${DEMO_RESPONSES[how].label}` });
  emit(g, 'demo', { stage: 'response', demo: d, how });
  return { ok: true, how, text: r.text || DEMO_RESPONSES[how].label };
}
const isDemocracy = (g) => ['democracy', 'emergency'].includes(regimeId(g));
Object.assign(DEMO_RESPONSES, {
  dialogue: {
    label: '対話（代表者と面会し、要望を聞く）', desc: '総理や官房長官が主催者の代表と会い、要望書を受け取る。',
    available: (g, d) => (d.stance === 'rally' ? '政府を応援する集会への対応は必要ない' : true),
    apply(g, d) {
      const s = GS(g);
      const p = pol(g);
      d.momentum = num(d.momentum, 1) * 0.8;
      shiftSupport(p, { [d.segment]: 1, floating: 0.5 }, 0.004);
      ledgerAdd(g, s, 'demo', { mood: demoPopularity(g, s, d) > 0 ? 1 : 0.3, text: 'デモの代表と面会' });
      govtNews(g, s, `政府が${qd(d.cause)}の代表者と面会し、要望書を受け取った`);
      return { text: '主催者の代表と面会し、要望を直接聞いた。すぐに答えは出せないが、「話を聞く政府」と受けとめる声もある。' };
    },
  },
  tolerate: {
    label: '容認（表現の自由として見守る）', desc: '平和的な集会は表現の自由として尊重し、警備は通常どおり。',
    available: () => true,
    apply(g, d) {
      const s = GS(g);
      ledgerAdd(g, s, 'demo', { mood: 0.2, text: 'デモを見守る' });
      return { text: '「平和的な集会は、憲法が保障する表現の自由」として見守ることにした。' };
    },
  },
  regulate: {
    label: '規制（警備の強化と交通規制を要請）', desc: '公安条例の許可条件の範囲で、警察に警備と交通の規制を要請する（警察は都道府県公安委員会の管理の下にある）。',
    available: (g, d) => (d.stance === 'rally' ? '必要ない' : true),
    apply(g, d) {
      const s = GS(g);
      d.momentum = num(d.momentum, 1) * 0.85;
      d.size = Math.round(d.size * 0.9);
      ledgerAdd(g, s, 'demo', { mood: demoPopularity(g, s, d) > 0.2 ? -0.6 : 0, text: 'デモの規制' });
      addEvent(g, s, 'demo', `${qd(d.cause)}への規制の強化`, { segs: { elderly: 0.5, business: 0.4, young: -0.6, urban: -0.4 }, n: 2 });
      return { text: '警察に、許可の条件の範囲で警備と交通規制を強めるよう要請した。「過剰な警備だ」との声も一部にある。' };
    },
  },
  remove: {
    label: '強制排除（座り込みの排除を求める）', desc: '道路の占拠などに対して、警察が排除するよう求める。民主国家では強い反発を招く。',
    // the real-party rule: a government that includes 自民・民主 (any role) never orders it (dialogue / tolerate /
    // regulate, the lawful traffic control, stay open)
    available: (g, d) => (d.stance === 'rally' ? '必要ない' : realPartyNo(g, pol(g), 'デモの強制排除') || true),
    apply(g, d) {
      const s = GS(g);
      d.momentum = num(d.momentum, 1) * 1.25;
      d.until += 2;
      ledgerAdd(g, s, 'demo', { mood: -rnd(4, 7), text: 'デモの強制排除への批判' });
      govtNews(g, s, `${qd(d.cause)}の参加者の一部を警察が排除した。強引な対応だとして、政府への批判が広がっている`, { phone: true, head: 'デモ' });
      addEvent(g, s, 'demo', `${qd(d.cause)}の強制排除`, { segs: { young: -2, urban: -1.5, floating: -1.5, elderly: 0.4, business: 0.3 } });
      return { text: '座り込みの排除を求めた。現場は一時混乱し、「表現の自由への介入だ」という強い批判が起き、参加者はかえって増えている。' };
    },
  },
});

// ================================================================ APPROVAL (支持率の内訳と推移)
const REASON_LABEL = {
  base: '基礎（内閣への一般的な評価）', honeymoon: '発足直後の期待（ご祝儀）', economy: '経済（景気・物価・雇用）', deficit: '財政（赤字への批判）', policy: '政策（成立した法律・内閣の評価）',
  scandal: '不祥事・政治とカネ', fatigue: '政権の長さ（飽き）', pm: '総理の人気', nejire: 'ねじれ国会', tax: '税', budget: '予算', demo: 'デモ・集会', diet: '国会運営（強行採決・審議拒否など）',
  religion: '宗教団体の問題への対応', admin: '行政（政令・人事・天下り）', disaster: '災害への対応', regime: '体制・安全保障など（ほかのコア）', other: 'その他（調査の誤差を含む）',
};
function approvalBreakdownImpl(g, s) {
  const p = pol(g);
  const out = { approval: 0, disapproval: 0, reasons: [], bySegment: [], weekly: [], support: [], none: 0, note: 'シミュレーションの推計（実在の世論調査ではない）' };
  if (!p || !p.cabinet) return out;
  const C = p.cabinet;
  const A = num(C.approval, 45);
  out.approval = Math.round(A);
  out.disapproval = Math.round(clamp(100 - A - 12 + rnd(-1, 1), 0, 100));
  const parts = C.parts || (p.polls[p.polls.length - 1] || {}).parts || null;
  const L = { tax: 0, budget: 0, demo: 0, diet: 0, religion: 0, admin: 0, disaster: 0, regime: 0 };
  let ledgerMood = 0, ledgerScandal = 0;
  for (const e of s.approval.ledger) { const k = L[e.reason] != null ? e.reason : 'admin'; L[k] += num(e.mood) + num(e.scandal); ledgerMood += num(e.mood); ledgerScandal += num(e.scandal); }
  const rs = [];
  if (parts) {
    rs.push(['base', parts.base], ['honeymoon', parts.honeymoon], ['economy', parts.economy], ['deficit', parts.deficit], ['policy', num(parts.policy) - ledgerMood], ['scandal', num(parts.scandal) - ledgerScandal], ['fatigue', parts.fatigue], ['pm', parts.pm], ['nejire', parts.nejire]);
    for (const [k, v] of Object.entries(L)) if (Math.abs(v) >= 0.05) rs.push([k, v]);
    const model = num(parts.target);
    rs.push(['other', r1(A - model)]);
  } else rs.push(['base', A]);
  out.reasons = rs.map(([id, v]) => ({ id, label: REASON_LABEL[id] || id, value: r1(v) })).filter((r) => r.id === 'base' || Math.abs(r.value) >= 0.1);
  // by segment: the ruling parties' standing in the segment, recent laws, this module's actions
  const fy = gdate(g).year;
  const W = segWeightsOf(fy);
  const ruling = C.partyIds || [];
  const share = (sg) => ruling.reduce((a, id) => a + num(p.opinion[sg] && p.opinion[sg][id]), 0);
  const nat = SEG_IDS().reduce((a, sg) => a + (W ? num(W[sg]) : 1 / 11) * share(sg), 0);
  const raw = {};
  const day = today(g);
  for (const sg of SEG_IDS()) {
    let v = A + clamp((share(sg) - nat) * 45, -20, 20);
    for (const Lw of p.laws || []) { const age = day - num(Lw.day); if (age < 0 || age > 120 || Lw.sponsor !== 'cabinet') continue; v += num(Lw.segments && Lw.segments[sg]) * 0.8 * (1 - age / 120); }
    v += num(s.approval.segLedger[sg]) * 0.8;
    raw[sg] = v;
  }
  const mean = SEG_IDS().reduce((a, sg) => a + (W ? num(W[sg]) : 1 / 11) * raw[sg], 0);
  for (const sg of SEG_IDS()) out.bySegment.push({ seg: sg, name: (SEGS()[sg] || {}).name || sg, weight: W ? r2(W[sg]) : null, approval: Math.round(clamp(raw[sg] - mean + A, Math.max(1, A - 30), Math.min(99, A + 30))) });
  // weekly history (this module keeps a longer one than the politics core's 60 polls)
  out.weekly = s.approval.weekly.slice(-104).map((w) => ({ ...w }));
  if (!out.weekly.length) out.weekly = (p.polls || []).map((x) => ({ day: x.day, label: dLabel(g, x.day), approval: x.approval, none: x.none, support: x.support }));
  out.support = Object.keys(p.parties).map((id) => ({ id, name: partyNameOf(g, id), pct: (() => { try { return g.partySupport(id); } catch (e) { return 0; } })() })).sort((a, b) => b.pct - a.pct);
  const last = (p.polls || [])[p.polls.length - 1];
  out.none = last ? last.none : 0;
  return out;
}
function recordWeekly(g, s, poll) {
  const br = approvalBreakdownImpl(g, s);
  const row = { day: poll.day, label: dLabel(g, poll.day), approval: poll.approval, none: poll.none, support: { ...(poll.support || {}) }, bySeg: Object.fromEntries(br.bySegment.map((r) => [r.seg, r.approval])), reasons: Object.fromEntries(br.reasons.map((r) => [r.id, r.value])) };
  s.approval.weekly.push(row);
  if (s.approval.weekly.length > 260) s.approval.weekly.splice(0, s.approval.weekly.length - 260);
  s.approval.lastPoll = poll.day;
  ledgerDecay(s);
  emit(g, 'approval', row);
}

// ================================================================ SEATS (議席の詳細)
function kaihaName(id, house, year, g) {
  if (id === 'jimin' && house === 'shugi' && year >= 2016) return '自由民主党・無所属の会';
  if (id === 'minshu' && house === 'shugi' && year >= 2000.5) return '民主党・無所属クラブ';
  if (id === 'ind') return '無所属（会派に属さない議員）';
  return partyNameOf(g, id, false);
}
function seatDetailsImpl(g, s) {
  const p = pol(g);
  if (!p) return null;
  const fy = gdate(g).fy;
  const ruling = p.cabinet.partyIds || [];
  const house = (h) => {
    const H = p.diet[h];
    const total = num(H.total);
    const rows = Object.entries(H.seats || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({
      id, name: id === 'ind' ? '無所属' : partyNameOf(g, id, false), short: id === 'ind' ? '無所属' : partyNameOf(g, id, true), seats: n, share: total ? r1((n / total) * 100) : 0,
      ruling: ruling.includes(id), kaiha: kaihaName(id, h, fy, g), color: (p.parties[id] && p.parties[id].color) || '#9aa3b0', real: realParty(id), player: p.me.party === id,
    }));
    const rulingSeats = rows.filter((r) => r.ruling).reduce((a, r) => a + r.seats, 0);
    const out = { total, majority: Math.floor(total / 2) + 1, twoThirds: Math.ceil((total * 2) / 3), ruling: rulingSeats, opposition: total - rulingSeats, rulingMajority: rulingSeats >= Math.floor(total / 2) + 1, rulingTwoThirds: rulingSeats >= Math.ceil((total * 2) / 3), parties: rows };
    if (h === 'shugi') Object.assign(out, { system: H.system || null, dissolved: !!H.dissolved, lastElection: H.last != null ? H.last : null });
    if (h === 'sangi' && Array.isArray(H.classes)) out.classes = H.classes.map((c) => ({ year: c.year, seats: { ...c.seats } }));
    return out;
  };
  const shugi = house('shugi'), sangi = house('sangi');
  return {
    // ねじれ from the same rows (the ruling parties hold the 衆院 but not the 参院), never a stale flag
    shugi, sangi, coalition: ruling.map((id) => ({ id, name: partyNameOf(g, id, false) })), nejire: !!(shugi.rulingMajority && !sangi.rulingMajority),
    note: '会派名は、確認できた実在の会派名（自民・民主）のほかは党名で示す。数はシミュレーション',
  };
}

// ================================================================ 政権交代・総辞職 (record; scenes in js/world/seiken.js)
function govSnapshot(g, p) {
  const C = p.cabinet;
  const fy = gdate(g).fy;
  const ministers = Object.entries(C.ministers || {}).filter(([, who]) => who).slice(0, 24).map(([post, who]) => ({ post, title: (() => { try { return POL.postName(post, fy); } catch (e) { return post; } })(), who, name: who === 'player' ? g.state.name : npcNameOf(g, who) }));
  return { pm: C.pm, pmName: C.pm === 'player' ? g.state.name : npcNameOf(g, C.pm), partyIds: [...(C.partyIds || [])], core: cabinetCore(p), pmNo: num(p.flags && p.flags.pmNo), day: today(g), ministers };
}
function seikenRecord(g, s, rec) {
  rec.id = 'sk' + s.nextId++;
  rec.day = today(g);
  rec.date = dLabel(g, rec.day);
  s.seiken.log.unshift(rec);
  if (s.seiken.log.length > 30) s.seiken.log.length = 30;
  const mode = s.settings.scenes || 'auto';
  const p = pol(g);
  const mine = rec.playerRole && rec.playerRole !== 'none';
  if (mode === 'all' || (mode === 'auto' && (rec.kind === 'kotai' || rec.kind === 'resign' || rec.kind === 'shuhan' || mine))) s.seiken.queue.push(rec.id);
  if (s.seiken.queue.length > 4) s.seiken.queue.splice(0, s.seiken.queue.length - 4);
  emit(g, 'seiken', rec);
  void p;
  return rec;
}
function onCabinet(g, s, data) {
  const p = pol(g);
  if (!p || !data || 'reshuffle' in data || data.joined || data.coalition) return;
  const prev = s.seiken.last;
  const now = govSnapshot(g, p);
  s.seiken.last = now;
  if (!prev) return;
  const changedParty = prev.core !== now.core;
  const kind = changedParty ? 'kotai' : prev.pm !== now.pm ? 'shuhan' : 'saishimei';
  const playerRole = now.pm === 'player' ? 'pm' : now.ministers.some((m) => m.who === 'player') ? 'minister' : prev.pm === 'player' ? 'former' : 'none';
  const rec = seikenRecord(g, s, { kind, from: prev, to: now, playerRole, reason: s.seiken.pendingReason || '' });
  s.seiken.pendingReason = '';
  const label = kind === 'kotai' ? `政権交代：${partyNameOf(g, prev.core)}中心の政権から${partyNameOf(g, now.core)}中心の政権へ` : kind === 'shuhan' ? `新しい内閣の発足（第${now.pmNo}代 ${now.pmName}総理）` : `${now.pmName}総理を再び指名`;
  if (kind !== 'saishimei') govtNews(g, s, label, { politics: kind === 'kotai' });
  if (kind === 'kotai') addEvent(g, s, 'kotai', label, { segs: { floating: 1, young: 0.5, elderly: -0.3 } });
  else if (kind === 'shuhan') addEvent(g, s, 'cabinet', label, { segs: { floating: 0.3 } });
  return rec;
}
function onResign(g, s, data) {
  const p = pol(g);
  if (!p || !data || data.who !== 'cabinet') return;
  const prev = s.seiken.last || govSnapshot(g, p);
  s.seiken.pendingReason = data.reason || '';
  seikenRecord(g, s, { kind: 'resign', from: prev, to: null, playerRole: data.pm === 'player' ? 'pm' : prev.ministers.some((m) => m.who === 'player') ? 'minister' : 'none', reason: data.reason || '' });
  addEvent(g, s, 'resign', `${prev.pmName}内閣の総辞職`, { segs: { floating: 0.2 } });
}

// ================================================================ other cores: politics hooks, regime watcher
const safe = (g, fn) => { try { if (g && g.state) { const s = GS(g); if (s) fn(s); } } catch (e) { console.error(e); } };
function hookPolitics() {
  if (polHooked || !POL || typeof POL.onPolitics !== 'function') return;
  polHooked = true;
  try { registerPolicies(); } catch (e) { console.error('[govt] policies', e); }
  const on = POL.onPolitics;
  on('enacted', (g, d) => safe(g, (s) => onEnacted(g, s, d)));
  on('bill', (g, d) => safe(g, (s) => onBill(g, s, d)));
  on('cabinet', (g, d) => safe(g, (s) => onCabinet(g, s, d)));
  on('resign', (g, d) => safe(g, (s) => onResign(g, s, d)));
  on('scandal', (g, d) => safe(g, (s) => onScandal(g, s, d)));
  on('dissolve', (g, d) => safe(g, (s) => addEvent(g, s, 'dissolve', '衆議院の解散', { n: 2 })));
  on('election', (g, d) => safe(g, (s) => onElection(g, s, d)));
  on('poll', (g, poll) => safe(g, (s) => recordWeekly(g, s, poll)));
}
// regime.js names (REGIME_STEPS) for demo labels: imported only when the registry lists it (no 404 otherwise)
import('../registry.js').then((reg) => {
  const list = (reg && reg.MODULES) || [];
  if (list.includes('./engine/regime.js')) import('./regime.js').then((m) => { REG = m; }).catch(() => { REG = null; });
}).catch(() => {});
// politics.js tax laws move this module's rates (their revenue is already in the politics core's budget: adj)
const POL_TAX_LAWS = {
  corp_tax_cut: (prm) => ({ hojin: -num(prm.pts, 5) }), corp_tax_up: (prm) => ({ hojin: num(prm.pts, 3) }),
  inheritance_tax: () => ({ sozoku: 5 }), gasoline_tax: (prm, s) => ({ kihatsu: Math.min(0, 28.7 - num(s.taxes.kihatsu && s.taxes.kihatsu.rate, 28.7)) }),
};
function onEnacted(g, s, d) {
  const b = d && d.bill;
  if (!b) return;
  const p = pol(g);
  if (!d.law) {
    if (b.kind === 'budget' && !b.policy) { const B = p && p.economy.budget; if (B && B.govt) recordBudgetHistory(g, s, B); addEvent(g, s, 'budget', `${b.title}の成立`, { segs: { elderly: 0.4, families: 0.2, young: -0.3, floating: -0.2 }, data: { item: BUDGET_ITEMS.shakaihosho.name }, n: 2 }); }
    return;
  }
  const L = d.law;
  const yr = gdate(g);
  if (POL_TAX_LAWS[L.policy]) {
    const ch = POL_TAX_LAWS[L.policy](L.params || {}, s);
    for (const [id, dv] of Object.entries(ch)) {
      const t = s.taxes[id];
      if (!t || !dv) continue;
      t.rate = Math.max(0, r2(t.rate + dv));
      t.adj = r2(t.adj + dv);
      t.history.push({ day: today(g), year: yr.year, month: yr.month, rate: t.rate, why: L.title });
      s.taxHistory.unshift({ day: today(g), id, from: r2(t.rate - dv), to: t.rate, why: L.title, year: yr.year, month: yr.month });
    }
  }
  if (/^shohizei_/.test(L.policy) && p) {
    s.taxPlan = s.taxPlan.filter((x) => !(x.id === 'shohi' && !x.done));
    const before = num(s.lastShohi, 0);
    const after = num(p.economy.taxRate);
    // a rise takes effect on the date the law sets, not on the day it passes: 導入 next April (1988-12 → 1989-04), a rise
    // about 1.5-2 years later (2012-08 → 2014-04; 目安). The politics core's taxPlan carries a rise; our plan the 導入.
    if (after > before && /^shohizei_(intro|up)$/.test(L.policy)) {
      const intro = before <= 0;
      const y = intro ? (yr.month >= 4 ? yr.year + 1 : yr.year) : (yr.month >= 7 ? yr.year + 2 : yr.year + 1);
      if (intro) s.shohiLaw = { year: yr.year, month: yr.month, inForce: { year: y, month: 4 } }; // the game's own 消費税法
      p.economy.taxRate = before;
      if (!intro && !(p.flags.taxPlan && !p.flags.taxPlan.done)) p.flags.taxPlan = { rate: after, year: y, month: 4, law: yr.year };
      else s.taxPlan.push({ id: 'shohi', rate: after, year: y, month: 4, law: yr.year, by: 'law', why: L.title });
      govtNews(g, s, `${L.title.replace(/に関する法律案$/, '')}：新しい税率${after}%は${y}年4月から（法律で定める日）`, { phone: `【消費税】新しい税率（${after}%）が適用されるのは${y}年4月からです（法律で定めた日）。それまでは${before ? `${before}%` : '消費税はかかりません'}。`, from: 'ドット新聞 経済部' });
      s.taxHistory.unshift({ day: today(g), id: 'shohi', from: before, to: after, why: `${L.title}（成立。${y}年4月から）`, year: yr.year, month: yr.month, law: true });
    } else {
      s.taxHistory.unshift({ day: today(g), id: 'shohi', from: before, to: after, why: L.title, year: yr.year, month: yr.month });
      s.lastShohi = after;
    }
  }
  if (L.policy === 'postal_privatization' && !s.postal.law) {
    s.postal.law = { day: today(g), year: yr.year, month: yr.month };
    s.postal.privatized = { year: yr.year + 2, month: yr.month };
    s.postal.log.push({ year: yr.year, month: yr.month, text: `郵政民営化法が成立（ゲームの中の出来事）。${yr.year + 2}年${yr.month}月に民営化` });
    addEvent(g, s, 'postal', '郵政民営化法の成立', { segs: L.segments });
    emit(g, 'postal', { stage: 'law' });
  }
  if (L.policy === 'stimulus') {
    const rec = s.budget.supplementary.find((x) => x.billId === b.id);
    if (rec) rec.status = 'passed'; else s.budget.supplementary.push({ day: today(g), fy: yr.year, billId: b.id, amount: num(L.params && L.params.amount), purpose: '経済対策', title: b.title, by: 'npc', status: 'passed' });
    const H = s.budget.history.find((h) => h.fy === yr.year);
    if (H) H.supplementary = r1(num(H.supplementary) + num(L.params && L.params.amount));
    emit(g, 'supplementary', { stage: 'passed', billId: b.id });
  }
  if (L.policy === 'zeisei_kaisei') return; // its own news (taxLawEnacted)
  if (L.policy === 'shukyo_hojin_kaisei' || L.policy === 'kifu_kanyu') addEvent(g, s, 'religion_state', L.title, { segs: L.segments });
  else if (L.policy === 'amakudari_ban') addEvent(g, s, 'amakudari', L.title, { segs: L.segments });
  else if (/^shohizei_/.test(L.policy)) addEvent(g, s, L.policy === 'shohizei_down' ? 'tax_down' : 'tax_up', L.title, { segs: L.segments });
  else addEvent(g, s, 'law', L.title, { segs: L.segments, data: { title: L.title } });
  demoAuto(g, s, /^shohizei_(up|intro)/.test(L.policy) ? { kind: 'tax' } : { kind: 'law', segs: L.segments, title: L.title, policy: L.policy });
}
function onBill(g, s, d) {
  const b = d && d.bill;
  if (!b || d.step !== 'rejected') return;
  if (b.policy === 'stimulus') { const rec = s.budget.supplementary.find((x) => x.billId === b.id); if (rec) rec.status = 'rejected'; }
}
function onScandal(g, s, rec) {
  if (!rec || rec.kind === 'stepdown') return;
  const label = `${rec.name || '不祥事'}${rec.who === 'player' ? `（${g.state.name}議員）` : ''}`;
  addEvent(g, s, 'scandal', label, { segs: { floating: -1.5, young: -0.8, families: -0.5 } });
  if (num(rec.severity) >= 3) demoAuto(g, s, { kind: 'scandal' });
}
function onElection(g, s, d) {
  const res = d && d.result;
  if (!res || !['shugi', 'sangi'].includes(res.kind)) return;
  addEvent(g, s, 'election', `${res.label || '国政選挙'}の結果`, { segs: { floating: 0.3 }, n: 2 });
}
// regime.js (A2) is read through g.* only: a change of 体制, a disaster, a war, a fall of press freedom → voices.
function watchOthers(g, s) {
  const W = s.watch;
  const rid = regimeId(g);
  if (W.regime && W.regime !== rid && (rid === 'emergency' || rid === 'dictatorship')) addEvent(g, s, rid, rid === 'emergency' ? '緊急事態' : '（もしも）独裁体制', { segs: { young: -2, urban: -1.5, elderly: 0.5 } });
  W.regime = rid;
  let dis = null;
  try { dis = typeof g.disaster === 'function' ? g.disaster() : null; } catch (e) { dis = null; }
  const key = dis ? String(dis.id || dis.key || dis.name || dis.kind || 'd') : null;
  if (key && key !== W.disaster) addEvent(g, s, 'disaster', dis.name || dis.label || '災害への対応', { segs: { rural: 1, elderly: 0.5, families: -0.5 } });
  W.disaster = key;
  let war = null;
  try { war = typeof g.war === 'function' ? g.war() : null; } catch (e) { war = null; }
  if (war && !W.war) addEvent(g, s, 'war', '（もしも）架空の国との戦争', { segs: { young: -2, families: -2, elderly: 0.3 } });
  W.war = !!war;
  let pf = null;
  try { pf = typeof g.pressFreedom === 'function' ? num((g.pressFreedom() || {}).value, null) : null; } catch (e) { pf = null; }
  if (pf != null && W.press != null && pf < W.press - 5) addEvent(g, s, 'press', '報道の自由の後退', { segs: { urban: -1.5, young: -1, elderly: 0.3 } });
  if (pf != null) W.press = pf;
}

// ================================================================ the morning tick
export async function govtTick(g) {
  if (!g || !g.state) return;
  const s = GS(g);
  if (!s) return;
  const day = today(g);
  if (num(s.lastTick) >= day) return;
  s.lastTick = day;
  const steps = [syncBudget, taxInForce, taxReformCycle, budgetCycle, syncMinistries, personnelTick, councilTick, postalTick, cultTick, endorsementsTick, questionsTick, keyBillsTick, resubmitKeyBills, demoTick, (gg, ss) => demoAuto(gg, ss, null), watchOthers];
  for (const fn of steps) { try { fn(g, s); } catch (e) { console.error('govtTick', fn.name, e); } }
  // a missed change of government (e.g. an old save): remember who governs now
  const p = pol(g);
  if (p && p.cabinet && p.cabinet.pm && (!s.seiken.last || (s.seiken.last.pm !== p.cabinet.pm && !p.cabinet.resigned && today(g) - num(s.seiken.last.day) > 30))) s.seiken.last = govSnapshot(g, p);
}
onMorning((g) => govtTick(g));

// ================================================================ refusals (why an action is not possible now)
function taxBlock(g, s, id, v, opts = {}) {
  const p = pol(g);
  const T = TAXES[id];
  if (!p || !POL) return '政治のしくみが読み込まれていない';
  if (id != null && !T) return 'そんな税はない';
  const role = playerPartyRole(p);
  const can = isPMg(p) || financeMinister(p) || (role.ruling && (role.leader || myPosts(p).includes('seichokai')));
  if (!can) return `税率を変える法律案は、与党の税制調査会での議論 → 税制改正大綱 → 内閣が国会に出す。提案できるのは総理・${postNameNow(g, 'minister_finance')}・与党の政調会長（野党は対案を出せる）`;
  if (p.cabinet.resigned) return '総辞職した内閣は、新しい政策を決められない';
  if (!T) return null;
  if (v != null) {
    const val = num(v, NaN);
    if (!Number.isFinite(val)) return '税率を数で決める';
    if (val < T.min || val > T.max) return `${T.min}〜${T.max}${T.unit}の範囲で`;
    const cur = rateNow(g, s, id);
    if (Math.abs(stepRate(id, val) - cur) < 1e-6) return `いまの税率（${cur}${T.unit}）と同じ`;
    if (s.taxPlan.some((x) => x.id === id && !x.done)) return `${T.short}は、すでに改正が決まって施行を待っている`;
    if (Math.abs(stepRate(id, val) - cur) > num(T.maxStep, 99) + 1e-6) return `一度に変えられる幅は${T.maxStep}${T.unit}くらいまで（与党の税制調査会は段階的な見直しを求める）`;
    if (id === 'shohi') {
      const TP = p.flags && p.flags.taxPlan;
      if (TP && !TP.done) return `すでに決まっている（${TP.law}年の法律で、${TP.year}年${TP.month}月から${TP.rate}%）`;
      if (p.diet.bills.some((b) => /^shohizei_/.test(String(b.policy)) && liveBill(b))) return '消費税の法案がすでに国会に出ている';
      if (cur === 0 && gdate(g).year < 1987) return '消費税はまだ構想の段階';
    }
  }
  if (opts.now) {
    if (!(isPMg(p) || financeMinister(p))) return '臨時の税制改正法案を出せるのは、総理か財務（大蔵）大臣';
    if (!inSessionP(p, today(g))) return '臨時の税制改正は、国会の会期中に（ふだんは12月の大綱 → 1月の国会）';
    if (s.taxReform.urgent && liveBill(p.diet.bills.find((b) => b.id === s.taxReform.urgent))) return '臨時の税制改正法案がもう審議中';
  }
  return null;
}
function dietBlock(g, s, kind, opts = {}) {
  const p = pol(g);
  if (!p || !POL) return '政治のしくみが読み込まれていない';
  const day = today(g);
  const role = playerPartyRole(p);
  const O = s.opposition;
  switch (kind) {
    case 'question': case 'shitsumon_shuisho':
      if (!isNational(p)) return '質問主意書を出せるのは国会議員だけ';
      if (!inSessionP(p, day)) return '質問主意書は国会の会期中に出す（国会法74条）';
      if (day - num(O.lastQ, -99) < 2) return '前の質問主意書から間がない';
      return null;
    case 'budget_question': case 'yosan_shitsugi':
      if (!isNational(p)) return '予算委員会で質問できるのは国会議員だけ';
      if (!inSessionP(p, day) || !p.diet.bills.some((b) => b.kind === 'budget' && !b.policy && liveBill(b))) return '予算委員会の審議（通常国会の前半、予算案が審議中のとき）に';
      if (day - num(O.budgetQ.day, -99) < 5) return '予算委員会の質問の時間は、次は数日後';
      return null;
    case 'taian':
      if (!isNational(p)) return '対案（議員立法）を出せるのは国会議員だけ';
      if (role.ruling) return '与党の議員は、政府の法案の中身を党の事前審査で変えるのが普通（対案は野党の手段）';
      return null;
    case 'kyoto':
      if (!role.pt || role.ruling) return '野党共闘は、野党の党首・幹事長・選挙対策委員長が進める';
      if (!(role.leader || role.kanjicho || role.sentai)) return '選挙協力を決めるのは、党首か幹事長・選挙対策委員長';
      return null;
    case 'boycott': case 'shingi_kyohi':
      if (!role.pt || role.ruling) return '審議拒否は野党が決める';
      if (!(role.leader || role.kokutai || role.kanjicho)) return '審議に応じるかどうかは、党首か国会対策委員長・幹事長が決める';
      if (!inSessionP(p, day)) return '国会の会期中に';
      if (O.boycott && O.boycott.until >= day) return 'すでに審議を拒否している';
      return null;
    case 'kokutai': case 'kyoko':
      if (!role.ruling) return '与党の国会運営の手段（与党の議員でないと使えない）';
      if (!(isPMg(p) || role.kokutai || role.kanjicho)) return '国会運営を仕切るのは、総理か与党の国会対策委員長・幹事長';
      if (kind === 'kyoko') { const real = realPartyNo(g, p, '採決の強行'); if (real) return real; }
      if (!inSessionP(p, day)) return '国会の会期中に';
      if (!p.diet.bills.some((b) => liveBill(b) && b.sponsor === 'cabinet' && b.kind !== 'budget')) return '審議中の政府の法案がない';
      return null;
    case 'key_bill':
      if (!isPMg(p)) return '最重要法案と位置づけられるのは総理大臣';
      return p.diet.bills.some((b) => liveBill(b) && b.sponsor === 'cabinet') ? null : '審議中の政府の法案がない';
    case 'key_dissolve': {
      if (!isPMg(p)) return '衆議院を解散できるのは総理大臣';
      const K = Object.values(s.keyBills).find((x) => x.rejected && !x.dissolved && today(g) - x.rejected <= 30);
      return K ? null : '参議院で否決された最重要法案がない';
    }
    case 'fushinnin':
      if (p.me.office !== 'shugi') return '内閣不信任決議案を出せるのは衆議院議員だけ';
      if (!inSessionP(p, day)) return '国会の会期中でないと出せない';
      return null;
    default: return null;
  }
}
function refusalImpl(g, s, kind, opts = {}) {
  const p = pol(g);
  switch (kind) {
    case 'tax': return taxBlock(g, s, opts.id ?? null, opts.value ?? null, opts);
    case 'budget': return budgetBlock(g, s);
    case 'supplementary': return !p ? '政治のしくみが読み込まれていない' : isPMg(p) || financeMinister(p) ? null : `補正予算案を出せるのは内閣（総理大臣か${postNameNow(g, 'minister_finance')}）。憲法73条・86条`;
    case 'reserve': return !p ? '政治のしくみが読み込まれていない' : !(isPMg(p) || financeMinister(p)) ? '予備費の使用を決めるのは内閣（総理か財務大臣が閣議に出す）' : reserveLeft(g, s) <= 0 ? '今年度の予備費はもう残っていない' : null;
    case 'ordinance': return ordinanceBlock(g, s, opts.id, opts.option);
    case 'council': {
      const C = COUNCILS[opts.id];
      if (!C) return 'そんな審議会はない';
      if (!councilExists(opts.id, gdate(g).fy)) return 'いまの時代にはない';
      if (!p || !canAsk(p, C.posts)) return '諮問できるのは、担当の大臣か総理大臣';
      const st = s.admin.councils[opts.id];
      return st && st.status === 'pending' ? `いま審議中（答申は${dLabel(g, st.due)}ごろ）` : null;
    }
    case 'demo_join': {
      if (regimeId(g) === 'dictatorship') return 'いまは集会やデモが禁じられている';
      try { if (typeof g.isFree === 'function' && !g.isFree()) return '身柄を拘束されている'; } catch (e) { /* */ }
      if (opts.id) { const d = s.demos.list.find((x) => x.id === opts.id); if (!d || d.status === 'ended') return 'そのデモはもう終わっている'; }
      else if (!s.demos.list.some((d) => d.status !== 'ended')) return 'いま行われているデモはない';
      return num(g.state.stamina) < 15 ? '体力が足りない' : null;
    }
    case 'demo_organize':
      if (regimeId(g) === 'dictatorship') return 'いまは集会やデモが禁じられている（体制）';
      if (s.demos.list.some((d) => d.by === 'player' && d.status !== 'ended')) return 'すでに主催しているデモがある';
      return num(g.state.money) < 30000 ? `準備のお金が足りない（${fmtMoney(30000)}）` : null;
    case 'demo_respond': {
      const d = opts.id ? s.demos.list.find((x) => x.id === opts.id) : s.demos.list.find((x) => x.status === 'active');
      return respondBlock(g, s, d, opts.how || 'tolerate');
    }
    // religion: every religionAction kind has its refusal (religionBlock, the same check the action runs first).
    // opts.group: the group (default: 和光修養会 for the endorsement, the problem group for the problem actions)
    case 'religion_funds': return RELIGION_LAW.art89;
    case 'religion': case 'religion_visit': case 'religion_endorse': case 'religion_report': case 'religion_victim': case 'religion_question': case 'religion_question_power': case 'religion_dissolution': {
      const action = kind === 'religion' ? opts.action : RELIGION_ACTION_OF[kind];
      if (!RELIGION_ACTIONS[action]) return 'そんな行動はない';
      const grp = opts.group || (action === 'ask_support' ? 'wako' : action === 'visit' ? RELIGION_ORDER[0] : RELIGION_ORDER.find((id) => RELIGIOUS_GROUPS[id].problem));
      return religionBlock(g, s, grp, action);
    }
    case 'postal': { try { return typeof g.policyBlock === 'function' ? g.policyBlock('postal_privatization') : '政治のしくみが読み込まれていない'; } catch (e) { return '—'; } }
    case 'kanbu_jinji': return !s.admin.reforms.jinjikyoku ? '内閣人事局がまだない（幹部人事は各府省が決める）' : !p || !(isPMg(p) || postOf(p, 'kanbo')) ? '幹部人事を決めるのは総理大臣と官房長官' : null;
    case 'amakudari_check': return !p || !(isPMg(p) || postOf(p, 'kanbo') || postOf(p, 'minister_mgmt') || postOf(p, 'minister_internal')) ? '公務員制度を担当する大臣か、総理・官房長官が指示する' : null;
    default: return dietBlock(g, s, kind, opts);
  }
}

// ================================================================ g.* API
// The 消費税 row's law: the game's own 消費税法 when it passed in this game, the real one when the era starts with it,
// else not yet (in 1987-1988, or later when history diverged).
function shohiLawText(g, s) {
  const d = gdate(g);
  const p = pol(g);
  let L = s.shohiLaw || null;
  if (!L && p && Array.isArray(p.laws)) { const l = p.laws.find((x) => x.policy === 'shohizei_intro'); if (l) { const ld = gdate(g, l.day); L = { year: ld.year, month: ld.month, inForce: null }; } }
  if (L) {
    const f = L.inForce;
    const when = f ? `、${f.year}年${f.month}月${ym(f.year, f.month) > ym(d.year, d.month) ? 'から施行の予定' : '施行'}` : '';
    return `消費税法（${L.year}年${L.month}月成立${when}。このゲームの中で成立した法律）`;
  }
  if (s.startYear >= 1990 || shohiRate(g) > 0) return txt(TAXES.shohi.law, Math.max(d.fy, 1990));
  return d.fy < 1989.25 ? txt(TAXES.shohi.law, d.fy) : '消費税法はまだない（このゲームでは、大型間接税はまだ導入されていない）';
}
function taxRowsImpl(g, s) {
  const d = gdate(g);
  const p = pol(g);
  const B = p && p.economy && p.economy.budget;
  const rev = B ? revenueDetail(g, s, B) : {};
  return TAX_ORDER.map((id) => {
    const T = TAXES[id];
    const rate = rateNow(g, s, id);
    const hist = T.owner === 'politics'
      ? T.hist.filter(([y, m]) => ym(y, m) <= ym(d.year, d.month) && ym(y, m) <= ym(s.startYear, 4)).map(([y, m, r]) => ({ year: y, month: m, rate: r, why: '' })).concat(s.taxHistory.filter((x) => x.id === 'shohi').reverse().map((x) => ({ year: x.year, month: x.month, rate: x.to, why: x.why })))
      : T.hist.filter(([y, m]) => ym(y, m) <= ym(s.startYear, 4)).map(([y, m, r, o]) => ({ year: y, month: m, rate: r, why: o && o.est ? '（目安）' : '' })).concat((s.taxes[id].history || []).slice(1).map((h) => ({ year: h.year, month: h.month, rate: h.rate, why: h.why })));
    const prop = s.taxReform.proposals && s.taxReform.proposals[id];
    return {
      id, name: taxName(id, d.fy), short: T.short, unit: T.unit, step: T.step, min: T.min, max: T.max, kind: T.kind, local: !!T.local, owner: T.owner || 'govt',
      rate, base: T.owner === 'politics' ? taxRateAt('shohi', s.startYear, 4) : num(s.taxes[id] && s.taxes[id].base), law: id === 'shohi' ? shohiLawText(g, s) : txt(T.law, d.fy), note: txt(T.note, d.fy, { rate }), explain: txt(T.explain, d.year), pro: arr(T.pro, d.fy), con: arr(T.con, d.fy),
      history: hist, pending: s.taxPlan.filter((x) => x.id === id && !x.done).map((x) => ({ rate: x.rate, year: x.year, month: x.month, why: x.why })),
      proposal: prop ? { rate: prop.rate, target: prop.target } : null, rejected: s.taxReform.rejected && s.taxReform.rejected[id] != null ? s.taxReform.rejected[id] : null,
      revenue: T.local ? null : rev[id] != null ? rev[id] : null, localRevenueDelta: T.local ? r2(localRevenueDelta(g, s)) : null,
      reduced: id === 'shohi' && p && p.flags && p.flags.reducedRate ? 8 : null,
    };
  });
}
function setTaxRateImpl(g, s, id, v, opts = {}) {
  const why = taxBlock(g, s, id, v, opts);
  if (why) return { ok: false, why };
  const T = TAXES[id];
  const p = pol(g);
  const d = gdate(g);
  const val = stepRate(id, v);
  const R = s.taxReform;
  if (opts.now) {
    if (!zeichoAccepts(g, s, id, val)) { R.rejected[id] = val; return { ok: false, why: '与党の税制調査会が了承しなかった（党内の理解が得られなかった）', stage: 'rejected' }; }
    const at = d.month >= 1 && d.month <= 3 ? { year: d.year, month: 4 } : { year: d.month === 12 ? d.year + 1 : d.year, month: d.month === 12 ? 1 : d.month + 1 };
    const schedule = [{ id, rate: val, year: at.year, month: at.month, player: true }];
    const b = addCabinetBill(g, p, { title: `${T.short}の税率を改める法律案（臨時の税制改正）`, policy: 'zeisei_kaisei', params: { changes: { [id]: val }, from: { [id]: rateNow(g, s, id) }, schedule, why: '臨時の税制改正', year: at.year, title: '臨時の税制改正', urgent: true }, ministry: 'minister_finance' });
    R.urgent = b.id;
    govtNews(g, s, `内閣が臨時の税制改正法案（${T.short} ${rateNow(g, s, id)}→${val}${T.unit}）を国会に提出した`);
    emit(g, 'taxReform', { stage: 'urgent', billId: b.id, id, rate: val });
    return { ok: true, stage: 'bill', billId: b.id, text: `与党の税制調査会の了承を得て、臨時の税制改正法案を国会に出した。成立すれば${dateText(at.year, at.month)}から${T.short}は${val}${T.unit}。` };
  }
  const target = d.doy < 114 ? d.year + 1 : d.year + 2;
  R.proposals = R.proposals || {};
  R.proposals[id] = { rate: val, target, day: today(g), by: isPMg(p) ? 'pm' : financeMinister(p) ? 'finance' : 'party' };
  if (R.rejected) delete R.rejected[id];
  emit(g, 'taxReform', { stage: 'proposal', id, rate: val, target });
  return { ok: true, stage: 'proposal', target, text: `${target}年度の税制改正に向けて、与党の税制調査会に「${T.short}を${val}${T.unit}に」と提案した。${target - 1}年12月中旬の税制改正大綱で採否が決まり、法律案が成立すれば、原則${CAL_YEAR_TAX[id] ? `${target}年分（1月）` : `${target}年${TAX_MONTH[id] || 4}月`}から適用。` };
}
const STAGE_LABEL = { request: '概算要求', genan: '財務省原案', cabinet: '政府案（閣議決定）', diet: '国会で審議中', passed: '成立', provisional: '暫定予算' };
function budgetImpl(g, s) {
  const p = pol(g);
  const d = gdate(g);
  const B = p && p.economy && p.economy.budget;
  if (!B) {
    const fy = d.year;
    const sh = budgetShares(fy);
    const tot = num(lerpAnchors(fy, BUDGET_TOTAL));
    return { fy, stage: 'unknown', stageLabel: '—', total: r1(tot), spending: BUDGET_ORDER.map((k) => ({ id: k, name: BUDGET_ITEMS[k].name, value: r2(num(sh[k]) * tot) })), revenue: [], note: '政治のしくみがないので、実際の当初予算の割合から示している' };
  }
  if (!B.govt) syncBudget(g, s);
  const G2 = B.govt || {};
  const det = G2.detail || baselineDetail(g, B);
  const total = sumObj(det);
  const rev = revenueDetail(g, s, B);
  const spending = BUDGET_ORDER.map((k) => {
    const it = BUDGET_ITEMS[k];
    return { id: k, name: it.name, value: r2(det[k]), share: total ? r1((det[k] / total) * 100) : 0, baseline: r2(G2.base ? G2.base[k] : det[k]), fixed: it.fixed, fixedLabel: { debt: '減らせない（国債の返済・利払い）', formula: 'ほぼ法律で決まる（法定率）', entitlement: '自然増がある（法律で決まる給付）', reserve: '予備費', discretionary: '政策で増減できる' }[it.fixed], min: it.min, max: it.max, area: it.area, explain: txt(it.explain, d.year), pro: it.pro, con: it.con, ministry: itemMinistry(it, d.fy) };
  });
  const midYear = r1(num(B.deficit) - (num(B.spending) - num(B.revenue) - num(G2.nontax)));
  if (midYear > 0.05) spending.push({ id: 'midyear', name: '年度途中の追加（補正・新しい法律）', value: midYear, share: 0, fixed: 'discretionary', fixedLabel: '年度の途中で決まった', explain: '年度の途中で成立した補正予算や法律の費用。', pro: ['災害や景気の急な変化など、年度の途中の必要にすぐ応えられる'], con: ['当初予算ほどの審議を経ずに支出がふくらみ、国債が増える'], ministry: '各府省' });
  const revTotal = sumObj(rev);
  const revenue = Object.entries(rev).map(([id, v]) => ({ id, name: id === 'sonotazei' ? (d.year < 1989 ? 'その他の税（物品税・関税など）' : 'その他の税（関税・印紙収入など）') : REVENUE_ITEMS[id].name, value: v, share: revTotal ? r1((v / revTotal) * 100) : 0 }));
  const S = s.budget;
  const cal = [
    { step: 'ceiling', label: '概算要求基準（シーリング）を閣議了解', when: '7月下旬', done: num(S.ceilingYear) >= d.year },
    { step: 'request', label: '各府省が概算要求を提出', when: '8月末', done: num(S.requestYear) >= d.year },
    { step: 'genan', label: '財務省原案の内示 → 復活折衝', when: '12月下旬', done: num(S.genanYear) >= d.year },
    { step: 'cabinet', label: '政府案を閣議決定', when: '12月下旬', done: num(S.decidedYear) >= d.year },
    { step: 'diet', label: '通常国会に提出（衆議院が先に審議、憲法60条）', when: '1月', done: d.doy < 30 && num(S.decidedYear) >= d.year - 1 && !!p.diet.bills.find((b) => b.kind === 'budget' && !b.policy && String(b.title || '').startsWith(`${d.year}年度`)) },
    { step: 'passed', label: '成立（参院が30日以内に議決しなければ自然成立）', when: '3月末まで', done: !!B.passed && num(B.year) === d.year },
    { step: 'fy', label: '新年度。成立していなければ暫定予算', when: '4月1日', done: num(S.fyStarted) >= d.year },
  ];
  const used = (S.reserve.used || []).reduce((a, u) => a + num(u.amount), 0);
  return {
    fy: num(B.year), stage: B.passed ? 'passed' : B.provisional ? 'provisional' : S.stage, stageLabel: B.passed ? '成立' : B.provisional ? '暫定予算' : STAGE_LABEL[S.stage] || S.stage,
    passed: !!B.passed, provisional: !!B.provisional, total: r1(total), spending, revenue, tax: r1(B.revenue), nontax: r1(G2.nontax), bonds: r1(B.deficit), bondRatio: total ? r1((num(B.deficit) / total) * 100) : 0,
    primaryBalance: r1(num(B.revenue) + num(G2.nontax) - (total - num(det.kokusai))), debtRatio: Math.round(num(p.economy.debtRatio)), gdp: Math.round(num(p.economy.gdp)),
    calendar: cal, draft: budgetDraftImpl(g, s), requests: S.requests ? { ...S.requests } : null, decided: S.decided ? { fy: S.decided.fy, total: S.decided.total, by: S.decided.by } : null,
    supplementary: S.supplementary.slice(-10), reserve: { total: r2(det.yobi), used: r2(used), left: reserveLeft(g, s), list: (S.reserve.used || []).slice() },
    history: S.history.map((h) => ({ ...h })), taxDelta: r1(G2.taxDelta), calibrated: num(G2.cal, 1) !== 1,
    note: '一般会計（兆円）。開始年度の総額と主な費目は財務省の当初予算にあわせ、その後はシミュレーション',
  };
}
function budgetDraftImpl(g, s) {
  const S = s.budget;
  if (!S.draft) return null;
  const Dr = S.draft;
  const items = BUDGET_ORDER.map((k) => ({ id: k, name: BUDGET_ITEMS[k].name, preview: r2(Dr.preview[k]), draft: r2(Dr.items[k]), request: S.requests && S.requests.fy === Dr.fy ? r2(S.requests.items[k]) : null, fixed: BUDGET_ITEMS[k].fixed, min: BUDGET_ITEMS[k].abs ? BUDGET_ITEMS[k].min : r2(Dr.preview[k] * (1 + BUDGET_ITEMS[k].min)), max: BUDGET_ITEMS[k].abs ? BUDGET_ITEMS[k].max : r2(Dr.preview[k] * (1 + BUDGET_ITEMS[k].max)), delta: r2(Dr.items[k] - Dr.preview[k]) }));
  const total = sumObj(Dr.items);
  return { fy: Dr.fy, by: Dr.by, editable: budgetBlock(g, s), items, total: r1(total), previewTotal: r1(sumObj(Dr.preview)), requestTotal: S.requests ? S.requests.total : null, decided: !!(S.decided && S.decided.fy === Dr.fy) };
}
function setBudgetImpl(g, s, item, v) {
  const why = budgetBlock(g, s);
  if (why) return { ok: false, why };
  const it = BUDGET_ITEMS[item];
  if (!it) return { ok: false, why: 'そんな費目はない' };
  if (it.fixed === 'debt') return { ok: false, why: '国債費は、過去の借金の返済と利払い。予算で減らすことはできない' };
  if (it.min === 0 && it.max === 0) return { ok: false, why: `${it.name}は法律で決まった給付で、予算では変えられない` };
  const Dr = s.budget.draft;
  const pv = num(Dr.preview[item]);
  const val = r2(num(v, NaN));
  if (!Number.isFinite(val)) return { ok: false, why: '金額（兆円）を数で' };
  const lo = it.abs ? it.min : pv * (1 + it.min), hi = it.abs ? it.max : pv * (1 + it.max);
  if (val < lo - 0.006 || val > hi + 0.006) {
    const reason = it.fixed === 'formula' ? '（地方交付税は国税の一定割合で決まる。大きく変えるには地方交付税法の改正がいる）' : it.fixed === 'entitlement' ? '（年金・医療などの給付は法律で決まっていて、自然増は削りきれない）' : '';
    return { ok: false, why: `${it.name}は${r2(lo)}〜${r2(hi)}兆円の範囲で${reason}` };
  }
  Dr.items[item] = val;
  Dr.by = 'player';
  Dr.set = { ...(Dr.set || {}), [item]: true };
  if (it.abs) Dr.yobiSet = val;
  const total = r1(sumObj(Dr.items));
  emit(g, 'budget', { stage: 'draft', item, value: val });
  return { ok: true, item, value: val, total, delta: r1(total - sumObj(Dr.preview)), text: `${it.name}を${fmtCho(val)}にした（前年なみより${fmtD(val - pv, '兆円')}）。予算案の総額 ${fmtCho(total)}。12月下旬の閣議決定で確定する。` };
}
const methods = {
  govt() { return GS(this); },
  govtTick() { return govtTick(this); },
  taxRates() { const s = GS(this); return s ? taxRowsImpl(this, s) : []; },
  taxReform() { const s = GS(this); if (!s) return null; const R = s.taxReform; return { year: R.year, stage: R.stage, proposals: { ...(R.proposals || {}) }, rejected: { ...(R.rejected || {}) }, taiko: R.taiko ? { ...R.taiko } : null, billId: R.billId, urgent: R.urgent || null, plan: s.taxPlan.filter((x) => !x.done).map((x) => ({ ...x })), log: R.log.slice(-12), history: s.taxHistory.slice(0, 20) }; },
  setTaxRate(id, v, opts = {}) { const s = GS(this); return s ? setTaxRateImpl(this, s, id, v, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  budget() { const s = GS(this); return s ? budgetImpl(this, s) : null; },
  budgetDraft() { const s = GS(this); return s ? budgetDraftImpl(this, s) : null; },
  setBudget(item, v) { const s = GS(this); return s ? setBudgetImpl(this, s, item, v) : { ok: false, why: 'まだ準備ができていない' }; },
  supplementaryBudget(def = {}) { const s = GS(this); return s ? supplementaryImpl(this, s, def || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  useReserve(amount, purpose = 'other') { const s = GS(this); return s ? useReserveImpl(this, s, amount, purpose) : { ok: false, why: 'まだ準備ができていない' }; },
  ministries() {
    const s = GS(this);
    if (!s) return [];
    syncMinistries(this, s);
    const p = pol(this);
    const d = gdate(this);
    return ministryPosts(this, d.fy).map((post) => {
      const B = s.admin.bureaucrats[post];
      const who = p && p.cabinet && p.cabinet.ministers ? (post === 'kanbo' ? p.cabinet.ministers.kanbo : p.cabinet.ministers[post]) : null;
      return {
        post, name: ministryName(post, d.fy), minister: postNameNow(this, post), ministerId: who || null, ministerName: who === 'player' ? this.state.name : npcNameOf(this, who), playerHeads: who === 'player',
        top: B ? { ...B.top } : null, kanbo: B ? { ...B.kanbo } : null, bureaus: B ? B.bureaus.map((x) => ({ ...x })) : [],
        councils: COUNCIL_ORDER.filter((id) => councilExists(id, d.fy) && COUNCILS[id].posts.includes(post)), ordinances: ORDINANCE_ORDER.filter((id) => ordinanceExists(id, d.fy) && ORDINANCES[id].posts.includes(post)),
      };
    });
  },
  bureaucrats() { const s = GS(this); if (!s) return []; const out = []; for (const [post, B] of Object.entries(s.admin.bureaucrats)) for (const x of [B.top, B.kanbo, ...B.bureaus]) out.push({ ...x, ministry: ministryName(post, gdate(this).fy) }); return out; },
  councils() {
    const s = GS(this);
    if (!s) return [];
    const d = gdate(this);
    return COUNCIL_ORDER.filter((id) => councilExists(id, d.fy)).map((id) => { const C = COUNCILS[id]; const st = s.admin.councils[id] || null; return { id, name: txt(C.name, d.year), desc: txt(C.desc, d.fy), topic: C.topic, areas: C.areas, posts: C.posts.map((x) => (x === 'pm' ? '内閣総理大臣' : postNameNow(this, x))), why: refusalImpl(this, s, 'council', { id }), status: st ? st.status : 'idle', report: st && st.report ? { ...st.report } : null, due: st && st.status === 'pending' ? st.due : null }; });
  },
  councilConsult(id, topic) { const s = GS(this); return s ? councilConsultImpl(this, s, id, topic) : { ok: false, why: 'まだ準備ができていない' }; },
  ordinances() {
    const s = GS(this);
    if (!s) return [];
    const d = gdate(this);
    return ORDINANCE_ORDER.filter((id) => ordinanceExists(id, d.fy)).map((id) => { const O = ORDINANCES[id]; return { id, name: O.name, kind: txt(O.kind, d.fy), basis: txt(O.basis, d.year), desc: txt(O.desc, d.fy), posts: O.posts.map((x) => postNameNow(this, x)), options: Object.entries(O.options).map(([key, o]) => ({ key, label: o.label, segments: { ...(o.seg || {}) }, cost: o.cost || 0 })), pro: arr(O.pro, d.fy), con: arr(O.con, d.fy), needCouncil: needCouncilOf(O, d.fy), why: ordinanceBlock(this, s, id), last: s.admin.ordinances[id] ? s.admin.ordinances[id].last : null }; });
  },
  issueOrdinance(id, opts = {}) { const s = GS(this); return s ? issueOrdinanceImpl(this, s, id, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  adminReform() {
    const s = GS(this);
    if (!s) return null;
    const d = gdate(this);
    const A = s.admin;
    const items = [
      { id: 'reorg2001', label: d.year >= 1998 ? '中央省庁の再編（1府22省庁 → 1府12省庁）' : '中央省庁の再編', done: d.year >= 2001, when: '2001年1月6日', text: d.year >= 2001 ? '大蔵省は財務省に、厚生省と労働省は厚生労働省に、郵政省・自治省・総務庁は総務省になった。' : '行政改革の議論が続いている。' },
      { id: 'amakudariBan', label: '再就職あっせんの禁止（天下りの規制）', done: !!A.reforms.amakudariBan, when: A.reforms.amakudariBan ? `${A.reforms.amakudariBan.year}年` : '未', text: A.reforms.amakudariBan && A.reforms.amakudariBan.real ? '2007年の国家公務員法改正で、各府省による再就職のあっせんが禁止された。' : A.reforms.amakudariBan ? '天下りを規制する法律が成立した（ゲームの中の出来事）。' : '各府省がOBの再就職をあっせんしている。規制の法律（政策「天下り（再就職あっせん）の規制」）で変えられる。' },
      { id: 'jinjikyoku', label: '内閣人事局（幹部人事の一元管理）', done: !!A.reforms.jinjikyoku, when: A.reforms.jinjikyoku ? (A.reforms.jinjikyoku.real ? '2014年5月30日' : `${A.reforms.jinjikyoku.year}年`) : '未', text: A.reforms.jinjikyoku ? '各府省の幹部の人事を、総理と官房長官のもとで一元的に管理する（政治主導が進む一方、「忖度」への懸念も）。' : '幹部の人事は、実際には各府省が決めている。' },
    ];
    return { items, amakudari: { heat: Math.round(num(A.amakudari.heat)), cases: A.amakudari.cases.slice(0, 10) }, sontaku: Math.round(num(A.sontaku)), picks: num(A.picks), pro: ['政治主導で縦割りをなくし、国民に選ばれた政治家が責任をもって決める'], con: ['官僚が政治家の顔色をうかがい、専門家としての意見を言いにくくなる'] };
  },
  adminAction(kind, opts = {}) { const s = GS(this); return s ? adminActionImpl(this, s, kind, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  bureaucratAnswer(topic = 'generic') { const s = GS(this); return s ? bureaucratAnswerImpl(this, s, topic) : null; },
  postal() { const s = GS(this); return s ? postalStatus(this, s) : null; },
  religion() { const s = GS(this); return s ? religionStatus(this, s) : null; },
  religionAction(groupId, kind, opts = {}) { const s = GS(this); return s ? religionActionImpl(this, s, groupId, kind, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  opposition() {
    const s = GS(this);
    if (!s) return null;
    const O = s.opposition;
    const acts = (reg) => Object.entries(reg).map(([id, a]) => ({ id, ...a, why: refusalImpl(this, s, id) }));
    return { questions: O.questions.map((q) => ({ ...q })), alliance: O.alliance ? { ...O.alliance } : null, boycott: O.boycott ? { ...O.boycott } : null, opposition: acts(OPPOSITION_ACTIONS), ruling: acts(RULING_ACTIONS), keyBills: Object.entries(s.keyBills).map(([id, k]) => ({ id, ...k })) };
  },
  oppositionAction(kind, opts = {}) { const s = GS(this); return s ? oppositionImpl(this, s, kind, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  rulingAction(kind, opts = {}) { const s = GS(this); return s ? rulingImpl(this, s, kind, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  keyBillDissolve(billId) { const s = GS(this); if (!s) return { ok: false, why: 'まだ準備ができていない' }; const id = billId || (Object.entries(s.keyBills).find(([, k]) => k.rejected && !k.dissolved) || [])[0]; return keyBillDissolveImpl(this, s, id); },
  voices(n = 6, opts = {}) {
    const s = GS(this);
    if (!s) return [];
    if (opts.fresh || !s.voices.feed.length) generalVoices(this, s, Math.max(2, Math.min(8, n)));
    let list = s.voices.feed;
    if (opts.event) list = list.filter((v) => v.kind === opts.event || v.event === opts.event);
    if (opts.segment) list = list.filter((v) => v.seg === opts.segment);
    if (opts.stance) list = list.filter((v) => v.stance === opts.stance);
    if (opts.since != null) list = list.filter((v) => v.day >= opts.since);
    return list.slice(0, n).map((v) => ({ ...v }));
  },
  demos(opts = {}) { const s = GS(this); if (!s) return []; let l = s.demos.list; if (opts.active) l = l.filter((d) => d.status !== 'ended'); return l.map((d) => ({ ...d, responses: d.responses.slice(), log: d.log.slice(-8) })); },
  spawnDemo(def = {}) { const s = GS(this); return s ? spawnDemoImpl(this, s, def || {}) : null; },
  joinDemo(id, opts = {}) { const s = GS(this); return s ? joinDemoImpl(this, s, id, opts || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  organizeDemo(def = {}) { const s = GS(this); return s ? organizeDemoImpl(this, s, def || {}) : { ok: false, why: 'まだ準備ができていない' }; },
  respondDemo(id, how) { const s = GS(this); return s ? respondDemoImpl(this, s, id, how) : { ok: false, why: 'まだ準備ができていない' }; },
  demoResponses(id) { const s = GS(this); if (!s) return []; const d = s.demos.list.find((x) => x.id === id); return Object.entries(DEMO_RESPONSES).map(([how, R]) => ({ id: how, label: R.label, desc: R.desc || '', why: respondBlock(this, s, d, how) })); },
  approvalBreakdown() { const s = GS(this); return s ? approvalBreakdownImpl(this, s) : null; },
  // other cores record their part of the approval (reason: 'disaster' | 'regime' | ...). opts.applied: the change was
  // already made to the cabinet (only record it); otherwise delta is added to the cabinet's mood (policy term).
  approvalNote(reason, delta, text = '', opts = {}) { const s = GS(this); if (!s) return null; const r = REASON_LABEL[reason] ? reason : 'regime'; if (opts && opts.applied) { s.approval.ledger.push({ day: today(this), reason: r, mood: r2(delta), scandal: 0, text, applied: true }); return true; } ledgerAdd(this, s, r, { mood: num(delta), text }); return true; },
  seatDetails() { const s = GS(this); return s ? seatDetailsImpl(this, s) : null; },
  seikenLog(n = 10) { const s = GS(this); return s ? s.seiken.log.slice(0, n).map((x) => ({ ...x })) : []; },
  govtNews(n = 10) { const s = GS(this); return s ? s.news.slice(0, n).map((x) => ({ ...x })) : []; },
  govtRefusal(kind, opts = {}) { const s = GS(this); return s ? refusalImpl(this, s, kind, opts || {}) : '政府のしくみが読み込まれていない'; },
  govtSettings(opts = {}) { const s = GS(this); if (!s) return null; if (opts && ['auto', 'all', 'off'].includes(opts.scenes)) s.settings.scenes = opts.scenes; return { ...s.settings }; },
  // One object for a console screen.
  govtSummary() {
    const s = GS(this);
    if (!s) return null;
    const p = pol(this);
    const alerts = [];
    const why = budgetBlock(this, s);
    if (!why) alerts.push({ kind: 'budget', text: `${s.budget.draft.fy}年度予算の配分を決められる（12月下旬の閣議決定まで）` });
    for (const [id, K] of Object.entries(s.keyBills)) if (K.offer && !K.dissolved && today(this) - K.rejected <= 30) alerts.push({ kind: 'keyBill', id, text: `最重要法案「${K.title}」が参院で否決。衆議院を解散して信を問える` });
    for (const d of s.demos.list) if (d.status === 'active' && p && (isPMg(p) || postOf(p, 'kanbo')) && !d.responses.length && d.stance === 'protest') alerts.push({ kind: 'demo', id: d.id, text: `${qd(d.cause)}（約${d.size.toLocaleString('ja-JP')}人）への政府の対応` });
    for (const q of s.opposition.questions) if (q.answered && today(this) - q.answered <= 2) alerts.push({ kind: 'answer', id: q.id, text: `答弁書が届いた：「${q.title}」` });
    if (s.taxReform.stage === 'chosakai') alerts.push({ kind: 'taxReform', text: `与党の税制調査会が${s.taxReform.year}年度の税制改正を議論中（12月中旬に大綱）` });
    return {
      date: gdate(this), era: s.era, taxes: taxRowsImpl(this, s).map((t) => ({ id: t.id, short: t.short, rate: t.rate, unit: t.unit, pending: t.pending, proposal: t.proposal })), taxReform: this.taxReform(),
      budget: (() => { const b = budgetImpl(this, s); return b ? { fy: b.fy, stageLabel: b.stageLabel, total: b.total, tax: b.tax, bonds: b.bonds, bondRatio: b.bondRatio, debtRatio: b.debtRatio } : null; })(),
      approval: (() => { const a = approvalBreakdownImpl(this, s); return { approval: a.approval, disapproval: a.disapproval, reasons: a.reasons, bySegment: a.bySegment }; })(), seats: seatDetailsImpl(this, s),
      demos: s.demos.list.filter((d) => d.status !== 'ended').map((d) => ({ id: d.id, cause: d.cause, size: d.size, place: d.place, stance: d.stance })), voices: this.voices(6),
      postal: (() => { const x = postalStatus(this, s); return { stage: x.stage, label: x.label, open: x.open }; })(), religion: religionStatus(this, s).cult, alerts, news: s.news.slice(0, 10),
    };
  },
};
export function installGovt(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, { ...Object.getOwnPropertyDescriptor(methods, k), configurable: true, writable: true });
}
installGovt(Game.prototype);
if (typeof window !== 'undefined') window.__govt = { TAXES, BUDGET_ITEMS, RELIGIOUS_GROUPS, DEMO_RESPONSES, onGovt, govtTick };
