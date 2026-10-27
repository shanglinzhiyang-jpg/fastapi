// 歴史の列強 (設定で世界情勢に加える): ソ連（スターリン政権）・ファシスト・イタリア（ムッソリーニ政権）・ナチス・ドイツ（ヒトラー政権）・
// 中華人民共和国（毛沢東政権）・民主カンプチア（ポル・ポト政権）・イラク（サダム・フセイン政権）・北朝鮮（金日成政権・金正日政権）・ウガンダ（イディ・アミン政権）・ジンバブエ（ムガベ政権）。ONの間は、入れかわる現代の国（REPLACES）が世界情勢から消える。Plain data (no imports): world.js spreads HIST_COUNTRIES into COUNTRIES; world_hist.js has the setting API,
// the images and the drawing helpers. The leaders and flags are the historical ones, shown by their real names and the photos / flags as they are.
// Facts: 日独防共協定 1936年11月（イタリアは1937年11月に加わる）。三国同盟 1940年9月。日ソ中立条約 1941年4月。ソ連の対日参戦 1945年8月。
//   民主カンプチア 1976年1月に国名（1975年4月にプノンペンを制圧）、1979年1月にベトナム軍の侵攻で首都を失う。
//   中ソ友好同盟相互援助条約 1950年2月。中国の初の核実験 1964年10月。日中共同声明 1972年9月。スターリンの死去 1953年3月、毛沢東の死去 1976年9月。
const A = (...pairs) => pairs;
const flat = (v) => A([1987, v], [2026, v]);
export const HIST_IDS = ['h_su', 'h_it', 'h_de', 'h_cn', 'h_kh', 'h_iq', 'h_kp', 'h_kp2', 'h_ug', 'h_zw'];
// the modern countries that a regime takes the place of while it is on (they leave the 世界情勢: lists, map, diplomacy, news about them)
export const REPLACES = { h_su: ['su', 'ru'], h_it: ['it'], h_de: ['wde', 'dde', 'de'], h_cn: ['cn'], h_kh: [], h_iq: ['iq'], h_kp: ['kp'], h_kp2: ['kp'], h_ug: [], h_zw: [] };
export const ALIAS = { su: 'h_su', ru: 'h_su', it: 'h_it', wde: 'h_de', dde: 'h_de', de: 'h_de', cn: 'h_cn', iq: 'h_iq', kp: ['h_kp', 'h_kp2'] }; // hidden id → the regime that stands for it
// words that mark a line of news as being about a hidden country (and words that let a line about the regime itself pass)
export const HIDE_WORDS = { su: ['ソ連', 'ソビエト'], ru: ['ロシア', '米ロ', '露'], it: ['イタリア'], wde: ['ドイツ'], dde: ['ドイツ'], de: ['ドイツ'], cn: ['中国', '中華人民共和国', '米中', '日中', '中ロ', '中露'], iq: ['イラク'], kp: ['北朝鮮', '朝鮮民主主義人民共和国'] };
export const PASS_WORDS = { h_su: ['スターリン'], h_it: ['ムッソリーニ', 'ファシスト'], h_de: ['ヒトラー', 'ナチス'], h_cn: ['毛沢東'], h_kh: ['ポル・ポト', 'カンプチア'], h_iq: ['サダム', 'フセイン政権'], h_kp: ['金日成'], h_kp2: ['金正日'], h_ug: ['アミン'], h_zw: ['ムガベ'] };
export const HIST = {
  h_su: { id: 'h_su', country: 'ソ連', flag: 'flag_su', portrait: 'pt_su', style: { 発信力: 45, 政策力: 75, 調整力: 60, 党内基盤: 95, 決断力: 85 }, leaderName: 'ヨシフ・スターリン', title: 'ソ連共産党中央委員会書記長', years: '1922〜1953年', real: 'su', label: 'ソ連（スターリン政権時）', swap: 'ソ連・ロシアと入れかわる' },
  h_it: { id: 'h_it', country: 'イタリア', flag: 'flag_it', portrait: 'pt_it', style: { 発信力: 88, 政策力: 50, 調整力: 45, 党内基盤: 70, 決断力: 65 }, leaderName: 'ベニト・ムッソリーニ', title: 'イタリア王国首相・国家ファシスト党党首（統領＝ドゥーチェ）', years: '1922〜1943年', real: 'it', label: 'イタリア（ムッソリーニ政権時）', swap: 'イタリアと入れかわる' },
  h_de: { id: 'h_de', country: 'ドイツ', flag: 'flag_de', portrait: 'pt_de', style: { 発信力: 90, 政策力: 55, 調整力: 35, 党内基盤: 88, 決断力: 85 }, leaderName: 'アドルフ・ヒトラー', title: '総統・国家社会主義ドイツ労働者党党首', years: '1933〜1945年', real: 'de', label: 'ナチス・ドイツ（ヒトラー政権時）', swap: 'ドイツと入れかわる' },
  h_cn: { id: 'h_cn', country: '中国', flag: 'flag_cn', portrait: 'pt_cn', style: { 発信力: 80, 政策力: 70, 調整力: 40, 党内基盤: 88, 決断力: 85 }, leaderName: '毛沢東', title: '中国共産党中央委員会主席', years: '1949〜1976年', real: 'cn', label: '中華人民共和国（毛沢東政権時）', swap: '現代の中国と入れかわる' },
  h_kh: { id: 'h_kh', tag: 'ポル・ポト', country: 'カンボジア', flag: 'flag_kh', portrait: 'pt_kh', style: { 発信力: 40, 政策力: 55, 調整力: 35, 党内基盤: 80, 決断力: 75 }, leaderName: 'ポル・ポト', title: 'カンプチア共産党書記・民主カンプチア首相', years: '1975〜1979年', real: 'kh', label: 'カンボジア（ポル・ポト政権時）', swap: 'カンボジアが加わる' },
  h_iq: { id: 'h_iq', tag: 'サダム', country: 'イラク', flag: 'flag_iq', portrait: 'pt_iq', style: { 発信力: 70, 政策力: 50, 調整力: 30, 党内基盤: 90, 決断力: 90 }, leaderName: 'サダム・フセイン', title: 'イラク大統領・革命指導評議会議長・バアス党地域指導部書記長', years: '1979〜2003年', real: 'iq', label: 'イラク（サダム・フセイン政権時）', swap: '現代のイラクと入れかわる' },
  h_kp: { id: 'h_kp', country: '北朝鮮', flag: 'flag_kp', portrait: 'pt_kp', style: { 発信力: 75, 政策力: 55, 調整力: 45, 党内基盤: 97, 決断力: 85 }, leaderName: '金日成', title: '朝鮮民主主義人民共和国 首相・朝鮮労働党総書記・国家主席', years: '1948〜1994年', real: 'kp', label: '北朝鮮（金日成政権時）', swap: '現代の北朝鮮と入れかわる' },
  h_kp2: { id: 'h_kp2', tag: '金正日', country: '北朝鮮', flag: 'flag_kp', portrait: 'pt_kp2', style: { 発信力: 40, 政策力: 50, 調整力: 40, 党内基盤: 90, 決断力: 80 }, leaderName: '金正日', title: '朝鮮民主主義人民共和国 国防委員会委員長・朝鮮労働党総書記', years: '1994〜2011年', real: 'kp', label: '北朝鮮（金正日政権時）', swap: '現代の北朝鮮と入れかわる（金日成政権とは同時に入れられない）' },
  h_ug: { id: 'h_ug', tag: 'アミン', country: 'ウガンダ', flag: 'flag_ug', portrait: 'pt_ug', style: { 発信力: 65, 政策力: 15, 調整力: 15, 党内基盤: 55, 決断力: 70 }, leaderName: 'イディ・アミン', title: 'ウガンダ大統領（陸軍司令官・のち元帥・終身大統領を名のる）', years: '1971〜1979年', real: 'ug', label: 'ウガンダ（イディ・アミン政権時）', swap: 'ウガンダが加わる' },
  h_zw: { id: 'h_zw', tag: 'ムガベ', country: 'ジンバブエ', flag: 'flag_zw', portrait: 'pt_zw', style: { 発信力: 85, 政策力: 55, 調整力: 50, 党内基盤: 88, 決断力: 75 }, leaderName: 'ロバート・ムガベ', title: 'ジンバブエ首相（のち大統領）・ZANU-PF議長', years: '1980〜2017年', real: 'zw', label: 'ジンバブエ（ムガベ政権時）', swap: 'ジンバブエが加わる' },
};
const H = (id, def) => ({ id, real: true, hist: true, region: 'europe', from: 0, to: 0, p5: false, ...HIST[id] && { flag: HIST[id].flag, portrait: HIST[id].portrait }, ...def });
export const HIST_COUNTRIES = {
  h_su: H('h_su', { name: 'ソビエト連邦（スターリン政権）', short: 'ソ連（スターリン期）', leader: 'ヨシフ・スターリン書記長', gov: 'ソ連共産党の一党体制（社会主義の計画経済）', capital: [58.2, 38.0],
    gdp: flat(1.1), mil: flat(85), trade: flat(1.5), rel: flat(-20), member: [],
    note: [[0, '1922年に書記長となり、1920年代の終わりから1953年まで、スターリンが党と国家を率いた。五か年計画で工業化を急ぎ、第二次世界大戦ではドイツと戦って連合国の勝者の側に立った。日本とは1941年4月に日ソ中立条約を結んだが、1945年8月に対日参戦した。']] }),
  h_it: H('h_it', { name: 'イタリア王国（ムッソリーニ政権）', short: 'ファシスト・イタリア', leader: 'ベニト・ムッソリーニ首相（統領）', gov: '国家ファシスト党の一党体制（王国）', capital: [43.9, 10.6],
    gdp: flat(0.4), mil: flat(38), trade: flat(0.6), rel: flat(25), member: [],
    note: [[0, '1922年から1943年まで、ムッソリーニが首相として国を率いた。ファシスト党の一党体制で、1935年にエチオピアへ侵攻した。1936年にドイツと「ローマ・ベルリン枢軸」を結び、1937年に日独防共協定へ加わり、1940年に日独伊三国同盟の一員となった。']] }),
  h_de: H('h_de', { name: 'ナチス・ドイツ（ヒトラー政権）', short: 'ナチス・ドイツ', leader: 'アドルフ・ヒトラー総統', gov: '国家社会主義ドイツ労働者党の一党体制', capital: [54.3, 12.6],
    gdp: flat(0.9), mil: flat(88), trade: flat(2.0), rel: flat(30), member: [],
    note: [[0, '1933年にヒトラーが首相となり、のち総統として一党体制を敷いた。ヴェルサイユ体制の打破を掲げて再軍備と領土の拡大を進め、1939年9月の開戦で第二次世界大戦が始まった。日本とは1936年に日独防共協定、1940年に日独伊三国同盟を結んだ。']] }),
  h_cn: H('h_cn', { name: '中華人民共和国（毛沢東政権）', short: '中国（毛沢東期）', leader: '毛沢東主席', gov: '中国共産党の一党体制（社会主義）', region: 'asia', capital: [37.6, 114.2],
    gdp: flat(0.35), mil: flat(42), trade: flat(3.0), rel: flat(-25), member: [],
    note: [[0, '1949年の建国から1976年まで、毛沢東が党の主席として国を率いた。土地改革、「大躍進」、文化大革命と大きな政策の転換が続いた。1950年に中ソ友好同盟相互援助条約を結び、1964年に初の核実験を行った。日本とは1972年9月の日中共同声明で国交を正常化した。']] }),
  h_kh: H('h_kh', { name: '民主カンプチア（ポル・ポト政権）', short: '民主カンプチア', leader: 'ポル・ポト首相', gov: 'カンプチア共産党の一党体制（民主カンプチア）', region: 'asia', capital: [11.55, 104.9],
    gdp: flat(0.03), mil: flat(22), trade: flat(0.05), rel: flat(-15), member: [],
    note: [[0, '1975年4月に首都プノンペンを制圧し、1976年に国名を民主カンプチアとした。ポル・ポトは党書記・首相として、都市の住民を農村へ移して農業を中心にする急進的な政策を進めた。1977年からベトナムとの国境の衝突が激しくなり、1978年末にベトナム軍が侵攻して、1979年1月に政権は首都を失った。']] }),
  h_iq: H('h_iq', { name: 'イラク共和国（サダム・フセイン政権）', short: 'イラク（サダム期）', leader: 'サダム・フセイン大統領', gov: 'バアス党の一党支配（大統領への権力の集中）', region: 'mideast', capital: [33.31, 44.36],
    gdp: flat(0.05), mil: flat(58), trade: flat(0.9), rel: flat(5), member: [],
    note: [[0, '1979年7月にフセインが大統領になり、党と国家を率いた。1980年にイランへ侵攻して8年にわたる戦争になり、1990年にクウェートへ侵攻して1991年の湾岸戦争を招いた。そののちも経済制裁と国連の査察が続き、2003年3月の米英軍などの侵攻で、4月に政権は崩壊した。日本は石油の輸入先として結びつきが深く、1991年には湾岸戦争の多国籍軍に資金を出し、ペルシャ湾へ掃海部隊を送った。']] }),
  h_kp: H('h_kp', { name: '朝鮮民主主義人民共和国（金日成政権）', short: '北朝鮮（金日成期）', leader: '金日成首相・主席', gov: '朝鮮労働党の一党体制（主体思想）', region: 'asia', capital: [39.03, 125.75], noTies: true,
    gdp: flat(0.02), mil: flat(40), trade: flat(0.2), rel: flat(-35), member: [],
    note: [[0, '1948年の建国から1994年の死去まで、金日成が党と国家を率いた。1950年に朝鮮戦争を始め、1953年に休戦した。「主体（チュチェ）」を掲げ、党内の反対派を退けて個人崇拝を築いた。1959年から在日朝鮮人の帰還事業が続き、1970年代から80年代には日本から人が行方不明になる事件が相次いだ（のちに拉致と判明）。1990年に日本の訪朝団が国交正常化をめざす共同宣言を出したが、交渉は進まなかった。核開発をめぐる緊張が高まるなか、1994年7月に死去した。日本とは国交がない。']] }),
  h_kp2: H('h_kp2', { name: '朝鮮民主主義人民共和国（金正日政権）', short: '北朝鮮（金正日期）', leader: '金正日国防委員会委員長', gov: '朝鮮労働党の一党体制（先軍政治・世襲）', region: 'asia', capital: [39.03, 125.75], noTies: true,
    gdp: flat(0.02), mil: flat(45), trade: flat(0.1), rel: flat(-55), member: [],
    note: [[0, '1994年7月の金日成の死去を受けて、息子の金正日が権力を継ぎ、2011年12月に死去するまで国を率いた。1990年代後半には深刻な食糧不足が続き、1998年にはミサイルが日本列島の上空を越えた。2000年に初の南北首脳会談、2002年9月には小泉首相が訪朝して日朝平壌宣言が出され、北朝鮮は日本人の拉致を認めた。その後、2003年にNPT脱退を宣言し、2006年と2009年に核実験を行った。2010年には韓国の哨戒艦の沈没と延坪島の砲撃が起きた。日本とは国交がない。']] }),
  h_ug: H('h_ug', { name: 'ウガンダ共和国（イディ・アミン政権）', short: 'ウガンダ（アミン期）', leader: 'イディ・アミン大統領', gov: '軍事政権（大統領への権力の集中）', region: 'africa', capital: [0.35, 32.58],
    gdp: flat(0.01), mil: flat(14), trade: flat(0.03), rel: flat(-10), member: [],
    note: [[0, '1971年1月のクーデターで、軍の司令官だったアミンが政権を握った。1972年にアジア系住民を国外へ追放し、外国企業を接収して経済が混乱した。秘密警察などによる拘束と殺害が広がり、犠牲者は10万〜50万人と推計される。1976年に終身大統領を名のり、1978年にタンザニアへ侵攻したが、反撃を受けて1979年4月に首都を失った。']] }),
  h_zw: H('h_zw', { name: 'ジンバブエ共和国（ムガベ政権）', short: 'ジンバブエ（ムガベ期）', leader: 'ロバート・ムガベ首相・大統領', gov: 'ZANU-PFの一党優位体制（大統領への権力の集中）', region: 'africa', capital: [-17.83, 31.05],
    gdp: flat(0.01), mil: flat(16), trade: flat(0.03), rel: flat(-5), member: [],
    note: [[0, '1980年4月の独立から2017年11月の辞任まで、ムガベが首相、のち大統領として国を率いた。1980年代前半の反対派の掃討、2000年からの白人農場の占拠と土地改革、2008年の超インフレなどで国は大きく揺れた。英国や米国、EUは制裁を科し、ジンバブエは英連邦を脱退して中国との関係を深めた。2017年11月に軍が実権を握り、ムガベは辞任した。']] }),
};
// Relations between these and the others (−100..100), merged into world.js PAIRS (keys are the two ids sorted and joined by |).
export const HIST_PAIRS = {
  'h_de|h_it': A([1987, 70]), 'h_de|h_su': A([1987, -45]), 'h_it|h_su': A([1987, -35]), 'h_cn|h_su': A([1987, 35]), 'h_cn|h_de': A([1987, -5]), 'h_cn|h_it': A([1987, 0]),
  'h_de|us': A([1987, -75]), 'gb|h_de': A([1987, -80]), 'fr|h_de': A([1987, -75]), 'h_it|us': A([1987, -60]), 'gb|h_it': A([1987, -60]), 'fr|h_it': A([1987, -50]),
  'h_su|us': A([1987, -50]), 'gb|h_su': A([1987, -35]), 'fr|h_su': A([1987, -20]), 'h_cn|us': A([1987, -65]), 'gb|h_cn': A([1987, -20]), 'h_cn|in': A([1987, -20]),
  'h_kh|h_cn': A([1987, 70]), 'h_kh|vn': A([1987, -80]), 'h_kh|h_su': A([1987, -50]), 'h_kh|us': A([1987, -50]), 'h_kh|th': A([1987, -25]), 'h_cn|vn': A([1987, 30]),
  'h_cn|kr': A([1987, -60]), 'h_cn|tw': A([1987, -70]), 'h_cn|kp': A([1987, 55]), 'h_su|kp': A([1987, 45]), 'h_cn|ph': A([1987, -30]),
  // [R22] イラク（サダム）・北朝鮮（金日成）・ウガンダ（アミン）・ジンバブエ（ムガベ）
  'h_iq|ir': A([1987, -80]), 'h_iq|us': A([1987, -30]), 'gb|h_iq': A([1987, -30]), 'fr|h_iq': A([1987, 10]), 'h_iq|il': A([1987, -70]), 'h_iq|sa': A([1987, -10]), 'h_iq|su': A([1987, 40]), 'h_iq|h_su': A([1987, 40]),
  'cn|h_iq': A([1987, 15]), 'h_cn|h_iq': A([1987, 15]), 'h_iq|tr': A([1987, 0]), 'h_iq|h_kp': A([1987, 10]),
  'h_kp2|kr': A([1987, -60]), 'h_kp2|us': A([1987, -70]), 'cn|h_kp2': A([1987, 50]), 'h_cn|h_kp2': A([1987, 50]), 'h_kp2|ru': A([1987, 30]), 'h_kp2|h_su': A([1987, 30]), 'h_iq|h_kp2': A([1987, 5]), 'h_kp2|tw': A([1987, -30]),
  'h_kp|kr': A([1987, -85]), 'h_kp|us': A([1987, -85]), 'cn|h_kp': A([1987, 55]), 'h_cn|h_kp': A([1987, 55]), 'h_kp|su': A([1987, 45]), 'h_kp|h_su': A([1987, 45]), 'h_kp|tw': A([1987, -40]),
  'h_ug|us': A([1987, -35]), 'gb|h_ug': A([1987, -50]), 'h_ug|il': A([1987, -75]), 'h_ug|su': A([1987, 25]), 'h_ug|h_su': A([1987, 25]), 'h_ug|sa': A([1987, 20]), 'h_ug|in': A([1987, -30]),
  'gb|h_zw': A([1987, -40]), 'h_zw|us': A([1987, -40]), 'fr|h_zw': A([1987, -15]), 'cn|h_zw': A([1987, 45]), 'h_cn|h_zw': A([1987, 45]), 'h_zw|in': A([1987, 10]), 'h_ug|h_zw': A([1987, 5]),
};
