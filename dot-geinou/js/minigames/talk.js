// トーク番組 — pick the best comeback to the host's line (skill: talk).
//
//   await g.minigame('talk', { difficulty: 3 })                    built-in variety-show scenes
//   await g.minigame('talk', { topic: 'radio' })                   'variety' | 'local' | 'radio' | 'news' | 'drama'
//   await g.minigame('talk', { topic: '前説', scenes: [{ prompt: '司会「…」', answers: [{ text, score }] }] })
//
// opts
//   topic   a built-in topic key (above) or any free text. Free text is shown as a caption when the
//           show opens, and the studio set is guessed from keywords (ラジオ / ニュース / ドラマ /
//           オーディション・レッスン / 祭・商店街・旅・ロケ …). 'title' is used for the guess too.
//   scenes  custom scenes [{ prompt, answers: [{ text, score }] }] played in order. score is 0..100 (or
//           'best' | 'good' | 'ok' | 'bad'); plain string answers are scored best / ok / bad by position.
//           A prompt like '名前「セリフ」' is spoken by that person: 司会・審査員・先生… are the host, guests
//           on the set answer to ゲスト・芸人・共演者…, and people like こども・おばあちゃん・大将・観光客
//           walk on stage. A prompt without 「」 is shown as narration (テロップ). '{name}' = player name.
//   count   number of scenes (default 5..8 by difficulty; with custom scenes: how many were given —
//           a bigger count is padded from the built-in bank)
//   time    seconds to answer (default 8.5 → 4.2 by difficulty, longer with the talk skill)
//   set     force the studio: 'variety' | 'local' | 'radio' | 'news' | 'drama' | 'room'
//   show    show name on the set / mc: the host's name tag
//
// Controls: ↑↓ move the cursor, A answers (A also fast-forwards the host's line). Answers are shuffled.
// Score: each scene earns (answer score / best score in that scene) × speed (100% while at least half
// of the time is left, down to 90%). Final = 85% average of the scenes + 15% 場の空気 (a mood gauge that
// starts at 50% and is raised by great answers, lowered by bad ones and by silence).

import { Minigame, registerMinigame, text, panel, rect, wrap, COLORS, sparkle } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheet, drawChar, LOOKS } from '../engine/sprites.js';
import { audio, registerSong } from '../engine/audio.js';
import { makeCanvas, mulberry32, shuffle, clamp, mix, shade, W, H } from '../engine/util.js';

// ------------------------------------------------------------------ built-in scenes
// [prompt, best answer, ok answer, bad answer, 'first' | 'last' (optional)]
// A prompt without 「」 is spoken by the host of the topic's set.
const TOPICS = {
  variety: {
    set: 'variety',
    scenes: [
      ['{name}さん、最近ハマってることは？', 'ぬか漬け！毎朝まぜてます', 'えーと…散歩、ですかね', '特にないっす'],
      ['デビューして、何か変わったことある？', '母が近所に名刺を配ってます', '少し早起きになりました', '別に、何も変わらないです'],
      ['ゲスト「わたし、料理が全然ダメで…」', 'じゃあ今度、一緒に習いましょう！', 'カップ麺も立派な料理です！', 'へえ、そうなんですね'],
      ['休みの日は、何してるの？', '公園のハトと会議してます', '家でゴロゴロしてます', 'それ、言わなきゃダメですか？'],
      ['子どものころの夢は何だった？', 'ケーキ屋さん！今は食べる係です', 'サッカー選手でした', '覚えてないです'],
      ['ここで一発、ギャグをお願いします！', '（全力で）ドット〜ン！', 'えっ、今ですか！？', '（無言で座る）'],
      ['芸人「その服、どこで買ったん？」', 'おばあちゃんの手作りです！', '駅前のお店です', '…覚えてないです'],
      ['最近、うれしかったことは？', '自販機で当たりが出ました！', 'ごはんがおいしかったです', 'うーん…ないかも'],
      ['苦手なものって、何かある？', '高いところ！脚立もムリです', 'ピーマンが少し苦手です', 'ないです。完璧なので'],
      ['{name}さんの特技、見てみたいなあ！', '早口言葉、いきます！', 'えっと…拍手なら得意です', '今日は気分じゃないです'],
      ['ゲスト「{name}さんって、意外と几帳面？」', 'はい！靴下は色別に並べてます', 'うーん、どうでしょう', 'その質問、パスで'],
      ['最後に、何か告知はある？', '来週ライブです！ぜひ来て！', 'えっと…また今度で', '告知って何ですか？', 'last'],
    ],
  },
  local: {
    set: 'local',
    scenes: [
      ['さあ、到着！この町の第一印象は？', '空気がおいしい！深呼吸しちゃう', '思ったより静かですね', 'コンビニってあります？', 'first'],
      ['おかみさん「名物の焼きおにぎり、どうぞ！」', 'うまっ！香ばしさが最高です', 'おいしいです（もぐもぐ）', 'ダイエット中なんで…'],
      ['おばあちゃん「どこから来なさった？」', '東京から！会いに来ました！', 'えっと、遠くからです', 'それは言えません'],
      ['こども「テレビの人？サインちょうだい！」', 'もちろん！お名前は？', 'あとでね〜', '事務所に聞いてね'],
      ['大将「この町の自慢は、海の幸だよ！」', '朝どれの魚、食べてみたい！', '魚、ちょっと苦手で…', 'スーパーでも買えますよね'],
      ['観光客「写真、撮ってもらえますか？」', 'はい、みんな笑って〜パシャ！', 'えっと、どこ押すんですか？', '今ロケ中なんで…'],
      ['温泉に到着！感想をどうぞ！', 'はぁ〜…極楽、極楽〜', 'ちょうどいい温度ですね', 'ぬるいっすね'],
      ['名物のソフトクリーム！何味にする？', 'ご当地限定の味、ください！', 'じゃあ、バニラで', '寒いのでいいです'],
      ['おじいちゃん「わしの自慢の畑、見ていくか？」', 'ぜひ！収穫も手伝います！', 'ちょっとだけなら…', '汚れるのはちょっと…'],
      ['足湯を発見！入ってみる？', 'はい！靴下ぬぎます！', 'じゃあ、ちょっとだけ', 'タオルないんで、パスで'],
      ['最後に、この町のおすすめをひと言！', '人も景色も、あったかい町です！', 'また来たいと思います', '早く帰りたいです', 'last'],
    ],
  },
  radio: {
    set: 'radio',
    scenes: [
      ['こんばんは！まずはリスナーにごあいさつ！', 'こんばんは〜！夜ふかし仲間たち！', 'えー…こんばんは', '（マイクに気づかない）', 'first'],
      ['おたより「テストで100点とりました！」', 'すごい！今夜はお祝いだね！', 'へえ、何の教科かな？', 'ふーん、次いきます'],
      ['ここで曲紹介、お願いします！', 'それでは聴いてください、どうぞ！', 'えっと、曲です！', '（無言で10秒）'],
      ['おたより「最近、失恋しちゃいました…」', 'つらかったね。今夜は一緒にいるよ', '次があるさ！元気出して！', 'あるあるですね〜'],
      ['「眠れない」ってメールが届いてるよ', 'じゃあ、羊を一緒に数えよう！', 'ホットミルクがおすすめです', 'こっちはもう眠いです'],
      ['おたより「好きな季節は何ですか？」', '秋！月見だんごが最高です！', 'えーと、全部ですかね', '季節とか興味ないです'],
      ['おたより「明日、初めての発表会です」', 'きっと大丈夫！応援してるよ！', '緊張するよね〜', 'へえ、まあ適当にどうぞ'],
      ['ここで電話がつながりました！', 'もしもし〜！聞こえてますか〜？', 'あ、どうも…', '（受話器を逆さに持つ）'],
      ['夜食におすすめ、何かある？', 'あったかいうどん！心もぽかぽか', 'ゆで卵ですかね', '夜は食べない主義です'],
      ['今夜のテーマは「小さな幸せ」！', '信号が全部青だった日！', '晴れてると、うれしいです', '幸せとか、よくわかんないです'],
      ['そろそろお別れの時間。最後にひと言！', 'また来週、この時間に会おうね！', 'おやすみなさい…', 'やっと終わったー！', 'last'],
    ],
  },
  news: {
    set: 'news',
    scenes: [
      ['おはようございます！今朝の調子は？', 'おはようございます！絶好調です', 'ちょっと眠いです…', '（大あくび）', 'first'],
      ['話題のスイーツを試食！感想をどうぞ！', 'ふわっふわ！口の中が春です！', '甘くておいしいです', 'ふつうのケーキですね'],
      ['今日は一日、雨の予報。ひと言どうぞ！', '傘を忘れずに！足元に注意です', '雨の音も、いいですよね', 'ずっと家にいます'],
      ['動物園から中継！パンダの赤ちゃんです！', 'かわいい！一生懸命ねてますね', 'あ、白と黒ですね', 'ちょっと見えないです'],
      ['コメンテーター「{name}さんは、朝ごはん派？」', 'ごはん派！納豆は欠かせません', '日によって変わります', '朝はいつも寝てます'],
      ['お花見スポットから中継です！', '満開です！まるで桜のトンネル！', '花より団子です！（もぐもぐ）', '人が多すぎますね'],
      ['話題の行列グルメ！並んでみる？', 'もちろん！並ぶのも楽しみです', '30分までなら…', '並ぶのは苦手で…'],
      ['週末は晴れの予報！おすすめの過ごし方は？', 'お弁当を持ってピクニック！', '洗濯物を干します', '家で寝てます'],
      ['朝の体操コーナー！一緒にどうぞ！', 'はい！いち、に、さん、し！', '（少しだけ手を動かす）', '朝はちょっと…'],
      ['スタジオに子犬が来てくれました！', 'かわいい〜！おいで、おいで〜', 'あ、ちっちゃいですね', '（目を合わせない）'],
      ['まもなくCMです。最後にひと言！', 'このあとも、お楽しみに！', 'えっと、CMです', '帰っていいですか？', 'last'],
    ],
  },
  drama: {
    set: 'drama',
    scenes: [
      ['新ドラマ『ひだまり商店街』、どんなお話？', '商店街の、笑って泣ける話です！', 'えーっと、台本どおりです', '見ればわかりますよ', 'first'],
      ['撮影現場の雰囲気はどうですか？', 'みんな仲良し！毎日笑ってます', 'ふつうに撮影してます', '朝が早くて大変です…'],
      ['ずばり、見どころを教えてください！', '第1話のラスト、必見です！', '全部が見どころです！', '最終回で、実は…あっ'],
      ['共演者「{name}さん、いつもお菓子くれるんです」', '差し入れが趣味なんです！', 'たまたまですよ〜', 'え、そうでしたっけ？'],
      ['役づくりで、がんばったことは？', '毎朝、コロッケ屋さんで修業！', 'セリフをたくさん覚えました', '特に何もしてません'],
      ['ドラマの役と、ふだんの自分は似てる？', '食いしんぼうなところが同じ！', 'うーん、ちょっと似てるかも', '全然ちがいます。以上です'],
      ['撮影中の、おもしろいハプニングは？', '猫が勝手に出演しちゃいました！', 'セリフを少しかみました', '特になかったです'],
      ['ドラマの主題歌、もう聴きました？', 'はい！毎日口ずさんでます', 'まだ少しだけです', '歌は興味ないです'],
      ['共演者「{name}さん、現場のムードメーカーなんです」', 'みんなの笑顔が大好きなんです！', 'そうですかね〜', 'うるさいだけです'],
      ['もし役を交換できるなら、誰の役？', '商店街の猫！ひなたぼっこ担当', 'お父さん役ですかね', '自分の役でいいです'],
      ['最後に、視聴者のみなさんにひと言！', 'きっと元気が出ます！ぜひ！', 'よかったら見てください', '裏番組も面白いですよ', 'last'],
    ],
  },
};
const TIER_SCORES = [100, 45, 5]; // best / ok / bad
const TIER_NAMES = { best: 100, good: 75, ok: 45, bad: 5 };
const RECENT = []; // prompts used lately (avoid repeats across plays)

// host reactions by grade; sets can override
const REACT = {
  best: ['うまい！さすが！', 'いいねえ〜、最高！', 'それ、おもしろい！', 'ナイス返し！'],
  good: ['いいですね〜！', 'ハハハ、わかる〜！', 'なるほど、いいね！'],
  ok: ['なるほど〜！', 'そうなんだ〜', 'ふむふむ、OK！'],
  bad: ['あ、あれ〜？', 'えーっと…次いこう！', 'ちょ、ちょっと〜！', 'まあまあ、ドンマイ！'],
  time: ['…もしもーし？', 'あれ、固まっちゃった？', '緊張しちゃったかな？'],
};
const CROWD = {
  studio: { best: ['ドッ！', 'ワハハ', 'アハハ', '大爆笑'], good: ['ワハハ', 'アハハ', 'クスクス'], ok: ['パチパチ', 'へぇ〜', 'なるほど'], bad: ['ざわ…', 'ざわ…', 'ざわ…'], time: ['シーン…'] },
  radio: { best: ['メール続々', 'ワハハ', 'いいね！'], good: ['いいね！', 'わかる〜'], ok: ['ふむふむ', 'なるほど'], bad: ['ざわ…', 'ざわ…'], time: ['（無音）'] },
  room: { best: ['おおっ！', 'いいね…！'], good: ['ほう…', 'なるほど'], ok: ['ふむ', '（メモ）'], bad: ['うーん…', 'ざわ…'], time: ['シーン…'] },
};

// Studio sets. mc = default name tag of the host, meter = label of the laugh meter.
const SETS = {
  variety: {
    mc: '司会', show: 'ドットーク！', song: 'talk_show', meter: '笑いメーター', hot: '大爆笑！', crowd: 'studio',
    open: '『{show}』、スタート！\n今日のゲストは{name}さんです！',
    close: ['{name}さん、最高でした！\nまた来てくださいね〜！', '{name}さん、ありがとう！\n以上、『{show}』でした〜！'],
    react: {},
  },
  local: {
    mc: 'ナビゲーター', show: 'ぶらっと！ご当地旅', song: 'talk_show', meter: '盛り上がり', hot: '大ウケ！', crowd: 'studio',
    open: '『{show}』！\n今日の旅のおともは{name}さん！',
    close: ['{name}さん、最高の旅でした！\nまた来ましょうね〜！', '{name}さん、おつかれさま！\nそれではまた来週〜！'],
    react: { best: ['いい表情〜！', 'それ、最高！', 'うまい！さすが！'] },
  },
  radio: {
    mc: 'パーソナリティ', show: 'ドットの夜ふかしラジオ', song: 'talk_radio', meter: 'リスナー反響', hot: '大反響！', crowd: 'radio',
    open: 'こんばんは！『{show}』\n今夜のゲストは{name}さんです！',
    close: ['{name}さん、最高の夜でした！\nみんな、また来週〜！', '{name}さん、ありがとう！\nそれでは、おやすみなさ〜い！'],
    react: { best: ['メールが止まらない！', 'いいねえ〜、最高！', 'ナイス返し！'], bad: ['あ、あれ〜？', '…気を取り直して！'], time: ['…放送事故かな？', 'もしもーし？'] },
  },
  news: {
    mc: 'キャスター', show: 'あさドット！', song: 'talk_show', meter: 'スタジオ反応', hot: '大好評！', crowd: 'studio',
    open: 'おはようございます！『{show}』\n今朝のゲストは{name}さんです！',
    close: ['{name}さん、さわやかでした！\nまたお越しください！', '{name}さん、ありがとうございました！\n『{show}』でした！'],
    react: { best: ['わかりやすい！', 'さわやかですね！', 'すてきなコメント！'], bad: ['え、ええと…', '…次の話題です！'], time: ['…カメラ、こっちです', 'あれ、固まっちゃった？'] },
  },
  drama: {
    mc: '司会', show: 'お昼のトークサロン', song: 'talk_show', meter: '笑いメーター', hot: '大爆笑！', crowd: 'studio',
    open: 'ようこそ『{show}』へ！\n新ドラマ主演の{name}さんです！',
    close: ['{name}さん、ドラマ楽しみです！\nありがとうございました！', '{name}さん、ありがとうございました！\nドラマもお楽しみに！'],
    react: { best: ['これは見たくなる！', 'うまい！さすが主演！', 'ナイス返し！'] },
  },
  room: {
    mc: '審査員', show: 'オーディション会場', song: 'talk_radio', meter: '手ごたえ', hot: '好感触！', crowd: 'room',
    open: 'では、{name}さん。\nオーディションを始めます。',
    close: ['おつかれさまでした。\nとても良かったですよ！', 'おつかれさまでした。\n結果は…このあとすぐ！'],
    react: { best: ['…いいですね！', 'おっ、光るものがある！'], good: ['なかなかですね', 'いい感じだね'], ok: ['ふむ、なるほど', 'まあまあかな'], bad: ['うーん…', 'もう少し考えよう'], time: ['…緊張してるかな？', 'ゆっくりでいいよ'] },
  },
};
const EVENT_CLOSE = ['{name}さん、最高でした！\nみなさん、大きな拍手を〜！', '{name}さん、ありがとうございました！\nおつかれさまでした〜！'];
const LESSON = { mc: '先生', show: 'レッスン室', open: 'よろしく、{name}さん。\nさっそく始めよう！', close: ['おつかれさま！\nいいセンスしてるよ！', 'おつかれさま！\n次もがんばろう！'] };

// keyword -> set (checked against topic + title)
const SET_RULES = [
  [/ラジオ/, 'radio'],
  [/ニュース|情報番組|ワイドショー|コメンテーター|天気予報/, 'news'],
  [/ドラマ|番宣|映画|試写会|舞台あいさつ/, 'drama'],
  [/オーディション|審査|面接|レッスン|講座|教室|稽古/, 'room'],
  [/祭|商店街|ロケ|旅|ご当地|モール|営業|地方|呼び込み|街頭|中継|食レポ/, 'local'],
];
const LESSON_RE = /レッスン|講座|教室|稽古/;

// speakers
const HOST_RE = /^(司会|MC|ＭＣ|パーソナリティ|キャスター|アナウンサー|ナビゲーター|審査員|審査委員長|先生|講師|ホスト)/;
const GUEST_RE = /ゲスト|芸人|共演|コメンテーター|パネラー|アイドル|相方/;
// letters / mails are read out by the host (the tab shows the word)
const READ_RE = /おたより|お便り|メール|ハガキ|はがき|手紙|投稿|ファックス|FAX/;
// '…に「…」' / '…から「…」' is not a name: show the whole prompt as narration
const PARTICLE_RE = /(に|で|が|は|を|へ|から|まで|って)$/;
const STUDENT = { hair: 'short', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#2a3560', jacket: true };
const GIRL = { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ff7eb6', bottom: '#5a4a8a', skirt: true };
const NEWS_MC = { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#2a3560', skirt: true, jacket: true };
const JUDGE_W = { hair: 'long', hairColor: 'black', skin: 'light', top: '#3f5fa8', bottom: '#2a3560', skirt: true, jacket: true };
const COMMENTATOR = { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#5a4a3a', bottom: '#3b3f48', jacket: true, tie: '#c0452f', glasses: true };
const SPEAKER_LOOKS = [
  [/女の子/, GIRL],
  [/こども|子ども|子供|ちびっこ|男の子|キッズ/, LOOKS.kid],
  [/おばあ/, LOOKS.oldwoman],
  [/おばちゃん|おかみ|奥さん|ママ|お母さん/, { ...LOOKS.mom, top: '#2a3a7a' }],
  [/おじい|会長|長老|隠居/, LOOKS.oldman],
  [/新郎|花婿/, { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#1e1e26', jacket: true, tie: '#c0c4d0' }],
  [/新婦|花嫁/, { hair: 'long', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#ffffff', skirt: true }],
  [/友人|友だち|友達|同級生|先輩|後輩|仲間/, { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#5ec4a8', bottom: '#3a4a7a' }],
  [/大将|店主|おやじ|板前|シェフ|職人/, LOOKS.chef],
  [/観光客|旅行者/, LOOKS.tourist],
  [/会社員|サラリーマン/, LOOKS.salaryman],
  [/学生|生徒/, STUDENT],
  [/AD|ＡＤ|アシスタント/, LOOKS.ad],
  [/監督|ディレクター/, LOOKS.director],
  [/プロデューサー|社長|支配人/, LOOKS.president],
  [/お客|ファン|観客/, LOOKS.fan],
  [/アイドル/, LOOKS.idol],
  [/芸人|相方/, LOOKS.comedian],
  [/共演|女優/, LOOKS.actress],
  [/俳優/, LOOKS.actor],
  [/コメンテーター|専門家|博士/, COMMENTATOR],
  [/ゲスト|パネラー/, LOOKS.idol],
];
// anyone else (町の人, 店員さん …) gets one of these, chosen by the name
const PASSERBY_LOOKS = [
  { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a8a5a', bottom: '#3b3f48' },
  { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e86a8a', bottom: '#4a4e6a', skirt: true },
  { hair: 'cap', hat: '#2f6fd0', hairColor: 'black', skin: 'tan', top: '#f2f2f2', bottom: '#3a4a7a' },
  { hair: 'long', hairColor: 'brown', skin: 'fair', top: '#ffb03a', bottom: '#5a4a3a', skirt: true },
];

// ------------------------------------------------------------------ tuning
const DIFF = {
  scenes: [5, 6, 6, 7, 8],
  time: [8.5, 7, 6, 5, 4.2], // seconds to answer
};
const AIR = { best: 0.2, good: 0.1, ok: -0.04, bad: -0.2, time: -0.28 };
const METER = { best: 1, good: 0.74, ok: 0.42, bad: 0.08, time: 0 };
const GRADE_COL = { best: '#ffd23f', good: '#5ee07a', ok: '#5fd7ff', bad: '#ff5d6c', time: '#6a7090' };
const CUE_F = 28;
const LOCK_F = 10; // frames after the answers appear before A is accepted
const REACT_MIN = 64;
const REACT_MAX = 124;
const CLOSE_F = 160;

const INK = '#22202a';
const STAGE_B = 120; // stage occupies y 16..120
const BUB_B = 160; // bubbles are anchored to this bottom line
const PANEL = { x: 6, y: 163, w: 308, h: 64 };

registerSong('talk_show', {
  bpm: 132, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.032, notes: 'F5 . A5 C6 . A5 F5 . | G5 . A5 Bb5 . A5 G5 . | A5 . C6 F6 . C6 A5 . | G5 A5 G5 F5 E5 . C5 . | F5 . A5 C6 . A5 F5 . | D6 . C6 Bb5 . A5 G5 . | A5 C6 A5 G5 F5 . E5 . | F5 - - . C5 . F5 .' },
    { wave: 'triangle', vol: 0.11, notes: 'F2 . C3 . F2 . C3 . | C3 . G3 . C3 . E3 . | F2 . C3 . F2 . A2 . | C3 . G2 . C3 . E3 . | F2 . C3 . F2 . C3 . | Bb2 . F3 . Bb2 . D3 . | C3 . G3 . C3 . E3 . | F2 . C3 . F2 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h k | k . h . s h h .' },
  ],
});
registerSong('talk_radio', {
  bpm: 92, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.08, notes: 'E5 - G5 - A5 - G5 E5 | D5 - - - B4 - . . | C5 - E5 - G5 - E5 C5 | D5 - - - . . . . | A4 - C5 - E5 - D5 C5 | B4 - - - G4 - . . | C5 - D5 - E5 - G5 - | E5 - - - . . . .' },
    { wave: 'square', vol: 0.02, notes: 'C4 E4 G4 E4 C4 E4 G4 E4 | G3 B3 D4 B3 G3 B3 D4 B3 | A3 C4 E4 C4 A3 C4 E4 C4 | G3 B3 D4 B3 G3 B3 D4 B3 | F3 A3 C4 A3 F3 A3 C4 A3 | E3 G3 B3 G3 E3 G3 B3 G3 | F3 A3 C4 A3 G3 B3 D4 B3 | C4 E4 G4 E4 C4 E4 G4 E4' },
    { wave: 'triangle', vol: 0.09, notes: 'C3 - - - C3 - - - | G2 - - - G2 - - - | A2 - - - A2 - - - | G2 - - - G2 - - - | F2 - - - F2 - - - | E2 - - - E2 - - - | F2 - - - G2 - - - | C3 - - - C3 - - -' },
    { wave: 'drum', vol: 0.04, notes: 'k . . . s . . h | k . h . s . . .' },
  ],
});

// ------------------------------------------------------------------ small helpers
const pickFrom = (arr, r) => arr[Math.floor(r() * arr.length)];

function tones(seq) {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime + 0.01;
  for (const [f, s, d, wave = 'square', vol = 0.06] of seq) audio.tone(f, t0 + s, d, { wave, vol });
}
const SND = {
  cue: [[988, 0, 0.06], [1319, 0.07, 0.14]],
  show: [[784, 0, 0.06, 'square', 0.05], [988, 0.06, 0.06, 'square', 0.05], [1175, 0.12, 0.06, 'square', 0.05], [1568, 0.18, 0.2, 'square', 0.05], [392, 0.18, 0.2, 'triangle', 0.09]],
  best: [[1047, 0, 0.08], [1319, 0.08, 0.08], [1568, 0.16, 0.08], [2093, 0.24, 0.22, 'square', 0.05]],
  tick: [[1200, 0, 0.03, 'square', 0.04]],
  tick2: [[1600, 0, 0.05, 'square', 0.05]],
};

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (hw > 0) ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
  }
}

// Scanline polygon fill: crisp pixels, no anti-aliasing.
function fillPoly(ctx, pts, color) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  ctx.fillStyle = color;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
      if (b > a) ctx.fillRect(a, y, b - a, 1);
    }
  }
}

function roundBox(ctx, x, y, w, h, fill, edge = INK) {
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x + 2, y, w - 4, h, edge);
  rect(ctx, x, y + 2, w, h - 4, edge);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, edge);
  rect(ctx, x + 2, y + 1, w - 4, h - 2, fill);
  rect(ctx, x + 1, y + 2, w - 2, h - 4, fill);
}

function vgrad(c, x, y, w, h, a, b, step = 2) {
  for (let i = 0; i < h; i += step) {
    c.fillStyle = mix(a, b, i / Math.max(1, h - 1));
    c.fillRect(x, y + i, w, Math.min(step, h - i));
  }
}

function fitSize(ctx, str, maxW, big = 12, small = 10) {
  return measure(ctx, str, big) <= maxW ? big : small;
}

// ------------------------------------------------------------------ studio sets
// Each set: bg canvas, over-layers (drawn after actors of layer 0 / 1), actors with box (x, y) of the
// 32x40 sprite drawn at 2x, a visitor slot, meter / board positions, optional name plate.
const ACTOR_DEF = { layer: 2, dir: 'down', kind: 'guest' };

function buildSet(key, o) {
  const [bg, c] = makeCanvas(W, STAGE_B);
  const [o1, c1] = makeCanvas(W, STAGE_B);
  const [o2, c2] = makeCanvas(W, STAGE_B);
  const r = mulberry32(17 + key.length);
  const S = { key, bg, over: [o1, o2], actors: [], meter: { x: 4, y: 20 }, board: null, plate: null, audience: false, headphones: false };
  const actor = (id, look, x, y, extra = {}) => S.actors.push({ ...ACTOR_DEF, id, look, x, y, ...extra });

  if (key === 'variety') {
    vgrad(c, 0, 16, W, 72, '#24104a', '#4b2276');
    for (let x = 10; x < W; x += 28) rect(c, x, 16, 2, 70, 'rgba(255,255,255,0.05)');
    for (let i = 0; i < 46; i++) rect(c, Math.floor(r() * W), 18 + Math.floor(r() * 66), 1, 1, r() < 0.5 ? '#ffd8f0' : '#a890ff');
    // ひな壇 backdrop with polka dots
    rect(c, 156, 18, 164, 48, '#ffd23f');
    rect(c, 158, 20, 162, 46, '#c23c86');
    for (let y = 24; y < 64; y += 8) for (let x = 162 + ((y / 8) % 2) * 6; x < W; x += 12) fillEllipse(c, x, y, 2, 2, '#e65aa6');
    // spotlight beams from the ceiling
    c.globalAlpha = 0.07;
    fillPoly(c, [[30, 16], [42, 16], [70, 86], [8, 86]], '#fff2c8');
    fillPoly(c, [[110, 16], [122, 16], [146, 86], [86, 86]], '#fff2c8');
    c.globalAlpha = 1;
    // floor
    rect(c, 0, 84, W, 2, '#ff7eb6');
    rect(c, 0, 86, W, 1, '#8a3a7a');
    vgrad(c, 0, 87, W, 33, '#2c2058', '#140e2e');
    for (let y = 92; y < STAGE_B; y += 7) rect(c, 0, y, W, 1, 'rgba(255,255,255,0.05)');
    fillEllipse(c, 38, 110, 30, 5, '#4a3a8a');
    fillEllipse(c, 38, 110, 24, 3, '#5a4aa0');
    // back tier face (covers the back row's legs)
    rect(c1, 148, 56, 172, 28, '#7a2a9a');
    rect(c1, 148, 56, 172, 2, '#ffd23f');
    rect(c1, 148, 58, 172, 1, '#b86a00');
    for (let x = 152; x < W; x += 12) rect(c1, x, 64, 6, 2, '#9a46b8');
    // front tier face
    rect(c2, 142, 80, 178, 40, '#5a1f7a');
    rect(c2, 142, 80, 178, 2, '#ffd23f');
    rect(c2, 142, 82, 178, 1, '#b86a00');
    rect(c2, 142, 80, 2, 40, '#ffd23f');
    for (let x = 150; x < W; x += 10) { rect(c2, x, 108, 3, 3, '#ffe9a0'); rect(c2, x + 1, 107, 1, 1, '#ffffff'); }
    S.plate = { x: 176, y: 90 };
    actor('mc', null, 22, 70, { kind: 'mc', dir: 'right', layer: 2 });
    actor('g0', LOOKS.idol, 196, 26, { layer: 0, kw: /アイドル|ゲスト/ });
    actor('g1', LOOKS.comedian2, 268, 26, { layer: 0, kw: /パネラー|コメンテーター/ });
    actor('player', null, 160, 50, { kind: 'player', layer: 1 });
    actor('g2', LOOKS.comedian, 232, 50, { layer: 1, kw: /芸人|相方/ });
    S.visitor = { x: 98, y: 72, dir: 'right', layer: 2 };
    S.board = { x: 72, y: 20, w: 82, h: 28, style: 'marquee' };
    S.meter = { x: 4, y: 18 };
    S.audience = true;
    S.handMic = true;
    S.pop = { x: 104, y: 58 };
  } else if (key === 'local') {
    vgrad(c, 0, 16, W, 60, '#5cb6ec', '#d6f1ff');
    for (const [x, y, w] of [[54, 30, 18], [72, 27, 11], [196, 24, 16], [212, 28, 10], [128, 40, 12]]) { fillEllipse(c, x, y + 1, w, 4, '#c8e4f4'); fillEllipse(c, x, y, w, 4, '#ffffff'); }
    fillPoly(c, [[0, 74], [0, 58], [40, 40], [86, 62], [130, 44], [178, 66], [190, 74]], '#7aaa7a');
    fillPoly(c, [[0, 74], [0, 66], [52, 52], [104, 70], [150, 58], [190, 74]], '#4f8a55');
    // white plaster wall with a tiled cap
    rect(c, 0, 62, 176, 14, '#f2ecdc');
    rect(c, 0, 58, 176, 4, '#4a4e5a');
    rect(c, 0, 57, 176, 1, '#6a6f80');
    for (let x = 0; x < 176; x += 6) rect(c, x, 61, 3, 1, '#2a2d36');
    rect(c, 0, 74, 176, 2, '#c8c0aa');
    // shop
    fillPoly(c, [[172, 40], [184, 24], [W, 24], [W, 40]], '#4a4e5a');
    for (let y = 26; y < 40; y += 3) rect(c, 180 + (40 - y) * 0.2, y, W, 1, '#3a3d48');
    rect(c, 170, 40, 150, 3, '#2a2d36');
    rect(c, 176, 43, 144, 34, '#8a5a32');
    for (let x = 180; x < W; x += 16) rect(c, x, 43, 1, 34, '#6a4024');
    // のれん
    for (let i = 0; i < 4; i++) {
      const nx = 214 + i * 22;
      rect(c, nx, 45, 20, 18, '#2a3a7a');
      rect(c, nx, 45, 20, 1, '#4a5aa0');
    }
    text(c, '名', 236, 49, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    text(c, '物', 258, 49, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    // shop window
    rect(c, 182, 50, 26, 22, '#3a2412');
    rect(c, 184, 52, 22, 18, '#ffe9b0');
    rect(c, 184, 60, 22, 1, '#8a5a32');
    for (const [x, col] of [[188, '#ff8a3d'], [196, '#c0452f'], [201, '#5ee07a']]) fillEllipse(c, x, 57, 2, 2, col);
    // lanterns
    for (const lx of [210, 304]) {
      rect(c, lx, 43, 1, 3, '#2a2d36');
      fillEllipse(c, lx, 51, 5, 6, '#d62f2f');
      rect(c, lx - 4, 46, 8, 1, '#2a2d36');
      rect(c, lx - 4, 56, 8, 1, '#2a2d36');
      rect(c, lx - 3, 49, 6, 1, '#ff8a6a');
    }
    // のぼり flags
    for (const [fx, col] of [[150, '#d62f2f'], [164, '#2f6fd0']]) {
      rect(c, fx, 34, 2, 52, '#6a4024');
      rect(c, fx + 2, 36, 10, 36, col);
      rect(c, fx + 2, 36, 10, 2, '#ffffff');
      text(c, fx === 150 ? '旅' : '湯', fx + 7, 44, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    }
    // stone street
    rect(c, 0, 76, W, 44, '#bdb4a2');
    for (let y = 80, row = 0; y < STAGE_B; y += 8, row++) {
      rect(c, 0, y, W, 1, '#a39a88');
      for (let x = (row % 2) * 12; x < W; x += 24) rect(c, x, y + 1, 1, 7, '#a39a88');
    }
    rect(c, 0, 76, W, 2, '#8a8270');
    actor('mc', null, 24, 70, { kind: 'mc', dir: 'right' });
    actor('player', null, 132, 70, { kind: 'player' });
    actor('g0', LOOKS.oldwoman, 226, 70, { dir: 'left', kw: /./ });
    S.visitor = { x: 226, y: 70, dir: 'left', layer: 2, replace: 'g0' };
    S.handMic = true;
    S.board = { x: 212, y: 20, w: 104, h: 18, style: 'corner' };
    S.meter = { x: 4, y: 18 };
    S.pop = { x: 112, y: 36 };
  } else if (key === 'radio') {
    vgrad(c, 0, 16, W, 70, '#2a2f48', '#1c2032');
    for (let y = 20; y < 84; y += 22) {
      for (let x = 112 + ((y / 22) % 2) * 14; x < W; x += 30) {
        rect(c, x, y, 26, 18, '#30364f');
        for (let yy = y + 3; yy < y + 16; yy += 3) for (let xx = x + 3; xx < x + 24; xx += 3) rect(c, xx, yy, 1, 1, '#454c6c');
      }
    }
    // control-room window
    rect(c, 4, 20, 104, 50, '#5a6078');
    rect(c, 6, 22, 100, 46, '#18303e');
    const staff = charSheet(LOOKS.ad);
    drawChar(c, staff, 'down', 0, 46, 36);
    rect(c, 6, 54, 100, 14, '#2a2d36');
    rect(c, 6, 54, 100, 1, '#4a4e5a');
    for (let x = 10; x < 104; x += 6) { rect(c, x, 58, 3, 2, x % 12 ? '#5ee07a' : '#ffd23f'); rect(c, x + 1, 62, 1, 4, '#9aa3c7'); }
    c.globalAlpha = 0.18;
    for (let i = 0; i < 3; i++) fillPoly(c, [[20 + i * 30, 22], [30 + i * 30, 22], [10 + i * 30, 68], [0 + i * 30, 68]], '#ffffff');
    c.globalAlpha = 1;
    // clock
    fillEllipse(c, 226, 27, 7, 7, '#e8e8f0');
    fillEllipse(c, 226, 27, 6, 6, '#ffffff');
    rect(c, 226, 22, 1, 6, INK);
    rect(c, 226, 27, 4, 1, INK);
    // desk
    rect(c1, 0, 76, W, 2, '#c09a6a');
    rect(c1, 0, 78, W, 6, '#8a6a4a');
    rect(c1, 0, 84, W, 36, '#4a3426');
    for (let x = 40; x < W; x += 80) rect(c1, x, 86, 1, 34, '#3a281c');
    rect(c1, 0, 84, W, 1, '#2a1c12');
    // papers + mugs
    rect(c1, 120, 77, 22, 4, '#f2f2f2');
    rect(c1, 124, 76, 18, 1, '#d8d8e0');
    rect(c1, 166, 72, 7, 7, '#ffffff'); rect(c1, 173, 74, 2, 3, '#ffffff'); rect(c1, 167, 73, 5, 1, '#8a4a2a');
    // mic arms
    for (const [mx, side] of [[96, 1], [204, -1]]) {
      rect(c1, mx, 64, 2, 14, '#7a808c');
      rect(c1, mx - 2 * side, 76, 6, 2, '#3a3d48');
      rect(c1, mx - 2, 52, 6, 12, INK);
      rect(c1, mx - 1, 53, 4, 10, '#8a909c');
      for (let y = 54; y < 62; y += 2) rect(c1, mx - 1, y, 4, 1, '#5a5f6b');
      rect(c1, mx, 53, 1, 3, '#ffffff');
    }
    actor('mc', null, 52, 46, { kind: 'mc', dir: 'right', layer: 0 });
    actor('player', null, 214, 46, { kind: 'player', dir: 'left', layer: 0 });
    S.visitor = { x: 136, y: 46, dir: 'down', layer: 0 };
    S.board = { x: 74, y: 94, w: 124, h: 18, style: 'plate' };
    S.meter = { x: 252, y: 18 };
    S.plate = { x: 230, y: 96 };
    S.headphones = true;
    S.onair = { x: 136, y: 19, w: 56, h: 14 };
    S.pop = { x: 156, y: 38 };
  } else if (key === 'news') {
    vgrad(c, 0, 16, W, 70, '#0c3270', '#1b5cb0');
    // skyline window
    rect(c, 0, 22, W, 52, '#9ad4f4');
    vgrad(c, 0, 22, W, 52, '#bfe6fb', '#8ccaf0');
    let bx = 0;
    while (bx < W) {
      const bw = 12 + Math.floor(r() * 18), bh = 14 + Math.floor(r() * 30);
      rect(c, bx, 74 - bh, bw, bh, r() < 0.5 ? '#6a9ac8' : '#5a88b8');
      for (let wy = 74 - bh + 3; wy < 72; wy += 5) for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) rect(c, wx, wy, 2, 2, '#d8f0ff');
      bx += bw + 2;
    }
    for (let x = 0; x < W; x += 40) rect(c, x, 22, 2, 52, '#e8f2ff');
    rect(c, 0, 20, W, 2, '#e8f2ff');
    rect(c, 0, 74, W, 2, '#e8f2ff');
    rect(c, 0, 76, W, 10, '#123a7a');
    // desk
    rect(c1, 0, 80, W, 7, '#f2f4f8');
    rect(c1, 0, 80, W, 1, '#ffffff');
    rect(c1, 0, 87, W, 33, '#1f4f9a');
    rect(c1, 0, 87, W, 1, '#0a2a5a');
    rect(c1, 0, 98, W, 3, '#ff8a3d');
    rect(c1, 0, 101, W, 1, '#b85a1a');
    for (let x = 8; x < W; x += 16) rect(c1, x, 108, 8, 2, '#2f6fd0');
    actor('mc', NEWS_MC, 30, 48, { kind: 'mc', dir: 'right', layer: 0 });
    actor('player', null, 144, 48, { kind: 'player', layer: 0 });
    actor('g0', COMMENTATOR, 254, 48, { dir: 'left', layer: 0, kw: /./ });
    S.visitor = { x: 254, y: 48, dir: 'left', layer: 0, replace: 'g0' };
    S.monitor = { x: 82, y: 22, w: 56, h: 36 };
    S.board = { x: 4, y: 20, w: 70, h: 22, style: 'news' };
    S.meter = { x: 184, y: 18 };
    S.plate = { x: 160, y: 90 };
    S.pop = { x: 106, y: 66 };
  } else if (key === 'drama') {
    vgrad(c, 0, 16, W, 58, '#f6e6c8', '#e6cfa6');
    for (let x = 4; x < W; x += 10) rect(c, x, 16, 2, 58, 'rgba(160,110,60,0.08)');
    rect(c, 0, 72, W, 16, '#8a5a3a');
    rect(c, 0, 72, W, 2, '#b07a50');
    for (let x = 6; x < W; x += 26) rect(c, x, 76, 20, 9, '#7a4c30');
    vgrad(c, 0, 88, W, 32, '#8a2a3a', '#5a1a28');
    for (let y = 92; y < STAGE_B; y += 8) for (let x = (y % 16) ? 0 : 8; x < W; x += 16) rect(c, x + 3, y, 2, 2, '#a43a4a');
    // drama poster
    rect(c, 88, 20, 74, 54, '#3a2412');
    vgrad(c, 90, 22, 70, 50, '#ffcf7a', '#ff7e8a');
    fillEllipse(c, 125, 56, 10, 10, '#fff2b0');
    for (let i = 0; i < 6; i++) rect(c, 92 + i * 11, 54 + (i % 2) * 4, 10, 18 - (i % 2) * 4, '#6a2a4a');
    for (let i = 0; i < 6; i++) rect(c, 94 + i * 11, 60 + (i % 2) * 4, 3, 3, '#ffe9a0');
    rect(c, 90, 22, 70, 1, '#ffffff');
    S.poster = { x: 125, y: 24 };
    // flowers
    rect(c, 70, 64, 10, 24, '#e8e0d0');
    rect(c, 68, 62, 14, 3, '#f6f0e4');
    rect(c, 73, 52, 4, 10, '#5a8a5a');
    for (const [fx, fy, col] of [[70, 50, '#ff7eb6'], [78, 48, '#ffd23f'], [74, 44, '#ff5d6c'], [66, 46, '#ffffff'], [82, 53, '#ff7eb6']]) fillEllipse(c, fx, fy, 3, 3, col);
    // floor lamp
    rect(c, 304, 34, 2, 54, '#5a4a3a');
    fillPoly(c, [[296, 34], [314, 34], [310, 22], [300, 22]], '#fff2c8');
    // MC armchair + sofa backs
    rect(c, 14, 56, 46, 30, '#2f6b5a');
    rect(c, 14, 56, 46, 2, '#4a9a80');
    rect(c, 164, 60, 132, 26, '#c0702a');
    rect(c, 164, 60, 132, 2, '#e09a50');
    for (let x = 176; x < 296; x += 30) rect(c, x, 64, 1, 20, '#a05a20');
    rect(c1, 10, 82, 54, 24, '#2f6b5a');
    rect(c1, 10, 82, 54, 2, '#4a9a80');
    rect(c1, 8, 70, 8, 36, '#24584a');
    rect(c1, 58, 70, 8, 36, '#24584a');
    rect(c1, 160, 82, 140, 24, '#c0702a');
    rect(c1, 160, 82, 140, 2, '#e09a50');
    rect(c1, 156, 68, 10, 38, '#a05a20');
    rect(c1, 294, 68, 10, 38, '#a05a20');
    // low table with tea
    rect(c1, 94, 98, 56, 4, '#6a4024');
    rect(c1, 94, 97, 56, 1, '#8a5a32');
    rect(c1, 98, 102, 3, 14, '#4a2a14');
    rect(c1, 143, 102, 3, 14, '#4a2a14');
    for (const tx of [108, 130]) { rect(c1, tx, 92, 7, 5, '#ffffff'); rect(c1, tx + 1, 92, 5, 1, '#5a8a3a'); rect(c1, tx + 7, 93, 2, 2, '#ffffff'); }
    actor('mc', null, 22, 54, { kind: 'mc', dir: 'right', layer: 0 });
    actor('player', null, 176, 52, { kind: 'player', layer: 0 });
    actor('g0', LOOKS.actor, 240, 52, { layer: 0, kw: /./ });
    S.visitor = { x: 240, y: 52, dir: 'down', layer: 0, replace: 'g0' };
    S.board = { x: 196, y: 20, w: 102, h: 18, style: 'salon' };
    S.meter = { x: 4, y: 18 };
    S.pop = { x: 126, y: 76 };
  } else {
    // room: audition / lesson studio with a mirror wall and the judges' table
    vgrad(c, 0, 16, W, 70, '#eee6d6', '#d6cab4');
    rect(c, 148, 22, 172, 58, '#8a93a0');
    vgrad(c, 150, 24, 170, 54, '#d8eef8', '#a4cbe0');
    c.globalAlpha = 0.5;
    for (const sx of [170, 230, 286]) fillPoly(c, [[sx, 24], [sx + 8, 24], [sx - 18, 78], [sx - 26, 78]], '#ffffff');
    c.globalAlpha = 1;
    rect(c, 148, 60, 172, 3, '#a07040');
    rect(c, 148, 60, 172, 1, '#c8955a');
    for (const bx of [160, 240, 310]) rect(c, bx, 63, 2, 6, '#7a5030');
    rect(c, 0, 80, W, 4, '#8a7a60');
    for (let y = 84, row = 0; y < STAGE_B; y += 6, row++) {
      rect(c, 0, y, W, 6, row % 2 ? '#c08c52' : '#c8955a');
      rect(c, 0, y, W, 1, '#a87840');
      for (let x = (row * 47) % 80; x < W; x += 80) rect(c, x, y, 1, 6, '#a87840');
    }
    // tape mark where the player stands
    rect(c, 222, 108, 20, 2, '#ffd23f');
    rect(c, 231, 104, 2, 10, '#ffd23f');
    // judges' table
    rect(c1, 0, 74, 142, 6, '#ffffff');
    rect(c1, 0, 74, 142, 1, '#f8f8ff');
    rect(c1, 0, 80, 142, 28, '#dfe4ee');
    for (let x = 12; x < 142; x += 22) rect(c1, x, 81, 1, 27, '#c4cad8');
    rect(c1, 0, 107, 142, 2, '#aab0c0');
    for (const px of [18, 62, 106]) { rect(c1, px, 73, 14, 4, '#ffffff'); rect(c1, px + 2, 74, 10, 1, '#9aa3c7'); rect(c1, px + 16, 72, 1, 5, INK); }
    actor('j0', JUDGE_W, 4, 42, { dir: 'right', layer: 0, judge: true });
    actor('mc', { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#d62f2f', glasses: true }, 48, 42, { kind: 'mc', dir: 'right', layer: 0 });
    actor('j1', LOOKS.director, 92, 42, { dir: 'right', layer: 0, judge: true });
    actor('player', null, 216, 68, { kind: 'player', dir: 'left' });
    S.visitor = { x: 156, y: 68, dir: 'left', layer: 2 };
    S.board = { x: 8, y: 20, w: 120, h: 16, style: 'paper' };
    S.meter = { x: 252, y: 18 };
    S.pop = { x: 198, y: 38 };
  }
  return S;
}

// ------------------------------------------------------------------ scene helpers
function normAnswer(a, i) {
  if (typeof a === 'string') return { text: a, score: TIER_SCORES[i] ?? 5 };
  if (!a || a.text == null) return null;
  let s = a.score;
  if (typeof s === 'string') s = TIER_NAMES[s] ?? 50;
  if (a.best === true) s = 100;
  if (typeof s !== 'number' || !Number.isFinite(s)) s = 50;
  return { text: String(a.text), score: clamp(s, 0, 100) };
}

function normCustom(sc) {
  if (!sc || sc.prompt == null || !Array.isArray(sc.answers)) return null;
  const answers = sc.answers.slice(0, 4).map(normAnswer).filter(Boolean);
  if (answers.length < 2) return null;
  return { prompt: String(sc.prompt), answers, custom: true, shuffle: sc.shuffle !== false };
}

function fromBuiltin(e) {
  return { prompt: e[0], answers: [1, 2, 3].map((i, k) => ({ text: e[i], score: TIER_SCORES[k] })), custom: false, pos: e[4] || null, shuffle: true };
}

// plain: filler for another list -> skip the scenes that only make sense as an opener / a farewell
function pickBuiltin(topicKey, n, rng, exclude = new Set(), plain = false) {
  if (n <= 0) return [];
  const bank = TOPICS[topicKey].scenes.filter((e) => !exclude.has(e[0]) && !(plain && e[4]));
  const ranked = shuffle(bank, rng).map((e) => ({ e, k: (RECENT.includes(e[0]) ? 2 : 0) + rng() }));
  ranked.sort((a, b) => a.k - b.k);
  const out = [];
  let first = null, last = null;
  for (const { e } of ranked) {
    if (out.length + (first ? 1 : 0) + (last ? 1 : 0) >= n) break;
    if (e[4] === 'first') { if (!first) first = e; continue; }
    if (e[4] === 'last') { if (!last) last = e; continue; }
    out.push(e);
  }
  const list = [...(first ? [first] : []), ...out, ...(last ? [last] : [])].slice(0, n);
  for (const e of list) RECENT.push(e[0]);
  while (RECENT.length > 30) RECENT.shift();
  return list.map(fromBuiltin);
}

// ------------------------------------------------------------------ the minigame
class TalkShow extends Minigame {
  static title = 'トーク番組';
  static howto = ['司会のフリに、最高の返しを選ぼう！', '↑↓で選んで Aで答える', 'ウケるほど「場の空気」が上がる！', '時間切れは シーン…となるので注意'];
  static skill = 'talk';
  static bgm = 'talk_show';

  init() {
    const o = this.opts;
    const d = this.difficulty;
    const st = this.g.state || {};
    this.pname = String(st.name || 'あなた');
    this.playerLook = st.look || LOOKS.player;
    this.mctx = makeCanvas(8, 8)[1];

    // topic, set, show
    const topicStr = typeof o.topic === 'string' ? o.topic.trim() : '';
    this.topicKey = TOPICS[topicStr] ? topicStr : null;
    this.caption = !this.topicKey && topicStr ? topicStr : null;
    const hay = `${topicStr} ${o.title || ''}`;
    let setKey = SETS[o.set] ? o.set : this.topicKey ? TOPICS[this.topicKey].set : null;
    if (!setKey) for (const [re, k] of SET_RULES) if (re.test(hay)) { setKey = k; break; }
    setKey = setKey || 'variety';
    this.lesson = setKey === 'room' && LESSON_RE.test(hay);
    this.meta = { ...SETS[setKey], ...(this.lesson ? LESSON : {}) };
    this.show = String(o.show || this.meta.show);
    this.mcName = String(o.mc || this.meta.mc);
    this.openMsg = this.lesson ? 'レッスン開始！' : setKey === 'room' ? 'まもなく はじまるよ！' : this.caption ? 'まもなく本番！' : '番組がはじまるよ！';
    if (this.caption && setKey !== 'room') {
      // a one-off event (festival stage, mall talk show …), not the weekly show of the set
      this.meta.close = EVENT_CLOSE;
      if (setKey === 'local') {
        if (!o.mc) this.mcName = '司会';
        if (!o.show) {
          const head = this.caption.split(/[：:（(]/)[0].trim();
          this.show = head && measure(this.mctx, head, 10) <= 96 ? head : '特設ステージ';
        }
      }
    }
    this.set = buildSet(setKey, o);
    if (this.lesson) this.set.actors = this.set.actors.filter((a) => a.id !== 'j0' && a.id !== 'j1');
    for (const a of this.set.actors) {
      if (a.kind === 'mc') a.look = o.mcLook || a.look || MC_LOOKS[setKey];
      if (a.kind === 'player') a.look = this.playerLook;
      a.sheet = charSheet(a.look);
      a.phase = Math.floor(this.rng() * 60);
      a.anim = { bounce: 0, amp: 0, sweat: 0, emote: null, sparkle: 0 };
    }
    this.mc = this.set.actors.find((a) => a.kind === 'mc');
    this.me = this.set.actors.find((a) => a.kind === 'player');
    this.visitor = null;

    // scenes
    this.scenes = this.buildScenes(d);
    this.n = this.scenes.length;
    const base = DIFF.time[d - 1];
    const sec = o.time > 0 ? o.time : Math.min(11, this.ease(base, 0.2));
    this.limit = Math.max(90, Math.round(sec * 60));

    // scoring
    this.pts = 0;
    this.air = 0.5;
    this.airShown = 0.5;
    this.marks = [];
    this.combo = 0;
    this.bestCount = 0;
    this.scoreShown = this.projected();
    this.meterV = 0.15;
    this.meterT = 0.15;
    this.crowd = [];
    this.shakeT = 0;
    this.flashT = 0;

    this.crowdAvoid = this.makeCrowdAvoid();
    this.idx = -1;
    this.bubble = null;
    this.talker = null;
    if (this.meta.song && this.meta.song !== TalkShow.bgm) audio.bgm(this.meta.song);
    this.startOpening();
  }

  buildScenes(d) {
    const o = this.opts;
    const custom = Array.isArray(o.scenes) ? o.scenes.map(normCustom).filter(Boolean) : [];
    const fill = this.topicKey || (TOPICS[this.set.key] ? this.set.key : 'variety');
    let list;
    if (custom.length && !o.mc) {
      for (const sc of custom) {
        const m = /^([^「」\s]{1,10})「/.exec(sc.prompt);
        if (m && HOST_RE.test(m[1])) { this.mcName = m[1]; break; }
      }
    }
    if (custom.length) {
      const count = clamp(Math.round(o.count ?? o.rounds ?? custom.length), 1, 12);
      list = custom.slice(0, count);
      if (list.length < count) list = list.concat(pickBuiltin(fill, count - list.length, this.rng, new Set(), true));
    } else {
      const count = clamp(Math.round(o.count ?? o.rounds ?? DIFF.scenes[d - 1]), 1, 12);
      list = pickBuiltin(fill, count, this.rng);
      if (list.length < count) list = list.concat(pickBuiltin('variety', count - list.length, this.rng, new Set(list.map((s) => s.prompt)), true));
    }
    // a farewell scene ('last') always closes the show, even when filler was appended
    const li = list.findIndex((s) => s.pos === 'last');
    if (li >= 0 && li < list.length - 1) list.push(list.splice(li, 1)[0]);
    return list.map((s) => this.prepScene(s));
  }

  prepScene(s) {
    const order = s.shuffle ? shuffle(s.answers.map((_, i) => i), this.rng) : s.answers.map((_, i) => i);
    const answers = order.map((i) => ({ ...s.answers[i], text: this.fill(s.answers[i].text) }));
    const max = Math.max(1, ...answers.map((a) => a.score));
    const best = answers.map((a, i) => (a.score >= max ? i : -1)).filter((i) => i >= 0);
    return { ...this.parseSpeaker(s), answers, max, best };
  }

  fill(str) {
    return String(str).replace(/\{name\}/g, this.pname).replace(/\{show\}/g, this.show);
  }

  // '名前「セリフ」' -> who says it. Returns { name, body, who: 'mc' | 'narr' | actorId | 'visitor', look }
  parseSpeaker(s) {
    const prompt = this.fill(s.prompt).trim();
    const m = /^([^「」\s]{1,10})「([^]*)」$/.exec(prompt);
    if (!m) return { name: s.custom ? null : this.mcName, body: prompt, who: s.custom ? 'narr' : 'mc' };
    const name = m[1], body = m[2];
    if (HOST_RE.test(name)) return { name, body, who: 'mc' };
    if (READ_RE.test(name)) return { name, body, who: 'mc' };
    if (PARTICLE_RE.test(name)) return { name: null, body: prompt, who: 'narr' };
    if (GUEST_RE.test(name)) {
      const guests = this.set.actors.filter((a) => a.kind === 'guest' && !a.judge);
      const g = guests.find((a) => a.kw && a.kw.test(name)) || guests[0];
      if (g) return { name, body, who: g.id };
    }
    for (const [re, look] of SPEAKER_LOOKS) if (re.test(name)) return { name, body, who: 'visitor', look };
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { name, body, who: 'visitor', look: PASSERBY_LOOKS[h % PASSERBY_LOOKS.length] };
  }

  actorById(id) {
    if (id === 'visitor') return this.visitor;
    return this.set.actors.find((a) => a.id === id) || null;
  }

  // the mood part counts in proportion to the scenes played, so this starts at 0 and ends at the final score
  projected() {
    const n = Math.max(1, this.n);
    const played = this.marks.filter(Boolean).length;
    return 100 * (0.85 * (this.pts / n) + 0.15 * this.air * (played / n));
  }

  // ---------------------------------------------------------------- bubbles
  say(who, str, { name, speed = 1 } = {}) {
    const actorRef = who === 'narr' ? null : who === 'player' ? this.me : this.actorById(who) || this.mc;
    const narr = who === 'narr';
    const maxW = narr ? 276 : 280;
    const lines = [];
    for (const l of wrap(this.mctx, this.fill(str), maxW, 12)) if (l !== '' || lines.length) lines.push(l);
    if (!lines.length) lines.push('');
    lines.splice(3);
    const total = lines.reduce((k, l) => k + Array.from(l).length, 0);
    let tabName = name;
    if (tabName === undefined) tabName = who === 'player' ? this.pname : who === 'narr' ? null : this.mcName;
    this.bubble = { narr, lines, target: actorRef, name: tabName, n: 0, total, speed, player: who === 'player' };
    this.talker = narr ? null : actorRef;
  }

  // ---------------------------------------------------------------- flow
  setState(s) { this.state = s; this.st = 0; }

  startOpening() {
    this.openSteps = [];
    if (this.caption) this.openSteps.push({ who: 'narr', text: this.caption });
    const greet = this.caption
      ? (this.set.key === 'room' ? this.meta.open : 'それでは{name}さん！\nよろしくお願いします！')
      : this.meta.open;
    this.openSteps.push({ who: 'mc', text: greet });
    this.openStep = 0;
    this.setState('opening');
    this.say(this.openSteps[0].who, this.openSteps[0].text);
    this.g.sfx('applause');
    tones(SND.show);
    this.meterT = 0.6;
    this.cheer(0.6, 30);
  }

  nextScene() {
    this.idx++;
    this.bubble = null;
    this.talker = null;
    this.choice = -1;
    if (this.visitor) { this.unhideReplaced(); this.visitor = null; }
    if (this.idx >= this.n) { this.startClosing(); return; }
    this.cur = this.scenes[this.idx];
    this.sel = 0;
    this.left = this.limit;
    this.lockLeft = this.limit;
    this.answerAt = 0;
    this.setState('cue');
    tones(SND.cue);
    if (this.cur.who === 'visitor') this.enterVisitor(this.cur.look);
  }

  enterVisitor(look) {
    const v = this.set.visitor;
    this.visitor = { id: 'visitor', kind: 'visitor', look, sheet: charSheet(look), x: v.x, y: v.y, dir: v.dir, layer: v.layer, phase: 0, appear: 0, anim: { bounce: 0, amp: 0, sweat: 0, emote: null, sparkle: 0 } };
    if (v.replace) { const a = this.actorById(v.replace); if (a) a.hidden = true; }
  }

  unhideReplaced() {
    const v = this.set.visitor;
    if (v && v.replace) { const a = this.actorById(v.replace); if (a) a.hidden = false; }
  }

  updatePlay(inp) {
    if (!this.scenes) return;
    this.st++;
    this.tickFx();
    const b = this.bubble;
    if (b && b.n < b.total) {
      const before = Math.floor(b.n);
      b.n = Math.min(b.total, b.n + b.speed);
      if (Math.floor(b.n) > before && Math.floor(b.n) % 2 === 1) this.voice(this.talker);
    }

    switch (this.state) {
      case 'opening': {
        const done = b && b.n >= b.total;
        if ((this.st > 20 && inp.pressed('a')) || (done && this.st >= 50 + b.total)) {
          if (b && b.n < b.total) { b.n = b.total; break; }
          this.openStep++;
          if (this.openStep < this.openSteps.length) {
            this.say(this.openSteps[this.openStep].who, this.openSteps[this.openStep].text);
            this.st = 0;
            if (this.openSteps[this.openStep].who === 'mc') this.me.anim.emote = { ch: '♪', t: 0 };
          } else {
            this.nextScene();
          }
        }
        break;
      }
      case 'cue':
        if (this.visitor && this.visitor.appear < 1) this.visitor.appear = Math.min(1, this.visitor.appear + 0.1);
        if (this.st >= CUE_F) {
          const c = this.cur;
          if (c.who === 'narr') this.say('narr', c.body, { speed: 0.6 });
          else this.say(c.who === 'mc' ? 'mc' : c.who, c.body, { name: c.name || this.mcName, speed: 0.6 });
          this.setState('type');
        }
        break;
      case 'type':
        if (this.visitor && this.visitor.appear < 1) this.visitor.appear = Math.min(1, this.visitor.appear + 0.1);
        if (b && b.n < b.total && this.st > 4 && inp.pressed('a')) b.n = b.total;
        if (!b || b.n >= b.total) {
          this.talker = null;
          this.setState('answer');
          this.answerAt = this.pt;
          this.g.sfx('cursor');
        }
        break;
      case 'answer':
        this.updateAnswer(inp);
        break;
      case 'react':
        this.updateReact(inp);
        break;
      case 'closing':
        if (this.st === 40) this.g.sfx('applause');
        if (this.st === 90) this.g.sfx('applause');
        if ((this.st > 70 && inp.pressed('a')) || this.st >= CLOSE_F) {
          this.setState('done');
          this.end(this.finalScore(), this.comment());
        }
        break;
      default:
        break;
    }
  }

  updateAnswer(inp) {
    const nA = this.cur.answers.length;
    if (inp.pressed('up') || inp.pressed('left')) { this.sel = (this.sel + nA - 1) % nA; this.g.sfx('cursor'); }
    if (inp.pressed('down') || inp.pressed('right')) { this.sel = (this.sel + 1) % nA; this.g.sfx('cursor'); }
    if (inp.pressed('a') && this.st > LOCK_F) {
      this.g.sfx('ok');
      this.choose(this.sel);
      return;
    }
    this.left--;
    if (this.left > 0 && this.left <= 180 && this.left % 60 === 0) tones(this.left <= 60 ? SND.tick2 : SND.tick);
    if (this.left <= 0) { this.left = 0; this.choose(-1); }
  }

  // i = answer index, -1 = time out
  choose(i) {
    const c = this.cur;
    this.choice = i;
    this.lockLeft = this.left;
    let grade, pts = 0;
    if (i < 0) {
      grade = 'time';
    } else {
      const frac = c.answers[i].score / c.max;
      grade = frac >= 0.85 ? 'best' : frac >= 0.55 ? 'good' : frac >= 0.3 ? 'ok' : 'bad';
      const speed = clamp(this.left / this.limit / 0.5, 0, 1);
      pts = frac * (0.9 + 0.1 * speed);
    }
    this.grade = grade;
    this.pts += pts;
    this.air = clamp(this.air + AIR[grade], 0, 1);
    this.marks[this.idx] = grade;
    if (grade === 'best') { this.combo++; this.bestCount++; } else this.combo = 0;
    this.setState('react');
    if (i < 0) {
      this.say('player', '……えっと……', { speed: 0.5 });
      this.me.anim.sweat = 90;
    } else {
      this.say('player', c.answers[i].text);
    }
  }

  updateReact(inp) {
    const g = this.grade;
    const hitAt = g === 'time' ? 14 : 22;
    if (this.st === hitAt) this.audienceReacts(g);
    if (this.st === (g === 'time' ? 44 : 54)) {
      const pool = (this.meta.react && this.meta.react[g]) || REACT[g];
      const host = this.cur.who === 'mc' && this.cur.name && HOST_RE.test(this.cur.name) ? this.cur.name : this.mcName;
      this.say('mc', pickFrom(pool, this.rng), { name: host });
      if (g === 'best') this.mc.anim.emote = { ch: '！', t: 0 };
      if (g === 'bad') this.mc.anim.sweat = 60;
      if (g === 'time') this.mc.anim.emote = { ch: '…', t: 0 };
    }
    if ((this.st >= REACT_MIN && inp.pressed('a')) || this.st >= (g === 'time' ? REACT_MAX - 30 : REACT_MAX)) this.nextScene();
  }

  audienceReacts(g) {
    const guests = this.set.actors.filter((a) => a.kind === 'guest' && !a.hidden).concat(this.visitor ? [this.visitor] : []);
    this.meterT = METER[g];
    const { x: px, y: py } = this.set.pop || { x: 160, y: 58 };
    if (g === 'best') {
      this.g.sfx('laugh');
      tones(SND.best);
      setTimeout(() => this.phase === 'play' && this.g.sfx('applause'), 350);
      this.cheer(1, 56);
      this.mc.anim.bounce = 40; this.mc.anim.amp = 3;
      this.me.anim.sparkle = 50;
      this.flashT = 8;
      this.shakeT = 6;
      this.popup('ナイス返し！', px, py, COLORS.accent, 16);
      if (this.combo >= 2) this.popup(`${this.combo}連続ナイス！`, px, py + 20, COLORS.pink, 10);
    } else if (g === 'good') {
      this.g.sfx('laugh');
      this.cheer(0.7, 34);
      this.popup('いいね！', px, py, COLORS.good, 14);
    } else if (g === 'ok') {
      this.g.sfx('good');
      this.clap();
      for (const a of guests) { a.anim.bounce = 10; a.anim.amp = 1; }
      this.popup('まずまず', px, py, COLORS.cyan, 12);
    } else if (g === 'bad') {
      this.murmur();
      for (const a of guests) a.anim.sweat = 70;
      this.me.anim.sweat = 70;
      this.shakeT = 4;
      this.popup('スベった…', px, py, COLORS.bad, 14);
    } else {
      this.g.sfx('buzz');
      for (const a of guests) a.anim.emote = { ch: '…', t: 0 };
      this.popup('時間切れ…', px, py, COLORS.dim, 12);
    }
    this.spawnCrowd(g, g === 'best' ? 6 : g === 'good' ? 4 : g === 'time' ? 1 : 3);
  }

  cheer(level, frames) {
    const guests = this.set.actors.filter((a) => a.kind === 'guest' && !a.hidden).concat(this.visitor ? [this.visitor] : []);
    for (const a of guests) { a.anim.bounce = frames; a.anim.amp = level >= 0.9 ? 3 : 2; }
    this.laughT = frames;
    this.laughLv = level;
  }

  startClosing() {
    this.setState('closing');
    const good = this.projected() >= 70;
    this.say('mc', this.meta.close[good ? 0 : 1]);
    this.meterT = Math.max(0.5, this.air);
    this.cheer(0.8, 70);
    this.mc.anim.bounce = 50; this.mc.anim.amp = 2;
    this.me.anim.bounce = 50; this.me.anim.amp = 2;
    if (good) this.me.anim.sparkle = 70;
    this.g.sfx('applause');
  }

  finalScore() { return clamp(Math.round(this.projected()), 0, 100); }

  comment() {
    const s = this.finalScore();
    let line;
    if (s >= 90) line = 'トーク冴えわたる！最高の空気！';
    else if (s >= 75) line = 'ナイストーク！空気をつかんだ！';
    else if (s >= 55) line = 'まずまず！もっと場を読んでみよう';
    else if (s >= 35) line = '空回り気味…相手の話をよく聞こう';
    else line = 'シーン…。基本からやり直しだ';
    return `ナイス返し ${this.bestCount}/${this.n}\n${line}`;
  }

  // ---------------------------------------------------------------- effects / sound
  tickFx() {
    if (this.shakeT > 0) this.shakeT--;
    if (this.flashT > 0) this.flashT--;
    if (this.laughT > 0) this.laughT--;
    this.meterT = Math.max(0.12, this.meterT - 0.0035);
    this.meterV += (this.meterT - this.meterV) * 0.14;
    this.airShown += (this.air - this.airShown) * 0.1;
    this.scoreShown += (this.projected() - this.scoreShown) * 0.12;
    const all = this.set.actors.concat(this.visitor ? [this.visitor] : []);
    for (const a of all) {
      const an = a.anim;
      if (an.bounce > 0) an.bounce--;
      if (an.sweat > 0) an.sweat--;
      if (an.sparkle > 0) an.sparkle--;
      if (an.emote && ++an.emote.t > 70) an.emote = null;
    }
    for (const c of this.crowd) c.t++;
    this.crowd = this.crowd.filter((c) => c.t < 50);
    if (this.laughT > 0 && this.laughLv > 0.5 && this.st % 9 === 0) this.spawnCrowd(this.laughLv >= 0.9 ? 'best' : 'good', 1);
  }

  spawnCrowd(g, n) {
    const words = CROWD[this.meta.crowd || 'studio'][g] || ['…'];
    if (this.set.key === 'room') {
      // only a few judges: one or two quiet reactions on the table front, under whoever is there
      if (this.crowd.some((c) => c.t < 30)) return;
      const judges = this.set.actors.filter((a) => a.judge || a.kind === 'mc');
      const k = Math.min(n, g === 'best' ? 2 : 1, judges.length);
      const seats = shuffle(judges, this.rng).slice(0, k);
      shuffle(words, this.rng).slice(0, k).forEach((str, i) => this.crowd.push({ str, x: seats[i].x + 16, y: 90, t: -i * 8, g }));
      return;
    }
    const y0 = this.set.crowdY || 104;
    for (let i = 0; i < n; i++) {
      const str = pickFrom(words, this.rng);
      const w = Math.ceil(measure(this.mctx, str, 10)) + 6;
      for (let tries = 0; tries < 12; tries++) {
        const x = Math.round(4 + w / 2 + this.rng() * (W - 8 - w));
        const y = y0 + Math.round(this.rng() * 8);
        // the text floats up ~25px while it fades: reserve that whole column
        const box = { x0: x - w / 2, x1: x + w / 2, y0: y - 26, y1: y + 12 };
        const hit = (r) => r.x0 < box.x1 && box.x0 < r.x1 && r.y0 < box.y1 && box.y0 < r.y1;
        if (this.crowd.some((c) => c.box && c.t < 40 && hit(c.box)) || this.crowdAvoid.some(hit)) continue;
        this.crowd.push({ str, x, y, box, t: -Math.floor(this.rng() * 10), g });
        break;
      }
    }
  }

  // stage labels the crowd texts must not cover (name plate, show board)
  makeCrowdAvoid() {
    const S = this.set, out = [];
    if (S.plate) {
      const w = this.plateW();
      out.push({ x0: S.plate.x - w / 2 - 2, x1: S.plate.x + w / 2 + 2, y0: S.plate.y - 2, y1: S.plate.y + 15 });
    }
    if (S.board) out.push({ x0: S.board.x - 2, x1: S.board.x + S.board.w + 2, y0: S.board.y - 2, y1: S.board.y + S.board.h + 2 });
    return out;
  }

  plateName() { return Array.from(this.pname).slice(0, 6).join(''); }
  plateW() { return Math.max(34, Math.ceil(measure(this.mctx, this.plateName(), 10)) + 10); }

  voice(actor) {
    if (!actor || !audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    let f = 330;
    if (actor.kind === 'player') f = 700;
    else if (actor.kind === 'visitor' || actor.kind === 'guest') f = 520;
    audio.tone(f + this.rng() * 80, t, 0.035, { wave: 'square', vol: 0.03 });
  }

  murmur() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.01;
    for (let i = 0; i < 12; i++) audio.noise(t + i * 0.06 + this.rng() * 0.05, 0.14, { vol: 0.035, filter: 'bandpass', freq: 350 + this.rng() * 300 });
    audio.tone(220, t, 0.35, { wave: 'triangle', vol: 0.06, slideTo: 150 });
  }

  clap() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.01;
    for (let i = 0; i < 10; i++) audio.noise(t + this.rng() * 0.5, 0.04, { vol: 0.05, filter: 'bandpass', freq: 2200 + this.rng() * 1500 });
  }

  // ---------------------------------------------------------------- drawing
  drawPlay(ctx) {
    if (!this.scenes) { this.drawBackground(ctx); return; }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shakeT > 0) ctx.translate(Math.round((this.rng() - 0.5) * this.shakeT * 0.6), 0);
    this.drawStage(ctx);
    ctx.restore();
    this.drawUi(ctx);
  }

  drawStage(ctx) {
    const S = this.set;
    ctx.drawImage(S.bg, 0, 0);
    this.drawDynamicSet(ctx);
    const all = S.actors.concat(this.visitor ? [this.visitor] : []);
    for (let layer = 0; layer <= 2; layer++) {
      for (const a of all) if (a.layer === layer) this.drawActor(ctx, a);
      if (layer < 2) ctx.drawImage(S.over[layer], 0, 0);
    }
    // a studio guest with four legs, sitting on the desk
    if (this.cur && this.idx < this.n && /子犬/.test(this.cur.body)) this.drawPuppy(ctx, S.key === 'news' ? 112 : (this.me.x - 18), S.key === 'news' ? 70 : this.me.y + 18);
    if (S.audience) this.drawAudience(ctx);
    for (const a of all) this.drawActorFx(ctx, a);
    if (this.state === 'answer' || this.state === 'type') this.drawYouMarker(ctx);
    if (S.board) this.drawBoard(ctx, S.board);
    this.drawMeter(ctx);
    this.drawCrowd(ctx);
    if (this.state === 'cue') this.drawCue(ctx);
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = (this.flashT / 8) * 0.3;
      rect(ctx, 0, 16, W, STAGE_B - 16, '#ffffff');
      ctx.restore();
    }
  }

  drawDynamicSet(ctx) {
    const S = this.set, t = this.t;
    if (S.onair) {
      const { x, y, w, h } = S.onair;
      const lit = this.state !== 'done';
      roundBox(ctx, x, y, w, h, lit ? '#d62f2f' : '#5a1a20', '#2a0a10');
      if (lit) { ctx.save(); ctx.globalAlpha = 0.15 + 0.08 * Math.sin(t / 10); rect(ctx, x - 4, y - 2, w + 8, h + 4, '#ff5d6c'); ctx.restore(); }
      text(ctx, 'ON AIR', x + w / 2, y + 2, { size: 10, align: 'center', color: lit ? '#ffffff' : '#a05060', shadow: null });
    }
    if (S.monitor) {
      const { x, y, w, h } = S.monitor;
      rect(ctx, x - 2, y - 2, w + 4, h + 4, '#1a1e2a');
      // the weather page follows the talk: a rain forecast shows rain
      const rainy = !!(this.cur && this.idx < this.n && /雨/.test(this.cur.body));
      const page = rainy ? 0 : Math.floor(t / 240) % 2;
      if (rainy) {
        vgrad(ctx, x, y, w, h, '#4a5a78', '#8a9ab8');
        fillEllipse(ctx, x + 22, y + 13, 10, 6, '#d8dce8');
        fillEllipse(ctx, x + 32, y + 10, 8, 6, '#eef0f6');
        fillEllipse(ctx, x + 40, y + 14, 7, 5, '#d8dce8');
        for (let i = 0; i < 7; i++) {
          const ry = y + 20 + ((i * 5 + Math.floor(t / 3)) % 7);
          rect(ctx, x + 14 + i * 5, ry, 1, 3, '#9ad4f4');
        }
        text(ctx, '雨', x + 4, y + 25, { size: 10, color: '#ffffff', shadow: '#1a2a4a' });
        text(ctx, '18℃', x + w - 4, y + 25, { size: 10, align: 'right', color: '#bfe8ff', shadow: '#1a2a4a' });
      } else if (page === 0) {
        vgrad(ctx, x, y, w, h, '#3a8ad8', '#8acaf8');
        fillEllipse(ctx, x + 16, y + 14, 7, 7, '#ffd23f');
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + t / 40;
          rect(ctx, x + 16 + Math.round(Math.cos(a) * 10), y + 14 + Math.round(Math.sin(a) * 10), 2, 2, '#ffe680');
        }
        fillEllipse(ctx, x + 38, y + 17, 9, 5, '#ffffff');
        fillEllipse(ctx, x + 32, y + 15, 6, 5, '#ffffff');
        text(ctx, '晴れ', x + 4, y + 25, { size: 10, color: '#ffffff', shadow: '#1a4a8a' });
        text(ctx, '22℃', x + w - 4, y + 25, { size: 10, align: 'right', color: '#ffe680', shadow: '#1a4a8a' });
      } else {
        rect(ctx, x, y, w, h, '#fbe6ee');
        rect(ctx, x, y + h - 10, w, 10, '#8acf7a');
        rect(ctx, x + 20, y + 12, 3, 16, '#7a4a2a');
        fillEllipse(ctx, x + 21, y + 11, 13, 8, '#ffb0c8');
        for (let i = 0; i < 6; i++) rect(ctx, x + 8 + ((i * 17 + Math.floor(t / 6)) % (w - 14)), y + 4 + ((i * 11 + Math.floor(t / 4)) % 22), 2, 2, '#ff7eb6');
        rect(ctx, x + w - 22, y + 3, 19, 9, '#d62f2f');
        text(ctx, 'LIVE', x + w - 12, y + 3, { size: 10, align: 'center', color: '#ffffff', shadow: null });
      }
      rect(ctx, x, y, w, 1, 'rgba(255,255,255,0.4)');
    }
    if (S.poster) {
      const { x, y } = S.poster;
      const drama = this.topicKey === 'drama';
      text(ctx, drama ? '新ドラマ' : 'ドラマ', x, y, { size: 10, align: 'center', color: '#ffffff', shadow: '#8a3a2a' });
      text(ctx, drama ? 'ひだまり' : 'ついに', x, y + 12, { size: 12, align: 'center', color: '#ffffff', outline: '#8a3a2a' });
      text(ctx, drama ? '商店街' : 'スタート', x, y + 26, { size: 12, align: 'center', color: '#ffffff', outline: '#8a3a2a' });
    }
  }

  drawBoard(ctx, B) {
    const t = this.t;
    const { x, y, w, h } = B;
    const fs = fitSize(ctx, this.show, w - 10);
    if (B.style === 'marquee') {
      rect(ctx, x + 2, y + 2, w, h, '#0a0618');
      rect(ctx, x, y, w, h, '#ffd23f');
      rect(ctx, x + 3, y + 3, w - 6, h - 6, '#2a0f4a');
      let k = 0;
      const bulb = (bx, by) => { rect(ctx, bx, by, 2, 2, (k++ + Math.floor(t / 5)) % 3 === 0 ? '#ffffff' : '#b8801a'); };
      for (let bx = x + 2; bx <= x + w - 4; bx += 6) bulb(bx, y);
      for (let by = y + 6; by <= y + h - 4; by += 6) bulb(x + w - 2, by);
      for (let bx = x + w - 4; bx >= x + 2; bx -= 6) bulb(bx, y + h - 2);
      for (let by = y + h - 6; by >= y + 4; by -= 6) bulb(x, by);
      const lines = fs === 12 || measure(ctx, this.show, 10) <= w - 10 ? [this.show] : wrap(ctx, this.show, w - 10, 10).slice(0, 2);
      const size = lines.length > 1 ? 10 : fs;
      const y0 = y + Math.round((h - lines.length * (size + 1)) / 2);
      lines.forEach((l, i) => text(ctx, l, x + w / 2, y0 + i * (size + 1), { size, align: 'center', color: COLORS.accent, outline: '#5a1a00' }));
    } else if (B.style === 'corner') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      roundBox(ctx, x, y, w, h, '#ffffff', '#ff8a3d');
      ctx.restore();
      const size = fitSize(ctx, this.show, w - 8);
      text(ctx, this.show, x + w / 2, y + Math.round((h - size) / 2), { size, align: 'center', color: '#e8582a', shadow: null });
    } else if (B.style === 'plate') {
      roundBox(ctx, x, y, w, h, '#141828', '#5fd7ff');
      const size = fitSize(ctx, this.show, w - 8);
      const glow = Math.floor(t / 30) % 2 ? '#bff0ff' : '#5fd7ff';
      text(ctx, this.show, x + w / 2, y + Math.round((h - size) / 2), { size, align: 'center', color: glow, shadow: null });
    } else if (B.style === 'news') {
      rect(ctx, x + 1, y + 1, w, h, '#0a2a5a');
      rect(ctx, x, y, w, h, '#ffffff');
      rect(ctx, x, y + h - 4, w, 4, '#ff8a3d');
      const size = fitSize(ctx, this.show, w - 6);
      text(ctx, this.show, x + w / 2, y + Math.round((h - 4 - size) / 2), { size, align: 'center', color: '#e8582a', shadow: null });
      const mm = 15 + (Math.floor(this.pt / 600) % 40);
      roundBox(ctx, x, y + h + 2, 34, 13, '#0a2a5a', '#0a2a5a');
      text(ctx, `7:${String(mm).padStart(2, '0')}`, x + 17, y + h + 3, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    } else if (B.style === 'salon') {
      roundBox(ctx, x, y, w, h, '#6a4024', '#3a2412');
      rect(ctx, x + 3, y + 2, w - 6, 1, '#8a5a32');
      const size = fitSize(ctx, this.show, w - 8);
      text(ctx, this.show, x + w / 2, y + Math.round((h - size) / 2), { size, align: 'center', color: '#ffe9b0', shadow: null });
    } else if (B.style === 'paper') {
      rect(ctx, x + 1, y + 1, w, h, 'rgba(0,0,0,0.15)');
      rect(ctx, x, y, w, h, '#ffffff');
      rect(ctx, x + 2, y - 2, 12, 4, 'rgba(255,230,140,0.85)');
      rect(ctx, x + w - 14, y - 2, 12, 4, 'rgba(255,230,140,0.85)');
      const size = fitSize(ctx, this.show, w - 8);
      text(ctx, this.show, x + w / 2, y + Math.round((h - size) / 2), { size, align: 'center', color: '#22202a', shadow: null });
    }
  }

  drawPuppy(ctx, x, y) {
    const wag = Math.floor(this.t / 6) % 2;
    const P = [
      '..oo.......',
      '.obbo......',
      '.obeboooo..',
      'onbbbbbbbo.',
      '.obbbbbbbbo',
      '..oobbbbbo' + (wag ? 'o' : '.'),
      '...obooobo.',
      '...oo..oo..',
    ];
    const col = { o: '#3a2412', b: '#e0a060', e: '#1a1a1a', n: '#1a1a1a' };
    P.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (col[row[i]]) rect(ctx, x + i * 2, y + j * 2, 2, 2, col[row[i]]); });
  }

  drawPlate(ctx, p) {
    const name = this.plateName();
    const w = this.plateW();
    roundBox(ctx, p.x - w / 2, p.y, w, 13, '#ffffff', INK);
    text(ctx, name, p.x, p.y + 1, { size: 10, align: 'center', color: '#c0182c', shadow: null });
  }

  actorPose(a) {
    const an = a.anim;
    let dy = 0;
    if (an.bounce > 0) dy = -Math.round(Math.abs(Math.sin(an.bounce * 0.42)) * an.amp);
    else if (Math.floor((this.t + a.phase) / 34) % 2) dy = 1;
    if (a.kind === 'visitor' && a.appear < 1) dy -= Math.round(Math.sin(a.appear * Math.PI) * 8);
    return { x: Math.round(a.x), y: Math.round(a.y + dy) };
  }

  drawActor(ctx, a) {
    if (a.hidden) return;
    const { x, y } = this.actorPose(a);
    ctx.save();
    if (a.kind === 'visitor' && a.appear < 1) ctx.globalAlpha = clamp(a.appear * 1.5, 0, 1);
    ctx.translate(x, y);
    ctx.scale(2, 2);
    drawChar(ctx, a.sheet, a.dir, 0, 0, 4);
    // mouth while talking
    const talking = this.talker === a && this.bubble && this.bubble.n < this.bubble.total;
    const laughing = a.anim.bounce > 0 && this.laughT > 0 && a.kind !== 'player';
    if ((talking && Math.floor(this.t / 4) % 2 === 0) || laughing) {
      ctx.fillStyle = '#7a2a2a';
      if (a.dir === 'down' || a.dir === 'up') ctx.fillRect(7, 9, 2, laughing ? 1 : 1);
      else ctx.fillRect(a.dir === 'left' ? 3 : 12, 9, 1, 1);
    }
    if (a.kind === 'mc' && this.set.handMic) {
      const mx = a.dir === 'right' ? 12 : a.dir === 'left' ? 2 : 12;
      ctx.fillStyle = INK;
      ctx.fillRect(mx, 10, 3, 3);
      ctx.fillRect(mx + 1, 13, 1, 3);
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(mx + 1, 11, 1, 1);
    }
    if (this.set.headphones && a.kind !== 'visitor') {
      ctx.fillStyle = INK;
      if (a.dir === 'down') { ctx.fillRect(3, 0, 10, 1); ctx.fillRect(2, 1, 1, 4); ctx.fillRect(13, 1, 1, 4); ctx.fillRect(1, 5, 3, 4); ctx.fillRect(12, 5, 3, 4); ctx.fillStyle = '#5a5f6b'; ctx.fillRect(2, 6, 1, 2); ctx.fillRect(13, 6, 1, 2); }
      else {
        const bx = a.dir === 'left' ? 9 : 4;
        ctx.fillRect(4, 0, 8, 1);
        ctx.fillRect(bx + 1, 1, 1, 4);
        ctx.fillRect(bx, 5, 3, 4);
        ctx.fillStyle = '#5a5f6b';
        ctx.fillRect(bx + 1, 6, 1, 2);
      }
    }
    ctx.restore();
  }

  drawActorFx(ctx, a) {
    if (a.hidden) return;
    const { x, y } = this.actorPose(a);
    const an = a.anim;
    if (an.sweat > 0) {
      const sx = x + (a.dir === 'right' ? 4 : 26), sy = y + 6 + Math.floor((90 - an.sweat) / 12) % 3;
      rect(ctx, sx + 1, sy, 2, 1, '#bfe8ff');
      rect(ctx, sx, sy + 1, 4, 3, '#5fb8f0');
      rect(ctx, sx + 1, sy + 4, 2, 1, '#5fb8f0');
      rect(ctx, sx + 1, sy + 1, 1, 2, '#ffffff');
    }
    if (an.sparkle > 0) {
      for (let i = 0; i < 3; i++) {
        const ang = this.t / 8 + i * 2.1;
        sparkle(ctx, x + 16 + Math.cos(ang) * 20, y + 12 + Math.sin(ang) * 10, 2, i % 2 ? '#fff6a8' : '#ffffff');
      }
    }
    if (an.emote && an.emote.t < 60) {
      const ex = x + 22, ey = y - 10 - (an.emote.t < 6 ? 6 - an.emote.t : 0);
      roundBox(ctx, ex, ey, 16, 15, '#ffffff');
      rect(ctx, ex + 3, ey + 14, 3, 2, '#ffffff');
      rect(ctx, ex + 2, ey + 14, 1, 3, INK);
      rect(ctx, ex + 3, ey + 16, 2, 1, INK);
      text(ctx, an.emote.ch, ex + 8, ey + 2, { size: 10, align: 'center', color: an.emote.ch === '！' ? COLORS.bad : '#1a1a28', shadow: null });
    }
  }

  drawYouMarker(ctx) {
    const a = this.me;
    const { x, y } = this.actorPose(a);
    const by = y - 9 + (Math.floor(this.t / 12) % 2);
    const cx = x + 16;
    rect(ctx, cx - 4, by, 9, 2, INK);
    rect(ctx, cx - 3, by + 2, 7, 1, INK);
    rect(ctx, cx - 2, by + 3, 5, 1, INK);
    rect(ctx, cx - 1, by + 4, 3, 1, INK);
    rect(ctx, cx - 3, by, 7, 1, '#ff7eb6');
    rect(ctx, cx - 2, by + 1, 5, 1, '#ff7eb6');
    rect(ctx, cx - 1, by + 2, 3, 1, '#ff7eb6');
  }

  drawAudience(ctx) {
    if (!this.heads) {
      const r = mulberry32(99);
      this.heads = [];
      for (let x = 4; x < W + 10; x += 19) this.heads.push({ x: x + Math.floor(r() * 6), rad: 7 + Math.floor(r() * 2), ph: r() * 6.28, style: Math.floor(r() * 3) });
    }
    const amp = this.laughT > 0 ? this.laughLv : 0;
    for (const h of this.heads) {
      const dy = amp > 0.3 ? -Math.round(Math.abs(Math.sin(this.t * 0.33 + h.ph)) * 3 * amp) : 0;
      const y = 117 + dy;
      fillEllipse(ctx, h.x, y, h.rad, h.rad, '#150f24');
      rect(ctx, h.x - h.rad + 3, y - h.rad, (h.rad - 3) * 2, 1, '#3a3052');
      if (h.style === 1) fillEllipse(ctx, h.x, y - h.rad - 1, 4, 3, '#150f24');
    }
  }

  drawMeter(ctx) {
    const { x, y } = this.set.meter;
    const w = 64, h = 36;
    roundBox(ctx, x, y, w, h, '#141a3c', '#05060f');
    rect(ctx, x + 2, y + 2, w - 4, 1, '#2a3266');
    const v = clamp(this.meterV, 0, 1);
    const hot = v > 0.86 && Math.floor(this.t / 8) % 2 === 0;
    text(ctx, hot ? this.meta.hot : this.meta.meter, x + w / 2, y + 3, { size: 10, align: 'center', color: hot ? COLORS.pink : '#c8cce6', shadow: null });
    const cx = x + w / 2, cy = y + h - 3;
    const SEG = ['#3a7be0', '#3fa0e8', '#5fd7ff', '#5ee07a', '#a8e05a', '#ffd23f', '#ffb03a', '#ff8a3d', '#ff5d8a', '#ff7eb6'];
    for (let i = 0; i < 40; i++) {
      const f = i / 39;
      const seg = Math.min(9, Math.floor(f * 10));
      const lit = f <= v + 0.01;
      const col = lit ? SEG[seg] : shade(SEG[seg], -0.65);
      const a = Math.PI + f * Math.PI;
      for (let rr = 15; rr <= 19; rr++) rect(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.9), 1, 1, col);
    }
    const a = Math.PI + v * Math.PI;
    for (let rr = 0; rr <= 14; rr++) rect(ctx, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr * 0.9), 2, 1, '#ffffff');
    rect(ctx, cx - 2, cy - 1, 5, 3, '#ff5d6c');
  }

  drawCrowd(ctx) {
    for (const c of this.crowd) {
      if (c.t < 0) continue;
      ctx.globalAlpha = clamp(1 - c.t / 50, 0, 1);
      const col = c.g === 'bad' || c.g === 'time' ? '#b8bcd8' : c.g === 'ok' ? '#bff0ff' : '#ffe680';
      text(ctx, c.str, c.x, c.y - c.t * 0.5, { size: 10, align: 'center', color: col, outline: c.g === 'bad' || c.g === 'time' ? '#1a1a2a' : '#3a1a00' });
      ctx.globalAlpha = 1;
    }
  }

  drawCue(ctx) {
    const k = clamp(this.st / 8, 0, 1);
    const out = clamp((this.st - CUE_F + 6) / 6, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.7 * (1 - out);
    rect(ctx, 0, 54, W, 26, '#0a0618');
    ctx.globalAlpha = 1 - out;
    rect(ctx, 0, 54, W, 1, '#ffd23f');
    rect(ctx, 0, 79, W, 1, '#ffd23f');
    const label = this.idx === this.n - 1 && this.n > 1 ? 'ラストトーク！' : `トーク ${this.idx + 1}`;
    const x = Math.round(W + 80 - k * (W / 2 + 80));
    text(ctx, label, x, 59, { size: 16, align: 'center', color: COLORS.accent, outline: '#5a1a00' });
    ctx.restore();
  }

  // ---------------------------------------------------------------- UI (below the stage)
  drawUi(ctx) {
    vgrad(ctx, 0, STAGE_B, W, H - STAGE_B, '#141a44', '#0a0c22', 4);
    rect(ctx, 0, STAGE_B, W, 1, '#3a3060');
    if (this.bubble) this.drawBubble(ctx, this.bubble);
    // name plate after the bubble: the bubble's tail passes behind it instead of cutting through the name
    if (this.set.plate) this.drawPlate(ctx, this.set.plate);
    this.drawAnswers(ctx);
    this.drawHint(ctx);
    this.drawHud(ctx);
  }

  drawBubble(ctx, b) {
    const n = b.lines.length;
    const h = 9 + n * 15;
    const x = 8, w = 304, y = BUB_B - h;
    if (b.narr) {
      rect(ctx, x + 2, y + 2, w, h, '#05060f');
      rect(ctx, x, y, w, h, '#ffd23f');
      vgrad(ctx, x + 2, y + 2, w - 4, h - 4, '#2a1a5a', '#14103a');
      let left = b.n;
      b.lines.forEach((line, i) => {
        if (left <= 0) return;
        const chars = Array.from(line);
        const s = left >= chars.length ? line : chars.slice(0, Math.floor(left)).join('');
        left -= chars.length;
        const lw = measure(ctx, line, 12);
        text(ctx, s, Math.round(160 - lw / 2), y + 5 + i * 15, { size: 12, color: '#fff6c8', outline: '#3a1a00' });
      });
      return;
    }
    // tail toward the speaker
    const tgt = b.target;
    if (tgt && !tgt.hidden) {
      const pose = this.actorPose(tgt);
      const tx = pose.x + 16, ty = pose.y + 26;
      const bx = clamp(tx, x + 14, x + w - 14);
      const len = y + 1 - ty;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const cx = Math.round(bx + (tx - bx) * k);
        const hw = Math.round((1 - k) * 5);
        rect(ctx, cx - hw - 1, y + 1 - i, hw * 2 + 2, 1, INK);
        if (hw > 0) rect(ctx, cx - hw, y + 1 - i, hw * 2, 1, '#ffffff');
      }
    }
    roundBox(ctx, x, y, w, h, b.player ? '#fff4f8' : '#ffffff');
    if (tgt && !tgt.hidden) {
      const pose = this.actorPose(tgt);
      const bx = clamp(pose.x + 16, x + 14, x + w - 14);
      rect(ctx, bx - 5, y, 10, 3, b.player ? '#fff4f8' : '#ffffff');
    }
    if (b.name) {
      const nw = Math.ceil(measure(ctx, b.name, 10)) + 10;
      const tx = b.player ? x + w - 6 - nw : x + 6;
      roundBox(ctx, tx, y - 9, nw, 12, b.player ? '#ff5d8a' : '#ff8a3d');
      text(ctx, b.name, tx + 5, y - 8, { size: 10, color: '#ffffff', shadow: null });
    }
    let left = b.n;
    b.lines.forEach((line, i) => {
      if (left <= 0) return;
      const chars = Array.from(line);
      const s = left >= chars.length ? line : chars.slice(0, Math.floor(left)).join('');
      left -= chars.length;
      text(ctx, s, x + 10, y + 6 + i * 15, { size: 12, color: '#1a1a28', shadow: null });
    });
    if (b.n >= b.total && !b.player && this.state === 'answer' && Math.floor(this.t / 16) % 2 === 0) text(ctx, '？', x + w - 14, y + h - 15, { size: 10, color: COLORS.pink, shadow: null });
  }

  answerLayout(ctx, a) {
    if (!a._size) a._size = measure(ctx, a.text, 12) <= 262 ? 12 : 10;
    return a._size;
  }

  drawAnswers(ctx) {
    const P = PANEL;
    const answering = this.state === 'answer';
    const reacting = this.state === 'react';
    panel(ctx, P.x, P.y, P.w, P.h, reacting ? { edge: GRADE_COL[this.grade] } : {});
    // timer
    let frac = 1;
    if (answering) frac = this.left / this.limit;
    else if (reacting) frac = this.lockLeft / this.limit;
    const tx = P.x + 18, tw = P.w - 46, ty = P.y + 5;
    rect(ctx, P.x + 7, ty, 6, 1, '#ffffff');
    rect(ctx, P.x + 6, ty + 1, 8, 5, '#ffffff');
    rect(ctx, P.x + 7, ty + 1, 6, 5, '#2a2f55');
    rect(ctx, P.x + 9, ty + 2, 1, 2, '#ffffff');
    rect(ctx, P.x + 9, ty + 4, 2, 1, '#ffffff');
    rect(ctx, tx, ty, tw, 6, '#000000');
    rect(ctx, tx + 1, ty + 1, tw - 2, 4, '#262c5a');
    let col = frac > 0.5 ? '#5ee07a' : frac > 0.25 ? '#ffd23f' : '#ff5d6c';
    if (answering && frac <= 0.25 && Math.floor(this.t / 6) % 2 === 0) col = '#ffb0b8';
    const fw = Math.round((tw - 2) * clamp(frac, 0, 1));
    if (fw > 0) rect(ctx, tx + 1, ty + 1, fw, 4, col);
    const secs = Math.ceil((answering ? this.left : reacting ? this.lockLeft : this.limit) / 60);
    text(ctx, String(secs), P.x + P.w - 8, ty - 2, { size: 10, align: 'right', color: frac > 0.25 ? '#ffffff' : COLORS.bad, shadow: null });

    if (!this.cur || !(answering || reacting)) {
      let msg = '相手の話を よく聞こう…';
      if (this.state === 'opening') msg = this.openMsg;
      if (this.state === 'closing' || this.state === 'done') msg = 'おつかれさまでした！';
      text(ctx, msg, 160, P.y + 30, { size: 12, align: 'center', color: COLORS.dim });
      return;
    }
    const c = this.cur;
    const nA = c.answers.length;
    const rowH = nA <= 3 ? 16 : 12;
    const appear = answering ? clamp((this.pt - this.answerAt) / 8, 0, 1) : 1;
    const blink = Math.floor(this.t / 8) % 2 === 0;
    c.answers.forEach((a, i) => {
      const ry = P.y + 13 + i * rowH;
      const off = Math.round((1 - clamp(appear * 1.6 - i * 0.3, 0, 1)) * 40);
      const chosen = reacting && i === this.choice;
      const isBest = c.best.includes(i);
      let txt = '#ffffff';
      if (answering && i === this.sel) {
        rect(ctx, P.x + 4, ry - 1, P.w - 8, rowH, '#2d3f94');
        rect(ctx, P.x + 4, ry - 1, P.w - 8, 1, blink ? '#ffd23f' : '#fff3b0');
        rect(ctx, P.x + 4, ry + rowH - 2, P.w - 8, 1, blink ? '#ffd23f' : '#fff3b0');
        const o = Math.floor(this.t / 8) % 2;
        ctx.fillStyle = COLORS.accent;
        for (let k = 0; k < 4; k++) ctx.fillRect(P.x + 8 + o + k, ry + 3 + k, 1, 7 - k * 2);
      }
      if (reacting) {
        if (chosen) rect(ctx, P.x + 4, ry - 1, P.w - 8, rowH, shade(GRADE_COL[this.grade], -0.55));
        else txt = '#8890b8';
        if (isBest) text(ctx, '◎', P.x + P.w - 10, ry + (rowH > 12 ? 1 : 0), { size: 10, align: 'right', color: COLORS.accent, shadow: null });
        if (chosen) { const o = 0; ctx.fillStyle = GRADE_COL[this.grade]; for (let k = 0; k < 4; k++) ctx.fillRect(P.x + 8 + o + k, ry + 3 + k, 1, 7 - k * 2); }
      }
      const size = rowH < 16 ? 10 : this.answerLayout(ctx, a);
      ctx.save();
      ctx.globalAlpha = answering ? clamp(appear * 1.6 - i * 0.3, 0, 1) : 1;
      text(ctx, a.text, P.x + 18 + off, ry + (size === 12 ? 1 : 2) - (rowH < 16 ? 1 : 0), { size, color: txt, shadow: 'rgba(0,0,0,0.6)' });
      ctx.restore();
    });
  }

  drawHint(ctx) {
    let s = '';
    if (this.state === 'answer') s = '↑↓で選んで Aで答える！';
    else if (this.state === 'type' || this.state === 'cue') s = 'よく聞いて…（Aで早送り）';
    else if (this.state === 'react' && this.st >= REACT_MIN) s = Math.floor(this.t / 20) % 2 === 0 ? 'Aで次へ' : '';
    else if (this.state === 'opening' && this.st > 20) s = 'Aで進む';
    if (s) text(ctx, s, 160, 229, { size: 10, align: 'center', color: '#c8cce6', shadow: null });
  }

  drawHud(ctx) {
    rect(ctx, 0, 0, W, 16, '#0b0d1e');
    rect(ctx, 0, 16, W, 1, '#3a3060');
    const shown = clamp(this.idx + 1, 1, this.n);
    text(ctx, `トーク ${shown}/${this.n}`, 5, 3, { size: 10 });
    // scene lamps
    const per = Math.min(9, Math.floor(72 / this.n));
    const lw = per - 3;
    let lx = 66;
    const blink = Math.floor(this.t / 10) % 2 === 0;
    for (let i = 0; i < this.n; i++) {
      const m = this.marks[i];
      let col = '#3a3060';
      if (m) col = GRADE_COL[m];
      else if (i === this.idx && this.state !== 'closing' && this.state !== 'done') col = blink ? '#ffffff' : '#6a6aa0';
      rect(ctx, lx, 4, lw + 2, 8, '#000000');
      rect(ctx, lx + 1, 5, lw, 6, col);
      if (m === 'best') rect(ctx, lx + 1, 5, 2, 1, '#ffffff');
      lx += per;
    }
    // 場の空気
    const ax = 142;
    text(ctx, '場の空気', ax, 3, { size: 10, color: COLORS.accent });
    this.drawAirFace(ctx, ax + 42, 3);
    const bx = ax + 56, bw = 66;
    const v = clamp(this.airShown, 0, 1);
    rect(ctx, bx, 4, bw, 8, '#000000');
    rect(ctx, bx + 1, 5, bw - 2, 6, '#2a2f55');
    const fw = Math.round((bw - 2) * v);
    const col = v >= 0.7 ? '#ff7eb6' : v >= 0.4 ? '#ffd23f' : '#5fa8ff';
    if (fw > 0) { rect(ctx, bx + 1, 5, fw, 6, col); rect(ctx, bx + 1, 5, fw, 1, 'rgba(255,255,255,0.4)'); }
    text(ctx, `${Math.round(this.scoreShown)}点`, W - 5, 3, { size: 10, align: 'right', color: COLORS.text });
    if (this.combo >= 2 && (this.state === 'react' || this.state === 'cue')) {
      const m = this.set.meter;
      const cx = m.x + 64 > W - 48 ? m.x - 4 : W - 4;
      text(ctx, `${this.combo}連続！`, cx, 19, { size: 10, align: 'right', color: COLORS.pink, outline: '#2a0a1a' });
    }
  }

  drawAirFace(ctx, x, y) {
    const v = this.airShown;
    const face = v >= 0.7 ? '#ff7eb6' : v >= 0.4 ? '#ffd23f' : '#5fa8ff';
    rect(ctx, x + 2, y, 6, 10, INK);
    rect(ctx, x, y + 2, 10, 6, INK);
    rect(ctx, x + 1, y + 1, 8, 8, INK);
    rect(ctx, x + 2, y + 1, 6, 8, face);
    rect(ctx, x + 1, y + 2, 8, 6, face);
    rect(ctx, x + 3, y + 3, 1, 2, INK);
    rect(ctx, x + 6, y + 3, 1, 2, INK);
    if (v >= 0.7) { rect(ctx, x + 3, y + 6, 4, 1, INK); rect(ctx, x + 4, y + 7, 2, 1, INK); }
    else if (v >= 0.4) rect(ctx, x + 3, y + 6, 4, 1, INK);
    else { rect(ctx, x + 4, y + 6, 2, 1, INK); rect(ctx, x + 3, y + 7, 1, 1, INK); rect(ctx, x + 6, y + 7, 1, 1, INK); rect(ctx, x + 8, y + 2, 1, 2, '#bfe8ff'); }
  }
}

// default looks of the host per set (news / room hosts are defined with the set)
const MC_LOOKS = {
  variety: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#ffd23f', bottom: '#2e3140', jacket: true, tie: '#d62f2f' },
  local: { hair: 'cap', hat: '#2f9a4a', hairColor: 'black', skin: 'tan', top: '#ff8a3d', bottom: '#3a4a7a' },
  radio: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#8a5ac8', bottom: '#2a2430', glasses: true },
  news: NEWS_MC,
  drama: { hair: 'long', hairColor: 'black', skin: 'light', top: '#c0452f', bottom: '#2a2430', skirt: true, jacket: true },
  room: LOOKS.president,
};

export const TALK_CONTENT = { TOPICS, SETS };

registerMinigame('talk', TalkShow);
