// 法律制定 (legislation) — the bill-drafting studio's engine and the legislation record, agent R5-D. Installed by politics.js
// (installLaw(X)); state: g.state.politics.intra.legis (the record of closed bills; the Diet drops closed bills after 60 days).
//
// g.billOutlook(policy, params, plan) -> the studio's numbers for a bill that does not exist yet: cost / revenue and what it is
//   worth in 消費税 points, who gains and loses (segments, weighted), the coalition math (each party's expected 賛成 share, the
//   two houses' expected yes/no, the chance to pass each house, the 衆院 re-vote (3分の2) when the 参院 refuses, the chance the
//   ruling side holds a member bill in committee (つるし)), the 与党事前審査 odds for a ruling member's bill, the timetable against
//   the session, and the plan's effect on all of that. plan = { amend: partyId, kokutai: { partyId: units }, futai: bool,
//   strategy: 'speed'|'normal'|'careful'|'hearing', prelobby: n }.
// g.proposeBillPlanned({ policy, params, plan }) -> bill id | null : proposeBill, then the plan is paid and applied.
// g.billTactics(billId) / g.billTactic(billId, kind, opts): the same tactics for a bill already before the Diet
//   (国会対策・修正協議・付帯決議・委員会の進め方・事前審査のはたらきかけ).
// g.legislationHistory() -> { mine, laws, stats }: the player's bills and laws ("my laws"), the laws in force.
// The tactics work through bill.lobby { partyId: +bonus }, which politics.js partyStance adds to a party's alignment.

export function installLaw(X) {
  const H = X.H;
  const { clamp, num, rnd, irnd, gauss, POLICIES, POLICY_AREAS, SEGMENTS, SEGMENT_ORDER, YEAR_DAYS, POSTS } = X;
  const { I, U, pay, fundsOf, npcName, myParty, roleOf, pmPartyId, today } = H;
  const IND = 'ind';
  const SEG_SHORT = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁業', unions: '労働組合', urban: '都市住民', rural: '地方住民', floating: '無党派層' };
  const ECO = { growth: '成長率', inflation: '物価', unemployment: '失業率', yen: '円相場', nikkei: '株価' };
  const pct = (v) => Math.round(clamp(v, 0, 1) * 100);
  const inCab = (p) => p.me.posts.some((x) => POSTS[x] && POSTS[x].kind === 'cabinet');
  const isNat = (me) => me.office === 'shugi' || me.office === 'sangi';
  const ruling = (p, id) => (p.cabinet.partyIds || []).includes(id);

  // ---------------------------------------------------------------- lobby from a plan
  const STRAT = {
    speed: { name: '早く採決する', desc: '審議を急ぐ。会期には間に合いやすいが、野党は反発する（賛成の見込み↓）', days: -2, opp: -0.04, approval: -0.4 },
    normal: { name: '通常の審議', desc: '標準的な進め方', days: 0, opp: 0, approval: 0 },
    careful: { name: '丁寧に審議する', desc: '時間をかけて質疑を重ねる。野党の理解は得やすいが、日程は延びる', days: 4, opp: 0.05, approval: 0.3 },
    hearing: { name: '公聴会・参考人質疑を開く', desc: '専門家や関係者の意見を聴く。反対が和らぐが、日程が延びる', days: 2, opp: 0.03, approval: 0.2 },
  };
  function lobbyOf(g, p, bill, plan) {
    const lob = {};
    const add = (id, v) => { lob[id] = Math.round((num(lob[id]) + v) * 1000) / 1000; };
    const parties = Object.keys(p.parties);
    if (plan.kokutai) {
      for (const [id, u] of Object.entries(plan.kokutai)) if (p.parties[id] && u > 0) add(id, Math.min(0.16, 0.055 * u));
    }
    if (plan.amend && p.parties[plan.amend]) {
      add(plan.amend, 0.14);
      for (const id of parties) {
        if (id === plan.amend || ruling(p, id)) continue;
        const al = X.alignment(p, id, bill.policy);
        if (al >= 0.45 && al < 0.65) add(id, 0.03);
      }
    }
    if (plan.futai) for (const id of parties) { if (ruling(p, id)) continue; const al = X.alignment(p, id, bill.policy); if (al >= 0.4 && al < 0.7) add(id, 0.06); }
    const S = STRAT[plan.strategy || 'normal'] || STRAT.normal;
    if (S.opp) for (const id of parties) { if (ruling(p, id)) continue; const al = X.alignment(p, id, bill.policy); if (al >= 0.35 && al < 0.72) add(id, S.opp); }
    return lob;
  }
  function mergeLobby(a, b) { const o = { ...(a || {}) }; for (const [k, v] of Object.entries(b || {})) o[k] = Math.round((num(o[k]) + v) * 1000) / 1000; return o; }

  // ---------------------------------------------------------------- the passage simulation
  function houseSim(p, bill, house, runs, twoThirdsOfAll = false) {
    const Hs = p.diet[house];
    const total = num(Hs.total);
    const ys = [];
    let pass = 0;
    for (let i = 0; i < runs; i++) {
      const b = { ...bill, bloc: {} };
      let yes = 0, no = 0;
      for (const [id, n0] of Object.entries(Hs.seats)) {
        const n = num(n0);
        if (n <= 0) continue;
        const s = id === IND ? 0.5 : X.partyStance(p, id, b);
        const ab = Math.round(n * rnd(0, 0.03));
        const y = Math.round((n - ab) * clamp(s + gauss() * 0.02, 0, 1));
        yes += y; no += n - ab - y;
      }
      ys.push(yes);
      const need = twoThirdsOfAll ? Math.ceil((total * 2) / 3) : Math.floor((yes + no) / 2) + 1;
      if (yes >= need) pass++;
    }
    ys.sort((a, b) => a - b);
    return { total, pass: pass / runs, yes: ys[Math.floor(ys.length / 2)], lo: ys[Math.floor(ys.length * 0.1)], hi: ys[Math.floor(ys.length * 0.9)], need: twoThirdsOfAll ? Math.ceil((total * 2) / 3) : Math.floor(total / 2) + 1 };
  }
  function passage(g, p, bill, first, runs = 90) {
    const second = first === 'shugi' ? 'sangi' : 'shugi';
    const amend = bill.kind === 'amendment';
    let ok = 0, override = 0, firstOk = 0, secondOk = 0;
    const y1 = [], y2 = [];
    for (let i = 0; i < runs; i++) {
      const sim = (h, all) => {
        const Hs = p.diet[h];
        const b = { ...bill, bloc: {} };
        let yes = 0, no = 0;
        for (const [id, n0] of Object.entries(Hs.seats)) {
          const n = num(n0);
          if (n <= 0) continue;
          const s = id === IND ? 0.5 : X.partyStance(p, id, b);
          const ab = Math.round(n * rnd(0, 0.03));
          const y = Math.round((n - ab) * clamp(s + gauss() * 0.02, 0, 1));
          yes += y; no += n - ab - y;
        }
        const need = all ? Math.ceil((num(Hs.total) * 2) / 3) : Math.floor((yes + no) / 2) + 1;
        return { yes, no, ok: yes >= need };
      };
      const a = sim(first, amend);
      y1.push(a.yes);
      if (!a.ok) continue;
      firstOk++;
      const b2 = sim(second, amend);
      y2.push(b2.yes);
      if (b2.ok) { ok++; secondOk++; continue; }
      if (!amend && bill.kind === 'law' && first === 'shugi') {
        // 衆院の再可決: 出席議員の3分の2
        const need = Math.ceil(((a.yes + a.no) * 2) / 3);
        if (a.yes >= need) { ok++; override++; }
      }
    }
    y1.sort((x, y) => x - y); y2.sort((x, y) => x - y);
    return { pass: ok / runs, first: firstOk / runs, second: firstOk ? secondOk / runs : 0, override: override / runs, yes1: y1[Math.floor(y1.length / 2)] || 0, yes2: y2[Math.floor(y2.length / 2)] || 0 };
  }

  // ---------------------------------------------------------------- timetable
  function nextSessionIn(g, p) {
    const d = X.polDate(g);
    const doy = d.doy;
    const S = p.diet.session;
    if (S && today(g) >= S.start && today(g) <= S.end) return 0;
    if (p.diet.shugi.dissolved) return null;
    const cands = [2];
    if (num(p.flags.extraYear) < d.year) cands.push(88);
    let best = null;
    for (const c of cands) if (c > doy) best = best == null ? c - doy : Math.min(best, c - doy);
    if (best == null) best = YEAR_DAYS - doy + 2;
    return best;
  }
  function timetable(g, p, bill, firstHouse, plan) {
    const day = today(g);
    const S = p.diet.session;
    const inS = S && day >= S.start && day <= S.end;
    const st = STRAT[plan.strategy || 'normal'] || STRAT.normal;
    const draft = bill.sponsor === 'member';
    const days = Math.max(6, Math.round(4.5 + 1 + 4.5 + 1 + st.days + (plan.amend ? 2 : 0)));
    const wait = inS ? 0 : nextSessionIn(g, p);
    const left = inS ? S.end - day : null;
    let fit = null;
    if (inS) fit = clamp((left - (days - 3)) / 8, 0, 1);
    else if (wait != null) fit = 0.9;
    let slot = null;
    if (S) {
      const cap = S.kind === '通常国会' ? { cabinet: 8, member: 3 } : S.kind === '臨時国会' ? { cabinet: 4, member: 1 } : { cabinet: 2, member: 1 };
      const k = bill.sponsor === 'cabinet' ? 'cabinet' : 'member';
      const used = num(S.floor && S.floor[k]);
      slot = { used, cap: cap[k], left: Math.max(0, cap[k] - used) };
    }
    return { days, wait, sessionLeft: left, inSession: !!inS, sessionKind: S ? S.kind : null, fit, slot, enactDay: day + (wait || 0) + days + (draft ? 3 : 0) };
  }

  // ---------------------------------------------------------------- the outlook (studio numbers)
  function previewBill(g, p, polId, params, plan = {}, existing = null) {
    const pl = POLICIES[polId];
    if (!pl) return null;
    const year = X.polDate(g).year;
    const fy = X.fyNow(g);
    const pr = X.sanitizeParams(pl, params);
    const ctx = X.ctxOf(p, year);
    const fx = pl.effects(pr, p.era, ctx);
    const cost = pl.costOf(pr, ctx);
    const me = p.me;
    const cabinetBill = existing ? existing.sponsor === 'cabinet' : inCab(p) && pl.kind !== 'amendment';
    const pmParty = X.cabinetPartyOfPM(p);
    const sponsorParty = existing ? existing.party : cabinetBill ? pmParty : me.party || IND;
    const kind = existing ? existing.kind : pl.billKind || pl.kind || 'law';
    const bill = { sponsor: cabinetBill ? 'cabinet' : 'member', policy: polId, party: sponsorParty, kind, rebel: existing && existing.rebel ? existing.rebel : {}, lobby: {} };
    bill.lobby = mergeLobby(existing ? existing.lobby : null, lobbyOf(g, p, bill, plan));
    const first = cabinetBill || !isNat(me) ? 'shugi' : me.office;
    const sim = passage(g, p, bill, first, 80);
    // the parties
    const parties = Object.keys(p.parties).map((id) => {
      let acc = 0;
      for (let i = 0; i < 12; i++) acc += X.partyStance(p, id, { ...bill, bloc: {} });
      const yes = acc / 12;
      const seats = X.partySeats(p, id);
      return { id, name: p.parties[id].name, short: p.parties[id].short, color: p.parties[id].color, ruling: ruling(p, id), seats, yes: pct(yes), stance: yes >= 0.7 ? '賛成' : yes >= 0.35 ? '割れる' : '反対', lobby: num(bill.lobby[id]), al: Math.round(X.alignment(p, id, polId) * 100) / 100 };
    }).sort((a, b) => b.seats - a.seats);
    // the 衆院 / 参院 numbers
    const houses = ['shugi', 'sangi'].map((h) => {
      const hs = houseSim(p, bill, h, 60, kind === 'amendment');
      return { house: h, name: h === 'shugi' ? '衆議院' : '参議院', total: hs.total, need: hs.need, yes: hs.yes, lo: hs.lo, hi: hs.hi, pass: pct(hs.pass) };
    });
    // 与党事前審査 (a ruling member's bill) and つるし (an opposition bill held in committee)
    let review = null, held = null;
    if (!cabinetBill && me.party && isNat(me)) {
      const pt = p.parties[me.party];
      const al = X.alignment(p, me.party, polId);
      if (ruling(p, me.party) && pt && pt.leader !== 'player') {
        const post = me.posts.some((x) => POSTS[x] && (POSTS[x].kind === 'party' || POSTS[x].kind === 'cabinet'));
        const govt = X.isGovtMatter(p, pl, year);
        const base = ((al - 0.55) * 3 + (num(me.standing) - 50) / 100 + (post ? 0.15 : 0)) * (govt ? 0.5 : 1);
        const bonus = num(existing && existing.reviewBonus) + 0.08 * num(plan.prelobby);
        review = { odds: pct(clamp(base + bonus, 0.05, 0.9)), al: Math.round(al * 100) / 100, govt, post, standing: Math.round(num(me.standing)), bonus: Math.round(bonus * 100) / 100, note: govt ? '政府の方針に沿う政策は「閣法で」と言われやすい' : '部会→政調会→総務会の順に了承が要る' };
      } else if (!ruling(p, me.party) && (p.cabinet.partyIds || []).reduce((a, id) => a + num(p.diet[first].seats[id]), 0) > p.diet[first].total / 2) {
        const al2 = (p.cabinet.partyIds || []).reduce((a, id) => Math.max(a, X.alignment(p, id, polId)), 0);
        held = { odds: pct(al2 < 0.7 ? 0.85 : 0.5), note: '与党が過半数だと、野党の法案は委員会で審議されない（つるし）ことが多い' };
      }
    }
    const tt = timetable(g, p, bill, first, plan);
    const need = pl.kind === 'amendment' ? (first === 'shugi' ? 100 : 50) : first === 'shugi' ? (cost > 0 ? 50 : 20) : (cost > 0 ? 20 : 10);
    // who gains and loses
    const W = X.segWeights(year);
    const segs = SEGMENT_ORDER.map((s) => ({ seg: s, name: SEG_SHORT[s] || s, v: Math.round(num(fx.segments[s]) * 10) / 10, w: Math.round(W[s] * 100) })).sort((a, b) => b.v - a.v);
    const net = Math.round(SEGMENT_ORDER.reduce((a, s) => a + W[s] * num(fx.segments[s]), 0) * 10) / 10;
    const E = p.economy;
    const perPct = 2.6 * (num(E.gdp, 600) / 600);
    const spending = num(E.budget && E.budget.spending, 100);
    const eco = Object.entries(fx.economy || {}).filter(([k, v]) => ECO[k] && Math.abs(num(v)) >= 0.01).map(([k, v]) => ({ k, name: ECO[k], v: Math.round(num(v) * 100) / 100 }));
    // the plan's cost
    const U1 = U(p);
    const planCost = { money: 0, stamina: 0 };
    if (plan.kokutai) for (const u of Object.values(plan.kokutai)) planCost.money += 2 * U1 * num(u);
    if (plan.amend) planCost.stamina += 6;
    if (plan.futai) planCost.stamina += 3;
    if (plan.prelobby) { planCost.stamina += 5 * num(plan.prelobby); planCost.money += U1 * num(plan.prelobby); }
    const passAll = clamp(sim.pass * (held ? 1 - held.odds / 100 : 1) * (review ? review.odds / 100 : 1), 0, 1);
    return {
      id: polId, name: pl.name, area: pl.area, areaName: (POLICY_AREAS[pl.area] || {}).name, kind, billKind: pl.billKind || pl.kind, desc: pl.desc, params: pr, paramDefs: (pl.params || []).map((d) => ({ ...d })), title: X.billTitle(pl, pr),
      sponsor: bill.sponsor, sponsorName: cabinetBill ? '内閣（閣法）' : '議員立法', first, firstName: first === 'shugi' ? '衆議院' : '参議院', need,
      block: X.policyBlockFor(p, polId, pr, g),
      fiscal: { cost, perPct: Math.round(perPct * 10) / 10, taxEq: Math.round((Math.abs(cost) / perPct) * 10) / 10, ofBudget: Math.round((Math.abs(cost) / Math.max(1, spending)) * 1000) / 10, kind: cost > 0 ? 'spend' : cost < 0 ? 'revenue' : 'none', label: cost > 0 ? `年${Math.round(cost * 10) / 10}兆円の支出（財源が要る）` : cost < 0 ? `年${Math.round(-cost * 10) / 10}兆円の財源` : '大きな財政負担はない', deficitNow: Math.round(num(E.budget && E.budget.deficit) * 10) / 10 },
      segs, net, eco, parties, houses, sim: { pass: pct(sim.pass), first: pct(sim.first), second: pct(sim.second), override: pct(sim.override), yes1: sim.yes1, yes2: sim.yes2 }, review, held, passAll: pct(passAll), timetable: tt,
      ministry: pl.ministry || null, lobby: bill.lobby, plan: { ...plan }, planCost, strategies: Object.entries(STRAT).map(([id, v]) => ({ id, ...v })),
    };
  }
  // the tactics, each with the change it makes to the chance to pass
  function tacticList(g, p, polId, params, plan, existing) {
    const base = previewBill(g, p, polId, params, plan, existing);
    if (!base) return { base: null, tactics: [] };
    const tactics = [];
    const ops = base.parties.filter((q) => !q.ruling && q.seats >= 5);
    const U1 = U(p);
    const delta = (pl2) => {
      const v = previewBill(g, p, polId, params, pl2, existing);
      return v ? { passAll: v.passAll, sim: v.sim.pass } : null;
    };
    const rank = ops.slice().sort((a, b) => Math.abs(b.al - 0.55) - Math.abs(a.al - 0.55));
    // 国会対策 (per party, 1-3 units)
    const kt = ops.filter((q) => q.al >= 0.35 && q.al < 0.75).sort((a, b) => b.seats - a.seats).slice(0, 3);
    for (const q of kt) {
      const have = num(plan.kokutai && plan.kokutai[q.id]);
      const d = delta({ ...plan, kokutai: { ...(plan.kokutai || {}), [q.id]: have + 1 } });
      tactics.push({ id: 'kokutai', party: q.id, partyName: q.short, name: `国会対策：${q.short}に根回し`, desc: `${q.short}の国対と協議して賛成を取りつける（${have ? `${have}回目まで実施・` : ''}1回ごとに${(2 * U1 / 1000000).toFixed(0)}万円分の接待・調整費）`, cost: `${X.fmtMoney(2 * U1)}・体力4`, money: 2 * U1, stamina: 4, gain: d ? d.passAll - base.passAll : null, limit: have >= 3, why: have >= 3 ? 'これ以上は効かない（3回まで）' : null });
    }
    for (const q of rank.filter((x) => x.al >= 0.4 && x.al < 0.66).slice(0, 2)) {
      if (plan.amend) break;
      const d = delta({ ...plan, amend: q.id });
      tactics.push({ id: 'amend', party: q.id, partyName: q.short, name: `修正協議：${q.short}の主張を取り入れる`, desc: `${q.short}と案文を協議し、数字を譲る。賛成は増えるが、法律の効果は弱まる`, cost: '体力6', stamina: 6, money: 0, gain: d ? d.passAll - base.passAll : null, why: null });
    }
    if (!plan.futai) { const d = delta({ ...plan, futai: true }); tactics.push({ id: 'futai', name: '付帯決議を付ける', desc: '「運用に当たって○○に配慮すること」という決議を添える。法的拘束力はないが、野党の理解を得やすい', cost: '体力3', stamina: 3, money: 0, gain: d ? d.passAll - base.passAll : null, why: null }); }
    for (const [id, S2] of Object.entries(STRAT)) {
      if ((plan.strategy || 'normal') === id) continue;
      const d = delta({ ...plan, strategy: id });
      tactics.push({ id: 'strategy', mode: id, name: `委員会の進め方：${S2.name}`, desc: S2.desc, cost: '', stamina: 0, money: 0, gain: d ? d.passAll - base.passAll : null, why: null, days: S2.days });
    }
    if (base.review) {
      tactics.push({ id: 'prelobby', name: '事前審査の根回し（部会長・政調に足を運ぶ）', desc: '与党の部会・政調会・総務会の了承を得やすくする（1回ごとに成功率+8%）', cost: `${X.fmtMoney(U1)}・体力5`, stamina: 5, money: U1, gain: null, odds: base.review.odds, why: num(plan.prelobby) >= 3 ? 'これ以上は効かない' : null });
    }
    return { base, tactics };
  }

  // ---------------------------------------------------------------- applying a plan to a real bill
  function applyPlan(g, p, b, plan, notes) {
    const out = notes || [];
    const U1 = U(p);
    b.tactics = b.tactics || { kokutai: {}, amend: null, futai: false, strategy: 'normal', prelobby: 0 };
    const T = b.tactics;
    const pl = POLICIES[b.policy];
    const day = today(g);
    // 国会対策
    if (plan.kokutai) {
      for (const [id, u] of Object.entries(plan.kokutai)) {
        const prev = num(T.kokutai[id]);
        const add = Math.max(0, Math.min(3, num(u)) - prev);
        for (let i = 0; i < add; i++) {
          if (!pay(g, p, 2 * U1)) { out.push(`${p.parties[id] ? p.parties[id].short : ''}への根回しは、お金が足りずにできなかった。`); break; }
          g.state.stamina = Math.max(0, g.state.stamina - 4);
          const al = X.alignment(p, id, b.policy);
          const win = Math.random() < clamp(0.62 + (al - 0.5) * 0.8 + (num(p.me.standing) - 40) / 400, 0.3, 0.92);
          T.kokutai[id] = prev + i + 1;
          b.lobby = mergeLobby(b.lobby, { [id]: win ? 0.055 : 0.015 });
          out.push(win ? `${p.parties[id].short}の国対と話がついた。「前向きに検討する」との感触。` : `${p.parties[id].short}の国対は渋い反応だった。`);
          b.log.push({ day, text: `国会対策：${p.parties[id].short}と協議` });
        }
      }
    }
    if (plan.amend && !T.amend && p.parties[plan.amend]) {
      g.state.stamina = Math.max(0, g.state.stamina - 6);
      T.amend = plan.amend;
      b.lobby = mergeLobby(b.lobby, lobbyOf(g, p, b, { amend: plan.amend }));
      softenParams(g, p, b, pl);
      out.push(`${p.parties[plan.amend].short}と修正協議を行い、案文を一部修正した（効果は弱まる）。`);
      b.log.push({ day, text: `${p.parties[plan.amend].short}との修正協議で案文を修正` });
    }
    if (plan.futai && !T.futai) {
      g.state.stamina = Math.max(0, g.state.stamina - 3);
      T.futai = true;
      b.lobby = mergeLobby(b.lobby, lobbyOf(g, p, b, { futai: true }));
      out.push('付帯決議の案を野党にも示した。');
      b.log.push({ day, text: '付帯決議を付ける方針' });
    }
    if (plan.strategy && plan.strategy !== T.strategy) {
      const S0 = STRAT[T.strategy || 'normal'] || STRAT.normal;
      const S1 = STRAT[plan.strategy] || STRAT.normal;
      b.lobby = mergeLobby(b.lobby, lobbyOf(g, p, b, { strategy: plan.strategy }));
      b.lobby = mergeLobby(b.lobby, Object.fromEntries(Object.entries(lobbyOf(g, p, b, { strategy: T.strategy || 'normal' })).map(([k, v]) => [k, -v])));
      b.next = num(b.next, day) + (S1.days - S0.days);
      T.strategy = plan.strategy;
      b.approvalLift = S1.approval;
      out.push(`委員会は「${S1.name}」で進める。`);
      b.log.push({ day, text: `委員会の進め方：${S1.name}` });
    }
    if (plan.prelobby && b.review && !b.review.done) {
      const n = Math.min(3, num(plan.prelobby));
      const add = Math.max(0, n - num(T.prelobby));
      for (let i = 0; i < add; i++) { if (!pay(g, p, U1)) break; g.state.stamina = Math.max(0, g.state.stamina - 5); b.reviewBonus = num(b.reviewBonus) + 0.08; T.prelobby = num(T.prelobby) + 1; }
      if (add) out.push('党の部会・政調に足を運び、根回しをした。');
    }
    return out;
  }
  function softenParams(g, p, b, pl) {
    if (!pl || !pl.params) return;
    const ctx = X.ctxOf(p, X.polDate(g).year);
    const np = { ...b.params };
    for (const d of pl.params) {
      const step = d.step || 1;
      const k = Math.max(1, Math.round(((d.max - d.min) * 0.12) / step));
      const a = clamp(num(np[d.key], d.def) - step * k, d.min, d.max), c = clamp(num(np[d.key], d.def) + step * k, d.min, d.max);
      const ca = Math.abs(pl.costOf({ ...np, [d.key]: a }, ctx)), cc = Math.abs(pl.costOf({ ...np, [d.key]: c }, ctx));
      const cur = Math.abs(pl.costOf(np, ctx));
      const pick = ca <= cc ? a : c;
      if (Math.min(ca, cc) < cur - 1e-9 || Math.abs(pick - num(np[d.key], d.def)) > 0) np[d.key] = Math.round(pick * 100) / 100;
    }
    const autoTitle = b.title === X.billTitle(pl, b.params);
    b.params = np;
    b.cost = pl.costOf(np, ctx);
    if (autoTitle) b.title = X.billTitle(pl, np);
  }

  // ---------------------------------------------------------------- history
  function record(g, p) {
    const S = I(p);
    const have = new Set(S.legis.map((r) => r.id));
    for (const b of p.diet.bills) {
      if (!['enacted', 'rejected', 'shelved'].includes(b.stage) || have.has(b.id)) continue;
      if (b.kind === 'noconfidence') continue;
      if (b.kind === 'budget' && !b.policy) continue;
      const mineB = b.by === 'player';
      S.legis.push({ id: b.id, title: b.title, policy: b.policy, by: mineB ? 'player' : (b.by && b.by !== 'player' ? npcName(p, g, b.by) : ''), party: b.party || null, sponsor: b.sponsor, kind: b.kind, created: b.created, closed: num(b.closed, today(g)), outcome: b.stage, result: b.result || '', votes: b.votes ? JSON.parse(JSON.stringify(b.votes)) : {}, cost: num(b.cost), mine: mineB, tactics: b.tactics ? { kokutai: Object.keys(b.tactics.kokutai || {}).length, amend: !!b.tactics.amend, futai: !!b.tactics.futai } : null });
    }
    if (S.legis.length > 120) S.legis.splice(0, S.legis.length - 120);
  }
  function history(g) {
    const p = X.ensurePol(g);
    record(g, p);
    const S = I(p);
    const outcomeName = { enacted: '成立', rejected: '否決', shelved: '廃案・見送り' };
    const mineRec = S.legis.filter((r) => r.mine).map((r) => ({ ...r, outcomeName: outcomeName[r.outcome] || r.outcome, name: POLICIES[r.policy] ? POLICIES[r.policy].name : r.title, date: X.dateLabel(g, r.closed) }));
    const pend = p.diet.bills.filter((b) => b.by === 'player' && !['enacted', 'rejected', 'shelved'].includes(b.stage)).map((b) => ({ id: b.id, title: b.title, policy: b.policy, sponsor: b.sponsor, outcome: 'pending', outcomeName: b.stage === 'draft' ? '準備中' : '審議中', mine: true, created: b.created, closed: null, date: '', name: POLICIES[b.policy] ? POLICIES[b.policy].name : b.title, votes: b.votes, stage: b.stage }));
    const mine = [...pend, ...mineRec.slice().reverse()];
    const laws = (p.laws || []).slice().reverse().map((l) => {
      const byMe = l.by === 'player';
      return { id: l.id, title: l.title, policy: l.policy, area: l.area, areaName: (POLICY_AREAS[l.area] || {}).name, day: l.day, date: X.dateLabel(g, l.day), by: byMe ? 'あなた' : l.by ? npcName(p, g, l.by) : '', byMe, party: l.party || null, partyName: l.party && p.parties[l.party] ? p.parties[l.party].short : '', sponsor: l.sponsor === 'cabinet' ? '閣法' : '議員立法', cost: num(l.cost), lasting: l.lasting, age: Math.max(0, today(g) - num(l.day)), effects: Object.entries(l.economy || {}).filter(([k, v]) => ECO[k] && Math.abs(num(v)) >= 0.01).map(([k, v]) => `${ECO[k]}${num(v) > 0 ? '↑' : '↓'}`).join(' ') };
    });
    const mineLaws = laws.filter((l) => l.byMe);
    const enacted = mineRec.filter((r) => r.outcome === 'enacted').length;
    const rejected = mineRec.filter((r) => r.outcome === 'rejected').length;
    const shelved = mineRec.filter((r) => r.outcome === 'shelved').length;
    const proposed = enacted + rejected + shelved + pend.length;
    return { mine, laws, mineLaws, stats: { proposed, enacted, rejected, shelved, pending: pend.length, rate: proposed ? Math.round((enacted / Math.max(1, enacted + rejected + shelved)) * 100) : 0, lawsInForce: laws.length, cabinetLaws: laws.filter((l) => l.sponsor === '閣法').length }, record: S.legis.length };
  }

  const methods = {
    billOutlook(policyId, params, plan) { const p = X.ensurePol(this); try { return previewBill(this, p, policyId, params, plan || {}, null); } catch (e) { console.error(e); return null; } },
    billPlanOptions(policyId, params, plan) { const p = X.ensurePol(this); try { return tacticList(this, p, policyId, params, plan || {}, null); } catch (e) { console.error(e); return { base: null, tactics: [] }; } },
    proposeBillPlanned(def = {}) {
      const p = X.ensurePol(this);
      const plan = def.plan || {};
      const id = this.proposeBill({ policy: def.policy, params: def.params, title: def.title });
      if (!id) return null;
      const b = p.diet.bills.find((x) => x.id === id);
      const notes = [];
      if (b && plan && Object.keys(plan).length) applyPlan(this, p, b, plan, notes);
      this.lastPlanNotes = notes;
      return id;
    },
    billTactics(billId) {
      const p = X.ensurePol(this);
      const b = p.diet.bills.find((x) => x.id === billId);
      if (!b || !b.policy) return null;
      const T = b.tactics || { kokutai: {}, amend: null, futai: false, strategy: 'normal', prelobby: 0 };
      const plan = { kokutai: { ...T.kokutai }, amend: T.amend || null, futai: !!T.futai, strategy: T.strategy || 'normal', prelobby: num(T.prelobby) };
      const ex = { sponsor: b.sponsor, party: b.party, kind: b.kind, rebel: b.rebel, lobby: {}, reviewBonus: b.reviewBonus };
      // the lobby already in force is the baseline; a plan only adds
      const L = tacticList(this, p, b.policy, b.params, {}, { ...ex, lobby: b.lobby || {} });
      return { bill: { id: b.id, title: b.title, stage: b.stage, house: b.house, mine: b.by === 'player', sponsor: b.sponsor, params: b.params }, plan, base: L.base, tactics: L.tactics, closed: ['enacted', 'rejected', 'shelved'].includes(b.stage) };
    },
    billTactic(billId, kind, opts = {}) {
      const p = X.ensurePol(this);
      const b = p.diet.bills.find((x) => x.id === billId);
      if (!b) return { ok: false, why: 'その法案はない' };
      if (['enacted', 'rejected', 'shelved'].includes(b.stage)) return { ok: false, why: 'その法案はもう決着している' };
      if (b.by !== 'player' && !inCab(p) && !(isNat(p.me) && b.party === p.me.party)) return { ok: false, why: '自分の法案か、自分の党・内閣の法案でないと、手を打てない' };
      if (this.state.stamina < 3) return { ok: false, why: '体力が足りない' };
      const before = previewBill(this, p, b.policy, b.params, {}, { sponsor: b.sponsor, party: b.party, kind: b.kind, rebel: b.rebel, lobby: b.lobby || {}, reviewBonus: b.reviewBonus });
      const T = b.tactics = b.tactics || { kokutai: {}, amend: null, futai: false, strategy: 'normal', prelobby: 0 };
      const plan = {};
      if (kind === 'kokutai') { if (!opts.party) return { ok: false, why: '相手の党を選ぶ' }; if (num(T.kokutai[opts.party]) >= 3) return { ok: false, why: 'これ以上は効かない（3回まで）' }; plan.kokutai = { [opts.party]: num(T.kokutai[opts.party]) + 1 }; }
      else if (kind === 'amend') { if (T.amend) return { ok: false, why: 'すでに修正協議を行った' }; plan.amend = opts.party; }
      else if (kind === 'futai') { if (T.futai) return { ok: false, why: 'すでに付帯決議の方針を示した' }; plan.futai = true; }
      else if (kind === 'strategy') { plan.strategy = opts.mode; }
      else if (kind === 'prelobby') { if (!b.review || b.review.done) return { ok: false, why: '事前審査はもう終わった' }; plan.prelobby = num(T.prelobby) + 1; }
      else return { ok: false, why: 'その手はない' };
      const notes = [];
      const m0 = fundsOf(this, p);
      applyPlan(this, p, b, plan, notes);
      const after = previewBill(this, p, b.policy, b.params, {}, { sponsor: b.sponsor, party: b.party, kind: b.kind, rebel: b.rebel, lobby: b.lobby || {}, reviewBonus: b.reviewBonus });
      return { ok: true, text: notes.join('\n') || '手を打った。', before: before ? before.passAll : null, after: after ? after.passAll : null, spent: m0 - fundsOf(this, p) };
    },
    legislationHistory() { try { return history(this); } catch (e) { console.error(e); return null; } },
  };
  H.law = { record, history, applyPlan, previewBill };
  H.methods = { ...H.methods, ...methods };
  return H;
}
