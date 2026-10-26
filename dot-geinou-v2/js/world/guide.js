// てちょう（メニュー → てちょう）で使う案内データ。js/engine/notebook.js が読みます。
//
//   GUIDE[placeId]  { town, name, short, hint, lines, audition }
//     town      'tokyo' | 'namba' | 'nagatacho' | 'kanraku'（ドット商店街 'machi'・テレビ局エリア 'minato'
//               の場所と、地図にない実家・刑務所は 'tokyo'。てちょうの色分けは TOWNS の4つ）
//     name      てちょうに出す名前（行ったことのある場所だけ表示）
//     short     おすすめのお仕事の横に出す短い名前
//     hint      まだ行っていない時の一行ヒント（「？？？」の下に出る）
//     lines     できることの要約（2〜3行。てちょうでは 13px の小さい文字で、ページの幅で折り返す）
//     audition  事務所オーディションがある（合格で所属）
//     tag / tagBg  「ばしょ」タブのタグを町の名前のかわりにする（地図にない刑務所など）
//     party     その政党がある時代だけ（政治の状態 g.pol().parties にあるときだけ）載せる。行ったことがあれば載せる
//     secret    行ったことがあるときだけ載せる（「行った場所」の数にも入れない。刑務所）
//     liveName  行ったことがあれば、場所のいまの名前（PLACES[id].name：「ともしび党本部」など）で載せる
//   GUIDE_ORDER   「ばしょ」タブの並び順
//   AUDITIONS     事務所オーディションの一覧（もくひょう：未所属の時）
//   GUIDE_JOBS    おもなお仕事（もくひょう：おすすめ／きろく：よく受けたお仕事）
//     need    undefined = だれでも / 'agency' = どこかに所属 / 事務所ID = その事務所に所属
//     orFame  need を満たしていなくても、この★以上ならOK（「所属 または ★30」など）
//     fame    ★の条件 / flag  必要なフラグ / tier  経済の段階（0〜4）
//
// 内容は各施設のファイル（js/places/*.js, js/world/*.js）に合わせてあります。
// お仕事や条件を変えたら、ここも直してください。

export const TOWNS = { tokyo: '東京', namba: 'なんば', nagatacho: '永田町', kanraku: 'ネオン街' };

export const GUIDE = {
  // ---------------------------------------------------------------- 東京
  tokyo: {
    town: 'tokyo', name: '東京エリアの街', short: '公園',
    hint: '',
    lines: ['公園のステージで路上漫才・路上ライブ（だれでも）', '大通りを西へ「ドット商店街」、東へ「テレビ局エリア」', '中央の通りを北へ「永田町」、南へ「ネオン街」', '西の通りを南へ「芸人通り」（稽古場・小劇場・演芸場）'],
  },
  nsc_tokyo: {
    town: 'tokyo', name: 'NSC東京校', short: 'NSC東京',
    hint: 'よしもと東京本部の南、「芸人通り」の北側（1995年開校）',
    lines: ['吉本の芸人養成所。入学の相談・申しこみ（分納もOK）', '授業・ネタ見せ・卒業公演。同期とコンビを組める', '受付で学生向けのバイト（劇場の裏方）を紹介'],
  },
  keikoba: {
    town: 'tokyo', name: '貸し稽古場 ドットスタジオ', short: '稽古場',
    hint: '「芸人通り」の北側、スタジオとダンススタジオのあいだ',
    lines: ['ネタの練習（相方がいればネタ合わせ）', '受付・掃除のバイト（だれでも）', '奥のライブスペースでフリーライブ（エントリー料）'],
  },
  home: {
    town: 'tokyo', name: 'ドット荘（自宅）', short: '自宅',
    hint: '東京の南西、公園の北にあるアパート',
    lines: ['ベッドで寝ると体力が全快して次の日に（セーブも）', 'パソコンで自主練（無料）・個別指導（1日1回）', 'キッチンで料理（商店街の食材で）・大家さんにリフォーム相談'],
  },
  konbini: {
    town: 'tokyo', name: 'ローソン', short: 'コンビニ',
    hint: '東京の南西、自宅のとなりのお店',
    lines: ['おにぎり・お弁当・エナジードリンクを販売', 'ネタ帳やのどあめで、ミニゲームが少しやさしく', '雑誌コーナーで芸能ゴシップを立ち読み'],
  },
  sento: {
    town: 'tokyo', name: '銭湯 ドットの湯', short: '銭湯',
    hint: '東京の南の真ん中、「ゆ」の看板',
    lines: ['お風呂¥500（1日1回）：体力+40・ストレス-12', '身だしなみも全回復・牛乳を販売・銭湯寄席（所属か★30）', 'PRポスター★250・★1000でお風呂無料・PR大使★2000'],
  },
  station_tokyo: {
    town: 'tokyo', name: '東京駅', short: '東京駅',
    hint: '東京の南東、赤レンガの駅（駅前広場にタクシーとバス停）',
    lines: ['新幹線と電車で大阪・なんばへ（¥3,000）', '帰りの運賃も残しておくと安心'],
  },
  nhk: {
    town: 'tokyo', name: 'NHK放送センター', short: 'NHK',
    hint: '東京の北西（左上）の大きなビル',
    lines: ['見学ツアー・クイズ予選・滑舌と殺陣のレッスン', 'こども番組の歌（所属か★30）・ニュース★250', '朝のドラマ★1000・歴史ドラマ★2000・最終公演★4000'],
  },
  horipro: {
    town: 'tokyo', name: 'ホリプロ', short: 'ホリプロ', audition: true,
    hint: '東京の北の真ん中あたり',
    lines: ['歌か演技のオーディション／歌・演技・ダンスの稽古', 'CMエキストラ（だれでも）・モデル（所属か★30）', '歌番組・ドラマ★250・ミュージカル★1000・ツアー★2000'],
  },
  toho: {
    town: 'tokyo', name: '東宝', short: '東宝',
    hint: '東京の北の真ん中、劇場の建物',
    lines: ['映画のエキストラ（だれでも）・市民役（所属か★30）', '怪獣スーツ・アンサンブル★250／歌と演技の稽古', 'ミュージカル主演★1000・大作映画の主演★2000'],
  },
  toei: {
    town: 'tokyo', name: '東映 撮影所', short: '東映',
    hint: '東京の北東の撮影所',
    lines: ['時代劇エキストラ（だれでも）・斬られ役（所属か★30）', 'ヒーローのスーツアクター★250・声優オーディション', '時代劇の主役★1000・ヒーロー映画★2000／殺陣の稽古'],
  },
  yoshimoto: {
    town: 'tokyo', name: 'よしもと 東京本部', short: 'よしもと', audition: true,
    hint: '東京の南の真ん中あたり',
    lines: ['漫才のオーディション／漫才・トークのレッスン', '前説（だれでも）・若手ライブ（所属）・大喜利★250', '冠番組★1000・月例ネタバトル決勝★2000（所属）'],
  },
  bs_yoshimoto: {
    town: 'tokyo', name: 'BSよしもと', short: 'BSよしもと',
    hint: '東京の南の真ん中、テレビ局',
    lines: ['番組観覧（1日1回）・原稿読みとトークのレッスン', 'ご当地クイズ（所属か★30）・ロケ番組★250', '生放送のMC★1000・特番の総合司会★2000'],
  },
  grape: {
    town: 'tokyo', name: 'グレープカンパニー', short: 'グレープ', audition: true,
    hint: '東京の南、銭湯のとなり',
    lines: ['コント演技のオーディション／コント・漫才の稽古', 'ストアの手伝い（だれでも）・事務所ライブ（所属）', 'コント番組★250・全国ツアー★1000・単独ライブ★2000'],
  },
  // ---------------------------------------------------------------- ドット商店街（東京の西）
  machi: {
    town: 'tokyo', name: 'ドット商店街', short: '商店街',
    hint: '東京の大通りを西のはしまで（東京駅前からバスも）',
    lines: ['暮らしの街。食材・カフェ・ジム・カラオケ・不動産屋など', '東の駅前に区役所・郵便局・銀行・コンビニ・横丁、南に住宅街と小学校', '公園でジョギング（無料）・東京駅前とバスでつながっている（¥210）'],
  },
  super: {
    town: 'tokyo', name: 'スーパー まるどっと', short: 'スーパー',
    hint: '商店街のアーケード、赤い看板の大きなお店',
    lines: ['料理の食材・お惣菜（コロッケ¥100・お弁当¥380）', '入浴剤・アロマ・ヘアワックス／本・CDのコーナー', '毎週水曜は特売日（食材とお惣菜が2割引）'],
  },
  hanaya: {
    town: 'tokyo', name: 'フラワー＆ギフト はなや', short: 'はなや',
    hint: '商店街のアーケード、いちばん西のお花屋さん',
    lines: ['プレゼントの花束・ケーキ・高級お菓子・紅茶セット', 'ぬいぐるみ・アクセサリー（人に話しかけてわたそう）'],
  },
  ramen: {
    town: 'tokyo', name: 'らーめん まるどっと亭', short: 'ラーメン',
    hint: '商店街のアーケード、のれんのお店',
    lines: ['ラーメン¥800（体力+30・満腹+60）・餃子', 'スタンプ10個で1杯サービス／友だちとも行ける'],
  },
  cafe: {
    town: 'tokyo', name: 'CAFE ドット', short: 'カフェ',
    hint: '商店街のアーケード、緑のひさしのお店',
    lines: ['コーヒー・ハーブティーでストレス解消（よく効くのは1日2杯）', 'ケーキセット・パンケーキ／友だちとも行ける'],
  },
  salon: {
    town: 'tokyo', name: 'hair salon ドット', short: '美容院',
    hint: '商店街のアーケード、むらさきの看板のお店',
    lines: ['カット¥4,000：次のお仕事の評判アップ（3日に1回）', 'シャンプー＆ヘッドスパ¥1,500', 'どちらも身だしなみ100・ストレス解消（よく効くのは1日1回）'],
  },
  famires: {
    town: 'tokyo', name: 'ファミレス ドットキッチン', short: 'ファミレス',
    hint: '商店街の前の大通り、アーチの東どなり',
    lines: ['日替わりランチ¥600など、安くておなかいっぱい', 'ドリンクバー¥250（1日おかわり自由）／友だちとも行ける'],
  },
  gym: {
    town: 'tokyo', name: 'DOT GYM', short: 'ジム',
    hint: '商店街の前の大通り、オレンジの看板',
    lines: ['1日¥1,000でトレーニング（ストレス-15）・シャワー', '5日通うごとに体力の最大値+2（最大+20）'],
  },
  karaoke: {
    town: 'tokyo', name: 'カラオケ ドットボックス', short: 'カラオケ',
    hint: '商店街の前の大通り、ピンクのネオン',
    lines: ['フリータイム¥1,200で歌い放題（歌のミニゲーム）', 'うまく歌うとストレス-25（2曲目からは少しずつ減る）', '歌+1は1日3曲まで／友だちとも行ける'],
  },
  fudousan: {
    town: 'tokyo', name: 'ドット不動産', short: '不動産屋',
    hint: '商店街の前の大通り、青い看板のお店',
    lines: ['物件さがし・内見・引っ越し・家賃の相談', 'ドットレジデンス★250・ドットタワー★1000'],
  },
  kagu: {
    town: 'tokyo', name: 'ドット家具', short: '家具屋',
    hint: '商店街の前の大通り、不動産屋のとなり',
    lines: ['家具を買うと、眠りや毎朝の暮らしにいいことがある', '置ける数は住まいしだい・いらない家具は半額で引き取り'],
  },
  mansion: {
    town: 'tokyo', name: 'ドットレジデンス', short: 'レジデンス',
    hint: '商店街の南の住宅街、大きなマンション',
    lines: ['★250で住める1LDK（家賃¥30,000／週）', 'よく眠れる（ストレス-22）・お風呂・家具は6つまで'],
  },
  tower: {
    town: 'tokyo', name: 'ドットタワー', short: 'タワー',
    hint: '商店街の南の住宅街、ガラス張りの高いビル',
    lines: ['★1000で住める2LDK（家賃¥90,000／週）', 'よく眠れる（ストレス-30）・ジェットバス・家具は8つまで'],
  },
  // ---------------------------------------------------------------- テレビ局エリア（東京の東）
  minato: {
    town: 'tokyo', name: 'テレビ局エリア', short: 'テレビ局エリア',
    hint: '東京の大通りを東のはしまで（東京駅前からバスも）',
    lines: ['5つのテレビ局が集まる、とても広い街', 'キッチンカー・観覧車・大道芸・からくり時計でひと息', 'ベイライン（¥190）で広場⇔埠頭・バスで東京駅前へ'],
  },
  ntv: {
    town: 'tokyo', name: '日本テレビ', short: '日本テレビ',
    hint: 'テレビ局エリアの南西、しおさい広場のタワー',
    lines: ['受付で番組のゲスト出演（★の条件あり）・番組観覧', '前説（だれでも）・ひな壇ゲスト（所属か★30）', '社員食堂で安くおなかいっぱい・楽屋でひと休み'],
  },
  tbs: {
    town: 'tokyo', name: 'TBS', short: 'TBS',
    hint: 'テレビ局エリアの北西、あかね坂の上',
    lines: ['受付で番組の相談・ゲスト出演（★の条件あり）', '前説・ドラマの代役（だれでも）・コント（所属か★30）', '楽屋でひと休み・社員食堂でごはん'],
  },
  tvasahi: {
    town: 'tokyo', name: 'テレビ朝日', short: 'テレビ朝日',
    hint: 'テレビ局エリアの北、スターヒル広場の正面',
    lines: ['受付で番組のゲスト出演（★の条件あり）・番組観覧', '前説（だれでも）・クイズ解答者とひな壇（所属か★30）', '楽屋の鏡で身だしなみ・畳でひと休み'],
  },
  fujitv: {
    town: 'tokyo', name: 'フジテレビ', short: 'フジテレビ',
    hint: 'テレビ局エリアの南東、海ぞいの球体のビル',
    lines: ['受付で番組のゲスト出演（★の条件あり）・番組観覧', 'コントの通行人役（だれでも）・ツッコミ役（所属か★30）', '球体ラウンジで海の景色とコーヒー'],
  },
  tvtokyo: {
    town: 'tokyo', name: 'テレビ東京', short: 'テレビ東京',
    hint: 'テレビ局エリアの北東、電波塔の近く',
    lines: ['受付で番組のゲスト出演（★の条件あり）・番組観覧', 'ロケのお手伝い（だれでも）・ワイプ出演（所属か★30）', 'ご当地グルメロケのリポーター★250'],
  },
  // ---------------------------------------------------------------- なんば
  namba: {
    town: 'namba', name: 'なんばエリアの街', short: 'なんば',
    hint: '東京駅から新幹線と電車で行ける',
    lines: ['お笑いの本場・大阪。劇場や事務所が集まる街', '川の南は戎橋筋のアーケードと千日前（劇場・ライブハウス・食べ歩き）', '東の川ぞいに MBS毎日放送・関西テレビ・屋台', '西の劇場通りに NSC大阪校・ドット劇場'],
  },
  nsc: {
    town: 'namba', name: 'NSC大阪校', short: 'NSC大阪',
    hint: 'なんばの北、よしもと新喜劇の劇場の西どなり',
    lines: ['吉本の芸人養成所。入学の相談・申しこみ（分納もOK）', '授業・ネタ見せ・卒業公演。同期とコンビを組める', '受付で学生向けのバイト（劇場の裏方）を紹介'],
  },
  mbs: {
    town: 'namba', name: 'MBS毎日放送', short: 'MBS',
    hint: 'なんばの東、川の北岸の青いビル',
    lines: ['受付で番組のゲスト出演・前説と観覧の盛り上げ役', '商店街ロケのお手伝い（だれでも）', 'ラジオのお便り紹介（所属か★30）'],
  },
  ktv: {
    town: 'namba', name: '関西テレビ', short: '関西テレビ',
    hint: 'なんばの東、川の北岸のオレンジの看板',
    lines: ['受付で番組のゲスト出演・前説と観覧の盛り上げ役', '商店街ロケのお手伝い（だれでも）', '若手漫才コンテストのネタ見せ（所属か★30）'],
  },
  station_namba: {
    town: 'namba', name: 'なんば駅', short: 'なんば駅',
    hint: 'なんばの南、戎橋筋のアーケードを南へまっすぐ',
    lines: ['電車と新幹線で東京へ（¥3,000）'],
  },
  shinkigeki: {
    town: 'namba', name: 'よしもと新喜劇 劇場', short: '新喜劇', audition: true,
    hint: 'なんばの北、NSC大阪校のとなりの大きな劇場',
    lines: ['座員オーディション（ズッコケ）・受け身の稽古・観劇', 'エキストラ（だれでも）・ちょい役（所属か★100）', 'よしもと所属で 準レギュラー★250〜座長★2000'],
  },
  shochiku: {
    town: 'namba', name: '松竹芸能', short: '松竹芸能', audition: true,
    hint: 'なんばの北、劇場のとなり',
    lines: ['トークのオーディション／しゃべり・漫才の稽古', '呼び込み（だれでも）・若手ライブとラジオ（所属）', '関西ローカル★250・全国ネット★1000・冠ラジオ★2000'],
  },
  takoyaki: {
    town: 'namba', name: 'たこ焼き屋', short: 'たこ焼き屋',
    hint: 'なんばの北、ホテルのとなりの小さな店',
    lines: ['たこ焼きを販売・焼くバイト（だれでも）', '祭りの司会（所属か★30）・食レポ★250・CM★2000', '売れっ子になると、新メニューが誕生するかも？'],
  },
  jikka: {
    town: 'tokyo', name: '実家', short: '実家',
    hint: '東京駅のきっぷ売り場で「帰省する」',
    lines: ['家族と会える（ごはん・お泊まり・思い出話）', '7日に1度、ストレスが大きく回復・家族の♥アップ', '帰りにお弁当とふるさとの名産をもらえる'],
  },
  hotel: {
    town: 'namba', name: 'ドットホテル なんば', short: 'ホテル',
    hint: 'なんばの北、たこ焼き屋のとなりの高い建物',
    lines: ['1泊¥3,000で体力が全快して次の日に（セーブも）', '宴会の余興（所属か★30）・披露宴の司会★250', 'ディナーショー★1000・★2000で宿泊ご招待'],
  },
  // ---------------------------------------------------------------- 永田町・霞が関（東京の北）
  nagatacho: {
    town: 'nagatacho', name: '永田町・霞が関', short: '永田町',
    hint: '東京の中央の通りを北へまっすぐ（東京駅前からバスも）',
    lines: ['国会議事堂・首相官邸・政党の本部が集まる政治の街', '国会前で集会や街頭演説・南に警視庁と検察庁と裁判所', 'バス（¥210）で東京駅前・商店街・テレビ局エリア・ネオン街へ'],
  },
  kokkai: {
    town: 'nagatacho', name: '国会議事堂', short: '国会',
    hint: '永田町の北、中央塔のある大きな建物',
    lines: ['国会見学（参観）と本会議の傍聴は、だれでもできる', '議員になると本会議場で採決、委員会室で質問', '議員会館の事務所で秘書・陳情・政治資金の帳簿'],
  },
  kantei: {
    town: 'nagatacho', name: '首相官邸', short: '官邸',
    hint: '永田町の西、警備の人が立つ建物',
    lines: ['入れるのは政治家と、★2000の有名人（表敬訪問）', '記者会見室・閣議室（閣議は火・金）・危機管理センター', '総理大臣になったら、執務室で解散や内閣改造を決める'],
  },
  jimin_hq: {
    town: 'nagatacho', name: '自由民主党本部', short: '自民党本部',
    hint: '永田町の真ん中、党本部が並ぶ通り',
    lines: ['1955年結党の政党。受付で党の説明・入党・寄付', '2階の選挙対策本部で公認の申請と立候補の届出', '政務調査会で政策の提言・4階で派閥や党の役職'],
  },
  minshu_hq: {
    town: 'nagatacho', name: '民主党本部', short: '民主党本部', party: 'minshu',
    hint: '永田町の真ん中、党本部が並ぶ通り',
    lines: ['1998〜2016年の政党。その時代だけの本部', '入党・公認の申請・政策調査会・幹部室', 'ほかの時代は、別の会社が入るオフィスビル'],
  },
  yato_hq: {
    town: 'nagatacho', name: '野党の党本部', short: '野党本部', liveName: true,
    hint: '永田町の真ん中、党本部が並ぶ通り',
    lines: ['その時いちばん大きい野党の本部', '入党・公認の申請・政策の勉強会・党の幹部と話す'],
  },
  myparty_hq: {
    town: 'nagatacho', name: 'あなたの党の本部', short: '自分の党', liveName: true,
    hint: '永田町の党本部の通り、東のはしの貸しオフィス',
    lines: ['不動産会社の人に話すと、新党を立ち上げられる', '結党したら党首室で党の運営・議員の勧誘・公約', '政党要件：国会議員5人以上、または1人以上で得票率2%以上'],
  },
  keisatsu: {
    town: 'nagatacho', name: '警視庁', short: '警視庁',
    hint: '永田町の南西、「桜田門」の大きな庁舎',
    lines: ['総合受付・落とし物の届け出・自首の窓口', '相談室（生活安全課）：闇金・ストーカー・詐欺の相談', '逮捕されると、取調室と留置場へ…'],
  },
  kensatsu: {
    town: 'nagatacho', name: '検察庁', short: '検察庁',
    hint: '永田町の南、警視庁と裁判所のあいだ',
    lines: ['受付と、犯罪の被害にあった人の相談窓口', '検事の取調べ・起訴か不起訴かが決まる場所', '特捜部：政治とお金・脱税の事件を独自に捜査'],
  },
  saibansho: {
    town: 'nagatacho', name: '裁判所', short: '裁判所',
    hint: '永田町の南、石づくりの建物',
    lines: ['刑事裁判の傍聴（だれでも）・最高裁の大法廷を見学', '地裁・裁判員法廷（2009年〜）・高裁・最高裁の小法廷', '民事・破産のフロア：自己破産の申立て・少額訴訟（1998年〜）'],
  },
  keimusho: {
    town: 'tokyo', tag: '塀の中', tagBg: '#5a5a6a', name: '刑務所', short: '刑務所', secret: true,
    hint: '地図にはない。来ずにすむなら、それがいちばん',
    lines: ['実刑の判決を受けると、ここで刑期をすごす', '刑務作業・運動・改善指導・面会。仮釈放の審理も', '正門で入所と出所の手続き・作業製品の販売'],
  },
  kuyakusho: {
    town: 'tokyo', name: 'ドット区役所', short: '区役所',
    hint: 'ドット商店街の駅前、大通りぞいの大きな庁舎', // [R9-A] moved from the arcade's north-east corner
    lines: ['住民票・税の窓口（確定申告の相談も）', '選挙管理委員会：選挙の説明・立候補の届出・期日前投票（2003年まで不在者投票）', '区民相談室：多重債務・闇金・生活の相談／区議会の傍聴'],
  },
  // [R8-L1] 運転免許（教習所・免許センター・合宿）
  kyoshujo: {
    town: 'tokyo', name: 'ドット自動車教習所', short: '教習所',
    hint: '劇場通りの東のはし（ドット演芸場の先）',
    lines: ['入所・適性検査 → 学科と技能の教習 → 修了検定 → 仮免 → 路上 → 卒業検定', '通学（予約制）か合宿（宿泊・最短2週間）。AT限定は1991年から、準中型は2017年から', '二輪・第二種もここ。シミュレーター室で無料の練習'],
  },
  menkyo: {
    town: 'tokyo', name: 'ドット運転免許センター', short: '免許センター',
    hint: '東京駅の東、線路ぞいの建物（大通りの南のレーン沿い）',
    lines: ['卒業後の適性検査・学科試験（90%以上）・写真・交付時講習 → 免許証', '原付免許は学科試験と原付講習だけ。免許証の更新もここ', '受付は平日 午前9時〜午後4時（土日は休み）'],
  },
  gassyuku: {
    town: 'tokyo', tag: '合宿', tagBg: '#2f9a5a', name: 'ドット合宿教習所', short: '合宿',
    hint: '地図にはない。教習所で合宿を申し込むと、新幹線とバスで出かける',
    lines: ['宿泊しながら最短AT 5日・MT 6日（約14〜16日）で免許をめざす', '食堂・談話室・寮の部屋。検定に落ちると延泊', '留守のあいだの家賃は前払い。レギュラーはお休みあつかい'],
  },
  // ---------------------------------------------------------------- ネオン街（東京の南）
  kanraku: {
    town: 'kanraku', name: 'ネオン街', short: 'ネオン街',
    hint: '東京の中央の通りを南へまっすぐ（東京駅前からバスも）',
    lines: ['ネオンの夜の街。居酒屋・牛丼屋・カプセルホテル', '客引きや「うまい話」には要注意。交番と喫煙所は北の大通り', '暴力団の事務所には近づかないこと'],
  },
  koban: {
    town: 'kanraku', name: 'ネオン街交番', short: '交番',
    hint: 'ネオン街の北、大通りぞいの小さな建物',
    lines: ['道案内・落とし物・困りごとの相談', '闇金や客引きの被害は、ここでも相談できる'],
  },
  kyabakura: {
    town: 'kanraku', name: 'CLUB ステラ', short: 'クラブ',
    hint: 'ネオン街の一番通りの東、きらきらの看板',
    lines: ['キャバクラ（会話とお酒の店）。入店は18歳から、お酒は20歳から', '料金は高め（セット料金・指名料・ドリンク）。飲みすぎ・使いすぎに注意'],
  },
  gamecen: {
    town: 'kanraku', name: 'ゲームセンター ネオン', short: 'ゲーセン',
    hint: 'ネオン街の一番通りの西、にぎやかな音のお店',
    lines: ['ゲームで気分転換。お金の使いすぎに注意', 'ガラの悪い客がたまっていることも。からまれたら交番へ'],
  },
  shohisha: {
    town: 'kanraku', name: 'ドットローン', short: '消費者金融',
    hint: 'ネオン街の北西、大通りの北側の看板',
    lines: ['消費者金融（登録のある貸金業者）。審査・借入れ・返済', '利息は法律の上限まで。借りすぎは「多重債務」のもと'],
  },
  yamikin: {
    town: 'kanraku', name: 'クイック融資', short: '闇金',
    hint: 'ネオン街の西、「即日融資」の古びた雑居ビル',
    lines: ['違法な高利の貸金業者（闇金）。トイチの利息と取り立て', '借りてしまったら、警察や弁護士にすぐ相談を'],
  },
  kumi: {
    town: 'kanraku', name: '鬼灯興業（組事務所）', short: '組事務所',
    hint: 'ネオン街の南東、裏通りのつきあたり',
    lines: ['暴力団の事務所。危険な場所', '関わりを持てば、芸能界にも政界にもいられなくなる'],
  },
  // ---------------------------------------------------------------- [R12-S2] 店の中身（js/places/shop_*.js）
  shop_junkissa: {
    town: 'tokyo', name: '純喫茶 ドット', short: '純喫茶',
    hint: '芸人通りの北、いちばん西の喫茶店',
    lines: ['モーニング・コーヒー・ナポリタン（7:00〜22:00）', 'ネタを書く席で台本エディタが開く（ネタの種も使える）', '作家志望のお客さんに、台本を見てもらえる（¥450）'],
  },
  shop_furugi_t: {
    town: 'tokyo', name: '古着屋（芸人通り）', short: '古着屋',
    hint: '芸人通りの北、純喫茶のとなり',
    lines: ['衣装を買うと、何度でも着替えられる（1日1回）', '身だしなみアップ・次のミニゲームが少しやさしくなる', '試着とコーディネートの相談は無料（12:00〜21:00）'],
  },
  shop_karaoke_t: {
    town: 'tokyo', name: 'カラオケ（芸人通り）', short: 'カラオケ',
    hint: '芸人通りの北、NSC東京校の東の細い店',
    lines: ['1時間¥800〜の時間制の個室（ワンドリンクつき）', '歌（歌+1）・発声練習・ネタ合わせ／台本の読み上げ', '時間は、歌ったり練習したりするたびに減る'],
  },
  shop_ramen_t: {
    town: 'tokyo', name: 'ラーメン屋（芸人通り）', short: 'ラーメン',
    hint: '劇場通り、古本屋のとなり',
    lines: ['「芸人さん大盛り無料」（★250になるまで）', 'お金がないときは、ツケで食べられる', '大将の話から、仕事の噂が聞ける'],
  },
  shop_cafe_t: {
    town: 'tokyo', name: 'カフェ（劇場通り）', short: 'カフェ',
    hint: '劇場通り、ドット小劇場のとなり',
    lines: ['読み合わせ席で、相方とネタ合わせ／ひとりで台本を読める', 'ケーキ・パンケーキ・コーヒー（9:00〜21:00）'],
  },
  shop_shogekijo: {
    town: 'tokyo', name: 'ドット小劇場', short: '小劇場',
    hint: '劇場通りの西のはし、客席六十の小さな劇場',
    lines: ['公演を観て勉強（演技・間・構成）／舞台に立つ（若手公演）', '端役の仕事・楽屋で差し入れ（12:00〜22:00）', '昼公演は土日だけ'],
  },
  shop_livehouse: {
    town: 'tokyo', name: 'ライブハウス', short: 'ライブハウス',
    hint: '劇場通り、古本屋の西の地下',
    lines: ['バンドとお笑いの対バン（17:00〜24:00・月曜休み）', 'チケット＋ドリンク代で観られる／ステージにも立てる', '前座で歌う仕事（歌のミニゲーム）'],
  },
  shop_engeijo: {
    town: 'tokyo', name: 'ドット演芸場', short: '演芸場',
    hint: '劇場通りの東、大きな演芸の建物',
    lines: ['昼席12:00・夜席17:30の寄席（落語・漫才）', '観ると話芸・間・客席を読む力が伸びる', '前座の仕事（落語）／楽屋で差し入れ'],
  },
  shop_netabar: {
    town: 'tokyo', name: 'お笑いBAR 笑いの穴', short: 'お笑いBAR',
    hint: '劇場通りの東のはし、地下の看板（1995年〜）',
    lines: ['ワンドリンクで、5分のネタ見せ・大喜利ナイト', 'ヤジを返すとアドリブ・度胸が伸びる／チップがもらえる', '18:00〜27:00'],
  },
  shop_furuhon_t: {
    town: 'tokyo', name: '古本屋（劇場通り）', short: '古本屋',
    hint: '劇場通り、カフェのとなりの小さな古本屋',
    lines: ['昔の演芸雑誌・戯曲集など（毎日、棚が変わる）', '読むと芸の力とネタの種が増える／水曜休み'],
  },
  shop_wagashi: {
    town: 'tokyo', name: '和菓子 あんこ堂', short: '和菓子',
    hint: '商店街のアーケード、たい焼きの先',
    lines: ['季節の生菓子・大福・どら焼き／菓子折り（楽屋の差し入れに）', 'ベンチでお茶と生菓子（ストレス-7）／水曜休み'],
  },
  shop_shoten: {
    town: 'tokyo', name: 'ドット書店', short: '書店',
    hint: '商店街のアーケード、東のはし',
    lines: ['芸の本（漫才・演技・声・会話・落語）を買って読むと伸びる', '立ち読みでネタの種／10:00〜21:00'],
  },
  shop_yakkyoku: {
    town: 'tokyo', name: 'ドラッグストア ドット', short: 'ドラッグストア',
    hint: '商店街のアーケード、いちばん東',
    lines: ['栄養ドリンク・胃腸薬（飲みすぎの夜に）・湿布', '健康相談（のどあめのサンプルも）'],
  },
  shop_yaoya: {
    town: 'tokyo', name: '八百屋 みどりや', short: '八百屋',
    hint: '商店街の駅前の大通り、区役所と銀行のあいだ',
    lines: ['野菜・果物（旬のもの）／「まけてよ」で一割引も', '日曜休み'],
  },
  shop_koban: {
    town: 'tokyo', name: '駅前交番', short: '交番',
    hint: '商店街の駅の東どなり',
    lines: ['道案内・落とし物・相談（闇金・つきまとい）', '自首の窓口／手配度が高いと呼び止められることも'],
  },
  shop_yubin: {
    town: 'tokyo', name: 'ドット郵便局', short: '郵便局',
    hint: '駅前の大通り、区役所のとなり',
    lines: ['切手・はがき・手紙（♥+2）・年賀状（12月）', '現金書留で仕送り／貯金窓口（銀行と同じ口座）'],
  },
  shop_ginko: {
    town: 'tokyo', name: 'ドット銀行 商店街支店', short: '銀行',
    hint: '駅前の大通り、八百屋のとなり',
    lines: ['窓口は平日9:00〜15:00・ATMの時間は時代による', '預け入れ・引き出し・定期預金・ローンの相談', '携帯の「銀行」アプリと同じ口座'],
  },
  shop_izakaya: {
    town: 'tokyo', name: '居酒屋 とりあえず', short: '居酒屋',
    hint: '商店街の横丁、赤ちょうちんの最初の店（16:00〜）',
    lines: ['生ビール・串・お茶漬け（お酒は20歳から）', '仲間と宴会：♥アップ・芸人仲間からネタの種', '飲みすぎると翌朝つらい／噂話で仕事の情報'],
  },
  shop_yakitori: {
    town: 'tokyo', name: '焼き鳥 ドット', short: '焼き鳥',
    hint: '横丁、居酒屋のとなり（17:00〜・日曜休み）',
    lines: ['串の盛り合わせ・おまかせ5本', 'カウンターで、大将の話から噂が聞ける'],
  },
  shop_chuka: {
    town: 'tokyo', name: '中華そば 一番', short: '中華そば',
    hint: '横丁、焼き鳥のとなり（17:00〜）',
    lines: ['昔ながらの中華そば・大盛り・半チャーハン', '店主の話が、その時代の味'],
  },
  shop_tachinomi: {
    town: 'tokyo', name: '立ち飲み ドット', short: '立ち飲み',
    hint: '横丁の東、15:00から',
    lines: ['安い一杯とおでん', '先輩芸人が、おごってくれることも（★500未満）'],
  },
  shop_geki_n: {
    town: 'namba', name: 'ドット劇場', short: '劇場',
    hint: 'なんばの北西、NSC大阪校のとなり',
    lines: ['若手の劇場：公演を観る・舞台に立つ・前説の仕事', '昼13:00・夜18:00の二部制'],
  },
  shop_ramen_n: {
    town: 'namba', name: 'ラーメン屋（なんば）', short: 'ラーメン',
    hint: '戎橋筋の西、ことぶき橋の南',
    lines: ['NSC生は、替え玉が無料', '餃子・ライス・みそラーメン'],
  },
  shop_karaoke_n: {
    town: 'namba', name: 'カラオケ（なんば）', short: 'カラオケ',
    hint: 'ラーメン屋のとなり',
    lines: ['時間制の個室。歌・声出し・ネタ合わせ・台本の読み上げ'],
  },
  shop_furugi_n: {
    town: 'namba', name: '古着屋 ミナミ', short: '古着屋',
    hint: '千日前通りの西、タクシー乗り場の近く',
    lines: ['ヒョウ柄・金色のスニーカー・スーツ・着ぐるみ', '衣装は何度でも着替えられる（1日1回）'],
  },
  shop_junkissa_n: {
    town: 'namba', name: '純喫茶 ドット（なんば）', short: '純喫茶',
    hint: '千日前通りの西、古着屋のとなり',
    lines: ['ミックスジュース・モーニング（7:00〜11:00）', 'ネタを書く席・将棋のおじいさん・スポーツ紙'],
  },
  shop_teishoku_n: {
    town: 'namba', name: '洋食 ドット軒', short: '洋食',
    hint: '千日前通りの東、戎橋筋のアーチの先',
    lines: ['オムライス・日替わり・ビーフシチュー', '昼と夜の二部制（昼どきは行列）'],
  },
  shop_sennichimae: {
    town: 'namba', name: 'ドット千日前劇場', short: '千日前劇場',
    hint: '千日前通りの東のはし',
    lines: ['昼席12:30・夜席16:00の劇場／観る・出る', 'ちょい役のコントの仕事'],
  },
  shop_hall_n: {
    town: 'namba', name: 'ドット千日前ホール', short: '千日前ホール',
    hint: '千日前、裏通りの地下のホール',
    lines: ['毎晩18時からの「若手ネタバトル」（客席は¥500）', 'エントリーして十組で勝負：順位で賞金'],
  },
  shop_kushikatsu: {
    town: 'namba', name: '串カツ屋', short: '串カツ',
    hint: '千日前、裏通りの西',
    lines: ['串カツ・どて焼き・ビール（20歳から）', 'ソースの二度づけは、禁止！'],
  },
  shop_horoyoi: {
    town: 'namba', name: '居酒屋 ほろ酔い亭', short: '居酒屋',
    hint: '千日前、裏通りの東',
    lines: ['どて焼き・串・お酒（20歳から）', '仲間と宴会／噂話で仕事の情報'],
  },
  shop_hyakuen: {
    town: 'namba', name: '100円ショップ', short: '100円ショップ',
    hint: '千日前、裏通りの中ほど',
    lines: ['なんでも100円（メモ帳・小道具・お菓子）', 'メモ帳でネタの種／コント小道具で次のミニゲームがやさしく'],
  },
  shop_furuhon_n: {
    town: 'namba', name: '古本屋（なんば）', short: '古本屋',
    hint: '千日前通りの東のはし',
    lines: ['昔の演芸雑誌・パンフ・戯曲集（毎日、棚が変わる）'],
  },
};

export const GUIDE_ORDER = [
  'tokyo', 'home', 'konbini', 'sento', 'station_tokyo',
  'yoshimoto', 'bs_yoshimoto', 'grape', 'nsc_tokyo', 'keikoba', 'horipro', 'toho', 'toei', 'nhk',
  // [R12-S2] 芸人通り・劇場通りの店
  'shop_junkissa', 'shop_furugi_t', 'shop_karaoke_t', 'shop_ramen_t', 'shop_cafe_t', 'shop_shogekijo', 'shop_livehouse', 'shop_engeijo', 'shop_netabar', 'shop_furuhon_t',
  'machi', 'super', 'hanaya', 'ramen', 'cafe', 'salon', 'famires', 'gym', 'karaoke', 'fudousan', 'kagu', 'mansion', 'tower',
  // [R12-S2] 商店街のアーケード・駅前・横丁の店
  'shop_wagashi', 'shop_shoten', 'shop_yakkyoku', 'shop_yaoya', 'shop_koban', 'shop_yubin', 'shop_ginko', 'shop_izakaya', 'shop_yakitori', 'shop_chuka', 'shop_tachinomi',
  'minato', 'ntv', 'tbs', 'tvasahi', 'fujitv', 'tvtokyo',
  'namba', 'station_namba', 'shinkigeki', 'nsc', 'shochiku', 'takoyaki', 'hotel', 'mbs', 'ktv', 'jikka',
  // [R12-S2] なんば 戎橋筋・千日前・にし通りの店
  'shop_geki_n', 'shop_ramen_n', 'shop_karaoke_n', 'shop_furugi_n', 'shop_junkissa_n', 'shop_teishoku_n', 'shop_sennichimae', 'shop_hall_n', 'shop_kushikatsu', 'shop_horoyoi', 'shop_hyakuen', 'shop_furuhon_n',
  'kuyakusho', 'kyoshujo', 'menkyo', 'gassyuku',
  'nagatacho', 'kokkai', 'kantei', 'jimin_hq', 'minshu_hq', 'yato_hq', 'myparty_hq', 'keisatsu', 'kensatsu', 'saibansho',
  'kanraku', 'koban', 'kyabakura', 'gamecen', 'shohisha', 'yamikin', 'kumi',
  'keimusho',
];

// how: what the audition is (shown in もくひょう while the player has no agency)
export const AUDITIONS = [
  { place: 'yoshimoto', agency: 'yoshimoto', how: '漫才' },
  { place: 'grape', agency: 'grape', how: 'コント演技' },
  { place: 'horipro', agency: 'horipro', how: '歌か演技' },
  { place: 'shochiku', agency: 'shochiku', how: 'トーク' },
  { place: 'shinkigeki', agency: 'yoshimoto', how: 'ズッコケ' },
];

const T1 = { need: 'agency', orFame: 30 }; // 所属 または ★30

export const GUIDE_JOBS = [
  // tier 0: だれでも
  { place: 'tokyo', label: '公園の路上ライブ', ids: ['street_tsukkomi', 'street_rhythm'], tier: 0, skill: 'warai' },
  { place: 'yoshimoto', label: '前説', ids: ['yoshimoto_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'shinkigeki', label: '通行人役のエキストラ', ids: ['shinkigeki_extra'], tier: 0, skill: 'warai' },
  { place: 'shochiku', label: '劇場の呼び込み', ids: ['shochiku_yobikomi'], tier: 0, skill: 'talk' },
  { place: 'grape', label: 'ストアの手伝い', ids: ['grape_store_help'], tier: 0, skill: 'uta' },
  { place: 'horipro', label: 'CMのエキストラ', ids: ['horipro_cm_extra'], tier: 0, skill: 'engi' },
  { place: 'toei', label: '時代劇のエキストラ', ids: ['toei_extra'], tier: 0, skill: 'engi' },
  { place: 'toho', label: '映画のエキストラ', ids: ['toho_extra'], tier: 0, skill: 'engi' },
  { place: 'nhk', label: 'クイズ番組の予選', ids: ['nhk_quiz_yosen'], tier: 0, skill: 'talk' },
  { place: 'takoyaki', label: 'たこ焼きのバイト', ids: ['takoyaki_baito'], tier: 0, skill: 'uta' },
  { place: 'ntv', label: '前説', ids: ['ntv_maesetsu'], tier: 0, skill: 'warai' },
  { place: 'tbs', label: '前説', ids: ['tbs_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'tbs', label: 'ドラマのリハーサルの代役', ids: ['tbs_daiyaku'], tier: 0, skill: 'engi' },
  { place: 'tvasahi', label: 'トーク番組の前説', ids: ['tvasahi_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'fujitv', label: 'コントの通行人役', ids: ['fujitv_tsukonin'], tier: 0, skill: 'engi' },
  { place: 'tvtokyo', label: 'ロケのお手伝い', ids: ['tvtokyo_kosho'], tier: 0, skill: 'talk' },
  { place: 'mbs', label: '収録前の前説', ids: ['mbs_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'mbs', label: '観覧の盛り上げ役', ids: ['mbs_kanran'], tier: 0, skill: 'warai' },
  { place: 'mbs', label: '商店街ロケのお手伝い', ids: ['mbs_loke'], tier: 0, skill: 'talk' },
  { place: 'ktv', label: '収録前の前説', ids: ['ktv_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'ktv', label: '観覧の盛り上げ役', ids: ['ktv_kanran'], tier: 0, skill: 'warai' },
  { place: 'ktv', label: '商店街ロケのお手伝い', ids: ['ktv_loke'], tier: 0, skill: 'talk' },
  // [R12-S2] 小屋の出番の手伝い（js/places/shop_stage.js）
  { place: 'shop_shogekijo', label: '小劇場の端役', ids: ['shop_shogeki_hayaku'], tier: 0, skill: 'engi' },
  { place: 'shop_livehouse', label: 'ライブハウスの前座（歌）', ids: ['shop_live_uta'], tier: 0, skill: 'uta' },
  { place: 'shop_engeijo', label: '寄席の前座', ids: ['shop_engei_zenza'], tier: 0, skill: 'talk' },
  { place: 'shop_geki_n', label: 'ドット劇場の前説', ids: ['shop_geki_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'shop_sennichimae', label: '千日前劇場のちょい役コント', ids: ['shop_sen_chotto'], tier: 0, skill: 'warai' },
  // tier 1: 所属 または ★30
  { place: 'yoshimoto', label: '若手ライブ出演', ids: ['yoshimoto_wakate_live'], tier: 1, need: 'yoshimoto', skill: 'warai' },
  { place: 'yoshimoto', label: 'お祭りの営業', ids: ['yoshimoto_matsuri'], tier: 1, need: 'agency', skill: 'talk' },
  { place: 'shinkigeki', label: '新喜劇のちょい役', ids: ['shinkigeki_chotto'], tier: 1, need: 'yoshimoto', orFame: 100, skill: 'warai' },
  { place: 'bs_yoshimoto', label: 'ご当地クイズ', ids: ['bs_yoshimoto_quiz'], tier: 1, ...T1, skill: 'talk' },
  { place: 'shochiku', label: '劇場の若手ライブ', ids: ['shochiku_wakate_live'], tier: 1, need: 'shochiku', skill: 'warai' },
  { place: 'shochiku', label: 'ラジオ番組のゲスト', ids: ['shochiku_radio_guest'], tier: 1, need: 'agency', skill: 'talk' },
  { place: 'grape', label: '事務所ライブ出演', ids: ['grape_office_live'], tier: 1, need: 'grape', skill: 'warai' },
  { place: 'grape', label: '地方営業', ids: ['grape_chiho'], tier: 1, need: 'agency', skill: 'talk' },
  { place: 'horipro', label: '雑誌モデル・CM撮影', ids: ['horipro_model_cm'], tier: 1, need: 'horipro', orFame: 30, skill: 'engi' },
  { place: 'nhk', label: 'こども番組の歌', ids: ['nhk_kids_song'], tier: 1, ...T1, skill: 'uta' },
  { place: 'toei', label: '時代劇の斬られ役', ids: ['toei_kirare'], tier: 1, ...T1, skill: 'engi' },
  { place: 'toho', label: '逃げまどう市民役', ids: ['toho_citizen'], tier: 1, ...T1, skill: 'engi' },
  { place: 'sento', label: '銭湯寄席', ids: ['sento_yose'], tier: 1, ...T1, skill: 'warai' },
  { place: 'hotel', label: '宴会の余興', ids: ['hotel_yokyo'], tier: 1, ...T1, skill: 'warai' },
  { place: 'takoyaki', label: '商店街の祭りの司会', ids: ['takoyaki_matsuri'], tier: 1, ...T1, skill: 'talk' },
  { place: 'ntv', label: 'バラエティのひな壇ゲスト', ids: ['ntv_hinadan'], tier: 1, ...T1, skill: 'talk' },
  { place: 'tbs', label: 'スタジオコントの脇役', ids: ['tbs_konto'], tier: 1, ...T1, skill: 'engi' },
  { place: 'tvasahi', label: 'クイズ番組の解答者', ids: ['tvasahi_quiz'], tier: 1, ...T1, skill: 'talk' },
  { place: 'tvasahi', label: 'トーク番組のひな壇ゲスト', ids: ['tvasahi_hinadan'], tier: 1, ...T1, skill: 'talk' },
  { place: 'fujitv', label: 'コント番組のツッコミ役', ids: ['fujitv_tsukkomi'], tier: 1, ...T1, skill: 'warai' },
  { place: 'tvtokyo', label: 'VTRのワイプ出演', ids: ['tvtokyo_wipe'], tier: 1, ...T1, skill: 'talk' },
  { place: 'mbs', label: 'ラジオのお便り紹介', ids: ['mbs_radio'], tier: 1, ...T1, skill: 'talk' },
  { place: 'ktv', label: '若手漫才コンテストのネタ見せ', ids: ['ktv_manzai'], tier: 1, ...T1, skill: 'warai' },
  // tier 2: ★250
  { place: 'yoshimoto', label: '劇場の大喜利ライブ', ids: ['yoshimoto_oogiri'], tier: 2, fame: 250, skill: 'warai' },
  { place: 'shinkigeki', label: '新喜劇 準レギュラー', ids: ['shinkigeki_jun'], tier: 2, need: 'yoshimoto', fame: 250, skill: 'warai' },
  { place: 'bs_yoshimoto', label: 'ロケ番組のリポーター', ids: ['bs_yoshimoto_loke'], tier: 2, fame: 250, skill: 'talk' },
  { place: 'shochiku', label: '関西ローカル番組', ids: ['shochiku_kansai_local'], tier: 2, fame: 250, skill: 'talk' },
  { place: 'grape', label: 'コント番組', ids: ['grape_conte_tv'], tier: 2, fame: 250, skill: 'engi' },
  { place: 'horipro', label: '歌番組に出演', ids: ['horipro_utaban'], tier: 2, fame: 250, skill: 'uta' },
  { place: 'horipro', label: 'ドラマの脇役', ids: ['horipro_drama_waki'], tier: 2, fame: 250, skill: 'engi' },
  { place: 'nhk', label: 'ニュース原稿読み', ids: ['nhk_news'], tier: 2, fame: 250, skill: 'talk' },
  { place: 'nhk', label: 'クイズ番組の解答者', ids: ['nhk_quiz_general', 'nhk_quiz_tv'], tier: 2, fame: 250, skill: 'talk' },
  { place: 'toei', label: 'ヒーローのスーツアクター', ids: ['toei_suit'], tier: 2, fame: 250, skill: 'engi' },
  { place: 'toei', label: 'アニメのアフレコ', ids: ['toei_voice'], tier: 2, fame: 250, flag: 'toei_voice_role', skill: 'talk' },
  { place: 'toho', label: '怪獣のスーツアクター', ids: ['toho_suit'], tier: 2, fame: 250, skill: 'engi' },
  { place: 'toho', label: 'ミュージカルのアンサンブル', ids: ['toho_ensemble'], tier: 2, fame: 250, skill: 'uta' },
  { place: 'sento', label: '銭湯のPRポスター', ids: ['sento_poster'], tier: 2, fame: 250, skill: 'engi' },
  { place: 'hotel', label: '披露宴の司会', ids: ['hotel_wedding'], tier: 2, fame: 250, skill: 'talk' },
  { place: 'takoyaki', label: 'グルメ番組の食レポ', ids: ['takoyaki_report'], tier: 2, fame: 250, skill: 'talk' },
  { place: 'tvtokyo', label: 'ご当地グルメロケのリポーター', ids: ['tvtokyo_loke'], tier: 2, fame: 250, skill: 'talk' },
  // tier 3: ★1000
  { place: 'yoshimoto', label: '冠番組の収録', ids: ['yoshimoto_kanmuri'], tier: 3, fame: 1000, skill: 'warai' },
  { place: 'shinkigeki', label: '座長公演の重要な役', ids: ['shinkigeki_key'], tier: 3, need: 'yoshimoto', fame: 1000, skill: 'warai' },
  { place: 'bs_yoshimoto', label: '生放送の情報番組MC', ids: ['bs_yoshimoto_live'], tier: 3, fame: 1000, skill: 'talk' },
  { place: 'shochiku', label: '全国ネットのバラエティ', ids: ['shochiku_zenkoku_variety'], tier: 3, fame: 1000, skill: 'talk' },
  { place: 'grape', label: '全国ツアー', ids: ['grape_tour'], tier: 3, fame: 1000, skill: 'warai' },
  { place: 'horipro', label: 'ミュージカル主演', ids: ['horipro_musical_lead'], tier: 3, fame: 1000, skill: 'uta' },
  { place: 'nhk', label: '朝の連続ドラマ', ids: ['nhk_morning_drama'], tier: 3, fame: 1000, skill: 'engi' },
  { place: 'toei', label: '時代劇の主役', ids: ['toei_lead'], tier: 3, fame: 1000, skill: 'engi' },
  { place: 'toho', label: 'ミュージカル主演', ids: ['toho_musical_lead'], tier: 3, fame: 1000, skill: 'uta' },
  { place: 'hotel', label: 'ディナーショー', ids: ['hotel_dinner'], tier: 3, fame: 1000, skill: 'uta' },
  // tier 4: ★2000
  { place: 'yoshimoto', label: '月例ネタバトル決勝（月1回）', ids: ['yoshimoto_gp_final'], tier: 4, need: 'yoshimoto', fame: 2000, skill: 'warai' },
  { place: 'shinkigeki', label: '座長に抜擢！', ids: ['shinkigeki_zacho'], tier: 4, need: 'yoshimoto', fame: 2000, skill: 'warai' },
  { place: 'bs_yoshimoto', label: '特番の総合司会', ids: ['bs_yoshimoto_special'], tier: 4, fame: 2000, skill: 'talk' },
  { place: 'shochiku', label: '冠ラジオ番組', ids: ['shochiku_kanmuri_radio'], tier: 4, need: 'shochiku', fame: 2000, skill: 'talk' },
  { place: 'grape', label: '単独ライブ', ids: ['grape_solo_live'], tier: 4, need: 'grape', fame: 2000, skill: 'engi' },
  { place: 'horipro', label: '全国コンサートツアー', ids: ['horipro_concert_tour'], tier: 4, need: 'horipro', fame: 2000, skill: 'uta' },
  { place: 'nhk', label: '歴史ドラマの主演', ids: ['nhk_history_drama'], tier: 4, fame: 2000, skill: 'engi' },
  { place: 'nhk', label: '凱旋コンサート', ids: ['nhk_encore'], tier: 4, fame: 2000, flag: 'finaleDone', skill: 'uta' },
  { place: 'toei', label: 'ヒーロー映画の主演', ids: ['toei_movie'], tier: 4, fame: 2000, skill: 'engi' },
  { place: 'toho', label: '大作映画の主演', ids: ['toho_movie_lead'], tier: 4, fame: 2000, skill: 'engi' },
  { place: 'sento', label: '銭湯PR大使', ids: ['sento_taishi'], tier: 4, fame: 2000, skill: 'talk' },
  { place: 'takoyaki', label: '商店街のテレビCM', ids: ['takoyaki_cm'], tier: 4, fame: 2000, skill: 'uta' },
];

// Fame needed for each job tier (the economy table in README).
export const TIER_FAME = [0, 30, 250, 1000, 2000];

// true when the state meets the job's conditions (see GUIDE_JOBS).
export function jobOpen(st, j) {
  const agencyOk = !j.need || (j.need === 'agency' ? !!st.agency : st.agency === j.need);
  if (!agencyOk && !(j.orFame != null && st.fame >= j.orFame)) return false;
  if (j.fame && st.fame < j.fame) return false;
  if (j.flag && !(st.flags && st.flags[j.flag])) return false;
  return true;
}
