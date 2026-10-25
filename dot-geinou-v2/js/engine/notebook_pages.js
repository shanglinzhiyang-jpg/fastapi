// てちょう — the comedy pages (imported only by notebook.js): お笑い, 賞レース, ネタ帳, カレンダー, and the
// お笑いの道 ladder and today's comedy notes for もくひょう. Every newer system is read through its g.* methods,
// feature-detected and guarded (K.safe), so a save or build without them just leaves that part out.
// K = the kit notebook.js passes in: { Page, BODY, SMALL, COLORS, TC, safe, num, inDays, fmtMoney, vw(), vh(),
// WEEKDAYS, weekdayOf, myRegulars, REGULARS, showWords, AGENCIES, daysToBirthday, YEAR_DAYS, housing }.

const has = (g, m) => !!g && typeof g[m] === 'function';
const STAT_SHORT = { neta: 'ネタ', boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間', voice: '声', act: '演技', hassou: '発想', wagei: '話芸', dokyo: '度胸', chara: '華', adlib: 'アドリブ', mane: 'ものまね', kosei: '構成', kankyaku: '客読み' };
const STAT_ORDER = Object.keys(STAT_SHORT);
const KIND = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'トーク' };
const KIND_ORDER = Object.keys(KIND);
const KIND_COLOR = { manzai: '#d8902a', conte: '#3a8ad8', pin: '#c2407a', rakugo: '#8a6a3a', ogiri: '#3fa85f', utaneta: '#a05ad0', monomane: '#d85a5a', talk: '#4aa0a0' };
const ROLE = { boke: 'ボケ', tsukkomi: 'ツッコミ', both: 'Wボケ', pin: 'ピン' };
const TYPE = { pin: 'ピン', combi: 'コンビ', trio: 'トリオ' };
const STYLE = { manzai: '漫才中心', conte: 'コント中心', both: '漫才・コント', pin: 'ピン芸' };
const NSC_WORD = { none: 'まだ入学していない', applied: '入学手続きずみ', enrolled: '在学中', graduated: '卒業', expelled: '除籍', quit: '退学' };

// ---------------------------------------------------------------- dates
export function gdate(g, K, day) {
  if (has(g, 'gameDate')) {
    const d = K.safe(() => g.gameDate(day), null);
    if (d && Number.isFinite(d.month) && Number.isFinite(d.dom)) return d;
  }
  const k = Math.floor((day - 1) / 10);
  return { year: null, month: (((k + 3) % 12) + 12) % 12 + 1, dom: ((((day - 1) % 10) + 10) % 10) * 3 + 1 };
}
export const dateText = (g, K, day) => { const d = gdate(g, K, day); return `${d.month}月${d.dom}日（${K.WEEKDAYS[K.weekdayOf(day)]}）`; };
const sameMonth = (a, b) => a.month === b.month && a.year === b.year;
function monthStart(g, K, day) {
  const d = gdate(g, K, day);
  let s = day;
  for (let i = 0; i < 40 && sameMonth(gdate(g, K, s - 1), d); i++) s--;
  return s;
}
function monthDays(g, K, start) {
  const d = gdate(g, K, start);
  const out = [];
  for (let s = start; out.length < 31 && sameMonth(gdate(g, K, s), d); s++) out.push(s);
  return out;
}
// the first day of the month `off` months from the one holding `day`
export function monthOf(g, K, day, off) {
  let s = monthStart(g, K, day);
  for (let k = 0; k < off; k++) s += monthDays(g, K, s).length;
  for (let k = 0; k > off; k--) s = monthStart(g, K, s - 1);
  return s;
}

// ---------------------------------------------------------------- contests (shared)
const contestsOf = (g, K) => (has(g, 'contests') ? K.safe(() => g.contests(), []) || [] : []);
const cname = (c) => (c && c.def && (c.def.short || c.def.name)) || (c && c.label) || (c && c.id) || '';
const ACTIVE = new Set(['entered', 'passed']);
// all the player's results, newest first: [{ c, e, r, year }]
function myResults(g, K, list) {
  const out = [];
  const seen = new Set();
  for (const c of list) {
    const ents = c.entry ? [c.entry] : [];
    if (has(g, 'contestEntries')) ents.push(...(K.safe(() => g.contestEntries(c.id), []) || []));
    for (const e of ents) {
      if (!e) continue;
      const key = c.id + '|' + (e.year || c.year);
      if (seen.has(key)) continue;
      seen.add(key);
      for (const r of Array.isArray(e.results) ? e.results : []) if (r) out.push({ c, e, r, year: e.year || c.year });
    }
  }
  return out.sort((a, b) => K.num(b.r.day) - K.num(a.r.day));
}
// career totals over every source (D1's stats + the self-run contests' own summaries)
function careerTotals(g, K, list, results) {
  const T = { entered: 0, passed: 0, finals: 0, wins: 0, titles: [] };
  const d1 = has(g, 'contestState') ? K.safe(() => g.contestState().stats, null) : null;
  if (d1) for (const k of ['entered', 'passed', 'finals', 'wins']) T[k] = K.num(d1[k]);
  const self = { entered: 0, passed: 0, finals: 0, wins: 0 };
  const m1 = has(g, 'm1') ? K.safe(() => g.m1().me, null) : null;
  if (m1) { self.entered += K.num(m1.entries); self.passed += K.num(m1.semis); self.finals += K.num(m1.finals); if (m1.champion) self.wins++; }
  const koc = has(g, 'koc') ? K.safe(() => g.koc().stats, null) : null;
  if (koc) { self.entered += K.num(koc.entered); self.passed += K.num(koc.semis); self.finals += K.num(koc.finals); self.wins += K.num(koc.wins); }
  for (const f of ['r1', 'abcgp']) {
    const s = has(g, f) ? K.safe(() => g[f](), null) : null;
    if (s) { self.entered += K.num(s.entries); self.finals += K.num(s.finals); self.wins += K.num(Array.isArray(s.wins) ? s.wins.length : s.wins); }
  }
  for (const k of ['entered', 'passed', 'finals', 'wins']) T[k] = Math.max(T[k], self[k]);
  if (list.some((c) => c.entry)) T.entered = Math.max(T.entered, 1);
  if (results.some((x) => x.r.passed)) T.passed = Math.max(T.passed, results.filter((x) => x.r.passed).length);
  // titles: champion entries, then the self-run summaries for contests without one
  const seen = new Set();
  for (const c of list) {
    const ents = c.entry ? [c.entry] : [];
    if (has(g, 'contestEntries')) ents.push(...(K.safe(() => g.contestEntries(c.id), []) || []));
    for (const e of ents) {
      if (!e || e.status !== 'champion') continue;
      const key = c.id + '|' + (e.year || c.year);
      if (seen.has(key)) continue;
      seen.add(key);
      T.titles.push({ id: c.id, text: `${e.year || c.year}年 ${cname(c)}`, award: e.award || null });
    }
  }
  const has1 = (id) => T.titles.some((t) => t.id === id);
  if (m1 && m1.champion && !has1('m1')) T.titles.push({ id: 'm1', text: `${typeof m1.champion === 'number' ? m1.champion + '年 ' : ''}M-1グランプリ` });
  if (koc && K.num(koc.wins) && !has1('koc')) T.titles.push({ id: 'koc', text: `キングオブコント${K.num(koc.wins) > 1 ? `（${koc.wins}回）` : ''}` });
  for (const [f, name] of [['r1', 'R-1'], ['abcgp', 'ABCお笑いグランプリ']]) {
    const s = has(g, f) ? K.safe(() => g[f](), null) : null;
    const w = s ? K.num(Array.isArray(s.wins) ? s.wins.length : s.wins) : 0;
    if (w && !has1(f)) T.titles.push({ id: f, text: `${name}${w > 1 ? `（${w}回）` : ''}` });
  }
  T.wins = Math.max(T.wins, T.titles.length);
  return T;
}
const resultWord = (r) => (r.withdrawn ? ['棄権', 'dim'] : r.place === 1 ? ['優勝！', 'accent'] : r.passed ? ['通過', 'good'] : r.place ? [`${r.place}位`, 'text'] : ['敗退', 'bad']);

// ---------------------------------------------------------------- today's comedy notes (for もくひょう)
export function comedyNotes(g, K) {
  const C = K.COLORS;
  const out = [];
  if (has(g, 'contestToday')) {
    const today = K.safe(() => g.contestToday(), []) || [];
    for (const t of today.filter((x) => x && x.kind === 'round').slice(0, 2)) {
      const c = has(g, 'contest') ? K.safe(() => g.contest(t.id), null) : null;
      const nm = (c && (c.short || c.name)) || (t.label || t.id);
      out.push([`きょうは「${nm}」の本番！会場へ向かおう。`, C.accent, 'contest']);
    }
  }
  if (has(g, 'nsc')) {
    const n = K.safe(() => g.nsc(), null);
    if (n && n.status === 'enrolled') {
      if (n.classToday && !n.attendedToday) out.push([`きょうはNSCの授業（${n.classToday.label || '授業'}）。出席しよう。`, C.cyan, 'owarai']);
      if (K.num(n.unpaid) > 0) out.push([`NSCの学費が未納（${K.fmtMoney(n.unpaid)}）。受付で払おう。`, C.bad, 'owarai']);
    }
  }
  if (has(g, 'unit')) {
    const u = K.safe(() => g.unit(), null);
    if (u && u.type !== 'pin' && (u.quarrel || K.num(u.harmony, 70) < 32)) out.push([`相方とギクシャクしている（コンビ仲 ${Math.round(K.num(u.harmony))}）。話し合いかネタ合わせを。`, C.bad, 'owarai']);
  }
  return out;
}

// ---------------------------------------------------------------- お笑いの道 (もくひょう)
// A ladder from the first step to a title: [{ label, done, note }]; the first not done is the next goal.
export function comedyLadder(g, K) {
  if (!has(g, 'unit')) return null;
  const st = g.state;
  const u = K.safe(() => g.unit(), null);
  if (!u) return null;
  const ow = has(g, 'owarai') ? K.safe(() => g.owarai(), null) : null;
  const car = (ow && ow.career) || {};
  const nsc = has(g, 'nsc') ? K.safe(() => g.nsc(), null) : null;
  const ns = has(g, 'netaStats') ? K.safe(() => g.netaStats(), null) : null;
  const list = contestsOf(g, K);
  const results = myResults(g, K, list);
  const T = careerTotals(g, K, list, results);
  const nscIn = nsc && ['applied', 'enrolled', 'graduated'].includes(nsc.status);
  const combi = u.type !== 'pin';
  const stages = K.num(car.stages) || K.num(u.stages);
  const steps = [];
  const nscNote = nsc && nsc.open && nsc.open.tokyo === false ? 'なんばのNSC（大阪校）で入学の申し込み。4月入学・1年制。' : 'なんばのNSC（大阪校）か、東京校で入学の申し込み。4月入学・1年制。';
  if (!st.agency) steps.push({ label: 'NSCに入る（養成所で基礎を学ぶ）', done: nscIn || !!st.agency, note: nscNote + '事務所のオーディションから入る道もある。' });
  steps.push({ label: '相方を見つける（ピンでもOK）', done: combi || stages >= 8, note: 'スマホの「相方募集」で探すか、NSCの同期に声をかけよう。ピン芸人の道もある。' });
  steps.push({ label: 'ネタを書く', done: K.num(ns && ns.count) > 0, note: 'スマホの「ネタ帳」で台本を書いて、AIに採点してもらおう。' });
  steps.push({ label: '初舞台に立つ', done: stages > 0 || !!car.debut, note: '貸し稽古場「ドットスタジオ」のフリーライブ（受付で申し込み）に出てみよう。' });
  // the open contest to aim at (eligible, the most prestigious first)
  let aim = null;
  if (!T.entered && has(g, 'contestEligibility')) {
    const open = list.filter((c) => c.status === 'open' && !c.entry).sort((a, b) => K.num(b.def && b.def.prestige) - K.num(a.def && a.def.prestige));
    for (const c of open.slice(0, 4)) { const el = K.safe(() => g.contestEligibility(c.id), null); if (el && el.ok) { aim = c; break; } }
  }
  steps.push({ label: '賞レースにはじめてエントリー', done: T.entered > 0, note: aim ? `「${aim.label}」が受付中（${aim.statusLabel || ''}）。スマホの「賞レース」からエントリーしよう。` : 'スマホの「賞レース」で、受付中の大会を探そう。' });
  const cur = list.find((c) => c.entry && ACTIVE.has(c.entry.status) && c.nextRound);
  const curNote = cur ? `「${cname(cur)}」の${cur.nextRound.name || '次の回戦'}（${cur.nextRound.day ? dateText(g, K, cur.nextRound.day) : ''}）。ネタ合わせで仕上げよう。` : '次の大会にエントリーして、予選を勝ちあがろう。';
  steps.push({ label: '1回戦（予選）突破', done: T.passed > 0, note: curNote });
  steps.push({ label: '決勝進出', done: T.finals > 0, note: cur ? curNote : '準決勝の壁をこえよう。「お笑い」タブの実力不足を一つずつ。' });
  steps.push({ label: '優勝！', done: T.wins > 0, note: '決勝で1位に。決勝は1本目の出来と、ネタの鮮度が勝負。' });
  if (has(g, 'theaterRank')) {
    const r = K.safe(() => g.theaterRank(), null);
    if (r) steps.push({ label: '劇場の看板になる', done: K.num(r.index) >= 6, note: `いまの劇場ランク：${r.name}。ウケる舞台を重ねると上がっていく。` });
  }
  return steps;
}

// ---------------------------------------------------------------- tab: お笑い
export function owaraiPage(g, ctx, K) {
  const C = K.COLORS, S = K.SMALL;
  const pg = new K.Page(ctx);
  const col = K.TC.owarai;
  if (!has(g, 'unit')) {
    pg.block().head('お笑い', col);
    pg.para('お笑いの記録は、まだ読みこめない。', { s: S, c: C.dim });
    return pg;
  }
  const u = K.safe(() => g.unit(), null) || { type: 'pin', name: g.state.name, members: [] };
  const ow = has(g, 'owarai') ? K.safe(() => g.owarai(), null) : null;
  const car = (ow && ow.career) || {};
  const combi = u.type !== 'pin';

  pg.block().head(combi ? `${TYPE[u.type] || 'コンビ'}` : 'ピン芸人', col);
  pg.row(u.name || g.state.name, combi ? `${TYPE[u.type] || ''}・${STYLE[u.style] || ''}` : 'ピン芸', { c: C.accent, rs: S, rc: C.dim });
  const mem = (u.members || []).map((m) => `${m.short || m.name}（${ROLE[m.role] || ''}）`).join('・');
  if (mem && combi) pg.para(mem, { s: S, c: C.text, x: 12 });
  if (combi && u.formed && u.formed.year) {
    const yrs = has(g, 'unitYears') ? K.num(K.safe(() => g.unitYears(), 0)) : 0;
    pg.row('結成', `${u.formed.year}年${u.formed.month || ''}${u.formed.month ? '月' : ''}（結成${yrs + 1}年目）`, { s: S, rs: S, x: 12, rc: C.text });
  }
  if (combi) {
    const h = Math.round(K.num(u.harmony, 70));
    const hc = h >= 70 ? C.good : h >= 45 ? C.accent : C.bad;
    pg.row('コンビ仲', String(h), { gauge: { frac: h / 100, color: hc }, rc: hc });
    const adv = u.quarrel ? 'けんか中…。相方と話し合おう（相方のいる稽古場で話しかける）。'
      : h < 14 ? '解散の危機！話し合いの場をもとう。' : h < 32 ? 'ギクシャクしている。ネタ合わせや、ギャラの分け方を見直そう。'
        : h < 60 ? 'まずまず。ネタ合わせを続けると、息が合ってくる。' : '息ぴったり！この調子。';
    pg.para(adv, { s: S, c: u.quarrel || h < 32 ? C.bad : C.dim, x: 16 });
  }
  const ag = g.state.agency && K.AGENCIES[g.state.agency] ? K.AGENCIES[g.state.agency].name : 'フリー（アマチュア）';
  pg.row('所属', ag, { s: S, rs: S, rc: C.text });

  // 芸歴 and the stage
  pg.block().head('芸歴と舞台', col);
  const gr = has(g, 'geireki') ? K.num(K.safe(() => g.geireki(), 0)) : 0;
  const deb = car.debut;
  pg.row('芸歴', deb ? `${gr + 1}年目（${deb.year}年${deb.month}月 初舞台）` : 'まだデビュー前', { rc: deb ? C.cyan : C.dim, rs: S });
  const stages = K.num(car.stages);
  pg.row('舞台', `${stages}回（ウケた ${K.num(car.ukeru)}・スベった ${K.num(car.suberu)}）`, { rs: S, rc: C.text });
  if (K.num(car.bestScore)) pg.row('ベストの舞台', `${Math.round(K.num(car.bestScore))}点`, { s: S, rs: S, x: 12, rc: C.accent });
  if (has(g, 'theaterRank')) {
    const r = K.safe(() => g.theaterRank(), null);
    if (r) {
      pg.row('劇場ランク', `${r.name}（${K.num(r.index) + 1}/7）`, { rc: C.pink, rs: S });
      pg.line({ h: 14, draw: (c, x, y, D) => { for (let i = 0; i < 7; i++) D.rect(c, x + 16 + i * 26, y + 4, 22, 6, i <= K.num(r.index) ? D.ink(C.pink) : D.th.track); } });
      if (r.desc) pg.para(r.desc, { s: S, c: C.dim, x: 16 });
    }
  }

  // the 14 stats as a compact chart (two columns)
  const me = (u.members || []).find((m) => m.id === 'player') || (u.members || [])[0];
  const stats = (me && me.stats) || {};
  pg.block().head('お笑いのステータス（0〜100）', col);
  for (let i = 0; i < STAT_ORDER.length; i += 2) {
    const pair = STAT_ORDER.slice(i, i + 2).map((k) => [STAT_SHORT[k], Math.round(K.num(stats[k]))]);
    pg.line({ h: 18, draw: (c, x, y, D) => bars(c, x, y, D, pair, K) });
  }
  if (has(g, 'unitPower')) {
    pg.line({ t: '芸の種類ごとの実力', s: S, c: C.dim, h: 22 });
    const kp = KIND_ORDER.map((k) => [KIND[k], Math.round(K.num(K.safe(() => g.unitPower(k), 0)))]);
    for (let i = 0; i < kp.length; i += 2) {
      const pair = kp.slice(i, i + 2);
      pg.line({ h: 18, draw: (c, x, y, D) => bars(c, x, y, D, pair, K) });
    }
  }

  // 実力不足 top 3
  if (has(g, 'shortfall')) {
    const kind = u.style === 'both' ? 'double' : KIND[u.style] ? u.style : 'any';
    const need = K.num(stages) < 10 ? 50 : 65;
    const sf = K.safe(() => g.shortfall(kind, need), null);
    pg.block(8, { sticky: sf && !sf.ok ? 'bad' : null }).head(`実力不足（目標ライン ${need}）`, C.bad);
    if (!sf) pg.para('―', { s: S, c: C.dim });
    else if (sf.ok || !(sf.gaps || []).length) pg.para('いまの目標ラインはクリア！次はもっと上をめざそう。', { s: S, c: C.good });
    else {
      for (const gap of sf.gaps.slice(0, 3)) {
        pg.row('・' + (gap.label || gap.key), `${Math.round(K.num(gap.have))}／${Math.round(K.num(gap.need))}`, { rs: S, rc: C.bad });
        if (gap.reason) pg.para(gap.reason, { s: S, c: C.text, x: 16 });
        if (gap.hint) pg.para('→ ' + gap.hint, { s: S, c: C.cyan, x: 16 });
      }
    }
  }

  // NSC
  if (has(g, 'nsc')) {
    const n = K.safe(() => g.nsc(), null);
    if (n) {
      pg.block().head('NSC（養成所）', col);
      const where = n.campusName ? `${n.campusName}${K.num(n.ki) ? ` ${n.ki}期` : ''}` : '';
      pg.row(NSC_WORD[n.status] || n.status, where, { c: n.status === 'enrolled' ? C.good : n.status === 'expelled' ? C.bad : C.text, rc: C.cyan, rs: S });
      if (n.status === 'none') {
        pg.para(`${n.open && n.open.tokyo === false ? '大阪校（なんば）' : '大阪校（なんば）・東京校'}。1年制・4月入学。授業とネタ見せで、基礎から鍛えられる。`, { s: S, c: C.dim, x: 12 });
        pg.row('学費（分納・月々）', K.fmtMoney(K.num(n.monthly)), { s: S, rs: S, x: 12, rc: C.text });
      } else if (n.status === 'applied') {
        pg.para('4月に入学。それまでに、生活費とネタの準備を。', { s: S, c: C.dim, x: 12 });
      } else if (n.status === 'enrolled') {
        pg.row('出席率', `${Math.round(K.num(n.attendRate) * (K.num(n.attendRate) <= 1 ? 100 : 1))}%（${K.num(n.attend)}/${K.num(n.classDays)}日）`, { s: S, rs: S, x: 12, rc: C.text });
        if (K.num(n.netamiCount)) pg.row('ネタ見せ', `平均 ${Math.round(K.num(n.netamiAvg))}点・最高 ${Math.round(K.num(n.netamiBest))}点（${n.netamiCount}回）`, { s: S, rs: S, x: 12, rc: C.text });
        pg.row('きょうの授業', n.classToday ? `${n.classToday.label}${n.attendedToday ? '（出席ずみ）' : ''}` : '休講', { s: S, rs: S, x: 12, rc: n.classToday && !n.attendedToday ? C.accent : C.dim });
        pg.row('学費（月々）', K.fmtMoney(K.num(n.monthly)), { s: S, rs: S, x: 12, rc: C.text });
        if (K.num(n.unpaid) > 0) pg.para(`未納 ${K.fmtMoney(n.unpaid)}。NSCの受付か「芸人手帳」から払おう。たまると除籍になる。`, { s: S, c: C.bad, x: 12 });
        if (n.gradOpen) pg.para('卒業公演の時期！ネタ見せ教室で申し込もう。', { s: S, c: C.accent, x: 12 });
      } else if (n.status === 'graduated') {
        pg.para('NSCを卒業した。同期は一生のライバル。', { s: S, c: C.dim, x: 12 });
      }
    }
  }
  pg.block().para('くわしくは スマホの「芸人手帳」で。練習は稽古場・NSC・家で。', { s: S, c: C.dim });
  return pg;
}

// two labelled mini bars side by side
function bars(c, x, y, D, pair, K) {
  const C = K.COLORS;
  const cw = Math.floor(K.vw() / 2);
  pair.forEach(([label, v], i) => {
    const x0 = x + i * cw;
    D.text(c, label, x0, y + 1, { size: 13, color: D.ink(C.text), shadow: D.shadow });
    const bx = x0 + 76, bw = cw - 76 - 44;
    const color = v >= 60 ? C.good : v >= 35 ? C.accent : C.bad;
    D.rect(c, bx, y + 5, bw, 8, D.th.trackEdge);
    D.rect(c, bx + 1, y + 6, bw - 2, 6, D.th.track);
    const fw = Math.round(Math.max(0, Math.min(1, v / 100)) * (bw - 2));
    if (fw > 0) D.rect(c, bx + 1, y + 6, fw, 6, D.ink(color));
    D.text(c, String(v), x0 + cw - 12, y + 1, { size: 13, color: D.ink(color), align: 'right', shadow: D.shadow });
  });
}

// ---------------------------------------------------------------- tab: 賞レース
export function contestPage(g, ctx, K) {
  const C = K.COLORS, S = K.SMALL;
  const pg = new K.Page(ctx);
  const col = K.TC.contest;
  const list = contestsOf(g, K);
  if (!list.length) {
    pg.block().head('賞レース', col);
    pg.para('賞レースの情報は、まだ読みこめない。', { s: S, c: C.dim });
    return pg;
  }
  // today
  const today = has(g, 'contestToday') ? (K.safe(() => g.contestToday(), []) || []).filter((t) => t && t.kind === 'round') : [];
  if (today.length) {
    pg.block(8, { sticky: 'bad' }).head('きょうは本番！', C.bad);
    for (const t of today) {
      const c = list.find((x) => x.id === t.id);
      pg.para(`「${c ? c.label : t.label || t.id}」${t.idx != null && c && c.nextRound ? `の${c.nextRound.name}` : ''}。会場へ向かおう！`, { s: S, c: C.text });
    }
  }
  // my entries
  const mine = list.filter((c) => c.entry);
  pg.block().head('エントリー中の大会', col);
  if (!mine.length) pg.para('いまエントリーしている大会はない。下の「受付中」から選ぼう。', { s: S, c: C.dim });
  for (const c of mine) {
    const e = c.entry;
    const st = e.status === 'champion' ? ['優勝！', C.accent] : e.status === 'out' ? ['敗退', C.dim] : e.status === 'withdrawn' ? ['棄権', C.dim] : e.status === 'passed' ? ['勝ちのこり中', C.good] : ['エントリー済み', C.cyan];
    pg.row(c.label, st[0], { rc: st[1], rs: S, c: C.text, tag: { t: (c.def && c.def.short) || '大会', bg: shadeTag(c) } });
    const nr = c.nextRound;
    const next = ACTIVE.has(e.status) ? (nr && K.num(nr.day) >= g.state.day ? `次は${nr.name || '次の回戦'}：${dateText(g, K, nr.day)}${nr.venue ? `（${nr.venue}）` : ''}` : c.statusLabel || '') : '';
    const sub = [e.no ? `No.${e.no}` : '', next].filter(Boolean).join('　');
    if (sub) pg.para(sub, { s: S, c: C.text, x: 16 });
    if (ACTIVE.has(e.status) && has(g, 'contestOdds')) {
      const od = K.safe(() => g.contestOdds(c.id), null);
      if (od && od.word) pg.para(`見込み：${od.word}${Number.isFinite(od.pct) || Number.isFinite(Number(od.pct)) ? `（${Math.round(K.num(od.pct))}%）` : ''}`, { s: S, c: C.dim, x: 16 });
    }
  }
  // open now (not entered)
  const open = list.filter((c) => c.status === 'open' && !c.entry).sort((a, b) => K.num(b.def && b.def.prestige) - K.num(a.def && a.def.prestige));
  if (open.length) {
    pg.block().head('受付中の大会', col);
    for (const c of open.slice(0, 5)) {
      const el = has(g, 'contestEligibility') ? K.safe(() => g.contestEligibility(c.id), null) : null;
      pg.row(c.label, el ? (el.ok ? '出場できる' : '出場できない') : '', { rs: S, rc: el && el.ok ? C.good : C.dim });
      const why = el && !el.ok ? (el.reasons && el.reasons[0] && el.reasons[0].text) || el.why : '';
      pg.para([c.statusLabel, why].filter(Boolean).join('　'), { s: S, c: C.dim, x: 16 });
    }
    if (open.length > 5) pg.para(`ほか ${open.length - 5}大会`, { s: S, c: C.dim, x: 16 });
  }
  // coming up: the next entry windows
  const from = (c) => K.num(c.cyc && c.cyc.entry && c.cyc.entry.from);
  const soon = list.filter((c) => c.status === 'future' && !c.entry && from(c) > g.state.day)
    .sort((a, b) => from(a) - from(b) || K.num(b.def && b.def.prestige) - K.num(a.def && a.def.prestige)).slice(0, 4);
  if (soon.length) {
    pg.block().head('もうすぐ受付が始まる大会', col);
    for (const c of soon) pg.row(c.label, `受付 ${dateText(g, K, from(c))}から`, { rs: S, rc: C.dim });
  }
  // results
  const res = myResults(g, K, list);
  pg.block().head('最近の結果', col);
  if (!res.length) pg.para('まだ結果はない。', { s: S, c: C.dim });
  for (const x of res.slice(0, 5)) {
    const [w, wc] = resultWord(x.r);
    const sc = Number.isFinite(Number(x.r.score)) && x.r.score != null ? `　${Math.round(Number(x.r.score))}点` : '';
    pg.row(`${x.year}年 ${cname(x.c)} ${x.r.name || ''}`, w + sc, { rs: S, rc: C[wc] || C.text, s: S });
  }
  // titles and totals
  const T = careerTotals(g, K, list, res);
  pg.block().head('タイトル・通算成績', C.accent);
  if (T.titles.length) for (const t of T.titles) pg.row('◆ ' + t.text, t.award || '優勝', { c: C.accent, rc: C.accent, rs: S });
  else pg.para('まだタイトルはない。めざせ、王者！', { s: S, c: C.dim });
  pg.row('エントリー', `${T.entered}回`, { s: S, rs: S, rc: C.text });
  pg.row('予選通過', `${T.passed}回`, { s: S, rs: S, rc: C.text });
  pg.row('決勝進出', `${T.finals}回`, { s: S, rs: S, rc: T.finals ? C.pink : C.text });
  pg.block().para('エントリーや練習は スマホの「賞レース」アプリで。', { s: S, c: C.dim });
  return pg;
}
const TAGC = ['#b8322a', '#c87a1a', '#3a6ab8', '#2a8a5a', '#8a4ab8', '#b83a7a'];
function shadeTag(c) {
  if (c.def && /^#[0-9a-f]{6}$/i.test(c.def.color || '')) return c.def.color;
  let h = 0;
  for (const ch of String(c.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAGC[h % TAGC.length];
}

// ---------------------------------------------------------------- tab: ネタ帳
export function netaPage(g, ctx, K) {
  const C = K.COLORS, S = K.SMALL;
  const pg = new K.Page(ctx);
  const col = K.TC.neta;
  if (!has(g, 'netaList')) {
    pg.block().head('ネタ帳', col);
    pg.para('ネタ帳は、まだ読みこめない。', { s: S, c: C.dim });
    return pg;
  }
  const list = K.safe(() => g.netaList(), []) || [];
  const ns = has(g, 'netaStats') ? K.safe(() => g.netaStats(), null) : null;
  pg.block().head('ネタ帳', col);
  pg.row(`台本 ${list.length}本`, `AI採点ずみ ${ns ? K.num(ns.scored) : list.filter((n) => n.ai).length}本`, { rc: C.cyan, rs: S });
  const kinds = KIND_ORDER.map((k) => [k, list.filter((n) => n.kind === k).length]).filter(([, n]) => n);
  if (kinds.length) pg.para(kinds.map(([k, n]) => `${KIND[k]} ${n}`).join('・'), { s: S, c: C.dim, x: 12 });
  if (!list.length) {
    pg.para('まだネタがない。スマホの「ネタ帳」（家の机でも）で台本を書いて、AIに採点してもらおう。', { s: S, c: C.dim });
    return pg;
  }
  const q = (n) => (has(g, 'netaQuality') ? K.num(K.safe(() => g.netaQuality(n), 0)) : 0);
  const score = (n) => (n.ai && Number.isFinite(Number(n.ai.total)) ? Number(n.ai.total) : -1);
  const best = list.slice().sort((a, b) => score(b) - score(a) || q(b) - q(a)).slice(0, 5);
  pg.block().head('ベストネタ（AI採点順）', col);
  best.forEach((n, i) => {
    const sc = score(n);
    const scol = sc >= 70 ? C.good : sc >= 45 ? C.accent : sc >= 0 ? C.bad : C.dim;
    pg.row(`${i + 1}. 「${n.title || '無題'}」`, sc >= 0 ? `${Math.round(sc)}点` : '未採点', { tag: { t: KIND[n.kind] || n.kind || 'ネタ', bg: KIND_COLOR[n.kind] || '#6a6a8a' }, rc: scol, rs: S });
    const sec = Math.round(K.num(n.length));
    const len = !sec ? '' : sec < 60 ? `約${sec}秒` : `約${Math.floor(sec / 60)}分${sec % 60 ? `${sec % 60}秒` : ''}`;
    const bits = [n.ai && n.ai.rank, `仕上がり ${Math.round(K.num(n.practice))}%`, `出来 ${Math.round(q(n))}`, len].filter(Boolean);
    pg.para(bits.join('・'), { s: S, c: C.dim, x: 16 });
  });
  const top = best.find((n) => n.ai && Array.isArray(n.ai.advice) && n.ai.advice.length);
  if (top) {
    pg.block(8, { sticky: 'note' }).head(`「${top.title || '無題'}」へのアドバイス`, C.accent);
    for (const a of top.ai.advice.slice(0, 2)) pg.para('・' + a, { s: S, c: C.text });
  }
  const unscored = list.filter((n) => !n.ai).length;
  pg.block();
  if (unscored) pg.para(`まだ採点していない台本が ${unscored}本。`, { s: S, c: C.accent });
  pg.para('仕上がりはネタ合わせで上がり、同じネタを使いすぎると鮮度が落ちる。', { s: S, c: C.dim });
  return pg;
}

// ---------------------------------------------------------------- tab: カレンダー
// The month `off` months from now: a grid of the month's days with markers and the month's plans below.
// page.cal = { off, rects: { prev, next } } (rects in page coordinates; the scene maps taps).
export function calendarPage(g, ctx, K, off) {
  const C = K.COLORS, S = K.SMALL;
  const st = g.state;
  const pg = new K.Page(ctx);
  const start = monthOf(g, K, st.day, off);
  const days = monthDays(g, K, start);
  const d0 = gdate(g, K, start);
  const env = calEnv(g, K, days);
  const ev = new Map(days.map((d) => [d, dayEvents(g, K, d, env)]));
  pg.cal = { off, prev: off > -2, next: off < 6 };
  // title row with ◀ ▶
  const title = `${d0.year ? d0.year + '年' : ''}${d0.month}月`;
  pg.block(4).line({ h: 26, draw: (c, x, y, D) => {
    const w = K.vw();
    const cx = x + w / 2;
    D.text(c, title, cx, y + 3, { size: 16, align: 'center', color: D.ink(C.text), shadow: D.shadow });
    const tw = D.measure(c, title, 16);
    const ac = (on) => (on ? D.ink(K.TC.cal) : D.ink(C.dim));
    tri(c, cx - tw / 2 - 26, y + 12, -1, ac(pg.cal.prev));
    tri(c, cx + tw / 2 + 26, y + 12, 1, ac(pg.cal.next));
    pg.cal.rects = { prev: { x: cx - tw / 2 - 60, w: 56 }, next: { x: cx + tw / 2 + 4, w: 56 }, y, h: 26 };
    D.text(c, off === 0 ? '今月' : off > 0 ? `${off}か月先` : `${-off}か月前`, x + w, y + 6, { size: 13, align: 'right', color: D.ink(C.dim), shadow: D.shadow });
  } });
  // the grid: 5 columns
  const cols = 5, rows = Math.ceil(days.length / cols);
  const CH = K.vh() < 260 ? 52 : 64, chips = CH >= 64 ? 3 : 2;
  pg.line({ h: rows * CH + 4, draw: (c, x, y, D) => {
    const w = K.vw(), cw = Math.floor(w / cols);
    days.forEach((d, i) => {
      const cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * CH;
      const isToday = d === st.day, past = d < st.day, before = d < 1;
      if (isToday) { D.rect(c, cx + 1, cy + 1, cw - 3, CH - 3, D.th.sticky); D.rect(c, cx + 1, cy + CH - 3, cw - 3, 1, D.th.stickyEdge); }
      D.rect(c, cx, cy, cw - 1, 1, D.th.dark ? '#2a3566' : D.th.paperEdge);
      D.rect(c, cx, cy, 1, CH - 1, D.th.dark ? '#2a3566' : D.th.paperEdge);
      const dt = gdate(g, K, d);
      const wd = K.weekdayOf(d);
      const wc = wd === 6 ? C.bad : wd === 5 ? C.cyan : C.text;
      D.text(c, String(dt.dom), cx + 5, cy + 3, { size: 16, color: D.ink(before || past ? C.dim : wc), shadow: D.shadow });
      if (isToday) D.text(c, 'きょう', cx + 8 + D.measure(c, String(dt.dom), 16), cy + 6, { size: 12, color: D.ink(C.accent), shadow: D.shadow });
      D.text(c, `(${K.WEEKDAYS[wd]})`, cx + cw - 6, cy + 6, { size: 12, align: 'right', color: D.ink(wd >= 5 ? wc : C.dim), shadow: D.shadow });
      const list = ev.get(d) || [];
      list.slice(0, chips).forEach((e, k) => {
        const lbl = list.length > chips && k === chips - 1 ? `+${list.length - chips + 1}` : e.chip;
        const tw = Math.min(cw - 10, Math.ceil(D.measure(c, lbl, 12)) + 6);
        const bg = past ? (D.th.dark ? '#2b3150' : '#b9ad96') : e.color;
        D.rect(c, cx + 4, cy + 22 + k * 14, tw, 13, bg);
        c.save();
        c.beginPath(); c.rect(cx + 4, cy + 22 + k * 14, tw, 13); c.clip();
        D.text(c, lbl, cx + 7, cy + 22 + k * 14, { size: 12, color: '#ffffff', shadow: null });
        c.restore();
      });
    });
  } });
  // the month's plans (as many as fit on the page; the rest summarized)
  const items = [];
  for (const d of days) for (const e of ev.get(d) || []) if (e.list !== false) items.push({ d, e });
  items.sort((a, b) => b.e.pri - a.e.pri || a.d - b.d);
  // fit the page (the calendar never scrolls: ↑↓ change the month)
  const weekly = env.weekly.slice(0, K.vh() < 260 ? 1 : 3);
  let room = Math.floor((K.vh() - 30 - (rows * CH + 4) - 6 - 26 - 18 * weekly.length) / 18);
  if (items.length > room) room -= 1;
  room = Math.max(0, room);
  const shown = items.slice(0, room).sort((a, b) => a.d - b.d || b.e.pri - a.e.pri);
  pg.block(6).head('この月の予定', K.TC.cal);
  if (!items.length && !weekly.length) pg.para('とくに予定はない。', { s: S, c: C.dim });
  for (const { d, e } of shown) {
    const dt = gdate(g, K, d);
    pg.row(`${dt.month}/${dt.dom}（${K.WEEKDAYS[K.weekdayOf(d)]}）${e.text}`, '', { s: S, c: d < st.day ? C.dim : e.ink || C.text, tag: { t: e.chip, bg: e.color } });
  }
  if (items.length > shown.length) pg.para(`ほか ${items.length - shown.length}件`, { s: S, c: C.dim, x: 12 });
  for (const t of weekly) pg.line({ t, s: S, c: C.dim });
  return pg;
}
function tri(c, x, y, dir, color) {
  c.fillStyle = color;
  for (let i = 0; i < 7; i++) c.fillRect(Math.round(dir > 0 ? x - 6 + i : x + 6 - i), Math.round(y - 6 + i), 1, (6 - i) * 2 + 1);
}

const CHIP = { rent: '#8a5a2a', show: '#c2407a', mine: '#c8281e', final: '#c88a10', close: '#6a6a8a', vote: '#6a4ab8', bday: '#d8508a', nsc: '#1f8a8a', law: '#b3261e' };
function calEnv(g, K, days) {
  const st = g.state;
  const E = { weekly: [] };
  // rent
  const h = K.housing ? K.safe(() => K.housing(), null) : null;
  E.rent = h && K.num(h.rent) > 0 ? K.num(h.rent) : 0;
  if (E.rent) E.weekly.push(`・家賃 ${K.fmtMoney(E.rent)} は毎週月曜の朝に支払い。`);
  // regular shows by weekday
  E.shows = {};
  for (const id of K.safe(() => K.myRegulars(st), []) || []) {
    const r = K.REGULARS[id], s = st.regulars[id];
    if (!r || !s || s.dropped) continue;
    (E.shows[r.weekday] = E.shows[r.weekday] || []).push(r);
    E.weekly.push(`・『${r.title}』は毎週${K.WEEKDAYS[r.weekday | 0]}曜。`);
  }
  if (E.weekly.length > 3) { const n = E.weekly.length; E.weekly = [...E.weekly.slice(0, 2), `・ほか レギュラー番組 ${n - 2}本`]; }
  // elections (投票日 and the player's 公示)
  E.votes = new Map();
  if (has(g, 'upcomingElections')) {
    const pol = has(g, 'pol') ? K.safe(() => g.pol(), null) : null;
    const myParty = pol && pol.me && pol.me.party;
    for (const e of K.safe(() => g.upcomingElections(), []) || []) {
      if (!e || (e.kind === 'sosaisen' && e.party !== myParty)) continue;
      add(E.votes, K.num(e.day), { chip: '投票', color: CHIP.vote, text: `${e.label || '選挙'} 投票日${e.declared ? '（立候補中）' : ''}`, pri: e.declared ? 95 : 50 });
      if (e.declared && K.num(e.koji)) add(E.votes, K.num(e.koji), { chip: '公示', color: CHIP.vote, text: `${e.label || '選挙'} 公示・告示`, pri: 80 });
    }
  }
  // birthday (the player's)
  E.bday = new Set();
  const db = K.daysToBirthday ? K.safe(() => K.daysToBirthday(st), null) : null;
  if (db != null && st.profile) {
    const b = st.day + (db === 0 ? 0 : db);
    for (let k = -1; k <= 2; k++) E.bday.add(b + k * K.YEAR_DAYS);
  }
  // NSC
  const n = has(g, 'nsc') ? K.safe(() => g.nsc(), null) : null;
  E.nsc = !!(n && n.status === 'enrolled' && has(g, 'nscClassToday'));
  // justice: court dates and loan due days
  E.law = new Map();
  if (has(g, 'justiceStatus') && st.justice) {
    const js = K.safe(() => g.justiceStatus(), null);
    if (js) {
      for (const c of js.cases || []) if (c && K.num(c.next)) add(E.law, K.num(c.next), { chip: '手続き', color: CHIP.law, text: '事件の手続き（呼び出し・公判）', pri: 90 });
      for (const l of js.loans || []) if (l && K.num(l.due) && l.status !== 'frozen') add(E.law, K.num(l.due), { chip: '返済', color: CHIP.law, text: `${l.company || '借入れ'}の返済日`, pri: 85 });
    }
  }
  // contest days: one calendar read per day of the month
  E.contest = new Map();
  if (has(g, 'contestCalendar')) {
    for (const d of days) {
      for (const e of K.safe(() => g.contestCalendar(d), []) || []) {
        if (!e) continue;
        const def = e.def || {};
        const nm = def.short || def.name || e.id;
        const big = def.category === 'major' || K.num(def.prestige) >= 70;
        const round = String(e.name || '').replace(/（.*$/, '');
        if (e.mine && (e.type === 'round' || e.type === 'final')) add(E.contest, d, { id: e.id, chip: round.slice(0, 4) || '本番', color: CHIP.mine, text: `「${nm}」${round}（エントリー中）`, pri: 100, ink: K.COLORS.bad });
        else if (e.type === 'final' && big) add(E.contest, d, { chip: '決勝', color: CHIP.final, text: `「${nm}」決勝`, pri: 40 });
        else if (e.type === 'entryClose' && big) add(E.contest, d, { chip: '締切', color: CHIP.close, text: `「${nm}」エントリー締切`, pri: 30 });
        else if (e.type === 'entryOpen' && def.category === 'major') add(E.contest, d, { chip: '受付', color: CHIP.close, text: `「${nm}」エントリー受付開始`, pri: 20 });
      }
    }
  }
  // the player's next rounds from g.contests() (self-run contests keep their own calendars)
  const inMonth = new Set(days);
  for (const c of contestsOf(g, K)) {
    const nr = c.entry && ACTIVE.has(c.entry.status) ? c.nextRound : null;
    const d = nr ? K.num(nr.day) : 0;
    if (!d || !inMonth.has(d) || (E.contest.get(d) || []).some((x) => x.id === c.id && x.pri === 100)) continue;
    const round = String(nr.name || '').replace(/（.*$/, '');
    add(E.contest, d, { id: c.id, chip: round.slice(0, 4) || '本番', color: CHIP.mine, text: `「${cname(c)}」${round}${nr.venue ? `（${nr.venue}）` : ''}`, pri: 100, ink: K.COLORS.bad });
  }
  return E;
}
function add(map, k, v) { if (!map.has(k)) map.set(k, []); map.get(k).push(v); }
function dayEvents(g, K, d, E) {
  const out = [];
  if (d < 1) return out;
  out.push(...(E.contest.get(d) || []), ...(E.law.get(d) || []), ...(E.votes.get(d) || []));
  if (E.bday.has(d)) out.push({ chip: '誕生日', color: CHIP.bday, text: 'あなたの誕生日', pri: 70 });
  const wd = K.weekdayOf(d);
  for (const r of E.shows[wd] || []) out.push({ chip: '番組', color: CHIP.show, text: `『${r.title}』`, pri: 10, list: false });
  if (E.nsc) {
    const cl = K.safe(() => g.nscClassToday(d), null);
    if (cl) out.push({ chip: 'NSC', color: CHIP.nsc, text: `NSC ${cl.label || '授業'}`, pri: 5, list: false });
  }
  if (E.rent && wd === 0) out.push({ chip: '家賃', color: CHIP.rent, text: '家賃の支払い', pri: 8, list: false });
  return out.sort((a, b) => b.pri - a.pri);
}
