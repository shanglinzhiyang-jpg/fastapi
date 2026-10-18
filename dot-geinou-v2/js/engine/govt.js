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
//   → 2007 40%（6段階、税源移譲）→ 2015 45%. 2013-2037 は復興特別所得税（2.1%）が上乗せ。
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
// ガソリン税（揮発油税＋地方揮発油税、旧地方道路税）: 本則 28.7円/L、暫定（特例）税率で 53.8円/L（1979年6月から。
//   1974年4月に「暫定的」な上乗せが始まる）。2008年4月に1か月だけ期限切れ。2025年12月31日に暫定税率を廃止（与野党合意
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
// Fictional: ドット仏教会, ドット明神 氏子会, ドット坂キリスト教会, 和光修養会, 天環の泉 (no real group has these names),
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
    id: 'shohi', name: '消費税', short: '消費税', unit: '%', step: 1, min: 0, max: 25, kind: '間接税（国税＋地方消費税）', owner: 'politics',
    hist: [[1989, 4, 3], [1997, 4, 5, { law: 1994 }], [2014, 4, 8, { law: 2012 }], [2019, 10, 10, { law: 2012 }]], before: 0,
    law: '消費税法（1988年12月成立、1989年4月施行）',
    explain: (y) => (y < 1989 ? 'ものやサービスを買うときに広くかかる税（大型間接税）。いまの日本にはまだない。導入するかどうかが大きな争点になっている。'
      : `ものやサービスを買うときに広くかかる税。景気に左右されにくく、社会保障の財源とされる。${y >= 1997 ? '税率は国税と地方消費税の合計。' : ''}${y >= 2020 ? '2019年10月からは食料品などに軽減税率（8%）がある。' : ''}`),
    pro: ['景気に左右されにくい安定した財源で、高齢化で増える社会保障を支えられる', '働く世代だけでなく、すべての世代が広く負担する', '所得税や法人税に比べ、経済活動をゆがめにくい'],
    con: ['所得の低い人ほど負担が重くなる（逆進性）', '税率を上げると消費が冷え込み、景気を悪くするおそれ', '中小の事業者には事務の負担が大きい'],
    seg: { young: -0.6, families: -1.2, elderly: -0.4, employees: -0.6, selfemployed: -1.0, business: 0.2, unions: -0.6, urban: -0.3, rural: -0.3, floating: -0.8 },
    eco: { growth: -0.12, inflation: 0.45 }, coef: 2.6,
  },
  shotoku: {
    id: 'shotoku', name: '所得税（最高税率）', short: '所得税', unit: '%', step: 1, min: 10, max: 75, kind: '直接税（国税・累進課税）',
    hist: [[1984, 1, 70], [1987, 1, 60], [1989, 1, 50], [1999, 1, 37], [2007, 1, 40], [2015, 1, 45]],
    law: '所得税法', note: (y) => (y >= 2013 ? '2013年から2037年までは復興特別所得税（所得税額の2.1%）が上乗せされる' : ''),
    explain: '個人の所得にかかる国の税。所得が多いほど高い税率がかかる累進課税で、ここでは一番上の段階（最高税率）を扱う。',
    pro: ['所得の多い人に多く負担してもらい、格差をやわらげる（所得の再分配）', '税収を増やして、財政や社会保障にまわせる'],
    con: ['働く意欲や起業の意欲をそぐおそれ', '高い所得の人や会社が海外に移るおそれ', '税率を上げても、税収の増え方は限られる'],
    seg: { business: -0.4, selfemployed: -0.2, employees: -0.05, unions: 0.3, young: 0.15, floating: 0.1, families: 0.05 },
    eco: { growth: -0.006 }, coef: 0.10,
  },
  jumin: {
    id: 'jumin', name: '住民税（所得割の最高税率）', short: '住民税', unit: '%', step: 1, min: 5, max: 20, kind: '地方税（都道府県民税＋市区町村民税）', local: true,
    hist: [[1986, 6, 18], [1988, 6, 16, { est: true }], [1989, 6, 15, { est: true }], [1999, 6, 13, { est: true }], [2007, 6, 10]],
    law: '地方税法', note: (y) => `${y >= 2007 ? '2007年度から10%の比例税率（道府県民税4%＋市町村民税6%）。' : ''}地方の財源なので、国の一般会計には入らない`,
    explain: (y) => `住んでいる都道府県と市区町村に納める税。税率は地方税法で決まる。${y < 1988 ? 'いまは14段階（最高18%）。' : y < 2007 ? '所得に応じた段階的な税率（累進）。' : '1987年度は14段階（最高18%）、平成18年度までは5・10・13%の3段階、2007年度からは一律10%。'}`,
    pro: ['地域の行政サービス（学校・ごみ・福祉）の財源になる', '税率を上げれば、地方が国に頼らず自分の財源で仕事ができる'],
    con: ['ほとんどの住民に広くかかり、家計の負担が増える', '地域によって行政サービスの差が出やすい'],
    seg: { employees: -0.5, families: -0.4, elderly: -0.2, young: -0.3, unions: -0.2, selfemployed: -0.3, urban: -0.2, rural: -0.1, floating: -0.3 },
    eco: { growth: -0.02 }, coef: 0, localCoef: 1.2,
  },
  hojin: {
    id: 'hojin', name: '法人税（基本税率）', short: '法人税', unit: '%', step: 0.1, min: 10, max: 50, kind: '直接税（国税）',
    hist: [[1984, 4, 43.3], [1987, 4, 42], [1989, 4, 40], [1990, 4, 37.5], [1998, 4, 34.5], [1999, 4, 30], [2012, 4, 25.5], [2015, 4, 23.9], [2016, 4, 23.4], [2018, 4, 23.2]],
    law: '法人税法', note: (y) => `中小法人の一定以下の所得には軽減税率がある。${y >= 2026 ? '2026年度から防衛特別法人税が上乗せされる' : ''}`,
    explain: '会社などの法人の所得（もうけ）にかかる国の税。ここでは普通法人の基本税率を扱う。',
    pro: ['もうけている企業に応分の負担を求め、暮らしの財源にできる', '税率を下げれば、企業の投資や賃上げ、海外からの進出を呼びこめる（下げる側の主張）'],
    con: ['税率を上げると、企業の投資や雇用が海外に逃げるおそれ', '税率を下げると税収が減り、財政が苦しくなる（上げる側の主張）'],
    seg: { business: -0.8, employees: -0.1, selfemployed: -0.1, unions: 0.3, families: 0.05, floating: 0.05, young: 0.05 },
    eco: { growth: -0.03, nikkei: -0.8, unemployment: 0.02 }, coef: 0.5,
  },
  sozoku: {
    id: 'sozoku', name: '相続税（最高税率）', short: '相続税', unit: '%', step: 1, min: 10, max: 80, kind: '直接税（国税）',
    hist: [[1975, 1, 75], [1988, 1, 70], [2003, 1, 50], [2015, 1, 55]],
    law: '相続税法',
    explain: '亡くなった人から財産を受け継いだときにかかる税。財産が大きいほど税率が高い。',
    pro: ['親の財産による格差が世代をこえて続くのをおさえる', 'お金持ちの財産に応分の負担を求められる'],
    con: ['中小企業や農家が、事業や土地を受け継ぎにくくなる', '一生かけて税を払ったあとの財産に、もう一度かかる（二重課税という批判）'],
    seg: { elderly: -0.3, business: -0.2, selfemployed: -0.3, farmers: -0.2, young: 0.2, unions: 0.2 },
    eco: {}, coef: 0.05,
  },
  kihatsu: {
    id: 'kihatsu', name: 'ガソリン税（揮発油税＋地方揮発油税）', short: 'ガソリン税', unit: '円/L', step: 0.1, min: 0, max: 80, kind: '間接税（国税）',
    hist: [[1974, 4, 34.5], [1976, 7, 43.1], [1979, 6, 53.8], [2008, 4, 28.7], [2008, 5, 53.8], [2026, 1, 28.7, { law: 2025 }]],
    law: '揮発油税法など（暫定税率は租税特別措置法）', note: (y) => (y >= 2026 ? '本則28.7円に上乗せされていた「暫定税率」25.1円は、2025年12月31日に廃止された' : '本則28.7円に、1974年からの「暫定税率」25.1円が上乗せされて53.8円'),
    explain: (y) => `ガソリン1リットルにかかる税。${y >= 2009 ? 'もとは道路を整備するための財源だった（2009年度から一般財源）。' : '道路を整備するための財源（道路特定財源）。'}`,
    pro: ['安定した税収になる', '車の利用をおさえ、二酸化炭素の排出を減らす効果がある'],
    con: ['車が欠かせない地方の暮らしや、運送業の負担が重い', '税金に消費税がかかる「二重課税」との批判'],
    seg: { rural: -0.15, selfemployed: -0.1, farmers: -0.1, employees: -0.04, young: -0.04, families: -0.04, urban: 0.02 },
    eco: { inflation: 0.006, growth: -0.002 }, coef: 0.06,
  },
  sake: {
    id: 'sake', name: '酒税（ビール350ml缶あたり）', short: '酒税', unit: '円', step: 0.01, min: 0, max: 150, kind: '間接税（国税）',
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
    pro: ['国債をきちんと返すことで、国の信用が保たれる'], con: ['歳出の4分の1ほどを占め、政策に使えるお金を圧迫する'],
    seg: {}, eco: {},
  },
  kofuzei: {
    id: 'kofuzei', name: '地方交付税交付金等', area: 'regional', fixed: 'formula', min: -0.03, max: 0.03, ministry: 'minister_internal',
    explain: '自治体の財源の差をならすために国が配るお金。国税の一定の割合（法定率）で決まるので、大きく変えるには地方交付税法の改正がいる。',
    pro: ['どこに住んでいても、一定の行政サービスを受けられる'], con: ['自治体が国に頼り、自分で財源を増やす努力をしにくい'],
    seg: { rural: 0.8, farmers: 0.2, elderly: 0.1, urban: -0.3, business: -0.1 }, eco: { growth: 0.01 },
  },
  kokyo: {
    id: 'kokyo', name: '公共事業関係費', area: 'regional', fixed: 'discretionary', min: -0.25, max: 0.3, ministry: 'minister_transport',
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
    id: 'onkyu', name: '恩給関係費', area: 'other', fixed: 'entitlement', min: 0, max: 0, ministry: 'kanbo',
    explain: '旧軍人などの恩給。受給者が少なくなるにつれて、年々減っている。法律で決まった給付なので、予算では変えられない。',
    pro: ['国のために働いた人への約束を守る'], con: [], seg: {}, eco: {},
  },
  sonota: {
    id: 'sonota', name: 'その他', area: 'other', fixed: 'discretionary', min: -0.1, max: 0.2, ministry: 'kanbo',
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

// era-gated text: a string, or fn(year) -> string
const txt = (v, year) => (typeof v === 'function' ? v(year) : v || '');

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
// The top official and a few senior posts (only long-standing titles; 大臣官房長 exists in every ministry).
const TOP_TITLE = { kanbo: '内閣官房副長官（事務）', minister_npsc: '警察庁長官', minister_digital: 'デジタル監' };
const BUREAUS = {
  minister_finance: ['主計局長', '主税局長'], minister_internal: ['自治財政局長'], minister_home: ['財政局長'], minister_justice: ['刑事局長'],
  minister_foreign: ['北米局長'], minister_health: ['保険局長'], minister_education: ['初等中等教育局長'], minister_npsc: ['警備局長'],
};
export function ministryName(post, fy = 2026) {
  const rows = MINISTRY_OF_POST[post];
  if (!rows) return '';
  let n = '';
  for (const [y, name] of rows) if (fy >= y) n = name;
  return n || rows[0][1];
}
// 審議会・会議 (posts: who may ask; the PM may ask any). years: [from, to). report effects are small and even-handed.
export const COUNCILS = {
  zeicho: { name: '税制調査会（政府税調）', posts: ['pm', 'minister_finance'], years: [1959, INF], areas: ['tax'], topic: '税制のあり方', desc: (y) => `総理の諮問に答えて税制の基本を議論する${y >= 2001 ? '（2001年から内閣府に置かれる）' : ''}。毎年の税率を実際に決めるのは、与党の税制調査会の色合いが強い。` },
  zaiseishin: { name: (y) => (y >= 2001 ? '財政制度等審議会' : '財政制度審議会'), posts: ['minister_finance'], years: [1950, INF], areas: ['finance'], topic: '予算と財政健全化', desc: '予算編成の考え方や財政の健全化について、財務（大蔵）大臣に意見を出す。' },
  keizaizaisei: { name: '経済財政諮問会議', posts: ['pm', 'minister_econ'], years: [2001, INF], areas: ['economy', 'finance'], topic: '経済財政運営の基本方針', desc: '議長は総理大臣。毎年、経済財政運営の基本方針（いわゆる「骨太の方針」）をまとめ、予算の大枠を示す。' },
  shakaihosho: { name: (y) => (y >= 2001 ? '社会保障審議会' : '社会保障制度審議会'), posts: ['minister_health'], years: [1949, INF], areas: ['welfare', 'health', 'childcare'], topic: '年金・医療・介護の制度', desc: '社会保障の制度について審議し、答申や意見を出す。' },
  chuikyo: { name: '中央社会保険医療協議会（中医協）', posts: ['minister_health'], years: [1950, INF], areas: ['health'], topic: '診療報酬の改定', desc: '診療報酬（医療の値段）の改定について、厚生（労働）大臣の諮問に答える。答申を受けて大臣が告示する。' },
  chukyoshin: { name: '中央教育審議会', posts: ['minister_education'], years: [1952, INF], areas: ['education'], topic: '学校教育のあり方', desc: '教育の制度や学習指導要領について答申する。' },
  hoseishin: { name: '法制審議会', posts: ['minister_justice'], years: [1949, INF], areas: ['society', 'safety'], topic: '民法・刑法などの見直し', desc: '民法や刑事法などの基本的な法律の改正について、法務大臣の諮問に答える。' },
  chiseicho: { name: '地方制度調査会', posts: ['pm', 'minister_home', 'minister_internal'], years: [1952, INF], areas: ['regional'], topic: '地方自治の制度', desc: '総理大臣の諮問を受け、地方自治の制度について答申する。' },
  gyokakushin: { name: '臨時行政改革推進審議会（行革審）', posts: ['pm', 'minister_mgmt'], years: [1983.5, 1993.8], areas: ['admin'], topic: '行政改革の推進', desc: '第二臨調の答申を受けて行政改革を進めるための審議会（3次にわたって置かれた。目安）。' },
  gyokakukaigi: { name: '行政改革会議', posts: ['pm'], years: [1996.9, 1998.5], areas: ['admin'], topic: '中央省庁の再編', desc: '中央省庁の再編などを議論した会議（会長は総理大臣）。最終報告が2001年の省庁再編のもとになった。' },
  energy: { name: (y) => (y >= 2001 ? '総合資源エネルギー調査会' : '総合エネルギー調査会'), posts: ['minister_trade'], years: [1965, INF], areas: ['energy'], topic: 'エネルギー政策', desc: 'エネルギーの需給や政策の方向について審議する。' },
  kankyo: { name: (y) => (y >= 1993 ? '中央環境審議会' : '中央公害対策審議会'), posts: ['minister_env'], years: [1971, INF], areas: ['environment'], topic: '環境の基準と対策', desc: '環境基準や公害・環境対策について答申する。' },
  shukyo: { name: '宗教法人審議会', posts: ['minister_education'], years: [1951.4, INF], areas: ['society'], topic: '宗教法人法の運用', desc: '宗教法人法の運用について意見を述べる。報告徴収・質問権を使う前には、この審議会の意見を聞く（1995年の改正から）。' },
  saichin: { name: '中央最低賃金審議会', posts: ['minister_labor', 'minister_health'], years: [1959, INF], areas: ['labor'], topic: '最低賃金の引き上げの目安', desc: '毎年、地域別最低賃金の改定の目安を答申する。各都道府県の審議会を経て、労働局長が決める。' },
  senkyoseido: { name: '選挙制度審議会', posts: ['pm'], years: [1961, 1992], areas: ['admin'], topic: '選挙制度の改革', desc: '選挙制度について総理大臣に答申する（第8次審議会は1989年から1991年）。' },
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
    pro: ['観光客が増え、地域の商店やホテルがうるおう'], con: ['観光地の混雑やマナーの問題（オーバーツーリズム）'],
  },
  shidoyoryo: {
    name: '学習指導要領の改訂（告示）', kind: '告示', posts: ['minister_education'], basis: '学校教育法施行規則', cooldown: 600, needCouncil: 'chukyoshin',
    desc: '学校で教える内容の基準。中央教育審議会の答申を受けて、文部（科学）大臣が告示する（おおむね10年ごと）。',
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
    name: '上陸許可基準の見直し（法務省令）', kind: '省令', posts: ['minister_justice'], basis: '出入国管理及び難民認定法', cooldown: 240,
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
    name: '最低賃金の引き上げの目安（審議会の答申を受けて）', kind: '審議会の答申 → 労働局長の決定', posts: ['minister_labor', 'minister_health'], basis: '最低賃金法', cooldown: 120, needCouncil: 'saichin',
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
    id: 'tenkan', name: '天環の泉', kana: 'てんかんのいずみ', kind: '新宗教（小規模）', members: 6000, fictional: true, problem: true,
    desc: '1970年代にできたとされる小さな宗教団体（架空）。信仰の内容とは別に、一部の信者の家族から「高額な献金を求められた」という相談が寄せられることがある。',
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
  selfemployed: '小さな店をやっている立場では、', business: '会社を経営する立場では、', farmers: '農業をやっている立場では、', unions: '働く者の立場では、',
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
    pro: ['景気が少しよくなってきた気がする', '{concern}仕事が増えてきた'],
    con: ['物価ばかり上がって、給料が上がらない', '{concern}先行きが不安'],
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
