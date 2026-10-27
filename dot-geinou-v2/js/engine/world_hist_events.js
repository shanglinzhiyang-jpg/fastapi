// 歴史の出来事 (R14-H2): a regime that joins the 世界情勢 (設定 → 歴史の列強) lives through its own history in order, month by month from the day it was switched on
// (1 game month = 10 days): the laws, the camps, the purges, the wars, the famines and the end of the regime, as 世界情勢 news, 危機 (人道危機・戦争) and three
// indices on the country page (独裁・個人崇拝・弾圧). The player is Japan's leader or a citizen: the events are what happens in the world, and the usual responses of the
// 外交 tab (抗議・制裁・人道支援・国連・難民への対応) are what the player can do about them. The words are the facts of the historical record, with estimates given as estimates;
// the regime's stated reasons are the documented ones, always given as its claim and always followed by what the world said about it; the player never carries out any of it.
//
// ≤ 1 phone message per morning from this system (only the events marked `major`); every event is in the 世界情勢 news, with the regime's own stated reason (「政府の主張」) and
// the world's reaction (mostly condemnation). At the end of its history a regime does NOT hand the country back: the last event is a turning point that goes the way of history
// (the regime falls: 移行期) or, sometimes, differently (IF: the regime goes on, and its policies of the time are carried out in today's world, one by one, with their effects).
// The modern country comes back only when the player switches the regime off in 設定.
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
    E([1936, 10], 'axis', 'ローマ・ベルリン枢軸（10月）。ドイツと協力関係を結んだ', { pair: [['h_it', 'h_de', 10]], ally: { id: 'hist_axis', name: '独伊の枢軸', short: '独伊枢軸', members: ['h_it', 'h_de'], kind: 'partnership' } }),
    E([1937, 11], 'anticomintern', '日独防共協定に加わった（11月6日）', { jp: 8, major: 1 }),
    E([1938, 9], 'racial', '人種法が定められた（1938年）。ユダヤ人が学校や公職から排除された', { d: { terror: 10 } }),
    E([1939, 4], 'albania', 'アルバニアを併合した（4月）', { tension: 3 }),
    E([1939, 5], 'steel', '独伊軍事同盟（鋼鉄協約、5月22日）が結ばれた', { pair: [['h_it', 'h_de', 8]], ally: { id: 'hist_axis', name: '独伊軍事同盟（鋼鉄協約）', short: '独伊同盟', members: ['h_it', 'h_de'], kind: 'defense' } }),
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
    E([1950, 2], 'sino-soviet', '中ソ友好同盟相互援助条約が結ばれた（2月14日）', { ally: { id: 'hist_sinosoviet', name: '中ソ友好同盟相互援助条約', short: '中ソ同盟', members: ['h_cn', 'h_su'], kind: 'defense' }, pair: [['h_cn', 'h_su', 15]] }),
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
    E([1976, 3], 'china-support', '中国が、経済と軍事の面で民主カンプチアを支える関係になった', { ally: { id: 'hist_kh_cn', name: '中国・カンプチア協力', short: '中カ協力', members: ['h_kh', 'h_cn'], kind: 'partnership' }, pair: [['h_kh', 'h_cn', 10]] }),
    E([1976, 8], 'labor', '農村では強制労働と集団生活が続き、食糧不足と病気が広がった。政治犯の収容所（S-21＝トゥール・スレンなど）では、多くの人が尋問を受けたのち殺害された', { d: { terror: 25 }, crisis: { kind: 'humanitarian', title: 'カンボジアの強制労働と虐殺', sev: 3, days: 400 }, major: 1 }),
    E([1977, 4], 'border', 'ベトナムとの国境で武力衝突が激しくなった（1977年）', { tension: 3, conflict: { with: 'vn', id: 'hist_kh_vn', name: 'カンボジア・ベトナム紛争', intensity: 2 }, pair: [['h_kh', 'vn', -10]] }),
    E([1977, 9], 'purge', '党の内部でも粛清が進んだ（1977〜78年）', { d: { terror: 10 } }),
    E([1978, 12], 'invasion', 'ベトナム軍が侵攻した（12月25日）', { tension: 3 }),
    E([1979, 1], 'end', '首都プノンペンが陥落し（1月7日）、ポル・ポト政権は首都を失った。政権のもとでの犠牲者は、飢えや病気、処刑を合わせて150万〜200万人と推計される（人口の約4分の1）', { end: true, endConflicts: ['hist_kh_vn'], tension: -2, major: 1 }),
  ] },
};

// the regime's stated reason (as it was given) and the world's reaction: id → [claim, reaction]
export const CLAIMS = {
  h_de: {
    chancellor: ['民族の再生と国民の団結', '議会の各政党は、新政権への警戒を表明した'],
    reichstag: ['共産主義者の暴動から国家を守るための措置', '野党や海外の報道は、基本的人権の停止だとして強く批判した'],
    enabling: ['民族と国家の危難を取り除くため', '各国の新聞や亡命者は、議会制民主主義の終わりだとして強く非難した'],
    dachau: ['国家に敵対する者の「保護拘禁」', '人権団体と海外の報道は、法的な根拠のない拘束だとして非難した'],
    boycott: ['外国での「ドイツ非難の宣伝」への対抗措置', '米英などで抗議集会が開かれ、国際的な非難が高まった'],
    oneparty: ['国民の統一のため', '各国は、一党独裁の確立だとして批判した'],
    knives: ['国家への反逆を未然に防いだ', '海外の新聞は、裁判なしの殺害だとして厳しく批判した'],
    fuhrer: ['国民投票で圧倒的に支持された', '各国は、すべての権限が一人に集まったことへの懸念を表明した'],
    rearm: ['対等な安全保障を求める権利', '英国・フランス・イタリアは、条約違反だとして共同で抗議した'],
    nuremberg: ['「ドイツ人の血と名誉を守るため」（法律の題名）', '各国の人権団体や宗教界は、人種による差別を制度にしたものだとして強く非難した'],
    rhineland: ['ドイツの主権の回復', 'フランスと英国は条約違反だと抗議し、国際連盟も非難した'],
    anticomintern: ['共産主義への共同の防衛', 'ソ連は強く反発し、各国は軍事同盟に近いと警戒した'],
    anschluss: ['同じ民族の統合（住民投票での支持）', '英国・フランスなどは抗議し、併合を認めないと表明した'],
    kristall: ['国民の自発的な怒りの表れ', '各国は暴力と迫害を強く非難し、米国は大使を召還した'],
    czech: ['チェコスロバキアの「保護」', '英国とフランスは、ミュンヘン合意への違反だとして非難した'],
    ww2: ['ポーランドの挑発への反撃', '英国とフランスは宣戦し、国際社会は侵略だとして非難した'],
    west: ['英仏の攻撃を先に防ぐため', '中立国への侵攻は、国際法違反だとして強く非難された'],
    barbarossa: ['ソ連の攻撃を未然に防ぐ予防戦争', '英国と米国は侵略だと非難し、ソ連への支援を表明した'],
    shooting: ['公式には「治安作戦」と呼ばれた', '戦後の国際軍事裁判で、人道に対する罪とされた'],
    wannsee: [null, '戦後の裁判で、組織的な殺害の計画を示す証拠とされた'],
    camps: ['「東方への移送」「労働のため」と説明された（実態は隠された）', '連合国は1942年12月に、ユダヤ人の殺害を非難する共同宣言を出した'],
  },
  h_it: {
    march: ['国家の再生と秩序の回復', '自由主義者や社会主義者は、暴力による政権獲得だと批判した'],
    matteotti: ['党は事件と無関係だと主張した', '野党議員は議会をボイコットし、国民の抗議が広がった'],
    dictatorship: ['事件の「政治的・道徳的な責任」は自分にある、と議会で述べた', '野党は排除され、自由主義者は独裁の宣言だとして強く批判した'],
    laws: ['国家の安全のため', '反対派の多くは逮捕されるか国外に亡命し、亡命先から批判を続けた'],
    ethiopia: ['植民地での「文明化」と自衛', '国際連盟は侵略と認め、経済制裁を決めた'],
    annex: ['エチオピアは文明化された、と主張した', '英国やフランスなどの多くの国は併合を承認せず、非難した'],
    racial: ['イタリア人の「人種」を守るため', '教皇庁や国内外の批判が高まった'],
    albania: ['アルバニアの「保護」', '国際社会は、小国への侵略だとして非難した'],
    war: ['「持たざる国」の戦い', '英国とフランスは宣戦し、各国は参戦を非難した'],
  },
  h_su: {
    fyp1: ['社会主義の建設と、国の工業化', '西側の政府や報道は、強制的な労働と国民の窮乏を指摘した'],
    collectivization: ['富農を階級として一掃する', '亡命者や海外の報道は、強制と暴力を批判した'],
    famine: ['飢饉は存在しない、と否定した', '海外の記者や救援団体が実情を報じ、国際的な批判が高まった'],
    kirov: ['反革命の陰謀を摘発する', '海外の観察者は、弾圧の口実に使われたと見た'],
    trial1: ['トロツキー派の陰謀とスパイ行為', '各国の新聞や知識人は、見せしめの裁判だとして批判した'],
    constitution: ['世界で最も民主的な憲法', '亡命者や海外の識者は、実態とかけ離れていると批判した'],
    army: ['ドイツや日本と通じた陰謀', '各国の軍事筋は、赤軍が弱体化したと見た'],
    purge: ['「人民の敵」を摘発する', '海外の外交官や報道は、無差別な大量逮捕と処刑だとして強く非難した'],
    trial3: ['陰謀とスパイの罪', '海外は、茶番の裁判だとして批判した'],
    pact: ['平和の確保', '英国とフランスは衝撃を受け、のちに密約の存在を非難した'],
    poland: ['同胞（ウクライナ人・ベラルーシ人）の保護', 'ポーランドと英仏は、侵略だとして非難した'],
    winter: ['国境の安全のため', '国際連盟は、ソ連を除名した'],
    japan: ['連合国との約束を果たす', '日本は、中立条約を破る不法な参戦だとして強く非難した'],
  },
  h_cn: {
    korea: ['「アメリカに抵抗し、朝鮮を援助する」', '国連総会は、中国を侵略者とする決議を採択した'],
    tibet: ['「平和解放」', 'チベット側と各国は、侵略だとして非難した'],
    landreform: ['階級の敵を打倒する', '海外の報道は、多数の処刑を伝えて批判した'],
    antirightist: ['党を批判する「毒草」を取り除く', '海外の知識人は、言論の弾圧だとして批判した'],
    leap: ['15年でイギリスに追いつく', '国外の専門家は、非現実的だと指摘した'],
    lushan: ['反党的な集団を摘発する', '海外は、権力闘争による粛清だと見た'],
    famine: ['自然災害のため', 'のちに、国内外の研究者は政策の失敗が原因だと指摘した'],
    nuclear: ['防衛のため', '米国などは、核の拡散への懸念を示して批判した'],
    cr: ['資本主義の復活を防ぐ', '各国は、教師や知識人への迫害を批判し、在外公館が襲われた国は抗議した'],
    redguards: ['革命の後継者を育てる', '海外の報道は、個人崇拝の異様な広がりを批判した'],
    seize: ['革命の奪権', '各国は、国の混乱と暴力を懸念し批判した'],
    xiafang: ['青年は農村で学ぶべきだ', '海外の研究者は、教育の機会を奪うものだと批判した'],
  },
  h_kh: {
    fall: ['米軍の爆撃から守り、新しい社会を築くため、都市を空にする', '各国の記者や援助団体は、病人や子どもを含む強制移住を強く非難した'],
    abolish: ['新しい社会の建設', '逃れた難民の証言が国際社会に伝わり、批判が高まった'],
    constitution: ['民主カンプチアの建国', '各国は、実態のない「民主」だと批判した'],
    labor: ['生産の拡大と自給自足', '難民の証言をもとに、国連の機関や各国が強く非難した'],
    border: ['ベトナムの領土的な野心への自衛', 'ベトナムはカンボジアの攻撃を非難し、各国は両国に自制を求めた'],
    purge: ['党内に潜む「裏切り者」の一掃', '亡命者の証言から、党内の粛清が国際的に非難された'],
    invasion: [null, 'ベトナム軍の侵攻に、各国の評価は分かれた。一方で、政権のもとでの人権侵害への非難は続いた'],
  },
};
// what happens at the regime's last event when history goes another way (IF)
export const IFEND = {
  h_de: { text: 'ドイツは連合国と休戦した（降伏ではない）。史実とは異なり、ヒトラーの体制は存続した', claim: '戦いは終わっておらず、国は敗れていない', react: '各国は、体制が続くことを強く非難し、制裁と包囲を続けると表明した' },
  h_it: { text: 'ムッソリーニは解任を免れ、ファシスト党の一党体制が続いた（史実とは異なる展開）', claim: '国内の危機は収まった', react: '各国は、独裁体制の存続を非難し、国際的な孤立が深まった' },
  h_su: { text: 'スターリンは健在で、個人崇拝と一党体制がそのまま続いた（史実とは異なる展開）', claim: '社会主義の勝利は続く', react: '各国は、弾圧が続いていることを強く非難した' },
  h_cn: { text: '毛沢東は健在で、文化大革命の路線が改められずに続いた（史実とは異なる展開）', claim: '革命は継続する', react: '各国は、個人崇拝と弾圧の継続を批判し、関係を見直す国が出た' },
  h_kh: { text: 'ベトナム軍の侵攻は退けられ、ポル・ポトの体制が続いた（史実とは異なる展開）', claim: '外国の侵略を打ち破った', react: '各国は、強制労働と虐殺の継続を強く非難し、国連で問題が取り上げられた' },
};
// the regime's policies of the time, carried out in today's world (the IF): { id, text, claim, react, d, tension, crisis, pair, trade }
const P = (id, text, claim, react, o = {}) => ({ id, text, claim, react, ...o });
export const IFPOL = {
  h_de: [
    P('rearm', 'いまの世界で再軍備を進め、軍事費を急増させた', '対等な安全保障を求める権利', 'NATOと近隣の国々は、強く非難した', { tension: 4, pair: [['h_de', 'us', -8], ['h_de', 'gb', -8], ['h_de', 'fr', -8]], d: { dict: 3 } }),
    P('media', 'インターネットと報道を国が管理し、批判的な発信が取りしまわれた', '国民の統一を守るため', '各国や国際機関は、表現の自由への重大な侵害だとして非難した', { d: { cult: 6, terror: 4 } }),
    P('race', '国籍と市民権を、民族で区別する法律が定められた', '国民の血と名誉を守るため', '国連の人権機関と各国は、人種差別だとして強く非難した', { d: { terror: 8 }, crisis: { kind: 'humanitarian', title: '民族による差別の法律（IF）', sev: 3, days: 200 }, pair: [['h_de', 'us', -6]] }),
    P('camps', '反対派や少数者を拘束する収容施設が各地に作られた', '治安の維持', '人権団体と各国は、直ちに閉鎖するよう強く非難した', { d: { terror: 10 }, crisis: { kind: 'humanitarian', title: '収容施設への拘束（IF）', sev: 3, days: 250 } }),
    P('border', '周辺国に、国境の「見直し」を要求して圧力をかけた', 'ドイツ人の権利の保護', '周辺国と欧州の国々は、侵略の前ぶれだとして強く警戒し、非難した', { tension: 6, crisis: { kind: 'incident', title: '国境をめぐる圧力（IF）', sev: 2, days: 120 }, trade: 1 }),
  ],
  h_it: [
    P('party', '党以外の政治活動が禁じられ、選挙が形だけのものになった', '国の秩序と団結', '各国は、一党独裁の復活だとして非難した', { d: { dict: 6 } }),
    P('media', '報道とSNSが国に管理され、指導者への賛美が義務づけられた', '国民の統一', '国際機関と各国は、言論統制だとして非難した', { d: { cult: 6, terror: 3 } }),
    P('colony', '海外の領土を求めて、軍を派遣した', '国の「居場所」をつくる', '国連や各国は、侵略だとして強く非難した', { tension: 5, crisis: { kind: 'war', title: '海外への軍事行動（IF）', sev: 2, days: 160 }, pair: [['h_it', 'gb', -8], ['h_it', 'fr', -6]] }),
    P('special', '反対派を裁く特別な法廷と、秘密警察が復活した', '国家の安全', '人権団体と各国は、強く非難した', { d: { terror: 8 } }),
  ],
  h_su: [
    P('fyp', '新しい五カ年計画で、国が産業・農業・情報技術の目標を各地に割り当てた', '計画経済の優位', '各国の経済界は、市場を無視した計画の失敗を懸念した', { d: { dict: 4 }, trade: 1 }),
    P('collect', '農業の集団化と穀物の徴発が再び進められた', '国の食糧の確保', '国連の機関と各国は、飢饉の恐れがあるとして強く非難した', { d: { terror: 8 }, crisis: { kind: 'humanitarian', title: '穀物の徴発と食糧不足（IF）', sev: 3, days: 220 } }),
    P('purge', '「人民の敵」の摘発が始まり、官僚や軍の幹部が大量に拘束された', '体制の敵の一掃', '国際社会は、大量の拘束と見せしめの裁判を強く非難した', { d: { terror: 14, cult: 4 }, crisis: { kind: 'unrest', title: '大粛清の再来（IF）', sev: 3, days: 160 } }),
    P('cult', '指導者への個人崇拝が、報道と教育を通じて全国に広げられた', '国民の団結', '各国は、個人崇拝の強要だとして批判した', { d: { cult: 10 } }),
    P('camps', '強制労働の収容所（グラーグ）が、各地に作られた', '労働による再教育', '人権団体と各国は、強制労働だとして閉鎖を求め、非難した', { d: { terror: 10 }, crisis: { kind: 'humanitarian', title: '強制労働収容所（IF）', sev: 3, days: 250 } }),
  ],
  h_cn: [
    P('leap', '全国で、無理な生産目標をかかげる「大躍進」が再び始まった', '短期間での大増産', '国外の専門家は、飢饉をまねくとして強く警告した', { d: { cult: 6 }, trade: 1 }),
    P('famine', '農村で食糧不足が広がり、多くの人が飢えに苦しんだ', '自然災害のため', '国連の機関と各国は、人道危機だとして支援を申し出たが、受け入れられなかった', { d: { terror: 6 }, crisis: { kind: 'humanitarian', title: '食糧不足と飢え（IF）', sev: 3, days: 260 } }),
    P('cr', '大学・企業・官庁で、思想の「審査」と批判運動が広がった（文化大革命型）', '資本主義の復活を防ぐ', '各国は、知識人への迫害だとして強く批判し、関係を見直す動きが出た', { d: { terror: 12, cult: 8 }, crisis: { kind: 'unrest', title: '思想の審査と批判運動（IF）', sev: 3, days: 220 }, trade: 1 }),
    P('cult', '指導者の語録の学習が、全国で義務づけられた', '思想の統一', '各国は、個人崇拝の強要だとして批判した', { d: { cult: 10 } }),
    P('rural', '都市の若者や知識人が、農村へ送られた（下放型）', '農村で学ぶ', '国連の機関と各国は、教育の機会の侵害だと批判した', { d: { terror: 6 } }),
  ],
  h_kh: [
    P('city', '都市の住民が、農村へ強制的に移された', '都市は不要になった', '国連の機関と各国は、強制移住を強く非難した', { d: { terror: 12 }, crisis: { kind: 'humanitarian', title: '都市住民の強制移住（IF）', sev: 3, days: 200 } }),
    P('money', '通貨と市場、学校、宗教が廃止された', '新しい社会の建設', '各国は、社会の破壊だとして強く批判した', { d: { dict: 5, terror: 6 } }),
    P('labor', '農村での強制労働と集団生活が義務づけられた', '自給自足のため', '人権団体と各国は、強制労働だとして強く非難した', { d: { terror: 12 }, crisis: { kind: 'humanitarian', title: '強制労働と食糧不足（IF）', sev: 3, days: 260 } }),
    P('prison', '政治犯の収容所で、多くの人が拘束され殺害された', '裏切り者の一掃', '国連と各国は、虐殺として強く非難し、国際的な調査を求めた', { d: { terror: 14 }, crisis: { kind: 'humanitarian', title: '政治犯の収容所と虐殺（IF）', sev: 3, days: 300 } }),
  ],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num0 = (v, d) => (Number.isFinite(v) ? v : d);
const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const monthsOf = (R, ym) => (ym[0] - R.origin[0]) * 12 + (ym[1] - R.origin[1]);
// how often history goes another way at the regime's last event (設定: g.state.histIf = 'none' | 'low' | 'mid' | 'high')
export const IF_LEVELS = { none: 0, low: 0.25, mid: 0.5, high: 0.75 };
export const IF_LABEL = { none: 'なし', low: '少なめ', mid: 'ふつう', high: '多め' };
export const histIfLevel = (g) => { const v = g && g.state && g.state.histIf; return IF_LEVELS[v] != null ? v : 'mid'; };

// the state of one regime: { t0, done, dict, cult, terror, log, mode: 'hist'|'if'|'fallen', ifIdx, nextIf }
export function histEvState(g, X, id, create = false) {
  const s = X.W(g);
  const all = s.histEv && typeof s.histEv === 'object' ? s.histEv : (create ? (s.histEv = {}) : null);
  if (!all) return null;
  let st = all[id];
  if (!st && create) st = all[id] = { t0: X.today(g), done: {}, dict: 25, cult: 10, terror: 10, support: 58, log: [], mode: 'hist', ifIdx: 0, nextIf: 0, yr: 0 };
  return st || null;
}
export function histEvDrop(g, X, id) { const s = X.W(g); if (s.histEv) delete s.histEv[id]; }
export const histEventsOn = (g) => !(g && g.state && g.state.histEvents === false);

// the summary for the country page: the indices, the mode and the last events (each with the regime's claim and the world's reaction)
export function histEvSummary(g, X, id) {
  const st = histEvState(g, X, id, false);
  const R = CHRON[id];
  if (!st || !R) return null;
  const ev = (st.log || []).slice(-3).reverse().map((l) => { const d = X.worldDate(g, l.day); return { date: `${d.year}年${d.month}月`, text: l.text || '', claim: l.claim || '', react: l.react || '', iff: !!l.iff, pro: l.pro || [], con: l.con || [], mid: l.mid || [] }; });
  return { dict: Math.round(st.dict), cult: Math.round(st.cult), terror: Math.round(st.terror), support: Math.round(num0(st.support, 55)), years: Math.floor((X.today(g) - st.t0) / 120), events: ev, mode: st.mode || 'hist', on: histEventsOn(g) };
}

// how the other countries took it: they do not all see it alike (the relation with the regime, its allies, how heavy the event is, and each country's own temper)
function reactions(g, X, id, o, key) {
  const heavy = !!((o.d && o.d.terror >= 12) || (o.crisis && o.crisis.kind !== 'war') || (o.conflict) || (o.tension >= 5));
  const allies = new Set((X.alliesOf(g, id) || []).map((a) => a.id));
  const proT = heavy ? 52 : 34, conT = heavy ? 14 : -22;
  const pro = [], con = [], mid = [];
  for (const c of [...X.countriesNow(g), 'jp']) {
    if (c === id) continue;
    let r = c === 'jp' ? X.relation(g, id) : X.pairRelation(g, c, id);
    if (allies.has(c)) r += 40;
    r += (hash(`${c}|${key}`) % 25) - 12;
    (r >= proT ? pro : r <= conT ? con : mid).push([c, r]);
  }
  const nm = (arr, asc) => arr.sort((a, b) => (asc ? a[1] - b[1] : b[1] - a[1])).slice(0, 4).map(([c]) => (c === 'jp' ? '日本' : X.shortName(g, c)));
  return { pro: nm(pro, false), con: nm(con, true), mid: nm(mid, false).slice(0, 3) };
}
// an alliance of the regime (shown in 同盟; the player's own alliance with it is the usual 外交 action)
function makeAlliance(g, X, id, a) {
  if (!a.members.every((m) => X.exists(g, m))) return;
  const s = X.W(g);
  s.alliances[a.id] = { player: true, hist: true, name: a.name, short: a.short, kind: a.kind || 'partnership', members: a.members.slice(), strength: a.kind === 'defense' ? 70 : 45, since: X.today(g) };
}
function apply(g, X, id, st, o, text, claim, react, iff) {
  if (o.d) { st.dict = clamp(st.dict + (o.d.dict || 0), 0, 100); st.cult = clamp(st.cult + (o.d.cult || 0), 0, 100); st.terror = clamp(st.terror + (o.d.terror || 0), 0, 100); }
  const head = `${iff ? '【IF】' : ''}${text}`;
  const rc0 = reactions(g, X, id, o, o.id || head);
  const sides = `${rc0.pro.length ? `支持：${rc0.pro.join('・')}　` : ''}${rc0.con.length ? `非難：${rc0.con.join('・')}` : ''}`;
  const tail = `${claim ? `（政府は「${claim}」と主張。` : '（'}${sides ? `${sides}。` : ''}${react || ''}）`;
  X.news(g, `【国際】${X.shortName(g, id)}：${head}${react || claim || sides ? tail : ''}`, { raw: true });
  const rc = reactions(g, X, id, o, o.id || head);
  if (X.tl) X.tl(g, `${X.shortName(g, id)}：${head}`, id); // the 外交の年表
  st.log.push({ day: X.today(g), text: head, claim: claim || '', react: react || '', iff: !!iff, pro: rc.pro, con: rc.con, mid: rc.mid });
  if (st.log.length > 40) st.log.shift();
  if (o.tension) X.tensionShift(g, o.tension);
  if (o.jp && X.exists(g, id)) X.relAdd(g, id, o.jp);
  for (const [a, b, d] of o.pair || []) if (X.exists(g, a) && X.exists(g, b)) X.pairAdd(g, a, b, d);
  if (o.crisis) X.crisis(g, { kind: o.crisis.kind, title: o.crisis.title, country: id, sev: o.crisis.sev, until: X.today(g) + o.crisis.days, hist: id });
  if (o.trade) X.tradeShock(g, id, -1, o.trade, `${X.shortName(g, id)}の政策による混乱`);
  if (o.ally) makeAlliance(g, X, id, o.ally);
  st.support = clamp(num0(st.support, 55) + (o.d ? ((o.d.cult || 0) * 0.25 - (o.d.terror || 0) * 0.05) : 0) - (o.crisis && o.crisis.kind === 'humanitarian' ? 3 : 0), 15, 95);
}


// every morning: fire what is due (≤ 2 events per regime per morning; ≤ 1 phone message)
export function histEventsTick(g, X, onIds) {
  if (!histEventsOn(g)) return;
  let phoned = false;
  for (const id of onIds) {
    const R = CHRON[id];
    if (!R) continue;
    const st = histEvState(g, X, id, true);
    if (!st.mode) st.mode = 'hist';
    if (st.mode === 'fallen') { st.support = clamp(num0(st.support, 30) - 0.5, 12, 95); continue; }
    const today = X.today(g);
    // the support at home: propaganda and control keep it high (it follows the cult of the leader); a bad famine or war dents it for a while
    if (today % 10 === 0) st.support = clamp(num0(st.support, 55) + (Math.min(92, 54 + st.cult * 0.4 + st.dict * 0.08) - num0(st.support, 55)) * 0.06, 15, 95);
    // every game year of rule: a milestone, and (in the IF) a small chance that it falls at last — less when the support is high
    const yrs = Math.floor((today - st.t0) / 120);
    if (yrs > (st.yr || 0)) {
      st.yr = yrs;
      if (yrs % 10 === 0) {
        const rc = reactions(g, X, id, { d: { terror: 0 } }, `ms${yrs}`);
        X.news(g, `【国際】${X.shortName(g, id)}：独裁体制は${yrs}年を超えた。国内の支持は約${Math.round(st.support)}%と高い（${rc.pro.length ? `支持：${rc.pro.join('・')}　` : ''}${rc.con.length ? `非難：${rc.con.join('・')}` : '各国の評価は分かれる'}）`, { raw: true });
      }
      if (st.mode === 'if' && X.roll(Math.max(0.006, (68 - st.support) / 700))) {
        st.mode = 'fallen';
        apply(g, X, id, st, { tension: -3, d: { cult: -25, terror: -15, dict: -30 } }, '長く続いた体制が、国内の不満と国際的な孤立の末に倒れた', null, '各国は、新しい国の姿を見守っている', false);
        continue;
      }
    }
    if (st.mode === 'hist') {
      const months = Math.floor((today - st.t0) / 10);
      let n = 0;
      for (const ev of R.events) {
        if (st.done[ev.id] != null) continue;
        if (monthsOf(R, ev.ym) > months) break;
        if (n >= 2) break;
        n++;
        st.done[ev.id] = today;
        const [claim, react] = (CLAIMS[id] && CLAIMS[id][ev.id]) || [null, null];
        if (ev.end) {
          // the turning point: history's way (the regime falls) or, sometimes, another (the regime goes on)
          const iff = X.roll(IF_LEVELS[histIfLevel(g)]);
          if (iff) {
            const A = IFEND[id];
            apply(g, X, id, st, { tension: 2, d: { cult: 5 } }, A.text, A.claim, A.react, true);
            st.mode = 'if'; st.nextIf = today + X.rint(50, 90);
          } else {
            apply(g, X, id, st, { tension: ev.tension || 0, d: { cult: -25, terror: -20, dict: -30 } }, ev.text, null, '各国は、この体制の終わりを受けて、新しい国の姿を見守っている');
            st.mode = 'fallen';
          }
          for (const cid of ev.endConflicts || []) X.endConflict(g, cid, 'end', `${(X.W(g).conflicts.find((c) => c.id === cid) || {}).name || '戦争'}が終わった`);
          if (ev.major && !phoned) { phoned = true; X.phoneRaw(g, `【国際ニュース】${X.shortName(g, id)}\n${iff ? IFEND[id].text : ev.text}`); }
          break;
        }
        apply(g, X, id, st, ev, ev.text, claim, react, false);
        if (ev.major && !phoned) { phoned = true; X.phoneRaw(g, `【国際ニュース】${X.shortName(g, id)}\n${ev.text}`); }
        if (ev.conflict && X.exists(g, ev.conflict.with)) X.newConflict(g, id, ev.conflict.with, { id: ev.conflict.id, name: ev.conflict.name, intensity: ev.conflict.intensity, scripted: true, quiet: true, crisis: true });
        for (const cid of ev.endConflicts || []) X.endConflict(g, cid, 'end', `${(X.W(g).conflicts.find((c) => c.id === cid) || {}).name || '戦争'}が終わった`);
      }
    } else if (st.mode === 'if' && today >= st.nextIf) {
      // the IF: the policies of the time, in today's world, one after another (a second round is harder)
      const list = IFPOL[id] || [];
      if (list.length) {
        const pol = list[st.ifIdx % list.length];
        const round = Math.floor(st.ifIdx / list.length);
        st.ifIdx++;
        const o = { ...pol, d: pol.d ? { dict: (pol.d.dict || 0) * (1 + round * 0.3), cult: (pol.d.cult || 0) * (1 + round * 0.3), terror: (pol.d.terror || 0) * (1 + round * 0.3) } : null };
        apply(g, X, id, st, o, `${round ? 'さらに、' : ''}${pol.text}`, pol.claim, pol.react, true);
        if (pol.crisis && !phoned) { phoned = true; X.phoneRaw(g, `【国際ニュース】${X.shortName(g, id)}\n${pol.text}`); }
      }
      st.nextIf = today + X.rint(70, 120);
      // in the IF the regime also looks for friends: a cooperation pact with a country that thinks well of it (or with another regime of its kind)
      if (X.roll(0.3)) {
        const cand = X.countriesNow(g).filter((c) => c !== id && !X.alliesOf(g, id).some((a) => a.id === c)).map((c) => [c, X.pairRelation(g, c, id)]).filter(([, r]) => r >= 20).sort((a, b) => b[1] - a[1])[0];
        if (cand) {
          const nameC = X.shortName(g, cand[0]);
          makeAlliance(g, X, id, { id: `hist_if_${id}_${cand[0]}`, name: `${X.shortName(g, id)}・${nameC}協力協定`, short: `${nameC}と協力`, members: [id, cand[0]], kind: 'partnership' });
          X.pairAdd(g, id, cand[0], 8);
          const rc = reactions(g, X, id, {}, `ally${today}`);
          X.news(g, `【国際】【IF】${X.shortName(g, id)}と${nameC}が協力協定を結んだ（支持：${[nameC, ...rc.pro.filter((n) => n !== nameC)].slice(0, 4).join('・')}${rc.con.length ? `　非難：${rc.con.join('・')}` : ''}）`, { raw: true });
        }
      }
    }
  }
}
