// 政治家AI (R11-P) — the words. Plain Japanese, no real names. Every reason is a clause that reads naturally before the verb it explains
// ("世論調査が悪く、次の選挙を恐れて" + "離党した"). Nothing here attributes misconduct to a real party: the callers pick neutral reasons for 自民 / 民主.

export const AX = ['econ', 'power', 'social', 'world', 'env', 'nation', 'tech'];
// axis → [label, left end (-1), right end (+1)] — the same axes as ideology.js
export const AXN = {
  econ: ['経済', '平等・計画', '市場・自由'],
  power: ['権力', '分権・自由', '集権・権威'],
  social: ['社会', '進歩・変革', '伝統・秩序'],
  world: ['外交', '国際協調', '自国優先'],
  env: ['環境', '成長優先', '環境優先'],
  nation: ['国家', '統合', '自治・分離'],
  tech: ['技術', '慎重', '積極'],
};
// the ladder (当選 → 派閥の幹部 → 党役員 → 大臣 → 党首 → 総理)
export const RUNG = ['一議員', '派閥の幹部', '党役員', '大臣', '党首', '総理'];
export const RUNG_GOAL = ['当選を重ねる', '派閥の幹部になる', '党役員（三役）になる', '大臣になる', '党首になる', '総理になる'];
export const RUNG_TIP = ['まず議席を守り、当選回数を積む', '派閥の領袖か番頭として仲間を束ねる', '幹事長・政調会長などの党の要職に就く', '内閣に入り、省庁を預かる', '党首（総裁・代表）の座を狙う', '首班指名を受けて内閣を組織する'];

// memory kinds: code → [label (what the agent remembers), weight toward the player (-30..30)]
export const MEM = {
  favor: ['地元や党の用件で力を貸してくれた', 9],
  placate: ['不満を聞いて気づかってくれた', 6],
  post: ['ポストを与えてくれた', 16],
  reward: ['人事で報いてくれた', 12],
  punish: ['人事で冷遇された', -16],
  fired: ['ポストを外された', -20],
  expose: ['弱みを突かれた', -26],
  poach: ['仲間を引き抜かれた', -9],
  yes: ['自分の法案に賛成してくれた', 6],
  no: ['自分の法案に反対された', -7],
  scandal: ['あなたの不祥事で党が打撃を受けた', -7],
  plot_join: ['倒閣の動きに同調してくれた', 12],
  plot_oppose: ['倒閣の動きに立ちはだかった', -14],
  rival: ['党内の同じ席を争っている', -8],
  talk: ['話を聞いてくれた', 3],
  elected: ['選挙で肩を並べて戦った', 4],
  lost: ['選挙で敗れた', 0],
  won: ['選挙で勝った', 0],
  demoted: ['人事で外された', 0],
};

// reasons for each action: [clause, ...]. The caller picks the clause that fits the strongest term.
export const WHY = {
  leave: {
    fit: '党の方針との距離が開き、',
    loyal: '党執行部への不信が募り、',
    poll: '世論調査が悪く、次の選挙を恐れて',
    post: '要職から遠ざけられ、',
    alt: 'もっと考えの近い仲間のもとへ行こうと',
  },
  faction: {
    fit: '考えの近い仲間のいる',
    power: '勢いのある',
    loyal: '領袖への不満から、',
    post: 'ポストに近い',
  },
  join: {
    fit: '考えが近い',
    chance: '当選の見込みが高い',
    leader: '党首の誘いを受け、',
  },
  ask: { default: '入閣待望組として、' },
  retire: {
    age: '高齢のため、',
    health: '体調がすぐれず、',
    defeat: '選挙で敗れたことを機に、',
    heir: '後継者に道を譲ろうと',
    stress: '激務で心身が消耗し、',
  },
  plot: {
    low: '内閣の支持率が低迷しているのを見て、',
    amb: '次の党首の座を見据え、',
    grudge: '冷遇への不満から、',
    election: '選挙の顔を代えるべきだと、',
  },
  run: {
    ready: '派内の推薦人がそろい、',
    amb: '総理の座を目指して、',
    slot: '党内の流れをみて、',
  },
  scandal: { money: '政治資金の扱いで', private: '私生活の問題で' },
  gaffe: { stress: '激務で疲れが出て', slip: '気のゆるみから' },
};

export const ATT_WORDS = [
  [60, '強い信頼', '#5ee07a'],
  [32, '好意的', '#8fe08a'],
  [10, 'やや好意的', '#b8e0a0'],
  [-10, '中立', '#9aa3c8'],
  [-32, 'やや警戒', '#ffb03a'],
  [-60, '敵対的', '#ff8a5a'],
  [-101, '強い敵意', '#ff6b78'],
];
export function attWord(v) {
  for (const [t, w, c] of ATT_WORDS) if (v >= t) return { text: w, color: c };
  return { text: '強い敵意', color: '#ff6b78' };
}
export const MOOD_WORDS = [[40, '意気軒昂'], [15, '安定'], [-10, '落ち着かない'], [-35, '不満がたまっている'], [-101, '党への不信が深い']];
export function moodWord(v) { for (const [t, w] of MOOD_WORDS) if (v >= t) return w; return '不満がたまっている'; }

// kinds of timeline entries → icon letter + colour for the UI
export const KIND_STYLE = {
  leave: ['離', '#ff8a5a'], join: ['入', '#5ee07a'], faction: ['派', '#5fd7ff'], ask: ['求', '#e8c25a'], retire: ['退', '#9aa3c8'], die: ['逝', '#9aa3c8'],
  heir: ['継', '#b8a0ff'], plot: ['倒', '#ff6b78'], run: ['党', '#e8c25a'], scandal: ['疑', '#ff6b78'], gaffe: ['失', '#ffb03a'], rebel: ['造', '#ff8a5a'],
  elect: ['当', '#5ee07a'], lose: ['落', '#ff8a5a'], post: ['任', '#5fd7ff'], mentor: ['師', '#5ee07a'], rival: ['敵', '#ff8a5a'], court: ['誘', '#e8c25a'],
  meta: ['潮', '#b8a0ff'], strat: ['策', '#b8a0ff'], gov: ['知', '#e8c25a'], learn: ['学', '#5fd7ff'],
};

// ---------------------------------------------------------------- fictional names for successors and newcomers (seeded; never a real person)
import { isRealNameLike } from './contests_gen.js';
const SUR = ['青柳', '秋元', '浅見', '安達', '荒川', '飯田', '池田', '石井', '板倉', '今井', '岩田', '植田', '内田', '江口', '遠藤', '大野', '岡田', '奥村', '尾形', '加藤',
  '河野', '木村', '工藤', '栗原', '小林', '近藤', '斎藤', '酒井', '佐久間', '塩見', '菅野', '鈴木', '関根', '平田', '武田', '田村', '丹羽', '土井', '堤', '寺内',
  '戸田', '長尾', '成瀬', '野村', '服部', '馬場', '東', '日置', '福田', '藤井', '古谷', '星野', '堀', '前田', '丸橋', '三浦', '宮本', '村上', '森田', '八木',
  '山口', '吉田', '米田', '和泉', '渡辺'];
const GIV_M = ['健太郎', '博文', '和也', '雄大', '拓海', '慎吾', '裕樹', '亮介', '智也', '洋平', '一輝', '大地', '俊介', '悠斗', '康平', '勇気', '孝弘', '誠司', '直樹', '良太'];
const GIV_F = ['美咲', '由香', '麻衣', '彩乃', '里奈', '真由', '香織', '千尋', '沙織', '麻美', '直美', '理沙', '優子', '奈々', '遥'];
const HAIR_M = ['short', 'slick', 'short', 'short'];
const HAIR_F = ['bob', 'long', 'bob'];
const SUIT = ['#2a2f45', '#3a3f55', '#1f2a3a', '#4a4a52', '#2f3a4f', '#5a4a3a'];
const TIE = ['#c0452f', '#2f6fd0', '#2f8f4e', '#8a3ab9', '#d0a03a', '#7a1f2f'];
// rand: a function () -> [0,1) (the seeded stream of the caller); taken: Set of full names in use; surname: keep this one (a child)
export function seededName(rand, taken, surname = null, female = false) {
  const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
  for (let i = 0; i < 30; i++) {
    const s = surname || pick(SUR);
    const gv = pick(female ? GIV_F : GIV_M);
    const name = `${s} ${gv}`;
    if (!taken.has(name) && !isRealNameLike(name) && !isRealNameLike(s + gv)) return name;
  }
  return `${surname || pick(SUR)} ${pick(female ? GIV_F : GIV_M)}${Math.floor(rand() * 90) + 10}`;
}
export function seededLook(rand, female, age) {
  const pick = (a) => a[Math.floor(rand() * a.length) % a.length];
  const hairColor = age >= 66 ? pick(['white', 'gray', 'silver']) : age >= 54 ? pick(['gray', 'black', 'silver']) : pick(['black', 'black', 'brown']);
  return female
    ? { hair: pick(HAIR_F), hairColor: age >= 54 ? pick(['gray', 'brown']) : pick(['black', 'brown']), top: pick(['#7a3a5a', '#3a4a7a', '#5a5a6a', '#8a6a4a']), bottom: '#2a2d36', jacket: true, skirt: rand() < 0.5, lashes: true }
    : { hair: pick(HAIR_M), hairColor, top: pick(SUIT), bottom: '#2a2d36', jacket: true, tie: pick(TIE), glasses: rand() < 0.35 };
}
