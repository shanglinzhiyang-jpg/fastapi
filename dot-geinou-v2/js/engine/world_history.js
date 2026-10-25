// 世界の歴史・記録・地域 (R9-E, round 9): created by world.js with its helper bundle (no imports of its own, like
// world_trade.js / world_diplo.js / world_stance.js).
//   1. REAL_EVENTS — real world events by date (short factual headlines; no living person is named). Events before the era's
//      start are history (the 年表 shows them); events after the start fire on their date (news line, small effects, staged
//      crises, the NPC government's real steps when the player is not 総理). Institutional changes stay in world.js HISTORY
//      (mirrored here as `inst` rows for the timeline).
//   2. Staged crises (STAGED): a real crisis advances through dated stages (湾岸危機 → 決議 → 開戦 → 停戦 …); every other
//      crisis gets time-based stages by its kind (発生 → 拡大 → 山場 → 収束へ). stageOf(g, crisis).
//   3. The monthly record (series) of tension / standing / threat / oil / every relation / Japan's trade, for the charts;
//      before the era start the charts use the model's own anchors (目安).
//   4. Regions (東アジア・東南アジア・南アジア・中東・欧州・米州・オセアニア) with a status (安定 / 不安定 / 緊張 / 紛争).
//   5. Two crisis actions: crisis_statement 声明（懸念・非難・連帯）and crisis_fund 資金・物資の支援.
// Facts web-checked 2026-10 (WebSearch; sources: mofa.go.jp 外交青書 1991/1997/2004/2005, nids.mod.go.jp, cao.go.jp PKO,
//   mod.go.jp, kotobank, imidas, jaea.go.jp, nippon.com, kanaloco 1991年表, AFP, CNN.co.jp, AP (World Cup 2026-07-19),
//   elysee.fr / g7.utoronto.ca, Britannica (Jasmine Revolution)). Dates verified only to the month are written as months.
// API: see test-output/api_r9e.txt.

const A = (...p) => p;
// ---------------------------------------------------------------- real events
// { d: yyyymmdd, id, cat, where?: country id, at?: [lat, lon], text, inst?: world.js HISTORY id (shown only),
//   npc?: a step of Japan's government (fires only when the player is not 総理), req?: an event id that must have fired,
//   crisis?: STAGED id, stage?: index, silent?: no news line, fx?: (g, X, H) => void }
export const REAL_EVENTS = [
  { d: 19850922, id: 'plaza', cat: 'econ', where: 'us', at: [40.76, -73.97], text: '先進5か国（G5）がドル高の是正で合意した（プラザ合意）。急速な円高が進んだ' },
  { d: 19860426, id: 'chernobyl', cat: 'disaster', where: 'su', at: [51.39, 30.1], text: 'ソ連のチェルノブイリ原子力発電所で事故が起き、放射性物質が北半球の広い範囲に広がった' },
  { d: 19871019, id: 'black_monday', cat: 'econ', where: 'us', at: [40.71, -74.01], text: 'ニューヨーク株式市場で株価が大暴落した（ブラックマンデー）。翌日の東京市場も過去最大の下げ幅となった',
    fx: (g, X) => X.ecoShock(g, 'ブラックマンデー（世界的な株安）', { nikkei: -10, growth: -0.1, len: 60 }) },
  { d: 19871208, id: 'inf', inst: 'inf', cat: 'diplo', where: 'su', text: '米ソが中距離核戦力（INF）全廃条約に調印した' },
  { d: 19880820, id: 'iran_iraq_end', inst: 'iran_iraq_end', cat: 'war', where: 'ir', text: 'イラン・イラク戦争の停戦が成立した' },
  { d: 19890604, id: 'tiananmen', cat: 'politics', where: 'cn', at: [39.9, 116.39], text: '北京で、民主化を求める学生や市民の運動が軍によって武力で鎮圧された（天安門事件）',
    fx: (g, X) => { X.relAdd(g, 'cn', -8); X.pairAdd(g, 'us', 'cn', -10); X.tensionShift(g, 2); } },
  { d: 19891109, id: 'berlin', inst: 'berlin', cat: 'politics', where: 'wde', text: '東西ドイツを隔てていた「ベルリンの壁」が開放された' },
  { d: 19891203, id: 'malta', inst: 'malta', cat: 'diplo', text: '米ソの首脳がマルタで会談し、冷戦の終結を宣言した', at: [35.9, 14.5] },
  { d: 19900802, id: 'gulf_0', crisis: 'gulf', stage: 0, cat: 'war', where: 'iq', at: [29.37, 47.98], text: 'イラク軍がクウェートに侵攻した。国連安保理は即時の撤退を求める決議を採択した',
    fx: (g, X) => {
      X.oilShock(g, 35, '湾岸危機'); X.tensionShift(g, 8); X.relAdd(g, 'iq', -25);
      if (!X.isPM(g)) { const s = X.W(g); if (!s.sanctions.byJapan.iq) s.sanctions.byJapan.iq = { level: 2, un: true, since: 19900805, day: X.today(g) }; }
    },
    note: '（湾岸危機。「世界情勢」の「危機」から、声明・資金協力・在外邦人の退避・経済制裁を決められる）' },
  { d: 19901003, id: 'unification', inst: 'unification', cat: 'politics', where: 'de', text: '東西ドイツが統一された' },
  { d: 19901129, id: 'gulf_1', crisis: 'gulf', stage: 1, cat: 'war', where: 'iq', text: '国連安保理が、イラクが期限（1991年1月15日）までに撤退しなければ武力の行使を認める決議を採択した', fx: (g, X) => X.tensionShift(g, 3) },
  { d: 19910117, id: 'gulf_2', crisis: 'gulf', stage: 2, cat: 'war', where: 'iq', text: '米国を中心とする多国籍軍がイラクへの攻撃を始めた（湾岸戦争）',
    fx: (g, X, H) => { const c = X.newConflict(g, 'iq', 'us', { id: 'gulf_war', name: '湾岸戦争', aggressor: 'iq', intensity: 3, scripted: true, quiet: true }); H.link(g, 'gulf', c); X.tensionShift(g, 4); } },
  { d: 19910228, id: 'gulf_3', crisis: 'gulf', stage: 3, cat: 'war', where: 'iq', text: '多国籍軍が戦闘を停止し、クウェートが解放された（湾岸戦争の停戦）',
    fx: (g, X) => { X.endConflict(g, 'gulf_war', 'ceasefire', null); const s = X.W(g); s.oil = Math.max(80, s.oil - 25); X.tensionShift(g, -4); } },
  { d: 19910426, id: 'minesweep', npc: true, cat: 'japan', at: [27.0, 51.5], text: '海上自衛隊の掃海部隊が、ペルシャ湾の機雷を取り除くために出発した（自衛隊の初めての海外派遣）',
    fx: (g, X) => { X.standingAdd(g, 2); X.relAdd(g, 'us', 2); X.relAdd(g, 'sa', 2); } },
  { d: 19910701, id: 'warsaw_end', inst: 'warsaw_end', cat: 'diplo', where: 'su', text: 'ワルシャワ条約機構が解散した' },
  { d: 19910917, id: 'korea_un', inst: 'korea_un', cat: 'diplo', where: 'kr', text: '韓国と北朝鮮が国連に同時に加盟した' },
  { d: 19911226, id: 'ussr_end', inst: 'ussr_end', cat: 'politics', where: 'ru', text: 'ソ連が解体し、ロシア連邦が継承国となった' },
  { d: 19920920, id: 'cambodia_pko', npc: true, cat: 'japan', at: [11.56, 104.92], text: '1992年9月、陸上自衛隊の部隊が国連平和維持活動（PKO）のためカンボジアに派遣された（初めてのPKO参加部隊）',
    fx: (g, X) => { const s = X.W(g); s.deploy.push({ id: 'd' + s.seq++, kind: 'pko', where: 'カンボジア', mission: '国連カンボジア暫定機構（UNTAC）', personnel: 600, law: 'PKO協力法', startDay: X.today(g), endDate: 19930930 }); X.standingAdd(g, 2); } },
  { d: 19930913, id: 'oslo', cat: 'diplo', where: 'il', at: [31.78, 35.22], text: 'イスラエルとパレスチナ解放機構（PLO）が、パレスチナの暫定自治の原則に合意し、署名した（オスロ合意）', fx: (g, X) => X.tensionShift(g, -2) },
  { d: 19931101, id: 'eu', inst: 'eu', cat: 'diplo', text: '欧州連合（EU）が発足した', at: [50.85, 4.35] },
  { d: 19941021, id: 'agreed_fw', cat: 'diplo', where: 'kp', at: [46.2, 6.14], text: '米国と北朝鮮が、核開発の凍結と引き換えに軽水炉などを提供する「枠組み合意」に署名した', fx: (g, X) => { X.tensionShift(g, -2); X.threatAdd(g, -2); } },
  { d: 19950101, id: 'wto', inst: 'wto', cat: 'econ', text: '世界貿易機関（WTO）が発足した', at: [46.2, 6.14] },
  { d: 19950728, id: 'vn_asean', inst: 'vn_asean', cat: 'diplo', where: 'vn', text: 'ベトナムがASEANに加盟した' },
  { d: 19960910, id: 'ctbt', cat: 'diplo', at: [40.75, -73.97], text: '国連総会が、あらゆる核実験を禁じる包括的核実験禁止条約（CTBT）を採択した', fx: (g, X) => X.tensionShift(g, -1) },
  { d: 19970701, id: 'hongkong', inst: 'hongkong', cat: 'politics', where: 'cn', at: [22.3, 114.17], text: '香港がイギリスから中国に返還された' },
  { d: 19970702, id: 'asia_0', crisis: 'asia_fin', stage: 0, cat: 'econ', where: 'th', text: 'タイが通貨バーツの変動相場制への移行を発表し、バーツが急落した。アジアの国々に通貨の下落が広がった',
    fx: (g, X) => X.ecoShock(g, 'アジア通貨危機', { nikkei: -4, growth: -0.1, len: 120 }), note: '（アジア通貨危機。「世界情勢」の「危機」から、主要国との協調や支援を決められる）' },
  { d: 19971121, id: 'asia_1', crisis: 'asia_fin', stage: 1, cat: 'econ', where: 'kr', text: '1997年11月、通貨危機が韓国にも広がり、韓国が国際通貨基金（IMF）に支援を求めた', fx: (g, X) => X.ecoShock(g, 'アジア通貨危機の拡大', { nikkei: -4, len: 90 }) },
  { d: 19971211, id: 'kyoto', cat: 'diplo', at: [35.01, 135.77], text: '1997年12月、地球温暖化を防ぐ京都議定書が、京都での国際会議（COP3）で採択された' },
  { d: 19980511, id: 'india_nuke', cat: 'war', where: 'in', at: [27.08, 71.72], text: 'インドが地下核実験を行った。日本は無償の資金協力を止めるなどの措置を決めた',
    fx: (g, X) => { X.relAdd(g, 'in', -12); X.tensionShift(g, 3); } },
  { d: 19980515, id: 'g8', inst: 'g8', cat: 'diplo', where: 'ru', text: 'ロシアが主要国首脳会議に正式に加わり、G8になった' },
  { d: 19980528, id: 'pak_nuke', cat: 'war', at: [33.7, 73.05], text: 'パキスタンも核実験を行った。国連安保理は両国の核実験を非難する決議を採択した', fx: (g, X) => X.tensionShift(g, 2) },
  { d: 19990101, id: 'euro', inst: 'euro', cat: 'econ', text: 'EUの単一通貨ユーロが導入された', at: [50.11, 8.68] },
  { d: 19990324, id: 'kosovo', cat: 'war', at: [44.8, 20.47], text: 'NATOが、コソボ紛争をめぐってユーゴスラビアへの空爆を始めた（安保理の決議はなかった）', fx: (g, X) => { X.pairAdd(g, 'us', 'ru', -8); X.tensionShift(g, 3); } },
  { d: 19991220, id: 'macau', cat: 'politics', where: 'cn', at: [22.2, 113.55], text: 'マカオがポルトガルから中国に返還された' },
  { d: 20000613, id: 'korea_summit', cat: 'diplo', where: 'kr', at: [39.03, 125.75], text: '韓国と北朝鮮の首脳が、南北の分断後はじめて平壌で会談した',
    fx: (g, X) => { X.tensionShift(g, -3); X.threatAdd(g, -2); X.pairAdd(g, 'kr', 'kp', 15); } },
  { d: 20010911, id: 'terror_0', crisis: 'terror', stage: 0, cat: 'war', where: 'us', at: [40.71, -74.01], text: '米国で同時多発テロ。ハイジャックされた旅客機がニューヨークの世界貿易センタービルなどに突入し、約3,000人が犠牲になった',
    fx: (g, X) => { X.tensionShift(g, 8); X.threatAdd(g, 2); X.ecoShock(g, '米同時多発テロ', { nikkei: -6, growth: -0.1, len: 90 }); },
    note: '（米同時多発テロ。「世界情勢」の「危機」から、声明や支援を決められる）' },
  { d: 20011007, id: 'terror_1', crisis: 'terror', stage: 1, cat: 'war', at: [34.53, 69.17], text: '米国と英国がアフガニスタンへの攻撃を始めた', fx: (g, X) => X.tensionShift(g, 3) },
  { d: 20011202, id: 'indian_ocean', npc: true, cat: 'japan', at: [12.0, 60.0], text: '海上自衛隊がインド洋で、各国の艦船への補給を始めた（テロ対策特別措置法）',
    fx: (g, X) => { const s = X.W(g); if (!s.deploy.some((d) => d.where === 'インド洋' && !d.ended)) s.deploy.push({ id: 'd' + s.seq++, kind: 'rear', where: 'インド洋', mission: '補給支援（海上自衛隊）', personnel: 330, law: 'テロ対策特別措置法（2001年）', startDay: X.today(g), endDate: 20071101 }); X.relAdd(g, 'us', 3); } },
  { d: 20011211, id: 'china_wto', cat: 'econ', where: 'cn', text: '中国が世界貿易機関（WTO）に加盟した' },
  { d: 20020917, id: 'jp_kp_summit', npc: true, cat: 'japan', where: 'kp', at: [39.03, 125.75], text: '日本の首相が北朝鮮を訪れ、日朝平壌宣言に署名した。北朝鮮は日本人の拉致を認めた',
    fx: (g, X) => { const s = X.W(g); if (!s.treaties.jp_kp_2002) s.treaties.jp_kp_2002 = { status: 'force', since: X.today(g), by: 'npc' }; X.relAdd(g, 'kp', 8); } },
  { d: 20021015, id: 'abductees', npc: true, req: 'jp_kp_summit', cat: 'japan', where: 'kp', text: '北朝鮮に拉致された日本人のうち5人が帰国した' },
  { d: 20030320, id: 'iraq_0', crisis: 'iraq', stage: 0, cat: 'war', where: 'iq', at: [33.31, 44.36], text: '米国と英国の軍がイラクへの攻撃を始めた（イラク戦争）',
    fx: (g, X, H) => { const c = X.newConflict(g, 'us', 'iq', { id: 'iraq_war', name: 'イラク戦争', aggressor: 'us', intensity: 3, scripted: true, quiet: true }); H.link(g, 'iraq', c); X.oilShock(g, 15, 'イラク戦争'); X.tensionShift(g, 5); },
    note: '（イラク戦争。「世界情勢」の「危機」から、声明・支援・在外邦人の退避を決められる）' },
  { d: 20030409, id: 'iraq_1', crisis: 'iraq', stage: 1, cat: 'war', where: 'iq', text: 'イラクの首都バグダッドが陥落し、政権が事実上崩壊した' },
  { d: 20030501, id: 'iraq_2', crisis: 'iraq', stage: 2, cat: 'war', where: 'iq', text: '米国が、イラクでの大規模な戦闘の終結を宣言した。治安の悪化はその後も続いている',
    fx: (g, X) => { X.endConflict(g, 'iraq_war', 'ceasefire', null); const s = X.W(g); if (!s.crises.some((k) => k.id === 'iraq_sec')) s.crises.push({ id: 'iraq_sec', kind: 'unrest', title: 'イラクの治安の悪化', country: 'iq', sev: 2, untilDate: 20111218, day: X.today(g), handled: {} }); X.tensionShift(g, -2); } },
  { d: 20030827, id: 'six_party', cat: 'diplo', where: 'kp', at: [39.9, 116.39], text: '北朝鮮の核問題をめぐり、日米中韓ロと北朝鮮の6か国協議が北京で始まった' },
  { d: 20031226, id: 'asdf_iraq', npc: true, cat: 'japan', at: [29.37, 47.98], text: '航空自衛隊が、イラク復興支援の輸送のためクウェートに向かった（イラク人道復興支援特別措置法）',
    fx: (g, X) => { const s = X.W(g); s.deploy.push({ id: 'd' + s.seq++, kind: 'rear', where: 'クウェート・イラク', mission: 'イラク人道復興支援の空輸（航空自衛隊）', personnel: 200, law: 'イラク人道復興支援特別措置法（2003年）', startDay: X.today(g), endDate: 20081218 }); X.relAdd(g, 'us', 2); } },
  { d: 20040119, id: 'samawah', npc: true, cat: 'japan', at: [31.31, 45.28], text: '陸上自衛隊が、イラク南部のサマワで人道復興支援を始めた',
    fx: (g, X) => { const s = X.W(g); s.deploy.push({ id: 'd' + s.seq++, kind: 'rear', where: 'イラク南部サマワ', mission: 'イラク人道復興支援（陸上自衛隊）', personnel: 550, law: 'イラク人道復興支援特別措置法（2003年）', startDay: X.today(g), endDate: 20060717 }); X.relAdd(g, 'us', 3); } },
  { d: 20040501, id: 'eu25', inst: 'eu25', cat: 'diplo', text: 'EUに東欧などの10か国が加わり、25か国になった', at: [50.85, 4.35] },
  { d: 20041226, id: 'tsunami', cat: 'disaster', where: 'id', at: [3.3, 95.9], text: 'インドネシアのスマトラ島沖で巨大地震が起き、インド洋の沿岸に大津波が押し寄せた。犠牲者は20万人を超えた',
    fx: (g, X) => { const k = X.crisis(g, { kind: 'disaster', title: 'スマトラ島沖地震・インド洋大津波', country: 'id', sev: 3, at: [3.3, 95.9], until: X.today(g) + 40, real: true }); void k; },
    note: '（インド洋大津波。「世界情勢」の「危機」から、国際緊急援助隊や支援を決められる）' },
  { d: 20050216, id: 'kyoto_force', cat: 'diplo', at: [35.01, 135.77], text: '京都議定書が発効した' },
  { d: 20061009, id: 'kp_nuke', cat: 'war', where: 'kp', at: [41.28, 129.08], text: '北朝鮮が地下核実験を行ったと発表した',
    fx: (g, X) => { X.threatAdd(g, 6); X.relAdd(g, 'kp', -8); X.tensionShift(g, 3); X.crisis(g, { kind: 'missile', title: '北朝鮮の核実験', country: 'kp', sev: 2, until: X.today(g) + 20, real: true }); } },
  { d: 20061013, id: 'kp_sanction', npc: true, cat: 'japan', where: 'kp', text: '日本が北朝鮮からの輸入の全面禁止など、独自の制裁を決めた',
    fx: (g, X) => { const s = X.W(g); s.sanctions.byJapan.kp = { level: Math.max(2, (s.sanctions.byJapan.kp || {}).level || 0), since: 20061013, day: X.today(g) }; } },
  { d: 20070101, id: 'eu27', inst: 'eu27', cat: 'diplo', text: 'EUが27か国になった', at: [50.85, 4.35] },
  { d: 20080915, id: 'gfc_0', crisis: 'gfc', stage: 0, cat: 'econ', where: 'us', at: [40.71, -74.01], text: '米国の大手証券会社リーマン・ブラザーズが経営破綻し、世界の株価が急落した（リーマン・ショック）',
    fx: (g, X) => X.ecoShock(g, 'リーマン・ショック（世界金融危機）', { nikkei: -15, growth: -0.2, len: 180 }), note: '（世界金融危機。「世界情勢」の「危機」から、主要国との協調対策を決められる）' },
  { d: 20081115, id: 'g20', inst: 'g20', cat: 'econ', text: '主要20か国・地域（G20）の首脳会議が初めて開かれた', at: [38.9, -77.04] },
  { d: 20081116, id: 'gfc_2', crisis: 'gfc', stage: 2, silent: true, cat: 'econ', text: '' },
  { d: 20090616, id: 'kp_export_ban', npc: true, cat: 'japan', where: 'kp', text: '日本が北朝鮮への輸出も全面的に禁止した',
    fx: (g, X) => { const s = X.W(g); s.sanctions.byJapan.kp = { level: 3, since: 20090616, day: X.today(g) }; } },
  { d: 20091201, id: 'lisbon', inst: 'lisbon', cat: 'diplo', text: 'リスボン条約が発効し、EUに常任の欧州理事会議長が置かれた', at: [50.85, 4.35] },
  { d: 20100907, id: 'senkaku_boat', cat: 'japan', where: 'cn', at: [25.9, 123.6], text: '尖閣諸島の沖で、中国の漁船が海上保安庁の巡視船に衝突した。船長の逮捕と釈放をめぐって日中関係が冷えこんだ',
    fx: (g, X) => { X.relAdd(g, 'cn', -8); X.threatAdd(g, 2); } },
  { d: 20110114, id: 'arab_spring', cat: 'politics', at: [36.8, 10.18], text: 'チュニジアで大規模な抗議運動により長期政権が倒れた。民主化を求める動きが中東・北アフリカに広がった（アラブの春）',
    fx: (g, X) => { X.crisis(g, { kind: 'unrest', title: '中東・北アフリカの政情不安（アラブの春）', country: null, sev: 2, at: [30.0, 31.2], until: X.today(g) + 45, real: true }); X.tensionShift(g, 2); } },
  { d: 20140318, id: 'crimea', cat: 'war', where: 'ru', at: [44.95, 34.1], text: 'ロシアが、ウクライナ南部のクリミアの編入を宣言した。米国や欧州は「違法」として制裁を決めた',
    fx: (g, X) => { X.pairAdd(g, 'us', 'ru', -30); X.relAdd(g, 'ru', -10); X.relAdd(g, 'ua', 4); X.tensionShift(g, 6); X.crisis(g, { kind: 'clash', title: 'クリミアをめぐる対立', country: 'ua', sev: 2, at: [44.95, 34.1], until: X.today(g) + 40, real: true }); } },
  { d: 20140324, id: 'g8_suspend', cat: 'diplo', at: [52.08, 4.3], text: 'G7の首脳がハーグで会合し、ロシアのG8への参加を停止すると宣言した', fx: (g, X) => { X.W(g).g8 = false; } },
  { d: 20150714, id: 'iran_deal', cat: 'diplo', where: 'ir', at: [48.2, 16.37], text: 'イランと米英仏独中ロが、イランの核開発を制限する合意（核合意）に達した', fx: (g, X) => { X.relAdd(g, 'ir', 4); X.tensionShift(g, -2); } },
  { d: 20151212, id: 'paris', cat: 'diplo', at: [48.85, 2.35], text: '地球温暖化対策の新しい枠組み「パリ協定」が、パリでの国際会議（COP21）で採択された' },
  { d: 20160623, id: 'brexit_vote', cat: 'politics', where: 'gb', at: [51.5, -0.12], text: 'イギリスで、EUからの離脱の是非を問う国民投票が行われ、離脱が過半数を占めた', fx: (g, X) => X.ecoShock(g, '英国のEU離脱の国民投票', { nikkei: -5, len: 60 }) },
  { d: 20180612, id: 'us_kp_summit', cat: 'diplo', where: 'kp', at: [1.25, 103.83], text: '米国と北朝鮮の首脳が、シンガポールで史上初めて会談し、共同声明に署名した', fx: (g, X) => { X.tensionShift(g, -3); X.threatAdd(g, -3); } },
  { d: 20200131, id: 'brexit', inst: 'brexit', cat: 'politics', where: 'gb', text: 'イギリスがEUを離脱した' },
  { d: 20200311, id: 'covid_0', crisis: 'covid', stage: 0, cat: 'disaster', at: [46.2, 6.14], text: '世界保健機関（WHO）が、新型コロナウイルス感染症の世界的な流行を「パンデミック」と表明した',
    fx: (g, X) => X.tensionShift(g, 2), note: '（新型コロナの世界的な流行。「世界情勢」の「危機」から、国際的な支援を決められる）' },
  { d: 20210815, id: 'kabul', cat: 'war', at: [34.53, 69.17], text: 'アフガニスタンで、反政府勢力タリバンが首都カブールを制圧し、政権が崩壊した',
    fx: (g, X) => X.crisis(g, { kind: 'unrest', title: 'アフガニスタンの政権崩壊', country: null, sev: 2, at: [34.53, 69.17], until: X.today(g) + 30, real: true }), note: '（アフガニスタンの政権崩壊。「世界情勢」の「危機」から、在外邦人の退避を決められる）' },
  { d: 20220224, id: 'ukraine', cat: 'war', where: 'ru', at: [50.45, 30.52], text: 'ロシアがウクライナへの侵攻を始めた',
    fx: (g, X) => {
      const s = X.W(g);
      if (!s.conflicts.some((c) => c.id === 'ru_ua' && c.status === 'war')) X.newConflict(g, 'ru', 'ua', { id: 'ru_ua', name: 'ロシアのウクライナ侵攻', aggressor: 'ru', intensity: 3, quiet: true, crisis: true });
      X.tensionShift(g, 10, true); X.pairAdd(g, 'us', 'ru', -40); X.relAdd(g, 'ru', -30); X.relAdd(g, 'ua', 15); X.oilShock(g, 20, 'ロシアのウクライナ侵攻');
    } },
  { d: 20220226, id: 'ru_sanction', npc: true, cat: 'japan', where: 'ru', text: '日本がG7と協調して、ロシアへの制裁を決めた',
    fx: (g, X) => { const s = X.W(g); s.sanctions.byJapan.ru = { level: 3, g7: true, since: 20220226, day: X.today(g) }; X.relAdd(g, 'ru', -10); } },
  { d: 20230404, id: 'fi_nato', inst: 'fi_nato', cat: 'diplo', text: 'フィンランドがNATOに加盟した', at: [60.17, 24.94] },
  { d: 20231007, id: 'gaza', cat: 'war', where: 'il', at: [31.5, 34.45], text: 'パレスチナのガザ地区を支配するイスラム組織ハマスがイスラエルを奇襲し、ガザで大規模な戦闘が始まった',
    fx: (g, X) => { X.crisis(g, { kind: 'war', title: 'ガザ地区の戦闘と人道危機', country: null, sev: 3, at: [31.5, 34.45], until: X.today(g) + 90, real: true }); X.tensionShift(g, 4); X.oilShock(g, 8, '中東情勢の緊迫'); } },
  { d: 20240307, id: 'se_nato', inst: 'se_nato', cat: 'diplo', text: 'スウェーデンがNATOに加盟した', at: [59.33, 18.07] },
  { d: 20251026, id: 'tl_asean', inst: 'tl_asean', cat: 'diplo', text: '東ティモールがASEANの11か国目の加盟国になった', at: [-8.56, 125.57] },
  { d: 20260719, id: 'worldcup26', cat: 'sports', where: 'us', at: [40.81, -74.07], text: 'サッカーのワールドカップ（米国・カナダ・メキシコの共同開催）が閉幕し、スペインが優勝した' },
];
// staged real crises: the stage labels (the dated stages are the events above; later stages follow the time)
export const STAGED = {
  gulf: { kind: 'war', title: '湾岸危機（イラクのクウェート侵攻）', titles: { 2: '湾岸戦争', 3: '湾岸戦争（停戦）' }, country: 'iq', at: [29.37, 47.98], sev: 3, untilDate: 19910331, allies: ['us', 'sa'], labels: ['侵攻', '決議', '開戦', '停戦'] },
  asia_fin: { kind: 'finance', title: 'アジア通貨危機', country: 'th', sev: 2, untilDate: 19981001, labels: ['タイ', '韓国へ', '山場', '回復へ'] },
  terror: { kind: 'terror', title: '米同時多発テロとテロとの戦い', country: 'us', at: [40.71, -74.01], sev: 3, untilDate: 20020301, allies: ['us'], labels: ['テロ', '攻撃開始', '長期化', '沈静化'] },
  iraq: { kind: 'war', title: 'イラク戦争', country: 'iq', at: [33.31, 44.36], sev: 3, untilDate: 20030601, allies: ['us'], labels: ['開戦', '陥落', '終結宣言', '占領・復興'] },
  gfc: { kind: 'finance', title: '世界金融危機（リーマン・ショック）', country: 'us', at: [40.71, -74.01], sev: 3, untilDate: 20090601, labels: ['破綻', '連鎖', '協調', '回復へ'] },
  covid: { kind: 'humanitarian', title: '新型コロナウイルスの世界的な流行', country: null, at: [46.2, 6.14], sev: 3, untilDate: 20210401, labels: ['流行', '拡大', '山場', '収束へ'] },
};
// generic crises: the stage labels by kind
export const STAGE_LABELS = {
  war: ['開戦', '激化', '膠着', '停戦へ'], clash: ['衝突', '緊迫', '山場', '沈静化'], coup: ['政変', '混乱', '新体制', '安定へ'],
  finance: ['発生', '連鎖', '山場', '回復へ'], oil: ['急騰', '高止まり', '山場', '落ち着く'], missile: ['発射', '警戒', '分析', '沈静化'],
  incident: ['発生', '警戒', '対応', '沈静化'], trade: ['要求', '交渉', '期限', '決着へ'], disaster: ['発生', '救助', '支援', '復興へ'],
  humanitarian: ['発生', '拡大', '支援', '収束へ'], unrest: ['発生', '混乱', '長期化', '沈静化'], terror: ['発生', '対応', '長期化', '沈静化'],
};
export const KIND_NAME = { war: '戦争・紛争', clash: '衝突', coup: '政変', finance: '金融危機', oil: '原油高', missile: 'ミサイル・核', incident: '領海・領空', trade: '貿易摩擦', disaster: '災害', humanitarian: '人道危機', unrest: '政情不安', terror: 'テロ' };
export const CAT_NAME = { war: '戦争・安全保障', econ: '経済', diplo: '外交・条約', politics: '政治・体制', disaster: '災害・事故', japan: '日本の外交', sports: 'スポーツ', game: 'この世界の出来事' };
// the world's regions (for the 地域 tab and the map's region views)
export const REGIONS = {
  ea: { name: '東アジア', ids: ['cn', 'kr', 'kp', 'tw'], view: 'ea', label: [47, 108] },
  sea: { name: '東南アジア', ids: ['id', 'ph', 'vn', 'th', 'sg', 'my'], view: 'sea', label: [-2, 98] },
  sa: { name: '南アジア', ids: ['in'], view: 'me', label: [24, 74] },
  me: { name: '中東', ids: ['sa', 'ir', 'iq', 'il', 'tr'], view: 'me', label: [22, 44] },
  eu: { name: '欧州・ロシア', ids: ['gb', 'fr', 'wde', 'dde', 'de', 'it', 'su', 'ru', 'ua'], view: 'eu', label: [62, 40] },
  am: { name: '米州', ids: ['us', 'ca', 'br'], view: 'world', label: [48, -105] },
  oc: { name: 'オセアニア', ids: ['au'], view: 'sea', label: [-28, 128] },
};
// the world's tension before the era start (the game's own index, consistent with the era start states; 目安)
const TENSION_PAST = A([1980, 74], [1985, 72], [1987, 70], [1989, 55], [1990, 40], [1992, 28], [1996, 25], [2001, 34], [2003, 32], [2004, 30], [2008, 32], [2014, 45], [2018, 52], [2022, 64], [2026, 66]);
function interp(anchors, y) {
  if (!Array.isArray(anchors) || !anchors.length) return 0;
  if (y <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) { const [y1, v1] = anchors[i]; if (y <= y1) { const [y0, v0] = anchors[i - 1]; return v0 + ((v1 - v0) * (y - y0)) / Math.max(0.0001, y1 - y0); } }
  return anchors[anchors.length - 1][1];
}

export function createHistory(X) {
  const { W, num, clamp, today, dateNum, worldDate } = X;
  const ERA_START = { showa: 19870401, heisei_early: 19960401, heisei: 20040401, reiwa: 20260401 };
  // ---------------------------------------------------------------- state: W(g).hist (save-safe; old saves get it lazily)
  function H(g) {
    const s = W(g);
    let h = s.hist;
    if (!h || typeof h !== 'object' || Array.isArray(h)) {
      h = s.hist = { v: 1, start: ERA_START[s.era] || 20260401, last: 0, pts: [], fired: {}, ids: X.COUNTRY_ORDER.slice() };
      // an old save in the middle of a game: the events between the era start and today are history, not a morning flood
      const n = dateNum(g);
      if (today(g) > 3) for (const e of REAL_EVENTS) if (!e.inst && e.d > h.start && e.d <= n) h.fired[e.id] = -1;
    }
    if (!Array.isArray(h.pts)) h.pts = [];
    if (!h.fired || typeof h.fired !== 'object') h.fired = {};
    if (!Array.isArray(h.ids)) h.ids = X.COUNTRY_ORDER.slice();
    if (!h.start) h.start = ERA_START[s.era] || 20260401;
    return h;
  }
  // ---------------------------------------------------------------- real events and staged crises
  const EV = Object.fromEntries(REAL_EVENTS.map((e) => [e.id, e]));
  const api = {
    link(g, rid, conflict) { const k = W(g).crises.find((x) => x.rid === rid); if (k && conflict) k.conflict = conflict.id; },
  };
  function stageCrisis(g, e) {
    const S = STAGED[e.crisis];
    if (!S) return;
    const s = W(g);
    let k = s.crises.find((x) => x.rid === e.crisis);
    if (!k) {
      if (e.stage > 0 && e.silent) return;
      k = X.crisis(g, { kind: S.kind, title: S.title, country: S.country, sev: S.sev, at: S.at || null, untilDate: S.untilDate, rid: e.crisis, stage: 0, real: true, until: today(g) + 400 });
    }
    k.stage = Math.max(num(k.stage), num(e.stage));
    if (S.titles && S.titles[k.stage]) k.title = S.titles[k.stage];
    k.stageDay = today(g);
  }
  function fire(g, e) {
    const h = H(g);
    if (e.npc && X.isPM(g)) { h.fired[e.id] = -2; return; } // the player's own government decides
    if (e.req && !(num(h.fired[e.req], -9) >= 0 || num(h.fired[e.req], -9) === -1)) { h.fired[e.id] = -2; return; }
    h.fired[e.id] = today(g);
    if (e.crisis) stageCrisis(g, e);
    try { if (typeof e.fx === 'function') e.fx(g, X, api); } catch (err) { console.error(err); }
    if (!e.silent && e.text) X.news(g, e.text, { feed: false, kind: 'real' });
    if (e.note && (X.isPM(g) || X.isFM(g))) X.note(g, e.note);
  }
  function eventsTick(g) {
    const h = H(g);
    const n = dateNum(g);
    for (const e of REAL_EVENTS) {
      if (e.inst || h.fired[e.id] != null || e.d <= h.start || n < e.d) continue;
      fire(g, e);
    }
  }
  // the stage of a crisis: { idx, labels[4], label, text, pct (0..1 of its course), real }
  function stageOf(g, k) {
    if (!k) return null;
    const S = k.rid && STAGED[k.rid];
    const labels = S ? S.labels : STAGE_LABELS[k.kind] || ['発生', '拡大', '山場', '収束へ'];
    let p;
    if (k.untilDate) {
      const a = num(k.startNum) || null;
      const n = dateNum(g);
      p = a ? clamp((n - a) / Math.max(1, k.untilDate - a), 0, 1) : 0.4;
    } else {
      const d0 = num(k.day, today(g));
      p = clamp((today(g) - d0) / Math.max(1, num(k.until, d0 + 20) - d0), 0, 1);
    }
    const tIdx = p < 0.2 ? 0 : p < 0.55 ? 1 : p < 0.85 ? 2 : 3;
    let idx;
    if (S) {
      const st = num(k.stage);
      const next = REAL_EVENTS.filter((e) => e.crisis === k.rid && num(e.stage) > st).reduce((a, e) => Math.min(a, num(e.stage)), 4);
      idx = Math.max(st, Math.min(tIdx, next - 1, 3));
    } else idx = k.untilDate && !k.startNum ? 1 : tIdx;
    let text = '';
    if (S) { const ev = REAL_EVENTS.filter((e) => e.crisis === k.rid && !e.silent && num(e.stage) <= idx).pop(); text = ev ? ev.text : ''; }
    return { idx, labels, label: labels[idx] || '', text, pct: Math.round(p * 100) / 100, real: !!S || !!k.real };
  }
  // ---------------------------------------------------------------- the monthly record (series)
  function record(g, key) {
    const s = W(g);
    const h = H(g);
    const r = h.ids.map((id) => (X.COUNTRIES[id] && X.exists(g, id) ? Math.round(X.relation(g, id)) : null));
    let ex = null, im = null, bal = null;
    try { if (typeof g.tradeSummary === 'function') { const m = g.tradeSummary().macro; ex = m.exports; im = m.imports; bal = m.balance; } } catch (e) { /* no trade module */ }
    h.pts.push({ k: key, t: Math.round(s.tension), s: Math.round(s.standing), o: Math.round(s.oil), th: Math.round(s.threat), r, ex, im, bal });
    h.last = key;
    // keep it small: at most 240 points (the older half thinned to every other month)
    if (h.pts.length > 240) { const half = h.pts.slice(0, 120).filter((_, i) => i % 2 === 0); h.pts = half.concat(h.pts.slice(120)); }
  }
  function seriesTick(g) {
    const d = worldDate(g);
    const key = d.year * 100 + d.month;
    const h = H(g);
    if (h.last !== key) record(g, key);
  }
  function tick(g) { eventsTick(g); seriesTick(g); for (const k of W(g).crises) if (k.untilDate && !k.startNum) k.startNum = k.day === -1 ? 0 : dateNum(g); }
  // series(g, key) → { key, label, unit, lo, hi, pts[{ x (fractional year), v, past }], now, d1y (change over a year), note }
  const SERIES = {
    tension: { label: '世界の緊張', unit: '', lo: 0, hi: 100, pick: (p) => p.t, past: (y) => interp(TENSION_PAST, y), note: '大国の対立・紛争・危機で上がり、協調や軍縮で下がる（0〜100の目安）' },
    standing: { label: '日本の国際的な信頼', unit: '', lo: 0, hi: 100, pick: (p) => p.s, note: '援助・協調・国連での働きで上がり、制裁破り・強硬な行動で下がる' },
    threat: { label: '日本への脅威', unit: '', lo: 0, hi: 100, pick: (p) => p.th, note: 'ミサイル・領海・軍備の増強などで上がる' },
    oil: { label: '原油価格（指数）', unit: '', lo: 50, hi: 220, pick: (p) => p.o, note: '100がふつう。中東の紛争や産油国の減産で上がる' },
    exports: { label: '日本の輸出（兆円/年）', unit: '兆', lo: null, hi: null, pick: (p) => p.ex, note: '関税・貿易摩擦・経済連携で動く（目安）' },
    imports: { label: '日本の輸入（兆円/年）', unit: '兆', lo: null, hi: null, pick: (p) => p.im, note: '原油価格や円の動きで変わる（目安）' },
    balance: { label: '日本の貿易収支（兆円/年）', unit: '兆', lo: null, hi: null, pick: (p) => p.bal, note: '輸出−輸入。プラスなら黒字（目安）' },
  };
  const ym2x = (k) => Math.floor(k / 100) + (((k % 100) - 1) + 0.5) / 12;
  function series(g, key) {
    const h = H(g);
    const startY = Math.floor(h.start / 10000) + (Math.floor(h.start / 100) % 100 - 1) / 12;
    let def = SERIES[key];
    let pick = null, past = null, label = '', unit = '', lo = 0, hi = 100, note = '';
    if (def) ({ pick, past, label, unit, lo, hi, note } = def);
    else if (/^rel:/.test(key)) {
      const id = key.slice(4); const i = h.ids.indexOf(id); const C = X.COUNTRIES[id];
      if (i < 0 || !C) return null;
      pick = (p) => (Array.isArray(p.r) ? p.r[i] : null);
      past = (y) => { const n = Math.floor(y) * 10000 + 701; if ((C.from && n < C.from) || (C.to && n >= C.to)) return null; return C.rel && C.rel.length && y >= C.rel[0][0] ? interp(C.rel, y) : null; };
      label = `${X.countryName(g, id, true)}と日本の関係`; lo = -100; hi = 100; note = '−100（険悪）〜100（良好）。会談・条約・援助で上がり、制裁・抗議・衝突で下がる';
    } else if (/^trade:/.test(key)) {
      const id = key.slice(6); const C = X.COUNTRIES[id];
      if (!C) return null;
      const pts = [];
      const y1 = worldDate(g).year;
      for (let y = Math.max(1987, Math.floor(startY) - 12); y <= y1; y++) { const n = y * 10000 + 701; if ((C.from && n < C.from && y < Math.floor(C.from / 10000)) || (C.to && n >= C.to)) continue; pts.push({ x: y + 0.5, v: Math.round(interp(C.trade, y + 0.5) * 10) / 10, past: y + 0.5 < startY }); }
      return finish({ key, label: `日本の貿易に占める${X.countryName(g, id, true)}の割合（%）`, unit: '%', lo: 0, hi: null, pts, note: '輸出入の合計に占める割合（目安）' });
    } else return null;
    const pts = [];
    if (past) {
      const y0 = Math.max(1987, Math.floor(startY) - 12);
      for (let y = y0; y + 0.5 < startY - 0.04; y += 1) { const v = past(y + 0.5); if (v != null && Number.isFinite(v)) pts.push({ x: y + 0.5, v: Math.round(v), past: true }); }
    }
    for (const p of h.pts) { const v = pick(p); if (v != null && Number.isFinite(Number(v))) pts.push({ x: ym2x(p.k), v: Number(v), past: false }); }
    return finish({ key, label, unit, lo, hi, pts, note });
  }
  function finish(o) {
    const pts = o.pts;
    const now = pts.length ? pts[pts.length - 1].v : null;
    const last = pts.length ? pts[pts.length - 1].x : 0;
    const yr = pts.filter((p) => p.x <= last - 0.95).pop();
    const vals = pts.map((p) => p.v);
    return { ...o, now, d1y: yr && now != null ? Math.round((now - yr.v) * 10) / 10 : null, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null };
  }
  // the change of a relation over the last ~3 months (for the ▲▼ marks)
  function relTrend(g, id) {
    const h = H(g); const i = h.ids.indexOf(id);
    if (i < 0 || h.pts.length < 2) return 0;
    const a = h.pts[Math.max(0, h.pts.length - 4)].r, b = h.pts[h.pts.length - 1].r;
    const va = Array.isArray(a) ? a[i] : null, vb = Array.isArray(b) ? b[i] : null;
    return va == null || vb == null ? 0 : vb - va;
  }
  // ---------------------------------------------------------------- the timeline
  // timeline(g, { filter: 'all'|'real'|'japan'|'crisis'|'game', n }) → [{ n (yyyymmdd), date, year, cat, catName, text, src ('real'|'game'|'diplo'), where, at, past }]
  function timeline(g, opts = {}) {
    const h = H(g);
    const s = W(g);
    const n0 = dateNum(g);
    const out = [];
    for (const e of REAL_EVENTS) {
      if (e.silent || !e.text || e.d > n0) continue;
      if (e.inst) { if (s.history[e.inst] == null) continue; }
      else if (e.d > h.start) { const f = h.fired[e.id]; if (f == null || f === -2) continue; }
      const y = Math.floor(e.d / 10000), m = Math.floor(e.d / 100) % 100;
      out.push({ n: e.d, date: `${y}年${m}月`, year: y, cat: e.cat, catName: CAT_NAME[e.cat] || '', text: e.text, src: 'real', where: e.where || null, at: e.at || null, past: e.d <= h.start });
    }
    // the game's own world events (not the real ones, which are above)
    for (const x of s.news) {
      if (x.kind === 'real' || num(x.day) <= 1) continue;
      const d = worldDate(g, x.day);
      out.push({ n: d.year * 10000 + d.month * 100 + d.dom, date: `${d.year}年${d.month}月`, year: d.year, cat: /速報|ミサイル|衝突|戦争|攻撃|クーデター|紛争/.test(x.text) ? 'war' : /経済|原油|株|金融|関税|貿易/.test(x.text) ? 'econ' : /地震|洪水|台風|災害/.test(x.text) ? 'disaster' : 'game', catName: CAT_NAME.game, text: String(x.text).replace(/^【[^】]*】/, ''), src: 'game', where: null, at: null, past: false });
    }
    try {
      const seen = new Set(out.filter((x) => x.src === 'game').map((x) => `${x.n}|${x.text.slice(0, 6)}`));
      if (typeof g.diplomacyTimeline === 'function') for (const e of g.diplomacyTimeline(40) || []) { const d = worldDate(g, e.day); if (seen.has(`${d.year * 10000 + d.month * 100 + d.dom}|${String(e.text).slice(0, 6)}`)) continue; out.push({ n: d.year * 10000 + d.month * 100 + d.dom, date: `${d.year}年${d.month}月`, year: d.year, cat: 'japan', catName: 'あなたの外交', text: e.text, src: 'diplo', where: e.country || null, at: null, past: false }); }
    } catch (e) { /* no diplomacy depth */ }
    out.sort((a, b) => b.n - a.n);
    const f = opts.filter || 'all';
    const keep = f === 'all' ? out : out.filter((x) => (f === 'real' ? x.src === 'real' : f === 'japan' ? x.cat === 'japan' || x.src === 'diplo' : f === 'crisis' ? x.cat === 'war' || x.cat === 'disaster' : f === 'game' ? x.src !== 'real' : true));
    return keep.slice(0, opts.n || 160);
  }
  // ---------------------------------------------------------------- regions
  function regions(g) {
    const s = W(g);
    const out = [];
    const t = clamp(num(s.tension), 0, 100);
    for (const [id, Rg] of Object.entries(REGIONS)) {
      const ids = Rg.ids.filter((c) => X.exists(g, c));
      if (!ids.length) continue;
      const rels = ids.map((c) => X.relation(g, c));
      const avg = Math.round(rels.reduce((a, v) => a + v, 0) / rels.length);
      const crises = s.crises.filter((k) => ids.includes(k.country) || (k.pair && k.pair.some((x) => ids.includes(x))));
      const conflicts = s.conflicts.filter((c) => c.status === 'war' && (ids.includes(c.a) || ids.includes(c.b)));
      const trade = Math.round(ids.reduce((a, c) => a + num(X.tradeOf(g, c)), 0) * 10) / 10;
      const allies = ids.filter((c) => X.japanAllies(g).some((a) => a.id === c)).length;
      const sanc = ids.filter((c) => num((s.sanctions.byJapan[c] || {}).level) > 0).length;
      const disputes = Object.values(X.DISPUTES).filter((D) => D.other.some((o) => ids.includes(o) && X.exists(g, o))).map((D) => D.name);
      const temp = Math.round(clamp(12 + conflicts.length * 30 + crises.reduce((a, k) => a + num(k.sev, 1) * 7, 0) + t * 0.18 + (avg < 0 ? -avg * 0.25 : 0) + disputes.length * 4, 0, 100));
      const status = conflicts.length && temp >= 55 ? '紛争' : temp >= 50 ? '緊張' : temp >= 32 ? '不安定' : '安定';
      out.push({ id, name: Rg.name, ids, avgRel: avg, minRel: Math.round(Math.min(...rels)), maxRel: Math.round(Math.max(...rels)), trade, allies, sanctions: sanc, crises: crises.map((k) => k.title), conflicts: conflicts.map((c) => c.name), disputes, temp, status, view: Rg.view, label: Rg.label });
    }
    return out;
  }
  // ---------------------------------------------------------------- crisis actions (shown in 危機 with their effects)
  const byId = (g, kid) => W(g).crises.find((k) => k.id === kid) || null;
  const HOSTILE = ['war', 'clash', 'missile', 'coup', 'incident', 'unrest', 'terror'];
  const VICTIM = ['disaster', 'humanitarian'];
  const ECON = ['finance', 'oil'];
  function actorOf(g, k) {
    if (k.conflict) { const c = W(g).conflicts.find((x) => x.id === k.conflict); if (c) return c.aggressor || c.a; }
    if (k.kind === 'terror') return null;
    return k.country || null;
  }
  function helpedOf(g, k) {
    const S = k.rid && STAGED[k.rid];
    if (S && S.allies) return S.allies.filter((x) => X.exists(g, x));
    if (VICTIM.includes(k.kind)) return k.country ? [k.country] : [];
    if (k.conflict) { const c = W(g).conflicts.find((x) => x.id === k.conflict); if (c) { const ag = c.aggressor; return [ag === c.a ? c.b : ag === c.b ? c.a : null].filter((x) => x && X.COUNTRIES[x]); } }
    return k.country && k.kind !== 'coup' ? [k.country] : [];
  }
  const actions = {
    crisis_statement: {
      name: '声明を出す（懸念・非難・連帯）', short: '声明', who: ['pm', 'foreign'], target: 'crisis', desc: '日本政府としての立場を、談話や声明で内外に示す。',
      options(g, kid) {
        const k = byId(g, kid); if (!k) return null;
        if (VICTIM.includes(k.kind)) return [{ id: 'solidarity', label: 'お見舞いと連帯を表明する', sub: '被害を受けた国との関係＋3' }];
        if (ECON.includes(k.kind)) return [{ id: 'calm', label: '市場の安定を呼びかける', sub: '株価の下げを少しやわらげる' }];
        return [{ id: 'concern', label: '深い懸念を表明する', sub: '国際的な信頼＋1。波風は立てない' }, { id: 'condemn', label: '強く非難する', sub: '国際的な信頼＋2・相手との関係−6・同盟国との関係＋2' }];
      },
      check(g, kid) { const k = byId(g, kid); if (!k) return '危機を選ぶ'; if (k.kind === 'trade') return '貿易摩擦は「貿易・関税」で対応する'; if (k.handled && k.handled.stmt) return 'すでに声明を出した'; return null; },
      odds: () => null,
      lines(g, kid, o = {}) {
        const k = byId(g, kid); if (!k) return [];
        const a = actorOf(g, k);
        if (VICTIM.includes(k.kind)) return ['被害を受けた国との関係＋3・国際的な信頼＋1'];
        if (ECON.includes(k.kind)) return ['日経平均＋1%ほど・国際的な信頼＋1'];
        if (o.kind === 'condemn') return [`国際的な信頼＋2${a ? `・${X.countryName(g, a, true)}との関係−6` : ''}・同盟国との関係＋2`, '相手から反発を受けることがある'];
        return ['国際的な信頼＋1（強く非難するなら、信頼は上がるが相手との関係が冷える）'];
      },
      run(g, kid, o = {}) {
        const k = byId(g, kid);
        k.handled = k.handled || {};
        k.handled.stmt = today(g);
        const a = actorOf(g, k);
        let text;
        if (VICTIM.includes(k.kind)) { for (const x of helpedOf(g, k)) X.relAdd(g, x, 3); X.standingAdd(g, 1); text = 'お見舞いと連帯を表明した。'; }
        else if (ECON.includes(k.kind)) { X.ecoShock(g, '市場の安定を呼びかける声明', { nikkei: 1, len: 20 }); X.standingAdd(g, 1); text = '市場の安定を呼びかけた。'; }
        else if (o.kind === 'condemn') { if (a && X.COUNTRIES[a]) X.relAdd(g, a, -6); for (const al of X.japanAllies(g)) if (al.id !== a && X.COUNTRIES[al.id]) X.relAdd(g, al.id, 2); X.standingAdd(g, 2); text = `${k.title}について、${a && X.COUNTRIES[a] ? `${X.countryName(g, a, true)}を` : ''}強く非難する声明を出した。`; }
        else { X.standingAdd(g, 1); text = `${k.title}について、深い懸念を表明した。`; }
        X.news(g, `日本政府が${k.title}について声明を出した`, { feed: false });
        return { ok: true, success: true, text };
      },
    },
    crisis_fund: {
      name: '資金・物資で支援する', short: '資金協力', who: ['pm', 'foreign'], target: 'crisis', desc: '国際機関や被害を受けた国・地域、対応にあたる国々に、資金や物資を拠出する。',
      options: () => [{ id: 1, label: '小規模（約100億円）', sub: '信頼＋1・関係＋2' }, { id: 2, label: '中規模（約1,000億円）', sub: '信頼＋2・関係＋4・景気に小さな負担' }, { id: 3, label: '大規模（1兆円規模）', sub: '信頼＋4・関係＋7・財政の負担が大きい' }],
      check(g, kid) { const k = byId(g, kid); if (!k) return '危機を選ぶ'; if (!['war', 'disaster', 'humanitarian', 'unrest', 'coup', 'terror', 'clash'].includes(k.kind)) return 'この危機には資金協力の枠組みがない（金融危機は「主要国と協調」）'; if (k.handled && k.handled.fund) return 'すでに拠出した'; return null; },
      odds: () => null,
      lines(g, kid, o = {}) {
        const k = byId(g, kid); if (!k) return [];
        const lv = clamp(num(o.level, 2), 1, 3);
        const who = helpedOf(g, k).map((x) => X.countryName(g, x, true)).join('・');
        return [`国際的な信頼＋${[1, 2, 4][lv - 1]}${who ? `・${who}との関係＋${[2, 4, 7][lv - 1]}` : ''}`, `財政の負担：景気−${[0.02, 0.05, 0.15][lv - 1]}ポイントほど`, lv === 3 ? '大きな拠出でも「お金だけ」との声が出ることがある（支持率−1〜＋1）' : '国内の反応はおおむね穏やか'];
      },
      run(g, kid, o = {}) {
        const k = byId(g, kid);
        const lv = clamp(num(o.level, 2), 1, 3);
        k.handled = k.handled || {};
        k.handled.fund = today(g);
        X.standingAdd(g, [1, 2, 4][lv - 1]);
        for (const x of helpedOf(g, k)) X.relAdd(g, x, [2, 4, 7][lv - 1]);
        X.ecoShock(g, '国際支援の拠出', { growth: -[0.02, 0.05, 0.15][lv - 1], len: 120 });
        if (lv === 3) X.bumpApproval(g, X.roll(0.5) ? 1 : -1, '大規模な資金協力');
        const amt = ['約100億円', '約1,000億円', '1兆円規模'][lv - 1];
        X.news(g, `日本政府が${k.title}への支援として${amt}の拠出を決めた`, { feed: false });
        return { ok: true, success: true, text: `${k.title}への支援として、${amt}を拠出した。` };
      },
    },
  };
  const methods = {
    worldSeries(key) { return series(this, key); },
    worldTimeline(opts = {}) { return timeline(this, opts); },
    worldRegions() { return regions(this); },
    worldCrisisStage(id) { return stageOf(this, W(this).crises.find((k) => k.id === id)); },
    worldRelTrend(id) { return relTrend(this, id); },
    worldRealEvents() { const h = H(this); return REAL_EVENTS.filter((e) => !e.silent).map((e) => ({ d: e.d, id: e.id, text: e.text, cat: e.cat, fired: h.fired[e.id] ?? null, inst: e.inst || null })); },
  };
  return { tick, methods, actions, stageOf, series, timeline, regions, relTrend, H, EV };
}
