// 貿易・関税 (trade and tariffs): Japan's tariff rates by product category through the eras (real history: GATT, the 1988
// agreement on 牛肉・オレンジ (liberalised 1991), the Uruguay Round (1993 agreement; WTO 1995), 米の関税化 1999, the first
// EPA 2002, TPP 2016 → CPTPP 2018, 日EU 2019, 日米貿易協定 2020, RCEP 2022, the US tariffs of 2018 and 2025), the revenue
// (関税収入 ≈ 1兆円) the budget can read through g.tariffRevenue(), the player's tools (change a rate by law, 追加関税 on a
// country by 政令, 適用除外, 緊急関税, 関税交渉, EPA negotiation with rounds), the partners' retaliation, trade frictions
// (history-flavoured, fictional instances) and the effects on prices, growth, the trade balance, the approval and the relations.
// Created by world.js (createTrade(X, DP)); no imports of its own.
//
// FIGURES: rates are rounded 目安 for the game (WTO simple averages 2021: all 4.2%, non-agricultural 2.5%, agricultural 14.9%;
// industrial products 3.8% → 1.5% around the Uruguay Round (trade-weighted); beef 70% 1991 / 60% 1992 / 50% 1993 → 38.5% 2000 →
// 27.5% 2018-12 → 9% 2033 (CPTPP / 日米協定 schedules); rice 341円/kg and the 77万トン minimum access; the 関税収入 was
// 1兆84億円 in FY2022 (財務省)). Sources: mof.go.jp, maff.go.jp, mofa.go.jp, cas.go.jp (TPP), jetro.go.jp (2026 US tariffs).
// Rules: partners are named by country, leaders by title only; costs and odds are shown; nothing is refused for being "bad".

const A = (...p) => p;
const SEGN = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経済界', farmers: '農林漁業', unions: '労働組合', urban: '都市住民', rural: '地方住民', floating: '無党派層' };
function interp(anchors, y) {
  if (y <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) { const [y1, v1] = anchors[i]; if (y <= y1) { const [y0, v0] = anchors[i - 1]; return v0 + ((v1 - v0) * (y - y0)) / Math.max(1e-6, y1 - y0); } }
  return anchors[anchors.length - 1][1];
}
const byDate = (rows, n) => { let v = rows[0]; for (const r of rows) if (n >= r[0]) v = r; return v; };

// ---------------------------------------------------------------- Japan's import tariffs by category
export const TARIFF_CATS = {
  rice: {
    id: 'rice', name: 'コメ', group: '農産物', unit: '円/kg', min: 0, max: 600, step: 20, world: 44, qeq: [[0, 0]],
    hist: [[0, 600, '輸入は原則として禁止（食糧管理法）'], [19950401, 600, 'ミニマム・アクセス（最低限の輸入枠）が始まる。関税化はせず、枠を年々増やす特例措置を選んだ'], [19990401, 341, '米の関税化。枠外の輸入は341円/kgの関税（枠内のミニマム・アクセス77万トンは無税）']],
    bound: [[0, 600], [19990401, 341]], imp: A([1987, 0], [2026, 0.03]), cpiW: A([1987, 0.016], [2026, 0.012]), pMax: 45, sc: 330, gMax: -0.04, eMax: 0.4,
    seg: { farmers: 1.2, rural: 0.7, elderly: 0.15, families: -0.4, urban: -0.3, business: -0.2, young: -0.15 },
    who: '稲作農家と農村。コメは食料安全保障の象徴でもある', pro: ['稲作農家と農村の暮らし、水田の景色を守る', '食料の自給と備蓄の土台になる'], con: ['消費者はコメを高く買うことになる', '交渉のたびに最大の標的になり、ほかの分野の取引を難しくする', '農家の高齢化が進み、関税だけでは守りきれないという指摘'],
    note: [[19930901, '1993年の冷夏で「平成の米騒動」が起き、緊急輸入が行われた（1993〜94年）。'], [20250301, '2025年には米価が高騰し、備蓄米の放出が行われた。']],
  },
  livestock: {
    id: 'livestock', name: '畜産物（牛肉・豚肉・乳製品）', group: '農産物', unit: '%', min: 0, max: 120, step: 2.5, qeq: [[0, 60], [19910401, 0]],
    hist: [[0, 25, '牛肉は輸入割当（数量の制限）と関税25%'], [19910401, 70, '牛肉の輸入割当を撤廃。かわりに関税を70%に（1988年の日米合意）'], [19920401, 60, '牛肉の関税 60%'], [19930401, 50, '牛肉の関税 50%'], [19950401, 48.1, 'ウルグアイ・ラウンドの合意にもとづく引き下げ（毎年少しずつ）'], [19960401, 46.2, ''], [19970401, 44.2, ''], [19980401, 42.3, ''], [19990401, 40.4, ''], [20000401, 38.5, '牛肉の関税 38.5%（ウルグアイ・ラウンドの最終水準）'], [20181230, 27.5, 'TPP11（CPTPP）の発効。牛肉は38.5% → 27.5%、16年かけて9%へ'], [20190401, 26.6, ''], [20200401, 25.8, '日米貿易協定（2020年1月）・日EU協定の水準に'], [20210401, 24.9, ''], [20250401, 21.6, ''], [20260401, 20.8, '牛肉 20.8%（2033年度に9%へ）']],
    bound: [[0, 70], [19950401, 50], [20000401, 38.5]], imp: A([1987, 4.5], [1996, 4.8], [2004, 3.5], [2026, 2.9]), cpiW: A([1987, 0.03], [2026, 0.024]), pMax: 28, sc: 55, gMax: -0.05, eMax: 0.3,
    seg: { farmers: 1.0, rural: 0.6, families: -0.35, urban: -0.25, business: -0.15, young: -0.1 },
    who: '肉牛・酪農・養豚の農家', pro: ['畜産農家の経営を支え、国産の畜産を維持する', '口蹄疫や牛海綿状脳症（BSE）の危機のときに国内の供給を守る'], con: ['牛肉・チーズ・豚肉が高く、家計の負担になる', '輸出国との交渉でたびたび譲歩を迫られる'],
    note: [[19870401, '牛肉・オレンジの輸入割当の撤廃は、日米の長い交渉の焦点になっている。'], [19910401, '1991年4月に牛肉・オレンジが自由化された（1988年6月の日米合意）。'], [20031224, '2003年末には米国産牛肉がBSEで輸入停止になった（2006年に条件つきで再開）。']],
  },
  farm: {
    id: 'farm', name: 'そのほかの農産物（麦・砂糖・野菜・果物）', group: '農産物', unit: '%', min: 0, max: 80, step: 2.5, qeq: [[0, 20], [19920401, 6], [19960401, 0]],
    hist: [[0, 26, '農産物の多くに輸入割当と高い関税（オレンジは1992年に自由化）'], [19920401, 24, 'オレンジ・オレンジジュースの自由化が進む'], [19950401, 21, 'WTOの発足。輸入の数量制限を関税に置きかえる（関税化）'], [20000401, 17.5, 'ウルグアイ・ラウンドの約束の期間が終わる（2000年）'], [20081201, 16.5, '日ASEAN協定など、EPAの拡大で少しずつ低下'], [20181230, 15.5, 'CPTPPで農林水産品の関税撤廃率が約8割に'], [20210401, 14.9, 'WTOの単純平均（農産品）14.9%（2021年）'], [20260401, 13.5, '']],
    bound: [[0, 40], [19950401, 30], [20000401, 22]], imp: A([1987, 8], [1996, 8], [2004, 7], [2026, 6.5]), cpiW: A([1987, 0.07], [2026, 0.06]), pMax: 16, sc: 22, gMax: -0.08, eMax: 0.3,
    seg: { farmers: 1.0, rural: 0.6, families: -0.3, urban: -0.25, business: -0.2, young: -0.1 },
    who: '麦・てんさい・かんしょ・野菜・果樹の農家', pro: ['国内の産地を守り、地域の雇用を支える', '主食以外の食料自給率を保つ'], con: ['食品の値段が高くなる', '輸出国から開放を迫られやすい'],
    note: [[20010401, '2001年には中国産のネギ・生シイタケ・畳表に暫定セーフガードを発動し、中国が日本車などに高い関税で対抗する貿易摩擦になった。']],
  },
  fish: {
    id: 'fish', name: '水産物', group: '農産物', unit: '%', min: 0, max: 40, step: 1, qeq: [[0, 5], [19960401, 0]],
    hist: [[0, 10, '水産物の関税（平均の目安）'], [19950401, 7, 'WTOの発足'], [20040401, 5.5, ''], [20181230, 4.5, 'CPTPPなどで撤廃が進む'], [20260401, 3.5, '']],
    bound: [[0, 18], [19950401, 12]], imp: A([1987, 5], [1996, 4.5], [2004, 3.2], [2026, 2.5]), cpiW: A([1987, 0.03], [2026, 0.025]), pMax: 14, sc: 12, gMax: -0.04, eMax: 0.3,
    seg: { farmers: 0.7, rural: 0.35, families: -0.25, urban: -0.2, business: -0.1 },
    who: '漁業者と水産加工業', pro: ['漁業と沿岸の町を守る'], con: ['魚介類の値段が上がる', '日本は水産物の輸出国でもあり、報復を受けやすい'], note: [],
  },
  industrial: {
    id: 'industrial', name: '工業製品（機械・電子・化学）', group: '工業', unit: '%', min: 0, max: 40, step: 0.5, qeq: [[0, 0]],
    hist: [[0, 3.8, '工業品の平均関税率（貿易加重平均）3.8%'], [19950401, 2.6, 'ウルグアイ・ラウンドの実施（1995〜2000年に3.8% → 1.5%）'], [19960401, 2.4, ''], [19970401, 2.1, ''], [19980401, 1.9, ''], [19990401, 1.7, ''], [20000401, 1.5, '工業品の平均 1.5%'], [20081201, 1.3, 'EPAの拡大'], [20190201, 1.1, '日EU・TPP11'], [20220101, 1.0, 'RCEP（中国・韓国と初めてのEPA）']],
    bound: [[0, 5], [19950401, 4]], imp: A([1987, 28], [1996, 38], [2004, 43], [2026, 47]), cpiW: A([1987, 0.14], [2026, 0.16]), pMax: 5, sc: 14, gMax: -0.8, eMax: 0.25,
    seg: { business: -0.6, employees: -0.1, unions: 0.25, selfemployed: 0.1, families: -0.2, urban: -0.15, young: -0.15 },
    who: '輸入品と競争する国内メーカー（部品・素材には負担）', pro: ['国内の工場と雇用を守る', '新しい産業を育てる時間をかせぐ'], con: ['部品・素材が高くなり、輸出企業の競争力が落ちる', '相手国が日本の輸出品に同じ手で報復する'], note: [],
  },
  auto: {
    id: 'auto', name: '自動車・部品', group: '工業', unit: '%', min: 0, max: 60, step: 2.5, qeq: [[0, 0]],
    hist: [[0, 0, '乗用車の輸入関税は0%（1978年から）。部品もごく低い'], [20081201, 0, '']],
    bound: [[0, 0]], imp: A([1987, 1.5], [1996, 2.6], [2004, 2.2], [2026, 2.4]), cpiW: A([1987, 0.04], [2026, 0.04]), pMax: 8, sc: 18, gMax: -0.15, eMax: 0.4,
    seg: { employees: 0.15, unions: 0.35, business: -0.35, families: -0.25, urban: -0.15, young: -0.15, selfemployed: 0.05 },
    who: '輸入車と競争する国内メーカー', pro: ['国産メーカーと下請けの雇用を守る'], con: ['輸入車・部品が高くなる', '日本の最大の輸出品である自動車で、相手国の報復の標的になる'],
    note: [[19810101, '日本の自動車は1981年から対米の輸出自主規制（台数の枠）を受けている。'], [19940401, '対米の輸出自主規制は1994年3月に終わった。'], [19950601, '1995年5月に米国が高級車に100%の関税を警告し、6月に交渉で回避された。']],
  },
  energy: {
    id: 'energy', name: 'エネルギー・資源（原油・石炭・LNG）', group: '資源', unit: '%', min: 0, max: 20, step: 0.5, qeq: [[0, 0]],
    hist: [[0, 0.5, '原油・石炭などの関税はほぼ無税（石油石炭税は別）'], [20260401, 0.3, '']],
    bound: [[0, 1]], imp: A([1987, 36], [1996, 23], [2004, 28], [2026, 24]), cpiW: A([1987, 0.07], [2026, 0.09]), pMax: 14, sc: 12, gMax: -0.9, eMax: 0.2,
    seg: { business: -0.7, families: -0.6, employees: -0.35, elderly: -0.4, rural: -0.45, urban: -0.25, young: -0.25 },
    who: '（国内にほぼ産出はなく、国内の保護される産業はない）', pro: ['関税収入が増える', '省エネを促すきっかけになる'], con: ['電気・ガス・ガソリンが上がり、家計と企業の負担になる', '産業全体のコストが上がる'], note: [],
  },
  apparel: {
    id: 'apparel', name: '繊維・衣類', group: '工業', unit: '%', min: 0, max: 40, step: 1, qeq: [[0, 0]],
    hist: [[0, 14, '衣類の関税（品目により10〜15%）'], [19950401, 12, 'WTOの発足'], [20040401, 9.5, ''], [20081201, 9, 'ASEANとのEPA'], [20260401, 8, '']],
    bound: [[0, 18], [19950401, 14]], imp: A([1987, 3.5], [1996, 7.5], [2004, 8], [2026, 5.3]), cpiW: A([1987, 0.05], [2026, 0.04]), pMax: 8, sc: 12, gMax: -0.1, eMax: 0.35,
    seg: { unions: 0.25, selfemployed: 0.2, families: -0.35, young: -0.3, urban: -0.2, employees: -0.1, elderly: -0.1 },
    who: '国内の繊維・縫製業', pro: ['地方の縫製工場と雇用を守る'], con: ['衣料品の値段が上がる', '1960〜70年代の繊維摩擦のように、日米の対立の種になる'], note: [],
  },
  steel: {
    id: 'steel', name: '鉄鋼・金属', group: '工業', unit: '%', min: 0, max: 40, step: 0.5, qeq: [[0, 0]],
    hist: [[0, 3.2, '鉄鋼の関税'], [19950401, 1.2, ''], [20040401, 0.6, ''], [20260401, 0.3, '']],
    bound: [[0, 6], [19950401, 3]], imp: A([1987, 2.5], [1996, 2.0], [2004, 2.8], [2026, 2.6]), cpiW: A([1987, 0.01], [2026, 0.01]), pMax: 6, sc: 12, gMax: -0.35, eMax: 0.3,
    seg: { unions: 0.3, business: -0.4, employees: 0.05, rural: 0.05 },
    who: '国内の製鉄所と関連の産業', pro: ['製鉄所の雇用と技術を守る', '安い輸出（ダンピング）への備えになる'], con: ['建設・自動車・機械のコストが上がる'], note: [[20020311, '米国は2002年に鉄鋼セーフガードを発動した（WTOで違反と判断され2003年末に撤廃）。'], [20180323, '2018年に米国が安全保障を理由に25%の関税をかけた。'], [20250604, '2025年に米国の関税は50%になった。']],
  },
};
export const CAT_ORDER = ['rice', 'livestock', 'farm', 'fish', 'industrial', 'auto', 'steel', 'energy', 'apparel'];
const AGRI = ['rice', 'livestock', 'farm', 'fish'];
const histRow = (c, n) => byDate(TARIFF_CATS[c].hist, n);
const histRate = (c, n) => histRow(c, n)[1];
const boundAt = (c, n) => byDate(TARIFF_CATS[c].bound, n)[1];
const quotaEq = (c, n) => byDate(TARIFF_CATS[c].qeq, n)[1];
export function rateText(c, r) {
  const C = TARIFF_CATS[c];
  if (c === 'rice') return r >= 600 ? '輸入禁止（実質）' : r <= 0 ? '0円/kg（完全自由化）' : `${Math.round(r)}円/kg（約${Math.round((r / C.world) * 100)}%に相当）`;
  const v = Math.round(r * 10) / 10;
  return `${v}%`;
}
const aveOf = (c, r, n) => (c === 'rice' ? (r >= 600 ? 1500 : (r / TARIFF_CATS.rice.world) * 100) : r + quotaEq(c, n));

// ---------------------------------------------------------------- the macro figures by era (兆円, 目安)
const IMPORTS = A([1987, 21.7], [1996, 34.9], [2004, 49.2], [2026, 110]);
const EXPORTS = A([1987, 33.3], [1996, 43.4], [2004, 61.2], [2026, 107]);
const GDP = A([1987, 350], [1996, 510], [2004, 500], [2026, 640]);
const REV = A([1987, 1.05], [1996, 0.95], [2004, 0.9], [2026, 1.0]);
const EXP_CAT = { auto: A([1987, 0.19], [1996, 0.14], [2004, 0.17], [2026, 0.17]), industrial: A([1987, 0.66], [2026, 0.66]), steel: A([1987, 0.06], [2004, 0.04], [2026, 0.04]), farm: A([1987, 0.01], [2026, 0.01]) };
export const EXP_CATS = ['auto', 'industrial', 'steel', 'farm'];
const EXP_NAME = { auto: '自動車', industrial: '工業製品', steel: '鉄鋼', farm: '農水産物' };

// ---------------------------------------------------------------- partners (trade blocs as tariff counterparts)
export const PARTNERS = {
  us: { name: '米国', ids: ['us'], exp: A([1987, 0.36], [1996, 0.27], [2004, 0.23], [2026, 0.19]), imp: A([1987, 0.23], [1996, 0.23], [2004, 0.15], [2026, 0.1]) },
  cn: { name: '中国', ids: ['cn', 'h_cn'], exp: A([1987, 0.04], [1996, 0.05], [2004, 0.13], [2026, 0.19]), imp: A([1987, 0.05], [1996, 0.1], [2004, 0.21], [2026, 0.23]) },
  eu: { name: 'EU（欧州）', ids: ['fr', 'de', 'wde', 'it', 'h_de', 'h_it'], exp: A([1987, 0.14], [1996, 0.14], [2004, 0.15], [2026, 0.09]), imp: A([1987, 0.13], [1996, 0.14], [2004, 0.12], [2026, 0.11]) },
  kr: { name: '韓国', ids: ['kr'], exp: A([1987, 0.04], [1996, 0.07], [2004, 0.08], [2026, 0.07]), imp: A([1987, 0.04], [1996, 0.05], [2004, 0.05], [2026, 0.05]) },
  tw: { name: '台湾', ids: ['tw'], exp: A([1987, 0.05], [1996, 0.06], [2004, 0.07], [2026, 0.07]), imp: A([1987, 0.04], [1996, 0.05], [2004, 0.04], [2026, 0.05]) },
  asean: { name: 'ASEAN', ids: ['id', 'ph', 'th', 'sg', 'my', 'vn'], exp: A([1987, 0.08], [1996, 0.15], [2004, 0.13], [2026, 0.15]), imp: A([1987, 0.11], [1996, 0.14], [2004, 0.14], [2026, 0.15]) },
  au: { name: '豪州', ids: ['au'], exp: A([1987, 0.02], [2026, 0.02]), imp: A([1987, 0.06], [2004, 0.05], [2026, 0.07]) },
  ca: { name: 'カナダ', ids: ['ca'], exp: A([1987, 0.015], [2026, 0.012]), imp: A([1987, 0.02], [2026, 0.013]) },
  gb: { name: '英国', ids: ['gb'], exp: A([1987, 0.025], [2026, 0.015]), imp: A([1987, 0.015], [2026, 0.01]) },
  in: { name: 'インド', ids: ['in'], exp: A([1987, 0.008], [2026, 0.02]), imp: A([1987, 0.01], [2026, 0.012]) },
  br: { name: 'ブラジル', ids: ['br'], exp: A([1987, 0.01], [2026, 0.011]), imp: A([1987, 0.017], [2026, 0.015]) },
  ru: { name: 'ロシア', ids: ['ru', 'su', 'h_su'], exp: A([1987, 0.01], [2026, 0.005]), imp: A([1987, 0.016], [2026, 0.01]) },
  sa: { name: '産油国（中東）', ids: ['sa', 'ir', 'iq', 'il', 'tr'], exp: A([1987, 0.03], [2026, 0.03]), imp: A([1987, 0.16], [1996, 0.1], [2026, 0.11]) },
};
export const PK_ORDER = ['us', 'cn', 'eu', 'kr', 'tw', 'asean', 'au', 'ca', 'gb', 'in', 'br', 'ru', 'sa'];
const pkOf = (id) => { if (!id) return null; if (PARTNERS[id]) return id; for (const k of PK_ORDER) if (PARTNERS[k].ids.includes(id)) return k; return null; };
const PK_MAIN = { us: 'us', cn: 'cn', eu: 'fr', kr: 'kr', tw: 'tw', asean: 'th', au: 'au', ca: 'ca', gb: 'gb', in: 'in', br: 'br', ru: 'ru', sa: 'sa' };
// who supplies each category (shares; the rest "others")
const SUP = {
  rice: { us: 0.45, asean: 0.35, cn: 0.1, au: 0.05 }, livestock: { us: 0.3, au: 0.32, ca: 0.1, eu: 0.12, br: 0.04 }, farm: { us: 0.3, cn: 0.13, au: 0.09, ca: 0.12, br: 0.08, eu: 0.1, asean: 0.08 },
  fish: { cn: 0.17, asean: 0.2, ru: 0.1, us: 0.08, kr: 0.06 }, industrial: { cn: 0.27, us: 0.12, eu: 0.12, kr: 0.06, tw: 0.07, asean: 0.18 }, auto: { eu: 0.62, us: 0.17, gb: 0.05, kr: 0.02 },
  energy: { sa: 0.4, au: 0.2, ru: 0.1, us: 0.09, asean: 0.12 }, apparel: { cn: 0.55, asean: 0.22, eu: 0.06, kr: 0.02 }, steel: { kr: 0.3, cn: 0.22, tw: 0.1, asean: 0.08 },
};
const cnF = (y) => (y <= 1987 ? 0.25 : y >= 2004 ? 1 : 0.25 + ((y - 1987) / 17) * 0.75);
function supply(c, pk, y) {
  const row = SUP[c] || {};
  let tot = 0, mine = 0;
  for (const [k, v] of Object.entries(row)) { const f = k === 'cn' ? cnF(y) : 1; tot += v * f; if (k === pk) mine = v * f; }
  const others = Math.max(0.05, 1 - Object.values(row).reduce((a, b) => a + b, 0)) * (y < 2004 ? 1.2 : 1);
  return mine / (tot + others);
}
// the tariffs partners put on Japanese goods (baseline: history), per export category
const THEIR = {
  us: {
    auto: [[0, 2.5, '乗用車2.5%（小型トラックは25%）'], [20250403, 27.5, '米国が自動車に25%の追加関税（232条）'], [20250916, 15, '日米合意：自動車は合計15%に']],
    industrial: [[0, 3.3, ''], [19960101, 2.9, ''], [20040101, 2.3, ''], [20250405, 12.3, '米国が全世界に10%の関税（相互関税）'], [20250807, 15, '日米合意：日本は合計15%（相互関税）'], [20260224, 12.3, '最高裁の判決で相互関税が失効。通商法122条にもとづく10%（150日）に'], [20260724, 12.3, '122条の期限切れ。かわって通商法301条にもとづく新たな関税（10〜12.5%）']],
    steel: [[0, 4, ''], [20020311, 20, '米国の鉄鋼セーフガード（8〜30%、2003年12月に撤廃）'], [20031205, 4, ''], [20180323, 25, '米国が安全保障を理由に鉄鋼25%（232条）。日本は除外されなかった'], [20250212, 25, ''], [20250604, 50, '鉄鋼・アルミニウムの関税が50%に']],
    farm: [[0, 5, ''], [20250405, 15, ''], [20260224, 15, '']],
  },
  cn: {
    auto: [[0, 180, '輸入車の関税は高く、実質的に輸入を抑えていた'], [19960101, 100, ''], [20010101, 80, ''], [20020101, 50, 'WTO加盟（2001年12月）に向けた引き下げ'], [20060701, 25, 'WTOの約束どおり25%に'], [20180701, 15, '']],
    industrial: [[0, 38, ''], [19960101, 23, ''], [20020101, 12, 'WTO加盟'], [20040101, 9.7, ''], [20100101, 8.5, ''], [20220101, 7.5, 'RCEPの発効']],
    steel: [[0, 22, ''], [19960101, 12, ''], [20020101, 8, ''], [20180701, 6, '']],
    farm: [[0, 50, ''], [19960101, 35, ''], [20020101, 16, ''], [20230824, 41, '中国が日本産水産物の輸入を停止（2023年8月）']],
  },
  eu: {
    auto: [[0, 10, ''], [20190201, 8.6, '日EU経済連携協定：10%を段階的に撤廃（8年）'], [20200401, 7.1, ''], [20210401, 5.7, ''], [20220401, 4.3, ''], [20230401, 2.9, ''], [20240401, 1.4, ''], [20250401, 0, '']],
    industrial: [[0, 5.2, ''], [19960101, 4.2, ''], [20040101, 3.6, ''], [20190201, 1.0, ''], [20260101, 0.3, '']],
    steel: [[0, 6, ''], [20190201, 0, '']], farm: [[0, 16, ''], [20190201, 9, '日本の農水産物（牛肉・緑茶・日本酒）の関税が撤廃・削減'], [20260101, 6, '']],
  },
};
const DEF_THEIR = { auto: A([1987, 14], [1996, 11], [2004, 9], [2026, 7]), industrial: A([1987, 8], [1996, 6.5], [2004, 5.5], [2026, 4.5]), steel: A([1987, 7], [1996, 5.5], [2004, 4.5], [2026, 3.5]), farm: A([1987, 18], [1996, 14], [2004, 12], [2026, 9]) };
export function theirBase(pk, e, n) {
  const tab = THEIR[pk] && THEIR[pk][e];
  if (tab) return byDate(tab, n)[1];
  const y = Math.floor(n / 10000) + ((Math.floor(n / 100) % 100) - 1) / 12;
  return Math.round(interp(DEF_THEIR[e], y) * 10) / 10;
}
const theirNote = (pk, e, n) => { const tab = THEIR[pk] && THEIR[pk][e]; return tab ? byDate(tab, n)[2] || '' : ''; };

// ---------------------------------------------------------------- economic partners' profiles for EPA talks
const PROF = {
  us: { agri: 3, sacred: 3, ind: 1, service: 2, people: 0, wantInd: 2, wantAuto: 3 }, cn: { agri: 2, sacred: 1, ind: 2, service: 1, people: 0, wantInd: 3, wantAuto: 3 }, kr: { agri: 2, sacred: 1, ind: 2, service: 1, people: 0, wantInd: 2, wantAuto: 1 },
  eu: { agri: 3, sacred: 2, ind: 1, service: 2, people: 0, wantInd: 1, wantAuto: 3 }, au: { agri: 3, sacred: 3, ind: 0, service: 1, people: 0, wantInd: 1, wantAuto: 2 }, ca: { agri: 3, sacred: 2, ind: 0, service: 1, people: 0, wantInd: 1, wantAuto: 2 },
  br: { agri: 3, sacred: 2, ind: 2, service: 1, people: 0, wantInd: 2, wantAuto: 2 }, in: { agri: 1, sacred: 0, ind: 3, service: 2, people: 2, wantInd: 3, wantAuto: 3 }, gb: { agri: 1, sacred: 1, ind: 0, service: 2, people: 0, wantInd: 1, wantAuto: 2 },
  asean: { agri: 2, sacred: 1, ind: 2, service: 1, people: 2, wantInd: 3, wantAuto: 2 }, tw: { agri: 2, sacred: 1, ind: 1, service: 1, people: 0, wantInd: 2, wantAuto: 1 }, ru: { agri: 1, sacred: 0, ind: 1, service: 1, people: 0, wantInd: 2, wantAuto: 2 }, sa: { agri: 0, sacred: 0, ind: 1, service: 1, people: 0, wantInd: 2, wantAuto: 1 },
};
const DEF_PROF = { agri: 1, sacred: 0, ind: 1, service: 1, people: 0, wantInd: 2, wantAuto: 1 };

// ---------------------------------------------------------------- friction templates (history-flavoured, fictional instances)
// from/to: dateNum window; pk: the partner; theirs: { cat: points } they threaten; ask: what they want; concede: { cat?, delta?, ... }
const FRICTIONS = [
  { id: 'semi', from: 19870101, to: 19930101, pk: 'us', title: '日米半導体・電子機器摩擦', item: '半導体・電子機器', ask: '日本市場での外国製半導体のシェア拡大と、第三国向けのダンピングの防止', theirs: { industrial: 20 }, sev: 2, w: 1.2, concede: { text: '外国製品の購入目標や監視の枠組みを受け入れた', approval: -0.6, segs: { business: -0.6, unions: -0.2 }, cost: 'ドット商工会議所は「事実上の数値目標だ」と反発' } },
  { id: 'beefor', from: 19870101, to: 19920401, pk: 'us', title: '牛肉・オレンジの輸入自由化要求', item: '牛肉・かんきつ類', ask: '輸入割当（数量の制限）の撤廃と関税への切りかえ', theirs: { industrial: 12 }, sev: 2, w: 1.1, concede: { cat: 'livestock', delta: -8, text: '牛肉の輸入割当を関税に切りかえ、関税を段階的に下げることで合意した', approval: -0.5, segs: { farmers: -2.2, rural: -1.0, families: 0.8 }, cost: '全国の畜産農家が反対の声を上げた' } },
  { id: 'rice_us', from: 19870101, to: 19960101, pk: 'us', title: 'コメ市場の開放要求', item: 'コメ', ask: 'コメの輸入禁止の見直し（関税化・最低限の輸入枠）', theirs: { industrial: 8, farm: 10 }, sev: 2, w: 0.9, concede: { cat: 'rice', delta: -60, text: 'コメの輸入について、最低限の輸入枠（ミニマム・アクセス）を受け入れる方向で調整した', approval: -1.2, segs: { farmers: -3.5, rural: -1.8, families: 0.6 }, cost: '農協と農村選出の議員が「国会決議に反する」と強く反発' } },
  { id: 'sii', from: 19890901, to: 19940101, pk: 'us', title: '日米構造協議（市場の閉鎖性の批判）', item: '流通・系列・大型店規制', ask: '大型店規制の緩和、系列取引や公共投資など「構造」の見直し', theirs: { industrial: 10 }, sev: 1, w: 0.8, concede: { text: '大店法の運用の緩和や公共投資の拡大を約束した', approval: -0.3, segs: { selfemployed: -1.2, business: 0.6, urban: 0.5 }, cost: '商店街の組合が反発', eco: { growth: 0.12 } } },
  { id: 'vera', from: 19870101, to: 19950101, pk: 'us', title: '自動車の対米輸出（自主規制の延長）', item: '乗用車', ask: '対米輸出台数の枠（輸出自主規制）の延長と、現地生産の拡大', theirs: { auto: 15 }, sev: 1, w: 0.9, concede: { text: '輸出台数の枠を受け入れ、米国での現地生産を増やす方針を示した', approval: -0.2, segs: { unions: -0.5, business: -0.3 }, cost: '輸出企業は「輸出の機会が奪われる」と懸念', eco: { growth: -0.06 } } },
  { id: 'auto_talk', from: 19930101, to: 19990101, pk: 'us', title: '日米自動車・部品協議', item: '高級車・自動車部品', ask: '日本の部品調達の拡大。応じなければ日本製の高級車に100%の関税', theirs: { auto: 40 }, sev: 2, w: 1.3, concede: { text: '日本メーカーの米国現地生産と部品購入の見通しを公表する形で決着した', approval: -0.2, segs: { business: -0.2 }, cost: '数値目標だとして、官民で意見が割れた' } },
  { id: 'sg_cn', from: 20000101, to: 20060101, pk: 'cn', title: '農産物のセーフガードをめぐる対立', item: 'ネギ・シイタケ・畳表', ask: '日本が発動した暫定セーフガードの撤回。応じなければ日本車・携帯電話・エアコンに100%の関税', theirs: { auto: 35, industrial: 12 }, sev: 2, w: 1.1, concede: { text: 'セーフガードを本発動せず、中国側の輸出の自主的な管理を受け入れた', approval: -0.4, segs: { farmers: -1.2, rural: -0.6, business: 0.7 }, cost: '産地の農家は「国内の産地を守る約束が崩れた」と反発' } },
  { id: 'steel_us', from: 20000101, to: 20060101, pk: 'us', title: '米国の鉄鋼輸入制限', item: '鉄鋼', ask: '米国の産業を守るための輸入制限への理解', theirs: { steel: 20 }, sev: 1, w: 0.9, concede: { text: '輸入枠の設定を事実上受け入れた', approval: -0.2, segs: { unions: -0.3, business: -0.3 }, cost: '鉄鋼メーカーは「WTO違反のはずだ」と不満' } },
  { id: 'bse', from: 20031201, to: 20070101, pk: 'us', title: '米国産牛肉（BSE）の輸入停止問題', item: '牛肉', ask: '輸入再開の条件の緩和（月齢制限の見直し）', theirs: { industrial: 8, farm: 6 }, sev: 1, w: 0.9, concede: { cat: 'livestock', delta: 0, text: '月齢などの条件つきで輸入を再開する方向を示した', approval: -0.6, segs: { families: -0.8, farmers: -0.4, selfemployed: 0.3 }, cost: '消費者団体は「食の安全が最優先」と反発' } },
  { id: 'rare', from: 20080101, to: 20180101, pk: 'cn', title: 'レアアースなど資源の輸出管理', item: 'レアアース・資源', ask: '（相手は輸出を絞り、価格が上がっている）日本は調達先の分散で対抗する', theirs: { industrial: 10 }, sev: 2, w: 0.9, concede: { text: '共同の研究開発や技術協力で、調達の枠を確保する方針で合意した', approval: -0.1, segs: { business: 0.3 }, cost: '調達先の分散には時間と費用がかかる', eco: { growth: -0.04 } } },
  { id: 'kr_exp', from: 20150101, to: 20260101, pk: 'kr', title: '輸出管理をめぐる日韓の対立', item: '素材・部品', ask: '輸出管理の見直しと不買運動の収束。応じなければ報復措置', theirs: { industrial: 10, farm: 12 }, sev: 1, w: 0.7, concede: { text: '対話の枠組みを再開し、手続きの簡素化を探る方向で合意した', approval: 0.1, segs: { business: 0.5, young: 0.3, elderly: -0.4 }, cost: '強い対応を求める声は「譲歩だ」と批判' } },
  { id: 'us_232', from: 20150101, to: 20301231, pk: 'us', title: '米国の安全保障を理由とした関税', item: '自動車・鉄鋼', ask: '日本車・鉄鋼への追加関税。回避のため投資や農産物の購入を求める', theirs: { auto: 15, steel: 15, industrial: 5 }, sev: 2, w: 1.4, concede: { cat: 'livestock', delta: -2, text: '米国産の農産物の購入と、米国への投資の枠組みを示して、追加関税の引き下げを求めた', approval: -0.4, segs: { farmers: -1.2, business: 0.6, unions: 0.2 }, cost: '「約束が一方的だ」「見返りは大きすぎる」との声', eco: { yen: -1 } } },
  { id: 'cn_fish', from: 20150101, to: 20301231, pk: 'cn', title: '水産物・資源をめぐる中国との対立', item: '水産物・資源', ask: '政治的な問題をめぐる要求と引き換えの輸入制限の継続', theirs: { farm: 25, industrial: 8 }, sev: 2, w: 1.0, concede: { text: '科学的な根拠にもとづく協議の枠組みを受け入れ、一部の品目で再開に向けた手続きを進めた', approval: -0.3, segs: { farmers: 0.3, business: 0.4, elderly: -0.4 }, cost: '強い対応を求める声は「圧力に屈した」と批判' } },
];

// ---------------------------------------------------------------- the module
export function createTrade(X, DP) {
  const { W, clamp, num, rnd, roll, pick, today, dateNum, fyear, relation, relAdd, hasTies, exists, shortName, COUNTRIES, news, phone, note, pol, isPM, bumpApproval, ecoShock, useStam, stam, treatiesNow, treatyWith, TREATIES, standingAdd, atWarWith, pct, shiftSupport, crisis, emit, addTreaty } = X;

  // ---- state
  function T(g) {
    const s = W(g);
    let t = s.trade;
    if (!t || typeof t !== 'object' || Array.isArray(t)) t = s.trade = {};
    for (const k of ['ovr', 'extra', 'exempt', 'theirs', 'grievance', 'war', 'cuts', 'rolled', 'surge', 'applied']) if (!t[k] || typeof t[k] !== 'object' || Array.isArray(t[k])) t[k] = {};
    for (const k of ['frictions', 'deals', 'ledger', 'series']) if (!Array.isArray(t[k])) t[k] = [];
    if (!Number.isFinite(t.seq)) t.seq = 1;
    if (!Number.isFinite(t.last)) t.last = -99;
    if (!Number.isFinite(t.seeded)) t.seeded = 0;
    return t;
  }
  const lg = (g, text, kind = 'trade') => { const t = T(g); t.ledger.unshift({ day: today(g), text, kind }); if (t.ledger.length > 60) t.ledger.length = 60; DP.tl(g, kind, text); };
  const yr = (g) => fyear(g);
  const segName = (s) => SEGN[s] || s;
  const rate1 = (v) => Math.round(v * 10) / 10;

  // ---- current rates
  const rateNow = (g, c) => { const t = T(g); return t.ovr[c] != null ? t.ovr[c] : histRate(c, dateNum(g)); };
  function extraPts(g, pk, c) {
    const t = T(g);
    const e = t.extra[pk];
    if (!e) return 0;
    if (t.exempt[pk] && (t.exempt[pk].all || t.exempt[pk][c])) return 0;
    let v = 0;
    for (const x of e) if ((x.cat === 'all' || x.cat === c) && (!x.until || x.until >= today(g))) v += x.pts;
    return v;
  }
  const exempted = (g, pk, c) => { const x = T(g).exempt[pk]; return !!(x && (x.all || x[c])); };
  // the treaty cuts of this game's EPAs (points off Japan's rate on the partner's goods) and the rolled-back real ones
  function cutPts(g, pk, c) {
    const t = T(g);
    let v = 0;
    for (const cut of Object.values(t.cuts)) if (cut.pk.includes(pk) && cut.japan && cut.japan[c] != null) v += cut.japan[c] * (cut.active === false ? 0 : 1);
    for (const r of Object.values(t.rolled)) if (r.pk.includes(pk) && r.japan && r.japan[c] != null) v -= r.japan[c];
    return v;
  }
  const addedTheirs = (g, pk, e) => { const x = T(g).theirs[pk]; if (!x || !x[e]) return 0; return x[e].pts || 0; };
  const theirsNow = (g, pk, e) => rate1(theirBase(pk, e, dateNum(g)) + addedTheirs(g, pk, e));

  // ---- the model
  const tanh = Math.tanh;
  let cache = null;
  function calc(g) {
    const t = T(g);
    const key = `${today(g)}|${dateNum(g)}|${JSON.stringify([t.ovr, t.extra, t.exempt, t.theirs, t.cuts, t.rolled])}`;
    if (cache && cache.key === key) return cache.v;
    const n = dateNum(g), y = yr(g);
    const IMP = interp(IMPORTS, y), EXP = interp(EXPORTS, y), GD = interp(GDP, y);
    const out = { cats: {}, pk: {} };
    let infl = 0, growth = 0, balance = 0, exportLoss = 0, importDelta = 0;
    const seg = {};
    let revBase = 0, rev = 0, calSum = 0;
    for (const c of CAT_ORDER) {
      if (c === 'rice') continue;
      calSum += (IMP * interp(TARIFF_CATS[c].imp, y)) / 100 * (histRate(c, n) / 100);
    }
    const cal = calSum > 0 ? interp(REV, y) / calSum : 1;
    for (const c of CAT_ORDER) {
      const C = TARIFF_CATS[c];
      const h = histRate(c, n);
      const r = rateNow(g, c);
      let d = aveOf(c, r, n) - aveOf(c, h, n);
      let dPts = r - h;
      for (const pk of PK_ORDER) {
        const sh = supply(c, pk, y);
        if (!sh) continue;
        const ex = c === 'rice' ? 0 : extraPts(g, pk, c), cut = c === 'rice' ? 0 : cutPts(g, pk, c);
        if (exempted(g, pk, c) && r !== h) { d -= sh * (aveOf(c, r, n) - aveOf(c, h, n)); dPts -= sh * (r - h); }
        d += sh * (ex - cut); dPts += sh * (ex - cut);
      }
      const rEff = Math.max(0, h + dPts);
      const u = tanh(d / C.sc);
      const cpi = interp(C.cpiW, y);
      infl += cpi * C.pMax * u;
      growth += C.gMax * u;
      const impC = (IMP * interp(C.imp, y)) / 100;
      importDelta += -impC * C.eMax * u;
      const vol = clamp(1 - 0.006 * d, 0.25, 1.6);
      const base = c === 'rice' ? 0 : impC * (h / 100) * cal;
      const now = c === 'rice' ? 0 : impC * (rEff / 100) * cal * vol;
      revBase += base; rev += now;
      for (const [sg, v] of Object.entries(C.seg)) seg[sg] = (seg[sg] || 0) + v * u;
      out.cats[c] = { id: c, rate: r, hist: h, eff: rEff, dAve: d, u, ave: aveOf(c, r, n), aveHist: aveOf(c, h, n), revenue: now, revBase: base, price: cpi * C.pMax * u };
    }
    // partners' tariffs on Japanese goods
    const exportRows = [];
    for (const pk of PK_ORDER) {
      const ex = interp(PARTNERS[pk].exp, y);
      for (const e of EXP_CATS) {
        const pts = addedTheirs(g, pk, e);
        if (!pts) continue;
        const cs = interp(EXP_CAT[e], y);
        const loss = EXP * ex * cs * (pts / 100) * 1.25;
        exportLoss += loss;
        exportRows.push({ pk, e, pts, loss });
      }
    }
    growth += -(exportLoss / GD) * 100 * 1.8;
    balance = -importDelta - exportLoss;
    const out2 = {
      infl: rate1(infl * 100) / 100, growth: Math.round(growth * 1000) / 1000, balance: Math.round(balance * 100) / 100, exportLoss: Math.round(exportLoss * 100) / 100, importDelta: Math.round(importDelta * 100) / 100,
      revenue: Math.round(rev * 1000) / 1000, revBase: Math.round(revBase * 1000) / 1000, seg, exportRows, IMP, EXP, GD, cal,
    };
    out.sum = out2;
    cache = { key, v: out };
    return out;
  }
  const baseBalance = (g) => interp(EXPORTS, yr(g)) - interp(IMPORTS, yr(g));
  // push the difference between the effects now and those already applied into the politics core (prices over ~180 days, growth over ~360)
  function applyEffects(g) {
    const t = T(g);
    const c = calc(g).sum;
    const a = t.applied;
    const dInfl = c.infl - num(a.infl), dGr = c.growth - num(a.growth);
    if (Math.abs(dInfl) >= 0.01 || Math.abs(dGr) >= 0.01) {
      ecoShock(g, '関税・貿易政策', { inflation: dInfl, growth: dGr, len: Math.abs(dGr) > Math.abs(dInfl) ? 360 : 180 });
      a.infl = c.infl; a.growth = c.growth;
    }
    const p = pol(g);
    const sg = {};
    for (const [k, v] of Object.entries(c.seg)) { const d = v - num((a.seg || {})[k]); if (Math.abs(d) >= 0.02) sg[k] = d; }
    if (Object.keys(sg).length) {
      if (p && shiftSupport) shiftSupport(p, sg, 0.012);
      a.seg = { ...(a.seg || {}) };
      for (const k of Object.keys(sg)) a.seg[k] = c.seg[k];
    }
  }

  // ---- roles
  const tariffWhy = (g, cat) => {
    const p = pol(g);
    if (!p) return '政治の仕組み（政治コア）が読み込まれていない';
    const me = p.me || {};
    const posts = me.posts || [];
    const agri = AGRI.includes(cat);
    const ok = posts.includes('pm') || posts.includes('minister_finance') || (agri ? posts.includes('minister_agri') : posts.includes('minister_trade'));
    if (ok) return null;
    return `関税の改正は総理か財務（大蔵）大臣、${agri ? '農林水産' : '経済産業（通商産業）'}大臣が行う（総理や大臣になれば、ここから動かせる）`;
  };

  // ---- the Diet for tariff laws
  DP.registerDiet('tariff', {
    onPass(g, it) {
      const pl = it.payload;
      const t = T(g);
      const C = TARIFF_CATS[pl.cat];
      const before = rateNow(g, pl.cat);
      t.ovr[pl.cat] = pl.rate;
      lg(g, `関税定率法等の改正が成立：${C.name} ${rateText(pl.cat, before)} → ${rateText(pl.cat, pl.rate)}`, 'tariff');
      news(g, `改正関税法が成立。${C.name}の関税が ${rateText(pl.cat, before)} から ${rateText(pl.cat, pl.rate)} に変わった`);
      phone(g, `【経済ニュース】${C.name}の関税が${rateText(pl.cat, pl.rate)}になった。\n${pl.rate < before ? '消費者には値下がりの期待、国内の産地には逆風との声。' : '国内の産業には追い風、物価の上昇を心配する声。'}`, 'ドット新聞 経済部');
      noteGrievance(g, pl.cat, before, pl.rate);
      applyEffects(g);
    },
    onFail(g, it) {
      const pl = it.payload;
      bumpApproval(g, -1, '関税改正の否決');
      news(g, `「${it.name}」は国会で否決された`);
      lg(g, `${TARIFF_CATS[pl.cat].name}の関税の改正案は国会で否決された`, 'tariff');
    },
  });
  // a rate change annoys (or pleases) its main suppliers; going beyond the WTO bound adds a legal claim
  function noteGrievance(g, cat, from, to) {
    if (to <= from) return;
    const t = T(g);
    const n = dateNum(g), y = yr(g);
    const over = to > boundAt(cat, n);
    const C = TARIFF_CATS[cat];
    const dAve = aveOf(cat, to, n) - aveOf(cat, from, n);
    for (const pk of PK_ORDER) {
      const sh = supply(cat, pk, y);
      if (sh < 0.03 || exempted(g, pk, cat)) continue;
      const gr = clamp((dAve / C.sc) * 22 * (sh * 4) * (over ? 1.6 : 1), 0, 40);
      if (gr > 1) t.grievance[pk] = clamp(num(t.grievance[pk]) + gr, 0, 100);
    }
    if (over) { standingAdd(g, -1.5); }
  }

  // ---------------------------------------------------------------- tariff_set preview / run
  function candidates(g, cat) {
    const C = TARIFF_CATS[cat];
    const n = dateNum(g);
    const h = histRate(cat, n), cur = rateNow(g, cat);
    const out = [];
    const push = (label, r, sub = '') => { r = clamp(Math.round(r * 100) / 100, C.min, C.max); if (!out.some((x) => Math.abs(x.rate - r) < 0.01)) out.push({ label, rate: r, sub }); };
    push('歴史どおりの水準に戻す', h, `実際の歴史の水準：${rateText(cat, h)}`);
    push('撤廃する（完全に自由化）', C.min, '関税をなくす');
    push('大きく引き下げる', Math.max(C.min, cur - C.step * 6));
    push('引き下げる', Math.max(C.min, cur - C.step * 3));
    push('少し引き下げる', Math.max(C.min, cur - C.step));
    push('少し引き上げる', Math.min(C.max, cur + C.step));
    push('引き上げる', Math.min(C.max, cur + C.step * 3));
    push('大きく引き上げる', Math.min(C.max, cur + C.step * 6));
    const b = boundAt(cat, n);
    if (b > cur && b <= C.max) push('WTOの約束（譲許税率）の上限まで', b, 'これを超えると約束違反');
    return out.filter((x) => Math.abs(x.rate - cur) >= 0.01).sort((a, b2) => a.rate - b2.rate);
  }
  function tariffPreview(g, cat, rate, opts = {}) {
    const C = TARIFF_CATS[cat];
    if (!C) return { ok: false, why: 'そんな品目はない' };
    const n = dateNum(g);
    rate = clamp(num(rate, rateNow(g, cat)), C.min, C.max);
    const cur = rateNow(g, cat);
    const t = T(g);
    // the effects: calc with the rate set
    const saved = t.ovr[cat];
    const before = calc(g).sum;
    t.ovr[cat] = rate; cache = null;
    const after = calc(g).sum;
    if (saved == null) delete t.ovr[cat]; else t.ovr[cat] = saved;
    cache = null;
    const h = histRate(cat, n);
    const dAve = aveOf(cat, rate, n) - aveOf(cat, cur, n);
    const lines = [];
    const sign = (v, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
    lines.push(`${C.name}：${rateText(cat, cur)} → ${rateText(cat, rate)}（歴史では ${rateText(cat, h)}）`);
    lines.push(`物価（消費者物価）への影響：${sign(after.infl - before.infl)}ポイント（1年ほどかけて）`);
    lines.push(`成長率への影響：${sign(after.growth - before.growth, 3)}ポイント　貿易収支：${sign(after.balance - before.balance, 2)}兆円/年`);
    lines.push(`関税収入：${sign(after.revenue - before.revenue, 3)}兆円/年（現在 約${before.revenue.toFixed(2)}兆円）`);
    const b = boundAt(cat, n);
    const over = rate > b;
    if (over) lines.push(`⚠ ${n < 19950101 ? 'GATT' : 'WTO'}で約束した上限（${rateText(cat, b)}）を超える。相手国は補償や対抗措置を求められる`);
    const segs = [];
    for (const [sg, v] of Object.entries(C.seg)) { const d = (tanh((aveOf(cat, rate, n) - aveOf(cat, h, n)) / C.sc) - tanh((aveOf(cat, cur, n) - aveOf(cat, h, n)) / C.sc)) * v; if (Math.abs(d) >= 0.05) segs.push({ seg: sg, name: segName(sg), v: Math.round(d * 100) / 100 }); }
    segs.sort((a, b2) => Math.abs(b2.v) - Math.abs(a.v));
    const gain = segs.filter((x) => x.v > 0).slice(0, 3).map((x) => x.name), lose = segs.filter((x) => x.v < 0).slice(0, 3).map((x) => x.name);
    if (gain.length) lines.push(`歓迎する層：${gain.join('・')}`);
    if (lose.length) lines.push(`反発する層：${lose.join('・')}`);
    // retaliation risk (raising)
    let ret = [];
    if (rate > cur) {
      const y = yr(g);
      ret = PK_ORDER.map((pk) => ({ pk, name: PARTNERS[pk].name, sh: supply(cat, pk, y) })).filter((x) => x.sh >= 0.1 && !exempted(g, x.pk, cat)).sort((a, b2) => b2.sh - a.sh).slice(0, 3).map((x) => ({ pk: x.pk, name: x.name, p: Math.round(clamp(0.12 + (dAve / C.sc) * 0.5 * (x.sh * 3) + (over ? 0.25 : 0) - relation(g, PK_MAIN[x.pk]) / 400, 0.05, 0.85) * 100) / 100 }));
      if (ret.length) lines.push(`報復の恐れ：${ret.map((x) => `${x.name}（約${Math.round(x.p * 100)}%）`).join('・')}`);
    }
    const tags = AGRI.includes(cat) ? (rate < cur ? ['agri_cut'] : ['agri_raise']) : rate < cur ? ['fta'] : ['tariff_up'];
    const est = DP.dietEstimate(g, tags, 'law');
    const hasPol = !!pol(g);
    if (hasPol) lines.push(`国会（関税は法律で定める：憲法84条）の通過の見込み：${pct(est.pass)}${DP.inSession(g) ? '' : '（国会が閉会中：次の国会で審議）'}`);
    const why = tariffWhy(g, cat);
    return { ok: true, why, cat, name: C.name, from: cur, to: rate, hist: h, fromText: rateText(cat, cur), toText: rateText(cat, rate), bound: b, over, lines, segments: segs, retaliation: ret, estimate: est, effects: { infl: after.infl - before.infl, growth: after.growth - before.growth, balance: after.balance - before.balance, revenue: after.revenue - before.revenue }, dAve, tags };
  }
  function tariffSet(g, cat, rate, opts = {}) {
    const C = TARIFF_CATS[cat];
    if (!C) return { ok: false, why: 'そんな品目はない' };
    const pv = tariffPreview(g, cat, rate, opts);
    if (pv.why) return { ok: false, why: pv.why };
    if (Math.abs(pv.to - pv.from) < 0.001) return { ok: false, why: 'いまの関税率と同じ' };
    const it = DP.dietSubmit(g, { kind: 'law', handler: 'tariff', name: `関税定率法等の一部を改正する法律案（${C.name}）`, tags: pv.tags, payload: { cat, rate: pv.to } });
    useStam(g, 6);
    DP.tl(g, 'tariff', `${C.name}の関税の改正案を国会に提出（${pv.fromText} → ${pv.toText}）`);
    if (!pol(g)) { return { ok: true, success: true, text: `${C.name}の関税を${pv.toText}にした。` }; }
    // without the politics core the item resolved at once
    const done = it.status !== 'open';
    if (done) return { ok: true, success: it.status === 'passed', text: it.status === 'passed' ? `${C.name}の関税を${pv.toText}にした。` : '改正案は否決された。', item: it.id };
    return { ok: true, success: true, text: `「${it.name}」を国会に提出した（${pv.fromText} → ${pv.toText}）。\n関税は法律で定めるため、国会（${DP.inSession(g) ? '会期中' : '次の会期'}）の審議を経て成立する。通過の見込みは${pct(pv.estimate.pass)}。`, item: it.id, stage: 'law' };
  }

  // ---------------------------------------------------------------- additional tariffs on a country (政令), exemption, safeguards
  const EXTRA_OPTS = [
    { id: 'all10', label: '全品目に10%上乗せ', cat: 'all', pts: 10 }, { id: 'all25', label: '全品目に25%上乗せ', cat: 'all', pts: 25 }, { id: 'all50', label: '全品目に50%上乗せ（事実上の禁輸に近い）', cat: 'all', pts: 50 },
    { id: 'auto25', label: '自動車・部品に25%上乗せ', cat: 'auto', pts: 25 }, { id: 'ind25', label: '工業製品に25%上乗せ', cat: 'industrial', pts: 25 }, { id: 'steel25', label: '鉄鋼・金属に25%上乗せ', cat: 'steel', pts: 25 }, { id: 'agri25', label: '農産物に25%上乗せ', cat: 'farm', pts: 25 }, { id: 'apparel25', label: '繊維・衣類に25%上乗せ', cat: 'apparel', pts: 25 },
  ];
  function retaliationOdds(g, pk, pts, cat) {
    const main = PK_MAIN[pk];
    const war = num(T(g).war[pk]);
    const sh = cat === 'all' ? 1 : 0.5;
    return clamp(0.2 + (pts / 100) * 1.1 * sh + (relation(g, main) < -20 ? 0.12 : 0) - Math.max(0, relation(g, main)) / 320 + war * 0.08 + (T(g).grievance[pk] || 0) / 250, 0.08, 0.92);
  }
  const ACTIONS = {
    tariff_set: {
      name: '関税率を改正する（品目別）', who: ['pm', 'finance', 'trade', 'agri'], target: 'none', desc: '日本の輸入関税を、品目ごとに引き上げ・引き下げる。関税は法律で定める（憲法84条）ので、国会の審議を経て成立する。物価・産業・収入・相手国の反応が変わる。',
      options: () => CAT_ORDER.map((c) => ({ id: c, label: TARIFF_CATS[c].name, sub: TARIFF_CATS[c].group })),
      check(g, t, o) {
        const cat = o && o.cat;
        if (!cat) return null;
        if (!TARIFF_CATS[cat]) return 'そんな品目はない';
        return tariffWhy(g, cat);
      },
      odds(g, t, o) { if (!o || !o.cat || o.rate == null) return null; const pv = tariffPreview(g, o.cat, o.rate); return pv.ok ? pv.estimate.pass : null; },
      lines(g, t, o) { if (!o || !o.cat || o.rate == null) return ['品目と新しい税率を選ぶ（「貿易・関税」の画面から）']; const pv = tariffPreview(g, o.cat, o.rate); return pv.ok ? pv.lines : []; },
      run(g, t, o) { if (!o || !o.cat) return { ok: false, why: '品目を選ぶ' }; return tariffSet(g, o.cat, o.rate, o); },
    },
    tariff_extra: {
      name: '追加関税（対抗関税）を科す', who: ['pm', 'finance', 'trade'], target: 'country', desc: '特定の国からの輸入に、関税を上乗せする（報復関税・対抗関税：関税定率法にもとづく政令・閣議決定。期間は6か月で、延長もできる）。',
      options: () => EXTRA_OPTS.map((o) => ({ id: o.id, label: o.label, sub: '' })),
      check(g, id, o) {
        if (!id) return '相手を選ぶ';
        const pk = pkOf(id);
        if (!pk || !exists(g, id)) return 'その国はいまはない（または貿易の相手として扱えない）';
        if (!pol(g)) return '政治の仕組み（政治コア）が読み込まれていない';
        const p = pol(g); const posts = (p.me && p.me.posts) || [];
        if (!(posts.includes('pm') || posts.includes('minister_finance') || posts.includes('minister_trade'))) return '追加関税は総理か財務（大蔵）大臣、経済産業（通商産業）大臣が閣議で決める';
        return null;
      },
      odds: () => null,
      lines(g, id, o) {
        const opt = EXTRA_OPTS.find((x) => x.id === ((o && o.level) || 'all10')) || EXTRA_OPTS[0];
        const pk = pkOf(id);
        const p = retaliationOdds(g, pk, opt.pts, opt.cat);
        return [`${PARTNERS[pk] ? PARTNERS[pk].name : shortName(g, id)}からの輸入（${opt.cat === 'all' ? '全品目' : TARIFF_CATS[opt.cat].name}）に ${opt.pts}% を上乗せ。6か月の時限（政令）`, `物価が上がり、関税収入が増えるが、輸入が減る。日本の産業が使う部品・原料は高くなる`, `相手国が報復する見込み：約${Math.round(p * 100)}%（関係・これまでのいきさつで変わる）`, 'WTOのルールでは、特定の国だけを狙った関税は原則として認められない（協議や提訴の対象になる）', '同盟国・友好国からは評価されないことがある。国内では「毅然とした対応」と評価する声と、物価高を心配する声がある'];
      },
      run(g, id, o) {
        const opt = EXTRA_OPTS.find((x) => x.id === ((o && o.level) || 'all10')) || EXTRA_OPTS[0];
        const pk = pkOf(id);
        const t = T(g);
        (t.extra[pk] || (t.extra[pk] = [])).push({ cat: opt.cat, pts: opt.pts, day: today(g), until: today(g) + 60, id: 'x' + t.seq++ });
        useStam(g, 6);
        const name = PARTNERS[pk].name;
        relAdd(g, PK_MAIN[pk], -Math.round(opt.pts / 5));
        t.grievance[pk] = clamp(num(t.grievance[pk]) + opt.pts * 0.9, 0, 100);
        t.war[pk] = Math.max(num(t.war[pk]), opt.pts >= 25 ? 2 : 1);
        bumpApproval(g, roll(0.5) ? 0.8 : -0.8, `${name}への追加関税`);
        lg(g, `${name}からの輸入に追加関税（${opt.label}）を科した`, 'tariff');
        news(g, `政府が${name}からの輸入に${opt.cat === 'all' ? '' : TARIFF_CATS[opt.cat].name}の追加関税（${opt.pts}%）を科すことを閣議決定した`);
        phone(g, `【経済ニュース】${name}からの輸入に${opt.pts}%の追加関税。\n輸入品の値上がりへの懸念と、国内産業を守る措置として歓迎する声。`, 'ドット新聞 経済部');
        applyEffects(g);
        const p = retaliationOdds(g, pk, opt.pts, opt.cat);
        let text = `${name}からの輸入に追加関税（${opt.label}）を科した（6か月）。`;
        if (roll(p * 0.55)) { const rt = retaliate(g, pk, opt.pts, opt.cat, true); if (rt) text += `\n${rt}`; }
        return { ok: true, success: true, text };
      },
    },
    tariff_lift: {
      name: '追加関税・対抗措置を解除する', who: ['pm', 'finance', 'trade'], target: 'country', desc: '日本が科している追加関税をやめる（相手国の報復関税の引き下げ協議にも道が開く）。',
      check(g, id) {
        const pk = pkOf(id);
        if (!pk) return '相手を選ぶ';
        const p = pol(g); const posts = (p && p.me && p.me.posts) || [];
        if (!(posts.includes('pm') || posts.includes('minister_finance') || posts.includes('minister_trade'))) return '追加関税の解除は総理か財務（大蔵）大臣、経済産業（通商産業）大臣が閣議で決める';
        const e = T(g).extra[pk];
        if (!e || !e.some((x) => !x.until || x.until >= today(g))) return 'この国には追加関税を科していない';
        return null;
      },
      odds: () => null,
      lines: (g, id) => ['日本の追加関税をなくす。相手との関係＋6、貿易が戻る', '相手国の報復関税は自動では解除されない（「関税交渉」で解除を求める）', '国内では「弱腰」と見る声と「物価が下がる」と歓迎する声がある'],
      run(g, id) {
        const pk = pkOf(id);
        const t = T(g);
        delete t.extra[pk];
        t.grievance[pk] = Math.max(0, num(t.grievance[pk]) - 25);
        relAdd(g, PK_MAIN[pk], 6);
        lg(g, `${PARTNERS[pk].name}への追加関税を解除した`, 'tariff');
        news(g, `政府が${PARTNERS[pk].name}への追加関税を解除した`);
        applyEffects(g);
        return { ok: true, success: true, text: `${PARTNERS[pk].name}への追加関税を解除した。` };
      },
    },
    tariff_exempt: {
      name: '関税の適用除外（例外）を決める', who: ['pm', 'finance', 'trade'], target: 'country', desc: '日本が科している関税の引き上げ・追加関税から、特定の国（同盟国・EPAの相手など）を除く。報復を避けやすくなるが、国内産業の保護は薄れる。',
      options: () => [{ id: 'all', label: 'すべての品目で除外', sub: '' }, ...CAT_ORDER.filter((c) => c !== 'rice').map((c) => ({ id: c, label: `${TARIFF_CATS[c].name}だけ除外`, sub: '' }))],
      check(g, id) {
        const pk = pkOf(id);
        if (!pk) return '相手を選ぶ';
        const p = pol(g); const posts = (p && p.me && p.me.posts) || [];
        if (!(posts.includes('pm') || posts.includes('minister_finance') || posts.includes('minister_trade'))) return '適用除外は総理か財務（大蔵）大臣、経済産業（通商産業）大臣が閣議で決める';
        return null;
      },
      odds: () => null,
      lines: (g, id) => ['除外した国には、日本が引き上げた関税や追加関税を適用しない', '相手国の不満が下がり、報復の見込みが小さくなる', '国内の産業（保護を求める層）からは「抜け穴だ」という声'],
      run(g, id, o) {
        const pk = pkOf(id);
        const t = T(g);
        const k = (o && o.kind) || 'all';
        const ex = t.exempt[pk] || (t.exempt[pk] = {});
        ex[k] = today(g);
        t.grievance[pk] = Math.max(0, num(t.grievance[pk]) - 15);
        relAdd(g, PK_MAIN[pk], 3);
        lg(g, `${PARTNERS[pk].name}を関税の適用除外にした（${k === 'all' ? '全品目' : TARIFF_CATS[k].name}）`, 'tariff');
        applyEffects(g);
        return { ok: true, success: true, text: `${PARTNERS[pk].name}を関税の適用除外にした（${k === 'all' ? '全品目' : TARIFF_CATS[k].name}）。` };
      },
    },
    safeguard: {
      name: '緊急関税（セーフガード）を発動する', who: ['pm', 'finance', 'trade', 'agri'], target: 'none', desc: '特定の品目の輸入が急に増えて国内産業が被害を受けるときに、期間を限って（6か月）関税を引き上げる措置。国会の議決を待たず、政令で行う。',
      options: () => CAT_ORDER.filter((c) => c !== 'rice' && c !== 'energy').map((c) => ({ id: c, label: TARIFF_CATS[c].name, sub: '' })),
      check(g, t, o) { const cat = o && o.cat; if (!cat) return null; if (!TARIFF_CATS[cat] || cat === 'rice') return 'その品目では使えない'; return tariffWhy(g, cat); },
      odds: () => null,
      lines(g, t, o) {
        const cat = (o && o.cat) || 'farm';
        const sg = T(g).surge[cat];
        return [`${TARIFF_CATS[cat].name}の関税を、6か月のあいだ ${TARIFF_CATS[cat].group === '農産物' ? '+15' : '+10'} ポイント引き上げる`, sg && sg >= today(g) ? '輸入が急増している（国内産業に被害のおそれ）：WTOのルールにも沿った措置' : '輸入の急増が確認されていない：発動すればルール違反と見なされ、相手国が報復する見込みが高い', '報復の見込みと、物価への影響は「関税率の改正」と同様に表示される'];
      },
      run(g, t, o) {
        const cat = (o && o.cat) || 'farm';
        const C = TARIFF_CATS[cat];
        const surge = T(g).surge[cat] && T(g).surge[cat] >= today(g);
        const pts = C.group === '農産物' ? 15 : 10;
        const tt = T(g);
        const main = pick(PK_ORDER.filter((pk) => supply(cat, pk, yr(g)) > 0.15)) || 'cn';
        (tt.extra[main] || (tt.extra[main] = [])).push({ cat, pts: pts * 1.2, day: today(g), until: today(g) + 60, id: 'x' + tt.seq++, sg: true });
        useStam(g, 6);
        if (!surge) { noteGrievance(g, cat, 0, 0); tt.grievance[main] = clamp(num(tt.grievance[main]) + 30, 0, 100); standingAdd(g, -1); }
        bumpApproval(g, AGRI.includes(cat) ? 1 : 0.3, '緊急関税');
        lg(g, `${C.name}の緊急関税を発動した（6か月）`, 'tariff');
        news(g, `政府が${C.name}の緊急関税（セーフガード）を発動した`);
        applyEffects(g);
        let text = `${C.name}の緊急関税を発動した（6か月、+${pts}ポイント）。`;
        if (!surge || roll(0.35)) { const rt = retaliate(g, main, pts, 'all', !surge); if (rt) text += `\n${rt}`; }
        return { ok: true, success: true, text };
      },
    },
  };

  // ---------------------------------------------------------------- retaliation
  function retaliate(g, pk, pts, cat, announced = false) {
    const t = T(g);
    const name = PARTNERS[pk].name;
    const cats = EXP_CATS.filter((e) => (pk === 'cn' || pk === 'us' || pk === 'eu' ? true : e !== 'steel'));
    const pickE = cat === 'auto' ? ['auto', 'industrial'] : cat === 'steel' ? ['steel', 'industrial'] : AGRI.includes(cat) ? ['farm', 'industrial'] : cat === 'all' ? ['auto', 'industrial'] : ['industrial', 'auto'];
    const hit = pickE.filter((e) => cats.includes(e));
    const each = Math.round(clamp(pts * 0.8, 5, 50) / hit.length * 10) / 10;
    const parts = [];
    for (const e of hit) {
      const row = (t.theirs[pk] || (t.theirs[pk] = {}))[e] || (t.theirs[pk][e] = { pts: 0 });
      row.pts = Math.min(60, num(row.pts) + each); row.since = today(g); row.why = '日本の関税への報復'; row.until = today(g) + 90;
      parts.push(`日本の${EXP_NAME[e]}に${rate1(each)}%`);
    }
    relAdd(g, PK_MAIN[pk], -4);
    t.war[pk] = Math.max(num(t.war[pk]), 2);
    t.grievance[pk] = Math.max(0, num(t.grievance[pk]) - 20);
    const text = `${name}は対抗して、${parts.join('・')}の関税を上乗せした。`;
    news(g, `${name}が日本の関税に対抗措置：${parts.join('・')}の上乗せ関税`);
    phone(g, `【経済ニュース】${name}が日本製品への報復関税を発表。\n${parts.join('・')}の関税が上乗せされる。輸出企業から懸念の声。`, 'ドット新聞 経済部');
    lg(g, text, 'retaliation');
    applyEffects(g);
    emit(g, 'retaliation', { pk, parts });
    return text;
  }

  // ---------------------------------------------------------------- EPA negotiation (with rounds) and tariff talks
  const orgMembers = (g, t) => X.membersOf(g, t);
  const targetPks = (g, t) => {
    if (COUNTRIES[t]) return [pkOf(t)].filter(Boolean);
    const ms = orgMembers(g, t);
    const set = new Set(ms.map((m) => pkOf(m)).filter(Boolean));
    if (t === 'eu') set.add('eu');
    if (t === 'asean') set.add('asean');
    return [...set];
  };
  const prof = (pks) => {
    const ps = pks.map((pk) => PROF[pk] || DEF_PROF);
    const o = {};
    for (const k of Object.keys(DEF_PROF)) o[k] = Math.round(ps.reduce((a, p) => a + p[k], 0) / Math.max(1, ps.length));
    return o;
  };
  DP.registerNegotiation('epa', {
    who: ['pm', 'foreign', 'trade', 'agri'],
    desc: '関税を下げ、貿易と投資を広げる協定の交渉。日本の農産物をどこまで開くか、相手に何を求めるかが争点。',
    rounds: 8,
    title: (g, t) => `日本・${shortName(g, t)}経済連携協定`,
    check(g, t) {
      if (!t) return '相手を選ぶ';
      if (!exists(g, t)) return 'その相手はいまはない';
      if (COUNTRIES[t] && !hasTies(g, t)) return `${shortName(g, t)}とは国交がない`;
      if (treatyWith(g, t, 'fta') || treatiesNow(g).some((x) => x.kind === 'fta' && x.with.includes(t))) return 'すでに経済連携協定を結んでいる';
      if (COUNTRIES[t] && atWarWith(g, t)) return '戦争中の相手とは結べない（まず講和）';
      const roles = tariffRoles(g);
      if (roles) return roles;
      return null;
    },
    bonus: (g, n) => (fyear(g) < 1999 ? -0.1 : fyear(g) < 2002 ? -0.05 : 0.02),
    issues(g, t) {
      const pks = targetPks(g, t);
      const P = prof(pks);
      const y = yr(g);
      const era = y < 1999 ? 0 : 1;
      const mk = (id, name, w, dem, want, theirs, max, extra = {}) => ({ id, name, w, dem, want, theirs, max, w2: extra.w2 ?? w, ...extra });
      return [
        mk('agri', '農林水産品の関税', 3, P.agri, 0, 0, 3, { w2: 1, lv: ['現状どおり', '一部の品目の関税を下げる', '多くの品目の関税を下げる', 'ほぼすべて撤廃'], seg: { farmers: -1.4, rural: -0.7, families: 0.35, urban: 0.2 }, note: '一般の農林水産品' }),
        mk('sacred', '重要品目（コメ・麦・牛豚肉・乳製品・砂糖）', 3, P.sacred, 0, 0, 3, { w2: 1, lv: ['関税を守る（除外）', '輸入枠だけ広げる', '関税を大きく下げる', '関税を撤廃'], seg: { farmers: -2.2, rural: -1.2, elderly: -0.3, families: 0.3 }, sacred: true, note: '国会決議で守ることを求められてきた品目' }),
        mk('ind', '工業製品の関税', 1, P.ind, P.wantInd, 0, 3, { w2: 3, lv: ['現状どおり', '一部を下げる', '多くを下げる', 'ほぼ全面撤廃'], seg: { unions: -0.4, business: 0.9 } }),
        mk('auto', '自動車・同部品の関税', 0, 0, P.wantAuto, 0, 3, { w2: 3, lvT: ['約束なし', '関税を一部下げる', '関税を大きく下げる', '関税を撤廃'], seg: {} }),
        mk('service', 'サービス・投資・知的財産・デジタル', 1, P.service, era ? 2 : 1, 1, 3, { w2: 1, seg: { business: 0.6, selfemployed: -0.25 } }),
        mk('people', '人の移動（看護・介護人材などの受け入れ）', 1, P.people, 0, 0, 2, { w2: 0.5, seg: { unions: -0.8, elderly: 0.2, rural: 0.1 }, lv: ['受け入れない', '少数の候補者を受け入れ', '枠を広げる', '大幅に広げる'] }),
      ];
    },
    finish(g, n) {
      const t = n.target;
      const pks = targetPks(g, t);
      const lv = Object.fromEntries(n.issues.map((i) => [i.id, i.mine]));
      const th = Object.fromEntries(n.issues.map((i) => [i.id, i.theirs]));
      const cuts = epaCuts(g, pks, lv, th);
      const tags = ['fta', ...(lv.agri >= 2 || lv.sacred >= 1 ? ['agri_cut'] : [])];
      const est = DP.dietEstimate(g, tags, 'treaty');
      const it = DP.dietSubmit(g, { kind: 'treaty', handler: 'treaty', name: n.name, tags, bill: 'fta', payload: { effect: 'epa', with: t, pks, name: n.name, lv, th, cuts: cuts.store, lines: cuts.lines } });
      return { text: `${n.name}で合意し、署名した。\n国会の承認を求める（衆議院の賛成の見込み 約${est.shugi != null ? Math.round(est.shugi * 100) : '—'}%・全体の通過の見込み ${pct(est.pass)}）。${it.via === 'bill' ? '\n（政治コアの法案として国会に提出された）' : ''}`, line: `${n.name}に署名した（国会の承認待ち）`, pending: true };
    },
  });
  // what the agreed package does to the tariffs (both ways)
  function epaCuts(g, pks, lv, th) {
    const n = dateNum(g);
    const fr = [0, 0.2, 0.5, 0.85], sf = [0, 0.15, 0.4, 0.7], ifr = [0, 0.3, 0.6, 1];
    const japan = {};
    const their = {};
    for (const c of ['livestock', 'farm', 'fish']) { const h = histRate(c, n); const f = Math.min(0.95, fr[lv.agri || 0] + (c === 'fish' ? 0 : sf[lv.sacred || 0])); japan[c] = rate1(h * f); }
    japan.rice = lv.sacred >= 3 ? rate1(histRate('rice', n) * 0.25) : 0;
    for (const c of ['industrial', 'apparel', 'steel']) japan[c] = rate1(histRate(c, n) * ifr[lv.ind || 0]);
    for (const pk of pks) {
      their[pk] = {
        industrial: rate1(theirBase(pk, 'industrial', n) * ifr[th.ind || 0]), steel: rate1(theirBase(pk, 'steel', n) * ifr[th.ind || 0]),
        auto: rate1(theirBase(pk, 'auto', n) * ifr[th.auto || 0]), farm: rate1(theirBase(pk, 'farm', n) * ifr[Math.min(3, (th.ind || 0))] * 0.5),
      };
    }
    const L = [];
    const cut = (c) => (japan[c] > 0 ? `${TARIFF_CATS[c].name} ${rateText(c, histRate(c, n))} → 約${rateText(c, Math.max(0, histRate(c, n) - japan[c]))}（段階的に）` : null);
    const jl = ['livestock', 'farm', 'fish', 'rice', 'industrial', 'apparel', 'steel'].map(cut).filter(Boolean);
    const tl = [];
    for (const pk of pks) for (const e of EXP_CATS) if (their[pk][e] > 0) tl.push(`${PARTNERS[pk].name}の${EXP_NAME[e]}の関税 ${rate1(theirBase(pk, e, n))}% → 約${rate1(Math.max(0, theirBase(pk, e, n) - their[pk][e]))}%`);
    const notes = [];
    if (lv.sacred >= 1) notes.push(`重要品目で譲歩（${['', '輸入枠の拡大', '関税の大幅な引き下げ', '関税の撤廃'][lv.sacred]}）`);
    if (lv.people >= 1) notes.push('人の受け入れの枠を設ける');
    return { store: { japan, their }, lines: { japan: jl, theirs: tl.slice(0, 5), notes } };
  }
  function tariffRoles(g) {
    const p = pol(g);
    if (!p) return '政治の仕組み（政治コア）が読み込まれていない';
    const posts = (p.me && p.me.posts) || [];
    if (posts.includes('pm') || posts.includes('minister_foreign') || posts.includes('minister_trade') || posts.includes('minister_agri')) return null;
    return '交渉は総理か外務・経済産業（通商産業）・農林水産大臣が行う（総理や大臣になれば、ここから動かせる）';
  }
  DP.registerApply('epa', (g, pl) => {
    const t = T(g);
    const s = W(g);
    const id = `epa_${pl.pks.join('_')}_${t.seq++}`;
    t.cuts[id] = { pk: pl.pks, japan: pl.cuts.japan, their: pl.cuts.their, name: pl.name, active: true, day: today(g) };
    for (const [pk, row] of Object.entries(pl.cuts.their)) {
      const th = t.theirs[pk] || (t.theirs[pk] = {});
      for (const [e, cutv] of Object.entries(row)) { if (cutv <= 0) continue; const r = th[e] || (th[e] = { pts: 0 }); r.pts = num(r.pts) - cutv; r.since = today(g); r.why = pl.name; delete r.until; }
    }
    const tid = addTreaty(g, { name: pl.name, kind: 'fta', with: pl.with ? [pl.with] : pl.pks });
    s.treaties[tid].content = { cuts: { japan: pl.lines.japan, theirs: pl.lines.theirs, notes: pl.lines.notes }, lv: pl.lv, th: pl.th };
    for (const pk of pl.pks) for (const idc of PARTNERS[pk] ? PARTNERS[pk].ids : []) if (exists(g, idc)) relAdd(g, idc, 4);
    standingAdd(g, 1);
    ecoShock(g, pl.name, { growth: clamp(pl.pks.reduce((a, pk) => a + interp(PARTNERS[pk].exp, yr(g)) * 4, 0), 0.04, 0.4), nikkei: 2, len: 360 });
    const ag = pl.lv.agri >= 1 || pl.lv.sacred >= 1;
    bumpApproval(g, ag ? -0.6 : 0.4, pl.name);
    news(g, `${pl.name}が国会で承認され、発効した`);
    phone(g, `【経済ニュース】${pl.name}が発効した。\n輸出企業には追い風、国内の農林水産業には逆風との声。`, 'ドット新聞 経済部');
    lg(g, `${pl.name}が発効した`, 'treaty');
    applyEffects(g);
  });
  // tariff talks with a partner that has put tariffs on Japan (or a deal about them)
  DP.registerNegotiation('tariffs', {
    who: ['pm', 'foreign', 'trade', 'agri'],
    desc: '相手国が日本の輸出品にかけている関税の引き下げ・撤回を求める交渉。見返りに、輸入の拡大や投資を求められることが多い。',
    rounds: 6,
    title: (g, t) => `${shortName(g, t)}との関税交渉`,
    check(g, t) {
      const pk = pkOf(t);
      if (!pk) return '相手を選ぶ（関税の相手は主要な貿易相手）';
      if (!exists(g, t) || (COUNTRIES[t] && !hasTies(g, t))) return '国交のない相手とは交渉できない';
      const roles = tariffRoles(g);
      if (roles) return roles;
      return null;
    },
    issues(g, t) {
      const pk = pkOf(t);
      const n = dateNum(g);
      const out = [];
      const P = PROF[pk] || DEF_PROF;
      for (const e of EXP_CATS) {
        const add = addedTheirs(g, pk, e);
        const base = theirBase(pk, e, n);
        if (add <= 0 && base < 8) continue;
        out.push({ id: 'th_' + e, name: `${PARTNERS[pk].name}の${EXP_NAME[e]}への関税（${rate1(base + add)}%）`, w: 0, w2: add > 0 ? 3 : 1, dem: 0, want: add > 0 ? 3 : 1, theirs: 0, max: add > 0 ? 3 : 2, lvT: ['引き下げなし', '一部引き下げ', '大きく引き下げ', '追加分の撤回／撤廃'], seg: {} });
      }
      out.push({ id: 'purchase', name: '米・農産物・エネルギーなどの輸入拡大', w: 2, dem: pk === 'us' ? 2 : 1, want: 0, theirs: 0, max: 2, lv: ['約束しない', '購入を増やす努力', '具体的な数量の約束', '大幅な購入拡大の約束'], seg: { farmers: -0.4, business: 0.3, families: 0.1 } });
      out.push({ id: 'invest', name: '相手国への投資・協力の約束', w: 2, dem: pk === 'us' ? 3 : pk === 'cn' ? 1 : 1, want: 0, theirs: 0, max: 2, lv: ['約束しない', '企業の投資を後押し', '官民の投資の枠組み', '大規模な投資基金'], seg: { business: 0.4, employees: -0.3, unions: -0.3 } });
      out.push({ id: 'agri', name: '農産物の関税の引き下げ', w: 2, dem: P.agri, want: 0, theirs: 0, max: 3, lv: ['現状どおり', '一部の品目', '多くの品目', 'ほぼ全面的に'], seg: { farmers: -1.2, rural: -0.6, families: 0.3 } });
      return out;
    },
    finish(g, n) {
      const pk = pkOf(n.target);
      const t = T(g);
      const th = Object.fromEntries(n.issues.map((i) => [i.id, i.theirs]));
      const mine = Object.fromEntries(n.issues.map((i) => [i.id, i.mine]));
      const fr = [0, 0.33, 0.66, 1];
      const parts = [];
      for (const e of EXP_CATS) {
        const lv = th['th_' + e];
        if (lv == null || !lv) continue;
        const row = (t.theirs[pk] || (t.theirs[pk] = {}))[e] || (t.theirs[pk][e] = { pts: 0 });
        const add = Math.max(0, num(row.pts));
        const base = theirBase(pk, e, dateNum(g));
        const cut = add > 0 ? add * fr[lv] + (lv === 3 ? 0 : 0) : base * fr[lv] * 0.5;
        row.pts = num(row.pts) - cut; row.since = today(g); row.why = '関税交渉の合意'; delete row.until;
        parts.push(`${EXP_NAME[e]} −${rate1(cut)}%`);
      }
      if (mine.purchase) ecoShock(g, '輸入拡大の約束', { yen: -0.4 * mine.purchase, growth: -0.02 * mine.purchase, len: 240 });
      if (mine.invest) ecoShock(g, '対外投資の約束', { yen: -0.7 * mine.invest, growth: -0.03 * mine.invest, len: 360 });
      let diet = '';
      if (mine.agri >= 1) {
        const lvA = mine.agri;
        const fra = [0, 0.15, 0.35, 0.6][lvA];
        for (const c of ['livestock', 'farm', 'fish']) {
          const cur = rateNow(g, c);
          const target = Math.max(0, cur - histRate(c, dateNum(g)) * fra);
          if (target < cur) DP.dietSubmit(g, { kind: 'law', handler: 'tariff', name: `関税定率法等の一部を改正する法律案（${TARIFF_CATS[c].name}・${shortName(g, n.target)}との合意）`, tags: ['agri_cut'], payload: { cat: c, rate: rate1(target) } });
        }
        diet = '\n日本が農産物の関税を下げる部分は、関税の改正案として国会に提出された。';
      }
      t.grievance[pk] = Math.max(0, num(t.grievance[pk]) - 35);
      t.war[pk] = Math.max(0, num(t.war[pk]) - 1);
      relAdd(g, PK_MAIN[pk], 6);
      for (const f of t.frictions) if (f.pk === pk && f.status === 'open') { f.status = 'settled'; f.how = '関税交渉で決着'; }
      bumpApproval(g, mine.invest >= 2 || mine.purchase >= 2 ? -0.4 : 0.5, `${PARTNERS[pk].name}との関税交渉`);
      lg(g, `${PARTNERS[pk].name}との関税交渉が合意：${parts.join('・') || '日本の約束と引き換えに現状維持'}`, 'treaty');
      news(g, `日本と${PARTNERS[pk].name}が関税交渉で合意した。${parts.join('・')}`);
      applyEffects(g);
      return { text: `${PARTNERS[pk].name}との関税交渉が合意した。${parts.length ? `\n相手国の関税：${parts.join('・')}` : ''}${diet}`, line: `${PARTNERS[pk].name}との関税交渉が合意した` };
    },
  });
  // tariff_talks as a diplomacy action too (its UI is the negotiation screen)
  ACTIONS.tariff_talks = {
    name: '関税交渉（相手国の関税の引き下げを求める）', who: ['pm', 'foreign', 'trade', 'agri'], target: 'country', rich: 'tariffs',
    desc: '相手国が日本の輸出品にかけている関税の引き下げ・撤回を求める交渉。事務レベルから始め、閣僚折衝・首脳協議へ格を上げられる。譲歩できる項目と、守りたい項目を選んで進める。',
    odds: () => null,
    lines: (g, id) => { const pk = pkOf(id); if (!pk) return ['相手を選ぶ']; const rows = EXP_CATS.map((e) => `${EXP_NAME[e]} ${theirsNow(g, pk, e)}%${addedTheirs(g, pk, e) ? '（追加分あり）' : ''}`); return [`${PARTNERS[pk].name}が日本の輸出品にかけている関税（目安）：${rows.join('・')}`, '交渉は複数回のラウンドで進む。相手は見返りに輸入拡大・投資・農産物の開放を求めることが多い', '決裂せずに席を立つこともできる（相手が条件を見直して呼び戻すことがある）']; },
    run(g, id, o) { const r = DP.negoStart(g, 'tariffs', id, o); return r.ok ? { ok: true, success: true, text: r.text + '\n（交渉の画面で続ける）', nego: r.id } : r; },
  };
  ACTIONS.tariff_talks.check = function (g, id) {
    const pk = pkOf(id);
    if (!pk) return '相手を選ぶ（関税の相手は主要な貿易相手）';
    if (!exists(g, id) || (COUNTRIES[id] && !hasTies(g, id))) return '国交のない相手とは交渉できない';
    return tariffRoles(g);
  };

  // ---------------------------------------------------------------- frictions (events) and the player's answers
  const frictionOf = (g, kid) => { const k = W(g).crises.find((c) => c.id === kid); if (!k || k.kind !== 'trade') return null; return T(g).frictions.find((f) => f.crisis === kid && f.status === 'open') || null; };
  const FR_WHO = ['pm', 'foreign', 'trade', 'agri'];
  const FR_ACT = {
    trade_talk: { name: '閣僚協議で解決を探る', short: '閣僚協議', how: 'talk', desc: '相手国の担当閣僚と協議し、双方が歩み寄れる線を探る（体力10）。', lines: ['成功：貿易摩擦が決着。関係＋3・支持率＋', '失敗：期限が8日延びる。関係−1'] },
    trade_concede: { name: '要求の一部を受け入れる（譲歩）', short: '要求を受け入れる', how: 'concede', desc: '相手国の要求の一部を受け入れて、摩擦を収める。確実に決着するが、国内の産業・農家から反発が出る。', lines: ['確実に決着。関係＋5', '国内の特定の層の反発と、場合によって関税の引き下げ'] },
    trade_wto: { name: 'WTO（GATT）に協議・提訴を求める', short: 'WTOに提訴', how: 'wto', desc: 'ルールにもとづく解決を求める（体力8）。時間はかかるが、国際的な評価は上がる。1995年のWTO発足より前はGATTの紛争処理。', lines: ['成功：相手が措置を見直す。国際的な信頼＋', '失敗：手続きが長引き、期限が12日延びる'] },
    trade_counter: { name: '対抗措置をとる（追加関税）', short: '対抗措置', how: 'counter', desc: '相手国の品目に追加関税を科して対抗する。相手が報復すると、関税の応酬（貿易戦争）に進むおそれがある。', lines: ['相手が報復する見込み：約65%', '国内では毅然とした対応として評価する声と、物価・輸出への影響を心配する声'] },
  };
  for (const [id, F] of Object.entries(FR_ACT)) {
    ACTIONS[id] = {
      name: F.name, short: F.short, who: FR_WHO, target: 'crisis', desc: F.desc,
      check(g, kid) { const f = frictionOf(g, kid); if (!f) return 'この危機は貿易摩擦ではない（または決着ずみ）'; if (stam(g) < 10 && F.how === 'talk') return '体力が足りない（体力10）'; return null; },
      odds(g, kid) { const f = frictionOf(g, kid); if (!f) return null; if (F.how === 'talk') return clamp(0.38 + relation(g, PK_MAIN[f.pk]) / 220 + (DP.D(g).prep[PK_MAIN[f.pk]] ? 0.1 : 0) - f.sev * 0.05, 0.1, 0.85); if (F.how === 'wto') return clamp(0.4 - f.sev * 0.05, 0.15, 0.7); return null; },
      lines(g, kid) { const f = frictionOf(g, kid); return [f ? `${f.title}：${f.ask}` : '', ...F.lines].filter(Boolean); },
      run(g, kid) { const f = frictionOf(g, kid); if (!f) return { ok: false, why: '貿易摩擦は決着ずみ' }; return frictionRespond(g, f.id, F.how); },
    };
  }
  function seed(g) {
    const t = T(g);
    if (t.seeded) return;
    t.seeded = 1;
    // the era's trade picture at the start: facts already in the baseline (no choices)
    const era = (g.state.profile && g.state.profile.era) || 'reiwa';
    const BG = {
      showa: ['日米貿易摩擦の最中。1987年4月、米国は日米半導体協定の違反を理由に、日本製の電子機器に100%の関税をかけた', '牛肉・オレンジは、輸入割当（数量の制限）の撤廃を米国などが求めて交渉が続いている', 'コメは輸入禁止。米国が市場開放を求めている'],
      heisei_early: ['ウルグアイ・ラウンドの合意（1993年12月）にもとづき、WTO（1995年1月）の発足にあわせて関税を引き下げている', 'コメはミニマム・アクセス（最低限の輸入枠。毎年少しずつ増える）を受け入れ、関税化はしない特例措置を選んでいる', '米国との自動車・部品の協議が続く（1995年は高級車への100%関税をめぐる交渉があった）'],
      heisei: ['シンガポール（2002年）に続き、メキシコ・マレーシア・タイなどとEPA（経済連携協定）の交渉を進めている', '中国の輸入が急増し、貿易の最大の相手になりつつある', '2001年の暫定セーフガード、米国産牛肉のBSEによる輸入停止（2003年12月）など、貿易の摩擦が続いた'],
      reiwa: ['米国は2025年から相互関税・自動車関税を科し、日米合意（2025年7月）で自動車は15%に。2026年2月に最高裁がIEEPAにもとづく関税を違法と判断し、通商法122条の10%（150日）をへて、301条にもとづく関税に', '中国は日本産水産物の輸入を2023年8月から停止し、2026年1月には軍民両用品の対日輸出管理を強化した', 'TPP11・日EU・日米貿易協定・RCEPは発効ずみ。コメの価格が高騰し、関税のあり方が議論されている'],
    };
    t.background = BG[era] || BG.reiwa;
  }
  function pickTemplate(g) {
    const n = dateNum(g);
    const list = FRICTIONS.filter((f) => n >= f.from && n <= f.to && exists(g, PK_MAIN[f.pk]) && hasTies(g, PK_MAIN[f.pk]));
    const open = new Set(T(g).frictions.filter((f) => f.status === 'open').map((f) => f.tid));
    const L = list.filter((f) => !open.has(f.id));
    if (!L.length) return null;
    let r0 = rnd() * L.reduce((a, f) => a + f.w, 0);
    for (const f of L) { r0 -= f.w; if (r0 <= 0) return f; }
    return L[0];
  }
  function fireFriction(g, f) {
    const t = T(g);
    const pk = f.pk;
    const k = crisis(g, { kind: 'trade', title: f.title, country: PK_MAIN[pk], sev: f.sev, until: today(g) + 40, trade: f.id });
    const fr = { id: 'f' + t.seq++, tid: f.id, pk, title: f.title, item: f.item, ask: f.ask, theirs: f.theirs, sev: f.sev, day: today(g), deadline: today(g) + 25, status: 'open', crisis: k.id };
    t.frictions.push(fr);
    if (t.frictions.length > 14) t.frictions = t.frictions.filter((x) => x.status === 'open').concat(t.frictions.filter((x) => x.status !== 'open').slice(-8));
    relAdd(g, PK_MAIN[pk], -3);
    news(g, `【貿易摩擦】${PARTNERS[pk].name}が${f.item}をめぐり日本に要求（${f.ask}）。応じない場合は日本の輸出品への関税を警告している`);
    if (isPM(g) || X.isFM(g)) note(g, `（貿易摩擦：${f.title}。「貿易・関税」の画面で対応を選べる。期限は25日）`);
    if (isPM(g) && f.sev >= 2) X.scene(g, 'crisis', { id: k.id });
    return fr;
  }
  function settle(g, fr, how, text) {
    fr.status = 'settled'; fr.how = how; fr.closed = today(g);
    const t = T(g);
    const k = X.W(g).crises.find((c) => c.id === fr.crisis);
    if (k) k.until = today(g);
    t.war[fr.pk] = Math.max(0, num(t.war[fr.pk]) - 1);
    lg(g, `貿易摩擦「${fr.title}」：${text}`, 'friction');
  }
  function frictionRespond(g, id, how, opts = {}) {
    const t = T(g);
    const fr = t.frictions.find((f) => f.id === id);
    if (!fr) return { ok: false, why: 'その貿易摩擦はない' };
    if (fr.status !== 'open') return { ok: false, why: 'その問題はもう決着している' };
    const F = FRICTIONS.find((x) => x.id === fr.tid) || {};
    const pk = fr.pk, name = PARTNERS[pk].name;
    const sev = fr.sev;
    if (how === 'talk') {
      const p = clamp(0.38 + relation(g, PK_MAIN[pk]) / 220 + (DP.D(g).prep[PK_MAIN[pk]] ? 0.1 : 0) - sev * 0.05, 0.1, 0.85);
      useStam(g, 10);
      if (roll(p)) { settle(g, fr, '閣僚協議', '閣僚協議で、双方が歩み寄って決着した'); relAdd(g, PK_MAIN[pk], 3); bumpApproval(g, 0.8, '貿易摩擦の解決'); news(g, `${name}との貿易摩擦（${fr.title}）は閣僚協議で決着した`); return { ok: true, success: true, text: `閣僚協議で双方が歩み寄り、「${fr.title}」は決着した。（見込みは${pct(p)}だった）` }; }
      fr.deadline += 8; relAdd(g, PK_MAIN[pk], -1);
      return { ok: true, success: false, text: `協議は物別れに終わった。期限が8日延びた。（見込みは${pct(p)}だった）` };
    }
    if (how === 'concede') {
      const C = F.concede || {};
      if (C.cat && C.delta) {
        const cur = rateNow(g, C.cat); const to = clamp(cur + C.delta * (TARIFF_CATS[C.cat].step ? 1 : 1), TARIFF_CATS[C.cat].min, TARIFF_CATS[C.cat].max);
        if (to < cur) { t.ovr[C.cat] = to; lg(g, `${TARIFF_CATS[C.cat].name}の関税を${rateText(C.cat, cur)}から${rateText(C.cat, to)}に（${fr.title}の合意）`, 'tariff'); }
      }
      if (C.eco) ecoShock(g, `${fr.title}の合意`, { ...C.eco, len: 240 });
      const p0 = pol(g);
      if (p0 && C.segs && shiftSupport) shiftSupport(p0, C.segs, 0.004);
      bumpApproval(g, C.approval ?? -0.3, `${fr.title}の譲歩`);
      settle(g, fr, '譲歩', C.text || '要求の一部を受け入れて決着した');
      relAdd(g, PK_MAIN[pk], 5);
      applyEffects(g);
      news(g, `${name}との貿易摩擦（${fr.title}）：日本が譲歩して決着した`);
      return { ok: true, success: true, text: `${C.text || '要求の一部を受け入れた。'}\n（国内の反応：${C.cost || '譲りすぎという声'}）` };
    }
    if (how === 'wto') {
      if (fyear(g) < 1995) {
        const p = 0.2; useStam(g, 6);
        if (roll(p)) { settle(g, fr, 'GATTの紛争処理', 'GATTの紛争処理の手続きで、相手が措置を見送った'); return { ok: true, success: true, text: 'GATTの紛争処理の手続きを求め、相手は措置を見送った。' }; }
        relAdd(g, PK_MAIN[pk], -2); fr.deadline += 5; return { ok: true, success: false, text: 'GATTの手続きは時間がかかり、相手は聞き入れなかった。' };
      }
      const p = clamp(0.4 + (F.sev ? 0 : 0) - sev * 0.05 + (fr.tid === 'steel_us' || fr.tid === 'steel02' ? 0.2 : 0), 0.15, 0.7);
      useStam(g, 8);
      if (roll(p)) { settle(g, fr, 'WTOの協議', 'WTOの協議・紛争処理で、相手の措置が見直された'); relAdd(g, PK_MAIN[pk], 1); standingAdd(g, 1); news(g, `${name}との貿易摩擦（${fr.title}）：WTOの手続きで相手が措置を撤回した`); return { ok: true, success: true, text: `WTOに協議を要請し、ルールにもとづき相手が措置を見直した。（見込みは${pct(p)}だった）` }; }
      relAdd(g, PK_MAIN[pk], -2); fr.deadline += 12; standingAdd(g, 0.5);
      return { ok: true, success: false, text: `WTOの手続きは長引く見通し。期限が12日延びた（相手は従わない構え）。（見込みは${pct(p)}だった）` };
    }
    if (how === 'counter') {
      const pts = Object.values(fr.theirs || {})[0] || 10;
      const cat = pick(['industrial', 'auto', 'apparel', 'farm']);
      const t2 = T(g);
      (t2.extra[pk] || (t2.extra[pk] = [])).push({ cat, pts: Math.min(30, pts), day: today(g), until: today(g) + 60, id: 'x' + t2.seq++ });
      t2.grievance[pk] = clamp(num(t2.grievance[pk]) + 25, 0, 100);
      t2.war[pk] = Math.max(num(t2.war[pk]), 2);
      relAdd(g, PK_MAIN[pk], -4);
      bumpApproval(g, roll(0.55) ? 1 : -0.8, '対抗措置');
      fr.status = 'escalated'; fr.how = '対抗措置'; fr.closed = today(g);
      const k = X.W(g).crises.find((c) => c.id === fr.crisis); if (k) k.until = today(g);
      lg(g, `貿易摩擦「${fr.title}」：${name}に対抗措置（${TARIFF_CATS[cat].name}に追加関税）`, 'friction');
      applyEffects(g);
      let text = `${name}の${TARIFF_CATS[cat].name}に対抗の追加関税（${Math.min(30, pts)}%）を科した。`;
      if (roll(0.65)) { const r = retaliate(g, pk, Math.min(30, pts), cat); if (r) text += `\n${r}`; } else { text += '\n相手はいまのところ報復を見送っている。'; }
      applyFrictionThreat(g, fr, 0.4);
      return { ok: true, success: true, text };
    }
    // 'ignore' → handled at the deadline
    return { ok: false, why: '対応を選ぶ' };
  }
  function applyFrictionThreat(g, fr, k = 1) {
    const t = T(g);
    for (const [e, pts] of Object.entries(fr.theirs || {})) {
      const x = (t.theirs[fr.pk] || (t.theirs[fr.pk] = {}))[e] || (t.theirs[fr.pk][e] = { pts: 0 });
      x.pts = Math.min(70, num(x.pts) + pts * k); x.since = today(g); x.why = fr.title; x.until = today(g) + 100;
    }
  }
  function frictionsTick(g) {
    const t = T(g);
    for (const fr of t.frictions) {
      if (fr.status !== 'open' || today(g) < fr.deadline) continue;
      // the deadline: the threat is carried out (or the NPC cabinet answers)
      const npc = !(isPM(g) || X.isFM(g));
      if (npc && roll(0.55)) { settle(g, fr, '政府の対応', '政府の事務レベルの協議で決着した'); relAdd(g, PK_MAIN[fr.pk], 2); news(g, `${PARTNERS[fr.pk].name}との貿易摩擦（${fr.title}）は政府間の協議で決着した`); continue; }
      applyFrictionThreat(g, fr, 1);
      fr.status = 'imposed'; fr.closed = today(g);
      t.war[fr.pk] = Math.max(num(t.war[fr.pk]), fr.sev);
      const parts = Object.entries(fr.theirs).map(([e, p]) => `${EXP_NAME[e] || e}に${p}%`);
      news(g, `${PARTNERS[fr.pk].name}が日本への関税措置を発動した（${parts.join('・')}）。${fr.title}`);
      phone(g, `【経済ニュース】${PARTNERS[fr.pk].name}が日本の輸出品に関税を発動。\n${parts.join('・')}。輸出企業は価格の引き上げや生産の見直しを迫られている。`, 'ドット新聞 経済部');
      lg(g, `貿易摩擦「${fr.title}」：${PARTNERS[fr.pk].name}が関税措置を発動した`, 'friction');
      const k = X.W(g).crises.find((c) => c.id === fr.crisis); if (k) k.until = today(g);
      applyEffects(g);
    }
  }
  // import surges (the ground for a safeguard)
  function surgeTick(g) {
    const t = T(g);
    if (roll(0.04)) {
      const c = pick(['farm', 'apparel', 'fish', 'livestock', 'steel']);
      t.surge[c] = today(g) + 40;
      const pk = pick(PK_ORDER.filter((p) => supply(c, p, yr(g)) > 0.12)) || 'cn';
      news(g, `${PARTNERS[pk].name}産の${TARIFF_CATS[c].name}の輸入が急増している。国内の産地・メーカーが緊急関税を求めている`);
    }
    for (const c of Object.keys(t.surge)) if (t.surge[c] < today(g) - 20) delete t.surge[c];
  }

  // ---------------------------------------------------------------- partner offers (deals) and the 10-day tick
  function dealsTick(g) {
    const t = T(g);
    // relation is good, they have tariffs on us: they may offer a deal
    if (!roll(0.025)) return;
    for (const pk of PK_ORDER) {
      if (t.deals.some((d) => d.status === 'open')) return;
      const added = EXP_CATS.some((e) => addedTheirs(g, pk, e) > 3);
      if (!added || relation(g, PK_MAIN[pk]) < -5) continue;
      const d = { id: 'dl' + t.seq++, pk, day: today(g), status: 'open', text: `${PARTNERS[pk].name}が、日本の輸出品にかけた関税を下げる代わりに、農産物の購入と投資の拡大を求める協議を提案してきた` };
      t.deals.push(d);
      news(g, d.text);
      if (isPM(g) || X.isFM(g)) note(g, '（関税の引き下げの提案が届いた。「貿易・関税」の画面から交渉を始められる）');
      return;
    }
  }
  function tick(g) {
    const t = T(g);
    seed(g);
    if (today(g) - t.last < 10) return;
    t.last = today(g);
    // extras and the partners' temporary tariffs expire; the grievance cools; the war level follows
    for (const pk of Object.keys(t.extra)) { t.extra[pk] = t.extra[pk].filter((x) => !x.until || x.until >= today(g)); if (!t.extra[pk].length) delete t.extra[pk]; }
    for (const pk of Object.keys(t.theirs)) for (const e of Object.keys(t.theirs[pk])) {
      const r = t.theirs[pk][e];
      if (r.until && r.until < today(g)) { r.pts = r.pts * 0.5; if (Math.abs(r.pts) < 0.5) delete t.theirs[pk][e]; else r.until = today(g) + 40; }
    }
    for (const pk of Object.keys(t.grievance)) {
      t.grievance[pk] *= 0.96;
      if (t.grievance[pk] < 1) delete t.grievance[pk];
      else if (t.grievance[pk] > 45 && roll(0.18)) { const r = retaliate(g, pk, Math.min(30, t.grievance[pk] * 0.5), pick(['auto', 'industrial', 'farm'])); if (r) { t.grievance[pk] *= 0.55; } }
    }
    for (const pk of Object.keys(t.war)) {
      const has = EXP_CATS.some((e) => addedTheirs(g, pk, e) > 2) || (t.extra[pk] && t.extra[pk].length);
      if (!has && t.war[pk] > 0 && roll(0.3)) t.war[pk] = Math.max(0, t.war[pk] - 1);
      if (!t.war[pk]) delete t.war[pk];
    }
    // the partner's weariness: its added tariffs ease slowly when the relation is good
    for (const pk of Object.keys(t.theirs)) for (const e of Object.keys(t.theirs[pk])) { const r = t.theirs[pk][e]; if (r.pts > 0 && relation(g, PK_MAIN[pk]) > 30 && roll(0.1)) r.pts = Math.max(0, r.pts - 2); }
    if (roll(0.075) && today(g) > 5) { const f = pickTemplate(g); if (f && (isPM(g) || X.isFM(g) || roll(0.5))) fireFriction(g, f); }
    frictionsTick(g);
    surgeTick(g);
    dealsTick(g);
    applyEffects(g);
    const c = calc(g).sum;
    t.series.push({ day: today(g), rev: c.revenue, bal: baseBalance(g) + c.balance, infl: c.infl });
    if (t.series.length > 36) t.series.shift();
  }

  // ---------------------------------------------------------------- summaries for the UI
  function revenueInfo(g) {
    const c = calc(g).sum;
    const b = typeof g.budget === 'function' ? (() => { try { return g.budget(); } catch (e) { return null; } })() : null;
    const byCat = CAT_ORDER.filter((x) => x !== 'rice').map((x) => ({ id: x, name: TARIFF_CATS[x].name, value: Math.round(calc(g).cats[x].revenue * 1000) / 1000, base: Math.round(calc(g).cats[x].revBase * 1000) / 1000 })).sort((a, b2) => b2.value - a.value);
    const w = X.worldDate(g);
    return { fy: w.month >= 4 ? w.year : w.year - 1, total: Math.round(c.revenue * 100) / 100, base: Math.round(c.revBase * 100) / 100, delta: Math.round((c.revenue - c.revBase) * 1000) / 1000, byCat, shareOfTax: b && b.tax ? Math.round((c.revenue / b.tax) * 1000) / 10 : null, unit: '兆円/年', note: '関税収入（一般会計）。govt.jsの税収（その他の税）に加えるときは delta を使う' };
  }
  function summary(g) {
    const t = T(g);
    const calcd = calc(g);
    const c = calcd.sum;
    const n = dateNum(g);
    const y = yr(g);
    const cats = CAT_ORDER.map((id) => {
      const C = TARIFF_CATS[id], k = calcd.cats[id];
      const row = histRow(id, n);
      return {
        id, name: C.name, group: C.group, unit: C.unit, rate: k.rate, rateText: rateText(id, k.rate), hist: k.hist, histText: rateText(id, k.hist), histNote: row[2] || '', changed: Math.abs(k.rate - k.hist) > 0.001, dir: k.rate > k.hist + 0.001 ? 'up' : k.rate < k.hist - 0.001 ? 'down' : 'same',
        eff: Math.round(k.eff * 10) / 10, effText: k.eff !== k.rate ? `${rate1(k.eff)}%（追加関税・協定をふくむ実効の目安）` : '', dAve: Math.round(k.dAve * 10) / 10, bound: boundAt(id, n), boundText: rateText(id, boundAt(id, n)), over: k.rate > boundAt(id, n) + 0.001,
        min: C.min, max: C.max, step: C.step, imp: Math.round(interp(C.imp, y) * 10) / 10, who: C.who, pro: C.pro, con: C.con, note: (C.note || []).filter((x) => x[0] <= n).map((x) => x[1]).join(''), boundLabel: n < 19950101 ? 'GATT' : 'WTO', revenue: Math.round(k.revenue * 1000) / 1000, price: Math.round(k.price * 100) / 100,
        timeline: C.hist.filter((r) => r[0] <= n && r[2]).map((r) => ({ date: r[0], text: r[2], rate: rateText(id, r[1]) })).slice(-6),
        pending: DP.D(g).diet.filter((it) => it.status === 'open' && it.handler === 'tariff' && it.payload.cat === id).map((it) => ({ id: it.id, to: rateText(id, it.payload.rate), stage: it.stage })),
      };
    });
    const partners = PK_ORDER.map((pk) => {
      const P = PARTNERS[pk];
      const ids = P.ids.filter((x) => exists(g, x));
      if (!ids.length) return null;
      const theirs = EXP_CATS.map((e) => ({ cat: e, name: EXP_NAME[e], base: theirBase(pk, e, n), add: Math.round(addedTheirs(g, pk, e) * 10) / 10, total: theirsNow(g, pk, e), note: theirNote(pk, e, n) }));
      const treaties = treatiesNow(g).filter((x) => x.kind === 'fta' && (x.with.some((w) => P.ids.includes(w)) || x.with.includes(pk))).map((x) => x.name);
      return {
        pk, name: P.name, main: PK_MAIN[pk], ids, share: Math.round((interp(P.imp, y) + interp(P.exp, y)) * 50), exp: Math.round(interp(P.exp, y) * 100), imp: Math.round(interp(P.imp, y) * 100), rel: relation(g, PK_MAIN[pk]),
        theirs, extra: (t.extra[pk] || []).filter((x) => !x.until || x.until >= today(g)).map((x) => ({ cat: x.cat, name: x.cat === 'all' ? '全品目' : TARIFF_CATS[x.cat].name, pts: x.pts, days: x.until ? x.until - today(g) : null })), exempt: Object.keys(t.exempt[pk] || {}),
        grievance: Math.round(num(t.grievance[pk])), war: num(t.war[pk]), warLabel: ['平穏', '摩擦', '関税の応酬', '全面的な貿易戦争'][clamp(num(t.war[pk]), 0, 3)], treaties,
      };
    }).filter(Boolean);
    const frictions = t.frictions.slice().reverse().slice(0, 8).map((f) => ({ ...f, name: PARTNERS[f.pk].name, daysLeft: f.status === 'open' ? f.deadline - today(g) : null }));
    return {
      date: X.worldDate(g), cats, partners, frictions, deals: t.deals.filter((d) => d.status === 'open').map((d) => ({ ...d, name: PARTNERS[d.pk].name })), ledger: t.ledger.slice(0, 14), background: t.background || [],
      revenue: revenueInfo(g),
      effects: { infl: c.infl, growth: c.growth, balance: c.balance, exportLoss: c.exportLoss, importDelta: c.importDelta },
      macro: { imports: Math.round(c.IMP * 10) / 10, exports: Math.round(c.EXP * 10) / 10, balanceBase: Math.round((c.EXP - c.IMP) * 10) / 10, balance: Math.round((c.EXP - c.IMP + c.balance) * 10) / 10, gdp: Math.round(c.GD) },
      segments: Object.entries(c.seg).map(([sg, v]) => ({ seg: sg, name: segName(sg), v: Math.round(v * 100) / 100 })).filter((x) => Math.abs(x.v) >= 0.03).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)),
      series: t.series.slice(-24), surge: Object.keys(t.surge).filter((k) => t.surge[k] >= today(g)).map((k) => ({ cat: k, name: TARIFF_CATS[k].name, days: t.surge[k] - today(g) })),
      war: Object.values(t.war).reduce((a, v) => Math.max(a, v), 0),
    };
  }
  // an abrogated real EPA takes its cuts back (the world follows the baseline of history, so the loss is an effect)
  function onAbrogate(g, treatyId) {
    const tr = TREATIES[treatyId];
    if (!tr || tr.kind !== 'fta') return;
    const t = T(g);
    const pks = [...new Set(tr.with.map((x) => pkOf(x) || (x === 'eu' ? 'eu' : x === 'asean' ? 'asean' : null)).filter(Boolean))];
    if (!pks.length || t.rolled[treatyId]) return;
    const n = dateNum(g);
    const fr = { livestock: 0.3, farm: 0.25, fish: 0.3, industrial: 0.4, apparel: 0.4, steel: 0.4 };
    const japan = {};
    for (const [c, f] of Object.entries(fr)) japan[c] = rate1(histRate(c, n) * f);
    t.rolled[treatyId] = { pk: pks, japan, day: today(g) };
    for (const pk of pks) for (const e of EXP_CATS) {
      const x = (t.theirs[pk] || (t.theirs[pk] = {}))[e] || (t.theirs[pk][e] = { pts: 0 });
      x.pts = num(x.pts) + rate1(Math.max(2, theirBase(pk, e, n) * 0.5)); x.why = '協定の破棄'; x.since = today(g);
    }
    applyEffects(g);
  }
  function brief(g) {
    const c = calc(g).sum;
    const t = T(g);
    return { infl: c.infl, growth: c.growth, balance: c.balance, revenue: c.revenue, revenueDelta: Math.round((c.revenue - c.revBase) * 1000) / 1000, war: Object.values(t.war).reduce((a, v) => Math.max(a, v), 0), frictions: t.frictions.filter((f) => f.status === 'open').length, deals: t.deals.filter((d) => d.status === 'open').length };
  }
  function onSanction(g, id, lv) {
    const pk = pkOf(id);
    if (!pk) return;
    const t = T(g);
    t.grievance[pk] = clamp(num(t.grievance[pk]) + 14 * lv, 0, 100);
    t.war[pk] = Math.max(num(t.war[pk]), Math.min(3, lv));
  }
  const methods = {
    tariffs() { seed(this); return summary(this); },
    tariffPreview(cat, rate, opts = {}) { return tariffPreview(this, cat, rate, opts); },
    tariffSet(cat, rate, opts = {}) { return this.diplomacy('tariff_set', null, { ...opts, cat, rate }); },
    tariffReset(cat) { const h = histRate(cat, dateNum(this)); return this.diplomacy('tariff_set', null, { cat, rate: h }); },
    tariffCandidates(cat) {
      return candidates(this, cat).map((x) => {
        const pv = tariffPreview(this, cat, x.rate);
        const e = pv.ok ? pv.effects : null;
        const hint = e ? `物価 ${e.infl >= 0 ? '+' : ''}${e.infl.toFixed(2)}・収入 ${e.revenue >= 0 ? '+' : ''}${e.revenue.toFixed(2)}兆円${pv.over ? '・WTOの上限超え' : ''}・国会 ${Math.round(pv.estimate.pass * 100)}%` : '';
        return { ...x, rateText: rateText(cat, x.rate), hint, sub: x.sub ? `${x.sub}　${hint}` : hint };
      });
    },
    tariffRevenue() { return revenueInfo(this); },
    tradeSummary() { const s = summary(this); return { effects: s.effects, macro: s.macro, revenue: s.revenue, war: s.war, frictions: s.frictions.filter((f) => f.status === 'open').length }; },
    tariffFrictions() { return summary(this).frictions; },
    tradeRespond(id, how, opts = {}) { return frictionRespond(this, id, how, opts); },
    tradeDealAnswer(id, yes) {
      const t = T(this);
      const d = t.deals.find((x) => x.id === id);
      if (!d || d.status !== 'open') return { ok: false, why: 'その提案はもう終わっている' };
      d.status = yes ? 'accepted' : 'declined';
      if (yes) return this.diplomacy('tariff_talks', PK_MAIN[d.pk], {});
      relAdd(this, PK_MAIN[d.pk], -1);
      return { ok: true, success: false, text: '提案を見送った。' };
    },
    tradeTick() { return tick(this); },
    // tests / debug: fire a friction template now (an id of FRICTIONS, or a random one of the era)
    tradeFire(id = null) { const f = id ? FRICTIONS.find((x) => x.id === id) : pickTemplate(this); return f ? fireFriction(this, f) : null; },
  };
  return { methods, actions: ACTIONS, tick, summary, brief, calc, applyEffects, T, retaliate, onAbrogate, onSanction, tariffPreview, tariffSet, TARIFF_CATS, PARTNERS, rateNow, FRICTIONS, revenueInfo, theirsNow, pkOf, seed, frictionRespond };
}
