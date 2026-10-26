// 政治家AI (R11-P) — what the agents DO. Every decision is a utility over the agent's options (explicit terms, a reason text for the strongest
// one, a cooldown, a seeded gate), and every act goes through the existing politics APIs (seat moves, faction records, party posts, scandals,
// by-elections, leader races, the Diet vote). Installed by politics_ai.js (installActs(C)); returns the acts, the hooks politics.js calls
// and the interview (local template).

import { WHY, RUNG, MEM, attWord, seededName, seededLook } from './politics_ai_text.js';

export function installActs(C) {
  const { X, H, S, rr, rg, sigm, r1, obj, today, AREAS, IND, AX, mpOf, ag, fix, fitV, partyVec, world, posKind, rungOf, goalOf, readiness, remember, attitude, logAct, newsAI, phoneAI, spendPhone, h32 } = C;
  const { clamp, num, YEAR_DAYS, POSTS, POLICIES, POLICY_AREAS } = X;
  const pairs = Object.entries;

  // ---------------------------------------------------------------- small helpers
  // a stand-in game for the places that have no g (the Diet vote): only the day is read
  const fakeG = (p) => ({ state: { day: S(p).day || 1, profile: null }, ideologyOf: null, ideology: null });
  const named = (p, pid, house = null) => Object.values(p.npcs).filter((n) => obj(n.ai) && fix(n.ai) && n.party === pid && mpOf(n) && (!house || n.office === house));
  const cool = (a, kind, gap, day) => day - num(a.cool[kind], -9999) < gap;
  function wpick(p, key, items, wf) {
    let tot = 0;
    const ws = items.map((it) => { const w = Math.max(0, wf(it)); tot += w; return w; });
    if (tot <= 0) return null;
    let x = rr(p, key) * tot;
    for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; }
    return items[items.length - 1];
  }
  const surname = (n) => String(n.name || '').split(' ')[0];
  const isReal = (p, pid) => !!(p.parties[pid] && (p.parties[pid].real || (PARTY_DEFS_REAL(pid))));
  const PARTY_DEFS_REAL = (pid) => !!(X.PARTY_DEFS[pid] && X.PARTY_DEFS[pid].real);
  const factionVec = (p, f) => { const x = p.intra && p.intra.fx && p.intra.fx[f.id]; return x && x.axes ? AX.map((k) => num(x.axes[k])) : null; };
  const takenNames = (p) => new Set(Object.values(p.npcs).map((n) => n.name));
  // the strongest positive term → its reason clause
  function topReason(terms) {
    let best = null;
    for (const t of terms) if (t.v > 0 && (!best || t.v > best.v)) best = t;
    return best ? best.t : '';
  }
  function leaderOf(p, pid) { const pt = p.parties[pid]; return pt && pt.leader && pt.leader !== 'player' ? p.npcs[pt.leader] || null : null; }

  // ---------------------------------------------------------------- seat bookkeeping (totals and the 参院 classes stay consistent)
  function moveSeat(p, house, from, to) {
    const Hs = p.diet[house];
    if (!Hs) return false;
    from = from || IND; to = to || IND;
    if (from === to || num(Hs.seats[from]) <= 0) return false;
    Hs.seats[from]--;
    Hs.seats[to] = num(Hs.seats[to]) + 1;
    Hs.total = Object.values(Hs.seats).reduce((a, b) => a + num(b), 0);
    if (house === 'sangi') {
      const c = p.diet.sangi.classes.find((x) => num(x.seats[from]) > 0);
      if (c) { c.seats[from]--; c.seats[to] = num(c.seats[to]) + 1; }
    }
    return true;
  }
  function afterMove(g, p, from) {
    // a ruling party that loses its majority to defections faces the same consequences as after a split (politics_conflict.js)
    try { if (X.afterSeatLoss && p.parties[from]) X.afterSeatLoss(g, p, p.parties[from]); } catch (e) { console.error(e); }
  }

  // ---------------------------------------------------------------- roles: take an agent out of every post (cabinet, party, faction, leader)
  function vacate(g, p, n, why) {
    const pt = p.parties[n.party];
    const day = today(g);
    for (const [post, who] of pairs(p.cabinet.ministers || {})) {
      if (who !== n.id) continue;
      const party = (p.cabinet.partyIds || []).includes(n.party) ? n.party : (X.cabinetPartyOfPM(p) || (p.cabinet.partyIds || [])[0]);
      const m = X.pickMinister(p, party, p.cabinet.ministers);
      n.posts = (n.posts || []).filter((q) => q !== post);
      m.posts.push(post);
      p.cabinet.ministers[post] = m.id;
      newsAI(g, p, `${n.name}${X.postName(post, X.fyNow(g))}が${why}で退任。後任に${m.name}氏`, `vac:${n.id}`);
    }
    n.posts = (n.posts || []).filter((q) => !(POSTS[q] && POSTS[q].kind === 'cabinet'));
    if (pt) {
      for (const [post, who] of pairs(pt.posts || {})) {
        if (who !== n.id) continue;
        const f = (pt.factions || []).find((x) => x.id === n.faction);
        let m = null;
        try { m = H.memberOf(g, p, pt, f || (pt.factions || [])[0] || { id: '' }, [n.id]); } catch (e) { m = null; }
        if (m) H.giveParty(g, p, pt, post, m.id); else { delete pt.posts[post]; }
      }
      if (pt.leader === n.id && p.cabinet.pm !== n.id && !pt.isPlayers) {
        p.flags.outgoingLeader = n.id;
        // someone acts as leader until the race (the 幹事長 first, else the most senior member): a leader's seat is never left to a person who is gone
        const acting = named(p, pt.id).filter((m) => m.id !== n.id && !m.dead).sort((x, y) => (pt.posts && pt.posts.kanjicho === y.id ? 1 : 0) - (pt.posts && pt.posts.kanjicho === x.id ? 1 : 0) || num(y.wins) - num(x.wins))[0];
        if (acting) pt.leader = acting.id;
        const e = X.leaderRaceSoon(g, p, pt.id, day + 8, why);
        newsAI(g, p, `${pt.short}の${n.name}${pt.leaderTitle || '党首'}が${why}で退任へ。党首選へ`, `lead:${pt.id}`);
        void e;
      }
      for (const f of pt.factions || []) {
        let x = p.intra && p.intra.fx && p.intra.fx[f.id];
        if (f.leader === n.id) {
          try { if (!x) x = H.fxOf(g, p, pt, f); if (x) H.beginSuccession(g, p, pt, f, x, n); } catch (e) { console.error(e); }
          if (f.leader === n.id) { const mem = named(p, pt.id).filter((q) => q.id !== n.id && q.faction === f.id).sort((a, b) => num(b.wins) - num(a.wins))[0]; if (mem) f.leader = mem.id; }
          if (f.leader === n.id) { try { const nb = H.makeNpcFor(p, pt, f, { wins: 6, age: 56 }); f.leader = nb.id; nb.faction = f.id; } catch (e) { console.error(e); } } // a faction is never left to someone who is gone
        }
        if (x && x.bantou === n.id) x.bantou = null;
        if (x && x.heir === n.id) x.heir = null;
      }
      const f = (pt.factions || []).find((x) => x.id === n.faction);
      if (f) f.size = Math.max(2, num(f.size) - 1);
    }
    n.posts = [];
    n.faction = null;
  }

  // ---------------------------------------------------------------- successors (children / 秘書 inherit part of the 地盤 and the traits)
  function makeHeir(g, p, n, why) {
    const a = fix(ag(g, p, n));
    const day = today(g);
    const rand = (() => { let c = 0; return () => rr(p, 'heir', n.id, day, c++); })();
    const kin = rr(p, 'kin', n.id, day) < 0.62; // 子 (same surname) or 秘書
    const female = rand() < 0.28;
    const name = seededName(rand, takenNames(p), kin ? surname(n) : null, female);
    const t = n.traits || {};
    const mut = (v, sd) => Math.round(clamp(num(v, 50) * 0.7 + 50 * 0.3 + rg(p, 'ht', n.id, day, sd) * 10, 12, 96));
    const age = Math.round(clamp(num(n.age, 62) - 24 + rg(p, 'hage', n.id) * 4, 32, 56));
    const h = X.newNpc(p, { name, gender: female ? 'f' : 'm', party: n.party, house: n.house || n.office, office: null, wins: 0, age, district: n.district || null, charisma: mut(t.charisma, 1), integrity: mut(t.integrity, 2), ambition: mut(t.ambition, 3) });
    h.look = seededLook(rand, female, age);
    h.office = null;
    h.faction = n.faction || null;
    h.heirOf = n.id;
    h.keepAI = false;
    C.mk(g, p, h, { parent: n, gen: num(a.gen) + 1 });
    h.ai.heirOf = n.id;
    a.heir = h.id;
    a.rel[h.id] = 38;
    C.S(p).stats.heirs++;
    return h;
  }

  // ---------------------------------------------------------------- retiring, dying, being replaced
  function announceRetire(g, p, n, a, why, day) {
    a.ret = { day, why };
    const h = makeHeir(g, p, n, why);
    const kin = surname(h) === surname(n);
    logAct(g, p, n, 'retire', `${why}${why.endsWith('、') ? '' : '、'}次の選挙には出ず引退する意向を示した（後継は${kin ? '縁者の' : '秘書出身の'}${h.name}氏）`, { news: num(n.wins) >= 6 || C.rungOf(p, n) >= 2 ? `ret:${n.id}` : false });
  }
  function exitSeat(g, p, n, a, kind, reason, day) {
    const s = S(p);
    const house = n.office;
    // the heir stands in the seat at the next election; the roles pass on
    vacate(g, p, n, reason);
    if (p.flags.smdHolders) for (const h of Object.values(p.flags.smdHolders)) if (h && h.npc === n.id) { h.npc = a.heir && p.npcs[a.heir] ? a.heir : h.npc; if (!(a.heir && p.npcs[a.heir])) h.open = true; }
    n.office = null;
    n.exMp = true;
    n.ai.exDay = day; n.ai.exKind = kind;
    s.gone.unshift([day, n.name, n.party || IND, kind, reason, num(n.age), num(n.wins)]);
    if (s.gone.length > 24) s.gone.length = 24;
    s.stats[kind === 'die' ? 'died' : 'retired']++;
    return house;
  }
  function stepIn(g, p, h, house, day) {
    h.office = house; h.house = house; h.wins = Math.max(1, num(h.wins) + 1); h.exMp = false;
    const pf = p.parties[h.party] && (p.parties[h.party].factions || []).find((x) => x.id === h.faction);
    if (pf) pf.size = num(pf.size) + 1; else h.faction = null;
    if (h.ai) { h.ai.since = day; h.ai.bw = 62; }
    if (p.flags.smdHolders) for (const x of Object.values(p.flags.smdHolders)) if (x && x.open && x.party === h.party) { x.npc = h.id; x.open = false; break; }
  }

  // ---------------------------------------------------------------- the decisions (utility over options)
  // 1. faction: move to the group that fits better
  function evalFaction(g, p, n, a, W, day) {
    const pt = p.parties[n.party];
    if (!pt || !n.faction || (pt.factions || []).length < 2 || cool(a, 'faction', 70, day)) return null;
    const k = posKind(p, n);
    if (k.fleader || k.bantou || k.pm || k.leader) return null;
    const cur = (pt.factions || []).find((f) => f.id === n.faction);
    if (!cur) return null;
    const cv = factionVec(p, cur);
    const curFit = cv ? fitV(a.ax, cv) : 0.6;
    const curX = p.intra.fx[cur.id] || {};
    let best = null;
    const pow = W.pow || (W.pow = {});
    const powOf = (f) => (pow[f.id] != null ? pow[f.id] : (pow[f.id] = H.powerOf(g, p, pt, f))); // the faction's power, once a day
    const maxPow = Math.max(1, ...pt.factions.map(powOf));
    const curPow = powOf(cur) / maxPow;
    for (const f of pt.factions) {
      if (f.id === cur.id) continue;
      const fv = factionVec(p, f);
      if (!fv) continue;
      const tFit = (fitV(a.ax, fv) - curFit) * 3.0;
      const tPow = (powOf(f) / maxPow - curPow) * 0.7;
      const tLoyal = (num(curX.mood) < -20 ? 0.35 : 0) + (a.pf < -15 ? 0.3 : 0);
      const tLead = W.leadFac[pt.id] === f.id && num(n.traits.ambition) > 55 ? 0.15 : 0;
      const u = tFit + tPow + tLoyal + tLead - 0.62 - (W.leadFac[pt.id] === cur.id ? 0.3 : 0);
      if (!best || u > best.u) best = { u, f, why: topReason([{ v: tFit, t: WHY.faction.fit }, { v: tPow, t: WHY.faction.power }, { v: tLoyal, t: WHY.faction.loyal }, { v: tLead, t: WHY.faction.post }]) };
    }
    if (!best) return null;
    return {
      kind: 'faction', u: best.u,
      run() {
        const f = best.f;
        const x = p.intra.fx[f.id] || {};
        cur.size = Math.max(2, num(cur.size) - 1);
        f.size = num(f.size) + 1;
        n.faction = f.id;
        if (curX) curX.mood = clamp(num(curX.mood) - 0.8, -100, 100);
        if (x) x.mood = clamp(num(x.mood) + 0.8, -100, 100);
        a.cool.faction = day;
        logAct(g, p, n, 'faction', `${best.why || ''}${f.name}に移った`, {});
        S(p).stats.moved++;
      },
    };
  }

  // 2. leave the party (and 3. join one)
  function bestDestination(g, p, n, a, W) {
    let best = null;
    for (const [pid, pt] of pairs(p.parties)) {
      if (pid === n.party || pt.isPlayers || /^my\d/.test(pid) || !W.seatsOf[pid] && !pt.leader) continue;
      const f = fitV(a.ax, partyVec(g, p, pid));
      const u = f + (W.trend[pid] || 0) * 0.015 + (W.ruling.has(pid) ? 0.03 : 0);
      if (!best || u > best.u) best = { pid, pt, fit: f, u };
    }
    return best;
  }
  function evalLeave(g, p, n, a, W, day) {
    const pt = p.parties[n.party];
    if (!pt || !mpOf(n) || cool(a, 'leave', 150, day) || day - num(a.since) < 60) return null;
    const k = posKind(p, n);
    if (k.pm || k.leader || k.cab || k.party || k.fleader || k.bantou) return null;
    const pv = partyVec(g, p, n.party);
    const fit = fitV(a.ax, pv);
    const near = W.elecIn < 220;
    const trend = W.trend[n.party] || 0;
    const tFit = (0.7 - fit) * 3.8;
    const tLoyal = (-a.pf - 8) / 50;
    const tPoll = clamp((52 - a.bw) / 38, 0, 1.2) * (near ? 1 : 0.35) + clamp(-trend / 9, 0, 0.5);
    const tPost = num(n.wins) >= 5 ? 0.18 : 0;
    const alt = bestDestination(g, p, n, a, W);
    const tAlt = alt ? (alt.fit - fit) * 2.2 : 0;
    const u = tFit + tLoyal + tPoll + tPost + tAlt - 1.0 - (a.ret ? 3 : 0);
    if (C.AIH.dbg && u > 0) C.AIH.dbg.push({ kind: 'leave', id: n.id, party: n.party, day, u: r1(u), tFit: r1(tFit), tLoyal: r1(tLoyal), tPoll: r1(tPoll), tAlt: r1(tAlt), pf: a.pf, bw: a.bw, fit: r1(fit), trend: r1(trend), elecIn: W.elecIn });
    if (u <= 0) return null;
    const why = topReason([{ v: tFit, t: WHY.leave.fit }, { v: tLoyal, t: WHY.leave.loyal }, { v: tPoll, t: WHY.leave.poll }, { v: tPost, t: WHY.leave.post }, { v: tAlt, t: WHY.leave.alt }]);
    return {
      kind: 'leave', u,
      run() {
        const house = n.office;
        // to a closer party when there is one clearly closer, else 無所属
        const dest = alt && alt.fit - fit > 0.12 && (W.sup[alt.pid] || 0) > 3 ? alt.pid : IND;
        const from = n.party;
        if (!moveSeat(p, house, from, dest)) return;
        const f = (p.parties[from].factions || []).find((x) => x.id === n.faction);
        if (f) f.size = Math.max(2, num(f.size) - 1);
        n.party = dest; n.faction = null; n.posts = (n.posts || []).filter((q) => !(POSTS[q] && POSTS[q].kind === 'party'));
        a.cool.leave = day; a.cool.join = day;
        a.pf = 0;
        const dn = dest === IND ? '無所属になった' : `${p.parties[dest].short}に移った`;
        logAct(g, p, n, 'leave', `${why}${dest === IND ? '離党し、' : '離党し、'}${dn}`, { news: `lv:${n.id}` });
        X.addSupportAll && X.addSupportAll(p, from, -0.0012);
        if (dest !== IND) X.addSupportAll && X.addSupportAll(p, dest, 0.0008);
        afterMove(g, p, from);
        S(p).stats.moved++;
        try { X.emit(g, 'party', { kind: 'member', party: from, npc: n.id, to: dest }); } catch (e) { /* ignore */ }
      },
    };
  }
  function evalJoin(g, p, n, a, W, day) {
    if (!mpOf(n) || (n.party && n.party !== IND) || cool(a, 'join', 50, day)) return null;
    const alt = bestDestination(g, p, n, a, W);
    if (!alt) return null;
    const tFit = (alt.fit - 0.6) * 3.2;
    const tChance = clamp(((W.sup[alt.pid] || 0) - 8) / 30, -0.2, 0.5);
    const u = tFit + tChance - 0.5;
    if (u <= 0) return null;
    const why = tFit >= tChance ? WHY.join.fit : WHY.join.chance;
    return {
      kind: 'join', u,
      run() {
        if (!moveSeat(p, n.office, IND, alt.pid)) { a.cool.join = day; return; }
        n.party = alt.pid;
        const pt = alt.pt;
        const fs = pt.factions || [];
        if (fs.length) {
          let bf = fs[0], bv = -1;
          for (const f of fs) { const fv = factionVec(p, f); const v = fv ? fitV(a.ax, fv) : 0.5; if (v > bv) { bv = v; bf = f; } }
          n.faction = bf.id; bf.size = num(bf.size) + 1;
        }
        a.cool.join = day; a.cool.leave = day; a.pf = 18;
        logAct(g, p, n, 'join', `${why}${pt.short}に入党した`, { news: `jn:${n.id}` });
        afterMove(g, p, alt.pid);
        S(p).stats.moved++;
      },
    };
  }

  // 4. press for a post (the faction asks, the agent lobbies the PM)
  function evalAsk(g, p, n, a, W, day) {
    const pt = p.parties[n.party];
    const k = posKind(p, n);
    if (!pt || !mpOf(n) || cool(a, 'ask', 100, day) || k.pm || k.leader) return null;
    // the lobbying season: before the autumn reshuffle (doy ~50-95), or while a leader race is near
    const doy = X.polDate(g).doy;
    const racing = p.elections.upcoming.some((e) => e.kind === 'sosaisen' && e.party === pt.id && e.status !== 'done' && e.day - day < 40);
    if (!((doy >= 50 && doy <= 95) || racing)) return null;
    const gl = goalOf(p, n);
    if (gl.goal <= gl.rung || gl.goal > 3) return null;
    const rdy = readiness(p, n, a);
    const amb = num(n.traits.ambition) / 100;
    const u = (rdy / 100) * 1.15 + amb * 0.6 - 1.0 - (a.str > 70 ? 0.2 : 0);
    if (u <= 0.1) return null;
    return {
      kind: 'ask', u,
      run() {
        a.cool.ask = day;
        const f = (pt.factions || []).find((x) => x.id === n.faction);
        const x = f ? p.intra.fx[f.id] : null;
        if (gl.goal === 3) {
          a.con = clamp(a.con + 2, 0, 99);
          logAct(g, p, n, 'ask', `${WHY.ask.default}総理周辺に入閣を働きかけた`, {});
        } else if (x && !x.demand && day - num(x.lastDemand, -99) >= 18) {
          const posts = H.postsAvailable(pt).filter((q) => !Object.prototype.hasOwnProperty.call(pt.posts || {}, q) || pt.posts[q] !== n.id);
          const want = posts[Math.floor(rr(p, 'wantpost', n.id, day) * Math.min(3, posts.length))] || posts[0];
          if (want) {
            x.demand = { post: want, since: day, until: day + 24 };
            x.lastDemand = day;
            logAct(g, p, n, 'ask', `${f.name}を代表して「${X.postName(want, X.fyNow(g), pt.id)}」を求めて動いた`, {});
          } else logAct(g, p, n, 'ask', `党の要職を求めて、領袖に働きかけた`, {});
        } else logAct(g, p, n, 'ask', `党の要職を求めて、領袖に働きかけた`, {});
      },
    };
  }

  // 5. found a faction of one's own (旗揚げ): an ambitious senior member at odds with the line takes like-minded colleagues with them
  function evalFound(g, p, n, a, W, day) {
    const pt = p.parties[n.party];
    if (!pt || !mpOf(n) || cool(a, 'found', 360, day) || (pt.factions || []).length >= 6 || (pt.factions || []).length < 1) return null;
    const k = posKind(p, n);
    if (k.fleader || k.pm || k.leader || k.cab || k.bantou || num(n.wins) < 4 || num(n.age) > 68) return null;
    const amb = num(n.traits.ambition) / 100;
    const rdy = readiness(p, n, a);
    const u = amb * 0.9 + (rdy / 100) * 0.7 + clamp(-a.pf, 0, 60) / 100 * 0.6 - 1.3 - (k.party ? 0.3 : 0);
    if (u <= 0) return null;
    const mates = named(p, pt.id).filter((m) => m.id !== n.id && m.faction && !posKind(p, m).fleader && !posKind(p, m).leader && fitV(m.ai.ax, n.ai.ax.map((v) => v / 100)) >= 0.78 && m.ai.pf < 40).sort((x, y) => fitV(y.ai.ax, n.ai.ax.map((v) => v / 100)) - fitV(x.ai.ax, n.ai.ax.map((v) => v / 100))).slice(0, 3);
    if (mates.length < 1) return null;
    return {
      kind: 'found', u: u - 0.1,
      run() {
        const word = (pt.factions[0] && pt.factions[0].kind === 'faction') ? '派' : 'グループ';
        const nid = (pt.factions.reduce((m, y) => Math.max(m, num(String(y.id).split('_f')[1])), 0) || 0) + 1;
        const f = { id: `${pt.id}_f${nid}`, name: `${surname(n)}${word}`, leader: n.id, size: 2, funds: 0, kind: (pt.factions[0] && pt.factions[0].kind) || 'group' };
        const own = (pt.factions || []).find((x) => x.id === n.faction);
        if (own) own.size = Math.max(2, num(own.size) - 1);
        pt.factions.push(f);
        n.faction = f.id;
        for (const m of mates) {
          const old = (pt.factions || []).find((x) => x.id === m.faction);
          if (old) old.size = Math.max(2, num(old.size) - 2);
          m.faction = f.id; f.size += 2;
          remember(g, p, m, 'favor', 6, day);
        }
        f.size += 1;
        const x = H.fxOf(g, p, pt, f); // creates its state (mood, ambition, axes)
        if (x) { x.mood = 6; x.ambition = clamp(num(n.traits.ambition), 30, 95); x.axes = Object.fromEntries(AX.map((kk, i) => [kk, Math.round(n.ai.ax[i]) / 100])); }
        a.cool.found = day;
        a.pf = clamp(a.pf + 12, -100, 100); a.con = clamp(a.con + 4, 0, 99);
        logAct(g, p, n, 'faction', `${a.pf < 0 ? '領袖への不満から、' : '自分の考えを形にしようと、'}${mates.length}人の仲間と${f.name}を旗揚げした`, { news: `fnd:${n.id}` });
        S(p).stats.moved++;
      },
    };
  }

  // 6. an MP aims at the 知事 / 区長 race (decided at the election; see execRunner)
  function evalGov() { return null; }

  const EVALS = [evalFaction, evalLeave, evalJoin, evalAsk, evalFound, evalGov];
  function decide(g, p, n, a, W, day) {
    if (n.office === 'chiji' || n.office === 'shicho') return;
    if (a.rt && !a.ret && mpOf(n) && (W.elecInH && W.elecInH[n.office]) < 170) { const why = a.rt; a.rt = 0; announceRetire(g, p, n, a, why, day); return; }
    const ops = [];
    for (const ev of EVALS) {
      let o = null;
      try { o = ev(g, p, n, a, W, day); } catch (e) { console.error('ai eval', ev.name, e); }
      if (o && o.u > 0) ops.push(o);
    }
    if (!ops.length) return;
    ops.sort((x, y) => y.u - x.u);
    const o = ops[0];
    // the gate: a clear case acts soon, a marginal one rarely (seeded: same save + day, same result)
    // the lobbying for posts is routine, so it is gated harder than a move that changes a seat
    if (rr(p, 'gate', n.id, o.kind, day) < sigm(3.2 * (o.u - 0.35)) * (o.kind === 'ask' ? 0.28 : 0.55)) o.run();
  }

  // ---------------------------------------------------------------- the agent's own year: ageing, health, priorities, retirement (staggered by agent, so no morning carries them all)
  function yearlyAgent(g, p, n, a, W, day) {
    if (!Number.isFinite(a.yd)) a.yd = day - (C.slotOf(n.id) * 7 % YEAR_DAYS); // the first "year" ends at a staggered day
    if (day - a.yd < YEAR_DAYS) return;
    a.yd += YEAR_DAYS;
    // the intra tick ages those in factions / with posts; the others are aged here
    if (!(n.faction || (n.posts && n.posts.length))) n.age = num(n.age, 55) + 1;
    const age = num(n.age, 55);
    a.hp = Math.round(clamp(a.hp - Math.max(0, age - 48) * 0.07 - (a.str > 70 ? 2 : 0) + rg(p, 'hp', n.id, day) * 1.5, 8, 100));
    a.lr = Math.round(clamp(a.lr - 0.3, 6, 30));
    a.pr = C.priorities(p, a, n, day);
    for (const k of Object.keys(a.cool)) if (day - a.cool[k] > YEAR_DAYS * 1.2) delete a.cool[k]; // old cooldowns are forgotten
    if (!mpOf(n) || n.exMp) return;
    const k = posKind(p, n);
    // retirement (decided here; announced near the election; it takes effect at that election; it takes effect at the next election): age, health, a defeat, stress — against ambition and rung
    if (!a.ret && !k.pm && !k.leader) {
      const tAge = (age - 66) * 0.26 + (num(n.wins) >= 10 ? 0.2 : 0);
      const tHp = (60 - a.hp) / 30;
      const tLoss = a.mem.some((e) => e[1] === 'lost' && day - e[0] < YEAR_DAYS * 1.2) ? 0.7 : 0;
      const tStr = (a.str - 75) / 40;
      const amb = num(n.traits.ambition) / 100;
      const u = tAge + tHp + tLoss + tStr - 1.25 - amb * 0.6 - (k.cab ? 0.8 : 0) - (k.fleader ? 0.6 : 0);
      if (u > -2 && rr(p, 'retire', n.id, day) < sigm(u * 2.2)) {
        // decided now; announced (with the successor) when the election is near — the heir is not kept waiting for years
        a.rt = topReason([{ v: tAge, t: WHY.retire.age }, { v: tHp, t: WHY.retire.health }, { v: tLoss, t: WHY.retire.defeat }, { v: tStr, t: WHY.retire.stress }]) || WHY.retire.heir;
      }
    }
  }
  // (kept for callers of the old name: the yearly work is done per agent now)
  function aging() { /* see yearlyAgent */ }

  // ---------------------------------------------------------------- events of the day: scandals, deaths, illnesses, vacancies
  function dailyEvents(g, p, day, W) {
    const mps = Object.values(p.npcs).filter((n) => n.ai && mpOf(n));
    if (!mps.length) return;
    // --- scandals: ~4 a year, more when the exposure is high; who: by risk (integrity, stress, money)
    const meanRisk = mps.reduce((s, n) => s + n.ai.risk, 0) / mps.length;
    const lam = (4 / YEAR_DAYS) * clamp(meanRisk / 38, 0.5, 2.2);
    if (rr(p, 'scn', day) < lam) {
      // a member of a real party (自民・民主) only ever steps down for neutral reasons, and only a minister can: no scandal is drawn for the others
      const n = wpick(p, `scnwho|${day}`, mps, (m) => (isReal(p, m.party) && !posKind(p, m).cab ? 0 : Math.pow(m.ai.risk / 40, 2) * (1 + (posKind(p, m).cab ? 1.2 : 0) + (posKind(p, m).pm ? 0.4 : 0))));
      if (n && !cool(n.ai, 'scandal', 90, day)) scandal(g, p, n, day);
    }
    // --- death and illness (a hazard by age and health) among the named
    for (const n of mps) {
      const a = n.ai;
      if ((h32(n.id) + day) % 10 !== 0) continue; // once a political month
      const age = num(n.age, 55);
      const hz = (0.0025 + Math.max(0, age - 55) * 0.0012 + Math.max(0, 70 - a.hp) * 0.0007) / 12; // a political month's share of the year's hazard
      const r = rr(p, 'die', n.id, day);
      if (r < hz) { die(g, p, n, a, day); }
      else if (r < hz * 3.2 && !a.ret && age >= 58 && a.hp < 72) { illness(g, p, n, a, day); }
    }
    // --- the rest of the Diet (the unnamed) also dies and resigns: by-elections keep coming (about 2.5 a year)
    const namedShare = Math.min(0.9, mps.length / Math.max(1, num(p.diet.shugi.total) + num(p.diet.sangi.total)));
    if (rr(p, 'vac', day) < (2.4 / YEAR_DAYS) * (1 - namedShare * 0.5)) backgroundVacancy(g, p, day);
  }
  function scandal(g, p, n, day) {
    const a = n.ai;
    const money = rr(p, 'scnk', n.id, day) < 0.5 + (a.fund > 100 ? 0.15 : 0);
    const kind = money ? (rr(p, 'scnk2', n.id, day) < 0.5 ? 'slush_fund' : 'expense') : 'private';
    const real = isReal(p, n.party);
    const hadCab = posKind(p, n).cab;
    let rec = null;
    try { rec = X.politicalScandal(g, p, kind, { who: n.id }); } catch (e) { console.error(e); }
    a.cool.scandal = day;
    a.risk = Math.max(2, a.risk - 14);
    a.str = clamp(a.str + 24, 0, 100);
    a.pf = clamp(a.pf - 8, -100, 100);
    S(p).stats.scandals++;
    if (rec && rec.kind === 'stepdown') { if (hadCab) logAct(g, p, n, 'scandal', `一身上の都合で大臣を辞した`, {}); return; }
    if (!real) logAct(g, p, n, 'scandal', `${a.fund < 8 ? '資金繰りに追われるなか、' : a.str >= 60 ? '多忙で気がゆるんだのか、' : ''}${rec && rec.name ? rec.name : money ? '政治資金の扱い' : '私生活の問題'}が週刊誌に報じられた`, {});
    // the party's members remember who hurt them: the player's own party pays too
    if (p.me.party && p.me.party === n.party) p.me.reputation = clamp(num(p.me.reputation) - 0.5, -100, 100);
  }
  function backgroundVacancy(g, p, day) {
    const house = rr(p, 'vach', day) < 0.82 ? 'shugi' : 'sangi';
    const Hs = p.diet[house];
    const ids = Object.keys(Hs.seats).filter((k) => num(Hs.seats[k]) > 0);
    if (!ids.length) return;
    const party = wpick(p, `vacp|${day}`, ids, (k) => num(Hs.seats[k]));
    const prefs = Object.keys(X.PREFECTURES || {});
    const pref = prefs.length && rr(p, 'vacpref', day) > 0.25 ? prefs[Math.floor(rr(p, 'vacpr2', day) * prefs.length)] : 'tokyo';
    const reason = rr(p, 'vacr', day) < 0.6 ? '議員の死去' : '議員の辞職';
    try { X.makeVacancy(g, p, house, { party, pref, reason, district: house === 'sangi' ? undefined : `${(X.prefShort ? X.prefShort(pref) : pref)}ドット${2 + Math.floor(rr(p, 'vacd', day) * 8)}区` }); } catch (e) { console.error(e); }
  }
  function die(g, p, n, a, day) {
    const k = posKind(p, n);
    if (k.pm) return; // a sitting PM is not removed here (the cabinet's own flow handles resignation)
    const house = n.office;
    const hadSeat = mpOf(n);
    const roles = (n.posts || []).length || k.leader;
    exitSeat(g, p, n, a, 'die', '死去', day);
    n.dead = true;
    logAct(g, p, n, 'die', `${n.age}歳で死去した`, { news: roles || num(n.wins) >= 6 ? `die:${n.id}` : false });
    if (hadSeat && house) {
      try { X.makeVacancy(g, p, house, { party: n.party || IND, reason: '議員の死去', pref: rr(p, 'dpref', n.id) < 0.3 ? 'tokyo' : undefined }); } catch (e) { console.error(e); }
    }
  }
  function illness(g, p, n, a, day) {
    const k = posKind(p, n);
    if (k.pm || k.leader) return;
    a.hp = Math.max(10, a.hp - 12);
    const hadPost = (n.posts || []).length > 0;
    if (hadPost && !k.pm) {
      vacate(g, p, n, '体調不良');
      logAct(g, p, n, 'retire', `体調不良のため、役職を退いた`, { news: `ill:${n.id}` });
    } else if (!a.ret) {
      announceRetire(g, p, n, a, WHY.retire.health, day);
    }
  }

  // ---------------------------------------------------------------- elections: learning from the result, losing and winning seats, newcomers and heirs
  function onElection(g, p, data) {
    const res = data && data.result;
    const e = data && data.election;
    if (!res) return;
    const s = S(p);
    const day = today(g);
    if (res.kind === 'shugi' || res.kind === 'sangi') {
      const house = res.kind;
      const seatsNow = p.diet[house].seats;
      const before = s.seats[house] || {};
      const med = s.meta.med || [0, 0, 0, 0, 0, 0, 0];
      const W = world(g, p, day);
      const players = new Set(['player']);
      void players;
      const stats = { won: 0, lost: 0, retired: 0 };
      // the 参院 renews half of its seats: each member belongs to one of the two classes (stable per member), the election takes one
      const parity = Math.floor(num(res.year, 0) / 3) % 2;
      const inClass = (n) => house === 'shugi' || (rr(p, 'cls', n.id) < 0.5 ? 0 : 1) === parity;
      const mps = Object.values(p.npcs).filter((n) => n.ai && n.office === house && !n.dead && inClass(n));
      for (const n of mps) {
        const a = fix(n.ai);
        if (a.ret) { // a planned retirement takes effect now; the heir stands in the seat
          const heir = a.heir && p.npcs[a.heir];
          exitSeat(g, p, n, a, 'retire', '引退', day);
          if (heir && heir.party === n.party) { stepIn(g, p, heir, house, day); logAct(g, p, heir, 'elect', `${n.name}氏の地盤を継いで初当選した`, { news: `heir:${heir.id}` }); remember(g, p, heir, 'won', 0, day); }
          stats.retired++;
          continue;
        }
        const pid = n.party || IND;
        const b = num(before[pid], num(seatsNow[pid]));
        const now = num(seatsNow[pid]);
        const loss = b > 0 ? clamp(1 - now / b, 0, 0.85) : 0;
        const k = posKind(p, n);
        const safe = k.pm ? 0.2 : k.leader ? 0.25 : k.cab || k.party ? 0.4 : k.fleader || k.bantou ? 0.55 : 1;
        const pLose = clamp((0.035 + loss * 0.95 + (50 - a.bw) / 280 - (a.jb - 50) / 420) * safe, 0.008, 0.88);
        const lose = rr(p, 'elec', e ? e.id : day, n.id) < pLose;
        const LR = a.lr / 100;
        if (lose) {
          // defeat: the believed-winning position moves toward the median (moderate), the confidence falls
          for (let i = 0; i < 7; i++) a.tg[i] = r1(clamp(a.tg[i] + LR * 1.7 * (med[i] * 100 - a.tg[i]), -95, 95));
          remember(g, p, n, 'lost', 0, day);
          a.bw = Math.max(12, a.bw - 22); a.str = clamp(a.str + 14, 0, 100);
          exMember(g, p, n, a, house, day);
          stats.lost++; s.stats.losses++;
        } else {
          const narrow = pLose > 0.3;
          for (let i = 0; i < 7; i++) {
            if (narrow) a.tg[i] = r1(clamp(a.tg[i] + LR * 0.7 * (med[i] * 100 - a.tg[i]), -95, 95));
            else if (pLose < 0.12) a.tg[i] = r1(clamp(a.tg[i] + LR * 0.35 * clamp(a.ax[i] - med[i] * 100, -40, 40) * 0.25, -95, 95)); // a safe base rewards the edge: radicalise a little
          }
          n.wins = num(n.wins) + 1;
          remember(g, p, n, 'won', 0, day);
          a.bw = Math.min(95, a.bw + 8); a.str = Math.max(0, a.str - 6);
          stats.won++; s.stats.wins++;
        }
      }
      // newcomers where a party gained seats; heirs of the dead get their seat too
      for (const [pid, now] of pairs(seatsNow)) {
        if (pid === IND) continue;
        const b = num(before[pid], now);
        const gain = num(now) - b;
        const named0 = named(p, pid, house).length;
        const share = named0 / Math.max(1, b);
        let k = gain > 0 ? Math.round(gain * Math.max(0.06, share)) : 0;
        k = Math.min(k, 3);
        for (let i = 0; i < k; i++) newcomer(g, p, pid, house, day, `${e ? e.id : day}|${i}`);
      }
      // a defeated member may come back where the party gained
      for (const x of Object.values(p.npcs)) {
        if (!x.exMp || x.dead || !x.ai || x.ai.exKind !== 'lost' || x.runFor || !x.party || !p.parties[x.party] || (x.house || 'shugi') !== house) continue;
        if (day - num(x.ai.exDay) < 60 || num(x.age) > 70) continue;
        const gain = num(seatsNow[x.party]) - num(before[x.party], num(seatsNow[x.party]));
        if (gain > 0 && rr(p, 'comeback', e ? e.id : day, x.id) < 0.3 + num(x.traits.ambition) / 400) {
          stepIn(g, p, x, house, day);
          x.ai.exKind = null;
          logAct(g, p, x, 'elect', `${house === 'shugi' ? '衆院選' : '参院選'}で返り咲いた`, { news: num(x.wins) >= 6 ? `cb:${x.id}` : false });
        }
      }
      for (const h of Object.values(p.npcs)) {
        if (h.heirOf && !h.office && h.party && p.parties[h.party] && p.npcs[h.heirOf] && p.npcs[h.heirOf].dead && num(seatsNow[h.party]) > 0 && (h.house || 'shugi') === house && day - num(h.ai && h.ai.since) > 30) {
          stepIn(g, p, h, house, day);
          if (h.ai) logAct(g, p, h, 'elect', `${p.npcs[h.heirOf].name}氏の遺志を継いで当選した`, {});
          S(p).stats.newcomers++;
        }
      }
      void stats;
      snapshotSeats(p);
    } else if (res.kind === 'sosaisen') {
      // the leader race: those who stood and lost carry the defeat; the winner's rung changes by itself (a new 党首)
      const win = res.winners && res.winners[0];
      const names = new Set((res.candidates || []).map((c) => c.name));
      for (const n of Object.values(p.npcs)) {
        if (!obj(n.ai) || n.party !== res.party || !names.has(n.name)) continue;
        const a = fix(n.ai);
        if (win && n.id === win.id) { a.pf = clamp(a.pf + 20, -100, 100); a.str = clamp(a.str - 8, 0, 100); logAct(g, p, n, 'elect', `${(p.parties[res.party] || {}).leaderTitle || '党首'}選に勝ち、党のトップに就いた`, { news: `lw:${n.id}` }); }
        else { a.pf = clamp(a.pf - 10, -100, 100); a.str = clamp(a.str + 12, 0, 100); remember(g, p, n, 'lost', 0, day); logAct(g, p, n, 'lose', `${(p.parties[res.party] || {}).leaderTitle || '党首'}選で敗れた`, {}); }
      }
    } else if (res.kind === 'chiji' || res.kind === 'shicho') {
      const L = p.local[res.kind === 'shicho' ? 'kucho' : 'chiji'];
      const h = L && L.holder && p.npcs[L.holder];
      if (h && h.ai) remember(g, p, h, 'won', 0, day);
    }
  }
  function snapshotSeats(p) {
    const s = S(p);
    s.seats = { shugi: { ...p.diet.shugi.seats }, sangi: { ...p.diet.sangi.seats } };
  }
  // a defeated member leaves the seat; the party's posts pass to others; a comeback is possible
  function exMember(g, p, n, a, house, day) {
    vacate(g, p, n, '落選');
    n.office = null; n.exMp = true; a.exDay = day; a.exKind = 'lost';
    if (p.flags.smdHolders) for (const h of Object.values(p.flags.smdHolders)) if (h && h.npc === n.id) { h.open = true; }
    logAct(g, p, n, 'lose', `${house === 'shugi' ? '衆院選' : '参院選'}で議席を失った`, { news: C.rungOf(p, n) >= 2 || num(n.wins) >= 8 ? `lose:${n.id}` : false });
  }
  function newcomer(g, p, pid, house, day, key) {
    const rand = (() => { let c = 0; return () => rr(p, 'newc', key, pid, c++); })();
    const female = rand() < 0.22;
    const age = Math.round(34 + rand() * 24);
    const name = seededName(rand, takenNames(p), null, female);
    const pt = p.parties[pid];
    const fs = pt && pt.factions ? pt.factions : [];
    const f = fs.length ? fs[Math.floor(rand() * fs.length)] : null;
    const n = X.newNpc(p, { name, gender: female ? 'f' : 'm', party: pid, house, office: house, wins: 1, age, faction: f ? f.id : null, charisma: Math.round(30 + rand() * 50), integrity: Math.round(35 + rand() * 55), ambition: Math.round(30 + rand() * 55) });
    n.look = seededLook(rand, female, age);
    if (f) f.size = num(f.size) + 1;
    C.mk(g, p, n, {});
    S(p).stats.newcomers++;
    return n;
  }

  // ---------------------------------------------------------------- the player: mentors, rivals, courtship (every political month)
  function aboutPlayer(g, p, day, W) {
    const me = p.me;
    if (!me || !(me.party || me.office)) return;
    const s = S(p);
    if (day - num(s.cool.pl, -99) < 10) return;
    s.cool.pl = day;
    const mps = Object.values(p.npcs).filter((n) => n.ai && mpOf(n) && n.party && n.party === me.party);
    if (!mps.length) return;
    let mentor = null, rival = null;
    for (const n of mps) {
      const att = attitude(g, p, n);
      const rel = C.playerRelation(g, p, n, n.ai, att);
      if (rel.mentor && (!mentor || att > mentor.att)) mentor = { n, att };
      if (rel.rival && (!rival || att < rival.att)) rival = { n, att };
      n.ai.cool.rivalP = rel.rival ? 1 : 0;
    }
    s.mentor = mentor ? mentor.n.id : null;
    s.rival = rival ? rival.n.id : null;
    if (mentor && day - num(s.cool.mentorNote, -99) >= 60 && me.standing < 70) {
      s.cool.mentorNote = day;
      me.localSupport = clamp(num(me.localSupport) + 1, 0, 100);
      logAct(g, p, mentor.n, 'mentor', `あなたの後ろ盾として、党内で口添えをしてくれている`, {});
      X.note(g, `（${mentor.n.name}氏が、党内であなたの名前を挙げて口添えしてくれているらしい）`);
    }
    if (rival && day - num(s.cool.rivalNote, -99) >= 50) {
      s.cool.rivalNote = day;
      me.reputation = clamp(num(me.reputation) - 1, -100, 100);
      remember(g, p, rival.n, 'rival', -4, day);
      logAct(g, p, rival.n, 'rival', `党内の席をめぐり、あなたを警戒して牽制している`, {});
      X.note(g, `（${rival.n.name}氏が党内で、あなたの動きに釘を刺した）`);
    }
    court(g, p, day, W, mps);
  }
  function court(g, p, day, W, mps) {
    const me = p.me;
    const s = S(p);
    const pt = p.parties[me.party];
    if (!pt || pt.leader === 'player' || me.faction || !(me.office === 'shugi' || me.office === 'sangi') || num(me.standing) < 45 || day - num(s.cool.court, -99) < 90 || !X.pushEvent) return;
    if (num(me.nationalWins) < 1 || C.budgetLeft(g, p) < 1) return;
    const pend = p.intra && Array.isArray(p.intra.events) ? p.intra.events.filter((x) => !x.answered).length : 0;
    if (pend >= 2) return;
    let best = null;
    for (const f of pt.factions || []) {
      const b = p.npcs[f.leader];
      if (!b || !b.ai) continue;
      const att = attitude(g, p, b);
      if (att < 6) continue;
      const v = att + num(b.traits.ambition) * 0.2 + num(f.size) * 0.3;
      if (!best || v > best.v) best = { f, b, att, v };
    }
    if (!best || rr(p, 'court', best.f.id, day) > 0.45) return;
    s.cool.court = day;
    best.b.ai.cool.court = day;
    const ev = X.pushEvent(g, p, {
      kind: 'court', key: `court:${best.f.id}`, party: pt.id, from: best.f.name, title: `${best.f.name}から入会の誘い`,
      text: `${best.b.name}氏から「うちに来ないか」と声がかかった。\n${best.f.name}（${best.f.size}人）は、あなたの働きぶりを見ている。入れば後ろ盾を得られるが、ほかの派閥からは色がついて見える。`,
      choices: [
        { id: 'join', label: `${best.f.name}に入る`, desc: '派閥の力を借りられる。ほかの派閥との距離ができる', fx: { ai: { join: best.f.id, npc: best.b.id } } },
        { id: 'decline', label: '今は、どこにも属さない', desc: '角は立たないが、誘ってくれた人の面目は少し潰れる', fx: { ai: { decline: best.b.id } } },
      ], until: day + 8, defaultChoice: 'decline',
    });
    if (ev) { spendPhone(g, p); logAct(g, p, best.b, 'court', `あなたを${best.f.name}に誘った`, {}); }
  }
  function applyFx(g, p, ev, fx) {
    const day = today(g);
    if (fx.join) {
      const why = g.joinFaction(fx.join);
      const b = p.npcs[fx.npc];
      if (!why && b) { remember(g, p, b, 'favor', 8, day); return `${b.name}氏の${(H.findFaction(p, fx.join) || {}).f ? H.findFaction(p, fx.join).f.name : '派閥'}に入った。`; }
      return why || '入会できなかった。';
    }
    if (fx.decline) {
      const b = p.npcs[fx.decline];
      if (b) remember(g, p, b, 'poach', -3, day);
      return 'ていねいにお断りした。';
    }
    return '';
  }
  // the player's moves (g.intraAct) and appointments are remembered by the people they touch
  function onPlayerMove(g, p, kind, target, result) {
    if (!result || !result.ok) return;
    const day = today(g);
    const code = { rally: null, placate: 'placate', poach: 'poach', favor: 'favor', reward: 'reward', punish: 'punish', expose: 'fired', plot_join: 'plot_join', plot_oppose: 'plot_oppose' }[kind];
    const pt = p.parties[p.me.party];
    if (!pt) return;
    if (kind === 'expose') {
      const n = target && target.rival ? p.npcs[target.rival] : null;
      if (n && n.ai) remember(g, p, n, 'expose', result.success ? -26 : -14, day);
      return;
    }
    if (!code) return;
    const f = target && target.faction ? (pt.factions || []).find((x) => x.id === target.faction) : null;
    const group = Object.values(p.npcs).filter((n) => n.ai && n.party === pt.id && f && n.faction === f.id);
    const lead = f ? p.npcs[f.leader] : null;
    let w = kind === 'punish' ? -12 : kind === 'poach' ? -7 : kind === 'reward' ? 10 : 7;
    if (w > 0 && result.success === false) w = Math.max(1, Math.round(w * 0.3)); // a favour that did not land counts for little
    const hit = new Set();
    if (lead && lead.ai) { remember(g, p, lead, code, Math.round(w * 1.4), day); hit.add(lead.id); }
    const bant = f && p.intra.fx[f.id] ? p.npcs[p.intra.fx[f.id].bantou] : null;
    if (bant && bant.ai && !hit.has(bant.id)) { remember(g, p, bant, code, w, day); hit.add(bant.id); }
    for (const n of group) { if (hit.size >= 6) break; if (!hit.has(n.id) && rr(p, 'witness', n.id, day) < 0.4) { remember(g, p, n, code, Math.round(w * 0.6), day); hit.add(n.id); } }
  }

  // ---------------------------------------------------------------- rival of an agent: the nearest in the same party for the same rung
  function rivalOf(g, p, n, a) {
    const pt = p.parties[n.party];
    if (!pt) return null;
    const r = rungOf(p, n);
    let best = null;
    for (const m of Object.values(p.npcs)) {
      if (m.id === n.id || m.party !== n.party || !mpOf(m) || !m.ai || m.faction === n.faction) continue;
      const rm = rungOf(p, m);
      if (rm < r || rm > r + 1) continue;
      const d = Math.abs(num(m.age) - num(n.age)) * 0.1 + Math.abs(num(m.wins) - num(n.wins)) * 0.2 - num(m.traits.ambition) * 0.02 - num(n.traits.ambition) * 0.02;
      if (!best || d < best.d) best = { d, id: m.id, name: m.name };
    }
    return best;
  }

  // ================================================================ hooks for politics.js
  const hooks = {};

  // --- the Diet vote: the party line (whip) blended with the members' own convictions
  hooks.partyYes = (p, pid, bill, base) => {
    if (!bill || !bill.policy || bill.kind === 'budget' || bill.kind === 'noconfidence' || !POLICIES[bill.policy]) return base;
    const house = bill.house === 'sangi' ? 'sangi' : 'shugi';
    const mem = named(p, pid, house);
    if (mem.length < 3) return base;
    const ruling = (p.cabinet.partyIds || []).includes(pid);
    const cabBill = bill.sponsor === 'cabinet';
    const lead = leaderOf(p, pid);
    const strong = lead && lead.ai ? clamp((num(lead.traits.charisma) - 40) / 200, 0, 0.25) : 0.05;
    let whip = 0.5 + (ruling ? 0.12 : 0.06) + (cabBill ? (ruling ? 0.25 : 0.3) : 0) + (bill.party === pid ? 0.3 : 0) + (bill.kind === 'amendment' ? 0.12 : 0) + strong;
    whip = clamp(whip, 0.3, 0.97);
    let conv = 0;
    const rebels = [];
    const line = base >= 0.5;
    const playerBill = bill.by === 'player';
    for (const n of mem) {
      const a = n.ai;
      let st = C.policyStance(null, p, n, a, bill.policy);
      if (playerBill) st += clamp(attitude(fakeG(p), p, n) / 100, -1, 1) * 0.35;
      const yes = sigm(st * 3.2);
      conv += yes;
      if ((st >= 0) !== line && Math.abs(st) > 0.22 && !(n.posts || []).length) rebels.push(n);
    }
    conv /= mem.length;
    const y = clamp(whip * base + (1 - whip) * conv, 0, 1);
    if (rebels.length && Math.abs(y - base) > 0.03) {
      bill.aiRebels = rebels.slice(0, 3).map((n) => n.name);
      if (!bill.aiLogged && rebels.length / mem.length >= 0.08) {
        bill.aiLogged = true;
        S(p).stats.rebels++;
        if (bill.log) bill.log.push({ day: S(p).day, text: `${p.parties[pid] ? p.parties[pid].short : ''}内に造反の動き（${rebels.slice(0, 2).map((n) => n.name).join('・')}氏ら）` });
      }
    }
    return y;
  };
  // --- an opposition party's decision on a cabinet bill: its policy distance, shifted by its strategy (cooperative or confrontational)
  hooks.oppBloc = (p, pid, bill, al) => {
    const st = S(p).strat[pid];
    const coop = st ? num(st.coop, 50) : 50;
    const thr = 0.64 - (coop - 50) / 160;
    // a bill with an id decides once and for all (seeded); the id-less copies of the forecast screens keep their Monte Carlo spread
    const roll = bill.id ? rr(p, 'bloc', bill.id, pid) : Math.random();
    return roll < sigm((al - thr) * 18) ? 1 : 0;
  };

  // --- the 倒閣 / 党首おろし: who starts it and why
  hooks.plotMotive = (g, p, pt, rows, chance) => {
    const W = world(g, p, today(g));
    const day = today(g);
    const pmP = X.cabinetPartyOfPM(p) === pt.id && p.cabinet.pm === pt.leader;
    const low = pmP ? clamp((44 - W.appr) / 30, 0, 1) : clamp(-(W.trend[pt.id] || 0) / 6, 0, 1);
    const near = W.elecIn < 130;
    const leaderN = pt.leader !== 'player' ? p.npcs[pt.leader] : null;
    let best = null;
    for (const n of named(p, pt.id)) {
      if (n.id === pt.leader) continue;
      const a = n.ai;
      const k = posKind(p, n);
      if (k.pm) continue;
      if (!(k.fleader || k.bantou || k.party || (a.pf < -35 && num(n.wins) >= 4))) continue;
      const gl = goalOf(p, n);
      const amb = num(n.traits.ambition) / 100;
      const tAmb = 0.6 * amb * (gl.goal >= 4 ? 1 : 0.3);
      const tLow = 0.6 * low;
      const tSour = 0.65 * clamp(-a.pf / 70, 0, 1);
      const tGrudge = pt.leader === 'player' ? 0.5 * clamp(-attitude(g, p, n) / 60, 0, 1) : 0;
      const tElec = near && low > 0.2 ? 0.15 : 0;
      const loyal = k.cab ? 0.35 : 0;
      const drive = tAmb + tLow + tSour + tGrudge + tElec - loyal;
      if (!best || drive > best.drive) best = { n, drive, why: topReason([{ v: tLow, t: WHY.plot.low }, { v: tAmb, t: WHY.plot.amb }, { v: tSour + tGrudge, t: WHY.plot.grudge }, { v: tElec, t: WHY.plot.election }]) };
    }
    if (!best) return { go: false };
    const go = best.drive >= 0.62 && rr(p, 'plot', pt.id, day) < clamp(chance * (0.55 + best.drive), 0, 0.45);
    if (go) {
      const a = best.n.ai;
      a.str = clamp(a.str + 14, 0, 100);
      S(p).stats.plots++;
      // what is dragging the government down, in the government console's own words (feature-detected: govt.js)
      if (pmP && best.why === WHY.plot.low) {
        try {
          const ab = typeof g.approvalBreakdown === 'function' ? g.approvalBreakdown() : null;
          const top = ab && Array.isArray(ab.reasons) ? ab.reasons.filter((r) => Number.isFinite(r.value) && r.value < -1 && r.label && !['base', 'other', 'honeymoon'].includes(r.id)).sort((x, y) => x.value - y.value)[0] : null;
          if (top) best.why = `${String(top.label).replace(/（[^）]*）/g, '')}が響いて内閣の支持率が低迷しているのを見て、`;
        } catch (e) { /* the plain wording stays */ }
      }
      logAct(g, p, best.n, 'plot', `${best.why}${leaderN ? `${leaderN.name}氏` : '党首'}の退陣を求める動きを主導した`, { news: false });
      remember(g, p, best.n, 'rival', 0, day);
    }
    return { go, boss: best.n.id, why: best.why, drive: best.drive };
  };
  // --- the vote of a plot: the named members decide for themselves
  hooks.plotSway = (g, p, pt, plot) => {
    const mem = named(p, pt.id);
    if (mem.length < 4) return null;
    const seats = Math.max(1, X.partySeats(p, pt.id));
    const scale = seats / mem.length;
    let dS = 0;
    const bloc = new Set(plot.bloc || []);
    for (const n of mem) {
      const a = n.ai;
      const facVote = bloc.has(n.faction) ? 1 : 0;
      const k = posKind(p, n);
      const lean = -a.pf / 100 + (k.fleader ? 0.1 : 0) - (k.cab ? 0.3 : 0) + (plot.boss === n.id ? 1 : 0) + (plot.targetId === 'player' ? -attitude(g, p, n) / 150 : 0);
      const own = lean > 0.3 ? 1 : lean < -0.05 ? 0 : facVote;
      dS += own - facVote;
    }
    const adj = dS * scale * 0.3;
    return { S: adj, L: -adj };
  };
  hooks.plotJoin = (g, p, pt, f, x) => {
    const mem = named(p, pt.id).filter((n) => n.faction === f.id);
    if (!mem.length) return null;
    const mean = mem.reduce((s, n) => s + n.ai.pf, 0) / mem.length;
    const lead = p.npcs[f.leader];
    const amb = lead ? num(lead.traits.ambition) : 50;
    return mean <= -25 && amb >= 45 && rr(p, 'pj', f.id, today(g)) < 0.1;
  };
  hooks.bossStepsDown = (g, p, pt, f, boss, x) => {
    const a = boss.ai;
    if (!a) return null;
    const age = num(boss.age, 60);
    const day = today(g);
    const hz = clamp(0.012 + Math.max(0, age - 66) * 0.012 + Math.max(0, 62 - a.hp) * 0.003 + Math.max(0, a.str - 75) * 0.002 + (num(x.mood) < -50 ? 0.03 : 0), 0.004, 0.22);
    if (rr(p, 'bossdown', boss.id, day) < hz) {
      const why = age >= 70 ? WHY.retire.age : a.hp < 62 ? WHY.retire.health : WHY.retire.stress;
      logAct(g, p, boss, 'retire', `${why}${f.name}の会長職を譲る意向を示した`, {});
      return true;
    }
    return false;
  };
  // --- the party leader race: who runs
  hooks.leaderField = (g, p, pt, outgoing, decl) => {
    const day = today(g);
    const rows = [];
    for (const n of named(p, pt.id)) {
      if (n.id === outgoing || n.id === pt.leader && rr(p, 'incumbent', n.id, day) < 0.35) continue;
      const a = n.ai;
      const k = posKind(p, n);
      if (!(k.fleader || k.bantou || k.party || k.cab || num(n.wins) >= 6)) continue;
      const amb = num(n.traits.ambition) / 100;
      const gl = goalOf(p, n);
      const rdy = readiness(p, n, a);
      const u = amb * 0.9 + (rdy / 100) * 0.8 + (gl.goal >= 4 ? 0.35 : -0.25) + (k.fleader ? 0.3 : 0) + (p.flags.plotBoss === n.id ? 0.3 : 0) + (a.pf > -20 ? 0.05 : -0.25) - 0.9;
      rows.push({ n, u, why: u > 0.5 ? WHY.run.ready : amb > 0.7 ? WHY.run.amb : WHY.run.slot });
    }
    if (!rows.length) return null;
    rows.sort((x, y) => y.u - x.u);
    const max = decl ? 2 : 3;
    const picks = rows.filter((r, i) => i === 0 || r.u > 0.15).slice(0, max);
    for (const r of picks) logAct(g, p, r.n, 'run', `${r.why}${pt.leaderTitle || '党首'}選に名乗りを上げた`, {});
    return picks.map((r) => r.n.id);
  };
  // --- the cabinet: who gets the post (merit, readiness, loyalty to the PM, faction balance, exposure)
  hooks.pickMinister = (p, pool, party, taken) => {
    if (!pool.length) return null;
    const pmN = p.cabinet.pm && p.cabinet.pm !== 'player' ? p.npcs[p.cabinet.pm] : null;
    const cnt = {};
    for (const id of Object.values(taken || {})) { const m = p.npcs[id]; if (m && m.faction) cnt[m.faction] = (cnt[m.faction] || 0) + 1; }
    const sday = S(p).day;
    const key = `pick|${sday}|${Object.keys(taken || {}).length}|${pool.length}`;
    const scored = pool.map((n) => {
      const a = n.ai;
      if (!a) return { n, w: 1 };
      const rdy = readiness(p, n, a);
      const gl = goalOf(p, n);
      const merit = rdy / 100 * 0.9 + (gl.goal >= 3 ? 0.3 : 0) + (pmN && n.faction && n.faction === pmN.faction ? 0.15 : 0) + clamp(a.pf, -60, 60) * 0.003 - (cnt[n.faction] || 0) * 0.2 - a.risk * 0.003 + (a.mem.some((e) => e[1] === 'post') ? 0 : 0);
      return { n, w: Math.exp(2.4 * merit) };
    });
    let tot = 0;
    for (const s of scored) tot += s.w;
    let x = rr(p, key) * tot;
    for (const s of scored) { x -= s.w; if (x <= 0) return s.n; }
    return scored[scored.length - 1].n;
  };
  hooks.afterMinister = (g, p, n, post) => {
    if (!n || !n.ai) return;
    const day = today(g);
    if (p.cabinet.pm === 'player') remember(g, p, n, 'post', 16, day); // only the player's own appointments are a memory of the player
    n.ai.pf = clamp(n.ai.pf + 14, -100, 100);
    n.ai.con = clamp(n.ai.con + 3, 0, 99);
    if (rungOf(p, n) >= 3) logAct(g, p, n, 'post', `${X.postName(post, X.fyNow(g))}に就任した`, {});
  };
  hooks.gaffeWeight = (p, n) => {
    const a = n && n.ai;
    if (!a) return 1;
    return clamp(0.5 + a.str / 60 + (100 - num(n.traits && n.traits.integrity, 60)) / 120, 0.4, 3);
  };
  // --- 知事・区長 races: an MP who is ripe (ambition, name, a free window) runs
  hooks.execRunner = (g, p, kind, cands, fy) => {
    if (kind !== 'chiji' && kind !== 'shicho') return null;
    const day = today(g);
    const W = world(g, p, day);
    let best = null;
    for (const n of Object.values(p.npcs)) {
      if (!n.ai || !mpOf(n) || n.exMp || n.dead || n.ai.ret || (n.posts || []).length) continue;
      const a = n.ai;
      if (num(n.wins) < 3 || num(n.age) > 68 || num(n.age) < (kind === 'chiji' ? 40 : 35)) continue;
      const amb = num(n.traits.ambition) / 100;
      const ch = num(n.traits.charisma) / 100;
      const u = amb * 0.9 + ch * 0.8 + (a.bw < 45 ? 0.15 : 0) + (W.ruling.has(n.party) ? 0 : 0.05) - 1.45 + (kind === 'shicho' ? 0.15 : 0);
      if (u > 0 && (!best || u > best.u)) best = { n, u };
    }
    if (!best || rr(p, 'govrun', kind, day) > sigm(3 * best.u) * 0.5) return null;
    const n = best.n;
    const house = n.office;
    const from = n.party;
    // resign the seat (公選法90条), stand as an independent backed by the party
    X.makeVacancy(g, p, house, { party: from || IND, reason: kind === 'chiji' ? '知事選への立候補' : '区長選への立候補', pref: 'tokyo' });
    n.ai.cool.gov = day;
    const Q = clamp(0.55 + num(n.traits.charisma) / 200 + Math.min(0.2, num(n.wins) * 0.02), 0.5, 1.05);
    logAct(g, p, n, 'gov', `${kind === 'chiji' ? '知事' : '区長'}選に挑むため、議員を辞職した`, { news: `gov:${n.id}` });
    n.office = null; n.exMp = true; n.runFor = kind;
    vacate(g, p, n, '立候補');
    return { id: n.id, name: n.name, party: IND, Q, incumbent: false, backers: from && from !== IND ? [from] : [] };
  };
  hooks.afterExec = (g, p, kind, winnerId) => {
    for (const n of Object.values(p.npcs)) {
      if (n.runFor !== kind) continue;
      n.runFor = null;
      if (n.id === winnerId) { n.office = kind; n.exMp = false; if (n.ai) logAct(g, p, n, 'elect', `${kind === 'chiji' ? '都知事' : '区長'}に当選した`, { news: `gv:${n.id}` }); }
      else if (n.ai) { n.ai.str = clamp(n.ai.str + 12, 0, 100); remember(g, p, n, 'lost', 0, today(g)); }
    }
  };
  // the player (a party leader) names someone to a party post
  hooks.onAppoint = (g, p, post, who) => {
    const n = p.npcs[who];
    if (!n || !n.ai) return;
    remember(g, p, n, 'post', 14, today(g));
    n.ai.pf = clamp(n.ai.pf + 8, -100, 100);
    logAct(g, p, n, 'post', `${X.postName(post, X.fyNow(g), n.party)}に起用された`, {});
  };
  // --- coalitions: the two leaders' compatibility, the partner leader's appetite for cabinet posts and the opposition's strategy can veto or open a door the old distance rule decides
  // (returns true / false when the agents decide, null when they have nothing to say — a player leader, or a party without a named leader)
  hooks.coalitionWilling = (g, p, core, partner, base) => {
    const lc = leaderOf(p, core), lp = leaderOf(p, partner);
    if (!lc || !lp || !lc.ai || !lp.ai) return null;
    const compat = fitV(lp.ai.ax, lc.ai.ax.map((v) => v / 100));
    const st = S(p).strat[partner];
    const coop = st ? num(st.coop, 50) : 50;
    const prev = (p.cabinet.partyIds || []).includes(partner);
    const score = compat + (num(lp.traits.ambition) - 50) / 600 + (coop - 50) / 400 + (prev ? 0.1 : 0);
    if (base && score < 0.5) return false; // the partner's leader will not sit with a line this far from their own
    if (!base && score > 0.84) return true; // an unusually close pair finds a way
    return null;
  };
  hooks.staleOK = (n) => !!n && !n.exMp && !n.dead;
  hooks.npcEvents = () => true;
  hooks.applyFx = applyFx;
  hooks.onElection = onElection;
  hooks.onPlayerMove = onPlayerMove;

  // ---------------------------------------------------------------- the interview (local template; politics_ai_claude.js replaces the words when a key is set)
  function persona(g, p, n) {
    const a = fix(ag(g, p, n));
    const t = n.traits || {};
    const amb = num(t.ambition), integ = num(t.integrity), ch = num(t.charisma);
    const tags = [];
    tags.push(amb >= 70 ? '野心家' : amb <= 35 ? '控えめ' : '堅実');
    tags.push(integ >= 70 ? '実直' : integ <= 40 ? '処世術にたけた' : '現実派');
    if (ch >= 70) tags.push('弁が立つ');
    if (a.pf <= -25) tags.push('党に不満');
    else if (a.pf >= 35) tags.push('党に忠実');
    return tags;
  }
  function interview(g, p, id, topic = 'now') {
    const n = p.npcs[id];
    if (!n) return { ok: false, text: '', by: 'local' };
    const a = fix(ag(g, p, n));
    const day = today(g);
    const pr = C.profile(g, p, id);
    const att = pr.attitude;
    const aw = attWord(att);
    const iss = pr.priorities[0] || '暮らし';
    const iss2 = pr.priorities[1] || iss;
    const gl = goalOf(p, n);
    const W = world(g, p, day);
    const ruling = W.ruling.has(n.party);
    const strong = pr.positions.filter((x) => x.strong).sort((x, y) => Math.abs(y.v) - Math.abs(x.v))[0];
    const mem = pr.memory;
    const tags = persona(g, p, n);
    const bold = tags.includes('野心家'), modest = tags.includes('控えめ'), upright = tags.includes('実直'), glib = tags.includes('処世術にたけた');
    const tired = a.str >= 65, upbeat = pr.mood >= 25, sour = a.pf <= -25;
    const same = p.me.party && p.me.party === n.party;
    const pick = (arr, k) => arr[Math.floor(rr(p, 'iv', id, k, topic) * arr.length) % arr.length];
    const role = pr.roles[0] || '';
    const ret = a.ret ? pick(['次の選挙には出ず、後進に道を譲るつもりです。', '私は次で区切りをつけます。あとは若い人たちに。'], 9) : '';
    const act = pr.acts[0];
    const parts = [];
    if (topic === 'you') {
      if (att >= 32) parts.push(pick([`あなたのことは買っていますよ。${mem ? `${mem.text}ことは忘れていません。` : ''}`, `正直、期待しています。${mem ? `${mem.text}件、感謝しているんです。` : ''}`, `${same ? '同じ党の仲間として、' : ''}あなたの動きは頼もしく見ています。${mem ? `${mem.text}ことも、ありました。` : ''}`], 1));
      else if (att <= -22) parts.push(pick([`正直に言えば、まだ納得していません。${mem ? `${mem.text}件が、どうにも引っかかっていて。` : ''}`, `お手並み拝見、といったところです。${mem ? `${mem.text}ことは覚えていますがね。` : ''}`, `${same ? '同じ党だからこそ、' : ''}言いたいことはあります。${mem ? `${mem.text}ことは、簡単には水に流せない。` : ''}`], 2));
      else parts.push(pick(['まだお付き合いが浅い。これからの仕事ぶりを見させてもらいます。', '悪い印象はありません。ただ、評価は結果を見てからです。', '政治は結果です。あなたも、私も。'], 3));
      parts.push(upright ? `私は${iss}で結果を出すことしか考えていません。` : glib ? '誰とでも、うまくやっていきたいとは思っていますよ。' : bold ? `いずれ、同じ席を争うことになるかもしれませんね。` : `私の関心は${iss}です。`);
    } else if (topic === 'goal') {
      if (gl.rung >= 5) parts.push(pick(['総理として、任期を全うすること。それに尽きます。', '政権を預かる責任は重い。次の世代につなげる仕事をしたい。'], 4));
      else if (gl.rung === 4) parts.push(ruling ? '党を率いて、次の選挙で政権を守り抜く。それが私の仕事です。' : '党首として、次の選挙で議席を伸ばし、政権に挑みます。');
      else if (gl.goal > gl.rung) parts.push(bold ? `次は${gl.label}。ここまで来たら、隠す必要もないでしょう。` : modest ? `${gl.label}…そう言われることはありますが、巡り合わせ次第です。` : `いずれは${gl.label}、と考えています。まずは目の前の仕事から。`);
      else parts.push(`${role ? `${role}として、` : ''}${iss}の仕事をやり遂げたい。それだけです。`);
      if (pr.ready >= 70 && gl.goal > gl.rung) parts.push('準備は、できているつもりです。');
      else if (pr.ready < 40 && gl.goal > gl.rung) parts.push('もっとも、まだ実績も人脈も足りませんがね。');
      if (ret) parts.push(ret);
    } else if (topic === 'party') {
      parts.push(sour ? pick([`${pr.partyShort}の運営には、言いたいことが山ほどあります。`, '執行部のやり方には、正直、不満がたまっています。'], 5) : a.pf >= 25 ? pick([`${pr.partyShort}の執行部は、よくまとめていると思います。`, '党は、いまのところ一枚岩です。私も支える側にいます。'], 6) : `${pr.partyShort}にはいろいろな意見があって当然。私は私の考えを通します。`);
      parts.push(pr.faction ? (act && act.kind === 'faction' ? `${pr.faction}に移ったのは、考えあってのことです。` : `${pr.faction}の仲間とは、よく話し合っています。`) : '特定の派閥には頼らないようにしています。');
    } else if (topic === 'issue') {
      parts.push(`いま一番大事なのは${iss}${iss2 !== iss ? `と${iss2}` : ''}です。${strong ? `${strong.name}では「${strong.word}」の立場で、そこは譲れません。` : '特定の色はつけたくないと思っています。'}`);
      parts.push(glib ? '世論の風向きは見ています。うまく合わせていくのも、政治ですから。' : upright ? '票になるかどうかではなく、やるべきことをやる。' : pick(['世論の風向きは見ています。ただ、振り回されるつもりはない。', '現場の声を聞いて、一つずつ形にします。'], 7));
    } else {
      parts.push(ruling
        ? (W.appr >= 50 ? '内閣支持率は堅調ですが、気をゆるめられません。' : W.appr >= 35 ? `内閣支持率は${Math.round(W.appr)}%。厳しい声は真摯に受け止めています。` : `内閣支持率は${Math.round(W.appr)}%。正直、危機感があります。`)
        : (W.appr >= 45 ? '政権は堅調に見えますが、死角はあります。' : '政権への不満は、確かに広がっています。') + `${pr.partyShort}として、その受け皿になりたい。`);
      parts.push(tired ? '……率直に言えば、少し疲れています。' : upbeat ? `いまは${iss}で攻める好機だと思っています。` : `私は${iss}を軸に動きます。`);
    }
    remember(g, p, n, 'talk', 3, day);
    return { ok: true, text: parts.filter(Boolean).join(''), by: 'local', topic, name: n.name, att: aw.text };
  }

  return { decide, aging, yearlyAgent, dailyEvents, aboutPlayer, rivalOf, hooks, interview, persona, moveSeat, vacate, makeHeir, named, onPlayerMove, onElection, snapshotSeats, newcomer, scandal, die };
}
