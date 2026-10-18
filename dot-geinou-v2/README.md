# ドット芸能界 〜めざせ！国民的スター〜（v2）

事務所やテレビ局、劇場、撮影所でお仕事・レッスン・オーディションをこなしながら、
「国民的スター」を目指す 2D ドット絵 RPG です。ブラウザだけで動きます（ビルド不要）。

v2 では、画面が **640×360 の高解像度ドット絵** になり、芸能活動に **暮らし（ライフシミュレーション）** が加わりました。

- **生活ステータス**：体力に加えて「満腹」「ストレス」「身だしなみ」の3つのゲージ。食事・お風呂・息抜きで整えると、ミニゲームの調子が上がります
- **暮らしとキャリア**：曜日つきの日付、毎週月曜の家賃、引っ越しと家具、自炊、ドット商店街での買い物と趣味。
  ファン、SNS「ドッター」、レギュラー番組、自分の冠番組、毎週の好感度ランキング
- **人間関係**：16人の仲間と、話す・プレゼント・おでかけで仲良くなれます。ハートイベント、相方、「大切な人」も
- **スマホ**：メッセージ・連絡先・予定・家計・ドッター

時間帯や季節はありません。ベッドで寝るまでが「その日」で、寝ると次の日（曜日がひとつ進む）になります。

---

## あそびかた

### 起動

```bash
# このディレクトリで静的サーバーを立てて、ブラウザで開くだけ
cd dot-geinou-v2
python3 -m http.server 8765
# → http://localhost:8765/ （index.html が開きます）
```

ES モジュールを使っているので、`index.html` をファイルのまま（`file://`）開いても動きません。かならずサーバー経由で開いてください。
1ファイルにまとめた配布版（HTML をそのまま開いて遊べるもの）は、あとで追加する予定です（いまはありません）。

### 操作

| 操作 | キーボード | スマホ・タブレット |
| --- | --- | --- |
| 移動 | 矢印キー / WASD | 十字パッド |
| 話す・調べる・決定（A） | Z / Space / Enter / J | A ボタン（画面タップでも可） |
| キャンセル・ダッシュ（B） | X / Shift / Backspace / K（押しながら移動でダッシュ） | B ボタン |
| メニュー | Esc / C / Q | MENU |
| 音のオン・オフ | M | メニューの「音：ON／OFF」 |

- タッチ操作の画面パッドは、スマホ・タブレットでは最初から、タッチ対応のパソコンでは画面に触れたときに出ます（キーを押すと消えます）。
  MENU ボタンの上のボタンで全画面にできます（対応しているブラウザのみ）。スマホは横向きがおすすめです。
- **メニュー**：スマホ／ステータス／もちもの／てちょう／セーブ／音／とじる。
- 会話中は B を押している間、文字が速く流れます。リストは ↑↓ で選んで A、B でもどります。

### 画面の見かた（HUD）

- **左上**：日付（`12日目（金）`）・所持金・知名度（★）・称号
- **右上**：所属事務所・未読メッセージ（封筒マーク）・体力・満腹／ストレス／身なり（身だしなみ）のゲージ。
  ゲージがペナルティの線をこえると、名前が赤く点滅します

> 実在の企業名・ロゴ（`assets/logos/`）は各社の商標・著作物です。本作は非公式のファンゲームで、
> 登場人物・番組名・お店はすべて架空です。公開・配布する場合は権利関係にご注意ください。
> フォント：DotGothic16（SIL Open Font License 1.1, `assets/fonts/OFL.txt`）。

---

## プレイガイド

### 目標

知名度（★）を上げて **★4000**（国民的スター）を目指します。★4000 に届いて街に出ると NHK から電話がかかり、
NHK放送センターで年末の大型歌番組に出演 → エンディング（スタッフロール）。その後も遊び続けられます。

称号：無名 → 駆け出し（★30）→ 若手（★100）→ 注目株（★250）→ 人気者（★500）→ 売れっ子（★1000）→ スター（★2000）→ 国民的スター（★4000）

はじめは所持金 ¥3,000・おにぎり2個。ドット荘（自宅）の部屋からスタートします。
部屋の前にいる大家さんに話しかけると、暮らしの基本を教えてくれます。

### 1日の流れ（例）

1. 朝：スマホを見る（友だちのおさそい、番組のオファー、家賃の明細）。HUD のゲージを確認
2. 食事をしてから、お仕事・レッスン・オーディションへ（体力を使い、満腹と身だしなみが減り、ストレスがたまる）
3. おなかが空いたら何か食べる。ストレスがたまったら、趣味や友だちとのおでかけで気分転換
4. お風呂でさっぱりして、夜はベッドで寝る → 体力全快・次の日に・自動セーブ

迷ったら **メニュー → てちょう** の「もくひょう」に、いまやるべきことが出ています。

### 街と場所

- **東京エリア**：NHK放送センター、ホリプロ、東宝、東映 撮影所、よしもと 東京本部、BSよしもと、グレープカンパニー、
  自宅（ドット荘）、コンビニ（ドットマート）、銭湯（ドットの湯）、東京駅、公園の路上ステージ
- **ドット商店街**（東京の大通りを西のはしまで。東京駅前からバス ¥210）：スーパー、花とギフトのお店、ラーメン屋、カフェ、
  美容院、コインランドリー、たい焼き屋、ファミレス、ジム、カラオケ、不動産屋、家具屋、公園（ジョギングコース）、住宅街
- **なんばエリア（大阪）**：よしもと新喜劇 劇場、松竹芸能、たこ焼き屋、ホテル、なんば駅
  （東京駅から新幹線と電車で ¥3,000。帰りの運賃も残しておくと安心）

### 事務所とオーディション

事務所のオーディション（ミニゲーム）に合格すると、所属タレントになれます。所属は1つだけ。
別の事務所に受かると、移籍するかどうか選べます。

| 事務所 | オーディションの場所 | 内容 | 得意分野 |
| --- | --- | --- | --- |
| よしもと | よしもと 東京本部／よしもと新喜劇（なんば） | 漫才／ズッコケ | お笑い |
| グレープカンパニー | グレープカンパニー | コント演技 | お笑い |
| ホリプロ | ホリプロ | 歌か演技 | 演技 |
| 松竹芸能 | 松竹芸能（なんば） | トーク | お笑い |

所属すると受けられるお仕事が増え、**得意分野のお仕事はギャラと知名度が1.1倍** になります。

### お仕事と★の段階

お仕事はミニゲームで、結果のランク（S/A/B/C/D）でギャラ・知名度・ファン・スキルが決まります。
告知の「ギャラ 目安¥3,000（出来で変動）」はランク B の額です。

| 段階 | 条件の目安 | ギャラ（B） | 知名度 |
| --- | --- | --- | --- |
| 0 | だれでも（公園の路上ライブ、前説、エキストラ、バイト…） | ¥500〜1,500 | 3〜8 |
| 1 | 所属 または ★30 | ¥3,000〜6,000 | 10〜25 |
| 2 | ★250 | ¥8,000〜15,000 | 30〜60 |
| 3 | ★1000 | ¥20,000〜40,000 | 80〜150 |
| 4 | ★2000 | ¥50,000〜80,000 | 150〜300 |

ランクの倍率：S ×1.5 / A ×1.2 / B ×1.0 / C ×0.7 / D ×0.4。
お仕事のたびに 満腹 -10・ストレス +8・身だしなみ -10（ランク S ならストレス -4 のおまけ、D なら +3）。

### レッスンと自主練

- **レッスン**：各施設で ¥2,000〜8,000、スキル +3〜6（ミニゲームつきのレッスンは出来しだいで増減）
- **自主練**：家のパソコンで無料・体力 -10・スキル +1（1日3回まで）
- **プロの個別指導**：家のパソコンで ¥20,000・体力 -15・スキル +5（1日1回）
- 家具の本棚（トーク +1）・ドレッサー（演技 +1）・防音ブース（歌 +3）、カラオケ（歌 +1、1日3曲まで）でも伸ばせます

スキルは お笑い／演技／歌／トーク（最大100）。高いほどミニゲームがやさしくなります。

### ミニゲーム

| ミニゲーム | 内容 | 操作 |
| --- | --- | --- |
| ツッコミ | 相方のボケにタイミングよくツッコむ（フリは見送る） | A |
| ズッコケ | 新喜劇風。座長のギャグのオチでいっせいにズッコケる | A |
| リズム | 歌・ダンス。流れてくるノーツに合わせて押す | A／←→／←↓↑→ |
| コマンド演技 | 殺陣・変身ポーズ・怪獣・感情演技・ダンスのコマンド入力 | 十字キー＋A／B |
| クイズ | 4択クイズ。B でヒント（50:50） | 十字キー＋A |
| 原稿読み | ニュース原稿の難読漢字を、正しく読む | ↑↓＋A |
| トーク | 番組で、司会のふりに最高の返しを選ぶ | ↑↓＋A |

ミニゲームの難しさは、スキルと **調子** で変わります（開始前のカードに内訳が出ます）。

- スキルが高いほどやさしい。アイテム（ネタ帳・のどあめ・台本メモ・話題の雑誌など）で、次の1回だけさらにやさしく
- 絶好調（満腹50以上・ストレス30以下・身だしなみ70以上）でやさしく、はらぺこ・ストレスで難しく
- 相方がいると、お笑いのミニゲームが少しやさしくなる

### 暮らし：3つのゲージ

| ゲージ | 減る・増える | 悪いと… | 整えるには |
| --- | --- | --- | --- |
| **満腹**（100＝おなかいっぱい） | お仕事・レッスン・歩く・ひと晩で減る | 20未満：ミニゲームが難しく（-20%）、夜よく眠れない（体力が75%までしか戻らない）。0：何か食べるまで力が出ない（お仕事できない） | 食べる・自炊 |
| **ストレス**（0＝すっきり） | お仕事・オーディション・レッスン・家賃の未払いでたまる | 70以上：ミニゲームが難しく（-15%）。100：燃え尽きて、お仕事・レッスン・オーディション・番組出演ができない | 眠る、休みの日、趣味、カフェ、お風呂、家具、友だちとのおでかけ |
| **身だしなみ**（100＝ピカピカ） | お仕事・歩く・ひと晩で減る | 30未満：お仕事の知名度とファンが2割減、人の好感度が上がりにくい（半分） | お風呂・シャワー・銭湯・美容院・コインランドリー・ヘアワックス |

ゲージが線をこえると、トーストで知らせてくれます（はじめての時は説明つき）。くわしい助言は てちょう の「せいかつ」タブに出ます。

### 食事と自炊

- 食べ物は体力と満腹を回復します。**満腹が90以上だと食べられません**。おなかいっぱい気味で食べると、体力はあまり回復しません
- どこで食べる？：コンビニ、商店街（お惣菜・お弁当・ラーメン・ファミレス・カフェ・たい焼き）、各施設の売店、なんばのたこ焼き
- **自炊**：家のキッチンで料理。スーパー まるどっとで食材を買っておきます（**毎週水曜は食材とお惣菜が2割引**）。
  食材がなくても ¥100 の「もやし炒め」はいつでも作れます

| 料理 | 材料 | 体力 | 満腹 | ストレス |
| --- | --- | --- | --- | --- |
| 卵かけごはん | お米・卵 | +20 | +35 | -3 |
| 卵焼き | 卵×2 | +14 | +20 | -4 |
| とうふのみそ汁 | 豆腐・みそ | +12 | +18 | -8 |
| 肉野菜炒め | 豚こま肉・キャベツ | +35 | +45 | -4 |
| マーボー豆腐 | 豆腐・豚こま肉 | +32 | +42 | -6 |
| ソース焼きそば | 焼きそば麺・キャベツ・豚こま肉 | +42 | +55 | -6 |
| お好み焼き | キャベツ・卵・豚こま肉 | +40 | +55 | -8 |
| 親子丼 | お米・卵・鶏もも肉 | +45 | +60 | -6 |
| 焼き鮭定食 | お米・鮭の切り身・みそ | +48 | +60 | -8 |
| オムライス | お米・卵×2・鶏もも肉 | +52 | +62 | -12 |
| カレーライス（2皿分） | お米×2・カレールウ・野菜セット・豚こま肉 | +50 | +65 | -10 |

- 卵かけごはんとみそ汁以外は **お弁当** につめておけます（もちものから、いつでも食べられる）
- 作った回数で料理の腕が上がります：自炊じょうず（10回）で効果 +10%、家庭料理の達人（30回）で +20%

### 眠りと朝

ベッドで寝ると、体力が全快して次の日になり、自動でセーブされます。ひと晩で 満腹 -30・身だしなみ -20。
朝は家のシャワーで身だしなみ +35。ストレスは住まいと家具に応じて減ります。

- **休みの日**：お仕事・レッスン・オーディションをしなかった日の翌朝は、ストレスがさらに -20
- おなかが空いたまま寝ると、よく眠れません（体力 75% まで・ストレス +5）
- なんばのホテル（1泊 ¥3,000、★2000 で招待）でも寝られます。お金がなくて疲れている時は、たこ焼き屋の大将が店の奥で休ませてくれます

### 家賃と住まい

- 家賃は **毎週月曜の朝** に所持金から自動で払われます（1日目が月曜。最初の家賃は8日目）
- 足りない分は **未払い** になり、ストレスがたまっていきます。お金ができたらスマホの「家計」から払いましょう（一部だけでも払えます）。
  追い出されることはありません

| 住まい | 条件 | 家賃（週） | 引っ越し費用 | 寝るとストレス | 家具 | 設備 |
| --- | --- | --- | --- | --- | --- | --- |
| ドット荘 | 最初の家 | ¥8,000 | ¥3,000（お金がなければ無料） | -15 | 4つまで | ユニットバス・キッチン・やさしい大家さん |
| ドットレジデンス | ★250 | ¥30,000 | ¥60,000 | -22 | 6つまで | お風呂（1日1回ストレス -6）・システムキッチン |
| ドットタワー | ★1000 | ¥90,000 | ¥250,000 | -30 | 8つまで | ジェットバス（1日1回ストレス -10）・夜景の窓・コンシェルジュ |

- 引っ越しは商店街の **ドット不動産** で（内見もできます）。未払いの家賃があると、ドット荘以外とは契約できません。
  条件の★に届くと、不動産屋からメッセージが届きます
- ドット荘の **大家さんのリフォーム**：¥50,000／¥200,000／¥500,000 で、体力の最大値が 110／120／130 に
- **家具**（商店街の **ドット家具**）：持っている間ずっと効果があり、引っ越しても一緒に運ばれます。置ける数は住まいしだいで、
  いらない家具は半額で引き取ってもらえます。家の中で家具を調べると使えます

| 家具 | 値段 | 効果 |
| --- | --- | --- |
| 観葉植物セット | ¥5,000 | 毎朝ストレス -1・水やりで -3 |
| ストレッチマット | ¥8,000 | 体力の最大値 +2（一度だけ）・ストレッチで -4 |
| 本棚 | ¥20,000 | 1日1回 読書でトーク +1（体力 -5） |
| ふかふかソファ | ¥25,000 | 毎朝ストレス -3・ひと休みで -5 |
| ドレッサー | ¥30,000 | 毎朝 身だしなみ +20・鏡の前の練習で演技 +1（1日1回） |
| こたつ | ¥35,000 | 毎朝ストレス -3・ぬくぬくで -6 |
| ふかふかベッド | ¥40,000 | 寝るとストレス さらに -6 |
| アクアリウム | ¥60,000 | 毎朝ストレス -5・ながめて -6 |
| 大型テレビ | ¥80,000 | 毎朝ストレス -6・番組を見て -8 |
| ランニングマシン | ¥90,000 | 体力の最大値 +6（一度だけ）・走って気分転換 |
| マッサージチェア | ¥150,000 | 毎朝ストレス -6・マッサージで体力 +15 |
| 防音ブース | ¥180,000 | 1日1回 歌の自主練で歌 +3（体力 -10） |
| キングサイズベッド | ¥260,000 | 寝るとストレス さらに -12 |

（「〜で -n」の効果は1日1回。ベッドはいまのベッドと入れかえます）

### ドット商店街と趣味

| お店・場所 | できること |
| --- | --- |
| スーパー まるどっと | 食材・お惣菜（コロッケ ¥100、お弁当 ¥380）・入浴剤・アロマ・ヘアワックス・本とCD。水曜は特売 |
| フラワー＆ギフト はなや | プレゼント（花束・ケーキ・高級お菓子・紅茶セット・ぬいぐるみ・アクセサリー） |
| らーめん まるどっと亭 | ラーメン ¥800（体力 +30・満腹 +60）・餃子。スタンプ10個で1杯サービス |
| CAFE ドット | コーヒーやハーブティーでストレス解消（よく効くのは1日2杯）・ケーキセット |
| hair salon ドット | カット ¥4,000（3日に1回）：身だしなみ100＋次のお仕事の評判アップ（知名度 +10%）。シャンプー＆ヘッドスパ ¥1,500 |
| ファミレス ドットキッチン | 安い定食・ドリンクバー ¥250（1日おかわり自由） |
| DOT GYM | 1日 ¥1,000 でトレーニング（ストレス -15）・シャワー。5日通うごとに体力の最大値 +2（最大 +20） |
| カラオケ ドットボックス | フリータイム ¥1,200。うまく歌うとストレス -25（2曲目から効果は小さく）・歌 +1（1日3曲まで） |
| ドット中央公園 | ジョギング（無料・体力 -8・ストレス -15、2周目からは小さく）・ベンチ・看板ネコ |
| コインランドリー・たい焼き屋 | 洗濯 ¥300（身だしなみ +25）・たい焼き ¥150 |
| ドット不動産・ドット家具 | 引っ越し・内見・家賃の相談／家具の購入と引き取り |

お金で買える気分転換（飲み物・アロマ・入浴剤など）は、1日に何度も使うと効果が小さくなります。
東京の **銭湯 ドットの湯**（¥500・1日1回：体力 +40・身だしなみ全回復・ストレス -12）、家のテレビ、休みの日も上手に使いましょう。

### 人間関係

街や施設には、仲良くなれる **16人** がいます。話しかけるたびに少しずつ好感度（♥）が上がります。

| ハート | 好感度 | できるようになること |
| --- | --- | --- |
| 知り合い | 0〜 | はじめて話すと、自己紹介 |
| 顔見知り | 15〜 | 連絡先を交換（スマホの「連絡先」に入る） |
| 友だち | 35〜 | 「さそう」でおでかけ、電話でおさそい、朝のメッセージやおさそいが届く |
| 仲良し | 60〜 | （相方候補）コンビの話 |
| 親友 | 85〜 | （大切な人候補）気持ちを伝えられる |

- **話しかける**：2回目からは メニュー（**話す／プレゼント／さそう（友だちから）／またね**）が出ます。
  その日はじめて話すと ♥+2（まだ知り合いのうちは +3）
- **プレゼント**（1日1回）：大好きな物 ♥+6、好きな物 +4、苦手な物 -3、そのほか +2。
  1週間以内に同じ物をあげると +1 だけ。一度あげた物の反応は、リストと連絡先に ♥ ♪ × で記録されます
- **おでかけ**（1人1日1回）：その場で「さそう」か、スマホの連絡先から電話で。友だちから当日のおさそいが届くこともあります

| おでかけ先 | 費用 | 効果 |
| --- | --- | --- |
| ラーメン屋 | ¥900 | ストレス -12・♥+5・満腹 +45 |
| 公園で散歩 | 無料 | ストレス -10・♥+4 |
| カフェ | ¥1,200 | ストレス -15・♥+6・満腹 +15 |
| カラオケ | ¥1,500 | ストレス -22・♥+6（体力 -10） |
| ファミレス | ¥1,000 | ストレス -12・♥+5・満腹 +40 |
| 銭湯 | ¥500 | ストレス -15・♥+5・身だしなみ +40 |

（体力はふつう -5。食事つきのおでかけは、食べた分だけ体力が戻ります）

- **ハートイベント**：ハートが上がって最初に話しかけると、その人の物語が進みます（1人につき4つ）
- **相方**：お笑い芸人の3人（ジロー・もも・タケル）は、仲良しのイベントでコンビを組もうと言ってくれます。
  相方がいるとお笑いのミニゲームが少しやさしくなり、寄席や冠番組では相方がボケ役で舞台に立ちます。断っても、数日後にまた話が来ます
- **大切な人**：春斗さん・千代さんとは、親友のイベントで「大切な人」になれます（同時にひとりだけ）

| 人 | いる場所 | |
| --- | --- | --- |
| 大家さん | ドット荘の前 | |
| ストリート芸人 ジロー | 東京の公園ステージ | 相方候補 |
| 店員の春斗さん | ドットマートのレジ | 大切な人候補 |
| エキストラの丸山さん | 東映 撮影所の前 | |
| 先輩女優 虹谷ミオ | ホリプロ 1階ロビー | |
| 研修生ひなた | ホリプロ 1階 レッスンスタジオ | |
| アナウンサー 朝霧さん | NHKニューススタジオ | |
| お疲れのAD 夜野さん | BSよしもと 控室 | |
| アンサンブルの歌織さん | 東宝 劇場の舞台 | |
| マネージャー 笑川 | よしもと 2階 事務所 | |
| 若手ピン芸人 もも | グレープカンパニー 稽古場 | 相方候補 |
| 茶屋の看板娘 千代 | 東映 撮影所の茶屋 | 大切な人候補 |
| 大阪のおばちゃん タマエ | なんばの川沿い | |
| 若手芸人 タケル | 松竹芸能 ロビー | 相方候補 |
| 若手座員 ころ助 | 新喜劇 劇場の楽屋 | |
| たこ焼き屋の大将 | なんばのたこ焼き屋 | |

身だしなみが乱れていると、好感度の上がり方が半分になります。

### スマホ

メニューの「スマホ」で開きます（未読があると数字つき）。十字キーでアプリを選んで A、B でもどる、MENU で閉じます。

| アプリ | 内容 |
| --- | --- |
| メッセージ | 友だちとの会話、おさそい（当日だけ・「行く！」でそのままおでかけ）、番組のオファー（引き受ける／おことわり）、家賃の明細、ファンレター、ニュース |
| 連絡先 | 仲間の一覧（ハート・いる場所・好きな物）。友だちに電話しておでかけにさそえる |
| 予定 | 今週のカレンダー：家賃の日、レギュラー番組の収録・本番の日、今日のおさそい |
| 家計 | 所持金、家賃、レギュラー番組の週のギャラ、未払いの家賃の支払い、明細 |
| ドッター | SNS。1日1回投稿できる（下記） |

### ファンとドッター

- **ファン** は、お仕事（とくにテレビ・舞台）、レギュラー番組、ドッターで増えます。
  1,000人・5,000人・2万人・5万人・10万人・30万人で、お祝いのメッセージやプレゼントが届きます
- 2万人で **ファンミーティング**、10万人で **ファン感謝祭** がひらかれます（週末の1日だけ。当日、会場へ行こう）
- **ドッター**：話題（今日のお仕事／ごはん／オフの日／告知）を選んで1日1回投稿。ファンが少し増えて、ストレス -5
  （お仕事のない日の「オフの日」は -10）。告知はレギュラー番組があるときに使え、ファンが多めに増えます。
  ごくまれに投稿が誤解されることがありますが、「誤解をとく」投稿で落ち着きます（ほうっておいても数日でおさまります）

### レギュラー番組

★250 から、条件に合う番組のオファーがスマホに届きます（14日以内に返事。断った番組は4週間は来ません）。
引き受けると毎週その曜日が **収録日／本番の日** になり、その日に会場の建物へ入ると「収録へ行く？」と聞かれます。
**2回続けて休むと降板**（休むとストレス +8・知名度が少し下がる）。持てるのは4本まで（冠番組は別）。

| 番組 | 会場 | 曜日 | 条件 | ギャラ（週） | ミニゲーム |
| --- | --- | --- | --- | --- | --- |
| 博士のドット塾 | NHK | 月 | ★250 | ¥16,000 | クイズ |
| ぶらり！ご当地ドット便 | BSよしもと | 火 | ★250 | ¥15,000 | トーク |
| ドット寄席 水曜の部 | よしもと | 水 | ★250・よしもと所属 か お笑い40 | ¥15,000 | ツッコミ |
| なんばハガキ道場（ラジオ） | 松竹芸能 | 木 | ★250・松竹芸能所属 か トーク40 | ¥14,000 | トーク |
| 金曜コントクラブ | グレープ | 金 | ★250・グレープ所属 か 演技40 | ¥15,000 | コマンド演技 |
| 星降る街のメロディ（日曜公演） | 東宝 | 日 | ★250・歌30 | ¥15,000 | リズム |
| ドット・サウンドステージ | ホリプロ | 水 | ★1000・ホリプロ所属 か 歌50 | ¥36,000 | リズム |
| ピクセリオン・ネオ | 東映 | 土 | ★1000・演技50 | ¥36,000 | コマンド演技 |

（ギャラはランク B の目安。出来で変わります）

### 冠番組とランキング

- **冠番組**：★1200・ファン8,000人になると、自分の名前がついた毎週の番組のオファーが来ます（¥90,000／週）。
  番組の内容はいちばん得意なスキルで、スタジオは所属事務所で決まります。初回の収録はお祝いつき
- **タレント好感度ランキング**：毎週月曜の朝に発表（50位まで）。知名度・ファン・先週のお仕事とレギュラー出演・冠番組・
  ドッターの投稿で決まります。トップ10入りや1位で、うれしいことが…

### てちょう

メニュー → てちょう。←→ でタブ、↑↓ でスクロール、A で次のページ、B でとじます。

- **もくひょう**：今日の数字、気をつけること（体力・おなか・ストレス・家賃）、次の目標、受けられるオーディション、称号、おすすめのお仕事
- **せいかつ**：曜日と調子、ゲージごとの助言、住まいと家賃、今週のレギュラー番組、仲間のハート、ファン
- **ばしょ**：行ったことのある場所と、そこでできること。まだの場所は「？？？」とヒントだけ
- **きろく**：日数・プレイ時間・お仕事とミニゲームの回数・ベストランク・よく受けたお仕事・相方・住まい

### セーブ

- 寝たとき、建物から街に出たとき、引っ越しのときなどに **自動でセーブ** されます。メニューの「セーブ」でいつでも保存できます
- セーブはブラウザ（localStorage）に1つだけ。タイトルで「はじめから」を選ぶと上書きされます。v1 のセーブとは別です

---

## 開発者向け

### 構成

```
index.html / style.css   キャンバス 640x360・タッチ用パッド
js/main.js            起動・タイトルへの流れ・テスト用URLパラメータ・デバッグメニュー
js/title.js           タイトル画面・キャラクター作成（家のクローゼットでも使う）
js/registry.js        読み込むコンテンツモジュールの一覧（1つ壊れても他は動く）
js/engine/            エンジン
  game.js             ゲーム本体・シーン管理・描画（HD / v1 互換）・スクリプトAPI（g.say など）
  life.js             暮らしの中核：ゲージ・曜日・家賃・住まい／家具／人／おでかけ／番組／スマホアプリの登録・朝の処理
  phone.js            スマホ（HD）：メッセージ・連絡先・予定・家計・登録アプリ／人との会話メニュー・おでかけの演出
  map.js              マップ探索シーン・場所(place)の登録・エンティティ
  tiles.js            タイル定義（defineTile、hd() で 32px のネイティブ描画）と組み込みタイル
  hdify.js            Scale2x（hd() のないタイル・絵の 2x 化）
  sprites.js          キャラクタースプライト（charSheetHD = 32x40 のネイティブ HD）・LOOKS プリセット
  buildings.js        街の建物の外観（HD）
  logos.js            ロゴ看板（その時の表示倍率でドット化）
  ui.js               メッセージ・選択肢・リスト・ショップ・メニュー・ステータス・HUD
  notebook.js         てちょう（もくひょう／せいかつ／ばしょ／きろく）
  minigame.js         ミニゲームの基底クラス
  audio.js            効果音・BGM（chiptune、registerSong で追加）
  state.js            セーブデータ・称号・アイテム・事務所
  draw.js / util.js   描画ヘルパー（text, panel, bar ...）・定数（SW, SH, TILE, UNIT ...）
js/world/             街と暮らし
  tokyo.js namba.js   町（townkit.js: 町づくりの道具、props.js: 噴水・バス停などの大きな小物）
  home.js             自宅（ドット荘）と、すべての家で共通の部品（ベッド・PC・お風呂・キッチン・家具の置き場）
  konbini.js station.js misc.js   コンビニ／駅（移動）／銭湯・ホテル・たこ焼き屋
  people.js           仲間16人（ハートイベント・プレゼントの好み・メッセージ）
  housing.js          住まい（レジデンス・タワー）・不動産屋・家具屋・家具13種
  machi.js            ドット商店街（お店・趣味・おでかけ先）
  cooking.js          自炊（食材・レシピ・お弁当）
  career.js           ファン・ドッター・レギュラー番組・冠番組・ファンミーティング・ランキング
  guide.js            てちょう用の案内データ（場所ごとの要約・おもなお仕事と★条件）
js/places/<id>.js     事務所・局・劇場など（1ファイル1施設）
js/minigames/<id>.js  ミニゲーム（1ファイル1ゲーム）
tools/                ヘッドレスブラウザでのテストツール
```

### 画面と座標

- 画面は **640×360（SW×SH）** の論理ピクセル。エンジンが端末の解像度に合わせて整数倍に近い倍率で拡大します（`display.S`）
- マップの世界座標は v1 と同じ **ユニット**：1タイル = `TILE` = 16 ユニット。世界は `UNIT` = 2 倍で描かれるので、
  1ユニット = 画面の2ピクセル、見える範囲は 320×180 ユニット。タイルとキャラの絵は **2x ネイティブ**（タイル 32px、キャラ 32x40px）
- **シーン** は `{ update(g), draw(ctx, g), opaque, hd, hidesHud }` のふつうのオブジェクト。`g.push(scene)` / `g.pop(scene)`
  - `hd: true`：640×360 の画面ピクセルで描く（新しいシーンはすべてこれ）
  - `hd` なし：v1 の 320×240 空間で描き、1.5 倍で中央に表示（`opaque` なら左右に飾りの帯）。古い演出とミニゲームの互換用
  - `hidesHud: true`：開いている間、マップの HUD（高さ `HUD_H` = 46px）を描かない
- 部屋の `drawUnder / drawOver(ctx, g, cam)` と prop の `draw(ctx, sx, sy, g, e)` はユニット座標（2倍の変換の中）。
  ネイティブ HD の絵は、2倍の大きさのキャンバスに描いて `ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2)` で置きます
  （`props.js` の `bake` / `blit`、家具の `paint` がこの方式）。0.5 ユニット = 画面の1ピクセル
- 画面に収まる小さな部屋は、上の壁が HUD に隠れないよう少し下にずらして表示されます（大きい部屋は `topPad`）

### 場所（place）の定義

```js
import { registerPlace } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';

registerPlace({
  id: 'nhk',                  // 街の建物の place と一致させる
  name: 'NHK放送センター',     // 入った時のバナー
  kind: 'building',           // 'town' | 'building'
  bgm: 'studio',
  start: { room: 'lobby', x: 7, y: 9, dir: 'up' },  // 入った時の位置
  rooms: {
    lobby: {
      floor: 'floor_marble', wall: 'white',   // 既定レジェンドで使われる
      tiles: [
        '###############',
        '=w===p===p===w=',
        // ... 1文字 = 1タイル
        '######MMM######',
      ],
      legend: { C: 'counter_white', P: 'plant', S: 'sofa_blue' },
      entities: [ /* npc, sign, prop, logo */ ],
      warps: [ { x: 6, y: 10, to: 'exit' }, { x: 13, y: 2, room: 'studio', tx: 2, ty: 8, dir: 'up' } ],
      events: [ { x: 3, y: 4, on: 'action', run: async (g) => { ... } } ],
      onEnter: async (g) => { ... },     // 部屋に入るたびに実行
      topPad: 24,                        // 大きい部屋：カメラが上端より少し上まで動ける（HUD対策）
      bgm: 'studio',                     // 部屋ごとに変えたい場合
      bg: '#000', drawUnder(ctx, g, cam) {}, drawOver(ctx, g, cam) {},  // 背景色・自由描画（ユニット座標）
    },
  },
});
```

**既定レジェンド**：`.` 床（room.floor）、`#` 壁の上面（walltop_<wall>）、`=` 壁の正面（wall_<wall>）、
`w` 窓付き壁、`p` ポスター付き壁、`c` 時計付き壁、`M` 出口マット、`d` 木のドア、`g` ガラスドア、` ` 何もない。
レジェンドの値は `'floor_wood+desk'` のように `+` で重ねられます。`obj` タイル（家具など）だけを書くと、
自動的に room.floor の上に描かれます。

**部屋の作法**：1行目は `#`（壁の上面）、2行目は `=`（壁の正面。窓・ポスター・ロゴ看板を飾る場所）、
左右の端と最下段も `#`。出口は最下段の `M` に `{ to: 'exit' }` ワープを置く（街の建物の前に戻る）。
3/4 見下ろし視点なので、キャラは壁の正面の1つ下の行から歩けます。

**エンティティ**
- `{ type: 'npc', id, x, y, dir, look, name, text: '…' | ['…', '…'], talk: async (g, npc) => {}, wander: 2, cond: (g) => bool, fixedDir, person: 'jiro' }`
  （`person` があると、話しかけは人間関係のメニューを通ります。`wander` の NPC は、建物のドアとその前のマス、ワープの隣のマスには止まりません）
- `{ type: 'sign', x, y, text | talk }` 見えない調べるポイント（看板タイルの上などに置く）
- `{ type: 'prop', x, y, w, h, draw(ctx, sx, sy, g, e), solid, text | talk }` 自由描画の大きな物
- `{ type: 'logo', x, y, w, h, logo: 'nhk', board: true, text | talk }` 壁などに掛けるロゴ看板（タイル単位、小数可）
- `{ type: 'building', x, y, w, h, door, place, name, kind, ... }` 町の建物（下記）

**ワープ**：`{ x, y, to: 'exit' }`（街へ戻る）／`{ x, y, room, tx, ty, dir }`（同じ施設の別の部屋）／
`{ x, y, place, room, tx, ty, dir }`（別の施設）。`check: async (g) => bool` で false を返すと押し戻されます。

**イベント**：`{ x, y, w, h, on: 'action' | 'step', run: async (g) => {}, once: 'フラグ名', cond: (g) => bool }`。
`action` はその位置に向かって A ボタン、`step` は踏んだ時。

**カウンター越しの会話**：`counter` / `counter_white` / `register` は `talkThrough` タイルなので、
カウンターの奥の NPC に手前から話しかけられます。

**町の建物**：町の部屋の entities に `{ type: 'building', x, y, w, h, door, place, name, kind, logo | sign, wall, roof, ... }`。
足元の w×h タイルは通れず、ドアのマス（`x + door, y + h - 1`）が入口。`kind` は
`office hotel tower theater studio house shop small bath station` など（`buildings.js` の先頭に一覧と見た目のオプション）。
`g.exitPlace()` はこの建物のドアの前に戻ります（`doorIndexFor`）。

### タイル

```js
import { defineTile, R, P, outline, bevel, shadowEllipse } from '../engine/tiles.js';

defineTile('myplace_sofa', {
  solid: true, obj: true,              // 通れない／床の上に重ねて描く
  draw(c, r, frame, variant) { ... },  // 16x16 の v1 の絵（なくてもよいが、tileImage() で使われる）
  hd(c, r, frame, variant) { ... },    // 32x32 のネイティブ HD の絵。マップはこちらを使う
});
```

- `hd()` がないタイルは、16px の `draw()` を **Scale2x** で 2x にして使います（`hdify.js`）
- HD の作法（組み込みタイルはすべて `hd()` あり）：32×32、光は左上から、素材ごとに2〜3トーン、物には1pxの暗い輪郭（`outline()`）、
  ディザは質感にだけ。床・地面・壁はつなぎ目なく敷けるように（`Rw` / `Pw` で折り返し描画）
- ほかのオプション：`talkThrough`、`frames` / `speed`（アニメ）、`variants`（マスごとにランダムな絵柄）
- ヘルパー：`R P Rw Pw pix speckle disc oval ring line bevel inset dither grain outline blobs ramp shadowEllipse`、壁の色 `WALL_THEMES`
- 独自タイルの ID は `'<施設ID>_xxx'`

### キャラクター

- `charSheetHD(look)` → `{ down, up, left, right }` 各3フレームの 32x40 キャンバス（キャッシュあり）。マップ・会話の顔（`drawFaceHD(ctx, look, x, y, scale)`）・演出で使う
- `look = { hair, hairColor, skin, top, bottom, shoes, skirt, jacket, tie, glasses: true | 'sun', beard, hat, blush, apron, kimono, ribbon, lashes }`。
  髪型：`short long bob spiky twin slick afro cap bald mage helmet`
- プリセット `LOOKS`：`receptionist manager president staff ad director cameraman guard comedian comedian2 idol singer actor actress announcer announcerM makeup samurai ninja hero kaiju oldman oldwoman kid salaryman fan clerk chef tourist mom`。
  `{ ...LOOKS.staff, top: '#2f9a4a' }` のように上書きできます

### スクリプト API（`g`）

| API | 説明 |
| --- | --- |
| `await g.say(text \| [pages], { name, look, face, top, color, speed })` | メッセージ。`{name}` はプレイヤー名、`{agency}` は所属、`\n` で改行。1ページ 全角約36文字×3行 |
| `await g.ask(text, ['はい', 'いいえ'], { name, look, cancel })` | 選択肢（1つ14文字まで）。選んだ index を返す（B は `cancel`、既定は最後の選択肢） |
| `await g.list({ title, items, x, y, w, index, px, describe })` | リスト選択（キャンセルで -1）。items は文字列か `{ label, right, disabled }`。`px: true` で座標を画面ピクセルに（ないと v1 座標を 2x / 1.5x）。`describe(i)` で説明欄 |
| `await g.job({...})` / `await g.lesson({...})` / `await g.audition({...})` | お仕事・レッスン・オーディション（下記） |
| `await g.minigame(id, opts)` | ミニゲームを直接実行 → `{ score, rank, success, comment }` |
| `await g.shop(['onigiri', { item: 'drink', price: 280 }], { title, greeting })` | お店 |
| `await g.sleep({ save, away, shower, sleepStress, notes })` | 寝る：日付+1・体力全快・朝の処理（`g.morning`）・朝のメモを表示・セーブ。自宅以外では `away`（家の特典なし） |
| `g.addMoney(n, silent)` / `g.spend(n)` → bool | お金 |
| `g.addFame(n, silent)` / `g.addSkill('warai', n, silent)` / `g.addFans(n, silent)` | 成長（称号が上がると、スクリプトの終わりにお知らせ） |
| `g.heal(n)` / `g.useStamina(n)` → bool | 体力（`heal` は食べ物以外：お風呂・イベントなど） |
| `g.eat(n, { fill, silent })` → 回復量 / `g.canEat()` / `g.mealsLeft()` | 食べ物（下記「暮らしの API」） |
| `g.payText(pay)` | `ギャラ 目安¥3,000（出来で変動）`。お仕事の告知・一覧はこれを使う（state.js からも import 可） |
| `g.giveItem(id, n, silent)` / `g.hasItem(id, n)` / `g.takeItem(id, n)` | アイテム |
| `g.flag(k)` / `g.setFlag(k, v)` | フラグ（キーは施設IDを接頭辞に） |
| `g.checkRequires(r)` → null \| 理由 | 条件チェック（`requires` と同じ形式） |
| `g.state` | セーブされる全データ（`state.js` の `newState` と `life.js` の `newLifeState`） |
| `g.state.flags.visited` | 行ったことのある場所 `{ placeId: true }`（`g.goto` が記録） |
| `await g.fadeOut()` / `await g.fadeIn()` / `await g.wait(ms)` / `await g.waitFrames(n)` | 演出 |
| `await g.moveNpc(id, 'up up left')` / `await g.movePlayer('down')` | 移動演出（`'face:left'` で向きだけ） |
| `await g.walkNpcTo(id, x, y)` | 最短経路で NPC を歩かせる |
| `await g.emote('player' \| npcId, '!')` | 吹き出し（`! ? ♪ ♥ … 💢 w`） |
| `g.placeNpc(id, x, y, dir)` / `g.showNpc(id, bool)` / `g.placePlayer(x, y, dir)` / `g.facePlayer(dir)` | 瞬間移動・表示切り替え（演出用） |
| `g.npc(id)` / `g.notify(text, { color, life })` / `g.showBanner(text)` / `g.sfx(name)` / `g.bgm(name)` / `g.shake()` | その他 |
| `await g.showLogo('nhk', '説明')` | ロゴを大きく表示 |
| `await g.goto(place, room, x, y, dir)` / `await g.enterPlace(place)` / `await g.exitPlace()` | 移動（`exitPlace` は街の建物の前へ戻ってセーブ） |
| `g.run(async (g) => {...})` | スクリプトとして実行（実行中はプレイヤーが動けない。終わると称号アップ・ゲージの説明・NHKの電話を処理） |
| `await g.ending()` | エンディング（スタッフロール） |

**お仕事** `g.job({ id, title, desc, client, clientLook, stamina: 20, minigame, opts: { difficulty }, pay, fame, fans, skill, gain, requires, confirm })`
- `requires`: `{ agency: true | 'yoshimoto' | ['yoshimoto', 'grape'], fame: 250, skills: { warai: 30 }, flag, flagText }`。
  「所属 または ★30」のような条件は `{ anyOf: [{ agency: true }, { fame: 30 }], anyOfText }`
- 条件・燃え尽き（`g.lifeRefusal()`）チェック → 確認（ギャラ目安・体力・ストレス）→ 体力消費 → ミニゲーム →
  ランク倍率（S 1.5 / A 1.2 / B 1.0 / C 0.7 / D 0.4、得意分野の事務所なら ×1.1）でギャラ・知名度・ファン・スキル。
  `fans` の既定は `fame × 3`。身だしなみが乱れていると知名度・ファンが ×0.8。最後に `lifeTick('job')`（ランク S はストレス -4、D は +3）
- `pay` はランク B の額なので、「¥3,000〜」とは書かず `g.payText(pay)`（目安）で見せます。`id` は `state.jobs` の回数・てちょうに使います

**レッスン** `g.lesson({ title, skill, price: 2000, stamina: 10, gain: 3, minigame?, opts?, teacher })`
（ミニゲームつきなら上がり幅が S ×2 / A ×1.5 / B ×1.2 / C ×1 / D ×0.6）

**オーディション** `g.audition({ agency, title, minigame, opts, pass: 55, stamina: 15, requires, confirm, client, clientLook, beforeResult })`
（`confirm: false` で確認を省略、`beforeResult: async (g, res, passed) => {}` で合否発表の前に演出を挟める）
事務所 ID：`yoshimoto` / `shochiku` / `grape` / `horipro`。所属していれば true。理由は `g.lastAudition`
（`'passed' | 'already' | 'failed' | 'declined' | 'nostamina' | 'blocked' | 'transferDeclined'`）。合格でストレス -15・知名度 +10。

**経済の目安**：プレイガイドの「お仕事と★の段階」の表のとおり（ランク B）。体力は 100（リフォーム・家具・ジムで最大 158 まで）。
お仕事は体力 15〜30、レッスンは 10〜15、レッスン料 ¥2,000〜8,000 でスキル +3〜6。
レギュラー番組は ★250 で ¥14,000〜16,000・ファン 800〜900、★1000 で ¥36,000・ファン 2,600〜2,800（お仕事の約6倍のファン）、
冠番組は ¥90,000・★200・ファン 6,000。★4000（`FINALE_FAME`）に達すると街で NHK から電話（`flags.finaleInvited`）、
NHK で最終公演 → `g.ending()`（`flags.finaleDone`）。

**てちょうの案内データ**：`js/world/guide.js` の `GUIDE`（場所ごとの名前・町・ヒント・要約 2〜3行）と
`GUIDE_ORDER`、`AUDITIONS`、`GUIDE_JOBS`（おもなお仕事の段階・条件・お仕事ID）を、てちょうが読みます。
施設やお仕事・★条件を変えたら、ここも合わせて直してください（`ids` は `g.job` の `id`）。

### 暮らしの API（`js/engine/life.js`）

すべての状態は `g.state` に入るので、セーブに自動で含まれます（`newLifeState()`：`life { hunger, stress, clean, steps, workDay, warned }`、
`housing`、`rent { paidWeek, debt, late }`、`furniture`、`people`、`partner`、`fans`、`regulars`、`phone { inbox, nextId, lastPost, posts }`）。
古いセーブは `loadGame` が既定値とマージし、数値を正規化します。

**定数**：`WEEKDAYS`（`'月'..'日'`、1日目＝月曜）、`FULL` 90（これ以上は食べられない）、`HUNGRY` 20、`STRESSED` 70、`BURNOUT` 100、
`SCRUFFY` 30、`MORNING_SHOWER` 35、`REST_DAY_STRESS` 20、`WALK_STEPS` 150、`GIFT_REPEAT_DAYS` 7、`OFFER_DAYS` 14、
`HEARTS`（`[[0,'知り合い'],[15,'顔見知り'],[35,'友だち'],[60,'仲良し'],[85,'親友']]`）、
`ACTIVITY`（`job { hunger: -10, stress: 8, clean: -10 }`、`lesson { -8, 5, -6 }`、`audition { -8, 10, -6 }`、`walk { -1, 0, -1 }`、`night { -30, 0, -20 }`）。
関数：`weekdayOf(day)`（0=月）・`weekOf(day)`・`weekdayName(day)`・`heartIndex(aff)`・`isKansai(def)`・`showWords(regular)`。

| g.* | 説明 |
| --- | --- |
| `g.weekday` / `g.week` / `g.dayLabel(day?)` | 曜日（0=月）・週・`'12日目（金）'` |
| `g.need(k)` / `g.addNeed(k, n, silent = true)` → 変化量 | ゲージ（`'hunger' 'stress' 'clean'`）。線をこえるとトースト＋はじめての時は説明 |
| `g.lifeTick(kind \| { hunger, stress, clean })` | 活動のコスト。ストレスが増えるものは「働いた日」になる（翌朝の休日ボーナスなし） |
| `g.condition()` | `'great' 'normal' 'hungry' 'stressed' 'scruffy' 'burnout'` |
| `g.lifeBonus(skill)` / `g.lifeBonusParts(skill)` → `[{ label, v }]` | ミニゲームへの補正（はらぺこ -0.2、ストレス -0.15、絶好調 +0.1、相方＋お笑い +0.1）。合計の下限は -0.35 |
| `g.lifeRefusal()` → null \| 理由 | 燃え尽き・空腹で働けない理由（`job` `lesson` `audition` `doRegular` が使う。自作の重い活動でも呼ぶ） |
| `g.canEat()` / `g.mealsLeft()` | 食べられるか／あと何食くらい入るか（0＝おなかいっぱい） |
| `g.eat(n, { fill, silent })` → 体力の回復量 | 体力 n と満腹 fill（既定 1.5n、最低 0.75n）。入った分の割合で体力も減る（`g.lastEatRatio`）。満腹 90 以上なら 0（`g.ateLast = false`）。お金を取るなら先に `g.canEat()` を確認 |
| `g.bathe(n = 100, silent)` / `g.relax({ stress, stamina, clean, hunger, silent })` | 身だしなみ／気分転換 |
| `g.housing()` / `g.moveHousing(id)` | いまの住まいの定義／住まいの変更（チェックなし。ふつうは `housing.js` の `moveTo(g, id)`） |
| `g.furnitureOwned(id)` / `g.furnitureEffects()` → `{ sleepStress, stamina, clean, stress }` | 家具 |
| `g.rentDue()` / `g.chargeRent()` / `g.payDebt(partial = false)` | 家賃（月曜の朝に `morning` が `chargeRent`）。`g.lastDebtPaid` |
| `g.person(id)` / `g.met(id)` / `g.meet(id, silent)` / `g.aff(id)` / `g.heartLevel(id)` | 人の記録 `{ aff, met, talkDay, giftDay, hangDay, seen, contact, known, partner, special }` |
| `g.addAff(id, n, silent)` → 変化量 | 好感度（身だしなみが乱れていると上がり幅は半分）。♥1 で連絡先交換のメッセージ |
| `g.pendingHeartEvent(id)` / `g.talkPerson(npc)` | 次のハートイベント／人間関係の会話（`person` つき NPC にはマップが自動で使う） |
| `g.giveGift(id, itemId)` / `g.giftReaction(id, itemId)` / `g.giftRepeat(id, itemId)` | プレゼント（`'love' 'like' 'neutral' 'dislike'`） |
| `await g.hangout(id, spotId)` → bool | おでかけ（HD の演出つき） |
| `g.friends(minLevel = 2)` / `g.setPartner(id \| null, { silent, text })` / `g.setSpecial(id \| null, { silent, text, exclusive })` / `g.isPartner(id)` / `g.isSpecial(id)` | 友だち・相方・大切な人 |
| `g.regular(id)` / `g.joinRegular(id)` / `g.regularsToday(placeId?)` / `await g.doRegular(id)` | レギュラー番組（記録 `{ since, doneWeek, missed, count, dropped, declined }`）。収録日にその場所へ入ると `goto` が収録をすすめる |
| `g.message({ from, text, kind, person, spot, regular, look })` / `g.offerOpen(m)` / `g.unread()` | スマホのメッセージ。kind：`chat invite offer bill fan news`（受信箱は60件まで。返事待ちのオファーと最新の明細は消えない） |
| `await g.morning(hungerAtNight, opts)` | 朝の処理（`g.sleep` が呼ぶ）：ひと晩の消耗・シャワー・眠りと家具・休日ボーナス・家賃・休んだ番組・オファーの期限・`onMorning` フック。メモは `g.morningNotes` |

**登録（コンテンツモジュールが読み込み時に呼ぶ）**

- `registerHousing(id, { name, short, place, room, rent, moveCost, requires: { fame }, sleepStress, kitchen, bath, bathStress, slots, desc, plan, perks })`
- `registerPerson(id, def)`：`{ name, short, look, kind: 'comedian'|'idol'|'actor'|'singer'|'staff'|'local', where, profile, likes, loves, dislikes,
  events: [{ level, run: async (g, def, npc) => {} }], messages, invites, hangout: { [spotId]: lines }, canPartner, special, dialect: 'kansai', talkLabel,
  greet, chats, chat, giftLines, inviteYes, callYes, ... }`（全項目は `life.js` の `registerPerson` の上のコメント）
- `registerHangout(id, { name, price, stress, aff, stamina: 5, fill, clean, heal, place, go, lines })`
- `registerRegular(id, { title, place, weekday, medium: 'tv'|'radio'|'stage'|'event', requires, pay, fame, fans, stamina: 15, skill, minigame, opts, host, hostLook, desc, offer })`
- `registerFurniture(id, { name, price, desc, perk, sleepStress, stamina, clean, stress, bed, tall, artH, paint(c, w), anim(ctx, x, y, g, w), use: async (g) => {} })`
- `registerPhoneApp(id, { name, color, order, icon(ctx, x, y) | iconHD(ctx, x, y), badge: (g) => n, open: async (g) => {} })`
- `onMorning(async (g) => {})`：毎朝のフック（友だちのメッセージ、オファー、ファンレターなど）。エラーはログに出してスキップ

**人との会話メニュー（`PEOPLE_UI`）**：`person` つき NPC に話しかけると、`hooks.start` → ハートイベント（あれば）→ `hooks.before`
（true を返すとこの会話を引き取る）→ メニュー **話す／プレゼント／さそう（♥2）／[extras]／またね** → `hooks.after`。
はじめての会話は NPC 自身の `talk` / `text`（自己紹介）だけで、メニューは2回目から。`PEOPLE_UI.talk` / `hangout` は置きかえず、次で拡張します。

```js
import { PEOPLE_UI } from '../engine/life.js';
PEOPLE_UI.extras.push({
  id: 'combi', label: 'コンビを組もう',         // 14文字まで。(g, id, npc) => label も可
  cond: (g, id, npc) => g.heartLevel(id) >= 3,  // 出す条件
  run: async (g, id, npc) => { /* ... */ return 'end'; },  // 'end' でメニューを閉じる
  repeat: false, order: 50,
});
PEOPLE_UI.hooks.greet.push((g, id, npc) => (g.isPartner(id) ? '相方！今日もやったろか！' : null));
```

### スマホ（`js/engine/phone.js`）

- 入口（スマホが閉じていても開いていても使える）：`openPhone(g)`、`messagesApp(g)` / `contactsApp(g)` / `scheduleApp(g)` / `moneyApp(g)`、
  `readMessage(g, m)`（1通を会話として読み、おさそい・オファーに返事）、`answerMessage(g, m, yes)`、`callPerson(g, id)`
- アプリの中の画面（すべてプレイヤーが終えると resolve）：
  - `await phoneList(g, { title, color, items: [{ label, sub, right, look, icon, disabled, why }], index, hint, empty, describe })` → index / -1
  - `await phoneInfo(g, { title, color, text | lines, draw(ctx, area, view), hint })`
  - `await phoneConfirm(g, { title, color, text, choices: ['はい', 'いいえ'] })` → index（B は最後）
  - `await phoneView(g, { title, color, bg, noHeader, hint, cancel, enter(ph), update(ph, input, g), draw(ctx, ph, area, g) })`：
    自作の画面。`ph.back(value)` で閉じる。`area` は画面ピクセル（幅 224px）
- 描画ヘルパー：`appTile rrect box drawHeart drawHearts drawBadge phoneText fitText nameFit`、`PHONE` / `SCREEN`（位置）、`PC`（色）
- アプリの中で `g.say` / `g.list` もふつうに使えます（スマホの上に表示）
- 人のセリフの既定（標準語／関西弁）は `lineFor(def, key, g)`。`def[key]` があればそれが優先

### 追加のしかた

**場所**
1. `js/places/<id>.js` に `registerPlace({...})`（上の例）。独自のタイル・アイテム・BGM もこのファイルで
2. `js/registry.js` の `MODULES` に追加
3. 町（`tokyo.js` / `namba.js` / `machi.js`）に `{ type: 'building', place: '<id>', ... }` を置く
4. `js/world/guide.js` の `GUIDE` / `GUIDE_ORDER`（お仕事があれば `GUIDE_JOBS`、オーディションなら `AUDITIONS`）に追加
5. `node tools/inspect.mjs <id> --out test-output/<id>` で確認

**タイル**：`defineTile('<施設ID>_xxx', { solid, obj, draw, hd })`。新しいタイルには `hd()` を書きます（なければ Scale2x）。

**人**：`js/world/people.js` の `person(id, {...})`（`registerPerson` ＋会話用の既定）で登録し、施設の NPC に `person: '<id>'` を付けます。
ハートイベントは `events: [{ level: 1..4, run }]`（その段階で最初に話した時に1回）、相方候補は `canPartner` ＋ `combi`、
大切な人候補は `special` ＋ `confess` のセリフ（`people.js` の先頭のコメント）。大阪の人は `dialect: 'kansai'`、
ていねい語の人は `polite: true`。朝のメッセージは `messages` / `invites`、おでかけのセリフは `hangout[spotId]`。

**おでかけ先**：`registerHangout(id, {...})`（`machi.js` の例）。演出の絵は `phone.js` の `ART[spotId]`
（なければ夜の街の `_default`）。メッセージの「〜に行かない？」の言い方は `people.js` の `SPOT_WORD`。

**レギュラー番組**：`career.js` の `addShow(id, { ...registerRegular の項目, tier: 1 | 2, kansai, npc: { id, name }, fallbackLook })`。
`addShow` した番組だけがオファーされます（`registerRegular` だけなら、`g.joinRegular(id)` で自分で加える）。
毎週内容を変えたい項目は `dyn(id, { opts: () => ({...}) })` でゲッターに。司会の顔は会場の NPC から取ります。

**家具**：`housing.js` の `FURNITURE_LIST` に `['id', { name, price, desc, perk, ... , paint(c, w) }]`。
絵は 2x ネイティブ（幅 `w*32` px、高さ `artH`、下の 32px が 2x1 タイルの足元）。家具屋の並びは `FURNITURE_ORDER`（＝このリストの順）。
`stamina` は買った時に一度だけ体力の最大値に足されます（`flags.housing_fit`）。

**料理**：`cooking.js` の `RECIPES` に `{ id, name, needs: { ing_xxx: n }, heal, fill, stress, serves, box: false, bento: '〇〇弁当', text }`。
お弁当のアイテム（`bento_<id>`）は自動で登録されます。食材は `INGREDIENTS` に追加（スーパーの「食材（全部）」に自動で並ぶ。
売り場のコーナーは `machi.js` の `SECTIONS`）。

**スマホアプリ**：`registerPhoneApp(id, {...})`。名前は5文字まで、`order` は既定アプリが 10/20/30/40、ドッターが 45。
アイコンは `icon(ctx, x, y)`（`color` のタイルの上に 24x24）か `iconHD(ctx, x, y)`（32x32 全体）。中身は `phoneList` などで。

**お仕事**：施設のファイルで `g.job({ id: '<施設ID>_xxx', ... })`。段階の目安（上の表）に合わせ、`guide.js` の `GUIDE_JOBS` にも追加。

### ミニゲーム

```js
import { Minigame, registerMinigame } from '../engine/minigame.js';

class MyGame extends Minigame {
  static title = 'タイトル';
  static howto = ['説明1', '説明2'];
  static bgm = 'minigame';   // null で無音（自前で鳴らす）
  static skill = 'talk';     // 既定のスキル
  static hd = true;          // 640x360 で描く（false: v1 の 320x240 を 1.5 倍）
  init() { /* 開始時 */ }
  updatePlay(input) { /* 60fps。input.pressed('a') など。終わったら this.end(0..100) */ }
  drawPlay(ctx) { /* this.W x this.H に描画 */ }
}
registerMinigame('mygame', MyGame);
```

基底クラスがタイトルカード（スキルと調子の補正の内訳つき）・3-2-1・結果画面（S 90 / A 75 / B 55 / C 35 / D）を担当します。
`this.difficulty`（1〜5）、`this.bonus`（スキル・アイテム・調子から -0.35〜約1.4、大きいほどやさしく）、`this.ease(v, k)`、
`this.popup(text, x, y, color)`、`this.drawTimerBar(ctx, frac)`、`this.drawScoreBox(ctx, label, value)`、`this.rng()`、`this.pt`、`this.opts` が使えます。

**ミニゲームと opts の約束**（くわしくは各ファイルの先頭のコメント）

| id | 内容 | 描画 | opts |
| --- | --- | --- | --- |
| `tsukkomi` | ボケにタイミングよくツッコミ | HD | `lines: [{ boke, punch: bool, tsukkomi? }]`, `rounds`, `partner`, `partnerLook`, `dialect: 'kansai' \| 'std'` |
| `zukko` | 新喜劇風。ギャグのオチでズッコケる | HD | `gags: [{ setup, cue, fake? }]`, `fakes`, `rounds`, `shop`, `noren` |
| `rhythm` | 歌・ダンス。流れてくるノーツ | v1 | `lanes: 1 \| 2 \| 4`, `bpm`, `length`（拍）, `song`, `style: 'sing' \| 'dance'`, `doubles`, `seed`, `look` |
| `command` | 殺陣・変身ポーズ・怪獣・演技・ダンスのコマンド入力 | v1 | `theme: 'tate' \| 'henshin' \| 'kaiju' \| 'acting' \| 'dance'`, `rounds`, `calls`, `scenes: [{ title, beats }]`（acting） |
| `quiz` | 4択クイズ | v1 | `category: 'general' \| 'japan' \| 'osaka' \| 'tv' \| 'movie' \| 'music' \| 'mix'`, `questions: [{ q, choices, answer }]`, `count`, `time`, `hints`, `show`, `genre` |
| `announce` | 原稿の難読漢字を正しく読む | v1 | `words: [{ word, reading, wrong: [...], sentence? }]`, `count`, `set: 'news' \| 'morning' \| 'afureko'`, `show`, `opening`, `closing`, `partner` |
| `talk` | トーク番組で最適な返しを選ぶ | v1 | `topic`, `scenes: [{ prompt, answers: [{ text, score }] }]`, `count`, `time`, `set`, `show`, `mc` |

### 素材

- タイル：`js/engine/tiles.js`（`grass sidewalk road floor_wood floor_marble floor_carpet_red floor_stage floor_studio …`、
  壁は `wall_<テーマ>` / `walltop_<テーマ>`：white cream blue navy gray red purple wood dark orange green pink black yellow brick）。
  家具：`counter counter_white desk desk_pc chair seat sofa table plant bookshelf locker tv monitor camera mic spotlight speaker piano curtain curtain_top rope mirror makeup clothes_rack trophy director_chair green_screen set_wall stage_edge …`
- ロゴ：`yoshimoto shinkigeki bs_yoshimoto shochiku grape nhk nhk_old toei horipro toho`
  （小さく描くと、よしもと・グレープ・東宝は文字を省いたマークだけになります：logos.js の `mark`）
- 効果音：`cursor ok cancel talk door coin success fanfare fail buzz hit good laugh applause zukko whistle drum snare shutter chime sword sleep`
- BGM：`title town osaka office studio theater minigame night ending`（各モジュールが `registerSong(name, def)` で追加：
  `machi_shop machi_cafe machi_gym lounge sento_yu` など）
- 文章：メッセージは1ページ 全角約36文字×3行、選択肢は14文字まで。大阪の人は関西弁。実在の人物・実在の番組名やキャラクター名（似せたものも）は出さない。
  恋愛は「大切な人」までの全年齢向け

### テスト

```bash
python3 -m http.server 8765 --directory dot-geinou-v2 &                  # リポジトリのルートで
node dot-geinou-v2/tools/inspect.mjs nhk --out test-output              # 施設の総合チェック（スクショ・会話ログ・到達性）
node dot-geinou-v2/tools/inspect.mjs machi --quick --agency yoshimoto   # 速い版／所属して
node dot-geinou-v2/tools/minigame.mjs quiz --difficulty 1,3,5 --out test-output   # ミニゲームをボットでプレイ
```

ツールは既定で `http://localhost:8765/` を開きます。別のポートなら `GAME_URL=http://localhost:8766/` を指定してください。
スクリーンショットや作業ファイルは `test-output/`（git では無視）に置きます。

**URL パラメータ**：`?test=1&place=nhk&room=studio&x=5&y=6&dir=up`（タイトルを飛ばして直接開始）、`&rich=1`（お金・知名度・スキル多め）、
`&agency=yoshimoto`、`&name=…`、`&intro`（最初の説明も見る）、`&touch`（画面パッドを出す）、
`?minigame=quiz&difficulty=3&skill=talk`（ミニゲーム単体）、`?debug=1`（メニューにデバッグ：ワープ・お金・知名度・スキル・体力・所属）。

**自作の Playwright スクリプト**（Playwright と Chromium が必要。import のパスはスクリプトの場所に合わせる）：`tools/lib.mjs` の `openGame(query)`（ビューポート 1300x800、`{ browser, page, errors }`）、
`shotCanvas(page, file)`、`PAGE_HELPERS`、`loadPlaywright()`。`PAGE_HELPERS` を入れるとリアルタイムのループが止まり、
`await window.__ff(frames)` でだけ進みます（`window.__settle()` はスクリプトが終わってマップに戻るまで進める）。
`window.__game` が Game。`g.auto = { choice: 0 | (choices, pages) => i, list: (items) => i, score: 80, playFrames, log: [] }` で、
会話・選択肢・リストに自動で答え、ミニゲームはそのスコアで終わります（`log` に会話が記録される）。

```js
import { openGame, shotCanvas, PAGE_HELPERS } from './dot-geinou-v2/tools/lib.mjs';
const { browser, page, errors } = await openGame('?test=1&place=home&rich=1');
await page.addScriptTag({ content: PAGE_HELPERS });
await page.evaluate(() => {
  const g = window.__game;
  g.auto = { choice: 0, score: 80, log: [] };
  g.run((g) => g.sleep());       // await しない：__settle が進める
});
await page.evaluate(() => window.__settle());
await shotCanvas(page, 'test-output/me/morning.png');
console.log(errors);
await browser.close();
```

### いったん止めている作業（HD 化）

v2 の HD 化は途中で、次のものは **意図的に** v1 の絵のままにしてあります。

- ミニゲーム7本のうち `tsukkomi` と `zukko` は 640×360 の HD 描画。残りの5本（`rhythm` `command` `quiz` `announce` `talk`）は
  v1 の 320×240 のレイアウトを 1.5 倍で表示しています（左右に飾りの帯）
- 施設（`js/places/*.js`）と銭湯・ホテル・たこ焼き屋・駅（`misc.js` / `station.js`）の独自タイルには `hd()` がまだなく、
  v1 の 16px の絵を Scale2x で拡大しています。新幹線の移動など、一部の演出シーンも v1 のレイアウトです
- エンジンの組み込みタイル、町、建物、キャラクター、自宅・住まい・商店街、UI・スマホ・てちょうは HD です
