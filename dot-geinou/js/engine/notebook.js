// てちょう（メニュー → てちょう）: a notebook with three tabs.
//
//   もくひょう  today's numbers and a concrete next goal computed from the state
//   ばしょ      places the player has been to (state.flags.visited, set by g.goto)
//               with a short guide from js/world/guide.js; others are 「？？？」 + a hint
//   きろく      days, jobs, minigames and their best ranks, title, agency
//
// Controls: ←→ tabs, ↑↓ scroll, A next page, B / MENU close. Everything is wrapped
// to the 320x240 screen, so long text never runs off the panel.

import { W, H, fmtMoney, clamp } from './util.js';
import { text, wrap, panel, measure, rect, downArrow, COLORS } from './draw.js';
import { audio } from './audio.js';
import { SKILLS, AGENCIES, RANKS, FINALE_FAME, rankIndex, rankName } from './state.js';
import { MINIGAMES } from './minigame.js';
import { GUIDE, GUIDE_ORDER, TOWNS, AUDITIONS, GUIDE_JOBS, TIER_FAME, jobOpen } from '../world/guide.js';

const TABS = [
  { label: 'もくひょう', color: '#ff8a3d' },
  { label: 'ばしょ', color: '#3fb85f' },
  { label: 'きろく', color: '#3a9fd8' },
];
const TOWN_BG = { tokyo: '#2f5fb8', namba: '#c23a3a' };
const RANK_COLOR = { S: COLORS.accent, A: COLORS.pink, B: COLORS.cyan, C: COLORS.text, D: COLORS.dim };
const MG_ORDER = ['tsukkomi', 'zukko', 'rhythm', 'command', 'quiz', 'announce', 'talk'];

// layout (logical pixels)
const PX = 4, PY = 4, PW = W - 8, PH = H - 8;
const TAB_W = 84, TAB_GAP = 4, TAB_Y = 9, TAB_H = 19;
const VX = 16, VY = 36, VW = 275, VH = 176; // text area; the scrollbar sits right of it
const SB_X = VX + VW + 8;

let lastTab = 0; // reopen on the tab the player looked at last

// ---------------------------------------------------------------- content builder
// A page is a list of blocks (scroll unit); a block is a list of lines.
// line: { t, s: 12|10, c, x, h, r, rs, rc, tag: { t, bg }, badge: { t, c }, mark }
class Page {
  constructor(ctx) { this.ctx = ctx; this.blocks = []; this.b = null; }

  block(gap = 7) { this.b = { lines: [], h: 0, gap }; this.blocks.push(this.b); return this; }

  line(l) {
    if (!this.b) this.block();
    l.s = l.s || 12;
    l.h = l.h || (l.s === 10 ? 13 : 16);
    this.b.lines.push(l);
    this.b.h += l.h;
    return this;
  }

  head(t, c = COLORS.cyan) { return this.line({ t, c, h: 18 }); }

  // wrapped paragraph
  para(t, { c = COLORS.text, s = 12, x = 0, mark } = {}) {
    for (const ln of wrap(this.ctx, t, VW - x, s)) this.line({ t: ln, c, s, x, mark });
    return this;
  }

  // left text (optionally after a small tag) with right-aligned text; falls back to
  // two lines when both do not fit side by side
  row(t, r, { c = COLORS.text, s = 12, x = 0, rc = COLORS.text, rs = s, tag, mark } = {}) {
    const tagW = tag ? measure(this.ctx, tag.t, 10) + 10 : 0;
    const lw = tagW + measure(this.ctx, t, s);
    const rw = r ? measure(this.ctx, r, rs) : 0;
    if (!r || x + lw + rw + 10 <= VW) return this.line({ t, s, c, x, r, rs, rc, tag, mark });
    const lines = wrap(this.ctx, t, VW - x - tagW, s);
    lines.forEach((ln, i) => this.line({ t: ln, s, c, x: i ? x + tagW : x, tag: i ? null : tag, mark }));
    return this.line({ t: '', s: rs, r, rs, rc, mark });
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
    const last = lastBlock != null && lastBlock - minO <= 64 ? lastBlock : tops.find((l) => l.y >= minO).y;
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

// ---------------------------------------------------------------- tab: もくひょう
function goalPage(g, ctx) {
  const st = g.state;
  const fl = st.flags || {};
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);

  pg.block().head('きょうのようす');
  pg.row(`${st.day}日目`, `所持金 ${fmtMoney(st.money)}`, { rc: COLORS.accent });
  const sc = st.stamina / st.maxStamina > 0.5 ? COLORS.good : st.stamina / st.maxStamina > 0.2 ? COLORS.accent : COLORS.bad;
  pg.row(`体力 ${st.stamina}/${st.maxStamina}`, `食事 あと${g.mealsLeft()}回`, { c: sc });
  if (st.stamina < 25) {
    pg.para(g.mealsLeft() > 0 ? '体力が少ない。何か食べるか、ベッドで寝て回復しよう。' : '体力が少ない。今日はもう食べられないので、\nベッドで寝て回復しよう。', { s: 10, c: COLORS.bad });
  }

  // the one most important next step
  pg.block().head('つぎの目標', COLORS.accent);
  if (fl.finaleDone) {
    pg.para('国民的スターになった！おめでとう！');
    pg.para('NHKホールの凱旋コンサートや、\n大きなお仕事で活躍を続けよう。', { s: 10, c: COLORS.dim });
  } else if (st.fame >= FINALE_FAME && fl.finaleInvited) {
    pg.para(g.map && g.map.placeId === 'nhk' ? 'プロデューサーに会いに行こう！' : 'NHK放送センターへ行こう！');
    pg.para('年末の大型歌番組のプロデューサーが、\n入り口の近くで待っている。', { s: 10, c: COLORS.dim });
  } else if (st.fame >= FINALE_FAME) {
    pg.para(`★${FINALE_FAME}に届いた！`);
    pg.para('街に出ると、NHKから大事な電話がかかってくるはず。', { s: 10, c: COLORS.dim });
  } else if (!st.agency) {
    pg.para('事務所のオーディションに合格して、\n所属タレントになろう。');
    pg.para('レッスンや自主練でスキルを上げると、合格しやすくなる。', { s: 10, c: COLORS.dim });
  } else {
    const next = TIER_FAME.find((f) => f > st.fame && f > 30) || FINALE_FAME;
    pg.para(`お仕事で知名度を上げて、★${next}をめざそう。`);
    pg.para(`あと★${next - st.fame}。おすすめのお仕事は下のとおり。`, { s: 10, c: COLORS.dim });
  }

  if (!st.agency && !fl.finaleDone) {
    pg.block().head('オーディション（合格で所属）');
    for (const a of AUDITIONS) pg.row(placeName(a.place), a.how, { tag: townTag(a.place), rs: 10, rc: COLORS.dim });
  }

  // title
  const ri = rankIndex(st.fame);
  const nextRank = RANKS[ri + 1];
  pg.block().head('称号');
  pg.row(`いまは「${rankName(st.fame)}」`, `★${st.fame}`, { rc: COLORS.pink });
  if (nextRank) pg.para(`次の「${nextRank[1]}」まで あと★${nextRank[0] - st.fame}`, { s: 10, c: COLORS.dim });

  // jobs
  const here = g.map && GUIDE[g.map.placeId];
  const jobs = suggestJobs(st, visited, here ? here.town : 'tokyo');
  if (jobs.length) {
    pg.block().head('おすすめのお仕事');
    for (const j of jobs) pg.row('・' + j.label, GUIDE[j.place] ? GUIDE[j.place].short : j.place, { rs: 10, rc: COLORS.dim });
  }
  const nextTier = TIER_FAME.find((f) => f > st.fame && !(f === 30 && st.agency));
  // (with an agency the next ★ line is already the main goal above)
  if (nextTier === 30) pg.para('所属するか★30になると、受けられるお仕事が増える。', { s: 10, c: COLORS.dim });
  else if (nextTier && (!st.agency || fl.finaleDone)) pg.para(`★${nextTier}で、もっと大きなお仕事が増える（あと★${nextTier - st.fame}）。`, { s: 10, c: COLORS.dim });
  if (st.agency && AGENCIES[st.agency]) {
    const sk = SKILLS[AGENCIES[st.agency].skill];
    pg.para(`${AGENCIES[st.agency].name}の得意分野は「${sk}」。\n${sk}のお仕事は、ギャラと知名度が1.1倍！`, { s: 10, c: COLORS.dim });
  }

  if (!fl.finaleDone && st.fame < FINALE_FAME) {
    pg.block().head('さいごの目標');
    pg.para(`★${FINALE_FAME}で、NHKから年末の大舞台の声がかかる。`, { s: 10 });
    pg.para(`（あと★${FINALE_FAME - st.fame}）`, { s: 10, c: COLORS.dim });
  }
  return pg;
}

// ---------------------------------------------------------------- tab: ばしょ
function placesPage(g, ctx) {
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);
  const here = g.map && g.map.placeId;
  const ids = GUIDE_ORDER.filter((id) => GUIDE[id]);
  const count = (town) => ids.filter((id) => GUIDE[id].town === town && visited[id]).length + '/' + ids.filter((id) => GUIDE[id].town === town).length;
  pg.block(5).row(`行った場所 ${ids.filter((id) => visited[id]).length}/${ids.length}`, `東京 ${count('tokyo')}・なんば ${count('namba')}`, { c: COLORS.accent, rs: 10, rc: COLORS.dim });
  for (const id of ids) {
    const p = GUIDE[id];
    const tag = { t: TOWNS[p.town], bg: TOWN_BG[p.town] };
    pg.block(6);
    if (!visited[id]) {
      pg.line({ t: '？？？', c: COLORS.dim, tag });
      pg.para('ヒント：' + (p.hint || '街を歩いてさがしてみよう'), { s: 10, c: COLORS.dim, x: 8 });
      continue;
    }
    const mark = id === here;
    pg.line({ t: p.name, c: mark ? COLORS.accent : COLORS.text, tag, mark, badge: p.audition ? { t: 'オーディション', c: COLORS.pink } : mark ? { t: 'いまここ', c: COLORS.accent } : null });
    for (const l of p.lines) pg.para(l, { s: 10, x: 8, mark });
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

  pg.block().row(st.name, `${rankName(st.fame)}　★${st.fame}`, { c: COLORS.accent, rc: COLORS.pink });
  pg.row('所属', st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency].name : 'フリー（未所属）');
  const pm = st.playMinutes || 0;
  pg.row('日数', `${st.day}日目`);
  pg.row('プレイ時間', pm >= 60 ? `${Math.floor(pm / 60)}時間${pm % 60}分` : `${pm}分`);

  pg.block().head('あゆみ');
  pg.row('こなしたお仕事', `${stats.jobs || 0}回`);
  pg.row('ミニゲーム', `${stats.minigames || 0}回`);
  pg.row('行った場所', `${ids.filter((id) => visited[id]).length}/${ids.length}`);
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

const BUILDERS = [goalPage, placesPage, recordPage];

// ---------------------------------------------------------------- scene
export class NotebookScene {
  constructor(g, resolve) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.hidesHud = true; // MapScene skips the HUD while this is open
    this.tab = lastTab;
    this.pages = BUILDERS.map((b) => {
      try { return b(g, g.ctx); } catch (e) { console.error(e); return new Page(g.ctx).block().para('（読み込めませんでした）'); }
    });
    for (const p of this.pages) void p.stops; // lay out once
    this.scroll = [0, 0, 0]; // index into page.stops per tab
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
    // cover the whole screen: the 4px margin would otherwise show slivers of the map,
    // its place banner and toasts around the panel
    rect(ctx, 0, 0, W, H, '#000');
    panel(ctx, PX, PY, PW, PH);
    this.drawTabs(ctx);
    const color = TABS[this.tab].color;
    rect(ctx, PX + 5, VY - 6, PW - 10, 1, color);

    // text area (clipped; at rest only whole lines are drawn)
    const pg = this.page;
    const off = Math.round(this.shown);
    const settled = off === Math.round(this.offsetOf(this.scroll[this.tab]));
    ctx.save();
    ctx.beginPath();
    ctx.rect(VX - 8, VY - 2, VW + 10, VH + 2);
    ctx.clip();
    let y = VY - off;
    for (const b of pg.blocks) {
      if (y > VY + VH) break;
      for (const l of b.lines) {
        if (y + l.h > VY - 2 && y < VY + VH && !(settled && (y < VY - 1 || y + l.h > VY + VH + 2))) drawLine(ctx, l, y);
        y += l.h;
      }
      y += b.gap;
    }
    ctx.restore();

    // scrollbar + arrows
    const max = this.maxScroll();
    if (max > 0) {
      // track between the ▲ / ▼ marks
      const TY = VY + 9, TH = VH - 18;
      const total = this.offsetOf(max) + VH;
      const th = Math.max(10, Math.round((TH * VH) / total));
      const ty = TY + Math.round(((TH - th) * clamp(this.shown, 0, this.offsetOf(max))) / this.offsetOf(max));
      rect(ctx, SB_X, TY, 3, TH, '#2a2f55');
      rect(ctx, SB_X, ty, 3, th, color);
      const s = this.scroll[this.tab];
      if (s > 0) upArrow(ctx, SB_X - 2, VY, this.t);
      if (s < max) downArrow(ctx, SB_X - 2, VY + VH - 6, this.t, '#fff');
    }

    text(ctx, '←→ タブ　↑↓ スクロール　A つぎへ　B とじる', W / 2, H - 22, { size: 10, align: 'center', color: COLORS.dim });
  }

  drawTabs(ctx) {
    const x0 = Math.round((W - (TAB_W * TABS.length + TAB_GAP * (TABS.length - 1))) / 2);
    TABS.forEach((tb, i) => {
      const x = x0 + i * (TAB_W + TAB_GAP);
      const sel = i === this.tab;
      rect(ctx, x, TAB_Y, TAB_W, TAB_H, sel ? tb.color : '#0d1330');
      rect(ctx, x, TAB_Y, TAB_W, 1, sel ? '#ffffff' : tb.color);
      if (!sel) rect(ctx, x, TAB_Y + TAB_H - 1, TAB_W, 1, '#2a2f55');
      text(ctx, tb.label, x + TAB_W / 2, TAB_Y + 4, { align: 'center', color: sel ? '#ffffff' : COLORS.dim, shadow: sel ? 'rgba(0,0,0,0.45)' : null });
    });
    // ◀ ▶ hints that left / right switch tabs
    const bl = Math.floor(this.t / 20) % 2 ? 1 : 0;
    ctx.fillStyle = COLORS.accent;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x0 - 10 - bl + i, TAB_Y + 9 - i, 1, i * 2 + 1);
      ctx.fillRect(W - x0 + 9 + bl - i, TAB_Y + 9 - i, 1, i * 2 + 1);
    }
  }
}

function upArrow(ctx, x, y, t = 0, color = '#fff') {
  const o = Math.floor(t / 10) % 2;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 - i, y + 3 - o + i, i * 2 + 1, 1);
}

function drawLine(ctx, l, y) {
  let x = VX + (l.x || 0);
  if (l.mark) rect(ctx, VX - 7, y, 2, l.h, COLORS.accent);
  const dy = 1;
  if (l.tag) {
    const tw = measure(ctx, l.tag.t, 10) + 6;
    rect(ctx, x, y + 2, tw, 12, l.tag.bg);
    text(ctx, l.tag.t, x + 3, y + 3, { size: 10, color: '#ffffff', shadow: null });
    x += tw + 4;
  }
  if (l.t) text(ctx, l.t, x, y + dy, { size: l.s, color: l.c || COLORS.text });
  if (l.badge) {
    const bw = measure(ctx, l.badge.t, 10) + 8;
    const bx = VX + VW - bw;
    rect(ctx, bx, y + 2, bw, 12, l.badge.c);
    text(ctx, l.badge.t, bx + 4, y + 3, { size: 10, color: '#20232a', shadow: null });
  }
  if (l.r) text(ctx, l.r, VX + VW, y + dy + (l.rs === 10 && l.s === 12 ? 2 : 0), { size: l.rs || l.s, align: 'right', color: l.rc || COLORS.text });
}
