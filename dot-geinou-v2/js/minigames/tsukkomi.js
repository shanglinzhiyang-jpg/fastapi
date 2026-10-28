// ツッコミ漫才 — hit A right after your partner's ボケ, let normal lines (フリ) pass.
//
// opts:
//   lines:  [{ boke: 'セリフ', punch: true|false, tsukkomi?: 'ツッコミ' }]  custom script (played in order)
//   rounds: number of lines (default 6..10 by difficulty; custom lines are topped up from the built-in pool;
//           at least 3 lines are always played)
//   partner: partner's display name (default '相方'), partnerLook: sprite look for the partner
//   dialect: 'kansai' | 'std' for the partner's reactions and the closing line (default: Kansai-ben,
//            or standard Japanese when a custom script's ツッコミ contain no Kansai-ben)
//
// Timing: t = frames since the line finished typing.
//   pressed while typing        -> 早すぎ (boke ruined, small penalty)
//   t <= winP (+4 frames grace) -> PERFECT 100%
//   t <= winG                   -> GOOD     75%
//   t <= winL                   -> LATE     40%
//   t >  winL / B               -> スルー (boke) or ナイス見送り (フリ, small bonus)
// Pressing on a フリ costs points. Score = earned / total weight (boke 1, フリ <= 0.4).
//
// Drawn natively in 640x360 screen px (static hd = true): a yose-style theatre stage
// (gold folding screen, lanterns, flower stand, name stand) cached at full resolution,
// the duo from the 32x40 HD sheets shown 2x, and the audience in the foreground.

import { Minigame, registerMinigame, text, rect, wrap, COLORS } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheetHD, LOOKS } from '../engine/sprites.js';
import { audio, registerSong } from '../engine/audio.js';
import { makeCanvas, mulberry32, shuffle, clamp, shade, SW, SH } from '../engine/util.js';

// ------------------------------------------------------------------ content
// Each bit: one normal setup line (フリ) and ボケ that follow naturally from it.
// Every ボケ also works on its own (bits with furi: null are stand-alone ボケ).
const BITS = [
  { furi: '最近、健康のために走ってるねん。', boke: [
    { boke: '富士山を、毎朝ジョギングで登ってるねん。', tsukkomi: 'どんな体力やねん！' },
    { boke: '走りすぎて、新幹線を追い越してもうた。', tsukkomi: 'そんなわけあるかい！' },
  ] },
  { furi: 'ぼく、毎日筋トレしてるねん。', boke: [
    { boke: '腕立て伏せは、一年に一回やってるで。', tsukkomi: '少なすぎるわ！' },
    { boke: '鍛えすぎて、あくびで風船ふくらむねん。', tsukkomi: 'どんな肺活量やねん！' },
  ] },
  { furi: 'ぼく、料理するのが好きやねん。', boke: [
    { boke: '得意料理は、ゆで卵を生卵に戻すことや。', tsukkomi: 'ノーベル賞もんや！' },
    { boke: 'アイスクリームは、レンジで温める派や。', tsukkomi: '溶けてまうわ！' },
  ] },
  { furi: 'たこ焼きって、ほんまにおいしいよな。', boke: [
    { boke: 'たこ焼きに、たこの代わりにたこ焼き入れた。', tsukkomi: 'ややこしいわ！' },
    { boke: 'こないだ、たこ焼きからたこが逃げてん。', tsukkomi: '生きとったんかい！' },
  ] },
  { furi: 'ぼく、食べるのが大好きやねん。', boke: [
    { boke: 'きのうの晩ごはん、ドーナツの穴だけ食べた。', tsukkomi: '何も食べてへんがな！' },
    { boke: 'ラーメンは、ストローで一気に吸うねん。', tsukkomi: '熱いやろ！' },
    { boke: '晩ごはん、おかずがごはんやってん。', tsukkomi: 'ごはんでごはんか！' },
  ] },
  { furi: '最近、ペットを飼い始めてん。', boke: [
    { boke: 'うちの金魚、九九を全部言えるねん。', tsukkomi: 'しゃべられへんやろ！' },
    { boke: 'カバンの中で、ゾウを一頭飼ってるねん。', tsukkomi: '入るかい！' },
  ] },
  { furi: 'こないだ、家族で動物園に行ってん。', boke: [
    { boke: 'ペンギンに、泳ぎ方を教えてきてん。', tsukkomi: '向こうがプロや！' },
    { boke: 'パンダの白黒、ぼくが毎年ぬってるねん。', tsukkomi: 'そんな仕事ないわ！' },
  ] },
  { furi: '最近、早起きするようにしてるねん。', boke: [
    { boke: '目覚まし時計は、ぼくが毎朝起こしてる。', tsukkomi: '立場が逆や！' },
    { boke: '毎朝、太陽に「おはよう」言われるねん。', tsukkomi: '太陽しゃべらんわ！' },
  ] },
  { furi: '休みの日は、家でゴロゴロしてるねん。', boke: [
    { boke: 'ゴロゴロしすぎて、床に人の形の跡ついた。', tsukkomi: 'どんだけ寝とんねん！' },
    { boke: '家では、自分の影と鬼ごっこしてるねん。', tsukkomi: '一生つかまらんわ！' },
    { boke: '寝言で、毎晩落語を一席やってるらしい。', tsukkomi: '寝ながら稽古すな！' },
  ] },
  { furi: 'きのう、ひさしぶりに自転車に乗ってん。', boke: [
    { boke: '自転車、ハンドルだけ持って走ってきた。', tsukkomi: '本体どこやねん！' },
    { boke: '道に迷ったから、地図に道を聞いてん。', tsukkomi: '地図はしゃべらん！' },
  ] },
  { furi: 'この前、新しい靴を買うてん。', boke: [
    { boke: 'この靴な、左右とも左足用やねん。', tsukkomi: '歩きにくいわ！' },
    { boke: '大きめ買うたら、家族全員入ってん。', tsukkomi: 'それもう家や！' },
  ] },
  { furi: 'ぼく、雨の日も意外と好きやねん。', boke: [
    { boke: '雨の音を聞いたら、つい洗濯物を干してまうねん。', tsukkomi: 'しまえや！' },
    { boke: '雨つぶを全部数えてから、家を出るねん。', tsukkomi: '一生出られへんわ！' },
  ] },
  { furi: 'やっぱり、夏が一番好きやねん。', boke: [
    { boke: 'かき氷は、温めてから食べるのが好きや。', tsukkomi: 'ただの水や！' },
    { boke: '夏休みの宿題、去年のがまだ終わらんねん。', tsukkomi: '一年遅れとるがな！' },
    { boke: 'セミといっしょに、毎朝ミンミン鳴いてる。', tsukkomi: '近所迷惑や！' },
  ] },
  { furi: '週末、おばあちゃんちに遊びに行ってん。', boke: [
    { boke: 'うちのおばあちゃん、毎朝バク転してるで。', tsukkomi: '元気すぎるやろ！' },
    { boke: 'おばあちゃんちの庭、山がひとつあるねん。', tsukkomi: 'どんな庭やねん！' },
  ] },
  { furi: 'お正月に、親戚がみんな集まってん。', boke: [
    { boke: 'お年玉、親戚の犬にもあげてん。', tsukkomi: '何に使うねん！' },
    { boke: 'お正月に、サンタさんが来てくれてん。', tsukkomi: '一週間遅刻や！' },
  ] },
  { furi: 'ぼく、こう見えて特技があるねん。', boke: [
    { boke: '百メートルを、百分で走れるねん。', tsukkomi: '遅すぎるわ！' },
    { boke: 'ハトと将棋さして、三連敗中やねん。', tsukkomi: 'ハト強すぎやろ！' },
  ] },
  { furi: '子どものころの夢、聞いてくれる？', boke: [
    { boke: '信号機の青に、なりたかってん。', tsukkomi: 'なられへんわ！' },
    { boke: '雲の上に、家を建てたかってん。', tsukkomi: '落ちてまうわ！' },
  ] },
  { furi: 'ぼく、占いとか信じるタイプやねん。', boke: [
    { boke: '前世はな、カブトムシやったらしいねん。', tsukkomi: '誰に聞いてん！' },
    { boke: '今日のラッキーアイテム、冷蔵庫やって。', tsukkomi: '持ち歩かれへんわ！' },
  ] },
  { furi: '最近、お風呂でよく歌うねん。', boke: [
    { boke: 'お風呂は、服を着たまま入る派やねん。', tsukkomi: '派閥とかないわ！' },
    { boke: 'ぼくが歌うと、近所の犬が全員ハモるねん。', tsukkomi: '犬の合唱団か！' },
  ] },
  { furi: '今度、みんなでカラオケ行こうや。', boke: [
    { boke: 'カラオケで、校歌を三時間歌ってん。', tsukkomi: '愛校心すごいな！' },
    { boke: 'カラオケの点数、いつもマイナスやねん。', tsukkomi: 'どうやったらなるねん！' },
  ] },
  { furi: 'この前、旅行で写真いっぱい撮ってん。', boke: [
    { boke: 'カメラ向けられたら、まばたき百回するねん。', tsukkomi: '目ぇつぶっとるがな！' },
    { boke: '旅行の写真、全部ぼくの親指やってん。', tsukkomi: '景色どこやねん！' },
  ] },
  { furi: '最近、新しい腕時計に変えてん。', boke: [ // [R13-F] (was スマホ: no phone in 昭和)
    { boke: 'ぼくの腕時計、おにぎりで動くねん。', tsukkomi: 'できるかい！' },
    { boke: '時間を聞いたら、腕時計が「知らん」て言うてん。', tsukkomi: '腕時計がしゃべるかい！' },
  ] },
  { furi: null, boke: [
    { boke: 'きのうは、月までスキップで行ってきた。', tsukkomi: '行けるかい！' },
    { boke: 'サンタさんに、お歳暮を贈っといたで。', tsukkomi: '気ぃつかいすぎや！' },
    { boke: 'お弁当箱あけたら、お弁当箱が入っててん。', tsukkomi: 'マトリョーシカか！' },
  ] },
];
// R29: more material (era-neutral: no phones / net / newer gadgets, so it works from 昭和 on)
BITS.push(
  { furi: '最近、釣りを始めてん。', boke: [
    { boke: '大物が釣れて、写真撮ろう思たら逃げられてん。', tsukkomi: 'それは釣られてへんがな！' },
    { boke: '一日じっと待って、釣れたんは自分の靴や。', tsukkomi: '足もとから出てくるかい！' },
    { boke: '釣った魚、全部ぼくよりでかいねん。', tsukkomi: 'どこで釣ってんねん！' },
  ] },
  { furi: 'こないだ、はじめて寿司屋に入ってん。', boke: [
    { boke: '大将に「おまかせで」言うたら、ほんまに全部まかせてきてん。', tsukkomi: '何を任せたんや！' },
    { boke: '回ってない寿司屋やのに、自分でぐるぐる回ってん。', tsukkomi: 'あんたが回ってどないすんねん！' },
  ] },
  { furi: 'ぼく、朝はパン派やねん。', boke: [
    { boke: '食パン一斤、そのまま丸かじりやで。', tsukkomi: '切って食べや！' },
    { boke: 'パンの耳だけ食べて、中身は枕にしてるねん。', tsukkomi: 'ふかふかやけども！' },
  ] },
  { furi: '最近、肩こりがひどいねん。', boke: [
    { boke: '肩に、小さいおっちゃんが乗ってるらしいねん。', tsukkomi: 'こわい話やめぇ！' },
    { boke: '肩こり治そう思て、肩を外して干してん。', tsukkomi: '外れるんかい！' },
  ] },
  { furi: 'こないだ、引っ越しの手伝いしてん。', boke: [
    { boke: 'タンスを一人で運んだら、腰だけ先に新居に着いたわ。', tsukkomi: '腰だけ先に行くな！' },
    { boke: '大事な箱を落としたら、中から「痛い」て聞こえてん。', tsukkomi: '誰を入れとんねん！' },
  ] },
  { furi: 'ぼく、犬の散歩が日課やねん。', boke: [
    { boke: 'うちの犬、ぼくより先に新聞読むねん。', tsukkomi: '賢すぎるやろ！' },
    { boke: '散歩しとったら、犬に引っぱられて隣の県まで行ってん。', tsukkomi: '力強すぎるわ！' },
  ] },
  { furi: '今日は、ええ天気やなぁ。', boke: [
    { boke: 'せっかくやから、傘をさして歩こか。', tsukkomi: '晴れとるがな！' },
    { boke: 'こんな日は、洗濯物より自分を干したいなぁ。', tsukkomi: 'なにしてんねん！' },
  ] },
  { furi: 'ぼく、将来は社長になるねん。', boke: [
    { boke: '社員は、ぼく一人から始めるねん。', tsukkomi: 'それ、ただの個人やがな！' },
    { boke: '会社の名前は、もう決めてあるねん。「会社」や。', tsukkomi: 'そのまんまやがな！' },
  ] },
  { furi: '最近、夜なかなか寝られへんねん。', boke: [
    { boke: '羊を数えてたら、羊が先に寝てもうたわ。', tsukkomi: '数える側が起きてるがな！' },
    { boke: '眠れへんから、朝まで布団の中で走ってるねん。', tsukkomi: '余計に寝られへんやろ！' },
  ] },
  { furi: 'この前、買い物でレジに並んでてん。', boke: [
    { boke: '前のおばちゃんが、レジの人に世間話を三十分してん。', tsukkomi: '早う払うたってや！' },
    { boke: '会計のとき、財布ごと店員さんにあげてしもた。', tsukkomi: '気前ええにもほどがあるわ！' },
  ] },
  { furi: 'ぼく、実は水泳が得意やねん。', boke: [
    { boke: '息つぎなしで、二十五メートル沈んでいけるねん。', tsukkomi: '泳いでへんがな！' },
    { boke: '得意なんは、水に入る前のストレッチだけや。', tsukkomi: 'そこだけかい！' },
  ] },
  { furi: '昨日の夜、えらい雷が鳴ってたなぁ。', boke: [
    { boke: 'ぼく、雷が鳴るたびに「はーい」て返事してたわ。', tsukkomi: '呼ばれてへんがな！' },
    { boke: 'ぴかっと光る前に、おへそ隠したで。', tsukkomi: '取られるのはおへそやない！' },
  ] },
  { furi: '最近、読書にはまってるねん。', boke: [
    { boke: '図書館の本、ぜんぶ表紙だけ読んでるねん。', tsukkomi: '中身も読みぃや！' },
    { boke: '辞書を「あ」から読み始めて、もう三年目や。', tsukkomi: 'まだ「あ」の途中かい！' },
  ] },
  { furi: 'こないだ、友だちの結婚式に呼ばれてん。', boke: [
    { boke: 'ご祝儀の袋に、あめ玉を一個入れといたで。', tsukkomi: '軽すぎるわ！' },
    { boke: '乾杯の音頭、頼まれてないのにぼくがとってん。', tsukkomi: '出しゃばりすぎや！' },
  ] },
  { furi: 'ぼく、方向音痴なんやけどな。', boke: [
    { boke: '家から駅まで、毎回ちがう県に着くねん。', tsukkomi: 'それは才能や！' },
    { boke: '地図を持って出たら、地図のほうが迷子になったわ。', tsukkomi: '地図は迷わへんやろ！' },
  ] },
  { furi: '最近、お金が貯まらんのよ。', boke: [
    { boke: '貯金箱に入れても、次の日には空になってるねん。', tsukkomi: '誰が出してんねん！' },
    { boke: 'お金は、使うた分だけ貯まるって聞いたねん。', tsukkomi: '減ってるだけや！' },
  ] },
  { furi: '今度の休み、山登りに行かへん？', boke: [
    { boke: '山を登るより、山をこっちに連れて来たいねん。', tsukkomi: '山は動かへんわ！' },
    { boke: '山頂でおにぎり食べるために、前の日から断食するねん。', tsukkomi: '気合入りすぎや！' },
  ] },
  { furi: 'うちの母ちゃん、料理が上手やねん。', boke: [
    { boke: 'せやけど、味見だけで全部食べてまうねん。', tsukkomi: '誰の分もないやないか！' },
    { boke: 'ごはん炊くだけで、近所から拍手が起こるねん。', tsukkomi: 'どんな炊き方やねん！' },
  ] },
  { furi: 'ぼく、早口言葉が得意やねん。', boke: [
    { boke: '「なまむぎなまごめなまたまご」を、ゆっくり言うたら完璧やで。', tsukkomi: '早口で言うんや！' },
    { boke: 'ほな、言うで。「なまむ…」あかん、噛んだ。', tsukkomi: '始まった瞬間やないか！' },
  ] },
  { furi: '最近、ダイエットを始めてん。', boke: [
    { boke: '夜ごはんを朝ごはんに回して、実質ゼロカロリーや。', tsukkomi: 'そんな計算あるかい！' },
    { boke: '体重計に乗らへんかったら、太らへんねん。', tsukkomi: '見いひんだけや！' },
  ] },
  { furi: 'こないだ、花火大会に行ってきてん。', boke: [
    { boke: '花火が上がる前に、ぼくが先に打ち上がってん。', tsukkomi: '何があったんや！' },
    { boke: '人が多すぎて、花火より人の頭ばっかり見てたわ。', tsukkomi: '主役はそっちやない！' },
  ] },
  { furi: 'ぼく、整理整頓が苦手やねん。', boke: [
    { boke: '部屋のどこに何があるか、ぼくよりネズミのほうが詳しいねん。', tsukkomi: '住んでるんかい！' },
    { boke: '片づけたら、ほんまに大事なもんも一緒に片づいてもうた。', tsukkomi: '見つからへんようになっとるがな！' },
  ] },
  { furi: '今日は、校長先生の話が長かったなぁ。', boke: [
    { boke: '「最後に」から、三十分しゃべってはったわ。', tsukkomi: '最後が長すぎるわ！' },
    { boke: '立っとる間に、ぼくの背ぇが五センチ伸びたで。', tsukkomi: 'それは成長やろ！' },
  ] },
  { furi: 'こないだ、病院に行ってきてん。', boke: [
    { boke: '先生に「どこが悪いですか」て聞かれたから、全部言うてん。', tsukkomi: '診察に一日かかるわ！' },
    { boke: '待合室で呼ばれたから返事したら、別の人やった。', tsukkomi: '恥ずかしいやつや！' },
  ] },
  { furi: 'ぼく、子どもの頃は食いしん坊やってん。', boke: [
    { boke: '遠足のおやつ、行きのバスで全部食べてもうてん。', tsukkomi: '着いたら何もないやん！' },
    { boke: '給食の残りまで食べて、先生に怒られたわ。', tsukkomi: 'それは違う意味で怒られるわ！' },
  ] },
  { furi: '最近、物忘れがひどいねん。', boke: [
    { boke: 'さっきまで何言うとったか、もう忘れてもうた。', tsukkomi: 'ほんまに忘れとる！' },
    { boke: '自分の名前、毎朝ノートで確認してるねん。', tsukkomi: 'そこまで来たら病院行き！' },
  ] },
  { furi: 'ぼく、占いより天気予報を信じるねん。', boke: [
    { boke: '予報が「雨」でも、「晴れ」て言うまで外出せぇへんで。', tsukkomi: 'ずっと家におるやん！' },
    { boke: '降水確率が五十パーセントなら、片足だけ傘さすわ。', tsukkomi: '半分ずつやな！' },
  ] },
  { furi: 'こないだ、お祭りで金魚すくいしてん。', boke: [
    { boke: '金魚が賢うて、ぼくのほうがすくわれてん。', tsukkomi: '立場逆転しとるがな！' },
    { boke: 'ポイが破れる前に、ぼくの財布が破れたわ。', tsukkomi: '何回やったんや！' },
  ] },
  { furi: 'ぼく、実は怖がりなんや。', boke: [
    { boke: 'お化け屋敷では、お化けの方が先に逃げ出したで。', tsukkomi: 'どんな顔で入ったんや！' },
    { boke: '暗いところでは、自分の影にもあいさつするねん。', tsukkomi: '礼儀正しいな！' },
  ] },
  { furi: 'この前、運動会で走ってん。', boke: [
    { boke: 'ゴールした瞬間に、スタートに戻されてん。', tsukkomi: '何周させられてんねん！' },
    { boke: '賞品のメダルが重すぎて、帰りは歩かれへんかったわ。', tsukkomi: 'どんな金やねん！' },
  ] },
  { furi: null, boke: [
    { boke: '夕焼けを見ながら、おでんを一人でぜんぶ食べたで。', tsukkomi: '風情もなにもないわ！' },
    { boke: '台風の日、ぼくだけ傘をささずに走って帰ってん。', tsukkomi: '傘は意味ないけども！' },
    { boke: '満員電車で、ぼくだけ座れてん。つり革に座ってん。', tsukkomi: 'どこに座っとんねん！' },
  ] },
);
const ALL_BOKE = BITS.flatMap((b) => b.boke);

// Partner / tsukkomi words in two flavours. Built-in material is Kansai-ben; a caller's
// script written in standard Japanese (e.g. a Tokyo duo) gets the 'std' set automatically.
const WORDS = {
  kansai: {
    tsukkomi: ['なんでやねん！', 'どういうことやねん！', 'そんなわけあるかい！', 'おかしいやろ！', 'どないやねん！', 'なんでそうなるねん！', 'ありえへんやろ！', '聞いたことないわ！'],
    early: ['まだ途中やがな！', '最後まで聞いてや！', '話の途中やで！'],
    fake: ['え、ふつうの話やで？', 'まだボケてへんで？', 'ツッコむとこちゃうで！'],
    miss: ['…ツッコんでや！', '…あれ？スルー？', 'いや、何か言うてや！'],
    closer: 'もうええわ！',
    comments: ['劇場が大爆笑！最高の間やったで！', 'ええツッコミ！お客さんも大喜びや！', 'まずまずウケた！間をもっと磨こう！', 'ちょっとスベったかも…次こそ！', 'シーン…。ネタ合わせからやり直しや！'],
  },
  std: {
    tsukkomi: ['なんでだよ！', 'どういうことだよ！', 'そんなわけないだろ！', 'おかしいだろ！', 'ありえないだろ！', '聞いたことないよ！'],
    early: ['まだ途中だって！', '最後まで聞いてよ！', '話の途中だよ！'],
    fake: ['え、ふつうの話だよ？', 'まだボケてないよ？', 'ツッコむとこじゃないよ！'],
    miss: ['…ツッコんでよ！', '…あれ？スルー？', 'いや、何か言ってよ！'],
    closer: 'いいかげんにしろ！',
    comments: ['劇場が大爆笑！最高の間だった！', 'いいツッコミ！お客さんも大喜び！', 'まずまずウケた！間をもっと磨こう！', 'ちょっとスベったかも…次こそ！', 'シーン…。ネタ合わせからやり直し！'],
  },
};
const KANSAI_RE = /やねん|ねん|へん|やろ|やない|やで|かい[！!]|がな|ちゃう|あかん|[やわ][！!？?]/;
const CROWD = ['ワハハ', 'アハハ', 'ドッ！', 'ハハハ', 'ウフフ', 'ワハハハ'];

export const TSUKKOMI_CONTENT = { BITS, WORDS };

// ------------------------------------------------------------------ tuning
const DIFF = {
  rounds: [6, 7, 8, 9, 10],
  fakes: [1, 2, 3, 3, 4],
  charF: [4.2, 3.6, 3.0, 2.6, 2.2], // frames per character
  perfect: [26, 22, 18, 15, 12], // frames after the line ends
  good: [22, 19, 16, 14, 12],
  late: [26, 23, 20, 18, 16],
  pre: [40, 34, 30, 26, 22], // pause before each line
};
const GRACE = 4; // pressing this many frames before the last character still counts as on time
const NORMAL_W = 0.4; // weight of a フリ (letting it pass = small bonus)
const FAKE_PENALTY = 0.5; // pressing on a フリ
const EARLY_PENALTY = 0.25; // pressing while a ボケ is still being said (worse than letting it pass)
const MIN_LINES = 3;

// ------------------------------------------------------------------ stage layout (screen px)
// The duo uses the 32x40 HD frames at 2 px per art pixel (64x80 on screen).
const CW = 64, CH = 80;
const FEET_Y = 284;
const PARTNER_X = 232; // left edge of the 64px wide sprite
const PLAYER_X = 344;
const MIC_X = 320;
const PARTNER_HEAD = { x: 264, y: 204 };
const PLAYER_HEAD = { x: 376, y: 204 };
const FLOOR_Y = 236; // back of the stage floor (foot of the folding screen)
const LIP_Y = 296; // stage front edge
const AUD_Y = 310; // audience pit
const HUD_H = 26;
const BUBBLE_Y = 46;
const POP_X = 548, POP_Y = 84; // judgement popups (right of the speech bubble)
const IMPACT = { x: 290, y: 256 }; // where the back-hand lands
const TXT = 18; // speech bubble text size (16 for very long custom lines)
const PARTNER_LOOK = { hair: 'afro', hairColor: 'brown', skin: 'fair', top: '#2f6fd0', bottom: '#24305e', jacket: true, tie: '#ffd23f' };
const INK = '#22202a';

registerSong('tsukkomi_debayashi', {
  bpm: 136, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'C5 . E5 G5 . E5 C5 . | D5 . F5 A5 . F5 D5 . | E5 . G5 C6 . G5 E5 . | D5 E5 F5 E5 D5 . G4 . | C5 . E5 G5 . E5 C5 . | A4 . C5 F5 . A5 G5 . | F5 E5 D5 C5 B4 . D5 . | C5 - - . G4 . C5 .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});

// ------------------------------------------------------------------ pixel helpers
// Scanline polygon fill: crisp pixels, no anti-aliasing.
function fillPoly(ctx, pts, color) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
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

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (hw > 0) ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
  }
}

function starPts(cx, cy, rx, ry, spikes, inner, rot = 0) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i * Math.PI) / spikes;
    const r = i % 2 ? inner : 1;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
}

// Checkerboard of `color` over a rectangle (dithered seam between two tones).
function dither(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  for (let yy = y; yy < y + h; yy++) for (let xx = x + ((yy + x) & 1); xx < x + w; xx += 2) ctx.fillRect(xx, yy, 1, 1);
}

// Rounded box with a 2px ink outline; `low` shades the inside of the bottom / right edges.
function roundBox(ctx, x, y, w, h, fill, edge = INK, low = null) {
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x + 4, y, w - 8, h, edge);
  rect(ctx, x + 2, y + 1, w - 4, h - 2, edge);
  rect(ctx, x + 1, y + 2, w - 2, h - 4, edge);
  rect(ctx, x, y + 4, w, h - 8, edge);
  rect(ctx, x + 4, y + 2, w - 8, h - 4, fill);
  rect(ctx, x + 3, y + 3, w - 6, h - 6, fill);
  rect(ctx, x + 2, y + 4, w - 4, h - 8, fill);
  if (low) {
    rect(ctx, x + 4, y + h - 4, w - 8, 2, low);
    rect(ctx, x + w - 4, y + 4, 2, h - 8, low);
    rect(ctx, x + w - 5, y + h - 5, 1, 1, low);
  }
}

// Small 4-point twinkle with an ink rim (dizzy stars).
function twinkle(ctx, x, y, color) {
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x - 6, y - 2, 12, 4, INK);
  rect(ctx, x - 2, y - 6, 4, 12, INK);
  rect(ctx, x - 3, y - 3, 6, 6, INK);
  rect(ctx, x - 5, y - 1, 10, 2, color);
  rect(ctx, x - 1, y - 5, 2, 10, color);
  rect(ctx, x - 2, y - 2, 4, 4, color);
  rect(ctx, x - 1, y - 1, 1, 1, '#ffffff');
}

const pickFrom = (arr, r) => arr[Math.floor(r() * arr.length)];
const ZONE_COLS = ['#ffd23f', '#5ee07a', '#5fd7ff'];
const TONES = {}; // memoised 3-tone ramps for flat UI colours
function tones(col) {
  return TONES[col] || (TONES[col] = { hi: shade(col, 0.45), mid: col, lo: shade(col, -0.28) });
}

// ------------------------------------------------------------------ the game
class TsukkomiManzai extends Minigame {
  static title = 'ツッコミ漫才';
  static howto = [
    'ボケが言い終わったら Aでツッコミ！',
    '直後ほど高得点！早すぎはダメ',
    'ふつうの話（フリ）はBで見送ろう',
  ];
  static skill = 'warai';
  static bgm = 'tsukkomi_debayashi';
  static hd = true;

  init() {
    const d = this.difficulty - 1;
    this.charF = this.ease(DIFF.charF[d], 0.35);
    this.winP = Math.round(this.ease(DIFF.perfect[d], 0.5));
    this.winG = this.winP + Math.round(this.ease(DIFF.good[d], 0.4));
    this.winL = this.winG + Math.round(this.ease(DIFF.late[d], 0.3));
    this.preF = DIFF.pre[d];
    this.mctx = makeCanvas(8, 8)[1];

    this.script = this.buildScript(d);
    if (!this.script.some((l) => l.punch)) this.script.push(this.builtin(1, 0)[0]);
    this.words = WORDS[this.dialect] || WORDS.kansai;
    // フリ are worth a little; capped so that doing nothing never scores more than ~23
    const nBoke = this.script.filter((l) => l.punch).length;
    const nFuri = this.script.length - nBoke;
    this.normalW = nFuri ? Math.min(NORMAL_W, (0.3 * nBoke) / nFuri) : NORMAL_W;
    this.totalW = nBoke + nFuri * this.normalW;
    this.earned = 0;
    this.shown = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, good: 0, late: 0, early: 0, miss: 0, fake: 0, pass: 0 };

    this.idx = -1;
    this.cur = null;
    this.state = 'opening';
    this.st = 0;
    this.bubble = null;
    this.burst = null;
    this.emote = null;
    this.slap = null;
    this.knock = 0;
    this.knockPow = 1;
    this.stars = 0;
    this.impact = 0;
    this.shakeT = 0;
    this.laugh = 0;
    this.silenceT = 0;
    this.pressMark = null;
    this.crowd = [];
    this.sched = [];

    const st = this.g.state || {};
    this.partnerName = this.opts.partner || '相方';
    this.partnerLook = this.opts.partnerLook || PARTNER_LOOK;
    this.playerLook = st.look || LOOKS.player;
    this.initArt();
  }

  // ---------------------------------------------------------------- script
  buildScript(d) {
    const custom = Array.isArray(this.opts.lines)
      ? this.opts.lines.filter((l) => l && l.boke).map((l) => ({ text: String(l.boke), punch: !!l.punch, tsukkomi: l.tsukkomi ? String(l.tsukkomi) : null }))
      : [];
    // dialect of the partner's reactions / the closing line: explicit opts.dialect, else
    // standard Japanese when a custom script has its own ツッコミ and none of it is Kansai-ben
    const std = custom.some((l) => l.tsukkomi) && !custom.some((l) => KANSAI_RE.test(l.text + (l.tsukkomi || '')));
    this.dialect = this.opts.dialect === 'std' || this.opts.dialect === 'kansai' ? this.opts.dialect : std ? 'std' : 'kansai';
    const ratio = DIFF.fakes[d] / DIFF.rounds[d];
    const want = Number(this.opts.rounds);
    let rounds = Number.isFinite(want) && want > 0 ? clamp(Math.round(want), MIN_LINES, 16) : null;
    if (custom.length) {
      rounds = rounds ?? Math.max(MIN_LINES, custom.length);
      if (custom.length >= rounds) return custom.slice(0, rounds);
      const k = rounds - custom.length;
      return custom.concat(this.builtin(k, Math.floor(k * ratio)));
    }
    if (rounds == null) return this.builtin(DIFF.rounds[d], DIFF.fakes[d]);
    return this.builtin(rounds, Math.round(rounds * ratio));
  }

  // n lines with `fakes` フリ. A フリ is always followed by a ボケ from the same bit;
  // the first and last lines are always ボケ.
  builtin(n, fakes) {
    const r = this.rng;
    // フリ go in slots 1..n-2, never two in a row (random greedy, retried until it fits)
    let fakeAt = new Set();
    for (let tries = 0; tries < 30; tries++) {
      const set = new Set();
      for (const s of shuffle(Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 1), r)) {
        if (set.size >= fakes) break;
        if (set.has(s - 1) || set.has(s + 1)) continue;
        set.add(s);
      }
      if (set.size > fakeAt.size) fakeAt = set;
      if (fakeAt.size >= fakes) break;
    }
    const bits = shuffle(BITS.filter((b) => b.furi), r);
    const used = new Set();
    const out = new Array(n).fill(null);
    let bi = 0;
    for (const s of [...fakeAt].sort((a, b) => a - b)) {
      const bit = bits[bi++ % bits.length];
      const b = shuffle(bit.boke, r).find((x) => !used.has(x));
      if (!b) continue;
      used.add(b);
      out[s] = { text: bit.furi, punch: false, tsukkomi: null };
      out[s + 1] = { text: b.boke, punch: true, tsukkomi: b.tsukkomi };
    }
    const rest = shuffle(ALL_BOKE, r).filter((b) => !used.has(b));
    for (let i = 0; i < n; i++) {
      if (out[i]) continue;
      const b = rest.pop() || pickFrom(ALL_BOKE, r);
      out[i] = { text: b.boke, punch: true, tsukkomi: b.tsukkomi };
    }
    return out;
  }

  // Lay out a line for the speech bubble and compute when each character appears.
  // The reveal timing comes from timingChars() so it is frame-for-frame the v1 timing.
  prep(line) {
    const { lines, size } = this.fit(line.text);
    const chars = this.timingChars(line.text);
    const revealAt = [];
    let t = 0;
    chars.forEach((ch, i) => {
      const prev = chars[i - 1];
      t += this.charF;
      if (prev && '、，…'.includes(prev)) t += this.charF * 2.5;
      else if (prev && '。！？'.includes(prev)) t += this.charF * 1.5;
      revealAt.push(t);
    });
    return { ...line, lines, size, chars, revealAt, finishT: Math.ceil(t), shown: 0 };
  }

  // The characters of the v1 bubble layout (12px rows of 196px, 10px / 206px past 3 rows).
  // Only the characters matter (a wrapped latin space can drop out), not where rows break.
  timingChars(str) {
    let lines = this.layout(str, 12, 196);
    if (lines.length > 3) lines = this.layout(str, 10, 206);
    return lines.flatMap((l) => Array.from(l));
  }

  // 18px text in rows of up to 360px; a long custom line that would need more than
  // 3 rows switches to 16px so the bubble never covers the stage (the width stays
  // clear of the judgement popups on the right).
  fit(str) {
    const lines = this.layout(str, TXT, 360);
    if (lines.length <= 3) return { lines, size: TXT };
    return { lines: this.layout(str, 16, 396), size: 16 };
  }

  // Wrap for the bubble: phrases ending in 、。！？ are packed greedily into rows so
  // lines break at natural points (readable at speed); an over-long phrase is wrapped
  // by character. Explicit "\n" is respected.
  layout(str, size = TXT, maxW = 360) {
    const m = (x) => measure(this.mctx, x, size);
    const out = [];
    for (const para of String(str).split('\n')) {
      const segs = para.match(/[^、。！？]+[、。！？]*|[、。！？]+/g) || [''];
      let cur = '';
      for (const seg of segs) {
        if (m(cur + seg) <= maxW) { cur += seg; continue; }
        if (cur) out.push(cur);
        if (m(seg) <= maxW) { cur = seg; continue; }
        const rows = wrap(this.mctx, seg, maxW, size);
        cur = rows.pop();
        out.push(...rows);
      }
      out.push(cur);
    }
    return out;
  }

  makeBubble(textOrLines, { bar: withBar = false, tails = [PARTNER_HEAD], name = this.partnerName, cx = null, size = null } = {}) {
    let lines = textOrLines;
    if (!Array.isArray(lines)) ({ lines, size } = this.fit(textOrLines));
    size = size || TXT;
    const lh = size + 6;
    let tw = 0;
    for (const l of lines) tw = Math.max(tw, measure(this.mctx, l, size));
    const w = Math.min(SW - 24, Math.max(withBar ? 280 : 120, Math.ceil(tw) + 32));
    const h = 12 + lines.length * lh + (withBar ? 24 : 0) + 6;
    const center = cx ?? tails[0].x;
    const x = clamp(Math.round(center - w / 2), 12, SW - 12 - w);
    const total = lines.reduce((k, l) => k + Array.from(l).length, 0);
    return { lines, size, lh, w, h, x, y: BUBBLE_Y, bar: withBar, tails, name, n: Infinity, total };
  }

  // ---------------------------------------------------------------- flow
  // Run fn after `frames` play frames (independent of state changes).
  later(frames, fn) { this.sched.push({ at: this.pt + frames, fn }); }

  setState(s) { this.state = s; this.st = 0; }

  nextLine() {
    this.idx++;
    this.bubble = null;
    this.burst = null;
    this.emote = null;
    this.pressMark = null;
    this.sched = [];
    if (this.idx >= this.script.length) { this.startClosing(); return; }
    if (this.idx === 0) audio.stopBgm(); // the act itself is played without music
    this.cur = this.prep(this.script[this.idx]);
    this.setState('pre');
  }

  updatePlay(inp) {
    this.st++;
    // scheduled one-shots (sounds, reactions)
    const due = this.sched.filter((e) => e.at <= this.pt);
    if (due.length) {
      this.sched = this.sched.filter((e) => e.at > this.pt);
      for (const e of due) e.fn();
    }
    this.tickFx();

    switch (this.state) {
      case 'opening': {
        if (this.st === 1) {
          this.bubble = this.makeBubble('はいどうもー！よろしくお願いしますー！');
          this.bubble.n = 0;
          this.g.sfx('applause');
          this.laugh = 0.6;
        }
        if (this.bubble && this.st % 2 === 0 && this.bubble.n < this.bubble.total) { this.bubble.n++; if (this.bubble.n % 2) this.voice(false); }
        if (this.st >= 96) this.nextLine();
        break;
      }
      case 'pre':
        if (this.st >= this.preF) {
          this.bubble = this.makeBubble(this.cur.lines, { bar: true, size: this.cur.size });
          this.bubble.n = 0;
          this.setState('type');
        }
        break;
      case 'type': {
        const c = this.cur;
        let n = c.shown;
        while (n < c.chars.length && c.revealAt[n] <= this.st) n++;
        if (n > c.shown) {
          const ch = c.chars[n - 1];
          if (!'、。！？…'.includes(ch) && n % 2 === 1) this.voice(false);
          c.shown = n;
          this.bubble.n = n;
        }
        if (inp.pressed('a')) {
          if (this.st >= c.finishT - GRACE) { this.bubble.n = Infinity; this.onPress(0); } else this.onEarly();
        } else if (this.st >= c.finishT) {
          this.bubble.n = Infinity;
          this.cue();
          this.setState('window');
        }
        break;
      }
      case 'window':
        if (inp.pressed('a')) this.onPress(this.st);
        else if (inp.pressed('b')) this.onLetGo(true);
        else if (this.st > this.winL) this.onLetGo(false);
        break;
      case 'react':
        if (this.st >= this.reactLen) this.nextLine();
        break;
      case 'closing':
        if (this.st >= 150) {
          this.setState('done');
          this.end(this.finalScore(), this.comment());
        }
        break;
      default:
        break;
    }
  }

  react(len) { this.setState('react'); this.reactLen = len; }

  // A pressed after (or right at the end of) the line.
  onPress(t) {
    const c = this.cur;
    this.pressMark = { t };
    if (!c.punch) { this.onFake(); return; }
    const grade = t <= this.winP ? 'PERFECT' : t <= this.winG ? 'GOOD' : 'LATE';
    const pts = grade === 'PERFECT' ? 1 : grade === 'GOOD' ? 0.75 : 0.4;
    this.earned += pts;
    this.counts[grade.toLowerCase()]++;
    if (grade === 'LATE') this.combo = 0;
    else this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const phrase = c.tsukkomi || pickFrom(this.words.tsukkomi, this.rng);
    this.burst = { text: grade === 'LATE' ? '…' + phrase : phrase, t: 0, size: grade === 'PERFECT' ? 22 : 18, weak: grade === 'LATE' };
    this.startSlap(grade === 'PERFECT' ? 2 : grade === 'GOOD' ? 1.3 : 0.7);
    this.g.sfx('hit');
    this.voice(true);
    const lv = grade === 'PERFECT' ? 1 : grade === 'GOOD' ? 0.7 : 0.35;
    this.later(6, () => { this.g.sfx('laugh'); this.laugh = Math.max(this.laugh, lv); this.spawnCrowd(grade === 'PERFECT' ? 6 : grade === 'GOOD' ? 4 : 2); });
    if (grade === 'PERFECT' && this.combo >= 3) this.later(16, () => this.g.sfx('applause'));
    if (grade === 'PERFECT') this.stars = 46;
    const col = grade === 'PERFECT' ? COLORS.accent : grade === 'GOOD' ? COLORS.good : COLORS.cyan;
    this.popup(grade === 'LATE' ? 'LATE…' : grade + '!', POP_X, POP_Y, col, grade === 'PERFECT' ? 24 : 20);
    if (this.combo >= 2) this.popup(`${this.combo}コンボ！`, POP_X, POP_Y + 28, COLORS.pink, 16);
    this.react(74);
  }

  // A pressed while the line was still being spoken.
  onEarly() {
    const c = this.cur;
    if (!c.punch) { this.pressMark = null; this.onFake(); return; }
    this.counts.early++;
    this.earned -= EARLY_PENALTY;
    this.combo = 0;
    this.pressMark = null;
    // cut the line off where it was
    const cut = Math.max(1, c.shown);
    this.bubble = this.makeBubble(c.chars.slice(0, cut).join('') + '…', { bar: false });
    this.burst = { text: 'なん…', t: 0, size: 18, weak: true };
    this.startSlap(0, true);
    this.g.sfx('buzz');
    this.popup('早すぎ！', POP_X, POP_Y, COLORS.bad, 20);
    this.later(18, () => {
      this.burst = null;
      this.bubble = this.makeBubble(pickFrom(this.words.early, this.rng));
      this.emote = { ch: '！', t: 0 };
      this.silenceT = 60;
      this.voice(false);
    });
    this.react(86);
  }

  // A pressed on a normal line (フリ).
  onFake() {
    this.earned -= FAKE_PENALTY;
    this.counts.fake++;
    this.combo = 0;
    this.bubble.n = Infinity;
    this.burst = { text: pickFrom(this.words.tsukkomi, this.rng), t: 0, size: 18 };
    this.startSlap(1);
    this.g.sfx('hit');
    this.voice(true);
    this.popup('それはフリ！', POP_X, POP_Y, COLORS.bad, 20);
    this.later(14, () => { this.g.sfx('buzz'); this.emote = { ch: '？', t: 0 }; this.silenceT = 60; });
    this.later(26, () => {
      this.burst = null;
      this.bubble = this.makeBubble(pickFrom(this.words.fake, this.rng));
      this.voice(false);
    });
    this.react(90);
  }

  // Window ran out, or B pressed: correct for a フリ, a miss for a ボケ.
  onLetGo(byB) {
    const c = this.cur;
    if (c.punch) {
      this.counts.miss++;
      this.combo = 0;
      this.g.sfx('cancel');
      this.popup('スルー…', POP_X, POP_Y, COLORS.dim, 20);
      this.silenceT = 60;
      this.later(10, () => {
        this.emote = { ch: '…', t: 0 };
        this.bubble = this.makeBubble(pickFrom(this.words.miss, this.rng));
        this.voice(false);
      });
      this.react(78);
    } else {
      this.earned += this.normalW;
      this.counts.pass++;
      this.g.sfx('good');
      this.popup('ナイス見送り', POP_X, POP_Y, COLORS.good, 18);
      this.react(byB ? 20 : 16);
    }
  }

  startClosing() {
    this.setState('closing');
    this.bubble = null;
    this.burst = { text: this.words.closer, t: 0, size: 22 };
    this.startSlap(1.6);
    this.g.sfx('hit');
    this.voice(true);
    this.later(6, () => { this.g.sfx('laugh'); this.laugh = Math.max(this.laugh, 0.8); this.spawnCrowd(4); });
    this.later(44, () => {
      this.burst = null;
      this.bubble = this.makeBubble('どうも、ありがとうございましたー！', { tails: [PARTNER_HEAD, PLAYER_HEAD], name: null, cx: MIC_X });
      this.g.sfx('applause');
      this.laugh = 0.7;
      audio.bgm(TsukkomiManzai.bgm);
    });
    this.later(80, () => this.g.sfx('applause'));
  }

  finalScore() { return clamp((Math.max(0, this.earned) / this.totalW) * 100, 0, 100); }

  comment() {
    const s = Math.round(this.finalScore());
    const c = this.words.comments;
    return c[s >= 90 ? 0 : s >= 75 ? 1 : s >= 55 ? 2 : s >= 35 ? 3 : 4];
  }

  // ---------------------------------------------------------------- effects
  startSlap(power, weak = false) {
    this.slap = { t: 0, power, weak };
  }

  tickFx() {
    if (this.slap) {
      const s = this.slap;
      s.t++;
      if (s.t === 4 && !s.weak) {
        this.knock = 1;
        this.knockPow = s.power;
        this.impact = 9;
        this.shakeT = s.power >= 2 ? 8 : s.power >= 1 ? 5 : 2;
      }
      if (s.t > 32) this.slap = null;
    }
    if (this.knock > 0) this.knock = Math.max(0, this.knock - 0.05);
    if (this.impact > 0) this.impact--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.stars > 0) this.stars--;
    if (this.silenceT > 0) this.silenceT--;
    if (this.burst) this.burst.t++;
    if (this.emote) this.emote.t++;
    this.laugh = Math.max(0, this.laugh - 0.008);
    if (this.laugh > 0.25 && this.st % 7 === 0 && this.rng() < this.laugh) this.spawnCrowd(1);
    for (const c of this.crowd) c.t++;
    this.crowd = this.crowd.filter((c) => c.t < 44);
    const target = Math.max(0, this.earned) / this.totalW;
    this.shown += (target - this.shown) * 0.12;
  }

  // Laughter text rising from the audience; one per column so they never pile up.
  spawnCrowd(n) {
    for (let i = 0; i < n; i++) {
      const free = [];
      for (let col = 0; col < 6; col++) if (!this.crowd.some((c) => c.col === col && c.t < 26)) free.push(col);
      if (!free.length) return;
      const col = pickFrom(free, this.rng);
      this.crowd.push({ col, str: pickFrom(CROWD, this.rng), x: 70 + col * 100 + Math.round((this.rng() - 0.5) * 10) * 2, y: 306 + Math.round(this.rng() * 10) * 2, t: -Math.floor(this.rng() * 8) });
    }
  }

  // Little chiptune "voice" blips (audio.ctx is null until the first user gesture).
  voice(player) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    const f = player ? 760 + this.rng() * 120 : 420 + this.rng() * 90;
    audio.tone(f, t, 0.035, { wave: 'square', vol: player ? 0.04 : 0.035 });
  }

  // Soft cue played when every line finishes (ボケ and フリ alike).
  cue() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    audio.tone(1175, t, 0.05, { wave: 'triangle', vol: 0.07 });
  }

  // ---------------------------------------------------------------- art setup
  initArt() {
    this.bg = this.bg || this.renderStage();
    this.audience = this.makeAudience();
    this.boSheet = charSheetHD(this.partnerLook);
    this.tsSheet = charSheetHD(this.playerLook);
    // per-frame composition canvases (sprite + mouth / slap arm), in HD art pixels
    [this.pcv, this.pctx] = makeCanvas(32, 40);
    [this.tcv, this.tctx] = makeCanvas(56, 40);
    this.makeSlapFrame();
  }

  // The tsukkomi's side view with the hanging near arm painted out (the slap draws
  // a stretched arm instead), plus the arm / skin tones read from the sheet.
  makeSlapFrame() {
    const [cv, c] = makeCanvas(32, 40);
    c.drawImage(this.tsSheet.left[0], 0, 0);
    let img;
    try { img = c.getImageData(0, 0, 32, 40); } catch (e) { img = null; }
    const look = this.playerLook;
    const fall = { D: shade(look.top || '#d64161', -0.35), y: shade(look.top || '#d64161', 0.25), c: look.top || '#d64161', s: '#f6c9a0', u: '#d9a47c', S: '#e8b48c' };
    if (!img) { this.slapFrame = cv; this.armPal = fall; return; }
    const d = img.data;
    const at = (x, y) => (y * 32 + x) * 4;
    const col = (x, y, def) => {
      const i = at(x, y);
      return d[i + 3] > 0 ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : def;
    };
    // arm tones (ARM_HD frame 0 sits at x 11..15, rows 24..30)
    this.armPal = { D: col(11, 25, fall.D), y: col(12, 25, fall.y), c: col(13, 25, fall.c), s: col(12, 28, fall.s), u: col(11, 28, fall.u), S: col(14, 29, fall.S) };
    for (let y = 24; y <= 30; y++) {
      const s = at(19, y);
      for (let x = 11; x <= 15; x++) { const t = at(x, y); for (let k = 0; k < 4; k++) d[t + k] = d[s + k]; }
    }
    c.putImageData(img, 0, 0);
    this.slapFrame = cv;
  }

  // ---------------------------------------------------------------- static stage
  renderStage() {
    const [cv, c] = makeCanvas(SW, SH);
    const r = mulberry32(4242);
    // back wall: maroon drape, darker toward the floor, dithered between tones
    const WALL = ['#5c1628', '#541424', '#4b1120', '#430f1c', '#3a0c18', '#320a15', '#2a0812'];
    const band = (FLOOR_Y - HUD_H) / WALL.length;
    for (let i = 0; i < WALL.length; i++) {
      const y0 = Math.round(HUD_H + i * band), y1 = Math.round(HUD_H + (i + 1) * band);
      rect(c, 0, y0, SW, y1 - y0, WALL[i]);
      if (i) dither(c, 0, y0, SW, 2, WALL[i - 1]);
    }
    for (let x = 6; x < SW; x += 22) {
      rect(c, x, 56, 3, FLOOR_Y - 56, 'rgba(0,0,0,0.16)');
      rect(c, x + 9, 56, 1, FLOOR_Y - 56, 'rgba(255,190,200,0.05)');
    }
    this.drawScreen(c, r);
    this.drawCurtains(c);
    this.drawValance(c);
    this.drawLantern(c, 26, 70);
    this.drawLantern(c, SW - 26, 70);
    // stage floor
    rect(c, 0, FLOOR_Y, SW, 2, '#1a0a08');
    for (let y = FLOOR_Y + 2, row = 0; y < LIP_Y; y += 10, row++) {
      const h = Math.min(10, LIP_Y - y);
      const odd = row % 2;
      rect(c, 0, y, SW, h, odd ? '#a46f38' : '#b07a40');
      rect(c, 0, y, SW, 1, odd ? '#bb8749' : '#c79254');
      rect(c, 0, y + h - 1, SW, 1, '#7e5128');
      for (let k = 0; k < 16; k++) {
        const gx = Math.floor(r() * SW), gy = y + 2 + Math.floor(r() * Math.max(1, h - 4));
        rect(c, gx, gy, 6 + Math.floor(r() * 20), 1, odd ? '#976534' : '#a2703c');
      }
      for (let x = (row * 53) % 96; x < SW; x += 96) {
        rect(c, x, y, 1, h - 1, '#6a4320');
        rect(c, x + 1, y, 1, h - 1, odd ? '#bb8749' : '#c79254');
        rect(c, x + 4, y + 4, 1, 1, '#5a3818');
      }
    }
    // spotlight cone + pool (flat translucent light, crisp edges)
    c.globalAlpha = 0.07;
    fillPoly(c, [[264, 30], [376, 30], [552, LIP_Y], [88, LIP_Y]], '#fff2c8');
    c.globalAlpha = 0.13;
    fillEllipse(c, 320, 278, 208, 16, '#fff0c0');
    c.globalAlpha = 0.1;
    fillEllipse(c, 320, 279, 140, 10, '#fff8e0');
    c.globalAlpha = 1;
    this.drawFlowers(c, r);
    this.drawMekuri(c);
    // stage lip + footlights
    rect(c, 0, LIP_Y, SW, 14, '#4a2a14');
    rect(c, 0, LIP_Y, SW, 1, '#e0a868');
    rect(c, 0, LIP_Y + 1, SW, 1, '#9a6a3a');
    rect(c, 0, LIP_Y + 12, SW, 1, '#2e1a0c');
    rect(c, 0, LIP_Y + 13, SW, 1, '#1a0e06');
    for (let x = 28; x < SW; x += 56) {
      c.globalAlpha = 0.22;
      rect(c, x - 12, LIP_Y - 3, 24, 3, '#fff2b0');
      rect(c, x - 8, LIP_Y - 6, 16, 3, '#fff2b0');
      c.globalAlpha = 1;
      rect(c, x - 8, LIP_Y + 3, 16, 8, INK);
      rect(c, x - 7, LIP_Y + 7, 14, 3, '#3a3d48');
      rect(c, x - 7, LIP_Y + 7, 14, 1, '#5a5f6b');
      rect(c, x - 6, LIP_Y + 3, 12, 4, '#ffe9a0');
      rect(c, x - 4, LIP_Y + 3, 5, 1, '#fffbe8');
    }
    // audience pit
    rect(c, 0, AUD_Y, SW, SH - AUD_Y, '#0d0a16');
    rect(c, 0, AUD_Y, SW, 2, '#07050c');
    return cv;
  }

  // Gold six-panel folding screen (金屏風) with mist bands and a pine bough.
  drawScreen(c, r) {
    const bx = 164, by = 92, pw = 52, bh = FLOOR_Y - 92;
    rect(c, bx - 4, by - 4, pw * 6 + 8, bh + 4, '#2a160c');
    rect(c, bx - 4, by - 4, pw * 6 + 8, 1, '#6a4422');
    rect(c, bx - 4, by - 3, 1, bh + 3, '#4a2c16');
    // cast shadow on the wall
    c.globalAlpha = 0.3;
    rect(c, bx + pw * 6 + 4, by, 6, bh, '#000');
    c.globalAlpha = 1;
    for (let p = 0; p < 6; p++) {
      const px = bx + p * pw;
      const lit = p % 2 === 0; // zig-zag folds: every other panel faces the light
      const T = lit ? ['#e4b647', '#d9a93b', '#cb9a31', '#b78829'] : ['#cf9d33', '#c3902d', '#b08126', '#9a7121'];
      for (let i = 0; i < 4; i++) {
        const y0 = by + Math.round((i * bh) / 4), y1 = by + Math.round(((i + 1) * bh) / 4);
        rect(c, px, y0, pw, y1 - y0, T[i]);
        if (i) dither(c, px, y0, pw, 2, T[i - 1]);
      }
      // gold-leaf squares, laid like bricks
      for (let gy = by + 9, row = 0; gy < by + bh; gy += 18, row++) {
        rect(c, px, gy, pw, 1, lit ? 'rgba(150,100,20,0.22)' : 'rgba(110,70,10,0.22)');
        for (let gx = px + ((row * 9 + p * 5) % 18); gx < px + pw; gx += 18) rect(c, gx, gy + 1, 1, 17, 'rgba(120,80,10,0.16)');
      }
      rect(c, px, by, 1, bh, lit ? '#f8de8a' : '#e8c66c');
      rect(c, px + 1, by, 1, bh, lit ? '#efcd6c' : '#d9b257');
      rect(c, px + pw - 1, by, 1, bh, '#6e4f14');
      if (p) { rect(c, px - 1, by + 18, 2, 7, '#3a2410'); rect(c, px - 1, by + bh - 28, 2, 7, '#3a2410'); }
    }
    // stylised mist bands (金雲), placed as on the v1 screen
    for (const [mx, my, mw] of [[174, 106, 114], [304, 118, 146], [203, 178, 98], [346, 196, 107], [255, 150, 65]]) {
      const rows = [[6, '#fbe7a6'], [3, '#f6dc8c'], [1, '#efcf74'], [1, '#ecc865'], [0, '#ecc865'], [0, '#ecc865'], [0, '#ecc865'], [0, '#e6c05c'], [1, '#e0b955'], [1, '#d4ad4c'], [3, '#c49a3a'], [6, '#a87e26']];
      rows.forEach(([ins, col], i) => rect(c, mx + ins, my + i, mw - ins * 2, 1, col));
      for (let x = mx + 10; x < mx + mw - 14; x += 16) rect(c, x, my + 4, 7, 1, '#f8e29a');
      for (let x = mx + 16; x < mx + mw - 10; x += 16) rect(c, x, my + 8, 6, 1, '#d6b04e');
    }
    // old pine (老松) rising at the right edge, boughs reaching over panel 5
    this.drawPine(c);
  }

  drawPine(c) {
    const trunk = [[462, 236, 7], [458, 214, 6], [464, 192, 6], [456, 168, 5], [444, 148, 4], [430, 132, 3]];
    const limb = (pts) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0, w0] = pts[i], [x1, y1, w1] = pts[i + 1];
        const steps = Math.max(Math.abs(y1 - y0), Math.abs(x1 - x0));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), w = Math.round(w0 + (w1 - w0) * t);
          rect(c, x - w - 1, y - 1, w * 2 + 2, 3, '#24160a');
        }
      }
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0, w0] = pts[i], [x1, y1, w1] = pts[i + 1];
        const steps = Math.max(Math.abs(y1 - y0), Math.abs(x1 - x0));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t), w = Math.round(w0 + (w1 - w0) * t);
          rect(c, x - w, y, w * 2, 1, '#6a4422');
          rect(c, x - w, y, Math.max(1, Math.round(w * 0.5)), 1, '#8c623a');
          rect(c, x + w - 2, y, 2, 1, '#3e2610');
          if ((y * 7 + x) % 11 === 0) rect(c, x - 1, y, 2, 1, '#4a2e14');
        }
      }
    };
    limb(trunk);
    limb([[446, 150, 3], [424, 140, 3], [400, 134, 2], [382, 128, 2]]);
    limb([[440, 140, 2], [436, 124, 2], [430, 112, 2]]);
    limb([[460, 190, 2], [470, 180, 2]]);
    // flat foliage pads with a scalloped crown
    const pad = (x, y, rx, ry) => {
      const bumps = [];
      for (let bx = x - rx + 6; bx <= x + rx - 6; bx += 7) bumps.push(bx);
      fillEllipse(c, x, y, rx + 1, ry + 1, '#16301a');
      for (const bx of bumps) fillEllipse(c, bx, y - ry + 2, 5, 4, '#16301a');
      fillEllipse(c, x, y, rx, ry, '#2a6030');
      for (const bx of bumps) fillEllipse(c, bx, y - ry + 2, 4, 3, '#3f8a45');
      fillEllipse(c, x - 2, y - 1, rx - 5, Math.max(1, ry - 3), '#3a7d40');
      for (let k = -rx + 3; k < rx - 2; k += 3) rect(c, x + k, y + ry - 2, 1, 2, '#1c4422');
      for (const bx of bumps) { rect(c, bx - 2, y - ry, 1, 2, '#6ab866'); rect(c, bx + 1, y - ry - 1, 1, 2, '#6ab866'); }
    };
    pad(390, 126, 22, 7);
    pad(430, 108, 24, 8);
    pad(456, 134, 16, 6);
    pad(416, 146, 15, 5);
    pad(470, 178, 9, 4);
  }

  // Paper lantern (提灯) hung from the valance in front of a side curtain.
  drawLantern(c, cx, y) {
    rect(c, cx, 58, 1, y - 58, '#120a0a');
    rect(c, cx - 9, y, 18, 6, INK);
    rect(c, cx - 8, y + 1, 16, 1, '#5a5460');
    for (let j = 0; j < 36; j++) {
      const t = (j + 0.5) / 36;
      const hw = Math.round(10 + Math.sin(t * Math.PI) * 5);
      const yy = y + 6 + j;
      const rib = j % 6 === 5;
      rect(c, cx - hw - 1, yy, hw * 2 + 2, 1, INK);
      rect(c, cx - hw, yy, hw * 2, 1, rib ? '#e2d2ae' : '#f6ecd2');
      rect(c, cx - hw + 2, yy, Math.max(1, Math.round(hw * 0.45)), 1, rib ? '#efe2c4' : '#fffaec');
      rect(c, cx + hw - 4, yy, 4, 1, rib ? '#c4b08a' : '#d8c6a0');
    }
    rect(c, cx - 9, y + 42, 18, 6, INK);
    rect(c, cx - 8, y + 43, 16, 1, '#5a5460');
    rect(c, cx - 1, y + 48, 3, 9, '#d8364a');
    rect(c, cx - 1, y + 48, 1, 9, '#ff8090');
    text(c, '笑', cx, y + 16, { size: 16, align: 'center', color: '#c0182c', shadow: null });
  }

  // Proscenium side curtains with gold tiebacks.
  drawCurtains(c) {
    const T = ['#d8364a', '#c02438', '#c02438', '#a01a2c', '#a01a2c', '#8a1424'];
    for (const side of [0, 1]) {
      const x0 = side ? SW - 52 : 0;
      for (let i = 0; i < 4; i++) {
        const fx = x0 + i * 13;
        for (let k = 0; k < 13; k++) rect(c, fx + k, HUD_H, 1, FLOOR_Y - HUD_H, T[Math.min(5, Math.floor(k / 2.2))]);
        rect(c, fx, HUD_H, 1, FLOOR_Y - HUD_H, '#5e0c1a');
      }
      const ex = side ? x0 - 1 : x0 + 52;
      rect(c, ex, HUD_H, 1, FLOOR_Y - HUD_H, '#40060f');
      c.globalAlpha = 0.3;
      rect(c, side ? x0 - 5 : x0 + 53, HUD_H, 4, FLOOR_Y - HUD_H, '#000');
      c.globalAlpha = 1;
      // tieback rope + tassel
      const ty = 146;
      rect(c, x0, ty - 1, 52, 8, '#5a3a0c');
      rect(c, x0, ty, 52, 6, '#e8b830');
      for (let x = x0 + (side ? 1 : 0); x < x0 + 52; x += 4) { rect(c, x, ty, 2, 1, '#fff0a0'); rect(c, x + 2, ty + 5, 2, 1, '#9a7420'); }
      const tx = side ? x0 + 6 : x0 + 44;
      rect(c, tx - 3, ty + 6, 8, 5, '#5a3a0c');
      rect(c, tx - 2, ty + 6, 6, 4, '#e8b830');
      for (let k = 0; k < 6; k++) rect(c, tx - 3 + k + (k > 2 ? 1 : 0), ty + 11, 1, 10 + (k % 2) * 2, k % 2 ? '#c8961e' : '#f2cc4a');
    }
  }

  // Valance (水引幕): sagging red swags, gold rail and fringe, theatre crest.
  drawValance(c) {
    rect(c, 0, HUD_H, SW, 4, '#c8961e');
    rect(c, 0, HUD_H, SW, 1, '#ffe27a');
    rect(c, 0, HUD_H + 3, SW, 1, '#6e4a0e');
    const top = HUD_H + 4;
    for (let x0 = 0; x0 < SW; x0 += 20) {
      const dark = (x0 / 20) % 2;
      for (let i = 0; i < 20; i++) {
        const sag = Math.round(Math.sin(((i + 0.5) / 20) * Math.PI) * 6);
        const h = 20 + sag;
        const col = i < 2 ? '#d0304a' : i > 17 ? '#7e1222' : dark ? '#9a1a2c' : '#b31f34';
        rect(c, x0 + i, top, 1, h, col);
        rect(c, x0 + i, top + 6 + Math.round(sag * 0.4), 1, 1, '#6e0f1e');
        rect(c, x0 + i, top + 12 + Math.round(sag * 0.75), 1, 1, dark ? '#b8283c' : '#cc3248');
        rect(c, x0 + i, top + h, 1, 1, '#4a0814');
        rect(c, x0 + i, top + h + 1, 1, 2, '#e8b830');
        if (i % 3 === 1) rect(c, x0 + i, top + h + 3, 1, 3, '#b8901e');
      }
    }
    // crest
    fillEllipse(c, 320, top + 12, 14, 13, '#6e4a0e');
    fillEllipse(c, 320, top + 12, 13, 12, '#e8b830');
    fillEllipse(c, 320, top + 12, 11, 10, '#fff6e6');
    text(c, '笑', 320, top + 4, { size: 16, align: 'center', color: '#b31f34', shadow: null });
  }

  // Congratulatory flower stand (スタンド花) at stage left.
  drawFlowers(c, r) {
    const cx = 108;
    // tripod
    for (let i = 0; i < 70; i++) {
      const y = 220 + i;
      rect(c, cx - 1, y, 2, 1, '#3a2a1a');
      const s = Math.round(i * 0.22);
      rect(c, cx - 4 - s, y, 2, 1, '#4a3622');
      rect(c, cx + 3 + s, y, 2, 1, '#2e2014');
    }
    rect(c, cx - 22, 289, 10, 2, '#1e140a');
    rect(c, cx + 13, 289, 10, 2, '#1e140a');
    // leaves + blossoms
    fillEllipse(c, cx, 196, 29, 24, '#14301a');
    fillEllipse(c, cx, 196, 28, 23, '#2a5e32');
    fillEllipse(c, cx - 3, 192, 22, 17, '#3a7a40');
    const COLS = [['#ff7eb6', '#c84a86'], ['#fff6f0', '#d0c4c8'], ['#ffd23f', '#c8961e'], ['#e8384a', '#a01a2c'], ['#ffb0d0', '#d07098']];
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const fx = Math.round(cx + Math.cos(a) * d * 22), fy = Math.round(196 + Math.sin(a) * d * 18);
      const [lt, dk] = COLS[Math.floor(r() * COLS.length)];
      rect(c, fx - 3, fy - 1, 7, 4, INK);
      rect(c, fx - 1, fy - 3, 3, 8, INK);
      rect(c, fx - 2, fy - 1, 5, 3, lt);
      rect(c, fx, fy - 2, 1, 6, lt);
      rect(c, fx + 1, fy + 1, 1, 1, dk);
      rect(c, fx, fy, 1, 1, '#ffe27a');
    }
    // name tag
    rect(c, cx - 8, 214, 16, 44, INK);
    rect(c, cx - 7, 215, 14, 42, '#f8f4ea');
    rect(c, cx + 5, 215, 2, 42, '#d8d0bc');
    text(c, '祝', cx, 220, { size: 14, align: 'center', color: '#c0182c', shadow: null });
    rect(c, cx - 4, 240, 8, 12, '#e8384a');
    rect(c, cx - 2, 252, 4, 3, '#a01a2c');
  }

  // めくり (act name stand) at stage right.
  drawMekuri(c) {
    const cx = 548, y = 186;
    rect(c, cx - 12, y + 74, 3, 30, '#2e1a0c');
    rect(c, cx + 9, y + 74, 3, 30, '#2e1a0c');
    rect(c, cx - 12, y + 74, 1, 30, '#6a4422');
    rect(c, cx + 9, y + 74, 1, 30, '#6a4422');
    rect(c, cx - 22, y + 102, 44, 4, '#2e1a0c');
    rect(c, cx - 22, y + 102, 44, 1, '#6a4422');
    rect(c, cx - 19, y, 38, 78, INK);
    rect(c, cx - 18, y + 1, 36, 76, '#f4efe0');
    rect(c, cx + 15, y + 1, 3, 76, '#d6cdb6');
    rect(c, cx - 18, y + 72, 36, 1, '#d6cdb6');
    rect(c, cx - 18, y + 74, 36, 1, '#e4dcc8');
    rect(c, cx - 21, y - 4, 42, 5, '#3a1f0e');
    rect(c, cx - 21, y - 4, 42, 1, '#7a4c26');
    text(c, '漫', cx - 1, y + 8, { size: 24, align: 'center', color: '#1a1a1a', shadow: null });
    text(c, '才', cx - 1, y + 36, { size: 24, align: 'center', color: '#1a1a1a', shadow: null });
    rect(c, cx - 8, y + 64, 14, 4, '#c0303a');
  }

  // Audience silhouettes, each pre-rendered (rim-lit from the stage) for cheap bobbing.
  makeAudience() {
    const r = mulberry32(1234);
    const out = [];
    const add = (x, y, rad, row) => {
      const style = Math.floor(r() * 5);
      const m = { x, y, rad, row, style, ph: r() * 6.28, clap: r() < 0.45 };
      const w = rad * 2 + 34, h = rad * 2 + 34;
      const [cv, c] = makeCanvas(w, h);
      const cx = Math.floor(w / 2), cy = rad + 8;
      const body = row ? '#130e1e' : '#211a30';
      const rim = row ? '#2c2444' : '#3e3458';
      const shapes = [[cx, cy + rad + 14, rad + 12, 12], [cx, cy, rad, rad]];
      if (style === 1) shapes.push([cx + 2, cy - rad - 1, 5, 4]); // bun
      if (style === 3) shapes.push([cx - rad, cy + 3, 4, 6], [cx + rad, cy + 3, 4, 6]); // pigtails
      if (style === 4) shapes.push([cx, cy + rad - 1, 4, 7]); // ponytail
      for (const [x0, y0, rx, ry] of shapes) fillEllipse(c, x0, y0, rx, ry, rim);
      for (const [x0, y0, rx, ry] of shapes) fillEllipse(c, x0 + 1, y0 + 2, rx, ry, body);
      if (style === 2) { rect(c, cx - rad, cy - 2, rad * 2, 2, rim); rect(c, cx - 1, cy - rad - 1, 3, 2, rim); } // cap
      rect(c, cx - Math.round(rad * 0.6), cy - rad, Math.round(rad * 0.5), 1, row ? '#3a3058' : '#55497c');
      m.cv = cv; m.ox = cx; m.oy = cy;
      out.push(m);
    };
    for (let x = 6; x < SW + 10; x += 40) add(x + Math.floor(r() * 10), 326, 13 + Math.floor(r() * 2), 0);
    for (let x = -16; x < SW + 20; x += 52) add(x + Math.floor(r() * 10), 350, 17 + Math.floor(r() * 2), 1);
    return out;
  }

  // Intro card backdrop: the empty stage, dimmed.
  drawBackground(ctx) {
    try {
      if (!this.bg) this.bg = this.renderStage();
      ctx.drawImage(this.bg, 0, 0);
      ctx.fillStyle = 'rgba(8,10,26,0.55)';
      ctx.fillRect(0, 0, SW, SH);
    } catch (e) {
      super.drawBackground(ctx);
    }
  }

  // ---------------------------------------------------------------- drawing
  drawPlay(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shakeT > 0) {
      // fixed jitter pattern (the gameplay RNG is left alone)
      const a = this.shakeT;
      const sx = ((this.pt * 37) % 7) / 6 - 0.5, sy = ((this.pt * 53) % 5) / 4 - 0.5;
      ctx.translate(Math.round(sx * a * 1.5), Math.round(sy * a * 0.9));
    }
    ctx.drawImage(this.bg, 0, 0);
    this.drawShadows(ctx);
    this.drawPartner(ctx);
    this.drawMic(ctx);
    this.drawPlayer(ctx);
    this.drawImpact(ctx);
    this.drawAudience(ctx);
    ctx.restore();

    if (this.bubble) this.drawBubble(ctx, this.bubble);
    if (this.burst) this.drawBurst(ctx, this.burst);
    if (this.emote) this.drawEmote(ctx);
    this.drawHud(ctx);
  }

  bob(phase) {
    return Math.floor((this.pt + phase) / 30) % 2;
  }

  partnerX() {
    if (this.knock <= 0) return PARTNER_X;
    const k = this.knock * this.knock;
    return PARTNER_X - Math.round(k * 7 * Math.min(2, this.knockPow)) * 2;
  }

  playerX() {
    const s = this.slap;
    if (!s) return PLAYER_X;
    const reach = s.weak ? 0.45 : 1;
    const lunge = s.t < 4 ? s.t / 4 : s.t < 16 ? 1 : Math.max(0, 1 - (s.t - 16) / 12);
    return PLAYER_X - Math.round(lunge * 8 * reach) * 2;
  }

  // closing bit: both hop for joy while the audience applauds
  hop(phase) {
    if (this.state !== 'closing' || this.st <= 50 || this.st >= 110) return 0;
    return Math.max(0, Math.round(Math.sin(((this.st - 50) / 60) * Math.PI * 3 + phase) * 3)) * 2;
  }

  drawShadows(ctx) {
    ctx.globalAlpha = 0.32;
    fillEllipse(ctx, this.partnerX() + CW / 2, FEET_Y - 1, 26, 4, '#1a0a04');
    fillEllipse(ctx, this.playerX() + CW / 2, FEET_Y - 1, 26, 4, '#1a0a04');
    fillEllipse(ctx, MIC_X, FEET_Y - 1, 16, 3, '#1a0a04');
    ctx.globalAlpha = 1;
  }

  drawPartner(ctx) {
    const x = this.partnerX();
    let y = FEET_Y - CH;
    let lean = 0; // art px of sideways shift per art px of height (knocked back)
    if (this.knock > 0) lean = Math.tan(this.knock * this.knock * 0.16 * Math.min(2, this.knockPow));
    const talking = this.state === 'type' || (this.state === 'opening' && this.bubble && this.bubble.n < this.bubble.total);
    if (!talking && this.knock === 0) y += this.bob(0) * 2;
    y -= this.hop(0);
    // compose the frame: sprite + mouth
    const c = this.pctx;
    c.clearRect(0, 0, 32, 40);
    c.drawImage(this.boSheet.down[0], 0, 0);
    const thanks = this.state === 'closing' && this.st >= 44 && this.st < 74;
    const open = (talking || thanks) && Math.floor(this.st / 4) % 2 === 0;
    const reacting = this.emote && this.emote.t < 60;
    if (open || this.knock > 0.3) {
      rect(c, 14, 18, 4, 3, '#4a1420');
      rect(c, 15, 20, 2, 1, '#e2707a');
      rect(c, 14, 18, 4, 1, INK);
    } else if (reacting) {
      rect(c, 14, 18, 4, 1, INK);
    }
    // draw at 2x; a knocked partner leans back row by row (crisp shear, no rotation)
    if (!lean) ctx.drawImage(this.pcv, x, y, CW, CH);
    else {
      for (let row = 0; row < 40;) {
        const off = Math.round(lean * (39.5 - row));
        let end = row + 1;
        while (end < 40 && Math.round(lean * (39.5 - end)) === off) end++;
        ctx.drawImage(this.pcv, 0, row, 32, end - row, x - off * 2, y + row * 2, CW, (end - row) * 2);
        row = end;
      }
    }
    // dizzy stars after a perfect tsukkomi
    if (this.stars > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.pt / 7 + i * 2.1;
        twinkle(ctx, x + 32 + Math.cos(a) * 30 - this.knock * 26, 200 + Math.sin(a) * 7, i % 2 ? '#fff6a8' : '#ffffff');
      }
    }
  }

  drawPlayer(ctx) {
    const x = this.playerX();
    let y = FEET_Y - CH;
    let dir = 'down';
    let arm = 0;
    const s = this.slap;
    if (s) {
      const reach = s.weak ? 0.45 : 1;
      const lunge = s.t < 4 ? s.t / 4 : s.t < 16 ? 1 : Math.max(0, 1 - (s.t - 16) / 12);
      dir = s.t < 30 ? 'left' : 'down';
      arm = s.t < 18 ? lunge * reach : 0;
    } else {
      y += this.bob(15) * 2;
    }
    y -= this.hop(0.6);
    const c = this.tctx;
    const ox = 24; // the sprite sits at x 24 of the 56px canvas; the arm reaches left of it
    c.clearRect(0, 0, 56, 40);
    if (dir === 'left' && arm > 0) {
      c.drawImage(this.slapFrame, ox, 0);
      this.drawSlapArm(c, ox, arm, s);
    } else {
      c.drawImage(this.tsSheet[dir][0], ox, 0);
    }
    // shouting / thanking mouth
    const shout = s && !s.weak && s.t < 16 && dir === 'left';
    const thanks = this.state === 'closing' && this.st >= 44 && this.st < 74 && Math.floor((this.st + 2) / 4) % 2 === 0;
    if (shout) { rect(c, ox + 5, 18, 3, 3, '#4a1420'); rect(c, ox + 5, 18, 3, 1, INK); }
    else if (thanks && dir === 'down') { rect(c, ox + 14, 18, 4, 3, '#4a1420'); rect(c, ox + 15, 20, 2, 1, '#e2707a'); rect(c, ox + 14, 18, 4, 1, INK); }
    ctx.drawImage(this.tcv, x - ox * 2, y, 112, CH);
  }

  // Stretched near arm + open hand, in HD art pixels (shoulder at x ox+15, rows 24..28).
  drawSlapArm(c, ox, arm, s) {
    const P = this.armPal;
    const L = Math.round(arm * 26);
    const ax = ox + 13 - L; // sleeve's front end
    const body = ox + 6; // front edge of the torso in the side view
    const sw = ox + 16 - ax;
    // ink outline where the sleeve leaves the body
    if (ax < body) { rect(c, ax, 23, body - ax, 1, INK); rect(c, ax, 29, body - ax, 1, INK); }
    rect(c, ax, 24, sw, 1, P.y);
    rect(c, ax, 25, sw, 3, P.c);
    rect(c, ax, 28, sw, 1, P.D);
    rect(c, ax, 24, 1, 5, P.D); // cuff
    if (L > 10) rect(c, ax + Math.round(sw / 2), 26, 1, 2, P.D); // elbow crease
    // open hand (fingers forward)
    const hx = ax - 6;
    rect(c, hx + 1, 23, 5, 1, INK);
    rect(c, hx + 1, 29, 5, 1, INK);
    rect(c, hx, 24, 1, 5, INK);
    rect(c, hx + 1, 24, 5, 5, P.s);
    rect(c, hx + 1, 25, 3, 1, P.u);
    rect(c, hx + 1, 27, 3, 1, P.u);
    rect(c, hx + 4, 26, 2, 3, P.S);
    rect(c, hx + 1, 24, 2, 1, '#fff2e0');
    // a speed line under the swing
    if (!s.weak && s.t >= 2 && s.t < 10) rect(c, ax + 1, 31, 8, 1, '#ffffff');
  }

  drawMic(ctx) {
    const x = MIC_X;
    // base
    fillEllipse(ctx, x, FEET_Y - 1, 15, 4, INK);
    fillEllipse(ctx, x, FEET_Y - 2, 13, 3, '#3a3d48');
    rect(ctx, x - 9, FEET_Y - 5, 18, 1, '#6a707c');
    // pole
    rect(ctx, x - 3, 230, 6, FEET_Y - 233, INK);
    rect(ctx, x - 2, 230, 4, FEET_Y - 233, '#8a909c');
    rect(ctx, x - 2, 230, 1, FEET_Y - 233, '#e6eaf0');
    rect(ctx, x + 1, 230, 1, FEET_Y - 233, '#5a5f6b');
    rect(ctx, x - 4, 252, 8, 4, INK);
    rect(ctx, x - 3, 253, 6, 2, '#5a5f6b');
    // clip
    rect(ctx, x - 5, 224, 10, 8, INK);
    rect(ctx, x - 4, 225, 8, 6, '#3a3d48');
    rect(ctx, x - 4, 225, 8, 1, '#6a707c');
    // head: grille capsule
    rect(ctx, x - 5, 198, 10, 28, INK);
    rect(ctx, x - 7, 201, 14, 22, INK);
    rect(ctx, x - 6, 199, 12, 26, INK);
    rect(ctx, x - 4, 199, 8, 26, '#b8bcc6');
    rect(ctx, x - 6, 202, 12, 20, '#b8bcc6');
    rect(ctx, x - 5, 200, 10, 24, '#b8bcc6');
    for (let yy = 202; yy < 222; yy += 2) rect(ctx, x - 5, yy, 10, 1, '#7a808c');
    for (let xx = x - 4; xx < x + 5; xx += 3) rect(ctx, xx, 201, 1, 22, '#9aa0ac');
    rect(ctx, x - 6, 211, 12, 3, '#3a3d48');
    rect(ctx, x - 6, 211, 12, 1, '#6a707c');
    rect(ctx, x - 3, 200, 2, 9, '#ffffff');
    rect(ctx, x - 4, 202, 1, 6, '#e6eaf0');
    rect(ctx, x + 3, 214, 2, 8, '#5a5f6b');
  }

  drawImpact(ctx) {
    if (this.impact <= 0) return;
    const { x: cx, y: cy } = IMPACT;
    const r = 12 + (9 - this.impact) * 1.6;
    const rot = this.impact * 0.2;
    fillPoly(ctx, starPts(cx, cy, r + 3, r + 3, 8, 0.45, rot), INK);
    fillPoly(ctx, starPts(cx, cy, r, r, 8, 0.45, rot), '#ffe066');
    fillPoly(ctx, starPts(cx - 1, cy - 1, r * 0.72, r * 0.72, 8, 0.48, rot), '#fff6a8');
    fillPoly(ctx, starPts(cx - 1, cy - 1, r * 0.4, r * 0.4, 8, 0.5, rot), '#ffffff');
    // speed lines
    for (const [dx, dy, w] of [[22, -22, 18], [32, -32, 12], [24, 20, 16]]) {
      rect(ctx, cx + dx, cy + dy + 1, w, 2, INK);
      rect(ctx, cx + dx, cy + dy, w, 2, '#ffffff');
    }
  }

  drawAudience(ctx) {
    const amp = this.laugh;
    const clapOn = amp > 0.45;
    for (const h of this.audience) {
      let dy = 0;
      if (amp > 0.05) dy = -Math.round(Math.abs(Math.sin(this.pt * 0.35 + h.ph)) * 3 * amp) * 2;
      const y = h.y + dy;
      if (clapOn && h.clap) {
        // hands up, clapping
        const apart = Math.floor((this.pt + h.ph * 10) / 5) % 2;
        const hx = apart ? 10 : 4;
        const hy = y - h.rad - 6;
        const body = h.row ? '#130e1e' : '#211a30';
        const rim = h.row ? '#2c2444' : '#3e3458';
        for (const sx of [-1, 1]) {
          // palm above the head, forearm slanting down-outward to the shoulder
          const px = h.x + sx * hx - 4;
          rect(ctx, px + 1, hy, 6, 7, body);
          rect(ctx, px, hy + 1, 8, 5, body);
          rect(ctx, px + 2, hy - 1, 4, 1, rim);
          rect(ctx, px, hy + 1, 1, 3, rim);
          rect(ctx, px + 2 + sx * 2, hy + 7, 4, 4, body);
          rect(ctx, px + 2 + sx * 4, hy + 11, 4, 4, body);
          rect(ctx, px + 2 + sx * 6, hy + 15, 4, 6, body);
        }
      }
      ctx.drawImage(h.cv, h.x - h.ox, y - h.oy);
    }
    // laughter text
    for (const c of this.crowd) {
      if (c.t < 0) continue;
      ctx.globalAlpha = clamp(1 - c.t / 44, 0, 1);
      text(ctx, c.str, c.x, c.y - c.t * 0.8, { size: 16, align: 'center', color: '#ffe680', outline: '#3a1a00' });
      ctx.globalAlpha = 1;
    }
    if (this.silenceT > 0) {
      ctx.globalAlpha = clamp(this.silenceT / 30, 0, 1);
      text(ctx, 'シーン…', 320, 300, { size: 18, align: 'center', color: '#9aa3c7', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  }

  drawBubble(ctx, b) {
    const { x, y, w, h } = b;
    // tails first (their outline is covered by the box)
    for (const tgt of b.tails) {
      const bx = clamp(tgt.x, x + 20, x + w - 20);
      const top = y + h - 3;
      const len = tgt.y - 10 - top;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const cx = Math.round(bx + (tgt.x - bx) * t);
        const hw = Math.round((1 - t) * 9);
        rect(ctx, cx - hw - 2, top + i, hw * 2 + 4, 1, INK);
        if (hw > 0) rect(ctx, cx - hw, top + i, hw * 2, 1, '#ffffff');
        if (hw > 2) rect(ctx, cx + hw - 2, top + i, 2, 1, '#dcdcea');
      }
    }
    roundBox(ctx, x, y, w, h, '#ffffff', INK, '#dcdcea');
    for (const tgt of b.tails) {
      const bx = clamp(tgt.x, x + 20, x + w - 20);
      rect(ctx, bx - 9, y + h - 4, 18, 4, '#ffffff');
      rect(ctx, bx + 7, y + h - 4, 2, 4, '#dcdcea');
    }
    // name tab
    if (b.name) {
      const nw = Math.ceil(measure(ctx, b.name, 14)) + 18;
      roundBox(ctx, x + 10, y - 14, nw, 22, '#ff8a3d', INK, '#d8642a');
      rect(ctx, x + 14, y - 12, nw - 8, 1, '#ffb57a');
      text(ctx, b.name, x + 19, y - 11, { size: 14, color: '#ffffff', shadow: null });
    }
    // text (typewriter)
    let left = b.n;
    b.lines.forEach((line, i) => {
      if (left <= 0) return;
      const chars = Array.from(line);
      const s = left >= chars.length ? line : chars.slice(0, left).join('');
      left -= chars.length;
      text(ctx, s, x + 16, y + 12 + i * b.lh, { size: b.size, color: '#1a1a28', shadow: null });
    });
    if (b.bar) this.drawMaBar(ctx, x + 14, y + 12 + b.lines.length * b.lh + 2, w - 28);
  }

  // The "間" gauge inside the bubble: shown for every line, ボケ and フリ alike.
  drawMaBar(ctx, x, y, w) {
    text(ctx, '間', x, y, { size: 14, color: '#6a6680', shadow: null });
    const bx = x + 22, bw = w - 22, by = y + 1, bh = 14;
    const active = this.state === 'window' || this.state === 'react';
    ctx.globalAlpha = active ? 1 : 0.35;
    rect(ctx, bx, by, bw, bh, INK);
    const zones = [[0, this.winP], [this.winP, this.winG], [this.winG, this.winL]];
    zones.forEach(([a, b], i) => {
      const x0 = bx + 2 + Math.round((a / this.winL) * (bw - 4));
      const x1 = bx + 2 + Math.round((b / this.winL) * (bw - 4));
      const T = tones(ZONE_COLS[i]);
      const zw = Math.max(1, x1 - x0);
      rect(ctx, x0, by + 2, zw, bh - 4, T.mid);
      rect(ctx, x0, by + 2, zw, 2, T.hi);
      rect(ctx, x0, by + bh - 4, zw, 2, T.lo);
    });
    ctx.globalAlpha = 1;
    let t = null;
    if (this.state === 'window') t = this.st;
    else if (this.state === 'react' && this.pressMark) t = this.pressMark.t;
    if (t != null) {
      const mx = bx + 2 + Math.round((clamp(t, 0, this.winL) / this.winL) * (bw - 8));
      rect(ctx, mx - 2, by - 4, 8, bh + 8, INK);
      rect(ctx, mx, by - 2, 4, bh + 4, '#ffffff');
      rect(ctx, mx + 2, by - 2, 2, bh + 4, '#c8ccd8');
    }
  }

  // Lay out a burst once: shrink to 16px, then wrap a long (custom) ツッコミ into rows.
  burstLayout(ctx, b) {
    if (b.rows) return;
    const MAX = 264;
    let size = b.size || 18;
    while (measure(ctx, b.text, size) > MAX && size > 16) size--;
    const rows = measure(ctx, b.text, size) > MAX ? wrap(ctx, b.text, MAX, size) : [b.text];
    let tw = 0;
    for (const r of rows) tw = Math.max(tw, measure(ctx, r, size));
    Object.assign(b, { rows, fs: size, tw });
  }

  drawBurst(ctx, b) {
    this.burstLayout(ctx, b);
    const { rows, fs: size, tw } = b;
    const lh = size + 4;
    const pop = b.t < 6 ? 0.6 + b.t * 0.07 : 1;
    const rx = (tw / 2 + 30) * pop;
    const ry = ((b.weak ? 24 : 30) + (rows.length - 1) * lh * 0.6) * pop;
    const cx = Math.round(Math.min(SW - 14 - rx, 484));
    let cy = 150;
    // keep clear of a tall speech bubble
    const bb = this.bubble;
    if (bb && bb.x + bb.w > cx - rx) cy = clamp(bb.y + bb.h + ry + 6, 150, 190);
    cy = Math.round(cy);
    const rot = b.t * 0.01;
    fillPoly(ctx, starPts(cx, cy, rx + 3, ry + 3, 14, 0.8, rot), INK);
    fillPoly(ctx, starPts(cx, cy, rx, ry, 14, 0.8, rot), b.weak ? '#c4c0d2' : '#f2c84a');
    fillPoly(ctx, starPts(cx - 1, cy - 1, rx - 5, ry - 5, 14, 0.8, rot), b.weak ? '#e8e4f0' : '#fff2a0');
    if (b.t < 5) return; // text appears once the burst has (almost) fully popped
    const top = Math.round(cy - (rows.length * lh) / 2 + 2);
    const col = b.weak ? '#4a4660' : '#c0182c';
    rows.forEach((r, i) => {
      // drawn twice, 1px apart: a bolder shout
      text(ctx, r, cx, top + i * lh, { size, align: 'center', color: col, shadow: null });
      text(ctx, r, cx + 1, top + i * lh, { size, align: 'center', color: col, shadow: null });
    });
  }

  drawEmote(ctx) {
    const e = this.emote;
    if (e.t > 70) return;
    const x = PARTNER_X + 62, y = 160 - (e.t < 6 ? (6 - e.t) * 2 : 0);
    // tail toward the partner's head (drawn first, the box covers its top)
    rect(ctx, x + 2, y + 24, 10, 4, INK);
    rect(ctx, x, y + 28, 6, 4, INK);
    rect(ctx, x + 4, y + 24, 6, 3, '#ffffff');
    rect(ctx, x + 2, y + 27, 3, 3, '#ffffff');
    roundBox(ctx, x, y, 30, 28, '#ffffff', INK, '#dcdcea');
    rect(ctx, x + 4, y + 24, 6, 2, '#ffffff');
    text(ctx, e.ch, x + 15, y + 6, { size: 16, align: 'center', color: e.ch === '！' ? COLORS.bad : '#1a1a28', shadow: null });
  }

  drawHud(ctx) {
    rect(ctx, 0, 0, SW, HUD_H, '#0b0d1e');
    rect(ctx, 0, HUD_H - 2, SW, 1, '#3a3060');
    rect(ctx, 0, HUD_H - 1, SW, 1, '#05060f');
    const total = this.script.length;
    const n = clamp(this.idx + 1, 0, total);
    text(ctx, `ネタ ${n}/${total}`, 12, 4, { size: 16, color: COLORS.text });
    text(ctx, '爆笑', 168, 4, { size: 16, color: COLORS.accent });
    const frac = clamp(this.shown, 0, 1);
    this.drawMeter(ctx, 208, 6, 248, 14, frac);
    text(ctx, String(Math.round(frac * 100)), 466, 4, { size: 16, color: COLORS.text });
    if (this.combo >= 2) text(ctx, `${this.combo}コンボ`, SW - 12, 4, { size: 16, align: 'right', color: COLORS.pink });
    this.drawHint(ctx);
  }

  // Laugh meter with tick marks at the rank lines (35 / 55 / 75 / 90).
  drawMeter(ctx, x, y, w, h, frac) {
    rect(ctx, x, y, w, h, '#000');
    rect(ctx, x + 1, y + 1, w - 2, h - 2, '#2a2f55');
    rect(ctx, x + 1, y + 1, w - 2, 2, '#1e2244');
    const fw = Math.round(clamp(frac, 0, 1) * (w - 2));
    if (fw > 0) {
      const T = tones(frac >= 0.9 ? COLORS.accent : frac >= 0.55 ? COLORS.pink : COLORS.cyan);
      rect(ctx, x + 1, y + 1, fw, h - 2, T.mid);
      rect(ctx, x + 1, y + 1, fw, 3, T.hi);
      rect(ctx, x + 1, y + h - 4, fw, 3, T.lo);
    }
    for (const t of [0.35, 0.55, 0.75, 0.9]) {
      const tx = x + 1 + Math.round(t * (w - 2));
      rect(ctx, tx, y + 1, 1, h - 2, tx < x + 1 + fw ? 'rgba(255,255,255,0.5)' : '#454b80');
    }
  }

  // Control hint along the bottom, with A / B button glyphs.
  drawHint(ctx) {
    const parts = ['ボケの直後に', 'A', 'でツッコミ！　フリは', 'B', 'で見送り'];
    if (!this.hintW) this.hintW = parts.map((p) => (p.length === 1 ? 20 : Math.ceil(measure(ctx, p, 14))));
    const gap = 5;
    let x = Math.round((SW - this.hintW.reduce((a, b) => a + b + gap, -gap)) / 2);
    const y = SH - 20;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, y, SW, 20);
    parts.forEach((p, i) => {
      if (p.length === 1) {
        const fill = p === 'A' ? '#ff7a5c' : '#5fa8ff';
        rect(ctx, x + 2, y + 2, 16, 16, INK);
        rect(ctx, x + 1, y + 4, 18, 12, INK);
        rect(ctx, x + 3, y + 3, 14, 14, fill);
        rect(ctx, x + 2, y + 5, 16, 10, fill);
        rect(ctx, x + 5, y + 4, 6, 1, '#ffffff');
        text(ctx, p, x + 10, y + 3, { size: 14, align: 'center', color: '#ffffff', shadow: null });
      } else {
        text(ctx, p, x, y + 3, { size: 14, color: '#c8cce6', shadow: null });
      }
      x += this.hintW[i] + gap;
    });
  }
}

registerMinigame('tsukkomi', TsukkomiManzai);
