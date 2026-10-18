// 体制・安全保障コア (REGIME & SECURITY CORE): 自衛隊・防衛・軍事, 震災対応 (fictional disasters with the real
// procedures of each date), 報道の自由度と言論弾圧, 体制 (democracy → emergency → dictatorship → fallen) through a
// constitutional amendment (発議・国民投票) and 緊急事態, the war with FICTIONAL nations, the downfall, and the
// lawful way out (退陣 → trial through the justice core). Scenes and the phone app live in js/world/kiki.js.
//
// ---------------------------------------------------------------- rules (non-negotiable; see the brief)
// - The dictatorship and the war are a fictional 「もしも」 simulation; the game says so whenever they start.
// - Real parties (自由民主党, 民主党 1998-2016) NEVER take an authoritarian step, suppress speech or go to war:
//   when the player (even as PM and party leader) tries one from a real party, the party's organs refuse
//   (総務会/党の機関が了承しない) and the player has to leave it (離党) first. A real coalition partner refuses too
//   and leaves the coalition. The route is open only to the leader of a fictional party.
// - War only against FICTIONAL_NATIONS over a fictional disputed area. No WMD, no choice to attack civilians, no
//   war-crime mechanics, no gore: the human cost is shown as numbers, letters from families, sanctions and the
//   economy. Winning is hard and inglorious; defeat or a popular uprising ends that life (the downfall scene is
//   abstract and non-graphic: distant silhouettes, a crowd, a headline, a short sober narration).
// - 言論弾圧: in a democracy only pressure (with severe backlash); in the dictatorship 統制・検閲・拘束 shown
//   abstractly with international condemnation. No how-to detail anywhere.
// - Disasters are FICTIONAL events (fictional places: ドット湾・北ドット地方…; no real disaster ever happens in
//   the game's timeline); the laws and procedures are real and dated.
// - 自衛隊 is a real organisation: neutral and factual. In a democracy it cannot be ordered into a war of
//   aggression (憲法9条); 防衛出動 needs an armed attack, a cabinet decision and the Diet's approval.
//
// ---------------------------------------------------------------- API (installRegime(Game.prototype); self-installs on import)
// exports: REGIMES, REGIME_INFO, FICTIONAL_NATIONS, DISPUTED_AREA, DISASTER_PLACES, DISASTER_KINDS, REGIME_STEPS,
//   PRESS_ACTIONS, SDF_ORDERS, WAR_ORDERS, DISASTER_ACTIONS, KIKI (scene hooks filled by kiki.js),
//   onRegime(event, fn) → unsubscribe, regimeTick(g), newRegimeState(), installRegime(proto), setRegimeRng(fn)
// g.regime()                → { id, name, since, steps, label, fiction, unrest, intl, sanctions, history[] }
// g.regimeStep(kind, opts)  → { ok, why?, text? }   kinds: REGIME_STEPS (referendum_law, amend_emergency,
//                              declare_emergency, suspend_elections, suspend_diet, ban_opposition, national_army,
//                              lift_emergency, democratize)
// g.regimeSteps()           → [{ id, name, desc, auth, why|null }] (for UIs)
// g.regimeRefusal(kind)     → null | the reason (string) the step / order / action is not possible now
// g.pressFreedom()          → { value 0..100, label, baseline, history: [{ day, v, why }] }
// g.pressAction(kind)       → { ok, why?, text? }   kinds: PRESS_ACTIONS; g.pressActions() → list with why
// g.sdf()                   → status (name, agency, minister, personnel, budget, rules, deployments, lines[])
// g.sdfOrder(kind, opts)    → { ok, why?, text? }   kinds: SDF_ORDERS; g.sdfOrders() → list with why
// g.disaster()              → the current crisis or null; g.disasters() → past ones
// g.disasterAction(id)      → { ok, why?, text? }   ids: DISASTER_ACTIONS; g.disasterActions() → list for the
//                              player's role and the phase, each with why (null = possible)
// g.war()                   → null | war state; g.warOrder(kind, opts) → { ok, why? }; g.warOrders() → list
// g.regimeHold(kind, ...)   → politics.js hook ('election' | 'diet')
// g.regimeNews(n)           → recent lines; g.regimeLabel() → { label, why }; g.regimeRecord() → the life's record
// g.regimeFlush()           → Promise: run the queued scenes now (UIs call it after an action)
// g.startDisaster(opts)     → test / debug: start a fictional disaster now ({ kind, place, tier })
// onRegime events: 'step', 'regime' (from, to), 'press', 'sdf', 'disaster' (phase), 'war', 'fall', 'trial'
// State: g.state.regime (see newRegimeState; old saves get the defaults).
//
// ---------------------------------------------------------------- hooks into other modules (all feature-detected)
// politics.js: g.pol(), g.approval(), onPolitics('shock' | 'poll' | 'enacted' | 'resign' | 'cabinet'), g.proposeBill
//   (国民投票法・補正予算), g.leaveParty, g.triggerShock. politics.js calls g.regimeHold (two small hooks in tickDay).
// govt.js (A1): g.spawnDemo, DEMO_RESPONSES (extended with the dictatorship's responses), g.budget() (防衛).
// ideology.js (B): classifyRegime(features) for the news labels (else our own labels).
// crime.js: CRIMES (+ 'abuse_power', registered here), g.arrest (the trial after stepping down).
//
// ---------------------------------------------------------------- facts (checked with web searches, 2026-10)
// - 自衛隊: 1954年発足。防衛庁は2007年1月9日に防衛省へ移行（内閣府の外局から独立した省。文民統制に変わりはない）。
//   sources: nippon.com 今日は何の日 0109, imidas C-40-014-07-11-G053, NDL典拠
// - 防衛費: 1976年の閣議決定でGNP比1%以内（いわゆる1%枠）。1987年度予算でGNP比1.004%と初めて1%を超え、
//   1987年1月24日の閣議決定「今後の防衛力整備について」で中期防の所要経費（総額）の枠内で整備する方式へ
//   （いわゆる総額明示方式）。1993年度からGDP比で示す。2022年12月16日の安保3文書（国家安全保障戦略・
//   国家防衛戦略・防衛力整備計画）: 2023〜2027年度の5年間で約43兆円、2027年度に関連経費と合わせてGDP比2%。
//   2026年度の防衛関係費は9兆353億円（SACO・米軍再編経費を含む）。当初予算: 2004年度 約4.88兆円、
//   1997年度 約4.94兆円（防衛白書の推移表）。1987年度は約3.5兆円（目安: GNP比1.004%から）、1996年度は目安。
//   sources: csmonitor.com 1986/12/31・1987/03/05, nippon.com japan-data h02457, shugiin.go.jp 質問答弁 b108044,
//   mod.go.jp 防衛白書 zuhyo02020402.csv, mof.go.jp 令和8年度防衛関係予算, imidas C-40-156-23-03-G917
// - 自衛官の定数: 1999年改正 26万5,737人 → 2000年 26万2,073人 → 2002年 25万8,290人 → いまは24万7,154人
//   （2025年3月末の現員 22万252人）。1980年代・1990年代半ばの数字は 目安（約27万人）。
//   sources: shugiin.go.jp 安全保障委員会の動き（h11/h12/h14）, mod.go.jp 自衛官の定員及び現員
// - 自衛隊法: 76条 防衛出動（内閣総理大臣が命じる。閣議決定と国会の承認＝原則事前。武力攻撃事態等）、
//   82条 海上警備行動（防衛大臣が内閣総理大臣の承認を得て命じる）、83条 災害派遣（都道府県知事・海上保安庁
//   長官・管区海上保安本部長・空港事務所長の要請により防衛大臣等が派遣。特に緊急で要請を待つ時間がないときは
//   自主派遣）、84条 対領空侵犯措置（スクランブル）。防衛出動はこれまで一度も命じられていない。
//   sources: mod.go.jp 防衛白書 資料, kotobank 自衛隊法, pref.mie.lg.jp / pref.shizuoka.jp 災害派遣要請
// - PKO協力法（国際平和協力法）: 1992年6月15日成立、8月10日施行。同年9月からカンボジア（UNTAC）に施設部隊。
//   参加5原則（停戦合意・受入れ同意・中立・撤収・必要最小限の武器使用）。2015年9月 平和安全法制。
//   sources: cao.go.jp/pko（pko25th 年表・other_data04）, nippon.com today0810
// - 災害対策基本法 1961年（緊急災害対策本部 28条の2・非常災害対策本部 24条・災害緊急事態の布告 105条）。
//   緊急災害対策本部（本部長 内閣総理大臣）は2011年3月11日に初めて設置。非常災害対策本部の本部長は
//   2021年5月20日施行の改正で国務大臣から内閣総理大臣に（あわせて特定災害対策本部＝本部長 防災担当大臣）。
//   災害救助法 1947年（都道府県知事が適用）。激甚災害法 1962年（激甚災害は政令で指定＝閣議決定。復旧事業の
//   国庫補助をかさ上げ。本激と局激）。被災者生活再建支援法 1998年5月成立・11月施行（最高100万円 → 2004年・
//   2007年の改正で最高300万円）。内閣府（防災担当）2001年1月（それまでは国土庁防災局・国土庁長官）。
//   内閣危機管理監 1998年4月、官邸危機管理センター 2002年4月。復興庁 2012年2月10日（東日本大震災の復興のため）。
//   緊急地震速報: 2007年10月1日から一般向け（テレビ・ラジオ）、2007年12月10日から携帯電話（エリアメール）。
//   sources: bousai.go.jp（防災白書 h13/h24・災対法改正 r3）, sn-hoki.co.jp 法令改正情報, mhlw.go.jp,
//   kotobank 激甚災害, seijiyama.jp 激甚災害, jma.go.jp 緊急地震速報の沿革, ascii.jp (ドコモ 2007/12/10),
//   imidas F-118-0029 / kobe-np 被災者生活再建支援法, darkside.js（内閣危機管理監・危機管理センター）
// - 憲法96条: 各議院の総議員の3分の2以上の賛成で国会が発議し、国民投票の過半数の賛成で承認。国民投票法
//   （日本国憲法の改正手続に関する法律）: 2007年5月14日成立・5月18日公布、2010年5月18日施行。国民投票は
//   発議から60日以後180日以内（2条）。投票権は2018年6月から18歳以上。
//   sources: kotobank 国民投票法, japaneseclass/朝日 2007, allabout.co.jp, city.itabashi.tokyo.jp
// - 情報公開法（行政機関の保有する情報の公開に関する法律）: 1999年成立、2001年4月1日施行。放送法4条（政治的
//   公平）・電波法76条（無線局の運用停止）。憲法21条（表現の自由・検閲の禁止）。
// - 公務員職権濫用罪（刑法193条）: 2年以下の懲役又は禁錮（2025年6月から拘禁刑）。
// Fictional (checked that no real country/place has these names): ネヴァロン共和国, ルーゼニア王国, ケルドア連邦,
//   ヴェルミナ諸島; every disaster place (ドット湾北部・北ドット地方・南ドット地方・西ドット地方・ドット岳), every
//   disaster, every NPC, every war, every regime event. The game's dictatorship is a 「もしも」 simulation.

import { Game } from './game.js';
import { onMorning } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { RELATIONS, sortFamily } from './profile.js';

// ======================================================================== optional modules (guarded, literal paths)
let POL = null; // politics.js
let CRIME = null; // crime.js
let GOVT = null; // govt.js (A1)
let IDEO = null; // ideology.js (B)
import('./politics.js').then((m) => { POL = m; hookPolitics(); }).catch(() => { POL = null; });
import('./crime.js').then((m) => { CRIME = m; registerCrime(); }).catch(() => { CRIME = null; });
// govt.js / ideology.js are loaded through the registry (they may not exist): import them only when listed
import('../registry.js').then((reg) => {
  const list = (reg && reg.MODULES) || [];
  if (list.includes('./engine/govt.js')) import('./govt.js').then((m) => { GOVT = m; extendDemoResponses(); }).catch(() => { GOVT = null; });
  if (list.includes('./engine/ideology.js')) import('./ideology.js').then((m) => { IDEO = m; }).catch(() => { IDEO = null; });
}).catch(() => {});

// ======================================================================== small helpers
let RNG = Math.random;
export function setRegimeRng(fn) { RNG = typeof fn === 'function' ? fn : Math.random; }
const rnd = () => RNG();
const roll = (p) => rnd() < p;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
const n0 = (n) => Math.max(0, Math.round(num(n))).toLocaleString('ja-JP');
const today = (g) => (g && g.state && g.state.day) || 1;
const MONTH_DAYS = 10;
const YEAR_DAYS = 120;
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
const eraOf = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
// The simulated date (politics core when present, else the same calendar: April of the era's start year).
function dateOf(g, day) {
  if (g && typeof g.gameDate === 'function') {
    try { const d = day == null ? g.gameDate() : g.gameDate(day); if (d && Number.isFinite(d.year)) return { year: d.year, month: clamp(Math.round(d.month || 1), 1, 12), fy: num(d.fy, d.year) }; } catch (e) { /* fall back */ }
  }
  const n = Math.max(0, num(day ?? today(g), 1) - 1);
  const idx = 3 + Math.floor(n / MONTH_DAYS);
  const year = (ERA_BASE[eraOf(g)] ?? 2026) + Math.floor(idx / 12);
  return { year, month: (idx % 12) + 1, fy: year + (idx % 12) / 12 };
}
const ymOf = (g, day) => { const d = dateOf(g, day); return d.year * 100 + d.month; };
const since = (g, y, m = 1) => ymOf(g) >= y * 100 + m;
const yearOf = (g) => dateOf(g).year;
const dateText = (g, day) => { const d = dateOf(g, day); return `${d.year}年${d.month}月`; };
function laborWord(g) { return since(g, 2025, 6) ? '拘禁刑' : '懲役又は禁錮'; }

// ======================================================================== registries
export const REGIMES = Object.freeze(['democracy', 'emergency', 'dictatorship', 'fallen']);
export const REGIME_INFO = {
  democracy: { name: '民主制', long: '議会制民主主義（日本国憲法のもと）', color: '#5fd7ff' },
  emergency: { name: '緊急事態体制', long: '緊急事態宣言のもとの体制（もしもシミュレーション）', color: '#ffd23f' },
  dictatorship: { name: '独裁体制', long: '選挙と国会が止められた独裁体制（もしもシミュレーション）', color: '#ff5d6c' },
  fallen: { name: '体制崩壊', long: '独裁体制が崩れた（もしもシミュレーション）', color: '#9aa3c7' },
};
export const FICTION_NOTE = 'これは架空の「もしも」のシミュレーションです。実在の政党・人物・国とは関係ありません。';

// FICTIONAL nations and the fictional disputed area (names checked: no real country or place).
export const FICTIONAL_NATIONS = {
  nevalon: { id: 'nevalon', name: 'ネヴァロン共和国', short: 'ネヴァロン', power: 62, people: 4200, desc: '（架空の国）西の海をへだてた共和国。ヴェルミナ諸島の領有を主張している。', fictional: true },
  luzenia: { id: 'luzenia', name: 'ルーゼニア王国', short: 'ルーゼニア', power: 48, people: 2600, desc: '（架空の国）南の海の島国。漁業と海運の国で、ヴェルミナ諸島の近くに漁場をもつ。', fictional: true },
  keldoa: { id: 'keldoa', name: 'ケルドア連邦', short: 'ケルドア', power: 90, people: 9800, desc: '（架空の国）北の大陸の大きな連邦国家。軍用機の飛来がときどき報じられる。', fictional: true },
};
export const NATION_ORDER = Object.keys(FICTIONAL_NATIONS);
export const DISPUTED_AREA = { id: 'vermina', name: 'ヴェルミナ諸島', desc: '（架空の係争地）無人の小さな島々。周辺の海の資源をめぐって、複数の国が領有を主張している。', fictional: true };

// FICTIONAL disaster places. home: the player's town (ドット区, 東京都) is hit — work stops, the 知事 (東京都) requests
// the SDF, the 区長・区議 run the 避難所.
export const DISASTER_PLACES = {
  dotwan: { id: 'dotwan', name: 'ドット湾北部', area: '東京都ドット区とその周辺', home: true, coast: true },
  kita: { id: 'kita', name: '北ドット地方', area: '北ドット地方（架空の地域）', home: false, coast: true },
  minami: { id: 'minami', name: '南ドット地方', area: '南ドット地方の沿岸（架空の地域）', home: false, coast: true },
  nishi: { id: 'nishi', name: '西ドット地方', area: '西ドット地方の山あい（架空の地域）', home: false, coast: false },
  dakesan: { id: 'dakesan', name: 'ドット岳', area: 'ドット岳（架空の火山）のふもと', home: false, coast: false },
};
export const DISASTER_KINDS = {
  quake: { name: '地震', label: (pl) => `${pl.name}地震`, places: ['dotwan', 'kita', 'nishi', 'minami'], art: 'quake' },
  tsunami: { name: '地震・津波', label: (pl) => `${pl.name}沖地震`, places: ['kita', 'minami'], art: 'tsunami' },
  storm: { name: '台風・豪雨', label: (pl, g) => `${pl.name}の豪雨災害`, places: ['dotwan', 'kita', 'nishi', 'minami'], art: 'storm' },
  volcano: { name: '火山の噴火', label: () => 'ドット岳の噴火', places: ['dakesan'], art: 'volcano' },
};
const TIER_NAME = { 1: '局地的な災害', 2: '大規模災害', 3: '甚大な災害' };

// ======================================================================== state
export function newRegimeState() {
  return {
    v: 1,
    id: 'democracy', since: 1, history: [],
    steps: { clause: false, clauseDay: 0, emergency: false, elections: false, diet: false, opposition: false, army: false, censor: false, courtIgnored: false },
    amend: null, // { stage: 'referendum'|'passed'|'rejected'|'failed', day, voteDay, result }
    unrest: 0, intl: 0, sanctions: 0, approvalMod: 0, defected: 0, pressedDay: 0,
    press: { value: -1, offset: 0, history: [], detained: 0, actions: {}, bill: null },
    sdf: { deployments: [], scrambles: 0, scrambleYear: 0, kaijo: null, pkoOffer: null, pkoLaw: 0, haken: null, orders: [], quit: 0 },
    disaster: null, disasters: [], cancelUntil: 0, lastDisasterDay: -999,
    war: null, wars: [],
    courts: [], // pending rulings { id, day, step, text }
    queue: [], // scenes waiting for a free moment { id, day, data }
    news: [],
    record: { maxRegime: 'democracy', steps: [], wars: 0, soldiers: 0, civilians: 0, enemy: 0, detained: 0, disasters: 0, firstPM: 0 },
    fall: null, trial: null, fictionShown: false, flags: {},
  };
}
function R(g) {
  const st = g.state;
  if (!st) return newRegimeState();
  let r = st.regime;
  if (!r || typeof r !== 'object' || Array.isArray(r)) r = st.regime = newRegimeState();
  if (!r._ok) {
    const b = newRegimeState();
    for (const k of Object.keys(b)) if (r[k] === undefined) r[k] = b[k];
    for (const k of ['steps', 'press', 'sdf', 'record', 'flags']) r[k] = { ...b[k], ...(r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) ? r[k] : {}) };
    for (const k of ['history', 'disasters', 'wars', 'courts', 'queue', 'news']) if (!Array.isArray(r[k])) r[k] = [];
    for (const k of ['history', 'actions']) if (k === 'history' ? !Array.isArray(r.press.history) : (!r.press.actions || typeof r.press.actions !== 'object')) r.press[k] = k === 'history' ? [] : {};
    for (const k of ['deployments', 'orders']) if (!Array.isArray(r.sdf[k])) r.sdf[k] = [];
    if (!Array.isArray(r.record.steps)) r.record.steps = [];
    if (!REGIMES.includes(r.id)) r.id = 'democracy';
    for (const k of ['unrest', 'intl', 'sanctions', 'approvalMod', 'defected', 'cancelUntil']) r[k] = num(r[k]);
    r.queue = r.queue.filter((q) => q && typeof q === 'object' && typeof q.id === 'string');
    if (r.disaster && (typeof r.disaster !== 'object' || !DISASTER_KINDS[r.disaster.kind])) r.disaster = null;
    if (r.war && (typeof r.war !== 'object' || !FICTIONAL_NATIONS[r.war.enemy])) r.war = null;
    Object.defineProperty(r, '_ok', { value: true, enumerable: false, configurable: true });
  }
  return r;
}

// ======================================================================== events, news, messages
const HOOKS = {};
export function onRegime(event, fn) {
  (HOOKS[event] || (HOOKS[event] = [])).push(fn);
  return () => { HOOKS[event] = (HOOKS[event] || []).filter((f) => f !== fn); };
}
function emit(g, event, data) {
  for (const fn of HOOKS[event] || []) { try { fn(g, data); } catch (e) { console.error(e); } }
}
function news(g, text, opts = {}) {
  const r = R(g);
  r.news.unshift({ day: today(g), text });
  if (r.news.length > 80) r.news.length = 80;
  // the politics feed shows it too (the 政治 app / console read p.news)
  const p = pol(g);
  if (p && Array.isArray(p.news) && opts.feed !== false) { p.news.unshift({ day: today(g), text, kind: opts.kind || 'regime' }); if (p.news.length > 80) p.news.length = 80; }
}
function phone(g, text, from = 'ドット新聞') {
  try { if (typeof g.message === 'function') g.message({ from, text, kind: 'news' }); } catch (e) { /* no phone in some tests */ }
}
function note(g, text) { (g.morningNotes || (g.morningNotes = [])).push(text); }
// One of the player's family (alive), for a worried message.
function familyMember(g) {
  try {
    const st = g.state;
    const fam = sortFamily((st.profile.family || []).filter((m) => m && m.alive !== false && RELATIONS[m.rel]));
    return fam.find((x) => x.rel === 'mother') || fam.find((x) => x.rel === 'father') || fam[0] || null;
  } catch (e) { return null; }
}
function familyMessage(g, text) {
  const m = familyMember(g);
  if (!m) return;
  try { g.message({ from: m.name || RELATIONS[m.rel].call, family: m.id, kind: 'chat', text: g.fmt ? g.fmt(text) : text }); } catch (e) { /* ignore */ }
}

// ======================================================================== politics helpers
function pol(g) {
  try { if (g && typeof g.pol === 'function' && g.state) return g.pol(); } catch (e) { console.error(e); }
  return null;
}
function meOf(g) { const p = pol(g); return p ? p.me : null; }
const hasPost = (g, post) => { const me = meOf(g); return !!(me && Array.isArray(me.posts) && me.posts.includes(post)); };
const isPM = (g) => hasPost(g, 'pm');
const isDefMin = (g) => hasPost(g, 'minister_defense');
const isFinMin = (g) => hasPost(g, 'minister_finance');
function inCabinet(g) {
  const me = meOf(g);
  if (!me || !Array.isArray(me.posts)) return false;
  const P = POL && POL.POSTS;
  return me.posts.some((x) => (P ? P[x] && P[x].kind === 'cabinet' : x === 'pm' || /^minister_|^kanbo$/.test(x)));
}
const isNational = (g) => { const me = meOf(g); return !!(me && (me.office === 'shugi' || me.office === 'sangi')); };
function postName(g, post) {
  try { if (POL && POL.postName) return POL.postName(post, dateOf(g).fy); } catch (e) { /* fall back */ }
  return { pm: '内閣総理大臣', minister_defense: since(g, 2007, 1) ? '防衛大臣' : '防衛庁長官', minister_finance: since(g, 2001, 1) ? '財務大臣' : '大蔵大臣' }[post] || post;
}
// The player's party: { id, pt, real, own, name }
function partyOf(g) {
  const p = pol(g), me = p && p.me;
  if (!me || !me.party) return null;
  const pt = p.parties && p.parties[me.party];
  const def = POL && POL.PARTY_DEFS && POL.PARTY_DEFS[me.party];
  return { id: me.party, pt, real: !!((pt && pt.real) || (def && def.real)), own: !!(pt && pt.isPlayers), leader: !!(pt && pt.leader === 'player'), name: (pt && pt.name) || (def && def.name) || '所属政党' };
}
function isRealParty(p, id) {
  const pt = p && p.parties && p.parties[id];
  const def = POL && POL.PARTY_DEFS && POL.PARTY_DEFS[id];
  return !!((pt && pt.real) || (def && def.real));
}
function partyName(p, id) { const pt = p && p.parties && p.parties[id]; return (pt && pt.name) || (POL && POL.PARTY_DEFS && POL.PARTY_DEFS[id] && POL.PARTY_DEFS[id].name) || id; }
// Cabinet approval: an immediate change (and a lasting modifier read by the weekly poll hook).
function bumpApproval(g, d, lasting = 0) {
  const p = pol(g);
  const r = R(g);
  if (lasting) r.approvalMod = clamp(r.approvalMod + lasting, -40, 15);
  if (!p || !p.cabinet) return;
  p.cabinet.approval = clamp(num(p.cabinet.approval, 40) + d, 3, 90);
}
const approvalOf = (g) => { const p = pol(g); return p && p.cabinet ? num(p.cabinet.approval, 40) : 40; };
// Members of the player's party leave over a step (造反・離党). Seats move to 無所属.
function defect(g, share, why) {
  const p = pol(g), pi = partyOf(g);
  if (!p || !pi || !p.diet) return 0;
  let total = 0;
  for (const house of ['shugi', 'sangi']) {
    const H = p.diet[house];
    if (!H || !H.seats) continue;
    const have = num(H.seats[pi.id]) - (meOf(g).office === house ? 1 : 0);
    const n = Math.min(Math.max(0, have), Math.round(have * share));
    if (n <= 0) continue;
    H.seats[pi.id] = num(H.seats[pi.id]) - n;
    H.seats.ind = num(H.seats.ind) + n;
    total += n;
  }
  if (total) {
    R(g).defected += total;
    news(g, `${pi.name}の国会議員${total}人が「${why}」に反対して党を離れた（造反）`);
  }
  return total;
}
// Seats that would vote for an authoritarian amendment in one house (the player's party minus 造反; fictional
// coalition partners in part; a real party never).
function amendVotes(g, house, opts = {}) {
  const p = pol(g), pi = partyOf(g);
  const H = p && p.diet && p.diet[house];
  if (!H || !pi) return { yes: 0, total: num(H && H.total, 1), need: Math.ceil(num(H && H.total, 1) * 2 / 3) };
  const total = num(H.total) || Object.values(H.seats).reduce((a, v) => a + num(v), 0);
  const loyal = pi.own ? 0.97 : 0.85;
  const appr = approvalOf(g);
  const loyalty = clamp(loyal - (appr < 35 ? (35 - appr) / 200 : 0), 0.6, 0.99);
  let yes = num(H.seats[pi.id]) * (opts.expected ? loyalty : 1);
  for (const id of (p.cabinet && p.cabinet.partyIds) || []) if (id !== pi.id && !isRealParty(p, id)) yes += num(H.seats[id]) * 0.5;
  yes += num(H.seats.ind) * 0.1;
  if (!opts.expected) {
    // the real vote: each member decides (造反 by approval and loyalty)
    const own = num(H.seats[pi.id]);
    let y = 0;
    for (let i = 0; i < own; i++) if (rnd() < loyalty) y++;
    yes = y;
    for (const id of (p.cabinet && p.cabinet.partyIds) || []) if (id !== pi.id && !isRealParty(p, id)) yes += Math.round(num(H.seats[id]) * (0.35 + rnd() * 0.3));
    yes += Math.round(num(H.seats.ind) * rnd() * 0.2);
  }
  return { yes: Math.round(yes), total, need: Math.ceil(total * 2 / 3) };
}
const inSession = (g) => { const p = pol(g); const S = p && p.diet && p.diet.session; return !!(S && today(g) >= num(S.start) && today(g) <= num(S.end)); };
// Laws in force (politics core): an era's inForce or a law passed in the game.
function lawInForce(g, id) {
  const p = pol(g);
  if (!p) return false;
  if (p.flags && p.flags.inForce && p.flags.inForce[id]) return true;
  if (Array.isArray(p.laws) && p.laws.some((L) => L && L.policy === id)) return true;
  return !!R(g).flags['law_' + id];
}
// 国民投票法: in force from 2010-05-18 (or passed in the game: politics flags.referendumLaw)
function referendumLawOk(g) {
  const p = pol(g);
  return since(g, 2010, 5) || !!(p && p.flags && p.flags.referendumLaw);
}

// ======================================================================== classification (news labels)
function features(g) {
  const r = R(g);
  return {
    regime: r.id, elections: r.steps.elections, diet: r.steps.diet, opposition: r.steps.opposition, army: r.steps.army,
    censorship: r.steps.censor, detentions: r.press.detained > 0, war: !!(r.war && r.war.phase === 'war'), press: pressValue(g),
    emergency: r.steps.emergency, courtIgnored: r.steps.courtIgnored,
  };
}
export function regimeLabel(g) {
  const f = features(g);
  if (IDEO && typeof IDEO.classifyRegime === 'function') {
    try {
      const c = IDEO.classifyRegime(f);
      const label = typeof c === 'string' ? c : c && (c.label || c.name);
      if (label) return { label, why: (c && c.why) || '', source: 'ideology' };
    } catch (e) { console.error(e); }
  }
  if (f.regime === 'fallen') return { label: '体制崩壊', why: '独裁体制が崩れた' };
  if (f.opposition && f.army && (f.censorship || f.detentions) && f.elections) return { label: 'ファシズム的', why: '一党支配・軍事化・言論統制が重なっている' };
  if (f.regime === 'dictatorship' || (f.elections && (f.censorship || f.diet))) return { label: '権威主義的', why: '選挙や国会が止まり、権力が一人に集まっている' };
  if (f.regime === 'emergency') return { label: '緊急事態体制', why: '緊急事態宣言のもとで、政府の権限が強まっている' };
  if (f.press < 50) return { label: '民主制（報道の自由に懸念）', why: '報道への圧力が続いている' };
  return { label: '民主制', why: '選挙・国会・裁判所・報道が機能している' };
}

// ======================================================================== the real-party rule
// A real party (自民・民主) never takes an authoritarian step: its organs refuse. Returns the reason or null.
function realPartyRefusal(g, what) {
  const pi = partyOf(g);
  if (!pi || !pi.real) return null;
  const who = pi.id === 'jimin' ? `${pi.name}の総務会は` : `${pi.name}は党の機関で`;
  return `${who}「${what}」を了承しなかった。党の機関の了承がなければ進められない。（このルートは架空の政党の党首だけが選べる。進めるなら、まず離党する）`;
}
// A real coalition partner leaves the coalition rather than take part (a neutral, lawful act).
function realPartnersLeave(g, what) {
  const p = pol(g);
  if (!p || !p.cabinet || !Array.isArray(p.cabinet.partyIds)) return [];
  const gone = p.cabinet.partyIds.filter((id) => isRealParty(p, id) && id !== (meOf(g) || {}).party);
  if (!gone.length) return [];
  p.cabinet.partyIds = p.cabinet.partyIds.filter((id) => !gone.includes(id));
  for (const [post, who] of Object.entries(p.cabinet.ministers || {})) {
    const n = p.npcs && p.npcs[who];
    if (n && gone.includes(n.party)) { n.posts = (n.posts || []).filter((x) => x !== post); delete p.cabinet.ministers[post]; }
  }
  for (const id of gone) news(g, `${partyName(p, id)}は「${what}」に同意せず、連立政権から離脱した`);
  return gone;
}

// ======================================================================== consequences of a step
// size 1..3: backlash. Every authoritarian step: 支持率, デモ, 国際社会, 造反, 民衆の不満.
function backlash(g, step, size, opts = {}) {
  const r = R(g);
  const demo = r.id === 'democracy';
  bumpApproval(g, -(3 + size * 3) * (demo ? 1 : 0.6), -(1 + size * 1.5));
  r.unrest = clamp(r.unrest + size * (demo ? 4 : 7) + (opts.unrest || 0), 0, 100);
  raiseIntl(g, size * (demo ? 4 : 8) + (opts.intl || 0), step);
  if (opts.defect !== false && r.id !== 'dictatorship') defect(g, (partyOf(g) && partyOf(g).own ? 0.02 : 0.05) * size, step);
  spawnDemo(g, { cause: step, size: size >= 3 ? 'large' : size === 2 ? 'medium' : 'small', against: 'government' });
  r.record.steps.push({ day: today(g), step });
}
function raiseIntl(g, d, why) {
  const r = R(g);
  const before = r.intl;
  r.intl = clamp(r.intl + d, 0, 100);
  const levels = [[25, '各国が日本の政府の動きに「深い懸念」を表明した'], [50, '各国が政府関係者の資産凍結や輸出規制などの制裁を発表した'], [75, '主要国が全面的な経済制裁に踏み切った。日本は国際社会で孤立しつつある']];
  for (const [lv, text] of levels) {
    if (before < lv && r.intl >= lv) {
      r.sanctions = Math.max(r.sanctions, lv >= 75 ? 3 : lv >= 50 ? 2 : 1);
      news(g, `【国際社会】${text}${why ? `（${why}）` : ''}`);
      phone(g, `【国際ニュース】${text}。`, 'ドット新聞 国際部');
      if (lv >= 50) ecoShock(g, `国際社会の制裁（段階${r.sanctions}）`, { growth: lv >= 75 ? -2.5 : -1.2, inflation: lv >= 75 ? 1.5 : 0.6, yen: lv >= 75 ? 20 : 8, len: 240 });
    }
  }
}
// An economic shock in the politics core (same shape as its SHOCKS entries).
function ecoShock(g, name, s) {
  const p = pol(g);
  if (!p || !p.economy || !Array.isArray(p.economy.shocks)) return;
  const d = today(g);
  const abs = d - 1 + ((p.cal ? p.cal.month : 4) - 1) * MONTH_DAYS;
  p.economy.shocks.push({ kind: 'regime', name, until: abs + num(s.len, 120), len: num(s.len, 120), growth: num(s.growth), inflation: num(s.inflation), unemployment: num(s.unemployment), yen: num(s.yen) });
  if (s.nikkei && p.economy.nikkei) p.economy.nikkei *= 1 + s.nikkei / 100;
}
// A demonstration: govt.js (A1) when present, else a news line and a little unrest.
function spawnDemo(g, o) {
  try {
    if (typeof g.spawnDemo === 'function') { g.spawnDemo({ cause: o.cause, size: o.size, segment: o.segment || 'floating', against: o.against || 'government' }); return; }
  } catch (e) { console.error(e); }
  const size = { small: '数千人', medium: '数万人', large: '数十万人' }[o.size] || '多くの人';
  news(g, `「${o.cause}」に反対するデモ。全国で${size}が集まった`);
}

// ======================================================================== regime changes
function setRegime(g, id, why) {
  const r = R(g);
  if (r.id === id) return;
  const from = r.id;
  r.id = id;
  r.since = today(g);
  r.history.push({ day: today(g), from, to: id, why: why || '' });
  if (r.history.length > 40) r.history.splice(0, r.history.length - 40);
  const order = { democracy: 0, emergency: 1, dictatorship: 2, fallen: 3 };
  if (order[id] > order[r.record.maxRegime] && id !== 'fallen') r.record.maxRegime = id;
  const lab = regimeLabel(g);
  if (id === 'dictatorship') {
    news(g, `【もしも】選挙も国会も止まった。海外メディアは日本の体制を「${lab.label}」と報じている`);
    phone(g, `【もしもシミュレーション】\n選挙と国会が止められ、${g.state.name}政権は事実上の独裁体制になった。\n海外メディアは「${lab.label}」と報じている。`);
    queueScene(g, 'regime_change', { to: id, from });
  } else if (id === 'emergency') {
    queueScene(g, 'regime_change', { to: id, from });
  } else if (id === 'democracy' && from !== 'democracy') {
    news(g, '選挙と国会が再開され、憲法にもとづく民主制が戻った');
    phone(g, '【ニュース】選挙と国会が再開され、民主制が戻った。');
  }
  emit(g, 'regime', { from, to: id, why });
}
function fictionNotice(g) {
  const r = R(g);
  if (r.fictionShown) return;
  r.fictionShown = true;
  note(g, `（${FICTION_NOTE}）`);
}

// ======================================================================== regime steps
const AUTH = (name) => name;
function needPM(g) {
  if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  if (!isPM(g)) return '内閣総理大臣でなければできない';
  return null;
}
function needFictionalLeader(g, what) {
  const real = realPartyRefusal(g, what);
  if (real) return real;
  const pi = partyOf(g);
  if (!pi) return '無所属の総理には、これを進める党の組織がない（架空の政党の党首として進める）';
  if (!pi.leader) return `${pi.name}の党首でなければ進められない`;
  return null;
}
export const REGIME_STEPS = {
  referendum_law: {
    name: '国民投票法の制定', auth: false,
    desc: '憲法改正の国民投票の手続きを定める法律（現実には2007年5月成立・2010年5月施行）。改正の発議の前に必要。',
    check(g) {
      if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
      if (referendumLawOk(g)) return since(g, 2010, 5) ? 'すでに施行されている（2010年5月施行）' : 'すでに制定されている';
      if (!isNational(g) && !inCabinet(g)) return '法律案を出せるのは国会議員か内閣だけ';
      return null;
    },
    run(g) {
      if (typeof g.proposeBill !== 'function') return { ok: false, why: '法案の仕組みがない' };
      const id = g.proposeBill({ policy: 'referendum_law' });
      if (!id) return { ok: false, why: g.lastPoliticsError || '法案を出せなかった' };
      return { ok: true, text: '国民投票法案を出した。国会で成立すれば、憲法改正の手続きが整う。', bill: id };
    },
  },
  amend_emergency: {
    name: '緊急事態条項（強権型）の発議', auth: true, regimes: ['democracy'],
    desc: '非常時に内閣が法律と同じ効力の政令を出し、選挙の延期や国会の閉会もできる条文を憲法に加える改正案（架空の強権型）。各院の総議員の3分の2で発議し、国民投票へ。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '緊急事態条項（強権型）の発議');
      if (w) return w;
      if (r.steps.clause) return 'すでに憲法に加えられている';
      if (r.amend && r.amend.stage === 'referendum') return 'すでに発議され、国民投票を待っている';
      if (!referendumLawOk(g)) return since(g, 2007, 5) ? '国民投票法がまだ施行されていない（2010年5月施行）' : '国民投票の手続きを定める法律（国民投票法）がまだない。先に国民投票法を制定する';
      if (!inSession(g)) return '国会が開かれていない（発議は会期中に、両院の本会議で採決する）';
      return null;
    },
    run(g) {
      const r = R(g);
      fictionNotice(g);
      realPartnersLeave(g, '緊急事態条項（強権型）');
      const s = amendVotes(g, 'shugi'), a = amendVotes(g, 'sangi');
      const ok = s.yes >= s.need && a.yes >= a.need;
      const line = `衆議院 賛成${s.yes}／必要${s.need}（総議員${s.total}）・参議院 賛成${a.yes}／必要${a.need}（総議員${a.total}）`;
      backlash(g, '緊急事態条項の発議', 2);
      if (!ok) {
        r.amend = { stage: 'failed', day: today(g), votes: { s, a } };
        news(g, `強権型の緊急事態条項の改正原案は、3分の2に届かず発議されなかった（${line}）`);
        return { ok: true, passed: false, text: `3分の2に届かず、発議できなかった。\n${line}` };
      }
      const wait = rint(20, 60); // 発議から60日以後180日以内（1日≈3日）
      r.amend = { stage: 'referendum', day: today(g), voteDay: today(g) + wait, votes: { s, a } };
      news(g, `強権型の緊急事態条項が両院の3分の2で発議された。${dateText(g, today(g) + wait)}に国民投票（${line}）`);
      phone(g, `【憲法改正の発議】\n緊急事態条項（強権型）の改正案が発議された。\n国民投票は${dateText(g, today(g) + wait)}。`);
      return { ok: true, passed: true, text: `発議された！ 国民投票は${dateText(g, today(g) + wait)}。\n${line}` };
    },
  },
  declare_emergency: {
    name: '緊急事態宣言', auth: true, regimes: ['democracy'],
    desc: '改正した憲法の緊急事態条項にもとづき、全国に緊急事態を宣言する。内閣の権限が大きく強まる。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '緊急事態宣言');
      if (w) return w;
      if (!r.steps.clause) return '憲法に緊急事態条項がない。いまの法律の緊急事態（災害緊急事態の布告など）は災害のときだけで、選挙や国会を止める力はない';
      return null;
    },
    run(g) {
      const r = R(g);
      fictionNotice(g);
      realPartnersLeave(g, '緊急事態宣言');
      r.steps.emergency = true;
      setRegime(g, 'emergency', '緊急事態宣言');
      backlash(g, '緊急事態宣言', 2);
      press(g, -6, '緊急事態宣言');
      news(g, `【もしも】${g.state.name}総理が全国に緊急事態を宣言した`);
      phone(g, `【緊急事態宣言】\n${g.state.name}総理が全国に緊急事態を宣言した。\n（${FICTION_NOTE}）`);
      return { ok: true, text: '全国に緊急事態を宣言した。' };
    },
  },
  suspend_elections: {
    name: '選挙の停止', auth: true, regimes: ['emergency', 'dictatorship'],
    desc: '緊急事態を理由に、すべての選挙を無期限に延期する。議員や首長の任期はそのまま延びる。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '選挙の停止');
      if (w) return w;
      if (r.id === 'democracy') return '民主制のもとでは選挙を止められない（憲法15条・47条。任期は憲法と法律で決まっている）';
      if (r.steps.elections) return 'すでに選挙は止められている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.elections = true;
      backlash(g, '選挙の停止', 3);
      press(g, -4, '選挙の停止');
      news(g, '【もしも】政府は、緊急事態を理由にすべての選挙を無期限に延期した');
      courtChallenge(g, 'suspend_elections', '選挙の無期限延期');
      afterStep(g);
      return { ok: true, text: 'すべての選挙を無期限に延期した。' };
    },
  },
  suspend_diet: {
    name: '国会の停止', auth: true, regimes: ['emergency', 'dictatorship'],
    desc: '国会を閉じ、法律に代わる政令で国を動かす。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '国会の停止');
      if (w) return w;
      if (r.id === 'democracy') return '民主制のもとでは国会を止められない（国会は国権の最高機関：憲法41条）';
      if (r.steps.diet) return 'すでに国会は止められている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.diet = true;
      const p = pol(g);
      if (p && p.diet && p.diet.session) { p.diet.session.end = today(g) - 1; p.diet.session.extended = true; }
      backlash(g, '国会の停止', 3);
      news(g, '【もしも】国会が閉じられ、政府は政令で国を動かしはじめた');
      courtChallenge(g, 'suspend_diet', '国会の停止');
      afterStep(g);
      return { ok: true, text: '国会を止めた。これからは政令で国を動かす。' };
    },
  },
  ban_opposition: {
    name: '野党の禁止', auth: true, regimes: ['emergency', 'dictatorship'],
    desc: '与党以外の政党の活動を禁止する。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '野党の禁止');
      if (w) return w;
      if (r.id === 'democracy') return '民主制のもとでは政党の活動を禁止できない（結社の自由：憲法21条）';
      if (r.steps.opposition) return 'すでに野党は禁止されている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.opposition = true;
      backlash(g, '野党の禁止', 3, { intl: 6 });
      press(g, -6, '野党の禁止');
      news(g, `【もしも】政府は野党の活動を禁止した。海外メディアは「${regimeLabel(g).label}」と報じている`);
      courtChallenge(g, 'ban_opposition', '野党の禁止');
      afterStep(g);
      return { ok: true, text: '野党の活動を禁止した。' };
    },
  },
  national_army: {
    name: '自衛隊の国軍化', auth: true, regimes: ['dictatorship'],
    desc: '政令で自衛隊を「国軍」に改め、9条の制約を無視して運用する。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '自衛隊の国軍化');
      if (w) return w;
      if (r.id !== 'dictatorship') return '自衛隊は憲法9条のもとの組織。国軍にはできない（民主制では、変えるなら憲法改正の発議と国民投票が必要）';
      if (r.steps.army) return 'すでに国軍に改められている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.army = true;
      const quit = rint(8000, 20000);
      r.sdf.quit += quit;
      backlash(g, '自衛隊の国軍化', 3, { intl: 10 });
      news(g, `【もしも】政府は政令で自衛隊を「国軍」に改めた。抗議して約${n0(quit)}人の隊員が職を辞した`);
      phone(g, `【もしも】自衛隊が政令で「国軍」に改められた。\n文民統制のもとで任務についてきた隊員のうち、約${n0(quit)}人が辞職した。`);
      queueScene(g, 'army', {});
      afterStep(g);
      return { ok: true, text: '自衛隊を国軍に改めた。' };
    },
  },
  lift_emergency: {
    name: '緊急事態の解除', auth: false, regimes: ['emergency'],
    desc: '緊急事態宣言を解除し、選挙と国会を元に戻す。',
    check(g) {
      const r = R(g);
      if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
      if (!isPM(g)) return '内閣総理大臣でなければできない';
      if (r.id !== 'emergency') return r.id === 'dictatorship' ? '独裁体制では「民主化」として退陣するしかない' : 'いまは緊急事態ではない';
      return null;
    },
    run(g) {
      const r = R(g);
      restoreDemocracy(g, '緊急事態の解除');
      bumpApproval(g, 4, 3);
      r.unrest = Math.max(0, r.unrest - 15);
      r.intl = Math.max(0, r.intl - 10);
      return { ok: true, text: '緊急事態を解除した。選挙と国会は元に戻る。' };
    },
  },
  democratize: {
    name: '民主化（退陣）', auth: false, regimes: ['emergency', 'dictatorship'],
    desc: '権力を手放して退陣し、選挙と国会を元に戻す。それまでの行為は、法にもとづいて裁かれる。',
    check(g) {
      const r = R(g);
      if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
      if (!isPM(g)) return '内閣総理大臣でなければできない';
      if (r.id !== 'emergency' && r.id !== 'dictatorship') return 'いまは民主制。退陣するなら、ふつうに辞任すればよい';
      if (r.war && r.war.phase === 'war') return '戦争の最中。まず停戦交渉をまとめる';
      return null;
    },
    run(g) {
      const r = R(g);
      const was = r.id;
      restoreDemocracy(g, '民主化');
      r.unrest = Math.max(0, r.unrest - 40);
      r.intl = Math.max(0, r.intl - 30);
      r.sanctions = Math.max(0, r.sanctions - 2);
      news(g, `${g.state.name}総理が退陣を表明。${was === 'dictatorship' ? '独裁体制は終わり、' : ''}選挙と国会が再開される`);
      phone(g, `【退陣】${g.state.name}総理が退陣し、民主化を約束した。\n選挙と国会が再開される。`);
      // stepping down: the cabinet resigns (politics core), then the courts take over
      try { if (typeof g.resignPM === 'function') g.resignPM('民主化のための退陣'); } catch (e) { console.error(e); }
      scheduleTrial(g, 'democratize');
      return { ok: true, text: '退陣した。選挙と国会は再開される。' };
    },
  },
};
export const REGIME_STEP_ORDER = Object.keys(REGIME_STEPS);
// After a step in the emergency: both elections and the Diet stopped → the dictatorship.
function afterStep(g) {
  const r = R(g);
  if (r.id === 'emergency' && r.steps.elections && r.steps.diet) setRegime(g, 'dictatorship', '選挙と国会の停止');
}
function restoreDemocracy(g, why) {
  const r = R(g);
  for (const k of ['emergency', 'elections', 'diet', 'opposition', 'censor', 'courtIgnored']) r.steps[k] = false;
  if (r.steps.army) { r.steps.army = false; news(g, '国軍は自衛隊に戻され、文民統制のもとに置かれた'); }
  r.press.offset = Math.max(r.press.offset, -10);
  r.courts = [];
  setRegime(g, 'democracy', why);
  emit(g, 'step', { kind: 'restore', why });
}

// ======================================================================== the amendment's referendum (by segments)
// The share voting yes in each segment (the 強権型 emergency clause is unpopular with most groups).
const REF_BASE = { young: 0.25, families: 0.32, elderly: 0.42, employees: 0.33, selfemployed: 0.4, business: 0.4, farmers: 0.42, unions: 0.15, urban: 0.28, rural: 0.44, floating: 0.27 };
function runReferendum(g) {
  const r = R(g);
  const A = r.amend;
  if (!A || A.stage !== 'referendum') return;
  const year = yearOf(g);
  let W = null;
  try { W = POL && POL.segWeights ? POL.segWeights(year) : null; } catch (e) { W = null; }
  const segs = Object.keys(REF_BASE);
  if (!W) { W = {}; for (const s of segs) W[s] = 1 / segs.length; }
  const appr = approvalOf(g);
  const bySeg = {};
  let yes = 0, wsum = 0;
  for (const s of segs) {
    const v = clamp(REF_BASE[s] + (appr - 40) * 0.006 - r.unrest * 0.001 + gauss() * 0.03, 0.05, 0.9);
    bySeg[s] = Math.round(v * 1000) / 10;
    yes += num(W[s]) * v;
    wsum += num(W[s]);
  }
  yes = wsum ? yes / wsum : 0.3;
  const turnout = Math.round(clamp(48 + gauss() * 4 + r.unrest * 0.1, 35, 70) * 10) / 10;
  const passed = yes > 0.5;
  A.stage = passed ? 'passed' : 'rejected';
  A.result = { yes: Math.round(yes * 1000) / 10, turnout, bySeg, day: today(g) };
  const segName = (s) => (POL && POL.SEGMENTS && POL.SEGMENTS[s] && POL.SEGMENTS[s].name) || s;
  const top = Object.entries(bySeg).sort((a, b) => b[1] - a[1]);
  news(g, `国民投票：強権型の緊急事態条項は賛成${A.result.yes}%で${passed ? '承認' : '否決'}（投票率${turnout}%）`);
  phone(g, `【国民投票の結果】\n強権型の緊急事態条項\n賛成 ${A.result.yes}%・反対 ${Math.round((100 - A.result.yes) * 10) / 10}%（投票率${turnout}%）\n${passed ? '承認され、憲法が改正された。' : '過半数に届かず、改正は成立しなかった。'}\n賛成が多かった層：${segName(top[0][0])} ${top[0][1]}%\n反対が多かった層：${segName(top[top.length - 1][0])} ${Math.round((100 - top[top.length - 1][1]) * 10) / 10}%`);
  if (passed) {
    r.steps.clause = true;
    r.steps.clauseDay = today(g);
    raiseIntl(g, 8, '強権型の緊急事態条項');
  } else {
    bumpApproval(g, -6, -3);
  }
  queueScene(g, 'referendum', { yes: A.result.yes, passed, turnout, bySeg });
  emit(g, 'step', { kind: 'referendum', passed });
}

// ======================================================================== the courts (最高裁) in a democracy / the emergency
function courtChallenge(g, step, what) {
  const r = R(g);
  if (r.steps.courtIgnored || r.id === 'dictatorship') return;
  r.courts.push({ id: 'c' + today(g) + step, day: today(g) + rint(6, 14), step, what });
}
function courtTick(g) {
  const r = R(g);
  const due = r.courts.filter((c) => today(g) >= c.day);
  if (!due.length) return;
  r.courts = r.courts.filter((c) => today(g) < c.day);
  for (const c of due) {
    if (r.steps.courtIgnored || r.id === 'dictatorship' && c.step !== 'sns_bill') continue;
    news(g, `最高裁判所は「${c.what}」を違憲・無効と判断した`);
    phone(g, `【最高裁判決】\n「${c.what}」は憲法に違反し無効、と最高裁判所が判断した。`);
    queueScene(g, 'court', { step: c.step, what: c.what });
  }
}
// The player's answer to a ruling: comply (the step is undone) or ignore it (the rule of law ends).
function answerCourt(g, step, comply) {
  const r = R(g);
  if (comply) {
    if (step === 'suspend_elections') r.steps.elections = false;
    if (step === 'suspend_diet') r.steps.diet = false;
    if (step === 'ban_opposition') r.steps.opposition = false;
    if (step === 'sns_bill') { r.press.bill = null; r.press.offset += 6; }
    if (step === 'censor') r.steps.censor = false;
    bumpApproval(g, 2, 1);
    r.unrest = Math.max(0, r.unrest - 6);
    news(g, `政府は最高裁の判決に従い、「${{ suspend_elections: '選挙の停止', suspend_diet: '国会の停止', ban_opposition: '野党の禁止', sns_bill: '規制法', censor: '検閲' }[step] || step}」を取り消した`);
    return '判決に従った。';
  }
  r.steps.courtIgnored = true;
  backlash(g, '最高裁判決の無視', 3, { intl: 8, unrest: 6 });
  news(g, '【もしも】政府は最高裁の判決を無視した。法の支配が揺らいでいる');
  if (r.id === 'emergency' && (r.steps.elections || r.steps.diet)) setRegime(g, 'dictatorship', '最高裁判決の無視');
  return '判決を無視した。';
}

// ======================================================================== 報道の自由度
const PRESS_BASE = { democracy: 72, emergency: 55, dictatorship: 28, fallen: 50 };
function pressValue(g) {
  const r = R(g);
  if (r.press.value < 0) r.press.value = PRESS_BASE.democracy;
  return r.press.value;
}
function press(g, d, why) {
  const r = R(g);
  pressValue(g);
  r.press.value = clamp(Math.round((r.press.value + d) * 10) / 10, 0, 100);
  r.press.offset = clamp(r.press.offset + d, -60, 20);
  r.press.history.push({ day: today(g), v: Math.round(r.press.value), why: why || '' });
  if (r.press.history.length > 60) r.press.history.splice(0, r.press.history.length - 60);
  emit(g, 'press', { d, why, value: r.press.value });
}
function pressTick(g) {
  const r = R(g);
  pressValue(g);
  const base = PRESS_BASE[r.id] + (r.steps.censor ? -15 : 0);
  // pressure fades slowly in a free country; the dictatorship's control stays
  if (r.id === 'democracy') r.press.offset *= 0.985;
  const target = clamp(base + r.press.offset, 0, 100);
  r.press.value = clamp(r.press.value + (target - r.press.value) * 0.05, 0, 100);
  if (today(g) % 10 === 0) {
    const last = r.press.history[r.press.history.length - 1];
    if (!last || today(g) - last.day >= 10) { r.press.history.push({ day: today(g), v: Math.round(r.press.value), why: '' }); if (r.press.history.length > 60) r.press.history.splice(0, r.press.history.length - 60); }
  }
}
function pressLabel(v) { return v >= 70 ? '高い' : v >= 55 ? 'やや高い' : v >= 40 ? '懸念がある' : v >= 20 ? '低い' : 'きわめて低い'; }
// The SNS era's wording (no SNS in 1987).
const netWord = (g) => (since(g, 2008, 1) ? 'SNS' : since(g, 1998, 1) ? 'インターネット' : '出版・放送');
export const PRESS_ACTIONS = {
  denpa: {
    name: '電波停止への言及', regimes: ['democracy'], size: 2,
    desc: '国会で、放送局が政治的公平（放送法4条）に反すれば電波法76条で電波を止めることもありうる、と言及する。',
    run(g) {
      press(g, -6, '電波停止への言及');
      bumpApproval(g, -3, -1);
      const me = meOf(g);
      if (me) me.standing = clamp(num(me.standing) - 4, 0, 100);
      news(g, `${g.state.name}${isPM(g) ? '総理' : '大臣'}が国会で「電波停止」に言及。放送界や弁護士会から「表現の自由への威嚇だ」と抗議`);
      spawnDemo(g, { cause: '報道への圧力', size: 'small', segment: 'young', against: 'government' });
      return '「電波停止もありうる」と言及した。放送局や弁護士会、党内からも批判が出ている。';
    },
  },
  exclude: {
    name: '特定の記者の排除', regimes: ['democracy'], size: 1,
    desc: '記者会見で、批判的な記者の質問を受けつけないようにする。',
    run(g) {
      press(g, -4, '記者の排除');
      bumpApproval(g, -2, -1);
      news(g, '首相官邸の記者会見で特定の記者の質問が打ち切られ、記者クラブが抗議文を出した');
      return '批判的な記者の質問を受けつけないようにした。記者クラブが抗議している。';
    },
  },
  pressure: {
    name: '放送局への圧力', regimes: ['democracy'], size: 2,
    desc: '政権に批判的な番組について、放送局の幹部に「公平な報道」を求める文書を送る。',
    run(g) {
      press(g, -7, '放送局への圧力');
      bumpApproval(g, -2, -1);
      if (roll(0.5)) {
        bumpApproval(g, -5, -2);
        news(g, `放送局への「要請文書」が明らかに。${g.state.name}政権に「報道への介入だ」と批判が集まる`);
        defect(g, 0.02, '報道への圧力');
        spawnDemo(g, { cause: '報道への介入', size: 'medium', segment: 'urban', against: 'government' });
        return '要請文書が報道で明らかになり、強い批判を浴びた。党内からも離反者が出た。';
      }
      news(g, 'ある放送局の看板番組の出演者が交代。「政治の圧力では」との声も');
      return '放送局に文書を送った。番組に変化が出たが、「圧力では」という声もある。';
    },
  },
  disclosure: {
    name: '情報公開の拒否', regimes: ['democracy'], size: 1,
    desc: '政府の文書の開示請求を、理由を示さずに拒む。',
    run(g) {
      press(g, -3, '情報公開の拒否');
      bumpApproval(g, -1, -1);
      if (since(g, 2001, 4)) {
        courtChallenge(g, 'disclosure', '文書の不開示');
        news(g, '政府が文書の開示を拒否。市民団体が情報公開法にもとづき不開示の取り消しを求めて提訴');
        return '開示を拒んだ。情報公開法（2001年施行）にもとづく裁判が起こされた。';
      }
      news(g, '政府が国会への資料提出を拒否。野党が「隠蔽だ」と反発（情報公開法はまだない）');
      return '資料の提出を拒んだ。情報公開法はまだなく、裁判にはならないが、批判が出ている。';
    },
  },
  sns_bill: {
    name: '言論規制法案', regimes: ['democracy'], size: 3,
    label: (g) => `${netWord(g)}規制法案`,
    desc: '政府への「虚偽の批判」を罰する規制法案を出す。表現の自由（憲法21条）とぶつかる。',
    run(g) {
      const r = R(g);
      press(g, -10, '言論規制法案');
      bumpApproval(g, -8, -3);
      defect(g, 0.04, '言論規制法案');
      spawnDemo(g, { cause: '言論規制法案', size: 'large', segment: 'young', against: 'government' });
      const p = pol(g);
      const pi = partyOf(g);
      const share = p && pi && p.diet && p.diet.shugi ? num(p.diet.shugi.seats[pi.id]) / Math.max(1, num(p.diet.shugi.total)) : 0;
      if (share > 0.5 && roll(0.55)) {
        r.press.bill = { day: today(g) };
        press(g, -6, '言論規制法の成立');
        news(g, `「${netWord(g)}規制法」が与党の賛成多数で成立。違憲訴訟が相次ぐ`);
        r.courts.push({ id: 'c' + today(g) + 'sns', day: today(g) + rint(15, 30), step: 'sns_bill', what: `${netWord(g)}規制法` });
        return `法案は成立したが、違憲訴訟が起こされた。大規模なデモが続いている。`;
      }
      news(g, `「${netWord(g)}規制法案」は与党内の反対で廃案に。全国でデモ`);
      return '与党内からも反対が出て、法案は廃案になった。大規模なデモが起きた。';
    },
  },
  censor: {
    name: '検閲・報道統制', regimes: ['emergency', 'dictatorship'], size: 3,
    desc: '新聞・放送・ネットの内容を政府の許可制にする。',
    run(g) {
      const r = R(g);
      r.steps.censor = true;
      press(g, -20, '検閲・報道統制');
      backlash(g, '検閲・報道統制', 2, { defect: false });
      courtChallenge(g, 'censor', '検閲');
      news(g, `【もしも】政府が報道の事前検閲を始めた（憲法21条2項は検閲を禁じている）。海外メディアは「${regimeLabel(g).label}」と報じている`);
      return '報道を検閲するようにした。国際社会が強く非難している。';
    },
  },
  detain: {
    name: 'ジャーナリストの拘束', regimes: ['emergency', 'dictatorship'], size: 3,
    desc: '政府に批判的な記者を「治安」を理由に拘束する。',
    run(g) {
      const r = R(g);
      const n = rint(5, 30);
      r.press.detained += n;
      r.record.detained += n;
      press(g, -15, 'ジャーナリストの拘束');
      backlash(g, 'ジャーナリストの拘束', 3, { intl: 12, unrest: 6, defect: false });
      news(g, `【もしも】政府に批判的な記者${n}人が拘束された。国際的な報道団体と各国政府が即時の解放を求めている`);
      phone(g, `【もしも】記者${n}人が拘束された。\n各国政府と報道団体が強く非難している。`, 'ドット新聞 国際部');
      return `記者${n}人が拘束された。国際社会の非難が集まり、国内の不満も高まっている。`;
    },
  },
  release: {
    name: '拘束の解除・検閲の撤廃', regimes: ['emergency', 'dictatorship'], size: 0,
    desc: '拘束した記者を解放し、検閲をやめる。',
    run(g) {
      const r = R(g);
      if (!r.press.detained && !r.steps.censor) return null;
      const n = r.press.detained;
      r.press.detained = 0;
      r.steps.censor = false;
      press(g, 12, '検閲の撤廃・記者の解放');
      r.intl = Math.max(0, r.intl - 6);
      r.unrest = Math.max(0, r.unrest - 5);
      news(g, `政府は${n ? `拘束していた記者${n}人を解放し、` : ''}検閲をやめると発表した`);
      return '記者を解放し、検閲をやめた。';
    },
  },
};
export const PRESS_ORDER = Object.keys(PRESS_ACTIONS);
function pressRefusal(g, kind) {
  const A = PRESS_ACTIONS[kind];
  if (!A) return 'そんな行為はない';
  const r = R(g);
  if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  if (kind === 'release') {
    if (!isPM(g)) return '内閣総理大臣でなければできない';
    if (!r.press.detained && !r.steps.censor) return '拘束も検閲もしていない';
    return null;
  }
  if (!A.regimes.includes(r.id)) return r.id === 'democracy' ? `民主制では、${A.name}はできない（表現の自由・検閲の禁止：憲法21条）` : `いまの体制では、これは選ばない（${REGIME_INFO[r.id].name}）`;
  if (r.id === 'democracy' ? !inCabinet(g) : !isPM(g)) return r.id === 'democracy' ? '内閣の一員（総理・大臣）でなければできない' : '内閣総理大臣でなければできない';
  const real = realPartyRefusal(g, A.name);
  if (real) return real;
  if (num(r.press.actions[kind]) && today(g) - num(r.press.actions[kind]) < 5) return 'ついこのあいだ同じことをした（数日あける）';
  return null;
}

// ======================================================================== 自衛隊
// Personnel (定員・現員) by year: verified 1999/2000/2002/now; earlier years are 目安.
function sdfPersonnel(g) {
  const y = dateOf(g).fy;
  let quota;
  if (y < 1999) quota = 270000;
  else if (y < 2000) quota = 265737;
  else if (y < 2002) quota = 262073;
  else if (y < 2014) quota = Math.round(258290 + (247154 - 258290) * (y - 2002) / 12);
  else quota = 247154;
  const fill = y >= 2025 ? 0.89 : y >= 2017 ? 0.91 : 0.92;
  const r = R(g);
  return { quota, actual: Math.max(0, Math.round(quota * fill - num(r.sdf.quit))), approx: y < 1999, fill };
}
// The defence budget (兆円): A1's 防衛 budget item when present, else the politics core's GDP share.
function defenseBudget(g) {
  try {
    if (typeof g.budget === 'function') {
      const b = g.budget();
      const items = b && (b.items || b.spending || b.expenditure);
      const list = Array.isArray(items) ? items : items && typeof items === 'object' ? Object.entries(items).map(([id, v]) => (typeof v === 'object' ? { id, ...v } : { id, value: v })) : [];
      const it = list.find((x) => x && (x.id === 'defense' || /防衛/.test(String(x.name || x.label || ''))));
      const v = it && num(it.value ?? it.amount ?? it.cho, NaN);
      if (Number.isFinite(v) && v > 0) return { cho: Math.round(v * 100) / 100, gdpPct: null, source: 'govt' };
    }
  } catch (e) { console.error(e); }
  const p = pol(g);
  if (p && p.economy) {
    const pct = num(p.economy.defense, 1);
    const gdp = num(p.economy.gdp, 550);
    return { cho: Math.round(pct * gdp) / 100, gdpPct: Math.round(pct * 100) / 100, source: 'politics' };
  }
  const y = yearOf(g);
  const cho = y >= 2026 ? 9.04 : y >= 2004 ? 4.9 : y >= 1996 ? 4.8 : 3.5;
  return { cho, gdpPct: y >= 2026 ? 1.4 : 1.0, source: 'era' };
}
function defenseRuleLines(g) {
  const out = [];
  if (since(g, 2022, 12)) out.push('安保3文書（2022年12月）：2023〜2027年度で約43兆円、2027年度に関連経費と合わせてGDP比2%');
  else if (since(g, 1987, 1)) out.push('1987年1月の閣議決定から、防衛費は中期防の総額の枠内で決める（総額明示方式）。GNP（GDP）比1%は目安として意識されてきた');
  else out.push('1976年の閣議決定で、防衛費はGNP比1%以内（1%枠）');
  if (eraOf(g) === 'showa' && yearOf(g) <= 1989) out.push('1987年度予算で、防衛費はGNP比1.004%と初めて1%を超えた');
  return out;
}
export function sdfStatus(g) {
  const r = R(g);
  const army = r.steps.army && r.id === 'dictatorship';
  const ministry = since(g, 2007, 1) ? '防衛省' : '防衛庁';
  const per = sdfPersonnel(g);
  const bud = defenseBudget(g);
  const pko = pkoLawOk(g);
  const dep = r.sdf.deployments.filter((d) => !d.ended);
  const lines = [
    `${army ? '国軍（もしも：政令で自衛隊を改編）' : '自衛隊（1954年発足）'}・${ministry}`,
    `人員：定員 約${(per.quota / 10000).toFixed(1)}万人・現員 約${(per.actual / 10000).toFixed(1)}万人${per.approx ? '（目安）' : ''}`,
    `防衛費：約${bud.cho}兆円${bud.gdpPct ? `（GDP比 約${bud.gdpPct}%）` : ''}`,
    ...defenseRuleLines(g),
    `指揮：内閣総理大臣（最高指揮官）・${postName(g, 'minister_defense')}。文民統制`,
    pko ? 'PKO協力法（1992年）：国連の平和維持活動に参加できる' : 'PKO協力法はまだない（現実には1992年6月成立）',
    lawInForce(g, 'security_law') ? '平和安全法制（2015年）：存立危機事態での限定的な集団的自衛権など' : null,
  ].filter(Boolean);
  if (r.sdf.haken) lines.push(`災害派遣中：${r.sdf.haken.where}（約${n0(r.sdf.haken.personnel)}人）`);
  for (const d of dep) lines.push(`${d.kind === 'pko' ? 'PKO' : '派遣'}：${d.where}（約${n0(d.personnel)}人）`);
  return {
    name: army ? '国軍' : '自衛隊', status: army ? 'kokugun' : 'sdf', founded: 1954, agency: ministry,
    minister: postName(g, 'minister_defense'), personnel: per, budget: bud, rules: defenseRuleLines(g), pkoLaw: pko,
    deployments: dep.map((d) => ({ ...d })), haken: r.sdf.haken ? { ...r.sdf.haken } : null,
    scrambles: r.sdf.scrambles, kaijo: r.sdf.kaijo ? { ...r.sdf.kaijo } : null, pkoOffer: r.sdf.pkoOffer ? { ...r.sdf.pkoOffer } : null, lines,
  };
}
function pkoLawOk(g) { return lawInForce(g, 'pko'); }
function canOrderSDF(g) {
  const r = R(g);
  if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  if (r.id === 'dictatorship' && isPM(g)) return null;
  if (isPM(g) || isDefMin(g)) return null;
  return `自衛隊に命令できるのは内閣総理大臣と${postName(g, 'minister_defense')}だけ（文民統制）`;
}
export const SDF_ORDERS = {
  haken: {
    name: '災害派遣', desc: '自衛隊法83条：知事などの要請を受けて部隊を派遣する。特に緊急なら要請を待たずに派遣できる（自主派遣）。',
    check(g) {
      const w = canOrderSDF(g);
      if (w) return w;
      const d = R(g).disaster;
      if (!d || d.phase === 'done') return 'いま大きな災害は起きていない（災害派遣は知事などの要請による）';
      if (R(g).sdf.haken) return 'すでに派遣している';
      return null;
    },
    run(g) { return { ok: true, text: dispatchSDF(g, R(g).disaster, isPM(g) ? 'pm' : 'defmin') }; },
  },
  haken_end: {
    name: '災害派遣の撤収', desc: '被災地の活動を終え、部隊を撤収させる。',
    check(g) { const w = canOrderSDF(g); if (w) return w; return R(g).sdf.haken ? null : 'いま災害派遣はしていない'; },
    run(g) {
      const r = R(g), h = r.sdf.haken;
      const early = r.disaster && r.disaster.phase === 'hinan';
      r.sdf.haken = null;
      if (early) { bumpApproval(g, -4, -1); news(g, `${h.where}から自衛隊が撤収。被災地からは「早すぎる」との声`); }
      else news(g, `${h.where}での災害派遣を終え、自衛隊が撤収した`);
      return { ok: true, text: early ? '撤収させたが、避難生活が続くなかで「早すぎる」と批判された。' : '撤収させた。' };
    },
  },
  pko: {
    name: 'PKOへの派遣', desc: 'PKO協力法（1992年）：国連の要請を受け、参加5原則を満たすときに派遣する（実施計画を閣議決定）。',
    check(g) {
      const r = R(g);
      const w = canOrderSDF(g);
      if (w) return w;
      if (r.id !== 'democracy') return '国連は、いまの日本政府の要員を受け入れない（体制への懸念）';
      if (!pkoLawOk(g)) return 'PKO協力法がない（現実には1992年6月成立・8月施行）。まず法律をつくる';
      if (!r.sdf.pkoOffer) return 'いま国連からの参加要請はない';
      if (!isPM(g)) return '実施計画の閣議決定は総理が進める（防衛大臣は総理に進言する）';
      return null;
    },
    run(g) {
      const r = R(g), o = r.sdf.pkoOffer;
      r.sdf.pkoOffer = null;
      const dep = { id: 'pko' + today(g), kind: 'pko', where: o.where, mission: o.mission, personnel: o.personnel, start: today(g), end: today(g) + YEAR_DAYS };
      r.sdf.deployments.push(dep);
      bumpApproval(g, 1);
      news(g, `政府は${o.mission}への自衛隊の派遣（約${n0(o.personnel)}人）を閣議決定した（PKO参加5原則）`);
      queueScene(g, 'pko', { where: o.where, mission: o.mission, personnel: o.personnel });
      emit(g, 'sdf', { kind: 'pko', dep });
      return { ok: true, text: `${o.mission}への派遣を決めた（約${n0(o.personnel)}人）。` };
    },
  },
  pko_end: {
    name: 'PKOからの撤収', desc: 'PKOの派遣部隊を撤収させる（停戦合意が崩れたときなどは撤収できる）。',
    check(g) { const w = canOrderSDF(g); if (w) return w; return R(g).sdf.deployments.some((d) => !d.ended && d.kind === 'pko') ? null : 'いまPKOに派遣している部隊はない'; },
    run(g) {
      const r = R(g);
      for (const d of r.sdf.deployments) if (!d.ended && d.kind === 'pko') { d.ended = today(g); news(g, `${d.mission}から自衛隊の部隊が撤収した`); }
      return { ok: true, text: 'PKOの部隊を撤収させた。' };
    },
  },
  kaijo: {
    name: '海上警備行動', desc: '自衛隊法82条：海上保安庁だけでは対応できないとき、防衛大臣が総理の承認を得て命じる。',
    check(g) {
      const r = R(g);
      const w = canOrderSDF(g);
      if (w) return w;
      if (!r.sdf.kaijo || r.sdf.kaijo.done) return 'いま対応すべき不審船の事案はない（まずは海上保安庁が対応する）';
      return null;
    },
    run(g) {
      const r = R(g), k = r.sdf.kaijo;
      k.done = 'kaijo';
      const ok = roll(0.75);
      news(g, `${FICTIONAL_NATIONS[k.nation].short}籍とみられる不審船に海上警備行動が発令された（自衛隊法82条）。${ok ? '不審船は領海の外へ去った' : '不審船は見失われた'}`);
      bumpApproval(g, ok ? 2 : -1);
      return { ok: true, text: ok ? '海上警備行動を発令した。不審船は領海の外へ去った。' : '海上警備行動を発令したが、不審船は見失われた。' };
    },
  },
  defense: {
    name: '防衛出動', desc: '自衛隊法76条：武力攻撃が発生した（または明白な危険が切迫した）ときだけ。閣議決定と国会の承認（原則事前）が必要。',
    check(g) {
      const r = R(g);
      const w = canOrderSDF(g);
      if (w) return w;
      if (r.id === 'dictatorship' && r.war && r.war.phase === 'war') return '戦時の命令は「戦争」の画面から出す';
      if (!isPM(g)) return '防衛出動を命じるのは内閣総理大臣（閣議決定と国会の承認が必要）';
      return '日本への武力攻撃は発生していない。防衛出動は武力攻撃事態などに限られ、閣議決定と国会の承認（原則事前）が必要（自衛隊法76条）。これまで一度も命じられたことはない';
    },
    run() { return { ok: false }; },
  },
  attack: {
    name: '他国への武力行使', desc: '他国を攻める。',
    check(g) {
      const r = R(g);
      if (r.id === 'dictatorship' && r.steps.army) return '独裁体制の戦争は「戦争」の画面から（宣戦）';
      if (r.id === 'dictatorship') return 'まず自衛隊を国軍に改める（もしも）';
      return '憲法9条：国際紛争を解決する手段としての戦争・武力の行使は放棄している。民主制の日本は侵略戦争をしない（自衛隊は専守防衛）';
    },
    run() { return { ok: false }; },
  },
  kokugun: {
    name: '国軍化', desc: '自衛隊を国軍に改める（独裁体制のもしも）。',
    check(g) { return stepRefusal(g, 'national_army'); },
    run(g) { return g.regimeStep('national_army'); },
  },
};
export const SDF_ORDER_LIST = Object.keys(SDF_ORDERS);
function dispatchSDF(g, d, by) {
  const r = R(g);
  const personnel = d.tier >= 3 ? rint(60000, 100000) : d.tier === 2 ? rint(8000, 25000) : rint(500, 3000);
  r.sdf.haken = { where: d.where, personnel, start: today(g), by, disaster: d.id };
  d.done.haken = today(g);
  d.log.push({ day: today(g), text: `自衛隊の災害派遣（約${n0(personnel)}人）` });
  const quick = today(g) - d.start <= 1;
  if (by === 'pm' || by === 'defmin') bumpApproval(g, quick ? 3 : 1);
  news(g, `${d.name}で自衛隊の災害派遣。約${n0(personnel)}人が救助・物資輸送にあたる（自衛隊法83条）`);
  emit(g, 'sdf', { kind: 'haken', personnel });
  return `自衛隊の部隊（約${n0(personnel)}人）が被災地に向かった。救助と物資の輸送にあたる。`;
}

// ======================================================================== 震災対応 (fictional disasters, real procedures)
function rollTier(kind) {
  const x = rnd();
  if (kind === 'storm') return x < 0.72 ? 1 : 2;
  if (kind === 'volcano') return x < 0.6 ? 1 : 2;
  if (kind === 'tsunami') return x < 0.35 ? 2 : 3;
  return x < 0.55 ? 1 : x < 0.93 ? 2 : 3;
}
function casualtyPlan(tier, kind) {
  const k = kind === 'tsunami' ? 1.6 : kind === 'storm' ? 0.5 : kind === 'volcano' ? 0.4 : 1;
  if (tier >= 3) return { dead: Math.round(rint(400, 3500) * k), missing: Math.round(rint(80, 600) * k), injured: rint(3000, 20000), evac: rint(150000, 450000), houses: rint(30000, 150000) };
  if (tier === 2) return { dead: Math.round(rint(8, 120) * k), missing: Math.round(rint(0, 20) * k), injured: rint(200, 2500), evac: rint(15000, 120000), houses: rint(2000, 25000) };
  return { dead: Math.round(rint(0, 4) * k), missing: 0, injured: rint(15, 180), evac: rint(800, 12000), houses: rint(50, 1500) };
}
function newDisaster(g, opts = {}) {
  const kind = DISASTER_KINDS[opts.kind] ? opts.kind : 'quake';
  const K = DISASTER_KINDS[kind];
  const placeId = opts.place && K.places.includes(opts.place) ? opts.place : pick(K.places);
  const pl = DISASTER_PLACES[placeId];
  const tier = clamp(Math.round(num(opts.tier, rollTier(kind))), 1, 3);
  const mag = kind === 'tsunami' ? Math.round((8 + rnd() * 0.8) * 10) / 10 : kind === 'quake' ? Math.round((6.4 + tier * 0.4 + rnd() * 0.4) * 10) / 10 : 0;
  const shindo = kind === 'quake' || kind === 'tsunami' ? (tier >= 3 ? '7' : tier === 2 ? '6強' : '6弱') : null;
  const plan = casualtyPlan(tier, kind);
  return {
    id: 'd' + today(g) + kind, kind, place: placeId, name: K.label(pl, g), where: pl.area, home: !!pl.home, tier, mag, shindo,
    start: today(g), phase: 'hassei', plan, known: { dead: 0, missing: 0, injured: 0, evac: 0, houses: 0 },
    done: {}, honbu: null, log: [{ day: today(g), text: '発生' }], score: 0, fromShock: !!opts.fromShock,
  };
}
// Start a fictional disaster (from the politics core's shock, our own roll, or a test).
function startDisaster(g, opts = {}) {
  const r = R(g);
  if (r.disaster && r.disaster.phase !== 'done') return null;
  const d = newDisaster(g, opts);
  r.disaster = d;
  r.lastDisasterDay = today(g);
  r.record.disasters++;
  revealCasualties(g, d);
  const head = d.kind === 'storm' ? `${d.name}。各地で川の氾濫や土砂崩れ` : d.kind === 'volcano' ? 'ドット岳（架空の火山）が噴火。噴火警戒レベルが引き上げられた' : `${d.name}（M${d.mag}・最大震度${d.shindo}）が発生${d.kind === 'tsunami' ? '。大津波警報' : ''}`;
  news(g, `【災害】${head}（架空の災害）`);
  phone(g, `【速報】${head}。\n${d.where}で被害が出ている。（ゲーム内の架空の災害です）`, 'ドット新聞 社会部');
  // the economy (politics core): only when this did not come from its own shock
  if (!d.fromShock && typeof g.triggerShock === 'function' && d.tier >= 2) {
    g._regimeShock = true;
    try { g.triggerShock(d.kind === 'storm' ? 'storm' : 'quake'); } catch (e) { console.error(e); }
    g._regimeShock = false;
  }
  if (d.tier >= 3) ecoShock(g, d.name, { growth: -1.5, inflation: 0.3, unemployment: 0.3, len: 180, nikkei: -4 });
  // the player's own life
  if (d.home) {
    const st = g.state;
    try { if (typeof g.addNeed === 'function') g.addNeed('stress', 10 + d.tier * 8); } catch (e) { console.error(e); }
    r.cancelUntil = today(g) + (d.tier >= 3 ? 4 : d.tier === 2 ? 2 : 1);
    note(g, `（${d.name}の影響で、交通機関が止まっている。${d.tier >= 2 ? 'しばらく' : '今日は'}お仕事も中止だ）`);
    if (st && st.flags) familyMessage(g, d.tier >= 2 ? '{name}、大丈夫！？ニュースを見てびっくりしたよ。\nけがはない？無理しないで、なにかあったらすぐ連絡してね。' : '{name}、地震があったみたいだけど大丈夫？\n気をつけてね。');
  }
  queueScene(g, 'disaster', { phase: 'hassei' }, { front: true });
  emit(g, 'disaster', { phase: 'hassei', d });
  return d;
}
function revealCasualties(g, d) {
  const days = today(g) - d.start;
  const k = days <= 0 ? 0.3 : days === 1 ? 0.6 : days <= 3 ? 0.9 : 1;
  const P = d.plan;
  d.known.dead = Math.round(P.dead * k);
  d.known.missing = days >= 7 ? P.missing : Math.round(P.missing + (P.dead - d.known.dead) * 0.5);
  d.known.injured = Math.round(P.injured * Math.min(1, k + 0.2));
  // evacuees peak on the first days, then go home little by little
  const peak = P.evac;
  d.known.evac = days <= 1 ? Math.round(peak * (days ? 1 : 0.8)) : Math.round(peak * Math.max(0.03, Math.exp(-(days - 1) / (d.tier >= 3 ? 40 : d.tier === 2 ? 12 : 3))));
  d.known.houses = Math.round(P.houses * Math.min(1, 0.5 + days * 0.1));
}
export function disasterSummary(g, d = R(g).disaster) {
  if (!d) return null;
  const K = d.known;
  return `死者${n0(K.dead)}人・行方不明${n0(K.missing)}人・けが人${n0(K.injured)}人・避難${n0(K.evac)}人・住宅被害${n0(K.houses)}棟`;
}
// The player's role in a disaster.
function roleOf(g) {
  const me = meOf(g);
  const roles = [];
  if (me) {
    if (isPM(g)) roles.push('pm');
    if (isDefMin(g)) roles.push('defmin');
    if (isFinMin(g)) roles.push('finmin');
    if (inCabinet(g) && !isPM(g)) roles.push('minister');
    if (me.office === 'chiji') roles.push('chiji');
    if (me.office === 'shicho') roles.push('kucho');
    if (me.office === 'kugi' || me.office === 'togi') roles.push('local');
    if (me.office === 'shugi' || me.office === 'sangi') roles.push('diet');
  }
  const fame = num(g.state && g.state.fame);
  if (fame >= 300) roles.push('celebrity');
  roles.push('citizen');
  return roles;
}
// The headquarters by date (災害対策基本法).
function honbuName(g, kind) {
  if (kind === 'kinkyu') return '緊急災害対策本部';
  return '非常災害対策本部';
}
function honbuChief(g, kind) {
  if (kind === 'kinkyu' || since(g, 2021, 5)) return '内閣総理大臣';
  return since(g, 2001, 1) ? '防災担当大臣' : '国土庁長官';
}
const crisisRoom = (g) => (since(g, 2002, 4) ? '官邸危機管理センター' : since(g, 1998, 4) ? '官邸（内閣危機管理監のもと）' : '首相官邸');
// Each action: who (roles), when (phases), prerequisites, and what it does. run → result text.
export const DISASTER_ACTIONS = {
  honbu_hijo: {
    name: '非常災害対策本部の設置', roles: ['pm'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '災害対策基本法24条：非常災害のとき、内閣府に臨時に置く（2021年5月の改正で本部長は内閣総理大臣に）。',
    check(g, d) { if (d.honbu) return `すでに${d.honbu === 'kinkyu' ? '緊急' : '非常'}災害対策本部を設置した`; return null; },
    run(g, d) {
      d.honbu = 'hijo';
      d.done.honbu = today(g);
      const quick = today(g) - d.start <= 0;
      d.score += quick ? 2 : 0;
      bumpApproval(g, quick ? 2 : 0);
      d.log.push({ day: today(g), text: `非常災害対策本部（本部長：${honbuChief(g, 'hijo')}）` });
      news(g, `政府が${d.name}の非常災害対策本部を設置（本部長：${honbuChief(g, 'hijo')}）`);
      return `非常災害対策本部を設置した（本部長：${honbuChief(g, 'hijo')}）。各省庁の応急対策をまとめる。`;
    },
  },
  honbu_kinkyu: {
    name: '緊急災害対策本部の設置', roles: ['pm'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '災害対策基本法28条の2：著しく異常かつ激甚な非常災害のとき、閣議決定で置く。本部長は内閣総理大臣、全閣僚が本部員。',
    check(g, d) {
      if (d.honbu === 'kinkyu') return 'すでに緊急災害対策本部を設置した';
      if (d.tier < 3) return '著しく異常かつ激甚な災害ではない（緊急災害対策本部の要件にあたらない。非常災害対策本部で対応する）';
      return null;
    },
    run(g, d) {
      d.honbu = 'kinkyu';
      d.done.honbu = today(g);
      const quick = today(g) - d.start <= 0;
      d.score += quick ? 3 : 1;
      bumpApproval(g, quick ? 4 : 1);
      d.log.push({ day: today(g), text: '緊急災害対策本部（本部長：内閣総理大臣）' });
      news(g, `政府が${d.name}の緊急災害対策本部を設置（本部長：内閣総理大臣、全閣僚が本部員）`);
      return '閣議決定で緊急災害対策本部を設置した。本部長として、全閣僚に応急対策を指示した。';
    },
  },
  sdf_request: {
    name: '自衛隊の災害派遣を要請', roles: ['chiji'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '自衛隊法83条：都道府県知事が防衛大臣などに部隊の派遣を求める（市区町村長は知事に要請を求める）。',
    check(g, d) { if (!d.home) return '東京都の災害ではない（派遣を要請するのは被災地の知事）'; if (R(g).sdf.haken || d.done.haken) return 'すでに自衛隊が派遣されている'; return null; },
    run(g, d) {
      d.done.request = today(g);
      d.score += today(g) - d.start <= 0 ? 2 : 1;
      const me = meOf(g);
      if (me) me.reputation = clamp(num(me.reputation) + 4, -100, 100);
      return `東京都知事として、自衛隊の災害派遣を要請した。\n${dispatchSDF(g, d, 'chiji')}`;
    },
  },
  sdf_order: {
    name: '自衛隊に災害派遣を命じる', roles: ['pm', 'defmin'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '自衛隊法83条：知事などの要請を受けて派遣する。特に緊急で要請を待つ時間がなければ自主派遣。',
    check(g, d) { if (R(g).sdf.haken || d.done.haken) return 'すでに自衛隊が派遣されている'; return null; },
    run(g, d) {
      const self = !d.done.request;
      const t = dispatchSDF(g, d, isPM(g) ? 'pm' : 'defmin');
      d.score += 1;
      return `${self ? '知事の要請を待つ時間がないため、自主派遣を命じた。\n' : ''}${t}`;
    },
  },
  kyujo_ho: {
    name: '災害救助法の適用', roles: ['chiji'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '災害救助法（1947年）：知事が適用を決め、避難所・食料・仮設住宅などの費用を国と都道府県が負担する。',
    check(g, d) { if (!d.home) return '東京都の災害ではない'; if (d.done.kyujo) return 'すでに適用した'; return null; },
    run(g, d) {
      d.done.kyujo = today(g);
      d.score += 1;
      news(g, `東京都が${d.name}で災害救助法の適用を決めた`);
      return '災害救助法の適用を決めた。避難所や食料、仮設住宅の費用を国と都が負担する。';
    },
  },
  shelter: {
    name: '避難所を開設・運営する', roles: ['kucho'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '区長として、学校の体育館などに避難所を開き、職員を配置する（災害対策基本法・地域防災計画）。',
    check(g, d) { if (!d.home) return 'ドット区の災害ではない'; if (d.done.shelter) return 'すでに避難所を開いた'; return null; },
    run(g, d) {
      d.done.shelter = today(g);
      d.score += 1;
      const me = meOf(g);
      if (me) me.localSupport = clamp(num(me.localSupport) + 6, 0, 100);
      queueScene(g, 'shelter', { who: 'kucho' }, { front: true });
      return 'ドット区内の小中学校の体育館に避難所を開いた。毛布と水、トイレの確保を急がせた。';
    },
  },
  shelter_visit: {
    name: '避難所を回る', roles: ['kucho', 'local', 'diet', 'chiji'], phases: ['hinan'],
    desc: '避難所で困りごとを聞き、行政につなぐ。',
    check(g, d) { if (num(d.done.visit) === today(g)) return '今日はもう回った'; if (!d.home && !roleOf(g).includes('diet')) return '地元の災害ではない'; if (num(g.state.stamina) < 15) return '体力が足りない（体力15）'; return null; },
    run(g, d) {
      d.done.visit = today(g);
      g.state.stamina = Math.max(0, num(g.state.stamina) - 15);
      const me = meOf(g);
      if (me) { me.localSupport = clamp(num(me.localSupport) + 3, 0, 100); me.reputation = clamp(num(me.reputation) + 2, -100, 100); }
      queueScene(g, 'shelter', { who: 'visit' }, { front: true });
      return pick(['避難所で、高齢の方から薬が足りないと聞き、保健所につないだ。', '避難所で、子どもの遊び場がほしいという声を聞き、区に伝えた。', '避難所で、女性の更衣室や授乳室が足りないと聞き、運営の担当に伝えた。']);
    },
  },
  shisatsu: {
    name: '被災地を視察する', roles: ['pm', 'minister', 'diet', 'chiji'], phases: ['shodo', 'hinan', 'fukko'],
    desc: '現地の状況を自分の目で確かめる。早すぎる視察は救助の妨げだと批判されることもある。',
    check(g, d) { if (d.done.shisatsu) return 'すでに視察した'; if (num(g.state.stamina) < 20) return '体力が足りない（体力20）'; return null; },
    run(g, d) {
      d.done.shisatsu = today(g);
      g.state.stamina = Math.max(0, num(g.state.stamina) - 20);
      const early = today(g) - d.start <= 1 && d.tier >= 2;
      if (early) { bumpApproval(g, -2); news(g, `${g.state.name}氏が${d.name}の被災地を視察。「救助の最中に」と批判も`); return '被災地を視察したが、救助活動の最中だったため「現場の負担になる」と批判された。'; }
      bumpApproval(g, 1);
      const me = meOf(g);
      if (me) me.reputation = clamp(num(me.reputation) + 3, -100, 100);
      news(g, `${g.state.name}氏が${d.name}の被災地を視察し、被災者の声を聞いた`);
      return '被災地を視察し、被災した人たちの話を聞いた。';
    },
  },
  gekijin: {
    name: '激甚災害に指定する', roles: ['pm'], phases: ['hinan', 'fukko'],
    desc: '激甚災害法（1962年）：政令で指定（閣議決定）。道路・河川・学校などの復旧の国庫補助をかさ上げする。',
    check(g, d) { if (d.done.gekijin) return 'すでに指定した'; if (d.tier < 2) return '被害の規模が激甚災害の基準に届かない（局地的な被害は「局激」として別に判断される）'; if (today(g) - d.start < 3) return '被害の調査がまだ終わっていない（数日かかる）'; return null; },
    run(g, d) {
      d.done.gekijin = today(g);
      d.score += 2;
      bumpApproval(g, 2);
      news(g, `政府は${d.name}を激甚災害に指定する政令を閣議決定した（本激）`);
      queueScene(g, 'cabinet', { what: 'gekijin' }, { front: true });
      return '激甚災害の指定を閣議決定した。復旧事業の国の補助がかさ上げされる。';
    },
  },
  shienho: {
    name: '被災者生活再建支援法の適用', roles: ['chiji'], phases: ['hinan', 'fukko'],
    desc: '被災者生活再建支援法（1998年11月施行）：住宅が全壊した世帯などに支援金（最高100万円 → 2007年改正後は最高300万円）。',
    check(g, d) { if (!since(g, 1998, 11)) return 'この時代には、被災者生活再建支援法はまだない（1998年成立）。義援金と自治体の独自支援に頼る'; if (!d.home) return '東京都の災害ではない'; if (d.done.shienho) return 'すでに適用した'; if (d.tier < 2) return '適用の基準（全壊の世帯数）に届かない'; return null; },
    run(g, d) {
      d.done.shienho = today(g);
      d.score += 1;
      const max = since(g, 2007, 11) ? '300万円' : since(g, 2004, 4) ? '300万円（うち200万円は居住安定支援）' : '100万円';
      news(g, `東京都が${d.name}に被災者生活再建支援法を適用した`);
      return `被災者生活再建支援法を適用した。住宅が全壊した世帯などに、最高${max}の支援金が出る。`;
    },
  },
  hosei: {
    name: '補正予算を編成する', roles: ['pm', 'finmin'], phases: ['hinan', 'fukko'],
    desc: '災害復旧のための補正予算案を閣議決定し、国会に出す（予算を出せるのは内閣だけ：憲法73条・86条）。',
    check(g, d) { if (d.done.hosei) return 'すでに補正予算案を出した'; if (d.tier < 2) return '補正予算を組むほどの被害ではない（予備費で対応できる）'; if (today(g) - d.start < 4) return '被害額の見積もりがまだ出ていない'; return null; },
    run(g, d) {
      const amount = d.tier >= 3 ? 10 : 2;
      let id = null;
      if (typeof g.proposeBill === 'function') {
        id = g.proposeBill({ policy: 'stimulus', params: { amount }, title: `補正予算案（災害復旧・${amount}兆円）` });
        if (!id) return { ok: false, why: g.lastPoliticsError || '補正予算案を出せなかった' };
      }
      d.done.hosei = today(g);
      d.score += 2;
      return `災害復旧の補正予算案（${amount}兆円）を閣議決定した。${inSession(g) ? '国会で審議される。' : '次の国会に出す。'}`;
    },
  },
  fukko_plan: {
    name: '復興の基本方針を決める', roles: ['pm'], phases: ['fukko'],
    desc: '被災地の復興の方針を決める。大きな災害では、専門の組織や特別な法律も議論される（2012年に東日本大震災の復興のため復興庁ができた）。',
    check(g, d) { if (d.done.plan) return 'すでに決めた'; if (d.tier < 2) return '国の復興方針が要るほどの被害ではない'; return null; },
    run(g, d) {
      d.done.plan = today(g);
      d.score += 2;
      bumpApproval(g, 2);
      news(g, `政府が${d.name}からの復興の基本方針を閣議決定した`);
      queueScene(g, 'fukko', {}, { front: true });
      return '復興の基本方針を閣議決定した。住まいと仕事、道路や学校の再建に予算を集める。';
    },
  },
  donate: {
    name: '義援金を寄付する', roles: ['citizen'], phases: ['hassei', 'shodo', 'hinan', 'fukko'],
    desc: '日本赤十字社や自治体の義援金の窓口に寄付する（被災した人に配られる）。',
    check(g, d) { if (num(d.done.donate) === today(g)) return '今日はもう寄付した'; if (num(g.state.money) < 1000) return 'お金が足りない'; return null; },
    run(g, d) {
      const st = g.state;
      const amt = Math.max(1000, Math.round(Math.min(st.money * 0.1, 100000) / 1000) * 1000);
      st.money -= amt;
      d.done.donate = today(g);
      d.donated = num(d.donated) + amt;
      try { if (typeof g.addNeed === 'function') g.addNeed('stress', -3); } catch (e) { /* ignore */ }
      return `${fmtMoney(amt)}を義援金として寄付した。`;
    },
  },
  volunteer: {
    name: 'ボランティアに行く', roles: ['citizen'], phases: ['hinan', 'fukko'],
    desc: '社会福祉協議会の災害ボランティアセンターを通して、泥かきや物資の仕分けを手伝う（体力40）。',
    check(g, d) { if (num(d.done.volunteer) === today(g)) return '今日はもう行った'; if (num(g.state.stamina) < 40) return '体力が足りない（体力40）'; return null; },
    run(g, d) {
      const st = g.state;
      st.stamina = Math.max(0, num(st.stamina) - 40);
      d.done.volunteer = today(g);
      d.volunteerDays = num(d.volunteerDays) + 1;
      try { if (typeof g.addNeed === 'function') { g.addNeed('stress', -4); g.addNeed('clean', -25); } } catch (e) { /* ignore */ }
      if (num(st.fame) >= 300 && typeof g.addFame === 'function') g.addFame(10, true);
      queueScene(g, 'volunteer', {}, { front: true });
      return '災害ボランティアセンターで受付をして、泥かきと物資の仕分けを手伝った。くたくただけど、ありがとうと言われた。';
    },
  },
  charity: {
    name: 'チャリティを呼びかける', roles: ['celebrity'], phases: ['hinan', 'fukko'],
    desc: 'チャリティ番組・イベントに出て、義援金を呼びかける（知名度★300から）。',
    check(g, d) { if (d.done.charity) return 'すでに呼びかけた'; if (num(g.state.stamina) < 20) return '体力が足りない（体力20）'; return null; },
    run(g, d) {
      const st = g.state;
      st.stamina = Math.max(0, num(st.stamina) - 20);
      d.done.charity = today(g);
      const raised = Math.round((num(st.fame) * 2000 + num(st.fans) * 50 + rint(0, 3000000)) / 10000) * 10000;
      d.raised = raised;
      if (typeof g.addFame === 'function') g.addFame(30, true);
      if (typeof g.addFans === 'function') g.addFans(200, true);
      news(g, `${st.name}さんらが出演したチャリティ企画に、${fmtMoney(raised)}の義援金が集まった`, { feed: false });
      queueScene(g, 'charity', { raised }, { front: true });
      return `チャリティ企画に出演し、義援金を呼びかけた。${fmtMoney(raised)}が集まった。`;
    },
  },
  safety: {
    name: '家族に無事を伝える', roles: ['citizen'], phases: ['hassei', 'shodo'],
    desc: '災害用伝言ダイヤルやメッセージで、家族に無事を知らせる。',
    check(g, d) { if (!d.home) return '地元の災害ではない'; if (d.done.safety) return 'すでに知らせた'; return null; },
    run(g, d) {
      d.done.safety = today(g);
      try { if (typeof g.addNeed === 'function') g.addNeed('stress', -6); } catch (e) { /* ignore */ }
      return since(g, 1998, 3) ? '家族に無事を知らせた。（災害用伝言ダイヤル171は1998年から）' : '公衆電話の列に並んで、家族に無事を知らせた。';
    },
  },
};
export const DISASTER_ACTION_ORDER = Object.keys(DISASTER_ACTIONS);
function disasterRefusal(g, id) {
  const A = DISASTER_ACTIONS[id];
  if (!A) return 'そんな対応はない';
  const d = R(g).disaster;
  if (!d || d.phase === 'done') return 'いま対応が必要な災害は起きていない';
  const roles = roleOf(g);
  if (!A.roles.some((x) => roles.includes(x))) {
    const need = { pm: '内閣総理大臣', defmin: postName(g, 'minister_defense'), finmin: postName(g, 'minister_finance'), chiji: '東京都知事', kucho: 'ドット区長', local: '地方議員', diet: '国会議員', minister: '大臣', celebrity: '知名度★300以上の芸能人', citizen: 'だれでも' };
    return `いまの立場ではできない（${A.roles.map((x) => need[x] || x).join('・')}ができる）`;
  }
  if (!A.phases.includes(d.phase)) return 'いまの段階ではできない';
  if ((A.roles.includes('pm') || A.roles.includes('defmin')) && !pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  return A.check ? A.check(g, d) : null;
}
// NPCs do what the player's roles do not (with the usual timing).
function npcDisaster(g, d) {
  const roles = roleOf(g);
  const days = today(g) - d.start;
  if (!d.honbu && !roles.includes('pm') && d.tier >= 2) {
    d.honbu = d.tier >= 3 ? 'kinkyu' : 'hijo';
    d.done.honbu = today(g);
    news(g, `政府が${d.name}の${honbuName(g, d.honbu)}を設置した（本部長：${honbuChief(g, d.honbu)}）`);
  }
  if (!d.done.haken && !R(g).sdf.haken && d.tier >= (d.home ? 1 : 2) && !(roles.includes('chiji') && d.home) && !roles.includes('pm') && !roles.includes('defmin')) {
    if (days >= 0) { d.done.request = today(g); dispatchSDF(g, d, 'npc'); }
  }
  // the player is the one who decides, but did not: a nudge (and the cost of waiting)
  if (roles.includes('pm') && d.tier >= 2 && !d.honbu && days >= 1 && !d.flags_honbuLate) { d.flags_honbuLate = true; bumpApproval(g, -4); news(g, `${d.name}で政府の対策本部の設置が遅れていると批判が出ている`); }
  if (roles.includes('chiji') && d.home && !d.done.haken && days >= 1 && !d.flags_reqLate) { d.flags_reqLate = true; const me = meOf(g); if (me) me.reputation = clamp(num(me.reputation) - 4, -100, 100); news(g, '東京都の自衛隊への派遣要請が遅れたとの指摘'); }
  if (!d.done.gekijin && d.tier >= 2 && days >= rint(6, 12) && !roles.includes('pm')) { d.done.gekijin = today(g); news(g, `政府は${d.name}を激甚災害に指定した（政令・閣議決定）`); }
  if (!d.done.hosei && d.tier >= 2 && days >= 10 && !roles.includes('pm') && !roles.includes('finmin')) {
    d.done.hosei = today(g);
    news(g, `政府が${d.name}の復旧のための補正予算案をまとめた`);
  }
  if (!d.done.plan && d.tier >= 2 && days >= 20 && !roles.includes('pm')) { d.done.plan = today(g); news(g, `政府が${d.name}からの復興の基本方針を決めた`); }
}
function disasterTick(g) {
  const r = R(g);
  const d = r.disaster;
  if (!d) return;
  if (d.phase === 'done') { r.disaster = null; return; }
  const days = today(g) - d.start;
  revealCasualties(g, d);
  const prev = d.phase;
  const hinanEnd = d.tier >= 3 ? 40 : d.tier === 2 ? 15 : 4;
  const fukkoEnd = d.tier >= 3 ? 240 : d.tier === 2 ? 100 : 12;
  if (days >= 1 && d.phase === 'hassei') d.phase = 'hinan';
  if (d.phase === 'shodo' && days >= 1) d.phase = 'hinan';
  if (d.phase === 'hinan' && days >= hinanEnd) d.phase = 'fukko';
  if (d.phase === 'fukko' && days >= fukkoEnd) d.phase = 'done';
  npcDisaster(g, d);
  if (r.sdf.haken && r.sdf.haken.disaster === d.id && (d.phase === 'fukko' || d.phase === 'done') && days >= hinanEnd + 2) {
    news(g, `${d.where}での自衛隊の災害派遣が終わった（のべ約${n0(r.sdf.haken.personnel * Math.max(1, Math.round((today(g) - r.sdf.haken.start) / 2)))}人）`);
    r.sdf.haken = null;
  }
  if (days === 1 || days === 3 || days === 7) news(g, `${d.name}：${disasterSummary(g, d)}`);
  if (prev !== d.phase) {
    emit(g, 'disaster', { phase: d.phase, d });
    if (d.phase === 'hinan' && d.tier >= 2) queueScene(g, 'disaster', { phase: 'hinan' });
    if (d.phase === 'fukko' && d.tier >= 2) queueScene(g, 'disaster', { phase: 'fukko' });
    if (d.phase === 'done') {
      const evalText = d.tier >= 2 && roleOf(g).includes('pm') ? (d.score >= 7 ? '政府の対応は、おおむね評価された' : d.score >= 4 ? '政府の対応には、評価と批判が相半ばした' : '政府の対応の遅れが批判された') : '';
      if (evalText) bumpApproval(g, d.score >= 7 ? 3 : d.score >= 4 ? 0 : -4);
      r.disasters.unshift({ id: d.id, name: d.name, kind: d.kind, tier: d.tier, start: d.start, end: today(g), dead: d.plan.dead, missing: d.plan.missing, evac: d.plan.evac, score: d.score, donated: num(d.donated), raised: num(d.raised) });
      if (r.disasters.length > 20) r.disasters.length = 20;
      news(g, `${d.name}の被災地で、避難所がすべて閉じられた${evalText ? `。${evalText}` : ''}`);
    }
  }
}
// The disaster itself: the politics core's shocks (quake / storm) or our own roll.
function maybeDisaster(g, fromShock) {
  const r = R(g);
  if (today(g) < 15 || (r.disaster && r.disaster.phase !== 'done') || today(g) - r.lastDisasterDay < 40) return null;
  if (fromShock === 'quake') return startDisaster(g, { kind: roll(0.25) ? 'tsunami' : 'quake', fromShock: true });
  if (fromShock === 'storm') return roll(0.35) ? startDisaster(g, { kind: 'storm', fromShock: true }) : null;
  return null;
}
// work stops in the player's town for a few days (shows cancelled; no "missed" regular)
function cancelWork(g) {
  const r = R(g);
  if (today(g) > r.cancelUntil) return;
  const st = g.state;
  try {
    const regs = st.regulars || {};
    const week = typeof g.week === 'number' ? g.week : null;
    if (week != null && typeof g.regularsToday === 'function') {
      for (const id of Object.keys(regs)) {
        const s = regs[id];
        if (s && !s.dropped && (g.regularsToday() || []).includes(id)) s.doneWeek = Math.max(num(s.doneWeek), week);
      }
    }
  } catch (e) { console.error(e); }
}

// ======================================================================== events of the 自衛隊 (fictional nations only)
function sdfEvents(g) {
  const r = R(g);
  const y = yearOf(g);
  if (r.sdf.scrambleYear !== y) { r.sdf.scrambleYear = y; r.sdf.scrambles = 0; }
  // scrambles (対領空侵犯措置, 84条): news a few times a year
  if (roll(4 / YEAR_DAYS)) {
    const nat = pick(['keldoa', 'keldoa', 'nevalon']);
    r.sdf.scrambles += rint(20, 60);
    news(g, `航空自衛隊が、${FICTIONAL_NATIONS[nat].short}の軍用機に緊急発進（スクランブル）。領空侵犯はなかった（自衛隊法84条・架空の国）`, { feed: false });
  }
  // a suspicious ship (海上警備行動の判断): rare
  if (!r.sdf.kaijo && roll(0.5 / YEAR_DAYS) && r.id !== 'dictatorship') {
    const nat = pick(['luzenia', 'nevalon']);
    r.sdf.kaijo = { nation: nat, day: today(g) };
    news(g, `${FICTIONAL_NATIONS[nat].short}籍とみられる不審船が領海に入った。海上保安庁が追跡している（架空の国）`);
    if (isPM(g) || isDefMin(g)) queueScene(g, 'kaijo', { nation: nat });
  }
  if (r.sdf.kaijo && today(g) - r.sdf.kaijo.day > 3) {
    if (!r.sdf.kaijo.done) news(g, `不審船は海上保安庁の警告を受けて領海の外へ去った`);
    r.sdf.kaijo = null;
  }
  // a UN request for a PKO (fictional mission), when the law exists
  if (!r.sdf.pkoOffer && pkoLawOk(g) && r.id === 'democracy' && roll(0.6 / YEAR_DAYS) && !r.sdf.deployments.some((d) => !d.ended && d.kind === 'pko')) {
    const where = pick(['ネヴァロン共和国の内陸部（架空の国）', 'ルーゼニア王国の離島（架空の国）']);
    r.sdf.pkoOffer = { where, mission: `国連${where.startsWith('ネヴァロン') ? 'ネヴァロン' : 'ルーゼニア'}停戦監視団`, personnel: rint(300, 600), day: today(g) };
    news(g, `国連が日本に、${r.sdf.pkoOffer.mission}（架空）への参加を要請した。停戦合意と受入れ同意はある`);
    if (isPM(g) || isDefMin(g)) queueScene(g, 'pko_offer', {});
  }
  if (r.sdf.pkoOffer && today(g) - r.sdf.pkoOffer.day > 30) { if (!isPM(g)) news(g, `政府は${r.sdf.pkoOffer.mission}への参加を見送った`); r.sdf.pkoOffer = null; }
  for (const d of r.sdf.deployments) {
    if (!d.ended && today(g) >= d.end) { d.ended = today(g); news(g, `${d.mission}に派遣されていた自衛隊の部隊が任務を終えて帰国した`); }
  }
  if (r.sdf.deployments.length > 12) r.sdf.deployments = r.sdf.deployments.slice(-12);
}

// ======================================================================== the war (dictatorship + 国軍, fictional nations only)
export const WAR_ORDERS = {
  declare: { name: '宣戦（もしも）', desc: '係争地ヴェルミナ諸島をめぐり、架空の国に宣戦する。' },
  mobilize: { name: '動員', desc: '予備の要員を召集し、兵力を増やす。経済と暮らしへの負担が大きい。' },
  offensive: { name: '攻勢', desc: '係争地の軍事目標に向けて前進する。戦況は動くが、兵士の死傷が増える。' },
  defend: { name: '防衛', desc: '守りを固める。死傷は減るが、戦況は動きにくい。' },
  negotiate: { name: '停戦交渉', desc: '第三国を通じて停戦を交渉する。戦況が悪すぎると相手は応じない。' },
  surrender: { name: '降伏', desc: '降伏する。戦争は終わるが、独裁者としての命運も尽きる。' },
};
export const WAR_ORDER_LIST = Object.keys(WAR_ORDERS);
function warRefusal(g, kind, opts = {}) {
  const r = R(g);
  if (!WAR_ORDERS[kind]) return 'そんな命令はない';
  if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  if (r.id !== 'dictatorship') return r.id === 'fallen' ? '体制はもう崩れている' : '憲法9条：民主制の日本は、国際紛争を解決する手段として戦争をしない（侵略戦争はできない）。自衛隊は専守防衛';
  if (!isPM(g)) return '独裁者（総理）でなければ命じられない';
  const w = r.war;
  if (kind === 'declare') {
    if (!r.steps.army) return 'まず自衛隊を国軍に改める（もしも）。自衛隊のままでは、他国を攻める組織も法もない';
    if (w && w.phase === 'war') return 'すでに戦争中';
    if (opts.target && !FICTIONAL_NATIONS[opts.target]) return '相手は架空の国だけ（ネヴァロン共和国・ルーゼニア王国・ケルドア連邦）';
    if (r.wars.length && today(g) - num(r.wars[r.wars.length - 1].end) < 30) return '前の戦争が終わったばかり（国も軍も疲れきっている）';
    return null;
  }
  if (!w || w.phase !== 'war') return 'いまは戦争をしていない';
  if (kind === 'mobilize' && w.mob >= 3) return 'これ以上は動員できない（すでに総動員）';
  if (kind === 'negotiate' && w.talks) return 'すでに交渉している';
  if (kind === 'negotiate' && today(g) - num(w.lastTalks, -99) < 6) return '交渉は決裂したばかり。少し時間をおく';
  return null;
}
function newWar(g, target) {
  const nat = FICTIONAL_NATIONS[target] || FICTIONAL_NATIONS.nevalon;
  return {
    enemy: nat.id, start: today(g), phase: 'war', front: 0, stance: 'defend', mob: 0, talks: null, lastTalks: -99,
    cas: { soldiers: { dead: 0, wounded: 0 }, civilians: { dead: 0, wounded: 0 }, enemySoldiers: 0, enemyCivilians: 0 },
    cost: 0, weariness: 0, support: 0, letters: 0, log: [{ day: today(g), text: `${nat.name}に宣戦` }], end: null, result: null,
  };
}
function warOrder(g, kind, opts = {}) {
  const r = R(g);
  const why = warRefusal(g, kind, opts);
  if (why) return { ok: false, why };
  if (kind === 'declare') {
    const target = FICTIONAL_NATIONS[opts.target] ? opts.target : 'nevalon';
    const w = r.war = newWar(g, target);
    r.record.wars++;
    fictionNotice(g);
    raiseIntl(g, 25, `${FICTIONAL_NATIONS[target].name}への宣戦`);
    r.unrest = clamp(r.unrest + 12, 0, 100);
    bumpApproval(g, -6, -4);
    ecoShock(g, '戦争', { growth: -2.5, inflation: 2.5, yen: 15, len: 360, nikkei: -12 });
    news(g, `【もしも】政府は${DISPUTED_AREA.name}をめぐり、${FICTIONAL_NATIONS[target].name}（架空の国）に宣戦した`);
    phone(g, `【もしもシミュレーション】\n政府が${FICTIONAL_NATIONS[target].name}（架空の国）に宣戦した。\n国連と各国が即時停戦を求めている。\n（${FICTION_NOTE}）`, 'ドット新聞 国際部');
    familyMessage(g, '{name}、戦争なんて本当なの？\n近所の人も、みんな不安がってる。\nお願いだから、引き返して…。');
    queueScene(g, 'war', { event: 'declare' });
    emit(g, 'war', { kind, war: w });
    return { ok: true, text: `${FICTIONAL_NATIONS[target].name}に宣戦した。` };
  }
  const w = r.war;
  const nat = FICTIONAL_NATIONS[w.enemy];
  if (kind === 'mobilize') {
    w.mob++;
    w.weariness = clamp(w.weariness + 8, 0, 100);
    r.unrest = clamp(r.unrest + 6, 0, 100);
    ecoShock(g, `動員（第${w.mob}次）`, { growth: -0.8, inflation: 0.8, unemployment: -0.3, len: 200 });
    news(g, `【もしも】政府が第${w.mob}次の動員を命じた。各地で召集令状が届き、家族が見送っている`);
    familyMessage(g, w.mob === 1 ? 'となりの家の息子さんにも、召集の知らせが来たって…。\n{name}、こんなことはもうやめて。' : '町から若い人がいなくなっていく。\nみんな、口には出さないけど怒ってるよ。');
    w.log.push({ day: today(g), text: `第${w.mob}次動員` });
    return { ok: true, text: `第${w.mob}次の動員を命じた。兵力は増えるが、暮らしへの負担と不満も大きい。` };
  }
  if (kind === 'offensive' || kind === 'defend') {
    w.stance = kind === 'offensive' ? 'offense' : 'defend';
    w.log.push({ day: today(g), text: kind === 'offensive' ? '攻勢に転じる' : '防衛に徹する' });
    news(g, kind === 'offensive' ? `【もしも】国軍が${DISPUTED_AREA.name}の軍事目標に向けて攻勢に出た` : '【もしも】国軍は守りを固める方針に切り替えた');
    return { ok: true, text: kind === 'offensive' ? '攻勢を命じた。戦況は動くが、死傷者は増える。' : '防衛を命じた。死傷は減るが、戦況は動きにくい。' };
  }
  if (kind === 'negotiate') {
    w.talks = { day: today(g), until: today(g) + rint(4, 8) };
    news(g, `【もしも】政府は第三国を通じて${nat.name}との停戦交渉に入った`);
    return { ok: true, text: '第三国を通じて停戦交渉を始めた。数日で答えが出る。' };
  }
  if (kind === 'surrender') {
    endWar(g, 'surrender');
    return { ok: true, text: '降伏した。' };
  }
  return { ok: false, why: 'そんな命令はない' };
}
function warTick(g) {
  const r = R(g);
  const w = r.war;
  if (!w || w.phase !== 'war') return;
  const nat = FICTIONAL_NATIONS[w.enemy];
  const days = today(g) - w.start;
  // the enemy gets help from other countries as time goes on; sanctions starve our supply
  w.support = clamp(w.support + 0.6 + r.intl * 0.01, 0, 60);
  const own = 60 + w.mob * 12 - w.weariness * 0.25 - r.sanctions * 6 - num(r.sdf.quit) / 2000;
  const foe = nat.power + w.support * 0.6;
  const push = (own - foe) * 0.05 + (w.stance === 'offense' ? 1.2 : -0.4) + gauss() * 2.2;
  w.front = clamp(w.front + push, -100, 100);
  // the human cost (numbers only): soldiers of both sides, civilians caught in the war
  const intensity = (w.stance === 'offense' ? 1.6 : 0.9) * (1 + w.mob * 0.25);
  const sd = Math.round(rint(15, 70) * intensity), sw = Math.round(sd * rint(2, 4));
  const cd = Math.round(rint(2, 18) * (w.front < -30 ? 2 : 1)), cw = Math.round(cd * rint(2, 5));
  w.cas.soldiers.dead += sd; w.cas.soldiers.wounded += sw;
  w.cas.civilians.dead += cd; w.cas.civilians.wounded += cw;
  w.cas.enemySoldiers += Math.round(sd * (0.7 + rnd() * 0.6));
  w.cas.enemyCivilians += Math.round(cd * (0.8 + rnd() * 0.8));
  w.cost = Math.round((w.cost + 0.08 + w.mob * 0.03) * 100) / 100;
  w.weariness = clamp(w.weariness + 0.6 + sd / 120 + cd / 40 + Math.max(0, -w.front) / 200, 0, 100);
  r.unrest = clamp(r.unrest + 0.25 + w.weariness / 250, 0, 100);
  r.intl = clamp(r.intl + 0.2, 0, 100);
  // a letter from a family (fictional, sober) every few days
  if (days > 0 && days % 4 === 0) {
    w.letters++;
    const L = pick([
      ['ある母親', '息子は前線にいます。手紙が届かなくなって十日になります。どうか、無事に帰してください。'],
      ['ある妻', '夫が召集されて一か月。子どもは毎晩「お父さんはいつ帰るの」と聞きます。'],
      ['ある父親', '娘は衛生兵として派遣されました。けが人の手当てに追われていると、短い便りがありました。'],
      ['ある祖母', '孫の名前が、戦死者の名簿にありました。あの子はまだ二十歳でした。'],
      ['ある高校生', '兄が帰ってきません。ニュースは勝っていると言うけれど、町は静かで、だれも笑っていません。'],
    ]);
    phone(g, `【読者からの手紙】${L[0]}より\n${L[1]}`, 'ドット新聞 読者の声');
  }
  if (days > 0 && days % 5 === 0) news(g, `【もしも】戦況：${frontText(w.front)}。死傷者（自国）兵士${n0(w.cas.soldiers.dead + w.cas.soldiers.wounded)}人・民間人${n0(w.cas.civilians.dead + w.cas.civilians.wounded)}人`);
  // talks
  if (w.talks && today(g) >= w.talks.until) {
    const ok = roll(clamp(0.35 + w.front / 150 + (w.weariness > 50 ? 0.1 : 0), 0.05, 0.85));
    w.talks = null;
    w.lastTalks = today(g);
    if (ok) { endWar(g, 'ceasefire'); return; }
    news(g, `【もしも】${nat.name}との停戦交渉は決裂した`);
  }
  if (w.front <= -100) { endWar(g, 'defeat'); return; }
  if (w.front >= 100) { endWar(g, 'victory'); return; }
}
const frontText = (f) => (f >= 60 ? '係争地の大部分を押さえた' : f >= 20 ? 'やや優勢' : f > -20 ? 'こう着' : f > -60 ? '劣勢' : '前線が崩れかけている');
function endWar(g, how) {
  const r = R(g);
  const w = r.war;
  if (!w) return;
  const nat = FICTIONAL_NATIONS[w.enemy];
  w.phase = how === 'ceasefire' ? 'ceasefire' : how === 'victory' ? 'victory' : 'defeat';
  w.end = today(g);
  w.result = how;
  r.record.soldiers += w.cas.soldiers.dead;
  r.record.civilians += w.cas.civilians.dead;
  r.record.enemy += w.cas.enemySoldiers + w.cas.enemyCivilians;
  r.wars.push({ enemy: w.enemy, start: w.start, end: w.end, result: how, cas: JSON.parse(JSON.stringify(w.cas)), cost: w.cost });
  emit(g, 'war', { kind: 'end', how, war: w });
  if (how === 'ceasefire') {
    news(g, `【もしも】${nat.name}との停戦が成立した。死者は兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人にのぼった`);
    phone(g, `【停戦】${nat.name}との停戦が成立した。\n死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人。\n制裁は続き、物価は高いままだ。`, 'ドット新聞 国際部');
    r.unrest = clamp(r.unrest - 5, 0, 100);
    queueScene(g, 'war', { event: 'ceasefire' });
    r.war = null;
    return;
  }
  if (how === 'victory') {
    // a hollow, inglorious victory: isolation, insurgency, cost
    news(g, `【もしも】国軍が${DISPUTED_AREA.name}を占領した。各国は占領を認めず、制裁を強めた。島では抵抗が続いている`);
    phone(g, `【もしも】${DISPUTED_AREA.name}は占領されたが、どの国も認めていない。\n死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人。\n戦費 約${w.cost}兆円。制裁はさらに強まった。`, 'ドット新聞 国際部');
    raiseIntl(g, 20, '占領');
    r.unrest = clamp(r.unrest + 8, 0, 100);
    ecoShock(g, '占領の費用と制裁', { growth: -1.5, inflation: 1.5, len: 360 });
    queueScene(g, 'war', { event: 'victory' });
    r.war = null;
    return;
  }
  // defeat or surrender: the downfall
  news(g, `【もしも】国軍は${nat.name}に敗れた。政府は降伏し、首都では群衆が政府庁舎を取り囲んでいる`);
  r.war = null;
  fall(g, how === 'surrender' ? 'surrender' : 'defeat');
}

// ======================================================================== unrest, uprising, the dictatorship's daily life
function unrestTick(g) {
  const r = R(g);
  if (r.id === 'democracy') {
    r.unrest = Math.max(0, r.unrest - 0.4);
    r.intl = Math.max(0, r.intl - 0.15);
    if (r.intl < 20) r.sanctions = 0;
    r.approvalMod *= 0.99;
    return;
  }
  if (r.id === 'fallen') return;
  const p = pol(g);
  const infl = p && p.economy ? num(p.economy.inflation) : 0;
  r.unrest = clamp(r.unrest + (r.id === 'dictatorship' ? 0.12 : 0.05) + Math.max(0, infl - 3) * 0.04 + r.sanctions * 0.05 + (approvalOf(g) < 25 ? 0.1 : -0.05) + (r.press.detained ? 0.05 : 0), 0, 100);
  // warnings before an uprising
  const lv = r.unrest;
  if (lv >= 50 && !r.flags.warn50) { r.flags.warn50 = true; news(g, '【もしも】各地で政府への抗議が広がっている。治安部隊との小競り合いも'); spawnDemo(g, { cause: '独裁への抗議', size: 'large', against: 'government' }); }
  if (lv >= 70 && !r.flags.warn70) { r.flags.warn70 = true; news(g, '【もしも】全国でゼネスト。国軍の一部の部隊が、市民に向けた出動を拒んだと伝えられる'); queueScene(g, 'uprising_warn', {}); }
  if (lv < 40) { r.flags.warn50 = false; if (lv < 60) r.flags.warn70 = false; }
  if (r.id === 'dictatorship') {
    const p2 = Math.pow(Math.max(0, (lv - 60) / 40), 2) * 0.08;
    if (p2 > 0 && roll(p2)) { fall(g, 'uprising'); return; }
    // the politics core: no 総理おろし inside a dictatorship; the budget is run by decree
    if (p && p.cabinet && p.cabinet.pending && p.cabinet.pending.kind === 'resign') { p.cabinet.pending = null; news(g, '【もしも】党内の退陣要求は封じられた'); }
    if (p && p.economy && p.economy.budget && !p.economy.budget.passed && r.steps.diet) { p.economy.budget.passed = true; news(g, '【もしも】国会を通さず、予算が政令で執行された'); }
  }
  // the emergency with a sitting Diet: the lawful way to remove the PM (不信任 → 退陣)
  if (r.id === 'emergency' && !r.steps.diet && p && p.diet && p.diet.shugi && isPM(g)) {
    const pi = partyOf(g);
    const mine = pi ? num(p.diet.shugi.seats[pi.id]) : 0;
    if (pi && mine < num(p.diet.shugi.total) / 2 && approvalOf(g) < 25 && roll(0.04)) {
      news(g, '国会で内閣不信任決議案が可決された。緊急事態のもとでも、国会は総理を退陣させた');
      lawfulRemoval(g, '内閣不信任決議の可決');
    }
  }
}
// The PM is removed lawfully (不信任・判決・党の機関): democracy comes back, the courts take over.
function lawfulRemoval(g, why) {
  const r = R(g);
  if (r.id === 'democracy' || r.id === 'fallen') return;
  restoreDemocracy(g, why);
  try { if (isPM(g) && typeof g.resignPM === 'function') g.resignPM(why); } catch (e) { console.error(e); }
  scheduleTrial(g, 'removal');
}

// ======================================================================== the trial (crime.js) after stepping down / removal
function registerCrime() {
  if (!CRIME || !CRIME.CRIMES || CRIME.CRIMES.abuse_power) return;
  const def = {
    id: 'abuse_power', name: '職権濫用（強権政治）', short: '公務員職権濫用',
    law: (g) => `公務員職権濫用罪（刑法193条）：公務員がその職権を濫用して、人に義務のないことを行わせ、又は権利の行使を妨害すると、2年以下の${laborWord(g)}`,
    severity: 4, kind: 'crime', political: true, hotDays: 999,
    detect: () => 0,
    later: () => 0,
    penalty: () => ({ prison: [1, 24], labor: 'both', fine: null }),
    facts: (cs, g) => `内閣総理大臣の職権を濫用し、${trialWhat(g)}`,
    typical: (g) => { const w = trialWeight(g); return { charge: 1, months: clamp(12 + w * 2, 12, 24), suspendOk: w < 4 }; },
  };
  CRIME.CRIMES.abuse_power = def;
  if (Array.isArray(CRIME.CRIME_ORDER) && !CRIME.CRIME_ORDER.includes('abuse_power')) CRIME.CRIME_ORDER.push('abuse_power');
}
const trialWeight = (g) => { try { return num(g && g.state && g.state.regime && g.state.regime.trial && g.state.regime.trial.weight, 2); } catch (e) { return 2; } };
function trialWhat(g) {
  try {
    const r = R(g);
    const s = r.record.steps.map((x) => x.step).join(' ');
    const out = [];
    if (r.record.detained) out.push(`政府に批判的な記者${r.record.detained}人を拘束させ`);
    if (/検閲/.test(s)) out.push('報道機関に検閲を受け入れさせ');
    if (/野党/.test(s)) out.push('政党の活動を禁じ');
    if (!out.length) out.push('報道機関に番組の変更や記者の排除を行わせ');
    return `${out.join('、')}、人の権利の行使を妨げた`;
  } catch (e) { return '人の権利の行使を妨げた'; }
}
function repressionWeight(g) {
  const r = R(g);
  const s = r.record.steps.map((x) => x.step);
  let w = 0;
  if (s.some((x) => /拘束/.test(x)) || r.record.detained) w += 2;
  if (s.some((x) => /検閲/.test(x))) w += 1;
  if (s.some((x) => /野党/.test(x))) w += 1;
  if (r.record.wars) w += 2;
  if (s.some((x) => /判決の無視/.test(x))) w += 1;
  return w;
}
function scheduleTrial(g, how) {
  const r = R(g);
  const w = repressionWeight(g);
  if (w <= 0) {
    r.trial = { day: today(g), how, charged: false };
    news(g, `${g.state.name}前総理について、検察は刑事責任を問わないと判断した`);
    queueScene(g, 'stepdown', { charged: false, how });
    return;
  }
  r.trial = { day: today(g) + 2, how, charged: true, weight: w, done: false };
  queueScene(g, 'stepdown', { charged: true, how });
}
async function runTrial(g) {
  const r = R(g);
  const t = r.trial;
  if (!t || !t.charged || t.done) return;
  t.done = true;
  emit(g, 'trial', { how: t.how, weight: t.weight });
  if (CRIME && CRIME.CRIMES && CRIME.CRIMES.abuse_power && typeof g.arrest === 'function') {
    try {
      await g.arrest('abuse_power', { via: 'warrant', evidence: 0.95, amount: 0, source: '特捜部の捜査' });
      return;
    } catch (e) { console.error(e); }
  }
  // without the justice core: a short summary
  await g.say([`${g.state.name}前総理は、職権濫用の罪で起訴された。`, '（刑法193条：公務員職権濫用罪）', '裁判の結果、有罪となった。政治の世界に戻る道は、もうない。']);
}

// ======================================================================== the downfall (fallen): never saved over the player's save
function fall(g, cause) {
  const r = R(g);
  if (r.id === 'fallen') return;
  r.fall = { day: today(g), cause, label: regimeLabel(g).label, from: r.id };
  setRegime(g, 'fallen', cause);
  r.queue = [{ id: 'downfall', day: today(g), data: { cause } }];
  emit(g, 'fall', { cause });
}
export function regimeRecord(g) {
  const r = R(g);
  const st = g.state || {};
  const p = pol(g);
  const me = p && p.me;
  const w = r.wars;
  return {
    name: st.name || '', day: today(g), date: dateText(g), cause: r.fall ? r.fall.cause : null,
    pmDays: me ? num(me.pmDays) : 0, maxRegime: r.record.maxRegime, label: r.fall ? r.fall.label : regimeLabel(g).label,
    steps: r.record.steps.map((x) => x.step), wars: w.length, soldiers: w.reduce((a, x) => a + num(x.cas.soldiers.dead), 0),
    civilians: w.reduce((a, x) => a + num(x.cas.civilians.dead), 0), enemy: w.reduce((a, x) => a + num(x.cas.enemySoldiers) + num(x.cas.enemyCivilians), 0),
    wounded: w.reduce((a, x) => a + num(x.cas.soldiers.wounded) + num(x.cas.civilians.wounded), 0), cost: Math.round(w.reduce((a, x) => a + num(x.cost), 0) * 10) / 10,
    detained: r.record.detained, press: Math.round(pressValue(g)), intl: Math.round(r.intl), sanctions: r.sanctions, disasters: r.record.disasters,
    fame: num(st.fame), money: num(st.money), days: today(g),
  };
}
// Back to the title. The save on disk is the last one made before the fall (saving is blocked once fallen).
function backToTitle(g) {
  try { if (typeof g.toTitle === 'function') { g.toTitle(); return; } } catch (e) { console.error(e); }
  try {
    const q = new URLSearchParams(location.search);
    const keep = new URLSearchParams();
    for (const k of ['debug', 'touch']) if (q.has(k)) keep.set(k, q.get(k));
    const s = keep.toString();
    location.href = location.pathname + (s ? `?${s}` : '');
  } catch (e) { console.error(e); }
}

// ======================================================================== scenes (KIKI.show from kiki.js; text fallback)
// KIKI.show(g, spec) → the chosen option's value (or null); spec: { art, title, sub, pages[], options?: [{ label, value }],
//   prompt?, alert?, headline?, numbers? }. KIKI.downfall(g, record) and KIKI.record(g, record) for the end of a life.
export const KIKI = { show: null, downfall: null, record: null };
async function show(g, spec) {
  if (typeof KIKI.show === 'function') return KIKI.show(g, spec);
  if (spec.pages && spec.pages.length) await g.say(spec.pages);
  if (spec.options && spec.options.length) {
    const i = await g.ask(spec.prompt || 'どうする？', spec.options.map((o) => o.label));
    return spec.options[i] ? spec.options[i].value : null;
  }
  return null;
}
function queueScene(g, id, data = {}, opts = {}) {
  const r = R(g);
  if (r.id === 'fallen' && id !== 'downfall') return;
  if (r.queue.some((q) => q.id === id && JSON.stringify(q.data) === JSON.stringify(data))) return;
  const q = { id, day: today(g), data };
  if (opts.front) r.queue.unshift(q); else r.queue.push(q);
  if (r.queue.length > 8) r.queue.length = 8;
}
function canShow(g) {
  const st = g.state;
  if (!st || !g.map || !g.map.place || g._kikiRunning) return false;
  if (g.busy || g.top !== g.map || g.fade > 0) return false;
  if (g.map.player && g.map.player.moving) return false;
  try { if (typeof g.isFree === 'function' && !g.isFree()) return R(g).id === 'fallen'; } catch (e) { /* ignore */ }
  return true;
}
async function flush(g) {
  const r = R(g);
  if (g._kikiRunning) return;
  g._kikiRunning = true;
  try {
    for (let guard = 0; guard < 8 && r.queue.length; guard++) {
      const q = r.queue.shift();
      // a stale scene (days old) is dropped, except the ones that matter
      if (today(g) - num(q.day) > 3 && !['downfall', 'referendum', 'court', 'stepdown'].includes(q.id)) continue;
      const fn = SCENES[q.id];
      if (!fn) continue;
      try { await fn(g, q.data || {}); } catch (e) { console.error(e); }
      if (q.id === 'downfall') return;
    }
  } finally { g._kikiRunning = false; }
  if (r.trial && r.trial.charged && !r.trial.done && today(g) >= r.trial.day) await runTrial(g);
}
// the options of a scene: what the player can do now (disaster actions, steps), plus "later"
function actionOptions(g, ids, later = 'あとで') {
  const out = [];
  for (const id of ids) {
    const A = DISASTER_ACTIONS[id];
    if (A && !disasterRefusal(g, id)) out.push({ label: A.name, value: id });
  }
  out.push({ label: later, value: null });
  return out;
}
async function doDisasterChoice(g, id) {
  if (!id) return;
  const res = g.disasterAction(id);
  if (res && res.text) await g.say(res.text);
  else if (res && res.why) await g.say(res.why);
}
const SCENES = {
  async disaster(g, data) {
    const r = R(g);
    const d = r.disaster;
    if (!d) return;
    const roles = roleOf(g);
    const K = DISASTER_KINDS[d.kind];
    if (data.phase === 'hassei') {
      const eew = (d.kind === 'quake' || d.kind === 'tsunami') && d.home;
      const alert = eew ? (since(g, 2007, 12) ? { kind: 'phone', text: '緊急地震速報　強い揺れに警戒' } : since(g, 2007, 10) ? { kind: 'tv', text: '緊急地震速報' } : { kind: 'tv', text: '地震速報' }) : d.kind === 'storm' ? { kind: 'tv', text: since(g, 2013, 8) ? '大雨特別警報' : '大雨警報' } : d.kind === 'volcano' ? { kind: 'tv', text: '噴火速報' } : { kind: 'tv', text: '地震速報' };
      const pages = [];
      if (eew && since(g, 2007, 12)) pages.push(`${g.state.name}のケータイが、聞いたことのない音で鳴りはじめた。\n「緊急地震速報。強い揺れに警戒してください」`);
      else if (eew && since(g, 2007, 10)) pages.push('テレビから警報音が流れた。\n「緊急地震速報です。強い揺れに警戒してください」');
      if (d.kind === 'quake' || d.kind === 'tsunami') pages.push(d.home ? `……数秒後、大きな揺れが来た。\n棚の物が落ち、窓ガラスが鳴る。\n${g.state.name}は、とっさに机の下にもぐった。` : `テレビのニュース速報が流れた。\n「${d.where}で強い地震」`);
      else if (d.kind === 'storm') pages.push(`${d.where}で記録的な大雨。\n川があふれ、各地で土砂崩れが起きている。`);
      else pages.push('ドット岳（架空の火山）が噴火した。\n噴煙が空高く上がり、ふもとの町に避難指示が出た。');
      pages.push(`【${d.name}】${d.mag ? `マグニチュード${d.mag}・最大震度${d.shindo}。` : ''}${d.kind === 'tsunami' ? '大津波警報が出ている。' : ''}\n${TIER_NAME[d.tier]}。いまわかっている被害：\n${disasterSummary(g, d)}`);
      pages.push('（ゲーム内の架空の災害です。手続きと法律は、その時代の実際のものです）');
      let prompt = 'どうする？';
      let ids = [];
      if (roles.includes('pm')) { pages.push(`総理として、${crisisRoom(g)}へ向かう。\n官邸対策室が立ち上がり、情報が集まりはじめた。`); ids = ['honbu_kinkyu', 'honbu_hijo', 'sdf_order']; prompt = '総理として、まず何を指示する？'; }
      else if (roles.includes('defmin')) { ids = ['sdf_order']; prompt = `${postName(g, 'minister_defense')}として、どうする？`; }
      else if (roles.includes('chiji') && d.home) { ids = ['sdf_request', 'kyujo_ho']; prompt = '東京都知事として、どうする？'; }
      else if (roles.includes('kucho') && d.home) { ids = ['shelter']; prompt = 'ドット区長として、どうする？'; }
      else if (d.home) { ids = ['safety', 'donate']; }
      else ids = ['donate'];
      const choice = await show(g, { art: K.art, title: d.name, sub: '（架空の災害）', pages, alert, numbers: { ...d.known }, options: actionOptions(g, ids), prompt, home: d.home });
      await doDisasterChoice(g, choice);
      // the PM keeps deciding while the scene is up (one more step, if any)
      if (choice && roles.includes('pm')) {
        const more = actionOptions(g, ['sdf_order', 'honbu_hijo', 'honbu_kinkyu']);
        if (more.length > 1) await doDisasterChoice(g, await show(g, { art: 'kantei', title: crisisRoom(g), sub: d.name, pages: ['つづけて指示を出す。'], options: more, prompt: '次は？' }));
      }
      return;
    }
    if (data.phase === 'hinan') {
      const pages = [`【${d.name}】${dateText(g)}\n${disasterSummary(g, d)}`, '避難所では、毛布と水、トイレが足りない。\n自衛隊とボランティアが、物資を運んでいる。'];
      let ids = ['gekijin', 'hosei', 'shienho', 'shelter_visit', 'volunteer', 'charity', 'donate'];
      ids = ids.filter((id) => !disasterRefusal(g, id)).slice(0, 3);
      const choice = await show(g, { art: 'shelter', title: d.name, sub: '避難生活', pages, numbers: { ...d.known }, options: actionOptions(g, ids) });
      await doDisasterChoice(g, choice);
      return;
    }
    if (data.phase === 'fukko') {
      const pages = [`【${d.name}】避難所の多くが閉じられ、仮設住宅への入居が進む。\n復旧・復興の段階に入った。`, `死者${n0(d.known.dead)}人・行方不明${n0(d.known.missing)}人。\n失われたものは、元には戻らない。`];
      const ids = ['fukko_plan', 'hosei', 'gekijin', 'volunteer', 'charity'].filter((id) => !disasterRefusal(g, id)).slice(0, 3);
      const choice = await show(g, { art: 'fukko', title: d.name, sub: '復旧・復興', pages, options: actionOptions(g, ids) });
      await doDisasterChoice(g, choice);
    }
  },
  async shelter(g, data) {
    const d = R(g).disaster;
    await show(g, { art: 'shelter', title: '避難所', sub: d ? d.name : '', pages: data.who === 'kucho' ? ['体育館に段ボールの仕切りが並ぶ。\n区の職員が名簿をつくり、水と毛布を配っている。'] : ['体育館で、ひとりひとりの話を聞いて回った。\n「ありがとう。顔を見せてくれてうれしい」'] });
  },
  async volunteer(g) { await show(g, { art: 'volunteer', title: '災害ボランティア', pages: ['長靴とマスクで、家の泥をかき出す。\n地元の人が「遠くからありがとう」と麦茶をくれた。'] }); },
  async charity(g, data) { await show(g, { art: 'charity', title: 'チャリティ', pages: [`チャリティ企画で、被災地への支援を呼びかけた。\n${fmtMoney(num(data.raised))}の義援金が集まった。`] }); },
  async cabinet(g, data) { await show(g, { art: 'cabinet', title: '閣議', pages: data.what === 'gekijin' ? ['閣議で、激甚災害の指定の政令を決めた。\n復旧事業の国の補助がかさ上げされる。'] : ['閣議で決めた。'] }); },
  async fukko(g) { await show(g, { art: 'fukko', title: '復興の基本方針', pages: ['住まい、仕事、学校、道路。\nひとつずつ、町を取り戻していく。'] }); },
  async pko(g, data) { await show(g, { art: 'pko', title: 'PKO派遣', sub: data.mission, pages: [`${data.mission}（架空）に、自衛隊の部隊（約${n0(data.personnel)}人）が出発した。\n道路の補修や給水を担う。（PKO参加5原則）`] }); },
  async pko_offer(g) {
    const r = R(g), o = r.sdf.pkoOffer;
    if (!o) return;
    const ok = !sdfRefusal(g, 'pko');
    const v = await show(g, { art: 'pko', title: '国連からの要請', sub: o.mission, pages: [`国連から、${o.mission}（架空）への参加の要請が届いた。\n停戦合意と受入れ国の同意がある。`], options: ok ? [{ label: '派遣を閣議決定', value: 'pko' }, { label: '見送る', value: null }] : [{ label: 'わかった', value: null }] });
    if (v === 'pko') { const res = g.sdfOrder('pko'); if (res.text || res.why) await g.say(res.text || res.why); }
  },
  async kaijo(g, data) {
    const r = R(g);
    if (!r.sdf.kaijo || r.sdf.kaijo.done) return;
    const ok = !sdfRefusal(g, 'kaijo');
    const v = await show(g, { art: 'sea', title: '不審船', sub: `${FICTIONAL_NATIONS[data.nation].short}籍とみられる（架空の国）`, pages: ['領海に不審船。海上保安庁の巡視船が追跡している。\n停船の命令に応じない。'], options: ok ? [{ label: '海上保安庁に任せる', value: null }, { label: '海上警備行動を発令', value: 'kaijo' }] : [{ label: 'わかった', value: null }] });
    if (v === 'kaijo') { const res = g.sdfOrder('kaijo'); if (res.text || res.why) await g.say(res.text || res.why); }
    else if (ok) { r.sdf.kaijo.done = 'jcg'; await g.say('海上保安庁に対応を任せた。'); }
  },
  async referendum(g, data) {
    const segName = (s) => (POL && POL.SEGMENTS && POL.SEGMENTS[s] && POL.SEGMENTS[s].name) || s;
    const by = Object.entries(data.bySeg || {}).sort((a, b) => b[1] - a[1]);
    await show(g, { art: 'referendum', title: '国民投票', sub: '強権型の緊急事態条項', numbers: { yes: data.yes, turnout: data.turnout }, bySeg: data.bySeg, pages: [`開票が終わった。賛成${data.yes}%・反対${Math.round((100 - data.yes) * 10) / 10}%（投票率${data.turnout}%）`, `賛成が多かった層：${by.slice(0, 2).map(([s, v]) => `${segName(s)}${v}%`).join('・')}\n反対が多かった層：${by.slice(-2).map(([s, v]) => `${segName(s)}${Math.round((100 - v) * 10) / 10}%`).join('・')}`, data.passed ? '憲法が改正された。\n緊急事態宣言の道が開かれた。（もしもシミュレーション）' : '改正案は否決された。\n国民は、この条文を選ばなかった。'] });
  },
  async regime_change(g, data) {
    const lab = regimeLabel(g);
    if (data.to === 'emergency') await show(g, { art: 'emergency', title: '緊急事態宣言', sub: 'もしもシミュレーション', headline: '全国に緊急事態宣言', pages: ['テレビの全チャンネルが、同じ会見を映している。\n「本日、全国に緊急事態を宣言します」', '内閣は、法律と同じ効力の政令を出せるようになった。\n街には不安と、静かな怒りが広がっている。', `（${FICTION_NOTE}）`] });
    else if (data.to === 'dictatorship') await show(g, { art: 'diet_closed', title: '独裁体制', sub: 'もしもシミュレーション', headline: `${lab.label}体制`, pages: ['国会議事堂の門が閉ざされた。\n選挙の予定は、すべて消えた。', `海外のメディアは、日本の体制を「${lab.label}」と呼びはじめた。\n各国の大使が、本国に呼び戻されている。`, `（${FICTION_NOTE}）`] });
  },
  async court(g, data) {
    const r = R(g);
    if (r.steps.courtIgnored || r.id === 'democracy' && !['sns_bill', 'disclosure'].includes(data.step)) return;
    const pages = [`最高裁判所の大法廷。\n「${data.what}は、憲法に違反し、無効とする」`];
    if (data.step === 'disclosure') {
      await show(g, { art: 'court', title: '判決', pages: ['裁判所は、文書の不開示を取り消す判決を言い渡した。\n文書は開示されることになった。'] });
      R(g).press.offset += 2;
      return;
    }
    const v = isPM(g) ? await show(g, { art: 'court', title: '最高裁判決', sub: data.what, pages, options: [{ label: '判決に従う', value: 'comply' }, { label: '判決を無視する', value: 'ignore' }], prompt: '判決にどう向き合う？' }) : 'comply';
    if (!isPM(g)) { await show(g, { art: 'court', title: '最高裁判決', sub: data.what, pages }); answerCourt(g, data.step, true); return; }
    await g.say(answerCourt(g, data.step, v === 'comply'));
  },
  async army(g) { await show(g, { art: 'army', title: '国軍化', sub: 'もしもシミュレーション', pages: ['自衛隊の駐屯地で、看板がかけ替えられた。\n「国軍」――多くの隊員が、黙って制服を脱いだ。', `（${FICTION_NOTE}）`] }); },
  async war(g, data) {
    const r = R(g);
    const last = r.wars[r.wars.length - 1];
    const w = r.war || last;
    if (!w) return;
    const nat = FICTIONAL_NATIONS[w.enemy];
    const cas = w.cas;
    if (data.event === 'declare') await show(g, { art: 'war', title: '宣戦', sub: `${nat.name}（架空の国）`, front: 0, pages: [`${DISPUTED_AREA.name}（架空の係争地）をめぐり、${nat.name}に宣戦した。`, '国連の安全保障理事会が緊急会合を開いた。\n各国は即時の停戦を求めている。', `（${FICTION_NOTE}）`] });
    else if (data.event === 'ceasefire') await show(g, { art: 'war', title: '停戦', sub: nat.name, front: 0, pages: ['停戦が成立した。前線の銃声が止んだ。', `死者　兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人\nけが人　${n0(cas.soldiers.wounded + cas.civilians.wounded)}人\n相手国側の死傷者　${n0(cas.enemySoldiers + cas.enemyCivilians)}人`, '制裁は続き、物価は高いまま。\n帰ってこない人たちの家族が、町に残された。'] });
    else if (data.event === 'victory') await show(g, { art: 'war', title: '占領', sub: DISPUTED_AREA.name, front: 100, pages: [`国軍は${DISPUTED_AREA.name}を占領した。\nだが、祝う声はほとんど聞こえない。`, `死者　兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人\n相手国側の死傷者　${n0(cas.enemySoldiers + cas.enemyCivilians)}人\n戦費　約${w.cost}兆円`, 'どの国も占領を認めず、制裁はさらに強まった。\n島では抵抗が続いている。'] });
  },
  async uprising_warn(g) { await show(g, { art: 'demo', title: 'ゼネスト', sub: 'もしもシミュレーション', pages: ['全国でゼネストが始まった。\n広場を埋めた群衆が、退陣を求めている。', '国軍の一部の部隊は、市民に向けた出動を拒んだ。\n残された時間は少ない。'] }); },
  async stepdown(g, data) {
    await show(g, { art: 'newspaper', title: '退陣', headline: data.charged ? '前総理を職権濫用で捜査' : '前総理 刑事責任問われず', pages: data.charged ? ['総理の座を降りた。選挙と国会は再開される。', 'それまでの行為について、検察が捜査を始めた。\n法にもとづいて、裁かれることになる。'] : ['総理の座を降りた。選挙と国会は再開される。', '検察は、刑事責任は問わないと判断した。\nだが、政治家としての信頼は、もう戻らない。'] });
  },
  async downfall(g, data) {
    const rec = regimeRecord(g);
    rec.cause = data.cause || rec.cause;
    if (typeof KIKI.downfall === 'function') await KIKI.downfall(g, rec);
    else await g.say(downfallText(g, rec));
    if (typeof KIKI.record === 'function') await KIKI.record(g, rec);
    else await g.say(recordLines(rec));
    backToTitle(g);
  },
};
export function downfallText(g, rec) {
  const why = rec.cause === 'uprising' ? '全国に広がった民衆の蜂起で、体制は一夜にして崩れた。' : rec.cause === 'surrender' ? '降伏の知らせが流れた夜、体制は崩れた。' : '前線が崩れ、敗戦の知らせが流れた夜、体制は崩れた。';
  return [
    why,
    `逃げようとした${rec.name}は、群衆にとらえられた。`,
    '群衆は、倒れた独裁者を広場にさらし、逆さに吊るした。\n――歴史が、倒れた独裁者たちについて記録してきたように。',
    'こうして、この人生の物語は終わった。',
  ];
}
export function recordLines(rec) {
  return [
    `【記録】${rec.name}　${rec.date}`,
    `体制：${REGIME_INFO[rec.maxRegime] ? REGIME_INFO[rec.maxRegime].name : rec.maxRegime}（${rec.label}）\n戦争：${rec.wars}回　死者 兵士${n0(rec.soldiers)}人・民間人${n0(rec.civilians)}人`,
    `相手国側の死傷者：${n0(rec.enemy)}人\n拘束された記者：${n0(rec.detained)}人\n報道の自由度：${rec.press}`,
    '（これは架空の「もしも」のシミュレーションです）\nセーブデータから再開するか、新しく始めてください。',
  ];
}

// ======================================================================== the morning
export async function regimeTick(g) {
  if (!g || !g.state) return;
  const r = R(g);
  if (num(r.lastTick) >= today(g)) return;
  r.lastTick = today(g);
  if (r.id === 'fallen') return;
  try {
    extendDemoResponses();
    pressTick(g);
    if (r.amend && r.amend.stage === 'referendum' && today(g) >= r.amend.voteDay) runReferendum(g);
    courtTick(g);
    disasterTick(g);
    cancelWork(g);
    // our own rare disasters (volcano; and everything when the politics core is missing)
    if (!pol(g) && roll(0.4 / YEAR_DAYS)) maybeDisaster(g, roll(0.5) ? 'quake' : 'storm');
    if (roll(0.04 / YEAR_DAYS) && !(r.disaster && r.disaster.phase !== 'done') && today(g) - r.lastDisasterDay >= 40 && today(g) >= 15) startDisaster(g, { kind: 'volcano' });
    sdfEvents(g);
    warTick(g);
    if (r.id !== 'fallen') unrestTick(g);
    // 任期の延長 while elections are suspended (the player's own term does not lapse)
    if (r.steps.elections) { const me = meOf(g); if (me && me.termEnd && me.termEnd < today(g) + 30) me.termEnd = today(g) + 30; }
    if (isPM(g) && !r.record.firstPM) r.record.firstPM = today(g);
  } catch (e) { console.error('regimeTick', e); }
}

// ======================================================================== politics core hooks (registered once it loads)
let politicsHooked = false;
function hookPolitics() {
  if (politicsHooked || !POL || typeof POL.onPolitics !== 'function') return;
  politicsHooked = true;
  POL.onPolitics('shock', (g, s) => {
    try { if (g && g.state && !g._regimeShock && s && (s.kind === 'quake' || s.kind === 'storm')) maybeDisaster(g, s.kind); } catch (e) { console.error(e); }
  });
  // the lasting part of a step's effect on approval (the poll moves 40% of the way each week)
  POL.onPolitics('poll', (g, poll) => {
    try {
      if (!g || !g.state) return;
      const r = R(g);
      const p = pol(g);
      if (!p || !r.approvalMod) return;
      p.cabinet.approval = clamp(num(p.cabinet.approval) + r.approvalMod * 0.4, 3, 90);
      if (poll) poll.approval = Math.round(p.cabinet.approval * 10) / 10;
    } catch (e) { console.error(e); }
  });
  POL.onPolitics('enacted', (g, info) => {
    try { if (g && g.state && info && info.law && info.law.policy) R(g).flags['law_' + info.law.policy] = today(g); } catch (e) { console.error(e); }
  });
  // the PM leaves office during the emergency (不信任・総辞職): democracy comes back, the courts take over
  const gone = (g) => {
    try {
      if (!g || !g.state) return;
      const r = R(g);
      if ((r.id === 'emergency' || r.id === 'dictatorship') && !isPM(g) && !g._regimeResigning) lawfulRemoval(g, '総理の退陣');
    } catch (e) { console.error(e); }
  };
  POL.onPolitics('resign', gone);
  POL.onPolitics('cabinet', gone);
}

// ======================================================================== A1's demonstrations: the dictatorship's responses
let demoExtended = false;
function extendDemoResponses() {
  if (demoExtended || !GOVT || !GOVT.DEMO_RESPONSES || typeof GOVT.DEMO_RESPONSES !== 'object') return;
  demoExtended = true;
  const D = GOVT.DEMO_RESPONSES;
  const add = (id, def) => { if (!D[id]) D[id] = { id, ...def }; };
  const okIn = (g) => { const r = R(g); return r.id === 'emergency' || r.id === 'dictatorship'; };
  add('crackdown', {
    name: '弾圧（治安部隊の出動）', label: '弾圧', regime: true,
    desc: '（もしも）治安部隊でデモを解散させる。国内外から激しい非難を浴び、蜂起の危険が一気に高まる。',
    when: okIn, available: okIn,
    apply(g, demo) {
      const r = R(g);
      r.unrest = clamp(r.unrest + 18, 0, 100);
      raiseIntl(g, 15, 'デモの弾圧');
      press(g, -5, 'デモの弾圧');
      bumpApproval(g, -8, -4);
      r.record.steps.push({ day: today(g), step: 'デモの弾圧' });
      news(g, '【もしも】治安部隊がデモを強制的に解散させた。多数のけが人と拘束者が出たと伝えられる。各国が強く非難している');
      return { ok: true, text: '治安部隊がデモを解散させた。国内外の怒りは、かえって大きくなった。' };
    },
  });
  add('curfew', {
    name: '外出禁止令', label: '外出禁止令', regime: true,
    desc: '（もしも）夜間の外出を禁じる。暮らしと経済に重い負担。',
    when: okIn, available: okIn,
    apply(g) {
      const r = R(g);
      r.unrest = clamp(r.unrest + 6, 0, 100);
      raiseIntl(g, 5, '外出禁止令');
      ecoShock(g, '外出禁止令', { growth: -0.5, len: 60 });
      news(g, '【もしも】全国に夜間の外出禁止令が出された');
      return { ok: true, text: '外出禁止令を出した。街は静かになったが、不満は消えていない。' };
    },
  });
  add('concession', {
    name: '譲歩（拘束者の解放・対話）', label: '譲歩', regime: true,
    desc: '（もしも）拘束した人を解放し、対話を約束する。',
    when: okIn, available: okIn,
    apply(g) {
      const r = R(g);
      r.unrest = Math.max(0, r.unrest - 10);
      r.intl = Math.max(0, r.intl - 4);
      news(g, '【もしも】政府が拘束者の一部を解放し、市民団体との対話を約束した');
      return { ok: true, text: '譲歩した。広場の緊張が少しやわらいだ。' };
    },
  });
}

// ======================================================================== g.* methods
function stepRefusal(g, kind) {
  const S = REGIME_STEPS[kind];
  if (!S) return 'そんな手続きはない';
  const r = R(g);
  if (r.id === 'fallen') return '体制はもう崩れている';
  if (S.regimes && !S.regimes.includes(r.id) && !['suspend_elections', 'suspend_diet', 'ban_opposition', 'national_army', 'lift_emergency', 'democratize'].includes(kind)) return `いまの体制（${REGIME_INFO[r.id].name}）ではできない`;
  return S.check(g);
}
function sdfRefusal(g, kind) {
  const O = SDF_ORDERS[kind];
  if (!O) return 'そんな命令はない';
  if (R(g).id === 'fallen') return '体制はもう崩れている';
  return O.check(g);
}
const methods = {
  regime() {
    const r = R(this);
    const lab = regimeLabel(this);
    return {
      id: r.id, name: REGIME_INFO[r.id].name, long: REGIME_INFO[r.id].long, since: r.since, steps: { ...r.steps }, label: lab.label, labelWhy: lab.why,
      fiction: r.id !== 'democracy' || r.fictionShown, note: FICTION_NOTE, unrest: Math.round(r.unrest), intl: Math.round(r.intl), sanctions: r.sanctions,
      amend: r.amend ? { ...r.amend } : null, history: r.history.slice(), approvalMod: Math.round(r.approvalMod * 10) / 10,
    };
  },
  regimeStep(kind, opts = {}) {
    const S = REGIME_STEPS[kind];
    const why = stepRefusal(this, kind);
    if (why) return { ok: false, why };
    const res = S.run(this, opts) || { ok: true };
    emit(this, 'step', { kind, res });
    return res.ok === false ? res : { ok: true, ...res };
  },
  regimeSteps() {
    return REGIME_STEP_ORDER.map((id) => ({ id, name: REGIME_STEPS[id].name, desc: REGIME_STEPS[id].desc, auth: !!REGIME_STEPS[id].auth, why: stepRefusal(this, id) }));
  },
  // Why something is not possible now: a regime step, a press action, an SDF order, a war order or a disaster action.
  regimeRefusal(kind, opts = {}) {
    if (REGIME_STEPS[kind]) return stepRefusal(this, kind);
    if (PRESS_ACTIONS[kind]) return pressRefusal(this, kind);
    if (SDF_ORDERS[kind]) return sdfRefusal(this, kind);
    if (WAR_ORDERS[kind]) return warRefusal(this, kind, opts);
    if (DISASTER_ACTIONS[kind]) return disasterRefusal(this, kind);
    if (kind === 'war' || kind === 'invade') return sdfRefusal(this, 'attack');
    return 'そんな行為はない';
  },
  regimeHold(kind, e, day) {
    if (!this.state || !this.state.regime) return false;
    const r = R(this);
    if (kind === 'diet') return !!r.steps.diet && r.id !== 'democracy';
    if (kind === 'election') {
      if (!r.steps.elections || r.id === 'democracy') return false;
      if (e && typeof e === 'object') {
        const d = num(day, today(this));
        // keep the election out of the 30-day window (no notices, no 公示): it never comes
        if (num(e.day) < d + 60) { const shift = d + 60 - num(e.day); e.day = num(e.day) + shift; if (e.koji != null) e.koji = num(e.koji) + shift; }
        if (e.status === 'campaign') e.status = 'scheduled';
      }
      return true;
    }
    return false;
  },
  pressFreedom() {
    const r = R(this);
    const v = Math.round(pressValue(this));
    return { value: v, label: pressLabel(v), baseline: PRESS_BASE[r.id], history: r.press.history.slice(), detained: r.press.detained, censorship: !!r.steps.censor };
  },
  pressAction(kind) {
    const A = PRESS_ACTIONS[kind];
    const why = pressRefusal(this, kind);
    if (why) return { ok: false, why };
    const r = R(this);
    r.press.actions[kind] = today(this);
    if (kind !== 'release') { realPartnersLeave(this, A.name); if (r.id !== 'democracy') fictionNotice(this); r.record.steps.push({ day: today(this), step: A.name }); }
    const text = A.run(this);
    if (text == null) return { ok: false, why: '必要がない' };
    emit(this, 'press', { kind });
    return { ok: true, text };
  },
  pressActions() {
    return PRESS_ORDER.map((id) => ({ id, name: PRESS_ACTIONS[id].label ? PRESS_ACTIONS[id].label(this) : PRESS_ACTIONS[id].name, desc: PRESS_ACTIONS[id].desc, regimes: PRESS_ACTIONS[id].regimes.slice(), why: pressRefusal(this, id) }));
  },
  sdf() { return sdfStatus(this); },
  sdfOrder(kind, opts = {}) {
    const why = sdfRefusal(this, kind);
    if (why) return { ok: false, why };
    const res = SDF_ORDERS[kind].run(this, opts) || { ok: true };
    R(this).sdf.orders.push({ day: today(this), kind });
    if (R(this).sdf.orders.length > 30) R(this).sdf.orders.shift();
    return res;
  },
  sdfOrders() { return SDF_ORDER_LIST.map((id) => ({ id, name: SDF_ORDERS[id].name, desc: SDF_ORDERS[id].desc, why: sdfRefusal(this, id) })); },
  disaster() {
    const d = R(this).disaster;
    if (!d) return null;
    return { ...d, known: { ...d.known }, done: { ...d.done }, summary: disasterSummary(this, d), tierName: TIER_NAME[d.tier], honbuName: d.honbu ? honbuName(this, d.honbu) : null, roles: roleOf(this), log: d.log.slice(), plan: undefined };
  },
  disasters() { return R(this).disasters.slice(); },
  disasterAction(id) {
    const why = disasterRefusal(this, id);
    if (why) return { ok: false, why };
    const d = R(this).disaster;
    const res = DISASTER_ACTIONS[id].run(this, d);
    if (res && typeof res === 'object') return res;
    d.log.push({ day: today(this), text: DISASTER_ACTIONS[id].name });
    emit(this, 'disaster', { phase: d.phase, action: id, d });
    return { ok: true, text: res };
  },
  disasterActions() {
    const d = R(this).disaster;
    if (!d) return [];
    const roles = roleOf(this);
    return DISASTER_ACTION_ORDER.filter((id) => DISASTER_ACTIONS[id].roles.some((x) => roles.includes(x))).map((id) => ({ id, name: DISASTER_ACTIONS[id].name, desc: DISASTER_ACTIONS[id].desc, why: disasterRefusal(this, id) }));
  },
  startDisaster(opts = {}) { return startDisaster(this, opts); },
  war() {
    const w = R(this).war;
    if (!w) return null;
    return { ...w, enemyName: FICTIONAL_NATIONS[w.enemy].name, area: DISPUTED_AREA.name, frontText: frontText(w.front), cas: JSON.parse(JSON.stringify(w.cas)), log: w.log.slice() };
  },
  warOrder(kind, opts = {}) { return warOrder(this, kind, opts); },
  warOrders(opts = {}) { return WAR_ORDER_LIST.map((id) => ({ id, name: WAR_ORDERS[id].name, desc: WAR_ORDERS[id].desc, why: warRefusal(this, id, opts) })); },
  regimeNews(n = 10) { return R(this).news.slice(0, n); },
  regimeLabel() { return regimeLabel(this); },
  regimeRecord() { return regimeRecord(this); },
  regimeFlush() { return flush(this); },
  regimeTick() { return regimeTick(this); },
  // the answer to a court ruling (UIs; the scene asks it itself)
  regimeCourt(step, comply = true) { return answerCourt(this, step, comply); },
};

// ======================================================================== install
export function installRegime(proto) {
  if (!proto || proto.__regime) return;
  Object.defineProperty(proto, '__regime', { value: true, configurable: true });
  for (const [k, fn] of Object.entries(methods)) proto[k] = fn;
  const wrap = (name, make) => {
    const orig = proto[name];
    if (typeof orig !== 'function' || orig.__regime) return;
    const w = make(orig);
    w.__regime = true;
    proto[name] = w;
  };
  // a fallen life is never saved over the player's save (the last save stays the one before the fall)
  wrap('save', (orig) => function (...a) {
    try { if (this.state && this.state.regime && this.state.regime.id === 'fallen') return false; } catch (e) { /* ignore */ }
    return orig.apply(this, a);
  });
  // a free moment: show the queued scenes (the downfall first)
  wrap('afterScript', (orig) => function (...a) {
    const res = orig.apply(this, a);
    try {
      if (this.state && this.state.regime && R(this).queue.length && canShow(this)) this.run(() => flush(this));
    } catch (e) { console.error(e); }
    return res;
  });
  // work stops for a few days when a disaster hits the player's town
  wrap('lifeRefusal', (orig) => function (...a) {
    const why = orig.apply(this, a);
    if (why) return why;
    try {
      const r = this.state && this.state.regime;
      if (r && num(r.cancelUntil) >= today(this) && r.disaster) return `${r.disaster.name}の影響で、交通機関が止まっている。\n今日のお仕事やレッスンは、すべて中止になった。`;
    } catch (e) { console.error(e); }
    return null;
  });
  // elections and the Diet under the dictatorship: what the politics core would otherwise allow
  const held = (g, what) => {
    const r = g.state && g.state.regime;
    if (!r) return null;
    if (what === 'election' && r.steps && r.steps.elections && r.id !== 'democracy') return '選挙は無期限に延期されている（もしも）';
    if (what === 'diet' && r.steps && r.steps.diet && r.id !== 'democracy') return '国会は止められている（もしも）';
    return null;
  };
  wrap('dissolve', (orig) => function (...a) {
    const w = held(this, 'election');
    if (w) { this.lastPoliticsError = w; return null; }
    return orig.apply(this, a);
  });
  wrap('declareCandidacy', (orig) => function (...a) {
    const w = held(this, 'election');
    if (w) { this.lastPoliticsError = w; return w; }
    return orig.apply(this, a);
  });
  wrap('noConfidence', (orig) => function (...a) {
    const w = held(this, 'diet');
    if (w) { this.lastPoliticsError = w; return { ok: false, why: w }; }
    return orig.apply(this, a);
  });
  wrap('resignPM', (orig) => function (...a) {
    this._regimeResigning = true;
    try { return orig.apply(this, a); } finally { this._regimeResigning = false; }
  });
}

onMorning((g) => regimeTick(g));
installRegime(Game.prototype);
if (typeof window !== 'undefined') window.__regime = { R, KIKI, startDisaster, fall, setRegimeRng, regimeLabel, queueScene, flush, FICTIONAL_NATIONS };
