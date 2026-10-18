// てちょう（メニュー → てちょう）で使う案内データ。js/engine/notebook.js が読みます。
//
//   GUIDE[placeId]  { town, name, short, hint, lines, audition }
//     town      'tokyo' | 'namba'（ドット商店街 'machi'・テレビ局エリア 'minato' の場所も 'tokyo'：
//               てちょうの色分けは2つの町だけ）
//     name      てちょうに出す名前（行ったことのある場所だけ表示）
//     short     おすすめのお仕事の横に出す短い名前
//     hint      まだ行っていない時の一行ヒント（「？？？」の下に出る）
//     lines     できることの要約（10px の文字で 1行 約27文字 × 2〜3行）
//     audition  事務所オーディションがある（合格で所属）
//   GUIDE_ORDER   「ばしょ」タブの並び順
//   AUDITIONS     事務所オーディションの一覧（もくひょう：未所属の時）
//   GUIDE_JOBS    おもなお仕事（もくひょう：おすすめ／きろく：よく受けたお仕事）
//     need    undefined = だれでも / 'agency' = どこかに所属 / 事務所ID = その事務所に所属
//     orFame  need を満たしていなくても、この★以上ならOK（「所属 または ★30」など）
//     fame    ★の条件 / flag  必要なフラグ / tier  経済の段階（0〜4）
//
// 内容は各施設のファイル（js/places/*.js, js/world/*.js）に合わせてあります。
// お仕事や条件を変えたら、ここも直してください。

export const TOWNS = { tokyo: '東京', namba: 'なんば' };

export const GUIDE = {
  // ---------------------------------------------------------------- 東京
  tokyo: {
    town: 'tokyo', name: '東京エリアの街', short: '公園',
    hint: '',
    lines: ['公園のステージで路上漫才・路上ライブ（だれでも）', '街の人の話に、事務所やお仕事のヒントがいっぱい', '大通りを西へ「ドット商店街」、東へ「テレビ局エリア」'],
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
    hint: '東京の南東、線路ぞいの大きな駅（バス停も）',
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
    lines: ['漫才のオーディション／漫才・トークのレッスン', '前説（だれでも）・若手ライブ（所属）・大喜利★250', '冠番組★1000・グランプリ決勝★2000（所属）'],
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
    lines: ['暮らしの街。食材・カフェ・ジム・カラオケ・不動産屋など', '公園でジョギング（無料）・ベンチや看板ネコでひと休み', '東京駅前とバスでつながっている（¥210）'],
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
    lines: ['坂の上のテレビ局。ドラマや音楽番組でおなじみ', '受付で番組のゲスト出演（★の条件あり）'],
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
    lines: ['お笑いの本場・大阪。劇場や事務所が集まる街', '大阪のおばちゃんが1日1回アメちゃんをくれる', '東の川ぞいに MBS毎日放送・関西テレビ・屋台'],
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
    hint: 'なんばの南の駅',
    lines: ['電車と新幹線で東京へ（¥3,000）'],
  },
  shinkigeki: {
    town: 'namba', name: 'よしもと新喜劇 劇場', short: '新喜劇', audition: true,
    hint: 'なんばの北西（左上）の大きな劇場',
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
};

export const GUIDE_ORDER = [
  'tokyo', 'home', 'konbini', 'sento', 'station_tokyo',
  'yoshimoto', 'bs_yoshimoto', 'grape', 'horipro', 'toho', 'toei', 'nhk',
  'machi', 'super', 'hanaya', 'ramen', 'cafe', 'salon', 'famires', 'gym', 'karaoke', 'fudousan', 'kagu', 'mansion', 'tower',
  'minato', 'ntv', 'tbs', 'tvasahi', 'fujitv', 'tvtokyo',
  'namba', 'station_namba', 'shinkigeki', 'shochiku', 'takoyaki', 'hotel', 'mbs', 'ktv', 'jikka',
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
  { place: 'tvasahi', label: 'トーク番組の前説', ids: ['tvasahi_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'fujitv', label: 'コントの通行人役', ids: ['fujitv_tsukonin'], tier: 0, skill: 'engi' },
  { place: 'tvtokyo', label: 'ロケのお手伝い', ids: ['tvtokyo_kosho'], tier: 0, skill: 'talk' },
  { place: 'mbs', label: '収録前の前説', ids: ['mbs_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'mbs', label: '観覧の盛り上げ役', ids: ['mbs_kanran'], tier: 0, skill: 'warai' },
  { place: 'mbs', label: '商店街ロケのお手伝い', ids: ['mbs_loke'], tier: 0, skill: 'talk' },
  { place: 'ktv', label: '収録前の前説', ids: ['ktv_maesetsu'], tier: 0, skill: 'talk' },
  { place: 'ktv', label: '観覧の盛り上げ役', ids: ['ktv_kanran'], tier: 0, skill: 'warai' },
  { place: 'ktv', label: '商店街ロケのお手伝い', ids: ['ktv_loke'], tier: 0, skill: 'talk' },
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
  { place: 'yoshimoto', label: 'お笑いグランプリ決勝', ids: ['yoshimoto_gp_final'], tier: 4, need: 'yoshimoto', fame: 2000, skill: 'warai' },
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
