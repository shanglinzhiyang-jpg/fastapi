// 体制・安全保障コア (REGIME & SECURITY CORE): 自衛隊・防衛・軍事, 震災対応 (fictional disasters with the real
// procedures of each date), 報道の自由度と言論弾圧, 体制 (democracy → emergency → dictatorship → fallen) through a
// constitutional amendment (発議・国民投票) and 緊急事態, the war with FICTIONAL nations, the downfall, and the
// lawful way out (退陣 → trial through the justice core). Scenes and the phone app live in js/world/kiki.js.
//
// ---------------------------------------------------------------- rules (non-negotiable; see the brief)
// - The fiction notice is on the title screen only (one small line); no in-game disclaimer when a regime or a war starts.
// - Round 4: NOTHING is refused for being bad (an authoritarian step, the suppression of the press, a war): every path
//   goes through and shows its odds, costs and consequences. Real parties (自由民主党, 民主党 1998-2016) as
//   organisations still never DECIDE such a step: when the player (a member or the leader of one) takes it, the
//   party's organs refuse and the story makes it go through anyway — the player breaks with the party (離党, or
//   除名 when their standing is low) and leads a new party of the members who follow, with a short scene
//   (breakaway(): the PM stays in office; the real party leaves the government). A minister who acts alone in a
//   real-party NPC cabinet makes the statement and is dismissed (罷免) afterwards. A real junior partner leaves the
//   coalition (realPartnersLeave). A real party never enters (or is brought back into) a government in an emergency /
//   dictatorship, nor the cabinet of a player who has taken such steps (g.regimeCoalitionBlock: a cost, not a
//   block on the path). Real parties stay neutral everywhere else.
// - War against real countries (world.js) or the fictional nations, by four routes: the dictatorship with the
//   国軍, a democracy whose constitution was amended (9条：交戦権の容認, its own 発議 and 国民投票), collective
//   self-defence in an ally's war (存立危機事態 + 国会の承認), and 防衛出動 against an armed attack. Leaders are never
//   named. No WMD, no choice to attack civilians, no war-crime mechanics, no gore: the human cost is shown as
//   numbers on every side, the people the player knows who die (a short sober message), letters, sanctions and the
//   economy. The player may go to the front and die there (戦死: that life ends; the save stays the last one before
//   it). Defeat or a popular uprising ends the dictator's life (the downfall scene is abstract and non-graphic).
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
//   onRegime(event, fn) → unsubscribe, regimeTick(g), newRegimeState(), installRegime(proto), setRegimeRng(fn),
//   REF_BASE / amendVotes(g, house, opts) / amendProjection(g) / referendumProjection(g) (the 発議 and 国民投票
//   model: UIs import these instead of copying the math), regimeCoalitionBlock(g, partyId, opts) (the real-party
//   coalition rule), actionDesc(A, g) (a registry entry's dated description)
// g.regimeCoalitionBlock(partyId, { core?, partner? }) → null | reason a real party may not be in this government now
// g.regimeCoalitionFilter(core, partners[]) → { core, partners (allowed), refused: [{ id, why }] }
// g.regimeAmendProjection() → { shugi: { yes, total, need }, sangi: {…}, ok }; g.regimeReferendumProjection() → { yes %, bySeg }
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
// g.regimeBarred(who='player') → null | reason: the former PM of the emergency / dictatorship (stepped down or removed)
//                              gets no cabinet post again, 内閣総理大臣 included (state.regime.barred; NPCs → null)
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
//   1995年12月の改正（平成7年法律第132号）までは、緊急災害対策本部は災害緊急事態の布告（いわゆる緊急事態宣言。
//   国会の承認が要る）があったときだけ置けた。このため阪神・淡路大震災（1995年1月）では置かれず、非常災害対策
//   本部（本部長 国土庁長官）で対応した。改正で布告がなくても閣議にかけて置けるようになった（設置要件の緩和）。
//   改正では市町村長が知事に自衛隊の派遣要請を求める規定（68条の2）も加わった。非常災害対策本部は2001年1月の
//   省庁再編までは総理府に置かれた（本部長は国務大臣＝国土庁長官）。
//   sources: fdma.go.jp 消防白書 h20-h22（平成7年 設置要件の緩和）, jsnds.org ssk_30_2_199（改正前は布告が条件・
//   国会承認）, bousai.go.jp 防災白書 h13・h29, bousai.go.jp 阪神・淡路の教訓 1-2-3
//   緊急災害対策本部（本部長 内閣総理大臣）は2011年3月11日に初めて設置。非常災害対策本部の本部長は
//   2021年5月20日施行の改正で国務大臣から内閣総理大臣に（あわせて特定災害対策本部＝本部長 防災担当大臣）。
//   災害救助法 1947年（都道府県知事が適用）。激甚災害法 1962年（激甚災害は政令で指定＝閣議決定。復旧事業の
//   国庫補助をかさ上げ。本激と局激）。被災者生活再建支援法 1998年5月成立・11月施行（最高100万円 → 2004年・
//   2007年の改正で最高300万円）。内閣府（防災担当）2001年1月（それまでは国土庁防災局・国土庁長官）。
//   内閣危機管理監 1998年4月、官邸危機管理センター 2002年4月。復興庁 2012年2月10日（東日本大震災の復興のため）。
//   緊急地震速報: 2007年10月1日から一般向け（テレビ・ラジオ）、2007年12月10日から携帯電話（エリアメール）。
//   震度階級: 1996年10月から震度5・6を弱・強に分けた10階級（それまでは震度6）。噴火警報・噴火警戒レベル 2007年12月
//   1日から（それまでは緊急火山情報など）、噴火速報 2015年8月4日から。sources: jma.go.jp 震度について,
//   data.jma.go.jp 火山活動解説資料 2007年12月, jma-net.go.jp/niigata 年表
//   sources: bousai.go.jp（防災白書 h13/h24・災対法改正 r3）, sn-hoki.co.jp 法令改正情報, mhlw.go.jp,
//   kotobank 激甚災害, seijiyama.jp 激甚災害, jma.go.jp 緊急地震速報の沿革, ascii.jp (ドコモ 2007/12/10),
//   imidas F-118-0029 / kobe-np 被災者生活再建支援法, darkside.js（内閣危機管理監・危機管理センター）
// - 憲法96条: 各議院の総議員の3分の2以上の賛成で国会が発議し、国民投票の過半数の賛成で承認。国民投票法
//   （日本国憲法の改正手続に関する法律）: 2007年5月14日成立・5月18日公布、2010年5月18日施行。国民投票は
//   発議から60日以後180日以内（2条）。投票権は2018年6月から18歳以上。
//   sources: kotobank 国民投票法, japaneseclass/朝日 2007, allabout.co.jp, city.itabashi.tokyo.jp
// - 情報公開法（行政機関の保有する情報の公開に関する法律）: 1999年成立、2001年4月1日施行。放送法4条（政治的
//   公平）・電波法76条（無線局の運用停止）。憲法21条（表現の自由・検閲の禁止）。番組編集準則は、2010年の改正
//   （平成22年法律第65号、2010年12月3日公布、2011年6月30日施行）までは放送法3条の2第1項（1959年の改正から）。
//   sources: soumu.go.jp 放送法 2006年の条文（3条の2）, shugiin.go.jp 質問答弁 b189081（4条1項）, soumu.go.jp
//   000110961（改正法の施行）
// - 緊急発進（スクランブル、自衛隊法84条）の年間回数（目安）: 1984年度944回（冷戦期のピーク）、1990年代半ば〜2010年
//   前後は100〜300回（1998年220回・2003年158回）、2013年度以降はおおむね700回超（ピーク2016年度1,168回）、2023年度
//   669回・2024年度704回。ゲームのニュースでは相手国を書かない（実在の国の代わりに架空の国を使わない）。
//   sources: mod.go.jp 防衛白書 資料（緊急発進回数の推移）, mod.go.jp qa_86, nippon.com japan-data h02139
// - 公務員職権濫用罪（刑法193条）: 2年以下の懲役又は禁錮（2025年6月から拘禁刑）。
// Fictional (checked that no real country/place has these names): ネヴァロン共和国, ルーゼニア王国, ケルドア連邦,
//   ヴェルミナ諸島 / ヴェルミナ海 (all placed in one invented sea far from Japan, with no compass hint that could map them
//   onto a real neighbour); every disaster place (ドット湾北部・北ドット地方・南ドット地方・西ドット地方・ドット岳), every
//   disaster, every NPC, every war, every regime event. (The fiction notice is on the title screen only.)

import { Game } from './game.js';
import { onMorning, PEOPLE } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { RELATIONS, sortFamily, ERAS, ageOf, CAUSES } from './profile.js';
import { MapScene } from './map.js';

// ======================================================================== optional modules (guarded, literal paths)
let POL = null; // politics.js
let CRIME = null; // crime.js
let GOVT = null; // govt.js (A1)
let IDEO = null; // ideology.js (B)
let WORLD = null; // world.js (世界情勢: real countries, alliances, the world's reaction to a war)
import('./world.js').then((m) => { WORLD = m; }).catch(() => { WORLD = null; });
import('./politics.js').then((m) => { POL = m; hookPolitics(); }).catch(() => { POL = null; });
import('./crime.js').then((m) => { CRIME = m; registerCrime(); }).catch(() => { CRIME = null; });
// govt.js / ideology.js are loaded through the registry (they may not exist): import them only when listed
import('../registry.js').then((reg) => {
  const list = (reg && reg.MODULES) || [];
  if (list.includes('./engine/govt.js')) import('./govt.js').then((m) => { GOVT = m; extendDemoResponses(); }).catch(() => { GOVT = null; });
  if (list.includes('./engine/ideology.js')) import('./ideology.js').then((m) => { IDEO = m; }).catch(() => { IDEO = null; });
}).catch(() => {});

// a family member who died in the war (profile.js CAUSES: the family module speaks of it gently, never in detail)
if (CAUSES && !CAUSES.war) CAUSES.war = { name: '戦死', text: '戦地で' };

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
const useStamina = (g, n) => { if (g && g.state) g.state.stamina = Math.max(0, num(g.state.stamina) - n); };
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
// the player's phone as the era calls it (profile.js ERAS: 手帳 / ケータイ / スマホ)
function deviceName(g) { try { const e = ERAS[eraOf(g)]; return (e && e.deviceShort) || 'スマホ'; } catch (e) { return 'スマホ'; } }

// ======================================================================== registries
export const REGIMES = Object.freeze(['democracy', 'emergency', 'dictatorship', 'fallen']);
export const REGIME_INFO = {
  democracy: { name: '民主制', long: '議会制民主主義（日本国憲法のもと）', color: '#5fd7ff' },
  emergency: { name: '緊急事態体制', long: '緊急事態宣言のもとの体制', color: '#ffd23f' },
  dictatorship: { name: '独裁体制', long: '選挙と国会が止められた独裁体制', color: '#ff5d6c' },
  fallen: { name: '体制崩壊', long: '独裁体制が崩れた', color: '#9aa3c7' },
};
// kept (empty) for old imports: the fiction notice is shown on the title screen only, never in the game
export const FICTION_NOTE = '';

// FICTIONAL nations and the fictional disputed area (names checked: no real country or place).
// All of them lie around one invented sea far from Japan (ヴェルミナ海): no compass hint relative to Japan, so none of
// them can be read as a real neighbour.
export const FICTIONAL_NATIONS = {
  nevalon: { id: 'nevalon', name: 'ネヴァロン共和国', short: 'ネヴァロン', power: 62, people: 4200, desc: '「ヴェルミナ海」に面した共和国。ヴェルミナ諸島の領有を主張している。', fictional: true },
  luzenia: { id: 'luzenia', name: 'ルーゼニア王国', short: 'ルーゼニア', power: 48, people: 2600, desc: 'ヴェルミナ海に浮かぶ島国。漁業と海運の国で、諸島の近くに漁場をもつ。', fictional: true },
  keldoa: { id: 'keldoa', name: 'ケルドア連邦', short: 'ケルドア', power: 90, people: 9800, desc: 'ヴェルミナ海をかこむ国々でいちばん大きな連邦国家。大きな軍をもつ。', fictional: true },
};
export const NATION_ORDER = Object.keys(FICTIONAL_NATIONS);
export const DISPUTED_AREA = { id: 'vermina', name: 'ヴェルミナ諸島', desc: '日本から遠く離れた「ヴェルミナ海」の無人の島々。海の資源をめぐり、いくつもの国が領有を主張している。', fictional: true };

// FICTIONAL disaster places. home: the player's town (ドット区, 東京都) is hit — work stops, the 知事 (東京都) requests
// the SDF, the 区長・区議 run the 避難所.
export const DISASTER_PLACES = {
  dotwan: { id: 'dotwan', name: 'ドット湾北部', area: '東京都ドット区とその周辺', home: true, coast: true },
  kita: { id: 'kita', name: '北ドット地方', area: '北ドット地方', home: false, coast: true },
  minami: { id: 'minami', name: '南ドット地方', area: '南ドット地方の沿岸', home: false, coast: true },
  nishi: { id: 'nishi', name: '西ドット地方', area: '西ドット地方の山あい', home: false, coast: false },
  dakesan: { id: 'dakesan', name: 'ドット岳', area: 'ドット岳のふもと', home: false, coast: false },
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
    fall: null, trial: null, barred: null, fictionShown: false, flags: {},
    amend9: null, // the 9条 amendment (交戦権の容認): { stage, day, voteDay, votes, result }
    lifeOver: null, // { day, cause: 'kia', where, enemy, date } — the player died at the front (saving stops)
    lastWar: null, breakaways: [],
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
    if (r.war && (typeof r.war !== 'object' || typeof r.war.enemy !== 'string')) r.war = null;
    if (!Array.isArray(r.breakaways)) r.breakaways = [];
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
// Japanese line breaking for the message window (kiki.js KIKI.wrap: a number keeps its unit — 「5,260人」「1.2兆円」 —
// and is never broken across lines); the plain text without kiki.js.
function wrapText(g, s) {
  try { return typeof KIKI.wrap === 'function' && s != null ? KIKI.wrap(g, String(s)) : s; } catch (e) { return s; }
}
function note(g, text) { (g.morningNotes || (g.morningNotes = [])).push(wrapText(g, text)); }
// g.say with the pages line-broken as above (the regime's own texts).
function say(g, pages) { return g.say([].concat(pages).filter((p) => p != null).map((p) => wrapText(g, p))); }
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
// reason: 'disaster' | 'regime' (govt.js g.approvalNote labels the breakdown 災害への対応 / 体制・安全保障など).
function bumpApproval(g, d, lasting = 0, reason = 'regime', text = '') {
  const p = pol(g);
  const r = R(g);
  if (lasting) r.approvalMod = clamp(r.approvalMod + lasting, -40, 15);
  if (!p || !p.cabinet) return;
  const before = num(p.cabinet.approval, 40);
  p.cabinet.approval = clamp(before + d, 3, 90);
  noteApproval(g, reason, p.cabinet.approval - before, text);
}
// Record an approval change already applied, so govt.js's breakdown shows it under its reason (feature-detected).
function noteApproval(g, reason, delta, text) {
  if (!delta || typeof g.approvalNote !== 'function') return;
  try { g.approvalNote(reason, Math.round(delta * 100) / 100, text || (reason === 'disaster' ? '災害への対応' : '体制・安全保障'), { applied: true }); } catch (e) { console.error(e); }
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
// coalition partners in part; a real party never). EXPORTED (stable name) so UIs show the same projection:
// amendVotes(g, house 'shugi'|'sangi', { expected: true }) → { yes, total, need } (expected: no random part);
// without expected it is the real roll call (random; used by the 発議).
export function amendVotes(g, house, opts = {}) {
  const p = pol(g), pi = partyOf(g);
  const H = p && p.diet && p.diet[house];
  if (!H || !H.seats || !pi) return { yes: 0, total: num(H && H.total, 1), need: Math.ceil(num(H && H.total, 1) * 2 / 3) };
  const total = num(H.total) || Object.values(H.seats).reduce((a, v) => a + num(v), 0);
  const loyal = pi.own ? 0.97 : 0.85;
  const appr = approvalOf(g);
  const loyalty = clamp(loyal - (appr < 35 ? (35 - appr) / 200 : 0), 0.6, 0.99);
  // a real party's members never vote for it (its organs refuse)
  const ownSeats = pi.real ? 0 : num(H.seats[pi.id]);
  let yes = ownSeats * (opts.expected ? loyalty : 1);
  for (const id of (p.cabinet && p.cabinet.partyIds) || []) if (id !== pi.id && !isRealParty(p, id)) yes += num(H.seats[id]) * 0.5;
  yes += num(H.seats.ind) * 0.1;
  if (!opts.expected) {
    // the real vote: each member decides (造反 by approval and loyalty)
    const own = ownSeats;
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

// ======================================================================== the real-party rule (round 4: the path goes through)
// A real party (自民・民主) as an organisation never decides an authoritarian step, the suppression of the press or a
// war. The organ that refuses (for the scene's wording).
function partyOrgan(pi) { return pi && pi.id === 'jimin' ? `${pi.name}の総務会` : `${pi ? pi.name : '党'}の党の機関`; }
// Kept for old callers / tests: the reason a real party's organs give (the step is NOT refused for it any more:
// realPathBefore / realPathAfter make it go through).
function realPartyRefusal(g, what) {
  const pi = partyOf(g);
  if (!pi || !pi.real) return null;
  return `${partyOrgan(pi)}は「${what}」を了承しなかった`;
}
// The government's parties: the PM's party (the core), every party in it, the real ones among them.
function govParties(g) {
  const p = pol(g);
  if (!p || !p.cabinet) return null;
  const ids = (Array.isArray(p.cabinet.partyIds) ? p.cabinet.partyIds : []).filter(Boolean);
  const pm = p.cabinet.pm;
  const playerPM = pm === 'player' || isPM(g);
  const core = playerPM ? (p.me && p.me.party) || null : pm && p.npcs && p.npcs[pm] ? p.npcs[pm].party || null : ids[0] || null;
  return { p, ids, core, playerPM, real: ids.filter((id) => isRealParty(p, id)) };
}
// Round 4: never a refusal for the step itself (the path goes through). Kept as a stable name: always null.
function realGovRefusal() { return null; }
// Does the player need a party of their own to take this step (a member of a real party; a PM who leads no party)?
function needsBreak(g) {
  const p = pol(g);
  if (!p || !p.me) return false;
  const pi = partyOf(g);
  if (pi && pi.real) return true;
  if (isPM(g) && (!pi || !pi.leader)) return true;
  return false;
}
const BREAK_NAMES = [['黎明党', '黎明', '#8a4a9a'], ['新時代党', '新時代', '#4a6a9a'], ['暁光党', '暁光', '#9a6a3a'], ['国民刷新会議', '刷新', '#5a6a5a']];
// The break with the party: 離党 (or 除名 when the player's standing is low), a new party of the members who follow,
// the cabinet goes on with it at its core (a PM keeps the premiership; the old party leaves the government).
// → the summary line (also shown in a short scene) | null when nothing had to change.
function breakaway(g, what) {
  const p = pol(g);
  if (!p || !p.me || !needsBreak(g)) return null;
  const me = p.me;
  const pi = partyOf(g);
  const old = pi ? pi.id : null;
  const oldPt = old ? p.parties[old] : null;
  const oldName = pi ? pi.name : null;
  const real = !!(pi && pi.real);
  const expelled = real && num(me.standing) < 45;
  const C = p.cabinet || {};
  const wasPM = isPM(g);
  const appr = approvalOf(g);
  const f = clamp(0.1 + num(me.standing) / 300 + (appr - 30) / 300 + (wasPM ? 0.08 : -0.05) + rnd() * 0.06, 0.05, 0.45);
  if (old) {
    const res0 = C.resigned;
    if (wasPM) C.resigned = true; // the PM leaving the governing party brings the cabinet down in the core: keep it
    try { if (typeof g.leaveParty === 'function') g.leaveParty({ why: expelled ? '除名' : '離党' }); } catch (e) { console.error(e); }
    if (wasPM) C.resigned = res0;
  }
  let id = null, nm = null;
  const rate = (ERAS[eraOf(g)] || ERAS.reiwa).priceRate || 1;
  for (const [name, short, color] of BREAK_NAMES) {
    me.funds = num(me.funds) + Math.round(5200000 / rate); // the members who follow bring the money for the new party
    try { id = g.foundParty({ name, short, color, platform: ((oldPt && oldPt.platform) || []).slice(0, 6), desc: `${g.state.name}氏が${oldName ? `${oldName}を離れて` : ''}結成した政党` }); } catch (e) { console.error(e); id = null; }
    if (id) { nm = name; break; }
  }
  if (!id) return oldName ? `（${oldName}を${expelled ? '除名され' : '離党し'}、無所属になった）` : null;
  // the members who follow (seats, members, NPC ministers and members of that party)
  let moved = 0;
  if (old && p.parties[old]) {
    for (const house of ['shugi', 'sangi']) {
      const H = p.diet && p.diet[house];
      if (!H || !H.seats) continue;
      const n = Math.round(num(H.seats[old]) * f);
      if (n <= 0) continue;
      H.seats[old] = num(H.seats[old]) - n;
      H.seats[id] = num(H.seats[id]) + n;
      moved += n;
    }
    const pt = p.parties[id];
    if (pt) pt.members = num(pt.members) + Math.round(num(p.parties[old].members) * f);
    p.parties[old].members = Math.round(num(p.parties[old].members) * (1 - f));
    const minis = new Set(Object.values(C.ministers || {}));
    for (const n of Object.values(p.npcs || {})) {
      if (!n || n.party !== old || n.id === p.parties[old].leader) continue;
      if (minis.has(n.id) ? roll(f + 0.25) : (n.office === 'shugi' || n.office === 'sangi') && roll(f)) n.party = id;
    }
  }
  // the cabinet goes on with the new party at its core; the old party leaves the government
  if (wasPM && Array.isArray(C.partyIds)) {
    const i = old ? C.partyIds.indexOf(old) : -1;
    if (i >= 0) C.partyIds.splice(i, 1, id); else C.partyIds.unshift(id);
    for (let k = C.partyIds.length - 1; k > 0; k--) if (C.partyIds.indexOf(C.partyIds[k]) !== k) C.partyIds.splice(k, 1);
    if (old) dropPartners(g, [old], () => `${oldName}は${g.state.name}政権から離れ、野党になった`);
  }
  const r = R(g);
  r.breakaways.push({ day: today(g), what, from: old, to: id, name: nm, expelled, moved, pm: wasPM });
  if (r.breakaways.length > 10) r.breakaways.shift();
  const organ = pi ? partyOrgan(pi) : null;
  news(g, `${organ ? `${organ}は「${what}」を了承しなかった。` : ''}${g.state.name}${wasPM ? '総理' : '氏'}は${oldName ? `${oldName}を${expelled ? '除名され' : '離党し'}、` : ''}同調する議員${moved}人と新党「${nm}」を結成した`);
  phone(g, `【政界】${g.state.name}${wasPM ? '総理' : '氏'}が新党「${nm}」を結成した。\n${oldName ? `${oldName}を${expelled ? '除名され' : '離党して'}、` : ''}同調する国会議員${moved}人が加わった。`, 'ドット新聞 政治部');
  queueScene(g, 'breakaway', { what, old: oldName, organ, name: nm, expelled, moved, pm: wasPM }, { front: true });
  emit(g, 'breakaway', { what, from: old, to: id, moved });
  return `（${organ ? `${organ}は「${what}」を了承しなかった。` : ''}${oldName ? `${oldName}を${expelled ? '除名され' : '離れ'}、` : ''}同調する議員${moved}人と新党「${nm}」を結成した）`;
}
// Before a step taken by the PM: the break with the party when needed (→ the summary line | null).
function realPathBefore(g, what) {
  if (!isPM(g) || !needsBreak(g)) return null;
  return breakaway(g, what);
}
// After a minister acted alone: in a real-party NPC cabinet the PM dismisses them (罷免, 憲法68条); a member of a
// real party breaks with it. → the summary line | null.
function realPathAfter(g, what) {
  if (isPM(g)) return null;
  const out = [];
  const G = govParties(g);
  const pi = partyOf(g);
  const realCore = !!(G && G.core && isRealParty(G.p, G.core));
  const realPartner = !!(G && !realCore && G.real.length);
  if ((realCore || realPartner) && inCabinet(g)) {
    // the PM of a real party does not accept it; or a real coalition partner demands the minister's dismissal
    const me = meOf(g);
    const posts = (me.posts || []).filter((x) => POL && POL.POSTS && POL.POSTS[x] && POL.POSTS[x].kind === 'cabinet' && x !== 'pm');
    for (const post of posts) { try { if (typeof g.resignPost === 'function') g.resignPost(post, '罷免'); else me.posts = me.posts.filter((x) => x !== post); } catch (e) { console.error(e); } }
    const who = realCore ? `${partyName(G.p, G.core)}の総理は「${what}」を認めず` : `連立を組む${G.real.map((id) => partyName(G.p, id)).join('・')}の求めで、総理は`;
    if (posts.length) { out.push(`（${who}、${g.state.name}大臣を罷免した）`); news(g, `${who}、「${what}」を独断で進めた${g.state.name}大臣を罷免した`); }
  }
  if (pi && pi.real) { const b = breakaway(g, what); if (b) out.push(b); }
  return out.length ? out.join('\n') : null;
}
// A real junior partner of the player's fictional-party cabinet leaves the coalition rather than take part (a neutral,
// lawful act). Never the PM's party; only when the player is the PM (otherwise realGovRefusal has refused already).
// The vacated ministries are refilled by NPCs of the remaining parties (the politics core's formCabinet).
function realPartnersLeave(g, what) {
  const G = govParties(g);
  if (!G || !G.playerPM || !G.core || isRealParty(G.p, G.core)) return [];
  const gone = G.real.filter((id) => id !== G.core);
  if (!gone.length) return [];
  dropPartners(g, gone, (id) => `${partyName(G.p, id)}は「${what}」に同意せず、連立政権から離脱した`);
  return gone;
}
// Take parties out of the cabinet (in place: callers may hold p.cabinet.partyIds) and refill their ministries.
function dropPartners(g, gone, line) {
  const p = pol(g);
  if (!p || !p.cabinet || !Array.isArray(p.cabinet.partyIds) || !gone.length) return;
  const C = p.cabinet;
  for (let i = C.partyIds.length - 1; i >= 0; i--) if (gone.includes(C.partyIds[i])) C.partyIds.splice(i, 1);
  const vacated = [];
  const keep = {};
  const me = p.me || {};
  for (const [post, who] of Object.entries(C.ministers || {})) {
    const n = p.npcs && p.npcs[who];
    if (n && gone.includes(n.party)) { n.posts = (n.posts || []).filter((x) => x !== post); vacated.push(post); }
    else if (who === 'player' && me.party && gone.includes(me.party) && C.pm !== 'player') { me.posts = (me.posts || []).filter((x) => x !== post); vacated.push(post); }
    else if (who) keep[post] = who;
  }
  for (const id of gone) news(g, typeof line === 'function' ? line(id) : `${partyName(p, id)}は連立政権から離脱した`);
  if (!vacated.length) return;
  // the player's cabinet: the politics core appoints the successors (NPCs of the remaining coalition parties)
  let done = false;
  if (C.pm === 'player' && typeof g.formCabinet === 'function') {
    try { const res = g.formCabinet({ ministers: keep }); done = !!(res && res.ok); } catch (e) { console.error(e); }
  }
  if (!done) {
    // an NPC PM's cabinet (or no politics API): Diet members of the remaining parties without a cabinet post
    const P = POL && POL.POSTS;
    for (const post of vacated) delete C.ministers[post];
    const busy = new Set(Object.values(C.ministers || {}));
    for (const post of vacated) {
      const n = Object.values(p.npcs || {}).find((x) => x && C.partyIds.includes(x.party) && (x.office === 'shugi' || x.office === 'sangi') && x.id !== C.pm && !busy.has(x.id) && !(x.posts || []).some((y) => (P ? P[y] && P[y].kind === 'cabinet' : /^minister_|^kanbo$/.test(y))));
      if (n) { C.ministers[post] = n.id; n.posts = [...(n.posts || []), post]; busy.add(n.id); } else delete C.ministers[post];
    }
  }
  news(g, `離脱した党の閣僚${vacated.length}人に代わり、残る与党から新しい大臣が任命された`);
}
// The real-party rule for coalitions: may the real party partyId be part of this government now? → reason | null.
// opts.core: the coalition's core (the PM's party) when known (default: the player's government / party);
// opts.partner: the party joining the core (joinCoalition: the player's party joins a real core).
// A real party never governs in an emergency or a dictatorship; it does not join (or come back to) the player's
// side while an authoritarian amendment is pending or in force under the player, nor within two years of an
// authoritarian / press step by the player (or at all during the premiership in which one was taken).
// NPC-led coalitions without the player's party are ordinary politics (only the regime matters).
export function regimeCoalitionBlock(g, partyId, opts = {}) {
  const p = pol(g);
  if (!p || !partyId || !isRealParty(p, partyId)) return null;
  const r = R(g);
  const name = partyName(p, partyId);
  if (r.id !== 'democracy') return `${name}は、${REGIME_INFO[r.id].name}のもとの政府には加わらない`;
  const mine = p.me && p.me.party;
  const involved = opts.core == null || !!(mine && (opts.core === mine || opts.partner === mine));
  if (!involved) return null;
  if (r.amend && r.amend.stage === 'referendum') return `${name}は、強権型の緊急事態条項の国民投票を控えた政権とは連立を組まない`;
  // the player's own government: the player is the PM, or the coalition being formed is the player's party's
  const own = isPM(g) || !!(mine && opts.core === mine);
  if (r.steps.clause && own) return `${name}は、強権型の緊急事態条項を憲法に加えた政権とは連立を組まない`;
  const formed = isPM(g) && p.cabinet ? num(p.cabinet.formed, 0) : Infinity;
  const recent = (r.record.steps || []).filter((s) => s && (today(g) - num(s.day) < 2 * YEAR_DAYS || num(s.day) >= formed));
  if (recent.length) return `${name}は、「${recent[recent.length - 1].step}」をおこなった${(g.state && g.state.name) || ''}氏の側とは連立を組まない`;
  return null;
}
// The coalition filter for the politics core (chooseCoalition / the coalition screen): the partners that may join the
// core, and the refused ones with the reason. A real core also refuses the player's party when the rule applies.
function coalitionFilter(g, core, partners = []) {
  const p = pol(g);
  const mine = p && p.me && p.me.party;
  const out = [], refused = [];
  for (const id of partners || []) {
    let why = regimeCoalitionBlock(g, id, { core });
    if (!why && id && id === mine && p && isRealParty(p, core)) why = regimeCoalitionBlock(g, core, { core, partner: id });
    if (why) refused.push({ id, why }); else out.push(id);
  }
  return { core, partners: out, refused };
}
// Every new / changed cabinet (首班指名・組閣・連立): a real party that may not be in it leaves (never the core).
function enforceCoalition(g) {
  const G = govParties(g);
  if (!G || (!G.real.length && !(G.core && isRealParty(G.p, G.core)))) return;
  const why = {};
  for (const id of G.real) if (id !== G.core) { const w = regimeCoalitionBlock(g, id, { core: G.core || undefined }); if (w) why[id] = w; }
  // a real core does not keep the player's party as a partner while the rule applies (e.g. after the player's
  // dictatorship stepped down): the player's party leaves that coalition, its ministries are refilled
  const mine = G.p.me && G.p.me.party;
  if (G.core && isRealParty(G.p, G.core) && mine && mine !== G.core && G.ids.includes(mine) && !G.playerPM) {
    const w = regimeCoalitionBlock(g, G.core, { core: G.core, partner: mine });
    if (w) why[mine] = w;
  }
  const bad = Object.keys(why);
  if (!bad.length) return;
  dropPartners(g, bad, (id) => why[id]);
}

// ======================================================================== consequences of a step
// size 1..3: backlash. Every authoritarian step: 支持率, デモ, 国際社会, 造反, 民衆の不満.
function backlash(g, step, size, opts = {}) {
  const r = R(g);
  const demo = r.id === 'democracy';
  bumpApproval(g, -(3 + size * 3) * (demo ? 1 : 0.6), -(1 + size * 1.5), 'regime', step);
  r.unrest = clamp(r.unrest + size * (demo ? 2 : 3) + (opts.unrest || 0), 0, 100);
  raiseIntl(g, size * (demo ? 2 : 4) + (opts.intl || 0), step);
  if (opts.defect !== false && r.id !== 'dictatorship') defect(g, (partyOf(g) && partyOf(g).own ? 0.02 : 0.05) * size, step);
  spawnDemo(g, { cause: step, size: size >= 3 ? 'large' : size === 2 ? 'medium' : 'small', against: 'government' });
  const last = r.record.steps[r.record.steps.length - 1];
  if (!last || last.step !== step || last.day !== today(g)) r.record.steps.push({ day: today(g), step });
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
  news(g, `${o.label || `「${o.cause}」に反対するデモ`}。全国で${size}が集まった`);
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
    news(g, `選挙も国会も止まった。海外メディアは日本の体制を「${lab.label}」と報じている`);
    phone(g, `【速報】\n選挙と国会が止められ、${g.state.name}政権は事実上の独裁体制になった。\n海外メディアは「${lab.label}」と報じている。`);
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
  r.fictionShown = true; // (no in-game notice: the fiction line is on the title screen only)
}

// ======================================================================== regime steps
const AUTH = (name) => name;
function needPM(g) {
  if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  if (!isPM(g)) return '内閣総理大臣でなければできない';
  return null;
}
// Round 4: a step is never refused for the player's party (a real party, no party, a party the player does not lead):
// the step's run makes the player break with it first (realPathBefore). Kept as a stable name.
function needFictionalLeader() { return null; }
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
    desc: '非常時に内閣が法律と同じ効力の政令を出し、選挙の延期や国会の閉会もできる条文を憲法に加える改正案（強権型）。各院の総議員の3分の2で発議し、国民投票へ。',
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
  amend_article9: {
    name: '9条の改正（交戦権の容認）の発議', auth: false, war: true, regimes: ['democracy', 'emergency'],
    desc: '憲法9条を改め、国の交戦権を認め、自衛隊を戦争もできる軍にする改正案。各院の総議員の3分の2で発議し、国民投票へ。成立すれば、民主制のままでも国会の承認で宣戦できる。',
    check(g) {
      const r = R(g);
      const w = needPM(g);
      if (w) return w;
      if (r.steps.art9) return 'すでに憲法が改正されている（交戦権の容認）';
      if (r.amend9 && r.amend9.stage === 'referendum') return 'すでに発議され、国民投票を待っている';
      if (!referendumLawOk(g)) return since(g, 2007, 5) ? '国民投票法がまだ施行されていない（2010年5月施行）' : '国民投票の手続きを定める法律（国民投票法）がまだない。先に国民投票法を制定する';
      if (!inSession(g)) return '国会が開かれていない（発議は会期中に、両院の本会議で採決する）';
      return null;
    },
    run(g) {
      const r = R(g);
      const s = amendVotes(g, 'shugi'), a = amendVotes(g, 'sangi');
      const ok = s.yes >= s.need && a.yes >= a.need;
      const line = `衆議院 賛成${s.yes}／必要${s.need}（総議員${s.total}）・参議院 賛成${a.yes}／必要${a.need}（総議員${a.total}）`;
      bumpApproval(g, -2, -1, 'regime', '9条の改正の発議');
      spawnDemo(g, { cause: '9条の改正', label: '9条の改正に反対するデモ', size: 'medium', segment: 'young', against: 'war' });
      r.record.steps.push({ day: today(g), step: '9条改正の発議' });
      if (!ok) {
        r.amend9 = { stage: 'failed', day: today(g), votes: { s, a } };
        news(g, `9条の改正（交戦権の容認）の原案は、3分の2に届かず発議されなかった（${line}）`);
        return { ok: true, passed: false, text: `3分の2に届かず、発議できなかった。\n${line}` };
      }
      const wait = rint(20, 60);
      r.amend9 = { stage: 'referendum', day: today(g), voteDay: today(g) + wait, votes: { s, a } };
      news(g, `9条の改正（交戦権の容認）が両院の3分の2で発議された。${dateText(g, today(g) + wait)}に国民投票（${line}）`);
      phone(g, `【憲法改正の発議】\n9条の改正（交戦権の容認）が発議された。\n国民投票は${dateText(g, today(g) + wait)}。`);
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
      news(g, `${g.state.name}総理が全国に緊急事態を宣言した`);
      phone(g, `【緊急事態宣言】\n${g.state.name}総理が全国に緊急事態を宣言した。`);
      return { ok: true, text: '全国に緊急事態を宣言した。' };
    },
  },
  self_coup: {
    name: '憲法の停止（超法規的な非常事態）', auth: true, regimes: ['democracy'],
    desc: '憲法の緊急事態条項がないまま、政令で非常事態を宣言して憲法の一部を止める。違憲であり、自衛隊・官僚・国会が従うかは賭けになる。失敗すれば総理の座を追われ、裁かれる。',
    check(g) {
      const r = R(g);
      const w = needPM(g);
      if (w) return w;
      if (r.steps.clause) return '緊急事態条項が憲法にある（「緊急事態宣言」で進められる）';
      return null;
    },
    odds(g) {
      const p = pol(g), pi = partyOf(g);
      const H = p && p.diet && p.diet.shugi;
      // a PM who must first break with a real party (or found one) leads only the members who follow (about a third)
      const share = (H && pi ? num(H.seats[pi.id]) / Math.max(1, num(H.total)) : 0.3) * (needsBreak(g) ? 0.6 : 1);
      const threat = WORLD && WORLD.W ? num(WORLD.W(g).threat, 40) : 40;
      return clamp(0.12 + (approvalOf(g) - 30) / 150 + share * 0.3 + (threat - 40) / 300 - (pressValue(g) - 50) / 400 + (worldCall('attackOnJapan', g) ? 0.1 : 0), 0.04, 0.7);
    },
    run(g) {
      const r = R(g);
      const p0 = REGIME_STEPS.self_coup.odds(g);
      r.record.steps.push({ day: today(g), step: '憲法の停止' });
      if (!roll(p0)) {
        backlash(g, '憲法の停止の失敗', 3, { intl: 6 });
        news(g, `${g.state.name}総理が政令による非常事態の宣言を試みたが、自衛隊の幹部と官僚、国会が従わなかった`);
        phone(g, `【速報】${g.state.name}総理の「非常事態の宣言」に、自衛隊・官僚・国会が従わなかった。\n総理は辞任に追いこまれた。`);
        try { if (typeof g.resignPM === 'function') g.resignPM('憲法の停止の失敗'); } catch (e) { console.error(e); }
        scheduleTrial(g, 'coup');
        return { ok: true, passed: false, text: `宣言は従われなかった。総理の座を追われ、捜査が始まる。（成功の見込みは ${Math.round(p0 * 100)}% だった）` };
      }
      r.steps.emergency = true;
      r.steps.courtIgnored = true;
      setRegime(g, 'emergency', '憲法の停止（超法規的な非常事態）');
      backlash(g, '憲法の停止', 3, { intl: 12, unrest: 8 });
      press(g, -10, '憲法の停止');
      news(g, `${g.state.name}総理が政令で非常事態を宣言し、憲法の一部を停止した。各国は「クーデター」と非難している`);
      phone(g, `【非常事態】\n${g.state.name}総理が政令で非常事態を宣言し、憲法の一部を停止した。`);
      return { ok: true, passed: true, text: `非常事態を宣言した。自衛隊と官僚は、ひとまず命令に従った。（見込み ${Math.round(p0 * 100)}%）` };
    },
  },
  suspend_elections: {
    name: '選挙の停止', auth: true, regimes: ['emergency', 'dictatorship'],
    desc: '緊急事態を理由に、すべての選挙を無期限に延期する。議員や首長の任期はそのまま延びる。',
    check(g) {
      const r = R(g);
      const w = needPM(g) || needFictionalLeader(g, '選挙の停止');
      if (w) return w;
      if (r.id === 'democracy') return '民主制のもとでは選挙を止められない（憲法15条・47条。任期は憲法と法律で決まっている）（道：緊急事態宣言〔緊急事態条項の改正〕か、憲法の停止で緊急事態にする）';
      if (r.steps.elections) return 'すでに選挙は止められている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.elections = true;
      backlash(g, '選挙の停止', 3);
      press(g, -4, '選挙の停止');
      news(g, '政府は、緊急事態を理由にすべての選挙を無期限に延期した');
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
      if (r.id === 'democracy') return '民主制のもとでは国会を止められない（国会は国権の最高機関：憲法41条）（道：緊急事態宣言〔緊急事態条項の改正〕か、憲法の停止で緊急事態にする）';
      if (r.steps.diet) return 'すでに国会は止められている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.diet = true;
      const p = pol(g);
      if (p && p.diet && p.diet.session) { p.diet.session.end = today(g) - 1; p.diet.session.extended = true; }
      backlash(g, '国会の停止', 3);
      news(g, '国会が閉じられ、政府は政令で国を動かしはじめた');
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
      if (r.id === 'democracy') return '民主制のもとでは政党の活動を禁止できない（結社の自由：憲法21条）（道：緊急事態宣言〔緊急事態条項の改正〕か、憲法の停止で緊急事態にする）';
      if (r.steps.opposition) return 'すでに野党は禁止されている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.opposition = true;
      backlash(g, '野党の禁止', 3, { intl: 3 });
      press(g, -6, '野党の禁止');
      news(g, `政府は野党の活動を禁止した。海外メディアは「${regimeLabel(g).label}」と報じている`);
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
      if (r.id !== 'dictatorship') return '自衛隊は憲法9条のもとの組織。政令で国軍にできるのは独裁体制（選挙と国会を止めた体制）になってから。民主制のままなら「9条の改正（交戦権の容認）」の発議と国民投票';
      if (r.steps.army) return 'すでに国軍に改められている';
      return null;
    },
    run(g) {
      const r = R(g);
      r.steps.army = true;
      const quit = rint(8000, 20000);
      r.sdf.quit += quit;
      backlash(g, '自衛隊の国軍化', 3, { intl: 5 });
      news(g, `政府は政令で自衛隊を「国軍」に改めた。抗議して約${n0(quit)}人の隊員が職を辞した`);
      phone(g, `自衛隊が政令で「国軍」に改められた。\n文民統制のもとで任務についてきた隊員のうち、約${n0(quit)}人が辞職した。`);
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
      bumpApproval(g, 4, 3, 'regime', '緊急事態の解除');
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
// The share voting yes in each segment (the 強権型 emergency clause is unpopular with most groups). EXPORTED (stable
// name, frozen): the UIs' projection uses it through referendumProjection(g).
export const REF_BASE = Object.freeze({ young: 0.25, families: 0.32, elderly: 0.42, employees: 0.33, selfemployed: 0.4, business: 0.4, farmers: 0.42, unions: 0.15, urban: 0.28, rural: 0.44, floating: 0.27 });
// The segment weights of the year (politics core) or equal weights.
function refWeights(g) {
  const segs = Object.keys(REF_BASE);
  let W = null;
  try { W = POL && POL.segWeights ? POL.segWeights(yearOf(g)) : null; } catch (e) { W = null; }
  if (!W) { W = {}; for (const s of segs) W[s] = 1 / segs.length; }
  return W;
}
// The share voting yes in one segment (noise: the random part of the real vote; 0 for the projection).
const refShare = (g, s, noise = 0) => clamp(REF_BASE[s] + (approvalOf(g) - 40) * 0.006 - R(g).unrest * 0.001 + noise, 0.05, 0.9);
// EXPORTED: the 国民投票 projection without the random part → { yes (%, one decimal), bySeg { seg: share 0..1 } }.
export function referendumProjection(g) {
  const W = refWeights(g);
  const bySeg = {};
  let yes = 0, wsum = 0;
  for (const s of Object.keys(REF_BASE)) { const v = refShare(g, s); bySeg[s] = v; yes += num(W[s]) * v; wsum += num(W[s]); }
  return { yes: Math.round((wsum ? yes / wsum : 0.3) * 1000) / 10, bySeg };
}
// EXPORTED: the 発議 projection in both houses → { shugi: { yes, total, need }, sangi: {…}, ok } (expected votes).
export function amendProjection(g) {
  const shugi = amendVotes(g, 'shugi', { expected: true }), sangi = amendVotes(g, 'sangi', { expected: true });
  return { shugi, sangi, ok: shugi.yes >= shugi.need && sangi.yes >= sangi.need };
}
function runReferendum(g) {
  const r = R(g);
  const A = r.amend;
  if (!A || A.stage !== 'referendum') return;
  const W = refWeights(g);
  const segs = Object.keys(REF_BASE);
  const bySeg = {};
  let yes = 0, wsum = 0;
  for (const s of segs) {
    const v = refShare(g, s, gauss() * 0.03);
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
    bumpApproval(g, -6, -3, 'regime', '国民投票での否決');
  }
  queueScene(g, 'referendum', { yes: A.result.yes, passed, turnout, bySeg });
  emit(g, 'step', { kind: 'referendum', passed });
}

// The 9条 amendment (交戦権の容認): more support than the 強権型 emergency clause; a threat raises it. EXPORTED (frozen).
export const REF9_BASE = Object.freeze({ young: 0.36, families: 0.33, elderly: 0.42, employees: 0.41, selfemployed: 0.45, business: 0.5, farmers: 0.42, unions: 0.16, urban: 0.37, rural: 0.45, floating: 0.35 });
const ref9Share = (g, s0, noise = 0) => {
  const threat = WORLD && WORLD.W ? num(WORLD.W(g).threat, 40) : 40;
  const atk = worldCall('attackOnJapan', g) ? 0.12 : 0;
  return clamp(REF9_BASE[s0] + (approvalOf(g) - 40) * 0.005 + (threat - 40) * 0.004 + atk - R(g).unrest * 0.001 + noise, 0.05, 0.92);
};
export function referendum9Projection(g) {
  const W0 = refWeights(g);
  const bySeg = {};
  let yes = 0, wsum = 0;
  for (const s0 of Object.keys(REF9_BASE)) { const v = ref9Share(g, s0); bySeg[s0] = v; yes += num(W0[s0]) * v; wsum += num(W0[s0]); }
  return { yes: Math.round((wsum ? yes / wsum : 0.4) * 1000) / 10, bySeg };
}
function runReferendum9(g) {
  const r = R(g);
  const A0 = r.amend9;
  if (!A0 || A0.stage !== 'referendum') return;
  const W0 = refWeights(g);
  const bySeg = {};
  let yes = 0, wsum = 0;
  for (const s0 of Object.keys(REF9_BASE)) { const v = ref9Share(g, s0, gauss() * 0.03); bySeg[s0] = Math.round(v * 1000) / 10; yes += num(W0[s0]) * v; wsum += num(W0[s0]); }
  yes = wsum ? yes / wsum : 0.4;
  const turnout = Math.round(clamp(52 + gauss() * 4, 38, 72) * 10) / 10;
  const passed = yes > 0.5;
  A0.stage = passed ? 'passed' : 'rejected';
  A0.result = { yes: Math.round(yes * 1000) / 10, turnout, bySeg, day: today(g) };
  news(g, `国民投票：9条の改正（交戦権の容認）は賛成${A0.result.yes}%で${passed ? '承認' : '否決'}（投票率${turnout}%）`);
  phone(g, `【国民投票の結果】\n9条の改正（交戦権の容認）\n賛成 ${A0.result.yes}%・反対 ${Math.round((100 - A0.result.yes) * 10) / 10}%（投票率${turnout}%）\n${passed ? '承認され、憲法が改正された。' : '過半数に届かず、改正は成立しなかった。'}`);
  if (passed) { r.steps.art9 = true; r.steps.art9Day = today(g); raiseIntl(g, 6, '9条の改正'); }
  else bumpApproval(g, -5, -2, 'regime', '国民投票での否決');
  queueScene(g, 'referendum', { yes: A0.result.yes, passed, turnout, bySeg, what: '9条の改正（交戦権の容認）' });
  emit(g, 'step', { kind: 'referendum9', passed });
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
    bumpApproval(g, 2, 1, 'regime', '最高裁判決に従った');
    r.unrest = Math.max(0, r.unrest - 6);
    news(g, `政府は最高裁の判決に従い、「${{ suspend_elections: '選挙の停止', suspend_diet: '国会の停止', ban_opposition: '野党の禁止', sns_bill: '規制法', censor: '検閲' }[step] || step}」を取り消した`);
    return '判決に従った。';
  }
  r.steps.courtIgnored = true;
  backlash(g, '最高裁判決の無視', 3, { intl: 8, unrest: 6 });
  news(g, '政府は最高裁の判決を無視した。法の支配が揺らいでいる');
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
    desc: '国会で、放送局が政治的公平（放送法の番組編集準則）に反すれば電波法76条で電波を止めることもありうる、と言及する。',
    // the 番組編集準則: 放送法3条の2第1項 until the 2010 amendment took effect (2011-06-30), 4条1項 since
    descFor: (g) => `国会で、放送局が政治的公平（${since(g, 2011, 7) ? '放送法4条' : '放送法3条の2'}）に反すれば電波法76条で電波を止めることもありうる、と言及する。`,
    run(g) {
      press(g, -6, '電波停止への言及');
      bumpApproval(g, -3, -1, 'regime', '電波停止への言及');
      const me = meOf(g);
      if (me) me.standing = clamp(num(me.standing) - 4, 0, 100);
      news(g, `${g.state.name}${isPM(g) ? '総理' : '大臣'}が国会で「電波停止」に言及。放送界や弁護士会から「表現の自由への威嚇だ」と抗議`);
      spawnDemo(g, { cause: '報道への圧力', size: 'small', segment: 'young', against: 'speech' });
      return '「電波停止もありうる」と言及した。放送局や弁護士会、党内からも批判が出ている。';
    },
  },
  exclude: {
    name: '特定の記者の排除', regimes: ['democracy'], size: 1,
    desc: '記者会見で、批判的な記者の質問を受けつけないようにする。',
    run(g) {
      press(g, -4, '記者の排除');
      bumpApproval(g, -2, -1, 'regime', '記者の排除');
      // by role: the PM's 官邸 press conference, or the minister's own
      news(g, isPM(g) ? '首相官邸の記者会見で特定の記者の質問が打ち切られ、記者クラブが抗議文を出した' : `${g.state.name}大臣の記者会見で特定の記者の質問が打ち切られ、記者クラブが抗議文を出した`);
      return '批判的な記者の質問を受けつけないようにした。記者クラブが抗議している。';
    },
  },
  pressure: {
    name: '放送局への圧力', regimes: ['democracy'], size: 2,
    desc: '政権に批判的な番組について、放送局の幹部に「公平な報道」を求める文書を送る。',
    run(g) {
      press(g, -7, '放送局への圧力');
      bumpApproval(g, -2, -1, 'regime', '放送局への圧力');
      if (roll(0.5)) {
        bumpApproval(g, -5, -2, 'regime', '放送局への要請文書の発覚');
        news(g, `放送局への「要請文書」が明らかに。${g.state.name}政権に「報道への介入だ」と批判が集まる`);
        defect(g, 0.02, '報道への圧力');
        spawnDemo(g, { cause: '報道への介入', size: 'medium', segment: 'urban', against: 'speech' });
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
      bumpApproval(g, -1, -1, 'regime', '情報公開の拒否');
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
      bumpApproval(g, -8, -3, 'regime', '言論規制法案');
      defect(g, 0.04, '言論規制法案');
      spawnDemo(g, { cause: '言論規制法案', size: 'large', segment: 'young', against: 'speech' });
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
      news(g, `政府が報道の事前検閲を始めた（憲法21条2項は検閲を禁じている）。海外メディアは「${regimeLabel(g).label}」と報じている`);
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
      backlash(g, 'ジャーナリストの拘束', 3, { intl: 6, unrest: 3, defect: false });
      news(g, `政府に批判的な記者${n}人が拘束された。国際的な報道団体と各国政府が即時の解放を求めている`);
      phone(g, `記者${n}人が拘束された。\n各国政府と報道団体が強く非難している。`, 'ドット新聞 国際部');
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
  if (!A.regimes.includes(r.id)) return r.id === 'democracy' ? `民主制では、${A.name}はできない（表現の自由・検閲の禁止：憲法21条）${'（道：緊急事態宣言〔緊急事態条項の改正〕か、憲法の停止で緊急事態にする）'}` : `いまの体制では、これは選ばない（${REGIME_INFO[r.id].name}。民主制のときの手段）`;
  if (r.id === 'democracy' ? !inCabinet(g) : !isPM(g)) return r.id === 'democracy' ? '内閣の一員（総理・大臣）でなければできない' : '内閣総理大臣でなければできない';
  // (round 4) a real party in the government never makes this a refusal: the PM breaks with a real party first, a
  // minister of a real-party NPC cabinet acts alone and is dismissed afterwards, a real junior partner leaves
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
      if (Number.isFinite(v) && v > 0) {
        const p = pol(g);
        const gdp = p && p.economy ? num(p.economy.gdp, 0) : 0;
        return { cho: Math.round(v * 100) / 100, gdpPct: gdp > 0 ? Math.round((v / gdp) * 10000) / 100 : null, source: 'govt' };
      }
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
    `${army ? '国軍（政令で自衛隊を改編）' : '自衛隊（1954年発足）'}・${ministry}`,
    `人員：定員 約${(per.quota / 10000).toFixed(1)}万人・現員 約${(per.actual / 10000).toFixed(1)}万人${per.approx ? '（目安）' : ''}`,
    `防衛費：約${bud.cho}兆円${bud.gdpPct ? `（GDP比 約${bud.gdpPct}%）` : ''}`,
    ...defenseRuleLines(g),
    `指揮：内閣総理大臣（最高指揮官）・${postName(g, 'minister_defense')}。文民統制`,
    pko ? 'PKO協力法（1992年）：国連の平和維持活動に参加できる' : 'PKO協力法はまだない（現実には1992年6月成立）',
    lawInForce(g, 'security_law') ? '平和安全法制（2015年）：存立危機事態での限定的な集団的自衛権など' : null,
  ].filter(Boolean);
  if (r.sdf.haken) lines.push(`災害派遣中：${r.sdf.haken.where}（約${n0(r.sdf.haken.personnel)}人）`);
  for (const d of dep) lines.push(`${d.kind === 'pko' ? 'PKO' : '派遣'}：${d.where}（約${n0(d.personnel)}人）`);
  lines.push(`緊急発進（スクランブル）：${r.sdf.scrambles ? `今年 約${n0(r.sdf.scrambles)}回。` : ''}この時代は年に約${n0(scrambleLevel(yearOf(g)))}回（目安）`);
  return {
    name: army ? '国軍' : '自衛隊', status: army ? 'kokugun' : 'sdf', founded: 1954, agency: ministry,
    minister: postName(g, 'minister_defense'), personnel: per, budget: bud, rules: defenseRuleLines(g), pkoLaw: pko,
    deployments: dep.map((d) => ({ ...d })), haken: r.sdf.haken ? { ...r.sdf.haken } : null,
    scrambles: r.sdf.scrambles, scrambleLevel: scrambleLevel(yearOf(g)), kaijo: r.sdf.kaijo ? { ...r.sdf.kaijo } : null, pkoOffer: r.sdf.pkoOffer ? { ...r.sdf.pkoOffer } : null, lines,
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
      if (early) { bumpApproval(g, -4, -1, 'disaster', '自衛隊の早すぎる撤収'); news(g, `${h.where}から自衛隊が撤収。被災地からは「早すぎる」との声`); }
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
      bumpApproval(g, 1, 0, 'regime', 'PKOへの派遣');
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
      bumpApproval(g, ok ? 2 : -1, 0, 'regime', '海上警備行動');
      return { ok: true, text: ok ? '海上警備行動を発令した。不審船は領海の外へ去った。' : '海上警備行動を発令したが、不審船は見失われた。' };
    },
  },
  defense: {
    name: '防衛出動', desc: '自衛隊法76条：武力攻撃が発生した（または明白な危険が切迫した）ときだけ。閣議決定と国会の承認（原則事前）が必要。',
    check(g) {
      const r = R(g);
      const w = canOrderSDF(g);
      if (w) return w;
      if (r.war && r.war.phase === 'war') return '戦時の命令は「戦争」の画面から出す';
      if (!isPM(g)) return '防衛出動を命じるのは内閣総理大臣（閣議決定と国会の承認が必要）';
      if (!worldCall('attackOnJapan', g)) return '日本への武力攻撃は発生していない。防衛出動は武力攻撃事態などに限られ、閣議決定と国会の承認（原則事前）が必要（自衛隊法76条）。これまで一度も命じられたことはない';
      return null;
    },
    run(g) {
      const a = worldCall('attackOnJapan', g);
      // the Diet's approval (原則事前): an armed attack makes it likely
      const p = clamp(dietWarOdds(g) + 0.35, 0.3, 0.97);
      if (R(g).id === 'democracy' && !roll(p)) { bumpApproval(g, -3, 0, 'regime', '防衛出動の承認案の否決'); news(g, '防衛出動の承認案は、国会で否決された'); return { ok: true, success: false, text: `国会が防衛出動を承認しなかった。（見込み ${Math.round(p * 100)}%）` }; }
      const res = warOrder(g, 'declare', { target: a.by, mode: 'defense' });
      return res && res.ok ? { ...res, text: `国会の承認を得た（自衛隊法76条）。\n${res.text || ''}` } : res;
    },
  },
  attack: {
    name: '他国への武力行使', desc: '他国を攻める。',
    check(g) {
      const r = R(g);
      if (r.id === 'dictatorship' && r.steps.army) return '戦争は「戦争」の画面（または「世界情勢」）から宣戦する';
      if (r.id === 'dictatorship') return 'まず自衛隊を国軍に改める（「体制」の手続き）';
      if (r.steps.art9) return '9条は改正ずみ：「世界情勢」から相手国を選んで宣戦する（国会の承認が要る）';
      return WAR_PATHS;
    },
    run() { return { ok: false }; },
  },
  kokugun: {
    name: '国軍化', desc: '自衛隊を国軍に改める（独裁体制のもと、政令で）。',
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
  if (by === 'pm' || by === 'defmin') bumpApproval(g, quick ? 3 : 1, 0, 'disaster', '自衛隊の災害派遣');
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
  // 震度5・6 were split into 弱・強 in October 1996 (気象庁震度階級); before: 震度6
  const shindo = kind === 'quake' || kind === 'tsunami' ? (tier >= 3 ? '7' : !since(g, 1996, 10) ? '6' : tier === 2 ? '6強' : '6弱') : null;
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
  const head = d.kind === 'storm' ? `${d.name}。各地で川の氾濫や土砂崩れ` : d.kind === 'volcano' ? `ドット岳が噴火。${since(g, 2007, 12) ? '噴火警戒レベルが引き上げられた' : '気象庁が緊急火山情報を出した'}` : `${d.name}（M${d.mag}・最大震度${d.shindo}）が発生${d.kind === 'tsunami' ? '。大津波警報' : ''}`;
  news(g, `【災害】${head}`);
  phone(g, `【速報】${head}。\n${d.where}で被害が出ている。`, 'ドット新聞 社会部');
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
    cancelWork(g);
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
// 災害対策基本法 before the December 1995 amendment: the 緊急災害対策本部 only together with the 災害緊急事態の布告.
const kinkyuNeedsFukoku = (g) => !since(g, 1995, 12);
// The office the 本部 is put in (総理府 until the 2001 reorganisation, then 内閣府).
const honbuOffice = (g) => (since(g, 2001, 1) ? '内閣府' : '総理府');
// Real history from before the game's own timeline (the game's world has no real disaster after its start).
const realPast = (g, year) => (ERA_BASE[eraOf(g)] ?? 2026) > year;
// A registry entry's description for the game's date (descFor(g) when the text depends on the date). EXPORTED.
export function actionDesc(A, g) {
  if (!A) return '';
  try { if (typeof A.descFor === 'function' && g) return A.descFor(g) || A.desc || ''; } catch (e) { console.error(e); }
  return A.desc || '';
}
// Each action: who (roles), when (phases), prerequisites, and what it does. run → result text.
// desc is era-neutral; descFor(g) (when present) is the text of the game's date (the lists use it).
export const DISASTER_ACTIONS = {
  honbu_hijo: {
    name: '非常災害対策本部の設置', roles: ['pm'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '災害対策基本法24条：非常災害のとき、政府に臨時に置き、各省庁の応急対策をまとめる。',
    descFor: (g) => (since(g, 2021, 5)
      ? '災害対策基本法24条：非常災害のとき、内閣府に置く（2021年5月の改正で本部長は内閣総理大臣に）。'
      : `災害対策基本法24条：非常災害のとき、${honbuOffice(g)}に臨時に置く。本部長は国務大臣（${honbuChief(g, 'hijo')}）。`),
    check(g, d) { if (d.honbu) return `すでに${d.honbu === 'kinkyu' ? '緊急' : '非常'}災害対策本部を設置した`; return null; },
    run(g, d) {
      d.honbu = 'hijo';
      d.done.honbu = today(g);
      const quick = today(g) - d.start <= 0;
      d.score += quick ? 2 : 0;
      bumpApproval(g, quick ? 2 : 0, 0, 'disaster', '非常災害対策本部の設置');
      d.log.push({ day: today(g), text: `非常災害対策本部（本部長：${honbuChief(g, 'hijo')}）` });
      news(g, `政府が${d.name}の非常災害対策本部を設置（本部長：${honbuChief(g, 'hijo')}）`);
      return `非常災害対策本部を設置した（本部長：${honbuChief(g, 'hijo')}）。各省庁の応急対策をまとめる。`;
    },
  },
  honbu_kinkyu: {
    name: '緊急災害対策本部の設置', roles: ['pm'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '災害対策基本法28条の2：とくに激甚な非常災害のとき、内閣総理大臣を本部長として置く。',
    descFor: (g) => (kinkyuNeedsFukoku(g)
      ? 'この時代の災害対策基本法28条の2：異常かつ激甚な非常災害で、災害緊急事態の布告（105条）があったときだけ置ける。本部長は内閣総理大臣。'
      : '災害対策基本法28条の2：著しく異常かつ激甚な非常災害のとき、閣議にかけて置く（1995年12月の改正で、布告がなくても置けるように）。本部長は内閣総理大臣、全閣僚が本部員。'),
    check(g, d) {
      if (d.honbu === 'kinkyu') return 'すでに緊急災害対策本部を設置した';
      if (d.tier < 3) return '著しく異常かつ激甚な災害ではない（緊急災害対策本部の要件にあたらない。非常災害対策本部で対応する）';
      if (kinkyuNeedsFukoku(g) && !d.done.fukoku) return 'この時代の災害対策基本法では、緊急災害対策本部は災害緊急事態の布告とあわせてしか置けない（布告は20日以内に国会の承認を求める：106条）。非常災害対策本部で対応するか、先に布告する';
      return null;
    },
    run(g, d) {
      d.honbu = 'kinkyu';
      d.done.honbu = today(g);
      const quick = today(g) - d.start <= 0;
      d.score += quick ? 3 : 1;
      bumpApproval(g, quick ? 4 : 1, 0, 'disaster', '緊急災害対策本部の設置');
      d.log.push({ day: today(g), text: '緊急災害対策本部（本部長：内閣総理大臣）' });
      news(g, `政府が${d.name}の緊急災害対策本部を設置（本部長：内閣総理大臣、全閣僚が本部員）`);
      return '閣議決定で緊急災害対策本部を設置した。本部長として、全閣僚に応急対策を指示した。';
    },
  },
  fukoku: {
    name: '災害緊急事態の布告', roles: ['pm'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '災害対策基本法105条：非常災害が国の経済と公共の福祉に重大な影響を及ぼすとき、閣議にかけて布告する。緊急災害対策本部が置かれ（107条）、国会の閉会中などで国会を待つ時間がなければ、物資の配給や価格の統制の政令も出せる（109条）。選挙や国会を止める力はない。',
    descFor: (g) => (kinkyuNeedsFukoku(g)
      ? '災害対策基本法105条：非常災害が国の経済と公共の福祉に重大な影響を及ぼすとき、閣議にかけて布告する（20日以内に国会の承認を求める）。この時代は、布告があってはじめて緊急災害対策本部を置ける。国会の閉会中などには、物資の配給や価格の統制の政令も出せる（109条）。選挙や国会を止める力はない。'
      : '災害対策基本法105条：非常災害が国の経済と公共の福祉に重大な影響を及ぼすとき、閣議にかけて布告する（20日以内に国会の承認を求める）。緊急災害対策本部が置かれ（107条）、国会の閉会中などで国会を待つ時間がなければ、物資の配給や価格の統制の政令も出せる（109条）。選挙や国会を止める力はない。'),
    check(g, d) { if (d.done.fukoku) return 'すでに布告した'; if (d.tier < 3) return '国の経済と公共の福祉に重大な影響を及ぼすほどの災害ではない（布告の要件にあたらない）'; return null; },
    run(g, d) {
      d.done.fukoku = today(g);
      d.score += 1;
      bumpApproval(g, 1, 0, 'disaster', '災害緊急事態の布告');
      if (d.honbu !== 'kinkyu') { d.honbu = 'kinkyu'; d.done.honbu = d.done.honbu || today(g); }
      news(g, `政府が${d.name}について災害緊急事態を布告した（災害対策基本法105条）`);
      return '閣議にかけて、災害緊急事態を布告した。緊急災害対策本部のもとで、生活必需品の買い占めや値上がりを抑える準備に入った。';
    },
  },
  sdf_request: {
    name: '自衛隊の災害派遣を要請', roles: ['chiji'], phases: ['hassei', 'shodo', 'hinan'],
    desc: '自衛隊法83条：都道府県知事が、自衛隊の部隊の派遣を求める。',
    // 防衛庁長官 before 2007-01; the 市町村長's request to the 知事 (災対法68条の2) since the 1995-12 amendment
    descFor: (g) => `自衛隊法83条：都道府県知事が${postName(g, 'minister_defense')}などに部隊の派遣を求める${since(g, 1995, 12) ? '（市区町村長は知事に要請を求める）' : ''}。`,
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
      if (early) { bumpApproval(g, -2, 0, 'disaster', '救助の最中の視察'); news(g, `${g.state.name}氏が${d.name}の被災地を視察。「救助の最中に」と批判も`); return '被災地を視察したが、救助活動の最中だったため「現場の負担になる」と批判された。'; }
      bumpApproval(g, 1, 0, 'disaster', '被災地の視察');
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
      bumpApproval(g, 2, 0, 'disaster', '激甚災害の指定');
      news(g, `政府は${d.name}を激甚災害に指定する政令を閣議決定した（本激）`);
      queueScene(g, 'cabinet', { what: 'gekijin' }, { front: true });
      return '激甚災害の指定を閣議決定した。復旧事業の国の補助がかさ上げされる。';
    },
  },
  shienho: {
    name: '被災者生活再建支援法の適用', roles: ['chiji'], phases: ['hinan', 'fukko'],
    desc: '被災者生活再建支援法：住宅が全壊した世帯などに、国と都道府県の支援金を出す。',
    descFor: (g) => (!since(g, 1998, 11) ? '被災した世帯の生活再建に国の支援金を出す法律は、この時代にはまだない（現実には1998年に成立）。'
      : since(g, 2007, 11) ? '被災者生活再建支援法：住宅が全壊した世帯などに支援金（2007年の改正で、使いみちを問わない定額。最高300万円）。'
        : since(g, 2004, 4) ? '被災者生活再建支援法：住宅が全壊した世帯などに支援金（2004年の改正で最高300万円。うち200万円は住まいの安定のための支援）。'
          : '被災者生活再建支援法（1998年11月施行）：住宅が全壊した世帯などに、生活必需品などの支援金（最高100万円）。'),
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
      // govt.js (A1) when loaded (its 補正予算 records), else the politics core's stimulus bill
      if (typeof g.supplementaryBudget === 'function') {
        const res = g.supplementaryBudget({ amount, purpose: '災害復旧' });
        if (!res || !res.ok) return { ok: false, why: (res && res.why) || '補正予算案を出せなかった' };
      } else if (typeof g.proposeBill === 'function') {
        const id = g.proposeBill({ policy: 'stimulus', params: { amount }, title: `補正予算案（災害復旧・${amount}兆円）` });
        if (!id) return { ok: false, why: g.lastPoliticsError || '補正予算案を出せなかった' };
      }
      d.done.hosei = today(g);
      d.score += 2;
      return `災害復旧の補正予算案（${amount}兆円）を閣議決定した。${inSession(g) ? '国会で審議される。' : '次の国会に出す。'}`;
    },
  },
  fukko_plan: {
    name: '復興の基本方針を決める', roles: ['pm'], phases: ['fukko'],
    desc: '被災地の復興の方針を決める。大きな災害では、復興のための専門の組織や特別な法律が議論されることもある。',
    // 復興庁 (2012-02) is named only where it is real history before the game's own timeline (the reiwa start)
    descFor: (g) => (realPast(g, 2012) ? '被災地の復興の方針を決める。大きな災害では、専門の組織や特別な法律も議論される（現実には2012年、東日本大震災の復興のため復興庁が置かれた）。'
      : '被災地の復興の方針を決める。大きな災害では、復興のための専門の組織や特別な法律が議論されることもある。'),
    check(g, d) { if (d.done.plan) return 'すでに決めた'; if (d.tier < 2) return '国の復興方針が要るほどの被害ではない'; return null; },
    run(g, d) {
      d.done.plan = today(g);
      d.score += 2;
      bumpApproval(g, 2, 0, 'disaster', '復興の基本方針');
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
    desc: 'ボランティアとして、泥かきや物資の仕分けを手伝う（体力40）。',
    descFor: (g) => (since(g, 2000, 1) ? '社会福祉協議会の災害ボランティアセンターを通して、泥かきや物資の仕分けを手伝う（体力40）。' : '被災地の受け入れ窓口を通して、泥かきや物資の仕分けを手伝う（体力40）。'),
    check(g, d) { if (num(d.done.volunteer) === today(g)) return '今日はもう行った'; if (num(g.state.stamina) < 40) return '体力が足りない（体力40）'; return null; },
    run(g, d) {
      const st = g.state;
      st.stamina = Math.max(0, num(st.stamina) - 40);
      d.done.volunteer = today(g);
      d.volunteerDays = num(d.volunteerDays) + 1;
      try { if (typeof g.addNeed === 'function') { g.addNeed('stress', -4); g.addNeed('clean', -25); } } catch (e) { /* ignore */ }
      // a famous volunteer is noticed on the first two days only (then it is just the work): no fame farm in a disaster
      if (num(st.fame) >= 300 && d.volunteerDays <= 2 && typeof g.addFame === 'function') g.addFame(d.volunteerDays === 1 ? 10 : 5, true);
      queueScene(g, 'volunteer', { home: !!d.home, n: d.volunteerDays }, { front: true });
      return `${since(g, 2000, 1) ? '災害ボランティアセンター' : '被災地の受け入れ窓口'}で受付をして、泥かきと物資の仕分けを手伝った。くたくただけど、ありがとうと言われた。`;
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
    // before the 1995-12 amendment a 緊急本部 needed the 布告 (never proclaimed): the NPC government sets the 非常本部
    d.honbu = d.tier >= 3 && !kinkyuNeedsFukoku(g) ? 'kinkyu' : 'hijo';
    d.done.honbu = today(g);
    news(g, `政府が${d.name}の${honbuName(g, d.honbu)}を設置した（本部長：${honbuChief(g, d.honbu)}）`);
  }
  if (!d.done.haken && !R(g).sdf.haken && d.tier >= (d.home ? 1 : 2) && !(roles.includes('chiji') && d.home) && !roles.includes('pm') && !roles.includes('defmin')) {
    if (days >= 0) { d.done.request = today(g); dispatchSDF(g, d, 'npc'); }
  }
  // the player is the one who decides, but did not: a nudge (and the cost of waiting)
  if (roles.includes('pm') && d.tier >= 2 && !d.honbu && days >= 1 && !d.flags_honbuLate) { d.flags_honbuLate = true; bumpApproval(g, -4, 0, 'disaster', '対策本部の設置の遅れ'); news(g, `${d.name}で政府の対策本部の設置が遅れていると批判が出ている`); }
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
    news(g, `${d.where}での自衛隊の災害派遣が終わった（延べ約${n0(r.sdf.haken.personnel * Math.max(1, today(g) - r.sdf.haken.start) * 1.5)}人）`);
    r.sdf.haken = null;
  }
  if (days === 1 || days === 3 || days === 7) news(g, `${d.name}：${disasterSummary(g, d)}`);
  if (prev !== d.phase) {
    emit(g, 'disaster', { phase: d.phase, d });
    if (d.phase === 'hinan' && d.tier >= 2) queueScene(g, 'disaster', { phase: 'hinan' });
    if (d.phase === 'fukko' && d.tier >= 2) queueScene(g, 'disaster', { phase: 'fukko' });
    if (d.phase === 'done') {
      const evalText = d.tier >= 2 && roleOf(g).includes('pm') ? (d.score >= 7 ? '政府の対応は、おおむね評価された' : d.score >= 4 ? '政府の対応には、評価と批判が相半ばした' : '政府の対応の遅れが批判された') : '';
      if (evalText) bumpApproval(g, d.score >= 7 ? 3 : d.score >= 4 ? 0 : -4, 0, 'disaster', '災害対応の評価');
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
// The yearly number of scrambles at the real level of the year (目安; 1984 944 → 1990s-2000s 100-300 → 700+ since 2013).
function scrambleLevel(y) { return y < 1990 ? 850 : y < 1995 ? 450 : y < 2010 ? 200 : y < 2013 ? 400 : y < 2023 ? 900 : 700; }
function sdfEvents(g) {
  const r = R(g);
  const y = yearOf(g);
  if (r.sdf.scrambleYear !== y) { r.sdf.scrambleYear = y; r.sdf.scrambles = 0; }
  // scrambles (対領空侵犯措置, 84条): news a few times a year; the yearly count follows the real level of the era
  // (目安, see the facts above). No country is named (a fictional nation must not stand in for a real one).
  if (roll(4 / YEAR_DAYS)) {
    r.sdf.scrambles += Math.round((scrambleLevel(y) / 4) * (0.75 + rnd() * 0.5));
    news(g, '航空自衛隊の戦闘機が、日本の領空に近づいた外国の軍用機に緊急発進（スクランブル）した。領空侵犯はなかった（自衛隊法84条）', { feed: false });
  }
  // a suspicious ship (海上警備行動の判断): rare
  if (!r.sdf.kaijo && roll(0.5 / YEAR_DAYS) && r.id !== 'dictatorship') {
    const nat = pick(['luzenia', 'nevalon']);
    r.sdf.kaijo = { nation: nat, day: today(g) };
    news(g, `${FICTIONAL_NATIONS[nat].short}籍とみられる不審船が領海に入った。海上保安庁が追跡している`);
    if (isPM(g) || isDefMin(g)) queueScene(g, 'kaijo', { nation: nat });
  }
  if (r.sdf.kaijo && today(g) - r.sdf.kaijo.day > 3) {
    if (!r.sdf.kaijo.done) news(g, `不審船は海上保安庁の警告を受けて領海の外へ去った`);
    r.sdf.kaijo = null;
  }
  // a UN request for a PKO (fictional mission), when the law exists
  if (!r.sdf.pkoOffer && pkoLawOk(g) && r.id === 'democracy' && roll(0.6 / YEAR_DAYS) && !r.sdf.deployments.some((d) => !d.ended && d.kind === 'pko')) {
    const where = pick(['ネヴァロン共和国の内陸部', 'ルーゼニア王国の離島']);
    r.sdf.pkoOffer = { where, mission: `国連${where.startsWith('ネヴァロン') ? 'ネヴァロン' : 'ルーゼニア'}停戦監視団`, personnel: rint(300, 600), day: today(g) };
    news(g, `国連が日本に、${r.sdf.pkoOffer.mission}への参加を要請した。停戦合意と受入れ同意はある`);
    if (isPM(g) || isDefMin(g)) queueScene(g, 'pko_offer', {});
  }
  if (r.sdf.pkoOffer && today(g) - r.sdf.pkoOffer.day > 30) { if (!isPM(g)) news(g, `政府は${r.sdf.pkoOffer.mission}への参加を見送った`); r.sdf.pkoOffer = null; }
  for (const d of r.sdf.deployments) {
    if (!d.ended && today(g) >= d.end) { d.ended = today(g); news(g, `${d.mission}に派遣されていた自衛隊の部隊が任務を終えて帰国した`); }
  }
  if (r.sdf.deployments.length > 12) r.sdf.deployments = r.sdf.deployments.slice(-12);
}

// ======================================================================== the war (real or fictional countries)
// Routes into a war (every route can be taken; each has its conditions, odds and costs — nothing is refused for
// being a war):
//   'regime'   the dictatorship with the 国軍 declares war (any country, real or fictional);
//   'art9'     a democracy whose constitution allows it (9条の改正：交戦権の容認) declares war with the Diet's approval;
//   'alliance' collective self-defence / 派兵 into an ally's war (world.js: 存立危機事態 + 国会の承認, or the 国軍);
//   'defense'  防衛出動 against an armed attack on Japan (自衛隊法76条: 閣議決定 + 国会の承認).
// The war is abstract: three or four fronts with a control value (−100..100) and troops (千人), battles resolved with
// shown odds, casualties as numbers on every side, named soldiers the player knows (acquaintances in the 自衛隊; friends
// and family conscripted under the regime), allies joining in, the player at the front — and the end of that life
// there (戦死: the save stays the last one before it). There are no options for weapons of mass destruction or for
// attacking civilians: such options do not exist.
export const WAR_ORDERS = {
  declare: { name: '宣戦布告', desc: '相手国に宣戦を布告し、戦争を始める。' },
  mobilize: { name: '動員', desc: '予備の要員や志願兵を集め、兵力を増やす。経済と暮らしへの負担が大きい。' },
  deploy: { name: '出兵（前線へ増援）', desc: '予備の部隊を前線に送る。その前線の兵力が増え、作戦に勝ちやすくなる。' },
  battle: { name: '作戦（戦闘）', desc: '前線で作戦を実行する。勝てば前線が進み、負ければ押し戻される。どちらでも死傷者が出る。' },
  offensive: { name: '攻勢', desc: '全体の方針を攻勢にする。戦況は動くが、毎日の死傷が増える。' },
  defend: { name: '防衛', desc: '全体の方針を守りに切り替える。死傷は減るが、戦況は動きにくい。' },
  negotiate: { name: '停戦交渉', desc: '第三国を通じて停戦を交渉する。戦況が悪すぎると相手は応じない。' },
  withdraw: { name: '撤兵', desc: '同盟国の戦争から日本の部隊を引き揚げる。' },
  surrender: { name: '降伏', desc: '降伏する。戦争は終わるが、重い代償を払う。' },
  front_visit: { name: '前線を視察する', desc: '総理として前線の部隊を励ます（1日）。危険はある。' },
  front_go: { name: '前線へ行く（従軍）', desc: '自分も前線に立つ。戦死する危険がある。' },
  front_return: { name: '前線から戻る', desc: '前線を離れて戻る。' },
};
export const WAR_ORDER_LIST = Object.keys(WAR_ORDERS);
export const WAR_PATHS = '憲法9条（戦争の放棄・交戦権の否認）のもとでは、日本から宣戦はできない。道は3つ：①9条を改正する（交戦権の容認：両院の総議員の3分の2で発議 → 国民投票）②緊急事態 → 独裁体制 → 自衛隊の国軍化 ③同盟国が攻撃されたとき、集団的自衛権で参戦する（存立危機事態・国会の承認：「世界情勢」から）';
const SEA_OF = { ru: 'オホーツク海・日本海', su: 'オホーツク海・日本海', kr: '日本海', kp: '日本海', cn: '東シナ海', tw: '東シナ海', ph: '南シナ海', vn: '南シナ海' };
// What the enemy is: a fictional nation (here) or a real country (world.js).
function enemyInfo(g, id) {
  const f = FICTIONAL_NATIONS[id];
  if (f) return { id, name: f.name, short: f.short, mil: f.power, real: false, nuclear: false, area: DISPUTED_AREA.name, sea: 'ヴェルミナ海', near: false, far: true, allies: [] };
  try { if (WORLD && WORLD.countryInfo) { const c = WORLD.countryInfo(g, id); if (c) return { ...c, sea: SEA_OF[id] || (c.far ? '太平洋' : '周辺') }; } } catch (e) { console.error(e); }
  return null;
}
const enemyLabel = (w) => (w && (w.enemyShort || (FICTIONAL_NATIONS[w.enemy] && FICTIONAL_NATIONS[w.enemy].short))) || '相手国';
const enemyFull = (w) => (w && (w.enemyName || (FICTIONAL_NATIONS[w.enemy] && FICTIONAL_NATIONS[w.enemy].name))) || '相手国';
const worldCall = (fn, ...a) => { try { return WORLD && typeof WORLD[fn] === 'function' ? WORLD[fn](...a) : null; } catch (e) { console.error(e); return null; } };
const isDict = (g) => R(g).id === 'dictatorship';
// The legal basis of fighting in an ally's war: null | text
function collectiveBasisR(g) {
  const r = R(g);
  if (r.steps.army && r.id === 'dictatorship') return '国軍（政令による改編）';
  if (r.steps.art9) return '改正した憲法9条（交戦権の容認）';
  if (since(g, 2016, 3) || lawInForce(g, 'security_law')) return '平和安全法制（存立危機事態）';
  return null;
}
function declareRefusal(g, opts = {}) {
  const r = R(g);
  if (r.war && r.war.phase === 'war') return 'すでに戦争中';
  const t = opts.target;
  if (t && !enemyInfo(g, t)) return '宣戦の相手が見つからない';
  if (t && !FICTIONAL_NATIONS[t] && WORLD && WORLD.exists && !WORLD.exists(g, t)) return 'その国はいまはない';
  if (r.wars.length && today(g) - num(r.wars[r.wars.length - 1].end) < 30) return '前の戦争が終わったばかり（国も軍も疲れきっている。30日ほどあける）';
  const mode = opts.mode || (r.id === 'dictatorship' ? 'regime' : 'art9');
  if (mode === 'alliance') return collectiveBasisR(g) ? null : '同盟国の戦争に加わる法的な根拠がない。道：①安全保障法制（存立危機事態）を成立させる ②9条の改正 ③緊急事態・独裁で国軍に改める';
  if (mode === 'defense') return worldCall('attackOnJapan', g) ? null : '日本への武力攻撃は起きていない';
  if (r.id === 'dictatorship') return r.steps.army ? null : 'まず自衛隊を国軍に改める（「体制」の手続き：自衛隊の国軍化）。自衛隊のままでは、他国を攻める組織も法もない';
  if (r.id === 'emergency') return r.steps.art9 ? null : '緊急事態のもとでも、宣戦には9条の改正か国軍への改編が要る（選挙と国会を止めて独裁体制にし、自衛隊を国軍に改める）';
  if (r.steps.art9) return null;
  return WAR_PATHS;
}
function warRefusal(g, kind, opts = {}) {
  const r = R(g);
  if (!WAR_ORDERS[kind]) return 'そんな命令はない';
  if (!pol(g) && kind !== 'front_go' && kind !== 'front_return') return '政治の仕組み（政治コア）が読み込まれていない';
  if (r.id === 'fallen') return '体制はもう崩れている';
  if (r.lifeOver) return 'この人生は、もう終わっている';
  const w = r.war;
  const active = !!(w && w.phase === 'war');
  if (kind === 'front_go' || kind === 'front_return' || kind === 'front_visit') return frontRefusal(g, kind, w, active);
  if (!isPM(g)) return r.id === 'dictatorship' ? '独裁者（総理）でなければ命じられない' : '戦争の命令は内閣総理大臣が出す（自衛隊の最高指揮官）';
  if (kind === 'declare') return declareRefusal(g, opts);
  if (!active) return 'いまは戦争をしていない';
  if (kind === 'mobilize') {
    if (w.mob >= 3) return 'これ以上は動員できない（すでに総動員）';
    if (w.mob >= 2 && !isDict(g)) return '徴兵は、憲法18条（意に反する苦役の禁止）に反するというのが政府の解釈。これ以上兵力を増やすなら、緊急事態・独裁の体制で';
    return null;
  }
  if (kind === 'deploy') {
    if (num(w.reserve) < 2) return '送れる予備の部隊がない（まず動員する）';
    const f = pickFront(w, opts.front);
    return f ? null : '前線がない';
  }
  if (kind === 'battle') {
    const f = pickFront(w, opts.front);
    if (!f) return '前線がない';
    if (num(f.own) < 2) return `${f.name}には日本の部隊がいない（まず出兵する）`;
    if (num(f.last) === today(g)) return `${f.name}では今日はもう作戦を行った（明日また）`;
    return null;
  }
  if (kind === 'negotiate' && w.talks) return 'すでに交渉している';
  if (kind === 'negotiate' && today(g) - num(w.lastTalks, -99) < 6) return '交渉は決裂したばかり。少し時間をおく';
  if (kind === 'withdraw' && w.mode !== 'alliance') return '日本が当事者の戦争（手を引くなら停戦交渉か降伏）';
  if (kind === 'offensive' && w.stance === 'offense') return 'すでに攻勢をとっている';
  if (kind === 'defend' && w.stance === 'defend') return 'すでに守りを固めている';
  return null;
}
function frontRefusal(g, kind, w, active) {
  const st = g.state;
  const P = w && w.player;
  if (kind === 'front_return') {
    if (!P) return 'いまは前線にいない';
    if (!isPM(g) && active && today(g) < num(P.until)) return null; // leaving early = 脱走 (odds shown)
    return null;
  }
  if (!active) return 'いまは戦争をしていない';
  if (P) return `すでに前線にいる（${(w.fronts.find((f) => f.id === P.front) || {}).name || '前線'}）`;
  if (kind === 'front_visit') return isPM(g) ? (num(w.visited) === today(g) ? '今日はもう視察した' : null) : '前線の視察は総理が行う（自分も前線に立つなら「前線へ行く」）';
  try { if (typeof g.isFree === 'function' && !g.isFree()) return 'いまは身動きがとれない'; } catch (e) { /* ignore */ }
  let age = 30;
  try { age = ageOf(st); } catch (e) { age = 30; }
  if (isPM(g)) return null;
  if (age < 18) return '18歳になるまでは前線に行けない';
  if (age > 55) return '年齢的に、前線の部隊には加われない（後方の仕事をする）';
  if (!isDict(g) && w.mob < 2) return '志願兵はまだ募集されていない（総理が「動員」で志願兵を募集すると、加われる）';
  return null;
}
// the troops Japan can deploy (千人)
function baseTroops(g) { return Math.round((sdfPersonnel(g).actual * 0.4) / 1000); }
function pickFront(w, id) {
  if (!w || !Array.isArray(w.fronts) || !w.fronts.length) return null;
  if (id) return w.fronts.find((f) => f.id === id) || null;
  const withOwn = w.fronts.filter((f) => num(f.own) >= 2);
  const pool = withOwn.length ? withOwn : w.fronts;
  return pool.slice().sort((a, b) => a.control - b.control)[0];
}
function newWar(g, target, opts = {}) {
  const E = enemyInfo(g, target) || enemyInfo(g, 'nevalon');
  const mode = opts.mode || (R(g).id === 'dictatorship' ? 'regime' : 'art9');
  const ally = opts.ally ? enemyInfo(g, opts.ally) : null;
  const atk = mode === 'defense' ? worldCall('attackOnJapan', g) : null;
  const fronts = [
    { id: 'land', name: mode === 'alliance' && ally ? `${ally.short}の前線` : E.area, kind: 'land', control: 0, own: 0 },
    { id: 'sea', name: `${E.sea}の海上`, kind: 'sea', control: 0, own: 0 },
    { id: 'air', name: '航空・ミサイル防衛', kind: 'air', control: 0, own: 0 },
  ];
  if (mode === 'defense') fronts.unshift({ id: 'home', name: (atk && atk.where) || '本土・離島の防衛', kind: 'home', control: -20, own: 0 });
  const total = baseTroops(g);
  const share = Math.round((total * 0.55) / fronts.length);
  for (const f of fronts) f.own = share;
  return {
    enemy: E.id, real: !!E.real, enemyName: E.name, enemyShort: E.short, enemyMil: num(E.mil, 50), nuclear: !!E.nuclear, nearEnemy: !!E.near, far: !!E.far,
    area: fronts.find((f) => f.id === 'land').name, mode, ally: ally ? ally.id : null, allyName: ally ? ally.short : null, conflict: opts.conflict || null, aggressor: mode === 'regime' || mode === 'art9',
    start: today(g), phase: 'war', front: mode === 'defense' ? -5 : 0, stance: 'defend', mob: 0, talks: null, lastTalks: -99, fronts, reserve: total - share * fronts.length,
    allies: [], foes: [], known: [], player: null, battles: [], foeMob: 0, visited: 0, offer: null,
    cas: { soldiers: { dead: 0, wounded: 0 }, civilians: { dead: 0, wounded: 0 }, enemySoldiers: 0, enemyCivilians: 0, allies: 0 },
    cost: 0, weariness: 0, support: 0, letters: 0, log: [{ day: today(g), text: mode === 'defense' ? `${E.short}の攻撃に防衛出動` : mode === 'alliance' ? `${ally ? ally.short : '同盟国'}を守るため${E.short}と交戦` : `${E.name}に宣戦` }], end: null, result: null,
  };
}
// The power at one front (own incl. allies, foe incl. its allies) and the odds of a battle there.
function frontPower(g, w, f) {
  const r = R(g);
  const jp = worldCall('milPower', g, 'jp') || 45;
  const supply = clamp(1 - r.sanctions * 0.07 - w.weariness / 300 - num(r.sdf.quit) / 200000, 0.4, 1.15);
  const n = Math.max(1, w.fronts.length);
  let own = jp * Math.sqrt(Math.max(0.5, num(f.own)) / 25) * supply * (w.stance === 'offense' ? 1.05 : 1);
  if (w.player && w.player.front === f.id && w.player.role === 'pm') own *= 1.08;
  own += (w.allies || []).reduce((a, x) => a + num(x.power), 0) / n * 0.8;
  let foe = num(w.enemyMil, 50) * (1 + num(w.support) / 120) * (1 + num(w.foeMob) * 0.15) * (w.far && f.kind !== 'land' ? 0.75 : 1) * (w.far && f.kind === 'land' && w.mode !== 'alliance' ? 0.7 : 1);
  if (f.kind === 'home') foe *= 0.7;
  foe += (w.foes || []).reduce((a, x) => a + num(x.power), 0) / n * 0.8;
  return { own: Math.round(own), foe: Math.round(foe) };
}
export function battleOdds(g, w, f) {
  const P = frontPower(g, w, f);
  const x = (P.own - P.foe) / 20 + num(f.control) / 250 + (w.stance === 'offense' ? 0.1 : 0);
  return clamp(1 / (1 + Math.exp(-x)), 0.05, 0.95);
}
const avgFront = (w) => Math.round((w.fronts || []).reduce((a, f) => a + num(f.control), 0) / Math.max(1, (w.fronts || []).length));
// ---- the people the player knows who fight
const ACQ_FAM = ['佐々木', '中村', '小川', '石井', '木下', '松本', '岡田', '藤井', '西村', '原田'];
const ACQ_GIVEN = { m: ['翔', '大輔', '健太', '拓也', '亮'], f: ['美咲', '彩', '真由', '遥', '千尋'] };
const ACQ_REL = ['高校の同級生', '地元の幼なじみ', '中学の先輩', '近所の幼なじみ'];
function addAcquaintances(g, w) {
  const army = R(g).steps.army && isDict(g);
  const units = [['陸上自衛隊', 'land'], ['海上自衛隊', 'sea'], ['航空自衛隊', 'air']];
  const base = rint(0, 2);
  for (let i = 0, tries = 0; w.known.filter((k) => k.kind === 'acq').length < 2 && tries < 12; tries++) {
    const sex = (roll(0.7) ? i === 0 : i !== 0) ? 'm' : 'f';
    const name = `${ACQ_FAM[(rint(0, ACQ_FAM.length - 1) + i * 3 + tries) % ACQ_FAM.length]} ${ACQ_GIVEN[sex][(rint(0, 4) + i * 2 + tries) % 5]}`;
    if (w.known.some((k) => k.name === name)) continue;
    const [unit, front] = units[(base + i) % 3];
    const rel = ACQ_REL[(base + i) % ACQ_REL.length];
    w.known.push({ key: 'a' + i, name, rel, kind: 'acq', sex, unit: army ? unit.replace('自衛隊', '軍').replace('上', '') : unit, front, status: 'front', since: today(g) });
    i++;
  }
  const k = w.known[0];
  if (k) try { g.message({ from: k.name, kind: 'chat', war: true, text: `${g.state.name}、ニュース見た？\nうちの部隊も出ることになった。\n心配しないで。帰ったら、またごはん行こうな。`.replace('行こうな', k.sex === 'f' ? '行こうね' : '行こうな') }); } catch (e) { /* ignore */ }
}
// conscription under the regime: friends and siblings get the call-up (the dictator may exempt them, at a cost)
function conscriptKnown(g, w, level) {
  const st = g.state;
  const out = [];
  try {
    // performers of the player's generation (not the landlord, the shopkeepers or the office staff)
    const ids = Object.keys(st.people || {}).filter((id) => PEOPLE[id] && ['comedian', 'idol', 'actor', 'singer'].includes(PEOPLE[id].kind) && typeof g.heartLevel === 'function' && g.heartLevel(id) >= 1 && !(st.people[id] && st.people[id].kia));
    for (const id of ids.slice(0, level >= 3 ? 4 : 2)) {
      if (w.known.some((k) => k.key === 'p:' + id)) continue;
      out.push({ key: 'p:' + id, person: id, name: PEOPLE[id].name, rel: g.heartLevel(id) >= 3 ? '親友' : '友だち', kind: 'friend', unit: '国軍', front: pick(['land', 'sea', 'air']), status: 'called', since: today(g) });
    }
  } catch (e) { console.error(e); }
  try {
    const fam = (st.profile.family || []).filter((m) => m && m.alive !== false && /^(brother|sister)/.test(m.rel) && (level >= 3 || /^brother/.test(m.rel)));
    for (const m of fam) {
      if (w.known.some((k) => k.key === 'f:' + m.id)) continue;
      out.push({ key: 'f:' + m.id, family: m.id, name: m.name, rel: RELATIONS[m.rel] ? RELATIONS[m.rel].name : '家族', kind: 'family', unit: '国軍', front: pick(['land', 'sea', 'air']), status: 'called', since: today(g) });
    }
  } catch (e) { console.error(e); }
  if (!out.length) return;
  w.known.push(...out);
  queueScene(g, 'conscript', { keys: out.map((k) => k.key) }, { front: true });
}
function knownKIA(g, w, k, fname) {
  if (k.status === 'kia') return;
  k.status = 'kia';
  k.day = today(g);
  k.where = fname;
  w.log.push({ day: today(g), text: `${k.rel}の${k.name}が戦死（${fname}）` });
  const st = g.state;
  if (k.person && st.people && st.people[k.person]) st.people[k.person].kia = { day: today(g), front: fname };
  if (k.family) {
    const m = (st.profile.family || []).find((x) => x.id === k.family);
    if (m) { m.alive = false; m.cause = 'war'; }
  }
  R(g).record.knownKia = num(R(g).record.knownKia) + 1;
  queueScene(g, 'kia_npc', { key: k.key }, { front: true });
  if (k.kind === 'family') familyMessage(g, `${k.name}が……戦死したって、知らせが来たの。\n${k.where}で。\nどうして、こんなことに……。`);
  else if (k.kind === 'friend') { try { g.message({ from: `${k.name}の家族`, kind: 'chat', war: true, text: `${k.name}が、${k.where}で戦死しました。\n生前は仲良くしていただいて、本当にありがとうございました。` }); } catch (e) { /* ignore */ } }
  else { try { g.message({ from: 'ドット新聞 社会部', kind: 'news', text: `【戦死者】${k.unit}の${k.name}さん（${g.state.name}さんの${k.rel}）が、${k.where}で戦死した。` }); } catch (e) { /* ignore */ } }
}
// the people the player knows at a front: death and wounds (a battle: lost → higher)
function knownAtFront(g, w, f, kDeath) {
  for (const k of w.known) {
    if (k.status !== 'front' || k.front !== f.id) continue;
    const x = rnd();
    if (x < kDeath) knownKIA(g, w, k, f.name);
    else if (x < kDeath * 2.5 && !k.wounded) { k.wounded = today(g); k.status = 'wounded'; w.log.push({ day: today(g), text: `${k.rel}の${k.name}が負傷（${f.name}）` }); try { g.message({ from: k.name, kind: 'chat', war: true, text: '負傷して後ろの病院にいる。命に別条はないって。\n……前線のことは、あまり思い出したくない。' }); } catch (e) { /* ignore */ } }
  }
}
// ---- the player at the front
function playerRisk(w, P, mul = 1) {
  const f = (w.fronts || []).find((x) => x.id === P.front) || {};
  const heat = 1 + Math.max(0, 40 - Math.abs(num(f.control))) / 80 + (w.stance === 'offense' ? 0.2 : 0);
  const base = P.role === 'pm' ? 0.009 : 0.022;
  return clamp(base * heat * mul, 0.003, 0.25);
}
function playerKIA(g, where) {
  const r = R(g);
  if (r.lifeOver) return;
  const w = r.war;
  r.lifeOver = { day: today(g), cause: 'kia', where: where || '前線', enemy: w ? enemyLabel(w) : '', date: dateText(g), role: w && w.player ? w.player.role : '' };
  if (w) { w.log.push({ day: today(g), text: `${g.state.name}が戦死（${where}）` }); w.player = null; }
  r.queue = [{ id: 'kia', day: today(g), data: { where } }];
  news(g, `${g.state.name}${isPM(g) ? '総理' : 'さん'}が${where}で戦死した`);
  emit(g, 'kia', { where });
}
// ---- orders
function warOrder(g, kind, opts = {}) {
  const r = R(g);
  const why = warRefusal(g, kind, opts);
  if (why) return { ok: false, why };
  if (kind === 'declare') return declareWar(g, opts);
  if (kind === 'front_go' || kind === 'front_visit' || kind === 'front_return') return frontOrder(g, kind, opts);
  const w = r.war;
  const name = enemyFull(w);
  // a war decision by a member of a real party: the break with the party first (the path goes through)
  const pre = ['mobilize', 'offensive', 'battle', 'deploy'].includes(kind) ? realPathBefore(g, WAR_ORDERS[kind].name) : null;
  const preText = pre ? `${pre}\n` : '';
  if (kind === 'mobilize') {
    w.mob++;
    const dict = isDict(g);
    const add = dict ? [0, 30, 150, 300][w.mob] : [0, 30, 60][w.mob];
    w.reserve = num(w.reserve) + add;
    w.weariness = clamp(w.weariness + (dict && w.mob >= 2 ? 12 : 6), 0, 100);
    r.unrest = clamp(r.unrest + (dict ? 6 : 2), 0, 100);
    ecoShock(g, `動員（第${w.mob}次）`, { growth: -0.5 - w.mob * 0.3, inflation: 0.6, unemployment: -0.3, len: 200 });
    const what = dict ? ['', '予備役の召集', '徴兵（若者の召集）', '総動員'][w.mob] : ['', '予備自衛官の招集', '志願兵の募集'][w.mob];
    news(g, `政府が${what}を命じた（第${w.mob}次の動員・約${n0(add * 1000)}人）`);
    w.log.push({ day: today(g), text: what });
    if (dict && w.mob >= 2) { w.conscription = true; conscriptKnown(g, w, w.mob); }
    if (dict && w.mob >= 3) playerCallUp(g, w);
    if (!dict && w.mob >= 2 && roll(0.35)) {
      const ids = Object.keys(g.state.people || {}).filter((id) => PEOPLE[id] && ['comedian', 'idol', 'actor', 'singer'].includes(PEOPLE[id].kind) && g.heartLevel(id) >= 2 && !w.known.some((k) => k.person === id));
      if (ids.length) { const id = pick(ids); w.known.push({ key: 'p:' + id, person: id, name: PEOPLE[id].name, rel: '友だち', kind: 'friend', unit: '志願兵', front: pick(['land', 'sea', 'air']), status: 'front', since: today(g) }); try { g.message({ from: PEOPLE[id].name, person: id, kind: 'chat', war: true, text: '志願したよ。じっとしていられなくて。\nしばらく連絡できないかもしれない。元気でね。' }); } catch (e) { /* ignore */ } }
    }
    familyMessage(g, dict && w.mob >= 2 ? '町から若い人がいなくなっていく。\nみんな、口には出さないけど怒ってるよ。' : 'となりの家の息子さんも、部隊に呼ばれたって…。\n{name}、体に気をつけて。');
    return { ok: true, text: `${preText}${what}を命じた（約${n0(add * 1000)}人）。兵力は増えるが、暮らしへの負担と不満も大きい。` };
  }
  if (kind === 'deploy') {
    const f = pickFront(w, opts.front);
    const n = Math.min(num(w.reserve), clamp(num(opts.n, 20), 2, 200));
    w.reserve = num(w.reserve) - n;
    f.own = num(f.own) + n;
    w.cost = Math.round((w.cost + n * 0.004) * 100) / 100;
    w.log.push({ day: today(g), text: `${f.name}へ増援（約${n0(n * 1000)}人）` });
    news(g, `部隊（約${n0(n * 1000)}人）が${f.name}へ向かった`);
    return { ok: true, text: `${preText}${f.name}へ部隊（約${n0(n * 1000)}人）を送った。この前線の作戦の見込み：${Math.round(battleOdds(g, w, f) * 100)}%` };
  }
  if (kind === 'battle') {
    const f = pickFront(w, opts.front);
    const res = runBattle(g, w, f);
    return { ok: true, ...res, text: `${preText}${res.text}` };
  }
  if (kind === 'offensive' || kind === 'defend') {
    w.stance = kind === 'offensive' ? 'offense' : 'defend';
    w.log.push({ day: today(g), text: kind === 'offensive' ? '攻勢に転じる' : '防衛に徹する' });
    news(g, kind === 'offensive' ? `${forceName(g)}が${w.area}の軍事目標に向けて攻勢に出た` : `${forceName(g)}は守りを固める方針に切り替えた`);
    return { ok: true, text: `${preText}${kind === 'offensive' ? '攻勢を命じた。戦況は動くが、死傷者は増える。' : '防衛を命じた。死傷は減るが、戦況は動きにくい。'}` };
  }
  if (kind === 'negotiate') {
    w.talks = { day: today(g), until: today(g) + rint(4, 8) };
    news(g, `政府は第三国を通じて${name}との停戦交渉に入った`);
    return { ok: true, text: `第三国を通じて停戦交渉を始めた。数日で答えが出る。（見込み 約${Math.round(talksOdds(g, w) * 100)}%）` };
  }
  if (kind === 'withdraw') { endWar(g, 'withdraw'); return { ok: true, text: '日本の部隊を引き揚げた。同盟国は失望している。' }; }
  if (kind === 'surrender') { endWar(g, 'surrender'); return { ok: true, text: '降伏した。' }; }
  return { ok: false, why: 'そんな命令はない' };
}
const forceName = (g) => (R(g).steps.army && isDict(g) ? '国軍' : '自衛隊');
function talksOdds(g, w) { return clamp(0.35 + avgFront(w) / 150 + (w.weariness > 50 ? 0.1 : 0) + (w.nuclear ? 0.05 : 0) + (w.mode === 'defense' ? 0.05 : 0), 0.05, 0.85); }
function declareWar(g, opts) {
  const r = R(g);
  const E = enemyInfo(g, opts.target) || enemyInfo(g, 'nevalon');
  const mode = opts.mode || (r.id === 'dictatorship' ? 'regime' : 'art9');
  const what = mode === 'defense' ? '防衛出動' : mode === 'alliance' ? '同盟国の戦争への参戦' : '宣戦布告';
  // the real-party rule: the break with the party first (a real party never decides a war)
  const pre = realPathBefore(g, what);
  const preText = pre ? `${pre}\n` : '';
  // a democracy declares war with the Diet's approval (art9; the alliance / defence routes were approved by world.js or the 防衛出動 order)
  if (mode === 'art9' && r.id !== 'dictatorship') {
    const p = dietWarOdds(g);
    if (!roll(p)) {
      bumpApproval(g, -4, -1, 'regime', '宣戦の承認案の否決');
      news(g, `${E.name}への宣戦の承認案は、国会で否決された`);
      return { ok: true, success: false, text: `${preText}国会は宣戦を承認しなかった。（見込み ${Math.round(p * 100)}%）` };
    }
  }
  const w = r.war = newWar(g, E.id, { mode, ally: opts.ally, conflict: opts.conflict });
  r.record.wars++;
  // allies and the enemy's allies decide (world.js); without world.js nobody joins
  const dec = worldCall('allyDecisions', g, E.id, mode, { ally: opts.ally }) || { ours: [], theirs: [], why: {} };
  for (const id of dec.ours) { const I = enemyInfo(g, id); if (I) w.allies.push({ id, name: I.short, power: Math.round(num(I.mil) * 0.8), joined: today(g) }); }
  for (const id of dec.theirs) { const I = enemyInfo(g, id); if (I) w.foes.push({ id, name: I.short, power: Math.round(num(I.mil) * 0.8), joined: today(g) }); }
  w.decisions = dec.why || {};
  const aggr = w.aggressor;
  raiseIntl(g, aggr ? (E.real ? 30 : 25) : mode === 'defense' ? 0 : 6, `${E.name}との戦争`);
  r.unrest = clamp(r.unrest + (aggr ? 8 : 3), 0, 100);
  bumpApproval(g, mode === 'defense' ? 5 : aggr ? -6 : -3, aggr ? -4 : -1, 'regime', what);
  ecoShock(g, '戦争', { growth: E.real ? -3 : -2.5, inflation: 2.5, yen: 15, len: 360, nikkei: E.real ? -18 : -12 });
  worldCall('onJapanWar', g, 'start', w);
  addAcquaintances(g, w);
  const allyLine = w.allies.length ? `${w.allies.map((a) => a.name).join('・')}が日本の側で参戦した` : aggr ? '同盟国は加わらなかった' : '';
  const foeLine = w.foes.length ? `${w.foes.map((a) => a.name).join('・')}が${E.short}の側で参戦した` : '';
  news(g, mode === 'defense' ? `政府は${E.short}の攻撃に対し、自衛隊に防衛出動を命じた（自衛隊法76条・国会承認）` : mode === 'alliance' ? `政府は${w.allyName || '同盟国'}を守るため、${E.name}との戦闘に加わった` : `政府は${E.name}に宣戦を布告した`);
  if (allyLine) news(g, allyLine);
  if (foeLine) news(g, foeLine);
  if (mode !== 'defense') spawnDemo(g, { cause: '戦争', label: '戦争に反対するデモ', size: aggr ? 'large' : 'medium', segment: 'young', against: 'war' });
  phone(g, `【速報】\n${mode === 'defense' ? `${E.short}の攻撃に、政府が防衛出動を命じた。` : mode === 'alliance' ? `日本が${E.name}との戦闘に加わった。` : `政府が${E.name}に宣戦を布告した。`}\n${aggr ? '国連と各国が即時停戦を求めている。' : ''}${allyLine ? `\n${allyLine}。` : ''}`, 'ドット新聞 国際部');
  familyMessage(g, mode === 'defense' ? '{name}、ニュース見た？\nこっちは大丈夫。気をつけてね。' : '{name}、戦争なんて本当なの？\n近所の人も、みんな不安がってる。\nお願いだから、引き返して…。');
  queueScene(g, 'war', { event: 'declare' });
  emit(g, 'war', { kind: 'declare', war: w });
  return { ok: true, success: true, text: `${preText}${mode === 'defense' ? '防衛出動を命じた。' : mode === 'alliance' ? `${E.name}との戦闘に加わった。` : `${E.name}に宣戦した。`}${allyLine ? `\n${allyLine}。` : ''}${foeLine ? `\n${foeLine}。` : ''}` };
}
// The Diet's approval of a declaration in the democracy (the ruling side's share and the mood)
function dietWarOdds(g) {
  const p = pol(g);
  const H = p && p.diet && p.diet.shugi;
  if (!H || !H.seats) return 0.5;
  const total = num(H.total) || 1;
  const ids = (p.cabinet && p.cabinet.partyIds) || [];
  const ruling = ids.reduce((a, id) => a + (isRealParty(p, id) ? 0 : num(H.seats[id])), 0) / total;
  return clamp(0.15 + (ruling - 0.5) * 3 + (approvalOf(g) - 40) / 150, 0.03, 0.92);
}
// The call-up of the player under the regime's 総動員 (not the dictator himself)
function playerCallUp(g, w) {
  if (isPM(g) || w.player) return;
  let age = 30;
  try { age = ageOf(g.state); } catch (e) { age = 30; }
  if (age < 18 || age > 45) return;
  queueScene(g, 'callup', {}, { front: true });
}
function frontOrder(g, kind, opts = {}) {
  const r = R(g);
  const w = r.war;
  if (kind === 'front_visit') {
    w.visited = today(g);
    const f = pickFront(w, opts.front) || w.fronts[0];
    useStamina(g, 25);
    if (roll(0.008)) { playerKIA(g, f.name); return { ok: true, text: `${f.name}を視察中、砲撃が近くに落ちた――。` }; }
    w.weariness = Math.max(0, w.weariness - 4);
    bumpApproval(g, roll(0.6) ? 1 : -1, 0, 'regime', '前線の視察');
    news(g, `${g.state.name}総理が${f.name}の部隊を視察した`);
    return { ok: true, text: `${f.name}を視察し、部隊を励ました。兵士たちの顔は疲れきっていた。` };
  }
  if (kind === 'front_go') {
    const f = pickFront(w, opts.front) || w.fronts[0];
    const pm = isPM(g);
    w.player = { front: f.id, since: today(g), until: today(g) + (pm ? 999 : 12), role: pm ? 'pm' : opts.conscript ? 'conscript' : 'volunteer' };
    useStamina(g, 20);
    news(g, pm ? `${g.state.name}総理が${f.name}に入り、自ら指揮をとっている` : `${g.state.name}さんが${opts.conscript ? '召集されて' : '志願して'}${f.name}の部隊に加わった`);
    familyMessage(g, pm ? '{name}、前線に行ったって本当？\nお願いだから、無事に帰ってきて。' : '{name}、前線に行くなんて……。\n毎日、無事を祈ってる。必ず帰ってきてね。');
    return { ok: true, text: pm ? `${f.name}の司令部に入った。ここで指揮をとる。（1日あたりの危険 約${(playerRisk(w, w.player) * 100).toFixed(1)}%）` : `${f.name}の部隊に加わった。12日間の任務。（1日あたりの危険 約${(playerRisk(w, w.player) * 100).toFixed(1)}%）` };
  }
  if (kind === 'front_return') {
    const P = w && w.player;
    const early = P && !isPM(g) && today(g) < num(P.until) && w.phase === 'war';
    if (early) {
      if (!roll(0.5)) { const me = meOf(g); if (me) me.reputation = clamp(num(me.reputation) - 3, -100, 100); return { ok: true, success: false, text: '部隊を離れようとしたが、見つかって連れ戻された。（成功の見込みは50%だった）' }; }
      if (typeof g.addFame === 'function') g.addFame(-Math.round(num(g.state.fame) * 0.05), true);
      news(g, `${g.state.name}さんが前線の部隊から姿を消したと報じられた`);
    }
    if (w) w.player = null;
    return { ok: true, text: early ? '前線を離れ、ひそかに戻った。「脱走だ」と批判する声もある。' : '前線から戻った。' };
  }
  return { ok: false, why: 'そんな命令はない' };
}
// One battle at a front: odds, casualties on every side, the people the player knows there, the player there.
function runBattle(g, w, f) {
  const r = R(g);
  const p = battleOdds(g, w, f);
  const win = roll(p);
  f.last = today(g);
  const scale = clamp(num(f.own), 3, 300);
  const sd = Math.round(scale * (win ? rint(3, 7) : rint(7, 14)) * (w.foes.length ? 1.15 : 1));
  const sw = sd * rint(2, 4);
  const ed = Math.round(scale * (win ? rint(8, 15) : rint(3, 7)) * (w.allies.length ? 1.2 : 1));
  const cd = f.kind === 'home' ? rint(15, 140) : f.kind === 'land' ? rint(0, 40) : rint(0, 6);
  const ecd = f.kind === 'land' ? rint(4, 60) : rint(0, 8);
  const move = win ? rint(12, 26) : -rint(10, 24);
  f.control = clamp(num(f.control) + move, -100, 100);
  f.own = Math.max(0, num(f.own) - sd / 1000 * 3);
  w.cas.soldiers.dead += sd; w.cas.soldiers.wounded += sw;
  w.cas.civilians.dead += cd; w.cas.civilians.wounded += cd * rint(2, 4);
  w.cas.enemySoldiers += ed; w.cas.enemyCivilians += ecd;
  if (w.allies.length) w.cas.allies = num(w.cas.allies) + Math.round(sd * 0.5);
  w.cost = Math.round((w.cost + 0.06 + scale * 0.001) * 100) / 100;
  w.weariness = clamp(w.weariness + (win ? 1 : 3) + sd / 300, 0, 100);
  w.front = avgFront(w);
  const rec = { day: today(g), front: f.id, name: f.name, odds: Math.round(p * 100), win, sd, ed, cd, move };
  w.battles.push(rec);
  if (w.battles.length > 14) w.battles.shift();
  w.log.push({ day: today(g), text: `${f.name}で${win ? '勝利' : '敗退'}（死者 自国${n0(sd)}人・相手${n0(ed)}人）` });
  news(g, `${f.name}で戦闘。${win ? `${forceName(g)}が前進した` : `${forceName(g)}は押し戻された`}（死者 自国の兵士${n0(sd)}人・相手側${n0(ed)}人${cd ? `・民間人${n0(cd)}人` : ''}）`);
  knownAtFront(g, w, f, win ? 0.04 : 0.1);
  let extra = '';
  const P = w.player;
  if (P && P.front === f.id) {
    const risk = playerRisk(w, P, win ? 2 : 3.5);
    if (roll(risk)) { playerKIA(g, f.name); extra = '\n――そのとき、すぐ近くで爆発が起きた。'; }
  }
  checkWarEnd(g, w);
  queueScene(g, 'battle', { idx: w.battles.length - 1, start: w.start }, { front: true });
  return { success: win, odds: rec.odds, text: `${f.name}での作戦は${win ? '成功した' : '失敗した'}（見込み ${rec.odds}%）。\n死者 自国の兵士${n0(sd)}人・相手側${n0(ed)}人${cd ? `・民間人${n0(cd)}人` : ''}。${extra}` };
}
// victory / defeat by the fronts
function checkWarEnd(g, w) {
  if (!w || w.phase !== 'war' || R(g).war !== w) return;
  const land = w.fronts.find((f) => f.id === 'land');
  const home = w.fronts.find((f) => f.id === 'home');
  const avg = avgFront(w);
  w.front = avg;
  if (avg <= -85 || (home && home.control <= -100)) { endWar(g, 'defeat'); return; }
  if (land && land.control >= 100 && avg >= 45) endWar(g, 'victory');
}
function warTick(g) {
  const r = R(g);
  const w = r.war;
  if (!w || w.phase !== 'war') return;
  if (!Array.isArray(w.fronts) || !w.fronts.length) { const nw = newWar(g, w.enemy, { mode: w.mode || 'regime' }); Object.assign(w, { fronts: nw.fronts, reserve: nw.reserve, allies: w.allies || [], foes: w.foes || [], known: w.known || [], battles: w.battles || [], enemyMil: nw.enemyMil, enemyShort: nw.enemyShort, enemyName: nw.enemyName, area: w.area || nw.area }); }
  const days = today(g) - w.start;
  const name = enemyFull(w);
  // the enemy gets help from other countries as time goes on; sanctions starve our supply; the enemy mobilises too
  w.support = clamp(w.support + 0.6 + r.intl * 0.01, 0, 60);
  if (days > 0 && days % 12 === 0) w.foeMob = Math.min(3, num(w.foeMob) + 1);
  const before = avgFront(w);
  let sd = 0, cd = 0;
  for (const f of w.fronts) {
    const P = frontPower(g, w, f);
    const push = (P.own - P.foe) * 0.035 + (w.stance === 'offense' ? 1 : -0.3) + gauss() * 2;
    f.control = clamp(num(f.control) + push, -100, 100);
    const intensity = (w.stance === 'offense' ? 1.5 : 0.9) * (1 + w.mob * 0.15) * clamp(num(f.own) / 25, 0.2, 3);
    const d0 = Math.round(rint(4, 18) * intensity);
    sd += d0;
    cd += f.kind === 'home' ? rint(2, 20) : f.kind === 'land' ? rint(0, 6) : 0;
    w.cas.enemySoldiers += Math.round(d0 * (0.7 + rnd() * 0.6));
    knownAtFront(g, w, f, 0.004);
  }
  w.cas.soldiers.dead += sd; w.cas.soldiers.wounded += sd * rint(2, 4);
  w.cas.civilians.dead += cd; w.cas.civilians.wounded += cd * rint(2, 5);
  w.cas.enemyCivilians += Math.round(cd * (0.8 + rnd() * 0.8));
  if (w.allies.length) w.cas.allies = num(w.cas.allies) + Math.round(sd * 0.4);
  w.cost = Math.round((w.cost + 0.08 + w.mob * 0.03 + w.fronts.reduce((a, f) => a + num(f.own), 0) * 0.0004) * 100) / 100;
  w.weariness = clamp(w.weariness + 0.5 + sd / 150 + cd / 40 + Math.max(0, -avgFront(w)) / 200, 0, 100);
  r.unrest = clamp(r.unrest + (isDict(g) ? 0.12 : 0.05) + w.weariness / 300, 0, 100);
  r.intl = clamp(r.intl + (w.aggressor ? 0.2 : 0.02), 0, 100);
  if (!isDict(g) && w.weariness > 30) bumpApproval(g, -0.08, 0, 'regime', '長引く戦争');
  w.front = avgFront(w);
  // the people the player knows: the called-up go to the front the next day
  for (const k of w.known) {
    if (k.status === 'called' && today(g) - num(k.since) >= 1) k.status = 'front';
    if (k.status === 'wounded' && today(g) - num(k.wounded) >= 8) { k.status = 'front'; k.wounded = 0; }
  }
  // a letter from a family (fictional, sober) every few days
  if (days > 0 && days % 4 === 0) {
    w.letters++;
    const L = pick([
      ['ある母親', '息子は前線にいます。手紙が届かなくなって十日になります。どうか、無事に帰してください。'],
      ['ある妻', '夫が部隊に呼ばれて一か月。子どもは毎晩「お父さんはいつ帰るの」と聞きます。'],
      ['ある父親', '娘は衛生の部隊にいます。けが人の手当てに追われていると、短い便りがありました。'],
      ['ある祖母', '孫の名前が、戦死者の名簿にありました。あの子はまだ二十歳でした。'],
      ['ある高校生', '兄が帰ってきません。ニュースは勝っていると言うけれど、町は静かで、だれも笑っていません。'],
      ['相手国の留学生', '故郷の家族と連絡がとれません。この町の人はやさしいけれど、ニュースを見るのがつらいです。'],
    ]);
    phone(g, `【読者からの手紙】${L[0]}より\n${L[1]}`, 'ドット新聞 読者の声');
  }
  if (days > 0 && days % 5 === 0) news(g, `戦況：${frontText(w.front)}。死者（自国）兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人`);
  // talks
  let talksFailed = false;
  if (w.talks && today(g) >= w.talks.until) {
    const ok = roll(talksOdds(g, w));
    w.talks = null;
    w.lastTalks = today(g);
    if (ok) { endWar(g, 'ceasefire'); return; }
    talksFailed = true;
    news(g, `${name}との停戦交渉は決裂した`);
  }
  // the democracy without the player as PM: the new cabinet seeks a ceasefire
  if (!isPM(g) && !isDict(g) && !w.talks && today(g) - num(w.lastTalks, -99) >= 6) { w.talks = { day: today(g), until: today(g) + rint(4, 7) }; news(g, `新しい内閣は、${name}との停戦交渉に入った`); }
  // the enemy offers a ceasefire when it is losing
  if (avgFront(w) >= 40 && !w.offer && roll(0.04)) { w.offer = today(g); queueScene(g, 'war', { event: 'offer' }); }
  checkWarEnd(g, w);
  if (r.war !== w || w.phase !== 'war') return;
  // the player at the front: a day there (a scene with the choice; the risk of the day applies there)
  const P = w.player;
  if (P) {
    if (P.role !== 'pm' && today(g) >= num(P.until)) { w.player = null; queueScene(g, 'front_back', {}, { front: true }); }
    else if (P.role === 'pm') { if (roll(playerRisk(w, P))) playerKIA(g, (w.fronts.find((f) => f.id === P.front) || {}).name || '前線'); }
    else queueScene(g, 'front_day', { day: today(g) }, { front: true });
  }
  if (r.lifeOver) return;
  // the morning report: one sober note a day
  w.day = { sd, cd, move: avgFront(w) - before };
  note(g, warReport(g, w, talksFailed));
  if (w.front > -35) w.warned = 0;
  const lv = w.front <= -80 ? 80 : w.front <= -50 ? 50 : 0;
  if (lv > num(w.warned)) { w.warned = lv; queueScene(g, 'war', { event: 'warn', level: lv }); }
}
// The war's morning report (a morning note, line-broken without splitting a number).
function warReport(g, w, talksFailed) {
  const r = R(g);
  const days = today(g) - w.start;
  const mv = num(w.day && w.day.move);
  const move = mv >= 1 ? '前進' : mv <= -1 ? '後退' : '動かず';
  return [
    `【戦況報告】${enemyLabel(w)}との戦争${days}日目・戦費 約${w.cost}兆円`,
    `戦況：${frontText(w.front)}（この1日で${move}）・厭戦 ${Math.round(w.weariness)}／100・${r.sanctions ? `制裁 段階${r.sanctions}` : '制裁なし'}`,
    `この1日の死者 兵士${n0(w.day.sd)}人・民間人${n0(w.day.cd)}人（累計 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人）`,
    talksFailed ? `${enemyFull(w)}との停戦交渉は決裂した。` : null,
  ].filter(Boolean).join('\n');
}
const frontText = (f) => (f >= 60 ? '係争地の大部分を押さえた' : f >= 20 ? 'やや優勢' : f > -20 ? 'こう着' : f > -60 ? '劣勢' : '前線が崩れかけている');
function endWar(g, how) {
  const r = R(g);
  const w = r.war;
  if (!w) return;
  const nat = { name: enemyFull(w), short: enemyLabel(w) };
  const dict = isDict(g);
  const res = how === 'defeat' && !dict ? 'lost' : how === 'surrender' && !dict ? 'lost' : how;
  w.phase = res === 'ceasefire' || res === 'withdraw' ? 'ceasefire' : res === 'victory' ? 'victory' : 'defeat';
  w.end = today(g);
  w.result = res;
  r.record.soldiers += w.cas.soldiers.dead;
  r.record.civilians += w.cas.civilians.dead;
  r.record.enemy += w.cas.enemySoldiers + w.cas.enemyCivilians;
  r.wars.push({ enemy: w.enemy, enemyName: nat.name, start: w.start, end: w.end, result: res, cas: JSON.parse(JSON.stringify(w.cas)), cost: w.cost, mode: w.mode });
  if (w.player) w.player = null;
  for (const k of w.known) if (k.status === 'front' || k.status === 'called' || k.status === 'wounded') k.status = 'back';
  worldCall('onJapanWar', g, 'end', w);
  emit(g, 'war', { kind: 'end', how: res, war: w });
  r.lastWar = { ...w, fronts: w.fronts.map((f) => ({ ...f })), known: w.known.map((k) => ({ ...k })) };
  if (res === 'ceasefire' || res === 'withdraw') {
    news(g, res === 'withdraw' ? `日本は${nat.name}との戦闘から部隊を引き揚げた。死者は兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人` : `${nat.name}との停戦が成立した。死者は兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人にのぼった`);
    phone(g, `【${res === 'withdraw' ? '撤兵' : '停戦'}】${nat.name}との戦闘が止まった。\n死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人。\n講和の交渉はこれから。`, 'ドット新聞 国際部');
    r.unrest = clamp(r.unrest - 5, 0, 100);
    if (res === 'withdraw' && w.ally) { worldCall('relShift', g, w.ally, -15); }
    queueScene(g, 'war', { event: 'ceasefire' });
    r.war = null;
    return;
  }
  if (res === 'victory') {
    news(g, `${forceName(g)}が${w.area}を押さえた。${w.real ? '相手国は敗北を認めていない' : '各国は占領を認めず、制裁を強めた'}。現地では抵抗が続いている`);
    phone(g, `${w.area}は日本の側が押さえたが、多くの国は認めていない。\n死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人。\n戦費 約${w.cost}兆円。`, 'ドット新聞 国際部');
    if (w.aggressor) raiseIntl(g, 15, '占領');
    r.unrest = clamp(r.unrest + 5, 0, 100);
    ecoShock(g, '占領の費用と制裁', { growth: -1.2, inflation: 1.2, len: 360 });
    queueScene(g, 'war', { event: 'victory' });
    r.war = null;
    return;
  }
  if (res === 'lost') {
    // a democracy loses: the cabinet takes the responsibility; the area goes to the other side (world.js); life goes on
    news(g, `日本は${nat.name}との戦争に敗れた。${w.area}は相手の側に渡った。政府は責任をとって総辞職する`);
    phone(g, `【敗戦】${nat.name}との戦争に敗れた。\n死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人。\n内閣は総辞職する。`, 'ドット新聞 政治部');
    bumpApproval(g, -18, -8, 'regime', '敗戦');
    ecoShock(g, '敗戦', { growth: -2, inflation: 1.5, yen: 20, nikkei: -15, len: 360 });
    r.war = null;
    queueScene(g, 'war', { event: 'lost' });
    try { if (isPM(g) && typeof g.resignPM === 'function') g.resignPM('敗戦の責任'); } catch (e) { console.error(e); }
    return;
  }
  // the regime's defeat or surrender: the downfall
  news(g, `${forceName(g)}は${nat.name}に敗れた。政府は降伏し、首都では群衆が政府庁舎を取り囲んでいる`);
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
  r.unrest = clamp(r.unrest + (r.id === 'dictatorship' ? 0.05 : 0.02) + Math.max(0, infl - 3) * 0.04 + r.sanctions * 0.04 + (approvalOf(g) < 25 ? 0.08 : -0.06) + (r.press.detained ? 0.04 : 0), 0, 100);
  // warnings before an uprising
  const lv = r.unrest;
  if (lv >= 50 && !r.flags.warn50) { r.flags.warn50 = true; news(g, '各地で政府への抗議が広がっている。治安部隊との小競り合いも'); spawnDemo(g, { cause: '独裁への抗議', label: '独裁に抗議するデモ', size: 'large', against: 'government' }); }
  if (lv >= 70 && !r.flags.warn70) { r.flags.warn70 = true; news(g, '全国でゼネスト。国軍の一部の部隊が、市民に向けた出動を拒んだと伝えられる'); queueScene(g, 'uprising_warn', {}); }
  if (lv < 40) { r.flags.warn50 = false; if (lv < 60) r.flags.warn70 = false; }
  if (r.id === 'dictatorship') {
    const p2 = Math.pow(Math.max(0, (lv - 60) / 40), 2) * 0.08;
    if (p2 > 0 && roll(p2)) { fall(g, 'uprising'); return; }
    // the politics core: no 総理おろし inside a dictatorship; the budget is run by decree
    if (p && p.cabinet && p.cabinet.pending && p.cabinet.pending.kind === 'resign') { p.cabinet.pending = null; news(g, '党内の退陣要求は封じられた'); }
    if (p && p.economy && p.economy.budget && !p.economy.budget.passed && r.steps.diet) { p.economy.budget.passed = true; news(g, '国会を通さず、予算が政令で執行された'); }
  }
  // the player no longer leads the government (resigned, removed): democracy comes back, the courts take over
  if (p && !isPM(g)) { lawfulRemoval(g, '総理の退陣'); return; }
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
  const p = pol(g);
  try { if (isPM(g) && p && p.cabinet && !p.cabinet.resigned && typeof g.resignPM === 'function') g.resignPM(why); } catch (e) { console.error(e); }
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
    if (/憲法の停止/.test(s)) out.push('政令で憲法の一部を停止しようとし');
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
  if (s.some((x) => /憲法の停止/.test(x))) w += 3;
  return w;
}
function scheduleTrial(g, how) {
  const r = R(g);
  const w = repressionWeight(g);
  // the former PM of the emergency / the dictatorship is never appointed to a cabinet post again in this life
  // (g.regimeBarred: politics.js checks it at 首班指名, 組閣, 入閣の打診)
  r.barred = { day: today(g), how, charged: w > 0 };
  if (w <= 0) {
    r.trial = { day: today(g), how, charged: false };
    news(g, `${g.state.name}前総理について、検察は刑事責任を問わないと判断した`);
    queueScene(g, 'stepdown', { charged: false, how });
    return;
  }
  r.trial = { day: today(g) + 2, how, charged: true, weight: w, done: false };
  queueScene(g, 'stepdown', { charged: true, how });
}
// The trial is due (its day has come and it has not started yet).
function trialDue(g) {
  const t = g && g.state && g.state.regime && g.state.regime.trial;
  return !!(t && t.charged && !t.done && today(g) >= num(t.day));
}
// Why the player (or an NPC) may not be given a cabinet post (内閣総理大臣 included) now: null | reason.
// Only the player can have led the emergency / dictatorship; NPCs → null.
function barredReason(g, who = 'player') {
  if (who !== 'player' && who != null) return null;
  const st = g && g.state;
  const r = st && st.regime;
  if (!r) return null;
  // old saves: the step-down before the flag existed (r.trial) counts too
  const b = r.barred || (r.trial && r.trial.how ? { day: num(r.trial.day), how: r.trial.how, charged: !!r.trial.charged } : null);
  if (!b) return null;
  let open = false;
  try {
    const j = typeof g.jus === 'function' ? g.jus() : null;
    open = !!(j && (j.cases || []).some((c) => c && c.crime === 'abuse_power' && !c.closed));
  } catch (e) { open = false; }
  if (b.charged && (open || (r.trial && !r.trial.done))) return '職権濫用の疑いで捜査・裁判を受けている前総理は、どの内閣にも起用されない';
  return '緊急事態・独裁の体制を敷いて退陣した前総理は、どの内閣にも起用されない';
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
  await say(g, [`${g.state.name}前総理は、職権濫用の罪で起訴された。`, '（刑法193条：公務員職権濫用罪）', '裁判の結果、有罪となった。政治の世界に戻る道は、もうない。']);
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
  const w = r.war ? [...r.wars, r.war] : r.wars;
  return {
    name: st.name || '', day: today(g), date: dateText(g), cause: r.lifeOver ? r.lifeOver.cause : r.fall ? r.fall.cause : null, where: r.lifeOver ? r.lifeOver.where : null, lifeEnemy: r.lifeOver ? r.lifeOver.enemy : null,
    knownKia: num(r.record.knownKia),
    pmDays: me ? num(me.pmDays) : 0, maxRegime: r.record.maxRegime, label: r.fall ? r.fall.label : regimeLabel(g).label,
    steps: r.record.steps.map((x) => x.step), wars: w.length, soldiers: w.reduce((a, x) => a + num(x.cas.soldiers.dead), 0),
    civilians: w.reduce((a, x) => a + num(x.cas.civilians.dead), 0), enemy: w.reduce((a, x) => a + num(x.cas.enemySoldiers) + num(x.cas.enemyCivilians), 0),
    wounded: w.reduce((a, x) => a + num(x.cas.soldiers.wounded) + num(x.cas.civilians.wounded), 0), cost: Math.round(w.reduce((a, x) => a + num(x.cost), 0) * 10) / 10,
    detained: r.record.detained, press: Math.round(pressValue(g)), intl: Math.round(r.intl), sanctions: r.sanctions, disasters: r.record.disasters,
    fame: num(st.fame), money: num(st.money), days: today(g),
  };
}
// Back to the title. The save on disk is the last one made before the fall (saving is blocked once fallen).
// r.fall.toTitle: 'title' (g.toTitle) | 'reload' (the page is going back to the title).
function backToTitle(g) {
  const r = R(g);
  const end = r.fall || r.lifeOver;
  try { if (typeof g.toTitle === 'function') { if (end) end.toTitle = 'title'; g.toTitle(); return; } } catch (e) { console.error(e); }
  try {
    const q = new URLSearchParams(location.search);
    const keep = new URLSearchParams();
    for (const k of ['debug', 'touch']) if (q.has(k)) keep.set(k, q.get(k));
    const s = keep.toString();
    location.href = location.pathname + (s ? `?${s}` : '');
    if (end) end.toTitle = 'reload';
  } catch (e) { console.error(e); }
}

// ======================================================================== scenes (KIKI.show from kiki.js; text fallback)
// KIKI.show(g, spec) → the chosen option's value (or null); spec: { art, title, sub, pages[], options?: [{ label, value }],
//   prompt?, alert?, headline?, numbers? }. KIKI.downfall(g, record) and KIKI.record(g, record) for the end of a life.
export const KIKI = { show: null, downfall: null, record: null };
async function show(g, spec) {
  if (typeof KIKI.show === 'function') return KIKI.show(g, spec);
  if (spec.pages && spec.pages.length) await g.say(spec.pages);
  let v = null;
  if (spec.options && spec.options.length) {
    const i = await g.ask(spec.prompt || 'どうする？', spec.options.map((o) => o.label));
    v = spec.options[i] ? spec.options[i].value : null;
  }
  if (typeof spec.then === 'function') await spec.then(v);
  return v;
}
function queueScene(g, id, data = {}, opts = {}) {
  const r = R(g);
  if (r.id === 'fallen' && id !== 'downfall') return;
  if (r.lifeOver && id !== 'kia') return;
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
  try { if (typeof g.isFree === 'function' && !g.isFree()) return R(g).id === 'fallen' || !!R(g).lifeOver; } catch (e) { /* ignore */ }
  return true;
}
// Other modules (world.js) add their own scenes to the same queue (shown at the next free moment or by g.regimeFlush).
export function registerRegimeScene(id, fn) { if (id && typeof fn === 'function') SCENES[id] = fn; }
export function queueRegimeScene(g, id, data = {}, opts = {}) { if (g && g.state) queueScene(g, id, data, opts); }
export function showRegimeScene(g, spec) { return show(g, spec); }
export function sayWrapped(g, pages) { return say(g, pages); }
async function flush(g) {
  const r = R(g);
  if (g._kikiRunning) return;
  g._kikiRunning = true;
  try {
    for (let guard = 0; guard < 8 && r.queue.length; guard++) {
      const q = r.queue.shift();
      // a stale scene (days old) is dropped, except the ones that matter
      if (today(g) - num(q.day) > 3 && !['downfall', 'referendum', 'court', 'stepdown', 'trial', 'kia', 'kia_npc'].includes(q.id)) continue;
      const fn = SCENES[q.id];
      if (!fn) continue;
      try { await fn(g, q.data || {}); } catch (e) { console.error(e); }
      if (q.id === 'downfall' || q.id === 'kia') return;
    }
  } finally { g._kikiRunning = false; }
  // the trial on its day (also queued as the scene 'trial' by the morning tick; runTrial runs once)
  if (trialDue(g) && r.id !== 'fallen') await runTrial(g);
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
  if (res && res.text) await say(g, res.text);
  else if (res && res.why) await say(g, res.why);
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
      const alert = eew ? (since(g, 2007, 12) ? { kind: 'phone', text: '緊急地震速報\n強い揺れに警戒' } : since(g, 2007, 10) ? { kind: 'tv', text: '緊急地震速報' } : { kind: 'tv', text: '地震速報' }) : d.kind === 'storm' ? { kind: 'tv', text: since(g, 2013, 8) ? '大雨特別警報' : '大雨警報' } : d.kind === 'volcano' ? { kind: 'tv', text: since(g, 2015, 8) ? '噴火速報' : since(g, 2007, 12) ? '噴火警報' : '緊急火山情報' } : { kind: 'tv', text: '地震速報' };
      const pages = [];
      if (eew && since(g, 2007, 12)) pages.push(`${g.state.name}の${deviceName(g)}が、聞いたことのない音で鳴りはじめた。\n「緊急地震速報。強い揺れに警戒してください」`);
      else if (eew && since(g, 2007, 10)) pages.push('テレビから警報音が流れた。\n「緊急地震速報です。強い揺れに警戒してください」');
      if (d.kind === 'quake' || d.kind === 'tsunami') pages.push(d.home ? `……数秒後、大きな揺れが来た。\n棚の物が落ち、窓ガラスが鳴る。\n${g.state.name}は、とっさに机の下にもぐった。` : `テレビのニュース速報が流れた。\n「${d.where}で強い地震」`);
      else if (d.kind === 'storm') pages.push(`${d.where}で記録的な大雨。\n川があふれ、各地で土砂崩れが起きている。`);
      else pages.push('ドット岳が噴火した。\n噴煙が空高く上がり、ふもとの町に避難指示が出た。');
      pages.push(`【${d.name}】${d.mag ? `マグニチュード${d.mag}・最大震度${d.shindo}。` : ''}${d.kind === 'tsunami' ? '大津波警報が出ている。' : ''}\n${TIER_NAME[d.tier]}。いまわかっている被害は――`);
      pages.push(disasterSummary(g, d));
      let prompt = 'どうする？';
      let ids = [];
      if (roles.includes('pm')) { pages.push(`総理として、${crisisRoom(g)}へ向かう。\n${since(g, 1998, 4) ? '官邸対策室が立ち上がり、' : '関係省庁の幹部が集まり、'}情報が集まりはじめた。`); ids = ['honbu_kinkyu', 'honbu_hijo', 'sdf_order']; prompt = '総理として、まず何を指示する？'; }
      else if (roles.includes('defmin')) { ids = ['sdf_order']; prompt = `${postName(g, 'minister_defense')}として、どうする？`; }
      else if (roles.includes('chiji') && d.home) { ids = ['sdf_request', 'kyujo_ho']; prompt = '東京都知事として、どうする？'; }
      else if (roles.includes('kucho') && d.home) { ids = ['shelter']; prompt = 'ドット区長として、どうする？'; }
      else if (d.home) { ids = ['safety', 'donate']; }
      else ids = ['donate'];
      const choice = await show(g, { art: K.art, title: d.name, sub: TIER_NAME[d.tier], pages, alert, numbers: { ...d.known }, options: actionOptions(g, ids), prompt, home: d.home, then: (v) => doDisasterChoice(g, v) });
      // the PM keeps deciding in the crisis room (one more step, if any)
      if (choice && roles.includes('pm')) {
        const more = actionOptions(g, ['sdf_order', 'honbu_hijo', 'honbu_kinkyu', 'fukoku']);
        if (more.length > 1) await show(g, { art: 'kantei', title: crisisRoom(g), sub: d.name, pages: ['各省庁の担当者が集まっている。\nつづけて指示を出す。'], options: more, prompt: '次は？', then: (v) => doDisasterChoice(g, v) });
      }
      return;
    }
    if (data.phase === 'hinan') {
      const pages = [`【${d.name}】${dateText(g)}の被害：\n${disasterSummary(g, d)}`, '避難所では、毛布と水、トイレが足りない。\n自衛隊とボランティアが、物資を運んでいる。'];
      let ids = ['gekijin', 'hosei', 'shienho', 'shelter_visit', 'volunteer', 'charity', 'donate'];
      ids = ids.filter((id) => !disasterRefusal(g, id)).slice(0, 3);
      await show(g, { art: 'shelter', title: d.name, sub: '避難生活', pages, numbers: { ...d.known }, options: actionOptions(g, ids), then: (v) => doDisasterChoice(g, v) });
      return;
    }
    if (data.phase === 'fukko') {
      const pages = [`【${d.name}】避難所の多くが閉じられ、仮設住宅への入居が進む。\n復旧・復興の段階に入った。`, `死者${n0(d.known.dead)}人・行方不明${n0(d.known.missing)}人。\n失われたものは、元には戻らない。`];
      const ids = ['fukko_plan', 'hosei', 'gekijin', 'volunteer', 'charity'].filter((id) => !disasterRefusal(g, id)).slice(0, 3);
      await show(g, { art: 'fukko', title: d.name, sub: '復旧・復興', pages, options: actionOptions(g, ids), then: (v) => doDisasterChoice(g, v) });
    }
  },
  async shelter(g, data) {
    const d = R(g).disaster;
    await show(g, { art: 'shelter', title: '避難所', sub: d ? d.name : '', pages: data.who === 'kucho' ? ['体育館に段ボールの仕切りが並ぶ。\n区の職員が名簿をつくり、水と毛布を配っている。'] : ['体育館で、ひとりひとりの話を聞いて回った。\n「ありがとう。顔を見せてくれてうれしい」'] });
  },
  async volunteer(g, data) {
    // the player's own town (d.home): neighbours, not "from far away"; later days are quiet work, not a photo op
    const page = num(data.n, 1) >= 3
      ? '今日も泥かきと物資の仕分けを手伝った。\n顔なじみになった人たちと、黙々と作業する。'
      : data.home ? '長靴とマスクで、近所の家の泥をかき出す。\n近所の人と声をかけあいながら、少しずつ片付けた。'
        : '長靴とマスクで、家の泥をかき出す。\n地元の人が「遠くからありがとう」と麦茶をくれた。';
    await show(g, { art: 'volunteer', title: '災害ボランティア', pages: [page] });
  },
  async charity(g, data) { await show(g, { art: 'charity', title: 'チャリティ', pages: [`チャリティ企画で、被災地への支援を呼びかけた。\n${fmtMoney(num(data.raised))}の義援金が集まった。`] }); },
  async cabinet(g, data) { await show(g, { art: 'cabinet', title: '閣議', pages: data.what === 'gekijin' ? ['閣議で、激甚災害の指定の政令を決めた。\n復旧事業の国の補助がかさ上げされる。'] : ['閣議で決めた。'] }); },
  async fukko(g) { await show(g, { art: 'fukko', title: '復興の基本方針', pages: ['住まい、仕事、学校、道路。\nひとつずつ、町を取り戻していく。'] }); },
  async pko(g, data) { await show(g, { art: 'pko', title: 'PKO派遣', sub: data.mission, pages: [`${data.mission}に、自衛隊の部隊（約${n0(data.personnel)}人）が出発した。\n道路の補修や給水を担う。（PKO参加5原則）`] }); },
  async pko_offer(g) {
    const r = R(g), o = r.sdf.pkoOffer;
    if (!o) return;
    const ok = !sdfRefusal(g, 'pko');
    await show(g, { art: 'pko', title: '国連からの要請', sub: o.mission, pages: [`国連から、${o.mission}への参加の要請が届いた。\n停戦合意と受入れ国の同意がある。`], options: ok ? [{ label: '派遣を閣議決定', value: 'pko' }, { label: '見送る', value: null }] : [{ label: 'わかった', value: null }], then: async (v) => { if (v === 'pko') { const res = g.sdfOrder('pko'); if (res.text || res.why) await say(g, res.text || res.why); } } });
  },
  async kaijo(g, data) {
    const r = R(g);
    if (!r.sdf.kaijo || r.sdf.kaijo.done) return;
    const ok = !sdfRefusal(g, 'kaijo');
    await show(g, { art: 'sea', title: '不審船', sub: `${FICTIONAL_NATIONS[data.nation].short}籍とみられる`, pages: ['領海に不審船。海上保安庁の巡視船が追跡している。\n停船の命令に応じない。'], options: ok ? [{ label: '海上保安庁に任せる', value: null }, { label: '海上警備行動を発令', value: 'kaijo' }] : [{ label: 'わかった', value: null }], then: async (v) => {
      if (v === 'kaijo') { const res = g.sdfOrder('kaijo'); if (res.text || res.why) await say(g, res.text || res.why); }
      else if (ok && r.sdf.kaijo) { r.sdf.kaijo.done = 'jcg'; await say(g, '海上保安庁に対応を任せた。（まずは海上保安庁が対応する）'); }
    } });
  },
  async referendum(g, data) {
    const segName = (s) => (POL && POL.SEGMENTS && POL.SEGMENTS[s] && POL.SEGMENTS[s].name) || s;
    const by = Object.entries(data.bySeg || {}).sort((a, b) => b[1] - a[1]);
    const art9 = !!data.what;
    await show(g, { art: 'referendum', title: '国民投票', sub: data.what || '強権型の緊急事態条項', numbers: { yes: data.yes, turnout: data.turnout }, bySeg: data.bySeg, pages: [`開票が終わった。賛成${data.yes}%・反対${Math.round((100 - data.yes) * 10) / 10}%（投票率${data.turnout}%）`, `賛成が多かった層：${by.slice(0, 2).map(([s, v]) => `${segName(s)}${v}%`).join('・')}\n反対が多かった層：${by.slice(-2).map(([s, v]) => `${segName(s)}${Math.round((100 - v) * 10) / 10}%`).join('・')}`, data.passed ? (art9 ? '憲法が改正された。\n国会の承認があれば、宣戦もできる国になった。' : '憲法が改正された。\n緊急事態宣言の道が開かれた。') : '改正案は否決された。\n国民は、この条文を選ばなかった。'] });
  },
  async regime_change(g, data) {
    const lab = regimeLabel(g);
    if (data.to === 'emergency') await show(g, { art: 'emergency', title: '緊急事態宣言', sub: '総理大臣の会見', headline: '全国に緊急事態宣言', pages: ['テレビの全チャンネルが、同じ会見を映している。\n「本日、全国に緊急事態を宣言します」', '内閣は、法律と同じ効力の政令を出せるようになった。\n街には不安と、静かな怒りが広がっている。'] });
    else if (data.to === 'dictatorship') await show(g, { art: 'diet_closed', title: '独裁体制', sub: '選挙と国会の停止', headline: `${lab.label}体制`, pages: ['国会議事堂の門が閉ざされた。\n選挙の予定は、すべて消えた。', `海外のメディアは、日本の体制を「${lab.label}」と呼びはじめた。\n各国の大使が、本国に呼び戻されている。`] });
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
    if (!isPM(g)) { await show(g, { art: 'court', title: '最高裁判決', sub: data.what, pages }); answerCourt(g, data.step, true); return; }
    await show(g, { art: 'court', title: '最高裁判決', sub: data.what, pages, options: [{ label: '判決に従う', value: 'comply' }, { label: '判決を無視する', value: 'ignore' }], prompt: '判決にどう向き合う？', then: (v) => say(g, answerCourt(g, data.step, v !== 'ignore')) });
  },
  async army(g) { await show(g, { art: 'army', title: '国軍化', sub: '政令による改編', pages: ['自衛隊の駐屯地で、看板がかけ替えられた。\n「国軍」――多くの隊員が、黙って制服を脱いだ。'] }); },
  async war(g, data) {
    const r = R(g);
    const w = r.war || r.lastWar;
    if (!w) return;
    const nat = { name: enemyFull(w), short: enemyLabel(w) };
    const cas = w.cas;
    const force = forceName(g);
    if (data.event === 'declare') {
      const head = w.mode === 'defense' ? `${nat.short}の攻撃に、防衛出動を命じた。` : w.mode === 'alliance' ? `${w.allyName || '同盟国'}を守るため、${nat.name}との戦闘に加わった。` : `${w.area}をめぐり、${nat.name}に宣戦を布告した。`;
      const al = (w.allies || []).length ? `${w.allies.map((x) => x.name).join('・')}が日本の側で戦う。` : w.aggressor ? '同盟国は、この戦争に加わらないと表明した。' : '';
      const fo = (w.foes || []).length ? `${w.foes.map((x) => x.name).join('・')}は${nat.short}の側についた。` : '';
      await show(g, { art: 'war', title: w.mode === 'defense' ? '防衛出動' : w.mode === 'alliance' ? '参戦' : '宣戦布告', sub: nat.name, front: 0, pages: [head, `${al}${fo}`.trim() || '国連の安全保障理事会が緊急会合を開いた。', w.aggressor ? '国連と各国は即時の停戦を求めている。' : '各国が事態の収拾を呼びかけている。'] });
    } else if (data.event === 'ceasefire') await show(g, { art: 'war', title: w.result === 'withdraw' ? '撤兵' : '停戦', sub: nat.name, front: w.front, pages: [w.result === 'withdraw' ? '部隊が引き揚げてくる。港には、帰りを待つ家族が集まった。' : '停戦が成立した。前線の銃声が止んだ。', `死者　兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人\nけが人　${n0(cas.soldiers.wounded + cas.civilians.wounded)}人\n相手国側の死傷者　${n0(cas.enemySoldiers + cas.enemyCivilians)}人`, isPM(g) ? '講和の交渉は「世界情勢」から。\n帰ってこない人たちの家族が、町に残された。' : '帰ってこない人たちの家族が、町に残された。'] });
    else if (data.event === 'victory') await show(g, { art: 'war', title: '占領', sub: w.area, front: 100, pages: [`${force}は${w.area}を押さえた。\nだが、祝う声はほとんど聞こえない。`, `死者　兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人\n相手国側の死傷者　${n0(cas.enemySoldiers + cas.enemyCivilians)}人\n戦費　約${w.cost}兆円`, '多くの国は占領を認めていない。\n現地では抵抗が続いている。'] });
    else if (data.event === 'lost') await show(g, { art: 'newspaper', title: '敗戦', headline: `${nat.short}との戦争に敗れる`, pages: [`日本は${nat.name}との戦争に敗れた。${w.area}は相手の側に渡った。`, `死者　兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人`, '内閣は責任をとって総辞職する。\n町には、言葉にならない空気が流れている。'] });
    else if (data.event === 'offer' && r.war && r.war.phase === 'war' && isPM(g)) {
      await show(g, { art: 'war', title: '停戦の打診', sub: nat.name, front: w.front, pages: [`${nat.name}が、第三国を通じて停戦を打診してきた。`, `いまの戦況：${frontText(w.front)}。\n死者は兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人。`], options: [{ label: '停戦に応じる', value: 'yes' }, { label: '戦いを続ける', value: null }], prompt: '停戦に応じる？', then: async (v) => { if (v === 'yes') { endWar(g, 'ceasefire'); await say(g, '停戦に応じた。'); } } });
    } else if (data.event === 'warn' && r.war && r.war.phase === 'war' && isPM(g)) {
      // the front gives way: the choices that can still end the war without the downfall
      const opts = [];
      if (!warRefusal(g, 'negotiate')) opts.push({ label: '停戦交渉を始める', value: 'negotiate' });
      if (w.stance !== 'defend' && !warRefusal(g, 'defend')) opts.push({ label: '防衛に徹する', value: 'defend' });
      opts.push({ label: 'このまま続ける', value: null });
      const pages = num(data.level) >= 80
        ? ['前線が崩れかけている。\n参謀は青ざめている。「敗戦は、時間の問題です」', `死者は兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人にのぼった。\n厭戦の声は、もう抑えきれない。`]
        : ['前線が押し戻されている。\n参謀は言う。「このままでは、いずれ前線が崩れます」', `死者は兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人にのぼった。\n${r.sanctions ? '各国の制裁で、弾薬も燃料も足りなくなっている。' : '補給が追いつかなくなっている。'}`];
      pages.push(`（命令は${deviceName(g)}の「危機管理」や「世界」からも出せる）`);
      await show(g, { art: 'war', title: '戦況の悪化', sub: nat.name, front: w.front, pages, options: opts, prompt: num(data.level) >= 80 ? '敗戦か、停戦か。どうする？' : 'どうする？', then: async (v) => { if (v) { const res = warOrder(g, v); if (res.text || res.why) await say(g, res.text || res.why); } } });
    }
  },
  // a battle (the result is told by the caller; the scene shows the front and the numbers)
  async battle(g, data) {
    const r = R(g);
    const w = r.war && r.war.start === data.start ? r.war : r.lastWar && r.lastWar.start === data.start ? r.lastWar : null;
    const b = w && w.battles ? w.battles[data.idx] : null;
    if (!b) return;
    await show(g, { art: 'battle', title: `作戦：${b.name}`, sub: `${enemyLabel(w)}との戦争`, battle: b, front: (w.fronts.find((f) => f.id === b.front) || {}).control, pages: [b.win ? `${b.name}での作戦は成功した。前線が進んだ。` : `${b.name}での作戦は失敗した。部隊は押し戻された。`, `死者　自国の兵士${n0(b.sd)}人${b.cd ? `・民間人${n0(b.cd)}人` : ''}\n相手側の死者　${n0(b.ed)}人（見込みは${b.odds}%だった）`] });
  },
  // the break with a real party (round 4: the path goes through)
  async breakaway(g, d) {
    const pages = [];
    if (d.organ) pages.push(`${d.organ}は「${d.what}」を了承しなかった。\n「党として認めるわけにはいかない」`);
    pages.push(d.old ? `${g.state.name}は${d.old}を${d.expelled ? '除名された' : '離れることを決めた'}。\n同調する議員${d.moved}人が、あとに続いた。` : `${g.state.name}は、自分の党をつくることにした。`);
    pages.push(`新党「${d.name}」を結成した。${d.pm ? '\n総理の座は、そのまま。' : ''}`);
    await show(g, { art: 'breakaway', title: '新党結成', sub: d.name, headline: `新党「${d.name}」結成`, pages });
  },
  // someone the player knows died at the front (sober; no detail)
  async kia_npc(g, d) {
    const w = R(g).war || R(g).lastWar;
    const k = w && (w.known || []).find((x) => x.key === d.key);
    if (!k) return;
    const pages = k.kind === 'family'
      ? [`知らせが届いた。\n${k.rel}の${k.name}が、${k.where}で戦死した。`, '電話の向こうで、家族が泣いている。\n言葉が、何も出てこなかった。']
      : k.kind === 'friend' ? [`${k.name}の家族から知らせが届いた。\n${k.where}で戦死したという。`, '最後に会った日のことを、思い出していた。']
        : [`${k.rel}の${k.name}（${k.unit}）が、${k.where}で戦死した。`, '「帰ったら、またごはん行こう」\nそう言っていたのに。'];
    await show(g, { art: 'telegram', title: '戦死の知らせ', sub: k.name, pages });
  },
  // the call-up of the player's friends / family under the regime (the dictator may exempt them, at a cost)
  async conscript(g, d) {
    const w = R(g).war;
    if (!w) return;
    const ks = (d.keys || []).map((key) => w.known.find((x) => x.key === key)).filter((k) => k && k.status === 'called');
    if (!ks.length) return;
    const names = ks.map((k) => `${k.rel}の${k.name}`).join('、');
    const pages = [`召集令状が、${names}にも届いた。`, ks.some((k) => k.kind === 'family') ? '家族から電話が来た。声がふるえている。' : '「行ってくるよ」と、短いメッセージが来た。'];
    if (!isPM(g)) { await show(g, { art: 'conscript', title: '召集令状', sub: `${ks.length}人`, pages }); return; }
    await show(g, { art: 'conscript', title: '召集令状', sub: `${ks.length}人`, pages, options: [{ label: '特別に免除する', value: 'exempt' }, { label: 'そのまま行かせる', value: null }], prompt: '総理の力で免除することもできる。どうする？',
      then: async (v) => {
        if (v !== 'exempt') return;
        for (const k of ks) k.status = 'exempt';
        const r = R(g);
        r.unrest = clamp(r.unrest + 3, 0, 100);
        press(g, -2, '召集の免除');
        bumpApproval(g, -2, -1, 'regime', '知人の召集の免除');
        news(g, `${g.state.name}総理の知人や家族が召集を免除されたと報じられた。「特権だ」との批判が広がっている`);
        await say(g, '免除した。だが、うわさはすぐに広まった。「自分の知り合いだけは守るのか」――。');
      } });
  },
  // the player's own call-up (総動員; not the dictator)
  async callup(g) {
    const w = R(g).war;
    if (!w || w.phase !== 'war' || w.player || isPM(g)) return;
    await show(g, { art: 'conscript', title: '召集令状', sub: g.state.name, pages: [`${g.state.name}のもとにも、召集令状が届いた。`, '指定の日に、指定の場所へ出頭せよ――。'], options: [{ label: '応じる', value: 'go' }, { label: '逃れる（成功50%）', value: 'hide' }], prompt: 'どうする？',
      then: async (v) => {
        if (v === 'hide' && roll(0.5)) { const me = meOf(g); if (me) me.reputation = clamp(num(me.reputation) - 5, -100, 100); await say(g, '知り合いの家に身を寄せ、召集を逃れた。うしろめたさが残る。'); return; }
        if (v === 'hide') await say(g, '逃げようとしたが、見つかった。前線へ送られる。');
        const res = frontOrder(g, 'front_go', { conscript: true });
        await say(g, res.text || '前線へ向かった。');
      } });
  },
  // a day at the front for the player (the risk of the day is shown and applied here)
  async front_day(g) {
    const r = R(g);
    const w = r.war;
    const P = w && w.player;
    if (!P || w.phase !== 'war' || r.lifeOver) return;
    const f = w.fronts.find((x) => x.id === P.front) || w.fronts[0];
    const rk = (m) => (playerRisk(w, P, m) * 100).toFixed(1);
    await show(g, { art: 'front', title: f.name, sub: `従軍${today(g) - P.since + 1}日目（あと${Math.max(0, P.until - today(g))}日）`, front: f.control, pages: ['夜明け前。遠くで砲声が続いている。', `戦況：${frontText(f.control)}。きょうの任務を決める。`],
      options: [{ label: `前に出る（危険${rk(2.2)}%）`, value: 'push' }, { label: `持ち場を守る（危険${rk(1)}%）`, value: 'hold' }, { label: `負傷者を運ぶ（危険${rk(1.4)}%）`, value: 'carry' }], prompt: 'きょうはどうする？',
      then: async (v) => {
        const m = v === 'push' ? 2.2 : v === 'carry' ? 1.4 : 1;
        useStamina(g, 15);
        if (roll(playerRisk(w, P, m))) { playerKIA(g, f.name); await say(g, '――そのとき、すぐ近くで爆発が起きた。'); return; }
        if (v === 'push') { f.control = clamp(f.control + rint(2, 6), -100, 100); if (typeof g.addFame === 'function') g.addFame(5, true); await say(g, '仲間と前に出た。前線がわずかに進んだ。'); }
        else if (v === 'carry') { const me = meOf(g); if (me) me.reputation = clamp(num(me.reputation) + 2, -100, 100); await say(g, '負傷した仲間を、後ろの救護所まで運んだ。「ありがとう」と言われた。'); }
        else await say(g, '持ち場を守った。長い一日だった。');
      } });
  },
  async front_back(g) { await show(g, { art: 'front', title: '帰還', sub: '任務の終わり', pages: ['任務の期間が終わり、前線を離れた。', '列車の窓から見る町は、出発した日と同じなのに、どこか違って見えた。'] }); },
  // the player died at the front: that life ends (the save stays the last one before it)
  async kia(g, data) {
    const rec = regimeRecord(g);
    if (typeof KIKI.kia === 'function') await KIKI.kia(g, rec);
    else await g.say([`${rec.where || '前線'}で、${rec.name}は戦死した。`, 'こうして、この人生の物語は終わった。']);
    if (typeof KIKI.record === 'function') await KIKI.record(g, rec);
    else await g.say(recordLines(rec));
    backToTitle(g);
  },
  async uprising_warn(g) { await show(g, { art: 'demo', title: 'ゼネスト', sub: '全国で退陣要求', pages: ['全国でゼネストが始まった。\n広場を埋めた群衆が、退陣を求めている。', '国軍の一部の部隊は、市民に向けた出動を拒んだ。\n残された時間は少ない。'] }); },
  // the 特捜 case after stepping down / a lawful removal (crime.js g.arrest), on its day whatever the player does
  async trial(g) { if (trialDue(g)) await runTrial(g); },
  async stepdown(g, data) {
    await show(g, { art: 'newspaper', title: '退陣', headline: data.charged ? '前総理を職権濫用で捜査' : '前総理 刑事責任問われず', pages: data.charged ? [data.how === 'coup' ? '総理の座を追われた。' : '総理の座を降りた。選挙と国会は再開される。', 'それまでの行為について、検察が捜査を始めた。\n法にもとづいて、裁かれることになる。'] : ['総理の座を降りた。選挙と国会は再開される。', '検察は、刑事責任は問わないと判断した。\nだが、政治家としての信頼は、もう戻らない。'] });
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
    'セーブデータから再開するか、新しく始めてください。',
  ];
}

// ======================================================================== the morning
export async function regimeTick(g) {
  if (!g || !g.state) return;
  const r = R(g);
  if (num(r.lastTick) >= today(g)) return;
  r.lastTick = today(g);
  if (r.id === 'fallen' || r.lifeOver) return;
  try {
    extendDemoResponses();
    pressTick(g);
    if (r.amend && r.amend.stage === 'referendum' && today(g) >= r.amend.voteDay) runReferendum(g);
    if (r.amend9 && r.amend9.stage === 'referendum' && today(g) >= r.amend9.voteDay) runReferendum9(g);
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
    // the 特捜 case after stepping down: on its day it is queued like any scene (shown at the next free moment,
    // usually right after waking), so it starts whatever the player does
    if (r.id !== 'fallen' && trialDue(g)) queueScene(g, 'trial', {}, { front: true });
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
      const before = num(p.cabinet.approval);
      p.cabinet.approval = clamp(before + r.approvalMod * 0.4, 3, 90);
      if (poll) poll.approval = Math.round(p.cabinet.approval * 10) / 10;
      noteApproval(g, 'regime', p.cabinet.approval - before, '体制の変化の影響（つづいている）');
    } catch (e) { console.error(e); }
  });
  POL.onPolitics('enacted', (g, info) => {
    try { if (g && g.state && info && info.law && info.law.policy) R(g).flags['law_' + info.law.policy] = today(g); } catch (e) { console.error(e); }
  });
  // the PM leaves office during the emergency (不信任・総辞職): democracy comes back, the courts take over
  const gone = (g, info) => {
    try {
      if (!g || !g.state) return;
      const r = R(g);
      // 'resign' is emitted before the politics core removes the 'pm' post: info.pm tells whose cabinet it was
      const left = info && info.who === 'cabinet' ? info.pm === 'player' : !isPM(g);
      if ((r.id === 'emergency' || r.id === 'dictatorship') && left) lawfulRemoval(g, info && info.reason ? `総理の退陣（${info.reason}）` : '総理の退陣');
    } catch (e) { console.error(e); }
  };
  POL.onPolitics('resign', gone);
  POL.onPolitics('cabinet', gone);
  // every new / changed cabinet (首班指名 after an election, 組閣, 連立): the real-party coalition rule
  POL.onPolitics('cabinet', (g) => {
    try { if (g && g.state && g.state.regime) enforceCoalition(g); } catch (e) { console.error(e); }
  });
  wrapCoalition(Game.prototype);
}

// ======================================================================== A1's demonstrations: the dictatorship's responses
let demoExtended = false;
function extendDemoResponses() {
  if (demoExtended || !GOVT || !GOVT.DEMO_RESPONSES || typeof GOVT.DEMO_RESPONSES !== 'object') return;
  demoExtended = true;
  const D = GOVT.DEMO_RESPONSES;
  const add = (id, def) => { if (!D[id]) D[id] = { id, ...def }; };
  // available(g, demo) → true | reason (govt.js shows the reason): only in an emergency or a dictatorship
  const okIn = (g) => { const r = R(g); return r.id === 'emergency' || r.id === 'dictatorship' ? true : '民主制の政府は、デモを力で抑えられない（集会・表現の自由：憲法21条）。緊急事態か独裁の体制のもとでだけ選べる'; };
  // the force options: only in an emergency / dictatorship; a real party never makes them a refusal (round 4: the PM
  // breaks with it first, a real junior partner leaves — see forcePath in apply)
  const forceOk = () => (g) => okIn(g);
  const forcePath = (g, what) => { let pre = null; try { pre = realPathBefore(g, what); realPartnersLeave(g, what); } catch (e) { console.error(e); } return pre; };
  add('crackdown', {
    name: '弾圧（治安部隊の出動）', label: '弾圧', regime: true,
    desc: '治安部隊でデモを解散させる。国内外から激しい非難を浴び、蜂起の危険が一気に高まる。',
    when: forceOk('治安部隊の出動'), available: forceOk('治安部隊の出動'),
    apply(g, demo) {
      const r = R(g);
      const pre = forcePath(g, '治安部隊の出動');
      if (demo && typeof demo === 'object') { demo.momentum = num(demo.momentum, 1) * 0.5; demo.size = Math.round(num(demo.size) * 0.6); }
      r.unrest = clamp(r.unrest + 18, 0, 100);
      raiseIntl(g, 15, 'デモの弾圧');
      press(g, -5, 'デモの弾圧');
      bumpApproval(g, -8, -4, 'regime', 'デモの弾圧');
      r.record.steps.push({ day: today(g), step: 'デモの弾圧' });
      news(g, '治安部隊がデモを強制的に解散させた。多数のけが人と拘束者が出たと伝えられる。各国が強く非難している');
      return { ok: true, text: `${pre ? `${pre}\n` : ''}治安部隊がデモを解散させた。国内外の怒りは、かえって大きくなった。` };
    },
  });
  add('curfew', {
    name: '外出禁止令', label: '外出禁止令', regime: true,
    desc: '夜間の外出を禁じる。暮らしと経済に重い負担。',
    when: forceOk('外出禁止令'), available: forceOk('外出禁止令'),
    apply(g, demo) {
      const r = R(g);
      const pre = forcePath(g, '外出禁止令');
      if (demo && typeof demo === 'object') demo.momentum = num(demo.momentum, 1) * 0.8;
      r.unrest = clamp(r.unrest + 6, 0, 100);
      raiseIntl(g, 5, '外出禁止令');
      ecoShock(g, '外出禁止令', { growth: -0.5, len: 60 });
      news(g, '全国に夜間の外出禁止令が出された');
      return { ok: true, text: `${pre ? `${pre}\n` : ''}外出禁止令を出した。街は静かになったが、不満は消えていない。` };
    },
  });
  add('concession', {
    name: '譲歩（拘束者の解放・対話）', label: '譲歩', regime: true,
    desc: '拘束した人を解放し、対話を約束する。',
    when: okIn, available: okIn,
    apply(g) {
      const r = R(g);
      r.unrest = Math.max(0, r.unrest - 10);
      r.intl = Math.max(0, r.intl - 4);
      news(g, '政府が拘束者の一部を解放し、市民団体との対話を約束した');
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
  if (S.regimes && !S.regimes.includes(r.id) && !['suspend_elections', 'suspend_diet', 'ban_opposition', 'national_army', 'lift_emergency', 'democratize'].includes(kind)) return kind === 'self_coup' || kind === 'amend_article9' ? `いまの体制（${REGIME_INFO[r.id].name}）では要らない` : `いまの体制（${REGIME_INFO[r.id].name}）ではできない`;
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
    // the real-party rule: the player breaks with a real party (or founds a party of their own) first; a real junior
    // partner leaves the coalition. The step then goes through.
    const pre = S.auth || S.war ? realPathBefore(this, S.name) : null;
    if (S.auth || S.war) realPartnersLeave(this, S.name);
    const res = S.run(this, opts) || { ok: true };
    emit(this, 'step', { kind, res });
    if (pre && res && res.text) res.text = `${pre}\n${res.text}`;
    return res.ok === false ? res : { ok: true, ...res };
  },
  regimeSteps() {
    return REGIME_STEP_ORDER.map((id) => ({ id, name: REGIME_STEPS[id].name, desc: actionDesc(REGIME_STEPS[id], this), auth: !!REGIME_STEPS[id].auth, war: !!REGIME_STEPS[id].war, why: stepRefusal(this, id), odds: typeof REGIME_STEPS[id].odds === 'function' ? Math.round(REGIME_STEPS[id].odds(this) * 100) / 100 : null, breakaway: (REGIME_STEPS[id].auth || REGIME_STEPS[id].war) && needsBreak(this) ? realPartyRefusal(this, REGIME_STEPS[id].name) || '自分の党をつくってから進める（自動）' : null }));
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
    const pre = kind !== 'release' ? realPathBefore(this, A.name) : null;
    if (kind !== 'release') { realPartnersLeave(this, A.name); if (r.id !== 'democracy') fictionNotice(this); }
    let text = A.run(this);
    if (text == null) return { ok: false, why: '必要がない' };
    const post = kind !== 'release' ? realPathAfter(this, A.name) : null;
    text = [pre, text, post].filter(Boolean).join('\n');
    if (kind !== 'release') { const last = r.record.steps[r.record.steps.length - 1]; if (!last || last.step !== A.name || last.day !== today(this)) r.record.steps.push({ day: today(this), step: A.name }); }
    emit(this, 'press', { kind });
    return { ok: true, text };
  },
  pressActions() {
    return PRESS_ORDER.map((id) => ({ id, name: PRESS_ACTIONS[id].label ? PRESS_ACTIONS[id].label(this) : PRESS_ACTIONS[id].name, desc: actionDesc(PRESS_ACTIONS[id], this), regimes: PRESS_ACTIONS[id].regimes.slice(), why: pressRefusal(this, id) }));
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
  sdfOrders() { return SDF_ORDER_LIST.map((id) => ({ id, name: SDF_ORDERS[id].name, desc: actionDesc(SDF_ORDERS[id], this), why: sdfRefusal(this, id) })); },
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
    return DISASTER_ACTION_ORDER.filter((id) => DISASTER_ACTIONS[id].roles.some((x) => roles.includes(x))).map((id) => ({ id, name: DISASTER_ACTIONS[id].name, desc: actionDesc(DISASTER_ACTIONS[id], this), why: disasterRefusal(this, id) }));
  },
  startDisaster(opts = {}) { return startDisaster(this, opts); },
  war() {
    const w = R(this).war;
    if (!w) return null;
    const fronts = (w.fronts || []).map((f) => ({ ...f, own: Math.round(num(f.own)), control: Math.round(num(f.control)), odds: Math.round(battleOdds(this, w, f) * 100), power: frontPower(this, w, f), today: num(f.last) === today(this) }));
    return {
      ...w, enemyName: enemyFull(w), enemyShort: enemyLabel(w), area: w.area || DISPUTED_AREA.name, frontText: frontText(w.front), cas: JSON.parse(JSON.stringify(w.cas)), log: w.log.slice(),
      fronts, allies: (w.allies || []).map((x) => ({ ...x })), foes: (w.foes || []).map((x) => ({ ...x })), known: (w.known || []).map((k) => ({ ...k })), player: w.player ? { ...w.player, risk: Math.round(playerRisk(w, w.player) * 1000) / 10, frontName: (fronts.find((f) => f.id === w.player.front) || {}).name || '' } : null,
      battles: (w.battles || []).slice(), reserve: Math.round(num(w.reserve)), talksOdds: Math.round(talksOdds(this, w) * 100), decisions: { ...(w.decisions || {}) },
      modeName: { regime: '独裁体制の戦争', art9: '改正憲法のもとの戦争', alliance: '同盟国の戦争への参戦', defense: '防衛出動（武力攻撃事態）' }[w.mode] || '戦争',
    };
  },
  lastWar() { const w = R(this).lastWar; return w ? { ...w } : null; },
  warOrder(kind, opts = {}) { return warOrder(this, kind, opts); },
  warOrders(opts = {}) {
    const w = R(this).war;
    return WAR_ORDER_LIST.map((id) => {
      const why = warRefusal(this, id, opts);
      const f = w && w.phase === 'war' && (id === 'battle' || id === 'deploy') ? pickFront(w, opts.front) : null;
      const extra = id === 'battle' && f ? `（${f.name}：見込み ${Math.round(battleOdds(this, w, f) * 100)}%）` : id === 'negotiate' && w && w.phase === 'war' ? `（見込み ${Math.round(talksOdds(this, w) * 100)}%）` : id === 'front_go' && w && w.phase === 'war' ? `（1日あたりの危険 約${(playerRisk(w, { front: (pickFront(w) || {}).id, role: isPM(this) ? 'pm' : 'volunteer' }) * 100).toFixed(1)}%）` : '';
      return { id, name: WAR_ORDERS[id].name, desc: WAR_ORDERS[id].desc + extra, why, front: f ? f.id : null };
    });
  },
  // the war's preview for the UIs: the routes, the odds of a declaration in the democracy
  warPaths(target = null) {
    const r = R(this);
    return {
      regime: r.id, art9: !!r.steps.art9, army: !!(r.steps.army && r.id === 'dictatorship'), collective: collectiveBasisR(this), attack: worldCall('attackOnJapan', this),
      declare: warRefusal(this, 'declare', target ? { target } : {}), dietOdds: Math.round(dietWarOdds(this) * 100) / 100, paths: WAR_PATHS,
      amend9: r.amend9 ? { ...r.amend9 } : null, amend9Step: stepRefusal(this, 'amend_article9'), referendum9: referendum9Projection(this), breakaway: needsBreak(this) ? realPartyRefusal(this, '宣戦布告') || '自分の党をつくってから進める（自動）' : null,
    };
  },
  regimeLifeOver() { const l = R(this).lifeOver; return l ? { ...l } : null; },
  // Why the player cannot travel now (a disaster near home stops the trains for a few days), or null.
  // r.cancelUntil (the last day) stays the field name; phone_apps.js may read either.
  regimeTravelBlock() {
    const r0 = this.state && this.state.regime;
    if (r0 && r0.war && r0.war.player && r0.war.phase === 'war') return '前線にいる。任務が終わるまでは戻れない（「前線から戻る」）。';
    const r = r0;
    if (!r || num(r.cancelUntil) < today(this) || !r.disaster) return null;
    return `${r.disaster.name}の影響で、電車も高速道路も止まっている。いまは遠くへ移動できない。`;
  },
  regimeNews(n = 10) { return R(this).news.slice(0, n); },
  regimeLabel() { return regimeLabel(this); },
  regimeRecord() { return regimeRecord(this); },
  regimeFlush() { return flush(this); },
  // null | the reason the player (who = 'player', the default) may not be given a cabinet post, 内閣総理大臣 included:
  // the former PM of the emergency / dictatorship (stepped down or removed). NPCs → null. Flag:
  // g.state.regime.barred = { day, how: 'democratize'|'removal', charged }. post is accepted for symmetry (any post).
  regimeBarred(who = 'player', post = null) { return barredReason(this, who == null ? 'player' : who); },
  regimeTick() { return regimeTick(this); },
  // the answer to a court ruling (UIs; the scene asks it itself)
  regimeCourt(step, comply = true) { return answerCourt(this, step, comply); },
  // The real-party coalition rule (for politics.js chooseCoalition / formCabinet / joinCoalition and the UIs):
  // → null | the reason the real party partyId may not be in this government now. opts { core?, partner? }:
  // core = the coalition's core (PM's party; default: the player's government), partner = the party joining a core.
  regimeCoalitionBlock(partyId, opts = {}) { return regimeCoalitionBlock(this, partyId, opts || {}); },
  // → { core, partners (allowed), refused: [{ id, why }] } for a proposed coalition
  regimeCoalitionFilter(core, partners = []) { return coalitionFilter(this, core, partners); },
  // the 発議 / 国民投票 projections (the same model as the real votes, without the random part)
  regimeAmendProjection() { return amendProjection(this); },
  regimeReferendumProjection() { return referendumProjection(this); },
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
    try { if (this.state && this.state.regime && (this.state.regime.id === 'fallen' || this.state.regime.lifeOver)) return false; } catch (e) { /* ignore */ }
    return orig.apply(this, a);
  });
  // a free moment: show the queued scenes (the downfall first) and start the trial on its day
  wrap('afterScript', (orig) => function (...a) {
    const res = orig.apply(this, a);
    try {
      if (this.state && this.state.regime && (R(this).queue.length || trialDue(this)) && canShow(this)) this.run(() => flush(this));
    } catch (e) { console.error(e); }
    return res;
  });
  // the morning of the downfall: the downfall comes first. The ordinary morning (notes such as 仕送り or rent, the
  // 満腹 / 身だしなみ toasts, the bed's cheerful line, the other modules' morning scenes) is not shown: the scene plays
  // right after the night, inside g.sleep, and the game goes back to the title from it.
  wrap('morning', (orig) => async function (...a) {
    const res = await orig.apply(this, a);
    try {
      const r = this.state && this.state.regime;
      const end = r && ((r.id === 'fallen' && r.fall && R(this).queue.some((q) => q.id === 'downfall')) || (r.lifeOver && R(this).queue.some((q) => q.id === 'kia')));
      if (end) {
        this.morningNotes = [];
        this.lastMorning = null;
        this.toasts = [];
        if (typeof this.fadeIn === 'function') await this.fadeIn(20);
        await flush(this);
        // back to the title: the page is reloading. Nothing of the ordinary morning follows (the sleep never ends).
        if ((r.fall || r.lifeOver || {}).toTitle === 'reload') await new Promise(() => {});
      }
    } catch (e) { console.error(e); }
    return res;
  });
  // no toasts once the regime has fallen (only the downfall and the record are shown)
  wrap('notify', (orig) => function (...a) {
    try { if (this.state && this.state.regime && (this.state.regime.id === 'fallen' || this.state.regime.lifeOver)) return undefined; } catch (e) { /* ignore */ }
    return orig.apply(this, a);
  });
  // work stops for a few days when a disaster hits the player's town
  wrap('lifeRefusal', (orig) => function (...a) {
    const why = orig.apply(this, a);
    if (why) return why;
    try {
      const r = this.state && this.state.regime;
      if (r && r.war && r.war.player && r.war.phase === 'war') return '前線にいる。いまはお仕事どころではない。\n（任務が終わるまで、ふだんの暮らしには戻れない）';
      if (r && num(r.cancelUntil) >= today(this) && r.disaster) return `${r.disaster.name}の影響で、交通機関が止まっている。\n今日のお仕事やレッスンは、すべて中止になった。`;
    } catch (e) { console.error(e); }
    return null;
  });
  // elections and the Diet under the dictatorship: what the politics core would otherwise allow
  const held = (g, what) => {
    const r = g.state && g.state.regime;
    if (!r) return null;
    if (what === 'election' && r.steps && r.steps.elections && r.id !== 'democracy') return '選挙は無期限に延期されている';
    if (what === 'diet' && r.steps && r.steps.diet && r.id !== 'democracy') return '国会は止められている';
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
  wrap('message', (orig) => function (msg, ...a) {
    try {
      const st = this.state;
      if (msg && !msg.war && msg.person && st && st.people && st.people[msg.person] && st.people[msg.person].kia) return null;
    } catch (e) { /* ignore */ }
    return orig.call(this, msg, ...a);
  });
  wrapCoalition(proto);
}
// A person who died in the war (or is at the front) is not standing in their usual place on the map.
function hiddenPerson(g, id) {
  try {
    const st = g && g.state;
    if (!st || !st.people || !st.people[id]) return false;
    if (st.people[id].kia) return true;
    const w = st.regime && st.regime.war;
    return !!(w && w.phase === 'war' && (w.known || []).some((k) => k.person === id && (k.status === 'front' || k.status === 'called' || k.status === 'wounded')));
  } catch (e) { return false; }
}
if (MapScene && MapScene.prototype && typeof MapScene.prototype.visible === 'function' && !MapScene.prototype.visible.__regime) {
  const vis0 = MapScene.prototype.visible;
  const vis = function (e) { if (e && e.person && hiddenPerson(this.g, e.person)) return false; return vis0.call(this, e); };
  vis.__regime = true;
  MapScene.prototype.visible = vis;
}
// The real-party coalition rule on the politics core's own entry points (defence in depth: politics.js / the UIs may
// call g.regimeCoalitionBlock themselves too). formCabinet({ partners }) by the player PM: a requested real partner the
// rule refuses → { ok: false, why, refused } and nothing changes; without partners, a refused real party already in the
// coalition is dropped (its ministries refilled). joinCoalition(): a real core refuses the player's party → the reason.
function wrapCoalition(proto) {
  const wrap = (name, make) => {
    const orig = proto[name];
    if (typeof orig !== 'function' || orig.__regime) return;
    const w = make(orig);
    w.__regime = true;
    proto[name] = w;
  };
  wrap('formCabinet', (orig) => function (choices = {}, ...a) {
    try {
      const p = this.state ? pol(this) : null;
      if (p && p.cabinet && p.cabinet.pm === 'player') {
        const mine = (p.me && p.me.party) || undefined;
        const asked = choices && Array.isArray(choices.partners);
        const list = asked ? choices.partners : (p.cabinet.partyIds || []).filter((id) => id !== mine);
        const f = coalitionFilter(this, mine, list);
        if (f.refused.length) {
          if (asked) {
            this.lastPoliticsError = f.refused[0].why;
            return { ok: false, why: f.refused.map((x) => x.why).join('\n'), refused: f.refused };
          }
          dropPartners(this, f.refused.map((x) => x.id), (id) => (f.refused.find((x) => x.id === id) || {}).why);
        }
      }
    } catch (e) { console.error(e); }
    return orig.call(this, choices, ...a);
  });
  // an offered cabinet post (入閣の打診) is refused for the barred former PM (defence in depth: politics.js is to check
  // g.regimeBarred itself before offering / appointing)
  wrap('respondOffer', (orig) => function (offerId, yes = true, ...a) {
    try {
      if (yes && this.state && this.state.regime) {
        const why = barredReason(this, 'player');
        const p = why ? pol(this) : null;
        const o = p && p.me && Array.isArray(p.me.offers) ? p.me.offers.find((x) => (offerId ? x.id === offerId : !x.answered) && !x.answered) : null;
        if (o && o.kind === 'post') { o.answered = 'no'; this.lastPoliticsError = why; return why; }
      }
    } catch (e) { console.error(e); }
    return orig.call(this, offerId, yes, ...a);
  });
  wrap('joinCoalition', (orig) => function (...a) {
    try {
      const p = this.state ? pol(this) : null;
      const mine = p && p.me && p.me.party;
      if (p && p.cabinet && mine) {
        const G = govParties(this);
        const core = G && G.core;
        const why = (core && regimeCoalitionBlock(this, core, { core, partner: mine })) || regimeCoalitionBlock(this, mine, { core: core || undefined, partner: mine });
        if (why) { this.lastPoliticsError = why; return why; }
      }
    } catch (e) { console.error(e); }
    return orig.apply(this, a);
  });
}

onMorning((g) => regimeTick(g));
installRegime(Game.prototype);
if (typeof window !== 'undefined') window.__regime = { R, KIKI, startDisaster, fall, endWar, setRegimeRng, regimeLabel, queueScene, flush, FICTIONAL_NATIONS, trialDue, barredReason, warReport, playerKIA, battleOdds, breakaway, runBattle, needsBreak, enemyInfo };
