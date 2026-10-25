// M-1グランプリ 完全再現 (owner: E1). API doc: test-output/api_m1.txt.
// Files: m1_data.js (facts by year with sources, fictional people, names, catch copies, news bank), m1_field.js (the pool of
// fictional combos, the seeded field of every round, the cut lines, the final's scoring, this world's history),
// m1_core.js (calendar, state, schedule, the player's act, news queue), m1_ui.js (HD sets and screens), m1_flow.js (the
// player's flows). This file: g.m1() and friends, the morning (the contest happens with or without the player: rounds,
// news, the final, history), the def for D1's registry (contests.js), the phone app 「M-1」, items and the shows offered
// to finalists.
//
// D1 (contests.js) simulates and announces every registered contest on its own. M-1 keeps ONE world (its own pool and
// history), so: (1) the def mirrors the year's real rounds and is re-registered when the year changes (D1's cycles then
// match these dates), (2) this module's morning runs BEFORE D1's (MORNING_HOOKS.unshift) and sends its news through
// g.contestNews with D1's own keys (open|count|round|upset|finalists|champ …) so D1's duplicates are skipped, (3) prestige 54
// keeps D1's generic 王者会見 / ネット反応 / ラストイヤー lines (which would name D1's own simulated acts) off, (4)
// history.champions gives D1 this world's champion names. Entries are NOT registered with D1 (its morning would withdraw an
// entry played through this flow); def.status(g) / g.m1() tell D1's screens what the player's M-1 entry is.

import { Game } from './game.js';
import { registerContest } from './contests.js';
import * as CONTESTS_MOD from './contests.js';
import { onMorning, MORNING_HOOKS, registerPhoneApp, registerRegular, REGULARS } from './life.js';
import { registerItem } from './state.js';
import { registerSong } from './audio.js';
import { MINIGAMES } from './minigame.js';
import { eraOf } from './profile.js';
import { m1Rules, m1Held, editionOf, M1, entriesOf, NEWS, setNameFilter } from './m1_data.js';
import { fieldOf, passedOf, prepareFinal, simulateFinal, actOf, comboAct, anonCombo, sd, tagsOf } from './m1_field.js';
import { has, safe, cal, dateLabel, dateLabelY, today, M, season, entryOf, plan, statusOf, unitInfo, news, flushNews, msg, internal, yenNom } from './m1_core.js';
import { entryFlow, roundFlow, finalDayFlow, watchFinal, practiceFlow, zadankaiFlow, anotherStory, returnsFlow, tourStop, dvdRelease } from './m1_flow.js';
import { phoneList, phoneInfo, closePhoneThen, appTile } from './phone.js';
import { dvdCard } from './m1_ui.js';

// generated names must not match real people / acts: D1's check when it exists (feature-detected)
if (typeof CONTESTS_MOD.isRealNameLike === 'function') setNameFilter(CONTESTS_MOD.isRealNameLike);

// ---------------------------------------------------------------- items, music, offered shows
registerItem('m1_badge', { name: 'M-1の番号札', price: 0, desc: 'M-1グランプリの予選でもらうエントリーナンバーの札。\n捨てられない宝物。' });
registerItem('m1_trophy', { name: 'M-1グランプリのトロフィー', price: 0, desc: '漫才日本一の証。優勝賞金1000万円とともに手にした。' });
registerItem('m1_dvd', { name: 'M-1グランプリのDVD', price: 0, desc: '自分たちが出た決勝を完全収録したDVD。\n何度見ても手に汗をにぎる。' });
// an original loop for the final (not the real 出囃子)
registerSong('m1_final', {
  bpm: 132, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'E5 . E5 G5 . E5 D5 . | C5 . D5 E5 . . G4 . | A4 . C5 E5 . D5 C5 . | B4 - - . G4 . B4 . | E5 . E5 G5 . A5 G5 . | E5 . D5 C5 . . E5 . | F5 . E5 D5 . C5 B4 . | C5 - - . . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | C3 C3 C4 C3 C3 C3 C4 C3 | G2 G2 G3 G2 G2 G2 B2 D3' },
    { wave: 'drum', vol: 0.11, notes: 'k . h k s . h . | k k h . s . h h' },
  ],
});
const MG = () => (MINIGAMES.manzai ? 'manzai' : 'tsukkomi');
registerRegular('m1_netaban', { title: '漫才ゴールデン（ネタ番組）', place: 'tvasahi', weekday: 2, medium: 'tv', pay: 60000, fame: 70, fans: 900, get minigame() { return MG(); }, skill: 'warai', stamina: 20, host: 'ネタ番組のプロデューサー', desc: 'M-1のファイナリストが新ネタを披露するネタ番組。' });
registerRegular('m1_hinadan', { title: 'ひな壇バラエティ『ドット芸人ナイト』', place: 'ntv', weekday: 4, medium: 'tv', pay: 80000, fame: 80, fans: 1200, minigame: 'talk', skill: 'talk', stamina: 20, host: 'バラエティのプロデューサー', desc: '話題の芸人がひな壇にずらり。M-1の裏話も。' });
registerRegular('m1_radio', { title: '深夜ラジオ『真夜中の漫才師』', place: 'tbs', weekday: 5, medium: 'radio', pay: 40000, fame: 40, fans: 1500, minigame: 'talk', skill: 'talk', stamina: 12, host: 'ラジオのディレクター', desc: '王者・ファイナリストの冠ラジオ。ふたりのフリートーク。' });

// ---------------------------------------------------------------- D1 registration (per year)
let G = null; // the running game (for the def's getters)
let regYear = null;
function defFor(year) {
  const y = m1Held(year) ? year : year < 2001 ? 2001 : year <= 2014 ? 2015 : year;
  const r = m1Rules(y);
  const dom = (o) => [o.m, o.k + 1];
  const rounds = r.rounds.map((x) => ({
    id: x.id, name: x.name, when: x.opts.map(dom), venues: x.opts.map((o) => o.city), length: x.length, pass: x.pass, field: x.id === 'r1' ? r.entries : undefined,
    judge: 'staff', scoring: '予選審査員による審査', crowd: x.id === 'r1' ? 'cold' : 'normal', size: x.id === 'sf' ? 'hall' : 'theater', announce: 'now',
  }));
  rounds.push({ id: 'final', name: '決勝', when: [[r.finalAt[0], r.finalAt[1] + 1]], venues: ['東京'], length: 240, pass: 1, judge: 'panel', judges: r.judges, scoring: r.judgeScoring, revival: !!r.revival, revivalName: '敗者復活戦', tv: true, final: true, stage: 'studio', stage2: r.finalRound ? { top: 3, name: '最終決戦', judge: 'vote' } : undefined, crowd: 'warm', size: 'tv' });
  return {
    name: 'M-1グランプリ', short: 'M-1', kind: 'manzai', category: 'major', prestige: 54, color: '#c8102e', labelStyle: 'year',
    organizer: r.organizer, broadcaster: r.broadcast, venue: r.finalVenue, region: 'all',
    history: {
      founded: 2001, ended: null, gaps: [[2011, 2014]], revived: 2015,
      note: '2001年創設。2010年の第10回で一区切り、2011〜2014年は開催なし、2015年に第11回として復活（出場資格は結成15年以内に）。',
      sources: ['https://www.sakigake.jp/news/article/20261004OR0022/', 'https://news.allabout.co.jp/articles/o/34962/', 'https://news.allabout.co.jp/articles/o/73242/', 'https://www.oricon.co.jp/news/2100743/full/', 'https://compe.japandesign.ne.jp/m-1gp-2020/'],
      get champions() { return champsMap(); },
    },
    revive: false,
    editionOf: (yy) => editionOf(yy),
    schedule: { entry: { from: [r.entry.from[0], r.entry.from[1] + 1], to: [r.entry.to[0], r.entry.to[1] + 1] }, final: [r.finalAt[0], r.finalAt[1] + 1] },
    rounds,
    eligibility: (g, unit, yy) => { const u = unitInfo(g, yy || cal(g).year); return { ok: u.ok, why: u.why, reasons: u.ok ? [] : [{ text: u.why.split('\n')[0] }] }; },
    fee: (g, unit, yy) => { const rr = m1Rules(yy || cal(g).year) || r; const n = rr.fee.per === 'person' ? rr.fee.nominal * Math.max(2, (unitInfo(g, yy).members || []).length) : rr.fee.nominal; return internal(n); },
    prize: M1.prizeNominal, prizeText: M1.prizeText,
    perform: { kind: 'manzai', length: 240 },
    news: [],
    catchcopy: (g) => { const E = G && entryOf(g); return (E && E.copy) || ''; },
    flow: async (g) => m1Go(g),
    entry: async (g) => entryFlow(g),
    onMorning: () => {}, // this module's own morning runs first (see below)
    status: (g) => safe(() => g.m1(), null),
  };
}
function champsMap() {
  if (!G || !G.state || !G.state.m1) return {};
  const out = {};
  for (const h of G.state.m1.hist || []) out[h.y] = h.ch === 'me' ? (G.state.m1.me.name || G.state.name) : h.chN;
  return out;
}
function registerFor(year) {
  if (regYear === year) return;
  regYear = year;
  registerContest('m1', defFor(year));
}
registerFor(2026);

// ---------------------------------------------------------------- the season goes on (with or without the player)
const keyed = (g, text, key, prio = 40, personal = false) => {
  if (has(g, 'contestNews')) return safe(() => g.contestNews(text, { contest: 'm1', key, prio, personal, cat: 'owarai' }));
  M(g).news.q.push({ day: today(g), text, prio });
  return true;
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : ''));
const nameOfEntrant = (m, y, e) => (e.c && !e.c.anon ? e.c.n : anonCombo(sd(m, y), y, e.no).n);

function processYear(g, y) {
  const rules = m1Rules(y);
  const m = M(g);
  const t = today(g);
  if (!rules) {
    if (y >= 2011 && y <= 2014) { const c = cal(g); if (c.year === y && c.month >= 12) news(g, 'hiatus', {}, { once: `hiatus_${y}` }); }
    return;
  }
  const P = plan(g, y);
  if (t < P.entryFrom - 1) return;
  const S = season(g, y);
  if (!S || S.past) return; // the shared past (built before the save's start) is history already
  const ev = S.ev || (S.ev = {});
  const lbl = rules.label;
  // entry window
  if (t >= P.entryFrom && !ev.open) {
    ev.open = t;
    const base = y === 2001 ? NEWS.open2001[0] : y === 2015 ? NEWS.open2015[0] : fill(NEWS.open[y % 2], { label: lbl, limit: rules.limitText, method: rules.entryMethod, fee: rules.fee.text });
    keyed(g, `【M-1】${base}\n締切は${dateLabel(g, P.entryTo)}。${y === 2001 ? '' : `エントリー料${rules.fee.text}。`}`, `open|m1|${y}`, 70);
    if (y === 2025) keyed(g, `【M-1】${NEWS.feeChange[0]}`, `m1fee|${y}`, 30);
  }
  // 3 days before the close: one line for everybody (D1's generic reminder would not know this entry)
  if (t >= P.entryTo - 3 && t <= P.entryTo && !ev.close3) {
    ev.close3 = t;
    const E = entryOf(g, y);
    const u = unitInfo(g, y);
    const txt = E ? `【M-1】${lbl}のエントリー締切まであと${Math.max(0, P.entryTo - t)}日。駆け込みのエントリーが続いている。` : u.ok ? `【M-1】${lbl}のエントリー締切まで、あと${Math.max(0, P.entryTo - t)}日（エントリー料${rules.fee.text}）。${eraOf(g.state).deviceShort || 'スマホ'}の「M-1」からエントリーできる。` : `【M-1】${lbl}のエントリー締切まで、あと${Math.max(0, P.entryTo - t)}日。`;
    keyed(g, txt, `close3|m1|${y}`, E ? 10 : 55, !E && u.ok);
  }
  if (t > P.entryTo && !ev.close) {
    ev.close = t;
    const e = entriesOf(y), prev = entriesOf(y - 1);
    const rec = e.verified && (y === 2007 || y >= 2019 || y > 2026) ? (y === 2024 ? '史上初の5桁、過去最多。' : '過去最多を更新。') : '';
    keyed(g, `【M-1】${lbl}のエントリーが締め切られ、${rules.entriesText}が参戦。${rec}${prev.n ? '' : ''}`, `count|m1|${y}`, 60);
  }
  // pool news (graduations, break-ups), at most 2 a year, when the entry opens
  if (ev.open && !ev.pool && m._notes) { ev.pool = 1; for (const n of m._notes.splice(0).slice(0, 2)) news(g, n.k, { x: n.x }, { prio: -1 }); }
  // rounds
  P.rounds.forEach((R, ri) => {
    if (t >= R.opts[0].day && !ev['s' + ri]) {
      ev['s' + ri] = t;
      if (ri === 0) keyed(g, `【M-1】${fill(NEWS.r1open[0], { label: lbl, hall: R.opts[0].hall })}\n${R.opts.map((o) => o.city).filter((c, i, a) => a.indexOf(c) === i).join('・')}ほか全国で開催。`, `m1start|${y}|0`, 30);
    }
    if (t > R.last && !ev['f' + ri]) { ev['f' + ri] = t; safe(() => roundNews(g, y, ri)); }
  });
  // the final (rivals only when the player is not in it)
  if (t > P.finalDay && !ev.final) {
    ev.final = t;
    const E = entryOf(g, y);
    if (!(S.fin && S.fin.done)) safe(() => simulateFinal(m, y));
    safe(() => finalNews(g, y, E));
    if (y === 2010) news(g, 'ended', {}, { once: 'ended2010', prio: 2 });
  }
}
function roundNews(g, y, ri) {
  const m = M(g);
  const rules = m1Rules(y);
  const R = rules.rounds[ri];
  const E = entryOf(g, y);
  const lbl = rules.label;
  const k = ri; // D1's round index (its rounds are this year's rounds + the final)
  const passed = passedOf(m, y, ri);
  const field = fieldOf(m, y, ri);
  const nPass = passed.length + (E && E.results.some((r) => r.ri === ri && r.passed) ? 1 : 0);
  if (R.id === 'sf') {
    // the finalists (the player's own press conference already said it when they were there)
    const fin = prepareFinal(m, y);
    const names = fin.finalists.map((x) => (x === 'me' ? E.name : actOf(m, y, x).name));
    const firsts = fin.finalists.filter((x) => (x === 'me' ? !(m.me.finals) : !actOf(m, y, x).finals)).length;
    keyed(g, `【M-1】${lbl} 決勝進出者発表：${names.join('、')}。初の決勝進出は${firsts}組。${rules.revival ? '\n残る1枠は決勝当日の敗者復活戦で。' : ''}`, `finalists|m1|${y}`, 80);
    const last = fin.finalists.filter((x) => x !== 'me').map((x) => actOf(m, y, x)).find((a) => a.last);
    if (last) news(g, `「${last.name}」、ラストイヤーで悲願の決勝進出。`, {}, { once: `finlast_${y}`, prio: 1 });
    const tears = fin.losers.filter((x) => x !== 'me').map((x) => actOf(m, y, x)).find((a) => a.semis >= 3 && !a.finals);
    keyed(g, tears ? `【M-1】${fill(NEWS.semiTears[0], { x: tears.name })}` : `【M-1】${fill(NEWS.sf[0], { venue: R.opts[0].hall, n: field.length + (E && E.results.some((r) => r.ri === ri) ? 1 : 0) })}`, `upset|m1|${y}|${k}`, 30);
    return;
  }
  const next = rules.rounds[ri + 1];
  let line = `【M-1】${lbl} ${R.name}の結果発表。${nPass.toLocaleString('ja-JP')}組が${next ? next.name : '次'}へ。`;
  // the act that shook the venue
  const best = passed.slice().sort((a, b) => b.p - a.p)[0];
  if (best) line += `\n会場を一番わかせたのは「${nameOfEntrant(m, y, best)}」。`;
  keyed(g, line, `round|m1|${y}|${k}`, 20 + ri * 5);
  // upsets: a known act out (準決勝常連 / 前年ファイナリスト)
  const passedKeys = new Set(passed.map((e) => e.key));
  const fav = field.filter((e) => e.c && !e.c.anon && !passedKeys.has(e.key) && (e.c.sm >= 3 || (e.c.last && e.c.last.y === y - 1 && e.c.last.r !== 'sf'))).sort((a, b) => b.p - a.p)[0];
  if (fav) keyed(g, `【M-1】${fill(NEWS.upset[fav.c.fin ? 1 : 0], { x: fav.c.n, round: R.name })}`, `upset|m1|${y}|${k}`, 25);
  else if (ri >= 2) keyed(g, `【M-1】${fill(NEWS[R.id === 'qf' ? 'qf' : 'r3'][1], { x: best ? nameOfEntrant(m, y, best) : '', n: nPass })}`, `upset|m1|${y}|${k}`, 15);
  if (ri === 0) {
    const ama = passed.find((e) => !e.c && h01x(y, e.no) < 0.2);
    if (ama) news(g, 'r1amateur', { x: nameOfEntrant(m, y, ama) }, { once: `r1ama_${y}` });
  }
  if (R.wildcard) {
    const S = season(g, y);
    if (S.wildcard && !(E && E.results.some((r) => r.wildcard))) {
      const e = fieldOf(m, y, ri + 1).find((x) => x.wildcard);
      if (e) news(g, 'wildcard', { x: nameOfEntrant(m, y, e) }, { once: `wc_${y}`, prio: 1 });
    }
  }
}
const h01x = (...k) => { let h = 2166136261; for (const ch of k.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
function finalNews(g, y, E) {
  const m = M(g);
  const rules = m1Rules(y);
  const row = m.hist.find((h) => h.y === y);
  if (!row) return;
  const lbl = rules.label;
  const champMe = row.ch === 'me';
  const champName = champMe ? (E ? E.name : m.me.name) : row.chN;
  // the champion (claims D1's key: one champion in one world)
  keyed(g, `【M-1】第${rules.edition}代王者は「${champName}」！${lbl}を制した。${row.ruN ? `\n準優勝は「${row.ruN}」${row.thN ? `、3位は「${row.thN}」` : ''}。` : ''}${rules.finalRound && row.v ? `最終決戦は審査員${row.v}票。` : ''}`, `champ|m1|${y}`, 95);
  if (row.revN && row.revN === champName) news(g, 'championRevival', { x: champName }, { once: `champrev_${y}`, prio: 3 });
  const c = !champMe && row.ch ? m.pool.find((x) => x.id === row.ch) : null;
  if (c && rules.limit === y - c.f) news(g, 'championLast', { x: champName }, { once: `champlast_${y}`, prio: 3 });
  if (row.revN) news(g, `敗者復活戦（${rules.revival.venue}）を勝ち上がったのは「${row.revN}」だった。`, {}, { once: `rev_${y}` });
  news(g, 'topScore', { x: row.topN, s: row.top }, { once: `top_${y}` });
  const rating = 18 + Math.round(h01x('rating', m.seed, y) * 12 * 10) / 10;
  news(g, 'rating', { p: rating.toFixed(1) }, { once: `rating_${y}`, prio: -1 });
  news(g, 'trend', { x: champName, sns: y <= 2010 ? 'ネットの掲示板' : (eraOf(g.state).sns || 'SNS') }, { once: `trend_${y}`, prio: -1 });
}

// the player's personal schedule: reminders, missed rounds, the mail, after-final events
function personal(g, y) {
  const m = M(g);
  const t = today(g);
  const E = entryOf(g, y);
  const rules = m1Rules(y);
  const dev = eraOf(g.state).deviceShort || 'スマホ';
  let sent = 0;
  const send = (from, text, extra = {}) => { if (sent >= 2) { (m.mailQ = m.mailQ || []).push({ from, text, ...extra }); return; } sent++; msg(g, from, text, { kind: extra.kind || 'chat', contest: 'm1', ...extra }); };
  for (const q of (m.mailQ || []).splice(0, 2)) { sent++; msg(g, q.from, q.text, { kind: q.kind || 'chat', contest: 'm1', ...(q.regular ? { regular: q.regular } : {}) }); }
  if (m.pendingMail && m.pendingMail.day <= t) {
    const pm = m.pendingMail; m.pendingMail = null;
    const PE = entryOf(g, pm.y);
    if (PE) send('M-1グランプリ事務局', `【受付完了のハガキ】${PE.name} 様\nエントリーナンバー ${PE.no}\n${PE.next ? `${m1Rules(pm.y).rounds[PE.next.ri].name}：${dateLabelY(g, PE.next.day)} ${PE.next.city}（${PE.next.hall}）` : ''}\n当日、受付でエントリー料をお支払いください。`);
  }
  if (!E || !rules) return;
  const P = plan(g, y);
  // missed
  if (E.status === 'entered' && E.next && t > E.next.day) {
    const rn = rules.rounds[E.next.ri] ? rules.rounds[E.next.ri].name : '予選';
    E.status = 'withdrawn'; E.next = null;
    (E.log = E.log || []).push(`${rn}に来られず、棄権。`);
    send('M-1グランプリ事務局', `【棄権のお知らせ】${E.name} 様\n${rn}にお越しにならなかったため、棄権扱いとなりました。`);
  }
  if ((E.status === 'revival' || E.status === 'finalist') && t > P.finalDay && !E.final && !E.results.some((r) => r.round === '敗者復活戦')) {
    E.status = 'withdrawn';
    send('M-1グランプリ事務局', `【欠場】${E.name} 様\n決勝当日にお越しにならなかったため、欠場扱いとなりました。`);
  }
  // reminders
  if (E.status === 'entered' && E.next && E.next.day === t) send('M-1グランプリ事務局', `【本日】${rules.label} ${rules.rounds[E.next.ri].name}\n${E.next.city}（${E.next.hall}）　エントリーナンバー${E.no}\n${dev}の「M-1」→「会場へ向かう」から出発してください。`);
  else if (E.status === 'entered' && E.next && E.next.day === t + 1) send('M-1グランプリ事務局', `【明日】${rules.label} ${rules.rounds[E.next.ri].name}（${E.next.city}・${E.next.hall}）。持ち時間は${rules.rounds[E.next.ri].length / 60}分です。`);
  if ((E.status === 'revival' || E.status === 'finalist') && P.finalDay === t) send('M-1グランプリ事務局', `【本日】${rules.label} ${E.status === 'revival' ? '敗者復活戦・' : ''}決勝\n${E.status === 'revival' ? rules.revival.venue : rules.finalVenue}\n${dev}の「M-1」から会場へ。`);
  // after the final: offers flood (2 a morning), the after events
  if (E.final && !E.after.offers && t > P.finalDay) {
    E.after.offers = t;
    const ids = E.final.champ ? ['m1_netaban', 'm1_hinadan', 'm1_radio'] : E.final.place <= 3 ? ['m1_netaban', 'm1_hinadan'] : ['m1_netaban'];
    for (const id of ids) if (REGULARS[id] && !(g.state.regulars[id] && !g.state.regulars[id].dropped)) send(REGULARS[id].host, `${E.final.champ ? 'M-1王者' : 'M-1ファイナリスト'}の「${E.name}」さんに、ぜひレギュラーをお願いしたく…！『${REGULARS[id].title}』（${'月火水木金土日'[REGULARS[id].weekday]}曜日）`, { kind: 'offer', regular: id });
    g.addFans(E.final.champ ? 20000 : 4000, true);
    news(g, E.final.champ ? `M-1王者「${E.name}」にオファーが殺到。テレビ・ラジオ・営業…スケジュールは真っ黒。` : `M-1決勝で爪あとを残した「${E.name}」に、仕事のオファーが続々。`, {}, { once: `offers_${y}`, prio: 2 });
  }
  if (E.final && t === P.zadankai) send('M-1グランプリ事務局', `【本日】M-1 アフター座談会の収録です。${dev}の「M-1」から。`);
  if (E.final && t === P.another) { news(g, 'another', { x: E.name }, { once: `another_${y}` }); send('ABCテレビ', `「M-1グランプリ${y} アナザーストーリー」放送。${E.name}の一年を追いました。${dev}の「M-1」から見られます。`); }
}
function afterYear(g, y) {
  // events of the season before (リターンズ, ツアー, DVD) that fall in this calendar year
  const m = M(g);
  const t = today(g);
  const E = entryOf(g, y);
  const P = plan(g, y);
  if (!P || !m.seasons[y] || m.seasons[y].past) return;
  const dev = eraOf(g.state).deviceShort || 'スマホ';
  if (E && E.final) {
    if (t === P.zadankai) msg(g, 'M-1グランプリ事務局', `【本日】M-1 アフター座談会の収録です。${dev}の「M-1」から。`, { contest: 'm1' });
    if (t === P.another) msg(g, 'ABCテレビ', `「M-1グランプリ${y} アナザーストーリー」放送。${E.name}の一年を追いました。${dev}の「M-1」から見られます。`, { contest: 'm1' });
    if (t === P.returns - 1) msg(g, 'M-1グランプリ事務局', `明日は「M-1グランプリ リターンズ」の収録です。${dev}の「M-1」から。`, { contest: 'm1' });
    for (const s of P.tour) if (t === s.day - 1) msg(g, 'M-1ツアー制作', `明日はM-1ツアー${s.city}公演。${dev}の「M-1」→「ツアー」から会場へ。`, { contest: 'm1' });
  }
  const S = m.seasons[y];
  if (S && !S.dvdDone && t >= P.dvd) {
    S.dvdDone = t;
    news(g, 'dvd', { label: m1Rules(y).label }, { once: `dvd_${y}` });
    if (E && E.final && !(E.after && E.after.dvd)) {
      const sales = Math.round((E.final.champ ? 42000 : 30000) + h01x('dvd', m.seed, y) * 20000);
      const nominal = E.final.champ ? 600000 : 120000;
      g.addMoney(internal(nominal), true);
      if (!g.hasItem('m1_dvd')) g.giveItem('m1_dvd', 1, true);
      E.after.dvd = { sales };
      msg(g, 'DVD発売元', `「${m1Rules(y).label}」DVDが発売されました。売上は約${sales.toLocaleString('ja-JP')}枚。出演者印税 ${yenNom(nominal)} をお振り込みしました。`, { contest: 'm1' });
    }
  }
}

export function m1Morning(g) {
  if (!g || !g.state) return;
  G = g;
  const m = M(g);
  const t = today(g);
  if (m.lastMorning === t) return;
  m.lastMorning = t;
  const y = cal(g).year;
  registerFor(y);
  if (has(g, 'contestNews')) flushQueued(g, m, t);
  for (const yy of [y - 1, y]) if (yy >= 2001) safe(() => processYear(g, yy));
  safe(() => personal(g, y));
  safe(() => afterYear(g, y - 1));
  flushQueued(g, m, t);
}
function flushQueued(g, m, t) {
  // the news queued by the flows / pool go out first (their D1 keys too), at most 2 plain ones a morning
  if (!has(g, 'contestNews')) { if (m.news.fd !== t) { m.news.fd = t; flushNews(g); } return; }
  {
    const q = m.news.q.splice(0).filter((n) => t - (n.day || t) <= 5).sort((a, b) => (b.key ? 1 : 0) - (a.key ? 1 : 0) || b.prio - a.prio);
    if (m.news.pd !== t) { m.news.pd = t; m.news.pn = 0; }
    for (const n of q) {
      if (!n.key && m.news.pn >= 2) { m.news.q.push(n); continue; }
      if (!n.key) m.news.pn++;
      safe(() => g.contestNews(n.text, { contest: 'm1', prio: 30 + n.prio * 5, ...(n.key ? { key: n.key } : {}) }));
    }
  }
}
// before D1's own morning (its news keys are claimed first)
MORNING_HOOKS.unshift(m1Morning);

// ---------------------------------------------------------------- what can the player do today
function todays(g) {
  const y = cal(g).year;
  const out = [];
  const t = today(g);
  const rules = m1Rules(y);
  const E = entryOf(g, y);
  if (rules) {
    const P = plan(g, y);
    const S = statusOf(g, y);
    if (!E && (S.id === 'entry' || S.entryOpen)) out.push({ id: 'entry', label: 'エントリーする', sub: `${rules.fee.text}・締切${dateLabel(g, P.entryTo)}`, run: (gg) => entryFlow(gg) });
    if (E && E.status === 'entered' && E.next && E.next.day === t) out.push({ id: 'round', label: `会場へ向かう：${rules.rounds[E.next.ri].name}`, sub: `${E.next.city}・${E.next.hall}`, run: (gg) => roundFlow(gg, E.next.ri) });
    if (t === P.finalDay) {
      if (E && (E.status === 'revival' || E.status === 'finalist')) out.push({ id: 'final', label: E.status === 'revival' ? '敗者復活戦の会場へ' : '決勝のスタジオへ', sub: E.status === 'revival' ? rules.revival.venue : rules.finalVenue, run: (gg) => finalDayFlow(gg) });
      else if (!M(g).seasons[y].watched) out.push({ id: 'watch', label: '決勝をテレビで見る', sub: rules.broadcast, run: async (gg) => { M(gg).seasons[y].watched = true; await watchFinal(gg); } });
    }
    if (E && E.final && E.after && !E.after.zadankai && t >= P.zadankai && t <= P.zadankai + 5) out.push({ id: 'zadankai', label: 'アフター座談会に出る', sub: 'ファイナリストの座談会', run: (gg) => zadankaiFlow(gg, y) });
    if (E && t >= P.another && E.results.length && t > P.finalDay) out.push({ id: 'another', label: `アナザーストーリー（${y}）を見る`, sub: 'この一年のドキュメンタリー', run: (gg) => anotherStory(gg, y) });
    const st = S.id;
    if (unitInfo(g, y).partner && (st === 'entry' || st === 'prelim' || st === 'before' || st === 'finalday') && M(g).practicedDay !== t) out.push({ id: 'practice', label: 'ネタ合わせをする', sub: '相方と稽古（体力 -10）', run: (gg) => practiceFlow(gg) });
  }
  // the season before: リターンズ・ツアー・DVD
  const py = y - 1;
  const PE = entryOf(g, py);
  const PP = plan(g, py);
  if (PE && PE.final && PP) {
    if (!PE.after.zadankai && t >= PP.zadankai && t <= PP.zadankai + 5) out.push({ id: 'zadankai', label: 'アフター座談会に出る', sub: 'ファイナリストの座談会', run: (gg) => zadankaiFlow(gg, py) });
    if (!PE.after.returns && Math.abs(t - PP.returns) <= 1) out.push({ id: 'returns', label: 'リターンズの収録へ', sub: 'もう1本の漫才', run: (gg) => returnsFlow(gg, py) });
    for (const s of PP.tour) if (t === s.day && !(PE.after.tour && PE.after.tour[s.city])) out.push({ id: 'tour_' + s.city, label: `M-1ツアー ${s.city}公演へ`, sub: 'ステージの仕事', run: (gg) => tourStop(gg, py, s) });
    if (t >= PP.another && !PE.after.another) out.push({ id: 'another_p', label: `アナザーストーリー（${py}）を見る`, sub: 'ドキュメンタリー', run: (gg) => anotherStory(gg, py) });
  }
  return out;
}
export async function m1Go(g) {
  const list = todays(g);
  if (!list.length) { await g.say('今日はM-1の予定はない。'); return false; }
  let it = list[0];
  if (list.length > 1 && !g.auto) {
    const k = await g.ask('M-1：今日できること', list.map((x) => x.label).concat(['やめておく']), { cancel: list.length });
    if (k < 0 || k >= list.length) return false;
    it = list[k];
  }
  await it.run(g);
  return true;
}

// ---------------------------------------------------------------- g.* API
const methods = {
  // summary for the notebook / other modules / D1's screens
  m1() {
    if (!this.state) return null;
    G = this;
    const m = M(this);
    const c = cal(this);
    const y = c.year;
    const rules = m1Rules(y);
    const S = statusOf(this, y);
    const E = entryOf(this, y);
    const P = rules ? plan(this, y) : null;
    return {
      year: y, held: !!rules, edition: editionOf(y), label: rules ? `${rules.label}（${rules.edLabel}）` : 'M-1グランプリ', status: S.id, statusLabel: S.label,
      rules: rules ? { limitText: rules.limitText, eligibility: rules.eligibilityText, fee: rules.fee.text, entries: rules.entriesText, rounds: rules.rounds.map((r) => `${r.name}（${r.length / 60}分）`), finalists: rules.finalists, judges: rules.judges, scoring: rules.judgeScoring, emikuji: rules.emikuji, revival: rules.revival ? `${rules.revival.venue}・${rules.revival.judge}` : null, final: `${rules.finalLabel} ${rules.finalVenue}`, prize: M1.prizeText, organizer: rules.organizer } : null,
      schedule: P ? { entry: [dateLabel(this, P.entryFrom), dateLabel(this, P.entryTo)], final: dateLabel(this, P.finalDay), finalDay: P.finalDay } : null,
      entry: E ? { no: E.no, name: E.name, status: E.status, round: E.next && rules.rounds[E.next.ri] ? rules.rounds[E.next.ri].name : null, next: E.next ? { day: E.next.day, date: dateLabel(this, E.next.day), city: E.next.city, hall: E.next.hall } : null, results: E.results.map((r) => ({ round: r.round, score: r.score, passed: r.passed, cut: r.cut })), final: E.final || null, copy: E.copy || null } : null,
      today: todays(this).map((x) => ({ id: x.id, label: x.label })),
      history: m.hist.slice(-12).map((h) => ({ year: h.y, edition: h.ed, champion: h.ch === 'me' ? m.me.name : h.chN, runnerUp: h.ruN || null, third: h.thN || null, revival: h.revN || null, top: h.top, player: h.ch === 'me' || (h.finN || []).includes(m.me.name) })),
      me: { champion: m.me.champion || null, finals: m.me.finals || 0, semis: m.me.semis || 0, entries: Object.keys(m.me.entries).length, best: bestOf(m) },
    };
  },
  m1Go() { return m1Go(this); },
  m1Enter() { return entryFlow(this); },
  m1Round(ri) { const E = entryOf(this); return roundFlow(this, ri ?? (E && E.next ? E.next.ri : 0)); },
  m1FinalDay() { return finalDayFlow(this); },
  m1Watch() { return watchFinal(this); },
  m1Practice() { return practiceFlow(this); },
  m1Another(year) { return anotherStory(this, year ?? cal(this).year); },
  m1Today() { return todays(this).map((x) => ({ id: x.id, label: x.label, sub: x.sub })); },
  m1History() { const m = M(this); return m.hist.map((h) => ({ ...h, chN: h.ch === 'me' ? m.me.name : h.chN })); },
  m1Morning() { return m1Morning(this); },
  m1State() { return M(this); },
};
function bestOf(m) {
  if (m.me.champion) return `優勝（${m.me.champion}年）`;
  let best = null, bi = -1;
  const order = ['1回戦', '2回戦', '3回戦', '準々決勝', '準決勝', '敗者復活戦', '決勝'];
  for (const E of Object.values(m.me.entries)) {
    const lastR = E.final ? '決勝' : E.results.length ? E.results[E.results.length - 1].round : null;
    const i = order.indexOf(lastR);
    if (i > bi) { bi = i; best = E.final ? `決勝${E.final.place || E.final.rank1}位（${E.y}年）` : `${lastR}（${E.y}年）`; }
  }
  return best;
}
export function installM1(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installM1(Game.prototype);

// ---------------------------------------------------------------- phone app 「M-1」
function rulesLines(g, y) {
  const r = m1Rules(y);
  if (!r) return [statusOf(g, y).label, '', '・2001年創設（第1回）〜2010年 第10回', '・2011〜2014年は開催なし（THE MANZAIが年末の漫才大会に）', '・2015年 第11回として復活'];
  return [
    `${r.label}（${r.edLabel}）`, `主催：${r.organizer}`, `出場資格：${r.eligibilityText}`, `エントリー：${r.entryMethod}・${r.fee.text}${r.fee.verified ? '' : '（この時代の額は未確認：この世界では同額）'}`,
    `エントリー数：${r.entriesText}`, `予選：${r.rounds.map((x) => `${x.name}${x.length / 60}分`).join('→')}${r.seeds ? '（過去に準決勝進出なら1回戦免除）' : ''}`,
    r.wildcard ? `ワイルドカード：準々決勝の敗者から${r.wildcardMedia}の投票で1組が準決勝へ` : '', r.revival ? `敗者復活戦：決勝当日、${r.revival.venue}（${r.revival.judge}）` : '敗者復活戦：なし（2002年から）',
    `決勝：${r.finalLabel}　${r.finalVenue}　${r.finalists}組${r.revival ? '（敗者復活1組を含む）' : ''}`, `審査：${r.judgeScoring}`, r.emikuji ? '出番順：笑神籤（本番中にくじで決定）' : '出番順：事前の抽選で決定', r.finalRound ? '最終決戦：上位3組がもう1本、審査員が1組に投票' : '最終決戦：なし（第1回）',
    `出囃子：${M1.song}（決勝の登場曲）`, `賞金：${M1.prizeText}`, `放送：${r.broadcast}${r.onAir ? `（${r.onAir}〜）` : ''}`, '※出場者・審査員・司会はこのゲームの世界の架空の人物です。',
  ].filter(Boolean);
}
function scheduleLines(g, y) {
  const P = plan(g, y);
  if (!P) return [statusOf(g, y).label];
  const out = [`エントリー：${dateLabel(g, P.entryFrom)}〜${dateLabel(g, P.entryTo)}`];
  for (const R of P.rounds) out.push(`${R.name}：${R.opts.map((o) => `${dateLabel(g, o.day)}${o.city}`).join('・')}`);
  out.push(`敗者復活戦・決勝：${dateLabel(g, P.finalDay)}`);
  const E = entryOf(g, y);
  if (E) { out.push('', `「${E.name}」No.${E.no}：${{ entered: '予選中', out: '敗退', finalist: '決勝進出', revival: '敗者復活戦へ', champion: '優勝', withdrawn: '棄権' }[E.status] || E.status}`); for (const r of E.results) out.push(`・${r.round} ${r.score}点${r.passed ? ' 合格' : ' 敗退'}（ライン${r.cut ?? '—'}）`); if (E.next) out.push(`次：${dateLabel(g, E.next.day)} ${E.next.city}・${E.next.hall}`); }
  return out;
}
function historyLines(g) {
  const m = M(g);
  const out = [];
  for (const h of m.hist.slice().reverse()) out.push(`${h.y}年 第${h.ed}回　${h.ch === 'me' ? `★${m.me.name}` : h.chN}${h.ruN ? `（準優勝 ${h.ruN}）` : ''}`);
  if (!out.length) out.push('（まだ記録がない）');
  out.push('', '2011〜2014年：開催なし', '※この世界の歴代王者（架空の芸人）');
  return out;
}
function myLines(g) {
  const m = M(g);
  const es = Object.values(m.me.entries).sort((a, b) => b.y - a.y);
  if (!es.length) return ['（まだM-1に出たことがない）'];
  const out = [];
  for (const E of es) {
    const last = E.final ? (E.final.champ ? '優勝！' : `決勝${E.final.place || E.final.rank1}位`) : E.results.length ? `${E.results[E.results.length - 1].round}${E.results[E.results.length - 1].passed ? '' : '敗退'}` : E.status === 'withdrawn' ? '棄権' : 'エントリー';
    out.push(`${E.y}年 No.${E.no}「${E.name}」 ${last}`);
    if (E.copy) out.push(`　キャッチコピー「${E.copy}」`);
  }
  return out;
}
async function m1App(g) {
  G = g;
  for (;;) {
    const y = cal(g).year;
    const S = statusOf(g, y);
    const acts = todays(g);
    const items = acts.map((a) => ({ label: a.label, sub: a.sub, act: a }))
      .concat([{ label: '今年の日程・自分の結果', sub: S.label, info: 'sched' }, { label: '大会のルール', sub: m1Rules(y) ? m1Rules(y).limitText : '—', info: 'rules' }, { label: '歴代王者', sub: 'この世界の歴史', info: 'hist' }, { label: '自分の出場記録', sub: bestOf(M(g)) || 'まだ出ていない', info: 'me' }])
      .concat(g.hasItem('m1_dvd') ? [{ label: 'DVDを見る', sub: 'M-1グランプリのDVD', info: 'dvd' }] : []);
    const k = await phoneList(g, { title: m1Rules(y) ? `M-1グランプリ${y}` : 'M-1グランプリ', color: '#c8102e', items, hint: 'A:えらぶ　B:もどる' });
    if (k < 0) return;
    const it = items[k];
    if (it.act) { closePhoneThen(g, async (gg) => { await it.act.run(gg); }); return; }
    if (it.info === 'sched') await phoneInfo(g, { title: '日程・結果', color: '#c8102e', lines: scheduleLines(g, y) });
    else if (it.info === 'rules') await phoneInfo(g, { title: 'ルール', color: '#c8102e', lines: rulesLines(g, y) });
    else if (it.info === 'hist') await phoneInfo(g, { title: '歴代王者', color: '#c8102e', lines: historyLines(g) });
    else if (it.info === 'me') await phoneInfo(g, { title: '出場記録', color: '#c8102e', lines: myLines(g) });
    else if (it.info === 'dvd') { closePhoneThen(g, async (gg) => { const m = M(gg); const E = Object.values(m.me.entries).filter((e) => e.final).sort((a, b) => b.y - a.y)[0]; if (E) await dvdCard(gg, { year: E.y, name: E.name, members: unitInfo(gg).members, copy: E.copy }); }); return; }
  }
}
registerPhoneApp('m1', {
  name: 'M-1', color: '#c8102e', order: 66,
  iconHD(c, x, y) {
    appTile(c, x, y, '#c8102e');
    c.fillStyle = '#ffd23f'; c.font = '13px "DotGothic16", monospace'; c.textBaseline = 'top'; c.textAlign = 'center';
    c.fillText('M-1', x + 16, y + 9); c.textAlign = 'left';
    c.fillRect(x + 7, y + 24, 18, 2);
  },
  badge: (g) => safe(() => todays(g).filter((a) => ['round', 'final', 'entry', 'zadankai', 'returns'].includes(a.id) || a.id.startsWith('tour_')).length, 0) || 0,
  cond: (g) => !!g.state && (cal(g).year >= 2001 || !!(g.state.m1 && Object.keys((g.state.m1.me || {}).entries || {}).length)),
  open: (g) => m1App(g),
});
// fallback: when D1's hook order changes, this one still runs once a day
onMorning((g) => m1Morning(g));
export { todays as m1Todays, rulesLines, scheduleLines, historyLines };
void dvdRelease; void comboAct; void tagsOf;
