// ニュース (R9-D): data for the news app — sections, real headlines by date, the seasons' news, era words, ads.
// Pure data + small pure helpers (no DOM, no game imports), so node can load it.
//
// REAL HEADLINES — rules: short and factual; shown only once the in-game date has reached the real date (Japan time);
// no living person is named; no real party / politician / company is shown doing wrong; Japanese politics is left to
// the game's own simulation (real Diet / tax / cabinet events are NOT here: the game's history may diverge). The
// diplomatic history is world.js's (国際), the market's history is phone_apps3_money.js's (the same three market texts
// are repeated here word for word, so the feed shows them once even when the 投資 app sent them too).
// Every entry was checked with WebSearch in 2026-10 (date in Japan time + the wording); sources in brackets:
//   19870401 JR発足 (trafficnews.jp, pixiv; 旅客6社・貨物1社) · 19871020 日経平均3,836円48銭安・−14.9% (indexes.nikkei.co.jp,
//   toyokeizai) · 19880313 青函トンネル・海峡線, 青函連絡船の終航 (nippon.com, jreast) · 19880317 東京ドーム開場 (tokyo-dome.co.jp:
//   3/17 セレモニー) · 19880410 瀬戸大橋 (pref.okayama, ksb) · 19890107 崩御 06:33, 「平成」発表 14:30, 1/8 施行 (waseda.jp library) ·
//   19891229 38,915円87銭 (dir.co.jp, rakuten-sec) · 19920701 山形新幹線つばさ・初のミニ新幹線 (gendai.media, kotobank) ·
//   19930515 Jリーグ開幕・国立・59,626人 (forbesjapan, jleague.jp) · 1993-12 法隆寺・姫路城・屋久島・白神山地 (nippon.com, knt;
//   day not confirmed → shown from 12-11, the session's last day) · 19940904 関空 (pref.osaka) · 19950117 05:46 M7.3 兵庫県南部地震
//   (data.jma.go.jp; the name 阪神・淡路大震災 came later, so the day's headline uses the JMA name) · 19951123 Windows 95 日本語版,
//   深夜販売 (nippon.com, gendai.media) · 19971001 長野新幹線あさま (weblio, jetpunk) · 19971218 アクアライン (bunshun, e-nexco) ·
//   19980207 長野五輪開会式 (bunshun) · 19980405 明石海峡大橋 1,991m (kobe-np) · 19990222 iモード (internet.watch) · 20000719 二千円札
//   守礼門 (ryukyushimpo, mof.go.jp) · 20010331 USJ (pixiv) · 20020531-0630 日韓W杯; 6/14 チュニジア戦 2−0 で初の決勝T (jfa.jp) ·
//   20031201 地上デジタル放送 (soumu.go.jp, av.watch) · 20040313 九州新幹線 新八代〜鹿児島中央 つばめ (mlit 白書) · 20041023 17:56 M6.8
//   震度7, とき325号脱線・負傷者なし (bousai.go.jp, jreast) · 20050325 愛・地球博 (mlit) · 2006 WBC 決勝 日本10−6キューバ (JST 3/21),
//   2009 決勝 日本5−3韓国 (JST 3/24) (nippon.com, spread-sports) · 20090521 裁判員制度 (kotobank) · 20101204 東北新幹線全線開業・最速3時間20分
//   (hokkaido-np) · 20110311 14:46 M9.0, JMA名「東北地方太平洋沖地震」 (jma.go.jp; 「東日本大震災」 is the 4/1 cabinet name) · 2011
//   なでしこ優勝 (JST 7/18, PK 3−1) (jfa.jp, afpbb) · 20110724 正午 アナログ終了, 3県は延期 (soumu.go.jp) · 20120522 スカイツリー 634m
//   (bunshun) · 20130622 富士山 (mofa.go.jp) · 20130908 (JST) 東京に決定 (afpbb, 2020games.metro.tokyo) · 20150314 北陸新幹線 金沢
//   (jsce.or.jp) · 20160326 北海道新幹線 (hokkaido-np) · 20160414/16 熊本地震, 震度7を2回 (bousai.go.jp 防災白書) · 20190401 「令和」・万葉集
//   (hokkaido-np) · 20190501 改元 · 20191013 日本28−21スコットランド, 初の8強 (nippon.com) · 20200324 五輪の1年程度の延期, 夏冬を通じて初
//   (nippon.com) · 20210723 開会式・無観客 (businessinsider.jp) · 2023 WBC 日本3−2米国 (JST 3/22) (daily.co.jp) · 20240101 16:10 M7.6
//   志賀町 震度7, 大津波警報 (jma.go.jp) · 20240222 / 20240805 (toyokeizai, indexes.nikkei) · 20240703 新紙幣 (smbc, mufg) · 2025-04-13〜10-13
//   大阪・関西万博 184日間 (trafficnews) · 2026 WBC 決勝 ベネズエラ3−2米国 (JST 3/18), 日本は準々決勝で敗退 (baseballchannel.jp) ·
//   20260331 iモード終了 (docomo.ne.jp) · 20260612 (JST) W杯北中米大会開幕・48か国 (soccer-king, mynavi).

// Sections of the news app (id, label, colour). 'top' is the front page, 'tv' the TV listings.
export const SECTIONS = [
  { id: 'top', label: 'トップ', col: '#c8283c' },
  { id: 'ent', label: '芸能', col: '#e0457a' },
  { id: 'owarai', label: 'お笑い', col: '#f08a1c' },
  { id: 'pol', label: '政治', col: '#4a56b0' },
  { id: 'eco', label: '経済', col: '#1f8a5a' },
  { id: 'intl', label: '国際', col: '#2a7ab8' },
  { id: 'soc', label: '社会', col: '#6a5a4a' },
  { id: 'sports', label: 'スポーツ', col: '#d0602a' },
  { id: 'weather', label: '天気', col: '#3a9ad0' },
  { id: 'tv', label: 'テレビ欄', col: '#7a4ab0' },
];
export const SEC = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
export const CATS = ['ent', 'owarai', 'pol', 'eco', 'intl', 'soc', 'sports', 'weather'];

// [date (JST, YYYYMMDD), cat, headline, body, opts] — opts.gogai: a 号外; opts.img: the picture kind (news_art.js).
export const REAL_NEWS = [
  [19870401, 'soc', '国鉄が分割民営化、JRグループが発足', '日本国有鉄道（国鉄）が分割・民営化され、旅客6社と貨物1社のJRグループが発足した。', { img: 'train' }],
  [19871020, 'eco', '東京株式市場、日経平均が1日で3,836円安（−14.90%）。前日のニューヨーク市場の暴落「ブラックマンデー」が波及した。', '下落率は過去最大。世界の市場に株安が広がっている。', { img: 'chartDown' }],
  [19880313, 'soc', '青函トンネルが開業、本州と北海道が鉄道で結ばれる', '海底トンネルを通るJR津軽海峡線が開業した。80年にわたって青森と函館を結んだ青函連絡船は、この日で運航を終えた。', { img: 'tunnel' }],
  [19880317, 'sports', '東京ドームが開場、日本初の屋根付き全天候型球場', '後楽園に、空気で屋根を支えるドーム球場が完成した。雨の日でも試合ができる。', { img: 'dome' }],
  [19880410, 'soc', '瀬戸大橋が開通、本州と四国が初めて橋で結ばれる', '岡山県倉敷市と香川県坂出市を結ぶ、鉄道と道路の併用橋。宇高連絡船はその役目を終える。', { img: 'bridge' }],
  [19890107, 'soc', '昭和天皇が崩御、新元号は「平成」', '政府は新しい元号を「平成」と発表した。あす1月8日から改元される。', { img: 'gengo', gengo: '平成', gogai: true }],
  [19891229, 'eco', '大納会。日経平均は3万8,915円87銭の史上最高値で取引を終えた。', '株価も地価も上がり続けている。', { img: 'chartUp' }],
  [19920701, 'soc', '山形新幹線「つばさ」が開業', '在来線の線路幅を広げて新幹線が乗り入れる、初めての「ミニ新幹線」。東京と山形が乗りかえなしで結ばれた。', { img: 'shinkansen' }],
  [19930515, 'sports', 'プロサッカーの「Jリーグ」が開幕', '東京・国立競技場の開幕戦には5万9千人あまりが詰めかけた。', { img: 'soccer' }],
  [19931211, 'soc', '法隆寺・姫路城・屋久島・白神山地が、日本で初めての世界遺産に', 'ユネスコの世界遺産委員会が登録を決めた。文化遺産2件、自然遺産2件。', { img: 'castle' }],
  [19940904, 'soc', '関西国際空港が開港', '大阪湾の人工島につくられた海上空港。旅客と貨物の24時間運用は日本で初めて。', { img: 'plane' }],
  [19950117, 'soc', '兵庫県南部でM7.3の大地震、神戸市などで甚大な被害', '午前5時46分、淡路島北部を震源とする地震が起きた。気象庁は「兵庫県南部地震」と命名。建物の倒壊や火災が相次いでいる。', { img: 'quake', gogai: true }],
  [19951123, 'eco', 'パソコン用OS「Windows 95」日本語版が発売、秋葉原に深夜の行列', '午前0時の発売にあわせて、電気街の店先に長い列ができた。', { img: 'pc' }],
  [19971001, 'soc', '長野新幹線（高崎〜長野）が開業、列車名は「あさま」', '冬季五輪を控えた長野と東京が、新幹線で結ばれた。', { img: 'shinkansen' }],
  [19971218, 'soc', '東京湾アクアラインが開通', '神奈川県川崎市と千葉県木更津市を、海底トンネルと海の上の橋で結ぶ。', { img: 'bridge' }],
  [19980207, 'sports', '長野オリンピックが開幕', '冬季五輪の国内開催は、1972年の札幌以来。', { img: 'torch' }],
  [19980405, 'soc', '明石海峡大橋が開通、世界最長のつり橋', '神戸と淡路島を結ぶ。主塔と主塔の間は1,991メートル。', { img: 'bridge' }],
  [19990222, 'eco', '携帯電話でネットが使える「iモード」が始まる', 'ケータイの画面で、ニュースや天気、銀行の残高照会などが使える。', { img: 'keitai' }],
  [20000719, 'eco', '二千円札が発行される', '表には沖縄・首里城の守礼門がえがかれている。', { img: 'yen' }],
  [20010331, 'soc', '大阪に「ユニバーサル・スタジオ・ジャパン」が開業', '映画の世界を体験できるテーマパーク。', { img: 'park' }],
  [20020531, 'sports', 'サッカーW杯 日韓大会が開幕', '日本と韓国の共同開催。決勝は横浜で行われる。', { img: 'soccer' }],
  [20020614, 'sports', 'W杯 日本代表がチュニジアに2−0、初の決勝トーナメント進出', '1次リーグを2勝1分けの首位で突破した。', { img: 'soccer' }],
  [20031201, 'ent', '東京・名古屋・大阪で地上デジタル放送が始まる', '高画質の放送に。アナログ放送はいずれ終わる予定。', { img: 'tv' }],
  [20040313, 'soc', '九州新幹線が部分開業、列車名は「つばめ」', '新八代〜鹿児島中央間。博多〜鹿児島中央は2時間10分に。', { img: 'shinkansen' }],
  [20041023, 'soc', '新潟県中越地方でM6.8の地震、震度7', '走行中の上越新幹線が脱線した（乗客にけが人はなかった）。山あいの集落では土砂崩れが相次いでいる。', { img: 'quake' }],
  [20050325, 'soc', '「愛・地球博」（2005年日本国際博覧会）が開幕', '愛知県で185日間の会期。自然の叡智がテーマ。', { img: 'expo' }],
  [20060321, 'sports', '第1回WBC 日本がキューバを10−6で破り、初代王者に', '野球の国・地域別対抗戦、ワールド・ベースボール・クラシックの決勝。', { img: 'baseball' }],
  [20090324, 'sports', 'WBC 日本が韓国を5−3で破り、大会2連覇', '延長10回の熱戦を制した。', { img: 'baseball' }],
  [20090521, 'soc', '裁判員制度が始まる', '有権者から選ばれた市民が、重大な刑事裁判の審理に加わる。', { img: 'court' }],
  [20101204, 'soc', '東北新幹線が新青森まで全線開業', '東京〜新青森は最速3時間20分で結ばれる。', { img: 'shinkansen' }],
  [20110311, 'soc', '三陸沖でM9.0の巨大地震、大津波が東日本の沿岸を襲う', '午後2時46分に発生。国内観測史上最大の地震で、気象庁は「東北地方太平洋沖地震」と命名した。', { img: 'tsunami', gogai: true }],
  [20110718, 'sports', 'サッカー女子W杯 「なでしこジャパン」が初優勝', '決勝で米国と2−2で延長を終え、PK戦を3−1で制した。', { img: 'soccer' }],
  [20110724, 'ent', '地上アナログ放送が終了（岩手・宮城・福島の3県は延期）', '正午、アナログ放送の画面に「終了しました」の文字が映った。', { img: 'tv' }],
  [20120522, 'soc', '東京スカイツリーが開業', '高さ634メートルの自立式電波塔。', { img: 'tower' }],
  [20130622, 'soc', '富士山が世界文化遺産に', '登録名は「富士山－信仰の対象と芸術の源泉」。', { img: 'fuji' }],
  [20130908, 'sports', '2020年夏季五輪の開催都市が東京に決定', '東京での夏季五輪は1964年以来2度目。', { img: 'torch', gogai: true }],
  [20150314, 'soc', '北陸新幹線が金沢まで延伸開業', '東京〜金沢は最速2時間台に。', { img: 'shinkansen' }],
  [20160326, 'soc', '北海道新幹線（新青森〜新函館北斗）が開業', '青函トンネルを新幹線が走る。', { img: 'shinkansen' }],
  [20160416, 'soc', '熊本地方でM7.3の地震、震度7を2度観測', '14日夜の地震に続き、16日未明にも震度7。同じ地域で震度7が続けて観測されたのは初めて。', { img: 'quake' }],
  [20190401, 'soc', '新元号は「令和」、5月1日に改元', '出典は万葉集。日本の古典（国書）から採ったのは初めてとされる。', { img: 'gengo', gengo: '令和', gogai: true }],
  [20190501, 'soc', '「令和」に改元', '新しい時代が始まった。', { img: 'gengo', gengo: '令和' }],
  [20191013, 'sports', 'ラグビーW杯 日本がスコットランドを28−21で破り、初のベスト8', '1次リーグ4戦全勝。', { img: 'rugby' }],
  [20200324, 'sports', '東京五輪・パラリンピック、1年程度の延期が決まる', '感染症の世界的な流行のため。五輪の延期は夏冬を通じて初めて。', { img: 'torch' }],
  [20210723, 'sports', '東京五輪が開幕、開会式は無観客で', '1年の延期を経て、国立競技場で開会式が行われた。', { img: 'torch' }],
  [20230322, 'sports', 'WBC 日本が米国を3−2で破り、3大会ぶり3度目の優勝', '決勝は米マイアミで行われた。', { img: 'baseball' }],
  [20240101, 'soc', '石川県能登地方でM7.6の地震、震度7', '午後4時10分ごろ発生。志賀町で震度7を観測し、大津波警報が出された。', { img: 'quake', gogai: true }],
  [20240222, 'eco', '日経平均が3万9,098円68銭。1989年末の史上最高値を34年ぶりに更新した。', '', { img: 'chartUp' }],
  [20240703, 'eco', '20年ぶりに新しい紙幣（一万円・五千円・千円）が発行', '偽造をふせぐ新しい技術が使われている。これまでの紙幣も引き続き使える。', { img: 'yen' }],
  [20240805, 'eco', '日経平均が1日で4,451円安（−12.40%）。下げ幅は史上最大。', '', { img: 'chartDown' }],
  [20250413, 'soc', '大阪・関西万博が夢洲で開幕', '会期は10月13日までの184日間。', { img: 'expo' }],
  [20251013, 'soc', '大阪・関西万博が閉幕', '184日間の会期を終えた。', { img: 'expo' }],
  [20260318, 'sports', 'WBC決勝 ベネズエラが米国を3−2で破り初優勝', '日本は準々決勝で敗れ、連覇はならなかった。', { img: 'baseball' }],
  [20260331, 'eco', 'ケータイの「iモード」が終了、27年の歴史に幕', '3Gの通信サービスとともに終わった。', { img: 'keitai' }],
  [20260612, 'sports', 'サッカーW杯 北中米大会が開幕、史上最多の48か国', '米国・カナダ・メキシコの3か国共催。', { img: 'soccer' }],
];

// The seasons' news (every year; no specific claim): [month, cat, headline, body, from (year), to (year), img]
// 成人の日: 1月15日 until 1999, the 2nd Monday from 2000 (ハッピーマンデー). 体育の日 10月10日 until 1999.
export const SEASONAL = [
  [1, 'soc', '初詣で各地の神社や寺がにぎわう', '三が日の人出は例年なみの見込み。', 0, 9999, 'shrine'],
  [1, 'sports', '箱根駅伝、往路・復路で熱戦', '東京・大手町と箱根・芦ノ湖を往復する大学駅伝。', 0, 9999, 'run'],
  [1, 'soc', '各地で成人式', '新成人が晴れ着やスーツ姿で集まった。', 0, 9999, 'ceremony'],
  [1, 'sports', '大相撲初場所が両国国技館で始まる', '15日間の取組に満員の観客。', 0, 9999, 'sumo'],
  [2, 'soc', '節分、各地で豆まき', '寺社の豆まきに大勢の人が集まった。', 0, 9999, 'shrine'],
  [2, 'soc', 'バレンタインデー商戦が本番', 'デパートの売り場に人があふれている。', 0, 9999, 'shop'],
  [3, 'soc', '各地の学校で卒業式', '思い出を胸に、学び舎をあとにした。', 0, 9999, 'ceremony'],
  [3, 'sports', '春の選抜高校野球が開幕', '甲子園球場に32校が集まる。', 0, 9999, 'baseball'],
  [3, 'sports', '大相撲春場所が大阪で始まる', '春の大阪の名物。', 0, 9999, 'sumo'],
  [3, 'weather', '桜の開花が各地で発表される', '気象台が標本木の開花を確認した。', 0, 9999, 'sakura'],
  [4, 'soc', '入学式・入社式のシーズン', '新しい生活が始まった。', 0, 9999, 'ceremony'],
  [4, 'soc', '各地の公園が花見客でにぎわう', '週末は場所取りの人の姿も。', 0, 9999, 'sakura'],
  [4, 'sports', 'プロ野球が開幕', '各球場でシーズンの初戦。', 0, 9999, 'baseball'],
  [5, 'soc', '大型連休、行楽地や空港が混雑', '高速道路は各地で渋滞。', 0, 9999, 'car'],
  [5, 'sports', '大相撲夏場所が始まる', '両国国技館で初日を迎えた。', 0, 9999, 'sumo'],
  [6, 'weather', '各地で梅雨入り', '気象台が梅雨入りしたとみられると発表した。', 0, 9999, 'rain'],
  [6, 'soc', '衣替え、街に半袖の姿', '制服も夏服に。', 0, 9999, 'shop'],
  [7, 'weather', '梅雨明け、本格的な夏に', '各地で真夏日が続く見込み。', 0, 9999, 'sun'],
  [7, 'soc', '各地で海開き', '海水浴場に家族連れの姿。', 0, 9999, 'beach'],
  [7, 'sports', '大相撲名古屋場所が始まる', '', 0, 9999, 'sumo'],
  [8, 'sports', '夏の全国高校野球が甲子園で開幕', '地方大会を勝ちぬいた代表校が集まった。', 0, 9999, 'baseball'],
  [8, 'soc', 'お盆の帰省ラッシュがピーク', '新幹線や高速道路が混み合っている。', 0, 9999, 'shinkansen'],
  [8, 'weather', '各地で猛烈な暑さ、熱中症に注意', 'こまめな水分補給を、と呼びかけている。', 2007, 9999, 'sun'],
  [8, 'weather', '厳しい暑さが続く、日射病に注意', '日中の外出には帽子を、と呼びかけている。', 0, 2006, 'sun'],
  [9, 'weather', '台風シーズン、早めの備えを', '気象台が最新の情報に注意するよう呼びかけている。', 0, 9999, 'typhoon'],
  [9, 'sports', '大相撲秋場所が始まる', '', 0, 9999, 'sumo'],
  [10, 'soc', '各地で運動会', '秋晴れの下、子どもたちが元気に走った。', 0, 9999, 'run'],
  [10, 'sports', 'プロ野球、日本シリーズへ', '両リーグの覇者が日本一をかけて戦う。', 0, 9999, 'baseball'],
  [11, 'weather', '紅葉が見ごろ、行楽地がにぎわう', '山あいの名所は色づきのピーク。', 0, 9999, 'leaf'],
  [11, 'sports', '大相撲九州場所が始まる', '一年をしめくくる場所。', 0, 9999, 'sumo'],
  [12, 'soc', '年末の街、買い物客でにぎわう', '商店街に歳末大売り出しの声。', 0, 9999, 'shop'],
  [12, 'soc', '年末年始の帰省ラッシュ始まる', '駅や空港は大きな荷物の人でいっぱい。', 0, 9999, 'shinkansen'],
];

// The news app's look by device (phone_apps.js devOf): 手帳 → 新聞, ケータイ → ニュースサイト, スマホ → ニュースアプリ.
export const FORM = {
  techo: { name: '新聞', paper: 'ドット新聞', kind: 'paper' },
  keitai: { name: 'ニュース', paper: 'ドットニュース', kind: 'site' },
  smart: { name: 'ニュース', paper: 'ドットニュース', kind: 'app' },
};

// Fictional ads by era (the companies are the game's own: ドット電機, まるどっと食品, 星くずメディア).
export const ADS = {
  techo: [['ドット電機', '新型ワープロ 好評発売中'], ['まるどっと食品', '冬はあったか おでんの素'], ['星くずメディア', '話題の新作ビデオ レンタル開始'], ['ドット証券', '財形・株式のご相談は窓口へ']],
  keitai: [['ドット電機', '薄型テレビ 地デジ対応'], ['まるどっと食品', 'お弁当フェア開催中'], ['星くずメディア', '着うた 新曲配信中'], ['ドット証券', 'ネット取引 手数料おトク']],
  smart: [['ドット電機', 'AI搭載 ロボット掃除機'], ['まるどっと食品', 'ネットスーパー 当日配送'], ['星くずメディア', '動画配信 初月無料'], ['ドット証券', '新NISA はじめよう']],
};

// The masthead's small column (天声人語-like boxes are a real paper's; this one is the game's own): seasonal lines.
export const KOMADO = {
  1: '新しい年。今年こそはと立てた目標を、手帳の最初のページに書いた人も多いだろう。',
  2: '寒さの底。それでも日は少しずつ長くなっている。',
  3: '別れと旅立ちの季節。駅のホームに、見送る人の姿がある。',
  4: '新しい制服、新しい名刺。街に少し緊張した顔が増えた。',
  5: '連休が明けて、いつもの朝が戻ってきた。',
  6: '雨の季節。傘の花が駅前に咲く。',
  7: '夏祭りのちょうちんに灯がともる。',
  8: '夕立のあとの風が、少しだけ涼しい。',
  9: '虫の声が夜をにぎやかにする。',
  10: '実りの秋。食卓が豊かになる季節だ。',
  11: '街路樹が色づき、上着が一枚増えた。',
  12: '一年をふりかえる。いいことも、そうでないことも、みな今年の思い出だ。',
};

// helpers
export const realDateNum = (y, m, d) => y * 10000 + m * 100 + d;
export const dateText = (n) => `${Math.floor(n / 10000)}年${Math.floor(n / 100) % 100}月${n % 100}日`;
// The real headlines up to the date number `n` (newest first), at most `max`.
export function realUpTo(n, max = 99) {
  const out = [];
  for (let i = REAL_NEWS.length - 1; i >= 0 && out.length < max; i--) if (REAL_NEWS[i][0] <= n) out.push(REAL_NEWS[i]);
  return out;
}
// Section of a free text (a message's sender + body) — used for the inbox press messages and the cores' news.
export function catOfText(from, txt) {
  from = String(from || ''); txt = String(txt || '');
  if (/お笑い|賞レース|M-1|キングオブコント|R-1|漫才|コント|落語|大喜利/.test(from)) return 'owarai';
  if (/国際/.test(from)) return 'intl';
  if (/経済/.test(from)) return 'eco';
  if (/スポーツ/.test(from)) return 'sports';
  if (/政治|選挙|国会|内閣|官邸/.test(from)) return 'pol';
  if (/芸能|週刊/.test(from)) return /M-1|漫才|コント|お笑い|芸人|賞レース|グランプリ|大喜利|落語/.test(txt) ? 'owarai' : 'ent';
  if (/逮捕|起訴|容疑|疑い|書類送検|判決|裁判|警察|詐欺|空き巣|ひったくり|事故/.test(txt)) return 'soc';
  if (/M-1|漫才|コント|お笑い|芸人|賞レース|グランプリ|大喜利|落語|NSC/.test(txt)) return 'owarai';
  if (/台風|大雨|大雪|警報|注意報|猛暑|天気|気象/.test(txt)) return 'weather';
  if (/日経平均|株価|株式|円高|円安|為替|景気|物価|日銀|金利|GDP|経済/.test(txt)) return 'eco';
  if (/米国|アメリカ|中国|ロシア|ソ連|韓国|北朝鮮|国連|NATO|EU|サミット|大統領|首脳|外交|制裁|条約|大使/.test(txt)) return 'intl';
  if (/選挙|国会|内閣|首相|総理|議員|政党|法案|知事|官房|税|予算|政府|大臣|与党|野党|デモ/.test(txt)) return 'pol';
  if (/野球|サッカー|五輪|オリンピック|相撲|駅伝|W杯|ワールドカップ|ラグビー|マラソン/.test(txt)) return 'sports';
  if (/番組|視聴率|ファン|ドラマ|ライブ|芸能|タレント|ランキング|収録|映画|歌手|CD|レギュラー|好感度/.test(txt)) return 'ent';
  return 'soc';
}
// A picture kind for a headline without one (news_art.js draws each)
export function imgOf(cat, txt = '') {
  const t = String(txt);
  if (/逮捕|容疑|疑い|警察|書類送検/.test(t)) return 'police';
  if (/判決|裁判|起訴|地裁|高裁|最高裁/.test(t)) return 'court';
  if (/選挙|当選|落選|投票|議席/.test(t)) return 'ballot';
  if (/デモ|集会|署名/.test(t)) return 'crowd';
  if (/台風/.test(t)) return 'typhoon';
  if (/地震|震度/.test(t)) return 'quake';
  if (/雪/.test(t)) return 'snow';
  if (/雨/.test(t)) return 'rain';
  if (/優勝|王者|チャンピオン|グランプリ|1位|大賞/.test(t)) return cat === 'owarai' ? 'trophyMic' : 'trophy';
  if (/株|日経|円安|円高/.test(t)) return /安|下落|割り/.test(t) ? 'chartDown' : 'chartUp';
  if (/戦争|侵攻|出兵|攻撃/.test(t)) return 'globeWar';
  return { ent: 'spotlight', owarai: 'mic', pol: 'diet', eco: 'chartUp', intl: 'globe', soc: 'city', sports: 'stadium', weather: 'sun' }[cat] || 'city';
}
