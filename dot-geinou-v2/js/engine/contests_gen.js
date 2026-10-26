// 賞レースの土台 (owner: D1) — pure generators for contests.js: fictional names (コンビ・トリオ・ピン・落語家・
// 審査員・進行役), fictional agencies, looks, tags, comment and news phrases. No game state, no imports from
// contests.js (contests.js imports this file). Every name here is invented for this game; a small blocklist keeps
// well-known real act names out (a generated name that hits it is regenerated).

import { mulberry32 } from './util.js';

// ---------------------------------------------------------------- deterministic randomness
export function strHash(s) {
  let h = 2166136261;
  const t = String(s);
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return h >>> 0;
}
// rng(seed, ...parts) → a mulberry32 stream for that key
export function rngOf(...parts) { return mulberry32(strHash(parts.join('|'))); }
export const pickR = (r, a) => a[Math.floor(r() * a.length) % a.length];
// n different items of a (without replacement; fewer when a is shorter)
export function drawN(r, a, n) {
  const pool = a.slice(), out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length) % pool.length, 1)[0]);
  return out;
}
export function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------- word lists (all invented combinations)
const KATA_A = ['ネオン', 'カラクリ', 'ポンコツ', 'ミドリ', 'ハッカ', 'ドロップ', 'マーブル', 'ブリキ', 'ペンギン', 'チクワ', 'メトロ', 'ガラパゴス', 'ハリネズミ',
  'コンパス', 'ポップコーン', 'サボテン', 'トランポリン', 'オセロ', 'フラミンゴ', 'カスタネット', 'ラッコ', 'ミルフィーユ', 'ヨーヨー', 'パラソル', 'ハンモック',
  'マトリョーシカ', 'カピバラ', 'ピクニック', 'モノレール', 'ジャンボ', 'ナポリタン', 'パズル', 'スプーン', 'ブランコ', 'タンバリン', 'バルーン', 'マシュマロ',
  'ラムネ', 'ペリカン', 'コロッケ', 'シーソー', 'ダイヤル', 'テトラ', 'ホチキス', 'ピーナッツ', 'カモメ', 'グミ', 'ウクレレ', 'ポテト', 'ネジ', 'アンテナ'];
const KATA_B = ['ボーイズ', 'ガールズ', 'ブラザーズ', 'クラブ', 'ハウス', 'ステーション', 'ファクトリー', 'パレード', 'ジャンクション', 'カンパニー', 'エクスプレス',
  'マーケット', 'ランド', 'サーカス', 'ホテル', 'スタンド', 'ラボ', 'ベーカリー', 'ストア', 'ロケット', 'ガレージ', 'バンド', 'ブルース', 'ポスト', 'タワー', 'ドライブ'];
const KAN_A = ['三丁目', 'ゆうやけ', '回覧板', '黒豆', '鉄瓶', '踏切', '縁側', '湯けむり', '風見鶏', '豆電球', '金魚', '月見', '霧雨', '文鎮', '学級',
  '下町', '路地裏', '団地', '駄菓子', '満月', '鈴虫', '石畳', '灯台', '朝凪', '夜更かし', '茶柱', '屋台', '押し入れ', '番台', '銭湯', '線香花火', '寝ぐせ', '万年筆',
  '日めくり', '綿あめ', '小春', '水玉', '口笛', '紙ふうせん', '雪見', '鍋底', '湯たんぽ', '三角定規', '方眼紙', '大盛り', '二度寝', '寄り道'];
const KAN_B = ['商店', '定食', '劇場', '探偵団', '横丁', '銀行', '学園', '急行', '組合', '工務店', '研究所', '音頭', '一座', '本舗', '食堂', '会議', '旅団',
  '倶楽部', '交番', '新聞', '放送局', '温泉', '社中', '親衛隊', '天国', '計画', '同好会', '観測所', '保存会', '自治会'];
const HIRA = ['おむすび', 'こんぺいとう', 'ひなたぼっこ', 'まんまる', 'ぽかぽか', 'のりしお', 'ちくわぶ', 'すきま', 'ごはんつぶ', 'はなまる', 'どんぐり', 'もちもち',
  'きなこ', 'ぺらぺら', 'ほかほか', 'くるみ', 'ゆでたまご', 'ねじまき', 'ちょうちん', 'わたげ'];
const HIRA_B = ['ず', 'くらぶ', 'しょうてん', 'かぞく', 'きょうだい', 'ぐみ', 'れっしゃ', 'でんわ', 'びより'];
const EN_A = ['ミッドナイト', 'サニー', 'ブルー', 'ゴールデン', 'ハイパー', 'ルナ', 'ネクスト', 'ラッキー', 'スモール', 'ビッグ', 'ワイルド', 'クール', 'ホット', 'ドリーム', 'サンデー'];
const EN_B = ['パンダ', 'ポテト', 'ゴリラ', 'ペンギン', 'ラビット', 'ハムスター', 'アルパカ', 'ドーナツ', 'トースト', 'オムレツ', 'プリン', 'ワッフル', 'ピザ', 'カレー'];
const TRIO_SUFFIX = ['ズ', '団', 'トリオ', '三兄弟', '一家', '隊', '組'];

// Surnames / given names: deliberately on the rarer side (fewer collisions with real famous people), and every generated
// full name is checked against FAMOUS (isRealNameLike) and regenerated on a hit.
const SURNAMES = ['鶴巻', '籾山', '湯浅', '柚木', '汐見', '舘野', '蓮見', '鳴海', '粟津', '檜山', '嵯峨', '穂積', '綿貫', '梶間', '小此木', '宍戸', '唐沢', '鬼塚', '久我', '椎名', '真壁', '沼尻',
  '浦部', '角倉', '柏倉', '雨宮', '東雲', '皆川', '豊永', '越智', '浅倉', '生駒', '岩渕', '大城', '甲斐', '栗栖', '黒須', '郷田', '小柴', '佐伯', '塩見', '瀬戸口', '高砂', '塚越',
  '徳永', '富樫', '那須', '新見', '沼田', '根岸', '野木', '花井', '日高', '平賀', '深町', '藤巻', '水島', '宮路', '村雨', '望月', '八神', '結城', '鷲尾', '一ノ瀬', '犬飼', '卯月',
  '大鳥', '小田切', '鏑木', '久遠', '胡桃沢', '九条', '紅林', '古味', '柴崎', '菅谷', '園部', '大門', '多治見', '丹羽', '津久井', '寺嶋', '戸祭', '仲宗根', '名越', '西園寺', '芳賀', '日向',
  '笛木', '外園', '舞原', '真柴', '六車', '八木沢', '湯川', '万代', '冷泉', '朝比奈', '五十嵐', '漆原', '江波', '大庭', '笠原', '神楽坂', '木暮', '箱崎', '砂川', '鴨下', '榎戸', '樋渡',
  '菰田', '能勢', '保科', '御厨', '桧垣', '瓜生', '唐木', '磯貝', '鳥海', '舟橋', '渡会', '生田目', '吾妻', '曽我部', '奈良橋', '鍋島', '芹生', '土門', '宇留野', '五味', '木賊', '杜',
  '乙部', '鷺沼', '間宮'];
const GIVEN_M = ['一平', '宗介', '慎之介', '航', '晴臣', '圭吾', '洸太', '礼司', '篤志', '匠', '響', '柊', '琢磨', '秀平', '公平', '恭平', '伸吾', '智之', '雅史', '庄司',
  '純平', '卓也', '将吾', '泰造', '鉄平', '冬馬', '紘一', '文哉', '衛', '光輝', '悠真', '陸斗', '新太', '研二', '啓介', '修平', '史朗', '寛太', '鷹志', '朔',
  '栄作', '勘太', '善治', '晃', '惣一', '大和', '樹生', '那由他', '凌'];
const GIVEN_F = ['千景', '小雪', '夕子', '朱里', '環', '志保', '由紀子', '菫', '楓', '詩織', '灯', '七海', '美鈴', '紗英', '都', '和歌子', '瑞穂', '知佳', '梢', '円香',
  '小梅', '葉月', '澪', '絢', '律子', '萌', '若菜', '凪', '晶', '弥生'];
const STAGE_FIRST = ['ジョニー', 'ポテト', 'チャーリー', 'マイク', 'ゴンザレス', 'ピエール', 'エリザベス', 'キャサリン', 'ボビー', 'ジャッキー', 'サンダー', 'ミラクル',
  'ハイテンション', 'ぷりん', 'こてつ', 'ちくわ', 'まめ', 'がんも', 'ひよこ', 'たぬき', 'ぽんず', 'ごま', 'しじみ', 'もずく'];
const STAGE_LAST = ['山本', '田中', '佐藤', '小林', '鈴木', '大佐', '男爵', '伯爵', '博士', '先輩', '師範', '部長', '課長', '一号', '二世', '三太夫'];
// fictional 亭号 for 落語家 (the real lineages — 桂・林家・三遊亭・笑福亭・立川・柳家・春風亭・古今亭・月亭… — are not used)
const TEIGO = ['点々亭', 'ドット亭', '朝凪亭', '満月亭', '風鈴亭', '小鉢亭', '灯台亭', '鈴虫亭', '湯島亭', '寿々亭'];
const RAKU_NAME = ['こまめ', 'ちょう吉', 'まる助', '小ぎん', '福太郎', '笑太', 'さん坊', '一福', '花丸', '若だんご', '万作', 'つる平', '小はる', '鶴松', 'ひな菊'];
const KID_NAMES = ['ゆうと', 'はると', 'そうた', 'りく', 'ゆい', 'ひな', 'めい', 'さくら', 'こはる', 'かいと', 'あおい', 'つむぎ'];

// Well-known real act / person names that must never be generated (exact matches; the generator retries).
const BLOCK = new Set(['ミルクボーイ', 'ラーメンズ', 'ジャルジャル', 'かまいたち', '笑い飯', 'チュートリアル', 'ブラックマヨネーズ', 'パンクブーブー', 'トータルテンボス',
  'アンタッチャブル', 'フットボールアワー', 'ますだおかだ', '中川家', 'とろサーモン', '銀シャリ', 'トレンディエンジェル', 'ウエストランド', '令和ロマン', '錦鯉',
  'マヂカルラブリー', '霜降り明星', 'サンドウィッチマン', 'ハライチ', 'オードリー', 'ナイツ', 'U字工事', 'ペコぱ', 'ぺこぱ', 'ニューヨーク', 'オズワルド', '見取り図',
  'ゆにばーす', 'スーパーマラドーナ', 'ハリセンボン', 'キングコング', '麒麟', 'POISON GIRL BAND', 'ダイアン', 'NON STYLE', 'オリエンタルラジオ', 'バッテリィズ',
  'エバース', 'ヤーレンズ', 'さや香', 'カベポスター', 'ダンビラムーチョ', 'モグライダー', 'ロングコートダディ', 'ランジャタイ', 'インディアンス', '東京ホテイソン',
  'からし蓮根', '和牛', 'スリムクラブ', 'ハマカーン', 'メイプル超合金', 'アキナ', 'ジャングルポケット', 'しずる', '東京03', 'バナナマン', 'ハナコ', 'どぶろっく',
  'ジャルジャル', 'チョコレートプラネット', 'ビスケットブラザーズ', 'サルゴリラ', 'ラブレターズ', '空気階段', 'うるとらブギーズ', 'ザ・ぼんち', 'B&B', 'ツービート',
  '紳助・竜介', 'のりお・よしお', 'オール阪神・巨人', '大木こだま・ひびき', '海原やすよ ともこ', 'ダウンタウン', 'ウッチャンナンチャン', 'とんねるず']);

// ---------------------------------------------------------------- real people never generated
// Well-known real people (comedians, 落語家, actors, singers, athletes, politicians, writers, historical figures), full names without
// spaces. Not complete (it cannot be), so the name lists above also avoid the most common surname × given name pairs.
const FAMOUS_LIST = `明石家さんま 北野武 ビートたけし 松本人志 浜田雅功 内村光良 南原清隆 石橋貴明 木梨憲武 森田一義 タモリ 島田紳助 今田耕司 東野幸治 千原ジュニア
千原せいじ 有吉弘行 上田晋也 有田哲平 太田光 田中裕二 設楽統 日村勇紀 若林正恭 春日俊彰 博多大吉 博多華丸 徳井義実 福田充徳 中川礼二 中川剛 富澤たけし
伊達みきお 塙宣之 土屋伸之 上沼恵美子 山田邦子 渡辺正行 立川志らく 柴田英嗣 山崎弘也 石田明 井上裕介 小杉竜一 吉田敬 山内健司 濱家隆一 哲夫 西田幸治
岩尾望 後藤輝基 川島明 田村裕 陣内智則 宮迫博之 蛍原徹 田村淳 田村亮 加藤浩次 山本圭壱 岡村隆史 矢部浩之 大竹一樹 三村マサカズ 劇団ひとり 小籔千豊 友近
渡辺直美 ヒコロヒー 加藤茶 志村けん いかりや長介 高木ブー 仲本工事 坂上忍 堺正章 研ナオコ 萩本欽一 坂上二郎 林家三平 林家正蔵 笑福亭鶴瓶 笑福亭仁鶴
桂文枝 桂三枝 中田カウス 中田ボタン 横山やすし 西川きよし 藤山寛美 間寛平 池乃めだか 島木譲二 桂小枝 月亭八方 桂ざこば 春風亭小朝 三遊亭円楽 立川談志
古今亭志ん朝 柳家小三治 桂米朝 桂枝雀 林家こん平 林家木久扇 春風亭昇太 三遊亭小遊三 三遊亭好楽 立川談春 立川志の輔 柳家喬太郎 桂雀々 オール阪神 オール巨人
大木こだま 大木ひびき 宮川大助 宮川花子 海原やすよ 海原ともこ 西川のりお 上方よしお 島田洋七 島田洋八 ビートきよし ザ・ぼんち 里見まさと 大平サブロー
大平シロー 今いくよ 今くるよ 夢路いとし 喜味こいし 横山たかし 横山ひろし 中田ダイマル 中田ラケット 横山エンタツ 花菱アチャコ 大村崑 芦屋雁之助 藤田まこと
井上竜夫 吉田ヒロ 川畑泰史 すっちー 酒井藍 島田珠代 チャーリー浜 内場勝則 辻本茂雄 宇都宮まき 鳥居みゆき 小島よしお 桜塚やっくん ゆりやんレトリィバァ
粗品 せいや 霜降り明星 野性爆弾 くっきー ハリウッドザコシショウ アキラ100% マヂカルラブリー 野田クリスタル 村上 錦鯉 長谷川雅紀 渡辺隆 ウエストランド 井口浩之
河本太 令和ロマン 高比良くるま 松井ケムリ 銀シャリ 鰻和弘 橋本直 チュートリアル ブラックマヨネーズ 笑い飯 サンドウィッチマン 中川家 ますだおかだ 増田英彦 岡田圭右
フットボールアワー アンタッチャブル 木村拓哉 中居正広 稲垣吾郎 草彅剛 香取慎吾 松本潤 二宮和也 櫻井翔 相葉雅紀 大野智 福山雅治 桑田佳祐 美空ひばり 石原裕次郎
高倉健 吉永小百合 綾瀬はるか 新垣結衣 石原さとみ 長澤まさみ 北川景子 有村架純 広瀬すず 菅田将暉 佐藤健 山崎賢人 小栗旬 堺雅人 阿部寛 役所広司 渡辺謙
西田敏行 松田優作 田中邦衛 竹内結子 宮崎あおい 上野樹里 松嶋菜々子 山口百恵 松田聖子 中森明菜 安室奈美恵 浜崎あゆみ 宇多田ヒカル 中島みゆき 松任谷由実 美輪明宏
黒柳徹子 和田アキ子 北島三郎 五木ひろし 細川たかし 森進一 石川さゆり 小林幸子 坂本九 加山雄三 沢田研二 郷ひろみ 西城秀樹 野口五郎 田原俊彦 近藤真彦
堂本剛 堂本光一 長瀬智也 岡田准一 木村佳乃 天海祐希 米倉涼子 篠原涼子 深田恭子 仲間由紀恵 井上真央 戸田恵梨香 新田真剣佑 横浜流星 吉沢亮 中村倫也
大泉洋 香川照之 堤真一 唐沢寿明 織田裕二 江口洋介 反町隆史 竹野内豊 福士蒼汰 三浦春馬 窪田正孝 山田孝之 オダギリジョー 浅野忠信 妻夫木聡 松山ケンイチ
前田健太 大谷翔平 鈴木一朗 イチロー 松井秀喜 田中将大 ダルビッシュ有 松坂大輔 長嶋茂雄 王貞治 野茂英雄 落合博満 清原和博 桑田真澄 佐々木朗希 山本由伸
村上宗隆 菊池雄星 上原浩治 黒田博樹 原辰徳 星野仙一 野村克也 古田敦也 新庄剛志 宮本慎也 金本知憲 掛布雅之 江川卓 本田圭佑 香川真司 長友佑都 中田英寿
三浦知良 久保建英 三笘薫 遠藤航 内田篤人 中村俊輔 川島永嗣 岡崎慎司 吉田麻也 澤穂希 羽生結弦 浅田真央 高橋大輔 宇野昌磨 荒川静香 安藤美姫 紀平梨花
大坂なおみ 錦織圭 内村航平 北島康介 吉田沙保里 伊調馨 室伏広治 池江璃花子 八村塁 渡邊雄太 井上尚弥 村田諒太 具志堅用高 辰吉丈一郎 亀田興毅 高橋尚子
有森裕子 野口みずき 瀬古利彦 為末大 桐生祥秀 サニブラウン 福原愛 石川佳純 伊藤美誠 張本智和 水谷隼 高梨沙羅 小平奈緒 葛西紀明 原田雅彦 船木和喜
白鵬 朝青龍 貴乃花 若乃花 曙 武蔵丸 千代の富士 北の湖 大鵬 稀勢の里 照ノ富士 アントニオ猪木 ジャイアント馬場 長州力 武藤敬司 蝶野正洋 橋本真也 三沢光晴
安倍晋三 菅義偉 岸田文雄 石破茂 小泉純一郎 小泉進次郎 麻生太郎 野田佳彦 菅直人 鳩山由紀夫 鳩山一郎 河野太郎 河野洋平 高市早苗 小池百合子 田中角栄 中曽根康弘
竹下登 橋本龍太郎 小渕恵三 森喜朗 福田康夫 福田赳夫 大平正芳 三木武夫 佐藤栄作 岸信介 吉田茂 池田勇人 枝野幸男 蓮舫 細川護熙 村山富市 海部俊樹 宮沢喜一
羽田孜 宇野宗佑 田中真紀子 志位和夫 山本太郎 玉木雄一郎 小沢一郎 岡田克也 前原誠司 辻元清美 福島瑞穂 石原慎太郎 橋下徹 松井一郎 吉村洋文 東国原英夫
村上春樹 夏目漱石 芥川龍之介 太宰治 川端康成 三島由紀夫 東野圭吾 宮部みゆき 又吉直樹 司馬遼太郎 松本清張 赤川次郎 宮崎駿 手塚治虫 鳥山明 尾田栄一郎
坂本龍馬 織田信長 徳川家康 豊臣秀吉 西郷隆盛 勝海舟 伊藤博文 福沢諭吉 野口英世 聖徳太子 紫式部 清少納言 源頼朝 武田信玄 上杉謙信 伊達政宗 真田幸村
久米宏 古舘伊知郎 徳光和夫 みのもんた 関口宏 草野仁 小倉智昭 宮根誠司 羽鳥慎一 安住紳一郎 所ジョージ 堺正章 中山秀征 恵俊彰 坂上忍 マツコ・デラックス
ジャニー喜多川 秋元康 つんく 小室哲哉 YOSHIKI GACKT 矢沢永吉 長渕剛 吉田拓郎 井上陽水 さだまさし 玉置浩二 稲葉浩志 松本孝弘 桜井和寿 米津玄師 藤井風`;
// More real people (talents / characters often confused with generated names) and comedians known by one name (a bare
// surname or stage name: a judge's short name or a one-word stage name must not equal these)
const FAMOUS_PEOPLE_2 = `若槻千夏 矢吹丈 狩野英孝 ジャッキー佐藤 吉住 久保田 片桐 入江 浜口 濱口 黒沢 大悟 ノブ 山里 岩井 澤部 設楽 日村 飯塚 豊本 角田
秋山 馬場 有野 大島 箕輪 近藤 白鳥 川村 狩野 向井 尾形 菅 関根 千秋 小峠 河本 井口 塙 土屋 富澤 伊達 岩尾 徳井 小籔 陣内 友近 バカリズム ほっしゃん
なだぎ武 中山功太 あべこうじ 佐久間一行 三浦マイルド やまもとまさみ じゅんいちダビッドソン 濱田祐太郎 お見送り芸人しんいち 田津原理音 街裏ぴんく 友田オレ
だいたひかる 浅越ゴエ ルシファー吉岡 おいでやす小田 こがけん マツモトクラブ サツマカワRPG ZAZY 寺田寛明 ヒューマン中村 kentofukaya 阿佐ヶ谷姉妹
柳原可奈子 いとうあさこ 大久保佳代子 光浦靖子 椿鬼奴 横澤夏子 近藤春菜 箕輪はるか 白鳥久美子 川村エミコ 山里亮太 岩井勇気 澤部佑 飯塚悟志 角田晃広
豊本明長 秋山竜次 小峠英二 西村瑞樹 千鳥 大悟 南海キャンディーズ しずちゃん 山崎静代 劇団ひとり 鳥居みゆき 永野 ハリウッドザコシショウ`;
// Real combo / trio / unit names (M-1, キングオブコント, R-1, THE SECOND, THE W finalists and other well-known acts). A generated
// act name that equals one, or contains one of 4+ characters, is regenerated.
const REAL_ACTS = `中川家 ハリガネロック アメリカザリガニ ますだおかだ 麒麟 フットボールアワー キングコング チュートリアル おぎやはぎ DonDokoDon 笑い飯
テツandトモ スピードワゴン いつもここから ダイノジ アンタッチャブル 2丁拳銃 りあるキッズ 千鳥 南海キャンディーズ タカアンドトシ POISONGIRLBAND
東京ダイナマイト トータルテンボス ブラックマヨネーズ 品川庄司 タイムマシーン3号 アジアン 変ホ長調 ザ・プラン9 ライセンス サンドウィッチマン ハリセンボン
ザブングル ダイアン NONSTYLE オードリー ナイツ U字工事 ザ・パンチ モンスターエンジン パンクブーブー ハライチ スリムクラブ 銀シャリ ジャルジャル カナリア
ピース トレンディエンジェル スーパーマラドーナ 和牛 メイプル超合金 馬鹿よ貴方は さらば青春の光 カミナリ 相席スタート とろサーモン ミキ かまいたち さや香
ゆにばーす マヂカルラブリー 霜降り明星 見取り図 トム・ブラウン ギャロップ ミルクボーイ ぺこぱ ペコぱ からし蓮根 オズワルド すゑひろがりず インディアンス
ニューヨーク おいでやすこが アキナ 錦鯉 東京ホテイソン ウエストランド ロングコートダディ 真空ジェシカ もも モグライダー ランジャタイ 男性ブランコ
カベポスター ダイヤモンド ヨネダ2000 キュウ 令和ロマン ヤーレンズ マユリカ ダンビラムーチョ くらげ バッテリィズ エバース ジョックロック ダイタク
ママタルト たくろう ドンデコルテ 豪快キャプテン めぞん バッファロー吾郎 2700 ロバート TKO 天竺鼠 バナナマン 東京03 チョコレートプラネット ザ・ギース
しずる インパルス ロッチ キングオブコメディ ジャングルポケット ラバーガール バイきんぐ うしろシティ かもめんたる 鬼ヶ島 アルコ&ピース シソンヌ
バンビーノ 犬の心 コロコロチキチキペッパーズ ライス にゃんこスター わらふぢなるお ハナコ どぶろっく うるとらブギーズ ネルソンズ ニッポンの社長
空気階段 ザ・マミィ そいつどいつ ビスケットブラザーズ や団 いぬ かが屋 コットン サルゴリラ カゲヤマ ファイヤーサンダー ゼンモンキー ラブレターズ cacao
シティホテル3階 隣人 マシンガンズ 金属バット 囲碁将棋 テンダラー 超新塾 ガクテンソク ハンジロウ タモンズ ツートライブ 3時のヒロイン オダウエダ
天才ピアニスト 紅しょうが にぼしいわし エルフ 流れ星☆ 流れ星 雨上がり決死隊 ナインティナイン よゐこ ロンドンブーツ1号2号 ネプチューン くりぃむしちゅー
爆笑問題 浅草キッド ダチョウ倶楽部 出川哲朗 ウッチャンナンチャン ダウンタウン とんねるず ツービート B&B ザ・ぼんち 紳助・竜介 のりお・よしお
オール阪神・巨人 大木こだま・ひびき 海原やすよともこ 宮川大助・花子 今いくよ・くるよ 夢路いとし・喜味こいし 横山やすし・西川きよし 次長課長
フルーツポンチ パンサー ハマカーン 磁石 ピスタチオ 森三中 たんぽぽ オアシズ ハイキングウォーキング ずん 響 アンジャッシュ ドランクドラゴン
パラシュート部隊 ラーメンズ 品川庄司 COWCOW ジョイマン ロッチ どきどきキャンプ エレキコミック ラーメンズ おぎやはぎ キャイ～ン さまぁ～ず バカルディ
くりぃむしちゅー ペナルティ ガレッジセール 平成ノブシコブシ ピース NON STYLE ニッチェ 尼神インター 蛙亭 ゆりやんレトリィバァ 四千頭身 EXIT
宮下草薙 ぼる塾 ハナコ 3時のヒロイン ダイアン トットちゃんねる`;
const FAMOUS = new Set([...FAMOUS_LIST.split(/\s+/), ...FAMOUS_PEOPLE_2.split(/\s+/), ...REAL_ACTS.split(/\s+/)].filter(Boolean).map((x) => x.replace(/[・]/g, '')));
const norm = (s) => String(s || '').replace(/[\s　・]/g, '');
// true when a name is (or contains) a well-known real person's name — use it for any generated person / act name
export function isRealNameLike(name) {
  const n = norm(name);
  if (!n) return false;
  if (FAMOUS.has(n)) return true;
  for (const part of String(name).split(/[（）()「」、,／/]/)) { const q = norm(part); if (q && FAMOUS.has(q)) return true; }
  if (n.length >= 4) for (const f of FAMOUS) if (f.length >= 4 && n.includes(f)) return true;
  return false;
}

// ---------------------------------------------------------------- names
export function personName(r, female = r() < 0.18) {
  for (let i = 0; i < 12; i++) {
    const sur = pickR(r, SURNAMES), giv = pickR(r, female ? GIVEN_F : GIVEN_M);
    const n = `${sur} ${giv}`;
    if (!isRealNameLike(n) && !isRealNameLike(sur)) return n; // the surname alone is a judge's / member's short name
  }
  return `${pickR(r, SURNAMES)} ${female ? '小梅' : '那由他'}`;
}
export function shortOf(full) { return String(full).split(' ').pop(); }

function combiName(r) {
  const k = r();
  if (k < 0.24) return pickR(r, KATA_A) + pickR(r, KATA_B);
  if (k < 0.5) return pickR(r, KAN_A) + pickR(r, KAN_B);
  if (k < 0.66) return pickR(r, KATA_A) + pickR(r, KAN_B);
  if (k < 0.8) return pickR(r, EN_A) + pickR(r, EN_B);
  if (k < 0.9) return pickR(r, HIRA) + pickR(r, HIRA_B);
  return pickR(r, KAN_A) + pickR(r, KATA_B);
}
function trioName(r) {
  const k = r();
  if (k < 0.4) return pickR(r, KATA_A) + pickR(r, TRIO_SUFFIX);
  if (k < 0.75) return pickR(r, KAN_A) + pickR(r, ['探偵団', '一座', '旅団', '親衛隊', '三兄弟', '組']);
  return pickR(r, EN_A) + pickR(r, EN_B) + 'ズ';
}
function pinName(r) {
  const k = r();
  if (k < 0.45) return pickR(r, STAGE_FIRST) + pickR(r, STAGE_LAST);
  if (k < 0.75) return `${pickR(r, SURNAMES)}${pickR(r, ['ポテト', 'ジョニー', 'まめ', 'ちくわ', 'ハイウェイ', 'スマイル', '大魔王', 'チャンピオン', 'ロボ', '探偵'])}`;
  return `${pickR(r, ['ひとり', 'ミスター', 'ドクター', 'キャプテン', 'マダム', 'ビッグ'])}${pickR(r, KATA_A)}`;
}
// A fictional act name of that type ('combi' | 'trio' | 'pin' | 'rakugo' | 'kids'), never one of BLOCK.
export function actName(r, type) {
  for (let i = 0; i < 8; i++) {
    const n = type === 'trio' ? trioName(r) : type === 'pin' ? pinName(r) : type === 'rakugo' ? `${pickR(r, TEIGO)}${pickR(r, RAKU_NAME)}` : type === 'kids' ? `${pickR(r, ['なにわ', 'えびす', 'たこやき', 'ちびっこ', 'わんぱく', 'はなまる'])}${pickR(r, ['キッズ', 'ジュニア', 'こぞう', 'ぼーいず', 'がーるず', 'きょうだい'])}` : combiName(r);
    if (!BLOCK.has(n) && !isRealNameLike(n)) return n;
  }
  return 'ドット' + Math.floor(r() * 1000);
}
export function kidName(r) { for (let i = 0; i < 8; i++) { const n = `${pickR(r, SURNAMES)} ${pickR(r, KID_NAMES)}`; if (!isRealNameLike(n)) return n; } return `${pickR(r, SURNAMES)} こはる`; }

// ---------------------------------------------------------------- agencies (real ones of this game + fictional)
// グレープカンパニー: a 2000s-founded office; its exact founding year was not verified, so rival acts belong to it only
// from 2011 on (generic, never earlier). よしもと / 松竹芸能 / ホリプロ existed through every era of the game.
export const FICTIONAL_AGENCIES = ['ドットプロモーション', '笑栄社', 'ひだまり芸能', 'カラクリ企画', 'こもれび芸能', 'マルヒゲ興業', 'ワラビー企画', 'うずまき舎', '月見台プロ', 'あさがお企画'];
export const REAL_AGENCY_NAMES = { yoshimoto: 'よしもと', shochiku: '松竹芸能', horipro: 'ホリプロ', grape: 'グレープ' };
export function agencyFor(r, year, region) {
  const k = r();
  if (region === 'osaka') {
    if (k < 0.62) return 'yoshimoto';
    if (k < 0.8) return 'shochiku';
    return pickR(r, FICTIONAL_AGENCIES);
  }
  if (k < 0.42) return 'yoshimoto';
  if (k < 0.5) return 'shochiku';
  if (k < 0.6) return 'horipro';
  if (k < 0.68 && year >= 2011) return 'grape';
  return pickR(r, FICTIONAL_AGENCIES);
}
export function agencyLabel(a) { return !a ? 'アマチュア' : REAL_AGENCY_NAMES[a] || a; }

// ---------------------------------------------------------------- looks
const HAIRS = ['short', 'long', 'bob', 'spiky', 'slick', 'afro', 'cap', 'bald'];
const HCOL = ['black', 'black', 'black', 'brown', 'brown', 'blonde', 'silver', 'orange', 'red'];
const TOPS = ['#d64161', '#3f5fa8', '#2f9a4a', '#ffd23f', '#ff8a3d', '#8a5ac8', '#5fd7ff', '#f2f2f2', '#2e3140', '#c0452f', '#5ec4a8', '#ff7eb6', '#7a4a9a'];
const BOTS = ['#2a2d36', '#3a4a7a', '#1e1e26', '#5a4a3a', '#2a3560', '#3b3f48', '#6a5a8a'];
export function lookFor(r, female = false, kid = false) {
  const look = { hair: female ? pickR(r, ['long', 'bob', 'twin', 'short']) : pickR(r, HAIRS), hairColor: pickR(r, HCOL), skin: pickR(r, ['fair', 'light', 'tan']), top: pickR(r, TOPS), bottom: pickR(r, BOTS) };
  if (look.hair === 'cap') look.hat = pickR(r, TOPS);
  if (r() < 0.25) look.glasses = true;
  if (r() < 0.3 && !kid) look.jacket = true;
  if (r() < 0.2 && !kid) look.tie = pickR(r, TOPS);
  if (female && r() < 0.5) look.skirt = true;
  return look;
}

// ---------------------------------------------------------------- judges (fictional veterans)
const JUDGE_TITLES = [
  ['漫才師', 'kansai'], ['漫才師', 'std'], ['コント師', 'std'], ['落語家', 'std'], ['放送作家', 'std'], ['演出家', 'std'], ['劇作家', 'std'],
  ['ピン芸人', 'std'], ['漫才師', 'kansai'], ['お笑い評論家', 'std'], ['元・漫才師', 'kansai'], ['喜劇俳優', 'kansai'], ['テレビプロデューサー', 'std'],
];
export const TASTES = [
  { id: 'tsukami', label: 'ツカミ重視', part: 'timing' }, { id: 'kousei', label: '構成重視', part: 'neta' }, { id: 'atarashisa', label: '新しさ重視', part: 'neta' },
  { id: 'gijutsu', label: '技術重視', part: 'execution' }, { id: 'hana', label: '華・キャラ重視', part: 'presence' }, { id: 'ma', label: '間を重視', part: 'timing' },
  { id: 'netsuryo', label: '熱量重視', part: 'presence' }, { id: 'kyaku', label: '客席の反応重視', part: 'crowd' },
];
export function judgePerson(r) {
  const [title, dialect] = pickR(r, JUDGE_TITLES);
  const female = r() < 0.22;
  const name = personName(r, female);
  const career = 18 + Math.floor(r() * 32);
  const unit = /漫才|コント/.test(title) ? `元「${actName(r, r() < 0.8 ? 'combi' : 'trio')}」` : '';
  const taste = pickR(r, TASTES);
  return { name, title: `${title}${unit ? '・' + unit : ''}（芸歴${career}年）`, short: String(name).split(' ')[0], taste: taste.label, tasteId: taste.id, tastePart: taste.part, dialect, strict: Math.round((r() - 0.5) * 6), look: lookFor(r, female), female };
}

// What a judge says about a performance (score 0..100, result parts), in their own voice.
export function judgeComment(r, j, score, res = {}) {
  const k = j.dialect === 'kansai';
  const part = j.partNow || j.tastePart || 'neta'; // [R11-J] a judge whose taste has drifted talks about what they care about now
  const hi = score >= 80, mid = score >= 60;
  const lines = {
    timing: hi ? (k ? '入りのツカミで、もう客席つかんどったな。' : '最初の10秒で空気をつかんでいました。') : mid ? (k ? 'ツカミはよかった。中盤で間がもたついたな。' : 'ツカミはいい。中盤のテンポが少し落ちました。') : (k ? '間が詰まりすぎや。お客さんが笑う時間をあげな。' : '間が詰まっていて、笑う余白がなかったです。'),
    neta: hi ? (k ? 'ネタの構成がきれいや。最後の回収で全部つながった。' : 'フリと回収の構成が見事でした。') : mid ? (k ? '発想はおもろい。展開がもう一段ほしいな。' : '発想はいいので、後半にもう一展開ほしい。') : (k ? 'ネタの骨組みがまだ弱い。何を見せたいかを絞らな。' : 'ネタの軸がぼやけていました。何で笑わせるかを絞って。'),
    execution: hi ? (k ? '噛まへん、ブレへん。技術はもう一級品や。' : '言葉の粒立ちがよく、技術が高い。') : mid ? (k ? '言い回しで一回つまずいたのがもったいない。' : '一度つまずいたのがもったいなかった。') : (k ? '声が通ってへん。後ろの席まで届いてないで。' : '声量と滑舌がまだ足りません。'),
    presence: hi ? (k ? 'ふたりとも華がある。出てきただけで空気が変わったわ。' : '出てきた瞬間の華がありました。') : mid ? (k ? 'キャラはええ。もっと前に出てええんちゃう。' : 'キャラは見えた。もっと自信を持っていい。') : (k ? '緊張が伝わってきてもうた。もっと楽しまな。' : '緊張がそのまま客席に伝わっていました。'),
    crowd: hi ? (k ? '客席がずっと揺れとった。それが全てや。' : '客席の笑いが途切れなかった。') : mid ? (k ? 'ウケてたけど、爆発はもう一歩やったな。' : 'ウケてはいたが、爆発までは届かなかった。') : (k ? 'お客さんを置いていってもうてたな。' : 'お客さんを置いていってしまいました。'),
  };
  let s = lines[part] || lines.neta;
  if (res.overtime > 0) s += k ? '尺オーバーはあかんで。' : '尺オーバーは減点です。';
  else if (res.flubs >= 2) s += k ? '噛みが続いたのが痛い。' : '噛みが重なったのが痛い。';
  return s;
}

// ---------------------------------------------------------------- 進行役 / staff (fictional)
export function hostPerson(r) { const female = r() < 0.4; return { name: personName(r, female), look: lookFor(r, female) }; }

// ---------------------------------------------------------------- tags shown with rivals
export const TAG_COLORS = { 前年王者: '#ffd23f', ラストイヤー: '#ff6470', アマチュア: '#8ab4d8', 初出場: '#7fe08a', 準決勝常連: '#ff9a3c', 決勝経験者: '#ffb547',
  大学お笑い出身: '#b48cff', 高校生: '#5fd7ff', 敗者復活から: '#ff7eb6', 芸歴1年目: '#9fe0a8', NSC出身: '#e8c45a', 社会人: '#a8b0c0', 優勝候補: '#ff5468', ダークホース: '#c09cff', 小学生: '#5fd7ff', 中学生: '#5fd7ff' };

// ---------------------------------------------------------------- 実力不足 phrases (staff notes for a failed 予選)
export const FAIL_NOTES = {
  neta: ['ネタの構成が弱い（フリが長く、ボケまでが遠い）', '後半の展開がなく、尻すぼみ', 'オチが弱く、拍手笑いが起きなかった', '設定がありがち（新しさがない）'],
  boke: ['ボケの数が少ない', 'ボケが伝わりにくい（説明不足）'],
  tsukkomi: ['ツッコミのワードが弱い', 'ツッコミが遅い（間延びしている）'],
  ma: ['間が詰まりすぎ（笑いを待てていない）', 'テンポが一定で単調'],
  voice: ['声量が足りない（後ろの席まで届いていない）', '噛みが目立つ（滑舌）'],
  act: ['演技が硬く、設定に入り込めていない', '役の切り替えがあいまい'],
  hassou: ['発想がありきたり', '一つのアイデアを広げきれていない'],
  wagei: ['話がくどい（言葉が多すぎる）', '語り口が一本調子'],
  dokyo: ['緊張で声がうわずっていた', '客席を見られていない'],
  chara: ['キャラが見えない（ふたりの関係性がわからない）', '華が足りない'],
  adlib: ['客席の反応に合わせられていない'],
  mane: ['似ていない（特徴のとらえ方が浅い）'],
  tsukami: ['ツカミで客席をつかめなかった'],
  overtime: ['尺オーバー（制限時間を超えて減点）'],
  crowd: ['客層に合っていない（ネタが客席に届いていない）'],
};

// ---------------------------------------------------------------- era words
// How results reach people in the contest's year (not the save's era).
export function resultMedium(year) {
  if (year < 1997) return { short: '会場の掲示板', how: '会場の掲示板と後日届くハガキ' };
  if (year < 2008) return { short: '公式サイト', how: '会場の掲示板と公式サイト' };
  return { short: '公式サイト', how: '公式サイトとSNS' };
}
// ネットの反応 by the contest's year: before the internet a 街の声 / スポーツ紙, then 掲示板, ブログ, SNS (this game's ドッター).
export function netVoice(year) {
  if (year < 1997) return { label: '街の声', who: ['会社員（40代）', '大学生（20歳）', '主婦（30代）', '高校生（17歳）', '商店主（60代）'], how: 'スポーツ新聞の街頭インタビュー' };
  if (year < 2004) return { label: 'ネット掲示板の反応', who: ['名無しさん', '名無しさん', 'お笑い好き', '関西在住'], how: 'インターネットの掲示板' };
  if (year < 2010) return { label: 'ブログ・掲示板の反応', who: ['お笑いブログ', '名無しさん', 'ケータイからの投稿', '地方在住'], how: 'ブログや掲示板' };
  return { label: 'ドッターの反応', who: ['@owarai_suki', '@neta_mania', '@kansai_ojisan', '@gakusei_23', '@hazama_fan'], how: 'SNS（ドッター）' };
}
export const NET_LINES = {
  champ: ['これは納得の優勝。{name}、ずっと応援してた！', '最後のネタ、鳥肌立った。', '{name}、来年からテレビで見まくることになりそう', '審査、割れたけど妥当だと思う', '決勝で一番笑ったのは{name}だった'],
  award: ['{name}の受賞、納得しかない', '{name}、ずっと応援してた！', '{name}、来年からテレビで見まくることになりそう', '{name}の舞台、一回生で見てみたい', '今年は{name}の年だったな'],
  upset: ['まさか{name}が落ちるとは…', '{name}が敗退は荒れすぎ', '予選の審査、たまにわからない', '{name}は来年リベンジしてほしい'],
  player: ['{name}って誰？めっちゃおもろかった', '{name}、名前覚えた', '{name}のネタ、もう一回見たい', 'え、{name}おもろいやん', '{name}、まだ伸びるでこれは'],
  playerBad: ['{name}、緊張してたな', '{name}は次に期待', '{name}、ネタ選びが惜しかった'],
};
export function fillName(s, name) { return String(s).replaceAll('{name}', name); }
