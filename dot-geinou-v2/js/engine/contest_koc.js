// キングオブコント 完全再現 (owner: E2). TBS主催のコント日本一決定戦（2008年創設）.
// Files: koc_data.js (verified facts by era + sources, this world's fictional people, news lines), koc_core.js (state st.koc,
// calendar, this world's field & history, scoring models), koc_flow.js (entry, 予選, 準決勝, 敗者復活戦, 決勝, after-events,
// documentary), koc_art.js (HD sets & screens). This file: registerContest('koc', def), g.koc(), the morning hook (the season
// runs every year with or without the player: news, results, this world's champions), the regular shows offered to the
// finalists / the champion, and the phone app 「KOC」 (手帳 / ケータイ / スマホ). API doc: test-output/api_koc.txt.

import { Game } from './game.js';
import { registerContest } from './contests.js';
import { onMorning, registerRegular, registerPhoneApp, REGULARS } from './life.js';
import { phoneList, phoneInfo, closePhoneThen, phoneOverMapOnly, appTile } from './phone.js';
import { MINIGAMES } from './minigame.js';
import { K, yearRec, kDate, absOf, ensureHistory, compact, histFromSeason, historyList, rivalsOf, season, news, notice, entryOf, judgesFor, roundName, safe, num } from './koc_core.js';
import { rules, schedule, titleOf, KOC_NAME, FOUNDED, NEWS, SOURCES, ENTRY_RECORD, lenText, hallText, PRIZE, FEE, STAFF, kocRounds, entriesOf } from './koc_data.js';
import { kocEntry, goToday, goFromApp, dueToday, phaseOf, datesOf, planOf, runFinalDay, runDvd, runKai, playDoc, roundsOf, feeText, manYen } from './koc_flow.js';
import * as L from './koc_link.js';
import { PEOPLE } from './life.js';
import { crown } from './koc_art.js';
import { dateText, mdText } from './koc_core.js';

const has = (g, k) => !!g && typeof g[k] === 'function';

// ================================================================ registration (D1's framework, def.selfRun)
// KOC runs its own world (koc_core.js): D1 never simulates it, posts none of its generic news and keeps no KOC entry. D1's
// 賞レース screen / app read KOC through the hooks below; 「今日の予定」 there opens def.flow (KOC's own trip, desk and round).
const PHASE_D1 = { notyet: 'notyet', before: 'before', entry: 'entry', qualifying: 'prelim', final: 'finalday', done: 'after' };
const STATUS_D1 = { entered: 'entered', finalist: 'finalist', revival: 'passed', voter: 'out', champion: 'champion', out: 'out', withdrawn: 'withdrawn' };
const STATUS_TEXT = (E) => ({ entered: `${roundName(E.round)}へ`, finalist: '決勝進出', revival: '敗者復活戦へ', voter: '決勝の審査員', champion: '優勝', out: `${roundName(E.out || E.round)}敗退${E.place ? `（決勝${E.place}位）` : ''}`, withdrawn: '棄権' }[E.status] || '');
function d1Status(g) {
  const t = kDate(g);
  const y = t.year;
  if (y < FOUNDED) return { status: 'notyet', statusLabel: `まだ始まっていない（${FOUNDED}年創設）`, label: `${KOC_NAME}（${FOUNDED}年創設）`, edition: null, year: y, entry: null, today: [] };
  safe(() => ensureHistory(g, y));
  const R = rules(y);
  const S = schedule(y);
  const ph = phaseOf(g, y);
  const E = entryOf(g, y);
  const h = K(g).hist[y];
  const statusLabel = {
    before: `エントリー受付は${dateText(y, S.entry.from)}から`, entry: `エントリー受付中（締切 ${dateText(y, S.entry.to)}）`,
    qualifying: `予選中（決勝は${dateText(y, S.final.when)}）`, final: '今夜、決勝の生放送', done: h && h.champ ? `決勝終了（王者：${h.champ}）` : '決勝終了',
  }[ph] || '';
  let entry = null;
  if (E) {
    const live = ['entered', 'finalist', 'revival', 'voter'].includes(E.status);
    const rid = E.status === 'entered' ? E.round : E.status === 'revival' ? 'revival' : 'final';
    const ds = live ? datesOf(g, y, E, rid) : [];
    const w = rid === 'sf' && R.twoNetaSF ? ds[num(E.sfDone)] : ds[0];
    const v = live ? (rid === 'final' || rid === 'revival' ? { city: '東京', hall: 'TBS 赤坂' } : planOf(g, y, E, rid) || {}) : null; // hallText: 「東京会場」 / the hall's name
    entry = {
      no: E.no, name: E.unitName, status: STATUS_D1[E.status] || 'entered', statusLabel: STATUS_TEXT(E), round: live ? roundName(rid) : roundName(E.out || E.round),
      next: live && w ? { day: L.d1Day(g, t.abs, absOf(y, w)), city: hallText(v), hall: v.hall || '' } : null,
      results: (E.results || []).map((r) => ({ round: roundName(r.round), name: roundName(r.round), passed: !!r.passed, score: r.score, place: r.place, of: r.of })),
      final: E.status === 'champion' ? { place: 1, total: h && h.champScore } : E.place ? { place: E.place } : null,
    };
  }
  const due = dueToday(g);
  const today = due ? [{ id: due.rid, kind: 'round', label: `${roundName(due.rid)}（${due.rid === 'final' || due.rid === 'revival' ? 'TBS 赤坂' : hallText(planOf(g, y, E, due.rid) || {})}）` }] : [];
  return { status: PHASE_D1[ph] || 'before', statusLabel, label: `${titleOf(y)}（第${R.edition}回）`, edition: R.edition, year: y, entry, today };
}
// D1's schedule format of a year: { entry: { from, to }, final: [month, dom] }
const scheduleD1 = (y) => { const S = schedule(Math.max(FOUNDED, y)); return { entry: S.entry, final: S.final.when }; };
const DEF = {
  name: KOC_NAME, short: 'KOC', kind: 'conte', category: 'major', labelStyle: 'both', color: '#b8902a',
  organizer: 'TBSテレビ', broadcaster: 'TBS系', venue: 'TBS放送センター（赤坂）', region: 'all',
  history: { founded: FOUNDED, ended: null, gaps: [], revived: null, note: 'TBSテレビが主催・運営するコント日本一決定戦。プロ・アマ・芸歴を問わず2人以上のユニットが出場できる。', sources: SOURCES },
  revive: false, selfRun: true,
  editionOf: (y) => (y >= FOUNDED ? y - FOUNDED + 1 : null),
  eligibility: (g, unit, year) => {
    if ((year ?? kDate(g).year) < FOUNDED) return { ok: false, why: `まだ始まっていない（${FOUNDED}年創設）` };
    const n = unit && Array.isArray(unit.members) ? unit.members.length : unit && unit.type === 'pin' ? 1 : 2;
    if (n < 2) {
      // a pin may still enter as an 即席ユニット with a friend (the entry flow asks)
      const friends = typeof g.friends === 'function' ? safe(() => g.friends(1), []).filter((id) => PEOPLE[id] && PEOPLE[id].kind !== 'family') : [];
      return friends.length ? { ok: true, why: '' } : { ok: false, why: '2人以上のユニットに限る（ピン不可。即席ユニットを組める仲間がいれば出られる）' };
    }
    return { ok: true, why: '' };
  },
  eligibilityNote: 'プロ・アマ・所属・芸歴・年齢不問、2人以上のユニット（ピン不可・即席ユニット可）',
  // REAL nominal yen (D1 converts): コンビ2,000円・トリオ以上3,000円 (every year since 2008)
  fee: (g, unit) => ((unit && Array.isArray(unit.members) && unit.members.length >= 3) || (unit && unit.type === 'trio') ? FEE.trio : FEE.combi),
  feeText: () => feeText(),
  entryCount: (y) => (y >= FOUNDED ? entriesOf(y).n : null),
  prize: PRIZE, prizeText: '優勝賞金1000万円',
  perform: { kind: 'conte', length: 300 },
  news: [],
  // the year's format (準々決勝 from 2009, the two-day semifinal from 2018, the revival from 2026): D1 asks with the cycle's year
  schedule: scheduleD1(2026), rounds: kocRounds(2026),
  roundsOf: (y) => kocRounds(Math.max(FOUNDED, y)), scheduleOf: scheduleD1,
  catchcopy: (g, ctx) => { const E = entryOf(g, ctx && ctx.year); return (E && E.copy) || ''; },
  entry: async (g) => kocEntry(g),
  flow: async (g, ctx) => goToday(g, { mode: ctx && ctx.mode, revival: !!(ctx && ctx.revival) }),
  status: (g) => safe(() => d1Status(g), null),
  historyList: (g) => safe(() => { const y = kDate(g).year; if (y >= FOUNDED) ensureHistory(g, y); return historyList(g); }, []),
  rivalsOf: (g, round, n, year) => safe(() => rivalsOf(g, round, n, year), []),
  // E2 extras (the year-specific facts)
  rulesOf: rules, myScheduleOf: schedule,
  entryOf: (g, y) => entryOf(g, y ?? kDate(g).year),
  judgesOf: (g, y) => judgesFor(g, y ?? kDate(g).year).map((j) => ({ name: j.name, title: j.title, taste: j.taste })),
};
registerContest('koc', DEF);

// ================================================================ regular shows (fictional TBS programs) for the finalists / the king
registerRegular('koc_reg_conte', {
  title: 'ドットコント劇場', place: 'tbs', weekday: 3, medium: 'tv', requires: { flag: 'koc_king' },
  pay: 42000, fame: 110, fans: 3000, stamina: 22, skill: 'warai', minigame: 'tsukkomi', opts: { difficulty: 4 },
  host: STAFF.producer.name, hostLook: STAFF.producer.look, desc: 'キングオブコント王者が毎週新作コントを撮る、TBSのコント番組。',
});
registerRegular('koc_reg_variety', {
  title: '王様のひな壇', place: 'tbs', weekday: 5, medium: 'tv', requires: { flag: 'koc_king' },
  pay: 30000, fame: 80, fans: 2200, stamina: 20, skill: 'talk', minigame: 'talk',
  host: STAFF.producer.name, hostLook: STAFF.producer.look, desc: '旬の芸人がひな壇に並ぶTBSのバラエティ。',
});
registerRegular('koc_reg_radio', {
  title: '深夜のコント研究所', place: 'tbs', weekday: 1, medium: 'radio', requires: { flag: 'koc_finalist' },
  pay: 14000, fame: 40, fans: 800, stamina: 12, skill: 'talk', minigame: 'talk',
  host: 'TBSラジオのディレクター', hostLook: STAFF.writer.look, desc: 'KOCファイナリストがコントの作り方を語る深夜ラジオ。',
});
const OFFER_TEXT = {
  koc_reg_conte: 'TBSのプロデューサーです。キングオブコント優勝、おめでとうございます！\n毎週、新作コントを撮るレギュラー番組『ドットコント劇場』を、ぜひお願いしたいんです。',
  koc_reg_variety: 'TBSのプロデューサーです。新キングのお二人に、バラエティ『王様のひな壇』のレギュラーをお願いできませんか？',
  koc_reg_radio: 'TBSラジオです。KOCの決勝、拝見しました！\n深夜のラジオ『深夜のコント研究所』で、コントの話をしていただけませんか？',
};

// ================================================================ g.koc() — state summary
const methods = {
  koc() {
    const k = K(this);
    L.migrate(this, k);
    const t = kDate(this);
    const y = t.year;
    const notyet = y < FOUNDED;
    if (!notyet) safe(() => ensureHistory(this, y));
    const R = notyet ? null : rules(y);
    const E = entryOf(this, y);
    const due = notyet ? null : dueToday(this);
    return {
      id: 'koc', name: KOC_NAME, year: y, founded: FOUNDED, notyet, label: notyet ? `まだ始まっていない（${FOUNDED}年創設）` : `${titleOf(y)}（第${R.edition}回）`,
      edition: notyet ? null : R.edition, phase: notyet ? 'notyet' : phaseOf(this, y),
      rules: R ? { mode: R.mode, judgeText: R.judgeText, finalText: R.finalText, finalists: R.finalists, finalStage: R.finalStage, judges: R.judges || R.voters, max: R.max, len: R.len, revival: !!R.revival, secret: R.secret, fee: R.fee, prize: R.prize, entries: R.entries } : null,
      schedule: notyet ? null : schedule(y),
      entry: E, due,
      history: historyList(this),
      stats: { ...k.stats },
      news: k.newsLog.slice(0, 10),
      events: k.events.filter((e) => !e.done || e.kind === 'doc').map((e) => ({ id: e.id, kind: e.kind, day: e.day, y: e.y, done: e.done })),
      king: !!(this.state.flags && this.state.flags.koc_king),
    };
  },
  // tests / other modules: run today's KOC business as a script (entry if open, today's round, the final)
  async kocGo() { return goToday(this); },
  async kocEnter() { return kocEntry(this); },
};
for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(Game.prototype, k, Object.getOwnPropertyDescriptor(methods, k));

// ================================================================ the morning: the season goes on every year
function inboxToday(g, re) { return (g.state.phone.inbox || []).some((m) => m && m.day === g.state.day && re.test(String(m.text || ''))); }
function kocMorning(g) {
  const t = kDate(g);
  const y = t.year;
  const k = K(g);
  L.migrate(g, k);
  if (y < FOUNDED) return;
  ensureHistory(g, y);
  safe(() => compact(g, y));
  // a past season that ended while nothing looked (a long skip): close it in the history
  for (const yy of [y - 1]) if (yy >= FOUNDED && (!k.hist[yy] || !k.hist[yy].champ)) k.hist[yy] = histFromSeason(g, yy, null, null);
  const Y = yearRec(g, y);
  const R = rules(y);
  const S = schedule(y);
  const at = (w) => t.abs >= absOf(y, w);
  const day = g.state.day;
  const once = (key, fn) => { if (!Y.news[key]) { Y.news[key] = day; safe(fn); } };
  const kn = (key) => ({ morning: true, key: `kocn|${y}|${key}` }); // D1's queue sends a key once per save (a second guard)
  const last = (list) => list.reduce((a, v) => (absOf(y, v.when) > absOf(y, a.when) ? v : a), list[0]);
  const d = { y, ed: R.edition, n: R.entries.n, approx: R.entries.approx, record: ENTRY_RECORD(y), len: lenText(R.len.r1), city: S.r1[0].city, sfCount: R.sfCount, finalists: R.finalists, judgeText: R.judgeText, oowarai: R.oowarai, hanseikai: R.hanseikai, firstRevival: !!R.revival && !rules(y - 1).revival };
  const E = Y.entry;
  const unitOk = () => { const u = has(g, 'unit') ? safe(() => g.unit(), null) : null; return !!(u && Array.isArray(u.members) && u.members.length >= 2); };
  // KOC is selfRun: D1 posts none of its generic news for it — every milestone of the season is told here (D1's queue keeps
  // the morning to ≤ 3 lines + one digest)
  if (y === FOUNDED) once('first', () => news(g, NEWS.first[0](d), kn('first')));
  if (at(S.entry.from)) once('open', () => news(g, NEWS.open[y % NEWS.open.length](d), kn('open')));
  if (t.abs >= absOf(y, S.entry.to) - 3 && t.abs <= absOf(y, S.entry.to)) once('closing', () => { if (!E && unitOk()) notice(g, `『${titleOf(y)}』のエントリー締切は${dateText(y, S.entry.to)}です。\n（KOCアプリ／賞レースの画面からエントリーできます）`, undefined, 80, `kocn|${y}|closing`); });
  if (t.abs > absOf(y, S.entry.to)) once('closed', () => news(g, (d.record && d.n > d.record ? NEWS.closed[1] : NEWS.closed[0])(d), kn('closed')));
  if (at(S.r1[0].when)) once('r1start', () => news(g, NEWS.r1start[y % 2](d), kn('r1start')));
  if (t.abs > absOf(y, last(S.r1).when)) once('r2', () => news(g, NEWS.r2[y % 2](d), kn('r2')));
  if (R.hasQF && t.abs > absOf(y, last(S.r2).when)) once('qf', () => news(g, NEWS.qf[y % 2]({ ...d, len: lenText(R.len.qf) }), kn('qf')));
  const sfFrom = R.hasQF ? S.qf : S.r2;
  if (t.abs > absOf(y, last(sfFrom).when)) once('sf', () => news(g, NEWS.sf[y % 2](d), kn('sf')));
  if (t.abs > absOf(y, last(S.sf).when)) {
    once('finalists', () => {
      if (R.secret) { news(g, NEWS.secret[0](d), kn('finalists')); return; } // 2018-2019: the names wait for the broadcast
      const Sx = season(g, y);
      const newcomers = Sx.finalists.filter((a) => !Object.values(k.hist).some((h) => h && h.y < y && (h.finalists || []).some((f) => f[0] === a.name))).length;
      news(g, NEWS.finalists[0]({ ...d, newcomers }), kn('finalists'));
    });
    if (R.revival) once('revival', () => news(g, NEWS.revival[0](d), kn('revival')));
  }
  if (t.abs >= absOf(y, S.final.when) - 3 && t.abs < absOf(y, S.final.when) && R.mode === 'panel') once('judges', () => news(g, NEWS.judges[0]({ ...d, judges: judgesFor(g, y).map((j) => j.name).join('、') }), kn('judges')));
  if (t.abs === absOf(y, S.final.when)) once('final', () => news(g, `${NEWS.final[0](d)}${E && ['finalist', 'revival', 'voter'].includes(E.status) ? '' : '\n（KOCアプリの「決勝を見る」から見られる）'}`, kn('final')));
  if (t.abs > absOf(y, S.final.when)) {
    if (!k.hist[y] || !k.hist[y].champ) k.hist[y] = histFromSeason(g, y, null, null);
    if (k.hist[y] && E && !k.hist[y].me) k.hist[y].me = { unitId: E.unitId, unit: E.unitName, reached: E.out || E.round, place: E.place || null, text: '' };
    once('champ', () => { const h = k.hist[y]; if (h) news(g, NEWS.champion[0]({ ...d, champ: h.champ, score: h.champScore }), { morning: true, key: `champ|koc|${y}` }); });
    if (t.abs > absOf(y, S.final.when) + 1) once('after', () => { const h = k.hist[y]; if (h && h.champ) news(g, NEWS.after[y % NEWS.after.length]({ ...d, champ: h.champ }), kn('after')); });
    if (R.kai && y >= 2021 && t.abs > absOf(y, S.final.when) + 20) once('kai', () => news(g, NEWS.kai[0]({ ...d, champ: k.hist[y] && k.hist[y].champ }), kn('kai')));
  }
  // ---- the player: missed rounds, reminders (KOC's own: D1 keeps no KOC entry)
  if (E && ['entered', 'finalist', 'revival', 'voter'].includes(E.status)) {
    const rid = E.status === 'entered' ? E.round : E.status === 'revival' ? 'revival' : 'final';
    const ds = datesOf(g, y, E, rid);
    const need = rid === 'sf' && R.twoNetaSF ? ds[num(E.sfDone)] : ds[0];
    if (need && t.abs > absOf(y, need)) {
      if (E.status === 'voter') E.status = 'out';
      else { E.status = 'withdrawn'; E.out = rid; notice(g, `『${titleOf(y)}』${roundName(rid)}に来場されなかったため、棄権となりました。`); }
    } else if (need && t.abs === absOf(y, need)) {
      if (!inboxToday(g, /キングオブコント|KOC/)) notice(g, `本日は『${titleOf(y)}』${roundName(rid)}です。\n${rid === 'final' || rid === 'revival' ? 'TBS 赤坂' : hallText(planOf(g, y, E, rid) || {})}。KOCアプリ（または賞レースの画面）から会場へ。`);
    } else if (need && t.abs === absOf(y, need) - 1) notice(g, `明日は『${titleOf(y)}』${roundName(rid)}。体調を整えておこう。`);
  }
  // ---- after-events (one message a morning)
  for (const ev of k.events) {
    if (ev.done || ev.sent || ev.day > day) continue;
    ev.sent = day;
    if (ev.kind === 'offer') {
      const r = REGULARS[ev.data.reg];
      ev.done = true;
      if (!r || (g.state.regulars[ev.data.reg] && !g.state.regulars[ev.data.reg].dropped)) continue;
      if (ev.data.reg === 'koc_reg_conte' && MINIGAMES.conte) r.minigame = 'conte';
      g.message({ from: r.host, look: r.hostLook, kind: 'offer', regular: ev.data.reg, text: g.fmt(OFFER_TEXT[ev.data.reg] || r.desc) });
    } else if (ev.kind === 'dvd') notice(g, 'ベストネタDVDを出しませんか、というお話が来ています。\n（KOCアプリの「お仕事・イベント」から）', STAFF.manager.name);
    else if (ev.kind === 'doc') { const Rr = rules(ev.y); notice(g, Rr.doc ? `『${Rr.doc}』（U-NEXT）の配信が始まりました。決勝の一日に密着したドキュメンタリーです。\n（KOCアプリの「ドキュメント」から見られる）` : 'KOC決勝の密着ドキュメント『その日、王を目指して』が放送された。\n（KOCアプリの「ドキュメント」から見られる）', Rr.doc ? 'U-NEXT' : 'TBS'); }
    else if (ev.kind === 'kai') notice(g, '『キングオブコントの会』（TBS特番）への出演依頼です。歴代王者・準優勝組で、新作コントを披露していただきます。\n（KOCアプリの「お仕事・イベント」から）', STAFF.producer.name);
    break;
  }
  // events not taken in time expire
  for (const ev of k.events) if (!ev.done && (ev.kind === 'dvd' || ev.kind === 'kai') && ev.sent && day - ev.sent > 20) ev.done = 'expired';
  // held news (more than 3 this morning): one digest line
  if (k.morning.day === day && k.morning.held > 0) { const n = k.morning.held; k.morning.held = 0; if (has(g, 'contestNews')) safe(() => g.contestNews(`ほかにもキングオブコントのニュースが${n}件（KOCアプリの「ニュース」で）`, { contest: 'koc', cat: 'digest' })); }
}
onMorning((g) => kocMorning(g));
export { kocMorning };

// ================================================================ phone app 「KOC」
const APP_COLOR = '#1a1a22';
async function kocApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const t = kDate(g);
    const y = t.year;
    if (y < FOUNDED) { await phoneInfo(g, { title: 'KOC', color: APP_COLOR, lines: [`『${KOC_NAME}』は、まだ始まっていない（${FOUNDED}年創設）。`] }); return; }
    const info = g.koc();
    const R = rules(y);
    const S = schedule(y);
    const E = info.entry;
    const items = [];
    const due = info.due;
    if (due) items.push({ id: 'go', label: `今日：${roundName(due.rid)}へ行く`, sub: due.rid === 'final' || due.rid === 'revival' ? 'TBS 赤坂（決勝の日）' : hallText(planOf(g, y, E, due.rid) || {}) });
    if (!E && info.phase === 'entry') items.push({ id: 'entry', label: 'エントリーする', sub: `締切 ${dateText(y, S.entry.to)}・${feeText()}` });
    const Yy = K(g).years[y];
    if (info.phase === 'final' && !due && !(Yy && Yy.final && Yy.final.done)) items.push({ id: 'watch', label: '決勝を見る（生放送）', sub: `${titleOf(y)} 決勝` });
    items.push({ id: 'me', label: 'わたしのKOC', sub: E ? `No.${E.no} ${E.unitName}` : 'エントリーしていない' });
    items.push({ id: 'rules', label: `大会のしくみ（${y}年）`, sub: `第${R.edition}回・${R.mode === 'panel' ? `審査員${R.judges}人` : `準決勝敗退者${R.voters}人が審査`}` });
    items.push({ id: 'sched', label: '予選の日程と会場', sub: `1回戦 ${dateText(y, S.r1[0].when)}〜` });
    items.push({ id: 'hist', label: '歴代王者', sub: `${info.history.length}大会` });
    items.push({ id: 'news', label: 'KOCニュース', sub: info.news[0] ? info.news[0].text : 'まだない' });
    const docs = Object.values(K(g).years).filter((Y) => Y && Y.entry).map((Y) => Y.y);
    if (docs.length) items.push({ id: 'doc', label: 'ドキュメント（挑戦の記録）', sub: `${docs.join('・')}年` });
    const evs = K(g).events.filter((e) => !e.done && e.sent && (e.kind === 'dvd' || e.kind === 'kai'));
    if (evs.length) items.push({ id: 'ev', label: 'お仕事・イベント', sub: evs.map((e) => (e.kind === 'dvd' ? 'ベストネタDVD' : 'キングオブコントの会')).join('・'), right: `${evs.length}` });
    const i = await phoneList(g, { title: 'KOC', color: APP_COLOR, items: items.map((x) => ({ label: x.label, sub: x.sub, right: x.right })) });
    if (i < 0) return;
    const id = items[i].id;
    const leave = async (fn) => {
      if (!phoneOverMapOnly(g)) { await phoneInfo(g, { title: 'KOC', color: APP_COLOR, lines: ['（いまは行けない。会話や移動が終わってからにしよう）'] }); return false; }
      closePhoneThen(g, fn);
      return true;
    };
    if (id === 'go') { if (await leave((gg) => goFromApp(gg))) return; }
    else if (id === 'entry') { if (await leave((gg) => kocEntry(gg))) return; }
    else if (id === 'watch') { if (await leave((gg) => runFinalDay(gg, y))) return; }
    else if (id === 'me') await phoneInfo(g, { title: 'わたしのKOC', color: APP_COLOR, lines: myLines(g, y, E) });
    else if (id === 'rules') await phoneInfo(g, { title: `${titleOf(y)}のしくみ`, color: APP_COLOR, lines: ruleLines(g, y) });
    else if (id === 'sched') await phoneInfo(g, { title: '日程と会場', color: APP_COLOR, lines: schedLines(g, y) });
    else if (id === 'hist') {
      const h = info.history.slice().reverse();
      const j = await phoneList(g, { title: '歴代王者', color: APP_COLOR, items: h.map((x) => ({ label: `${x.year}年 第${x.edition}回`, sub: `王者：${x.champion}${x.note ? `（${x.note}）` : ''}`, right: x.score != null ? `${x.score}` : '' })), empty: 'まだない' });
      if (j >= 0) { const hh = K(g).hist[h[j].year]; await phoneInfo(g, { title: `${titleOf(h[j].year)} 決勝`, color: APP_COLOR, lines: [`エントリー ${hh.approx ? '約' : ''}${num(hh.entries).toLocaleString('ja-JP')}組`, ...(hh.finalists && hh.finalists.length ? hh.finalists : [[hh.champ, '', hh.champScore, 1], ...(hh.runner ? [[hh.runner, '', 0, 2]] : [])]).map((f) => `${f[3]}位 ${f[0]}${f[2] ? `（${f[2]}）` : ''}`)] }); }
    } else if (id === 'news') await phoneInfo(g, { title: 'KOCニュース', color: APP_COLOR, lines: info.news.length ? K(g).newsLog.slice(0, 20).map((n) => `・${n.text}`) : ['まだニュースはない。'] });
    else if (id === 'doc') {
      const j = docs.length === 1 ? 0 : await phoneList(g, { title: 'ドキュメント', color: APP_COLOR, items: docs.map((yy) => ({ label: `${yy}年の記録`, sub: entryOf(g, yy) ? entryOf(g, yy).unitName : '' })) });
      if (j >= 0) {
        const yy = docs[j];
        const Ey = entryOf(g, yy);
        const kind = Ey && (Ey.place || Ey.status === 'champion') ? 'doc' : 'run';
        if (await leave((gg) => playDoc(gg, yy, kind))) return;
      }
    } else if (id === 'ev') {
      const j = await phoneList(g, { title: 'お仕事・イベント', color: APP_COLOR, items: evs.map((e) => ({ label: e.kind === 'dvd' ? 'ベストネタDVDの収録' : 'キングオブコントの会（TBS特番）', sub: `${e.y}年のKOCから` })) });
      if (j >= 0) { const ev = evs[j]; if (await leave((gg) => (ev.kind === 'dvd' ? runDvd(gg, ev) : runKai(gg, ev)))) return; }
    }
  }
}
function myLines(g, y, E) {
  const k = K(g);
  const out = [];
  if (!E) out.push(`${titleOf(y)}にはエントリーしていない。`);
  else {
    out.push(`No.${E.no}「${E.unitName}」（${E.members.map((m) => m.name).join('・')}）${E.instant ? '　即席ユニット' : ''}`);
    out.push(`状態：${{ entered: `${roundName(E.round)}へ`, finalist: '決勝進出！', revival: '敗者復活戦へ', voter: '決勝の審査員', champion: '優勝！', out: `${roundName(E.out || E.round)}敗退`, withdrawn: '棄権' }[E.status] || E.status}`);
    if (E.status === 'entered') out.push(`次：${datesOf(g, y, E, E.round).map((w) => dateText(y, w)).join('・')} ${hallText(planOf(g, y, E, E.round) || {})}`);
    out.push(`エントリー料：${E.feePaid ? '支払いずみ' : `当日払い（${E.fee.toLocaleString('ja-JP')}円）`.replace(/(\d[\d,]*)円/, '⁠$1円')}`);
    for (const r of E.results || []) out.push(`・${roundName(r.round)}：${r.passed ? '通過' : r.round === 'final' ? `${r.place}位` : '敗退'}（${r.place}位／${r.of}組）`);
    if (E.reasons && E.reasons.length) { out.push('', '寸評：'); for (const s of E.reasons) out.push(`・${s}`); }
  }
  out.push('', `これまで：エントリー${k.stats.entered}回・準決勝${k.stats.semis}回・決勝${k.stats.finals}回・優勝${k.stats.wins}回`);
  return out;
}
function ruleLines(g, y) {
  const R = rules(y);
  const L = R.len;
  return [
    `主催：TBSテレビ　第${R.edition}回`,
    '出場資格：プロ・アマ、所属、芸歴、年齢を問わず、2人以上のユニット（ピン不可・即席ユニット可・併願不可）',
    `エントリー料：${feeText()}（予選当日に会場で）`,
    `優勝賞金：${manYen(PRIZE)}`,
    `ネタ時間：1回戦${lenText(L.r1)}・2回戦${lenText(L.r2)}${R.hasQF ? `・準々決勝${lenText(L.qf)}` : ''}・準決勝${lenText(L.sf)}・決勝${lenText(L.final)}`,
    R.twoNetaSF ? '準決勝は2日間で2本。決勝も原則同じ2本のネタ。' : '準決勝は1本。',
    R.seeds ? 'シード：過去の準決勝進出者は2回戦から、決勝進出者は準々決勝から（即席ユニットは1回戦から）。' : '',
    `決勝：${R.finalists}組${R.revival ? '＋敗者復活の1組' : ''}`,
    `審査：${R.judgeText}`,
    R.finalText,
    R.secret ? 'ファイナリストシークレット制度：決勝進出者は当日の生放送で発表。' : '',
    R.revival ? `敗者復活戦：準決勝敗退25組の上位10組 → 芸人審査員${R.revivalJudges}人の採点で3組 → 国民投票で1組。` : '',
    R.oowarai ? '決勝はTBS「お笑いの日」の中で生放送。' : '',
    R.hanseikai ? `決勝のあと『${R.hanseikai}』（U-NEXT独占ライブ配信）。` : '',
    // the total is announced when the entry closes (no future facts)
    kDate(g).year > y || kDate(g).abs > absOf(y, schedule(y).entry.to) ? `エントリー数：${R.entries.approx ? '約' : ''}${R.entries.n.toLocaleString('ja-JP')}組` : '',
  ].filter(Boolean);
}
function schedLines(g, y) {
  const S = schedule(y);
  const R = rules(y);
  const out = [`エントリー：${dateText(y, S.entry.from)}〜${dateText(y, S.entry.to)}`];
  out.push(`1回戦：${S.r1.map((v) => `${v.city}${v.hall ? `（${v.hall}）` : ''} ${mdText(v.when)}`).join('／')}`);
  out.push(`2回戦：${S.r2.map((v) => `${hallText(v)}`).join('／')}　${dateText(y, S.r2[0].when)}`);
  if (R.hasQF) out.push(`準々決勝：${S.qf.map((v) => hallText(v)).join('／')}　${dateText(y, S.qf[0].when)}`);
  out.push(`準決勝：${hallText(S.sf[0])}　${S.sf.map((v) => dateText(y, v.when)).join('・')}${R.twoNetaSF ? '（2日間・2本）' : ''}`);
  out.push(`決勝：${dateText(y, S.final.when)}　TBS系 生放送${R.revival ? '（午後に敗者復活戦）' : ''}`);
  return out;
}
registerPhoneApp('koc', {
  name: 'KOC', color: APP_COLOR, order: 58,
  cond: (g) => kDate(g).year >= FOUNDED || Object.keys(K(g).years).length > 0,
  badge: (g) => (safe(() => (dueToday(g) ? 1 : 0) + K(g).events.filter((e) => !e.done && e.sent && (e.kind === 'dvd' || e.kind === 'kai')).length, 0) || 0),
  iconHD(c, x, y) { appTile(c, x, y, APP_COLOR); crown(c, x + 3, y + 8, 2); c.fillStyle = '#e8c25a'; c.fillRect(x + 6, y + 25, 20, 2); },
  open: (g) => kocApp(g),
});
const roundsDef = (y) => kocRounds(y);
export { kocApp, roundsDef, d1Status };
