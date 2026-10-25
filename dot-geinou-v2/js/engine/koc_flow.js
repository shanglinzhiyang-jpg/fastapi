// キングオブコント — the player's season (owner: E2): エントリー（エントリー用紙・参加費・エントリーナンバー・シード・即席ユニット）,
// 予選（受付 → 楽屋：ネタ選び・ネタ合わせ・舞台裏稽古・小道具の搬入と確認・音響照明の打ち合わせ・場当たり → 舞台袖 → 本番 → 結果発表・寸評）,
// 準決勝（2018年から2日間で2本）→ 決勝進出者発表（2018・2019年はシークレット）→ 敗者復活戦（2026年〜）→ 決勝（時代ごとの審査：
// 2008 リーグ戦と最終決戦／2009-13 100人×10点の2本合計／2014 1対1と勝ち残り／2015- 審査員5人・2026- 7人）→ 優勝発表・賞金・
// トロフィー → 生・大反省会（2024-）／打ち上げ → オファー・DVD・ドキュメント・キングオブコントの会（2021-）.
// Talks to the other reform modules only through feature-detected g.* calls (CONTRACT4): g.unit / g.unitPower / g.shortfall /
// g.addStageExp / g.addComedyStat (A), g.pickNeta / g.autoNeta / g.netaQuality / g.practiceNeta / g.markNetaUsed (B),
// g.perform / g.performSim (C), g.contestNews (D1). Every one has a local fallback.

import {
  K, yearRec, kDate, absOf, dayOf, isToday, playerUnit, unitSize, memberLook, powerOf, qualityOf, harmonyOf, simScore, season,
  copyFor, judgePoints, crowdPoints, duelVotes, finalistVote, judgesFor, histFromSeason, blockField, entryNo, passOdds,
  news, notice, logRun, roundName, clamp, num, safe, gauss, dateText, entryOf,
} from './koc_core.js';
import {
  rules, schedule, titleOf, KOC_NAME, PRIZE, FEE, lenText, hallText, fareOf, TRAVEL_STAMINA, MC, setFor, CONTE_TITLES,
  CUE_ROWS, idealCues, STAT_NOTES, PART_NOTES, NEWS, STAFF, memberNames, lookFor, rngOf, hashStr, roundPlan, membersOf, FOUNDED,
} from './koc_data.js';
import {
  pushSet, card, pickRows, drawForm, drawCueSheet, drawProps, drawBoard, drawScore, drawRanking, drawPV, drawWinner, drawTitle,
  drawDoc, KC, R as RECT, T as TXT, kocLogo,
} from './koc_art.js';
import { PEOPLE } from './life.js';
import { MINIGAMES } from './minigame.js';
import { registerItem } from './state.js';
import { YEN_MARK, display, SW, SH } from './util.js';
import { audio } from './audio.js';
import { doorIndexFor } from './map.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const realYen = (n) => '¥' + YEN_MARK + Math.round(n).toLocaleString('ja-JP');
const manYen = (n) => (n >= 10000 && n % 10000 === 0 ? `${(n / 10000).toLocaleString('ja-JP')}万円` : realYen(n));
// real yen → the game's internal money (the era's display rate makes it show as the real amount)
const toInternal = (n) => Math.round(n / (display.priceRate || 1));
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const pickR = (arr, r) => arr[Math.floor(r() * arr.length)];
const ROUND_PRESSURE = { r1: 40, r2: 55, qf: 70, sf: 85, revival: 90, final: 98 };
const ROUND_SIZE = { r1: 96, r2: 72, qf: 48 };
const PREP_SLOTS = { r1: 3, r2: 3, qf: 4, sf: 4, final: 4 };

registerItem('koc_trophy', { name: 'キングオブコントのトロフィー', price: 0, desc: 'コント日本一の証。黄金の王冠がかがやいている。' });
registerItem('koc_pass', { name: 'KOCの出演者パス', price: 0, desc: 'キングオブコントの楽屋に入るためのパス。記念に取ってある。' });

// ---------------------------------------------------------------- small helpers
export const roundsOf = (y) => (rules(y).hasQF ? ['r1', 'r2', 'qf', 'sf', 'final'] : ['r1', 'r2', 'sf', 'final']);
function feeOf(E) { return E && (E.type === 'trio' || E.type === 'quartet' || (E.members || []).length >= 3) ? FEE.trio : FEE.combi; }
export const feeText = () => `コンビ ${realYen(FEE.combi)}／トリオ以上 ${realYen(FEE.trio)}`;
function homeRegion(g) {
  const id = g.map && g.map.placeId;
  if (!id) return 'tokyo';
  if (id === 'namba') return 'osaka';
  const d = safe(() => doorIndexFor(id), null);
  return d && d.town === 'namba' ? 'osaka' : 'tokyo';
}
function partnerIds(g, E) { return (E && E.members ? E.members : []).map((m) => m.id).filter((id) => id && id !== 'player' && PEOPLE[id]); }
function partnerSpeaker(g, E) {
  const id = partnerIds(g, E)[0];
  if (id) return { name: PEOPLE[id].short || PEOPLE[id].name, look: PEOPLE[id].look };
  const m = E && (E.members || []).find((x) => x.id !== 'player');
  return m ? { name: m.name, look: m.look || lookFor(m.name) } : null;
}
function looksOf(g, E) { return (E && E.members ? E.members : []).map((m) => (m.id === 'player' ? g.state.look || {} : m.look || memberLook(g, m))).slice(0, 4); }
function rivalLooks(name, type = 'combi') { return memberNames(name, membersOf(type)).map((n) => lookFor(n)); }
function seenOnce(g, key) { const k = K(g); const was = !!k.seen[key]; k.seen[key] = true; return was; }
const sayP = (g, E, text) => { const p = partnerSpeaker(g, E); return p ? g.say(text, p) : g.say(text); };

// The player's planned venue/date for a round of the year (r1: the one chosen on the entry form).
export function planOf(g, y, E, rid) {
  const S = schedule(y);
  if (!E) return null;
  if (rid === 'r1') return E.r1 || S.r1[0];
  if (rid === 'final') return S.final;
  const list = S[rid];
  if (!list || !list.length) return null;
  if (rid === 'sf' && rules(y).twoNetaSF) return list[0];
  const want = E.r1 && (E.r1.city === '大阪' || E.r1.city === '福岡') ? '大阪' : '東京';
  return list.find((v) => v.city === want) || list[0];
}
// the dates the player must be at the venue for the current round (SF: one or two days)
export function datesOf(g, y, E, rid) {
  const S = schedule(y);
  const R = rules(y);
  if (rid === 'sf') {
    if (R.twoNetaSF) return S.sf.map((v) => v.when);
    const p = E && E.sfPick != null ? S.sf[E.sfPick] : planOf(g, y, E, 'sf');
    return [p.when];
  }
  if (rid === 'revival' || rid === 'final') return [S.final.when];
  const p = planOf(g, y, E, rid);
  return p ? [p.when] : [];
}
// What the player has to do today (null: nothing): { rid, idx }
export function dueToday(g) {
  const t = kDate(g);
  const E = entryOf(g, t.year);
  if (!E) return null;
  if (E.status === 'entered' || E.status === 'finalist' || E.status === 'revival' || E.status === 'voter') {
    const rid = E.status === 'finalist' ? 'final' : E.status === 'revival' ? 'revival' : E.status === 'voter' ? 'final' : E.round;
    const ds = datesOf(g, t.year, E, rid);
    const idx = ds.findIndex((w) => w[0] === t.month && w[1] === t.dom);
    if (idx >= 0) {
      if (rid === 'sf' && rules(t.year).twoNetaSF && num(E.sfDone) !== idx) return null;
      if (E.doneDay === g.state.day) return null;
      return { rid, idx, year: t.year };
    }
  }
  return null;
}
// The KOC phase of a year: 'notyet' | 'before' | 'entry' | 'qualifying' | 'final' | 'done'
export function phaseOf(g, y) {
  if (y < FOUNDED) return 'notyet';
  const t = kDate(g);
  const S = schedule(y);
  const now = t.year === y ? t.abs : t.year < y ? -Infinity : Infinity;
  if (now < absOf(y, S.entry.from)) return 'before';
  if (now <= absOf(y, S.entry.to)) return 'entry';
  if (now < absOf(y, S.final.when)) return 'qualifying';
  if (now === absOf(y, S.final.when)) return 'final';
  return 'done';
}

// ================================================================ ENTRY
export async function kocEntry(g) {
  const t = kDate(g);
  const y = t.year;
  if (y < FOUNDED) { await g.say(`『${KOC_NAME}』は、まだ始まっていない（${FOUNDED}年創設）。`); return null; }
  const R = rules(y);
  const S = schedule(y);
  const Y = yearRec(g, y);
  if (Y.entry) { await showStatus(g, y); return Y.entry; }
  const ph = phaseOf(g, y);
  if (ph === 'before') { await g.say(`『${titleOf(y)}』のエントリー受付は、${dateText(y, S.entry.from)}からだ。\n（締切は${dateText(y, S.entry.to)}）`); return null; }
  if (ph !== 'entry') { await g.say(`『${titleOf(y)}』のエントリーは、もう締め切られている。\n（受付は${dateText(y, S.entry.to)}まで。また来年！）`); return null; }
  const first = !seenOnce(g, 'entry');
  if (first) {
    await g.say([`『${titleOf(y)}』（第${R.edition}回）。TBSが主催する、コント日本一決定戦。`,
      `出場資格：プロ・アマ、所属の有無、芸歴、年齢を問わず、2人以上のユニット（ピンは不可。即席ユニットもOK）。\n${y >= 2026 ? '18才未満は保護者の承諾が必要。' : ''}`,
      `エントリー料：${feeText()}（予選当日に会場で支払う）。\n優勝賞金は${manYen(PRIZE)}。`]);
  }
  // the act
  let u = playerUnit(g);
  let instant = false;
  let members = (u.members || []).map((m) => ({ id: m.id, name: m.id === 'player' ? g.state.name : (PEOPLE[m.id] && PEOPLE[m.id].short) || m.short || m.name || '', short: m.short || m.name || '', look: m.id === 'player' ? null : memberLook(g, m) }));
  if (unitSize(u) < 2) {
    await g.say('キングオブコントは、2人以上のユニットに限られる。\nピン（1人）では出られない…。');
    const friends = has(g, 'friends') ? safe(() => g.friends(1), []).filter((id) => PEOPLE[id] && PEOPLE[id].kind !== 'family').slice(0, 5) : [];
    if (!friends.length) { await g.say('（相方を見つけるか、即席ユニットを組んでくれる仲間ができたら、また来よう）'); return null; }
    const i = await g.ask('即席ユニットなら出られる。だれかに頼んでみる？', [...friends.map((id) => `${PEOPLE[id].short || PEOPLE[id].name}と組む`), 'やめておく'], { cancel: friends.length });
    if (i < 0 || i >= friends.length) return null;
    const fid = friends[i];
    const P = PEOPLE[fid];
    await g.say(`「キングオブコント？…おもしろそうじゃん。\n一回だけ、組んでみようか！」`, { name: P.short || P.name, look: P.look });
    instant = true;
    members = [{ id: 'player', name: g.state.name, short: g.state.name, look: null }, { id: fid, name: P.short || P.name, short: P.short || P.name, look: P.look }];
    u = { id: 'instant_' + fid, type: 'combi', name: `${g.state.name}と${P.short || P.name}`, members, harmony: 35, agency: g.state.agency, amateur: !g.state.agency };
  }
  const age = has(g, 'playerAge') ? num(safe(() => g.playerAge(y), 20), 20) : num(g.state.profile && g.state.profile.age, 20);
  if (y >= 2026 && age < 18) {
    const fam = (g.state.profile && g.state.profile.family || []).find((f) => f.alive !== false && /father|mother|grand/.test(f.rel || ''));
    if (!fam) { await g.say('（18才未満は保護者の承諾が必要だ。承諾してくれる大人がいない…）'); return null; }
    await g.say(`（18才未満のエントリーには、保護者の承諾が必要だ。\n${fam.name}に承諾書を書いてもらった）`);
  }
  // the seed (2022 rules): past semifinalists from 2回戦, past finalists from 準々決勝 (not for an instant unit)
  const k = K(g);
  let start = 'r1';
  if (R.seeds && !instant) {
    const past = Object.values(k.hist).filter((h) => h && h.me && h.me.unitId === u.id);
    if (past.some((h) => h.me.reached === 'final')) start = R.hasQF ? 'qf' : 'sf';
    else if (past.some((h) => h.me.reached === 'sf' || h.me.reached === 'revival')) start = 'r2';
  }
  // the entry form
  const netas = has(g, 'netaList') ? safe(() => g.netaList('conte'), []) || [] : [];
  const r1s = S.r1;
  const form = {
    year: y, title: `${titleOf(y)} エントリー用紙`, sub: `第${R.edition}回 ${KOC_NAME}（主催：TBSテレビ）`,
    venue: Math.max(0, r1s.findIndex((v) => (homeRegion(g) === 'osaka' ? v.city === '大阪' : v.city === '東京'))), neta: 0, props: 0, agree: false, sel: 0,
  };
  const yrs = has(g, 'unitYears') ? num(safe(() => g.unitYears(y), 0)) : 0;
  const rows = () => {
    const v = r1s[form.venue];
    const list = [
      { label: 'ユニット名', value: u.name },
      { label: 'ふりがな', value: u.kana || '（ユニット名のとおり）' },
      { label: '人数・形態', value: `${members.length}人（${instant ? '即席ユニット' : members.length >= 3 ? 'トリオ以上' : 'コンビ'}）` },
      { label: 'メンバー', value: members.map((m) => m.name).join('・') },
      { label: '所属', value: g.state.agency ? g.fmt('{agency}') : 'なし（アマチュア）' },
      { label: '結成', value: instant ? '今回のための即席ユニット' : u.formed && u.formed.year ? `${u.formed.year}年${u.formed.month ? `${u.formed.month}月` : ''}（${yrs > 0 ? `結成${yrs}年目` : '今年結成'}）` : '—' },
      { label: start === 'r1' ? '1回戦の会場・日程' : 'シード', value: start === 'r1' ? `${hallText(v)}　${dateText(y, v.when)}` : `${start === 'r2' ? '2回戦' : '準々決勝'}から出場（過去の成績による）`, edit: start === 'r1' },
      { label: 'ネタ（予定）', value: netas.length ? `『${(netas[form.neta] || netas[0]).title || '無題'}』` : '未定（当日までに決める）', edit: netas.length > 1 },
      { label: '小道具・音響', value: ['使う（小道具の搬入あり）', '使わない（素舞台）'][form.props], edit: true },
      { label: '参加規定', value: '参加規定を読み、同意します', check: form.agree, edit: true },
      { label: '', value: 'この内容で送信する', submit: true },
    ];
    return list;
  };
  await g.fadeOut(8);
  const D = { ...form, rows: rows(), note: `エントリー料：${feeText()}（予選当日、会場の受付で支払い）。\n併願エントリー不可。シード出場者もエントリー料が必要です。` };
  const bd = pushSet(g, 'form', D);
  await g.fadeIn(8);
  let ok = false;
  try {
    if (first) await g.say('エントリー用紙を書こう。\n（↑↓で項目、Aで変更。最後に「送信」）', { top: true });
    for (let guard = 0; guard < 40; guard++) {
      D.rows = rows();
      const submitIdx = D.rows.length - 1;
      const i = await pickRows(g, { data: D, n: D.rows.length, rects: D.rects || [], auto: submitIdx, cancel: -1,
        onLeft: (s) => { if (s === 6 && start === 'r1') form.venue = (form.venue + r1s.length - 1) % r1s.length; D.rows = rows(); },
        onRight: (s) => { if (s === 6 && start === 'r1') form.venue = (form.venue + 1) % r1s.length; D.rows = rows(); } });
      if (i < 0) { const q = await g.ask('エントリーをやめる？', ['書き続ける', 'やめる'], { cancel: 0, top: true }); if (q === 1) break; continue; }
      if (i === 6 && start === 'r1') {
        const j = await g.ask('1回戦の会場と日程は？', r1s.map((v) => `${hallText(v)} ${dateText(y, v.when)}`).slice(0, 8), { top: true, cancel: form.venue });
        if (j >= 0) form.venue = j;
      } else if (i === 7 && netas.length > 1) {
        const j = await g.ask('予定しているネタは？（当日に変えてもいい）', netas.slice(0, 6).map((n) => `『${n.title || '無題'}』`), { top: true, cancel: form.neta });
        if (j >= 0) form.neta = j;
      } else if (i === 8) form.props = 1 - form.props;
      else if (i === 9) form.agree = !form.agree;
      else if (i === submitIdx) {
        if (!form.agree && !g.auto) { sfx('buzz'); await g.say('「参加規定に同意」にチェックが入っていない。', { top: true }); D.sel = 9; continue; }
        form.agree = true;
        ok = true;
        break;
      }
    }
    if (!ok) { await g.say('（エントリーはしなかった）', { top: true }); return null; }
    D.rows = rows();
    D.stamp = '受付済';
    sfx('ok');
    return await finishEntry(g, { y, R, S, k, u, instant, members, start, form, netas, r1s, t, first });
  } finally {
    await g.fadeOut(8);
    bd.pop();
    await g.fadeIn(8);
  }
}
async function finishEntry(g, { y, R, S, k, u, instant, members, start, form, netas, r1s, t }) {
  // the entry number: entries arrive through the window
  const Sx = S.entry;
  const prog = clamp((kDate(g).abs - absOf(y, Sx.from)) / Math.max(1, absOf(y, Sx.to) - absOf(y, Sx.from)), 0, 1);
  const N = R.entries.n;
  const no = clamp(Math.round(prog * N * 0.92) + 1 + (hashStr(`${u.id}:${y}`) % 40), 1, N);
  const E = {
    no, unitId: u.id, unitName: u.name, kana: u.kana || '', type: instant ? 'combi' : u.type || (members.length >= 3 ? 'trio' : 'combi'),
    members: members.map((m) => ({ id: m.id, name: m.name, short: m.short, look: m.id === 'player' ? null : m.look })),
    instant, fee: feeOf({ type: u.type, members }), feePaid: false, day: g.state.day, start, round: start,
    r1: start === 'r1' ? r1s[form.venue] : null, props: form.props === 0, plannedNeta: netas[form.neta] ? netas[form.neta].id : null,
    status: 'entered', results: [], netas: {}, log: [], harm: 0, power0: powerOf(g),
  };
  if (instant) E.harmonyBase = 35;
  const Yr = yearRec(g, y);
  Yr.entry = E;
  k.stats.entered = num(k.stats.entered) + 1;
  logRun(g, E, 'entry', `${dateText(y, [t.month, t.dom])}、${E.unitName}は『${titleOf(y)}』にエントリーした。エントリーナンバーは${no}。`);
  await g.say([`送信完了！\nエントリーナンバーは【${no}】。`,
    start === 'r1' ? `1回戦は${dateText(y, E.r1.when)}、${hallText(E.r1)}。\nエントリー料${realYen(E.fee)}は当日、会場で。` : `シードで${roundName(start)}から。日程は${dateText(y, datesOf(g, y, E, start)[0])}。`], { top: true });
  notice(g, `『${titleOf(y)}』エントリーを受け付けました。\nエントリーナンバー：${no}\nユニット名：${E.unitName}\n${start === 'r1' ? `1回戦：${dateText(y, E.r1.when)} ${hallText(E.r1)}` : `${roundName(start)}から出場（シード）`}\nエントリー料（${realYen(E.fee)}）は当日、会場受付でお支払いください。`);
  news(g, NEWS.me.entry({ y, me: E.unitName, no }), { silent: true });
  E.plannedTitle = netas[form.neta] ? netas[form.neta].title || '' : '';
  return contractEntry(E);
}
// The entry as CONTRACT4 describes it (D1's g.contestEntry shape); the same object, so it stays live.
export function contractEntry(E) { return E; }

// ================================================================ STATUS (talk / app)
export async function showStatus(g, y) {
  const E = entryOf(g, y);
  const R = rules(y);
  if (!E) { await g.say(`『${titleOf(y)}』には、エントリーしていない。`); return; }
  const lines = [`『${titleOf(y)}』エントリーナンバー ${E.no}「${E.unitName}」`];
  if (E.status === 'entered') { const ds = datesOf(g, y, E, E.round); lines.push(`次は${roundName(E.round)}：${ds.map((w) => dateText(y, w)).join('・')}　${hallText(planOf(g, y, E, E.round))}`); }
  else if (E.status === 'finalist') lines.push(`決勝進出！決勝は${dateText(y, schedule(y).final.when)}、TBSで生放送。`);
  else if (E.status === 'revival') lines.push(`敗者復活戦に出場。${dateText(y, schedule(y).final.when)}、決勝の日の午後。`);
  else if (E.status === 'champion') lines.push(`第${R.edition}代キングオブコント王者！`);
  else if (E.status === 'withdrawn') lines.push('（棄権した）');
  else lines.push(`${roundName(E.out || E.round)}で敗退。`);
  for (const r of E.results || []) lines.push(`・${roundName(r.round)}：${r.passed ? '通過' : '敗退'}${r.place ? `（${r.place}位／${r.of}）` : ''}`);
  await g.say(lines.join('\n'));
}

// ================================================================ ROUNDS
// Go to today's round (the app / D1's flow). Returns true when something ran.
export async function goToday(g, opts = {}) {
  const due = dueToday(g);
  if (!due) {
    const t = kDate(g);
    const E = entryOf(g, t.year);
    if (E) await showStatus(g, t.year); else await g.say('今日はキングオブコントの予定はない。');
    return false;
  }
  if (due.rid === 'final' || due.rid === 'revival') { await runFinalDay(g, due.year, opts); return true; }
  await runRound(g, due.year, due.rid, due.idx, opts);
  return true;
}
// From the KOC app / D1's 「今日の予定」 (def.flow): KOC's own trip (fare, stamina), desk, round
export async function goFromApp(g) { return goToday(g); }

// The player's performance through C's g.perform (fallbacks: the 'conte' minigame, then 'tsukkomi', then a simulation).
async function perform(g, { y, rid, neta, len, venue, auto, title }) {
  const opts = { kind: 'conte', neta, length: len, venue, contest: { id: 'koc', round: rid, name: titleOf(y) }, title, skip: !!auto };
  let res = null;
  if (has(g, 'perform')) res = await safe(() => g.perform(opts), null);
  if (res && typeof res.then === 'function') res = await res.catch((e) => { console.error(e); return null; });
  if (!res || !Number.isFinite(res.score)) {
    if (auto || g.auto) res = has(g, 'performSim') ? safe(() => g.performSim({ ...opts, power: powerOf(g), quality: qualityOf(g, neta) }), null) : null;
    else if (MINIGAMES.conte) res = await g.minigame('conte', { ...opts, difficulty: 2 + Math.round(venue.pressure / 30), skill: 'warai' });
    else if (MINIGAMES.tsukkomi) res = await g.minigame('tsukkomi', { difficulty: 2 + Math.round(venue.pressure / 30), skill: 'warai', title });
    if (!res || !Number.isFinite(res.score)) res = { score: simScore(g, { power: powerOf(g), quality: qualityOf(g, neta) }) };
  }
  const sc = clamp(Math.round(num(res.score, 50)), 0, 100);
  return { score: sc, rank: res.rank || 'B', laughs: num(res.laughs), big: num(res.big), flubs: num(res.flubs), blanks: num(res.blanks), overtime: num(res.overtime), adlib: num(res.adlib), heat: Array.isArray(res.heat) ? res.heat : [sc], parts: res.parts && typeof res.parts === 'object' ? res.parts : { neta: sc, execution: sc, presence: sc, timing: sc, crowd: sc }, comment: res.comment || '', highlights: Array.isArray(res.highlights) ? res.highlights : [] };
}

// Choose the conte for a round (B's ネタ帳; おまかせ: an auto script). exclude: ids already used this season (SF day 2).
async function chooseNeta(g, { y, rid, len, auto, exclude = [], prompt }) {
  let neta = null;
  if (!auto && has(g, 'pickNeta')) {
    neta = await safe(() => g.pickNeta({ kind: 'conte', length: len, title: prompt || `${titleOf(y)} ${roundName(rid)}のネタ` }), null);
    if (neta && typeof neta.then === 'function') neta = await neta.catch(() => null);
    if (neta && exclude.includes(neta.id)) { await g.say('（そのネタは、もう準決勝の1日目でやった。別のネタにしよう）'); neta = null; }
  }
  if (!neta && has(g, 'netaList')) {
    const list = (safe(() => g.netaList('conte'), []) || []).filter((n) => !exclude.includes(n.id));
    if (auto && list.length) neta = list.slice().sort((a, b) => qualityOf(g, b) - qualityOf(g, a))[0];
  }
  if (!neta) {
    const q = clamp(Math.round(powerOf(g) * 0.8 + 8), 10, 90);
    neta = has(g, 'autoNeta') ? safe(() => g.autoNeta('conte', q), null) : null;
    if (!neta) neta = { id: 'auto', kind: 'conte', title: 'おまかせのコント', setting: '', length: len, lines: [], ai: { total: q }, practice: q, uses: {}, auto: true };
    if (neta.id === 'auto' || !neta.id) neta = { ...neta, id: `auto_${y}_${rid}_${exclude.length}` };
    if (!auto && !g.auto) await g.say(`（ネタ帳から選ばなかったので、おまかせのコント『${neta.title || 'コント'}』でいく）`);
  }
  return neta;
}

// 楽屋での準備 (prep). Returns { bonus, risks, notes, cues, done: Set }
async function prepPhase(g, ctx) {
  const { y, rid, E, neta, auto, bd } = ctx;
  const slots0 = PREP_SLOTS[rid] || 3;
  let slots = slots0;
  const P = { bonus: 0, risks: { props: E.props === false ? 0 : 0.18, cue: 0.2, pos: rid === 'qf' || rid === 'sf' || rid === 'final' ? 0.22 : 0 }, notes: [], done: new Set(), cues: null };
  const set = setFor(neta);
  const canBata = rid !== 'r1' && rid !== 'r2';
  const opts = () => [
    { id: 'awase', label: 'ネタ合わせ（相方と）', ok: true },
    { id: 'keiko', label: '舞台裏で通し稽古', ok: true },
    { id: 'props', label: '小道具の搬入と確認', ok: E.props !== false && !P.done.has('props') },
    { id: 'cue', label: '音響・照明の打ち合わせ', ok: !P.done.has('cue') },
    { id: 'bata', label: '場当たり（立ち位置の確認）', ok: canBata && !P.done.has('bata') },
    { id: 'scout', label: '他の組のネタを袖から見る', ok: !P.done.has('scout') },
    { id: 'rest', label: '楽屋で休む', ok: true },
  ].filter((o) => o.ok);
  if (auto) {
    for (const id of ['props', 'cue', 'bata', 'awase']) { if (slots <= 0) break; const o = opts().find((x) => x.id === id); if (!o) continue; await doPrep(g, ctx, P, id, set, true); slots--; }
    return P;
  }
  while (slots > 0) {
    bd.merge({ caption: `${titleOf(y)} ${roundName(rid)}　楽屋　出番まで あと${slots}コマ` });
    const list = opts();
    const i = await g.ask(`出番まで、あと${slots}コマ。何をする？`, [...list.map((o) => o.label), '本番へ（準備おわり）'], { cancel: list.length });
    if (i < 0 || i >= list.length) break;
    await doPrep(g, ctx, P, list[i].id, set, false);
    slots--;
  }
  return P;
}
async function doPrep(g, ctx, P, id, set, auto) {
  const { y, rid, E, neta, bd } = ctx;
  const st = g.state;
  const pid = partnerIds(g, E)[0];
  P.done.add(id);
  if (id === 'awase') {
    if (neta && neta.id && !String(neta.id).startsWith('auto') && has(g, 'practiceNeta')) safe(() => g.practiceNeta(neta.id, 4));
    E.harm = num(E.harm) + 6;
    P.bonus += 0.6 + (E.instant ? 0.6 : 0);
    if (!E.instant && has(g, 'unitHarmony')) safe(() => g.unitHarmony(1, 'KOCの楽屋でネタ合わせ'));
    st.stamina = Math.max(0, st.stamina - 4);
    if (pid && has(g, 'addAff')) safe(() => g.addAff(pid, 1, true));
    if (!auto) {
      sfx('talk');
      await sayP(g, E, pickR(['ここの間、もう半拍ためてみよか。', 'オチ前のセリフ、もっと小さく入ったほうがええ気がする。', '大丈夫、いつも通りやれば絶対ウケる。', 'ツカミのとこだけ、もう一回合わせとこう。'], Math.random));
      await g.say(`（ネタ合わせをした。息が合ってきた！　仕上がり↑${E.instant ? '　即席ユニットの呼吸がそろってきた' : ''}）`);
    }
    P.notes.push('ネタ合わせ');
  } else if (id === 'keiko') {
    if (neta && neta.id && !String(neta.id).startsWith('auto') && has(g, 'practiceNeta')) safe(() => g.practiceNeta(neta.id, 3));
    P.bonus += 0.8;
    st.stamina = Math.max(0, st.stamina - 6);
    if (has(g, 'addNeed')) g.addNeed('stress', 3);
    if (!auto) await g.say('（非常階段の踊り場で、動きをつけて通し稽古。\n立ち位置と小道具の受け渡しを体に入れた）');
    P.notes.push('通し稽古');
  } else if (id === 'props') {
    const items = set.props.slice(0, 5).map((name) => ({ name, ok: false }));
    const missing = !auto && Math.random() < 0.28 ? Math.floor(Math.random() * items.length) : -1;
    if (missing >= 0) items[missing].missing = true;
    if (!auto) {
      const D = { title: `小道具の搬入と確認（${set.name}のコント）`, items, sel: 0, unitName: E.unitName };
      const prev = { id: bd.scene.id, data: bd.scene.data };
      bd.set('props', D);
      await g.say('段ボールから小道具を出して、ひとつずつ確認しよう。', { top: true });
      for (let guard = 0; guard < 20; guard++) {
        const i = await pickRows(g, { data: D, n: items.length + 1, rects: D.rects || [], auto: items.length, cancel: items.length, tapOutside: null });
        if (i < 0 || i >= items.length) break;
        const it = items[i];
        it.checked = true;
        if (it.missing) { it.ok = false; sfx('buzz'); } else { it.ok = true; sfx('ok'); }
      }
      const lost = items.find((x) => x.missing);
      const unchecked = items.filter((x) => !x.checked).length;
      if (lost && lost.checked) {
        const k = await g.ask(`${lost.name}が見当たらない！どうする？`, [`近くの店に買いに走る（${realYen(1500)}・1コマ）`, '段ボールで代用品をつくる', 'なしでやる（段取りを変える）'], { cancel: 2, top: true });
        if (k === 0 && st.money >= toInternal(1500)) { st.money -= toInternal(1500); P.risks.props = 0; await g.say(`（${lost.name}を買ってきた。ギリギリ間に合った！）`, { top: true }); }
        else if (k <= 1) { P.risks.props = 0; P.bonus -= 0.8; await g.say(`（段ボールとガムテープで${lost.name}をつくった。…遠目なら、まあ）`, { top: true }); }
        else { P.risks.props = 0; P.bonus -= 2.5; P.notes.push('props_lost'); await g.say('（なしでやることにした。段取りを頭の中で組み直す…）', { top: true }); }
      } else if (lost && !lost.checked) P.risks.props = 0.6;
      else P.risks.props = unchecked ? 0.08 * unchecked : 0;
      bd.set(prev.id, prev.data);
    } else P.risks.props = 0;
    P.notes.push('小道具確認');
  } else if (id === 'cue') {
    const ideal = idealCues(neta);
    const rows = CUE_ROWS.map((r) => ({ key: r.key, label: r.label, opts: r.opts, v: 0 }));
    if (!auto) {
      const D = { title: `音響・照明 きっかけ表（${roundName(rid)}）`, setName: `${set.name}のコント`, rows, sel: 0, hint: `${STAFF.onkyo.name}「SEは${set.se}ですね。明転と暗転のきっかけ、決めておきましょう」\n${STAFF.shoumei.name}「照明は${set.light}が合いそうです」` };
      const prev = { id: bd.scene.id, data: bd.scene.data };
      bd.set('cue', D);
      for (let guard = 0; guard < 30; guard++) {
        const i = await pickRows(g, { data: D, n: rows.length + 1, rects: D.rects || [], auto: rows.length, cancel: rows.length,
          onLeft: (s) => { if (rows[s]) rows[s].v = (rows[s].v + rows[s].opts.length - 1) % rows[s].opts.length; },
          onRight: (s) => { if (rows[s]) rows[s].v = (rows[s].v + 1) % rows[s].opts.length; } });
        if (i < 0 || i >= rows.length) break;
        rows[i].v = (rows[i].v + 1) % rows[i].opts.length;
      }
      bd.set(prev.id, prev.data);
    } else for (const r of rows) r.v = ideal[r.key];
    const match = rows.filter((r) => r.v === ideal[r.key]).length;
    P.cues = rows.map((r) => r.v);
    P.risks.cue = 0;
    P.bonus += (match - 3) * 0.8;
    if (!auto) {
      if (match >= 4) await g.say(`${STAFF.onkyo.name}「了解です。オチのところ、きっちり合わせます！」`, STAFF.onkyo);
      else if (match <= 2) await g.say(`${STAFF.onkyo.name}「…このネタだと、${CUE_ROWS.find((r) => rows.find((x) => x.key === r.key).v !== ideal[r.key]).label}は逆のほうが合うかもしれませんね。まあ、このままいきましょう」`, STAFF.onkyo);
      else await g.say(`${STAFF.onkyo.name}「はい、このきっかけでいきます」`, STAFF.onkyo);
    }
    P.notes.push('音響照明');
  } else if (id === 'bata') {
    P.risks.pos = 0;
    P.bonus += 1.2;
    if (!auto) {
      await g.say(`${STAFF.butai.name}「バミリはここと、ここ。センターで止まると照明の芯に入ります」`, STAFF.butai);
      await g.say('（舞台に上がって、立ち位置と出ハケの動線を確認した）');
    }
    P.notes.push('場当たり');
  } else if (id === 'scout') {
    if (!auto) {
      const f = ctx.field || [];
      const strong = f.slice().sort((a, b) => b.power - a.power).slice(0, 3);
      await g.say([`袖のモニターで、ほかの組のネタを見た。`, strong.length ? `とくにウケていたのは「${strong.map((x) => x.name).join('」「')}」…。\n${strong[0].tags && strong[0].tags.length ? `（${strong[0].tags.join('・')}）` : ''}` : '（どの組も、気合いが入っている）', `${ctx.odds != null ? `いまの自分たちの通過の見込み：およそ${Math.round(ctx.odds * 100)}%` : ''}`].filter(Boolean));
    }
    if (has(g, 'addComedyStat')) safe(() => g.addComedyStat('ma', 1, true));
    P.notes.push('偵察');
  } else if (id === 'rest') {
    st.stamina = Math.min(st.maxStamina || 100, st.stamina + 10);
    if (has(g, 'addNeed')) g.addNeed('stress', -6);
    if (!auto) await g.say('（楽屋のすみで目を閉じた。少し落ち着いた）');
  }
}

// Penalties on stage from the prep risks + the performance → { perf, reasons: [text], events: [text] }
function stageOutcome(g, ctx, P, res) {
  const { rid, len } = ctx;
  let perf = res.score + P.bonus;
  const reasons = [];
  const events = [];
  const rr = Math.random;
  if (P.risks.props && rr() < P.risks.props) { perf -= 5; reasons.push(PART_NOTES.props_lost); events.push('小道具トラブル'); }
  if (P.notes.includes('props_lost')) reasons.push(PART_NOTES.props_lost);
  if (P.risks.cue && rr() < P.risks.cue) { perf -= 3.5; reasons.push(PART_NOTES.cue); events.push('きっかけのずれ'); }
  if (P.risks.pos && rr() < P.risks.pos) { perf -= 2.5; reasons.push(PART_NOTES.position); events.push('立ち位置のずれ'); }
  const st = g.state;
  if (st.stamina < 25) { perf -= 3; events.push('疲れ'); }
  if (st.life && st.life.stress >= 70) { perf -= 3; events.push('ストレス'); }
  const dokyo = has(g, 'comedyStat') ? num(safe(() => g.comedyStat('dokyo'), 30)) : 30;
  perf -= Math.max(0, (ROUND_PRESSURE[rid] || 50) - dokyo - 30) * 0.05;
  const harmBase = ctx.E.instant ? 35 : harmonyOf(g, playerUnit(g));
  const harm = clamp(harmBase + num(ctx.E.harm), 0, 100);
  perf += (harm - 55) * 0.05;
  if (harm < 40) reasons.push(PART_NOTES.harmony);
  // C's g.perform already takes 尺オーバー / 噛み / 飛び off the score in a contest: here only the reasons (and the penalty
  // when the score came from a fallback without that model)
  const own = !has(g, 'perform');
  if (res.overtime > 0) {
    if (res.overtime > 30) { if (own) perf -= 15; reasons.push(PART_NOTES.cutoff(len)); events.push('強制暗転'); }
    else { if (own) perf -= res.overtime > 10 ? 6 : 2; reasons.push(PART_NOTES.overtime(Math.round(res.overtime), len)); }
  }
  if (res.flubs >= 2) reasons.push(PART_NOTES.flubs(res.flubs));
  if (res.blanks > 0) reasons.push(PART_NOTES.blanks);
  const used = K(g).netaUsed[ctx.neta && ctx.neta.id];
  if (Array.isArray(used) && used.some((yy) => yy < ctx.y)) { perf -= 2; reasons.push(PART_NOTES.fresh); }
  return { perf: clamp(Math.round(perf), 0, 100), reasons, events };
}
// Concrete 実力不足 reasons (A's shortfall + C's parts + the stage), at most 4.
function shortfallReasons(g, rid, res, extra) {
  const need = { r1: 35, r2: 50, qf: 62, sf: 72, final: 80 }[rid] || 50;
  const out = [];
  const sf = has(g, 'shortfall') ? safe(() => g.shortfall('conte', need), null) : null;
  if (sf && Array.isArray(sf.gaps)) for (const gp of sf.gaps.slice().sort((a, b) => (a.have - a.need) - (b.have - b.need)).slice(0, 2)) if (STAT_NOTES[gp.key]) out.push(`${STAT_NOTES[gp.key]}（${gp.label} ${gp.have}／目安${gp.need}）`);
  const parts = res.parts || {};
  if (num(parts.neta, 99) < need - 5 && !out.some((s) => s.includes('構成'))) out.push(STAT_NOTES.neta);
  if (num(parts.timing, 99) < need - 5) out.push(STAT_NOTES.ma);
  if (num(parts.crowd, 99) < need - 10) out.push(PART_NOTES.crowd);
  if (res.heat && res.heat.length > 3 && num(res.heat[0]) < 30) out.push(PART_NOTES.tsukami);
  for (const e of extra) if (!out.includes(e)) out.push(e);
  return out.slice(0, 4);
}

// One 予選 round (r1 / r2 / qf / sf day idx).
export async function runRound(g, y, rid, idx = 0, opts = {}) {
  const R = rules(y);
  const Y = yearRec(g, y);
  const E = Y.entry;
  if (!E) return;
  const st = g.state;
  const venue = rid === 'sf' ? schedule(y).sf[R.twoNetaSF ? idx : (E.sfPick ?? 0)] || planOf(g, y, E, rid) : planOf(g, y, E, rid);
  const city = venue.city;
  const fare = fareOf(homeRegion(g), city);
  const staminaNeed = 15 + (TRAVEL_STAMINA[city] || 2);
  const firstTime = !seenOnce(g, `round_${rid}`);
  const len = R.len[rid];
  // ready?
  const head = `${titleOf(y)} ${roundName(rid)}${rid === 'sf' && R.twoNetaSF ? `（${idx + 1}日目）` : ''}`;
  const go = await g.ask(`今日は『${head}』！\n${hallText(venue)}（${city}）。持ち時間${lenText(len)}。\n交通費 ${realYen(fare)}・体力 -${staminaNeed}`, ['会場へ向かう', 'やめておく（棄権する）'], { cancel: 1 });
  if (go !== 0) {
    const sure = await g.ask('本当に棄権する？（今年のキングオブコントはここで終わる）', ['やっぱり行く', '棄権する'], { cancel: 0 });
    if (sure === 1) { E.status = 'withdrawn'; E.out = rid; logRun(g, E, rid, `${roundName(rid)}を棄権した。`); await g.say('（棄権した…）'); return; }
  }
  if (st.money < toInternal(fare) + (E.feePaid ? 0 : toInternal(E.fee))) {
    await g.say(`お金が足りない…。（交通費${realYen(fare)}${E.feePaid ? '' : `＋エントリー料${realYen(E.fee)}`}）\n${fare > 1000 && city !== '東京' ? 'このままだと会場にたどり着けない。' : ''}`);
    if (city !== '東京' && fare > 1000) { const k = await g.ask('夜行バスなら安く行ける。どうする？', [`夜行バスで行く（${realYen(Math.round(fare / 3))}・体力 -10）`, '棄権する'], { cancel: 1 }); if (k !== 0 || st.money < toInternal(Math.round(fare / 3)) + (E.feePaid ? 0 : toInternal(E.fee))) { E.status = 'withdrawn'; E.out = rid; await g.say('（棄権した…）'); return; } st.money -= toInternal(Math.round(fare / 3)); st.stamina = Math.max(0, st.stamina - 10); }
    else { E.status = 'withdrawn'; E.out = rid; await g.say('（エントリー料が払えず、棄権した…）'); return; }
  } else st.money -= toInternal(fare);
  st.stamina = Math.max(0, st.stamina - (TRAVEL_STAMINA[city] || 2));
  if (st.stamina < 15) await g.say('（体はくたくただが、ここまで来たらやるしかない…）');
  let auto = opts.mode === 'auto' || !!g.auto;
  let quick = opts.mode === 'quick';
  if (!firstTime && !auto && !quick) { const k = await g.ask('今日の段取りは？', ['自分で準備する', '準備はおまかせ（本番は自分で）', 'おまかせで進める（結果まで）'], { cancel: 0 }); auto = k === 2; quick = k === 1; }
  const looks = looksOf(g, E);
  const others = Array.from({ length: 6 }, (_, i) => lookFor(`o:${y}:${rid}:${i}`));
  await g.fadeOut(10);
  const bd = pushSet(g, 'reception', { year: y, banner: `${titleOf(y)} 予選${roundName(rid)} ${hallText(venue)}`, feeText: feeText(), staff: STAFF.uketsuke.look, unit: looks, others });
  const field = rid === 'sf' ? blockField(g, y, 'sf', 'all', R.sfCount) : blockField(g, y, rid, `${venue.city}:${venue.when.join('-')}`, ROUND_SIZE[rid] || 80);
  if (rid === 'sf' && field.length >= R.sfCount) field.splice(R.sfCount - 1); // the player takes a semifinal slot
  const plan = roundPlan(y);
  const passShare = rid === 'r1' ? plan.passR1 : rid === 'r2' ? plan.passR2 : rid === 'qf' ? plan.passQF : plan.passSF;
  const passN = Math.max(1, Math.round((field.length + 1) * passShare));
  const odds = passOdds(g, field, passN, powerOf(g) - (E.instant ? 4 : 0), qualityOf(g, E.plannedNeta && has(g, 'neta') ? safe(() => g.neta(E.plannedNeta), null) : null));
  try {
    await g.fadeIn(10);
    // ---- 受付
    sfx('door');
    if (!auto) {
      if (firstTime && rid === 'r1') await g.say([`${hallText(venue)}に着いた。ロビーには、小道具の段ボールを抱えた芸人がずらり。`, 'プロもアマチュアも、学生も、即席ユニットも。\nみんな同じ2分で勝負する。'].map((s) => s.replace('2分', lenText(len))));
      await g.say(`エントリーナンバー${E.no}番、「${E.unitName}」さんですね。${E.feePaid ? '' : `\nエントリー料${realYen(E.fee)}をお願いします。`}`, STAFF.uketsuke);
    }
    if (!E.feePaid) { st.money = Math.max(0, st.money - toInternal(E.fee)); E.feePaid = true; sfx('coin'); }
    const block = String.fromCharCode(65 + (hashStr(`${E.no}:${rid}`) % 4));
    const order = 1 + (hashStr(`${E.no}:${rid}:o`) % Math.max(8, field.length));
    E.order = order;
    if (!auto) {
      await g.say(`${block}ブロック、出番は${order}番目です。番号札をどうぞ。\n楽屋は2階の大部屋です。`, STAFF.uketsuke);
      if (rid === 'r1' && !g.hasItem('koc_pass')) g.giveItem('koc_pass', 1, true);
      await g.say(`（今日の出場は${field.length + 1}組。通過の目安は${passN}組前後。\nいまの実力だと、通過の見込みはおよそ${Math.round(odds * 100)}%…）`);
    }
    // ---- 楽屋
    const orderBoard = [];
    for (let i = Math.max(1, order - 2); i < order + 4; i++) orderBoard.push(i === order ? { n: i, name: E.unitName, me: true } : { n: i, name: (field[(i * 7) % field.length] || {}).name || '—' });
    bd.set('gakuya', { unit: looks, others, order: orderBoard, boardTitle: `${block}ブロック 出番表`, monitorLook: others[0], caption: `${head}　楽屋` });
    if (!auto && firstTime) await sayP(g, E, rid === 'r1' ? '大部屋、ほんまに人だらけやな…。ネタ、もう一回確認しとこ。' : 'ここまで来たな。いつも通りいこう。');
    const exclude = rid === 'sf' && R.twoNetaSF && idx === 1 ? [E.netas.sf && E.netas.sf[0]].filter(Boolean) : [];
    let neta = await chooseNeta(g, { y, rid, len, auto, exclude, prompt: rid === 'sf' && R.twoNetaSF ? `準決勝${idx + 1}日目のネタ（決勝でも同じ2本を使う）` : undefined });
    const ctx = { y, rid, E, neta, auto: auto || quick, bd, field, odds, len };
    const P = await prepPhase(g, ctx);
    ctx.auto = auto;
    // ---- 舞台袖
    bd.set('sode', { unit: looks, staff: STAFF.butai.look, cue: true, label: `次：${E.no} ${E.unitName}` });
    if (!auto) {
      await g.say(`エントリーナンバー${E.no}、「${E.unitName}」さん、スタンバイお願いします。\n…暗転したら、板付きで。`, STAFF.butai);
      await sayP(g, E, pickR(['…いこか。', 'よし。楽しんでこう。', '客席、あったまってるで。', '練習通りな。'], Math.random));
    }
    // ---- 本番
    const set = setFor(neta);
    bd.set('stage', { light: 'dark', unit: looks, look: set.look, banner: `${titleOf(y)} ${roundName(rid)}`, darkText: '（暗転）' });
    sfx('drum');
    await g.wait(auto ? 50 : 500);
    bd.merge({ light: 'up' });
    sfx('chime');
    const res = await perform(g, { y, rid, neta, len, auto, venue: { name: hallText(venue), size: rid === 'r1' ? 'small' : 'theater', crowd: rid === 'r1' ? 'normal' : 'warm', pressure: ROUND_PRESSURE[rid] }, title: head });
    const out = stageOutcome(g, ctx, P, res);
    bd.merge({ heat: out.perf / 100, bounce: out.perf >= 65 });
    if (out.perf >= 70) sfx('laugh'); else if (out.perf >= 45) sfx('applause');
    await g.wait(auto ? 30 : 600);
    bd.merge({ light: 'dark', darkText: '（暗転）' });
    sfx('drum');
    await g.wait(auto ? 30 : 400);
    // bookkeeping after the stage
    st.stamina = Math.max(0, st.stamina - 15);
    if (has(g, 'lifeTick')) g.lifeTick({ hunger: -10, stress: 6, clean: -6 });
    if (has(g, 'addStageExp') && !has(g, 'perform')) safe(() => g.addStageExp('conte', 1, res)); // g.perform counts the stage itself
    if (has(g, 'markNetaUsed') && neta && neta.id && !String(neta.id).startsWith('auto')) safe(() => g.markNetaUsed(neta.id, 'koc'));
    const nu = K(g).netaUsed;
    if (neta && neta.id) { nu[neta.id] = Array.from(new Set([...(nu[neta.id] || []), y])).slice(-5); }
    E.netas[rid] = [...(E.netas[rid] || []), neta.id].slice(-2);
    if (rid === 'sf') { E.sfPerf = [...(E.sfPerf || []), out.perf]; E.netas.sfTitles = [...(E.netas.sfTitles || []), neta.title || 'コント'].slice(-2); E.netas.sfObjs = [...(E.netas.sfObjs || []), { id: neta.id, title: neta.title, setting: neta.setting || '', theme: neta.theme || '', ai: neta.ai || null, auto: !!neta.auto }].slice(-2); }
    E.doneDay = st.day;
    logRun(g, E, rid, `${roundName(rid)}${rid === 'sf' && R.twoNetaSF ? `${idx + 1}日目` : ''}（${hallText(venue)}）。コント『${neta.title || '無題'}』。${out.events.length ? out.events.join('・') + 'があった。' : ''}${out.perf >= 75 ? '客席は大きくわいた。' : out.perf >= 50 ? 'まずまずの反応だった。' : '笑いは少なかった。'}`);
    // SF day 1 of two: no result yet
    if (rid === 'sf' && R.twoNetaSF && idx === 0) {
      E.sfDone = 1;
      bd.set('gakuya', { unit: looks, others, order: [], boardTitle: '準決勝 2日目へ', caption: `${head}　終演後` });
      if (!auto) await sayP(g, E, out.perf >= 70 ? '1本目、ええ感じやった！明日の2本目で決めよう。' : '…明日の2本目で取り返そう。');
      return;
    }
    // ---- 結果発表
    const pass = await judgeRound(g, { y, rid, E, field, passN, out, res, auto, bd, venue, head, looks });
    void pass;
  } finally {
    await g.fadeOut(8);
    bd.pop();
    await g.fadeIn(8);
  }
}

// The cut and the results list; updates the entry. Returns true when passed.
async function judgeRound(g, { y, rid, E, field, passN, out, res, auto, bd, venue, head, looks }) {
  const R = rules(y);
  const st = g.state;
  const r = rngOf(hashStr(`${y}:${rid}:${E.no}:${st.day}`));
  const perf = rid === 'sf' && E.sfPerf && E.sfPerf.length ? Math.round(E.sfPerf.reduce((a, b) => a + b, 0) / E.sfPerf.length) : out.perf;
  const scored = field.map((f) => ({ ...f, no: entryNo(y, f.name), s: rid === 'sf' && R.twoNetaSF ? (simScore(g, { power: f.power, quality: f.quality, r }) + simScore(g, { power: f.power, quality: f.quality, r })) / 2 : simScore(g, { power: f.power, quality: f.quality, r }) }));
  scored.push({ name: E.unitName, no: E.no, s: perf + 0.01, me: true });
  scored.sort((a, b) => b.s - a.s);
  const place = scored.findIndex((x) => x.me) + 1;
  const passed = place <= passN;
  const result = { round: rid, score: perf, rank: res.rank, passed, place, of: scored.length, day: st.day };
  // revival (2026-): the semifinal losers ranked just below the finalists
  const revivalOK = rid === 'sf' && R.revival && !passed && place <= passN + 10;
  // ---- the results page (that evening)
  const rows = scored.slice(0, passN).map((x) => ({ no: x.no, name: x.name, pass: true, me: !!x.me })).sort((a, b) => a.no - b.no);
  if (!passed) rows.push({ no: E.no, name: E.unitName, pass: false, me: true });
  const nightLooks = looks;
  bd.set('night', { unit: nightLooks, glow: true });
  if (!auto) await g.say(rid === 'sf' ? (R.secret && passed ? '終演後、スタッフに別室へ呼ばれた…。' : '準決勝の結果発表を待つ…。') : `その夜、公式サイトに${roundName(rid)}の結果が出た。`);
  if (!(rid === 'sf' && R.secret && passed)) {
    const D = { title: `${titleOf(y)} ${roundName(rid)} 結果`, sub: `${hallText(venue)}　${dateText(y, venue.when)}　通過 ${passN}組／出場 ${scored.length}組`, rows, scroll: 0, legend: '赤い番号：通過' };
    await card(g, (c, t) => { D.scroll = Math.min(Math.max(0, rows.length - 36), Math.floor(t / 20) * 3); if (t > 50) D.verdict = { ok: passed, text: passed ? `${E.no} ${E.unitName}　通過！` : `${E.no}番の名前は…なかった` }; drawBoard(c, t, D); }, { min: 60 });
  }
  E.results.push(result);
  const k = K(g);
  const pid = partnerIds(g, E)[0];
  if (passed) {
    sfx('fanfare');
    const next = roundsOf(y)[roundsOf(y).indexOf(rid) + 1];
    E.round = next;
    E.sfDone = 0;
    E.harm = Math.max(0, num(E.harm) - 4);
    if (has(g, 'addNeed')) g.addNeed('stress', -8);
    if (pid && has(g, 'addAff')) safe(() => g.addAff(pid, 2, true));
    const rw = { r1: [3, 20], r2: [8, 80], qf: [30, 400], sf: [150, 2500] }[rid] || [5, 50];
    g.addFame(rw[0], true); g.addFans(rw[1], true);
    if (has(g, 'addComedyStat')) { safe(() => g.addComedyStat('act', 1, true)); safe(() => g.addComedyStat('dokyo', 1, true)); }
    logRun(g, E, rid, `${roundName(rid)}を通過（${place}位／${scored.length}組）。`);
    if (rid === 'sf') {
      E.status = 'finalist';
      k.stats.finals = num(k.stats.finals) + 1;
      k.stats.semis = num(k.stats.semis) + 1;
      g.setFlag('koc_finalist', true);
      await finalistNews(g, y, E, auto, bd);
    } else {
      if (!auto) await sayP(g, E, pickR(['通った…！次も、もっとウケさせよう。', 'よっしゃ！まだまだ行けるで！', '通過！…ネタ、もうちょっと詰めよう。'], r));
      await g.say(`${roundName(rid)}通過！\n次は${roundName(next)}：${datesOf(g, y, E, next).map((w) => dateText(y, w)).join('・')}　${hallText(planOf(g, y, E, next))}\n（知名度 +${rw[0]}・ファン +${rw[1]}）`);
      if (rid === 'qf') { k.stats.semis = num(k.stats.semis) + 1; news(g, NEWS.me.qfpass({ y, me: E.unitName })); }
      else if (rid === 'r1') news(g, NEWS.me.r1pass({ y, me: E.unitName }), { silent: true });
    }
    return true;
  }
  // ---- out
  E.out = rid;
  E.status = revivalOK ? 'revival' : 'out';
  if (rid === 'sf' && R.mode !== 'panel' && !revivalOK) { E.voter = true; E.status = 'voter'; }
  if (has(g, 'addNeed')) g.addNeed('stress', 4);
  if (pid && has(g, 'addAff')) safe(() => g.addAff(pid, 1, true));
  if (rid !== 'r1') { g.addFame(rid === 'sf' ? 60 : rid === 'qf' ? 15 : 4, true); g.addFans(rid === 'sf' ? 600 : rid === 'qf' ? 150 : 30, true); }
  const reasons = shortfallReasons(g, rid, res, out.reasons);
  E.reasons = reasons;
  result.reasons = reasons;
  logRun(g, E, rid, `${roundName(rid)}で敗退（${place}位／${scored.length}組。通過は${passN}組まで）。`);
  sfx('fail');
  if (!auto) {
    await sayP(g, E, pickR(['…あかんかったか。', 'くやしいな…。', '…また一から考えよう。'], r));
    await card(g, (c, t) => {
      RECT(c, 0, 0, SW, SH, '#101018');
      RECT(c, 0, 0, SW, 34, '#000');
      TXT(c, `${roundName(rid)}　寸評（スタッフのメモ）`, 14, 9, 13, KC.gold, 'left', 600);
      TXT(c, `${E.no} ${E.unitName}　${place}位／${scored.length}組（通過ライン ${passN}位）`, 20, 46, 13, KC.white, 'left', 600);
      reasons.forEach((s, i) => { RECT(c, 20, 76 + i * 56, 600, 48, '#1a1a26'); RECT(c, 20, 76 + i * 56, 3, 48, KC.red); const ls = s; TXT(c, ls.length > 44 ? ls.slice(0, 44) : ls, 32, 84 + i * 56, 13, KC.white, 'left', 580); if (ls.length > 44) TXT(c, ls.slice(44), 32, 102 + i * 56, 13, KC.white, 'left', 580); });
      if (!reasons.length) TXT(c, '（大きな欠点はない。ほかの組が、ほんの少しずつ上だった）', 32, 90, 13, KC.white, 'left', 580);
      TXT(c, `今回のスコアの目安：${perf}（通過ラインは${Math.round(scored[passN - 1].s)}前後）`, 20, 320, 12, KC.dim, 'left', 600);
    }, { min: 30 });
  }
  if (revivalOK) {
    await g.say(`準決勝敗退…。でも、${place}位。\n敗者復活戦（決勝の日の午後）に出られる！\n準決勝で敗れた25組のうち上位10組が、決勝の11組目を争う。`);
  } else if (E.status === 'voter') {
    await g.say(`準決勝敗退…。\nでも今年の決勝は、準決勝で敗れた芸人が審査する。\n${dateText(y, schedule(y).final.when)}、審査員としてTBSのスタジオに呼ばれた。`);
  } else await g.say(`${roundName(rid)}敗退…。今年のキングオブコントは、ここで終わった。\n${rid === 'r1' ? '（エントリーの大半は1回戦で姿を消す。ネタと演技を磨いて、また来年）' : '（また来年。ネタ帳を開こう）'}`);
  const best = K(g).stats.best;
  const order = { r1: 1, r2: 2, qf: 3, sf: 4, revival: 4.5, final: 5 };
  if (!best || order[rid] > order[best]) K(g).stats.best = rid;
  return false;
}

async function finalistNews(g, y, E, auto, bd) {
  const R = rules(y);
  const k = K(g);
  const first = !Object.values(k.hist).some((h) => h && h.me && h.me.reached === 'final' && h.me.unitId === E.unitId);
  const copy = playerCopy(g, y, E);
  E.copy = copy;
  K(g).stats.best = 'final';
  if (R.secret) {
    if (!auto) await g.say(['スタッフ「おめでとうございます。決勝進出です」', 'スタッフ「ただし今年は、ファイナリストを決勝の生放送で発表します。\nそれまでは家族にも、絶対に言わないでください」']);
    await sayP(g, E, '…言われへんの、つらすぎるやろ…！（小声）');
  } else {
    const S = season(g, y);
    const lineup = S.finalists.slice(0, R.finalists - 1).map((a) => ({ name: a.name, look: rivalLooks(a.name, a.type)[0] }));
    const pos = hashStr(`${y}:press`) % (lineup.length + 1);
    lineup.splice(pos, 0, { name: E.unitName, look: g.state.look, me: true });
    bd.set('press', { lineup, title: `${titleOf(y)} 決勝進出者発表` });
    sfx('fanfare');
    if (!auto) {
      await g.say(`『${titleOf(y)}』決勝進出は、この${R.finalists}組！`, { name: '司会', look: MC(y).sub.look });
      await g.say(`（フラッシュがまぶしい。名前を呼ばれて、前に出た）\n${E.unitName}、決勝進出！`);
      await sayP(g, E, first ? 'やった…ほんまに、決勝や…！' : 'また、ここに来られた。今年こそ。');
    }
  }
  news(g, NEWS.me.sfpass({ y, me: E.unitName, firstTime: first, copy }));
  logRun(g, E, 'sf', `決勝進出が決まった。キャッチコピーは「${copy}」。`);
  await g.say(`決勝は${dateText(y, schedule(y).final.when)}、TBS系で生放送！\n（知名度 +150・ファン +2,500）`);
}
function playerCopy(g, y, E) {
  const k = K(g);
  const tries = Object.values(k.hist).filter((h) => h && h.me && h.me.unitId === E.unitId).length;
  const firstLoss = Object.values(k.hist).find((h) => h && h.me && h.me.unitId === E.unitId && h.me.reached === 'r1');
  const yrs = has(g, 'unitYears') ? num(safe(() => g.unitYears(y), 0)) : 0;
  const r = rngOf(hashStr(`pcopy:${E.unitName}:${y}`));
  if (E.instant) return '即席ユニットの奇跡';
  if (!g.state.agency) return 'アマチュアの星';
  if (firstLoss && r() < 0.6) return '1回戦敗退から這い上がった';
  if (tries >= 4 && r() < 0.6) return `${tries + 1}度目の挑戦`;
  if (yrs >= 10) return `結成${yrs}年、ついに決勝`;
  if (yrs <= 2) return `結成${Math.max(1, yrs)}年目の衝撃`;
  return pickR(['誰も見たことのない入り口', 'コントの申し子', '日常をこじらせる天才', '静かなる狂気'], r);
}

// ================================================================ FINAL DAY (敗者復活戦 → 決勝 → 優勝発表 → after)
export async function runFinalDay(g, y, opts = {}) {
  const R = rules(y);
  const Y = yearRec(g, y);
  const E = Y.entry;
  const st = g.state;
  const role = E && E.status === 'finalist' ? 'finalist' : E && E.status === 'revival' ? 'revival' : E && E.status === 'voter' ? 'voter' : 'viewer';
  if (Y.final && Y.final.done) { await g.say('今年の決勝は、もう終わった。'); return; }
  const firstTime = !seenOnce(g, 'final_' + role);
  const go = await g.ask(role === 'viewer' ? `今夜は『${titleOf(y)}』決勝の生放送。テレビで見る？` : `今日は『${titleOf(y)}』${role === 'revival' ? '敗者復活戦と' : ''}決勝！\nTBS 赤坂のスタジオへ向かう？`, [role === 'viewer' ? '見る' : '向かう', 'やめておく'], { cancel: 1 });
  if (go !== 0) {
    if (role === 'finalist' || role === 'revival') { const s = await g.ask('出ないと、棄権になる。本当に行かない？', ['やっぱり行く', '行かない'], { cancel: 0 }); if (s === 1) { E.status = 'withdrawn'; await g.say('（棄権した…）'); return; } }
    else return;
  }
  const S = season(g, y);
  const rf = rngOf((K(g).seed ^ hashStr(`final:${y}`)) >>> 0);
  const mk = (a) => ({ id: a.id || null, name: a.name, type: a.type, agency: a.agency, power: a.power, quality: clamp(a.power + gauss(rf) * 5, 0, 100), looks: a.looks && a.looks.length ? a.looks : rivalLooks(a.name, a.type), copy: copyFor(g, a, y), act: a, me: false });
  let acts = S.finalists.map(mk);
  let digest = role === 'viewer' || role === 'voter';
  const me = role === 'finalist' || role === 'revival' ? { name: E.unitName, type: E.type, agency: st.agency ? g.fmt('{agency}') : 'アマチュア', me: true, looks: looksOf(g, E), copy: E.copy || playerCopy(g, y, E) } : null;
  if (role === 'finalist') { if (acts.length >= R.finalists) acts.pop(); acts.push(me); }
  const MCs = MC(y);
  const judges = judgesFor(g, y).map((j) => ({ ...j, short: j.name.split(' ')[0] }));
  await g.fadeOut(10);
  const bd = pushSet(g, 'tbsgakuya', { unit: me ? me.looks : [st.look], door: me ? `${me.name} 様` : '見学', caption: `${titleOf(y)} 決勝の日` });
  try {
    await g.fadeIn(10);
    if (role !== 'viewer' && role !== 'voter') {
      st.stamina = Math.max(0, st.stamina - 5);
      if (!digest && !firstTime) digest = (await g.ask('ほかの組のネタは？', ['ダイジェストで見る（自分の出番は全部）', 'すべて見る'], { cancel: 0 })) === 0;
    }
    if (role === 'viewer' && !firstTime) digest = true;
    // ---- 敗者復活戦 (2026-)
    let revivalWinner = null;
    if (R.revival) {
      const pool0 = S.revivalPool.map(mk);
      if (role === 'revival') { pool0.pop(); pool0.unshift(me); }
      const forced = role !== 'revival' && S.revivalWinner ? pool0.find((a) => a.id && a.id === S.revivalWinner.id) || null : null;
      revivalWinner = await revivalStage(g, y, R, pool0, role, E, bd, rf, digest, forced);
      if (revivalWinner) acts.push(revivalWinner);
      if (role === 'revival') {
        if (revivalWinner && revivalWinner.me) { E.status = 'finalist'; K(g).stats.finals = num(K(g).stats.finals) + 1; news(g, NEWS.me.revival({ y, me: E.unitName })); logRun(g, E, 'revival', '敗者復活戦を勝ち上がり、11組目のファイナリストになった。'); }
        else { E.status = 'out'; logRun(g, E, 'revival', '敗者復活戦で敗れた。'); await g.say('敗者復活ならず…。\n決勝は、楽屋のモニターで見届けることにした。'); digest = true; }
      }
    }
    const playerIn = acts.some((a) => a.me);
    // this world's acts perform in the order of their strength
    precomputeNPC(g, { R, judges, rf }, acts, S.rank);
    // ---- 出番順（抽選）
    const order = acts.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rf() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (revivalWinner) { const i = order.indexOf(revivalWinner); order.splice(i, 1); order.splice(Math.floor(rf() * (order.length + 1)), 0, revivalWinner); }
    if (playerIn && !digest) {
      bd.merge({ visitor: STAFF.ad.look });
      await g.say(`本日の出番順です。抽選の結果、${order.findIndex((a) => a.me) + 1}番目になります。\nリハーサル、本番の流れ、よろしくお願いします！`, STAFF.ad);
      await sayP(g, E, pickR(['…足、震えてるわ。', 'ここまで来たら、楽しんだもん勝ちや。', R.twoNetaSF ? '準決勝と同じ2本、いつも通りやろう。' : '2本目のネタまで、きっちりやり切ろう。'], rf));
      bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges: [], view: 'stage', unit: me.looks, look: 'office', screen: ['リハーサル'] });
      await g.say('（昼、スタジオでカメラリハーサル。\nセットの立て込み、立ち位置、暗転と明転のきっかけ、カメラの動きをひとつずつ確認した）');
      bd.set('tbsgakuya', { unit: me.looks, door: `${me.name} 様`, caption: `${titleOf(y)} 決勝の日` });
    }
    // ---- オープニング
    bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges, screen: [`KOC${y}`, `第${R.edition}回`, 'LIVE'], onair: true });
    sfx('fanfare');
    if (!digest || firstTime) {
      await card(g, (c, t) => drawTitle(c, t, { year: y, big: `第${R.edition}回 ${KOC_NAME} 決勝`, small: `${R.oowarai ? 'TBS「お笑いの日」' : 'TBS系'} 生放送\n${R.judgeText}\n${R.finalText}` }), { min: 30 });
    }
    await g.say(`${titleOf(y)}！コント日本一、${R.entries.approx ? '約' : ''}${R.entries.n.toLocaleString('ja-JP')}組の頂点に立つのは、どのユニットか！`, { name: MCs.main.name, look: MCs.main.look });
    if (R.mode === 'panel') await g.say(`審査員は、${judges.map((j) => j.name).join('、')}のみなさんです！`, { name: MCs.sub.name, look: MCs.sub.look });
    else await g.say(`審査するのは、準決勝で敗れた芸人${R.voters}人！${R.mode === 'league' ? 'ひとり5点満点です。' : R.mode === 'sum2' ? 'ひとり10点満点、無記名で採点します。' : '「どちらが面白かったか」を投票します。'}`, { name: MCs.sub.name, look: MCs.sub.look });
    if (R.secret) {
      // ファイナリストシークレット制度 (2018-2019): the finalists are named for the first time on air
      bd.set('press', { lineup: order.map((a) => ({ name: a.name, look: (a.looks || [])[0], me: !!a.me })), title: `${titleOf(y)} ファイナリスト発表（生放送）` });
      sfx('fanfare');
      await g.say('今年はファイナリストシークレット制度。\n決勝に進んだ10組を、いま、この生放送で初めて発表します！', { name: MCs.main.name, look: MCs.main.look });
      if (playerIn) await sayP(g, E, 'やっと言える…！家族にも黙ってたんやから。');
      bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges, screen: [`KOC${y}`, `第${R.edition}回`, 'LIVE'], onair: true });
    }
    let rows;
    const ctx = { y, R, E, bd, judges, MCs, order, rf, digest, role };
    if (R.mode === 'panel') rows = await finalPanel(g, ctx);
    else if (R.mode === 'sum2') rows = await finalSum2(g, ctx);
    else if (R.mode === 'league') rows = await finalLeague(g, ctx);
    else rows = await finalDuel(g, ctx);
    // ---- 優勝発表
    const champ = rows[0];
    bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges, screen: ['優勝は…'], onair: true, view: 'wide', unit: [] });
    await g.say(`第${R.edition}代キングオブコント王者は…`, { name: MCs.main.name, look: MCs.main.look });
    for (let i = 0; i < (g.auto ? 1 : 10); i++) { sfx('snare'); await g.wait(70); }
    sfx('fanfare');
    g.shake(14, 2);
    await card(g, (c, t) => drawWinner(c, t, { name: champ.name, title: `第${R.edition}代 キングオブコント王者`, sub: champ.total != null ? `${R.mode === 'duel' ? '勝ち残り' : R.mode === 'league' ? `最終決戦 ${champ.votes}票` : `合計 ${champ.total}点`}` : '', looks: champ.looks }), { min: 60 });
    const meRow = rows.findIndex((x) => x.me);
    const result = finishFinal(g, y, rows, meRow);
    if (champ.me) await championScene(g, y, E, champ, bd, MCs);
    else if (meRow >= 0) {
      sfx('applause');
      await g.say(`${champ.name}、おめでとう！`, { name: MCs.main.name, look: MCs.main.look });
      await sayP(g, E, meRow === 1 ? '…あと一歩やった。来年や。来年、絶対獲ろ。' : '負けた…でも、決勝の景色は見れた。');
      await g.say(`${meRow + 1}位／${rows.length}組。\n${meRow < 3 ? '王者まで、あと少しだった…！' : '王者の背中は、まだ遠い。'}`);
    } else {
      await g.say(`${champ.name}が第${R.edition}代王者に！${role === 'voter' ? '\n（審査員の一人として、歴史の瞬間に立ち会った）' : ''}`);
    }
    // ---- after
    if (meRow >= 0) await afterShow(g, y, E, rows, bd, meRow);
    Y.final = { done: true, champ: champ.name, me: meRow >= 0 ? meRow + 1 : null };
    void result;
  } finally {
    await g.fadeOut(8);
    bd.pop();
    await g.fadeIn(8);
  }
}

// one act on the final stage: PV + catchcopy, the conte, the score. Returns { perf, scores, total }
async function finalAct(g, ctx, a, stage) {
  const { y, R, E, bd, judges, MCs, rf, digest } = ctx;
  const mine = !!a.me;
  const yrs = mine ? (has(g, 'unitYears') ? num(safe(() => g.unitYears(y), 0)) : 0) : Math.max(0, y - num(a.act && a.act.formed, y));
  const sub = mine ? `エントリーNo.${E.no}　${a.agency || ''}　${E.instant ? '即席ユニット' : yrs > 0 ? `結成${yrs}年目` : '今年結成'}` : `${a.agency || ''}${a.type === 'trio' ? '・トリオ' : ''}　${yrs > 0 ? `結成${yrs}年目` : '結成1年目'}`;
  if (!digest || mine) await card(g, (c, t) => drawPV(c, t, { copy: a.copy, name: a.name, sub: `${sub}${stage === 2 ? '　2本目' : ''}`, looks: a.looks, me: mine }), { min: mine ? 40 : 24, life: mine ? 0 : 200 });
  let perf;
  let res = null;
  let reasons = [];
  if (mine) {
    const S = schedule(y);
    const sfObjs = (E.netas && E.netas.sfObjs) || [];
    let neta;
    if (R.twoNetaSF && sfObjs.length >= 2) {
      const pickIdx = stage === 1 ? (g.auto ? 0 : await g.ask('1本目にどちらのネタをやる？（準決勝と同じ2本）', sfObjs.map((n) => `『${n.title || 'コント'}』`), { cancel: 0 })) : 1 - (E.finalFirst ?? 0);
      if (stage === 1) E.finalFirst = Math.max(0, pickIdx);
      const ref = sfObjs[Math.max(0, pickIdx)];
      neta = (has(g, 'neta') && ref.id && !ref.auto ? safe(() => g.neta(ref.id), null) : null) || { ...ref, kind: 'conte' };
    } else neta = await chooseNeta(g, { y, rid: 'final', len: R.len.final, auto: !!g.auto, exclude: stage === 2 ? [E.finalNeta1].filter(Boolean) : [], prompt: `決勝 ${stage}本目のネタ` });
    if (stage === 1) E.finalNeta1 = neta.id;
    bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges, view: 'dark', unit: a.looks, look: setFor(neta).look, onair: true, screen: [a.name] });
    if (stage === 1) await sayP(g, E, 'いくで。');
    sfx('drum');
    await g.wait(g.auto ? 30 : 600);
    bd.merge({ view: 'stage' });
    const P = { bonus: 1.5, risks: { props: 0, cue: 0, pos: 0 }, notes: [] }; // the final has a full rehearsal
    res = await perform(g, { y, rid: 'final', neta, len: R.len.final, auto: false, venue: { name: 'TBS 決勝スタジオ', size: 'tv', crowd: 'warm', pressure: ROUND_PRESSURE.final }, title: `${titleOf(y)} 決勝 ${stage}本目` });
    const out = stageOutcome(g, { y, rid: 'final', E, neta, len: R.len.final }, P, res);
    perf = out.perf;
    reasons = out.reasons;
    E.finalPerfs = [...(E.finalPerfs || []), perf].slice(-2);
    if (perf >= 75) sfx('laugh'); else sfx('applause');
    await g.wait(g.auto ? 20 : 500);
    bd.merge({ view: 'dark' });
    await g.wait(g.auto ? 20 : 300);
    logRun(g, E, 'final', `決勝${stage}本目『${neta.title || 'コント'}』。${perf >= 85 ? 'スタジオが揺れるほどの爆笑。' : perf >= 70 ? '大きな笑いが起きた。' : '思ったほどウケなかった。'}`);
    st0(g).stamina = Math.max(0, st0(g).stamina - 12);
  } else {
    perf = a.pre ? a.pre[stage - 1] : simScore(g, { power: a.power, quality: stage === 2 ? clamp(a.quality - 3 + gauss(rf) * 4, 0, 100) : a.quality, r: rf, pressure: 95 });
    if (!digest) {
      bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges, view: 'stage', unit: a.looks, look: setFor({ title: a.name + stage }).look, onair: true, screen: [a.name] });
      const title = CONTE_TITLES[hashStr(`${a.name}:${y}:${stage}`) % CONTE_TITLES.length];
      sfx(perf >= 75 ? 'laugh' : 'applause');
      await g.say(`${a.name}のコント『${title}』。\n${perf >= 85 ? 'スタジオが揺れるほどの爆笑！' : perf >= 72 ? '大きな笑いが何度も起きた。' : perf >= 60 ? 'じわじわと笑いが広がった。' : '前半は静かな時間が続いた…。'}`);
    }
  }
  // the judges' taste reads the parts of this performance (a test's forced score has no parts of its own)
  a.parts = res && !(g.auto && Number.isFinite(g.auto.performScore)) ? res.parts : null;
  return { perf, reasons };
}
const st0 = (g) => g.state;

// The acts of this world get their performances and scores before the broadcast, strongest first (rank: Map id → place when
// given, else by power). The player is not touched: their result is live.
function precomputeNPC(g, ctx, acts, rankMap) {
  const { R, judges, rf } = ctx;
  const npcs = acts.filter((a) => !a.me);
  const rk = (a) => (a.id && rankMap && rankMap.has(a.id) ? rankMap.get(a.id) : 50 + (100 - num(a.power, 50)));
  const ord = npcs.slice().sort((a, b) => rk(a) - rk(b));
  // the night's best acts land around 90-94 in every era (the first seasons have every strong act of the time in them): above 90
  // a performance counts half, so a near-perfect night (95+) is what wins it
  const cap = (p) => (p > 90 ? Math.round(90 + (p - 90) * 0.5) : p);
  const perfs = (q) => ord.map((a) => cap(simScore(g, { power: a.power, quality: q(a), r: rf, pressure: 95 }))).sort((x, z) => z - x);
  const p1 = perfs((a) => a.quality), p2 = perfs((a) => clamp(a.quality - 3 + gauss(rf) * 4, 0, 100));
  ord.forEach((a, i) => { a.pre = [p1[i], p2[i]]; a.rk = i + 1; });
  const sum = (arr) => arr.reduce((t, v) => t + v, 0);
  if (R.mode === 'panel') {
    for (const k of [0, 1]) { const sets = ord.map((a) => judges.map((j) => judgePoints(R, a.pre[k], j, null, rf))).sort((x, z) => sum(z) - sum(x)); ord.forEach((a, i) => { (a.pts || (a.pts = []))[k] = sets[i]; }); }
  } else if (R.mode === 'sum2' || R.mode === 'league') {
    for (const k of [0, 1]) { const v = ord.map((a) => crowdPoints(R, a.pre[k], rf)).sort((x, z) => z - x); ord.forEach((a, i) => { (a.cp || (a.cp = []))[k] = v[i]; }); }
  }
}
async function showPanelScore(g, ctx, a, perf, stage) {
  const { y, R, judges, rf, digest } = ctx;
  const pts = !a.me && a.pts && a.pts[stage - 1] ? a.pts[stage - 1] : judges.map((j) => judgePoints(R, perf, j, a.me ? a.parts : null, rf));
  const total = pts.reduce((s, v) => s + v, 0);
  if (!digest || a.me) {
    const D = { title: `${titleOf(y)} 決勝 ${stage === 2 ? 'ファイナルステージ' : 'ファーストステージ'}`, name: a.name, cells: judges.map((j, i) => ({ label: j.name, v: pts[i], shown: false })), total: null, max: R.max };
    await card(g, (c, t) => { const n = Math.min(D.cells.length, Math.floor(t / 22)); D.cells.forEach((cl, i) => { cl.shown = i < n; }); if (n >= D.cells.length) D.total = total; if (t % 22 === 1 && n < D.cells.length) sfx('snare'); drawScore(c, t, D); }, { min: 22 * judges.length + 20 });
    if (a.me) {
      const hi = judges[pts.indexOf(Math.max(...pts))], lo = judges[pts.indexOf(Math.min(...pts))];
      await g.say(`${hi.name}「${perf >= 80 ? '設定の入り口から最後まで、ずっと面白かった。' : 'ボケの発想はすごく好きでした。'}」`, { name: hi.name, look: hi.look });
      if (lo !== hi) await g.say(`${lo.name}「${perf >= 80 ? '後半、もう一段階上がると思ったんですけどね。' : '前半の説明が長くて、笑いが来るまで時間がかかった。'}」`, { name: lo.name, look: lo.look });
    }
  }
  return { pts, total };
}

// 2015-: 審査員5人（2026- 7人）×100点. 1st stage → top N → final stage (low first) → total
async function finalPanel(g, ctx) {
  const { R, order, y, MCs } = ctx;
  const rows = [];
  for (const a of order) {
    const { perf } = await finalAct(g, ctx, a, 1);
    const sc = await showPanelScore(g, ctx, a, perf, 1);
    rows.push({ ...a, s1: sc.total, total: sc.total });
    rows.sort((p, q) => q.s1 - p.s1);
    if (!ctx.digest || a.me) await card(g, (c, t) => drawRanking(c, t, { title: `ファーストステージ 暫定順位（上位${R.finalStage}組がファイナルステージ）`, rows: rows.map((x) => ({ name: x.name, score: x.s1, me: x.me, cur: x === rows.find((z) => z.name === a.name) })), line: R.finalStage }), { min: 20 });
  }
  const top = rows.slice(0, R.finalStage);
  await card(g, (c, t) => drawRanking(c, t, { title: `ファイナルステージ進出 ${R.finalStage}組`, rows: rows.map((x) => ({ name: x.name, score: x.s1, me: x.me })), line: R.finalStage, sub: 'ファイナルステージは、1本目の得点が低い順に2本目を披露' }), { min: 30 });
  if (rows.findIndex((x) => x.me) >= R.finalStage && rows.some((x) => x.me)) await g.say('ファイナルステージには、届かなかった…。', { name: MCs.main.name, look: MCs.main.look });
  const fs = top.slice().reverse();
  for (const a of fs) {
    const { perf } = await finalAct(g, ctx, a, 2);
    const sc = await showPanelScore(g, ctx, a, perf, 2);
    a.s2 = sc.total; a.total = a.s1 + a.s2;
    if (!ctx.digest || a.me) await card(g, (c, t) => drawRanking(c, t, { title: 'ファイナルステージ 合計点', rows: top.slice().sort((p, q) => num(q.total) - num(p.total)).map((x) => ({ name: x.name, score: x.s2 != null ? `${x.s1}+${x.s2}=${x.total}` : `${x.s1}+？`, me: x.me, cur: x === a })) }), { min: 20 });
  }
  top.sort((p, q) => q.total - p.total);
  void y;
  return [...top, ...rows.slice(R.finalStage).map((x) => ({ ...x, total: x.s1 }))];
}
// 2009-2013: 100人×10点, 8組が2本ずつ, 2本目は1本目の低い順, 合計
async function finalSum2(g, ctx) {
  const { R, order, rf } = ctx;
  const rows = [];
  for (const a of order) {
    const { perf } = await finalAct(g, ctx, a, 1);
    const s1 = !a.me && a.cp ? a.cp[0] : crowdPoints(R, perf, rf);
    a.s1 = s1;
    rows.push(a);
    a.total = s1;
    await crowdCard(g, ctx, a, s1, 1);
  }
  const second = rows.slice().sort((p, q) => p.s1 - q.s1);
  for (const a of second) {
    const { perf } = await finalAct(g, ctx, a, 2);
    a.s2 = !a.me && a.cp ? a.cp[1] : crowdPoints(R, perf, rf); a.total = a.s1 + a.s2;
    await crowdCard(g, ctx, a, a.s2, 2, a.total);
  }
  rows.sort((p, q) => q.total - p.total);
  await card(g, (c, t) => drawRanking(c, t, { title: '最終結果（2本の合計・1000点×2）', rows: rows.map((x) => ({ name: x.name, score: `${x.s1}+${x.s2}=${x.total}`, me: x.me })), line: 1 }), { min: 30 });
  return rows;
}
async function crowdCard(g, ctx, a, pts, stage, total) {
  const { y, R, digest } = ctx;
  if (digest && !a.me) return;
  const D = { title: `${titleOf(y)} 決勝 ${stage}本目　準決勝敗退者${R.voters}人の採点`, name: a.name, cells: [{ label: `${R.voters}人の合計`, v: 0, shown: true }], total: null, max: R.max, sub: total != null ? `2本の合計 ${total}点` : '' };
  await card(g, (c, t) => { D.cells[0].v = Math.min(pts, Math.round((pts * t) / 60)); if (t >= 60) D.total = pts; if (t % 6 === 0 && t < 60) sfx('cursor'); drawScore(c, t, D); }, { min: 70 });
}
// 2008: A・Bリーグ（100人×5点）→ 各リーグ1位が最終決戦 → 決勝進出8組の口頭発表
async function finalLeague(g, ctx) {
  const { R, order, rf, MCs } = ctx;
  const A = order.filter((_, i) => i % 2 === 0), B = order.filter((_, i) => i % 2 === 1);
  for (const [lg, list] of [['Aリーグ', A], ['Bリーグ', B]]) {
    await g.say(`${lg}、スタート！`, { name: MCs.main.name, look: MCs.main.look });
    for (const a of list) { const { perf } = await finalAct(g, ctx, a, 1); a.s1 = !a.me && a.cp ? a.cp[0] : crowdPoints(R, perf, rf); a.total = a.s1; await crowdCard(g, ctx, a, a.s1, 1); }
    list.sort((p, q) => q.s1 - p.s1);
    await card(g, (c, t) => drawRanking(c, t, { title: `${lg} 結果（500点満点）`, rows: list.map((x) => ({ name: x.name, score: x.s1, me: x.me })), line: 1 }), { min: 24 });
  }
  const a = A[0], b = B[0];
  await g.say(`最終決戦は「${a.name}」対「${b.name}」！`, { name: MCs.main.name, look: MCs.main.look });
  const pa = (await finalAct(g, ctx, a, 2)).perf;
  const pb = (await finalAct(g, ctx, b, 2)).perf;
  let va = finalistVote(pa, pb, rf);
  let tie = false;
  if (va === 4) { tie = true; va += rf() < (pa >= pb ? 0.65 : 0.35) ? 1 : -1; }
  if (!a.me && !b.me && Number.isFinite(a.rk) && Number.isFinite(b.rk) && (a.rk < b.rk) !== (va > 4)) va = 8 - va; // this world's result
  const votes = Array.from({ length: 8 }, (_, i) => (i < va ? a.name : b.name));
  for (let i = votes.length - 1; i > 0; i--) { const j = Math.floor(rf() * (i + 1)); [votes[i], votes[j]] = [votes[j], votes[i]]; }
  await card(g, (c, t) => { const n = Math.min(8, Math.floor(t / 20)); drawRanking(c, t, { title: '最終決戦　決勝進出8組がひとりずつ口頭で発表', rows: votes.slice(0, n).map((v, i) => ({ name: `${i + 1}人目：「${v}」`, score: '', me: (v === a.name ? a : b).me })) }); }, { min: 180 });
  if (tie) await g.say('（4対4の同点！準決勝進出者による決選投票で決着…）');
  const win = va > 4 ? a : b, lose = win === a ? b : a;
  win.votes = Math.max(va, 8 - va); lose.votes = 8 - win.votes;
  const rest = order.filter((x) => x !== a && x !== b).sort((p, q) => q.s1 - p.s1);
  return [win, lose, ...rest];
}
// 2014: 1対1（101人の投票）→ ファイナルステージは勝ち残り
async function finalDuel(g, ctx) {
  const { R, order, rf, MCs } = ctx;
  const winners = [];
  for (let i = 0; i < order.length; i += 2) {
    const A = order[i], B = order[i + 1];
    if (!B) { winners.push(A); continue; }
    await g.say(`第${i / 2 + 1}ブロック：「${A.name}」対「${B.name}」`, { name: MCs.main.name, look: MCs.main.look });
    const pa = (await finalAct(g, ctx, A, 1)).perf, pb = (await finalAct(g, ctx, B, 1)).perf;
    let v = duelVotes(R, pa, pb, rf);
    if (!A.me && !B.me && Number.isFinite(A.rk) && Number.isFinite(B.rk) && (A.rk < B.rk) !== (v > R.voters - v)) v = R.voters - v;
    A.s1 = v; B.s1 = R.voters - v;
    const w = v > B.s1 ? A : B;
    winners.push(w);
    if (!ctx.digest || A.me || B.me) await card(g, (c, t) => drawRanking(c, t, { title: `第${i / 2 + 1}ブロック 準決勝敗退者101人の投票`, rows: [{ name: A.name, score: Math.min(A.s1, Math.round((A.s1 * t) / 60)), me: A.me, cur: w === A }, { name: B.name, score: Math.min(B.s1, Math.round((B.s1 * t) / 60)), me: B.me, cur: w === B }], line: 1 }), { min: 70 });
  }
  await g.say('ファイナルステージは勝ち残り方式。暫定王者に、次の組が挑む！', { name: MCs.main.name, look: MCs.main.look });
  let king = null;
  const losers = [];
  for (const x of winners) {
    x.p2 = (await finalAct(g, ctx, x, 2)).perf;
    if (!king) { king = x; continue; }
    let v = duelVotes(R, x.p2, king.p2, rf);
    if (!x.me && !king.me && Number.isFinite(x.rk) && Number.isFinite(king.rk) && (x.rk < king.rk) !== (v > R.voters - v)) v = R.voters - v;
    const newKing = v > R.voters - v ? x : king;
    if (!ctx.digest || x.me || king.me) await card(g, (c, t) => drawRanking(c, t, { title: '暫定王者への挑戦（101人の投票）', rows: [{ name: x.name, score: v, me: x.me, cur: newKing === x }, { name: `暫定王者 ${king.name}`, score: R.voters - v, me: king.me, cur: newKing === king }], line: 1 }), { min: 30 });
    losers.unshift(newKing === x ? king : x);
    king = newKing;
  }
  king.total = '勝ち残り';
  return [king, ...losers, ...order.filter((x) => !winners.includes(x))];
}

// 敗者復活戦 (2026-): 10組 → 芸人審査員60人の採点で3組 → 国民投票で1組
async function revivalStage(g, y, R, pool0, role, E, bd, rf, digest, forced = null) {
  const MCs = MC(y);
  bd.set('revival', { title: `${titleOf(y)} 敗者復活戦`, bars: [], unit: [], acts: pool0.map((a) => a.name) });
  if (role === 'revival' || !digest) await g.say(`午後2時、敗者復活戦。準決勝で敗れた25組のうち、上位10組が決勝の残り1枠を争う！`, { name: MCs.revival.name, look: MCs.revival.look });
  const scored = [];
  for (const a of pool0) {
    let perf;
    if (a.me) {
      bd.set('revival', { title: '敗者復活戦', bars: [], unit: a.looks });
      await sayP(g, E, '最後のチャンスや。全部出そう。');
      const neta = await chooseNeta(g, { y, rid: 'revival', len: R.len.final, auto: !!g.auto, prompt: '敗者復活戦のネタ' });
      const res = await perform(g, { y, rid: 'revival', neta, len: R.len.final, auto: false, venue: { name: '敗者復活戦の会場', size: 'hall', crowd: 'warm', pressure: ROUND_PRESSURE.revival }, title: `${titleOf(y)} 敗者復活戦` });
      perf = stageOutcome(g, { y, rid: 'revival', E, neta, len: R.len.final }, { bonus: 0.5, risks: { props: 0.05, cue: 0.05, pos: 0 }, notes: [] }, res).perf;
    } else perf = simScore(g, { power: a.power, quality: a.quality, r: rf, pressure: 90 });
    const pts = Array.from({ length: R.revivalJudges }, () => clamp(Math.round(2 + perf * 0.075 + gauss(rf) * 1.4), 1, 10)).reduce((s, v) => s + v, 0);
    scored.push({ ...a, rp: pts, perf });
  }
  // a winner fixed beforehand (forced): the judges put them in the top 3 (the vote below puts them first)
  const fs0 = forced ? scored.find((x) => x.id && x.id === forced.id) : null;
  if (fs0) { const third = scored.filter((x) => x !== fs0).map((x) => x.rp).sort((p, q) => q - p)[2] ?? 0; if (fs0.rp <= third) fs0.rp = third + 1 + Math.floor(rf() * 6); }
  scored.sort((p, q) => q.rp - p.rp);
  const top3 = scored.slice(0, 3);
  if (role === 'revival' || !digest) await card(g, (c, t) => drawRanking(c, t, { title: `芸人審査員${R.revivalJudges}人の採点（上位3組が国民投票へ）`, rows: scored.map((x) => ({ name: x.name, score: x.rp, me: x.me })), line: 3 }), { min: 30 });
  // 国民投票: performance + popularity (the player's fans count a little)
  const fansK = clamp(Math.log10(Math.max(10, num(g.state.fans))) / 6, 0, 1);
  const w = top3.map((x) => Math.max(0.05, x.perf / 100 + (x.me ? fansK * 0.25 : rf() * 0.2)));
  const sum = w.reduce((s, v) => s + v, 0);
  const shares = w.map((v) => v / sum);
  let wi = shares.indexOf(Math.max(...shares));
  const fi = fs0 ? top3.indexOf(fs0) : -1;
  if (fi >= 0) { const mx = Math.max(...shares); if (shares[fi] < mx) { const j = shares.indexOf(mx); [shares[fi], shares[j]] = [shares[j], shares[fi]]; } wi = fi; }
  if (role === 'revival' || !digest) {
    await card(g, (c, t) => { const k = Math.min(1, t / 90); const bars = top3.map((x, i) => ({ name: x.name, v: shares[i] * k, me: x.me, label: `${Math.round(shares[i] * k * 100)}%` })); drawRevivalBars(c, t, bars, y); }, { min: 110 });
  }
  const winner = top3[wi];
  if (role === 'revival' || !digest) await g.say(`国民投票の結果、決勝に進むのは…「${winner.name}」！`, { name: MCs.revival.name, look: MCs.revival.look });
  news(g, `『${titleOf(y)}』敗者復活戦は「${winner.name}」が国民投票を制し、11組目のファイナリストに。`, { silent: true });
  return { ...winner, copy: winner.me ? (E.copy || '敗者復活の意地') : '敗者復活の意地' };
}
function drawRevivalBars(c, t, bars, y) {
  RECT(c, 0, 0, SW, SH, '#0c0c18');
  RECT(c, 40, 40, 560, 220, '#101a3a');
  TXT(c, `${titleOf(y)} 敗者復活戦　国民投票`, 320, 50, 16, KC.gold, 'center', 540);
  bars.forEach((b, i) => { const yy = 100 + i * 50; TXT(c, b.name, 60, yy, 13, b.me ? KC.goldHi : KC.white, 'left', 150); RECT(c, 220, yy, 340, 18, '#1a2448'); RECT(c, 220, yy, Math.round(340 * b.v), 18, b.me ? KC.gold : KC.cyan); TXT(c, b.label, 580, yy + 2, 12, KC.white, 'right'); });
}

// Records the final in the history and gives the rewards. rows: ranked acts (me: the player)
function finishFinal(g, y, rows, meRow) {
  const k = K(g);
  const Y = yearRec(g, y);
  const E = Y.entry;
  const R = rules(y);
  const fin = rows.map((x) => ({ a: x.me ? null : x.act || x, name: x.name, type: x.type, total: typeof x.total === 'number' ? x.total : num(x.s1), s1: x.s1, agency: x.agency }));
  const me = E ? { unitId: E.unitId, unit: E.unitName, reached: meRow >= 0 ? 'final' : E.out || E.round, place: meRow >= 0 ? meRow + 1 : null, text: meRow === 0 ? `${E.unitName}（あなた）が優勝` : meRow > 0 ? `${E.unitName}（あなた）は${meRow + 1}位` : '' } : null;
  k.hist[y] = histFromSeason(g, y, fin, me);
  k.hist[y].mine = true;
  const champ = rows[0];
  if (E && meRow >= 0) {
    E.results.push({ round: 'final', score: typeof rows[meRow].total === 'number' ? rows[meRow].total : num(rows[meRow].votes, num(rows[meRow].s2, num(rows[meRow].s1))), rank: meRow === 0 ? 'S' : meRow < 3 ? 'A' : 'B', passed: meRow === 0, place: meRow + 1, of: rows.length, day: g.state.day });
    E.place = meRow + 1;
    E.status = meRow === 0 ? 'champion' : 'out';
    if (meRow > 0) E.out = 'final';
    const fame = meRow === 0 ? 1500 : meRow === 1 ? 500 : meRow === 2 ? 350 : 250;
    const fans = meRow === 0 ? 30000 : meRow === 1 ? 9000 : meRow === 2 ? 6000 : 4000;
    g.addFame(fame, true); g.addFans(fans, true);
    if (has(g, 'addStageExp') && !has(g, 'perform')) safe(() => g.addStageExp('conte', 3));
    if (has(g, 'unitHarmony')) safe(() => g.unitHarmony(meRow === 0 ? 6 : 2, meRow === 0 ? 'キングオブコント優勝' : 'キングオブコント決勝'));
    for (const pid of partnerIds(g, E)) if (has(g, 'addAff')) safe(() => g.addAff(pid, meRow === 0 ? 10 : 3, true));
    if (meRow === 0) news(g, NEWS.me.champion({ ed: R.edition, me: E.unitName, score: rows[0].total, n: R.entries.n }), { key: `champ|koc|${y}`, prio: 99 });
    else { news(g, NEWS.me.runner({ me: E.unitName, place: meRow + 1 })); news(g, NEWS.champion[0]({ ed: R.edition, champ: champ.name, score: typeof champ.total === 'number' ? champ.total : null, n: R.entries.n }), { key: `champ|koc|${y}`, prio: 95 }); }
    scheduleAfter(g, y, E, meRow);
    yearRec(g, y).news.champ = g.state.day; // the morning does not tell it again
  }
  // the broadcast is this world's history (D1 reads it through def.historyList); a final the player only watched: the
  // champion's news goes out the next morning (kocMorning, once)
  return { champ: champ.name };
}

async function championScene(g, y, E, champ, bd, MCs) {
  const R = rules(y);
  const k = K(g);
  const st = g.state;
  bd.set('studio', { year: y, mc: MCs.main.look, mc2: MCs.sub.look, judges: [], view: 'wide', unit: champ.looks, screen: ['優勝', champ.name], onair: true });
  sfx('applause');
  await sayP(g, E, '…ほんまに？…ほんまに、獲ったん…？');
  await g.say(`第${R.edition}代キングオブコント王者、${E.unitName}！\nおめでとうございます！`, { name: MCs.main.name, look: MCs.main.look });
  await g.say('（トロフィーの黄金の王冠が、ずしりと重い）');
  const share = Math.round(PRIZE / Math.max(1, (E.members || []).length || 2));
  g.addMoney(toInternal(share), true);
  g.giveItem('koc_trophy', 1, true);
  g.setFlag('koc_king', true);
  k.stats.wins = num(k.stats.wins) + 1;
  sfx('coin');
  await g.say(`優勝賞金${manYen(PRIZE)}！\n（${(E.members || []).length || 2}人で分けて、ひとり${manYen(share)}）\nキングオブコントのトロフィーを手に入れた！`);
  await g.say('今のお気持ちは？', { name: MCs.sub.name, look: MCs.sub.look });
  await g.say(`「…${E.instant ? '一回だけのつもりやったのに…！' : 'ずっと、この日のためにコントしてきました…！'}」\n（声がふるえた）`);
  logRun(g, E, 'final', `第${R.edition}代キングオブコント王者になった。`);
  if (has(g, 'addNeed')) g.addNeed('stress', -30);
  void st;
}

// 生・大反省会 (2024-, U-NEXT) / 打ち上げ
async function afterShow(g, y, E, rows, bd, meRow) {
  const R = rules(y);
  const looks = rows.slice(0, 11).map((x) => (x.looks && x.looks[0]) || lookFor(x.name));
  if (R.hanseikai) {
    bd.set('hanseikai', { title: R.hanseikai, people: looks });
    await g.say(`決勝のあとは『${R.hanseikai}』（U-NEXTで生配信）。ファイナリスト全員で、本音のトーク。`);
    await g.say(meRow === 0 ? '「王者、いまの点数の感想は？」\n「…まだ夢みたいです」' : meRow >= 0 ? `「${meRow + 1}位、正直どうでした？」\n「…あの審査、一生忘れませんよ（笑）」` : '「敗者復活、惜しかった！」');
    g.addFans(meRow === 0 ? 3000 : 800, true);
    logRun(g, E, 'after', `『${R.hanseikai}』に出演した。`);
  } else {
    bd.set('hanseikai', { party: true, people: looks });
    await g.say('放送のあとは、出場者とスタッフの打ち上げ。\n（番組ではない、内輪の会）');
    await g.say(meRow === 0 ? '「王者、乾杯の音頭を！」' : '「来年も、ここで会おう」');
    logRun(g, E, 'after', '決勝のあと、打ち上げで朝まで語り合った。');
  }
  if (has(g, 'addNeed')) g.addNeed('stress', -10);
}

// ================================================================ AFTER (scheduled events)
// K(g).events: [{ id, kind, day, y, done, text, data }] — handled by the morning hook (contest_koc.js) and the app.
function scheduleAfter(g, y, E, meRow) {
  const k = K(g);
  const d0 = g.state.day;
  const add = (kind, dd, data = {}) => k.events.push({ id: `${kind}_${y}_${k.events.length}`, kind, day: d0 + dd, y, done: false, data });
  if (meRow === 0) { add('offer', 1, { reg: 'koc_reg_conte' }); add('offer', 4, { reg: 'koc_reg_variety' }); add('dvd', 12, { place: 1 }); }
  else if (meRow <= 2) { add('offer', 3, { reg: 'koc_reg_radio' }); add('dvd', 16, { place: meRow + 1 }); }
  else add('offer', 6, { reg: 'koc_reg_radio' });
  add('doc', 4, { place: meRow + 1 });
  if (rules(y + 1).kai && meRow <= 1) add('kai', Math.max(30, dayOf(g, y + 1, [6, 5]) - d0), { place: meRow + 1 });
  if (k.events.length > 30) k.events.splice(0, k.events.length - 30);
}

// The DVD recording (champion / top 3). Returns true when done.
export async function runDvd(g, ev) {
  const y = ev.y;
  const E = (K(g).years[y] && K(g).years[y].entry) || { unitName: g.state.name, members: [] };
  const i = await g.ask(`${E.unitName}のベストネタDVDの収録。\nKOCのネタ＋新作コントを撮る。（体力 -20）`, ['収録する', 'ことわる'], { cancel: 1 });
  if (i !== 0) { ev.done = 'no'; return false; }
  if (g.state.stamina < 20) { await g.say('体力が足りない…。休んでからにしよう。'); return false; }
  g.state.stamina -= 20;
  await g.fadeOut(8);
  const bd = pushSet(g, 'stage', { light: 'up', unit: looksOf(g, E), look: 'office', banner: 'ベストネタDVD 収録' });
  try {
    await g.fadeIn(8);
    const neta = await chooseNeta(g, { y, rid: 'final', len: 300, auto: !!g.auto, prompt: 'DVDに収録する新作コント' });
    const res = await perform(g, { y, rid: 'final', neta, len: 600, auto: !!g.auto, venue: { name: 'DVD収録の劇場', size: 'theater', crowd: 'warm', pressure: 40 }, title: 'ベストネタDVD 収録' });
    const sales = Math.round(4000 + res.score * 120 + (ev.data.place === 1 ? 20000 : 6000));
    const pay = Math.round(sales * 120 * 0.1);
    g.addMoney(toInternal(pay), true);
    g.addFans(Math.round(sales / 3), true);
    g.addFame(ev.data.place === 1 ? 120 : 60, true);
    ev.done = true;
    await g.say(`DVDが発売された！売上 約${sales.toLocaleString('ja-JP')}枚。\n印税など ${realYen(pay)} が入った。（ファン +${Math.round(sales / 3).toLocaleString('ja-JP')}）`);
    news(g, NEWS.me.dvd({ me: E.unitName }));
  } finally { await g.fadeOut(8); bd.pop(); await g.fadeIn(8); }
  return true;
}
// キングオブコントの会 (TBS, 2021-): champions and runners-up perform a new conte
export async function runKai(g, ev) {
  const y = kDate(g).year;
  const E = (K(g).years[ev.y] && K(g).years[ev.y].entry) || { unitName: g.state.name, members: [] };
  const i = await g.ask(`TBS特番『キングオブコントの会』の収録。\n歴代王者・準優勝組が、書き下ろしの新作コントを披露する。（体力 -20）`, ['出演する', 'ことわる'], { cancel: 1 });
  if (i !== 0) { ev.done = 'no'; return false; }
  if (g.state.stamina < 20) { await g.say('体力が足りない…。休んでからにしよう。'); return false; }
  g.state.stamina -= 20;
  await g.fadeOut(8);
  const bd = pushSet(g, 'studio', { year: y, judges: [], view: 'stage', unit: looksOf(g, E), look: 'party', screen: ['キングオブコントの会'] });
  try {
    await g.fadeIn(8);
    const neta = await chooseNeta(g, { y, rid: 'final', len: 420, auto: !!g.auto, prompt: 'キングオブコントの会の新作コント' });
    const res = await perform(g, { y, rid: 'final', neta, len: 600, auto: !!g.auto, venue: { name: 'TBSスタジオ', size: 'tv', crowd: 'warm', pressure: 60 }, title: 'キングオブコントの会' });
    g.addMoney(toInternal(150000), true);
    g.addFame(Math.round(60 + res.score), true);
    g.addFans(Math.round(1500 + res.score * 30), true);
    ev.done = true;
    await g.say(`『キングオブコントの会』の収録を終えた。\n歴代王者たちと並んで、新作コントを披露した！（出演料 ${realYen(150000)}）`);
  } finally { await g.fadeOut(8); bd.pop(); await g.fadeIn(8); }
  return true;
}

// ================================================================ DOCUMENTARY (アナザーストーリー風の振り返り)
// kind: 'run' (KOC挑戦記: any entered year) | 'doc' (激闘の1日 2026- / this world's own 密着ドキュメント)
export async function playDoc(g, y, kind = 'run') {
  const E = entryOf(g, y) || (K(g).years[y] && K(g).years[y].entry);
  if (!E) { await g.say('その年の記録はない。'); return; }
  const R = rules(y);
  const looks = looksOf(g, E);
  const title = kind === 'doc' ? (R.doc ? `『${R.doc}』（U-NEXT）` : '密着ドキュメント『その日、王を目指して』') : `KOC挑戦記 ― ${E.unitName}の${y}年`;
  const pages = [];
  pages.push({ set: 'reception', data: { year: y, banner: `${titleOf(y)} 予選会場`, unit: looks, staff: STAFF.uketsuke.look, others: [] }, caption: `${y}年`, line: `${R.entries.approx ? '約' : ''}${R.entries.n.toLocaleString('ja-JP')}組がエントリーした『${titleOf(y)}』。その中に、エントリーナンバー${E.no}「${E.unitName}」がいた。` });
  const setOf = { entry: 'night', r1: 'stage', r2: 'stage', qf: 'stage', sf: 'stage', revival: 'revival', final: 'studio', after: 'hanseikai' };
  for (const l of (E.log || []).slice(kind === 'doc' ? -6 : 0)) {
    const set = setOf[l.round] || 'gakuya';
    pages.push({ set, data: set === 'studio' ? { year: y, view: 'stage', unit: looks, look: 'office', judges: [] } : set === 'stage' ? { light: 'up', unit: looks, look: 'office', banner: `${titleOf(y)}` } : { unit: looks, people: looks, year: y }, caption: roundName(l.round) || '', line: l.text });
  }
  const sp = partnerSpeaker(g, E);
  const end = E.status === 'champion' ? 'そして二人は、キングになった。' : E.place ? `決勝${E.place}位。王冠には、あと一歩届かなかった。` : `${roundName(E.out || E.round)}敗退。それでも、ネタ帳は次のページへ進む。`;
  if (sp) pages.push({ set: 'night', data: { unit: looks }, caption: `${sp.name}（相方）`, line: `「${E.status === 'champion' ? '一人やったら、絶対ここまで来られへんかった。' : 'また来年も、出よな。'}」` });
  pages.push({ set: 'dark', data: {}, caption: '', line: end });
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    await card(g, (c, t, gg) => drawDoc(c, t, { ...p, title, page: i + 1, pages: pages.length }, gg), { min: 30 });
  }
}

// ================================================================ the final on TV (no entry): a digest that matches the history
export async function watchFinal(g, y) { return runFinalDay(g, y); }
export { realYen, manYen, toInternal };
