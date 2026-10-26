// 歴史の列強 (設定で世界情勢に加える): ソ連（スターリン政権）・ファシスト・イタリア（ムッソリーニ政権）・ナチス・ドイツ（ヒトラー政権）・
// 中華人民共和国（毛沢東政権）。Plain data (no imports): world.js spreads HIST_COUNTRIES into COUNTRIES; world_hist.js has the setting API,
// the images and the drawing helpers. The leaders and flags are the historical ones, shown by their real names and the photos / flags as they are.
// Facts: 日独防共協定 1936年11月（イタリアは1937年11月に加わる）。三国同盟 1940年9月。日ソ中立条約 1941年4月。ソ連の対日参戦 1945年8月。
//   中ソ友好同盟相互援助条約 1950年2月。中国の初の核実験 1964年10月。日中共同声明 1972年9月。スターリンの死去 1953年3月、毛沢東の死去 1976年9月。
const A = (...pairs) => pairs;
const flat = (v) => A([1987, v], [2026, v]);
export const HIST_IDS = ['h_su', 'h_it', 'h_de', 'h_cn'];
export const HIST = {
  h_su: { id: 'h_su', country: 'ソ連', flag: 'flag_su', portrait: 'pt_su', leaderName: 'ヨシフ・スターリン', title: 'ソ連共産党中央委員会書記長', years: '1920年代後半〜1953年', real: 'su', label: 'ソ連（スターリン政権時）' },
  h_it: { id: 'h_it', country: 'イタリア', flag: 'flag_it', portrait: 'pt_it', leaderName: 'ベニト・ムッソリーニ', title: 'イタリア王国首相・国家ファシスト党党首（統領＝ドゥーチェ）', years: '1922〜1943年', real: 'it', label: 'イタリア（ムッソリーニ政権時）' },
  h_de: { id: 'h_de', country: 'ドイツ', flag: 'flag_de', portrait: 'pt_de', leaderName: 'アドルフ・ヒトラー', title: '総統・国家社会主義ドイツ労働者党党首', years: '1933〜1945年', real: 'de', label: 'ナチス・ドイツ（ヒトラー政権時）' },
  h_cn: { id: 'h_cn', country: '中国', flag: 'flag_cn', portrait: 'pt_cn', leaderName: '毛沢東', title: '中国共産党中央委員会主席', years: '1949〜1976年', real: 'cn', label: '中華人民共和国（毛沢東政権時）' },
};
const H = (id, def) => ({ id, real: true, hist: true, region: 'europe', from: 0, to: 0, p5: false, ...HIST[id] && { flag: HIST[id].flag, portrait: HIST[id].portrait }, ...def });
export const HIST_COUNTRIES = {
  h_su: H('h_su', { name: 'ソビエト連邦（スターリン政権）', short: 'ソ連（スターリン期）', leader: 'ヨシフ・スターリン書記長', gov: 'ソ連共産党の一党体制（社会主義の計画経済）', capital: [58.2, 38.0],
    gdp: flat(1.1), mil: flat(85), trade: flat(1.5), rel: flat(-20), member: [],
    note: [[0, '1920年代の終わりから1953年まで、スターリンが党と国家を率いた。五か年計画で工業化を急ぎ、第二次世界大戦ではドイツと戦って連合国の勝者の側に立った。日本とは1941年4月に日ソ中立条約を結んだが、1945年8月に対日参戦した。']] }),
  h_it: H('h_it', { name: 'イタリア王国（ムッソリーニ政権）', short: 'ファシスト・イタリア', leader: 'ベニト・ムッソリーニ首相（統領）', gov: '国家ファシスト党の一党体制（王国）', capital: [43.9, 10.6],
    gdp: flat(0.4), mil: flat(38), trade: flat(0.6), rel: flat(25), member: [],
    note: [[0, '1922年から1943年まで、ムッソリーニが首相として国を率いた。ファシスト党の一党体制で、1935年にエチオピアへ侵攻した。1936年にドイツと「ローマ・ベルリン枢軸」を結び、1937年に日独防共協定へ加わり、1940年に日独伊三国同盟の一員となった。']] }),
  h_de: H('h_de', { name: 'ナチス・ドイツ（ヒトラー政権）', short: 'ナチス・ドイツ', leader: 'アドルフ・ヒトラー総統', gov: '国家社会主義ドイツ労働者党の一党体制', capital: [54.3, 12.6],
    gdp: flat(0.9), mil: flat(88), trade: flat(2.0), rel: flat(30), member: [],
    note: [[0, '1933年にヒトラーが首相となり、のち総統として一党体制を敷いた。ヴェルサイユ体制の打破を掲げて再軍備と領土の拡大を進め、1939年9月の開戦で第二次世界大戦が始まった。日本とは1936年に日独防共協定、1940年に日独伊三国同盟を結んだ。']] }),
  h_cn: H('h_cn', { name: '中華人民共和国（毛沢東政権）', short: '中国（毛沢東期）', leader: '毛沢東主席', gov: '中国共産党の一党体制（社会主義）', region: 'asia', capital: [37.6, 114.2],
    gdp: flat(0.35), mil: flat(42), trade: flat(3.0), rel: flat(-25), member: [],
    note: [[0, '1949年の建国から1976年まで、毛沢東が党の主席として国を率いた。土地改革、「大躍進」、文化大革命と大きな政策の転換が続いた。1950年に中ソ友好同盟相互援助条約を結び、1964年に初の核実験を行った。日本とは1972年9月の日中共同声明で国交を正常化した。']] }),
};
// Relations between these and the others (−100..100), merged into world.js PAIRS (keys are the two ids sorted and joined by |).
export const HIST_PAIRS = {
  'h_de|h_it': A([1987, 70]), 'h_de|h_su': A([1987, -45]), 'h_it|h_su': A([1987, -35]), 'h_cn|h_su': A([1987, 35]), 'h_cn|h_de': A([1987, -5]), 'h_cn|h_it': A([1987, 0]),
  'h_de|us': A([1987, -75]), 'gb|h_de': A([1987, -80]), 'fr|h_de': A([1987, -75]), 'h_it|us': A([1987, -60]), 'gb|h_it': A([1987, -60]), 'fr|h_it': A([1987, -50]),
  'h_su|us': A([1987, -50]), 'gb|h_su': A([1987, -35]), 'fr|h_su': A([1987, -20]), 'h_cn|us': A([1987, -65]), 'gb|h_cn': A([1987, -20]), 'h_cn|in': A([1987, -20]),
  'h_cn|kr': A([1987, -60]), 'h_cn|tw': A([1987, -70]), 'h_cn|vn': A([1987, 30]), 'h_cn|kp': A([1987, 55]), 'h_su|kp': A([1987, 45]), 'h_cn|ph': A([1987, -30]),
};
