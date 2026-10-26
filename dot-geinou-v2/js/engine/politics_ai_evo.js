// 政治家AI (R11-P) — EVOLUTION. What changes slowly, over months and years, as a result of what the agents see and do:
//  - the factional map follows its members (positions, mood), a fictional party's platform follows the members' centroid (bounded around where it
//    started; the real parties' platforms are never touched — only the people inside them diverge or converge),
//  - the political "meta": which issues move votes (learned salience), the national median and the polarisation,
//  - the opposition's strategy (cooperate with the government or oppose it) learned from what paid off,
//  - generations: yearly history of party positions, turnover counters, the report for the headless evolution test.
// Installed by politics_ai.js (installEvo(C)).

import { AX, AXN } from './politics_ai_text.js';

export function installEvo(C) {
  const { X, H, S, rr, rg, r1, obj, today, AREAS, IND, mpOf, sigm } = C;
  const { clamp, num, YEAR_DAYS, POLICIES, POLICY_AREAS } = X;
  const pairs = Object.entries;
  const named = (p, pid) => Object.values(p.npcs).filter((n) => obj(n.ai) && C.fix(n.ai) && n.party === pid && mpOf(n));

  // ---------------------------------------------------------------- the meta: which issues move votes, the median, the polarisation
  function metaTick(g, p, day, W) {
    const s = S(p);
    const m = s.meta;
    if (!obj(m.sal)) m.sal = {};
    for (const a of AREAS) {
      const live = num(p.opinion.issues && p.opinion.issues[a]) * 100;
      const cur = m.sal[a] == null ? live : m.sal[a];
      m.sal[a] = r1(clamp(cur + (live - cur) * 0.1, 0, 100));
    }
    // national median: the seat-weighted mean of the party centroids (the unnamed members stand where their party's named ones do)
    const med = AX.map(() => 0);
    let tw = 0;
    const cents = [];
    for (const [pid, c] of pairs(W.cent)) {
      const w = num(W.seatsOf[pid]);
      if (w <= 0) continue;
      for (let i = 0; i < 7; i++) med[i] += c[i] * w;
      tw += w;
      cents.push([c, w]);
    }
    if (tw > 0) {
      const prev = Array.isArray(m.med) && m.med.length === 7 ? m.med : med.map((v) => v / tw);
      m.med = med.map((v, i) => Math.round((prev[i] + (v / tw - prev[i]) * 0.25) * 1000) / 1000); // (-1..1 scale: three decimals, or the slow movement is rounded away)
      // polarisation: how far the parties stand from the median (0..100)
      let sd = 0;
      for (const [c, w] of cents) { let d = 0; for (let i = 0; i < 4; i++) d += (c[i] - m.med[i]) ** 2; sd += Math.sqrt(d / 4) * w; }
      m.pol = r1(clamp((sd / tw) * 160, 0, 100));
    } else if (!Array.isArray(m.med)) m.med = AX.map(() => 0);
  }

  // ---------------------------------------------------------------- factions follow their members; fictional parties' platforms follow their centroid
  function factionTick(g, p, day, W) {
    for (const [pid, pt] of pairs(p.parties)) {
      for (const f of pt.factions || []) {
        const x = p.intra && p.intra.fx && p.intra.fx[f.id];
        if (!x) continue;
        const mem = named(p, pid).filter((n) => n.faction === f.id);
        if (mem.length < 2) continue;
        const mean = AX.map((k, i) => mem.reduce((s, n) => s + n.ai.ax[i], 0) / mem.length / 100);
        if (!obj(x.axes)) x.axes = {};
        AX.forEach((k, i) => { x.axes[k] = Math.round(clamp(num(x.axes[k]) + (mean[i] - num(x.axes[k])) * 0.1, -1, 1) * 100) / 100; });
        // the agents' sentiment feeds the faction's mood (the other direction is in the agents' own feelings)
        const pf = mem.reduce((s, n) => s + n.ai.pf, 0) / mem.length;
        x.mood = clamp(num(x.mood) + clamp((pf - num(x.mood)) * 0.04, -1.5, 1.5), -100, 100);
      }
    }
  }
  function platformTick(g, p, day, W) {
    const s = S(p);
    for (const [pid, pt] of pairs(p.parties)) {
      if (pt.real || (X.PARTY_DEFS[pid] && X.PARTY_DEFS[pid].real) || pt.isPlayers || pt.leader === 'player') continue;
      const c = W.cent[pid];
      if (!c || (W.n[pid] || 0) < 3) continue;
      const I0 = s.base0[pid] || (s.base0[pid] = { econ: num(pt.ideology.econ), social: num(pt.ideology.social), security: num(pt.ideology.security) });
      const tgt = { econ: c[0] * 2, social: c[2] * 2, security: c[3] * 2.6 };
      for (const k of ['econ', 'social', 'security']) {
        const v = num(pt.ideology[k]) + (tgt[k] - num(pt.ideology[k])) * 0.05;
        pt.ideology[k] = Math.round(clamp(v, I0[k] - 0.7, I0[k] + 0.7) * 100) / 100;
        pt.ideology[k] = clamp(pt.ideology[k], -2, 2);
      }
    }
  }
  // once a year a fictional party swaps one platform item for the policy its members like most (and the reverse for the one they like least)
  function platformSwap(g, p, day) {
    const fy = X.fyNow(g);
    for (const [pid, pt] of pairs(p.parties)) {
      if (pt.real || (X.PARTY_DEFS[pid] && X.PARTY_DEFS[pid].real) || pt.isPlayers || pt.leader === 'player') continue;
      const mem = named(p, pid);
      if (mem.length < 4 || !Array.isArray(pt.platform)) continue;
      const score = (id) => mem.reduce((s, n) => s + C.policyStance(null, p, n, n.ai, id), 0) / mem.length;
      const plat = pt.platform.filter((id) => POLICIES[id]);
      if (!plat.length) continue;
      const worst = plat.map((id) => [id, score(id)]).sort((a, b) => a[1] - b[1])[0];
      let best = null;
      for (const id of Object.keys(POLICIES)) {
        if (plat.includes(id)) continue;
        if (!X.policyOk(g, p, id)) continue;
        const sc = score(id) + rr(p, 'plat', pid, id, Math.floor(fy)) * 0.15;
        if (!best || sc > best[1]) best = [id, sc];
      }
      if (!best || best[1] - worst[1] < 0.55) continue;
      const i = pt.platform.indexOf(worst[0]);
      if (i < 0) continue;
      pt.platform[i] = best[0];
      S(p).log.unshift([day, null, 'meta', `${pt.short}が公約を見直し、「${POLICIES[worst[0]].name}」に代えて「${POLICIES[best[0]].name}」を掲げた`, pt.short, pid]);
      if (S(p).log.length > 70) S(p).log.length = 70;
      C.newsAI(g, p, `${pt.short}が公約を見直し、「${POLICIES[best[0]].name}」を新たに掲げた`, `plat:${pid}`);
    }
  }

  // ---------------------------------------------------------------- the opposition's strategy: cooperate or confront, learned from the support it gained
  function stratTick(g, p, day, W) {
    const s = S(p);
    for (const [pid, pt] of pairs(p.parties)) {
      if (W.ruling.has(pid) || pt.isPlayers || pt.leader === 'player') { delete s.strat[pid]; continue; }
      const st = s.strat[pid] || (s.strat[pid] = { coop: 50, rc: 0, rh: 0, sup: r1(W.sup[pid] || 0), moved: 0 });
      const d = (W.sup[pid] || 0) - num(st.sup, W.sup[pid]);
      st.sup = r1(W.sup[pid] || 0);
      const wc = st.coop / 100, wh = 1 - wc;
      // what the party can win by: a party close to the government's line gains by cooperating, a distant one by opposing; and the government's standing
      let near = 0.5;
      const gov = [...W.ruling].filter((id) => W.cent[id])[0];
      if (gov && W.cent[pid]) near = C.fitV(W.cent[pid].map((v) => v * 100), W.cent[gov]);
      // relative to the other opposition parties: the closest to the government gains most by cooperating
      const nears = Object.keys(p.parties).filter((id) => !W.ruling.has(id) && W.cent[id] && gov).map((id) => C.fitV(W.cent[id].map((v) => v * 100), W.cent[gov]));
      const nearMean = nears.length ? nears.reduce((a, b) => a + b, 0) / nears.length : near;
      const ctx = (W.appr - 42) * 0.05 + (near - nearMean) * 5;
      // credit: the month's gain, read against how the government stands — attacking a popular government rarely pays, helping an unpopular one rarely does either
      st.rc = Math.round((st.rc + wc * 0.3 * ((d + ctx) - st.rc)) * 100) / 100;
      st.rh = Math.round((st.rh + wh * 0.3 * ((d - ctx) - st.rh)) * 100) / 100;
      const target = clamp(50 + 8 * (st.rc - st.rh), 22, 78);
      const next = clamp(st.coop + clamp(target - st.coop, -2, 2), 20, 80);
      if (Math.abs(next - st.coop) >= 1 && Math.floor(next / 10) !== Math.floor(st.coop / 10) && day - num(st.moved, -99) > 60) {
        st.moved = day;
        S(p).log.unshift([day, null, 'strat', `${pt.short}は${next > st.coop ? '政府との協調路線に傾いた' : '政府との対決姿勢を強めた'}（${next > st.coop ? '対決で伸びなかったため' : '協調では支持が伸びなかったため'}）`, pt.short, pid]);
        if (S(p).log.length > 70) S(p).log.length = 70;
      }
      st.coop = Math.round(next * 10) / 10;
    }
  }

  // ---------------------------------------------------------------- the monthly pass over the agents: a falling party makes its members moderate, a rising one makes the edge safe
  function agentsMonthly(g, p, day, W) {
    const med = (S(p).meta.med || AX.map(() => 0));
    for (const n of Object.values(p.npcs)) {
      const a = n.ai;
      if (!a || !mpOf(n) || !n.party) continue;
      const trend = W.trend[n.party] || 0;
      const LR = a.lr / 100;
      for (let i = 0; i < 7; i++) {
        if (trend <= -2.5) a.tg[i] = r1(clamp(a.tg[i] + LR * 0.12 * (med[i] * 100 - a.tg[i]), -95, 95));
        else if (trend >= 2.5 && a.bw >= 70) a.tg[i] = r1(clamp(a.tg[i] + LR * 0.03 * clamp(a.ax[i] - med[i] * 100, -40, 40), -95, 95));
      }
    }
  }

  // ---------------------------------------------------------------- the yearly record of party positions (for the history charts and the tests)
  function history(g, p, day, W) {
    const s = S(p);
    if (num(s.histDay) === 0) s.histDay = day;
    if (day - s.histDay < YEAR_DAYS) return;
    s.histDay += YEAR_DAYS;
    const row = {};
    for (const [pid, c] of pairs(W.cent)) row[pid] = [Math.round(c[0] * 100), Math.round(c[2] * 100), Math.round(c[3] * 100)];
    s.hist.push([X.polDate(g).year, row, r1(num(s.meta.pol)), s.stats.retired + s.stats.died]);
    if (s.hist.length > 10) s.hist.shift();
    try { platformSwap(g, p, day); } catch (e) { console.error(e); }
  }

  // the monthly jobs are spread over the days of the month (one job a day), so no morning carries them all
  function tick(g, p, day, abs, W) {
    const s = S(p);
    if (!s.cab || !obj(s.cab)) s.cab = {};
    const mo = Math.floor(day / 10), ph = day % 10;
    if (!Array.isArray(s.jd)) s.jd = [];
    if (ph > 6 || s.jd[ph] === mo) return;
    s.jd[ph] = mo;
    s.mo = mo;
    if (ph === 0) {
      for (const [pid, v] of pairs(W.sup)) s.sup[pid] = r1(s.sup[pid] == null ? v : s.sup[pid] + (v - s.sup[pid]) * 0.15);
      for (const k of Object.keys(s.sup)) if (!p.parties[k]) delete s.sup[k];
      for (const k of Object.keys(s.strat)) if (!p.parties[k]) delete s.strat[k]; // a party that has gone (a merger, a dissolved splinter)
      for (const k of Object.keys(s.cool)) if (day - num(s.cool[k], -999) > 100) delete s.cool[k]; // news / event cooldowns older than their longest gap are forgotten
      for (const k of Object.keys(s.base0)) if (!p.parties[k]) delete s.base0[k];
      metaTick(g, p, day, W);
    } else if (ph === 1) factionTick(g, p, day, W);
    else if (ph === 2) platformTick(g, p, day, W);
    else if (ph === 3) stratTick(g, p, day, W);
    else if (ph === 4) agentsMonthly(g, p, day, W);
    else if (ph === 5) history(g, p, day, W);
    else if (ph === 6) {
      // the seat snapshot the election learning compares with (taken away from an election)
      if (!p.elections.upcoming.some((e) => (e.kind === 'shugi' || e.kind === 'sangi') && e.status !== 'done' && Math.abs(e.day - day) <= 12)) C.snapshotSeats && C.snapshotSeats(p);
    }
  }

  // ---------------------------------------------------------------- hooks (events the agents react to)
  const hooks = {};
  // the player forms or reshuffles a cabinet: those named remember; those dropped remember too
  hooks.onCabinet = (g, p, data) => {
    const s = S(p);
    const day = today(g);
    const now = {};
    for (const [post, id] of pairs(p.cabinet.ministers || {})) if (id && id !== 'player') now[post] = id;
    const playerPM = p.cabinet.pm === 'player';
    if (playerPM && obj(s.cab) && Object.keys(s.cab).length) {
      const newIds = new Set(Object.values(now));
      const oldIds = new Set(Object.values(s.cab));
      for (const id of newIds) if (!oldIds.has(id) && p.npcs[id] && p.npcs[id].ai) C.remember(g, p, p.npcs[id], 'post', 16, day);
      for (const id of oldIds) if (!newIds.has(id) && p.npcs[id] && p.npcs[id].ai) C.remember(g, p, p.npcs[id], 'fired', -20, day);
    }
    s.cab = now;
    for (const id of Object.values(now)) { const n = p.npcs[id]; if (n && n.ai) { n.ai.pf = clamp(n.ai.pf + 6, -100, 100); } }
  };
  // the player's own scandal: the party's members remember who cost them votes
  hooks.onScandal = (g, p, rec) => {
    if (!rec || rec.who !== 'player' || !p.me.party) return;
    const day = today(g);
    for (const n of named(p, p.me.party)) if (rr(p, 'sc', n.id, day) < 0.5) C.remember(g, p, n, 'scandal', -5 - num(rec.severity), day);
  };
  // a bill of an agent's own: the player's vote is remembered
  hooks.onBill = (g, p, d) => {
    const b = d && d.bill;
    if (!b || !b.by || b.by === 'player' || !p.npcs[b.by] || !p.npcs[b.by].ai) return;
    if (d.step !== 'enacted' && d.step !== 'rejected' && b.stage !== 'enacted' && b.stage !== 'rejected') return;
    const v = p.me.votes && p.me.votes[b.id];
    if (v === 'yes') C.remember(g, p, p.npcs[b.by], 'yes', 6, today(g));
    else if (v === 'no') C.remember(g, p, p.npcs[b.by], 'no', -7, today(g));
  };

  // ---------------------------------------------------------------- report (headless evolution test, UI summaries)
  function report(g, p) {
    const W = C.world(g, p, today(g));
    const s = S(p);
    const per = {};
    for (const [pid] of pairs(p.parties)) {
      const mem = named(p, pid);
      if (!mem.length) continue;
      const mean = AX.map((k, i) => mem.reduce((t, n) => t + n.ai.ax[i], 0) / mem.length / 100);
      const sd = AX.map((k, i) => Math.sqrt(mem.reduce((t, n) => t + (n.ai.ax[i] / 100 - mean[i]) ** 2, 0) / mem.length));
      per[pid] = { n: mem.length, mean: mean.map((v) => Math.round(v * 1000) / 1000), sd: sd.map((v) => Math.round(v * 1000) / 1000), age: Math.round(mem.reduce((t, n) => t + num(n.age), 0) / mem.length), gen: Math.round(mem.reduce((t, n) => t + num(n.ai.gen), 0) / mem.length * 100) / 100, seats: W.seatsOf[pid] };
    }
    return { day: today(g), year: X.polDate(g).year, parties: per, meta: { med: s.meta.med, pol: s.meta.pol, sal: s.meta.sal }, strat: s.strat, stats: { ...s.stats }, agents: Object.values(p.npcs).filter((n) => n.ai).length };
  }

  return { tick, hooks, report, metaTick, factionTick, platformTick, stratTick };
}
