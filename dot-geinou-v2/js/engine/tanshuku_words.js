// 短縮言葉 bank (owner C / R7-E) for はねるのトびら「短縮鉄道の夜」 (minigame 'tanshuku') and the quiz app (R7-D).
// Every entry: { id, abbr (短縮言葉), full (元の言葉, shown and spoken), yomi (reading of full when it has kanji),
//   from (first year the 短縮 was in common use), to (last year, null = still used), cat, lv (1 easy … 3 hard) }
// Years are conservative (a word is only used in games set in a year it already existed). Company / product / program
// names appear as names only; no person's name (and no program title that contains one) is in the bank.
//
// API (stable):
//   WORDS                         the array (frozen entries)
//   CATS                          { cat: label }
//   wordsFor(year)                → entries in use that year
//   pickWords(year, n, opts)      → n distinct entries for that year; opts { rng, lv: [min,max], cats: [..], exclude: Set(id) }
//   optionsFor(word, n = 4, opts) → n choice strings (word.full + plausible wrong expansions, shuffled); opts { rng, year }
//   isCorrect(word, answer)       → true if the answer (typed / recognised speech) restores the 短縮
//   normalize(str)                → kana-folded, punctuation-free string used for comparisons

export const CATS = { kurashi: 'くらし', mise: 'お店', tv: 'テレビ', kotoba: 'はやり言葉', shakai: '社会', tabemono: '食べ物', basho: '場所', sports: 'スポーツ', gyokai: '業界用語', it: 'IT', tetsudo: '鉄道' };

// [abbr, full, from, to, cat, lv, yomi?]
const RAW = [
  // くらし
  ['コンビニ', 'コンビニエンスストア', 1980, null, 'kurashi', 1],
  ['ファミレス', 'ファミリーレストラン', 1978, null, 'kurashi', 1],
  ['パソコン', 'パーソナルコンピュータ', 1980, null, 'kurashi', 1],
  ['ワープロ', 'ワードプロセッサー', 1982, 2010, 'kurashi', 1],
  ['エアコン', 'エアコンディショナー', 1972, null, 'kurashi', 1],
  ['リモコン', 'リモートコントローラー', 1977, null, 'kurashi', 1],
  ['ラジカセ', 'ラジオカセットレコーダー', 1972, null, 'kurashi', 2],
  ['テレカ', 'テレホンカード', 1983, 2008, 'kurashi', 1],
  ['ポケベル', 'ポケットベル', 1985, 2007, 'kurashi', 1],
  ['ケータイ', '携帯電話', 1993, null, 'kurashi', 1, 'けいたいでんわ'],
  ['スマホ', 'スマートフォン', 2010, null, 'kurashi', 1],
  ['ガラケー', 'ガラパゴスケータイ', 2010, null, 'kurashi', 2],
  ['デジカメ', 'デジタルカメラ', 1996, null, 'kurashi', 1],
  ['カーナビ', 'カーナビゲーション', 1992, null, 'kurashi', 1],
  ['ガソスタ', 'ガソリンスタンド', 1985, null, 'kurashi', 1],
  ['自販機', '自動販売機', 1972, null, 'kurashi', 1, 'じどうはんばいき'],
  ['レンチン', '電子レンジでチンする', 2010, null, 'kurashi', 2, 'でんしレンジでチンする'],
  ['ハイテク', 'ハイテクノロジー', 1983, null, 'kurashi', 2],
  ['マイナカード', 'マイナンバーカード', 2016, null, 'kurashi', 1],
  ['ドラスト', 'ドラッグストア', 2005, null, 'kurashi', 2],
  ['エアロビ', 'エアロビクス', 1982, null, 'kurashi', 1],
  ['トレパン', 'トレーニングパンツ', 1975, null, 'kurashi', 2],
  ['デパート', 'デパートメントストア', 1955, null, 'kurashi', 2],
  ['スーパー', 'スーパーマーケット', 1960, null, 'kurashi', 1],
  ['ドタキャン', '土壇場でキャンセル', 1993, null, 'kurashi', 2, 'どたんばでキャンセル'],
  ['バイト', 'アルバイト', 1965, null, 'kurashi', 1],
  ['パート', 'パートタイム', 1965, null, 'kurashi', 1],
  ['サラ金', 'サラリーマン金融', 1977, null, 'kurashi', 2, 'サラリーマンきんゆう'],
  ['婚活', '結婚活動', 2008, null, 'kurashi', 1, 'けっこんかつどう'],
  ['就活', '就職活動', 1995, null, 'kurashi', 1, 'しゅうしょくかつどう'],
  ['朝活', '朝の活動', 2009, null, 'kurashi', 2, 'あさのかつどう'],
  ['学割', '学生割引', 1960, null, 'kurashi', 1, 'がくせいわりびき'],
  ['国保', '国民健康保険', 1960, null, 'kurashi', 2, 'こくみんけんこうほけん'],
  ['生保', '生命保険', 1960, null, 'kurashi', 3, 'せいめいほけん'],
  ['損保', '損害保険', 1960, null, 'kurashi', 3, 'そんがいほけん'],
  ['高校', '高等学校', 1950, null, 'kurashi', 1, 'こうとうがっこう'],
  ['部活', '部活動', 1970, null, 'kurashi', 1, 'ぶかつどう'],
  ['入試', '入学試験', 1950, null, 'kurashi', 1, 'にゅうがくしけん'],
  ['卒アル', '卒業アルバム', 1990, null, 'kurashi', 1, 'そつぎょうアルバム'],
  ['カテキョ', '家庭教師', 1995, null, 'kurashi', 2, 'かていきょうし'],
  ['ママチャリ', 'ママのチャリンコ', 1985, null, 'kurashi', 2],
  ['チャリ', 'チャリンコ', 1975, null, 'kurashi', 2],
  // お店・ブランド
  ['マック', 'マクドナルド', 1975, null, 'mise', 1],
  ['マクド', 'マクドナルド', 1975, null, 'mise', 1],
  ['ミスド', 'ミスタードーナツ', 1975, null, 'mise', 1],
  ['ケンタ', 'ケンタッキーフライドチキン', 1975, null, 'mise', 1],
  ['モス', 'モスバーガー', 1975, null, 'mise', 1],
  ['スタバ', 'スターバックスコーヒー', 1997, null, 'mise', 1],
  ['ファミマ', 'ファミリーマート', 1985, null, 'mise', 1],
  ['セブン', 'セブン-イレブン', 1980, null, 'mise', 1],
  ['ユニクロ', 'ユニーク・クロージング・ウエアハウス', 1985, null, 'mise', 3],
  ['ドンキ', 'ドン・キホーテ', 1995, null, 'mise', 1],
  ['ロイホ', 'ロイヤルホスト', 1980, null, 'mise', 2],
  ['無印', '無印良品', 1983, null, 'mise', 1, 'むじるしりょうひん'],
  ['ヨドバシ', 'ヨドバシカメラ', 1980, null, 'mise', 1],
  ['ミニスト', 'ミニストップ', 1985, null, 'mise', 2],
  ['TDL', '東京ディズニーランド', 1983, null, 'mise', 1, 'とうきょうディズニーランド'],
  ['TDS', '東京ディズニーシー', 2001, null, 'mise', 1, 'とうきょうディズニーシー'],
  ['USJ', 'ユニバーサル・スタジオ・ジャパン', 2001, null, 'mise', 1],
  ['マンキツ', 'マンガ喫茶', 1997, null, 'mise', 1, 'マンガきっさ'],
  ['ネカフェ', 'ネットカフェ', 2002, null, 'mise', 1],
  ['ゲーセン', 'ゲームセンター', 1980, null, 'mise', 1],
  ['カラオケ', '空オーケストラ', 1977, null, 'mise', 2, 'からオーケストラ'],
  ['ヒトカラ', '一人カラオケ', 2005, null, 'mise', 2, 'ひとりカラオケ'],
  // テレビ（番組名は名前だけ）
  ['はねトび', 'はねるのトびら', 2001, null, 'tv', 1],
  ['めちゃイケ', 'めちゃ×2イケてるッ！', 1996, null, 'tv', 1, 'めちゃめちゃイケてる'],
  ['Mステ', 'ミュージックステーション', 1990, null, 'tv', 1],
  ['いいとも', '笑っていいとも！', 1983, null, 'tv', 1, 'わらっていいとも'],
  ['ひょうきん族', 'オレたちひょうきん族', 1982, null, 'tv', 2, 'おれたちひょうきんぞく'],
  ['ヘキサゴン', 'クイズ！ヘキサゴンII', 2006, null, 'tv', 2, 'クイズヘキサゴンツー'],
  ['しゃべくり', 'しゃべくり007', 2009, null, 'tv', 2, 'しゃべくりゼロゼロセブン'],
  ['めざまし', 'めざましテレビ', 1995, null, 'tv', 1],
  ['エンタ', 'エンタの神様', 2004, null, 'tv', 2, 'エンタのかみさま'],
  ['ポンキッキ', 'ひらけ！ポンキッキ', 1974, 2005, 'tv', 2],
  ['イッテQ', '世界の果てまでイッテQ！', 2007, null, 'tv', 2, 'せかいのはてまでイッテキュー'],
  ['ゴールデン', 'ゴールデンタイム', 1965, null, 'tv', 1],
  ['朝ドラ', '連続テレビ小説', 1975, null, 'tv', 2, 'れんぞくテレビしょうせつ'],
  ['大河', '大河ドラマ', 1970, null, 'tv', 1, 'たいがドラマ'],
  ['月9', '月曜9時のドラマ', 1990, null, 'tv', 1, 'げつようくじのドラマ'],
  ['紅白', '紅白歌合戦', 1955, null, 'tv', 1, 'こうはくうたがっせん'],
  ['レコ大', '日本レコード大賞', 1965, null, 'tv', 2, 'にほんレコードたいしょう'],
  ['地デジ', '地上デジタル放送', 2003, null, 'tv', 1, 'ちじょうデジタルほうそう'],
  ['ワンセグ', 'ワンセグメント放送', 2006, null, 'tv', 2, 'ワンセグメントほうそう'],
  ['CM', 'コマーシャルメッセージ', 1960, null, 'tv', 1],
  ['テレビ', 'テレビジョン', 1955, null, 'tv', 1],
  ['アニメ', 'アニメーション', 1975, null, 'tv', 1],
  ['アニソン', 'アニメソング', 1985, null, 'tv', 1],
  // はやり言葉
  ['あけおめ', 'あけましておめでとう', 1998, null, 'kotoba', 1],
  ['ことよろ', '今年もよろしく', 1998, null, 'kotoba', 1, 'ことしもよろしく'],
  ['KY', '空気が読めない', 2007, null, 'kotoba', 1, 'くうきがよめない'],
  ['アラサー', 'アラウンドサーティー', 2007, null, 'kotoba', 1],
  ['アラフォー', 'アラウンドフォーティー', 2008, null, 'kotoba', 1],
  ['チョベリバ', '超ベリーバッド', 1996, 2001, 'kotoba', 2, 'ちょうベリーバッド'],
  ['チョベリグ', '超ベリーグッド', 1996, 2001, 'kotoba', 2, 'ちょうベリーグッド'],
  ['MK5', 'マジでキレる5秒前', 1997, 2001, 'kotoba', 3, 'マジでキレるごびょうまえ'],
  ['ボディコン', 'ボディコンシャス', 1986, 1996, 'kotoba', 2],
  ['合コン', '合同コンパ', 1985, null, 'kotoba', 1, 'ごうどうコンパ'],
  ['プリクラ', 'プリント倶楽部', 1996, null, 'kotoba', 1, 'プリントクラブ'],
  ['リア充', 'リアルが充実している人', 2008, null, 'kotoba', 2, 'リアルがじゅうじつしているひと'],
  ['パリピ', 'パーティーピープル', 2015, null, 'kotoba', 1],
  ['ワンチャン', 'ワンチャンス', 2012, null, 'kotoba', 1],
  ['ハズい', '恥ずかしい', 2000, null, 'kotoba', 1, 'はずかしい'],
  ['キモい', '気持ち悪い', 1995, null, 'kotoba', 1, 'きもちわるい'],
  ['ムズい', '難しい', 2002, null, 'kotoba', 1, 'むずかしい'],
  ['あざす', 'ありがとうございます', 2008, null, 'kotoba', 1],
  ['りょ', '了解', 2015, null, 'kotoba', 1, 'りょうかい'],
  ['推しメン', '推しているメンバー', 2010, null, 'kotoba', 2, 'おしているメンバー'],
  ['ファンサ', 'ファンサービス', 2010, null, 'kotoba', 1],
  ['ネッ友', 'ネットの友達', 2012, null, 'kotoba', 2, 'ネットのともだち'],
  ['オフ会', 'オフラインミーティング', 1995, null, 'kotoba', 3, 'オフラインミーティング'],
  ['ソロキャン', 'ソロキャンプ', 2020, null, 'kotoba', 1],
  ['サ活', 'サウナ活動', 2019, null, 'kotoba', 2, 'サウナかつどう'],
  ['グランピング', 'グラマラス・キャンピング', 2016, null, 'kotoba', 3],
  ['タイパ', 'タイムパフォーマンス', 2022, null, 'kotoba', 1],
  ['コスパ', 'コストパフォーマンス', 2005, null, 'kotoba', 1],
  ['サブスク', 'サブスクリプション', 2019, null, 'kotoba', 1],
  ['エンタメ', 'エンターテインメント', 1995, null, 'kotoba', 1],
  ['パワハラ', 'パワーハラスメント', 2002, null, 'kotoba', 1],
  ['セクハラ', 'セクシャルハラスメント', 1989, null, 'kotoba', 1],
  ['モラハラ', 'モラルハラスメント', 2008, null, 'kotoba', 2],
  ['カスハラ', 'カスタマーハラスメント', 2019, null, 'kotoba', 2],
  ['コンプラ', 'コンプライアンス', 2012, null, 'kotoba', 2],
  ['ワンオペ', 'ワンオペレーション', 2015, null, 'kotoba', 2],
  ['イメチェン', 'イメージチェンジ', 1980, null, 'kotoba', 1],
  ['ナルシ', 'ナルシスト', 1990, null, 'kotoba', 2],
  ['マザコン', 'マザーコンプレックス', 1975, null, 'kotoba', 1],
  ['テンアゲ', 'テンションが上がる', 2012, null, 'kotoba', 2, 'テンションがあがる'],
  ['ドンマイ', 'ドント・マインド', 1965, null, 'kotoba', 2],
  ['アポ', 'アポイントメント', 1980, null, 'kotoba', 1],
  ['インフラ', 'インフラストラクチャー', 1990, null, 'kotoba', 2],
  ['メタボ', 'メタボリックシンドローム', 2006, null, 'kotoba', 1],
  ['インフル', 'インフルエンザ', 2009, null, 'kotoba', 1],
  ['リハビリ', 'リハビリテーション', 1975, null, 'kotoba', 1],
  ['マスコミ', 'マスコミュニケーション', 1960, null, 'kotoba', 1],
  ['ゼネコン', 'ゼネラル・コントラクター', 1990, null, 'kotoba', 3],
  ['アメフト', 'アメリカンフットボール', 1970, null, 'sports', 1],
  // 社会
  ['NHK', '日本放送協会', 1950, null, 'shakai', 1, 'にっぽんほうそうきょうかい'],
  ['JR', '日本旅客鉄道', 1987, null, 'shakai', 1, 'にほんりょかくてつどう'],
  ['NTT', '日本電信電話', 1985, null, 'shakai', 2, 'にっぽんでんしんでんわ'],
  ['JA', '農業協同組合', 1992, null, 'shakai', 2, 'のうぎょうきょうどうくみあい'],
  ['OL', 'オフィスレディ', 1965, null, 'shakai', 1],
  ['GW', 'ゴールデンウィーク', 1955, null, 'shakai', 1],
  ['ATM', '現金自動預け払い機', 1985, null, 'shakai', 3, 'げんきんじどうあずけばらいき'],
  ['UFO', '未確認飛行物体', 1970, null, 'shakai', 2, 'みかくにんひこうぶったい'],
  ['センター試験', '大学入試センター試験', 1990, 2020, 'shakai', 2, 'だいがくにゅうしセンターしけん'],
  ['共通テスト', '大学入学共通テスト', 2021, null, 'shakai', 2, 'だいがくにゅうがくきょうつうテスト'],
  ['特養', '特別養護老人ホーム', 1990, null, 'shakai', 3, 'とくべつようごろうじんホーム'],
  ['生協', '生活協同組合', 1960, null, 'shakai', 2, 'せいかつきょうどうくみあい'],
  ['経団連', '日本経済団体連合会', 2002, null, 'shakai', 3, 'にほんけいざいだんたいれんごうかい'],
  ['国連', '国際連合', 1956, null, 'shakai', 1, 'こくさいれんごう'],
  ['安保', '安全保障', 1960, null, 'shakai', 2, 'あんぜんほしょう'],
  ['原発', '原子力発電所', 1970, null, 'shakai', 2, 'げんしりょくはつでんしょ'],
  ['選管', '選挙管理委員会', 1950, null, 'shakai', 2, 'せんきょかんりいいんかい'],
  ['衆院', '衆議院', 1950, null, 'shakai', 2, 'しゅうぎいん'],
  ['参院', '参議院', 1950, null, 'shakai', 2, 'さんぎいん'],
  ['都知事', '東京都知事', 1950, null, 'shakai', 2, 'とうきょうとちじ'],
  ['労基', '労働基準監督署', 1980, null, 'shakai', 3, 'ろうどうきじゅんかんとくしょ'],
  ['ハロワ', 'ハローワーク', 2005, null, 'shakai', 2],
  ['ゆとり', 'ゆとり教育', 2002, null, 'shakai', 2, 'ゆとりきょういく'],
  ['オリパラ', 'オリンピック・パラリンピック', 2016, null, 'shakai', 1],
  ['エコ', 'エコロジー', 1990, null, 'shakai', 1],
  ['ODA', '政府開発援助', 1980, null, 'shakai', 3, 'せいふかいはつえんじょ'],
  // 食べ物
  ['ポテチ', 'ポテトチップス', 1980, null, 'tabemono', 1],
  ['アイス', 'アイスクリーム', 1960, null, 'tabemono', 1],
  ['チョコ', 'チョコレート', 1960, null, 'tabemono', 1],
  ['チューハイ', '焼酎ハイボール', 1984, null, 'tabemono', 2, 'しょうちゅうハイボール'],
  ['オムライス', 'オムレツライス', 1960, null, 'tabemono', 2],
  ['デパ地下', 'デパートの地下食料品売り場', 2000, null, 'tabemono', 2, 'デパートのちかしょくりょうひんうりば'],
  ['ハンバーグ', 'ハンバーグステーキ', 1965, null, 'tabemono', 2],
  ['カツ', 'カツレツ', 1960, null, 'tabemono', 2],
  ['ジャンク', 'ジャンクフード', 1990, null, 'tabemono', 2],
  ['スイパラ', 'スイーツパラダイス', 2005, null, 'tabemono', 2],
  ['冷やし中華', '冷やし中華そば', 1965, null, 'tabemono', 2, 'ひやしちゅうかそば'],
  ['駅弁', '駅売り弁当', 1955, null, 'tetsudo', 2, 'えきうりべんとう'],
  // 場所
  ['アキバ', '秋葉原', 1995, null, 'basho', 1, 'あきはばら'],
  ['ブクロ', '池袋', 1980, null, 'basho', 1, 'いけぶくろ'],
  ['ジュク', '新宿', 1975, null, 'basho', 2, 'しんじゅく'],
  ['ハマ', '横浜', 1970, null, 'basho', 2, 'よこはま'],
  ['マルキュー', '渋谷109', 1996, null, 'basho', 1, 'しぶやいちまるきゅう'],
  ['関空', '関西国際空港', 1994, null, 'basho', 1, 'かんさいこくさいくうこう'],
  ['首都高', '首都高速道路', 1965, null, 'basho', 1, 'しゅとこうそくどうろ'],
  ['東名', '東名高速道路', 1969, null, 'basho', 2, 'とうめいこうそくどうろ'],
  ['東大', '東京大学', 1950, null, 'basho', 1, 'とうきょうだいがく'],
  ['京大', '京都大学', 1950, null, 'basho', 1, 'きょうとだいがく'],
  ['日大', '日本大学', 1950, null, 'basho', 1, 'にほんだいがく'],
  ['阪大', '大阪大学', 1950, null, 'basho', 2, 'おおさかだいがく'],
  ['NSC', '吉本総合芸能学院', 1982, null, 'basho', 2, 'よしもとそうごうげいのうがくいん'],
  ['MARCH', '明治・青山学院・立教・中央・法政', 1980, null, 'basho', 3, 'めいじ・あおやまがくいん・りっきょう・ちゅうおう・ほうせい'],
  ['関関同立', '関西・関西学院・同志社・立命館', 1980, null, 'basho', 3, 'かんさい・かんせいがくいん・どうししゃ・りつめいかん'],
  // スポーツ
  ['W杯', 'ワールドカップ', 1970, null, 'sports', 1],
  ['Jリーグ', '日本プロサッカーリーグ', 1993, null, 'sports', 2, 'にほんプロサッカーリーグ'],
  ['センバツ', '選抜高等学校野球大会', 1950, null, 'sports', 2, 'せんばつこうとうがっこうやきゅうたいかい'],
  ['インターハイ', '全国高等学校総合体育大会', 1965, null, 'sports', 3, 'ぜんこくこうとうがっこうそうごうたいいくたいかい'],
  ['箱根駅伝', '東京箱根間往復大学駅伝競走', 1950, null, 'sports', 3, 'とうきょうはこねかんおうふくだいがくえきでんきょうそう'],
  ['F1', 'フォーミュラ・ワン', 1976, null, 'sports', 1],
  ['PK', 'ペナルティキック', 1970, null, 'sports', 1],
  ['MVP', 'モースト・バリュアブル・プレーヤー', 1970, null, 'sports', 2],
  ['MLB', 'メジャーリーグベースボール', 1995, null, 'sports', 2],
  ['セ・リーグ', 'セントラル・リーグ', 1950, null, 'sports', 1],
  ['パ・リーグ', 'パシフィック・リーグ', 1950, null, 'sports', 1],
  ['ドラ1', 'ドラフト1位', 1990, null, 'sports', 1, 'ドラフトいちい'],
  ['バレー', 'バレーボール', 1960, null, 'sports', 1],
  ['バスケ', 'バスケットボール', 1965, null, 'sports', 1],
  ['ハンド', 'ハンドボール', 1970, null, 'sports', 2],
  ['ソフト', 'ソフトボール', 1965, null, 'sports', 2],
  // 業界用語
  ['AD', 'アシスタントディレクター', 1975, null, 'gyokai', 1],
  ['カンペ', 'カンニングペーパー', 1975, null, 'gyokai', 1],
  ['ロケ', 'ロケーション撮影', 1955, null, 'gyokai', 1, 'ロケーションさつえい'],
  ['ギャラ', 'ギャランティー', 1965, null, 'gyokai', 1],
  ['リハ', 'リハーサル', 1970, null, 'gyokai', 1],
  ['ゲネプロ', 'ゲネラルプローベ', 1970, null, 'gyokai', 3],
  ['マネ', 'マネージャー', 1980, null, 'gyokai', 2],
  ['マイク', 'マイクロホン', 1950, null, 'gyokai', 1],
  ['アンプ', 'アンプリファイア', 1970, null, 'gyokai', 2],
  ['ナレ', 'ナレーション', 1985, null, 'gyokai', 2],
  ['MC', 'マスター・オブ・セレモニー', 1985, null, 'gyokai', 2],
  // IT
  ['PC', 'パーソナルコンピュータ', 1985, null, 'it', 1],
  ['AI', '人工知能', 1985, null, 'it', 1, 'じんこうちのう'],
  ['IT', '情報技術', 2000, null, 'it', 1, 'じょうほうぎじゅつ'],
  ['GPS', '全地球測位システム', 1995, null, 'it', 3, 'ぜんちきゅうそくいシステム'],
  ['LED', '発光ダイオード', 2000, null, 'it', 2, 'はっこうダイオード'],
  ['CD', 'コンパクトディスク', 1983, null, 'it', 1],
  ['MD', 'ミニディスク', 1993, 2013, 'it', 1],
  ['DVD', 'デジタル・バーサタイル・ディスク', 1997, null, 'it', 3],
  ['USB', 'ユニバーサル・シリアル・バス', 2000, null, 'it', 3],
  ['ネット', 'インターネット', 1996, null, 'it', 1],
  ['HP', 'ホームページ', 1997, null, 'it', 1],
  ['メアド', 'メールアドレス', 1999, null, 'it', 1],
  ['メルマガ', 'メールマガジン', 2000, null, 'it', 1],
  ['ブログ', 'ウェブログ', 2004, null, 'it', 2],
  ['SNS', 'ソーシャル・ネットワーキング・サービス', 2005, null, 'it', 2],
  ['アプリ', 'アプリケーション', 2009, null, 'it', 1],
  ['DL', 'ダウンロード', 2002, null, 'it', 1],
  ['スクショ', 'スクリーンショット', 2013, null, 'it', 1],
  ['インスタ', 'インスタグラム', 2015, null, 'it', 1],
  ['ネトフリ', 'ネットフリックス', 2016, null, 'it', 1],
  ['アマプラ', 'アマゾンプライム', 2016, null, 'it', 1],
  ['ネトゲ', 'ネットゲーム', 2002, null, 'it', 1],
  ['ソシャゲ', 'ソーシャルゲーム', 2011, null, 'it', 1],
  ['ファミコン', 'ファミリーコンピュータ', 1983, null, 'it', 1],
  ['スーファミ', 'スーパーファミコン', 1991, null, 'it', 1],
  ['プレステ', 'プレイステーション', 1995, null, 'it', 1],
  ['VR', 'バーチャルリアリティ', 2016, null, 'it', 2],
  ['AR', 'オーグメンテッド・リアリティ', 2017, null, 'it', 3],
  ['VTuber', 'バーチャルユーチューバー', 2018, null, 'it', 2],
  ['QR', 'クイックレスポンス', 2005, null, 'it', 3],
  ['Vlog', 'ビデオブログ', 2018, null, 'it', 2],
  ['ハンネ', 'ハンドルネーム', 1995, null, 'it', 2],
  ['ノーパソ', 'ノートパソコン', 1995, null, 'it', 2],
  // 鉄道（このコーナーの舞台）
  ['SL', 'スチーム・ロコモティブ', 1960, null, 'tetsudo', 2],
  ['EL', 'エレクトリック・ロコモティブ', 1960, null, 'tetsudo', 3],
  ['国鉄', '日本国有鉄道', 1950, 2010, 'tetsudo', 2, 'にほんこくゆうてつどう'],
  ['終電', '終電車', 1950, null, 'tetsudo', 1, 'しゅうでんしゃ'],
  ['始発', '始発電車', 1950, null, 'tetsudo', 1, 'しはつでんしゃ'],
  ['各停', '各駅停車', 1960, null, 'tetsudo', 1, 'かくえきていしゃ'],
  ['特急', '特別急行', 1950, null, 'tetsudo', 2, 'とくべつきゅうこう'],
  ['ブルトレ', 'ブルートレイン', 1975, null, 'tetsudo', 2],
  ['ラッシュ', 'ラッシュアワー', 1960, null, 'tetsudo', 1],
  ['リニア', 'リニアモーターカー', 1985, null, 'tetsudo', 1],
  ['定期', '定期乗車券', 1950, null, 'tetsudo', 2, 'ていきじょうしゃけん'],
  ['鉄オタ', '鉄道オタク', 2000, null, 'tetsudo', 1, 'てつどうオタク'],
  ['撮り鉄', '鉄道写真を撮るファン', 2005, null, 'tetsudo', 2, 'てつどうしゃしんをとるファン'],
  ['乗り鉄', '鉄道に乗るのが好きなファン', 2005, null, 'tetsudo', 2, 'てつどうにのるのがすきなファン'],
];

export const WORDS = RAW.map(([abbr, full, from, to, cat, lv, yomi], i) => Object.freeze({
  id: 'w' + String(i).padStart(3, '0'), abbr, full, yomi: yomi || null, from, to: to ?? null, cat, lv,
}));

// ------------------------------------------------------------------ helpers
const KATA = /[ァ-ヶ]/g;
export function normalize(s) {
  return String(s || '')
    .replace(KATA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[・\s　、。！!？?「」（）()\-ー〜~×＝=]/g, (c) => (c === 'ー' ? 'ー' : ''))
    .toLowerCase();
}
export function isCorrect(word, answer) {
  if (!word || answer == null) return false;
  const a = normalize(answer);
  if (!a) return false;
  const targets = [word.full, word.yomi].filter(Boolean).map(normalize);
  return targets.some((t) => t === a || (a.length >= 3 && (t.includes(a) && a.length >= t.length * 0.8)));
}
export const inUse = (w, year) => w.from <= year && (w.to == null || year <= w.to);
export function wordsFor(year) {
  const y = Number(year) || 2026;
  return WORDS.filter((w) => inUse(w, y));
}
const rnd = (rng) => (typeof rng === 'function' ? rng : Math.random);
export function pickWords(year, n = 10, opts = {}) {
  const r = rnd(opts.rng);
  const [lo, hi] = opts.lv || [1, 3];
  let pool = wordsFor(year).filter((w) => w.lv >= lo && w.lv <= hi && (!opts.cats || opts.cats.includes(w.cat)) && !(opts.exclude && opts.exclude.has(w.id)));
  // the same full form (マック / マクド) only once per game
  const out = [];
  const seenFull = new Set();
  pool = pool.slice();
  while (out.length < n && pool.length) {
    const w = pool.splice(Math.floor(r() * pool.length), 1)[0];
    if (seenFull.has(w.full)) continue;
    seenFull.add(w.full);
    out.push(w);
  }
  return out;
}
// n choices: the right one + wrong expansions that look plausible (same category / same first sound / similar length)
export function optionsFor(word, n = 4, opts = {}) {
  const r = rnd(opts.rng);
  const year = Number(opts.year) || 2026;
  const pool = wordsFor(year).filter((w) => w.full !== word.full && w.abbr !== word.abbr);
  const first = normalize(word.abbr)[0];
  const score = (w) => (w.cat === word.cat ? 2 : 0) + (normalize(w.full)[0] === first ? 3 : 0) + (Math.abs(Array.from(w.full).length - Array.from(word.full).length) <= 3 ? 1 : 0) + r() * 2.5;
  const ranked = pool.map((w) => [score(w), w]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const out = [word.full];
  for (const w of ranked) { if (out.length >= n) break; if (!out.includes(w.full)) out.push(w.full); }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export const BANK_INFO = { count: WORDS.length, years: [Math.min(...WORDS.map((w) => w.from)), 2026] };
