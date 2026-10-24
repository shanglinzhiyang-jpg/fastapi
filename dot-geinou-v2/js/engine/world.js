// 世界情勢コア (WORLD AFFAIRS CORE): real countries by era (existence, names, titles of their leaders — never their
// names), relations (−100..100) with Japan and with each other, blocs (the cold war, the post-cold-war world, the new
// tension), alliances, treaties, summits (G7/G8/G20, APEC, 国連総会), trade agreements, sanctions, aid, territorial
// disputes (described with both sides' positions), world events (crises, coups, wars between other countries, oil and
// financial shocks — instances made by the game), the diplomacy of the PM / 外務大臣 / 防衛大臣, troop deployments
// (PKO, 後方支援, 集団的自衛権, 派兵) and the entry points of a war (宣戦布告 / 参戦 / 講和) — the war itself is run by
// regime.js. Effects reach Japan's economy, security and the cabinet's approval through the politics core
// (feature-detected). The screen and the phone app 「世界」 are in world_ui.js.
//
// ---------------------------------------------------------------- rules (see the round-4 brief)
// - Real countries take part (diplomacy, blocs, alliances, trade, sanctions, summits, the UN, deployment, war). Their
//   heads of state / government are never named: only titles (「アメリカ大統領」). No nationality is insulted or
//   dehumanised; the costs of a war are shown on every side. There are no options for weapons of mass destruction
//   or the persecution of a people — such options simply do not exist.
// - Nothing is refused for being "bad": every action shows its odds, costs and consequences. A structural fact (a
//   law that is not in force, no diplomatic ties, the wrong office) is explained together with the path that leads
//   there (a bill, an amendment, a treaty, the office).
// - Real history up to the era's start is fact; after the start the institutions change on their real dates (the
//   Soviet Union ends in 1991-12, Germany reunites in 1990-10, the EU begins in 1993-11, …) while crises, coups and
//   wars are the game's own instances. The NPC governments follow the real trade and security agreements of the
//   time with some probability (as govt.js does with the tax history).
// - Territorial disputes are described factually with each side's position.
//
// ---------------------------------------------------------------- API (installWorld(Game.prototype); self-installs on import)
// exports: COUNTRIES, COUNTRY_ORDER, ORGS, DISPUTES, ALLIANCES, TREATIES, DIPLO, DIPLO_ORDER, WORLD_EVENTS,
//   onWorld(event, fn) → unsubscribe, worldTick(g), newWorldState(g), installWorld(proto), setWorldRng(fn),
//   countryInfo(g, id), countriesNow(g), relation(g, id), pairRelation(g, a, b), blocOf(g, id), BLOC_INFO,
//   alliesOf(g, id), japanAllies(g), worldDate(g), dateNum(g), onJapanWar(g, kind, war) (regime.js calls it),
//   attackOnJapan(g), hasTies(g, id), MAP_POS (lat/lon of each capital, for the map)
// g.world() → summary { date, tension, tensionLabel, coldWar, standing, oil, threat, blocs, countries[], alliances[],
//   treaties[], sanctions, conflicts[], crises[], deployments[], disputes[], summits[], unsc, attack, news[] }
// g.worldCountry(id) → detail (relation, bloc, leader title, government, trade share, treaties, alliances, dispute,
//   nuclear, membership, note, history[])
// g.diplomacy(kind, target, opts) → { ok, why?, success?, text, odds? }; g.diplomacyActions(target?) → list with why,
//   odds, preview lines; g.diplomacyPreview(kind, target, opts) → { why, odds, lines[], options? }
// g.worldNews(n), g.worldEvent(kind, opts) (tests / debug), g.worldTick()
// State: g.state.world (old saves get the defaults).

import { Game } from './game.js';
import { onMorning } from './life.js';
import { clamp } from './util.js';

// ======================================================================== optional modules (guarded)
let POL = null; // politics.js
let REG = null; // regime.js
let IDEO = null;
import('./politics.js').then((m) => { POL = m; }).catch(() => { POL = null; });
import('./regime.js').then((m) => { REG = m; hookRegime(); }).catch(() => { REG = null; });
import('../registry.js').then((reg) => {
  const list = (reg && reg.MODULES) || [];
  if (list.includes('./engine/ideology.js')) import('./ideology.js').then((m) => { IDEO = m; }).catch(() => { IDEO = null; });
}).catch(() => {});

// ======================================================================== helpers
let RNG = Math.random;
export function setWorldRng(fn) { RNG = typeof fn === 'function' ? fn : Math.random; }
const rnd = () => RNG();
const roll = (p) => rnd() < p;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (a) => a[Math.floor(rnd() * a.length)];
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const today = (g) => (g && g.state && g.state.day) || 1;
const n0 = (n) => Math.max(0, Math.round(num(n))).toLocaleString('ja-JP');
const MONTH_DAYS = 10;
const YEAR_DAYS = 120;
const ERA_START = { showa: 19870401, heisei_early: 19960401, heisei: 20040401, reiwa: 20260401 };
const eraOf = (g) => (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
// The game's date (the politics core's calendar when present: 1 month = 10 days, dom 1,4,…,28).
export function worldDate(g, day) {
  if (g && typeof g.gameDate === 'function') {
    try { const d = day == null ? g.gameDate() : g.gameDate(day); if (d && Number.isFinite(d.year)) return { year: d.year, month: clamp(Math.round(d.month || 1), 1, 12), dom: clamp(Math.round(d.dom || 1), 1, 31) }; } catch (e) { /* fall back */ }
  }
  const n = Math.max(0, num(day ?? today(g), 1) - 1);
  const idx = 3 + Math.floor(n / MONTH_DAYS);
  const y0 = Math.floor(ERA_START[eraOf(g)] / 10000) || 2026;
  return { year: y0 + Math.floor(idx / 12), month: (idx % 12) + 1, dom: (n % MONTH_DAYS) * 3 + 1 };
}
export const dateNum = (g, day) => { const d = worldDate(g, day); return d.year * 10000 + d.month * 100 + d.dom; };
const fyear = (g) => { const d = worldDate(g); return d.year + (d.month - 1) / 12 + (d.dom - 1) / 365; };
const dateText = (g, day) => { const d = worldDate(g, day); return `${d.year}年${d.month}月`; };
const since = (g, n) => dateNum(g) >= n;
// [[year, v], …] → the value at a (fractional) year (linear between anchors, flat outside)
function interp(anchors, y) {
  if (!Array.isArray(anchors) || !anchors.length) return 0;
  if (y <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [y1, v1] = anchors[i];
    if (y <= y1) { const [y0, v0] = anchors[i - 1]; return v0 + ((v1 - v0) * (y - y0)) / Math.max(0.0001, y1 - y0); }
  }
  return anchors[anchors.length - 1][1];
}
// [[yyyymmdd, value], …] (from that date) → the value at the date n
function byDate(list, n) {
  if (!Array.isArray(list)) return list;
  let v = list.length ? list[0][1] : null;
  for (const [d, x] of list) if (n >= d) v = x;
  return v;
}

// ======================================================================== countries
// Facts (web-checked 2026-10; the rest is general knowledge stated as 目安 where it is a rough figure):
// - ソ連の解体 1991年12月25〜26日（ロシア連邦が継承。日本は12月27日に承認）。ウクライナは1991年8月24日に独立を宣言。
// - ドイツ統一 1990年10月3日。ベルリンの壁の開放 1989年11月9日。マルタ会談（冷戦の終結を宣言）1989年12月。
// - EU（欧州連合）1993年11月1日（マーストリヒト条約）。英国のEU離脱 2020年1月31日。WTO 1995年1月1日。
// - ASEAN: ベトナム加盟 1995年7月、東ティモール 2025年10月26日（11か国目）。APEC 1989年発足・首脳会議 1993年から。
// - G8: ロシアが1998年から正式に参加、2014年3月から参加停止（G7）。G20首脳会議 2008年11月から。
// - G7の議長国（サミット）: 1987 イタリア → 1988 カナダ → … の順番（2006年はロシアがG8議長国、2014年はブリュッセル）。
//   2026年 フランス（エビアン、6月）。日本の開催: 1993・2000（九州・沖縄）・2008（洞爺湖）・2016（伊勢志摩）・2023（広島）。
// - 日米安保条約（1960年）第5条（日本の施政下の領域への武力攻撃への共同対処）・第6条（駐留）・第10条（10年ののちは、
//   いずれかが終了の意思を通告すれば1年後に終了）。日ソ共同宣言 1956年。日韓基本条約 1965年。日中共同声明 1972年・
//   日中平和友好条約 1978年。日朝平壌宣言 2002年9月。台湾とは1972年に断交（窓口は交流協会 → 2017年から日本台湾交流協会）。
// - 経済連携協定: シンガポール 2002年11月（日本で最初）、マレーシア 2006年7月、タイ 2007年11月、インドネシア 2008年7月、
//   フィリピン 2008年12月、日ASEAN 2008年12月、ベトナム 2009年10月、インド 2011年8月、オーストラリア 2015年1月、
//   CPTPP（TPP11）2018年12月30日、日EU 2019年2月1日、日米貿易協定 2020年1月1日、日英 2021年1月1日、RCEP 2022年1月1日。
// - 安全保障: 日豪安保共同宣言 2007年3月、日印 2008年10月。円滑化協定: 豪 2023年8月13日、英 2023年10月11日、
//   フィリピン 2025年9月11日（2024年7月署名）。クアッド首脳会合 2021年3月から。AUKUS 2021年9月。
// - 法律: PKO協力法 1992年8月施行、国際緊急援助隊法 1987年9月（自衛隊の参加は1992年から）、周辺事態法 1999年8月、
//   在外邦人の輸送に自衛隊機を使える改正 1994年11月、外為法の改正（日本独自の判断で経済制裁）2004年2月、平和安全法制
//   2015年9月成立・2016年3月29日施行（存立危機事態での限定的な集団的自衛権、重要影響事態法、国際平和支援法）。
// - 日本の国連安保理・非常任理事国: 1987〜88, 1992〜93, 1997〜98, 2005〜06, 2009〜10, 2016〜17, 2023〜24（選挙は2016年から6月）。
// - 北朝鮮への日本独自の制裁: 2006年（輸入の全面禁止）・2009年（輸出の全面禁止）。ロシアへの制裁: 2022年2月から（G7と協調）。
// - 2022年2月24日、ロシアがウクライナに侵攻。国連総会は2022年3月2日、ロシアに即時撤退を求める決議を採択（賛成141）。
//   2026年春の時点で戦闘は続いている（短い休戦はあった）。
// sources: mofa.go.jp（各国・地域情勢、条約・EPA、円滑化協定 pressit_000001_02555）, mod.go.jp, g7.utoronto.ca（2026 Évian
//   June 15–17）, asean.org（Timor-Leste 2025-10-26）, kotobank, nippon.com, Wikipedia（各年表）.
// Figures (GDP in 兆ドル, military index, Japan's trade share %) are rounded 目安 for the game.
const A = (...pairs) => pairs; // anchors [[year, v], …]
function C(id, def) { return { id, real: true, region: 'asia', from: 0, to: 0, p5: false, ...def }; }
export const COUNTRIES = {
  us: C('us', { name: 'アメリカ合衆国', short: '米国', leader: 'アメリカ大統領', gov: '連邦共和制（大統領制）', region: 'americas', p5: true, capital: [38.9, -77.0],
    gdp: A([1987, 4.9], [1996, 8.1], [2004, 12.2], [2026, 30.5]), mil: A([1987, 100], [2026, 100]), trade: A([1987, 30], [1996, 25], [2004, 19], [2026, 14.5]), rel: A([1987, 62], [1996, 70], [2004, 85], [2026, 85]),
    nuclear: 'nws', member: ['g7', 'nato', 'apec'],
    note: [[0, '日米安保条約の同盟国で、最大の貿易相手。自動車や半導体をめぐる貿易摩擦が続いている。'], [19960101, '日米安保条約の同盟国。1996年4月の日米安保共同宣言で同盟の意義を再確認した。'], [20040101, '日米安保条約の同盟国。テロとの戦いやイラクの復興で協力している。'], [20260101, '日米安保条約の同盟国。中国に次ぐ貿易相手で、安全保障でも最も深く協力している。']] }),
  cn: C('cn', { name: '中華人民共和国', short: '中国', leader: '中国の国家主席', gov: '社会主義の一党体制（中国共産党）', p5: true, capital: [39.9, 116.4],
    gdp: A([1987, 0.27], [1996, 0.86], [2004, 1.96], [2026, 19.5]), mil: A([1987, 45], [1996, 50], [2004, 58], [2026, 82]), trade: A([1987, 3.5], [1996, 9], [2004, 17], [2026, 20]), rel: A([1987, 38], [1996, 15], [2004, 0], [2026, -30]),
    nuclear: 'nws', member: ['apec'], dispute: 'senkaku',
    note: [[0, '1972年に国交正常化、1978年に日中平和友好条約。改革開放で経済が伸び、日本は円借款で協力している。'], [19960101, '経済が急成長している。1995〜96年に核実験や台湾海峡での軍事演習があった。'], [20040101, '貿易で米国と並ぶほどの相手になった。歴史認識などをめぐり政治の関係は冷えこんでいる。'], [20260101, '日本の最大の貿易相手。尖閣諸島をめぐる対立や軍備の増強に、日本は警戒を強めている。']] }),
  su: C('su', { name: 'ソビエト社会主義共和国連邦', short: 'ソ連', leader: [[0, 'ソ連共産党書記長'], [19900315, 'ソ連大統領']], gov: '社会主義の一党体制（ソ連共産党）', region: 'europe', p5: true, capital: [55.75, 37.6], to: 19911226, successor: 'ru',
    gdp: A([1987, 2.0]), mil: A([1987, 95], [1991, 85]), trade: A([1987, 1.3]), rel: A([1987, -35], [1991, -5]), nuclear: 'nws', member: ['warsaw'], dispute: 'northern',
    note: [[0, '冷戦の相手。北方領土を実効支配し、平和条約は結ばれていない（1956年の日ソ共同宣言で国交を回復）。ペレストロイカ（改革）が進んでいる。']] }),
  ru: C('ru', { name: 'ロシア連邦', short: 'ロシア', leader: 'ロシア大統領', gov: '連邦共和制（大統領制）', region: 'europe', p5: true, capital: [55.75, 37.6], from: 19911226,
    gdp: A([1992, 0.46], [1996, 0.39], [2004, 0.59], [2026, 2.1]), mil: A([1992, 80], [1996, 60], [2004, 62], [2026, 72]), trade: A([1992, 1.0], [1996, 0.5], [2004, 0.8], [2026, 1.0]), rel: A([1992, 10], [1996, 0], [2004, 10], [2026, -60]),
    nuclear: 'nws', member: ['apec'], dispute: 'northern',
    note: [[0, 'ソ連を継いだ国（1991年12月）。北方領土の問題が続き、平和条約はまだない。'], [20220301, '2022年2月のウクライナ侵攻以来、日本はG7とともに制裁を科している。ロシアは日本を「非友好国」に指定した。']] }),
  kr: C('kr', { name: '大韓民国', short: '韓国', leader: '韓国大統領', gov: '共和制（大統領制）', capital: [37.57, 126.98],
    gdp: A([1987, 0.15], [1996, 0.6], [2004, 0.76], [2026, 1.9]), mil: A([1987, 30], [2004, 36], [2026, 42]), trade: A([1987, 5.5], [1996, 6], [2004, 6.5], [2026, 5.5]), rel: A([1987, 30], [1996, 25], [2004, 32], [2026, 35]),
    member: ['apec'], dispute: 'takeshima',
    note: [[0, '1965年の日韓基本条約で国交。1987年6月に民主化宣言。経済の結びつきが強い。'], [19960101, '経済の結びつきが強い一方、歴史認識や竹島をめぐる対立もある。'], [20260101, '経済・文化の交流が深く、安全保障でも米国をはさんで協力している。歴史認識や竹島をめぐる対立は続いている。']] }),
  kp: C('kp', { name: '朝鮮民主主義人民共和国', short: '北朝鮮', leader: '北朝鮮の最高指導者', gov: '朝鮮労働党の一党支配', capital: [39.03, 125.75], noTies: true,
    gdp: A([1987, 0.02], [2026, 0.02]), mil: A([1987, 30], [2026, 26]), trade: A([1987, 0.1], [2004, 0.05], [2006, 0], [2026, 0]), rel: A([1987, -50], [1996, -40], [2004, -70], [2026, -80]),
    nuclear: [[0, null], [20061009, 'test']], member: [],
    note: [[0, '日本と国交はない。'], [20021001, '日本と国交はない。2002年の日朝首脳会談で日本人の拉致を認めた（日朝平壌宣言）。核・ミサイルの開発を続けている。'], [20091001, '日本と国交はない。核・ミサイル開発で国連の制裁を受け、日本は独自の制裁で輸出入を全面的に止めている。拉致問題は解決していない。']] }),
  tw: C('tw', { name: '台湾', short: '台湾', leader: '台湾の総統', gov: [[0, '国民党の一党体制（1987年7月に戒厳令を解除）'], [19960323, '民主的な選挙（1996年から総統の直接選挙）']], capital: [25.03, 121.56], noTies: true,
    gdp: A([1987, 0.1], [1996, 0.3], [2004, 0.35], [2026, 0.85]), mil: A([1987, 25], [2026, 26]), trade: A([1987, 4.5], [1996, 5.5], [2004, 5.5], [2026, 6.5]), rel: A([1987, 40], [2004, 50], [2026, 62]),
    member: ['apec'],
    note: [[0, '1972年の日中国交正常化で日本と断交し、民間の窓口（交流協会）で関係を続けている。'], [20170101, '国交はないが、経済や人の往来は深い（窓口は日本台湾交流協会）。']] }),
  gb: C('gb', { name: 'イギリス（英国）', short: '英国', leader: 'イギリス首相', gov: '立憲君主制（議院内閣制）', region: 'europe', p5: true, capital: [51.5, -0.12],
    gdp: A([1987, 0.7], [1996, 1.4], [2004, 2.4], [2026, 3.9]), mil: A([1987, 35], [2026, 35]), trade: A([1987, 2.5], [1996, 2.3], [2004, 1.8], [2026, 1.2]), rel: A([1987, 58], [2004, 65], [2026, 72]),
    nuclear: 'nws', member: [[0, ['g7', 'nato', 'ec']], [19931101, ['g7', 'nato', 'eu']], [20200131, ['g7', 'nato']]],
    note: [[0, 'G7の一員。日本企業の進出先として欧州で最大級。'], [20230101, 'G7の一員。2023年に日英円滑化協定に署名し、安全保障の協力を深めている。']] }),
  fr: C('fr', { name: 'フランス', short: 'フランス', leader: 'フランス大統領', gov: '共和制（半大統領制）', region: 'europe', p5: true, capital: [48.85, 2.35],
    gdp: A([1987, 0.9], [1996, 1.6], [2004, 2.1], [2026, 3.3]), mil: A([1987, 35], [2026, 34]), trade: A([1987, 1.3], [2026, 1.0]), rel: A([1987, 50], [2026, 60]),
    nuclear: 'nws', member: [[0, ['g7', 'nato', 'ec']], [19931101, ['g7', 'nato', 'eu']]], note: [[0, 'G7の一員。文化や技術の交流が深い。']] }),
  wde: C('wde', { name: 'ドイツ連邦共和国（西ドイツ）', short: '西ドイツ', leader: '西ドイツ首相', gov: '連邦共和制（議院内閣制）', region: 'europe', capital: [50.73, 7.1], to: 19901003, successor: 'de',
    gdp: A([1987, 1.2]), mil: A([1987, 30]), trade: A([1987, 4.5]), rel: A([1987, 58]), member: ['g7', 'nato', 'ec'], note: [[0, 'G7の一員。東西に分かれたドイツの西側。']] }),
  dde: C('dde', { name: 'ドイツ民主共和国（東ドイツ）', short: '東ドイツ', leader: '東ドイツ国家評議会議長', gov: '社会主義の一党体制（社会主義統一党）', region: 'europe', capital: [52.52, 13.4], to: 19901003, successor: 'de',
    gdp: A([1987, 0.2]), mil: A([1987, 15]), trade: A([1987, 0.1]), rel: A([1987, -10]), member: ['warsaw'], note: [[0, '東西に分かれたドイツの東側。日本とは1973年に国交を結んだ。']] }),
  de: C('de', { name: 'ドイツ連邦共和国', short: 'ドイツ', leader: 'ドイツ首相', gov: '連邦共和制（議院内閣制）', region: 'europe', capital: [52.52, 13.4], from: 19901003,
    gdp: A([1991, 1.9], [1996, 2.5], [2004, 2.8], [2026, 4.9]), mil: A([1991, 32], [2026, 32]), trade: A([1991, 4.5], [1996, 4], [2004, 2.8], [2026, 2.8]), rel: A([1991, 58], [2026, 62]),
    member: [[0, ['g7', 'nato', 'ec']], [19931101, ['g7', 'nato', 'eu']]], note: [[0, 'G7の一員。1990年10月に東西ドイツが統一した。']] }),
  it: C('it', { name: 'イタリア', short: 'イタリア', leader: 'イタリア首相', gov: '共和制（議院内閣制）', region: 'europe', capital: [41.9, 12.5],
    gdp: A([1987, 0.8], [1996, 1.3], [2004, 1.8], [2026, 2.5]), mil: A([1987, 20], [2026, 22]), trade: A([1987, 1.0], [2026, 0.9]), rel: A([1987, 50], [2026, 58]),
    member: [[0, ['g7', 'nato', 'ec']], [19931101, ['g7', 'nato', 'eu']]], note: [[0, 'G7の一員。']] }),
  ca: C('ca', { name: 'カナダ', short: 'カナダ', leader: 'カナダ首相', gov: '立憲君主制（議院内閣制）', region: 'americas', capital: [45.42, -75.7],
    gdp: A([1987, 0.43], [1996, 0.63], [2004, 1.02], [2026, 2.3]), mil: A([1987, 12], [2026, 13]), trade: A([1987, 2.5], [2004, 1.4], [2026, 1.3]), rel: A([1987, 58], [2026, 64]),
    member: ['g7', 'nato', 'apec'], note: [[0, 'G7の一員。資源や食料の輸入先。']] }),
  in: C('in', { name: 'インド', short: 'インド', leader: 'インド首相', gov: '連邦共和制（議院内閣制）', capital: [28.61, 77.21],
    gdp: A([1987, 0.28], [1996, 0.39], [2004, 0.71], [2026, 4.3]), mil: A([1987, 35], [2004, 42], [2026, 52]), trade: A([1987, 0.8], [2004, 0.7], [2026, 1.5]), rel: A([1987, 30], [2004, 40], [2026, 62]),
    nuclear: [[0, 'test74'], [19980511, 'test']], member: [],
    note: [[0, '非同盟の大国。日本はODAで協力している。'], [20110801, '2011年に経済連携協定。日米豪印の枠組み（クアッド）でも協力している。']] }),
  id: C('id', { name: 'インドネシア', short: 'インドネシア', leader: 'インドネシア大統領', gov: [[0, '長期政権の大統領制'], [19990101, '共和制（大統領制）']], capital: [-6.2, 106.85],
    gdp: A([1987, 0.08], [1996, 0.23], [2004, 0.26], [2026, 1.5]), mil: A([1987, 15], [2026, 18]), trade: A([1987, 3], [1996, 3.5], [2004, 2.5], [2026, 2.5]), rel: A([1987, 50], [2026, 62]),
    member: ['asean', 'apec'], note: [[0, 'ASEANの大国。石油・天然ガスの輸入先で、日本の援助の最大の受け取り国の一つ。']] }),
  ph: C('ph', { name: 'フィリピン', short: 'フィリピン', leader: 'フィリピン大統領', gov: '共和制（大統領制）', capital: [14.6, 120.98],
    gdp: A([1987, 0.03], [1996, 0.08], [2004, 0.09], [2026, 0.5]), mil: A([1987, 6], [2026, 9]), trade: A([1987, 0.8], [2026, 1.5]), rel: A([1987, 45], [2026, 66]),
    member: ['asean', 'apec'], note: [[0, 'ASEANの一員。1986年に民主化した。'], [20250911, 'ASEANの一員。2025年9月に日比円滑化協定が発効し、安全保障の協力が進んでいる。']] }),
  vn: C('vn', { name: 'ベトナム', short: 'ベトナム', leader: 'ベトナム共産党書記長', gov: '社会主義の一党体制（ベトナム共産党）', capital: [21.03, 105.85],
    gdp: A([1987, 0.03], [1996, 0.025], [2004, 0.05], [2026, 0.5]), mil: A([1987, 35], [1996, 25], [2026, 25]), trade: A([1987, 0.1], [1996, 0.5], [2004, 1.0], [2026, 3.5]), rel: A([1987, 0], [1996, 30], [2004, 45], [2026, 60]),
    member: [[0, []], [19950728, ['asean']], [19981114, ['asean', 'apec']]], note: [[0, '1986年からドイモイ（刷新）政策。カンボジア問題で日本の援助は止まっている。'], [19960101, 'ASEANに加盟（1995年）。日本の援助と投資で経済が伸びている。']] }),
  th: C('th', { name: 'タイ', short: 'タイ', leader: 'タイ首相', gov: '立憲君主制', capital: [13.75, 100.5],
    gdp: A([1987, 0.05], [1996, 0.18], [2004, 0.17], [2026, 0.55]), mil: A([1987, 12], [2026, 12]), trade: A([1987, 1.3], [1996, 3.5], [2004, 3.2], [2026, 3.5]), rel: A([1987, 60], [2026, 62]),
    member: ['asean', 'apec'], note: [[0, 'ASEANの一員。日本企業の工場が多く集まる。']] }),
  sg: C('sg', { name: 'シンガポール', short: 'シンガポール', leader: 'シンガポール首相', gov: '共和制（議院内閣制）', capital: [1.29, 103.85],
    gdp: A([1987, 0.02], [1996, 0.1], [2004, 0.11], [2026, 0.56]), mil: A([1987, 6], [2026, 10]), trade: A([1987, 2], [1996, 3.5], [2004, 2.4], [2026, 2]), rel: A([1987, 60], [2026, 66]),
    member: ['asean', 'apec'], note: [[0, 'ASEANの一員。アジアの金融・物流の中心。'], [20021130, 'ASEANの一員。2002年、日本で最初の経済連携協定を結んだ相手。']] }),
  my: C('my', { name: 'マレーシア', short: 'マレーシア', leader: 'マレーシア首相', gov: '立憲君主制（議院内閣制）', capital: [3.14, 101.69],
    gdp: A([1987, 0.03], [1996, 0.1], [2004, 0.13], [2026, 0.47]), mil: A([1987, 6], [2026, 8]), trade: A([1987, 1.8], [1996, 3], [2004, 2.5], [2026, 2]), rel: A([1987, 55], [2026, 60]),
    member: ['asean', 'apec'], note: [[0, 'ASEANの一員。1981年から日本に学ぶ「ルック・イースト政策」をとっている。']] }),
  au: C('au', { name: 'オーストラリア', short: '豪州', leader: 'オーストラリア首相', gov: '立憲君主制（議院内閣制）', region: 'oceania', capital: [-35.28, 149.13],
    gdp: A([1987, 0.2], [1996, 0.4], [2004, 0.6], [2026, 1.9]), mil: A([1987, 12], [2026, 18]), trade: A([1987, 3.5], [2004, 3], [2026, 4.5]), rel: A([1987, 50], [2004, 65], [2026, 76]),
    member: ['apec'], note: [[0, '石炭・鉄鉱石などの資源の輸入先。'], [20070313, '資源の輸入先。2007年の日豪安保共同宣言から、安全保障でも協力している。'], [20230813, '「準同盟国」とも呼ばれる安全保障の協力相手（円滑化協定 2023年）。資源の輸入先。']] }),
  sa: C('sa', { name: 'サウジアラビア', short: 'サウジ', leader: 'サウジアラビア国王', gov: '絶対君主制', region: 'mideast', capital: [24.71, 46.68],
    gdp: A([1987, 0.09], [1996, 0.16], [2004, 0.26], [2026, 1.1]), mil: A([1987, 15], [2026, 25]), trade: A([1987, 3], [1996, 2], [2004, 2.5], [2026, 2.5]), rel: A([1987, 50], [2026, 52]),
    member: ['opec'], oil: true, note: [[0, '日本の最大の原油の輸入先。']] }),
  ir: C('ir', { name: 'イラン', short: 'イラン', leader: 'イラン大統領', gov: 'イスラム共和制', region: 'mideast', capital: [35.69, 51.39],
    gdp: A([1987, 0.1], [1996, 0.1], [2004, 0.16], [2026, 0.4]), mil: A([1987, 30], [2026, 30]), trade: A([1987, 0.8], [2004, 1.0], [2026, 0.1]), rel: A([1987, 22], [2004, 25], [2026, 10]),
    member: ['opec'], oil: true, note: [[0, 'イラクと戦争中（1980年〜）。日本は双方と関係を保っている。'], [19890101, '産油国。日本は伝統的に対話の窓口を保ってきた。'], [20060101, '核開発をめぐり欧米と対立している。日本は伝統的に対話の窓口を保ってきた。']] }),
  iq: C('iq', { name: 'イラク', short: 'イラク', leader: [[0, 'イラク大統領'], [20050401, 'イラク首相']], gov: [[0, 'バアス党の一党支配'], [20030501, '移行期（多国籍軍の駐留）'], [20060101, '共和制（議院内閣制）']], region: 'mideast', capital: [33.31, 44.36],
    gdp: A([1987, 0.05], [1996, 0.02], [2004, 0.04], [2026, 0.27]), mil: A([1987, 40], [1990, 45], [1996, 18], [2004, 8], [2026, 12]), trade: A([1987, 0.3], [1996, 0], [2004, 0.1], [2026, 0.3]), rel: A([1987, 12], [1996, -30], [2004, 5], [2026, 22]),
    member: ['opec'], oil: true, note: [[0, 'イランと戦争中（1980年〜）。'], [19910301, '1990年のクウェート侵攻以来、国連の経済制裁を受けている。'], [20030501, '2003年のイラク戦争のあと、多国籍軍が駐留している。'], [20120101, '戦争のあとの復興が続く産油国。']] }),
  il: C('il', { name: 'イスラエル', short: 'イスラエル', leader: 'イスラエル首相', gov: '共和制（議院内閣制）', region: 'mideast', capital: [31.78, 35.0],
    gdp: A([1987, 0.04], [1996, 0.1], [2004, 0.13], [2026, 0.6]), mil: A([1987, 30], [2026, 36]), trade: A([1987, 0.3], [2026, 0.2]), rel: A([1987, 18], [1996, 30], [2026, 30]),
    member: [], note: [[0, '中東の国。パレスチナや周りの国との対立が続いている。']] }),
  tr: C('tr', { name: 'トルコ', short: 'トルコ', leader: [[0, 'トルコ首相'], [20180709, 'トルコ大統領']], gov: [[0, '共和制（議院内閣制）'], [20180709, '共和制（大統領制）']], region: 'europe', capital: [39.93, 32.86],
    gdp: A([1987, 0.1], [1996, 0.18], [2004, 0.4], [2026, 1.4]), mil: A([1987, 30], [2026, 35]), trade: A([1987, 0.2], [2026, 0.3]), rel: A([1987, 50], [2026, 56]),
    member: ['nato'], note: [[0, 'NATOの一員。日本に親しみを持つ人が多い国として知られる。']] }),
  ua: C('ua', { name: 'ウクライナ', short: 'ウクライナ', leader: 'ウクライナ大統領', gov: '共和制（半大統領制）', region: 'europe', capital: [50.45, 30.52], from: 19911226,
    gdp: A([1992, 0.07], [1996, 0.05], [2004, 0.06], [2026, 0.2]), mil: A([1992, 30], [2004, 20], [2022, 30], [2026, 32]), trade: A([1992, 0.1], [2026, 0.1]), rel: A([1992, 25], [2004, 35], [2026, 66]),
    member: [], note: [[0, '1991年にソ連から独立した。'], [20220301, '2022年2月にロシアが侵攻し、戦争が続いている。日本は支援と復興への協力を続けている。']] }),
  br: C('br', { name: 'ブラジル', short: 'ブラジル', leader: 'ブラジル大統領', gov: '連邦共和制（大統領制）', region: 'americas', capital: [-15.79, -47.88],
    gdp: A([1987, 0.29], [1996, 0.85], [2004, 0.67], [2026, 2.3]), mil: A([1987, 15], [2026, 18]), trade: A([1987, 0.8], [2026, 0.7]), rel: A([1987, 48], [2026, 52]),
    member: [], note: [[0, '日系人が多く暮らす国（約200万人とされる）。']] }),
};
export const COUNTRY_ORDER = Object.keys(COUNTRIES);
// International organisations (targets of some actions; not on the map).
export const ORGS = {
  un: { id: 'un', name: '国際連合', short: '国連', leader: '国連事務総長', from: 0 },
  ec: { id: 'ec', name: '欧州共同体（EC）', short: 'EC', leader: '欧州委員会委員長', to: 19931101, successor: 'eu', members: ['gb', 'fr', 'wde', 'it'] },
  eu: { id: 'eu', name: '欧州連合（EU）', short: 'EU', leader: [[0, '欧州委員会委員長'], [20091201, '欧州理事会議長']], from: 19931101, members: [[0, ['gb', 'fr', 'de', 'it']], [20200131, ['fr', 'de', 'it']]] },
  asean: { id: 'asean', name: '東南アジア諸国連合（ASEAN）', short: 'ASEAN', leader: 'ASEAN議長国の首脳', from: 0, members: [[0, ['id', 'ph', 'th', 'sg', 'my']], [19950728, ['id', 'ph', 'th', 'sg', 'my', 'vn']]] },
};
// Capitals for the map (lat, lon). The fictional nations are not on the real map (world_ui.js shows them in an inset).
export const MAP_POS = Object.fromEntries([...Object.values(COUNTRIES).map((c) => [c.id, c.capital]), ['jp', [35.68, 139.69]]]);

// Territorial disputes (both sides' positions; facts up to the game's date).
export const DISPUTES = {
  northern: {
    id: 'northern', name: '北方領土', other: ['su', 'ru'], admin0: 'ru', pos: [44.0, 146.3],
    lines: (g) => [
      '択捉島・国後島・色丹島・歯舞群島。',
      `1945年から${since(g, 19911226) ? 'ソ連（現在はロシア）' : 'ソ連'}が実効支配している。日本は固有の領土として返還を求めている。`,
      '1956年の日ソ共同宣言は、平和条約を結んだあとに歯舞群島と色丹島を引き渡すとしている。',
      `${since(g, 19911226) ? 'ロシア' : 'ソ連'}は「第二次世界大戦の結果として自国の領土になった」との立場。平和条約はまだ結ばれていない。`,
    ],
  },
  takeshima: {
    id: 'takeshima', name: '竹島', other: ['kr'], admin0: 'kr', pos: [37.24, 131.87],
    lines: () => [
      '日本海の小さな島々（韓国名：独島）。',
      '日本と韓国がそれぞれ自国の領土だと主張している。1954年から韓国が警備隊を置き、実効支配している。',
      '日本は国際司法裁判所での解決を提案してきたが、韓国は応じていない（「領土問題は存在しない」との立場）。',
    ],
  },
  senkaku: {
    id: 'senkaku', name: '尖閣諸島', other: ['cn', 'tw'], admin0: 'jp', pos: [25.75, 123.5],
    lines: (g) => [
      '東シナ海の島々（中国名：釣魚島、台湾名：釣魚台）。',
      '日本が実効支配している。1970年代から中国と台湾が領有を主張している。日本政府は「解決すべき領有権の問題は存在しない」との立場。',
      since(g, 20120911) ? '2012年9月に日本政府が3島を国有化し、そのあと中国の公船が周辺の海域に入ることが続いている。' : null,
    ].filter(Boolean),
  },
};

// Alliances / security pacts (members by date). kind: 'defense' (mutual defence), 'collective' (an organisation),
// 'partnership' (security cooperation without a defence obligation), 'law' (a one-sided commitment by law).
export const ALLIANCES = {
  anpo: { id: 'anpo', name: '日米安全保障条約', short: '日米安保', kind: 'defense', from: 19600623, members: ['jp', 'us'],
    desc: '第5条：日本の施政のもとにある領域への武力攻撃に、日米が共同で対処する。第6条：米軍の日本駐留。第10条：一方が終了を通告すれば1年後に終了する。' },
  nato: { id: 'nato', name: '北大西洋条約機構（NATO）', short: 'NATO', kind: 'collective', from: 19490824, members: [[0, ['us', 'gb', 'fr', 'wde', 'it', 'ca', 'tr']], [19901003, ['us', 'gb', 'fr', 'de', 'it', 'ca', 'tr']]],
    desc: '第5条：加盟国への武力攻撃を全加盟国への攻撃とみなす。' },
  warsaw: { id: 'warsaw', name: 'ワルシャワ条約機構', short: 'ワルシャワ条約', kind: 'collective', from: 19550514, to: 19910701, members: [[0, ['su', 'dde']], [19901003, ['su']]], desc: 'ソ連と東欧の国々の軍事同盟（1991年7月に解散）。' },
  us_kr: { id: 'us_kr', name: '米韓相互防衛条約', short: '米韓同盟', kind: 'defense', from: 19541117, members: ['us', 'kr'], desc: '米軍が韓国に駐留している。' },
  cn_kp: { id: 'cn_kp', name: '中朝友好協力相互援助条約', short: '中朝条約', kind: 'defense', from: 19610911, members: ['cn', 'kp'], desc: '一方が攻撃されたら、もう一方が援助するとしている（1961年）。' },
  su_kp: { id: 'su_kp', name: 'ソ朝友好協力相互援助条約', short: 'ソ朝条約', kind: 'defense', from: 19610910, to: 19960910, members: [[0, ['su', 'kp']], [19911226, ['ru', 'kp']]], desc: '1961年の相互援助条約（1996年に失効）。' },
  ru_kp: { id: 'ru_kp', name: '露朝包括的戦略的パートナーシップ条約', short: '露朝条約', kind: 'defense', from: 20241204, members: ['ru', 'kp'], desc: '一方が武力攻撃を受けたら、もう一方が軍事援助をするとしている（2024年）。' },
  anzus: { id: 'anzus', name: '太平洋安全保障条約（ANZUS）', short: 'ANZUS', kind: 'defense', from: 19520429, members: ['us', 'au'], desc: '米国とオーストラリアの同盟。' },
  us_ph: { id: 'us_ph', name: '米比相互防衛条約', short: '米比同盟', kind: 'defense', from: 19520827, members: ['us', 'ph'], desc: '米国とフィリピンの同盟。' },
  us_tw: { id: 'us_tw', name: '台湾関係法（米国の国内法）', short: '台湾関係法', kind: 'law', from: 19790410, members: ['us', 'tw'], desc: '米国が台湾の防衛に必要な武器を提供するとしている。軍事介入するかどうかは明言していない。' },
  aukus: { id: 'aukus', name: 'AUKUS（米英豪の安全保障の枠組み）', short: 'AUKUS', kind: 'partnership', from: 20210915, members: ['us', 'gb', 'au'], desc: '原子力潜水艦の配備などでの協力。' },
  quad: { id: 'quad', name: '日米豪印（クアッド）', short: 'クアッド', kind: 'partnership', from: 20210312, members: ['jp', 'us', 'au', 'in'], desc: '「自由で開かれたインド太平洋」のための協力の枠組み（同盟ではない）。' },
  jp_au: { id: 'jp_au', name: '日豪の安全保障協力（共同宣言・円滑化協定）', short: '日豪協力', kind: 'partnership', from: 20070313, members: ['jp', 'au'], desc: '2007年の安保共同宣言、2023年の円滑化協定（部隊の往来を円滑にする）。' },
  jp_gb: { id: 'jp_gb', name: '日英円滑化協定', short: '日英協力', kind: 'partnership', from: 20231011, members: ['jp', 'gb'], desc: '自衛隊と英国軍の共同訓練や往来を円滑にする。' },
  jp_ph: { id: 'jp_ph', name: '日比円滑化協定', short: '日比協力', kind: 'partnership', from: 20250911, members: ['jp', 'ph'], desc: '自衛隊とフィリピン軍の共同訓練や往来を円滑にする。' },
};
// Japan's treaties and agreements (real; in force from `from`). kind: 'ties' | 'peace' | 'fta' | 'security' | 'declaration'.
export const TREATIES = {
  jp_su_1956: { name: '日ソ共同宣言', kind: 'ties', with: ['su', 'ru'], from: 19561212 },
  jp_kr_1965: { name: '日韓基本条約', kind: 'ties', with: ['kr'], from: 19651218 },
  jp_cn_1972: { name: '日中共同声明（国交正常化）', kind: 'ties', with: ['cn'], from: 19720929 },
  jp_cn_1978: { name: '日中平和友好条約', kind: 'peace', with: ['cn'], from: 19781023 },
  jp_kp_2002: { name: '日朝平壌宣言', kind: 'declaration', with: ['kp'], from: 20020917 },
  jp_sg_epa: { name: '日本・シンガポール経済連携協定', kind: 'fta', with: ['sg'], from: 20021130, npc: true },
  jp_my_epa: { name: '日本・マレーシア経済連携協定', kind: 'fta', with: ['my'], from: 20060713, npc: true },
  jp_th_epa: { name: '日本・タイ経済連携協定', kind: 'fta', with: ['th'], from: 20071101, npc: true },
  jp_id_epa: { name: '日本・インドネシア経済連携協定', kind: 'fta', with: ['id'], from: 20080701, npc: true },
  jp_ph_epa: { name: '日本・フィリピン経済連携協定', kind: 'fta', with: ['ph'], from: 20081211, npc: true },
  jp_asean: { name: '日ASEAN包括的経済連携協定', kind: 'fta', with: ['asean'], from: 20081201, npc: true },
  jp_vn_epa: { name: '日本・ベトナム経済連携協定', kind: 'fta', with: ['vn'], from: 20091001, npc: true },
  jp_in_epa: { name: '日本・インド包括的経済連携協定', kind: 'fta', with: ['in'], from: 20110801, npc: true },
  jp_au_epa: { name: '日本・オーストラリア経済連携協定', kind: 'fta', with: ['au'], from: 20150115, npc: true },
  cptpp: { name: 'TPP11（CPTPP：環太平洋パートナーシップ）', kind: 'fta', with: ['au', 'ca', 'sg', 'my', 'vn'], from: 20181230, npc: true },
  jp_eu_epa: { name: '日EU経済連携協定', kind: 'fta', with: ['eu'], from: 20190201, npc: true },
  jp_us_trade: { name: '日米貿易協定', kind: 'fta', with: ['us'], from: 20200101, npc: true },
  jp_gb_epa: { name: '日英包括的経済連携協定', kind: 'fta', with: ['gb'], from: 20210101, npc: true },
  rcep: { name: 'RCEP（地域的な包括的経済連携）', kind: 'fta', with: ['cn', 'kr', 'au', 'asean'], from: 20220101, npc: true },
  jp_au_2007: { name: '日豪安全保障協力共同宣言', kind: 'security', with: ['au'], from: 20070313, npc: true },
  jp_in_2008: { name: '日印安全保障協力共同宣言', kind: 'security', with: ['in'], from: 20081022, npc: true },
  jp_au_raa: { name: '日豪円滑化協定', kind: 'security', with: ['au'], from: 20230813, npc: true },
  jp_gb_raa: { name: '日英円滑化協定', kind: 'security', with: ['gb'], from: 20231011, npc: true },
  jp_ph_raa: { name: '日比円滑化協定', kind: 'security', with: ['ph'], from: 20250911, npc: true },
};

// Institutional history on its real date (the game's world follows it; conflicts are the game's own).
const HISTORY = [
  [19871208, 'inf', (g) => { tensionShift(g, -5, true); news(g, '米ソが中距離核戦力（INF）全廃条約に調印した。冷戦の緊張がやわらぎはじめた'); }],
  [19880820, 'iran_iraq_end', (g) => { endConflict(g, 'iran_iraq', 'ceasefire', '国連安保理の決議にもとづき、イラン・イラク戦争の停戦が成立した（1988年8月）'); }],
  [19891109, 'berlin', (g) => { tensionShift(g, -10, true); news(g, '東西ドイツを隔てていた「ベルリンの壁」が開放された'); phone(g, '【国際ニュース】ベルリンの壁が開放された。東欧の国々で体制の変化が続いている。'); }],
  [19891203, 'malta', (g) => { tensionShift(g, -15, true); W(g).coldWar = 'ending'; news(g, '米ソ首脳がマルタで会談し、冷戦の終結を宣言した'); }],
  [19901003, 'unification', (g) => { news(g, '東西ドイツが統一された（ドイツ連邦共和国）'); phone(g, '【国際ニュース】ドイツが統一された。'); }],
  [19910701, 'warsaw_end', (g) => { news(g, 'ワルシャワ条約機構が解散した'); }],
  [19910917, 'korea_un', (g) => { news(g, '韓国と北朝鮮が国連に同時に加盟した'); }],
  [19911226, 'ussr_end', (g) => { tensionShift(g, -10, true); W(g).coldWar = false; news(g, 'ソ連が解体し、ロシア連邦が継承国となった。ウクライナなどの共和国が独立した'); phone(g, '【国際ニュース】ソ連が解体した。\nロシア連邦が国際的な地位を引き継ぎ、ウクライナなどが独立国になった。'); }],
  [19931101, 'eu', (g) => { news(g, 'マーストリヒト条約が発効し、欧州連合（EU）が発足した'); }],
  [19950101, 'wto', (g) => { news(g, '世界貿易機関（WTO）が発足した'); }],
  [19950728, 'vn_asean', (g) => { news(g, 'ベトナムがASEANに加盟した'); }],
  [19970701, 'hongkong', (g) => { news(g, '香港がイギリスから中国に返還された（一国二制度）'); }],
  [19980515, 'g8', (g) => { W(g).g8 = true; news(g, 'ロシアが主要国首脳会議に正式に加わり、G8になった'); }],
  [19990101, 'euro', (g) => { news(g, 'EUの単一通貨ユーロが導入された'); }],
  [20040501, 'eu25', (g) => { news(g, 'EUに東欧などの10か国が加わり、25か国になった'); }],
  [20070101, 'eu27', (g) => { news(g, 'EUが27か国になった'); }],
  [20081115, 'g20', (g) => { W(g).g20 = true; news(g, '主要20か国・地域（G20）の首脳会議が初めて開かれた'); }],
  [20091201, 'lisbon', (g) => { news(g, 'リスボン条約が発効し、EUに常任の欧州理事会議長が置かれた'); }],
  [20200131, 'brexit', (g) => { news(g, 'イギリスがEUを離脱した'); }],
  [20230404, 'fi_nato', (g) => { news(g, 'フィンランドがNATOに加盟した'); }],
  [20240307, 'se_nato', (g) => { news(g, 'スウェーデンがNATOに加盟した'); }],
  [20251026, 'tl_asean', (g) => { news(g, '東ティモールがASEANの11か国目の加盟国になった'); }],
];

// Summits: the host by year (G7 rotation; APEC and G20 by the real table up to 2026, then not named).
const G7_ROT = ['it', 'ca', 'fr', 'us', 'gb', 'de', 'jp'];
function g7Host(y) {
  if (y === 2006) return 'ru';
  if (y === 2014) return 'eu';
  const base = y <= 2005 ? 1987 : y <= 2013 ? 1988 : 1989;
  const h = G7_ROT[(((y - base) % 7) + 7) % 7];
  return h === 'de' && y < 1990 ? 'wde' : h;
}
const APEC_HOST = { 1993: 'us', 1994: 'id', 1995: 'jp', 1996: 'ph', 1997: 'ca', 1998: 'my', 2000: null, 2001: 'cn', 2003: 'th', 2005: 'kr', 2006: 'vn', 2007: 'au', 2009: 'sg', 2010: 'jp', 2014: 'cn', 2015: 'ph', 2017: 'vn', 2020: 'my', 2022: 'th', 2023: 'us', 2025: 'kr', 2026: 'cn' };
const G20_HOST = { 2008: 'us', 2010: 'kr', 2011: 'fr', 2013: 'ru', 2014: 'au', 2015: 'tr', 2016: 'cn', 2017: 'de', 2019: 'jp', 2021: 'it', 2022: 'id', 2023: 'in', 2024: 'br', 2026: 'us' };
export const SUMMITS = {
  g7: { name: (g) => (W(g).g8 && pairRelation(g, 'us', 'ru') > -35 && since(g, 19980515) ? 'G8サミット（主要国首脳会議）' : 'G7サミット（主要国首脳会議）'), month: (g, y) => (g7Host(y) === 'jp' ? (y < 2010 ? 7 : 5) : 6), host: g7Host, from: 0 },
  unga: { name: () => '国連総会（一般討論）', month: () => 9, host: () => 'un', from: 0 },
  apec: { name: () => 'APEC首脳会議', month: () => 11, host: (y) => APEC_HOST[y] || null, from: 19931119 },
  g20: { name: () => 'G20首脳会議', month: () => 11, host: (y) => (y in G20_HOST ? G20_HOST[y] : null), from: 20081115 },
};

// ======================================================================== era start states
const ERA_WORLD = {
  showa: { tension: 70, coldWar: true, standing: 60, anpo: 68, unsc: { member: true, until: 19881231, next: 19911031 }, sanctions: {}, conflicts: [{ id: 'iran_iraq', a: 'ir', b: 'iq', name: 'イラン・イラク戦争', since: 19800922, real: true, intensity: 2 }], deploy: [], oil: 100, threat: 45 },
  heisei_early: { tension: 25, coldWar: false, standing: 64, anpo: 72, unsc: { member: false, next: 19961031 }, sanctions: { iq: { level: 2, un: true, since: 19900805 } }, conflicts: [], oil: 100, threat: 35,
    deploy: [{ kind: 'pko', where: 'ゴラン高原', mission: '国連兵力引き離し監視隊（UNDOF）', personnel: 45, law: 'PKO協力法', start: 19960201, endDate: 20130115 }] },
  heisei: { tension: 30, coldWar: false, standing: 62, anpo: 80, unsc: { member: false, next: 20041031 }, sanctions: {}, conflicts: [], oil: 110, threat: 45,
    crises: [{ id: 'iraq_sec', kind: 'unrest', title: 'イラクの治安の悪化', country: 'iq', sev: 2, untilDate: 20111218 }],
    deploy: [
      { kind: 'rear', where: 'イラク南部サマワ', mission: 'イラク人道復興支援（陸上自衛隊）', personnel: 550, law: 'イラク人道復興支援特別措置法（2003年）', start: 20040119, endDate: 20060717 },
      { kind: 'rear', where: 'クウェート・イラク', mission: 'イラク人道復興支援の空輸（航空自衛隊）', personnel: 200, law: 'イラク人道復興支援特別措置法（2003年）', start: 20031226, endDate: 20081218 },
      { kind: 'rear', where: 'インド洋', mission: '補給支援（海上自衛隊）', personnel: 330, law: 'テロ対策特別措置法（2001年）', start: 20011202, endDate: 20071101 },
    ] },
  reiwa: { tension: 66, coldWar: false, standing: 66, anpo: 86, unsc: { member: false, next: 20310630 }, g8: false, oil: 105, threat: 62,
    sanctions: { ru: { level: 3, g7: true, since: 20220226 }, kp: { level: 3, since: 20090616 } },
    conflicts: [{ id: 'ru_ua', a: 'ru', b: 'ua', name: 'ロシアのウクライナ侵攻', since: 20220224, real: true, aggressor: 'ru', intensity: 3 }],
    deploy: [{ kind: 'other', where: 'ソマリア沖・アデン湾', mission: '海賊対処（海上自衛隊）', personnel: 240, law: '海賊対処法（2009年）', start: 20090330 }] },
};

// ======================================================================== state
export function newWorldState(g) {
  const era = eraOf(g);
  const E = ERA_WORLD[era] || ERA_WORLD.reiwa;
  const s = {
    v: 1, era, init: false, lastTick: 0, seq: 1,
    rel: {}, pair: {}, tension: E.tension, tensionEq: E.tension, coldWar: E.coldWar, standing: E.standing, oil: E.oil, threat: E.threat,
    g8: E.g8 !== undefined ? E.g8 : ERA_START[era] >= 19980515, g20: ERA_START[era] >= 20081115,
    alliances: { anpo: { strength: E.anpo, notice: null, ended: null } },
    treaties: {}, ties: {}, ambassadors: {},
    sanctions: { byJapan: {}, onJapan: {} }, aid: {},
    summits: { done: {}, met: {}, last: null }, statements: [],
    conflicts: [], crises: [], deploy: [], attack: null, peace: null, provoked: {},
    unsc: { ...E.unsc, ran: [] }, disputes: {}, history: {}, npcDone: {}, offers: [],
    news: [], record: { summits: 0, treaties: 0, sanctions: 0, aid: 0, deployments: 0 }, flags: {},
  };
  return s;
}
// Fill the start state (needs the date: the politics core may not be ready at construction).
function initWorld(g, s) {
  if (s.init) return;
  s.init = true;
  const era = s.era;
  const E = ERA_WORLD[era] || ERA_WORLD.reiwa;
  const start = ERA_START[era] || 20260401;
  for (const [d, id] of HISTORY.map((h) => [h[0], h[1]])) if (d <= start) s.history[id] = -1;
  for (const [id, T] of Object.entries(TREATIES)) if (T.from <= start) s.treaties[id] = { status: 'force', since: -1, by: 'history' };
  for (const [cid, v] of Object.entries(E.sanctions || {})) s.sanctions.byJapan[cid] = { ...v, day: -1 };
  s.conflicts = (E.conflicts || []).map((c) => ({ ...c, start: -1, status: 'war', front: 0, dead: 0, japan: null }));
  s.crises = (E.crises || []).map((c, i) => ({ ...c, day: -1, handled: {}, n: i }));
  s.deploy = (E.deploy || []).map((d, i) => ({ id: 'h' + i, ...d, startDay: -1, history: true }));
  for (const D of Object.values(DISPUTES)) s.disputes[D.id] = { admin: D.admin0, status: 'dispute' };
  if (start >= 20140301) s.g8 = false;
}
export function W(g) {
  const st = g && g.state;
  if (!st) return newWorldState(g);
  let s = st.world;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = st.world = newWorldState(g);
  if (!s._ok) {
    const b = newWorldState(g);
    for (const k of Object.keys(b)) if (s[k] === undefined) s[k] = b[k];
    for (const k of ['rel', 'pair', 'treaties', 'ties', 'ambassadors', 'aid', 'disputes', 'history', 'npcDone', 'provoked', 'flags', 'record', 'alliances', 'sanctions', 'summits', 'unsc']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = b[k];
    for (const k of ['conflicts', 'crises', 'deploy', 'news', 'statements', 'offers']) if (!Array.isArray(s[k])) s[k] = [];
    if (!s.sanctions.byJapan) s.sanctions.byJapan = {};
    if (!s.sanctions.onJapan) s.sanctions.onJapan = {};
    if (!s.summits.done) s.summits.done = {};
    if (!s.summits.met) s.summits.met = {};
    if (!s.alliances.anpo) s.alliances.anpo = { strength: 70, notice: null, ended: null };
    for (const k of ['tension', 'tensionEq', 'standing', 'oil', 'threat']) s[k] = num(s[k], b[k]);
    Object.defineProperty(s, '_ok', { value: true, enumerable: false, configurable: true });
  }
  initWorld(g, s);
  return s;
}

// ======================================================================== events, news, messages
const HOOKS = {};
export function onWorld(event, fn) { (HOOKS[event] || (HOOKS[event] = [])).push(fn); return () => { HOOKS[event] = (HOOKS[event] || []).filter((f) => f !== fn); }; }
function emit(g, event, data) { for (const fn of HOOKS[event] || []) { try { fn(g, data); } catch (e) { console.error(e); } } }
function news(g, text, opts = {}) {
  const s = W(g);
  s.news.unshift({ day: today(g), text, kind: opts.kind || 'world' });
  if (s.news.length > 80) s.news.length = 80;
  const p = pol(g);
  if (p && Array.isArray(p.news) && opts.feed !== false) { p.news.unshift({ day: today(g), text, kind: 'world' }); if (p.news.length > 80) p.news.length = 80; }
}
function phone(g, text, from = 'ドット新聞 国際部') { try { if (typeof g.message === 'function') g.message({ from, text, kind: 'news' }); } catch (e) { /* no phone */ } }
function note(g, text) { try { (g.morningNotes || (g.morningNotes = [])).push(REG && REG.KIKI && typeof REG.KIKI.wrap === 'function' ? REG.KIKI.wrap(g, text) : text); } catch (e) { /* ignore */ } }
// Scenes go through regime.js's queue (KIKI.show from kiki.js); without it, nothing is shown.
function scene(g, id, data = {}, opts = {}) { try { if (REG && typeof REG.queueRegimeScene === 'function') REG.queueRegimeScene(g, 'world_' + id, data, opts); } catch (e) { console.error(e); } }

// ======================================================================== politics helpers
function pol(g) { try { if (g && typeof g.pol === 'function' && g.state) return g.pol(); } catch (e) { console.error(e); } return null; }
const meOf = (g) => { const p = pol(g); return p ? p.me : null; };
const hasPost = (g, post) => { const me = meOf(g); return !!(me && Array.isArray(me.posts) && me.posts.includes(post)); };
const isPM = (g) => hasPost(g, 'pm');
const isFM = (g) => hasPost(g, 'minister_foreign');
const isDM = (g) => hasPost(g, 'minister_defense');
function postName(g, post) {
  try { if (POL && POL.postName) { const d = worldDate(g); return POL.postName(post, d.year + (d.month - 1) / 12); } } catch (e) { /* fall back */ }
  return { pm: '内閣総理大臣', minister_foreign: '外務大臣', minister_defense: since(g, 20070109) ? '防衛大臣' : '防衛庁長官' }[post] || post;
}
function bumpApproval(g, d, text = '外交') {
  const p = pol(g);
  if (!p || !p.cabinet || !d) return;
  const before = num(p.cabinet.approval, 40);
  p.cabinet.approval = clamp(before + d, 3, 90);
  const delta = p.cabinet.approval - before;
  if (delta && typeof g.approvalNote === 'function') { try { g.approvalNote('regime', Math.round(delta * 100) / 100, `外交・世界情勢：${text}`, { applied: true }); } catch (e) { console.error(e); } }
}
const approvalOf = (g) => { const p = pol(g); return p && p.cabinet ? num(p.cabinet.approval, 40) : 40; };
// An economic shock in the politics core (the same shape as regime.js's).
function ecoShock(g, name, s) {
  const p = pol(g);
  if (!p || !p.economy || !Array.isArray(p.economy.shocks)) return;
  const abs = today(g) - 1 + ((p.cal ? p.cal.month : 4) - 1) * MONTH_DAYS;
  p.economy.shocks.push({ kind: 'world', name, until: abs + num(s.len, 120), len: num(s.len, 120), growth: num(s.growth), inflation: num(s.inflation), unemployment: num(s.unemployment), yen: num(s.yen) });
  if (s.nikkei && p.economy.nikkei) p.economy.nikkei *= 1 + s.nikkei / 100;
}
// Diet approval of a treaty / a deployment: the ruling side's share of the 衆議院 (衆議院の優越) and the mood.
function dietOdds(g, k = 0) {
  const p = pol(g);
  const H = p && p.diet && p.diet.shugi;
  if (!H || !H.seats) return 0.7;
  const total = num(H.total) || Object.values(H.seats).reduce((a, v) => a + num(v), 0) || 1;
  const ids = (p.cabinet && p.cabinet.partyIds) || [];
  const ruling = ids.reduce((a, id) => a + num(H.seats[id]), 0) / total;
  return clamp(0.25 + (ruling - 0.5) * 3 + (approvalOf(g) - 40) / 120 + k, 0.04, 0.97);
}
function ideoNudge(g, axes, w, why) { try { if (typeof g.ideologyNudge === 'function' && (isPM(g) || isFM(g) || isDM(g))) g.ideologyNudge(axes, w, why); } catch (e) { console.error(e); } }

// ======================================================================== queries
// A date list [[yyyymmdd, v], …] or a plain value → the value at the date n.
const dv = (x, n) => (Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][0] === 'number' ? byDate(x, n) : x);
const FICT_REL = { nevalon: -10, luzenia: 12, keldoa: -6 };
const fictional = () => (REG && REG.FICTIONAL_NATIONS) || {};
const isFictional = (id) => !!fictional()[id];
export function exists(g, id, n = dateNum(g)) {
  const c = COUNTRIES[id] || ORGS[id] || PSEUDO[id];
  if (!c) return isFictional(id);
  return (!c.from || n >= c.from) && (!c.to || n < c.to);
}
// the country that now stands for an id of another time (ソ連 → ロシア, 西ドイツ → ドイツ, EC → EU)
export function current(g, id) {
  let x = id;
  for (let i = 0; i < 3 && x && !exists(g, x); i++) { const c = COUNTRIES[x] || ORGS[x]; if (!c || !c.successor) break; x = c.successor; }
  return x;
}
export function countryName(g, id, short = false) {
  const c = COUNTRIES[id] || ORGS[id] || PSEUDO[id];
  if (c) return short ? c.short : c.name;
  const f = fictional()[id];
  return f ? (short ? f.short : f.name) : String(id || '');
}
const shortName = (g, id) => countryName(g, id, true);
export function leaderTitle(g, id) {
  const c = COUNTRIES[id] || ORGS[id];
  if (c) return dv(c.leader, dateNum(g)) || `${c.short}の首脳`;
  const f = fictional()[id];
  return f ? `${f.short}の首脳` : '相手国の首脳';
}
export function countriesNow(g) { return COUNTRY_ORDER.filter((id) => exists(g, id)); }
// Military power (index; the US = 100) and the economy (GDP 兆ドル, 目安).
export function milPower(g, id) {
  if (id === 'jp') return jpMil(g);
  const c = COUNTRIES[id];
  if (c) return Math.round(interp(c.mil, fyear(g)));
  const f = fictional()[id];
  return f ? num(f.power, 50) : 30;
}
function jpMil(g) {
  const p = pol(g);
  const base = interp(A([1987, 40], [1996, 42], [2004, 45], [2026, 52]), fyear(g));
  const def = p && p.economy ? num(p.economy.defense, 1) : 1;
  const ref = fyear(g) < 2023 ? 1.0 : 1.4;
  return Math.round(base * Math.sqrt(clamp(def / ref, 0.4, 3)));
}
const gdpOf = (g, id) => { const c = COUNTRIES[id]; return c ? Math.round(interp(c.gdp, fyear(g)) * 100) / 100 : 0; };
const tradeOf = (g, id) => { const c = COUNTRIES[id]; return c ? Math.round(interp(c.trade, fyear(g)) * 10) / 10 : 0; };
// Japan's relation with a country (−100..100): the era's base (history) plus what the game has done.
export function relation(g, id) {
  const s = W(g);
  const c = COUNTRIES[id];
  const base = c ? interp(c.rel, fyear(g)) : num(FICT_REL[id], 0);
  return clamp(Math.round(base + num(s.rel[id])), -100, 100);
}
function relAdd(g, id, d) {
  if (!id || !d) return 0;
  const s = W(g);
  const before = relation(g, id);
  const after = clamp(before + d, -100, 100);
  s.rel[id] = num(s.rel[id]) + (after - before);
  return after - before;
}
export const relLabel = (v) => (v >= 60 ? '良好' : v >= 25 ? 'まずまず' : v > -25 ? 'ふつう' : v > -60 ? '冷えこんでいる' : '険悪');
// Blocs
export const BLOC_INFO = {
  west: { name: (s) => (s.coldWar ? '西側（自由主義陣営）' : '西側（G7と同盟国）'), short: '西側', color: '#4f8fe8' },
  east: { name: () => '東側（社会主義陣営）', short: '東側', color: '#e85a5a' },
  nonaligned: { name: () => '非同盟・独自路線', short: '非同盟', color: '#c8b45a' },
  cnru: { name: () => '中国・ロシアに近い国々', short: '中ロ側', color: '#e0844a' },
  other: { name: () => 'どの陣営とも距離をおく国々', short: '中立', color: '#9aa3b0' },
};
const WEST_COLD = ['us', 'gb', 'fr', 'wde', 'it', 'ca', 'au', 'kr', 'tw', 'il', 'tr', 'jp', 'ph', 'th', 'sg', 'my', 'sa'];
const EAST_COLD = ['su', 'dde', 'kp', 'vn'];
const WEST_NEW = ['us', 'gb', 'fr', 'de', 'it', 'ca', 'au', 'kr', 'tw', 'jp', 'ph', 'ua', 'il'];
const CNRU = ['cn', 'ru', 'kp', 'ir'];
const WEST_POST = ['us', 'gb', 'fr', 'de', 'it', 'ca', 'au', 'kr', 'jp', 'tr', 'ph', 'il', 'th'];
export const newColdWar = (g) => { const s = W(g); return !s.coldWar && tensionNow(g) >= 55; };
export function blocOf(g, id) {
  const s = W(g);
  if (isFictional(id)) return 'other';
  if (s.coldWar) return WEST_COLD.includes(id) ? 'west' : EAST_COLD.includes(id) ? 'east' : 'nonaligned';
  if (newColdWar(g)) return WEST_NEW.includes(id) ? 'west' : CNRU.includes(id) ? 'cnru' : 'other';
  return WEST_POST.includes(id) ? 'west' : 'other';
}
const opposed = (a, b) => (a === 'west' && (b === 'east' || b === 'cnru')) || (b === 'west' && (a === 'east' || a === 'cnru'));
// Relations between two other countries (−100..100).
const PAIRS = {
  'cn|us': A([1987, 20], [1996, 0], [2004, 10], [2018, -20], [2026, -45]), 'su|us': A([1987, -45], [1991, 0]), 'ru|us': A([1992, 30], [2004, 10], [2014, -40], [2026, -50]),
  'cn|su': A([1987, -15], [1990, 10]), 'cn|ru': A([1992, 15], [2004, 30], [2026, 55]), 'cn|tw': A([1987, -50], [2004, -40], [2026, -60]), 'cn|kp': A([1987, 50], [2026, 40]),
  'kp|su': A([1987, 40]), 'kp|ru': A([1992, 0], [2004, 10], [2024, 60]), 'kp|kr': A([1987, -70], [2004, -30], [2026, -70]), 'kp|us': A([1987, -80], [2026, -80]),
  'ir|us': A([1987, -70], [2026, -85]), 'il|ir': A([1987, -50], [2004, -70], [2026, -95]), 'iq|ir': A([1987, -95], [1989, -60], [1996, -50], [2004, 10], [2026, 40]),
  'iq|us': A([1987, 10], [1991, -80], [2004, 10], [2026, 30]), 'ir|sa': A([1987, -50], [2016, -70], [2023, -20], [2026, -15]), 'ru|ua': A([1992, 20], [2004, 10], [2014, -70], [2022, -100]),
  'cn|in': A([1987, -25], [2004, 0], [2020, -40], [2026, -25]), 'cn|vn': A([1987, -60], [1991, -10], [2014, -30], [2026, -15]), 'cn|ph': A([1987, 10], [2004, 10], [2016, -20], [2026, -45]),
  'cn|kr': A([1987, -20], [1992, 20], [2026, 10]), 'kr|su': A([1987, -30], [1990, 20]), 'us|vn': A([1987, -40], [1995, 20], [2026, 40]), 'il|tr': A([1987, 10], [2010, -20], [2026, -50]),
  'iq|sa': A([1987, 30], [1990, -70], [2004, -10], [2026, 20]), 'il|sa': A([1987, -60], [2026, -20]), 'iq|il': A([1987, -70], [2026, -60]),
};
const pkey = (a, b) => [a, b].sort().join('|');
export function pairRelation(g, a, b) {
  if (a === 'jp') return relation(g, b);
  if (b === 'jp') return relation(g, a);
  const s = W(g);
  const k = pkey(a, b);
  const ba = blocOf(g, a), bb = blocOf(g, b);
  let v = PAIRS[k] ? interp(PAIRS[k], fyear(g)) : ba === bb && ba !== 'other' && ba !== 'nonaligned' ? 40 : opposed(ba, bb) ? -40 : 5;
  if (s.conflicts.some((c) => c.status === 'war' && pkey(c.a, c.b) === k)) v = -100;
  return clamp(Math.round(v + num(s.pair[k])), -100, 100);
}
function pairAdd(g, a, b, d) { const s = W(g); const k = pkey(a, b); s.pair[k] = clamp(num(s.pair[k]) + d, -150, 150); }
// Tension (the cold war / the new tension): 0..100
export function tensionNow(g) { return Math.round(clamp(W(g).tension, 0, 100)); }
export const tensionLabel = (g) => { const s = W(g); const t = tensionNow(g); return s.coldWar === true ? '冷戦' : s.coldWar === 'ending' ? '冷戦の終わり' : t >= 55 ? '新しい冷戦（大国の対立）' : t >= 35 ? '緊張がある' : '協調の時代'; };
function tensionShift(g, d, eq = false) { const s = W(g); s.tension = clamp(s.tension + d, 0, 100); if (eq) s.tensionEq = clamp(s.tensionEq + d, 0, 100); }
function standingAdd(g, d) { const s = W(g); s.standing = clamp(s.standing + d, 0, 100); }
function threatAdd(g, d) { const s = W(g); s.threat = clamp(s.threat + d, 0, 100); }
// Diplomatic ties with Japan
export function hasTies(g, id) {
  const s = W(g);
  if (s.ties[id] === 'cut') return false;
  if (s.ties[id] === 'normal') return true;
  if (isFictional(id)) return true;
  const c = COUNTRIES[id];
  return !!c && !c.noTies;
}
const tiesLabel = (g, id) => (W(g).ties[id] === 'cut' ? '断絶' : !hasTies(g, id) ? 'なし' : W(g).ambassadors[id] === 'recalled' ? 'あり（大使を召還中）' : 'あり');
// Alliances in force now (real + made in the game).
function allianceActive(g, a, n = dateNum(g)) {
  const s = W(g);
  if (a.player) return !a.ended;
  if (n < a.from || (a.to && n >= a.to)) return false;
  const st = s.alliances[a.id];
  return !(st && st.ended);
}
function allianceMembers(g, a) { return dv(a.members, dateNum(g)) || []; }
export function alliancesNow(g) {
  const s = W(g);
  const out = [];
  for (const a of Object.values(ALLIANCES)) if (allianceActive(g, a)) out.push({ ...a, members: allianceMembers(g, a), strength: a.id === 'anpo' ? Math.round(s.alliances.anpo.strength) : null, notice: a.id === 'anpo' ? s.alliances.anpo.notice : null });
  for (const [id, a] of Object.entries(s.alliances)) if (a && a.player && !a.ended) out.push({ id, ...a });
  return out;
}
// The partners that are bound to (or likely to) help `id`: [{ id, alliance, kind, strength }]
export function alliesOf(g, id) {
  const out = [];
  for (const a of alliancesNow(g)) {
    const m = a.members || [];
    if (!m.includes(id)) continue;
    for (const x of m) if (x !== id && !out.some((o) => o.id === x)) out.push({ id: x, alliance: a.id, name: a.short || a.name, kind: a.kind, strength: a.strength == null ? 70 : a.strength });
  }
  return out;
}
export const japanAllies = (g) => alliesOf(g, 'jp');
// Treaties with Japan in force: [{ id, name, kind, with[], status, by }]
export function treatiesNow(g) {
  const s = W(g);
  const out = [];
  for (const [id, st] of Object.entries(s.treaties)) {
    const T = TREATIES[id] || st;
    if (!st || st.status === 'ended') continue;
    out.push({ id, name: T.name || st.name, kind: T.kind || st.kind, with: (T.with || st.with || []).map((x) => current(g, x)), status: st.status, by: st.by, since: st.since, notice: st.notice || null });
  }
  return out;
}
const treatyWith = (g, id, kind) => treatiesNow(g).some((t) => t.kind === kind && (t.with.includes(id) || t.with.some((w) => orgHas(g, w, id))));
function orgHas(g, org, id) { const O = ORGS[org] || PSEUDO[org]; return !!(O && (dv(O.members, dateNum(g)) || []).includes(id)); }
// Multilateral trade frameworks as targets (from the date the talks were open to Japan).
const PSEUDO = {
  tpp: { id: 'tpp', name: '環太平洋パートナーシップ（TPP）', short: 'TPP', from: 20100301, members: ['us', 'au', 'ca', 'sg', 'my', 'vn'], trade: 30 },
  rcep: { id: 'rcep', name: '地域的な包括的経済連携（RCEP）', short: 'RCEP', from: 20121120, members: ['cn', 'kr', 'au', 'id', 'ph', 'vn', 'th', 'sg', 'my'], trade: 46 },
};
const orgTrade = (g, id) => { const O = ORGS[id] || PSEUDO[id]; if (!O) return 0; if (O.trade) return O.trade; return (dv(O.members, dateNum(g)) || []).reduce((a, x) => a + tradeOf(g, x), 0); };
export function attackOnJapan(g) { const a = W(g).attack; return a && !a.over ? { ...a } : null; }
// The war of Japan (regime.js) when present
const japanWar = (g) => { try { return typeof g.war === 'function' ? g.war() : null; } catch (e) { return null; } };
const regimeId = (g) => { try { return typeof g.regime === 'function' ? g.regime().id : 'democracy'; } catch (e) { return 'democracy'; } };
const regimeSteps = (g) => { try { return typeof g.regime === 'function' ? g.regime().steps || {} : {}; } catch (e) { return {}; } };
// Laws (real dates, or passed in the game through the politics core)
function lawPassed(g, id) {
  const p = pol(g);
  if (!p) return false;
  if (p.flags && p.flags.inForce && p.flags.inForce[id]) return true;
  return Array.isArray(p.laws) && p.laws.some((L) => L && L.policy === id);
}
const LAWS = {
  jdr: (g) => since(g, 19870916), jdrSdf: (g) => since(g, 19920619), pko: (g) => since(g, 19920810) || lawPassed(g, 'pko'),
  evacSdf: (g) => since(g, 19941118), shuhen: (g) => since(g, 19990825) || lawPassed(g, 'security_law'),
  sanction: (g) => since(g, 20040209), anpoLaw: (g) => since(g, 20160329) || lawPassed(g, 'security_law'),
};
// The legal basis of collective self-defence now: null | { kind: 'law'|'art9'|'army', text }
function collectiveBasis(g) {
  const st = regimeSteps(g);
  if (st.army && regimeId(g) === 'dictatorship') return { kind: 'army', text: '国軍（政令による改編）' };
  if (st.art9) return { kind: 'art9', text: '改正した憲法9条（交戦権の容認）' };
  if (LAWS.anpoLaw(g)) return { kind: 'law', text: '平和安全法制（存立危機事態での限定的な集団的自衛権）' };
  return null;
}
const NEAR = ['kr', 'kp', 'cn', 'tw', 'ru', 'su'];
function distanceKm(id) {
  const a = MAP_POS.jp, b = MAP_POS[id];
  if (!b) return 3000;
  const R0 = 6371, d2r = Math.PI / 180;
  const dl = (b[0] - a[0]) * d2r, dn = (b[1] - a[1]) * d2r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[0] * d2r) * Math.cos(b[0] * d2r) * Math.sin(dn / 2) ** 2;
  return Math.round(2 * R0 * Math.asin(Math.sqrt(h)));
}
// For regime.js's war: what the enemy is.
export function countryInfo(g, id) {
  const f = fictional()[id];
  if (f) return { id, name: f.name, short: f.short, leader: leaderTitle(g, id), mil: num(f.power, 50), real: false, nuclear: false, allies: [], dispute: null, area: (REG && REG.DISPUTED_AREA && REG.DISPUTED_AREA.name) || '係争地', far: true, near: false };
  const c = COUNTRIES[id];
  if (!c) return null;
  const n = dateNum(g);
  const nuc = dv(c.nuclear, n);
  const D = c.dispute ? DISPUTES[c.dispute] : null;
  return {
    id, name: c.name, short: c.short, leader: leaderTitle(g, id), mil: milPower(g, id), econ: gdpOf(g, id), real: true, nuclear: nuc === 'nws' || nuc === 'test' || nuc === 'test74',
    allies: alliesOf(g, id).map((a) => a.id), dispute: D ? D.id : null, area: D ? D.name : NEAR.includes(id) ? `${c.short}の沿岸部` : `${c.short}との戦域`, far: distanceKm(id) > 5000, near: NEAR.includes(id), trade: tradeOf(g, id), bloc: blocOf(g, id),
  };
}

// ======================================================================== diplomacy
// Each action: { name, who: ['pm'|'foreign'|'defense'|'any'], target: 'country'|'org'|'trade'|'conflict'|'crisis'|'none',
//   desc, check(g, t, o) → why | null (a structural reason with the path; never "because it is bad"),
//   odds(g, t, o) → 0..1 | null, lines(g, t, o) → [cost / effect lines], options(g, t) → [{ id, label, sub }] | null,
//   run(g, t, o) → { ok, success, text } }
const WHO = { pm: '内閣総理大臣', foreign: '外務大臣', defense: '防衛大臣' };
function roleWhy(g, who) {
  if (who.includes('any')) return null;
  if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
  if ((who.includes('pm') && isPM(g)) || (who.includes('foreign') && isFM(g)) || (who.includes('defense') && isDM(g))) return null;
  return `${who.map((w) => (w === 'defense' ? postName(g, 'minister_defense') : WHO[w])).join('・')}が行う（総理や大臣になれば、ここから動かせる）`;
}
const stam = (g) => num(g.state && g.state.stamina);
const useStam = (g, n) => { if (g.state) g.state.stamina = Math.max(0, stam(g) - n); };
const pct = (p) => `${Math.round(clamp(p, 0, 1) * 100)}%`;
const who0 = (g) => `${(g.state && g.state.name) || ''}${isPM(g) ? '総理' : '大臣'}`;
const recentMet = (g, id, days = 10) => { const d = W(g).summits.met[id]; return d != null && today(g) - d <= days; };
const conflictById = (g, id) => W(g).conflicts.find((c) => c.id === id) || null;
const crisisById = (g, id) => W(g).crises.find((c) => c.id === id) || null;
const sanctioned = (g, id) => num((W(g).sanctions.byJapan[id] || {}).level);
const atWarWith = (g, id) => { const w = japanWar(g); return !!(w && w.phase === 'war' && w.enemy === id); };
function needCountry(g, id, opts = {}) {
  if (!id) return '相手を選ぶ';
  if (!exists(g, id)) return 'その国はいまはない';
  if (opts.ties && !hasTies(g, id)) return `${shortName(g, id)}とは国交がない（${tiesLabel(g, id)}）。まず国交を結ぶ（「国交を結ぶ」）`;
  if (opts.notWar && atWarWith(g, id)) return `${shortName(g, id)}とは戦争中。停戦交渉・講和は戦争の画面から`;
  return null;
}
const alliedTo = (g, id) => japanAllies(g).some((a) => a.id === id);
// generic diplomatic odds from the relation, standing, sanctions and the blocs
function baseOdds(g, id, k = 0) {
  const r = relation(g, id);
  const s = W(g);
  const opp = opposed(blocOf(g, 'jp'), blocOf(g, id)) ? -0.08 : 0;
  return clamp(0.5 + r / 180 + (s.standing - 60) / 200 + opp - sanctioned(g, id) * 0.07 - (s.ambassadors[id] === 'recalled' ? 0.15 : 0) + k, 0.04, 0.95);
}
const SUMMIT_TOPICS = [
  { id: 'econ', label: '経済・貿易の協力', sub: '関係がよくなり、景気にも少しプラス' },
  { id: 'security', label: '安全保障の協力', sub: '同盟国なら同盟が強まる（周りの国は警戒）' },
  { id: 'friend', label: '友好・人の交流', sub: '成功しやすいが、効果は小さめ' },
  { id: 'dispute', label: '領土問題の協議', sub: '成功しにくい。進めば平和条約への道が開く' },
];
function summitRun(g, id, o, kind) {
  const s = W(g);
  const topic = (o && o.topic) || 'friend';
  const k = topic === 'friend' ? 0.12 : topic === 'dispute' ? -0.25 : 0;
  const p = baseOdds(g, id, k + (kind === 'fm' ? 0.05 : 0));
  const ok = roll(p);
  const pm = kind !== 'fm';
  const title = kind === 'fm' ? `${shortName(g, id)}の外相` : leaderTitle(g, id);
  useStam(g, kind === 'visit' ? 35 : kind === 'fm' ? 15 : 20);
  s.summits.met[id] = today(g);
  if (kind === 'visit') s.flags['visit_' + id] = today(g);
  s.record.summits++;
  const me = who0(g);
  if (ok) {
    const big = ['us', 'cn', 'ru', 'su'].includes(id);
    const d = relAdd(g, id, rint(4, 8) + (kind === 'visit' ? 3 : 0) + (topic === 'friend' ? -1 : 0));
    if (pm) bumpApproval(g, (big ? 2 : 1) + (kind === 'visit' ? 1 : 0), `${shortName(g, id)}との首脳会談`);
    standingAdd(g, kind === 'visit' ? 1.5 : 1);
    let extra = '';
    if (topic === 'econ') { ecoShock(g, `${shortName(g, id)}との経済協力`, { growth: clamp(tradeOf(g, id) * 0.008, 0.02, 0.15), len: 240 }); extra = '経済協力の拡大で一致した。'; }
    else if (topic === 'security') {
      if (alliedTo(g, id)) { const A0 = s.alliances.anpo; if (id === 'us' && A0) A0.strength = clamp(A0.strength + 3, 0, 100); extra = '同盟の協力を深めることで一致した。'; }
      else extra = '安全保障の対話を続けることで一致した。';
      for (const x of CNRU) if (x !== id && exists(g, x) && opposed(blocOf(g, x), blocOf(g, id))) relAdd(g, x, -1);
    } else if (topic === 'dispute') {
      const D = COUNTRIES[id] && COUNTRIES[id].dispute;
      if (D) { s.disputes[D] = { ...(s.disputes[D] || {}), talks: num((s.disputes[D] || {}).talks) + 1 }; extra = `${DISPUTES[D].name}について、協議を続けることで一致した。`; }
      else extra = '懸案について話し合った。';
    } else extra = '人の交流を広げることで一致した。';
    news(g, `${me}が${title}と${kind === 'fm' ? '会談' : kind === 'visit' ? `${shortName(g, id)}を公式訪問し、会談` : '首脳会談'}。${extra}`);
    ideoNudge(g, { world: -0.6 }, 0.02, `${shortName(g, id)}との会談`);
    emit(g, 'summit', { id, kind, topic, ok: true });
    return { ok: true, success: true, text: `${title}との会談は成功した。${extra}\n（関係 ${d >= 0 ? '+' : ''}${d}）` };
  }
  relAdd(g, id, topic === 'dispute' ? -3 : -1);
  if (pm) bumpApproval(g, -0.5, `${shortName(g, id)}との会談の不調`);
  news(g, `${me}と${title}の会談は、主張が平行線のまま終わった`);
  emit(g, 'summit', { id, kind, topic, ok: false });
  return { ok: true, success: false, text: `${title}との会談は平行線に終わった。（成功の見込みは ${pct(p)} だった）` };
}
const STATEMENT_KINDS = [
  { id: 'econ', label: '経済協力の強化', sub: '景気に少しプラス' },
  { id: 'security', label: '安全保障の協力', sub: '同盟・協力関係が強まる' },
  { id: 'history', label: '歴史と和解', sub: '関係が大きくよくなるが、国内の一部が反発' },
  { id: 'climate', label: '気候変動・環境', sub: '国際的な評価が上がる' },
];
function newTreatyId(g, base) { const s = W(g); return `${base}_${s.seq++}`; }
function addTreaty(g, def) {
  const s = W(g);
  const id = def.id || newTreatyId(g, 'p');
  s.treaties[id] = { status: 'force', since: today(g), by: def.by || 'player', name: def.name, kind: def.kind, with: def.with };
  s.record.treaties++;
  emit(g, 'treaty', { id, ...def });
  return id;
}
function tradeShock(g, partner, sign, k = 1, name) {
  const t = COUNTRIES[partner] ? tradeOf(g, partner) : orgTrade(g, partner);
  if (!t) return;
  ecoShock(g, name || `${shortName(g, partner)}との貿易`, { growth: sign * clamp(t * 0.012 * k, 0.03, 0.8), nikkei: sign * clamp(t * 0.15 * k, 0.3, 8), len: 360 });
}
export const DIPLO = {
  summit: {
    name: '首脳会談', who: ['pm'], target: 'country', desc: '相手国の首脳と会談する（体力20）。関係・支持率・国際的な信頼に効く。',
    options: () => SUMMIT_TOPICS,
    check(g, id) {
      const w = needCountry(g, id, { notWar: true });
      if (w) return w;
      if (!hasTies(g, id) && id !== 'kp') return `${shortName(g, id)}とは国交がない（首脳の公式な会談はできない）。まず国交を結ぶ`;
      if (recentMet(g, id, 8)) return 'ついこのあいだ会談したばかり（10日ほどあける）';
      if (stam(g) < 20) return '体力が足りない（体力20）';
      return null;
    },
    odds: (g, id, o) => baseOdds(g, id, (o && o.topic) === 'friend' ? 0.12 : (o && o.topic) === 'dispute' ? -0.25 : 0),
    lines: (g, id) => [`相手：${leaderTitle(g, id)}（関係 ${relation(g, id)}：${relLabel(relation(g, id))}）`, '成功：関係＋4〜8・支持率＋1〜2・国際的な信頼＋', '不調：関係が少し下がる'],
    run: (g, id, o) => summitRun(g, id, o, 'pm'),
  },
  visit: {
    name: '外遊（公式訪問）', who: ['pm', 'foreign'], target: 'country', desc: '相手国を公式に訪問し、首脳・要人と会う（体力35）。会談より効果が大きい。',
    options: () => SUMMIT_TOPICS,
    check(g, id) {
      const w = needCountry(g, id, { ties: true, notWar: true });
      if (w) return w;
      const d = W(g).flags['visit_' + id];
      if (d != null && today(g) - d < 20) return 'この国は少し前に訪問したばかり（20日ほどあける）';
      if (stam(g) < 35) return '体力が足りない（体力35）';
      return null;
    },
    odds: (g, id) => baseOdds(g, id, 0.06),
    lines: () => ['成功：関係＋7〜11・国際的な信頼＋（総理なら支持率＋）', '体力35を使う'],
    run: (g, id, o) => summitRun(g, id, o, isPM(g) ? 'visit' : 'fm'),
  },
  fm_talks: {
    name: '外相会談', who: ['foreign'], target: 'country', desc: '外務大臣として相手国の外相と会談する（体力15）。',
    options: () => SUMMIT_TOPICS.filter((t) => t.id !== 'security'),
    check(g, id) { const w = needCountry(g, id, { ties: true, notWar: true }); if (w) return w; if (recentMet(g, id, 6)) return 'ついこのあいだ会談したばかり'; if (stam(g) < 15) return '体力が足りない（体力15）'; return null; },
    odds: (g, id) => baseOdds(g, id, 0.05),
    lines: () => ['成功：関係＋3〜7'],
    run: (g, id, o) => summitRun(g, id, o, 'fm'),
  },
  statement: {
    name: '共同声明', who: ['pm'], target: 'country', desc: '首脳会談のあとに、合意を共同声明にまとめる（会談から10日以内）。',
    options: (g, id) => STATEMENT_KINDS.filter((k) => k.id !== 'security' || relation(g, id) >= 0),
    check(g, id) { const w = needCountry(g, id, { notWar: true }); if (w) return w; if (!recentMet(g, id, 10)) return 'まず首脳会談を行う（共同声明は会談の成果をまとめるもの）'; if (W(g).flags['stmt_' + id] && today(g) - W(g).flags['stmt_' + id] < 30) return 'この国とは最近、共同声明を出したばかり'; return null; },
    odds: (g, id, o) => baseOdds(g, id, (o && o.kind) === 'history' ? -0.15 : 0.05),
    lines: (g, id, o) => [{ econ: '成功：関係＋4・景気に少しプラス', security: '成功：関係＋5・協力関係が強まる（中国・ロシアなどは警戒）', history: '成功：関係＋10。国内の一部（保守層）が反発し、支持率は上下する', climate: '成功：関係＋3・国際的な信頼＋2' }[(o && o.kind) || 'econ'] || '成功：関係がよくなる'],
    run(g, id, o) {
      const s = W(g);
      const kind = (o && o.kind) || 'econ';
      const p = this.odds(g, id, o);
      s.flags['stmt_' + id] = today(g);
      if (!roll(p)) { relAdd(g, id, -1); news(g, `${shortName(g, id)}との共同声明は、文言で折り合わず見送られた`); return { ok: true, success: false, text: `共同声明は文言で折り合わず、見送りになった。（見込み ${pct(p)}）` }; }
      const label = (STATEMENT_KINDS.find((k) => k.id === kind) || STATEMENT_KINDS[0]).label;
      if (kind === 'econ') { relAdd(g, id, 4); ecoShock(g, '共同声明（経済）', { growth: 0.05, len: 240 }); }
      if (kind === 'security') { relAdd(g, id, 5); for (const x of CNRU) if (x !== id && exists(g, x)) relAdd(g, x, -2); tensionShift(g, 1); }
      if (kind === 'history') { relAdd(g, id, 10); bumpApproval(g, roll(0.5) ? 1 : -2, '歴史をめぐる共同声明'); ideoNudge(g, { world: -0.8, social: -0.4 }, 0.04, '歴史と和解の共同声明'); }
      if (kind === 'climate') { relAdd(g, id, 3); standingAdd(g, 2); }
      s.statements.unshift({ day: today(g), with: id, kind, label });
      if (s.statements.length > 20) s.statements.length = 20;
      news(g, `日本と${shortName(g, id)}が「${label}」の共同声明を発表した`);
      return { ok: true, success: true, text: `「${label}」の共同声明を発表した。` };
    },
  },
  fta: {
    name: '経済連携協定（EPA・FTA）', who: ['pm', 'foreign'], target: 'trade', desc: '関税を下げ、貿易と投資を広げる協定を結ぶ。交渉 → 署名 → 国会の承認 → 発効。',
    check(g, id) {
      if (!id) return '相手を選ぶ';
      if (!exists(g, id)) return 'その相手はいまはない';
      if (COUNTRIES[id] && !hasTies(g, id)) return `${shortName(g, id)}とは国交がない`;
      if (treatyWith(g, id, 'fta') || treatiesNow(g).some((t) => t.kind === 'fta' && t.with.includes(id))) return 'すでに経済連携協定を結んでいる';
      if (atWarWith(g, id)) return '戦争中の相手とは結べない（まず講和）';
      return null;
    },
    odds: (g, id) => clamp((COUNTRIES[id] ? baseOdds(g, id, -0.1) : 0.45 + (W(g).standing - 60) / 200) * dietOdds(g), 0.04, 0.9),
    lines: (g, id) => [`日本の貿易に占める割合（目安）：約${COUNTRIES[id] ? tradeOf(g, id) : orgTrade(g, id)}%`, '成功：景気・株価にプラス。関係＋5。農業の関税が下がり、農林漁業の層は反発する', `国会の承認の見込み：${pct(dietOdds(g))}`, since(g, 20021130) ? null : '（現実には、日本の最初の経済連携協定は2002年のシンガポールとの協定）'].filter(Boolean),
    run(g, id) {
      const pNeg = COUNTRIES[id] ? baseOdds(g, id, -0.1) : clamp(0.45 + (W(g).standing - 60) / 200, 0.1, 0.9);
      useStam(g, 10);
      if (!roll(pNeg)) { if (COUNTRIES[id]) relAdd(g, id, -1); news(g, `${shortName(g, id)}との経済連携の交渉は、農産物などの扱いで合意に至らなかった`); return { ok: true, success: false, text: `交渉は合意に至らなかった（農産物の関税などで対立）。（交渉の見込み ${pct(pNeg)}）` }; }
      if (!roll(dietOdds(g))) { bumpApproval(g, -2, '協定の国会承認の失敗'); news(g, `${shortName(g, id)}との経済連携協定は署名されたが、国会で承認されなかった`); return { ok: true, success: false, text: '署名までこぎつけたが、国会で承認されなかった。' }; }
      const name = `日本・${shortName(g, id)}経済連携協定`;
      addTreaty(g, { name, kind: 'fta', with: [id] });
      if (COUNTRIES[id]) relAdd(g, id, 5); else for (const x of (dv((ORGS[id] || PSEUDO[id]).members, dateNum(g)) || [])) relAdd(g, x, 3);
      tradeShock(g, id, 1, 1, name);
      bumpApproval(g, orgTrade(g, id) > 10 || ['us', 'cn'].includes(id) ? -1 : 0.5, name);
      standingAdd(g, 1);
      ideoNudge(g, { econ: 0.8, world: -0.3 }, 0.03, name);
      news(g, `${name}が国会で承認され、発効した`);
      phone(g, `【経済ニュース】${name}が発効した。\n輸出企業には追い風、国内の農業には逆風との声。`, 'ドット新聞 経済部');
      return { ok: true, success: true, text: `${name}が発効した。輸出には追い風、農業には逆風。` };
    },
  },
  defense_pact: {
    name: '防衛協力の協定（円滑化協定など）', who: ['pm', 'defense'], target: 'country', desc: '共同訓練や部隊の往来を円滑にする協定。同盟ではない（相互防衛の義務はない）。',
    check(g, id) {
      const w = needCountry(g, id, { ties: true, notWar: true });
      if (w) return w;
      if (alliedTo(g, id)) return 'すでに同盟・安全保障の協力の枠組みがある';
      if (relation(g, id) < 0) return `関係が冷えこんでいて、交渉に入れない（関係 ${relation(g, id)}。首脳会談などで0以上にする）`;
      return null;
    },
    odds: (g, id) => clamp(baseOdds(g, id, -0.15) * dietOdds(g, 0.1), 0.04, 0.9),
    lines: (g, id) => ['成功：関係＋6・安全保障の協力相手になる。脅威が少し下がる', `${blocOf(g, id) === 'west' ? '中国・ロシアなどは警戒する（関係−2）' : '欧米は様子を見ている'}`, `国会の承認の見込み：${pct(dietOdds(g, 0.1))}`],
    run(g, id) {
      const s = W(g);
      const p = this.odds(g, id);
      if (!roll(p)) { news(g, `${shortName(g, id)}との防衛協力の協定は、交渉がまとまらなかった`); return { ok: true, success: false, text: `交渉はまとまらなかった。（見込み ${pct(p)}）` }; }
      const aid = `jp_${id}_coop`;
      s.alliances[aid] = { player: true, name: `日${shortName(g, id)}防衛協力協定`, short: `日${shortName(g, id)}協力`, kind: 'partnership', members: ['jp', id], strength: 40, since: today(g) };
      addTreaty(g, { name: `日${shortName(g, id)}防衛協力協定`, kind: 'security', with: [id] });
      relAdd(g, id, 6); threatAdd(g, -2); tensionShift(g, 1);
      for (const x of CNRU) if (x !== id && exists(g, x) && blocOf(g, id) === 'west') relAdd(g, x, -2);
      news(g, `日本と${shortName(g, id)}が防衛協力の協定を結んだ`);
      return { ok: true, success: true, text: `${shortName(g, id)}と防衛協力の協定を結んだ。` };
    },
  },
  alliance: {
    name: '同盟条約（相互防衛）を結ぶ', who: ['pm'], target: 'country', desc: '一方が攻撃されたら、もう一方が共に戦う同盟。日本が相手を守る集団的自衛権の行使が前提になる。',
    check(g, id) {
      const w = needCountry(g, id, { ties: true, notWar: true });
      if (w) return w;
      if (japanAllies(g).some((a) => a.id === id && a.kind === 'defense')) return 'すでに同盟を結んでいる';
      if (!collectiveBasis(g)) return '日本が相手国を守る法的な根拠（集団的自衛権）がない。道：①安全保障法制（存立危機事態）の法律を成立させる ②9条を改正する（交戦権の容認：発議と国民投票）③緊急事態・独裁の体制で国軍に改める';
      if (relation(g, id) < 30) return `相手が同盟に乗り気でない（関係 ${relation(g, id)}。30以上が目安）`;
      return null;
    },
    odds: (g, id) => clamp(baseOdds(g, id, -0.25) * dietOdds(g, -0.05), 0.03, 0.85),
    lines: (g, id) => [`根拠：${(collectiveBasis(g) || {}).text || 'なし'}`, '成功：同盟国になる（戦争で援軍が期待できる／相手の戦争に巻きこまれる）', '相手と対立する国々の関係が下がり、緊張が高まる', `国会の承認の見込み：${pct(dietOdds(g, -0.05))}`],
    run(g, id) {
      const s = W(g);
      const p = this.odds(g, id);
      if (!roll(p)) { relAdd(g, id, -1); news(g, `${shortName(g, id)}との同盟条約の交渉は見送られた`); return { ok: true, success: false, text: `同盟の交渉はまとまらなかった。（見込み ${pct(p)}）` }; }
      const aid = `jp_${id}_alliance`;
      s.alliances[aid] = { player: true, name: `日${shortName(g, id)}同盟条約`, short: `日${shortName(g, id)}同盟`, kind: 'defense', members: ['jp', id], strength: 55, since: today(g) };
      addTreaty(g, { name: `日${shortName(g, id)}同盟条約`, kind: 'alliance', with: [id] });
      relAdd(g, id, 10); tensionShift(g, 3);
      for (const x of countriesNow(g)) if (x !== id && pairRelation(g, x, id) < -30) relAdd(g, x, -6);
      bumpApproval(g, roll(0.5) ? 1 : -2, '同盟条約');
      ideoNudge(g, { world: 0.6 }, 0.05, '同盟条約');
      news(g, `日本と${shortName(g, id)}が同盟条約を結んだ。周辺国は反発している`);
      phone(g, `【国際ニュース】日本と${shortName(g, id)}が同盟条約（相互防衛）を結んだ。`);
      return { ok: true, success: true, text: `${shortName(g, id)}と同盟条約を結んだ。` };
    },
  },
  ties: {
    name: '国交を結ぶ・回復する', who: ['pm'], target: 'country', desc: '外交関係を開く（大使館を置く）。',
    check(g, id) {
      if (!id) return '相手を選ぶ';
      if (!exists(g, id)) return 'その国はいまはない';
      if (hasTies(g, id)) return 'すでに国交がある';
      if (atWarWith(g, id)) return '戦争中（まず講和する）';
      return null;
    },
    odds(g, id) {
      if (id === 'tw') return clamp(0.7 * dietOdds(g, -0.1), 0.05, 0.8);
      if (id === 'kp') return clamp(0.08 + (relation(g, id) + 80) / 300 + num(W(g).flags.abduction) * 0.1, 0.03, 0.7);
      return clamp(0.25 + (relation(g, id) + 60) / 200, 0.05, 0.85);
    },
    lines(g, id) {
      if (id === 'tw') return ['中国は「一つの中国」を掲げており、台湾と国交を結べば中国は日本との国交を断つ', `中国との貿易（約${tradeOf(g, 'cn')}%）が止まり、景気と株価に大きな打撃。緊張が高まる`, '台湾との関係は大きくよくなる'];
      if (id === 'kp') return ['日本人の拉致問題、核・ミサイル問題が交渉の焦点', '成功：関係が大きくよくなる。国内の評価は交渉の中身しだい'];
      return ['成功：大使館が再開し、関係がよくなる'];
    },
    run(g, id) {
      const s = W(g);
      const p = this.odds(g, id);
      if (!roll(p)) { news(g, `${shortName(g, id)}との国交の交渉はまとまらなかった`); return { ok: true, success: false, text: `交渉はまとまらなかった。（見込み ${pct(p)}）` }; }
      s.ties[id] = 'normal';
      delete s.ambassadors[id];
      relAdd(g, id, id === 'kp' ? 25 : 20);
      let more = '';
      if (id === 'tw' && exists(g, 'cn')) {
        s.ties.cn = 'cut';
        relAdd(g, 'cn', -60);
        tradeShock(g, 'cn', -1, 3, '中国との断交');
        tensionShift(g, 8);
        s.provoked.cn = today(g);
        more = '\n中国は日本との国交を断った。中国との貿易が止まり、市場は大きく下げた。';
        news(g, '中国は、日本が台湾と国交を結んだことに抗議し、日本との国交を断絶した');
      }
      standingAdd(g, id === 'tw' ? -3 : 3);
      news(g, `日本と${shortName(g, id)}が国交を結んだ`);
      phone(g, `【国際ニュース】日本と${shortName(g, id)}が国交を結んだ。${id === 'tw' ? '\n中国は日本との国交を断絶した。' : ''}`);
      return { ok: true, success: true, text: `${shortName(g, id)}と国交を結んだ。${more}` };
    },
  },
  peace_treaty: {
    name: '平和条約を結ぶ（領土問題）', who: ['pm'], target: 'country', desc: '戦後に残った平和条約の問題と、領土の扱いを決める。',
    options: () => [
      { id: 'four', label: '4島の返還で決着', sub: '日本の主張どおり。成功はかなり難しい' },
      { id: 'two', label: '2島の引き渡しで決着', sub: '1956年の宣言の線。国内に強い反発も' },
      { id: 'shelve', label: '領土問題を棚上げして結ぶ', sub: '成功しやすいが、国内の反発は大きい' },
    ],
    check(g, id) {
      const w = needCountry(g, id, { ties: true, notWar: true });
      if (w) return w;
      if (id !== 'ru' && id !== 'su') return '平和条約の問題が残っているのはロシア（ソ連）との間（中国とは1978年に平和友好条約、韓国とは1965年の基本条約）';
      if (W(g).disputes.northern && W(g).disputes.northern.status !== 'dispute') return 'すでに平和条約を結んだ';
      return null;
    },
    odds(g, id, o) {
      const talks = num((W(g).disputes.northern || {}).talks);
      const k = { four: -0.4, two: -0.15, shelve: 0.05 }[(o && o.terms) || 'two'];
      return clamp(0.2 + relation(g, id) / 150 + talks * 0.05 + k, 0.02, 0.8);
    },
    lines: (g, id, o) => [{ four: '成功：4島が日本に戻る。支持率が大きく上がる', two: '成功：歯舞群島・色丹島が日本に。残る2島は相手国の領土になり、国内で賛否が割れる', shelve: '成功：平和条約は結べるが、領土は今のまま。国内の反発で支持率が下がる' }[(o && o.terms) || 'two'], '首脳会談で「領土問題の協議」を重ねると成功しやすくなる'],
    run(g, id, o) {
      const s = W(g);
      const terms = (o && o.terms) || 'two';
      const p = this.odds(g, id, o);
      if (!roll(p)) { relAdd(g, id, -3); news(g, `${shortName(g, id)}との平和条約の交渉は、領土の扱いで決裂した`); return { ok: true, success: false, text: `交渉は領土の扱いで決裂した。（見込み ${pct(p)}）` }; }
      const D = s.disputes.northern || (s.disputes.northern = {});
      D.status = terms === 'four' ? 'resolved' : terms === 'two' ? 'partial' : 'shelved';
      D.admin = terms === 'four' ? 'jp' : 'ru';
      addTreaty(g, { name: `日${shortName(g, id)}平和条約`, kind: 'peace', with: [id] });
      relAdd(g, id, 25);
      ecoShock(g, `日${shortName(g, id)}平和条約（経済協力）`, { growth: 0.1, len: 360 });
      bumpApproval(g, terms === 'four' ? 10 : terms === 'two' ? (roll(0.5) ? 3 : -3) : -6, '平和条約');
      standingAdd(g, 4);
      const t = { four: '北方4島が日本に戻ることになった', two: '歯舞群島と色丹島が日本に引き渡されることになった', shelve: '領土問題は棚上げされた' }[terms];
      news(g, `日本と${shortName(g, id)}が平和条約に調印。${t}`);
      phone(g, `【速報】日本と${shortName(g, id)}が平和条約に調印した。\n${t}。`);
      scene(g, 'treaty', { name: `日${shortName(g, id)}平和条約`, with: id, line: t });
      return { ok: true, success: true, text: `平和条約に調印した。${t}。` };
    },
  },
  abrogate: {
    name: '条約・同盟を破棄する', who: ['pm'], target: 'none', desc: '結んでいる条約や同盟を終わらせる。',
    options(g) {
      const out = [];
      const s = W(g);
      if (allianceActive(g, ALLIANCES.anpo) && !s.alliances.anpo.notice) out.push({ id: 'anpo', label: '日米安保条約', sub: '第10条：通告から1年で終了' });
      for (const t of treatiesNow(g)) if (t.status === 'force' && ['fta', 'security', 'alliance', 'peace'].includes(t.kind)) out.push({ id: t.id, label: t.name, sub: { fta: '経済連携協定', security: '安全保障の協定', alliance: '同盟条約', peace: '平和条約' }[t.kind] });
      return out;
    },
    check(g, t, o) { const opts = this.options(g); if (!opts.length) return '破棄できる条約がない'; if (o && o.treaty && !opts.some((x) => x.id === o.treaty)) return 'その条約はいま結んでいない'; return null; },
    odds: () => null,
    lines(g, t, o) {
      const id = (o && o.treaty) || 'anpo';
      if (id === 'anpo') return ['1年後に条約が終わり、在日米軍が撤退する', '米国との関係が大きく下がり、日本の防衛は自力で（防衛費が増え、景気の重荷に）', '中国・ロシア・北朝鮮との関係は少しよくなる。地域の緊張は高まる', '国内の世論は割れる'];
      return ['相手国との関係が大きく下がり、国際的な信頼も下がる'];
    },
    run(g, t, o) {
      const s = W(g);
      const id = (o && o.treaty) || 'anpo';
      if (id === 'anpo') {
        s.alliances.anpo.notice = today(g);
        relAdd(g, 'us', -35); standingAdd(g, -4); tensionShift(g, 6); threatAdd(g, 8);
        for (const x of ['cn', 'ru', 'kp', 'su']) if (exists(g, x)) relAdd(g, x, 5);
        bumpApproval(g, roll(0.5) ? 2 : -4, '日米安保条約の終了通告');
        ideoNudge(g, { world: 0.4, nation: -0.2 }, 0.1, '日米安保条約の終了通告');
        news(g, `日本政府が米国に日米安保条約の終了を通告した（第10条）。1年後に条約は終わる`);
        phone(g, '【速報】日本が日米安保条約の終了を通告した。\n1年後に条約は終わり、在日米軍は撤退する。');
        emit(g, 'alliance', { id: 'anpo', kind: 'notice' });
        return { ok: true, success: true, text: '日米安保条約の終了を通告した。1年後に条約は終わる。' };
      }
      const T = s.treaties[id];
      if (!T) return { ok: false, why: 'その条約はない' };
      T.status = 'ended'; T.ended = today(g);
      const with0 = ((TREATIES[id] && TREATIES[id].with) || T.with || []).map((x) => current(g, x));
      for (const x of with0) { relAdd(g, x, -15); if ((TREATIES[id] || T).kind === 'fta') tradeShock(g, x, -1, 1, '協定の破棄'); }
      for (const [aid, a] of Object.entries(s.alliances)) if (a && a.player && with0.some((x) => (a.members || []).includes(x)) && (TREATIES[id] || T).kind !== 'fta') a.ended = today(g);
      standingAdd(g, -3);
      news(g, `日本政府が「${(TREATIES[id] || T).name}」を破棄した`);
      return { ok: true, success: true, text: `「${(TREATIES[id] || T).name}」を破棄した。` };
    },
  },
  ally_up: {
    name: '同盟を強化する', who: ['pm', 'defense'], target: 'none', desc: '共同訓練や役割分担を広げ、同盟の結びつきを強める（日米の外務・防衛閣僚協議など）。',
    check(g) { const a = W(g).alliances.anpo; if (!allianceActive(g, ALLIANCES.anpo)) return '日米安保条約はもう終わっている'; if (a.notice) return '終了を通告している（撤回してから）'; if (a.strength >= 100) return 'すでに最も強い'; if (W(g).flags.allyUp && today(g) - W(g).flags.allyUp < 15) return '少し前に強化したばかり（15日ほどあける）'; return null; },
    odds: () => 0.85,
    lines: () => ['同盟の強さ＋6・米国との関係＋4・脅威−2', '中国・ロシア・北朝鮮との関係−3・緊張＋2', '世論は賛否が分かれる'],
    run(g) {
      const s = W(g);
      s.flags.allyUp = today(g);
      if (!roll(0.85)) { news(g, '日米の協議は役割分担で折り合わなかった'); return { ok: true, success: false, text: '協議は役割分担で折り合わなかった。' }; }
      s.alliances.anpo.strength = clamp(s.alliances.anpo.strength + 6, 0, 100);
      relAdd(g, 'us', 4); threatAdd(g, -2); tensionShift(g, 2);
      for (const x of ['cn', 'ru', 'kp', 'su']) if (exists(g, x)) relAdd(g, x, -3);
      bumpApproval(g, roll(0.5) ? 1 : -1, '日米同盟の強化');
      ideoNudge(g, { world: 0.4, power: 0.1 }, 0.03, '同盟の強化');
      news(g, '日米が同盟の強化で合意した（共同訓練や役割分担の拡大）');
      return { ok: true, success: true, text: '日米同盟を強化した。' };
    },
  },
  ally_down: {
    name: '同盟を見直す（縮小）', who: ['pm'], target: 'none', desc: '米軍基地の縮小や地位協定の見直しを求め、同盟への依存を減らす。',
    check(g) { const a = W(g).alliances.anpo; if (!allianceActive(g, ALLIANCES.anpo)) return '日米安保条約はもう終わっている'; if (a.strength <= 10) return 'これ以上は縮小できない（終わらせるなら条約の破棄）'; return null; },
    odds: () => 0.6,
    lines: () => ['同盟の強さ−8・米国との関係−6・脅威＋3', '基地の負担が減る地域では歓迎される', '中国・ロシアとの関係は少しよくなる'],
    run(g) {
      const s = W(g);
      const ok = roll(0.6);
      s.alliances.anpo.strength = clamp(s.alliances.anpo.strength - (ok ? 8 : 3), 0, 100);
      relAdd(g, 'us', ok ? -6 : -3); threatAdd(g, 3);
      for (const x of ['cn', 'ru']) if (exists(g, x)) relAdd(g, x, 2);
      bumpApproval(g, ok ? 1 : -1, '同盟の見直し');
      news(g, ok ? '日米が在日米軍基地の一部縮小で合意した' : '同盟の見直しを求めたが、米国は慎重な姿勢を崩さなかった');
      return { ok: true, success: ok, text: ok ? '基地の一部縮小で合意した。米国との関係は冷えた。' : '米国は応じなかった。関係だけが冷えた。' };
    },
  },
  withdraw_notice: {
    name: '終了の通告を撤回する', who: ['pm'], target: 'none', desc: '日米安保条約の終了の通告を取り消す。',
    check(g) { return W(g).alliances.anpo.notice ? null : '終了を通告していない'; },
    odds: (g) => clamp(0.5 + relation(g, 'us') / 150, 0.1, 0.95),
    lines: () => ['成功：条約は続く（米国との関係＋10）'],
    run(g) {
      const s = W(g);
      const p = this.odds(g);
      if (!roll(p)) return { ok: true, success: false, text: `米国は撤回の申し入れに応じなかった。（見込み ${pct(p)}）` };
      s.alliances.anpo.notice = null;
      relAdd(g, 'us', 10);
      news(g, '日本政府が日米安保条約の終了の通告を撤回し、米国が受け入れた');
      return { ok: true, success: true, text: '通告を撤回した。条約は続く。' };
    },
  },
  sanction: {
    name: '経済制裁を科す', who: ['pm'], target: 'country', desc: '資産の凍結や輸出入の停止で圧力をかける（閣議決定）。',
    options: () => [
      { id: 1, label: '資産凍結（個人・団体）', sub: '小さな圧力。相手の反発も小さい' },
      { id: 2, label: '輸出入の一部停止', sub: '日本経済にも打撃' },
      { id: 3, label: '輸出入の全面停止', sub: '強い圧力。日本経済の打撃も大きい' },
    ],
    check(g, id, o) { const w = needCountry(g, id); if (w) return w; if (sanctioned(g, id) >= 3) return 'すでに全面的な制裁を科している'; if (o && o.level && sanctioned(g, id) >= o.level) return 'すでにその段階の制裁を科している'; return null; },
    odds: () => null,
    lines(g, id, o) {
      const lv = num(o && o.level, 1);
      const legal = LAWS.sanction(g) ? '根拠：外為法（2004年の改正で、日本独自の判断でも制裁できる）' : '根拠：外為法（この時代は、国連や主要国との協調が前提。独自に踏み切ると法的根拠が弱いと批判される）';
      return [legal, `相手との関係−${10 * lv}・相手が対抗措置をとることがある`, `日本経済への打撃：貿易の約${tradeOf(g, id)}%に影響`, '同じ陣営の国々からは評価され、相手の友好国は反発する'];
    },
    run(g, id, o) {
      const s = W(g);
      const lv = clamp(num(o && o.level, 1), 1, 3);
      const prev = sanctioned(g, id);
      s.sanctions.byJapan[id] = { level: Math.max(prev, lv), day: today(g) };
      s.record.sanctions++;
      relAdd(g, id, -10 * (lv - prev > 0 ? lv - prev : 1));
      tradeShock(g, id, -1, 0.5 * (lv - prev), `${shortName(g, id)}への制裁`);
      tensionShift(g, lv * 0.7);
      const coop = !LAWS.sanction(g) && !['us', 'gb', 'fr'].some((x) => pairRelation(g, x, id) < -50);
      if (coop) { bumpApproval(g, -2, '法的根拠の弱い制裁'); standingAdd(g, -2); }
      for (const x of countriesNow(g)) { if (x === id) continue; const pr = pairRelation(g, x, id); if (pr <= -40) relAdd(g, x, 2); else if (pr >= 40) relAdd(g, x, -3); }
      let counter = '';
      if (roll(0.25 * lv) && COUNTRIES[id]) { s.sanctions.onJapan[id] = { level: Math.min(lv, 2), day: today(g) }; tradeShock(g, id, -1, 0.3, `${shortName(g, id)}の対抗措置`); counter = `\n${shortName(g, id)}は対抗措置として、日本への制裁を発表した。`; }
      s.provoked[id] = today(g);
      ideoNudge(g, { world: 0.5 }, 0.03, '経済制裁');
      news(g, `日本政府が${shortName(g, id)}への経済制裁（${['', '資産凍結', '輸出入の一部停止', '輸出入の全面停止'][lv]}）を閣議決定した`);
      return { ok: true, success: true, text: `${shortName(g, id)}に制裁を科した（${['', '資産凍結', '輸出入の一部停止', '輸出入の全面停止'][lv]}）。${counter}` };
    },
  },
  lift: {
    name: '制裁を解除する', who: ['pm'], target: 'country', desc: '科している経済制裁をやめる。',
    check(g, id) { const w = needCountry(g, id); if (w) return w; return sanctioned(g, id) ? null : 'この国には制裁を科していない'; },
    odds: () => null,
    lines: () => ['相手との関係＋8・貿易が戻る', '制裁で足並みをそろえていた国々は不満をもつ'],
    run(g, id) {
      const s = W(g);
      const lv = sanctioned(g, id);
      delete s.sanctions.byJapan[id];
      relAdd(g, id, 8);
      tradeShock(g, id, 1, 0.4 * lv, `${shortName(g, id)}への制裁の解除`);
      for (const x of ['us', 'gb', 'fr', 'de']) if (exists(g, x) && pairRelation(g, x, id) < -40) relAdd(g, x, -3);
      news(g, `日本政府が${shortName(g, id)}への経済制裁を解除した`);
      return { ok: true, success: true, text: `${shortName(g, id)}への制裁を解除した。` };
    },
  },
  aid: {
    name: '経済援助（ODA）', who: ['pm', 'foreign'], target: 'country', desc: '政府開発援助（無償資金・円借款・技術協力）で、相手国の発展を支える。',
    options: () => [
      { id: 1, label: '技術協力・無償資金（小）', sub: '約100億円' },
      { id: 2, label: '円借款（中）', sub: '約1,000億円' },
      { id: 3, label: '大型の援助（大）', sub: '約5,000億円' },
    ],
    check(g, id) { const w = needCountry(g, id, { notWar: true }); if (w) return w; if (['us', 'gb', 'fr', 'wde', 'de', 'it', 'ca', 'au'].includes(id)) return '先進国はODAの対象ではない'; if (W(g).flags['aid_' + id] && today(g) - W(g).flags['aid_' + id] < 15) return 'この国には少し前に援助を決めたばかり'; return null; },
    odds: () => null,
    lines(g, id, o) {
      const lv = num(o && o.level, 1);
      return [`関係＋${[0, 3, 7, 12][lv]}・国際的な信頼＋${[0, 1, 2, 4][lv]}`, `費用：${['', '約100億円', '約1,000億円', '約5,000億円'][lv]}（ODA予算）`, hasTies(g, id) ? null : '国交がないため、国際機関を通じた人道支援（食料・医療）になる'].filter(Boolean);
    },
    run(g, id, o) {
      const s = W(g);
      const lv = clamp(num(o && o.level, 1), 1, 3);
      s.flags['aid_' + id] = today(g);
      s.aid[id] = num(s.aid[id]) + [0, 0.01, 0.1, 0.5][lv];
      s.record.aid++;
      relAdd(g, id, [0, 3, 7, 12][lv]);
      standingAdd(g, [0, 1, 2, 4][lv]);
      if (lv === 3) { const p = pol(g); if (p && p.economy && num(p.economy.growth) < 0.5) bumpApproval(g, -1, '大型の対外援助'); }
      ideoNudge(g, { world: -0.6 }, 0.02, 'ODA');
      const how = hasTies(g, id) ? ['', '技術協力と無償資金', '円借款', '大型の援助'][lv] : '国際機関を通じた人道支援';
      news(g, `日本政府が${shortName(g, id)}への${how}を決めた`);
      return { ok: true, success: true, text: `${shortName(g, id)}への${how}を決めた。` };
    },
  },
  protest: {
    name: '抗議する（外交ルート）', who: ['pm', 'foreign'], target: 'country', desc: '大使を呼んで抗議する。',
    check(g, id) { const w = needCountry(g, id); if (w) return w; if (W(g).flags['prot_' + id] === today(g)) return '今日はもう抗議した'; return null; },
    odds: () => null,
    lines: () => ['相手との関係−2。毅然とした対応は国内で評価されやすい'],
    run(g, id) {
      const s = W(g);
      s.flags['prot_' + id] = today(g);
      relAdd(g, id, -2);
      const inc = s.crises.find((c) => c.country === id && today(g) - num(c.day) <= 5 && !c.handled.protest);
      if (inc) { inc.handled.protest = today(g); bumpApproval(g, 1, '毅然とした抗議'); }
      news(g, `日本政府が${shortName(g, id)}に${hasTies(g, id) ? '外交ルートで' : '第三国の大使館を通じて'}抗議した`);
      return { ok: true, success: true, text: `${shortName(g, id)}に抗議した。` };
    },
  },
  recall: {
    name: '大使を召還する', who: ['pm', 'foreign'], target: 'country', desc: '抗議の意思を示すため、駐在の大使を一時帰国させる。',
    check(g, id) { const w = needCountry(g, id, { ties: true }); if (w) return w; return W(g).ambassadors[id] === 'recalled' ? 'すでに召還している' : null; },
    odds: () => null,
    lines: () => ['関係−10・緊張＋2。相手も大使を引き揚げることがある', '国内では「毅然とした対応」と評価する声と、対話を求める声がある'],
    run(g, id) {
      const s = W(g);
      s.ambassadors[id] = 'recalled';
      relAdd(g, id, -10); tensionShift(g, 2); s.provoked[id] = today(g);
      bumpApproval(g, roll(0.5) ? 1 : -1, '大使の召還');
      news(g, `日本政府が駐${shortName(g, id)}大使を召還した`);
      return { ok: true, success: true, text: `駐${shortName(g, id)}大使を召還した。` };
    },
  },
  return_amb: {
    name: '大使を帰任させる', who: ['pm', 'foreign'], target: 'country', desc: '召還していた大使を任地に戻す。',
    check(g, id) { const w = needCountry(g, id, { ties: true }); if (w) return w; return W(g).ambassadors[id] === 'recalled' ? null : '大使を召還していない'; },
    odds: () => null,
    lines: () => ['関係＋4'],
    run(g, id) { delete W(g).ambassadors[id]; relAdd(g, id, 4); news(g, `駐${shortName(g, id)}大使が任地に戻った`); return { ok: true, success: true, text: '大使を帰任させた。' }; },
  },
  cut_ties: {
    name: '国交を断絶する', who: ['pm'], target: 'country', desc: '外交関係を断ち、大使館を閉じる。',
    check(g, id) { return needCountry(g, id, { ties: true }); },
    odds: () => null,
    lines: (g, id) => ['関係−30・緊張＋5。大使館が閉じられ、在留の日本人は退避が必要になる', `貿易（約${tradeOf(g, id)}%）が大きく落ちこみ、景気と株価に打撃`, '国際的な信頼が下がる'],
    run(g, id) {
      const s = W(g);
      s.ties[id] = 'cut';
      delete s.ambassadors[id];
      relAdd(g, id, -30); tensionShift(g, 5); standingAdd(g, -4); s.provoked[id] = today(g);
      tradeShock(g, id, -1, 2, `${shortName(g, id)}との断交`);
      bumpApproval(g, -2, '国交の断絶');
      news(g, `日本政府が${shortName(g, id)}との国交を断絶した`);
      phone(g, `【速報】日本が${shortName(g, id)}との国交を断絶した。\n大使館が閉じられ、在留の日本人に退避が呼びかけられている。`);
      return { ok: true, success: true, text: `${shortName(g, id)}との国交を断絶した。` };
    },
  },
  mediate: {
    name: '紛争を仲介する', who: ['pm', 'foreign'], target: 'conflict', desc: '戦っている国々の間に入り、停戦を働きかける。',
    check(g, cid) { const c = conflictById(g, cid); if (!c) return '紛争を選ぶ'; if (c.status !== 'war') return 'すでに停戦している'; if (c.japan) return '日本が一方に加わっている（仲介役にはなれない）'; if (c.mediated && today(g) - c.mediated < 10) return '少し前に仲介を試みたばかり'; return null; },
    odds(g, cid) { const c = conflictById(g, cid); if (!c) return 0; return clamp(0.12 + W(g).standing / 400 + (Math.min(relation(g, c.a), relation(g, c.b)) + 20) / 300 - num(c.intensity, 2) * 0.04, 0.03, 0.55); },
    lines: () => ['成功：停戦が成立し、国際的な信頼が大きく上がる（支持率＋）', '失敗しても大きな損はない'],
    run(g, cid) {
      const c = conflictById(g, cid);
      const p = this.odds(g, cid);
      c.mediated = today(g);
      if (!roll(p)) { standingAdd(g, 0.5); news(g, `日本の仲介にもかかわらず、${c.name}の停戦は実現しなかった`); return { ok: true, success: false, text: `仲介は実らなかった。（見込み ${pct(p)}）` }; }
      endConflict(g, c.id, 'ceasefire', `日本の仲介で、${c.name}の停戦が成立した`);
      standingAdd(g, 8); relAdd(g, c.a, 6); relAdd(g, c.b, 6);
      bumpApproval(g, 3, '紛争の仲介');
      return { ok: true, success: true, text: `日本の仲介で停戦が成立した！` };
    },
  },
  un_raise: {
    name: '国連安保理に提起する', who: ['pm', 'foreign'], target: 'country', desc: '相手国の行動を国連安全保障理事会で取り上げるよう求める。',
    check(g, id) { const w = needCountry(g, id); if (w) return w; if (W(g).flags['unr_' + id] && today(g) - W(g).flags['unr_' + id] < 20) return '少し前に提起したばかり'; return null; },
    odds(g, id) { const p5 = ['us', 'gb', 'fr', 'cn', 'ru', 'su'].filter((x) => exists(g, x) && x !== id); const veto = p5.some((x) => pairRelation(g, x, id) > 30); return veto ? 0.15 : clamp(0.45 + W(g).standing / 300, 0.2, 0.85); },
    lines: (g) => [`安保理の常任理事国（米・英・仏・中・${since(g, 19911226) ? 'ロシア' : 'ソ連'}）の一国でも拒否権を使えば、決議は通らない`, `成功：相手国への国際的な圧力（関係−5）・日本の信頼＋${W(g).unsc.member ? '3（非常任理事国として）' : '2'}`],
    run(g, id) {
      const s = W(g);
      s.flags['unr_' + id] = today(g);
      const p = this.odds(g, id);
      relAdd(g, id, -5);
      if (!roll(p)) { news(g, `${shortName(g, id)}をめぐる安保理の決議案は、拒否権などで採択されなかった`); return { ok: true, success: false, text: `決議は採択されなかった（拒否権など）。（見込み ${pct(p)}）` }; }
      standingAdd(g, s.unsc.member ? 3 : 2);
      pairAdd(g, 'us', id, -3);
      news(g, `国連安保理が${shortName(g, id)}の行動を非難する決議（議長声明）を採択した。日本が提起していた`);
      return { ok: true, success: true, text: '安保理で非難の決議（議長声明）が採択された。' };
    },
  },
  jdr: {
    name: '国際緊急援助隊を送る', who: ['pm', 'foreign', 'defense'], target: 'crisis', desc: '海外の大災害に、救助・医療チームを送る（国際緊急援助隊法）。',
    check(g, kid) { const c = crisisById(g, kid); if (!c) return '危機を選ぶ'; if (!['disaster', 'humanitarian'].includes(c.kind)) return '災害・人道危機のときに送る'; if (c.handled.jdr) return 'すでに送った'; if (!LAWS.jdr(g)) return '国際緊急援助隊法がまだない（現実には1987年9月施行）。医療チームの派遣（1979年〜）にとどまる'; return null; },
    odds: () => 0.9,
    lines: (g) => [LAWS.jdrSdf(g) ? '救助・医療・専門家のチーム（自衛隊の輸送・医療部隊も加われる：1992年の改正）' : '救助・医療・専門家のチーム（自衛隊の参加は1992年の改正から）', '関係＋6・国際的な信頼＋2'],
    run(g, kid) {
      const c = crisisById(g, kid);
      c.handled.jdr = today(g);
      relAdd(g, c.country, 6); standingAdd(g, 2); bumpApproval(g, 1, '国際緊急援助隊の派遣');
      W(g).record.deployments++;
      news(g, `${shortName(g, c.country)}の災害に、日本の国際緊急援助隊が到着した`);
      return { ok: true, success: true, text: '国際緊急援助隊が現地に向かった。' };
    },
  },
  evac: {
    name: '在外邦人を退避させる', who: ['pm', 'defense'], target: 'crisis', desc: '危険が迫った国から、日本人を国外へ運ぶ。',
    check(g, kid) { const c = crisisById(g, kid); if (!c) return '危機を選ぶ'; if (!['coup', 'war', 'unrest', 'clash'].includes(c.kind)) return '政変・戦争などで日本人に危険が迫ったときに行う'; if (c.handled.evac) return 'すでに退避させた'; return null; },
    odds: (g) => (LAWS.evacSdf(g) ? 0.9 : 0.75),
    lines: (g) => [LAWS.evacSdf(g) ? '自衛隊機・政府専用機で運ぶ（自衛隊法の在外邦人の輸送：1994年の改正）' : '民間のチャーター機を手配する（自衛隊機は1994年の法改正から）', '成功：支持率＋2　失敗：支持率−3'],
    run(g, kid) {
      const c = crisisById(g, kid);
      c.handled.evac = today(g);
      const p = this.odds(g);
      if (!roll(p)) { bumpApproval(g, -3, '邦人退避の遅れ'); news(g, `${shortName(g, c.country)}からの日本人の退避が遅れ、取り残された人がいると批判が出ている`); return { ok: true, success: false, text: '退避が遅れ、批判を浴びた。' }; }
      bumpApproval(g, 2, '在外邦人の退避');
      news(g, `${shortName(g, c.country)}にいた日本人${rint(80, 900)}人が、${LAWS.evacSdf(g) ? '自衛隊機' : 'チャーター機'}で国外に退避した`);
      return { ok: true, success: true, text: '日本人を無事に国外へ退避させた。' };
    },
  },
  reserve: {
    name: '石油の備蓄を放出する', who: ['pm'], target: 'crisis', desc: '原油が急に値上がりしたとき、国の石油備蓄を放出して値上がりをおさえる（国家備蓄は1978年から）。',
    check(g, kid) { const c = crisisById(g, kid); if (!c) return '危機を選ぶ'; if (c.kind !== 'oil') return '原油の急な値上がりのときに行う'; if (c.handled.reserve) return 'すでに放出した'; return null; },
    odds: () => 0.8,
    lines: () => ['物価の上がり方をおさえる（物価−0.4）', '主要国と協調すれば効果が大きい'],
    run(g, kid) { const c = crisisById(g, kid); c.handled.reserve = today(g); const ok = roll(0.8); ecoShock(g, '石油備蓄の放出', { inflation: ok ? -0.4 : -0.15, growth: ok ? 0.15 : 0.05, len: 90 }); W(g).oil = Math.max(80, W(g).oil - (ok ? 12 : 4)); bumpApproval(g, 1, '石油備蓄の放出'); news(g, `政府が国の石油備蓄の放出を決めた${ok ? '。主要国も協調し、原油価格は落ち着きはじめた' : ''}`); return { ok: true, success: ok, text: ok ? '主要国と協調して備蓄を放出した。原油価格が落ち着いた。' : '備蓄を放出したが、効果は限られた。' }; },
  },
  coordinate: {
    name: '主要国と協調して対策する', who: ['pm'], target: 'crisis', desc: '金融危機のとき、主要国と協調して市場を支える（協調利下げ・資金の供給など）。',
    check(g, kid) { const c = crisisById(g, kid); if (!c) return '危機を選ぶ'; if (c.kind !== 'finance' && c.kind !== 'trade') return '金融危機・貿易摩擦のときに行う'; if (c.handled.coord) return 'すでに協調した'; return null; },
    odds: (g) => clamp(0.55 + W(g).standing / 300, 0.3, 0.9),
    lines: (g, kid) => [(crisisById(g, kid) || {}).kind === 'trade' ? '交渉で摩擦をおさめる（輸出の自主規制などの譲歩を含む）' : '株価の下落と景気の冷えこみをやわらげる', '成功：景気＋・株価＋・支持率＋1'],
    run(g, kid) {
      const c = crisisById(g, kid);
      c.handled.coord = today(g);
      const p = this.odds(g);
      if (!roll(p)) { news(g, '主要国の協調はまとまらなかった'); return { ok: true, success: false, text: `協調はまとまらなかった。（見込み ${pct(p)}）` }; }
      ecoShock(g, c.kind === 'trade' ? '貿易摩擦の決着' : '国際協調の対策', { growth: 0.5, nikkei: 5, len: 180 });
      if (c.kind === 'trade') relAdd(g, c.country, 6);
      bumpApproval(g, 1, '国際協調');
      c.until = today(g);
      news(g, c.kind === 'trade' ? `日本と${shortName(g, c.country)}の貿易交渉が決着した` : '主要国が協調して市場を支える対策を打ち出した。市場は落ち着きを取り戻しつつある');
      return { ok: true, success: true, text: c.kind === 'trade' ? '交渉で摩擦をおさめた。' : '主要国と協調した対策で、市場が落ち着いた。' };
    },
  },
  rear: {
    name: '後方支援で自衛隊を派遣する', who: ['pm', 'defense'], target: 'conflict', desc: '戦っている同盟国・友好国の部隊に、補給・輸送・医療などで協力する（戦闘には加わらない）。',
    check(g, cid) {
      const c = conflictById(g, cid);
      if (!c) return '紛争を選ぶ';
      if (c.status !== 'war') return 'すでに停戦している';
      if (c.japan) return 'すでに日本が関わっている';
      if (!pickSide(g, c)) return 'どちらの側も日本の同盟国・友好国ではない（関係30以上が目安）';
      return null;
    },
    odds(g, cid) { const L = rearLaw(g, conflictById(g, cid)); return L.need ? clamp(dietOdds(g, -0.15), 0.04, 0.9) : clamp(dietOdds(g, 0.1), 0.05, 0.95); },
    lines(g, cid) {
      const c = conflictById(g, cid); const L = rearLaw(g, c); const side = pickSide(g, c);
      return [`支援する側：${shortName(g, side)}（相手：${shortName(g, other(c, side))}）`, `根拠：${L.text}`, L.need ? '特別措置法を国会で成立させる必要がある（見込みは下）' : `国会の承認の見込み：${pct(dietOdds(g, 0.1))}`, `支援する側との関係＋8・相手との関係−12。世論は割れる（支持率−1〜−3）`, '戦闘地域の外で活動するが、危険はゼロではない'];
    },
    run(g, cid) {
      const s = W(g);
      const c = conflictById(g, cid);
      const L = rearLaw(g, c);
      const p = this.odds(g, cid);
      const side = pickSide(g, c);
      if (!roll(p)) { bumpApproval(g, -1, '後方支援の法案の不成立'); news(g, `${c.name}での後方支援の${L.need ? '特別措置法案' : '国会承認'}は、国会で通らなかった`); return { ok: true, success: false, text: `国会で通らなかった。（見込み ${pct(p)}）` }; }
      c.japan = { role: 'rear', side, day: today(g) };
      s.deploy.push({ id: 'd' + s.seq++, kind: 'rear', where: `${shortName(g, side)}軍の後方`, mission: `${c.name}での後方支援`, personnel: rint(400, 1500), law: L.text, startDay: today(g), conflict: c.id });
      s.record.deployments++;
      relAdd(g, side, 8); relAdd(g, other(c, side), -12); s.provoked[other(c, side)] = today(g);
      bumpApproval(g, -rint(1, 3), '後方支援の派遣');
      if (side === 'us') s.alliances.anpo.strength = clamp(s.alliances.anpo.strength + 4, 0, 100);
      ideoNudge(g, { world: 0.5 }, 0.05, '後方支援の派遣');
      news(g, `政府は${c.name}で${shortName(g, side)}軍への後方支援のため、自衛隊の派遣を決めた（${L.text}）`);
      return { ok: true, success: true, text: `自衛隊が後方支援に向かった（${L.text}）。` };
    },
  },
  collective: {
    name: '集団的自衛権で参戦する', who: ['pm'], target: 'conflict', desc: '攻撃を受けた同盟国を守るため、武力を行使する（存立危機事態の認定・国会の承認）。',
    check(g, cid) {
      const c = conflictById(g, cid);
      if (!c) return '紛争を選ぶ';
      if (c.status !== 'war') return 'すでに停戦している';
      if (japanWar(g) && japanWar(g).phase === 'war') return 'いまは別の戦争をしている';
      const ally = japanAllies(g).find((a) => a.kind !== 'law' && (a.id === c.a || a.id === c.b));
      if (!ally) return '戦っているどちらの国も、日本の同盟国・安全保障の協力相手ではない';
      if (!collectiveBasis(g)) return '集団的自衛権を行使する法的な根拠がない。道：①安全保障法制（存立危機事態）を成立させる（政治の「法案を出す」：安全保障法制の整備）②9条の改正（交戦権の容認）③緊急事態・独裁の体制で国軍に改める';
      return null;
    },
    odds(g, cid) { const b = collectiveBasis(g); const c = conflictById(g, cid); const ally = c && japanAllies(g).find((a) => a.id === c.a || a.id === c.b); const near = c && (NEAR.includes(c.a) || NEAR.includes(c.b)); if (!b) return 0; if (b.kind === 'army') return 1; return clamp(dietOdds(g, (near ? 0.05 : -0.15) + (ally && ally.kind === 'defense' ? 0.05 : -0.1) + (b.kind === 'art9' ? 0.1 : 0)), 0.03, 0.9); },
    lines(g, cid) {
      const c = conflictById(g, cid); const b = collectiveBasis(g);
      const ally = c && japanAllies(g).find((a) => a.id === c.a || a.id === c.b);
      return [`守る相手：${ally ? shortName(g, ally.id) : '―'}（${ally ? ally.name : ''}）`, `根拠：${b ? b.text : 'なし'}`, b && b.kind !== 'army' ? `存立危機事態の認定と国会の承認の見込み：${pct(this.odds(g, cid))}` : '独裁体制：政令で決める', '戦争になる：兵士と民間人の命が失われ、相手国の反撃を受ける。経済も傷つく'];
    },
    run(g, cid) {
      const c = conflictById(g, cid);
      const ally = japanAllies(g).find((a) => a.id === c.a || a.id === c.b);
      const enemy = other(c, ally.id);
      const p = this.odds(g, cid);
      if (!roll(p)) { bumpApproval(g, -2, '参戦案の否決'); news(g, `${c.name}での存立危機事態の認定は、国会で承認されなかった`); return { ok: true, success: false, text: `国会の承認が得られなかった。（見込み ${pct(p)}）` }; }
      if (typeof g.warOrder !== 'function') return { ok: false, why: '戦争の仕組み（体制コア）が読み込まれていない' };
      const res = g.warOrder('declare', { target: enemy, mode: 'alliance', ally: ally.id, conflict: c.id });
      if (res && res.ok) c.japan = { role: 'collective', side: ally.id, day: today(g) };
      return res && res.ok ? { ...res, success: true } : res || { ok: false, why: '参戦できなかった' };
    },
  },
  dispatch: {
    name: '派兵する（戦闘部隊）', who: ['pm'], target: 'conflict', desc: '紛争の一方に味方して、戦闘部隊を送る。',
    options(g, cid) { const c = conflictById(g, cid); return c ? [c.a, c.b].map((x) => ({ id: x, label: `${shortName(g, x)}に味方する`, sub: `関係 ${relation(g, x)}` })) : []; },
    check(g, cid) {
      const c = conflictById(g, cid);
      if (!c) return '紛争を選ぶ';
      if (c.status !== 'war') return 'すでに停戦している';
      if (japanWar(g) && japanWar(g).phase === 'war') return 'いまは別の戦争をしている';
      const b = collectiveBasis(g);
      if (!b || b.kind === 'law') return '戦闘部隊を外国の戦争に送る根拠がない（平和安全法制でも、存立危機事態に限られる）。道：①9条の改正（交戦権の容認）②緊急事態・独裁の体制で国軍に改める（同盟国が攻撃されたのなら「集団的自衛権で参戦」）';
      return null;
    },
    odds(g) { const b = collectiveBasis(g); return b && b.kind === 'army' ? 1 : clamp(dietOdds(g, -0.1), 0.03, 0.9); },
    lines: (g) => ['戦争になる：兵士と民間人の命が失われる。相手国とその友好国の関係は大きく下がる', regimeId(g) === 'democracy' ? `国会の承認の見込み：${pct(dietOdds(g, -0.1))}` : '独裁体制：政令で決める'],
    run(g, cid, o) {
      const c = conflictById(g, cid);
      const side = o && (o.side === c.a || o.side === c.b) ? o.side : pickSide(g, c) || c.a;
      const p = this.odds(g);
      if (!roll(p)) { bumpApproval(g, -2, '派兵案の否決'); return { ok: true, success: false, text: `国会の承認が得られなかった。（見込み ${pct(p)}）` }; }
      if (typeof g.warOrder !== 'function') return { ok: false, why: '戦争の仕組み（体制コア）が読み込まれていない' };
      const res = g.warOrder('declare', { target: other(c, side), mode: 'alliance', ally: side, conflict: c.id });
      if (res && res.ok) c.japan = { role: 'dispatch', side, day: today(g) };
      return res && res.ok ? { ...res, success: true } : res || { ok: false, why: '派兵できなかった' };
    },
  },
  declare: {
    name: '宣戦布告', who: ['pm'], target: 'country', desc: '相手国に宣戦を布告し、戦争を始める。',
    check(g, id) {
      if (!id) return '相手を選ぶ';
      if (!exists(g, id)) return 'その国はいまはない';
      if (typeof g.regimeRefusal !== 'function') return '戦争の仕組み（体制コア）が読み込まれていない';
      return g.regimeRefusal('declare', { target: id });
    },
    odds: () => null,
    lines(g, id) {
      const info = countryInfo(g, id);
      const al = info ? info.allies.filter((x) => exists(g, x)).map((x) => shortName(g, x)) : [];
      return [`相手：${countryName(g, id)}（軍事力の目安 ${info ? info.mil : '?'}／日本 ${jpMil(g)}）`, al.length ? `相手の同盟国：${al.join('・')}（参戦してくるかもしれない）` : '相手に同盟国はない', info && info.nuclear ? '相手は核兵器を持つ国。全面戦争にはならず、係争地や海・空での限定的な戦いになる' : null, '兵士と民間人の命が失われる。国際社会の非難と制裁、経済の打撃', `日本の同盟国が加わるかは、日本の大義しだい（攻める側だと加わりにくい）`].filter(Boolean);
    },
    run(g, id) { return g.warOrder('declare', { target: id }); },
  },
  peace_conf: {
    name: '講和条約を結ぶ', who: ['pm'], target: 'none', desc: '停戦した相手と講和条約を結び、戦争を正式に終わらせる。',
    options: (g) => { const P = W(g).peace; const area = P && P.area ? P.area : '係争地'; return [{ id: 'status', label: '戦前の状態に戻す', sub: '成功しやすい' }, { id: 'keep', label: `${area}を日本の側に`, sub: '戦況がよくないと難しい' }, { id: 'cede', label: `${area}を相手に譲る`, sub: '成功しやすいが、国内の反発が大きい' }]; },
    check(g) { const P = W(g).peace; if (!P) return '講和を待っている戦争はない（停戦が成立すると講和の交渉に入れる）'; return null; },
    odds(g, t, o) { const P = W(g).peace; if (!P) return 0; const k = { status: 0.15, keep: -0.25 + num(P.front) / 200, cede: 0.35 }[(o && o.terms) || 'status']; return clamp(0.45 + k + (W(g).standing - 50) / 300, 0.05, 0.95); },
    lines: (g, t, o) => [{ status: '国境・係争地は戦争の前のまま', keep: '係争地が日本の施政のもとに入る（支持率＋、相手の恨みは残る）', cede: '係争地は相手のものに（支持率が大きく下がる）' }[(o && o.terms) || 'status'], '成功：制裁が解かれはじめ、相手との国交が戻る（関係＋30）'],
    run(g, t, o) {
      const s = W(g);
      const P = s.peace;
      const terms = (o && o.terms) || 'status';
      const p = this.odds(g, t, o);
      if (!roll(p)) { P.tries = num(P.tries) + 1; news(g, `${countryName(g, P.enemy, true)}との講和会議は、条件で折り合わなかった`); return { ok: true, success: false, text: `条件で折り合わなかった。（見込み ${pct(p)}）。条件を変えて、また交渉できる。` }; }
      s.peace = null;
      s.ties[P.enemy] = 'normal';
      relAdd(g, P.enemy, 30);
      for (const [cid, v] of Object.entries(s.sanctions.onJapan)) if (v && v.war) delete s.sanctions.onJapan[cid];
      standingAdd(g, 5);
      const D = COUNTRIES[P.enemy] && COUNTRIES[P.enemy].dispute;
      if (D && s.disputes[D]) { if (terms === 'keep') s.disputes[D].admin = 'jp'; if (terms === 'cede') s.disputes[D].admin = P.enemy; }
      bumpApproval(g, terms === 'keep' ? 6 : terms === 'cede' ? -8 : 2, '講和条約');
      addTreaty(g, { name: `日${countryName(g, P.enemy, true)}講和条約`, kind: 'peace', with: [P.enemy] });
      const tt = { status: '国境は戦争の前のままとされた', keep: `${P.area || '係争地'}は日本の施政のもとに入った`, cede: `${P.area || '係争地'}は相手国のものとされた` }[terms];
      news(g, `日本と${countryName(g, P.enemy, true)}が講和条約に調印した。${tt}`);
      phone(g, `【講和】日本と${countryName(g, P.enemy, true)}が講和条約に調印した。\n${tt}。\n戦死した人たちの遺族が、静かに式典を見守った。`);
      scene(g, 'treaty', { name: `日${countryName(g, P.enemy, true)}講和条約`, with: P.enemy, line: tt, peace: true });
      emit(g, 'peace', { enemy: P.enemy, terms });
      return { ok: true, success: true, text: `講和条約に調印した。${tt}。` };
    },
  },
  un_speech: {
    name: '国連総会で演説する', who: ['pm'], target: 'none', desc: '毎年9月の国連総会の一般討論で、日本の立場を世界に伝える。',
    check(g) { const d = worldDate(g); if (d.month !== 9) return '国連総会の一般討論は毎年9月（いまは9月ではない）'; if (W(g).flags.unSpeech === d.year) return '今年はもう演説した'; if (W(g).flags.leftUN) return '日本は国連を脱退している'; return null; },
    odds: () => 0.85,
    lines: () => ['国際的な信頼＋2・支持率＋1（体力15）'],
    run(g) { const s = W(g); s.flags.unSpeech = worldDate(g).year; useStam(g, 15); standingAdd(g, 2); bumpApproval(g, 1, '国連総会での演説'); news(g, `${who0(g)}が国連総会で一般討論演説を行った`); return { ok: true, success: true, text: '国連総会で演説した。各国の代表が耳を傾けた。' }; },
  },
  unsc_run: {
    name: '安保理の非常任理事国に立候補する', who: ['pm', 'foreign'], target: 'none', desc: '国連総会の選挙で、安全保障理事会の非常任理事国（任期2年）をめざす。',
    check(g) { const u = W(g).unsc; if (W(g).flags.leftUN) return '日本は国連を脱退している'; if (u.member) return 'いまは非常任理事国（任期中）'; if (u.candidate) return 'すでに立候補している'; return null; },
    odds: (g) => unscOdds(g),
    lines: (g) => [`選挙：${unscNextText(g)}`, `当選の見込み：${pct(unscOdds(g))}（国際的な信頼・援助で上がる）`, '当選：国際的な信頼＋5。安保理で発言力が増す'],
    run(g) { const u = W(g).unsc; u.candidate = true; if (!u.next || u.next < dateNum(g)) u.next = nextUnscVote(g); news(g, `日本が国連安保理の非常任理事国選挙への立候補を表明した（${unscNextText(g)}）`); return { ok: true, success: true, text: `立候補を表明した。${unscNextText(g)}` }; },
  },
  leave_un: {
    name: '国連から脱退する', who: ['pm'], target: 'none', desc: '国際連合から脱退する（国連憲章に脱退の規定はないが、事実上の離脱）。',
    check(g) { return W(g).flags.leftUN ? 'すでに脱退している' : null; },
    odds: () => null,
    lines: () => ['国際的な信頼が大きく下がる（−40）。ほぼすべての国との関係が下がり、主要国が制裁を検討する', 'PKOや国連の枠組みでの活動はできなくなる'],
    run(g) {
      const s = W(g);
      s.flags.leftUN = today(g);
      s.unsc.member = false; s.unsc.candidate = false;
      standingAdd(g, -40); tensionShift(g, 8);
      for (const x of countriesNow(g)) relAdd(g, x, -12);
      for (const x of ['us', 'gb', 'fr', 'de']) if (exists(g, x) && roll(0.4)) s.sanctions.onJapan[x] = { level: 1, day: today(g) };
      bumpApproval(g, -6, '国連からの脱退');
      ideoNudge(g, { world: 1, nation: -0.3 }, 0.15, '国連からの脱退');
      news(g, '日本が国際連合からの脱退を表明した。各国は強い懸念を示している');
      phone(g, '【速報】日本が国連からの脱退を表明した。\n各国は強い懸念を示し、主要国の一部が制裁を検討している。');
      return { ok: true, success: true, text: '国連からの脱退を表明した。日本は国際社会で孤立しはじめた。' };
    },
  },
  rejoin_un: {
    name: '国連に復帰する', who: ['pm'], target: 'none', desc: '国連への復帰を申請する（安保理の勧告と総会の承認が必要）。',
    check(g) { return W(g).flags.leftUN ? null : '日本は国連の加盟国'; },
    odds(g) { return clamp(0.2 + W(g).standing / 120, 0.1, 0.9); },
    lines: () => ['成功：国際的な信頼＋10。常任理事国が拒否権を使うと失敗する'],
    run(g) { const s = W(g); const p = this.odds(g); if (!roll(p)) return { ok: true, success: false, text: `安保理の勧告が得られなかった。（見込み ${pct(p)}）` }; s.flags.leftUN = 0; standingAdd(g, 10); news(g, '日本が国連に復帰した'); return { ok: true, success: true, text: '国連に復帰した。' }; },
  },
  donate: {
    name: '人道支援に募金する', who: ['any'], target: 'crisis', desc: '災害や紛争で苦しむ人たちのために、支援団体に寄付する。',
    check(g, kid) { const c = crisisById(g, kid); if (!c) return '危機を選ぶ'; if (!['disaster', 'humanitarian', 'war', 'clash'].includes(c.kind)) return 'この危機には募金の窓口がない'; if (c.handled['donate_' + today(g)]) return '今日はもう寄付した'; if (num(g.state && g.state.money) < 1000) return 'お金が足りない'; return null; },
    odds: () => null,
    lines: () => ['所持金の1割（最大10万円）を寄付する'],
    run(g, kid) {
      const c = crisisById(g, kid);
      const st = g.state;
      const amt = Math.max(1000, Math.round(Math.min(st.money * 0.1, 100000) / 1000) * 1000);
      st.money -= amt;
      c.handled['donate_' + today(g)] = true;
      try { if (typeof g.addNeed === 'function') g.addNeed('stress', -3); } catch (e) { /* ignore */ }
      return { ok: true, success: true, text: `支援団体に寄付した。（${amt.toLocaleString('ja-JP')}円ぶん）` };
    },
  },
};
export const DIPLO_ORDER = Object.keys(DIPLO);
// the side of a conflict Japan would help (an ally first, else the friendlier side if relation ≥ 30)
function pickSide(g, c) {
  if (!c) return null;
  const al = japanAllies(g).map((a) => a.id);
  if (al.includes(c.a) && c.aggressor !== c.a) return c.a;
  if (al.includes(c.b) && c.aggressor !== c.b) return c.b;
  const ra = relation(g, c.a), rb = relation(g, c.b);
  const best = ra >= rb ? c.a : c.b;
  return Math.max(ra, rb) >= 30 ? best : null;
}
const other = (c, x) => (c.a === x ? c.b : c.a);
// The law for rear support in this conflict: { text, need (a special law is needed) }
function rearLaw(g, c) {
  if (LAWS.anpoLaw(g)) return { text: '国際平和支援法・重要影響事態法（平和安全法制）', need: false };
  if (c && LAWS.shuhen(g) && (NEAR.includes(c.a) || NEAR.includes(c.b))) return { text: '周辺事態法（1999年）', need: false };
  return { text: 'この紛争のための特別措置法（テロ対策特措法・イラク特措法のような時限立法）', need: true };
}
function unscOdds(g) { const s = W(g); const aid = Object.values(s.aid).reduce((a, v) => a + num(v), 0); return clamp(0.45 + s.standing / 200 + Math.min(0.1, aid * 0.1), 0.05, 0.96); }
// Japan's real candidacies (elected each time): the NPC government wins these on their dates
const UNSC_REAL = [19911031, 19961031, 20041031, 20081031, 20151031, 20220630];
function nextUnscVote(g) { const d = worldDate(g); const y = d.month > (d.year >= 2016 ? 6 : 10) ? d.year + 1 : d.year; return y >= 2016 ? y * 10000 + 630 : y * 10000 + 1031; }
function unscNextText(g) { const n = num(W(g).unsc.next) || nextUnscVote(g); const y = Math.floor(n / 10000); return `${y}年${Math.floor(n / 100) % 100}月の国連総会で選挙（任期は${y + 1}〜${y + 2}年）`; }

// ======================================================================== conflicts between other countries, crises
function newConflict(g, a, b, opts = {}) {
  const s = W(g);
  if (s.conflicts.some((c) => c.status === 'war' && pkey(c.a, c.b) === pkey(a, b))) return null;
  const c = { id: 'w' + s.seq++, a, b, name: opts.name || `${shortName(g, a)}と${shortName(g, b)}の武力衝突`, start: today(g), status: 'war', intensity: opts.intensity || 2, aggressor: opts.aggressor || null, front: 0, dead: 0, japan: null, since: dateNum(g) };
  s.conflicts.push(c);
  if (s.conflicts.length > 12) s.conflicts.splice(0, s.conflicts.length - 12);
  tensionShift(g, 4 + c.intensity);
  const mid = ['ir', 'iq', 'il', 'sa'];
  if (mid.includes(a) || mid.includes(b)) oilShock(g, 15 + c.intensity * 8, '中東での武力衝突');
  crisis(g, { kind: 'war', title: c.name, country: b, sev: c.intensity, conflict: c.id, until: today(g) + 60 });
  news(g, `【国際】${c.name}が起きた。${opts.cause || '国境付近での衝突がきっかけ'}`);
  phone(g, `【国際ニュース】${c.name}。\n国連安保理が緊急会合を開いた。`);
  emit(g, 'conflict', { kind: 'start', conflict: c });
  return c;
}
function endConflict(g, id, how, text) {
  const s = W(g);
  const c = s.conflicts.find((x) => x.id === id);
  if (!c || c.status !== 'war') return;
  c.status = how || 'ceasefire';
  c.end = today(g);
  tensionShift(g, -3);
  for (const k of s.crises) if (k.conflict === id) k.until = today(g);
  if (text) news(g, text);
  // the deployment of Japan in it ends
  for (const d of s.deploy) if (d.conflict === id && !d.ended) { d.ended = today(g); news(g, `${d.mission}の自衛隊が帰国した`); }
  emit(g, 'conflict', { kind: 'end', conflict: c, how });
}
function crisis(g, def) {
  const s = W(g);
  const k = { id: 'k' + s.seq++, day: today(g), handled: {}, sev: 1, until: today(g) + 20, ...def };
  s.crises.push(k);
  if (s.crises.length > 16) s.crises.splice(0, s.crises.length - 16);
  return k;
}
function oilShock(g, d, why) {
  const s = W(g);
  s.oil = clamp(s.oil + d, 60, 250);
  ecoShock(g, `原油高（${why}）`, { inflation: clamp(d / 40, 0.2, 1.5), growth: -clamp(d / 70, 0.1, 0.9), yen: 2, len: 150 });
  if (d >= 20) crisis(g, { kind: 'oil', title: `原油価格の急騰（${why}）`, country: 'sa', sev: d >= 35 ? 3 : 2, until: today(g) + 40 });
}
// fictional instances of the world's events. weight(g) → number (0 = not now); fire(g) → (news, effects, crises).
const pickExisting = (g, ids) => { const l = ids.filter((x) => exists(g, x)); return l.length ? pick(l) : null; };
export const WORLD_EVENTS = {
  oil: { weight: (g) => 0.6 + (W(g).conflicts.some((c) => c.status === 'war' && ['ir', 'iq', 'il', 'sa'].some((x) => x === c.a || x === c.b)) ? 1 : 0),
    fire(g) { const d = rint(20, 45); const why = pick(['中東情勢の緊迫', '産油国の減産', '産油国の政情不安']); oilShock(g, d, why); news(g, `【経済】原油価格が急騰した（${why}）。ガソリンや電気代の値上がりが心配されている`); phone(g, `【経済ニュース】原油価格が急騰（${why}）。\nガソリンや電気代の値上がりが心配されている。`, 'ドット新聞 経済部'); } },
  oil_fall: { weight: () => 0.4, fire(g) { const s = W(g); s.oil = clamp(s.oil - rint(15, 30), 60, 250); ecoShock(g, '原油安', { inflation: -0.3, growth: 0.2, len: 120 }); news(g, '【経済】原油価格が大きく下がった。燃料費が下がり、企業には追い風'); } },
  finance: { weight: () => 0.45,
    fire(g) {
      const origin = pick(since(g, 19931101) ? ['us', 'eu', 'asia', 'cn'] : ['us', 'asia', 'ec']);
      const where = { us: '米国', eu: '欧州', ec: '欧州', asia: 'アジア', cn: '中国' }[origin];
      const sev = rint(1, 3);
      ecoShock(g, `${where}発の金融危機`, { growth: -0.5 * sev, nikkei: -6 * sev, unemployment: 0.15 * sev, yen: origin === 'us' ? -6 : 3, len: 120 + sev * 60 });
      crisis(g, { kind: 'finance', title: `${where}発の金融危機`, country: origin === 'us' ? 'us' : origin === 'cn' ? 'cn' : origin === 'asia' ? 'th' : current(g, 'de'), sev, until: today(g) + 40 + sev * 10 });
      news(g, `【経済】${where}発の金融不安が世界に広がった。株価が急落し、景気の先行きに不安`);
      phone(g, `【経済ニュース】${where}発の金融不安で、世界の株価が急落した。`, 'ドット新聞 経済部');
    } },
  boom: { weight: () => 0.35, fire(g) { ecoShock(g, '世界経済の好調', { growth: 0.3, nikkei: 4, len: 180 }); news(g, '【経済】世界経済が好調。日本の輸出も伸びている'); } },
  coup: { weight: () => 0.25,
    fire(g) {
      const id = pickExisting(g, ['th', 'tr', 'ph']) || 'th';
      const k = crisis(g, { kind: 'coup', title: `${shortName(g, id)}の政変（クーデター）`, country: id, sev: 2, until: today(g) + rint(15, 30) });
      relAdd(g, id, -3);
      news(g, `【国際】${shortName(g, id)}で軍がクーデターを起こし、政権を掌握した。在留の日本人の安全の確認が急がれている`);
      phone(g, `【国際ニュース】${shortName(g, id)}でクーデター。\n在留の日本人の安全の確認が急がれている。`);
      if (isPM(g) || isDM(g)) scene(g, 'crisis', { id: k.id });
    } },
  clash: { weight: (g) => 0.45 * (0.5 + tensionNow(g) / 100),
    fire(g) {
      const pairs = [['in', 'cn'], ['kr', 'kp'], ['cn', 'vn'], ['il', 'ir'], ['ir', 'iq'], ['cn', 'ph'], ['cn', 'tw'], ['ru', 'ua'], ['sa', 'ir'], ['tr', 'il']].filter(([a, b]) => exists(g, a) && exists(g, b) && pairRelation(g, a, b) < -15);
      if (!pairs.length) return;
      const [a, b] = pick(pairs);
      const hot = pairRelation(g, a, b) <= -60;
      pairAdd(g, a, b, -6);
      if (hot && roll(0.22)) { newConflict(g, a, b, { cause: '国境付近での衝突が拡大した', aggressor: null, intensity: rint(1, 3) }); return; }
      tensionShift(g, 2);
      const k = crisis(g, { kind: 'clash', title: `${shortName(g, a)}と${shortName(g, b)}の衝突`, country: b, sev: 1, until: today(g) + 12, pair: [a, b] });
      news(g, `【国際】${shortName(g, a)}と${shortName(g, b)}の境界付近で衝突。双方に死傷者が出たと伝えられる`);
      if (isPM(g) || isFM(g)) note(g, `（${k.title}。「世界情勢」で各国の動きを確かめられる）`);
    } },
  missile: { weight: (g) => (exists(g, 'kp') && since(g, 19930501) ? 0.5 * (0.6 + tensionNow(g) / 100) : 0),
    fire(g) {
      const over = roll(0.12);
      const alert = since(g, 20070209) ? '全国瞬時警報システム（Jアラート）が作動した。' : '';
      threatAdd(g, over ? 6 : 3); relAdd(g, 'kp', -2); tensionShift(g, 1);
      const k = crisis(g, { kind: 'missile', title: `北朝鮮の弾道ミサイル発射${over ? '（日本の上空を通過）' : ''}`, country: 'kp', sev: over ? 2 : 1, until: today(g) + 6 });
      news(g, over ? `【速報】北朝鮮が弾道ミサイルを発射し、日本の上空を通過して太平洋に落下した。${alert}` : '北朝鮮が弾道ミサイルを発射した。日本の排他的経済水域の外の日本海に落下したとみられる');
      phone(g, over ? `【速報】北朝鮮のミサイルが日本の上空を通過した。\n${alert}被害の情報はない。` : '【ニュース】北朝鮮が弾道ミサイルを発射した。日本海に落下したとみられる。', 'ドット新聞 政治部');
      if (over && (isPM(g) || isDM(g))) scene(g, 'crisis', { id: k.id });
    } },
  ships: { weight: (g) => (since(g, 20120911) ? 0.5 : since(g, 20081208) ? 0.2 : 0.06) + 0.15,
    fire(g) {
      if (roll(0.55) && exists(g, 'cn') && since(g, 20081208)) { relAdd(g, 'cn', -1); threatAdd(g, 1); crisis(g, { kind: 'incident', title: '尖閣諸島の周辺で中国公船が領海に入った', country: 'cn', sev: 1, until: today(g) + 4 }); news(g, '尖閣諸島の周辺で、中国海警局の船が日本の領海に入った。海上保安庁が退去を求めた', { feed: false }); return; }
      const id = exists(g, 'ru') ? 'ru' : 'su';
      threatAdd(g, 0.5);
      news(g, `${shortName(g, id)}の軍用機が日本の領空に近づき、航空自衛隊が緊急発進した`, { feed: false });
    } },
  trade: { weight: (g) => (fyear(g) < 1997 ? 0.5 : 0.15) + (fyear(g) > 2017 ? 0.15 : 0),
    fire(g) {
      const id = fyear(g) > 2009 && roll(0.4) ? 'cn' : 'us';
      const item = id === 'us' ? pick(fyear(g) < 1997 ? ['自動車', '半導体', 'コメ', '牛肉・オレンジ'] : fyear(g) < 2019 ? ['自動車', '鉄鋼', '牛肉'] : ['自動車', '鉄鋼', 'デジタル課税']) : pick(['レアアース', '水産物', '半導体の部材']);
      relAdd(g, id, -4);
      ecoShock(g, `${shortName(g, id)}との貿易摩擦`, { growth: -0.2, nikkei: -2, len: 120 });
      crisis(g, { kind: 'trade', title: `${shortName(g, id)}との貿易摩擦（${item}）`, country: id, sev: 1, until: today(g) + 30 });
      news(g, `${shortName(g, id)}が日本の${item}をめぐり、関税の引き上げや輸出入の規制をちらつかせている（貿易摩擦）`);
    } },
  disaster: { weight: () => 0.35,
    fire(g) {
      const id = pickExisting(g, ['id', 'ph', 'tr', 'ir', 'in', 'cn', 'vn', 'th', 'br']);
      if (!id) return;
      const kind = pick(['大地震', '大規模な洪水', '大型の台風']);
      const k = crisis(g, { kind: 'disaster', title: `${shortName(g, id)}の${kind}`, country: id, sev: 2, until: today(g) + 20 });
      news(g, `【国際】${shortName(g, id)}で${kind}。多くの死傷者が出ている。各国が支援を表明している`);
      if (isPM(g) || isFM(g)) note(g, `（${k.title}。国際緊急援助隊や援助を「世界情勢」から決められる）`);
    } },
  election: { weight: () => 0, fire() {} }, // scheduled (electionsAbroad)
  us_war: { weight: (g) => (isPM(g) ? 0.06 * (0.5 + tensionNow(g) / 80) : 0),
    fire(g) {
      if (W(g).conflicts.some((c) => c.status === 'war' && (c.a === 'us' || c.b === 'us'))) return;
      const F = fictional();
      const foe = roll(0.5) && F.keldoa ? 'keldoa' : pickExisting(g, ['kp', 'ir']) || 'keldoa';
      const c = newConflict(g, foe, 'us', { cause: `${shortName(g, foe)}の部隊が米軍の艦船を攻撃した`, aggressor: foe, intensity: 2, name: `${shortName(g, foe)}と米国の武力衝突` });
      if (c) scene(g, 'ally_request', { conflict: c.id });
    } },
  attack: { weight: (g) => {
      if (!isPM(g) || attackOnJapan(g) || (japanWar(g) && japanWar(g).phase === 'war')) return 0;
      const s = W(g);
      const hostile = Object.keys(s.provoked).filter((id) => exists(g, id) && relation(g, id) <= -88 && today(g) - num(s.provoked[id]) < 60);
      return hostile.length ? 0.25 : 0;
    },
    fire(g) {
      const s = W(g);
      const hostile = Object.keys(s.provoked).filter((id) => exists(g, id) && relation(g, id) <= -88);
      if (!hostile.length) return;
      const by = pick(hostile);
      const D = COUNTRIES[by] && COUNTRIES[by].dispute ? DISPUTES[COUNTRIES[by].dispute] : null;
      const where = D && D.id !== 'takeshima' ? `${D.name}の周辺` : '日本の離島の周辺';
      s.attack = { by, day: today(g), where };
      threatAdd(g, 25); tensionShift(g, 10);
      news(g, `【速報】${shortName(g, by)}の部隊が${where}で日本の艦船と施設を攻撃した。政府は武力攻撃事態と認定する方針`);
      phone(g, `【速報】${shortName(g, by)}の部隊が${where}で日本を攻撃した。\n政府は武力攻撃事態と認定する方針。`, 'ドット新聞 政治部');
      scene(g, 'attack', { by }, { front: true });
      emit(g, 'attack', { by, where });
    } },
};
function worldEventsTick(g) {
  const s = W(g);
  if (today(g) < 3 || !roll(0.085)) return;
  const list = Object.entries(WORLD_EVENTS).map(([id, E]) => [id, E, Math.max(0, num(E.weight(g)))]).filter((x) => x[2] > 0);
  const tot = list.reduce((a, x) => a + x[2], 0);
  if (!tot) return;
  let r0 = rnd() * tot;
  for (const [id, E, w] of list) { r0 -= w; if (r0 <= 0) { try { E.fire(g); s.flags.lastEvent = { id, day: today(g) }; } catch (e) { console.error(e); } return; } }
}
// Conflicts between others: the front moves, the dead are counted, some end.
function conflictsTick(g) {
  const s = W(g);
  for (const c of s.conflicts) {
    if (c.status !== 'war') continue;
    c.front = clamp(num(c.front) + (milPower(g, c.a) - milPower(g, c.b)) * 0.01 + (rnd() - 0.5) * 6, -100, 100);
    c.dead = num(c.dead) + rint(5, 40) * num(c.intensity, 2);
    const scheduled = c.id === 'iran_iraq' && !s.history.iran_iraq_end;
    if (!c.japan && !scheduled && c.id !== 'ru_ua' && roll(1 / 90)) endConflict(g, c.id, 'ceasefire', `${c.name}は、国際社会の仲介で停戦した（死者 推計${n0(c.dead)}人）`);
    if (c.id === 'ru_ua' && !c.japan && roll(1 / 400)) endConflict(g, c.id, 'ceasefire', `${c.name}で停戦が合意された（4年を超える戦争で、双方に多くの死者が出た）`);
  }
  if (s.conflicts.length > 12) s.conflicts = s.conflicts.slice(-12);
}
function crisesTick(g) {
  const s = W(g);
  s.crises = s.crises.filter((k) => (k.untilDate ? dateNum(g) < k.untilDate : num(k.until) >= today(g)));
}
function deployTick(g) {
  const s = W(g);
  for (const d of s.deploy) {
    if (d.ended) continue;
    if (d.endDate && dateNum(g) >= d.endDate) { d.ended = today(g); news(g, `${d.mission}を終え、自衛隊の部隊が帰国した（${d.where}）`); }
  }
  if (s.deploy.length > 16) s.deploy = s.deploy.filter((d) => !d.ended).concat(s.deploy.filter((d) => d.ended).slice(-6));
}
// The relations drift slowly back toward the era's trend; tension toward its level; standing toward 60.
function driftTick(g) {
  const s = W(g);
  for (const k of Object.keys(s.rel)) { s.rel[k] *= atWarWith(g, k) ? 1 : 0.996; if (Math.abs(s.rel[k]) < 0.05) delete s.rel[k]; }
  for (const k of Object.keys(s.pair)) { s.pair[k] *= 0.995; if (Math.abs(s.pair[k]) < 0.05) delete s.pair[k]; }
  s.tension += (s.tensionEq - s.tension) * 0.01;
  s.standing += (60 - s.standing) * 0.004;
  s.oil += (100 - s.oil) * 0.01;
  const base = ERA_WORLD[s.era] ? ERA_WORLD[s.era].threat : 40;
  s.threat += (base - s.threat) * 0.01;
  if (s.attack && today(g) - num(s.attack.day) > 30 && !(japanWar(g) && japanWar(g).phase === 'war')) s.attack.over = true;
  // 日米安保 notice: one year (120 days), then the alliance ends and the US forces leave
  const A0 = s.alliances.anpo;
  if (A0.notice && !A0.ended && today(g) - A0.notice >= YEAR_DAYS) {
    A0.ended = today(g); A0.strength = 0;
    ecoShock(g, '自主防衛の負担', { growth: -0.3, len: 600 });
    threatAdd(g, 10);
    news(g, '日米安保条約が終了した。在日米軍が撤退を始めた');
    phone(g, '【ニュース】日米安保条約が終了した。\n在日米軍の撤退が始まり、日本は防衛を自力で担うことになった。');
  }
}
// Institutional history on its real date
function historyTick(g) {
  const s = W(g);
  const n = dateNum(g);
  for (const [d, id, fn] of HISTORY) {
    if (s.history[id] || n < d) continue;
    s.history[id] = today(g);
    try { fn(g); } catch (e) { console.error(e); }
    if (id === 'ussr_end') { s.rel.ru = num(s.rel.ru) + num(s.rel.su) * 0.5; if (s.sanctions.byJapan.su) { s.sanctions.byJapan.ru = s.sanctions.byJapan.su; delete s.sanctions.byJapan.su; } if (s.ties.su) s.ties.ru = s.ties.su; }
    if (id === 'unification') { s.rel.de = num(s.rel.wde) * 0.8; }
  }
  // the scheduled end of the Iran–Iraq war (fact), and the US–Russia relation turns the G8 into the G7 again
  if (s.g8 && since(g, 19980515) && pairRelation(g, 'us', 'ru') <= -35) { s.g8 = false; news(g, '主要国はロシアのG8への参加を停止した（G7に戻った）'); }
}
// The NPC government follows the real agreements of the time (when the player does not decide foreign policy).
function npcTreatiesTick(g) {
  const s = W(g);
  const n = dateNum(g);
  for (const [id, T] of Object.entries(TREATIES)) {
    if (!T.npc || s.treaties[id] || s.npcDone[id] || n < T.from) continue;
    s.npcDone[id] = today(g);
    if (T.with.some((x) => { const c = current(g, x); return COUNTRIES[c] && (!hasTies(g, c) || relation(g, c) < -20 || atWarWith(g, c)); })) continue;
    if (isPM(g) || isFM(g)) { s.offers.push({ id: 'o' + s.seq++, treaty: id, day: today(g) }); if (s.offers.length > 6) s.offers.shift(); scene(g, 'treaty_offer', { treaty: id }); continue; }
    if (!roll(0.75)) continue;
    s.treaties[id] = { status: 'force', since: today(g), by: 'npc' };
    if (T.kind === 'fta') for (const x of T.with) tradeShock(g, current(g, x), 1, 0.6, T.name);
    news(g, `政府は「${T.name}」を結んだ`);
  }
}
// Accept / decline a treaty the bureaucrats have negotiated (the scene's answer; also the UI).
export function answerOffer(g, offerId, yes) {
  const s = W(g);
  const o = s.offers.find((x) => x.id === offerId || x.treaty === offerId);
  if (!o) return '交渉中の協定はない';
  s.offers = s.offers.filter((x) => x !== o);
  const T = TREATIES[o.treaty];
  if (!yes) { news(g, `政府は「${T.name}」の署名を見送った`); return `「${T.name}」の署名を見送った。`; }
  if (!roll(dietOdds(g, 0.1))) { news(g, `「${T.name}」は国会で承認されなかった`); return `「${T.name}」は国会で承認されなかった。`; }
  s.treaties[o.treaty] = { status: 'force', since: today(g), by: 'player' };
  if (T.kind === 'fta') { for (const x of T.with) tradeShock(g, current(g, x), 1, 0.6, T.name); bumpApproval(g, -0.5, T.name); }
  for (const x of T.with) relAdd(g, current(g, x), 4);
  news(g, `「${T.name}」が発効した`);
  return `「${T.name}」が国会で承認され、発効した。`;
}
// Summits on their months (the player PM attends: a scene with the agenda; an NPC PM: a news line).
const SUMMIT_AGENDA = [
  { id: 'econ', label: '世界経済・貿易を主導', sub: '景気と株価にプラス' },
  { id: 'security', label: '安全保障で連携', sub: '同盟が強まる（周りの国は警戒）' },
  { id: 'climate', label: '気候変動・開発', sub: '国際的な信頼が上がる' },
  { id: 'bilateral', label: '各国首脳と個別に会談', sub: '主要国との関係がよくなる（体力20）' },
];
export const summitAgenda = () => SUMMIT_AGENDA;
function summitsTick(g) {
  const s = W(g);
  const d = worldDate(g);
  if (d.dom < 13 || d.dom > 16) return;
  for (const [id, S] of Object.entries(SUMMITS)) {
    if (S.month(g, d.year) !== d.month || (S.from && dateNum(g) < S.from)) continue;
    if (id === 'g20' && !s.g20) continue;
    if (id === 'g7' && s.flags.leftG7) continue;
    const key = `${id}_${d.year}`;
    if (s.summits.done[key]) continue;
    s.summits.done[key] = today(g);
    const host = S.host(d.year);
    const hostName = host === 'un' ? 'ニューヨークの国連本部' : host === 'jp' ? '日本' : host ? countryName(g, current(g, host), true) : '';
    const name = S.name(g);
    if (isPM(g) && !(s.flags.leftUN && id === 'unga')) { scene(g, 'summit', { id, key, name, host, hostName, year: d.year }); continue; }
    const p = pol(g);
    const pmName = p && p.cabinet && p.cabinet.pm && p.cabinet.pm !== 'player' && typeof g.npcName === 'function' ? g.npcName(p.cabinet.pm) : '';
    news(g, `${name}が${hostName ? `${hostName}で` : ''}開かれ、${pmName ? `${pmName}総理` : '日本の総理'}が出席した`);
  }
}
export function attendSummit(g, sid, agenda) {
  const s = W(g);
  const host = (SUMMITS[sid] && SUMMITS[sid].host(worldDate(g).year)) || null;
  const name = SUMMITS[sid] ? SUMMITS[sid].name(g) : '首脳会議';
  s.record.summits++;
  if (host === 'jp') { bumpApproval(g, 3, `${name}の議長`); standingAdd(g, 3); }
  const members = sid === 'g7' ? ['us', 'gb', 'fr', 'de', 'wde', 'it', 'ca'].filter((x) => exists(g, x)) : sid === 'apec' ? ['us', 'cn', 'kr', 'au', 'id', 'sg'].filter((x) => exists(g, x)) : sid === 'g20' ? ['us', 'cn', 'in', 'br', 'sa', 'de'].filter((x) => exists(g, x)) : ['us', 'cn', 'gb', 'fr', 'ru', 'su'].filter((x) => exists(g, x));
  let text = '';
  if (agenda === 'econ') { ecoShock(g, `${name}（経済）`, { growth: 0.15, nikkei: 2, len: 150 }); text = '世界経済と自由貿易を守る宣言をまとめた。'; }
  else if (agenda === 'security') { if (s.alliances.anpo && !s.alliances.anpo.ended) s.alliances.anpo.strength = clamp(s.alliances.anpo.strength + 2, 0, 100); for (const x of CNRU) if (exists(g, x)) relAdd(g, x, -1); threatAdd(g, -1); text = '安全保障での連携を確認した。'; }
  else if (agenda === 'climate') { standingAdd(g, 2); text = '気候変動と途上国の開発への協力を約束した。'; }
  else if (agenda === 'bilateral') { useStam(g, 20); for (const x of members.slice(0, 4)) relAdd(g, x, 3); text = `${members.slice(0, 4).map((x) => shortName(g, x)).join('・')}の首脳と個別に会談した。`; }
  else text = '首脳たちと議論した。';
  for (const x of members) relAdd(g, x, 1);
  standingAdd(g, 1);
  bumpApproval(g, 1, name);
  news(g, `${who0(g)}が${name}に出席した。${text}`);
  emit(g, 'summit', { id: sid, agenda });
  return `${name}に出席した。${text}`;
}
// UN Security Council (non-permanent seat): the vote on its date.
function unscTick(g) {
  const s = W(g);
  const u = s.unsc;
  const n = dateNum(g);
  if (u.member && u.until && n > u.until) { u.member = false; u.next = Math.floor(u.until / 10000) * 10000 + 30000 + (Math.floor(u.until / 10000) + 3 >= 2016 ? 630 : 1031); news(g, '日本の国連安保理・非常任理事国としての任期が終わった'); }
  if (!u.member && u.next && n >= u.next && !s.flags.leftUN) {
    const y = Math.floor(u.next / 10000);
    const npcRuns = !isPM(g) && !isFM(g);
    if (u.candidate || npcRuns) {
      const ok = npcRuns && UNSC_REAL.includes(u.next) ? true : roll(unscOdds(g));
      u.ran.push({ year: y, ok });
      if (ok) { u.member = true; u.until = (y + 2) * 10000 + 1231; standingAdd(g, 5); news(g, `日本が国連安保理の非常任理事国に選ばれた（任期は${y + 1}〜${y + 2}年）`); }
      else { u.next = (y + 2) * 10000 + (y + 2 >= 2016 ? 630 : 1031); standingAdd(g, -1); news(g, `日本は国連安保理の非常任理事国選挙で落選した`); }
      if (isPM(g) || isFM(g)) scene(g, 'unsc', { ok, year: y });
    } else u.next = (y + 2) * 10000 + (y + 2 >= 2016 ? 630 : 1031);
    u.candidate = false;
  }
}
// Elections abroad on their cadence (leaders are never named; only the change and its effect).
const ELECTIONS = [
  { id: 'us', month: 11, first: 1988, every: 4, office: '大統領' },
  { id: 'kr', month: 12, first: 1987, every: 5, office: '大統領', until: 2016 },
  { id: 'kr', month: 3, first: 2022, every: 5, office: '大統領' },
  { id: 'ru', month: 3, first: 1996, every: 4, office: '大統領', until: 2008 },
  { id: 'ru', month: 3, first: 2012, every: 6, office: '大統領' },
  { id: 'tw', month: 3, first: 1996, every: 4, office: '総統', until: 2008 },
  { id: 'tw', month: 1, first: 2012, every: 4, office: '総統' },
  { id: 'fr', month: 4, first: 1988, every: 7, office: '大統領', until: 2002 },
  { id: 'fr', month: 4, first: 2002, every: 5, office: '大統領' },
];
function electionsTick(g) {
  const s = W(g);
  const d = worldDate(g);
  if (d.dom !== 13) return;
  for (const E of ELECTIONS) {
    if (E.month !== d.month || d.year < E.first || (E.until && d.year > E.until) || (d.year - E.first) % E.every) continue;
    if (!exists(g, E.id)) continue;
    const key = `el_${E.id}_${d.year}`;
    if (s.flags[key]) continue;
    s.flags[key] = today(g);
    const change = roll(0.5);
    const d0 = change ? rint(-6, 6) : rint(-2, 2);
    relAdd(g, E.id, d0);
    news(g, `${shortName(g, E.id)}で${E.office}選挙。${change ? `新しい${E.office}が選ばれた。日本との関係は${d0 > 1 ? '前向きになりそうだ' : d0 < -1 ? '見直しが心配されている' : 'これまでどおりの見通し'}` : `現職の${E.office}が再選された`}`);
  }
}
// Others react to Japan: counter-sanctions, and sanctions lifted over time.
function reactionsTick(g) {
  const s = W(g);
  // a pending peace while the player does not lead the government: the NPC cabinet concludes it
  if (s.peace && !isPM(g) && today(g) - num(s.peace.day) >= 10 && !(japanWar(g) && japanWar(g).phase === 'war')) {
    const P = s.peace;
    const terms = P.lost ? 'cede' : P.won ? 'keep' : 'status';
    s.peace = null;
    s.ties[P.enemy] = 'normal';
    relAdd(g, P.enemy, 25);
    for (const [cid, v] of Object.entries(s.sanctions.onJapan)) if (v && v.war) delete s.sanctions.onJapan[cid];
    const D = COUNTRIES[P.enemy] && COUNTRIES[P.enemy].dispute;
    if (D && s.disputes[D] && terms !== 'status') s.disputes[D].admin = terms === 'keep' ? 'jp' : P.enemy;
    addTreaty(g, { name: `日${countryName(g, P.enemy, true)}講和条約`, kind: 'peace', with: [P.enemy], by: 'npc' });
    news(g, `政府は${countryName(g, P.enemy, true)}と講和条約を結んだ（${{ status: '国境は戦争の前のまま', keep: `${P.area}は日本の施政のもとに`, cede: `${P.area}は相手の側に` }[terms]}）`);
  }
  for (const [id, v] of Object.entries(s.sanctions.onJapan)) {
    if (!v) continue;
    if (!exists(g, id)) { delete s.sanctions.onJapan[id]; continue; }
    if (!v.war && today(g) - num(v.day) > 60 && relation(g, id) > -40 && roll(0.05)) { delete s.sanctions.onJapan[id]; news(g, `${shortName(g, id)}が日本への制裁を解除した`); }
  }
}

// ======================================================================== Japan's war (run by regime.js): what the world does
// Who joins: { ours: [ids], theirs: [ids], why: { id: text } }. mode: 'regime' | 'art9' | 'alliance' | 'defense'.
export function allyDecisions(g, enemy, mode, opts = {}) {
  const out = { ours: [], theirs: [], why: {} };
  const aggressor = mode === 'regime' || mode === 'art9';
  const dict = regimeId(g) !== 'democracy';
  const info = countryInfo(g, enemy);
  for (const a of japanAllies(g)) {
    if (!exists(g, a.id) || a.id === enemy || a.kind === 'law') continue;
    if (alliesOf(g, enemy).some((x) => x.id === a.id)) { out.why[a.id] = `${shortName(g, a.id)}は相手国とも同盟を結んでいる`; continue; }
    let p = a.kind === 'defense' ? 0.8 : a.kind === 'partnership' ? 0.25 : 0.3;
    if (a.alliance === 'anpo') p *= clamp(num(W(g).alliances.anpo.strength, 70) / 80, 0.2, 1.15);
    if (opts.ally === a.id) p = 1;
    if (aggressor) p *= 0.12;
    if (dict) p = 0;
    if (info && info.nuclear) p *= 0.7;
    p *= clamp((relation(g, a.id) + 40) / 100, 0, 1.2);
    if (roll(p)) out.ours.push(a.id);
    else out.why[a.id] = dict ? `${shortName(g, a.id)}は独裁体制の日本の戦争には加わらない` : aggressor ? `${shortName(g, a.id)}は、日本から始めた戦争には加わらないと表明した` : `${shortName(g, a.id)}は参戦を見送った`;
  }
  if (COUNTRIES[enemy]) {
    for (const a of alliesOf(g, enemy)) {
      if (!exists(g, a.id) || a.id === 'jp' || out.ours.includes(a.id) || a.kind === 'law' && a.id !== 'us') continue;
      let p = a.kind === 'defense' ? (aggressor ? 0.7 : 0.35) : a.kind === 'law' ? 0.4 : 0.2;
      p *= clamp((pairRelation(g, a.id, enemy) + 20) / 80, 0, 1.2);
      if (roll(p)) out.theirs.push(a.id);
    }
  }
  return out;
}
export function onJapanWar(g, kind, w) {
  if (!g || !g.state || !w) return;
  const s = W(g);
  const enemy = w.enemy;
  const real = !!COUNTRIES[enemy];
  if (kind === 'start') {
    relAdd(g, enemy, -200);
    if (real) { s.ties[enemy] = 'cut'; tradeShock(g, enemy, -1, 3, `${shortName(g, enemy)}との戦争`); }
    delete s.ambassadors[enemy];
    s.peace = null;
    const aggressor = w.mode === 'regime' || w.mode === 'art9';
    tensionShift(g, 15);
    standingAdd(g, aggressor ? -25 : -3);
    for (const x of countriesNow(g)) {
      if (x === enemy) continue;
      const pr = pairRelation(g, x, enemy);
      if ((w.allies || []).some((a) => a.id === x)) { relAdd(g, x, 8); continue; }
      if ((w.foes || []).some((a) => a.id === x)) { relAdd(g, x, -60); if (COUNTRIES[x]) s.ties[x] = 'cut'; continue; }
      if (aggressor) relAdd(g, x, pr > 20 ? -30 : -15);
      else relAdd(g, x, pr < -30 ? 4 : pr > 30 ? -10 : -2);
    }
    if (aggressor) for (const x of ['us', 'gb', 'fr', 'de', 'wde', 'it', 'ca', 'au'].filter((x0) => exists(g, x0))) if (relation(g, x) < 0 && !(w.allies || []).some((a) => a.id === x)) s.sanctions.onJapan[x] = { level: 2, day: today(g), war: true };
    if (real) news(g, `${shortName(g, enemy)}との国交は断絶した。在留の日本人の退避が続いている`);
    emit(g, 'japanWar', { kind, war: w });
    return;
  }
  if (kind === 'end') {
    const how = w.result;
    const D = real && COUNTRIES[enemy].dispute ? COUNTRIES[enemy].dispute : null;
    if (how === 'ceasefire' || how === 'withdraw' || how === 'lost') s.peace = { enemy, day: today(g), area: w.area, front: num(w.front), lost: how === 'lost' };
    if (how === 'victory') { s.peace = { enemy, day: today(g), area: w.area, front: 100, won: true }; if (D && s.disputes[D]) { s.disputes[D].admin = 'jp'; s.disputes[D].occupied = today(g); } }
    if (how === 'lost' && D && s.disputes[D]) s.disputes[D].admin = enemy;
    tensionShift(g, -8);
    for (const c of s.conflicts) if (c.japan && (c.a === enemy || c.b === enemy) && c.status === 'war' && w.mode === 'alliance' && how !== 'withdraw') { /* the ally's war goes on */ }
    emit(g, 'japanWar', { kind, war: w });
  }
}

// ======================================================================== the morning
export function worldTick(g) {
  if (!g || !g.state) return;
  const s = W(g);
  if (num(s.lastTick) >= today(g)) return;
  s.lastTick = today(g);
  try {
    if (g.state.regime && g.state.regime.id === 'fallen') return;
    historyTick(g);
    summitsTick(g);
    unscTick(g);
    npcTreatiesTick(g);
    electionsTick(g);
    conflictsTick(g);
    crisesTick(g);
    deployTick(g);
    driftTick(g);
    reactionsTick(g);
    worldEventsTick(g);
  } catch (e) { console.error('worldTick', e); }
}

// ======================================================================== summaries for the UIs
function countryRow(g, id) {
  const s = W(g);
  const c = COUNTRIES[id];
  const r = relation(g, id);
  return {
    id, name: countryName(g, id), short: shortName(g, id), real: !!c, relation: r, relLabel: relLabel(r), bloc: blocOf(g, id), blocName: BLOC_INFO[blocOf(g, id)].name(s),
    ties: hasTies(g, id), tiesLabel: tiesLabel(g, id), sanction: sanctioned(g, id), onJapan: num((s.sanctions.onJapan[id] || {}).level), ally: alliedTo(g, id),
    war: atWarWith(g, id), pos: MAP_POS[id] || null, mil: milPower(g, id), gdp: gdpOf(g, id), trade: tradeOf(g, id),
  };
}
function summary(g) {
  const s = W(g);
  const d = worldDate(g);
  const ids = countriesNow(g);
  return {
    date: `${d.year}年${d.month}月`, year: d.year, tension: tensionNow(g), tensionLabel: tensionLabel(g), coldWar: s.coldWar, newColdWar: newColdWar(g), standing: Math.round(s.standing),
    oil: Math.round(s.oil), threat: Math.round(s.threat), g8: !!(s.g8 && pairRelation(g, 'us', 'ru') > -35),
    countries: ids.map((id) => countryRow(g, id)),
    fictional: Object.keys(fictional()).map((id) => countryRow(g, id)),
    blocs: Object.fromEntries(Object.keys(BLOC_INFO).map((b) => [b, { name: BLOC_INFO[b].name(s), short: BLOC_INFO[b].short, color: BLOC_INFO[b].color, members: ids.filter((x) => blocOf(g, x) === b) }]).filter(([, v]) => v.members.length)),
    alliances: alliancesNow(g).map((a) => ({ id: a.id, name: a.name, short: a.short, kind: a.kind, members: a.members, strength: a.strength, notice: a.notice, japan: (a.members || []).includes('jp'), desc: a.desc || '' })),
    treaties: treatiesNow(g),
    sanctions: { byJapan: Object.entries(s.sanctions.byJapan).map(([id, v]) => ({ id, name: shortName(g, id), level: v.level, un: !!v.un, g7: !!v.g7 })), onJapan: Object.entries(s.sanctions.onJapan).map(([id, v]) => ({ id, name: shortName(g, id), level: v.level, war: !!v.war })) },
    conflicts: s.conflicts.filter((c) => c.status === 'war').map((c) => ({ ...c, aName: shortName(g, c.a), bName: shortName(g, c.b), posA: MAP_POS[c.a], posB: MAP_POS[c.b] })),
    crises: s.crises.map((k) => ({ ...k, countryName: k.country ? shortName(g, k.country) : '', pos: MAP_POS[k.country] || null })),
    deployments: s.deploy.filter((x) => !x.ended).map((x) => ({ ...x })),
    disputes: Object.values(DISPUTES).map((D) => ({ id: D.id, name: D.name, pos: D.pos, lines: D.lines(g), status: (s.disputes[D.id] || {}).status || 'dispute', admin: (s.disputes[D.id] || {}).admin || D.admin0, other: D.other.filter((x) => exists(g, x)).map((x) => shortName(g, x)) })),
    summits: upcomingSummits(g), unsc: { ...s.unsc, nextText: unscNextText(g) }, attack: attackOnJapan(g), peace: s.peace ? { ...s.peace, enemyName: countryName(g, s.peace.enemy, true) } : null,
    offers: s.offers.map((o) => ({ ...o, name: TREATIES[o.treaty] ? TREATIES[o.treaty].name : o.treaty })), leftUN: !!s.flags.leftUN,
    statements: s.statements.slice(0, 6).map((x) => ({ ...x, withName: shortName(g, x.with) })), record: { ...s.record },
    news: s.news.slice(0, 30),
  };
}
function upcomingSummits(g) {
  const d = worldDate(g);
  const out = [];
  for (let k = 0; k < 2; k++) {
    const y = d.year + k;
    for (const [id, S] of Object.entries(SUMMITS)) {
      const m = S.month(g, y);
      if (y === d.year && (m < d.month || (m === d.month && d.dom > 16))) continue;
      const n = y * 10000 + m * 100 + 15;
      if (S.from && n < S.from) continue;
      if (id === 'g20' && !W(g).g20 && n < 20081115) continue;
      const host = S.host(y);
      out.push({ id, name: S.name(g), year: y, month: m, n, host, hostName: host === 'un' ? '国連本部' : host === 'jp' ? '日本' : host ? countryName(g, current(g, host), true) : '' });
    }
  }
  return out.sort((a, b) => a.n - b.n).slice(0, 5);
}
function countryDetail(g, id) {
  const c = COUNTRIES[id];
  const s = W(g);
  const n = dateNum(g);
  const row = countryRow(g, id);
  if (!c) {
    const f = fictional()[id];
    if (!f) return null;
    return { ...row, leader: leaderTitle(g, id), gov: '', note: f.desc, treaties: [], alliances: [], dispute: null, nuclear: null, member: [], history: [] };
  }
  const nuc = dv(c.nuclear, n);
  const member = dv(c.member, n) || [];
  const MEMBER = { g7: since(g, 19980515) && s.g8 && id !== 'ru' ? 'G8' : 'G7', nato: 'NATO', apec: 'APEC', asean: 'ASEAN', ec: 'EC', eu: 'EU', warsaw: 'ワルシャワ条約機構', opec: 'OPEC' };
  const mem = member.filter((x) => x !== 'apec' || since(g, 19891106)).map((x) => MEMBER[x] || x);
  if (id === 'ru' && s.g8 && since(g, 19980515) && pairRelation(g, 'us', 'ru') > -35) mem.push('G8');
  if (c.p5) mem.unshift('国連安保理の常任理事国');
  return {
    ...row, leader: leaderTitle(g, id), gov: dv(c.gov, n), note: dv(c.note, n), member: mem,
    nuclear: nuc === 'nws' ? '核兵器を保有している' : nuc === 'test' ? '核実験を行い、核兵器を持つとされる' : nuc === 'test74' ? '1974年に核実験を行った' : null,
    treaties: treatiesNow(g).filter((t) => t.with.includes(id) || t.with.some((w) => orgHas(g, w, id))).map((t) => t.name),
    alliances: alliancesNow(g).filter((a) => (a.members || []).includes(id)).map((a) => a.short || a.name),
    dispute: c.dispute && exists(g, id) ? { name: DISPUTES[c.dispute].name, lines: DISPUTES[c.dispute].lines(g), status: (s.disputes[c.dispute] || {}).status } : null,
    conflicts: s.conflicts.filter((x) => x.status === 'war' && (x.a === id || x.b === id)).map((x) => x.name),
    met: s.summits.met[id] != null ? s.summits.met[id] : null, aid: Math.round(num(s.aid[id]) * 100) / 100,
    distance: distanceKm(id),
  };
}
// the actions for a target (or the global ones): [{ id, name, desc, why, odds, lines, options, target }]
function actionsFor(g, target, kind = null) {
  const type = !target ? 'none' : String(target).startsWith('c:') ? 'conflict' : String(target).startsWith('k:') ? 'crisis' : (ORGS[target] || PSEUDO[target]) ? 'org' : 'country';
  const t = type === 'conflict' || type === 'crisis' ? String(target).slice(2) : target;
  const out = [];
  for (const id of DIPLO_ORDER) {
    const D = DIPLO[id];
    const tt = D.target === 'trade' ? (type === 'country' || type === 'org' ? type : null) : D.target;
    if (kind && id !== kind) continue;
    if (tt !== type) continue;
    out.push(previewOf(g, id, t));
  }
  return out;
}
function previewOf(g, id, t, o = {}) {
  const D = DIPLO[id];
  let why = roleWhy(g, D.who);
  if (!why) { try { why = D.check.call(D, g, t, o); } catch (e) { console.error(e); why = 'いまはできない'; } }
  let odds = null, lines = [], options = null;
  try { odds = typeof D.odds === 'function' ? D.odds.call(D, g, t, o) : null; } catch (e) { odds = null; }
  try { lines = (typeof D.lines === 'function' ? D.lines.call(D, g, t, o) : []) || []; } catch (e) { lines = []; }
  try { options = typeof D.options === 'function' ? D.options.call(D, g, t) : null; } catch (e) { options = null; }
  return { id, name: D.name, desc: D.desc, who: D.who.slice(), why: why || null, odds: odds == null ? null : Math.round(clamp(odds, 0, 1) * 100) / 100, lines: lines.filter(Boolean), options, target: t };
}
function diplomacy(g, kind, target, opts = {}) {
  const D = DIPLO[kind];
  if (!D) return { ok: false, why: 'そんな外交の手段はない' };
  const t = typeof target === 'string' && /^[ck]:/.test(target) ? target.slice(2) : target;
  const why = roleWhy(g, D.who) || D.check.call(D, g, t, opts || {});
  if (why) return { ok: false, why };
  let res;
  try { res = D.run.call(D, g, t, opts || {}); } catch (e) { console.error(e); return { ok: false, why: 'うまくいかなかった' }; }
  emit(g, 'diplomacy', { kind, target: t, res });
  return res || { ok: true };
}

// ======================================================================== regime.js scenes (registered once regime.js loads)
let regimeHooked = false;
function hookRegime() {
  if (regimeHooked || !REG || typeof REG.registerRegimeScene !== 'function') return;
  regimeHooked = true;
  const show = (g, spec) => REG.showRegimeScene(g, spec);
  REG.registerRegimeScene('world_summit', async (g, d) => {
    if (!isPM(g)) return;
    const host = d.host === 'jp' ? '議長国は日本。各国の首脳を迎える。' : d.hostName ? `会場は${d.hostName}。` : '';
    await show(g, { art: 'summit', title: d.name, sub: `${d.year}年`, pages: [`${d.name}が開かれる。${host}`, '首脳たちが円卓を囲む。日本はどの議題を主導する？'], options: [...SUMMIT_AGENDA.map((a) => ({ label: a.label, value: a.id })), { label: '欠席する', value: 'skip' }], prompt: 'どの議題を主導する？',
      then: async (v) => { if (!v || v === 'skip') { bumpApproval(g, -1, `${d.name}の欠席`); standingAdd(g, -2); news(g, `${who0(g)}が${d.name}を欠席した`); await REG.sayWrapped(g, '欠席した。「日本の存在感が薄い」との声も出ている。'); return; } await REG.sayWrapped(g, attendSummit(g, d.id, v)); } });
  });
  REG.registerRegimeScene('world_treaty', async (g, d) => {
    await show(g, { art: 'treaty', title: d.name, sub: d.peace ? '講和' : '調印式', pages: [d.peace ? '講和条約の調印式。会場は静まりかえっている。' : '調印式。両国の首脳が条約に署名した。', d.line ? `${d.line}。` : '条約は発効へ向かう。'] });
  });
  REG.registerRegimeScene('world_treaty_offer', async (g, d) => {
    const T = TREATIES[d.treaty];
    if (!T || !W(g).offers.some((o) => o.treaty === d.treaty)) return;
    await show(g, { art: 'treaty', title: '交渉の妥結', sub: T.name, pages: [`外務省から報告：「${T.name}」の交渉がまとまった。`, '署名して国会の承認を求めるか、見送るかを決める。'], options: [{ label: '署名する', value: 'yes' }, { label: '見送る', value: 'no' }], prompt: '署名する？', then: async (v) => { await REG.sayWrapped(g, answerOffer(g, d.treaty, v === 'yes')); } });
  });
  REG.registerRegimeScene('world_unsc', async (g, d) => {
    await show(g, { art: 'un', title: '国連安保理の選挙', sub: `${d.year}年`, pages: [d.ok ? `国連総会の投票で、日本が安保理の非常任理事国に選ばれた（任期は${d.year + 1}〜${d.year + 2}年）。` : '国連総会の投票で、日本は非常任理事国の座を逃した。'] });
  });
  REG.registerRegimeScene('world_crisis', async (g, d) => {
    const k = crisisById(g, d.id);
    if (!k) return;
    const opts = [];
    for (const kind of ['evac', 'protest', 'un_raise', 'jdr', 'reserve', 'coordinate']) {
      const tgt = ['protest', 'un_raise'].includes(kind) ? k.country : k.id;
      const pv = previewOf(g, kind, tgt);
      if (!pv.why) opts.push({ label: pv.name.length > 13 ? pv.name.slice(0, 13) : pv.name, value: kind, tgt });
    }
    opts.push({ label: 'あとで', value: null });
    await show(g, { art: k.kind === 'missile' ? 'sea' : k.kind === 'coup' ? 'newspaper' : 'kantei', headline: k.title, title: k.title, sub: k.countryName || shortName(g, k.country), pages: [`【${k.title}】`, '官邸に情報が集まっている。どう対応する？'], options: opts.slice(0, 4).concat(opts.length > 4 ? [opts[opts.length - 1]] : []), prompt: 'どう対応する？',
      then: async (v) => { if (!v) return; const o = opts.find((x) => x.value === v); const r = diplomacy(g, v, o.tgt); await REG.sayWrapped(g, r.text || r.why || ''); } });
  });
  REG.registerRegimeScene('world_ally_request', async (g, d) => {
    const c = conflictById(g, d.conflict);
    if (!c || c.status !== 'war' || !isPM(g)) return;
    const ally = japanAllies(g).find((a) => a.id === c.a || a.id === c.b);
    const allyId = ally ? ally.id : 'us';
    const r1 = previewOf(g, 'rear', c.id), r2 = previewOf(g, 'collective', c.id);
    const opts = [];
    if (!r1.why) opts.push({ label: '後方支援を決める', value: 'rear' });
    opts.push({ label: r2.why ? '参戦の道を確かめる' : '集団的自衛権で参戦', value: 'collective' });
    opts.push({ label: '見送る', value: 'no' });
    await show(g, { art: 'kantei', title: '同盟国からの要請', sub: c.name, pages: [`${c.name}。${leaderTitle(g, allyId)}から電話があった。`, '「日本の協力を求めたい。後方支援か、それ以上の役割を」'], options: opts, prompt: 'どう答える？',
      then: async (v) => {
        if (v === 'no') { relAdd(g, allyId, -8); if (allyId === 'us') W(g).alliances.anpo.strength = clamp(W(g).alliances.anpo.strength - 5, 0, 100); news(g, `日本は${c.name}への協力を見送った`); await REG.sayWrapped(g, '協力を見送った。同盟国との関係が冷えた。'); return; }
        if (v === 'collective' && r2.why) { await REG.sayWrapped(g, [`いまはできない：${r2.why}`]); return; }
        const r = diplomacy(g, v, 'c:' + c.id);
        await REG.sayWrapped(g, r.text || r.why || '');
      } });
  });
  REG.registerRegimeScene('world_attack', async (g, d) => {
    const a = attackOnJapan(g);
    if (!a || !isPM(g)) return;
    const why = typeof g.regimeRefusal === 'function' ? g.regimeRefusal('defense') : '防衛出動の仕組みがない';
    await show(g, { art: 'sea', headline: '武力攻撃事態', title: '武力攻撃事態', sub: `${shortName(g, a.by)}の攻撃（${a.where}）`, pages: [`${shortName(g, a.by)}の部隊が${a.where}で攻撃してきた。自衛隊と海上保安庁に被害が出ている。`, '閣議を開き、対処の方針を決める。防衛出動には国会の承認が要る（自衛隊法76条）。'],
      options: [why ? null : { label: '防衛出動を命じる', value: 'defense' }, { label: '外交で収拾を図る', value: 'talk' }, { label: 'いまは様子を見る', value: null }].filter(Boolean), prompt: 'どうする？',
      then: async (v) => {
        if (v === 'defense') { const r = g.sdfOrder('defense'); await REG.sayWrapped(g, r.text || r.why || ''); return; }
        if (v === 'talk') { const p = clamp(0.3 + relation(g, a.by) / 300 + W(g).standing / 300, 0.05, 0.6); if (roll(p)) { a.over = true; relAdd(g, a.by, 10); news(g, `${shortName(g, a.by)}との間で、第三国の仲介による事態の収拾が合意された`); await REG.sayWrapped(g, '第三国の仲介で、事態の収拾に合意した。'); } else { bumpApproval(g, -3, '武力攻撃への対応'); await REG.sayWrapped(g, `収拾の交渉は実らなかった。（見込み ${pct(p)}）`); } }
      } });
  });
}

// ======================================================================== g.* methods and install
const methods = {
  world() { return summary(this); },
  worldCountry(id) { return countryDetail(this, id); },
  worldTick() { return worldTick(this); },
  worldNews(n = 10) { return W(this).news.slice(0, n); },
  diplomacy(kind, target, opts = {}) { return diplomacy(this, kind, target, opts); },
  diplomacyActions(target = null) { return actionsFor(this, target); },
  diplomacyPreview(kind, target, opts = {}) { const t = typeof target === 'string' && /^[ck]:/.test(target) ? target.slice(2) : target; return DIPLO[kind] ? previewOf(this, kind, t, opts) : null; },
  worldOffer(offerId, yes = true) { return answerOffer(this, offerId, yes); },
  worldSummit(id, agenda) { return attendSummit(this, id, agenda); },
  // tests / debug: fire a world event now ({ kind } of WORLD_EVENTS, or 'conflict' { a, b, aggressor }, 'attack' { by })
  worldEvent(kind, opts = {}) {
    if (kind === 'conflict') return newConflict(this, opts.a, opts.b, opts);
    if (kind === 'attack') { const s = W(this); s.attack = { by: opts.by, day: today(this), where: opts.where || '日本の離島の周辺' }; threatAdd(this, 25); news(this, `【速報】${shortName(this, opts.by)}の部隊が${s.attack.where}で日本を攻撃した`); scene(this, 'attack', { by: opts.by }, { front: true }); return s.attack; }
    const E = WORLD_EVENTS[kind];
    if (!E) return null;
    E.fire(this);
    return W(this).flags.lastEvent || true;
  },
  worldRelation(id) { return relation(this, id); },
  worldTies(id) { return hasTies(this, id); },
};
export function installWorld(proto) {
  if (!proto || proto.__world) return;
  Object.defineProperty(proto, '__world', { value: true, configurable: true });
  for (const [k, fn] of Object.entries(methods)) proto[k] = fn;
}
onMorning((g) => worldTick(g));
installWorld(Game.prototype);
if (typeof window !== 'undefined') window.__world = { W, COUNTRIES, DIPLO, WORLD_EVENTS, relation, pairRelation, blocOf, newConflict, endConflict, allyDecisions, setWorldRng, worldTick, previewOf };
export const relShift = (g, id, d) => relAdd(g, id, d);
