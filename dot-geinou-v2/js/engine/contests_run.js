// 賞レースの土台 (owner: D1) — the generic runner: the entry flow (エントリー用紙, 参加費, エントリーナンバー), going to the venue
// on a round day, the steps at the venue (受付 → 楽屋 → 舞台袖 → 本番 → 審査 → 結果), 敗者復活, 決勝の採点, results the next
// morning, withdrawals, reminders, invitations and the simulated news of every contest. Imported by contests.js (which
// exports what is used here); nothing from contests.js is touched at load time.

import { CONTESTS, CONTEST_UI, internals as I } from './contests.js';
import { PLACES } from './map.js';
import { clamp, fmtMoney } from './util.js';
import { audio } from './audio.js';
import { eraOf } from './profile.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
const safe = (key, fn, d = null) => { try { return fn(); } catch (e) { I.logOnce(key, e); return d; } };
async function asafe(key, fn, d = null) { try { return await fn(); } catch (e) { I.logOnce(key, e); return d; } }
const STAFF = { name: '大会スタッフ', look: { hair: 'cap', hat: '#2a2d36', hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#2a2d36' } };
const UKETSUKE = { name: '受付スタッフ', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#3f5fa8', bottom: '#2a3560', skirt: true, jacket: true } };
const ONKYO = { name: '音響スタッフ', look: { hair: 'cap', hat: '#2f6fd0', hairColor: 'black', skin: 'tan', top: '#2a2d36', bottom: '#2a2d36' } };
const KANTOKU = { name: '舞台監督', look: { hair: 'cap', hat: '#d62f2f', hairColor: 'black', skin: 'tan', top: '#1e1e26', bottom: '#2a2d36' } };
const MC = { name: '進行役', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a3560', bottom: '#2a3560', jacket: true, tie: '#d62f2f' } };
// the HD scenes (form, boards, scoreboard, votes) are skipped under g.auto unless a test asks for them (g.auto.contestui)
const showUI = (g) => !g.auto || !!g.auto.contestui;
const sayAs = (g, who, t) => g.say(t, { name: who.name, look: who.look });
const askAs = (g, who, t, ch, o = {}) => g.ask(t, ch, { name: who.name, look: who.look, ...o });

// ================================================================ context
function label(def, cyc) { return cyc.label || I.contestName(def, cyc.year); }
export function makeCtx(g, id, year, idx = null, extra = {}) {
  const def = CONTESTS[id];
  const cyc = I.cycleOf(g, def, year);
  return { id, def, year, edition: cyc ? cyc.edition : null, revival: !!(cyc && cyc.revival), entry: I.entryOf(g, id, year), round: idx, date: I.contestDate(g), cycle: cyc, label: cyc ? label(def, cyc) : def.name, ...extra };
}
function stageRoom(r, revival) {
  if (revival) return 'outdoor';
  if (r && r.stage) return r.stage;
  if (r && (r.tv || r.final) && (r.tv || r.judge === 'panel')) return 'studio';
  return 'stage';
}
export function today(g) {
  const c = I.cstate(g);
  const t = c.today;
  return t && t.day === I.todayOf(g) ? t : null;
}
function roundOfToday(g) {
  const t = today(g);
  if (!t) return null;
  const def = CONTESTS[t.id];
  if (!def) return null;
  const cyc = I.cycleOf(g, def, t.year);
  const rr = cyc && cyc.rounds[t.idx];
  if (!rr) return null;
  return { t, def, cyc, rr, r: rr.r, entry: I.entryOf(g, t.id, t.year) };
}

// ================================================================ eligibility / blocks
function block(g) {
  try {
    for (const k of ['lifeRefusal', 'justiceRefusal', 'politicsRefusal']) {
      if (!has(g, k)) continue;
      const w = k === 'lifeRefusal' ? g.lifeRefusal() : g[k]('job', { id: 'contest' });
      if (w) return [].concat(w).join('\n');
    }
  } catch (e) { I.logOnce('block', e); }
  return null;
}
// rough fares in today's yen (shown in the era's prices): 電車 within a city, 新幹線 / 飛行機 between cities (目安)
const CITY = [[/大阪|なんば|梅田|京都|神戸|関西/, 'osaka'], [/名古屋/, 'nagoya'], [/福岡|博多/, 'fukuoka'], [/札幌|北海道/, 'sapporo'], [/仙台/, 'sendai'], [/広島/, 'hiroshima'], [/沖縄|那覇/, 'okinawa']];
const FARE = { osaka: 14000, nagoya: 11000, fukuoka: 23000, sapporo: 24000, sendai: 11500, hiroshima: 19000, okinawa: 30000, tokyo: 14000 };
function cityOf(text) { for (const [re, id] of CITY) if (re.test(String(text || ''))) return id; return 'tokyo'; }
function hereCity(g) {
  const c = I.cstate(g);
  const pid = (g.map && g.map.placeId === 'shourace' && c.ret && c.ret.place) || (g.map && g.map.placeId) || 'tokyo';
  return /namba|osaka|shochiku|mbs|ktv|shinkigeki|station_namba/.test(pid) ? 'osaka' : 'tokyo';
}
export function travelCost(g, venue) {
  const a = hereCity(g), b = cityOf(venue);
  if (a === b) return 400;
  return FARE[b === 'tokyo' ? a : b] || 14000;
}

// ================================================================ entry (エントリー用紙)
function unitInfo(g) {
  const u = I.playerUnit(g);
  const st = g.state;
  const formed = u && u.formed && u.formed.year ? `${u.formed.year}年${u.formed.month ? `${u.formed.month}月` : ''}` : `${I.contestDate(g, 1).year}年`;
  return {
    unitName: (u && u.name) || st.name, kana: (u && u.kana) || '', rep: st.profile && st.profile.familyName ? `${st.profile.familyName} ${st.name}` : st.name,
    formed, agency: st.agency ? (st.agency === 'yoshimoto' ? 'よしもと' : st.agency === 'shochiku' ? '松竹芸能' : st.agency === 'grape' ? 'グレープカンパニー' : st.agency === 'horipro' ? 'ホリプロ' : st.agency) : 'アマチュア（所属なし）',
    members: u && Array.isArray(u.members) ? u.members.length : 1, memberNames: u && Array.isArray(u.members) ? u.members.map((m) => m.name) : [st.name], type: (u && u.type) || 'pin', style: (u && u.style) || 'pin',
  };
}
const KIND_CHOICES = { any: ['漫才', 'コント', 'ピン芸', '歌ネタ', 'ものまね'], double: ['漫才とコント'], manzai: ['漫才'], conte: ['コント'], pin: ['ピン芸（フリップ・一人コント・漫談）'], rakugo: ['落語'], ogiri: ['大喜利'], utaneta: ['歌ネタ'], monomane: ['ものまね'], talk: ['エピソードトーク'] };
async function textForm(g, o) {
  const f = o.form;
  const opts = o.options.map((x) => `${I.dateText(g, x.day)} ${x.venue}会場`);
  const k = opts.length > 1 ? await g.list({ title: '1回戦の日程・会場', items: [...opts, 'やめる'], x: 120, y: 60, w: 400, cancel: opts.length }) : 0;
  if (k < 0 || k >= opts.length) return null;
  const page1 = `【エントリー用紙】${o.title}\n名前：${f.unitName}　代表者：${f.rep}\n結成：${f.formed}　所属：${f.agency}`;
  const page2 = `出場：${opts[k]}\n参加費：${o.fee.text}\nこの内容で提出する？`;
  const i = await g.ask([page1, page2], ['提出する', 'やめる'], { cancel: 1 });
  return i === 0 ? { ...f, pick: o.options[k].k } : null;
}
async function enter(g, id, opts = {}) {
  const def = CONTESTS[id];
  if (!def || !g.state) return null;
  const year = opts.year ?? I.seasonYearOf(g, id);
  const cyc = I.cycleOf(g, def, year);
  const ctx = makeCtx(g, id, year, 0);
  if (typeof def.entry === 'function') return asafe(`entry:${id}`, () => def.entry(g, ctx), null);
  const c = I.cstate(g);
  const name = label(def, cyc);
  const ex = I.entryOf(g, id, year);
  if (ex && ex.status !== 'withdrawn') { await g.say(`${name}には、もうエントリーしている。\n（エントリーナンバー ${ex.no}番）`); return ex; }
  if (!cyc.held) { await g.say(`${I.contestName(def, year)}は、${cyc.note || 'この年は開催されない'}。`); return null; }
  const day = I.todayOf(g);
  if (cyc.invite) {
    const inv = c.invites && c.invites[id] && c.invites[id][year];
    if (!inv) { const el = I.eligibilityOf(g, id, year); await g.say([`${name}は招待制の大会だ。\nこちらからエントリーはできない。`, el.ok ? '（実力と知名度が認められれば、\n出場のお願いが届くかもしれない）' : `（${el.why}）`]); return null; }
    const k = await g.ask(`${name}から出場のお願いが届いている。\n出場する？`, ['出場する', 'ことわる'], { cancel: 1 });
    if (k !== 0) { c.invites[id][year] = -1; return null; }
    const e = I.registerEntry(g, id, { year, invite: true, fee: 0, picks: { 0: 0 } });
    I.bump(g, id, year);
    sfx('good');
    await g.say(`${name}への出場が決まった！\n本番は${I.dateText(g, cyc.rounds[0].first)}（${cyc.rounds[0].options[0].venue}）。`);
    I.pushNews(g, `${name}への出場が決まりました。\n本番：${I.dateText(g, cyc.rounds[0].first, { year: true })}　${cyc.rounds[0].options[0].venue}\n当日は${eraOf(g.state).deviceShort || 'スマホ'}の「賞レース」から会場へ向かってください。`, { personal: true, contest: id });
    return e;
  }
  if (cyc.entry && day < cyc.entry.from) { await g.say(`${name}のエントリー受付は、\n${I.dateText(g, cyc.entry.from, { year: true })}から。まだ少し先だ。`); return null; }
  if (cyc.entry && day > cyc.entry.to) { await g.say(`${name}のエントリーは、\nもう締め切られている…。（${I.dateText(g, cyc.entry.to)}まで）`); return null; }
  const options = cyc.rounds[0].options.filter((o) => o.day > day);
  if (!options.length) { await g.say(`${name}の${cyc.rounds[0].name}は、もう全部の日程が終わっている…。`); return null; }
  const el = I.eligibilityOf(g, id, year);
  if (!el.ok) {
    sfx('buzz');
    await g.say([`${name}には出られない…。`, ...el.reasons.slice(0, 4).map((r) => `・${r.text}`)].join('\n').split('\n').reduce((pages, l, i) => { if (i % 3 === 0) pages.push(l); else pages[pages.length - 1] += `\n${l}`; return pages; }, []));
    return null;
  }
  const fee = I.feeOf(g, id, year);
  if (!c.seen.entryTut) {
    c.seen.entryTut = true;
    await sayAs(g, UKETSUKE, ['賞レースのエントリーですね！', 'エントリー用紙に、コンビ名・代表者・結成年月・所属、\nそれから1回戦の日程と会場を書いてください。', `参加費は${fee.text}。出したらエントリーナンバーが決まります。\n当日は${eraOf(g.state).deviceShort || 'スマホ'}の「賞レース」から会場へ！`]);
  }
  const info = unitInfo(g);
  const form = { ...info, kinds: (KIND_CHOICES[I.kindOf(def)] || ['漫才'])[0], title: '' };
  const odds = safe('odds', () => oddsOf(g, id, 0), null);
  const o = { def, cyc, title: name, form, options, fee, el, odds, kinds: KIND_CHOICES[I.kindOf(def)] || ['漫才'] };
  const f = CONTEST_UI.entryForm && showUI(g) ? await asafe('entryForm', () => CONTEST_UI.entryForm(g, o), null) : g.auto ? { ...form, pick: options[0].k } : await textForm(g, o);
  if (!f) return null;
  if (fee.internal > 0) {
    if (!g.spend(fee.internal)) { sfx('buzz'); await g.say(`参加費（${fmtMoney(fee.internal)}）が足りない…。\nお金をためてから出直そう。`); return null; }
    sfx('coin');
    c.stats.fees = num(c.stats.fees) + fee.internal;
  }
  const e = I.registerEntry(g, id, { year, unitName: f.unitName, kana: f.kana, rep: f.rep, formed: f.formed, agency: f.agency, members: f.members, kinds: f.kinds, title: f.title, fee: fee.yen, picks: { 0: num(f.pick, options[0].k) } });
  I.bump(g, id, year);
  const opt = cyc.rounds[0].options[e.picks[0]] || options[0];
  const clash = I.dueOn(g, opt.day).filter((d) => d.id !== id);
  sfx('good');
  if (CONTEST_UI.entryDone && showUI(g)) await asafe('entryDone', () => CONTEST_UI.entryDone(g, { ...o, entry: e, option: opt }), null);
  else await g.say(`エントリー完了！\nエントリーナンバーは ${e.no}番。\n${cyc.rounds[0].name}：${I.dateText(g, opt.day)} ${opt.venue}会場`);
  if (clash.length) await g.say(`（その日は${CONTESTS[clash[0].id] ? I.contestName(CONTESTS[clash[0].id], clash[0].year) : '別の大会'}と重なっている…。\n「賞レース」アプリで日程を変えられる）`);
  I.pushNews(g, `【エントリー受付完了】${name}\nエントリーナンバー：${e.no}番\n${cyc.rounds[0].name}：${I.dateText(g, opt.day, { year: true })}　${opt.venue}会場\n参加費：${fee.text}\n当日は会場の受付でエントリーナンバーをお伝えください。`, { personal: true, contest: id });
  return e;
}

// ================================================================ odds (shown honestly)
export function oddsOf(g, id, round) {
  const def = CONTESTS[id];
  if (!def) return null;
  const year = I.seasonYearOf(g, id);
  const sim = I.simOf(g, id, year);
  if (!sim) return null;
  const idx = clamp(num(typeof round === 'string' ? I.roundsOf(def).findIndex((r) => r.id === round) : round, 0), 0, sim.rounds.length - 1);
  const rd = sim.rounds[idx];
  const kind = kindFor(g, def);
  const d = I.playerScoreDist(g, kind);
  const last = idx === sim.rounds.length - 1;
  let cut = rd.cut;
  if (last) { const top = rd.passed.map((x) => rd.scores.get(x)).sort((a, b) => b - a)[0]; cut = num(top, 60); }
  const p = clamp(1 - I.PHI((cut - d.mean) / Math.max(1, d.sd)), 0.005, 0.995);
  const pct = Math.round(p * 100);
  const word = pct >= 80 ? 'かなり有利' : pct >= 55 ? '五分以上' : pct >= 30 ? '厳しめ' : pct >= 10 ? 'かなり厳しい' : 'ほぼ無理（実力不足）';
  return { power: Math.round(d.power), quality: Math.round(d.quality), mean: Math.round(d.mean), cut: Math.round(cut), pass: p, pct, word, round: rd.name, text: `${rd.name}${last ? '優勝' : '通過'}の見込み 約${pct}%（${word}）` };
}
function kindFor(g, def) {
  const k = I.kindOf(def);
  if (k !== 'any' && k !== 'double') return k;
  const u = I.playerUnit(g);
  const s = u && u.style;
  return s === 'conte' ? 'conte' : s === 'pin' ? 'pin' : 'manzai';
}

// ================================================================ going to the venue
function dueLabel(g, d) { const def = CONTESTS[d.id]; return `${I.contestName(def, d.year)} ${d.revival ? (d.cyc.rounds[d.idx].r.revivalName || '敗者復活戦') : d.cyc.rounds[d.idx].name}`; }
async function go(g, id) {
  if (!g.state) return false;
  const c = I.cstate(g);
  const due = I.dueOn(g).filter((d) => !id || d.id === id);
  const done = Object.values(c.entries).some((ys) => Object.values(ys || {}).some((e) => e && e.today && e.today.day === I.todayOf(g) && e.today.done));
  if (!due.length) { await g.say('今日は、出る大会の予定はない。'); return false; }
  const t0 = today(g);
  if (t0 && !t0.done && g.map && g.map.placeId === 'shourace') { await g.say('もう会場に来ている。'); return false; }
  if (done && !(t0 && t0.continueFinal)) { await g.say('今日はもう本番を終えた。\n体はひとつ。もう一つの大会は棄権するしかない…。'); return false; }
  let item = due[0];
  if (due.length > 1 && !g.auto) {
    const k = await g.ask(['今日は大会が重なっている…！', 'どちらに出る？（もう片方は棄権になる）'], [...due.map((d) => dueLabel(g, d)), 'やめておく'], { cancel: due.length });
    if (k < 0 || k >= due.length) return false;
    item = due[k];
  }
  const why = block(g);
  if (why) { await g.say(why); return false; }
  const def = CONTESTS[item.id];
  const cost = travelCost(g, item.option.venue);
  if (!g.auto) {
    const k = await g.ask(`${dueLabel(g, item)}\n${item.option.venue}会場へ向かう？（交通費 ${fmtMoney(cost)}）`, ['向かう', 'やめておく'], { cancel: 1 });
    if (k !== 0) return false;
  }
  if (!g.spend(cost)) { sfx('buzz'); await g.say(`交通費（${fmtMoney(cost)}）が足りない…。`); return false; }
  if (g.map && g.map.placeId && g.map.placeId !== 'shourace') { const p = g.map.player; c.ret = { place: g.map.placeId, room: g.map.roomId, x: p.x, y: p.y, dir: p.dir }; }
  let mode = 'full';
  if (g.auto) mode = g.auto.contestMode || 'auto';
  else if (c.seen.venueFull) {
    const k = await g.ask('どう進める？', ['会場を回って準備する（ぜんぶ見る）', 'すぐに出番へ（準備はおまかせ）', 'おまかせ（本番もシミュレーション）'], { cancel: 0 });
    mode = ['full', 'quick', 'auto'][k] || 'full';
  }
  void def;
  return runItem(g, item, mode, true);
}
// Runs one due round: def.flow (the whole contest is the def's), else rounds[i].run (that round is the def's), else D1's generic
// runner — at the venue (viaVenue: the walk / quick / おまかせ) or directly (tests, おまかせ from elsewhere).
async function runItem(g, item, mode, viaVenue) {
  const def = CONTESTS[item.id];
  const ctx = makeCtx(g, item.id, item.year, item.idx, { option: item.option, revival: item.revival, mode, venueName: `${item.option.venue}会場` });
  startToday(g, item, mode);
  if (typeof def.flow === 'function') {
    const res = await asafe(`flow:${item.id}`, () => def.flow(g, ctx), null);
    finishToday(g);
    return res ?? true;
  }
  const r = item.cyc.rounds[item.idx].r;
  if (typeof r.run === 'function' && !item.revival) {
    setVenue(g, item);
    const res = await asafe(`run:${item.id}`, () => r.run(g, ctx), null);
    const e = I.entryOf(g, item.id, item.year);
    if (res && typeof res === 'object' && res.passed != null && e && e.status !== 'out' && e.status !== 'champion' && !(e.results || []).some((x) => x.round === item.idx && x.day === I.todayOf(g))) record(g, item.id, item.idx, res, {});
    finishToday(g);
    return res;
  }
  setVenue(g, item);
  if (viaVenue) {
    await g.goto('shourace', 'lobby', 9, 10, 'up');
    if (mode !== 'full') await runSteps(g, mode);
    return true;
  }
  const x = roundOfToday(g);
  x.t.phase = 'checked';
  return performStep(g, { mode });
}
function startToday(g, item, mode) {
  const c = I.cstate(g);
  const def = CONTESTS[item.id];
  const r = item.cyc.rounds[item.idx];
  const n = Math.max(1, num(r.r.field, 40));
  const rr = I.rngOf(c.seed, 'order', item.id, item.year, item.idx, item.option.k);
  const finalish = item.idx >= item.cyc.rounds.length - 1 || n <= 30;
  const blockSize = finalish ? n : clamp(Math.round(n / Math.max(1, r.options.length) / 6), 18, 40);
  const tv = !!(r.r.tv || r.r.final);
  const st = g.state;
  const dokyo = has(g, 'comedyStat') ? num(safe('comedyStat', () => g.comedyStat('dokyo'), 30)) : 30;
  const base = item.revival ? 55 : tv ? 62 : 30 + item.idx * 8;
  const tension = clamp(Math.round(base + num(st.life && st.life.stress) * 0.25 - dokyo * 0.35 + (c.stats.rounds ? 0 : 10)), 5, 95);
  c.today = {
    id: item.id, year: item.year, idx: item.idx, revival: !!item.revival, day: I.todayOf(g), phase: 'arrived', mode, opt: item.option.k,
    order: 1 + Math.floor(rr() * blockSize), of: blockSize, block: finalish ? null : 'ABCDEFGHJK'[Math.floor(rr() * Math.min(10, Math.max(1, Math.round(n / Math.max(1, r.options.length) / blockSize))))],
    tension, prep: {}, rivals: (safe('rivals', () => I.rivalsFor(g, item.id, item.idx, 6, item.year), []) || []).slice(0, 6).map((x) => ({ name: x.name, tags: x.tags, power: x.power, unit: x.unit, agency: x.agency, look: x.look, members: (x.members || []).map((m) => ({ name: m.name, look: m.look })) })),
    done: false, tv,
  };
  const e = I.entryOf(g, item.id, item.year);
  if (e) e.today = { day: I.todayOf(g), done: false };
  void def;
}
function setVenue(g, item) {
  const def = CONTESTS[item.id];
  const rr = item.cyc.rounds[item.idx];
  const room = stageRoom(rr.r, item.revival);
  g.contestVenue({ contest: item.id, round: item.idx, title: label(def, item.cyc), sub: item.revival ? rr.r.revivalName || '敗者復活戦' : rr.name, color: I.colorOf(def), venueName: `${item.option.venue}会場`, stage: room, year: item.year });
}
function finishToday(g) {
  const t = today(g);
  if (!t) return;
  t.done = true;
  t.phase = 'done';
  const e = I.entryOf(g, t.id, t.year);
  if (e) e.today = { day: I.todayOf(g), done: true };
}
// Leave the venue: back where the player came from (the tile they stood on), else home.
export async function leaveVenue(g, opts = {}) {
  const c = I.cstate(g);
  const t = today(g);
  if (t && !t.done && !opts.force) {
    const k = await g.ask(['まだ出番が終わっていない。', '帰ると棄権になる。帰る？'], ['会場に残る', '棄権して帰る'], { cancel: 0 });
    if (k !== 1) return false;
    withdraw(g, t.id, t.year, '当日棄権');
    finishToday(g);
  }
  const ret = c.ret && PLACES[c.ret.place] ? c.ret : null;
  c.ret = null;
  if (ret) await g.goto(ret.place, ret.room, ret.x, ret.y, ret.dir || 'down');
  else { let h = null; try { h = g.housing(); } catch (e) { h = null; } const p = h && PLACES[h.place] ? h.place : PLACES.home ? 'home' : 'tokyo'; await g.goto(p); }
  if (has(g, 'save')) g.save(true);
  return true;
}
function withdraw(g, id, year, why = '棄権') {
  const e = I.entryOf(g, id, year);
  if (!e || e.status === 'withdrawn' || e.status === 'out' || e.status === 'champion') return;
  e.status = 'withdrawn';
  e.results.push({ round: e.round, score: null, rank: null, passed: false, place: null, withdrawn: true, day: I.todayOf(g), note: why });
  I.bump(g, id, year);
}

// ================================================================ the steps at the venue (also called by places/shourace.js)
function roundTitle(x) { return x.t.revival ? x.r.revivalName || '敗者復活戦' : x.rr.name; }
export async function reception(g) {
  const x = roundOfToday(g);
  if (!x) { await sayAs(g, UKETSUKE, ['本日は大会の受付はありません。', '大会の日程は「賞レース」でご確認くださいね。']); return false; }
  const { t, def, cyc, entry } = x;
  if (t.phase !== 'arrived') { await sayAs(g, UKETSUKE, t.done ? 'おつかれさまでした！気をつけてお帰りください。' : `${entry ? entry.unitName : ''}さん、受付はおすみです。\n楽屋でお待ちください。出番は${t.block ? `${t.block}ブロックの` : ''}${t.order}番目です。`); return true; }
  t.phase = 'checked';
  sfx('ok');
  const first = !I.cstate(g).seen.reception;
  I.cstate(g).seen.reception = true;
  const lines = [
    `${label(def, cyc)} ${roundTitle(x)}の受付です。`,
    `エントリーナンバー${entry ? entry.no : '—'}番、${entry ? entry.unitName : ''}さんですね。`,
    t.block ? `本日の出番は ${t.block}ブロックの${t.order}番目（${t.of}組中）です。` : `出番は${t.order}番目（全${t.of}組）です。`,
  ];
  if (first) lines.push('楽屋で待機して、名前を呼ばれたら舞台袖へ。\n持ち時間を超えると減点されるので気をつけて！');
  await sayAs(g, UKETSUKE, lines);
  return true;
}
export async function practice(g, partner) {
  const x = roundOfToday(g);
  if (!x || x.t.done) { await g.say(partner ? `${partner.name}「今日は本番ないで。\nまた今度ネタ合わせしよな」` : '今日は本番がない。'); return; }
  const { t, def } = x;
  if (t.prep.neta) { await g.say(`${partner ? partner.name + '「' : '（'}ネタ合わせはもう十分やった。あとは本番や${partner ? '」' : '）'}`); return; }
  t.prep.neta = true;
  const kind = kindFor(g, def);
  let neta = null;
  if (has(g, 'netaList')) { const list = safe('netaList', () => g.netaList(kind), []) || []; neta = list[0] || null; }
  if (neta && has(g, 'practiceNeta')) safe('practiceNeta', () => g.practiceNeta(neta.id, 6));
  t.netaId = neta ? neta.id : null;
  t.tension = clamp(t.tension - 5, 0, 100);
  I.addHarmony(g, 1, '本番前のネタ合わせ');
  sfx('good');
  await g.say([partner ? `${partner.name}と、楽屋のすみでネタ合わせをした。` : 'ひとりで、ネタを頭から最後までさらった。', neta ? `『${neta.title || 'ネタ'}』の仕上がりが上がった。（緊張 -5）` : '体にネタが入っている。（緊張 -5）']);
}
export async function debayashi(g) {
  const x = roundOfToday(g);
  if (!x || x.t.done) { await sayAs(g, ONKYO, '今日は本番がないので、出囃子のチェックもありません。'); return; }
  if (x.t.prep.debayashi) { await sayAs(g, ONKYO, '出囃子はチェックずみです。本番もこのタイミングで出てください！'); return; }
  x.t.prep.debayashi = true;
  x.t.tension = clamp(x.t.tension - 3, 0, 100);
  sfx('drum');
  await sayAs(g, ONKYO, [x.t.tv ? '音響です。出囃子の確認をお願いします！' : '音響です。出囃子、流しますね。', '（ジャーン！…出囃子が鳴る）\nこのフレーズで袖から出て、センターマイクまで。', 'OKです！本番もこのタイミングで。（緊張 -3）']);
}
export async function mirror(g) {
  const x = roundOfToday(g);
  const c = I.cstate(g);
  if ((x && x.t.prep.mirror) || c.mirrorDay === I.todayOf(g)) { await g.say('鏡の中の自分と目が合った。\nもう準備はばっちりだ。'); return; }
  if (x) x.t.prep.mirror = true;
  c.mirrorDay = I.todayOf(g);
  const d = has(g, 'bathe') ? g.bathe(20, true) : 0;
  await g.say(['楽屋の鏡で、衣装と髪を整えた。', `身だしなみ +${Math.max(0, Math.round(d))}`]);
}
export async function breathe(g) {
  const x = roundOfToday(g);
  if (!x || x.t.done) { await g.say('舞台袖は静かだ。\n今日はもう、出番はない。'); return; }
  if (x.t.prep.breath) { await g.say('もう一度深呼吸した。\n…これ以上は、本番でしか落ち着かない。'); return; }
  x.t.prep.breath = true;
  x.t.tension = clamp(x.t.tension - 7, 0, 100);
  await g.say(['すーっ…はーっ…。', `深呼吸して、手のひらに「人」と書いて飲みこんだ。（緊張 -7）`]);
}
export function tensionNow(g) { const t = today(g); return t ? t.tension : null; }

// The 舞台監督 calls the player: the performance, the judging, the results.
export async function stageCall(g) {
  const x = roundOfToday(g);
  if (!x) { await sayAs(g, KANTOKU, '今日は本番はないよ。\n大会の日にまたおいで。'); return; }
  if (x.t.done) { await sayAs(g, KANTOKU, 'おつかれさん！今日の本番はもう終わったよ。'); return; }
  if (x.t.phase === 'arrived') { await sayAs(g, KANTOKU, '先に受付をすませてきて。\nエントリーナンバーの確認がまだだよ。'); return; }
  const k = await askAs(g, KANTOKU, [`${x.entry ? x.entry.unitName : ''}さん、次の次です！`, x.t.tv ? '本番行けますか？カメラ回ってますよ。' : '準備はいい？'], ['行けます！', 'もう少し待って'], { cancel: 1 });
  if (k !== 0) return;
  await performStep(g, { mode: x.t.mode === 'auto' ? 'auto' : 'full' });
}

async function runSteps(g, mode) {
  const x = roundOfToday(g);
  if (!x) return;
  if (mode === 'quick') {
    await reception(g);
    if (x.t.rivals && x.t.rivals.length) { const rv = x.t.rivals[0]; await g.say(`楽屋には${x.t.rivals.length}組ほどの出場者がいた。\n${rv.name}${rv.tags && rv.tags.length ? `（${rv.tags.join('・')}）` : ''}の姿も見える。`); }
    await performStep(g, { mode: 'quick' });
  } else {
    x.t.phase = 'checked';
    await performStep(g, { mode: 'auto' });
  }
}

// ================================================================ performing
async function chooseNeta(g, kind, length, title, skip) {
  let neta = null;
  if (!skip && has(g, 'pickNeta')) neta = await asafe('pickNeta', () => g.pickNeta({ kind, length, title }), null);
  if (!neta && has(g, 'netaList')) {
    const list = safe('netaList', () => g.netaList(kind), []) || [];
    if (list.length) neta = list.slice().sort((a, b) => num(safe('nq', () => g.netaQuality(b), 0)) - num(safe('nq', () => g.netaQuality(a), 0)))[0];
  }
  if (!neta && has(g, 'autoNeta')) { const p = I.playerPower(g, kind); neta = safe('autoNeta', () => g.autoNeta(kind, Math.max(10, p - 8)), null); }
  return neta;
}
async function doPerform(g, x, opts) {
  const { t, def, r } = x;
  const kind = kindFor(g, def);
  const length = num(r.length, num(def.perform && def.perform.length, 240));
  const skip = opts.mode === 'auto';
  const title = `${label(def, x.cyc)} ${roundTitle(x)}`;
  const neta = (t.netaId && has(g, 'neta') ? safe('neta', () => g.neta(t.netaId), null) : null) || await chooseNeta(g, kind, length, title, skip);
  const size = r.size || (t.revival ? 'hall' : t.tv ? 'tv' : x.rr.idx === 0 ? 'small' : 'theater');
  const crowd = r.crowd || (t.revival ? 'normal' : x.rr.idx === 0 ? 'tough' : t.tv ? 'warm' : 'normal');
  const venue = { name: g.contestVenue() ? g.contestVenue().venueName : '', size, crowd, pressure: t.tension };
  const st = g.state;
  const cost = t.tv ? 25 : 15;
  if (st.stamina < cost) venue.pressure = clamp(venue.pressure + 15, 0, 100);
  st.stamina = Math.max(0, st.stamina - cost);
  let res = null;
  if (has(g, 'perform')) res = await asafe('perform', () => g.perform({ kind, neta, length, venue, contest: { id: t.id, round: r.id || x.rr.id, name: title }, title, skip }), null);
  if (!res || !Number.isFinite(res.score)) {
    const mg = !skip && has(g, 'minigame') ? await asafe('minigame', () => g.minigame('tsukkomi', { difficulty: clamp(2 + x.rr.idx, 1, 5), skill: 'warai', title }), null) : null;
    const p = I.playerPower(g, kind);
    const sc = mg && Number.isFinite(mg.score) ? mg.score : clamp(Math.round(p * 0.9 + (Math.random() - 0.5) * 20), 0, 100);
    res = { score: sc, rank: sc >= 85 ? 'S' : sc >= 70 ? 'A' : sc >= 50 ? 'B' : sc >= 30 ? 'C' : 'D', laughs: Math.round(sc / 8), big: Math.round(sc / 30), flubs: 0, blanks: 0, overtime: 0, adlib: 0, heat: [sc], parts: { neta: sc, execution: sc, presence: sc, timing: sc, crowd: sc }, comment: '', highlights: [] };
  }
  if (neta && neta.id && neta.id !== 'auto' && has(g, 'markNetaUsed')) safe('markNetaUsed', () => g.markNetaUsed(neta.id, t.id));
  if (has(g, 'addStageExp')) safe('addStageExp', () => g.addStageExp(kind, t.tv ? 3 : 1));
  if (has(g, 'lifeTick')) g.lifeTick({ hunger: -10, stress: t.tv ? 18 : 10, clean: -8 });
  const c = I.cstate(g);
  c.stats.rounds = num(c.stats.rounds) + 1;
  return { res, neta, kind, fs: I.toFieldScore(g, res.score) };
}
function reasonsFor(g, kind, res, need) {
  const out = [];
  if (num(res.overtime) > 0) out.push(I.FAIL_NOTES.overtime[0]);
  if (num(res.flubs) >= 2) out.push(I.FAIL_NOTES.voice[1]);
  if (num(res.blanks) >= 1) out.push('ネタが飛んだ（間が空いてしまった）');
  if (num(res.big) === 0) out.push(I.FAIL_NOTES.tsukami[0]);
  const sf = has(g, 'shortfall') ? safe('shortfall', () => g.shortfall(kind, need), null) : null;
  if (sf && Array.isArray(sf.gaps)) for (const gp of sf.gaps.slice(0, 3)) { const n = I.FAIL_NOTES[gp.key]; out.push(n ? `${n[0]}（${gp.label} ${Math.round(gp.have)}／目安${Math.round(gp.need)}）` : `${gp.label}が足りない（${Math.round(gp.have)}／目安${Math.round(gp.need)}）`); }
  const p = res.parts || {};
  if (Number.isFinite(p.crowd) && p.crowd < 40) out.push(I.FAIL_NOTES.crowd[0]);
  return [...new Set(out)].slice(0, 4);
}
export async function performStep(g, opts = {}) {
  const x = roundOfToday(g);
  if (!x || x.t.done) return null;
  const { t, def, cyc } = x;
  const room = stageRoom(x.r, t.revival);
  const mode = opts.mode || t.mode || 'full';
  t.phase = 'stage';
  if (g.map && g.map.placeId === 'shourace' && mode !== 'auto') {
    await g.goto('shourace', room, undefined, undefined, 'up');
    if (g.map.roomId === room && typeof g.placePlayer === 'function') { const R = PLACES.shourace && PLACES.shourace.rooms[room]; const mic = R && R.mic; if (mic) g.placePlayer(mic[0], mic[1] + 1, 'down'); }
    sfx('applause');
    await sayAs(g, MC, t.tv ? `続いての登場は…エントリーナンバー${x.entry ? x.entry.no : ''}番！\n${x.entry ? x.entry.unitName : ''}！` : `エントリーナンバー${x.entry ? x.entry.no : ''}番、${x.entry ? x.entry.unitName : ''}さんです。どうぞ！`);
  }
  const P = await doPerform(g, x, { mode });
  let out;
  if (t.revival) out = await judgeRevival(g, x, P, mode);
  else if (x.rr.idx === cyc.rounds.length - 1) out = await judgeFinal(g, x, P, mode);
  else out = await judgePrelim(g, x, P, mode);
  // 敗者復活 won → straight into the final the same day
  if (out && out.toFinal) {
    const e = I.entryOf(g, t.id, t.year);
    I.cstate(g).today = { ...t, revival: false, idx: out.toFinal, phase: 'checked', done: false, continueFinal: true, tension: clamp(t.tension + 10, 0, 100) };
    if (e) e.today = { day: I.todayOf(g), done: false };
    setVenue(g, { id: t.id, year: t.year, idx: out.toFinal, option: cyc.rounds[out.toFinal].options[0], cyc, revival: false });
    await g.say('このまま決勝のスタジオへ！');
    return performStep(g, { mode });
  }
  finishToday(g);
  if (mode === 'full' && g.map && g.map.placeId === 'shourace') {
    await g.goto('shourace', 'lobby', 9, 9, 'down');
    await g.say('本番が終わった。出口のマットから帰れる。');
  } else if (g.map && g.map.placeId === 'shourace') await leaveVenue(g, { force: true });
  return out;
}

// ---------------------------------------------------------------- 予選 (staff)
function boardNumbers(g, x, passedMe, P) {
  const c = I.cstate(g);
  const F = Math.max(10, num(x.rr.r.field, 200));
  const opts = Math.max(1, x.rr.options.length);
  const nDay = clamp(Math.round(P / opts), 1, 140);
  const r = I.rngOf(c.seed, 'board', x.t.id, x.t.year, x.rr.idx, x.t.opt);
  const set = new Set();
  const no = x.entry ? x.entry.no : 0;
  let guard = 0;
  while (set.size < nDay && guard++ < 5000) { const v = 1 + Math.floor(r() * F); if (v !== no) set.add(v); }
  const list = [...set];
  if (passedMe && no) { if (list.length >= nDay) list.pop(); list.push(no); }
  return list.sort((a, b) => a - b);
}
async function judgePrelim(g, x, P, mode) {
  const { t, def, cyc, rr, entry } = x;
  const sim = I.simOf(g, t.id, t.year);
  const rd = sim && sim.rounds[rr.idx];
  const fs = P.fs;
  let passed, place, of;
  if (!rd) { passed = fs >= 50; place = null; of = null; }
  else if (rd.exact) {
    const named = rd.sorted.map((aid) => rd.scores.get(aid));
    const above = named.filter((v) => v > fs).length;
    passed = above < rd.P || rd.P >= named.length + 1;
    place = above + 1; of = named.length + 1;
  } else {
    passed = fs >= rd.cut;
    const above = rd.sorted.filter((aid) => rd.scores.get(aid) > fs).length;
    const ms = rd.anonIn > 0 ? anonInputMS(rd) : null;
    const anonAbove = ms ? rd.anonIn * (1 - I.PHI((fs - ms.mS) / ms.sS)) : 0;
    of = Math.round(rd.E);
    place = clamp(Math.round(above + anonAbove + 1), 1, of);
  }
  const need = rd ? Math.round(rd.cut) : 50;
  const reasons = passed ? [] : reasonsFor(g, P.kind, P.res, clamp(need, 30, 90));
  const res = I.resultsOf(g, t.id, t.year, true);
  res.mods.rounds = res.mods.rounds || {};
  res.mods.rounds[rr.idx] = { score: fs, pass: !!passed };
  res.rounds[rr.idx] = { day: I.todayOf(g), score: P.res.score, fs: Math.round(fs * 10) / 10, rank: P.res.rank, passed: !!passed, place, of, cut: rd ? Math.round(rd.cut * 10) / 10 : null, exact: rd ? rd.exact : false, reasons, laughs: P.res.laughs, big: P.res.big, flubs: P.res.flubs, overtime: P.res.overtime, numbers: null, opt: t.opt };
  I.bump(g, t.id, t.year);
  const nextFirst = cyc.rounds[rr.idx + 1] ? cyc.rounds[rr.idx + 1].first : Infinity;
  const announceNow = x.r.announce === 'now' || (x.r.judge && x.r.judge !== 'staff') || nextFirst <= I.todayOf(g) + 0;
  const feel = P.res.score >= 80 ? '大きな笑いが何度も起きた。手応えは十分だ！' : P.res.score >= 60 ? 'ウケた。手応えはまずまず。' : P.res.score >= 40 ? '笑いはぽつぽつ…。手応えは微妙だ。' : '客席は静かだった…。手応えはない。';
  if (mode !== 'auto') await g.say([`ネタを終えた。（${P.res.rank}ランク・笑い${num(P.res.laughs)}回／爆笑${num(P.res.big)}回${num(P.res.flubs) ? `・噛み${P.res.flubs}回` : ''}${num(P.res.overtime) > 0 ? `・尺オーバー${Math.round(P.res.overtime)}秒` : ''}）`, feel]);
  if (announceNow) { await announcePrelim(g, t.id, t.year, rr.idx, mode !== 'auto'); return { passed }; }
  entry.pending = { round: rr.idx, day: I.todayOf(g) };
  const med = I.resultMedium(x.cyc.year);
  if (mode !== 'auto') await sayAs(g, STAFF, `おつかれさまでした！\n結果は今夜、${med.short}で発表します。`);
  return { passed, pending: true };
}
function anonInputMS(rd) {
  // the anonymous field's score distribution entering this round (kept for the place estimate)
  return rd.anonInMS || rd.anonMS || { mS: 30, sS: 12 };
}
// The results of a 予選 round for the player (now, or the next morning): entry, rewards, the board, a message.
async function announcePrelim(g, id, year, idx, show) {
  const def = CONTESTS[id];
  const cyc = I.cycleOf(g, def, year);
  const e = I.entryOf(g, id, year);
  const res = I.resultsOf(g, id, year, true);
  const rd = res.rounds[idx];
  if (!e || !rd) return;
  e.pending = null;
  const rr = cyc.rounds[idx];
  const name = label(def, cyc);
  const passed = !!rd.passed;
  e.results = (e.results || []).filter((x) => x.round !== idx);
  e.results.push({ round: idx, roundId: rr.id, name: rr.name, score: rd.score, rank: rd.rank, passed, place: rd.place, of: rd.of, day: rd.day });
  const next = cyc.rounds[idx + 1];
  const c = I.cstate(g);
  if (passed) {
    e.status = 'passed';
    e.round = idx + 1;
    c.stats.passed = num(c.stats.passed) + 1;
    if (next) { const fut = next.options.filter((o) => o.day > I.todayOf(g) - (next.options.length === 1 ? 1 : 0)); e.picks = e.picks || {}; e.picks[idx + 1] = (fut[0] || next.options[0]).k; }
    I.applyReward(g, id, 'pass', { round: idx, roundsTotal: cyc.rounds.length, tv: !!rr.r.tv });
    if (next && idx + 1 === cyc.rounds.length - 1) { c.stats.finals = num(c.stats.finals) + 1; I.applyReward(g, id, 'finalist', { tv: !!next.r.tv, year }); }
  } else {
    e.status = 'out';
    I.applyReward(g, id, 'out', {});
    if (next && next.r.revival) e.revivalOk = idx + 1;
  }
  I.bump(g, id, year);
  const sim = I.simOf(g, id, year);
  const srd = sim && sim.rounds[idx];
  const numbers = boardNumbers(g, { t: { id, year, opt: rd.opt ?? 0 }, rr, entry: e }, passed, srd ? srd.P : 10);
  rd.numbers = numbers.length <= 160 ? numbers : null;
  const nextTxt = next && passed ? `${next.name}：${I.dateText(g, (next.options[e.picks[idx + 1]] || next.options[0]).day)}　${(next.options[e.picks[idx + 1]] || next.options[0]).venue}` : '';
  const reasons = rd.reasons && rd.reasons.length ? `\n【実力不足の点】\n${rd.reasons.map((s) => `・${s}`).join('\n')}` : '';
  const placeTxt = rd.place ? (srd && srd.exact ? `（${rd.of}組中 ${rd.place}位）` : `（推定 ${Math.round(num(rd.of)).toLocaleString('ja-JP')}組中 ${Math.round(rd.place).toLocaleString('ja-JP')}位前後）`) : '';
  const text = passed
    ? `【合格】${name} ${rr.name}\nエントリーナンバー${e.no}番 ${e.unitName} は合格です！${placeTxt}\n${nextTxt ? `次は${nextTxt}` : ''}${next && next.r.revival ? '' : ''}`
    : `【結果】${name} ${rr.name}\nエントリーナンバー${e.no}番 ${e.unitName} は、残念ながら不合格でした。${placeTxt}${next && next.r.revival && e.revivalOk != null ? `\n（${next.r.revivalName || '敗者復活戦'}に出られます：${I.dateText(g, next.first)}）` : ''}${reasons}`;
  I.pushNews(g, text, { personal: true, contest: id, prio: 98 });
  if (passed && I.prestigeOf(def) >= 70 && idx + 1 === cyc.rounds.length - 1) I.pushNews(g, `${name}、決勝進出者に${e.unitName}の名前！\n予選を勝ち抜いた新顔に注目が集まる。`, { contest: id, prio: 80, key: `fin|${id}|${year}|player` });
  if (show) {
    if (CONTEST_UI.board && showUI(g)) await asafe('board', () => CONTEST_UI.board(g, { title: `${name}`, sub: `${rr.name} ${rd.opt != null && rr.options[rd.opt] ? `${rr.options[rd.opt].venue}会場 ` : ''}合格者`, numbers, mine: e.no, passed, place: rd.place, of: rd.of, exact: !!(srd && srd.exact), names: srd && srd.exact ? srd.passed.map((aid) => (sim.byId.get(aid) || {}).name).filter(Boolean) : null, color: I.colorOf(def), reasons: rd.reasons, next: nextTxt }), null);
    sfx(passed ? 'fanfare' : 'cancel');
    await g.say(passed ? [`合格！${rr.name}を突破した！`, nextTxt ? `次は${nextTxt}。` : '次へ進む！'] : ['不合格…。ここで敗退だ。', ...(rd.reasons && rd.reasons.length ? [`実力不足の点：\n${rd.reasons.slice(0, 2).map((s) => `・${s}`).join('\n')}`] : [])]);
  }
}

// ---------------------------------------------------------------- 敗者復活戦
async function judgeRevival(g, x, P, mode) {
  const { t, def, cyc } = x;
  const idx = t.idx;
  const rr = cyc.rounds[idx];
  const r = rr.r;
  const sim = I.simOf(g, t.id, t.year);
  const rd = sim && sim.rounds[idx];
  const rv = rd && rd.revival;
  const k = Math.max(1, num(r.revivalPass, 1));
  const fs = P.fs;
  const others = rv ? rv.pool.map((aid) => ({ id: aid, name: (sim.byId.get(aid) || {}).name, score: rv.scores.get(aid) })).sort((a, b) => b.score - a.score) : [];
  const above = others.filter((o) => o.score > fs).length;
  const win = above < k;
  const res = I.resultsOf(g, t.id, t.year, true);
  res.mods.revival = res.mods.revival || {};
  res.mods.revival[idx] = { score: fs, win };
  res.rounds[`rev${idx}`] = { day: I.todayOf(g), score: P.res.score, fs, win, place: above + 1, of: others.length + 1 };
  I.bump(g, t.id, t.year);
  const e = I.entryOf(g, t.id, t.year);
  // votes: audience / viewers (the scores turned into vote counts)
  const total = 1000 + Math.floor(I.rngOf(I.cstate(g).seed, 'votes', t.id, t.year)() * 9000);
  const pool = [{ name: e ? e.unitName : 'あなた', score: fs, me: true }, ...others.slice(0, 9)];
  const w = pool.map((p) => Math.exp((p.score - 50) / 8));
  const sw = w.reduce((a, b) => a + b, 0);
  const rows = pool.map((p, i) => ({ name: p.name, votes: Math.round((w[i] / sw) * total), me: !!p.me })).sort((a, b) => b.votes - a.votes);
  if (win && rows[0] && !rows[0].me) { const mi = rows.findIndex((x2) => x2.me); const tv = rows[0].votes; rows[0].votes = rows[mi].votes; rows[mi].votes = tv; rows.sort((a, b) => b.votes - a.votes); }
  if (CONTEST_UI.votes && mode !== 'auto' && showUI(g)) await asafe('votes', () => CONTEST_UI.votes(g, { title: `${label(def, cyc)} ${r.revivalName || '敗者復活戦'}`, rows, color: I.colorOf(def), unit: r.revivalJudge === 'panel' ? '点' : '票' }), null);
  if (win) {
    sfx('fanfare');
    if (e) { e.status = 'passed'; e.round = idx; e.picks = e.picks || {}; e.picks[idx] = 0; e.revivalOk = null; e.results.push({ round: idx, revival: true, score: P.res.score, passed: true, place: 1, of: others.length + 1, day: I.todayOf(g) }); }
    I.applyReward(g, t.id, 'revival', { tv: true });
    I.applyReward(g, t.id, 'finalist', { tv: !!r.tv, year: t.year });
    I.cstate(g).stats.finals = num(I.cstate(g).stats.finals) + 1;
    I.pushNews(g, `${label(def, cyc)}の${r.revivalName || '敗者復活戦'}は${e ? e.unitName : ''}が勝ち上がり！\n決勝の最後の1枠をつかんだ。`, { contest: t.id, prio: 85, key: `rev|${t.id}|${t.year}` });
    if (mode !== 'auto') await g.say(['敗者復活！！', '決勝の舞台へ、最後の切符をつかんだ！']);
    return { win, toFinal: idx };
  }
  if (e) { e.revivalOk = null; e.results.push({ round: idx, revival: true, score: P.res.score, passed: false, place: above + 1, of: others.length + 1, day: I.todayOf(g) }); }
  if (mode !== 'auto') await g.say([`${r.revivalName || '敗者復活戦'}、勝ち上がれなかった…。`, `勝ち上がったのは${others[0] ? others[0].name : 'ライバル'}。`]);
  I.bump(g, t.id, t.year);
  return { win };
}

// ---------------------------------------------------------------- 決勝 (panel / points / audience)
function finalOrder(g, x, ids) {
  const r = I.rngOf(I.cstate(g).seed, 'forder', x.t.id, x.t.year);
  const all = [...ids, 'player'];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}
async function judgeFinal(g, x, P, mode) {
  const { t, def, cyc, rr } = x;
  const r = rr.r;
  const id = t.id, year = t.year;
  const sim0 = I.simOf(g, id, year);
  const rd0 = sim0 && sim0.rounds[rr.idx];
  const scale = I.scaleOf(r);
  const panel = r.judge === 'panel' || r.judge === 'points' || (!r.judge && r.final !== false);
  const judges = panel ? I.judgesFor(g, id, year, num(r.judges, 0) || undefined) : [];
  const ps = panel ? I.panelScores(judges, P.fs, P.res.parts, scale, I.rngOf(I.cstate(g).seed, id, year, 'panel', 'player')) : { per: [], total: Math.round(P.fs * 10) / 10, max: 100 };
  const comments = judges.map((j, i) => ({ name: j.name, short: j.short, pts: ps.per[i] ? ps.per[i].pts : null, text: I.judgeComment(I.rngOf(id, year, 'cm', i), j, P.fs, P.res) }));
  const res = I.resultsOf(g, id, year, true);
  res.mods.final = { score: P.fs, total: ps.total };
  I.bump(g, id, year);
  let sim = I.simOf(g, id, year);
  let fin = sim ? sim.final : { ranking: ['player'], totals: { player: ps.total } };
  const order = finalOrder(g, x, rd0 ? rd0.passed : []);
  const nameOf = (aid) => (aid === 'player' ? (x.entry ? x.entry.unitName : 'あなた') : ((sim && sim.byId.get(aid)) || {}).name || '？');
  const rowsAt = (upto) => order.slice(0, upto).map((aid) => ({ name: nameOf(aid), total: fin.totals[aid], me: aid === 'player' })).sort((a, b) => b.total - a.total);
  const myPos = order.indexOf('player');
  if (mode !== 'auto' && showUI(g)) {
    if (CONTEST_UI.scoreboard) await asafe('scoreboard', () => CONTEST_UI.scoreboard(g, { title: `${label(def, cyc)} ${rr.name}`, color: I.colorOf(def), judges: judges.map((j, i) => ({ name: j.name, short: j.short, title: j.title, pts: ps.per[i] ? ps.per[i].pts : null })), total: ps.total, max: ps.max, comments, unit: x.entry ? x.entry.unitName : '', standings: rowsAt(myPos + 1), order: myPos + 1, of: order.length, panel }), null);
    else await g.say(`採点：${ps.total}点${panel ? `（${judges.map((j, i) => `${j.short} ${ps.per[i].pts}`).join('・')}）` : ''}`);
    for (const cm of comments.slice(0, 2)) await g.say(cm.text, { name: cm.name });
  }
  // stage 2 (最終決戦)
  let ranking = fin.ranking;
  if (r.stage2 && ranking.indexOf('player') >= 0 && ranking.indexOf('player') < clamp(num(r.stage2.top, 3), 2, ranking.length)) {
    if (mode !== 'auto') await g.say([`${r.stage2.name || '最終決戦'}に進出！`, 'もう一本、ネタをやる！']);
    const P2 = await doPerform(g, x, { mode });
    res.mods.final.stage2 = P2.fs;
    I.bump(g, id, year);
    sim = I.simOf(g, id, year);
    fin = sim ? sim.final : fin;
    ranking = fin.ranking;
    if (fin.stage2 && mode !== 'auto' && CONTEST_UI.votes && showUI(g)) await asafe('votes2', () => CONTEST_UI.votes(g, { title: `${label(def, cyc)} ${r.stage2.name || '最終決戦'}`, rows: fin.stage2.order.map((aid) => ({ name: nameOf(aid), votes: fin.stage2.votes[aid], me: aid === 'player' })), color: I.colorOf(def), unit: '票' }), null);
  }
  const place = ranking.indexOf('player') + 1;
  res.final = { place, of: ranking.length, total: ps.total, per: ps.per.map((p) => p.pts), judges: judges.map((j) => j.name), ranking: ranking.slice(0, 20).map((aid) => ({ name: nameOf(aid), total: fin.totals[aid], me: aid === 'player', ...(fin.stage2 && fin.stage2.order.includes(aid) ? { votes: fin.stage2.votes[aid] } : {}) })), stage2: fin.stage2 ? { order: fin.stage2.order.map(nameOf), votes: fin.stage2.order.map((aid) => fin.stage2.votes[aid]) } : null };
  res.rounds[rr.idx] = { day: I.todayOf(g), score: P.res.score, fs: P.fs, rank: P.res.rank, passed: place === 1, place, of: ranking.length, total: ps.total };
  const e = x.entry;
  if (e) {
    e.results = (e.results || []).filter((q) => q.round !== rr.idx || q.revival);
    e.results.push({ round: rr.idx, roundId: rr.id, name: rr.name, score: P.res.score, rank: P.res.rank, passed: place === 1, place, of: ranking.length, total: ps.total, day: I.todayOf(g) });
    e.status = place === 1 ? 'champion' : 'out';
    e.final = { place, total: ps.total };
  }
  const c = I.cstate(g);
  if (place === 1) c.stats.wins = num(c.stats.wins) + 1;
  // reaching the final already paid 'finalist' (announcePrelim / a revival); the podium pays on top
  if (place <= 3) I.applyReward(g, id, place === 1 ? 'champion' : place === 2 ? 'runnerup' : 'third', { tv: !!(r.tv || r.final), year, prize: true });
  else I.applyReward(g, id, 'out', {});
  freeze(g, id, year);
  const name = label(def, cyc);
  const champName = nameOf(ranking[0]);
  if (place === 1) I.pushNews(g, `【速報】${name}、${champName}が優勝！\n${I.prizeOf(def, year).text ? `${I.prizeOf(def, year).text}を手にした。` : ''}決勝${ranking.length}組の頂点に立った。`, { contest: id, prio: 99, key: `champ|${id}|${year}` });
  else I.pushNews(g, `【速報】${name}は${champName}が優勝。\n${e ? e.unitName : ''}は${place}位（${ranking.length}組中）。`, { contest: id, prio: 90, key: `champ|${id}|${year}` });
  if (mode !== 'auto' && showUI(g) && CONTEST_UI.board) await asafe('finalBoard', () => CONTEST_UI.board(g, { title: name, sub: `${rr.name} 最終順位`, ranking: res.final.ranking, color: I.colorOf(def), champion: place === 1 }), null);
  if (mode !== 'auto') {
    if (place === 1) { sfx('fanfare'); if (has(g, 'shake')) g.shake(20, 2); await g.say([`優勝！！！`, `${name}、王者になった！`]); }
    else await g.say(`${ranking.length}組中 ${place}位。\n優勝は${champName}だった。`);
  }
  return { place };
}
// The final's result into the world's history (it no longer changes).
function freeze(g, id, year) {
  const c = I.cstate(g);
  const def = CONTESTS[id];
  const sim = I.simOf(g, id, year);
  if (!sim) return;
  const rk = sim.final.ranking;
  const nameOf = (aid) => (aid === 'player' ? I.playerUnitName(g) : (sim.byId.get(aid) || {}).name || '');
  if (!c.hist[id]) c.hist[id] = {};
  c.hist[id][year] = { edition: I.editionIn(g, def, year), revival: !!I.heldIn(g, def, year).revival, champion: nameOf(rk[0]), champId: rk[0] || null, runnerUp: rk[1] ? nameOf(rk[1]) : null, runnerId: rk[1] || null, third: rk[2] ? nameOf(rk[2]) : null, finalists: rk.slice(0, 12).map(nameOf), note: I.heldIn(g, def, year).revival ? '復刻開催' : '', player: rk.includes('player') ? rk.indexOf('player') + 1 : null, deep: {} };
  sim.rounds.forEach((rd, i) => { if (i >= sim.rounds.length - 3) for (const aid of rd.entrants) c.hist[id][year].deep[aid] = i; });
}

// ================================================================ record (custom flows: E1 / E2)
// res: { passed, score, place, of, champion, runnerUp, third, total, revival } — applies it to the entry (status, round),
// rewards (opts.reward !== false), news (opts.news !== false); a final result freezes this world's history.
function record(g, id, idx, res = {}, opts = {}) {
  const def = CONTESTS[id];
  if (!def || !g.state) return null;
  const year = opts.year ?? I.seasonYearOf(g, id);
  const cyc = I.cycleOf(g, def, year);
  const e = I.entryOf(g, id, year) || I.registerEntry(g, id, { year });
  const rr = cyc.rounds[idx];
  if (!e || !rr) return null;
  const last = idx === cyc.rounds.length - 1;
  e.results = (e.results || []).filter((q) => q.round !== idx || q.revival);
  e.results.push({ round: idx, roundId: rr.id, name: rr.name, score: num(res.score, null), rank: res.rank || null, passed: !!res.passed, place: res.place ?? null, of: res.of ?? null, day: I.todayOf(g), revival: !!res.revival });
  const R = I.resultsOf(g, id, year, true);
  R.rounds[idx] = { day: I.todayOf(g), score: num(res.score, null), passed: !!res.passed, place: res.place ?? null, of: res.of ?? null, custom: true };
  if (last) {
    const place = res.champion ? 1 : num(res.place, res.passed ? 1 : 99);
    e.status = place === 1 ? 'champion' : 'out';
    e.final = { place, total: res.total ?? null };
    if (Number.isFinite(res.fs) || Number.isFinite(res.total)) { R.mods.final = { score: num(res.fs, num(res.score, 50)), total: num(res.total, num(res.score, 50)) }; }
    if (opts.reward !== false) I.applyReward(g, id, place === 1 ? 'champion' : place === 2 ? 'runnerup' : place === 3 ? 'third' : 'out', { tv: !!rr.r.tv, year });
    I.bump(g, id, year);
    if (!res.champion && res.place == null && !res.passed) { /* nothing to freeze precisely */ }
    if (opts.freeze !== false) freeze(g, id, year);
    const c = I.cstate(g);
    if (place === 1) { c.stats.wins = num(c.stats.wins) + 1; const ch = c.hist[id] && c.hist[id][year]; if (ch) { ch.champion = I.playerUnitName(g); ch.champId = 'player'; ch.player = 1; } }
  } else if (res.passed) {
    e.status = 'passed';
    e.round = idx + 1;
    if (opts.reward !== false) I.applyReward(g, id, 'pass', { round: idx, roundsTotal: cyc.rounds.length, tv: !!rr.r.tv });
    if (opts.reward !== false && idx + 1 === cyc.rounds.length - 1) { I.cstate(g).stats.finals = num(I.cstate(g).stats.finals) + 1; I.applyReward(g, id, 'finalist', { tv: !!cyc.rounds[idx + 1].r.tv, year }); }
    if (Number.isFinite(res.fs)) { R.mods.rounds = R.mods.rounds || {}; R.mods.rounds[idx] = { score: res.fs, pass: true }; }
  } else {
    e.status = 'out';
    if (opts.reward !== false) I.applyReward(g, id, 'out', {});
    const next = cyc.rounds[idx + 1];
    if (next && next.r.revival) e.revivalOk = idx + 1;
  }
  I.bump(g, id, year);
  const t = today(g);
  if (t && t.id === id && t.year === year) finishToday(g);
  return e;
}

// ================================================================ the morning (called by contests.js)
async function morning(g) {
  const c = I.cstate(g);
  const day = I.todayOf(g);
  // 1. results announced this morning
  for (const id of Object.keys(c.entries)) for (const y of Object.keys(c.entries[id] || {})) {
    const e = c.entries[id][y];
    if (e && e.pending && num(e.pending.day) < day) safe(`announce:${id}`, () => announcePrelim(g, id, Number(y), e.pending.round, false));
  }
  // 2. missed rounds → 棄権
  for (const id of Object.keys(c.entries)) for (const y of Object.keys(c.entries[id] || {})) {
    const e = c.entries[id][y];
    const def = CONTESTS[id];
    if (!e || !def || e.pending) continue;
    const cyc = I.cycleOf(g, def, Number(y));
    if (!cyc || !cyc.held) continue;
    if (e.status === 'entered' || e.status === 'passed') {
      const rr = cyc.rounds[e.round];
      if (!rr) continue;
      const o = rr.options[num(e.picks && e.picks[e.round], 0)] || rr.options[0];
      const did = e.today && e.today.day === o.day && e.today.done;
      if (o.day < day && !did) {
        withdraw(g, id, Number(y), '欠席（棄権）');
        I.pushNews(g, `【棄権】${label(def, cyc)} ${rr.name}\n${I.dateText(g, o.day)}の${o.venue}会場に来られなかったため、棄権扱いとなりました。`, { personal: true, contest: id, prio: 92 });
      }
    } else if (e.status === 'out' && e.revivalOk != null) {
      const rr = cyc.rounds[e.revivalOk];
      if (rr && rr.options[0].day < day) e.revivalOk = null;
    }
  }
  // 3. today's rounds (reminders + a morning note) and tomorrow's
  const dev = eraOf(g.state).deviceShort || 'スマホ';
  const due = I.dueOn(g, day);
  for (const d of due) {
    const def = CONTESTS[d.id];
    const rn = d.revival ? d.cyc.rounds[d.idx].r.revivalName || '敗者復活戦' : d.cyc.rounds[d.idx].name;
    I.pushNews(g, `【本日】${label(def, d.cyc)} ${rn}\n会場：${d.option.venue}　受付で番号（${d.entry.no}番）を伝えてください。\n${dev}の「賞レース」→「会場へ向かう」から出発。来なければ棄権になります。`, { personal: true, contest: d.id, prio: 96, key: `today|${d.id}|${d.year}|${d.idx}|${d.revival ? 'r' : ''}` });
    (g.morningNotes || (g.morningNotes = [])).push(`（今日は${I.contestName(def, d.year)}の${rn}！\n${dev}の「賞レース」から会場へ向かおう）`);
  }
  if (due.length > 1) (g.morningNotes || (g.morningNotes = [])).push('（大会が同じ日に重なっている…！\n出られるのはどちらか一方だけだ）');
  for (const d of I.dueOn(g, day + 1)) {
    const def = CONTESTS[d.id];
    I.pushNews(g, `【明日】${label(def, d.cyc)} ${d.revival ? '敗者復活戦' : d.cyc.rounds[d.idx].name}（${d.option.venue}会場）\nネタの仕上げと体調管理を！`, { personal: true, contest: d.id, prio: 60, key: `tmr|${d.id}|${d.year}|${d.idx}` });
  }
  // 4. every contest: entry windows, invitations, simulated results, champions, history
  for (const def of Object.values(CONTESTS)) safe(`season:${def.id}`, () => seasonNews(g, def, day));
}
function seasonNews(g, def, day) {
  const y0 = I.seasonYearOf(g, def, day - 1), y1 = I.seasonYearOf(g, def, day);
  seasonNewsYear(g, def, day, y0);
  if (y1 !== y0) seasonNewsYear(g, def, day, y1);
}
function seasonNewsYear(g, def, day, year) {
  const id = def.id;
  const c = I.cstate(g);
  const pr = I.prestigeOf(def);
  const cyc = I.cycleOf(g, def, year);
  if (!cyc || !cyc.held) return;
  const name = label(def, cyc);
  const e = I.entryOf(g, id, year);
  const played = !!(c.entries[id] && Object.keys(c.entries[id]).length);
  // entry window
  if (cyc.entry && cyc.entry.from === day) {
    const extra = Array.isArray(def.news) && def.news.length ? def.news[day % def.news.length] : null;
    const ex = typeof extra === 'function' ? safe(`news:${id}`, () => extra(g, makeCtx(g, id, year)), null) : extra;
    I.pushNews(g, `${name}、エントリー受付スタート！\n締切は${I.dateText(g, cyc.entry.to)}。${I.feeOf(g, id, year).yen ? `参加費${I.yenLabel(I.feeOf(g, id, year).yen)}。` : ''}${ex ? `\n${ex}` : ''}`, { contest: id, prio: 20 + pr * 0.5, key: `open|${id}|${year}` });
    lastYearNews(g, def, year);
  }
  if (cyc.entry && !e && cyc.entry.to - day === 3 && (pr >= 45 || played)) {
    const el = I.eligibilityOf(g, id, year);
    if (el.ok) I.pushNews(g, `${name}のエントリー締切まで、あと3日。\n（参加費${I.feeOf(g, id, year).text}・「賞レース」からエントリーできる）`, { personal: true, contest: id, prio: 55, key: `close3|${id}|${year}` });
  }
  if (cyc.entry && cyc.entry.to === day - 1) {
    const F = Math.max(10, num(cyc.rounds[0].r.field, 200));
    const n = Math.round(F * (0.93 + I.rngOf(c.seed, 'fieldn', id, year)() * 0.12));
    I.pushNews(g, `${name}、エントリー締切。総エントリー数は${n.toLocaleString('ja-JP')}組（大会発表）。`, { contest: id, prio: 10 + pr * 0.45, key: `count|${id}|${year}` });
  }
  // invitations (招待制): about 20 days before the first round
  if (cyc.invite && !e && day === cyc.rounds[0].first - 20) {
    const el = I.eligibilityOf(g, id, year);
    if (el.ok) {
      if (!c.invites) c.invites = {};
      if (!c.invites[id]) c.invites[id] = {};
      if (!c.invites[id][year]) {
        c.invites[id][year] = day;
        const host = I.hostPerson(I.rngOf(c.seed, 'host', id));
        I.pushNews(g, `【出場のお願い】${name}\n${g.state.name}さんに、ぜひ出場していただきたく連絡しました。\n本番：${I.dateText(g, cyc.rounds[0].first, { year: true })}　${cyc.rounds[0].options[0].venue}\n「賞レース」アプリから出場をお返事ください。`, { personal: true, contest: id, prio: 94, from: `${I.contestName(def, year)} 制作 ${host.name}` });
      }
    }
  }
  // simulated results of the rounds that ended yesterday
  const sim = cyc.rounds.some((rr) => rr.last === day - 1) ? I.simOf(g, id, year) : null;
  if (!sim) return;
  const R = cyc.rounds.length;
  for (const rr of cyc.rounds) {
    if (rr.last !== day - 1) continue;
    const rd = sim.rounds[rr.idx];
    if (!rd) continue;
    const nm = (aid) => (aid === 'player' ? (e ? e.unitName : I.playerUnitName(g)) : (sim.byId.get(aid) || {}).name || '');
    if (rr.idx === R - 1) {
      const champ = sim.final.ranking[0];
      if (!c.hist[id] || !c.hist[id][year]) freeze(g, id, year);
      const cn = nm(champ);
      if (champ !== 'player') I.pushNews(g, `${name}は${cn}が優勝！\n準優勝は${nm(sim.final.ranking[1]) || '—'}。${I.prizeOf(def, year).text ? `${I.prizeOf(def, year).text}は${cn}の手に。` : ''}`, { contest: id, prio: 15 + pr * 0.7, key: `champ|${id}|${year}` });
      if (pr >= 55) {
        c.later = c.later || [];
        c.later.push({ day: day + 1, text: `【王者の会見】${name}を制した${cn}が会見。\n「${pickQuote(g, id, year)}」`, contest: id, prio: 20 + pr * 0.4 });
        const nv = I.netVoice(year);
        const lines = [0, 1, 2].map((k) => `${I.pickR(I.rngOf(c.seed, 'nvw', id, year, k), nv.who)}「${I.fillName(I.pickR(I.rngOf(c.seed, 'nv', id, year, k), champ === 'player' ? I.NET_LINES.player : I.NET_LINES.champ), cn)}」`);
        c.later.push({ day: day + 2, text: `【${nv.label}】${name}\n${lines.join('\n')}`, contest: id, prio: 10 + pr * 0.3 });
      }
      continue;
    }
    if (pr < 55 && rr.idx < R - 2) continue;
    const next = cyc.rounds[rr.idx + 1];
    if (rr.idx === R - 2) {
      const fin = sim.rounds[R - 1].entrants.filter((aid) => !(sim.rounds[R - 1].revival && sim.rounds[R - 1].revival.winners.includes(aid)));
      const names = fin.map(nm).filter(Boolean);
      if (e && e.status === 'passed' && e.round === R - 1 && !names.includes(e.unitName)) names.push(e.unitName);
      I.pushNews(g, `${name} 決勝進出者決定！（${names.length}組）\n${names.slice(0, 10).join('・')}${names.length > 10 ? ' ほか' : ''}${next && next.r.revival ? `\n＋${next.r.revivalName || '敗者復活戦'}の勝者` : ''}`, { contest: id, prio: 15 + pr * 0.65, key: `finalists|${id}|${year}` });
    } else {
      I.pushNews(g, `${name} ${rr.name}の結果発表。${Math.round(rd.P).toLocaleString('ja-JP')}組が${next ? next.name : '次'}へ。${highlight(g, sim, rd, id, year)}`, { contest: id, prio: 8 + pr * 0.35, key: `round|${id}|${year}|${rr.idx}` });
    }
    // an upset: a favourite out
    const fav = rd.entrants.map((aid) => sim.byId.get(aid)).filter(Boolean).sort((a, b) => b.power - a.power).slice(0, 4).find((x) => !rd.passed.includes(x.id));
    if (fav && pr >= 55 && rr.idx >= R - 3) I.pushNews(g, `【波乱】優勝候補の${fav.name}が${rr.name}で敗退。\n${I.fillName(I.pickR(I.rngOf(c.seed, 'up', id, year, rr.idx), I.NET_LINES.upset), fav.name)}（${I.netVoice(year).label}より）`, { contest: id, prio: 12 + pr * 0.4, key: `upset|${id}|${year}|${rr.idx}` });
  }
}
function highlight(g, sim, rd, id, year) {
  const best = rd.passed.slice().sort((a, b) => rd.scores.get(b) - rd.scores.get(a))[0];
  const x = best && sim.byId.get(best);
  if (!x) return '';
  const r = I.rngOf(I.cstate(g).seed, 'hl', id, year, rd.i);
  return `\n会場を一番わかせたのは${x.name}。${I.pickR(r, ['「ツカミから最後まで笑いが途切れなかった」（関係者）', '「今年の台風の目」との声も。', 'ネタ終わりに拍手が鳴りやまなかった。', '客席の空気を一変させた。'])}`;
}
function pickQuote(g, id, year) {
  const r = I.rngOf(I.cstate(g).seed, 'quote', id, year);
  return I.pickR(r, ['まだ実感がないです。明日起きたら夢やったらどうしよう', '相方と、ネタを書き続けてよかったです', '去年の悔しさがあったから、ここまで来られました', '応援してくれた人に、やっと恩返しができます', 'これからが本当のスタートやと思ってます', '賞金は…まず実家の冷蔵庫を買い替えます']);
}
// news about the world's acts at the start of a big contest's season: the last-year acts (ラストイヤー)
function lastYearNews(g, def, year) {
  if (I.prestigeOf(def) < 70) return;
  const el = def.eligibility && typeof def.eligibility === 'object' ? def.eligibility : {};
  if (el.unitYearsMax == null && el.geirekiMax == null) return;
  const sim = I.simOf(g, def.id, year);
  if (!sim) return;
  const last = sim.field.filter((e2) => (el.unitYearsMax != null && year - e2.act.formed === el.unitYearsMax) || (el.geirekiMax != null && year - e2.act.debut === el.geirekiMax)).sort((a, b) => b.power - a.power).slice(0, 2);
  if (!last.length) return;
  I.pushNews(g, `ラストイヤーの${last.map((x) => x.name).join('、')}、「今年で最後。悔いは残さない」。\n${I.contestName(def, year)}への思いを語った。`, { contest: def.id, prio: 18, key: `lastyear|${def.id}|${year}` });
}
// news held for a later morning (王者の会見, ネットの反応)
function laterNews(g) {
  const c = I.cstate(g);
  if (!Array.isArray(c.later) || !c.later.length) return;
  const day = I.todayOf(g);
  const now = c.later.filter((x) => num(x.day) <= day);
  c.later = c.later.filter((x) => num(x.day) > day);
  for (const x of now) I.pushNews(g, x.text, { contest: x.contest, prio: x.prio });
}

// ================================================================ running the day's round without the venue walk (tests, おまかせ)
async function runToday(g, id, opts = {}) {
  const due = I.dueOn(g).filter((d) => !id || d.id === id);
  if (!due.length) return null;
  return runItem(g, due[0], opts.mode || 'auto', !!opts.venue);
}

export const runner = {
  enter, go, runToday, record, odds: (g, id, round) => oddsOf(g, id, round ?? (I.entryOf(g, id) ? I.entryOf(g, id).round : 0)),
  morning: async (g) => { await morning(g); laterNews(g); },
};
// leaving the venue in the middle of a round day: 当日棄権 (no travel; the caller moves the player)
function withdrawToday(g) {
  const t = today(g);
  if (!t || t.done) return;
  withdraw(g, t.id, t.year, '当日棄権');
  finishToday(g);
}
export const venue = { withdrawToday, reception, practice, debayashi, mirror, breathe, stageCall, performStep, leaveVenue, today, roundOfToday, tensionNow, travelCost, label, stageRoom };
