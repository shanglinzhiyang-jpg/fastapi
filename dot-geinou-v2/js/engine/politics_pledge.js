// 公約 (pledges / manifesto) and 選挙予測 (seat projection) — engine of agent R5-D. Installed by politics.js
// (installPledge(X)); state: g.state.politics.pledges (old saves get the defaults on first use).
//
// Every party has a manifesto edition (the pledges it takes into the next 衆院選): the parties' own platforms (politics.js
// PARTY_DEFS / the player's 党首室), each pledge a policy with numbers, a priority (重点 = weight 2), a deadline (the next
// general election) and a status: 未着手 (promised) → 審議中 (progress: a bill is before the Diet) → 実現 (fulfilled) / 公約違反
// (broken: the governing party did not deliver by the deadline, or the pledge was dropped). When the campaign starts (公示),
// the verdict is applied: a governing party loses support among the voters who expected the policy, the opposition campaigns
// on the broken pledges, the player's standing and the factions' moods follow. The player can write and edit the manifesto
// before 公示 (costed, with voices for and against), push a pledge into a bill, or break it (consequences shown first).
// Real parties' manifestos are their platform policies (PARTY_DEFS); nothing is said about conduct.

export function installPledge(X) {
  const H = X.H;
  const { clamp, num, rnd, irnd, pickOne, gauss, POLICIES, POLICY_AREAS, SEGMENTS, SEGMENT_ORDER, YEAR_DAYS } = X;
  const { U, fundsOf, pay, hash01, npcOf, npcName, factionsOf, fxOf, myParty, roleOf, pmPartyId, today } = H;
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const IND = 'ind';
  const SEG_SHORT = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁業', unions: '労働組合', urban: '都市住民', rural: '地方住民', floating: '無党派層' };
  const MAX_PLEDGES = 10;

  // ---------------------------------------------------------------- state
  function PL(p) {
    let s = p.pledges;
    if (!obj(s)) s = p.pledges = {};
    s.v = 1;
    if (!obj(s.ed)) s.ed = {};
    if (!Array.isArray(s.list)) s.list = [];
    if (!obj(s.cred)) s.cred = {};
    if (!Array.isArray(s.hist)) s.hist = [];
    if (!(s.seq > 0)) s.seq = 1;
    return s;
  }
  const pid_ = (p) => `pg${PL(p).seq++}`;
  const isRuling = (p, id) => (p.cabinet.partyIds || []).includes(id);
  function nextElectionDay(g, p) {
    const sh = (p.elections.upcoming || []).filter((e) => e.kind === 'shugi' && e.status !== 'done').sort((a, b) => a.day - b.day)[0];
    if (sh) return { day: sh.day, koji: sh.koji, id: sh.id, status: sh.status };
    const term = num(p.diet.shugi.termEnd, 0);
    const day = X.dayOfAbs(p, term);
    return { day: Math.max(today(g) + 30, day), koji: Math.max(today(g) + 20, day - 4), id: null, status: 'scheduled' };
  }
  const yearNow = (g) => X.polDate(g).year;

  // ---------------------------------------------------------------- pledge records
  function defaultParams(g, p, polId) {
    const pl = POLICIES[polId];
    if (!pl) return {};
    let params = {};
    try { params = X.agendaParams(p, polId, yearNow(g)) || { ...pl.defaults }; } catch (e) { params = { ...pl.defaults }; }
    return params;
  }
  function costOfPledge(g, p, polId, params) {
    const pl = POLICIES[polId];
    if (!pl) return 0;
    try { return pl.costOf(params || pl.defaults, X.ctxOf(p, yearNow(g))); } catch (e) { return 0; }
  }
  function segGain(g, p, polId, params) {
    const pl = POLICIES[polId];
    try { return pl.effects(params || pl.defaults, p.era, X.ctxOf(p, yearNow(g))).segments || {}; } catch (e) { return {}; }
  }
  function mkPledge(g, p, pt, polId, o = {}) {
    const S = PL(p);
    const params = o.params || defaultParams(g, p, polId);
    const ed = S.ed[pt.id];
    return {
      id: pid_(p), party: pt.id, policy: polId, params: { ...params }, status: o.status || 'promised', prio: o.prio || 1, made: today(g), deadline: ed ? ed.deadline : nextElectionDay(g, p).day,
      edition: ed ? ed.n : 1, billId: null, doneDay: null, brokenDay: null, why: '', carried: o.carried || 0, src: o.src || 'platform', cost: costOfPledge(g, p, polId, params),
    };
  }
  function platformPolicies(g, p, pt) {
    const list = (pt.platform || []).filter((id) => POLICIES[id]);
    const yr = yearNow(g);
    return list.filter((id) => { const pl = POLICIES[id]; return !(pl.years && (yr < pl.years[0] || yr > pl.years[1])); });
  }
  function ensureEdition(g, p, pt) {
    const S = PL(p);
    let ed = S.ed[pt.id];
    if (!obj(ed)) {
      const nx = nextElectionDay(g, p);
      ed = S.ed[pt.id] = { n: 1, from: today(g), deadline: nx.day, koji: nx.koji, electionId: nx.id, locked: false, judged: false };
      // the parties' own pledges: their platform policies that are not already law
      const inForce = new Set([...(p.laws || []).map((l) => l.policy), ...Object.keys(p.flags.inForce || {})]);
      let ids = platformPolicies(g, p, pt).filter((id) => !inForce.has(id) || (POLICIES[id].params && !(p.laws || []).some((l) => l.policy === id)));
      ids = ids.slice(0, pt.isPlayers ? 8 : 6);
      ids.forEach((id, i) => S.list.push(mkPledge(g, p, pt, id, { prio: i < 2 ? 2 : 1 })));
    }
    return ed;
  }
  // the open pledges of an edition follow the election day (a dissolution moves it)
  function syncDeadlines(p, pid, ed, nx) {
    for (const q of PL(p).list) if (q.party === pid && q.edition === ed.n && q.deadline !== nx.day && !['fulfilled', 'broken', 'dropped'].includes(q.status)) q.deadline = nx.day;
  }
  function ensureAll(g, p) {
    for (const pt of Object.values(p.parties)) ensureEdition(g, p, pt);
    // an election day that moved (a dissolution): the editions follow
    const nx = nextElectionDay(g, p);
    const S = PL(p);
    for (const [id, ed] of Object.entries(S.ed)) {
      if (!p.parties[id]) { delete S.ed[id]; continue; }
      if (!ed.judged && (ed.deadline !== nx.day || ed.koji !== nx.koji)) { ed.deadline = nx.day; ed.koji = nx.koji; ed.electionId = nx.id; for (const q of S.list) if (q.party === id && q.edition === ed.n && !['fulfilled', 'broken'].includes(q.status)) q.deadline = nx.day; }
    }
    S.list = S.list.filter((q) => p.parties[q.party] && (today(g) - num(q.doneDay || q.brokenDay, today(g)) < YEAR_DAYS * 6));
    S.ensured = today(g);
  }
  const mine = (p, pt) => !!pt && p.me.party === pt.id;
  function canEdit(p, pt) { return !!pt && pt.leader === 'player' && p.me.party === pt.id; }
  const STATUS = { promised: '未着手', progress: '審議中', fulfilled: '実現', broken: '公約違反', dropped: '撤回' };

  // ---------------------------------------------------------------- the status of a pledge follows the Diet
  function refreshStatus(g, p) {
    const S = PL(p);
    const laws = p.laws || [];
    const bills = p.diet.bills || [];
    for (const q of S.list) {
      if (['fulfilled', 'broken', 'dropped'].includes(q.status)) continue;
      const law = laws.find((l) => l.policy === q.policy && num(l.day) >= num(q.made) - 1);
      if (law) { markFulfilled(g, p, q, law); continue; }
      const bill = bills.find((b) => b.policy === q.policy && !['rejected', 'shelved'].includes(b.stage) && b.stage !== 'enacted');
      if (bill) { q.status = 'progress'; q.billId = bill.id; }
      else if (q.status === 'progress') { q.status = 'promised'; q.billId = null; }
    }
  }
  function weight(q) { return q.prio >= 2 ? 2 : 1; }
  function markFulfilled(g, p, q, law) {
    if (q.status === 'fulfilled') return;
    q.status = 'fulfilled'; q.doneDay = today(g); q.billId = law ? law.bill || q.billId : q.billId;
    const pt = p.parties[q.party];
    if (!pt) return;
    const W = weight(q);
    const by = law && (law.party || null);
    const credit = isRuling(p, q.party) || by === q.party;
    if (credit) {
      const gains = segGain(g, p, q.policy, q.params);
      for (const [s, d] of Object.entries(gains)) if (d > 0) X.addSupport(p, s, q.party, 0.0012 * W * Math.min(1, d / 4));
      if (isRuling(p, q.party)) { X.approvalShift ? X.approvalShift(g, p, 0.5 * W, `公約の実現：${POLICIES[q.policy].name}`) : null; }
      PL(p).cred[q.party] = clamp(num(PL(p).cred[q.party]) + 4 * W, -100, 100);
      if (mine(p, pt)) {
        p.me.standing = clamp(num(p.me.standing) + (pt.leader === 'player' ? 2 : 0.6) * W, 0, 100);
        if (pt.leader === 'player') X.note(g, `（公約「${POLICIES[q.policy].name.replace(/（[^）]*）/g, '')}」を実現した！）`);
      }
      if (isRuling(p, q.party) && !H.quiet(g, p, `pgf:${q.party}`, 6)) X.news(p, g, `${pt.short}の公約「${POLICIES[q.policy].name.replace(/（[^）]*）/g, '')}」が実現`);
    }
  }

  // ---------------------------------------------------------------- the verdict at the campaign (公示)
  function brokenEffect(g, p, q, pt, opts = {}) {
    const W = weight(q);
    const gains = segGain(g, p, q.policy, q.params);
    const segs = [];
    for (const [s, d] of Object.entries(gains)) if (d > 0) segs.push({ seg: s, name: SEG_SHORT[s] || s, v: Math.round(-0.35 * W * Math.min(1, d / 4) * 10) / 10 });
    segs.sort((a, b) => a.v - b.v);
    const half = opts.half ? 0.5 : 1;
    return { segs: segs.slice(0, 4).map((x) => ({ ...x, v: Math.round(x.v * half * 10) / 10 })), approval: -0.9 * W * half, standing: pt && pt.leader === 'player' ? -3.5 * W * half : -1 * W * half, cred: -8 * W * half, mood: -2.5 * W * half, share: -0.0035 * W * half };
  }
  function applyBroken(g, p, q, pt, opts = {}) {
    const E = brokenEffect(g, p, q, pt, opts);
    const gains = segGain(g, p, q.policy, q.params);
    for (const [s, d] of Object.entries(gains)) if (d > 0) X.addSupport(p, s, q.party, E.share * Math.min(1, d / 4));
    if (isRuling(p, q.party)) X.approvalShift && X.approvalShift(g, p, E.approval, `公約違反：${POLICIES[q.policy].name.replace(/（[^）]*）/g, '')}`);
    PL(p).cred[q.party] = clamp(num(PL(p).cred[q.party]) + E.cred, -100, 100);
    if (mine(p, pt)) p.me.standing = clamp(num(p.me.standing) + E.standing, 0, 100);
    // the factions that wanted it are upset (those whose axes agree with the policy)
    if (pt) {
      const pax = H.policyAxes(q.policy);
      for (const f of factionsOf(p, pt)) {
        const x = H.I(p).fx[f.id];
        if (!x) continue;
        const a = H.agree(x.axes, pax);
        if (a > 0.08) x.mood = clamp(num(x.mood) + E.mood * Math.min(1.5, a * 3), -100, 100);
      }
    }
    return E;
  }
  // at 公示 (or when the term's deadline arrives): the governing party's open pledges become broken, the verdict is applied
  function campaignVerdict(g, p, pt, ed) {
    const S = PL(p);
    const list = S.list.filter((q) => q.party === pt.id && q.edition === ed.n);
    const ruling = isRuling(p, pt.id);
    let f = 0, b = 0, w = 0, wb = 0, wf = 0;
    const brokenList = [];
    for (const q of list) {
      if (q.status === 'fulfilled') { f++; wf += weight(q); w += weight(q); continue; }
      if (q.status === 'dropped') { b++; wb += weight(q); w += weight(q); continue; }
      if (q.status === 'broken') { b++; wb += weight(q); w += weight(q); brokenList.push(q); continue; }
      w += weight(q);
      if (ruling) {
        q.status = 'broken'; q.brokenDay = today(g); q.why = '期限（総選挙）までに実現できなかった';
        applyBroken(g, p, q, pt, {});
        b++; wb += weight(q); brokenList.push(q);
      } else { q.status = 'expired'; }
    }
    const score = w ? Math.round(((wf - 1.2 * wb) / w) * 100) : 0;
    ed.judged = true;
    ed.verdict = { fulfilled: f, broken: b, total: list.length, score, ruling };
    S.hist.unshift({ day: today(g), party: pt.id, partyName: pt.name, ruling, fulfilled: f, broken: b, total: list.length, score, edition: ed.n });
    if (S.hist.length > 16) S.hist.length = 16;
    if (ruling && brokenList.length) {
      // the opposition campaigns on it
      const oppo = Object.keys(p.parties).filter((id) => !isRuling(p, id) && id !== pt.id).sort((a, bb) => X.partySeats(p, bb) - X.partySeats(p, a))[0];
      const names = brokenList.slice(0, 2).map((q) => `「${POLICIES[q.policy].name.replace(/（[^）]*）/g, '')}」`).join('・');
      if (oppo && !H.quiet(g, p, `pgcamp:${pt.id}`, 15)) X.news(p, g, `${p.parties[oppo].short}は、${pt.short}の公約違反（${names}${brokenList.length > 2 ? `ほか${brokenList.length - 2}件` : ''}）を選挙で訴える`);
      for (const id of Object.keys(p.parties)) if (id !== pt.id && !isRuling(p, id)) X.addSupportAll(p, id, 0.0006 * Math.min(6, brokenList.length));
      if (mine(p, pt)) X.note(g, `（公約の達成は${f}件、公約違反は${b}件。野党が選挙で「公約違反」を訴えている）`);
    } else if (mine(p, pt) && pt.leader === 'player' && ruling) X.note(g, `（公約は${f}件実現。${b ? `${b}件は届かなかった` : 'すべて果たした'}）`);
    return ed.verdict;
  }
  function pledgeTick(g, p, day) {
    const S = PL(p);
    if (S.ensured == null || day - S.ensured > 20) ensureAll(g, p);
    if (day - num(S.last, -99) < 2) return;
    S.last = day;
    refreshStatus(g, p);
    const nx = nextElectionDay(g, p);
    for (const pt of Object.values(p.parties)) {
      const ed = ensureEdition(g, p, pt);
      if (ed.judged) continue;
      ed.deadline = nx.day; ed.koji = nx.koji; ed.electionId = nx.id;
      syncDeadlines(p, pt.id, ed, nx);
      // locked once the campaign opens; the verdict then
      if (day >= nx.koji - 0 || (nx.status === 'campaign')) {
        ed.locked = true;
        campaignVerdict(g, p, pt, ed);
      } else if (nx.day - day <= 12 && !ed.warned && mine(p, pt) && pt.leader === 'player') {
        ed.warned = true;
        X.note(g, '（まもなく選挙。公約の整理は公示までに。公示のあとは変えられない）');
      }
    }
  }
  // after the election: new editions
  function onElectionDone(g, p, data) {
    const res = data && data.result;
    if (!res || res.kind !== 'shugi') return;
    const S = PL(p);
    ensureAll(g, p);
    const nx = nextElectionDay(g, p);
    for (const pt of Object.values(p.parties)) {
      const ed = S.ed[pt.id];
      if (!ed) continue;
      if (!ed.judged) campaignVerdict(g, p, pt, ed);
      const old = S.list.filter((q) => q.party === pt.id && q.edition === ed.n);
      ed.n += 1; ed.from = today(g); ed.deadline = nx.day; ed.koji = nx.koji; ed.electionId = nx.id; ed.locked = false; ed.judged = false; ed.warned = false; ed.verdict = null;
      // carry over what is still open (the player's party keeps them for the player to decide); top up from the platform
      for (const q of old) {
        if (['broken', 'expired', 'promised', 'progress'].includes(q.status)) {
          if (q.status === 'broken' && !pt.isPlayers) continue; // an NPC party does not repeat a broken promise as such
          const keep = pt.isPlayers || pt.leader === 'player' || (q.status !== 'broken' && Math.random() < 0.75);
          if (keep && (q.status === 'promised' || q.status === 'progress' || q.status === 'expired' || (q.status === 'broken' && pt.leader === 'player'))) S.list.push(mkPledge(g, p, pt, q.policy, { params: q.params, prio: q.prio, carried: num(q.carried) + 1, src: 'carry' }));
        }
      }
      const have = new Set(S.list.filter((q) => q.party === pt.id && q.edition === ed.n).map((q) => q.policy));
      const inForce = new Set([...(p.laws || []).map((l) => l.policy), ...Object.keys(p.flags.inForce || {})]);
      const pool = platformPolicies(g, p, pt).filter((id) => !have.has(id) && !inForce.has(id));
      while (have.size < (pt.isPlayers ? 3 : 6) && pool.length) { const id = pool.splice(irnd(0, pool.length - 1), 1)[0]; S.list.push(mkPledge(g, p, pt, id, { prio: 1 })); have.add(id); }
    }
    S.list = S.list.filter((q) => q.edition >= (S.ed[q.party] ? S.ed[q.party].n - 2 : 0));
  }

  // ---------------------------------------------------------------- rows for the UI
  function rowOf(g, p, q) {
    const pl = POLICIES[q.policy];
    const days = q.deadline - today(g);
    return {
      id: q.id, party: q.party, policy: q.policy, name: pl ? pl.name : q.policy, short: pl ? pl.name.replace(/（[^）]*）/g, '') : q.policy, area: pl ? pl.area : '', areaName: pl ? (POLICY_AREAS[pl.area] || {}).name : '',
      params: { ...q.params }, status: q.status, statusName: STATUS[q.status] || (q.status === 'expired' ? '期限切れ' : q.status), prio: q.prio, deadline: q.deadline, daysLeft: days, cost: q.cost, billId: q.billId,
      carried: q.carried, why: q.why, made: q.made, doneDay: q.doneDay, brokenDay: q.brokenDay,
      paramText: pl && pl.params ? pl.params.map((d) => `${d.name}${num(q.params[d.key], d.def)}${d.unit}`).join('・') : '',
    };
  }
  function manifesto(g, pid) {
    const p = X.ensurePol(g);
    const pt = (pid && p.parties[pid]) || myParty(p) || p.parties[pmPartyId(p)];
    if (!pt) return null;
    const S = PL(p);
    if (S.ensured == null) ensureAll(g, p);
    const ed = ensureEdition(g, p, pt);
    if (!ed.judged) syncDeadlines(p, pt.id, ed, nextElectionDay(g, p));
    const list = S.list.filter((q) => q.party === pt.id && q.edition === ed.n).map((q) => rowOf(g, p, q));
    list.sort((a, b) => b.prio - a.prio || (a.status === 'fulfilled') - (b.status === 'fulfilled'));
    const ruling = isRuling(p, pt.id);
    const cnt = (st) => list.filter((q) => q.status === st).length;
    const W = list.reduce((a, q) => a + weight(q), 0);
    const costNet = Math.round(list.filter((q) => !['fulfilled'].includes(q.status)).reduce((a, q) => a + num(q.cost), 0) * 10) / 10;
    const E = p.economy;
    const perPct = 2.6 * (num(E.gdp, 600) / 600);
    const history = S.hist.filter((h) => h.party === pt.id).slice(0, 4);
    // credibility: -100..100, shown as 信用
    const cred = Math.round(num(S.cred[pt.id]));
    const nx = nextElectionDay(g, p);
    return {
      party: pt.id, partyName: pt.name, short: pt.short, color: pt.color, real: !!pt.real, ruling, mine: mine(p, pt), canEdit: canEdit(p, pt), edition: ed.n, deadline: nx.day, daysLeft: nx.day - today(g), kojiDate: X.dateLabel(g, nx.koji), locked: !!ed.locked || today(g) >= nx.koji,
      electionLabel: `総選挙（${X.dateLabel(g, nx.day)}ごろ）`, list, counts: { promised: cnt('promised'), progress: cnt('progress'), fulfilled: cnt('fulfilled'), broken: cnt('broken') + cnt('dropped'), total: list.length },
      cost: { net: costNet, spend: Math.round(list.filter((q) => q.cost > 0 && q.status !== 'fulfilled').reduce((a, q) => a + q.cost, 0) * 10) / 10, revenue: Math.round(-list.filter((q) => q.cost < 0 && q.status !== 'fulfilled').reduce((a, q) => a + q.cost, 0) * 10) / 10, taxEq: Math.round((costNet / perPct) * 10) / 10, perPct: Math.round(perPct * 10) / 10 },
      cred, credLabel: cred >= 25 ? '信頼されている' : cred >= 5 ? 'まずまず' : cred > -15 ? '普通' : cred > -40 ? '疑われている' : '「言うだけ」と見られている', weight: W, history, verdict: ed.verdict || null, max: MAX_PLEDGES,
    };
  }

  // ---------------------------------------------------------------- the player's edits
  function pledgeAdd(g, p, polId, params) {
    const pt = myParty(p);
    if (!pt) return { ok: false, why: '政党に入っていない' };
    if (!canEdit(p, pt)) return { ok: false, why: '公約を決めるのは党首。議員は「提案」できる' };
    const ed = ensureEdition(g, p, pt);
    const nx = nextElectionDay(g, p);
    if (ed.locked || today(g) >= nx.koji) return { ok: false, why: '公示のあとは、公約を加えられない（公示までに整理する）' };
    const pl = POLICIES[polId];
    if (!pl) return { ok: false, why: 'その政策はない' };
    const S = PL(p);
    const cur = S.list.filter((q) => q.party === pt.id && q.edition === ed.n);
    if (cur.length >= MAX_PLEDGES) return { ok: false, why: `公約は${MAX_PLEDGES}件まで（絞りこむほうが信用される）` };
    if (cur.some((q) => q.policy === polId)) return { ok: false, why: 'すでに公約に入っている' };
    const pr = X.sanitizeParams(pl, params || defaultParams(g, p, polId));
    const block = X.policyBlockFor(p, polId, pr, g);
    if (block && !/国会に出ている|1年たっていない/.test(block)) return { ok: false, why: block };
    const q = mkPledge(g, p, pt, polId, { params: pr, prio: 1, src: 'player' });
    S.list.push(q);
    pt.platform = [...new Set([...(pt.platform || []), polId])].slice(0, 12);
    refreshStatus(g, p);
    return { ok: true, id: q.id, text: `公約に「${pl.name}」を加えた。`, row: rowOf(g, p, q) };
  }
  function findPledge(p, id) { return PL(p).list.find((q) => q.id === id) || null; }
  function pledgeRemove(g, p, id) {
    const q = findPledge(p, id);
    if (!q) return { ok: false, why: 'その公約はない' };
    const pt = p.parties[q.party];
    if (!canEdit(p, pt)) return { ok: false, why: '公約を決めるのは党首' };
    const ed = ensureEdition(g, p, pt);
    const nx = nextElectionDay(g, p);
    if (ed.locked || today(g) >= nx.koji) return { ok: false, why: '公示のあとは、取り下げると「公約違反」になる（「破る」から）' };
    if (['fulfilled', 'broken', 'dropped'].includes(q.status)) return { ok: false, why: 'もう決着している' };
    // before 公示 a pledge made in this edition by the player can be dropped free; a carried-over one or one with a bill under way costs a little
    const cost = q.carried || q.status === 'progress';
    const S = PL(p);
    S.list = S.list.filter((x) => x !== q);
    pt.platform = (pt.platform || []).filter((x) => x !== q.policy);
    if (cost) { p.me.standing = clamp(num(p.me.standing) - 1, 0, 100); S.cred[pt.id] = clamp(num(S.cred[pt.id]) - 2, -100, 100); }
    return { ok: true, text: cost ? '公約を取り下げた（前から言ってきた約束のため、少し信用を失った）。' : '公約を取り下げた（公示前なので、ペナルティはない）。' };
  }
  function pledgePriority(g, p, id, prio) {
    const q = findPledge(p, id);
    if (!q) return { ok: false, why: 'その公約はない' };
    const pt = p.parties[q.party];
    if (!canEdit(p, pt)) return { ok: false, why: '公約を決めるのは党首' };
    const ed = ensureEdition(g, p, pt);
    if (ed.locked) return { ok: false, why: '公示のあとは変えられない' };
    q.prio = clamp(Math.round(num(prio, 1)), 1, 2);
    const cnt = PL(p).list.filter((x) => x.party === pt.id && x.edition === ed.n && x.prio >= 2).length;
    if (cnt > 4) { q.prio = 1; return { ok: false, why: '重点公約は4件まで（重点が多いと重みがなくなる）' }; }
    return { ok: true, text: q.prio >= 2 ? '重点公約にした（実現すれば評価が2倍、破れば反動も2倍）。' : '重点を外した。' };
  }
  function pledgeParams(g, p, id, params) {
    const q = findPledge(p, id);
    if (!q) return { ok: false, why: 'その公約はない' };
    const pt = p.parties[q.party];
    if (!canEdit(p, pt)) return { ok: false, why: '公約を決めるのは党首' };
    const ed = ensureEdition(g, p, pt);
    if (ed.locked) return { ok: false, why: '公示のあとは、数字を変えると「修正（弱めた）」になる' };
    const pl = POLICIES[q.policy];
    q.params = X.sanitizeParams(pl, params);
    q.cost = costOfPledge(g, p, q.policy, q.params);
    return { ok: true, text: '公約の数字を変えた。' };
  }
  function breakPreview(g, p, id, how = 'drop') {
    const q = findPledge(p, id);
    if (!q) return null;
    const pt = p.parties[q.party];
    const E = brokenEffect(g, p, q, pt, { half: how === 'water' });
    const pl = POLICIES[q.policy];
    const ruling = isRuling(p, q.party);
    return {
      id: q.id, name: pl ? pl.name : '', how, approval: ruling ? Math.round(E.approval * 10) / 10 : 0, standing: Math.round(E.standing * 10) / 10, cred: Math.round(E.cred), segs: E.segs, mood: Math.round(E.mood * 10) / 10,
      lines: [
        `支持率 ${ruling ? `${E.approval.toFixed(1)}pt` : '（与党でないので影響なし）'}・信用 ${Math.round(E.cred)}`,
        `不満を持つ層：${E.segs.length ? E.segs.map((s) => `${s.name}${s.v}`).join('・') : 'ほとんどない'}`,
        `党内の評価 ${E.standing.toFixed(1)}・この政策を望む派閥の機嫌 ${E.mood.toFixed(1)}`,
        '選挙で野党が「公約違反」と訴える材料になる',
      ],
      water: !!(pl && pl.params),
    };
  }
  function pledgeBreak(g, p, id, how = 'drop') {
    const q = findPledge(p, id);
    if (!q) return { ok: false, why: 'その公約はない' };
    const pt = p.parties[q.party];
    if (!canEdit(p, pt)) return { ok: false, why: '公約を破れるのは党首（総理）' };
    if (['fulfilled', 'broken', 'dropped'].includes(q.status)) return { ok: false, why: 'もう決着している' };
    const pl = POLICIES[q.policy];
    if (how === 'water') {
      if (!pl || !pl.params) return { ok: false, why: '数字のある公約だけ、弱める（修正する）ことができる' };
      const E = applyBroken(g, p, q, pt, { half: true });
      // weaken: move the numbers toward the cheaper side
      const np = { ...q.params };
      for (const d of pl.params) {
        const step = d.step || 1;
        const a = clamp(num(np[d.key], d.def) - step, d.min, d.max), b = clamp(num(np[d.key], d.def) + step, d.min, d.max);
        const ca = Math.abs(costOfPledge(g, p, q.policy, { ...np, [d.key]: a })), cb = Math.abs(costOfPledge(g, p, q.policy, { ...np, [d.key]: b }));
        np[d.key] = ca <= cb ? a : b;
      }
      q.params = np; q.cost = costOfPledge(g, p, q.policy, np); q.why = '数字を弱めた（修正）';
      return { ok: true, text: `「${pl.name}」の数字を弱めた。批判は出るが、全面撤回よりは傷が浅い。`, effect: E };
    }
    q.status = 'broken'; q.brokenDay = today(g); q.why = '公約を撤回した';
    const E = applyBroken(g, p, q, pt, {});
    X.news(p, g, `${pt.short}が公約「${(pl ? pl.name : '').replace(/（[^）]*）/g, '')}」を撤回、と報じられる`);
    if (isRuling(p, q.party) && !g.auto) X.phoneNews(g, `【公約】${pt.name}が公約「${(pl ? pl.name : '').replace(/（[^）]*）/g, '')}」を撤回しました。野党は「公約違反だ」と批判しています。`, 'ドット新聞 政治部');
    return { ok: true, text: `「${pl ? pl.name : ''}」を撤回した。野党は「公約違反」と批判している。`, effect: E };
  }
  // pledge → bill (the player's cabinet / the member's own bill)
  function pledgeToBill(g, p, id) {
    const q = findPledge(p, id);
    if (!q) return { ok: false, why: 'その公約はない' };
    if (['fulfilled', 'broken', 'dropped'].includes(q.status)) return { ok: false, why: 'もう決着している' };
    if (q.billId && (p.diet.bills || []).some((b) => b.id === q.billId && !['enacted', 'rejected', 'shelved'].includes(b.stage))) return { ok: false, why: 'すでに法案が国会に出ている' };
    const bid = g.proposeBillPlanned ? g.proposeBillPlanned({ policy: q.policy, params: q.params }) : g.proposeBill({ policy: q.policy, params: q.params });
    if (!bid) return { ok: false, why: g.lastPoliticsError || '法案にできなかった' };
    q.billId = bid; q.status = 'progress';
    return { ok: true, billId: bid, text: `公約「${POLICIES[q.policy].name}」を法案にした。` };
  }
  // a member proposes a pledge to the leadership: odds by standing and alignment
  function pledgePropose(g, p, polId) {
    const pt = myParty(p);
    if (!pt) return { ok: false, why: '政党に入っていない' };
    if (canEdit(p, pt)) return pledgeAdd(g, p, polId, null);
    const ed = ensureEdition(g, p, pt);
    if (ed.locked) return { ok: false, why: '公示のあと' };
    const S = PL(p);
    if (S.list.some((q) => q.party === pt.id && q.edition === ed.n && q.policy === polId)) return { ok: false, why: 'すでに公約に入っている' };
    if (S.list.filter((q) => q.party === pt.id && q.edition === ed.n).length >= MAX_PLEDGES) return { ok: false, why: '公約の枠がいっぱい' };
    if (num(g.state.stamina) < 8) return { ok: false, why: '体力が足りない' };
    const al = X.alignment(p, pt.id, polId);
    const odds = clamp(((al - 0.45) * 1.6 + (num(p.me.standing) - 30) / 140), 0.05, 0.85);
    g.state.stamina -= 8;
    if (Math.random() < odds) {
      const q = mkPledge(g, p, pt, polId, { prio: 1, src: 'player' });
      S.list.push(q);
      p.me.standing = clamp(num(p.me.standing) + 3, 0, 100);
      return { ok: true, odds, text: `あなたの提案が党の公約に採用された！「${POLICIES[polId].name}」` };
    }
    p.me.standing = clamp(num(p.me.standing) + 0.5, 0, 100);
    return { ok: true, odds, success: false, text: '提案は見送られた。「いまの党の方針とは合わない」と言われた。' };
  }
  function proposeOdds(g, p, polId) {
    const pt = myParty(p);
    if (!pt) return null;
    const al = X.alignment(p, pt.id, polId);
    return clamp(((al - 0.45) * 1.6 + (num(p.me.standing) - 30) / 140), 0.05, 0.85);
  }

  // ---------------------------------------------------------------- voices for and against a pledge (neutral)
  const PRO = {
    economy: ['成長や雇用につながるなら、前向きに受けとめたい。', '企業が動きやすくなれば、賃金にも波及するはず。'],
    finance: ['将来世代にツケを回さないために必要な取り組みだ。', '財政が安定すれば、長い目で安心できる。'],
    tax: ['税の仕組みが公平になるなら、納得できる。', '家計の負担が軽くなれば、助かる。'],
    welfare: ['年金や介護が安心できるなら、ぜひ進めてほしい。', '支える人も支えられる人も、見通しが立つ。'],
    health: ['医療にかかりやすくなるのは心強い。', '地域の病院が守られるなら賛成だ。'],
    childcare: ['子育ての負担が減れば、もう一人考えられる。', '少子化対策は待ったなしだ。'],
    education: ['教育への投資は、将来への一番の投資だ。', '学び直しや研究の環境が整うのは歓迎。'],
    labor: ['働き方が変われば、暮らしも変わる。期待したい。', '賃金や雇用の安定は何より大切。'],
    diplomacy: ['国の守りと外交を固めるのは政府の責任だ。', '国際協調を進めるなら理解できる。'],
    constitution: ['時代に合わせて議論を進めるべきだ。', '国民が決める機会が持てるのはよいこと。'],
    energy: ['電気料金とエネルギーの安定は暮らしの土台。', '脱炭素を進めるなら、方向性は賛成。'],
    environment: ['環境を守るのは今の世代の責任だ。', '地域の自然や空気がよくなるなら歓迎。'],
    agriculture: ['農家が続けられる仕組みがあれば、食も守られる。', '地方の産業が元気になるのは大事。'],
    regional: ['地方に仕事と人が戻るなら賛成だ。', '身近なインフラが整うのは助かる。'],
    admin: ['行政や政治がすっきりするなら、信頼が戻る。', 'ムダが減るならぜひ。'],
    safety: ['安心して暮らせる街は何より大切。', '被害を減らすための対策は必要だ。'],
    digital: ['手続きが便利になるなら歓迎。', '行政のオンライン化は時代の流れ。'],
    disaster: ['災害に強い国土づくりは、命を守ること。', '備えにお金をかけるのは当然だ。'],
    culture: ['文化や観光は地域の誇りと収入になる。', '芸術やスポーツへの支援はありがたい。'],
    society: ['多様な暮らし方が認められる社会になってほしい。', '人権が守られる仕組みはあって当然。'],
  };
  const CON = {
    economy: ['規制緩和や民営化は、弱い立場の人に厳しくならないか。', '景気対策の効果は本当にあるのか。'],
    finance: ['急に財政を絞ると、暮らしに響く。', '国債に頼る構造を変えるには時間がかかりすぎる。'],
    tax: ['負担が増える人には痛い。使い道の説明が先だ。', '減税の財源をどうするのか。'],
    welfare: ['負担が現役世代に偏らないか心配だ。', '給付を増やすなら財源を示してほしい。'],
    health: ['医療費の負担が増えるのではないか。', '地域の病院が減らないか不安。'],
    childcare: ['財源が将来の負担にならないか。', '子どもがいない世帯との公平性はどうなる。'],
    education: ['効果が出るまで時間がかかる。優先順位は本当に正しい？', '現場の負担が増えないか。'],
    labor: ['企業の負担が増え、雇用が減るのではないか。', '働き方の多様さが失われないか。'],
    diplomacy: ['防衛費や負担が増えれば、福祉や教育にしわ寄せが来る。', '近隣国との緊張が高まるおそれはないか。'],
    constitution: ['拙速に進めるべきではない。国民的な議論が足りない。', '優先すべき課題は他にあるのでは。'],
    energy: ['電気代や安全面での不安が残る。', '移行期のコストは誰が負担するのか。'],
    environment: ['産業や雇用への影響が心配だ。', '規制が厳しすぎると、経済が冷え込む。'],
    agriculture: ['補助に頼るだけでは、産業として続かない。', '消費者の負担が増えないか。'],
    regional: ['公共事業のムダにならないか。', '都市部の負担ばかり増えるのは不公平だ。'],
    admin: ['現場が疲弊し、サービスが落ちないか。', '看板だけで中身が変わらないのでは。'],
    safety: ['監視や取り締まりが強まりすぎないか。', '自由や人権とのバランスが心配だ。'],
    digital: ['高齢者や不慣れな人が取り残されないか。', '個人情報の扱いが心配。'],
    disaster: ['お金をかけても、使い方に無駄はないか。', '財源は将来世代の負担になる。'],
    culture: ['税金を使うなら優先順位をつけてほしい。', '一部の業界だけが潤うのでは。'],
    society: ['社会の合意づくりが先ではないか。', '価値観が分かれる問題を、急ぎすぎでは。'],
  };
  function voices(g, polId) {
    const p = X.ensurePol(g);
    const pl = POLICIES[polId];
    if (!pl) return { pro: [], con: [], gain: [], lose: [] };
    const gains = segGain(g, p, polId, null);
    const sorted = Object.entries(gains).sort((a, b) => b[1] - a[1]);
    const gain = sorted.filter(([, v]) => v > 0.3).slice(0, 3).map(([s, v]) => ({ seg: s, name: SEG_SHORT[s] || s, v }));
    const lose = sorted.filter(([, v]) => v < -0.3).reverse().slice(0, 3).map(([s, v]) => ({ seg: s, name: SEG_SHORT[s] || s, v }));
    const pickLine = (arr, salt) => arr[Math.floor(hash01(polId, salt) * arr.length) % arr.length];
    const pro = (gain.length ? gain : [{ name: '会社員' }]).slice(0, 2).map((s, i) => ({ who: s.name, text: pickLine(PRO[pl.area] || PRO.economy, 7 + i) }));
    const con = (lose.length ? lose : [{ name: '無党派層' }]).slice(0, 2).map((s, i) => ({ who: s.name, text: pickLine(CON[pl.area] || CON.economy, 9 + i) }));
    const cost = costOfPledge(g, p, polId, null);
    if (cost > 3) con.push({ who: '財政に詳しい人', text: `年${Math.round(cost * 10) / 10}兆円の財源をどうするのか、示してほしい。` });
    return { pro, con, gain, lose };
  }

  // ---------------------------------------------------------------- 選挙予測 (seat projection)
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shugiOnce(g, p, fy, swing) {
    const year = Math.floor(fy);
    const R = X.shugiRules(year, p.flags);
    const A0 = p.cabinet.approval;
    p.cabinet.approval = clamp(num(A0, 45) + swing, 3, 95);
    let nat;
    try { nat = X.nationalShares(g, p, fy, 'shugi'); } finally { p.cabinet.approval = A0; }
    const coalition = (p.cabinet.partyIds || []).filter((id) => p.parties[id]);
    let seats = {};
    if (R.system === 'chusenkyoku') {
      const ind = Math.round(R.total * rnd(0.02, 0.04));
      seats = X.alloc(nat.share, R.total - ind, 1.25);
      seats[IND] = (seats[IND] || 0) + ind;
    } else {
      const bloc = { __coal: coalition.reduce((a, id) => a + num(nat.share[id]), 0) };
      for (const id of Object.keys(nat.share)) if (!coalition.includes(id)) bloc[id] = nat.share[id];
      const ind = Math.round(R.smd * rnd(0.01, 0.03));
      const bs = X.alloc(bloc, R.smd - ind, 1.8);
      const cs = {};
      for (const id of coalition) cs[id] = nat.share[id];
      const smd = { ...X.alloc(cs, bs.__coal || 0, 1.6), [IND]: ind };
      for (const [id, n] of Object.entries(bs)) if (id !== '__coal') smd[id] = (smd[id] || 0) + n;
      const pr = {};
      for (const b of X.prBlocks(R.pr, year)) {
        const v = {};
        for (const id of Object.keys(nat.share)) if (nat.share[id] > 0.006) v[id] = nat.share[id] * Math.exp(gauss() * 0.1);
        const dh = X.dhondt(v, b.seats);
        for (const [id, n] of Object.entries(dh)) pr[id] = (pr[id] || 0) + n;
      }
      for (const [id, n] of Object.entries(smd)) seats[id] = (seats[id] || 0) + n;
      for (const [id, n] of Object.entries(pr)) seats[id] = (seats[id] || 0) + n;
    }
    return { seats, share: nat.share, total: R.total };
  }
  function outlook(g, p, opts = {}) {
    const day = today(g);
    const key = `${day}:${Math.round(num(p.cabinet.approval))}:${Object.keys(p.parties).length}:${opts.runs || 0}`;
    if (p._outlook && p._outlook.key === key) return p._outlook.val;
    const nx = nextElectionDay(g, p);
    const daysTo = Math.max(0, nx.day - day);
    const fy = X.fyNow(g);
    const runs = opts.runs || 220;
    const sd = 1.6 + 5.5 * clamp(daysTo / 480, 0, 1); // pts of approval; the further away, the less certain
    const rand0 = Math.random;
    const rng = mulberry((day * 2654435761 + Math.round(num(p.cabinet.approval) * 10)) >>> 0);
    const parties = Object.keys(p.parties).filter((id) => id !== IND);
    const acc = Object.fromEntries([...parties, IND].map((id) => [id, []]));
    const vote = Object.fromEntries(parties.map((id) => [id, 0]));
    const ruling = (p.cabinet.partyIds || []).filter((id) => p.parties[id]);
    let majority = 0, twoThirds = 0, change = 0, coreFirst = 0, tot = 0;
    const core = pmPartyId(p);
    Math.random = rng;
    try {
      for (let i = 0; i < runs; i++) {
        const sw = gauss() * sd;
        const r = shugiOnce(g, p, fy, sw);
        tot = r.total;
        for (const id of parties) { acc[id].push(num(r.seats[id])); vote[id] += num(r.share[id]); }
        acc[IND].push(num(r.seats[IND]));
        const rs = ruling.reduce((a, id) => a + num(r.seats[id]), 0);
        if (rs > r.total / 2) majority++; else change++;
        if (rs >= (r.total * 2) / 3) twoThirds++;
        const maxOpp = Math.max(0, ...parties.filter((id) => !ruling.includes(id)).map((id) => num(r.seats[id])));
        if (num(r.seats[core]) >= maxOpp) coreFirst++;
      }
    } finally { Math.random = rand0; }
    const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(f * (s.length - 1))))]; };
    const rows = parties.map((id) => {
      const a = acc[id];
      return { id, name: p.parties[id].name, short: p.parties[id].short, color: p.parties[id].color, ruling: ruling.includes(id), median: q(a, 0.5), lo: q(a, 0.1), hi: q(a, 0.9), mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), share: Math.round((vote[id] / runs) * 1000) / 10, now: X.partySeats(p, id) };
    }).sort((a, b) => b.median - a.median);
    const rsum = [];
    for (let i = 0; i < acc[ruling[0] || parties[0]].length; i++) rsum.push(ruling.reduce((a, id) => a + acc[id][i], 0));
    const val = {
      day, daysTo, date: X.dateLabel(g, nx.day), scheduled: !!nx.id, total: tot, majority: Math.floor(tot / 2) + 1, runs, sd: Math.round(sd * 10) / 10, rows,
      ruling: { ids: ruling, median: q(rsum, 0.5), lo: q(rsum, 0.1), hi: q(rsum, 0.9), now: ruling.reduce((a, id) => a + X.partySeats(p, id), 0) },
      pMajority: Math.round((majority / runs) * 100), pTwoThirds: Math.round((twoThirds / runs) * 100), pChange: Math.round((change / runs) * 100), pCoreFirst: Math.round((coreFirst / runs) * 100),
      note: `いま総選挙があった場合の目安（${runs}回の模擬）。選挙が遠いほど幅は広い。`,
    };
    Object.defineProperty(p, '_outlook', { value: { key, val }, enumerable: false, configurable: true, writable: true });
    return val;
  }

  // ---------------------------------------------------------------- hooks and methods
  function onEnacted(g, p) { refreshStatus(g, p); }
  function pledgeAgenda(p, pid) {
    const S = PL(p);
    return S.list.filter((q) => q.party === pid && ['promised', 'progress'].includes(q.status)).sort((a, b) => b.prio - a.prio || a.deadline - b.deadline).map((q) => q.policy);
  }
  const methods = {
    manifesto(pid) { return manifesto(this, pid); },
    manifestoAll() { const p = X.ensurePol(this); return Object.values(p.parties).map((pt) => manifesto(this, pt.id)); },
    pledgeAdd(polId, params) { return pledgeAdd(this, X.ensurePol(this), polId, params); },
    pledgeRemove(id) { return pledgeRemove(this, X.ensurePol(this), id); },
    pledgePriority(id, prio) { return pledgePriority(this, X.ensurePol(this), id, prio); },
    pledgeParams(id, params) { return pledgeParams(this, X.ensurePol(this), id, params); },
    pledgeBreakPreview(id, how) { return breakPreview(this, X.ensurePol(this), id, how); },
    pledgeBreak(id, how) { return pledgeBreak(this, X.ensurePol(this), id, how); },
    pledgeBill(id) { return pledgeToBill(this, X.ensurePol(this), id); },
    pledgePropose(polId) { return pledgePropose(this, X.ensurePol(this), polId); },
    pledgeProposeOdds(polId) { return proposeOdds(this, X.ensurePol(this), polId); },
    pledgeVoices(polId) { return voices(this, polId); },
    pledgeScoreboard() { const p = X.ensurePol(this); return { cred: { ...PL(p).cred }, hist: PL(p).hist.slice(0, 8) }; },
    seatProjection(opts = {}) { const p = X.ensurePol(this); try { return outlook(this, p, opts); } catch (e) { console.error(e); return null; } },
  };
  H.pledge = { PL, ensureAll, pledgeTick, onElectionDone, onEnacted, pledgeAgenda, manifesto, outlook, refreshStatus };
  H.methods = { ...H.methods, ...methods };
  return H;
}
