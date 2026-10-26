// 歴史の出来事 (R14-H2): a regime that joins the 世界情勢 (設定 → 歴史の列強) lives through its own history in order, month by month from the day it was switched on
// (1 game month = 10 days): the laws, the camps, the purges, the wars, the famines and the end of the regime, as 世界情勢 news, 危機 (人道危機・戦争) and three
// indices on the country page (独裁・個人崇拝・弾圧). The player is Japan's leader or a citizen: the events are what happens in the world, and the usual responses of the
// 外交 tab (抗議・制裁・人道支援・国連・難民への対応) are what the player can do about them. The words are the facts of the historical record, with estimates given as estimates;
// nothing here is written from the regime's side (no slogans, no propaganda text), and the player never carries out any of it.
//
// ≤ 1 phone message per morning from this system (only the events marked `major`); every event is in the 世界情勢 news. The regime ends with its last event
// (the regime's end in history) and the country it replaced comes back; switching it on again starts the history over.
//
// Facts (public record) — ヒトラー: 首相就任 1933-01-30, 国会議事堂放火 1933-02, 全権委任法 1933-03-23, 政党新設禁止法 1933-07-14, 長いナイフの夜 1934-06-30〜07-02, 総統 1934-08,
//   ニュルンベルク法 1935-09-15, 水晶の夜 1938-11-09/10, 第二次世界大戦 1939-09-01, 三国同盟 1940-09-27, ヴァンゼー会議 1942-01-20, ホロコースト（ユダヤ人の犠牲者は約600万人と推計）, 降伏 1945-05-08。
//   ムッソリーニ: ローマ進軍 1922-10, 独裁宣言 1925-01-03, 1926年の特別法, エチオピア侵攻 1935-10-03, 日独防共協定への参加 1937-11-06, 人種法 1938, 参戦 1940-06-10, 解任 1943-07-25。
//   スターリン: 第1次五カ年計画 1928-10, 集団化 1929〜, 飢饉 1932〜33, キーロフ暗殺 1934-12-01, 大粛清 1936〜38（NKVDによる銃殺は約68万人）, 独ソ不可侵条約 1939-08-23,
//   日ソ中立条約 1941-04-13, 独ソ戦 1941-06-22, 対日参戦 1945-08-08, スターリンの死去 1953-03-05。
//   毛沢東: 建国 1949-10-01, 朝鮮戦争への参戦 1950-10, 反右派闘争 1957, 大躍進 1958〜, 大飢饉 1959〜61（犠牲者は1500万〜4500万人とも推計）, 文化大革命 1966-05〜1976, 初の核実験 1964-10-16,
//   日中共同声明 1972-09-29, 毛沢東の死去 1976-09-09, 四人組の逮捕 1976-10。
//   ポル・ポト: プノンペン制圧 1975-04-17, 国名を民主カンプチアに 1976-01, ベトナムとの紛争 1977〜, ベトナム軍の侵攻 1978-12-25, 政権が首都を失う 1979-01-07（犠牲者は150万〜200万人と推計）。

const E = (ym, id, text, o = {}) => ({ ym, id, text, ...o });
export const CHRON = {
  h_de: { origin: [1933, 1], events: [
    E([1933, 1], 'chancellor', 'ヒトラーが首相に任命された（ナチ党を中心とする連立政権）', { d: { dict: 10, cult: 12 }, major: 1 }),
    E([1933, 2], 'reichstag', '国会議事堂が炎上し、緊急令で基本的人権が停止された。共産党員らが大量に拘束された', { d: { dict: 10, terror: 15 } }),
    E([1933, 3], 'enabling', '全権委任法が成立した（3月23日）。政府が議会の同意なしに法律を作れるようになった', { d: { dict: 25 }, major: 1 }),
    E([1933, 3], 'dachau', 'ダッハウに最初期の強制収容所が開設された。政権に反対する人々の拘束が目的だった', { d: { terror: 10 } }),
    E([1933, 4], 'boycott', 'ユダヤ人の商店へのボイコットが行われ、公務員からユダヤ人らを追放する法律が定められた', { d: { terror: 10 } }),
    E([1933, 7], 'oneparty', '政党新設禁止法が定められた（7月14日）。ナチ党以外の政党は禁じられ、一党独裁が確立した', { d: { dict: 25 }, major: 1 }),
    E([1934, 6], 'knives', '「長いナイフの夜」（6月30日〜7月2日）。突撃隊（SA）の幹部らが粛清された。党の内側でも、指導者への異論は許されなくなった', { d: { terror: 15, cult: 5 } }),
    E([1934, 8], 'fuhrer', 'ヒンデンブルク大統領が死去し、ヒトラーは首相と大統領の権限を合わせた「総統」になった。軍も総統個人に忠誠を誓った', { d: { cult: 25, dict: 15 }, major: 1 }),
    E([1935, 3], 'rearm', 'ヴェルサイユ条約に反して再軍備を宣言し、徴兵制を復活した', { tension: 4, pair: [['h_de', 'gb', -10], ['h_de', 'fr', -10]] }),
    E([1935, 9], 'nuremberg', 'ニュルンベルク法（9月15日）。ユダヤ人から市民権を奪い、結婚も禁じる人種法が定められた', { d: { terror: 15 }, crisis: { kind: 'humanitarian', title: 'ドイツでのユダヤ人への迫害', sev: 2, days: 120 }, major: 1 }),
    E([1936, 3], 'rhineland', 'ラインラントに軍を進めた（ヴェルサイユ条約・ロカルノ条約に違反）', { tension: 4, pair: [['h_de', 'gb', -6], ['h_de', 'fr', -10]] }),
    E([1936, 11], 'anticomintern', '日独防共協定が結ばれた（11月25日）。共産主義の国際組織への対抗を名目に、日本とドイツが協定を結んだ', { jp: 8, major: 1 }),
    E([1938, 3], 'anschluss', 'オーストリアを併合した', { tension: 5, pair: [['h_de', 'gb', -8], ['h_de', 'fr', -8]] }),
    E([1938, 9], 'munich', 'ミュンヘン会談（9月29〜30日）。英仏は、ズデーテン地方のドイツへの割譲を認めた', { tension: 3 }),
    E([1938, 11], 'kristall', '「水晶の夜」（11月9〜10日）。各地でユダヤ人の商店や礼拝所が襲われ、多くの人が拘束された', { d: { terror: 15 }, crisis: { kind: 'humanitarian', title: '水晶の夜と、ユダヤ人への迫害の激化', sev: 3, days: 150 }, major: 1 }),
    E([1939, 3], 'czech', 'チェコスロバキアを解体し、保護領にした', { tension: 4 }),
    E([1939, 9], 'ww2', 'ポーランドに侵攻した（9月1日）。英国とフランスが宣戦し、第二次世界大戦が始まった', { tension: 10, conflict: { with: 'gb', id: 'hist_ww2', name: '第二次世界大戦（欧州）', intensity: 3 }, major: 1 }),
    E([1940, 5], 'west', 'ドイツ軍が西方に攻め込み、6月にフランスが降伏した', { tension: 2, pair: [['h_de', 'fr', -15]] }),
    E([1940, 9], 'tripartite', '日独伊三国同盟が結ばれた（9月27日）', { jp: 10, pair: [['h_de', 'h_it', 10]], major: 1 }),
    E([1941, 6], 'barbarossa', 'ソ連に侵攻し、独ソ戦が始まった（6月22日）', { tension: 4, conflict: { with: 'h_su', id: 'hist_soviet_german', name: '独ソ戦', intensity: 3 }, pair: [['h_de', 'h_su', -30]] }),
    E([1941, 7], 'shooting', '占領地で、ユダヤ人らの組織的な大量殺害が始まった（移動殺戮部隊による）', { d: { terror: 20 } }),
    E([1942, 1], 'wannsee', 'ヴァンゼー会議（1月20日）。ヨーロッパのユダヤ人の「最終解決」を、各省庁が分担して進める打ち合わせが行われた', { d: { terror: 10 } }),
    E([1942, 3], 'camps', 'アウシュヴィッツ＝ビルケナウなどの絶滅収容所への移送と殺害が本格化した。ユダヤ人のほか、ロマ、ポーランド人、ソ連軍捕虜らも犠牲になった（ユダヤ人の犠牲者は約600万人と推計される）', { d: { terror: 25 }, crisis: { kind: 'humanitarian', title: 'ホロコースト（ユダヤ人らの組織的な殺害）', sev: 3, days: 400 }, major: 1 }),
    E([1943, 2], 'stalingrad', 'スターリングラードでドイツ第6軍が降伏した（2月）。戦局の転換点になった', { tension: 1 }),
    E([1944, 6], 'normandy', '連合軍がノルマンディーに上陸した（6月6日）', { tension: 2 }),
    E([1945, 1], 'liberation', 'ソ連軍がアウシュヴィッツを解放した（1月27日）', { d: { terror: -5 } }),
    E([1945, 5], 'end', 'ドイツが降伏した（5月8日）。ヒトラーは4月30日に自殺しており、ナチス・ドイツの体制は終わった', { end: true, endConflicts: ['hist_ww2', 'hist_soviet_german'], tension: -8, major: 1 }),
  ] },
  h_it: { origin: [1922, 10], events: [
    E([1922, 10], 'march', 'ローマ進軍（10月）。国王がムッソリーニを首相に任命し、ファシスト党が政権に入った', { d: { dict: 10, cult: 10 }, major: 1 }),
    E([1924, 6], 'matteotti', 'マッテオッティ事件（6月）。野党の議員が、ファシスト党の関係者に殺害された', { d: { terror: 10 } }),
    E([1925, 1], 'dictatorship', 'ムッソリーニが議会で事件の責任を認め、独裁体制を進めると宣言した（1月3日）', { d: { dict: 25, cult: 10 }, major: 1 }),
    E([1926, 11], 'laws', '特別法で、ファシスト党以外の政党が禁止され、反対派を裁く特別法廷が置かれた（秘密警察OVRAは1927年から）', { d: { dict: 25, terror: 15 } }),
    E([1929, 2], 'lateran', 'ラテラノ条約が結ばれた（2月11日）。バチカン市国が成立し、教皇庁との関係が正常化した', { d: { cult: 5 } }),
    E([1935, 10], 'ethiopia', 'エチオピアに侵攻した（10月3日）。国際連盟は経済制裁を決めた', { tension: 4, crisis: { kind: 'war', title: 'イタリアのエチオピア侵攻', sev: 3, days: 220 }, pair: [['h_it', 'gb', -10], ['h_it', 'fr', -5]], major: 1 }),
    E([1936, 5], 'annex', 'エチオピアの首都を占領して併合し、イタリア領東アフリカを宣言した', { d: { cult: 10 } }),
    E([1936, 10], 'axis', 'ローマ・ベルリン枢軸（10月）。ドイツと協力関係を結んだ', { pair: [['h_it', 'h_de', 10]] }),
    E([1937, 11], 'anticomintern', '日独防共協定に加わった（11月6日）', { jp: 8, major: 1 }),
    E([1938, 9], 'racial', '人種法が定められた（1938年）。ユダヤ人が学校や公職から排除された', { d: { terror: 10 } }),
    E([1939, 4], 'albania', 'アルバニアを併合した（4月）', { tension: 3 }),
    E([1939, 5], 'steel', '独伊軍事同盟（鋼鉄協約、5月22日）が結ばれた', { pair: [['h_it', 'h_de', 8]] }),
    E([1940, 6], 'war', '第二次世界大戦に参戦した（6月10日）。英国とフランスに宣戦した', { tension: 4, conflict: { with: 'gb', id: 'hist_ww2', name: '第二次世界大戦（欧州）', intensity: 3 }, pair: [['h_it', 'gb', -15]], major: 1 }),
    E([1940, 9], 'tripartite', '日独伊三国同盟の一員になった（9月27日）', { jp: 4 }),
    E([1943, 7], 'end', '連合軍がシチリア島に上陸した（7月）。ファシスト大評議会がムッソリーニの解任を決め、国王が首相を解任して逮捕した（7月25日）。ファシスト党の一党体制は終わった', { end: true, tension: -2, major: 1 }),
  ] },
  h_su: { origin: [1928, 10], events: [
    E([1928, 10], 'fyp1', '第1次五カ年計画が始まった。国の計画で、重工業を中心に産業を急速に築く', { d: { dict: 10, cult: 10 }, major: 1 }),
    E([1929, 12], 'collectivization', '農業の集団化が進められ、「富農」とされた農民が追放・拘束された', { d: { terror: 15 } }),
    E([1932, 10], 'famine', '各地で大飢饉が広がった（1932〜33年）。穀物の徴発と集団化が重なり、ウクライナなどで数百万人が亡くなったと推計される', { d: { terror: 10 }, crisis: { kind: 'humanitarian', title: 'ソ連の大飢饉（ウクライナなど）', sev: 3, days: 240 }, major: 1 }),
    E([1933, 1], 'fyp2', '第2次五カ年計画（1933〜37年）が始まった', { d: { dict: 5 } }),
    E([1934, 12], 'kirov', 'キーロフが暗殺された（12月1日）。これをきっかけに、反対派への弾圧が強められた', { d: { terror: 15 } }),
    E([1936, 8], 'trial1', '第1次モスクワ裁判（8月）。かつての革命の指導者らが見せしめの裁判で有罪とされ、処刑された', { d: { terror: 15, dict: 5 } }),
    E([1936, 12], 'constitution', '新憲法（スターリン憲法）が採択された（12月）', { d: { cult: 10 } }),
    E([1937, 6], 'army', '赤軍の最高幹部らが逮捕・処刑された（6月）', { d: { terror: 10 } }),
    E([1937, 8], 'purge', '大粛清の最盛期（1937〜38年）。秘密警察NKVDの命令で、約68万人が銃殺されたと推計される。数百万人が逮捕され、強制収容所（グラーグ）に送られた', { d: { terror: 30, cult: 10 }, crisis: { kind: 'unrest', title: '大粛清（ソ連）', sev: 3, days: 150 }, major: 1 }),
    E([1938, 3], 'trial3', '第3次モスクワ裁判（3月）。ブハーリンらが有罪とされ、処刑された', { d: { terror: 5 } }),
    E([1939, 8], 'pact', '独ソ不可侵条約が結ばれた（8月23日）', { tension: 3, pair: [['h_su', 'h_de', 20]], major: 1 }),
    E([1939, 9], 'poland', 'ポーランドの東部に進軍した（9月17日）', { tension: 3 }),
    E([1939, 11], 'winter', 'フィンランドに侵攻した（冬戦争）', { tension: 2 }),
    E([1941, 4], 'neutrality', '日ソ中立条約が結ばれた（4月13日）', { jp: 6, major: 1 }),
    E([1941, 6], 'invasion', 'ドイツ軍の侵攻で、独ソ戦（大祖国戦争）が始まった（6月22日）', { tension: 2 }),
    E([1943, 2], 'stalingrad', 'スターリングラードの戦いに勝った（2月2日）', { d: { cult: 5 } }),
    E([1945, 2], 'yalta', 'ヤルタ会談（2月）。ソ連の対日参戦が取り決められた', { tension: 1 }),
    E([1945, 8], 'japan', '日ソ中立条約を破棄して対日参戦した（8月8日）。満洲・南樺太・千島列島に進攻した', { jp: -30, tension: 4, major: 1 }),
    E([1949, 8], 'bomb', '初の原子爆弾の実験に成功した', { tension: 4 }),
    E([1953, 3], 'end', 'スターリンが死去した（3月5日）。個人崇拝の時代が終わり、集団指導に移った', { end: true, tension: -4, major: 1 }),
  ] },
  h_cn: { origin: [1949, 10], events: [
    E([1949, 10], 'founding', '中華人民共和国が成立した（10月1日）。毛沢東が中央人民政府の主席になった', { d: { dict: 10, cult: 10 }, major: 1 }),
    E([1950, 10], 'korea', '朝鮮戦争に、中国人民志願軍が参戦した（10月）', { tension: 5, conflict: { with: 'kr', id: 'hist_korea', name: '朝鮮戦争', intensity: 3 }, pair: [['h_cn', 'us', -20]], major: 1 }),
    E([1950, 10], 'tibet', 'チベットに軍を進めた（10月）', { tension: 2 }),
    E([1950, 12], 'landreform', '土地改革と「反革命鎮圧運動」（1950〜52年）。地主とされた人々が打倒され、多くが処刑・拘束された', { d: { terror: 15 } }),
    E([1952, 1], 'campaigns', '「三反・五反運動」（1951〜52年）。官僚や資本家を対象にした大衆運動が行われた', { d: { terror: 5 } }),
    E([1953, 1], 'fyp', '第1次五カ年計画（1953〜57年）が始まった。重工業を中心に、計画経済を進める', { d: { dict: 5 } }),
    E([1953, 7], 'armistice', '朝鮮戦争が休戦した（7月）', { endConflicts: ['hist_korea'], tension: -4 }),
    E([1957, 6], 'antirightist', '反右派闘争（1957年）。共産党に意見を述べた知識人ら数十万人が「右派」とされ、職や地位を追われた', { d: { terror: 20, cult: 5 } }),
    E([1958, 5], 'leap', '大躍進政策が始まった（1958年）。人民公社をつくり、鉄鋼などの大増産をめざした。無理な集団化が混乱を広げた', { d: { cult: 10, dict: 5 }, major: 1 }),
    E([1959, 7], 'lushan', '廬山会議（7月）。大躍進を批判した彭徳懐が失脚した', { d: { terror: 10, cult: 10 } }),
    E([1959, 12], 'famine', '大飢饉（1959〜61年）。大躍進の失敗と不作で、多くの人が飢えで亡くなった。犠牲者は1500万〜4500万人とも推計される', { d: { terror: 10 }, crisis: { kind: 'humanitarian', title: '中国の大飢饉（大躍進のあと）', sev: 3, days: 360 }, major: 1 }),
    E([1962, 1], 'sevenk', '七千人大会（1962年1月）。毛沢東が責任の一端を認め、調整政策に転じた', { d: { cult: -10 } }),
    E([1964, 10], 'nuclear', '初の核実験に成功した（10月16日）', { tension: 4 }),
    E([1966, 5], 'cr', '文化大革命が始まった（5月）。毛沢東が「資本主義の道を歩む実権派」への批判を呼びかけ、学生らの紅衛兵が各地で運動を広げた', { d: { terror: 25, cult: 25, dict: 15 }, crisis: { kind: 'unrest', title: '文化大革命（中国）', sev: 3, days: 700 }, major: 1 }),
    E([1966, 8], 'redguards', '紅衛兵が毛沢東に迎えられ、『毛主席語録』が大量に配られた。毛沢東への個人崇拝が頂点に向かった', { d: { cult: 20 } }),
    E([1967, 1], 'seize', '各地で奪権闘争と武力衝突が広がり、国が混乱した（1967〜68年）', { d: { terror: 10 }, tension: 2 }),
    E([1968, 12], 'xiafang', '都市の知識青年を農村へ送る「下放」が進められた', { d: { terror: 5 } }),
    E([1971, 9], 'lin', '林彪事件（9月）。後継者とされた林彪が国外へ逃れようとして、墜落死した', { d: { cult: -5 } }),
    E([1972, 2], 'nixon', 'ニクソン米大統領が訪中した（2月）', { pair: [['h_cn', 'us', 25]], tension: -3 }),
    E([1972, 9], 'japan', '日中共同声明が出された（9月29日）。日本と中国が国交を正常化した', { jp: 25, major: 1 }),
    E([1976, 9], 'end', '毛沢東が死去した（9月9日）。10月に「四人組」が逮捕され、文化大革命は終わった。文化大革命の犠牲者は、数十万〜200万人とも推計される', { end: true, tension: -3, major: 1 }),
  ] },
  h_kh: { origin: [1975, 4], events: [
    E([1975, 4], 'fall', 'プノンペンを制圧した（4月17日）。都市の住民のほぼ全員が農村へ移された', { d: { terror: 25, dict: 30, cult: 5 }, major: 1 }),
    E([1975, 6], 'abolish', '通貨・市場・学校・宗教が廃止され、旧政権の関係者や知識人が処刑された', { d: { terror: 20 } }),
    E([1976, 1], 'constitution', '民主カンプチア憲法が施行され、国名が改められた（1月）', { d: { dict: 10 } }),
    E([1976, 4], 'primeminister', 'ポル・ポトが首相になった（4月）', { d: { cult: 5 } }),
    E([1976, 8], 'labor', '農村では強制労働と集団生活が続き、食糧不足と病気が広がった。政治犯の収容所（S-21＝トゥール・スレンなど）では、多くの人が尋問を受けたのち殺害された', { d: { terror: 25 }, crisis: { kind: 'humanitarian', title: 'カンボジアの強制労働と虐殺', sev: 3, days: 400 }, major: 1 }),
    E([1977, 4], 'border', 'ベトナムとの国境で武力衝突が激しくなった（1977年）', { tension: 3, conflict: { with: 'vn', id: 'hist_kh_vn', name: 'カンボジア・ベトナム紛争', intensity: 2 }, pair: [['h_kh', 'vn', -10]] }),
    E([1977, 9], 'purge', '党の内部でも粛清が進んだ（1977〜78年）', { d: { terror: 10 } }),
    E([1978, 12], 'invasion', 'ベトナム軍が侵攻した（12月25日）', { tension: 3 }),
    E([1979, 1], 'end', '首都プノンペンが陥落し（1月7日）、ポル・ポト政権は首都を失った。政権のもとでの犠牲者は、飢えや病気、処刑を合わせて150万〜200万人と推計される（人口の約4分の1）', { end: true, endConflicts: ['hist_kh_vn'], tension: -2, major: 1 }),
  ] },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const monthsOf = (R, ym) => (ym[0] - R.origin[0]) * 12 + (ym[1] - R.origin[1]);

// the state of one regime: { t0, done: { id: day }, dict, cult, terror, log: [{ day, id }], over }
export function histEvState(g, X, id, create = false) {
  const s = X.W(g);
  const all = s.histEv && typeof s.histEv === 'object' ? s.histEv : (create ? (s.histEv = {}) : null);
  if (!all) return null;
  let st = all[id];
  if (!st && create) st = all[id] = { t0: X.today(g), done: {}, dict: 25, cult: 10, terror: 10, log: [], over: false };
  return st || null;
}
export function histEvDrop(g, X, id) { const s = X.W(g); if (s.histEv) delete s.histEv[id]; }
export const histEventsOn = (g) => !(g && g.state && g.state.histEvents === false);

// the summary for the country page: the indices and the last events
export function histEvSummary(g, X, id) {
  const st = histEvState(g, X, id, false);
  const R = CHRON[id];
  if (!st || !R) return null;
  const ev = (st.log || []).slice(-3).reverse().map((l) => { const e = R.events.find((x) => x.id === l.id); const d = X.worldDate(g, l.day); return { date: `${d.year}年${d.month}月`, text: e ? e.text : '', id: l.id }; });
  return { dict: Math.round(st.dict), cult: Math.round(st.cult), terror: Math.round(st.terror), events: ev, over: !!st.over, on: histEventsOn(g) };
}

// every morning: fire what is due (≤ 2 events per regime per morning; ≤ 1 phone message)
export function histEventsTick(g, X, onIds) {
  if (!histEventsOn(g)) return;
  let phoned = false;
  for (const id of onIds) {
    const R = CHRON[id];
    if (!R) continue;
    const st = histEvState(g, X, id, true);
    if (st.over) continue;
    const months = Math.floor((X.today(g) - st.t0) / 10);
    let n = 0;
    for (const ev of R.events) {
      if (st.done[ev.id] != null) continue;
      if (monthsOf(R, ev.ym) > months) break;
      if (n >= 2) break;
      n++;
      st.done[ev.id] = X.today(g);
      st.log.push({ day: X.today(g), id: ev.id });
      if (st.log.length > 40) st.log.shift();
      if (ev.d) { st.dict = clamp(st.dict + (ev.d.dict || 0), 0, 100); st.cult = clamp(st.cult + (ev.d.cult || 0), 0, 100); st.terror = clamp(st.terror + (ev.d.terror || 0), 0, 100); }
      X.news(g, `【国際】${X.shortName(g, id)}：${ev.text}`, { raw: true });
      if (ev.major && !phoned) { phoned = true; X.phoneRaw(g, `【国際ニュース】${X.shortName(g, id)}\n${ev.text}`); }
      if (ev.tension) X.tensionShift(g, ev.tension);
      if (ev.jp && X.exists(g, id)) X.relAdd(g, id, ev.jp);
      for (const [a, b, d] of ev.pair || []) if (X.exists(g, a) && X.exists(g, b)) X.pairAdd(g, a, b, d);
      if (ev.crisis) X.crisis(g, { kind: ev.crisis.kind, title: ev.crisis.title, country: id, sev: ev.crisis.sev, until: X.today(g) + ev.crisis.days, hist: id });
      if (ev.conflict && X.exists(g, ev.conflict.with)) X.newConflict(g, id, ev.conflict.with, { id: ev.conflict.id, name: ev.conflict.name, intensity: ev.conflict.intensity, scripted: true, quiet: true, crisis: true });
      for (const cid of ev.endConflicts || []) X.endConflict(g, cid, 'end', `${(X.W(g).conflicts.find((c) => c.id === cid) || {}).name || '戦争'}が終わった`);
      if (ev.end) { st.over = true; X.endRegime(g, id); break; }
    }
  }
}
