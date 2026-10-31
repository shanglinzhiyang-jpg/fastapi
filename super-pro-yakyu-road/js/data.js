// スーパープロ野球ロード — data: the 12 clubs (the user's chosen lineup of the two leagues, by name and club colours only:
// no logos or mascots are drawn), fictional player names, the abilities and their grades (S..G), the pitch types and how
// they break, and the player generator. Every player is made up.
import { clamp, pick, randInt, gauss } from './core.js';

export const LEAGUES = { C: { name: 'セントラル・リーグ', short: 'セ・リーグ' }, P: { name: 'パシフィック・リーグ', short: 'パ・リーグ' } };
// main / sub colours, the letters on the cap (no logos: the club colours and the letters only)
export const TEAMS = [
  { id: 'baystars', league: 'C', city: '横浜', name: 'ベイスターズ', full: '横浜ベイスターズ', short: '横浜', c1: '#0a55a8', c2: '#ffffff', mark: 'YB' },
  { id: 'carp', league: 'C', city: '広島', name: '東洋カープ', full: '広島東洋カープ', short: '広島', c1: '#e3001a', c2: '#ffffff', mark: 'C' },
  { id: 'swallows', league: 'C', city: '東京', name: 'ヤクルトスワローズ', full: '東京ヤクルトスワローズ', short: 'ヤクルト', c1: '#0c2a6c', c2: '#2bb04a', mark: 'S' },
  { id: 'tigers', league: 'C', city: '', name: '阪神タイガース', full: '阪神タイガース', short: '阪神', c1: '#1c1c1c', c2: '#ffe100', mark: 'T' },
  { id: 'dragons', league: 'C', city: '', name: '中日ドラゴンズ', full: '中日ドラゴンズ', short: '中日', c1: '#00296b', c2: '#12aee8', mark: 'D' },
  { id: 'giants', league: 'C', city: '', name: '読売ジャイアンツ', full: '読売ジャイアンツ', short: '巨人', c1: '#f47a0c', c2: '#1a1a1a', mark: 'G' },
  { id: 'hawks', league: 'P', city: '福岡', name: 'ダイエーホークス', full: '福岡ダイエーホークス', short: 'ダイエー', c1: '#f39200', c2: '#222222', mark: 'H' },
  { id: 'buffaloes', league: 'P', city: '', name: '近鉄バファローズ', full: '近鉄バファローズ', short: '近鉄', c1: '#d6000f', c2: '#14285a', mark: 'Bu' },
  { id: 'bluewave', league: 'P', city: '', name: 'オリックスブルーウェーブ', full: 'オリックスブルーウェーブ', short: 'オリックス', c1: '#0a2058', c2: '#d6a91a', mark: 'BW' },
  { id: 'fighters', league: 'P', city: '北海道', name: '日本ハムファイターズ', full: '北海道日本ハムファイターズ', short: '日本ハム', c1: '#1a2a5c', c2: '#b8a060', mark: 'F' },
  { id: 'lions', league: 'P', city: '埼玉', name: '西武ライオンズ', full: '埼玉西武ライオンズ', short: '西武', c1: '#1c3e8c', c2: '#4aa6e4', mark: 'L' },
  { id: 'marines', league: 'P', city: '千葉', name: 'ロッテマリーンズ', full: '千葉ロッテマリーンズ', short: 'ロッテ', c1: '#1a1a1a', c2: '#ffffff', mark: 'M' },
];
export const teamOf = (id) => TEAMS.find((t) => t.id === id) || TEAMS[0];
export const fullTeamName = (id) => teamOf(id).full;

// ---------------------------------------------------------------- names (fictional combinations)
const FAM = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水',
  '山崎', '森', '池田', '橋本', '阿部', '石川', '山下', '中島', '石井', '小川', '前田', '岡田', '長谷川', '藤田', '後藤', '近藤', '村上', '遠藤', '青木', '坂本',
  '斉藤', '福田', '太田', '西村', '藤井', '金子', '岡本', '藤原', '中野', '三浦', '原田', '中川', '松田', '竹内', '小野', '田村', '中山', '和田', '石田', '森田',
  '上田', '原', '柴田', '酒井', '工藤', '横山', '宮崎', '宮本', '内田', '高木', '安藤', '島田', '谷口', '大野', '丸山', '今井', '河野', '藤本', '村田', '武田',
  '星野', '早川', '桜井', '大谷口', '神田', '千葉', '久保', '野口', '松尾', '菊地', '東', '北村', '南', '西田', '東山', '若林', '白石', '黒田', '赤井', '青山'];
const GIV = ['翔', '大輔', '健太', '拓也', '直樹', '和也', '雄太', '亮', '誠', '剛', '隼人', '駿', '蓮', '陽斗', '悠真', '颯', '大和', '湊', '樹', '陸',
  '一輝', '光', '航', '勇気', '祐介', '康平', '慎吾', '智也', '涼', '海斗', '龍之介', '圭', '凌', '尚人', '達也', '良太', '貴之', '秀樹', '浩二', '敦',
  '健吾', '将太', '優斗', '晴', '心', '大翔', '空', '瑛太', '拓海', '奏', '岳', '修平', '純', '伸也', '博之', '雅人', '大地', '翼', '昂', '丈'];
export const makeName = (r) => ({ fam: pick(FAM, r), giv: pick(GIV, r) });

// ---------------------------------------------------------------- abilities and grades
export const GRADES = [[90, 'S', '#ffcf3a'], [80, 'A', '#ff5a8a'], [70, 'B', '#ff8a3a'], [60, 'C', '#ffd84a'], [50, 'D', '#b6e04a'], [40, 'E', '#5ec46a'], [20, 'F', '#4aa8e8'], [0, 'G', '#9aa4b8']];
export function grade(v) { for (const [min, g, col] of GRADES) if (v >= min) return { g, col }; return { g: 'G', col: '#9aa4b8' }; }
export const BAT_ABL = [['meet', 'ミート'], ['power', 'パワー'], ['speed', '走力'], ['arm', '肩力'], ['field', '守備力'], ['catch', '捕球']];
export const POS = { C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手', SS: '遊撃手', LF: '左翼手', CF: '中堅手', RF: '右翼手', P: '投手', DH: '指名打者' };
export const POS_SHORT = { C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', P: '投', DH: '指' };
export const FIELD_POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

// the balance of the league (chosen at the start of a pennant): × hits on balls in play, × home runs, × strikeouts
export const BALANCE = {
  pitch: { name: '投高', desc: '投手が強い。ロースコアの接戦が多い', hit: 0.9, hr: 0.7, k: 1.15 },
  normal: { name: '標準', desc: 'いまのプロ野球くらい', hit: 1, hr: 1, k: 1 },
  bat: { name: '打高', desc: '打者が強い。点の取り合いになりやすい', hit: 1.09, hr: 1.4, k: 0.88 },
  slug: { name: '超打高', desc: 'ホームランが飛び交う、乱打戦の世界', hit: 1.17, hr: 1.9, k: 0.78 },
};
export const BALANCE_ORDER = ['pitch', 'normal', 'bat', 'slug'];

// pitch types: hx / vy = break at the plate in zone units (+x = to the catcher's right for a right-hander, +y = down),
// spd = speed vs the fastball, key = the direction it is picked with
export const PITCHES = {
  st: { name: 'ストレート', short: '直', hx: 0, vy: -0.08, spd: 1, col: '#ffffff' },
  slider: { name: 'スライダー', short: 'ス', hx: 0.55, vy: 0.12, spd: 0.9, col: '#6ad0ff' },
  curve: { name: 'カーブ', short: 'カ', hx: 0.45, vy: 0.55, spd: 0.8, col: '#7ab0ff' },
  cutter: { name: 'カットボール', short: 'カッ', hx: 0.28, vy: 0.04, spd: 0.95, col: '#9ae0ff' },
  fork: { name: 'フォーク', short: 'フ', hx: 0, vy: 0.75, spd: 0.88, col: '#ffb46a' },
  change: { name: 'チェンジアップ', short: 'チ', hx: -0.12, vy: 0.42, spd: 0.8, col: '#ffd06a' },
  shoot: { name: 'シュート', short: 'シ', hx: -0.45, vy: 0.14, spd: 0.92, col: '#ff8ab4' },
  sinker: { name: 'シンカー', short: 'シン', hx: -0.4, vy: 0.5, spd: 0.85, col: '#ff9ad0' },
};
export const BREAKERS = ['slider', 'curve', 'cutter', 'fork', 'change', 'shoot', 'sinker'];

let SEQ = 1;
export const resetSeq = (n) => { SEQ = n; };
export const nextSeq = () => SEQ;
const ab = (base, r, sd = 9) => clamp(Math.round(base + gauss(r) * sd), 5, 99);

// a batter for a position; tier: the club's strength offset (−6..+6), role: 'star' | 'reg' | 'bench'
export function makeBatter(r, pos, tier = 0, role = 'reg') {
  const b = role === 'star' ? 66 : role === 'reg' ? 56 : 47;
  const n = makeName(r);
  const p = {
    id: `p${SEQ++}`, ...n, pos, pitcher: false, bats: r() < 0.32 ? 'L' : 'R', age: randInt(20, 36, r), num: 0,
    meet: ab(b + tier, r), power: ab(b + tier - 2, r, 14), speed: ab(b + tier, r, 13), arm: ab(b + tier, r), field: ab(b + tier, r), catch: ab(b + tier, r),
  };
  // the position shapes the player
  if (pos === 'C') { p.arm = clamp(p.arm + 6, 5, 99); p.speed = clamp(p.speed - 12, 5, 99); p.catch = clamp(p.catch + 6, 5, 99); }
  if (pos === 'SS' || pos === '2B') { p.field = clamp(p.field + 8, 5, 99); p.speed = clamp(p.speed + 5, 5, 99); p.power = clamp(p.power - 8, 5, 99); }
  if (pos === 'CF') { p.speed = clamp(p.speed + 10, 5, 99); p.field = clamp(p.field + 4, 5, 99); }
  if (pos === '1B' || pos === 'DH') { p.power = clamp(p.power + 10, 5, 99); p.field = clamp(p.field - 8, 5, 99); p.speed = clamp(p.speed - 6, 5, 99); }
  if (pos === 'LF' || pos === 'RF' || pos === '3B') p.power = clamp(p.power + 5, 5, 99);
  p.traj = p.power >= 80 ? 4 : p.power >= 62 ? 3 : p.power >= 42 ? 2 : 1;
  return p;
}
// a pitcher; role: 'sp' (starter) | 'rp' (relief) | 'cl' (closer)
export function makePitcher(r, role = 'sp', tier = 0, ace = false) {
  const n = makeName(r);
  const b = (ace ? 66 : role === 'sp' ? 56 : 52) + tier;
  const nPitch = role === 'sp' ? randInt(2, 4, r) : randInt(1, 3, r);
  const pool = BREAKERS.slice();
  const pitches = [];
  for (let i = 0; i < nPitch; i++) {
    const k = pool.splice(Math.floor(r() * pool.length), 1)[0];
    pitches.push({ t: k, lv: clamp(Math.round(2 + (b - 50) / 9 + gauss(r) * 1.1 + (i === 0 ? 1 : 0)), 1, 7) });
  }
  return {
    id: `p${SEQ++}`, ...n, pos: 'P', pitcher: true, role, throws: r() < 0.28 ? 'L' : 'R', bats: r() < 0.3 ? 'L' : 'R', age: randInt(20, 37, r), num: 0,
    velo: clamp(Math.round(141 + (b - 55) * 0.45 + gauss(r) * 3.6 + (role === 'cl' ? 4 : 0)), 126, 163),
    control: ab(b, r), stamina: role === 'sp' ? ab(b + 8, r, 9) : ab(b - 18, r, 10),
    pitches,
    meet: ab(18, r, 8), power: ab(15, r, 8), speed: ab(35, r), arm: ab(60, r), field: ab(45, r), catch: ab(45, r), traj: 1,
  };
}
// overall: a single number for a list (batters by hitting + defence, pitchers by velocity, control, stamina, pitches)
export function overall(p) {
  if (p.pitcher) {
    const brk = p.pitches.reduce((a, x) => a + x.lv, 0);
    return Math.round(((p.velo - 120) * 1.3 + p.control * 0.6 + (p.role === 'sp' ? p.stamina * 0.35 : 18) + brk * 4) / 1.9);
  }
  return Math.round(p.meet * 0.32 + p.power * 0.3 + p.speed * 0.12 + p.field * 0.12 + p.arm * 0.07 + p.catch * 0.07);
}
export const pitchStuff = (p) => clamp(((p.velo - 130) * 1.6 + p.pitches.reduce((a, x) => a + x.lv * 5.5, 0) + p.control * 0.25) / 1.15, 5, 99);

// a club's 28 players: 9 regulars + DH-able bench (14 batters) and 6 starters + 8 relievers (14 pitchers)
export function makeRoster(r, tier) {
  const bat = [];
  const stars = new Set([randInt(0, 8, r), randInt(0, 8, r)]);
  ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].forEach((pos, i) => bat.push(makeBatter(r, pos, tier, stars.has(i) ? 'star' : 'reg')));
  bat.push(makeBatter(r, pick(['1B', 'LF', 'RF', '3B'], r), tier, 'reg')); // the DH
  for (const pos of ['C', '2B', 'SS', 'CF', '1B']) bat.push(makeBatter(r, pos, tier, 'bench'));
  const pit = [makePitcher(r, 'sp', tier, true)];
  for (let i = 0; i < 5; i++) pit.push(makePitcher(r, 'sp', tier));
  for (let i = 0; i < 7; i++) pit.push(makePitcher(r, 'rp', tier));
  pit.push(makePitcher(r, 'cl', tier, r() < 0.5));
  const all = [...bat, ...pit];
  // uniform numbers
  const used = new Set();
  for (const p of all) { let n; do { n = p.pitcher ? randInt(11, 69, r) : randInt(0, 66, r); } while (used.has(n)); used.add(n); p.num = n; }
  return all;
}
export const pname = (p) => (p ? `${p.fam}` : '—');
export const pfull = (p) => (p ? `${p.fam} ${p.giv}` : '—');
