// てちょう（メニュー → てちょう）: a notebook with four tabs (HD scene, 640x360).
//
//   もくひょう  today's numbers, what needs attention and a concrete next goal
//   せいかつ    the day of the week, needs with advice, housing and rent, this week's
//               regular shows, friends (hearts) and fans
//   ばしょ      places the player has been to (state.flags.visited, set by g.goto)
//               with a short guide from js/world/guide.js; others are 「？？？」 + a hint
//   きろく      the profile (name, age, hometown, personality, era) and family, days, jobs,
//               minigames and their best ranks, title, agency
//
// Controls: ←→ tabs, ↑↓ scroll, A next page, B / MENU close. Everything is wrapped
// to the page, so long text never runs off it. The life registries (PEOPLE,
// REGULARS, HOUSING) are read when the notebook opens and may be empty.

import { SW, SH, fmtMoney, yenText, clamp, shade } from './util.js';
import { text, wrap, panel, measure, rect, downArrow, COLORS } from './draw.js';
import { audio } from './audio.js';
import { SKILLS, AGENCIES, RANKS, FINALE_FAME, rankIndex, rankName } from './state.js';
import { MINIGAMES } from './minigame.js';
import { eraOf, fullName, ageOf, prefecture, regionOf, GENDERS, PERSONALITIES, RELATIONS, CAUSES, isBirthday, daysToBirthday, personalityEffects, sortFamily } from './profile.js';
import { GUIDE, GUIDE_ORDER, TOWNS, AUDITIONS, GUIDE_JOBS, TIER_FAME, jobOpen } from '../world/guide.js';
import { PEOPLE, HEARTS, heartIndex, REGULARS, FURNITURE, WEEKDAYS, weekdayOf, weekOf, HUNGRY, STRESSED, SCRUFFY, BURNOUT, FULL, showWords } from './life.js';

const TABS = [
  { label: 'もくひょう', color: '#ff8a3d' },
  { label: 'せいかつ', color: '#e2569a' },
  { label: 'ばしょ', color: '#3fb85f' },
  { label: 'きろく', color: '#3a9fd8' },
];
const TOWN_BG = { tokyo: '#2f5fb8', namba: '#c23a3a' };
const RANK_COLOR = { S: COLORS.accent, A: COLORS.pink, B: COLORS.cyan, C: COLORS.text, D: COLORS.dim };
const MG_ORDER = ['tsukkomi', 'zukko', 'rhythm', 'command', 'quiz', 'announce', 'talk'];

// text sizes and line heights (screen pixels)
const BODY = 16, SMALL = 13;
const LH = { [BODY]: 21, [SMALL]: 18 };

// layout
const COVER = { x: 4, y: 4, w: SW - 8, h: SH - 8 };
const PX = 14, PY = 36, PW = SW - 28, PH = SH - 46; // the page
const TAB_W = 128, TAB_GAP = 6, TAB_Y = 10, TAB_H = 28;
const VX = PX + 22, VY = PY + 16, VW = 556, VH = PH - 16 - 36; // text area; the scrollbar sits right of it
const SB_X = VX + VW + 12;
const GAUGE_X = 132, GAUGE_W = 210; // need gauges (x relative to VX)
const HEART_X = 236; // friends' hearts (x relative to VX)
const HEART_N = Math.max(1, Math.min(6, HEARTS.length - 1)); // one heart per level above 知り合い

let lastTab = 0; // reopen on the tab the player looked at last

// Era words for the page texts (set when the notebook opens): the phone is 手帳 / ケータイ /
// スマホ, the SNS ブログ etc., and literal prices follow the era (util.js yenText).
let ERA = eraOf(null);
const eraText = (t) => {
  let s = String(t ?? '');
  if (ERA.deviceShort !== 'スマホ') s = s.replaceAll('スマホ', ERA.deviceShort);
  if (ERA.sns !== 'ドッター') s = s.replaceAll('ドッター', ERA.sns);
  return yenText(s);
};

// ---------------------------------------------------------------- content builder
// A page is a list of blocks (scroll unit); a block is a list of lines.
// line: { t, s: BODY|SMALL, c, x, h, r, rs, rc, tag: { t, bg }, badge: { t, c }, mark,
//         head: color, gauge: { frac, color }, hearts: level }
class Page {
  constructor(ctx) { this.ctx = ctx; this.blocks = []; this.b = null; }

  block(gap = 8) { this.b = { lines: [], h: 0, gap }; this.blocks.push(this.b); return this; }

  line(l) {
    if (!this.b) this.block();
    if (l.t) l.t = eraText(l.t);
    if (l.r) l.r = eraText(l.r);
    l.s = l.s || BODY;
    l.h = l.h || LH[l.s] || 21;
    this.b.lines.push(l);
    this.b.h += l.h;
    return this;
  }

  head(t, c = COLORS.cyan) { return this.line({ t, c, h: 26, head: c }); }

  // wrapped paragraph
  para(t, { c = COLORS.text, s = BODY, x = 0, mark } = {}) {
    t = eraText(t);
    for (const ln of wrap(this.ctx, t, VW - x, s)) this.line({ t: ln, c, s, x, mark });
    return this;
  }

  // left text (optionally after a small tag) with right-aligned text; falls back to
  // two lines when both do not fit side by side
  row(t, r, { c = COLORS.text, s = BODY, x = 0, rc = COLORS.text, rs = s, tag, mark, gauge, hearts } = {}) {
    t = eraText(t);
    if (r) r = eraText(r);
    const tagW = tag ? measure(this.ctx, tag.t, 12) + 12 : 0;
    const lw = tagW + measure(this.ctx, t, s);
    const rw = r ? measure(this.ctx, r, rs) : 0;
    const extra = gauge ? GAUGE_W + 16 : hearts != null ? HEART_N * 16 + 16 : 0;
    if (!r || x + lw + rw + extra + 14 <= VW) return this.line({ t, s, c, x, r, rs, rc, tag, mark, gauge, hearts });
    const lines = wrap(this.ctx, t, VW - x - tagW, s);
    lines.forEach((ln, i) => this.line({ t: ln, s, c, x: i ? x + tagW : x, tag: i ? null : tag, mark }));
    return this.line({ t: '', s: rs, r, rs, rc, mark, gauge, hearts });
  }

  // Scroll stops (pixel offsets): every block start up to the last stop, from which the
  // rest of the page fits. A block taller than the view gets extra stops, so no line is
  // ever skipped.
  get stops() {
    if (this._stops) return this._stops;
    const tops = [];
    const starts = [];
    let y = 0;
    for (const b of this.blocks) {
      starts.push(y);
      for (const l of b.lines) { tops.push({ y, h: l.h }); y += l.h; }
      y += b.gap;
    }
    const total = tops.length ? tops[tops.length - 1].y + tops[tops.length - 1].h : 0;
    this.lineTops = tops;
    if (total <= VH) return (this._stops = [0]);
    // the last stop: a block start when that leaves only a small gap at the bottom (so the
    // last screen never begins with a heading-less line), else the first line that fits
    const minO = total - VH;
    const lastBlock = starts.find((s) => s >= minO);
    const last = lastBlock != null && lastBlock - minO <= 84 ? lastBlock : tops.find((l) => l.y >= minO).y;
    // top of the first line that does not fit entirely when scrolled to o
    const cut = (o) => { const l = tops.find((t) => t.y + t.h > o + VH); return l ? l.y : Infinity; };
    const out = [];
    for (const o of [...starts.filter((s) => s < last), last]) {
      while (out.length && o > cut(out[out.length - 1])) out.push(cut(out[out.length - 1]));
      out.push(o);
    }
    this._stops = out;
    return this._stops;
  }
}

// ---------------------------------------------------------------- helpers
export function visitedPlaces(g) {
  const st = g.state;
  const fl = st.flags || {};
  const v = { tokyo: true, home: true, ...(fl.visited || {}) };
  // saves from before flags.visited: guess from the place-prefixed flags and job ids
  const keys = [...Object.keys(fl), ...Object.keys(st.jobs || {})];
  for (const id of GUIDE_ORDER) {
    if (!v[id] && keys.some((k) => k.startsWith(id + '_'))) v[id] = true;
  }
  if (g.map && g.map.placeId) v[g.map.placeId] = true;
  // every building of a town is reached through that town
  for (const id of GUIDE_ORDER) if (v[id] && GUIDE[id]) v[GUIDE[id].town] = true;
  return v;
}

function bestSkill(st) {
  let best = null;
  for (const k of Object.keys(SKILLS)) if ((st.skills[k] || 0) > 0 && (!best || st.skills[k] > st.skills[best])) best = k;
  return best;
}

// Up to n open jobs of the highest tier the player can take, the most fitting first:
// jobs only the player's agency offers, then jobs in the town the player is in (town),
// the agency's specialty, the player's best skill and places already visited.
export function suggestJobs(st, visited = {}, town = 'tokyo', n = 3) {
  const open = GUIDE_JOBS.filter((j) => jobOpen(st, j));
  if (!open.length) return [];
  const top = Math.max(...open.map((j) => j.tier));
  const best = bestSkill(st);
  const agSkill = st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency].skill : null;
  const score = (j) => (j.need && j.need === st.agency ? 3 : 0) + (GUIDE[j.place] && GUIDE[j.place].town === town ? 2 : 0)
    + (j.skill === agSkill ? 1 : 0) + (j.skill === best ? 1 : 0) + (visited[j.place] ? 1 : 0);
  const cands = open.filter((j) => j.tier === top);
  const rot = (j) => (cands.indexOf(j) + (st.day || 0)) % cands.length; // vary the ties day by day
  return cands.slice().sort((a, b) => score(b) - score(a) || rot(a) - rot(b)).slice(0, n);
}

const placeName = (id) => (GUIDE[id] ? GUIDE[id].name : id);
const townTag = (id) => (GUIDE[id] ? { t: TOWNS[GUIDE[id].town], bg: TOWN_BG[GUIDE[id].town] } : null);
// any registered place (regular shows can be anywhere): guide name, place name, else nothing
const anyPlaceName = (g, id) => (!id ? '' : GUIDE[id] ? GUIDE[id].name : g.PLACES && g.PLACES[id] ? g.PLACES[id].name || '' : '');

const L0 = { hunger: 70, stress: 10, clean: 90 };
const lifeOf = (st) => ({ ...L0, ...(st.life || {}) });

// The player's regular shows (joined, known to the registry), by weekday.
function myRegulars(st) {
  const regs = st.regulars || {};
  return Object.keys(regs)
    .filter((id) => REGULARS[id] && regs[id] && !regs[id].declined && regs[id].since != null)
    .sort((a, b) => (REGULARS[a].weekday || 0) - (REGULARS[b].weekday || 0));
}

// This week's state of a regular show: [label, color].
function regularStatus(g, id) {
  const st = g.state;
  const r = REGULARS[id], s = st.regulars[id];
  const wk = weekOf(st.day), today = weekdayOf(st.day);
  if (s.dropped) return ['降板', COLORS.dim];
  const w = showWords(r);
  if ((s.doneWeek || 0) >= wk) {
    if (s.missed > 0) return ['休んでしまった…', COLORS.bad];
    // joined after this week's show (or on its day, without doing it): starts next week
    const ws = weekdayOf(s.since);
    if (weekOf(s.since) === wk && (ws > r.weekday || (ws === r.weekday && !s.count))) return ['来週から', COLORS.dim];
    return [w.done, COLORS.good];
  }
  if (r.weekday === today) return [`きょう${w.act}！`, COLORS.accent];
  if (r.weekday > today) return [`あと${r.weekday - today}日`, COLORS.text];
  return ['今週は終わった', COLORS.dim]; // the day passed without a recording (not counted yet)
}

// Days until the next Monday (rent day); Monday itself counts as 7 (paid this morning).
const daysToRent = (day) => (7 - weekdayOf(day)) % 7 || 7;

// Short advice for each need: [text, color].
function needAdvice(k, v, g) {
  if (k === 'hunger') {
    // broke and nothing to eat: work is still allowed (g.lifeRefusal), so say so
    if (v <= 0 && g && g.canFeed && !g.canFeed()) return ['おなかペコペコで、お金も食べ物もない…。まずはお仕事でかせいで、何か食べよう。', COLORS.bad];
    if (v <= 0) return ['おなかがすきすぎて力が出ない！何か食べないと、お仕事もレッスンもできない。', COLORS.bad];
    if (v < HUNGRY) return ['おなかがペコペコ！何か食べよう。ミニゲームが難しくなり、よく眠れない。', COLORS.bad];
    if (v < 45) return ['そろそろ何か食べよう。', COLORS.accent];
    if (v >= FULL) return ['おなかいっぱい。いまは食べられない。', COLORS.dim];
    if (v >= 65) return ['まだおなかは満たされている。いまごはんを食べても、体力はあまり回復しない。', COLORS.dim];
    return ['ちょうどいい感じ。', COLORS.dim];
  }
  if (k === 'stress') {
    if (v >= BURNOUT) return ['もう限界！お仕事はできない。公園でジョギング（無料）やテレビ、友だちと遊んで気分転換。1日しっかり休むのも効く。', COLORS.bad];
    if (v >= STRESSED) return ['ストレスがたまっている。ミニゲームが難しくなる。息抜きするか、1日ゆっくり休もう。', COLORS.bad];
    if (v >= 40) return ['すこし疲れぎみ。たまには息抜きを。', COLORS.accent];
    return ['リラックスしている。', COLORS.dim];
  }
  if (v < SCRUFFY) return ['身だしなみが乱れている。お風呂に入ろう。（知名度や好感度が上がりにくい）', COLORS.bad];
  if (v < 60) return ['そろそろお風呂に入りたい。', COLORS.accent];
  return ['さっぱりしている。', COLORS.dim];
}

const COND = {
  great: ['絶好調！', COLORS.good], normal: ['ふつう', COLORS.text], hungry: ['はらぺこ…', COLORS.bad],
  stressed: ['ストレスぎみ…', COLORS.bad], scruffy: ['身だしなみが乱れている', COLORS.accent], burnout: ['燃え尽きた…', COLORS.bad],
  edge: ['燃え尽き寸前！', COLORS.bad], // stressed, 90 and up
};
// g.condition(), with 'edge' for stress 90+ (one bad job away from burning out)
const condOf = (g) => { const c = g.condition(); return c === 'stressed' && g.state.life.stress >= 90 ? 'edge' : c; };

// ---------------------------------------------------------------- tab: もくひょう
function goalPage(g, ctx) {
  const st = g.state;
  const fl = st.flags || {};
  const L = lifeOf(st);
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);

  pg.block().head('きょうのようす');
  pg.row(g.dayLabel ? g.dayLabel() : `${st.day}日目`, `所持金 ${fmtMoney(st.money)}`, { rc: COLORS.accent });
  const sc = st.stamina / st.maxStamina > 0.5 ? COLORS.good : st.stamina / st.maxStamina > 0.2 ? COLORS.accent : COLORS.bad;
  pg.row(`体力 ${st.stamina}/${st.maxStamina}`, `満腹 ${L.hunger}%`, { c: sc, rc: L.hunger < HUNGRY ? COLORS.bad : COLORS.text });
  // what needs attention today (the details are in せいかつ); a recording today comes
  // first, since it cannot wait, then the needs from the most to the least pressing
  const notes = [];
  try {
    for (const id of g.regularsToday ? g.regularsToday() : []) notes.push([`きょうは『${REGULARS[id].title}』の${showWords(REGULARS[id]).day}！`, COLORS.accent]);
  } catch (e) { /* registry changed under us */ }
  if (st.stamina < 25) {
    notes.push([g.canEat && !g.canEat() ? '体力が少ない。おなかいっぱいなので、ベッドで寝て回復しよう。' : '体力が少ない。何か食べるか、ベッドで寝て回復しよう。', COLORS.bad]);
  }
  if (L.hunger < HUNGRY && st.stamina >= 25) {
    const broke = L.hunger <= 0 && g.canFeed && !g.canFeed();
    notes.push([broke ? 'おなかペコペコで、お金も食べ物もない！まずはお仕事でかせごう。' : L.hunger <= 0 ? 'おなかがすきすぎて力が出ない！まず何か食べよう。' : 'おなかがペコペコ…。何か食べよう。', COLORS.bad]);
  }
  if (L.stress >= BURNOUT) notes.push(['ストレスが限界。ジョギングやテレビで気分転換するか、今日は休もう。', COLORS.bad]);
  else if (L.stress >= STRESSED) notes.push(['ストレスがたまっている。友だちと遊んで息抜きしよう。', COLORS.accent]);
  if (st.rent && st.rent.debt) notes.push([`家賃が未払い（${fmtMoney(st.rent.debt)}）。スマホの「家計」から払おう。`, COLORS.bad]);
  else {
    // rent coming up soon and not enough money yet (the same numbers as せいかつ)
    const rent = (g.housing && g.housing().rent) || 0;
    const d = daysToRent(st.day);
    if (rent > 0 && st.money < rent && d <= 4) notes.push([`家賃（${fmtMoney(rent)}）まで${d === 1 ? 'あした' : `あと${d}日`}。あと${fmtMoney(rent - st.money)}かせごう。`, COLORS.accent]);
  }
  if (L.clean < SCRUFFY) notes.push(['身だしなみが乱れている。お風呂に入ろう。', COLORS.accent]);
  for (const [t, c] of notes.slice(0, 4)) pg.para('・' + t, { s: SMALL, c });
  if (notes.length) pg.para('くわしくは「せいかつ」タブで。', { s: SMALL, c: COLORS.dim });

  // the one most important next step
  pg.block().head('つぎの目標', COLORS.accent);
  if (fl.finaleDone) {
    pg.para('国民的スターになった！おめでとう！');
    pg.para('NHKホールの凱旋コンサートや、大きなお仕事で活躍を続けよう。', { s: SMALL, c: COLORS.dim });
  } else if (st.fame >= FINALE_FAME && fl.finaleInvited) {
    pg.para(g.map && g.map.placeId === 'nhk' ? 'プロデューサーに会いに行こう！' : 'NHK放送センターへ行こう！');
    pg.para('年末の大型歌番組のプロデューサーが、入り口の近くで待っている。', { s: SMALL, c: COLORS.dim });
  } else if (st.fame >= FINALE_FAME) {
    pg.para(`★${FINALE_FAME}に届いた！`);
    pg.para('街に出ると、NHKから大事な電話がかかってくるはず。', { s: SMALL, c: COLORS.dim });
  } else if (!st.agency) {
    pg.para('事務所のオーディションに合格して、所属タレントになろう。');
    pg.para('レッスンや自主練でスキルを上げると、合格しやすくなる。ごはんをしっかり食べて、ストレスをためないのも大事。', { s: SMALL, c: COLORS.dim });
  } else {
    const next = TIER_FAME.find((f) => f > st.fame && f > 30) || FINALE_FAME;
    pg.para(`お仕事で知名度を上げて、★${next}をめざそう。`);
    pg.para(`あと★${next - st.fame}。おすすめのお仕事は下のとおり。`, { s: SMALL, c: COLORS.dim });
  }

  if (!st.agency && !fl.finaleDone) {
    pg.block().head('オーディション（合格で所属）');
    for (const a of AUDITIONS) pg.row(placeName(a.place), a.how, { tag: townTag(a.place), rs: SMALL, rc: COLORS.dim });
  }

  // title
  const ri = rankIndex(st.fame);
  const nextRank = RANKS[ri + 1];
  pg.block().head('称号');
  pg.row(`いまは「${rankName(st.fame)}」`, `★${st.fame}`, { rc: COLORS.pink });
  if (nextRank) pg.para(`次の「${nextRank[1]}」まで あと★${nextRank[0] - st.fame}`, { s: SMALL, c: COLORS.dim });

  // jobs
  const here = g.map && GUIDE[g.map.placeId];
  const jobs = suggestJobs(st, visited, here ? here.town : 'tokyo');
  if (jobs.length) {
    pg.block().head('おすすめのお仕事');
    for (const j of jobs) pg.row('・' + j.label, GUIDE[j.place] ? GUIDE[j.place].short : j.place, { rs: SMALL, rc: COLORS.dim });
  }
  const nextTier = TIER_FAME.find((f) => f > st.fame && !(f === 30 && st.agency));
  // (with an agency the next ★ line is already the main goal above)
  if (nextTier === 30) pg.para('所属するか★30になると、受けられるお仕事が増える。', { s: SMALL, c: COLORS.dim });
  else if (nextTier && (!st.agency || fl.finaleDone)) pg.para(`★${nextTier}で、もっと大きなお仕事が増える（あと★${nextTier - st.fame}）。`, { s: SMALL, c: COLORS.dim });
  if (st.agency && AGENCIES[st.agency]) {
    const sk = SKILLS[AGENCIES[st.agency].skill];
    pg.para(`${AGENCIES[st.agency].name}の得意分野は「${sk}」。${sk}のお仕事は、ギャラと知名度が1.1倍！`, { s: SMALL, c: COLORS.dim });
  }

  if (!fl.finaleDone && st.fame < FINALE_FAME) {
    pg.block().head('さいごの目標');
    pg.para(`★${FINALE_FAME}で、NHKから年末の大舞台の声がかかる。`, { s: SMALL });
    pg.para(`（あと★${FINALE_FAME - st.fame}）`, { s: SMALL, c: COLORS.dim });
  }
  return pg;
}

// ---------------------------------------------------------------- tab: せいかつ
function lifePage(g, ctx) {
  const st = g.state;
  const L = lifeOf(st);
  const pg = new Page(ctx);
  const day = st.day || 1;
  const wd = weekdayOf(day);

  // today
  pg.block().head('きょう', TABS[1].color);
  pg.row(`${day}日目　${WEEKDAYS[wd]}曜日`, `第${weekOf(day)}週`, { c: COLORS.accent, rc: COLORS.dim, rs: SMALL });
  if (g.condition) {
    const [cl, cc] = COND[condOf(g)] || COND.normal;
    pg.row('調子', cl, { rc: cc });
  }
  try {
    for (const id of g.regularsToday ? g.regularsToday() : []) {
      const r = REGULARS[id];
      const where = anyPlaceName(g, r.place);
      pg.para(`きょうは『${r.title}』の${showWords(r).day}！${where ? `（${where}）` : ''}`, { s: SMALL, c: COLORS.accent });
    }
  } catch (e) { /* ignore */ }
  const unread = g.unread ? g.unread() : 0;
  if (unread) pg.para(`スマホに未読のメッセージが${unread}件あるよ。`, { s: SMALL, c: COLORS.cyan });

  // needs
  pg.block().head('からだと心', TABS[1].color);
  const sf = st.stamina / st.maxStamina;
  pg.row('体力', `${st.stamina}/${st.maxStamina}`, { gauge: { frac: sf, color: sf > 0.5 ? COLORS.good : sf > 0.2 ? COLORS.accent : COLORS.bad }, rc: st.stamina < 25 ? COLORS.bad : COLORS.text });
  if (st.stamina < 25) {
    const full = g.canEat && !g.canEat();
    pg.para(full ? '体力が少ない。おなかいっぱいなので、ベッドで寝て回復しよう。' : '体力が少ない。何か食べるか、ベッドで寝て回復しよう。', { s: SMALL, c: COLORS.bad, x: 16 });
  }
  else pg.para(sf >= 0.7 ? '元気いっぱい！' : 'すこし疲れてきた。お仕事は体力と相談しよう。', { s: SMALL, c: sf >= 0.7 ? COLORS.dim : COLORS.accent, x: 16 });
  const NEED_ROWS = [
    ['hunger', '満腹', (v) => `${v}%`, (v) => (v < HUNGRY ? COLORS.bad : '#ff9a3c')],
    ['stress', 'ストレス', (v) => String(v), (v) => (v >= STRESSED ? COLORS.bad : v >= 40 ? COLORS.accent : '#b48cff')],
    ['clean', '身だしなみ', (v) => String(v), (v) => (v < SCRUFFY ? COLORS.bad : COLORS.cyan)],
  ];
  for (const [k, name, fmt, col] of NEED_ROWS) {
    const v = clamp(Math.round(L[k] || 0), 0, 100);
    const [adv, ac] = needAdvice(k, v, g);
    pg.row(name, fmt(v), { gauge: { frac: v / 100, color: col(v) }, rc: ac === COLORS.bad ? COLORS.bad : COLORS.text });
    pg.para(adv, { s: SMALL, c: ac, x: 16 });
  }

  // housing & rent
  pg.block().head('すまい', TABS[1].color);
  const h = g.housing ? g.housing() : null;
  if (h) {
    pg.row(h.name || 'すまい', `家賃 ${fmtMoney(h.rent || 0)}／週`, { c: COLORS.accent, rs: SMALL, rc: COLORS.text });
    if (h.desc) pg.para(h.desc, { s: SMALL, c: COLORS.dim, x: 16 });
    const perks = [h.kitchen && 'キッチン', h.bath && 'お風呂'].filter(Boolean);
    const owned = Object.keys(st.furniture || {}).filter((k) => st.furniture[k] && FURNITURE[k]).length;
    pg.row(`設備：${perks.length ? perks.join('・') : 'なし'}`, `家具 ${owned}/${h.slots ?? 4}`, { s: SMALL, rs: SMALL, x: 16, rc: COLORS.dim });
    const rent = st.rent || {};
    const d = daysToRent(day);
    const rentful = (h.rent || 0) > 0;
    if (rentful) pg.row('次の家賃', `月曜日（${d === 1 ? 'あした' : `あと${d}日`}）`, { rc: d <= 2 ? COLORS.accent : COLORS.text });
    // unpaid rent is shown even after moving somewhere rent-free
    if (rent.debt) {
      pg.row('未払い', fmtMoney(rent.debt), { c: COLORS.bad, rc: COLORS.bad });
      pg.para('お金ができたら、スマホの「家計」から払おう。払うまで、ストレスがたまっていく。', { s: SMALL, c: COLORS.bad, x: 16 });
    } else if (rentful && st.money < h.rent) {
      pg.para(`いまの所持金では家賃が足りない！月曜日までに、あと${fmtMoney(h.rent - st.money)}かせごう。`, { s: SMALL, c: COLORS.accent, x: 16 });
    } else if (rentful) pg.para('家賃は毎週月曜日の朝に、所持金から自動で支払われる。', { s: SMALL, c: COLORS.dim, x: 16 });
    if (!rentful) pg.para('家賃はかからない。', { s: SMALL, c: COLORS.dim, x: 16 });
  }

  // regular shows this week
  pg.block().head('レギュラー番組（今週）', TABS[1].color);
  const regs = myRegulars(st);
  if (!regs.length) {
    pg.para('まだレギュラー番組はない。知名度が上がると、番組からオファーが届くかも。', { s: SMALL, c: COLORS.dim });
  } else {
    for (const id of regs) {
      const r = REGULARS[id], s = st.regulars[id];
      const [label, color] = regularStatus(g, id);
      const wdName = WEEKDAYS[clamp(r.weekday | 0, 0, 6)] + '曜';
      pg.row(`『${r.title || id}』`, label, { rc: color, tag: { t: wdName, bg: r.weekday === wd ? '#c87a1a' : '#5a4a8a' }, c: s.dropped ? COLORS.dim : COLORS.text });
      const where = anyPlaceName(g, r.place);
      pg.para(`${where ? where + '・' : ''}出演 ${s.count || 0}回${s.missed && !s.dropped ? `・お休み ${s.missed}回` : ''}`, { s: SMALL, c: COLORS.dim, x: 16 });
    }
    pg.para('収録や本番の日に現場へ行けば出演できる。続けて2回休むと降板…。', { s: SMALL, c: COLORS.dim });
  }

  // friends
  pg.block().head('なかま', TABS[1].color);
  const people = Object.keys(st.people || {}).filter((id) => PEOPLE[id] && st.people[id]);
  if (!people.length) {
    pg.para('まだ知り合いはいない。事務所や街の人に話しかけてみよう。', { s: SMALL, c: COLORS.dim });
  } else {
    const aff = (id) => Number(st.people[id].aff) || 0;
    people.sort((a, b) => aff(b) - aff(a));
    const friends = people.filter((id) => heartIndex(aff(id)) >= 2).length;
    pg.row(`知り合い ${people.length}人`, `友だち以上 ${friends}人`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.pink });
    for (const id of people) {
      const p = st.people[id];
      const lv = heartIndex(aff(id));
      const tag = st.partner === id || p.partner ? { t: '相方', bg: '#c87a1a' } : p.special ? { t: '大切な人', bg: '#c2407a' } : null;
      pg.row(PEOPLE[id].name || id, (HEARTS[lv] && HEARTS[lv][1]) || '', { tag, hearts: lv, rc: lv >= 3 ? COLORS.pink : lv >= 2 ? COLORS.text : COLORS.dim, rs: SMALL });
    }
  }

  // fans
  pg.block().head('ファン', TABS[1].color);
  const fans = Math.max(0, Math.round(st.fans || 0));
  pg.row(`ファン ${fans.toLocaleString('ja-JP')}人`, '', { c: COLORS.pink });
  const fanNote = fans === 0 ? 'まだファンはいない。テレビや舞台のお仕事で、名前を覚えてもらおう。'
    : fans < 100 ? 'ファンが少しずつ増えてきた！'
      : fans < 1000 ? '応援してくれるファンが増えてきた。レギュラー番組でもっと増える。'
        : fans < 10000 ? 'たくさんのファンが応援してくれている！'
          : '日本中にファンがいる！国民的スターはもうすぐ。';
  pg.para(fanNote, { s: SMALL, c: COLORS.dim });
  return pg;
}

// ---------------------------------------------------------------- tab: ばしょ
function placesPage(g, ctx) {
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);
  const here = g.map && g.map.placeId;
  const ids = GUIDE_ORDER.filter((id) => GUIDE[id]);
  const count = (town) => ids.filter((id) => GUIDE[id].town === town && visited[id]).length + '/' + ids.filter((id) => GUIDE[id].town === town).length;
  pg.block(6).row(`行った場所 ${ids.filter((id) => visited[id]).length}/${ids.length}`, `東京 ${count('tokyo')}・なんば ${count('namba')}`, { c: COLORS.accent, rs: SMALL, rc: COLORS.dim });
  for (const id of ids) {
    const p = GUIDE[id];
    const tag = { t: TOWNS[p.town], bg: TOWN_BG[p.town] };
    pg.block(7);
    if (!visited[id]) {
      pg.line({ t: '？？？', c: COLORS.dim, tag });
      pg.para('ヒント：' + (p.hint || '街を歩いてさがしてみよう'), { s: SMALL, c: COLORS.dim, x: 12 });
      continue;
    }
    const mark = id === here;
    pg.line({ t: p.name, c: mark ? COLORS.accent : COLORS.text, tag, mark, badge: p.audition ? { t: 'オーディション', c: COLORS.pink } : mark ? { t: 'いまここ', c: COLORS.accent } : null });
    for (const l of p.lines || []) pg.para(l, { s: SMALL, x: 12, mark });
  }
  return pg;
}

// ---------------------------------------------------------------- tab: きろく
function recordPage(g, ctx) {
  const st = g.state;
  const stats = st.stats || {};
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);
  const ids = GUIDE_ORDER.filter((id) => GUIDE[id]);

  const pf = st.profile;
  pg.block().row(pf ? fullName(pf) : st.name, `${rankName(st.fame)}　★${st.fame}`, { c: COLORS.accent, rc: COLORS.pink });
  pg.row('所属', st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency].name : 'フリー（未所属）');
  const pm = st.playMinutes || 0;
  pg.row('日数', g.dayLabel ? g.dayLabel() : `${st.day}日目`);
  pg.row('プレイ時間', pm >= 60 ? `${Math.floor(pm / 60)}時間${pm % 60}分` : `${pm}分`);

  if (pf) {
    pg.block().head('プロフィール');
    const d = daysToBirthday(st);
    pg.row('年齢', `${ageOf(st)}さい`, { rc: COLORS.accent });
    pg.para(isBirthday(st) ? '今日は誕生日！おめでとう！' : `次の誕生日まで あと${d}日`, { s: SMALL, c: isBirthday(st) ? COLORS.pink : COLORS.dim, x: 12 });
    pg.row('性別', (GENDERS[pf.gender] || GENDERS.x).name);
    pg.row('出身', `${prefecture(pf.hometown).name}（${regionOf(pf.hometown).name}）`);
    const per = PERSONALITIES[pf.personality];
    if (per) {
      pg.row('性格', per.name, { rc: COLORS.cyan });
      pg.para(`${per.desc}（${personalityEffects(pf.personality)}）`, { s: SMALL, c: COLORS.dim, x: 12 });
    }
    pg.row('時代', ERA.label);
    pg.para(`${ERA.year}。${ERA.device}を持って、芸能界へ。`, { s: SMALL, c: COLORS.dim, x: 12 });

    pg.block().head('家族', COLORS.pink);
    const fam = sortFamily(Array.isArray(pf.family) ? pf.family : []);
    if (!fam.length) pg.para('ひとりで上京してきた。いまは仲間が家族みたいなもの。', { s: SMALL, c: COLORS.dim });
    for (const m of fam) {
      const rel = RELATIONS[m.rel] ? RELATIONS[m.rel].name : '家族';
      pg.row(`${rel}　${m.name}`, m.alive ? '元気' : '空から見守っている', { rc: m.alive ? COLORS.good : COLORS.dim, rs: m.alive ? BODY : SMALL });
      if (!m.alive) {
        const why = CAUSES[m.cause] && CAUSES[m.cause].text;
        pg.para(`${why ? why + '旅立った。' : ''}いまも、心の支え。`, { s: SMALL, c: COLORS.dim, x: 12 });
      }
    }
  }

  pg.block().head('あゆみ');
  pg.row('こなしたお仕事', `${stats.jobs || 0}回`);
  pg.row('ミニゲーム', `${stats.minigames || 0}回`);
  pg.row('行った場所', `${ids.filter((id) => visited[id]).length}/${ids.length}`);
  pg.row('ファン', `${Math.max(0, Math.round(st.fans || 0)).toLocaleString('ja-JP')}人`, { rc: COLORS.pink });
  const people = Object.keys(st.people || {}).filter((id) => PEOPLE[id] && st.people[id]);
  if (people.length) pg.row('知り合い', `${people.length}人（友だち以上 ${people.filter((id) => heartIndex(Number(st.people[id].aff) || 0) >= 2).length}人）`);
  if (st.partner && PEOPLE[st.partner]) pg.row('相方', PEOPLE[st.partner].name, { rc: COLORS.accent });
  const regCount = Object.keys(st.regulars || {}).reduce((a, id) => a + (Number(st.regulars[id] && st.regulars[id].count) || 0), 0);
  if (regCount) pg.row('レギュラー番組の出演', `${regCount}回`);
  if (g.housing) pg.row('住まい', g.housing().name || '');
  if (st.flags && st.flags.finaleDone) pg.row('年末の大型歌番組', '出演！', { rc: COLORS.accent });

  pg.block().head('ミニゲームのベストランク');
  const best = stats.bestRanks || {};
  const mgIds = [...MG_ORDER.filter((id) => MINIGAMES[id]), ...Object.keys(MINIGAMES).filter((id) => !MG_ORDER.includes(id))];
  for (const id of mgIds) {
    const title = (MINIGAMES[id] && MINIGAMES[id].title) || id;
    const r = best[id];
    pg.row(title, r ? `ランク ${r}` : '―', { rc: r ? RANK_COLOR[r] || COLORS.text : COLORS.dim });
  }

  // most-done jobs (ids from GUIDE_JOBS; unknown ids are left out). Counted per job, so
  // two jobs with the same name at different places (ミュージカル主演) stay apart.
  const done = st.jobs || {};
  const top = GUIDE_JOBS.map((j) => [j, j.ids.reduce((a, id) => a + (Number(done[id]) || 0), 0)])
    .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) {
    pg.block().head('よく受けたお仕事');
    for (const [j, n] of top) {
      const twin = GUIDE_JOBS.some((o) => o !== j && o.label === j.label);
      pg.row('・' + j.label + (twin && GUIDE[j.place] ? `（${GUIDE[j.place].short}）` : ''), `${n}回`);
    }
  }
  return pg;
}

const BUILDERS = [goalPage, lifePage, placesPage, recordPage];

// ---------------------------------------------------------------- scene
export class NotebookScene {
  constructor(g, resolve) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.hd = true;
    this.opaque = true; // covers the whole screen
    this.hidesHud = true; // MapScene skips the HUD while this is open
    this.tab = clamp(lastTab, 0, TABS.length - 1);
    ERA = eraOf(g.state);
    this.pages = BUILDERS.map((b) => {
      try { return b(g, g.ctx); } catch (e) { console.error(e); return new Page(g.ctx).block().para('（読み込めませんでした）'); }
    });
    for (const p of this.pages) void p.stops; // lay out once
    this.scroll = TABS.map(() => 0); // index into page.stops per tab
    this.shown = 0; // drawn pixel offset (eases toward the target)
  }

  get page() { return this.pages[this.tab]; }

  offsetOf(i) { return this.page.stops[i] || 0; }

  maxScroll() { return this.page.stops.length - 1; }

  setScroll(v, animate = true) {
    const s = clamp(v, 0, this.maxScroll());
    this.scroll[this.tab] = s;
    if (!animate) this.shown = this.offsetOf(s);
  }

  // "next page": the stop that brings the first line not entirely on screen to the top
  nextPage() {
    const s = this.scroll[this.tab];
    const o = this.offsetOf(s);
    const cut = this.page.lineTops.find((l) => l.y + l.h > o + VH);
    let j = s + 1;
    if (cut) while (j + 1 < this.page.stops.length && this.page.stops[j + 1] <= cut.y) j++;
    return j;
  }

  close() {
    audio.sfx('cancel');
    lastTab = this.tab;
    this.g.pop(this);
    this.resolve();
  }

  update(g) {
    this.t++;
    if (g.auto) { g.pop(this); this.resolve(); return; }
    const inp = g.input;
    if (this.t > 3 && (inp.pressed('b') || inp.pressed('menu'))) { this.close(); return; }
    if (inp.pressed('left') || inp.pressed('right')) {
      this.tab = (this.tab + (inp.pressed('left') ? TABS.length - 1 : 1)) % TABS.length;
      lastTab = this.tab;
      this.setScroll(this.scroll[this.tab], false);
      audio.sfx('cursor');
    }
    const s = this.scroll[this.tab];
    const max = this.maxScroll();
    if (inp.repeat('up') && s > 0) { this.setScroll(s - 1); audio.sfx('cursor'); }
    if (inp.repeat('down') && s < max) { this.setScroll(s + 1); audio.sfx('cursor'); }
    if (inp.pressed('a') && this.t > 3 && max > 0) {
      // A: next page, and back to the top after the last one
      this.setScroll(s >= max ? 0 : this.nextPage(), s < max);
      audio.sfx('cursor');
    }
    const target = this.offsetOf(this.scroll[this.tab]);
    this.shown += (target - this.shown) * 0.4;
    if (Math.abs(target - this.shown) < 0.5) this.shown = target;
  }

  draw(ctx) {
    drawCover(ctx);
    const color = TABS[this.tab].color;
    this.drawTabs(ctx, false);
    panel(ctx, PX, PY, PW, PH);
    this.drawTabs(ctx, true);
    rect(ctx, PX + 6, PY + 6, PW - 12, 2, color);
    rect(ctx, PX + 6, PY + 8, PW - 12, 1, shade(color, -0.45));

    // text area (clipped; at rest only whole lines are drawn)
    const pg = this.page;
    const off = Math.round(this.shown);
    const settled = off === Math.round(this.offsetOf(this.scroll[this.tab]));
    ctx.save();
    ctx.beginPath();
    ctx.rect(VX - 12, VY - 2, VW + 14, VH + 3);
    ctx.clip();
    let y = VY - off;
    for (const b of pg.blocks) {
      if (y > VY + VH) break;
      b.lines.forEach((l, i) => {
        // at rest a heading is not left alone at the bottom without its first line
        const after = l.head && b.lines[i + 1] ? b.lines[i + 1].h : 0;
        if (y + l.h > VY - 2 && y < VY + VH && !(settled && (y < VY - 1 || y + l.h + after > VY + VH + 2))) drawLine(ctx, l, y);
        y += l.h;
      });
      y += b.gap;
    }
    ctx.restore();

    // scrollbar + arrows
    const max = this.maxScroll();
    if (max > 0) {
      // track between the ▲ / ▼ marks
      const TY = VY + 12, TH = VH - 24;
      const total = this.offsetOf(max) + VH;
      const th = Math.max(14, Math.round((TH * VH) / total));
      const ty = TY + Math.round(((TH - th) * clamp(this.shown, 0, this.offsetOf(max))) / this.offsetOf(max));
      rect(ctx, SB_X, TY, 4, TH, '#2a2f55');
      rect(ctx, SB_X, ty, 4, th, color);
      rect(ctx, SB_X, ty, 1, th, shade(color, 0.35));
      const s = this.scroll[this.tab];
      if (s > 0) upArrow(ctx, SB_X - 2, VY, this.t);
      if (s < max) downArrow(ctx, SB_X - 2, VY + VH - 8, this.t, '#fff');
    }

    text(ctx, '←→ タブ　↑↓ スクロール　A つぎへ　B とじる', SW / 2, PY + PH - 27, { size: SMALL, align: 'center', color: COLORS.dim });
  }

  // selected = false: the tabs behind the page; true: the open tab, joined to the page
  drawTabs(ctx, selected) {
    const x0 = Math.round((SW - (TAB_W * TABS.length + TAB_GAP * (TABS.length - 1))) / 2);
    TABS.forEach((tb, i) => {
      const sel = i === this.tab;
      if (sel !== selected) return;
      const x = x0 + i * (TAB_W + TAB_GAP);
      const y = sel ? TAB_Y - 2 : TAB_Y;
      const h = sel ? PY - y + 6 : PY - y + 1;
      rect(ctx, x - 1, y - 1, TAB_W + 2, h + 1, '#0a0c18');
      rect(ctx, x, y, TAB_W, h, sel ? tb.color : '#141b3e');
      rect(ctx, x, y, TAB_W, 1, sel ? shade(tb.color, 0.45) : tb.color);
      rect(ctx, x, y + 1, TAB_W, 1, sel ? shade(tb.color, 0.2) : shade(tb.color, -0.4));
      if (sel) rect(ctx, x + TAB_W - 2, y + 2, 2, h - 2, shade(tb.color, -0.2));
      text(ctx, tb.label, x + TAB_W / 2, y + 6, { size: BODY, align: 'center', color: sel ? '#ffffff' : COLORS.dim, shadow: sel ? shade(tb.color, -0.5) : null });
    });
    if (selected) return;
    // ◀ ▶ hints that left / right switch tabs
    const bl = Math.floor(this.t / 20) % 2 ? 1 : 0;
    ctx.fillStyle = COLORS.accent;
    const cy = TAB_Y + 13;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x0 - 14 - bl + i, cy - i, 1, i * 2 + 1);
      ctx.fillRect(SW - x0 + 13 + bl - i, cy - i, 1, i * 2 + 1);
    }
  }
}

// The notebook's leather cover with stitching (the page panel sits on it), drawn
// once into an offscreen canvas at 1 logical pixel per pixel.
let coverCv = null;
function drawCover(ctx) {
  if (!coverCv) {
    coverCv = document.createElement('canvas');
    coverCv.width = SW;
    coverCv.height = SH;
    const c = coverCv.getContext('2d');
    rect(c, 0, 0, SW, SH, '#0b0d1a');
    const { x, y, w, h } = COVER;
    rect(c, x - 1, y - 1, w + 2, h + 2, '#22202a');
    rect(c, x, y, w, h, '#5a2e3a');
    rect(c, x, y, w, 1, '#84505c');
    rect(c, x, y, 1, h, '#84505c');
    rect(c, x, y + h - 2, w, 2, '#3e1e28');
    rect(c, x + w - 2, y, 2, h, '#3e1e28');
    c.fillStyle = '#663644';
    for (let yy = y + 3; yy < y + h - 3; yy += 3) for (let xx = x + 3 + ((yy * 7) % 5); xx < x + w - 3; xx += 9) c.fillRect(xx, yy, 1, 1);
    // stitching
    c.fillStyle = '#c8907e';
    for (let xx = x + 6; xx < x + w - 8; xx += 7) { c.fillRect(xx, y + 4, 4, 1); c.fillRect(xx, y + h - 6, 4, 1); }
    for (let yy = y + 6; yy < y + h - 8; yy += 7) { c.fillRect(x + 4, yy, 1, 4); c.fillRect(x + w - 6, yy, 1, 4); }
  }
  ctx.drawImage(coverCv, 0, 0, SW, SH);
}

function upArrow(ctx, x, y, t = 0, color = '#fff') {
  const o = Math.floor(t / 10) % 2;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 - i, y + 3 - o + i, i * 2 + 1, 1);
}

// 13x11 heart (filled or empty).
const HEART = [
  '..ooo...ooo..',
  '.ohhfo.offfo.',
  'ohhfffofffffo',
  'ohfffffffffso',
  'offffffffffso',
  '.offffffffso.',
  '..offffffso..',
  '...offffso...',
  '....offso....',
  '.....oso.....',
  '......o......',
];
const HEART_PAL = {
  full: { o: '#5a1430', h: '#ffd0e4', f: '#ff5f9e', s: '#d63a7a' },
  empty: { o: '#555a80', h: '#2e3460', f: '#232a52', s: '#1e2448' },
};
function heart(ctx, x, y, full) {
  const pal = HEART_PAL[full ? 'full' : 'empty'];
  for (let j = 0; j < HEART.length; j++) {
    for (let i = 0; i < HEART[j].length; i++) {
      const ch = HEART[j][i];
      if (ch !== '.') { ctx.fillStyle = pal[ch]; ctx.fillRect(x + i, y + j, 1, 1); }
    }
  }
}

function drawLine(ctx, l, y) {
  let x = VX + (l.x || 0);
  if (l.mark) rect(ctx, VX - 10, y + 1, 3, l.h - 2, COLORS.accent);
  const dy = 1;
  if (l.head) {
    // section heading: a small diamond, the title and a dotted rule to the right edge
    const c = l.head;
    rect(ctx, x, y + 9, 6, 6, shade(c, -0.35));
    rect(ctx, x + 1, y + 10, 4, 4, c);
    rect(ctx, x + 1, y + 10, 2, 1, shade(c, 0.5));
    text(ctx, l.t, x + 12, y + 3, { size: BODY, color: c });
    const tw = measure(ctx, l.t, BODY);
    ctx.fillStyle = shade(c, -0.55);
    for (let xx = Math.round(x + 22 + tw); xx < VX + VW; xx += 4) ctx.fillRect(xx, y + 12, 2, 1);
    return;
  }
  if (l.tag) {
    const tw = Math.round(measure(ctx, l.tag.t, 12) + 8);
    const ty = y + (l.s === SMALL ? 1 : 2);
    rect(ctx, x, ty, tw, 16, l.tag.bg);
    rect(ctx, x, ty, tw, 1, shade(l.tag.bg, 0.3));
    rect(ctx, x, ty + 15, tw, 1, shade(l.tag.bg, -0.3));
    text(ctx, l.tag.t, x + 4, ty + 2, { size: 12, color: '#ffffff', shadow: null });
    x += tw + 6;
  }
  if (l.t) text(ctx, l.t, x, y + dy, { size: l.s, color: l.c || COLORS.text });
  const textEnd = l.t ? x + measure(ctx, l.t, l.s) : x;
  if (l.gauge) {
    const gx = VX + GAUGE_X, gy = y + 5, gw = GAUGE_W;
    rect(ctx, gx, gy, gw, 11, '#06081a');
    rect(ctx, gx + 1, gy + 1, gw - 2, 9, '#2a2f55');
    const fw = Math.round(clamp(l.gauge.frac, 0, 1) * (gw - 2));
    if (fw > 0) {
      rect(ctx, gx + 1, gy + 1, fw, 9, l.gauge.color);
      rect(ctx, gx + 1, gy + 1, fw, 2, shade(l.gauge.color, 0.35));
      rect(ctx, gx + 1, gy + 8, fw, 2, shade(l.gauge.color, -0.25));
    }
    for (let i = 1; i < 4; i++) rect(ctx, gx + Math.round((gw * i) / 4), gy + 1, 1, 2, 'rgba(255,255,255,0.25)');
  }
  if (l.hearts != null) {
    const hx = Math.round(Math.max(VX + HEART_X, textEnd + 14));
    for (let i = 0; i < HEART_N; i++) heart(ctx, hx + i * 16, y + 5, i < l.hearts);
  }
  if (l.badge) {
    const bw = Math.round(measure(ctx, l.badge.t, 12) + 10);
    const bx = VX + VW - bw;
    rect(ctx, bx, y + 2, bw, 16, l.badge.c);
    rect(ctx, bx, y + 2, bw, 1, shade(l.badge.c, 0.35));
    text(ctx, l.badge.t, bx + 5, y + 4, { size: 12, color: '#20232a', shadow: null });
  }
  if (l.r) text(ctx, l.r, VX + VW, y + dy + (l.rs === SMALL && l.s === BODY ? 3 : 0), { size: l.rs || l.s, align: 'right', color: l.rc || COLORS.text });
}
