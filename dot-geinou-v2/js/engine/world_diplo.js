// 外交の深まり (diplomacy depth): the parts of the world-affairs core that make diplomacy a game of bargaining:
// negotiation sessions with rounds, concessions and a walk-away; 特使・外相会談・首脳会談; treaty ratification in the Diet
// (国会承認: 憲法61条・60条); what each treaty gives and costs; territorial questions (neutral facts, both positions);
// the home reaction by segment; 外務省 advice; visits of foreign leaders (titles only); communiqués that read differently at
// different relations; soft power; a diplomatic-standing score; the player's diplomacy timeline.
// Created by world.js (createDiplo(X)); the module has no imports. world_trade.js registers the 経済連携協定 and
// 関税交渉 negotiations and the tariff laws with the engine here.
//
// RULES (BRIEF2/3): leaders are never named (titles only); nothing is refused for being "bad" — odds, costs and
// consequences are shown; territorial text states each side's position; no preaching.

const LEVELS = { official: { name: '事務レベル協議', bonus: -0.08, stam: 0 }, fm: { name: '閣僚折衝（外相会談）', bonus: 0.03, stam: 12 }, summit: { name: '首脳協議', bonus: 0.11, stam: 22 } };
const LV = ['まだ何も出さない', '一部で歩み寄る', '大きく歩み寄る', 'ほぼ全面的に受け入れる'];
const LVT = ['約束なし', '一部の約束', '大きな約束', 'ほぼ全面的な約束'];
const SEG = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経済界', farmers: '農林漁業', unions: '労働組合', urban: '都市住民', rural: '地方住民', floating: '無党派層' };

// ---------------------------------------------------------------- treaty contents (what each gives and costs)
export const TREATY_INFO = {
  jp_su_1956: { gives: ['戦争状態の終結と国交の回復', '日本の国連加盟への道が開けた（1956年）', '漁業などの協力'], costs: ['平和条約は結ばれていない', '歯舞群島・色丹島の引き渡しは平和条約の締結後と書かれ、国後・択捉は合意に至っていない'] },
  jp_kr_1965: { gives: ['国交の正常化', '請求権・経済協力協定（無償3億ドル・有償2億ドル・民間融資）', '貿易と人の往来の土台'], costs: ['請求権をめぐる解釈が今も食い違う', '竹島の帰属は解決していない（紛争解決の交換公文のみ）'] },
  jp_cn_1972: { gives: ['国交の正常化', '中国は戦争賠償の請求を放棄すると表明', '経済・文化の交流の道が開けた'], costs: ['台湾との外交関係を断った（民間の窓口で関係は続く）', '尖閣諸島などの問題は取り上げられていない'] },
  jp_cn_1978: { gives: ['恒久的な平和友好関係をうたう', '覇権を求めないことを双方が確認', '経済・文化の協力の拡大'], costs: ['「第三国に向けたものではない」とする覇権条項をめぐる調整が必要だった', '領土の問題の扱いは双方で理解が異なる'] },
  jp_kp_2002: { gives: ['国交正常化の交渉を再開する合意', '日本人拉致の再発防止の約束', '核・ミサイル問題での国際的な合意の順守'], costs: ['拉致・核・ミサイルの問題は解決していない', '日本が経済協力を行うとした部分は実行されていない'] },
  jp_sg_epa: { gives: ['日本で最初の経済連携協定（2002年）', 'ほぼすべての工業品の関税が撤廃', '金融・情報通信など、サービスと投資の自由化'], costs: ['コメなど一部の農産物は対象から外した', '農林水産業の団体は慎重だった'] },
  jp_my_epa: { gives: ['自動車部品・鉄鋼・電気製品の関税を段階的に引き下げ', '熱帯果実などの日本向け関税の引き下げ', '投資のルール整備'], costs: ['マレーシアは自動車産業を保護するため、完成車の自由化は先送り'] },
  jp_th_epa: { gives: ['自動車・家電の関税の引き下げ', '日本企業の進出の後押し', '看護師・介護福祉士候補者の受け入れ枠'], costs: ['鶏肉・エビ・砂糖などの農産物で国内の産地が影響を受ける', 'コメは対象から外した'] },
  jp_id_epa: { gives: ['鉱物資源・エネルギーの安定供給の約束', '自動車部品などの関税の引き下げ', '看護師・介護福祉士候補者の受け入れ（2008年から）'], costs: ['人の受け入れに、言葉や資格の壁が課題として残る'] },
  jp_ph_epa: { gives: ['バナナ・パイナップルなどの関税の引き下げ', '電気・自動車関連の関税の引き下げ', '看護師・介護福祉士候補者の受け入れ'], costs: ['農産物の一部で国内産地への影響が出る'] },
  jp_asean: { gives: ['ASEAN全体との初めての包括的な協定', '貿易の9割超の品目で関税が段階的に撤廃・削減', '原産地のルールの共通化'], costs: ['農産物の一部は対象から外れ、国内の農業は影響を受ける'] },
  jp_vn_epa: { gives: ['鉄鋼・自動車部品・電気製品の関税の引き下げ', 'ベトナムでの日本企業の投資環境の改善', '看護師・介護福祉士候補者の受け入れ'], costs: ['水産物や農産物の関税の引き下げで、国内の産地が影響を受ける'] },
  jp_in_epa: { gives: ['貿易額の9割ほどで関税が10年かけて撤廃・削減', '自動車部品・電気製品・医薬品の市場アクセス', '投資と人の移動のルール'], costs: ['農産物の一部は除外', 'インドの関税の高さが残る分野もある'] },
  jp_au_epa: { gives: ['牛肉の関税を段階的に引き下げ（冷凍 38.5% → 19.5%・冷蔵 → 23.5%、十数年かけて）', '日本車の関税（オーストラリア側 5%）の撤廃', '小麦・乳製品の輸入枠の設定'], costs: ['畜産農家は価格競争の激化を懸念', '重要品目のコメは除外'] },
  cptpp: { gives: ['日本の工業品の関税はほぼ撤廃、相手国の日本向け関税も撤廃へ', '牛肉の関税 38.5% → 9%（16年かけて）、豚肉の差額関税制度を見直し', '電子商取引・知的財産・国有企業のルール', '加盟国の拡大（英国は2024年12月に加入）'], costs: ['畜産・乳製品・砂糖などの農家への影響と国の対策（TPP対策）', 'コメは関税削減の対象外（ミニマム・アクセスは維持）', '米国は離脱（2017年1月）して参加していない'] },
  jp_eu_epa: { gives: ['EUが日本車の関税 10% を段階的に撤廃（8年）', 'ワイン・チーズ・豚肉などの関税を日本が下げる／撤廃', '日本の農産物（牛肉・緑茶・日本酒）の関税撤廃と地理的表示（GI）の保護', '世界のGDPの約3割をカバーする貿易圏'], costs: ['ソフト系チーズ・豚肉などで国内の酪農・畜産に影響', '調達ルールの開放'] },
  jp_us_trade: { gives: ['米国産の牛肉・豚肉・ワイン・小麦などの関税を、TPPの水準まで引き下げ', '米国が日本の工作機械・楽器などの工業品の関税を撤廃・削減', 'デジタル貿易の協定（別の協定）'], costs: ['日本車への追加関税の扱いは協定の対象外（別の約束で協議）', '牛肉の輸入が急増したときの緊急輸入制限（セーフガード）がある', 'コメは対象外'] },
  jp_gb_epa: { gives: ['英国のEU離脱後も日EU協定の水準を保つ', '英国が日本車の関税（10%）を段階的に撤廃', 'デジタル貿易とデータの流通のルールの拡充'], costs: ['農産物の追加の開放は小さい'] },
  rcep: { gives: ['日本が初めて中国・韓国と結ぶ経済連携（15か国）', '日本の工業品の輸出先で関税が段階的に下がる', '原産地のルールを共通化（域内で作る部品の累積）'], costs: ['農林水産品の重要品目（コメ・麦・牛肉・乳製品・砂糖）は関税削減から除外', '中国・韓国からの工業品の輸入が増え、一部の産業は競争が強まる'] },
  jp_au_2007: { gives: ['米国以外の国との初めての安全保障協力の共同宣言（2007年）', '情報共有・テロ対策・災害派遣・平和維持の協力'], costs: ['防衛の義務はない（同盟ではない）', '中国が警戒の声を上げた'] },
  jp_in_2008: { gives: ['海上安全・テロ対策・災害の協力', '外務・防衛当局の定期的な対話'], costs: ['防衛の義務はない'] },
  jp_au_raa: { gives: ['自衛隊と豪軍が相手の国で共同訓練・災害派遣をするときの手続きと法的な地位を整える', '部隊の往来が円滑になる'], costs: ['防衛の義務はない', '部隊の滞在中の事件・事故の扱い（裁判権など）の取り決めに国内で議論がある'] },
  jp_gb_raa: { gives: ['自衛隊と英国軍の共同訓練・往来の手続きと法的な地位を整える', '装備・技術の協力の土台'], costs: ['防衛の義務はない'] },
  jp_ph_raa: { gives: ['自衛隊とフィリピン軍の共同訓練・往来の手続きと法的な地位を整える', '南シナ海を含む海の安全保障での協力'], costs: ['防衛の義務はない', '周辺国の警戒を呼ぶ面がある'] },
  anpo: { gives: ['第5条：日本の施政下の領域への武力攻撃に、日米が共同で対処する', '第6条：米軍の日本駐留（日本と極東の安全のため）による抑止力', '情報・技術・装備の協力'], costs: ['在日米軍施設・区域の面積の約7割が沖縄県に集中している', '駐留経費の負担（特別協定）と地位協定の運用をめぐる議論', '米国の戦争に巻きこまれることを心配する声もある'] },
};
const KIND_INFO = { fta: ['関税を下げ、貿易と投資を広げる', '農林水産業などへの影響と、対策の費用'], security: ['部隊の往来・訓練・情報の協力が進む', '周辺国の警戒、国内の賛否'], peace: ['戦後の課題に区切りをつける', '領土の扱いで国内に強い賛否'], alliance: ['有事の援軍が期待できる', '相手の戦争に巻きこまれる可能性'], ties: ['外交関係の開設', '第三国との関係への影響'] };

// ---------------------------------------------------------------- territorial questions (neutral; both positions)
const TERR = {
  northern: {
    timeline: [[1855, '日露通好条約。択捉島と得撫島のあいだに国境が引かれた'], [1875, '樺太千島交換条約。千島列島は日本の領土になった'], [1945, '8〜9月、ソ連軍が北方の島々を占領した'], [1951, 'サンフランシスコ平和条約。日本は千島列島を放棄したが、国後・択捉がそこに含まれるかは日本とロシアで見解が異なる'], [1956, '日ソ共同宣言。平和条約を結んだあとに歯舞群島・色丹島を引き渡すと書かれた'], [1991, '日ソ共同声明。4つの島の名前が文書に書かれ、領土問題の存在が確認された'], [1993, '東京宣言。4島の帰属の問題を歴史的・法的事実にもとづき解決するとした'], [2001, 'イルクーツク声明。1956年の共同宣言が有効であることを確認'], [2018, '首脳会談で、1956年の共同宣言を基礎に交渉を加速することで合意'], [2020, 'ロシアで憲法が改正され、領土の割譲を禁じる条文が加わった'], [2022, 'ロシアが平和条約の交渉を続けないと表明（3月）']],
    jp: '4つの島は日本固有の領土で、ロシアが不法に占拠している。島の帰属を確認して平和条約を結ぶ。',
    other: '第二次世界大戦の結果としてロシア（ソ連）の領土になった。日本が主張する「領土問題」は存在しない（時期により、1956年宣言の引き渡しには言及）。',
    law: 'サンフランシスコ平和条約での「千島列島」の範囲と、1956年の日ソ共同宣言の解釈が争点。国際司法裁判所への付託をロシアは受け入れていない。',
  },
  takeshima: {
    timeline: [[1905, '日本が島根県に編入する閣議決定'], [1952, '韓国が「李承晩ライン」を一方的に設定'], [1954, '韓国が警備隊を置き、実効支配を始めた。日本は国際司法裁判所への付託を提案（韓国は応じず）'], [1965, '日韓基本条約と同時に紛争解決に関する交換公文（外交上の経路で解決できなければ調停）'], [1996, '日韓が排他的経済水域を相次いで宣言し、境界の画定をめぐる交渉が続く'], [2005, '島根県が「竹島の日」条例を制定'], [2012, '韓国の大統領が島に上陸（8月）。日本は国際司法裁判所への付託を再び提案']],
    jp: '歴史的にも国際法上も日本固有の領土。韓国による占拠は不法。国際司法裁判所での解決を求めている。',
    other: '歴史的にも国際法上も韓国固有の領土（独島）。領土問題は存在しない。国際司法裁判所への付託には応じない。',
    law: '1905年の編入の評価と、1951年のサンフランシスコ平和条約の対象範囲が争点。',
  },
  senkaku: {
    timeline: [[1895, '日本が沖縄県に編入する閣議決定（無人島であることを確認したうえで）'], [1951, 'サンフランシスコ平和条約。米国の施政下の南西諸島に含まれた'], [1971, '沖縄返還協定で施政権が日本に返還。この前後から中国と台湾が領有を主張'], [1978, '日中平和友好条約の交渉。問題を「棚上げ」したかについて、日本は「合意はなかった」、中国は「共通認識があった」と主張'], [2010, '中国漁船が海上保安庁の巡視船に衝突する事件（9月）'], [2012, '日本政府が3島を国有化（9月）。その後、中国の公船が周辺海域に入ることが続く'], [2013, '中国が東シナ海に防空識別圏を設定（11月）'], [2021, '中国で海警法が施行（2月）']],
    jp: '歴史的にも国際法上も日本固有の領土で、日本が有効に支配している。解決すべき領有権の問題は存在しない。',
    other: '中国と台湾は古くから自国の領土だと主張している（釣魚島・釣魚台）。1970年代の日本への返還は認められない立場。',
    law: '1895年の編入が「無主地の先占」にあたるか、1951年の平和条約の対象かが争点。日本は国際司法裁判所への付託の対象と考えていない。',
  },
};

// ---------------------------------------------------------------- opinion at home (tendencies by segment; the voices are balanced)
const OP = {
  trade_open: { name: '貿易の自由化', segs: { business: 2, employees: 1, urban: 1, families: 1, young: 1, farmers: -4, rural: -2, unions: -1 }, pro: '輸出企業や消費者には追い風', con: '農林水産業の団体は強く反発' },
  trade_protect: { name: '関税の引き上げ', segs: { farmers: 3, rural: 2, unions: 1, business: -2, families: -1, urban: -1, young: -0.5 }, pro: '国内の産業と産地を守る', con: '物価が上がり、輸出企業は報復を心配' },
  alliance_us: { name: '日米同盟の強化', segs: { business: 1, elderly: 1, rural: 0.5, selfemployed: 0.5, unions: -2, young: -0.5 }, pro: '安全保障の土台が強まる', con: '米国の戦争に巻きこまれる、基地の負担が重いという声' },
  security_pact: { name: '安全保障の協力', segs: { elderly: 1, business: 0.5, selfemployed: 0.5, unions: -1.5, young: -0.3 }, pro: '地域の安定につながる', con: '周辺国の警戒と防衛費の増加を心配する声' },
  china_engage: { name: '中国との対話・協力', segs: { business: 2, employees: 1, young: 0.5, unions: 0.5, elderly: -1, selfemployed: -0.5 }, pro: '経済の結びつきを守る', con: '安全保障や領土の問題で弱腰という批判' },
  china_firm: { name: '中国への毅然とした対応', segs: { elderly: 1, selfemployed: 0.5, rural: 0.3, business: -1.5, employees: -0.3, unions: -0.3 }, pro: '主権と安全を守る姿勢として評価', con: '貿易への影響を心配する声' },
  korea_engage: { name: '韓国との対話・協力', segs: { young: 1, urban: 1, business: 1, unions: 0.5, elderly: -1, selfemployed: -0.5 }, pro: '隣国との関係安定', con: '歴史・領土で譲歩しすぎという批判' },
  russia_engage: { name: 'ロシアとの対話', segs: { business: 0.5, rural: 0.3, elderly: -0.3, young: -0.4, urban: -0.4 }, pro: 'エネルギーと領土交渉の可能性', con: '国際社会の足並みを乱すという懸念' },
  sanction: { name: '経済制裁', segs: { elderly: 0.5, young: 0.3, business: -1, unions: 0.3, urban: 0.3 }, pro: '国際社会と足並みをそろえた圧力', con: '貿易や資源の調達への影響' },
  aid: { name: '経済援助（ODA）', segs: { business: 1, young: 0.5, urban: 0.5, unions: 0.3, elderly: -1, rural: -0.5 }, pro: '途上国との信頼と国際的な評価', con: '国内の暮らしに回すべきという声' },
  history_reconcile: { name: '歴史をめぐる和解', segs: { young: 1, urban: 1, unions: 0.5, elderly: -1.5, selfemployed: -1 }, pro: '隣国との関係改善', con: '歴史認識で譲りすぎという批判' },
  territory_firm: { name: '領土問題での強い姿勢', segs: { elderly: 1.5, selfemployed: 0.5, rural: 0.5, business: -0.3 }, pro: '主権を守る姿勢', con: '関係の悪化を心配する声' },
  territory_deal: { name: '領土問題の妥協', segs: { business: 0.5, young: 0.3, elderly: -1.5, selfemployed: -1, rural: -0.3 }, pro: '平和条約と経済協力への一歩', con: '領土を譲ることへの強い反発' },
  un_contrib: { name: '国際貢献', segs: { urban: 1, young: 1, business: 0.5, unions: 0.3, elderly: 0.2 }, pro: '国際社会での責任を果たす', con: '費用や自衛隊の派遣への不安' },
  soft: { name: '文化・人の交流', segs: { young: 1, urban: 1, business: 0.5, families: 0.5, elderly: 0.2 }, pro: '日本のイメージと観光の追い風', con: '費用対効果への疑問' },
  summit: { name: '首脳外交', segs: { business: 0.5, urban: 0.3, floating: 0.3 }, pro: '存在感を示す', con: '成果が見えにくいという声' },
};
const ACTION_TAGS = {
  summit: (g, id, o) => ['summit', ...(id === 'cn' ? ['china_engage'] : id === 'kr' ? ['korea_engage'] : ['ru', 'su'].includes(id) ? ['russia_engage'] : id === 'us' ? ['alliance_us'] : [])],
  visit: (g, id) => ['summit', ...(id === 'cn' ? ['china_engage'] : id === 'kr' ? ['korea_engage'] : [])],
  fm_talks: (g, id) => (id === 'cn' ? ['china_engage'] : id === 'kr' ? ['korea_engage'] : []),
  statement: (g, id, o) => (o && o.kind === 'history' ? ['history_reconcile'] : o && o.kind === 'security' ? ['security_pact'] : o && o.kind === 'econ' ? ['trade_open'] : []),
  fta: () => ['trade_open'], defense_pact: () => ['security_pact'], alliance: () => ['security_pact', 'alliance_us'],
  peace_treaty: (g, id, o) => (o && o.terms === 'four' ? ['territory_firm'] : ['territory_deal']),
  ally_up: () => ['alliance_us'], sanction: () => ['sanction'], aid: () => ['aid'], protest: (g, id) => (id === 'cn' || id === 'kr' ? ['territory_firm'] : []),
  un_speech: () => ['un_contrib'], jdr: () => ['un_contrib'], donate: () => ['un_contrib'], soft_action: () => ['soft'],
  tariff_set: (g, id, o) => [o && o.dir === 'down' ? 'trade_open' : 'trade_protect'], tariff_extra: () => ['trade_protect', 'china_firm'], safeguard: () => ['trade_protect'],
  tariff_lift: () => ['trade_open'], epa_talks: () => ['trade_open'],
};

// ---------------------------------------------------------------- communiqués (the words change with the relation)
const COM = {
  econ: {
    hi: ['両首脳は、貿易・投資の協力をさらに広げ、サプライチェーン（供給網）で緊密に連携することで一致した。', '両国は、互いに市場を開き、新しい産業分野での共同の取り組みを進めることを確認した。'],
    mid: ['両首脳は、貿易・投資の拡大に向けた協議を進めることで一致した。', '両国は、経済関係の強化に向けて、実務者による協議を続けることを確認した。'],
    lo: ['両首脳は、経済関係について率直に意見を交わし、実務者の協議を続けることにした。', '貿易の扱いでは意見の隔たりが残り、個別の問題は引き続き協議する。'],
    bad: ['経済分野では主張が平行線のまま、対話の窓口を閉ざさないことだけを確認した。'],
  },
  security: {
    hi: ['両首脳は、地域の平和と安定のため、安全保障での協力を一段と深めることで一致した。', '両国は、共同訓練や情報共有の拡大を進めることを確認した。'],
    mid: ['両首脳は、安全保障の対話を続け、地域情勢について意見を交換した。', '防衛当局間の交流を進めることで一致した。'],
    lo: ['両首脳は、安全保障をめぐる互いの懸念を伝え合い、対話の継続だけを確認した。'],
    bad: ['安全保障では厳しいやりとりとなり、偶発的な衝突を避けるための連絡の仕組みを確認するにとどまった。'],
  },
  friend: {
    hi: ['両首脳は、両国の友好の絆が揺るぎないものであることを確認し、青少年・文化・観光の交流を広げることで一致した。'],
    mid: ['両首脳は、人と文化の交流を進め、相互の理解を深めることで一致した。'],
    lo: ['両首脳は、関係の改善に向けて、できるところから交流を再開する考えを示した。'],
    bad: ['会談は短時間で、互いの立場を述べるにとどまった。民間の交流を絶やさないことでは一致した。'],
  },
  dispute: {
    hi: ['両首脳は、懸案の解決に向けて、率直で建設的な協議を続けることで一致した。'],
    mid: ['両首脳は、立場の違いを確認したうえで、協議を継続する。'],
    lo: ['両首脳は、双方が原則的な立場を述べ、協議の継続で一致した。'],
    bad: ['それぞれが自国の立場を主張し、折り合う点は見つからなかった。'],
  },
  history: {
    hi: ['両首脳は、過去の不幸な歴史を直視し、未来志向の関係を築くことを誓った。'], mid: ['両首脳は、歴史に誠実に向き合いつつ、未来に向けた協力を進めることを確認した。'], lo: ['歴史認識をめぐっては考え方に違いがあるが、対話を続ける。'], bad: ['歴史認識をめぐり、互いの主張に大きな隔たりがあることが改めて確認された。'],
  },
  climate: {
    hi: ['両首脳は、気候変動対策で技術と資金の協力を進めることで一致した。'], mid: ['両首脳は、脱炭素の取り組みで協力することを確認した。'], lo: ['環境分野での実務協議を始める。'], bad: ['気候変動をめぐっては立場に差がある。'],
  },
};
const tier = (r) => (r >= 55 ? 'hi' : r >= 15 ? 'mid' : r >= -30 ? 'lo' : 'bad');
const HEAD = { hi: '共同声明（きわめて良好）', mid: '共同声明', lo: '共同記者発表', bad: '会談後の発表（共同声明は見送り）' };

export function createDiplo(X) {
  const { W, clamp, num, rnd, roll, rint, pick, today, dateNum, worldDate, fyear, since, relation, relAdd, relLabel, hasTies, exists, countryName, shortName, leaderTitle, COUNTRIES, tradeOf, news, phone, note, scene, pol, isPM, isFM, bumpApproval, standingAdd, ideoNudge, dietOdds, useStam, stam, treatiesNow, TREATIES, DISPUTES, alliancesNow, japanAllies, blocOf, addTreaty, emit, atWarWith, who0, pct, approvalOf, shiftSupport, segWeights, baseOdds, tensionShift, threatAdd, ecoShock } = X;
  const NEG = {};
  const DIET_H = {};
  const APPLY = {};
  let STANCE = null;

  // ---------------------------------------------------------------- state
  function D(g) {
    const s = W(g);
    let d = s.diplo;
    if (!d || typeof d !== 'object' || Array.isArray(d)) d = s.diplo = {};
    if (d.v !== 1) { d.v = 1; }
    for (const k of ['negos', 'diet', 'timeline', 'visits', 'opinion', 'hist']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['prep', 'soft', 'flags']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {};
    if (!Number.isFinite(d.seq)) d.seq = 1;
    if (!Number.isFinite(d.lastVisit)) d.lastVisit = 0;
    if (!Number.isFinite(d.lastSnap)) d.lastSnap = -99;
    if (!Number.isFinite(d.soft.bonus)) d.soft.bonus = 0;
    if (!Array.isArray(d.soft.log)) d.soft.log = [];
    return d;
  }
  const dtext = (g, day) => { const w = worldDate(g, day); return `${w.year}年${w.month}月`; };
  function tl(g, kind, text, country = null) {
    const d = D(g);
    d.timeline.unshift({ day: today(g), date: dtext(g), kind, text, country });
    if (d.timeline.length > 120) d.timeline.length = 120;
  }
  const segName = (s) => SEG[s] || s;
  const nm = (g, id) => (id ? countryName(g, id, true) : '');
  const primary = (g, t) => (COUNTRIES[t] ? t : (X.PSEUDO && X.PSEUDO[t]) || (X.ORGS && X.ORGS[t]) ? ((X.membersOf(g, t)[0]) || t) : t);

  // ---------------------------------------------------------------- opinion at home
  function opinionReaction(g, kind, id, opts, res) {
    const f = ACTION_TAGS[kind];
    if (!f || !res || res.ok === false || res.success === false) return null;
    let tags;
    try { tags = f(g, id, opts || {}) || []; } catch (e) { tags = []; }
    tags = tags.filter((t) => OP[t]);
    if (!tags.length) return null;
    const segs = {};
    for (const t of tags) for (const [sg, v] of Object.entries(OP[t].segs)) segs[sg] = (segs[sg] || 0) + v;
    const p = pol(g);
    if (p && shiftSupport) shiftSupport(p, segs, 0.0016);
    const rows = Object.entries(segs).map(([sg, v]) => ({ seg: sg, name: segName(sg), v }));
    const pro = rows.filter((r) => r.v >= 1).sort((a, b) => b.v - a.v).slice(0, 2);
    const con = rows.filter((r) => r.v <= -1).sort((a, b) => a.v - b.v).slice(0, 2);
    const main = OP[tags[0]];
    const line = `【国内の反応】${pro.length ? `${pro.map((r) => r.name).join('・')}は歓迎（${main.pro}）` : ''}${pro.length && con.length ? '。' : ''}${con.length ? `${con.map((r) => r.name).join('・')}は懸念（${main.con}）` : ''}`;
    const d = D(g);
    d.opinion.unshift({ day: today(g), date: dtext(g), tags, name: main.name, pro: pro.map((r) => r.name), con: con.map((r) => r.name), text: line.replace('【国内の反応】', '') });
    if (d.opinion.length > 30) d.opinion.length = 30;
    return pro.length || con.length ? line : null;
  }

  // ---------------------------------------------------------------- communiqués
  function communique(g, id, topic, ok = true) {
    const r = relation(g, id);
    const t = ok ? tier(r) : 'bad';
    const set = COM[topic] || COM.friend;
    const lines = (set[t] || set.mid).slice();
    const out = [pick(lines)];
    if (ok && t === 'hi' && lines.length > 1 && roll(0.5)) { const o = lines.find((x) => x !== out[0]); if (o) out.push(o); }
    const who = ['us', 'cn', 'ru', 'su', 'kr', 'kp', 'tw'].includes(id) || COUNTRIES[id] ? leaderTitle(g, id) : '相手国の首脳';
    return { head: HEAD[t], tier: t, who, lines: out };
  }

  // ---------------------------------------------------------------- 外務省 advice (titles only; the voices differ)
  function mofaOffice(g, id) {
    const e = fyear(g);
    const c = COUNTRIES[id] || {};
    const asia = ['cn', 'kr', 'kp', 'tw', 'in', 'id', 'ph', 'vn', 'th', 'sg', 'my', 'au'].includes(id);
    if (id === 'us' || id === 'ca' || id === 'br') return '北米局長';
    if (asia) return e < 2004.6 ? 'アジア局長' : 'アジア大洋州局長';
    if (['ru', 'su', 'ua'].includes(id)) return e < 2004.6 ? '欧亜局長' : '欧州局長';
    if (c.region === 'europe') return e < 2004.6 ? '欧亜局長' : '欧州局長';
    if (c.region === 'mideast') return e < 2004.6 ? '中近東アフリカ局長' : '中東アフリカ局長';
    return '総合外交政策局長';
  }
  function advice(g, target = null) {
    const out = [];
    const s = W(g);
    const d = D(g);
    const add = (who, text, stance, topic) => out.push({ who: `外務省 ${who}`, text, stance, topic });
    const open = d.negos.filter((n) => n.status === 'open');
    for (const n of open.slice(0, 2)) {
      const v = view(g, n.id);
      if (!v) continue;
      const gap = v.issues.filter((i) => i.dem > i.mine).sort((a, b) => b.w * (b.dem - b.mine) - a.w * (a.dem - a.mine))[0];
      add(n.kind === 'epa' || n.kind === 'tariffs' ? '経済局長' : mofaOffice(g, primary(g, n.target)), `${n.name}は第${n.round}ラウンド。合意の見込みは${pct(v.pConclude)}です。${gap ? `相手は「${gap.name}」にこだわっています。ここで譲るなら、国内への説明も用意が必要です。` : '大きな争点はほぼ残っていません。'}`, v.pConclude >= 0.5 ? '積極' : '慎重', 'nego');
      add('条約課長', `譲歩の程度によっては国会の承認で苦戦します。与党内の根回しを先に。`, '慎重', 'diet');
    }
    for (const k of s.crises.slice(0, 3)) {
      if (k.kind === 'trade') add('経済局長', `${k.title}。報復の応酬を避け、まず閣僚協議の場を確保するのが定石です。ただし譲りすぎると国内の産業界から批判が出ます。`, '慎重', 'trade');
      else if (['missile', 'incident', 'clash'].includes(k.kind)) add(mofaOffice(g, k.country), `${k.title}。抗議と同盟国との連携を同時に進めるべきです。一方で、事態を拡大させない連絡経路も保っておきたい。`, '慎重', 'crisis');
    }
    const t = target && exists(g, target) ? target : null;
    if (t) {
      const r = relation(g, t);
      const off = mofaOffice(g, t);
      if (r >= 45) add(off, `${shortNameOf(g, t)}との関係は良好です。経済や人の交流を広げる好機で、首脳会談の成果を共同声明に残すのが効果的です。`, '積極', 'country');
      else if (r >= 0) add(off, `${shortNameOf(g, t)}との関係は安定していますが、浅い関係です。特使や外相会談で地ならしをしてから首脳級に上げるのが堅実です。`, '慎重', 'country');
      else add(off, `${shortNameOf(g, t)}との関係は冷えています（${r}）。いま首脳会談を急ぐと成果の乏しい会談になるおそれがあります。対話の窓口を絶やさず、小さな合意から積み上げましょう。`, '慎重', 'country');
    } else {
      const worst = X.countriesNow(g).filter((id) => hasTies(g, id)).map((id) => [id, relation(g, id)]).sort((a, b) => a[1] - b[1])[0];
      const best = X.countriesNow(g).map((id) => [id, relation(g, id)]).sort((a, b) => b[1] - a[1])[0];
      if (worst && worst[1] < -20) add(mofaOffice(g, worst[0]), `${shortNameOf(g, worst[0])}との関係が冷えこんでいます（${worst[1]}）。放置すると貿易や安全保障に響きます。`, '積極', 'country');
      if (best) add('総合外交政策局長', `${shortNameOf(g, best[0])}は最も関係が良好です（${best[1]}）。この関係を土台に、地域の枠組みでの連携を広げる手があります。`, '積極', 'general');
    }
    if (s.standing < 50) add('事務次官', '国際的な信頼が下がっています。国連や援助、国際的な課題での貢献で、評価を取り戻す必要があります。', '積極', 'standing');
    const v = d.visits.find((x) => x.status === 'pending');
    if (v) add(mofaOffice(g, v.country), `${v.title}が来日します。接遇の準備を。会談の議題をあらかじめ決めておくと成果が出ます。`, '積極', 'visit');
    if (!out.length) add('総合外交政策局長', 'いまは大きな懸案はありません。首脳会議に向けた準備と、各国との関係の維持に力を注ぎましょう。', '積極', 'general');
    return out.slice(0, 6);
  }
  const shortNameOf = (g, id) => shortName(g, id);

  // ---------------------------------------------------------------- soft power
  function groupsBonus(g) {
    try {
      const gr = typeof g.groups === 'function' ? g.groups() : null;
      const list = Array.isArray(gr) ? gr : gr && Array.isArray(gr.list) ? gr.list : gr && typeof gr === 'object' ? Object.values(gr) : [];
      let n = 0;
      for (const x of list) {
        const k = `${(x && (x.kind || x.type || x.category)) || ''}${(x && x.name) || ''}`;
        if (/sport|スポーツ|culture|文化|artist|アーティスト|協会|芸術|音楽|観光/.test(k)) n += Math.min(2, num(x.influence ?? x.power ?? x.size, 1));
      }
      return clamp(n * 0.4, 0, 8);
    } catch (e) { return 0; }
  }
  const SOFT_BASE = [[1987, 58], [1996, 62], [2004, 66], [2012, 72], [2026, 76]];
  const interpBase = (y) => { for (let i = 1; i < SOFT_BASE.length; i++) if (y <= SOFT_BASE[i][0]) { const [y0, v0] = SOFT_BASE[i - 1], [y1, v1] = SOFT_BASE[i]; return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0); } return SOFT_BASE[SOFT_BASE.length - 1][1]; };
  function softScore(g) {
    const s = W(g);
    const aid = Object.values(s.aid).reduce((a, v) => a + num(v), 0);
    const base = interpBase(Math.max(1987, fyear(g)));
    return Math.round(clamp(base + D(g).soft.bonus + Math.min(6, aid * 4) + groupsBonus(g) * 0.5, 20, 100));
  }
  const SOFT_OPTIONS = [
    { id: 'culture', label: '文化の発信（アニメ・音楽・食）', sub: '日本のイメージと観光に追い風。効果は穏やか', stam: 10, soft: 1.6, rel: 2 },
    { id: 'exchange', label: '留学生・青年の交流', sub: '長い目で関係を支える', stam: 8, soft: 1.2, rel: 3 },
    { id: 'sports', label: 'スポーツ交流（親善試合・大会の招致）', sub: '国民どうしの親しみが育つ', stam: 10, soft: 1.3, rel: 2 },
    { id: 'language', label: '日本語・日本文化の普及', sub: '国際交流の拠点を増やす', stam: 6, soft: 1.0, rel: 1 },
    { id: 'visa', label: '観光ビザの緩和', sub: '観光客が増えて景気に少しプラス。防犯面の不安の声も', stam: 6, soft: 0.8, rel: 2 },
  ];

  // ---------------------------------------------------------------- diplomatic standing (外交の通信簿)
  function ftaCoverage(g) {
    const ts = treatiesNow(g).filter((t) => t.kind === 'fta');
    const ids = new Set();
    for (const t of ts) for (const w of t.with) { if (COUNTRIES[w]) ids.add(w); else for (const m of X.membersOf(g, w)) ids.add(m); }
    let tot = 0, cov = 0;
    for (const id of X.countriesNow(g)) { const v = tradeOf(g, id); tot += v; if (ids.has(id)) cov += v; }
    return tot ? cov / tot : 0;
  }
  function standingScore(g) {
    const s = W(g);
    const ids = X.countriesNow(g);
    const top = ids.map((id) => [id, tradeOf(g, id)]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const tw = top.reduce((a, [, v]) => a + v, 0) || 1;
    const relAvg = top.reduce((a, [id, v]) => a + (relation(g, id) + 100) / 2 * v, 0) / tw;
    const anpo = s.alliances.anpo && !s.alliances.anpo.ended ? s.alliances.anpo.strength : 0;
    const others = japanAllies(g).filter((a) => a.alliance !== 'anpo');
    const allyV = clamp(anpo * 0.8 + Math.min(20, others.length * 5), 0, 100);
    const cov = ftaCoverage(g);
    const tradeV = clamp(cov * 130, 0, 100);
    const secV = clamp(100 - s.threat, 0, 100);
    const soft = softScore(g);
    const jw = X.japanWar(g);
    const terrV = clamp(55 + Object.values(s.disputes).reduce((a, x) => a + num(x.talks) * 4, 0) - (jw && jw.phase === 'war' ? 45 : 0) - Object.keys(s.sanctions.onJapan).length * 4, 0, 100);
    const parts = [
      { id: 'trust', label: '国際的な信頼', value: Math.round(s.standing), w: 0.2, desc: '国連・援助・条約の順守などの積み重ね' },
      { id: 'relations', label: '主要な貿易相手との関係', value: Math.round(relAvg), w: 0.25, desc: '貿易額の大きい8か国との関係（重みつき平均）' },
      { id: 'allies', label: '同盟・安全保障の協力', value: Math.round(allyV), w: 0.1, desc: '日米同盟の強さと、そのほかの協力の枠組み' },
      { id: 'trade', label: '経済連携の広がり', value: Math.round(tradeV), w: 0.15, desc: `経済連携協定でカバーする貿易の割合 約${Math.round(cov * 100)}%` },
      { id: 'security', label: '安全（脅威の低さ）', value: Math.round(secV), w: 0.15, desc: `日本への脅威 ${Math.round(s.threat)}／100` },
      { id: 'soft', label: 'ソフトパワー', value: soft, w: 0.1, desc: '文化・交流・援助で培われる好感度' },
      { id: 'terr', label: '領土・紛争の管理', value: Math.round(terrV), w: 0.05, desc: '領土問題の対話と、紛争・制裁の抱えこみ' },
    ];
    const score = Math.round(parts.reduce((a, p0) => a + p0.value * p0.w, 0));
    const grade = score >= 85 ? 'S' : score >= 75 ? 'A' : score >= 62 ? 'B' : score >= 50 ? 'C' : score >= 38 ? 'D' : 'E';
    const label = { S: '国際社会の中心', A: '信頼される国', B: '安定した国', C: '課題を抱える国', D: '孤立の心配がある国', E: '孤立している国' }[grade];
    const d = D(g);
    const prev = d.hist.length ? d.hist[Math.max(0, d.hist.length - 3)] : null;
    return { score, grade, label, parts, trend: prev ? score - prev.score : 0, prevDay: prev ? prev.day : null, history: d.hist.slice(-12) };
  }

  // ---------------------------------------------------------------- negotiation engine
  function registerNegotiation(kind, def) { NEG[kind] = def; }
  function registerDiet(kind, h) { DIET_H[kind] = h; }
  function registerApply(kind, fn) { APPLY[kind] = fn; }
  const normIssue = (i) => ({ id: i.id, name: i.name, desc: i.desc || '', tag: i.tag || '', w: i.w ?? 1, dem: i.dem ?? 0, mine: i.mine ?? 0, want: i.want ?? 0, theirs: i.theirs ?? 0, max: i.max ?? 2, shield: false, seg: i.seg || {}, lv: i.lv || LV, lvT: i.lvT || LVT, w2: i.w2 ?? i.w ?? 1, sacred: !!i.sacred, note: i.note || '' });
  function satisfaction(n) {
    let sp = 0, sw = 0, sj = 0, jw = 0;
    for (const i of n.issues) {
      sw += i.w; sp += i.w * (i.dem <= 0 ? 1 : Math.min(1, i.mine / i.dem));
      jw += i.w2; sj += i.w2 * (i.want <= 0 ? 1 : Math.min(1, i.theirs / i.want));
    }
    return { sp: sw ? sp / sw : 1, sj: jw ? sj / jw : 1 };
  }
  const prepBonus = (g, id) => { const d = D(g); return d.prep[id] && d.prep[id] >= today(g) ? 0.07 : 0; };
  function levelOk(g, n, level) {
    if (level === 'summit' && !isPM(g)) return '首脳協議は総理が行う';
    if (level === 'fm' && !isPM(g) && !isFM(g)) return '閣僚折衝は総理か外務大臣が行う';
    return null;
  }
  function concludeOdds(g, n) {
    const { sp } = satisfaction(n);
    const K = NEG[n.kind] || {};
    return clamp(0.2 + (sp - 0.45) * 1.8 + n.mood / 250 + n.momentum * 0.03 + LEVELS[n.level].bonus + prepBonus(g, n.pk) + (K.bonus ? K.bonus(g, n) : 0), 0.02, 0.95);
  }
  function pressOdds(g, n, i) {
    const K = NEG[n.kind] || {};
    return clamp(0.4 + n.mood / 200 + relation(g, n.pk) / 320 + n.momentum * 0.04 + LEVELS[n.level].bonus * 1.2 - 0.12 * i.theirs + prepBonus(g, n.pk) + (K.pressBonus ? K.pressBonus(g, n, i) : 0), 0.05, 0.85);
  }
  function shieldOdds(g, n, i) { return clamp(0.36 + n.mood / 250 + LEVELS[n.level].bonus - 0.1 * Math.max(0, i.dem - 1) + (i.sacred ? 0.04 : 0), 0.05, 0.8); }
  function domestic(n) {
    const segs = {};
    for (const i of n.issues) { const k = i.mine; if (!k) continue; for (const [sg, v] of Object.entries(i.seg || {})) segs[sg] = (segs[sg] || 0) + v * k; }
    return segs;
  }
  function domesticLines(n) {
    const rows = Object.entries(domestic(n)).map(([sg, v]) => ({ seg: sg, name: segName(sg), v }));
    const bad = rows.filter((r) => r.v <= -2).sort((a, b) => a.v - b.v).slice(0, 3);
    const good = rows.filter((r) => r.v >= 2).sort((a, b) => b.v - a.v).slice(0, 3);
    const out = [];
    if (bad.length) out.push(`国内で反発しそうな層：${bad.map((r) => r.name).join('・')}`);
    if (good.length) out.push(`歓迎しそうな層：${good.map((r) => r.name).join('・')}`);
    return out;
  }
  function negoMovesFor(g, n) {
    const last = n.round > n.rounds;
    const lv = n.level;
    const mv = [];
    const anyC = n.issues.some((i) => i.mine < 3), anyP = n.issues.some((i) => i.theirs < Math.min(i.want, i.max)), anyS = n.issues.some((i) => !i.shield && i.dem > 0);
    mv.push({ id: 'concede', label: '歩み寄る（譲歩する）', sub: '譲った項目の分、相手の信頼と勢いが上がる。国内の反発もある', issue: true, why: last ? '協議の回数が尽きた（合意をまとめるか、席を立つか）' : !anyC ? '譲れる項目がない' : null });
    mv.push({ id: 'press', label: '相手に求める', sub: '相手の出す約束を一段引き上げる。失敗すると雰囲気が悪くなる', issue: true, why: last ? '協議の回数が尽きた' : !anyP ? '求められる項目がない（相手はこれ以上は出せない）' : null });
    mv.push({ id: 'shield', label: '守りたい項目を主張する', sub: '相手の要求を一段下げさせる（例外・除外を求める）', issue: true, why: last ? '協議の回数が尽きた' : !anyS ? '守る項目がない' : null });
    mv.push({ id: 'recess', label: '休会して様子を見る', sub: '相手の雰囲気が和らぐ。ときに相手が要求を増やす', issue: false, why: last ? '協議の回数が尽きた' : null });
    const next = lv === 'official' ? 'fm' : lv === 'fm' ? 'summit' : null;
    mv.push({ id: 'escalate', label: next ? `協議の格を上げる（→${LEVELS[next].name}）` : '協議の格はこれ以上上げられない', sub: '格が上がると大きな合意を引き出しやすい。体力を使う', issue: false, why: next ? levelOk(g, n, next) || (stam(g) < LEVELS[next].stam ? `体力が足りない（${LEVELS[next].stam}）` : null) : 'すでに首脳協議' });
    mv.push({ id: 'conclude', label: '合意をまとめる（署名へ）', sub: '相手が受け入れれば署名。足りなければ決裂せず協議は続く', issue: false, why: null });
    mv.push({ id: 'walk', label: '席を立つ（交渉を打ち切る）', sub: '関係は冷えるが、相手が条件を見直して呼び戻すこともある', issue: false, why: null });
    return mv;
  }
  function view(g, id) {
    const d = D(g);
    const n = typeof id === 'object' ? id : d.negos.find((x) => x.id === id);
    if (!n) return null;
    const { sp, sj } = satisfaction(n);
    const K = NEG[n.kind] || {};
    const moves = n.status === 'open' ? negoMovesFor(g, n) : [];
    return {
      id: n.id, kind: n.kind, name: n.name, target: n.target, targetName: n.tName, pk: n.pk, level: n.level, levelName: LEVELS[n.level].name, round: Math.min(n.round, n.rounds), rounds: n.rounds, over: n.round > n.rounds,
      mood: Math.round(n.mood), momentum: n.momentum, status: n.status, sp: Math.round(sp * 100) / 100, sj: Math.round(sj * 100) / 100, pConclude: Math.round(concludeOdds(g, n) * 100) / 100,
      issues: n.issues.map((i) => ({ ...i, mineLabel: i.lv[i.mine], theirsLabel: i.lvT[i.theirs], demLabel: i.dem ? `要求：${i.lv[i.dem]}` : '要求なし', wantLabel: i.want ? `期待：${i.lvT[i.want]}` : '', gap: Math.max(0, i.dem - i.mine), pressOdds: Math.round(pressOdds(g, n, i) * 100) / 100, shieldOdds: Math.round(shieldOdds(g, n, i) * 100) / 100 })),
      moves, domestic: domesticLines(n), log: n.log.slice(-6), result: n.result || null, desc: K.desc || '', ratify: K.ratify || null, day: n.start,
    };
  }
  function negoStart(g, kind, target, opts = {}) {
    const K = NEG[kind];
    if (!K) return { ok: false, why: 'その交渉はない' };
    const d = D(g);
    const open = d.negos.find((n) => n.kind === kind && n.target === target && n.status === 'open');
    if (open) return { ok: true, id: open.id, resumed: true, text: `${open.name}の交渉を再開する。` };
    const why = (K.who ? X.roleWhy(g, K.who) : null) || (K.check ? K.check(g, target, opts) : null);
    if (why) return { ok: false, why };
    if (d.negos.filter((n) => n.status === 'open').length >= 4) return { ok: false, why: '同時に進められる交渉は4つまで（どれかをまとめるか、打ち切る）' };
    const level = opts.level && LEVELS[opts.level] ? opts.level : 'official';
    const lw = levelOk(g, { level }, level);
    if (lw) return { ok: false, why: lw };
    if (stam(g) < LEVELS[level].stam) return { ok: false, why: `体力が足りない（${LEVELS[level].stam}）` };
    const issues = K.issues(g, target, opts).map(normIssue);
    const pk = primary(g, target);
    const rel = COUNTRIES[pk] ? relation(g, pk) : 0;
    const n = { id: 'n' + d.seq++, kind, target, pk, tName: X.targetName(g, target), name: K.title(g, target), level, round: 1, rounds: K.rounds || 6, mood: Math.round(clamp(46 + rel / 4 + (prepBonus(g, pk) ? 10 : 0), 18, 88)), momentum: 0, issues, log: [], status: 'open', start: today(g), flags: {}, opts: { ...opts } };
    useStam(g, LEVELS[level].stam);
    n.log.push(`${LEVELS[level].name}で交渉を始めた。`);
    d.negos.push(n);
    if (d.negos.length > 16) d.negos = d.negos.filter((x) => x.status === 'open').concat(d.negos.filter((x) => x.status !== 'open').slice(-8));
    tl(g, 'nego', `${n.name}の交渉を始めた（${LEVELS[level].name}）`, pk);
    return { ok: true, id: n.id, text: `${n.name}の交渉を始めた（${LEVELS[level].name}）。` };
  }
  function brokenCheck(g, n) {
    if (n.mood > 8 || n.status !== 'open') return null;
    n.status = 'broken';
    n.result = { ok: false, text: '相手が交渉の席を立った（雰囲気が悪化しすぎた）' };
    if (COUNTRIES[n.pk]) relAdd(g, n.pk, -4);
    bumpApproval(g, -0.5, `${n.name}の決裂`);
    news(g, `${n.name}の交渉は、相手国が席を立って決裂した`);
    tl(g, 'nego', `${n.name}の交渉は決裂した`, n.pk);
    return n.result.text;
  }
  function negoMove(g, id, move, arg) {
    const d = D(g);
    const n = d.negos.find((x) => x.id === id);
    if (!n) return { ok: false, why: 'その交渉はない' };
    if (n.status !== 'open') return { ok: false, why: '交渉はもう終わっている' };
    const K = NEG[n.kind];
    const mv = negoMovesFor(g, n).find((m) => m.id === move);
    if (!mv) return { ok: false, why: 'そんな手はない' };
    if (mv.why) return { ok: false, why: mv.why };
    const issue = arg != null ? n.issues.find((i) => i.id === arg) : null;
    if (mv.issue && !issue) return { ok: false, why: '項目を選ぶ' };
    let text = '';
    let used = true;
    if (move === 'concede') {
      if (issue.mine >= 3) return { ok: false, why: 'その項目はこれ以上譲れない' };
      issue.mine++;
      n.mood = clamp(n.mood + 5, 0, 100); n.momentum = clamp(n.momentum + 1, -4, 4);
      text = `「${issue.name}」で歩み寄った（${issue.lv[issue.mine]}）。相手の表情がやわらいだ。`;
      const recip = roll(0.33 + (n.level === 'official' ? 0 : 0.1));
      const gapI = n.issues.filter((i) => i.theirs < Math.min(i.want, i.max)).sort((a, b) => b.w2 - a.w2)[0];
      if (recip && gapI) { gapI.theirs++; text += `\n相手も「${gapI.name}」で応じた（${gapI.lvT[gapI.theirs]}）。`; }
      const dl = Object.entries(issue.seg || {}).filter(([, v]) => v <= -1).map(([sg]) => segName(sg));
      if (dl.length) text += `\n（国内：${dl.slice(0, 3).join('・')}が反発しそうだ）`;
    } else if (move === 'press') {
      const p = pressOdds(g, n, issue);
      if (issue.want <= 0) return { ok: false, why: 'その項目は日本から求めるものではない' };
      if (issue.theirs >= Math.min(issue.want, issue.max)) { return { ok: false, why: issue.theirs >= issue.max ? '相手はこれ以上は出せないと言っている（上限）' : 'すでに期待する水準まで相手が応じている' }; }
      if (roll(p)) { issue.theirs++; n.mood = clamp(n.mood - 3, 0, 100); n.momentum = clamp(n.momentum + 1, -4, 4); text = `「${issue.name}」で相手が応じた（${issue.lvT[issue.theirs]}）。（見込みは${pct(p)}だった）`; }
      else { n.mood = clamp(n.mood - 9, 0, 100); n.momentum = clamp(n.momentum - 1, -4, 4); text = `「${issue.name}」を求めたが、相手は応じなかった。雰囲気が硬くなった。（見込みは${pct(p)}だった）`; }
    } else if (move === 'shield') {
      const p = shieldOdds(g, n, issue);
      if (issue.dem <= 0) return { ok: false, why: '相手はその項目を求めていない' };
      if (roll(p)) { issue.dem = Math.max(0, issue.dem - 1); issue.shield = true; n.mood = clamp(n.mood - 2, 0, 100); text = `「${issue.name}」について、日本の事情を説明し、相手の要求を下げさせた。（見込みは${pct(p)}だった）`; }
      else { n.mood = clamp(n.mood - 10, 0, 100); n.momentum = clamp(n.momentum - 1, -4, 4); text = `「${issue.name}」を守りたいと主張したが、相手は「例外は認められない」と応じた。（見込みは${pct(p)}だった）`; }
    } else if (move === 'recess') {
      n.mood = clamp(n.mood + 5, 0, 100);
      text = '休会をはさみ、雰囲気がやわらいだ。';
      if (roll(0.22)) { const i = pick(n.issues.filter((x) => x.dem < 3)); if (i) { i.dem++; text += `\nただし相手は「${i.name}」の要求を一段上げてきた。`; } }
    } else if (move === 'escalate') {
      const next = n.level === 'official' ? 'fm' : 'summit';
      useStam(g, LEVELS[next].stam);
      n.level = next; n.mood = clamp(n.mood + 6, 0, 100); n.momentum = clamp(n.momentum + 1, -4, 4);
      let raised = 0;
      for (const i of n.issues) if (i.max < 3 && roll(0.4)) { i.max++; raised++; }
      text = `協議を「${LEVELS[next].name}」に格上げした。${raised ? '政治判断で、相手が出せる範囲が広がった項目がある。' : ''}`;
      used = false;
    } else if (move === 'walk') {
      n.status = 'walked';
      const rel = roll(0.3 + (n.mood > 50 ? 0.1 : 0));
      if (COUNTRIES[n.pk]) relAdd(g, n.pk, rel ? -2 : -4);
      n.result = { ok: false, text: '日本が席を立った' };
      news(g, `日本政府は${n.name}の交渉を打ち切った`);
      tl(g, 'nego', `${n.name}の交渉を打ち切った`, n.pk);
      text = '交渉の席を立った。';
      if (rel) {
        const top = n.issues.slice().sort((a, b) => b.w2 - a.w2).find((i) => i.theirs < i.max);
        n.status = 'open'; n.mood = 56; n.round = Math.max(1, n.rounds - 2); n.momentum = 0; n.result = null;
        if (top) top.theirs = Math.min(top.max, top.theirs + 1);
        text += `\nところが数日後、相手国から再開の打診があった。条件を見直す用意があるという${top ? `（「${top.name}」で譲歩の姿勢）` : ''}。交渉は続けられる。`;
      }
      n.log.push(text);
      return { ok: true, text, ended: n.status !== 'open', view: view(g, n.id) };
    } else if (move === 'conclude') {
      const p = concludeOdds(g, n);
      if (roll(p)) {
        const r = finalize(g, n);
        return { ok: true, text: r.text, ended: true, signed: true, view: view(g, n.id) };
      }
      n.mood = clamp(n.mood - 8, 0, 100); n.momentum = clamp(n.momentum - 1, -4, 4);
      const gap = n.issues.filter((i) => i.dem > i.mine).sort((a, b) => b.w * (b.dem - b.mine) - a.w * (a.dem - a.mine))[0];
      text = `署名には至らなかった。${gap ? `相手は「${gap.name}」でなお${gap.lv[gap.dem]}を求めている。` : '相手は慎重な姿勢だ。'}（見込みは${pct(p)}だった）`;
    }
    if (used) n.round++;
    n.log.push(text);
    const b = brokenCheck(g, n);
    if (b) text += `\n${b}`;
    else if (n.round > n.rounds && n.status === 'open') text += '\n協議の回数が尽きた。合意をまとめるか、席を立つかを選ぶ。';
    return { ok: true, text, ended: n.status !== 'open', view: view(g, n.id) };
  }
  function finalize(g, n) {
    const K = NEG[n.kind];
    const r = K.finish(g, n) || {};
    n.status = r.pending ? 'signed' : 'done';
    n.result = { ok: true, text: r.text || '合意した' };
    const dom = domestic(n);
    const p = pol(g);
    if (p && shiftSupport) shiftSupport(p, dom, 0.0011);
    n.log.push(n.result.text);
    tl(g, 'treaty', r.line || `${n.name}が合意した`, n.pk);
    return { text: `${n.result.text}${domesticLines(n).length ? `\n（${domesticLines(n).join('／')}）` : ''}` };
  }
  function negoEnd(g, id) {
    const n = D(g).negos.find((x) => x.id === id);
    if (!n || n.status !== 'open') return { ok: false, why: '交渉はもう終わっている' };
    n.status = 'walked'; n.result = { ok: false, text: '交渉を取りやめた' };
    return { ok: true, text: '交渉を取りやめた。' };
  }

  // ---------------------------------------------------------------- the Diet (国会承認)
  const inSession = (g) => { const p = pol(g); const S = p && p.diet && p.diet.session; const day = today(g); return !!(S && day >= num(S.start) && day <= num(S.end)); };
  // the yes-share of a party on a matter (tags: fta agri_cut agri_raise tariff_up security peace terr_partial china ties)
  function partyYes(g, pid, tags) {
    const p = pol(g);
    const pt = p && p.parties && p.parties[pid];
    const ruling = p && p.cabinet && (p.cabinet.partyIds || []).includes(pid);
    if (pid === 'ind') return 0.5;
    const ideo = (pt && pt.ideology) || {};
    const econ = num(ideo.econ), sec = num(ideo.security);
    const plat = (pt && pt.platform) || [];
    const farm = plat.some((x) => /farm|fisher|local_grant/.test(x)) ? 1 : 0;
    const pac = plat.some((x) => /defense_cut|min_wage|irregular/.test(x)) ? 1 : 0;
    let y = ruling ? 0.93 : 0.5;
    const has = (t) => tags.includes(t);
    if (has('fta') || has('agri_cut')) y = ruling ? 0.9 - (has('agri_cut') ? 0.12 * farm + 0.05 : 0.04 * farm) : 0.5 + 0.17 * econ - 0.36 * farm - 0.06 * pac;
    if (has('agri_raise')) y = ruling ? 0.88 : 0.56 - 0.2 * econ + 0.3 * farm;
    if (has('tariff_up')) y = ruling ? 0.84 : 0.46 - 0.18 * econ + 0.25 * farm;
    if (has('security')) y = ruling ? 0.92 : 0.5 + 0.22 * sec - 0.3 * pac;
    if (has('peace')) y = ruling ? 0.9 : 0.62 - (has('terr_partial') ? 0.12 * Math.max(0, sec) : 0);
    if (has('china') && !ruling) y -= 0.05 * Math.max(0, sec);
    return clamp(y, 0.04, 0.99);
  }
  function houseYes(g, house, tags) {
    const p = pol(g);
    const H = p && p.diet && p.diet[house];
    if (!H || !H.seats) return null;
    const total = num(H.total) || Object.values(H.seats).reduce((a, v) => a + num(v), 0) || 1;
    let yes = 0;
    for (const [pid, n] of Object.entries(H.seats)) yes += num(n) * partyYes(g, pid, tags);
    return { yes: yes / total, total, seats: yes };
  }
  function dietEstimate(g, tags, kind = 'treaty') {
    const a = houseYes(g, 'shugi', tags), b = houseYes(g, 'sangi', tags);
    if (!a) return { shugi: null, sangi: null, pass: dietOdds(g) };
    const ph = (y) => clamp(0.5 + (y - 0.5) * 7, 0.02, 0.98);
    const pa = ph(a.yes), pb = b ? ph(b.yes) : 0.7;
    // a treaty: the 衆議院 decides in the end (憲法61条・60条); a law: the 参議院 can be overridden by 2/3 (憲法59条)
    const over = kind === 'treaty' ? 1 : (a.yes >= 0.667 ? 0.9 : 0.04);
    const pass = pa * (pb + (1 - pb) * over);
    return { shugi: Math.round(a.yes * 100) / 100, sangi: b ? Math.round(b.yes * 100) / 100 : null, pass: Math.round(clamp(pass, 0.02, 0.97) * 100) / 100, pShugi: Math.round(pa * 100) / 100, pSangi: Math.round(pb * 100) / 100 };
  }
  const STAGES = [['submit', '提出（国会の開会待ち）'], ['s_committee', '衆議院 外務委員会（審議）'], ['s_plenary', '衆議院 本会議（採決）'], ['c_committee', '参議院 外交防衛委員会（審議）'], ['c_plenary', '参議院 本会議（採決）']];
  const stageName = (it) => ((it.kind === 'law' ? { s_committee: '衆議院 財務金融委員会（審議）', s_plenary: '衆議院 本会議（採決）', c_committee: '参議院 財政金融委員会（審議）', c_plenary: '参議院 本会議（採決）' } : {})[it.stage]) || (STAGES.find((x) => x[0] === it.stage) || [0, it.stage])[1];
  function dietSubmit(g, def) {
    const d = D(g);
    const it = { id: 'd' + d.seq++, kind: def.kind || 'treaty', handler: def.handler || def.kind || 'treaty', name: def.name, tags: def.tags || [], payload: def.payload || {}, stage: 'submit', day: today(g), next: today(g), log: [{ day: today(g), text: `国会に提出（${def.kind === 'law' ? '閣法' : '条約の承認案'}）` }], status: 'open', started: false, urgent: !!def.urgent };
    // the politics bill vehicle (if the core accepts it); otherwise the world's own Diet process
    if (def.bill && typeof g.proposeBill === 'function') {
      try {
        const id = g.proposeBill({ policy: def.bill, title: def.name });
        if (id) { it.billId = id; it.via = 'bill'; it.log.push({ day: today(g), text: '政治コアの法案として提出された' }); }
      } catch (e) { /* the world's own process */ }
    }
    d.diet.push(it);
    if (d.diet.length > 30) d.diet = d.diet.filter((x) => x.status === 'open').concat(d.diet.filter((x) => x.status !== 'open').slice(-10));
    // without the politics core there is no Diet to wait for
    if (!pol(g)) dietResolve(g, it, roll(0.75));
    return it;
  }
  function dietResolve(g, it, passed, how) {
    const H = DIET_H[it.handler];
    it.status = passed ? 'passed' : 'failed';
    it.closed = today(g);
    it.stage = passed ? 'done' : 'rejected';
    it.log.push({ day: today(g), text: passed ? how || '国会で承認された' : how || '国会で否決された' });
    try { if (H) (passed ? H.onPass : H.onFail)(g, it); } catch (e) { console.error(e); }
    emit(g, 'ratify', { id: it.id, name: it.name, passed });
    tl(g, 'diet', `${it.name}：${passed ? '国会で承認・可決' : '国会で否決'}`);
  }
  function dietTick(g) {
    const d = D(g);
    const day = today(g);
    for (const it of d.diet) {
      if (it.status !== 'open') continue;
      // the politics bill vehicle: follow the bill
      if (it.via === 'bill') {
        const p = pol(g);
        const b = p && Array.isArray(p.diet && p.diet.bills) ? p.diet.bills.find((x) => x.id === it.billId) : null;
        if (!b) { it.via = null; }
        else {
          const stage = b.stage;
          it.stage = stage === 'enacted' ? 'c_plenary' : stage === 'sangi' ? 'c_committee' : stage === 'shugi' ? 's_plenary' : 's_committee';
          if (stage === 'enacted') { dietResolve(g, it, true, '政治コアの法案として成立した'); continue; }
          if (stage === 'rejected' || stage === 'shelved') { dietResolve(g, it, false, stage === 'rejected' ? '政治コアの法案が否決された' : '法案は審議されないまま廃案になった'); continue; }
          continue;
        }
      }
      if (!pol(g)) { dietResolve(g, it, roll(0.7)); continue; }
      if (!inSession(g)) { if (it.stage !== 'submit') it.log.push({ day, text: '国会が閉会した。審議は次の国会に持ち越し' }), it.stage = 'submit'; continue; }
      if (day < it.next) continue;
      if (it.stage === 'submit') { it.stage = 's_committee'; it.next = day + rint(3, 6); it.log.push({ day, text: '国会が開会中。衆議院の委員会で審議が始まった' }); continue; }
      if (it.stage === 's_committee') { it.stage = 's_plenary'; it.next = day + rint(1, 2); it.log.push({ day, text: '委員会で可決。本会議へ' }); continue; }
      if (it.stage === 's_plenary') {
        const h = houseYes(g, 'shugi', it.tags);
        const y = h ? h.yes : 0.6;
        const ok = y + (rnd() - 0.5) * 0.06 > 0.5;
        it.votes = { shugi: Math.round(y * 100) };
        if (!ok) { dietResolve(g, it, false, `衆議院で否決された（賛成の見込み約${it.votes.shugi}%）`); continue; }
        it.stage = 'c_committee'; it.next = day + rint(4, 8); it.log.push({ day, text: `衆議院を通過（賛成 約${it.votes.shugi}%）。参議院へ` }); it.sentDay = day; continue;
      }
      if (it.stage === 'c_committee') { it.stage = 'c_plenary'; it.next = day + rint(1, 3); it.log.push({ day, text: '参議院の委員会で採決。本会議へ' }); continue; }
      if (it.stage === 'c_plenary') {
        const h = houseYes(g, 'sangi', it.tags);
        const y = h ? h.yes : 0.6;
        const ok = y + (rnd() - 0.5) * 0.06 > 0.5;
        it.votes = { ...(it.votes || {}), sangi: Math.round(y * 100) };
        if (ok) { dietResolve(g, it, true, `参議院でも可決された（賛成の見込み約${it.votes.sangi}%）`); continue; }
        if (it.kind === 'treaty') { bumpApproval(g, -0.8, '参議院での条約の否決'); news(g, `参議院が「${it.name}」を否決。憲法61条により、衆議院の議決が国会の議決となる`); dietResolve(g, it, true, '参議院は否決したが、憲法61条・60条により衆議院の議決が国会の議決となった（承認）'); continue; }
        const hs = houseYes(g, 'shugi', it.tags);
        if (hs && hs.yes >= 0.667) { dietResolve(g, it, true, '参議院は否決したが、衆議院が出席議員の3分の2以上で再可決した（憲法59条）'); continue; }
        dietResolve(g, it, false, '参議院で否決され、衆議院の再可決（3分の2）にも届かなかった'); continue;
      }
    }
  }
  function dietList(g) {
    return D(g).diet.slice().reverse().slice(0, 14).map((it) => ({ id: it.id, kind: it.kind, handler: it.handler, payload: it.payload && it.payload.cat ? { cat: it.payload.cat, rate: it.payload.rate } : undefined, name: it.name, status: it.status, stage: it.stage, stageShort: it.status !== 'open' ? (it.status === 'passed' ? '可決' : '否決') : ({ submit: '提出', s_committee: '衆院審議', s_plenary: '衆院採決', c_committee: '参院審議', c_plenary: '参院採決' })[it.stage] || '', stageName: it.status === 'open' ? stageName(it) : it.status === 'passed' ? '承認・可決' : '否決', day: it.day, closed: it.closed || null, log: it.log.slice(-4), votes: it.votes || null, via: it.via || 'own', inSession: inSession(g), estimate: it.status === 'open' ? dietEstimate(g, it.tags, it.kind) : null }));
  }

  // ---------------------------------------------------------------- security pact / peace negotiations
  registerNegotiation('security', {
    who: ['pm', 'defense'],
    desc: '共同訓練・部隊の往来・情報の協力を、協定にまとめる交渉。防衛の義務は負わない。',
    rounds: 6,
    title: (g, t) => `日${shortName(g, t)}防衛協力協定`,
    check(g, t) {
      if (!t || !exists(g, t)) return '相手を選ぶ';
      if (!hasTies(g, t)) return `${shortName(g, t)}とは国交がない`;
      if (atWarWith(g, t)) return '戦争中の相手とは結べない';
      if (japanAllies(g).some((a) => a.id === t)) return 'すでに同盟・安全保障の協力の枠組みがある';
      if (relation(g, t) < -10) return `関係が冷えこんでいて、交渉に入れない（関係 ${relation(g, t)}。首脳会談などで改善する）`;
      return null;
    },
    issues(g, t) {
      const r = relation(g, t);
      const west = blocOf(g, t) === 'west';
      return [
        { id: 'exercise', name: '共同訓練・演習', w: 2, dem: 2, want: 1, theirs: 1, max: 3, seg: { unions: -1, elderly: 0.5 } },
        { id: 'rsa', name: '円滑化協定（部隊の法的地位・手続き）', w: 2, dem: r > 30 ? 2 : 1, want: 2, theirs: 0, max: 2, seg: { unions: -1.5, elderly: 0.5 }, note: '裁判権・入国手続きなど' },
        { id: 'info', name: '情報の共有・保護', w: 1, dem: 1, want: 1, theirs: 1, max: 3, seg: { unions: -1, business: 0.3 } },
        { id: 'equip', name: '装備・技術の協力', w: 1, dem: west ? 2 : 1, want: 1, theirs: 0, max: 2, seg: { unions: -1.5, business: 0.5 } },
        { id: 'access', name: '施設の相互利用', w: 1, dem: r > 45 ? 2 : 0, want: 1, theirs: 0, max: 2, seg: { unions: -1.5, rural: -0.5 } },
      ];
    },
    finish(g, n) {
      const t = n.target;
      const pts = n.issues.reduce((a, i) => a + i.mine * i.w, 0);
      const content = { levels: Object.fromEntries(n.issues.map((i) => [i.id, i.mine])), theirs: Object.fromEntries(n.issues.map((i) => [i.id, i.theirs])) };
      const est = dietEstimate(g, ['security'], 'treaty');
      dietSubmit(g, { kind: 'treaty', handler: 'treaty', name: n.name, tags: ['security'], payload: { effect: 'security', with: t, name: n.name, content, pts } });
      return { text: `${n.name}で合意し、署名した。国会の承認を求める（衆議院の賛成の見込み 約${est.shugi != null ? Math.round(est.shugi * 100) : '—'}%）。`, line: `${n.name}に署名した（国会の承認待ち）`, pending: true };
    },
  });
  registerApply('security', (g, pl) => {
    const s = W(g);
    const t = pl.with;
    const aid = `jp_${t}_coop`;
    s.alliances[aid] = { player: true, name: pl.name, short: `日${shortName(g, t)}協力`, kind: 'partnership', members: ['jp', t], strength: clamp(30 + pl.pts * 2.5, 30, 70), since: today(g) };
    addTreaty(g, { name: pl.name, kind: 'security', with: [t] });
    s.treaties[Object.keys(s.treaties).pop()].content = pl.content;
    relAdd(g, t, 6); threatAdd(g, -2); tensionShift(g, 1);
    for (const x of X.CNRU) if (x !== t && exists(g, x) && blocOf(g, t) === 'west') relAdd(g, x, -2);
    news(g, `${pl.name}が国会で承認され、発効した`);
    phone(g, `【国際ニュース】${pl.name}が発効した。共同訓練や部隊の往来が円滑になる。`);
    ideoNudge(g, { world: 0.3 }, 0.03, pl.name);
  });
  registerNegotiation('peace', {
    who: ['pm'],
    desc: '戦後に残った平和条約の交渉。領土の扱いが最大の争点。',
    rounds: 7,
    title: (g, t) => `日${shortName(g, t)}平和条約`,
    bonus: (g) => num((W(g).disputes.northern || {}).talks) * 0.02,
    check(g, t) {
      if (t !== 'ru' && t !== 'su') return '平和条約の問題が残っているのはロシア（ソ連）との間（中国とは1978年の条約、韓国とは1965年の基本条約）';
      if (!hasTies(g, t)) return '国交がない';
      if (W(g).disputes.northern && W(g).disputes.northern.status !== 'dispute') return 'すでに平和条約を結んだ';
      if (atWarWith(g, t)) return '戦争中';
      return null;
    },
    issues(g, t) {
      const r = relation(g, t);
      const talks = num((W(g).disputes.northern || {}).talks);
      return [
        { id: 'terr', name: '北方領土の扱い', w: 3, dem: 0, want: 3, theirs: 0, max: r > 20 || talks >= 3 ? 2 : 1, w2: 3, lv: ['現状（相手の実効支配）', '歯舞・色丹の引き渡しで決着', '歯舞・色丹に加え、国後の協議', '4島の返還'], lvT: ['引き渡しなし', '歯舞・色丹の引き渡し', '歯舞・色丹＋国後の協議', '4島の返還'], seg: { elderly: -0.5 }, note: '最大の争点' },
        { id: 'econ', name: '共同経済活動・経済協力', w: 1, dem: 2, want: 0, theirs: 1, max: 3, w2: 1, seg: { business: 1, rural: 0.3 } },
        { id: 'sec', name: '島の非軍事化・安全保障上の約束', w: 2, dem: 2, want: 1, theirs: 0, max: 2, w2: 1, seg: { elderly: -0.3 } },
        { id: 'people', name: '元島民・島民の権利（墓参・自由往来）', w: 1, dem: 1, want: 2, theirs: 1, max: 3, w2: 1, seg: {} },
      ];
    },
    finish(g, n) {
      const t = n.target;
      const terr = n.issues.find((i) => i.id === 'terr');
      const gain = terr.theirs;
      const terms = gain >= 3 ? 'four' : gain >= 1 ? 'two' : 'shelve';
      const tags = ['peace', ...(terms === 'two' ? ['terr_partial'] : [])];
      const est = dietEstimate(g, tags, 'treaty');
      dietSubmit(g, { kind: 'treaty', handler: 'treaty', name: n.name, tags, payload: { effect: 'peace', with: t, name: n.name, terms } });
      const tt = { four: '北方4島の返還', two: '歯舞群島と色丹島の引き渡し', shelve: '領土問題は棚上げ' }[terms];
      return { text: `${n.name}で合意した（${tt}）。国会の承認を求める（衆議院の賛成の見込み 約${est.shugi != null ? Math.round(est.shugi * 100) : '—'}%）。`, line: `${n.name}に署名した（${tt}）`, pending: true };
    },
  });
  registerApply('peace', (g, pl) => {
    const s = W(g);
    const t = pl.with, terms = pl.terms;
    const Dd = s.disputes.northern || (s.disputes.northern = {});
    Dd.status = terms === 'four' ? 'resolved' : terms === 'two' ? 'partial' : 'shelved';
    Dd.admin = terms === 'four' ? 'jp' : 'ru';
    addTreaty(g, { name: pl.name, kind: 'peace', with: [t] });
    relAdd(g, t, 25);
    ecoShock(g, `${pl.name}（経済協力）`, { growth: 0.1, len: 360 });
    bumpApproval(g, terms === 'four' ? 10 : terms === 'two' ? (roll(0.5) ? 3 : -3) : -6, '平和条約');
    standingAdd(g, 4);
    const tt = { four: '北方4島が日本に戻ることになった', two: '歯舞群島と色丹島が日本に引き渡されることになった', shelve: '領土問題は棚上げされた' }[terms];
    news(g, `日本と${shortName(g, t)}が平和条約を発効させた。${tt}`);
    phone(g, `【速報】日本と${shortName(g, t)}の平和条約が発効した。\n${tt}。`);
    scene(g, 'treaty', { name: pl.name, with: t, line: tt });
  });
  registerDiet('treaty', {
    onPass(g, it) {
      const pl = it.payload || {};
      const fn = APPLY[pl.effect];
      if (fn) fn(g, pl);
      W(g).record.treaties = num(W(g).record.treaties);
    },
    onFail(g, it) {
      const pl = it.payload || {};
      if (pl.with && COUNTRIES[pl.with]) relAdd(g, pl.with, -2);
      bumpApproval(g, -1.5, `${it.name}の否決`);
      news(g, `「${it.name}」は国会で承認されなかった`);
      phone(g, `【ニュース】「${it.name}」が国会で否決された。署名した政府の責任を問う声が出ている。`);
    },
  });

  // ---------------------------------------------------------------- visits of foreign leaders (titles only)
  function visitsTick(g) {
    const d = D(g);
    const day = today(g);
    for (const v of d.visits) {
      if (v.status !== 'pending') continue;
      if (day > v.until) {
        v.status = 'missed';
        if (isPM(g) || isFM(g)) { relAdd(g, v.country, -1); news(g, `${v.title}が来日したが、日本側は十分に応対できなかった`); }
      }
    }
    if (d.visits.length > 14) d.visits = d.visits.filter((v) => v.status === 'pending').concat(d.visits.filter((v) => v.status !== 'pending').slice(-8));
    if (day - d.lastVisit < 10 || !roll(0.1)) return;
    const ids = X.countriesNow(g).filter((id) => id !== 'kp' && hasTies(g, id) && relation(g, id) > -20 && !atWarWith(g, id) && !d.visits.some((v) => v.country === id && v.status === 'pending'));
    if (!ids.length) return;
    // closer and bigger partners come more often
    const w = ids.map((id) => Math.max(1, 20 + relation(g, id) + tradeOf(g, id) * 3));
    let r0 = rnd() * w.reduce((a, b) => a + b, 0), id = ids[0];
    for (let i = 0; i < ids.length; i++) { r0 -= w[i]; if (r0 <= 0) { id = ids[i]; break; } }
    const rel = relation(g, id);
    const kind = rel >= 55 && roll(0.4) ? '国賓として' : rel >= 20 ? '公式に' : '実務で';
    const title = leaderTitle(g, id);
    d.lastVisit = day;
    const v = { id: 'v' + d.seq++, country: id, title, kind, day, until: day + 5, status: 'pending' };
    d.visits.push(v);
    if (isPM(g) || isFM(g)) { news(g, `${title}が${kind}来日する予定。政府は接遇の準備を進めている`); note(g, `（${title}が来日する。「外交」の画面から接遇できる）`); }
    else {
      v.status = 'done'; relAdd(g, id, rint(1, 3));
      news(g, `${title}が${kind}来日し、日本の総理と会談した`);
      tl(g, 'visit', `${title}が来日（${kind}）`, id);
    }
  }

  // ---------------------------------------------------------------- diplomacy actions (the same pattern as world.js's DIPLO)
  const ACTIONS = {
    envoy: {
      name: '特使を派遣する', who: ['pm', 'foreign'], target: 'country', desc: '首脳会談の前に、特使（総理の親書を携える）を派遣して地ならしをする（体力8）。会談や交渉が通りやすくなる（30日間）。',
      check(g, id) {
        if (!id || !exists(g, id)) return '相手を選ぶ';
        if (!hasTies(g, id) && id !== 'kp') return `${shortName(g, id)}とは国交がない（まず国交を結ぶ）`;
        if (atWarWith(g, id)) return '戦争中';
        if (D(g).prep[id] && D(g).prep[id] >= today(g)) return 'この国にはすでに特使を送り、地ならし中';
        if (stam(g) < 8) return '体力が足りない（体力8）';
        return null;
      },
      odds: (g, id) => clamp(baseOdds(g, id, 0.15), 0.1, 0.95),
      lines: (g, id) => ['成功：関係＋1〜3。30日のあいだ、首脳会談・交渉の見込みが約7%上がる', '失敗：先方の都合がつかず、何も起きない（体力だけを使う）', '首脳会談より安く、外相会談より格が低い。支持率には響かない'],
      run(g, id) {
        useStam(g, 8);
        const p = ACTIONS.envoy.odds(g, id);
        if (!roll(p)) { news(g, `${shortName(g, id)}への特使の派遣は、先方の日程が合わず見送られた`); return { ok: true, success: false, text: `特使は先方の要人に会えなかった。（見込みは${pct(p)}だった）` }; }
        const d = relAdd(g, id, rint(1, 3));
        D(g).prep[id] = today(g) + 30;
        W(g).summits.met[id] = W(g).summits.met[id];
        tl(g, 'envoy', `${shortName(g, id)}に特使を派遣した`, id);
        news(g, `政府が${shortName(g, id)}に特使を派遣した。首脳間の対話に向けた地ならし`);
        return { ok: true, success: true, text: `特使が${shortName(g, id)}の${leaderTitle(g, id)}に親書を届け、地ならしができた。（関係 ${d >= 0 ? '+' : ''}${d}）` };
      },
    },
    receive_visit: {
      name: '来日した要人を接遇する', who: ['pm', 'foreign'], target: 'country', desc: '来日している外国の首脳・要人を迎え、会談と歓迎の行事を行う（体力12）。',
      check(g, id) {
        const v = D(g).visits.find((x) => x.country === id && x.status === 'pending');
        if (!v) return 'この国の要人は来日していない（「外務省の助言」や外交の画面で来日の予定を確かめる）';
        if (stam(g) < 12) return '体力が足りない（体力12）';
        return null;
      },
      odds: (g, id) => clamp(baseOdds(g, id, 0.2), 0.2, 0.97),
      lines: (g, id) => { const v = D(g).visits.find((x) => x.country === id && x.status === 'pending'); return [v ? `${v.title}が${v.kind}来日中（${v.until - today(g) >= 0 ? `あと${v.until - today(g)}日` : ''}）` : '', '成功：関係＋3〜6・国際的な信頼＋', '会談の内容は関係が良いほど踏みこんだものになる（共同声明の文面も変わる）'].filter(Boolean); },
      options: () => [{ id: 'econ', label: '経済・貿易の協力', sub: '' }, { id: 'security', label: '安全保障の協力', sub: '' }, { id: 'friend', label: '友好・人の交流', sub: '' }],
      run(g, id, o) {
        const v = D(g).visits.find((x) => x.country === id && x.status === 'pending');
        if (!v) return { ok: false, why: '要人は来日していない' };
        useStam(g, 12);
        v.status = 'done';
        const p = ACTIONS.receive_visit.odds(g, id);
        const topic = (o && o.topic) || 'friend';
        const ok = roll(p);
        W(g).summits.met[id] = today(g);
        W(g).record.summits++;
        const c = communique(g, id, topic, ok);
        if (ok) {
          const dv = relAdd(g, id, rint(3, 6) + (v.kind === '国賓として' ? 2 : 0));
          standingAdd(g, 1);
          if (isPM(g)) bumpApproval(g, 1, `${shortName(g, id)}要人の接遇`);
          news(g, `${who0(g)}が${v.title}と会談した。${c.lines[0]}`);
          tl(g, 'visit', `${v.title}を迎え、会談した`, id);
          return { ok: true, success: true, text: `${v.title}を迎え、会談した。\n${c.head}：${c.lines.join('\n')}\n（関係 ${dv >= 0 ? '+' : ''}${dv}）` };
        }
        relAdd(g, id, -1);
        tl(g, 'visit', `${v.title}との会談は実りが少なかった`, id);
        return { ok: true, success: false, text: `会談は儀礼的なものにとどまった。\n${c.head}：${c.lines.join('\n')}（見込みは${pct(p)}だった）` };
      },
    },
    invite: {
      name: '首脳・要人を日本に招く', who: ['pm', 'foreign'], target: 'country', desc: '相手国の首脳・要人に来日を働きかける。10〜20日のうちに来日し、日本で迎えられる。',
      check(g, id) {
        if (!id || !exists(g, id)) return '相手を選ぶ';
        if (!hasTies(g, id)) return `${shortName(g, id)}とは国交がない`;
        if (atWarWith(g, id)) return '戦争中';
        if (D(g).visits.some((v) => v.country === id && v.status === 'pending')) return 'すでに来日の予定がある';
        if (D(g).flags['inv_' + id] && today(g) - D(g).flags['inv_' + id] < 30) return 'この国にはつい最近、招待した（30日ほどあける）';
        return null;
      },
      odds: (g, id) => clamp(baseOdds(g, id, -0.05), 0.05, 0.9),
      lines: (g, id) => [`相手：${leaderTitle(g, id)}`, '成功：10〜20日後に来日し、「来日した要人を接遇する」でもてなせる', '失敗：先方は日程の都合を理由に断る'],
      run(g, id) {
        const d = D(g);
        d.flags['inv_' + id] = today(g);
        const p = ACTIONS.invite.odds(g, id);
        if (!roll(p)) { relAdd(g, id, -0.5); return { ok: true, success: false, text: `${shortName(g, id)}は日程の都合を理由に、来日を見送った。（見込みは${pct(p)}だった）` }; }
        const rel = relation(g, id);
        const at = today(g) + rint(10, 20);
        d.visits.push({ id: 'v' + d.seq++, country: id, title: leaderTitle(g, id), kind: rel >= 55 ? '国賓として' : '公式に', day: at, until: at + 5, status: 'scheduled', start: at });
        return { ok: true, success: true, text: `${leaderTitle(g, id)}が来日することになった（${at - today(g)}日後ごろ）。` };
      },
    },
    soft_action: {
      name: '文化・人の交流（ソフトパワー）', who: ['pm', 'foreign'], target: 'country', desc: '文化の発信・留学生・スポーツ・ビザなどで、相手国の国民との結びつきを深める。関係と日本のイメージにじわじわ効く。',
      options: () => SOFT_OPTIONS.map((o) => ({ id: o.id, label: o.label, sub: o.sub })),
      check(g, id, o) {
        if (!id || !exists(g, id)) return '相手を選ぶ';
        if (!hasTies(g, id)) return `${shortName(g, id)}とは国交がない（交流は国際機関や民間を通じた形になる）`;
        const op = SOFT_OPTIONS.find((x) => x.id === (o && o.kind));
        if (op && stam(g) < op.stam) return `体力が足りない（体力${op.stam}）`;
        const last = D(g).flags['soft_' + id];
        if (last && today(g) - last < 12) return 'この国とは少し前に交流事業を行った（12日ほどあける）';
        return null;
      },
      odds: () => null,
      lines(g, id, o) {
        const op = SOFT_OPTIONS.find((x) => x.id === ((o && o.kind) || 'culture')) || SOFT_OPTIONS[0];
        return [`関係＋${op.rel}・ソフトパワー＋${op.soft}・国際的な信頼＋0.5`, `体力${op.stam}`, groupsBonus(g) > 0 ? `団体・協会の協力でさらに少し効果が上がる（＋${(groupsBonus(g) * 0.1).toFixed(1)}）` : null, `いまのソフトパワー：${softScore(g)}／100`].filter(Boolean);
      },
      run(g, id, o) {
        const op = SOFT_OPTIONS.find((x) => x.id === ((o && o.kind) || 'culture')) || SOFT_OPTIONS[0];
        useStam(g, op.stam);
        const d = D(g);
        d.flags['soft_' + id] = today(g);
        const gb = groupsBonus(g) * 0.1;
        d.soft.bonus = clamp(d.soft.bonus + op.soft + gb, 0, 25);
        relAdd(g, id, op.rel); standingAdd(g, 0.5);
        if (op.id === 'visa') ecoShock(g, '観光ビザの緩和', { growth: 0.03, len: 150 });
        tl(g, 'soft', `${shortName(g, id)}との交流：${op.label}`, id);
        news(g, `日本政府が${shortName(g, id)}との${op.label}を進めている`, { feed: false });
        return { ok: true, success: true, text: `${shortName(g, id)}との交流事業（${op.label}）を行った。ソフトパワーは ${softScore(g)}／100。` };
      },
    },
    dispute_action: {
      name: '領土問題への取り組み', who: ['pm', 'foreign'], target: 'none', desc: '北方領土・竹島・尖閣諸島について、協議・提案・警備の強化・共同の取り組みなどを選ぶ。それぞれの立場と見込みを確かめてから。',
      options(g) {
        const out = [];
        const add = (id, label, sub) => out.push({ id, label, sub });
        if (exists(g, 'ru') || exists(g, 'su')) { add('northern:talks', '北方領土：平和条約交渉を前に進める協議', '関係と見込みしだいで、平和条約への道が開く'); add('northern:joint', '北方領土：共同経済活動の協議', '島での漁業・観光・医療などの共同事業。立場は崩さない形で'); }
        if (exists(g, 'kr')) { add('takeshima:icj', '竹島：国際司法裁判所への付託を提案', '韓国は応じない立場。毅然とした姿勢として評価する声も、関係の冷えを心配する声も'); add('takeshima:dialogue', '竹島：歴史学者・民間の対話を支援', '政府間の対立とは別に、対話の窓口を保つ'); }
        if (exists(g, 'cn')) { add('senkaku:patrol', '尖閣諸島：海上保安庁の警備を強化', '巡視船の増強。緊張が高まる可能性もある'); add('senkaku:hotline', '尖閣諸島：偶発的な衝突を防ぐ連絡の仕組み', '防衛当局間の海空連絡メカニズムなどの協議'); }
        return out;
      },
      check(g, t, o) {
        if (!o || !o.act) return null;
        const [dis] = String(o.act).split(':');
        const country = { northern: W(g).ties.ru === 'cut' ? 'ru' : exists(g, 'ru') ? 'ru' : 'su', takeshima: 'kr', senkaku: 'cn' }[dis];
        if (country && !hasTies(g, country)) return `${shortName(g, country)}とは国交がない`;
        if (D(g).flags['dis_' + o.act] && today(g) - D(g).flags['dis_' + o.act] < 20) return 'この件には少し前に取り組んだばかり（20日ほどあける）';
        return null;
      },
      odds(g, t, o) {
        if (!o || !o.act) return null;
        const [dis, act] = String(o.act).split(':');
        const ru = exists(g, 'ru') ? 'ru' : 'su';
        if (dis === 'northern') return clamp(0.3 + relation(g, ru) / 200 + num((W(g).disputes.northern || {}).talks) * 0.03 - (act === 'talks' ? 0.1 : 0), 0.04, 0.8);
        if (dis === 'takeshima') return act === 'icj' ? 0.03 : clamp(0.5 + relation(g, 'kr') / 250, 0.1, 0.85);
        if (dis === 'senkaku') return act === 'patrol' ? 0.9 : clamp(0.35 + relation(g, 'cn') / 200, 0.05, 0.8);
        return null;
      },
      lines(g, t, o) {
        if (!o || !o.act) return ['項目を選んで、見込みと立場を確かめる'];
        const [dis, act] = String(o.act).split(':');
        const T = TERR[dis];
        const base = [`日本の立場：${T.jp}`, `相手の立場：${T.other}`];
        const eff = { 'northern:talks': '成功：協議が進む（平和条約の交渉の見込みが上がる）。失敗：進展なし', 'northern:joint': '成功：関係＋4・経済に少しプラス。国内に「領土の棚上げでは」と懸念の声も', 'takeshima:icj': '韓国は応じない見込み。関係−2・国内の評価は割れる', 'takeshima:dialogue': '成功：関係＋3・国内の保守層には慎重論', 'senkaku:patrol': '警備は強化されるが、中国との関係−2・緊張＋', 'senkaku:hotline': '成功：偶発的な衝突のリスクが下がる（脅威−2）' }[o.act];
        return [...base, eff].filter(Boolean);
      },
      run(g, t, o) {
        if (!o || !o.act) return { ok: false, why: '取り組みを選ぶ' };
        const [dis, act] = String(o.act).split(':');
        const s = W(g);
        const ru = exists(g, 'ru') ? 'ru' : 'su';
        const p = ACTIONS.dispute_action.odds(g, t, o);
        D(g).flags['dis_' + o.act] = today(g);
        useStam(g, 8);
        const ok = roll(p);
        const Dd = s.disputes[dis] || (s.disputes[dis] = { status: 'dispute' });
        const name = DISPUTES[dis].name;
        let text;
        if (o.act === 'northern:talks') {
          if (ok) { Dd.talks = num(Dd.talks) + 1; relAdd(g, ru, 2); text = `${name}の協議が一歩進んだ（これまでの協議 ${Dd.talks}回）。`; } else { relAdd(g, ru, -1); text = '協議は双方の主張が平行線のまま終わった。'; }
        } else if (o.act === 'northern:joint') {
          if (ok) { Dd.talks = num(Dd.talks) + 1; relAdd(g, ru, 4); ecoShock(g, '共同経済活動', { growth: 0.03, len: 150 }); text = '共同経済活動の対象事業で合意した。立場は変えないことも確認した。'; } else { text = '共同経済活動の法的な枠組みで折り合えなかった。'; }
        } else if (o.act === 'takeshima:icj') {
          relAdd(g, 'kr', -2); bumpApproval(g, roll(0.5) ? 1 : -1, '竹島の付託の提案'); text = '国際司法裁判所への付託を韓国に提案したが、韓国は応じなかった。';
        } else if (o.act === 'takeshima:dialogue') {
          if (ok) { relAdd(g, 'kr', 3); text = '歴史学者・民間の対話の場を支援し、双方の研究者が交流した。'; } else text = '対話の枠組みに政府間の調整が必要で、実現しなかった。';
        } else if (o.act === 'senkaku:patrol') {
          relAdd(g, 'cn', -2); tensionShift(g, 1); threatAdd(g, -1); text = '海上保安庁の巡視船を増強し、周辺海域の警備を強化した。';
        } else {
          if (ok) { threatAdd(g, -2); relAdd(g, 'cn', 1); text = '防衛当局間の連絡の仕組みを協議し、偶発的な衝突を防ぐ連絡経路を確認した。'; } else text = '連絡の仕組みの協議は、運用の範囲で折り合わなかった。';
        }
        tl(g, 'dispute', `${name}：${text}`);
        news(g, `${name}をめぐり、${text}`);
        return { ok: true, success: ok || o.act === 'takeshima:icj' || o.act === 'senkaku:patrol', text: `${text}${p != null && !['takeshima:icj', 'senkaku:patrol'].includes(o.act) ? `（見込みは${pct(p)}だった）` : ''}` };
      },
    },
  };

  // ---------------------------------------------------------------- tick / summary / methods
  function tick(g) {
    const d = D(g);
    const day = today(g);
    // scheduled visits arrive
    for (const v of d.visits) if (v.status === 'scheduled' && day >= num(v.start)) {
      v.status = 'pending'; v.day = day; v.until = day + 5;
      if (isPM(g) || isFM(g)) { news(g, `${v.title}が${v.kind}来日した`); note(g, `（${v.title}が来日した。「外交」の画面から接遇できる）`); }
      else { v.status = 'done'; relAdd(g, v.country, 2); }
    }
    dietTick(g);
    visitsTick(g);
    if (day - d.lastSnap >= 30) { d.lastSnap = day; const sc = standingScore(g); d.hist.push({ day, score: sc.score }); if (d.hist.length > 40) d.hist.shift(); }
    // open negotiations go cold if left alone for a long time
    for (const n of d.negos) if (n.status === 'open' && day - n.start > 150) { n.status = 'walked'; n.result = { ok: false, text: '長く放置され、交渉は立ち消えになった' }; }
    // the 特使's preparation expires quietly
    for (const k of Object.keys(d.prep)) if (d.prep[k] < day - 5) delete d.prep[k];
  }
  function summary(g) {
    const d = D(g);
    const sc = standingScore(g);
    return { diplo: { score: sc.score, grade: sc.grade, label: sc.label, trend: sc.trend, openNegos: d.negos.filter((n) => n.status === 'open').length, dietOpen: d.diet.filter((i) => i.status === 'open').length, visits: d.visits.filter((v) => v.status === 'pending').length, soft: softScore(g) } };
  }
  function treatyInfo(g, id) {
    const s = W(g);
    const T = TREATIES[id] || s.treaties[id] || null;
    const st = s.treaties[id] || null;
    const name = id === 'anpo' ? '日米安全保障条約' : T ? T.name : null;
    if (!name) return null;
    const I = TREATY_INFO[id];
    const kind = T ? T.kind : 'other';
    const gen = KIND_INFO[kind] || ['', ''];
    const gives = I ? I.gives : st && st.content ? contentLines(st.content, true) : [gen[0]].filter(Boolean);
    const costs = I ? I.costs : st && st.content ? contentLines(st.content, false) : [gen[1]].filter(Boolean);
    return { id, name, kind, with: (T && T.with ? T.with : []).map((x) => X.current(g, x)), status: st ? st.status : id === 'anpo' ? 'force' : 'none', since: st ? st.since : null, by: st ? st.by : null, gives, costs, real: !!I };
  }
  function contentLines(c, gives) {
    const L = [];
    if (c && c.cuts) {
      if (gives) L.push(...(c.cuts.theirs || []).map((x) => `相手国の関税：${x}`));
      else L.push(...(c.cuts.japan || []).map((x) => `日本の関税：${x}`), ...(c.cuts.notes || []));
    }
    return L;
  }
  const methods = {
    negotiations() { return D(this).negos.slice().reverse().map((n) => view(this, n)).filter(Boolean); },
    negotiationStart(kind, target, opts = {}) { return negoStart(this, kind, target, opts); },
    negotiationView(id) { return view(this, id); },
    negotiationMove(id, move, arg) { return negoMove(this, id, move, arg); },
    negotiationEnd(id) { return negoEnd(this, id); },
    dietTreaties() { return dietList(this); },
    dietEstimate(tags, kind) { return dietEstimate(this, tags, kind); },
    treatyInfo(id) { return treatyInfo(this, id); },
    disputeInfo(id) {
      const T = TERR[id];
      if (!T || !DISPUTES[id]) return null;
      const s = W(this);
      const y = worldDate(this).year;
      return { id, name: DISPUTES[id].name, jp: T.jp, other: T.other, law: T.law, timeline: T.timeline.filter(([yy]) => yy <= y).map(([yy, tx]) => ({ year: yy, text: tx })), status: (s.disputes[id] || {}).status || 'dispute', admin: (s.disputes[id] || {}).admin || DISPUTES[id].admin0, talks: num((s.disputes[id] || {}).talks) };
    },
    mofaAdvice(target = null) { return advice(this, target); },
    foreignVisits() { return D(this).visits.filter((v) => v.status === 'pending' || v.status === 'scheduled').map((v) => ({ ...v, name: shortName(this, v.country), daysLeft: v.status === 'pending' ? v.until - today(this) : v.start - today(this) })); },
    diplomaticStanding() { return standingScore(this); },
    diplomacyTimeline(n = 30) { return D(this).timeline.slice(0, n); },
    softPower() { const d = D(this); return { score: softScore(this), bonus: Math.round(d.soft.bonus * 10) / 10, groups: Math.round(groupsBonus(this) * 10) / 10, options: SOFT_OPTIONS.map((o) => ({ ...o })) }; },
    worldOpinion(n = 8) { return D(this).opinion.slice(0, n); },
    communique(id, topic = 'friend', ok = true) { return communique(this, id, topic, ok); },
  };
  return {
    methods, actions: ACTIONS, tick, summary, registerNegotiation, registerDiet, registerApply, dietSubmit, dietEstimate, negoStart, negoMove, view, tl, opinionReaction, communique, advice, standingScore, softScore, treatyInfo,
    D, prepBonus, partyYes, houseYes, inSession, LEVELS, OP, TERR, setStance(st) { STANCE = st; }, stanceHook() { return STANCE; }, dtext, TREATY_INFO,
  };
}
