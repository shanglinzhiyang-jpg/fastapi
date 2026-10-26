// Politics core (政治界): offices, elections, parties, the Diet, the Cabinet, policy &
// bills, public opinion, the economy, political money. CONTRACT written by the lead;
// the politics-core pass implements it. Other modules may rely on every name below.
//
// ---------------------------------------------------------------- principles
// - Realism by era (g.state.profile.era: showa 1980s / heisei_early 1990s / heisei 2000s /
//   reiwa now): electoral system (昭和 = 中選挙区制, 1996- 小選挙区比例代表並立制), seat
//   totals of 衆議院/参議院 per era, ministries (2001 省庁再編; デジタル庁 2021-; 復興庁
//   2012-), 供託金, eligibility ages (衆院・市区町村長・地方議員 25, 参院・知事 30), 政党要件
//   (国会議員5人 or 得票率2%), 政党交付金 (1995-), 政治資金規正法 rules. Verify facts.
// - Real parties: only 自由民主党 ('jimin', all eras, logo 'jimin') and 民主党 ('minshu',
//   1998-2016 only, logo 'minshu'), portrayed neutrally with verifiable facts. No real
//   politicians: every politician NPC is fictional (generated names). Other parties are
//   fictional and must not imitate real ones.
// - Policy effects are even-handed trade-offs across voter segments; no ideology is
//   presented as right or wrong.
// - Political time: one political year = YEAR_DAYS (120) game days (profile.js). 衆院 term
//   4 years (may be dissolved), 参院 6 years with half elected every 3 years, local terms 4
//   years; by-elections (補欠選挙) happen now and then so there is always a way in.
//
// ---------------------------------------------------------------- state (g.state.politics)
// {
//   v: 1,
//   me: {                          // the player as a politician
//     office: null | OFFICE id,    // current office (null = 民間人)
//     district: string|null,       // electoral district label
//     party: party id | null,      // null = 無所属
//     termEnd: day | null,
//     posts: [post ids],           // 党役職・内閣ポスト (e.g. 'pm', 'minister_finance', 'kanjicho')
//     faction: faction id | null,
//     wins: n, losses: n, careerStart: day|null,
//     funds: n,                    // 政治資金 (separate from personal money)
//     secret: n,                   // 裏金 (unreported funds) — scandal exposure risk
//     staff: n,                    // 秘書の数
//     reputation: -100..100,       // 政治家としての評判
//     localSupport: 0..100,        // 地元の支持 (地盤)
//   },
//   parties: { [id]: PARTY },      // see below; includes fictional NPC parties and any party the player founds
//   diet: {
//     shugi: { total, seats: { [party]: n } },
//     sangi: { total, seats: { [party]: n } },
//     session: null | { kind: '通常国会'|'臨時国会'|'特別国会', start: day, end: day },
//     bills: [BILL],               // pending
//   },
//   cabinet: { pm: npcId|'player', partyIds: [...], ministers: { [post]: npcId|'player' }, approval: 0..100, formed: day },
//   laws: [ENACTED],               // enacted bills with their ongoing effects
//   economy: { growth, inflation, unemployment, debtRatio, yen, nikkei, budget: { revenue, spending, deficit, items: { [area]: n } } },
//   opinion: { [segment]: { [party]: share 0..1 }, issues: { [area]: salience 0..1 } },
//   elections: { upcoming: [ELECTION], history: [RESULT] },
//   npcs: { [npcId]: { name, party, office, faction, look, traits } },
//   flags: {},                     // misc politics flags
// }
// PARTY = { id, name, short, color, logo|null, emblem|null (player-designed), real: bool,
//   founded: day|null, years: [from, to]|null (real-world existence), leader: npcId|'player',
//   ideology: { econ, social, security } (-2..2), platform: [policy ids], funds, members,
//   factions: [{ id, name, leader, size }], subsidy: n (政党交付金/年), isPlayers: bool }
// BILL = { id, title, policy: policy id, params: {}, sponsor: 'cabinet'|'member', by: 'player'|npcId,
//   stage: 'draft'|'committee'|'shugi'|'sangi'|'enacted'|'rejected'|'shelved', house, votes, created: day }
// ELECTION = { id, kind: 'shugi'|'sangi'|'chiji'|'shicho'|'kugi'|'togi'|'hosen'|'sosaisen' , day, district?, seats?, declared?: candidates }
//
// ---------------------------------------------------------------- registries (exports)
// OFFICES      { [id]: { name, house?, ageMin, deposit (供託金, yen), termYears, salary (per month), level: 'local'|'national'|'exec' } }
// POLICY_AREAS { [id]: { name, desc } }  (経済・財政・税・社会保障・子育て・教育・外交安保・憲法・エネルギー・環境・
//                                       農業・地方・行政改革・治安・デジタル・労働・災害 …)
// POLICIES     { [id]: { area, name, desc, params?: [{ key, name, min, max, step, unit }], cost, effects: (params, era) => ({ segments: { [seg]: delta }, economy: {...} }), eras?: [...] } }
// SEGMENTS     { [id]: { name, weight } }  (若者・子育て世帯・高齢者・会社員・自営業・企業経営者・農林漁業・労働組合・
//                                       都市住民・地方住民・無党派 …)
// POSTS        { [id]: { name, kind: 'party'|'cabinet'|'diet', eras? } }  (総理・官房長官・各大臣 by era; 幹事長・政調会長・総務会長・
//                                       選対委員長・国対委員長・総裁/代表; 議長・委員長)
//
// ---------------------------------------------------------------- g.* API (installPolitics(Game.prototype))
// pol()                          -> g.state.politics (created on demand; newPoliticsState(g))
// eligible(officeId)             -> null | reason string (age, record 公民権停止, money for 供託金…)
// joinParty(partyId) / leaveParty()
// foundParty({ name, short, color, emblem, ideology, platform }) -> party id (costs; 政党要件 checked separately)
// partyStatus(partyId)           -> { official: bool (政党要件), members, seats, subsidy }
// declareCandidacy(electionId, { district, party, proportional }) -> null | reason (pays 供託金)
// campaign(action, opts)         -> effect report; actions: '街頭演説','ポスター','選挙カー','討論会','SNS','握手','後援会','ネット広告','献金集め'
//                                   (legal ones; '買収'/'戸別訪問' are illegal: route through crime.js commitCrime('vote_buying' …))
// runElection(electionId)        -> RESULT { winners, seats by party, myResult: { won, votes, rank, depositLost } }
// proposeBill({ policy, params, title }) -> bill id (as 議員立法, or 閣法 if in cabinet)
// advanceBills()                 -> process committee/plenary votes (called by the politics tick)
// vote(billId, yes|no|abstain)   -> the player's vote as a member (party discipline matters)
// noConfidence(), dissolve(), electPM(), formCabinet(choices), reshuffle()
// approval()                     -> cabinet approval %, partySupport(partyId) -> %
// politicsTick(g)                -> called every morning (registered with onMorning): sessions, bills, polls, economy,
//                                   elections due, salaries (歳費), 政党交付金, scandal exposure (secret funds)
// addSecretFunds(n, source) / reportFunds()  (裏金 vs proper 収支報告)
// onPolitics(event, fn)          -> hooks: 'elected','lost','enacted','cabinet','scandal','dissolve','resign'
//
// The UI (politics_ui.js) and places (国会・官邸・党本部・選管) call only these.
//
// ================================================================ IMPLEMENTATION
// (politics-core pass). Everything above is the contract; below it is implemented, with
// extensions (marked "ext") that never rename a contract name. The full g.* list with
// signatures is in the "g.* API" block near the end of this file.
//
// Facts used (checked with web searches in 2026-10; numbers marked 目安 are approximations
// for the game, not checked against an official table):
// - 衆議院 定数: 512 (1986・1990) → 511 (1993) → 500 (1996: 小選挙区300+比例200) → 480 (2000:
//   300+180) → 475 (2014: 295+180) → 465 (2017-: 289+176). 中選挙区制は1993年まで; 1994年の
//   政治改革関連法で小選挙区比例代表並立制（初の選挙は1996年）。比例11ブロック・ドント式
//   (2017-: 北海道8 東北13 北関東19 南関東22 東京17 北陸信越11 東海21 近畿28 中国11 四国6 九州20;
//   2022年改正（アダムズ方式、2022年12月28日施行の後に初めて公示される総選挙 = 2024年から）: 東北12 南関東23
//   東京19 北陸信越10 中国10、ほかは同じ・計176)。重複立候補者が小選挙区で供託金没収点（有効投票の1/10）に
//   届かないと比例で復活できない決まりは2000年改正から（1996年の総選挙では没収点未満の復活当選があった）。
//   sources: shugiin.go.jp 統計・imidas・総務省資料（衆議院の定数の推移、衆議院比例代表選出議員の定数削減について）,
//   杉並区「比例代表選出選挙の投票と当選人の決定」, shugiin.go.jp 第221回国会 法律第28号の要綱, go2senkyo.com (2021/10/16)
// - 参議院 定数: 252 (1970-) → 247 (2001) → 242 (2004-) → 245 (2019) → 248 (2022-: 選挙区148+比例100)。
//   改選: 126 (-1998) / 121 (2001-2016) / 124 (2019-)。比例: 1983年に拘束名簿式、2001年から非拘束名簿式。
//   東京都選挙区の定数: 8 → 10（2006年改正、2007年の選挙から改選5）→ 12（2015年改正、2016年から改選6）。
//   sources: sangiin.go.jp 参議院議員選挙制度の変遷, go2senkyo.com 2022年参院選の解説, seijiyama.jp,
//   pref.kagoshima.jp 2015年改正の資料, city.setagaya.lg.jp（東京都選挙区12人）
// - 被選挙権: 衆院・都道府県議・市区町村長・市区町村議 25歳、参院・知事 30歳。選挙権は2016年から18歳
//   (それまで20歳)。sources: soumu.go.jp なるほど！選挙, pref.tottori.lg.jp, go2senkyo.com
// - 供託金（現行）: 衆院小選挙区300万円・比例600万円（重複は選挙区分300万円）、参院選挙区300万円・
//   比例600万円、知事300万円、指定都市長240万円、市区長100万円、町村長50万円、都道府県議60万円、
//   指定都市議50万円、市区議30万円、町村議15万円（2020年12月から）。衆院の供託金は1975年100万円→
//   1982年200万円→1992年300万円。没収点: 衆院小選挙区・知事・市区町村長 = 有効投票総数の1/10、
//   参院選挙区 = 有効投票総数÷定数の1/8、地方議員 = 有効投票総数÷定数の1/10。
//   sources: seijiyama.jp「選挙への立候補に必要な供託金」, soumu.go.jp（令和2年改正の概要）, 日弁連意見書(2022)
//   (1992年より前の地方選挙の供託金・中選挙区の没収点(÷定数の1/5)は 目安)
// - 選挙運動期間: 衆院12日、参院・知事17日、指定都市長14日、都道府県議・指定都市議9日、市区長・
//   市区議7日、町村5日。source: seijiyama.jp「選挙によって異なる選挙期間」, 横浜市選挙管理委員会
// - ネット選挙運動の解禁: 2013年（最初の国政選挙は2013年7月の参院選）。候補者の有料ネット広告は不可。
//   source: sbbit.jp / seijiyama.jp「ネット選挙元年2013」
// - 公選法90条: 公職にある者が他の公職の選挙に立候補すると、届出の日に辞職したものとみなされる。
//   source: seijiyama.jp「議員が首長選に立候補、議員の職はどうなる？」
// - 補欠選挙: 年2回（4月・10月の第4日曜）に統一。任期満了の6か月前以降の欠員では行わない。
//   source: soumu.go.jp, ja.wikid.org 補欠選挙
// - 政党要件: 国会議員5人以上、または国会議員1人以上かつ直近の衆院選か参院選（交付金は前々回の参院選も）
//   で得票率2%以上。政党交付金: 250円×直近の国勢調査人口（令和2年国勢調査 126,146,099人 → 約315億円。
//   2024年分の総額は315億3652万円）、議員数割と得票数割で半分ずつ、4月・7月・10月・12月に交付。
//   政党助成法は1994年成立・1995年施行。
//   sources: soumu.go.jp 政党助成制度（なるほど!政治資金）, nippon.com「政党交付金:2024年は総額315億円余り」,
//   sakigake.jp（社民の政党要件）, kotobank 政党助成法
// - 歳費: 月額129万4000円（議長217万円・副議長158万4000円）、期末手当は年 約600万円台。
//   文書通信交通滞在費（月100万円）は2022年に「調査研究広報滞在費」へ改称・日割り化。立法事務費は会派に
//   議員1人あたり月65万円。sources: hourei.net 歳費法, gentosha-go.com, imidas（それ以前の時代の額は 目安:
//   内部の金額は令和と同じにして、時代の物価で表示している）
// - 国会: 通常国会は毎年1月召集・会期150日（延長1回）、特別国会は総選挙の日から30日以内（憲法54条）。
//   法律案は衆院で出席議員の2/3で再可決（憲法59条2項）、参院が60日以内に議決しないと否決とみなせる
//   （59条4項）。予算は参院が30日以内に議決しないと衆院の議決が国会の議決（60条）。首班指名は10日
//   （67条）。不信任可決なら10日以内に解散か総辞職（69条）。憲法改正は各院の総議員の2/3で発議・国民投票の
//   過半数（96条、国民投票法は2007年成立・2010年施行）。議員立法の賛成者: 衆院20人（予算を伴うもの50人）、
//   参院10人（同20人）（国会法56条）。憲法改正原案は衆院100人・参院50人（国会法68条の2）。内閣不信任
//   決議案の提出は衆議院議員50人以上の賛成（go2senkyo.com の解説）。可決は出席議員の過半数。
//   内閣総理大臣は国会議員の中から指名（67条）。
//   sources: kantei.go.jp 国会の仕組み, sangiin.go.jp キッズ, ja.wikibooks 日本国憲法第59条, law-lib.jp,
//   go2senkyo.com「内閣不信任決議案とは」(2021/06/15)
// - 被選挙権の年齢は選挙の期日（投票日）で数える（公選法10条2項）。被選挙権の有無は開票のときに判断する
//   （最高裁の判例: courts.go.jp）。禁錮以上の刑の執行を終わるまでの者には選挙権・被選挙権がない（11条）
//   ので、服役中の候補者の票は無効になり、供託金は没収点に届かず没収される。公職にある者がほかの選挙に
//   立候補すると届出の日に辞職したものとみなされる（90条; 港区選挙管理委員会の案内）。非改選の参院議員の
//   議席も「いまの公職」なので、参院選に立候補すると同じ扱いにする（解釈・目安）。
//   sources: city.minato.tokyo.jp 立候補するには, courts.go.jp 判例 (089476)
// - 比例代表選出議員: 欠員は名簿の次点が繰上補充（補欠選挙なし）。選挙のときに名簿を届け出ていた別の
//   政党に移ると退職者となる。無所属になる・新党をつくるのは可、合併後の党も可（国会法109条の2）。
//   sources: shugiin.go.jp 国会法改正案本文 (g14705013), hakuoh.repo.nii.ac.jp 野畑「国会法の政党間移動制限規定」
// - 総理大臣の俸給 月201万6000円・国務大臣 約147万円（2023年改正、地域手当は別）。国会議員の大臣は歳費と
//   の差額を受け取る形なので、内部の上乗せは 目安。source: cas.go.jp 主な特別職の職員の給与, financial-field.com
// - 第105代の首班指名は2026年2月18日の特別国会（第104代は2025年10月）。第88代は2003年11月、第73代は
//   1986年7月、第82代は1996年1月11日（自民党が首相を出す自社さ連立。その前の第81代は1994年6月30日からで、
//   首相は自民党ではなかった。1996年4月はじまりの時代は、この第82代の任期中）。いずれも代数だけを使う。
//   sources: sakigake.jp 2026-02-18（特別国会の召集と首班指名）, kantei.go.jp 歴代内閣
// - 2026年の参院は少数与党（2025年参院選後、首班指名の参院決選投票は125票）。sources: sakigake.jp, news.cn
// - 自民党総裁選の推薦人は党所属国会議員20人（2024年の総裁選など）。以前は30人（1995年の総裁選）で、
//   引き下げの年は 目安 で2002年とした。総裁の多選制限: 1980年に連続3選を禁止、2001年の改正で任期3年・
//   2期まで、2017年から3期9年まで。sources: imidas C-103-0026, nippon.com, newsweekjapan.jp, pictet.co.jp
// - 内閣: 2001年1月6日に1府22省庁→1府12省庁（大蔵省→財務省、通商産業省→経済産業省、環境庁→環境省など）。
//   防衛庁→防衛省 2007年、復興庁 2012年、デジタル庁 2021年。それ以前の国務大臣（経済企画庁・科学技術庁・
//   環境庁・国土庁・北海道開発庁・沖縄開発庁・総務庁（1984年7月から。それまで行政管理庁）・防衛庁の長官）。
//   sources: internet.watch.impress.co.jp (2001/01/06), kantei.go.jp 歴代内閣（1980年代の閣僚名簿）
// - 自民党: 1955年11月15日、自由党と日本民主党の保守合同で結党。総裁の任期は2001年の改正で3年（それまで
//   2年）・連続2期まで、2017年から3期まで（ゲームでは2002年から3年とする）。
//   sources: jimin.jp 党のあゆみ, kotobank 自由民主党, nippon.com, imidas
// - 民主党: 1998年4月27日結成（1996年結成の民主党と法規上は同一）、2009年の総選挙で政権交代、2012年に下野、
//   2016年3月27日に他党との合流で党名を改めた（ゲームでは合流後の党は登場させず、所属議員は無所属やほかの
//   党に分かれる）。source: ja.wikid.org 民主党 (日本 1998-2016), go2senkyo.com
// - 時代の議席の目安: 1986年衆院選 自民300（512）、1996年の解散前 自民211（511、1993年の選挙では223）、
//   2003年 自民237・民主177（480）、2026年2月 自民316（465）、2025年参院選後の参院 自民は100前後（248）。
//   sources: tinpanblog/toyokeizai（1986年同日選）, cambridge.org（1996年の解散前の勢力）, imidas（1993年）,
//   shugiin.go.jp（2003年）, kumanichi.com（2026年衆院選）, nippon.com（2025年参院選）。シミュレーションの
//   初期値で、その後は遊び方しだい。
// - 消費税: 1989年4月3%、1997年4月5%（1994年11月の税制改革関連法で決定）、2014年8%、2019年10月10%（軽減
//   税率8%）。source: nippon.com, zeiken.co.jp
// - 第41回総選挙（初の小選挙区比例代表並立制、定数500）は1996年10月20日。source: pref.shimane.lg.jp 選挙の記録
// - 平成8年度（1996年度）一般会計 約75兆円（当初）。経済の数字は 目安。
// - 2026年度予算 122兆3092億円、税収83兆7350億円、新規国債29兆5840億円。source: sakigake.jp, hokkaido-np.co.jp
// - 統一地方選挙は1947年から4年ごと（2023年が第20回）。source: imidas, soumu.go.jp
// - 公民権停止（公選法252条）: 罰金刑で5年、禁錮以上は刑の執行を終えてから5年など。連座制あり。
//   source: kotobank 選挙犯罪, soumu.go.jp なるほど！選挙（判定と手続きは crime.js が担当）
// - 政治資金規正法 2024年改正: パーティー券の公開基準を20万円超→5万円超（2027年から）、連座制の導入など。
//   source: hokkaido-np.co.jp, nri.com, soumu.go.jp（改正政治資金規正法等の概要）。パーティー券の購入者の
//   公開（20万円超）は1992年の改正（1993年施行）から。それより前の時代には公開の決まりを言わない。
// Fictional: every politician NPC, ドット区, the parties ともしび党・青空党・日輪党・にじいろ党・田園党,
// all scandals and all events. 自由民主党 / 民主党 appear only with the facts above; NPCs of
// those two parties never get a scandal (they only step down for neutral reasons).
//
// Game model in short:
// - Calendar: 120 game days a year, 10 a month (1 game day ≈ 3 real days); eras start in April of 1987 /
//   1996 / 2004 / 2026. Real campaign periods are divided by 3 (衆院 12日 → 4 game days).
// - Where the player can run: ドット区議会 (定数40) / ドット区長 / 東京都議会 (ドット区選挙区, 定数3) /
//   東京都知事, 衆院 (東京ドット区 or the hometown: 小選挙区・中選挙区・比例), 参院 (東京都選挙区, the
//   hometown 選挙区 or 全国比例), any 補欠選挙, and the party leadership race. ドット区 votes off the
//   統一地方選挙 cycle (as many real 特別区 do), so a race comes up within the first two years.
// - Votes: segments (weights by year) → party support (opinion) → district shares with turnout;
//   candidates add a personal vote by quality Q (fame and fans = 名前の知られ方, 地盤, campaign,
//   reputation, incumbency, talk skill, hometown). National seats: 小選挙区 by blocs (share^1.8),
//   比例 by d'Hondt per block, 中選挙区 near-proportional; the player's own district is simulated.
// - The Diet: sessions by the calendar, the cabinet's agenda by period (AGENDA), member bills, 党議拘束
//   and defections, つるし (bills held in committee), 再可決, みなし否決, 予算の自然成立, 不信任, 解散,
//   憲法改正 → 国民投票. Laws change segments' support, the economy (over `lasting` years) and the budget.
// - Money: internal amounts are game money; legal fixed amounts of other eras (供託金) are converted so
//   that they show as that era's yen; 歳費 etc. use today's amounts shown at the era's price level.

import { clamp, fmtMoney, YEN_MARK } from './util.js';
import { COLORS } from './draw.js';
import { onMorning, registerPhoneApp, weekdayOf, weekOf, REGULARS } from './life.js';
import { ERAS, PREFECTURES, ageOf, YEAR_DAYS } from './profile.js';
// R5-D: 党内の権力争い・内部紛争・外交スタンス・公約・立法のスタジオ (the engine lives in these files; see the 「R5-D」 block before installPolitics)
import { installIntra } from './politics_intra.js';
import { installConflict } from './politics_conflict.js';
import { installPledge } from './politics_pledge.js';
import { installLaw } from './politics_law.js';
// [R11-P] 政治家AI: every NPC politician is an agent (traits, tastes, goals, memory, relationships) that decides and learns (politics_ai*.js)
import { installAI } from './politics_ai.js';
import { REAL, REAL_ORDER, REAL_CABINET, DPJ_CHAIN, realAge, realWins } from './politics_real.js'; // [R14-P] 実在の党首

export const POLITICS_CONTRACT_VERSION = 1;
export const POL_STATE_VERSION = 1;

// ================================================================ calendar
// One political year = YEAR_DAYS (120) game days = 12 months of 10 days (1 game day ≈ 3
// real days). Each era starts in April of its year (上京の春). pol.cal keeps the start so a
// save never moves in time. Elections are on Sundays (weekday 6), like in Japan.
export const MONTH_DAYS = YEAR_DAYS / 12; // 10
const INF = 1e9;

// What each era starts with. Seats are approximations of the real standing at that time
// (自民・民主) and fictional parties for the rest; label: シミュレーション. The fictional parties'
// seat numbers are the simulation's own (review: they no longer copy any real party's result, and
// the coalition partner is not drawn after a real one).
// inForce: laws (policy ids) already in force when the era starts, with the year they were
// passed, so a game does not "pass" them again (PKO協力法 1992, ふるさと納税 2008 ...).
// sources: kantei.go.jp / 各省の資料 (PKO協力法 1992年6月, 地方税法改正 ふるさと納税 2008年4月,
// 軽減税率 2016年3月成立・2019年10月実施, 幼保無償化 2019年5月成立, 改正健康増進法 2018年7月,
// 減反（生産数量目標の配分）廃止 2018年産から, 平和安全法制 2015年9月, テロ等準備罪 2017年6月,
// IR整備法 2018年7月, 働き方改革関連法 2018年6月（残業の上限規制・同一労働同一賃金）,
// 給付型奨学金 2017年3月, ガソリン税の暫定税率廃止法 2025年11月成立・12月31日廃止,
// TPP11 2018年発効・RCEP 2022年発効, 再エネ特措法（固定価格買取）2011年8月成立, 地球温暖化対策のための税
// （炭素税にあたる）2012年3月成立・10月施行)
export const ERA_POLITICS = {
  showa: {
    start: 1987, month: 4,
    shugiLast: [1986, 7], // 第38回 (衆参同日選)
    sangiClasses: [[1983, 7], [1986, 7]],
    chijiNext: [1987, 4], togiNext: [1989, 7], kugiNext: [1988, 6], kuchoNext: [1989, 11],
    coalition: ['jimin'],
    inForce: {},
    shugi: { jimin: 300, tomoshibi: 82, aozora: 51, denen: 33, nichirin: 16, nijiiro: 12, ind: 18 },
    sangi: { jimin: 143, tomoshibi: 45, aozora: 25, denen: 15, nichirin: 8, nijiiro: 6, ind: 10 },
    support: { jimin: 0.46, tomoshibi: 0.13, aozora: 0.06, denen: 0.04, nichirin: 0.02, nijiiro: 0.02 },
    kugi: { jimin: 15, tomoshibi: 8, aozora: 5, denen: 4, nichirin: 1, nijiiro: 2, ind: 5 },
    togi: { jimin: 56, tomoshibi: 25, aozora: 15, denen: 20, nichirin: 2, nijiiro: 3, ind: 6 },
    eco: { growth: 4.4, inflation: 0.3, unemployment: 2.8, debtRatio: 70, yen: 145, nikkei: 23000, gdp: 360, taxRate: 0, spending: 54.1, revenue: 46.8 },
  },
  // 1996年4月: the 第82代 PM (from 1996-01-11) leads a coalition headed by the 自由民主党, as it really
  // was. The partner is the fictional 田園党 (as in the other eras), not a stand-in for the real partners
  // of the time. The 衆院 was still the one elected in 1993 (中選挙区, 511); the first 並立制 election
  // (500 seats) is the next one (real: 1996-10-20). 消費税 5% from 1997-04 was already law (1994-11).
  heisei_early: {
    start: 1996, month: 4,
    shugiLast: [1993, 7], // 第40回 (最後の中選挙区制)
    sangiClasses: [[1992, 7], [1995, 7]],
    chijiNext: [1999, 4], togiNext: [1997, 7], kugiNext: [1997, 6], kuchoNext: [1998, 11],
    coalition: ['jimin', 'denen'],
    inForce: { pko: 1992 },
    taxPlan: { rate: 5, year: 1997, month: 4, law: 1994 },
    shugi: { jimin: 211, aozora: 128, tomoshibi: 62, denen: 48, nichirin: 20, nijiiro: 15, ind: 27 },
    sangi: { jimin: 111, tomoshibi: 58, aozora: 42, denen: 17, nichirin: 8, nijiiro: 6, ind: 10 },
    support: { jimin: 0.30, tomoshibi: 0.09, aozora: 0.11, denen: 0.04, nichirin: 0.02, nijiiro: 0.03 },
    kugi: { jimin: 12, tomoshibi: 6, aozora: 8, denen: 4, nichirin: 1, nijiiro: 3, ind: 6 },
    togi: { jimin: 48, tomoshibi: 20, aozora: 25, denen: 20, nichirin: 3, nijiiro: 4, ind: 7 },
    eco: { growth: 2.6, inflation: 0.1, unemployment: 3.4, debtRatio: 100, yen: 107, nikkei: 21500, gdp: 525, taxRate: 3, spending: 75.1, revenue: 52.1 },
  },
  heisei: {
    start: 2004, month: 4,
    shugiLast: [2003, 11], // 第43回 (マニフェスト選挙)
    sangiClasses: [[1998, 7], [2001, 7]],
    chijiNext: [2007, 4], togiNext: [2005, 7], kugiNext: [2005, 6], kuchoNext: [2006, 11],
    coalition: ['jimin', 'denen'],
    inForce: { pko: 1992 },
    shugi: { jimin: 237, minshu: 177, denen: 20, tomoshibi: 15, aozora: 10, nichirin: 5, nijiiro: 7, ind: 9 },
    sangi: { jimin: 115, minshu: 70, denen: 25, tomoshibi: 15, aozora: 8, nichirin: 4, nijiiro: 4, ind: 6 },
    support: { jimin: 0.33, minshu: 0.19, denen: 0.04, tomoshibi: 0.03, aozora: 0.03, nichirin: 0.01, nijiiro: 0.02 },
    kugi: { jimin: 13, minshu: 9, denen: 5, tomoshibi: 3, aozora: 3, nichirin: 1, nijiiro: 2, ind: 4 },
    togi: { jimin: 48, minshu: 35, denen: 23, tomoshibi: 6, aozora: 5, nichirin: 2, nijiiro: 3, ind: 5 },
    eco: { growth: 1.7, inflation: 0.0, unemployment: 4.7, debtRatio: 170, yen: 108, nikkei: 11500, gdp: 505, taxRate: 5, spending: 82.1, revenue: 41.7 },
  },
  reiwa: {
    start: 2026, month: 4,
    shugiLast: [2026, 2], // 第51回 (2026年2月)
    sangiClasses: [[2022, 7], [2025, 7]],
    chijiNext: [2028, 7], togiNext: [2029, 7], kugiNext: [2027, 6], kuchoNext: [2028, 11],
    coalition: ['jimin', 'denen'],
    inForce: { pko: 1992, furusato_tax: 2008, renewables: 2011, security_law: 2015, reduced_rate: 2016, scholarship: 2017, conspiracy_law: 2017, smoking_ban: 2018, gentan_end: 2013, ir_casino: 2018, work_style: 2018, irregular_protect: 2018, fta: 2018, free_childcare: 2019, gasoline_tax: 2025, carbon_tax: 2012 },
    shugi: { jimin: 316, tomoshibi: 58, aozora: 31, nijiiro: 24, nichirin: 12, denen: 9, ind: 15 },
    // 2025年参院選の後、与党は参院で過半数に届かない（少数与党）
    sangi: { jimin: 100, tomoshibi: 47, aozora: 18, nijiiro: 29, nichirin: 19, denen: 17, ind: 18 },
    support: { jimin: 0.36, tomoshibi: 0.07, aozora: 0.07, nijiiro: 0.04, nichirin: 0.05, denen: 0.02 },
    kugi: { jimin: 14, tomoshibi: 5, aozora: 6, nijiiro: 4, nichirin: 3, denen: 2, ind: 6 },
    togi: { jimin: 42, tomoshibi: 18, aozora: 16, nijiiro: 14, nichirin: 8, denen: 17, ind: 12 },
    eco: { growth: 0.8, inflation: 2.6, unemployment: 2.5, debtRatio: 230, yen: 155, nikkei: 60000, gdp: 620, taxRate: 10, spending: 122.3, revenue: 83.7 },
  },
};
export const eraPolitics = (era) => ERA_POLITICS[era] || ERA_POLITICS.reiwa;
// 代 of the PM in office at each era's start (1987-04: 第73代, 1996-04: 第82代, 2004-04: 第88代,
// 2026-04: 第105代). Only the number is used; the game's PMs are fictional. In each of these the
// PM came from the 自由民主党, the party that heads the game's starting coalition.
const PM_NO = { showa: 73, heisei_early: 82, heisei: 88, reiwa: 105 };

// 和暦 (昭和 → 平成 1989-01-08 → 令和 2019-05-01).
export function wareki(year, month = 6) {
  const gen = (name, n) => `${name}${n === 1 ? '元' : n}年`;
  if (year < 1989) return gen('昭和', year - 1925);
  if (year < 2019 || (year === 2019 && month < 5)) return gen('平成', year - 1988);
  return gen('令和', year - 2018);
}

// ================================================================ election law by year
// Seat totals and the system of the NEXT election held in `year` (flags may move the
// reform earlier or cut seats: see the policies electoral_reform / seat_cut).
export function shugiRules(year, flags = {}) {
  const reformYear = Math.min(1995, flags.heiritsuFrom || INF); // 改正法 1994年; 初の選挙は1996年
  const cut = Math.max(0, Math.min(200, Number(flags.seatCut) || 0));
  let r;
  if (year < reformYear) {
    const total = year < 1993 ? 512 : 511;
    r = { system: 'chusenkyoku', total, smd: total, pr: 0, myMagnitude: 4 };
  } else if (year < 2000) r = { system: 'heiritsu', total: 500, smd: 300, pr: 200 };
  else if (year < 2014) r = { system: 'heiritsu', total: 480, smd: 300, pr: 180 };
  else if (year < 2017) r = { system: 'heiritsu', total: 475, smd: 295, pr: 180 };
  else r = { system: 'heiritsu', total: 465, smd: 289, pr: 176 };
  if (cut && r.system === 'heiritsu') {
    const prCut = Math.min(r.pr - 50, Math.round(cut * 0.6));
    r = { ...r, pr: r.pr - prCut, smd: r.smd - (cut - prCut), total: r.total - cut };
  } else if (cut) r = { ...r, total: r.total - cut, smd: r.smd - cut };
  return r;
}
// 参院: one half (class) is elected every 3 years. district / pr = seats of that half.
export function sangiRules(year) {
  if (year < 2001) return { half: 126, district: 76, pr: 50, list: year < 1983 ? 'zenkoku' : 'kousoku' };
  if (year < 2019) return { half: 121, district: 73, pr: 48, list: 'hikousoku' };
  return { half: 124, district: 74, pr: 50, list: 'hikousoku', tokuteiwaku: true };
}
// 比例ブロック (2017-, verified). Older totals are spread over the same blocks (目安).
export const PR_BLOCKS = [
  ['北海道', 8], ['東北', 13], ['北関東', 19], ['南関東', 22], ['東京', 17], ['北陸信越', 11],
  ['東海', 21], ['近畿', 28], ['中国', 11], ['四国', 6], ['九州', 20],
];
// 2022年改正（アダムズ方式・3増3減）: the elections from 2024 on (verified; total 176 as before).
export const PR_BLOCKS_2024 = [
  ['北海道', 8], ['東北', 12], ['北関東', 19], ['南関東', 23], ['東京', 19], ['北陸信越', 10],
  ['東海', 21], ['近畿', 28], ['中国', 10], ['四国', 6], ['九州', 20],
];
// The block table used in the election year (PR_BLOCKS_2024 from 2024, PR_BLOCKS before).
export const prBlockTable = (year = 2017) => (Number(year) >= 2024 ? PR_BLOCKS_2024 : PR_BLOCKS);
// The seats of each block for a 比例 total in that year: [{ name, seats }].
export function prBlocks(total, year = 2017) {
  const table = prBlockTable(year);
  const base = table.reduce((a, b) => a + b[1], 0);
  const raw = table.map(([name, n]) => ({ name, q: (n * total) / base }));
  const out = raw.map((b) => ({ name: b.name, seats: Math.floor(b.q), rem: b.q - Math.floor(b.q) }));
  let left = total - out.reduce((a, b) => a + b.seats, 0);
  out.slice().sort((a, b) => b.rem - a.rem).forEach((b) => { if (left > 0) { b.seats++; left--; } });
  return out.map(({ name, seats }) => ({ name, seats }));
}
// 東京都選挙区 (参院) seats per half: 4 → 5 (2007, 2006年改正) → 6 (2016, 2015年改正).
export const tokyoSangiMagnitude = (year) => (year < 2007 ? 4 : year < 2016 ? 5 : 6);
// Voting age: 18 from 2016 (flag age18 when the policy passed earlier).
export const votingAge = (year, flags = {}) => (year >= 2016 || flags.age18 ? 18 : 20);
// The internet campaign (SNS etc.) is legal from 2013.
export const netCampaignOK = (year) => year >= 2013;
// 政党交付金 exists from 1995.
export const subsidyExists = (year) => year >= 1995;
// Party ticket disclosure threshold (政治資金パーティー, nominal yen): 20万円超 from 1993 (1992年改正),
// 5万円超 from 2027 (2024年改正); null before 1993 (no disclosure rule for party tickets yet).
export const partyTicketDisclosure = (year) => (year < 1993 ? null : year >= 2027 ? 50000 : 200000);

// ================================================================ offices
// deposit / salary are the reiwa nominal yen (salary per month). Use depositFor(office, year)
// for the deposit of a given year and g.depositInternal for the amount charged in game money.
export const OFFICES = {
  kugi: { name: '区議会議員', label: 'ドット区議会議員', short: '区議', ageMin: 25, deposit: 300000, termYears: 4, salary: 620000, level: 'local', seats: 40, campaignDays: 7, allowance: 150000, allowanceName: '政務活動費' },
  togi: { name: '都道府県議会議員', label: '東京都議会議員', short: '都議', ageMin: 25, deposit: 600000, termYears: 4, salary: 1020000, level: 'local', seats: 3, campaignDays: 9, allowance: 500000, allowanceName: '政務活動費' },
  shicho: { name: '市区町村長', label: 'ドット区長', short: '区長', ageMin: 25, deposit: 1000000, termYears: 4, salary: 1100000, level: 'exec', seats: 1, campaignDays: 7, allowance: 0 },
  chiji: { name: '知事', label: '東京都知事', short: '知事', ageMin: 30, deposit: 3000000, termYears: 4, salary: 1450000, level: 'exec', seats: 1, campaignDays: 17, allowance: 0 },
  shugi: { name: '衆議院議員', label: '衆議院議員', short: '衆院議員', house: 'shugi', ageMin: 25, deposit: 3000000, depositPR: 6000000, termYears: 4, salary: 1294000, level: 'national', campaignDays: 12, allowance: 1000000 },
  sangi: { name: '参議院議員', label: '参議院議員', short: '参院議員', house: 'sangi', ageMin: 30, deposit: 3000000, depositPR: 6000000, termYears: 6, salary: 1294000, level: 'national', campaignDays: 17, allowance: 1000000 },
};
// 文通費 → 調査研究広報滞在費 (2022). Before 1993 the amount is a 目安 (same internal amount).
export const allowanceName = (year) => (year >= 2022 ? '調査研究広報滞在費' : year >= 1993 ? '文書通信交通滞在費' : '文書通信交通費');
export const BONUS_MONTHS = { national: 2.4, local: 2.2, exec: 2.2 }; // 期末手当 per payment (6月・12月), 目安
export const LEGISLATIVE_FEE = 650000; // 立法事務費: per member per month, paid to the 会派 (party)
// 事務所・政治活動の経費/月 (目安: 地元と東京の事務所、車、印刷・会合など。私設秘書は STAFF_COST で別).
// review: a Diet member's 政治団体 spends tens of millions a year, more than the 文通費 brings in,
// so political money has to be raised (寄付・パーティー) — or tempts the dark side.
export const OFFICE_COST = { national: 1600000, local: 200000, exec: 100000 };
export const STAFF_COST = 250000; // 私設秘書 1人/月 (公設秘書3人は国費)

// The deposit in that year's yen (nominal). opts: { pr, district } (pr: 比例, 600万円).
export function depositFor(office, year, opts = {}) {
  const O = OFFICES[office];
  if (!O) return 0;
  const old = year < 1992; // 1982-1991: 衆参200万円 (比例400万円は 目安)、地方は 目安 で2/3
  if (office === 'shugi' || office === 'sangi') {
    if (opts.pr) return old ? 4000000 : 6000000;
    return old ? 2000000 : 3000000;
  }
  return old ? Math.round((O.deposit * 2) / 3 / 10000) * 10000 : O.deposit;
}
// Deposit forfeiture threshold as a share of the valid votes (M = seats in the race).
export function forfeitShare(kind, M = 1, system = 'heiritsu') {
  if (kind === 'shugi' && system === 'chusenkyoku') return 1 / M / 5; // 目安
  if (kind === 'shugi' || kind === 'chiji' || kind === 'shicho' || kind === 'hosen') return M > 1 ? 1 / M / 8 : 1 / 10;
  if (kind === 'sangi') return 1 / M / 8;
  return 1 / M / 10; // kugi / togi
}

// ================================================================ voters
// weight: share of voters (reiwa); weights(year) follows the ageing society. turnout: relative
// propensity to vote. ideo: the segment's own leaning (econ: + = market / small government,
// social: + = traditional, security: + = hawkish), used for the player's party and new laws.
export const SEGMENTS = {
  young: { name: '若者', weight: 0.10, turnout: 0.45, ideo: { econ: 0.3, social: -1.0, security: 0 }, urban: 1.4, rural: 0.8 },
  families: { name: '子育て世帯', weight: 0.11, turnout: 0.65, ideo: { econ: -0.4, social: 0, security: -0.2 }, urban: 1.1, rural: 1.0 },
  elderly: { name: '高齢者', weight: 0.28, turnout: 0.85, ideo: { econ: -0.6, social: 0.9, security: 0.4 }, urban: 0.85, rural: 1.25 },
  employees: { name: '会社員', weight: 0.17, turnout: 0.62, ideo: { econ: 0.2, social: 0, security: 0.2 }, urban: 1.3, rural: 0.8 },
  selfemployed: { name: '自営業', weight: 0.05, turnout: 0.75, ideo: { econ: 0.6, social: 0.6, security: 0.4 }, urban: 1.0, rural: 1.1 },
  business: { name: '企業経営者', weight: 0.03, turnout: 0.85, ideo: { econ: 1.5, social: 0.5, security: 0.8 }, urban: 1.3, rural: 0.8 },
  farmers: { name: '農林漁業', weight: 0.02, turnout: 0.85, ideo: { econ: -0.6, social: 1.2, security: 0.4 }, urban: 0.1, rural: 3.0 },
  unions: { name: '労働組合', weight: 0.05, turnout: 0.8, ideo: { econ: -1.5, social: -0.5, security: -1.0 }, urban: 1.1, rural: 0.9 },
  urban: { name: '都市住民', weight: 0.08, turnout: 0.6, ideo: { econ: 0.5, social: -0.8, security: 0 }, urban: 2.5, rural: 0.2 },
  rural: { name: '地方住民', weight: 0.05, turnout: 0.8, ideo: { econ: -0.6, social: 0.8, security: 0.3 }, urban: 0.1, rural: 2.5 },
  floating: { name: '無党派層', weight: 0.06, turnout: 0.45, ideo: { econ: 0.2, social: -0.4, security: 0 }, urban: 1.5, rural: 0.9 },
};
export const SEGMENT_ORDER = Object.keys(SEGMENTS);
const SEG_WEIGHTS = { // showa / heisei_early / heisei / reiwa (each sums to 1)
  young: [0.15, 0.14, 0.11, 0.10], families: [0.16, 0.14, 0.13, 0.11], elderly: [0.12, 0.15, 0.20, 0.28],
  employees: [0.17, 0.18, 0.18, 0.17], selfemployed: [0.08, 0.07, 0.06, 0.05], business: [0.03, 0.03, 0.03, 0.03],
  farmers: [0.07, 0.05, 0.04, 0.02], unions: [0.08, 0.07, 0.06, 0.05], urban: [0.06, 0.07, 0.08, 0.08],
  rural: [0.05, 0.05, 0.05, 0.05], floating: [0.03, 0.05, 0.06, 0.06],
};
export function segWeights(year) {
  const pts = [1987, 1995, 2004, 2026];
  const out = {};
  for (const s of SEGMENT_ORDER) {
    const w = SEG_WEIGHTS[s];
    let v = w[w.length - 1];
    if (year <= pts[0]) v = w[0];
    else for (let i = 0; i < pts.length - 1; i++) if (year >= pts[i] && year < pts[i + 1]) v = w[i] + ((w[i + 1] - w[i]) * (year - pts[i])) / (pts[i + 1] - pts[i]);
    out[s] = v;
  }
  const sum = SEGMENT_ORDER.reduce((a, s) => a + out[s], 0);
  for (const s of SEGMENT_ORDER) out[s] /= sum;
  return out;
}
// Organised support (団体の支持) on top of ideology: 農協・業界団体・労組・高齢者 etc.
const SEG_BONUS = {
  farmers: { jimin: 0.9, denen: 1.0 }, rural: { jimin: 0.6, denen: 0.6 }, elderly: { jimin: 0.5 },
  business: { jimin: 0.6, aozora: 0.4 }, selfemployed: { jimin: 0.4 }, unions: { tomoshibi: 1.0, minshu: 0.9 },
  urban: { aozora: 0.5, nijiiro: 0.4, minshu: 0.3 }, young: { aozora: 0.3, nijiiro: 0.3 }, families: { minshu: 0.2, nijiiro: 0.1 },
};
// Share of each segment that supports no party (支持なし), before turnout.
const SEG_NONE = { young: 0.55, families: 0.42, elderly: 0.22, employees: 0.42, selfemployed: 0.3, business: 0.2, farmers: 0.15, unions: 0.25, urban: 0.5, rural: 0.28, floating: 0.85 };

// ================================================================ policy areas
export const POLICY_AREAS = {
  economy: { name: '経済・成長', desc: '景気、規制、産業、民営化' },
  finance: { name: '財政', desc: '国の予算、国債、財政健全化' },
  tax: { name: '税制', desc: '消費税、所得税、法人税など' },
  welfare: { name: '社会保障', desc: '年金、介護、福祉' },
  health: { name: '医療', desc: '医療保険、医療費、病院' },
  childcare: { name: '子育て・少子化', desc: '児童手当、保育、出産の支援' },
  education: { name: '教育・科学', desc: '学校、大学、奨学金、研究' },
  labor: { name: '労働・雇用', desc: '賃金、働き方、非正規雇用' },
  diplomacy: { name: '外交・安全保障', desc: '防衛、国際協力、通商' },
  constitution: { name: '憲法', desc: '憲法改正と国民投票' },
  energy: { name: 'エネルギー', desc: '原子力、再生可能エネルギー、電気代' },
  environment: { name: '環境', desc: '公害、気候変動、自然保護' },
  agriculture: { name: '農林水産', desc: 'コメ、農家、漁業、林業' },
  regional: { name: '地方・国土', desc: '地方自治、交付税、公共事業、交通' },
  admin: { name: '行政改革・政治改革', desc: '省庁、公務員、選挙制度、政治とカネ' },
  safety: { name: '治安・司法', desc: '警察、裁判、暴力団対策' },
  digital: { name: 'デジタル', desc: '行政のオンライン化、マイナンバー' },
  disaster: { name: '防災・復興', desc: '災害への備え、被災地の復興' },
  culture: { name: '文化・観光', desc: '芸術、エンタメ、観光' },
  society: { name: '家族・人権', desc: '夫婦別姓、同性婚、外国人' },
};
export const AREA_ORDER = Object.keys(POLICY_AREAS);

// ================================================================ policies
// POLICIES[id] = { area, name, desc, params?, cost (兆円/年 at default params; + = deficit up),
//   effects(params, era, ctx) -> { segments: { seg: -10..10 }, economy: { growth, inflation,
//   unemployment, yen, nikkei } }, eras? / years? [from, to], ideo (lean), ministry (閣法 post),
//   kind?: 'law' | 'amendment', lasting (years the economic effect lasts) }
// ext: costOf(params, ctx), check(pol, params) -> reason|null, apply(pol, params, g) (state change).
// Trade-offs are on purpose: every policy pleases some segments and costs others.
export const POLICIES = {};
// The game year that era-dependent names follow (set by ensurePol once per game day; reiwa until a game is loaded).
const NAMES_AT = { st: null, day: null, pol: null, fy: 2026 };
const sc = (o, k) => { const r = {}; for (const [s, v] of Object.entries(o || {})) r[s] = Math.round(v * k * 10) / 10; return r; };
// ext (review): a law that adds to the deficit (cost > 0, 兆円/年) is paid for by the future
// (将来世代へのつけ). Segments that weigh that cost lose a little support per 兆円 (capped), so a
// popular spending bill is never a free lunch. Policies may opt out with noFiscal.
export const FISCAL_BURDEN = { young: 0.15, floating: 0.1, business: 0.06 };
function policy(id, area, name, desc, d = {}) {
  // ext: billKind ('budget' for a 補正予算; default = kind) and title(params) (the bill's own title)
  const def = { id, area, name, desc, kind: 'law', lasting: 3, ideo: {}, ...d };
  def.params = d.params || null;
  const defaults = {};
  for (const p of def.params || []) defaults[p.key] = p.def ?? p.min;
  def.defaults = defaults;
  const costOf = d.costOf || (() => d.cost || 0);
  def.costOf = (params = defaults, ctx = {}) => { const v = Number(costOf({ ...defaults, ...(params || {}) }, ctx)); return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0; };
  def.cost = def.costOf(defaults, {});
  def.effects = (params = defaults, era = 'reiwa', ctx = {}) => {
    const p = { ...defaults, ...(params || {}) };
    const k = d.scale ? d.scale(p, ctx) : 1;
    const segments = d.segFn ? d.segFn(p, ctx) : sc(d.seg, k);
    const economy = d.ecoFn ? d.ecoFn(p, ctx) : sc(d.eco, k);
    const c = def.costOf(p, ctx);
    if (c > 0 && !d.noFiscal) {
      const f = Math.min(25, c);
      for (const [s, w] of Object.entries(FISCAL_BURDEN)) segments[s] = Math.round(((segments[s] || 0) - w * f) * 10) / 10;
    }
    return { segments, economy };
  };
  POLICIES[id] = def;
  return def;
}
const yr = (from, to = INF) => [from, to];
// --- 税制
policy('shohizei_intro', 'tax', '消費税の導入', '物品税などを整理し、ものやサービスに広く薄くかかる新しい間接税をつくる。', {
  params: [{ key: 'rate', name: '税率', min: 1, max: 5, step: 1, unit: '%', def: 3 }], ideo: { econ: 0.6 }, ministry: 'minister_finance',
  check: (pol) => (pol.economy.taxRate > 0 ? 'すでに消費税がある' : null),
  costOf: (p, c) => -2.4 * p.rate * (c.gdp || 360) / 500, scale: (p) => p.rate / 3,
  seg: { young: -1, families: -3, elderly: -2, employees: -1, selfemployed: -4, business: 2, unions: -2, urban: -1, rural: -1, floating: -3 },
  eco: { growth: -0.2, inflation: 1.0, nikkei: -1 }, lasting: 1,
  apply: (pol, p) => { pol.economy.taxRate = p.rate; },
});
policy('shohizei_up', 'tax', '消費税率の引き上げ', '社会保障の財源にするため、消費税の税率を上げる。', {
  params: [{ key: 'rate', name: '新しい税率', min: 2, max: 25, step: 1, unit: '%', def: 10 }], ideo: { econ: 0.3 }, ministry: 'minister_finance',
  check: (pol, p) => {
    if (pol.economy.taxRate <= 0) return 'まだ消費税がない';
    if (p && p.rate <= pol.economy.taxRate) return `いまの税率（${pol.economy.taxRate}%）より高くする必要がある`;
    const T = pol.flags && pol.flags.taxPlan;
    if (p && T && !T.done && p.rate <= T.rate) return `すでに決まっている（${T.law}年の法律で、${T.year}年${T.month}月から${T.rate}%）`;
    return null;
  },
  costOf: (p, c) => -2.6 * Math.max(0, p.rate - (c.taxRate ?? 8)) * (c.gdp || 600) / 600,
  scale: (p, c) => Math.max(0.5, (p.rate - (c.taxRate ?? 8)) / 2),
  seg: { young: -2, families: -4, elderly: 0, employees: -2, selfemployed: -3, business: -1, unions: -2, urban: -1, rural: -1, floating: -3 },
  eco: { growth: -0.35, inflation: 0.9 }, lasting: 1,
  apply: (pol, p) => { pol.economy.taxRate = p.rate; },
});
policy('shohizei_down', 'tax', '消費税率の引き下げ', '暮らしを支えるため、消費税の税率を下げる。財源は国債などでまかなう。', {
  params: [{ key: 'rate', name: '新しい税率', min: 0, max: 24, step: 1, unit: '%', def: 5 }], ideo: { econ: -0.4 }, ministry: 'minister_finance',
  check: (pol, p) => (pol.economy.taxRate <= 0 ? 'まだ消費税がない' : p && p.rate >= pol.economy.taxRate ? `いまの税率（${pol.economy.taxRate}%）より低くする必要がある` : null),
  costOf: (p, c) => 2.6 * Math.max(0, (c.taxRate ?? 10) - p.rate) * (c.gdp || 600) / 600,
  scale: (p, c) => Math.max(0.5, ((c.taxRate ?? 10) - p.rate) / 3),
  // trade-off: 消費税 is the main source for 社会保障 (年金・医療・介護), so those who rely on it worry
  seg: { young: 3, families: 4, elderly: -2, employees: 2, selfemployed: 3, business: 1, unions: 2, floating: 3, urban: 1, rural: 1 },
  eco: { growth: 0.3, inflation: -0.5, yen: 2 }, lasting: 2,
  apply: (pol, p) => { pol.economy.taxRate = p.rate; },
});
policy('reduced_rate', 'tax', '軽減税率の導入', '食料品などの消費税率を低いままにする。', {
  years: yr(2000), ideo: { econ: -0.2 }, ministry: 'minister_finance', cost: 1.0,
  check: (pol) => (pol.economy.taxRate < 8 ? '消費税率が8%以上のときの政策' : pol.flags.reducedRate ? 'すでに導入ずみ' : null),
  seg: { families: 3, elderly: 2, young: 1, selfemployed: -2, business: -1, floating: 1 }, eco: { inflation: -0.1 },
  apply: (pol) => { pol.flags.reducedRate = true; },
});
policy('income_tax_cut', 'tax', '所得税の減税', '働く人の手取りを増やすため、所得税を減税する。', {
  params: [{ key: 'amount', name: '減税の規模', min: 1, max: 10, step: 1, unit: '兆円', def: 3 }], ideo: { econ: 0.5 }, ministry: 'minister_finance',
  costOf: (p) => p.amount, scale: (p) => p.amount / 3,
  seg: { employees: 3, families: 2, business: 1, young: 1, unions: 1, elderly: -1, floating: 1 }, eco: { growth: 0.15, inflation: 0.05 }, lasting: 2,
});
policy('corp_tax_cut', 'tax', '法人税率の引き下げ', '企業の国際競争力を高め、投資と雇用を呼びこむ。', {
  params: [{ key: 'pts', name: '引き下げ幅', min: 1, max: 10, step: 1, unit: 'ポイント', def: 5 }], ideo: { econ: 1.2 }, ministry: 'minister_finance',
  costOf: (p) => p.pts * 0.5, scale: (p) => p.pts / 5,
  seg: { business: 5, employees: 1, selfemployed: 1, unions: -3, families: -1, floating: -1, young: 0 }, eco: { growth: 0.15, unemployment: -0.1, nikkei: 4 },
});
policy('corp_tax_up', 'tax', '法人税の引き上げ', '大企業に応分の負担を求め、暮らしの財源にする。', {
  params: [{ key: 'pts', name: '引き上げ幅', min: 1, max: 10, step: 1, unit: 'ポイント', def: 3 }], ideo: { econ: -1.2 }, ministry: 'minister_finance',
  costOf: (p) => -p.pts * 0.5, scale: (p) => p.pts / 3,
  seg: { business: -5, unions: 3, families: 1, floating: 1, young: 1, employees: -1 }, eco: { growth: -0.1, nikkei: -3, unemployment: 0.05 },
});
policy('capital_gains_tax', 'tax', '金融所得課税の強化', '株の売却益や配当にかかる税を重くする。', {
  ideo: { econ: -0.8 }, ministry: 'minister_finance', cost: -0.8,
  seg: { business: -3, elderly: -1, unions: 3, young: 1, floating: 1, employees: -1 }, eco: { nikkei: -4 },
});
policy('inheritance_tax', 'tax', '相続税の強化', '資産の格差を是正するため、相続税を重くする。', {
  ideo: { econ: -0.8, social: -0.2 }, ministry: 'minister_finance', cost: -0.3,
  seg: { unions: 2, young: 2, elderly: -3, business: -2, selfemployed: -2, farmers: -1 },
});
policy('gasoline_tax', 'tax', 'ガソリン税の上乗せ分の廃止', '車が欠かせない地方の負担を減らすため、上乗せされた税率をやめる。', {
  ideo: { econ: 0.2 }, ministry: 'minister_finance', cost: 0.8,
  seg: { rural: 4, selfemployed: 2, employees: 1, farmers: 2, young: 1, floating: 1, urban: -1 }, eco: { inflation: -0.15, growth: 0.05 },
});
policy('furusato_tax', 'tax', 'ふるさと納税の創設', '応援したい自治体に寄付すると、住んでいる所の税金が控除される。', {
  ideo: { econ: 0.2, social: 0.3 }, ministry: 'minister_internal', cost: 0.1,
  check: (pol) => (pol.flags.furusato ? 'すでにある' : null),
  seg: { rural: 3, farmers: 2, employees: 1, urban: -2 }, apply: (pol) => { pol.flags.furusato = true; },
});
// --- 財政・経済
// A 補正予算 is a 予算案 (billKind 'budget'), not a 法律案: only the cabinet submits it, the 衆院 votes
// first and it passes when the 参院 does not vote within 30 days (憲法60条・73条・86条).
policy('stimulus', 'finance', '大型の経済対策（補正予算）', '景気を下支えするため、補正予算で大型の対策を打つ。', {
  params: [{ key: 'amount', name: '規模', min: 2, max: 40, step: 2, unit: '兆円', def: 10 }], ideo: { econ: -0.4 }, ministry: 'minister_finance',
  billKind: 'budget', title: (p) => `補正予算案（経済対策・${p.amount}兆円）`,
  costOf: (p) => p.amount, scale: (p) => p.amount / 10, lasting: 1,
  seg: { selfemployed: 3, business: 2, rural: 2, employees: 1, families: 1, floating: -1, young: -1 }, eco: { growth: 0.6, unemployment: -0.2, inflation: 0.2, nikkei: 3 },
});
policy('fiscal_consolidation', 'finance', '財政健全化（基礎的財政収支の黒字化目標）', '歳出の伸びをおさえ、将来の世代へのつけを減らす。', {
  ideo: { econ: 0.6 }, ministry: 'minister_finance', cost: -3,
  seg: { young: 2, business: 1, floating: 1, elderly: -2, rural: -2, unions: -2, selfemployed: -1 }, eco: { growth: -0.2, yen: -3 },
});
policy('bank_rescue', 'finance', '金融機関への公的資金の注入', '不良債権に苦しむ銀行に公的資金を入れ、金融危機を防ぐ。', {
  years: yr(1992, 2012), ideo: { econ: 0.2 }, ministry: 'minister_finance', cost: 3, lasting: 1,
  seg: { business: 3, employees: 1, floating: -4, urban: -2, young: -2, families: -1 }, eco: { growth: 0.3, nikkei: 6, unemployment: -0.1 },
});
policy('deregulation', 'economy', '規制緩和と特区の推進', '新しいビジネスが生まれやすいよう、規制を大胆に見直す。', {
  ideo: { econ: 1.2 }, ministry: 'minister_trade',
  seg: { business: 4, young: 2, urban: 2, selfemployed: -1, farmers: -3, unions: -3, rural: -1 }, eco: { growth: 0.3, unemployment: 0.1, nikkei: 3 },
});
policy('postal_privatization', 'economy', '郵政民営化', '郵便・貯金・保険の郵政事業を民営化する。', {
  years: yr(1995, 2010), ideo: { econ: 1.3 }, ministry: 'minister_internal', cost: -0.5,
  check: (pol) => (pol.flags.postal ? 'すでに民営化ずみ' : null),
  seg: { urban: 3, business: 3, young: 2, floating: 2, rural: -4, elderly: -2, unions: -3 }, eco: { growth: 0.1, nikkei: 2 },
  apply: (pol) => { pol.flags.postal = true; },
});
policy('privatize_public', 'economy', '公営事業の民営化', '国や自治体が営む事業を民間に任せ、効率を上げる。', {
  ideo: { econ: 1.2 }, ministry: 'minister_transport', cost: -0.3,
  seg: { business: 3, urban: 1, floating: 1, unions: -4, rural: -2 }, eco: { growth: 0.1 },
});
policy('tourism', 'culture', '観光立国（ビザの緩和と受け入れ体制）', '海外からの観光客を呼びこみ、地域を元気にする。', {
  years: yr(2003), ideo: { econ: 0.6 }, ministry: 'minister_transport', cost: 0.1,
  seg: { selfemployed: 3, business: 3, rural: 2, urban: 1, elderly: -1 }, eco: { growth: 0.15, yen: 1 },
});
policy('culture_ent', 'culture', '文化芸術・エンタメの振興', '映画・音楽・お笑い・アニメなどの担い手を支え、海外にも広める。', {
  ideo: { econ: 0, social: -0.2 }, ministry: 'minister_education', cost: 0.1,
  seg: { young: 3, urban: 2, business: 1, selfemployed: 1, elderly: -1 }, eco: { growth: 0.03 },
});
policy('ir_casino', 'economy', '統合型リゾート（カジノを含むIR）の整備', 'ホテルや会議場とカジノを一体で整備し、観光の拠点にする。', {
  years: yr(2010), ideo: { econ: 1.0, social: -0.2 }, ministry: 'minister_transport',
  seg: { business: 3, selfemployed: 1, urban: 1, families: -3, elderly: -2, floating: -1 }, eco: { growth: 0.05 },
});
policy('research', 'education', '科学技術・研究への投資', '大学や研究機関への予算を増やし、将来の産業を育てる。', {
  ideo: { econ: 0 }, ministry: 'minister_education', cost: 0.5, lasting: 5,
  seg: { young: 2, business: 2, urban: 1, elderly: -1 }, eco: { growth: 0.1 },
});
policy('space', 'education', '宇宙開発の推進', 'ロケットや人工衛星の開発を進める。', {
  ideo: { security: 0.3 }, ministry: 'minister_education', cost: 0.2,
  seg: { young: 2, business: 2, elderly: -1 }, eco: { growth: 0.02 },
});
// --- 労働
policy('min_wage', 'labor', '最低賃金の引き上げ', '働く人の暮らしを底上げするため、最低賃金を上げる。', {
  params: [{ key: 'pct', name: '引き上げ率', min: 1, max: 20, step: 1, unit: '%', def: 5 }], ideo: { econ: -0.8 }, ministry: 'minister_health',
  scale: (p) => p.pct / 5,
  seg: { young: 4, unions: 4, employees: 2, families: 2, selfemployed: -4, business: -3 }, eco: { inflation: 0.15, unemployment: 0.1, growth: 0.05 },
});
policy('haken_dereg', 'labor', '労働者派遣の規制緩和', '派遣で働ける仕事の範囲を広げ、雇用を柔軟にする。', {
  ideo: { econ: 1.2 }, ministry: 'minister_health',
  seg: { business: 4, selfemployed: 2, young: -2, unions: -5, employees: -2, floating: -1 }, eco: { unemployment: -0.2, growth: 0.15 },
});
policy('irregular_protect', 'labor', '非正規雇用の待遇改善（同一労働同一賃金）', '同じ仕事なら正社員と非正規の待遇の差をなくす。', {
  ideo: { econ: -0.9 }, ministry: 'minister_health',
  seg: { young: 3, unions: 4, employees: 2, families: 2, business: -4, selfemployed: -2 }, eco: { growth: -0.05, unemployment: 0.05, inflation: 0.05 },
});
policy('work_style', 'labor', '長時間労働の上限規制', '残業時間に罰則つきの上限を設ける。', {
  years: yr(1995), ideo: { econ: -0.5 }, ministry: 'minister_health',
  seg: { employees: 3, families: 2, young: 2, unions: 3, business: -3, selfemployed: -2 }, eco: { growth: -0.1 },
});
policy('foreign_workers', 'society', '外国人労働者の受け入れ拡大', '人手不足の分野で、外国人が働ける在留資格を広げる。', {
  ideo: { econ: 1.0, social: -0.8 }, ministry: 'minister_justice',
  seg: { business: 4, selfemployed: 2, farmers: 2, unions: -3, rural: -1, elderly: -2, floating: -1 }, eco: { growth: 0.1, unemployment: 0.05 },
});
// --- 社会保障・医療・子育て
policy('pension_cut', 'welfare', '年金制度の改革（給付の伸びの抑制）', '年金を長く続けるため、給付の伸びをおさえる仕組みを入れる。', {
  ideo: { econ: 0.7 }, ministry: 'minister_health', cost: -1.5,
  seg: { elderly: -6, young: 3, employees: 1, business: 1, floating: 1 }, eco: { growth: -0.05 },
});
policy('pension_up', 'welfare', '年金の給付の拡充', '最低保障を手厚くし、高齢者の暮らしを支える。', {
  ideo: { econ: -1.0 }, ministry: 'minister_health', cost: 2,
  seg: { elderly: 6, young: -2, employees: -1, business: -1, families: -1 }, eco: { growth: 0.05 },
});
policy('care_insurance', 'welfare', '介護保険制度の創設', '介護を社会全体で支える保険の仕組みをつくる。', {
  years: yr(1987, 2000), ideo: { econ: -0.6 }, ministry: 'minister_health', cost: 1,
  check: (pol) => (pol.flags.careInsurance ? 'すでにある' : null),
  seg: { elderly: 4, families: 3, employees: -1, business: -1 }, eco: { unemployment: -0.1 },
  apply: (pol) => { pol.flags.careInsurance = true; },
});
policy('care_expand', 'welfare', '介護・福祉サービスの拡充', '介護職の処遇を改善し、サービスを増やす。', {
  ideo: { econ: -0.7 }, ministry: 'minister_health', cost: 1.5,
  seg: { elderly: 4, families: 2, unions: 1, young: -1, business: -1 }, eco: { unemployment: -0.1 },
});
policy('medical_copay', 'health', '高齢者医療の窓口負担の見直し', '所得のある高齢者の窓口負担を引き上げ、現役世代の負担を減らす。', {
  ideo: { econ: 0.6 }, ministry: 'minister_health', cost: -0.8,
  seg: { elderly: -5, young: 2, employees: 1, families: 1, business: 1 },
});
policy('medical_cost', 'health', '医療費の抑制（診療報酬・薬価の引き下げ）', '医療費の伸びをおさえるため、病院や薬の値段を見直す。', {
  ideo: { econ: 0.6 }, ministry: 'minister_health', cost: -0.8,
  seg: { young: 2, employees: 1, business: 1, elderly: -3, selfemployed: -1 },
});
policy('child_allowance', 'childcare', '児童手当の拡充', '子どもを育てる家庭に毎月の手当を増やす。', {
  params: [{ key: 'yen', name: '子ども1人あたりの月額の上乗せ', min: 5000, max: 30000, step: 5000, unit: '円', def: 10000 }], ideo: { econ: -0.8 }, ministry: 'minister_health',
  costOf: (p, c) => (p.yen / 10000) * 2.0 * (c.kids || 1), scale: (p) => p.yen / 10000,
  seg: { families: 5, young: 2, elderly: -2, business: -1 }, eco: { growth: 0.05 },
});
policy('free_childcare', 'childcare', '幼児教育・保育の無償化', '3〜5歳の幼稚園・保育所の費用を無料にする。', {
  ideo: { econ: -0.7 }, ministry: 'minister_special', cost: 0.9,
  check: (pol) => (pol.flags.freeChildcare ? 'すでに無償化ずみ' : null),
  seg: { families: 5, young: 2, elderly: -1 }, eco: { growth: 0.05 }, apply: (pol) => { pol.flags.freeChildcare = true; },
});
policy('daycare', 'childcare', '待機児童の解消（保育所の整備）', '保育所を増やし、保育士の待遇を改善する。', {
  ideo: { econ: -0.5 }, ministry: 'minister_health', cost: 0.5,
  seg: { families: 4, urban: 3, young: 2, employees: 1, elderly: -1 }, eco: { growth: 0.05, unemployment: -0.05 },
});
policy('fertility', 'childcare', '少子化対策（結婚・出産の支援）', '出産費用の負担軽減や若い世代の結婚の支援を行う。', {
  ideo: { econ: -0.5, social: 0.3 }, ministry: 'minister_special', cost: 1.0, lasting: 5,
  seg: { families: 4, young: 3, elderly: -1, business: -1 },
});
policy('housing_support', 'childcare', '若者・子育て世帯の住まいの支援', '家賃の補助や公営住宅で、住まいの負担を減らす。', {
  ideo: { econ: -0.5 }, ministry: 'minister_transport', cost: 0.3,
  seg: { young: 3, families: 3, urban: 2, elderly: -1 },
});
// --- 教育
policy('free_tuition', 'education', '高校・大学の授業料の無償化', '家庭の収入にかかわらず学べるよう、授業料をなくす。', {
  ideo: { econ: -0.8 }, ministry: 'minister_education', cost: 1.5,
  seg: { families: 4, young: 4, elderly: -2, business: -1 }, eco: { growth: 0.03 },
});
policy('education_reform', 'education', '教育改革（学力の向上と先生の増員）', '少人数学級と先生の働き方の改善で学力を伸ばす。', {
  ideo: { social: 0.2 }, ministry: 'minister_education', cost: 0.4,
  seg: { families: 2, unions: 1, young: 1, elderly: -1, selfemployed: -1 }, // 予算の配分・税の負担
});
policy('scholarship', 'education', '返さなくていい奨学金の創設', '経済的に苦しい学生に、返済のいらない奨学金を出す。', {
  ideo: { econ: -0.6 }, ministry: 'minister_education', cost: 0.3,
  seg: { young: 4, families: 2, elderly: -1 },
});
// --- 外交・安全保障
policy('defense_up', 'diplomacy', '防衛費の増額', '安全保障環境に備えて、防衛費を増やす。', {
  params: [{ key: 'pct', name: 'GDPに対する防衛費', min: 1.0, max: 3.0, step: 0.5, unit: '%', def: 2.0 }], ideo: { security: 1.5 }, ministry: 'minister_defense',
  check: (pol, p) => (p && num(p.pct) <= num(pol.economy.defense, 1) ? `いまの水準（GDPの${Math.round(num(pol.economy.defense, 1) * 10) / 10}%）より高くする必要がある` : null),
  costOf: (p, c) => Math.max(0, (p.pct - (c.defense ?? 1.0)) * (c.gdp || 600) / 100),
  seg: { elderly: 1, business: 2, rural: 1, selfemployed: 1, young: -1, families: -2, unions: -3, floating: -1 }, eco: { growth: 0.03 },
  apply: (pol, p) => { pol.economy.defense = p.pct; },
});
policy('defense_cut', 'diplomacy', '防衛費の削減', '防衛費をおさえ、暮らしの予算に回す。', {
  ideo: { security: -1.5 }, ministry: 'minister_defense', cost: -0.5,
  seg: { unions: 3, families: 2, young: 1, floating: 1, business: -2, elderly: -1, rural: -1 },
  apply: (pol) => { pol.economy.defense = Math.max(0.5, (pol.economy.defense || 1) - 0.1); },
});
policy('security_law', 'diplomacy', '安全保障法制の整備', '同盟国との協力や自衛隊の活動の範囲を法律で定める。', {
  years: yr(1997), ideo: { security: 1.6 }, ministry: 'minister_defense',
  seg: { business: 1, elderly: 1, rural: 1, young: -2, unions: -4, families: -1, floating: -2, urban: -1 },
});
policy('pko', 'diplomacy', '国際貢献（国連の平和維持活動）への参加', '国連の平和維持活動に、自衛隊などが参加できるようにする。', {
  ideo: { security: 0.8 }, ministry: 'minister_foreign',
  seg: { business: 1, urban: 1, young: 1, unions: -2, elderly: 0 },
});
policy('oda', 'diplomacy', 'ODA（政府開発援助）の拡充', '途上国への援助を増やし、国際社会での信頼を高める。', {
  ideo: { security: -0.2 }, ministry: 'minister_foreign', cost: 0.5,
  seg: { business: 2, urban: 1, rural: -1, elderly: -1 },
});
policy('fta', 'diplomacy', '経済連携協定（自由貿易）への参加', '関税をなくして貿易を広げる多国間の協定に加わる。', {
  years: yr(2002), ideo: { econ: 1.2 }, ministry: 'minister_foreign',
  seg: { business: 5, urban: 2, young: 1, employees: 1, farmers: -6, rural: -3 }, eco: { growth: 0.2, nikkei: 2, inflation: -0.05 },
});
policy('farm_import', 'agriculture', '農産物の輸入自由化', '輸入の枠や関税をなくし、食品の値段を下げる。', {
  ideo: { econ: 1.0 }, ministry: 'minister_agri',
  seg: { farmers: -6, rural: -3, urban: 2, families: 2, business: 2 }, eco: { inflation: -0.1, growth: 0.05 },
});
// --- 憲法
policy('referendum_law', 'constitution', '国民投票法（憲法改正の手続き）の制定', '憲法改正の国民投票の手続きを定める。', {
  ideo: { security: 0.4, social: 0.3 }, ministry: 'minister_internal',
  check: (pol, p, y) => (pol.flags.referendumLaw || y >= 2010 ? 'すでに定められている' : null),
  seg: { elderly: 1, business: 1, unions: -1 }, apply: (pol) => { pol.flags.referendumLaw = true; },
});
for (const [id, name, desc, ideo, seg] of [
  ['amend_sdf', '憲法改正（自衛隊の明記）', '9条に自衛隊の存在を書きこむ憲法改正案。', { security: 1.8, social: 0.6 }, { elderly: 2, rural: 1, business: 1, unions: -4, young: -1, floating: -1, families: -1 }],
  ['amend_emergency', '憲法改正（緊急事態条項）', '大災害などのとき、国会議員の任期の延長などを認める条文を加える。', { security: 1.0, social: 0.5 }, { elderly: 1, rural: 1, unions: -3, young: -1, floating: -1 }],
  ['amend_education', '憲法改正（教育の無償化を明記）', '教育を受ける権利の条文に、無償化の方針を書きこむ。', { econ: -0.6 }, { families: 2, young: 2, elderly: -1, business: -1 }],
  ['amend_environment', '憲法改正（環境権の新設）', '良い環境で暮らす権利を新しく定める。', { social: -0.6 }, { young: 2, urban: 1, families: 1, business: -1 }],
]) {
  policy(id, 'constitution', name, desc + '各院の総議員の3分の2で発議し、国民投票の過半数で成立。', {
    kind: 'amendment', ideo, ministry: null, seg, lasting: 0,
    check: (pol, p, y) => (pol.flags.referendumLaw || y >= 2010 ? (pol.flags['done_' + id] ? 'すでに改正ずみ' : null) : '国民投票の手続きを定める法律がまだない'),
    apply: (pol) => { pol.flags['done_' + id] = true; pol.flags.amendments = (pol.flags.amendments || 0) + 1; },
  });
}
// --- エネルギー・環境
policy('nuclear_promote', 'energy', '原子力発電の活用', '安定した電力のため、原子力発電を活用する。', {
  ideo: { econ: 0.6, security: 0.3 }, ministry: 'minister_trade',
  seg: { business: 4, rural: 1, employees: 1, young: -1, families: -3, urban: -1, floating: -2 }, eco: { inflation: -0.1, growth: 0.1 },
});
policy('nuclear_exit', 'energy', '原子力発電からの段階的な撤退', '原子力発電を減らし、別のエネルギーに置きかえる。', {
  ideo: { econ: -0.4, social: -0.5 }, ministry: 'minister_trade', cost: 0.3,
  seg: { families: 3, urban: 2, young: 2, floating: 2, business: -4, rural: -2, unions: -1 }, eco: { inflation: 0.2, growth: -0.1 },
});
policy('renewables', 'energy', '再生可能エネルギーの普及（固定価格買取）', '太陽光や風力の電気を決まった値段で買い取り、普及を進める。', {
  years: yr(1995), ideo: { social: -0.5 }, ministry: 'minister_trade', cost: 0.2,
  seg: { young: 3, urban: 2, families: 1, rural: 2, floating: 1, business: -1 }, eco: { inflation: 0.1, growth: 0.05 },
});
policy('energy_subsidy', 'energy', '電気・ガス料金の補助', '値上がりした光熱費を国が一時的に補助する。', {
  ideo: { econ: -0.4 }, ministry: 'minister_trade', cost: 1.0, lasting: 1,
  seg: { families: 3, elderly: 2, selfemployed: 2, business: 1, young: -1, floating: -1 }, eco: { inflation: -0.3 },
});
policy('carbon_tax', 'environment', '炭素税（環境税）の導入', '二酸化炭素を多く出すほど税がかかる仕組みをつくる。', {
  ideo: { econ: -0.3, social: -0.5 }, ministry: 'minister_env', cost: -1,
  seg: { young: 2, urban: 1, floating: 1, business: -4, rural: -2, selfemployed: -2 }, eco: { inflation: 0.2, growth: -0.1 },
});
policy('env_regulation', 'environment', '公害・環境規制の強化', '大気や水の汚れ、ごみの規制を厳しくする。', {
  ideo: { econ: -0.6, social: -0.4 }, ministry: 'minister_env',
  seg: { families: 3, young: 2, urban: 2, business: -3, selfemployed: -1 }, eco: { growth: -0.05 },
});
// --- 農林水産
policy('gentan_end', 'agriculture', 'コメの生産調整（減反）の廃止', '作る量の調整をやめ、意欲のある農家が自由に作れるようにする。', {
  years: yr(1995), ideo: { econ: 1.0 }, ministry: 'minister_agri', cost: -0.2,
  check: (pol) => (pol.flags.gentanEnd ? 'すでに廃止ずみ' : null),
  seg: { farmers: -3, rural: -1, business: 2, urban: 2, families: 1 }, eco: { inflation: -0.05 }, apply: (pol) => { pol.flags.gentanEnd = true; },
});
policy('farm_income', 'agriculture', '農家への所得補償', '販売価格が生産費を下回る分を、農家に直接支払う。', {
  ideo: { econ: -0.8 }, ministry: 'minister_agri', cost: 0.6,
  seg: { farmers: 6, rural: 3, urban: -2, business: -1, young: -1 },
});
policy('fisheries', 'agriculture', '漁業・林業の振興', '担い手の育成や設備の更新を支援する。', {
  ideo: { econ: -0.3 }, ministry: 'minister_agri', cost: 0.2,
  seg: { farmers: 4, rural: 2, urban: -1 },
});
// --- 地方・国土
policy('decentralize', 'regional', '地方分権（税源の移譲）', '国の仕事と税源を地方に移し、地域のことは地域で決める。', {
  ideo: { econ: 0.3 }, ministry: 'minister_internal',
  seg: { rural: 2, urban: 1, selfemployed: 1, unions: -1 }, eco: { growth: 0.02 },
});
policy('municipal_merger', 'regional', '市町村合併の推進', '小さな市町村の合併を進め、行政を効率化する。', {
  years: yr(1995, 2012), ideo: { econ: 0.7 }, ministry: 'minister_internal', cost: -0.3,
  seg: { urban: 1, business: 1, floating: 1, rural: -4, elderly: -2, farmers: -2 },
});
policy('local_grant', 'regional', '地方交付税の増額', '財政の苦しい自治体への交付税を増やす。', {
  ideo: { econ: -0.7 }, ministry: 'minister_internal', cost: 1,
  seg: { rural: 4, farmers: 2, elderly: 1, urban: -2, young: -1, business: -1 }, eco: { growth: 0.03 },
});
policy('public_works', 'regional', '公共事業の拡大（道路・新幹線・港）', 'インフラを整備し、地方の雇用を生む。', {
  params: [{ key: 'amount', name: '規模', min: 1, max: 10, step: 1, unit: '兆円', def: 2 }], ideo: { econ: -0.6, social: 0.4 }, ministry: 'minister_transport',
  costOf: (p) => p.amount, scale: (p) => p.amount / 2,
  seg: { rural: 4, selfemployed: 2, business: 2, farmers: 1, urban: -2, young: -2, floating: -2 }, eco: { growth: 0.1, unemployment: -0.06 },
});
policy('public_works_cut', 'regional', '公共事業の削減', '公共事業を見直し、予算を減らす。', {
  params: [{ key: 'amount', name: '削減の規模', min: 1, max: 5, step: 1, unit: '兆円', def: 2 }], ideo: { econ: 0.8 }, ministry: 'minister_transport',
  costOf: (p) => -p.amount, scale: (p) => p.amount / 2,
  seg: { urban: 3, young: 2, floating: 2, rural: -4, selfemployed: -2, business: -1 }, eco: { growth: -0.08, unemployment: 0.05 },
});
policy('disaster_prep', 'disaster', '防災・減災（災害に強い国土づくり）', '堤防や耐震化など、災害に強い国づくりを進める。', {
  params: [{ key: 'amount', name: '規模', min: 1, max: 5, step: 1, unit: '兆円', def: 2 }], ideo: { econ: -0.4, security: 0.3 }, ministry: 'minister_transport',
  costOf: (p) => p.amount, scale: (p) => p.amount / 2, lasting: 5,
  seg: { rural: 3, elderly: 2, selfemployed: 2, families: 1, young: -1 }, eco: { growth: 0.08 },
});
// 「国土強靱化」 is a word of 2012-2013 (国土強靱化担当大臣 2012-12-26; 国土強靱化基本法 成立 2013-12-04, 公布・施行
// 12-11; cao.go.jp 古屋大臣会見 2013-12-06, japaneselawtranslation 2354). The name follows the game's year (a getter, so
// every reader of POLICIES.disaster_prep.name sees the era's name; NAMES_AT is refreshed by ensurePol).
Object.defineProperty(POLICIES.disaster_prep, 'name', { get: () => (NAMES_AT.fy >= 2013 ? '防災・減災（国土強靱化）' : '防災・減災（災害に強い国土づくり）'), enumerable: true, configurable: true });
policy('reconstruction', 'disaster', '被災地の復興支援', '災害からの復旧・復興に予算と人を集中する。', {
  ideo: {}, ministry: 'minister_reconstruction', cost: 2, lasting: 3,
  // once per disaster (REPEATABLE below; round 4): a later disaster can have its own law
  check: (pol) => {
    if (!pol.flags.disasterDay) return '大きな災害が起きたときの政策';
    const last = (pol.laws || []).slice().reverse().find((l) => l.policy === 'reconstruction');
    if (last && num(last.day) >= num(pol.flags.disasterDay)) return 'この災害の復興の法律は、すでに成立している';
    return null;
  },
  seg: { rural: 3, elderly: 2, families: 2, floating: 1, selfemployed: 1 }, eco: { growth: 0.1 },
  // the 復興 record moves on; after a very large disaster (tier 3) from 2001 on, the law sets up a 復興庁 (as in 2012)
  apply: (pol, params, g) => {
    const F = pol.fukko;
    const day = g && g.state ? today(g) : num(NAMES_AT.day);
    if (F && !F.ended) { F.progress = Math.min(100, num(F.progress) + 15); F.law = day; (F.log || (F.log = [])).push({ day, text: '復興の法律が成立（予算と人を集中）' }); }
    if (F && !F.ended && num(F.tier) >= 3 && NAMES_AT.fy >= 2001 && !reconAgency(NAMES_AT.fy, pol.flags)) {
      pol.flags.reconstructionAgency = true;
      F.agencyLaw = true;
      if (g && g.state) news(pol, g, `${F.name}からの復興のため、復興庁が発足した（復興担当大臣は復興大臣に）`);
    }
  },
});
// --- 行政改革・政治改革
policy('civil_service_cut', 'admin', '公務員の削減と給与の見直し', '国家公務員の数と人件費を減らす。', {
  ideo: { econ: 1.0 }, ministry: 'minister_internal', cost: -0.5,
  seg: { urban: 2, business: 2, floating: 3, unions: -5, rural: -1 },
});
policy('ministry_reorg', 'admin', '中央省庁の再編', '省庁を大くくりに再編し、縦割りをなくす（施行は2001年1月）。', {
  years: yr(1987, 2000), ideo: { econ: 0.5 }, ministry: 'minister_mgmt',
  check: (pol) => (pol.flags.reorgLaw ? 'すでに決まっている' : null),
  seg: { business: 1, floating: 2, unions: -2 }, apply: (pol) => { pol.flags.reorgLaw = true; },
});
policy('seat_cut', 'admin', '国会議員の定数削減', '国会議員の数を減らし、議会の経費を見直す（衆議院の定数を次の総選挙から減らす）。', {
  params: [{ key: 'seats', name: '削減数', min: 5, max: 50, step: 5, unit: '議席', def: 10 }], ideo: { econ: 0.5 }, ministry: null,
  seg: { floating: 4, urban: 2, young: 2, business: 1, unions: -1, rural: -1 },
  apply: (pol, p) => { pol.flags.seatCut = (pol.flags.seatCut || 0) + p.seats; },
});
policy('political_money', 'admin', '政治資金の規正の強化', '企業・団体献金の制限や収支の公開を強め、政治とカネの透明性を高める。', {
  ideo: { social: -0.3 }, ministry: 'minister_internal',
  seg: { floating: 4, young: 2, urban: 2, families: 1, business: -2, rural: -1 },
  apply: (pol) => { pol.flags.moneyStrict = (pol.flags.moneyStrict || 0) + 1; },
});
policy('electoral_reform', 'admin', '選挙制度改革（小選挙区比例代表並立制）', '衆議院を、小選挙区と比例代表を組み合わせた制度に変える。', {
  years: yr(1987, 1995), ideo: { econ: 0.2 }, ministry: 'minister_home',
  check: (pol, p, y) => (pol.flags.heiritsuFrom || y >= 1995 ? 'すでに決まっている' : null),
  seg: { floating: 3, urban: 2, young: 1, rural: -1, elderly: -1 },
  apply: (pol, p, g) => { pol.flags.heiritsuFrom = calYear(g) + 1; },
});
policy('voting_age', 'admin', '選挙権年齢の18歳への引き下げ', '18歳・19歳も投票できるようにする。', {
  years: yr(1987, 2016), ideo: { social: -0.4 }, ministry: 'minister_internal',
  check: (pol, p, y) => (pol.flags.age18 || y >= 2016 ? 'すでに18歳から' : null),
  seg: { young: 5, families: 1, elderly: -1 }, apply: (pol) => { pol.flags.age18 = true; },
});
// --- 治安・司法
policy('police_up', 'safety', '警察官の増員と防犯対策', '交番の警察官や防犯カメラを増やす。', {
  ideo: { social: 0.6, security: 0.4 }, ministry: 'minister_npsc', cost: 0.2,
  seg: { elderly: 3, families: 3, urban: 2, selfemployed: 1, young: -1 },
});
policy('saibanin', 'safety', '裁判員制度の導入', '重大な刑事裁判に、くじで選ばれた国民が参加する。', {
  years: yr(1987, 2009), ideo: { social: -0.3 }, ministry: 'minister_justice',
  check: (pol, p, y) => (pol.flags.saibanin || y >= 2009 ? 'すでにある' : null),
  seg: { urban: 1, floating: 1, young: 1, elderly: -1, selfemployed: -1 }, apply: (pol) => { pol.flags.saibanin = true; },
});
policy('anti_yakuza', 'safety', '暴力団排除の強化', '暴力団への利益供与を禁じ、取り締まりを強める。', {
  ideo: { social: 0.5 }, ministry: 'minister_npsc', cost: 0.1,
  // trade-off: businesses carry the checks (取引先の確認・契約の暴排条項)
  seg: { families: 3, elderly: 2, urban: 2, business: -1, selfemployed: -2 },
  apply: (pol) => { pol.flags.antiYakuza = (pol.flags.antiYakuza || 0) + 1; },
});
policy('conspiracy_law', 'safety', '組織的犯罪の計画段階での処罰の新設', '組織的犯罪集団による重大な犯罪を、計画と準備の段階から処罰できるようにする。賛成する側は「テロ等準備罪」、反対する側は「共謀罪」と呼ぶ。', {
  years: yr(1999), ideo: { social: 0.8, security: 1.0 }, ministry: 'minister_justice',
  seg: { elderly: 2, business: 1, rural: 1, young: -2, unions: -3, urban: -1, floating: -2 },
});
policy('smoking_ban', 'health', '受動喫煙対策（飲食店などの原則屋内禁煙）', 'たばこを吸わない人を煙から守るため、屋内を原則禁煙にする。', {
  years: yr(2000), ideo: { social: -0.2 }, ministry: 'minister_health',
  check: (pol) => (pol.flags.smokeBan ? 'すでにある' : null),
  seg: { families: 4, young: 2, urban: 2, selfemployed: -4, business: -1 }, apply: (pol) => { pol.flags.smokeBan = true; },
});
// --- デジタル
policy('mynumber', 'digital', '共通番号制度（マイナンバー）の導入', '税と社会保障の手続きのために、1人1つの番号をつくる。', {
  years: yr(2000, 2016), ideo: { econ: 0.4 }, ministry: 'minister_internal', cost: 0.2,
  check: (pol, p, y) => (pol.flags.mynumber || y >= 2016 ? 'すでにある' : null),
  seg: { business: 2, employees: 1, elderly: -2, floating: -1 }, eco: { growth: 0.03 }, apply: (pol) => { pol.flags.mynumber = true; },
});
policy('digital_gov', 'digital', '行政手続きのオンライン化', '役所の手続きをネットで完結できるようにする。', {
  years: yr(2000), ideo: { econ: 0.4 }, ministry: 'minister_internal', cost: 0.2,
  seg: { young: 3, urban: 2, employees: 2, business: 2, elderly: -2 }, eco: { growth: 0.05 },
});
policy('digital_agency', 'digital', 'デジタル庁の創設', '行政のデジタル化の司令塔となる役所をつくる。', {
  years: yr(2010, 2021), ideo: { econ: 0.4 }, ministry: 'minister_internal', cost: 0.1,
  check: (pol, p, y) => (pol.flags.digitalAgency || y >= 2022 ? 'すでにある' : null),
  seg: { young: 2, business: 2, urban: 1, elderly: -1 }, apply: (pol) => { pol.flags.digitalAgency = true; },
});
// --- 家族・人権
policy('same_sex_marriage', 'society', '同性婚の法制化', '同性のカップルが結婚できるようにする。', {
  ideo: { social: -1.6 }, ministry: 'minister_justice',
  seg: { young: 4, urban: 3, floating: 2, elderly: -3, rural: -2, families: -1 },
});
policy('separate_surnames', 'society', '選択的夫婦別姓の導入', '結婚しても、希望すれば夫婦がそれぞれの姓を名乗れるようにする。', {
  ideo: { social: -1.2 }, ministry: 'minister_justice',
  seg: { young: 3, urban: 2, employees: 1, elderly: -3, rural: -2 },
});
export const POLICY_ORDER = Object.keys(POLICIES);
// Contract field eras: the era keys whose game can reach the policy's years (a game keeps
// running past its start, so an era is listed when the policy is still possible after its start).
for (const pl of Object.values(POLICIES)) pl.eras = Object.keys(ERA_POLITICS).filter((e) => !pl.years || pl.years[1] >= ERA_POLITICS[e].start);

// The ideology of a policy as a vector (missing axes = 0).
const ideoOf = (pl) => ({ econ: (pl && pl.ideo && pl.ideo.econ) || 0, social: (pl && pl.ideo && pl.ideo.social) || 0, security: (pl && pl.ideo && pl.ideo.security) || 0 });

// Government agenda: what cabinets of each period tend to bring to the Diet (if not done
// yet). Not a script: bills still need the votes, and the player can do things first.
const AGENDA = [
  [1987, 1989, ['shohizei_intro', 'deregulation', 'privatize_public', 'public_works', 'oda']],
  [1990, 1994, ['stimulus', 'pko', 'political_money', 'electoral_reform', 'bank_rescue', 'public_works']],
  [1995, 1997, ['shohizei_up', 'care_insurance', 'bank_rescue', 'stimulus', 'deregulation', 'ministry_reorg']],
  [1998, 2000, ['ministry_reorg', 'bank_rescue', 'stimulus', 'care_insurance', 'deregulation', 'pension_cut']],
  [2001, 2006, ['postal_privatization', 'deregulation', 'haken_dereg', 'public_works_cut', 'municipal_merger', 'pension_cut', 'fiscal_consolidation', 'saibanin', 'medical_copay', 'tourism']],
  [2007, 2012, ['referendum_law', 'stimulus', 'child_allowance', 'free_tuition', 'farm_income', 'renewables', 'shohizei_up', 'mynumber', 'furusato_tax', 'smoking_ban']],
  [2013, 2019, ['shohizei_up', 'security_law', 'fta', 'voting_age', 'work_style', 'foreign_workers', 'ir_casino', 'free_childcare', 'reduced_rate', 'corp_tax_cut', 'conspiracy_law', 'tourism', 'digital_gov']],
  [2020, 2100, ['digital_agency', 'defense_up', 'child_allowance', 'fertility', 'min_wage', 'energy_subsidy', 'political_money', 'care_expand', 'research', 'stimulus', 'disaster_prep', 'gasoline_tax']],
];
function agendaFor(year) {
  const row = AGENDA.find(([a, b]) => year >= a && year <= b);
  return row ? row[2] : [];
}

// ================================================================ posts
// kind: 'cabinet' | 'party' | 'diet'. years: [from, to) as fractional years (2001.0 = 2001-01).
// names: [[fromYear, name], ...] for posts renamed over time; areas: policy areas the post
// brings 閣法 for; pre: the post that does the job before it existed; next: successor after.
// eras: era keys whose start year has the post (contract field).
export const POSTS = {
  pm: { name: '内閣総理大臣', short: '総理', kind: 'cabinet', areas: [] },
  kanbo: { name: '内閣官房長官', short: '官房長官', kind: 'cabinet', areas: ['admin'] },
  minister_internal: { name: '総務大臣', kind: 'cabinet', years: [2001, INF], areas: ['regional', 'digital', 'admin'], pre: 'minister_home' },
  minister_home: { name: '自治大臣', kind: 'cabinet', years: [0, 2001], areas: ['regional', 'admin'], next: 'minister_internal' },
  minister_posts: { name: '郵政大臣', kind: 'cabinet', years: [0, 2001], areas: ['digital'], next: 'minister_internal' },
  minister_mgmt: { name: '総務庁長官', names: [[0, '行政管理庁長官'], [1984.5, '総務庁長官']], kind: 'cabinet', years: [0, 2001], areas: ['admin'], next: 'minister_internal' },
  minister_justice: { name: '法務大臣', kind: 'cabinet', areas: ['safety', 'society'] },
  minister_foreign: { name: '外務大臣', kind: 'cabinet', areas: ['diplomacy'] },
  minister_finance: { name: '財務大臣', names: [[0, '大蔵大臣'], [2001, '財務大臣']], kind: 'cabinet', areas: ['finance', 'tax'] },
  minister_education: { name: '文部科学大臣', names: [[0, '文部大臣'], [2001, '文部科学大臣']], kind: 'cabinet', areas: ['education', 'culture'] },
  minister_health: { name: '厚生労働大臣', names: [[0, '厚生大臣'], [2001, '厚生労働大臣']], kind: 'cabinet', areas: ['welfare', 'health', 'childcare', 'labor'] },
  minister_labor: { name: '労働大臣', kind: 'cabinet', years: [0, 2001], areas: ['labor'], next: 'minister_health' },
  minister_agri: { name: '農林水産大臣', kind: 'cabinet', areas: ['agriculture'] },
  minister_trade: { name: '経済産業大臣', names: [[0, '通商産業大臣'], [2001, '経済産業大臣']], kind: 'cabinet', areas: ['economy', 'energy'] },
  minister_transport: { name: '国土交通大臣', names: [[0, '運輸大臣'], [2001, '国土交通大臣']], kind: 'cabinet', areas: ['regional', 'culture'] },
  minister_construction: { name: '建設大臣', kind: 'cabinet', years: [0, 2001], areas: ['regional', 'disaster'], next: 'minister_transport' },
  minister_env: { name: '環境大臣', names: [[0, '環境庁長官'], [2001, '環境大臣']], kind: 'cabinet', areas: ['environment'] },
  minister_defense: { name: '防衛大臣', names: [[0, '防衛庁長官'], [2007, '防衛大臣']], kind: 'cabinet', areas: ['diplomacy'] },
  minister_npsc: { name: '国家公安委員会委員長', short: '国家公安委員長', kind: 'cabinet', areas: ['safety'] },
  minister_epa: { name: '経済企画庁長官', kind: 'cabinet', years: [0, 2001], areas: ['economy'], next: 'minister_econ' },
  minister_sci: { name: '科学技術庁長官', kind: 'cabinet', years: [0, 2001], areas: ['education'], next: 'minister_education' },
  minister_land: { name: '国土庁長官', kind: 'cabinet', years: [0, 2001], areas: ['regional', 'disaster'], next: 'minister_transport' },
  minister_hokkaido: { name: '北海道開発庁長官', kind: 'cabinet', years: [0, 2001], areas: ['regional'], next: 'minister_transport' },
  minister_okinawa: { name: '沖縄開発庁長官', kind: 'cabinet', years: [0, 2001], areas: ['regional'], next: 'minister_special' },
  minister_econ: { name: '経済財政政策担当大臣', short: '経済財政担当相', kind: 'cabinet', years: [2001, INF], areas: ['economy', 'finance'], pre: 'minister_epa' },
  minister_special: { name: '内閣府特命担当大臣', short: '特命担当相', kind: 'cabinet', years: [2001, INF], areas: ['childcare', 'culture', 'society'], pre: 'minister_health' },
  // 復興大臣 (復興庁, 2012-02-10; 復興庁設置法: 2031年3月末まで, 2020年改正で10年延長) and, in any era, the 復興担当大臣
  // (国務大臣・特命: 1995-01-20 兵庫県南部地震対策担当, 2011-06-27 東日本大震災復興対策担当) that a PM appoints after a
  // major disaster (p.flags.fukkoTanto; see 「復興担当大臣」 below). One post id for both: postExists / postName special-case it.
  minister_reconstruction: { name: '復興大臣', kind: 'cabinet', years: [2012.1, INF], flag: 'reconstructionAgency', areas: ['disaster'], pre: 'minister_land' },
  minister_digital: { name: 'デジタル大臣', kind: 'cabinet', years: [2021.67, INF], flag: 'digitalAgency', areas: ['digital'], pre: 'minister_internal' },
  // party posts (name depends on the party: postName(id, year, party))
  party_leader: { name: '党首', kind: 'party' },
  kanjicho: { name: '幹事長', kind: 'party' },
  seichokai: { name: '政務調査会長', kind: 'party' },
  somukai: { name: '総務会長', kind: 'party', parties: ['jimin'] },
  sentai: { name: '選挙対策委員長', kind: 'party' },
  kokutai: { name: '国会対策委員長', kind: 'party' },
  // Diet
  speaker_shugi: { name: '衆議院議長', kind: 'diet', house: 'shugi' },
  speaker_sangi: { name: '参議院議長', kind: 'diet', house: 'sangi' },
  chair_budget: { name: '衆議院予算委員長', kind: 'diet', house: 'shugi' },
  chair_committee: { name: '常任委員長', kind: 'diet' },
};
for (const [id, P] of Object.entries(POSTS)) {
  P.id = id;
  if (P.kind === 'cabinet') P.eras = Object.keys(ERA_POLITICS).filter((e) => postExists(id, ERA_POLITICS[e].start + 0.3));
}
export const CABINET_ORDER = Object.keys(POSTS).filter((k) => POSTS[k].kind === 'cabinet');
export const PARTY_POST_ORDER = ['kanjicho', 'seichokai', 'somukai', 'sentai', 'kokutai'];
export function postExists(id, fy, flags = {}) {
  const P = POSTS[id];
  if (!P) return false;
  if (id === 'minister_reconstruction') return reconAgency(fy, flags || {}) || !!(flags && flags.fukkoTanto);
  if (!P.years) return true;
  if (P.flag && flags[P.flag] && fy >= 2001) return fy < P.years[1];
  return fy >= P.years[0] && fy < P.years[1];
}
// 復興庁 exists (the real one 2012-02 .. 2031-03, longer once extended in this game; or the game's own, made by a law)
export function reconAgency(fy, flags = {}) {
  if (flags && flags.reconstructionAgency && fy >= 2001) return true;
  return fy >= 2012.1 && (fy < 2031.25 || !!(flags && flags.reconExtended));
}
export function postName(id, fy = 2026, party = null) {
  const P = POSTS[id];
  if (!P) return String(id || '');
  if (id === 'minister_reconstruction') return reconAgency(fy, (NAMES_AT.pol && NAMES_AT.pol.flags) || {}) ? '復興大臣' : '復興担当大臣';
  if (id === 'party_leader') return party === 'jimin' ? '総裁' : '代表';
  if (id === 'seichokai') return party === 'jimin' ? '政務調査会長' : '政策調査会長';
  if (P.names) { let n = P.name; for (const [y, nm] of P.names) if (fy >= y) n = nm; return n; }
  return P.name;
}
// The cabinet posts of a (fractional) year.
export const cabinetPosts = (fy, flags = {}) => CABINET_ORDER.filter((id) => id !== 'pm' && postExists(id, fy, flags));
// The post that brings bills of a policy area / ministry in that year.
function ministryFor(post, fy, flags) {
  let p = post;
  for (let i = 0; i < 4 && p && !postExists(p, fy, flags); i++) p = (POSTS[p] && (fy < ((POSTS[p].years || [0])[0]) ? POSTS[p].pre : POSTS[p].next)) || null;
  return p && postExists(p, fy, flags) ? p : 'kanbo';
}

// ================================================================ parties
// Real parties are described only by verifiable facts. ideology numbers are the
// simulation's own placement (econ / social / security, -2..2), not a judgement.
export const PARTY_DEFS = {
  jimin: {
    name: '自由民主党', short: '自民', color: '#2f8f4e', logo: 'jimin', real: true, years: [1955.87, null], leaderTitle: '総裁',
    ideology: { econ: 0.8, social: 0.9, security: 1.0 },
    platform: ['public_works', 'defense_up', 'deregulation', 'corp_tax_cut', 'disaster_prep', 'nuclear_promote', 'fta', 'tourism'],
    // what the party (and its governments) took up in each period (simulation's summary of
    // publicly stated policies; used from the start year on: see platformFor)
    platformByYear: [
      [0, 1993, ['public_works', 'privatize_public', 'deregulation', 'shohizei_intro', 'local_grant', 'oda', 'nuclear_promote', 'fisheries']],
      [1994, 2000, ['deregulation', 'public_works', 'bank_rescue', 'ministry_reorg', 'fiscal_consolidation', 'nuclear_promote', 'local_grant', 'care_insurance']],
      [2001, 2008, ['postal_privatization', 'deregulation', 'fiscal_consolidation', 'public_works_cut', 'fta', 'nuclear_promote', 'tourism', 'municipal_merger']],
      [2009, 2019, ['security_law', 'fta', 'deregulation', 'corp_tax_cut', 'tourism', 'nuclear_promote', 'disaster_prep', 'amend_sdf']],
      [2020, INF, ['defense_up', 'disaster_prep', 'digital_gov', 'nuclear_promote', 'fertility', 'child_allowance', 'tourism', 'amend_sdf']],
    ],
    desc: '1955年11月15日、自由党と日本民主党の保守合同で結党。党首は総裁。結党以来、多くの期間で政権を担ってきた。',
    hq: '党本部（東京・永田町）',
  },
  minshu: {
    name: '民主党', short: '民主', color: '#d7263d', logo: 'minshu', real: true, years: [1998.32, 2016.23], leaderTitle: '代表',
    ideology: { econ: -0.4, social: -0.4, security: -0.2 },
    platform: ['child_allowance', 'free_tuition', 'farm_income', 'public_works_cut', 'political_money', 'civil_service_cut', 'renewables', 'decentralize'],
    desc: '1998年4月27日、いくつかの政党・会派が合流して結成（1996年結成の同名の党と法規上は同一）。党首は代表。史実では2009年の総選挙で政権交代を実現し、2012年に下野、2016年3月27日に他党との合流で党名を改めた。',
    hq: '党本部（東京・永田町）',
  },
  tomoshibi: {
    name: 'ともしび党', short: 'ともしび', color: '#e8833a', real: false, leaderTitle: '代表',
    ideology: { econ: -1.5, social: -0.6, security: -1.5 },
    platform: ['min_wage', 'irregular_protect', 'pension_up', 'care_expand', 'defense_cut', 'corp_tax_up', 'nuclear_exit', 'free_tuition'],
    desc: '働く人の暮らしと福祉、平和主義をかかげる政党。労働組合の支持が厚い。',
  },
  aozora: {
    name: '青空党', short: '青空', color: '#3a9ad9', real: false, leaderTitle: '代表',
    ideology: { econ: 1.6, social: -0.4, security: 0.4 },
    platform: ['deregulation', 'civil_service_cut', 'privatize_public', 'decentralize', 'digital_gov', 'corp_tax_cut', 'postal_privatization', 'fiscal_consolidation'],
    desc: '規制緩和と行政改革、「小さな政府」をめざす都市型の改革政党。',
  },
  nichirin: {
    name: '日輪党', short: '日輪', color: '#8a3ab9', real: false, leaderTitle: '代表',
    ideology: { econ: 0.4, social: 1.8, security: 1.8 },
    platform: ['amend_sdf', 'defense_up', 'security_law', 'police_up', 'anti_yakuza', 'conspiracy_law', 'income_tax_cut'],
    desc: '伝統と安全保障を重んじる保守政党。',
  },
  nijiiro: {
    name: 'にじいろ党', short: 'にじ', color: '#2fb5a3', real: false, leaderTitle: '代表',
    ideology: { econ: -0.8, social: -1.8, security: -1.0 },
    platform: ['same_sex_marriage', 'separate_surnames', 'renewables', 'carbon_tax', 'nuclear_exit', 'daycare', 'political_money', 'env_regulation'],
    desc: '環境と多様性、市民の参加をかかげる政党。',
  },
  denen: {
    name: '田園党', short: '田園', color: '#b5932f', real: false, leaderTitle: '代表',
    ideology: { econ: -0.3, social: 0.6, security: 0.0 },
    platform: ['farm_income', 'local_grant', 'fisheries', 'disaster_prep', 'gasoline_tax', 'child_allowance', 'pension_up'],
    desc: '地方と農林漁業、地域の暮らしを守る中道の政党。',
  },
};
// The platform of a party in a year (platformByYear when the party has one).
export function platformFor(id, year) {
  const d = PARTY_DEFS[id];
  if (!d) return [];
  const row = (d.platformByYear || []).find(([a, b]) => year >= a && year <= b);
  return [...(row ? row[2] : d.platform || [])];
}
export const partyExistsIn = (id, fy) => {
  const d = PARTY_DEFS[id];
  if (!d || d.dormant) return false;
  if (!d.years) return true;
  return fy >= d.years[0] && (d.years[1] == null || fy < d.years[1]);
};
const IND = 'ind'; // 無所属 (seat counts only)

// ================================================================ names (all fictional)
// Generated names avoid the surnames of well-known real politicians, and a blocklist keeps
// even an accidental full-name match out.
const SURNAMES = ['青木', '秋山', '浅野', '天野', '荒井', '有田', '飯島', '五十嵐', '池上', '石川', '井上', '今村', '岩崎', '上野', '内山', '大川',
  '大西', '岡村', '奥田', '小倉', '尾崎', '桂木', '金田', '川口', '菊池', '北村', '木下', '久保', '黒田', '小島', '小松', '近藤', '坂口', '桜井', '佐野',
  '沢田', '島田', '清水', '白井', '杉本', '関口', '高田', '高野', '滝沢', '竹中', '千葉', '辻本', '土屋', '寺田', '徳永', '中川', '永井', '中西', '中村',
  '西田', '野口', '橋爪', '長谷部', '浜田', '早川', '平野', '広瀬', '福井', '藤本', '古川', '堀内', '本田', '前川', '増田', '松井', '松本', '丸山', '水野',
  '三宅', '宮下', '村井', '望月', '森下', '矢野', '山下', '横田', '吉川', '若林', '和田', '渡部', '桐生', '朝倉', '高峰', '星川', '霧島', '真壁', '鳴海'];
const GIVEN = {
  m: ['恭介', '晴久', '雅彦', '清志', '達也', '慎一', '弘明', '孝之', '勝彦', '秀樹', '和臣', '泰造', '昌平', '健司', '正彦', '大悟', '英明', '光太郎', '修平',
    '宗一', '敦史', '直哉', '俊彦', '吉晴', '博之', '耕平', '文彦', '剛志', '克己', '浩介', '公平', '栄治', '隆之', '輝彦', '道夫', '義孝', '幸雄', '重信'],
  f: ['千鶴', '由紀恵', '真理子', '静香', '理恵', '美穂', '佳代子', '典子', '久美子', '和美', '恵美', '裕美', '智子', '洋子', '亜希子', '涼子', '奈緒',
    '志保', '律子', '薫', '葉子', '晶子', '玲子', '紀子'],
};
// Full names never to generate (kept empty in the source: the surname list was trimmed instead, so no
// real person's name is written here).
const NAME_BLOCK = new Set();
const LOOK_HAIR = ['short', 'slick', 'bald', 'short', 'slick'];
const LOOK_HAIR_F = ['bob', 'long', 'bob'];
const LOOK_HAIRCOL = ['black', 'black', 'gray', 'silver', 'white', 'brown'];
const LOOK_SUIT = ['#2a2f45', '#3a3f55', '#1f2a3a', '#4a4a52', '#2f3a4f', '#5a4a3a'];
const LOOK_TIE = ['#c0452f', '#2f6fd0', '#2f8f4e', '#8a3ab9', '#d0a03a', '#7a1f2f'];
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
function gauss() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }

// A fictional full name ('高田 恭介').
function genName(gender = Math.random() < 0.18 ? 'f' : 'm') {
  let name = '';
  for (let i = 0; i < 20; i++) { name = `${pickOne(SURNAMES)} ${pickOne(GIVEN[gender] || GIVEN.m)}`; if (!NAME_BLOCK.has(name)) break; }
  return name;
}
function newNpc(p, def = {}) {
  const used = new Set(Object.values(p.npcs).map((n) => n.name));
  const gender = def.gender || (Math.random() < 0.18 ? 'f' : 'm');
  let name = def.name || '';
  for (let i = 0; i < 40 && !def.name; i++) {
    name = genName(gender);
    if (!used.has(name)) break;
  }
  const id = 'pn' + (p.nextNpc = (p.nextNpc || 0) + 1);
  const look = gender === 'f'
    ? { hair: pickOne(LOOK_HAIR_F), hairColor: pickOne(['black', 'brown', 'gray']), top: pickOne(['#7a3a5a', '#3a4a7a', '#5a5a6a', '#8a6a4a']), bottom: '#2a2d36', jacket: true, skirt: Math.random() < 0.5, lashes: true }
    : { hair: pickOne(LOOK_HAIR), hairColor: pickOne(LOOK_HAIRCOL), top: pickOne(LOOK_SUIT), bottom: '#2a2d36', jacket: true, tie: pickOne(LOOK_TIE), glasses: Math.random() < 0.35 };
  const n = {
    id, name, gender, party: def.party || null, office: def.office || null, house: def.house || null, faction: def.faction || null,
    look, age: def.age || irnd(42, 74), wins: def.wins ?? irnd(1, 9),
    traits: { charisma: def.charisma ?? irnd(25, 85), integrity: def.integrity ?? irnd(30, 95), ambition: def.ambition ?? irnd(20, 90) },
    posts: [], district: def.district || null,
  };
  p.npcs[id] = n;
  return n;
}

// ================================================================ time helpers
// abs: days since 1 January of the start year (0-based). The game's day 1 is the start month.
const calOff = (p) => ((p && p.cal ? p.cal.month : 4) - 1) * MONTH_DAYS;
const absOfDay = (p, day) => day - 1 + calOff(p);
const dayOfAbs = (p, abs) => Math.round(abs - calOff(p) + 1);
const absOf = (p, year, month = 1, dom = 1) => (year - p.cal.year) * YEAR_DAYS + (month - 1) * MONTH_DAYS + Math.floor((dom - 1) / 3);
const yearOfAbs = (p, abs) => p.cal.year + Math.floor(abs / YEAR_DAYS);
const doyOfAbs = (abs) => ((abs % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
const fyOfAbs = (p, abs) => p.cal.year + abs / YEAR_DAYS;
// The next Sunday on or after a game day (Japanese elections are on Sundays).
const toSunday = (day) => { let d = Math.max(1, Math.round(day)); for (let i = 0; i < 7 && weekdayOf(d) !== 6; i++) d++; return d; };
// The Sunday nearest to a day (never in the past).
const nearSunday = (day, min = 1) => { const a = toSunday(Math.max(min, Math.round(day) - 3)); return a; };
const today = (g) => (g.state && g.state.day) || 1;
// The player's age on a game day (profile.age at day 1, +1 every YEAR_DAYS, like profile.js ageOf).
const ageAt = (st, day) => (st && st.profile ? num(st.profile.age, 20) + Math.floor((Math.max(1, num(day, 1)) - 1) / YEAR_DAYS) : 20);
const pol0 = (g) => (g.state && g.state.politics) || null;

// The simulated date of a game day: { year, month, dom, doy, wareki, label, short, fy }.
export function polDate(g, day = today(g)) {
  const p = pol0(g) || { cal: { year: eraPolitics(g.state && g.state.profile && g.state.profile.era).start, month: 4 } };
  const abs = absOfDay(p, day);
  const year = yearOfAbs(p, abs);
  const doy = doyOfAbs(abs);
  const month = Math.floor(doy / MONTH_DAYS) + 1;
  const dom = (doy % MONTH_DAYS) * 3 + 1;
  return { year, month, dom, doy, fy: fyOfAbs(p, abs), wareki: wareki(year, month), label: `${year}年（${wareki(year, month)}）${month}月`, short: `${year}年${month}月` };
}
export const calYear = (g, day) => polDate(g, day).year;
const fyNow = (g) => polDate(g).fy;
// A game day as a short date ('1987年4月上旬').
export function dateLabel(g, day) {
  const d = polDate(g, day);
  return `${d.year}年${d.month}月${d.dom <= 10 ? '上旬' : d.dom <= 20 ? '中旬' : '下旬'}`;
}

// ================================================================ hooks
const HOOKS = {};
// onPolitics(event, fn(g, data)): 'elected','lost','enacted','cabinet','scandal','dissolve','resign'
// ext events: 'election' (any result), 'session', 'bill', 'poll', 'shock', 'party', 'offer', 'payday'.
export function onPolitics(event, fn) { (HOOKS[event] || (HOOKS[event] = [])).push(fn); return () => { HOOKS[event] = HOOKS[event].filter((f) => f !== fn); }; }
function emit(g, event, data) {
  // the ruling parties changed: ねじれ follows the seats at once (review: the flag lagged coalition changes)
  if (event === 'cabinet') { const p = pol0(g); if (p && p.flags) p.flags.nejire = nejireNow(p); }
  for (const fn of HOOKS[event] || []) {
    try {
      const r = fn(g, data);
      if (r && typeof r.then === 'function') { const q = r.catch((e) => console.error(e)); if (g._polTicking) (g._polPending || (g._polPending = [])).push(q); }
    } catch (e) { console.error(e); }
  }
}

// ================================================================ state
function newMe() {
  return {
    office: null, district: null, party: null, termEnd: null, posts: [], faction: null,
    wins: 0, losses: 0, careerStart: null, funds: 0, secret: 0, staff: 0, reputation: 0, localSupport: 5,
    // ext
    nationalWins: 0, standing: 30, kouenkai: 0, member: false, candidacy: null, campaign: null,
    votes: {}, attend: { last: 0, absent: 0, days: 0 }, ledger: {}, reported: {}, exposed: 0, scandalDay: 0,
    history: [], coalitionStance: 'auto', offers: [], lastAct: {}, officeSince: null, ministerDays: 0, pmDays: 0, ideology: null, media: 0,
  };
}
function partySeats(p, id) {
  return num(p.diet.shugi.seats[id]) + num(p.diet.sangi.seats[id]);
}
function makeParty(p, id, fy, opts = {}) {
  const d = PARTY_DEFS[id] || {};
  const party = {
    id, name: d.name || opts.name, short: d.short || opts.short, color: d.color || opts.color || '#888888', logo: d.logo || null, emblem: opts.emblem || null,
    real: !!d.real, founded: opts.founded ?? null, years: d.years ? [...d.years] : null, leader: null, ideology: { ...(d.ideology || opts.ideology || { econ: 0, social: 0, security: 0 }) },
    platform: d.platformByYear ? platformFor(id, Math.floor(fy)) : [...(d.platform || opts.platform || [])], funds: Math.round(opts.funds ?? 0), members: Math.round(opts.members ?? 0), factions: [], subsidy: 0,
    isPlayers: !!opts.isPlayers, posts: {}, leaderTitle: d.leaderTitle || '代表', desc: d.desc || opts.desc || '', voteShare: { shugi: 0, sangi: 0 }, leaderNext: null,
  };
  p.parties[id] = party;
  return party;
}
// Factions (派閥 / 2024年からの自民党はグループ) and party posts with fictional NPCs.
function staffParty(p, party, fy, size) {
  const leader = newNpc(p, { party: party.id, house: 'shugi', office: 'shugi', charisma: irnd(55, 90), wins: irnd(6, 13), age: irnd(55, 75) });
  party.leader = leader.id;
  const groups = party.id === 'jimin' ? (fy >= 2024 ? 3 : 5) : party.id === 'minshu' ? 4 : size >= 60 ? 2 : 0;
  const word = party.id === 'jimin' && fy < 2024 ? '派' : 'グループ';
  const left = Math.max(0, size - 1);
  const shares = Array.from({ length: groups }, () => rnd(0.6, 1.4));
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  const covered = party.id === 'jimin' ? (fy >= 2024 ? 0.35 : 0.85) : 0.6;
  party.factions = shares.map((s, i) => {
    const boss = i === 0 && party.id !== 'jimin' ? leader : newNpc(p, { party: party.id, house: 'shugi', office: 'shugi', charisma: irnd(45, 85), wins: irnd(7, 14), age: irnd(58, 78) });
    const surname = boss.name.split(' ')[0];
    const f = { id: `${party.id}_f${i + 1}`, name: `${surname}${word}`, leader: boss.id, size: Math.max(2, Math.round((left * covered * s) / sum)), funds: word === '派' ? irnd(2, 6) * 10000000 : 0, kind: word === '派' ? 'faction' : 'group' };
    boss.faction = f.id;
    return f;
  });
  if (party.id === 'jimin' && party.factions.length) leader.faction = pickOne(party.factions).id;
  for (const post of PARTY_POST_ORDER) {
    if (POSTS[post].parties && !POSTS[post].parties.includes(party.id)) continue;
    const n = newNpc(p, { party: party.id, house: Math.random() < 0.8 ? 'shugi' : 'sangi', charisma: irnd(40, 80), wins: irnd(4, 11), faction: party.factions.length ? pickOne(party.factions).id : null });
    n.office = n.house;
    party.posts[post] = n.id;
    n.posts.push(post);
  }
}
const sumSeats = (s) => Object.values(s || {}).reduce((a, b) => a + num(b), 0);
// Split a seat table in two halves (参院 classes) by rounding.
function splitSeats(seats, nA) {
  const total = sumSeats(seats);
  const A = {}, B = {};
  let given = 0;
  const ids = Object.keys(seats).sort((a, b) => seats[b] - seats[a]);
  for (const id of ids) { A[id] = Math.round((seats[id] * nA) / total); given += A[id]; }
  let k = 0;
  while (given !== nA && k < 400) { const id = ids[k % ids.length]; if (given < nA) { A[id]++; given++; } else if (A[id] > 0) { A[id]--; given--; } k++; }
  for (const id of ids) B[id] = Math.max(0, seats[id] - A[id]);
  return [A, B];
}

export function newPoliticsState(g) {
  const st = g.state || {};
  const era = (st.profile && ERAS[st.profile.era] && st.profile.era) || 'reiwa';
  const E = eraPolitics(era);
  const p = {
    v: POL_STATE_VERSION, era, cal: { year: E.start, month: E.month },
    me: newMe(), parties: {},
    diet: { shugi: { total: 0, seats: {} }, sangi: { total: 0, seats: {}, classes: [] }, session: null, bills: [] },
    cabinet: { pm: null, partyIds: [], ministers: {}, approval: 50, formed: 1 },
    laws: [], economy: {}, opinion: { issues: {} }, elections: { upcoming: [], history: [] }, npcs: {}, flags: {},
    // ext
    support: { base: {}, mods: {} }, local: {}, polls: [], news: [], nextId: 1, nextNpc: 0, lastTick: 0, sessionsHeld: 0,
  };
  const day = today(g);
  const abs = absOfDay(p, day);
  const fy = fyOfAbs(p, abs);
  const year = yearOfAbs(p, abs);
  // parties
  for (const id of Object.keys(PARTY_DEFS)) {
    if (!partyExistsIn(id, fy)) continue;
    const size = num(E.shugi[id]) + num(E.sangi[id]);
    const party = makeParty(p, id, fy, {
      funds: (id === 'jimin' ? 8e9 : 1e9 * Math.max(0.2, size / 120)),
      members: id === 'jimin' ? ({ showa: 3000000, heisei_early: 2000000, heisei: 1200000, reiwa: 1000000 }[era] || 1000000) : Math.round(size * 1500 + 20000),
    });
    staffParty(p, party, fy, size);
  }
  // Diet
  const sr = shugiRules(year - 1, p.flags);
  p.diet.shugi = { total: sumSeats(E.shugi), seats: { ...E.shugi }, system: sr.system, last: absOf(p, E.shugiLast[0], E.shugiLast[1], 8), termEnd: absOf(p, E.shugiLast[0] + 4, E.shugiLast[1], 8), dissolved: false };
  const [y1, y2] = E.sangiClasses;
  const r1 = sangiRules(y1[0]).half;
  const [cA, cB] = splitSeats(E.sangi, Math.min(r1, sumSeats(E.sangi) - 1));
  p.diet.sangi = { total: sumSeats(E.sangi), seats: { ...E.sangi }, classes: [{ year: y1[0], seats: cA }, { year: y2[0], seats: cB }], last: absOf(p, y2[0], y2[1], 10) };
  // speakers
  for (const [post, house] of [['speaker_shugi', 'shugi'], ['speaker_sangi', 'sangi'], ['chair_budget', 'shugi']]) {
    const n = newNpc(p, { party: E.coalition[0], house, office: house, wins: irnd(8, 14), age: irnd(62, 78) });
    n.posts.push(post);
    p.flags[post] = n.id;
  }
  // local
  p.local = {
    kugi: { total: sumSeats(E.kugi), seats: { ...E.kugi }, termEnd: absOf(p, E.kugiNext[0], E.kugiNext[1], 20) },
    togi: { total: sumSeats(E.togi), seats: { ...E.togi }, termEnd: absOf(p, E.togiNext[0], E.togiNext[1], 20) },
    kucho: { holder: newNpc(p, { party: IND, office: 'shicho', wins: irnd(1, 3), age: irnd(55, 70) }).id, backers: [E.coalition[0]], termEnd: absOf(p, E.kuchoNext[0], E.kuchoNext[1], 20) },
    chiji: { holder: newNpc(p, { party: IND, office: 'chiji', wins: irnd(1, 3), age: irnd(55, 72), charisma: irnd(60, 90) }).id, backers: [E.coalition[0]], termEnd: absOf(p, E.chijiNext[0], E.chijiNext[1], 10) },
  };
  // economy & opinion
  p.economy = newEconomy(p, E, year);
  seedSupport(p, E.support, fy);
  for (const a of AREA_ORDER) p.opinion.issues[a] = baseSalience(a, year);
  // cabinet
  const coalition = E.coalition.filter((id) => p.parties[id]);
  p.cabinet = { pm: p.parties[coalition[0]].leader, partyIds: coalition, ministers: {}, approval: rnd(42, 55), formed: day - irnd(30, 300), honeymoon: 0, mood: 0, scandal: 0, lowWeeks: 0, history: [] };
  // the number (代) of the PM in office at the start; each 首班指名 adds one
  p.flags.pmNo = PM_NO[era] || 100;
  seedInForce(p);
  p.flags.nejire = nejireNow(p);
  fillCabinet(g, p, { quiet: true });
  refreshOpinion(p, g);
  for (const id of Object.keys(p.parties)) { const v = num(E.support[id]) / Math.max(0.1, Object.values(E.support).reduce((a, b) => a + b, 0)); p.parties[id].voteShare = { shugi: v, sangi: v }; }
  for (const id of Object.keys(p.parties)) scheduleLeader(p, id, abs, true);
  // the calendar so far this year (the game starts in April: the budget has passed, the
  // ordinary session is under way)
  const doy = doyOfAbs(abs);
  p.flags.yearDone = year;
  if (doy >= 30) p.flags.fiscalYear = year;
  if (doy >= 29) p.flags.reportYear = year;
  if (doy >= 2) p.flags.ordinaryYear = year;
  if (doy >= 100) p.flags.extraYear = year;
  if (g.state) g.state.politics = p;
  subsidyYear(g, p, year);
  if (doy >= 2 && doy < 50) {
    p.diet.session = { kind: SESSION_KINDS.ordinary, start: day - (doy - 2), end: day + (52 - doy), extended: false };
    cabinetBills(g, p);
    p.diet.bills = p.diet.bills.filter((b) => b.kind !== 'budget' || b.policy); // the year's budget has passed
  }
  scheduleElections(g, p);
  p.lastTick = day - 1;
  realSync(g, p); // [R14-P]
  return p;
}

// Laws already in force when the era starts (ERA_POLITICS.inForce): recorded in p.flags.inForce
// { policyId: year } plus the flags the policies' own checks read.
const IN_FORCE_FLAGS = { furusato_tax: 'furusato', reduced_rate: 'reducedRate', free_childcare: 'freeChildcare', smoking_ban: 'smokeBan', gentan_end: 'gentanEnd' };
// taxPlan: a 消費税 rate already set by law for a later date (heisei_early: 5% from 1997-04, decided
// in 1994-11), carried out by history() unless the rate is already that high.
function seedInForce(p) {
  if (p.flags.inForce && typeof p.flags.inForce === 'object') return;
  const E = eraPolitics(p.era);
  if (E.taxPlan && p.cal && (p.cal.year < E.taxPlan.year || (p.cal.year === E.taxPlan.year && p.cal.month < E.taxPlan.month))) p.flags.taxPlan = { ...E.taxPlan };
  p.flags.inForce = { ...(E.inForce || {}) };
  for (const id of Object.keys(p.flags.inForce)) if (IN_FORCE_FLAGS[id]) p.flags[IN_FORCE_FLAGS[id]] = true;
}
// Older saves / hand edits: fill what is missing and make numbers numbers.
function normalizePolitics(g, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return newPoliticsState(g);
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  // the world itself is broken: start it again, keeping the player's own record
  if (!obj(p.cal) || !obj(p.parties) || !Object.keys(p.parties).length || !obj(p.diet) || !obj(p.diet.shugi) || !obj(p.diet.sangi) || !obj(p.economy) || !obj(p.cabinet) || !obj(p.local) || !obj(p.local.kugi) || !obj(p.npcs)) {
    const keep = obj(p.me) ? p.me : null;
    const fresh = newPoliticsState(g);
    if (keep) {
      fresh.me = { ...newMe(), ...keep };
      if (fresh.me.party && !fresh.parties[fresh.me.party]) fresh.me.party = null;
      fresh.me.posts = Array.isArray(keep.posts) ? keep.posts.filter((x) => POSTS[x] && POSTS[x].kind !== 'cabinet') : [];
      if (fresh.me.office === 'shugi' || fresh.me.office === 'sangi') { const H = fresh.diet[fresh.me.office]; const id = fresh.me.party || IND; H.seats[id] = num(H.seats[id]) + 1; H.total = sumSeats(H.seats); }
    }
    return normalizePolitics(g, fresh);
  }
  p.v = POL_STATE_VERSION;
  p.me = { ...newMe(), ...(p.me && typeof p.me === 'object' ? p.me : {}) };
  const me = p.me;
  for (const k of ['funds', 'secret', 'staff', 'reputation', 'localSupport', 'wins', 'losses', 'nationalWins', 'standing', 'kouenkai', 'exposed', 'ministerDays', 'pmDays']) me[k] = num(me[k], k === 'standing' ? 30 : k === 'localSupport' ? 5 : 0);
  me.reputation = clamp(me.reputation, -100, 100);
  me.localSupport = clamp(me.localSupport, 0, 100);
  me.standing = clamp(me.standing, 0, 100);
  if (!Array.isArray(me.posts)) me.posts = [];
  if (!Array.isArray(me.offers)) me.offers = [];
  if (!Array.isArray(me.history)) me.history = [];
  for (const k of ['votes', 'ledger', 'reported', 'lastAct']) if (!me[k] || typeof me[k] !== 'object') me[k] = {};
  if (!me.attend || typeof me.attend !== 'object') me.attend = { last: 0, absent: 0, days: 0 };
  for (const k of ['flags', 'npcs', 'local', 'support']) if (!p[k] || typeof p[k] !== 'object') p[k] = k === 'support' ? { base: {}, mods: {} } : {};
  if (!p.support.base || !Object.keys(p.support.base).length) seedSupport(p, eraPolitics(p.era).support, fyNow(g));
  if (!p.support.mods) p.support.mods = {};
  seedInForce(p);
  if (!p.opinion || typeof p.opinion !== 'object') p.opinion = { issues: {} };
  if (!p.opinion.issues) p.opinion.issues = {};
  if (!p.elections || !Array.isArray(p.elections.upcoming)) p.elections = { upcoming: [], history: [] };
  if (!Array.isArray(p.elections.history)) p.elections.history = [];
  if (!Array.isArray(p.diet.bills)) p.diet.bills = [];
  if (!Array.isArray(p.laws)) p.laws = [];
  if (!Array.isArray(p.polls)) p.polls = [];
  if (!Array.isArray(p.news)) p.news = [];
  for (const h of ['shugi', 'sangi']) {
    const H = p.diet[h];
    if (!H.seats || typeof H.seats !== 'object') H.seats = {};
    for (const k of Object.keys(H.seats)) H.seats[k] = Math.max(0, Math.round(num(H.seats[k])));
    H.total = sumSeats(H.seats);
  }
  if (!Array.isArray(p.diet.sangi.classes) || p.diet.sangi.classes.length !== 2) {
    const [a, b] = splitSeats(p.diet.sangi.seats, Math.floor(p.diet.sangi.total / 2));
    p.diet.sangi.classes = [{ year: calYear(g) - 3, seats: a }, { year: calYear(g), seats: b }];
  }
  const E = p.economy;
  const base = newEconomy(p, eraPolitics(p.era), yearOfAbs(p, absOfDay(p, today(g))));
  for (const k of ['growth', 'inflation', 'unemployment', 'debtRatio', 'yen', 'nikkei', 'gdp', 'taxRate', 'defense']) E[k] = num(E[k], base[k]);
  if (!E.budget || typeof E.budget !== 'object') E.budget = base.budget;
  if (!Array.isArray(E.shocks)) E.shocks = [];
  if (!E.base || typeof E.base !== 'object') E.base = base.base;
  const C = p.cabinet;
  C.approval = clamp(num(C.approval, 45), 1, 95);
  if (!Array.isArray(C.partyIds)) C.partyIds = [];
  if (!C.ministers || typeof C.ministers !== 'object') C.ministers = {};
  if (!Array.isArray(C.history)) C.history = [];
  for (const k of ['honeymoon', 'mood', 'scandal', 'lowWeeks']) C[k] = num(C[k]);
  // round 4 (old saves): the speech record and the 復興 record
  speechState(p);
  if (p.fukko != null && (typeof p.fukko !== 'object' || Array.isArray(p.fukko) || !p.fukko.id)) p.fukko = null;
  if (p.fukko) { const F = p.fukko; for (const k of ['done', 'last']) if (!F[k] || typeof F[k] !== 'object') F[k] = {}; if (!Array.isArray(F.log)) F.log = []; F.progress = clamp(num(F.progress), 0, 100); F.works = num(F.works); }
  if (!Array.isArray(p.fukkoHist)) p.fukkoHist = [];
  // an old save may still have the party that once took over the 民主党's members ('kakehashi'): it is
  // no longer in the game (no fictional party stands in for a real one), so it leaves like the 民主党
  for (const id of Object.keys(p.parties)) {
    const pt = p.parties[id];
    if (PARTY_DEFS[id] || !pt || pt.isPlayers || /^my\d+$/.test(id) || /^sp\d+$/.test(id)) continue;
    if (!p.diet || !p.diet.sangi || !Array.isArray(p.diet.sangi.classes) || !p.cabinet || !p.local) continue;
    const wasMember = p.me.party === id;
    try { retireParty(g, p, id, '与党の再編'); } catch (e) { console.error(e); continue; }
    news(p, g, `${pt.name}は活動を終え、所属議員は無所属になったり、ほかの党に移ったりした`);
    if (wasMember) note(g, `（${pt.name}は活動を終えた。あなたは無所属になった。入りたい党があれば「政治」→政党から）`);
  }
  return p;
}

// ================================================================ opinion
function partyAffinity(p, seg, partyId) {
  const party = p.parties[partyId];
  if (!party) return 0;
  const S = SEGMENTS[seg].ideo;
  const a = party.ideology || {};
  const d = Math.abs(S.econ - num(a.econ)) + Math.abs(S.social - num(a.social)) * 0.8 + Math.abs(S.security - num(a.security)) * 0.6;
  return 1.2 - d * 0.35 + ((SEG_BONUS[seg] || {})[partyId] || 0);
}
// National shares (party -> 0..1, the rest supports no party) spread over the segments.
function seedSupport(p, nat, fy) {
  const W = segWeights(Math.floor(fy));
  const ids = Object.keys(p.parties);
  const natSum = ids.reduce((a, id) => a + num(nat[id]), 0);
  const noneTarget = clamp(1 - natSum, 0.1, 0.9);
  const noneNat = SEGMENT_ORDER.reduce((a, s) => a + W[s] * SEG_NONE[s], 0);
  const base = {};
  for (const s of SEGMENT_ORDER) {
    base[s] = {};
    const none = clamp(SEG_NONE[s] * (noneTarget / noneNat), 0.05, 0.95);
    let tot = 0;
    for (const id of ids) { base[s][id] = num(nat[id], 0.003) * Math.exp(1.1 * partyAffinity(p, s, id)); tot += base[s][id]; }
    for (const id of ids) base[s][id] = tot ? (base[s][id] / tot) * (1 - none) : 0;
  }
  for (let it = 0; it < 4; it++) {
    for (const id of ids) {
      const cur = SEGMENT_ORDER.reduce((a, s) => a + W[s] * base[s][id], 0);
      const k = cur > 0 ? num(nat[id], 0.003) / cur : 1;
      for (const s of SEGMENT_ORDER) base[s][id] *= k;
    }
    for (const s of SEGMENT_ORDER) {
      const tot = ids.reduce((a, id) => a + base[s][id], 0);
      const cap = 0.95;
      if (tot > cap) for (const id of ids) base[s][id] *= cap / tot;
    }
  }
  p.support.base = base;
  p.support.mods = p.support.mods || {};
}
const isRuling = (p, id) => (p.cabinet.partyIds || []).includes(id);
// Recompute p.opinion[seg][party] (shares, 'none' = 支持なし) from base + mods + the cabinet.
function refreshOpinion(p, g) {
  const ids = Object.keys(p.parties);
  const appr = num(p.cabinet.approval, 45);
  for (const s of SEGMENT_ORDER) {
    const row = {};
    let tot = 0;
    for (const id of ids) {
      let v = num(p.support.base[s] && p.support.base[s][id]) + num(p.support.mods[s] && p.support.mods[s][id]);
      if (isRuling(p, id)) v *= 1 + (appr - 45) / 160;
      if (p.parties[id].leader === 'player' && g && g.state) v += Math.min(0.06, Math.log10(1 + num(g.state.fame)) * 0.01) * (p.parties[id].isPlayers ? 1 : 0.4);
      row[id] = Math.max(0, v);
      tot += row[id];
    }
    if (tot > 0.95) for (const id of ids) row[id] *= 0.95 / tot;
    row.none = Math.max(0.05, 1 - ids.reduce((a, id) => a + row[id], 0));
    p.opinion[s] = row;
  }
}
// National support of a party (0..1) and of no party.
function natSupport(p, id, fy) {
  const W = segWeights(Math.floor(fy || p.cal.year));
  return SEGMENT_ORDER.reduce((a, s) => a + W[s] * num(p.opinion[s] && p.opinion[s][id]), 0);
}
// Shift a segment's support of a party (delta in share points, e.g. 0.01 = 1%).
function addSupport(p, seg, id, d) {
  if (!p.parties[id] || !SEGMENTS[seg]) return;
  const m = p.support.mods[seg] || (p.support.mods[seg] = {});
  m[id] = clamp(num(m[id]) + d, -0.3, 0.3);
}
function addSupportAll(p, id, d) { for (const s of SEGMENT_ORDER) addSupport(p, s, id, d); }
function baseSalience(area, year) {
  const hi = { economy: 0.7, welfare: 0.6, tax: 0.5, finance: 0.3, childcare: year >= 2000 ? 0.5 : 0.2, diplomacy: 0.35, admin: year < 1996 ? 0.5 : 0.3, safety: 0.25, health: 0.4, labor: 0.35, energy: year >= 2011 ? 0.4 : 0.2, environment: 0.25, agriculture: 0.2, regional: 0.3, constitution: 0.15, digital: year >= 2015 ? 0.25 : 0.05, disaster: 0.2, culture: 0.1, education: 0.3, society: year >= 2010 ? 0.2 : 0.05 };
  return hi[area] ?? 0.2;
}

// ================================================================ economy
function ecoTrend(fy) {
  if (fy < 1990) return { growth: 4.5, inflation: 1.0, unemployment: 2.5, yen: 140, drift: 0.22 };
  if (fy < 1992) return { growth: 3.0, inflation: 2.5, unemployment: 2.2, yen: 140, drift: -0.25 };
  if (fy < 1997) return { growth: 1.2, inflation: 0.5, unemployment: 2.9, yen: 105, drift: -0.04 };
  if (fy < 2000) return { growth: 0.2, inflation: 0.3, unemployment: 4.2, yen: 120, drift: -0.06 };
  if (fy < 2008) return { growth: 1.3, inflation: -0.2, unemployment: 4.7, yen: 115, drift: 0.02 };
  if (fy < 2010) return { growth: -1.5, inflation: 0.0, unemployment: 5.0, yen: 95, drift: -0.15 };
  if (fy < 2013) return { growth: 0.8, inflation: -0.3, unemployment: 4.5, yen: 82, drift: -0.02 };
  if (fy < 2020) return { growth: 1.0, inflation: 0.7, unemployment: 3.0, yen: 110, drift: 0.09 };
  if (fy < 2024) return { growth: 0.6, inflation: 1.5, unemployment: 2.7, yen: 130, drift: 0.07 };
  return { growth: 0.7, inflation: 2.3, unemployment: 2.5, yen: 150, drift: 0.06 };
}
// Shares of the 一般会計 by area (国債費 = finance, 交付税+公共事業 = regional).
const BUDGET_SHARES = {
  1987: { welfare: 0.19, finance: 0.20, regional: 0.30, diplomacy: 0.07, education: 0.09, economy: 0.05, agriculture: 0.04, other: 0.06 },
  2026: { welfare: 0.32, finance: 0.255, regional: 0.21, diplomacy: 0.078, education: 0.045, economy: 0.03, agriculture: 0.015, other: 0.057 },
};
function budgetItems(spending, year) {
  const a = BUDGET_SHARES[1987], b = BUDGET_SHARES[2026];
  const t = clamp((year - 1987) / (2026 - 1987), 0, 1);
  const items = {};
  for (const k of Object.keys(a)) items[k] = Math.round((a[k] + (b[k] - a[k]) * t) * spending * 10) / 10;
  return items;
}
function newEconomy(p, E, year) {
  const e = E.eco;
  return {
    growth: e.growth, inflation: e.inflation, unemployment: e.unemployment, debtRatio: e.debtRatio, yen: e.yen, nikkei: e.nikkei, gdp: e.gdp, taxRate: e.taxRate,
    defense: year < 2023 ? 1.0 : 1.4,
    budget: { year, revenue: e.revenue, spending: e.spending, deficit: Math.round((e.spending - e.revenue - e.spending * 0.07) * 10) / 10, items: budgetItems(e.spending, year), passed: true, provisional: false },
    base: { gdp: e.gdp, revenue: e.revenue, spending: e.spending, taxRate: e.taxRate, year },
    shocks: [], history: [],
  };
}
// The deficit as % of GDP and the pressure it puts on the economy (0..1).
const deficitRatio = (E) => (num(E.budget && E.budget.deficit) / Math.max(50, num(E.gdp, 500))) * 100;
const fiscalPressure = (E) => clamp((deficitRatio(E) - 8) / 10, 0, 1) * (num(E.debtRatio) > 150 ? 1 : 0.5);
// Active laws' economic effect today (each law fades out after `lasting` years).
function lawEconomy(p, abs) {
  const out = { growth: 0, inflation: 0, unemployment: 0, yen: 0 };
  for (const L of p.laws) {
    const fx = L.economy || {};
    const age = abs - num(L.abs);
    const life = Math.max(0.5, num(L.lasting, 3)) * YEAR_DAYS;
    if (age < 0) continue;
    const ramp = Math.min(1, age / 30);
    const fade = age > life ? Math.max(0, 1 - (age - life) / 60) : 1;
    const k = ramp * fade;
    if (k <= 0) continue;
    for (const key of Object.keys(out)) out[key] += num(fx[key]) * k;
  }
  return out;
}
function economyDay(g, p, abs) {
  const E = p.economy;
  const fy = fyOfAbs(p, abs);
  const T = ecoTrend(fy);
  const L = lawEconomy(p, abs);
  const sh = { growth: 0, inflation: 0, unemployment: 0, yen: 0 };
  E.shocks = E.shocks.filter((s) => abs < num(s.until));
  for (const s of E.shocks) {
    const left = (num(s.until) - abs) / Math.max(1, num(s.len, 60));
    for (const k of Object.keys(sh)) sh[k] += num(s[k]) * clamp(left, 0, 1);
  }
  const cycle = Math.sin((abs / YEAR_DAYS) * Math.PI * 0.5) * 0.4;
  // ext (review): a very large deficit worries the bond market (金利・円安・物価), more so when the
  // debt is already high. Zero at today's deficits (about 5-7% of GDP).
  const fiscal = fiscalPressure(E);
  const gT = T.growth + L.growth + sh.growth + cycle - fiscal * 0.3;
  E.growth += (gT - E.growth) * 0.08 + gauss() * 0.03;
  const iT = T.inflation + L.inflation + sh.inflation + 0.3 * (E.growth - T.growth) + (E.yen - T.yen) * 0.008 + fiscal * 0.6;
  E.inflation += (iT - E.inflation) * 0.06 + gauss() * 0.02;
  const uT = T.unemployment + L.unemployment + sh.unemployment - 0.35 * (E.growth - T.growth);
  E.unemployment += (uT - E.unemployment) * 0.05 + gauss() * 0.01;
  const yT = T.yen + L.yen + sh.yen + fiscal * 12;
  E.yen += (yT - E.yen) * 0.015 + gauss() * 0.6;
  const ret = (T.drift + (E.growth - T.growth) * 0.03 + (E.inflation > 4 ? -0.05 : 0)) / YEAR_DAYS + gauss() * 0.011;
  E.nikkei *= Math.exp(clamp(ret, -0.15, 0.15));
  E.gdp *= 1 + (E.growth + E.inflation) / 100 / YEAR_DAYS;
  const B = E.budget;
  E.debtRatio += (num(B.deficit) / Math.max(50, E.gdp)) * 100 / YEAR_DAYS - (E.debtRatio * ((E.growth + E.inflation) / 100)) / YEAR_DAYS;
  E.growth = clamp(E.growth, -8, 10);
  E.inflation = clamp(E.inflation, -3, 15);
  E.unemployment = clamp(E.unemployment, 1.5, 12);
  E.yen = clamp(E.yen, 70, 260);
  E.nikkei = clamp(E.nikkei, 3000, 300000);
  E.debtRatio = clamp(E.debtRatio, 20, 600);
}
// The yearly budget (each fiscal year from April): the base grows with the economy, laws add their cost.
function compileBudget(p, abs) {
  const E = p.economy;
  const year = yearOfAbs(p, abs);
  const b0 = E.base;
  const scale = E.gdp / Math.max(50, b0.gdp);
  let spending = b0.spending * Math.pow(1.012, Math.max(0, year - b0.year)) * (0.6 + 0.4 * scale);
  let revenue = b0.revenue * scale + 2.6 * (E.taxRate - b0.taxRate) * (E.gdp / 600);
  const items = budgetItems(spending, year);
  for (const L of p.laws) {
    const life = Math.max(1, num(L.lasting, 3));
    const one = num(L.lasting, 3) <= 1;
    const yearsIn = (abs - num(L.abs)) / YEAR_DAYS;
    if (one && yearsIn > 1) continue;
    if (!one && yearsIn > life + 20) continue;
    const c = num(L.cost);
    if (!c) continue;
    const def = POLICIES[L.policy];
    if (def && def.area === 'tax') { if (!/shohizei/.test(L.policy)) revenue -= c; } else {
      spending += c;
      const k = def && items[def.area] != null ? def.area : (def && ['welfare', 'health', 'childcare'].includes(def.area) ? 'welfare' : 'other');
      items[k] = Math.round(((items[k] || 0) + c) * 10) / 10;
    }
  }
  spending = Math.max(20, spending);
  revenue = Math.max(10, revenue);
  const other = spending * 0.07;
  E.budget = { year, revenue: Math.round(revenue * 10) / 10, spending: Math.round(spending * 10) / 10, deficit: Math.round((spending - revenue - other) * 10) / 10, items, passed: false, provisional: false };
  return E.budget;
}
// 兆円 for national figures (never converted by the era's price level).
export const fmtCho = (n) => `${(Math.round(num(n) * 10) / 10).toLocaleString('ja-JP')}兆円`;

// ================================================================ elections: schedule
// ELECTION = { id, kind, day (投票日, game day), koji (公示・告示の日), status: 'scheduled' | 'campaign' |
//   'done', label, district?, seats?, party? (sosaisen), house? (hosen), declared: { player? }, year }
export const ELECTION_KINDS = {
  shugi: { name: '衆議院議員総選挙', short: '衆院選', office: 'shugi', campaignDays: 12 },
  sangi: { name: '参議院議員通常選挙', short: '参院選', office: 'sangi', campaignDays: 17 },
  chiji: { name: '東京都知事選挙', short: '都知事選', office: 'chiji', campaignDays: 17 },
  shicho: { name: 'ドット区長選挙', short: '区長選', office: 'shicho', campaignDays: 7 },
  kugi: { name: 'ドット区議会議員選挙', short: '区議選', office: 'kugi', campaignDays: 7 },
  togi: { name: '東京都議会議員選挙', short: '都議選', office: 'togi', campaignDays: 9 },
  hosen: { name: '補欠選挙', short: '補選', office: null, campaignDays: 12 },
  sosaisen: { name: '党首選挙', short: '党首選', office: null, campaignDays: 12 },
  touitsu: { name: '統一地方選挙', short: '統一地方選', office: null, campaignDays: 9, newsOnly: true }, // ext
};
const kojiDays = (realDays) => Math.max(2, Math.ceil(realDays / 3));
const HOME_DISTRICT = { shugi: '東京ドット区', shugiChu: '東京ドット区（定数4）', sangi: '東京都選挙区', kugi: 'ドット区', togi: 'ドット区選挙区', shicho: 'ドット区', chiji: '東京都' };
const prefShort = (id) => String((PREFECTURES[id] || PREFECTURES.tokyo).name).replace(/[都府県]$/, '');

function addElection(p, def) {
  const dupe = p.elections.upcoming.find((e) => e.kind === def.kind && e.status !== 'done' && (e.party || null) === (def.party || null) && (e.house || null) === (def.house || null) && (def.kind !== 'hosen' || e.district === def.district));
  if (dupe) return dupe;
  const K = ELECTION_KINDS[def.kind];
  const kd = kojiDays(def.campaignDays || K.campaignDays);
  const min = Math.max(def.min || 1, num(p.lastTick, 0) + kd + 1);
  const day = def.exact ? Math.max(1, Math.round(def.day)) : nearSunday(Math.max(def.day, min), min);
  const e = {
    id: 'e' + p.nextId++, kind: def.kind, day, koji: day - kd, status: 'scheduled',
    label: def.label || K.name, district: def.district || null, seats: def.seats || null, party: def.party || null, house: def.house || null,
    reason: def.reason || null, declared: {}, year: null, vacancy: def.vacancy || null,
  };
  p.elections.upcoming.push(e);
  p.elections.upcoming.sort((a, b) => a.day - b.day);
  return e;
}
function electionLabel(p, e) {
  const y = yearOfAbs(p, absOfDay(p, e.day));
  e.year = y;
  if (e.kind === 'shugi') return `第${num(p.flags.shugiNo, 50) + 1}回 衆議院議員総選挙`;
  if (e.kind === 'sangi') return `第${Math.floor((y - 1947) / 3) + 1}回 参議院議員通常選挙`;
  if (e.kind === 'touitsu') return `第${Math.floor((y - 1947) / 4) + 1}回 統一地方選挙`;
  if (e.kind === 'sosaisen') { const pt = p.parties[e.party]; return `${pt ? pt.name : ''}${postName('party_leader', y, e.party)}選挙`; }
  if (e.kind === 'hosen') return `${e.house === 'sangi' ? '参議院' : '衆議院'}${e.district}補欠選挙`;
  return ELECTION_KINDS[e.kind].name;
}
// Keep the next election of every recurring kind on the calendar.
function scheduleElections(g, p) {
  const day = today(g);
  const abs = absOfDay(p, day);
  const up = (k) => p.elections.upcoming.some((e) => e.kind === k && e.status !== 'done');
  if (p.flags.shugiNo == null) p.flags.shugiNo = { showa: 38, heisei_early: 40, heisei: 43, reiwa: 51 }[p.era] || 50;
  if (!up('shugi') && !p.diet.shugi.dissolved) {
    const d = Math.max(day + 6, dayOfAbs(p, num(p.diet.shugi.termEnd) - 8));
    addElection(p, { kind: 'shugi', day: d, reason: '任期満了' });
  }
  if (!up('sangi')) {
    const lastClass = Math.max(...p.diet.sangi.classes.map((c) => num(c.year)));
    let y = lastClass + 3;
    while (dayOfAbs(p, absOf(p, y, 7, 10)) <= day) y += 3;
    addElection(p, { kind: 'sangi', day: dayOfAbs(p, absOf(p, y, 7, 10)) });
  }
  for (const [k, kind] of [['kugi', 'kugi'], ['togi', 'togi'], ['kucho', 'shicho'], ['chiji', 'chiji']]) {
    if (up(kind)) continue;
    const L = p.local[k];
    let t = num(L.termEnd, abs + YEAR_DAYS);
    while (dayOfAbs(p, t) <= day + 2) t += 4 * YEAR_DAYS;
    L.termEnd = t;
    addElection(p, { kind, day: dayOfAbs(p, t) - 3 });
  }
  if (!up('touitsu')) {
    let y = Math.max(yearOfAbs(p, abs), num(p.flags.touitsuYear, 0) + 1);
    while ((y - 1947) % 4 !== 0 || dayOfAbs(p, absOf(p, y, 4, 22)) <= day) y++;
    addElection(p, { kind: 'touitsu', day: dayOfAbs(p, absOf(p, y, 4, 22)) });
  }
  for (const id of Object.keys(p.parties)) {
    const pt = p.parties[id];
    // the player's own party has no race; a party the player leads but did not found does
    if (pt.isPlayers) continue;
    if (pt.leaderNext != null && !p.elections.upcoming.some((e) => e.kind === 'sosaisen' && e.party === id && e.status !== 'done')) {
      addElection(p, { kind: 'sosaisen', party: id, day: Math.max(day + 5, dayOfAbs(p, pt.leaderNext)) });
    }
  }
  for (const e of p.elections.upcoming) if (!e.year) e.label = electionLabel(p, e);
}
// Party leadership terms: 自民 2 years (3 from 2002), others 2-3 years (目安). first: spread the
// first election over the term so they do not all fall on day 1.
function scheduleLeader(p, id, abs, first = false) {
  const pt = p.parties[id];
  if (!pt || pt.isPlayers) return;
  const y = yearOfAbs(p, abs);
  const term = id === 'jimin' ? (y >= 2002 ? 3 : 2) : id === 'minshu' ? 2 : 3;
  const at = first ? abs + irnd(20, term * YEAR_DAYS) : abs + term * YEAR_DAYS;
  // 自民党総裁選 is usually in September (doy 80-89)
  pt.leaderNext = id === 'jimin' ? absOf(p, yearOfAbs(p, at), 9, 15) + (doyOfAbs(at) > 85 ? YEAR_DAYS : 0) : at;
}

// ================================================================ elections: votes
const KIND_FAME = { kugi: 0.8, togi: 0.9, shicho: 1.15, chiji: 1.4, shugi: 1.0, sangi: 1.3, hosen: 1.0, sosaisen: 0.7 };
// Turnout (目安) by kind and era; the segment mix moves it a little.
function baseTurnout(kind, year) {
  const T = { shugi: [[1990, 0.71], [1996, 0.6], [2003, 0.6], [2009, 0.68], [2014, 0.55], [9999, 0.55]], sangi: [[1992, 0.62], [2001, 0.5], [2010, 0.57], [9999, 0.52]] };
  const row = T[kind === 'hosen' ? 'shugi' : kind] || null;
  if (!row) return kind === 'chiji' ? 0.55 : kind === 'togi' ? 0.45 : 0.42;
  for (const [y, v] of row) if (year < y) return kind === 'hosen' ? v * 0.75 : v;
  return 0.55;
}
// Party shares among voters of a district profile ('urban' | 'rural' | 'mixed'):
// { parties: { id: share }, none, turnout }.
function districtShares(p, profile, fy, kind) {
  const W = segWeights(Math.floor(fy));
  const out = {};
  let tw = 0, none = 0, turn = 0;
  for (const s of SEGMENT_ORDER) {
    const m = profile === 'urban' ? SEGMENTS[s].urban : profile === 'rural' ? SEGMENTS[s].rural : 1;
    const w = W[s] * m;
    const t = SEGMENTS[s].turnout;
    const row = p.opinion[s] || {};
    for (const id of Object.keys(p.parties)) out[id] = (out[id] || 0) + w * t * num(row[id]);
    none += w * t * 0.75 * num(row.none);
    tw += w * t;
    turn += w * t;
  }
  for (const id of Object.keys(out)) out[id] /= tw;
  const avgT = turn / SEGMENT_ORDER.reduce((a, s) => a + W[s] * (profile === 'urban' ? SEGMENTS[s].urban : profile === 'rural' ? SEGMENTS[s].rural : 1), 0);
  return { parties: out, none: none / tw, turnout: clamp(baseTurnout(kind, Math.floor(fy)) * (avgT / 0.66), 0.2, 0.9) };
}
// National vote shares for a general election (parties only; sums to 1).
function nationalShares(g, p, fy, kind) {
  const d = districtShares(p, 'mixed', fy, kind);
  const v = {};
  let sum = 0;
  // supporters vote for their party with some loyalty; the rest and the 支持なし voters split
  // more evenly (they often prefer the opposition or a fresh face): weight ~ sqrt(support)
  const ids = Object.keys(p.parties);
  const LOYAL = 0.75;
  const pool = d.none + ids.reduce((a, id) => a + d.parties[id] * (1 - LOYAL), 0);
  const w = {};
  let ws = 0;
  // an unpopular cabinet sends the floating vote to the opposition (1993・2009 の政権交代)
  const sour = Math.max(0, 45 - num(p.cabinet.approval, 45)) / 50;
  for (const id of ids) {
    w[id] = Math.sqrt(Math.max(0.0005, d.parties[id])) * (isRuling(p, id) ? 0.8 - sour * 0.4 : 1.1 + sour);
    if (p.parties[id].leader === 'player') w[id] += Math.min(0.35, Math.log10(1 + num(g.state.fame)) * 0.06);
    ws += w[id];
  }
  for (const id of ids) {
    v[id] = Math.max(0, (d.parties[id] * LOYAL + pool * (w[id] / ws)) * Math.exp(gauss() * 0.08) * (1 + num(p.parties[id].campaign) * 0.002));
    sum += v[id];
  }
  for (const id of Object.keys(v)) v[id] = sum ? v[id] / sum : 0;
  return { share: v, turnout: d.turnout };
}
export function dhondt(votes, seats) {
  const out = {};
  const ids = Object.keys(votes).filter((k) => votes[k] > 0);
  for (const id of ids) out[id] = 0;
  for (let i = 0; i < seats && ids.length; i++) {
    let best = null, bq = -1;
    for (const id of ids) { const q = votes[id] / (out[id] + 1); if (q > bq) { bq = q; best = id; } }
    out[best]++;
  }
  return out;
}
// Allocate n seats proportionally to share^k (largest remainder).
function alloc(share, n, k = 1) {
  const ids = Object.keys(share).filter((id) => share[id] > 0);
  const pw = {};
  let s = 0;
  for (const id of ids) { pw[id] = Math.pow(share[id], k); s += pw[id]; }
  const out = {};
  let given = 0;
  const rem = [];
  for (const id of ids) { const q = s ? (pw[id] / s) * n : 0; out[id] = Math.floor(q); given += out[id]; rem.push([id, q - out[id]]); }
  rem.sort((a, b) => b[1] - a[1]);
  for (let i = 0; given < n && rem.length; i++, given++) out[rem[i % rem.length][0]]++;
  return out;
}
const addTo = (a, b) => { for (const [k, v] of Object.entries(b || {})) a[k] = (a[k] || 0) + num(v); return a; };

// The player's quality as a candidate (0.05..2): fame (タレント候補), fans, 地盤, the campaign,
// reputation, incumbency, talk skill, a hometown, recent scandals.
function playerQ(g, p, e, opts = {}) {
  const st = g.state, me = p.me;
  const fw = KIND_FAME[e.kind] ?? 1;
  // review: a name only counts once people know it (below ★100 almost nothing; ★2500 about half)
  const fameQ = 0.55 * clamp((Math.log10(1 + num(st.fame)) - 2) / 2.6, 0, 1.3) * fw;
  const fansQ = Math.min(0.15, (num(st.fans) / 2e6) * 0.15) * fw;
  const local = ['kugi', 'togi', 'shicho'].includes(e.kind) || (e.kind === 'shugi' && !opts.hometown);
  // 地元の支持 is the player's own ward (ドット区, Tokyo): a 補選 in another prefecture starts from
  // nothing (落下傘候補), the hometown keeps part of it
  const hosenPref = e.kind === 'hosen' ? ((e.vacancy && e.vacancy.pref) || 'tokyo') : null;
  const away = hosenPref && hosenPref !== 'tokyo' && !opts.hometown;
  const localQ = away ? 0 : (me.localSupport / 100) * 0.38 * (local ? 1 : opts.hometown ? 0.6 : hosenPref === 'tokyo' ? 0.6 : 0.4);
  const pts = num(me.campaign && me.campaign.election === e.id ? me.campaign.points : 0);
  const campQ = (0.42 * pts) / (pts + 55);
  const repQ = (me.reputation / 100) * 0.12;
  const off = ELECTION_KINDS[e.kind] && ELECTION_KINDS[e.kind].office;
  const incQ = (off && (me.office === off || me.formerOffice === off)) ? 0.12 : 0;
  const talkQ = (num(st.skills && st.skills.talk) / 100) * 0.08;
  const homeQ = opts.hometown ? 0.08 + Math.min(0.06, (st.fame || 0) / 50000) : 0;
  const scandal = me.scandalDay && today(g) - me.scandalDay < YEAR_DAYS ? -0.22 : 0;
  // the party organisation; a party with money behind its candidates (公認料・選挙資金) helps a little
  const ptF = me.party && p.parties[me.party] ? num(p.parties[me.party].funds) : 0;
  const org = me.party ? 0.05 + Math.min(0.05, me.standing / 1000) + 0.04 * clamp(ptF / 2e8, 0, 1) : 0;
  const kouenkai = Math.min(0.12, me.kouenkai / 3000);
  return clamp(0.12 + fameQ + fansQ + localQ + campQ + repQ + incQ + talkQ + homeQ + scandal + org + kouenkai, 0.05, 2.2);
}
// One race: candidates [{ id, name, party, Q, incumbent, isPlayer }], M seats.
// Returns candidates with votes (sorted) and the valid vote total.
function runRace(p, race) {
  const { candidates, M, electorate, profile, fy, kind } = race;
  const d = districtShares(p, profile, fy, kind);
  const turnout = clamp(d.turnout * (race.turnoutMult || 1), 0.15, 0.9);
  const valid = Math.round(electorate * turnout * 0.98);
  const byParty = {};
  for (const c of candidates) if (c.party && c.party !== IND) (byParty[c.party] || (byParty[c.party] = [])).push(c);
  let orphan = 0;
  const coalition = p.cabinet.partyIds || [];
  const partyPool = {};
  for (const id of Object.keys(p.parties)) {
    const sh = num(d.parties[id]);
    if (byParty[id]) partyPool[id] = (partyPool[id] || 0) + sh;
    else if (coalition.includes(id) && coalition.some((c) => byParty[c])) { const ally = coalition.find((c) => byParty[c]); partyPool[ally] = (partyPool[ally] || 0) + sh * 0.75; orphan += sh * 0.25; }
    else orphan += sh;
  }
  // a single-seat district has its own swing (地域の事情・候補者の評判): no party is a sure thing
  if (M === 1) for (const id of Object.keys(partyPool)) partyPool[id] *= Math.exp(gauss() * 0.15);
  // a very well-known candidate (c.cross) also draws voters who usually back other parties
  const star = candidates.find((c) => num(c.cross) > 0);
  let crossVotes = 0;
  // (a quarter as much in a multi-seat race, where other parties' voters have their own candidates)
  if (star) for (const id of Object.keys(partyPool)) if (id !== star.party) { const t = partyPool[id] * num(star.cross) * (M > 1 ? 0.25 : 1); partyPool[id] -= t; crossVotes += t; }
  const local = ['kugi', 'togi'].includes(kind);
  const exec = kind === 'chiji' || kind === 'shicho';
  const partyK = local ? 0.65 : 1;
  // 地方議員選: a third of party supporters vote for the person, not the label (they join the
  // personal pool). 首長選 are personal races: famous independents can win (都知事選 1995・1999)
  const partyLeft = local ? (1 - partyK) * Object.values(partyPool).reduce((a, v) => a + num(v), 0) : 0;
  const personal = (d.none + orphan * 0.5) * (local ? 1.6 : kind === 'chiji' ? 2.3 : kind === 'shicho' ? 1.7 : 1.0) + partyLeft + (race.personalExtra || 0);
  const qw = (c) => Math.pow(clamp(c.Q, 0.02, 1.7), M > 1 ? 1.0 : 1.3);
  const qs = candidates.reduce((a, c) => a + qw(c), 0) || 1;
  let tot = 0;
  for (const c of candidates) {
    let v = (qw(c) / qs) * personal;
    if (c.party && byParty[c.party]) {
      const mates = byParty[c.party];
      // 中選挙区・複数区: the party's organisation spreads its vote; in a 地方議員選 the candidates of one
      // party compete for it (後援会・どぶ板), so the candidate's own strength counts more (review)
      const base = M > 1 ? (local ? 0.6 : kind === 'sangi' ? 1.0 : 1.4) : 0.8;
      const qsum = mates.reduce((a, m) => a + base + clamp(m.Q, 0, 1.7), 0);
      v += partyK * num(partyPool[c.party]) * ((base + clamp(c.Q, 0, 1.7)) / qsum);
    }
    if (c.backers) for (const b of c.backers) if (p.parties[b] && !byParty[b]) v += partyK * num(d.parties[b]) * (exec ? 0.6 : 0.8) / Math.max(1, candidates.filter((x) => (x.backers || []).includes(b)).length);
    if (c === star) v += crossVotes;
    v *= Math.exp(gauss() * (race.noise ?? 0.1));
    c.raw = Math.max(0.0005, v);
    tot += c.raw;
  }
  for (const c of candidates) { c.votes = Math.round((c.raw / tot) * valid); c.share = c.votes / Math.max(1, valid); delete c.raw; }
  candidates.sort((a, b) => b.votes - a.votes);
  candidates.forEach((c, i) => { c.rank = i + 1; c.won = i < M; });
  return { candidates, valid, turnout };
}
// NPC candidates for a race.
// Candidates are light records (a fictional name); only winners of an executive or a Diet
// seat become NPCs (keeps saves small).
function npcCandidate(p, party, opts = {}) {
  const n = opts.npc || null;
  return { id: n ? n.id : null, name: n ? n.name : genName(), party, Q: opts.Q ?? (opts.incumbent ? rnd(0.45, 0.85) : rnd(0.2, 0.6)), incumbent: !!opts.incumbent, backers: opts.backers || null };
}
function fieldCandidates(p, M, fy, kind, opts = {}) {
  const nat = {};
  for (const id of Object.keys(p.parties)) nat[id] = natSupport(p, id, fy);
  const coalition = p.cabinet.partyIds || [];
  const list = [];
  const ids = Object.keys(p.parties).filter((id) => opts.exclude !== id).sort((a, b) => nat[b] - nat[a]);
  if (M === 1) {
    // opts.holder: the district's 現職 ({ party, npc }) runs for their party with a 現職's strength
    const hold = opts.holder && opts.holder.npc && opts.holder.npc !== 'player' && !opts.holder.open && p.npcs[opts.holder.npc] ? opts.holder : null;
    const cand = (id, inc) => (hold && hold.party === id ? npcCandidate(p, id, { incumbent: true, npc: p.npcs[hold.npc], Q: rnd(0.5, 0.9) }) : npcCandidate(p, id, { incumbent: hold ? false : inc }));
    const main = opts.skipCoalition ? null : coalition.filter((c) => p.parties[c] && c !== opts.exclude).sort((a, b) => nat[b] - nat[a])[0];
    if (main) list.push(cand(main, Math.random() < 0.6));
    for (const id of ids) if (!coalition.includes(id) && ((hold && hold.party === id) || (nat[id] >= 0.03 ? Math.random() < 0.9 : Math.random() < 0.25))) list.push(cand(id, Math.random() < 0.25));
    if (Math.random() < 0.4) list.push(npcCandidate(p, IND));
  } else {
    const field = Math.round(M * (kind === 'kugi' ? 1.45 : 1.5)) + 1;
    // parties field candidates by their share of the party vote (review: in a 地方議会 the parties
    // together put up more candidates than there are seats, so a party's weakest newcomer can lose)
    const k = kind === 'kugi' || kind === 'togi' ? 1.15 : kind === 'shugi' ? 1.1 : 0.85; // 地方議会・中選挙区 (同士討ち) field many; 参院の複数区は少なめ
    const natSum = ids.reduce((a, id) => a + Math.max(0, nat[id]), 0) || 1;
    for (const id of ids) {
      let n = Math.max(nat[id] > 0.02 ? 1 : 0, Math.round((nat[id] / natSum) * M * k * (id === 'jimin' ? 1.1 : 1)));
      if (opts.mine === id) n = Math.max(0, n - 1);
      for (let i = 0; i < Math.min(n, M); i++) list.push(npcCandidate(p, id, { incumbent: Math.random() < 0.55 }));
    }
    while (list.length < field) list.push(npcCandidate(p, IND, { Q: rnd(0.15, 0.55) }));
  }
  return list;
}

// ================================================================ district incumbents (ext, review)
// The 衆院小選挙区 the player can run in (東京ドット区 and the hometown's ドット区) each have a sitting
// member (現職). A party gives its 公認 to its own 現職, so a newcomer of that party is steered to
// 比例・参院・an open seat unless they stand very high; a rival party's 現職 is a stronger
// opponent. Holders change at general elections (retirement, defeat) and by-elections.
// p.flags.smdHolders = { home | <pref>: { party, npc: npcId | 'player', open?: bool } }
function smdKey(pref) { return !pref || pref === 'tokyo' ? 'home' : pref; }
function smdShares(p) {
  const H = p.diet.shugi.seats;
  const out = {};
  for (const id of Object.keys(p.parties)) if (num(H[id]) > 0) out[id] = Math.pow(num(H[id]), 1.4);
  return out;
}
function drawParty(w, exclude = null) {
  const ids = Object.keys(w).filter((id) => id !== exclude && w[id] > 0);
  const s = ids.reduce((a, id) => a + w[id], 0);
  let r = Math.random() * s;
  for (const id of ids) { r -= w[id]; if (r <= 0) return id; }
  return ids[0] || null;
}
function districtHolder(p, pref = 'tokyo', year = null) {
  if (year != null && shugiRules(year, p.flags).system === 'chusenkyoku') return null; // 中選挙区: several members
  const key = smdKey(pref);
  const all = p.flags.smdHolders || (p.flags.smdHolders = {});
  let h = all[key];
  const ok = h && p.parties[h.party] && (h.npc === 'player' ? p.me.office === 'shugi' || p.diet.shugi.dissolved : h.open ? true : !!(h.npc && p.npcs[h.npc]));
  if (!ok) {
    const party = (h && h.npc === 'player' && p.parties[h.party]) ? h.party : drawParty(smdShares(p)) || Object.keys(p.parties)[0];
    const label = key === 'home' ? HOME_DISTRICT.shugi : `${prefShort(pref)}ドット区`;
    const n = newNpc(p, { party, office: 'shugi', house: 'shugi', district: label, wins: irnd(1, 6), age: irnd(40, 72) });
    h = all[key] = { party, npc: n.id, open: false };
    if (key === 'home') p.flags.homeIncumbent = n.id;
  }
  return h;
}
// After a general election: the district's member is re-elected, retires or loses.
function updateHolders(g, p, oldSeats, decl, race) {
  const all = p.flags.smdHolders || (p.flags.smdHolders = {});
  for (const key of Object.keys(all)) {
    const h = all[key];
    const mine = decl && !decl.prOnly && smdKey(decl.hometown ? decl.pref : 'tokyo') === key && race;
    if (mine) {
      const w = race.candidates[0];
      if (w.isPlayer) all[key] = { party: w.party, npc: 'player', open: false };
      else { const n = (w.id && p.npcs[w.id]) || newNpc(p, { name: w.name, party: w.party, office: 'shugi', house: 'shugi', wins: w.incumbent ? irnd(2, 6) : 1 }); n.office = 'shugi'; all[key] = { party: w.party, npc: n.id, open: false }; }
    } else {
      const ratio = (num(p.diet.shugi.seats[h.party]) + 1) / (num(oldSeats[h.party]) + 1);
      const keep = clamp(0.62 + (ratio - 1) * 2, 0.15, 0.95);
      if (Math.random() >= keep) {
        const party = drawParty(smdShares(p), h.party) || h.party;
        const n = newNpc(p, { party, office: 'shugi', house: 'shugi', wins: 1, age: irnd(38, 60) });
        all[key] = { party, npc: n.id, open: false };
      } else if (h.npc === 'player') all[key] = { ...h, npc: null, open: true }; // the player stood elsewhere
    }
    // some members announce they will not stand again (引退): the next election is an open seat
    const cur = all[key];
    const n = cur.npc && cur.npc !== 'player' ? p.npcs[cur.npc] : null;
    if (n && Math.random() < (num(n.age) >= 72 ? 0.35 : 0.1)) cur.open = true;
    if (key === 'home') p.flags.homeIncumbent = cur.npc;
  }
}
// The 現職 of the player's party who would get the 公認 for this race (null = none / open seat).
function heldByParty(g, p, e, party, opts = {}) {
  if (!party || party === IND) return null;
  if (e.kind === 'shugi' && opts.proportional !== 'only') {
    const pref = opts.hometown && g.state.profile && PREFECTURES[g.state.profile.hometown] && g.state.profile.hometown !== 'tokyo' ? g.state.profile.hometown : 'tokyo';
    const h = districtHolder(p, pref, yearOfAbs(p, absOfDay(p, e.day)));
    if (!h || h.open || h.npc === 'player' || h.party !== party) return null;
    return p.npcs[h.npc] || null;
  }
  if (e.kind === 'shicho' || e.kind === 'chiji') {
    const L = p.local[e.kind === 'shicho' ? 'kucho' : 'chiji'];
    const n = L && L.holder && L.holder !== 'player' ? p.npcs[L.holder] : null;
    return n && (L.backers || []).includes(party) ? n : null;
  }
  return null;
}

// ================================================================ elections: run
const myDecl = (e) => (e && e.declared && e.declared.player) || null;
function electorateFor(kind, year, district) {
  const k = clamp((year - 1987) / (2026 - 1987), 0, 1);
  const lerp = (a, b) => Math.round(a + (b - a) * k);
  if (kind === 'kugi' || kind === 'shicho' || kind === 'togi') return lerp(230000, 280000);
  if (kind === 'chiji') return lerp(8900000, 11500000);
  if (kind === 'sangiTokyo') return lerp(8900000, 11500000);
  if (kind === 'chu') return lerp(1250000, 1300000);
  if (kind === 'sangiNational') return lerp(87000000, 104000000);
  return lerp(420000, 460000); // 小選挙区 (目安)
}
// 参院選挙区の改選数（目安: 大都市圏は複数区、ほとんどの県は1人区）and the size of a prefecture vs Tokyo.
const sangiPrefMagnitude = (pref) => (['osaka', 'kanagawa', 'aichi', 'saitama'].includes(pref) ? 4 : ['hokkaido', 'chiba', 'fukuoka', 'hyogo'] .includes(pref) ? 3 : ['ibaraki', 'shizuoka', 'kyoto', 'hiroshima'].includes(pref) ? 2 : 1);
const prefScale = (pref) => ({ osaka: 0.63, kanagawa: 0.66, aichi: 0.54, saitama: 0.53, hokkaido: 0.37, chiba: 0.45, fukuoka: 0.37, hyogo: 0.39, ibaraki: 0.21, shizuoka: 0.27, kyoto: 0.19, hiroshima: 0.2 }[pref] || 0.1);
// The 比例ブロック of a prefecture.
function blockOfPref(pref) {
  const r = (PREFECTURES[pref] || PREFECTURES.tokyo).region;
  if (pref === 'tokyo') return '東京';
  if (['ibaraki', 'tochigi', 'gunma', 'saitama'].includes(pref)) return '北関東';
  if (['chiba', 'kanagawa', 'yamanashi'].includes(pref)) return '南関東';
  if (['niigata', 'toyama', 'ishikawa', 'fukui', 'nagano'].includes(pref)) return '北陸信越';
  if (['gifu', 'shizuoka', 'aichi', 'mie'].includes(pref)) return '東海';
  return { hokkaido: '北海道', tohoku: '東北', kansai: '近畿', chugoku: '中国', shikoku: '四国', kyushu: '九州' }[r] || '東京';
}
const profileOfPref = (pref) => (['tokyo', 'osaka', 'kanagawa'].includes(pref) ? 'urban' : ['aichi', 'saitama', 'chiba', 'hyogo', 'fukuoka', 'kyoto', 'miyagi', 'hiroshima', 'hokkaido'].includes(pref) ? 'mixed' : 'rural');
// The player's race record (deposit, votes...) -> myResult.
function finishMine(g, p, e, decl, race, M, extra = {}) {
  const me = race ? race.candidates.find((c) => c.isPlayer) : null;
  const valid = race ? race.valid : 0;
  const system = e.system || 'heiritsu';
  const fkind = e.kind === 'hosen' && e.house === 'sangi' ? 'sangi' : e.kind;
  const lost = !!me && !extra.noForfeit && me.votes < valid * forfeitShare(fkind, M, system);
  const won = !!(me && me.won) || !!extra.won;
  // the deposit comes back unless forfeited (比例: paid by the party)
  if (decl && decl.deposit > 0) {
    if (!lost) { if (decl.depositFrom === 'funds') p.me.funds += decl.deposit; else g.state.money += decl.deposit; }
  }
  return { won, votes: me ? me.votes : num(extra.votes), rank: me ? me.rank : extra.rank || null, share: me ? me.share : extra.share || 0, depositLost: lost && decl && decl.deposit > 0, deposit: decl ? decl.deposit : 0, revived: !!extra.revived, pr: !!extra.pr, district: decl ? decl.district : null, party: decl ? decl.party : null };
}
function playerCandidate(g, p, e, decl) {
  const Q = playerQ(g, p, e, decl);
  // cross: the share of other parties' supporters a household name pulls (タレント候補の浮動票), max 20%
  return { id: 'player', name: g.state.profile ? `${g.state.profile.familyName} ${g.state.profile.givenName}` : g.state.name, party: decl.party || IND, Q, cross: clamp((Q - 0.9) * 0.35, 0, 0.2), isPlayer: true, incumbent: p.me.office === (ELECTION_KINDS[e.kind] || {}).office };
}
function winnersOf(race, M) {
  return race.candidates.slice(0, M).map((c) => ({ name: c.name, party: c.party, votes: c.votes, isPlayer: !!c.isPlayer, id: c.id || null }));
}
function topList(race, n = 10) {
  return race.candidates.slice(0, n).map((c) => ({ name: c.name, party: c.party, votes: c.votes, won: c.won, isPlayer: !!c.isPlayer }));
}

function runShugi(g, p, e, fy) {
  const year = Math.floor(fy);
  const R = shugiRules(year, p.flags);
  e.system = R.system;
  const decl = myDecl(e);
  const nat = nationalShares(g, p, fy, 'shugi');
  const snap = num(p.flags.snapTurnout, 1) || 1; // a snap election people did not want: lower turnout
  p.flags.snapTurnout = 1;
  nat.turnout *= snap;
  const coalition = (p.cabinet.partyIds || []).filter((id) => p.parties[id]);
  let seats = {};
  let race = null, my = null, tokyoPR = null;
  const inDistrict = decl && !decl.prOnly;
  if (R.system === 'chusenkyoku') {
    const M = R.myMagnitude;
    const rest = R.total - (inDistrict ? M : 0);
    const ind = Math.round(rest * rnd(0.02, 0.04));
    seats = alloc(nat.share, rest - ind, 1.25);
    seats[IND] = (seats[IND] || 0) + ind;
    if (inDistrict) {
      const cands = fieldCandidates(p, M, fy, 'shugi', { mine: decl.party });
      cands.push(playerCandidate(g, p, e, decl));
      race = runRace(p, { candidates: cands, M, electorate: electorateFor('chu', year), profile: decl.hometown ? profileOfPref(decl.pref) : 'urban', fy, kind: 'shugi', turnoutMult: snap });
      for (const w of winnersOf(race, M)) seats[w.party] = (seats[w.party] || 0) + 1;
      my = finishMine(g, p, e, decl, race, M);
    }
  } else {
    const smdRest = R.smd - (inDistrict ? 1 : 0);
    const bloc = { __coal: coalition.reduce((a, id) => a + num(nat.share[id]), 0) };
    for (const id of Object.keys(nat.share)) if (!coalition.includes(id)) bloc[id] = nat.share[id];
    const ind = Math.round(smdRest * rnd(0.01, 0.03));
    const bs = alloc(bloc, smdRest - ind, 1.8);
    const coalShare = {};
    for (const id of coalition) coalShare[id] = nat.share[id];
    const smd = { ...alloc(coalShare, bs.__coal || 0, 1.6), [IND]: ind };
    for (const [id, n] of Object.entries(bs)) if (id !== '__coal') smd[id] = (smd[id] || 0) + n;
    const pr = {};
    const myBlock = blockOfPref(decl && decl.hometown ? decl.pref : 'tokyo');
    for (const b of prBlocks(R.pr, year)) {
      const v = {};
      for (const id of Object.keys(nat.share)) if (nat.share[id] > 0.006) v[id] = nat.share[id] * Math.exp(gauss() * 0.1) * (b.name === '東京' && ['aozora', 'nijiiro'].includes(id) ? 1.25 : 1);
      const dh = dhondt(v, b.seats);
      addTo(pr, dh);
      if (b.name === myBlock) tokyoPR = { seats: b.seats, byParty: dh };
    }
    seats = addTo(addTo({}, smd), pr);
    if (decl) {
      if (inDistrict) {
        const nominee = decl.party && decl.party !== IND;
        const holder = districtHolder(p, decl.hometown ? decl.pref : 'tokyo', year);
        const cands = fieldCandidates(p, 1, fy, 'shugi', { exclude: nominee ? decl.party : null, skipCoalition: nominee && coalition.includes(decl.party), holder });
        cands.push(playerCandidate(g, p, e, decl));
        race = runRace(p, { candidates: cands, M: 1, electorate: electorateFor('smd', year), profile: decl.hometown ? profileOfPref(decl.pref) : 'urban', fy, kind: 'shugi', turnoutMult: snap });
        const w = race.candidates[0];
        seats[w.party] = (seats[w.party] || 0) + 1;
        const meC = race.candidates.find((c) => c.isPlayer);
        let revived = false;
        if (!meC.won && decl.proportional && nominee && tokyoPR) {
          // 2000年改正から: 小選挙区で没収点（有効投票の1/10）に届かない重複立候補者は比例で復活できない
          // (1996年の第41回総選挙には、この決まりはまだなかった)
          const forfeited = year >= 2000 && meC.votes < race.valid / 10;
          const prSeats = num(tokyoPR.byParty[decl.party]);
          const smdIn = Math.max(4, Math.round(tokyoPR.seats * 1.6)); // 小選挙区の数（ブロック内, 目安）
          const wins = Math.round(smdIn * num(smd[decl.party]) / Math.max(1, R.smd));
          const losers = Math.max(1, smdIn - wins);
          const sek = meC.votes / Math.max(1, w.votes);
          const ahead = Math.round(losers * clamp((0.95 - sek) / 0.65, 0, 1));
          if (!forfeited && ahead < prSeats) revived = true;
        }
        my = finishMine(g, p, e, decl, race, 1, { won: revived, revived });
      } else {
        // 比例単独: the party decides the list order (standing, fame); newcomers go lower
        const prSeats = tokyoPR ? num(tokyoPR.byParty[decl.party]) : 0;
        const rank = Math.max(1, Math.round(9 - p.me.standing / 15 - Math.log10(1 + num(g.state.fame)) * 0.8 - (p.me.nationalWins ? 1 : 0)));
        my = finishMine(g, p, e, decl, null, 1, { won: rank <= prSeats - Math.min(2, Math.floor(prSeats / 3)), pr: true, rank, noForfeit: true });
      }
    }
  }
  for (const k of Object.keys(seats)) if (!seats[k]) delete seats[k];
  const oldSeats = { ...p.diet.shugi.seats };
  p.diet.shugi = { total: sumSeats(seats), seats, system: R.system, last: absOfDay(p, e.day), termEnd: absOfDay(p, e.day) + 4 * YEAR_DAYS, dissolved: false };
  if (R.system === 'heiritsu') { try { updateHolders(g, p, oldSeats, decl, race); } catch (err) { console.error(err); } }
  p.flags.shugiNo = num(p.flags.shugiNo, 50) + 1;
  for (const id of Object.keys(p.parties)) p.parties[id].voteShare.shugi = num(nat.share[id]);
  return { seats: { ...seats }, total: sumSeats(seats), turnout: race ? race.turnout : nat.turnout, valid: race ? race.valid : 0, national: { share: { ...nat.share } }, race, my, winners: race ? winnersOf(race, R.system === 'chusenkyoku' ? R.myMagnitude : 1) : [] };
}

function runSangi(g, p, e, fy) {
  const year = Math.floor(fy);
  const R = sangiRules(year);
  const decl = myDecl(e);
  const Mt = decl && decl.hometown ? sangiPrefMagnitude(decl.pref) : tokyoSangiMagnitude(year);
  const nat = nationalShares(g, p, fy, 'sangi');
  const coalition = (p.cabinet.partyIds || []).filter((id) => p.parties[id]);
  const inTokyo = decl && !decl.proportional;
  const dRest = R.district - (inTokyo ? Mt : 0);
  const bloc = { __coal: coalition.reduce((a, id) => a + num(nat.share[id]), 0) };
  for (const id of Object.keys(nat.share)) if (!coalition.includes(id)) bloc[id] = nat.share[id];
  const ind = Math.round(dRest * rnd(0.02, 0.05));
  const bs = alloc(bloc, dRest - ind, 1.5);
  const coalShare = {};
  for (const id of coalition) coalShare[id] = nat.share[id];
  const dist = { ...alloc(coalShare, bs.__coal || 0, 1.3), [IND]: ind };
  for (const [id, n] of Object.entries(bs)) if (id !== '__coal') dist[id] = (dist[id] || 0) + n;
  const prV = {};
  for (const id of Object.keys(nat.share)) prV[id] = nat.share[id] * Math.exp(gauss() * 0.05);
  const pr = dhondt(prV, R.pr);
  const half = addTo(addTo({}, dist), pr);
  let race = null, my = null;
  if (decl) {
    if (inTokyo) {
      const nominee = decl.party && decl.party !== IND;
      const cands = fieldCandidates(p, Mt, fy, 'sangi', Mt === 1 ? { exclude: nominee ? decl.party : null, skipCoalition: nominee && coalition.includes(decl.party) } : { mine: decl.party });
      cands.push(playerCandidate(g, p, e, decl));
      race = runRace(p, { candidates: cands, M: Mt, electorate: decl.hometown ? Math.round(electorateFor('sangiTokyo', year) * prefScale(decl.pref)) : electorateFor('sangiTokyo', year), profile: decl.hometown ? profileOfPref(decl.pref) : 'urban', fy, kind: 'sangi', noise: 0.12 });
      for (const w of winnersOf(race, Mt)) half[w.party] = (half[w.party] || 0) + 1;
      my = finishMine(g, p, e, decl, race, Mt);
    } else {
      // 比例: party seats by d'Hondt; personal votes decide the order (非拘束名簿式, 2001-),
      // or the party's list order (拘束名簿式, 1983-1998)
      const seatsP = num(pr[decl.party]);
      const valid = Math.round(electorateFor('sangiNational', year) * nat.turnout * 0.98);
      const personal = Math.round(valid * 0.004 * Math.pow(playerQ(g, p, e, decl), 2.2) * (1 + Math.log10(1 + num(g.state.fans)) / 6) * Math.exp(gauss() * 0.12));
      let won, rank;
      if (R.list === 'hikousoku') {
        // the party's other list candidates (組織内候補・現職・著名人): a flat curve, so the last seats
        // of a big party still need about 100,000 personal votes (review)
        const npcTop = Array.from({ length: Math.max(seatsP + 5, 8) }, (_, i) => Math.round(valid * 0.011 * Math.exp(-i * 0.1) * rnd(0.8, 1.2))).sort((a, b) => b - a);
        rank = npcTop.filter((v) => v > personal).length + 1;
        won = rank <= seatsP;
      } else {
        rank = Math.max(1, Math.round(8 - p.me.standing / 15 - Math.log10(1 + num(g.state.fame)) * 1.2));
        won = rank <= seatsP;
      }
      my = finishMine(g, p, e, decl, null, 1, { won, pr: true, votes: personal, rank, share: personal / Math.max(1, valid), noForfeit: true });
    }
  }
  for (const k of Object.keys(half)) if (!half[k]) delete half[k];
  // the older class is replaced
  const cls = p.diet.sangi.classes.slice().sort((a, b) => a.year - b.year);
  const replacedYear = cls[0].year;
  cls[0] = { year, seats: half };
  p.diet.sangi.classes = cls;
  const seats = addTo(addTo({}, cls[0].seats), cls[1].seats);
  for (const k of Object.keys(seats)) if (!seats[k]) delete seats[k];
  p.diet.sangi = { ...p.diet.sangi, seats, total: sumSeats(seats), last: absOfDay(p, e.day) };
  for (const id of Object.keys(p.parties)) p.parties[id].voteShare.sangi = num(nat.share[id]);
  return { replacedYear, seats: { ...half }, total: sumSeats(half), houseSeats: { ...seats }, turnout: race ? race.turnout : nat.turnout, valid: race ? race.valid : 0, national: { share: { ...nat.share } }, race, my, winners: race ? winnersOf(race, Mt) : [] };
}

// NPC candidates of an executive race (区長・知事): the incumbent or a candidate backed by the
// ruling parties, one backed by the opposition, a few independents.
function execCandidates(p, L, kind, fy) {
  const cands = [];
  const coalition = p.cabinet.partyIds || [];
  const holder = L.holder && p.npcs[L.holder];
  // the main candidates are backed by parties (与党の推薦・相乗り): known, organised, never weak (review)
  if (holder && L.holder !== 'player' && Math.random() < 0.8) cands.push({ id: holder.id, name: holder.name, party: IND, Q: rnd(0.7, 0.95), incumbent: true, backers: coalition.slice(0, 2) });
  else cands.push(npcCandidate(p, IND, { Q: rnd(0.7, 0.85), backers: coalition.slice(0, 2) }));
  const opp = Object.keys(p.parties).filter((id) => !coalition.includes(id)).sort((a, b) => natSupport(p, b, fy) - natSupport(p, a, fy));
  cands.push(npcCandidate(p, IND, { Q: rnd(0.5, 0.75), backers: opp.slice(0, 2) }));
  const extra = kind === 'chiji' ? irnd(2, 6) : irnd(0, 2);
  for (let i = 0; i < extra; i++) cands.push(npcCandidate(p, Math.random() < 0.3 ? pickOne(opp.length ? opp : [IND]) : IND, { Q: i === 0 && kind === 'chiji' && Math.random() < 0.4 ? rnd(0.8, 1.2) : rnd(0.1, 0.45) }));
  return cands;
}
// The player's race as the election runners build it (for the forecast): { cands, race opts }.
function playerRaceSetup(g, p, e, d, fy) {
  const year = Math.floor(fy);
  const nominee = d.party && d.party !== IND;
  const coalition = p.cabinet.partyIds || [];
  const one = { exclude: nominee ? d.party : null, skipCoalition: nominee && coalition.includes(d.party) };
  if (e.kind === 'shugi') {
    const R = shugiRules(year, p.flags);
    const profile = d.hometown ? profileOfPref(d.pref) : 'urban';
    if (R.system === 'chusenkyoku') return { cands: fieldCandidates(p, R.myMagnitude, fy, 'shugi', { mine: d.party }), opts: { M: R.myMagnitude, electorate: electorateFor('chu', year), profile, fy, kind: 'shugi' }, decl: d };
    return { cands: fieldCandidates(p, 1, fy, 'shugi', { ...one, holder: districtHolder(p, d.hometown ? d.pref : 'tokyo', year) }), opts: { M: 1, electorate: electorateFor('smd', year), profile, fy, kind: 'shugi' }, decl: d };
  }
  if (e.kind === 'sangi') {
    const Mt = d.hometown ? sangiPrefMagnitude(d.pref) : tokyoSangiMagnitude(year);
    const electorate = d.hometown ? Math.round(electorateFor('sangiTokyo', year) * prefScale(d.pref)) : electorateFor('sangiTokyo', year);
    return { cands: fieldCandidates(p, Mt, fy, 'sangi', Mt === 1 ? one : { mine: d.party }), opts: { M: Mt, electorate, profile: d.hometown ? profileOfPref(d.pref) : 'urban', fy, kind: 'sangi', noise: 0.12 }, decl: d };
  }
  if (e.kind === 'hosen') {
    const pref = (e.vacancy && e.vacancy.pref) || 'tokyo';
    const electorate = e.house === 'sangi' ? Math.round(electorateFor('sangiTokyo', year) * (pref === 'tokyo' ? 1 : 0.15)) : electorateFor('smd', year);
    return { cands: localRival(g, fieldCandidates(p, 1, fy, 'hosen', one), pref), opts: { M: 1, electorate, profile: profileOfPref(pref), fy, kind: 'hosen', turnoutMult: 0.8 }, decl: { ...d, hometown: d.hometown || (g.state.profile && g.state.profile.hometown === pref) } };
  }
  const key = e.kind === 'shicho' ? 'kucho' : e.kind;
  const L = p.local[key] || {};
  const M = e.kind === 'kugi' ? (L.total || 40) : e.kind === 'togi' ? 3 : 1;
  const cands = M > 1 ? fieldCandidates(p, M, fy, e.kind, { mine: d.party }) : execCandidates(p, L, e.kind, fy);
  return { cands, opts: { M, electorate: electorateFor(e.kind === 'chiji' ? 'chiji' : 'kugi', year), profile: 'urban', fy, kind: e.kind }, decl: d };
}
function runLocal(g, p, e, fy) {
  const year = Math.floor(fy);
  const decl = myDecl(e);
  const kind = e.kind;
  const key = kind === 'shicho' ? 'kucho' : kind;
  const L = p.local[key];
  let M = 1, cands = [];
  if (kind === 'kugi') { M = L.total || 40; cands = fieldCandidates(p, M, fy, 'kugi', { mine: decl && decl.party }); }
  else if (kind === 'togi') { M = 3; cands = fieldCandidates(p, M, fy, 'togi', { mine: decl && decl.party }); }
  else {
    cands = execCandidates(p, L, kind, fy);
    // [R11-P] a Diet member who is ripe resigns the seat and stands (politics_ai_act.js execRunner); the result is told back below
    if (INTRA.ai && (kind === 'chiji' || kind === 'shicho')) { try { const rn = INTRA.ai.execRunner(g, p, kind, cands, fy); if (rn) cands.push(rn); } catch (err) { console.error(err); } }
  }
  if (decl) cands.push(playerCandidate(g, p, e, decl));
  const elect = electorateFor(kind === 'chiji' ? 'chiji' : 'kugi', year);
  const race = runRace(p, { candidates: cands, M, electorate: elect, profile: 'urban', fy, kind });
  const my = decl ? finishMine(g, p, e, decl, race, M) : null;
  const seats = {};
  for (const w of winnersOf(race, M)) seats[w.party] = (seats[w.party] || 0) + 1;
  if (kind === 'kugi') L.seats = seats;
  else if (kind === 'togi') {
    const d = districtShares(p, 'urban', fy, 'togi');
    const rest = alloc(d.parties, (L.total || 127) - 3 - 6, 1.15);
    rest[IND] = (rest[IND] || 0) + 6;
    L.seats = addTo(rest, seats);
  } else {
    const w = race.candidates[0];
    if (w.isPlayer) L.holder = 'player';
    else {
      const n = (w.id && p.npcs[w.id]) || newNpc(p, { name: w.name, party: IND, office: kind, wins: 0, age: irnd(45, 70) });
      n.office = kind;
      L.holder = n.id;
    }
    L.backers = w.backers || [];
    try { if (INTRA.ai) INTRA.ai.afterExec(g, p, kind, w.isPlayer ? 'player' : w.id || null); } catch (err) { console.error(err); } // [R11-P]
  }
  L.termEnd = absOfDay(p, e.day) + 4 * YEAR_DAYS;
  return { seats, total: M, turnout: race.turnout, valid: race.valid, race, my, winners: winnersOf(race, Math.min(M, 10)) };
}

// A 補選 away from Tokyo and the player's hometown: the strongest rival is a local (地元出身の県議・
// 首長経験者), against a newcomer from Tokyo (落下傘). review
function localRival(g, cands, pref) {
  const home = g.state && g.state.profile && g.state.profile.hometown;
  if (!pref || pref === 'tokyo' || pref === home || !cands.length) return cands;
  const best = cands.slice().sort((a, b) => b.Q - a.Q)[0];
  best.Q = num(best.Q) + 0.15;
  return cands;
}
function runHosen(g, p, e, fy) {
  const year = Math.floor(fy);
  const decl = myDecl(e);
  const house = e.house === 'sangi' ? 'sangi' : 'shugi';
  const pref = (e.vacancy && e.vacancy.pref) || 'tokyo';
  const prof = profileOfPref(pref);
  const nominee = decl && decl.party && decl.party !== IND;
  const coalition = p.cabinet.partyIds || [];
  const cands = localRival(g, fieldCandidates(p, 1, fy, 'hosen', { exclude: nominee ? decl.party : null, skipCoalition: nominee && coalition.includes(decl.party) }), pref);
  if (decl) cands.push(playerCandidate(g, p, e, { ...decl, hometown: decl.hometown || (g.state.profile && g.state.profile.hometown === pref) }));
  const elect = house === 'sangi' ? Math.round(electorateFor('sangiTokyo', year) * (pref === 'tokyo' ? 1 : 0.15)) : electorateFor('smd', year);
  const race = runRace(p, { candidates: cands, M: 1, electorate: elect, profile: prof, fy, kind: 'hosen', turnoutMult: 0.8 });
  const w = race.candidates[0];
  const H = p.diet[house];
  H.seats[w.party] = (H.seats[w.party] || 0) + 1;
  H.total = sumSeats(H.seats);
  if (house === 'sangi' && e.vacancy && e.vacancy.cls != null) {
    const c = p.diet.sangi.classes.find((x) => x.year === e.vacancy.cls) || p.diet.sangi.classes[0];
    c.seats[w.party] = (c.seats[w.party] || 0) + 1;
  }
  let winnerId = 'player';
  if (!w.isPlayer) winnerId = newNpc(p, { name: w.name, party: w.party, office: house, house, wins: 1, district: e.district }).id;
  // a by-election in a district the player can run in gives it a new member
  if (house === 'shugi') {
    const key = e.district === HOME_DISTRICT.shugi ? 'home' : e.vacancy && e.vacancy.pref && e.district === `${prefShort(e.vacancy.pref)}ドット区` ? e.vacancy.pref : null;
    if (key) { (p.flags.smdHolders || (p.flags.smdHolders = {}))[key] = { party: w.party, npc: winnerId, open: false }; if (key === 'home') p.flags.homeIncumbent = winnerId; }
  }
  const my = decl ? finishMine(g, p, e, decl, race, 1) : null;
  return { seats: { [w.party]: 1 }, total: 1, turnout: race.turnout, valid: race.valid, race, my, winners: winnersOf(race, 1) };
}

function runLeader(g, p, e) {
  const pt = p.parties[e.party];
  if (!pt) return { seats: {}, total: 0, winners: [], my: null };
  const decl = myDecl(e);
  const year = e.year || calYear(g);
  const dietN = Math.max(1, partySeats(p, pt.id));
  const fs = pt.factions || [];
  // NPC contenders: faction leaders and post holders with ambition
  const pool = new Set();
  for (const f of fs) if (p.npcs[f.leader]) pool.add(f.leader);
  for (const id of Object.values(pt.posts || {})) if (p.npcs[id]) pool.add(id);
  if (pt.leader && pt.leader !== 'player' && p.npcs[pt.leader] && Math.random() < 0.6) pool.add(pt.leader);
  // a leader who resigned (with the cabinet) does not run again
  const outgoing = p.flags.outgoingLeader || null;
  if (outgoing) pool.delete(outgoing);
  // [R11-P] the agents decide who stands (ambition, readiness, the faction behind them); the old pool is the fallback
  let aiPick = null;
  try { aiPick = INTRA.ai ? INTRA.ai.leaderField(g, p, pt, outgoing, !!decl) : null; } catch (e) { console.error(e); }
  if (aiPick) aiPick = aiPick.filter((id) => p.npcs[id] && p.npcs[id].party === pt.id && p.npcs[id].office);
  let npcs = aiPick && aiPick.length ? aiPick : [...pool].filter((id) => p.npcs[id] && p.npcs[id].party === pt.id && p.npcs[id].office).sort((a, b) => (p.npcs[b].traits.ambition + p.npcs[b].traits.charisma) - (p.npcs[a].traits.ambition + p.npcs[a].traits.charisma) + gauss() * 30).slice(0, decl ? 2 : irnd(1, 3));
  if (!npcs.length) npcs = [newNpc(p, { party: pt.id, house: 'shugi', office: 'shugi', wins: irnd(5, 12), charisma: irnd(50, 85) }).id];
  const cands = npcs.map((id) => {
    const n = p.npcs[id];
    const f = fs.find((x) => x.leader === id);
    return { id, name: n.name, party: pt.id, diet: (f ? f.size : 0) + (dietN * 0.15 * n.traits.charisma) / 100 + (p.flags.plotBoss === id ? dietN * 0.1 : 0), member: n.traits.charisma / 100 + rnd(0, 0.4) };
  });
  try { realBoost(g, p, pt, cands, outgoing); } catch (e) { console.error(e); } // [R14-P]
  // an incumbent player leader runs again automatically (if still a Diet member and the party's
  // term limit allows it)
  const autoMe = !decl && pt.leader === 'player' && p.me.party === pt.id && (p.me.office === 'shugi' || p.me.office === 'sangi') && outgoing !== 'player' && num(p.me.leaderTerms) < leaderTermLimit(pt.id, year);
  if (decl || autoMe) {
    const me = p.me;
    const f = fs.find((x) => x.id === me.faction);
    const wins = num(me.nationalWins);
    const post = me.posts.some((x) => POSTS[x] && (POSTS[x].kind === 'party' || POSTS[x].kind === 'cabinet'));
    // Diet members' votes (review): the faction backs the player only when its own leader does not
    // run and the player is senior and well placed; otherwise the player wins a few members of
    // their own, taken from the faction leader's count so nobody's vote is counted twice
    let lead = f ? cands.find((c) => c.id === f.leader) : null;
    // a sitting leader's own faction backs them (its boss does not run against them)
    if (autoMe && lead) { cands.splice(cands.indexOf(lead), 1); lead = null; }
    const endorsed = f && !lead && (autoMe || (me.standing >= 80 && wins >= 4));
    let dietV;
    if (endorsed) dietV = num(f.size) * clamp(me.standing / 100, 0, 1);
    else {
      dietV = dietN * 0.04 * (me.standing / 100) * Math.min(1, wins / 5);
      if (lead) { const take = Math.min(lead.diet * 0.5, dietV); lead.diet -= take; }
    }
    dietV += dietN * (0.02 * Math.min(1, wins / 6) + (post ? 0.03 : 0));
    if (autoMe) dietV += dietN * 0.25 * (me.standing / 100); // the sitting leader
    // party members' votes: name recognition helps, but no more than a party career does
    const fame = Math.log10(1 + num(g.state.fame)) / 4;
    const incumbentPM = p.cabinet.pm === 'player' ? (num(p.cabinet.approval) - 35) / 100 : 0;
    cands.push({ id: 'player', name: g.state.profile ? `${g.state.profile.familyName} ${g.state.profile.givenName}` : g.state.name, party: pt.id, isPlayer: true, diet: dietV, member: fame * 0.55 + me.reputation / 120 + rnd(0, 0.3) + incumbentPM + (autoMe ? 0.25 : 0) + (post ? 0.1 : 0) + Math.min(0.15, wins * 0.03) });
  }
  const memberW = year >= 2001 ? 1 : 0.5;
  const sumD = cands.reduce((a, c) => a + c.diet, 0) || 1;
  const sumM = cands.reduce((a, c) => a + c.member, 0) || 1;
  for (const c of cands) { c.dietVotes = Math.round((c.diet / sumD) * dietN); c.memberVotes = Math.round((c.member / sumM) * dietN * memberW); c.votes = c.dietVotes + c.memberVotes; }
  cands.sort((a, b) => b.votes - a.votes);
  let winner = cands[0];
  let runoff = null;
  const total = cands.reduce((a, c) => a + c.votes, 0);
  if (cands.length > 2 && winner.votes <= total / 2) {
    const [a, b] = cands;
    const extra = cands.slice(2).reduce((s, c) => s + c.dietVotes, 0);
    a.run = a.dietVotes + extra * rnd(0.3, 0.7) + a.memberVotes * 0.1;
    b.run = b.dietVotes + extra - (a.run - a.dietVotes - a.memberVotes * 0.1) + b.memberVotes * 0.1;
    winner = a.run >= b.run ? a : b;
    runoff = { a: { name: a.name, votes: Math.round(a.run) }, b: { name: b.name, votes: Math.round(b.run) } };
  }
  const was = pt.leader;
  pt.leader = winner.id;
  scheduleLeader(p, pt.id, absOfDay(p, e.day));
  const my = decl || autoMe ? { won: winner.isPlayer === true, votes: (cands.find((c) => c.isPlayer) || {}).votes || 0, rank: cands.findIndex((c) => c.isPlayer) + 1, depositLost: false, deposit: 0 } : null;
  if (winner.isPlayer) { p.me.leaderTerms = (was === 'player' ? num(p.me.leaderTerms) : 0) + 1; if (!p.me.posts.includes('party_leader')) p.me.posts.push('party_leader'); }
  else if (p.me.party === pt.id) { p.me.leaderTerms = 0; if (p.me.posts.includes('party_leader')) p.me.posts = p.me.posts.filter((x) => x !== 'party_leader'); }
  if (outgoing) p.flags.outgoingLeader = null;
  p.flags.plotBoss = null;
  // a new leader of the PM's party becomes PM (首班指名 in a few days); after a resignation the
  // Diet names a PM even when the acting leader keeps the post
  const pmParty = cabinetPartyOfPM(p);
  if (pmParty === pt.id && (was !== winner.id || p.cabinet.resigned)) p.cabinet.pending = { kind: 'shuhan', day: e.day + 2, reason: '党首の交代' };
  return { seats: {}, total: dietN, winners: [{ name: winner.name, party: pt.id, votes: winner.votes, isPlayer: !!winner.isPlayer, id: winner.id }], candidates: cands.map((c) => ({ name: c.name, votes: c.votes, dietVotes: c.dietVotes, memberVotes: c.memberVotes, isPlayer: !!c.isPlayer })), runoff, my, newLeader: winner.id, changed: was !== winner.id };
}
function cabinetPartyOfPM(p) {
  const pm = p.cabinet.pm;
  if (pm === 'player') return p.me.party;
  return pm && p.npcs[pm] ? p.npcs[pm].party : (p.cabinet.partyIds || [])[0] || null;
}
// ext (the real-party rule, CONTEXT.md / BRIEF.md 1): does the government include a real party (自民・民主) in any
// role — the PM's party or a coalition partner? The cores keep real parties out of conduct the game presents as
// wrong with this one check (govt.js: 強行採決, デモの強制排除, a religious group's 組織票; regime.js: its steps).
// Exported, and on the Game as g.govIncludesRealParty().
export function govIncludesRealParty(p) {
  if (!p || !p.cabinet) return false;
  let core = null;
  try { core = cabinetPartyOfPM(p); } catch (e) { core = null; }
  const ids = new Set([...(Array.isArray(p.cabinet.partyIds) ? p.cabinet.partyIds : []), core].filter(Boolean));
  for (const id of ids) if ((p.parties && p.parties[id] && p.parties[id].real) || (PARTY_DEFS[id] && PARTY_DEFS[id].real)) return true;
  return false;
}
// ねじれ国会: the ruling parties hold a majority of the 衆院 but not of the 参院. Recomputed whenever the coalition or the
// seats change (game start, 参院選, cabinet / coalition changes, the weekly poll), so the flag never lags the seats.
function nejireNow(p) {
  if (!p || !p.cabinet || !p.diet || !p.diet.shugi || !p.diet.sangi) return false;
  const ids = Array.isArray(p.cabinet.partyIds) ? p.cabinet.partyIds : [];
  const sum = (H) => ids.reduce((a, id) => a + num(H.seats && H.seats[id]), 0);
  return sum(p.diet.shugi) > num(p.diet.shugi.total) / 2 && sum(p.diet.sangi) <= num(p.diet.sangi.total) / 2;
}

function runTouitsu(g, p, e, fy) {
  p.flags.touitsuYear = Math.floor(fy);
  const d = districtShares(p, 'mixed', fy, 'touitsu');
  const ids = Object.keys(p.parties);
  const seats = alloc(d.parties, 2600, 1.1); // 都道府県議会の改選議席の目安
  const coalition = p.cabinet.partyIds || [];
  const mood = (num(p.cabinet.approval) - 40) / 400;
  for (const id of ids) if (coalition.includes(id)) addSupportAll(p, id, mood * 0.2);
  return { seats, total: 2600, turnout: d.turnout, valid: 0, race: null, my: null, winners: [] };
}

// Run an election now (normally the morning after 投票日). Returns the RESULT.
function runElectionImpl(g, p, e) {
  if (!e) return null;
  if (e.status === 'done') return e.result || null;
  const fy = fyOfAbs(p, absOfDay(p, e.day));
  // 被選挙権 is judged when the votes are counted: a candidate who is serving a sentence (禁錮以上の
  // 刑の執行中) or under 公民権停止 gets no valid votes (無効票), so the deposit is forfeited
  let invalid = null;
  if (myDecl(e) && civicBarred(g)) { invalid = myDecl(e); delete e.declared.player; }
  let r;
  try {
    if (e.kind === 'shugi') r = runShugi(g, p, e, fy);
    else if (e.kind === 'sangi') r = runSangi(g, p, e, fy);
    else if (['kugi', 'togi', 'shicho', 'chiji'].includes(e.kind)) r = runLocal(g, p, e, fy);
    else if (e.kind === 'hosen') r = runHosen(g, p, e, fy);
    else if (e.kind === 'sosaisen') r = runLeader(g, p, e);
    else r = runTouitsu(g, p, e, fy);
  } catch (err) {
    console.error('runElection', err);
    r = { seats: {}, total: 0, winners: [], my: null };
  }
  if (invalid) {
    e.declared.player = invalid;
    r.my = { won: false, votes: 0, rank: null, share: 0, depositLost: num(invalid.deposit) > 0, deposit: num(invalid.deposit), revived: false, pr: !!(invalid.pr || invalid.prOnly), district: invalid.district || null, party: invalid.party || null, invalid: true };
  }
  const decl = myDecl(e);
  const result = {
    id: e.id, kind: e.kind, label: e.label, day: e.day, year: e.year || yearOfAbs(p, absOfDay(p, e.day)), party: e.party || null, district: e.district || null,
    turnout: Math.round(num(r.turnout) * 1000) / 10, valid: num(r.valid), winners: r.winners || [], seats: r.seats || {}, total: num(r.total),
    houseSeats: r.houseSeats || null, national: r.national || null, candidates: r.candidates || (r.race ? topList(r.race, e.kind === 'kugi' ? 46 : 10) : null), runoff: r.runoff || null,
    myResult: r.my || null,
  };
  e.status = 'done';
  e.result = result;
  p.elections.upcoming = p.elections.upcoming.filter((x) => x !== e);
  p.elections.history.unshift(result);
  if (p.elections.history.length > 40) p.elections.history.length = 40;
  // keep the candidate lists of the player's races and the latest few only (save size)
  p.elections.history.forEach((h, i) => { if (i >= 4 && h.candidates && !h.myResult) h.candidates = null; });
  afterElection(g, p, e, result, decl, r);
  scheduleElections(g, p);
  emit(g, 'election', { election: e, result });
  return result;
}

// ================================================================ after an election
function news(p, g, text, kind = 'politics') {
  p.news.unshift({ day: today(g), text, kind });
  if (p.news.length > 80) p.news.length = 80;
}
function note(g, text) { (g.morningNotes || (g.morningNotes = [])).push(text); }
function phoneNews(g, text, from = 'ドット新聞 政治部') {
  try { g.message({ from, text, kind: 'news' }); } catch (e) { /* no phone in some tests */ }
}
const pname = (p, id) => (id === IND ? '無所属' : id === 'none' ? '支持なし' : (p.parties[id] && p.parties[id].short) || (PARTY_DEFS[id] && PARTY_DEFS[id].short) || (p.flags.partyNames && p.flags.partyNames[id]) || id || '');
function seatsLine(p, seats, n = 4) {
  return Object.entries(seats || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, v]) => `${pname(p, id)}${v}`).join('・');
}
function afterElection(g, p, e, res, decl, r) {
  const me = p.me;
  const day = e.day;
  const abs = absOfDay(p, day);
  if (e.kind === 'shugi') {
    news(p, g, `${e.label}：${seatsLine(p, res.seats, 5)}（定数${res.total}）`);
    phoneNews(g, `【${e.label}】\n${seatsLine(p, res.seats, 6)}（定数${res.total}・投票率${res.turnout}%）\n選挙から30日以内に特別国会が開かれ、総理大臣が指名されます。`);
    p.diet.session = null;
    p.cabinet.pending = { kind: 'special', day: day + 3, reason: '総選挙' };
    // the cabinet resigns at the first sitting after a general election (憲法70条)
  } else if (e.kind === 'sangi') {
    const coalition = p.cabinet.partyIds || [];
    const got = coalition.reduce((a, id) => a + num(res.seats[id]), 0);
    const houseMaj = coalition.reduce((a, id) => a + num(p.diet.sangi.seats[id]), 0) > p.diet.sangi.total / 2;
    p.flags.nejire = nejireNow(p);
    news(p, g, `${e.label}：改選${res.total} ${seatsLine(p, res.seats, 5)}${houseMaj ? '' : p.flags.nejire ? '（与党は参院で過半数割れ＝ねじれ）' : '（与党は参院でも過半数割れ）'}`);
    phoneNews(g, `【${e.label}】\n${seatsLine(p, res.seats, 6)}（改選${res.total}・投票率${res.turnout}%）${houseMaj ? '' : p.flags.nejire ? '\n与党は参議院で過半数を失い、「ねじれ国会」に。' : '\n与党は参議院でも過半数に届かない。'}`);
    // a heavy defeat: the PM takes responsibility (seen many times in real politics)
    if (got < res.total * 0.4 && p.cabinet.pm !== 'player' && Math.random() < 0.55) p.cabinet.pending = { kind: 'resign', day: day + 2, reason: '参院選の敗北の責任をとって' };
  } else if (e.kind === 'sosaisen') {
    const w = res.winners[0];
    if (w) news(p, g, `${e.label}：${w.name}氏が当選${res.runoff ? '（決選投票）' : ''}`);
  } else if (e.kind === 'touitsu') {
    news(p, g, `${e.label}：各地で首長・議員が改選された`);
  } else {
    const w = res.winners[0];
    if (w && e.kind !== 'kugi') news(p, g, `${e.label}：${w.name}氏（${pname(p, w.party)}）が当選`);
    else news(p, g, `${e.label}：${seatsLine(p, res.seats, 5)}`);
  }
  // a member who did not stand again leaves office with the old house / council
  if (!decl) {
    const off = (ELECTION_KINDS[e.kind] || {}).office;
    const retire = off && me.office === off && (off !== 'sangi' || num(me.sangiClass) === num(r && r.replacedYear));
    if (retire) {
      me.formerOffice = off;
      me.office = null;
      me.termEnd = null;
      me.prElected = null;
      me.posts = me.posts.filter((x) => POSTS[x] && (POSTS[x].kind === 'party' || x === 'pm'));
      if (p.cabinet.pm === 'player' && off === 'shugi') p.cabinet.pending = { kind: 'special', day: day + 3, reason: '総選挙' };
      note(g, `（${e.label}に立候補しなかったので、${OFFICES[off].label}の任期を終えた）`);
      if (off === 'shugi' || off === 'sangi') stepDownLeader(g, p, '議席を失ったため');
    }
  }
  if (!decl || !res.myResult) return;
  const my = res.myResult;
  const off = e.kind === 'hosen' ? (e.house === 'sangi' ? 'sangi' : 'shugi') : (ELECTION_KINDS[e.kind] || {}).office;
  const term = off === 'sangi' ? 6 : 4;
  if (e.kind !== 'sosaisen' || me.candidacy === e.id) { me.candidacy = null; me.campaign = null; }
  if (me.intent && me.intent.election === e.id) me.intent = null;
  if (e.kind === 'sosaisen') {
    const pt = p.parties[e.party];
    if (my.won) {
      me.standing = clamp(me.standing + 15, 0, 100);
      note(g, `（${pt ? pt.name : ''}の${postName('party_leader', res.year, e.party)}に選ばれた！）`);
      emit(g, 'elected', { election: e, result: res, office: 'party_leader' });
      g.addFame && g.addFame(150, true);
    } else {
      me.standing = clamp(me.standing - 5, 0, 100);
      note(g, `（${e.label}は${my.rank}位で敗れた…。）`);
      emit(g, 'lost', { election: e, result: res });
    }
    return;
  }
  const votes = (my.votes || 0).toLocaleString('ja-JP');
  if (my.won) {
    me.office = off;
    me.formerOffice = null;
    me.district = my.pr || my.revived ? (e.kind === 'sangi' ? '全国比例' : `比例${blockOfPref(decl.pref || 'tokyo')}ブロック`) : (decl.district || HOME_DISTRICT[e.kind] || e.district);
    me.termEnd = dayOfAbs(p, abs + term * YEAR_DAYS);
    me.wins++;
    if (off === 'shugi' || off === 'sangi') me.nationalWins++;
    if (off === 'sangi') me.sangiClass = res.year;
    if (me.careerStart == null) me.careerStart = day;
    me.officeSince = day;
    me.party = decl.party && decl.party !== IND ? decl.party : me.party;
    me.districtPref = decl.pref || 'tokyo';
    // 比例で当選（復活を含む）: 欠員は繰上補充、別の既存政党への移籍は国会法109条の2で退職
    me.prElected = (my.pr || my.revived) && (off === 'shugi' || off === 'sangi') ? { house: off, party: me.party, day } : null;
    me.reputation = clamp(me.reputation + 5, -100, 100);
    me.localSupport = clamp(me.localSupport + 8, 0, 100);
    if ((off === 'shugi' || off === 'sangi') && me.party) me.standing = clamp(me.standing + 8, 0, 100); // a won seat counts in the party
    const how = my.revived ? '（比例で復活当選）' : my.pr ? '（比例代表）' : '';
    note(g, `（${e.label}で当選した！${how}\n${my.pr ? '' : `得票 ${votes}票・`}${OFFICES[off] ? OFFICES[off].label : ''}になった）`);
    phoneNews(g, `【当選】${g.state.name}さんが${e.label}で当選！${how}\n得票 ${votes}票。`, '選挙事務所');
    if (g.addFame) g.addFame(off === 'shugi' || off === 'sangi' ? 120 : off === 'chiji' ? 300 : 40, true);
    if (g.addFans) g.addFans(off === 'chiji' ? 20000 : off === 'shugi' || off === 'sangi' ? 8000 : 1500, true);
    me.history.unshift({ day, kind: e.kind, label: e.label, won: true, votes: my.votes });
    emit(g, 'elected', { election: e, result: res, office: off });
  } else {
    me.losses++;
    me.reputation = clamp(me.reputation - 2, -100, 100);
    // an incumbent who loses (任期満了の選挙) leaves office with the old house / council; for the
    // 参院 only when the player's own class was the one elected
    const ownClass = off !== 'sangi' || e.kind === 'hosen' || num(me.sangiClass) === num(r && r.replacedYear);
    if (me.office === off && ownClass) {
      me.formerOffice = off;
      me.office = null;
      me.termEnd = null;
      me.prElected = null;
      me.posts = me.posts.filter((x) => POSTS[x] && (POSTS[x].kind === 'party' || x === 'pm'));
      if (off === 'shicho' || off === 'chiji') { const L = p.local[off === 'shicho' ? 'kucho' : 'chiji']; if (L && L.holder === 'player') L.holder = null; }
    }
    const dep = my.depositLost ? `\n供託金 ${fmtMoney(my.deposit)} は没収された…。` : my.deposit ? '\n供託金は返ってきた。' : '';
    if (my.invalid) note(g, '（被選挙権がないため、あなたへの票はすべて無効になった…）');
    note(g, `（${e.label}は落選…。得票 ${votes}票${my.rank ? `・${my.rank}位` : ''}）${dep}`);
    phoneNews(g, `【落選】${e.label}\n得票 ${votes}票。応援してくださった皆さま、ありがとうございました。${dep}`, '選挙事務所');
    me.history.unshift({ day, kind: e.kind, label: e.label, won: false, votes: my.votes, depositLost: my.depositLost });
    emit(g, 'lost', { election: e, result: res });
  }
  if (me.history.length > 30) me.history.length = 30;
  // the leader of a party the player did not found must sit in the Diet (自民党総裁などは党所属国会議員)
  if (!isNational(me)) stepDownLeader(g, p, my.won ? '国会議員でなくなったため' : '選挙で議席を失ったため');
}

// A seat falls vacant (death, resignation, a governor's race...): 補欠選挙 in April / October.
function makeVacancy(g, p, house = 'shugi', opts = {}) {
  const abs = absOfDay(p, today(g));
  const H = p.diet[house];
  const parties = Object.keys(H.seats).filter((k) => H.seats[k] > 0);
  if (!parties.length) return null;
  const party = opts.party || parties[Math.floor(Math.random() * parties.length)];
  if (!H.seats[party]) return null;
  // no by-election within 6 months of the end of the term
  if (house === 'shugi' && num(H.termEnd) - abs < YEAR_DAYS / 2) return null;
  H.seats[party]--;
  H.total = sumSeats(H.seats);
  let cls = null;
  if (house === 'sangi') {
    const c = (opts.cls != null && p.diet.sangi.classes.find((x) => x.year === opts.cls && num(x.seats[party]) > 0)) || p.diet.sangi.classes.find((x) => num(x.seats[party]) > 0);
    if (c) { c.seats[party]--; cls = c.year; }
  }
  const prefs = Object.keys(PREFECTURES);
  const pref = opts.pref || (Math.random() < 0.25 ? 'tokyo' : pickOne(prefs));
  const district = opts.district || (house === 'sangi' ? `${prefShort(pref)}選挙区` : `${prefShort(pref)}ドット${irnd(2, 9)}区`);
  const doy = doyOfAbs(abs);
  const y = yearOfAbs(p, abs);
  // vacancy 3/16-9/15 -> October; 9/16-3/15 -> April (公選法33条の2)
  const target = doy >= 25 && doy < 85 ? absOf(p, y, 10, 22) : absOf(p, doy >= 85 ? y + 1 : y, 4, 22);
  const e = addElection(p, { kind: 'hosen', house, district, day: dayOfAbs(p, target), vacancy: { party, pref, cls, reason: opts.reason || '議員の辞職' } });
  e.label = electionLabel(p, e);
  news(p, g, `${house === 'sangi' ? '参議院' : '衆議院'}${district}で欠員（${opts.reason || '議員の辞職'}）。${dateLabel(g, e.day)}に補欠選挙`);
  return e;
}

// ================================================================ the Diet: sessions & bills
const SESSION_KINDS = { ordinary: '通常国会', extra: '臨時国会', special: '特別国会' };
function openSession(g, p, kind, len) {
  const day = today(g);
  p.diet.session = { kind, start: day, end: day + len, extended: false };
  p.sessionsHeld = num(p.sessionsHeld) + 1;
  news(p, g, `${kind}が召集された（会期 約${len * 3}日）`);
  emit(g, 'session', { kind, open: true });
  for (const b of p.diet.bills) {
    if (b.stage === 'committee' && b.carry) { b.next = day + 2; b.slot = false; }
    if (b.sentAt && b.house === 'sangi') b.sentAt = day; // the 60/30-day counts restart in the new session
  }
}
function closeSession(g, p) {
  const S = p.diet.session;
  if (!S) return;
  const shelved = [];
  for (const b of p.diet.bills) {
    if (['enacted', 'rejected', 'shelved', 'draft', 'referendum'].includes(b.stage)) continue;
    if (b.kind === 'noconfidence') { b.stage = 'shelved'; continue; }
    // cabinet bills may be carried over once (継続審議); the rest die (廃案)
    if (b.sponsor === 'cabinet' && !b.carry && b.kind !== 'budget' && Math.random() < 0.6) { b.carry = 1; continue; }
    b.stage = 'shelved';
    b.result = '廃案';
    shelved.push(b);
  }
  news(p, g, `${S.kind}が閉会した${shelved.length ? `（${shelved.length}本の法案が廃案）` : ''}`);
  for (const b of shelved) if (b.by === 'player') note(g, `（提出していた「${b.title}」は、国会の閉会で廃案になった…）`);
  p.diet.session = null;
  p.diet.bills = p.diet.bills.filter((b) => !(['enacted', 'rejected', 'shelved'].includes(b.stage) && today(g) - num(b.closed, today(g)) > 60));
  const live = new Set(p.diet.bills.map((b) => b.id));
  for (const id of Object.keys(p.me.votes || {})) if (!live.has(id)) delete p.me.votes[id];
  emit(g, 'session', { kind: S.kind, open: false });
}
const inSession = (p, day) => !!(p.diet.session && day >= p.diet.session.start && day <= p.diet.session.end);
// (2026-10 fix) The Diet's business of one day: plenary votes waiting in each house, committee work due (the same rule
// as billsList({ today: true })), the budget under review (予算委員会: the PM and all ministers attend), the session's
// opening day (施政方針・所信表明演説). Recorded each morning in p.diet.agenda; attendance reads yesterday's.
function dietAgenda(p, day) {
  const out = { day, plenary: { shugi: 0, sangi: 0 }, committee: { shugi: 0, sangi: 0 }, pending: { shugi: 0, sangi: 0 }, budget: false, opening: false };
  const S = p.diet.session;
  if (!S || day < S.start || day > S.end) return out;
  out.opening = num(S.start) === day;
  for (const b of p.diet.bills) {
    if (!['committee', 'shugi', 'sangi'].includes(b.stage) || !(b.house in out.plenary)) continue;
    const held = !!(b.held && b.heldIn === S.start);
    if (b.stage === b.house) out.plenary[b.house]++;
    else if (b.stage === 'committee' && !held) { out.pending[b.house]++; if (num(b.next) <= day + 1) out.committee[b.house]++; }
    if (b.kind === 'budget') out.budget = true;
  }
  return out;
}
// the Diet has bills before it (either house: a committee or a plenary vote)
const dietBusy = (A) => ['shugi', 'sangi'].some((h) => num(A.plenary[h]) + num(A.pending ? A.pending[h] : A.committee[h]) > 0);
// Was the player expected in the Diet on that day? (no record of the day, e.g. an old save: a member yes, the cabinet no)
function attendDuty(p, me, day) {
  const A = p.diet.agenda && num(p.diet.agenda.day) === day ? p.diet.agenda : null;
  const cab = inCabinet(me);
  const h = me.office;
  if (!A) return !cab;
  if (A.opening) return true;
  if (cab) return !!A.budget || num(A.plenary[h]) > 0;
  // a member: every plenary vote, and the committees while the Diet has bills before it (委員会の質疑)
  return num(A.plenary[h]) > 0 || dietBusy(A);
}
// The player's title in a headline: 首相 / the cabinet post / 区長・知事 / 議員 / 氏.
function playerTitle(g, p) {
  const me = p.me;
  if (me.posts.includes('pm')) return '首相';
  const cab = me.posts.find((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
  if (cab) return postName(cab, fyNow(g));
  if (me.office === 'shicho') return '区長';
  if (me.office === 'chiji') return '知事';
  return me.office ? '議員' : '氏';
}
// The former PM of the もしも emergency / dictatorship is not appointed to any cabinet post (regime.js, feature-detected).
function playerBarred(g, post = null) {
  try { return typeof g.regimeBarred === 'function' ? g.regimeBarred('player', post) || null : null; } catch (e) { console.error(e); return null; }
}
// Party alignment with a policy (0..1): ideology distance + platform + coalition politics.
function alignment(p, partyId, policyId) {
  const pt = p.parties[partyId];
  const pl = POLICIES[policyId];
  if (!pt || !pl) return 0.5;
  const v = ideoOf(pl);
  const a = pt.ideology || {};
  // positive when the party leans the way the policy pushes
  const dot = v.econ * num(a.econ) + v.social * num(a.social) + v.security * num(a.security);
  let s = 0.6 + dot * 0.12;
  if ((pt.platform || []).includes(policyId)) s += 0.25;
  return clamp(s, 0, 1);
}
// How a party votes on a bill: { yes: 0..1 share of its members voting yes }.
// [R11-P] The party line (whip) is blended with the convictions of its named members (politics_ai_act.js partyYes); budgets and confidence votes stay party-line.
function partyStance(p, partyId, bill) {
  const base = partyStance0(p, partyId, bill);
  const ai = INTRA.ai;
  if (!ai || !bill || bill.kind === 'budget' || bill.kind === 'noconfidence') return base;
  try { return ai.partyYes(p, partyId, bill, base); } catch (e) { console.error(e); return base; }
}
function partyStance0(p, partyId, bill) {
  const coalition = p.cabinet.partyIds || [];
  const ruling = coalition.includes(partyId);
  if (bill.kind === 'budget') return ruling ? 0.995 : 0.02;
  if (bill.kind === 'noconfidence') {
    if (!ruling) return 0.97;
    const appr = num(p.cabinet.approval);
    return appr < 22 ? clamp((22 - appr) * 0.025, 0, 0.35) : 0;
  }
  // R5-D: 国会対策・修正協議・付帯決議 (bill.lobby { partyId: bonus }) move a party's alignment
  const al = alignment(p, partyId, bill.policy) + num(bill.lobby && bill.lobby[partyId]);
  // an opposition party decides as a bloc (党議拘束) whether to back a cabinet bill: likely when the
  // policy is close to its own, rarely otherwise; the decision holds for the bill's whole way (review)
  if (bill.sponsor === 'cabinet' && !ruling) {
    const bloc = bill.bloc || (bill.bloc = {});
    if (bloc[partyId] == null) bloc[partyId] = INTRA.ai ? INTRA.ai.oppBloc(p, partyId, bill, al) : (Math.random() < 1 / (1 + Math.exp(-(al - 0.64) * 18)) ? 1 : 0); // [R11-P] the opposition's strategy decides (seeded)
    return bloc[partyId] ? 0.93 : 0.04;
  }
  // ext (hook for govt.js, A1): bill.rebel { partyId: share } = members of a ruling party voting against a divisive cabinet bill (造反)
  if (bill.sponsor === 'cabinet') return clamp(0.93 + al * 0.07 - num(bill.rebel && bill.rebel[partyId]), 0, 1);
  if (bill.party === partyId) return 0.97;
  if (bill.kind === 'amendment') return al >= 0.6 ? 0.95 : al >= 0.5 ? 0.4 : 0.03;
  if (ruling) return al >= 0.75 ? 0.9 : al >= 0.6 ? 0.45 : 0.05;
  return al >= 0.55 ? 0.85 : 0.1;
}
// A plenary (or committee) vote. Returns { yes, no, absent, passed, byParty, player }.
function houseVote(g, p, bill, house, opts = {}) {
  const H = p.diet[house];
  const me = p.me;
  // committee votes are a preview of the plenary: the player's own vote (and any 党議拘束違反)
  // counts only once, at the plenary
  const myHouse = !opts.committee && (me.office === 'shugi' || me.office === 'sangi') ? me.office : null;
  const myParty = me.party || IND;
  const byParty = {};
  let yes = 0, no = 0, absent = 0;
  for (const [id, n0] of Object.entries(H.seats)) {
    let n = num(n0);
    if (myHouse === house && id === myParty) n = Math.max(0, n - 1);
    const s = id === IND ? (bill.kind === 'noconfidence' ? 0.5 : bill.kind === 'budget' ? 0.3 : 0.5) : partyStance(p, id, bill);
    const ab = Math.round(n * rnd(0, 0.03));
    const y = Math.round((n - ab) * clamp(s + gauss() * 0.02, 0, 1));
    byParty[id] = { yes: y, no: n - ab - y, absent: ab };
    yes += y; no += n - ab - y; absent += ab;
  }
  let player = null;
  if (myHouse === house) {
    const line = me.party ? (partyStance(p, me.party, bill) >= 0.5 ? 'yes' : 'no') : 'abstain';
    player = me.votes[bill.id] || (me.party ? line : 'abstain');
    if (player === 'yes') yes++; else if (player === 'no') no++; else absent++;
    // voting with the party (党議拘束) on the bills that matter is what a party counts on
    if (me.party && player === line && me.votes[bill.id] && (bill.sponsor === 'cabinet' || bill.kind === 'noconfidence' || bill.party === me.party)) me.standing = clamp(me.standing + gainTo(me.standing, 0.4), 0, 100);
    if (me.party && player !== line && (bill.sponsor === 'cabinet' || bill.kind === 'noconfidence' || bill.party === me.party)) {
      // breaking the party line (党議拘束違反)
      me.standing = clamp(me.standing - (bill.kind === 'noconfidence' ? 30 : 12), 0, 100);
      me.reputation = clamp(me.reputation + (Math.random() < 0.5 ? 2 : -2), -100, 100);
      p.flags.rebel = num(p.flags.rebel) + 1;
      note(g, `（党の方針に反する投票をした。党内での立場が悪くなった…）`);
      if (bill.kind === 'noconfidence' && isRuling(p, me.party)) {
        note(g, '（与党の議員なのに内閣不信任案に賛成した。党から除名処分を受けた…）');
        leavePartyImpl(g, p, '除名');
      }
    }
  }
  const total = yes + no;
  const need = opts.twoThirdsOf === 'all' ? Math.ceil((H.total * 2) / 3) : opts.twoThirds ? Math.ceil(((yes + no) * 2) / 3) : Math.floor(total / 2) + 1;
  return { yes, no, absent, passed: yes >= need, need, byParty, player };
}
function addBill(p, def) {
  const b = {
    id: 'b' + p.nextId++, title: def.title, policy: def.policy, params: def.params || {}, sponsor: def.sponsor || 'member', by: def.by || null, party: def.party || null,
    stage: def.stage || 'committee', house: def.house || 'shugi', step: 'committee', votes: {}, created: def.day, next: def.day + (def.delay ?? irnd(3, 6)), kind: def.kind || (POLICIES[def.policy] && (POLICIES[def.policy].billKind || POLICIES[def.policy].kind)) || 'law',
    supporters: def.supporters || 0, need: def.need || 0, ministry: def.ministry || null, cost: def.cost || 0, carry: 0, log: [],
  };
  p.diet.bills.push(b);
  return b;
}
// Committee and plenary steps for every bill due today (only while the Diet sits).
function advanceBillsImpl(g, p) {
  const day = today(g);
  const S = p.diet.session;
  const out = [];
  for (const b of p.diet.bills) {
    if (b.stage === 'referendum') { if (day >= b.next) out.push(referendum(g, p, b)); continue; }
    if (!S || !inSession(p, day)) continue;
    if (['enacted', 'rejected', 'shelved', 'draft'].includes(b.stage)) continue;
    if (day < num(b.next)) continue;
    const house = b.house;
    const other = house === 'shugi' ? 'sangi' : 'shugi';
    if (b.stage === 'committee') {
      // the ruling side may hold an opposition bill in committee (つるし)
      const coalition = p.cabinet.partyIds || [];
      const rulingMaj = coalition.reduce((a, id) => a + num(p.diet[house].seats[id]), 0) > p.diet[house].total / 2;
      if (b.sponsor === 'member' && rulingMaj && !coalition.includes(b.party) && b.kind !== 'noconfidence') {
        // the committee's agenda is set once a session: a held bill (つるし) is not taken up at all
        // and dies at the close; even a policy the government likes is usually taken up as its own
        // bill instead (review)
        if (b.heldIn !== S.start) {
          const al = coalition.reduce((a, id) => Math.max(a, alignment(p, id, b.policy)), 0);
          b.heldIn = S.start;
          b.held = Math.random() < (al < 0.7 ? 0.85 : 0.5);
          if (b.held) b.log.push({ day, text: '委員会で審議されないまま（いわゆる「つるし」）' });
        }
        if (b.held) { b.next = S.end + 1; continue; }
      }
      // floor time is limited (review): a session only gets through so many bills; the rest wait
      // and are carried over (継続審議) or die when it closes. The cabinet's own (the player's as a
      // minister / PM) go first.
      if (!b.slot && b.kind !== 'budget' && b.kind !== 'noconfidence') {
        const fl = S.floor || (S.floor = { cabinet: 0, member: 0 });
        const cap = S.kind === SESSION_KINDS.ordinary ? { cabinet: 8, member: 3 } : S.kind === SESSION_KINDS.extra ? { cabinet: 4, member: 1 } : { cabinet: 2, member: 1 };
        const k = b.sponsor === 'cabinet' ? 'cabinet' : 'member';
        const pri = b.by === 'player' ? (k === 'cabinet' ? 2 : 1) : 0;
        if (fl[k] >= cap[k] + pri) {
          b.next = day + irnd(3, 6);
          if (!b.waitLogged) { b.waitLogged = true; b.log.push({ day, text: '審議の日程が組まれず、順番を待っている' }); }
          continue;
        }
        fl[k]++;
        b.slot = true;
      }
      const v = houseVote(g, p, b, house, { committee: true });
      b.log.push({ day, text: `${house === 'shugi' ? '衆院' : '参院'}の委員会で${v.passed ? '可決' : '否決'}` });
      b.step = 'plenary';
      b.stage = house;
      b.next = day + 1;
      if (!v.passed && b.kind !== 'budget') b.committeeNo = true;
      continue;
    }
    // plenary
    const opts = b.kind === 'amendment' ? { twoThirdsOf: 'all' } : b.revote ? { twoThirds: true } : {};
    const v = houseVote(g, p, b, house, opts);
    b.votes[house + (b.revote ? '_revote' : '')] = { yes: v.yes, no: v.no, absent: v.absent, passed: v.passed };
    b.log.push({ day, text: `${house === 'shugi' ? '衆院' : '参院'}本会議で${v.passed ? '可決' : '否決'}（${v.yes}対${v.no}）` });
    if (b.kind === 'noconfidence') { resolveNoConfidence(g, p, b, v); out.push(b); continue; }
    if (b.revote) { if (v.passed) enact(g, p, b); else rejectBill(g, p, b, '衆院の再可決に届かず'); out.push(b); continue; }
    if (v.passed) {
      if (b.first && b.first !== house) {
        if (b.kind === 'amendment') { b.stage = 'referendum'; b.next = day + irnd(20, 60); news(p, g, `「${b.title}」が両院の3分の2で発議された。国民投票へ`); emit(g, 'bill', { bill: b, step: 'proposed' }); }
        else enact(g, p, b);
      } else { b.first = house; b.house = other; b.stage = 'committee'; b.step = 'committee'; b.next = day + irnd(3, 6); b.sentAt = day; }
    } else if (b.first && b.first !== house) {
      // the second house said no
      if (b.kind === 'budget') { b.log.push({ day, text: '両院協議会で一致せず、衆議院の議決が国会の議決に（憲法60条）' }); enact(g, p, b); }
      else if (b.kind === 'law' && other === 'shugi') { b.revote = true; b.house = 'shugi'; b.stage = 'shugi'; b.next = day + 2; }
      else rejectBill(g, p, b, '否決');
    } else rejectBill(g, p, b, '否決');
    out.push(b);
  }
  // 参院 60 days without a vote: the 衆院 may treat the bill as rejected (みなし否決); budget: 30 days.
  // Both count only days the Diet sits (国会休会中の期間を除いて).
  if (!S || !inSession(p, day)) return out;
  for (const b of p.diet.bills) {
    if (b.house !== 'sangi' || !b.first || b.first !== 'shugi' || ['enacted', 'rejected', 'shelved'].includes(b.stage) || !b.sentAt) continue;
    const lim = b.kind === 'budget' ? 10 : 20;
    if (day - b.sentAt >= lim) {
      if (b.kind === 'budget') { b.log.push({ day, text: '参院が30日以内に議決せず、自然成立（憲法60条）' }); enact(g, p, b); }
      else if (b.kind === 'law') { b.revote = true; b.house = 'shugi'; b.stage = 'shugi'; b.next = day + 1; b.sentAt = null; }
    }
  }
  return out;
}
function rejectBill(g, p, b, why) {
  b.stage = 'rejected';
  b.result = why;
  b.closed = today(g);
  if (b.kind === 'budget' && !b.policy) { p.economy.budget.provisional = true; news(p, g, '予算案が否決され、暫定予算でしのぐことに'); p.cabinet.scandal -= 8; }
  else { news(p, g, `「${b.title}」は${why}`); if (b.kind === 'budget') p.cabinet.scandal -= 3; }
  if (b.by === 'player') note(g, `（「${b.title}」は${why}となった…）`);
  emit(g, 'bill', { bill: b, step: 'rejected' });
}
// A bill becomes law: effects on segments (support of the sponsors), the economy, the state.
function enact(g, p, b) {
  b.stage = 'enacted';
  b.closed = today(g);
  b.result = '成立';
  // the year's budget (a 補正予算 has a policy and takes effect like a law below)
  if (b.kind === 'budget' && !b.policy) {
    p.economy.budget.passed = true;
    p.economy.budget.provisional = false;
    news(p, g, `${b.title}が成立した（一般会計 ${fmtCho(p.economy.budget.spending)}）`);
    emit(g, 'enacted', { bill: b, law: null });
    return;
  }
  const pl = POLICIES[b.policy];
  if (!pl) return;
  const abs = absOfDay(p, today(g));
  const year = yearOfAbs(p, abs);
  const ctx = ctxOf(p, year);
  const fx = pl.effects(b.params, p.era, ctx);
  const cost = pl.costOf(b.params, ctx);
  const law = { id: 'l' + p.nextId++, bill: b.id, policy: b.policy, title: b.title, params: { ...(b.params || {}) }, day: today(g), abs, by: b.by, party: b.party, sponsor: b.sponsor, cost, economy: { ...fx.economy }, segments: { ...fx.segments }, lasting: pl.lasting, area: pl.area };
  p.laws.push(law);
  if (p.laws.length > 120) p.laws.splice(0, p.laws.length - 120);
  // the segments react: the sponsor (and the cabinet for 閣法) gain or lose support
  const credit = b.sponsor === 'cabinet' ? (p.cabinet.partyIds || []) : [b.party].filter(Boolean);
  let mood = 0;
  const W = segWeights(year);
  for (const [s, d] of Object.entries(fx.segments || {})) {
    if (!SEGMENTS[s]) continue;
    for (const id of credit) addSupport(p, s, id, d * 0.004);
    mood += W[s] * d;
  }
  if (b.sponsor === 'cabinet') p.cabinet.mood = clamp(num(p.cabinet.mood) + mood * 1.2, -20, 20);
  if (fx.economy && fx.economy.nikkei) p.economy.nikkei *= 1 + num(fx.economy.nikkei) / 100;
  p.opinion.issues[pl.area] = clamp(num(p.opinion.issues[pl.area]) + 0.1, 0, 1);
  try { if (pl.apply) pl.apply(p, { ...pl.defaults, ...(b.params || {}) }, g); } catch (e) { console.error(e); }
  if (num(cost) && p.economy.budget) { p.economy.budget.deficit = Math.round((num(p.economy.budget.deficit) + cost * (pl.area === 'tax' && !/shohizei/.test(b.policy) ? 1 : 1)) * 10) / 10; }
  news(p, g, `「${b.title}」が成立した`);
  if (/^shohizei_/.test(b.policy) || pl.kind === 'amendment') phoneNews(g, /^shohizei_/.test(b.policy) ? `【法律成立】「${b.title}」が成立。消費税率は${p.economy.taxRate}%に。` : `【憲法改正】国民投票で承認され、「${pl.name}」が成立しました。`);
  if (b.by === 'player') {
    p.me.reputation = clamp(p.me.reputation + 6, -100, 100);
    p.me.standing = clamp(p.me.standing + 6, 0, 100);
    note(g, `（あなたが提出した「${b.title}」が成立した！）`);
    phoneNews(g, `【法案成立】${g.state.name}議員らが提出した「${b.title}」が成立。`);
    if (g.addFame) g.addFame(pl.area === 'culture' ? 120 : 60, true);
  }
  emit(g, 'enacted', { bill: b, law });
}
function referendum(g, p, b) {
  const pl = POLICIES[b.policy];
  const year = calYear(g);
  const W = segWeights(year);
  let yes = 0.5;
  for (const [s, d] of Object.entries((pl && pl.effects(b.params, p.era, ctxOf(p, year)).segments) || {})) yes += W[s] * d * 0.03;
  yes += (num(p.cabinet.approval) - 45) / 400 + gauss() * 0.05;
  yes = clamp(yes, 0.2, 0.8);
  const passed = yes > 0.5;
  b.votes.referendum = { yes: Math.round(yes * 1000) / 10, passed };
  news(p, g, `国民投票：「${b.title}」は賛成${b.votes.referendum.yes}%で${passed ? '承認' : '否決'}`);
  phoneNews(g, `【国民投票の結果】\n「${b.title}」\n賛成 ${b.votes.referendum.yes}%・反対 ${Math.round((100 - b.votes.referendum.yes) * 10) / 10}%\n${passed ? '承認され、憲法が改正されます。' : '過半数に届かず、改正は成立しませんでした。'}`);
  if (passed) enact(g, p, b); else rejectBill(g, p, b, '国民投票で否決');
  return b;
}
const ctxOf = (p, year) => ({ year, era: p.era, gdp: p.economy.gdp, taxRate: p.economy.taxRate, defense: p.economy.defense, kids: year < 2000 ? 1.4 : year < 2015 ? 1.15 : 1 });

// The cabinet brings its bills (and the budget) to an ordinary session; the opposition files some.
function cabinetBills(g, p) {
  const day = today(g);
  const year = calYear(g);
  const fy = fyNow(g);
  const pmParty = cabinetPartyOfPM(p);
  const b = addBill(p, { title: `${year}年度予算案`, policy: null, sponsor: 'cabinet', by: p.cabinet.pm, party: pmParty, kind: 'budget', house: 'shugi', day, delay: 6 });
  b.title = `${year}年度予算案`;
  if (p.cabinet.pm === 'player') return; // the player brings bills as PM (proposeBill)
  const enacted = new Set(p.laws.map((l) => l.policy));
  const ag = agendaFor(year).filter((id) => POLICIES[id] && !enacted.has(id) && !policyBlock(p, id, null, year, fy));
  // R5-D: the governing party's open pledges come first (公約の実現); the rest as before
  let pledged = [];
  try { pledged = INTRA.pledge.pledgeAgenda(p, pmParty); } catch (e) { pledged = []; }
  const plat = new Set([...pledged, ...(p.parties[pmParty] ? p.parties[pmParty].platform : []), ...(p.cabinet.partyIds || []).filter((id) => id !== pmParty && Math.random() < 0.3).flatMap((id) => (p.parties[id] ? p.parties[id].platform.slice(0, 3) : []))]);
  const extra = [...plat].filter((id) => POLICIES[id] && !ag.includes(id) && !enacted.has(id) && POLICIES[id].kind === 'law' && !policyBlock(p, id, null, year, fy));
  const pledgedNow = Math.random() < 0.6 ? [...ag, ...extra].filter((id) => pledged.includes(id) && POLICIES[id] && !policyBlock(p, id, null, year, fy)).slice(0, 1) : [];
  const n = irnd(2, 4) + (pledgedNow.length ? 1 : 0);
  const pickList = [...new Set([...pledgedNow, ...ag.sort(() => Math.random() - 0.5).slice(0, Math.min(n, ag.length)), ...extra.sort(() => Math.random() - 0.5)])].slice(0, n);
  for (const id of pickList) {
    const pl = POLICIES[id];
    const params = agendaParams(p, id, year);
    if (policyBlock(p, id, params, year, fy)) continue;
    const post = ministryFor(pl.ministry || 'kanbo', fy, p.flags);
    addBill(p, { title: billTitle(pl, params), policy: id, params, sponsor: 'cabinet', by: p.cabinet.ministers[post] || p.cabinet.pm, party: pmParty, house: 'shugi', day, ministry: post, delay: irnd(4, 12) });
  }
  // opposition member bills (rarely pass)
  for (const id of Object.keys(p.parties)) {
    if (isRuling(p, id) || p.parties[id].isPlayers || Math.random() < 0.5) continue;
    const plat = (p.parties[id].platform || []).filter((x) => POLICIES[x] && POLICIES[x].kind === 'law' && !POLICIES[x].billKind && !policyBlock(p, x, agendaParams(p, x, year), year, fy));
    if (!plat.length) continue;
    const pid = pickOne(plat);
    const params = agendaParams(p, pid, year);
    addBill(p, { title: billTitle(POLICIES[pid], params), policy: pid, params, sponsor: 'member', by: p.parties[id].leader, party: id, house: 'shugi', day, delay: irnd(5, 14) });
  }
}
// The numbers a government / party puts in its bill (税率・防衛費 follow the current level).
function agendaParams(p, id, year) {
  const pl = POLICIES[id];
  const params = { ...(pl ? pl.defaults : {}) };
  if (id === 'shohizei_up') params.rate = p.economy.taxRate < 5 ? 5 : p.economy.taxRate < 8 ? 8 : 10;
  // defence spending is raised step by step (2% of GDP is the 2020s target)
  if (id === 'defense_up') params.pct = clamp(Math.round((num(p.economy.defense, 1) + (year >= 2020 ? 0.6 : 0.5)) * 2) / 2, 1.5, year >= 2020 ? 2 : 1.5);
  return params;
}
function billTitle(pl, params) {
  if (!pl) return '法律案';
  if (typeof pl.title === 'function') return pl.title({ ...(pl.defaults || {}), ...(params || {}) });
  const pp = (pl.params || []).map((d) => `${params && params[d.key] != null ? params[d.key] : d.def}${d.unit}`).join('・');
  return pl.kind === 'amendment' ? `${pl.name}の原案` : `${pl.name}${pp ? `（${pp}）` : ''}に関する法律案`;
}
const REPEATABLE = new Set(['stimulus', 'energy_subsidy', 'shohizei_up', 'shohizei_down', 'reconstruction']);
// Why a policy cannot be brought now (null = it can).
function policyBlock(p, id, params, year, fy) {
  const pl = POLICIES[id];
  if (!pl) return 'そんな政策はない';
  if (pl.years && (year < pl.years[0] || year > pl.years[1])) return 'いまの時代には取り上げられない政策';
  if (pl.check) { const why = pl.check(p, params, year); if (why) return why; }
  // a law already in force when the era started (not one with numbers that can be revised)
  const inf = p.flags.inForce && p.flags.inForce[id];
  if (inf && !pl.params && !REPEATABLE.has(id) && !p.laws.some((l) => l.policy === id)) return `すでに実現している（${inf}年に成立・決定）`;
  if (p.diet.bills.some((b) => b.policy === id && !['enacted', 'rejected', 'shelved'].includes(b.stage))) return 'すでに同じ法案が国会に出ている';
  // a law without numbers is not passed twice; a law with numbers (税率・規模) can be revised after a year
  const last = p.laws.slice().reverse().find((l) => l.policy === id);
  if (last && !REPEATABLE.has(id)) {
    if (!pl.params) return 'すでに成立している';
    if (p.lastTick - num(last.day) < YEAR_DAYS) return '同じ法律が成立してから1年たっていない';
  }
  return null;
}

// ================================================================ the cabinet
// Fill every cabinet post of the current year with NPCs of the coalition (faction balance),
// keeping the player in a post they hold.
function fillCabinet(g, p, opts = {}) {
  const fy = fyOfAbs(p, absOfDay(p, today(g)));
  const posts = cabinetPosts(fy, p.flags);
  const coalition = (p.cabinet.partyIds || []).filter((id) => p.parties[id]);
  const prev = p.cabinet.ministers || {};
  const out = {};
  const seats = (id) => partySeats(p, id);
  const totalSeats = coalition.reduce((a, id) => a + seats(id), 0) || 1;
  const quota = {};
  for (const id of coalition) quota[id] = Math.max(1, Math.round((posts.length * seats(id)) / totalSeats));
  const pmParty = cabinetPartyOfPM(p);
  const barred = !!playerBarred(g); // regime.js: the former PM of the emergency / dictatorship regime holds no cabinet post (2026-10 fix)
  const preReal = realMinisters(g, p, posts, coalition); // [R14-P] 民主党政権: 鳩山内閣の菅・菅内閣の野田
  for (const post of posts) {
    if (preReal[post]) { const rn = preReal[post]; out[post] = rn.id; if (!rn.posts.includes(post)) rn.posts.push(post); continue; }
    if (opts.keep && prev[post] && ((prev[post] === 'player' && !barred) || (p.npcs[prev[post]] && coalition.includes(p.npcs[prev[post]].party)))) { out[post] = prev[post]; continue; }
    if (prev[post] === 'player' && !barred && opts.keepPlayer !== false && p.me.posts.includes(post)) { out[post] = 'player'; continue; }
    const party = coalition.find((id) => id !== pmParty && quota[id] > 0 && Math.random() < 0.5) || pmParty || coalition[0];
    if (quota[party] != null) quota[party]--;
    const n = pickMinister(p, party, out);
    n.posts.push(post);
    out[post] = n.id;
    try { if (INTRA.ai) INTRA.ai.afterMinister(g, p, n, post); } catch (e) { console.error(e); } // [R11-P]
  }
  // former ministers lose their post (their NPC record is pruned later)
  for (const [post, id] of Object.entries(prev)) if (out[post] !== id && id !== 'player' && p.npcs[id]) p.npcs[id].posts = p.npcs[id].posts.filter((x) => x !== post);
  if (barred) p.me.posts = p.me.posts.filter((x) => !(POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm'));
  p.cabinet.ministers = out;
  if (!opts.quiet) news(p, g, `内閣の顔ぶれが決まった（${posts.length + 1}人）`);
  return out;
}
// ================================================================ [R14-P] 実在の政治家 (politics_real.js)
// The overlay: the NPC record of a slot gets the person's name, face (look.photo), traits, age and terms; n.orig keeps what it was.
function realOverlay(p, n, def, year) {
  if (!n.orig) n.orig = { name: n.name, gender: n.gender, look: n.look, traits: n.traits, age: n.age, wins: n.wins, house: n.house, office: n.office };
  if (n.office === 'sangi') { n.office = 'shugi'; n.house = 'shugi'; } // all four sat in the 衆議院
  const oldSur = String(n.name || '').split(' ')[0];
  n.name = def.name; n.gender = def.gender || 'm';
  n.look = { hair: 'short', hairColor: 'black', top: '#2a2f45', bottom: '#2a2d36', jacket: true, tie: '#3a4a7a', photo: def.photo };
  n.traits = { ...def.traits };
  n.age = realAge(def, year);
  n.wins = Math.max(num(n.wins), realWins(def, year));
  n.real = def.key;
  delete n.ai; // the agent layer builds a fresh one (politics_ai.js reads n.real)
  const sur = def.name.split(' ')[0];
  for (const pt of Object.values(p.parties)) for (const f of pt.factions || []) {
    if (f.leader !== n.id) continue;
    const word = /派$/.test(f.name) ? '派' : /グループ$/.test(f.name) ? 'グループ' : null;
    if (word && f.name === oldSur + word) f.name = sur + word;
  }
}
function realRestore(p, n) {
  const o = n.orig;
  if (!o) return;
  const sur = String(n.name || '').split(' ')[0];
  const oldSur = String(o.name || '').split(' ')[0];
  for (const pt of Object.values(p.parties)) for (const f of pt.factions || []) {
    if (f.leader !== n.id) continue;
    const word = /派$/.test(f.name) ? '派' : /グループ$/.test(f.name) ? 'グループ' : null;
    if (word && f.name === sur + word) f.name = oldSur + word;
  }
  n.name = o.name; n.gender = o.gender; n.look = o.look; n.traits = o.traits; n.age = o.age; n.wins = o.wins;
  if (o.house) n.house = o.house;
  if (o.office) n.office = o.office;
  delete n.real; delete n.orig; delete n.ai;
}
// Seat the figures in their slots (idempotent; each is seated once). Called when the state is made, when the DPJ is founded, and every morning.
function realSync(g, p) {
  if (!g || !g.state || !p || g.state.realPols === false || !p.parties) return;
  const R = (p.real && typeof p.real === 'object') ? p.real : (p.real = { map: {}, served: [] });
  if (!R.map || typeof R.map !== 'object') R.map = {};
  if (!Array.isArray(R.served)) R.served = [];
  const year = Math.floor(fyOfAbs(p, absOfDay(p, today(g))));
  for (const key of REAL_ORDER) {
    const def = REAL[key];
    const cur = R.map[key] && p.npcs[R.map[key]];
    if (cur && cur.real === key) continue;
    if (R.map[key]) delete R.map[key];
    const pt = p.parties[def.party];
    if (!pt) continue;
    const hid = def.slot === 'leader' ? pt.leader : (pt.posts || {})[def.slot];
    if (!hid || hid === 'player') continue;
    const n = p.npcs[hid];
    if (!n || n.real || n.dead) continue;
    realOverlay(p, n, def, year);
    R.map[key] = n.id;
  }
  // who has led the party (the 民主党's order: 鳩山 → 菅 → 野田)
  const mp = p.parties.minshu;
  const L = mp && mp.leader && p.npcs[mp.leader];
  if (L && L.real && !R.served.includes(L.real)) R.served.push(L.real);
}
// 党首選: the next in the 民主党's order stands and is backed; 安倍 is backed while he is in the 自民党.
function realBoost(g, p, pt, cands, outgoing) {
  if (!g || !g.state || g.state.realPols === false || !p.real || !p.real.map) return;
  let key = null, mult = 2.4;
  if (pt.id === 'minshu') {
    const cur = pt.leader && p.npcs[pt.leader];
    const nowKey = cur && cur.real;
    key = DPJ_CHAIN.find((k) => !p.real.served.includes(k) && k !== nowKey && p.real.map[k] && p.real.map[k] !== outgoing && p.npcs[p.real.map[k]] && p.npcs[p.real.map[k]].office);
  } else if (pt.id === 'jimin') { key = p.real.map.abe && p.real.map.abe !== outgoing && p.npcs[p.real.map.abe] && p.npcs[p.real.map.abe].office ? 'abe' : null; mult = 1.7; }
  if (!key) return;
  const id = p.real.map[key];
  const n = p.npcs[id];
  if (!n || n.party !== pt.id) return;
  let c = cands.find((x) => x.id === id);
  if (!c) { c = { id, name: n.name, party: pt.id, diet: Math.max(2, partySeats(p, pt.id) * 0.06), member: n.traits.charisma / 100 + 0.2 }; cands.push(c); }
  // decisive: the backed figure leads the field (a leadership race the party already expects)
  const others = cands.filter((x) => x !== c);
  const mD = Math.max(0, ...others.map((x) => x.diet)), mM = Math.max(0, ...others.map((x) => x.member));
  c.diet = Math.max(c.diet * mult, mD * 1.8); c.member = Math.max(c.member + 0.45, mM * 1.6);
}
// 民主党の内閣: the PM 鳩山 names 菅 (副総理格) for the 財務大臣; the PM 菅 names 野田.
function realMinisters(g, p, posts, coalition) {
  const res = {};
  if (!g || !g.state || g.state.realPols === false || !p.real || !p.real.map) return res;
  const pm = p.cabinet.pm && p.npcs[p.cabinet.pm];
  const tab = pm && pm.real ? REAL_CABINET[pm.real] : null;
  if (!tab) return res;
  for (const [post, want] of Object.entries(tab)) {
    if (!posts.includes(post)) continue;
    const n = p.npcs[p.real.map[want]];
    if (!n || n.dead || !n.office || !coalition.includes(n.party)) continue;
    res[post] = n;
  }
  return res;
}
export function realPolsSetting(g) { return !(g && g.state && g.state.realPols === false); }
export function setRealPols(g, on) {
  if (!g || !g.state) return false;
  const p = ensurePol(g);
  if (on) { g.state.realPols = true; realSync(g, p); return true; }
  g.state.realPols = false;
  for (const n of Object.values(p.npcs)) if (n.real) realRestore(p, n);
  if (p.real) { p.real.map = {}; p.real.served = []; }
  return true;
}
export function realList(g) {
  const p = ensurePol(g);
  const map = (p.real && p.real.map) || {};
  return REAL_ORDER.map((k) => { const n = p.npcs[map[k]]; const pt = n && p.parties[n.party]; return { key: k, name: REAL[k].name, party: REAL[k].party, tag: REAL[k].tag, id: n ? n.id : null, seated: !!n, role: n && pt ? (pt.leader === n.id ? (pt.leaderTitle || '党首') : Object.entries(pt.posts || {}).filter(([, v]) => v === n.id).map(([k2]) => postName(k2, fyOfAbs(p, absOfDay(p, today(g))), pt.id))[0] || '') : '' }; });
}
// A Diet member of the party without a cabinet post (reused), or a new fictional one.
function pickMinister(p, party, taken = {}) {
  const busy = new Set(Object.values(taken));
  const pool = Object.values(p.npcs).filter((n) => n.party === party && (n.office === 'shugi' || n.office === 'sangi') && !busy.has(n.id) && !n.posts.some((x) => POSTS[x] && POSTS[x].kind !== 'party') && n.wins >= 3 && n.id !== p.cabinet.pm);
  // [R11-P] the agents' merit, readiness, loyalty and the faction balance choose (seeded); a new face still appears when the bench is thin
  const ai = INTRA.ai;
  if (pool.length >= 3 || (pool.length && (ai ? ai.rr(p, 'reuse', ai.S(p).day, pool.length, Object.keys(taken).length) : Math.random()) < 0.7)) return (ai && ai.pickMinister(p, pool, party, taken)) || pickOne(pool);
  const pt = p.parties[party];
  const fac = pt && pt.factions && pt.factions.length ? pickOne(pt.factions).id : null;
  const n = newNpc(p, { party, house: Math.random() < 0.85 ? 'shugi' : 'sangi', wins: irnd(4, 11), faction: fac, age: irnd(50, 75) });
  n.office = n.house;
  return n;
}
// Drop NPC records nobody refers to any more (keeps saves small).
function pruneNpcs(p) {
  const keep = new Set();
  const add = (id) => { if (id && id !== 'player') keep.add(id); };
  add(p.cabinet.pm);
  for (const id of Object.values((p.real && p.real.map) || {})) add(id); // [R14-P] the real figures are never dropped
  for (const id of Object.values(p.cabinet.ministers || {})) add(id);
  for (const pt of Object.values(p.parties)) { add(pt.leader); for (const f of pt.factions || []) add(f.leader); for (const id of Object.values(pt.posts || {})) add(id); }
  for (const k of ['kucho', 'chiji']) add(p.local[k] && p.local[k].holder);
  for (const k of ['speaker_shugi', 'speaker_sangi', 'chair_budget', 'homeIncumbent', 'outgoingLeader']) add(p.flags[k]);
  for (const h of Object.values(p.flags.smdHolders || {})) add(h && h.npc);
  for (const b of p.diet.bills) add(b.by);
  for (const o of p.me.offers || []) add(o.from);
  try { for (const id of INTRA.refs(p)) add(id); } catch (e) { console.error(e); } // R5-D: 番頭・後継者・首謀者など
  try { if (INTRA.ai) for (const id of INTRA.ai.refs(p)) add(id); } catch (e) { console.error(e); } // [R11-P] mentors, heirs, strong memories of the player
  // [R11-P] the agent layer keeps the most important spare members (rank, seniority, newcomers and heirs), not the oldest records
  if (INTRA.ai) { INTRA.ai.prune(p, keep); return; }
  const ids = Object.keys(p.npcs);
  // keep up to ~25 spare Diet members per party for reuse
  const spare = {};
  for (const id of ids) {
    if (keep.has(id)) continue;
    const n = p.npcs[id];
    if (n.office === 'shugi' || n.office === 'sangi') { spare[n.party] = (spare[n.party] || 0) + 1; if (spare[n.party] <= 25) continue; }
    delete p.npcs[id];
  }
}
// Choose the governing coalition after an election / resignation: returns { core, partners, seats }.
function chooseCoalition(g, p) {
  const H = p.diet.shugi;
  const need = Math.floor(H.total / 2) + 1;
  const ids = Object.keys(p.parties).filter((id) => num(H.seats[id]) > 0).sort((a, b) => H.seats[b] - H.seats[a]);
  if (!ids.length) return { core: Object.keys(p.parties)[0], partners: [], seats: 0 };
  const dist = (a, b) => { const A = p.parties[a].ideology, B = p.parties[b].ideology; return Math.abs(A.econ - B.econ) + Math.abs(A.social - B.social) + Math.abs(A.security - B.security); };
  const willing = (core, id) => {
    // ext (regime.js, feature-detected): the real-party coalition rule — a real party does not join (or take in the
    // player's party) where the regime rule refuses it
    if (typeof g.regimeCoalitionBlock === 'function') {
      try { if (g.regimeCoalitionBlock(id, { core }) || (id === p.me.party && g.regimeCoalitionBlock(core, { core, partner: id }))) return false; } catch (e) { console.error(e); }
    }
    if (p.parties[id].leader === 'player') {
      const st = p.me.coalitionStance;
      if (st === 'refuse') return false;
      if (st === 'accept') return true;
      return dist(core, id) < 2.6;
    }
    const base = dist(core, id) < 3.2;
    // [R11-P] the party leaders (agents) may veto or open a door the distance rule decides (compatibility, appetite for posts, the opposition's strategy)
    if (INTRA.ai) { try { const w = INTRA.ai.coalitionWilling(g, p, core, id, base); if (w === true || w === false) return w; } catch (e) { console.error(e); } }
    return base;
  };
  const build = (core, excl = []) => {
    const partners = [];
    let s = num(H.seats[core]);
    // keep friendly partners even with a majority (as real coalitions often do)
    const prevPartners = (p.cabinet.partyIds || []).filter((id) => id !== core && p.parties[id] && num(H.seats[id]) > 0 && willing(core, id) && !excl.includes(id));
    for (const id of prevPartners) { partners.push(id); s += num(H.seats[id]); }
    const rest = ids.filter((id) => id !== core && !partners.includes(id) && !excl.includes(id)).sort((a, b) => dist(core, a) - dist(core, b));
    for (const id of rest) { if (s >= need) break; if (!willing(core, id)) continue; partners.push(id); s += num(H.seats[id]); }
    return { core, partners, seats: s };
  };
  const first = build(ids[0]);
  if (first.seats >= need) return first;
  // an alternative coalition without the largest party (政権交代 like 1993)
  if (ids[1]) {
    const alt = build(ids[1], [ids[0]]);
    if (alt.seats >= need && Math.random() < 0.45) return alt;
  }
  return first; // minority government: the largest party wins the run-off of 首班指名
}
// 首班指名: both houses vote; the 衆院 decides if they differ (両院協議会 → 衆院の議決).
function electPMImpl(g, p) {
  const c = chooseCoalition(g, p);
  const party = p.parties[c.core];
  let leader = party ? party.leader : null;
  // 憲法67条: the PM is named from among the Diet members. A player leader without a seat (or
  // who has just resigned as PM) is not named: the party puts forward another member.
  const skipPlayer = !!p.flags.skipPlayerPM;
  p.flags.skipPlayerPM = false;
  // ext (2026-10 fix, regime.js g.regimeBarred, feature-detected): the former PM of the もしも emergency / dictatorship
  // is not named again, nor appointed to any cabinet post
  const barred = !!playerBarred(g, 'pm');
  if (leader === 'player' && (!isNational(p.me) || skipPlayer || barred)) leader = partyNominee(p, c.core).id;
  if (leader && leader !== 'player' && !p.npcs[leader]) leader = partyNominee(p, c.core).id;
  const partyIds = [c.core, ...c.partners];
  const prevPM = p.cabinet.pm;
  const sangiBloc = partyIds.reduce((a, id) => a + num(p.diet.sangi.seats[id]), 0);
  const votes = { shugi: c.seats, sangi: sangiBloc, shugiTotal: p.diet.shugi.total, sangiTotal: p.diet.sangi.total };
  const sangiDiffers = sangiBloc <= p.diet.sangi.total / 2 && Math.random() < 0.6;
  p.flags.pmNo = num(p.flags.pmNo, PM_NO[p.era] || 100) + 1;
  // the same PM named again (after a general election or a won leader race) keeps the public's
  // view of the cabinet: no new honeymoon (review: snap elections were a free approval reset)
  const prevC = p.cabinet;
  const same = !!leader && leader === prevPM;
  p.cabinet = same
    ? { pm: leader, partyIds, ministers: prevC.ministers || {}, approval: clamp(num(prevC.approval, 45) + rnd(2, 5), 3, 90), formed: num(prevC.formed, today(g)), honeymoon: num(prevC.honeymoon), mood: num(prevC.mood), scandal: num(prevC.scandal), lowWeeks: 0, low30: 0, history: Array.isArray(prevC.history) ? prevC.history : [], challengeDay: prevC.challengeDay || null, snaps: num(prevC.snaps) }
    : { pm: leader, partyIds, ministers: prevC.ministers || {}, approval: clamp(rnd(45, 68) + (leader === 'player' ? Math.min(15, Math.log10(1 + num(g.state.fame)) * 3) : 0), 20, 85), formed: today(g), honeymoon: 15, mood: 0, scandal: 0, lowWeeks: 0, low30: 0, history: [] };
  if (leader === 'player') {
    if (!p.me.posts.includes('pm')) p.me.posts.push('pm');
    if (!same) leaveShowsForCabinet(g, '内閣総理大臣');
    if (g.addFame) g.addFame(800, true);
    note(g, '（国会で内閣総理大臣に指名された！）');
    phoneNews(g, `【首班指名】${g.state.name}さんが第${p.flags.pmNo}代 内閣総理大臣に指名されました。`);
  } else if (p.me.posts.includes('pm')) p.me.posts = p.me.posts.filter((x) => x !== 'pm');
  // ministers: the player keeps a post only if their party is in the coalition and they still
  // sit in the Diet (a defeated minister is not appointed again)
  if ((p.me.party && !partyIds.includes(p.me.party)) || !isNational(p.me) || barred) p.me.posts = p.me.posts.filter((x) => !(POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm'));
  fillCabinet(g, p, { keepPlayer: true });
  if (leader !== 'player') offerPostToPlayer(g, p);
  const name = leader === 'player' ? g.state.name : (p.npcs[leader] && p.npcs[leader].name) || '';
  news(p, g, `首班指名：${name}氏が内閣総理大臣に（${partyIds.map((id) => pname(p, id)).join('・')}）${sangiDiffers ? '。参院は別の人を指名したが、衆院の議決が優先' : ''}`);
  if (prevPM !== leader && leader !== 'player') phoneNews(g, `【新内閣】${name}内閣が発足しました。\n与党：${partyIds.map((id) => pname(p, id)).join('・')}`);
  emit(g, 'cabinet', { pm: leader, partyIds, formed: today(g) });
  return { pm: leader, name, partyIds, votes, sangiDiffers, minority: c.seats < Math.floor(p.diet.shugi.total / 2) + 1 };
}
// At an NPC PM's 内閣改造 a minister is kept on only on their record (review): answers in the Diet,
// reputation, no recent gaffe or scandal, a cabinet that is doing well. Otherwise they leave the
// cabinet (often to a party post).
function reshuffleKeepPlayer(g, p) {
  const me = p.me;
  const mine = me.posts.filter((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm');
  if (!mine.length) return;
  const recent = me.scandalDay && today(g) - num(me.scandalDay) < 60;
  const keep = clamp(0.4 + num(me.reputation) / 200 + (num(p.cabinet.approval) - 40) / 100 + Math.min(0.2, num(me.answers) * 0.01) - (recent ? 0.25 : 0), 0.1, 0.85);
  if (Math.random() < keep) return;
  const fy = fyNow(g);
  for (const post of mine) { me.posts = me.posts.filter((x) => x !== post); if (p.cabinet.ministers[post] === 'player') p.cabinet.ministers[post] = null; }
  note(g, `（内閣改造で、${mine.map((x) => postName(x, fy)).join('・')}を退任することになった。おつかれさまでした）`);
  news(p, g, `内閣改造：${g.state.name}${postName(mine[0], fy)}は退任`);
  me.answers = 0;
  offerPartyPost(g, p);
}
// An NPC PM may invite the player into the cabinet (accept with g.respondOffer).
function offerPostToPlayer(g, p, force = false) {
  const me = p.me;
  if (!me.party || !isRuling(p, me.party)) return null;
  if (playerBarred(g)) return null; // regime.js g.regimeBarred (2026-10 fix)
  if (me.office !== 'shugi' && me.office !== 'sangi') return null;
  const fame = num(g.state.fame);
  const fy = fyNow(g);
  const posts = cabinetPosts(fy, p.flags).filter((x) => x !== 'kanbo' && p.cabinet.ministers[x] !== 'player');
  if (!posts.length || me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet')) return null;
  // review: 入閣 usually comes after several terms (自民 は 当選5回前後 が目安); a newer member only
  // rarely, as a famous outsider (民間・タレント枠) for a 内閣府特命担当 post
  let post = null;
  if (force) post = posts.includes('minister_special') && fame >= 1000 ? 'minister_special' : pickOne(posts);
  else if (me.nationalWins >= 3 && me.standing >= 75) { if (Math.random() < 0.5) return null; post = posts.includes('minister_special') && fame >= 3000 && Math.random() < 0.5 ? 'minister_special' : pickOne(posts); }
  else if (fame >= 3000 && posts.includes('minister_special') && Math.random() < 0.12) post = 'minister_special';
  if (!post) return null;
  const o = { id: 'o' + p.nextId++, kind: 'post', post, day: today(g), until: today(g) + 3, from: p.cabinet.pm };
  me.offers.push(o);
  phoneNews(g, `【入閣の打診】総理から「${postName(post, fy)}」をお願いしたいと連絡がありました。\n（3日以内に返事を）`, '総理大臣官邸');
  emit(g, 'offer', o);
  return o;
}
function resignCabinet(g, p, reason) {
  const pm = p.cabinet.pm;
  const name = pm === 'player' ? g.state.name : (p.npcs[pm] && p.npcs[pm].name) || '';
  news(p, g, `${name}内閣が総辞職${reason ? `（${reason}）` : ''}`);
  phoneNews(g, `【内閣総辞職】${name}内閣が総辞職しました${reason ? `（${reason}）` : ''}。`);
  emit(g, 'resign', { pm, reason, who: 'cabinet' });
  const pmParty = cabinetPartyOfPM(p);
  if (pm === 'player') { p.me.posts = p.me.posts.filter((x) => x !== 'pm'); p.flags.skipPlayerPM = true; }
  p.cabinet.history = [];
  p.cabinet.resigned = today(g); // a caretaker cabinet until the next 首班指名 (憲法71条)
  // the PM's party picks a new leader first: the PM steps down as party leader too
  const pt = p.parties[pmParty];
  if (pt && pt.leader === pm && !pt.isPlayers) {
    if (pm === 'player') stepDownLeader(g, p, reason || '総理の辞任');
    else { p.flags.outgoingLeader = pm; leaderRaceSoon(g, p, pmParty, today(g) + 6, reason); }
    p.cabinet.pending = null;
  } else p.cabinet.pending = { kind: 'shuhan', day: today(g) + 2, reason };
}
// A Diet member of the party who can stand for PM / act as leader (the 幹事長 when they sit in the Diet).
function partyNominee(p, partyId) {
  const pt = p.parties[partyId];
  const kj = pt && pt.posts && pt.posts.kanjicho;
  const n = kj && kj !== 'player' && p.npcs[kj];
  if (n && (n.office === 'shugi' || n.office === 'sangi') && n.id !== p.flags.outgoingLeader) return n;
  const m = pickMinister(p, partyId, p.flags.outgoingLeader ? { x: p.flags.outgoingLeader } : {});
  if (!m.office) m.office = m.house || 'shugi';
  return m;
}
// A leadership race of a party soon (an earlier race on the calendar is moved forward).
function leaderRaceSoon(g, p, partyId, day, reason = '') {
  const kd = kojiDays(ELECTION_KINDS.sosaisen.campaignDays);
  const old = p.elections.upcoming.find((e) => e.kind === 'sosaisen' && e.party === partyId && e.status !== 'done');
  if (old) {
    if (old.day > day) { old.day = Math.max(today(g) + 2, Math.round(day)); old.koji = Math.max(today(g), old.day - kd); old.status = 'scheduled'; p.elections.upcoming.sort((a, b) => a.day - b.day); }
    old.reason = reason || old.reason;
    return old;
  }
  const e = addElection(p, { kind: 'sosaisen', party: partyId, day, reason });
  e.label = electionLabel(p, e);
  return e;
}
// 党則の多選制限: 自民党は連続2期まで（2017年から3期）。ほかの党は制限なし（目安）.
const leaderTermLimit = (partyId, year) => (partyId === 'jimin' ? (year >= 2017 ? 3 : 2) : INF);
// The player steps down as leader of a party they did not found (総裁・代表の辞任): an NPC
// acts as leader until a leadership race picks the next one.
function stepDownLeader(g, p, reason = '辞任') {
  const me = p.me;
  const pt = p.parties[me.party];
  if (!pt || pt.leader !== 'player' || pt.isPlayers) return null;
  p.flags.outgoingLeader = 'player';
  const acting = partyNominee(p, pt.id);
  pt.leader = acting.id;
  me.posts = me.posts.filter((x) => x !== 'party_leader');
  me.leaderTerms = 0;
  const title = postName('party_leader', calYear(g), pt.id);
  note(g, `（${pt.name}の${title}を辞任した${reason ? `（${reason}）` : ''}）`);
  news(p, g, `${g.state.name}${title}が辞任を表明${reason ? `（${reason}）` : ''}。${pt.name}は${title}選挙へ`);
  return leaderRaceSoon(g, p, pt.id, today(g) + 6, reason);
}
// 内閣不信任案 passed / failed.
function resolveNoConfidence(g, p, b, v) {
  b.closed = today(g);
  if (!v.passed) {
    b.stage = 'rejected';
    b.result = '否決';
    news(p, g, `内閣不信任決議案は否決（${v.yes}対${v.no}）`);
    // (the screens that submit it show the vote at once: politics_ui, the console, kokkai.js)
    return;
  }
  b.stage = 'enacted';
  b.result = '可決';
  news(p, g, `内閣不信任決議案が可決された（${v.yes}対${v.no}）！10日以内に解散か総辞職`);
  phoneNews(g, `【速報】内閣不信任決議案が可決（賛成${v.yes}・反対${v.no}）。内閣は10日以内に衆議院を解散するか、総辞職しなければなりません（憲法69条）。`);
  p.cabinet.noConfidence = today(g);
  if (p.cabinet.pm === 'player') { note(g, '（不信任案が可決された！10日以内に「解散」か「総辞職」を選ばなければ…）'); p.cabinet.pending = { kind: 'ncDeadline', day: today(g) + 3 }; return; }
  if (num(p.cabinet.approval) >= 26 || Math.random() < 0.5) dissolveImpl(g, p, '不信任案の可決を受けて');
  else resignCabinet(g, p, '不信任案の可決');
}
function dissolveImpl(g, p, reason = '') {
  const day = today(g);
  if (p.diet.shugi.dissolved) return null;
  // 「大義なき解散」: dissolving a house elected less than a year ago (not after a no-confidence vote)
  // is seen as a power play: approval falls, the ruling side loses some support, fewer people vote
  const since = absOfDay(p, day) - num(p.diet.shugi.last);
  if (since < YEAR_DAYS && !/不信任/.test(reason)) {
    // the sooner, the worse: a house only weeks old is dissolved for the PM's convenience
    // and each further snap election of the same PM is resented more (解散権の乱用)
    const snaps = p.cabinet.pm ? num(p.cabinet.snaps) : 0;
    p.cabinet.snaps = snaps + 1;
    const k = (since < YEAR_DAYS / 2 ? 1.6 : 1) * (1 + 0.5 * snaps);
    p.cabinet.mood = clamp(num(p.cabinet.mood) - 4 * k, -20, 20);
    p.cabinet.approval = clamp(num(p.cabinet.approval) - rnd(6, 10) * k, 3, 90);
    for (const id of p.cabinet.partyIds || []) if (p.parties[id]) addSupportAll(p, id, -0.006 * k);
    p.flags.snapTurnout = since < YEAR_DAYS / 2 ? 0.88 : 0.92;
    if (p.cabinet.pm === 'player' && k > 1) { p.me.standing = clamp(p.me.standing - 10, 0, 100); note(g, '（党内からも「議員を選挙に追い立てるのか」と反発の声が上がっている…）'); }
    news(p, g, '「大義なき解散」との批判が広がる（前の総選挙から1年もたっていない）');
  }
  p.diet.shugi.dissolved = true;
  p.diet.session = null;
  for (const b of p.diet.bills) if (!['enacted', 'rejected', 'shelved', 'draft', 'referendum'].includes(b.stage)) { b.stage = 'shelved'; b.result = '解散で廃案'; b.closed = day; }
  p.elections.upcoming = p.elections.upcoming.filter((e) => !(e.kind === 'shugi' && e.status !== 'done') && !(e.kind === 'hosen' && e.house !== 'sangi'));
  const e = addElection(p, { kind: 'shugi', day: day + 11, reason: '解散' });
  e.label = electionLabel(p, e);
  if (p.me.office === 'shugi') { p.me.office = null; p.me.formerOffice = 'shugi'; note(g, '（衆議院が解散された。前議員として、選挙に挑むことになる）'); }
  news(p, g, `衆議院が解散された${reason ? `（${reason}）` : ''}。${dateLabel(g, e.day)}に総選挙`);
  phoneNews(g, `【衆議院解散】${reason ? reason + '。' : ''}総選挙は${dateLabel(g, e.day)}、公示は${dateLabel(g, e.koji)}です。`);
  emit(g, 'dissolve', { election: e, reason });
  return e;
}

// ================================================================ polls
function pmQuality(g, p) {
  const pm = p.cabinet.pm;
  if (pm === 'player') return Math.min(8, Math.log10(1 + num(g.state.fame)) * 1.6 + p.me.reputation / 25 + num(g.state.skills && g.state.skills.talk) / 30) - 3;
  const n = p.npcs[pm];
  return n ? (n.traits.charisma - 50) / 6 : 0;
}
function weeklyPoll(g, p) {
  const C = p.cabinet;
  const E = p.economy;
  const day = today(g);
  const fy = fyNow(g);
  const T = ecoTrend(fy);
  const days = Math.max(0, day - num(C.formed, day));
  const honey = num(C.honeymoon) * Math.exp(-days / 45);
  const eco = 2.5 * (E.growth - T.growth) - 2.0 * Math.max(0, E.inflation - 2.5) - 3 * (E.unemployment - T.unemployment);
  const fatigue = -Math.min(14, days / 40);
  const deficit = -clamp(deficitRatio(E) - 9, 0, 10) * 0.4; // 「ばらまき」批判 when the deficit balloons
  const pmq = pmQuality(g, p);
  p.flags.nejire = nejireNow(p);
  const target = 38 + honey + eco + num(C.mood) + num(C.scandal) + fatigue + deficit + pmq + (p.flags.nejire ? -2 : 0);
  // ext (hook for govt.js, A1): the parts of this week's target, read by g.approvalBreakdown()
  const r1 = (v) => Math.round(num(v) * 10) / 10;
  C.parts = { base: 38, honeymoon: r1(honey), economy: r1(eco), policy: r1(C.mood), scandal: r1(C.scandal), fatigue: r1(fatigue), deficit: r1(deficit), pm: r1(pmq), nejire: p.flags.nejire ? -2 : 0, target: r1(target) };
  C.approval = clamp(num(C.approval, 45) * 0.6 + target * 0.4 + gauss() * 2.5, 3, 90);
  C.mood = num(C.mood) * 0.85;
  C.scandal = num(C.scandal) * 0.8;
  const support = {};
  for (const id of Object.keys(p.parties)) support[id] = Math.round(natSupport(p, id, fy) * 1000) / 10;
  const none = Math.round(SEGMENT_ORDER.reduce((a, s) => a + segWeights(Math.floor(fy))[s] * num(p.opinion[s] && p.opinion[s].none), 0) * 1000) / 10;
  const poll = { day, approval: Math.round(C.approval * 10) / 10, support, none, parts: { ...C.parts } };
  p.polls.push(poll);
  if (p.polls.length > 60) p.polls.splice(0, p.polls.length - 60);
  C.lowWeeks = C.approval < 20 ? num(C.lowWeeks) + 1 : 0;
  if (C.lowWeeks >= 3 && C.pm !== 'player' && !C.pending && !C.resigned && Math.random() < 0.5) C.pending = { kind: 'resign', day: day + 2, reason: '支持率の低迷' };
  if (C.pm === 'player' && C.lowWeeks >= 6 && !(p.parties[p.me.party] && p.parties[p.me.party].isPlayers) && !C.pending && !C.resigned) {
    note(g, '（支持率の低迷が続き、党内から「総理おろし」の声が…。退陣に追いこまれた）');
    C.pending = { kind: 'resign', day: day + 1, reason: '党内の退陣要求' };
  }
  // review: below 30% for a month, the party starts to worry about the next election (「選挙の顔」).
  // The closer the vote and the weaker the PM in the party, the likelier an early leader race, which
  // the player must win to stay on.
  C.low30 = C.approval < 30 ? num(C.low30) + 1 : 0;
  const myPt = p.parties[p.me.party];
  if (C.pm === 'player' && C.low30 >= 4 && myPt && !myPt.isPlayers && myPt.leader === 'player' && !C.pending && !C.resigned && day - num(C.challengeDay, -999) > 60
    && !p.elections.upcoming.some((e) => e.kind === 'sosaisen' && e.party === myPt.id && e.status !== 'done' && e.day - day < 30)) {
    const nextVote = p.elections.upcoming.filter((e) => (e.kind === 'shugi' || e.kind === 'sangi') && e.status !== 'done').reduce((a, e) => Math.min(a, e.day - day), INF);
    const soon = nextVote < YEAR_DAYS ? 0.3 * (1 - nextVote / YEAR_DAYS) : 0;
    const chance = clamp(0.15 + soon + (30 - C.approval) / 100 - (p.me.standing - 60) / 200, 0.05, 0.7);
    if (Math.random() < chance) {
      C.challengeDay = day;
      note(g, '（支持率の低迷に、党内から「このままでは選挙を戦えない」という声。派閥の領袖たちが、党首選の前倒しを求めてきた…）');
      news(p, g, `${g.state.name}総理の支持率低迷で、党内に退陣を求める動き。党首選が前倒しに`);
      leaderRaceSoon(g, p, myPt.id, day + 8, '党内の退陣要求');
    }
  }
  emit(g, 'poll', poll);
  return poll;
}

// ================================================================ scandals
export const SCANDALS = {
  slush_fund: { name: '政治資金収支報告書への不記載（裏金）', rep: -25, local: -15, severity: 4, crime: 'slush_fund' },
  bribery: { name: '収賄の疑い', rep: -35, local: -20, severity: 5, crime: 'bribery_take' },
  vote_buying: { name: '選挙違反（買収）の疑い', rep: -30, local: -20, severity: 5, crime: 'vote_buying' },
  expense: { name: '政治資金の私的な流用', rep: -15, local: -8, severity: 3 },
  antisocial: { name: '反社会的勢力との交際', rep: -25, local: -10, severity: 4 },
  gaffe: { name: '失言', rep: -8, local: -3, severity: 2 },
  private: { name: '私生活のスキャンダル', rep: -12, local: -5, severity: 2 },
  absence: { name: '国会の欠席', rep: -6, local: -2, severity: 1 },
};
// who: 'player' | npcId. Returns the scandal record (also emitted as 'scandal').
function scandalImpl(g, p, kind, opts = {}) {
  if (opts.who && opts.who !== 'player' && p.npcs[opts.who] && p.npcs[opts.who].real) return null; // [R14-P] never about a real person
  const S = SCANDALS[kind] || { name: opts.name || 'スキャンダル', rep: -10, local: -5, severity: opts.severity || 2 };
  const who = opts.who || 'player';
  const sev = opts.severity || S.severity;
  const rec = { kind, name: opts.name || S.name, who, severity: sev, amount: num(opts.amount), day: today(g), crime: S.crime || null };
  if (who === 'player') {
    const me = p.me;
    me.reputation = clamp(me.reputation + S.rep, -100, 100);
    me.localSupport = clamp(me.localSupport + S.local, 0, 100);
    me.standing = clamp(me.standing - sev * 5, 0, 100);
    me.scandalDay = today(g);
    if (me.party && p.parties[me.party]) addSupportAll(p, me.party, -0.003 * sev);
    if (me.party && isRuling(p, me.party)) p.cabinet.scandal = num(p.cabinet.scandal) - sev * (p.cabinet.pm === 'player' ? 4 : 1.5);
    if (g.addFame) g.addFame(-sev * 20, true);
    news(p, g, `${g.state.name}${playerTitle(g, p)}に${rec.name}が発覚`);
    phoneNews(g, `【スクープ】${g.state.name}氏に${rec.name}${rec.amount ? `（${fmtMoney(rec.amount)}）` : ''}が発覚。\n${sev >= 4 ? '捜査当局も関心を寄せているという。' : '説明責任を問う声が上がっている。'}`, '週刊ドット');
    // ministers resign over serious scandals; parties distance themselves
    const cab = me.posts.filter((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm');
    if (sev >= 3 && cab.length) { for (const post of cab) resignPostImpl(g, p, post, rec.name); }
    if (sev >= 4 && me.posts.includes('pm') && Math.random() < 0.5) p.cabinet.pending = { kind: 'resign', day: today(g) + 2, reason: rec.name };
    if (sev >= 5 && me.party && p.parties[me.party] && !p.parties[me.party].isPlayers) { note(g, `（${rec.name}で、党から離党を求められた…）`); leavePartyImpl(g, p, '離党勧告'); }
  } else {
    const n = p.npcs[who];
    // NPCs of a real party (自民・民主) are never shown in a scandal (neutral step-down instead)
    if (n && PARTY_DEFS[n.party] && PARTY_DEFS[n.party].real) { npcStepDown(g, p, n, '一身上の都合'); return { ...rec, kind: 'stepdown', name: '辞任', severity: 0 }; }
    if (n) {
      const post = n.posts.find((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && (x === 'pm' ? p.cabinet.pm === who : p.cabinet.ministers[x] === who));
      news(p, g, `${n.name}${post ? postName(post, fyNow(g)) : '議員'}に${rec.name}`);
      if (n.party && p.parties[n.party]) addSupportAll(p, n.party, -0.002 * sev);
      if (post && post !== 'pm' && sev >= 2) {
        p.cabinet.scandal = num(p.cabinet.scandal) - sev * 1.5;
        n.posts = n.posts.filter((x) => x !== post);
        const m = pickMinister(p, n.party, p.cabinet.ministers);
        m.posts.push(post);
        p.cabinet.ministers[post] = m.id;
        news(p, g, `${n.name}氏が${postName(post, fyNow(g))}を辞任。後任に${m.name}氏`);
      } else if (post === 'pm') { p.cabinet.scandal = num(p.cabinet.scandal) - sev * 4; }
    }
  }
  emit(g, 'scandal', rec);
  return rec;
}
function resignPostImpl(g, p, post, reason = '') {
  const me = p.me;
  if (!me.posts.includes(post)) return false;
  me.posts = me.posts.filter((x) => x !== post);
  const fy = fyNow(g);
  if (POSTS[post] && POSTS[post].kind === 'cabinet' && post !== 'pm') {
    const m = pickMinister(p, cabinetPartyOfPM(p) || p.cabinet.partyIds[0], p.cabinet.ministers);
    m.posts.push(post);
    p.cabinet.ministers[post] = m.id;
    note(g, `（${postName(post, fy)}を辞任した${reason ? `（${reason}）` : ''}）`);
    news(p, g, `${g.state.name}${postName(post, fy)}が辞任${reason ? `（${reason}）` : ''}`);
  } else if (POSTS[post] && POSTS[post].kind === 'party') {
    const pt = p.parties[me.party];
    if (pt && pt.posts[post] === 'player') { const n = newNpc(p, { party: pt.id, office: 'shugi', house: 'shugi', wins: irnd(4, 10) }); n.posts.push(post); pt.posts[post] = n.id; }
  }
  emit(g, 'resign', { who: 'player', post, reason });
  return true;
}

// ================================================================ money
function ledger(p, year) {
  const L = p.me.ledger;
  if (!L[year]) L[year] = { income: 0, expense: 0, donations: 0, parties: 0, secret: 0 };
  const keys = Object.keys(L).map(Number).sort((a, b) => a - b);
  while (keys.length > 6) delete L[keys.shift()];
  return L[year];
}
// 税・社会保険料 (目安): pay is handed over after 所得税・住民税・社会保険料 (源泉徴収・特別徴収),
// a rough rate on the year's pay. review: political pay is real yen like the rest of the game's legal
// amounts, so what is left after tax and the costs of politics is what matters.
function withholding(annual) { return 0.2 + 0.18 * clamp((num(annual) - 5e6) / 2e7, 0, 1); }
function payday(g, p, doy, year) {
  const me = p.me;
  const O = OFFICES[me.office];
  const st = g.state;
  if (O) {
    const top = me.posts.includes('pm') ? 1150000 : me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet') ? 500000 : 0; // 総理・大臣の上乗せ（目安）
    // a council member who skipped the last 定例会 has 報酬 cut (条例による減額, 目安 half)
    const cut = (me.office === 'kugi' || me.office === 'togi') && num(me.localAbsentUntil) > today(g) ? 0.5 : 1;
    const salary = Math.round((O.salary + top) * cut);
    const rate = withholding((O.salary + top) * (12 + 2 * (BONUS_MONTHS[O.level] || 2)));
    const net = Math.round(salary * (1 - rate));
    st.money = Math.max(0, st.money + net);
    const al = O.allowance || 0;
    me.funds += al;
    const lg = ledger(p, year);
    lg.income += al;
    // 事務所・活動の経費, 私設秘書, and the 派閥の会費 (dues) of a member of a faction
    const pt0 = p.parties[me.party];
    const fac = pt0 && (pt0.factions || []).find((x) => x.id === me.faction);
    const dues = fac && fac.kind === 'faction' && isNational(me) ? 100000 : 0;
    const cost = (OFFICE_COST[O.level] || 0) + me.staff * STAFF_COST + dues;
    if (dues) fac.funds = num(fac.funds) + dues;
    me.funds -= cost;
    lg.expense += cost;
    if (me.funds < 0) {
      const need = -me.funds;
      const take = Math.min(need, st.money);
      st.money -= take;
      me.funds += take;
      if (me.funds < 0 && me.staff > 0) { me.staff--; note(g, '（事務所の経費が払えず、秘書がひとり辞めていった…）'); }
      else if (take > 0 && !me.payNote) { me.payNote = true; note(g, `（政治資金が足りず、事務所の経費 ${fmtMoney(take)} を自分のお金から出した。寄付やパーティーで資金を集めないと…）`); }
    }
    if (g.notify) g.notify(`${O.level === 'national' ? '歳費' : O.level === 'exec' ? `${O.short}の給料` : `${O.short}の報酬`} ${fmtMoney(salary)}（手取り ${fmtMoney(net)}）${cut < 1 ? '・欠席で減額' : ''}${al ? `・${O.level === 'national' ? allowanceName(year) : O.allowanceName} ${fmtMoney(al)}` : ''}`, { color: '#fff', life: 160 });
    if (doy === 50 || doy === 110) {
      const bonus = Math.round(O.salary * (BONUS_MONTHS[O.level] || 2) * cut);
      const bnet = Math.round(bonus * (1 - rate));
      st.money += bnet;
      if (g.notify) g.notify(`期末手当 ${fmtMoney(bonus)}（手取り ${fmtMoney(bnet)}）`, { color: '#fff', life: 160 });
    }
    emit(g, 'payday', { salary, net, allowance: al, cost });
  }
  // a month in a party post or the cabinet is what builds standing in the party
  if (me.party && me.posts.some((x) => POSTS[x] && (POSTS[x].kind === 'party' || POSTS[x].kind === 'cabinet'))) me.standing = clamp(me.standing + gainTo(me.standing, 1.5), 0, 100);
  // 立法事務費 to the 会派 (party) of every Diet member, and what a party spends every month
  // (review): 本部の職員・事務所・広報・政策調査, an amount per member, and most of the 政党交付金
  // over the year (選挙・広報・組織活動). Elections cost more (公認料・選挙資金: see partyElectionSpend).
  for (const pt of Object.values(p.parties)) {
    const n = partySeats(p, pt.id);
    pt.funds = num(pt.funds) + n * LEGISLATIVE_FEE;
    const spend = (pt.isPlayers ? 1500000 : 5000000) + n * 600000 + num(pt.subsidy) * 0.08;
    pt.funds = Math.max(0, num(pt.funds) - Math.round(spend));
  }
  if ((doy === 60 || doy === 110) && me.faction && (me.office === 'shugi' || me.office === 'sangi')) {
    const pt = p.parties[me.party];
    const f = pt && pt.factions.find((x) => x.id === me.faction);
    if (f && f.kind === 'faction' && num(f.funds) > 0) {
      const amt = Math.min(num(f.funds), 2000000 + me.nationalWins * 500000);
      f.funds -= amt;
      me.funds += amt;
      ledger(p, year).income += amt;
      note(g, `（派閥から${doy === 60 ? '夏' : '冬'}の活動費 ${fmtMoney(amt)} を受け取った。政治資金として報告が必要だ）`);
    }
  }
}
// Election costs (review). 選挙運動費用 (事務所・人件費・はがき・ビラ・選挙カー; 目安, 選挙公営で
// ポスター・はがきの一部は公費) for the player at 公示/告示, partly paid by the party (公認料・活動費),
// and every party's spending on its candidates in a national election.
const ELECTION_COST = { shugi: 12000000, sangi: 15000000, hosen: 10000000, chiji: 30000000, shicho: 5000000, togi: 3000000, kugi: 1500000, sosaisen: 3000000 };
function playerElectionCost(g, p, e, d) {
  const me = p.me;
  const st = g.state;
  let cost = ELECTION_COST[e.kind] || 0;
  if (e.kind === 'sangi') cost = d.pr ? 10000000 : d.hometown ? 12000000 : 20000000;
  if (e.kind === 'shugi' && d.prOnly) cost = 4000000;
  if (!cost) return null;
  const pt = d.party && d.party !== IND ? p.parties[d.party] : null;
  const fromParty = pt ? Math.min(Math.max(0, num(pt.funds)) * 0.05, cost * (pt.isPlayers ? 0.8 : 0.5)) : 0;
  if (pt) pt.funds = num(pt.funds) - Math.round(fromParty);
  let left = cost - Math.round(fromParty);
  const fromFunds = Math.min(Math.max(0, me.funds), left);
  me.funds -= fromFunds; left -= fromFunds;
  const fromMoney = Math.min(Math.max(0, Math.floor(st.money * 0.5)), left); // never more than half of one's own money
  st.money -= fromMoney; left -= fromMoney;
  const lg = ledger(p, calYear(g));
  lg.expense += cost - left;
  if (fromParty) lg.income += Math.round(fromParty);
  d.cost = { cost, party: Math.round(fromParty), short: left };
  const lines = [`（選挙の費用 ${fmtMoney(cost)}：${fromParty ? `党の公認料・活動費 ${fmtMoney(Math.round(fromParty))}、` : ''}政治資金 ${fmtMoney(fromFunds)}${fromMoney ? `、自分のお金 ${fmtMoney(fromMoney)}` : ''}）`];
  if (left > 0) {
    // not enough money: a small office, few helpers
    if (me.campaign && me.campaign.election === e.id) me.campaign.points = Math.round(num(me.campaign.points) * 0.8 * 10) / 10;
    d.underfunded = true;
    lines.push(`（資金が ${fmtMoney(left)} 足りず、事務所も人手も最低限の選挙になった…）`);
  }
  note(g, lines.join('\n'));
  return d.cost;
}
function partyElectionSpend(p, e) {
  const per = e.kind === 'shugi' ? 10000000 : 12000000;
  for (const pt of Object.values(p.parties)) {
    const seats = e.kind === 'shugi' ? num(p.diet.shugi.seats[pt.id]) : Math.round(num(p.diet.sangi.seats[pt.id]) / 2);
    const nominees = Math.max(pt.isPlayers ? 1 : 2, Math.round(seats * 1.25));
    const want = nominees * per;
    const spend = Math.min(Math.max(0, num(pt.funds)) * 0.6, want);
    pt.funds = num(pt.funds) - Math.round(spend);
    pt.campaign = clamp((spend / Math.max(1, want)) * 10, 0, 10); // up to +2% of the vote (nationalShares)
  }
}
// 政党交付金: the year's total (250円 × 人口, 億円) split half by seats, half by votes; paid in 4 parts.
function subsidyYear(g, p, year) {
  if (!subsidyExists(year)) { for (const pt of Object.values(p.parties)) pt.subsidy = 0; return; }
  const pop = year < 2010 ? 126e6 : year < 2020 ? 127e6 : 124e6;
  const totalNominal = pop * 250;
  const rate = (ERAS[p.era] || ERAS.reiwa).priceRate || 1;
  const total = totalNominal / rate; // in game money (shown in that era's yen)
  const eligible = Object.values(p.parties).filter((pt) => partyStatusOf(p, pt.id).official && !(pt.flags && pt.flags.refuseSubsidy));
  const seatSum = eligible.reduce((a, pt) => a + partySeats(p, pt.id), 0) || 1;
  const voteSum = eligible.reduce((a, pt) => a + num(pt.voteShare.shugi) + num(pt.voteShare.sangi), 0) || 1;
  for (const pt of Object.values(p.parties)) pt.subsidy = 0;
  for (const pt of eligible) pt.subsidy = Math.round(total * 0.5 * (partySeats(p, pt.id) / seatSum) + total * 0.5 * ((num(pt.voteShare.shugi) + num(pt.voteShare.sangi)) / voteSum));
}
// 政党要件: 5 Diet members, or 1 member and 2% of the vote in the last national election.
function partyStatusOf(p, id) {
  const pt = p.parties[id];
  if (!pt) return { official: false, members: 0, seats: 0, subsidy: 0, reason: 'その政党はない' };
  const seats = partySeats(p, id);
  const vote = Math.max(num(pt.voteShare.shugi), num(pt.voteShare.sangi));
  const official = seats >= 5 || (seats >= 1 && vote >= 0.02);
  return { official, members: num(pt.members), seats, shugi: num(p.diet.shugi.seats[id]), sangi: num(p.diet.sangi.seats[id]), subsidy: num(pt.subsidy), voteShare: vote, funds: num(pt.funds), reason: official ? null : seats < 1 ? '国会議員がいない' : '国会議員5人以上か、得票率2%以上が必要' };
}
function exposureCheck(g, p) {
  const me = p.me;
  if (me.secret <= 0) return;
  let mult = 1 + 0.4 * num(p.flags.moneyStrict);
  if (me.posts.includes('pm')) mult *= 2; else if (me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet')) mult *= 1.5;
  if (num(g.state.fame) > 4000) mult *= 1.3;
  if (me.staff > 3) mult *= 1.2;
  const chance = Math.min(0.03, 0.0006 * Math.log10(1 + me.secret / 100000) * mult);
  if (Math.random() < chance) {
    const amount = me.secret;
    me.exposed = num(me.exposed) + amount;
    me.secret = 0;
    scandalImpl(g, p, 'slush_fund', { who: 'player', amount });
  }
}

// ================================================================ shocks & events
export const SHOCKS = {
  quake: { name: '大地震が発生', growth: -1.2, inflation: 0.2, unemployment: 0.2, yen: -3, nikkei: -6, len: 90, issue: 'disaster', perYear: 0.35, disaster: true },
  storm: { name: '大型台風・豪雨の被害', growth: -0.3, nikkei: -1, len: 30, issue: 'disaster', perYear: 0.8, disaster: true },
  recession: { name: '世界的な景気後退', growth: -1.8, unemployment: 0.6, yen: -8, nikkei: -15, len: 180, issue: 'economy', perYear: 0.12 },
  boom: { name: '株高と好景気', growth: 0.8, nikkei: 8, len: 120, issue: 'economy', perYear: 0.15 },
  yen_high: { name: '急激な円高', yen: -15, growth: -0.4, nikkei: -6, len: 90, issue: 'economy', perYear: 0.12 },
  yen_low: { name: '急激な円安', yen: 15, inflation: 0.6, nikkei: 4, len: 90, issue: 'energy', perYear: 0.12 },
  energy: { name: '資源価格の高騰', inflation: 1.2, growth: -0.4, len: 120, issue: 'energy', perYear: 0.12 },
};
function shockImpl(g, p, kind) {
  const S = SHOCKS[kind];
  if (!S) return null;
  const abs = absOfDay(p, today(g));
  const s = { kind, name: S.name, until: abs + S.len, len: S.len, growth: num(S.growth), inflation: num(S.inflation), unemployment: num(S.unemployment), yen: num(S.yen) };
  p.economy.shocks.push(s);
  if (S.nikkei) p.economy.nikkei *= 1 + S.nikkei / 100;
  if (S.issue) p.opinion.issues[S.issue] = clamp(num(p.opinion.issues[S.issue]) + 0.3, 0, 1);
  if (S.disaster) { p.flags.disasterDay = today(g); p.cabinet.mood = num(p.cabinet.mood) + (Math.random() < 0.5 ? 2 : -3); }
  news(p, g, S.name);
  if (kind === 'quake' || kind === 'recession') phoneNews(g, `【ニュース】${S.name}。政府は対応に追われている。`);
  emit(g, 'shock', s);
  return s;
}
// A minister (NPC) leaves the cabinet for a neutral reason; a successor is appointed.
function npcStepDown(g, p, n, reason) {
  if (n.real) return; // [R14-P] a real figure never steps down for a made-up reason
  const post = n.posts.find((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm' && p.cabinet.ministers[x] === n.id);
  if (!post) return;
  n.posts = n.posts.filter((x) => x !== post);
  const m = pickMinister(p, n.party, p.cabinet.ministers);
  m.posts.push(post);
  p.cabinet.ministers[post] = m.id;
  p.cabinet.scandal = num(p.cabinet.scandal) - 1;
  news(p, g, `${n.name}${postName(post, fyNow(g))}が${reason}で辞任。後任に${m.name}氏`);
}
function npcEvents(g, p) {
  // [R11-P] with the agent layer on, scandals, deaths and vacancies come from the agents themselves (politics_ai_act.js dailyEvents: who is exposed, who is old or ill); the shocks below stay
  if (!INTRA.ai) {
    // NPC troubles (about 4 a year). Scandals happen only to NPCs of the fictional parties (and
    // independents); an NPC of a real party (自民・民主) only ever steps down for neutral reasons
    // (体調不良・一身上の都合), so the game never claims misconduct by a real party.
    if (Math.random() < 4 / YEAR_DAYS) {
      const cab = Object.values(p.cabinet.ministers || {}).filter((id) => id !== 'player' && p.npcs[id]);
      const pool = cab.length && Math.random() < 0.6 ? cab : Object.keys(p.npcs).filter((id) => p.npcs[id].office);
      const who = pool.length ? pickOne(pool) : null;
      const n = who && p.npcs[who];
      if (n && PARTY_DEFS[n.party] && PARTY_DEFS[n.party].real) npcStepDown(g, p, n, pickOne(['体調不良', '一身上の都合']));
      // (round 4) NPC gaffes have their own detailed chain (npcGaffeTick: 「発言・態度・失言」); money and private troubles stay here
      else if (n) scandalImpl(g, p, pickOne(['expense', 'private', 'slush_fund']), { who });
    }
    // vacancies -> by-elections
    if (Math.random() < 2 / YEAR_DAYS) makeVacancy(g, p, 'shugi', { reason: pickOne(['議員の死去', '議員の辞職', '知事選への立候補', '議員の辞職']) });
    if (Math.random() < 0.5 / YEAR_DAYS) makeVacancy(g, p, 'sangi', { reason: pickOne(['議員の死去', '議員の辞職']) });
  }
  for (const [k, S] of Object.entries(SHOCKS)) if (Math.random() < S.perYear / YEAR_DAYS) shockImpl(g, p, k);
}

// ================================================================ history (institutional changes by date)
function history(g, p, fy) {
  const F = p.flags;
  const day = today(g);
  if (!F.heiseiNews && fy >= 1989.0 && p.cal.year < 1989) { F.heiseiNews = true; news(p, g, '元号が「平成」に改められた'); }
  if (!F.reiwaNews && fy >= 2019.34 && p.cal.year < 2019) { F.reiwaNews = true; news(p, g, '元号が「令和」に改められた'); }
  // 民主党 (1998-04-27 ... 2016-03-27)
  if (!p.parties.minshu && !F.minshuFounded && fy >= 1998.32 && fy < 2016.23) foundMinshu(g, p);
  if (p.parties.minshu && fy >= 2016.23) endMinshu(g, p);
  // 中央省庁再編 (2001-01-06)
  if (!F.reorg2001 && fy >= 2001 && p.cal.year < 2001) {
    F.reorg2001 = true;
    const M = p.cabinet.ministers;
    const out = {};
    for (const [post, id] of Object.entries(M)) {
      let q = post;
      if (!postExists(q, fy, F)) q = POSTS[q] && POSTS[q].next;
      if (q && postExists(q, fy, F) && !out[q]) out[q] = id;
      else if (id === 'player') { /* the player's post was merged away */ }
    }
    p.me.posts = p.me.posts.map((x) => (POSTS[x] && POSTS[x].kind === 'cabinet' && !postExists(x, fy, F) ? POSTS[x].next : x)).filter((x, i, a) => x && a.indexOf(x) === i);
    p.cabinet.ministers = out;
    for (const n of Object.values(p.npcs)) n.posts = n.posts.filter((x) => !(POSTS[x] && POSTS[x].kind === 'cabinet' && !postExists(x, fy, F)));
    fillCabinet(g, p, { keep: true, quiet: true });
    news(p, g, '中央省庁が再編され、1府22省庁が1府12省庁になった');
  }
  for (const [flag, post, at, text] of [['defense2007', 'minister_defense', 2007.0, '防衛庁が防衛省になった'], ['recon2012', 'minister_reconstruction', 2012.1, '復興庁が発足した'], ['digital2021', 'minister_digital', 2021.67, 'デジタル庁が発足した']]) {
    if (!F[flag] && fy >= at && p.cal.year + 0.3 < at) { F[flag] = true; news(p, g, text); if (!p.cabinet.ministers[post] && postExists(post, fy, F)) fillCabinet(g, p, { keep: true, quiet: true }); }
  }
  // (round 4) 復興庁の設置期限: 2031年3月末（復興庁設置法、2020年の改正で10年延長）. Extended while a 復興 is under way in
  // this game; otherwise the 庁 and its 大臣 end (a 復興担当大臣 can be appointed again after a later disaster).
  if (!F.recon2031 && fy >= 2031.25 && p.cal.year + 0.3 < 2031.25 && !F.reconstructionAgency) {
    F.recon2031 = true;
    if (p.fukko && !p.fukko.ended) { F.reconExtended = true; news(p, g, `復興庁の設置期限（2031年3月末）が来たが、${p.fukko.name}からの復興のため延長された`); }
    else if (!F.fukkoTanto) { news(p, g, '復興庁が設置期限（2031年3月末）を迎えて廃止された'); dropPost(g, p, 'minister_reconstruction', '復興庁の廃止'); }
  }
  // a 消費税 rise already set by law (taxPlan, e.g. 5% from 1997-04 under the 1994 税制改革関連法)
  const TP = F.taxPlan;
  if (TP && !TP.done && fy >= TP.year + (TP.month - 1) / 12) {
    TP.done = day;
    if (num(p.economy.taxRate) > 0 && num(p.economy.taxRate) < TP.rate) {
      p.economy.taxRate = TP.rate;
      news(p, g, `消費税率が${TP.rate}%に引き上げられた（${TP.law}年の税制改革関連法で決まっていた）`);
      phoneNews(g, `【消費税】${TP.year}年${TP.month}月から、消費税率が${TP.rate}%になりました（${TP.law}年に成立した法律による）。`);
    }
  }
  if (!F.subsidy1995 && fy >= 1995 && p.cal.year < 1995) { F.subsidy1995 = true; news(p, g, '政党助成法により、政党交付金の交付が始まった'); }
  if (!F.age18 && !F.age18news && fy >= 2016.45 && p.cal.year < 2016) { F.age18news = true; news(p, g, '選挙権年齢が18歳に引き下げられた'); }
  if (!F.groups2024 && fy >= 2024 && p.cal.year < 2024 && p.parties.jimin) {
    F.groups2024 = true;
    const pt = p.parties.jimin;
    pt.factions = pt.factions.slice(0, 3).map((f) => ({ ...f, name: f.name.replace(/派$/, 'グループ'), kind: 'group', funds: 0, size: Math.round(f.size * 0.4) }));
    if (p.me.party === 'jimin' && p.me.faction && !pt.factions.some((f) => f.id === p.me.faction)) p.me.faction = null;
    news(p, g, '自民党では多くの派閥が解散し、政策グループとして活動するものが残った');
  }
  void day;
}
function foundMinshu(g, p) {
  const F = p.flags;
  F.minshuFounded = true;
  const fy = fyNow(g);
  const pt = makeParty(p, 'minshu', fy, { funds: 2e9, members: 30000, founded: today(g) });
  // members gather from opposition parties (simulation)
  let s = 0, z = 0;
  for (const [id, k] of [['aozora', 0.55], ['tomoshibi', 0.35], ['nijiiro', 0.3], [IND, 0.4]]) {
    if (isRuling(p, id)) continue;
    const mine = (h) => ((p.me.party || IND) === id && p.me.office === h ? 1 : 0);
    const a = Math.round(Math.max(0, num(p.diet.shugi.seats[id]) - mine('shugi')) * k), b = Math.round(Math.max(0, num(p.diet.sangi.seats[id]) - mine('sangi')) * k);
    p.diet.shugi.seats[id] = num(p.diet.shugi.seats[id]) - a;
    for (const c of p.diet.sangi.classes) { const m = Math.min(num(c.seats[id]), Math.round(b / 2)); c.seats[id] = num(c.seats[id]) - m; c.seats.minshu = num(c.seats.minshu) + m; z += m; }
    s += a;
  }
  p.diet.shugi.seats.minshu = s;
  p.diet.sangi.seats = addTo({}, p.diet.sangi.classes[0].seats);
  addTo(p.diet.sangi.seats, p.diet.sangi.classes[1].seats);
  p.diet.sangi.total = sumSeats(p.diet.sangi.seats);
  staffParty(p, pt, fy, s + z);
  for (const seg of SEGMENT_ORDER) {
    const b = p.support.base[seg];
    let take = 0;
    for (const id of ['aozora', 'tomoshibi', 'nijiiro']) if (b[id] != null && !isRuling(p, id)) { const t = b[id] * 0.4; b[id] -= t; take += t; }
    b.minshu = take + 0.02 * (SEG_BONUS[seg] && SEG_BONUS[seg].minshu ? 2 : 1);
  }
  scheduleLeader(p, 'minshu', absOfDay(p, today(g)));
  realSync(g, p); // [R14-P]
  news(p, g, '民主党が結成された（史実では1998年4月27日、複数の党が合流して結成）');
  phoneNews(g, `【政界】野党の議員が合流して「民主党」が結成されました。衆議院${s}人・参議院${z}人の野党第一党に。`);
  emit(g, 'party', { kind: 'founded', party: 'minshu' });
}
// 2016-03-27: the 民主党 merged with another party and changed its name (a fact). The game does not
// show the party it became and no fictional party stands in for it: its members become independents
// or join other parties (simulation; retireParty), and a player member becomes 無所属 with a message.
function endMinshu(g, p) {
  const me = p.me;
  const wasMember = me.party === 'minshu';
  const pr = wasMember && me.prElected && me.prElected.party === 'minshu' && me.office === me.prElected.house;
  news(p, g, '民主党が、他党との合流にともない党名を改めた（2016年3月27日）。所属議員は無所属になったり、ほかの党に移ったりした');
  phoneNews(g, `【政界】民主党が、他党との合流にともない党名を改めました（2016年3月27日）。\n所属していた議員は、無所属になったり、ほかの党に移ったりしています。${wasMember ? `\nあなたは無所属になりました。入りたい党があれば「政治」→政党から入党できます。${pr ? '\n（比例代表で当選した議員が、選挙のときにあった別の党に入ると、議員の職を失います：国会法109条の2）' : ''}` : ''}`);
  retireParty(g, p, 'minshu', '与党の民主党が党名を改めたため');
  if (wasMember) note(g, '（民主党は他党との合流で党名を改めた。あなたは無所属になった）');
}
// A party leaves the game (民主党 in 2016; a party of an old save that is no longer in PARTY_DEFS).
// Its seats, members and supporters go to other fictional opposition parties and to 無所属 (a
// simulation split, so that no single party reads as the successor); a player member becomes 無所属.
const RETIRE_TO = [['aozora', 0.3], ['tomoshibi', 0.25], ['nijiiro', 0.15]];
function retireParty(g, p, id, reason = '与党の再編') {
  const pt = p.parties[id];
  if (!pt) return;
  const me = p.me;
  const ruling = isRuling(p, id);
  const dests = RETIRE_TO.filter(([d]) => d !== id && p.parties[d] && !p.parties[d].isPlayers && !isRuling(p, d));
  const W = [...dests, [IND, 0.3]];
  const wSum = W.reduce((a, [, w]) => a + w, 0);
  // largest remainder: n seats over the destinations
  const split = (n) => {
    const raw = W.map(([d, w]) => ({ d, q: (num(n) * w) / wSum }));
    const out = {};
    let given = 0;
    for (const r of raw) { out[r.d] = Math.floor(r.q); given += out[r.d]; }
    raw.sort((a, b) => (b.q - Math.floor(b.q)) - (a.q - Math.floor(a.q)));
    for (let i = 0; given < num(n) && i < raw.length * 2; i++) { out[raw[i % raw.length].d]++; given++; }
    return out;
  };
  const pickDest = () => { let r = Math.random() * wSum; for (const [d, w] of W) { r -= w; if (r <= 0) return d; } return IND; };
  const mine = (house) => (me.party === id && me.office === house ? 1 : 0);
  // the Diet: the player's own seat becomes 無所属; the rest is split
  const sh = p.diet.shugi;
  if (num(sh.seats[id]) > 0 || mine('shugi')) {
    const n = Math.max(0, num(sh.seats[id]) - mine('shugi'));
    delete sh.seats[id];
    addTo(sh.seats, split(n));
    if (mine('shugi')) sh.seats[IND] = num(sh.seats[IND]) + 1;
    sh.total = sumSeats(sh.seats);
  }
  const sa = p.diet.sangi;
  const classSum = sa.classes.reduce((a, c) => a + num(c.seats && c.seats[id]), 0);
  const consistent = classSum === num(sa.seats[id]);
  const myClass = mine('sangi') ? (sa.classes.find((c) => c.year === me.sangiClass && num(c.seats[id]) > 0) || sa.classes.find((c) => num(c.seats[id]) > 0)) : null;
  const moved = {};
  for (const c of sa.classes) {
    if (!c.seats || c.seats[id] == null) continue;
    const own = c === myClass ? 1 : 0;
    const part = split(Math.max(0, num(c.seats[id]) - own));
    delete c.seats[id];
    addTo(c.seats, part);
    addTo(moved, part);
    if (own) { c.seats[IND] = num(c.seats[IND]) + 1; moved[IND] = num(moved[IND]) + 1; }
  }
  if (sa.seats[id] != null || mine('sangi')) {
    const n = num(sa.seats[id]);
    delete sa.seats[id];
    if (consistent) addTo(sa.seats, moved);
    else { addTo(sa.seats, split(Math.max(0, n - mine('sangi')))); if (mine('sangi')) sa.seats[IND] = num(sa.seats[IND]) + 1; }
    sa.total = sumSeats(sa.seats);
  }
  for (const [k, L] of [['kugi', p.local.kugi], ['togi', p.local.togi]]) {
    if (!L || !L.seats || L.seats[id] == null) continue;
    const own = me.party === id && me.office === k ? 1 : 0;
    const n = Math.max(0, num(L.seats[id]) - own);
    delete L.seats[id];
    addTo(L.seats, split(n));
    if (own) L.seats[IND] = num(L.seats[IND]) + 1;
  }
  for (const k of ['kucho', 'chiji']) { const L = p.local[k]; if (L && Array.isArray(L.backers)) L.backers = L.backers.filter((x) => x !== id); }
  // supporters: the shares that went with the party follow the members (the 無所属 part to 支持なし)
  for (const seg of SEGMENT_ORDER) {
    const b = p.support.base[seg];
    if (b && b[id] != null) { const v = num(b[id]); delete b[id]; for (const [d, w] of dests) b[d] = num(b[d]) + (v * w) / wSum; }
    const m = p.support.mods[seg];
    if (m) delete m[id];
  }
  // NPC members go one by one (leader, faction heads, posts, sitting members)
  for (const n of Object.values(p.npcs)) {
    if (n.party !== id) continue;
    n.party = pickDest();
    n.faction = null;
    n.posts = (n.posts || []).filter((x) => !(POSTS[x] && POSTS[x].kind === 'party'));
  }
  for (const h of Object.values(p.flags.smdHolders || {})) if (h && h.party === id) h.party = h.npc && h.npc !== 'player' && p.npcs[h.npc] ? p.npcs[h.npc].party : IND;
  // the party's own races and nominations end
  p.elections.upcoming = p.elections.upcoming.filter((e) => !(e.kind === 'sosaisen' && e.party === id));
  for (const e of p.elections.upcoming) { const d = myDecl(e); if (d && d.party === id) d.party = IND; }
  if (me.nominations) for (const [eid, pid] of Object.entries(me.nominations)) if (pid === id) { delete me.nominations[eid]; if (me.nomKind) delete me.nomKind[eid]; }
  // the player: 無所属 (party posts and the leader's post end; prElected keeps the list party for 109条の2)
  if (me.party === id) {
    me.party = null;
    me.faction = null;
    me.member = false;
    me.standing = 30;
    me.leaderTerms = 0;
    me.posts = me.posts.filter((x) => !(POSTS[x] && POSTS[x].kind === 'party'));
  }
  (p.flags.partyNames || (p.flags.partyNames = {}))[id] = pt.short;
  delete p.parties[id];
  // a governing party leaves the coalition: the cabinet resigns and a new PM is named
  if (ruling) {
    p.cabinet.partyIds = (p.cabinet.partyIds || []).filter((x) => x !== id);
    if (!p.cabinet.resigned) resignCabinet(g, p, reason);
  }
  emit(g, 'party', { kind: 'ended', party: id });
}

// ================================================================ the morning tick
// Get (create / repair) g.state.politics.
function ensurePol(g) {
  const st = g.state;
  if (!st) return null;
  if (!st.politics || typeof st.politics !== 'object') st.politics = newPoliticsState(g);
  else if (!st.politics._ok) { st.politics = normalizePolitics(g, st.politics); }
  Object.defineProperty(st.politics, '_ok', { value: true, enumerable: false, configurable: true, writable: true });
  // the year names follow (POLICIES[id].name getters, e.g. disaster_prep): refreshed once per game day
  if (NAMES_AT.st !== st || NAMES_AT.day !== st.day || NAMES_AT.pol !== st.politics) { NAMES_AT.st = st; NAMES_AT.day = st.day; NAMES_AT.pol = st.politics; try { NAMES_AT.fy = fyNow(g); } catch (e) { /* keep the last year */ } }
  return st.politics;
}
function seatMove(p, house, from, to) {
  const H = p.diet[house];
  if (!H) return;
  from = from || IND; to = to || IND;
  if (from === to) return;
  if (num(H.seats[from]) > 0) H.seats[from]--;
  H.seats[to] = num(H.seats[to]) + 1;
  H.total = sumSeats(H.seats);
  if (house === 'sangi') {
    const c = p.diet.sangi.classes.find((x) => x.year === p.me.sangiClass) || p.diet.sangi.classes.find((x) => num(x.seats[from]) > 0) || p.diet.sangi.classes[0];
    if (num(c.seats[from]) > 0) c.seats[from]--;
    c.seats[to] = num(c.seats[to]) + 1;
  }
}
// The player loses their office (90条, conviction, resignation...). national: the seat becomes vacant.
function loseOffice(g, p, reason, opts = {}) {
  const me = p.me;
  const off = me.office;
  if (!off) return false;
  if (off === 'shugi' || off === 'sangi') {
    const H = p.diet[off];
    const id = me.party || IND;
    const pr = (me.prElected && me.prElected.house === off) ? me.prElected : /比例/.test(String(me.district || '')) ? { party: me.party || null } : null;
    if (pr && !opts.noVacancy) {
      // 比例: the next person on the party's list takes the seat (繰上補充, no by-election)
      const to = pr.party && p.parties[pr.party] ? pr.party : null;
      if (to) { seatMove(p, off, id, to); news(p, g, `${off === 'sangi' ? '参議院' : '衆議院'}比例代表の欠員は、${pname(p, to)}の名簿から繰上補充`); }
      else {
        if (num(H.seats[id]) > 0) H.seats[id]--;
        H.total = sumSeats(H.seats);
        if (off === 'sangi') { const c = p.diet.sangi.classes.find((x) => x.year === me.sangiClass); if (c && num(c.seats[id]) > 0) c.seats[id]--; }
      }
    } else {
      // a by-election fills the seat (makeVacancy takes the seat away); none near the end of the term
      const home = off === 'sangi' ? HOME_DISTRICT.sangi : HOME_DISTRICT.shugi;
      const district = me.district && !/比例/.test(me.district) ? me.district.replace(/（定数\d+）$/, '') : home;
      const e = opts.noVacancy ? null : makeVacancy(g, p, off, { party: id, pref: me.districtPref || 'tokyo', district, reason, cls: off === 'sangi' ? me.sangiClass : null });
      if (!e) {
        if (num(H.seats[id]) > 0) H.seats[id]--;
        H.total = sumSeats(H.seats);
        if (off === 'sangi') { const c = p.diet.sangi.classes.find((x) => x.year === me.sangiClass) || p.diet.sangi.classes.find((x) => num(x.seats[id]) > 0); if (c && num(c.seats[id]) > 0) c.seats[id]--; }
      }
    }
    me.prElected = null;
  }
  if (off === 'shicho' || off === 'chiji') {
    const L = p.local[off === 'shicho' ? 'kucho' : 'chiji'];
    if (L.holder === 'player') { L.holder = newNpc(p, { party: IND, office: off, wins: 0 }).id; }
  }
  me.formerOffice = off;
  me.office = null;
  me.termEnd = null;
  // party posts of a party the player does not lead go to NPCs
  const pt = p.parties[me.party];
  if (pt && !pt.isPlayers) for (const [k, v] of Object.entries(pt.posts || {})) if (v === 'player') { const n = pickMinister(p, pt.id, {}); n.posts.push(k); pt.posts[k] = n.id; }
  me.posts = me.posts.filter((x) => (x === 'party_leader' && pt && (pt.isPlayers || pt.leader === 'player')) || x === 'pm');
  for (const [post, id] of Object.entries(p.cabinet.ministers)) if (id === 'player') { const m = pickMinister(p, cabinetPartyOfPM(p) || p.cabinet.partyIds[0], p.cabinet.ministers); m.posts.push(post); p.cabinet.ministers[post] = m.id; }
  // a PM who loses office brings the cabinet down (the leader of a party they did not found
  // steps down too); a leader of such a party without a seat steps down
  if (p.cabinet.pm === 'player' && !p.cabinet.resigned) resignCabinet(g, p, reason);
  else if ((off === 'shugi' || off === 'sangi') && !opts.keepLeader) stepDownLeader(g, p, reason || '失職'); // a candidate (90条) stays leader until the vote
  note(g, `（${OFFICES[off].label}の職を失った${reason ? `（${reason}）` : ''}）`);
  news(p, g, `${g.state.name}${OFFICES[off].short}が失職（${reason || '辞職'}）`);
  emit(g, 'resign', { who: 'player', office: off, reason });
  return true;
}
// No 被選挙権 / 選挙権: 公民権停止 or serving a sentence (禁錮以上の刑の執行中, 公選法11条).
// Detention (逮捕・勾留) does not take the rights away. kind: 'candidacy' (被選挙権, default) or
// 'vote' (選挙権 only: 公選法11条の2 keeps 被選挙権 away longer than 選挙権 after 在職中の収賄).
function civicBarred(g, kind = 'candidacy') {
  if (typeof g.civicBanned === 'function') { try { if (g.civicBanned(kind)) return true; } catch (e) { console.error(e); } }
  const J = g.state && g.state.justice;
  return !!(J && typeof J === 'object' && (num(J.civicBanUntil) > today(g) || J.status === 'prison'));
}
// 公選法90条: filing for another election costs the office the player holds. The same office's
// own 任期満了 election is the exception (a 参院議員 of the class not up for election is filing for
// another seat, so it counts as another election).
function ninetyApplies(p, e) {
  const me = p.me;
  const off = officeOfElection(e);
  if (!off || !me.office || e.kind === 'sosaisen') return false;
  if (me.office !== off || e.kind === 'hosen') return true;
  if (off === 'sangi') { const upYear = Math.min(...p.diet.sangi.classes.map((c) => num(c.year))); return num(me.sangiClass) !== upYear; }
  return false;
}
function justiceCheck(g, p) {
  const J = g.state.justice;
  const me = p.me;
  if (!me.office || !J || typeof J !== 'object') return;
  const banned = typeof g.civicBanned === 'function' ? !!g.civicBanned() : num(J.civicBanUntil) > today(g);
  if (banned) loseOffice(g, p, '公民権停止');
  else if (J.status === 'prison') loseOffice(g, p, '禁錮以上の刑の確定');
}

export async function politicsTick(g) {
  if (!g || !g.state) return;
  const p = ensurePol(g);
  const day = today(g);
  if (num(p.lastTick) >= day) return;
  const skipped = Math.min(60, day - num(p.lastTick, day - 1));
  p.lastTick = day;
  g._polPending = [];
  g._polTicking = true;
  try {
    realSync(g, p); // [R14-P]
    const abs = absOfDay(p, day);
    // the economy moves every day (also through days that were skipped)
    for (let i = Math.max(1, skipped) - 1; i >= 0; i--) economyDay(g, p, abs - i);
    tickDay(g, p, day, abs);
  } catch (e) { console.error('politicsTick', e); }
  g._polTicking = false;
  sanitize(p);
  const pend = g._polPending.splice(0);
  for (const pr of pend) { try { await pr; } catch (e) { console.error(e); } }
}
// ---------------------------------------------------------------- election notices (phone)
// The 選管 tells an eligible player about every public election they could enter (区議・都議・区長・
// 知事・衆院・参院, 補選 too): once when filing opens (30 game days before the vote) and once a few days
// before the 公示/告示 day, when filing closes. Only while the player has 被選挙権 on the vote day
// (age, 公民権, 刑の執行中: eligibleImpl) and has not filed for that election; the reminder only when
// the player has filed for no other public election. Notices of the same morning go in one message.
const PUBLIC_KINDS = ['shugi', 'sangi', 'kugi', 'togi', 'shicho', 'chiji', 'hosen'];
// 公示 for the 総選挙 and the 通常選挙 only; every other election (補欠選挙 too) is 告示 (公選法31条〜34条)
const kojiWord = (e) => (e.kind === 'shugi' || e.kind === 'sangi' ? '公示' : '告示');
const NOTICE_LEAD = 30; // filing opens 30 game days before the vote (declareImpl)
const REMIND_DAYS = 3; // the reminder: 3 game days (about 9 days) before the 公示/告示 day
function electionNotice(g, p, e, day, notices, reminders) {
  if (!PUBLIC_KINDS.includes(e.kind) || e.status !== 'scheduled' || day > e.koji || myDecl(e)) return;
  const office = officeOfElection(e);
  if (!office) return;
  const open = !e.noticeSent && e.day - day <= NOTICE_LEAD;
  const remind = !e.reminderSent && e.koji - day <= REMIND_DAYS;
  if (!open && !remind) return;
  if (eligibleImpl(g, p, office, { day: e.day, noMoney: true })) return; // no 被選挙権 (yet): ask again tomorrow
  if (open) {
    e.noticeSent = day;
    // another race of the same round (補選 are held together in April / October) was announced on an
    // earlier day: this one comes with the round's reminder instead of a message of its own
    const sameRound = p.elections.upcoming.some((x) => x !== e && x.noticeSent && x.noticeSent < day && Math.abs(num(x.day) - num(e.day)) <= 3 && x.status !== 'done');
    if (sameRound && e.koji - day > 0) return;
    // a notice that comes this close to the deadline already says it: no separate reminder
    if (e.koji - day <= REMIND_DAYS + 5) e.reminderSent = day;
    notices.push(e);
    return;
  }
  e.reminderSent = day;
  const other = p.me.candidacy && p.elections.upcoming.some((x) => x.id === p.me.candidacy && x.status !== 'done' && x.kind !== 'sosaisen');
  if (!other) reminders.push(e);
}
function sendElectionNotices(g, p, notices, reminders) {
  if (!notices.length && !reminders.length) return;
  const app = `${((ERAS[p.era] || {}).deviceShort) || 'スマホ'}の「政治」→選挙`;
  const dep = (e) => fmtMoney(Math.round(depositFor(officeOfElection(e), yearOfAbs(p, absOfDay(p, e.day))) / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1)));
  const line = (e) => `・${e.label}\n　${kojiWord(e)}：${dateLabel(g, e.koji)}\n　投票：${dateLabel(g, e.day)}\n　供託金：${dep(e)}`;
  const parts = [];
  if (notices.length) {
    const list = notices.slice(0, 4).map(line).join('\n') + (notices.length > 4 ? `\nほか${notices.length - 4}件` : '');
    const ws = [...new Set(notices.map(kojiWord))];
    parts.push(`【選挙のお知らせ】立候補の届出の受付が始まりました。\n${list}\n届出は${notices.length > 1 ? 'それぞれの' : ''}${ws.length > 1 ? '公示・告示' : ws[0]}日まで。ドット区役所2階の選挙管理委員会か、${app}から。党の公認の申請は、党本部の選挙対策本部へ。`);
  }
  if (reminders.length) {
    const list = reminders.slice(0, 4).map((e) => `・${e.label}：${kojiWord(e)}日 ${dateLabel(g, e.koji)}まで`).join('\n') + (reminders.length > 4 ? `\nほか${reminders.length - 4}件` : '');
    parts.push(`【届出の締切が近づいています】\n${list}\n立候補するなら、ドット区役所2階の選挙管理委員会か、${app}から。`);
  }
  phoneNews(g, parts.join('\n\n'), 'ドット区 選挙管理委員会');
}
// ext (regime.js, 体制): g.regimeHold('diet') → true while the Diet is suspended (国会の停止: no session
// opens); g.regimeHold('election', e, day) → true while elections are suspended (選挙の停止: the hook moves
// e.day / e.koji later and the election is skipped today). Without regime.js both are false.
const regimeHold = (g, kind, ...a) => { try { return typeof g.regimeHold === 'function' && !!g.regimeHold(kind, ...a); } catch (e) { console.error(e); return false; } };
function tickDay(g, p, day, abs) {
  const fy = fyOfAbs(p, abs);
  const year = yearOfAbs(p, abs);
  const doy = doyOfAbs(abs);
  const me = p.me;
  history(g, p, fy);
  justiceCheck(g, p);
  // --- the year: budget & subsidies (1 January), fiscal year (April), reports (end of March)
  if (doy === 0 || num(p.flags.yearDone) < year) {
    if (num(p.flags.yearDone) < year) {
      p.flags.yearDone = year;
      subsidyYear(g, p, year);
      compileBudget(p, abs);
      pruneNpcs(p);
      for (const [id, pt] of Object.entries(p.parties)) if (PARTY_DEFS[id] && PARTY_DEFS[id].platformByYear) pt.platform = platformFor(id, year);
    }
  }
  if (doy >= 30 && num(p.flags.fiscalYear) < year) {
    p.flags.fiscalYear = year;
    const B = p.economy.budget;
    if (B && !B.passed) { B.provisional = true; news(p, g, '予算が年度内に成立せず、暫定予算が組まれた'); p.cabinet.scandal = num(p.cabinet.scandal) - 3; }
  }
  if (doy >= 29 && num(p.flags.reportYear) < year) {
    p.flags.reportYear = year;
    const y = year - 1;
    if (!me.reported[y] && (me.office || me.funds || me.secret || me.formerOffice)) {
      me.reported[y] = { day, auto: true, secretIncluded: false };
      note(g, `（会計責任者が、${y}年分の政治資金収支報告書を提出した）`);
    }
  }
  // --- monthly (the first day of each month; months skipped by a jump in days are paid late):
  // 歳費・報酬, the quarterly 政党交付金 (4月・7月・10月・12月)
  const mi = Math.floor(abs / MONTH_DAYS);
  if (p.flags.paidMonth == null) p.flags.paidMonth = p.flags.paid != null ? Math.floor(num(p.flags.paid) / MONTH_DAYS) : mi - (doy % MONTH_DAYS === 0 ? 1 : 0);
  if (mi - num(p.flags.paidMonth) > 24) p.flags.paidMonth = mi - 24;
  while (num(p.flags.paidMonth) < mi) {
    p.flags.paidMonth = num(p.flags.paidMonth) + 1;
    const mAbs = p.flags.paidMonth * MONTH_DAYS;
    const mDoy = doyOfAbs(mAbs);
    if ([30, 60, 90, 110].includes(mDoy)) for (const pt of Object.values(p.parties)) if (pt.subsidy > 0) pt.funds = num(pt.funds) + Math.round(pt.subsidy / 4);
    payday(g, p, mDoy, yearOfAbs(p, mAbs));
  }
  // --- sessions (ext regime.js: no session opens while the Diet is suspended — 国会の停止, g.regimeHold('diet'))
  const S = p.diet.session || regimeHold(g, 'diet');
  const shugiSoon = p.elections.upcoming.some((e) => e.kind === 'shugi' && e.day - day < 15);
  if (!S && doy >= 2 && doy < 20 && num(p.flags.ordinaryYear) < year && !p.diet.shugi.dissolved && !shugiSoon) {
    p.flags.ordinaryYear = year;
    compileBudget(p, abs);
    openSession(g, p, SESSION_KINDS.ordinary, 50);
    cabinetBills(g, p);
    submitDrafts(g, p);
  } else if (!S && doy >= 88 && doy < 100 && num(p.flags.extraYear) < year && !p.diet.shugi.dissolved && !shugiSoon) {
    p.flags.extraYear = year;
    openSession(g, p, SESSION_KINDS.extra, irnd(12, 20));
    submitDrafts(g, p);
    if (p.economy.growth < 0.3 && p.cabinet.pm !== 'player' && !policyBlock(p, 'stimulus', null, year, fy)) addBill(p, { title: billTitle(POLICIES.stimulus, POLICIES.stimulus.defaults), policy: 'stimulus', params: { ...POLICIES.stimulus.defaults }, sponsor: 'cabinet', by: p.cabinet.ministers[ministryFor('minister_finance', fy, p.flags)] || p.cabinet.pm, party: cabinetPartyOfPM(p), house: 'shugi', day, delay: 3 });
  }
  const S2 = p.diet.session;
  if (S2 && day > S2.end) {
    const important = p.diet.bills.some((b) => b.sponsor === 'cabinet' && ['committee', 'shugi', 'sangi'].includes(b.stage) && b.kind !== 'noconfidence');
    if (S2.kind === SESSION_KINDS.ordinary && !S2.extended && important && Math.random() < 0.5) { S2.extended = true; S2.end += irnd(5, 10); news(p, g, '国会の会期が延長された'); }
    else closeSession(g, p);
  }
  // NPC opposition: a no-confidence motion near the end of the ordinary session
  const S3 = p.diet.session;
  if (S3 && S3.kind === SESSION_KINDS.ordinary && day === S3.end - 2 && p.cabinet.pm && !p.cabinet.resigned && !p.diet.bills.some((b) => b.kind === 'noconfidence' && b.created >= S3.start)) {
    if (num(p.cabinet.approval) < 45 && Math.random() < 0.65) {
      const opp = Object.keys(p.parties).filter((id) => !isRuling(p, id) && num(p.diet.shugi.seats[id]) > 0).sort((a, b) => p.diet.shugi.seats[b] - p.diet.shugi.seats[a])[0];
      const oppSeats = Object.keys(p.parties).filter((id) => !isRuling(p, id)).reduce((a, id) => a + num(p.diet.shugi.seats[id]), 0);
      if (opp && oppSeats >= 50 && !(p.parties[opp].isPlayers)) {
        addBill(p, { title: '内閣不信任決議案', policy: null, sponsor: 'member', by: p.parties[opp].leader, party: opp, kind: 'noconfidence', stage: 'shugi', house: 'shugi', day, delay: 1 });
        news(p, g, `${pname(p, opp)}などが内閣不信任決議案を提出した`);
      }
    }
  }
  // --- the cabinet's pending steps (special session, 首班指名, resignation)
  const pend = p.cabinet.pending;
  // nothing convenes while the 衆院 is dissolved: the next PM is chosen by the special session
  if (pend && day >= pend.day && p.diet.shugi.dissolved && pend.kind !== 'special') pend.day = day + 1;
  else if (pend && day >= pend.day) {
    p.cabinet.pending = null;
    if (pend.kind === 'special') { openSession(g, p, SESSION_KINDS.special, irnd(5, 10)); electPMImpl(g, p); }
    else if (pend.kind === 'shuhan') { if (!p.diet.session) openSession(g, p, SESSION_KINDS.extra, irnd(6, 12)); electPMImpl(g, p); }
    else if (pend.kind === 'resign') { if (!p.cabinet.resigned) resignCabinet(g, p, pend.reason); }
    else if (pend.kind === 'ncDeadline') { if (!p.diet.shugi.dissolved && !p.cabinet.resigned) resignCabinet(g, p, '不信任案の可決（10日以内に解散しなかった）'); }
  }
  // --- bills
  reviewDrafts(g, p);
  advanceBillsImpl(g, p);
  // --- elections
  const notices = [], reminders = [];
  for (const e of p.elections.upcoming.slice()) {
    if (e.status === 'done') continue;
    if (regimeHold(g, 'election', e, day)) continue; // ext regime.js: 選挙の停止 (the hook postpones e.day / e.koji)
    if (!e.announced && e.day - day <= 30 && !ELECTION_KINDS[e.kind].newsOnly) {
      e.announced = true;
      if (PUBLIC_KINDS.includes(e.kind)) news(p, g, `${e.label}：${dateLabel(g, e.koji)}${kojiWord(e)}、${dateLabel(g, e.day)}投票`);
    }
    electionNotice(g, p, e, day, notices, reminders);
    if (e.status === 'scheduled' && day >= e.koji) {
      e.status = 'campaign';
      if (e.kind === 'shugi' || e.kind === 'sangi') phoneNews(g, `【公示】${e.label}が公示されました。投票日は${dateLabel(g, e.day)}です。${e.kind === 'shugi' && e.reason === '解散' ? '（解散による総選挙）' : ''}`);
      const d = myDecl(e);
      if (d && e.kind !== 'sosaisen' && civicBarred(g)) {
        // 届出不受理: no 被選挙権 on the filing day (the deposit was never lodged)
        if (d.deposit) { if (d.depositFrom === 'funds') me.funds += d.deposit; else g.state.money += d.deposit; }
        delete e.declared.player;
        if (me.candidacy === e.id) { me.candidacy = null; me.campaign = null; }
        note(g, `（被選挙権がないため、${e.label}への立候補の届出は受理されなかった）`);
      } else if (d) {
        if (ninetyApplies(p, e)) loseOffice(g, p, '他の選挙に立候補（公職選挙法90条）', { keepLeader: true });
        note(g, `（${e.label}の${e.kind === 'shugi' || e.kind === 'sangi' ? '公示' : '告示'}日。選挙運動が始まった！投票は${dateLabel(g, e.day)}）`);
        if (!d.cost) playerElectionCost(g, p, e, d);
      }
      if (e.kind === 'shugi' || e.kind === 'sangi') partyElectionSpend(p, e);
    }
    // party leadership races wait until a general election is over
    if (e.kind === 'sosaisen' && day > e.day - 2 && (p.diet.shugi.dissolved || p.elections.upcoming.some((x) => x.kind === 'shugi' && x.status !== 'done' && x.day - day < 14))) { e.day += 7; e.koji += 7; continue; }
    if (day > e.day) runElectionImpl(g, p, e);
  }
  sendElectionNotices(g, p, notices, reminders);
  // the player's term ends without running again (local / 参院)
  if (me.office && me.termEnd && day > me.termEnd + 1 && me.office !== 'shugi') {
    note(g, `（${OFFICES[me.office].label}の任期が終わった）`);
    me.formerOffice = me.office;
    if (me.office === 'sangi') { const id = me.party || IND; if (num(p.diet.sangi.seats[id]) > 0) { /* the seat was refilled by the election */ } }
    if (me.office === 'shicho' || me.office === 'chiji') { const L = p.local[me.office === 'shicho' ? 'kucho' : 'chiji']; if (L.holder === 'player') L.holder = newNpc(p, { party: IND, office: me.office }).id; }
    me.office = null;
    me.termEnd = null;
  }
  // --- NPC prime ministers dissolve when the time looks right
  if (!p.diet.shugi.dissolved && p.cabinet.pm && p.cabinet.pm !== 'player' && !p.cabinet.pending && !p.cabinet.resigned) {
    const since = (abs - num(p.diet.shugi.last)) / YEAR_DAYS;
    const left = (num(p.diet.shugi.termEnd) - abs) / YEAR_DAYS;
    const inBudget = p.diet.session && p.diet.session.kind === SESSION_KINDS.ordinary && day - p.diet.session.start < 25;
    if (!inBudget && left > 0.15 && !p.elections.upcoming.some((e) => e.kind === 'shugi' && e.day - day < 40)) {
      let ch = 0;
      if (since >= 2 && num(p.cabinet.approval) >= 45) ch = 0.012;
      if (since >= 3.2) ch = 0.03;
      if (since >= 1 && since < 2 && num(p.cabinet.approval) >= 60 && today(g) - num(p.cabinet.formed) < 30) ch = 0.01; // a new PM's early dissolution
      if (Math.random() < ch) dissolveImpl(g, p, pickOne(['首相の判断', '国民に信を問う', '政策の転換を問う']));
    }
  }
  // --- reshuffle in September (NPC PM)
  if (doy === 82 && p.cabinet.pm && p.cabinet.pm !== 'player' && !p.cabinet.resigned && today(g) - num(p.cabinet.formed) > 150 && Math.random() < 0.55 && num(p.flags.reshuffleYear) < year) {
    p.flags.reshuffleYear = year;
    reshuffleKeepPlayer(g, p);
    fillCabinet(g, p, { keepPlayer: true });
    p.cabinet.approval = clamp(num(p.cabinet.approval) + rnd(1, 5), 3, 90);
    news(p, g, '内閣改造が行われた');
    offerPostToPlayer(g, p);
    offerPartyPost(g, p);
  }
  // --- offers expire
  if (me.offers.length) {
    for (const o of me.offers) if (day > o.until && !o.answered) { o.answered = 'expired'; note(g, `（${o.kind === 'post' ? `「${postName(o.post, fy)}」への就任の打診` : '打診'}は、返事をしないうちに立ち消えになった）`); }
    me.offers = me.offers.filter((o) => !o.answered || day - o.day < 10);
  }
  // --- attendance (国会議員). Custody and a stay in hospital are excused (請暇); every other
  // missed sitting counts: the party's whip complains, a streak becomes a story, then another.
  const J = g.state.justice;
  const heldInside = !!(J && typeof J === 'object' && (J.status === 'detained' || J.status === 'prison'));
  const DS = g.state.flags && g.state.flags.darkside;
  const excused = heldInside || num(me.attend.excusedUntil) >= day - 1 || (DS && typeof DS === 'object' && num(DS.hospUntil) >= day - 1);
  // (2026-10 fix) only a day with business counts: yesterday's agenda (p.diet.agenda, recorded below each morning).
  // A member: a plenary vote or committee work in their house; the PM and ministers (whose Diet duty is 答弁):
  // the budget under review (予算委員会), a plenary vote in their own house, the session's opening day.
  const duty = attendDuty(p, me, day - 1);
  if ((me.office === 'shugi' || me.office === 'sangi') && inSession(p, day - 1) && num(me.attend.last) < day - 1 && duty) {
    if (excused) me.attend.excused = num(me.attend.excused) + 1;
    else {
      me.attend.absent = num(me.attend.absent) + 1;
      me.attend.missed = num(me.attend.missed) + 1;
      me.standing = clamp(me.standing - 0.4, 0, 100);
      me.localSupport = clamp(me.localSupport - 0.2, 0, 100);
      const a = me.attend.absent;
      if (a === 4 && me.party) note(g, inCabinet(me) ? '（官邸の国会担当から「答弁に立つ日は、必ず国会へ」と念を押された）' : '（党の国会対策委員会から「本会議と委員会には必ず出るように」と注意された）');
      if (a === 8 || (a > 8 && (a - 8) % 15 === 0)) {
        scandalImpl(g, p, 'absence', { who: 'player' });
        news(p, g, inCabinet(me) ? `国会での答弁を欠席が続く${g.state.name}${playerTitle(g, p)}（${a}日）。野党が「国会軽視」と批判` : `国会の欠席が続く${g.state.name}${playerTitle(g, p)}（${a}日連続）。地元からも疑問の声`);
      }
    }
  }
  p.diet.agenda = dietAgenda(p, day);
  // --- the career meters drift back (review): standing in the party settles at what one's
  // seniority earns, 地元の支持 needs tending, reputation fades both ways; the 後援会 loses a few
  // members every day (引っ越し・高齢化)
  const baseStanding = me.party ? Math.min(85, 30 + 8 * num(me.nationalWins)) : 30;
  if (me.standing > baseStanding) me.standing = Math.max(baseStanding, me.standing - 0.25);
  const runningSoon = !!(me.candidacy || me.intent);
  if (me.localSupport > 20) me.localSupport = Math.max(20, me.localSupport - (runningSoon ? 0.1 : 0.2));
  if (me.reputation > 0) me.reputation = Math.max(0, me.reputation - 0.1);
  else if (me.reputation < 0) me.reputation = Math.min(0, me.reputation + 0.1);
  if (me.kouenkai > 0) me.kouenkai = Math.max(0, me.kouenkai - Math.max(me.kouenkai > 300 ? 1 : 0, Math.round(me.kouenkai * 0.002)));
  // a media job instead of a Diet sitting is noticed
  if (num(me.attend.tvDay) === day - 1 && num(me.attend.last) < day - 1 && isNational(me)) {
    me.reputation = clamp(me.reputation - 2, -100, 100);
    if (Math.random() < 0.35) news(p, g, `${g.state.name}議員、国会を欠席した日にテレビ出演。「本業はどちらなのか」と批判`);
  }
  localCouncilCheck(g, p, day, excused);
  if (me.posts.includes('pm')) me.pmDays++;
  if (me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm')) me.ministerDays++;
  // --- money risk, NPC events, opinion, polls
  exposureCheck(g, p);
  npcEvents(g, p);
  // round 4: the gaffe chains (player and NPCs) and the 復興担当大臣 after a major disaster
  try { speechTick(g, p, day); } catch (e) { console.error(e); }
  try { fukkoTick(g, p, day, abs); } catch (e) { console.error(e); }
  try { INTRA.tickAll(g, p, day, abs); } catch (e) { console.error('intra', e); } // R5-D
  try { if (INTRA.ai) INTRA.ai.tick(g, p, day, abs); } catch (e) { console.error('politics-ai', e); } // [R11-P] the agents observe, learn, decide
  for (const s of SEGMENT_ORDER) {
    const m = p.support.mods[s];
    if (!m) continue;
    for (const id of Object.keys(m)) {
      const b = p.support.base[s] || (p.support.base[s] = {});
      b[id] = clamp(num(b[id]) + num(m[id]) * 0.004, 0, 0.9); // part of a swing becomes lasting
      m[id] = num(m[id]) * 0.985;
      if (!p.parties[id]) { delete m[id]; delete b[id]; }
    }
  }
  // the pendulum: governing wears support down a little, the opposition picks it up
  for (const s of SEGMENT_ORDER) {
    const b = p.support.base[s];
    if (!b) continue;
    let moved = 0;
    for (const id of p.cabinet.partyIds || []) if (b[id] > 0.01) { const t = b[id] * 0.0003; b[id] -= t; moved += t; }
    const opp = Object.keys(p.parties).filter((id) => !isRuling(p, id));
    const tot = opp.reduce((a, id) => a + Math.sqrt(Math.max(0.0005, num(b[id]))), 0) || 1;
    for (const id of opp) b[id] = num(b[id]) + moved * Math.sqrt(Math.max(0.0005, num(b[id]))) / tot;
  }
  for (const a of AREA_ORDER) p.opinion.issues[a] = num(p.opinion.issues[a]) + (baseSalience(a, year) - num(p.opinion.issues[a])) * 0.02;
  refreshOpinion(p, g);
  if (weekdayOf(day) === 0 || !p.polls.length) weeklyPoll(g, p);
  scheduleElections(g, p);
}
// Co-sponsors (賛成者) from the player's own party for a member bill: the leader's word carries the
// party; otherwise those who agree with the policy and the player's faction / group (review: not
// the whole party at once).
function cosponsors(p, house, al, leader = false) {
  const me = p.me;
  const n = Math.max(0, num(p.diet[house].seats[me.party]) - 1);
  if (leader) return Math.round(n * clamp(al + 0.15, 0, 1));
  const pt = p.parties[me.party];
  const f = pt && (pt.factions || []).find((x) => x.id === me.faction);
  const fac = f ? num(f.size) * (house === 'shugi' ? 0.7 : 0.3) * 0.4 * clamp(me.standing / 100, 0, 1) : 0;
  return Math.min(n, Math.round(n * clamp(al - 0.3, 0, 0.7) * 0.25 + fac));
}
// 与党の事前審査 of the player's member bills: the party's verdict after a few days.
function reviewDrafts(g, p) {
  const day = today(g);
  const me = p.me;
  for (const b of p.diet.bills) {
    if (b.by !== 'player' || b.stage !== 'draft' || !b.review || b.review.done || day < num(b.review.until)) continue;
    b.review.done = true;
    const pl = POLICIES[b.policy];
    const al = alignment(p, me.party, b.policy);
    const post = me.posts.some((x) => POSTS[x] && (POSTS[x].kind === 'party' || POSTS[x].kind === 'cabinet'));
    // policy the government handles itself (its agenda, a ministry's budget) is left to a 閣法
    const govt = pl && (agendaFor(calYear(g)).includes(pl.id) || (pl.ministry && num(pl.cost) !== 0));
    const chance = clamp(((al - 0.55) * 3 + (me.standing - 50) / 100 + (post ? 0.15 : 0)) * (govt ? 0.5 : 1) + num(b.reviewBonus), 0.05, 0.9);
    if (!me.party || !isRuling(p, me.party) || Math.random() >= chance) {
      b.stage = 'shelved';
      b.result = '党の事前審査で見送り';
      b.closed = day;
      b.log.push({ day, text: govt ? '党の総務会で「政府が閣法で対応する」として見送り' : '党の総務会で了承されず、見送り' });
      note(g, `（「${b.title}」は、党の事前審査で見送られた…。${govt ? '政府の法案（閣法）に任せるように、と言われた' : '党内の理解がまだ足りない'}）`);
      continue;
    }
    b.partyApproved = true;
    // a 憲法改正原案 the party adopts is put forward by the party as a whole
    b.supporters = Math.min(p.diet[b.house].total, num(b.supporters) + cosponsors(p, b.house, al, !!(pl && pl.kind === 'amendment')));
    b.log.push({ day, text: `党の事前審査で了承（賛成者 ${b.supporters}/${b.need}人）` });
    note(g, `（「${b.title}」が党の総務会で了承された！ 賛成者 ${b.supporters}/${b.need}人）`);
    if (b.supporters >= b.need) {
      b.ready = true;
      if (inSession(p, day)) { b.stage = 'committee'; b.step = 'committee'; b.next = day + irnd(3, 6); b.log.push({ day, text: '国会に提出（議員立法）' }); }
    }
  }
}
// 区議会・都議会: four 定例会 a year (2・6・9・11月, the first half of the month: kuyakusho.js). A
// member who takes no part in one (一般質問・採決・議会で質問) is criticised and, as the council's
// rules on long absences allow (目安), gets half 報酬 until the next one. Custody / hospital excused.
const TEIREI_MONTHS = [2, 6, 9, 11];
function localCouncilCheck(g, p, day, excused) {
  const me = p.me;
  if (me.office !== 'kugi' && me.office !== 'togi') return;
  const d = polDate(g, day);
  if (!TEIREI_MONTHS.includes(d.month)) return;
  const key = `${d.year}_${d.month}`;
  if (d.dom <= 16) { if (excused) me.localExcusedKey = key; return; }
  if (me.localSessionKey === key) return;
  me.localSessionKey = key;
  if (num(me.officeSince) > day - 8 || me.localExcusedKey === key) return;
  const fl = (g.state && g.state.flags) || {};
  const qd = me.lastAct && me.lastAct['議会で質問'];
  const q = qd ? polDate(g, qd) : null;
  if (fl.kuya_q === key || fl.kuya_vote === key || (q && q.year === d.year && q.month === d.month)) { me.localMissed = 0; return; }
  me.localMissed = num(me.localMissed) + 1;
  me.localAbsentUntil = day + 30;
  me.reputation = clamp(me.reputation - 3, -100, 100);
  me.localSupport = clamp(me.localSupport - 3, 0, 100);
  note(g, `（${d.month}月の定例会に、一度も出なかった。「議員の仕事をしていない」と批判され、議会の決まりで次の定例会まで報酬が半分に減らされる）`);
  if (me.localMissed >= 2) scandalImpl(g, p, 'absence', { who: 'player', name: '議会の欠席' });
}
// The entertainment side (review): broadcasters keep candidates off the air during the official
// campaign (公職選挙法151条の5: no campaigning by broadcast except 政見放送; 放送法4条 political
// fairness — 3条の2 before the 2010 amendment took effect in 2011), and a minister / the PM puts TV and radio work aside while in office. Stage and event
// work stay possible. Read by the job wrapper (installPolitics) and g.politicsRefusal.
const MEDIA_RE = /^(prog_|regular_)|(^|_)(tv|cm|drama|radio|news|kanmuri|quiz|wipe|loke|maesetsu|kanran|report|voice|special|kansai_local|morning_drama|model_cm|cm_extra|conte_tv|radio_guest)($|_)/;
const TV_PLACES = new Set(['nhk', 'ntv', 'tbs', 'tvasahi', 'fujitv', 'tvtokyo', 'mbs', 'ktv', 'bs_yoshimoto']);
function mediaJob(g, def = {}) {
  const id = String(def.id || '');
  if (/^regular_/.test(id)) { const r = REGULARS[id.slice(8)]; return !r || ['tv', 'radio'].includes(r.medium); }
  if (def.medium) return ['tv', 'radio'].includes(def.medium);
  if (TV_PLACES.has(g.map && g.map.placeId)) return true;
  return MEDIA_RE.test(id);
}
function campaigningNow(p, day) {
  return p.elections.upcoming.find((x) => x.status !== 'done' && x.kind !== 'sosaisen' && myDecl(x) && day >= x.koji && day <= x.day) || null;
}
function politicsRefusalImpl(g, kind = 'job', def = {}) {
  const p = pol0(g);
  if (!p || !p.me || !Array.isArray(p.elections && p.elections.upcoming)) return null;
  if (kind !== 'job' && kind !== 'regular') return null;
  if (!mediaJob(g, def)) return null;
  const day = today(g);
  const id = String(def.id || '');
  const excuse = () => { // a regular show waits for the player (not a missed week)
    if (!/^regular_/.test(id)) return;
    const s = g.state.regulars && g.state.regulars[id.slice(8)];
    if (s && !s.dropped) s.doneWeek = Math.max(num(s.doneWeek), weekOf(day));
  };
  const e = campaigningNow(p, day);
  if (e) {
    excuse();
    // 番組編集準則: 放送法3条の2 until the 2010 amendment (平成22年法律第65号, in force 2011-06-30), 4条 since
    const hosoArt = fyNow(g) >= 2011.5 ? '放送法4条' : '放送法3条の2';
    return [`（いまは${e.label}の選挙期間中。候補者は、テレビやラジオの番組には出られない）`, `（選挙運動に放送を使えるのは政見放送など決まったものだけ（公職選挙法151条の5）。放送局は政治的公平（${hosoArt}）も守るため、選挙期間中は候補者を番組に出さない。\n舞台やイベントの仕事なら、できる）`];
  }
  if (inCabinet(p.me)) {
    excuse();
    return [`（${p.me.posts.includes('pm') ? '総理大臣' : '大臣'}の在任中は、公務が最優先。テレビやラジオの芸能の仕事は休んでいる）`, '（舞台やイベントの仕事なら、公務のない日にできる）'];
  }
  return null;
}
function afterMediaJob(g, def = {}) {
  const p = pol0(g);
  if (!p || !p.me || !mediaJob(g, def)) return;
  const day = today(g);
  if (isNational(p.me) && inSession(p, day) && num(p.me.attend.last) !== day) p.me.attend.tvDay = day;
}
// Entering the cabinet ends regular TV / radio shows (a farewell from each programme).
function leaveShowsForCabinet(g, post) {
  const st = g.state;
  const titles = [];
  for (const id of Object.keys((st && st.regulars) || {})) {
    const r = REGULARS[id], s = st.regulars[id];
    if (!r || !s || s.dropped || s.since == null || !['tv', 'radio'].includes(r.medium)) continue;
    s.dropped = true;
    s.farewell = 'cabinet';
    titles.push(`『${r.title}』`);
  }
  if (!titles.length) return;
  try { g.message({ from: 'プロデューサー', kind: 'news', text: `${post}へのご就任、おめでとうございます！ 在任中は出演をお休みということで、${titles.slice(0, 3).join('')}${titles.length > 3 ? 'など' : ''}は、いったん卒業という形にさせてください。スタッフ一同、寄せ書きを用意しました。またいつか、スタジオで！` }); } catch (e) { /* no phone in some tests */ }
  note(g, `（入閣にあわせて、レギュラー番組${titles.slice(0, 3).join('')}を卒業した）`);
}
// Submit the player's ready drafts when a session opens.
function submitDrafts(g, p) {
  const day = today(g);
  for (const b of p.diet.bills) if (b.stage === 'draft' && b.ready) { b.stage = 'committee'; b.step = 'committee'; b.next = day + irnd(3, 6); b.log.push({ day, text: '国会に提出' }); }
}
// An NPC leader may give the player a party post (幹事長 etc.) when they stand high.
function offerPartyPost(g, p) {
  const me = p.me;
  const pt = p.parties[me.party];
  if (!pt || pt.leader === 'player' || pt.isPlayers || me.nationalWins < 2 || me.standing < 65) return null;
  if (me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'party')) return null;
  // review: the party's top posts go by seniority (幹事長 is the most senior; a big party asks more)
  const big = pt.id === 'jimin' || partySeats(p, pt.id) >= 150 ? 1 : 0;
  const minWins = { kanjicho: 4 + big, seichokai: 3 + big, somukai: 3 + big, sentai: 2 + big, kokutai: 2 + big };
  const open = PARTY_POST_ORDER.filter((x) => !(POSTS[x].parties && !POSTS[x].parties.includes(pt.id)) && me.nationalWins >= (minWins[x] || 3) && (x !== 'kanjicho' || me.standing >= 80));
  if (!open.length) return null;
  const post = pickOne(open);
  const o = { id: 'o' + p.nextId++, kind: 'partyPost', post, party: pt.id, day: today(g), until: today(g) + 3, from: pt.leader };
  me.offers.push(o);
  phoneNews(g, `【党役員の打診】党首から「${postName(post, fyNow(g), pt.id)}」への就任を打診されました。（3日以内に返事を）`, pt.name);
  emit(g, 'offer', o);
  return o;
}
function sanitize(p) {
  const E = p.economy;
  for (const k of ['growth', 'inflation', 'unemployment', 'debtRatio', 'yen', 'nikkei', 'gdp', 'taxRate']) if (!Number.isFinite(E[k])) E[k] = eraPolitics(p.era).eco[k] ?? 0;
  if (!Number.isFinite(p.cabinet.approval)) p.cabinet.approval = 40;
  for (const h of ['shugi', 'sangi']) for (const k of Object.keys(p.diet[h].seats)) if (!Number.isFinite(p.diet[h].seats[k]) || p.diet[h].seats[k] < 0) p.diet[h].seats[k] = 0;
  const me = p.me;
  for (const k of ['funds', 'secret', 'reputation', 'localSupport', 'standing']) if (!Number.isFinite(me[k])) me[k] = 0;
  for (const pt of Object.values(p.parties)) { if (!Number.isFinite(pt.funds)) pt.funds = 0; if (!Number.isFinite(pt.subsidy)) pt.subsidy = 0; }
}
onMorning((g) => politicsTick(g));

// ================================================================ player actions (shared by g.*)
// Campaign actions (合法). The effect grows with talk skill / fame where noted. perDay: uses a day.
// from: the first year the action is legal (ネット選挙 2013). partyOnly: needs a party (政党のネット広告).
export const CAMPAIGN_ACTIONS = {
  '街頭演説': { stamina: 12, money: 0, pts: 6, perDay: 3, skill: 'talk', fame: true, pre: true, desc: '駅前や商店街でマイクを握る。トークの力と知名度で人が集まる' },
  'ポスター': { stamina: 4, money: 50000, pts: 5, perDay: 1, perElection: 2, desc: '公営の掲示場にポスターを貼る' },
  '選挙カー': { stamina: 10, money: 60000, pts: 7, perDay: 1, desc: '名前を呼びかけながら地域を回る' },
  '討論会': { stamina: 10, money: 0, pts: 8, perDay: 1, skill: 'talk', score: true, desc: '公開討論会。出来しだいで大きく伸びる（opts.score 0-100）' },
  'SNS': { stamina: 3, money: 0, pts: 3, perDay: 2, from: 2013, fans: true, pre: true, desc: '投稿で支持を呼びかける（ネット選挙は2013年に解禁）' },
  '握手': { stamina: 8, money: 0, pts: 4, perDay: 2, local: 1, pre: true, desc: '駅や商店街で有権者と握手' },
  '後援会': { stamina: 6, money: 30000, pts: 5, perDay: 1, local: 2, kouenkai: 15, pre: true, desc: '後援会の集会で支持を固める' },
  'ネット広告': { stamina: 1, money: 200000, pts: 6, perDay: 1, from: 2013, partyOnly: true, desc: '政党のネット広告（候補者個人の有料ネット広告は禁止）' },
  '献金集め': { stamina: 6, money: 0, pts: 1, perDay: 1, donations: true, pre: true, desc: '支援者から政治資金の寄付を募る（上限と公開のルールあり）' },
};
// Illegal: routed through crime.js (commitCrime). Never offered when crime.js is missing.
export const ILLEGAL_CAMPAIGN = { '買収': 'vote_buying', '戸別訪問': 'door_to_door' };
// Office activities (ext). need: 'national' | 'local' | 'exec' | 'cabinet' | 'pm' | 'office' | 'faction'.
export const ACTIVITIES = {
  '委員会で質問': { need: 'national', session: true, stamina: 12, rep: 3, fame: 8, skill: 'talk', desc: '委員会で政府に質問する。トークの力しだい' },
  '地元回り': { need: 'any', stamina: 10, local: 3, desc: '地元の会合や祭りに顔を出す（議員でなくてもできる政治活動）' },
  '後援会づくり': { need: 'any', stamina: 6, funds: 30000, local: 1, kouenkai: 15, desc: '支援者の会（後援会）を広げる' },
  '陳情を受ける': { need: 'office', stamina: 8, local: 2, rep: 1, desc: '地域や団体の要望を聞く' },
  '勉強会': { need: 'national', stamina: 6, standing: 2, desc: '党の部会や勉強会で政策を学ぶ' },
  '派閥の会合': { need: 'faction', stamina: 6, standing: 3, desc: '派閥・グループの会合に出る' },
  '記者会見': { need: 'office', stamina: 5, fame: 5, rep: 1, skill: 'talk', gaffe: true, speech: 'kaiken', desc: '記者の質問に答える（態度しだいで失言も）' },
  '視察': { need: 'office', stamina: 10, funds: 20000, rep: 2, gaffe: true, speech: 'shisatsu', desc: '現場を見て回る（カメラが同行。ひと言に注意）' },
  // round 4: more places to speak (attitude and 失言リスク: see 「発言・態度・失言」 below)
  '街頭演説': { need: 'office', stamina: 10, local: 2, fame: 4, skill: 'talk', gaffe: true, speech: 'gaito', desc: '駅前でマイクを握る（政治活動）。ヤジも飛ぶ' },
  'TV出演': { need: 'office', stamina: 8, fame: 12, rep: 1, skill: 'talk', gaffe: true, speech: 'tv', desc: '報道番組や討論番組に出る。生放送では言い直しがきかない' },
  'SNSで発信': { need: 'office', stamina: 2, fame: 3, gaffe: true, speech: 'sns', from: 2004, desc: '自分の言葉で発信する。広がるのも炎上するのも速い' },
  '議会で質問': { need: 'local', stamina: 8, local: 2, rep: 2, skill: 'talk', desc: '区議会・都議会で質問する' },
  '予算編成': { need: 'exec', stamina: 10, local: 3, rep: 1, desc: '区（都）の予算をまとめる' },
  '閣議に出る': { need: 'cabinet', stamina: 3, standing: 1, desc: '閣議で政府の方針を決める' },
  '国会で答弁': { need: 'cabinet', session: true, stamina: 10, rep: 2, skill: 'talk', gaffe: true, speech: 'toben', approval: 0.5, desc: '大臣として国会で答弁する（態度しだいで失言も）' },
  '外遊': { need: 'pm', stamina: 20, fame: 30, approval: 2, desc: '首脳会談に出かける' },
};
// Things that are really someone else's money must never be presented as harmless:
// donations have limits; a company may give only to a party (2000年から), etc.
// Distinctive parts of real party names: a new party's name may not contain them either
// ('ドット維新' or '新・公明党' would read as a real party). Generic words (民主・自由・保守) stay allowed.
const realPartyParts = ['自由民主', '自民', '立憲民主', '立憲', '国民民主', '公明', '維新', '共産党', '社会民主', '社民', 'れいわ', '新選組', '参政党', '民進', 'みんなの党', '希望の党', 'さきがけ', '新進党', '新生党', 'NHK', 'ＮＨＫ', 'チームみらい', '中道改革'];
const realPartyNames = ['自由民主党', '自民党', '民主党', '立憲民主党', '国民民主党', '公明党', '日本維新の会', '維新の会', '日本共産党', '共産党', '社会民主党', '社民党', 'れいわ新選組', '参政党', '日本保守党', 'チームみらい', '日本社会党', '社会党', '新進党', '新生党', '日本新党', '新党さきがけ', '自由党', '保守党', '民進党', '希望の党', 'みんなの党', '民社党', '中道改革連合', 'NHK党'];

function leavePartyImpl(g, p, why = '離党') {
  const me = p.me;
  const old = me.party;
  if (!old) return 'どの政党にも入っていない';
  if (me.office === 'shugi' || me.office === 'sangi') seatMove(p, me.office, old, IND);
  if (me.office === 'kugi' || me.office === 'togi') { const L = p.local[me.office]; if (num(L.seats[old]) > 0) { L.seats[old]--; L.seats[IND] = num(L.seats[IND]) + 1; } }
  const pt = p.parties[old];
  if (pt) {
    pt.members = Math.max(0, num(pt.members) - 1);
    const f = (pt.factions || []).find((x) => x.id === me.faction);
    if (f) f.size = Math.max(0, f.size - 1);
    for (const [k, v] of Object.entries(pt.posts || {})) if (v === 'player') { const n = newNpc(p, { party: old, office: 'shugi', house: 'shugi' }); n.posts.push(k); pt.posts[k] = n.id; }
  }
  me.posts = me.posts.filter((x) => !(POSTS[x] && POSTS[x].kind === 'party'));
  for (const [post, id] of Object.entries(p.cabinet.ministers)) if (id === 'player' && old && isRuling(p, old)) { me.posts = me.posts.filter((x) => x !== post); const m = pickMinister(p, cabinetPartyOfPM(p) || p.cabinet.partyIds[0], p.cabinet.ministers); m.posts.push(post); p.cabinet.ministers[post] = m.id; }
  me.party = null;
  me.faction = null;
  me.member = false;
  me.standing = 30;
  // the PM leaving the governing party brings the cabinet down; a party left without its
  // leader gets an acting NPC leader and a leadership race
  if (p.cabinet.pm === 'player' && !p.cabinet.resigned) resignCabinet(g, p, '総理大臣の離党');
  if (pt && pt.leader === 'player' && !pt.isPlayers) {
    pt.leader = partyNominee(p, old).id;
    me.leaderTerms = 0;
    leaderRaceSoon(g, p, old, today(g) + 8, '党首の離党');
  }
  for (const e of p.elections.upcoming) { const d = myDecl(e); if (d && d.party === old) d.party = IND; }
  if (pt && pt.isPlayers && pt.leader === 'player') {
    // the founder leaves: the party carries on under an NPC (or dissolves when nobody is left)
    if (partySeats(p, old) <= 0 && num(pt.members) <= 1) { (p.flags.partyNames || (p.flags.partyNames = {}))[old] = pt.short; delete p.parties[old]; news(p, g, `${pt.name}が解散した`); }
    else { const n = newNpc(p, { party: old, office: 'shugi', house: 'shugi' }); pt.leader = n.id; pt.isPlayers = false; }
  }
  if (me.office) me.reputation = clamp(me.reputation - 3, -100, 100);
  // the feed line in correct Japanese (「〜を除名」 would read as the player expelling the party); a real
  // party is never named next to the player's scandal (the line then says only 離党)
  const who = `${g.state.name}氏`, pname = pt ? pt.name : '所属政党';
  const realP = !!((pt && pt.real) || (PARTY_DEFS[old] && PARTY_DEFS[old].real));
  let line;
  if (why === '除名') line = `${who}が${pname}から除名された`;
  else if (why === '政界引退') line = `${who}が政界を引退し、${pname}を離れた`;
  else if (why === '離党' || (realP && (why === '離党勧告' || why === '離党（不祥事）'))) line = `${who}が${pname}を離党`;
  else if (why === '離党勧告') line = `${who}が離党勧告を受けて${pname}を離党`;
  else if (why === '離党（不祥事）') line = `${who}が不祥事で${pname}を離党`;
  else line = `${who}が${pname}を離党（${why}）`;
  news(p, g, line);
  emit(g, 'party', { kind: 'left', party: old, why });
  return null;
}
// 党費 (目安: 一般党員 年4,000円 — 自民党の一般党員の党費; the fictional parties use the same 目安).
// Internal game money at the era's price level (shown with fmtMoney as that era's yen).
export const PARTY_FEE = 4000;
const partyFeeOf = (p) => Math.round(PARTY_FEE / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1));
// Why the player cannot join a party now (null = can). Nothing changes here.
// 党員の年齢 (目安): the 選挙権 age of the year (20歳, 2016年から18歳; 自民党の党員も2015年は20歳以上).
function joinPartyBlock(g, p, id) {
  const me = p.me;
  const pt = p.parties[id];
  if (!pt) return 'その政党はいまはない';
  if (me.party === id) return 'すでにこの政党に入っている';
  if (pt.real && !partyExistsIn(id, fyNow(g))) return 'その政党はこの時代にはない';
  const minAge = votingAge(calYear(g), p.flags);
  const age = ageOf(g.state);
  if (age < minAge) return `党員になれるのは${minAge}歳から（いまは${age}歳）`;
  const fee = partyFeeOf(p);
  if (num(g.state.money) < fee) return `党費（年${fmtMoney(fee)}）が払えない（所持金 ${fmtMoney(Math.max(0, num(g.state.money)))}）`;
  return null;
}
function joinPartyImpl(g, p, id) {
  const me = p.me;
  const pt = p.parties[id];
  const block = joinPartyBlock(g, p, id);
  if (block) return block;
  const fee = partyFeeOf(p);
  if (me.party) { const why = leavePartyImpl(g, p, '離党'); if (why) return why; }
  // 国会法109条の2: a member elected by 比例 who joins another party that ran in that election
  // (existed then) becomes 退職者. Independents and new parties are fine; so is the list party.
  const pr = me.prElected;
  if (pr && me.office === pr.house && id !== pr.party && (pt.founded == null || num(pt.founded) <= num(pr.day))) {
    loseOffice(g, p, '比例代表で当選し、選挙のときにあった別の政党に移ったため（国会法109条の2）');
  }
  const from = IND;
  if (me.office === 'shugi' || me.office === 'sangi') seatMove(p, me.office, from, id);
  if (me.office === 'kugi' || me.office === 'togi') { const L = p.local[me.office]; if (num(L.seats[IND]) > 0) L.seats[IND]--; L.seats[id] = num(L.seats[id]) + 1; }
  me.party = id;
  me.member = true;
  me.standing = clamp(25 + me.nationalWins * 8 + Math.log10(1 + num(g.state.fame)) * 4, 0, 90);
  pt.members = num(pt.members) + 1;
  // 党費 (the first year's fee; checked above, so it is never taken from money the player does not have)
  g.state.money -= fee;
  news(p, g, `${g.state.name}氏が${pt.name}に入党`);
  emit(g, 'party', { kind: 'joined', party: id });
  return null;
}
function foundPartyImpl(g, p, def = {}) {
  const me = p.me;
  const name = String(def.name || '').trim();
  const short = String(def.short || name.slice(0, 2)).trim().slice(0, 6);
  if (!name || name.length > 12) return { why: '党名は1〜12文字で' };
  if (realPartyNames.some((n) => name === n || short === n) || realPartyParts.some((n) => name.includes(n) || short.includes(n))) return { why: 'すでにある（あった）政党とまぎらわしい名前は届け出られない' };
  if (!short) return { why: '略称が必要' };
  if ([...Object.values(p.parties), ...Object.values(PARTY_DEFS)].some((x) => x.name === name || x.short === short)) return { why: '同じ名前の政党がすでにある' };
  // 成年年齢: 20歳、2022年4月1日から18歳（改正民法）
  const d0 = polDate(g);
  const adult = d0.year > 2022 || (d0.year === 2022 && d0.month >= 4) ? 18 : 20;
  if (ageOf(g.state) < adult) return { why: `政党をつくるのは成人（${adult}歳）になってから` };
  const cost = Math.round(5000000 / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1)); // 事務所・届出・印刷など（目安）
  if (g.state.money + me.funds < cost) return { why: `結党の資金 ${fmtMoney(cost)} が足りない` };
  const fromFunds = Math.min(me.funds, cost);
  me.funds -= fromFunds;
  g.state.money -= cost - fromFunds;
  const fy = fyNow(g);
  const id = 'my' + (p.nextId++);
  const ideology = def.ideology && typeof def.ideology === 'object'
    ? { econ: clamp(num(def.ideology.econ), -2, 2), social: clamp(num(def.ideology.social), -2, 2), security: clamp(num(def.ideology.security), -2, 2) }
    : ideologyOfPlatform(def.platform || []);
  const platform = (Array.isArray(def.platform) ? def.platform : []).filter((x) => POLICIES[x]).slice(0, 10);
  if (me.party) leavePartyImpl(g, p, '離党');
  const pt = makeParty(p, id, fy, { name, short, color: /^#[0-9a-f]{6}$/i.test(def.color || '') ? def.color : '#e05a8a', emblem: def.emblem || null, ideology, platform, isPlayers: true, founded: today(g), funds: 0, members: 1 + Math.round(num(g.state.fans) * 0.01), desc: def.desc || `${g.state.name}が立ち上げた政党` });
  pt.leader = 'player';
  me.party = id;
  me.member = true;
  me.standing = 100;
  if (!me.posts.includes('party_leader')) me.posts.push('party_leader');
  if (me.office === 'shugi' || me.office === 'sangi') seatMove(p, me.office, IND, id);
  if (me.office === 'kugi' || me.office === 'togi') { const L = p.local[me.office]; if (num(L.seats[IND]) > 0) L.seats[IND]--; L.seats[id] = num(L.seats[id]) + 1; }
  // first supporters: fans and the segments close to the platform
  const famek = Math.min(0.03, Math.log10(1 + num(g.state.fame)) * 0.005);
  for (const s of SEGMENT_ORDER) {
    const b = p.support.base[s] || (p.support.base[s] = {});
    b[id] = Math.max(0.001, famek * Math.exp(0.8 * partyAffinity(p, s, id)) * 0.4);
  }
  refreshOpinion(p, g);
  news(p, g, `${g.state.name}氏が新党「${name}」を結成`);
  phoneNews(g, `【新党結成】${g.state.name}氏が新党「${name}」を立ち上げました。\n政党要件（国会議員5人以上、または1人以上で得票率2%以上）を満たすと、政党交付金の対象になります。`);
  emit(g, 'party', { kind: 'founded', party: id, player: true });
  return { id };
}
function ideologyOfPlatform(list) {
  const v = { econ: 0, social: 0, security: 0 };
  let n = 0;
  for (const id of list) { const pl = POLICIES[id]; if (!pl) continue; const o = ideoOf(pl); v.econ += o.econ; v.social += o.social; v.security += o.security; n++; }
  if (n) for (const k of Object.keys(v)) v[k] = clamp(v[k] / n * 1.5, -2, 2);
  return v;
}
// 公認 / 推薦 request for an election. opts (as for declareCandidacy): { proportional: true |
// 'only', hometown }. Parties back their 現職 first: a seat the party already holds goes to its
// member unless the player stands very high; famous people (タレント候補) are wanted mostly for
// 比例代表 and open seats. -> { ok, why?, kind, party, score, need, held? }
function nominationImpl(g, p, e, opts = {}) {
  const me = p.me;
  if (!e) return { ok: false, why: 'その選挙は予定されていない' };
  // 被選挙権 first (age on 投票日, 公民権停止, 刑の執行中): the same check as the 選管
  const office = officeOfElection(e);
  if (office) { const why = eligibleImpl(g, p, office, { day: e.day, noMoney: true }); if (why) return { ok: false, why, eligible: false }; }
  if (!me.party) return { ok: false, why: 'どの政党にも入っていない（無所属で立候補するなら公認はいらない）' };
  const pt = p.parties[me.party];
  if (!pt) return { ok: false, why: '政党が見つからない' };
  const kind = ['chiji', 'shicho'].includes(e.kind) ? '推薦' : '公認';
  me.nominations = me.nominations || {};
  me.nomKind = me.nomKind || {};
  const wantPR = (e.kind === 'shugi' && opts.proportional === 'only') || (e.kind === 'sangi' && !!opts.proportional);
  const have = me.nominations[e.id] === me.party ? (me.nomKind[e.id] || 'district') : null;
  if (have && (have === 'district' || wantPR)) return { ok: true, kind, party: me.party, already: true };
  const grant = () => { me.nominations[e.id] = me.party; me.nomKind[e.id] = wantPR ? 'pr' : 'district'; };
  if (pt.leader === 'player') { grant(); return { ok: true, kind, party: me.party }; }
  const fame = num(g.state.fame);
  const fameQ = Math.min(1.2, Math.log10(1 + fame) / 4);
  let score = me.standing / 100 * 0.4 + fameQ * 0.55 + me.localSupport / 100 * 0.3 + me.reputation / 200 + (me.nationalWins ? 0.2 : 0) + (me.wins && !me.nationalWins ? 0.08 : 0) + (me.faction ? 0.08 : 0);
  if (me.scandalDay && today(g) - me.scandalDay < YEAR_DAYS) score -= 0.4;
  // a member who skips the Diet is not put up again easily (欠席の多い議員)
  const att = num(me.attend && me.attend.days), miss = num(me.attend && me.attend.missed);
  if (att + miss >= 10) score -= 0.5 * (miss / (att + miss));
  // need: the party's bar for this race; star: fame that gets a nomination anyway (タレント候補)
  let need, star;
  if (e.kind === 'sangi') { need = wantPR ? 0.42 : 0.6; star = wantPR ? 2000 : 6000; }
  else if (e.kind === 'shugi') {
    const chu = shugiRules(yearOfAbs(p, absOfDay(p, e.day)), p.flags).system === 'chusenkyoku';
    // 比例単独 slots are few (most are 重複 candidates): a newcomer needs standing or real fame
    need = wantPR ? 0.68 : chu ? 0.62 : 0.55; star = wantPR ? 5000 : chu ? 8000 : 5000;
  } else if (e.kind === 'hosen') {
    const theirs = e.vacancy && e.vacancy.party === me.party;
    need = theirs ? 0.45 : 0.58; star = theirs ? 2500 : 6000;
    // 落下傘: a seat far from Tokyo and the hometown wants a local candidate first (review)
    const vp = (e.vacancy && e.vacancy.pref) || 'tokyo';
    const home = g.state.profile && g.state.profile.hometown;
    if (vp !== 'tokyo' && vp !== home) { need += 0.15; star = 6000; }
  }
  else if (e.kind === 'chiji') { need = 0.65; star = 8000; }
  else if (e.kind === 'shicho') { need = 0.5; star = 3000; }
  else { need = 0.36; star = 800; } // 区議・都議
  const held = heldByParty(g, p, e, me.party, opts);
  if (held) { need += 0.35; star = INF; }
  if (score >= need || fame >= star) { grant(); return { ok: true, kind, party: me.party, score, need }; }
  if (held) {
    const where = e.kind === 'shugi' ? 'この小選挙区' : 'この選挙';
    return { ok: false, why: `${where}は現職の${held.name}氏に${kind}が出る。${e.kind === 'shugi' ? '比例代表（単独）や参議院、ほかの選挙をねらう手もある' : '党内でもっと力をつけよう'}`, score, need, held: held.id };
  }
  // the numbers to aim for: the party's score (党内の評価・知名度・地元の支持・評判・当選歴) against the bar,
  // or the fame that gets a nomination anyway
  const sc = Math.max(0, Math.round(score * 100)), nd = Math.round(need * 100);
  return { ok: false, why: `党の選考で見送られた（党の評価 ${sc}点／必要 ${nd}点。党内の評価・知名度・地元の支持で上がる。知名度★${Math.round(star).toLocaleString('ja-JP')}なら${kind}が出る）`, score, need, star };
}
function officeOfElection(e) {
  if (!e) return null;
  if (e.kind === 'hosen') return e.house === 'sangi' ? 'sangi' : 'shugi';
  return (ELECTION_KINDS[e.kind] || {}).office || null;
}
// 推薦人 for a party leader race: Diet members who would put their name to the player. They come
// from the player's faction / group and the party at large, and only for a member with some
// seniority (当選回数), standing in the party and a post (review: a first-termer gets almost none).
function recommendersFor(g, p, pt) {
  const me = p.me;
  if (!pt) return 0;
  const wins = num(me.nationalWins);
  const minWins = pt.id === 'jimin' ? 3 : 2;
  const winsK = clamp((wins - minWins + 1) / 3, 0, 1);
  const standK = clamp((me.standing - 30) / 50, 0, 1);
  const post = me.posts.some((x) => POSTS[x] && (POSTS[x].kind === 'party' || POSTS[x].kind === 'cabinet'));
  const f = (pt.factions || []).find((x) => x.id === me.faction);
  const fac = f ? num(f.size) * 0.35 * winsK * standK : 0;
  const wide = (pt.factions || []).length ? 0 : partySeats(p, pt.id) * 0.08 * winsK * standK; // a party without factions
  const fame = wins >= 1 ? Math.min(3, Math.log10(1 + num(g.state.fame))) : 0;
  const veteran = Math.min(6, Math.max(0, wins - 4) * 1.5); // a long career brings friends across the party
  return Math.round(fac + wide + winsK * standK * 6 + (post ? 4 * winsK : 0) + fame + veteran);
}
function declareImpl(g, p, e, opts = {}) {
  const me = p.me;
  const day = today(g);
  if (!e || e.status === 'done') return 'その選挙は予定されていない';
  if (ELECTION_KINDS[e.kind].newsOnly) return 'この選挙はドット区の外の自治体の選挙だ';
  if (myDecl(e)) return 'すでに立候補している';
  if (day > e.koji) return `立候補の届出は${e.kind === 'shugi' || e.kind === 'sangi' ? '公示' : '告示'}日（${dateLabel(g, e.koji)}）まで`;
  // a filing for a public election blocks other public elections only (never a party leader race)
  const other = e.kind !== 'sosaisen' && me.candidacy && me.candidacy !== e.id ? p.elections.upcoming.find((x) => x.id === me.candidacy && x.status !== 'done' && x.kind !== 'sosaisen') : null;
  if (other) return `別の選挙（${other.label}）に立候補を届け出ている。こちらに出るなら、先に届出を取り下げて`;
  if (e.kind === 'sosaisen') {
    if (me.party !== e.party) return 'その政党の党員ではない';
    if (me.office !== 'shugi' && me.office !== 'sangi') return '党首選に出られるのは国会議員だけ';
    const pt = p.parties[e.party];
    const ey = yearOfAbs(p, absOfDay(p, e.day));
    if (pt && pt.leader === 'player' && num(me.leaderTerms) >= leaderTermLimit(e.party, ey)) return `党則で、${postName('party_leader', ey, e.party)}は連続${leaderTermLimit(e.party, ey)}期まで`;
    if (p.flags.outgoingLeader === 'player') return '辞任したばかりで、今回は立候補できない';
    const need = e.party === 'jimin' ? (ey >= 2002 ? 20 : 30) : 10; // 推薦人（自民 20人・1990年代は30人、ほかは 目安）
    const have = recommendersFor(g, p, pt);
    if (have < need) return `推薦人が${need}人集まらない（いまは${have}人ほど）。${num(me.nationalWins) < (e.party === 'jimin' ? 3 : 2) ? '当選回数の少ない議員を推す人は、まだいない' : '派閥・グループの支持と、党内の評価が必要'}`;
    e.declared.player = { day, party: e.party, deposit: 0, recommenders: have };
    return null;
  }
  // 届出 is taken from 30 game days before the vote (3 months on the game calendar) to 公示/告示; earlier, the
  // player can only announce the intention to run (出馬表明, not binding)
  if (e.day - day > 30) {
    me.intent = { election: e.id, day };
    return `立候補の届出は、投票日の30日前（${dateLabel(g, e.day - 30)}ごろ）から受け付ける。いまは「出馬表明」をしておいた`;
  }
  const office = officeOfElection(e);
  const why = eligibleImpl(g, p, office, { noMoney: true, day: e.day });
  if (why) return why;
  const year = yearOfAbs(p, absOfDay(p, e.day));
  let party = opts.party === undefined ? (me.nominations && me.nominations[e.id] ? me.party : null) : opts.party;
  if (party === IND) party = null;
  if (party && party !== me.party) return 'その政党の党員ではない';
  if (party) {
    const r = nominationImpl(g, p, e, opts);
    if (!r.ok) return r.why;
  }
  let proportional = !!opts.proportional;
  const prOnly = opts.proportional === 'only';
  if (proportional && !party) return '比例代表で立候補するには政党の公認が必要';
  if (proportional && !['shugi', 'sangi'].includes(e.kind)) proportional = false;
  if (e.kind === 'shugi' && shugiRules(year, p.flags).system === 'chusenkyoku') proportional = false;
  // the deposit: 比例 is paid by the party; otherwise from political funds, then personal money
  const deposit = (e.kind === 'sangi' && proportional) || prOnly ? 0 : Math.round(depositFor(office, year) / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1));
  if (deposit > me.funds + g.state.money) return `供託金 ${fmtMoney(deposit)} が用意できない`;
  let from = 'funds';
  if (deposit) {
    if (me.funds >= deposit) me.funds -= deposit;
    else { from = 'money'; g.state.money -= deposit; }
  }
  // 地元（ふるさと）から出馬: 衆院の小選挙区・中選挙区、参院の選挙区 (hosen: when the vacancy is there)
  const homePref = g.state.profile && PREFECTURES[g.state.profile.hometown] ? g.state.profile.hometown : 'tokyo';
  const hometown = !!opts.hometown && homePref !== 'tokyo' && (e.kind === 'hosen' ? !!(e.vacancy && e.vacancy.pref === homePref) : (e.kind === 'shugi' && !prOnly) || (e.kind === 'sangi' && !proportional));
  const chu = e.kind === 'shugi' && shugiRules(year, p.flags).system === 'chusenkyoku';
  const district = opts.district || (e.kind === 'hosen' ? e.district : hometown ? (e.kind === 'sangi' ? `${prefShort(homePref)}選挙区` : `${prefShort(homePref)}ドット区${chu ? '（定数4）' : ''}`) : chu ? HOME_DISTRICT.shugiChu : e.kind === 'sangi' && proportional ? '全国比例' : HOME_DISTRICT[e.kind] || null);
  e.declared.player = { day, district, party: party || IND, proportional: proportional && !prOnly, prOnly: e.kind === 'shugi' && prOnly, pr: e.kind === 'sangi' && proportional, deposit, depositFrom: from, hometown, pref: hometown ? homePref : 'tokyo' };
  me.candidacy = e.id;
  me.campaign = { election: e.id, points: 0, actions: {}, spent: 0, day };
  if (day >= e.koji && ninetyApplies(p, e)) loseOffice(g, p, '他の選挙に立候補（公職選挙法90条）', { keepLeader: true });
  if (day >= e.koji) playerElectionCost(g, p, e, e.declared.player);
  if (me.intent && me.intent.election === e.id) me.intent = null;
  news(p, g, `${g.state.name}氏が${e.label}に${party ? `${pname(p, party)}の公認で` : '無所属で'}立候補を表明`);
  emit(g, 'party', { kind: 'candidacy', election: e.id });
  return null;
}
function eligibleImpl(g, p, officeId, opts = {}) {
  const O = OFFICES[officeId];
  if (!O) return 'その役職はない';
  // 公選法10条2項: the age is counted on the election day (opts.day)
  const age = opts.day != null ? ageAt(g.state, opts.day) : ageOf(g.state);
  if (age < O.ageMin) return `${O.label}に立候補できるのは${O.ageMin}歳から（${opts.day != null ? '投票日には' : 'いまは'}${age}歳）`;
  const J = g.state.justice;
  if (J && J.status === 'prison') return '刑の執行中は被選挙権がない（公職選挙法11条）';
  if (civicBarred(g)) {
    // the exact reason (公民権停止 / 11条の2 …) from crime.js when it is loaded
    let why = null;
    try { why = typeof g.civicBanReason === 'function' ? g.civicBanReason('candidacy') : null; } catch (e) { why = null; }
    return why ? `立候補できない：${String(why).replace(/。$/, '')}` : '公民権停止中のため、立候補できない';
  }
  if (J && J.status === 'detained') return '身柄を拘束されていて、立候補の手続きができない';
  if (!opts.noMoney) {
    const year = calYear(g);
    const dep = Math.round(depositFor(officeId, year, opts) / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1));
    if (g.state.money + p.me.funds < dep) return `供託金 ${fmtMoney(dep)} が用意できない（所持金と政治資金の合計 ${fmtMoney(g.state.money + p.me.funds)}）`;
  }
  return null;
}
// One campaign action. Returns { ok, why?, action, pts, total, cost, stamina, text }.
async function campaignImpl(g, p, action, opts = {}) {
  const me = p.me;
  const st = g.state;
  const day = today(g);
  const e = p.elections.upcoming.find((x) => x.id === (opts.electionId || me.candidacy) && x.status !== 'done');
  if (!e || !myDecl(e)) return { ok: false, why: '立候補している選挙がない', action };
  if (day >= e.day) return { ok: false, why: '投票日には選挙運動はできない', action };
  const year = calYear(g);
  const pre = day < e.koji;
  const camp = me.campaign && me.campaign.election === e.id ? me.campaign : (me.campaign = { election: e.id, points: 0, actions: {}, spent: 0, day });
  if (ILLEGAL_CAMPAIGN[action]) {
    if (typeof g.commitCrime !== 'function') return { ok: false, why: 'それは公職選挙法で禁じられている', action, illegal: true };
    let r = null;
    try { r = await g.commitCrime(ILLEGAL_CAMPAIGN[action], { election: e.id, kind: e.kind, action }); } catch (err) { console.error(err); }
    const pts = action === '買収' ? 25 : 8;
    camp.points += pts;
    if (action === '買収') { const cost = Math.round(500000 + num(st.fame) * 50); st.money = Math.max(0, st.money - cost); }
    return { ok: true, action, pts, total: camp.points, illegal: true, crime: r, text: `${action}をした…。（違法行為）` };
  }
  const A = CAMPAIGN_ACTIONS[action];
  if (!A) return { ok: false, why: 'そんな選挙運動はない', action };
  if (pre && !A.pre) return { ok: false, why: `公示・告示の前（${dateLabel(g, e.koji)}まで）は、ふだんの政治活動しかできない`, action };
  if (A.from && year < A.from) return { ok: false, why: 'この時代は、ネットでの選挙運動が認められていない（2013年に解禁）', action };
  const d = myDecl(e);
  if (A.partyOnly && (!d.party || d.party === IND)) return { ok: false, why: '候補者個人の有料ネット広告は禁止。政党の公認候補なら、党の広告に載せてもらえる', action };
  const key = `${action}`;
  const used = num(camp.actions[key + '@' + day]);
  if (used >= (A.perDay || 1)) return { ok: false, why: `${action}は今日はもう十分やった`, action };
  if (A.perElection && num(camp.actions[key]) >= A.perElection) return { ok: false, why: `${action}はもう十分だ`, action };
  if (st.stamina < A.stamina) return { ok: false, why: '体力が足りない', action };
  const cost = Math.round(num(A.money) / 1);
  if (cost > me.funds + st.money) return { ok: false, why: `お金（${fmtMoney(cost)}）が足りない`, action };
  st.stamina -= A.stamina;
  if (cost) { const f = Math.min(me.funds, cost); me.funds -= f; st.money -= cost - f; camp.spent += cost; }
  let pts = A.pts * (1 + used * -0.25);
  if (A.skill) pts *= 0.7 + num(st.skills && st.skills[A.skill]) / 100 * 0.8;
  if (A.fame) pts *= 1 + Math.min(1.2, Math.log10(1 + num(st.fame)) / 4);
  if (A.fans) pts *= 1 + Math.min(1.5, Math.log10(1 + num(st.fans)) / 4);
  if (A.score) pts *= 0.4 + clamp(num(opts.score, 55), 0, 100) / 100 * 1.4;
  if (pre) pts *= 0.5;
  pts *= 1 + Math.min(5, me.staff) * 0.05; // 秘書・運動員
  // round 4: how the player spoke (街頭演説・SNS・討論会 with an attitude): a hit lifts the day, a gaffe sinks it
  let speech = null;
  if ((action === '街頭演説' || action === 'SNS' || action === '討論会') && (opts.attitude || (opts.speech && typeof opts.speech === 'object'))) {
    speech = opts.speech && typeof opts.speech === 'object' ? opts.speech : speakImpl(g, p, action === 'SNS' ? 'sns' : action === '討論会' ? 'tv' : 'gaito', { attitude: opts.attitude, topic: opts.topic || (action === '討論会' ? 'general' : 'crowd') });
    if (speech && speech.ok) pts *= speech.outcome === 'good' ? 1.6 : speech.outcome === 'gaffe' ? 0.25 : ({ teinei: 1, tsuyoki: 1.1, joke: 1.05, hagurakasu: 0.8, honne: 1.1, gyakugire: 0.6, risky: 1.2, shazai: 0.9 }[speech.attitude] || 1);
  }
  pts = Math.round(pts * 10) / 10;
  camp.points += pts;
  camp.actions[key] = num(camp.actions[key]) + 1;
  camp.actions[key + '@' + day] = used + 1;
  if (A.local) me.localSupport = clamp(me.localSupport + gainTo(me.localSupport, A.local), 0, 100);
  if (A.kouenkai) me.kouenkai += kouenkaiGain(p, A.kouenkai);
  let extra = '';
  if (A.donations) { const r = donationsImpl(g, p, {}); extra = r.text; }
  if (g.lifeTick) g.lifeTick({ hunger: -6, stress: 4, clean: -6 });
  return { ok: true, action, pts, total: Math.round(camp.points * 10) / 10, cost, stamina: A.stamina, speech, text: `${action}をした。手ごたえ +${pts}${extra ? `\n${extra}` : ''}${speech && speech.outcome === 'gaffe' ? `\n…しかし、${speech.line}が問題に（${speech.gaffe ? (GAFFE_KINDS[speech.gaffe.kind] || GAFFE_KINDS.uekara).short : '失言'}）` : speech && speech.outcome === 'good' ? `\n${speech.good.name}！` : ''}` };
}
// 寄付 (review). Supporters give to a politician who is in office, used to be, or is running
// (a declared candidacy or 出馬表明). 政治資金規正法: an individual may give a politician's 資金管理団体
// up to 150万円 a year, a company only to parties since 2000 (before, to politicians too). In the
// game the year's total from supporters is limited (DONATION_YEAR, 目安) and asking again and again
// in one month brings less; the rest is the 裏金 route of the dark side.
const DONATION_YEAR = 15000000;
const DONATION_CORP_BEFORE_2000 = 20000000;
function donationBlock(g, p) {
  const me = p.me;
  const running = (me.candidacy && p.elections.upcoming.some((x) => x.id === me.candidacy && x.status !== 'done')) || (me.intent && p.elections.upcoming.some((x) => x.id === me.intent.election && x.status !== 'done'));
  if (!me.office && !me.formerOffice && !running && !(me.posts || []).includes('party_leader')) return '議員でも候補者でもない人に、政治資金を寄付する支援者はまだいない（立候補や出馬表明をしてから）';
  const year = calYear(g);
  const capY = DONATION_YEAR + (year < 2000 ? DONATION_CORP_BEFORE_2000 : 0);
  if (num(ledger(p, year).donations) >= capY) return `今年の寄付はもう集まりきった（年${fmtMoney(capY)}ほどが目安。それ以上を求めるのは無理がある）`;
  return null;
}
function donationsImpl(g, p, opts = {}) {
  const me = p.me;
  const st = g.state;
  const year = calYear(g);
  const why = donationBlock(g, p);
  if (why) return { ok: false, why, amount: 0, text: why };
  const lg = ledger(p, year);
  const capY = DONATION_YEAR + (year < 2000 ? DONATION_CORP_BEFORE_2000 : 0);
  // the first few requests of a month are worth asking; after that supporters have given already
  const mi = Math.floor(absOfDay(p, today(g)) / MONTH_DAYS);
  if (num(me.donMonth && me.donMonth.m) !== mi) me.donMonth = { m: mi, n: 0 };
  me.donMonth.n++;
  const fall = me.donMonth.n <= 4 ? 1 : 0.3;
  const k = me.localSupport * 2000 + Math.log10(1 + num(st.fame)) * 60000 + Math.min(3000, me.kouenkai) * 300 + (me.office ? 80000 : 0);
  let amt = Math.round(k * rnd(0.6, 1.3) * fall);
  // companies could give to politicians' funds until 1999; since 2000 only to parties
  if (year < 2000 && me.office) amt = Math.round(amt * 1.6);
  amt = Math.max(0, Math.min(amt, 3000000, capY - num(lg.donations)));
  me.funds += amt;
  lg.income += amt;
  lg.donations += amt;
  return { ok: true, amount: amt, text: `寄付が集まった：${fmtMoney(amt)}（政治資金に。収支報告に記載が必要）${fall < 1 ? '\n（今月はもう何度もお願いしている。集まりが悪い）' : ''}` };
}

// ================================================================ 発言・態度・失言 (ext, round 4)
// The player chooses HOW to speak — 丁寧・誠実 / 強気 / 冗談まじり / はぐらかす / 本音 / 逆ギレ (+ 謝罪・低姿勢 when
// apologising, and sometimes a bold 際どい一言) — at a 記者会見, 国会答弁, 街頭演説, 視察, テレビ, SNS, 被災者との対話
// or 謝罪会見. Every choice shows its 失言リスク (%): the attitude's base × the venue × the topic × the talk skill ×
// fatigue × the media's scrutiny × the post (the 復興担当大臣 is watched closely on the disaster). A gaffe starts a chain
//   炎上 → 撤回 → 謝罪会見 → 野党の追及 → 問責・不信任 → 辞任・更迭   (or it dies down: 沈静化)
// with effects on the cabinet's approval, the party's view of the player (standing), the media (me.media) and the
// fans. Good outcomes too (本音が受ける・好感度アップ・誠実さが伝わる・頼もしい). NPC politicians have a 人柄 (persona)
// and their own gaffes in the news — NPCs of the fictional parties (and independents) only: an NPC of a real party
// (自民・民主) is never shown in a gaffe (as for scandals). Every line here is invented for the game; none is a real
// politician's remark. 差別と受け取られかねない発言 / 歴史認識 are written as a description of the remark (a
// paraphrase), never as the words themselves.
export const SPEECH_VENUES = {
  kaiken: { name: '記者会見', who: '記者', mult: 1.0, desc: '記者の質問に答える。言ったことは、そのまま記事になる' },
  toben: { name: '国会答弁', who: '野党の議員', mult: 1.1, desc: '委員会で野党の質問に答える。議事録に残り、テレビ中継されることもある' },
  gaito: { name: '街頭演説', who: '聴衆', mult: 1.2, desc: '駅前でマイクを握る。ヤジも飛ぶし、動画にも撮られている' },
  shisatsu: { name: '視察', who: '地元の人', mult: 1.15, desc: '現場を歩き、関係者と話す。カメラが同行している' },
  tv: { name: 'テレビ出演', who: '司会者', mult: 1.25, desc: '討論番組や報道番組に出る。生放送では言い直しがきかない' },
  sns: { name: 'SNS', who: 'フォロワー', mult: 1.35, from: 2004, desc: '自分の言葉をそのまま発信する。広がるのも、炎上するのも速い' },
  taiwa: { name: '被災者との対話', who: '被災した人', mult: 1.25, desc: '避難所や仮設住宅で、被災した人の声を聞く。ひと言の重みがちがう' },
  shazai: { name: '謝罪会見', who: '記者', mult: 1.3, desc: '問題になった発言について説明し、おわびする。態度しだいで火に油を注ぐ' },
};
// ブログ (2000年代) → SNS (2010年代〜): the venue's name by year
export function venueName(id, year = 2026) {
  if (id === 'sns') return year < 2010 ? 'ブログ' : 'SNS';
  return (SPEECH_VENUES[id] || SPEECH_VENUES.kaiken).name;
}
// topics: name ({t} in the lines) and, for the hot ones, how each attitude's risk is multiplied
export const SPEECH_TOPICS = {
  general: { name: '政府の方針' },
  disaster: { name: '災害への対応', hot: true, mult: { joke: 2.3, honne: 1.4, tsuyoki: 1.3, gyakugire: 1.25, hagurakasu: 1.2 } },
  victim: { name: '被災した人の暮らし', hot: true, mult: { joke: 2.6, honne: 1.3, tsuyoki: 1.5, gyakugire: 1.3, hagurakasu: 1.3 } },
  economy: { name: '景気と暮らし', mult: { joke: 1.1 } },
  scandal: { name: '政治とカネの問題', mult: { hagurakasu: 1.6, gyakugire: 1.3, joke: 1.4 } },
  bill: { name: '審議中の法案' },
  approval: { name: '内閣の支持率', mult: { tsuyoki: 1.2 } },
  history: { name: '歴史の問題', mult: { honne: 1.9, joke: 1.5, tsuyoki: 1.3 } },
  fame: { name: '芸能界から政治家になったこと', mult: { joke: 0.8 } },
  gaffe: { name: '問題になった発言', hot: true, mult: { joke: 2.0, gyakugire: 1.4, hagurakasu: 1.4, honne: 1.3, tsuyoki: 1.3 } },
  local: { name: '地元の要望', mult: { honne: 1.2 } },
  crowd: { name: 'いまの政治' },
  message: { name: '国民へのメッセージ' },
  opposition: { name: 'ご指摘の点', label: '野党の質問', mult: { gyakugire: 1.3, tsuyoki: 1.2 } },
};
export const ATTITUDES = {
  teinei: {
    name: '丁寧・誠実', short: '丁寧', risk: 2, score: 78,
    desc: '質問をよく聞き、事実と気持ちをていねいに答える。大きく外さないが、目立ちにくい。',
    kinds: { uekara: 1, inpei: 1 }, good: { p: 0.22, kind: 'seijitsu' },
    react: 'うなずきながらメモをとる人が多かった（無難な受け答え）',
  },
  tsuyoki: {
    name: '強気', short: '強気', risk: 7, score: 66,
    desc: '迷わず言い切る。頼もしく見える一方、上から目線や暴言と受け取られることもある。',
    kinds: { uekara: 4, bougen: 2, miuchi: 1 }, good: { p: 0.26, kind: 'tanomoshii' },
    react: '力強い言い方に、うなずく人も、眉をひそめる人もいた',
  },
  joke: {
    name: '冗談まじり', short: '冗談', risk: 12, score: 62,
    desc: '笑いで場をなごませる。受ければ好感度が上がるが、滑ると失言になる。災害の話題ではとくに危ない。',
    kinds: { joke: 5, hisaichi: 2, sabetsu: 1 }, good: { p: 0.32, kind: 'kokando' },
    react: '少し笑いが起きた',
  },
  hagurakasu: {
    name: 'はぐらかす', short: 'はぐらかす', risk: 5, score: 40,
    desc: '核心に触れずにかわす。その場はしのげるが、「何かを隠している」と疑われやすい。',
    kinds: { inpei: 5, uekara: 1 }, good: { p: 0, kind: null },
    react: '「答えになっていない」という空気が流れた',
  },
  honne: {
    name: '本音で話す', short: '本音', risk: 11, score: 64,
    desc: '建前を捨てて本音を語る。受ければ支持が広がるが、党の方針とぶつかったり、偏見や歴史認識の問題になったりする。',
    kinds: { rekishi: 2, sabetsu: 2, miuchi: 2, hisaichi: 1, uekara: 1 }, good: { p: 0.3, kind: 'honne' },
    react: 'ざわめきが起きた。賛否が分かれそうだ',
  },
  gyakugire: {
    name: '逆ギレ', short: '逆ギレ', risk: 32, score: 12,
    desc: '質問した相手に怒りをぶつける。一部の支持者は喜ぶが、たいていは暴言・恫喝として報じられる。',
    kinds: { bougen: 6, uekara: 2 }, good: { p: 0.08, kind: 'yokuitta' },
    react: '場が凍りついた…',
  },
  shazai: {
    name: '謝罪・低姿勢', short: '謝罪', risk: 1, score: 70, only: ['shazai', 'kaiken', 'toben', 'taiwa'],
    desc: '非を認め、深く頭を下げる。炎上は鎮まりやすいが、弱腰と見る人もいる。',
    kinds: { inpei: 1 }, good: { p: 0.2, kind: 'seijitsu' },
    react: '会場は静まりかえった',
  },
};
export const ATTITUDE_ORDER = ['teinei', 'tsuyoki', 'joke', 'hagurakasu', 'honne', 'gyakugire', 'shazai'];
// what the player says (by attitude and topic; {t} = the topic's name). A gaffe replaces it with the reported line.
const SAY = {
  teinei: { def: '「{t}については、事実を一つずつ、ていねいにご説明します」', disaster: '「まず人命と暮らしを守ります。足りないものは、すぐに届けます」', victim: '「お話を聞かせてください。できることを、一つずつやります」', scandal: '「ご心配をおかけしています。事実関係を確かめ、すべてご説明します」', gaffe: '「わたしの発言で、多くの方を傷つけました。心からおわびします」', economy: '「物価と賃金の数字をお示しして、対策をご説明します」' },
  tsuyoki: { def: '「{t}は、必ずやり遂げます。迷いはありません」', disaster: '「国が責任をもって、必ず町を取り戻します」', victim: '「心配はいりません。国がすべてやります」', scandal: '「やましいことは、一切ありません」', gaffe: '「発言の一部だけを切り取られた。真意はちがいます」', opposition: '「ご批判は承知のうえです。結果で示します」' },
  joke: { def: '「{t}ですか。いやあ、むずかしい（笑）。でも、やりますよ」', disaster: '「こういうときこそ、笑顔も大事ですから（笑）」', victim: '「いやあ、大変でしたね。でも、お元気そうで（笑）」', economy: '「財布のひもと同じで、景気もかたいですねえ（笑）」', fame: '「政治の世界は、台本がないのが大変で（笑）」', gaffe: '「わたしの口は、ときどき勝手にしゃべるんです（笑）」' },
  hagurakasu: { def: '「{t}につきましては、さまざまなご意見を踏まえ、適切に対応してまいります」', scandal: '「個別の事柄については、お答えを差し控えます」', disaster: '「状況を精査したうえで、しかるべく判断いたします」', gaffe: '「誤解を招いたとすれば、残念です」' },
  honne: { def: '「正直に言います。{t}は、きれいごとでは片づきません」', disaster: '「正直、元どおりになるには何年もかかる。それでも、やります」', victim: '「正直に言って、国の対応は遅れています。申し訳ない」', scandal: '「『みんなやっている』という空気が、たしかにありました」', economy: '「本当のことを言えば、いずれ負担は増えます」', history: '「これは、わたし個人の考えですが…」', gaffe: '「本心で言ったことです。ただ、言い方は悪かった」' },
  gyakugire: { def: '「{t}？　そんな質問に答える必要がありますか！」', scandal: '「何度も同じことを聞くな！　失礼だろう」', disaster: '「現場は必死なんだ。文句ばかり言うな！」', gaffe: '「いつまでその話をするんですか！」', opposition: '「その質問こそ、時間のむだだ！」' },
  shazai: { def: '「申し訳ありませんでした」（深く頭を下げた）', gaffe: '「軽率な発言でした。撤回し、心からおわびします」（深く頭を下げた）' },
};
// 際どい一言: a bold line, offered now and then. Higher risk, bigger upside.
const RISKY = {
  disaster: { label: '「復興に10年」', line: '「正直に言って、復興には10年はかかる。覚悟してほしい」', risk: 34, kinds: { hisaichi: 3, uekara: 1 }, good: 0.38, goodKind: 'honne' },
  victim: { label: '「がんばって」', line: '「みなさん、がんばってください。ほら、元気を出して」', risk: 30, kinds: { hisaichi: 4, uekara: 1 }, good: 0.22, goodKind: 'kokando' },
  economy: { label: '「前政権のつけ」', line: '「景気が悪いのは、前の政権のつけです」', risk: 28, kinds: { uekara: 2, bougen: 1 }, good: 0.35, goodKind: 'tanomoshii' },
  scandal: { label: '「秘書がやった」', line: '「秘書が、わたしの知らないところでやったことです」', risk: 46, kinds: { inpei: 4, miuchi: 1 }, good: 0.05, goodKind: 'tanomoshii' },
  approval: { label: '「支持率は無視」', line: '「支持率なんて、気にしたことがありません」', risk: 30, kinds: { uekara: 4 }, good: 0.3, goodKind: 'tanomoshii' },
  bill: { label: '「反対は勉強不足」', line: '「反対している人は、勉強が足りないんです」', risk: 48, kinds: { uekara: 5 }, good: 0.28, goodKind: 'tanomoshii' },
  history: { label: '自分の歴史観', line: '（過去の出来事について、政府の公式な見解とちがう自分の考えを語った）', risk: 55, kinds: { rekishi: 5 }, good: 0.18, goodKind: 'honne' },
  fame: { label: '「芸能界は厳しい」', line: '「正直、芸能界のほうが、よっぽど厳しい世界ですよ」', risk: 26, kinds: { uekara: 2, joke: 2 }, good: 0.45, goodKind: 'kokando' },
  message: { label: '「3年で変える」', line: '「わたしに任せてくれれば、3年でこの国を変えてみせます」', risk: 20, kinds: { uekara: 2 }, good: 0.45, goodKind: 'honne' },
  opposition: { label: '「時間のむだ」', line: '「委員、その質問は時間のむだです」', risk: 50, kinds: { uekara: 4, bougen: 2 }, good: 0.25, goodKind: 'tanomoshii' },
  local: { label: '「地元の道は先に」', line: '「この道路は、わたしが責任をもって先に通します」', risk: 40, kinds: { miuchi: 5 }, good: 0.4, goodKind: 'honne' },
  crowd: { label: '「言いなりは辞めろ」', line: '「役所の言いなりの政治家は、ぜんぶ辞めさせます！」', risk: 24, kinds: { bougen: 2, uekara: 1 }, good: 0.5, goodKind: 'honne' },
  gaffe: { label: '「言葉狩りだ」', line: '「これは言葉狩りです。真意をくんでほしい」', risk: 52, kinds: { uekara: 3, bougen: 2 }, good: 0.18, goodKind: 'honne' },
};
export const GOOD_KINDS = {
  seijitsu: { name: '誠実さが伝わった', desc: 'ていねいな説明に「誠実だ」という声' },
  tanomoshii: { name: '「頼もしい」と評判', desc: '言い切る姿に「頼もしい」「決断力がある」の声' },
  kokando: { name: '好感度アップ', desc: '会場が笑いに包まれ、「親しみやすい」と評判に' },
  honne: { name: '本音が受けた', desc: '建前ぬきの言葉が「よくぞ言った」と話題に（党内には苦い顔も）' },
  yokuitta: { name: '「よく言った」の声', desc: '一部の支持者が拍手。ただし眉をひそめる人も多い' },
};
// The categories of gaffes, with invented example lines (quote: shown in 「」; otherwise a description of the remark).
export const GAFFE_KINDS = {
  hisaichi: {
    name: '被災地・被災者への配慮を欠く発言', short: '被災地への配慮を欠く発言', sev: 3, quote: true,
    lines: [{ t: '被災地の視察は、いい気分転換になりますね', v: ['shisatsu', 'kaiken', 'tv', 'sns'] }, { t: '避難所は思ったより快適そうで、安心しました', v: ['shisatsu', 'taiwa', 'kaiken', 'tv', 'sns'] }, '仮設住宅も、住めば都というじゃないですか', 'この程度の被害で済んで、むしろ運がよかった', '復興が遅いのは、地元の段取りが悪いからでしょう', { t: '被災地の名産、いまなら安く買えてお得ですよ', v: ['kaiken', 'tv', 'sns', 'gaito'] }],
  },
  joke: {
    name: '失言（冗談が滑る）', short: '冗談が滑った失言', sev: 1, quote: true,
    lines: ['財源？　宝くじでも当てますか（笑）', '税金は、取りやすいところから取るのがいちばん（笑）', { t: '国会の答弁なんて、寝ていてもできますよ（笑）', v: ['kaiken', 'tv', 'gaito', 'sns'] }, '大臣の椅子は座り心地がいい。辞めたくないなあ（笑）', '公約は、選挙のときの景気づけですから（笑）'],
  },
  sabetsu: {
    name: '差別と受け取られかねない発言', short: '差別と受け取られかねない発言', sev: 3, quote: false,
    lines: ['ある地方の出身者をひとくくりにして、からかう言い方をした', '性別で仕事の向き不向きを決めつける言い方をした', '年齢を理由に、高齢の人を見下すような言い方をした', '障害のある人への配慮を欠くたとえ話をした', '外国から来た人をひとくくりにして、不安をあおる言い方をした'],
  },
  rekishi: {
    name: '歴史認識をめぐる発言', short: '歴史認識をめぐる発言', sev: 3, quote: false,
    lines: ['過去の戦争について、政府の公式な見解とちがう自説を語った', '過去の出来事の被害について「大げさに言われている」と述べた', '近隣の国との歴史問題について、相手の国を軽んじる言い方をした'],
  },
  miuchi: {
    name: '身内びいき', short: '身内びいきの発言', sev: 2, quote: true,
    lines: ['地元の道路は、わたしの顔で先にやってもらいます', '応援してくれた業界には、ちゃんとお返しをしないと', '秘書の息子さんのことは、知り合いの会社に頼んでおきました', 'うちのグループの人を大事なポストに回すのは当然です'],
  },
  uekara: {
    name: '上から目線', short: '上から目線の発言', sev: 2, quote: true,
    lines: ['国民のみなさんには、もう少し勉強してほしい', { t: 'そんなことも知らないで、質問しないでください', v: ['kaiken', 'toben', 'tv', 'shazai'] }, '文句があるなら、選挙で落とせばいい', '庶民の感覚？　わたしにはよくわかりませんね', '細かいことは、役所に聞いてください'],
  },
  bougen: {
    name: '暴言・恫喝', short: '暴言・恫喝', sev: 3, quote: true,
    lines: [{ t: '次にそんな記事を書いたら、ただではおかない', v: ['kaiken', 'tv', 'sns', 'shazai'] }, '黙って座っていろ！', { t: 'あなたの会社の社長に、電話してやろうか', v: ['kaiken', 'tv', 'shazai'] }, 'そんなことを言うなら、予算はつけないぞ', { t: 'そんな質問をする資格があるのか！', v: ['toben', 'kaiken', 'tv', 'shazai'] }],
  },
  inpei: {
    name: '隠蔽を疑わせる答弁', short: '隠蔽を疑わせる答弁', sev: 2, quote: true,
    lines: ['記録は、確認できる範囲では見当たりません', 'その件は、覚えていないとしか言えません', '資料は、すでに廃棄したと聞いています', '個別の案件なので、一切お答えしません'],
  },
  sns: {
    name: 'SNSの炎上', short: 'SNSでの炎上', sev: 2, quote: false,
    lines: ['深夜に、批判してきた人へ強い言葉で言い返す投稿をした', '被災地の写真に、軽い一言をそえて投稿してしまった', '確かめていない情報を、そのまま広めてしまった', '豪華な会食の写真を投稿し、「こんなときに」と批判された'],
  },
};
export const GAFFE_STAGES = [['enjo', '炎上'], ['tekkai', '撤回'], ['shazai', '謝罪会見'], ['tsuikyu', '野党の追及'], ['ketsugi', '問責・不信任'], ['jinin', '辞任・更迭']];
const STAGE_NAME = Object.fromEntries(GAFFE_STAGES);
// NPC politicians' 人柄 (persona): derived from their traits, stored on first use (n.persona)
export const PERSONAS = {
  seijitsu: { name: '誠実', desc: '説明がていねいで、失言は少ない', mult: 0.35, retract: 0, kinds: { inpei: 1 } },
  kenkyo: { name: '謙虚', desc: '腰が低く、言葉を選ぶ', mult: 0.5, retract: 0, kinds: { joke: 1, inpei: 1 } },
  shincho: { name: '慎重', desc: '原稿を読み上げる手堅い答弁。はぐらかしと言われることも', mult: 0.6, retract: 1, kinds: { inpei: 3, uekara: 1 } },
  tsuyoki: { name: '強気', desc: '言い切る。上から目線と言われることも', mult: 1.3, retract: 3, kinds: { uekara: 4, bougen: 2, miuchi: 1 } },
  joke: { name: '冗談好き', desc: '場をなごませたがる。ときどき滑る', mult: 1.4, retract: 1, kinds: { joke: 5, hisaichi: 2, sabetsu: 1 } },
  honne: { name: '本音型', desc: '建前を嫌い、思ったことを口にする', mult: 1.45, retract: 4, kinds: { rekishi: 2, sabetsu: 2, miuchi: 2, uekara: 1 } },
  tanki: { name: '短気', desc: '追及されると声を荒らげる', mult: 1.5, retract: 2, kinds: { bougen: 5, uekara: 2 } },
  snsfan: { name: '発信好き', desc: '自分でSNSに書きこむのが好き', mult: 1.2, retract: 1, kinds: { sns: 5, joke: 1 } },
};
function strHash(s) { let h = 2166136261; for (const ch of String(s || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
function personaOf(n, year = 2026) {
  if (!n) return null;
  if (n.persona && PERSONAS[n.persona]) return n.persona;
  const t = n.traits || {};
  const ch = num(t.charisma, 50), it = num(t.integrity, 60), am = num(t.ambition, 50);
  const h = strHash(n.id || n.name);
  let k;
  if (it >= 82) k = ch < 60 ? 'seijitsu' : 'kenkyo';
  else if (am >= 76 && it < 50) k = 'tanki';
  else if (ch >= 70 && am >= 60) k = 'tsuyoki';
  else if (ch >= 68 && it < 58) k = 'joke';
  else if (it < 46) k = 'honne';
  else if (year >= 2010 && h < 0.18) k = 'snsfan';
  else k = h < 0.5 ? 'shincho' : 'kenkyo';
  n.persona = k;
  return k;
}
// can this NPC be shown in a gaffe? (the real-party rule; civilians from the player's circle neither)
function npcGaffeOK(n) { return !!n && !n.civilian && !(PARTY_DEFS[n.party] && PARTY_DEFS[n.party].real); }

function speechState(p) {
  let S = p.speech;
  if (!S || typeof S !== 'object' || Array.isArray(S)) S = p.speech = {};
  if (!Array.isArray(S.gaffes)) S.gaffes = [];
  if (!Array.isArray(S.log)) S.log = [];
  S.seq = num(S.seq);
  S.lastNpc = num(S.lastNpc, -99);
  if (S.gaffes.length > 40) S.gaffes.splice(0, S.gaffes.length - 40);
  if (S.log.length > 30) S.log.splice(0, S.log.length - 30);
  p.me.media = clamp(num(p.me.media), -100, 100);
  return S;
}
// the speaker's title and side: { name, title, party, kind: 'pm'|'minister'|'member'|'local'|'other', post }
function speakerOf(g, p, who) {
  const fy = fyNow(g);
  if (who === 'player') {
    const me = p.me;
    const post = me.posts.includes('pm') ? 'pm' : me.posts.find((x) => POSTS[x] && POSTS[x].kind === 'cabinet') || null;
    const kind = post === 'pm' ? 'pm' : post ? 'minister' : isNational(me) ? 'member' : me.office ? 'local' : 'other';
    return { who, name: g.state.name, title: playerTitle(g, p), party: me.party, kind, post, national: isNational(me) };
  }
  const n = p.npcs[who];
  if (!n) return { who, name: '', title: '議員', party: null, kind: 'other', post: null };
  const post = p.cabinet.pm === who ? 'pm' : n.posts.find((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && p.cabinet.ministers[x] === who) || null;
  const kind = post === 'pm' ? 'pm' : post ? 'minister' : n.office === 'shugi' || n.office === 'sangi' ? 'member' : n.office ? 'local' : 'other';
  const title = post === 'pm' ? '首相' : post ? postName(post, fy) : n.office === 'shugi' ? '衆院議員' : n.office === 'sangi' ? '参院議員' : '氏';
  return { who, name: n.name, title, party: n.party, kind, post, national: n.office === 'shugi' || n.office === 'sangi' };
}
function fukkoLive(p) { return p.fukko && !p.fukko.ended ? p.fukko : null; }
function isFukkoMinister(p, who) { return !!fukkoLive(p) && p.cabinet.ministers && p.cabinet.ministers.minister_reconstruction === who; }
// the topic a venue talks about when the caller does not say (the hot issue of the day)
function defaultTopic(g, p, venue) {
  const me = p.me;
  const F = fukkoLive(p);
  const mine = speechState(p).gaffes.find((r) => r.who === 'player' && !r.done);
  if (venue === 'shazai') return 'gaffe';
  if (venue === 'taiwa') return 'victim';
  if (mine && (venue === 'kaiken' || venue === 'toben') && Math.random() < 0.7) return 'gaffe';
  if (F && (venue === 'shisatsu' || isFukkoMinister(p, 'player'))) return venue === 'shisatsu' ? 'victim' : 'disaster';
  if (F && Math.random() < 0.5) return 'disaster';
  if (venue === 'toben') return 'opposition';
  if (venue === 'gaito') return 'crowd';
  if ((me.secret > 0 || (me.scandalDay && today(g) - num(me.scandalDay) < 60)) && venue === 'kaiken') return 'scandal';
  if (venue === 'shisatsu') return 'local';
  return pickOne(['economy', 'general', 'approval', 'bill']);
}
function topicName(p, topic) {
  const F = fukkoLive(p);
  if (topic === 'disaster' && F) return `${F.name}への対応`;
  return (SPEECH_TOPICS[topic] || SPEECH_TOPICS.general).name;
}
const QUESTION = {
  kaiken: '「{t}について、お考えを聞かせてください」',
  toben: '「{t}について伺います。政府の答弁は、あまりに不十分ではないですか！」',
  gaito: '（駅前に人が集まってきた。{t}について訴えよう）',
  shisatsu: '（現場の人たちが、こちらの言葉を待っている）',
  tv: '司会「{t}について、ずばり、どうお考えですか？」',
  sns: '（{t}について、なにを投稿しよう？）',
  taiwa: '「家も仕事も、なくなりました。わたしたちは、これからどうなるんですか」',
  shazai: '「問題になった発言について、説明してください」',
};
const QUESTION_TOPIC = {
  scandal: { kaiken: '「政治資金をめぐる報道について、説明してください」', toben: '「政治とカネの問題、国民は納得していませんよ！」' },
  approval: { kaiken: '「最新の世論調査で、支持率が下がっていますが？」' },
  gaffe: { kaiken: '「先日の発言について、撤回するお考えは？」', toben: '「大臣の先日の発言は、資質を疑わせるものです。撤回しますか！」', tv: '司会「例の発言、問題になっていますが…」' },
  opposition: { toben: '「政府の説明は不十分です。いつまでに、何をするのか。はっきり答えてください！」', kaiken: '「野党の批判に、どう答えますか？」', tv: '司会「野党は厳しく批判していますが？」' },
  history: { kaiken: '「歴史の問題について、ご自身の考えは？」', tv: '司会「歴史の問題、個人としてはどうお考えですか？」' },
  fame: { kaiken: '「芸能界の出身として、どんな政治をめざしますか？」', tv: '司会「芸能界から政治の世界へ。正直、どうですか？」' },
  victim: { shisatsu: '（避難所の入り口で、年配の人が話しかけてきた）「いつ家に帰れるんでしょうか…」' },
  disaster: { shisatsu: '（がれきの残る町を歩く。カメラが同行している）', kaiken: '「{t}が遅いという声がありますが？」' },
};
function speechQuestion(g, p, venue, topic) {
  const t = topicName(p, topic);
  const q = (QUESTION_TOPIC[topic] && QUESTION_TOPIC[topic][venue]) || QUESTION[venue] || QUESTION.kaiken;
  return q.replaceAll('{t}', t);
}
function sayLine(p, att, topic) {
  const S = SAY[att] || SAY.teinei;
  return (S[topic] || S.def).replaceAll('{t}', topicName(p, topic));
}
function riskyFor(g, p, venue, topic) {
  const R0 = RISKY[topic];
  if (!R0 || (venue === 'shazai' && topic !== 'gaffe')) return null;
  // offered now and then (stable within a day, so the list does not flicker)
  return strHash(`${today(g)}:${venue}:${topic}`) < 0.55 ? R0 : null;
}
// the risk of a gaffe (%), with the factors that made it
function speechRiskImpl(g, p, who, venue, att, topic, opts = {}) {
  const A = ATTITUDES[att] || ATTITUDES.teinei;
  const V = SPEECH_VENUES[venue] || SPEECH_VENUES.kaiken;
  const T = SPEECH_TOPICS[topic] || SPEECH_TOPICS.general;
  const R0 = opts.risky ? RISKY[topic] : null;
  const st = g.state;
  const f = [];
  let r = R0 ? R0.risk : A.risk;
  f.push({ label: R0 ? '際どい一言' : A.name, v: `${r}%` });
  let m = V.mult;
  if (m !== 1) f.push({ label: venueName(venue, calYear(g)), v: `×${m}` });
  const tm = R0 ? 1 : num(T.mult && T.mult[att], 1);
  if (tm !== 1) { m *= tm; f.push({ label: `話題（${topicName(p, topic)}）`, v: `×${tm}` }); }
  if (who === 'player') {
    const talk = clamp(num(st.skills && st.skills.talk), 0, 100);
    const sm = Math.round((1.25 - (talk / 100) * 0.6) * 100) / 100;
    m *= sm; f.push({ label: `トークの力 ${Math.round(talk)}`, v: `×${sm}` });
    const stress = num(st.life && st.life.stress);
    if (num(st.stamina, 100) < 25) { m *= 1.2; f.push({ label: '疲れている', v: '×1.2' }); }
    if (stress >= 70) { m *= 1.25; f.push({ label: 'ストレスが高い', v: '×1.25' }); }
    const S = speechState(p);
    if (S.gaffes.some((x) => x.who === 'player' && today(g) - x.day < 30)) { m *= 1.3; f.push({ label: '最近の失言で注目されている', v: '×1.3' }); }
    if (num(p.me.media) <= -30) { m *= 1.15; f.push({ label: 'メディアの目が厳しい', v: '×1.15' }); }
  } else {
    const n = p.npcs[who];
    const k = personaOf(n, calYear(g));
    if (k) { m *= PERSONAS[k].mult; f.push({ label: `人柄：${PERSONAS[k].name}`, v: `×${PERSONAS[k].mult}` }); }
  }
  if ((topic === 'disaster' || topic === 'victim') && isFukkoMinister(p, who)) { m *= 1.4; f.push({ label: '復興担当大臣（被災地の注目）', v: '×1.4' }); }
  const risk = clamp(Math.round(r * m), 1, 85);
  return { risk, factors: f };
}
function weighted(obj) {
  const ents = Object.entries(obj || {}).filter(([, w]) => num(w) > 0);
  const tot = ents.reduce((a, [, w]) => a + num(w), 0);
  if (!tot) return null;
  let x = Math.random() * tot;
  for (const [k, w] of ents) { x -= num(w); if (x <= 0) return k; }
  return ents[ents.length - 1][0];
}
// the kind of gaffe: the attitude's (or the line's / persona's) leanings, the venue and the topic
function gaffeKindFor(att, venue, topic, opts = {}) {
  const w = { ...((opts.risky && RISKY[topic] && RISKY[topic].kinds) || (opts.persona && PERSONAS[opts.persona] && PERSONAS[opts.persona].kinds) || (ATTITUDES[att] || ATTITUDES.teinei).kinds) };
  if (opts.persona && ATTITUDES[att]) for (const [k, v] of Object.entries(ATTITUDES[att].kinds)) w[k] = num(w[k]) + v * 0.5;
  // on the disaster, a slip is about the disaster (the 被災地 gaffe); elsewhere there is none of that kind
  if (topic === 'disaster' || topic === 'victim') { w.hisaichi = num(w.hisaichi) * 3 + 6; if (w.joke) w.joke *= 0.3; if (w.sabetsu) w.sabetsu *= 0.5; if (w.rekishi) w.rekishi *= 0.3; }
  else delete w.hisaichi;
  if (topic === 'history') w.rekishi = num(w.rekishi) + 3;
  if (topic === 'scandal') w.inpei = num(w.inpei) + 2;
  if (venue === 'sns') w.sns = num(w.sns) + 4;
  else delete w.sns;
  return weighted(w) || 'uekara';
}
// a line of the kind that fits the venue (an entry is a string, or { t, v: [venues] })
function gaffeLine(kind, venue = null) {
  const L = (GAFFE_KINDS[kind] || GAFFE_KINDS.uekara).lines;
  const fit = L.filter((x) => typeof x === 'string' || !venue || (x.v || []).includes(venue));
  const x = pickOne(fit.length ? fit : L);
  return typeof x === 'string' ? x : x.t;
}
// a kind's name by year (the SNS category was a ブログ's before 2010)
export function gaffeKindName(kind, year = 2026, short = false) {
  const K = GAFFE_KINDS[kind] || GAFFE_KINDS.uekara;
  const n = short ? K.short : K.name;
  return kind === 'sns' && year < 2010 ? n.replace('SNS', 'ブログ') : n;
}
export function gaffeQuote(rec) {
  if (!rec) return '発言';
  const K = GAFFE_KINDS[rec.kind] || GAFFE_KINDS.uekara;
  return K.quote && !rec.desc ? `「${rec.line}」という発言` : `（${rec.line}）`;
}
function shortLine(rec, n = 14) {
  const K = GAFFE_KINDS[rec.kind] || GAFFE_KINDS.uekara;
  if (!K.quote || rec.desc) return gaffeKindName(rec.kind, rec.year || 2026, true);
  const a = Array.from(String(rec.line || ''));
  return `「${a.length > n ? a.slice(0, n).join('') + '…' : a.join('')}」発言`;
}
// a new gaffe record (and its first wave: 炎上)
function startGaffe(g, p, def) {
  const S = speechState(p);
  const day = today(g);
  const sp = speakerOf(g, p, def.who);
  const K = GAFFE_KINDS[def.kind] || GAFFE_KINDS.uekara;
  const F = fukkoLive(p);
  let sev = K.sev + (def.venue === 'tv' || def.venue === 'sns' ? 0.5 : 0) + (sp.kind === 'pm' ? 1 : sp.kind === 'minister' ? 0.5 : 0) + (def.risky ? 0.5 : 0);
  if (def.kind === 'hisaichi' && F) sev += 1;
  if (def.kind === 'hisaichi' && isFukkoMinister(p, def.who)) sev += 0.5;
  sev = clamp(Math.round(sev), 1, 5);
  const fame = def.who === 'player' ? Math.min(10, Math.log10(1 + num(g.state.fame)) * 2.5) : sp.kind === 'pm' ? 10 : sp.kind === 'minister' ? 6 : 2;
  const heat = clamp(Math.round(16 + sev * 11 + (def.venue === 'sns' ? 8 : def.venue === 'tv' ? 5 : 0) + fame + (def.who === 'player' && num(p.me.media) <= -30 ? 6 : 0)), 12, 95);
  const year = calYear(g);
  const kShort = gaffeKindName(def.kind, year, true);
  const rec = {
    year, id: 'gf' + (S.seq = S.seq + 1), who: def.who, name: sp.name, title: sp.title, party: sp.party, kind: def.kind, line: def.line || gaffeLine(def.kind, def.venue),
    desc: !K.quote, venue: def.venue, topic: def.topic || 'general', day, sev, heat, peak: heat, stage: 'enjo', steps: { enjo: day }, retracted: 0, apologies: 0,
    refused: 0, motion: null, done: false, end: null, outcome: null, log: [{ day, text: `${venueName(def.venue, year)}での${kShort}が報じられ、批判が広がった（炎上）` }], lastNews: day, fukko: !!(F && isFukkoMinister(p, def.who)),
  };
  if (def.line && K.quote === false) rec.desc = true;
  S.gaffes.push(rec);
  if (S.gaffes.length > 40) S.gaffes.splice(0, S.gaffes.length - 40);
  // the party in the headline only for a fictional party (the real parties stay out of the gaffe news)
  const pt = sp.party && p.parties[sp.party] && !(PARTY_DEFS[sp.party] && PARTY_DEFS[sp.party].real) && !p.parties[sp.party].real ? `（${pname(p, sp.party)}）` : '';
  const vn = venueName(def.venue, calYear(g));
  const head = K.quote && !rec.desc ? `【失言】${sp.name}${sp.title}${pt}、${vn}で「${rec.line}」。批判が広がる` : `【失言】${sp.name}${sp.title}${pt}が${vn}で${rec.line}として批判を浴びる`;
  news(p, g, head);
  if (def.who === 'player') {
    const me = p.me;
    me.reputation = clamp(me.reputation - sev * 2.5, -100, 100);
    me.media = clamp(num(me.media) - sev * 4, -100, 100);
    if (me.party) me.standing = clamp(me.standing - sev * 1.5, 0, 100);
    if (me.party && p.parties[me.party]) addSupportAll(p, me.party, -0.0015 * sev);
    me.scandalDay = day;
    approvalHit(g, p, sp.kind === 'pm' ? sev * 2.2 : sp.kind === 'minister' ? sev * 1.0 : me.party && isRuling(p, me.party) ? sev * 0.3 : 0, '失言');
    const fans = num(g.state.fans);
    if (fans > 0 && g.addFans) g.addFans(-Math.round(fans * 0.006 * sev), true);
    if (g.addFame) g.addFame(sev * 5, true);
    phoneNews(g, `【失言】${g.state.name}${sp.title}の${venueName(def.venue, year)}での${K.quote && !rec.desc ? `「${rec.line}」という発言` : kShort}に、批判が集まっています。\n撤回や謝罪をするか、早めに決めたほうがいい。`, def.venue === 'sns' ? 'ドット新聞 デジタル版' : 'ドット新聞 政治部');
  } else {
    const n = p.npcs[def.who];
    if (n && n.party && p.parties[n.party]) addSupportAll(p, n.party, -0.001 * sev);
    if (sp.kind === 'minister' || sp.kind === 'pm') approvalHit(g, p, sp.kind === 'pm' ? sev * 1.6 : sev * 0.7, '閣僚の失言');
    S.lastNpc = day;
  }
  emit(g, 'scandal', { kind: 'gaffe', name: K.name, who: def.who, severity: sev, day, gaffe: rec.id });
  return rec;
}
// the cabinet's approval: a gaffe (scandal part) / a good word (mood part), labelled for govt.js's breakdown
function approvalHit(g, p, amount, text) {
  if (!amount) return;
  p.cabinet.scandal = num(p.cabinet.scandal) - amount;
  if (typeof g.approvalNote === 'function') { try { g.approvalNote('scandal', -Math.round(amount * 10) / 10, text, { applied: true }); } catch (e) { console.error(e); } }
}
function approvalLift(g, p, amount, text, reason = 'policy') {
  if (!amount) return;
  p.cabinet.mood = clamp(num(p.cabinet.mood) + amount, -20, 20);
  if (typeof g.approvalNote === 'function') { try { g.approvalNote(reason, Math.round(amount * 10) / 10, text, { applied: true }); } catch (e) { console.error(e); } }
}
function speechBlockImpl(g, p, venue) {
  const V = SPEECH_VENUES[venue];
  if (!V) return 'そんな場面はない';
  if (V.from && calYear(g) < V.from) return 'この時代は、政治家が自分で発信するブログやSNSがまだない';
  if (venue === 'toben' && !inCabinet(p.me)) return '答弁に立つのは、総理・大臣（内閣の側）';
  if (venue === 'toben' && !inSession(p, today(g))) return '国会の会期中だけ';
  return null;
}
// the options of a moment: the attitudes that fit the venue (+ a 際どい一言 now and then), each with its risk
function speechOptionsImpl(g, p, venue, opts = {}) {
  const topic = SPEECH_TOPICS[opts.topic] ? opts.topic : defaultTopic(g, p, venue);
  const out = [];
  for (const id of ATTITUDE_ORDER) {
    const A = ATTITUDES[id];
    if (A.only && !A.only.includes(venue) && !(topic === 'gaffe')) continue;
    const rk = speechRiskImpl(g, p, 'player', venue, id, topic);
    out.push({ id, name: A.name, label: `${A.name}　${rk.risk}%`, risk: rk.risk, factors: rk.factors, desc: A.desc, kinds: Object.keys(A.kinds).map((k) => gaffeKindName(k, calYear(g), true)), good: A.good.kind ? GOOD_KINDS[A.good.kind].name : null, line: sayLine(p, id, topic) });
  }
  const R0 = opts.risky === false ? null : riskyFor(g, p, venue, topic);
  if (R0) {
    const rk = speechRiskImpl(g, p, 'player', venue, 'honne', topic, { risky: true });
    out.push({ id: 'risky', risky: true, name: `際どい一言：${R0.label}`, label: `際どい一言　${rk.risk}%`, risk: rk.risk, factors: rk.factors, desc: `${R0.line}\n受ければ大きいが、外れれば大きな失言になる。`, kinds: Object.keys(R0.kinds).map((k) => gaffeKindName(k, calYear(g), true)), good: GOOD_KINDS[R0.goodKind].name, line: R0.line });
  }
  return { venue, venueName: venueName(venue, calYear(g)), topic, topicName: (SPEECH_TOPICS[topic] || {}).label || topicName(p, topic), question: speechQuestion(g, p, venue, topic), asker: (SPEECH_VENUES[venue] || {}).who || '記者', options: out, block: speechBlockImpl(g, p, venue) };
}
// Say it. -> { ok, why?, venue, topic, attitude, risky, risk, outcome: 'gaffe'|'good'|'neutral', line, reaction,
//   gaffe (record) | null, good { kind, name, desc } | null, effects [text], score 0..100 }
function speakImpl(g, p, venue, opts = {}) {
  const S = speechState(p);
  const V = SPEECH_VENUES[venue];
  if (!V) return { ok: false, why: 'そんな場面はない' };
  if (V.from && calYear(g) < V.from) return { ok: false, why: speechBlockImpl(g, p, venue) };
  const topic = SPEECH_TOPICS[opts.topic] ? opts.topic : defaultTopic(g, p, venue);
  const risky = opts.attitude === 'risky' || !!opts.risky;
  const R0 = risky ? RISKY[topic] : null;
  const att = risky ? 'honne' : ATTITUDES[opts.attitude] ? opts.attitude : 'teinei';
  const A = ATTITUDES[att];
  const st = g.state;
  const me = p.me;
  const day = today(g);
  const rk = speechRiskImpl(g, p, 'player', venue, att, topic, { risky: !!R0 });
  const talk = clamp(num(st.skills && st.skills.talk), 0, 100);
  const effects = [];
  const res = { ok: true, venue, venueName: venueName(venue, calYear(g)), topic, topicName: topicName(p, topic), attitude: R0 ? 'risky' : att, attName: R0 ? `際どい一言（${R0.label}）` : A.name, risky: !!R0, risk: rk.risk, outcome: 'neutral', line: R0 ? R0.line : sayLine(p, att, topic), reaction: A.react, gaffe: null, good: null, effects, score: 0 };
  const sp = speakerOf(g, p, 'player');
  const inCab = sp.kind === 'pm' || sp.kind === 'minister';
  if (Math.random() * 100 < rk.risk && !opts.noGaffe) {
    const kind = gaffeKindFor(att, venue, topic, { risky: !!R0 });
    const line = R0 && Math.random() < 0.5 ? R0.line.replace(/^[「（]|[」）]$/g, '') : gaffeLine(kind, venue);
    const rec = opts.escalate ? escalateGaffe(g, p, opts.escalate, { venue, kind, line }) : startGaffe(g, p, { who: 'player', kind, line, venue, topic, risky: !!R0 });
    res.outcome = 'gaffe';
    res.gaffe = rec;
    res.line = GAFFE_KINDS[kind].quote && !rec.desc ? `「${line}」` : `（${line}）`;
    res.reaction = opts.escalate ? '会見の場で、また問題の発言…。批判はさらに強まった' : `${gaffeKindName(kind, calYear(g))}として、すぐに報じられた（炎上）`;
    effects.push('評判・メディアの評価が下がった', me.party ? '党内の評価が下がった' : null, inCab ? '内閣の支持率に響く' : null);
  } else {
    const gp = R0 ? R0.good : num(A.good.p) * (1 + talk / 200) * ((att === 'honne' && (venue === 'gaito' || venue === 'tv')) || (att === 'teinei' && (venue === 'taiwa' || venue === 'shazai')) || (att === 'joke' && venue === 'tv') ? 1.25 : 1);
    const gk = R0 ? R0.goodKind : A.good.kind;
    if (gk && Math.random() < gp) {
      res.outcome = 'good';
      res.good = { kind: gk, ...GOOD_KINDS[gk] };
      res.reaction = GOOD_KINDS[gk].desc;
      goodEffects(g, p, gk, effects, { big: !!R0, inCab, venue });
    } else neutralEffects(g, p, att, effects);
  }
  res.effects = effects.filter(Boolean);
  res.topicName = (SPEECH_TOPICS[topic] || {}).label || res.topicName;
  res.score = clamp(Math.round((R0 ? 60 : A.score) + (res.outcome === 'good' ? 18 : res.outcome === 'gaffe' ? -45 : 0) + talk / 10), 0, 100);
  S.log.push({ day, venue, topic, att: res.attitude, outcome: res.outcome, risk: rk.risk });
  if (S.log.length > 30) S.log.splice(0, S.log.length - 30);
  return res;
}
function goodEffects(g, p, gk, out, o = {}) {
  const me = p.me;
  const st = g.state;
  const k = o.big ? 1.6 : 1;
  const fans = num(st.fans);
  const addFans = (n) => { if (g.addFans) g.addFans(Math.round(n), true); };
  if (gk === 'seijitsu') { me.reputation = clamp(me.reputation + 2.5 * k, -100, 100); me.media = clamp(num(me.media) + 3 * k, -100, 100); if (o.inCab) approvalLift(g, p, 0.6 * k, '誠実な説明'); out.push('評判 +', 'メディアの評価 +', o.inCab ? '内閣の支持率に追い風' : null); }
  else if (gk === 'tanomoshii') { if (me.party) me.standing = clamp(me.standing + 1.5 * k, 0, 100); if (g.addFame) g.addFame(6 * k, true); if (o.inCab) approvalLift(g, p, 0.5 * k, '頼もしい発言'); out.push(me.party ? '党内の評価 +' : null, '知名度 +', o.inCab ? '内閣の支持率に追い風' : null); }
  else if (gk === 'kokando') { addFans((50 + fans * 0.004) * k); if (g.addFame) g.addFame(10 * k, true); me.media = clamp(num(me.media) + 2 * k, -100, 100); out.push('ファン +', '知名度 +', '好感度アップ'); }
  else if (gk === 'honne') { addFans((100 + fans * 0.008) * k); if (g.addFame) g.addFame(20 * k, true); if (me.party && p.parties[me.party]) addSupport(p, 'floating', me.party, 0.002 * k); if (me.party) me.standing = clamp(me.standing - 1.5, 0, 100); me.media = clamp(num(me.media) + 1, -100, 100); out.push('ファン ++', '知名度 ++', '無党派の支持 +', me.party ? '党内には苦い顔（党内の評価 −）' : null); }
  else if (gk === 'yokuitta') { addFans(40 + fans * 0.003); if (me.party) me.standing = clamp(me.standing - 2, 0, 100); me.media = clamp(num(me.media) - 3, -100, 100); out.push('一部のファン +', 'メディアの評価 −'); }
}
function neutralEffects(g, p, att, out) {
  const me = p.me;
  if (att === 'teinei') { me.reputation = clamp(me.reputation + 0.5, -100, 100); out.push('無難にこなした'); }
  else if (att === 'tsuyoki') { if (me.party) me.standing = clamp(me.standing + 0.3, 0, 100); out.push('強い印象を残した'); }
  else if (att === 'joke') { if (g.addFans) g.addFans(10, true); out.push('場が少しなごんだ'); }
  else if (att === 'hagurakasu') { me.media = clamp(num(me.media) - 1, -100, 100); me.reputation = clamp(me.reputation - 0.3, -100, 100); out.push('「はぐらかした」と書かれた（メディアの評価 −）'); }
  else if (att === 'honne') out.push('賛否が分かれた');
  else if (att === 'gyakugire') { me.media = clamp(num(me.media) - 4, -100, 100); me.reputation = clamp(me.reputation - 1, -100, 100); out.push('記者たちの心証は最悪だ（メディアの評価 −）'); }
  else if (att === 'shazai') { me.media = clamp(num(me.media) + 1, -100, 100); out.push('低姿勢がまずは受け止められた'); }
}
// a second blunder in the same affair (e.g. at the 謝罪会見): the record heats up instead of a new one
function escalateGaffe(g, p, rec, o = {}) {
  const day = today(g);
  rec.heat = clamp(rec.heat + 22, 0, 100);
  rec.peak = Math.max(num(rec.peak), rec.heat);
  rec.sev = Math.min(5, rec.sev + 1);
  rec.again = (rec.again || 0) + 1;
  rec.log.push({ day, text: `${venueName(o.venue || 'shazai', calYear(g))}でまた問題の発言（${o.line || ''}）。批判がさらに強まった` });
  const sp = speakerOf(g, p, rec.who);
  news(p, g, `${sp.name}${sp.title}、${venueName(o.venue || 'shazai', calYear(g))}でも問題発言。批判がさらに強まる`);
  rec.lastNews = day;
  if (rec.who === 'player') {
    p.me.media = clamp(num(p.me.media) - 6, -100, 100);
    p.me.reputation = clamp(p.me.reputation - 4, -100, 100);
    approvalHit(g, p, sp.kind === 'pm' ? 3 : sp.kind === 'minister' ? 1.5 : 0, '失言の上塗り');
  }
  return rec;
}
function setStage(rec, stage, day, text) {
  if (!rec.steps[stage]) rec.steps[stage] = day;
  rec.stage = stage;
  if (text) rec.log.push({ day, text });
}
// the player's answer to their own gaffe
function gaffeOptionsImpl(g, p, rec) {
  if (!rec) return [];
  const done = rec.done ? 'この件は、もう終わった' : null;
  const sp = speakerOf(g, p, 'player');
  const day = today(g);
  const post = sp.kind === 'pm' ? 'pm' : sp.post;
  const partyPost = p.me.posts.find((x) => POSTS[x] && POSTS[x].kind === 'party');
  return [
    { id: 'tekkai', name: '発言を撤回する', desc: '「撤回します」と表明する。火は小さくなるが、言ったことが消えるわけではない。', why: done || (rec.retracted ? 'もう撤回した' : null) },
    { id: 'shazai', name: '謝罪会見を開く', speech: true, desc: '会見を開いておわびする。態度しだいで鎮火にも、火に油にもなる（態度を選ぶ）。', why: done || (num(rec.lastKaiken, -9) >= day - 1 ? '会見は、きのう・きょう開いたばかり' : null) },
    { id: 'setsumei', name: '真意を説明する（釈明）', speech: true, desc: '「そういう意味ではなかった」と説明する。うまくいけば鎮まるが、言いわけに聞こえることも。', why: done || (num(rec.lastExplain, -9) === day ? '今日はもう説明した' : null) },
    { id: 'hirakinaori', name: '撤回しない（開き直る）', desc: '「撤回しない」と言い切る。本音だと喜ぶ支持者もいるが、批判はふつう強まる。', why: done || (rec.retracted ? '撤回したあとで開き直ることはできない' : rec.refused ? 'すでに「撤回しない」と言った' : null) },
    { id: 'jinin', name: post === 'pm' ? '責任をとって総辞職する' : post ? `${postName(post, fyNow(g))}を辞任する` : partyPost ? '党の役職を辞める' : '辞める役職はない', desc: post === 'pm' ? '内閣総辞職して、総理をやめる。国会で次の総理が選ばれる。' : post ? '大臣を辞めて、けじめをつける。内閣への打撃は小さくなる。' : partyPost ? '党の役職を退いて、けじめをつける。' : '議員を辞める（議員辞職）なら、「政治」→資金・活動→進退から。', why: done || (!post && !partyPost ? 'いまは辞める役職がない（議員辞職は「進退」から）' : post === 'pm' && p.cabinet.resigned ? 'すでに総辞職を決めている' : null), danger: true },
  ];
}
function gaffeRespondImpl(g, p, id, kind, opts = {}) {
  const S = speechState(p);
  const rec = S.gaffes.find((r) => r.id === id && r.who === 'player') || (id == null ? S.gaffes.slice().reverse().find((r) => r.who === 'player' && !r.done) : null);
  if (!rec) return { ok: false, why: 'その発言の記録がない' };
  const o = gaffeOptionsImpl(g, p, rec).find((x) => x.id === kind);
  if (!o) return { ok: false, why: 'そんな対応はない' };
  if (o.why) return { ok: false, why: o.why };
  const me = p.me;
  const day = today(g);
  const sp = speakerOf(g, p, 'player');
  const st = g.state;
  const out = { ok: true, kind, id: rec.id, text: '', speech: null };
  if (kind === 'tekkai') {
    rec.retracted = day;
    rec.heat = clamp(rec.heat - (12 + rec.sev * 2), 0, 100);
    if (me.party) me.standing = clamp(me.standing + 1, 0, 100);
    me.media = clamp(num(me.media) + 2, -100, 100);
    setStage(rec, 'tekkai', day, '発言を撤回した');
    news(p, g, `${sp.name}${sp.title}が${shortLine(rec)}を撤回`);
    rec.lastNews = day;
    out.text = '「先ほどの発言は撤回いたします」と表明した。\n火は少し小さくなった。…言ったことが消えるわけではないが。';
  } else if (kind === 'hirakinaori') {
    rec.refused = day;
    const K = GAFFE_KINDS[rec.kind];
    const hard = rec.kind === 'hisaichi' || rec.kind === 'sabetsu' || rec.kind === 'rekishi' || rec.kind === 'bougen';
    rec.heat = clamp(rec.heat + (hard ? 24 : 9) + rec.sev * 2, 0, 100);
    rec.peak = Math.max(num(rec.peak), rec.heat);
    me.media = clamp(num(me.media) - 5, -100, 100);
    if (me.party) me.standing = clamp(me.standing - 3, 0, 100);
    rec.log.push({ day, text: '「撤回しない」と言い切った' });
    news(p, g, `${sp.name}${sp.title}、${shortLine(rec)}について「撤回しない」`);
    rec.lastNews = day;
    // a plain-speaking line can win the core supporters (never for the hard categories)
    if (!hard && Math.random() < 0.3) {
      if (g.addFans) g.addFans(Math.round(60 + num(st.fans) * 0.005), true);
      out.text = '「撤回はしません。本心です」と言い切った。\n一部の支持者からは「ぶれない」と拍手。批判はさらに強まった。';
      out.good = { kind: 'honne', ...GOOD_KINDS.honne };
    } else out.text = `「撤回はしません」と言い切った。\n${K.name}への批判は、さらに強まった…。`;
  } else if (kind === 'shazai' || kind === 'setsumei') {
    const venue = kind === 'shazai' ? 'shazai' : 'kaiken';
    const att = opts.attitude || 'teinei';
    const r = speakImpl(g, p, venue, { topic: 'gaffe', attitude: att, escalate: rec });
    out.speech = r;
    if (kind === 'shazai') { rec.lastKaiken = day; rec.apologies++; setStage(rec, 'shazai', day, null); } else rec.lastExplain = day;
    if (r.outcome !== 'gaffe') {
      const A = r.attitude;
      const cool = kind === 'shazai'
        ? { teinei: 26, shazai: 30, hagurakasu: 8, tsuyoki: -10, joke: -14, honne: 12, gyakugire: -28, risky: -6 }[A]
        : { teinei: 10, shazai: 12, hagurakasu: 2, tsuyoki: -6, joke: -10, honne: 6, gyakugire: -20, risky: -4 }[A];
      const d = num(cool) + (r.outcome === 'good' ? 10 : 0);
      rec.heat = clamp(rec.heat - d, 0, 100);
      rec.peak = Math.max(num(rec.peak), rec.heat);
      if (A === 'hagurakasu') rec.inpei = (rec.inpei || 0) + 1;
      rec.log.push({ day, text: `${kind === 'shazai' ? '謝罪会見' : '釈明'}（${r.attName}）：${d >= 20 ? '批判はかなり鎮まった' : d > 0 ? '少し鎮まった' : '火に油を注いだ'}` });
      news(p, g, kind === 'shazai' ? `${sp.name}${sp.title}が会見で謝罪${d >= 20 ? '。「反省している」' : d > 0 ? '' : '。態度に批判も'}` : `${sp.name}${sp.title}、発言の真意を説明${d > 0 ? '' : '。「言いわけだ」との声'}`);
      rec.lastNews = day;
      out.text = `${r.line}\n${d >= 20 ? '会場の空気が少しやわらいだ。批判はかなり鎮まった。' : d > 0 ? '批判は少しだけ鎮まった。' : d === 0 ? '空気は変わらなかった。' : '…かえって火に油を注いでしまった。'}`;
      if (kind === 'shazai' && d >= 20) { me.media = clamp(num(me.media) + 2, -100, 100); }
    } else out.text = `${r.line}\n${r.reaction}`;
  } else if (kind === 'jinin') {
    const post = sp.kind === 'pm' ? 'pm' : sp.post;
    if (post === 'pm') { setStage(rec, 'jinin', day, '責任をとって総辞職を表明'); finishGaffe(g, p, rec, 'jinin'); resignCabinet(g, p, '総理の失言の責任をとって'); out.text = '「発言の責任をとり、内閣総辞職を決断しました」\n…国会で、次の総理が選ばれる。'; }
    else if (post) { setStage(rec, 'jinin', day, `${postName(post, fyNow(g))}を辞任`); finishGaffe(g, p, rec, 'jinin'); resignPostImpl(g, p, post, '失言の責任をとって'); approvalLift(g, p, 1.5, '問題の大臣の辞任（けじめ）', 'scandal'); out.text = `「発言の責任をとって、${postName(post, fyNow(g))}を辞任します」\n内閣への打撃は、これ以上広がらずにすみそうだ。`; }
    else {
      const pp = me.posts.find((x) => POSTS[x] && POSTS[x].kind === 'party');
      const pt = p.parties[me.party];
      me.posts = me.posts.filter((x) => x !== pp);
      if (pt && pt.posts && pt.posts[pp] === 'player') { const n = newNpc(p, { party: pt.id, office: 'shugi', house: 'shugi', wins: irnd(4, 10) }); n.posts.push(pp); pt.posts[pp] = n.id; }
      setStage(rec, 'jinin', day, `党の${postName(pp, fyNow(g), me.party)}を辞任`);
      finishGaffe(g, p, rec, 'jinin');
      news(p, g, `${sp.name}氏が失言の責任をとって党の${postName(pp, fyNow(g), me.party)}を辞任`);
      out.text = `発言の責任をとって、党の${postName(pp, fyNow(g), me.party)}を辞めた。`;
    }
  }
  return out;
}
function finishGaffe(g, p, rec, outcome) {
  rec.done = true;
  rec.end = today(g);
  rec.outcome = outcome;
  if (outcome === 'chinka') rec.log.push({ day: today(g), text: '批判は収まった（沈静化）' });
}
// the 問責決議案 (参院) on a minister / the PM: it passes when the opposition holds the 参院 (ねじれ). Not legally binding.
function censureVote(g, p, rec) {
  const H = p.diet.sangi;
  const ids = p.cabinet.partyIds || [];
  const ruling = ids.reduce((a, id) => a + num(H.seats[id]), 0);
  const total = num(H.total) || 1;
  const opp = total - ruling;
  const absent = Math.round(total * 0.03);
  const yes = Math.round(opp * 0.95 + (rec.heat >= 85 ? ruling * 0.03 : 0));
  const no = Math.max(0, total - absent - yes);
  return { house: 'sangi', kind: '問責決議案', yes, no, passed: yes > no, day: today(g) };
}
// the daily step of every live gaffe (player and NPC), and the NPCs' new gaffes
function speechTick(g, p, day) {
  const S = speechState(p);
  const me = p.me;
  if (me.media > 0) me.media = Math.max(0, me.media - 0.15); else if (me.media < 0) me.media = Math.min(0, me.media + 0.15);
  const session = inSession(p, day);
  for (const rec of S.gaffes) {
    if (rec.done || rec.day >= day) continue;
    const days = day - rec.day;
    const sp = speakerOf(g, p, rec.who);
    const isP = rec.who === 'player';
    // a minister / PM who left the post since: the chain loses its target (still reported as a 議員)
    rec.heat = clamp(rec.heat - (3 + (rec.retracted ? 3 : 0) + Math.min(2, rec.apologies) * 3), 0, 100);
    const canNews = rec.lastNews !== day;
    const say = (text) => { if (canNews) { news(p, g, text); rec.lastNews = day; } };
    // NPC: retract / apologise by persona
    if (!isP) {
      const n = p.npcs[rec.who];
      const pk = personaOf(n, calYear(g)) || 'kenkyo';
      const P0 = PERSONAS[pk];
      if (!n) { finishGaffe(g, p, rec, 'chinka'); continue; }
      if (!rec.retracted && days >= 1 + P0.retract && rec.heat >= 20 && canNews) { rec.retracted = day; rec.heat = clamp(rec.heat - 12, 0, 100); setStage(rec, 'tekkai', day, '発言を撤回'); say(`${sp.name}${sp.title}が${shortLine(rec)}を撤回`); continue; }
      if (rec.retracted && !rec.apologies && rec.heat >= 40 && day - rec.retracted >= 1 && rec.lastNews !== day) { rec.apologies = 1; rec.heat = clamp(rec.heat - 15, 0, 100); setStage(rec, 'shazai', day, '記者会見で謝罪'); say(`${sp.name}${sp.title}が会見で謝罪「不適切な発言だった」`); continue; }
    } else if (!rec.retracted && !rec.refused && days === 1 && rec.heat >= 30 && me.party) {
      note(g, '（党の幹部から電話があった。「あの発言、早く撤回したほうがいい」）');
    } else if (!rec.retracted && days >= 2 && me.party) me.standing = clamp(me.standing - 0.8, 0, 100);
    // 野党の追及 (the Diet in session; ministers, the PM, and a member whose remark is loud)
    if (session && sp.national && (sp.kind === 'pm' || sp.kind === 'minister' || rec.heat >= 50) && rec.heat >= 30 && !rec.steps.tsuikyu && rec.lastNews !== day) {
      setStage(rec, 'tsuikyu', day, '野党が国会で追及');
      rec.heat = clamp(rec.heat + 6, 0, 100);
      say(`野党が${sp.name}${sp.title}の${shortLine(rec)}を国会で追及。「資質を欠く」`);
      if (isP) { note(g, `（国会で、野党が${gaffeKindName(rec.kind, rec.year)}を追及している。答弁でどう答えるかが問われる）`); approvalHit(g, p, sp.kind === 'pm' ? 1.5 : sp.kind === 'minister' ? 0.6 : 0, '失言への追及'); }
      continue;
    }
    if (session && rec.steps.tsuikyu && rec.heat >= 30 && !rec.apologies) rec.heat = clamp(rec.heat + 2, 0, 100);
    // 問責決議案 (参院) on a minister / the PM; 内閣不信任決議案 (衆院) on the PM
    if (session && (sp.kind === 'minister' || sp.kind === 'pm') && rec.steps.tsuikyu && rec.heat >= 55 && days >= 3 && !rec.motion && rec.lastNews !== day) {
      const v = censureVote(g, p, rec);
      rec.motion = v;
      setStage(rec, 'ketsugi', day, `参院で問責決議案：${v.passed ? '可決' : '否決'}（賛成${v.yes}・反対${v.no}）`);
      rec.heat = clamp(rec.heat + (v.passed ? 10 : -6), 0, 100);
      say(`参院で${sp.name}${sp.title}の問責決議案を${v.passed ? '可決' : '否決'}（賛成${v.yes}・反対${v.no}）${v.passed ? '。法的な拘束力はないが、辞任を求める声が強まる' : ''}`);
      if (isP) note(g, v.passed ? '（参議院で、あなたへの問責決議が可決された。法的な拘束力はないが、進退を問う声が強まっている）' : '（参議院で、あなたへの問責決議案は否決された）');
      if (sp.kind === 'pm' && v.passed) {
        const oppSeats = Object.keys(p.parties).filter((pid) => !isRuling(p, pid)).reduce((a, pid) => a + num(p.diet.shugi.seats[pid]), 0);
        const S3 = p.diet.session;
        const opp = Object.keys(p.parties).filter((pid) => !isRuling(p, pid) && num(p.diet.shugi.seats[pid]) > 0 && !p.parties[pid].isPlayers).sort((a, b) => p.diet.shugi.seats[b] - p.diet.shugi.seats[a])[0];
        if (opp && oppSeats >= 50 && S3 && !p.cabinet.resigned && !p.diet.bills.some((b) => b.kind === 'noconfidence' && b.created >= S3.start)) {
          addBill(p, { title: '内閣不信任決議案', policy: null, sponsor: 'member', by: p.parties[opp].leader, party: opp, kind: 'noconfidence', stage: 'shugi', house: 'shugi', day, delay: 1 });
          rec.log.push({ day, text: '野党が内閣不信任決議案を提出（総理の失言を理由に）' });
        }
      }
      continue;
    }
    // 辞任・更迭
    if (sp.kind === 'minister' && rec.lastNews !== day) {
      const passed = rec.motion && rec.motion.passed;
      if (!isP && (rec.heat >= 62 || (passed && rec.heat >= 45)) && Math.random() < 0.5) {
        const n = p.npcs[rec.who];
        const post = sp.post;
        const koutetsu = Math.random() < 0.4;
        setStage(rec, 'jinin', day, koutetsu ? '総理が更迭' : '責任をとって辞任');
        finishGaffe(g, p, rec, koutetsu ? 'koutetsu' : 'jinin');
        const m = replaceNpcMinister(g, p, n, post);
        say(koutetsu ? `${pmLabel(g, p)}が${sp.name}${sp.title}を更迭。後任に${m ? m.name : '別の議員'}氏` : `${sp.name}${sp.title}が失言の責任をとって辞任。後任に${m ? m.name : '別の議員'}氏`);
        approvalLift(g, p, 1, '問題の大臣の交代', 'scandal');
        continue;
      }
      if (isP && p.cabinet.pm !== 'player') {
        // the PM lets a minister go when the storm does not pass (or the 参院 has censured them)
        if ((rec.heat >= 72 && days >= 3) || (passed && rec.heat >= 52) || (rec.warned && day - rec.warned >= 6 && rec.heat >= 48 && Math.random() < 0.3)) {
          const post = sp.post;
          setStage(rec, 'jinin', day, '総理が更迭（罷免）');
          finishGaffe(g, p, rec, 'koutetsu');
          resignPostImpl(g, p, post, '更迭（失言）');
          note(g, `（総理から呼び出された。「…すまないが、${postName(post, fyNow(g))}を辞めてもらう」。更迭された）`);
          news(p, g, `${pmLabel(g, p)}が${g.state.name}${postName(post, fyNow(g))}を更迭（失言）`);
          rec.lastNews = day;
          approvalLift(g, p, 1, '問題の大臣の交代', 'scandal');
          continue;
        }
        if (rec.heat >= 55 && !rec.warned) { rec.warned = day; note(g, '（官邸から連絡があった。「総理は、あなたの進退について考えておられる」…辞任するなら「政治」→内閣→発言と失言）'); }
      }
    }
    // a member (not in the cabinet): the party's warning
    if (isP && sp.kind !== 'pm' && sp.kind !== 'minister' && me.party && rec.heat >= 65 && !rec.partyWarn) {
      rec.partyWarn = day;
      me.standing = clamp(me.standing - 8, 0, 100);
      note(g, `（${pname(p, me.party)}から厳重注意を受けた。党内の評価が下がった）`);
      rec.log.push({ day, text: '党から厳重注意' });
    }
    if (isP && sp.kind === 'pm' && rec.heat >= 70 && !rec.pmWarn) { rec.pmWarn = day; note(g, '（与党の中から「総理は説明責任を果たすべきだ」という声が出ている）'); }
    // it dies down
    if (rec.heat <= 10 || days >= 45) {
      finishGaffe(g, p, rec, 'chinka');
      if (isP) note(g, `（${gaffeKindName(rec.kind, rec.year, true)}をめぐる騒ぎは、ようやく収まった）`);
    }
  }
  npcGaffeTick(g, p, day, S);
}
function pmLabel(g, p) {
  const pm = p.cabinet.pm;
  if (pm === 'player') return `${g.state.name}総理`;
  const n = p.npcs[pm];
  return n ? `${n.name.split(' ')[0]}総理` : '総理';
}
// an NPC minister leaves the post (gaffe): a successor from the same party
function replaceNpcMinister(g, p, n, post) {
  if (!n || !post) return null;
  n.posts = n.posts.filter((x) => x !== post);
  const m = pickMinister(p, n.party && (p.cabinet.partyIds || []).includes(n.party) ? n.party : cabinetPartyOfPM(p) || (p.cabinet.partyIds || [])[0], p.cabinet.ministers);
  m.posts.push(post);
  p.cabinet.ministers[post] = m.id;
  return m;
}
// NPC gaffes: one live chain at a time, at least 9 days apart (about 2-3 in 60 days), fictional-party NPCs only
function npcGaffeTick(g, p, day, S) {
  if (day - num(S.lastNpc, -99) < 9) return;
  if (S.gaffes.some((r) => r.who !== 'player' && !r.done && day - r.day < 6)) return;
  if (Math.random() > 1 / 16) return;
  const year = calYear(g);
  const F = fukkoLive(p);
  const pool = [];
  for (const n of Object.values(p.npcs)) {
    if (!npcGaffeOK(n)) continue;
    const mins = n.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && p.cabinet.ministers[x] === n.id);
    const pm = p.cabinet.pm === n.id;
    const leader = Object.values(p.parties).some((pt) => pt.leader === n.id);
    if (!mins && !pm && !leader && n.office !== 'shugi' && n.office !== 'sangi') continue;
    const k = personaOf(n, year);
    let w = (pm ? 2 : mins ? 3 : leader ? 2 : 0.6) * PERSONAS[k].mult * (INTRA.ai ? INTRA.ai.gaffeWeight(p, n) : 1); // [R11-P] stress and low integrity make a slip more likely
    if (F && p.cabinet.ministers.minister_reconstruction === n.id) w *= 3;
    pool.push([n, w]);
  }
  if (!pool.length) return;
  const tot = pool.reduce((a, [, w]) => a + w, 0);
  let x = Math.random() * tot;
  let n = pool[0][0];
  for (const [m, w] of pool) { x -= w; if (x <= 0) { n = m; break; } }
  const sp = speakerOf(g, p, n.id);
  const fk = F && p.cabinet.ministers.minister_reconstruction === n.id;
  const venues = { kaiken: sp.kind === 'minister' || sp.kind === 'pm' ? 3 : 1, gaito: 2, tv: 2, toben: sp.kind === 'minister' && inSession(p, day) ? 2 : 0, sns: year >= 2004 ? (personaOf(n, year) === 'snsfan' ? 4 : 1) : 0, shisatsu: F ? (fk ? 5 : 1) : 0.5 };
  const venue = weighted(venues) || 'kaiken';
  const topic = F && (fk || Math.random() < 0.4) ? (venue === 'shisatsu' ? 'victim' : 'disaster') : venue === 'toben' ? 'opposition' : pickOne(['economy', 'general', 'history', 'local', 'crowd']);
  const kind = gaffeKindFor('honne', venue, topic, { persona: personaOf(n, year) });
  startGaffe(g, p, { who: n.id, kind, venue, topic });
}

// ================================================================ 復興担当大臣 (ext, round 4)
// After a major disaster (regime.js g.disaster(), tier ≥ 2; without regime.js: the politics core's own 大地震 shock) the PM
// may appoint a 復興担当大臣 — a 国務大臣 with the 特命 of the 復興 — in any era, as real PMs did: 1995-01-20 (the third day
// of the 阪神・淡路大震災: 兵庫県南部地震対策担当; the post was folded at the 1995-08-08 改造) and 2011-06-27 (東日本大震災
// 復興対策担当, after the 復興基本法 of 06-24); from 2012-02-10 the 復興大臣 heads the 復興庁 (復興庁設置法; until 2031-03 after
// the 2020 extension). The post is POSTS.minister_reconstruction: 「復興担当大臣」 while it is a 担当 (p.flags.fukkoTanto),
// 「復興大臣」 when a 復興庁 exists (then that minister takes the charge). 国務大臣の数 (内閣法2条): 20人以内 until 2000;
// from 2001 14人（特に必要なとき17人）, 15人（18人） while the 復興庁 exists — the game does not count heads.
// The work (FUKKO_WORKS): 被災地視察・被災者との対話 (with an attitude: the 被災地 gaffe is the classic risk of the post),
// 仮設住宅, 復興予算, 復興計画, 風評被害対策 → the 復興 progress (p.fukko.progress 0-100), approval, the economy, and the
// regime.js disaster's own record (its live object: score, log, done.plan — the documented fields only).
export const FUKKO_WORKS = {
  shisatsu: { name: '被災地を視察する', stamina: 14, every: 2, speech: 'shisatsu', topic: 'disaster', progress: 4, desc: '被災地を歩き、首長や住民の話を聞く。カメラが同行し、ひと言がそのまま報じられる（失言に注意）。' },
  taiwa: { name: '被災者と対話する', stamina: 12, every: 3, speech: 'taiwa', topic: 'victim', progress: 3, desc: '避難所や仮設住宅で、被災した人の声を聞く。態度しだいで信頼にも、批判にもなる。' },
  kasetsu: { name: '仮設住宅の建設を急ぐ', stamina: 10, every: 5, progress: 7, phases: ['hassei', 'hinan', 'fukko'], desc: '都道府県が建てる応急仮設住宅（災害救助法）を、国が資材・用地・予算の面で後押しする。' },
  yosan: { name: '復興予算を確保する', stamina: 8, every: 10, progress: 6, desc: '財務省と折衝し、復旧・復興の予算を確保する（復興の法案を閣議に出す。成立後は予算の前倒し）。' },
  keikaku: { name: '復興計画をまとめる', stamina: 10, once: true, minDays: 3, progress: 12, desc: '住まい・仕事・道路や学校の再建の道筋（復興の基本方針の案）をまとめ、閣議に諮る。' },
  fuhyo: { name: '風評被害の対策', stamina: 8, every: 5, minDays: 5, progress: 3, desc: '観光や農産物・水産物への風評被害を防ぐ。正確な情報を発信し、産地を応援する。' },
};
export const FUKKO_ORDER = Object.keys(FUKKO_WORKS);
function regimeDisasterOf(g) {
  if (typeof g.disaster !== 'function') return { has: false, d: null };
  try { return { has: true, d: g.disaster() }; } catch (e) { console.error(e); return { has: true, d: null }; }
}
// the regime.js disaster's live record when it is this one (documented fields only: score, log, done.plan)
function regimeLive(g, F) {
  const r = g.state && g.state.regime;
  const d = r && r.disaster;
  return d && F && d.id === F.id ? d : null;
}
function fukkoTitle(g, p, F) {
  const fy = fyNow(g);
  if (reconAgency(fy, p.flags)) return '復興大臣（復興庁）';
  return F ? `国務大臣（${F.name}復興対策担当）` : '国務大臣（復興対策担当）';
}
function newFukko(g, p, def) {
  return { id: def.id, name: def.name, kind: def.kind || 'quake', tier: clamp(num(def.tier, 2), 1, 3), start: num(def.start, today(g)), home: !!def.home, begun: today(g), appointed: null, agency: reconAgency(fyNow(g), p.flags), progress: 0, done: {}, last: {}, log: [{ day: today(g), text: `${def.name}が発生` }], ended: null, npcAt: null, npcWill: false, offer: null, disasterDone: null, works: 0 };
}
function fukkoLog(F, day, text) { F.log.push({ day, text }); if (F.log.length > 30) F.log.splice(0, F.log.length - 30); }
function beginFukko(g, p, F) {
  const day = today(g);
  const post = 'minister_reconstruction';
  if (F.agency) {
    F.appointed = day;
    const who = p.cabinet.ministers[post];
    fukkoLog(F, day, '復興大臣が復興を担当');
    news(p, g, `${F.name}からの復興は、復興大臣（復興庁）が担当する`);
    if (who === 'player') { note(g, `（${F.name}からの復興は、復興大臣のあなたの担当だ。「政治」→内閣→復興の仕事）`); phoneNews(g, `【官邸】${F.name}からの復興は、復興大臣が担当します。被災地の視察、仮設住宅、復興予算、復興計画…よろしくお願いします。`, '内閣官房'); }
    return;
  }
  if (p.cabinet.pm === 'player') {
    note(g, `（${F.name}の被害が大きい。復興を専任で進める「復興担当大臣」（国務大臣）を任命できる：「政治」→内閣、官邸の執務室）`);
    phoneNews(g, `【官邸】総理、${F.name}の復旧・復興を専任で担う国務大臣（復興担当大臣）を置くかどうか、ご判断ください。\n（1995年には地震の3日後、2011年には3か月あまり後に担当大臣が置かれた）`, '内閣官房');
    F.pmAsked = day;
    return;
  }
  F.npcAt = day + (F.tier >= 3 ? irnd(2, 4) : irnd(4, 8));
  F.npcWill = F.tier >= 3 || Math.random() < 0.5;
}
// who could be the 復興担当大臣 (coalition Diet members without a government post; persona shown)
function fukkoCandidatesImpl(g, p) {
  const ids = p.cabinet.partyIds || [];
  const busy = new Set(Object.entries(p.cabinet.ministers || {}).filter(([k]) => k !== 'minister_reconstruction').map(([, v]) => v));
  const year = calYear(g);
  return Object.values(p.npcs).filter((n) => ids.includes(n.party) && (n.office === 'shugi' || n.office === 'sangi') && !busy.has(n.id) && n.id !== p.cabinet.pm && !n.civilian && !n.posts.some((x) => POSTS[x] && POSTS[x].kind === 'diet'))
    .sort((a, b) => b.wins - a.wins || b.traits.charisma - a.traits.charisma).slice(0, 24)
    .map((n) => { const k = personaOf(n, year); return { id: n.id, name: n.name, party: n.party, partyName: pname(p, n.party), house: n.house || n.office, wins: n.wins, charisma: n.traits.charisma, integrity: n.traits.integrity, persona: k, personaName: PERSONAS[k].name, personaDesc: PERSONAS[k].desc, gaffeRisk: PERSONAS[k].mult >= 1.3 ? '高め' : PERSONAS[k].mult <= 0.6 ? '低め' : 'ふつう', real: !npcGaffeOK(n) }; });
}
function fukkoAppointBlock(g, p) {
  const F = fukkoLive(p);
  if (!F) return 'いま、復興を進めている大きな災害はない（大きな地震や津波などのあとに置く）';
  if (p.cabinet.pm !== 'player') return '復興担当大臣を任命するのは総理大臣';
  if (p.cabinet.resigned) return '総辞職した内閣は、次の総理が決まるまでの職務を行うだけ';
  return null;
}
// appoint (or replace) the minister: who = npc id | 'player' (the PM holds it too: 兼務) | 'auto'
function appointFukkoImpl(g, p, who = 'auto', opts = {}) {
  const why = opts.npc ? null : fukkoAppointBlock(g, p);
  if (why) return { ok: false, why };
  const F = fukkoLive(p);
  const day = today(g);
  const post = 'minister_reconstruction';
  const fy = fyNow(g);
  let id = who;
  if (id === 'auto' || !id) { const c = fukkoCandidatesImpl(g, p); id = c.length ? c[0].id : pickMinister(p, cabinetPartyOfPM(p) || (p.cabinet.partyIds || [])[0], p.cabinet.ministers).id; }
  if (id === 'player') {
    if (!opts.npc && p.cabinet.pm !== 'player') return { ok: false, why: '総理でなければ、自分を任命することはできない' };
  } else {
    const n = p.npcs[id];
    if (!n) return { ok: false, why: 'その人はいない' };
    if (!(p.cabinet.partyIds || []).includes(n.party) && !n.civilian) return { ok: false, why: '与党の議員（か民間人）から選ぶ' };
  }
  const tanto = !reconAgency(fy, p.flags);
  if (tanto) p.flags.fukkoTanto = true;
  const old = p.cabinet.ministers[post];
  if (old && old !== id && old !== 'player' && p.npcs[old]) p.npcs[old].posts = p.npcs[old].posts.filter((x) => x !== post);
  if (old === 'player' && id !== 'player') p.me.posts = p.me.posts.filter((x) => x !== post);
  p.cabinet.ministers[post] = id;
  if (id === 'player') { if (!p.me.posts.includes(post)) p.me.posts.push(post); }
  else if (!p.npcs[id].posts.includes(post)) p.npcs[id].posts.push(post);
  const first = !F.appointed;
  F.appointed = F.appointed || day;
  F.minister = id;
  const nm = id === 'player' ? g.state.name : p.npcs[id].name;
  const title = postName(post, fy);
  fukkoLog(F, day, `${nm}氏を${title}に任命`);
  news(p, g, `${nm}氏を${tanto ? `${F.name}の` : ''}${title}に任命${old && old !== id ? `（${old === 'player' ? g.state.name : (p.npcs[old] || {}).name || ''}氏から交代）` : ''}`);
  // a quick appointment shows resolve (1995: three days after the quake)
  if (first && !opts.npc) { const quick = day - F.start <= 5; approvalLift(g, p, quick ? 2 : 0.8, quick ? '復興担当大臣の素早い任命' : '復興担当大臣の任命', 'disaster'); }
  // the player PM's appointment is a cabinet change like 組閣 (an NPC PM's is only news)
  if (!opts.npc) emit(g, 'cabinet', { pm: p.cabinet.pm, partyIds: p.cabinet.partyIds, joined: post, fukko: true, reshuffle: false, coalition: false });
  return { ok: true, who: id, post, title, formal: fukkoTitle(g, p, F), text: `${nm}氏を${title}に任命した。\n（${fukkoTitle(g, p, F)}）${id === 'player' ? '\n総理が自分で兼ねる。' : ''}` };
}
// an NPC PM appoints: the player may be offered the post (a ruling Diet member with a record, or the local member of a home disaster)
function npcAppointFukko(g, p, F) {
  const day = today(g);
  const me = p.me;
  const post = 'minister_reconstruction';
  if (!reconAgency(fyNow(g), p.flags)) p.flags.fukkoTanto = true;
  const eligible = me.party && isRuling(p, me.party) && isNational(me) && !inCabinet(me) && !playerBarred(g, post);
  const chance = !eligible ? 0 : clamp(0.12 + (F.home ? 0.3 : 0) + (num(me.standing) - 50) / 150 + (num(me.nationalWins) >= 3 ? 0.15 : 0) + (num(g.state.fame) >= 3000 ? 0.1 : 0), 0, 0.75);
  if (eligible && Math.random() < chance) {
    const o = { id: 'o' + p.nextId++, kind: 'post', post, day, until: day + 3, from: p.cabinet.pm, fukko: F.id };
    me.offers.push(o);
    F.offer = o.id;
    phoneNews(g, `【入閣の打診】総理から「${postName(post, fyNow(g))}」（${F.name}の復興を担当）をお願いしたいと連絡がありました。\n（3日以内に返事を）`, '総理大臣官邸');
    emit(g, 'offer', o);
    return;
  }
  appointFukkoImpl(g, p, 'auto', { npc: true });
}
function endFukko(g, p, F, why = '') {
  const day = today(g);
  F.ended = day;
  fukkoLog(F, day, `復興に区切り（進み具合 ${Math.round(F.progress)}%）`);
  const H = p.fukkoHist || (p.fukkoHist = []);
  H.unshift({ id: F.id, name: F.name, tier: F.tier, start: F.start, appointed: F.appointed, end: day, progress: Math.round(F.progress), works: F.works });
  if (H.length > 10) H.length = 10;
  if (p.flags.fukkoTanto) {
    p.flags.fukkoTanto = false;
    if (!reconAgency(fyNow(g), p.flags)) {
      news(p, g, `${F.name}からの復興に区切り。復興担当大臣は置かれなくなった${why ? `（${why}）` : ''}`);
      dropPost(g, p, 'minister_reconstruction', '復興担当の終了');
      return;
    }
  }
  news(p, g, `${F.name}からの復興に区切り（復興の進み具合 ${Math.round(F.progress)}%）`);
}
// a cabinet post that no longer exists (a 担当 ended, an agency closed): its holder leaves it
function dropPost(g, p, post, why = '') {
  const id = p.cabinet.ministers[post];
  delete p.cabinet.ministers[post];
  if (id === 'player' || p.me.posts.includes(post)) {
    p.me.posts = p.me.posts.filter((x) => x !== post);
    note(g, `（${why || '職の廃止'}で、${postName(post, fyNow(g))}の任務を終えた。おつかれさまでした）`);
  }
  if (id && id !== 'player' && p.npcs[id]) p.npcs[id].posts = p.npcs[id].posts.filter((x) => x !== post);
  for (const n of Object.values(p.npcs)) if (n.posts.includes(post) && p.cabinet.ministers[post] !== n.id) n.posts = n.posts.filter((x) => x !== post);
}
function fukkoTick(g, p, day, abs) {
  const { has, d } = regimeDisasterOf(g);
  let F = p.fukko && typeof p.fukko === 'object' ? p.fukko : null;
  if (has && d && d.tier >= 2 && d.phase !== 'done' && (!F || F.id !== d.id)) {
    if (F && !F.ended) endFukko(g, p, F, '次の災害');
    F = p.fukko = newFukko(g, p, { id: d.id, name: d.name, kind: d.kind, tier: d.tier, start: d.start, home: d.home });
    beginFukko(g, p, F);
  } else if (!has && num(p.flags.disasterDay) === day && (!F || F.ended)) {
    F = p.fukko = newFukko(g, p, { id: 'q' + day, name: '大地震', kind: 'quake', tier: 2, start: day });
    beginFukko(g, p, F);
  }
  if (!F || F.ended) return;
  const post = 'minister_reconstruction';
  const fy = fyNow(g);
  F.agency = reconAgency(fy, p.flags);
  const who = p.cabinet.ministers[post] || null;
  // the NPC PM's decision
  if (!F.appointed && p.cabinet.pm !== 'player' && !p.cabinet.resigned) {
    if (F.offer) {
      const o = p.me.offers.find((x) => x.id === F.offer);
      if (o && o.answered === 'yes' && p.cabinet.ministers[post] === 'player') { F.appointed = day; F.minister = 'player'; F.offer = null; fukkoLog(F, day, `${g.state.name}氏が${postName(post, fy)}に就任`); note(g, `（${F.name}からの復興が、あなたの仕事になった。「政治」→内閣→復興の仕事）`); }
      else if (!o || (o.answered && o.answered !== 'yes')) { F.offer = null; appointFukkoImpl(g, p, 'auto', { npc: true }); }
    } else if (F.npcAt && day >= F.npcAt) {
      F.npcAt = null;
      if (F.npcWill) npcAppointFukko(g, p, F);
      else { F.noTanto = day; fukkoLog(F, day, '専任の担当大臣は置かず、いまの閣僚の体制で進める'); news(p, g, `政府は${F.name}の復旧・復興を、専任の担当大臣を置かず、いまの閣僚の体制で進めることにした`); }
    }
  } else if (!F.appointed && who && postExists(post, fy, p.flags)) { F.appointed = day; F.minister = who; }
  // the player PM who has not appointed one after a very large disaster: the press notices (once)
  if (p.cabinet.pm === 'player' && !F.appointed && F.tier >= 3 && day - F.start >= 8 && !F.lateNews) { F.lateNews = day; news(p, g, `${F.name}の被災地から「復興の司令塔がいない」との声。専任の担当大臣を求める意見も`); approvalHit(g, p, 1.5, '復興の体制への批判'); }
  // progress: the ministries' daily work (more with a minister), and an NPC minister's own work now and then
  const scale = F.tier >= 3 ? 0.65 : 1;
  F.progress = clamp(num(F.progress) + (F.appointed ? 0.32 : 0.15) * scale, 0, 100);
  const mw = p.cabinet.ministers[post];
  if (F.appointed && mw && mw !== 'player' && p.npcs[mw] && day >= num(F.npcNext)) {
    F.npcNext = day + irnd(4, 7);
    const n = p.npcs[mw];
    const kinds = FUKKO_ORDER.filter((k) => !(FUKKO_WORKS[k].once && F.done[k]) && !(FUKKO_WORKS[k].minDays && day - F.start < FUKKO_WORKS[k].minDays));
    const k = pickOne(kinds.length ? kinds : ['shisatsu']);
    const W = FUKKO_WORKS[k];
    // the NPC's own counters (the player's cooldowns and counts are F.last / F.done; the plan is made once for all)
    const nd = F.npcDone || (F.npcDone = {});
    nd[k] = num(nd[k]) + 1;
    if (W.once) F.done[k] = num(F.done[k]) + 1;
    F.works++;
    F.progress = clamp(F.progress + W.progress * scale * 0.8, 0, 100);
    const t = { shisatsu: `${n.name}${postName(post, fy)}が被災地を視察`, taiwa: `${n.name}${postName(post, fy)}が仮設住宅で被災者と対話`, kasetsu: `仮設住宅の建設を前倒し（${n.name}${postName(post, fy)}）`, yosan: `${n.name}${postName(post, fy)}が復興予算の確保へ財務省と折衝`, keikaku: `政府が${F.name}の復興計画をまとめた（担当：${n.name}${postName(post, fy)}）`, fuhyo: `${n.name}${postName(post, fy)}が風評被害の対策を発表`, }[k];
    fukkoLog(F, day, t);
    if (k === 'keikaku' || Math.random() < 0.35) news(p, g, t);
    const live = regimeLive(g, F);
    if (live) { if (k === 'keikaku' && live.done && !live.done.plan) live.done.plan = day; live.log.push({ day, text: t.slice(0, 40) }); }
  }
  // the end: the disaster's 復興 phase is over (regime.js), or (without it) 100 days and half the way
  const over = has ? !d || d.id !== F.id || d.phase === 'done' : day - F.start >= 100;
  if (over && !F.disasterDone) F.disasterDone = day;
  if (F.disasterDone && (F.progress >= 60 || day - F.disasterDone >= 30)) endFukko(g, p, F);
  void abs;
}
function fukkoWorkBlock(g, p, kind) {
  const F = fukkoLive(p);
  const W = FUKKO_WORKS[kind];
  if (!W) return 'そんな仕事はない';
  if (!F) return 'いま復興を進めている災害はない';
  if (p.cabinet.ministers.minister_reconstruction !== 'player') return `${postName('minister_reconstruction', fyNow(g))}の仕事（いまの担当：${F.appointed ? g.npcName(p.cabinet.ministers.minister_reconstruction) || '—' : 'まだいない'}）`;
  const day = today(g);
  if (W.once && F.done[kind]) return 'もうまとめた（閣議決定ずみ）';
  if (W.minDays && day - F.start < W.minDays) return `被害の全体像がつかめてから（発生から${W.minDays}日ごろ）`;
  if (W.every && F.last[kind] != null && day - num(F.last[kind]) < W.every) return `${W.every}日に1回まで（つぎは${num(F.last[kind]) + W.every - day}日後）`;
  if (g.state.stamina < W.stamina) return '体力が足りない';
  if (W.phases) { const { d } = regimeDisasterOf(g); if (d && d.id === F.id && !W.phases.includes(d.phase)) return 'いまの段階では要らない'; }
  return null;
}
function fukkoActionImpl(g, p, kind, opts = {}) {
  const why = fukkoWorkBlock(g, p, kind);
  if (why) return { ok: false, why };
  const F = fukkoLive(p);
  const W = FUKKO_WORKS[kind];
  const day = today(g);
  const fy = fyNow(g);
  const st = g.state;
  const me = p.me;
  st.stamina -= W.stamina;
  F.last[kind] = day;
  F.done[kind] = num(F.done[kind]) + 1;
  F.works++;
  const scale = F.tier >= 3 ? 0.75 : 1;
  const lines = [];
  let gain = W.progress * scale;
  let appr = 0;
  let speech = null;
  const live = regimeLive(g, F);
  const abs = absOfDay(p, day);
  if (W.speech) {
    speech = speakImpl(g, p, W.speech, { topic: opts.topic || W.topic, attitude: opts.attitude || 'teinei', risky: opts.risky });
    if (speech.outcome === 'gaffe') { gain *= 0.3; lines.push(`${speech.line}`, '…被災地の人たちの表情がこわばった。'); }
    else if (speech.outcome === 'good') { gain *= 1.5; appr = 1.5; lines.push(`${speech.line}`, speech.reaction); }
    else { appr = 0.6; lines.push(`${speech.line}`, speech.reaction); }
    if (kind === 'shisatsu') lines.unshift(`${F.name}の被災地を歩いた。がれき、閉じたままの店、避難所の長い列。`);
    else lines.unshift('避難所の体育館で、被災した人たちと車座になった。');
    if (live && speech.outcome !== 'gaffe') live.score = num(live.score) + 0.5;
  } else if (kind === 'kasetsu') {
    appr = 1; lines.push('資材と用地の確保を関係省庁に指示し、仮設住宅の建設を前倒しした。', '「一日でも早く、プライバシーのある住まいを」');
    for (const s of ['rural', 'elderly', 'families']) if (me.party && p.parties[me.party]) addSupport(p, s, me.party, 0.002);
    if (live) live.score = num(live.score) + 1;
  } else if (kind === 'yosan') {
    let billId = null;
    if (!policyBlock(p, 'reconstruction', null, calYear(g), fy)) billId = g.proposeBill({ policy: 'reconstruction' });
    if (billId) { lines.push(`財務省と折衝し、「${POLICIES.reconstruction.name}」の法案を閣議に出した。`, '成立すれば、予算と人が被災地に集中する。'); gain *= 0.5; }
    else {
      p.economy.shocks.push({ kind: 'fukko', name: '復興需要（予算の前倒し）', until: abs + 60, len: 60, growth: 0.06, inflation: 0.02, unemployment: -0.02, yen: 0 });
      lines.push('財務省と折衝し、復旧・復興の予算の執行を前倒しさせた。', '道路や港の工事が動きだし、地元の雇用も少し戻る。');
      appr = 0.5;
    }
    if (live) live.score = num(live.score) + 1;
  } else if (kind === 'keikaku') {
    appr = 2;
    lines.push(`${F.name}からの復興計画（基本方針の案）をまとめ、閣議決定した。`, '住まい、仕事、学校、道路。ひとつずつ、町を取り戻す道筋だ。');
    news(p, g, `政府が${F.name}からの復興計画を閣議決定（担当：${g.state.name}${postName('minister_reconstruction', fy)}）`);
    if (live) { if (live.done && !live.done.plan) live.done.plan = day; live.score = num(live.score) + 2; }
  } else if (kind === 'fuhyo') {
    appr = 0.5;
    p.economy.shocks.push({ kind: 'fukko', name: '風評被害の対策', until: abs + 50, len: 50, growth: 0.03, inflation: 0, unemployment: 0, yen: 0 });
    for (const s of ['farmers', 'selfemployed']) if (me.party && p.parties[me.party]) addSupport(p, s, me.party, 0.003);
    lines.push('被災地の産品を、テレビカメラの前で味わってみせた。正確な情報も、あわせて発信した。', '「安全です。ぜひ、被災地のものを買ってください」');
  }
  F.progress = clamp(num(F.progress) + gain, 0, 100);
  if (appr) approvalLift(g, p, appr, `復興担当大臣の仕事（${W.name}）`, 'disaster');
  me.reputation = clamp(me.reputation + (speech && speech.outcome === 'gaffe' ? 0 : 1), -100, 100);
  fukkoLog(F, day, `${W.name}${speech ? `（${speech.attName}${speech.outcome === 'gaffe' ? '・失言' : speech.outcome === 'good' ? '・好評' : ''}）` : ''}`);
  if (live) live.log.push({ day, text: `復興担当大臣：${W.name}` });
  if (g.lifeTick) g.lifeTick({ hunger: -8, stress: 6, clean: -6 });
  lines.push(`（復興の進み具合 ${Math.round(F.progress)}%）`);
  return { ok: true, kind, text: lines.join('\n'), progress: Math.round(F.progress), speech };
}
function fukkoStatusImpl(g, p) {
  const F = p.fukko && typeof p.fukko === 'object' ? p.fukko : null;
  const fy = fyNow(g);
  const post = 'minister_reconstruction';
  const exists = postExists(post, fy, p.flags);
  const who = exists ? p.cabinet.ministers[post] || null : null;
  const live = F && !F.ended;
  const { d } = regimeDisasterOf(g);
  const dd = live && d && d.id === F.id ? d : null;
  return {
    active: !!live, agency: reconAgency(fy, p.flags), tanto: !!p.flags.fukkoTanto, post, exists, postName: postName(post, fy), title: fukkoTitle(g, p, F),
    minister: who, ministerName: who ? g.npcName(who) : null, isPlayer: who === 'player', persona: who && who !== 'player' && p.npcs[who] ? PERSONAS[personaOf(p.npcs[who], calYear(g))].name : null,
    disaster: F ? { id: F.id, name: F.name, kind: F.kind, tier: F.tier, start: F.start, phase: dd ? dd.phase : F.ended ? 'done' : F.disasterDone ? 'done' : null } : null,
    progress: F ? Math.round(num(F.progress)) : 0, appointed: F ? F.appointed : null, ended: F ? F.ended : null, noTanto: F ? !!F.noTanto : false, offer: F ? F.offer : null,
    stageLabel: !F ? '—' : F.ended ? '区切り' : F.progress >= 80 ? '仕上げ' : F.progress >= 50 ? '再建が進む' : F.progress >= 20 ? '復旧から復興へ' : '応急の段階',
    canAppoint: !fukkoAppointBlock(g, p), appointBlock: fukkoAppointBlock(g, p),
    works: FUKKO_ORDER.map((k) => ({ id: k, name: FUKKO_WORKS[k].name, desc: FUKKO_WORKS[k].desc, stamina: FUKKO_WORKS[k].stamina, speech: FUKKO_WORKS[k].speech || null, done: F ? num(F.done[k]) : 0, why: fukkoWorkBlock(g, p, k) })),
    log: F ? F.log.slice(-12) : [], history: (p.fukkoHist || []).slice(0, 6),
    note: reconAgency(fy, p.flags) ? '復興庁（2012年2月10日発足。設置期限は2031年3月末：2020年の改正で10年延長）の大臣が、復興の司令塔になる。' : '専任の国務大臣を置いて復興を進めることができる（1995年1月の阪神・淡路大震災では3日後に、2011年の東日本大震災では6月に担当大臣が置かれた）。',
  };
}

// ================================================================ g.* API (installPolitics)
// Every method creates the politics state on demand and works headless (g.auto) and without
// any place. Methods that can fail return null on success and a reason string otherwise
// (eligible / joinParty / leaveParty / declareCandidacy / vote / ...), or null with
// g.lastPoliticsError set (foundParty / proposeBill / dissolve).
//
//  state & time
//   pol() -> g.state.politics                 created / repaired on demand (old saves are fine)
//   polDate(day?) / gameDate(day?) -> { year, month, dom, doy, fy, wareki, label, short }
//                                               the simulated calendar (crime.js lawDate reads gameDate)
//   politicsTick() -> Promise                  the morning step (also registered with onMorning)
//   politicsSummary() -> { date, era, me, cabinet, diet, economy, support, upcoming, news }
//   onPolitics(event, fn(g, data)) -> unsubscribe   'elected' 'lost' 'enacted' 'cabinet' 'scandal'
//                                               'dissolve' 'resign' + 'election' 'session' 'bill' 'poll'
//                                               'shock' 'party' 'offer' 'payday'
//  elections
//   upcomingElections() -> [{ id, kind, label, day, koji, status, date, kojiDate, declared, party,
//                             district, office, newsOnly }]
//   eligible(officeId, opts?) -> null | reason      age (25/30; opts.day = the election day: 公選法10条2項),
//                                               公民権停止 / 刑の執行中 (11条), custody, 供託金 (opts.noMoney)
//   depositInternal(officeId, { pr }?) -> game money for that year's 供託金 (show with fmtMoney)
//   requestNomination(electionId, { proportional?, hometown? }?) -> { ok, why?, kind: '公認'|'推薦', party, held? }
//       a seat the party already holds (現職: p.flags.smdHolders / a backed 首長) goes to its member
//       unless the player stands very high; 比例 (参院) is the easy door for famous people
//   declareCandidacy(electionId, { party?, proportional?: true|'only', hometown?: true }) -> null | reason
//       届出 up to the 公示/告示 day; pays the deposit (政治資金 first, then money); another
//       office is lost at 公示 (公選法90条). proportional: 衆院=重複 / 'only'=比例単独, 参院=比例
//   withdrawCandidacy(electionId?) -> null | reason (after 公示 the deposit is forfeited)
//   campaign(action, { electionId?, score? }) -> Promise<{ ok, why?, pts, total, cost, text, illegal? }>
//       actions: CAMPAIGN_ACTIONS keys; '買収' / '戸別訪問' go through g.commitCrime (crime.js)
//   electionForecast(electionId?) -> { chance, votes, rank, seats, barred } | null   (情勢調査: the same race
//                                               the election runs; barred = no 被選挙権 now)
//   castVote(electionId, choice?) -> null | reason    the player's own ballot (選挙権 18/20歳 on 投票日;
//                                               none during 公民権停止 / a prison term)
//   runElection(electionId) -> RESULT  normally run by the tick the morning after 投票日
//       RESULT = { id, kind, label, day, year, turnout %, valid, winners: [{ name, party, votes, isPlayer }],
//         seats: { party: n }, total, houseSeats?, national?: { share }, candidates?, runoff?,
//         myResult: { won, votes, rank, share, depositLost, deposit, revived, pr, district, party, invalid? } | null }
//       invalid: the player had no 被選挙権 when the votes were counted (votes void, deposit forfeited).
//       At 公示 a filing without 被選挙権 is refused (届出不受理, deposit back).
//  parties
//   joinParty(id) / leaveParty(opts?) -> null | reason      seats follow the player (会派)
//   foundParty({ name, short, color, emblem, ideology?, platform: [policyIds], desc }) -> id | null
//   partyStatus(id?) -> { official (政党要件), members, seats, shugi, sangi, subsidy, voteShare, funds, reason }
//   recruitMembers({ funds }) -> { ok, joined: [{ name, from, house }], status }   (own party, 1/day)
//   joinFaction(id) / leaveFaction() -> null | reason;  appointPartyPost(post, 'player'|npcId)
//   transferPartyFunds(n) -> null | reason (党 → 政治資金, leader only)
//   setCoalitionStance('auto'|'accept'|'refuse'); joinCoalition() / leaveCoalition() -> null | reason
//  the Diet
//   billsList({ house?, mine?, pending?, today? }) -> [BILL]
//   policyBlock(policyId, params?) -> null | reason;  policyPreview(policyId, params?) -> { cost, segments,
//                                                       economy, alignment: { party: 0..1 }, block, ... }
//   proposeBill({ policy, params?, title? }) -> billId | null   (議員立法: needs 賛成者; 閣法 when in the cabinet)
//   gatherSupporters(billId) -> { ok, supporters, need, ready }   (1/day)
//   vote(billId, 'yes'|'no'|'abstain') -> null | reason   (counted at the plenary; 党議拘束 applies)
//   attendDiet() -> { ok, why?, bills }       (attendance; long absences become a scandal)
//   attendBlock() -> null | reason; attendance() -> { member, session, today, absent, days, missed, cabinet,
//       business, reportAt, text }   (2026-10: absence counts only on a day with business: p.diet.agenda;
//       the cabinet's duty is 答弁 — 国会で答弁 / 委員会で質問 also count as attending)
//   advanceBills() -> [BILL]                  (the tick calls it)
//   noConfidence({ rebel? }) -> { ok, why?, passed, yes, no, outcome: 'dissolve'|'resign'|'pending'|null }
//   noConfidenceBlock({ rebel? }) -> null | reason   (2026-10: never the PM / a minister; a ruling member only
//       with rebel — the UIs do not offer it)
//  the cabinet
//   approval() -> %;  partySupport(id) -> %
//   electPM() -> { pm, name, partyIds, votes, sangiDiffers, minority }   (首班指名; the tick runs it)
//   formCabinet({ partners?, ministers?: { post: npcId|'player' } }) -> { ok, ministers, partyIds }  (PM only)
//   reshuffle(choices?) -> { ok, ... }; dissolve(reason?) -> electionId | null; resignPM(reason?)
//       electPM names only Diet members (憲法67条); after 総辞職 (p.cabinet.resigned: a caretaker that
//       cannot dissolve) the PM's party chooses a new leader first (the player too, when they lead a
//       party they did not found). 党首選 term limit: 自民 連続2期 (2017-: 3期), p.me.leaderTerms.
//   respondOffer(offerId|null, yes) -> null | reason   (入閣 / 党役員の打診: p.me.offers)
//   resignPost(post, reason?); resignOffice(reason?); loseOffice(reason, opts?)   (失職 → 補選 in the
//       player's district; a 比例 member's seat is filled from the list: 繰上補充, p.me.prElected)
//   joinParty: a 比例 member who joins another party that existed at their election loses the seat
//       (国会法109条の2); leaving (無所属) or founding a party is fine.
//  activities & money
//   activity(kind, { score? }) -> { ok, why?, text, gaffe }   (ACTIVITIES; once a day each)
//   holdFundraiser({ unreported: 0..0.5 }) -> { ok, tickets, gross, net, secret, text }
//   collectDonations() -> { ok, amount, text };  addSecretFunds(n, source) -> secret total
//   reportFunds({ includeSecret?, year? }) -> { ok, year, income, expense, corrected, text }
//   politicalScandal(kind, { who?: 'player'|npcId, amount?, severity? }) -> record (emits 'scandal';
//       an NPC of a real party only steps down for neutral reasons: kind 'stepdown', no hook)
//   hireStaff(+1|-1) -> null | reason   (私設秘書: monthly cost, helps activities and campaigns)
//  misc
//   npcName(id), partyName(id, short?), postLabel(post), triggerShock(kind), politicsMenu() (text UI)
//  発言・態度・失言 (round 4; see the section 「発言・態度・失言」)
//   speechOptions(venue, { topic?, risky?: false }) -> { venue, venueName, topic, topicName, question, asker, block,
//       options: [{ id (ATTITUDES id | 'risky'), name, label, risk %, factors [{ label, v }], desc, kinds [names], good, line }] }
//       venue: kaiken 記者会見 | toben 国会答弁 | gaito 街頭演説 | shisatsu 視察 | tv テレビ出演 | sns SNS（2004-; ブログ until 2009)
//              | taiwa 被災者との対話 | shazai 謝罪会見
//   speechRisk(venue, attitude, { topic?, risky? }) -> { topic, risk, factors };  speechBlock(venue) -> null | reason
//   speak(venue, { topic?, attitude, risky?, force? }) -> { ok, why?, venue, venueName, topic, topicName, attitude, attName,
//       risky, risk, outcome: 'gaffe'|'good'|'neutral', line, reaction, gaffe (record) | null, good { kind, name, desc } | null,
//       effects [text], score 0..100 }   (force: skip speechBlock — the caller already checked, e.g. an activity)
//   gaffes({ who?: 'player'|'npc'|npcId, active?, n? }) -> [GAFFE + kindName, kindShort, venueName, stageName, quote, outcomeName]
//       GAFFE = { id, who, name, title, party, kind (GAFFE_KINDS), line, desc, venue, topic, day, sev 1..5, heat 0..100, peak,
//         stage (GAFFE_STAGES: enjo|tekkai|shazai|tsuikyu|ketsugi|jinin), steps { stage: day }, retracted, apologies, refused,
//         motion { house, kind, yes, no, passed } | null, done, end, outcome 'chinka'|'jinin'|'koutetsu' | null, log [{ day, text }] }
//   gaffeOptions(id) -> [{ id: tekkai|shazai|setsumei|hirakinaori|jinin, name, desc, why, speech?, danger? }]
//   gaffeRespond(id, kind, { attitude? }) -> { ok, why?, kind, text, speech? }   (shazai / setsumei take an attitude)
//   npcPersona(npcId) -> { key, name, desc, mult, retract, kinds, gaffeShown } | null   (PERSONAS)
//   activityBlock(kind) -> null | reason   (activity()'s refusal without side effects)
//   activity(kind, { score?, speech? }): ACTIVITIES with speech (記者会見・視察・街頭演説・TV出演・SNSで発信・国会で答弁)
//       take the result of g.speak as opts.speech (no second roll); without it the player speaks in their usual way
//       (attitude from the talk skill) and a gaffe becomes a GAFFE record (result.speech)
//   campaign('街頭演説'|'SNS'|'討論会', { attitude? | speech? }) -> result.speech; the day's points ×1.6 (good) / ×0.25 (gaffe)
//  復興担当大臣 (round 4; see the section 「復興担当大臣」)
//   fukko() -> { active, agency (復興庁), tanto, post: 'minister_reconstruction', exists, postName (復興大臣|復興担当大臣), title
//       (formal), minister, ministerName, isPlayer, persona, disaster { id, name, kind, tier, start, phase }, progress 0..100,
//       stageLabel, appointed, ended, noTanto, offer, canAppoint, appointBlock, works [{ id, name, desc, stamina, speech, done,
//       why }], log, history, note }
//   fukkoCandidates() -> [{ id, name, party, partyName, house, wins, charisma, integrity, persona, personaName, personaDesc,
//       gaffeRisk 高め|ふつう|低め, real }];  fukkoAppointBlock() -> null | reason (PM only, a live 復興)
//   appointFukkoMinister(npcId | 'player' | 'auto') -> { ok, why?, who, post, title, formal, text }
//   fukkoAction(kind, { attitude? }) -> { ok, why?, kind, text, progress, speech? }   kinds FUKKO_WORKS: shisatsu 被災地視察 /
//       taiwa 被災者との対話 (with an attitude) / kasetsu 仮設住宅 / yosan 復興予算 / keikaku 復興計画 / fuhyo 風評被害対策
//   fukkoWorkBlock(kind) -> null | reason
//
//  state extras added by the review (all optional; old saves are filled in):
//   me: prElected { house, party, day } | null, leaderTerms, districtPref, nomKind { [electionId]: 'district'|'pr' }
//   flags: smdHolders { home|<pref>: { party, npc, open } }, pmNo, paidMonth, skipPlayerPM, outgoingLeader
//   cabinet: resigned (day) while a resigned cabinet carries on until the next 首班指名
//  exports added: platformFor(partyId, year), FISCAL_BURDEN, PARTY_DEFS.jimin.platformByYear
const isNational = (me) => me.office === 'shugi' || me.office === 'sangi';
// Diminishing returns for the 0..100 career meters (review): the higher a meter, the less one
// more day of the same work adds (×(1 − v/100)^1.5).
function gainTo(v, d) { return d > 0 ? d * Math.pow(clamp(1 - num(v) / 100, 0, 1), 1.5) : d; }
// 後援会 grows less as it nears what the district can hold (soft cap by office).
function kouenkaiCap(me) { return me.office === 'chiji' ? 15000 : ['shugi', 'sangi', 'shicho'].includes(me.office) || ['shugi', 'sangi'].includes(me.formerOffice) ? 6000 : 3000; }
function kouenkaiGain(p, n) { const me = p.me; return Math.max(0, Math.round(num(n) * clamp(1 - num(me.kouenkai) / kouenkaiCap(me), 0, 1))); }
const inCabinet = (me) => me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
function sanitizeParams(pl, params) {
  const out = { ...pl.defaults };
  for (const d of pl.params || []) {
    let v = num(params && params[d.key], d.def ?? d.min);
    v = clamp(v, d.min, d.max);
    if (d.step) v = Math.round((v - d.min) / d.step) * d.step + d.min;
    out[d.key] = Math.round(v * 100) / 100;
  }
  return out;
}
function protectYen(n) { return `${YEN_MARK}${Math.round(num(n)).toLocaleString('ja-JP')}円`; }

function activityBlockImpl(g, p, kind) {
  const me = p.me;
  const A = ACTIVITIES[kind];
  const st = g.state;
  const day = today(g);
  if (!A) return 'そんな活動はない';
  const need = A.need;
  const okNeed = need === 'any' ? true : need === 'national' ? isNational(me) : need === 'local' ? ['kugi', 'togi'].includes(me.office) : need === 'exec' ? ['shicho', 'chiji'].includes(me.office) : need === 'cabinet' ? inCabinet(me) : need === 'pm' ? me.posts.includes('pm') : need === 'faction' ? !!me.faction : !!me.office;
  if (!okNeed) return 'いまの立場ではできない';
  // (2026-10 fix) the cabinet answers questions in the committees; it does not ask them
  if (kind === '委員会で質問' && inCabinet(me)) return '総理・大臣は委員会で質問に答える側（内閣の一員は「国会で答弁」をする）';
  if (A.session && !inSession(p, day)) return '国会の会期中だけ';
  if (A.from && calYear(g) < A.from) return 'この時代は、政治家が自分で発信するブログやSNSがまだない';
  if (me.lastAct[kind] === day) return '今日はもうやった';
  if (st.stamina < A.stamina) return '体力が足りない';
  if (A.funds && me.funds + st.money < A.funds) return 'お金が足りない';
  return null;
}
const methods = {
  pol() { return ensurePol(this); },
  // [R14-P] 実在の党首（安倍・鳩山・菅・野田）: g.realPols() -> [{ key, name, party, tag, id, seated, role }]; g.setRealPols(on) (設定); g.realPolsOn()
  realPols() { return realList(this); },
  setRealPols(on) { return setRealPols(this, on); },
  realPolsOn() { return realPolsSetting(this); },
  polDate(day) { ensurePol(this); return polDate(this, day); },
  // ext: the simulated calendar date for other modules (crime.js lawDate reads it): { year, month, ... }
  gameDate(day) { ensurePol(this); return polDate(this, day); },
  eligible(officeId, opts = {}) { return eligibleImpl(this, ensurePol(this), officeId, opts); },
  // The deposit for an office in game money (shown with fmtMoney as that year's yen). ext
  depositInternal(officeId, opts = {}) { const p = ensurePol(this); return Math.round(depositFor(officeId, calYear(this), opts) / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1)); },
  joinParty(partyId) { return joinPartyImpl(this, ensurePol(this), partyId); },
  // ext: why joinParty(partyId) would be refused now (null = it would work; no side effects), and the
  // yearly 党費 it takes (internal game money: show with fmtMoney).
  joinPartyBlock(partyId) { return joinPartyBlock(this, ensurePol(this), partyId); },
  partyFee() { return partyFeeOf(ensurePol(this)); },
  leaveParty(opts = {}) { return leavePartyImpl(this, ensurePol(this), opts && opts.reason === 'scandal' ? '離党（不祥事）' : (opts && opts.why) || '離党'); },
  foundParty(def = {}) { const r = foundPartyImpl(this, ensurePol(this), def); this.lastPoliticsError = r.why || null; return r.id || null; },
  partyStatus(partyId) { const p = ensurePol(this); return partyStatusOf(p, partyId ?? p.me.party); },
  // ext: ask your party for 公認 (推薦 for 区長・知事). opts: { proportional: true | 'only', hometown }
  // (as for declareCandidacy: a 比例 nomination is easier to get). -> { ok, why?, kind, party, held? }
  requestNomination(electionId, opts = {}) { const p = ensurePol(this); return nominationImpl(this, p, p.elections.upcoming.find((e) => e.id === electionId), opts || {}); },
  declareCandidacy(electionId, opts = {}) { const p = ensurePol(this); return declareImpl(this, p, p.elections.upcoming.find((e) => e.id === electionId), opts); },
  // ext: withdraw before 投票日 (after 公示 the deposit is forfeited, as in real law).
  withdrawCandidacy(electionId) {
    const p = ensurePol(this);
    const e = p.elections.upcoming.find((x) => x.id === (electionId || p.me.candidacy));
    const d = myDecl(e);
    if (!d) return '立候補していない';
    if (today(this) < e.koji && d.deposit) { if (d.depositFrom === 'funds') p.me.funds += d.deposit; else this.state.money += d.deposit; }
    delete e.declared.player;
    p.me.candidacy = null;
    p.me.campaign = null;
    return null;
  },
  campaign(action, opts = {}) { return campaignImpl(this, ensurePol(this), action, opts); },
  // ext: the player's own ballot (record only; +1 reputation for voting).
  castVote(electionId, choice = null) {
    const p = ensurePol(this);
    const e = p.elections.upcoming.find((x) => x.id === electionId);
    if (!e || ELECTION_KINDS[e.kind].newsOnly || e.kind === 'sosaisen') return 'その選挙では投票できない';
    if (ageAt(this.state, e.day) < votingAge(calYear(this, e.day), p.flags)) return `選挙権は${votingAge(calYear(this, e.day), p.flags)}歳から`;
    if (civicBarred(this, 'vote')) return '選挙権がない（公民権停止中・刑の執行中は投票できない）';
    if (today(this) !== e.day && !(today(this) >= e.koji && today(this) < e.day)) return '投票日（または期日前投票の期間）ではない';
    if (e.voted) return 'もう投票した';
    e.voted = { day: today(this), choice };
    p.me.reputation = clamp(p.me.reputation + 1, -100, 100);
    return null;
  },
  runElection(electionId) { const p = ensurePol(this); const e = p.elections.upcoming.find((x) => x.id === electionId); if (!e) { const h = p.elections.history.find((r) => r.id === electionId); return h || null; } return runElectionImpl(this, p, e); },
  // ext: a rough forecast for the player's race -> { chance 0..1, votes, rank } (no side effects).
  electionForecast(electionId) {
    const p = ensurePol(this);
    const e = p.elections.upcoming.find((x) => x.id === (electionId || p.me.candidacy));
    const d = myDecl(e);
    if (!e || !d || e.kind === 'sosaisen' || d.pr || d.prOnly) return null;
    const fy = fyOfAbs(p, absOfDay(p, e.day));
    // the same race the election will run (district size, electorate, rivals); NPC records made
    // for the rivals are throwaway (npcCandidate makes light records only)
    let wins = 0, votes = 0, rank = 0, M = 1;
    const N = 12;
    for (let i = 0; i < N; i++) {
      const S = playerRaceSetup(this, p, e, d, fy);
      M = S.opts.M;
      const cands = S.cands;
      cands.push(playerCandidate(this, p, e, S.decl));
      const r = runRace(p, { candidates: cands, ...S.opts });
      const me = r.candidates.find((c) => c.isPlayer);
      if (me.won) wins++;
      votes += me.votes;
      rank += me.rank;
    }
    return { chance: wins / N, votes: Math.round(votes / N), rank: Math.round(rank / N), seats: M, barred: civicBarred(this) };
  },
  proposeBill(def = {}) {
    const p = ensurePol(this);
    const me = p.me;
    this.lastPoliticsError = null;
    const fail = (w) => { this.lastPoliticsError = w; return null; };
    const pl = POLICIES[def.policy];
    if (!pl) return fail('その政策はない');
    if (!isNational(me) && !inCabinet(me)) return fail('法律案を出せるのは、国会議員か内閣（大臣）だけ');
    const year = calYear(this);
    const fy = fyNow(this);
    const params = sanitizeParams(pl, def.params);
    const why = policyBlock(p, pl.id, params, year, fy);
    if (why) return fail(why);
    const title = def.title ? String(def.title).slice(0, 40) : billTitle(pl, params);
    const cost = pl.costOf(params, ctxOf(p, year));
    const day = today(this);
    const session = inSession(p, day);
    if (inCabinet(me) && pl.kind !== 'amendment') {
      // 閣法: the ministry in charge drafts it; 閣議決定 needs the PM's party on board. A minister
      // brings the bills of their own ministry (review); the PM may bring any.
      const pmParty = cabinetPartyOfPM(p);
      const post = ministryFor(pl.ministry || 'kanbo', fy, p.flags);
      const isPM = me.posts.includes('pm');
      if (!isPM) {
        const mine = me.posts.filter((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
        const covers = mine.includes(post) || mine.some((x) => (POSTS[x].areas || []).includes(pl.area));
        if (!covers) return fail(`その政策は担当外（${postName(post, fy)}の所管）。総理か担当の大臣が閣議に出す`);
        if (alignment(p, pmParty, pl.id) < 0.45) return fail('閣議で了承されなかった（与党の方針と合わない）');
      } else if (alignment(p, pmParty, pl.id) < 0.45) {
        // the PM's own party balks at a policy far from its line (与党の事前審査で紛糾)
        me.standing = clamp(me.standing - 5, 0, 100);
        if (Math.random() < 0.5) return fail('与党の総務会が了承しなかった（党の方針と合わない法案に、党内の反発が強い）');
      }
      const b = addBill(p, { title, policy: pl.id, params, sponsor: 'cabinet', by: 'player', party: pmParty, house: 'shugi', day, ministry: post, cost, stage: session ? 'committee' : 'draft', delay: irnd(3, 6) });
      if (!session) b.ready = true;
      b.log.push({ day, text: session ? (b.kind === 'budget' ? '内閣が国会に提出（予算案）' : '内閣が国会に提出（閣法）') : '閣議決定（次の国会に提出）' });
      news(p, this, `内閣が「${title}」を${session ? '国会に提出' : '閣議決定'}`);
      return b.id;
    }
    if (!isNational(me)) return fail('憲法改正の原案は国会議員が出す');
    // 予算（補正予算）を国会に出せるのは内閣だけ（憲法73条・86条）
    if (pl.billKind === 'budget') return fail('補正予算案を国会に出せるのは内閣だけ（憲法73条・86条）。大臣か総理として閣議に出す');
    // 議員立法: 賛成者 衆院20人（予算を伴うもの50人）、参院10人（同20人）。憲法改正原案は衆院100人・参院50人（目安）
    const house = me.office;
    const need = pl.kind === 'amendment' ? (house === 'shugi' ? 100 : 50) : house === 'shugi' ? (cost > 0 ? 50 : 20) : (cost > 0 ? 20 : 10);
    let supporters = 1;
    let approved = !me.party;
    let review = null;
    const pt = me.party && p.parties[me.party];
    if (pt) {
      const al = alignment(p, me.party, pl.id);
      if (isRuling(p, me.party) && pt.leader !== 'player') {
        // 与党の事前審査 (review): a ruling member's bill goes through the party's 部会・政務調査会・
        // 総務会 first; most policy is left to the government (閣法), so few get the party's OK
        review = { until: day + irnd(4, 8), al };
      } else {
        approved = pt.leader === 'player' || (al >= 0.5 && me.standing >= 25);
        // a member bill is filed with the 会派's approval (機関承認): without it, it is not submitted
        if (!approved) return fail(`党の政策審議で了承されなかった（${al < 0.5 ? '党の方針と合わない' : '党内での評価がまだ低い'}）。議員立法は、所属する会派の了承がないと出せない`);
        supporters += cosponsors(p, house, al, pt.leader === 'player');
      }
    }
    const b = addBill(p, { title, policy: pl.id, params, sponsor: 'member', by: 'player', party: me.party || IND, house, day, stage: 'draft', supporters, need, cost, delay: irnd(3, 6) });
    b.partyApproved = approved;
    if (review) b.review = review;
    b.log.push({ day, text: review ? `法案をまとめ、党の事前審査（部会→政調会→総務会）にかけた（${dateLabel(this, review.until)}ごろ結論）` : `法案をまとめた（賛成者 ${supporters}/${need}人）${approved ? '' : '・党の了承はまだ'}` });
    if (review) return b.id;
    if (supporters >= need) {
      b.ready = true;
      if (session) { b.stage = 'committee'; b.step = 'committee'; b.next = day + irnd(3, 6); b.log.push({ day, text: '国会に提出（議員立法）' }); news(p, this, `${this.state.name}議員らが「${title}」を提出`); }
    }
    return b.id;
  },
  // ext: collect co-sponsors for a draft bill (once a day). -> { ok, why?, supporters, need, ready }
  gatherSupporters(billId) {
    const p = ensurePol(this);
    const b = p.diet.bills.find((x) => x.id === billId);
    if (!b || b.by !== 'player' || b.stage !== 'draft') return { ok: false, why: 'まとめ中の法案がない' };
    if (b.review && !b.review.done) return { ok: false, why: `党の事前審査の結論を待っている（${dateLabel(this, b.review.until)}ごろ）` };
    const day = today(this);
    if (b.gathered === day) return { ok: false, why: '今日はもう声をかけて回った' };
    if (this.state.stamina < 8) return { ok: false, why: '体力が足りない' };
    this.state.stamina -= 8;
    b.gathered = day;
    let add = 0;
    for (const [id, n] of Object.entries(p.diet[b.house].seats)) {
      if (id === b.party) continue;
      const al = id === IND ? 0.6 : alignment(p, id, b.policy);
      if (al >= 0.58) add += Math.round(num(n) * (al - 0.5) * rnd(0.04, 0.16));
    }
    add += Math.round(Math.log10(1 + num(this.state.fame)) + p.me.standing / 30);
    b.supporters = Math.min(p.diet[b.house].total, b.supporters + Math.max(1, add));
    if (b.supporters >= b.need) {
      b.ready = true;
      if (inSession(p, day)) { b.stage = 'committee'; b.step = 'committee'; b.next = day + irnd(3, 6); b.log.push({ day, text: '国会に提出（議員立法）' }); }
    }
    return { ok: true, supporters: b.supporters, need: b.need, ready: !!b.ready, added: add };
  },
  advanceBills() { return advanceBillsImpl(this, ensurePol(this)); },
  vote(billId, choice) {
    const p = ensurePol(this);
    const b = p.diet.bills.find((x) => x.id === billId);
    if (!b) return 'その法案はない';
    if (!['yes', 'no', 'abstain'].includes(choice)) return '賛成・反対・棄権のどれか';
    if (!isNational(p.me)) return '国会議員ではない';
    if (b.kind === 'noconfidence' && p.me.office !== 'shugi') return '内閣不信任案は衆議院で採決される';
    p.me.votes[billId] = choice;
    return null;
  },
  noConfidence(opts = {}) {
    const p = ensurePol(this);
    const me = p.me;
    const day = today(this);
    const why = this.noConfidenceBlock(opts);
    if (why) return { ok: false, why };
    const myP = me.party || IND;
    const b = addBill(p, { title: '内閣不信任決議案', sponsor: 'member', by: 'player', party: myP, kind: 'noconfidence', stage: 'shugi', house: 'shugi', day, delay: 0 });
    me.votes[b.id] = 'yes';
    const v = houseVote(this, p, b, 'shugi');
    b.votes.shugi = { yes: v.yes, no: v.no, absent: v.absent, passed: v.passed };
    resolveNoConfidence(this, p, b, v);
    return { ok: true, billId: b.id, passed: v.passed, yes: v.yes, no: v.no, outcome: !v.passed ? null : p.diet.shugi.dissolved ? 'dissolve' : p.cabinet.pm === 'player' ? 'pending' : 'resign' };
  },
  // (2026-10 fix) why noConfidence(opts) is refused now (no side effects): null | reason. The motion is the
  // opposition's: never the PM or a minister against their own cabinet; a ruling member only with opts.rebel (API).
  noConfidenceBlock(opts = {}) {
    const p = ensurePol(this);
    const me = p.me;
    const day = today(this);
    if (me.office !== 'shugi') return '内閣不信任決議案を出せるのは衆議院議員だけ';
    if (me.posts.includes('pm')) return '総理は自分の内閣に不信任案を出さない（辞めるなら総辞職、信を問うなら衆議院の解散）';
    if (inCabinet(me)) return '大臣は内閣の一員。自分の内閣に不信任案は出さない（出すなら大臣を辞めてから）';
    if (!inSession(p, day)) return '国会の会期中でないと出せない';
    if (me.party && isRuling(p, me.party) && !(opts && opts.rebel)) return '与党の議員は不信任案を出さない（不信任案は野党が出すもの。出すなら離党してから）';
    if (p.diet.bills.some((b) => b.kind === 'noconfidence' && b.created >= (p.diet.session.start || 0) && b.stage !== 'shelved')) return 'この国会ではもう不信任案が採決された';
    const oppAll = Object.keys(p.diet.shugi.seats).filter((id) => id !== IND && !isRuling(p, id)).reduce((a, id) => a + num(p.diet.shugi.seats[id]), 0);
    const leads = me.party && p.parties[me.party] && (p.parties[me.party].leader === 'player' || me.standing >= 40);
    const supporters = leads ? oppAll : num(p.diet.shugi.seats[me.party || IND]);
    if (supporters < 50) return `賛成者が50人に届かない（${supporters}人）`;
    return null;
  },
  dissolve(reason = '') {
    const p = ensurePol(this);
    this.lastPoliticsError = null;
    if (p.cabinet.pm !== 'player') { this.lastPoliticsError = '衆議院を解散できるのは内閣総理大臣だけ'; return null; }
    if (p.diet.shugi.dissolved) { this.lastPoliticsError = 'すでに解散している'; return null; }
    if (p.cabinet.resigned) { this.lastPoliticsError = '総辞職を決めた内閣は、次の総理が決まるまでの職務を行うだけ'; return null; }
    // the house elected at a general election first meets in the 特別国会 (憲法54条), which names
    // the PM (70条): it cannot be dissolved before that, nor in the first days after the vote
    if (p.cabinet.pending && p.cabinet.pending.kind === 'special') { this.lastPoliticsError = '総選挙のあとの特別国会がまだ開かれていない（まず総理大臣の指名から）'; return null; }
    if (absOfDay(p, today(this)) - num(p.diet.shugi.last) < 10) { this.lastPoliticsError = '総選挙が終わったばかりで、解散する理由がない'; return null; }
    if (p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline') p.cabinet.pending = null;
    const e = dissolveImpl(this, p, reason || '総理大臣の判断');
    return e ? e.id : null;
  },
  // ext: the player PM resigns (内閣総辞職).
  // ext (hook for govt.js, A1): an NPC PM dissolves the 衆院 (憲法7条), e.g. after a key cabinet bill was voted down in the
  // 参院. -> election id | null (refused for a player PM, a caretaker cabinet, a dissolved house, before the 特別国会)
  npcDissolve(reason = '') { const p = ensurePol(this); if (p.cabinet.pm === 'player' || !p.cabinet.pm || p.cabinet.resigned || p.diet.shugi.dissolved || (p.cabinet.pending && p.cabinet.pending.kind === 'special')) return null; const e = dissolveImpl(this, p, reason || '総理大臣の判断'); return e ? e.id : null; },
  resignPM(reason = '') { const p = ensurePol(this); if (p.cabinet.pm !== 'player') return '総理大臣ではない'; if (p.cabinet.resigned) return 'すでに総辞職を決めている'; if (p.cabinet.pending && p.cabinet.pending.kind === 'ncDeadline') p.cabinet.pending = null; resignCabinet(this, p, reason || '総理の決断'); return null; },
  electPM() { const p = ensurePol(this); const r = electPMImpl(this, p); return r; },
  formCabinet(choices = {}) {
    const p = ensurePol(this);
    if (p.cabinet.pm !== 'player') return { ok: false, why: '組閣できるのは総理大臣だけ' };
    const me = p.me;
    const fy = fyNow(this);
    // regime.js g.regimeBarred (2026-10 fix): a barred former PM is not given a post (refused before anything changes)
    for (const [post, w] of Object.entries(choices.ministers || {})) if (w === 'player') { const bar = playerBarred(this, post); if (bar) return { ok: false, why: bar, post }; }
    if (Array.isArray(choices.partners)) {
      const ok = choices.partners.filter((id) => p.parties[id] && id !== me.party);
      // ext (regime.js, feature-detected): a party may refuse to govern with the player's regime (e.g. a real party
      // never joins a cabinet that took an authoritarian step). Refused before anything changes.
      if (typeof this.regimeCoalitionBlock === 'function') {
        for (const id of ok) {
          if ((p.cabinet.partyIds || []).includes(id)) continue; // already a partner: keeping it is not a new coalition
          let why = null;
          try { why = this.regimeCoalitionBlock(id, { core: me.party || undefined }); } catch (e) { console.error(e); why = null; }
          if (why) return { ok: false, why: String(why), party: id };
        }
      }
      p.cabinet.partyIds = [me.party, ...ok].filter(Boolean);
    }
    const posts = cabinetPosts(fy, p.flags);
    const M = {};
    const want = choices.ministers || {};
    for (const post of posts) {
      const w = want[post];
      if (w === 'player') { M[post] = 'player'; if (!me.posts.includes(post)) me.posts.push(post); continue; }
      if (w && p.npcs[w] && p.cabinet.partyIds.includes(p.npcs[w].party) && !Object.values(M).includes(w)) { M[post] = w; continue; }
      M[post] = null;
    }
    me.posts = me.posts.filter((x) => !(POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm' && M[x] !== 'player'));
    for (const post of posts) if (!M[post]) { const n = pickMinister(p, pickOne(p.cabinet.partyIds), M); n.posts.push(post); M[post] = n.id; }
    for (const [post, id] of Object.entries(p.cabinet.ministers)) if (id !== 'player' && p.npcs[id] && M[post] !== id) p.npcs[id].posts = p.npcs[id].posts.filter((x) => x !== post);
    p.cabinet.ministers = M;
    news(p, this, `${this.state.name}総理が閣僚を任命した`);
    emit(this, 'cabinet', { pm: 'player', partyIds: p.cabinet.partyIds, formed: today(this), reshuffle: !!choices.reshuffle });
    return { ok: true, ministers: { ...M }, partyIds: [...p.cabinet.partyIds] };
  },
  reshuffle(choices = {}) {
    const p = ensurePol(this);
    if (p.cabinet.pm === 'player') {
      const r = this.formCabinet({ ...choices, reshuffle: true });
      if (r.ok) { p.cabinet.approval = clamp(num(p.cabinet.approval) + rnd(1, 5), 3, 90); news(p, this, '内閣改造が行われた'); }
      return r;
    }
    reshuffleKeepPlayer(this, p);
    fillCabinet(this, p, { keepPlayer: true });
    p.cabinet.approval = clamp(num(p.cabinet.approval) + rnd(1, 4), 3, 90);
    news(p, this, '内閣改造が行われた');
    const o = offerPostToPlayer(this, p);
    return { ok: true, ministers: { ...p.cabinet.ministers }, offer: o || null };
  },
  approval() { return Math.round(num(ensurePol(this).cabinet.approval)); },
  // ext: the real-party rule in one place (see govIncludesRealParty above)
  govIncludesRealParty() { const p = this.state ? ensurePol(this) : null; return govIncludesRealParty(p); },
  partySupport(partyId) { const p = ensurePol(this); return Math.round(natSupport(p, partyId, fyNow(this)) * 1000) / 10; },
  politicsTick() { return politicsTick(this); },
  // (2026-10 fix; debug / tests) take this week's opinion poll now: recomputes ねじれ (flags.nejire), the approval and
  // its parts (cabinet.parts) from the seats and the state as they are -> the poll row
  politicsPollNow() { const p = ensurePol(this); return weeklyPoll(this, p); },
  addSecretFunds(n, source = '') {
    const p = ensurePol(this);
    const v = Math.max(0, Math.round(num(n)));
    p.me.secret += v;
    const lg = ledger(p, calYear(this));
    lg.secret += v;
    const log = p.me.secretLog || (p.me.secretLog = []);
    log.unshift({ day: today(this), amount: v, source: String(source || '') });
    if (log.length > 20) log.length = 20;
    return p.me.secret;
  },
  reportFunds(opts = {}) {
    const p = ensurePol(this);
    const me = p.me;
    const y = opts.year ?? calYear(this) - 1;
    if (me.reported[y] && !me.reported[y].auto) return { ok: false, why: `${y}年分はもう提出ずみ` };
    const lg = me.ledger[y] || { income: 0, expense: 0 };
    let corrected = 0;
    if (opts.includeSecret && me.secret > 0) {
      corrected = me.secret;
      me.funds += me.secret;
      lg.income = num(lg.income) + me.secret;
      me.secret = 0;
      me.reputation = clamp(me.reputation - 5, -100, 100);
      news(p, this, `${this.state.name}氏が政治資金収支報告書に、記載していなかった収入を書き加えた`);
    }
    me.reported[y] = { day: today(this), income: num(lg.income), expense: num(lg.expense), secretIncluded: !!corrected, corrected, auto: false };
    return { ok: true, year: y, income: num(lg.income), expense: num(lg.expense), corrected, text: `${y}年分の政治資金収支報告書を提出した（収入 ${fmtMoney(lg.income)}・支出 ${fmtMoney(lg.expense)}）` };
  },
  onPolitics(event, fn) { return onPolitics(event, fn); },

  // ---------------------------------------------------------------- ext
  attendDiet() {
    const p = ensurePol(this);
    const me = p.me;
    const day = today(this);
    const why = this.attendBlock();
    if (why) return { ok: false, why, bills: me.attend.last === day ? this.billsList({ house: me.office, today: true }) : undefined };
    this.state.stamina -= 5;
    me.attend.last = day;
    me.attend.days = num(me.attend.days) + 1;
    me.attend.absent = 0;
    me.standing = clamp(me.standing + gainTo(me.standing, 0.5), 0, 100);
    return { ok: true, bills: this.billsList({ house: me.office, today: true }), cabinet: inCabinet(me) };
  },
  // (2026-10 fix) why attendDiet() is not possible now (no side effects): null | reason
  attendBlock() {
    const p = ensurePol(this);
    const me = p.me;
    const day = today(this);
    if (!isNational(me)) return '国会議員ではない';
    if (!inSession(p, day)) return '国会は閉会中';
    if (me.attend.last === day) return '今日はもう出席した';
    if (num(this.state.stamina) < 5) return '体力が足りない';
    return null;
  },
  // (2026-10 fix) the player's attendance for the screens: { member, session, today (attended today), absent (days in a
  // row), days, missed, cabinet (the duty is 答弁), business (the house has business today: plenary / committee / 予算委員会),
  // reportAt (8: a streak this long is reported), text (one line) }
  attendance() {
    const p = ensurePol(this);
    const me = p.me;
    const day = today(this);
    const member = isNational(me);
    const session = inSession(p, day);
    const A = dietAgenda(p, day);
    const cab = inCabinet(me);
    const h = me.office;
    const business = member && session && (A.opening || (cab ? A.budget || A.plenary[h] > 0 : A.plenary[h] > 0 || dietBusy(A)));
    const att = num(me.attend && me.attend.last) === day;
    const absent = num(me.attend && me.attend.absent);
    const text = !member ? '国会議員ではない' : !session ? '国会は閉会中' : att ? '今日は出席ずみ' : `${business ? (cab ? '今日は答弁の予定がある' : '今日は本会議・委員会がある') : '今日は大きな日程なし'}${absent ? `・欠席${absent}日連続（8日で報道される）` : ''}`;
    return { member, session, today: att, absent, days: num(me.attend && me.attend.days), missed: num(me.attend && me.attend.missed), cabinet: cab, business: !!business, reportAt: 8, text };
  },
  // ext (round 4): why activity(kind) would be refused now (null = it would run; no side effects)
  activityBlock(kind) { return activityBlockImpl(this, ensurePol(this), kind); },
  activity(kind, opts = {}) {
    const p = ensurePol(this);
    const me = p.me;
    const A = ACTIVITIES[kind];
    const st = this.state;
    const day = today(this);
    const why0 = activityBlockImpl(this, p, kind);
    if (why0) return { ok: false, why: why0 };
    st.stamina -= A.stamina;
    // the same thing day after day wears thin (マンネリ): after 4 days in a row the gains shrink
    const sk0 = me.actStreak || (me.actStreak = {});
    const prev = sk0[kind];
    const streak = prev && num(prev.last) === day - 1 ? num(prev.n) + 1 : 1;
    sk0[kind] = { last: day, n: streak };
    const fresh = streak > 4 ? Math.max(0.4, 1 / (1 + 0.15 * (streak - 4))) : 1;
    me.lastAct[kind] = day;
    if (A.funds) { const f = Math.min(me.funds, A.funds); me.funds -= f; st.money -= A.funds - f; ledger(p, calYear(this)).expense += A.funds; }
    const sk = A.skill ? num(st.skills && st.skills[A.skill]) / 100 : 0.5;
    const q = clamp((opts.score != null ? num(opts.score) / 100 : 0.3 + sk * 0.7 + gauss() * 0.1) * (1 + Math.min(5, me.staff) * 0.04), 0, 1.3);
    const out = [];
    const sh = (n) => (Math.round(n * 10) / 10);
    if (A.local) { const d = gainTo(me.localSupport, A.local * (0.6 + q * 0.6) * fresh); me.localSupport = clamp(me.localSupport + d, 0, 100); out.push(`地元の支持 +${sh(d)}`); }
    if (A.rep) { let d = A.rep * (q - 0.2) * 1.5 * fresh; if (d > 0) d = gainTo(Math.max(0, me.reputation), d); d = sh(d); me.reputation = clamp(me.reputation + d, -100, 100); if (d) out.push(`評判 ${d > 0 ? '+' : ''}${d}`); }
    if (A.kouenkai) { const d = kouenkaiGain(p, A.kouenkai * fresh); me.kouenkai += d; out.push(`後援会 +${d}人`); }
    if (A.standing) { const d = gainTo(me.standing, A.standing * fresh); me.standing = clamp(me.standing + d, 0, 100); out.push(`党内の評価 +${sh(d)}`); }
    if (fresh < 1) out.push('（毎日同じことばかりで、効果がうすれてきた）');
    if (A.fame && this.addFame) { this.addFame(Math.round(A.fame * (0.5 + q)), true); out.push('知名度アップ'); }
    if (A.approval && (me.posts.includes('pm') || inCabinet(me))) p.cabinet.mood = clamp(num(p.cabinet.mood) + A.approval * (q - 0.3), -20, 20);
    if (kind === '国会で答弁') me.answers = num(me.answers) + (q >= 0.5 ? 1 : 0);
    // answering (the cabinet) or asking (a member) in the Diet counts as attending that day (2026-10 fix)
    if ((kind === '国会で答弁' || kind === '委員会で質問') && num(me.attend.last) !== day) { me.attend.last = day; me.attend.days = num(me.attend.days) + 1; me.attend.absent = 0; }
    // round 4: what was said (g.speak: the attitude the player chose, its 失言リスク, the gaffe chain). An older caller
    // that chose no attitude speaks in the player's usual way (the risk follows the talk skill and the day's quality).
    let speech = opts.speech && typeof opts.speech === 'object' ? opts.speech : null;
    if (A.gaffe && A.speech && !opts.speech) {
      const att = sk < 0.3 ? pickOne(['hagurakasu', 'tsuyoki']) : q < 0.45 ? 'hagurakasu' : 'teinei';
      let topic = defaultTopic(this, p, A.speech);
      if (topic === 'gaffe') topic = 'general';
      try { speech = speakImpl(this, p, A.speech, { attitude: att, topic, auto: true }); } catch (e) { console.error(e); speech = null; }
    }
    const gaffe = speech && speech.gaffe ? speech.gaffe : null;
    if (this.lifeTick) this.lifeTick({ hunger: -6, stress: 5, clean: -5 });
    return { ok: true, kind, quality: Math.round(q * 100), text: `${kind}をした。${out.join('・')}${gaffe && !opts.speech ? `\n…しかし、${gaffeQuote(gaffe)}が問題に！（${gaffeKindName(gaffe.kind, gaffe.year, true)}として報じられた）` : ''}`, gaffe: !!gaffe, speech: speech && !opts.speech ? speech : null };
  },
  // 政治資金パーティー. opts.unreported: 0..0.5 of the take left out of the report (裏金・違法).
  holdFundraiser(opts = {}) {
    const p = ensurePol(this);
    const me = p.me;
    const day = today(this);
    if (!me.office && !me.posts.length) return { ok: false, why: '政治家として活動していないと、パーティーは開けない' };
    // review: most members hold one or two a year (big names more); buyers are companies and
    // supporters who will not buy every month
    if (day - num(me.lastParty, -999) < 60) return { ok: false, why: `パーティーは年に2回くらいが限度（次は${dateLabel(this, num(me.lastParty) + 60)}ごろから）` };
    if (this.state.stamina < 15) return { ok: false, why: '体力が足りない' };
    this.state.stamina -= 15;
    me.lastParty = day;
    const O = OFFICES[me.office];
    const base = O ? (O.level === 'national' ? 350 : O.level === 'exec' ? 250 : 100) : 80;
    const big = me.posts.includes('pm') ? 1.8 : me.posts.some((x) => POSTS[x] && (POSTS[x].kind === 'cabinet' || POSTS[x].kind === 'party')) ? 1.4 : 1;
    const tickets = Math.round(base * (1 + Math.log10(1 + num(this.state.fame)) / 8) * big * (p.flags.moneyStrict ? 0.85 : 1) * rnd(0.8, 1.2));
    const price = Math.round(20000 / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1));
    const gross = tickets * price;
    const cost = Math.round(gross * 0.3);
    const net = gross - cost;
    const hide = Math.round(net * clamp(num(opts.unreported), 0, 0.5));
    me.funds += net - hide;
    const lg = ledger(p, calYear(this));
    lg.income += gross - hide;
    lg.expense += cost;
    lg.parties += 1;
    if (hide > 0) this.addSecretFunds(hide, '政治資金パーティーの収入の一部（不記載）');
    // the buyers' disclosure rule exists from 1993 (1992年改正); before that it is not mentioned
    const thr = partyTicketDisclosure(calYear(this));
    return { ok: true, tickets, gross, net, secret: hide, text: `政治資金パーティーを開いた。券 ${tickets.toLocaleString('ja-JP')}枚（1枚 ${fmtMoney(price)}）\n収入 ${fmtMoney(gross)}・経費 ${fmtMoney(cost)}${hide ? `\n（${fmtMoney(hide)}は報告書に書かない「裏金」にした…）` : ''}${thr ? `\n${protectYen(thr)}を超えて買った人の名前は収支報告書で公開される。` : ''}` };
  },
  collectDonations(opts = {}) {
    const p = ensurePol(this);
    const day = today(this);
    if (p.me.lastAct['献金集め'] === day) return { ok: false, why: '今日はもう寄付を募った' };
    const why = donationBlock(this, p);
    if (why) return { ok: false, why };
    if (this.state.stamina < 6) return { ok: false, why: '体力が足りない' };
    this.state.stamina -= 6;
    p.me.lastAct['献金集め'] = day;
    return donationsImpl(this, p, opts);
  },
  joinFaction(factionId) {
    const p = ensurePol(this);
    const me = p.me;
    const pt = p.parties[me.party];
    if (!pt) return 'まず政党に入る';
    const f = (pt.factions || []).find((x) => x.id === factionId);
    if (!f) return 'その派閥・グループはない';
    if (me.faction === f.id) return 'すでに入っている';
    if (me.faction) this.leaveFaction();
    me.faction = f.id;
    f.size = num(f.size) + 1;
    me.standing = clamp(me.standing + 3, 0, 100);
    return null;
  },
  leaveFaction() {
    const p = ensurePol(this);
    const me = p.me;
    const pt = p.parties[me.party];
    const f = pt && (pt.factions || []).find((x) => x.id === me.faction);
    if (!me.faction) return '派閥に入っていない';
    if (f) f.size = Math.max(0, num(f.size) - 1);
    me.faction = null;
    return null;
  },
  // ext: answer an offer (入閣・党役員). offerId null = the latest open one.
  respondOffer(offerId, yes = true) {
    const p = ensurePol(this);
    const me = p.me;
    const o = me.offers.find((x) => (offerId ? x.id === offerId : !x.answered) && !x.answered);
    if (!o) return '返事を待っている打診はない';
    o.answered = yes ? 'yes' : 'no';
    if (!yes) return null;
    const fy = fyNow(this);
    if (o.kind === 'post') {
      const bar = playerBarred(this, o.post); // regime.js (2026-10 fix)
      if (bar) { o.answered = 'no'; this.lastPoliticsError = bar; return bar; }
      if (!me.party || !isRuling(p, me.party) || !postExists(o.post, fy, p.flags)) return 'もう、その話はなくなっていた';
      const old = p.cabinet.ministers[o.post];
      if (old && old !== 'player' && p.npcs[old]) p.npcs[old].posts = p.npcs[old].posts.filter((x) => x !== o.post);
      p.cabinet.ministers[o.post] = 'player';
      if (!me.posts.includes(o.post)) me.posts.push(o.post);
      if (this.addFame) this.addFame(150, true);
      note(this, `（${postName(o.post, fy)}に就任した！）`);
      leaveShowsForCabinet(this, postName(o.post, fy));
      news(p, this, `${this.state.name}氏が${postName(o.post, fy)}に就任`);
      emit(this, 'cabinet', { pm: p.cabinet.pm, partyIds: p.cabinet.partyIds, joined: o.post });
    } else if (o.kind === 'partyPost') {
      const pt = p.parties[o.party];
      if (!pt || me.party !== o.party) return 'もう、その話はなくなっていた';
      const old = pt.posts[o.post];
      if (old && p.npcs[old]) p.npcs[old].posts = p.npcs[old].posts.filter((x) => x !== o.post);
      pt.posts[o.post] = 'player';
      if (!me.posts.includes(o.post)) me.posts.push(o.post);
      me.standing = clamp(me.standing + 10, 0, 100);
      note(this, `（${pt.name}の${postName(o.post, fy, pt.id)}に就任した！）`);
    }
    return null;
  },
  setCoalitionStance(stance) { const p = ensurePol(this); if (!['auto', 'accept', 'refuse'].includes(stance)) return 'auto / accept / refuse'; p.me.coalitionStance = stance; return null; },
  joinCoalition() {
    const p = ensurePol(this);
    const me = p.me;
    const pt = p.parties[me.party];
    if (!pt || pt.leader !== 'player') return '連立を決められるのは党首だけ';
    if (isRuling(p, pt.id)) return 'すでに与党だ';
    if (!partySeats(p, pt.id)) return '国会に議席がない';
    const core = cabinetPartyOfPM(p);
    const A = p.parties[core] && p.parties[core].ideology, B = pt.ideology;
    const dist = A ? Math.abs(A.econ - B.econ) + Math.abs(A.social - B.social) + Math.abs(A.security - B.security) : 9;
    if (dist > 3.2) return '政策が違いすぎて、連立を断られた';
    // ext (regime.js, feature-detected): a real core does not take in the party of a player who took authoritarian steps
    if (typeof this.regimeCoalitionBlock === 'function') {
      let why = null;
      try { why = this.regimeCoalitionBlock(core, { core, partner: pt.id }); } catch (e) { console.error(e); why = null; }
      if (why) return String(why);
    }
    p.cabinet.partyIds.push(pt.id);
    news(p, this, `${pt.name}が連立政権に加わった`);
    offerPostToPlayer(this, p, true);
    emit(this, 'cabinet', { pm: p.cabinet.pm, partyIds: p.cabinet.partyIds, coalition: 'joined' });
    return null;
  },
  leaveCoalition() {
    const p = ensurePol(this);
    const me = p.me;
    const pt = p.parties[me.party];
    if (!pt || pt.leader !== 'player') return '連立を決められるのは党首だけ';
    if (!isRuling(p, pt.id) || cabinetPartyOfPM(p) === pt.id) return '連立の相手ではない';
    p.cabinet.partyIds = p.cabinet.partyIds.filter((x) => x !== pt.id);
    p.flags.nejire = nejireNow(p);
    for (const [post, id] of Object.entries(p.cabinet.ministers)) if (id === 'player') { me.posts = me.posts.filter((x) => x !== post); const m = pickMinister(p, cabinetPartyOfPM(p), p.cabinet.ministers); m.posts.push(post); p.cabinet.ministers[post] = m.id; }
    p.cabinet.approval = clamp(num(p.cabinet.approval) - 3, 3, 90);
    news(p, this, `${pt.name}が連立政権から離脱した`);
    return null;
  },
  // ext: 私設秘書 (the 3 公設秘書 of a Diet member are paid by the state). delta: +1 / -1.
  // Each one costs STAFF_COST a month from 政治資金 and helps activities / campaigns (up to 5).
  hireStaff(delta = 1) {
    const p = ensurePol(this);
    const me = p.me;
    if (!me.office && delta > 0) return '政治家として活動していないと、秘書を雇う意味がない';
    const n = clamp(me.staff + Math.round(num(delta)), 0, 10);
    if (n > me.staff && me.funds + this.state.money < STAFF_COST) return `秘書の給料（月${fmtMoney(STAFF_COST)}）が払えない`;
    me.staff = n;
    return null;
  },
  politicalScandal(kind, opts = {}) { return scandalImpl(this, ensurePol(this), kind, opts); },
  resignOffice(reason = '辞職') { return loseOffice(this, ensurePol(this), reason); },
  // ext: 失職 for any reason (crime.js calls it with { by: 'justice' }); the seat goes to a by-election.
  loseOffice(reason = '失職', opts = {}) { return loseOffice(this, ensurePol(this), reason, opts); },
  resignPost(post, reason = '') { return resignPostImpl(this, ensurePol(this), post, reason); },
  appointPartyPost(post, who = 'player') {
    const p = ensurePol(this);
    const pt = p.parties[p.me.party];
    if (!pt || pt.leader !== 'player') return '党役員を決められるのは党首だけ';
    if (!PARTY_POST_ORDER.includes(post)) return 'その役職はない';
    const old = pt.posts[post];
    if (old === 'player') p.me.posts = p.me.posts.filter((x) => x !== post);
    else if (old && p.npcs[old]) p.npcs[old].posts = p.npcs[old].posts.filter((x) => x !== post);
    if (who === 'player') { pt.posts[post] = 'player'; if (!p.me.posts.includes(post)) p.me.posts.push(post); }
    else if (p.npcs[who] && p.npcs[who].party === pt.id) { pt.posts[post] = who; p.npcs[who].posts.push(post); }
    else return 'その人は党員ではない';
    return null;
  },
  transferPartyFunds(amount) {
    const p = ensurePol(this);
    const pt = p.parties[p.me.party];
    const n = Math.round(num(amount));
    if (!pt || pt.leader !== 'player') return '党の資金を動かせるのは党首だけ';
    if (n <= 0 || n > num(pt.funds)) return '党の資金が足りない';
    pt.funds -= n;
    p.me.funds += n;
    ledger(p, calYear(this)).income += n;
    return null;
  },
  // ext: invite Diet members to the player's party (引き抜き). -> { ok, joined: [{ name, from, house }] }
  recruitMembers(opts = {}) {
    const p = ensurePol(this);
    const me = p.me;
    const pt = p.parties[me.party];
    const day = today(this);
    if (!pt || pt.leader !== 'player') return { ok: false, why: '自分の政党の党首でないとできない', joined: [] };
    if (me.lastAct.recruit === day) return { ok: false, why: '今日はもう声をかけた', joined: [] };
    // review: members change parties rarely — about one a month at most, except around a 解散
    // (when the old labels matter less) — so a party grows mainly by winning elections
    const shakeup = p.diet.shugi.dissolved || p.elections.upcoming.some((x) => x.kind === 'shugi' && x.status !== 'done' && x.day - day < 20);
    const gap = shakeup ? 4 : 3 * MONTH_DAYS;
    if (day - num(me.lastRecruitJoin, -999) < gap) return { ok: false, why: `議員の移籍は、そうたびたびは起きない（次の声かけは${dateLabel(this, num(me.lastRecruitJoin) + gap)}ごろから）`, joined: [] };
    if (this.state.stamina < 10) return { ok: false, why: '体力が足りない', joined: [] };
    this.state.stamina -= 10;
    me.lastAct.recruit = day;
    const offer = Math.min(num(opts.funds), me.funds + num(pt.funds));
    if (offer > 0) { const f = Math.min(num(pt.funds), offer); pt.funds -= f; me.funds -= offer - f; }
    // Diet members rarely change parties: the pull grows with the party's support, the leader's
    // fame and reputation, a seat of one's own and money for the next campaign
    const pull = 0.5 * (0.02 + Math.min(0.08, Math.log10(1 + num(this.state.fame)) * 0.015) + natSupport(p, pt.id, fyNow(this)) * 1.5 + Math.min(0.1, offer / 1e8) + Math.max(0, me.reputation) / 1500 + (isNational(me) ? 0.02 : 0)) * (shakeup ? 1.6 : 1);
    const joined = [];
    if (Math.random() < pull) {
      const house = Math.random() < 0.6 ? 'shugi' : 'sangi';
      const H = p.diet[house];
      const A = pt.ideology || { econ: 0, social: 0, security: 0 };
      const dist = (id) => { const B = (p.parties[id] && p.parties[id].ideology) || A; return Math.abs(A.econ - B.econ) + Math.abs(A.social - B.social) + Math.abs(A.security - B.security); };
      // independents first; then members of parties close in policy (a far-off party's members do
      // not come); a member elected by 比例 rarely moves (国会法109条の2: they would lose the seat)
      const pool = Object.keys(H.seats).filter((id) => id !== pt.id && num(H.seats[id]) > (id === IND ? 0 : 2) && (id === IND || (dist(id) < 2.6 && (!isRuling(p, id) || Math.random() < 0.3))));
      const w = (id) => num(H.seats[id]) * (id === IND ? 3 : 0.35 * Math.max(0.1, 1 - dist(id) / 2.6));
      const wsum = pool.reduce((a, id) => a + w(id), 0);
      let roll = Math.random() * wsum, from = null;
      for (const id of pool) { roll -= w(id); if (roll <= 0) { from = id; break; } }
      if (!from) from = pool[0];
      const pr = from && from !== IND && Math.random() < 0.4; // drew a 比例 member
      if (from && !(pr && Math.random() < 0.85)) {
        H.seats[from]--;
        H.seats[pt.id] = num(H.seats[pt.id]) + 1;
        H.total = sumSeats(H.seats);
        if (house === 'sangi') { const c = p.diet.sangi.classes.find((x) => num(x.seats[from]) > 0); if (c) { c.seats[from]--; c.seats[pt.id] = num(c.seats[pt.id]) + 1; } }
        const n = newNpc(p, { party: pt.id, office: house, house, wins: irnd(1, 5) });
        pt.members = num(pt.members) + 1;
        joined.push({ name: n.name, from, house });
        me.lastRecruitJoin = day;
      }
    }
    if (joined.length) news(p, this, `${joined.map((j) => j.name).join('・')}氏が${pt.name}に入党`);
    return { ok: true, joined, status: partyStatusOf(p, pt.id) };
  },
  policyBlock(policyId, params) { const p = ensurePol(this); return policyBlock(p, policyId, params ? sanitizeParams(POLICIES[policyId] || { defaults: {} }, params) : null, calYear(this), fyNow(this)); },
  // ext: what a policy would do -> { name, area, cost, segments, economy, alignment: { party: 0..1 }, block }
  policyPreview(policyId, params) {
    const p = ensurePol(this);
    const pl = POLICIES[policyId];
    if (!pl) return null;
    const year = calYear(this);
    const pr = sanitizeParams(pl, params);
    const fx = pl.effects(pr, p.era, ctxOf(p, year));
    const al = {};
    for (const id of Object.keys(p.parties)) al[id] = Math.round(alignment(p, id, policyId) * 100) / 100;
    return { id: policyId, name: pl.name, area: pl.area, desc: pl.desc, params: pr, cost: pl.costOf(pr, ctxOf(p, year)), segments: fx.segments, economy: fx.economy, alignment: al, block: policyBlock(p, policyId, pr, year, fyNow(this)), kind: pl.kind, billKind: pl.billKind || pl.kind, title: billTitle(pl, pr) };
  },
  billsList(filter = {}) {
    const p = ensurePol(this);
    const day = today(this);
    // today: what is on the house's agenda now — bills waiting for the plenary vote (it is taken at
    // the next sitting, with the votes members cast today) and committee work due by then
    return p.diet.bills.filter((b) => (!filter.house || b.house === filter.house) && (!filter.mine || b.by === 'player') && (!filter.pending || !['enacted', 'rejected', 'shelved'].includes(b.stage)) && (!filter.today || (['committee', 'shugi', 'sangi'].includes(b.stage) && (b.stage === b.house || num(b.next) <= day + 1))));
  },
  upcomingElections() {
    const p = ensurePol(this);
    return p.elections.upcoming.filter((e) => e.status !== 'done').map((e) => ({ id: e.id, kind: e.kind, label: e.label, day: e.day, koji: e.koji, status: e.status, date: dateLabel(this, e.day), kojiDate: dateLabel(this, e.koji), declared: !!myDecl(e), party: e.party, district: e.district, office: officeOfElection(e), newsOnly: !!ELECTION_KINDS[e.kind].newsOnly }));
  },
  myElection() { const p = ensurePol(this); return p.elections.upcoming.find((e) => myDecl(e)) || null; },
  npcName(id) { const p = ensurePol(this); return id === 'player' ? this.state.name : (p.npcs[id] && p.npcs[id].name) || ''; },
  partyName(id, short = false) { const p = ensurePol(this); if (id === IND || !id) return '無所属'; const pt = p.parties[id] || PARTY_DEFS[id]; return pt ? (short ? pt.short : pt.name) : pname(p, id); },
  postLabel(post) { const p = ensurePol(this); return postName(post, fyNow(this), p.me.party); },
  triggerShock(kind) { return shockImpl(this, ensurePol(this), kind); },
  // ext: one object with what a screen needs.
  politicsSummary() {
    const p = ensurePol(this);
    const fy = fyNow(this);
    const C = p.cabinet;
    const E = p.economy;
    const me = p.me;
    const seats = (h) => Object.entries(p.diet[h].seats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: pname(p, id), n, color: p.parties[id] ? p.parties[id].color : '#999999', ruling: isRuling(p, id) }));
    return {
      date: polDate(this), era: p.era,
      me: { office: me.office, officeName: me.office ? OFFICES[me.office].label : '民間人', party: me.party, partyName: this.partyName(me.party), posts: me.posts.map((x) => postName(x, fy, me.party)), district: me.district, funds: me.funds, secret: me.secret, reputation: Math.round(me.reputation), localSupport: Math.round(me.localSupport), standing: Math.round(me.standing), wins: me.wins, losses: me.losses, faction: me.faction, candidacy: me.candidacy, offers: me.offers.filter((o) => !o.answered) },
      cabinet: { pm: C.pm, pmName: this.npcName(C.pm), parties: C.partyIds.map((id) => pname(p, id)), partyIds: [...C.partyIds], approval: Math.round(C.approval), formed: C.formed, ministers: cabinetPosts(fy, p.flags).map((post) => ({ post, name: postName(post, fy), who: C.ministers[post] || null, whoName: this.npcName(C.ministers[post]) })) },
      diet: { shugi: { total: p.diet.shugi.total, seats: seats('shugi'), system: p.diet.shugi.system, dissolved: !!p.diet.shugi.dissolved }, sangi: { total: p.diet.sangi.total, seats: seats('sangi') }, session: p.diet.session ? { ...p.diet.session } : null, nejire: !!p.flags.nejire },
      economy: { growth: Math.round(E.growth * 10) / 10, inflation: Math.round(E.inflation * 10) / 10, unemployment: Math.round(E.unemployment * 10) / 10, debtRatio: Math.round(E.debtRatio), yen: Math.round(E.yen), nikkei: Math.round(E.nikkei), gdp: Math.round(E.gdp), taxRate: E.taxRate, budget: { ...E.budget } },
      support: Object.keys(p.parties).map((id) => ({ id, name: pname(p, id), pct: this.partySupport(id) })).sort((a, b) => b.pct - a.pct),
      upcoming: this.upcomingElections(), news: p.news.slice(0, 12),
    };
  },
  politicsMenu() { return politicsMenu(this); },
  // ---- round 4: 発言・態度・失言 (see the section above)
  speechOptions(venue, opts = {}) { return speechOptionsImpl(this, ensurePol(this), venue, opts || {}); },
  speechRisk(venue, attitude, opts = {}) {
    const p = ensurePol(this);
    const topic = SPEECH_TOPICS[opts && opts.topic] ? opts.topic : defaultTopic(this, p, venue);
    const risky = attitude === 'risky' || !!(opts && opts.risky);
    return { topic, ...speechRiskImpl(this, p, 'player', venue, risky ? 'honne' : attitude, topic, { risky }) };
  },
  speechBlock(venue) { return speechBlockImpl(this, ensurePol(this), venue); },
  speak(venue, opts = {}) {
    const p = ensurePol(this);
    const why = opts && opts.force ? null : speechBlockImpl(this, p, venue);
    if (why) return { ok: false, why };
    return speakImpl(this, p, venue, opts || {});
  },
  gaffes(opts = {}) {
    const p = ensurePol(this);
    const S = speechState(p);
    let L = S.gaffes.slice().reverse();
    if (opts.who === 'npc') L = L.filter((r) => r.who !== 'player'); else if (opts.who) L = L.filter((r) => r.who === opts.who);
    if (opts.active) L = L.filter((r) => !r.done);
    const year = calYear(this);
    return L.slice(0, opts.n || 40).map((r) => ({ ...r, steps: { ...r.steps }, log: r.log.slice(), motion: r.motion ? { ...r.motion } : null, kindName: gaffeKindName(r.kind, r.year || year), kindShort: gaffeKindName(r.kind, r.year || year, true), venueName: venueName(r.venue, year), stageName: STAGE_NAME[r.stage] || r.stage, quote: gaffeQuote(r), outcomeName: r.outcome ? { chinka: '沈静化', jinin: '辞任', koutetsu: '更迭' }[r.outcome] || r.outcome : null }));
  },
  gaffeOptions(id) { const p = ensurePol(this); const r = speechState(p).gaffes.find((x) => x.id === id && x.who === 'player'); return gaffeOptionsImpl(this, p, r); },
  gaffeRespond(id, kind, opts = {}) { return gaffeRespondImpl(this, ensurePol(this), id, kind, opts || {}); },
  npcPersona(id) {
    const p = ensurePol(this);
    const n = p.npcs[id];
    if (!n) return null;
    const k = personaOf(n, calYear(this));
    return { key: k, ...PERSONAS[k], gaffeShown: npcGaffeOK(n) };
  },
  // ---- round 4: 復興担当大臣
  fukko() { return fukkoStatusImpl(this, ensurePol(this)); },
  fukkoCandidates() { return fukkoCandidatesImpl(this, ensurePol(this)); },
  appointFukkoMinister(who = 'auto') { return appointFukkoImpl(this, ensurePol(this), who); },
  fukkoAppointBlock() { return fukkoAppointBlock(this, ensurePol(this)); },
  fukkoAction(kind, opts = {}) { return fukkoActionImpl(this, ensurePol(this), kind, opts || {}); },
  fukkoWorkBlock(kind) { return fukkoWorkBlock(this, ensurePol(this), kind); },
  // ext (review): why an entertainment job is not possible now for political reasons (選挙期間中の
  // 候補者・在任中の大臣) -> null | text. kind: 'job' | 'regular'; def: the job def ({ id, medium }).
  politicsRefusal(kind = 'job', def = {}) { return politicsRefusalImpl(this, kind, def); },
};

// ================================================================ R5-D: 党内の権力争い・内部紛争・公約・外交スタンス・法律制定
// The engine is in politics_intra.js (factions, 倒閣運動, moves), politics_conflict.js (conflicts, events, stances),
// politics_pledge.js (manifesto, 選挙予測) and politics_law.js (the bill studio and the legislation record). They get the
// helpers below through one context object, so none of them imports this file. Their g.* methods are merged into `methods`.
let IDEO_MOD = null;
if (typeof document !== 'undefined') import('./ideology.js').then((m) => { IDEO_MOD = m; }).catch(() => { IDEO_MOD = null; });
const INTRA = (() => {
  const X = {
    clamp, num, rnd, irnd, pickOne, gauss, YEAR_DAYS, ERAS, PARTY_DEFS, POSTS, PARTY_POST_ORDER, ELECTION_KINDS, POLICIES, POLICY_AREAS, SEGMENTS, SEGMENT_ORDER,
    fmtMoney, news, note, phoneNews, emit, newNpc, pickMinister, partySeats, isRulingParty: isRuling, cabinetPartyOfPM, leaderRaceSoon, stepDownLeader, resignCabinet,
    leavePartyImpl, seatMove, makeParty, refreshOpinion, addSupport, addSupportAll, natSupport, postName, dateLabel, polDate, calYear, fyNow, ensurePol, alignment, partyStance,
    sanitizeParams, ctxOf, billTitle, nationalShares, alloc, dhondt, prBlocks, shugiRules, segWeights, absOfDay: (p, d) => absOfDay(p, d), dayOfAbs: (p, a) => dayOfAbs(p, a), agendaParams,
    isNational, inSession,
    policyOk: (g, p, id) => !policyBlock(p, id, null, calYear(g), fyNow(g)),
    policyBlockFor: (p, id, params, g) => policyBlock(p, id, params, calYear(g), fyNow(g)),
    isGovtMatter: (p, pl, year) => !!(pl && (agendaFor(year).includes(pl.id) || (pl.ministry && num(pl.cost) !== 0))),
    policyAxes: (id) => (IDEO_MOD && IDEO_MOD.policyAxes ? IDEO_MOD.policyAxes(id) : null),
    politicalScandal: (g, p, kind, opts) => scandalImpl(g, p, kind, opts),
    dissolveNpc: (g, p, why) => dissolveImpl(g, p, why),
    retireParty: (g, p, id, why) => retireParty(g, p, id, why),
  };
  const H = installIntra(X);
  installConflict(X);
  installPledge(X);
  installLaw(X);
  // [R11-P] 政治家AI: the agent layer (politics_ai.js) gets the helpers it acts through; listeners route the game's events to it
  Object.assign(X, { makeVacancy, npcStepDown, offerPostToPlayer, prefShort, PREFECTURES, fillCabinet, ideoOf: null });
  // (globalThis.__POLITICS_AI_OFF = true before the import switches the agent layer off: the old dice come back — for A/B tests only)
  H.ai = globalThis.__POLITICS_AI_OFF ? null : installAI(X, H);
  X.ai = H.ai;
  if (H.ai) Object.assign(H.methods, H.ai.methods);
  // the player's own acts are remembered by the people they touch: the moves of the 党内 screen, the party posts they hand out
  if (H.ai) {
    const ia = H.methods.intraAct; H.methods.intraAct = function (kind, target, opts) { const r = ia.call(this, kind, target, opts); try { H.ai.onPlayerMove(this, ensurePol(this), kind, target || {}, r); } catch (e) { console.error(e); } return r; };
    const ap = methods.appointPartyPost; methods.appointPartyPost = function (post, who) { const r = ap.call(this, post, who); if (!r && who && who !== 'player') { try { H.ai.onAppoint(this, ensurePol(this), post, who); } catch (e) { console.error(e); } } return r; };
  }
  onPolitics('election', (g, d) => { const p = pol0(g); if (p && H.ai) try { H.ai.onElection(g, p, d); } catch (e) { console.error(e); } });
  onPolitics('cabinet', (g, d) => { const p = pol0(g); if (p && H.ai) try { H.ai.onCabinet(g, p, d); } catch (e) { console.error(e); } });
  onPolitics('scandal', (g, d) => { const p = pol0(g); if (p && H.ai) try { H.ai.onScandal(g, p, d); } catch (e) { console.error(e); } });
  onPolitics('bill', (g, d) => { const p = pol0(g); if (p && H.ai) try { H.ai.onBill(g, p, d); } catch (e) { console.error(e); } });
  H.tickAll = (g, p, day, abs) => {
    H.tick(g, p, day, abs);
    H.pledge.pledgeTick(g, p, day);
    H.law.record(g, p);
  };
  onPolitics('election', (g, d) => { const p = pol0(g); if (!p) return; try { H.onElectionDone(g, p, d); H.pledge.onElectionDone(g, p, d); } catch (e) { console.error(e); } });
  onPolitics('cabinet', (g, d) => { const p = pol0(g); if (p) try { H.onCabinet(g, p, d); } catch (e) { console.error(e); } });
  onPolitics('dissolve', (g) => { const p = pol0(g); if (p) try { H.onDissolve(g, p); } catch (e) { console.error(e); } });
  onPolitics('enacted', (g) => { const p = pol0(g); if (p) try { H.pledge.onEnacted(g, p); } catch (e) { console.error(e); } });
  onPolitics('party', (g, d) => { const p = pol0(g); if (p) try { H.onPartyFounded(g, p, d); } catch (e) { console.error(e); } });
  return H;
})();
Object.assign(methods, INTRA.methods);

export function installPolitics(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) {
    Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
  }
  // review: the two careers meet. Media jobs (and regular TV / radio shows, which run through
  // job()) are refused during the player's official campaign and while in the cabinet; a media job
  // on a Diet day without attending is noticed the next morning.
  const wrap = (name, make) => {
    const orig = proto[name];
    if (typeof orig !== 'function' || orig.__politics) return;
    const w = make(orig);
    w.__politics = true;
    proto[name] = w;
  };
  wrap('job', (orig) => async function (def) {
    const why = this.state ? politicsRefusalImpl(this, /^regular_/.test(String((def && def.id) || '')) ? 'regular' : 'job', def || {}) : null;
    if (why) { await this.say(why); return null; }
    const r = await orig.call(this, def);
    if (r && this.state) { try { afterMediaJob(this, def || {}); } catch (e) { console.error(e); } }
    return r;
  });
}

// ================================================================ minimal text UI (fallback)
// g.politicsMenu(): the whole API through g.ask / g.list, usable before politics_ui.js exists
// (politics_ui.js may replace it and the phone app below by registering the same app id).
const pct = (v) => `${Math.round(num(v) * 10) / 10}%`;
const L = (x, y, w = 260) => ({ x, y, w, px: true });
async function sayLines(g, lines, opts = {}) {
  const pages = [];
  for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3).join('\n'));
  if (pages.length) await g.say(pages, opts);
}
async function politicsMenu(g) {
  for (let guard = 0; guard < 60; guard++) {
    const p = g.pol();
    const d = polDate(g);
    const me = p.me;
    const offers = me.offers.filter((o) => !o.answered);
    const items = ['いまの政治', '選挙', '政党', '国会', '内閣', '政治資金', '議員の活動', 'ニュース', offers.length ? `打診への返事（${offers.length}）` : null, 'とじる'].filter(Boolean);
    const i = await g.list({ title: `政治 ${d.short}`, items, ...L(8, 52, 230), describe: (k) => [
      '内閣・国会の議席・経済のいま', '選挙の予定・立候補・選挙運動', '政党に入る・新党をつくる・派閥', '法案を出す・採決・出席・不信任案', '閣僚の顔ぶれ・解散・内閣改造',
      '政治資金・パーティー・収支報告', '地元回りや委員会での質問', '最近の政治ニュース', '入閣・党役員の打診', '',
    ][['いまの政治', '選挙', '政党', '国会', '内閣', '政治資金', '議員の活動', 'ニュース', '打診', 'とじる'].findIndex((x) => String(items[k] || '').startsWith(x))] || '' });
    const pick = items[i];
    if (i < 0 || !pick || pick === 'とじる') return;
    if (pick === 'いまの政治') await menuOverview(g);
    else if (pick === '選挙') await menuElections(g);
    else if (pick === '政党') await menuParties(g);
    else if (pick === '国会') await menuDiet(g);
    else if (pick === '内閣') await menuCabinet(g);
    else if (pick === '政治資金') await menuMoney(g);
    else if (pick === '議員の活動') await menuActivities(g);
    else if (pick === 'ニュース') await sayLines(g, p.news.slice(0, 9).map((n) => `・${n.text}`.slice(0, 36)).concat(p.news.length ? [] : ['（まだニュースはない）']));
    else if (pick.startsWith('打診')) {
      const o = offers[0];
      const j = await g.ask(`${o.kind === 'post' ? '総理' : '党首'}から「${postName(o.post, fyNow(g), o.party || p.me.party)}」への就任を打診されている。`, ['引き受ける', 'ことわる']);
      const why = g.respondOffer(o.id, j === 0);
      if (why) await g.say(why);
    }
    if (g.auto && guard > 3) return;
  }
}
async function menuOverview(g) {
  const s = g.politicsSummary();
  const p = g.pol();
  const C = s.cabinet;
  const E = s.economy;
  const top = (list) => list.slice(0, 4).map((x) => `${x.name}${x.n}`).join('・');
  await sayLines(g, [
    s.date.label,
    `${C.pmName || '（不在）'}内閣　支持率 ${C.approval}%`,
    `与党：${C.parties.join('・') || 'なし'}`,
    `衆議院（${s.diet.shugi.total}）${top(s.diet.shugi.seats)}`,
    `参議院（${s.diet.sangi.total}）${top(s.diet.sangi.seats)}`,
    s.diet.session ? `${s.diet.session.kind}の会期中` : '国会は閉会中',
    `成長率 ${pct(E.growth)}・物価 ${pct(E.inflation)}・失業率 ${pct(E.unemployment)}`,
    `1ドル=${protectYen(E.yen)}・日経平均 ${protectYen(E.nikkei)}`,
    `国の借金 GDPの${E.debtRatio}%・消費税 ${E.taxRate}%`,
    `政党支持率：${s.support.slice(0, 4).map((x) => `${x.name}${x.pct}%`).join('・')}`,
    `あなた：${s.me.officeName}${s.me.partyName && s.me.party ? `（${s.me.partyName}）` : '（無所属）'}`,
    `評判 ${s.me.reputation}・地元の支持 ${s.me.localSupport}・政治資金 ${fmtMoney(s.me.funds)}`,
  ]);
  void p;
}
async function menuElections(g) {
  const myParty = g.pol().me.party;
  const list = g.upcomingElections().filter((e) => !e.newsOnly && (e.kind !== 'sosaisen' || e.party === myParty));
  if (!list.length) { await g.say('いま予定されている選挙はない。'); return; }
  const i = await g.list({ title: '選挙の予定', items: list.map((e) => ({ label: e.label.slice(0, 18), right: e.date.replace(/^\d+年/, '') })), ...L(8, 52, 330), describe: (k) => `${list[k].kojiDate}${list[k].kind === 'shugi' || list[k].kind === 'sangi' ? '公示' : '告示'}・${list[k].date}投票${list[k].declared ? '（立候補ずみ）' : ''}` });
  if (i < 0) return;
  const e = g.pol().elections.upcoming.find((x) => x.id === list[i].id);
  if (!e) return;
  const d = myDecl(e);
  if (!d) {
    const off = officeOfElection(e);
    const why = e.kind === 'sosaisen' ? null : g.eligible(off, { day: e.day });
    if (why) { await g.say(why); return; }
    const p = g.pol();
    const opts = ['無所属で立候補', p.me.party ? '公認をもらって立候補' : null, 'やめておく'].filter(Boolean);
    const dep = e.kind === 'sosaisen' ? 0 : g.depositInternal(off);
    const j = await g.ask(`${e.label}に立候補する？${dep ? `\n供託金 ${fmtMoney(dep)}（得票が少ないと没収）` : ''}`, opts);
    if (opts[j] === 'やめておく' || j < 0) return;
    let party = null, proportional = false;
    if (opts[j].startsWith('公認')) {
      if (e.kind === 'shugi' && shugiRules(calYear(g, e.day), p.flags).system === 'heiritsu') proportional = [true, false, 'only'][Math.max(0, await g.ask('どこで立候補する？', ['小選挙区（比例と重複）', '小選挙区だけ', '比例代表だけ']))];
      if (e.kind === 'sangi') proportional = (await g.ask('どちらで立候補する？', ['東京都選挙区', '比例代表'])) === 1;
      const r = g.requestNomination(e.id, { proportional });
      if (!r.ok) { await g.say(r.why); return; }
      party = p.me.party;
    }
    const why2 = g.declareCandidacy(e.id, { party: party || null, proportional });
    await g.say(why2 || `${e.label}に立候補した！\n${e.kind === 'sosaisen' ? '' : `${dateLabel(g, e.koji)}から選挙運動ができる。`}`);
    return;
  }
  const acts = [...Object.keys(CAMPAIGN_ACTIONS), '情勢を聞く', '投票する', 'もどる'];
  for (let k = 0; k < 8; k++) {
    const j = await g.list({ title: '選挙運動', items: acts, ...L(8, 52, 200), describe: (x) => (CAMPAIGN_ACTIONS[acts[x]] ? CAMPAIGN_ACTIONS[acts[x]].desc : '') });
    if (j < 0 || acts[j] === 'もどる') return;
    if (acts[j] === '情勢を聞く') { const f = g.electionForecast(e.id); await g.say(f ? `情勢調査：当選の見込み ${Math.round(f.chance * 100)}%\n予想得票 ${f.votes.toLocaleString('ja-JP')}票・${f.rank}位前後（定数${f.seats}）` : '比例代表の順位は、党と全国の得票しだいだ。'); continue; }
    if (acts[j] === '投票する') { const w = g.castVote(e.id, 'self'); await g.say(w || '投票した。'); continue; }
    const r = await g.campaign(acts[j], { electionId: e.id, score: 60 });
    await g.say(r.ok ? r.text : r.why);
    if (g.auto) return;
  }
}
async function menuParties(g) {
  const p = g.pol();
  const ids = Object.keys(p.parties);
  const items = ids.map((id) => ({ label: p.parties[id].name, right: `${partySeats(p, id)}議席` })).concat([{ label: '新党をつくる' }, { label: p.me.party ? '離党する' : '（無所属）', disabled: !p.me.party }, { label: '派閥・グループ', disabled: !p.me.party }, { label: 'もどる' }]);
  const i = await g.list({ title: '政党', items, ...L(8, 52, 300), describe: (k) => (k < ids.length ? `支持率 ${g.partySupport(ids[k])}%` : '') });
  if (i < 0 || i === items.length - 1) return;
  if (i < ids.length) {
    const pt = p.parties[ids[i]];
    await sayLines(g, [pt.name, ...splitText(pt.desc, 34).slice(0, 4), `衆${num(p.diet.shugi.seats[pt.id])}・参${num(p.diet.sangi.seats[pt.id])}・支持率 ${g.partySupport(pt.id)}%`]);
    if (p.me.party !== pt.id && !pt.isPlayers) {
      const j = await g.ask(`${pt.name}に入党する？\n党費 年${fmtMoney(g.partyFee())}（所持金 ${fmtMoney(g.state.money)}）`, ['入党する', 'やめておく']);
      if (j === 0) { const w = g.joinParty(pt.id); await g.say(w || `${pt.name}に入党した！`); }
    }
    return;
  }
  const label = items[i].label;
  if (label === '新党をつくる') {
    let name = null;
    try { const m = await import('./textinput.js'); name = await m.askText(g, { title: '党の名前', value: 'ドット未来党', max: 12 }); } catch (e) { name = 'ドット未来党'; }
    if (!name) return;
    const areas = ['economy', 'welfare', 'childcare', 'diplomacy', 'regional', 'admin', 'environment', 'culture'];
    const k = await g.list({ title: 'いちばん大事な分野', items: areas.map((a) => POLICY_AREAS[a].name), ...L(8, 52, 220) });
    const platform = POLICY_ORDER.filter((id) => POLICIES[id].area === areas[Math.max(0, k)] && POLICIES[id].kind === 'law').slice(0, 4);
    const id = g.foundParty({ name, short: name.replace(/党$/, '').slice(0, 4) || name, color: '#e05a8a', platform });
    await g.say(id ? `新党「${name}」を結成した！\n${partyStatusOf(p, id).official ? '政党要件も満たしている。' : '政党要件（国会議員5人など）はまだ満たしていない。'}` : g.lastPoliticsError);
  } else if (label === '離党する') {
    const j = await g.ask('本当に離党する？', ['離党する', 'やめておく']);
    if (j === 0) { const w = g.leaveParty(); await g.say(w || '離党した。'); }
  } else if (label === '派閥・グループ') {
    const pt = p.parties[p.me.party];
    const fs = (pt && pt.factions) || [];
    if (!fs.length) { await g.say('この党には派閥やグループはない。'); return; }
    const k = await g.list({ title: '派閥・グループ', items: fs.map((f) => ({ label: f.name, right: `${f.size}人` })), ...L(8, 52, 240) });
    if (k >= 0) { const w = g.joinFaction(fs[k].id); await g.say(w || `${fs[k].name}に入った。`); }
  }
}
function splitText(s, n) { const out = []; let t = String(s || ''); while (t.length) { out.push(t.slice(0, n)); t = t.slice(n); } return out; }
async function menuDiet(g) {
  const p = g.pol();
  const items = ['審議中の法案', '法案を出す', '国会に出席する', '内閣不信任案を出す', 'もどる'];
  const i = await g.list({ title: p.diet.session ? p.diet.session.kind : '国会（閉会中）', items, ...L(8, 52, 220) });
  if (i < 0 || i === 4) return;
  if (i === 0) {
    const bills = g.billsList({ pending: true });
    if (!bills.length) { await g.say('審議中の法案はない。'); return; }
    const k = await g.list({ title: '法案', items: bills.map((b) => ({ label: b.title.slice(0, 20), right: { draft: '準備中', committee: '委員会', shugi: '衆本会議', sangi: '参本会議', referendum: '国民投票' }[b.stage] || b.stage })), ...L(8, 52, 360), describe: (x) => (bills[x].log.length ? bills[x].log[bills[x].log.length - 1].text : '') });
    if (k < 0) return;
    const b = bills[k];
    if (b.by === 'player' && b.stage === 'draft') { const r = g.gatherSupporters(b.id); await g.say(r.ok ? `賛成者を集めた（${r.supporters}/${r.need}人）${r.ready ? '\n提出の準備ができた！' : ''}` : r.why); return; }
    const j = await g.ask(`「${b.title}」\nあなたの票は？`, ['賛成', '反対', '棄権']);
    const w = g.vote(b.id, ['yes', 'no', 'abstain'][j] || 'abstain');
    await g.say(w || '票を決めた。採決の日に投じられる。');
  } else if (i === 1) {
    const year = calYear(g);
    const ar = AREA_ORDER;
    const a = await g.list({ title: '分野', items: ar.map((x) => POLICY_AREAS[x].name), ...L(8, 52, 220) });
    if (a < 0) return;
    const pols = POLICY_ORDER.filter((id) => POLICIES[id].area === ar[a]);
    const k = await g.list({ title: POLICY_AREAS[ar[a]].name, items: pols.map((id) => ({ label: POLICIES[id].name.slice(0, 20), disabled: !!policyBlock(p, id, null, year, fyNow(g)) })), ...L(8, 52, 380), describe: (x) => { const pr = g.policyPreview(pols[x]); return pr ? `${pr.desc}${pr.cost ? `（${pr.cost > 0 ? '財源' : '財政効果'} 年${fmtCho(Math.abs(pr.cost))}）` : ''}` : ''; } });
    if (k < 0) return;
    const id = g.proposeBill({ policy: pols[k] });
    await g.say(id ? `法律案「${p.diet.bills.find((b) => b.id === id).title.slice(0, 30)}」をまとめた。` : g.lastPoliticsError);
  } else if (i === 2) {
    const r = g.attendDiet();
    await g.say(r.ok ? `国会に出席した。${r.bills.length ? `今日の採決・審議：${r.bills.length}本` : ''}` : r.why);
  } else if (i === 3) {
    const r = g.noConfidence();
    await g.say(r.ok ? `内閣不信任決議案は${r.passed ? '可決' : '否決'}された（賛成${r.yes}・反対${r.no}）` : r.why);
  }
}
async function menuCabinet(g) {
  const s = g.politicsSummary();
  const p = g.pol();
  const isPM = p.cabinet.pm === 'player';
  await sayLines(g, [`${s.cabinet.pmName}内閣（支持率 ${s.cabinet.approval}%）`, ...s.cabinet.ministers.slice(0, 8).map((m) => `${m.name}：${m.whoName}`)]);
  if (!isPM) return;
  const i = await g.ask('総理大臣として、どうする？', ['内閣改造', '衆議院を解散', '総辞職する', 'なにもしない']);
  if (i === 0) { g.reshuffle({}); await g.say('内閣を改造した。'); }
  else if (i === 1) { const id = g.dissolve(); await g.say(id ? '衆議院を解散した！総選挙だ。' : g.lastPoliticsError); }
  else if (i === 2) { const w = g.resignPM(); await g.say(w || '内閣総辞職を決めた。'); }
}
async function menuMoney(g) {
  const p = g.pol();
  const me = p.me;
  const y = calYear(g);
  const lg = me.ledger[y] || { income: 0, expense: 0 };
  const d = polDate(g);
  const due = d.month <= 3 ? `${y - 1}年分は${me.reported[y - 1] ? '提出ずみ' : '3月末まで'}` : `${y}年分は${y + 1}年3月末まで`;
  await sayLines(g, [`政治資金 ${fmtMoney(me.funds)}${me.secret ? `・帳簿にないお金 ${fmtMoney(me.secret)}` : ''}`, `今年の収入 ${fmtMoney(lg.income)}・支出 ${fmtMoney(lg.expense)}`, `収支報告書：${due}`]);
  const i = await g.ask('どうする？', ['パーティーを開く', '寄付を募る', '収支報告書を出す', `秘書を雇う（${me.staff}人）`, 'もどる']);
  if (i === 0) { const r = g.holdFundraiser({}); await g.say(r.ok ? r.text : r.why); }
  else if (i === 1) { const r = g.collectDonations({}); await g.say(r.ok ? r.text : r.why); }
  else if (i === 2) {
    const inc = me.secret > 0 ? (await g.ask('帳簿にないお金も、正直に書く？', ['正直に書く', '書かない'])) === 0 : false;
    const r = g.reportFunds({ includeSecret: inc });
    await g.say(r.ok ? r.text : r.why);
  } else if (i === 3) {
    const w = g.hireStaff(1);
    await g.say(w || `私設秘書を雇った（${me.staff}人）。毎月 ${fmtMoney(STAFF_COST)} かかる。`);
  }
}
async function menuActivities(g) {
  const ks = Object.keys(ACTIVITIES);
  const i = await g.list({ title: '議員の活動', items: ks, ...L(8, 52, 220), describe: (k) => ACTIVITIES[ks[k]].desc });
  if (i < 0) return;
  const r = g.activity(ks[i]);
  await g.say(r.ok ? r.text : r.why);
}

// The phone app (fallback). politics_ui.js may register 'politics' again to replace it.
registerPhoneApp('politics', {
  name: '政治', color: '#3a5a9a', order: 60,
  icon(ctx, x, y) {
    // a small Diet building: dome, tower, wings
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(x + 3, y + 14, 18, 6);
    ctx.fillRect(x + 9, y + 8, 6, 6);
    ctx.fillRect(x + 10, y + 5, 4, 3);
    ctx.fillRect(x + 11, y + 3, 2, 2);
    ctx.fillStyle = '#b8b0a0';
    ctx.fillRect(x + 3, y + 19, 18, 1);
    ctx.fillStyle = '#5a6a8a';
    for (let i = 0; i < 4; i++) ctx.fillRect(x + 5 + i * 4, y + 16, 1, 3);
  },
  badge: (g) => { const p = g.state && g.state.politics; return p && p.me ? p.me.offers.filter((o) => !o.answered).length : 0; },
  open: (g) => g.politicsMenu(),
});
void COLORS;
