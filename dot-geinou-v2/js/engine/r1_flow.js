// 賞レースの完全再現エンジン (owner: E3) — the season, the rounds and every scene of an exhaustive contest, driven by a
// contest config (contest_r1.js: R-1ぐらんぷり / R-1グランプリ, contest_abc.js: ABCお笑い(新人)グランプリ).
//
//   const C = makeContest(cfg)   → { id, key, state(g), season(g, Y), now(g), rules(Y), entry(g), prep(g), go(g),
//                                    morning(g), status(g), history(g), app(g), recap(g) … }
// A season Y is named after the year of its final (R-1グランプリ2027 → its entries are taken in autumn 2026).
// Everything runs every year without the player too: a seeded field of fictional entrants (notables with storylines and
// anonymous ones), round cuts from the round's strength distribution, the final with fictional judges, a champion.
// The player's run: エントリー用紙 → エントリーナンバー → 準備（ネタ合わせ・フリップ…） → each round day (受付 → 楽屋 →
// 出囃子確認 → (リハーサル) → 舞台袖 → 本番 → 結果 / 実力不足) → 決勝進出者発表会見 (キャッチコピー) → 決勝 (PV, 審査,
// 最終決戦, 優勝発表) → 賞金・オファー・ニュース → この大会のあなたの記録.
import { SW, SH, clamp, fmtMoney } from './util.js';
import { measure } from './draw.js';
import { LOOKS } from './sprites.js';
import { registerItem } from './state.js';
import { registerPhoneApp } from './life.js';
import {
  has, safe, num, n0, realYen, plainYen, toInternal, eraId, devWord, rngOf, gauss, rint, pickR, shuffleR,
  cdate, absIdx, dayOf, dateText, dateTextY, randomLook, actInfo, powerOf, qualityOf, chooseNeta, netaUsedBefore,
  performAct, playerTotal, rivalTotal, cutScore, shortfallReasons, kitMorning, runKitMorning, morningNote, goRefusal,
  d1Hub, statOf, sendOffer, realNameLike, isAutoNeta, samePenalty, nameGender, contestMail,
} from './r1_kit.js';
import {
  THEMES, T, fit, jwrap, para, R, box, frame, alpha, drawBig, faceAt, confetti, stage, unstage, card, drumroll, infoCard, sfx, sizeFor,
} from './r1_scenes.js';

const STAFF = { name: '受付スタッフ', look: LOOKS.receptionist };
const SOUND = { name: '音響スタッフ', look: { ...LOOKS.cameraman, hat: '#2a2d36' } };
const KANTOKU = { name: '舞台監督', look: LOOKS.staff };
const AD = { name: 'フロアディレクター', look: LOOKS.ad };
const ME = (g) => ({ name: g.state.name, look: g.state.look });

// ================================================================ the engine
export function makeContest(cfg) {
  const C = { cfg, id: cfg.id, key: cfg.key };

  // ---------------------------------------------------------------- state (lazy, old saves too)
  C.state = (g) => {
    const st = g.state;
    let s = st[cfg.key];
    if (!s || typeof s !== 'object') s = st[cfg.key] = {};
    if (!s.seasons || typeof s.seasons !== 'object') s.seasons = {};
    if (!s.hist || typeof s.hist !== 'object') s.hist = {};
    if (!s.me || typeof s.me !== 'object') s.me = { wins: 0, finals: 0, entries: 0, log: [] };
    if (!Array.isArray(s.me.log)) s.me.log = [];
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    s.v = 1;
    return s;
  };
  C.rules = (Y) => cfg.rules(Y);
  C.held = (Y) => { const r = cfg.rules(Y); return !!(r && r.held); };

  // the dates of a season as game days: { announce, entryFrom, entryTo, rounds: { rid: [{ day, y, m, d, venue }] }, final }
  C.cal = (g, Y) => {
    const r = cfg.rules(Y);
    const D = (a) => (a ? { day: dayOf(g, a[0], a[1], a[2]), y: a[0], m: a[1], d: a[2], venue: a[3] || '' } : null);
    const out = { announce: D(r.cal.announce), entryFrom: D(r.cal.entryFrom), entryTo: D(r.cal.entryTo), rounds: {} };
    for (const rd of r.rounds) out.rounds[rd.id] = (rd.dates || []).map(D);
    out.final = out.rounds.final ? out.rounds.final[0] : null;
    return out;
  };
  // the season shown now: the first held season whose final (+5 days) is not over
  C.seasonY = (g) => {
    const now = cdate(g);
    for (let Y = now.year - 1; Y <= now.year + 3; Y++) {
      if (!C.held(Y)) continue;
      const cal = C.cal(g, Y);
      // a season whose final was before the game started is history (this world's, pastHistory), not played
      if (cal.final && cal.final.day >= 1 && g.state.day <= cal.final.day + 5) return Y;
    }
    return null;
  };
  C.nextHeld = (Y) => { for (let y = Y; y < Y + 40; y++) if (C.held(y)) return y; return null; };

  // ---------------------------------------------------------------- a season (seeded field)
  C.season = (g, Y) => {
    const s = C.state(g);
    let S = s.seasons[Y];
    if (S && S.v === 1) return S;
    const r = cfg.rules(Y);
    const rng = rngOf(cfg.id, 'season', Y);
    const prev = C.histOf(g, Y - 1);
    const notables = [];
    const used = new Set();
    const K = cfg.notables || 36;
    for (let i = 0; i < K; i++) {
      let n = cfg.notable(rng, Y, i, { prev, used });
      let guard = 0;
      while (used.has(n.name) && guard++ < 8) n = cfg.notable(rng, Y, i, { prev, used });
      used.add(n.name);
      n.id = `n${i}`;
      n.str = Math.round(clamp(n.str ?? ((cfg.topStr || 86) - i * 0.9 + gauss(rng) * 3.5), 40, 95) * 10) / 10;
      n.seed = rint(rng, 1, 1e9);
      notables.push(n);
    }
    // last year's champion and finalists come back with their tags (when the rules let them)
    if (prev && prev.champ && cfg.champBack !== false) {
      const n = notables[rint(rng, 0, 3)];
      n.name = prev.champ; n.gender = nameGender(n.name) || n.gender; n.tags = ['前年王者']; n.str = Math.max(n.str, 84);
      if (prev.champType) n.type = prev.champType;
      if (prev.champPlayer) { n.ghost = true; } // the player won last year: no NPC copy of the player
    }
    S = s.seasons[Y] = { v: 1, Y, ed: r.edition, created: g.state.day, notables: notables.filter((n) => !n.ghost), rounds: {}, entry: null, final: null, ev: {}, news: {}, extra: 0 };
    S.entries = cfg.entries(Y, rng);
    return S;
  };
  C.find = (S, id) => (id === 'player' ? null : S.notables.find((n) => n.id === id) || null);
  C.lookOf = (n) => (n && n.look) || randomLook(rngOf('look', n && n.name, n && n.seed), { gender: n && n.gender });
  // every member of a rival act (a trio 3, a combi / conte unit 2, a pin 1): the first is lookOf, the others seeded per act
  C.looksOf = (n) => {
    if (!n) return [];
    const k = n.type === 'trio' ? 3 : n.type === 'pin' || n.type === 'solo' || (n.type == null && cfg.id === 'r1') ? 1 : 2;
    const out = [C.lookOf(n)];
    for (let i = 1; i < k; i++) out.push(randomLook(rngOf('look', n.name, n.seed, 'm' + i), { gender: rngOf('lookg', n.name, i)() < 0.25 ? 'f' : 'm' }));
    return out;
  };
  // the player's act as it stands on this stage (with the partners unless the player entered alone)
  C.membersOf = (g, E) => (cfg.id === 'r1' || (E && E.solo) ? 1 : Math.max(1, 1 + num(safe(() => actInfo(g).partners.length, 0))));
  C.myLooks = (g, E) => (E && E.solo) || !cfg.champLooks ? [g.state.look] : safe(() => cfg.champLooks(g), null) || [g.state.look];
  // A season's result: played in this game (s.hist), or this world's history before the game started (fictional names).
  C.histOf = (g, Y) => {
    const s = C.state(g);
    if (s.hist[Y]) return s.hist[Y];
    if (!C.held(Y)) return null;
    const cal = C.cal(g, Y);
    if (cal.final && cal.final.day < 1) return cfg.pastHistory(Y);
    return null;
  };
  // D1's view of a season's rounds (its calendar): ours without the 復活ステージ (D1 models it on the final: revival)
  C.d1Rounds = (Y) => cfg.rules(Y).rounds.filter((x) => x.id !== 'rev');
  C.d1Idx = (Y, rid) => C.d1Rounds(Y).findIndex((x) => x.id === rid);

  // ---------------------------------------------------------------- rounds (NPC simulation, the player's place)
  C.roundDef = (Y, rid) => cfg.rules(Y).rounds.find((x) => x.id === rid) || null;
  C.fieldOf = (S, rd) => Math.round(typeof rd.field === 'function' ? rd.field(S.entries) : num(rd.field, 50));
  C.passOf = (S, rd) => Math.round(typeof rd.pass === 'function' ? rd.pass(S.entries) : num(rd.pass, 10));
  // who is still in before round rid: passed every earlier preliminary that has been decided
  // (a dark horse — anonymous until it passed round `joined` — is in from the round after; a seed skips rounds)
  C.alive = (S, rid) => {
    const rules = cfg.rules(S.Y);
    const idx = rules.rounds.findIndex((x) => x.id === rid);
    return S.notables.filter((n) => {
      if (n.joined != null && idx <= n.joined) return false;
      for (let k = 0; k < idx; k++) {
        const rd = rules.rounds[k];
        if (rd.id === 'rev' || rd.id === 'final') continue;
        if (n.joined != null && k <= n.joined) continue;
        if (n.skip && n.skip.includes(rd.id)) continue;
        const R0 = S.rounds[rd.id];
        if (R0 && R0.done && !R0.passed.includes(n.id)) return false;
      }
      return true;
    });
  };
  // Simulate a round (everyone but the player, whose total is passed in when they performed). Idempotent.
  C.simRound = (g, S, rid, me = null) => {
    if (S.rounds[rid] && S.rounds[rid].done) return S.rounds[rid];
    const rules = cfg.rules(S.Y);
    const rd = C.roundDef(S.Y, rid);
    if (!rd || rid === 'final') return null;
    const idx = rules.rounds.indexOf(rd);
    const rng = rngOf(cfg.id, S.Y, 'round', rid);
    const pass = C.passOf(S, rd);
    const field = Math.max(pass + 1, C.fieldOf(S, rd));
    let alive;
    if (rid === 'rev') {
      const sf = S.rounds[rules.lastPrelim];
      alive = sf && sf.order ? sf.order.slice().sort((a, b) => b.total - a.total).filter((x) => !sf.passed.includes(x.id) && x.id !== 'player').slice(0, Math.max(4, field - 1)).map((x) => C.find(S, x.id)).filter(Boolean) : [];
    } else alive = C.alive(S, rid);
    const seededSkip = alive.filter((n) => n.skip && n.skip.includes(rid));
    const out = { done: true, rid, day: g.state.day, field, pass, passed: [], order: [], cut: 0 };
    const kind = cfg.kindOf ? cfg.kindOf(S) : 'pin';
    if (field > 150) {
      const mu = rd.mu, sd = rd.sd;
      out.cut = cutScore(g, { mu, sd, field, pass, kind, seed: `${cfg.id}|${S.Y}|${rid}` });
      for (const n of alive) {
        if (seededSkip.includes(n)) { out.passed.push(n.id); continue; }
        const t = rivalTotal(g, n.str, rng, kind);
        out.order.push({ id: n.id, total: t });
        if (t >= out.cut) out.passed.push(n.id);
      }
      if (me) { out.order.push({ id: 'player', total: me.total }); if (me.total >= out.cut) out.passed.push('player'); }
    } else {
      const ps = alive.map((n) => ({ id: n.id, total: rivalTotal(g, n.str, rng, kind) }));
      if (me) ps.push({ id: 'player', total: me.total });
      // anonymous entrants up to the round's field
      let k = 0;
      while (ps.length < field) ps.push({ id: `a${rid}${k++}`, total: rivalTotal(g, clamp(rd.mu + gauss(rng) * rd.sd, 1, 99), rng, kind), anon: true });
      ps.sort((a, b) => b.total - a.total);
      out.order = ps.filter((p) => !p.anon || ps.indexOf(p) < pass + 6).map((p) => ({ id: p.id, total: p.total, anon: p.anon || undefined }));
      out.cut = ps[Math.min(ps.length - 1, pass - 1)].total;
      for (const p of ps.slice(0, pass)) {
        if (p.anon) {
          // a dark horse: a new named entrant of this season
          const n = cfg.notable(rngOf(cfg.id, S.Y, 'dark', rid, p.id), S.Y, S.notables.length, { dark: true, used: new Set(S.notables.map((x) => x.name)) });
          n.id = `d${S.extra++}`;
          n.str = clamp(rd.mu + rd.sd * 1.4, 40, 95);
          n.seed = rint(rng, 1, 1e9);
          n.joined = idx;
          n.tags = (n.tags || []).concat(['ダークホース']).slice(0, 3);
          S.notables.push(n);
          out.passed.push(n.id);
          const o = out.order.find((x) => x.id === p.id);
          if (o) { o.id = n.id; delete o.anon; }
        } else out.passed.push(p.id);
      }
      out.order = out.order.filter((x) => !x.anon);
    }
    S.rounds[rid] = out;
    return out;
  };

  // ---------------------------------------------------------------- the final (simulation; the player's part comes from outside)
  // returns { order: [ids], perf: { id: { total, total2 } }, scores: { id: [judge scores] }, blocks, stage1, stage2, champ, ranking }
  C.finalists = (g, S) => {
    const rules = cfg.rules(S.Y);
    const sf = S.rounds[rules.lastPrelim || 'sf'];
    const list = sf ? sf.passed.slice() : [];
    const rev = S.rounds.rev;
    if (rev && rev.done) for (const id of rev.passed) if (!list.includes(id)) list.push(id);
    return list;
  };

  // ---------------------------------------------------------------- the player's entry
  C.entryOf = (g, Y) => { const S = C.state(g).seasons[Y]; return (S && S.entry) || null; };
  C.myId = 'player';

  // ---------------------------------------------------------------- what can the player do today
  // → { kind: 'notyet'|'none'|'entry'|'entered'|'closed'|'round'|'final'|'waiting'|'out'|'done', Y, rid, label }
  C.now = (g) => {
    const fy = cfg.founded;
    const Y = C.seasonY(g);
    const day = g.state.day;
    if (!Y || (Y === fy && C.cal(g, Y).announce && day < C.cal(g, Y).announce.day)) return { kind: 'notyet', Y: null, label: `まだ始まっていない（${fy}年創設）` };
    const S = C.season(g, Y);
    const cal = C.cal(g, Y);
    const E = S.entry;
    if (!E) {
      if (cal.entryFrom && day < cal.entryFrom.day) return { kind: 'soon', Y, label: `エントリー受付は${dateTextY(cal.entryFrom.y, cal.entryFrom.m, cal.entryFrom.d)}から` };
      if (cal.entryTo && day <= cal.entryTo.day) return { kind: 'entry', Y, label: `エントリー受付中（${dateText(cal.entryTo.m, cal.entryTo.d)}まで）` };
      return { kind: 'closed', Y, label: 'エントリー受付は終了' };
    }
    if (E.status === 'out' || E.status === 'withdrawn') return { kind: 'out', Y, label: E.status === 'withdrawn' ? '棄権' : `${C.roundName(Y, E.round)}で敗退` };
    if (['champion', 'runnerup', 'finalist'].includes(E.status) || (S.final && S.final.done)) return { kind: 'done', Y, label: E.status === 'champion' ? '優勝！' : '決勝で戦った' };
    const due = C.dueRound(g, S);
    if (due) return { kind: due.rid === 'final' || due.rid === 'rev' ? 'final' : 'round', Y, rid: due.rid, label: `今日は${C.roundName(Y, due.rid)}（${cfg.venueName(Y, due.rid, due.venue)}）` };
    const nx = C.nextRound(g, S);
    return { kind: 'waiting', Y, rid: nx && nx.rid, label: nx ? `次は${C.roundName(Y, nx.rid)}：${dateText(nx.m, nx.d)}（${cfg.venueName(Y, nx.rid, nx.venue)}）` : '結果待ち' };
  };
  C.roundName = (Y, rid) => { const rd = C.roundDef(Y, rid); return rd ? rd.name : rid === 'final2' ? '最終決戦' : rid; };
  // the player's date for their current round (the one they chose, else the first)
  C.myDate = (g, S) => {
    const E = S.entry;
    if (!E) return null;
    const opts = C.cal(g, S.Y).rounds[E.round] || [];
    return (E.round === E.dateRound && opts[E.dateIdx]) || opts[0] || null;
  };
  // the round the player must play today (entered, alive, today is their date)
  C.dueRound = (g, S) => {
    const E = S.entry;
    if (!E || !['entered', 'passed', 'revival'].includes(E.status)) return null;
    const d = C.myDate(g, S);
    if (d && d.day === g.state.day && !(E.done && E.done[E.round])) return { rid: E.round, ...d };
    return null;
  };
  C.nextRound = (g, S) => { const d = C.myDate(g, S); return d ? { rid: S.entry.round, ...d } : null; };

  // ---------------------------------------------------------------- morning: the season moves on (with or without the player)
  // Save growth: full detail only for the last 3 in-game years. Older seasons become their history row (s.hist), the
  // player's own runs keep the entry and the final's result only; old hist rows drop their finalists list.
  C.compact = (g) => {
    const s = C.state(g);
    const keep = cdate(g).year - 3;
    for (const k of Object.keys(s.seasons)) {
      const Y = Number(k), S = s.seasons[k];
      if (!S || S.compact || !(Y < keep)) continue;
      const F = S.final || {};
      if (F.done && !s.hist[Y]) s.hist[Y] = { champ: F.champName, runner: F.runnerName, champType: F.champType, champPlayer: F.champ === 'player', note: F.note || '' };
      if (S.entry) {
        const { prep, ...entry } = S.entry; // the preparation counters are spent
        s.seasons[k] = { v: 1, Y, ed: S.ed, compact: true, created: S.created, notables: [], rounds: {}, ev: {}, news: {}, extra: 0, entries: S.entries, entry: { ...entry, prep: { practice: num(prep && prep.practice) } }, final: F.done ? { done: true, champ: F.champ, champName: F.champName, runnerName: F.runnerName, champType: F.champType, note: F.note || '', ranking: [], day: F.day } : null };
      } else delete s.seasons[k];
    }
    for (const k of Object.keys(s.hist)) { const h = s.hist[k]; if (Number(k) < keep && h && h.finalists) delete h.finalists; }
  };
  C.morning = async (g) => {
    const out = [];
    safe(() => C.compact(g));
    const Y = C.seasonY(g);
    if (!Y) return out;
    // the season before may still have unprocessed days (a long trip, prison…)
    const s = C.state(g);
    for (const y of [Y - 1, Y]) if (s.seasons[y] || y === Y) {
      if (!C.held(y)) continue;
      const S = C.season(g, y);
      try { out.push(...(await C.advance(g, S))); } catch (e) { console.error('[contest] advance', cfg.id, e); }
    }
    return out;
  };
  // Process every event of the season whose day has passed (idempotent; S.ev remembers).
  C.advance = async (g, S) => {
    const out = [];
    const day = g.state.day;
    const cal = C.cal(g, S.Y);
    const rules = cfg.rules(S.Y);
    const once = (key, fn) => { if (S.ev[key]) return; S.ev[key] = day; try { const r = fn(); if (r) out.push(...[].concat(r)); } catch (e) { console.error(e); } };
    const N = (text, prio = 1) => ({ cid: cfg.id, text, prio });
    if (cal.announce && day >= cal.announce.day && day <= cal.announce.day + 25) once('announce', () => N(cfg.text.announce(g, S, rules, cal), 2));
    if (cal.entryFrom && day >= cal.entryFrom.day && day <= cal.entryTo.day) once('entryOpen', () => {
      if (!S.entry) morningNote(g, `（${rules.title}のエントリー受付が始まった。\n${dateText(cal.entryTo.m, cal.entryTo.d)}まで。${devWord(g)}の「${cfg.appName}」か「賞レース」から申し込める）`);
      return N(cfg.text.entryOpen(g, S, rules, cal), 2);
    });
    if (cal.entryTo && day > cal.entryTo.day) once('entryClose', () => N(cfg.text.entryClose(g, S, rules, cal), 1));
    for (const rd of rules.rounds) {
      if (rd.id === 'final' || rd.id === 'rev') continue;
      const dates = cal.rounds[rd.id] || [];
      const last = dates[dates.length - 1];
      if (!last) continue;
      // the player missed their date → 棄権
      const E = S.entry;
      if (E && E.round === rd.id && ['entered', 'passed'].includes(E.status) && !(E.done && E.done[rd.id])) {
        const mine = rd.id === E.dateRound && dates[E.dateIdx] ? dates[E.dateIdx] : dates[0];
        if (mine && day > mine.day) {
          E.status = 'withdrawn';
          E.results.push({ round: rd.id, score: 0, total: 0, passed: false, place: null, day: mine.day, withdrawn: true });
          C.logMe(g, S, `${rd.name}を欠場（棄権）`);
          contestMail(g, cfg.id, `${rules.title} ${rd.name}にお越しにならなかったため、棄権となりました。`, cfg.office);
        }
      }
      if (day > last.day) once('round_' + rd.id, () => {
        const R0 = C.simRound(g, S, rd.id, null);
        return cfg.text.roundDone ? N(cfg.text.roundDone(g, S, rd, R0, rules), rd.id === rules.lastPrelim ? 3 : 1) : null;
      });
    }
    // reminders on the player's round days
    const due = C.dueRound(g, S);
    if (due) once('due_' + due.rid, () => { morningNote(g, `（今日は${rules.title} ${C.roundName(S.Y, due.rid)}の日だ！\n${cfg.venueName(S.Y, due.rid, due.venue)}。${devWord(g)}の「${cfg.appName}」から会場へ向かおう）`); return null; });
    // the final without the player (or after it); a finalist who did not come is withdrawn
    if (cal.final && day > cal.final.day && !S.ev.final) {
      S.ev.final = day;
      try {
        const E = S.entry;
        if (E && ['passed', 'revival'].includes(E.status) && ['final', 'rev'].includes(E.round) && !(E.done && E.done[E.round])) {
          E.status = 'withdrawn';
          E.results.push({ round: E.round, score: 0, total: 0, passed: false, place: null, day: cal.final.day, withdrawn: true });
          C.logMe(g, S, '決勝を欠場（棄権）');
        }
        if (!S.final || !S.final.done) await C.simFinal(g, S, null);
        out.push(N(cfg.text.champion(g, S, rules), 3));
      } catch (e) { console.error(e); }
    }
    if (cal.final && day > cal.final.day + 1 && day <= cal.final.day + 12) once('after1', () => (cfg.text.after ? N(cfg.text.after(g, S, rules), 1) : null));
    // storylines of the field while the season runs (≤ 1 every few days, each line once a season)
    if (cal.entryFrom && day >= cal.entryFrom.day && cal.final && day < cal.final.day && day % 4 === 0) {
      const line = cfg.text.story ? cfg.text.story(g, S, rules, cal) : null;
      if (line) out.push(N(line, 0));
    }
    return out;
  };

  // ---------------------------------------------------------------- history (this world's)
  C.history = (g) => {
    const s = C.state(g);
    const now = cdate(g);
    const out = [];
    for (let Y = cfg.founded; Y <= now.year + 1; Y++) {
      if (!C.held(Y)) { if (Y > cfg.founded && cfg.gapNote && cfg.gapNote(Y)) out.push({ year: Y, edition: null, champion: '（開催なし）', note: cfg.gapNote(Y), revival: false }); continue; }
      const r = cfg.rules(Y);
      const S = s.seasons[Y];
      if (S && S.final && S.final.done) { out.push({ year: Y, edition: r.edition, name: r.title, champion: S.final.champName, runnerUp: S.final.runnerName, note: S.final.note || '', player: S.final.champ === 'player', revival: false }); continue; }
      const cal = C.cal(g, Y);
      const h = s.hist[Y] || (cal.final && cal.final.day < 1 ? C.histOf(g, Y) : cal.final && cal.final.day < g.state.day ? cfg.pastHistory(Y) : null);
      if (h) out.push({ year: Y, edition: r.edition, name: r.title, champion: h.champ, runnerUp: h.runner, note: h.note || '', player: !!h.champPlayer, revival: false });
    }
    return out;
  };

  C.logMe = (g, S, text) => { const s = C.state(g); s.me.log.unshift({ Y: S.Y, day: g.state.day, text }); if (s.me.log.length > 40) s.me.log.length = 40; };

  // the flows (entry / prep / rounds / final) live below
  installFlows(C);
  return C;
}

// ================================================================ HD cards specific to contests
function stampCirc(c, x, y, s, col) {
  alpha(c, 0.85, () => {
    c.strokeStyle = col; c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, 30, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, 25, 0, Math.PI * 2); c.stroke();
  });
  T(c, s, x, y - 9, s.length > 2 ? 13 : 17, col, 'center', 54);
}
// The entry form, drawn over the stage while the questions are asked (form = { title, sub, rows: [[label, value]], photos, fee, stamp, note }).
export function drawForm(c, form, th) {
  const x = 30, y = 6, w = SW - 60, h = 250;
  box(c, x, y, w, h, '#fffdf6', '#3a3a44');
  R(c, x + 1, y + 1, w - 2, 30, th.main);
  T(c, form.title, x + 14, y + 7, sizeFor(c, form.title, w - 200, 15, 10), '#ffffff', 'left', w - 190);
  T(c, form.sub || '', x + w - 12, y + 10, 10, th.acc2, 'right', 170);
  // photo frame
  const px = x + w - 112, py = y + 40;
  box(c, px, py, 98, 112, '#eef0f4', '#6a6a78');
  T(c, '写真（胸から上）', px + 49, py + 98, 9, '#6a6a78', 'center', 94);
  const ph = (form.photos || []).filter(Boolean);
  if (ph.length) ph.slice(0, 3).forEach((lk, i) => faceAt(c, lk, px + 49 - 16 * (ph.length > 1 ? 1 : 1.5) + (ph.length > 1 ? (i - (ph.length - 1) / 2) * 30 : 0) - (ph.length > 1 ? 0 : 8), py + 16, ph.length > 1 ? 1 : 2));
  // rows
  const rows = (form.rows || []).slice(0, 11);
  const lw = 112, vw = w - 24 - lw - 120;
  const rh = Math.min(20, Math.floor((h - 40 - 46) / Math.max(1, rows.length)));
  const fs = rh >= 18 ? 12 : 11;
  rows.forEach(([label, value, pend], i) => {
    const ry = y + 38 + i * rh;
    R(c, x + 12, ry + rh - 2, lw + vw, 1, '#c8c8d0');
    T(c, label, x + 14, ry + (rh - fs) / 2 - 1, 11, '#5a5a68', 'left', lw - 6);
    T(c, value == null || value === '' ? (pend ? '…' : '') : value, x + 14 + lw, ry + (rh - fs) / 2 - 2, fs, pend ? '#c0303a' : '#1a1a28', 'left', vw);
  });
  const by = y + h - 40;
  R(c, x + 12, by, w - 24, 1, '#c8c8d0');
  if (form.fee != null) T(c, `参加費：${form.fee}`, x + 14, by + 6, 12, '#1a1a28', 'left', 300);
  if (form.note) T(c, form.note, x + 14, by + 22, 9, '#6a6a78', 'left', w - 120);
  if (form.stamp) stampCirc(c, x + w - 64, by - 30, form.stamp, '#d0202a');
}
function ticketCard(g, o, th) {
  return card(g, (c, sc) => {
    const w = 420, h = 214, x = (SW - w) / 2, y = 52 - Math.max(0, 14 - sc.t) * 3;
    box(c, x, y, w, h, '#fffdf4', th.main);
    R(c, x + 1, y + 1, w - 2, 34, th.main);
    T(c, o.title, x + w / 2, y + 9, sizeFor(c, o.title, w - 30, 16, 10), '#ffffff', 'center', w - 20);
    T(c, 'エントリーナンバー', x + 24, y + 48, 12, '#5a5a68');
    const ns = `No. ${o.no}`;
    T(c, ns, x + w / 2, y + 64, 44, th.main, 'center', w - 40, { outline: '#20232a' });
    T(c, o.name, x + w / 2, y + 120, 16, '#1a1a28', 'center', w - 40);
    para(c, o.line, x + 24, y + 146, w - 130, 11, '#3a3a48', 15, 3);
    if (o.stamp) stampCirc(c, x + w - 54, y + h - 46, o.stamp, '#d0202a');
    for (let i = 0; i < 20; i++) R(c, x + 10 + i * 20, y + h - 8, 10, 2, '#c8c8d0');
  }, { min: 24 });
}
// 合格者発表 — a block of entry numbers with the passing ones lit (the player's boxed).
function passBoard(g, o, th) {
  return card(g, (c, sc) => {
    const x = 40, y = 14, w = SW - 80, h = 300;
    box(c, x, y, w, h, th.board || '#ffffff', '#20232a');
    R(c, x + 1, y + 1, w - 2, 30, th.main);
    T(c, o.title, x + w / 2, y + 8, sizeFor(c, o.title, w - 30, 15, 10), '#ffffff', 'center', w - 20);
    T(c, o.sub || '', x + w / 2, y + 36, 11, '#3a3a48', 'center', w - 30);
    const nums = o.nums || [];
    const cols = 8, cw = (w - 40) / cols;
    const reveal = Math.min(nums.length, Math.floor(sc.t / 2));
    nums.slice(0, 48).forEach((nb, i) => {
      if (i >= reveal) return;
      const cx = x + 20 + (i % cols) * cw, cy = y + 58 + Math.floor(i / cols) * 30;
      const me = nb.me, ok = nb.pass;
      box(c, cx + 2, cy, cw - 4, 24, ok ? (me ? '#ffe9a0' : '#ffffff') : '#e6e6ea', me ? th.main : ok ? '#3a3a48' : '#c8c8d0');
      T(c, String(nb.no), cx + cw / 2, cy + 5, 13, ok ? '#1a1a28' : '#a8a8b0', 'center', cw - 8);
      if (me) frame(c, cx, cy - 2, cw, 28, th.main);
    });
    if (reveal >= Math.min(48, nums.length) && sc.t > 40) {
      if (o.passed) stampCirc(c, x + w - 70, y + h - 54, '合格', '#d0202a');
      else T(c, o.failText || 'あなたの番号は…ない。', x + w - 24, y + h - 34, 14, '#3a3a48', 'right', w - 60);
    }
    T(c, o.foot || '', x + 20, y + h - 22, 10, '#5a5a68', 'left', w - 220);
  }, { min: 50 });
}
// every member of an act (a look or the act's list of looks): faces side by side; returns the width used
const lookList = (lk) => (Array.isArray(lk) ? lk.filter(Boolean) : lk ? [lk] : []);
function facesAt(c, lk, x, y, k = 1) {
  const a = lookList(lk).slice(0, 3);
  const step = Math.round(22 * k);
  a.forEach((l, i) => faceAt(c, l, x + i * step, y, k));
  return a.length > 1 ? (a.length - 1) * step : 0;
}
function bigsAt(c, lk, cx, y, k = 2) {
  const a = lookList(lk).slice(0, 3);
  const step = a.length > 2 ? 44 * k / 2 : 52 * k / 2;
  a.forEach((l, i) => drawBig(c, l, 'down', cx - 16 * k + (i - (a.length - 1) / 2) * step, y, k));
}
// the judges' scores of one performance (rows revealed one by one) and the running ranking
function scoreCard(g, o, th) {
  return card(g, (c, sc) => {
    const x = 60, y = 12, w = SW - 120;
    const J = o.judges;
    const h = 92 + J.length * 22;
    box(c, x, y, w, h, '#0c0c14', th.acc);
    R(c, x + 1, y + 1, w - 2, 30, th.main);
    const fw = facesAt(c, o.looks || o.look, x + 8, y + 3, 1);
    T(c, o.name, x + 48 + fw, y + 8, 15, '#ffffff', 'left', w - 160 - fw);
    T(c, o.sub || '', x + w - 10, y + 10, 10, th.acc2, 'right', 150);
    let sum = 0;
    J.forEach((j, i) => {
      const ry = y + 40 + i * 22;
      const show = sc.t > 14 + i * 12;
      faceAt(c, j.look, x + 12, ry - 2, 0.75);
      T(c, j.name, x + 44, ry + 3, 12, '#d8d8e4', 'left', 200);
      T(c, j.title || '', x + 250, ry + 4, 10, '#8a8a9a', 'left', 150);
      if (show) { sum += o.scores[i]; T(c, String(o.scores[i]), x + w - 30, ry + 1, 16, th.acc, 'right', 60); }
    });
    const allShown = sc.t > 14 + J.length * 12;
    R(c, x + 10, y + h - 46, w - 20, 1, '#4a4a58');
    T(c, '合計', x + 20, y + h - 36, 14, '#ffffff');
    T(c, allShown ? `${o.total}点` : `${sum}点`, x + w - 30, y + h - 40, 26, allShown ? '#ffffff' : '#9a9aa8', 'right', 200, { outline: allShown ? th.main : null });
    if (allShown && o.rankText) T(c, o.rankText, x + w / 2, y + h - 14, 11, th.acc2, 'center', w - 40);
  }, { min: 30 + o.judges.length * 12 });
}
function rankBoard(g, o, th) {
  return card(g, (c, sc) => {
    const rows = o.rows;
    const x = 80, y = 10, w = SW - 160, rh = 22;
    const h = 46 + rows.length * rh;
    box(c, x, y, w, h, '#0c0c14', th.acc);
    R(c, x + 1, y + 1, w - 2, 28, th.main);
    T(c, o.title, x + w / 2, y + 7, 14, '#ffffff', 'center', w - 20);
    rows.forEach((r, i) => {
      const ry = y + 36 + i * rh;
      if (sc.t < 6 + i * 4) return;
      if (r.me) R(c, x + 4, ry - 2, w - 8, rh - 2, '#3a2a10');
      if (r.mark) { box(c, x + 8, ry, 46, 16, r.markCol || th.main, th.acc); T(c, r.mark, x + 31, ry + 2, 10, '#ffffff', 'center', 42); }
      else T(c, r.rank != null ? `${r.rank}位` : '', x + 31, ry + 1, 12, '#c8c8d4', 'center', 42);
      const fw = facesAt(c, r.looks || r.look, x + 60, ry - 4, 0.75);
      T(c, r.name, x + 90 + fw, ry + 1, 13, r.me ? th.acc : '#ffffff', 'left', w - 200 - fw);
      T(c, r.value, x + w - 12, ry + 1, 13, '#ffffff', 'right', 100);
    });
  }, { min: 24 + o.rows.length * 4 });
}
function voteCard(g, o, th) {
  return card(g, (c, sc) => {
    const x = 30, y = 14, w = SW - 60, h = 250;
    box(c, x, y, w, h, '#0c0c14', th.acc);
    R(c, x + 1, y + 1, w - 2, 30, th.main);
    T(c, o.title, x + w / 2, y + 8, 15, '#ffffff', 'center', w - 20);
    const n = o.cands.length, cw = (w - 20) / n;
    const shown = Math.min(o.votes.length, Math.floor(Math.max(0, sc.t - 20) / 22));
    o.cands.forEach((cd, i) => {
      const cx = x + 10 + i * cw;
      box(c, cx + 6, y + 40, cw - 12, 196, cd.me ? '#2a1e08' : '#141420', cd.me ? th.acc : '#3a3a48');
      bigsAt(c, cd.looks || cd.look, cx + cw / 2, y + 50, 2);
      T(c, cd.name, cx + cw / 2, y + 136, 13, '#ffffff', 'center', cw - 20);
      const got = o.votes.slice(0, shown).map((v, k) => ({ v, k })).filter((x2) => x2.v === i);
      got.forEach((x2, k) => { box(c, cx + 14 + (k % 4) * ((cw - 28) / 4), y + 162 + Math.floor(k / 4) * 30, (cw - 28) / 4 - 4, 26, th.main, th.acc); faceAt(c, o.judges[x2.k] && o.judges[x2.k].look, cx + 14 + (k % 4) * ((cw - 28) / 4) + ((cw - 28) / 4 - 4) / 2 - 12, y + 163 + Math.floor(k / 4) * 30, 0.75); });
      if (o.points) T(c, `${o.points[i]}点`, cx + cw / 2, y + 212, 14, th.acc, 'center', cw - 20);
    });
    if (o.caption) T(c, o.caption, x + w / 2, y + h - 14, 9, '#a8a8b8', 'center', w - 20);
  }, { min: 30 + o.votes.length * 22 });
}
function championCard(g, o, th) {
  return card(g, (c, sc) => {
    R(c, 0, 0, SW, SH, th.bg);
    for (let i = 0; i < 14; i++) alpha(c, 0.12, () => { c.fillStyle = i % 2 ? th.acc : th.main; c.beginPath(); c.moveTo(SW / 2, 150); const a0 = (i / 14) * Math.PI * 2 + sc.t / 90, a1 = a0 + Math.PI / 14; c.lineTo(SW / 2 + Math.cos(a0) * 700, 150 + Math.sin(a0) * 700); c.lineTo(SW / 2 + Math.cos(a1) * 700, 150 + Math.sin(a1) * 700); c.fill(); });
    confetti(c, sc.t, 160);
    const k = Math.min(1, sc.t / 18);
    T(c, o.head, SW / 2, 16, 14, th.acc2, 'center', SW - 40);
    T(c, '優勝', SW / 2, 34 + (1 - k) * 30, Math.round(44 * k + 10), th.acc, 'center', SW - 40, { outline: th.dark });
    (o.looks || []).slice(0, 3).forEach((lk, i, a) => drawBig(c, lk, 'down', SW / 2 - 32 + (i - (a.length - 1) / 2) * 70, 100, 2));
    T(c, o.name, SW / 2, 190, sizeFor(c, o.name, SW - 60, 28, 14), '#ffffff', 'center', SW - 60, { outline: th.main });
    if (o.prize) { box(c, SW / 2 - 150, 230, 300, 40, '#fffdf4', th.acc); T(c, o.prize, SW / 2, 239, 18, '#1a1a28', 'center', 280); }
    if (o.foot) T(c, o.foot, SW / 2, 278, 11, th.acc2, 'center', SW - 60);
  }, { min: 70, dimA: 0 });
}
// the PV (煽りVTR) of the final: logo, tagline, the entry count, the finalists, 決勝
function pvCard(g, o, th) {
  return card(g, (c, sc) => {
    const t = sc.t;
    R(c, 0, 0, SW, SH, '#000');
    const flash = t % 60 < 3;
    if (flash) alpha(c, 0.4, () => R(c, 0, 0, SW, SH, th.main));
    beams(c, t, th.acc2);
    if (t < 70) {
      const k = Math.min(1, t / 12);
      T(c, o.logo, SW / 2, 120 - (1 - k) * 40, sizeFor(c, o.logo, SW - 60, 40, 16), '#ffffff', 'center', SW - 60, { outline: th.main });
      T(c, o.sub, SW / 2, 176, 14, th.acc2, 'center', SW - 60);
    } else if (t < 150) {
      const s = o.tagline;
      const n = Math.min(Array.from(s).length, Math.floor((t - 70) / 3));
      T(c, Array.from(s).slice(0, n).join(''), SW / 2, 140, sizeFor(c, s, SW - 60, 24, 12), '#ffffff', 'center', SW - 60);
    } else if (t < 210) {
      const k = Math.min(1, (t - 150) / 40);
      T(c, o.countLabel, SW / 2, 110, 14, th.acc2, 'center', SW - 60);
      T(c, `${n0(Math.round(o.count * k))}${o.countUnit}`, SW / 2, 134, 40, '#ffffff', 'center', SW - 60, { outline: th.main });
      T(c, o.countFoot || '', SW / 2, 190, 12, '#c8c8d8', 'center', SW - 60);
    } else {
      const fs = o.finalists || [];
      const shown = Math.min(fs.length, Math.floor((t - 210) / 10) + 1);
      const per = Math.min(70, (SW - 40) / Math.max(1, fs.length));
      fs.slice(0, shown).forEach((f, i) => {
        const cx = 20 + per * (i + 0.5);
        const L = lookList(f.looks || f.look).slice(0, 3);
        const st2 = L.length > 1 ? Math.min(20, Math.max(10, (per - 30) / (L.length - 1))) : 0;
        L.forEach((lk, k) => drawBig(c, lk, 'down', cx - 16 + (k - (L.length - 1) / 2) * st2, 90, 1));
        T(c, f.name, cx, 136, 9, f.me ? th.acc : '#ffffff', 'center', per - 4);
      });
      if (shown >= fs.length) T(c, o.end || '決勝', SW / 2, 180, 36, '#ffffff', 'center', SW - 40, { outline: th.main });
    }
    R(c, 0, 0, SW, 24, '#000'); R(c, 0, SH - 24, SW, 24, '#000');
  }, { min: 60, dimA: 0 });
}
function beams(c, t, col) { alpha(c, 0.1, () => { c.fillStyle = col; for (let i = 0; i < 5; i++) { const x0 = 80 + i * 120, sw = Math.sin(t / 30 + i) * 160; c.beginPath(); c.moveTo(x0 - 4, 0); c.lineTo(x0 + 4, 0); c.lineTo(x0 + sw + 40, SH); c.lineTo(x0 + sw - 40, SH); c.fill(); } }); }
// a finalist's キャッチコピー (and a short 煽りVTR for the player)
function catchCard(g, o, th) {
  return card(g, (c, sc) => {
    const t = sc.t;
    R(c, 0, 0, SW, SH, th.bg);
    alpha(c, 0.5, () => { for (let i = 0; i < 18; i++) R(c, (i * 47 + t * 3) % SW, 0, 2, SH, th.main); });
    // every member of the act (a pin 1 big, a combi 2, a trio 3 smaller)
    const L = lookList(o.looks || [o.look, o.look2]).slice(0, 3);
    const k3 = L.length > 2 ? 2 : 3, step = L.length > 2 ? 70 : 100;
    L.forEach((lk, i) => drawBig(c, lk, 'down', 130 - 16 * k3 + (i - (L.length - 1) / 2) * step, (L.length > 2 ? 110 : 90) + Math.max(0, 20 + i * 4 - t) * 2, k3));
    const k = Math.min(1, t / 16);
    T(c, o.top || '', 260, 70, 12, th.acc2, 'left', SW - 280);
    para(c, o.copy, 260, 96 - (1 - k) * 12, SW - 290, sizeFor(c, o.copy, (SW - 290) * 2, 26, 14), '#ffffff', 0, 3);
    T(c, o.name, 260, 200, sizeFor(c, o.name, SW - 290, 22, 12), th.acc, 'left', SW - 290, { outline: th.dark });
    if (o.vtr) para(c, o.vtr, 260, 232, SW - 290, 11, '#d8d8e4', 15, 4);
  }, { min: 40, dimA: 0 });
}
function recapCard(g, o, th) {
  return card(g, (c) => {
    const x = 40, y = 10, w = SW - 80;
    const rows = o.rows.slice(0, 12);
    const h = 60 + rows.length * 20 + (o.foot ? 22 : 0);
    box(c, x, y, w, h, '#101018', th.acc);
    R(c, x + 1, y + 1, w - 2, 30, th.main);
    T(c, o.title, x + w / 2, y + 8, 15, '#ffffff', 'center', w - 20);
    rows.forEach((r, i) => {
      const ry = y + 40 + i * 20;
      T(c, r[0], x + 16, ry, 12, '#c8c8d8', 'left', 150);
      T(c, r[1], x + 170, ry, 12, '#ffffff', 'left', w - 300);
      T(c, r[2] || '', x + w - 14, ry, 12, r[3] || th.acc, 'right', 120);
    });
    if (o.foot) para(c, o.foot, x + 16, y + h - 26, w - 32, 11, th.acc2, 14, 1);
  }, { min: 20 });
}
export const CARDS = { ticketCard, passBoard, scoreCard, rankBoard, voteCard, championCard, pvCard, catchCard, recapCard, drawForm };

// ================================================================ the flows
function installFlows(C) {
  const cfg = C.cfg;
  const theme = (Y) => THEMES[cfg.rules(Y).theme] || THEMES.r1new;
  const say = (g, who, t) => g.say(t, who ? { name: who.name, look: who.look } : {});
  const ask = (g, who, t, ch, o = {}) => g.ask(t, ch, { ...(who ? { name: who.name, look: who.look } : {}), ...o });

  // ---------------------------------------------------------------- entry (エントリー用紙 → 参加費 → エントリーナンバー)
  C.entry = async (g) => {
    const Y = C.seasonY(g);
    const nowc = C.now(g);
    if (nowc.kind === 'notyet') { await g.say(`${cfg.label}は${nowc.label}。`); return null; }
    if (!Y || nowc.kind !== 'entry') { await g.say(Y ? `${cfg.rules(Y).title}：${nowc.label}。` : `${cfg.label}は、今は受付をしていない。`); return null; }
    const S = C.season(g, Y);
    const rules = cfg.rules(Y);
    const th = theme(Y);
    const act = actInfo(g);
    const s = C.state(g);
    const el = cfg.eligibility(g, act, Y, s);
    if (!el.ok) { await infoCard(g, `${rules.title}　出場資格`, [el.why, '', `（参考）${rules.eligText}`], { theme: th }); return null; }
    const first = !s.seen.entry;
    let quick = false;
    if (!first) {
      const k = await g.ask(`${rules.title}にエントリーする？`, ['エントリー用紙を書く', 'おまかせで記入する', 'やめる'], { cancel: 2 });
      if (k === 2) return null;
      quick = k === 1;
    }
    const st = stage(g, { set: rules.formSet || 'home', theme: th, sign: rules.title, cast: [{ look: g.state.look, x: 520, y: 236, k: 1, dir: 'left' }] });
    try {
      // ピンでの挑戦 / the act's choice (the config may add scenes: R-1 with a 相方)
      const pre = cfg.beforeEntry ? await cfg.beforeEntry(g, C, { S, rules, act, st, quick }) : { ok: true };
      if (!pre || !pre.ok) return null;
      const form = { title: `${rules.title}　${rules.formTitle || 'エントリー用紙'}`, sub: rules.organizer, rows: [], photos: pre.photos || [g.state.look], fee: rules.fee ? plainYen(rules.fee) : rules.feeText || '—', note: rules.formNote || '', stamp: null };
      st.overlay = (c) => CARDS.drawForm(c, form, th);
      const rowsBase = cfg.formRows(g, C, { S, rules, act, pre });
      for (const r0 of rowsBase) form.rows.push([r0[0], r0[1], false]);
      if (first || !quick) await g.say(rules.formIntro || `${rules.title}のエントリー用紙だ。\nていねいに書いていこう。`);
      // the questions (genre, the first-round date and venue …)
      const answers = {};
      for (const q of cfg.formQuestions(g, C, { S, rules, act, pre })) {
        const row = [q.label, '', true];
        form.rows.push(row);
        let i = 0;
        if (!quick) i = await g.ask(q.text, q.choices.map((x) => x.label), { cancel: q.cancel ?? -1 });
        else i = q.auto ?? 0;
        if (i < 0 || i >= q.choices.length) i = 0;
        answers[q.id] = q.choices[i].value;
        row[1] = q.choices[i].show || q.choices[i].label;
        row[2] = false;
      }
      // the rules you sign
      if (!quick) {
        const k = await g.ask(rules.pledge || '重複エントリー・再エントリーはできません。\n記入した内容に、まちがいはない？', ['提出する', 'やっぱりやめる'], { cancel: 1 });
        if (k !== 0) { await g.say('エントリー用紙を、そっと引き出しにしまった…。'); return null; }
      }
      // the fee
      const feeIn = rules.fee ? toInternal(g, rules.fee) : 0;
      if (feeIn > 0) {
        if (!g.spend(feeIn)) { await g.say(`参加費の${realYen(rules.fee)}が払えない…。\nお金をつくってから、もう一度申し込もう。`); return null; }
        g.notify(`参加費 -${fmtMoney(feeIn)}`, { color: '#ff9aa8' });
      }
      // the number
      const no = cfg.entryNo(g, S, rules);
      const unitName = pre.unitName || act.name;
      const E = S.entry = {
        no, unitName, fee: rules.fee || 0, day: g.state.day, status: 'entered', round: rules.rounds[0].id, results: [], done: {},
        kind: answers.kind || pre.kind || cfg.defaultKind || 'pin', style: answers.style || pre.style || null, dateRound: rules.rounds[0].id, dateIdx: answers.date ?? 0,
        prep: { practice: 0, flip: 0, notes: 0, day: 0 }, solo: !!pre.solo, type: act.type, members: pre.members || null, neta: null,
      };
      s.me.entries = num(s.me.entries) + 1;
      if (act.amateur) s.me.amateur = num(s.me.amateur) + 1;
      s.seen.entry = true;
      form.stamp = '受付';
      sfx('ok');
      if (!quick) await g.say(rules.mailText || 'エントリー用紙と参加費を送った。\n…数日後、受付の通知が届いた！');
      st.overlay = null;
      const cal = C.cal(g, Y);
      const d0 = (cal.rounds[E.round] || [])[E.dateIdx] || (cal.rounds[E.round] || [])[0];
      await CARDS.ticketCard(g, { title: `${rules.title}　エントリー受付票`, no, name: unitName, line: `${C.roundName(Y, E.round)}：${d0 ? dateTextY(d0.y, d0.m, d0.d) + '　' + cfg.venueName(Y, E.round, d0.venue) : '後日お知らせします'}\n${rules.fee ? `参加費 ${plainYen(rules.fee)} 受領` : ''}`, stamp: '受付済' }, th);
      contestMail(g, cfg.id, `${rules.title}へのエントリーを受け付けました。\nエントリーナンバー：${no}\n${C.roundName(Y, E.round)}：${d0 ? dateText(d0.m, d0.d) + '（' + cfg.venueName(Y, E.round, d0.venue) + '）' : '後日'}\n当日は開始時刻の30分前までに受付をお済ませください。`, cfg.office);
      C.logMe(g, S, `エントリー（No.${no}）`);
      if (cfg.afterEntry) await cfg.afterEntry(g, C, { S, rules, E, act });
      await g.say(`エントリーナンバーは${no}。\n${C.roundName(Y, E.round)}まで、ネタを仕上げよう！\n（${devWord(g)}の「${cfg.appName}」→「準備する」で稽古できる）`);
      return E;
    } finally {
      unstage(g, st);
    }
  };

  // ---------------------------------------------------------------- preparation between the rounds (once a day)
  C.prep = async (g) => {
    const Y = C.seasonY(g);
    const S = Y ? C.season(g, Y) : null;
    const E = S && S.entry;
    if (!E || !['entered', 'passed', 'revival'].includes(E.status)) { await g.say('いまは準備する大会がない。'); return; }
    const rules = cfg.rules(Y);
    const th = theme(Y);
    if (E.prep.day === g.state.day) { await g.say('今日はもう、しっかり稽古した。\n根を詰めすぎると本番でもたない。また明日！'); return; }
    const why = goRefusal(g);
    if (why) { await g.say(why); return; }
    const act = actInfo(g);
    const items = cfg.prepItems(g, C, { S, E, rules, act });
    const i = await g.ask(`${rules.title}の準備。（仕上がり ${Math.round(E.prep.practice)} / 100）\nなにをする？`, [...items.map((x) => x.label), 'やめる'], { cancel: items.length });
    if (i < 0 || i >= items.length) return;
    const it = items[i];
    if (it.stamina && g.state.stamina < it.stamina) { await g.say('体力が足りない…。何か食べて休もう。'); return; }
    const st = stage(g, { set: it.set || 'home', theme: th, sign: it.sign || '', cast: it.cast ? it.cast(g) : [{ look: g.state.look, x: 440, y: 150, k: 2, dir: 'up', bob: true }] });
    try {
      await it.run(g, st);
      E.prep.day = g.state.day;
      if (it.stamina) g.useStamina(it.stamina);
      if (has(g, 'lifeTick')) g.lifeTick({ stress: it.stress ?? 4, hunger: -4 });
    } finally { unstage(g, st); }
  };

  // ---------------------------------------------------------------- go (round day / final) — the hub calls this
  // mode: 'full' (every scene) | 'quick' (straight to the performance) | 'auto' (the performance simulated too) | undefined (ask)
  C.go = async (g, ctx = {}) => {
    const n = C.now(g);
    const mode = ctx && ['full', 'quick', 'auto'].includes(ctx.mode) ? ctx.mode : undefined;
    if (n.kind === 'entry') return C.entry(g);
    if (n.kind === 'round') return C.round(g, n.rid, mode);
    if (n.kind === 'final') return C.final(g, mode);
    await g.say(`${cfg.label}：${n.label}`);
    return null;
  };

  // ---------------------------------------------------------------- one round day (受付 → 楽屋 → 袖 → 本番 → 結果)
  C.round = async (g, rid, mode0) => {
    const Y = C.seasonY(g);
    const S = C.season(g, Y);
    const E = S.entry;
    const rules = cfg.rules(Y);
    const rd = C.roundDef(Y, rid);
    const due = C.dueRound(g, S);
    if (!E || !due || due.rid !== rid) { await g.say('今日は出番の日ではない。'); return null; }
    const why = goRefusal(g);
    if (why) { await g.say(why); return null; }
    const cost = rd.stamina || 20;
    if (g.state.stamina < cost) { await g.say(`体力が足りない…（必要：${cost}）。\nこのままじゃ舞台に立てない。何か食べて回復しよう。`); return null; }
    const s = C.state(g);
    const th = theme(Y);
    const first = !s.seen.round;
    let mode = mode0 || (g.auto ? 'auto' : 'full');
    const od = safe(() => C.odds(g, Y, rid), null);
    if (!mode0 && !first && !g.auto) mode = ['full', 'quick', 'auto'][await g.ask(`${rules.title} ${rd.name}。${od ? `\n（${od.text}）` : ''}`, ['会場を回って準備する（全部見る）', 'すぐに出番へ（準備はおまかせ）', 'おまかせ（本番もシミュレーション）'], { cancel: 0 })] || 'full';
    else if (first && od && !g.auto) await g.say(`${rules.title} ${rd.name}。\n${od.text}`);
    const quick = mode !== 'full';
    const sim = mode === 'auto';
    const venue = cfg.venueName(Y, rid, due.venue);
    const act = actInfo(g);
    const kind = E.kind || cfg.defaultKind || 'pin';
    const others = cfg.roundCast(g, S, rid);
    const st = stage(g, { set: 'lobby', theme: th, sign: `${rules.title}　${rd.name}`, sub: venue, cast: [{ look: g.state.look, x: 300, y: 200, k: 1, dir: 'up' }, { look: STAFF.look, x: 290, y: 114, k: 1 }, { look: { ...LOOKS.staff, top: '#3a3a48' }, x: 360, y: 114, k: 1 }, ...others.slice(0, 3).map((o, i) => ({ look: o.look, x: 60 + i * 30, y: 200, k: 1, dir: 'up' }))] });
    g.useStamina(cost);
    if (has(g, 'lifeTick')) g.lifeTick({ stress: rid === 'r1' ? 6 : 10, hunger: -8 });
    let res = null, tot = null, passed = false, place = null;
    try {
      // D1's venue sign (when the framework has it) — the scenes here are our own backdrops
      if (has(g, 'contestVenue')) safe(() => g.contestVenue({ contest: cfg.id, round: rid, title: `${rules.title} ${rd.name}`, color: th.main, venueName: venue }));
      g.bgm(rd.tv ? 'studio' : 'theater');
      if (!quick) {
        await g.say(`${venue}にやってきた。\n${rules.title} ${rd.name}。${cfg.lobbyLine ? cfg.lobbyLine(g, S, rid) : ''}`);
        await say(g, STAFF, [`エントリーナンバーと、お名前をお願いします。`, `${E.no}番、${E.unitName}さん…はい、確認できました。\nこちらの番号シールを、胸に貼ってください。`]);
        await CARDS.ticketCard(g, { title: `${rd.name}　受付`, no: E.no, name: E.unitName, line: `${venue}\n${dateTextY(due.y, due.m, due.d)}　持ち時間 ${fmtLen(rd.length)}`, stamp: '受付' }, th);
        // 楽屋
        st.set = 'gakuya'; st.sign = `楽屋　${rules.title} ${rd.name}`;
        st.cast = [{ look: g.state.look, x: 260, y: 150, k: 2, dir: 'down' }, ...others.slice(0, 4).map((o, i) => ({ look: o.look, x: [60, 150, 420, 520][i], y: 166, k: 1, dir: i < 2 ? 'right' : 'left', label: o.name, bob: true, phase: i * 9 }))];
        st.fx = { myRow: rint(rngOf(Y, rid, E.no), 0, 8) };
        await g.say(cfg.gakuyaLine ? cfg.gakuyaLine(g, S, rid) : '楽屋には、出番を待つ芸人がずらり。\nみんな、ぶつぶつネタを口にしている。');
        if (others[0]) await say(g, { name: others[0].name, look: others[0].look }, cfg.rivalLine(g, S, rid, others[0]));
        // 楽屋でできること
        const done = {};
        for (let guard = 0; guard < 6; guard++) {
          const ch = [];
          if (!done.debayashi) ch.push(['debayashi', '出囃子・音響の確認']);
          if (!done.awase) ch.push(['awase', cfg.awaseLabel || 'ネタ合わせをする']);
          if (!done.props && cfg.propsLabel && cfg.propsLabel(E)) ch.push(['props', cfg.propsLabel(E)]);
          if (rd.rehearsal && !done.reh) ch.push(['reh', 'リハーサル（場当たり）']);
          ch.push(['go', '舞台袖へ向かう']);
          const k = await g.ask('出番まで、まだ時間がある。', ch.map((x) => x[1]), { cancel: ch.length - 1 });
          const key = (ch[k] || ch[ch.length - 1])[0];
          if (key === 'go') break;
          done[key] = true;
          if (key === 'debayashi') await C.debayashi(g, S, E, rid, st);
          else if (key === 'awase') await (cfg.awase ? cfg.awase(g, C, { S, E, rid, st }) : g.say('ひとりで、ネタを頭から最後まで通した。'));
          else if (key === 'props') await cfg.props(g, C, { S, E, rid, st });
          else if (key === 'reh') await C.rehearsal(g, S, E, rid, st);
        }
        E.roundPrep = done;
        // 舞台袖
        st.set = 'sode'; st.sign = `舞台袖　${rd.name}`;
        st.cast = [{ look: g.state.look, x: 230, y: 150, k: 2, dir: 'right' }, { look: KANTOKU.look, x: 140, y: 186, k: 1, dir: 'right' }];
        await say(g, KANTOKU, [`${E.no}番、${E.unitName}さん。袖スタンバイお願いします。`, '前の組が終わったら、明転でいきます。']);
        const pr = others[1] || others[0];
        if (pr) {
          const good = rngOf(Y, rid, 'prev', E.no)() < 0.5;
          await g.say(`モニターの中で、前の出番の${pr.name}が${good ? '大きな笑いをとっている。\n…客席は温まっている！' : '…静まりかえった客席に苦戦している。\n空気が、重い。'}`);
        }
        const k2 = await g.ask('出番直前。', ['袖で、小声でネタをさらう（舞台裏稽古）', '深呼吸して、心を落ち着ける'], { cancel: 1 });
        if (k2 === 0) { done.keiko = true; await g.say('つかみの一言と、オチの間だけを、口の中でくり返した。'); }
        else { done.calm = true; await g.say('すーっ…はーっ…。\n手のふるえが、すこしおさまった。'); }
      } else {
        await g.say(`${venue}で、${rules.title} ${rd.name}。\n受付・楽屋・袖をすませ、いよいよ出番！`);
      }
      // 本番
      st.set = rd.tv ? 'studio' : 'hall';
      st.sign = `${rules.title}　${rd.name}`;
      st.sub = venue;
      st.fx = cfg.stageFx ? cfg.stageFx(E, rules, rid) : {};
      st.cast = cfg.stageCast ? cfg.stageCast(g, E, rid) : [{ look: g.state.look, x: 288, y: 156, k: 2, dir: 'down' }];
      sfx('drum');
      if (!quick) await g.say(cfg.debayashiLine ? cfg.debayashiLine(g, E, rid) : '♪──出囃子が鳴った！\nセンターマイクへ！');
      const neta = await chooseNeta(g, { kind, length: rd.length, cid: cfg.id, title: `${rules.title} ${rd.name}`, auto: sim });
      E.neta = !isAutoNeta(neta) ? neta.id : E.neta;
      const same = netaUsedBefore(neta, cfg.id);
      const power = powerOf(g, kind);
      const quality = qualityOf(g, neta, cfg.id);
      const pressure = rd.final ? 95 : rid === 'r1' ? 40 : 55 + C.roundIndex(Y, rid) * 8;
      res = await performAct(g, {
        kind, neta, length: rd.length, style: E.style || undefined,
        venue: { name: venue, size: rd.tv ? 'tv' : 'theater', crowd: rid === 'r1' ? 'tough' : 'normal', pressure },
        contest: { id: cfg.id, round: rid, name: rules.title }, title: `${rules.title} ${rd.name}`, skip: sim, ...(cfg.performExtra ? cfg.performExtra(g, E) : {}),
      });
      const prep = C.prepBonus(E, E.roundPrep || {});
      tot = playerTotal(g, res, { power, quality, prep, same: samePenalty(g, neta, cfg.id) });
      if (!isAutoNeta(neta)) safe(() => has(g, 'markNetaUsed') && g.markNetaUsed(neta.id, cfg.id));
      // the crowd
      const big = tot.total >= 75;
      st.fx = { ...(st.fx || {}), react: big };
      sfx(big ? 'laugh' : tot.total >= 55 ? 'applause' : 'cancel');
      if (!quick) await g.say(cfg.afterLine ? cfg.afterLine(g, res, tot) : big ? 'ドッカーン！！客席が揺れた！' : tot.total >= 55 ? 'ウケた！ちゃんと笑いは起きた。' : '…思ったほど、笑いが起きなかった。');
      // the results
      const R0 = C.simRound(g, S, rid, { total: tot.total });
      passed = R0.passed.includes('player');
      const ord = R0.order.slice().sort((a, b) => b.total - a.total);
      place = ord.findIndex((x) => x.id === 'player') + 1;
      E.done[rid] = true;
      E.results.push({ round: rid, score: res.score, total: tot.total, rank: res.rank, passed, place, day: g.state.day, cut: R0.cut, field: R0.field });
      E.lastPerf = { score: res.score, total: tot.total, same };
      st.fx = { ...(st.fx || {}), react: false };
      await C.showResult(g, S, rid, { res, tot, passed, place, R0, quick, same });
      return { res, tot, passed };
    } finally {
      unstage(g, st);
      roomBgm(g);
    }
  };
  C.roundIndex = (Y, rid) => cfg.rules(Y).rounds.findIndex((x) => x.id === rid);
  // The honest odds of the player's next round: the expected total (C's model of the act, the best script, the preparation)
  // against the round's cut line → { pct, exp, cut, word, text }
  C.odds = (g, Y0, rid0) => {
    const Y = Y0 || C.seasonY(g);
    if (!Y) return null;
    const S = C.season(g, Y);
    const E = S.entry;
    const rid = rid0 || (E && E.round) || cfg.rules(Y).rounds[0].id;
    const rd = C.roundDef(Y, rid);
    if (!rd) return null;
    const kind = (E && E.kind) || cfg.defaultKind || 'pin';
    const list = safe(() => (has(g, 'netaList') ? g.netaList(kind) : []), []) || [];
    const quality = list.length ? Math.max(...list.map((n) => qualityOf(g, n, cfg.id))) : 40;
    const power = powerOf(g, kind);
    const perf = safe(() => (has(g, 'performSim') ? g.performSim({ kind, power, quality, rng: rngOf('odds', Y, rid) }).score : power * 0.5 + quality * 0.4), 50);
    const exp = perf * 0.55 + (power * 0.55 + quality * 0.45) * 0.45 + (E ? C.prepBonus(E, {}) : 0);
    let cut;
    if (rd.final) {
      const fins = (S.rounds[cfg.rules(Y).lastPrelim] || {}).passed || [];
      const strs = fins.map((id) => (C.find(S, id) || {}).str).filter(Boolean).sort((a, b) => b - a);
      cut = rivalTotal(g, strs[0] || (cfg.topStr || 86), rngOf('oddsF', Y), kind) + 1;
    } else cut = cutScore(g, { mu: rd.mu, sd: rd.sd, field: C.fieldOf(S, rd), pass: C.passOf(S, rd), kind, seed: `${cfg.id}|${Y}|${rid}` });
    const pct = Math.round(clamp(0.5 * (1 + erf((exp - cut) / (6 * Math.SQRT2))), 0.01, 0.99) * 100);
    const word = pct >= 80 ? 'かなり有利' : pct >= 55 ? '五分以上' : pct >= 30 ? '厳しめ' : pct >= 10 ? 'かなり厳しい' : 'ほぼ無理（実力不足）';
    return { pct, exp: Math.round(exp * 10) / 10, cut: Math.round(cut * 10) / 10, word, round: rd.name, text: `${rd.name}${rd.final ? '優勝' : '通過'}の見込み 約${pct}%（${word}）` };
  };
  C.prepBonus = (E, done) => {
    let b = (num(E.prep.practice) / 100) * 5;
    if (cfg.usesProps && cfg.usesProps(E)) b += (num(E.prep.flip) / 100) * 3;
    if (done.awase) b += 1;
    if (done.debayashi) b += 0.5;
    if (done.reh) b += 1.5;
    if (done.keiko) b += 1;
    if (done.calm) b += 0.5;
    return Math.round(b * 10) / 10;
  };
  C.debayashi = async (g, S, E, rid, st) => {
    const rules = cfg.rules(S.Y);
    st.cast = [...st.cast.slice(0, 1), { look: SOUND.look, x: 380, y: 150, k: 2, dir: 'left' }];
    await say(g, SOUND, cfg.soundLines ? cfg.soundLines(g, E, rid, rules) : ['音響です。登場の出囃子と、終わりの暗転のきっかけを確認させてください。', 'マイクの高さは、このままで大丈夫ですか？']);
    const k = await g.ask('どうする？', ['マイクの高さを合わせてもらう', 'このままで大丈夫です'], { cancel: 1 });
    await say(g, SOUND, k === 0 ? 'はい、口の高さに合わせました。本番もこの位置で。' : '了解です。では本番、よろしくお願いします！');
    st.cast = st.cast.slice(0, 1).concat(st.cast.slice(2));
  };
  C.rehearsal = async (g, S, E, rid, st) => {
    const prev = st.set;
    st.set = 'rehearsal';
    st.cast = [{ look: g.state.look, x: 288, y: 156, k: 2 }, { look: AD.look, x: 470, y: 200, k: 1, dir: 'left' }];
    await say(g, AD, ['場当たりいきます！立ち位置はバミリのところで。', '照明、明転……はい。マイク、チェックお願いします。']);
    await g.say('「あー、あー」…声が、広いスタジオに吸いこまれていく。\n本番の景色が、少しだけ見えた。');
    st.set = prev;
  };

  // the results of a round (board, then the news of passing / 実力不足)
  C.showResult = async (g, S, rid, o) => {
    const Y = S.Y;
    const rules = cfg.rules(Y);
    const rd = C.roundDef(Y, rid);
    const E = S.entry;
    const th = theme(Y);
    // the next round of someone who passed (the 復活ステージ is only for those who fell in the last preliminary)
    const nextRd = rules.rounds.slice(C.roundIndex(Y, rid) + 1).find((x) => x.id !== 'rev');
    // the board of numbers (a block around the player's)
    const rng = rngOf(cfg.id, Y, rid, 'board', E.no);
    const nums = [];
    const passRate = clamp(o.R0.pass / Math.max(1, o.R0.field), 0.05, 0.8);
    const base = Math.max(1, E.no - rint(rng, 10, 30));
    for (let i = 0, k = base; nums.length < 39; i++, k += rint(rng, 1, 3)) {
      if (k === E.no) continue;
      nums.push({ no: k, pass: rng() < passRate });
    }
    nums.push({ no: E.no, pass: o.passed, me: true });
    nums.sort((a, b) => a.no - b.no);
    const res0 = rid === 'sf' || rd.tv || rd.announce === 'stage' ? null : rules.boardWhere || '公式サイト';
    if (!o.quick) await g.say(rd.resultLine || (res0 ? `${rd.name}の結果は、その日の夜に${res0}で発表される…。` : '結果発表…！'));
    if (!rd.boardless) await CARDS.passBoard(g, { title: `${rules.title}　${rd.name}　合格者`, sub: `${cfg.venueName(Y, rid, (C.myDate(g, S) || {}).venue)}（出場 約${n0(o.R0.field)}${cfg.unitWord} → 通過 ${n0(o.R0.pass)}${cfg.unitWord}）`, nums, passed: o.passed, foot: `あなたの得点の目安：${o.tot.total.toFixed(1)}　（通過ライン：およそ ${o.R0.cut.toFixed(1)}）` }, th);
    const s = C.state(g);
    s.seen.round = true;
    if (o.passed) {
      sfx('success');
      E.status = 'passed';
      E.round = nextRd ? nextRd.id : 'final';
      E.dateRound = E.round;
      E.dateIdx = 0;
      if (cfg.chooseNextDate && nextRd) E.dateIdx = await cfg.chooseNextDate(g, C, { S, E, rd: nextRd });
      g.addFame(rd.fame ?? 5);
      const nx = (C.cal(g, Y).rounds[E.round] || [])[E.dateIdx];
      contestMail(g, cfg.id, `【${rd.name} 合格のお知らせ】\n${E.unitName}様（No.${E.no}）\n${nextRd ? `${nextRd.name}：${nx ? dateText(nx.m, nx.d) + '（' + cfg.venueName(Y, nextRd.id, nx.venue) + '）' : '後日'}` : ''}`, cfg.office);
      C.logMe(g, S, `${rd.name} 通過（${o.tot.total.toFixed(1)}）`);
      if (rid === rules.lastPrelim) await C.finalistNight(g, S);
      else await g.say(`${rd.name}、通過！\n${nextRd ? `次は${nextRd.name}（${nx ? dateText(nx.m, nx.d) : ''}）。` : ''}もっとネタを磨こう！`);
    } else {
      sfx('fail');
      const canRev = rid === rules.lastPrelim && rules.rounds.some((x) => x.id === 'rev') && C.revivalInvite(g, S);
      E.status = canRev ? 'revival' : 'out';
      if (canRev) { E.round = 'rev'; E.dateRound = 'rev'; E.dateIdx = 0; }
      C.logMe(g, S, `${rd.name} 敗退（${o.tot.total.toFixed(1)}）${canRev ? '→ 復活ステージへ' : ''}`);
      const reasons = shortfallReasons(g, E.kind || 'pin', o.res, { same: o.same, practice: E.prep.practice, need: Math.round(o.R0.cut) });
      await infoCard(g, `${rd.name}　敗退 ── 実力不足`, [`得点の目安 ${o.tot.total.toFixed(1)}　通過ライン ${o.R0.cut.toFixed(1)}（約${n0(o.R0.field)}${cfg.unitWord}中 ${n0(o.R0.pass)}${cfg.unitWord}通過）`, ...reasons.map((x) => '・' + x), canRev ? '…でも、まだ「復活ステージ」がある！' : cfg.loseTip || 'ネタを書き直し、場数を踏んで、また来年。'], { theme: th, color: '#e8e8f0' });
      if (cfg.partnerAfter && E.solo) await cfg.partnerAfter(g, C, { S, E, passed: false, rid });
    }
  };
  C.revivalInvite = (g, S) => {
    const sf = S.rounds[cfg.rules(S.Y).lastPrelim];
    if (!sf) return false;
    const ord = sf.order.slice().sort((a, b) => b.total - a.total);
    const pos = ord.findIndex((x) => x.id === 'player');
    return pos >= 0 && pos < sf.pass + 14;
  };

  // the night of the last preliminary: 決勝進出者発表会見 + キャッチコピー
  C.finalistNight = async (g, S) => {
    const Y = S.Y;
    const rules = cfg.rules(Y);
    const th = theme(Y);
    const E = S.entry;
    const fins = C.finalists(g, S);
    const looks = fins.map((id) => (id === 'player' ? g.state.look : C.lookOf(C.find(S, id))));
    const st = stage(g, { set: 'press', theme: th, sign: `${rules.title}　決勝進出者発表会見`, sub: rules.final.date || '', fx: { flash: true }, cast: looks.slice(0, 12).map((lk, i, a) => ({ look: lk, x: SW / 2 - 16 - ((a.length - 1) / 2 - i) * Math.min(56, (SW - 60) / a.length), y: 150, k: 1, bob: true, phase: i * 5 })) });
    try {
      sfx('fanfare');
      await g.say(`${rules.lastPrelimName || '準決勝'}の結果が発表された。\n決勝進出者、${fins.length}${cfg.unitWord}──\nその中に、${E.unitName}の名前がある！！`);
      g.addFame(rules.final.finalistFame ?? 60);
      C.state(g).me.finals = num(C.state(g).me.finals) + 1;
      await say(g, cfg.mc(Y)[0], cfg.pressLines ? cfg.pressLines(g, S) : ['決勝進出、おめでとうございます！ひと言お願いします！']);
      await g.ask('記者の質問：「決勝への意気込みを！」', ['優勝しか見えてません！', 'ここまで来たら、楽しみます', '…（緊張で声が出ない）'], { cancel: 1 });
      E.catch = cfg.catchcopy(g, S, 'player');
      await CARDS.catchCard(g, { looks: C.myLooks(g, E), top: `${rules.title}　ファイナリスト`, copy: E.catch, name: E.unitName, vtr: cfg.vtr ? cfg.vtr(g, S) : '' }, th);
      for (const id of fins) if (id !== 'player') { const n = C.find(S, id); if (n && !n.catch) n.catch = cfg.catchcopy(g, S, id); }
      contestMail(g, cfg.id, `【決勝進出のお知らせ】\n${E.unitName}様　決勝：${rules.final.when(C.cal(g, Y))}\n${rules.broadcast}。当日はリハーサルから入っていただきます。`, cfg.office);
      if (cfg.partnerAfter && E.solo) await cfg.partnerAfter(g, C, { S, E, passed: true, rid: rules.lastPrelim, final: true });
    } finally { unstage(g, st); }
  };

  // ---------------------------------------------------------------- the final day (生放送)
  C.final = async (g, mode0) => {
    const Y = C.seasonY(g);
    const S = C.season(g, Y);
    const E = S.entry;
    const rules = cfg.rules(Y);
    const th = theme(Y);
    const due = C.dueRound(g, S);
    if (!E || !due || !['final', 'rev'].includes(due.rid)) { await g.say('今日は決勝の日ではない。'); return null; }
    const why = goRefusal(g);
    if (why) { await g.say(why); return null; }
    const s = C.state(g);
    const first = !s.seen.final;
    let mode = mode0 || (g.auto ? 'auto' : 'full');
    if (!mode0 && !first && !g.auto) mode = ['full', 'quick', 'auto'][await g.ask(`${rules.title} 決勝。`, ['すべて見る', '自分の出番と結果だけ', 'おまかせ（本番もシミュレーション）'], { cancel: 0 })] || 'full';
    const quick = mode !== 'full';
    const sim = mode === 'auto';
    g.useStamina(Math.min(g.state.stamina, 30));
    if (has(g, 'lifeTick')) g.lifeTick({ stress: 15, hunger: -10 });
    const J = cfg.judges(g, Y);
    const MC = cfg.mc(Y);
    const st = stage(g, { set: 'rehearsal', theme: th, sign: `${rules.title}　決勝`, cast: [{ look: g.state.look, x: 288, y: 156, k: 2 }] });
    let F = null;
    try {
      g.bgm('studio');
      // 復活ステージ (the player in it)
      if (E.status === 'revival') {
        const ok = await C.revivalStage(g, S, st, quick, sim);
        if (!ok) return null;
      }
      if (!quick) {
        await say(g, AD, ['おはようございます！今日は決勝の生放送です。', 'まずリハーサル、そのあと楽屋で待機。本番は' + (rules.final.onair || '夜') + 'からです！']);
        await C.rehearsal(g, S, E, 'final', st);
        st.set = 'gakuya';
        st.sign = `決勝　楽屋`;
        const fins0 = C.finalists(g, S).filter((id) => id !== 'player').slice(0, 4).map((id) => C.find(S, id)).filter(Boolean);
        st.cast = [{ look: g.state.look, x: 260, y: 150, k: 2 }, ...fins0.map((n, i) => ({ look: C.lookOf(n), x: [60, 150, 420, 520][i], y: 166, k: 1, label: n.name, bob: true, phase: i * 7 }))];
        if (fins0[0]) await say(g, { name: fins0[0].name, look: C.lookOf(fins0[0]) }, cfg.finalRivalLine ? cfg.finalRivalLine(g, S, fins0[0]) : 'おたがい、最高の4分にしよな。');
        const k = await g.ask('本番まで、あと少し。', ['もう一度、ひとりでネタを通す', '出囃子とマイクの最終確認', '目を閉じて集中する'], { cancel: 2 });
        E.roundPrep = { awase: k === 0, debayashi: k === 1, reh: true, calm: k === 2 };
        if (k === 0) await g.say('最初から最後まで、通した。\n…いける。');
        else if (k === 1) await C.debayashi(g, S, E, 'final', st);
        else await g.say('楽屋の喧騒が、遠くなった。');
      } else E.roundPrep = { reh: true };
      // ON AIR
      st.set = 'studio'; st.sign = rules.final.studioSign || rules.title;
      st.fx = { judges: J.map((j) => ({ ...j })), mc: true, crowd: true };
      st.cast = [{ look: MC[0].look, x: 520, y: 150, k: 2, dir: 'left' }, ...(MC[1] ? [{ look: MC[1].look, x: 568, y: 160, k: 1, dir: 'left' }] : [])];
      sfx('fanfare');
      const fins = C.finalists(g, S);
      const pvFin = fins.map((id) => ({ name: id === 'player' ? E.unitName : (C.find(S, id) || {}).name, looks: id === 'player' ? C.myLooks(g, E) : C.looksOf(C.find(S, id)), me: id === 'player' }));
      if (!quick) {
        await CARDS.pvCard(g, { logo: rules.title, sub: rules.sub || '', tagline: rules.tagline, countLabel: 'エントリー総数', count: S.entries, countUnit: cfg.unitWord, countFoot: rules.countFoot || '', finalists: pvFin, end: '決勝' }, th);
        await say(g, MC[0], cfg.openLines(g, S, rules));
        await infoCard(g, `${rules.title}　決勝の審査員`, J.map((j) => `${j.name}（${j.title}）`).concat(['', rules.final.formatText]), { theme: th });
      }
      F = await C.runFinal(g, S, { quick, sim, st, J, MC, th });
    } finally {
      unstage(g, st);
      roomBgm(g);
    }
    if (F) await C.afterFinal(g, S, F);
    else if (S.entry && S.entry.status === 'out' && (!S.final || !S.final.done)) {
      // lost the 復活ステージ: the final goes on without the player
      const F2 = await C.simFinal(g, S, null);
      if (F2) await g.say(`その夜の決勝──\n${cfg.rules(Y).title}の王者は、${F2.champName}だった。`);
    }
    return F;
  };

  // 復活ステージ (R-1 2015–2023): the player among the 準決勝's best losers
  C.revivalStage = async (g, S, st, quick, sim) => {
    const Y = S.Y;
    const rules = cfg.rules(Y);
    const rd = C.roundDef(Y, 'rev');
    const E = S.entry;
    st.set = 'studio';
    st.sign = `${rules.title}　${rd.name}`;
    st.fx = { crowd: true };
    st.cast = [{ look: g.state.look, x: 288, y: 156, k: 2 }];
    if (!quick) await g.say([`${rd.name}──\n準決勝で敗れた者たちの、最後のチャンス。`, `ここで勝ち上がれるのは、${rd.pass}人だけ。`]);
    const kind = E.kind || 'pin';
    const neta = await chooseNeta(g, { kind, length: rd.length, cid: cfg.id, title: rd.name, auto: sim });
    const res = await performAct(g, { kind, neta, length: rd.length, style: E.style || undefined, venue: { name: rd.name, size: 'tv', crowd: 'normal', pressure: 85 }, contest: { id: cfg.id, round: 'rev', name: rules.title }, title: `${rules.title} ${rd.name}`, skip: sim, ...(cfg.performExtra ? cfg.performExtra(g, E) : {}) });
    const tot = playerTotal(g, res, { power: powerOf(g, kind), quality: qualityOf(g, neta, cfg.id), prep: C.prepBonus(E, {}), same: samePenalty(g, neta, cfg.id) });
    if (!isAutoNeta(neta)) safe(() => has(g, 'markNetaUsed') && g.markNetaUsed(neta.id, cfg.id));
    const R0 = C.simRound(g, S, 'rev', { total: tot.total });
    const ok = R0.passed.includes('player');
    E.done.rev = true;
    E.results.push({ round: 'rev', score: res.score, total: tot.total, rank: res.rank, passed: ok, place: R0.order.slice().sort((a, b) => b.total - a.total).findIndex((x) => x.id === 'player') + 1, day: g.state.day, cut: R0.cut });
    await g.say('結果発表……');
    await drumroll(g, 8);
    if (ok) {
      sfx('fanfare');
      E.status = 'passed'; E.round = 'final'; E.dateRound = 'final'; E.dateIdx = 0;
      await g.say(`復活したのは──${E.unitName}！！\n決勝の舞台へ！`);
      C.logMe(g, S, `${rd.name}から決勝へ`);
      E.catch = cfg.catchcopy(g, S, 'player');
      return true;
    }
    sfx('fail');
    E.status = 'out';
    C.logMe(g, S, `${rd.name}で敗退`);
    await g.say(`復活したのは、${(C.find(S, R0.passed[0]) || {}).name || '別の芸人'}。\n…あと一歩、届かなかった。`);
    return false;
  };

  // the final (also used without the player: present = false). Returns F.
  C.simFinal = (g, S, ctx) => C.runFinalCore(g, S, null);
  C.runFinal = async (g, S, ui) => C.runFinalCore(g, S, ui);
  C.runFinalCore = async (g, S, ui) => {
    const Y = S.Y;
    const rules = cfg.rules(Y);
    const fmt = rules.final;
    const E = S.entry;
    const rng = rngOf(cfg.id, Y, 'final');
    const J = cfg.judges(g, Y);
    for (const rd0 of rules.rounds) if (rd0.id !== 'final' && rd0.id !== 'rev' && !S.rounds[rd0.id]) C.simRound(g, S, rd0.id, null);
    if (rules.rounds.some((x) => x.id === 'rev') && !S.rounds.rev) C.simRound(g, S, 'rev', null);
    let fins = C.finalists(g, S);
    if (!ui) fins = fins.filter((id) => id !== 'player');
    // make sure the final is full (a season simulated late, or the player withdrew)
    let k = 0;
    while (fins.length < fmt.finalists) {
      const n = cfg.notable(rngOf(cfg.id, Y, 'fill', k), Y, S.notables.length, { dark: true, used: new Set(S.notables.map((x) => x.name)) });
      n.id = `f${k++}`; n.str = 80 + rng() * 6; n.seed = rint(rng, 1, 1e9); n.tags = ['初の決勝'];
      if (!S.notables.some((x) => x.id === n.id)) S.notables.push(n);
      fins.push(n.id);
    }
    const kind = cfg.kindOf ? cfg.kindOf(S) : 'pin';
    const order = fmt.order === 'random' || !fmt.order ? shuffleR(rngOf(cfg.id, Y, 'order'), fins) : fins;
    const F = { done: false, order, perf: {}, scores: {}, stage1: [], stage2: [], blocks: null, champ: null, champName: '', runnerName: '', ranking: [] };
    const nameOf = (id) => (id === 'player' ? (E && E.unitName) || g.state.name : (C.find(S, id) || {}).name || '？');
    const lookOf = (id) => (id === 'player' ? C.myLooks(g, E) : C.looksOf(C.find(S, id)));
    const strOf = (id) => (C.find(S, id) || {}).str || 75;
    const styleOf = (id) => (id === 'player' ? (E && (E.style || E.kind)) : (C.find(S, id) || {}).style);
    const judgeScore = (total, j, id, r) => clamp(Math.round(fmt.judgeBase + total * fmt.judgeK + (j.taste && j.taste === styleOf(id) ? 1.5 : 0) + gauss(r) * 1.6), fmt.judgeMin || 70, fmt.judgeMax || 99);
    const perceived = (total, j, id, r) => total + (j.taste && j.taste === styleOf(id) ? 1.5 : 0) + gauss(r) * 1.8;
    // one performance: the player (live) or a rival (simulated)
    const perform = async (id, stageNo, note) => {
      if (id !== 'player') return rivalTotal(g, strOf(id) + (stageNo === 2 ? -1 : 0), rngOf(cfg.id, Y, 'perf', id, stageNo), kind);
      const st = ui.st;
      st.set = 'studio';
      st.fx = { ...(st.fx || {}), judges: J.map((j) => ({ ...j })), mc: true, crowd: true, react: false, ...(cfg.stageFx ? cfg.stageFx(E, rules, 'final') : {}) };
      st.cast = cfg.stageCast ? cfg.stageCast(g, E, 'final') : [{ look: g.state.look, x: 288, y: 156, k: 2 }];
      if (!ui.quick) {
        if (stageNo === 1) await CARDS.catchCard(g, { looks: C.myLooks(g, E), top: `${rules.title}　エントリーナンバー${E.no}`, copy: E.catch || cfg.catchcopy(g, S, 'player'), name: E.unitName, vtr: cfg.vtr ? cfg.vtr(g, S) : '' }, ui.th);
        sfx('drum');
        await g.say(note || (cfg.debayashiLine ? cfg.debayashiLine(g, E, 'final') : '♪──出囃子！'));
      }
      const pk = (E && E.kind) || kind;
      const neta = await chooseNeta(g, { kind: pk, length: fmt.length, cid: cfg.id, title: stageNo === 2 ? '最終決戦のネタ' : '決勝のネタ', auto: ui.sim, exclude: stageNo === 2 && E.finalNeta ? [E.finalNeta] : [] });
      const res = await performAct(g, { kind: pk, neta, length: fmt.length, style: E.style || undefined, venue: { name: rules.title, size: 'tv', crowd: 'normal', pressure: stageNo === 2 ? 100 : 92 }, contest: { id: cfg.id, round: stageNo === 2 ? 'final2' : 'final', name: rules.title }, title: `${rules.title} 決勝${stageNo === 2 ? '（最終決戦）' : ''}`, skip: ui.sim, ...(cfg.performExtra ? cfg.performExtra(g, E) : {}) });
      const tot = playerTotal(g, res, { power: powerOf(g, pk), quality: qualityOf(g, neta, cfg.id), prep: C.prepBonus(E, E.roundPrep || {}) + 1, same: samePenalty(g, neta, cfg.id) || (stageNo === 2 && !isAutoNeta(neta) && E.finalNeta && neta.id === E.finalNeta) });
      if (!isAutoNeta(neta)) { if (stageNo === 1) E.finalNeta = neta.id; safe(() => has(g, 'markNetaUsed') && g.markNetaUsed(neta.id, cfg.id)); }
      st.fx.react = tot.total >= 75;
      sfx(tot.total >= 75 ? 'laugh' : 'applause');
      E.results.push({ round: stageNo === 2 ? 'final2' : 'final', score: res.score, total: tot.total, rank: res.rank, passed: null, day: g.state.day });
      return tot.total;
    };
    const showRival = async (id, total, stageNo) => {
      if (!ui || ui.quick) return;
      const n = C.find(S, id);
      const line = cfg.rivalNetaLine ? cfg.rivalNetaLine(g, S, n, total, stageNo) : `${n.name}のネタ。`;
      ui.st.cast = C.looksOf(n).map((lk, i, a) => ({ look: lk, x: 288 + (i - (a.length - 1) / 2) * 60, y: 156, k: 2, dir: a.length > 1 ? (i < (a.length - 1) / 2 ? 'right' : i > (a.length - 1) / 2 ? 'left' : 'down') : 'down' }));
      ui.st.fx.react = total >= 80;
      await g.say(`${stageNo === 1 ? `「${n.catch || cfg.catchcopy(g, S, id)}」\n` : ''}${line}`);
    };
    const scoreOne = async (id, total, stageNo, done) => {
      const r = rngOf(cfg.id, Y, 'judge', id, stageNo);
      const sc = J.map((j) => judgeScore(total, j, id, r));
      const sum = sc.reduce((a, b) => a + b, 0);
      F.scores[id + ':' + stageNo] = sc;
      if (ui && (!ui.quick || id === 'player')) {
        const ranked = done.concat([{ id, sum }]).sort((a, b) => b.sum - a.sum);
        const pos = ranked.findIndex((x) => x.id === id) + 1;
        await CARDS.scoreCard(g, { name: nameOf(id), look: lookOf(id), sub: stageNo === 2 ? '最終決戦' : `${done.length + 1}番目`, judges: J, scores: sc, total: sum, rankText: stageNo === 1 ? `現在 ${pos}位` : '' }, ui.th);
      }
      return sum;
    };
    // ---- formats
    if (fmt.format === 'score' || fmt.format === 'oneshot') {
      const done = [];
      for (const id of order) {
        const total = await perform(id, 1);
        F.perf[id] = { total };
        if (id !== 'player') await showRival(id, total, 1);
        const sum = await scoreOne(id, total, 1, done);
        done.push({ id, sum });
      }
      done.sort((a, b) => b.sum - a.sum);
      F.stage1 = done;
      if (ui) await CARDS.rankBoard(g, { title: fmt.format === 'oneshot' ? '最終結果' : `${fmt.stage1Name || 'ファーストステージ'}　結果`, rows: done.map((x, i) => ({ rank: i + 1, name: nameOf(x.id), look: lookOf(x.id), value: `${x.sum}点`, me: x.id === 'player', mark: fmt.format !== 'oneshot' && i < fmt.advance ? '進出' : null })) }, ui.th);
      if (fmt.format === 'oneshot') { F.champ = done[0].id; F.ranking = done.map((x) => x.id); }
      else F.champ = await C.finalStage(g, S, F, done.slice(0, fmt.advance).map((x) => x.id), { ui, perform, showRival, scoreOne, perceived, nameOf, lookOf, J, rng });
    } else if (fmt.format === 'block3pt' || fmt.format === 'blockScore' || fmt.format === 'blockKO') {
      const nb = fmt.blocks || 3;
      const per = Math.ceil(order.length / nb);
      const blocks = [];
      for (let b = 0; b < nb; b++) blocks.push(order.slice(b * per, b * per + per));
      F.blocks = [];
      const winners = [];
      for (let b = 0; b < nb; b++) {
        const ids = blocks[b];
        const bname = `${'ABCDE'[b]}ブロック`;
        if (ui && !ui.quick) await g.say(`${bname}！`);
        const totals = {};
        const done = [];
        let king = null;
        for (const id of ids) {
          const total = await perform(id, 1);
          totals[id] = total;
          F.perf[id] = { total };
          if (id !== 'player') await showRival(id, total, 1);
          if (fmt.format === 'blockScore') { const sum = await scoreOne(id, total, 1, done); done.push({ id, sum }); }
          if (fmt.format === 'blockKO') {
            if (!king) { king = id; if (ui && (!ui.quick || id === 'player')) await g.say(`${nameOf(id)}、まずは暫定の勝者に。`); }
            else {
              const r = rngOf(cfg.id, Y, 'ko', king, id);
              const votes = J.map((j) => (perceived(totals[id], j, id, r) > perceived(totals[king], j, king, r) ? 1 : 0));
              const v = votes.reduce((a, c) => a + c, 0);
              const winner = v * 2 > J.length ? id : king;
              if (ui && (!ui.quick || id === 'player' || king === 'player')) await CARDS.voteCard(g, { title: `${bname}　ノックアウト投票`, cands: [king, id].map((x) => ({ name: nameOf(x), look: lookOf(x), me: x === 'player' })), votes: votes.map((x) => x), judges: J }, ui.th);
              if (ui && (!ui.quick || id === 'player' || king === 'player')) await g.say(`${nameOf(winner)}が勝ち残り！`);
              king = winner;
            }
          }
        }
        let win;
        if (fmt.format === 'block3pt') {
          const pts = Object.fromEntries(ids.map((id) => [id, 0]));
          const votes = [];
          const r = rngOf(cfg.id, Y, 'block', b);
          const voters = J.concat(fmt.audience ? [{ name: '視聴者（dボタン投票）', short: '視聴者', look: LOOKS.fan, title: 'お茶の間投票' }] : []);
          for (const j of voters) {
            const p = ids.map((id) => ({ id, v: perceived(totals[id], j, id, r) })).sort((a, c) => c.v - a.v);
            const give = p[0].v - p[1].v > 3 ? [3, 0, 0] : p[1].v - p[2].v < 1.2 ? [1, 1, 1] : [2, 1, 0];
            give.forEach((x, i) => { pts[p[i].id] += x; });
            votes.push(give);
          }
          const ranked = ids.slice().sort((a, c) => pts[c] - pts[a] || totals[c] - totals[a]);
          win = ranked[0];
          F.blocks.push({ name: bname, ids, pts });
          if (ui && (!ui.quick || ids.includes('player'))) await CARDS.rankBoard(g, { title: `${bname}　結果（持ち点3の振り分け）`, rows: ranked.map((id, i) => ({ rank: i + 1, name: nameOf(id), look: lookOf(id), value: `${pts[id]}点`, me: id === 'player', mark: i === 0 ? '勝ち抜け' : null })) }, ui.th);
        } else if (fmt.format === 'blockScore') {
          done.sort((a, c) => c.sum - a.sum);
          win = done[0].id;
          F.blocks.push({ name: bname, ids, sums: Object.fromEntries(done.map((x) => [x.id, x.sum])) });
          if (ui && (!ui.quick || ids.includes('player'))) await CARDS.rankBoard(g, { title: `${bname}　結果`, rows: done.map((x, i) => ({ rank: i + 1, name: nameOf(x.id), look: lookOf(x.id), value: `${x.sum}点`, me: x.id === 'player', mark: i === 0 ? '勝ち抜け' : null })) }, ui.th);
        } else { win = king; F.blocks.push({ name: bname, ids, winner: king }); }
        winners.push(win);
        F.stage1.push(...ids.map((id) => ({ id, sum: Math.round(totals[id] * 10) / 10 })));
      }
      F.champ = await C.finalStage(g, S, F, winners, { ui, perform, showRival, scoreOne, perceived, nameOf, lookOf, J, rng });
    }
    // ranking: champion, then the final stage, then the rest by their first-stage numbers
    const fsIds = F.stage2.map((x) => x.id);
    const rest = F.stage1.filter((x) => !fsIds.includes(x.id)).sort((a, b) => b.sum - a.sum).map((x) => x.id);
    F.ranking = [F.champ, ...F.stage2.filter((x) => x.id !== F.champ).sort((a, b) => b.v - a.v).map((x) => x.id), ...rest.filter((id) => id !== F.champ)];
    F.champName = nameOf(F.champ);
    F.runnerName = nameOf(F.ranking[1]);
    F.champType = F.champ === 'player' ? (E && E.type) : (C.find(S, F.champ) || {}).type;
    F.done = true;
    F.day = g.state.day;
    F.note = cfg.finalNote ? cfg.finalNote(g, S, F) : '';
    S.final = F;
    const hist = C.state(g).hist;
    hist[Y] = { champ: F.champName, runner: F.runnerName, champType: F.champType, champPlayer: F.champ === 'player', note: F.note, finalists: F.order.map(nameOf) };
    return F;
  };
  // the final stage: re-perform (in the reverse order of the first stage) and decide
  C.finalStage = async (g, S, F, ids, h) => {
    const Y = S.Y;
    const rules = cfg.rules(Y);
    const fmt = rules.final;
    const { ui, perform, showRival, scoreOne, perceived, nameOf, lookOf, J } = h;
    if (ui && !ui.quick) await g.say(`${fmt.stage2Name || 'ファイナルステージ'}へ進むのは──\n${ids.map(nameOf).join('、')}！`);
    if (ui && ids.includes('player') && !ui.quick) await g.say('もう一本、ネタをする。\n残っているネタで、勝負だ！');
    const order = ids.slice().reverse();
    const totals = {};
    const done = [];
    for (const id of order) {
      const total = await perform(id, 2);
      totals[id] = total;
      if (id !== 'player') await showRival(id, total, 2);
      if (fmt.stage2 === 'score') { const sum = await scoreOne(id, total, 2, done); done.push({ id, sum }); }
    }
    let champ;
    const first = Object.fromEntries((F.stage1 || []).map((x) => [x.id, x.sum]));
    if (fmt.stage2 === 'score') {
      done.sort((a, b) => b.sum - a.sum);
      champ = done[0].id;
      F.stage2 = done.map((x) => ({ id: x.id, v: x.sum }));
      if (ui) {
        await g.say(`${fmt.stage2Name || 'ファイナルステージ'}の結果発表！\n${rules.title}、優勝は……`);
        await drumroll(g, 12);
      }
    } else {
      // vote (1人1票) or 3 points each (R-1 2015–2020)
      const r = rngOf(cfg.id, Y, 'vote');
      const votes = [];
      const pts = Object.fromEntries(ids.map((id) => [id, 0]));
      const voters = J.concat(fmt.audience ? [{ name: '視聴者（dボタン投票）', short: '視聴者', look: LOOKS.fan }] : []);
      for (const j of voters) {
        // the second performance counts most; a strong first one is remembered a little
        const p = ids.map((id, i) => ({ id, i, v: perceived(totals[id], j, id, r) + num(first[id]) * 0.004 })).sort((a, b) => b.v - a.v);
        if (fmt.stage2 === '3pt') { const give = p[0].v - p[1].v > 3 ? [3, 0, 0] : [2, 1, 0]; give.forEach((x, k) => { pts[p[k].id] += x; }); votes.push(p[0].i); }
        else { pts[p[0].id] += 1; votes.push(p[0].i); }
      }
      champ = ids.slice().sort((a, b) => pts[b] - pts[a] || totals[b] - totals[a])[0];
      F.stage2 = ids.map((id) => ({ id, v: pts[id] }));
      if (ui) {
        await g.say(`${rules.title}、最終決戦。\n審査員の${fmt.stage2 === '3pt' ? '得点' : '投票'}で、優勝が決まる……`);
        await drumroll(g, 10);
        await CARDS.voteCard(g, { title: `${fmt.stage2Name || 'ファイナルステージ'}　${fmt.stage2 === '3pt' ? '持ち点3の振り分け' : '決選投票'}`, cands: ids.map((id) => ({ name: nameOf(id), look: lookOf(id), me: id === 'player' })), votes, judges: voters, points: fmt.stage2 === '3pt' ? ids.map((id) => pts[id]) : null, caption: fmt.stage2 === '3pt' ? '顔：その審査員がいちばん高く評価した組　数字：持ち点3の振り分けの合計' : '' }, ui.th);
      }
    }
    return champ;
  };

  // ---------------------------------------------------------------- after the final (優勝発表, 賞金, offers, news, recap)
  C.afterFinal = async (g, S, F) => {
    const Y = S.Y;
    const rules = cfg.rules(Y);
    const th = theme(Y);
    const E = S.entry;
    const s = C.state(g);
    s.seen.final = true;
    const win = F.champ === 'player';
    const place = F.ranking.indexOf('player') + 1;
    E.place = place;
    const st = stage(g, { set: 'studio', theme: th, sign: rules.title, fx: { crowd: true, react: true }, cast: [{ look: g.state.look, x: 288, y: 156, k: 2 }] });
    try {
      if (win) {
        sfx('fanfare');
        await say(g, cfg.mc(Y)[0], `${rules.title}、第${rules.edition}代王者は──\n${E.unitName}！！！`);
        st.fx.confetti = true;
        g.shake(16, 2);
        E.status = 'champion';
        s.me.wins = num(s.me.wins) + 1;
        // the prize belongs to the act: the player receives prize ÷ members (R-1 is always one person)
        const members = C.membersOf(g, E);
        const share = Math.round(num(rules.prize) / members);
        const prizeIn = toInternal(g, share);
        E.prizeShare = share;
        await CARDS.championCard(g, { head: rules.title.includes(`第${rules.edition}回`) ? rules.title : `${rules.title}　第${rules.edition}回`, name: E.unitName, looks: C.myLooks(g, E), prize: rules.prize ? `優勝賞金 ${plainYen(rules.prize)}${members > 1 ? `（ひとり${plainYen(share)}）` : ''}` : rules.prizeText || 'トロフィー', foot: rules.broadcast }, th);
        g.addMoney(prizeIn);
        if (cfg.trophy) g.giveItem(cfg.trophy, 1, true);
        g.addFame(rules.final.champFame ?? 600);
        g.addFans(rules.final.champFans ?? 30000);
        if (cfg.partnerAfter && E.solo) await cfg.partnerAfter(g, C, { S, E, passed: true, champion: true });
        if (cfg.champScene) await cfg.champScene(g, C, { S, E, F, st });
        C.logMe(g, S, '優勝！');
      } else {
        await say(g, cfg.mc(Y)[0], `${rules.title}、優勝は……\n${F.champName}！！`);
        sfx('applause');
        E.status = place === 2 ? 'runnerup' : 'finalist';
        await g.say(place === 2 ? `準優勝……。\n優勝まで、本当にあと少しだった。` : `${place}位。\n決勝の舞台に立てたことは、一生の財産だ。`);
        g.addFame(rules.final.finalistFame2 ?? 120);
        g.addFans(rules.final.finalistFans ?? 5000);
        C.logMe(g, S, `決勝 ${place}位`);
        if (cfg.partnerAfter && E.solo) await cfg.partnerAfter(g, C, { S, E, passed: false, final: true, place });
      }
      // this game's own after-show: the 打ち上げ
      if (cfg.afterParty) await cfg.afterParty(g, C, { S, E, F, st, win });
    } finally { unstage(g, st); }
    if (win && cfg.offers) safe(() => cfg.offers(g, C, { S, E, F }));
    await C.recap(g, Y);
  };

  // ---------------------------------------------------------------- the player's run (one season, or all)
  C.recap = async (g, Y) => {
    const s = C.state(g);
    const th = theme(Y || cdate(g).year);
    const S = Y && s.seasons[Y];
    if (S && S.entry) {
      const E = S.entry;
      const rows = E.results.map((r) => [C.roundName(Y, r.round === 'final2' ? 'final' : r.round) + (r.round === 'final2' ? '（最終決戦）' : ''), r.withdrawn ? '欠場' : `得点の目安 ${num(r.total).toFixed(1)}${r.cut ? `（ライン ${num(r.cut).toFixed(1)}）` : ''}`, r.withdrawn ? '棄権' : r.passed === true ? '通過' : r.passed === false ? '敗退' : '', r.passed === false ? '#ff8a9a' : undefined]);
      await CARDS.recapCard(g, { title: `${cfg.rules(Y).title}　${E.unitName}の挑戦`, rows: [[`エントリー`, `No.${E.no}　${E.solo ? 'ピンで挑戦' : ''}`, ''], ...rows], foot: `結果：${statusText(E.status, cfg.rules(Y), E)}${E.place && E.status !== 'champion' ? `（決勝${E.place}位）` : ''}` }, th);
      return;
    }
    const all = Object.values(s.seasons).filter((x) => x.entry).sort((a, b) => b.Y - a.Y);
    if (!all.length) { await g.say(`${cfg.label}には、まだ出場したことがない。`); return; }
    await CARDS.recapCard(g, { title: `${cfg.label}　わたしの記録`, rows: all.slice(0, 12).map((x) => [cfg.rules(x.Y).title, `No.${x.entry.no}　${x.entry.unitName}`, statusText(x.entry.status, cfg.rules(x.Y), x.entry)]), foot: `出場 ${s.me.entries || all.length}回・決勝 ${s.me.finals || 0}回・優勝 ${s.me.wins || 0}回` }, th);
  };
  const statusText = (st0, rules, E) => ({ entered: 'エントリー済み', passed: '勝ち上がり中', revival: '復活ステージへ', out: E ? `${(rules.rounds.find((r) => r.id === E.round) || {}).name || ''}敗退` : '敗退', withdrawn: '棄権', champion: '優勝！', runnerup: '準優勝', finalist: '決勝進出' }[st0] || st0);

  // ---------------------------------------------------------------- status (notebook, g.r1() / g.abcgp())
  C.status = (g) => {
    const s = C.state(g);
    const n = C.now(g);
    const Y = n.Y;
    const S = Y ? s.seasons[Y] : null;
    return {
      id: cfg.id, now: n, season: Y, title: Y ? cfg.rules(Y).title : cfg.label, edition: Y ? cfg.rules(Y).edition : null,
      entry: S && S.entry ? { no: S.entry.no, status: S.entry.status, round: S.entry.round, unitName: S.entry.unitName, results: S.entry.results.slice() } : null,
      wins: num(s.me.wins), finals: num(s.me.finals), entries: num(s.me.entries), log: s.me.log.slice(0, 10),
      champions: C.history(g).slice(-5),
    };
  };

  // ---------------------------------------------------------------- the phone app (hub fallback; with D1's hub only during a season)
  C.app = async (g, phone) => {
    const { phoneList, phoneInfo, closePhoneThen, phoneOverMapOnly } = phone;
    for (;;) {
      const n = C.now(g);
      const Y = n.Y || cdate(g).year;
      // the name of that time (no later renames on an earlier date)
      const appTitle = typeof cfg.appTitle === 'function' ? cfg.appTitle(Math.min(Y, cdate(g).year + 1)) : cfg.appTitle;
      const rules = C.held(Y) ? cfg.rules(Y) : null;
      const items = [];
      items.push({ label: rules ? rules.title : cfg.label, sub: n.label, key: 'info' });
      if (n.kind === 'entry') items.push({ label: 'エントリーする', sub: `参加費 ${rules.fee ? plainYen(rules.fee) : rules.feeText || 'なし'}`, key: 'entry' });
      if (n.kind === 'round' || n.kind === 'final') items.push({ label: '会場へ向かう', sub: n.label, key: 'go', right: '今日' });
      const od = rules && ['entry', 'waiting', 'round', 'final', 'soon'].includes(n.kind) ? safe(() => C.odds(g, Y), null) : null;
      if (od) items.push({ label: od.text, sub: `得点の目安 ${od.exp}／${od.round}のライン 約${od.cut}`, key: 'odds' });
      const S = rules && n.kind !== 'notyet' ? C.season(g, Y) : null;
      if (S && S.entry && ['entered', 'passed', 'revival'].includes(S.entry.status)) items.push({ label: '準備する', sub: `ネタ合わせ・${cfg.prepSub || '小道具'}（仕上がり ${Math.round(S.entry.prep.practice)}）`, key: 'prep' });
      items.push({ label: '大会の概要', sub: '出場資格・参加費・日程・決勝の方式', key: 'rules' });
      items.push({ label: '注目の出場者', sub: '今年の顔ぶれ', key: 'field' });
      items.push({ label: '歴代王者', sub: '第1回からの優勝者', key: 'hist' });
      items.push({ label: 'わたしの記録', sub: `出場${C.state(g).me.entries || 0}回`, key: 'me' });
      const i = await phoneList(g, { title: appTitle, color: cfg.color, items });
      if (i < 0) return;
      const it = items[i];
      if (it.key === 'odds') {
        const od = C.odds(g, Y);
        await phoneInfo(g, { title: '見込み', color: cfg.color, lines: [od.text, '', `いまの実力で出せる得点の目安：${od.exp}`, `${od.round}の通過ライン（その年の出場者の強さから）：約${od.cut}`, '', '芸の地力（ネタ作り・間・声量…）、ネタ帳のいちばん良いネタ、準備（ネタ合わせ・小道具）で決まる。本番の出来しだいで上下する。'] });
      } else if (it.key === 'info' || it.key === 'rules') {
        await phoneInfo(g, { title: appTitle, color: cfg.color, lines: C.rulesText(g, n.kind === 'notyet' ? null : Y) });
      } else if (it.key === 'field') {
        if (!S) { await phoneInfo(g, { title: '注目の出場者', color: cfg.color, text: n.label }); continue; }
        const rows = C.alive(S, (S.entry && S.entry.round) || cfg.rules(Y).rounds[0].id).slice(0, 24).map((x) => ({ label: x.name, sub: (x.tags || []).join('・') || x.agency || '', look: C.lookOf(x) }));
        await phoneList(g, { title: '注目の出場者', color: cfg.color, items: rows.length ? rows : [{ label: 'まだ発表されていない' }] });
      } else if (it.key === 'hist') {
        const h = C.history(g).slice().reverse();
        await phoneList(g, { title: '歴代王者', color: cfg.color, items: h.length ? h.map((x) => ({ label: x.champion, sub: `${x.year}年 ${x.edition ? '第' + x.edition + '回' : ''}${x.player ? '（あなた！）' : ''}` })) : [{ label: 'まだ大会がない' }] });
      } else if (it.key === 'entry' || it.key === 'go' || it.key === 'prep' || it.key === 'me') {
        if ((it.key === 'go' || it.key === 'entry' || it.key === 'prep') && !phoneOverMapOnly(g)) { await phoneInfo(g, { title: appTitle, color: cfg.color, text: '今はここを離れられない。' }); continue; }
        const fn = it.key === 'entry' ? C.entry : it.key === 'go' ? C.go : it.key === 'prep' ? C.prep : (gg) => C.recap(gg, S && S.entry ? Y : null);
        closePhoneThen(g, async (gg) => { await fn(gg); gg.save && gg.save(true); });
        return;
      }
    }
  };
  // ---------------------------------------------------------------- D1 (def.selfRun): what its 賞レース screen / app show
  // status(g) → { status, statusLabel, label, edition, year, entry: { no, name, status, statusLabel, round, next, results, final }, today }
  C.d1Status = (g) => {
    const n = C.now(g);
    const Y = n.Y;
    const map = { notyet: 'notyet', none: 'hiatus', soon: 'before', entry: 'entry', closed: 'prelim', waiting: 'prelim', round: 'prelim', final: 'finalday', out: 'prelim', done: 'after' };
    let status = map[n.kind] || 'before';
    const S = Y ? C.state(g).seasons[Y] : null;
    if (Y) { const cal = C.cal(g, Y); if (cal.final && g.state.day > cal.final.day) status = 'after'; else if (cal.final && g.state.day === cal.final.day) status = 'finalday'; }
    const E = S && S.entry;
    let entry = null;
    if (E) {
      const rules = cfg.rules(Y);
      const ext = { entered: 'entered', passed: 'passed', revival: 'passed', out: 'out', withdrawn: 'withdrawn', champion: 'champion', runnerup: 'out', finalist: 'out' }[E.status] || 'entered';
      const nx = ['entered', 'passed', 'revival'].includes(E.status) ? C.myDate(g, S) : null;
      entry = {
        no: E.no, name: E.unitName, status: ext, statusLabel: `${statusText(E.status, rules, E)}${E.place && E.status !== 'champion' ? `（決勝${E.place}位）` : ''}`, round: C.roundName(Y, E.round),
        next: nx ? { day: nx.day, city: cfg.venueName(Y, E.round, nx.venue), hall: '' } : null,
        results: E.results.map((r) => ({ round: C.roundName(Y, r.round), name: C.roundName(Y, r.round), passed: r.passed, score: r.total, withdrawn: !!r.withdrawn })),
        final: E.status === 'champion' ? { place: 1 } : E.place ? { place: E.place } : null,
      };
    }
    const due = S ? C.dueRound(g, S) : null;
    const today = due ? [{ id: due.rid, kind: 'round', label: `${C.roundName(Y, due.rid)}（${cfg.venueName(Y, due.rid, due.venue)}）` }] : [];
    return { status, statusLabel: n.label, label: Y ? cfg.rules(Y).title : cfg.label, edition: Y ? cfg.rules(Y).edition : null, year: Y, entry, today };
  };
  // historyList(g) → every year up to the last final played: [{ year, edition, held, champion, runnerUp, finalists, note, player }]
  C.historyList = (g) => C.history(g).map((h) => ({ year: h.year, edition: h.edition, held: h.edition != null, champion: h.edition != null ? h.champion : null, runnerUp: h.runnerUp || null, finalists: (C.state(g).hist[h.year] || {}).finalists || [], note: h.note || '', revival: false, player: h.player ? 1 : null }));
  // rivalsOf(g, round (D1 index or our id), n, year) → this season's named entrants still in at that round, strongest first
  C.rivalsOf = (g, round, n = 10, year) => {
    const Y = year ?? C.seasonY(g);
    if (!Y || !C.held(Y)) return [];
    const S = C.season(g, Y);
    const rid = typeof round === 'number' ? (C.d1Rounds(Y)[round] || {}).id : round;
    const list = (rid ? C.alive(S, rid) : S.notables).slice().sort((a, b) => b.str - a.str).slice(0, n);
    return list.map((x) => ({ id: x.id, name: x.name, unit: x.type, kind: cfg.kindOf ? cfg.kindOf(S) : 'pin', power: Math.round(x.str), tags: x.tags || [], agency: x.agency || '', look: C.lookOf(x), members: [{ name: x.name, look: C.lookOf(x) }] }));
  };
  C.rulesText = (g, Y) => {
    if (!Y || !C.held(Y)) return [`${cfg.label}`, `${cfg.foundedText}`, '', cfg.aboutNotYet ? cfg.aboutNotYet(g) : ''];
    const r = cfg.rules(Y);
    const cal = C.cal(g, Y);
    const lines = [`${r.title}${r.title.includes(`第${r.edition}回`) ? '' : `（第${r.edition}回）`}`, `主催：${r.organizer}`, `放送：${r.broadcast}`, '', `【出場資格】${r.eligText}`, `【参加費】${r.fee ? plainYen(r.fee) : r.feeText || 'なし'}`, `【受付】${cal.entryFrom ? dateTextY(cal.entryFrom.y, cal.entryFrom.m, cal.entryFrom.d) + '〜' + dateText(cal.entryTo.m, cal.entryTo.d) : '—'}`, '', '【日程】'];
    for (const rd of r.rounds) {
      const ds = cal.rounds[rd.id] || [];
      lines.push(`・${rd.name}：${ds.map((d) => `${dateText(d.m, d.d)}${d.venue ? ' ' + cfg.venueName(Y, rd.id, d.venue) : ''}`).join(' / ')}（${fmtLen(rd.length)}）`);
    }
    lines.push('', `【決勝】${r.final.formatText}`, `【賞金】${r.prize ? plainYen(r.prize) : r.prizeText || '—'}`);
    if (r.notes) lines.push('', ...r.notes);
    return lines;
  };
}
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
export const fmtLen = (sec) => (sec % 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec / 60}分`);
// back to the music of the room the player is in
function roomBgm(g) {
  try {
    const m = g.map;
    if (m && m.room && m.room.def) { const r = m.room.def, p = m.place; g.bgm(r.bgm || (p && p.bgm) || (p && p.kind === 'town' ? 'town' : 'office')); }
  } catch (e) { /* no map yet */ }
}

// ================================================================ phone app registration
export function registerContestApp(C, o) {
  registerPhoneApp(o.id, {
    name: o.name,
    color: o.color,
    order: o.order || 58,
    icon(c, x, y) { R(c, x + 3, y + 4, 18, 16, '#ffffff'); T(c, o.glyph, x + 12, y + 7, o.glyph.length > 2 ? 7 : 9, o.color, 'center', 18); },
    badge: (g) => { const n = safe(() => C.now(g), null); return n && (n.kind === 'round' || n.kind === 'final') ? 1 : 0; },
    cond: (g) => {
      const n = safe(() => C.now(g), null);
      if (!n) return false;
      if (!d1Hub()) return true;
      return n.kind !== 'notyet' && n.kind !== 'none';
    },
    open: async (g) => {
      const phone = await import('./phone.js');
      await C.app(g, phone);
    },
  });
}
export { registerItem };
