// 4択クイズ — a quiz-show minigame (skill: talk).
//
//   await g.minigame('quiz', { category: 'tv', difficulty: 3 })
//   await g.minigame('quiz', { questions: [{ q: '問題文？', choices: ['正解', 'はずれ', 'はずれ', 'はずれ'], answer: 0 }] })
//
// opts
//   category   'general' | 'japan' | 'osaka' | 'tv' | 'movie' | 'music' | 'mix'  (or an array of them)
//              default 'mix' (every category). Unknown names fall back to 'mix'.
//   questions  custom questions [{ q, choices: [2..4 strings], answer: index (or the correct string) }].
//              They replace the built-in bank (padded from `category` when `count` asks for more and a
//              category is given). Choices are shuffled unless shuffle: false.
//   count      number of questions (default 5 + difficulty; with custom questions: how many there are)
//   time       seconds per question (default: by difficulty, a little longer with the talk skill)
//   hints      number of 50:50 hints (B button). default: by difficulty (+1 for skilled players)
//   show       show name on the studio sign (default 'クイズ！ドット王')
//   genre      genre label for custom questions (default 'スペシャル')
//
//   year       game year for the era check (default: the game date) — a question is asked only in the
//              years it is true (ERA below; the 雑学 bank in js/engine/quiz_bank.js carries from / to too)
//   practice   true: a practice run (the 雑学 record counts it fully; a real show counts half)
//   format     'classic' forces this 4択 even for a show that has its own format
//   New categories from js/engine/quiz_bank.js may be named too: 'kanji' 'kotowaza' 'chiri' 'rekishi' 'rika'
//   'eigo' 'katakana' 'keisan' 'joshiki' 'geino' (or 'all' = every category of both banks).
//
// TV quiz shows with their own format (クイズ!ヘキサゴン / II, ネプリーグ, 短縮鉄道の夜 — by opts.show / opts.showId,
// or any opts.stages) are handed to the HD format minigame 'quizstudio' (js/engine/quiz_studio.js): the
// registered 'quiz' is a small dispatcher that returns that minigame instead. Everything else plays here.
// 雑学・知識 (js/engine/quiz_app.js): g.quizBonus(show) is added to the bonus (shown on the intro card) and
// its pts to the score; every answer goes to g.quizRecord. Touch / mouse: a tap on an answer answers it.
//
// Controls: d-pad moves the cursor on a 2x2 answer grid, A answers, B uses a hint.
// Score: each question is worth 100/count. A correct answer earns 85% of it plus up to 15% for speed
// (full speed bonus while at least 40% of the time is left); hint-assisted answers earn 60% of that.

import { Minigame, registerMinigame, text, panel, rect, wrap, COLORS, sparkle } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheet, drawChar, LOOKS } from '../engine/sprites.js';
import { audio, registerSong } from '../engine/audio.js';
import { W, clamp, shuffle, makeCanvas, mix } from '../engine/util.js';
import { MINIGAMES } from '../engine/minigame.js';
import { pick as bankPick, CATS as BANK2_CATS, CAT_IDS as BANK2_IDS, showOf, qOk } from '../engine/quiz_bank.js';
import { gameYM, bindTap } from '../engine/quiz_studio.js';

// ------------------------------------------------------------------ question bank
// [question, [correct, wrong, wrong, wrong], level 1..3]. The correct answer is always first here;
// choices are shuffled at runtime.
const BANK = {
  general: [
    ['1年は何日？（うるう年ではない年）', ['365日', '360日', '366日', '364日'], 1],
    ['1ダースはいくつ？', ['12', '10', '20', '24'], 1],
    ['1時間は何秒？', ['3600秒', '600秒', '1200秒', '6000秒'], 1],
    ['1kmは何m？', ['1000m', '100m', '500m', '10000m'], 1],
    ['「こどもの日」は何月何日？', ['5月5日', '3月3日', '7月7日', '1月7日'], 1],
    ['太陽がのぼってくる方角は？', ['東', '西', '南', '北'], 1],
    ['十二支に入っていない動物は？', ['ネコ', 'イヌ', 'ウマ', 'トラ'], 1],
    ['漢字「山」の画数は？', ['3画', '2画', '4画', '5画'], 1],
    ['サッカーで、試合中フィールドに出る1チームの人数は？', ['11人', '9人', '7人', '15人'], 1],
    ['1円玉の主な材料は？', ['アルミニウム', '銅', '鉄', '銀'], 2],
    ['三角形の3つの角の大きさを合計すると？', ['180度', '90度', '270度', '360度'], 2],
    ['次のうち、ほ乳類はどれ？', ['クジラ', 'サメ', 'マグロ', 'ペンギン'], 2],
    ['日本で、1年でいちばん昼の時間が長い日は？', ['夏至', '冬至', '春分の日', '秋分の日'], 2],
    ['1気圧のとき、水が沸騰する温度は？', ['約100℃', '約50℃', '約80℃', '約150℃'], 2],
    ['「春分の日」がある月は？', ['3月', '2月', '4月', '5月'], 2],
    ['地球からいちばん近い恒星は？', ['太陽', '月', '北極星', 'シリウス'], 3],
    ['大人の歯（永久歯）は親知らずも入れて何本？', ['32本', '28本', '24本', '36本'], 3],
    ['卵を産むほ乳類はどれ？', ['カモノハシ', 'コアラ', 'カンガルー', 'ラッコ'], 3],
    ['日本の国鳥は？', ['キジ', 'ツル', 'ハト', 'スズメ'], 3],
  ],
  japan: [
    ['日本でいちばん高い山は？', ['富士山', '北岳', '槍ヶ岳', '浅間山'], 1],
    ['日本でいちばん大きい湖は？', ['琵琶湖', '霞ヶ浦', '猪苗代湖', '浜名湖'], 1],
    ['日本の都道府県の数は？', ['47', '43', '45', '50'], 1],
    ['日本でいちばん面積が大きい都道府県は？', ['北海道', '岩手県', '長野県', '新潟県'], 1],
    ['日本でいちばん人口が多い都道府県は？', ['東京都', '大阪府', '神奈川県', '愛知県'], 1],
    ['「さぬきうどん」で有名な県は？', ['香川県', '徳島県', '愛媛県', '高知県'], 1],
    ['りんごの生産量が日本一の県は？', ['青森県', '長野県', '山形県', '秋田県'], 1],
    ['みかんづくりがさかんなことで有名な県は？', ['和歌山県', '北海道', '青森県', '新潟県'], 1],
    ['「八ツ橋」が名物の都道府県は？', ['京都府', '奈良県', '滋賀県', '兵庫県'], 1],
    ['「ゴーヤーチャンプルー」が郷土料理の県は？', ['沖縄県', '鹿児島県', '宮崎県', '高知県'], 1],
    ['愛知県の県庁所在地は？', ['名古屋市', '豊田市', '岡崎市', '豊橋市'], 1],
    ['日本でいちばん面積が小さい都道府県は？', ['香川県', '大阪府', '東京都', '沖縄県'], 2],
    ['日本でいちばん長い川は？', ['信濃川', '利根川', '石狩川', '北上川'], 2],
    ['さくらんぼの生産量が日本一の県は？', ['山形県', '山梨県', '福島県', '岩手県'], 2],
    ['「もみじまんじゅう」が名物の県は？', ['広島県', '岡山県', '山口県', '島根県'], 2],
    ['「牛タン焼き」が名物として有名な都市は？', ['仙台市', '盛岡市', '秋田市', '新潟市'], 2],
    ['沖縄県の県庁所在地は？', ['那覇市', '沖縄市', '名護市', '石垣市'], 2],
    ['富士山がまたがっている2つの県は？', ['静岡県と山梨県', '静岡県と神奈川県', '山梨県と長野県', '神奈川県と山梨県'], 2],
    ['日本のおもな4つの島に入らないのは？', ['沖縄本島', '本州', '四国', '九州'], 2],
    ['都道府県のうち「府」はいくつある？', ['2つ', '1つ', '3つ', '4つ'], 2],
    ['日本最南端の島「沖ノ鳥島」がある都道府県は？', ['東京都', '沖縄県', '鹿児島県', '長崎県'], 3],
    ['「しまなみ海道」が結ぶのは広島県と何県？', ['愛媛県', '香川県', '岡山県', '山口県'], 3],
  ],
  osaka: [
    ['大阪名物「たこ焼き」に入っている具の代表は？', ['タコ', 'イカ', 'エビ', 'ちくわ'], 1],
    ['関西弁の「おおきに」の意味は？', ['ありがとう', 'こんにちは', 'さようなら', 'ごめんなさい'], 1],
    ['関西弁の「あかん」の意味は？', ['だめ', 'すごい', 'ほんとう', 'かわいい'], 1],
    ['関西弁の「めっちゃ」の意味は？', ['とても', '少し', 'たまに', 'ぜんぜん'], 1],
    ['奈良公園をのんびり歩いている動物は？', ['シカ', 'サル', 'ウサギ', 'タヌキ'], 1],
    ['関西でいう「粉もん」に入らないのは？', ['にぎり寿司', 'たこ焼き', 'お好み焼き', 'いか焼き'], 1],
    ['神戸市がある都道府県は？', ['兵庫県', '大阪府', '京都府', '岡山県'], 1],
    ['串カツ屋さんでおなじみのルールは？', ['ソースの二度づけ禁止', 'おはしの使用禁止', '1本ずつ注文', '立って食べる'], 2],
    ['大阪で「キタ」と呼ばれる繁華街は？', ['梅田のあたり', 'なんばのあたり', '天王寺のあたり', '新世界のあたり'], 2],
    ['通天閣があるのは大阪のどの街？', ['新世界', '梅田', '心斎橋', '天満'], 2],
    ['「京の着倒れ、大阪の○○」。○○に入るのは？', ['食い倒れ', '飲み倒れ', '履き倒れ', '遊び倒れ'], 2],
    ['江戸時代の大阪は何と呼ばれた？', ['天下の台所', '天下の玄関', '天下の庭', '天下の宝庫'], 2],
    ['イチョウ並木で有名な大阪のメインストリートは？', ['御堂筋', '堺筋', '谷町筋', '松屋町筋'], 2],
    ['たくさんの朱色の鳥居で有名な京都の神社は？', ['伏見稲荷大社', '八坂神社', '平安神宮', '北野天満宮'], 2],
    ['1970年に大阪で開かれた国際的な催しは？', ['万国博覧会', '夏のオリンピック', '冬のオリンピック', 'ラグビーW杯'], 2],
    ['関西弁「この本なおしといて」の意味は？', ['片付けておいて', '修理しておいて', '書き直しておいて', '捨てておいて'], 2],
    ['2025年の大阪・関西万博の会場になった島は？', ['夢洲', '咲洲', '舞洲', 'ポートアイランド'], 3],
    ['道頓堀川にかかる、ミナミの待ち合わせで有名な橋は？', ['戎橋', '淀屋橋', '天神橋', '京橋'], 3],
    ['大阪の「天神祭」は、どこのお祭り？', ['大阪天満宮', '住吉大社', '四天王寺', '今宮戎神社'], 3],
    ['日本最大の前方後円墳「大仙陵古墳」がある市は？', ['堺市', '大阪市', '東大阪市', '高槻市'], 3],
    ['琵琶湖の水を大阪湾へと運ぶ大きな川は？', ['淀川', '鴨川', '大和川', '武庫川'], 3],
    ['大阪城があるのは大阪市の何区？', ['中央区', '北区', '浪速区', '天王寺区'], 3],
  ],
  tv: [
    ['NHKの正式な名前は？', ['日本放送協会', '日本放送会社', '日本電波協会', '国民放送局'], 1],
    ['スタジオの「ON AIR」ランプがつくのはどんなとき？', ['放送・収録中', '休けい中', '準備中', '片付け中'], 1],
    ['番組の合間などに流れる、宣伝の短い映像は？', ['CM', 'テロップ', 'ワイプ', 'カンペ'], 1],
    ['カメラの横で、出演者に指示を書いて見せる紙は？', ['カンペ', 'テロップ', 'ワイプ', 'ロケ'], 1],
    ['録画ではなく、その場で放送することを何という？', ['生放送', '再放送', '録画放送', '総集編'], 1],
    ['前に放送した番組を、もう一度流すことは？', ['再放送', '生放送', '初回放送', '特番'], 1],
    ['いつもの番組の代わりに放送される特別番組の略は？', ['特番', '帯番組', '再放送', '生放送'], 1],
    ['本番の前に行う、通しの練習を何という？', ['リハーサル', 'アフレコ', 'テイク', 'ロケ'], 1],
    ['日本でテレビ放送が始まったのは何年？', ['1953年', '1945年', '1964年', '1970年'], 2],
    ['NHK放送センターがある東京の区は？', ['渋谷区', '港区', '千代田区', '新宿区'], 2],
    ['画面に表示される文字を、業界で何という？', ['テロップ', 'カンペ', 'ワイプ', 'キュー'], 2],
    ['画面の隅に、出演者の顔などを映す小窓は？', ['ワイプ', 'テロップ', 'カンペ', 'フリップ'], 2],
    ['出演者に「始めて」と合図することを「○○を出す」という。○○は？', ['キュー', 'カット', 'テイク', 'ロケ'], 2],
    ['平日の毎日、同じ時間に放送される番組は？', ['帯番組', '特番', '単発番組', '深夜番組'], 2],
    ['テレビの「ゴールデンタイム」は一般に何時から何時？', ['19時〜22時', '6時〜9時', '12時〜15時', '23時〜2時'], 2],
    ['多くの地域でアナログ放送が終わり、地デジに移ったのは？', ['2011年', '2001年', '2005年', '2016年'], 2],
    ['天気予報の解説などで活やくする国家資格は？', ['気象予報士', '気象鑑定士', '天気診断士', '空模様検定'], 2],
    ['衛星放送の「BS」を日本語にすると？', ['放送衛星', '通信衛星', '地上放送', '有線放送'], 3],
    ['出演者が手に持って視聴者に見せる、説明用のボードは？', ['フリップ', 'カンペ', 'テロップ', 'ワイプ'], 3],
  ],
  movie: [
    ['撮影を止めるとき、監督がかける声は？', ['「カット！」', '「アクション！」', '「スタート！」', '「本番！」'], 1],
    ['シーン番号などを書いて、撮影の始めに鳴らす板は？', ['カチンコ', 'ハリセン', '拍子木', 'メガホン'], 1],
    ['外国映画のセリフを、日本語の声で演じ直すことは？', ['吹き替え', '字幕', '予告編', '試写'], 1],
    ['公開前に流れる、映画の内容を紹介する短い映像は？', ['予告編', '本編', '続編', '番外編'], 1],
    ['映画の最後に流れる、スタッフなどの名前の字幕は？', ['エンドロール', 'オープニング', 'プロローグ', 'ダイジェスト'], 1],
    ['危険なアクションを、俳優の代わりに演じる人は？', ['スタントマン', 'エキストラ', 'プロンプター', 'マネージャー'], 1],
    ['通行人などとして、大勢で出演する人のことは？', ['エキストラ', 'スタントマン', '主演', '助演'], 1],
    ['映画やドラマで、主人公を演じることは？', ['主演', '助演', '共演', '客演'], 1],
    ['スタジオの外の、実際の場所で撮影することは？', ['ロケ', 'セット', '編集', '試写'], 1],
    ['撮った映像をつなぎ合わせて作品にする作業は？', ['編集', '脚本', '照明', '録音'], 1],
    ['怪獣映画などでおなじみ「特殊撮影」の略は？', ['特撮', '特影', '特映', '殊撮'], 1],
    ['公開前の映画を関係者などに見せる上映会は？', ['試写会', '打ち上げ', '撮影会', '記者会見'], 2],
    ['スタジオの中に作る、撮影用の街や部屋は？', ['セット', 'ロケ', 'テイク', 'ラッシュ'], 2],
    ['映画のフィルムの1枚1枚の絵を何という？', ['コマ', 'カット', 'シーン', 'テイク'], 2],
    ['時代劇で、刀を使った立ち回りの演技は？', ['殺陣（たて）', '見得（みえ）', '早替わり', '宙乗り'], 2],
    ['セリフの音声が入っていない、昔の映画は？', ['無声映画', '立体映画', '短編映画', '記録映画'], 2],
    ['映像に合わせて、あとから声を録音することは？', ['アフレコ', 'ロケ', 'リハーサル', 'テイク'], 2],
    ['映像がだんだん暗くなって消えていく演出は？', ['フェードアウト', 'フェードイン', 'ズームイン', 'カットイン'], 2],
    ['映画のセリフや場面の流れを文章で書いたものは？', ['脚本', '絵コンテ', '予告編', 'パンフレット'], 2],
    ['同じ場面を何度か撮るとき、その1回1回の撮影は？', ['テイク', 'カット', 'シーン', 'ロケ'], 3],
    ['カメラの向きを左右にふって撮ることを何という？', ['パン', 'ティルト', 'ズーム', 'ドリー'], 3],
  ],
  music: [
    ['音楽記号「f（フォルテ）」の意味は？', ['強く', '弱く', '速く', 'ゆっくり'], 1],
    ['音楽記号「p（ピアノ）」の意味は？', ['弱く', '強く', '速く', 'なめらかに'], 1],
    ['「♯（シャープ）」の意味は？', ['半音上げる', '半音下げる', '元に戻す', '音をのばす'], 1],
    ['バイオリンの弦は何本？', ['4本', '3本', '5本', '6本'], 1],
    ['一般的なギターの弦は何本？', ['6本', '4本', '5本', '8本'], 1],
    ['三味線の弦は何本？', ['3本', '2本', '4本', '13本'], 1],
    ['次のうち、打楽器はどれ？', ['ティンパニ', 'フルート', 'チェロ', 'トランペット'], 1],
    ['合唱で、女声のいちばん高いパートは？', ['ソプラノ', 'アルト', 'テノール', 'バス'], 1],
    ['「mf（メゾフォルテ）」の意味は？', ['やや強く', 'とても強く', 'やや弱く', 'とても弱く'], 2],
    ['「クレッシェンド」の意味は？', ['だんだん強く', 'だんだん弱く', 'だんだん速く', 'だんだん遅く'], 2],
    ['「アレグロ」はどんな速さ？', ['速く', 'ゆっくり', '自由な速さ', 'だんだん遅く'], 2],
    ['ドレミの「ソ」は、英語の音名で何？', ['G', 'C', 'F', 'A'], 2],
    ['楽譜で、音の高さを表す5本の線は？', ['五線', '加線', '小節線', '終止線'], 2],
    ['4分の4拍子で、1小節に入る4分音符の数は？', ['4つ', '2つ', '3つ', '8つ'], 2],
    ['一般的なピアノの鍵盤の数は？', ['88鍵', '61鍵', '76鍵', '100鍵'], 2],
    ['次のうち、木管楽器はどれ？', ['クラリネット', 'トランペット', 'トロンボーン', 'チューバ'], 2],
    ['指揮者が手に持つ細い棒を何という？', ['タクト', 'マレット', 'ピック', 'スティック'], 2],
    ['「リタルダンド（rit.）」の意味は？', ['だんだん遅く', 'だんだん速く', 'だんだん強く', 'だんだん弱く'], 3],
    ['「アンダンテ」はどんな速さ？', ['歩くような速さ', 'とても速く', 'とても遅く', '自由な速さ'], 3],
    ['「♮（ナチュラル）」の意味は？', ['元の高さに戻す', '半音上げる', '半音下げる', '音を短く切る'], 3],
    ['ドレミの「ド」は、日本の音名で何？', ['ハ', 'イ', 'ニ', 'ト'], 3],
    ['ト音記号の別の呼び名は？', ['高音部記号', '低音部記号', '中音部記号', '反復記号'], 3],
    ['箏（こと）の弦は、一般的に何本？', ['13本', '3本', '7本', '25本'], 3],
    ['ピアノはどうやって音を出す？', ['ハンマーで弦を打つ', '指で弦をはじく', '弓で弦をこする', '息を吹きこむ'], 3],
  ],
};

const CAT_NAMES = { general: '一般常識', japan: '日本の地理・名産', osaka: '大阪・関西', tv: 'テレビ・放送', movie: '映画', music: '音楽' };
for (const [k, v] of Object.entries(BANK2_CATS)) CAT_NAMES[k] = v.label;
// Facts that are true only from / until a year: [from, to] (the question is not asked outside them).
//   大阪府 was the smallest prefecture until 1988 (関空の埋め立て); 大阪市中央区 since 1989-02 (東区 + 南区);
//   気象予報士 since 1993 (first exam 1994-08); しまなみ海道 1999-05; 地デジ switch 2011-07 (東北3県 2012-03);
//   大阪・関西万博 2025 at 夢洲.
const ERA = {
  '日本でいちばん面積が小さい都道府県は？': [1990, 9999],
  '大阪城があるのは大阪市の何区？': [1990, 9999],
  '天気予報の解説などで活やくする国家資格は？': [1995, 9999],
  '「しまなみ海道」が結ぶのは広島県と何県？': [2000, 9999],
  '多くの地域でアナログ放送が終わり、地デジに移ったのは？': [2012, 9999],
  '2025年の大阪・関西万博の会場になった島は？': [2025, 9999],
};
// questions that are true before those years (same layout as BANK, with [from, to] last)
BANK.japan.push(['日本でいちばん面積が小さい都道府県は？', ['大阪府', '香川県', '東京都', '沖縄県'], 2, [0, 1987]]);
BANK.osaka.push(['大阪城があるのは大阪市の何区？', ['東区', '北区', '浪速区', '天王寺区'], 3, [0, 1988]]);
const yearOk = (q, tag, year) => {
  const t = tag || ERA[q];
  return !t || year == null || (t[0] <= year && year <= t[1]);
};
// the 雑学 record's category for a question of this bank
const REC_CAT = { general: 'joshiki', japan: 'chiri', osaka: 'chiri', tv: 'geino', movie: 'geino', music: 'geino' };

// Questions asked recently (this session) are avoided so replays feel fresh.
const RECENT = [];

// ------------------------------------------------------------------ look & sound
const LABELS = ['ア', 'イ', 'ウ', 'エ'];
const LABEL_COLORS = ['#e8434f', '#3a7be0', '#2fae5a', '#e0a81c'];
const HOST_LOOK = { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#c8303c', bottom: '#1e1e26', jacket: true, tie: '#ffd23f' };
const CONFETTI = ['#ff5d6c', '#ffd23f', '#5ee07a', '#5fd7ff', '#ff7eb6', '#ffffff'];
const WALL = Array.from({ length: 38 }, (_, i) => mix('#0e0726', '#3a2280', i / 37));

// layout
const INTRO = 40; // frames: question number + question typing
const JUDGE = 22; // frames of suspense after locking an answer
const REVEAL_MIN = 36; // A can skip the reveal after this
const REVEAL_MAX = 75; // auto-advance
const REVEAL_TIMEUP = 60; // auto-advance after a time-out (nothing to celebrate, keep it moving)
const Q_PANEL = { x: 4, y: 107, w: 312, h: 46 };
const CELL_W = 154, CELL_H = 39;
const cellRect = (i) => ({ x: 4 + (i % 2) * 158, y: 156 + (i >> 1) * 42, w: CELL_W, h: CELL_H });
const MARK_C = { x: 160, y: 54 };

registerSong('quiz_show', {
  bpm: 132, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.028, notes: 'C5 . E5 G5 C6 . G5 E5 | F5 . A5 C6 F5 . C6 A5 | D5 . F5 A5 D6 . A5 F5 | G5 . B5 D6 G5 . F5 D5 | C5 . E5 G5 C6 . G5 E5 | A4 . C5 E5 A5 . E5 C5 | F5 . A5 C6 D5 . F5 A5 | G5 - - . G4 . B4 D5' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . C3 . C4 . C3 . | F2 . F2 . F3 . F2 . | D3 . D3 . D4 . D3 . | G2 . G2 . G3 . B2 . | C3 . C3 . C4 . C3 . | A2 . A2 . A3 . A2 . | F2 . F2 . D3 . D3 . | G2 . G2 . G3 . G2 .' },
    { wave: 'drum', vol: 0.07, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});

function tones(seq) {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime + 0.01;
  for (const [f, s, d, wave = 'square', vol = 0.07] of seq) audio.tone(f, t0 + s, d, { wave, vol });
}
const SND = {
  jingle: [[784, 0, 0.07], [1047, 0.08, 0.07], [1319, 0.16, 0.18, 'square', 0.06], [523, 0.16, 0.18, 'triangle', 0.1]],
  buzzer: [[1760, 0, 0.05, 'square', 0.06], [2349, 0.05, 0.12, 'square', 0.06]],
  pinpon: [[1319, 0, 0.17, 'square', 0.08], [1047, 0.19, 0.42, 'square', 0.08], [659, 0, 0.17, 'triangle', 0.1], [523, 0.19, 0.42, 'triangle', 0.1]],
  bubuu: [[150, 0, 0.16, 'sawtooth', 0.07], [150, 0.22, 0.45, 'sawtooth', 0.07], [75, 0, 0.16, 'square', 0.05], [75, 0.22, 0.45, 'square', 0.05]],
  tick: [[1200, 0, 0.03, 'square', 0.04]],
  tick2: [[1600, 0, 0.05, 'square', 0.05]],
};

// Big pixel ○ / × used for the verdict (built once).
let MARKS = null;
function marks() {
  if (MARKS) return MARKS;
  const S = 40, c = S / 2;
  const [oc, ox] = makeCanvas(S, S);
  const [xc, xx] = makeCanvas(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const d = Math.hypot(dx, dy);
      if (d >= 10.5 && d <= 19.5) { ox.fillStyle = d >= 12 && d <= 18 ? '#ff4d5e' : '#ffffff'; ox.fillRect(x, y, 1, 1); }
      const lim = Math.max(Math.abs(dx), Math.abs(dy));
      const a = Math.abs(dx - dy), b = Math.abs(dx + dy);
      if (lim <= 17 && Math.min(a, b) <= 6) { xx.fillStyle = lim <= 15.5 && Math.min(a, b) <= 4.2 ? '#3a7be0' : '#ffffff'; xx.fillRect(x, y, 1, 1); }
    }
  }
  MARKS = { ok: oc, ng: xc, size: S };
  return MARKS;
}

// One line of text cut with "…" so it is at most maxW wide.
function fitLine(ctx, s, maxW, size) {
  if (measure(ctx, s, size) <= maxW) return s;
  const ch = Array.from(s);
  while (ch.length > 1 && measure(ctx, ch.join('') + '…', size) > maxW) ch.pop();
  return ch.join('') + '…';
}

// ------------------------------------------------------------------ question helpers
function makeItem(q, choices, answer, cat, rng, doShuffle = true) {
  const order = doShuffle ? shuffle(choices.map((_, i) => i), rng) : choices.map((_, i) => i);
  return { q: String(q), choices: order.map((i) => String(choices[i])), answer: order.indexOf(answer), cat };
}

function normalizeCustom(o) {
  if (!o || typeof o.q !== 'string' || !Array.isArray(o.choices)) return null;
  const ch = o.choices.slice(0, 4).map((c) => String(c));
  if (ch.length < 2) return null;
  const a = typeof o.answer === 'string' ? ch.indexOf(o.answer) : Math.round(o.answer ?? 0);
  if (!(a >= 0 && a < ch.length)) return null;
  return { q: o.q, ch, a };
}

function pickFromBank(cats, count, difficulty, rng, year = null) {
  const target = 1 + (difficulty - 1) / 2; // d1 -> easy questions, d5 -> hard ones
  const pool = [];
  const own = cats.filter((c) => BANK[c]);
  const ext = cats.filter((c) => !BANK[c] && BANK2_CATS[c]);
  for (const cat of own) {
    for (const [q, ch, lv, tag] of BANK[cat]) {
      if (!yearOk(q, tag, year)) continue;
      pool.push({ q, ch, lv, cat, k: (RECENT.includes(q) ? 4 : 0) + Math.abs(lv - target) + rng() * 1.6 });
    }
  }
  // the 雑学 bank (quiz_bank.js): already era-checked by year
  if (ext.length) {
    for (const x of bankPick({ cats: ext, n: Math.max(count * 2, 8), year, lv: Math.round(target), rng })) {
      if (!qOk(x, year)) continue;
      pool.push({ q: x.q, ch: [x.a, ...x.w], lv: x.lv, cat: x.cat, src: x, k: (RECENT.includes(x.q) ? 4 : 0) + Math.abs(x.lv - target) + rng() * 1.6 });
    }
  }
  const chosen = [];
  const perCat = {};
  while (chosen.length < count && pool.length) {
    let best = 0, bestK = Infinity;
    pool.forEach((it, i) => {
      const k = it.k + (perCat[it.cat] || 0) * 0.9; // spread 'mix' over the categories
      if (k < bestK) { bestK = k; best = i; }
    });
    const [it] = pool.splice(best, 1);
    perCat[it.cat] = (perCat[it.cat] || 0) + 1;
    chosen.push(it);
  }
  chosen.sort((a, b) => a.lv - b.lv); // the show gets harder toward the end
  for (const it of chosen) RECENT.push(it.q);
  while (RECENT.length > 80) RECENT.shift();
  return chosen.map((it) => { const m = makeItem(it.q, it.ch, 0, it.cat, rng); m.src = it.src || { id: 'quiz:' + it.q, cat: REC_CAT[it.cat] || it.cat, q: it.q, a: it.ch[0], lv: it.lv }; return m; });
}

// ------------------------------------------------------------------ the minigame
class Quiz extends Minigame {
  static title = '4択クイズ';
  static howto = ['4つの答えから正解を選ぼう！', '十字キーで選んで Aで答える', 'Bでヒント（2択にしぼる）', '早く正解するほど高得点！'];
  static skill = 'talk';
  static bgm = 'quiz_show';

  constructor(g, opts = {}) {
    super(g, opts);
    this.quizTap = true;
    this.tapAt = null;
    this.showId = opts.showId || showOf(opts.show);
    // 雑学・知識 (quiz_app.js): easier and a few more points
    let kb = null;
    try { if (typeof g.quizBonus === 'function') kb = g.quizBonus(this.showId); } catch (e) { console.error(e); }
    this.knowPts = kb ? Math.max(0, Math.round(kb.pts || 0)) : 0;
    if (kb && kb.v > 0.005) {
      this.bonus += kb.v;
      this.bonusInfo = { skill: (this.bonusInfo && this.bonusInfo.skill) || 0, parts: [...((this.bonusInfo && this.bonusInfo.parts) || []), { label: '雑学', v: kb.v }] };
    }
    bindTap(g);
  }

  end(score, comment) {
    if (this.phase === 'result') return;
    const b = this.knowPts || 0;
    if (!b) { super.end(score, comment); return; }
    const lines = String(comment || '').split('\n');
    lines[0] = `${lines[0]}（雑学+${b}点）`;
    super.end(Math.min(100, Math.round(score) + b), lines.join('\n'));
  }

  init() {
    const d = this.difficulty;
    this.items = this.buildQuestions();
    this.n = this.items.length;
    // Seconds to answer. Kept so that even a player who never answers finishes a d3 show
    // (8 questions) in about 60-70 s, also with a maxed talk skill.
    const base = [9.5, 8, 6.2, 5.4, 4.8][d - 1];
    const sec = this.opts.time > 0 ? +this.opts.time : this.ease(base, 0.1);
    this.limit = Math.max(60, Math.round(sec * 60));
    this.hints = Math.max(0, Math.floor(this.opts.hints ?? ((d <= 2 ? 2 : d <= 4 ? 1 : 0) + (this.bonus >= 0.5 ? 1 : 0)))) || 0;
    this.hintsMax = this.hints;
    this.score = 0;
    this.shown = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.timeouts = 0;
    this.marks = [];
    this.parts = [];
    this.shakeT = 0;
    this.flashT = 0;
    this.bubble = null;
    this.noHintAt = -999;
    this.hostSheet = charSheet(HOST_LOOK);
    this.meSheet = charSheet((this.g.state && this.g.state.look) || LOOKS.player);
    this.myName = Array.from(String((this.g.state && this.g.state.name) || 'あなた')).slice(0, 5).join('');
    this.startQuestion(0);
  }

  buildQuestions() {
    const o = this.opts;
    let year = Number.isFinite(o.year) ? o.year : null;
    if (year == null) { try { year = gameYM(this.g).y; } catch (e) { year = null; } }
    this.year = year;
    const custom = Array.isArray(o.questions) ? o.questions.map(normalizeCustom).filter(Boolean) : [];
    let want = Array.isArray(o.category) ? o.category : [o.category];
    if (want.includes('all')) want = [...Object.keys(BANK), ...BANK2_IDS];
    const cats = want.filter((k) => BANK[k] || BANK2_CATS[k]);
    const useCats = cats.length ? cats : Object.keys(BANK);
    if (custom.length) {
      let count = clamp(Math.round(o.count ?? custom.length), 1, 15);
      let list = custom;
      if (list.length > count) {
        const keep = new Set(shuffle(list.map((_, i) => i), this.rng).slice(0, count));
        list = list.filter((_, i) => keep.has(i));
      }
      const items = list.map((c) => makeItem(c.q, c.ch, c.a, null, this.rng, o.shuffle !== false));
      if (items.length < count && cats.length) items.push(...pickFromBank(cats, count - items.length, this.difficulty, this.rng, year));
      return items;
    }
    const count = clamp(Math.round(o.count ?? 5 + this.difficulty), 1, 15);
    return pickFromBank(useCats, count, this.difficulty, this.rng, year);
  }

  startQuestion(i) {
    this.qi = i;
    this.cur = this.items[i];
    this.sub = 'intro';
    this.st = 0;
    this.sel = 0;
    this.elim = new Set();
    this.hinted = false;
    this.left = this.limit;
    this.lockLeft = this.limit;
    this.picked = -1;
    this.verdict = null;
    this.qLayout = null;
    this.cLayout = [];
    this.say(i === this.n - 1 && this.n > 1 ? '最終問題！' : `第${i + 1}問！`, 60);
  }

  say(str, frames = 60) { this.bubble = { str, t: frames }; }

  // ---------------------------------------------------------------- update
  updatePlay(inp) {
    this.st++;
    if (this.bubble && --this.bubble.t <= 0) this.bubble = null;
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
    this.shown += (this.score - this.shown) * 0.15;
    if (Math.abs(this.score - this.shown) < 0.5) this.shown = this.score;
    this.updateParts();

    switch (this.sub) {
      case 'intro':
        if (this.st === 1) tones(SND.jingle);
        if (this.st >= INTRO) { this.sub = 'answer'; this.st = 0; }
        break;
      case 'answer':
        this.updateAnswer(inp);
        break;
      case 'judge':
        if (this.st % 5 === 1) audio.sfx('snare');
        if (this.st >= JUDGE) this.resolve();
        break;
      case 'reveal':
        if ((this.st >= REVEAL_MIN && inp.pressed('a')) || this.st >= (this.verdict === 'time' ? REVEAL_TIMEUP : REVEAL_MAX)) this.next();
        break;
      case 'outro':
        if (this.st >= 60) this.finish();
        break;
    }
  }

  updateAnswer(inp) {
    const tap = this.tapAt;
    this.tapAt = null;
    let tapA = false;
    if (tap) {
      // a tap on an answer answers it; a tap elsewhere does nothing (the hint stays on B)
      const i = [0, 1, 2, 3].findIndex((k) => k < this.cur.choices.length && (() => { const c = cellRect(k); return tap.x >= c.x && tap.x < c.x + c.w && tap.y >= c.y && tap.y < c.y + c.h; })());
      if (i >= 0 && !this.elim.has(i)) { this.sel = i; tapA = true; }
    } else for (const d of ['up', 'down', 'left', 'right']) if (inp.pressed(d)) this.move(d);
    if (inp.pressed('b')) this.useHint();
    if (tapA || (!tap && inp.pressed('a'))) {
      if (this.elim.has(this.sel)) {
        audio.sfx('cancel');
      } else {
        this.picked = this.sel;
        this.lockLeft = this.left;
        this.sub = 'judge';
        this.st = 0;
        audio.sfx('ok');
        tones(SND.buzzer);
        this.say('その答えは…', 40);
        return;
      }
    }
    this.left--;
    if (this.left > 0 && this.left <= 180 && this.left % 60 === 0) tones(this.left <= 60 ? SND.tick2 : SND.tick);
    if (this.left <= 0) {
      this.left = 0;
      this.lockLeft = 0;
      this.sub = 'reveal';
      this.st = 0;
      this.verdict = 'time';
      this.marks[this.qi] = 'time';
      this.combo = 0;
      this.timeouts++;
      try { if (this.cur.src && typeof this.g.quizRecord === 'function') this.g.quizRecord(this.cur.src, false, { practice: !!this.opts.practice, show: this.showId }); } catch (e) { console.error(e); }
      this.shakeT = 10;
      tones(SND.bubuu);
      this.say('時間切れ！', 70);
    }
  }

  move(d) {
    const nC = this.cur.choices.length;
    let col = this.sel % 2, row = this.sel >> 1;
    if (d === 'left' || d === 'right') col = 1 - col; else row = 1 - row;
    let t = row * 2 + col;
    if (t >= nC) {
      if (nC <= 2 && (d === 'up' || d === 'down')) return;
      t = nC - 1;
    }
    if (this.elim.has(t)) {
      const rest = this.cur.choices.map((_, i) => i).filter((i) => !this.elim.has(i) && i !== this.sel);
      if (!rest.length) return;
      t = rest[0];
    }
    if (t === this.sel) return;
    this.sel = t;
    audio.sfx('cursor');
  }

  useHint() {
    const nC = this.cur.choices.length;
    if (this.hinted || this.hints <= 0 || nC <= 2) {
      audio.sfx('cancel');
      if (!this.hinted && this.pt - this.noHintAt > 45) {
        this.noHintAt = this.pt;
        // on the stage (where the ○/× appears later), not over the question text
        this.popup(nC <= 2 ? 'もう2択だよ！' : this.hintsMax > 0 ? 'ヒントはもうない！' : 'ヒントなしの回だ！', 160, 58, COLORS.cyan, 10);
      }
      return;
    }
    const wrong = shuffle(this.cur.choices.map((_, i) => i).filter((i) => i !== this.cur.answer), this.rng);
    wrong.slice(0, nC - 2).forEach((i) => this.elim.add(i));
    this.hints--;
    this.hinted = true;
    if (this.elim.has(this.sel)) this.sel = this.cur.choices.findIndex((_, i) => !this.elim.has(i));
    audio.sfx('good');
    this.say('ヒント！2択だ！', 60);
  }

  resolve() {
    const ok = this.picked === this.cur.answer;
    try { if (this.cur.src && typeof this.g.quizRecord === 'function') this.g.quizRecord(this.cur.src, ok, { practice: !!this.opts.practice, show: this.showId }); } catch (e) { console.error(e); }
    this.sub = 'reveal';
    this.st = 0;
    const c = cellRect(this.picked);
    if (ok) {
      const per = 100 / this.n;
      const speed = clamp(this.lockLeft / this.limit / 0.4, 0, 1);
      let pts = per * (0.85 + 0.15 * speed);
      if (this.hinted) pts *= 0.6;
      this.score = Math.min(100, this.score + pts);
      this.correct++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.verdict = 'ok';
      this.marks[this.qi] = 'ok';
      this.flashT = 8;
      tones(SND.pinpon);
      this.confetti();
      this.popup(`+${Math.max(1, Math.round(pts))}`, c.x + c.w / 2, c.y - 6, COLORS.accent, 12);
      if (this.combo >= 3) {
        audio.sfx('applause');
        this.say(`${this.combo}連続正解！`, 70);
      } else {
        this.say(speed >= 1 && !this.hinted ? '正解！はやい！' : '正解！', 70);
      }
    } else {
      this.verdict = 'ng';
      this.marks[this.qi] = 'ng';
      this.combo = 0;
      this.shakeT = 12;
      tones(SND.bubuu);
      this.say('ざんねん！', 70);
    }
  }

  next() {
    if (this.qi + 1 < this.n) {
      this.startQuestion(this.qi + 1);
      return;
    }
    this.sub = 'outro';
    this.st = 0;
    this.say('おつかれさま！', 90);
    if (this.correct / this.n >= 0.5) audio.sfx('applause');
  }

  finish() {
    const n = this.n, c = this.correct, r = c / n;
    let line;
    if (c === n) line = n >= 5 ? 'クイズ王の誕生だ！' : '全問正解、おみごと！';
    else if (r >= 0.75) line = '物知りっぷりが光った！';
    else if (r >= 0.5) line = 'なかなかの健闘ぶり！';
    else if (this.timeouts * 2 >= n) line = '答えるスピードも大事！';
    else if (r >= 0.25) line = 'もう少し勉強しよう…';
    else line = 'ド忘れ連発だった…';
    this.end(Math.round(this.score), `${n}問中${c}問正解！\n${line}`);
  }

  confetti() {
    for (let i = 0; i < 44; i++) {
      const left = i % 2 === 0;
      this.parts.push({
        x: left ? 8 : 312,
        y: 92,
        vx: (left ? 1 : -1) * (0.8 + this.rng() * 2.6),
        vy: -(2.2 + this.rng() * 2.6),
        c: CONFETTI[i % CONFETTI.length],
        life: 70 + Math.floor(this.rng() * 40),
      });
    }
  }

  updateParts() {
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy = Math.min(p.vy + 0.07, 1.4);
      p.vx *= 0.985;
      p.life--;
    }
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < 250);
  }

  // ---------------------------------------------------------------- draw
  drawPlay(ctx) {
    if (!this.items) { this.drawBackground(ctx); return; }
    ctx.save();
    if (this.shakeT > 0) ctx.translate(Math.round((Math.random() * 2 - 1) * 2), Math.round((Math.random() * 2 - 1) * 1));
    this.drawStage(ctx);
    this.drawHud(ctx);
    this.drawTimer(ctx);
    this.drawQuestion(ctx);
    this.drawChoices(ctx);
    this.drawVerdict(ctx);
    for (const [i, p] of this.parts.entries()) {
      const flip = (p.life + i) % 8 < 4;
      rect(ctx, p.x, p.y, flip ? 3 : 2, flip ? 2 : 3, p.c);
    }
    if (this.sub === 'outro') this.drawOutro(ctx);
    ctx.restore();
  }

  drawBig(ctx, sheet, dir, x, y) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(2, 2);
    drawChar(ctx, sheet, dir, 0, 0, 4);
    ctx.restore();
  }

  drawStage(ctx) {
    const t = this.t;
    // back wall
    for (let i = 0; i < WALL.length; i++) rect(ctx, 0, i * 2, W, 2, WALL[i]);
    // backdrop panels with a soft diamond pattern
    for (let x = 0; x < W; x += 20) {
      for (let y = 6 + ((x / 20) % 2) * 10; y < 74; y += 20) rect(ctx, x + 9, y, 2, 2, '#4a2f9a');
    }
    // LED pillars
    for (const [px, dirn] of [[64, 1], [240, -1]]) {
      rect(ctx, px, 0, 16, 76, '#1a1040');
      rect(ctx, px, 0, 1, 76, '#3a2a70');
      rect(ctx, px + 15, 0, 1, 76, '#0c0820');
      for (let k = 0; k < 9; k++) {
        const on = (((k * dirn + Math.floor(t / 7)) % 4) + 4) % 4 === 0;
        rect(ctx, px + 5, 4 + k * 8, 6, 4, on ? '#ff7eb6' : '#4a2f8a');
        if (on) rect(ctx, px + 6, 5 + k * 8, 2, 1, '#ffd0e6');
      }
    }
    // spotlights
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#fff6c0';
    for (const [sx, ph] of [[34, 0], [286, 2]]) {
      const sway = Math.sin(t / 50 + ph) * 18;
      ctx.beginPath();
      ctx.moveTo(sx - 3, 0);
      ctx.lineTo(sx + 3, 0);
      ctx.lineTo(sx + sway + 26, 96);
      ctx.lineTo(sx + sway - 26, 96);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // neon edge between wall and floor
    rect(ctx, 0, 74, W, 2, '#ff7eb6');
    rect(ctx, 0, 73, W, 1, '#8a3a7a');
    // floor
    rect(ctx, 0, 76, W, 20, '#1d1446');
    rect(ctx, 0, 81, W, 1, '#271c58');
    rect(ctx, 0, 88, W, 1, '#271c58');

    this.drawSign(ctx);
    this.drawHost(ctx);
    this.drawContestant(ctx);
    this.drawLamps(ctx);
    this.drawGuide(ctx);
    this.drawBubble(ctx);
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = (this.flashT / 8) * 0.35;
      rect(ctx, 0, 0, W, 96, '#ffffff');
      ctx.restore();
    }
  }

  drawSign(ctx) {
    const t = this.t;
    const x = 86, y = 1, w = 148, h = 34;
    rect(ctx, x + 2, y + 2, w, h, '#0a0618');
    rect(ctx, x, y, w, h, '#ffd23f');
    rect(ctx, x + 4, y + 4, w - 8, h - 8, '#1a1040');
    rect(ctx, x + 4, y + 4, w - 8, 1, '#2c1e66');
    // chasing bulbs
    let k = 0;
    const bulb = (bx, by) => {
      const on = (k + Math.floor(t / 5)) % 3 === 0;
      rect(ctx, bx, by, 2, 2, on ? '#ffffff' : '#a8701a');
      k++;
    };
    for (let bx = x + 3; bx <= x + w - 5; bx += 6) bulb(bx, y + 1);
    for (let by = y + 7; by <= y + h - 5; by += 6) bulb(x + w - 3, by);
    for (let bx = x + w - 5; bx >= x + 3; bx -= 6) bulb(bx, y + h - 3);
    for (let by = y + h - 5; by >= y + 7; by -= 6) bulb(x + 1, by);
    // show title: 12px with the bobbing ? marks when there is room, otherwise without them,
    // then 10px, and as a last resort cut with "…" so a long opts.show never leaves the sign.
    const show = String(this.opts.show || 'クイズ！ドット王');
    const inner = w - 14;
    let ts = 12, title = show, marksOn = measure(ctx, show, 12) <= w - 40;
    if (!marksOn && measure(ctx, show, 12) > inner) {
      ts = 10;
      title = fitLine(ctx, show, inner, 10);
    }
    text(ctx, title, 160, y + 6 + (ts === 10 ? 1 : 0), { size: ts, align: 'center', color: COLORS.accent, outline: '#5a1a00' });
    const genre = this.cur && this.cur.cat ? CAT_NAMES[this.cur.cat] : String(this.opts.genre || 'スペシャル');
    let label = `ジャンル：${genre}`;
    if (measure(ctx, label, 10) > inner) label = fitLine(ctx, genre, inner, 10);
    text(ctx, label, 160, y + 20, { size: 10, align: 'center', color: COLORS.cyan, shadow: null });
    // little ? marks on both sides of the title
    if (marksOn) {
      const bob = Math.floor(t / 15) % 2;
      text(ctx, '？', x + 7, y + 8 + bob, { size: 10, color: COLORS.pink, shadow: null });
      text(ctx, '？', x + w - 17, y + 9 - bob, { size: 10, color: COLORS.pink, shadow: null });
    }
  }

  drawHost(ctx) {
    const talking = this.bubble && Math.floor(this.t / 8) % 2 === 0;
    this.drawBig(ctx, this.hostSheet, 'right', 14, 32 + (talking ? 1 : 0));
    // mic stand on the desk
    rect(ctx, 52, 50, 1, 12, '#9aa3c7');
    rect(ctx, 50, 47, 4, 4, '#2a2d36');
    rect(ctx, 51, 48, 1, 1, '#6a6f80');
    // host desk
    const x = 4, y = 62, w = 56, h = 32;
    rect(ctx, x + 2, y + 2, w, h, '#0a0618');
    rect(ctx, x, y, w, 4, '#f2d36b');
    rect(ctx, x, y + 3, w, 1, '#b8902a');
    rect(ctx, x, y + 4, w, h - 4, '#b8243f');
    rect(ctx, x + 2, y + 6, w - 4, 1, '#e0566e');
    rect(ctx, x, y + h - 3, w, 3, '#6a1020');
    // emblem
    rect(ctx, 25, 70, 14, 14, '#ffffff');
    rect(ctx, 24, 71, 16, 12, '#ffffff');
    rect(ctx, 26, 71, 12, 12, '#ffd23f');
    rect(ctx, 25, 72, 14, 10, '#ffd23f');
    text(ctx, 'Q', 32, 71, { size: 12, align: 'center', color: '#b8243f', shadow: null });
  }

  drawContestant(ctx) {
    const st = this.st;
    let px = 270, py = 32, dir = 'left';
    if (this.sub === 'reveal' && this.verdict === 'ok') {
      dir = 'down';
      py -= Math.round(Math.abs(Math.sin(st / 5)) * 6 * Math.max(0, 1 - st / 60));
    } else if (this.sub === 'reveal' && st < 26) {
      dir = 'down';
      px += st % 6 < 3 ? -1 : 1;
    } else if (this.sub === 'outro') {
      dir = 'down';
    } else if (this.sub === 'answer' && Math.floor(this.t / 40) % 2 === 0) {
      py += 1;
    }
    this.drawBig(ctx, this.meSheet, dir, px, py);
    // podium
    const x = 254, y = 62, w = 60, h = 32;
    rect(ctx, x + 2, y + 2, w, h, '#0a0618');
    rect(ctx, x, y, w, 4, '#f2d36b');
    rect(ctx, x, y + 3, w, 1, '#b8902a');
    rect(ctx, x, y + 4, w, h - 4, '#2a5bd8');
    rect(ctx, x + 2, y + 6, w - 4, 1, '#5f8af0');
    rect(ctx, x, y + h - 3, w, 3, '#14306e');
    // name plate
    rect(ctx, x + 4, y + 10, w - 8, 14, '#0b0d1a');
    rect(ctx, x + 4, y + 10, w - 8, 1, '#2a2f55');
    text(ctx, this.myName, x + w / 2, y + 12, { size: 10, align: 'center', color: COLORS.accent, shadow: null });
    // buzzer lamp
    let lamp = '#6a1820', glow = null;
    const blink = Math.floor(this.t / 4) % 2 === 0;
    if (this.sub === 'answer') lamp = '#a8323c';
    if (this.sub === 'judge') { lamp = blink ? '#ffd23f' : '#ff9a3c'; glow = '#ffd23f'; }
    if (this.sub === 'reveal' || this.sub === 'outro') {
      if (this.verdict === 'ok') { lamp = blink ? '#5ee07a' : '#b8ffcb'; glow = '#5ee07a'; } else lamp = '#3a3f5a';
    }
    const cx = x + w / 2;
    if (glow) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      rect(ctx, cx - 7, y - 10, 14, 10, glow);
      rect(ctx, cx - 9, y - 8, 18, 6, glow);
      ctx.restore();
    }
    rect(ctx, cx - 3, y - 6, 6, 1, lamp);
    rect(ctx, cx - 5, y - 5, 10, 1, lamp);
    rect(ctx, cx - 6, y - 4, 12, 4, lamp);
    rect(ctx, cx - 3, y - 5, 2, 1, '#ffffff');
    rect(ctx, cx - 7, y - 1, 14, 1, '#2a2d36');
  }

  drawLamps(ctx) {
    const n = this.n;
    const lw = n > 10 ? 6 : 8, gap = 3;
    const total = n * lw + (n - 1) * gap;
    let x = Math.round(160 - total / 2);
    const blink = Math.floor(this.t / 10) % 2 === 0;
    for (let i = 0; i < n; i++) {
      const m = this.marks[i];
      let c = '#3a3060';
      if (m === 'ok') c = '#5ee07a';
      else if (m) c = '#ff5d6c';
      else if (i === this.qi && this.sub !== 'outro') c = blink ? '#ffd23f' : '#8a6a1a';
      rect(ctx, x, 77, lw, 6, '#0a0618');
      rect(ctx, x + 1, 78, lw - 2, 4, c);
      if (m === 'ok' || (i === this.qi && blink && !m)) rect(ctx, x + 1, 78, 2, 1, '#ffffff');
      x += lw + gap;
    }
  }

  drawGuide(ctx) {
    let g = '', color = '#ffffff';
    if (this.sub === 'intro') { g = 'よく聞いてね…'; color = COLORS.dim; }
    else if (this.sub === 'answer') g = '十字キーで選んで Aで決定';
    else if (this.sub === 'judge') g = 'ドキドキ…';
    else if (this.sub === 'reveal' && this.st >= REVEAL_MIN) {
      if (Math.floor(this.t / 20) % 2 === 0) g = this.qi + 1 < this.n ? 'Aで次の問題へ' : 'Aで結果発表へ';
      color = COLORS.cyan;
    } else if (this.sub === 'reveal' && this.verdict !== 'ok') {
      g = `正解は「${LABELS[this.cur.answer]}」でした`;
      color = COLORS.good;
    }
    if (g) text(ctx, g, 160, 85, { size: 10, align: 'center', color, outline: '#0a0618' });
  }

  drawBubble(ctx) {
    if (!this.bubble) return;
    const s = this.bubble.str;
    const w = Math.ceil(measure(ctx, s, 10)) + 12;
    const x = 54, y = 36, h = 16;
    rect(ctx, x + 1, y, w - 2, h, '#22202a');
    rect(ctx, x, y + 1, w, h - 2, '#22202a');
    rect(ctx, x + 1, y + 1, w - 2, h - 2, '#ffffff');
    // tail toward the host
    rect(ctx, x - 3, y + 9, 4, 1, '#22202a');
    rect(ctx, x - 3, y + 10, 4, 1, '#22202a');
    rect(ctx, x - 2, y + 9, 3, 1, '#ffffff');
    text(ctx, s, x + 6, y + 3, { size: 10, color: '#22202a', shadow: null });
  }

  drawHud(ctx) {
    panel(ctx, 2, 2, 80, 29);
    text(ctx, `第${this.qi + 1}問／${this.n}`, 8, 6, { size: 10 });
    if (this.hints > 0) text(ctx, `B:ヒント×${this.hints}`, 8, 17, { size: 10, color: COLORS.cyan });
    else text(ctx, 'ヒントなし', 8, 17, { size: 10, color: COLORS.dim });
    panel(ctx, 238, 2, 80, 29);
    text(ctx, `スコア ${Math.round(this.shown)}`, 244, 6, { size: 10, color: COLORS.accent });
    if (this.combo >= 2) text(ctx, `${this.combo}連続正解！`, 244, 17, { size: 10, color: COLORS.pink });
    else text(ctx, `正解 ${this.correct}`, 244, 17, { size: 10, color: COLORS.dim });
  }

  drawTimer(ctx) {
    rect(ctx, 0, 96, W, 144, '#0e1230');
    let frac = 1;
    if (this.sub === 'answer') frac = this.left / this.limit;
    else if (this.sub !== 'intro') frac = this.lockLeft / this.limit;
    // clock icon
    rect(ctx, 5, 97, 6, 1, '#ffffff');
    rect(ctx, 4, 98, 8, 6, '#ffffff');
    rect(ctx, 5, 104, 6, 1, '#ffffff');
    rect(ctx, 5, 98, 6, 6, '#2a2f55');
    rect(ctx, 7, 99, 1, 3, '#ffffff');
    rect(ctx, 8, 101, 2, 1, '#ffffff');
    // bar
    const bx = 16, bw = 280;
    rect(ctx, bx, 97, bw, 8, '#000000');
    rect(ctx, bx + 1, 98, bw - 2, 6, '#262c5a');
    let col = frac > 0.5 ? '#5ee07a' : frac > 0.25 ? '#ffd23f' : '#ff5d6c';
    if (this.sub === 'answer' && frac <= 0.25 && Math.floor(this.t / 6) % 2 === 0) col = '#ffb0b8';
    const fw = Math.round((bw - 2) * clamp(frac, 0, 1));
    if (fw > 0) {
      rect(ctx, bx + 1, 98, fw, 6, col);
      rect(ctx, bx + 1, 98, fw, 1, 'rgba(255,255,255,0.35)');
    }
    const secs = this.sub === 'intro' ? Math.ceil(this.limit / 60) : Math.ceil((this.sub === 'answer' ? this.left : this.lockLeft) / 60);
    text(ctx, String(secs), 316, 96, { size: 10, align: 'right', color: frac > 0.25 ? '#ffffff' : COLORS.bad, shadow: null });
  }

  layoutQuestion(ctx) {
    if (this.qLayout) return this.qLayout;
    let size = 12, lh = 14;
    let lines = wrap(ctx, this.cur.q, Q_PANEL.w - 16, size);
    if (lines.length === 3) lh = 13;
    if (lines.length > 3) {
      size = 10; lh = 12;
      lines = wrap(ctx, this.cur.q, Q_PANEL.w - 16, size).slice(0, 3);
    }
    this.qLayout = { size, lh, lines };
    return this.qLayout;
  }

  drawQuestion(ctx) {
    let edge;
    if (this.sub === 'reveal' || this.sub === 'outro') edge = this.verdict === 'ok' ? COLORS.good : COLORS.bad;
    panel(ctx, Q_PANEL.x, Q_PANEL.y, Q_PANEL.w, Q_PANEL.h, edge ? { edge } : {});
    const L = this.layoutQuestion(ctx);
    let budget = this.sub === 'intro' ? Math.floor(this.st * 1.6) : Infinity;
    const y0 = Q_PANEL.y + Math.round((Q_PANEL.h - L.lines.length * L.lh) / 2) + 1;
    L.lines.forEach((line, i) => {
      if (budget <= 0) return;
      const chars = Array.from(line);
      const show = chars.slice(0, budget).join('');
      budget -= chars.length;
      text(ctx, show, Q_PANEL.x + 8, y0 + i * L.lh, { size: L.size });
    });
  }

  layoutChoice(ctx, i) {
    if (this.cLayout[i]) return this.cLayout[i];
    const s = this.cur.choices[i];
    const maxW = CELL_W - 34;
    let size = 12, lh = 14;
    let lines = wrap(ctx, s, maxW, size);
    if (lines.length > 1 && measure(ctx, s, 10) <= maxW) { size = 10; lh = 12; lines = [s]; }
    else if (lines.length > 2) {
      size = 10; lh = 11;
      lines = wrap(ctx, s, maxW, size).slice(0, 3);
    }
    this.cLayout[i] = { size, lh, lines };
    return this.cLayout[i];
  }

  drawChoices(ctx) {
    const nC = this.cur.choices.length;
    const appear = this.sub === 'intro' ? clamp((this.st - 22) / 12, 0, 1) : 1;
    const revealed = this.sub === 'reveal' || this.sub === 'outro';
    const blink = Math.floor(this.t / 8) % 2 === 0;
    for (let i = 0; i < 4; i++) {
      const c = cellRect(i);
      if (i >= nC || appear <= 0) {
        rect(ctx, c.x + 1, c.y, c.w - 2, c.h, '#141a3c');
        rect(ctx, c.x, c.y + 1, c.w, c.h - 2, '#141a3c');
        continue;
      }
      const off = Math.round((1 - appear) * ((i % 2) ? 60 : -60));
      const x = c.x + off;
      let y = c.y;
      let bg = '#17204d', edge = '#6f7fc0', txt = '#ffffff', thick = false, badge = LABEL_COLORS[i];
      if (this.sub === 'answer' && i === this.sel) {
        bg = '#2d3f94'; edge = blink ? '#ffd23f' : '#fff3b0'; thick = true; y -= 1;
      }
      if (this.sub === 'judge' && i === this.picked) {
        bg = Math.floor(this.st / 3) % 2 ? '#6a5a10' : '#2d3f94'; edge = '#ffd23f'; thick = true;
      }
      if (this.elim.has(i)) { bg = '#191b26'; edge = '#3a3f5a'; txt = '#5a5f78'; badge = '#3a3f5a'; }
      if (revealed) {
        if (i === this.cur.answer) { bg = blink ? '#1f8a45' : '#23a04f'; edge = '#9cffb8'; thick = true; txt = '#ffffff'; badge = LABEL_COLORS[i]; }
        else if (i === this.picked) { bg = '#8a2433'; edge = '#ff5d6c'; thick = true; }
        else { bg = '#14183a'; edge = '#3a4270'; txt = '#8890b8'; }
      }
      // rounded box
      rect(ctx, x + 2, y + 2, c.w, c.h, '#05060f');
      rect(ctx, x + 1, y, c.w - 2, c.h, edge);
      rect(ctx, x, y + 1, c.w, c.h - 2, edge);
      if (thick) {
        rect(ctx, x + 3, y + 3, c.w - 6, c.h - 6, bg);
      } else {
        rect(ctx, x + 1, y + 1, c.w - 2, c.h - 2, bg);
      }
      rect(ctx, x + 3, y + 3, c.w - 6, 1, 'rgba(255,255,255,0.12)');
      // label badge
      const bx = x + 6, by = y + Math.round((c.h - 18) / 2);
      rect(ctx, bx + 1, by, 16, 18, badge);
      rect(ctx, bx, by + 1, 18, 16, badge);
      rect(ctx, bx + 2, by + 1, 14, 1, 'rgba(255,255,255,0.35)');
      text(ctx, LABELS[i], bx + 9, by + 3, { size: 12, align: 'center', color: '#ffffff', shadow: 'rgba(0,0,0,0.5)' });
      // choice text
      const L = this.layoutChoice(ctx, i);
      const ty = y + Math.round((c.h - L.lines.length * L.lh) / 2) + 1;
      L.lines.forEach((line, k) => text(ctx, line, x + 30, ty + k * L.lh, { size: L.size, color: txt }));
      if (revealed && i === this.cur.answer) text(ctx, '○', x + c.w - 6, y + 2, { size: 10, align: 'right', color: '#ffffff', shadow: null });
      else if (revealed && i === this.picked) text(ctx, '×', x + c.w - 6, y + 2, { size: 10, align: 'right', color: '#ffffff', shadow: null });
    }
  }

  drawVerdict(ctx) {
    if (this.sub !== 'reveal') return;
    const M = marks();
    const img = this.verdict === 'ok' ? M.ok : M.ng;
    const k = this.st < 8 ? 0.4 + (this.st / 8) * 0.8 : this.st < 12 ? 1.2 - ((this.st - 8) / 4) * 0.2 : 1;
    const s = Math.round(M.size * k);
    ctx.drawImage(img, Math.round(MARK_C.x - s / 2), Math.round(MARK_C.y - s / 2), s, s);
    if (this.verdict === 'ok' && this.st < 40) {
      for (let i = 0; i < 4; i++) {
        const a = this.st / 6 + i * 1.57;
        sparkle(ctx, MARK_C.x + Math.cos(a) * 26, MARK_C.y + Math.sin(a) * 18, 2, '#fff6a8');
      }
    }
  }

  drawOutro(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, this.st / 20);
    rect(ctx, 0, 107, W, 133, '#000000');
    ctx.restore();
    if (this.phase === 'result') return; // the result card takes over (the banner would peek out below it)
    const k = Math.min(1, this.st / 10);
    const y = Math.round(160 + (1 - k) * 30);
    panel(ctx, 70, y, 180, 44, { edge: COLORS.accent });
    text(ctx, '全問終了！', 160, y + 7, { size: 16, align: 'center', color: COLORS.accent, outline: '#000' });
    text(ctx, `${this.n}問中 ${this.correct}問正解`, 160, y + 27, { size: 10, align: 'center' });
  }
}

// The registered 'quiz': a TV quiz show with its own format goes to the HD 'quizstudio' (same promise, same
// result object); everything else (オールスター感謝祭, ミリオネア, custom questions …) is the 4択 above.
const STUDIO_SHOWS = new Set(['hexagon', 'hexagon2', 'nepleague', 'tanshuku']);
class QuizShow {
  static title = Quiz.title;
  static howto = Quiz.howto;
  static skill = Quiz.skill;
  static get bgm() { return QuizShow.nextBgm || Quiz.bgm; }
  constructor(g, opts = {}) {
    const S = MINIGAMES.quizstudio;
    const id = opts.format === 'classic' || (Array.isArray(opts.questions) && opts.questions.length) ? null : opts.showId || showOf(opts.show);
    if (S && opts.format !== 'classic' && ((Array.isArray(opts.stages) && opts.stages.length) || (id && STUDIO_SHOWS.has(id)))) {
      QuizShow.nextBgm = S.bgm;
      return new S(g, { ...opts, showId: id || undefined });
    }
    QuizShow.nextBgm = Quiz.bgm;
    return new Quiz(g, opts);
  }
}
registerMinigame('quiz', QuizShow);
export { Quiz, QuizShow, BANK, ERA };
