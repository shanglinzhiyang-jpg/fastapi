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
export function gauss(r) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------- word lists (all invented combinations)
const KATA_A = ['ネオン', 'カラクリ', 'ポンコツ', 'ミドリ', 'ハッカ', 'ドロップ', 'マーブル', 'ブリキ', 'ペンギン', 'チクワ', 'メトロ', 'ガラパゴス', 'ハリネズミ',
  'コンパス', 'ポップコーン', 'サボテン', 'トランポリン', 'オセロ', 'フラミンゴ', 'カスタネット', 'ラッコ', 'ミルフィーユ', 'ヨーヨー', 'パラシュート', 'ハンモック',
  'マトリョーシカ', 'カピバラ', 'ピクニック', 'モノレール', 'ジャンボ', 'ナポリタン', 'パズル', 'スプーン', 'ブランコ', 'タンバリン', 'バルーン', 'マシュマロ',
  'ラムネ', 'ペリカン', 'コロッケ', 'シーソー', 'ダイヤル', 'テトラ', 'ホチキス', 'ピーナッツ', 'カモメ', 'グミ', 'ウクレレ', 'ポテト', 'ネジ', 'アンテナ'];
const KATA_B = ['ボーイズ', 'ガールズ', 'ブラザーズ', 'クラブ', 'ハウス', 'ステーション', 'ファクトリー', 'パレード', 'ジャンクション', 'カンパニー', 'エクスプレス',
  'マーケット', 'ランド', 'サーカス', 'ホテル', 'スタンド', 'ラボ', 'ベーカリー', 'ストア', 'ロケット', 'ガレージ', 'バンド', 'ブルース', 'ポスト', 'タワー', 'ドライブ'];
const KAN_A = ['三丁目', 'ゆうやけ', '回覧板', '黒豆', '鉄瓶', '踏切', '縁側', '湯けむり', '風見鶏', '豆電球', '金魚', '月見', '雨上がり', '文鎮', '学級',
  '下町', '路地裏', '団地', '駄菓子', '満月', '鈴虫', '石畳', '灯台', '朝凪', '夜更かし', '茶柱', '屋台', '押し入れ', '番台', '銭湯', '線香花火', '寝ぐせ', '万年筆',
  '日めくり', '綿あめ', '小春', '水玉', '口笛', '紙ふうせん', '雪見', '鍋底', '湯たんぽ', '三角定規', '方眼紙', '大盛り', '二度寝', '寄り道'];
const KAN_B = ['商店', '定食', '劇場', '探偵団', '横丁', '銀行', '学園', '急行', '組合', '工務店', '研究所', '音頭', '一座', '本舗', '食堂', '会議', '旅団',
  '倶楽部', '交番', '新聞', '放送局', '温泉', '社中', '親衛隊', '天国', '計画', '同好会', '観測所', '保存会', '自治会'];
const HIRA = ['おむすび', 'こんぺいとう', 'ひなたぼっこ', 'まんまる', 'ぽかぽか', 'のりしお', 'ちくわぶ', 'すきま', 'ごはんつぶ', 'はなまる', 'どんぐり', 'もちもち',
  'きなこ', 'ぺらぺら', 'ほかほか', 'くるみ', 'ゆでたまご', 'ねじまき', 'ちょうちん', 'たんぽぽ'];
const HIRA_B = ['ず', 'くらぶ', 'しょうてん', 'かぞく', 'きょうだい', 'ぐみ', 'れっしゃ', 'でんわ', 'びより'];
const EN_A = ['ミッドナイト', 'サニー', 'ブルー', 'ゴールデン', 'ハイパー', 'ルナ', 'ネクスト', 'ラッキー', 'スモール', 'ビッグ', 'ワイルド', 'クール', 'ホット', 'ドリーム', 'サンデー'];
const EN_B = ['パンダ', 'ポテト', 'ゴリラ', 'ペンギン', 'ラビット', 'ハムスター', 'アルパカ', 'ドーナツ', 'トースト', 'オムレツ', 'プリン', 'ワッフル', 'ピザ', 'カレー'];
const TRIO_SUFFIX = ['ズ', '団', 'トリオ', '三兄弟', '一家', '隊', '組'];

const SURNAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林',
  '斎藤', '清水', '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川', '前田', '岡田', '長谷川', '藤田', '後藤', '近藤', '村上', '遠藤',
  '青木', '坂本', '斉藤', '福田', '太田', '西村', '藤井', '金子', '岡本', '藤原', '三浦', '中野', '原田', '松田', '竹内', '小野', '田村', '和田', '中山', '石田',
  '上田', '森田', '柴田', '酒井', '工藤', '横山', '宮崎', '宮本', '内田', '高木', '安藤', '谷口', '大野', '丸山', '今井', '河野', '藤本', '村田', '武田', '上野',
  '杉山', '増田', '平野', '大塚', '千葉', '久保', '松井', '小島', '岩崎', '桜井', '野口', '松尾', '野村', '木下', '菊地', '佐野', '大西', '杉本', '新井', '浜田',
  '市川', '古川', '水野', '小松', '島田', '高野', '吉川', '山内', '西田', '菅原', '服部', '川口', '辻', '関', '秋山', '早川', '星野', '大石', '荒木', '本田'];
const GIVEN_M = ['大輔', '健太', '翔太', '拓也', '直樹', '亮', '誠', '剛', '修', '浩二', '隆', '学', '聡', '達也', '和也', '雄一', '慎吾', '大樹', '悠斗', '蓮',
  '陽向', '湊', '颯太', '蒼', '樹', '一郎', '健一', '正人', '勝也', '秀樹', '茂', '博', '実', '徹', '宏', '光', '進', '登', '豊', '勇'];
const GIVEN_F = ['陽子', '恵子', '由美', '真由美', '美穂', '直美', '愛', '彩', '舞', '優子', '恵', '麻衣', '結衣', '美咲', '花', '陽菜', '凛', '葵', '芽依', '咲',
  '久美子', '幸子', '典子', '早苗', '春香', '千尋', '明日香', '奈々', '真央', '琴音'];
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

// ---------------------------------------------------------------- names
export function personName(r, female = r() < 0.18) {
  return `${pickR(r, SURNAMES)} ${pickR(r, female ? GIVEN_F : GIVEN_M)}`;
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
    if (!BLOCK.has(n)) return n;
  }
  return 'ドット' + Math.floor(r() * 1000);
}
export function kidName(r) { return `${pickR(r, SURNAMES)} ${pickR(r, KID_NAMES)}`; }

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
  return { name, title: `${title}${unit ? '・' + unit : ''}（芸歴${career}年）`, short: shortOf(name), taste: taste.label, tasteId: taste.id, tastePart: taste.part, dialect, strict: Math.round((r() - 0.5) * 6), look: lookFor(r, female), female };
}

// What a judge says about a performance (score 0..100, result parts), in their own voice.
export function judgeComment(r, j, score, res = {}) {
  const k = j.dialect === 'kansai';
  const part = j.tastePart || 'neta';
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
  upset: ['まさか{name}が落ちるとは…', '{name}が敗退は荒れすぎ', '予選の審査、たまにわからない', '{name}は来年リベンジしてほしい'],
  player: ['{name}って誰？めっちゃおもろかった', '{name}、名前覚えた', '{name}のネタ、もう一回見たい', 'え、{name}おもろいやん', '{name}、まだ伸びるでこれは'],
  playerBad: ['{name}、緊張してたな', '{name}は次に期待', '{name}、ネタ選びが惜しかった'],
};
export function fillName(s, name) { return String(s).replaceAll('{name}', name); }
