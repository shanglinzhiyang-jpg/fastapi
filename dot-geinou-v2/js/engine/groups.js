// 各界コア (STAKEHOLDER GROUPS): 観光地設置・協会・連合・スポーツ・ビジネス・セクト・有識者・アーティスト・文化・研究・政府
// — 11 domains of fictional organisations around the government. Each group has support toward the player's side (−100..100),
// influence, anger, a capacity for 献金/協力, NPC leaders (fictional names, personalities), grievances and concrete demands with
// deadlines. The player answers demands and acts on groups (会談・補助金・規制・圧力・懐柔・買収・弾圧 …) with odds, costs and
// pro/con voices; the effects reach the cabinet's approval, voter segments, the economy, political funds, party standing and
// the player's own fame (feature-detected through g.*). Round 5, agent R5-B. API doc: test-output/api_groups.txt.
// The screens (a tab 「各界」 in the 政府中枢 console, and the phone app 「各界」) are in groups_ui.js.
//
// ---------------------------------------------------------------- rules (BRIEF2 / BRIEF3, non-negotiable)
// - Every organisation is FICTIONAL (names checked against real bodies; real LAWS and AGENCIES with their real dates are used:
//   観光立国推進基本法 2006-12・観光庁 2008-10・文化庁 1968・スポーツ庁 2015-10・科学技術基本法 1995・連合 1989-11 …). No real
//   living person, company, union, sports body or artist is named. Real parties (自民・民主) are never accused of anything.
// - Nothing is hard-refused for being "bad" (買収, 圧力, 弾圧 …): the cost, the odds and the consequences are shown. A structural
//   fact (a law not in force yet, the wrong office) is explained together with the path that leads there.
// - Pro and con voices are shown with every action; no stance is "correct". The 弾圧 of a group is regime-aware: a democracy
//   answers with courts, demos and the press; a dictatorship removes those brakes (and pays elsewhere).
// - Era correctness: groups, laws and agencies exist by date (the 連合 forms in 1989-11 out of two older centres; the スポーツ庁
//   opens in 2015-10; the 世界遺産 treaty is in force for Japan from 1992; 住宅宿泊事業法 2018-06 …); old saves get defaults.
//
// ---------------------------------------------------------------- facts used (WebSearch 2026-10 unless marked 目安)
// 観光立国推進基本法: 2006-12-13 成立（議員立法, 平成18年法律第117号）, 2007-01-01 施行; 観光庁: 2008-10-01 発足（国土交通省の外局）.
// 総合保養地域整備法（リゾート法）: 1987-06 施行（昭和62年法律第71号）; the 1990s collapse of 第三セクター resorts: 総務省の政策評価 2003.
// 住宅宿泊事業法（民泊新法）: 2018-06-15 施行（届出制, 年180日まで）. 国際観光旅客税（出国税1,000円）: 2019-01 (記憶; 目安).
// 訪日外客数（万人, 目安）: 1987 216 / 1996 384 / 2004 614 / 2013 1,036 / 2016 2,404 / 2019 3,188 / 2020 412 / 2023 2,507 / 2024 3,687（2024は確認）.
// スポーツ庁: 2015-10-01 発足（文部科学省の外局, 2015-05-13 設置法成立）; 国民体育大会は2024年の第78回から「国民スポーツ大会」（2018年改正）.
// 連合: 1989-11-21 結成（総評が解散して官公労が合流, 78単産・約798万人）; 前身の民間連合は1987-11-20 結成; それ以前は総評・同盟・中立労連・新産別.
// 文化庁: 1968発足（日付は未確認）; 文化芸術振興基本法 2001-12-07（平成13年法律第148号）→ 文化芸術基本法 2017-06; 文化庁の機能強化 2018-10-01;
//   京都への移転 2023-03-27（一部）; クール・ジャパンの海外展開は2010年の新成長戦略で国家戦略に.
// 科学技術基本法: 1995 制定（議員立法, 全会一致）; 第1期科学技術基本計画 1996-07; 2021-04 から 科学技術・イノベーション基本法.
// 団体規制法（平成11年法律第147号）: 1999-12 施行, 観察処分 2000-01 から（公安審査委員会）; 破壊活動防止法・公安調査庁: 1952.
// 国立大学法人化: 2004-04-01（記憶）. 内閣人事局: 2014-05-30. 地方分権一括法: 2000-04 施行. 中央省庁再編: 2001-01-06. 政党助成法: 交付 1995-.
// 政治資金規正法: 2000-01 から政治家個人への企業・団体献金は禁止（政党・政党支部・資金管理団体〔個人からのみ〕）. 春闘の賃上げ率（連合集計, 目安）:
//   1987 3.56 / 1989 5.17 / 1991 5.66 / 1996 2.86 / 2000 2.06 / 2004 1.67 / 2013 1.78 / 2018 2.07 / 2023 3.58 / 2024 5.10 / 2025 5.25.
// 推定組織率（目安）: 1987 28.2% / 1996 23.2% / 2004 19.2% / 2024 16.1%.
// Fictional: every group, leader, site, panel member, laureate and sect below (and no real body shares their names).

import { Game } from './game.js';
import { onMorning } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { YEAR_DAYS } from './profile.js';

export const GROUPS_VERSION = 1;
const MONTH = 10; // game days per month
const ERA_START = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
const ERA_ORDER = ['showa', 'heisei_early', 'heisei', 'reiwa'];
const ANCHOR_YEARS = [1987, 1996, 2004, 2026];

// ================================================================ small helpers
let RNG = Math.random;
export function setGroupsRng(fn) { RNG = typeof fn === 'function' ? fn : Math.random; }
const rnd = () => RNG();
const roll = (p) => rnd() < p;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const r0 = (v) => Math.round(num(v));
const r1 = (v) => Math.round(num(v) * 10) / 10;
const r2 = (v) => Math.round(num(v) * 100) / 100;
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const today = (g) => (g && g.state && Number(g.state.day)) || 1;
const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±');
const fx1 = (v) => `${sg(v)}${Math.abs(r1(v))}`;
const eraOf = (g) => { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_START[e] ? e : 'reiwa'; };
const eraIdx = (g) => Math.max(0, ERA_ORDER.indexOf(eraOf(g)));
function lerpYears(arr, t) {
  if (!Array.isArray(arr)) return num(arr);
  if (t <= ANCHOR_YEARS[0]) return num(arr[0]);
  for (let i = 1; i < ANCHOR_YEARS.length; i++) {
    if (t <= ANCHOR_YEARS[i]) { const k = (t - ANCHOR_YEARS[i - 1]) / (ANCHOR_YEARS[i] - ANCHOR_YEARS[i - 1]); return num(arr[i - 1]) + (num(arr[i]) - num(arr[i - 1])) * k; }
  }
  return num(arr[arr.length - 1]);
}
function anchorsAt(list, t) { // [[year, v], …]
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) if (t <= list[i][0]) { const k = (t - list[i - 1][0]) / (list[i][0] - list[i - 1][0]); return list[i - 1][1] + (list[i][1] - list[i - 1][1]) * k; }
  return list[list.length - 1][1];
}

// politics (all optional; read through g.* only)
const has = (g, k) => !!g && typeof g[k] === 'function';
function safe(fn, d = null) { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } }
const polOf = (g) => (has(g, 'pol') && g.state ? safe(() => g.pol(), null) : null);

// The game date: year, month (1..12), dom, n (yyyymmdd, day 1..28), ym, t (fractional year), fy.
export function gdate(g) {
  let d = null;
  if (has(g, 'polDate')) d = safe(() => g.polDate(), null);
  if (!d || !Number.isFinite(d.year)) {
    const abs = today(g) - 1 + 3 * MONTH; // the game starts in April
    const year = (ERA_START[eraOf(g)] || 2026) + Math.floor(abs / YEAR_DAYS);
    const doy = abs % YEAR_DAYS;
    d = { year, month: Math.floor(doy / MONTH) + 1, dom: (doy % MONTH) * 3 + 1, doy, fy: year + 0.25 };
  }
  return { year: d.year, month: d.month, dom: d.dom, doy: d.doy, fy: d.fy, n: d.year * 10000 + d.month * 100 + Math.min(28, d.dom), ym: d.year * 100 + d.month, t: d.year + (d.month - 1) / 12 };
}
const ymd = (y, m = 1, d = 1) => y * 10000 + m * 100 + d;
const since = (g, n) => gdate(g).n >= n;
const nLabel = (n) => `${Math.floor(n / 10000)}年${Math.floor((n % 10000) / 100) || 1}月`;
// absolute political day for the economy shocks (the politics core's own basis)
function absOf(g) { const p = polOf(g); return today(g) - 1 + ((p && p.cal ? p.cal.month : 4) - 1) * MONTH; }

// ================================================================ the player's role
// kind: 'pm' | 'minister' | 'local' (知事・区長) | 'member' (国会議員・地方議員) | 'citizen' (incl. the entertainer)
export function groupsRole(g) {
  const out = { kind: 'citizen', pm: false, minister: false, local: false, member: false, posts: [], office: null, party: null, ruling: false, cabinet: false, ent: false, fame: 0, label: '市民', short: '閲覧・応援', weight: 0.3 };
  const st = g && g.state;
  if (st) { out.fame = num(st.fame); out.ent = !!(st.agency || out.fame >= 30); }
  const p = polOf(g);
  if (!p || !p.me) { if (out.ent) out.label = '芸能人'; return out; }
  const me = p.me;
  out.office = me.office || null;
  out.party = me.party || null;
  const posts = (me.posts || []).filter((x) => x && x !== 'pm' && !String(x).startsWith('party') && !['kanjicho', 'seichokai', 'somukai', 'sentai', 'kokutai'].includes(x) && !String(x).startsWith('speaker') && !String(x).startsWith('chair'));
  for (const [post, who] of Object.entries((p.cabinet && p.cabinet.ministers) || {})) if (who === 'player' && !posts.includes(post)) posts.push(post);
  out.posts = posts;
  out.pm = !!(p.cabinet && p.cabinet.pm === 'player');
  out.ruling = !!(me.party && ((p.cabinet && p.cabinet.partyIds) || []).includes(me.party));
  if (out.pm) Object.assign(out, { kind: 'pm', label: '内閣総理大臣', short: '全権', weight: 1, cabinet: true });
  else if (posts.length) Object.assign(out, { kind: 'minister', minister: true, label: '大臣', short: '所管', weight: 0.45, cabinet: true });
  else if (me.office === 'chiji' || me.office === 'shicho') Object.assign(out, { kind: 'local', local: true, label: me.office === 'chiji' ? '知事' : '市区長', short: '地元', weight: 0.4 });
  else if (me.office) Object.assign(out, { kind: 'member', member: true, label: me.office === 'shugi' ? '衆議院議員' : me.office === 'sangi' ? '参議院議員' : '地方議員', short: '提案', weight: 0.25 });
  else if (out.ent) out.label = '芸能人';
  return out;
}
// the post ids that run each domain (a minister of these has full control there)
export const DOMAIN_POSTS = {
  tourism: ['minister_transport', 'minister_construction', 'minister_land', 'minister_hokkaido', 'minister_okinawa', 'minister_special', 'minister_internal', 'minister_home'],
  kyokai: ['minister_agri', 'minister_health', 'minister_construction', 'minister_transport', 'minister_trade'],
  rengo: ['minister_health', 'minister_labor'],
  sports: ['minister_education', 'minister_special'],
  business: ['minister_trade', 'minister_finance', 'minister_epa', 'minister_econ'],
  sect: ['minister_justice', 'minister_npsc'],
  yushikisha: ['kanbo', 'minister_econ', 'minister_special', 'minister_epa'],
  artist: ['minister_education', 'minister_special'],
  bunka: ['minister_education', 'minister_special', 'minister_transport'],
  kenkyu: ['minister_education', 'minister_sci', 'minister_trade'],
  seifu: ['kanbo', 'minister_internal', 'minister_home', 'minister_mgmt', 'minister_finance'],
};
// does the player run this domain? 'full' (PM / the domain's minister / a local head for local domains) | 'part' | null
export function domainControl(role, domain) {
  if (!role) return null;
  if (role.kind === 'pm') return 'full';
  if (role.kind === 'minister') return role.posts.some((x) => (DOMAIN_POSTS[domain] || []).includes(x)) ? 'full' : 'part';
  if (role.kind === 'local') return ['tourism', 'sports', 'bunka', 'kyokai', 'seifu'].includes(domain) ? 'part' : null;
  return null;
}

// ================================================================ segments (the politics core's 11 voter segments)
export const SEG_NAME = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁業', unions: '労働組合', urban: '都市部', rural: '地方', floating: '無党派' };

// ================================================================ the domains
export const DOMAIN_ORDER = ['tourism', 'kyokai', 'rengo', 'sports', 'business', 'sect', 'yushikisha', 'artist', 'bunka', 'kenkyu', 'seifu'];
export const DOMAINS = {
  tourism: { id: 'tourism', name: '観光地', full: '観光地設置', color: '#4fd2e8', w: 0.6, desc: '観光地を指定し、整備し、売り出す。町おこし・観光立国。地元の暮らしとの両立（オーバーツーリズム）も課題。' },
  kyokai: { id: 'kyokai', name: '協会', full: '協会・業界団体', color: '#e8c25a', w: 0.9, desc: '農水・医療・建設・商店街など、業界ごとの団体。補助金・規制・制度をめぐる要望の主役。' },
  rengo: { id: 'rengo', name: '連合', full: '連合・労働組合', color: '#ff7a7a', w: 1.0, desc: '労働組合とそのナショナルセンター。春闘・最低賃金・ストライキ・働き方の制度。' },
  sports: { id: 'sports', name: 'スポーツ', full: 'スポーツ', color: '#57d98a', w: 0.5, desc: '競技団体・プロスポーツ・地域のクラブ。大会の誘致（五輪・万博・W杯）、強化費、不祥事。' },
  business: { id: 'business', name: 'ビジネス', full: 'ビジネス（経済界）', color: '#c8a0ff', w: 1.0, desc: '大企業・経営者・中小企業・新興企業の団体。献金・要望書・規制緩和・海外進出。' },
  sect: { id: 'sect', name: 'セクト', full: 'セクト（宗教・政治集団）', color: '#ff9ac8', w: 0.5, desc: '宗教団体や政治セクト、分派、ネットの過激集団。組織票・過激化・公安の監視。' },
  yushikisha: { id: 'yushikisha', name: '有識者', full: '有識者', color: '#7aa8ff', w: 0.6, desc: '学者・論客の集まり。有識者会議（私的諮問機関）を開き、報告書を政策の後ろ盾にする。操作すれば信頼を失う。' },
  artist: { id: 'artist', name: 'アーティスト', full: 'アーティスト', color: '#ff7eb6', w: 0.5, desc: '美術・音楽・映像・芸能の表現者。展覧会、表現の自由、顕彰、応援と抗議。芸能人のあなたは当事者。' },
  bunka: { id: 'bunka', name: '文化', full: '文化', color: '#e8a050', w: 0.4, desc: '文化財・伝統芸能・祭り・クールジャパン。文化庁と文化芸術基本法の分野。' },
  kenkyu: { id: 'kenkyu', name: '研究', full: '研究（科学技術）', color: '#4fd2c8', w: 0.5, desc: '大学・学術団体・若手研究者・産学連携。研究費は長い目で成長に効く。研究不正とノーベル賞のニュースも。' },
  seifu: { id: 'seifu', name: '政府', full: '政府（官庁・自治体）', color: '#a0b8d0', w: 0.8, desc: '官庁と自治体との関係。省庁の忠誠と抵抗、知事会・市長会、総理への信頼。' },
};
// the institutions of each domain by date: [yyyymmdd, text] — shown only once they have happened (never the future)
export const INSTITUTIONS = {
  tourism: [
    [19870609, '総合保養地域整備法（リゾート法）が施行。各地でリゾート構想が動きだす'],
    [19920630, '日本が世界遺産条約を結ぶ（世界遺産への登録申請が可能に）'],
    [20030401, 'ビジット・ジャパン事業が始まる（訪日外国人の誘致に国が本腰）'],
    [20070101, '観光立国推進基本法が施行（2006年12月成立）'],
    [20081001, '観光庁が国土交通省の外局として発足'],
    [20180615, '住宅宿泊事業法（民泊新法）が施行。届出制で年180日まで'],
    [20190107, '国際観光旅客税（出国税）が始まる（目安）'],
  ],
  kyokai: [
    [19470714, '独占禁止法のもと、業界団体は価格を決めてはならない（カルテル・談合の禁止）'],
    [19950101, '政党助成法に基づき政党交付金が始まる。団体献金への依存を減らすねらい'],
    [20000101, '政治家個人への企業・団体の献金は禁止（政党・政党支部への献金は可）'],
    [20060101, '公共工事の談合への課徴金が強化（独占禁止法の改正）'],
  ],
  rengo: [
    [19590401, '最低賃金法が施行（中央最低賃金審議会が目安を答申）'],
    [19871120, '全日本民間労働組合連合会（民間連合）が結成され、労働界の統一が進む'],
    [19891121, '連合が結成（総評などが合流）。官民をまとめる最大のナショナルセンターに'],
    [20080301, '労働契約法が施行。契約のルールが法律に'],
    [20130920, '政労使会議が始まる（賃上げをめぐって政府・経営側・労働側が話し合う）'],
    [20190401, '働き方改革関連法が順次施行。残業時間に上限'],
  ],
  sports: [
    [19640101, '1964年に東京で夏季五輪を開いた経験がある'],
    [19980207, '長野で冬季五輪が開幕（1998年）'],
    [20020531, '日韓共催のサッカー・ワールドカップが開幕（2002年）'],
    [20110824, 'スポーツ基本法が施行。スポーツは国民の権利とされた'],
    [20151001, 'スポーツ庁が文部科学省の外局として発足'],
    [20240101, '国民体育大会が「国民スポーツ大会」に名前を変えた（2024年の第78回から）'],
  ],
  business: [
    [19480701, '政治資金規正法（1948年）：企業・団体の献金にも報告のルール'],
    [20000101, '政治家個人への企業・団体の献金を禁止。政党・政党支部へは可能'],
    [20060501, '会社法が施行（会社のルールが一本の法律に）'],
    [20130920, '政労使会議が始まり、経営側にも賃上げ要請'],
  ],
  sect: [
    [19520721, '破壊活動防止法と公安調査庁（団体の調査・監視の仕組み）'],
    [19951215, '宗教法人法が改正（報告徴収・質問権, 1996年施行）'],
    [19991227, '団体規制法の観察処分の請求が始まる（無差別大量殺人行為を行った団体が対象）'],
    [20221216, '法人等による寄附の不当な勧誘の防止等に関する法律が公布'],
  ],
  yushikisha: [
    [19810316, '第二次臨時行政調査会（臨調）が発足。有識者の提言で行革を進める手法が定着'],
    [20010106, '中央省庁再編。審議会は大幅に整理され、経済財政諮問会議などが置かれる'],
    [20130101, '内閣に有識者会議（私的諮問機関）が多く置かれるようになる（目安）'],
  ],
  artist: [
    [19710101, '現行の著作権法が施行（1970年制定）'],
    [20040609, 'コンテンツの創造・保護・活用を促す法律が成立（目安）'],
    [20170623, '文化芸術振興基本法が改正され、文化芸術基本法に'],
  ],
  bunka: [
    [19500530, '文化財保護法が成立'],
    [19680615, '文化庁が発足（1968年。日付は目安）'],
    [20011207, '文化芸術振興基本法が成立'],
    [20100618, '新成長戦略で「クール・ジャパン」の海外展開が国の戦略に'],
    [20181001, '文化庁が機能強化・組織改編（文化による地方創生など）'],
    [20230327, '文化庁の京都での業務が一部始まる'],
  ],
  kenkyu: [
    [19951115, '科学技術基本法が制定（議員立法）。科学技術基本計画の時代に'],
    [19960702, '第1期科学技術基本計画（1996〜2000年度）'],
    [20010106, '総合科学技術会議が内閣府に（省庁再編）'],
    [20040401, '国立大学が法人化'],
    [20210401, '科学技術・イノベーション基本法に改正'],
  ],
  seifu: [
    [19990716, '地方分権一括法が成立（2000年4月施行）'],
    [20010106, '中央省庁再編（1府22省庁→1府12省庁）'],
    [20080430, 'ふるさと納税の制度が始まる（地方税法の改正）'],
    [20140530, '内閣人事局が発足。幹部人事を官邸が一元管理'],
  ],
};
export function institutionsNow(g, domain) {
  const n = gdate(g).n;
  const list = (INSTITUTIONS[domain] || []).filter((x) => x[0] <= n);
  return list.slice(-4).map((x) => ({ n: x[0], when: nLabel(x[0]), text: x[1] }));
}

// ================================================================ names of the NPC leaders (all fictional)
const SURNAMES = ['白石', '久保田', '柏木', '三枝', '榊原', '水野', '小野寺', '岩崎', '真壁', '日下部', '堀越', '諏訪', '野々村', '氷室', '桐谷', '小早川', '篠原', '宇佐美', '滝沢', '高階', '森脇', '能見', '矢代', '間宮', '結城', '神崎', '古賀', '橘', '戸田', '朝倉', '羽賀', '楢崎', '沢渡', '長瀬', '藤波', '東海林', '鳥居', '浅野目', '須藤', '大畑'];
const GIVEN_M = ['恒雄', '正臣', '修造', '康平', '隆弘', '哲也', '昌樹', '慎吾', '秀明', '俊彦', '清志', '達也', '直樹', '吉郎', '健太郎', '宗一', '昭彦', '一貴', '洋平', '義則'];
const GIVEN_F = ['美智子', '千鶴', '祥子', '理恵', '恵美', '和子', '由紀', '律子', '朋美', '佳代', '絵里', '真琴', '紀子', '澄江', '菜穂', '洋子'];
export const LEADER_PERSONAS = {
  katai: { name: '頑固', desc: '一度決めたら譲らない。圧力には反発しやすい', conc: -0.12, press: -0.15, bribe: -0.1 },
  jitsuri: { name: '実利派', desc: '損得で動く。補助金や実利の話が通じる', conc: 0.12, press: 0.02, bribe: 0.12 },
  kyoko: { name: '強硬派', desc: '要求を強く出す。拒まれると怒りが大きい', conc: -0.06, press: -0.1, bribe: -0.04 },
  chowa: { name: '調整型', desc: '落としどころを探す。会談が効きやすい', conc: 0.1, press: 0.04, bribe: 0 },
  media: { name: '発信好き', desc: '記者会見やSNSで声を上げる。話が広まりやすい', conc: 0, press: -0.06, bribe: -0.08 },
  seijitsu: { name: '誠実', desc: '筋を通す人。買収には応じない', conc: 0.05, press: -0.02, bribe: -0.2 },
};
const PERSONA_IDS = Object.keys(LEADER_PERSONAS);
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0); }
function seededPick(arr, seed) { return arr[seed % arr.length]; }
function makeLeader(id, k, title, seed2 = 0, day = 0) {
  const h = hashStr(`${id}:${k}:${seed2}`);
  const female = (h >>> 3) % 4 === 0;
  const name = `${seededPick(SURNAMES, h >>> 5)} ${seededPick(female ? GIVEN_F : GIVEN_M, h >>> 9)}`;
  return { name, title, persona: seededPick(PERSONA_IDS, h >>> 13), female, since: day };
}

// ================================================================ the groups (all fictional)
// def: { id, domain, name, kana, kind, seg, lean {econ, social, security: −2..2}, inf [1987, 1996, 2004, 2026], cap (0..100),
//   likes[] / dislikes[] (POLICIES ids), titles[] (leaders), asks: [[kind, text, opts?]], years: [from, to) as yyyymmdd,
//   link: 'religion:<id>' (mirrors govt.js), cred (有識者: credibility), note }
// ask kinds: money 予算・補助 · dereg 規制緩和 · protect 規制・保護 · honor 顕彰 · consult 協議の場 · law 法整備 · event 行事・大会 · staff 人事・ポスト · safety 安全・条件 · wage 賃上げ
export const GROUP_DEFS = {};
function GR(id, domain, name, o) { GROUP_DEFS[id] = { id, domain, name, lean: { econ: 0, social: 0, security: 0 }, inf: [20, 20, 20, 20], cap: 20, likes: [], dislikes: [], titles: ['会長', '専務理事'], asks: [], years: null, ...o }; }

// ---- 観光地
GR('t_kyokai', 'tourism', 'ドット観光協会連合', { kana: 'どっとかんこうきょうかいれんごう', kind: '各地の観光協会の連合会', seg: 'selfemployed', lean: { econ: 1, social: 0, security: 0 }, inf: [30, 34, 40, 48], cap: 45, likes: ['tourism', 'deregulation', 'public_works', 'ir_casino'], dislikes: [],
  asks: [['money', '観光PRと受け入れ環境の予算を増やしてほしい'], ['event', '大型の観光キャンペーンやイベントを後押ししてほしい'], ['law', '観光立国のための制度（ビザの緩和・受け入れ体制）を整えてほしい', { policy: 'tourism' }]] });
GR('t_yado', 'tourism', 'ドット旅館ホテル組合', { kana: 'どっとりょかんほてるくみあい', kind: '旅館・ホテルの組合', seg: 'selfemployed', lean: { econ: 0.5, social: 0.5, security: 0 }, inf: [35, 32, 30, 30], cap: 50, likes: ['tourism', 'foreign_workers'], dislikes: ['min_wage'], titles: ['組合長', '副組合長'],
  asks: [['money', '人手不足と設備の更新に補助を出してほしい'], ['protect', '無許可の宿泊サービスを取り締まってほしい'], ['staff', '外国人材の受け入れを広げてほしい', { policy: 'foreign_workers' }]] });
GR('t_jumin', 'tourism', '観光地の暮らしを守る会', { kana: 'かんこうちのくらしをまもるかい', kind: '観光地の住民の会', seg: 'families', lean: { econ: -0.5, social: 0.5, security: 0 }, inf: [15, 18, 22, 30], cap: 5, likes: ['env_regulation'], dislikes: ['ir_casino'], titles: ['代表', '世話人'],
  asks: [['protect', '混雑とマナー違反を減らす対策を急いでほしい'], ['money', 'ごみ・交通・防犯の費用を観光のお金から出してほしい'], ['consult', '観光計画に住民の声を入れる協議の場がほしい']] });

// ---- 協会
GR('k_nosui', 'kyokai', 'ドット農水団体連合', { kana: 'どっとのうすいだんたいれんごう', kind: '農家・漁業者の団体', seg: 'farmers', lean: { econ: -0.5, social: 0.5, security: 0.2 }, inf: [60, 52, 42, 34], cap: 55, likes: ['farm_income', 'fisheries', 'local_grant'], dislikes: ['farm_import', 'fta', 'gentan_end'], titles: ['会長', '専務理事'],
  asks: [['money', '農家・漁業者の所得を支える予算がほしい'], ['protect', '輸入が増えても国内の生産を守る備えがほしい'], ['law', '後継者と新規就農者を増やす制度がほしい']] });
GR('k_iryo', 'kyokai', 'ドット医療福祉協会', { kana: 'どっといりょうふくしきょうかい', kind: '医師・病院・介護事業者の団体', seg: 'elderly', lean: { econ: -0.3, social: 0.3, security: 0 }, inf: [58, 56, 52, 48], cap: 60, likes: ['care_expand', 'care_insurance', 'pension_up'], dislikes: ['medical_cost', 'medical_copay'], titles: ['会長', '副会長'],
  asks: [['money', '診療や介護の報酬を引き上げてほしい'], ['staff', '医師・看護師・介護職員を確保する手立てがほしい'], ['safety', '過疎地の医療と夜間の救急を守ってほしい']] });
GR('k_kensetsu', 'kyokai', 'ドット建設業協会', { kana: 'どっとけんせつぎょうきょうかい', kind: '建設・土木の業界団体', seg: 'rural', lean: { econ: -0.2, social: 0.4, security: 0.2 }, inf: [62, 60, 42, 38], cap: 65, likes: ['public_works', 'disaster_prep', 'local_grant'], dislikes: ['public_works_cut', 'fiscal_consolidation'], titles: ['会長', '専務理事'],
  asks: [['money', '公共事業の発注を安定して確保してほしい'], ['safety', '人手不足と働き方の問題に国として手を打ってほしい'], ['law', '入札制度を地元企業が参加しやすい形にしてほしい']] });
GR('k_shoten', 'kyokai', 'ドット商店街振興協会', { kana: 'どっとしょうてんがいしんこうきょうかい', kind: '商店街・小売店の団体', seg: 'selfemployed', lean: { econ: 0.2, social: 0.5, security: 0 }, inf: [45, 40, 34, 30], cap: 35, likes: ['reduced_rate', 'stimulus'], dislikes: ['shohizei_up', 'min_wage'], titles: ['会長', '事務局長'],
  asks: [['money', '商店街のにぎわいを取り戻す支援がほしい'], ['protect', '大型店やネット通販との公平なルールがほしい'], ['safety', '税や社会保険料の負担を軽くしてほしい']] });

// ---- 連合（労働）
GR('r_somei', 'rengo', 'ドット総評議会', { kana: 'どっとそうひょうぎかい', kind: '官公庁・公共部門が中心の労働団体（連合の前身の一つ）', seg: 'unions', lean: { econ: -1.5, social: -1, security: -1 }, inf: [55, 0, 0, 0], cap: 15, likes: ['min_wage'], dislikes: ['civil_service_cut', 'privatize_public', 'defense_up'], titles: ['議長', '事務局長'], years: [0, 19891121],
  asks: [['wage', '春闘で大幅な賃上げを実現してほしい'], ['protect', '民営化や定員削減から公共部門の職員を守ってほしい'], ['law', '労働時間の短縮（週休2日・年間労働時間1800時間）を進めてほしい']] });
GR('r_domei', 'rengo', 'ドット同盟会議', { kana: 'どっとどうめいかいぎ', kind: '民間大企業の労組が中心の労働団体（連合の前身の一つ）', seg: 'unions', lean: { econ: -0.3, social: 0, security: 0.5 }, inf: [45, 0, 0, 0], cap: 25, likes: ['min_wage'], dislikes: ['corp_tax_up'], titles: ['会長', '書記長'], years: [0, 19891121],
  asks: [['wage', '景気にあった賃上げを労使の話し合いで決めたい'], ['consult', '政労使の協議の場を持ってほしい'], ['law', '雇用を守る制度を整えてほしい']] });
GR('r_rengo', 'rengo', 'ドット連合', { kana: 'どっとれんごう', kind: '労働組合のナショナルセンター', seg: 'unions', lean: { econ: -0.8, social: -0.4, security: 0 }, inf: [0, 55, 48, 42], cap: 25, likes: ['min_wage', 'irregular_protect', 'work_style', 'free_tuition', 'child_allowance'], dislikes: ['haken_dereg', 'civil_service_cut'], titles: ['会長', '事務局長'], years: [19891121, 99999999],
  asks: [['wage', '物価に負けない賃上げと、中小・非正規への波及をお願いしたい'], ['law', '最低賃金の大幅な引き上げを法律・制度で後押ししてほしい', { policy: 'min_wage' }], ['safety', '長時間労働の規制と、過労を防ぐ仕組みを強めてほしい', { policy: 'work_style' }]] });
GR('r_koumu', 'rengo', 'ドット公務員労働組合協議会', { kana: 'どっとこうむいんろうどうくみあいきょうぎかい', kind: '国・自治体の職員組合', seg: 'unions', lean: { econ: -1, social: -0.5, security: -0.3 }, inf: [30, 28, 22, 18], cap: 10, likes: [], dislikes: ['civil_service_cut', 'privatize_public', 'postal_privatization', 'ministry_reorg'], titles: ['議長', '書記長'],
  asks: [['wage', '人事院勧告どおりの給与改定を実施してほしい'], ['protect', '定員削減や民営化から職場と身分を守ってほしい'], ['consult', '職員団体との交渉・協議の場を保障してほしい']] });
GR('r_union', 'rengo', 'ドット非正規ユニオン', { kana: 'どっとひせいきゆにおん', kind: '非正規・フリーターのユニオン', seg: 'young', lean: { econ: -1.2, social: -1, security: -0.5 }, inf: [5, 12, 22, 26], cap: 5, likes: ['irregular_protect', 'min_wage', 'work_style'], dislikes: ['haken_dereg'], titles: ['代表', '書記長'], years: [19930101, 99999999],
  asks: [['law', '同一労働同一賃金を実効性のあるものにしてほしい', { policy: 'irregular_protect' }], ['wage', '最低賃金を時給1,500円にしてほしい'], ['safety', '違法な働かせ方（サービス残業・雇い止め）を取り締まってほしい']] });

// ---- スポーツ
GR('s_kyogi', 'sports', 'ドット競技団体連合会', { kana: 'どっときょうぎだんたいれんごうかい', kind: '競技団体の連合体', seg: 'young', lean: { econ: 0.2, social: 0.3, security: 0 }, inf: [35, 35, 38, 40], cap: 40, likes: ['free_tuition'], dislikes: [], titles: ['会長', '専務理事'],
  asks: [['money', '選手の強化費と競技場の整備費を増やしてほしい'], ['event', '大きな国際大会を日本に呼んでほしい'], ['law', 'スポーツ施策の司令塔と、スポーツ振興の法律がほしい', { to: 20151001 }]] });
GR('s_pro', 'sports', 'ドット・プロリーグ機構', { kana: 'どっとぷろりーぐきこう', kind: 'プロスポーツのリーグ', seg: 'urban', lean: { econ: 1, social: 0, security: 0 }, inf: [30, 32, 34, 36], cap: 55, likes: ['deregulation', 'ir_casino'], dislikes: [], titles: ['コミッショナー', '事務総長'],
  asks: [['dereg', '球場・スタジアムの使い方や広告の規制を緩めてほしい'], ['event', '新スタジアムとにぎわいづくりを後押ししてほしい'], ['safety', '観客の安全と、暴力団・賭博の排除を進めてほしい', { policy: 'anti_yakuza' }]] });
GR('s_chiiki', 'sports', 'ドット地域スポーツ振興会', { kana: 'どっとちいきすぽーつしんこうかい', kind: '学校・地域のスポーツクラブの会', seg: 'families', lean: { econ: -0.2, social: 0.3, security: 0 }, inf: [20, 22, 24, 26], cap: 10, likes: ['education_reform', 'free_childcare'], dislikes: [], titles: ['会長', '事務局長'],
  asks: [['money', '体育館・グラウンドと指導者の費用を支えてほしい'], ['safety', '体罰・暴力・ハラスメントをなくす仕組みがほしい'], ['honor', '地域の指導者を表彰して、励みにしてほしい']] });

// ---- ビジネス
GR('b_keizai', 'business', 'ドット経済団体連盟', { kana: 'どっとけいざいだんたいれんめい', kind: '大企業の経済団体', seg: 'business', lean: { econ: 1.8, social: 0.5, security: 0.5 }, inf: [72, 70, 66, 62], cap: 85, likes: ['corp_tax_cut', 'deregulation', 'fta', 'fiscal_consolidation', 'shohizei_up', 'nuclear_promote', 'haken_dereg'], dislikes: ['corp_tax_up', 'carbon_tax', 'capital_gains_tax'], titles: ['会長', '副会長'],
  asks: [['dereg', '規制緩和と特区で、新しい事業に挑戦しやすくしてほしい', { policy: 'deregulation' }], ['money', '法人税の負担と研究開発の費用を軽くしてほしい', { policy: 'corp_tax_cut' }], ['event', '海外進出を後押しする経済連携協定や、ミッションの派遣をしてほしい', { policy: 'fta' }]] });
GR('b_doyu', 'business', 'ドット経営者フォーラム', { kana: 'どっとけいえいしゃふぉーらむ', kind: '経営者個人が集まる会', seg: 'business', lean: { econ: 1, social: -0.3, security: 0 }, inf: [38, 38, 36, 34], cap: 40, likes: ['deregulation', 'digital_gov'], dislikes: [], titles: ['代表幹事', '幹事'],
  asks: [['consult', '成長戦略づくりに経営者の声を入れてほしい'], ['dereg', '古い規制の洗い出しと見直しを進めてほしい'], ['law', '女性・高齢者・外国人が働きやすい制度にしてほしい']] });
GR('b_chusho', 'business', 'ドット中小企業連盟', { kana: 'どっとちゅうしょうきぎょうれんめい', kind: '中小企業の団体', seg: 'selfemployed', lean: { econ: 0.3, social: 0.5, security: 0 }, inf: [45, 44, 40, 36], cap: 45, likes: ['stimulus', 'reduced_rate'], dislikes: ['shohizei_up', 'min_wage', 'corp_tax_up'], titles: ['会長', '専務理事'],
  asks: [['money', '資金繰りと価格転嫁の支援がほしい'], ['safety', '社会保険料と賃上げの負担を軽くしてほしい'], ['protect', '下請けいじめをなくし、取引を適正にしてほしい']] });
GR('b_shinko', 'business', 'ドット新興企業家協会', { kana: 'どっとしんこうきぎょうかきょうかい', kind: '新しい会社・スタートアップの協会', seg: 'young', lean: { econ: 1.2, social: -0.8, security: 0 }, inf: [0, 0, 26, 34], cap: 35, likes: ['deregulation', 'digital_gov'], dislikes: [], titles: ['代表理事', '理事'], years: [20000101, 99999999],
  asks: [['dereg', '新しいサービスが試せるよう、規制を緩めてほしい'], ['law', '起業と資金調達の制度を整えてほしい'], ['consult', '政策づくりに若い企業の声を聞いてほしい']] });

// ---- セクト
GR('c_wako', 'sect', '和光修養会', { kana: 'わこうしゅうようかい', kind: '新宗教（在家の修養団体）', seg: 'elderly', lean: { econ: 0, social: 0.8, security: 0.3 }, inf: [18, 20, 22, 24], cap: 30, likes: ['education_reform'], dislikes: [], titles: ['会長', '理事長'], link: 'religion:wako', note: '宗教団体が政治活動をすること自体は憲法で禁じられていない（政教分離は国の側のルール）' });
GR('c_soukyu', 'sect', '蒼穹の泉', { kana: 'そうきゅうのいずみ', kind: '宗教団体（高額献金のトラブルが指摘される）', seg: 'elderly', lean: { econ: 0, social: 0.5, security: 0 }, inf: [4, 6, 8, 8], cap: 40, likes: [], dislikes: [], titles: ['代表', '総務'], link: 'religion:tenkan', note: '信仰そのものではなく、違法な勧誘や献金の強要が問題として扱われる' });
GR('c_souen', 'sect', '蒼炎派', { kana: 'そうえんは', kind: '急進的な政治セクト（左派の分派）', seg: 'young', lean: { econ: -2, social: -2, security: -2 }, inf: [8, 5, 4, 3], cap: 3, likes: [], dislikes: ['defense_up', 'security_law', 'conspiracy_law', 'police_up'], titles: ['議長', '書記局員'], radical: true,
  asks: [['protect', '集会と表現の自由を保障し、公安の監視をやめてほしい'], ['consult', '運動の主張を聞く機会がほしい'], ['law', '再軍備と治安立法を撤回してほしい']] });
GR('c_gyoten', 'sect', '暁天結社', { kana: 'ぎょうてんけっしゃ', kind: '急進的な政治結社（右派の分派）', seg: 'rural', lean: { econ: 0.3, social: 2, security: 2 }, inf: [8, 5, 5, 6], cap: 8, likes: ['defense_up', 'amend_sdf'], dislikes: ['foreign_workers', 'same_sex_marriage', 'separate_surnames'], titles: ['総裁', '幹事長'], radical: true,
  asks: [['protect', '国の守りと伝統を重んじる政策をとってほしい'], ['consult', '運動の主張を聞く機会がほしい'], ['law', '外国人の受け入れ拡大をやめてほしい']] });
GR('c_hai', 'sect', '灰の会', { kana: 'はいのかい', kind: 'ネット発の過激な政治コミュニティ', seg: 'young', lean: { econ: -0.5, social: 1, security: 0.5 }, inf: [0, 0, 0, 10], cap: 4, likes: [], dislikes: [], titles: ['管理人', '古参'], years: [20100101, 99999999], radical: true,
  asks: [['protect', '「偏向報道」を許さず、言論の場を自由にしてほしい'], ['consult', '運動の声を無視しないでほしい'], ['safety', '運営への不当な削除や凍結をやめさせてほしい']] });

// ---- 有識者
GR('y_keizai', 'yushikisha', 'ドット経済学者会議', { kana: 'どっとけいざいがくしゃかいぎ', kind: '経済学者の集まり', seg: 'floating', lean: { econ: 0.5, social: 0, security: 0 }, inf: [35, 38, 42, 45], cap: 5, cred: 70, titles: ['座長', '幹事'], likes: ['fiscal_consolidation'], dislikes: [],
  asks: [['consult', '政策の前に、データと分析を聞く場を設けてほしい'], ['honor', '提言を無視せず、採否の理由を説明してほしい'], ['law', '統計と財政の透明性を高めてほしい']] });
GR('y_hogaku', 'yushikisha', 'ドット憲法学者の会', { kana: 'どっとけんぽうがくしゃのかい', kind: '憲法・法学者の集まり', seg: 'floating', lean: { econ: -0.3, social: -1.2, security: -1.2 }, inf: [30, 30, 28, 28], cap: 3, cred: 75, titles: ['代表', '世話人'], likes: [], dislikes: ['amend_emergency', 'conspiracy_law'],
  asks: [['protect', '憲法の手続きと、立憲主義を守ってほしい'], ['consult', '法案づくりの段階から意見を聞いてほしい'], ['honor', '学問の自由を尊重してほしい']] });
GR('y_shakai', 'yushikisha', 'ドット社会・福祉研究フォーラム', { kana: 'どっとしゃかいふくしけんきゅうふぉーらむ', kind: '社会学・福祉の研究者の集まり', seg: 'floating', lean: { econ: -0.8, social: -0.5, security: 0 }, inf: [25, 28, 32, 32], cap: 3, cred: 65, titles: ['座長', '幹事'], likes: ['care_expand', 'child_allowance', 'irregular_protect'], dislikes: ['pension_cut'],
  asks: [['consult', '現場の調査を踏まえた提言を聞いてほしい'], ['law', '貧困と孤立への対策を制度にしてほしい'], ['honor', '調査研究を支える予算を確保してほしい']] });
GR('y_rondan', 'yushikisha', 'ドット論壇・メディア識者の会', { kana: 'どっとろんだんめでぃあしきしゃのかい', kind: 'テレビ・新聞の論客・コメンテーターの集まり', seg: 'floating', lean: { econ: 0.2, social: 0, security: 0.2 }, inf: [40, 45, 55, 60], cap: 20, cred: 45, titles: ['世話人', '常連'], likes: [], dislikes: [],
  asks: [['consult', '取材と対話の機会を増やしてほしい'], ['protect', '報道と言論の自由を守ってほしい'], ['honor', '政権の説明責任を果たしてほしい']] });

// ---- アーティスト
GR('a_bijutsu', 'artist', 'ドット美術家協会', { kana: 'どっとびじゅつかきょうかい', kind: '画家・彫刻家・美術家の協会', seg: 'urban', lean: { econ: -0.3, social: -1, security: -0.5 }, inf: [12, 12, 12, 12], cap: 8, likes: ['culture_ent'], dislikes: [], titles: ['会長', '理事'],
  asks: [['money', '展覧会と制作の場への支援がほしい'], ['protect', '表現の自由を守り、展示の中止を許さないでほしい'], ['honor', '功績のある作家を顕彰してほしい']] });
GR('a_ongaku', 'artist', 'ドット音楽家連盟', { kana: 'どっとおんがくかれんめい', kind: '作曲家・演奏家・歌い手の連盟', seg: 'young', lean: { econ: 0, social: -0.3, security: 0 }, inf: [18, 20, 22, 24], cap: 20, likes: ['culture_ent'], dislikes: [], titles: ['会長', '理事'],
  asks: [['law', '著作権と演奏の権利を守る制度を整えてほしい'], ['money', 'ホールと若手の活動を支える予算がほしい'], ['event', '国の行事や音楽祭を開いてほしい']] });
GR('a_hyogen', 'artist', 'ドット表現者の会', { kana: 'どっとひょうげんしゃのかい', kind: '映画・出版・マンガ・アニメの作り手の会', seg: 'young', lean: { econ: 0.2, social: -1.2, security: -0.3 }, inf: [15, 20, 30, 38], cap: 25, likes: ['culture_ent'], dislikes: [], titles: ['代表', '世話人'],
  asks: [['protect', '表現への規制や自主規制の強まりに歯止めをかけてほしい'], ['money', '制作と海外展開への支援がほしい'], ['law', '著作権と、無断の複製・配信への対策を強めてほしい']] });
GR('a_geinou', 'artist', 'ドット芸能人の会', { kana: 'どっとげいのうじんのかい', kind: '芸能人・芸能事務所の団体', seg: 'floating', lean: { econ: 0.3, social: 0, security: 0 }, inf: [40, 42, 44, 44], cap: 50, likes: ['culture_ent'], dislikes: [], titles: ['会長', '副会長'],
  asks: [['safety', '契約と働く環境（ギャラ・長時間・ハラスメント）を守るルールがほしい'], ['event', '国民的な行事やチャリティに芸能人の力を役立ててほしい'], ['honor', '長年の功績に対する顕彰がほしい']] });

// ---- 文化
GR('u_bunkazai', 'bunka', 'ドット文化財保存会', { kana: 'どっとぶんかざいほぞんかい', kind: '文化財の保存と修理の会', seg: 'elderly', lean: { econ: -0.2, social: 1, security: 0 }, inf: [20, 20, 20, 20], cap: 10, likes: ['culture_ent', 'disaster_prep'], dislikes: [], titles: ['会長', '理事'],
  asks: [['money', '文化財の修理と防災の予算がほしい'], ['protect', '景観と歴史的な町並みを開発から守ってほしい'], ['honor', '保存に尽くした人を顕彰してほしい']] });
GR('u_dento', 'bunka', 'ドット伝統芸能・工芸の会', { kana: 'どっとでんとうげいのうこうげいのかい', kind: '伝統芸能・工芸の保持者の会', seg: 'elderly', lean: { econ: -0.2, social: 0.8, security: 0 }, inf: [18, 18, 18, 18], cap: 10, likes: ['culture_ent'], dislikes: [], titles: ['会長', '理事'],
  asks: [['money', '後継者の育成と道具・材料の確保を支えてほしい'], ['honor', '保持者を顕彰して、広く知らせてほしい'], ['event', '公演と展示の機会を増やしてほしい']] });
GR('u_matsuri', 'bunka', 'ドット祭り保存連合', { kana: 'どっとまつりほぞんれんごう', kind: '各地の祭りの保存会の連合', seg: 'rural', lean: { econ: 0, social: 0.8, security: 0 }, inf: [25, 25, 25, 25], cap: 12, likes: ['culture_ent', 'local_grant'], dislikes: [], titles: ['会長', '事務局長'],
  asks: [['event', '祭りの開催と安全対策を支援してほしい'], ['safety', '担い手不足と高齢化に手立てがほしい'], ['money', '山車・みこし・衣装の修理費を支えてほしい']] });
GR('u_cool', 'bunka', 'ドット・クール推進会議', { kana: 'どっとくーるすいしんかいぎ', kind: '日本の文化・コンテンツの海外展開を進める会議', seg: 'young', lean: { econ: 0.8, social: -0.3, security: 0 }, inf: [0, 0, 15, 32], cap: 30, likes: ['culture_ent', 'tourism'], dislikes: [], titles: ['議長', '事務局長'], years: [20100618, 99999999],
  asks: [['money', '海外展開と人材育成に予算を出してほしい'], ['law', '模倣品・海賊版への対策を強めてほしい'], ['event', '国際的なイベントや展示会を開いてほしい']] });

// ---- 研究
GR('ke_daigaku', 'kenkyu', 'ドット国立大学協会', { kana: 'どっとこくりつだいがくきょうかい', kind: '国立大学の学長の協会', seg: 'urban', lean: { econ: -0.2, social: -0.3, security: -0.2 }, inf: [35, 35, 38, 34], cap: 5, cred: 70, likes: ['research', 'free_tuition', 'scholarship'], dislikes: [], titles: ['会長', '副会長'],
  asks: [['money', '運営費の交付金を増やしてほしい'], ['protect', '大学の自治と学問の自由を尊重してほしい'], ['law', '大学の仕組みの改革は、現場の声を聞いて進めてほしい']] });
GR('ke_gakujutsu', 'kenkyu', 'ドット学術評議会', { kana: 'どっとがくじゅつひょうぎかい', kind: '科学者の代表機関', seg: 'urban', lean: { econ: -0.1, social: -0.8, security: -1 }, inf: [20, 22, 24, 22], cap: 2, cred: 80, likes: ['research'], dislikes: [], titles: ['会長', '副会長'],
  asks: [['protect', '会員の選び方を学術界の自主性に任せてほしい'], ['consult', '科学的な提言を政策に反映してほしい'], ['money', '基礎研究を安定して支えてほしい']] });
GR('ke_wakate', 'kenkyu', 'ドット若手研究者の会', { kana: 'どっとわかてけんきゅうしゃのかい', kind: '大学院生・ポスドクの会', seg: 'young', lean: { econ: -0.8, social: -0.8, security: -0.2 }, inf: [6, 10, 14, 16], cap: 1, cred: 60, likes: ['research', 'scholarship'], dislikes: [], titles: ['代表', '世話人'],
  asks: [['staff', '任期のない研究職を増やしてほしい'], ['money', '生活費と研究費を直接支援してほしい'], ['safety', '研究不正とハラスメントをなくす仕組みがほしい']] });
GR('ke_sangyo', 'kenkyu', 'ドット産学連携協議会', { kana: 'どっとさんがくれんけいきょうぎかい', kind: '大学と企業の共同研究を進める協議会', seg: 'business', lean: { econ: 1, social: 0, security: 0.3 }, inf: [20, 25, 30, 32], cap: 40, cred: 55, likes: ['research', 'deregulation', 'space'], dislikes: [], titles: ['会長', '事務局長'],
  asks: [['dereg', '大学発ベンチャーと共同研究の規制を緩めてほしい'], ['money', '共同研究のための補助金・税制がほしい'], ['law', '知的財産の扱いを分かりやすい制度にしてほしい']] });

// ---- 政府（官庁・自治体）
GR('g_zaimu', 'seifu', '財政当局', { nameFn: (t) => (t >= 2001 ? '財務省（財政当局）' : '大蔵省（財政当局）'), kana: 'ざいせいとうきょく', kind: '予算と税を握る官庁', seg: 'employees', lean: { econ: 0.8, social: 0.3, security: 0.2 }, inf: [75, 68, 62, 58], cap: 0, likes: ['fiscal_consolidation', 'shohizei_up', 'civil_service_cut'], dislikes: ['stimulus', 'shohizei_down', 'pension_up'], titles: ['事務次官', '主計局長'], bureau: true,
  asks: [['protect', '歳出を抑え、財政を立て直す方針を守ってほしい'], ['law', '消費税など安定した財源の確保を進めてほしい'], ['consult', '予算編成の手順を尊重してほしい']] });
GR('g_keizai', 'seifu', '経済産業系の官庁', { nameFn: (t) => (t >= 2001 ? '経済産業省' : '通商産業省'), kana: 'けいざいさんぎょうけいのかんちょう', kind: '産業・貿易・エネルギーを担う官庁', seg: 'business', lean: { econ: 0.6, social: 0.2, security: 0.3 }, inf: [65, 58, 52, 50], cap: 0, likes: ['deregulation', 'fta', 'nuclear_promote', 'research'], dislikes: [], titles: ['事務次官', '官房長'], bureau: true,
  asks: [['money', '産業政策と成長分野への予算を確保してほしい'], ['law', 'エネルギーと貿易の基本方針を明確にしてほしい'], ['consult', '政策の検討に省の知見を生かしてほしい']] });
GR('g_naimu', 'seifu', '内政・警察系の官庁', { nameFn: (t) => (t >= 2001 ? '総務省・警察庁など' : '自治省・総務庁・警察庁など'), kana: 'ないせいけいさつけいのかんちょう', kind: '地方自治・行政管理・警察を担う官庁', seg: 'employees', lean: { econ: 0.2, social: 0.8, security: 1 }, inf: [60, 56, 50, 46], cap: 0, likes: ['police_up', 'municipal_merger', 'mynumber', 'digital_gov'], dislikes: ['decentralize'], titles: ['事務次官', '官房長'], bureau: true,
  asks: [['staff', '治安と行政の体制（人員）を整えてほしい'], ['law', '行政のデジタル化と制度づくりを進めてほしい'], ['consult', '地方との調整の役割を尊重してほしい']] });
GR('g_gaibo', 'seifu', '外務・防衛系の官庁', { nameFn: (t) => (t >= 2007 ? '外務省・防衛省' : '外務省・防衛庁'), kana: 'がいむぼうえいけいのかんちょう', kind: '外交と安全保障を担う官庁', seg: 'employees', lean: { econ: 0.3, social: 0.3, security: 1.2 }, inf: [58, 56, 54, 54], cap: 0, likes: ['security_law', 'oda', 'pko'], dislikes: ['defense_cut'], titles: ['事務次官', '官房長'], bureau: true,
  asks: [['money', '外交と防衛の体制に必要な予算を確保してほしい'], ['law', '安全保障に必要な法整備を進めてほしい'], ['consult', '外交の継続性と情報管理を尊重してほしい']] });
GR('g_shakai', 'seifu', '社会・教育系の官庁', { nameFn: (t) => (t >= 2001 ? '厚生労働省・文部科学省など' : '厚生省・労働省・文部省など'), kana: 'しゃかいきょういくけいのかんちょう', kind: '福祉・労働・教育を担う官庁', seg: 'employees', lean: { econ: -0.2, social: 0, security: 0 }, inf: [55, 52, 50, 48], cap: 0, likes: ['care_expand', 'education_reform', 'child_allowance'], dislikes: [], titles: ['事務次官', '官房長'], bureau: true,
  asks: [['money', '社会保障と教育の財源を確保してほしい'], ['staff', '現場の人手不足に手を打ってほしい'], ['consult', '制度の検討には専門の審議会の議論を尊重してほしい']] });
GR('g_chiji', 'seifu', 'ドット知事会', { kana: 'どっとちじかい', kind: '都道府県知事の会', seg: 'rural', lean: { econ: -0.2, social: 0.1, security: 0 }, inf: [45, 50, 55, 55], cap: 15, likes: ['decentralize', 'local_grant', 'disaster_prep'], dislikes: ['municipal_merger'], titles: ['会長', '副会長'],
  asks: [['money', '地方交付税と地方の財源を確保してほしい'], ['law', '国と地方の仕事の分担を見直し、権限と税源を移してほしい', { policy: 'decentralize' }], ['safety', '災害に備える防災・減災の投資を続けてほしい', { policy: 'disaster_prep' }]] });
GR('g_shicho', 'seifu', 'ドット市長会・町村会', { kana: 'どっとしちょうかいちょうそんかい', kind: '市区町村長の会', seg: 'rural', lean: { econ: -0.3, social: 0.2, security: 0 }, inf: [40, 42, 45, 45], cap: 10, likes: ['local_grant', 'public_works', 'furusato_tax'], dislikes: ['municipal_merger'], titles: ['会長', '副会長'],
  asks: [['money', '住民サービスのための財源（交付税・補助金）を確保してほしい'], ['consult', '国の制度づくりに、現場の自治体の声を入れてほしい'], ['safety', '人口減少と公共施設の老朽化への手立てがほしい']] });

export const GROUP_ORDER = Object.keys(GROUP_DEFS);
export const groupsOfDomain = (d) => GROUP_ORDER.filter((id) => GROUP_DEFS[id].domain === d);
// is the group in the world at this date?
export function groupActive(def, n) { if (!def) return false; if (!def.years) return true; return n >= def.years[0] && n < def.years[1]; }
export function groupName(g, id) {
  const def = GROUP_DEFS[id];
  if (!def) return String(id || '');
  if (def.nameFn) return def.nameFn(gdate(g).t);
  return def.name;
}

// ================================================================ state (g.state.groups; old saves get defaults)
function newGroupsState(g) {
  return {
    v: GROUPS_VERSION, era: eraOf(g), init: false, seq: 1, lastDay: 0, lastYm: 0, lastEvt: -99, lastMsg: -99, lastFeed: -99, lastCase: -99,
    groups: {}, cases: [], caseLog: [], sites: [], cands: [], siteSeq: 1, panels: [], panelSeq: 1, backing: {},
    union: { rate: 25, shunto: { year: 0, stage: 'none', dem: 0, offer: 0, settled: 0, day: 0, note: '' }, minWage: 0, minWageDay: 0, strikes: [], nStrikes: 0, lastStrike: -999, results: [] },
    bids: [], hosted: [], rd: { level: 50, integrity: 70, young: 50, nobel: 0, fraud: 0, spent: 0, last: -99, laureates: [] },
    sect: {}, seifu: { trust: 50, leaks: 0, sabotage: 0, lastLeak: -99 }, culture: { heritage: 3, damage: 0, honors: [], lastHonor: -999 }, art: { lastExhibit: -99, protests: 0, freedom: 70 },
    fiscal: { fy: 0, spent: 0, by: {}, over: 0 }, fx: { ap: 0, apDay: 0, segs: {}, don: 0, donY: 0 }, corr: 0, news: [], hist: [], flags: {}, lawSeen: {}, appliedSeg: {},
  };
}
// the state (created and repaired on demand; a state of another era is rebuilt)
export function S(g) {
  const st = g && g.state;
  if (!st) return newGroupsState(g);
  let s = st.groups;
  if (!obj(s) || (s.era && s.era !== eraOf(g))) s = st.groups = newGroupsState(g);
  if (!s._ok) {
    const b = newGroupsState(g);
    for (const k of Object.keys(b)) if (s[k] === undefined) s[k] = b[k];
    for (const k of ['groups', 'backing', 'sect', 'flags', 'lawSeen', 'appliedSeg']) if (!obj(s[k])) s[k] = b[k];
    for (const k of ['cases', 'caseLog', 'sites', 'cands', 'panels', 'bids', 'hosted', 'news', 'hist']) if (!Array.isArray(s[k])) s[k] = [];
    for (const k of ['union', 'rd', 'seifu', 'culture', 'art', 'fiscal', 'fx']) { if (!obj(s[k])) s[k] = b[k]; else for (const kk of Object.keys(b[k])) if (s[k][kk] === undefined) s[k][kk] = b[k][kk]; }
    if (!obj(s.union.shunto)) s.union.shunto = b.union.shunto;
    for (const k of ['seq', 'siteSeq', 'panelSeq']) s[k] = Math.max(1, num(s[k], 1));
    for (const id of GROUP_ORDER) repairGroup(g, GROUP_DEFS[id], s, id);
    for (const k of Object.keys(s.groups)) if (!GROUP_DEFS[k]) delete s.groups[k];
    s.cases = s.cases.filter((c) => obj(c) && c.id && CASE_KINDS[c.kind] && GROUP_DEFS[c.group]);
    s.sites = s.sites.filter((x) => obj(x) && SITE_KINDS[x.kind] && SITE_REGIONS[x.region]); s.cands = s.cands.filter((x) => obj(x) && SITE_KINDS[x.kind] && SITE_REGIONS[x.region]);
    for (const x of [...s.sites, ...s.cands]) { if (!Array.isArray(x.pend)) x.pend = []; if (!Array.isArray(x.log)) x.log = []; if (!Array.isArray(x.hist)) x.hist = []; if (!obj(x.whl)) x.whl = { stage: 'none', until: 0 }; for (const k of ['pot', 'infra', 'promo', 'culture', 'vis', 'fr', 'inc', 'sat', 'crowd', 'local', 'gov', 'env', 'debt', 'buzz', 'scandals', 'dereg', 'crowdCtl']) x[k] = num(x[k], k === 'sat' ? 60 : k === 'env' ? 80 : 0); }
    s.panels = s.panels.filter((x) => obj(x) && THEMES[x.theme] && Array.isArray(x.members) && obj(x.chair));
    s.bids = s.bids.filter((x) => obj(x) && BID_TYPES[x.type] && Array.isArray(x.log));
    if (!Array.isArray(s.union.strikes)) s.union.strikes = []; if (!Array.isArray(s.union.results)) s.union.results = [];
    if (!Array.isArray(s.rd.laureates)) s.rd.laureates = []; if (!Array.isArray(s.culture.honors)) s.culture.honors = []; if (!obj(s.fiscal.by)) s.fiscal.by = {};
    Object.defineProperty(s, '_ok', { value: true, enumerable: false, configurable: true });
  }
  if (!s.init) initGroups(g, s);
  return s;
}
function repairGroup(g, def, s, id) {
  let grp = s.groups[id];
  if (!obj(grp)) { s.groups[id] = newGroup(g, def, true); return; }
  const b = newGroup(g, def, false);
  for (const k of ['s', 'gw', 'mod', 'an', 'infMod', 'anchor', 'govAnchor', 'applied', 'met', 'owe', 'don', 'hot']) grp[k] = num(grp[k], b[k]);
  grp.id = id; grp.on = typeof grp.on === 'boolean' ? grp.on : groupActive(def, gdate(g).n);
  for (const k of ['griev', 'log']) if (!Array.isArray(grp[k])) grp[k] = [];
  grp.griev = grp.griev.filter((e) => obj(e) && e.id && Number.isFinite(Number(e.heat)));
  for (const k of ['cool', 'x']) if (!obj(grp[k])) grp[k] = {};
  if (!Array.isArray(grp.leaders) || !grp.leaders.length || !grp.leaders.every((l) => obj(l) && l.name && LEADER_PERSONAS[l.persona])) grp.leaders = b.leaders;
  if (def.cred != null && grp.x.cred == null) grp.x.cred = def.cred;
  if (def.radical && grp.x.radical == null) grp.x.radical = b.x.radical;
}
// the persistent state of one group
function newGroup(g, def, first) {
  const d = gdate(g);
  const grp = { id: def.id, on: groupActive(def, d.n), s: 0, gw: 0, mod: 0, an: first ? 8 + rnd() * 10 : 12, infMod: 0, anchor: 0, govAnchor: 0, applied: 0, leaders: [], griev: [], met: -99, cool: {}, owe: 0, don: 0, log: [], x: {}, hot: 0 };
  grp.leaders = def.titles.slice(0, 2).map((t, i) => makeLeader(def.id, i, t, 0, today(g)));
  if (def.cred != null) grp.x.cred = def.cred;
  if (def.radical) grp.x.radical = 20 + rint(0, 25);
  return grp;
}
function initGroups(g, s) {
  s.init = true;
  s.era = eraOf(g);
  const d = gdate(g);
  for (const id of GROUP_ORDER) if (!s.groups[id]) s.groups[id] = newGroup(g, GROUP_DEFS[id], true);
  const role = groupsRole(g);
  const p = polOf(g);
  for (const id of GROUP_ORDER) {
    const def = GROUP_DEFS[id], grp = s.groups[id];
    grp.on = groupActive(def, d.n);
    grp.anchor = anchorFor(g, def, 'player', p, role);
    grp.govAnchor = anchorFor(g, def, 'gov', p, role);
    grp.s = clamp(grp.anchor + (rnd() - 0.5) * 12, -70, 70);
    if (def.id === 'a_geinou' && role.ent) grp.s = clamp(grp.s + 12, -70, 70);
    if (def.radical) grp.s = clamp(grp.s - 15, -80, 20);
  }
  initTourism(g, s);
  initUnion(g, s);
  initSect(g, s);
  initRd(g, s);
  s.fiscal.fy = Math.floor(d.fy);
  s.lastYm = d.ym; s.lastDay = today(g);
  s.news.unshift({ day: today(g), text: `各界との関係が始まる（${DOMAIN_ORDER.length}分野・${GROUP_ORDER.filter((i) => s.groups[i].on).length}団体）`, kind: 'groups', domain: null });
}

// ================================================================ alignment: the group's lean against the player's side / the government
function ideoOf(party) {
  const i = party && party.ideology;
  if (!i || typeof i !== 'object') return null;
  return { econ: num(i.econ), social: num(i.social), security: num(i.security) };
}
function ideoDist(a, b) { return 0.5 * Math.abs(a.econ - b.econ) + 0.3 * Math.abs(a.social - b.social) + 0.2 * Math.abs(a.security - b.security); }
function sideParty(p, mode, role) {
  if (!p || !p.parties) return null;
  if (mode === 'gov' || (role && role.cabinet)) {
    const ids = (p.cabinet && p.cabinet.partyIds) || [];
    return p.parties[ids[0]] || null;
  }
  return role && role.party ? p.parties[role.party] || null : null;
}
function policiesInForce(p) {
  const set = new Set();
  if (!p) return set;
  for (const L of p.laws || []) if (L && L.policy) set.add(L.policy);
  const f = p.flags && p.flags.inForce;
  if (obj(f)) for (const k of Object.keys(f)) set.add(k);
  return set;
}
function anchorFor(g, def, mode, p, role) {
  let a = 0;
  const party = sideParty(p, mode, role);
  const ideo = ideoOf(party);
  if (ideo) a += clamp((1.1 - ideoDist(def.lean, ideo)) * 14, -30, 18);
  const inForce = policiesInForce(p);
  let law = 0;
  for (const pid of def.likes || []) if (inForce.has(pid)) law += 4;
  for (const pid of def.dislikes || []) if (inForce.has(pid)) law -= 4;
  a += clamp(law, -12, 12);
  // personal rapport for the entertainer / a famous player (artists, sports, culture, tourism)
  if (mode === 'player' && role) {
    const fameK = clamp(num(role.fame) / 1500, 0, 1);
    if (role.ent && ['artist', 'sports', 'bunka'].includes(def.domain)) a += 10 * fameK + (def.id === 'a_geinou' ? 8 : 0);
    else if (role.ent && ['tourism', 'kyokai'].includes(def.domain)) a += 3 * fameK;
  }
  return clamp(a, -40, 35);
}
// influence by the calendar year (interpolated), with the player's offset
export function influenceOf(g, id) {
  const def = GROUP_DEFS[id], grp = S(g).groups[id];
  if (!def || !grp) return 0;
  return clamp(lerpYears(def.inf, gdate(g).t) + num(grp.infMod), 0, 100);
}
export function supportLabel(v) {
  v = num(v);
  return v >= 60 ? '全面的に協力' : v >= 30 ? '協力的' : v >= 10 ? '好意的' : v > -10 ? '中立' : v > -30 ? '不満' : v > -60 ? '批判的' : '激しく対立';
}
export function angerLabel(v) { v = num(v); return v >= 70 ? '激怒' : v >= 45 ? 'いら立ち' : v >= 22 ? 'くすぶる' : '平穏'; }
export function supportColor(v) { v = num(v); return v >= 30 ? '#57d98a' : v >= 10 ? '#9ad06a' : v > -10 ? '#8ea4b8' : v > -30 ? '#ffcc4d' : '#ff6470'; }

// ================================================================ news, messages, notes
function news(g, text, o = {}) {
  const s = S(g);
  const day = today(g);
  s.news.unshift({ day, text, kind: o.kind || 'groups', domain: o.domain || null, id: o.id || null });
  if (s.news.length > 90) s.news.length = 90;
  const p = polOf(g);
  if (o.feed !== false && p && Array.isArray(p.news) && s.lastFeed !== day) { s.lastFeed = day; p.news.unshift({ day, text, kind: 'groups' }); if (p.news.length > 80) p.news.length = 80; }
}
function phoneMsg(g, text, from = 'ドット新聞 政治部', kind = 'news') {
  const s = S(g);
  if (today(g) - s.lastMsg < 5) return false; // sparingly: a message at most every 5 days
  s.lastMsg = today(g);
  try { if (has(g, 'message')) g.message({ from, text, kind, src: 'groups' }); } catch (e) { /* no phone */ }
  return true;
}
function note(g, text) { try { (g.morningNotes || (g.morningNotes = [])).push(text); } catch (e) { /* ignore */ } }
function glog(g, id, text) { const grp = S(g).groups[id]; if (!grp) return; grp.log.unshift({ day: today(g), text }); if (grp.log.length > 14) grp.log.length = 14; }

// ================================================================ costs (government 億円 / personal money / political funds / stamina)
export function scaleOf(g) { const p = polOf(g); const gdp = p && p.economy ? num(p.economy.gdp, 550) : 550; return clamp(gdp / 550, 0.55, 1.6); }
export const fmtOku = (v) => { v = num(v); return v >= 10000 ? `${r1(v / 10000)}兆円` : `${r0(v)}億円`; };
export function frameOf(g) { return r0(3000 * scaleOf(g)); } // 裁量的に動かせる各界向け予算の年間の枠（億円, ゲーム内の目安）
function ledgerRow(p, year) {
  const L = p.me.ledger || (p.me.ledger = {});
  if (!L[year]) L[year] = { income: 0, expense: 0, donations: 0, parties: 0, secret: 0 };
  return L[year];
}
function fundsTotal(g) { const p = polOf(g); return num(g.state.money) + (p && p.me ? num(p.me.funds) : 0); }
// null | reason
export function costBlock(g, cost) {
  if (!cost) return null;
  const st = g.state;
  if (num(cost.stamina) > 0 && num(st.stamina) < num(cost.stamina)) return `体力が足りない（体力${cost.stamina}が必要）`;
  if (num(cost.money) > 0 && num(st.money) < num(cost.money)) return `お金が足りない（${fmtMoney(cost.money)}が必要）`;
  if (num(cost.funds) > 0 && fundsTotal(g) < num(cost.funds)) return `政治資金とお金の合計が足りない（${fmtMoney(cost.funds)}が必要）`;
  return null;
}
export function costText(g, cost) {
  if (!cost) return '費用なし';
  const t = [];
  if (num(cost.gov) > 0) t.push(`予算 ${fmtOku(cost.gov)}`);
  if (num(cost.money) > 0) t.push(`自分のお金 ${fmtMoney(cost.money)}`);
  if (num(cost.funds) > 0) t.push(`政治資金 ${fmtMoney(cost.funds)}`);
  if (num(cost.stamina) > 0) t.push(`体力${cost.stamina}`);
  return t.length ? t.join('・') : '費用なし';
}
function payCost(g, cost, domain) {
  if (!cost) return;
  const st = g.state, p = polOf(g), s = S(g);
  if (num(cost.stamina) > 0) st.stamina = Math.max(0, num(st.stamina) - cost.stamina);
  if (num(cost.money) > 0) st.money = Math.max(0, num(st.money) - cost.money);
  if (num(cost.funds) > 0) {
    const f = p && p.me ? Math.min(num(p.me.funds), cost.funds) : 0;
    if (f > 0) { p.me.funds -= f; ledgerRow(p, gdate(g).year).expense += f; }
    st.money = Math.max(0, num(st.money) - (cost.funds - f));
  }
  if (num(cost.gov) > 0) govSpend(g, cost.gov, domain);
}
// government money: counted against the year's 枠; over it the 財政当局 frowns (immediate small cost)
function govSpend(g, oku, domain) {
  const s = S(g), d = gdate(g);
  const fy = Math.floor(d.fy);
  if (s.fiscal.fy !== fy) { s.fiscal.fy = fy; s.fiscal.spent = 0; s.fiscal.by = {}; s.fiscal.over = 0; }
  s.fiscal.spent += oku;
  if (domain) s.fiscal.by[domain] = num(s.fiscal.by[domain]) + oku;
  const frame = frameOf(g);
  if (s.fiscal.spent > frame) {
    const over = Math.min(oku, s.fiscal.spent - frame);
    s.fiscal.over += over;
    const z = s.groups.g_zaimu;
    if (z) z.an = clamp(z.an + over / frame * 40, 0, 100);
    const role = groupsRole(g);
    if (over > 0 && role.cabinet) moodAdd(g, -clamp(over / frame * 3, 0, 0.8), '財政の枠を超えた各界向けの支出', 'deficit');
  }
}

// ================================================================ effects on the world (feature-detected)
function moodAdd(g, d, text, reason = 'policy') {
  const p = polOf(g);
  if (!p || !p.cabinet || !d) return 0;
  const before = num(p.cabinet.mood);
  p.cabinet.mood = clamp(before + d, -20, 20);
  const got = p.cabinet.mood - before;
  if (got && has(g, 'approvalNote')) safe(() => g.approvalNote(reason === 'deficit' ? 'deficit' : 'other', r2(got), text || '各界との関係', { applied: true }));
  return got;
}
// the parties that carry the player's side (the cabinet's, or the player's own party)
function sideParties(p, role) {
  if (!p) return [];
  if (role.cabinet) return ((p.cabinet && p.cabinet.partyIds) || []).filter((id) => p.parties[id]);
  return role.party && p.parties[role.party] ? [role.party] : [];
}
function shiftSeg(g, segs, k = 0.004, role = groupsRole(g)) {
  const p = polOf(g);
  if (!p || !p.support || !p.support.mods || !segs) return;
  for (const [sgm, dv] of Object.entries(segs)) {
    if (!SEG_NAME[sgm]) continue;
    const m = p.support.mods[sgm] || (p.support.mods[sgm] = {});
    for (const id of sideParties(p, role)) m[id] = clamp(num(m[id]) + dv * k, -0.3, 0.3);
  }
}
// a persistent (refreshed) or one-off push to the economy, kept as ONE entry per key in economy.shocks
function pushShock(g, key, name, fx, len = 60) {
  const p = polOf(g);
  if (!p || !p.economy || !Array.isArray(p.economy.shocks)) return;
  const abs = absOf(g);
  let e = p.economy.shocks.find((x) => x && x.kind === 'groups' && x.key === key);
  if (!e) { e = { kind: 'groups', key, name, until: abs + len, len, growth: 0, inflation: 0, unemployment: 0, yen: 0 }; p.economy.shocks.push(e); }
  e.name = name; e.len = len; e.until = abs + len;
  for (const k of ['growth', 'inflation', 'unemployment', 'yen']) e[k] = clamp(num(fx[k]), -2, 2);
}
function dropShock(g, key) {
  const p = polOf(g);
  if (p && p.economy && Array.isArray(p.economy.shocks)) p.economy.shocks = p.economy.shocks.filter((x) => !(x && x.kind === 'groups' && x.key === key));
}
// the collusion meter 癒着の疑い (0..100): donations that come with favours
function collAdd(g, v) { const s = S(g); s.corr = clamp(num(s.corr) + v, 0, 100); }

// Apply an effect block. fx: { sup, an, inf, ap, seg:{}, standing, rep, local, fame, fans, money, funds, eco:{growth,…,len,key,name}, scandal, coll, spill }
// ctx: { id (group), role, domain, label }. Returns the lines of what changed (for the result card).
export function applyFx(g, fx, ctx = {}) {
  const lines = [];
  if (!fx) return lines;
  const s = S(g), p = polOf(g), role = ctx.role || groupsRole(g);
  const def = ctx.id ? GROUP_DEFS[ctx.id] : null;
  const grp = ctx.id ? s.groups[ctx.id] : null;
  const name = def ? groupName(g, def.id) : '各界';
  if (grp) {
    if (fx.sup) {
      const before = grp.s;
      grp.gw = clamp(num(grp.gw) + fx.sup, -80, 80);
      grp.s = clamp(grp.s + fx.sup * 0.5, -100, 100);
      lines.push(`${name}の支持 ${r0(before)}→${r0(grp.s)}（長期で${fx1(fx.sup)}）`);
      if (fx.spill !== false) spill(g, s, def, fx.sup);
    }
    if (fx.an) {
      grp.an = clamp(num(grp.an) + fx.an, 0, 100); lines.push(`${name}の不満 ${fx1(fx.an)}`);
      if (fx.an < 0) for (const e of grp.griev) e.heat *= clamp(1 + fx.an / 50, 0.3, 1); // relief takes the heat out of old grievances too
    }
    if (fx.inf) { grp.infMod = clamp(num(grp.infMod) + fx.inf, -30, 30); lines.push(`${name}の影響力 ${fx1(fx.inf)}`); }
    if (fx.griev) addGriev(grp, fx.griev[0], fx.griev[1], fx.griev[2] || 25);
    if (fx.cred != null && grp.x.cred != null) { grp.x.cred = clamp(num(grp.x.cred) + fx.cred, 0, 100); lines.push(`${name}の信頼性 ${fx1(fx.cred)}`); }
  }
  if (fx.ap && p && p.cabinet) {
    if (role.cabinet) { const got = moodAdd(g, fx.ap * (role.pm ? 1 : 0.45), `${name}との関係`); if (Math.abs(got) >= 0.05) lines.push(`内閣支持率 ${fx1(got)}`); }
    else if (p.me) {
      if (role.kind === 'local') { p.me.localSupport = clamp(num(p.me.localSupport) + fx.ap * 2, 0, 100); lines.push(`地元の支持 ${fx1(fx.ap * 2)}`); }
      else if (role.member) { p.me.standing = clamp(num(p.me.standing) + fx.ap * 1.5, 0, 100); lines.push(`党内の評価 ${fx1(fx.ap * 1.5)}`); }
    }
  }
  if (fx.seg) { shiftSeg(g, fx.seg, 0.004, role); const top = Object.entries(fx.seg).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).filter((x) => Math.abs(x[1]) >= 0.2); if (top.length && sideParties(p, role).length) lines.push(`${top.map(([k, v]) => `${SEG_NAME[k] || k}${v > 0 ? '↑' : '↓'}`).join('・')}の支持`); }
  if (p && p.me) {
    if (fx.standing) { p.me.standing = clamp(num(p.me.standing) + fx.standing, 0, 100); lines.push(`党内の評価 ${fx1(fx.standing)}`); }
    if (fx.rep) { p.me.reputation = clamp(num(p.me.reputation) + fx.rep, -100, 100); lines.push(`評判 ${fx1(fx.rep)}`); }
    if (fx.local) { p.me.localSupport = clamp(num(p.me.localSupport) + fx.local, 0, 100); lines.push(`地元の支持 ${fx1(fx.local)}`); }
    if (fx.funds) {
      if (fx.funds > 0) { p.me.funds = num(p.me.funds) + fx.funds; const L = ledgerRow(p, gdate(g).year); L.income += fx.funds; L.donations += fx.funds; s.fx.don += fx.funds; lines.push(`政治資金 +${fmtMoney(fx.funds)}（収支報告書に記載）`); }
    }
  }
  if (fx.fame && has(g, 'addFame')) { g.addFame(fx.fame); lines.push(`知名度 ${fx1(fx.fame)}`); }
  if (fx.fans && g.state) { g.state.fans = Math.max(0, num(g.state.fans) + Math.round(fx.fans)); lines.push(`ファン ${fx1(fx.fans)}`); }
  if (fx.money) { if (has(g, 'addMoney')) g.addMoney(fx.money, true); else g.state.money = Math.max(0, num(g.state.money) + fx.money); lines.push(`お金 ${fx.money > 0 ? '+' : '−'}${fmtMoney(Math.abs(fx.money))}`); }
  if (fx.eco) { pushShock(g, fx.eco.key || `once:${ctx.id || ctx.domain || 'x'}:${s.seq++}`, fx.eco.name || '各界の動き', fx.eco, fx.eco.len || 45); lines.push(`景気への影響 ${fx.eco.growth ? `成長${fx1(fx.eco.growth)}` : ''}${fx.eco.inflation ? ` 物価${fx1(fx.eco.inflation)}` : ''}${fx.eco.unemployment ? ` 失業${fx1(fx.eco.unemployment)}` : ''}`.trim()); }
  if (fx.coll) collAdd(g, fx.coll);
  if (fx.scandal) scandalHit(g, fx.scandal, fx.scandalText || `${name}との関係`, role);
  if (fx.news) news(g, fx.news, { domain: ctx.domain || (def && def.domain) || null });
  return lines;
}
// related groups feel it too: a favour to one side irritates its opposite (by lean), and pleases its allies a little
function spill(g, s, def, sup) {
  if (!def || Math.abs(sup) < 3) return;
  const out = [];
  for (const id of GROUP_ORDER) {
    if (id === def.id) continue;
    const o = GROUP_DEFS[id], grp = s.groups[id];
    if (!grp || !grp.on || o.domain === 'seifu' || influenceOf(g, id) < 15) continue;
    const dot = (def.lean.econ * o.lean.econ * 0.5 + def.lean.social * o.lean.social * 0.3 + def.lean.security * o.lean.security * 0.2) / 4;
    if (Math.abs(dot) < 0.08) continue;
    out.push([id, dot]);
  }
  out.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [id, dot] of out.slice(0, 5)) s.groups[id].gw = clamp(num(s.groups[id].gw) + 0.8 * sup * dot, -80, 80);
}
function addGriev(grp, id, text, heat = 25) {
  const e = grp.griev.find((x) => x.id === id);
  if (e) { e.heat = clamp(Math.max(num(e.heat), heat), 0, 100); e.text = text; return; }
  grp.griev.unshift({ id, text, heat, day: 0 });
  if (grp.griev.length > 5) grp.griev.length = 5;
}
// a scandal about the player's side (light: the cabinet's scandal term for PM / ministers, reputation for the others)
function scandalHit(g, sev, text, role = groupsRole(g)) {
  const p = polOf(g);
  if (!p) return;
  const sv = clamp(num(sev), 0.2, 6);
  if (role.cabinet && p.cabinet) { p.cabinet.scandal = num(p.cabinet.scandal) - sv * (role.pm ? 1.4 : 0.8); if (has(g, 'approvalNote')) safe(() => g.approvalNote('scandal', -r2(sv * (role.pm ? 1.4 : 0.8)), text, { applied: true })); }
  if (p.me) { p.me.reputation = clamp(num(p.me.reputation) - sv * 2, -100, 100); p.me.standing = clamp(num(p.me.standing) - sv * 1.2, 0, 100); }
  if (role.ent && !role.cabinet) { if (has(g, 'addFame')) g.addFame(-Math.round(sv * 4)); }
}

// ================================================================ actions on a group
// An action: { id, name, desc, domains?, kind: 'soft'|'gov'|'dark'|'pol'|'self', who(ctx) → null | why, options(ctx) → [{ key, label, tier?, desc? }],
//   cost(ctx) → { gov, money, funds, stamina }, cd (days), odds(ctx) → 0..1 | null, win(ctx) / lose(ctx) → fx blocks, lines(ctx) → [text],
//   voices(ctx) → { pro[], con[] }, run?(g, ctx, success) → extra text (after the generic effects) }
export const ACTIONS = {};
export const ACTION_ORDER = [];
function AD(id, def) { ACTIONS[id] = { id, cd: 0, kind: 'soft', ...def }; ACTION_ORDER.push(id); }

const MINISTER_NAMES = (t) => ({
  tourism: t >= 2001 ? '国土交通大臣' : '運輸大臣', kyokai: '農林水産・厚生労働・経済産業などの大臣', rengo: t >= 2001 ? '厚生労働大臣' : '労働大臣', sports: t >= 2001 ? '文部科学大臣' : '文部大臣',
  business: t >= 2001 ? '経済産業大臣' : '通商産業大臣', sect: '法務大臣・国家公安委員長', yushikisha: '内閣官房長官', artist: t >= 2001 ? '文部科学大臣' : '文部大臣', bunka: t >= 2001 ? '文部科学大臣' : '文部大臣', kenkyu: t >= 2001 ? '文部科学大臣' : '文部大臣（科学技術庁長官）', seifu: '内閣官房長官・総務大臣',
});
export const ministerOf = (g, domain) => MINISTER_NAMES(gdate(g).t)[domain] || '担当の大臣';
// what the player may do in a domain: 'full' | 'part' | null (see domainControl)
function ctrlOf(ctx) { return domainControl(ctx.role, ctx.def.domain); }
const whyGov = (ctx) => `${DOMAINS[ctx.def.domain].name}の予算や規制を動かせるのは、総理か担当の大臣（${ministerOf(ctx.g, ctx.def.domain)}）`;
const needGov = (ctx) => { const c = ctrlOf(ctx); if (c === 'full') return null; if (c === 'part' && ctx.role.kind === 'local' && ctx.local) return null; return whyGov(ctx); };
const needPol = (ctx) => (ctx.role.kind === 'citizen' ? '政治家（議員・首長・大臣）の立場の人だけができる' : null);
const regime = (g) => (has(g, 'regime') ? safe(() => g.regime(), null) : null);
const isDemocracy = (g) => { const r = regime(g); return !r || r.id === 'democracy'; };
const govRealParty = (g) => has(g, 'govIncludesRealParty') && !!safe(() => g.govIncludesRealParty(), false);
const relQ = (grp) => clamp((num(grp.s) - num(grp.an) * 0.5) / 100, -1, 1);
const persona = (grp, key) => { const l = grp.leaders && grp.leaders[0]; const P = l && LEADER_PERSONAS[l.persona]; return P ? num(P[key]) : 0; };
const tierOf = (opt) => (opt && opt.tier != null ? opt.tier : 1);
const TIER_NAMES = ['小さく', 'ふつうに', '大きく'];
// the preferred direction of a group's regulation: loose (規制緩和), tight (規制・保護) or mixed
export function regPref(def) { const a = (def.asks || []).map((x) => x[0]); const l = a.includes('dereg'), t = a.includes('protect'); return l && !t ? 'loose' : t && !l ? 'tight' : 0; }

AD('meet', {
  name: '会談する', short: '会談', desc: '代表と会って話を聞く。顔の見える関係が、いちばんの土台になる。',
  who: (c) => { const r = c.role; if (r.kind === 'citizen' && !r.ent) return '面会の取りつぎをしてくれる人がいない（知名度か役職が必要）'; if (r.kind === 'citizen' && r.fame < 80) return '知名度が足りず、会ってもらえない（知名度★80以上）'; return null; },
  cost: (c) => ({ stamina: c.role.pm ? 6 : 8 }), cd: 3,
  odds: (c) => clamp(0.62 + 0.25 * relQ(c.grp) + persona(c.grp, 'conc') + 0.1 * c.role.weight + (c.role.kind === 'citizen' ? -0.08 : 0), 0.15, 0.95),
  win: (c) => ({ sup: 4 + 3 * c.role.weight, an: -8, ap: 0.05 }), lose: () => ({ sup: -1, an: 2 }),
  lines: (c) => [`${c.grp.leaders[0].title}の${c.grp.leaders[0].name}（${LEADER_PERSONAS[c.grp.leaders[0].persona].name}）と会って、意見を聞く`, '会談のあと、要望が出されることがある'],
  voices: () => ({ pro: ['「直接顔を合わせて話せたのは、ありがたい」（団体の幹部）', '「まず話を聞く姿勢が大事だ」（有識者）'], con: ['「会うだけで何も決まらないのでは」（記者）', '「特定の団体とばかり会っている」（野党）'] }),
  run: (g, c, ok) => { c.grp.met = today(g); if (ok && roll(0.45)) { const cs = makeDemand(g, c.id, { reason: 'meet' }); if (cs) return `話の中で、要望が出された：「${cs.title}」（案件に追加）`; } return ''; },
});
AD('subsidy', {
  name: '補助金・予算をつける', short: '補助', kind: 'gov', desc: '団体や業界に予算を出して、活動を支える。財源は税金。年間の枠を超えると財政当局が渋い顔をする。',
  who: (c) => needGov({ ...c, local: true }),
  options: () => TIER_NAMES.map((l, i) => ({ key: `t${i}`, tier: i, label: `${l}（${[20, 100, 500][i]}億円クラス）` })),
  cost: (c) => ({ gov: r0([20, 100, 500][tierOf(c.opt)] * scaleOf(c.g) * (c.role.kind === 'local' ? 0.12 : 1)), stamina: 4 }), cd: 8,
  odds: (c) => clamp(0.82 + persona(c.grp, 'conc') - 0.2 * (num(c.grp.an) / 100), 0.4, 0.97),
  win: (c) => { const t = tierOf(c.opt); return { sup: [6, 12, 20][t] * (1 + persona(c.grp, 'conc') * 1.5), an: -[8, 16, 28][t], inf: [0, 1, 3][t], ap: 0.05 - 0.1 * t, seg: { [c.def.seg]: [0.3, 0.6, 1][t] }, coll: [0.5, 1.5, 3.5][t] * (num(c.grp.don) > 0 ? 1.5 : 1) }; },
  lose: (c) => ({ sup: 2, an: -2 }),
  lines: (c) => [`${c.def.name}の活動を支える予算を付ける（${costText(c.g, c.cost)}）`, '成功しても「見返りの癒着」と見られると、疑いのメーターが上がる'],
  voices: (c) => ({ pro: [`「${DOMAINS[c.def.domain].name}の現場を支える、必要な予算だ」（関係者）`, '「地域の雇用と暮らしが守られる」（自治体）'], con: ['「特定の業界への優遇ではないか」（納税者団体）', '「財源はどこから出すのか。借金が増える」（財政に厳しい声）'] }),
});
AD('regulate', {
  name: '規制を見直す', short: '規制', kind: 'gov', desc: '許可・基準・ルールを緩める（規制緩和）か、強める（規制強化）。得をする団体と困る団体が分かれる。',
  who: (c) => needGov(c),
  options: () => [{ key: 'loose', label: '規制緩和（ルールをゆるめる）' }, { key: 'tight', label: '規制強化（ルールを強める）' }],
  cost: () => ({ stamina: 10 }), cd: 12,
  odds: (c) => { const bk = backingFor(c.g, c.def.domain); const opp = oppositionPower(c.g, c.def, c.opt && c.opt.key); return clamp(0.78 - 0.4 * opp + 0.15 * relQ(c.grp) + 0.18 * bk, 0.08, 0.92); },
  win: (c) => { const loose = c.opt && c.opt.key === 'loose'; const pf = regPref(c.def); const pleased = pf === 0 ? 2 : (pf === 'loose') === loose ? 10 : -6; return { sup: pleased, an: pleased > 0 ? -8 : 6, ap: loose ? 0.1 : 0.05, seg: loose ? { business: 0.5, unions: -0.4, [c.def.seg]: pleased > 0 ? 0.4 : -0.3 } : { business: -0.4, unions: 0.3, [c.def.seg]: pleased > 0 ? 0.4 : -0.3 }, eco: { key: `reg:${c.def.domain}`, name: loose ? '規制緩和の効果' : '規制強化の影響', growth: loose ? 0.04 : -0.025, len: 60 }, coll: 0.5 }; },
  lose: (c) => ({ sup: -2, an: 6, ap: -0.25 }),
  lines: (c) => [c.opt && c.opt.key === 'loose' ? '許認可・基準をゆるめて、事業をしやすくする' : '基準や許可を強めて、安全や公正を守る', `この分野の団体が望む向き：${{ loose: '規制緩和', tight: '規制・保護', 0: 'どちらともいえない' }[regPref(c.def)]}`],
  voices: (c) => (c.opt && c.opt.key === 'tight' ? { pro: ['「安全と公正を守るために必要なルールだ」（消費者団体）', '「弱い立場の人を守れる」（労働組合）'], con: ['「新しい挑戦の芽をつぶす」（経済界）', '「手続きが増えて、現場の負担が重い」（業界）'] } : { pro: ['「新しい事業が生まれ、価格も下がる」（経済界）', '「古い規制が成長を妨げてきた」（有識者）'], con: ['「安全や働く人の守りが弱くなる」（労働組合）', '「既存の業者が苦しくなる」（業界団体）'] }),
});
AD('pressure', {
  name: '圧力をかける', short: '圧力', kind: 'dark', desc: '許認可や補助、税務、報道などをちらつかせて、団体の動きを抑える。うまくいけば静かになるが、失敗や露見のしっぺ返しは大きい。',
  who: (c) => needGov(c),
  options: () => [{ key: 'ask', label: '自粛を「お願い」する（穏やか）' }, { key: 'permit', label: '許認可・補助の見直しをちらつかせる' }, { key: 'leak', label: '不祥事の情報をマスコミに流す（強引）' }],
  cost: (c) => ({ stamina: 8 }), cd: 15,
  odds: (c) => { const k = { ask: 0.62, permit: 0.52, leak: 0.46 }[(c.opt && c.opt.key) || 'ask']; const dem = isDemocracy(c.g) ? 0 : 0.22; return clamp(k + dem - 0.4 * (influenceOf(c.g, c.id) / 100) + persona(c.grp, 'press') - 0.12 * (num(c.grp.an) / 100), 0.06, 0.92); },
  win: (c) => { const k = (c.opt && c.opt.key) || 'ask'; const m = { ask: 1, permit: 1.7, leak: 2.4 }[k]; return { sup: -3 * m, an: 4 * m, inf: -2.5 * m, ap: -0.1 * m, griev: ['pressure', '政府の圧力に不満がたまっている', 14 * m], silent: 40 * m }; },
  lose: (c) => { const k = (c.opt && c.opt.key) || 'ask'; const m = { ask: 1, permit: 1.7, leak: 2.4 }[k]; const mm = isDemocracy(c.g) ? 1 : 0.4; return { sup: -9 * m, an: 18 * m, inf: 1, ap: -0.5 * m * mm, scandal: roll(0.4 * m * mm) ? 1.2 * m : 0, scandalText: '団体への圧力が報じられた', griev: ['pressure', '政府の圧力に強く反発している', 30 * m], solidarity: 3 * m }; },
  lines: (c) => ['成功すると、その団体は当面おとなしくなる（影響力が下がる）', '失敗すると団体が反発し、「圧力疑惑」が報じられやすい', isDemocracy(c.g) ? '民主主義の体制では、報道・国会・世論の反発が強い' : 'いまの体制では歯止めが弱く、成功しやすい（反発は水面下にたまる）'],
  voices: () => ({ pro: ['「過激な動きは抑えるべきだ」（政権支持層）', '「公共の秩序を守るためのやむを得ない措置」（与党議員）'], con: ['「表現・結社の自由への圧力だ」（弁護士会・有識者）', '「権力の乱用だ。説明責任を果たせ」（野党）'] }),
});
AD('coopt', {
  name: '懐柔する（ポスト・顕彰）', short: '懐柔', kind: 'dark', desc: '審議会のポスト、叙勲・顕彰、官邸への出入りなどを与えて取り込む。支持は得やすいが、「御用団体」と見られて信頼を失う。',
  who: (c) => { if (c.role.kind === 'citizen') return '与えるポストや顕彰を持っているのは、政治家の立場の人'; return c.role.kind === 'member' ? '審議会のポストなどを動かせるのは、総理か大臣（議員は推薦まで）' : null; },
  options: () => [{ key: 'post', label: '審議会・委員のポストを与える' }, { key: 'honor', label: '叙勲・顕彰に推薦する' }, { key: 'access', label: '官邸・省庁への出入りを認める（人脈）' }],
  cost: () => ({ stamina: 6, gov: 3 }), cd: 20,
  odds: (c) => clamp(0.66 + persona(c.grp, 'conc') * 1.2 + persona(c.grp, 'bribe') * 0.8 - 0.15 * (c.grp.x.cred != null ? 0.5 : 0), 0.2, 0.92),
  win: (c) => ({ sup: 9, an: -10, inf: -1, ap: 0, cred: c.grp.x.cred != null ? -7 : 0, coll: 1.8, coop: 1 }),
  lose: () => ({ sup: -2, an: 5 }),
  lines: () => ['取り込まれた団体は政権に好意的になる', '何度も重ねると「御用団体」と見られ、団体の信頼性と影響力が下がる', 'そのぶん「癒着の疑い」のメーターが上がる'],
  voices: () => ({ pro: ['「政策づくりに現場の声が入るのはよいこと」（団体幹部）', '「顕彰は長年の功績への敬意だ」（支持者）'], con: ['「身内を固めて批判を封じる『御用化』だ」（野党）', '「ポストと引き換えの取り込みではないか」（記者）'] }),
});
AD('bribe', {
  name: '買収する（金品・便宜）', short: '買収', kind: 'dark', desc: '代表にお金や便宜を渡して、味方につける。受け取るかどうかは相手しだい。違法で、露見すれば捜査・失脚につながる。',
  who: (c) => (c.role.kind === 'citizen' && !c.role.ent ? 'まとまったお金を動かせる立場が必要' : null),
  options: () => [{ key: 'b1', tier: 0, label: '「ご挨拶」程度（100万円）' }, { key: 'b2', tier: 1, label: 'まとまった額（500万円）' }, { key: 'b3', tier: 2, label: '大金と便宜（2,000万円）' }],
  cost: (c) => ({ funds: [1000000, 5000000, 20000000][tierOf(c.opt)], stamina: 6 }), cd: 25,
  odds: (c) => clamp(0.4 + persona(c.grp, 'bribe') + 0.2 * (num(c.grp.cap) / 100) + 0.12 * tierOf(c.opt) - 0.15 * (c.def.cred ? c.grp.x.cred / 100 : 0) - 0.25 * (c.def.domain === 'seifu' ? 1 : 0) - 0.15 * (num(c.grp.s) > 40 ? 1 : 0), 0.04, 0.88),
  win: (c) => { const t = tierOf(c.opt); return { sup: [14, 22, 32][t], an: -[12, 20, 30][t], ap: 0.1, coll: [4, 8, 14][t], bribed: true, cred: c.grp.x.cred != null ? -[5, 9, 14][t] : 0 }; },
  lose: (c) => { const t = tierOf(c.opt); return { sup: -[14, 20, 28][t], an: [20, 28, 36][t], scandal: roll(0.55 + 0.1 * t) ? 2.5 + t : 0, scandalText: '団体の代表への金品の提供が表に出た', griev: ['bribe', '金品を示されたことに怒っている', 40] }; },
  lines: (c) => { const id = bribeCrime(c.g, c.def); const o = id && has(c.g, 'crimeOdds') ? safe(() => c.g.crimeOdds(id, { amount: c.cost.funds }), null) : null; return [`相手が受け取る見込み：${Math.round(ACTIONS.bribe.odds(c) * 100)}%`, o && o.pct ? `${CRIME_NAME[id]}の罪に問われる見込み：発覚しない${o.pct.success}%・その場で${o.pct.now}%・あとで${o.pct.later}%` : '発覚のリスクがある（捜査・失脚）', '受け取られなければ、相手が公表することもある']; },
  voices: () => ({ pro: ['「政治は綺麗事では回らない」（一部の関係者）'], con: ['「贈賄・買収は犯罪。民主主義への裏切りだ」（弁護士・有識者）', '「発覚すれば政治生命は終わる」（与党幹部）'] }),
});
const CRIME_NAME = { bribery_give: '贈賄', vote_buying: '買収（選挙）', slush_fund: '政治資金規正法違反' };
function bribeCrime(g, def) {
  if (!has(g, 'commitCrime')) return null;
  if (['seifu', 'yushikisha'].includes(def.domain)) return 'bribery_give';
  const p = polOf(g);
  const near = p && (p.elections && p.elections.upcoming || []).some((e) => e && !e.newsOnly && e.day - today(g) <= 60 && e.day >= today(g));
  return near ? 'vote_buying' : 'slush_fund';
}
AD('crackdown', {
  name: '弾圧する（禁止・摘発）', short: '弾圧', kind: 'dark', desc: '捜査・摘発・活動の禁止で、団体の力をそぐ。民主主義の体制では裁判所・国会・世論が強く反発し、失敗しやすい。非常時・独裁では歯止めが弱い。',
  who: (c) => (c.role.pm ? null : c.role.kind === 'minister' && (ctrlOf(c) === 'full') ? null : `弾圧を命じられるのは、総理か担当の大臣（${ministerOf(c.g, c.def.domain)}）`),
  options: (c) => [{ key: 'probe', label: '捜査・立入検査・税務調査で締めつける' }, { key: 'ban', label: '活動を禁止し、団体を解散させる' }, ...(isDemocracy(c.g) ? [] : [{ key: 'detain', label: '幹部を拘束し、運動を壊滅させる' }])],
  cost: () => ({ stamina: 12 }), cd: 30,
  odds: (c) => { const k = (c.opt && c.opt.key) || 'probe'; const dem = isDemocracy(c.g); const bad = c.def.radical || (c.grp.x.radical || 0) > 50 ? 0.2 : 0; const base = { probe: dem ? 0.5 : 0.8, ban: dem ? 0.12 : 0.7, detain: 0.78 }[k]; return clamp(base + bad - 0.25 * (influenceOf(c.g, c.id) / 100) + persona(c.grp, 'press'), 0.03, 0.93); },
  win: (c) => { const k = (c.opt && c.opt.key) || 'probe'; const dem = isDemocracy(c.g); const m = { probe: 1, ban: 2.2, detain: 3 }[k]; return { sup: -12 * m, an: 10 * m, inf: -8 * m, ap: dem ? -0.9 * m : -0.25 * m, standing: govRealParty(c.g) ? -6 : 0, griev: ['crack', '弾圧で運動が地下に潜った', 40], silent: 90 * m, banned: k !== 'probe' ? 100 * m : 0, chill: 6 * m, demo: dem || k === 'detain' }; },
  lose: (c) => { const k = (c.opt && c.opt.key) || 'probe'; const dem = isDemocracy(c.g); const m = { probe: 1, ban: 2.2, detain: 3 }[k]; return { sup: -8 * m, an: 16 * m, inf: 3 * m, ap: dem ? -1.4 * m : -0.4 * m, standing: govRealParty(c.g) ? -8 : -1, scandal: dem ? 1.5 * m : 0, scandalText: '団体への弾圧が違法と指摘された', chill: 4 * m, demo: true }; },
  lines: (c) => [isDemocracy(c.g) ? '民主主義の体制：憲法21条（結社・表現の自由）や裁判所の判断が壁になる' : `いまの体制：${regime(c.g) ? regime(c.g).name : ''}。法の歯止めは弱いが、国民の不満と国際社会の目が残る`, '成功すると団体の影響力は大きく下がる。同じ分野の他の団体も萎縮する', govRealParty(c.g) ? '与党の実在の政党の内部から、強い反発が出る（党内の評価が下がる）' : '失敗するとデモ・批判・世論の反発が大きい'],
  voices: () => ({ pro: ['「違法な活動や過激化は取り締まるべきだ」（治安を重視する声）', '「秩序を乱す集団には毅然と対応を」（支持者）'], con: ['「結社・表現の自由を奪う行為。独裁への一歩だ」（弁護士会）', '「地下に潜り、かえって過激になる」（研究者）'] }),
});
AD('donate', {
  name: '寄付・支援する', short: '寄付', kind: 'self', desc: '自分のお金で団体の活動を支える。応援の気持ちは伝わる。',
  who: () => null,
  options: () => [{ key: 'd0', tier: 0, label: '少額（3万円）' }, { key: 'd1', tier: 1, label: 'ふつう（20万円）' }, { key: 'd2', tier: 2, label: '大口（100万円）' }],
  cost: (c) => ({ money: [30000, 200000, 1000000][tierOf(c.opt)] }), cd: 6,
  odds: (c) => (c.def.radical ? 0.55 : 0.96),
  win: (c) => { const t = tierOf(c.opt); return { sup: [3, 8, 15][t], an: -[3, 7, 12][t], fame: c.role.ent ? [1, 3, 8][t] : 0, rep: c.def.radical ? -2 : 0.5, coll: c.role.kind === 'citizen' ? 0 : [0.2, 0.6, 1.2][t], scandal: c.def.radical && roll(0.25) ? 2 : 0, scandalText: '急進的な団体への寄付が報じられた' }; },
  lose: () => ({ sup: 0 }),
  lines: (c) => [c.def.radical ? '急進的な団体への寄付は、報じられると大きな批判を受ける' : '寄付は政治資金ではなく、あなた個人の支援として受け取られる'],
  voices: () => ({ pro: ['「活動を続けるうえで大きな助けになる」（団体）'], con: ['「寄付の見返りを求めているのでは」（記者）'] }),
});
AD('ask_donation', {
  name: '献金・協力をお願いする', short: '献金', kind: 'pol', desc: '政治資金の献金（政党支部・資金管理団体への寄附・パーティー券）をお願いする。収支報告書に載る正規のお金。見返りを期待されやすい。',
  who: (c) => needPol(c) || (c.def.cap < 8 ? 'この団体には、献金できるだけの力がない' : null) || (c.def.domain === 'seifu' ? '官庁・自治体は献金をしない' : null),
  cost: () => ({ stamina: 6 }), cd: 20,
  odds: (c) => clamp(0.12 + (num(c.grp.s) / 100) * 0.7 + (num(c.def.cap) / 100) * 0.2 - (num(c.grp.an) / 100) * 0.3, 0.03, 0.9),
  win: (c) => { const amt = donationAmount(c.g, c.grp, c.def, c.role); return { sup: 1, funds: amt, coll: 0.8 + amt / 1500000, owe: 1 }; },
  lose: () => ({ sup: -2, an: 3 }),
  lines: (c) => [`見込み額：${fmtMoney(donationAmount(c.g, c.grp, c.def, c.role))}ほど（団体の力と支持しだい）`, gdate(c.g).n >= 20000101 ? '2000年以降、企業・団体の献金は政党・政党支部あてに限られる（個人あてはパーティー券など）' : '資金管理団体などへの団体献金（上限あり）として収支報告書に載る'],
  voices: () => ({ pro: ['「政治活動には資金が必要。公開されているなら正当だ」（支持者）'], con: ['「企業・団体献金は政策をゆがめる」（市民団体）', '「献金への見返りを求められる」（有識者）'] }),
});
AD('endorse', {
  name: '推薦・応援を頼む（組織票）', short: '推薦', kind: 'pol', desc: '団体の推薦や応援を頼む。選挙で組織票が動き、団体の支持層で得票が増える。実在の政党の所属者は、政党側の取り決めに従う。',
  who: (c) => needPol(c),
  cost: () => ({ stamina: 6 }), cd: 30,
  odds: (c) => clamp(0.15 + (num(c.grp.s) / 100) * 0.65 - (num(c.grp.an) / 100) * 0.25 + (num(influenceOf(c.g, c.id)) / 100) * 0.1, 0.03, 0.9),
  win: (c) => ({ sup: 2, local: 2 + influenceOf(c.g, c.id) / 25, seg: { [c.def.seg]: 0.8 }, standing: 1, scandal: c.def.radical && roll(0.35) ? 3 : 0, scandalText: '過激な団体との関係が報じられた', campaign: 1 + Math.round(influenceOf(c.g, c.id) / 20) }),
  lose: () => ({ sup: -2, an: 3 }),
  lines: (c) => [c.def.radical ? '急進的な団体の推薦は、露見すると「過激派との関係」で大きな批判を受ける' : `団体の影響力（${r0(influenceOf(c.g, c.id))}）に応じて、選挙の得票・地元の支持が増える`, '選挙運動中の候補者なら、運動の得点にもなる'],
  voices: () => ({ pro: ['「業界の声を政治に届けてくれる人だ」（団体）'], con: ['「組織票の見返りに政策をゆがめるのでは」（無党派層）'] }),
});
AD('appear', {
  name: '応援に出る（大使・出演）', short: '応援', kind: 'self', desc: '芸能人として、団体の行事や宣伝に出て盛り上げる（観光大使・応援団長・文化大使など）。知名度とファンが増え、団体の支持も上がる。',
  who: (c) => (!c.role.ent ? '芸能の仕事をしている人だけができる応援' : ['tourism', 'sports', 'bunka', 'artist', 'kenkyu', 'kyokai'].includes(c.def.domain) ? null : 'この分野では「応援に出る」仕事はない'),
  cost: () => ({ stamina: 12 }), cd: 12,
  odds: () => 0.92,
  win: (c) => ({ sup: 7, an: -4, fame: Math.max(2, Math.round(c.role.fame * 0.012)), fans: Math.round(c.role.fame * 0.05) + 2, money: Math.round(20000 * (1 + c.role.fame / 800)), rep: 0.5 }),
  lose: () => ({ sup: 1 }),
  lines: (c) => [{ tourism: '観光大使として各地を回り、観光地を宣伝する', sports: '応援団長として大会を盛り上げる', bunka: '文化大使として行事に出る', artist: 'チャリティ・合同公演に出る', kenkyu: '科学イベントのアンバサダーになる', kyokai: '団体のキャンペーンのポスターに出る' }[c.def.domain] || '応援に出る', '出演料は少なめ。そのぶん好感度（知名度・ファン）が増える'],
  voices: () => ({ pro: ['「あの人が来てくれて、会場が沸いた」（来場者）'], con: ['「団体の宣伝に利用されているのでは」（ファンの一部）'] }),
});
function donationAmount(g, grp, def, role) {
  const K = 1500000;
  const roleK = role.pm ? 1.6 : role.kind === 'minister' ? 1.1 : role.kind === 'local' ? 0.6 : 0.7;
  return Math.max(50000, Math.round((num(def.cap) / 100) * clamp(0.3 + num(grp.s) / 100, 0.2, 1.3) * K * roleK / 10000) * 10000);
}

// ---- domain-specific actions (compact specs)
function simple(id, spec) { AD(id, { kind: 'gov', ...spec }); }
simple('tour_campaign', { name: '全国観光キャンペーン', short: '観光CP', domains: ['tourism'], desc: '観光地を全国・海外に売り込むキャンペーンを国と地域で行う。指定した観光地の宣伝力が上がる。',
  who: (c) => needGov({ ...c, local: true }), cost: (c) => ({ gov: r0(60 * scaleOf(c.g) * (c.role.kind === 'local' ? 0.15 : 1)), stamina: 8 }), cd: 20,
  odds: () => 0.88, win: (c) => ({ sup: 7, an: -6, ap: 0.15, seg: { selfemployed: 0.4, rural: 0.4 }, promo: 10, eco: { key: 'tour_cp', name: '観光キャンペーン', growth: 0.04, len: 50 } }), lose: () => ({ sup: 1 }),
  lines: (c) => [`${tourismBrand(c.g)}の宣伝で、指定した観光地の宣伝力が一時的に上がる`, '訪日客・国内客の増加を見込む（混雑にも注意）'],
  voices: () => ({ pro: ['「観光は地方を支える成長産業だ」（観光協会）'], con: ['「宣伝より、住民のくらしの対策が先だ」（住民団体）'] }) });
simple('wage_request', { name: '賃上げを要請する', short: '賃上げ', domains: ['rengo', 'business'], desc: '経営側に賃上げを要請する（政労使会議など）。今年の春闘の結果を押し上げるが、経営側は不満を持つ。',
  who: (c) => (c.role.pm || c.role.kind === 'minister' ? null : '賃上げの要請ができるのは、総理か大臣'), cost: () => ({ stamina: 10 }), cd: 40,
  odds: (c) => { const b = groupById(c.g, 'b_keizai'); return clamp(0.66 + 0.2 * relQ(c.grp) - 0.25 * (b ? num(b.an) / 100 : 0) + 0.1 * (c.role.pm ? 1 : 0), 0.15, 0.9); },
  win: (c) => ({ sup: c.def.domain === 'rengo' ? 6 : -4, an: c.def.domain === 'rengo' ? -8 : 7, ap: 0.25, seg: { unions: 0.7, employees: 0.4, business: -0.4 }, shunto: 0.4 + (c.role.pm ? 0.3 : 0) }), lose: (c) => ({ sup: c.def.domain === 'rengo' ? -2 : -3, an: 4 }),
  lines: (c) => [gdate(c.g).n >= 20130920 ? '政労使会議で経営側に賃上げを求める' : '経団連型の経済界のトップに、賃上げを呼びかける（要請）', '成功すると春闘の妥結率が上がる（物価が少し上がる）'],
  voices: () => ({ pro: ['「物価に負けない賃上げが消費を支える」（労働組合）'], con: ['「賃金は労使が決めるもの。政府の介入は筋違い」（経営者）', '「中小企業には払えない」（中小企業団体）'] }) });
simple('sect_watch', { name: '公安調査で実態を調べる', short: '調査', domains: ['sect'], desc: '公安調査庁や警察の調査で、団体の実態（過激化の度合い・資金の流れ）を調べる。結社の自由に配慮しながら行う。',
  who: (c) => (c.role.pm || (c.role.kind === 'minister' && ctrlOf(c) === 'full') ? null : `調査を指示できるのは、総理か担当の大臣（${ministerOf(c.g, 'sect')}）`), cost: () => ({ stamina: 6 }), cd: 15,
  odds: () => 0.82, win: (c) => ({ an: 3, reveal: true, sup: -1 }), lose: () => ({ an: 2 }),
  lines: (c) => ['調査員を使って、団体の過激化の度合いと動きを探る', '見えなかった「過激化の兆候」が数字で分かるようになる'],
  voices: () => ({ pro: ['「国民の安全のため、実態把握は必要だ」（治安当局）'], con: ['「監視の強化は結社の自由を脅かす」（弁護士会）'] }) });
simple('sect_dialogue', { name: '対話して過激化を和らげる', short: '対話', domains: ['sect'], desc: '代表と話し合い、主張の窓口をつくって過激化を和らげる。支持と受け取られるリスクもある。',
  who: () => null, cost: () => ({ stamina: 8 }), cd: 15, kind: 'soft',
  odds: (c) => clamp(0.5 + persona(c.grp, 'conc') - persona(c.grp, 'press') * 0.2 - 0.2 * (num(c.grp.an) / 100), 0.1, 0.85),
  win: (c) => ({ sup: 4, an: -12, radical: -12, scandal: c.def.radical && roll(0.15) ? 1.2 : 0, scandalText: '過激な団体と会ったことが批判された' }), lose: () => ({ an: 6, radical: 3 }),
  lines: () => ['主張を聞き、暴力や違法行為には明確に線を引く', '会ったこと自体が「お墨付き」と批判されることもある'],
  voices: () => ({ pro: ['「孤立させるより、対話で過激化を防ぐほうが現実的」（研究者）'], con: ['「過激な集団に正当性を与える」（野党・市民）'] }) });
simple('sect_observe', { name: '観察処分を請求する', short: '観察処分', domains: ['sect'], desc: '団体規制法（1999年12月〜）に基づく観察処分を、公安調査庁長官が公安審査委員会に請求する。対象は無差別大量殺人行為を行った団体に限られる。',
  who: (c) => { if (!since(c.g, 19991227)) return '団体規制法（1999年12月）がまだない。破壊活動防止法（1952年）の調査はできるが、観察処分の制度はこの時代にはない'; return c.role.pm || (c.role.kind === 'minister' && ctrlOf(c) === 'full') ? null : `請求の指示ができるのは、総理か担当の大臣（${ministerOf(c.g, 'sect')}）`; },
  cost: () => ({ stamina: 10 }), cd: 60,
  odds: (c) => clamp(((c.grp.x.radical || 0) - 40) / 120 + (c.grp.x.incident ? 0.25 : 0) + 0.05, 0.02, 0.8),
  win: (c) => ({ sup: -10, an: 8, inf: -5, ap: -0.2, radical: -8, silent: 120, watch: 2, griev: ['obs', '観察処分に強く反発している', 30] }), lose: (c) => ({ sup: -5, an: 10, ap: -0.5, scandal: isDemocracy(c.g) && roll(0.3) ? 1 : 0, scandalText: '観察処分の請求が「不当」と批判された' }),
  lines: (c) => ['請求が認められると、公安調査官の立入検査・報告義務で団体を継続して監視できる', '無差別大量殺人行為を行った団体という要件がなければ、認められにくい'],
  voices: () => ({ pro: ['「再び重大な事件が起きないよう、監視は必要」（被害者団体）'], con: ['「要件を広げる運用は、信教・結社の自由を脅かす」（弁護士会）'] }) });
simple('exhibit', { name: '展覧会・公演を主催する', short: '展覧会', domains: ['artist', 'bunka'], desc: '国や自治体が主催する展覧会・公演・芸術祭を開く。表現の自由をめぐる論争が起きることもある。',
  who: (c) => needGov({ ...c, local: true }), cost: (c) => ({ gov: r0(40 * scaleOf(c.g) * (c.role.kind === 'local' ? 0.15 : 1)), stamina: 6 }), cd: 20,
  odds: () => 0.9, win: (c) => ({ sup: 8, an: -6, ap: 0.1, seg: { urban: 0.4, young: 0.3 }, exhibit: true, rd: 0 }), lose: () => ({ sup: 1 }),
  lines: () => ['作品の選び方によっては、「政治的だ」「検閲だ」と論争になる（約12%）', '成功すると文化への関心が高まり、観光にも少し効く'],
  voices: () => ({ pro: ['「文化は国の豊かさ。公的な支えが必要」（芸術家）'], con: ['「税金で特定の表現を選ぶのは偏っている」（批判する声）'] }) });
simple('heritage', { name: '文化財を指定・修理する', short: '文化財', domains: ['bunka'], desc: '文化財を指定し、修理・防災に予算を出す（文化財保護法）。保存会の信頼が高まり、観光の魅力も上がる。',
  who: (c) => needGov({ ...c, local: true }), cost: (c) => ({ gov: r0(50 * scaleOf(c.g) * (c.role.kind === 'local' ? 0.15 : 1)), stamina: 5 }), cd: 20,
  odds: () => 0.92, win: (c) => ({ sup: 9, an: -8, ap: 0.1, seg: { elderly: 0.3, rural: 0.3 }, heritage: 1 }), lose: () => ({ sup: 1 }),
  lines: () => ['指定・修理が進むと、文化財の数と傷み具合が改善する', '開発との調整で住民の反発が出ることがある'],
  voices: () => ({ pro: ['「次の世代に受け継ぐべき宝だ」（保存会）'], con: ['「指定されると建て替えができず困る」（所有者）'] }) });
simple('festival', { name: '国民的行事を支援する', short: '行事', domains: ['bunka', 'artist', 'sports'], desc: '祭り・音楽祭・国民的な行事の開催を後押しする。人が集まり、地域とメディアが盛り上がる。',
  who: (c) => needGov({ ...c, local: true }), cost: (c) => ({ gov: r0(30 * scaleOf(c.g) * (c.role.kind === 'local' ? 0.15 : 1)), stamina: 5 }), cd: 15,
  odds: () => 0.9, win: (c) => ({ sup: 7, an: -6, ap: 0.2, seg: { rural: 0.3, families: 0.3 }, promo: 4 }), lose: () => ({ sup: 1 }),
  lines: () => ['安全対策（雑踏事故・熱中症）の費用もかかる', '来場者が増え、観光地の宣伝にもなる'],
  voices: () => ({ pro: ['「みんなで盛り上がれる行事は、地域の宝」（保存会）'], con: ['「警備や清掃の負担が地元にのしかかる」（住民）'] }) });
simple('cool_japan', { name: 'クールジャパン戦略を進める', short: 'クール', domains: ['bunka', 'artist', 'business'], desc: '日本のコンテンツ（アニメ・マンガ・食・工芸）を海外に売り込む国家戦略。官民ファンドを使う。',
  who: (c) => (!since(c.g, 20100618) ? 'クール・ジャパンが国の戦略になるのは2010年の新成長戦略から。この時代には「コンテンツ産業の育成」として文化・経済の施策で進められる' : needGov(c)), cost: (c) => ({ gov: r0(120 * scaleOf(c.g)), stamina: 8 }), cd: 40,
  odds: () => 0.75, win: (c) => ({ sup: 8, an: -6, ap: 0.2, seg: { young: 0.5, business: 0.2 }, eco: { key: 'cool', name: 'コンテンツ輸出', growth: 0.04, len: 90 }, promo: 6 }), lose: () => ({ sup: -1, an: 3, ap: -0.1 }),
  lines: () => ['官民ファンドの投資は、失敗して赤字になる例もある', '成功すると輸出と観光（訪日客）にもプラス'],
  voices: () => ({ pro: ['「日本の文化は世界で通用する強み」（クリエイター）'], con: ['「官が選ぶと現場の自由が損なわれる。税金の無駄づかいも」（批判する声）'] }) });
simple('rd_up', { name: '研究費を増やす', short: '研究費', domains: ['kenkyu'], desc: '科学技術の予算（大学の運営費・科研費・基礎研究）を増やす。長い目で成長に効く。結果が出るのは数年先。',
  who: (c) => needGov(c), options: () => TIER_NAMES.map((l, i) => ({ key: `t${i}`, tier: i, label: `${l}（${[150, 600, 2000][i]}億円クラス）` })), cost: (c) => ({ gov: r0([150, 600, 2000][tierOf(c.opt)] * scaleOf(c.g)), stamina: 6 }), cd: 30,
  odds: () => 0.92, win: (c) => ({ sup: [6, 12, 20][tierOf(c.opt)], an: -[6, 12, 20][tierOf(c.opt)], ap: -0.05 + 0.1 * tierOf(c.opt), rd: [3, 7, 14][tierOf(c.opt)], seg: { young: 0.3, urban: 0.3 } }), lose: () => ({ sup: 1 }),
  lines: () => ['研究の力（研究水準）が上がる。数年かけて成長に効く', '効果は遅く、すぐの人気にはなりにくい'],
  voices: () => ({ pro: ['「基礎研究は国の未来への投資」（研究者）'], con: ['「成果が見えにくい。無駄な研究も多い」（批判する声）'] }) });
simple('univ_reform', { name: '大学改革を進める', short: '大学改革', domains: ['kenkyu'], desc: '大学の運営・評価・人事の仕組みを改革する（法人化・競争的資金の拡大など）。効率は上がるが、現場の疲弊や学問の自由への懸念も。',
  who: (c) => needGov(c), cost: () => ({ stamina: 10 }), cd: 60,
  odds: (c) => clamp(0.6 - 0.2 * (num(c.grp.an) / 100) + 0.1 * relQ(c.grp), 0.2, 0.85), win: (c) => ({ sup: -4, an: 8, ap: 0.2, rd: 3, young: -4, seg: { business: 0.3, urban: -0.2 }, eco: { key: 'univ', name: '大学改革の効果', growth: 0.02, len: 90 } }), lose: () => ({ sup: -6, an: 12, ap: -0.2 }),
  lines: () => ['短期的には研究者の反発が出やすい', '若手の任期付きポストが増える懸念（若手研究者の安定が下がる）'],
  voices: () => ({ pro: ['「競争と評価で大学を強くすべき」（経済界）'], con: ['「基礎研究が痩せ、若手が疲弊する」（大学・学術界）'] }) });
simple('integrity', { name: '研究不正の対策を強める', short: '不正対策', domains: ['kenkyu'], desc: '研究公正のガイドライン・第三者機関・調査の仕組みを強める。研究不正の発生を減らす。',
  who: (c) => needGov(c), cost: (c) => ({ gov: r0(20 * scaleOf(c.g)), stamina: 6 }), cd: 40, odds: () => 0.9, win: () => ({ sup: 3, an: -2, ap: 0.1, integrity: 12 }), lose: () => ({ sup: 0 }),
  lines: () => ['研究不正（捏造・改ざん）の発生確率が下がる', '手続きが増えて現場の負担になる'],
  voices: () => ({ pro: ['「科学への信頼を守るために必要」（学術界）'], con: ['「書類仕事が増えて研究時間が減る」（研究者）'] }) });
simple('kanbu', { name: '官僚の幹部人事を行う', short: '幹部人事', domains: ['seifu'], desc: '各府省の幹部人事に政治が関わる。官邸主導で省庁を動かしやすくなるが、忖度・萎縮・抵抗のリスクも。',
  who: (c) => (c.role.pm || (c.role.kind === 'minister' && ctrlOf(c) === 'full') ? null : '幹部人事を動かせるのは総理か官房長官・担当大臣'), cost: () => ({ stamina: 8 }), cd: 30,
  odds: (c) => clamp(0.66 + (since(c.g, 20140530) ? 0.15 : -0.05) - 0.2 * (num(c.grp.an) / 100), 0.2, 0.9), win: () => ({ sup: 8, an: -8, inf: -3, ap: 0.05, sontaku: 1 }), lose: () => ({ sup: -5, an: 12, leak: 1 }),
  lines: (c) => [since(c.g, 20140530) ? '内閣人事局（2014年〜）があるので、官邸が幹部人事を一元的に決められる' : '人事は各省庁の慣行が強く、官邸の影響力には限りがある', '強く出ると「忖度」や情報のリークが起きやすい'],
  voices: () => ({ pro: ['「政治主導で政策を進めるのは民主主義の姿」（改革派）'], con: ['「官僚が顔色をうかがい、忖度が広がる」（元官僚）'] }) });
simple('grant', { name: '地方交付税・補助を上積みする', short: '交付税', domains: ['seifu'], desc: '地方自治体の財源（地方交付税・補助金）を増やす。知事会・市長会との関係が良くなるが、国の財政は苦しくなる。',
  who: (c) => (c.def.id.startsWith('g_chiji') || c.def.id === 'g_shicho' ? needGov(c) : 'この団体は地方自治体ではない'), options: () => TIER_NAMES.map((l, i) => ({ key: `t${i}`, tier: i, label: `${l}（${[100, 500, 2000][i]}億円クラス）` })), cost: (c) => ({ gov: r0([100, 500, 2000][tierOf(c.opt)] * scaleOf(c.g)), stamina: 4 }), cd: 30,
  odds: () => 0.9, win: (c) => ({ sup: [6, 12, 20][tierOf(c.opt)], an: -[8, 14, 24][tierOf(c.opt)], ap: 0.05, seg: { rural: 0.4 }, coll: [0.3, 0.8, 2][tierOf(c.opt)] }), lose: () => ({ sup: 1 }),
  lines: () => ['財政当局は歳出の増加に難色を示す', '地方の公共サービスと災害対応が安定する'],
  voices: () => ({ pro: ['「地方の財源が安定して、住民サービスが守れる」（自治体）'], con: ['「国の借金がさらに増える」（財政当局）'] }) });
simple('chiji_meet', { name: '知事会・市長会と協議する', short: '地方協議', domains: ['seifu'], desc: '国と地方の協議の場（知事会・市長会）を開き、地方の声を聞く。', kind: 'soft',
  who: (c) => (c.def.id === 'g_chiji' || c.def.id === 'g_shicho' ? (c.role.kind === 'citizen' ? '協議に出られるのは総理・大臣・首長・議員' : null) : 'この団体は地方自治体ではない'), cost: () => ({ stamina: 8 }), cd: 8,
  odds: (c) => clamp(0.7 + 0.2 * relQ(c.grp), 0.2, 0.95), win: (c) => ({ sup: 6, an: -8, ap: 0.05 }), lose: () => ({ sup: -1, an: 2 }),
  lines: () => ['地方の要望（交付税・防災・人口減少対策）を聞く'], voices: () => ({ pro: ['「国と地方が対等に話せる場は大切」（首長）'], con: ['「協議ばかりで結論が出ない」（記者）'] }) });
simple('amakudari_check', { name: '天下りの実態を調べる', short: '天下り', domains: ['seifu'], desc: '官僚の再就職（天下り）のあっせんがないか調べる。官庁との関係は悪くなるが、世論の評価は上がる。',
  who: (c) => (has(c.g, 'adminAction') ? (c.role.pm || c.role.kind === 'minister' ? null : '調査を指示できるのは総理か大臣') : '行政のしくみが読み込まれていない'), cost: () => ({ stamina: 6 }), cd: 30,
  odds: () => 0.85, win: () => ({ sup: -6, an: 9, ap: 0.3, seg: { floating: 0.4 }, amakudari: true }), lose: () => ({ an: 4 }),
  lines: () => ['政府の行政コア（govt.js）の「天下りの調査」と同じ処理を行う'], voices: () => ({ pro: ['「税金で食べる再就職のあっせんは許されない」（市民団体）'], con: ['「経験者の再就職を一律に疑うのは非効率」（官庁OB）'] }) });

const REL_OPTS = [['visit', '行事を訪ねる（敬意をもって交流）'], ['ask_support', '選挙の推薦をお願いする（組織票）'], ['report', '被害の相談・報道を確かめる'], ['victim_support', '被害者の支援に取り組む'], ['question_power', '報告徴収・質問権を使う（所轄庁）'], ['request_dissolution', '解散命令を請求する（所轄庁）'], ['diet_question', '国会で質問する']];
const REL_FX = { visit: { sup: 5, an: -4 }, ask_support: { sup: 6, seg: { elderly: 0.4 }, coll: 1.5 }, report: { sup: -1 }, victim_support: { sup: -6, an: 8, ap: 0.3, seg: { floating: 0.4 } }, question_power: { sup: -8, an: 10, ap: 0.2 }, request_dissolution: { sup: -20, an: 25, ap: 0.2, inf: -6 }, diet_question: { sup: -3, an: 4, ap: 0.1 } };
simple('rel_action', { name: '宗教法人としての対応（政教分離のルール内）', short: '宗教対応', domains: ['sect'], kind: 'soft', desc: '宗教団体との関わりを、政府の宗教コア（宗教法人法・憲法20条・89条）の決まりに沿って行う。訪問・推薦・被害者支援・質問権・解散命令請求など。',
  options: (c) => REL_OPTS.map(([k, l]) => ({ key: k, label: l })),
  who: (c) => { if (!c.def.link) return 'この団体は宗教法人ではない（宗教法人法の対象外）'; if (!has(c.g, 'govtRefusal')) return '宗教のしくみが読み込まれていない'; const rid = c.def.link.split(':')[1]; return safe(() => c.g.govtRefusal('religion', { group: rid, action: (c.opt && c.opt.key) || 'visit' }), null); },
  cost: () => ({ stamina: 6 }), cd: 6, odds: () => null,
  win: (c) => REL_FX[(c.opt && c.opt.key) || 'visit'] || {}, lose: () => ({}),
  exec: async (g, c) => { const rid = c.def.link.split(':')[1]; const r = safe(() => g.religionAction(rid, (c.opt && c.opt.key) || 'visit', {}), null); return r; },
  lines: (c) => ['信仰そのものではなく、違法な勧誘・献金の強要が問題として扱われる', '国は特定の宗教を優遇も弾圧もしない（憲法20条）。公金の支出は憲法89条で禁じられる'],
  voices: () => ({ pro: ['「信教の自由を尊重しつつ、被害には厳しく向き合うべき」（法律家）'], con: ['「政治と宗教の距離が問われる」（市民団体）', '「宗教への介入は慎重に」（宗教者）'] }) });

// ---- helpers used above
function groupById(g, id) { return S(g).groups[id] || null; }
function backingFor(g, domain) {
  const b = S(g).backing;
  let v = 0;
  for (const [theme, e] of Object.entries(b)) if (e && e.until >= today(g) && (THEME_DOMAIN[theme] === domain || theme === 'economy')) v = Math.max(v, num(e.strength));
  return clamp(v, 0, 1);
}
function oppositionPower(g, def, dir) {
  const s = S(g);
  const list = [];
  for (const id of GROUP_ORDER) {
    if (id === def.id) continue;
    const o = GROUP_DEFS[id], grp = s.groups[id];
    if (!grp || !grp.on || o.domain === 'seifu') continue;
    const dot = (def.lean.econ * o.lean.econ * 0.5 + def.lean.social * o.lean.social * 0.3 + def.lean.security * o.lean.security * 0.2) / 4;
    if (dot < -0.1) list.push(influenceOf(g, id) * (num(grp.an) / 100 + 0.5) * Math.abs(dot));
  }
  list.sort((a, b) => b - a);
  return clamp(list.slice(0, 3).reduce((a, b) => a + b, 0) / 100, 0, 0.9);
}
export function tourismBrand(g) { return since(g, 20030401) ? 'ビジット・ジャパン' : since(g, 19870609) ? '観光・リゾート' : '観光'; }
export function tourismAgency(g) { return since(g, 20081001) ? '観光庁' : since(g, 20010106) ? '国土交通省（総合政策局の観光部門）' : '運輸省（観光部門）'; }

// ---- the preview / run pipeline
function actionCtx(g, id, kind, optKey) {
  const def = GROUP_DEFS[id];
  const s = S(g);
  const grp = s.groups[id];
  const A = ACTIONS[kind];
  if (!def || !grp || !A) return null;
  const c = { g, id, def, grp, role: groupsRole(g), A, kind };
  const opts = A.options ? safe(() => A.options(c), null) : null;
  c.opts = opts;
  c.opt = opts ? opts.find((o) => o.key === optKey) || opts[0] : null;
  c.cost = safe(() => A.cost(c), {}) || {};
  return c;
}
export function actionAvailable(def, kind) { const A = ACTIONS[kind]; if (!A) return false; if (A.domains && !A.domains.includes(def.domain)) return false; return true; }
export function actionsFor(g, id) {
  const def = GROUP_DEFS[id];
  if (!def) return [];
  const list = ACTION_ORDER.filter((k) => actionAvailable(def, k));
  // domain-specific first, then the generic order
  list.sort((a, b) => (ACTIONS[b].domains ? 1 : 0) - (ACTIONS[a].domains ? 1 : 0));
  return list;
}
export function describeFx(fx, name = '') {
  if (!fx) return [];
  const out = [];
  if (fx.sup) out.push(`${name}の支持 ${fx1(fx.sup)}`);
  if (fx.an) out.push(`不満 ${fx1(fx.an)}`);
  if (fx.inf) out.push(`影響力 ${fx1(fx.inf)}`);
  if (fx.ap) out.push(`支持率 ${fx1(fx.ap)}`);
  if (fx.funds) out.push(`政治資金 +${fmtMoney(fx.funds)}`);
  if (fx.fame) out.push(`知名度 ${fx1(fx.fame)}`);
  if (fx.fans) out.push(`ファン ${fx1(fx.fans)}`);
  if (fx.money) out.push(`お金 ${fx.money > 0 ? '+' : '−'}${fmtMoney(Math.abs(fx.money))}`);
  if (fx.local) out.push(`地元の支持 ${fx1(fx.local)}`);
  if (fx.standing) out.push(`党内の評価 ${fx1(fx.standing)}`);
  if (fx.scandal) out.push('不祥事として報じられる恐れ');
  if (fx.cred) out.push(`信頼性 ${fx1(fx.cred)}`);
  return out;
}
// -> { id, name, desc, kind, why, cost, costText, odds, lines, pro, con, options, opt, win[], lose[], cd }
export function groupActionPreview(g, id, kind, optKey) {
  const c = actionCtx(g, id, kind, optKey);
  if (!c) return { ok: false, why: 'そのような行動はない', id: kind };
  const A = c.A;
  let why = null;
  if (A.domains && !A.domains.includes(c.def.domain)) why = 'この団体にはできない';
  if (!why && !c.grp.on) why = 'この団体は、いまの時代にはない';
  if (!why && c.grp.x.banned && c.grp.x.banned > today(g)) why = 'この団体は活動を禁じられている（地下に潜った）';
  if (!why) why = safe(() => A.who(c), null);
  const cdLeft = num(c.grp.cool[kind]) - today(g);
  if (!why && cdLeft > 0) why = `同じことは、あと${cdLeft}日はできない`;
  if (!why) why = costBlock(g, c.cost);
  const odds = A.odds ? safe(() => A.odds(c), null) : null;
  const win = A.win ? safe(() => A.win(c), null) : null;
  const lose = A.lose ? safe(() => A.lose(c), null) : null;
  const v = A.voices ? safe(() => A.voices(c), { pro: [], con: [] }) : { pro: [], con: [] };
  const name = groupName(g, id);
  return {
    ok: true, id: kind, group: id, name: A.name, short: A.short || A.name, desc: A.desc, kind: A.kind, why, cost: c.cost, costText: costText(g, c.cost), odds: odds == null ? null : r2(odds),
    lines: safe(() => A.lines(c), []) || [], pro: v.pro || [], con: v.con || [], options: c.opts, opt: c.opt, cd: A.cd, cdLeft: Math.max(0, cdLeft), win: describeFx(win, name), lose: describeFx(lose, name),
  };
}
export function groupActionsList(g, id) {
  return actionsFor(g, id).map((k) => {
    const p = groupActionPreview(g, id, k);
    return { id: k, name: p.name, short: p.short, kind: p.kind, why: p.why, odds: p.odds, costText: p.costText, desc: p.desc, domainOnly: !!ACTIONS[k].domains };
  });
}
// run an action: pay, roll, apply, log. -> { ok, why?, success, text, lines[], odds }
export async function groupAct(g, id, kind, opts = {}) {
  const c = actionCtx(g, id, kind, opts.option || opts.opt);
  if (!c) return { ok: false, why: 'そのような行動はない' };
  const pv = groupActionPreview(g, id, kind, opts.option || opts.opt);
  if (pv.why) return { ok: false, why: pv.why };
  const A = c.A, s = S(g), d = c.def;
  const name = groupName(g, id);
  if (A.exec) {
    // an action carried out by another core (religionAction …): that core decides; this module adds the relationship effects
    const r = await A.exec(g, c);
    if (!r || r.ok === false) return { ok: false, why: (r && r.why) || 'できなかった' };
    payCost(g, c.cost, d.domain);
    const fx0 = A.win(c) || {};
    const lines0 = applyFx(g, fx0, { id, role: c.role, domain: d.domain });
    c.grp.cool[kind] = today(g) + (A.cd || 0);
    glog(g, id, `${A.name}`);
    return { ok: true, success: true, text: [A.name + '：' + (r.text || '実行した。'), ...lines0].join('\n'), lines: lines0, odds: null };
  }
  let crime = null;
  // 買収: the crime core rolls its own odds (found now / later); the attempt is an offence even when refused
  if (kind === 'bribe') {
    const cid = bribeCrime(g, d);
    if (cid) {
      payCost(g, c.cost, d.domain);
      const r = await safe(() => g.commitCrime(cid, { amount: c.cost.funds, where: '会合の席', request: true }), Promise.resolve(null));
      crime = r || null;
      c.cost = { ...c.cost, funds: 0 };
    }
  }
  if (!(crime && crime.caught)) { if (kind !== 'bribe' || !crime) payCost(g, c.cost, d.domain); }
  if (crime && crime.caught) { c.grp.cool[kind] = today(g) + (A.cd || 0); return { ok: true, success: false, caught: true, text: `${name}への働きかけが、捜査当局の知るところとなった。`, lines: [], odds: pv.odds }; }
  const odds = pv.odds == null ? 1 : pv.odds;
  const success = roll(odds);
  const fx = (success ? A.win : A.lose)(c) || {};
  const lines = applyFx(g, fx, { id, role: c.role, domain: d.domain });
  const extra = special(g, c, fx, success);
  if (extra) lines.push(...extra);
  c.grp.cool[kind] = today(g) + (A.cd || 0);
  if (A.run) { const t = A.run(g, c, success); if (t) lines.push(t); }
  const head = success ? `${A.name}：うまくいった。` : `${A.name}：思うようにいかなかった。`;
  glog(g, id, `${A.name}（${success ? '成功' : '失敗'}）`);
  if (!success && fx.scandal) news(g, `${name}をめぐる動きが批判を呼んでいる`, { domain: d.domain });
  const text = [head, ...lines].join('\n');
  return { ok: true, success, text, lines, odds: pv.odds, bribed: kind === 'bribe' };
}
// effects that need more than applyFx: silences, bans, sects, research, site promo, shunto, … (returns lines)
function special(g, c, fx, success) {
  const out = [], s = S(g), grp = c.grp, def = c.def;
  if (fx.silent) { grp.x.silent = today(g) + Math.round(fx.silent); out.push('当面、この団体は静かになる'); }
  if (fx.banned) { grp.x.banned = today(g) + Math.round(fx.banned); grp.infMod = clamp(grp.infMod - 20, -30, 30); out.push('活動を禁じられ、地下に潜った'); if (def.radical) grp.x.radical = clamp(num(grp.x.radical) + 12, 0, 100); }
  if (fx.chill) for (const id of groupsOfDomain(def.domain)) if (id !== def.id && s.groups[id].on) { s.groups[id].an = clamp(s.groups[id].an + fx.chill, 0, 100); s.groups[id].mod = clamp(num(s.groups[id].mod) - fx.chill * 0.6, -60, 60); }
  if (fx.solidarity) for (const id of groupsOfDomain(def.domain)) if (id !== def.id && s.groups[id].on) s.groups[id].mod = clamp(num(s.groups[id].mod) - fx.solidarity, -60, 60);
  if (fx.demo && c.role.cabinet && has(g, 'spawnDemo')) { safe(() => g.spawnDemo({ cause: `${groupName(g, def.id)}への圧力・弾圧に抗議`, size: success ? 'small' : 'medium', segment: def.seg, against: 'government' })); out.push('各地で抗議のデモが起きた'); }
  if (fx.coop) { grp.x.coop = num(grp.x.coop) + 1; if (grp.x.coop >= 3) out.push('「御用団体」との見方が広がっている'); }
  if (fx.bribed) { grp.x.bribed = today(g); }
  if (fx.owe) grp.owe = num(grp.owe) + fx.owe;
  if (fx.reveal) { grp.x.known = today(g); out.push(`調査の結果：過激化の度合い ${r0(grp.x.radical)}／100（${radicalLabel(grp.x.radical)}）`); }
  if (fx.radical) grp.x.radical = clamp(num(grp.x.radical) + fx.radical, 0, 100);
  if (fx.watch) grp.x.watch = clamp(num(grp.x.watch) + fx.watch, 0, 3);
  if (fx.campaign && c.role.kind !== 'citizen') { const p = polOf(g); if (p && p.me && p.me.campaign && Number.isFinite(Number(p.me.campaign.points))) { p.me.campaign.points += fx.campaign; out.push(`選挙運動の得点 +${fx.campaign}`); } }
  if (fx.promo) { for (const site of s.sites) if (site.status === 'designated') site.promo = clamp(num(site.promo) + fx.promo, 0, 100); }
  if (fx.shunto) { const sh = s.union.shunto; if (sh.stage === 'demand' || sh.stage === 'talks') { sh.offer = r1(num(sh.offer) + fx.shunto); out.push(`今年の春闘の経営側回答の見通し ${fx1(fx.shunto)}ポイント`); } else { sh.nextBoost = num(sh.nextBoost) + fx.shunto; out.push('次の春闘の結果を押し上げる'); } }
  if (fx.rd) { s.rd.level = clamp(num(s.rd.level) + fx.rd, 0, 100); s.rd.spent += 1; out.push(`研究水準 ${fx1(fx.rd)}（いま${r0(s.rd.level)}）`); }
  if (fx.integrity) { s.rd.integrity = clamp(num(s.rd.integrity) + fx.integrity, 0, 100); out.push(`研究公正 ${fx1(fx.integrity)}`); }
  if (fx.young) { s.rd.young = clamp(num(s.rd.young) + fx.young, 0, 100); }
  if (fx.heritage) { s.culture.heritage += fx.heritage; s.culture.damage = Math.max(0, s.culture.damage - 1); out.push(`指定文化財 ${s.culture.heritage}件`); }
  if (fx.exhibit && success && roll(0.12)) {
    const grpA = s.groups.a_hyogen || grp;
    s.art.protests += 1;
    news(g, '公的な展覧会の展示作品をめぐって、「政治的だ」「検閲だ」と論争が起きた', { domain: 'artist' });
    out.push('展示作品をめぐって論争が起きた（表現の自由か、公的な場の中立か）');
    applyFx(g, { an: 8, sup: -3 }, { id: grpA.id, role: c.role });
  }
  if (fx.sontaku) { s.seifu.sabotage = clamp(num(s.seifu.sabotage) - 2, 0, 100); s.seifu.sontaku = num(s.seifu.sontaku) + 1; if (s.seifu.sontaku >= 3 && since(g, 20140530)) out.push('「忖度」の指摘が増えている'); }
  if (fx.leak) { s.seifu.leaks += 1; s.seifu.lastLeak = today(g); news(g, '政府の内部資料が流出した。官僚の反発が背景か', { domain: 'seifu' }); out.push('不満を持つ官僚から、内部情報がリークされた'); }
  if (fx.amakudari && has(g, 'adminAction')) { const r = safe(() => g.adminAction('amakudari_check'), null); if (r && r.text) out.push(r.text); }
  return out;
}
export function radicalLabel(v) { v = num(v); return v >= 70 ? '危険な水準' : v >= 45 ? '過激化が進んでいる' : v >= 25 ? '一部に過激な動き' : '穏健'; }

// ================================================================ cases: demands (要望), offers (申し出) and events that need an answer
// CASE = { id, kind, group, domain, title, text, day, due, status: 'open'|'done'|'expired', ask?, data?, res? }
// kinds: demand · offer_don · offer_endorse · offer_amb · strike · scandal · incident · fraud · protest
const ASK_COST = { money: 80, event: 40, safety: 50, staff: 10, honor: 1, consult: 0.5, dereg: 0, protect: 0, law: 0, wage: 0 };
const ASK_KIND_NAME = { money: '予算・補助', dereg: '規制緩和', protect: '規制・保護', honor: '顕彰・表彰', consult: '協議の場', law: '法整備', event: '行事・大会', staff: '人員・ポスト', safety: '安全・条件', wage: '賃上げ' };
export { ASK_KIND_NAME };
function roleHandles(role, domain, kind) {
  if (role.pm) return true;
  if (role.kind === 'minister') return domainControl(role, domain) === 'full';
  if (role.kind === 'local') return ['tourism', 'sports', 'bunka', 'kyokai', 'seifu'].includes(domain);
  if (role.kind === 'member') return ['consult', 'honor', 'event'].includes(kind);
  return false;
}
function openCases(s) { return s.cases.filter((c) => c.status === 'open'); }
export function makeDemand(g, id, o = {}) {
  const s = S(g), def = GROUP_DEFS[id], grp = s.groups[id];
  if (!def || !grp || !grp.on) return null;
  const role = groupsRole(g);
  if (num(grp.x.silent) > today(g) || num(grp.x.banned) > today(g)) return null;
  if (openCases(s).some((c) => c.group === id && c.kind === 'demand')) return null;
  if (openCases(s).length >= 9) return null;
  const n = gdate(g).n;
  const asks = (def.asks || []).map((a, i) => ({ a, i })).filter(({ a }) => {
    const op = a[2] || {};
    if (op.from && n < op.from) return false;
    if (op.to && n >= op.to) return false;
    if (!roleHandles(role, def.domain, a[0])) return false;
    return today(g) - num(grp.x[`ask${a[0]}`], -999) > 40;
  });
  if (!asks.length) return null;
  const { a, i } = pick(asks);
  const lead = grp.leaders[0];
  const due = today(g) + rint(22, 36);
  const c = { id: `c${s.seq++}`, kind: 'demand', group: id, domain: def.domain, title: a[1].length > 28 ? a[1].slice(0, 27) + '…' : a[1], text: `${groupName(g, id)}の${lead.title}・${lead.name}（${LEADER_PERSONAS[lead.persona].name}）：「${a[1]}」`, day: today(g), due, status: 'open', ask: { kind: a[0], text: a[1], idx: i, policy: (a[2] && a[2].policy) || null }, data: {}, res: null };
  grp.x[`ask${a[0]}`] = today(g);
  s.cases.unshift(c);
  if (s.cases.length > 40) s.cases = s.cases.filter((x) => x.status === 'open').concat(s.cases.filter((x) => x.status !== 'open').slice(0, 20));
  if (o.reason !== 'meet') news(g, `${groupName(g, id)}が要望：「${a[1]}」`, { domain: def.domain, id: c.id });
  return c;
}
export function makeOffer(g, id, kind) {
  const s = S(g), def = GROUP_DEFS[id], grp = s.groups[id];
  const role = groupsRole(g);
  if (!def || !grp || !grp.on || openCases(s).some((c) => c.group === id && c.kind.startsWith('offer'))) return null;
  const lead = grp.leaders[0];
  let c = null;
  if (kind === 'offer_don') {
    const amt = donationAmount(g, grp, def, role);
    c = { id: `c${s.seq++}`, kind, group: id, domain: def.domain, title: `${fmtMoney(amt)}ほどの献金の申し出`, text: `${groupName(g, id)}の${lead.title}・${lead.name}：「活動を応援したい。${fmtMoney(amt)}ほど、献金させてほしい。そのかわり、業界の声は聞いてほしい」`, day: today(g), due: today(g) + 14, status: 'open', data: { amount: amt }, res: null };
  } else if (kind === 'offer_endorse') {
    c = { id: `c${s.seq++}`, kind, group: id, domain: def.domain, title: '選挙の推薦・応援の申し出', text: `${groupName(g, id)}の${lead.title}・${lead.name}：「次の選挙では、うちが推薦して、組織を挙げて応援したい」`, day: today(g), due: today(g) + 20, status: 'open', data: {}, res: null };
  } else if (kind === 'offer_amb') {
    const role2 = { tourism: '観光大使', sports: '応援団長', bunka: '文化大使', artist: 'チャリティ公演の出演者', kenkyu: '科学イベントのアンバサダー', kyokai: 'キャンペーンの顔' }[def.domain] || '応援役';
    c = { id: `c${s.seq++}`, kind, group: id, domain: def.domain, title: `${role2}の依頼`, text: `${groupName(g, id)}の${lead.title}・${lead.name}：「ぜひ${role2}になってほしい。あなたの知名度が、地域と業界の力になります」`, day: today(g), due: today(g) + 20, status: 'open', data: { role: role2 }, res: null };
  }
  if (c) { s.cases.unshift(c); news(g, `${groupName(g, id)}から${c.title}`, { domain: def.domain, id: c.id }); }
  return c;
}
function askCost(g, ask, role, mult = 1) {
  const gov = r0((ASK_COST[ask.kind] || 0) * scaleOf(g) * mult * (role.kind === 'local' ? 0.12 : 1));
  const st = role.kind === 'member' ? 6 : role.kind === 'local' ? 6 : 4;
  return gov > 0 && (role.pm || role.kind === 'minister' || role.kind === 'local') ? { gov, stamina: st } : { stamina: st };
}
// the effect of accepting an ask (k = 1 full, 0.5 partial)
function askFx(g, c, k) {
  const def = GROUP_DEFS[c.group], grp = S(g).groups[c.group], role = groupsRole(g);
  const kind = c.ask.kind;
  const infK = 0.7 + influenceOf(g, c.group) / 100;
  const base = { sup: 10 * k * infK, an: -14 * k, coll: 1 * k };
  const mem = role.kind === 'member' || role.kind === 'local';
  switch (kind) {
    case 'money': return { ...base, ap: -0.1 * k + 0.05, seg: { [def.seg]: 0.5 * k }, coll: 1.5 * k };
    case 'dereg': return { ...base, ap: 0.05 * k, seg: { business: 0.3 * k, [def.seg]: 0.4 * k, unions: -0.2 * k }, eco: { key: `ask:${c.id}`, name: `${def.name}の規制緩和`, growth: 0.025 * k, len: 50 } };
    case 'protect': return { ...base, ap: 0, seg: { [def.seg]: 0.4 * k, business: -0.1 * k } };
    case 'honor': return { sup: 6 * k, an: -8 * k, cred: grp.x.cred != null ? -2 * k : 0, coll: 0.4 * k };
    case 'consult': return { sup: 5 * k, an: -7 * k };
    case 'law': return { ...base, ap: 0.05 * k, seg: { [def.seg]: 0.3 * k } };
    case 'event': return { sup: 8 * k, an: -10 * k, ap: 0.15 * k, promo: 4 * k, local: mem ? 3 * k : 0 };
    case 'staff': return { sup: 7 * k, an: -10 * k };
    case 'safety': return { sup: 8 * k, an: -12 * k, ap: 0.05 * k, seg: { [def.seg]: 0.3 * k } };
    case 'wage': return { sup: 8 * k, an: -10 * k, ap: 0.1 * k, shunto: 0.3 * k, seg: { unions: 0.4 * k } };
    default: return base;
  }
}
export const CASE_KINDS = {
  demand: {
    options(g, c) {
      const role = groupsRole(g);
      const grp = S(g).groups[c.group];
      const out = [];
      const k = c.ask.kind;
      const fullCost = askCost(g, c.ask, role, 1), halfCost = askCost(g, c.ask, role, 0.5);
      const mem = role.kind === 'member';
      out.push({ key: 'accept', label: mem ? '実現に力を尽くすと約束する' : '要望に応える（全面的に）', desc: mem ? '議員として、予算・制度の実現に動くと約束する（実際に決めるのは内閣）' : `${ASK_KIND_NAME[k]}の要望を受け入れる`, cost: fullCost, fx: askFx(g, c, mem ? 0.7 : 1) });
      if (!mem) out.push({ key: 'partial', label: '一部だけ応える', desc: '要望の半分ほどを受け入れる（費用も半分）', cost: halfCost, fx: askFx(g, c, 0.5) });
      if (c.ask.policy && !mem) {
        const why = has(g, 'policyBlock') ? safe(() => g.policyBlock(c.ask.policy, null), null) : '法案のしくみが読み込まれていない';
        out.push({ key: 'bill', label: '法案として準備する', desc: `「${POLICY_NAME[c.ask.policy] || c.ask.policy}」の法案を出す（国会での審議が必要）`, cost: { stamina: 6 }, why, fx: { ...askFx(g, c, 1), sup: 14 } });
      }
      out.push({ key: 'delay', label: c.extended ? '先送りする（もう延ばせない）' : '回答を先送りする', desc: '期限を15日延ばす（1回だけ）。団体は少し不満になる', cost: {}, why: c.extended ? '先送りはもう使った' : null, fx: { sup: -2, an: 4 } });
      out.push({ key: 'refuse', label: '要望を断る', desc: '正直に断る。団体の不満と反発が高まる', cost: {}, fx: { sup: -(6 + num(grp.an) / 12), an: 12 + num(grp.an) / 20, griev: ['refused', `要望「${c.title}」を断られた`, 24] } });
      return out;
    },
    async resolve(g, c, key, o) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような答え方はない' };
      if (opt.why) return { ok: false, why: opt.why };
      const role = groupsRole(g);
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, c.domain);
      let extra = '';
      if (key === 'delay') { c.due += 15; c.extended = true; const lines = applyFx(g, opt.fx, { id: c.group, role, domain: c.domain }); return { ok: true, text: `回答を先送りした。期限は${dueText(g, c)}まで。`, lines, keep: true }; }
      if (key === 'bill') {
        const id = safe(() => g.proposeBill({ policy: c.ask.policy }), null);
        if (!id) return { ok: false, why: (g.lastPoliticsError || '法案を出せなかった') };
        extra = 'あわせて法案を国会に出した。成立するまでは団体も様子を見る。';
      }
      const lines = applyFx(g, opt.fx, { id: c.group, role, domain: c.domain });
      const sp = special(g, { g, id: c.group, def: GROUP_DEFS[c.group], grp: S(g).groups[c.group], role }, opt.fx, true);
      if (sp.length) lines.push(...sp);
      closeCase(g, c, 'done', key);
      glog(g, c.group, `要望「${c.title}」に${{ accept: '応えた', partial: '一部応えた', bill: '法案で応えた', refuse: '応じなかった' }[key]}`);
      if (key === 'refuse' && influenceOf(g, c.group) >= 50 && roll(0.3)) { news(g, `${groupName(g, c.group)}が政府の対応に強く反発している`, { domain: c.domain }); }
      return { ok: true, text: [{ accept: '要望に応えた。', partial: '一部だけ要望に応えた。', bill: '法案として準備することにした。', refuse: '要望を断った。' }[key], extra].filter(Boolean).join(' '), lines };
    },
    expire(g, c) {
      const lines = applyFx(g, { sup: -5, an: 10, griev: ['ignored', `要望「${c.title}」に回答がなかった`, 22] }, { id: c.group, role: groupsRole(g), domain: c.domain });
      glog(g, c.group, `要望「${c.title}」を放置した`);
      return `${groupName(g, c.group)}の要望「${c.title}」に回答がないまま期限が過ぎた`;
    },
  },
  offer_don: {
    options(g, c) {
      return [
        { key: 'accept', label: '受け取る（収支報告書に載せる）', desc: '正規の献金として受け取る。見返りを期待され、癒着の疑いが少し上がる', cost: {}, fx: { sup: 4, funds: c.data.amount, coll: 1.5 + c.data.amount / 1500000, owe: 1 } },
        { key: 'decline', label: '丁寧に断る', desc: '献金を断る。クリーンな印象になるが、団体は少し気まずい', cost: {}, fx: { sup: -2, rep: 1.5, ap: 0.05 } },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような答え方はない' };
      const lines = applyFx(g, opt.fx, { id: c.group, role: groupsRole(g), domain: c.domain });
      if (key === 'accept') S(g).groups[c.group].owe += 1;
      closeCase(g, c, 'done', key);
      return { ok: true, text: key === 'accept' ? '献金を受け取った。' : '献金を丁寧に断った。', lines };
    },
    expire(g, c) { return `${groupName(g, c.group)}の献金の申し出は、返事がないまま流れた`; },
  },
  offer_endorse: {
    options(g, c) {
      const def = GROUP_DEFS[c.group];
      return [
        { key: 'accept', label: '推薦を受ける', desc: '選挙で団体の組織票が動く。団体との関係が深まる', cost: {}, fx: { sup: 5, local: 2 + influenceOf(g, c.group) / 25, seg: { [def.seg]: 0.8 }, standing: 1, campaign: 1 + Math.round(influenceOf(g, c.group) / 20), coll: 1, scandal: def.radical && roll(0.35) ? 3 : 0, scandalText: '過激な団体との関係が報じられた' } },
        { key: 'decline', label: '推薦は辞退する', desc: '特定の団体に頼らない立場を示す', cost: {}, fx: { sup: -3, an: 3 } },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      const role = groupsRole(g);
      const lines = applyFx(g, opt.fx, { id: c.group, role, domain: c.domain });
      const sp = special(g, { g, id: c.group, def: GROUP_DEFS[c.group], grp: S(g).groups[c.group], role }, opt.fx, true);
      if (sp.length) lines.push(...sp);
      closeCase(g, c, 'done', key);
      return { ok: true, text: key === 'accept' ? '団体の推薦を受けた。' : '推薦を辞退した。', lines };
    },
    expire(g, c) { return `${groupName(g, c.group)}の推薦の申し出は流れた`; },
  },
  offer_amb: {
    options(g, c) {
      return [
        { key: 'accept', label: `${c.data.role}を引き受ける`, desc: '出演・宣伝で体力を使う。知名度とファンが増え、団体の支持も上がる', cost: { stamina: 12 }, fx: { sup: 9, an: -5, fame: Math.max(3, Math.round(groupsRole(g).fame * 0.015)), fans: Math.round(groupsRole(g).fame * 0.05) + 3, money: Math.round(30000 * (1 + groupsRole(g).fame / 800)) } },
        { key: 'decline', label: '丁寧に断る', desc: 'スケジュールや立場の都合で辞退する', cost: {}, fx: { sup: -2 } },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, c.domain);
      const lines = applyFx(g, opt.fx, { id: c.group, role: groupsRole(g), domain: c.domain });
      closeCase(g, c, 'done', key);
      if (key === 'accept') { glog(g, c.group, `${c.data.role}を引き受けた`); S(g).groups[c.group].x.amb = today(g); }
      return { ok: true, text: key === 'accept' ? `${c.data.role}を引き受けた。` : '依頼を辞退した。', lines };
    },
    expire(g, c) { return `${groupName(g, c.group)}の${c.data.role}の依頼は流れた`; },
  },
  strike: {
    options(g, c) {
      const role = groupsRole(g);
      const emergencyOk = role.pm;
      return [
        { key: 'mediate', label: '労働委員会で調停させる', desc: '第三者のあっせん・調停で、労使の歩み寄りを探る（時間はかかるが傷は浅い）', cost: { stamina: 6 }, odds: 0.62, fx: {} },
        { key: 'concede', label: '賃上げ・条件改善を後押しする（経営側に要請）', desc: '経営側に歩み寄りを求める。組合は矛を収めやすいが、経営側は不満', cost: { stamina: 8 }, odds: 0.78, fx: {} },
        { key: 'hard', label: '「違法・不当なストは許さない」と強硬に出る', desc: '法的措置も辞さない構え。スト参加者は減るが、労使の対立は深まる', cost: { stamina: 6 }, odds: 0.5, fx: {} },
        { key: 'emergency', label: '緊急調整を決定する（労働関係調整法）', desc: '内閣総理大臣が緊急調整を決めると、50日間は争議行為ができない。組合の反発は非常に強い', cost: { stamina: 8 }, odds: 0.85, why: emergencyOk ? null : '緊急調整を決められるのは内閣総理大臣だけ', fx: {} },
        { key: 'watch', label: '静観する', desc: '当事者に任せる。ストが長引くほど経済に影響が出る', cost: {}, odds: 0.3, fx: {} },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような対応はない' };
      if (opt.why) return { ok: false, why: opt.why };
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, 'rengo');
      const s = S(g), u = s.union;
      const st = u.strikes.find((x) => x.id === c.data.strike);
      const ok = roll(opt.odds);
      const role = groupsRole(g);
      let fx = {}, text = '';
      const ren = s.groups.r_rengo && s.groups.r_rengo.on ? 'r_rengo' : 'r_domei';
      const biz = 'b_keizai';
      if (key === 'mediate') { fx = ok ? { sup: 3, an: -8 } : { an: 3 }; text = ok ? '調停がまとまり、ストは解除された。' : '調停は不調に終わった。ストは続いている。'; if (ok && st) endStrike(g, st, '調停'); }
      else if (key === 'concede') { fx = ok ? { sup: 6, an: -12, ap: 0.2 } : { sup: 2, an: -3 }; text = ok ? '経営側が一定の条件改善に応じ、ストは終わった。' : '経営側は譲らなかった。ストは続いている。'; if (ok && st) endStrike(g, st, '条件改善'); applyFx(g, ok ? { sup: -4, an: 6 } : { sup: -2, an: 3 }, { id: biz, role, domain: 'business' }); }
      else if (key === 'hard') { fx = ok ? { sup: -8, an: 14, ap: 0.2 } : { sup: -14, an: 24, ap: -0.5 }; text = ok ? '強い姿勢に、組合はストを中止した。対立のしこりは残る。' : '強硬策は逆効果になり、ストは拡大した。'; if (ok && st) endStrike(g, st, '強硬策'); else if (st) st.size = Math.min(3, (st.size || 1) + 1); applyFx(g, { sup: ok ? 4 : 0 }, { id: biz, role, domain: 'business' }); }
      else if (key === 'emergency') { fx = { sup: -20, an: 32, ap: -0.6, standing: -2 }; text = '緊急調整を決定した。50日間、争議行為は禁止される。'; if (st) endStrike(g, st, '緊急調整'); u.frozenUntil = today(g) + 50; }
      else { fx = { an: 4 }; text = '政府は静観した。'; if (st) st.size = Math.min(3, (st.size || 1) + (roll(0.3) ? 1 : 0)); }
      const lines = applyFx(g, fx, { id: ren, role, domain: 'rengo' });
      if (key !== 'watch') closeCase(g, c, 'done', key);
      else { c.due = today(g) + 8; }
      return { ok: true, text, lines, success: ok, keep: key === 'watch' };
    },
    expire(g, c) { const st = S(g).union.strikes.find((x) => x.id === c.data.strike); if (st && st.status === 'active') { st.size = Math.min(3, (st.size || 1) + 1); } return `${c.title}は政府の対応がないまま、長引いている`; },
  },
  scandal: {
    options(g, c) {
      return [
        { key: 'investigate', label: '第三者委員会で調べさせる', desc: '独立した調査を求める。短期的には痛いが、信頼は戻る', cost: { stamina: 6 }, odds: 0.8, fx: {} },
        { key: 'defend', label: '団体を擁護する', desc: '「個別の問題だ」と擁護。団体は喜ぶが、世論は批判的になる', cost: { stamina: 4 }, odds: 0.5, fx: {} },
        { key: 'distance', label: '距離を置く（関係を見直す）', desc: '団体と距離を置く。世論は評価するが、団体は反発する', cost: { stamina: 3 }, odds: 0.85, fx: {} },
        { key: 'ignore', label: 'コメントしない', desc: '何もしない。報道が収まるのを待つ', cost: {}, odds: 0.4, fx: {} },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような対応はない' };
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, c.domain);
      const ok = roll(opt.odds);
      const role = groupsRole(g);
      let fx = {}, text = '';
      if (key === 'investigate') { fx = ok ? { sup: 3, an: -4, ap: 0.3, cred: 2 } : { sup: -2, an: 4, ap: -0.2 }; text = ok ? '調査結果が公表され、再発防止策がまとまった。' : '調査は不十分と批判された。'; }
      else if (key === 'defend') { fx = ok ? { sup: 6, an: -6, ap: -0.1 } : { sup: 4, an: -3, ap: -0.7, scandal: 0.8, scandalText: '不祥事を擁護したと批判された' }; text = ok ? '擁護が受け入れられ、批判は静まった。' : '「身内をかばった」と批判を浴びた。'; }
      else if (key === 'distance') { fx = ok ? { sup: -7, an: 8, ap: 0.4 } : { sup: -9, an: 10, ap: 0.1 }; text = ok ? '距離を置く姿勢が評価された。' : '評価されたが、団体は強く反発した。'; }
      else { fx = ok ? { an: 1 } : { ap: -0.3, an: 2 }; text = ok ? '報道は収まった。' : '説明がないことが批判された。'; }
      const lines = applyFx(g, fx, { id: c.group, role, domain: c.domain });
      closeCase(g, c, 'done', key);
      return { ok: true, text, lines, success: ok };
    },
    expire(g, c) { applyFx(g, { ap: -0.3, an: 3 }, { id: c.group, role: groupsRole(g), domain: c.domain }); return `${c.title}は、政府が対応しないまま批判が続いた`; },
  },
  incident: {
    options(g, c) {
      return [
        { key: 'order', label: '警察・公安に対応を指示する', desc: '法に基づいて取り締まる。再発を防ぐが、団体は反発する', cost: { stamina: 6 }, odds: 0.75, fx: {} },
        { key: 'talk', label: '団体と話し合う窓口を開く', desc: '対話で沈静化を図る。会ったことが批判されるリスクも', cost: { stamina: 8 }, odds: 0.55, fx: {} },
        { key: 'statement', label: '遺憾の意を表明するだけにとどめる', desc: '静観に近い対応', cost: {}, odds: 0.4, fx: {} },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような対応はない' };
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, 'sect');
      const ok = roll(opt.odds);
      const role = groupsRole(g), grp = S(g).groups[c.group];
      let fx = {}, text = '';
      if (key === 'order') { fx = ok ? { sup: -8, an: 8, ap: 0.3, radical: -10, watch: 1 } : { sup: -10, an: 14, ap: -0.1, radical: 4 }; text = ok ? '取り締まりが進み、混乱は収まった。' : '取り締まりは空振りに終わり、反発が強まった。'; }
      else if (key === 'talk') { fx = ok ? { sup: 3, an: -10, radical: -12 } : { an: 6, radical: 3, scandal: roll(0.2) ? 1 : 0, scandalText: '過激な団体との対話が批判された' }; text = ok ? '話し合いで事態は収まった。' : '対話は不調に終わり、批判も出た。'; }
      else { fx = ok ? { an: 1 } : { ap: -0.3, radical: 5 }; text = ok ? '事態は自然に収まった。' : '対応のなさが批判された。'; }
      const lines = applyFx(g, fx, { id: c.group, role, domain: 'sect' });
      const sp = special(g, { g, id: c.group, def: GROUP_DEFS[c.group], grp, role }, fx, ok);
      if (sp.length) lines.push(...sp);
      closeCase(g, c, 'done', key);
      return { ok: true, text, lines, success: ok };
    },
    expire(g, c) { applyFx(g, { ap: -0.3 }, { id: c.group, role: groupsRole(g), domain: 'sect' }); const grp = S(g).groups[c.group]; if (grp) grp.x.radical = clamp(num(grp.x.radical) + 4, 0, 100); return `${c.title}は、対応がないまま長引いた`; },
  },
  fraud: {
    options(g, c) {
      return [
        { key: 'probe', label: '第三者機関で徹底的に調査する', desc: '研究公正の仕組みで調べる。研究界の信頼を守る', cost: { stamina: 6, gov: r0(5 * scaleOf(g)) }, odds: 0.85, fx: {} },
        { key: 'leave', label: '大学・研究機関の自主的な調査に任せる', desc: '現場に任せる。批判も出やすい', cost: {}, odds: 0.55, fx: {} },
        { key: 'cut', label: '研究費を一時止める（見せしめ）', desc: '厳しい姿勢を示す。研究界は萎縮する', cost: {}, odds: 0.7, fx: {} },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような対応はない' };
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, 'kenkyu');
      const ok = roll(opt.odds), s = S(g), role = groupsRole(g);
      let fx = {}, text = '';
      if (key === 'probe') { s.rd.integrity = clamp(s.rd.integrity + (ok ? 6 : 2), 0, 100); fx = ok ? { sup: 3, an: -3, ap: 0.2, cred: 3 } : { sup: -1, ap: -0.1 }; text = ok ? '調査で事実関係が明らかになり、再発防止策が示された。' : '調査は長引き、不信感が残った。'; }
      else if (key === 'leave') { fx = ok ? { an: 1 } : { ap: -0.3, sup: -3, cred: -3 }; s.rd.integrity = clamp(s.rd.integrity - (ok ? 0 : 4), 0, 100); text = ok ? '機関の調査で一応の決着がついた。' : '「身内に甘い」と批判された。'; }
      else { fx = { sup: -8, an: 12, ap: ok ? 0.2 : -0.2 }; s.rd.level = clamp(s.rd.level - 1.5, 0, 100); s.rd.young = clamp(s.rd.young - 3, 0, 100); text = '研究費の停止は、研究界に衝撃を与えた。'; }
      const lines = applyFx(g, fx, { id: c.group, role, domain: 'kenkyu' });
      closeCase(g, c, 'done', key);
      return { ok: true, text, lines, success: ok };
    },
    expire(g, c) { applyFx(g, { sup: -3, ap: -0.2, cred: -2 }, { id: c.group, role: groupsRole(g), domain: 'kenkyu' }); return `${c.title}は対応がないまま、研究界の不信が広がった`; },
  },
  protest: {
    options(g, c) {
      const free = c.domain === 'artist' || c.domain === 'yushikisha' || c.domain === 'kenkyu';
      return [
        { key: 'listen', label: '要望書を受け取り、対話の場を設ける', desc: '抗議を受け止めて話し合う。穏当な対応', cost: { stamina: 6 }, odds: 0.7, fx: {} },
        { key: 'statement', label: free ? '表現・学問の自由を重んじると表明する' : '意見を尊重すると表明する', desc: '声明を出す。批判は和らぐが、実質は変わらない', cost: { stamina: 3 }, odds: 0.6, fx: {} },
        { key: 'firm', label: '「決定は変えない」と突っぱねる', desc: '方針を貫く。支持層には評価されるが、抗議は広がる', cost: {}, odds: 0.45, fx: {} },
        { key: 'ignore', label: '何もしない', desc: '時間がたつのを待つ', cost: {}, odds: 0.3, fx: {} },
      ];
    },
    async resolve(g, c, key) {
      const opt = this.options(g, c).find((x) => x.key === key);
      if (!opt) return { ok: false, why: 'そのような対応はない' };
      const blk = costBlock(g, opt.cost);
      if (blk) return { ok: false, why: blk };
      payCost(g, opt.cost, c.domain);
      const ok = roll(opt.odds), role = groupsRole(g);
      let fx = {}, text = '';
      if (key === 'listen') { fx = ok ? { sup: 6, an: -12, ap: 0.2 } : { sup: 1, an: -3 }; text = ok ? '対話が進み、抗議は収まった。' : '話し合いは平行線に終わった。'; }
      else if (key === 'statement') { fx = ok ? { sup: 3, an: -6, ap: 0.1 } : { an: 2, ap: -0.1 }; text = ok ? '声明が評価され、批判は和らいだ。' : '「口先だけ」と受け取られた。'; }
      else if (key === 'firm') { fx = ok ? { sup: -6, an: 8, ap: 0.2 } : { sup: -10, an: 18, ap: -0.5 }; text = ok ? '方針を貫いた。支持層は評価している。' : '抗議が広がり、批判が強まった。'; }
      else { fx = ok ? { an: -1 } : { an: 4, ap: -0.2 }; text = ok ? '騒ぎは自然に収まった。' : '放置が批判された。'; }
      const lines = applyFx(g, fx, { id: c.group, role, domain: c.domain });
      closeCase(g, c, 'done', key);
      return { ok: true, text, lines, success: ok };
    },
    expire(g, c) { applyFx(g, { an: 5, ap: -0.2 }, { id: c.group, role: groupsRole(g), domain: c.domain }); return `${c.title}は、政府の反応がないまま広がった`; },
  },
};
function closeCase(g, c, status, key) {
  c.status = status;
  c.res = { key, day: today(g) };
  const s = S(g);
  s.caseLog.unshift({ id: c.id, kind: c.kind, group: c.group, domain: c.domain, title: c.title, day: today(g), status, key });
  if (s.caseLog.length > 40) s.caseLog.length = 40;
}
export function dueText(g, c) { const left = num(c.due) - today(g); return left <= 0 ? '今日まで' : `あと${left}日`; }
// the open cases (newest first) with their options for the screens
export function groupCases(g, o = {}) {
  const s = S(g);
  let list = s.cases.filter((c) => (o.all ? true : c.status === 'open'));
  if (o.group) list = list.filter((c) => c.group === o.group);
  if (o.domain) list = list.filter((c) => c.domain === o.domain);
  return list.map((c) => caseView(g, c, o.options !== false));
}
export function caseView(g, c, withOptions = true) {
  const H = CASE_KINDS[c.kind];
  const opts = withOptions && c.status === 'open' && H ? safe(() => H.options(g, c), []) || [] : [];
  const pv = opts.map((o) => {
    const blk = o.why || costBlock(g, o.cost);
    return { key: o.key, label: o.label, desc: o.desc, why: blk || null, costText: costText(g, o.cost), odds: o.odds == null ? null : r2(o.odds), lines: describeFx(o.fx, groupName(g, c.group)) };
  });
  return { id: c.id, kind: c.kind, group: c.group, groupName: groupName(g, c.group), domain: c.domain, title: c.title, text: c.text, day: c.day, due: c.due, left: num(c.due) - today(g), status: c.status, ask: c.ask || null, options: pv, res: c.res || null, data: c.data || null };
}
export async function caseAnswer(g, caseId, key, o = {}) {
  const s = S(g);
  const c = s.cases.find((x) => x.id === caseId);
  if (!c) return { ok: false, why: 'その案件はもうない' };
  if (c.status !== 'open') return { ok: false, why: 'その案件はもう終わっている' };
  const H = CASE_KINDS[c.kind];
  if (!H) return { ok: false, why: 'この案件は扱えない' };
  const role = groupsRole(g);
  if (c.kind === 'demand' && !roleHandles(role, c.domain, c.ask.kind)) return { ok: false, why: `この件を決められるのは、総理か担当の大臣（${ministerOf(g, c.domain)}）` };
  const r = await H.resolve(g, c, key, o);
  if (r && r.ok) { r.group = c.group; r.caseId = c.id; }
  return r;
}
// expire what is past due (called by the monthly step and the daily one)
function expireCases(g) {
  const s = S(g);
  const out = [];
  for (const c of s.cases) {
    if (c.status !== 'open' || num(c.due) >= today(g)) continue;
    const H = CASE_KINDS[c.kind];
    const t = H && H.expire ? safe(() => H.expire(g, c), '') : '';
    closeCase(g, c, 'expired', 'expired');
    if (t) { news(g, t, { domain: c.domain }); out.push(t); }
  }
  s.cases = s.cases.filter((c) => c.status === 'open' || today(g) - num(c.res && c.res.day, 0) < 60);
  return out;
}

// names of the politics core's policies that the groups mention (display only; the core owns the policies)
const POLICY_NAME = {
  tourism: '観光立国（ビザの緩和と受け入れ体制）', culture_ent: '文化芸術・エンタメの振興', research: '科学技術・研究への投資', space: '宇宙開発の推進', free_tuition: '高校・大学の授業料の無償化', scholarship: '返さなくていい奨学金の創設',
  education_reform: '教育改革', min_wage: '最低賃金の引き上げ', haken_dereg: '労働者派遣の規制緩和', irregular_protect: '非正規雇用の待遇改善', work_style: '長時間労働の上限規制', deregulation: '規制緩和と特区の推進', ir_casino: '統合型リゾート（IR）の整備',
  foreign_workers: '外国人労働者の受け入れ拡大', farm_import: '農産物の輸入自由化', farm_income: '農家への所得補償', fisheries: '漁業・林業の振興', gentan_end: 'コメの生産調整（減反）の廃止', fta: '経済連携協定（自由貿易）への参加',
  decentralize: '地方分権（税源の移譲）', municipal_merger: '市町村合併の推進', local_grant: '地方交付税の増額', public_works: '公共事業の拡大', public_works_cut: '公共事業の削減', disaster_prep: '防災・減災（国土強靱化）',
  civil_service_cut: '公務員の削減と給与の見直し', ministry_reorg: '中央省庁の再編', anti_yakuza: '暴力団排除の強化', pension_up: '年金の給付の拡充', pension_cut: '年金制度の改革', care_expand: '介護・福祉サービスの拡充', care_insurance: '介護保険制度の創設',
  medical_cost: '医療費の抑制', medical_copay: '高齢者医療の窓口負担の見直し', corp_tax_cut: '法人税率の引き下げ', corp_tax_up: '法人税の引き上げ', shohizei_up: '消費税率の引き上げ', shohizei_down: '消費税率の引き下げ', reduced_rate: '軽減税率の導入',
  stimulus: '大型の経済対策', fiscal_consolidation: '財政健全化', defense_up: '防衛費の増額', defense_cut: '防衛費の削減', security_law: '安全保障法制の整備', pko: '国際貢献（PKO）への参加', oda: 'ODAの拡充', amend_sdf: '憲法改正（自衛隊の明記）',
  amend_emergency: '憲法改正（緊急事態条項）', referendum_law: '国民投票法の制定', nuclear_promote: '原子力発電の活用', carbon_tax: '炭素税の導入', env_regulation: '環境規制の強化', capital_gains_tax: '金融所得課税の強化', inheritance_tax: '相続税の強化',
  mynumber: '共通番号制度（マイナンバー）', digital_gov: '行政手続きのオンライン化', police_up: '警察官の増員と防犯対策', conspiracy_law: '組織的犯罪の計画段階での処罰', child_allowance: '児童手当の拡充', furusato_tax: 'ふるさと納税の創設',
  same_sex_marriage: '同性婚の法制化', separate_surnames: '選択的夫婦別姓', free_childcare: '幼児教育・保育の無償化', postal_privatization: '郵政民営化', privatize_public: '公営事業の民営化',
};
export { POLICY_NAME };

// ================================================================ 観光地 (tourist sites)
export const SITE_KINDS = {
  onsen: { name: '温泉地', base: 60, fr: 1.0, frag: 0.3, culture: 0.3, season: [0.2, 0.0], cost: 1 },
  jokamachi: { name: '城下町・歴史の町', base: 55, fr: 1.4, frag: 0.4, culture: 0.8, season: [0.15, 0.3], cost: 1.1 },
  shizen: { name: '自然・絶景', base: 45, fr: 1.2, frag: 0.9, culture: 0.1, season: [0.35, 0.6], cost: 0.9 },
  isan: { name: '文化遺産の町', base: 40, fr: 1.8, frag: 0.7, culture: 1.0, season: [0.15, 0.3], cost: 1.3 },
  theme: { name: 'リゾート・テーマパーク', base: 90, fr: 0.9, frag: 0.2, culture: 0.0, season: [0.2, 0.0], cost: 2.2 },
  minato: { name: '港町・グルメの町', base: 55, fr: 1.0, frag: 0.3, culture: 0.3, season: [0.1, 0.1], cost: 0.9 },
  rito: { name: '離島', base: 28, fr: 0.8, frag: 1.0, culture: 0.2, season: [0.5, 0.5], cost: 1.4 },
  ski: { name: 'スキー・高原リゾート', base: 50, fr: 1.3, frag: 0.5, culture: 0.0, season: [0.5, 1.0], cost: 1.6 },
  matsuri: { name: '祭りの町', base: 45, fr: 0.9, frag: 0.3, culture: 0.7, season: [0.4, 0.2], cost: 0.8 },
  art: { name: 'アートの町', base: 35, fr: 1.1, frag: 0.3, culture: 0.6, season: [0.1, 0.1], cost: 0.9 },
};
export const SITE_REGIONS = {
  hokkaido: { name: '北海道', x: 0.74, y: 0.14 }, tohoku: { name: '東北', x: 0.68, y: 0.4 }, kanto: { name: '関東', x: 0.63, y: 0.5 }, chubu: { name: '中部', x: 0.52, y: 0.5 },
  kansai: { name: '近畿', x: 0.42, y: 0.6 }, chugoku: { name: '中国', x: 0.27, y: 0.66 }, shikoku: { name: '四国', x: 0.33, y: 0.8 }, kyushu: { name: '九州', x: 0.12, y: 0.83 },
};
const SITE_P1 = ['月見ヶ丘', '湯の花', '白砂', '碧瑠璃', '潮風', '雲海', '星降', '石畳', '千年', '七曲', '鶴ヶ', '紅葉谷', '霧笛', '淡雪', '夕凪', '百合ヶ原', '常盤', '朝霧', '花筏', '瑠璃ヶ浜', '風車', '藍染', '陽だまり', '松籟'];
const SITE_P2 = { onsen: ['温泉郷', '湯の里'], jokamachi: ['城下町', '宿場町'], shizen: ['高原', '渓谷', '岬'], isan: ['の古都', '遺跡の里'], theme: ['リゾート', 'ランド'], minato: ['港町', '漁港'], rito: ['島', '諸島'], ski: ['スキーリゾート', '高原'], matsuri: ['の里', '祭りの町'], art: ['アートの森', '芸術村'] };
// 訪日外客数（万人, 目安）: the real series up to 2025; the game's own afterwards
const INBOUND = [[1987, 216], [1990, 324], [1996, 384], [2000, 476], [2004, 614], [2008, 835], [2013, 1036], [2016, 2404], [2019, 3188], [2024, 3687], [2025, 4270], [2030, 5200]];
const FR_SHARE = [[1987, 0.03], [1996, 0.05], [2004, 0.09], [2013, 0.15], [2019, 0.3], [2026, 0.34]];
export function inboundMan(g) { return r0(anchorsAt(INBOUND, gdate(g).t) * tourMult(g)); }
function tourMult(g) {
  const s = S(g);
  let m = 1;
  const d = gdate(g);
  const p = polOf(g);
  const inForce = policiesInForce(p);
  if (inForce.has('tourism') && d.year >= 2000) m *= 1.06;
  if (inForce.has('ir_casino')) m *= 1.03;
  const promo = s.sites.filter((x) => x.status === 'designated');
  if (promo.length) m *= 1 + clamp(promo.reduce((a, x) => a + (num(x.promo) + num(x.infra)) / 200, 0) * 0.012, 0, 0.12);
  if (has(g, 'war') && safe(() => g.war(), null)) m *= 0.55;
  const rg = regime(g);
  if (rg && rg.id !== 'democracy') m *= rg.id === 'fallen' ? 0.4 : 0.8;
  if (has(g, 'disaster')) { const dz = safe(() => g.disaster(), null); if (dz && dz.phase && dz.phase !== 'done') m *= 0.88; }
  if (p && p.economy) m *= clamp(1 + (num(p.economy.yen, 130) - 130) / 130 * 0.12, 0.9, 1.12); // a weak yen draws visitors
  return clamp(m * num(s.flags.tourEvent, 1), 0.3, 1.6);
}
function siteName(kind, used) {
  for (let i = 0; i < 20; i++) {
    const n = pick(SITE_P1) + pick(SITE_P2[kind] || ['の町']);
    if (!used.has(n)) return n;
  }
  return pick(SITE_P1) + (SITE_P2[kind] || ['の町'])[0] + rint(2, 9);
}
function newSiteCandidate(g, s, kind) {
  const era = eraIdx(g);
  const kinds = Object.keys(SITE_KINDS).filter((k) => !(k === 'ski' && era === 3 && roll(0.3)));
  kind = kind || pick(kinds);
  const used = new Set([...s.sites, ...s.cands].map((x) => x.name));
  const reg = pick(Object.keys(SITE_REGIONS));
  const R = SITE_REGIONS[reg];
  const K = SITE_KINDS[kind];
  const pot = clamp(r0(35 + rnd() * 50 + (K.culture > 0.6 ? 5 : 0)), 30, 92);
  return { id: `s${s.siteSeq++}`, name: siteName(kind, used), kind, region: reg, x: clamp(R.x + (rnd() - 0.5) * 0.12, 0.04, 0.96), y: clamp(R.y + (rnd() - 0.5) * 0.1, 0.05, 0.95), pot, status: 'candidate', since: 0, infra: 10 + rint(0, 20), promo: 5, culture: r0(K.culture * 70 + rnd() * 20), vis: 0, fr: 0, inc: 0, sat: 60, crowd: 0, local: 55 + rint(-15, 15), gov: 40, env: 85, debt: 0, buzz: 5, owner: 'npc', pend: [], whl: { stage: 'none', until: 0 }, scandals: 0, dereg: 0, crowdCtl: 0, log: [], hist: [] };
}
// the derived numbers of a site (foreign share, crowding, satisfaction, income) from its visitors
function siteRecalc(g, x) {
  const d = gdate(g);
  x.fr = r2(frNow(g, x));
  x.crowd = clamp(r0((x.vis / siteCapacity(x)) * 70), 0, 100);
  x.sat = clamp(r0(78 - Math.max(0, x.crowd - 60) * 0.9 + x.infra * 0.12 - x.scandals * 2), 5, 100);
  const spend = 9000 + 6500 * clamp((d.year - 1987) / 39, 0, 1.2) + 4000 * x.fr;
  x.inc = r1((x.vis * 1000 * spend * 0.55) / 1e8);
}
function initTourism(g, s) {
  for (let i = 0; i < 3; i++) {
    const c = newSiteCandidate(g, s);
    c.status = 'designated'; c.since = -200 + i * 40; c.infra += 25; c.promo += 15; c.vis = r1(siteBase(g, c) * 0.5); c.owner = 'npc'; c.local = 60;
    siteRecalc(g, c);
    s.sites.push(c);
  }
  for (let i = 0; i < 3; i++) s.cands.push(newSiteCandidate(g, s));
}
function siteBase(g, x) {
  const K = SITE_KINDS[x.kind];
  const d = gdate(g);
  const t = d.t;
  const m = d.month - 1;
  const seasonal = 1 + K.season[0] * Math.sin(((m - 2) / 12) * Math.PI * 2) + K.season[1] * Math.sin(((m - 5) / 12) * Math.PI * 2) * 0.3;
  const attract = (x.pot / 100) * (0.45 + 0.35 * x.infra / 100 + 0.4 * x.promo / 100 + 0.25 * x.culture / 100 + 0.1 * x.buzz / 100);
  const fr = frNow(g, x);
  const inbound = anchorsAt(INBOUND, t) * tourMult(g) / anchorsAt(INBOUND, 2019);
  const p = polOf(g);
  const eco = p && p.economy ? clamp(1 + (num(p.economy.growth, 1) - 1) * 0.04, 0.85, 1.12) : 1;
  const boost = num(S(g).flags.eventBoostUntil) >= today(g) ? 1.15 : 1;
  return K.base * attract * 1.5 * ((1 - fr) * eco + fr * inbound * 1.6) * seasonal * boost;
}
function frNow(g, x) {
  const t = gdate(g).t;
  const K = SITE_KINDS[x.kind];
  return clamp(anchorsAt(FR_SHARE, t) * K.fr * (0.7 + 0.5 * x.promo / 100 + 0.25 * x.culture / 100) * (x.whl && x.whl.stage === 'inscribed' ? 1.35 : 1), 0.01, 0.7);
}
function siteCapacity(x) { const K = SITE_KINDS[x.kind]; return (30 + 0.9 * x.infra + 18 * (x.crowdCtl || 0)) * (K.base / 55); }
export function siteView(g, x) {
  const K = SITE_KINDS[x.kind];
  return { id: x.id, name: x.name, kind: x.kind, kindName: K.name, region: x.region, regionName: SITE_REGIONS[x.region].name, x: x.x, y: x.y, pot: x.pot, status: x.status, owner: x.owner, since: x.since, infra: r0(x.infra), promo: r0(x.promo), culture: r0(x.culture), vis: r1(x.vis), fr: r2(x.fr), inc: r1(x.inc), sat: r0(x.sat), crowd: r0(x.crowd), local: r0(x.local), gov: r0(x.gov), env: r0(x.env), debt: r1(x.debt), buzz: r0(x.buzz), whl: x.whl, pend: x.pend.map((p) => ({ kind: p.kind, text: p.text, left: Math.max(0, p.until - today(g)) })), scandals: x.scandals, dereg: x.dereg, crowdCtl: x.crowdCtl, log: x.log.slice(0, 6), over: x.crowd >= 75, hist: x.hist.slice(-12), cost: designateCost(g, x), stars: Math.max(1, Math.min(5, Math.round(x.pot / 20))) };
}
function designateCost(g, x) { return r0(40 * SITE_KINDS[x.kind].cost * scaleOf(g)); }
function slog(x, g, text) { x.log.unshift({ day: today(g), text }); if (x.log.length > 10) x.log.length = 10; }
// the monthly step of every designated site
function tourismMonthly(g, s) {
  const d = gdate(g);
  let totalInc = 0, totalFr = 0;
  for (const x of s.sites) {
    if (x.status !== 'designated') continue;
    // projects finishing
    for (const pj of x.pend.slice()) if (pj.until <= today(g)) {
      x.pend.splice(x.pend.indexOf(pj), 1);
      if (pj.kind === 'infra') { x.infra = clamp(x.infra + pj.gain, 0, 100); x.env = clamp(x.env - 3 * pj.gain / 12, 0, 100); slog(x, g, `整備が完成（受け入れ環境 +${pj.gain}）`); news(g, `${x.name}の整備工事が完成。宿泊・交通の受け入れ能力が上がった`, { domain: 'tourism', feed: false }); }
      else if (pj.kind === 'promo') { x.promo = clamp(x.promo + pj.gain, 0, 100); x.buzz = clamp(x.buzz + 8, 0, 100); slog(x, g, `プロモーションの効果（宣伝力 +${pj.gain}）`); }
      else if (pj.kind === 'whl') {
        const ok = roll(pj.odds);
        x.whl = { stage: ok ? 'inscribed' : 'rejected', until: today(g) + (ok ? 0 : 90) };
        if (ok) { x.pot = clamp(x.pot + 14, 0, 100); x.buzz = clamp(x.buzz + 30, 0, 100); x.culture = clamp(x.culture + 8, 0, 100); news(g, `${x.name}が世界遺産に登録された。観光客の増加が見込まれる`, { domain: 'tourism' }); phoneMsg(g, `【ニュース】${x.name}が世界遺産に登録。地元は祝賀ムード`, 'ドット新聞 社会部'); }
        else { slog(x, g, '世界遺産への登録は見送りに'); news(g, `${x.name}の世界遺産への登録は今回は見送りに`, { domain: 'tourism', feed: false }); }
      }
    }
    // decay of attention, the visitors, the capacity
    x.promo = clamp(x.promo - 0.7, 0, 100);
    x.buzz = clamp(x.buzz * 0.9, 0, 100);
    const target = siteBase(g, x) * (x.dereg ? 1 + 0.08 * x.dereg : 1) * (x.crowdCtl ? 1 - 0.06 * x.crowdCtl : 1) * (x.crowd >= 85 ? 0.88 : 1);
    x.vis = r1(x.vis + (target - x.vis) * 0.4);
    siteRecalc(g, x);
    x.local = clamp(x.local + (x.inc > 2 ? 0.8 : 0.2) - (x.crowd > 75 ? 2.2 : 0) - (x.dereg ? 0.8 * x.dereg : 0) + (x.crowdCtl ? 0.8 * x.crowdCtl : 0) + (x.gov - 40) / 80, 5, 100);
    x.env = clamp(x.env + (x.crowd > 80 ? -1.5 : 0.25) - SITE_KINDS[x.kind].frag * (x.crowd > 70 ? 0.8 : 0), 5, 100);
    x.gov = clamp(x.gov - 0.5, 0, 100);
    if (x.debt > 0) { x.debt = r1(Math.max(0, x.debt - x.inc * 0.04)); if (x.vis < siteBase(g, { ...x, infra: x.infra }) * 0.3 && x.debt > 20) x.local = clamp(x.local - 1, 0, 100); }
    x.hist.push(x.vis); if (x.hist.length > 24) x.hist.shift();
    totalInc += x.inc; totalFr += x.vis * x.fr;
    // events (at most one per site per month, rare)
    if (x.crowd >= 78 && roll(0.18)) {
      x.scandals += 0.5; slog(x, g, 'オーバーツーリズムの苦情');
      news(g, `${x.name}で観光客の混雑・マナーが問題に。住民から対策を求める声`, { domain: 'tourism' });
      addGriev(s.groups.t_jumin, `jam:${x.id}`, `${x.name}の混雑とマナー`, 30);
    } else if (x.debt > 25 && x.vis < 10 && d.year <= 2003 && roll(0.12)) {
      x.scandals += 1; slog(x, g, '第三セクターの経営が行き詰まった');
      news(g, `${x.name}のリゾート開発の第三セクターが経営難。自治体の負担が重くのしかかる`, { domain: 'tourism' });
      x.local = clamp(x.local - 8, 0, 100);
    } else if (roll(0.05)) {
      x.buzz = clamp(x.buzz + 25, 0, 100); slog(x, g, '映像やSNSで話題に');
      news(g, `${x.name}が${d.year >= 2010 ? 'SNS' : 'テレビ'}で話題に。問い合わせが急増`, { domain: 'tourism', feed: false });
    }
  }
  s.flags.tourInc = r1(totalInc);
  s.flags.tourFr = r1(totalFr);
  // new candidates are proposed now and then
  if (s.cands.length < 4 && roll(0.4)) s.cands.push(newSiteCandidate(g, s));
  if (s.cands.length > 5) s.cands.shift();
  // national effects: local income lifts the rural / self-employed votes a little; the economy gets a small, refreshed push
  const n = s.sites.filter((x) => x.status === 'designated' && x.owner === 'player').length;
  if (n) pushShock(g, 'tourism', '観光地の消費', { growth: clamp(totalInc / 400, 0, 0.12) }, 60);
  else dropShock(g, 'tourism');
}
export function tourismSummary(g) {
  const s = S(g);
  const d = gdate(g);
  const sites = s.sites.filter((x) => x.status === 'designated');
  const over = sites.filter((x) => x.crowd >= 75).length;
  return {
    agency: tourismAgency(g), brand: tourismBrand(g), inboundMan: inboundMan(g), inboundBase: r0(anchorsAt(INBOUND, d.t)), frShare: r2(anchorsAt(FR_SHARE, d.t)), sites: sites.length, mine: sites.filter((x) => x.owner === 'player').length,
    income: r1(s.flags.tourInc || 0), foreignK: r1(s.flags.tourFr || 0), over, avgSat: sites.length ? r0(sites.reduce((a, x) => a + x.sat, 0) / sites.length) : 0, cands: s.cands.length,
    resort: d.year >= 1987 && d.year < 1993 ? 'リゾート法（1987年〜）のもとでリゾート開発ブーム。ただし、バブルが崩れると第三セクターの破綻が相次いだ（実際の歴史）。' : null,
    overNote: d.year >= 2017 ? 'オーバーツーリズム（観光客の集中で住民の暮らしや環境が損なわれること）が問題になっている。' : null,
    law: since(g, 20070101) ? '観光立国推進基本法（2007年〜）' : null,
    heritageOk: since(g, 19920630),
  };
}
export function sitesList(g, o = {}) {
  const s = S(g);
  const list = o.cands ? s.cands : s.sites.filter((x) => x.status === 'designated');
  return list.map((x) => siteView(g, x));
}
// site actions: designate (a candidate), infra, promo, dereg, crowd, whl (世界遺産), coord (地元と連携), withdraw
export function siteActionsList(g, id) {
  const s = S(g);
  const x = s.sites.find((q) => q.id === id) || s.cands.find((q) => q.id === id);
  if (!x) return [];
  return ['designate', 'infra', 'promo', 'dereg', 'crowd', 'whl', 'coord', 'withdraw'].map((k) => siteActionPreview(g, id, k)).filter((p) => p.applies);
}
export function siteActionPreview(g, id, kind, optKey) {
  const s = S(g), role = groupsRole(g);
  const x = s.sites.find((q) => q.id === id) || s.cands.find((q) => q.id === id);
  const bad = (why, extra = {}) => ({ ok: false, applies: false, why, id: kind, ...extra });
  if (!x) return bad('その観光地はない');
  const K = SITE_KINDS[x.kind];
  const cand = x.status === 'candidate';
  const sc = scaleOf(g) * (role.kind === 'local' ? 0.15 : 1);
  const ctrl = role.pm || (role.kind === 'minister' && domainControl(role, 'tourism') === 'full') || role.kind === 'local';
  const whyRole = ctrl ? null : `観光地を動かせるのは、総理か担当の大臣（${ministerOf(g, 'tourism')}）、または自治体の首長`;
  const mk = (name, desc, cost, odds, lines, o = {}) => {
    const why = o.why || (x.status === 'withdrawn' ? 'この観光地は指定を解除された' : null) || whyRole || costBlock(g, cost);
    return { ok: true, applies: o.applies !== false, id: kind, site: id, name, short: name, desc, cost, costText: costText(g, cost), odds: odds == null ? null : r2(odds), lines, why, pro: o.pro || [], con: o.con || [], options: o.options || null, opt: o.opt || null };
  };
  const agency = tourismAgency(g);
  const tK = s.groups.t_kyokai, tJ = s.groups.t_jumin;
  switch (kind) {
    case 'designate': {
      const odds = clamp(0.58 + 0.2 * relQ(tK) - 0.3 * (num(tJ.an) / 100) + (x.local - 55) / 160, 0.1, 0.95);
      return mk('観光地に指定する', `${x.name}を観光地として指定し、整備と宣伝の対象にする（${agency}・自治体と連携）。`, { gov: designateCost(g, x), stamina: 8 }, odds, ['指定すると、受け入れ環境の整備・宣伝ができるようになる', `魅力 ${'★'.repeat(Math.max(1, Math.min(5, Math.round(x.pot / 20))))}・地元の賛成 ${r0(x.local)}`, d1(g) ? 'リゾート法（1987年〜）の基本構想として、民間投資も呼び込める' : ''].filter(Boolean), { applies: cand, pro: ['「町おこしになる。人が来れば仕事も生まれる」（観光協会）'], con: ['「観光客が増えて、静かな暮らしが壊れる」（住民団体）'] });
    }
    case 'infra': {
      const opts = TIER_NAMES.map((l, i) => ({ key: `t${i}`, tier: i, label: `${l}（受け入れ環境 +${[8, 14, 22][i]}）` }));
      const opt = opts.find((o) => o.key === optKey) || opts[0];
      const gov = r0([60, 160, 380][opt.tier] * K.cost * sc);
      return mk('施設を整備する', '道路・駐車場・宿泊・案内表示・トイレなど、受け入れ環境を整える。完成まで30日。', { gov, stamina: 6 }, 0.95, [`受け入れ環境 +${[8, 14, 22][opt.tier]}（容量が増え、混雑に強くなる）`, '工事で自然環境に負担がかかる', since(g, 19870609) && gdate(g).year < 1993 ? '第三セクター方式で借金をすると、バブル崩壊後に重荷になる' : ''].filter(Boolean), { applies: !cand, options: opts, opt, pro: ['「混雑も減り、お客さんも快適に」（観光協会）'], con: ['「環境に負担。公共事業のばらまきでは」（住民団体）'] });
    }
    case 'promo': {
      const opts = TIER_NAMES.map((l, i) => ({ key: `t${i}`, tier: i, label: `${l}（宣伝力 +${[8, 16, 28][i]}）` }));
      const opt = opts.find((o) => o.key === optKey) || opts[0];
      const gov = r0([15, 45, 110][opt.tier] * sc);
      return mk(`宣伝する（${tourismBrand(g)}）`, '国内外に向けたプロモーションを行う。完成（効果が出る）まで15日。', { gov, stamina: 4 }, 0.9, [`宣伝力 +${[8, 16, 28][opt.tier]}（時間とともに薄れる）`, '来すぎると混雑・マナーの問題が出る'], { applies: !cand, options: opts, opt, pro: ['「知ってもらえば、お客さんは来る」（旅館組合）'], con: ['「宣伝より住民のための対策を」（住民団体）'] });
    }
    case 'dereg': {
      const old = gdate(g).year;
      const label = old >= 2018 ? '民泊（住宅宿泊事業）を広げる' : old >= 2014 ? '特区で民泊を認める' : '営業時間・開発の規制をゆるめる';
      return mk('規制をゆるめる', `${label}。観光客は増えるが、住民と既存の宿の反発も。`, { stamina: 8 }, clamp(0.7 - 0.25 * (num(tJ.an) / 100) - (x.dereg ? 0.15 : 0), 0.15, 0.9), ['観光客の入込 +8%程度。住民の暮らし心地が下がる', x.dereg ? `すでに規制緩和 ${x.dereg}段階` : ''].filter(Boolean), { applies: !cand && x.dereg < 2, pro: ['「新しい宿泊の形が客を呼ぶ」（経済界）'], con: ['「騒音やごみが増える。町の暮らしが壊れる」（住民）', '「旅館が打撃を受ける」（旅館組合）'] });
    }
    case 'crowd': {
      const fee = gdate(g).year >= 2017 ? '宿泊税・入域料' : '入湯税・駐車料金';
      return mk('混雑対策をする', `予約制・入場制限・${fee}・時間分散などで、混雑とマナー問題を抑える。`, { gov: r0(15 * sc), stamina: 6 }, 0.85, ['混雑が減り、住民の支持と満足度が上がる', '入込客は少し減る（観光協会は渋い顔）'], { applies: !cand && x.crowdCtl < 3, pro: ['「静かな暮らしを守れる」（住民）', '「質の高い観光へ」（有識者）'], con: ['「客が減って商売あがったり」（旅館・商店）'] });
    }
    case 'whl': {
      const why = !since(g, 19920630) ? '日本が世界遺産条約を結ぶのは1992年。この時代は国内の文化財の指定・保存までしかできない' : x.culture < 55 ? '文化の価値の水準が足りない（文化度 55以上が目安）' : x.pot < 60 ? '観光地としての魅力が足りない（魅力 60以上が目安）' : x.infra < 30 ? '保護と受け入れの体制が足りない（整備 30以上が目安）' : x.whl && x.whl.stage === 'inscribed' ? 'すでに登録された' : x.whl && x.whl.stage === 'tentative' ? '申請の審査中' : x.whl && x.whl.until > today(g) ? '前回の見送りから間もない' : null;
      const odds = clamp(0.2 + (x.culture - 55) / 120 + (x.env - 60) / 200 + x.local / 400 - x.scandals * 0.05, 0.05, 0.85);
      return mk('世界遺産に申請する', '暫定リストへの記載から、推薦・審査へ。結果が出るまで約240日。登録されれば魅力と話題性が大きく上がる。', { gov: r0(12 * sc), stamina: 8 }, odds, ['環境の保全・住民の合意・保護の体制が審査される', '登録後は保全の義務と、観光客の集中に注意'], { applies: !cand, why: why || (whyRole ? whyRole : null), pro: ['「世界に認められる価値のある町」（文化財保存会）'], con: ['「規制が増えて、暮らしが不便になる」（住民）'] });
    }
    case 'coord': {
      return mk('知事・区長と連携する', '地元の首長と協議し、計画を共有して地元の理解を得る。', { stamina: 8 }, 0.85, ['地元との連携 +、地元の支持 +'], { applies: !cand, why: role.kind === 'citizen' && !role.ent ? '面会の取りつぎがない' : null, pro: ['「国と地元が同じ方向を向ける」（首長）'], con: ['「結局、国の言いなりだ」（議会の一部）'] });
    }
    case 'withdraw': {
      return mk('指定を解除する', '観光地の指定を解除し、国の支援をやめる。', { stamina: 4 }, 1, ['解除すると宣伝・整備の対象から外れる', '地元の支持は大きく下がる'], { applies: !cand && x.owner !== 'npc' });
    }
    default: return bad('そのような行動はない');
  }
}
const d1 = (g) => gdate(g).n >= 19870609 && gdate(g).n < 19950101;
export function siteAct(g, id, kind, opts = {}) {
  const s = S(g);
  const pv = siteActionPreview(g, id, kind, opts.option || opts.opt);
  if (!pv.ok || !pv.applies) return { ok: false, why: pv.why || 'できない' };
  if (pv.why) return { ok: false, why: pv.why };
  const x = s.sites.find((q) => q.id === id) || s.cands.find((q) => q.id === id);
  const role = groupsRole(g);
  payCost(g, pv.cost, 'tourism');
  const ok = pv.odds == null ? true : roll(pv.odds);
  const tK = s.groups.t_kyokai, tJ = s.groups.t_jumin;
  let text = '', fx = {};
  const tier = pv.opt && pv.opt.tier != null ? pv.opt.tier : 0;
  if (kind === 'designate') {
    if (ok) {
      s.cands = s.cands.filter((q) => q.id !== id);
      x.status = 'designated'; x.owner = 'player'; x.since = today(g); x.vis = r1(siteBase(g, x) * 0.4); siteRecalc(g, x); x.local = clamp(x.local + 6, 0, 100); x.gov = clamp(x.gov + 20, 0, 100);
      s.sites.push(x);
      text = `${x.name}を観光地に指定した。整備と宣伝で、訪れる人を増やそう。`;
      fx = { sup: 5, an: -4, ap: 0.2, seg: { selfemployed: 0.5, rural: 0.5 } };
      news(g, `${x.name}が観光地に指定された（${tourismAgency(g)}・自治体）`, { domain: 'tourism' });
      slog(x, g, '観光地に指定');
    } else { x.local = clamp(x.local - 8, 0, 100); text = `${x.name}の住民の反対が強く、指定は見送りになった。`; fx = { sup: -2, an: 3 }; addGriev(tJ, `des:${x.id}`, `${x.name}の指定をめぐる不安`, 25); }
  } else if (kind === 'infra') {
    const gain = [8, 14, 22][tier];
    x.pend.push({ kind: 'infra', until: today(g) + 30, gain, text: `施設整備（受け入れ環境 +${gain}）` });
    if (d1(g) && roll(0.5)) { x.debt = r1(x.debt + pv.cost.gov * 0.5); }
    text = `${x.name}の整備工事を始めた（約30日）。`;
    fx = { sup: 3, an: -2, ap: 0.05 };
  } else if (kind === 'promo') {
    const gain = [8, 16, 28][tier];
    x.pend.push({ kind: 'promo', until: today(g) + 15, gain, text: `宣伝の展開（宣伝力 +${gain}）` });
    text = `${x.name}の宣伝を始めた（約15日で効果）。`;
    fx = { sup: 3, an: -2 };
  } else if (kind === 'dereg') {
    if (ok) { x.dereg += 1; x.local = clamp(x.local - 6, 0, 100); text = `${x.name}の規制をゆるめた。観光客は増えそうだが、住民の不安もある。`; fx = { sup: 5, an: -3, ap: 0.05 }; applyFx(g, { an: 8, sup: -3 }, { id: 't_yado', role }); }
    else { text = '調整がつかず、規制の見直しは進まなかった。'; fx = { sup: -1, an: 4 }; x.local = clamp(x.local - 3, 0, 100); }
  } else if (kind === 'crowd') {
    if (ok) { x.crowdCtl += 1; x.local = clamp(x.local + 6, 0, 100); x.crowd = clamp(x.crowd - 12, 0, 100); text = `${x.name}で混雑対策を始めた。`; fx = { sup: -1, an: 0, ap: 0.1 }; applyFx(g, { sup: 6, an: -8 }, { id: 't_jumin', role }); }
    else { text = '対策の調整がつかなかった。'; fx = { an: 3 }; }
  } else if (kind === 'whl') {
    x.whl = { stage: 'tentative', until: today(g) + 240 };
    x.pend.push({ kind: 'whl', until: today(g) + 240, odds: pv.odds, text: '世界遺産の審査' });
    text = `${x.name}の世界遺産への申請を始めた（結果は約240日後）。`;
    fx = { sup: 3, ap: 0.05 };
  } else if (kind === 'coord') {
    x.gov = clamp(x.gov + 25, 0, 100); x.local = clamp(x.local + 6, 0, 100);
    text = `${x.name}の首長と協議し、計画を共有した。地元の理解が進んだ。`;
    fx = { sup: 3, an: -3, ap: 0.05 };
  } else if (kind === 'withdraw') {
    x.status = 'withdrawn'; s.sites = s.sites.filter((q) => q.id !== id); x.local = clamp(x.local - 25, 0, 100);
    text = `${x.name}の指定を解除した。`; fx = { sup: -5, an: 8, ap: -0.1 };
  }
  const lines = applyFx(g, fx, { id: 't_kyokai', role, domain: 'tourism' });
  return { ok: true, success: ok, text, lines, odds: pv.odds };
}

// ================================================================ 連合・春闘・最低賃金・ストライキ
const SHUNTO = [[1987, 3.56], [1989, 5.17], [1991, 5.66], [1993, 3.9], [1996, 2.86], [2000, 2.06], [2004, 1.67], [2008, 1.99], [2013, 1.78], [2018, 2.07], [2022, 2.07], [2023, 3.58], [2024, 5.1], [2025, 5.25], [2030, 4.0]];
const UNION_RATE = [[1987, 28.2], [1996, 23.2], [2004, 19.2], [2024, 16.1], [2030, 15]];
const MINWAGE = [[1987, 440], [1996, 590], [2004, 665], [2013, 764], [2019, 901], [2023, 1004], [2025, 1121], [2030, 1300]];
export const shuntoAnchor = (g) => anchorsAt(SHUNTO, gdate(g).t);
export const minWageNow = (g) => r0(anchorsAt(MINWAGE, gdate(g).t) + num(S(g).union.minWageAdd));
const STRIKE_SCOPES = [{ id: 'transport', name: '鉄道・バスなどの交通', eco: 0.18 }, { id: 'retail', name: '百貨店・スーパー', eco: 0.05 }, { id: 'medical', name: '病院・介護施設の一部', eco: 0.06 }, { id: 'factory', name: '製造業の工場', eco: 0.14 }];
function initUnion(g, s) { s.union.rate = r1(anchorsAt(UNION_RATE, gdate(g).t)); s.union.minWage = minWageNow(g); }
function unionGroupId(s) { return s.groups.r_rengo && s.groups.r_rengo.on ? 'r_rengo' : 'r_somei'; }
function unionMonthly(g, s) {
  const d = gdate(g), u = s.union, sh = u.shunto;
  const p = polOf(g);
  const E = p && p.economy ? p.economy : { growth: 1, inflation: 0.5, unemployment: 2.8 };
  u.rate = r1(anchorsAt(UNION_RATE, d.t) + num(u.rateMod));
  u.minWage = minWageNow(g);
  const rid = unionGroupId(s);
  const ren = s.groups[rid];
  const base = shuntoAnchor(g);
  if (d.month === 1 && sh.year !== d.year) {
    sh.year = d.year; sh.stage = 'demand';
    sh.dem = r1(Math.max(1, base + 1.1 + (num(E.inflation) - 1) * 0.25 + num(ren && ren.an) / 80));
    sh.offer = r1(Math.max(0.5, base + (num(E.growth) - 1) * 0.15 + (num(E.inflation) - 1) * 0.2 - 0.2 + num(sh.nextBoost)));
    sh.nextBoost = 0; sh.settled = 0; sh.day = today(g);
    news(g, `春闘が始まる。${groupName(g, rid)}は${sh.dem}%程度の賃上げを要求${d.year >= 2013 ? '（政労使会議でも賃上げが議題に）' : ''}`, { domain: 'rengo' });
  } else if (d.month === 2 && sh.stage === 'demand') {
    sh.stage = 'talks';
    news(g, '春闘の交渉が本格化。経営側は「業績と物価を見て判断」', { domain: 'rengo', feed: false });
  } else if (d.month === 3 && (sh.stage === 'talks' || sh.stage === 'demand') && sh.year === d.year) {
    const biz = s.groups.b_keizai;
    sh.settled = r1(clamp(sh.offer + (rnd() - 0.5) * 0.5 - num(biz && biz.an) / 300 + (num(ren && ren.s) / 100) * 0.1, 0.3, 9));
    sh.stage = 'settled';
    const gap = r1(sh.dem - sh.settled);
    u.results.unshift({ year: d.year, dem: sh.dem, settled: sh.settled });
    if (u.results.length > 12) u.results.length = 12;
    news(g, `春闘は集中回答日。大手の賃上げは平均${sh.settled}%（要求${sh.dem}%）`, { domain: 'rengo' });
    const ttrend = anchorsAt(SHUNTO, d.t);
    pushShock(g, 'wage', '春闘の賃上げ', { growth: clamp((sh.settled - ttrend) * 0.05, -0.15, 0.2), inflation: clamp((sh.settled - ttrend) * 0.06, -0.15, 0.25) }, 150);
    if (ren) {
      const dsup = clamp((sh.settled - sh.dem) * 3 + 2, -10, 6);
      ren.gw = clamp(ren.gw + dsup, -80, 80);
      if (gap >= 1) addGriev(ren, `shunto:${d.year}`, `春闘の回答が要求を${gap}ポイント下回った`, 25 + gap * 8);
    }
    // a strike? rare in Japan, but possible when the gap is wide and the union is angry
    const pStrike = gap >= 1.0 && ren ? clamp(0.03 + 0.012 * (gap - 1) * 10 + (num(ren.an) - 35) / 500, 0, 0.22) : 0;
    if (pStrike > 0 && today(g) - u.lastStrike > 60 && roll(pStrike)) startStrike(g, s);
  } else if (d.month >= 5 && sh.stage === 'settled') sh.stage = 'none';
  // the union's own quiet: the rate of organisation shapes its influence
  if (ren) ren.infMod = clamp(ren.infMod + (u.rate - anchorsAt(UNION_RATE, d.t)) * 0.2, -30, 30);
  if (u.frozenUntil && u.frozenUntil < today(g)) u.frozenUntil = 0;
}
export function startStrike(g, s = S(g)) {
  const u = s.union;
  if (u.frozenUntil && u.frozenUntil > today(g)) return null;
  if (u.strikes.some((x) => x.status === 'active')) return null;
  const sc = pick(STRIKE_SCOPES);
  const st = { id: `k${++u.nStrikes}`, day: today(g), scope: sc.id, name: sc.name, size: 1, days: 0, status: 'active', len: rint(10, 24) };
  u.strikes.unshift(st); if (u.strikes.length > 8) u.strikes.length = 8;
  u.lastStrike = today(g);
  const rid = unionGroupId(s);
  const lead = s.groups[rid].leaders[0];
  news(g, `${sc.name}でストライキ。利用者・住民に影響`, { domain: 'rengo' });
  phoneMsg(g, `【ニュース】${sc.name}でストライキが始まった。生活への影響が出ている`, 'ドット新聞 社会部');
  if (!roleHandles(groupsRole(g), 'rengo', 'law')) return st;
  const c = { id: `c${s.seq++}`, kind: 'strike', group: rid, domain: 'rengo', title: `${sc.name}でストライキ`, text: `春闘の回答に納得できない${groupName(g, rid)}傘下の組合が、${sc.name}でストライキに入った。${lead.title}・${lead.name}：「誠意ある回答がない限り続ける」`, day: today(g), due: today(g) + 12, status: 'open', data: { strike: st.id }, res: null };
  st.case = c.id;
  s.cases.unshift(c);
  return st;
}
function endStrike(g, st, how) {
  if (!st || st.status !== 'active') return;
  st.status = 'ended'; st.how = how; st.endDay = today(g);
  dropShock(g, 'strike');
  news(g, `${st.name}のストライキが終わった（${how}）`, { domain: 'rengo', feed: false });
  const c = S(g).cases.find((x) => x.id === st.case);
  if (c && c.status === 'open') closeCase(g, c, 'done', 'ended');
}
function strikeDaily(g, s) {
  const st = s.union.strikes.find((x) => x.status === 'active');
  if (!st) return;
  st.days++;
  const sc = STRIKE_SCOPES.find((x) => x.id === st.scope) || STRIKE_SCOPES[0];
  pushShock(g, 'strike', 'ストライキの影響', { growth: -sc.eco * st.size * 0.5 }, 12);
  const role = groupsRole(g);
  if (role.cabinet && st.days % 4 === 0) moodAdd(g, -0.12 * st.size, 'ストライキによる生活への影響');
  if (st.days >= st.len) endStrike(g, st, st.days >= st.len ? '労使が合意' : '');
}
export function unionSummary(g) {
  const s = S(g), u = s.union, sh = u.shunto, d = gdate(g);
  const rid = unionGroupId(s);
  const merged = d.n >= 19891121;
  return {
    id: rid, name: groupName(g, rid), rate: u.rate, minWage: u.minWage, shunto: { ...sh, label: { none: '春闘のあいだ（来年1月から）', demand: '要求を提出（1月）', talks: '交渉中（2〜3月）', settled: '妥結（3月）' }[sh.stage] || '—', trend: r1(shuntoAnchor(g)) },
    results: u.results.slice(0, 6), strikes: u.strikes.slice(0, 3).map((x) => ({ ...x })), activeStrike: u.strikes.find((x) => x.status === 'active') || null,
    center: merged ? '連合（1989年11月〜）' : '総評・同盟などの分立', frozen: u.frozenUntil && u.frozenUntil > today(g) ? u.frozenUntil - today(g) : 0,
    note: '公務員は争議権がなく、人事院勧告で給与が決まる（国家公務員法）。ストライキは民間の組合の権利。',
  };
}
// 最低賃金 via the government core: council → 政令 (g.issueOrdinance 'saichin')
export function minWageActions(g) {
  const role = groupsRole(g);
  const out = [];
  const councils = has(g, 'councils') ? safe(() => g.councils(), []) : [];
  const c = councils.find((x) => x.id === 'saichin');
  for (const [key, label] of [['up3', '目安どおり3%程度の引き上げ'], ['up5', '大幅な5%程度の引き上げ']]) {
    const why = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('ordinance', { id: 'saichin', option: key }), null) : '政府のしくみが読み込まれていない';
    out.push({ key, label, why, council: c ? c.status : null });
  }
  return { council: c || null, options: out, role: role.kind };
}
export async function minWageAct(g, key) {
  if (!has(g, 'issueOrdinance')) return { ok: false, why: '政府のしくみが読み込まれていない' };
  const acts = minWageActions(g);
  const o = acts.options.find((x) => x.key === key);
  if (!o) return { ok: false, why: 'そのような引き上げはない' };
  if (o.why) {
    // a missing 答申: the path is to ask the 審議会 first
    if (/審議会|答申|諮問/.test(String(o.why)) && has(g, 'councilConsult') && acts.council && acts.council.status !== 'pending') {
      const r = safe(() => g.councilConsult('saichin'), null);
      if (r && r.ok) return { ok: true, text: `先に中央最低賃金審議会に諮問した（${r.text || '答申を待つ'}）。答申が出たら引き上げを決められる。`, consulted: true };
    }
    return { ok: false, why: o.why };
  }
  const r = safe(() => g.issueOrdinance('saichin', { option: key }), null);
  if (!r || r.ok === false) return { ok: false, why: (r && r.why) || '決められなかった' };
  const s = S(g);
  s.union.minWageAdd = num(s.union.minWageAdd) + (key === 'up5' ? 25 : 12);
  const lines = applyFx(g, key === 'up5' ? { sup: 14, an: -12, ap: 0.2 } : { sup: 8, an: -8, ap: 0.1 }, { id: unionGroupId(s), role: groupsRole(g), domain: 'rengo' });
  applyFx(g, { sup: key === 'up5' ? -10 : -5, an: key === 'up5' ? 12 : 6 }, { id: 'b_chusho', role: groupsRole(g), domain: 'business', spill: false });
  news(g, `最低賃金の引き上げが決まった（${key === 'up5' ? '大幅' : '目安どおり'}）`, { domain: 'rengo' });
  return { ok: true, text: r.text || '最低賃金の引き上げを決めた。', lines };
}

// ================================================================ セクト（宗教・政治集団）
function initSect(g, s) { s.sect = { lastIncident: -99 }; }
function sectMonthly(g, s) {
  const rel = has(g, 'religion') ? safe(() => g.religion(), null) : null;
  for (const id of groupsOfDomain('sect')) {
    const def = GROUP_DEFS[id], grp = s.groups[id];
    if (!grp.on) continue;
    if (def.link && rel) {
      const rid = def.link.split(':')[1];
      const r = (rel.groups || []).find((x) => x.id === rid);
      if (r) {
        grp.x.link = { trust: num(r.trust), relation: num(r.relation), members: num(r.members), status: r.status || '' };
        grp.mod = clamp(num(grp.mod) + (num(r.relation) - 50) * 0.05, -60, 60);
        if (rid === 'tenkan' && rel.cult) addGriev(grp, 'cult', `高額献金トラブル：${rel.cult.label}（相談 ${num(rel.cult.complaints)}件）`, clamp(num(rel.cult.stage) * 12, 0, 80));
      }
    }
    if (def.radical) {
      const x = grp.x;
      x.watch = clamp(num(x.watch) - 0.05, 0, 3);
      const silent = num(x.silent) > today(g) || num(x.banned) > today(g);
      x.radical = clamp(num(x.radical) + (silent ? -0.5 : 0.7 * (num(grp.an) / 60)) + (num(grp.s) < -30 ? 0.5 : 0) - 0.8 * x.watch + (isDemocracy(g) ? 0 : 0.8), 0, 100);
      if (!silent && x.radical >= 55 && today(g) - s.sect.lastIncident > 25 && roll(0.08 + (x.radical - 55) / 300) && openCases(s).length < 9) {
        s.sect.lastIncident = today(g);
        x.incident = today(g);
        const t = pick(['路上での集会が暴走し、警察と衝突した', '施設に対する抗議行動がエスカレートし、けが人が出た', '過激な主張の文書が大量にばらまかれた', '集会で暴力的な言動が相次いだ', '関係者による脅迫的な書き込み・文書が確認された']);
        if (roleHandles(groupsRole(g), 'sect', 'law')) s.cases.unshift({ id: `c${s.seq++}`, kind: 'incident', group: id, domain: 'sect', title: `${groupName(g, id)}をめぐる事件`, text: `${groupName(g, id)}の関係者による事件：${t}。過激化への懸念が高まっている。`, day: today(g), due: today(g) + 14, status: 'open', data: {}, res: null });
        news(g, `${groupName(g, id)}をめぐる事件：${t}`, { domain: 'sect' });
        phoneMsg(g, `【ニュース】${groupName(g, id)}をめぐり事件。警察が捜査`, 'ドット新聞 社会部');
      }
    }
  }
}

// ================================================================ 研究（科学技術）
const RD_LEVEL = [[1987, 45], [1996, 55], [2004, 62], [2026, 60]];
const LAUREATES = ['桜庭', '宇津木', '三輪田', '浅間', '蓮見', '笠松', '鷹取', '真柴'];
const NOBEL_FIELDS = ['物理学賞', '化学賞', '生理学・医学賞'];
function initRd(g, s) { s.rd.level = r0(anchorsAt(RD_LEVEL, gdate(g).t)); s.rd.integrity = 70; s.rd.young = 50; }
function rdMonthly(g, s) {
  const d = gdate(g), R = s.rd;
  R.level = clamp(R.level - 0.12 + (anchorsAt(RD_LEVEL, d.t) - R.level) * 0.004, 0, 100); // without new money, research slowly erodes
  R.integrity = clamp(R.integrity + (70 - R.integrity) * 0.01, 0, 100);
  R.young = clamp(R.young + (50 - R.young) * 0.01 - (since(g, 20040401) ? 0.05 : 0), 0, 100);
  const eff = (R.level - 55) / 55;
  if (Math.abs(eff) > 0.02) pushShock(g, 'rd', '研究水準と成長', { growth: clamp(eff * 0.09, -0.08, 0.1) }, 60);
  else dropShock(g, 'rd');
  const kd = s.groups.ke_daigaku;
  // an October announcement: the Nobel Prizes
  if (d.month === 10 && roll(clamp(0.1 + (R.level - 40) / 140, 0.03, 0.6)) && R.last !== d.year) {
    R.last = d.year; R.nobel += 1;
    const nm = `${pick(LAUREATES)} ${pick(['博士', '教授'])}`;
    const f = pick(NOBEL_FIELDS);
    R.laureates.unshift({ year: d.year, name: nm, field: f }); if (R.laureates.length > 6) R.laureates.length = 6;
    news(g, `日本出身の研究者・${nm}がノーベル${f}を受賞（${d.year}年）`, { domain: 'kenkyu' });
    phoneMsg(g, `【速報】${nm}がノーベル${f}を受賞！ 日本中が沸いている`, 'ドット新聞 科学部');
    moodAdd(g, 0.4, '科学の快挙（ノーベル賞）');
    for (const id of groupsOfDomain('kenkyu')) { const gr = s.groups[id]; if (gr.on) gr.mod = clamp(num(gr.mod) + 4, -60, 60); }
  }
  // research misconduct
  const pFraud = 0.018 * (1 - R.integrity / 130) * (R.level / 50);
  if (roll(pFraud) && openCases(s).length < 9 && !openCases(s).some((c) => c.kind === 'fraud')) {
    R.fraud += 1;
    const t = pick(['有名な研究室の論文に、データの捏造の疑いが指摘された', '大学の研究費の不正使用が発覚した', '論文の画像の使い回しが相次いで見つかった']);
    news(g, `研究不正の疑い：${t}`, { domain: 'kenkyu' });
    if (kd) kd.mod = clamp(num(kd.mod) - 4, -60, 60);
    if (!roleHandles(groupsRole(g), 'kenkyu', 'law')) return;
    const c = { id: `c${s.seq++}`, kind: 'fraud', group: 'ke_daigaku', domain: 'kenkyu', title: '研究不正の疑い', text: `${t}。研究への信頼が揺らいでいる。`, day: today(g), due: today(g) + 20, status: 'open', data: {}, res: null };
    s.cases.unshift(c);
  }
}
export function rdSummary(g) {
  const R = S(g).rd;
  return { level: r0(R.level), integrity: r0(R.integrity), young: r0(R.young), nobel: R.nobel, fraud: R.fraud, laureates: R.laureates.slice(0, 4), growthPush: r2(clamp(((R.level - 55) / 55) * 0.09, -0.08, 0.1)), law: since(g, 19951115) ? (since(g, 20210401) ? '科学技術・イノベーション基本法（2021年〜）' : '科学技術基本法（1995年〜）') : 'まだ科学技術基本法がない（1995年に制定）' };
}

// ================================================================ 政府（官庁・自治体）
function seifuMonthly(g, s) {
  const p = polOf(g);
  const role = groupsRole(g);
  const approval = p && p.cabinet ? num(p.cabinet.approval, 40) : 40;
  const adm = has(g, 'adminReform') ? safe(() => g.adminReform(), null) : null;
  const heat = adm && adm.amakudari ? num(adm.amakudari.heat) : 0;
  const bureau = groupsOfDomain('seifu').filter((id) => GROUP_DEFS[id].bureau && s.groups[id].on);
  let sumS = 0, sumAn = 0;
  for (const id of bureau) {
    const grp = s.groups[id];
    // a strong cabinet (high approval, a personnel bureau) gets loyalty; a weak one gets resistance
    grp.mod = clamp(num(grp.mod) + (approval - 40) * 0.04 + (since(g, 20140530) && role.cabinet ? 0.4 : 0) - heat * 0.01, -60, 60);
    if (heat >= 55) addGriev(grp, 'amakudari', '天下りへの世論の批判と調査に身構えている', clamp(heat * 0.4, 0, 50));
    sumS += grp.s * influenceOf(g, id); sumAn += grp.an * influenceOf(g, id);
  }
  const wsum = bureau.reduce((a, id) => a + influenceOf(g, id), 0) || 1;
  s.seifu.trust = clamp(r0(50 + sumS / wsum / 2), 0, 100);
  const avgAn = sumAn / wsum;
  if (role.cabinet && avgAn >= 52 && roll(0.1) && today(g) - s.seifu.lastLeak > 20) {
    s.seifu.leaks += 1; s.seifu.lastLeak = today(g);
    news(g, '政府の内部文書が相次いで報道に流出。官僚の不満が背景か', { domain: 'seifu' });
    moodAdd(g, -0.4, '内部情報のリーク');
    s.seifu.sabotage = clamp(s.seifu.sabotage + 4, 0, 100);
  } else if (role.cabinet && avgAn >= 45 && roll(0.08)) {
    news(g, '省庁の調整が難航し、政策の実施が遅れていると指摘される', { domain: 'seifu', feed: false });
    moodAdd(g, -0.15, '省庁の抵抗');
  } else if (role.cabinet && sumS / wsum >= 35 && roll(0.08)) {
    news(g, '省庁が前倒しで準備を進め、政府の政策が円滑に進んでいる', { domain: 'seifu', feed: false });
    moodAdd(g, 0.15, '省庁の協力');
  }
  s.seifu.sabotage = clamp(s.seifu.sabotage - 0.5, 0, 100);
}
export function seifuSummary(g) {
  const s = S(g), d = gdate(g);
  const role = groupsRole(g);
  const mins = has(g, 'ministries') ? safe(() => g.ministries(), []) : [];
  const adm = has(g, 'adminReform') ? safe(() => g.adminReform(), null) : null;
  return {
    trust: s.seifu.trust, leaks: s.seifu.leaks, sabotage: r0(s.seifu.sabotage), sontaku: num(s.seifu.sontaku),
    ministries: mins.slice(0, 16).map((m) => ({ name: m.name, minister: m.playerHeads ? 'あなた' : m.ministerName || '—', player: !!m.playerHeads })),
    jinji: since(g, 20140530) ? '内閣人事局（2014年〜）：幹部人事を官邸が一元管理。強い統制と「忖度」のリスク' : '幹部人事は各省庁の慣行が強い（内閣人事局は2014年）',
    amakudari: adm && adm.amakudari ? { heat: num(adm.amakudari.heat), cases: (adm.amakudari.cases || []).length } : null,
    realParty: govRealParty(g),
    role: role.kind,
    local: since(g, 20000401) ? '地方分権一括法（2000年4月施行）：国と地方は「対等・協力」の関係に' : '機関委任事務など、国の指揮が強い地方制度（地方分権一括法は2000年施行）',
  };
}

// ================================================================ 有識者会議 (panels)
export const THEMES = {
  economy: { name: '経済財政', dim: 'econ', axis: ['分配・財政出動を重視', '市場・構造改革を重視'], pol: { l: ['stimulus', 'min_wage'], r: ['deregulation', 'corp_tax_cut'] }, ask: '成長と財政の両立' },
  welfare: { name: '社会保障', dim: 'econ', axis: ['給付の維持・拡充を重視', '負担の見直し・効率化を重視'], pol: { l: ['pension_up', 'care_expand'], r: ['pension_cut', 'medical_cost'] }, ask: '年金・医療・介護の将来像' },
  education: { name: '教育・人づくり', dim: 'social', axis: ['無償化と格差の是正を重視', '競争と学力を重視'], pol: { l: ['free_tuition', 'scholarship'], r: ['education_reform'] }, ask: '教育の在り方' },
  security: { name: '安全保障と防衛', dim: 'security', axis: ['外交と抑制的な防衛を重視', '防衛力の強化を重視'], pol: { l: ['pko', 'defense_cut'], r: ['defense_up', 'security_law'] }, ask: '安全保障環境と防衛力' },
  constitution: { name: '憲法のあり方', dim: 'social', axis: ['現行憲法の維持を重視', '改正による明確化を重視'], pol: { l: [], r: ['referendum_law', 'amend_sdf'] }, ask: '憲法の課題' },
  tax: { name: '税制', dim: 'econ', axis: ['所得・資産への課税を重視', '消費・法人の見直しを重視'], pol: { l: ['inheritance_tax', 'capital_gains_tax'], r: ['shohizei_up', 'corp_tax_cut'] }, ask: '税の姿' },
  tourism: { name: '観光立国', dim: 'econ', axis: ['住民の暮らしを優先', '受け入れ拡大を優先'], pol: { l: ['env_regulation'], r: ['tourism', 'ir_casino'] }, ask: '観光と地域の共存' },
  culture: { name: '文化芸術', dim: 'econ', axis: ['公的支援を厚く', '民間活力・市場を重視'], pol: { l: ['culture_ent'], r: ['deregulation'] }, ask: '文化政策' },
  science: { name: '科学技術', dim: 'econ', axis: ['基礎研究を重視', '産業化・成果を重視'], pol: { l: ['research'], r: ['space', 'deregulation'] }, ask: '研究と大学の将来' },
  local: { name: '地方のあり方', dim: 'econ', axis: ['国の責任と財政支援', '地方分権と自立'], pol: { l: ['local_grant', 'public_works'], r: ['decentralize', 'municipal_merger'] }, ask: '国と地方の関係' },
  labor: { name: '働き方', dim: 'econ', axis: ['労働者の保護を強化', '柔軟化・規制緩和'], pol: { l: ['work_style', 'irregular_protect'], r: ['haken_dereg'] }, ask: '働き方と賃金' },
  digital: { name: 'デジタル社会', dim: 'security', from: 20000101, axis: ['プライバシーと慎重な導入', '活用とスピードを重視'], pol: { l: [], r: ['mynumber', 'digital_gov'] }, ask: 'デジタル化の進め方' },
  disaster: { name: '防災・復興', dim: 'econ', axis: ['事前防災・国土強靱化', '復旧優先・柔軟な対応'], pol: { l: ['disaster_prep'], r: [] }, ask: '防災と復興' },
};
export const THEME_ORDER = Object.keys(THEMES);
const THEME_DOMAIN = { economy: 'business', labor: 'rengo', tourism: 'tourism', culture: 'bunka', science: 'kenkyu', local: 'seifu', welfare: 'kyokai', tax: 'business', education: 'kenkyu', security: 'sect', constitution: 'yushikisha', digital: 'business', disaster: 'seifu' };
const CHAIRS = [{ side: -1, label: '分配・保護を重視する座長' }, { side: 0, label: '中立的な座長' }, { side: 1, label: '市場・成長を重視する座長' }];
const MEMBER_AFF = ['大学教授', '研究所の主任研究員', '元官僚', '弁護士', '経済団体の顧問', 'シンクタンクの研究員', '新聞社の論説委員', '労働問題の研究者', '福祉の現場の専門家', '元自治体首長'];
function panelBlock(g, theme) {
  const T = THEMES[theme];
  if (!T) return 'そのようなテーマはない';
  if (T.from && gdate(g).n < T.from) return `${nLabel(T.from)}より前には、この課題はまだ政策の議題になっていない`;
  const role = groupsRole(g);
  if (role.kind === 'citizen') return '有識者会議を開けるのは内閣の側（総理・官房長官・大臣）や首長だけ。議員は質問や提案を通じて働きかける';
  if (role.kind === 'member') return '有識者会議（私的諮問機関）を開けるのは内閣の側や首長。議員は党の部会や国会で提案する';
  if (role.kind === 'minister' && !role.posts.some((x) => ['kanbo', ...DOMAIN_POSTS[THEME_DOMAIN[theme]] || []].includes(x))) return `このテーマの会議を開けるのは、総理か担当の大臣（${ministerOf(g, THEME_DOMAIN[theme])}）`;
  const s = S(g);
  if (s.panels.filter((x) => x.status === 'meeting').length >= 3) return '同時に開ける有識者会議は3つまで';
  if (s.panels.some((x) => x.theme === theme && x.status === 'meeting')) return 'このテーマの会議はすでに開かれている';
  return null;
}
export function panelPreview(g, theme, o = {}) {
  const T = THEMES[theme];
  if (!T) return { ok: false, why: 'そのようなテーマはない' };
  const s = S(g);
  const chairSide = o.chair == null ? 0 : o.chair;
  const tilt = clamp(num(o.tilt), 0, 2), want = o.want == null ? 0 : o.want;
  const role = groupsRole(g);
  const cost = { gov: r0(2 * scaleOf(g) * (role.kind === 'local' ? 0.2 : 1)), stamina: 6 };
  const why = panelBlock(g, theme) || costBlock(g, cost);
  const expert = ['y_keizai', 'y_hogaku', 'y_shakai', 'y_rondan'].map((id) => s.groups[id]).filter((x) => x && x.on);
  const credBase = expert.length ? expert.reduce((a, x) => a + num(x.x.cred, 60), 0) / expert.length : 60;
  const cred = clamp(r0(credBase - 11 * tilt + (chairSide === 0 ? 4 : -2)), 5, 98);
  const expose = tilt ? clamp(0.12 * tilt + (since(g, 20130101) ? 0.05 : 0), 0, 0.5) : 0;
  const days = 14 + rint(0, 8);
  return {
    ok: true, theme, name: T.name, axis: T.axis, cost, costText: costText(g, cost), why, cred, expose: r2(expose), days, chairSide, tilt, want,
    lines: [`テーマ：${T.ask}`, `座長：${CHAIRS.find((c) => c.side === chairSide).label}`, tilt ? `人選の調整（${['', '少し', 'かなり'][tilt]}${want > 0 ? '「' + T.axis[1] + '」' : '「' + T.axis[0] + '」'}に寄せる）：信頼性 −${11 * tilt}、露見する恐れ ${Math.round(expose * 100)}%／月` : '人選は中立（専門分野と立場のバランスをとる）', `報告書は約${days}日後。採用・一部採用・棚上げを選べる`],
    pro: ['「専門家の知見を政策に生かせる」（有識者）', '「国民に論点を示せる」（記者）'], con: ['「結論ありきの隠れみのでは」（野党）', '「審議会ではなく私的な懇談会。責任の所在があいまい」（法学者）'],
  };
}
export function panelConvene(g, theme, o = {}) {
  const pv = panelPreview(g, theme, o);
  if (!pv.ok) return pv;
  if (pv.why) return { ok: false, why: pv.why };
  const s = S(g);
  payCost(g, pv.cost, 'yushikisha');
  const role = groupsRole(g);
  const T = THEMES[theme];
  const chairGroup = pick(['y_keizai', 'y_hogaku', 'y_shakai', 'y_rondan'].filter((id) => s.groups[id].on));
  const lead = makeLeader(`panel${s.panelSeq}`, 0, '座長', s.panelSeq, today(g));
  const members = [];
  for (let i = 0; i < 6; i++) {
    const m = makeLeader(`panel${s.panelSeq}`, i + 1, pick(MEMBER_AFF), s.panelSeq, today(g));
    const lean = clamp(Math.round((rnd() * 2 - 1 + pv.chairSide * 0.2 + (pv.tilt ? pv.want * 0.5 : 0)) * 10) / 10, -1.5, 1.5);
    members.push({ name: m.name, aff: m.title, lean });
  }
  const p = { id: `p${s.panelSeq++}`, theme, title: `${T.name}に関する有識者会議`, chair: { name: lead.name, side: pv.chairSide, group: chairGroup }, members, tilt: pv.tilt, want: pv.want, cred: pv.cred, start: today(g), due: today(g) + pv.days, status: 'meeting', report: null, exposed: false, by: role.kind };
  s.panels.unshift(p);
  if (s.panels.length > 20) s.panels.length = 20;
  news(g, `${T.name}に関する有識者会議が発足（座長：${lead.name}）`, { domain: 'yushikisha', feed: false });
  for (const id of groupsOfDomain('yushikisha')) if (s.groups[id].on) s.groups[id].gw = clamp(s.groups[id].gw + 1.5, -80, 80);
  return { ok: true, panel: panelView(g, p), text: `${T.name}の有識者会議を開いた。報告書は約${pv.days}日後。` };
}
function makeReport(g, p) {
  const T = THEMES[p.theme];
  const avg = p.members.reduce((a, m) => a + m.lean, 0) / Math.max(1, p.members.length);
  let lean = clamp(0.9 * p.chair.side + avg + 0.9 * p.tilt * p.want + (rnd() - 0.5) * 0.6, -2, 2);
  lean = Math.round(lean * 10) / 10;
  const right = lean >= 0;
  const axisPick = right ? T.axis[1] : T.axis[0];
  const pols = (right ? T.pol.r : T.pol.l).slice(0, 2);
  const bullets = [`「${axisPick}」の方向で、制度を見直すべきだ`, ...pols.map((id) => `「${POLICY_NAME[id] || id}」を検討すべきだ`)];
  if (pols.length < 2) bullets.push(`${T.ask}について、継続的に検証する場を設けるべきだ`);
  const dissent = `一部の委員から、「${right ? T.axis[0] : T.axis[1]}」の観点も欠かせないとの意見があった`;
  const strength = Math.abs(lean) >= 1.4 ? '明確に' : Math.abs(lean) >= 0.6 ? 'やや' : '穏やかに';
  return { lean, headline: `報告書は${strength}「${axisPick}」を求める内容`, bullets, dissent, policies: pols, right };
}
function panelsDaily(g, s) {
  for (const p of s.panels) {
    if (p.status === 'meeting' && p.due <= today(g)) {
      p.report = makeReport(g, p);
      p.status = 'reported';
      news(g, `${p.title}が報告書をまとめた：${p.report.headline}`, { domain: 'yushikisha' });
      phoneMsg(g, `【ニュース】${p.title}が報告書。${p.report.headline}`, 'ドット新聞 政治部');
      if (p.tilt && roll(0.12 * p.tilt) && !p.exposed) exposePanel(g, s, p);
    }
  }
}
function panelsMonthly(g, s) {
  for (const p of s.panels) {
    if (p.tilt && !p.exposed && ['meeting', 'reported', 'adopted', 'partial'].includes(p.status) && today(g) - p.start < 140 && roll(0.1 * p.tilt)) exposePanel(g, s, p);
  }
  for (const [k, e] of Object.entries(s.backing)) if (e.until < today(g)) delete s.backing[k];
}
function exposePanel(g, s, p) {
  p.exposed = true;
  const role = groupsRole(g);
  news(g, `「${p.title}」の人選が「結論ありき」と批判された（御用学者との指摘）`, { domain: 'yushikisha' });
  for (const id of groupsOfDomain('yushikisha')) { const gr = s.groups[id]; if (gr.on) { gr.x.cred = clamp(num(gr.x.cred, 60) - 6 * p.tilt, 0, 100); gr.an = clamp(gr.an + 8 * p.tilt, 0, 100); } }
  p.cred = clamp(p.cred - 14 * p.tilt, 0, 100);
  if (role.cabinet) { moodAdd(g, -0.3 * p.tilt, '有識者会議の人選をめぐる批判'); scandalHit(g, 0.6 * p.tilt, '有識者会議の人選', role); }
}
export function panelView(g, p) {
  const T = THEMES[p.theme];
  return { id: p.id, theme: p.theme, themeName: T.name, title: p.title, status: p.status, statusLabel: { meeting: '審議中', reported: '報告書あり（採否を決める）', adopted: '採用', partial: '一部を採用', shelved: '棚上げ', published: '公表のみ' }[p.status] || p.status, chair: p.chair, members: p.members, tilt: p.tilt, want: p.want, cred: p.cred, start: p.start, due: p.due, left: Math.max(0, p.due - today(g)), report: p.report, exposed: p.exposed, axis: T.axis, answered: p.answer || null };
}
export function panelsList(g) { return S(g).panels.map((p) => panelView(g, p)); }
export function panelAnswerPreview(g, id) {
  const s = S(g), p = s.panels.find((x) => x.id === id);
  if (!p || p.status !== 'reported') return { ok: false, why: '採否を決められる報告書がない' };
  const role = groupsRole(g);
  const T = THEMES[p.theme];
  const lean = p.report.lean;
  return {
    ok: true, id, options: [
      { key: 'adopt', label: '全面的に採用する', desc: `提言を政策の後ろ盾にする。関連する政策の実現が進めやすくなる（${150}日）。信頼性${p.cred}が高いほど効果が大きい。`, lines: [`関連分野の規制・予算の行動が通りやすくなる（成功率 +${Math.round((0.4 + 0.6 * p.cred / 100) * (p.exposed ? 0.4 : 1) * 18)}%）`, `「${p.report.headline.replace('報告書は', '')}」に近い団体は支持、反対側は不満`] },
      { key: 'partial', label: '一部を採用する', desc: 'できるところだけ採用する。効果も反発も半分', lines: ['後ろ盾は半分の強さ（90日）'] },
      { key: 'publish', label: '公表するだけにする', desc: '報告書を公表するにとどめ、採否は決めない', lines: ['有識者の面目は保たれるが、政策は動かない'] },
      { key: 'shelve', label: '棚上げする', desc: '報告書を採用しない。有識者の反発を招く', lines: ['「諮問の形だけ」と受け取られ、有識者の信頼が下がる'] },
    ],
    lean, role: role.kind,
  };
}
export function panelAnswer(g, id, key) {
  const s = S(g), p = s.panels.find((x) => x.id === id);
  if (!p || p.status !== 'reported') return { ok: false, why: '採否を決められる報告書がない' };
  const role = groupsRole(g);
  const T = THEMES[p.theme];
  const lean = p.report.lean;
  const dom = THEME_DOMAIN[p.theme];
  const strength = (0.4 + 0.6 * p.cred / 100) * (p.exposed ? 0.4 : 1);
  let text = '', lines = [];
  if (key === 'adopt' || key === 'partial') {
    const k = key === 'adopt' ? 1 : 0.5;
    s.backing[p.theme] = { until: today(g) + (key === 'adopt' ? 150 : 90), strength: clamp(strength * k, 0, 1), lean };
    p.status = key === 'adopt' ? 'adopted' : 'partial';
    lines.push(...applyFx(g, { ap: 0.3 * k * (p.cred / 100) * (p.exposed ? 0.3 : 1) }, { role, domain: 'yushikisha' }));
    const dim = T.dim;
    for (const gid of GROUP_ORDER) {
      const gr = s.groups[gid], df = GROUP_DEFS[gid];
      if (!gr.on) continue;
      const lv = df.lean[dim] || 0;
      const rel = df.domain === dom || df.domain === 'yushikisha';
      if (Math.abs(lv) < 0.4 && !rel) continue;
      const match = Math.sign(lv || 0) * Math.sign(lean || 1);
      if (df.domain === 'yushikisha') gr.gw = clamp(gr.gw + 3 * k * (p.cred / 100), -80, 80);
      else if (rel || Math.abs(lv) >= 0.8) gr.gw = clamp(gr.gw + 4 * k * match * (Math.abs(lean) / 2), -80, 80);
    }
    text = `${p.title}の報告書を${key === 'adopt' ? '採用' : '一部採用'}した。関連分野の政策が通りやすくなる。`;
    news(g, `政府は${T.name}の有識者会議の報告書を${key === 'adopt' ? '採用する方針' : '一部採用する方針'}`, { domain: 'yushikisha', feed: false });
  } else if (key === 'publish') {
    s.backing[p.theme] = { until: today(g) + 60, strength: clamp(strength * 0.25, 0, 1), lean };
    p.status = 'published';
    for (const gid of groupsOfDomain('yushikisha')) if (s.groups[gid].on) s.groups[gid].gw = clamp(s.groups[gid].gw + 1, -80, 80);
    text = '報告書を公表した。政策への反映は今後の判断になる。';
  } else if (key === 'shelve') {
    p.status = 'shelved';
    for (const gid of groupsOfDomain('yushikisha')) if (s.groups[gid].on) { s.groups[gid].gw = clamp(s.groups[gid].gw - 4, -80, 80); s.groups[gid].an = clamp(s.groups[gid].an + 6, 0, 100); }
    s.flags.shelved = (s.flags.shelved || []).filter((d) => today(g) - d < 240).concat([today(g)]);
    if (s.flags.shelved.length >= 3) { for (const gid of groupsOfDomain('yushikisha')) if (s.groups[gid].on) s.groups[gid].x.cred = clamp(num(s.groups[gid].x.cred, 60) - 3, 0, 100); lines.push('「諮問の形骸化」との批判が強まっている'); }
    text = '報告書を棚上げした。有識者の間に不満が広がる。';
    news(g, `${p.title}の報告書が棚上げに。「結論が出てから開いた形だけの会議」との声`, { domain: 'yushikisha', feed: false });
  } else return { ok: false, why: 'そのような採否はない' };
  p.answer = { key, day: today(g) };
  return { ok: true, text, lines };
}
export function backingList(g) { return Object.entries(S(g).backing).filter(([, e]) => e.until >= today(g)).map(([theme, e]) => ({ theme, name: (THEMES[theme] || {}).name || theme, strength: r2(e.strength), left: e.until - today(g), lean: e.lean })); }

// ================================================================ スポーツ: 大会誘致 (bids)
export const BID_TYPES = {
  olympic_s: { name: '夏季オリンピック', decide: 150, prep: 330, cost: 9000, rival: 0.55, ap: 2.4, hold: '開幕' },
  olympic_w: { name: '冬季オリンピック', decide: 130, prep: 270, cost: 5000, rival: 0.5, ap: 1.8, hold: '開幕' },
  expo: { name: '万国博覧会（万博）', decide: 100, prep: 240, cost: 2500, rival: 0.45, ap: 1.8, hold: '開幕' },
  worldcup: { name: 'サッカー・ワールドカップ（共催）', decide: 90, prep: 240, cost: 3000, rival: 0.4, ap: 1.4, hold: '開幕' },
  asiad: { name: 'アジア競技大会', decide: 70, prep: 180, cost: 1500, rival: 0.35, ap: 0.9, hold: '開幕' },
  kokutai: { name: '国民体育大会（国スポ）', decide: 40, prep: 100, cost: 500, rival: 0.05, ap: 0.5, hold: '開会' },
};
export const BID_ORDER = Object.keys(BID_TYPES);
const HOSTS = ['ドット湾岸市', '星ヶ丘市', '桜浜市', '緑川市', 'ドット区とその周辺'];
export function bidName(g, type) { if (type === 'kokutai') return since(g, 20240101) ? '国民スポーツ大会（国スポ）' : '国民体育大会（国体）'; return BID_TYPES[type].name; }
function bidApproval(g) { const p = polOf(g); return p && p.cabinet ? num(p.cabinet.approval, 40) : 40; }
function bidOdds(g, b) {
  const s = S(g);
  const sp = s.groups.s_kyogi;
  const spS = clamp(num(sp && sp.s) / 100, -1, 1);
  const pub = clamp(num(b.support) / 100, 0, 1);
  const cost = clamp(0.2 + 0.28 * spS + 0.3 * pub + 0.25 * num(b.camp) - 0.22 * num(b.rival) + (BID_TYPES[b.type].rival < 0.1 ? 0.45 : 0), 0.03, 0.95);
  return cost;
}
export function bidPreview(g, type) {
  const T = BID_TYPES[type];
  if (!T) return { ok: false, why: 'そのような大会はない' };
  const s = S(g), role = groupsRole(g);
  const ctrl = role.pm || (role.kind === 'minister' && domainControl(role, 'sports') === 'full') || role.kind === 'local';
  const cost = { gov: r0(T.cost * 0.0016 * scaleOf(g) * (role.kind === 'local' ? 0.3 : 1)), stamina: 10 };
  let why = ctrl ? null : `大会の誘致を決められるのは、総理か担当の大臣（${ministerOf(g, 'sports')}）、または開催地の首長`;
  if (!why && s.bids.some((b) => b.type === type && ['declared', 'prep'].includes(b.status))) why = 'この大会は誘致・準備の最中';
  if (!why && s.bids.filter((b) => ['declared', 'prep'].includes(b.status)).length >= 2) why = '同時に進められる誘致・準備は2件まで';
  if (!why && s.bids.some((b) => b.type === type && today(g) - num(b.endDay, -999) < 240)) why = '前の大会の結果から間もない（約240日あける）';
  if (!why) why = costBlock(g, cost);
  const total = r0(T.cost * scaleOf(g) * (role.kind === 'local' ? 0.5 : 1));
  const tmp = { type, support: clamp(35 + (bidApproval(g) - 40) * 0.6 + num(s.groups.s_kyogi && s.groups.s_kyogi.s) * 0.2, 10, 85), camp: 0, rival: T.rival * (0.6 + rnd() * 0.5) };
  return { ok: true, type, name: bidName(g, type), why, cost, costText: costText(g, cost), total, totalText: fmtOku(total), decide: T.decide, prep: T.prep, odds: r2(bidOdds(g, tmp)), support: r0(tmp.support), lines: [`招致活動から決定まで約${T.decide}日、決まれば準備に約${T.prep}日`, `全体の費用の目安 ${fmtOku(total)}（準備の間、毎月の支出と景気の刺激がある。目安は実際の大会の規模から）`, '成功すれば開催で支持率・観光・景気が上がる。費用の超過や招致をめぐる不祥事のリスクも'], pro: ['「国民が一つになり、世界に日本を発信できる」（競技団体）', '「観光と景気の起爆剤になる」（経済界）'], con: ['「費用が膨らみ、借金を次の世代に残す」（財政に厳しい声）', '「開発と環境破壊、住民の負担が心配」（住民団体）'] };
}
export function bidDeclare(g, type) {
  const pv = bidPreview(g, type);
  if (!pv.ok) return pv;
  if (pv.why) return { ok: false, why: pv.why };
  const s = S(g), T = BID_TYPES[type];
  payCost(g, pv.cost, 'sports');
  const b = { id: `b${s.seq++}`, type, name: bidName(g, type), host: pick(HOSTS), day: today(g), decideDay: today(g) + T.decide, prepEnd: 0, eventDay: 0, total: pv.total, spent: 0, support: pv.support, camp: 0, rival: r2(T.rival * (0.6 + rnd() * 0.5)), status: 'declared', over: 1, log: [] };
  b.odds = r2(bidOdds(g, b));
  s.bids.unshift(b); if (s.bids.length > 12) s.bids.length = 12;
  news(g, `${b.name}の誘致を表明（候補地：${b.host}）`, { domain: 'sports' });
  const lines = applyFx(g, { sup: 6, an: -4, ap: 0.2 }, { id: 's_kyogi', role: groupsRole(g), domain: 'sports' });
  return { ok: true, bid: bidView(g, b), text: `${b.name}の誘致を表明した。決定まで約${T.decide}日。`, lines };
}
export function bidCampaignPreview(g, id) {
  const s = S(g), b = s.bids.find((x) => x.id === id);
  if (!b || b.status !== 'declared') return { ok: false, why: '招致活動ができる誘致はない' };
  const role = groupsRole(g);
  const cost = { gov: r0(BID_TYPES[b.type].cost * 0.004 * scaleOf(g) * (role.kind === 'local' ? 0.3 : 1)), stamina: 8 };
  const why = b.camp >= 0.6 ? '招致活動はもう十分に行った' : role.kind === 'citizen' || role.kind === 'member' ? '招致活動を進められるのは内閣の側か首長' : costBlock(g, cost);
  return { ok: true, id, cost, costText: costText(g, cost), why, odds: b.odds, lines: ['国際会議への働きかけ・ロビー活動・プレゼンの準備を行う（招致の見込み +15%ほど）', '費用がかさむと「招致の使途」への疑いも出る'] };
}
export function bidCampaign(g, id) {
  const pv = bidCampaignPreview(g, id);
  if (!pv.ok) return pv;
  if (pv.why) return { ok: false, why: pv.why };
  const s = S(g), b = s.bids.find((x) => x.id === id);
  payCost(g, pv.cost, 'sports');
  b.camp = clamp(b.camp + 0.15, 0, 0.6);
  b.support = clamp(b.support + 2, 0, 100);
  b.odds = r2(bidOdds(g, b));
  collAdd(g, 1.5);
  return { ok: true, text: `招致活動を進めた。誘致の見込みは${Math.round(b.odds * 100)}%。`, bid: bidView(g, b) };
}
export function bidWithdraw(g, id) {
  const s = S(g), b = s.bids.find((x) => x.id === id);
  if (!b || !['declared', 'prep'].includes(b.status)) return { ok: false, why: '取り下げられる誘致はない' };
  b.status = 'withdrawn'; b.endDay = today(g);
  const lines = applyFx(g, { sup: -6, an: 10, ap: b.status === 'prep' ? -0.8 : -0.2 }, { id: 's_kyogi', role: groupsRole(g), domain: 'sports' });
  news(g, `${b.name}の${b.status === 'prep' ? '開催' : '誘致'}を取り下げ`, { domain: 'sports' });
  return { ok: true, text: `${b.name}を取り下げた。`, lines };
}
export function bidView(g, b) {
  return { id: b.id, type: b.type, name: b.name, host: b.host, status: b.status, statusLabel: { declared: '招致活動中', prep: '開催準備中', held: '開催済み', lost: '落選', withdrawn: '取り下げ' }[b.status] || b.status, day: b.day, decideDay: b.decideDay, eventDay: b.eventDay, leftDecide: Math.max(0, b.decideDay - today(g)), leftEvent: Math.max(0, num(b.eventDay) - today(g)), total: b.total, totalText: fmtOku(b.total), spent: r0(b.spent), support: r0(b.support), camp: r2(b.camp), rival: r2(b.rival), odds: r2(b.odds), over: r2(b.over), log: b.log.slice(0, 4) };
}
export function bidsList(g) { return S(g).bids.map((b) => bidView(g, b)); }
function bidsDaily(g, s) {
  for (const b of s.bids) {
    if (b.status === 'declared') {
      b.odds = r2(bidOdds(g, b));
      if (b.decideDay <= today(g)) {
        const T = BID_TYPES[b.type];
        if (roll(b.odds)) {
          b.status = 'prep'; b.eventDay = today(g) + T.prep; b.endDay = null;
          news(g, `${b.name}の開催が決まった（${b.host}）。準備が始まる`, { domain: 'sports' });
          phoneMsg(g, `【速報】${b.name}の開催地に決定！`, 'ドット新聞 スポーツ部');
          applyFx(g, { sup: 10, an: -8, ap: 0.8 + T.ap * 0.2, seg: { urban: 0.3, young: 0.3 } }, { id: 's_kyogi', role: groupsRole(g), domain: 'sports' });
          b.log.unshift('開催地に決定');
        } else {
          b.status = 'lost'; b.endDay = today(g);
          news(g, `${b.name}の誘致は落選`, { domain: 'sports' });
          applyFx(g, { sup: -5, an: 8, ap: -0.3 }, { id: 's_kyogi', role: groupsRole(g), domain: 'sports' });
          b.log.unshift('落選');
        }
      }
    } else if (b.status === 'prep' && b.eventDay <= today(g)) {
      const T = BID_TYPES[b.type];
      b.status = 'held'; b.endDay = today(g);
      const over = b.over > 1.2;
      s.flags.eventBoostUntil = today(g) + 60;
      news(g, `${b.name}が${T.hold}（${b.host}）${over ? '。費用の超過が課題に' : ''}`, { domain: 'sports' });
      phoneMsg(g, `【ニュース】${b.name}が${T.hold}。各地が盛り上がっている`, 'ドット新聞 スポーツ部');
      const role = groupsRole(g);
      applyFx(g, { sup: 8, an: -6, ap: T.ap * (over ? 0.6 : 1), seg: { urban: 0.4, young: 0.4, families: 0.3 }, fame: role.ent ? 8 : 0 }, { id: 's_kyogi', role, domain: 'sports' });
      pushShock(g, 'bid_held', `${b.name}の開催`, { growth: 0.06 }, 40);
      b.log.unshift('開催');
    }
  }
}
function bidsMonthly(g, s) {
  for (const b of s.bids) {
    if (b.status !== 'prep') continue;
    const T = BID_TYPES[b.type];
    const months = Math.max(1, T.prep / MONTH);
    const part = (b.total * b.over) / months;
    b.spent += part;
    govSpend(g, part * 0.4, 'sports'); // a share is paid out of the budget frame (the rest: local government, private)
    pushShock(g, `bid:${b.id}`, `${b.name}の準備`, { growth: clamp(part / 3500, 0, 0.1), unemployment: -clamp(part / 12000, 0, 0.04) }, 40);
    if (b.over < 1.5 && roll(0.07)) {
      b.over = r2(b.over + 0.15 + rnd() * 0.15);
      b.log.unshift(`費用が膨らんだ（${Math.round((b.over - 1) * 100)}%超過）`);
      news(g, `${b.name}の準備費用が膨らむ見通し（${Math.round((b.over - 1) * 100)}%超過）`, { domain: 'sports' });
      moodAdd(g, -0.2, '大会費用の超過', 'deficit');
    }
    if (b.collusion !== true && collValue(g) > 55 && roll(0.04)) {
      b.collusion = true; b.log.unshift('招致をめぐる疑惑が報じられた');
      news(g, `${b.name}をめぐる発注・招致の疑惑が報じられた`, { domain: 'sports' });
      scandalHit(g, 1.2, `${b.name}をめぐる疑惑`);
    }
  }
  for (const b of s.bids) if (b.status !== 'prep') { const q = pushDrop(g, `bid:${b.id}`); void q; }
}
function pushDrop(g, key) { dropShock(g, key); }
const collValue = (g) => num(S(g).corr);
export function bidsSummary(g) {
  const s = S(g), d = gdate(g);
  const past = [];
  if (d.n >= 19640101) past.push('1964年 東京夏季五輪（実際の歴史）');
  if (d.n >= 19720101) past.push('1972年 札幌冬季五輪');
  if (d.n >= 19980207) past.push('1998年 長野冬季五輪');
  if (d.n >= 20020531) past.push('2002年 日韓ワールドカップ');
  if (d.n >= 20050325) past.push('2005年 愛知万博');
  const live = s.bids.filter((b) => ['declared', 'prep'].includes(b.status));
  return { active: live.map((b) => bidView(g, b)), done: s.bids.filter((b) => !['declared', 'prep'].includes(b.status)).slice(0, 4).map((b) => bidView(g, b)), past: past.slice(-4), agency: since(g, 20151001) ? 'スポーツ庁（2015年〜）' : '文部省（体育局）', types: BID_ORDER.map((t) => ({ type: t, name: bidName(g, t) })) };
}

// ================================================================ hooks
const HOOKS = {};
export function onGroups(event, fn) { (HOOKS[event] || (HOOKS[event] = [])).push(fn); return () => { HOOKS[event] = (HOOKS[event] || []).filter((f) => f !== fn); }; }
function emitG(g, event, data) { for (const fn of HOOKS[event] || []) { try { fn(g, data); } catch (e) { console.error(e); } } }

// ================================================================ the daily and monthly steps
function dailyStep(g, s) {
  const d = gdate(g);
  for (const id of GROUP_ORDER) {
    const grp = s.groups[id];
    if (!grp.on) continue;
    grp.mod *= 0.975; grp.gw *= 0.994; grp.infMod *= 0.9985;
    let heat = 0;
    for (const e of grp.griev) { e.heat *= 0.985; heat += e.heat; }
    grp.griev = grp.griev.filter((e) => e.heat >= 3);
    grp.an += (Math.min(100, heat) - grp.an) * 0.04;
    const target = clamp(grp.anchor + grp.gw + grp.mod - grp.an * 0.3, -100, 100);
    grp.s += (target - grp.s) * 0.07;
    if (!Number.isFinite(grp.s)) grp.s = 0;
    if (!Number.isFinite(grp.an)) grp.an = 10;
  }
  strikeDaily(g, s);
  panelsDaily(g, s);
  bidsDaily(g, s);
  expireCases(g);
  void d;
}
function syncActive(g, s, d, p, role) {
  for (const id of GROUP_ORDER) {
    const def = GROUP_DEFS[id], grp = s.groups[id];
    const want = groupActive(def, d.n);
    if (want && !grp.on) {
      grp.on = true;
      grp.anchor = anchorFor(g, def, 'player', p, role);
      grp.s = clamp(grp.anchor + (rnd() - 0.5) * 10, -70, 70);
      grp.an = 12;
      if (id === 'r_rengo') {
        const a = s.groups.r_somei, b = s.groups.r_domei;
        grp.s = clamp((num(a.s) + num(b.s)) / 2, -70, 70);
        grp.an = clamp((num(a.an) + num(b.an)) / 2, 0, 100);
        grp.gw = (num(a.gw) + num(b.gw)) / 2;
        for (const src of [a, b]) for (const e of src.griev.slice(0, 2)) addGriev(grp, e.id, e.text, e.heat * 0.8);
        news(g, '総評などが合流し、連合（日本最大の労働組合のナショナルセンター）が結成された', { domain: 'rengo' });
        phoneMsg(g, '【ニュース】連合が結成。官民の労働組合が一つに', 'ドット新聞 経済部');
      } else if (['b_shinko', 'c_hai', 'u_cool', 'r_union'].includes(id)) news(g, `${groupName(g, id)}が存在感を増している`, { domain: def.domain, feed: false });
    } else if (!want && grp.on) {
      grp.on = false;
    }
  }
}
function ambient(g, s, d, p, role) {
  const E = p && p.economy ? p.economy : null;
  const list = []; // [groupIds, key, text, heat]
  const add = (ids, key, text, heat) => list.push([ids, key, text, heat]);
  if (E) {
    if (num(E.growth) < 0) add(['b_keizai', 'b_doyu', 'b_chusho', 'k_shoten', 'k_kensetsu'], 'recession', '景気の悪化に苦しんでいる', 20 + Math.abs(num(E.growth)) * 12);
    if (num(E.unemployment) > 4.5) add(['r_rengo', 'r_somei', 'r_domei', 'r_union'], 'jobless', '失業の増加に強い危機感を持っている', 14 + (num(E.unemployment) - 4.5) * 9);
    if (num(E.inflation) > 3) add(['r_rengo', 'r_domei', 'r_somei', 'r_union', 'k_shoten', 'k_iryo'], 'infl', '物価の上昇に生活と経営が圧迫されている', 14 + (num(E.inflation) - 3) * 7);
    if (num(E.debtRatio) > 220) add(['g_zaimu'], 'debt', '財政の悪化に強い危機感を持っている', clamp((num(E.debtRatio) - 220) / 3, 10, 50));
    if (num(E.yen, 130) < 105 && d.year >= 1990) add(['b_keizai', 'ke_sangyo', 'k_nosui'], 'yenhigh', '急激な円高で輸出と生産が打撃を受けている', 22);
  }
  const rg = regime(g);
  if (rg && rg.id !== 'democracy') add(['a_bijutsu', 'a_hyogen', 'a_ongaku', 'y_hogaku', 'y_rondan', 'y_shakai', 'ke_gakujutsu', 'ke_daigaku', 'r_rengo', 'r_koumu'], 'regime', `${rg.name}のもとで自由が脅かされることを懸念している`, 36);
  if (has(g, 'pressFreedom')) { const pf = safe(() => g.pressFreedom(), null); if (pf) { s.art.freedom = num(pf.value, 70); if (num(pf.value) < 50) add(['a_hyogen', 'y_rondan', 'y_hogaku', 'a_bijutsu'], 'press', '報道・表現の自由の低下に強く抗議している', clamp((60 - num(pf.value)) * 1.4, 10, 60)); } }
  if (has(g, 'war') && safe(() => g.war(), null)) { add(['a_bijutsu', 'a_hyogen', 'y_hogaku', 'ke_gakujutsu', 'c_souen'], 'war', '戦争に反対し、停戦を求めている', 30); add(['t_kyokai', 't_yado'], 'warvis', '戦争で訪日客と観光客が激減している', 30); add(['b_keizai'], 'warbiz', '戦争による貿易と投資の悪影響を懸念している', 16); }
  if (has(g, 'disaster')) { const dz = safe(() => g.disaster(), null); if (dz && dz.phase && dz.phase !== 'done') { add(['t_kyokai', 't_yado'], 'disvis', '災害の風評で客足が落ちている', 22); add(['u_bunkazai'], 'disher', '被災した文化財の修復を急ぎたい', 20); } }
  if (has(g, 'world')) { const w = safe(() => g.world(), null); if (w && num(w.tension) >= 60) add(['t_kyokai', 'b_keizai'], 'tension', '国際緊張の高まりが経済と観光に影響することを懸念している', 14); }
  if (has(g, 'adminReform')) { const ar = safe(() => g.adminReform(), null); if (ar && ar.amakudari && num(ar.amakudari.heat) >= 50) add(['g_zaimu', 'g_keizai', 'g_naimu', 'g_gaibo', 'g_shakai'], 'amakudari', '天下りへの批判と調査に身構えている', clamp(num(ar.amakudari.heat) * 0.45, 8, 45)); }
  if (s.fiscal.over > 0) add(['g_zaimu'], 'framecheck', '各界向けの支出が枠を超えていることを問題視している', clamp(s.fiscal.over / frameOf(g) * 60, 8, 50));
  // set / clear
  const seen = new Set();
  for (const [ids, key, text, heat] of list) for (const id of ids) {
    const grp = s.groups[id];
    if (!grp || !grp.on) continue;
    seen.add(`${id}:${key}`);
    addGriev(grp, `amb:${key}`, text, clamp(heat, 0, 70));
  }
  for (const id of GROUP_ORDER) { const grp = s.groups[id]; for (const e of grp.griev) if (e.id.startsWith('amb:') && !seen.has(`${id}:${e.id.slice(4)}`)) e.heat *= 0.6; }
}
function lawsDiff(g, s, p) {
  if (!p || !Array.isArray(p.laws)) return;
  const last = num(s.flags.lawDay, 0);
  let max = last;
  for (const L of p.laws) {
    const day = num(L.day, 0);
    if (day <= last || !L.policy) continue;
    max = Math.max(max, day);
    for (const id of GROUP_ORDER) {
      const def = GROUP_DEFS[id], grp = s.groups[id];
      if (!grp.on) continue;
      if (def.likes.includes(L.policy)) { grp.mod = clamp(num(grp.mod) + 5, -60, 60); grp.an = clamp(grp.an - 4, 0, 100); if (influenceOf(g, id) >= 40 && !def.bureau) news(g, `${groupName(g, id)}が「${POLICY_NAME[L.policy] || L.title}」の成立を歓迎`, { domain: def.domain, feed: false }); }
      else if (def.dislikes.includes(L.policy)) { grp.mod = clamp(num(grp.mod) - 5, -60, 60); addGriev(grp, `law:${L.policy}`, `「${POLICY_NAME[L.policy] || L.title}」の成立に反発している`, 28); if (influenceOf(g, id) >= 40 && !def.bureau) news(g, `${groupName(g, id)}が「${POLICY_NAME[L.policy] || L.title}」の成立に反発`, { domain: def.domain, feed: false }); }
    }
  }
  s.flags.lawDay = max;
}
function generateCases(g, s, role) {
  if (role.kind === 'citizen' && !role.ent) return;
  const rf = { pm: 1, minister: 0.7, local: 0.5, member: 0.35, citizen: 0 }[role.kind];
  let made = 0;
  const quota = (role.pm ? (roll(0.8) ? 1 : 0) + (roll(0.3) ? 1 : 0) : roll(0.5) ? 1 : 0);
  const ids = GROUP_ORDER.filter((id) => s.groups[id].on).sort(() => rnd() - 0.5);
  if (rf > 0) for (const id of ids) {
    if (made >= quota) break;
    const grp = s.groups[id];
    if (GROUP_DEFS[id].radical || GROUP_DEFS[id].bureau && !role.cabinet) continue;
    const w = (0.06 + 0.22 * (num(grp.an) / 100) + 0.08 * (influenceOf(g, id) / 100)) * rf;
    if (roll(w) && makeDemand(g, id)) made++;
  }
  const politician = role.kind !== 'citizen';
  if (politician && !openCases(s).some((c) => c.kind === 'offer_don') && roll(0.35)) {
    const cands = ids.filter((id) => { const grp = s.groups[id]; return grp.s >= 30 && GROUP_DEFS[id].cap >= 25 && GROUP_DEFS[id].domain !== 'seifu' && !(GROUP_DEFS[id].radical); });
    if (cands.length) makeOffer(g, cands[0], 'offer_don');
  }
  if (politician) {
    const p = polOf(g);
    const near = p && ((p.elections && p.elections.upcoming) || []).some((e) => e && !e.newsOnly && e.day - today(g) <= 90 && e.day >= today(g));
    if (near && !openCases(s).some((c) => c.kind === 'offer_endorse') && roll(0.25)) {
      const cands = ids.filter((id) => s.groups[id].s >= 35 && influenceOf(g, id) >= 25 && GROUP_DEFS[id].domain !== 'seifu');
      if (cands.length) makeOffer(g, cands[0], 'offer_endorse');
    }
  }
  if (role.ent && !openCases(s).some((c) => c.kind === 'offer_amb') && role.fame >= 60 && roll(0.18)) {
    const cands = ids.filter((id) => s.groups[id].s >= 5 && ['tourism', 'sports', 'bunka', 'artist', 'kenkyu', 'kyokai'].includes(GROUP_DEFS[id].domain) && !(today(g) - num(s.groups[id].x.amb, -999) < 90));
    if (cands.length) makeOffer(g, cands[0], 'offer_amb');
  }
}
function monthlyDonations(g, s, role) {
  if (role.kind === 'citizen') return;
  const ids = GROUP_ORDER.filter((id) => { const grp = s.groups[id]; const def = GROUP_DEFS[id]; return grp.on && grp.s >= 35 && def.cap >= 20 && def.domain !== 'seifu' && !def.radical && num(grp.x.banned) < today(g); })
    .sort((a, b) => GROUP_DEFS[b].cap * s.groups[b].s - GROUP_DEFS[a].cap * s.groups[a].s).slice(0, 2);
  let total = 0, name = '';
  for (const id of ids) {
    if (!roll(0.4)) continue;
    const def = GROUP_DEFS[id], grp = s.groups[id];
    const amt = Math.round(donationAmount(g, grp, def, role) * 0.4 / 10000) * 10000;
    if (amt < 50000) continue;
    applyFx(g, { funds: amt, coll: 0.4 + amt / 3000000 }, { id, role, domain: def.domain });
    grp.don += amt; grp.owe += 0.3;
    total += amt; name = name || groupName(g, id);
  }
  if (total > 0) note(g, `（${name}などから、政治資金の献金が合わせて${fmtMoney(total)}届いた。収支報告書に記載が必要だ）`);
}
function collusionCheck(g, s, role) {
  s.corr = clamp(num(s.corr) * 0.985 - 0.2, 0, 100);
  if (role.kind === 'citizen') return;
  if (s.corr >= 55 && roll(0.1 + (s.corr - 55) / 220)) {
    const top = GROUP_ORDER.filter((id) => s.groups[id].on && s.groups[id].don > 0).sort((a, b) => s.groups[b].don - s.groups[a].don)[0] || 'b_keizai';
    news(g, `${groupName(g, top)}との関係が「癒着ではないか」と報じられた`, { domain: GROUP_DEFS[top].domain });
    scandalHit(g, 1.2 + s.corr / 60, `${groupName(g, top)}との癒着の疑い`, role);
    s.corr = clamp(s.corr - 28, 0, 100);
    for (const id of groupsOfDomain(GROUP_DEFS[top].domain)) { const gr = s.groups[id]; if (gr.on) gr.mod = clamp(num(gr.mod) - 2, -60, 60); }
    emitG(g, 'scandal', { kind: 'collusion', group: top });
  }
}
function aggregate(g, s, p, role) {
  let T = 0;
  for (const id of GROUP_ORDER) {
    const grp = s.groups[id];
    if (!grp.on) continue;
    const inf = influenceOf(g, id);
    T += (inf / 100) * (grp.s / 100) * DOMAINS[GROUP_DEFS[id].domain].w * 2.6;
    const ds = (grp.s - num(grp.applied)) / 100 * (inf / 100) * 2.0;
    if (Math.abs(ds) > 0.002 && sideParties(p, role).length) shiftSeg(g, { [GROUP_DEFS[id].seg]: ds }, 0.004, role);
    grp.applied = grp.s;
  }
  T = clamp(T, -3.5, 3.5);
  s.fx.ap = r2(T);
  if (role.cabinet) { const push = clamp(T / 4.67, -0.75, 0.75); if (Math.abs(push) >= 0.05) moodAdd(g, push * (role.pm ? 1 : 0.5), '各界の評価'); }
  else if (role.kind === 'member' && p && p.me) p.me.standing = clamp(num(p.me.standing) + clamp(T * 0.12, -0.4, 0.4), 0, 100);
  else if (role.kind === 'local' && p && p.me) p.me.localSupport = clamp(num(p.me.localSupport) + clamp(T * 0.15, -0.5, 0.5), 0, 100);
}
// ---- events (monthly; at most two news-making ones)
const EVENTS = [
  { id: 'dangou', p: (g, d) => (d.year >= 1990 && d.year <= 2010 ? 0.025 : 0.006), fire: (g, s) => caseScandal(g, s, 'k_kensetsu', '建設業界の談合疑惑', '公共工事の入札をめぐる談合の疑いが報じられた。業界団体の関与が指摘されている') },
  { id: 'iryo_short', p: (g, d) => (d.year >= 1998 ? 0.03 : 0.01), fire: (g, s) => caseProtest(g, s, 'k_iryo', '医師・看護師不足への訴え', '地方の病院で医師・看護師が足りず、診療の縮小が相次ぐ。団体が国に対策を求めて集会を開いた') },
  { id: 'karoshi', p: (g, d) => (d.year >= 1988 ? 0.03 : 0.01), fire: (g, s) => caseProtest(g, s, 'r_rengo', '過労死・長時間労働への抗議', '過労による死亡が労災と認められ、労働団体が長時間労働の規制強化を求めている') },
  { id: 'blackcorp', p: (g, d) => (d.year >= 2010 ? 0.025 : 0), fire: (g, s) => caseProtest(g, s, 'r_union', '「ブラック企業」への告発', '違法な働かせ方を告発する声がネットで広がり、ユニオンが記者会見を開いた') },
  { id: 'sports_scandal', p: () => 0.04, fire: (g, s) => caseScandal(g, s, pick(['s_kyogi', 's_pro', 's_chiiki']), 'スポーツ団体の不祥事', pick(['競技団体の幹部によるパワハラが明らかになった', '競技団体の経理の不正が発覚した', '学校の部活動で暴力問題が表面化した', '選手のドーピング疑惑が報じられた'])) },
  { id: 'sports_medal', p: () => 0.05, fire: (g, s) => good(g, s, 's_kyogi', '国際大会で日本選手が活躍し、全国が沸いた', 0.2, 6) },
  { id: 'biz_petition', p: (g, d) => (d.month >= 10 && d.month <= 12 ? 0.3 : 0.01), fire: (g, s) => { const c = makeDemand(g, 'b_keizai', {}); if (c) { news(g, '経済界が来年度の予算と税制に関する要望書を提出した', { domain: 'business' }); } return !!c; } },
  { id: 'biz_scandal', p: () => 0.025, fire: (g, s) => caseScandal(g, s, pick(['b_keizai', 'b_chusho']), '企業の不祥事', pick(['大手企業の検査データ偽装が発覚した', '下請けへの代金不払いが指摘された', '企業の不正会計が明らかになった'])) },
  { id: 'art_protest', p: (g) => 0.04 + (S(g).art.freedom < 60 ? 0.06 : 0), fire: (g, s) => caseProtest(g, s, pick(['a_hyogen', 'a_bijutsu']), '表現の自由をめぐる抗議', pick(['展覧会の作品が「不適切」と圧力を受け、展示が中止になった', '映画の公開が自主規制で延期され、制作者が抗議している', '公共施設での上演が中止になり、表現者が抗議声明を出した'])) },
  { id: 'art_award', p: () => 0.05, fire: (g, s) => good(g, s, 'a_bijutsu', '日本の作品が国際的な賞を受賞し、文化への関心が高まった', 0.15, 5) },
  { id: 'heritage_fire', p: () => 0.02, fire: (g, s) => { news(g, '歴史的建造物で火災。文化財の防災の弱さが指摘される', { domain: 'bunka' }); s.culture.damage += 1; addGriev(s.groups.u_bunkazai, 'fire', '文化財の火災と防災の不十分さ', 40); return !!makeDemand(g, 'u_bunkazai', {}); } },
  { id: 'matsuri_decline', p: () => 0.03, fire: (g, s) => { news(g, '担い手不足で、伝統の祭りが中止に追い込まれる地域が増えている', { domain: 'bunka', feed: false }); addGriev(s.groups.u_matsuri, 'decline', '担い手不足で祭りが続けられない', 28); return true; } },
  { id: 'cool_hit', p: (g, d) => (d.year >= 2005 ? 0.04 : 0), fire: (g, s) => good(g, s, 'a_hyogen', '日本のアニメ・マンガが海外で大ヒット。クールジャパンへの期待が高まる', 0.2, 5) },
  { id: 'young_pay', p: (g, d) => (d.year >= 2000 ? 0.035 : 0.01), fire: (g, s) => caseProtest(g, s, 'ke_wakate', '若手研究者の待遇への訴え', '任期付きで不安定な若手研究者が、待遇の改善を求める署名を集めた') },
  { id: 'expert_stmt', p: () => 0.05, fire: (g, s, d, role) => { const y = pick(['y_keizai', 'y_hogaku', 'y_shakai']); const gr = s.groups[y]; if (!gr.on) return false; const crit = gr.s < -10; news(g, `${groupName(g, y)}が政府の政策について${crit ? '批判的な' : '評価する'}声明を出した`, { domain: 'yushikisha' }); if (role.cabinet) moodAdd(g, crit ? -0.2 : 0.15, '有識者の声明'); return true; } },
  { id: 'chiji_req', p: () => 0.05, fire: (g, s) => !!makeDemand(g, pick(['g_chiji', 'g_shicho']), {}) },
  { id: 'overseas', p: (g, d) => (d.year >= 1990 ? 0.04 : 0.02), fire: (g, s) => good(g, s, 'b_keizai', '日本企業の海外進出が相次ぎ、貿易が好調', 0.15, 4) },
  { id: 'sect_recruit', p: (g, d) => (d.year >= 1990 ? 0.03 : 0.01), fire: (g, s) => { const id = pick(['c_wako', 'c_soukyu']); const gr = s.groups[id]; if (!gr.on) return false; news(g, `${groupName(g, id)}の勧誘をめぐり、相談が寄せられている`, { domain: 'sect', feed: false }); return true; } },
];
function good(g, s, id, text, ap, sup) {
  const gr = s.groups[id];
  if (!gr || !gr.on) return false;
  news(g, text, { domain: GROUP_DEFS[id].domain });
  gr.mod = clamp(num(gr.mod) + sup, -60, 60);
  const role = groupsRole(g);
  if (role.cabinet) moodAdd(g, ap, '各界の明るいニュース');
  return true;
}
function caseScandal(g, s, id, title, text) {
  const gr = s.groups[id];
  if (!gr || !gr.on || openCases(s).length >= 9) return false;
  const role = groupsRole(g);
  addGriev(gr, `sc:${s.seq}`, title, 18);
  news(g, `${title}：${text}`, { domain: GROUP_DEFS[id].domain });
  if (!roleHandles(role, GROUP_DEFS[id].domain, 'law')) return true; // for others it stays a headline
  const c = { id: `c${s.seq++}`, kind: 'scandal', group: id, domain: GROUP_DEFS[id].domain, title, text: `${groupName(g, id)}をめぐり、${text}。政府の対応が問われている。`, day: today(g), due: today(g) + 12, status: 'open', data: {}, res: null };
  s.cases.unshift(c);
  return true;
}
function caseProtest(g, s, id, title, text) {
  const gr = s.groups[id];
  if (!gr || !gr.on || openCases(s).length >= 9) return false;
  const role = groupsRole(g);
  addGriev(gr, `pr:${s.seq}`, title, 24);
  news(g, `${title}：${text}`, { domain: GROUP_DEFS[id].domain });
  if (!roleHandles(role, GROUP_DEFS[id].domain, 'law')) return true;
  const c = { id: `c${s.seq++}`, kind: 'protest', group: id, domain: GROUP_DEFS[id].domain, title, text: `${groupName(g, id)}：${text}。政府の対応を求めている。`, day: today(g), due: today(g) + 14, status: 'open', data: {}, res: null };
  s.cases.unshift(c);
  return true;
}
function rollEvents(g, s, d, role) {
  let n = 0;
  const shuffled = EVENTS.slice().sort(() => rnd() - 0.5);
  for (const e of shuffled) {
    if (n >= 2) break;
    const p = typeof e.p === 'function' ? e.p(g, d) : e.p;
    if (p > 0 && roll(p)) { try { if (e.fire(g, s, d, role)) n++; } catch (err) { console.error(err); } }
  }
}
function milestones(g, s) {
  const inb = inboundMan(g);
  for (const m of [1000, 2000, 3000, 4000, 5000]) {
    if (inb >= m && !s.flags[`mile${m}`]) {
      s.flags[`mile${m}`] = true;
      if (gdate(g).year >= 2010 || inb >= m * 1.0) news(g, `訪日外国人が年${m}万人の水準を超えた（目安）。${m >= 3000 ? 'オーバーツーリズムへの対策も課題に' : '観光立国の成果が見えてきた'}`, { domain: 'tourism' });
    }
  }
}
export function monthlyStep(g, s, d) {
  const p = polOf(g);
  const role = groupsRole(g);
  syncActive(g, s, d, p, role);
  for (const id of GROUP_ORDER) {
    const def = GROUP_DEFS[id], grp = s.groups[id];
    if (!grp.on) continue;
    grp.anchor = anchorFor(g, def, 'player', p, role);
    grp.govAnchor = anchorFor(g, def, 'gov', p, role);
    grp.infMod *= 0.97;
    // the leaders change now and then
    if (today(g) - num(grp.leaders[0].since) > 480 && roll(0.04)) { const old = grp.leaders[0]; grp.leaders[0] = makeLeader(def.id, 0, old.title, Math.floor(today(g) / 30), today(g)); news(g, `${groupName(g, id)}の新しい${old.title}に${grp.leaders[0].name}氏が就任`, { domain: def.domain, feed: false }); }
  }
  ambient(g, s, d, p, role);
  lawsDiff(g, s, p);
  tourismMonthly(g, s);
  unionMonthly(g, s);
  sectMonthly(g, s);
  rdMonthly(g, s);
  seifuMonthly(g, s);
  panelsMonthly(g, s);
  bidsMonthly(g, s);
  generateCases(g, s, role);
  monthlyDonations(g, s, role);
  collusionCheck(g, s, role);
  rollEvents(g, s, d, role);
  milestones(g, s);
  if (d.month === 11 && s.culture.lastHonor !== d.year) { s.culture.lastHonor = d.year; news(g, `今年の文化功労者が発表された（${d.year}年）`, { domain: 'bunka', feed: false }); for (const id of ['u_dento', 'u_bunkazai', 'a_bijutsu', 'a_ongaku']) if (s.groups[id].on) s.groups[id].mod = clamp(num(s.groups[id].mod) + 2, -60, 60); }
  if (num(s.flags.eventBoostUntil) < today(g)) s.flags.eventBoostUntil = 0;
  aggregate(g, s, p, role);
  // the monthly ring (for the screens' small charts)
  const row = { ym: d.ym };
  for (const dm of DOMAIN_ORDER) { const ids = groupsOfDomain(dm).filter((id) => s.groups[id].on); row[dm] = ids.length ? r0(ids.reduce((a, id) => a + s.groups[id].s, 0) / ids.length) : 0; }
  s.hist.push(row); if (s.hist.length > 36) s.hist.shift();
  // the fiscal year turns over in April
  const fy = Math.floor(d.fy);
  if (s.fiscal.fy !== fy) { s.fiscal.fy = fy; s.fiscal.spent = 0; s.fiscal.by = {}; s.fiscal.over = 0; }
}
export function groupsTick(g) {
  if (!g || !g.state) return;
  try {
    const s = S(g);
    const day = today(g);
    if (s.lastDay === day) return;
    s.lastDay = day;
    dailyStep(g, s);
    const d = gdate(g);
    if (s.lastYm !== d.ym) { s.lastYm = d.ym; monthlyStep(g, s, d); }
  } catch (e) { console.error('[groups] tick', e); }
}

// ================================================================ views for the screens
export function domainSummary(g, domain) {
  const s = S(g), D = DOMAINS[domain];
  const ids = groupsOfDomain(domain).filter((id) => s.groups[id].on);
  const cases = openCases(s).filter((c) => c.domain === domain);
  const avg = ids.length ? ids.reduce((a, id) => a + s.groups[id].s, 0) / ids.length : 0;
  const an = ids.length ? Math.max(...ids.map((id) => s.groups[id].an)) : 0;
  const inf = ids.length ? Math.max(...ids.map((id) => influenceOf(g, id))) : 0;
  const hist = s.hist.map((r) => num(r[domain]));
  return { id: domain, name: D.name, full: D.full, color: D.color, desc: D.desc, n: ids.length, avg: r0(avg), label: supportLabel(avg), anger: r0(an), angerLabel: angerLabel(an), inf: r0(inf), cases: cases.length, due: cases.filter((c) => num(c.due) - today(g) <= 7).length, hist, ids, control: domainControl(groupsRole(g), domain), minister: ministerOf(g, domain), inst: institutionsNow(g, domain) };
}
export function groupView(g, id) {
  const s = S(g), def = GROUP_DEFS[id], grp = s.groups[id];
  if (!def || !grp) return null;
  const inf = influenceOf(g, id);
  const role = groupsRole(g);
  const cases = groupCases(g, { group: id });
  const link = grp.x.link || null;
  const pro = [], con = [];
  const lead = grp.leaders[0];
  const sh = (pid) => String(POLICY_NAME[pid] || pid).replace(/（.*$/, '');
  for (const pid of def.likes.slice(0, 2)) pro.push(`「${sh(pid)}」を進めてほしい（${lead.title}）`);
  for (const pid of def.dislikes.slice(0, 2)) con.push(`「${sh(pid)}」には反対（${lead.title}）`);
  if (!pro.length && def.asks[0]) pro.push(`「${def.asks[0][1]}」（${lead.title}）`);
  if (!con.length && def.asks[1]) con.push(`「${def.asks[1][1]}」（${lead.title}）`);
  return {
    id, domain: def.domain, domainName: DOMAINS[def.domain].name, name: groupName(g, id), kana: def.kana, kind: def.kind, seg: def.seg, segName: SEG_NAME[def.seg] || def.seg, on: grp.on, note: def.note || null,
    support: r0(grp.s), supportLabel: supportLabel(grp.s), govSupport: r0(grp.govAnchor), anger: r0(grp.an), angerLabel: angerLabel(grp.an), influence: r0(inf), influenceLabel: inf >= 60 ? '非常に強い' : inf >= 40 ? '強い' : inf >= 20 ? 'ふつう' : '小さい', capacity: def.cap, capacityLabel: def.cap >= 60 ? '大きい' : def.cap >= 30 ? 'ふつう' : def.cap > 0 ? '小さい' : 'なし',
    lean: def.lean, leaders: grp.leaders.map((l) => ({ ...l, personaName: LEADER_PERSONAS[l.persona].name, personaDesc: LEADER_PERSONAS[l.persona].desc })), grievances: grp.griev.map((e) => ({ id: e.id, text: e.text, heat: r0(e.heat) })).sort((a, b) => b.heat - a.heat),
    cases, asks: def.asks.map((a) => ({ kind: a[0], kindName: ASK_KIND_NAME[a[0]], text: a[1] })), log: grp.log.slice(0, 6), met: grp.met, owe: r1(grp.owe), don: grp.don, cred: grp.x.cred != null ? r0(grp.x.cred) : null,
    radical: def.radical ? r0(grp.x.radical) : null, radicalKnown: def.radical ? (today(g) - num(grp.x.known, -999) < 90 || num(grp.x.watch) >= 1) : false, radicalLabel: def.radical ? radicalLabel(grp.x.radical) : null, watch: r1(grp.x.watch || 0),
    silent: num(grp.x.silent) > today(g) ? grp.x.silent - today(g) : 0, banned: num(grp.x.banned) > today(g) ? grp.x.banned - today(g) : 0, coop: num(grp.x.coop), link, pro: pro.slice(0, 2), con: con.slice(0, 2), likes: def.likes.map((x) => POLICY_NAME[x] || x), dislikes: def.dislikes.map((x) => POLICY_NAME[x] || x),
    control: domainControl(role, def.domain),
  };
}
export function groupsList(g, domain) {
  const s = S(g);
  return groupsOfDomain(domain).filter((id) => s.groups[id].on).map((id) => groupView(g, id));
}
// domain-specific panels for the screens
export function groupsSpecial(g, domain) {
  switch (domain) {
    case 'tourism': return { ...tourismSummary(g), siteList: sitesList(g), candList: sitesList(g, { cands: true }) };
    case 'rengo': { const u = unionSummary(g); return { ...u, minWageValue: u.minWage, minWage: minWageActions(g) }; }
    case 'sports': return bidsSummary(g);
    case 'kenkyu': return rdSummary(g);
    case 'seifu': return seifuSummary(g);
    case 'yushikisha': return { panels: panelsList(g), backing: backingList(g), themes: THEME_ORDER.filter((t) => !THEMES[t].from || gdate(g).n >= THEMES[t].from).map((t) => ({ id: t, name: THEMES[t].name, axis: THEMES[t].axis })), shelved: (S(g).flags.shelved || []).length };
    case 'artist': { const s = S(g); return { freedom: r0(s.art.freedom), protests: s.art.protests, ent: groupsRole(g).ent, fame: groupsRole(g).fame, note: groupsRole(g).ent ? 'あなたは芸能人。団体の応援・抗議・顕彰で、知名度とファンが動く' : null }; }
    case 'bunka': { const s = S(g); return { heritage: s.culture.heritage, damage: s.culture.damage, agency: since(g, 19680615) ? '文化庁（1968年〜）' : '文部省（文化局）', cool: since(g, 20100618) ? 'クール・ジャパン戦略（2010年〜）' : null }; }
    case 'business': { const s = S(g); return { corr: r0(s.corr), donations: r0(s.fx.don), law: since(g, 20000101) ? '政治家個人あての企業・団体献金は禁止（2000年〜）。政党・政党支部あては可' : '資金管理団体などへの団体献金（上限あり）', petition: [10, 11, 12].includes(gdate(g).month) ? '予算と税制の要望書の季節（秋〜冬）' : null }; }
    case 'sect': { const s = S(g); return { watch: groupsOfDomain('sect').filter((id) => s.groups[id].on && GROUP_DEFS[id].radical).map((id) => ({ id, name: groupName(g, id), radical: r0(s.groups[id].x.radical), known: today(g) - num(s.groups[id].x.known, -999) < 90 || num(s.groups[id].x.watch) >= 1, watch: r1(s.groups[id].x.watch || 0) })), law: since(g, 19991227) ? '団体規制法（観察処分）あり' : '破壊活動防止法（1952年）のみ', realParty: govRealParty(g) }; }
    case 'kyokai': { const s = S(g); return { corr: r0(s.corr), law: since(g, 20000101) ? '政治家個人あての団体献金は禁止（2000年〜）' : '資金管理団体への団体献金（上限あり）' }; }
    default: return {};
  }
}
export function groupsSummary(g) {
  const s = S(g), role = groupsRole(g), d = gdate(g);
  const doms = DOMAIN_ORDER.map((id) => domainSummary(g, id));
  const open = groupCases(g, { options: false });
  const frame = frameOf(g);
  return {
    date: `${d.year}年${d.month}月`, role, domains: doms, cases: open.length, due: open.filter((c) => c.left <= 7).length, ap: s.fx.ap, donations: r0(s.fx.don), corr: r0(s.corr),
    fiscal: { spent: r0(s.fiscal.spent), frame, over: r0(s.fiscal.over), text: `各界向けの支出 ${fmtOku(s.fiscal.spent)}／年間の目安の枠 ${fmtOku(frame)}` }, news: s.news.slice(0, 12), advice: groupsAdvice(g).slice(0, 4),
    hot: GROUP_ORDER.filter((id) => s.groups[id].on && s.groups[id].an >= 45).map((id) => ({ id, name: groupName(g, id), anger: r0(s.groups[id].an) })).slice(0, 5),
    best: GROUP_ORDER.filter((id) => s.groups[id].on).sort((a, b) => s.groups[b].s * influenceOf(g, b) - s.groups[a].s * influenceOf(g, a)).slice(0, 3).map((id) => ({ id, name: groupName(g, id), s: r0(s.groups[id].s) })),
    worst: GROUP_ORDER.filter((id) => s.groups[id].on).sort((a, b) => s.groups[a].s * influenceOf(g, a) - s.groups[b].s * influenceOf(g, b)).slice(0, 3).map((id) => ({ id, name: groupName(g, id), s: r0(s.groups[id].s) })),
  };
}
export function groupsAdvice(g) {
  const s = S(g), role = groupsRole(g);
  const out = [];
  const cs = openCases(s).slice().sort((a, b) => a.due - b.due);
  if (cs[0] && role.kind !== 'citizen') out.push(`案件「${cs[0].title}」の期限は${dueText(g, cs[0])}。「各界」の案件で答えよう`);
  const act = s.union.strikes.find((x) => x.status === 'active');
  if (act && role.cabinet) out.push(`${act.name}のストライキが続いている。政府の対応を決めよう`);
  const pr = s.panels.find((x) => x.status === 'reported');
  if (pr && role.cabinet) out.push(`有識者会議の報告書が出た（${THEMES[pr.theme].name}）。採否を決めよう`);
  const hot = GROUP_ORDER.filter((id) => s.groups[id].on && s.groups[id].an >= 55 && influenceOf(g, id) >= 30)[0];
  if (hot) out.push(`${groupName(g, hot)}の不満が高まっている。会談して話を聞こう`);
  const jam = s.sites.find((x) => x.status === 'designated' && x.crowd >= 78 && x.owner === 'player');
  if (jam && role.kind !== 'citizen') out.push(`${jam.name}が混雑している。混雑対策を考えよう`);
  const bid = s.bids.find((b) => b.status === 'declared' && b.camp < 0.6);
  if (bid && role.kind !== 'citizen') out.push(`${bid.name}の誘致の決定まであと${Math.max(0, bid.decideDay - today(g))}日。招致活動で見込みを上げられる`);
  if (s.corr >= 45 && role.kind !== 'citizen') out.push(`癒着の疑いのメーターが高い（${r0(s.corr)}）。団体への便宜と献金に注意しよう`);
  if (!out.length) out.push(role.kind === 'citizen' ? '芸能人として、団体の応援や寄付で関係を築ける（応援に出る・寄付する）' : '各界の団体と会談して関係をつくろう。要望には期限がある');
  return out;
}
export function groupsNews(g, n = 12) { return S(g).news.slice(0, n); }

// ================================================================ install
export function installGroups(proto) {
  Object.assign(proto, {
    groups() { return groupsSummary(this); },
    groupsRole() { return groupsRole(this); },
    groupDomains() { return DOMAIN_ORDER.map((id) => domainSummary(this, id)); },
    groupList(domain) { return groupsList(this, domain); },
    group(id) { return groupView(this, id); },
    groupActions(id) { return groupActionsList(this, id); },
    groupActionPreview(id, kind, opt) { return groupActionPreview(this, id, kind, opt); },
    groupAct(id, kind, opts) { return groupAct(this, id, kind, opts || {}).then((r) => { if (r && r.ok) emitG(this, 'act', { id, kind, r }); return r; }); },
    groupCases(opts) { return groupCases(this, opts || {}); },
    groupCaseAnswer(id, key, opts) { return caseAnswer(this, id, key, opts || {}).then((r) => { if (r && r.ok) emitG(this, 'answer', { id, key, r }); return r; }); },
    groupNews(n) { return groupsNews(this, n); },
    groupsAdvice() { return groupsAdvice(this); },
    groupsSpecial(domain) { return groupsSpecial(this, domain); },
    groupsInstitutions(domain) { return institutionsNow(this, domain); },
    groupsTick() { groupsTick(this); },
    tourism() { return { ...tourismSummary(this), siteList: sitesList(this), candList: sitesList(this, { cands: true }) }; },
    sites(o) { return sitesList(this, o || {}); },
    siteActions(id) { return siteActionsList(this, id); },
    siteActionPreview(id, kind, opt) { return siteActionPreview(this, id, kind, opt); },
    siteAct(id, kind, opts) { const r = siteAct(this, id, kind, opts || {}); if (r && r.ok) emitG(this, 'site', { id, kind, r }); return r; },
    union() { return unionSummary(this); },
    minWageActions() { return minWageActions(this); },
    minWageAct(key) { return minWageAct(this, key); },
    rdStatus() { return rdSummary(this); },
    seifuStatus() { return seifuSummary(this); },
    panels() { return panelsList(this); },
    panelThemes() { return THEME_ORDER.map((t) => ({ id: t, name: THEMES[t].name, axis: THEMES[t].axis, why: panelBlock(this, t) })); },
    panelPreview(theme, o) { return panelPreview(this, theme, o || {}); },
    panelConvene(theme, o) { const r = panelConvene(this, theme, o || {}); if (r && r.ok) emitG(this, 'panel', { theme, r }); return r; },
    panelAnswerPreview(id) { return panelAnswerPreview(this, id); },
    panelAnswer(id, key) { return panelAnswer(this, id, key); },
    panelBacking() { return backingList(this); },
    bids() { return bidsSummary(this); },
    bidPreview(type) { return bidPreview(this, type); },
    bidDeclare(type) { const r = bidDeclare(this, type); if (r && r.ok) emitG(this, 'bid', { type, r }); return r; },
    bidCampaignPreview(id) { return bidCampaignPreview(this, id); },
    bidCampaign(id) { return bidCampaign(this, id); },
    bidWithdraw(id) { return bidWithdraw(this, id); },
    groupsCost(cost) { return costText(this, cost); },
  });
}
installGroups(Game.prototype);
onMorning((g) => groupsTick(g));
if (typeof window !== 'undefined') window.__groups = { S, GROUP_DEFS, DOMAINS, ACTIONS, CASE_KINDS, groupsTick, gdate, groupsRole, setGroupsRng, applyFx, THEMES, BID_TYPES, SITE_KINDS };
