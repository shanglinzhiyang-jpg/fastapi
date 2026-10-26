// Ideology core (思想・イデオロギー): the axes that place every ideology, the encyclopedia
// (23 ideologies + 16 schools of communism), the player's own ideology (computed and nudged
// from what the player does), the ideology of parties / NPC politicians, the 思想診断 quiz,
// and a classifier that describes an authoritarian regime for the news.
// API doc: test-output/api_ideology.txt. Installs itself on Game.prototype at import time.
//
// ---------------------------------------------------------------- content rules
// - Encyclopedia text is factual, neutral and sourced (web searches in 2026-10; each entry
//   lists its sources). It shows both the ideas and the historical record, including
//   failures and crimes (大粛清, 大躍進の飢饉, 文化大革命, ホロコースト …). No praise, no
//   recruitment tone; "pro" lines say how supporters argue, "con" lines how critics argue.
// - Historical figures are named only as history inside these entries. No living politician
//   is named anywhere.
// - ファシズム and ナチズム are selectable: false: no party can be founded under them and the
//   player cannot declare them; they exist only in the encyclopedia and as a classification
//   (classifyRegime describes actions; it is never praise).
// - Real parties (自由民主党, 民主党 1998-2016) get ideology labels ONLY from their own
//   published self-description (short phrases quoted in REAL_PARTY_IDEOLOGY); their axes are
//   the mean of those declared ideologies, not an editorial placement.
// - Text is written for small HD screens: short lines (about 22 full-width characters).
//
// ---------------------------------------------------------------- state (g.state.ideology)
// { v: 1, axes: { econ, power, social, world, env, nation, tech } (-1..1), weight (evidence),
//   history: [{ day, why, w, d: { axis: delta }, label? }], party: { [partyId]: [ideologyIds] },
//   seen: { key: day }, last: { regime, press, war, cls }, drift: { d, day, note }, quiz }
// Old saves without it get the defaults (ensureIdeo).

import { Game } from './game.js';
import { onMorning } from './life.js';

// politics.js is optional (guarded literal import, like crime.js does)
let POL = null;
export const ideologyReady = import('./politics.js')
  .then((m) => { POL = m; hookPolitics(); return true; })
  .catch((e) => { console.warn('[ideology] politics core not loaded:', e && e.message); return false; });

// ================================================================ axes
// Each axis runs from -1 (left label) to +1 (right label).
export const IDEO_AXES = [
  { id: 'econ', name: '経済', left: '平等・計画', right: '市場・自由',
    desc: '富を平等に分け、国や社会が計画して動かすか（−）、市場での競争と自由な取引にまかせるか（＋）。' },
  { id: 'power', name: '権力', left: '自由・分権', right: '権威・集権',
    desc: '権力を分けて個人の自由や権利を守るか（−）、強い指導者や国家に権力を集めるか（＋）。' },
  { id: 'social', name: '社会', left: '進歩・変革', right: '伝統・秩序',
    desc: '新しい価値観や改革を進めるか（−）、伝統・家族・慣習や秩序を重んじるか（＋）。' },
  { id: 'world', name: '外交', left: '協調・国際', right: '自国優先・拡張',
    desc: '国際協調や国をこえた連帯を重んじるか（−）、自国の利益と力、勢力の拡大を優先するか（＋）。' },
  { id: 'env', name: '環境', left: '成長優先', right: '環境優先',
    desc: '経済成長や開発を優先するか（−）、成長をおさえても自然と将来の世代を守るか（＋）。' },
  { id: 'nation', name: '国家', left: '統合', right: '分離・自治',
    desc: '一つの国として強くまとまるか（−）、地域・民族・共同体の自治や独立を求めるか（＋）。' },
  { id: 'tech', name: '技術', left: '慎重', right: '人間の拡張',
    desc: '新しい技術に慎重で、人間の自然な姿を大切にするか（−）、技術で体や心の力を広げるか（＋）。' },
];
export const AXIS_IDS = IDEO_AXES.map((a) => a.id);

// Families (for grouping in the encyclopedia).
export const IDEO_FAMILIES = {
  conservative: { name: '保守系' },
  centrist: { name: '中道・協調系' },
  liberal: { name: '自由主義系' },
  socialist: { name: '社会主義系' },
  communism: { name: '共産主義系' },
  anarchist: { name: '無政府主義系' },
  movement: { name: '社会運動系' },
  national: { name: '国家・民族系' },
  populist: { name: '大衆政治' },
  democratic: { name: '民主政系' },
  authoritarian: { name: '権威主義系' },
  totalitarian: { name: '全体主義（極右）' },
  future: { name: '未来・技術系' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const r3 = (v) => Math.round(v * 1000) / 1000;
const AX = (econ, power, social, world, env, nation, tech) => ({ econ, power, social, world, env, nation, tech });
const S = (title, url) => ({ title, url });
const NOT_SELECTABLE = 'ゲームでは理念として選べません。歴史を学ぶための項目です。';

function entry(id, family, o) {
  return {
    id, family, name: o.name, full: o.full || o.name, alt: o.alt || null, kana: o.kana, short: o.short || '',
    axes: o.axes, summary: o.summary, ideas: o.ideas, history: o.history, record: o.record,
    pro: o.pro, con: o.con, related: o.related || [], selectable: o.selectable !== false,
    note: o.note || null, sources: o.sources || [],
  };
}

// ================================================================ the encyclopedia (23)
export const IDEOLOGIES = {
  conservatism: entry('conservatism', 'conservative', {
    name: '保守主義', kana: 'ほしゅしゅぎ', short: '伝統と少しずつの改革',
    axes: AX(0.4, 0.3, 0.8, 0.3, -0.2, -0.4, -0.3),
    summary: '伝統や慣習、長く続いた制度を大切にする。\n社会は急がず、少しずつ変えるべきだと考える。',
    ideas: ['急な改革より、少しずつの改善', '家族・地域・伝統の役割を重んじる', '長く続く制度には知恵があると考える', '秩序の中で自由を守る'],
    history: ['1790年 英国のバークが', '　『フランス革命の省察（せいさつ）』で革命を批判', '1867年 英国の保守党政権が', '　都市の男性労働者に選挙権を広げる', '1955年 日本で「保守合同」、自由民主党が結党'],
    record: ['急な変化による混乱を避け、制度を安定させたとされる', '英国では保守党政権も段階的に選挙権を広げた', '一方、身分や差別の解消を遅らせたとの批判もある'],
    pro: ['うまくいっている仕組みを壊さずにすむ', '人のつながりや伝統が安心を生む'],
    con: ['今ある不平等をそのまま守ってしまう', '時代の変化への対応が遅れやすい'],
    related: ['moderatism', 'communitarianism', 'capitalism'],
    sources: [
      S('Reflections on the Revolution in France (Wikipedia)', 'https://en.wikipedia.org/wiki/Reflections_on_the_Revolution_in_France'),
      S('Foundations of Modern Conservatism (EBSCO Research Starters)', 'https://www.ebsco.com/research-starters/history/foundations-modern-conservatism'),
      S('The Making of the Second Reform Act (Cambridge UP excerpt)', 'https://assets.cambridge.org/97805215/76536/excerpt/9780521576536_excerpt.pdf'),
      S('自由民主党「保守合同前史」「自由民主党結成」', 'https://www.jimin.jp/aboutus/history/1955-1956.html'),
    ],
  }),
  moderatism: entry('moderatism', 'centrist', {
    name: '穏健主義', kana: 'おんけんしゅぎ', short: '中道・バランス',
    axes: AX(0.05, -0.15, 0.05, -0.15, 0.05, -0.1, 0),
    summary: '左右どちらかに大きくかたよらず、\n話し合いと妥協で現実的な答えを探す。',
    ideas: ['極端な主張をさけ、中道をめざす', '対立する意見のよい所を組み合わせる', '急がず、実際の効果を見て決める'],
    history: ['前4世紀 アリストテレスが「中庸」を説く', '1990年代 英国などで「第三の道」', '　（市場と福祉の両立）が唱えられる', '1998年 日本の民主党が基本理念に「民主中道」'],
    record: ['連立や超党派の合意で、政治の安定に役立った例が多い', '1999年 英国の「第三の道」の政権が全国最低賃金を導入', '一方、改革が中途半端になるとの批判もある'],
    pro: ['対立をやわらげ、多くの人が納得しやすい', '失敗したときの被害が小さい'],
    con: ['はっきりした理想や方向が見えにくい', '大きな問題に思い切った手が打てない'],
    related: ['democracy', 'conservatism', 'progressivism'],
    sources: [
      S('What is the third way? (The Week)', 'https://theweek.com/103471/what-is-the-third-way'),
      S('The Third Way: New Philosophy or Politics as Usual (Heritage Foundation)', 'https://www.heritage.org/political-process/report/the-third-way-new-philosophy-or-politics-usual'),
      S('民主党 (日本 1998-2016)（Wikipedia）', 'https://ja.wikipedia.org/wiki/%E6%B0%91%E4%B8%BB%E5%85%9A_(%E6%97%A5%E6%9C%AC_1998-2016)'),
    ],
  }),
  capitalism: entry('capitalism', 'liberal', {
    name: '資本主義', kana: 'しほんしゅぎ', short: '市場と私有財産',
    axes: AX(0.9, -0.1, 0.1, -0.2, -0.6, -0.1, 0.4),
    summary: '工場や会社などを個人がもち、\n市場での自由な取引と競争で経済を動かす。',
    ideas: ['私有財産と、自由な売り買い', '競争が工夫と成長を生む', '価格が「何をどれだけ作るか」を決める', '政府の役割は小さめがよいとされる'],
    history: ['1776年 アダム・スミスが『国富論』', '18〜19世紀 産業革命で工業化が進む', '1929年 世界恐慌（きょうこう）', '2008年 世界金融危機'],
    record: ['多くの国で生産と所得が大きく伸びた', '世界の極度の貧困は1990年の36%から', '　2015年の10%に下がった（世界銀行）', '初期の工場では長時間労働や児童労働が広がった', '恐慌や金融危機、格差の拡大もくり返された'],
    pro: ['自由な工夫が新しい商品と豊かさを生む', '個人が財産と仕事を自分で選べる'],
    con: ['格差が広がり、弱い立場の人が困る', '不況や環境破壊を市場だけでは防げない'],
    related: ['libertarianism', 'conservatism', 'socialism'],
    sources: [
      S('Nearly Half the World Lives on Less than $5.50 a Day (World Bank, 2018)', 'https://www.worldbank.org/en/news/press-release/2018/10/17/nearly-half-the-world-lives-on-less-than-550-a-day'),
      S('Capitalism (Encyclopaedia Britannica)', 'https://www.britannica.com/topic/capitalism'),
    ],
  }),
  socialism: entry('socialism', 'socialist', {
    name: '社会主義', kana: 'しゃかいしゅぎ', short: '平等と社会での共有',
    axes: AX(-0.7, -0.1, -0.4, -0.4, 0.2, -0.2, 0),
    summary: '大事な産業や富を社会みんなのものに近づけ、\n格差をへらして平等なくらしをめざす。',
    ideas: ['大事な産業は社会全体で管理する', '税と福祉で格差をへらす', '働く人の権利を守る', '選挙で進める流れ（社会民主主義）もある'],
    history: ['19世紀初め 英国のオーウェンらが', '　理想の共同体を試みる', '1889年 パリで第二インターナショナル', '1948年 英国で無料の国民保健サービス', '20世紀後半 北欧などで福祉国家が広がる'],
    record: ['医療・教育・年金などの福祉制度が広がった', '国有企業の非効率や財政赤字が問題になった例もある', '一党独裁と結びついた国では自由が失われた'],
    pro: ['だれもが医療や教育を受けられる', '生まれた家による差を小さくできる'],
    con: ['税や負担が重く、意欲が下がるとの指摘', '国の管理が大きくなりすぎる危険'],
    related: ['communism', 'unionism', 'egalitarianism', 'progressivism'],
    sources: [
      S('Robert Owen (Encyclopaedia Britannica)', 'https://www.britannica.com/biography/Robert-Owen'),
      S('Second International (Wikipedia)', 'https://en.wikipedia.org/wiki/Second_International'),
      S('The foundation of the NHS (The National Archives)', 'https://beta.nationalarchives.gov.uk/explore-the-collection/stories/the-foundation-of-the-nhs'),
    ],
  }),
  unionism: entry('unionism', 'socialist', {
    name: '労働組合主義', kana: 'ろうどうくみあいしゅぎ', short: '働く人の団結と交渉',
    axes: AX(-0.6, -0.3, -0.1, 0.1, -0.2, -0.1, -0.4),
    summary: '働く人が労働組合に集まり、\n賃金や働き方を会社と交渉して守る。',
    ideas: ['団結して交渉する（団体交渉）', 'ストライキで要求を示すこともある', '安全な職場と公正な賃金', '政治では働く人の声を代表する'],
    history: ['19世紀 英国などで労働組合が広がる', '1919年 国際労働機関（ILO）設立', '　第1号条約は1日8時間・週48時間', '1945年 日本で労働組合法が成立'],
    record: ['8時間労働や休日の広がりに大きな役割を果たした', '職場の安全や賃金の底上げに役立った', '一方、ストで市民生活が止まることもあった', '組合員とそれ以外の人の待遇差も問題になった'],
    pro: ['一人では弱い働き手が対等に交渉できる', '働きすぎや不当な解雇を防ぐ'],
    con: ['ストライキが社会に迷惑をかけることがある', '新しい技術や変化を拒みがちとの批判'],
    related: ['socialism', 'corporatism', 'egalitarianism'],
    sources: [
      S('Convention No. 1: a landmark for workers’ rights (ILO)', 'https://www.ilo.org/resource/article/convention-no-1-landmark-workers%E2%80%99-rights'),
      S('Hours of Work (Industry) Convention, 1919 (Wikipedia)', 'https://en.wikipedia.org/wiki/Hours_of_Work_(Industry)_Convention,_1919'),
      S('労働組合法（コトバンク）', 'https://kotobank.jp/word/%E5%8A%B4%E5%83%8D%E7%B5%84%E5%90%88%E6%B3%95'),
    ],
  }),
  corporatism: entry('corporatism', 'centrist', {
    name: '協調主義', alt: 'コーポラティズム', full: '協調主義（コーポラティズム）', kana: 'きょうちょうしゅぎ', short: '政府・経営・労働の協調',
    axes: AX(-0.1, 0.4, 0.4, 0.1, -0.2, -0.5, -0.1),
    summary: '政府・経営者・労働組合などの団体が\n話し合って、賃金や政策を決めていく。',
    ideas: ['対立より協調で社会をまとめる', '業界や職業の団体が政治に参加する', '賃金や物価を話し合いで調整する'],
    history: ['1891年 ローマ教皇の回勅（かいちょく）が', '　労使の協調を説く', '1920〜30年代 ファシズム期のイタリアが', '　国家主導の「協同体国家」をつくる', '1938年 スウェーデンで労使の基本協約', '1982年 オランダで賃金抑制と時短の合意'],
    record: ['北欧などでは安定した労使関係が続いた', 'ファシズム期のイタリアでは独立した労働組合が', '　つぶされ、ストライキが禁止された', '団体に入らない人の声が届きにくいとの批判'],
    pro: ['争いを減らし、経済を安定させやすい', '多くの関係者の合意で決められる'],
    con: ['一部の大きな団体だけで物事が決まりやすい', '国が団体を支配すると独裁の道具になる'],
    related: ['unionism', 'moderatism', 'communitarianism', 'fascism'],
    sources: [
      S('Corporatism and the Nordic countries (nordics.info)', 'https://nordics.info/show/artikel/corporatism-the-influence-of-trade-unions-and-interest-groups/'),
      S('Chamber of Fasces and Corporations (Wikipedia)', 'https://en.wikipedia.org/wiki/Chamber_of_Fasces_and_Corporations'),
      S('The Saltsjöbaden (Basic) Agreement, 1938 (Univ. of Alberta)', 'https://sites.ualberta.ca/~yreshef/orga417/countries/basic.html'),
    ],
  }),
  libertarianism: entry('libertarianism', 'liberal', {
    name: '自由至上主義', alt: 'リバタリアニズム', full: '自由至上主義（リバタリアニズム）', kana: 'じゆうしじょうしゅぎ', short: '個人の自由が最優先',
    axes: AX(1.0, -0.9, -0.2, -0.1, -0.4, 0.3, 0.5),
    summary: '個人の自由と財産を何より大切にし、\n国の役割は治安や契約を守る程度でよい\nと考える。',
    ideas: ['政府は小さいほどよい（最小国家）', '税や規制はできるだけ少なく', '他人を傷つけない限り、生き方は自由', '自由な市場を信頼する'],
    history: ['1944年 ハイエクが『隷従（れいじゅう）への道』', '1971年 米国でリバタリアン党が結成', '1974年 ノージックが', '　『アナーキー・国家・ユートピア』'],
    record: ['規制緩和や民営化の議論に影響を与えた', '国全体でそのまま実行された例はない', '2008年の金融危機は規制の緩めすぎが一因との見方も'],
    pro: ['個人の選択と責任を尊重する', '政府のむだや介入を減らせる'],
    con: ['貧しい人や弱い人が取り残されやすい', '道路や環境など、みんなのものが守りにくい'],
    related: ['capitalism', 'anarchism', 'transhumanism'],
    sources: [
      S('Robert Nozick (Internet Encyclopedia of Philosophy)', 'https://iep.utm.edu/nozick'),
      S('History of the Libertarian Party (United States) (Wikipedia)', 'https://en.wikipedia.org/wiki/History_of_the_Libertarian_Party_(United_States)'),
    ],
  }),
  separatism: entry('separatism', 'national', {
    name: '分離主義', kana: 'ぶんりしゅぎ', short: '独立・自治を求める',
    axes: AX(0, 0, 0.3, 0.3, 0.1, 1.0, -0.1),
    summary: 'ある地域や民族が、今の国から分かれて\n独立や強い自治を求める考え。',
    ideas: ['自分たちのことは自分たちで決める', '言葉・文化・歴史の違いを重んじる', '住民投票などで独立を問う'],
    history: ['1905年 ノルウェーが住民投票を経て', '　スウェーデンから平和的に独立', '1993年 チェコとスロバキアが話し合いで分離', '2011年 南スーダンが住民投票を経て独立'],
    record: ['平和的に分かれた国もあれば、内戦になった例もある', '2013年 南スーダンで独立の2年後に内戦が起きた', '武装闘争やテロに走った組織もあった'],
    pro: ['少数派の文化や権利を守れる', '住民が身近な政治を自分で決められる'],
    con: ['経済や安全保障が不安定になりやすい', '新しい国の中で別の少数派が生まれる'],
    related: ['communitarianism', 'anarchism', 'populism'],
    sources: [
      S('1905 Norwegian union dissolution referendum (Wikipedia)', 'https://en.wikipedia.org/wiki/1905_Norwegian_union_dissolution_referendum'),
      S('South Sudan in landslide vote for independence (Mail & Guardian)', 'https://mg.co.za/article/2011-02-07-south-sudan-in-landslide-vote-for-independence'),
    ],
  }),
  communism: entry('communism', 'communism', {
    name: '共産主義', kana: 'きょうさんしゅぎ', short: '私有財産のない社会',
    axes: AX(-1.0, 0.6, -0.6, -0.5, -0.4, -0.5, 0.2),
    summary: '工場や土地を社会全体のものにして、\n階級のない平等な社会をめざす思想。\n実際の国家の多くは一党独裁となった。',
    ideas: ['工場や土地（生産手段）の共有', '階級のない社会をめざす', '「能力に応じて働き、必要に応じて受け取る」', '多くの国で共産党の一党支配になった'],
    history: ['1848年 マルクスとエンゲルスが『共産党宣言』', '1917年 ロシア革命。1922年 ソ連が成立', '1949年 中華人民共和国が成立', '1991年 ソ連が解体'],
    record: ['急速な工業化や識字率の向上を進めた国もある', 'ソ連の大粛清（だいしゅくせい、1937〜38年）では', '　公式記録だけで約68万人が銃殺（じゅうさつ）された', '中国の大躍進（1958〜62年）の大飢饉で', '　推計1500万〜5000万人が死亡（研究で幅がある）', 'カンボジアのポル・ポト政権（1975〜79年）で', '　推計150万〜200万人が死亡', '多くの国で言論の自由や自由な選挙が失われた'],
    pro: ['貧富の差や搾取（さくしゅ）のない社会を理想とする', '教育や医療を全員に届けようとした'],
    con: ['一党独裁となり、反対意見が弾圧（だんあつ）された', '計画経済は非効率で、飢饉や物不足をまねいた'],
    related: ['socialism', 'marxism', 'leninism', 'anarchism'],
    sources: [
      S('Great Purge (Wikipedia)', 'https://en.wikipedia.org/wiki/Great_Purge'),
      S('Great Leap Forward famine (EBSCO Research Starters)', 'https://www.ebsco.com/research-starters/history/great-leap-forward-famine'),
      S('Khmer Rouge (Encyclopaedia Britannica summary)', 'https://www.britannica.com/summary/Khmer-Rouge'),
    ],
  }),
  feminism: entry('feminism', 'movement', {
    name: 'フェミニズム', kana: 'ふぇみにずむ', short: '性別による差をなくす',
    axes: AX(-0.2, -0.4, -0.9, -0.4, 0.2, 0, 0.1),
    summary: '性別によって機会や権利に差がつかない\n社会をめざす思想と運動。',
    ideas: ['女性の参政権・教育・仕事の権利', '性別による役割の押しつけを見直す', '暴力やハラスメントをなくす', 'いろいろな立場・流れがある'],
    history: ['1792年 英国のウルストンクラフトが', '　『女性の権利の擁護（ようご）』', '1848年 米国でセネカフォールズ会議', '1893年 ニュージーランドで女性が国政の投票権', '1911年 日本で雑誌『青鞜』創刊', '1946年 日本の女性が初めて投票、39人が当選'],
    record: ['多くの国で女性の参政権と法の下の平等が実現した', '働く女性の権利を守る法律が広がった', '運動の中でも考え方の違いや対立がある', '政策の進め方には賛否が分かれる'],
    pro: ['人口の半分の力と才能を生かせる', '家庭や職場の不公平を正せる'],
    con: ['一部の主張は行きすぎだと感じる人もいる', '割り当て制（クオータ）は逆の不公平との意見'],
    related: ['progressivism', 'egalitarianism', 'democracy'],
    sources: [
      S('A Vindication of the Rights of Woman (Wikipedia)', 'https://en.wikipedia.org/wiki/A_Vindication_of_the_Rights_of_Woman'),
      S('National suffrage timeline (Winning the Vote)', 'https://winningthevote.org/timelines/national-suffrage-timeline/'),
      S('近代日本人の肖像・資料（国立国会図書館）', 'https://www.ndl.go.jp/modern/cha5/description05.html'),
      S('青鞜（コトバンク）', 'https://kotobank.jp/word/%E9%9D%92%E9%9E%9C-86272'),
    ],
  }),
  anarchism: entry('anarchism', 'anarchist', {
    name: '無政府主義', alt: 'アナキズム', full: '無政府主義（アナキズム）', kana: 'むせいふしゅぎ', short: '国家のない自由な社会',
    axes: AX(-0.4, -1.0, -0.6, -0.6, 0.3, 0.7, -0.1),
    summary: '国家や支配のしくみをなくし、\n人々の自由な助け合いで社会を\nつくろうとする考え。',
    ideas: ['国家・警察・軍隊などの強制をなくす', '自発的な協力と相互扶助（そうごふじょ）', '小さな共同体の自治', '平和的な流れと、暴力を認めた流れがあった'],
    history: ['1840年 プルードンが『財産とは何か』で', '　自らアナキストと名のる', '1890年代〜1901年 一部が要人を暗殺', '　（仏大統領、米大統領など）', '1910〜11年 日本の大逆事件で12人が処刑', '　（大半は計画と無関係だったとされる）', '1936年 スペイン内戦中に自主管理の試み'],
    record: ['国家のない社会が長く続いた例はない', 'スペインの自主管理は内戦の中で消えた', '暗殺などの暴力は多くの命を奪い、弾圧を強めた'],
    pro: ['権力による抑圧や戦争への強い批判', '人々の自発的な協力の力を信じる'],
    con: ['治安や大きな事業をだれが担うのか不明', '力の空白を別の支配者が奪う危険'],
    related: ['anarcho_communism', 'libertarianism', 'communitarianism'],
    sources: [
      S('Pierre-Joseph Proudhon (New World Encyclopedia)', 'https://www.newworldencyclopedia.org/entry/Pierre-Joseph_Proudhon'),
      S('Story of an Eyewitness: anarchist assassinations (Encyclopedia.com)', 'https://www.encyclopedia.com/politics/energy-government-and-defense-magazines/story-eyewitness'),
      S('High Treason Incident (Wikipedia)', 'https://en.wikipedia.org/wiki/High_Treason_Incident'),
    ],
  }),
  environmentalism: entry('environmentalism', 'movement', {
    name: '環境主義', kana: 'かんきょうしゅぎ', short: '自然と将来の世代を守る',
    axes: AX(-0.4, -0.2, -0.3, -0.5, 1.0, 0.2, -0.3),
    summary: '自然や地球環境を守ることを重んじ、\n将来の世代に住みよい地球を残そうとする。',
    ideas: ['公害や気候変動を防ぐ', '資源を使いすぎない社会', '国境をこえた協力が必要', '成長の中身を問い直す'],
    history: ['1962年 カーソンが『沈黙の春』で農薬の害を警告', '1967年 日本で公害対策基本法', '1971年 日本で環境庁が発足', '1972年 ストックホルムで国連人間環境会議', '1987年 オゾン層を守るモントリオール議定書'],
    record: ['公害規制で空気や水がきれいになった地域が多い', '2023年 国連の報告「オゾン層は回復に向かっている」', '規制やエネルギー転換の費用が重いとの声もある', '対策の速さをめぐり、国や世代で意見が分かれる'],
    pro: ['健康と自然、将来の世代を守れる', '新しい産業や技術を生む'],
    con: ['仕事や生活のコストが上がることがある', '経済成長をおさえすぎるとの批判'],
    related: ['progressivism', 'communitarianism', 'primitive_communism'],
    sources: [
      S('環境省 ecojin’s eye（環境行政の歩み）', 'https://www.env.go.jp/guide/info/ecojin/eye/20260916.html'),
      S('Sustainable development timeline (IISD)', 'https://enb.iisd.org/email/mea-l/guestarticle84.html'),
      S('Ozone layer recovery is on track (UN News, 2023)', 'https://news.un.org/en/node/1132277'),
    ],
  }),
  populism: entry('populism', 'populist', {
    name: '大衆主義', alt: 'ポピュリズム', full: '大衆主義（ポピュリズム）', kana: 'たいしゅうしゅぎ', short: '「民衆」対「エリート」',
    axes: AX(-0.2, 0.3, 0.4, 0.6, -0.3, -0.2, -0.2),
    summary: '社会を「ふつうの人々」と「エリート」の\n対立として描き、人々の声の代弁者を\n名のる政治の考え方。',
    ideas: ['政治家・官僚・大企業などへの不信', '多数派の意思をすぐ政治に反映させる', '右にも左にも結びつく「薄い」思想とされる', 'カリスマ的な指導者が中心になりやすい'],
    history: ['1870年代 ロシアのナロードニキが農村へ', '1892年 米国の人民党がオマハ綱領', '1946年 アルゼンチンでペロンが大統領に', '2010年代 各国で大衆主義的な政党が伸びる'],
    record: ['見過ごされてきた人々の不満を政治にのせた', '裁判所や報道を「敵」として攻撃した例がある', '社会の分断を深めるとの指摘もある'],
    pro: ['エリートだけの政治を正せる', '政治に関心のなかった人を引きつける'],
    con: ['複雑な問題を単純にしすぎる', '少数派の権利や権力分立が軽く見られやすい'],
    related: ['democracy', 'authoritarianism', 'separatism'],
    sources: [
      S('What is populism? (C-REX, University of Oslo)', 'https://www.sv.uio.no/c-rex/english/resources/key-consepts-and-questions/what-is-populism.html'),
      S('Omaha Platform (Wikipedia)', 'https://en.wikipedia.org/wiki/Omaha_Platform'),
    ],
  }),
  republicanism: entry('republicanism', 'democratic', {
    name: '共和主義', kana: 'きょうわしゅぎ', short: '君主のいない市民の国',
    axes: AX(0.1, -0.3, 0, 0, 0, -0.5, 0.1),
    summary: '国は王のものではなく、市民みんなの\nもの（公共のもの）だと考え、\n選ばれた代表と法で国を治める。',
    ideas: ['世襲の君主に政治の権力をもたせない', '法の支配と権力の分立', '市民の徳と公共への参加', '独裁の防止'],
    history: ['紀元前509年 ローマが王を追放（伝承）', '1776年 米国が独立を宣言', '1792年 フランスが共和政を宣言', '1793〜94年 フランスで恐怖政治'],
    record: ['多くの国が共和制の憲法をもつようになった', 'フランスの恐怖政治では約1万7千人が正式に処刑', '共和制の名のもとで独裁が行われた国もある'],
    pro: ['生まれではなく選挙で指導者が決まる', '権力の集中を防ぐしくみを重んじる'],
    con: ['「共和制」でも独裁になる例がある', '理想の「市民の徳」は現実には難しい'],
    related: ['democracy', 'progressivism'],
    sources: [
      S('Reign of Terror (Encyclopaedia Britannica)', 'https://www.britannica.com/event/Reign-of-Terror'),
      S('Reign of Terror timeline (World History Encyclopedia)', 'https://worldhistory.org/timeline/Reign_of_Terror'),
    ],
  }),
  progressivism: entry('progressivism', 'movement', {
    name: '進歩主義', kana: 'しんぽしゅぎ', short: '改革で社会をよくする',
    axes: AX(-0.4, -0.2, -0.8, -0.5, 0.5, 0, 0.4),
    summary: '科学や改革によって社会の問題を解決し、\nよりよい社会へ進めると考える。',
    ideas: ['政府の改革で弱い立場の人を守る', '独占や腐敗を規制する', '人権や多様性を広げる', '科学の知識を政策に生かす'],
    history: ['1890年代〜1920年代 米国の「革新主義の時代」', '1906年 米国で食品・薬品の安全の法律', '1920年 米国で女性参政権'],
    record: ['食品の安全や独占の規制などを実現した', '当時の進歩派の一部は優生学を支持した', '米国では1907年から強制断種の州法が広がり、', '　約7万人が断種された'],
    pro: ['社会の問題に積極的に取り組む', '弱い立場の人の権利を広げてきた'],
    con: ['「進歩」の名で行きすぎた政策が行われた', '伝統や地域の事情を軽く見がち'],
    related: ['socialism', 'feminism', 'environmentalism', 'transhumanism'],
    sources: [
      S('The Progressive Era: Eugenics (Teaching American History)', 'https://teachingamericanhistory.org/document/chapter-19-the-progressive-era-eugenics/'),
      S('Buck v. Bell (1927) (Encyclopedia Virginia)', 'https://encyclopediavirginia.org/entries/buck-v-bell-1927/'),
    ],
  }),
  imperialism: entry('imperialism', 'national', {
    name: '帝国主義', kana: 'ていこくしゅぎ', short: '他国・他地域の支配',
    axes: AX(0.4, 0.7, 0.5, 1.0, -0.7, -0.9, 0.2),
    summary: '強い国が軍事力や経済力で、ほかの\n国や地域を支配し、領土や影響力を\n広げようとする考え。',
    ideas: ['植民地や勢力圏を広げる', '資源・市場・兵力を確保する', '「文明化」などの理由づけが使われた'],
    history: ['1884〜85年 ベルリン会議、アフリカ分割', '1885〜1908年 コンゴ自由国で強制労働', '1910年 日本が韓国を併合', '1960年 国連が植民地独立付与宣言', '　この年アフリカで17か国が独立'],
    record: ['鉄道などが作られたが、多くは支配する側のため', 'コンゴ自由国では強制労働などで人口が大きく減った', '　（推計120万〜1000万人）', '植民地支配は戦争や差別、深い恨みを生んだ', '第二次大戦後、多くの植民地が独立した'],
    pro: ['（当時の支持者）国の安全と豊かさに必要と主張', '（当時の支持者）近代的な制度を広めると主張'],
    con: ['他の民族の自由と命をうばう', '戦争と差別を生み、恨みが長く残る'],
    related: ['authoritarianism', 'capitalism', 'fascism'],
    sources: [
      S('Atrocities in the Congo Free State (Wikipedia)', 'https://en.wikipedia.org/wiki/Atrocities_in_the_Congo_Free_State'),
      S('Declaration on the Granting of Independence to Colonial Countries and Peoples (UN Digital Library)', 'https://digitallibrary.un.org/record/206145'),
      S('Year of Africa (Wikipedia)', 'https://en.wikipedia.org/wiki/Year_of_Africa'),
    ],
  }),
  egalitarianism: entry('egalitarianism', 'socialist', {
    name: '平等主義', kana: 'びょうどうしゅぎ', short: 'すべての人は平等',
    axes: AX(-0.8, -0.4, -0.6, -0.3, 0.1, -0.1, -0.1),
    summary: 'すべての人は等しい価値と権利をもつと考え、\n身分・財産・性別などによる差を\nなくそうとする。',
    ideas: ['法の下の平等', '機会の平等（スタートをそろえる）', '結果の平等をどこまで求めるかで立場が分かれる', '身分や差別の解消'],
    history: ['1647年 英国のレベラーズが', '　平等な選挙権を主張（パトニー討論）', '1789年 フランス人権宣言', '1948年 国連の世界人権宣言', '1971年 ロールズが『正義論』'],
    record: ['身分制の廃止や普通選挙の実現に大きな役割', '差別をなくす法律が各国で生まれた', '結果の平等を力で押しつけた体制では、', '　自由が失われた'],
    pro: ['だれもが尊重される公正な社会になる', '生まれによる不公平を小さくする'],
    con: ['努力や能力の差を無視するとの批判', '平等を強制すると自由が損なわれる'],
    related: ['socialism', 'feminism', 'democracy'],
    sources: [
      S('Putney Debates (Wikipedia)', 'https://en.wikipedia.org/wiki/Putney_Debates'),
      S('Universal Declaration of Human Rights (United Nations)', 'https://www.un.org/en/about-us/universal-declaration-of-human-rights'),
      S('Robert Nozick (IEP; on Rawls’s A Theory of Justice, 1971)', 'https://iep.utm.edu/nozick'),
    ],
  }),
  transhumanism: entry('transhumanism', 'future', {
    name: '超人間主義', alt: 'トランスヒューマニズム', full: '超人間主義（トランスヒューマニズム）', kana: 'ちょうにんげんしゅぎ', short: '技術で人間をこえる',
    axes: AX(0.2, -0.3, -0.5, -0.3, -0.1, 0, 1.0),
    summary: '科学技術で病気や老化をのりこえ、\n人間の体や知能を高めていこうとする考え。',
    ideas: ['医療・遺伝子・AIで能力を高める', '寿命をのばし、老化を克服する', '技術を使うかは本人が選ぶ', 'リスクと倫理の議論を重んじる'],
    history: ['1957年 生物学者J・ハクスリーが', '　「トランスヒューマニズム」の語を広める', '1998年 世界トランスヒューマニスト協会', '2000年代 遺伝子編集やAIで議論が広がる'],
    record: ['国の体制として実行された例はない', '医療技術の進歩をめぐる議論に影響している', '「人間の改良」は過去の優生学と重なるとの警告'],
    pro: ['病気や障害、老いの苦しみを減らせる', '人間の可能性を広げる'],
    con: ['お金のある人だけが強くなり格差が広がる', '人間らしさや生命の倫理がゆらぐ'],
    related: ['progressivism', 'libertarianism', 'posadism'],
    sources: [
      S('Julian Huxley and Transhumanism', 'https://www.huxley.net/transhumanism/'),
      S('History of “transhumanism” (academia.edu)', 'https://www.academia.edu/13997038'),
    ],
  }),
  communitarianism: entry('communitarianism', 'centrist', {
    name: '共同体主義', alt: 'コミュニタリアニズム', full: '共同体主義（コミュニタリアニズム）', kana: 'きょうどうたいしゅぎ', short: '地域や共同体のきずな',
    axes: AX(-0.2, 0.1, 0.6, -0.1, 0.3, 0.4, -0.4),
    summary: '人は家族や地域などの共同体の中で育つと考え、\n個人の権利だけでなく、\n共通の善や責任を重んじる。',
    ideas: ['個人は共同体の中で形づくられる', '権利と責任のバランス', '地域・家族・ボランティアの力', '共通の価値観を育てる'],
    history: ['1971年 ロールズ『正義論』が個人の権利を', '　中心にした正義論を示す', '1980年代 その個人観への批判が', '　「共同体主義」と呼ばれる', '1990年代 地域の責任を重んじる運動へ'],
    record: ['地域づくりやボランティア政策に影響した', '同調圧力や少数者の排除につながるとの批判'],
    pro: ['孤立を防ぎ、支え合いの社会をつくる', '権利だけでなく責任も考えられる'],
    con: ['多数派の価値観を押しつけるおそれ', '個人の自由が制限されやすい'],
    related: ['conservatism', 'environmentalism', 'separatism'],
    sources: [
      S('Liberalism and community: Communitarian criticisms of Rawls (Univ. of Illinois)', 'https://www.ideals.illinois.edu/items/20717'),
    ],
  }),
  authoritarianism: entry('authoritarianism', 'authoritarian', {
    name: '権威主義', kana: 'けんいしゅぎ', short: '指導者への権力集中',
    axes: AX(0.1, 0.9, 0.6, 0.5, -0.4, -0.7, 0),
    summary: '強い指導者や少数の集団に権力を集め、\n選挙や言論の自由を制限して国を\n治める考えと体制。',
    ideas: ['政治の競争を限る（限られた多元主義）', '秩序と安定を最優先にする', '反対派や報道をおさえる', '全体主義ほど人の内面までは支配しない'],
    history: ['1939〜75年 スペインのフランコ体制', '1964年 政治学者リンスが権威主義体制を定義', '1973〜90年 チリの軍事政権', '1987年 韓国が民主化、台湾が戒厳令を解除'],
    record: ['急速な経済成長をとげた国もある（開発独裁）', 'チリの軍事政権では3000人以上が殺害・行方不明', '　数万人が政治犯として拘束され、多くが拷問を受けた', '多くの国で政治犯の投獄や検閲が行われた', '1970年代から多くの国が民主化した（民主化の波）'],
    pro: ['（支持者）混乱を防ぎ、すばやく決められる', '（支持者）経済発展に集中できる'],
    con: ['権力の乱用を止められない', '人権侵害や腐敗が隠される'],
    related: ['fascism', 'imperialism', 'populism', 'deng_theory'],
    sources: [
      S('Authoritarian regimes (SAGE International Encyclopedia of Political Science)', 'https://sk.sagepub.com/ency/edvol/embed/intlpoliticalscience/chpt/authoritarian-regimes'),
      S('Rettig Report (Wikipedia)', 'https://en.wikipedia.org/wiki/Rettig_Report'),
      S('Valech Report (Wikipedia)', 'https://en.wikipedia.org/wiki/Valech_Report'),
    ],
  }),
  fascism: entry('fascism', 'totalitarian', {
    name: 'ファシズム', kana: 'ふぁしずむ', short: '独裁と極端な国家主義', selectable: false, note: NOT_SELECTABLE,
    axes: AX(0.1, 1.0, 0.9, 1.0, -0.6, -1.0, 0.1),
    summary: '1920年代のイタリアで生まれた独裁の\n思想と運動。自由と民主主義を否定し、\n暴力と侵略戦争で多くの犠牲を生んだ。',
    ideas: ['指導者と国家への絶対の服従を求めた', '議会・野党・自由な報道を否定した', '暴力を肯定し、軍国主義をとった', '国家が経済や労働組合も統制した'],
    history: ['1919年 ミラノで「戦闘ファッショ」結成', '1922年 「ローマ進軍」、ムッソリーニが首相に', '1924年 批判した議員マッテオッティが殺害', '1935〜36年 エチオピアを侵略', '1938年 人種法でユダヤ人を差別'],
    record: ['野党・労働組合・自由な報道がつぶされた', 'エチオピア侵略では毒ガスを使った', 'ナチス・ドイツと同盟し第二次世界大戦へ', '1945年 指導者は処刑され、遺体はミラノの', '　広場で逆さに吊るされた', '戦後のイタリア憲法はファシスト党の再建を禁じた'],
    pro: ['（当時の宣伝）「国の再生」と「秩序」を', '　かかげて支持を集めた'],
    con: ['自由と人権を否定し、暴力で反対者をおさえた', '侵略戦争で多くの国と人々に被害を与えた', '人種差別の法律をつくった'],
    related: ['nazism', 'authoritarianism', 'imperialism', 'corporatism'],
    sources: [
      S('Manifesto of Race (Wikipedia)', 'https://en.wikipedia.org/wiki/Manifesto_of_Race'),
      S('Second Italo-Ethiopian War (Wikipedia)', 'https://en.wikipedia.org/wiki/Second_Italo-Ethiopian_War'),
      S('The use of chemical weapons in the 1935–36 Italo-Ethiopian War (SIPRI)', 'https://www.sipri.org/sites/default/files/Italo-Ethiopian-war.pdf'),
      S('Benito Mussolini (Larousse)', 'https://www.larousse.fr/dictionnaires/college/Benito_Mussolini/27189'),
    ],
  }),
  nazism: entry('nazism', 'totalitarian', {
    name: 'ナチズム', kana: 'なちずむ', short: '人種差別と独裁', selectable: false, note: NOT_SELECTABLE,
    axes: AX(0, 1.0, 1.0, 1.0, -0.4, -1.0, 0.3),
    summary: 'ヒトラーが率いたナチ党の思想。\n人種差別と独裁で、ホロコーストと\n侵略戦争を引き起こした。',
    ideas: ['人種差別（反ユダヤ主義）を国の中心に置いた', '指導者への絶対服従と一党独裁', '侵略による領土の拡大', '言論・芸術・教育の全面的な統制'],
    history: ['1920年 ナチ党が党名を名のる', '1933年1月 ヒトラーが首相に。', '　3月 全権委任法（政府だけで法律をつくれる法）', '1935年 ニュルンベルク法でユダヤ人を差別', '1938年11月 「水晶の夜」の迫害（はくがい）', '1939年 ポーランド侵攻、第二次世界大戦'],
    record: ['ホロコーストで約600万人のユダヤ人が殺害された', 'ロマ、障害のある人、政治犯なども迫害・殺害', '障害者を殺害した「T4作戦」（1939〜41年）', '　では少なくとも7万人が殺された', '1945年 敗戦。ニュルンベルク裁判で指導者が裁かれた', '戦後のドイツではナチスの象徴の使用を禁止'],
    pro: ['（当時の宣伝）不況と敗戦からの', '　「復活」を約束して支持を集めた'],
    con: ['人種差別にもとづく大量虐殺を行った', '侵略戦争で数千万人が犠牲になった', '自由・人権・法の支配を完全に否定した'],
    related: ['fascism', 'authoritarianism', 'imperialism'],
    sources: [
      S('Learn about the Holocaust (United States Holocaust Memorial Museum)', 'https://www.ushmm.org/learn/holocaust'),
      S('Nazi “Euthanasia” Program (USHMM Holocaust Encyclopedia)', 'https://encyclopedia.ushmm.org/content/en/article/euthanasia-program'),
      S('Holocaust timeline (HDOT)', 'https://www.hdot.org/holocaust_tl/'),
    ],
  }),
  democracy: entry('democracy', 'democratic', {
    name: '民主主義', kana: 'みんしゅしゅぎ', short: '国民が主人公の政治',
    axes: AX(0, -0.6, -0.1, -0.3, 0.1, 0, 0.1),
    summary: '国の主人公は国民だと考え、選挙と\n話し合い、多数決と少数者の尊重で\n政治を決めていく考えとしくみ。',
    ideas: ['国民主権と自由な選挙', '言論・集会・報道の自由', '多数決と少数者の権利の尊重', '権力の分立と法の支配'],
    history: ['紀元前508年ごろ アテネでクレイステネスの改革', '1689年 英国の権利章典', '1893年 ニュージーランドで女性も投票', '1947年 日本国憲法が施行（国民主権）'],
    record: ['政権を平和的に交代させるしくみを広げた', '一方、アテネの民主政はソクラテスに', '　死刑を下した（前399年）', '1933年のドイツのように、選挙を経て', '　独裁が生まれた例もある'],
    pro: ['政権を選挙で平和的に変えられる', '多くの人の意見で間違いを正しやすい'],
    con: ['決めるのに時間がかかる', '多数派が少数派をおさえる「多数の専制」の危険'],
    related: ['republicanism', 'moderatism', 'egalitarianism'],
    sources: [
      S('Cleisthenes of Athens (Encyclopaedia Britannica)', 'https://www.britannica.com/print/article/120922'),
      S('Athenian Law Timeline (Harvard CHS)', 'https://chs.harvard.edu/discussion-series-athenian-law-lectures-16/'),
      S('日本国憲法の誕生（国立国会図書館）', 'https://www.ndl.go.jp/constitution/'),
    ],
  }),
};
export const IDEOLOGY_ORDER = ['conservatism', 'moderatism', 'capitalism', 'socialism', 'unionism', 'corporatism', 'libertarianism', 'separatism', 'communism', 'feminism', 'anarchism',
  'environmentalism', 'populism', 'republicanism', 'progressivism', 'imperialism', 'egalitarianism', 'transhumanism', 'communitarianism', 'authoritarianism', 'fascism', 'nazism', 'democracy'];

// ================================================================ schools of communism (16)
const school = (id, o) => entry(id, 'communism', o);
export const COMMUNISM_SCHOOLS = {
  marxism: school('marxism', {
    name: 'マルクス主義', kana: 'まるくすしゅぎ', short: '階級闘争と史的唯物論',
    axes: AX(-1.0, 0.2, -0.6, -0.7, -0.2, -0.3, 0.3),
    summary: 'マルクスとエンゲルスの思想。\n歴史は階級の争いで動き、資本主義は\nやがて社会主義に変わると考えた。',
    ideas: ['経済のしくみが社会の土台（史的唯物論・してきゆいぶつろん）', '資本家と労働者の階級闘争', '労働者が生む価値の一部を資本家が得る', '万国の労働者の団結'],
    history: ['1848年 『共産党宣言』', '1867年 『資本論』第1巻', '1883年 マルクスが死去', '1889年 第二インターナショナルの理論に'],
    record: ['多くの社会主義・共産主義政党の土台になった', '先進国で労働者革命が起きるという予想は、', '　そのとおりにはならなかった', 'その名のもとで一党独裁の国家がつくられた'],
    pro: ['格差や恐慌（きょうこう）など資本主義の問題を分析した', '経済学や社会学に大きな影響を与えた'],
    con: ['予測の多くが外れたと批判される', '労働価値説は今の経済学では主流でない'],
    related: ['leninism', 'luxemburgism', 'eurocommunism'],
    sources: [
      S('Second International (Wikipedia)', 'https://en.wikipedia.org/wiki/Second_International'),
      S('Marxism (Encyclopaedia Britannica)', 'https://www.britannica.com/topic/Marxism'),
    ],
  }),
  leninism: school('leninism', {
    name: 'レーニン主義', kana: 'れーにんしゅぎ', short: '前衛党が革命を導く',
    axes: AX(-1.0, 0.7, -0.5, -0.6, -0.3, -0.5, 0.3),
    summary: 'レーニンがマルクス主義を発展させた思想。\n職業革命家の党「前衛党（ぜんえいとう）」が\n革命を指導すべきだと考えた。',
    ideas: ['前衛党が労働者を導く', 'プロレタリアート独裁', '帝国主義は資本主義の最終段階', '民主集中制（党の決定には全員が従う）'],
    history: ['1902年 『何をなすべきか』で前衛党論', '1917年 十月革命でボリシェヴィキが政権', '1918年1月 憲法制定議会を解散', '1921年 新経済政策（ネップ）', '1924年 レーニンが死去'],
    record: ['世界で初めての社会主義国家をつくった', '反対派への「赤色テロル」と秘密警察', '1921年 クロンシュタットの反乱を武力で鎮圧（ちんあつ）', '一党独裁の型が各国の共産党に広がった'],
    pro: ['革命を実際に成功させた組織論', '帝国主義と植民地支配を批判した'],
    con: ['選挙と多党制を否定し、独裁を生んだ', '党の指導者に権力が集中した'],
    related: ['marxism', 'stalinism', 'trotskyism'],
    sources: [
      S('What Is to Be Done? (Encyclopaedia Britannica)', 'https://britannica.com/topic/What-Is-to-Be-Done-work-by-Lenin'),
      S('Lenin: Timeline (Marxists Internet Archive)', 'https://www.marxists.org/archive/lenin/bio/timeline.htm'),
      S('Kronstadt rebellion (Wikipedia)', 'https://en.wikipedia.org/wiki/Kronstadt_rebellion'),
    ],
  }),
  stalinism: school('stalinism', {
    name: 'スターリン主義', kana: 'すたーりんしゅぎ', short: '一国社会主義と恐怖政治',
    axes: AX(-1.0, 1.0, 0.1, 0.3, -0.8, -0.9, 0.3),
    summary: 'スターリンが1920年代末〜1953年に\nソ連で行った政治のやり方。\n個人崇拝（すうはい）と恐怖の支配で知られる。',
    ideas: ['一国社会主義（まず自国で社会主義を）', '五か年計画による重工業化', '農業の強制的な集団化', '指導者の個人崇拝と秘密警察'],
    history: ['1924年 「一国社会主義」を唱える', '1928年 第1次五か年計画', '1937〜38年 大粛清（だいしゅくせい）', '1953年 スターリンが死去', '1956年 後継者がスターリンを批判'],
    record: ['短い期間で重工業化を進めた', '1932〜33年の大飢饉（ホロドモール）で、', '　ウクライナだけで推計350万〜500万人が死亡', '　（人口学の推計では約390万人）', '大粛清では公式記録で約68万人が銃殺（じゅうさつ）', '強制収容所（グラーグ）に延べ約1800万人'],
    pro: ['（支持者）農業国を短期間で工業国にした', '（支持者）ナチス・ドイツを打ち破った'],
    con: ['数百万人規模の死者を出した恐怖政治', '個人崇拝のため誤りを正せなかった'],
    related: ['leninism', 'maoism', 'hoxhaism', 'juche'],
    sources: [
      S('Holodomor (Encyclopaedia Britannica)', 'https://www.britannica.com/event/Holodomor'),
      S('Holodomor: death toll estimates (Wikipedia)', 'https://en.wikipedia.org/wiki/Holodomor'),
      S('Great Purge (Wikipedia)', 'https://en.wikipedia.org/wiki/Great_Purge'),
      S('Gulag (Wikipedia)', 'https://en.wikipedia.org/wiki/Gulag'),
      S('First five-year plan (Soviet Union) (Wikipedia)', 'https://en.wikipedia.org/wiki/First_five-year_plan_(Soviet_Union)'),
    ],
  }),
  trotskyism: school('trotskyism', {
    name: 'トロツキズム', kana: 'とろつきずむ', short: '永続革命と国際主義',
    axes: AX(-1.0, 0.4, -0.6, -1.0, -0.3, -0.4, 0.3),
    summary: 'トロツキーの思想。革命は一つの国では\n完成しないとして、世界各国での革命\n（永続革命）を唱えた。',
    ideas: ['永続革命論', 'スターリンの官僚的な支配への批判', '国際主義（第四インターナショナル）', '労働者の民主主義を主張'],
    history: ['1905〜06年 永続革命論をまとめる', '1917年 十月革命の指導者の一人', '1929年 ソ連から国外追放', '1938年 第四インターナショナル結成', '1940年 メキシコでソ連の秘密警察の工作員に暗殺'],
    record: ['国家の権力をにぎったことはない', '各国の小さな政党や運動に影響が続く', 'トロツキー自身も内戦期には反乱の鎮圧（ちんあつ）など', '　強い手段を使った'],
    pro: ['スターリン体制をいち早く批判した', '国境をこえた労働者の連帯を重んじる'],
    con: ['世界革命は現実的でないとの批判', '党派が細かく分裂しやすい'],
    related: ['leninism', 'posadism', 'marxism'],
    sources: [
      S('Trotskyism (Encyclopaedia Britannica)', 'https://www.britannica.com/topic/Trotskyism'),
      S('Left-wing opposition and the Fourth International (marx200.org)', 'https://marx200.org/en/marxismus-denkt-ein-zwei-viele-marx/left-wing-opposition-and-fourth-international-trotskyism'),
    ],
  }),
  maoism: school('maoism', {
    name: '毛沢東主義', kana: 'もうたくとうしゅぎ', short: '農民の革命と人民戦争',
    axes: AX(-0.9, 0.9, -0.7, 0.2, -0.5, -0.6, -0.4),
    summary: '毛沢東がマルクス・レーニン主義を\n中国の農村に合わせた思想。\n農民の革命と「人民戦争」を重んじた。',
    ideas: ['農民を革命の主力とする', '農村から都市を包囲する人民戦争', '大衆運動で社会を改造する', '党と指導者の権威'],
    history: ['1949年 中華人民共和国が成立', '1958〜62年 大躍進政策', '1966〜76年 文化大革命', '1981年 中国共産党が文化大革命を誤りと決議'],
    record: ['内戦に勝ち、統一国家をつくった', '大躍進の大飢饉で推計1500万〜5000万人が死亡', '　（研究によって幅がある）', '文化大革命で数十万〜200万人前後が死亡と推計', '　教育や文化財も大きく破壊された', '影響を受けた武装組織が各地で内戦を起こした'],
    pro: ['（支持者）農民を主役にし、外国の支配から独立した', '（支持者）識字や衛生の運動を広げた'],
    con: ['大衆運動の暴走で多くの命が失われた', '個人崇拝（すうはい）のため誤りが正されなかった'],
    related: ['stalinism', 'hoxhaism', 'deng_theory'],
    sources: [
      S('Great Leap Forward famine (EBSCO Research Starters)', 'https://www.ebsco.com/research-starters/history/great-leap-forward-famine'),
      S('Cultural Revolution (Wikipedia)', 'https://en.wikipedia.org/wiki/Cultural_Revolution'),
    ],
  }),
  hoxhaism: school('hoxhaism', {
    name: 'ホッジャ主義', kana: 'ほっじゃしゅぎ', short: '孤立と最も厳しい路線',
    axes: AX(-1.0, 1.0, -0.3, 0.8, -0.5, -0.8, -0.3),
    summary: 'アルバニアの指導者ホッジャの路線。\nソ連や中国も「修正主義（しゅうせいしゅぎ）」と\n批判し、国を孤立させて独自の道をとった。',
    ideas: ['スターリン路線の厳格な継承', 'ソ連・中国・ユーゴへの批判（反修正主義）', '自力更生と、鎖国に近い孤立', '宗教の全面禁止'],
    history: ['1944年 共産党政権が成立', '1948年 ユーゴスラビアと断絶', '1961年 ソ連と断絶し中国に接近', '1967年 「世界初の無神論国家」を宣言', '1978年 中国とも断絶。1985年 ホッジャ死去'],
    record: ['電化や識字率の向上が進んだとされる', '宗教施設の閉鎖や政治犯の強制収容', '侵攻に備えて約17万のトーチカを建設', '欧州でも特に貧しいまま、1990〜91年に体制が終わった'],
    pro: ['（支持者）大国に従わない独立をつらぬいた'],
    con: ['極端な孤立で人々の生活が貧しくなった', '信教・移動・言論の自由がなかった'],
    related: ['stalinism', 'maoism', 'juche'],
    sources: [
      S("People's Socialist Republic of Albania (Wikipedia)", 'https://en.wikipedia.org/wiki/People%27s_Socialist_Republic_of_Albania'),
      S('Communist Albania (1944-1991) (Albania Visit)', 'https://albaniavisit.com/sq/epokes-komuniste/'),
      S('When the ‘Dark Night’ for the Church of Albania Began (Pemptousia)', 'https://pemptousia.com/2019/11/when-the-dark-night-for-the-church-of-albania-began/'),
    ],
  }),
  luxemburgism: school('luxemburgism', {
    name: 'ルクセンブルク主義', kana: 'るくせんぶるくしゅぎ', short: '民主的な革命と自由',
    axes: AX(-0.9, -0.4, -0.6, -0.8, 0, -0.1, 0.1),
    summary: 'ローザ・ルクセンブルクの思想。\n労働者の自発的な運動を重んじ、\n革命の後も自由が必要だと説いた。',
    ideas: ['大衆の自発的な行動（大衆ストライキ）', '改良だけでは社会主義にならない', '少数の党による独裁への批判', '「自由とは、つねに異なる考えの者の自由」'],
    history: ['1899年 『社会改良か革命か』', '1916年 スパルタクス団の活動', '1918年 獄中でボリシェヴィキの独裁を批判', '1919年1月 ベルリンで殺害される'],
    record: ['国家の権力をにぎったことはない', '1919年 ベルリンの蜂起（ほうき）は鎮圧（ちんあつ）された', '民主的な社会主義の考えに影響を残した'],
    pro: ['革命と自由・民主主義の両立を説いた', '独裁への警告は先を見ていたと評価される'],
    con: ['自発性に頼りすぎ、組織が弱いとの批判', '具体的な国づくりの道筋は示されなかった'],
    related: ['marxism', 'libertarian_communism', 'eurocommunism'],
    sources: [
      S('Rosa Luxemburg (Encyclopaedia Britannica)', 'https://www.britannica.com/EBchecked/topic/352345'),
      S('Frequently Asked Questions about Rosa Luxemburg (Rosa-Luxemburg-Stiftung)', 'https://www.rosalux.de/en/foundation/historical-centre-for-democratic-socialism-1/rosa-luxemburg/frequently-asked-questions-about-rosa-luxemburg'),
      S('The Russian Revolution, 1918 (Marxists Internet Archive)', 'https://www.marxists.org/archive/luxemburg/1918/russian-revolution/'),
    ],
  }),
  anarcho_communism: school('anarcho_communism', {
    name: '無政府共産主義', kana: 'むせいふきょうさんしゅぎ', short: '国家もお金もない共有',
    axes: AX(-1.0, -1.0, -0.6, -0.7, 0.3, 0.7, 0),
    summary: '国家も貨幣もなくし、財産を\nみんなで共有して「必要に応じて」\n分け合う社会をめざす。',
    ideas: ['国家と資本主義の両方をなくす', '自由な共同体どうしの連合', '貨幣をなくし、必要に応じて分ける', '相互扶助（そうごふじょ）'],
    history: ['1892年 クロポトキンが『パンの略取』', '1918〜21年 ウクライナ南部のマフノ運動', '1936〜39年 スペイン内戦中に集産化（しゅうさんか）'],
    record: ['短い期間、農村や工場の自主管理が行われた', '強制的な集産化があったと指摘される地域もある', 'いずれも戦争の中で軍事的に滅ぼされた'],
    pro: ['支配も搾取（さくしゅ）もない社会を理想とする', '人々の協力の力を信じる'],
    con: ['大きな社会を調整する方法が不明確', '外からの攻撃に弱い'],
    related: ['anarchism', 'libertarian_communism', 'primitive_communism'],
    sources: [
      S('The Conquest of Bread (Wikidata / inventaire)', 'https://inventaire.io/entity/wd:Q3141640'),
      S('Ukraine 1918-21 and Spain 1936-39 (D. A. Collins, Anarchist Library)', 'https://theanarchistlibrary.org/library/daniel-a-collins-ukraine-1918-21-and-spain-1936-39.html'),
      S('Free Territory and Revolutionary Catalonia (Bucknell thesis)', 'https://digitalcommons.bucknell.edu/honors_theses/553/'),
    ],
  }),
  primitive_communism: school('primitive_communism', {
    name: '原始共産主義', kana: 'げんしきょうさんしゅぎ', short: '狩猟採集の分け合い',
    axes: AX(-0.8, -0.7, 0.3, -0.2, 0.8, 0.6, -1.0),
    summary: '国家や私有財産が生まれる前の\n狩猟採集の社会では、食べ物などを\n分け合っていたとする学説。',
    ideas: ['獲物や食料を集団で分け合う', '階級や国家がない', 'マルクス主義の歴史観で最初の段階とされた'],
    history: ['1877年 人類学者モーガンが『古代社会』', '1884年 エンゲルスが', '　『家族・私有財産・国家の起源』', '20世紀 狩猟採集社会の研究が進む'],
    record: ['政治体制として実行されたことはない', '多くの狩猟採集社会で分配の習慣が見られる', '争いや不平等があった社会も多く、', '　昔を理想化しすぎとの批判がある'],
    pro: ['人は本来分け合う生き物だと示す', '私有財産が当たり前でないと気づかせる'],
    con: ['小さな集団の話で、今の社会に当てはめにくい', '昔を美化しすぎているとの批判'],
    related: ['anarcho_communism', 'environmentalism', 'marxism'],
    sources: [
      S('The Origin of the Family, Private Property and the State (Wikipedia)', 'https://en.wikipedia.org/wiki/The_Origin_of_the_Family,_Private_Property_and_the_State'),
      S('Engels, The Origin of the Family (Project Gutenberg)', 'https://gutenberg.org/ebooks/33111'),
    ],
  }),
  juche: school('juche', {
    name: 'ジュチェ思想', alt: '主体思想', full: 'ジュチェ思想（主体思想）', kana: 'じゅちぇしそう', short: '「自主」と指導者への忠誠',
    axes: AX(-0.9, 1.0, 0.7, 1.0, -0.4, -1.0, -0.1),
    summary: '北朝鮮の公式の思想。「自主・自立・\n自衛」をかかげるが、実際は指導者\n一家への絶対的な忠誠を求める。',
    ideas: ['思想の自主、経済の自立、国防の自衛', '指導者「首領（しゅりょう）」が人民を導くとする', '軍事を最優先する路線', '世襲による権力の継承'],
    history: ['1955年 金日成が演説で「主体」を強調', '1972年 憲法に公式の思想として記す', '1994年 金日成が死去、権力は子へ世襲', '1990年代半ば 大飢饉'],
    record: ['1990年代の飢饉で推計数十万〜100万人前後が死亡', '国連の調査委員会（2014年）が', '　「人道に対する罪」を認定', '政治犯収容所、移動や言論の自由の欠如', '2002年 日本人の拉致を認めた（政府認定の被害者17人）', '2006年から 核・ミサイル開発で国連安保理が制裁'],
    pro: ['（公式の主張）大国から自立した国づくり'],
    con: ['世襲の独裁と個人崇拝（すうはい）', '深刻な人権侵害と経済の困窮'],
    related: ['stalinism', 'hoxhaism', 'authoritarianism'],
    sources: [
      S('1990s North Korean famine (Wikipedia)', 'https://en.wikipedia.org/wiki/1990s_North_Korean_famine'),
      S('UN Security Council Resolution 1718 (2006) (Wikipedia)', 'https://en.wikipedia.org/wiki/United_Nations_Security_Council_Resolution_1718'),
      S('The Juche Factor: North Korea’s Political Ideology and Human Rights (Pacific Forum)', 'https://pacforum.org/publications/issues-insights-vol-16-no-7-the-juche-factor-north-koreas-political-ideology-and-human-rights-reform/'),
      S('Re-Evaluating Kim Il Sung’s “Juche Speech” of 1955 (Acta Koreana)', 'https://actakoreana.org/digital-library/55621'),
      S('北朝鮮による日本人拉致問題（外務省）', 'https://www.mofa.go.jp/mofaj/a_o/na/kp/page1w_000082.html'),
    ],
  }),
  titoism: school('titoism', {
    name: 'チトー主義', kana: 'ちとーしゅぎ', short: '自主管理と非同盟',
    axes: AX(-0.5, 0.4, -0.3, -0.4, -0.3, 0.3, 0.1),
    summary: 'ユーゴスラビアの指導者チトーの路線。\nソ連から独立した社会主義で、労働者の\n自主管理と非同盟の外交をとった。',
    ideas: ['ソ連に従わない独自の社会主義', '労働者の自主管理と市場の一部活用', '東西どちらにも属さない非同盟', '多民族の連邦'],
    history: ['1948年 ソ連と対立し、コミンフォルムから除名', '1950年 労働者の自主管理を導入', '1961年 ベオグラードで非同盟諸国首脳会議', '1980年 チトーが死去', '1991年 連邦が解体し、内戦へ'],
    record: ['東側の国としては旅行や文化が比較的自由だった', '親ソ派など1万人以上をゴリ・オトク島などの', '　収容所に送った', '1980年代に対外債務とインフレが深刻になった', '1991年からの連邦の解体で、激しい民族紛争'],
    pro: ['大国から独立した外交をつらぬいた', '労働者が経営に参加するしくみを試した'],
    con: ['一党支配と政治犯の弾圧は続いた', '指導者に頼り、死後の体制が不安定になった'],
    related: ['eurocommunism', 'stalinism', 'separatism'],
    sources: [
      S('The Tito-Stalin Split and the Years of Cominform (Mašina)', 'https://www.masina.rs/eng/tito-stalin-split-years-cominform-part/'),
      S("Tito's Gulag: A History of the Prison Island of Goli Otok (Stanford UP)", 'https://www.sup.org/books/history/titos-gulag'),
    ],
  }),
  posadism: school('posadism', {
    name: 'ポサディズム', kana: 'ぽさでぃずむ', short: '核戦争と宇宙人を論じた少数派',
    axes: AX(-1.0, 0.5, -0.5, -0.9, -0.3, -0.5, 1.0),
    summary: 'アルゼンチンのポサダスが率いた\nトロツキズムの小さな一派。核戦争や\n宇宙人をめぐる独特の主張で知られる。',
    ideas: ['トロツキズムの世界革命論', '核戦争が資本主義を終わらせると主張した', '高度な宇宙人は社会主義者だと論じた'],
    history: ['1962年 ポサダスが自らの国際組織を結成', '1968年 宇宙人と社会主義についての論文', '1981年 ポサダスが死去', '2010年代 ネット上で知られるようになる'],
    record: ['国家の権力をにぎったことはない', '中南米などの小さな党派にとどまった', '核戦争を肯定する主張は強く批判された'],
    pro: ['（支持者）世界規模の変革を大胆に構想した'],
    con: ['核戦争の肯定は人命を無視している', '科学的な根拠のない主張が多い'],
    related: ['trotskyism', 'transhumanism'],
    sources: [
      S('Fourth International–Posadist (Wikipedia)', 'https://en.wikipedia.org/wiki/Fourth_International%E2%80%93Posadist'),
      S('J. Posadas (Wikipedia)', 'https://en.wikipedia.org/wiki/J._Posadas'),
      S('Posadism: The Rise and Fall of Apocalypse Communism (The Nation)', 'https://www.thenation.com/article/world/am-gittlitz-interview-posadism/'),
    ],
  }),
  eurocommunism: school('eurocommunism', {
    name: 'ユーロコミュニズム', kana: 'ゆーろこみゅにずむ', short: '議会制民主主義を認めた共産党',
    axes: AX(-0.6, -0.4, -0.5, -0.4, 0.1, -0.1, 0.1),
    summary: '1970年代、西ヨーロッパの共産党が\nソ連から距離をおき、複数政党制と\n議会制民主主義を受け入れた路線。',
    ideas: ['選挙と議会を通じた改革', '複数政党制と言論の自由の尊重', 'ソ連からの自立', '他党との協力（イタリアの「歴史的妥協」）'],
    history: ['1973年 イタリア共産党が「歴史的妥協」', '1976年 イタリア総選挙で共産党が3割超', '1977年 伊・西・仏の共産党がマドリードで会談', '1991年 イタリア共産党が解党し新党へ'],
    record: ['地方自治体の運営に加わった例が多い', '国の政権に入ることはほとんどなかった', 'ソ連側からも、反共の側からも批判された'],
    pro: ['民主主義と社会主義の両立をめざした', '暴力革命を否定した'],
    con: ['共産主義の看板と議会政治の間で中途半端', '支持を広げられず、多くは衰退した'],
    related: ['luxemburgism', 'socialism', 'titoism'],
    sources: [
      S('Historic Compromise (Wikipedia)', 'https://en.wikipedia.org/wiki/Historic_Compromise'),
      S('Eurocommunisme (Larousse)', 'https://www.larousse.fr/encyclopedie/divers/eurocommunisme/50039'),
      S('Berlinguer: le compromis historique et l’eurocommunisme (Universalis)', 'https://www.universalis.fr/encyclopedie/enrico-berlinguer/2-le-compromis-historique-et-l-eurocommunisme/'),
    ],
  }),
  libertarian_communism: school('libertarian_communism', {
    name: '自由共産主義', alt: 'リバタリアン共産主義', full: '自由共産主義（リバタリアン共産主義）', kana: 'じゆうきょうさんしゅぎ', short: '党ではなく評議会で',
    axes: AX(-0.9, -0.8, -0.6, -0.7, 0.2, 0.3, 0.2),
    summary: '国家や党の独裁をしりぞけ、働く人の\n評議会（ソビエト）による自主管理で\n共産主義をめざす考え。',
    ideas: ['労働者評議会による自主管理', '党の独裁への批判', '下からの民主主義', '評議会共産主義などの流れを含む'],
    history: ['1918年 ドイツ革命で労働者・兵士評議会', '1921年 クロンシュタットの水兵が反乱', '1920〜40年代 パンネクークらの評議会共産主義', '1956年 ハンガリー動乱で労働者評議会'],
    record: ['国全体で長く実行された例はない', 'クロンシュタットの反乱は1921年に赤軍が鎮圧（ちんあつ）', 'ハンガリー動乱はソ連軍に鎮圧され、', '　約2500人が死亡、約20万人が国外へ逃れた'],
    pro: ['独裁にならない共産主義を追求する', '働く人が自分たちで職場を決められる'],
    con: ['大きな社会をどう調整するかが不明確', '軍事的に弱く、鎮圧されてきた'],
    related: ['anarcho_communism', 'luxemburgism', 'anarchism'],
    sources: [
      S('Anton Pannekoek: Workers’ Councils (Marxists Internet Archive)', 'https://www.marxists.org/archive/pannekoe/1947/gik.htm'),
      S('Kronstadt rebellion (Wikipedia)', 'https://en.wikipedia.org/wiki/Kronstadt_rebellion'),
      S('Hungarian Revolution of 1956 (Wikipedia)', 'https://en.wikipedia.org/wiki/Hungarian_Revolution_of_1956'),
    ],
  }),
  cuban_socialism: school('cuban_socialism', {
    name: 'キューバ型社会主義', kana: 'きゅーばがたしゃかいしゅぎ', short: '医療・教育と一党制',
    axes: AX(-0.85, 0.8, -0.2, 0.4, 0.1, -0.6, -0.1),
    summary: '1959年のキューバ革命から生まれた\n社会主義。教育や医療を重んじる一方、\n共産党の一党制が続いている。',
    ideas: ['主要な産業の国有化', '無料の教育と医療', '大国に対抗する民族の独立', '共産党の一党制'],
    history: ['1959年1月 革命で旧政権が倒れる', '1961年 社会主義を宣言、識字運動', '1962年 キューバ危機。米国が全面禁輸', '1990年代 ソ連崩壊で経済危機（特別期間）'],
    record: ['1961年の識字運動で非識字率が数%に下がった', '医療を無料で提供し、平均寿命は先進国並み', '言論の自由や複数政党制がなく、政治犯がいる', '1980年 マリエル港から約12万5千人が国外へ'],
    pro: ['貧しい中でも教育と医療を全員に届けた', '大国に屈しない独立を守った'],
    con: ['一党制で、政府を批判する自由がない', '経済が停滞し、多くの人が国を離れた'],
    related: ['leninism', 'maoism', 'authoritarianism'],
    sources: [
      S('Cuba’s literacy legacy (Axios)', 'https://www.axios.com/2021/10/05/hispanic-heritage-cuba-literacy-legacy-castro'),
      S('Cuban Revolution (Wikipedia)', 'https://en.wikipedia.org/wiki/Cuban_Revolution'),
      S('Timeline of Cuba (City of San Diego)', 'https://SanDiego.gov/sites/default/files/timeline_of_cuba_and_carlos_eire.pdf'),
    ],
  }),
  deng_theory: school('deng_theory', {
    name: '鄧小平理論', alt: 'デン・シャオピン主義', full: '鄧小平理論（デン・シャオピン主義）', kana: 'とうしょうへいりろん', short: '改革開放と一党支配',
    axes: AX(0.1, 0.9, 0.3, 0.1, -0.8, -0.8, 0.4),
    summary: '鄧小平が唱えた中国の路線。共産党の\n指導を保ったまま、市場経済と対外開放で\n経済の発展をめざした。',
    ideas: ['改革開放（市場の導入と外国資本）', '計画経済に市場のしくみを取り入れる', '「豊かになれる者から先に」', '共産党の指導は守りつづける'],
    history: ['1978年12月 改革開放が始まる', '1980年 深圳などに経済特区', '1989年6月 天安門事件', '1992年 南方視察で改革を加速', '1997年 鄧小平が死去'],
    record: ['長い高成長で多くの人が貧困から抜け出した', '1989年 天安門事件で民主化運動を武力で鎮圧（ちんあつ）', '　死者は数百〜数千人と推計（全容は未公表）', '格差の拡大や環境汚染が深刻になった', '一人っ子政策は強制的な手段をともなった'],
    pro: ['（支持者）現実的な方法で国を豊かにした'],
    con: ['経済の自由と政治の不自由が同居する', '1989年、民主化の要求を武力でおさえた'],
    related: ['maoism', 'authoritarianism', 'capitalism'],
    sources: [
      S('Reform and opening up (Wikipedia)', 'https://en.wikipedia.org/wiki/Reform_and_opening_up'),
      S('Shenzhen: the laboratory of reform (TIME/CNN)', 'https://us.cnn.com/ASIANOW/time/magazine/99/0927/shenzhen.html'),
      S('Tiananmen remembered 20 years on (History News Network)', 'https://www.historynewsnetwork.org/article/88518'),
    ],
  }),
};
export const COMMUNISM_ORDER = ['marxism', 'leninism', 'stalinism', 'trotskyism', 'maoism', 'hoxhaism', 'luxemburgism', 'anarcho_communism', 'primitive_communism', 'juche',
  'titoism', 'posadism', 'eurocommunism', 'libertarian_communism', 'cuban_socialism', 'deng_theory'];

// An entry by id from either list (null when unknown).
export const ideologyById = (id) => IDEOLOGIES[id] || COMMUNISM_SCHOOLS[id] || null;
export const ideologyName = (id) => (ideologyById(id) ? ideologyById(id).name : '');
export const isSelectable = (id) => !!(ideologyById(id) && ideologyById(id).selectable);

// ---------------------------------------------------------------- era: lines later than the game year
// The latest year a line (with its '　' continuation lines) talks about: 4-digit years (followed by 年
// or a range 〜, so 「1500万人」「3000人」 are not years), and ranges written with a short end
// ('1973〜90年' → 1990, '1920〜30年代' → 1930). 0 when it names no year.
export function lineYear(s) {
  const t = String(s || '');
  let m = 0;
  for (const x of t.matchAll(/(\d{4})(?=年|〜)/g)) m = Math.max(m, Number(x[1]));
  for (const x of t.matchAll(/(\d{2})\d{2}(?:年代)?〜(\d{2})(?=年)/g)) m = Math.max(m, Number(x[1] + x[2]));
  return m;
}
export const FUTURE_MARK = '（ゲームの年より後のできごと）';
// Lines of an entry for a game year: a line (with its continuations) that names a year later than
// `year` is left out — or, with opts.showFuture, kept and marked 「（ゲームの年より後のできごと）」.
// Returns { lines, hidden } (hidden = how many items were left out or marked). year null = all.
export function linesForYear(lines, year = null, opts = {}) {
  const groups = [];
  for (const l of lines || []) {
    if (/^[　 ]/.test(l) && groups.length) groups[groups.length - 1].push(l); else groups.push([l]);
  }
  const out = [];
  let hidden = 0;
  for (const gr of groups) {
    const late = year != null && Number.isFinite(Number(year)) && lineYear(gr.join('')) > Number(year);
    if (!late) { out.push(...gr); continue; }
    hidden++;
    if (opts.showFuture) out.push(...gr.slice(0, -1), gr[gr.length - 1] + FUTURE_MARK);
  }
  return { lines: out, hidden };
}

// An entry split into short sections for a small-screen reader:
// [{ key, title, tab, lines[], hidden }] (summary, ideas, history, record, pro, con, related, sources).
// Titles are neutral: 「実際に起きたこと」 (never 成果・失敗). For the two entries that cannot be chosen
// (ファシズム・ナチズム) the pro / con sections are 「当時の宣伝（支持の集め方）」 and 「批判・歴史の
// 評価」 — there is no "supporters' voice" for them. year (the game year, optional): lines about later
// events are left out (opts.showFuture: kept and marked). `hidden` = items left out / marked.
export function ideologySections(id, year = null, opts = {}) {
  const e = ideologyById(id);
  if (!e) return [];
  const fam = IDEO_FAMILIES[e.family] ? IDEO_FAMILIES[e.family].name : '';
  const prop = e.selectable === false;
  const yl = (arr) => linesForYear(arr, year, opts);
  const sec = (key, title, tab, r) => ({ key, title, tab, lines: r.lines, hidden: r.hidden });
  return [
    sec('summary', 'どんな考え？', '概要', { lines: [...e.summary.split('\n'), ...(fam ? [`（${fam}）`] : []), ...(e.note ? [e.note] : [])], hidden: 0 }),
    sec('ideas', '主な考え', '考え', yl(e.ideas)),
    sec('history', '歴史', '歴史', yl(e.history)),
    sec('record', '実際に起きたこと', '記録', yl(e.record)),
    sec('pro', prop ? '当時の宣伝（支持の集め方）' : '支持する人の考え', prop ? '宣伝' : '支持', yl(e.pro)),
    sec('con', prop ? '批判・歴史の評価' : '批判する人の考え', '批判', yl(e.con)),
    sec('related', '関連する思想', '関連', { lines: e.related.map(ideologyName).filter(Boolean), hidden: 0 }),
    sec('sources', '出典', '出典', { lines: e.sources.map((x) => x.title), hidden: 0 }),
  ];
}

// ================================================================ real parties
// Labels ONLY from the parties' own published self-description (short phrases). Axes are
// the mean of these ideologies' axes. Sources: jimin.jp 立党宣言・綱領 (1955: 「民主政治の本義に
// 立脚して」, 綱領「文化的民主国家」), 党史「保守合同」, 平成22年(2010年)綱領「日本らしい日本の保守主義」
// 「常に進歩を目指す保守政党」; 民主党 (1998) 基本理念「民主中道」 (Wikipedia / kotobank 民主党).
export const REAL_PARTY_IDEOLOGY = {
  jimin: {
    ids: ['conservatism', 'democracy'],
    quotes: [
      { text: '民主政治の本義に立脚して', source: '立党宣言（1955年）', year: 1955 },
      { text: '保守合同', source: '党史（1955年の結党）', year: 1955 },
      { text: '日本らしい日本の保守主義', source: '綱領（2010年）', year: 2010 },
      { text: '常に進歩を目指す保守政党', source: '綱領（2010年）', year: 2010 },
    ],
    note: '党の立党宣言・綱領の言葉から分類',
    sources: [S('自由民主党 立党宣言・綱領', 'https://www.jimin.jp/aboutus/declaration/'), S('自由民主党 党のあゆみ（保守合同）', 'https://www.jimin.jp/aboutus/history/1955-1956.html')],
  },
  minshu: {
    ids: ['moderatism', 'democracy'],
    quotes: [{ text: '民主中道', source: '基本理念（1998年）', year: 1998 }],
    note: '党の基本理念の言葉から分類',
    sources: [S('民主党 (日本 1998-2016)（Wikipedia）', 'https://ja.wikipedia.org/wiki/%E6%B0%91%E4%B8%BB%E5%85%9A_(%E6%97%A5%E6%9C%AC_1998-2016)'), S('民主党（コトバンク）', 'https://kotobank.jp/word/%E6%B0%91%E4%B8%BB%E5%85%9A-182034')],
  },
};

// ================================================================ geometry
export function normAxes(v) {
  const o = {};
  for (const k of AXIS_IDS) o[k] = r3(clamp(num(v && v[k]), -1, 1));
  return o;
}
export function axesDistance(a, b) {
  let s = 0;
  for (const k of AXIS_IDS) { const d = num(a && a[k]) - num(b && b[k]); s += d * d; }
  return Math.sqrt(s);
}
export function meanAxes(list) {
  const o = normAxes({});
  const L = (list || []).filter(Boolean);
  if (!L.length) return o;
  for (const v of L) for (const k of AXIS_IDS) o[k] += num(v[k]);
  for (const k of AXIS_IDS) o[k] = r3(o[k] / L.length);
  return o;
}
const matchPct = (d) => Math.max(0, Math.round(100 * (1 - d / 2.6)));
// Ids a computed party / NPC label may take (an ordinary party in a democracy is never
// labelled 権威主義・帝国主義 or a totalitarian ideology by computation; a player can still
// declare 権威主義 or 帝国主義 for their own party).
const PARTY_SAFE = IDEOLOGY_ORDER.filter((id) => !['authoritarianism', 'imperialism', 'fascism', 'nazism'].includes(id));

// nearestIdeology(axesVec, opts?) -> { id, name, dist, match, top3: [{ id, name, dist, match }] }
//   opts.pool: 'main' (default: the 23 ideologies) | 'communism' (the 16 schools) | 'all' | [ids]
//   opts.all: true also includes selectable: false entries (ファシズム・ナチズム); by default they
//   are left out (a quiz or a player's label never says "you are a fascist").
export function nearestIdeology(axesVec, opts = {}) {
  const v = normAxes(axesVec);
  let ids = Array.isArray(opts.pool) ? opts.pool
    : opts.pool === 'communism' ? COMMUNISM_ORDER
      : opts.pool === 'all' ? [...IDEOLOGY_ORDER, ...COMMUNISM_ORDER] : IDEOLOGY_ORDER;
  if (!opts.all) ids = ids.filter((id) => isSelectable(id));
  if (opts.exclude) ids = ids.filter((id) => !opts.exclude.includes(id));
  const scored = ids.filter((id) => ideologyById(id)).map((id) => { const d = axesDistance(v, ideologyById(id).axes); return { id, name: ideologyById(id).name, dist: r3(d), match: matchPct(d) }; })
    .sort((a, b) => a.dist - b.dist);
  const best = scored[0] || { id: null, name: '', dist: 0, match: 0 };
  return { id: best.id, name: best.name, dist: best.dist, match: best.match, top3: scored.slice(0, 3) };
}

// ================================================================ policies -> axes
// A policy's position on the axes: from POLICIES[id].ideo (econ / social / security, ±2) plus
// hand-set axes for what ideo does not carry (環境・分権・技術・権力・国際協調).
const POLICY_EXTRA = {
  renewables: { env: 0.8 }, carbon_tax: { env: 0.9 }, env_regulation: { env: 0.8 }, amend_environment: { env: 0.7 },
  nuclear_exit: { env: 0.6, tech: -0.3 }, nuclear_promote: { env: -0.5, tech: 0.3, world: 0 }, public_works: { env: -0.4, nation: -0.2 },
  deregulation: { power: -0.3, env: -0.2 }, research: { tech: 0.5 }, space: { tech: 0.5 },
  digital_gov: { tech: 0.4 }, digital_agency: { tech: 0.4, power: 0.2 }, mynumber: { tech: 0.3, power: 0.3 },
  decentralize: { power: -0.5, nation: 0.4 }, municipal_merger: { nation: -0.3 }, local_grant: { nation: 0.3 }, furusato_tax: { nation: 0.2 },
  police_up: { power: 0.4, world: 0 }, conspiracy_law: { power: 0.8, world: 0 }, amend_emergency: { power: 0.8, world: 0.2 },
  political_money: { power: -0.4 }, saibanin: { power: -0.3 }, voting_age: { power: -0.2 }, referendum_law: { power: -0.1, world: 0 },
  security_law: { power: 0.3 }, defense_up: { power: 0.2 }, defense_cut: { power: -0.2 }, amend_sdf: { power: 0.2 },
  pko: { world: -0.3 }, oda: { world: -0.6 }, fta: { world: -0.4 }, foreign_workers: { world: -0.5 }, tourism: { world: -0.2 }, farm_import: { world: -0.3 },
  disaster_prep: { world: 0 }, anti_yakuza: { power: 0.2 }, smoking_ban: { power: 0.1 },
};
export function policyAxes(policyId) {
  const pl = POL && POL.POLICIES ? POL.POLICIES[policyId] : null;
  const o = {};
  const ideo = (pl && pl.ideo) || {};
  if (num(ideo.econ)) o.econ = clamp(num(ideo.econ) / 1.4, -1, 1);
  if (num(ideo.social)) o.social = clamp(num(ideo.social) / 1.6, -1, 1);
  if (num(ideo.security)) o.world = clamp(num(ideo.security) / 2.2, -1, 1);
  Object.assign(o, POLICY_EXTRA[policyId] || {});
  for (const k of Object.keys(o)) o[k] = r3(o[k]);
  return o;
}
// The opposite stance (voting against a policy).
const mirror = (ax) => { const o = {}; for (const [k, v] of Object.entries(ax)) o[k] = r3(-v * 0.7); return o; };

// ================================================================ the player's ideology
const today = (g) => (g && g.state && num(g.state.day, 1)) || 1;
const polOf = (g) => { try { return g && typeof g.pol === 'function' && g.state ? g.pol() : null; } catch (e) { return null; } };
function newIdeoState() {
  return { v: 1, axes: normAxes({}), weight: 0, history: [], party: {}, seen: {}, last: {}, drift: { d: 0, day: 0, note: -999 }, quiz: null, labelId: null };
}
// The player's ideology state (created on demand; old saves get the defaults).
export function ensureIdeo(g) {
  if (!g || !g.state) return newIdeoState();
  let s = g.state.ideology;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = g.state.ideology = newIdeoState();
  const def = newIdeoState();
  for (const k of Object.keys(def)) if (s[k] === undefined || s[k] === null && k !== 'quiz' && k !== 'labelId') s[k] = def[k];
  s.axes = normAxes(s.axes);
  s.weight = clamp(num(s.weight), 0, 10);
  if (!Array.isArray(s.history)) s.history = [];
  for (const k of ['party', 'seen', 'last', 'drift']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = def[k];
  return s;
}
const FORMED = 0.25; // evidence needed before the label is "formed"

function labelOf(axes) { return nearestIdeology(axes); }

function addHistory(g, s, item) {
  const day = today(g);
  const last = s.history[s.history.length - 1];
  if (last && last.day === day && last.why === item.why && !item.label) {
    last.w = r3(num(last.w) + num(item.w));
    for (const [k, v] of Object.entries(item.d || {})) last.d[k] = r3(num(last.d[k]) + v);
    return last;
  }
  const rec = { day, ...item };
  s.history.push(rec);
  if (s.history.length > 60) s.history.splice(0, s.history.length - 60);
  return rec;
}

// Move the player's axes toward a position. axes: { axisId: -1..1 } (axes left out do not
// move); weight 0..1 (the share of the way moved: 0.02 small act … 0.3 big decision).
function nudge(g, axes, weight = 0.05, why = '') {
  const s = ensureIdeo(g);
  const w = clamp(num(weight, 0.05), 0, 1);
  const d = {};
  if (axes && typeof axes === 'object' && w > 0) {
    for (const k of AXIS_IDS) {
      if (!(k in axes) || !Number.isFinite(Number(axes[k]))) continue;
      const target = clamp(Number(axes[k]), -1, 1);
      const before = s.axes[k];
      s.axes[k] = r3(clamp(before + (target - before) * w, -1, 1));
      if (s.axes[k] !== before) d[k] = r3(s.axes[k] - before);
    }
  }
  s.weight = r3(Math.min(10, s.weight + w));
  if (why) addHistory(g, s, { why: String(why).slice(0, 40), w: r3(w), d });
  const n = labelOf(s.axes);
  let changed = false;
  if (s.weight >= FORMED && n.id !== s.labelId) {
    changed = !!s.labelId;
    if (changed) {
      addHistory(g, s, { why: `考え方が「${n.name}」に近づいた`, w: 0, d: {}, label: n.id });
      const p = polOf(g);
      if (p && (p.me.office || p.me.party)) (g.morningNotes || (g.morningNotes = [])).push(`（あなたの考え方は「${n.name}」に近づいてきた）`);
    }
    s.labelId = n.id;
  }
  return { axes: { ...s.axes }, id: n.id, label: n.name, changed };
}

// ================================================================ parties & NPCs
const partyDef = (id) => (POL && POL.PARTY_DEFS ? POL.PARTY_DEFS[id] : null);
// A fictional party's axes from its 3-axis ideology (econ / social / security, ±2) and its platform.
function computedPartyAxes(pt) {
  const I = (pt && pt.ideology) || {};
  const a = { econ: num(I.econ) / 2, social: num(I.social) / 2, world: num(I.security) / 2.6, power: num(I.security) * 0.12 + num(I.social) * 0.1 };
  const sum = {}, cnt = {};
  for (const pid of (pt && pt.platform) || []) {
    for (const [k, v] of Object.entries(policyAxes(pid))) { sum[k] = num(sum[k]) + v; cnt[k] = num(cnt[k]) + 1; }
  }
  const o = {};
  for (const k of AXIS_IDS) {
    const plat = cnt[k] ? sum[k] / cnt[k] : null;
    if (k in a) o[k] = plat == null ? a[k] : a[k] * 0.6 + plat * 0.4;
    else o[k] = plat == null ? 0 : plat * 0.9;
  }
  return normAxes(o);
}
function declaredFor(g, partyId) {
  const s = g && g.state ? ensureIdeo(g) : null;
  const ids = s && Array.isArray(s.party[partyId]) ? s.party[partyId].filter((id) => isSelectable(id)) : [];
  return ids.slice(0, 2);
}
function partyIdeo(g, partyId) {
  const p = polOf(g);
  const pt = (p && p.parties && p.parties[partyId]) || null;
  const def = partyDef(partyId);
  if (!pt && !def) return null;
  const name = (pt && pt.name) || (def && def.name) || partyId;
  const short = (pt && pt.short) || (def && def.short) || name;
  const real = !!((pt && pt.real) || (def && def.real));
  if (real) {
    const R = REAL_PARTY_IDEOLOGY[partyId];
    if (!R) return { kind: 'party', id: partyId, name, short, real, axes: normAxes({}), label: '（分類しない）', ideologyIds: [], basis: 'self', quotes: [], note: '自己規定の資料がないため分類しない' };
    const axes = meanAxes(R.ids.map((id) => ideologyById(id).axes));
    let year = 9999;
    try { if (POL && typeof POL.calYear === 'function' && g && g.state) year = POL.calYear(g); } catch (e) { year = 9999; }
    const quotes = R.quotes.filter((q) => q.year <= year).map((q) => ({ ...q }));
    return { kind: 'party', id: partyId, name, short, real, axes, label: R.ids.map(ideologyName).join('・'), ideologyIds: [...R.ids], basis: 'self', quotes, note: R.note, sources: R.sources };
  }
  const computed = computedPartyAxes(pt || def);
  const declared = declaredFor(g, partyId);
  if (declared.length) {
    const dec = meanAxes(declared.map((id) => ideologyById(id).axes));
    const axes = normAxes(Object.fromEntries(AXIS_IDS.map((k) => [k, r3(dec[k] * 0.75 + computed[k] * 0.25)])));
    return { kind: 'party', id: partyId, name, short, real, axes, label: declared.map(ideologyName).join('・'), ideologyIds: declared, basis: 'declared', quotes: [], note: '党がかかげる理念' };
  }
  const n = nearestIdeology(computed, { pool: PARTY_SAFE });
  return { kind: 'party', id: partyId, name, short, real, axes: computed, label: n.name, ideologyIds: [n.id], basis: 'platform', quotes: [], note: '政策・綱領から見た近い思想' };
}
// A stable pseudo-random number in [-1, 1) from a string.
function hashUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 20001) / 10000 - 1;
}
function npcIdeo(g, npcId) {
  const p = polOf(g);
  const n = p && p.npcs ? p.npcs[npcId] : null;
  if (!n) return null;
  const party = n.party && n.party !== 'ind' ? partyIdeo(g, n.party) : null;
  const base = party ? party.axes : normAxes({});
  const spread = party ? 0.28 : 0.45;
  // [R11-P] a politician with an agent record (politics_ai.js) has positions of their own, which drift with experience; the hash is the fallback
  const own = n.ai && Array.isArray(n.ai.ax) && n.ai.ax.length === AXIS_IDS.length ? n.ai.ax : null;
  const axes = normAxes(Object.fromEntries(AXIS_IDS.map((k, i) => [k, own ? r3(num(own[i]) / 100) : r3(base[k] + hashUnit(`${npcId}:${k}`) * spread)])));
  const near = nearestIdeology(axes, { pool: PARTY_SAFE });
  return { kind: 'npc', id: npcId, name: n.name, party: n.party || null, axes, label: near.name, ideologyId: near.id, top3: near.top3 };
}
function playerIdeo(g) {
  const s = ensureIdeo(g);
  const n = labelOf(s.axes);
  const formed = s.weight >= FORMED;
  const p = polOf(g);
  let party = null;
  if (p && p.me && p.me.party && p.parties[p.me.party]) {
    const pi = partyIdeo(g, p.me.party);
    if (pi) {
      const d = r3(axesDistance(s.axes, pi.axes));
      party = { id: p.me.party, name: pi.name, label: pi.label, axes: pi.axes, distance: d, far: d > DRIFT_FAR, leader: p.parties[p.me.party].leader === 'player' };
    }
  }
  const fam = ideologyById(n.id) ? ideologyById(n.id).family : null;
  return {
    kind: 'player', id: 'player', axes: { ...s.axes }, ideologyId: n.id, label: n.name,
    labelText: formed ? n.name : `${n.name}寄り（まだ形成中）`, formed, strength: s.weight, family: fam,
    top3: n.top3, history: s.history.slice(-30).map((h) => ({ ...h, d: { ...(h.d || {}) } })), party, quiz: s.quiz ? { ...s.quiz } : null,
  };
}

// ================================================================ regime classification
const regimeKind = (r) => {
  if (!r) return null;
  if (typeof r === 'string') return r;
  return r.id || r.kind || r.regime || r.state || r.mode || r.type || null;
};
const pressValue = (pf) => {
  if (pf == null) return null;
  if (typeof pf === 'number') return pf;
  for (const k of ['value', 'score', 'level', 'now', 'freedom', 'index']) if (Number.isFinite(Number(pf[k]))) return Number(pf[k]);
  return null;
};
const warActive = (w) => !!(w && (typeof w !== 'object' || ('phase' in w ? w.phase === 'war' : !(w.over || w.ended || w.done || w.result))));
const safeCall = (g, fn) => { try { return g && typeof g[fn] === 'function' ? g[fn]() : null; } catch (e) { return null; } };
const anyOf = (o, ...keys) => keys.some((k) => !!(o && o[k]));
// The state classifyRegime reads, from a game (feature-detected regime.js methods).
function gatherRegimeState(g) {
  const r = safeCall(g, 'regime');
  const steps = (r && typeof r === 'object' && (r.steps || r.flags)) || {};
  const pf = safeCall(g, 'pressFreedom');
  const s = g && g.state ? ensureIdeo(g) : null;
  return {
    regime: regimeKind(r) || 'democracy', press: pressValue(pf), war: warActive(safeCall(g, 'war')),
    oppositionBanned: anyOf(steps, 'opposition', 'oppositionBanned'), electionsSuspended: anyOf(steps, 'elections', 'electionsSuspended'),
    dietSuspended: anyOf(steps, 'diet', 'dietSuspended'), censorship: anyOf(steps, 'censor', 'censorship') || anyOf(pf, 'censorship'),
    arrests: num(pf && pf.detained) > 0 || anyOf(steps, 'arrests'), militarized: anyOf(steps, 'army', 'militarized'),
    courtIgnored: anyOf(steps, 'courtIgnored'), emergencyRule: anyOf(steps, 'emergency'), axes: s ? s.axes : null,
  };
}
// classifyRegime(stateLike) -> { id, label, level 0..3, score, markers, reasons[], why, news, fiction }
// stateLike: a game (reads g.regime(), g.pressFreedom(), g.war() when they exist) or a plain
// object { regime: 'democracy'|'emergency'|'dictatorship'|'fallen', press: 0..100, and flags:
// oppositionBanned|opposition, electionsSuspended|elections, dietSuspended|diet, censorship|censor,
// arrests|detentions, militarized|army, war, courtIgnored, emergencyRule|emergency, leaderCult,
// mobilization, purge, axes (the leader's ideology axes) } — regime.js's features(g) object works
// as is. The label describes ACTIONS (言論統制・野党の禁止・軍事化 …) as the news would; never praise.
export function classifyRegime(stateLike = {}) {
  const st = stateLike && typeof stateLike.regime === 'function' ? gatherRegimeState(stateLike) : (stateLike || {});
  const kind = regimeKind(st.regime || st.kind) || 'democracy';
  const press = st.press != null ? num(pressValue(st.press), 100) : st.pressFreedom != null ? num(pressValue(st.pressFreedom), 100) : 100;
  if (kind === 'fallen') return { id: 'fallen', label: '体制崩壊', level: 3, score: 0, markers: 0, reasons: ['独裁体制が崩れた'], why: '独裁体制が崩れた', news: null, fiction: '' };
  const reasons = [];
  let score = 0, markers = 0;
  const opp = anyOf(st, 'oppositionBanned', 'opposition', 'partiesBanned');
  const elec = anyOf(st, 'electionsSuspended', 'elections', 'noElections');
  const diet = anyOf(st, 'dietSuspended', 'diet');
  const cens = anyOf(st, 'censorship', 'censor');
  const arrests = anyOf(st, 'arrests', 'detentions', 'politicalPrisoners');
  const army = anyOf(st, 'militarized', 'militarised', 'army', 'martialLaw');
  if (kind === 'emergency') { score += 2; reasons.push('緊急事態で権力が集中'); }
  if (kind === 'dictatorship') { score += 5; reasons.push('権力が一人に集中'); }
  if (kind === 'democracy' && anyOf(st, 'emergencyRule', 'emergency')) { score += 1; reasons.push('非常の権限'); }
  if (elec) { score += 2; reasons.push('選挙の停止'); }
  if (diet) { score += 2; reasons.push('国会の停止'); }
  if (opp) { score += 2; markers++; reasons.push('野党の禁止'); }
  if (press < 65) { score += 1; if (press >= 45 && !cens) reasons.push('報道への圧力'); }
  if (press < 45) { score += 1; if (!cens) reasons.push('言論の統制'); }
  if (press < 25) score += 1;
  if (cens) { score += 1; reasons.push('検閲'); }
  if (arrests) { score += 1; reasons.push('記者や反対派の拘束'); }
  if (anyOf(st, 'courtIgnored')) { score += 1; reasons.push('司法の無視'); }
  if (anyOf(st, 'purge')) { score += 1; reasons.push('粛清'); }
  if ((cens || arrests) && press < 25) markers++;
  if (army) { markers++; reasons.push('軍事化'); }
  if (warActive(st.war)) { markers++; reasons.push('戦争'); }
  if (anyOf(st, 'leaderCult')) { markers++; reasons.push('指導者の個人崇拝'); }
  if (anyOf(st, 'mobilization', 'mobilisation')) { markers++; reasons.push('大衆の動員'); }
  const ax = st.axes || null;
  if (ax && num(ax.world) >= 0.6 && num(ax.nation) <= -0.5) { markers++; reasons.push('極端な国家主義'); }
  let id = 'democracy', label = '民主主義', level = 0;
  if (score >= 5 && markers >= 3) { id = 'fascist_like'; label = 'ファシズム的'; level = 3; }
  else if (score >= 4) { id = 'authoritarian'; label = '権威主義的'; level = 2; }
  else if (score >= 1) { id = 'backsliding'; label = '民主主義（自由の後退）'; level = 1; }
  const why = reasons.slice(0, 4).join('・') || '選挙・国会・裁判所・報道が機能している';
  const news = level === 3 ? `海外の研究者や新聞は、いまの体制を「ファシズム的」だと強く批判している（${why}）。`
    : level === 2 ? `海外の研究者や新聞は、いまの体制を「権威主義的」だと評している（${why}）。`
      : level === 1 ? `報道の自由などの後退を心配する声が出ている（${why}）。` : null;
  return { id, label, level, score, markers, reasons, why, news, fiction: '' };
}

// ================================================================ the 思想診断 quiz
// 20 statements in plain Japanese, worded both ways on each axis (no leading questions).
// Each answer carries its own axis effects (agreeing moves toward `axes`, disagreeing away).
export const QUIZ_CHOICES = [
  { label: 'とてもそう思う', k: 1 },
  { label: 'ややそう思う', k: 0.5 },
  { label: 'どちらともいえない', k: 0 },
  { label: 'あまりそう思わない', k: -0.5 },
  { label: 'まったくそう思わない', k: -1 },
];
const QUIZ_BASE = [
  ['q01', 'お金持ちには高い税金をかけて、くらしに困っている人に配るべきだ。', { econ: -1 }],
  ['q02', '会社どうしが自由に競争するほうが、社会は豊かになる。', { econ: 1 }],
  ['q03', '電気・水道・鉄道のような大事な事業は、国や自治体が運営するのがよい。', { econ: -0.9, power: 0.1 }],
  ['q04', '国の決まり（規制）を減らせば、新しい仕事やサービスが生まれやすい。', { econ: 0.8, power: -0.3 }],
  ['q05', '国が大変なときは、強いリーダーが議会を待たずに決めてよい。', { power: 1 }],
  ['q06', '政府を批判する自由は、どんなときでも守られるべきだ。', { power: -1 }],
  ['q07', '国の仕事は、できるだけ地方や地域にまかせたほうがよい。', { power: -0.5, nation: 0.5 }],
  ['q08', '治安を守るためなら、警察の権限が強くなってもかまわない。', { power: 0.8, social: 0.3 }],
  ['q09', '昔からの家族のかたちや伝統は、これからも大切に守るべきだ。', { social: 1 }],
  ['q10', '男女の役割の分け方は、時代に合わせて見直していくべきだ。', { social: -1 }],
  ['q11', '社会のルールは、急いで変えるより、少しずつ変えるほうがよい。', { social: 0.6, econ: 0.1 }],
  ['q12', '自分の国の利益より、世界全体での協力を優先すべきときがある。', { world: -1 }],
  ['q13', '自分の国を守るために、軍事の力をもっと強くすべきだ。', { world: 1, power: 0.2 }],
  ['q14', '外国から来て働いたり暮らしたりする人を、もっと受け入れるべきだ。', { world: -0.8, social: -0.3 }],
  ['q15', '経済が少しおそくなっても、地球温暖化や自然を守る対策を優先すべきだ。', { env: 1, econ: -0.2 }],
  ['q16', 'くらしを豊かにするには、まず経済の成長と開発が必要だ。', { env: -1, econ: 0.2 }],
  ['q17', '地域や民族の多くが望むなら、国から独立する道も認めるべきだ。', { nation: 1 }],
  ['q18', '国はみんながひとつにまとまることが、なにより大切だ。', { nation: -1, power: 0.3 }],
  ['q19', '技術で人間の体や頭のはたらきを強くするのは、よいことだ。', { tech: 1 }],
  ['q20', '遺伝子の操作やAIのような新しい技術は、急がず慎重に使うべきだ。', { tech: -1 }],
];
export const QUIZ_INFO = {
  title: '思想診断',
  intro: ['20の文を読んで、自分の考えに', '近いものをえらんでください。', 'あなたに近い思想がわかります。'],
  note: '考え方の傾向の目安です。どの思想が正しいということはありません。',
  limits: 'この診断は、他の国や地域を支配すること（帝国主義）、「エリート」への見方（大衆主義）、君主制（共和主義）については質問していないので、それらは結果に出しません。',
};
// Ideologies the quiz never returns, and why: their defining trait is not asked by any statement
// (wanting a strong defence or national unity is not 「他国の支配」, so it must not read as 帝国主義).
// They stay in the encyclopedia, and 帝国主義 still describes actions (war) elsewhere.
export const QUIZ_EXCLUDE = {
  imperialism: '他の国や地域を支配することを問う質問がない',
  populism: '「エリート」への見方を問う質問がない',
  republicanism: '君主制についての質問がない',
};
// The pool for a set of quiz answers: QUIZ_EXCLUDE, plus
// - 権威主義 only when the answers about power itself lean authoritarian: q05 (a strong leader may decide
//   without the Diet) and q06 (free speech always protected) together ≥ 0.5 on their own, and the 権力
//   axis ≥ 0.4 — police powers, defence or national unity alone do not make anyone 権威主義;
// - 無政府主義 only for a clearly anti-state, decentralist answer set: 権力 ≤ −0.6, 分離・自治 ≥ 0.3 and
//   agreeing with q07 (leave the state's work to the regions) — valuing free speech alone is not anarchism.
const choiceK = (answers, i, id) => {
  const a = Array.isArray(answers) ? answers[i] : answers && typeof answers === 'object' ? answers[id] : null;
  const idx = a == null || a === '' ? null : Number(a);
  return Number.isInteger(idx) && QUIZ_CHOICES[idx] ? QUIZ_CHOICES[idx].k : 0;
};
export function quizExclusions(axes = {}, answers = null) {
  const ex = Object.keys(QUIZ_EXCLUDE);
  const i5 = QUIZ_BASE.findIndex((q) => q[0] === 'q05'), i6 = QUIZ_BASE.findIndex((q) => q[0] === 'q06');
  const core = answers ? (choiceK(answers, i5, 'q05') - choiceK(answers, i6, 'q06')) / 2 : num(axes.power);
  if (num(axes.power) < 0.4 || core < 0.5) ex.push('authoritarianism');
  const i7 = QUIZ_BASE.findIndex((q) => q[0] === 'q07');
  const local = answers ? choiceK(answers, i7, 'q07') >= 0.5 : true;
  if (!(num(axes.power) <= -0.6 && num(axes.nation) >= 0.3 && local)) ex.push('anarchism');
  return ex;
}
export const QUIZ = QUIZ_BASE.map(([id, q, axes]) => ({
  id, q, axes,
  choices: QUIZ_CHOICES.map((c) => ({ label: c.label, axes: Object.fromEntries(Object.entries(axes).map(([k, v]) => [k, r3(v * c.k)])) })),
}));
// How far full agreement on every question of an axis reaches (1 = only all "とても").
const QUIZ_SCALE = 0.75;

// The axes from a set of answers: an array in QUIZ order (choice index 0..4, or null to
// skip), or an object { questionId: choiceIndex }.
export function quizAxes(answers) {
  const sum = {}, max = {};
  let answered = 0;
  QUIZ.forEach((q, i) => {
    const a = Array.isArray(answers) ? answers[i] : answers && typeof answers === 'object' ? answers[q.id] : null;
    const idx = a == null || a === '' ? null : Number(a);
    if (idx == null || !Number.isInteger(idx) || idx < 0 || idx >= q.choices.length) return;
    answered++;
    for (const [k, v] of Object.entries(q.axes)) max[k] = num(max[k]) + Math.abs(v);
    for (const [k, v] of Object.entries(q.choices[idx].axes)) sum[k] = num(sum[k]) + v;
  });
  const axes = normAxes({});
  for (const k of AXIS_IDS) if (max[k]) axes[k] = r3(clamp(num(sum[k]) / (max[k] * QUIZ_SCALE), -1, 1));
  return { axes, answered };
}
// The quiz result (pure function; g.ideologyQuizResult wraps it).
export function quizResult(answers) {
  const { axes, answered } = quizAxes(answers);
  const near = nearestIdeology(axes, { exclude: quizExclusions(axes, answers) });
  const e = ideologyById(near.id);
  const school = e && e.family === 'communism' ? nearestIdeology(axes, { pool: 'communism' }) : null;
  const leanings = IDEO_AXES.map((a) => ({ a, v: axes[a.id] })).filter((x) => Math.abs(x.v) >= 0.25)
    .sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, 3)
    .map((x) => `${x.a.name}：${x.v < 0 ? x.a.left : x.a.right}寄り`);
  const explain = [
    `いちばん近いのは「${near.name}」でした。`,
    ...(e ? e.summary.split('\n') : []),
    ...(leanings.length ? leanings : ['どの軸でも、真ん中に近い考え方です。']),
    ...(school ? [`共産主義の流れの中では「${school.name}」が近い。`] : []),
    '※考え方の傾向の目安です。正しい答えはありません。',
    `※${QUIZ_INFO.limits}`,
  ];
  return {
    id: near.id, name: near.name, kana: e ? e.kana : '', family: e ? e.family : null, dist: near.dist, match: near.match,
    top3: near.top3, axes, answered, total: QUIZ.length, explain,
    school: school ? { id: school.id, name: school.name, dist: school.dist, match: school.match, top3: school.top3 } : null,
  };
}

// ================================================================ events: politics, regime, drift
const DRIFT_FAR = 1.0; // axes distance at which the party starts to mind
let hooked = false;
function hookPolitics() {
  if (hooked || !POL || typeof POL.onPolitics !== 'function') return;
  hooked = true;
  const onBill = (g, data, enacted) => {
    try {
      const b = data && data.bill;
      if (!b || !g || !g.state) return;
      const p = polOf(g);
      const s = ensureIdeo(g);
      const key = 'b' + b.id;
      if (s.seen[key]) return;
      s.seen[key] = today(g);
      if (!b.policy) return;
      const pos = policyAxes(b.policy);
      if (!Object.keys(pos).length) return;
      const title = String(b.title || '').slice(0, 18);
      const v = p && p.me && p.me.votes ? p.me.votes[b.id] : null;
      if (v === 'yes') nudge(g, pos, enacted ? 0.05 : 0.04, `「${title}」に賛成`);
      else if (v === 'no') nudge(g, mirror(pos), enacted ? 0.04 : 0.03, `「${title}」に反対`);
      if (enacted && b.by === 'player') nudge(g, pos, 0.06, `「${title}」を成立させた`);
      else if (enacted && b.sponsor === 'cabinet' && p && p.cabinet && p.cabinet.pm === 'player') nudge(g, pos, 0.03, `内閣で「${title}」を成立させた`);
    } catch (e) { console.error(e); }
  };
  POL.onPolitics('enacted', (g, data) => onBill(g, data, true));
  POL.onPolitics('bill', (g, data) => { if (data && data.step === 'rejected') onBill(g, data, false); });
  POL.onPolitics('party', (g, data) => {
    try {
      if (!data || !g || !g.state) return;
      if (data.kind === 'joined' || (data.kind === 'founded' && data.player)) {
        const pi = partyIdeo(g, data.party);
        if (pi) nudge(g, pi.axes, data.kind === 'founded' ? 0.2 : 0.12, data.kind === 'founded' ? `${pi.short}を立ち上げた` : `${pi.short}に入党した`);
      }
    } catch (e) { console.error(e); }
  });
}

// The player's own bills (proposed: no event), the regime / press / war watch, the drift of
// the player's views from the party line (党内の評価), and regime classification news.
function ideologyMorning(g) {
  if (!g || !g.state) return;
  const s = ensureIdeo(g);
  const day = today(g);
  const p = polOf(g);
  // prune the seen map
  if (day % 30 === 0) for (const [k, d] of Object.entries(s.seen)) if (day - num(d) > 400) delete s.seen[k];
  if (p) {
    for (const b of (p.diet && p.diet.bills) || []) {
      if (b.by !== 'player' || !b.policy || s.seen['p' + b.id]) continue;
      s.seen['p' + b.id] = day;
      const pos = policyAxes(b.policy);
      if (Object.keys(pos).length) nudge(g, pos, 0.05, `「${String(b.title || '').slice(0, 18)}」を提出`);
    }
  }
  // regime.js (feature-detected): the player's own steps as the leader
  const leader = !!(p && p.cabinet && p.cabinet.pm === 'player');
  const r = safeCall(g, 'regime');
  const kind = regimeKind(r);
  const meLeads = leader || !!(r && typeof r === 'object' && (r.leader === 'player' || r.dictator === 'player'));
  if (kind) {
    const prev = s.last.regime;
    if (prev && kind !== prev && meLeads) {
      if (kind === 'emergency') nudge(g, { power: 0.7 }, 0.08, '緊急事態の体制にした');
      else if (kind === 'dictatorship') nudge(g, { power: 1, social: 0.5, nation: -0.7 }, 0.2, '独裁の体制をしいた');
      else if (kind === 'democracy') nudge(g, { power: -0.5 }, 0.08, '民主的な体制にもどした');
    }
    s.last.regime = kind;
  }
  const pf = pressValue(safeCall(g, 'pressFreedom'));
  if (pf != null) {
    const prevP = s.last.press;
    if (prevP != null && pf < prevP - 3 && meLeads) nudge(g, { power: 0.8 }, clamp((prevP - pf) / 100, 0.01, 0.15), '報道に圧力をかけた');
    s.last.press = pf;
  }
  const war = warActive(safeCall(g, 'war'));
  if (war && !s.last.war && meLeads) nudge(g, { world: 1, power: 0.6 }, 0.15, '戦争を始めた');
  s.last.war = war;
  if (kind || pf != null) {
    const c = classifyRegime(g);
    if (c.id !== s.last.cls) {
      if (c.level >= 2 && c.level > num(s.last.clsLevel) && p && c.news) {
        p.news.unshift({ day, text: c.news, kind: 'politics' });
        if (p.news.length > 80) p.news.length = 80;
        try { if (typeof g.message === 'function') g.message({ from: 'ドット新聞 国際部', text: `【海外の評価】${c.news}${c.fiction}`, kind: 'news' }); } catch (e) { /* no phone */ }
      }
      s.last.cls = c.id;
      s.last.clsLevel = c.level;
    }
  }
  // drift from the party line: the party slowly minds (党内の評価)
  if (p && p.me && p.me.party && p.parties[p.me.party] && day % 10 === 0) {
    const pt = p.parties[p.me.party];
    if (pt.leader !== 'player' && s.weight >= 0.3) {
      const pi = partyIdeo(g, p.me.party);
      const d = pi ? axesDistance(s.axes, pi.axes) : 0;
      s.drift.d = r3(d);
      s.drift.day = day;
      if (d > DRIFT_FAR) {
        const loss = d > 1.5 ? 2 : 1;
        p.me.standing = clamp(num(p.me.standing) - loss, 0, 100);
        if (day - num(s.drift.note, -999) >= 30) {
          s.drift.note = day;
          const mine = labelOf(s.axes).name;
          (g.morningNotes || (g.morningNotes = [])).push(`（あなたの考え方（${mine}寄り）と${pt.short}の路線（${pi.label}）のずれが大きい。党内の評価が少しずつ下がっている）`);
          addHistory(g, s, { why: `${pt.short}の路線とずれている`, w: 0, d: {} });
        }
      }
    }
  }
}

// ================================================================ g.* methods
const methods = {
  // The player's ideology: { axes, ideologyId, label, labelText, formed, strength, family,
  // top3, history, party: { id, name, label, axes, distance, far, leader } | null, quiz }.
  ideology() { return playerIdeo(this); },
  // ideologyOf('party'|'npc'|'player'|'ideology', id) -> the ideology of a party, an NPC
  // politician, the player or an encyclopedia entry; null when unknown.
  ideologyOf(kind, id) {
    if (kind === 'player' || id === 'player') return playerIdeo(this);
    if (kind === 'party') return partyIdeo(this, id);
    if (kind === 'npc') return npcIdeo(this, id);
    if (kind === 'ideology') { const e = ideologyById(id); return e ? { kind: 'ideology', id, name: e.name, axes: { ...e.axes }, label: e.name } : null; }
    return null;
  },
  // ideologyNudge(axes, weight, why) -> { axes, id, label, changed }. Other cores may call it
  // (e.g. a tax or budget decision): axes is the position the act expresses, weight 0..1.
  ideologyNudge(axes, weight = 0.05, why = '') { return nudge(this, axes, weight, why); },
  // ideologyQuizResult(answers, { apply? }) -> the 思想診断 result (see quizResult). Pure by default:
  // taking the quiz changes nothing. apply: true — only when the player chose 「この結果を自分の考え方に
  // 反映する」 after being told what it changes — moves the player's own axes toward it (weight 0.35;
  // a party member far from the line may then lose 党内の評価 over time) and keeps the result.
  ideologyQuizResult(answers, opts = {}) {
    const res = quizResult(answers);
    if (opts.apply && this.state && res.answered >= 5) {
      nudge(this, res.axes, 0.35, '思想診断の結果を反映（自分で選んだ）');
      ensureIdeo(this).quiz = { id: res.id, school: res.school ? res.school.id : null, day: today(this), axes: { ...res.axes } };
      res.applied = today(this);
    }
    return res;
  },
  // setPartyIdeology(partyId, ids) -> { ok, why, ids?, label? }: a party the player leads
  // (a fictional one) declares 1–2 selectable ideologies.
  setPartyIdeology(partyId, ids) {
    const p = polOf(this);
    if (!p) return { ok: false, why: '政治の機能が読み込まれていない' };
    const pt = p.parties[partyId];
    if (!pt) return { ok: false, why: 'その政党はない' };
    if (pt.real || (partyDef(partyId) && partyDef(partyId).real)) return { ok: false, why: 'この党の理念は、党の綱領で決まっている' };
    if (!(pt.isPlayers || pt.leader === 'player')) return { ok: false, why: '党の理念を決められるのは党首だけ' };
    const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
    if (!list.length || list.length > 2) return { ok: false, why: '理念は1つか2つえらぶ' };
    for (const id of list) {
      const e = ideologyById(id);
      if (!e) return { ok: false, why: 'その思想はない' };
      if (!e.selectable) return { ok: false, why: `${e.name}は理念としてかかげられない（百科事典と分類のためだけにのせている）` };
    }
    const s = ensureIdeo(this);
    s.party[partyId] = list;
    const label = list.map(ideologyName).join('・');
    nudge(this, meanAxes(list.map((id) => ideologyById(id).axes)), 0.1, `${pt.short}の理念を「${label}」に`);
    return { ok: true, why: null, ids: list, label };
  },
  // partyIdeology(partyId) -> the declared / self-described ideology ids of a party.
  partyIdeology(partyId) { const r = partyIdeo(this, partyId); return r ? [...r.ideologyIds] : []; },
  // classifyRegime() -> classifyRegime(this) (the label the news would use now).
  classifyRegime() { return classifyRegime(this); },
};

export function installIdeology(proto) {
  if (!proto || proto.__ideologyInstalled) return;
  for (const [k, fn] of Object.entries(methods)) proto[k] = fn;
  Object.defineProperty(proto, '__ideologyInstalled', { value: true, enumerable: false });
}

// self-install at import time (like politics_ui.js), and the morning hook
installIdeology(Game.prototype);
onMorning(ideologyMorning);
