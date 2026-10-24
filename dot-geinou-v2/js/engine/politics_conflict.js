// 内部紛争・イベント・外交スタンス (agent R5-D, engine part 2). Extends politics_intra.js (X.H); installed by
// politics.js (installConflict(X)). Generic NPC politics: fictional factions and people only; the topics of every
// dispute are policy or personnel (no misconduct is attributed to anyone; real parties get only neutral topics).
//
// Conflicts: 政策対立 / 公認をめぐる対立 / 責任論 / 連立内の摩擦 / 世代間の対立 / 地域間の対立 / 造反, with the escalation ladder
//   不満 → 公然批判 → 造反 → 分裂・離党, heat 0..100 (25 / 50 / 75 / 100), mediation options with odds and consequences
//   (seats, standing, approval, coalition collapse).
// Events: decisions the player is asked to make (succession, demands, poaching, 密室の協議, following a split, a minority
//   government). Rate-limited: at most 3 pending, each with a deadline and a default.
// Stances: 親中派 / 対中強硬派 / 親米派 / 親ロ派 / 自主外交派 … as a vector for factions, parties, politicians and the player.
//   Reads R5-C's g.foreignStance(kind, id) / g.worldStanceEffect(vec) when they exist; otherwise a local fallback.

export function installConflict(X) {
  const H = X.H;
  const { clamp, num, rnd, irnd, pickOne, gauss, POLICIES, SEGMENTS, SEGMENT_ORDER, PARTY_DEFS, POSTS } = X;
  const { I, nid, U, pay, fundsOf, quiet, newsQ, logLine, hash01, npcOf, npcName, factionsOf, findFaction, fxOf, roleOf, myParty, isPMParty, pmPartyId, leaderFaction, today } = H;
  const IND = 'ind';
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const fmt = (n) => X.fmtMoney(n);

  // ---------------------------------------------------------------- approval helper
  function approvalShift(g, p, d, text, reason = 'policy') {
    if (!d) return;
    p.cabinet.mood = clamp(num(p.cabinet.mood) + d, -20, 20);
    if (typeof g.approvalNote === 'function') { try { g.approvalNote(reason, Math.round(d * 10) / 10, text, { applied: true }); } catch (e) { /* ignore */ } }
  }
  function partySupportShift(p, pid, d) { if (p.parties[pid]) X.addSupportAll(p, pid, d); }

  // ================================================================ events (decisions)
  function pushEvent(g, p, def) {
    const S = I(p);
    const pending = S.events.filter((e) => !e.answered);
    if (pending.length >= 3 && !def.force) return null;
    if (def.key && S.events.some((e) => !e.answered && e.key === def.key)) return null;
    const ev = { id: nid(p, 'ev'), day: today(g), answered: null, ...def, choices: def.choices.map((c) => ({ ...c })) };
    S.events.push(ev);
    if (S.events.length > 14) S.events = S.events.filter((e) => !e.answered).concat(S.events.filter((e) => e.answered).slice(-6));
    try { if (X.emit) X.emit(g, 'intra', { kind: 'event', event: ev }); } catch (e) { /* ignore */ }
    if (!g.auto) X.phoneNews(g, `【党内】${ev.title}（「政治」→「党内」で対応を）`, ev.from || '党本部');
    return ev;
  }
  function eventRows(g, p) {
    const S = I(p);
    return S.events.filter((e) => !e.answered).map((e) => ({ id: e.id, kind: e.kind, title: e.title, text: e.text, party: e.party, until: e.until, left: Math.max(0, e.until - today(g)), defaultChoice: e.defaultChoice, choices: e.choices.map((c) => ({ id: c.id, label: c.label, desc: c.desc || '', odds: c.odds == null ? null : c.odds, cost: c.cost || '', why: choiceWhy(g, p, c) })) }));
  }
  function choiceWhy(g, p, c) {
    if (c.money && fundsOf(g, p) < c.money * U(p)) return `お金（政治資金）が足りない：${fmt(c.money * U(p))}`;
    if (c.stamina && g.state.stamina < c.stamina) return '体力が足りない';
    return null;
  }
  function answerEvent(g, p, id, choiceId) {
    const S = I(p);
    const ev = S.events.find((e) => e.id === id && !e.answered);
    if (!ev) return { ok: false, why: 'その件はもう終わった' };
    const c = ev.choices.find((x) => x.id === (choiceId || ev.defaultChoice)) || ev.choices[ev.choices.length - 1];
    const why = choiceWhy(g, p, c);
    if (why) return { ok: false, why };
    if (c.money) pay(g, p, c.money * U(p));
    if (c.stamina) g.state.stamina = Math.max(0, g.state.stamina - c.stamina);
    const win = c.odds == null ? true : Math.random() < c.odds;
    ev.answered = { day: today(g), choice: c.id, success: win };
    const text = applyFx(g, p, ev, win ? c.fx : c.failFx || null, c, win);
    return { ok: true, success: win, text: text || (win ? 'うまくいった。' : 'うまくいかなかった。'), odds: c.odds };
  }
  // fx: { succ, mood: {target: d}, heat, standing, rep, approval, funds, owe, plot: {S, L}, news, say, conflict: 'resolve'|'split', leave, dissolve, resign,
  //       follow: {fid}, deal: {fid, post}, post: {fid, post} }
  function applyFx(g, p, ev, fx, c, win) {
    const S = I(p);
    const pt = p.parties[ev.party] || myParty(p);
    const out = [];
    if (!fx) return c && c.failText ? c.failText : '';
    if (fx.say) out.push(fx.say);
    if (fx.succ) { H.resolveSuccession(g, p, fx.succ, true); out.push('後継が決まった。'); }
    if (fx.mood && pt) {
      for (const [k, d] of Object.entries(fx.mood)) {
        const targets = k === 'all' ? factionsOf(p, pt) : k === 'mine' ? factionsOf(p, pt).filter((f) => f.id === p.me.faction) : k === 'others' ? factionsOf(p, pt).filter((f) => f.id !== p.me.faction) : factionsOf(p, pt).filter((f) => f.id === k);
        for (const f of targets) { const x = fxOf(g, p, pt, f); x.mood = clamp(num(x.mood) + d, -100, 100); }
      }
    }
    if (fx.heat != null && ev.ref && ev.ref.conflict) { const cf = S.conflicts.find((q) => q.id === ev.ref.conflict); if (cf) cf.heat = clamp(num(cf.heat) + fx.heat, 0, 100); }
    if (fx.standing) p.me.standing = clamp(num(p.me.standing) + fx.standing, 0, 100);
    if (fx.rep) p.me.reputation = clamp(num(p.me.reputation) + fx.rep, -100, 100);
    if (fx.approval) approvalShift(g, p, fx.approval, c ? c.label : '党内の判断', 'policy');
    if (fx.owe && ev.faction && pt) { const q = findFaction(p, ev.faction); if (q) { const x = fxOf(g, p, q.pt, q.f); x.owe = clamp(num(x.owe) + fx.owe, 0, 9); } }
    if (fx.plot && S.plot) { S.plot.shift.S += num(fx.plot.S); S.plot.shift.L += num(fx.plot.L); }
    if (fx.deal && pt) { S.deals.push({ id: nid(p, 'dl'), fid: fx.deal.fid, post: fx.deal.post, day: today(g), until: today(g) + 40, kind: 'post' }); out.push(`${X.postName(fx.deal.post, X.fyNow(g), pt.id)}で報いると約束した（期限は40日後）。`); }
    if (fx.post && pt) {
      const q = findFaction(p, fx.post.fid);
      if (q && pt.leader === 'player') { const m = H.memberOf(g, p, pt, q.f, []); H.giveParty(g, p, pt, fx.post.post, m.id); const x = fxOf(g, p, pt, q.f); x.mood = clamp(num(x.mood) + 14, -100, 100); x.demand = null; out.push(`${X.postName(fx.post.post, X.fyNow(g), pt.id)}に${q.f.name}の${m.name}氏を起用した。`); }
    }
    if (fx.conflict && ev.ref && ev.ref.conflict) { const cf = S.conflicts.find((q) => q.id === ev.ref.conflict); if (cf) { if (fx.conflict === 'resolve') closeConflict(g, p, cf, 'resolved', '話し合いで収まった'); else if (fx.conflict === 'split') splitConflict(g, p, cf); } }
    if (fx.lose && ev.faction && pt) {
      const mine = factionsOf(p, pt).find((f) => f.id === p.me.faction);
      const other = factionsOf(p, pt).find((f) => f.id === ev.faction);
      const n = Math.min(num(fx.lose), mine ? Math.max(0, num(mine.size) - 2) : 0);
      if (mine && other && n > 0) { mine.size = num(mine.size) - n; other.size = num(other.size) + n; out.push(`${mine.name}から${n}人が${other.name}に移った。`); }
    }
    if (fx.news) X.news(p, g, fx.news);
    if (fx.follow) {
      const nf = fx.follow;
      if (nf.go) {
        if (p.me.party) X.leavePartyImpl(g, p, '離党');
        out.push('党を離れ、仲間と行動を共にした（のち、仲間の党に入るなら「政治」→「政党」から）。');
      } else { p.me.standing = clamp(num(p.me.standing) - 6, 0, 100); out.push('党に残った。仲間からは冷ややかな目で見られている。'); }
    }
    if (fx.dissolve) { const r = g.dissolve(fx.dissolve); out.push(r ? '衆議院を解散した。' : (g.lastPoliticsError || '解散できなかった')); }
    if (fx.resign) { const w = g.resignPM(fx.resign); out.push(w || '内閣は総辞職する。'); }
    if (fx.leave) { X.leavePartyImpl(g, p, fx.leave); out.push('離党した。'); }
    if (fx.stanceShift && p.me.stance) { const st = p.me.stance; for (const [k, d] of Object.entries(fx.stanceShift)) st[k] = clamp(num(st[k]) + d, k === 'indep' ? 0 : -1, 1); }
    return out.join('\n');
  }
  // events the engine generates from the state of the factions (called every day, cheap)
  function stepEvents(g, p, day) {
    const S = I(p);
    // deadlines: the default choice
    for (const e of S.events) {
      if (!e.answered && day > e.until) { try { answerEvent(g, p, e.id, e.defaultChoice); const ans = e.answered; if (ans) ans.auto = true; } catch (err) { console.error(err); e.answered = { day, auto: true }; } }
    }
    S.events = S.events.filter((e) => !e.answered || day - num(e.answered.day, day) < 30);
    if (day - num(S.evCheck, -99) < 2) return;
    S.evCheck = day;
    const pt = myParty(p);
    if (!pt) return;
    const role = roleOf(p, pt);
    if (role === 'none') return;
    H.ensureFactions(g, p, pt);
    const rows = H.factionRows(g, p, pt);
    const myF = rows.find((r) => r.id === p.me.faction) || null;
    // 1. a faction asks for a post (the player leads the party)
    if (role === 'leader') {
      const dem = rows.find((r) => r.demand && day - r.demand.since <= 3 && !S.events.some((e) => !e.answered && e.key === `dem:${r.id}`));
      if (dem) {
        const post = dem.demand.post;
        const label = X.postName(post, X.fyNow(g), pt.id);
        pushEvent(g, p, {
          kind: 'demand', key: `dem:${dem.id}`, party: pt.id, faction: dem.id, title: `${dem.name}が「${label}」を要求`,
          text: `${dem.name}（${dem.size}人）の${dem.leaderName}氏が、「我々にも${label}を」と求めてきた。\n機嫌は「${dem.moodWord}」。応じなければ、不満はさらに強まる。\nどうする？`,
          choices: [
            { id: 'give', label: `${label}を${dem.name}に与える`, desc: `${dem.name}の機嫌+14。現職の派閥は面白くない`, fx: { post: { fid: dem.id, post }, standing: 1 } },
            { id: 'promise', label: '次の人事で報いると約束する', desc: `機嫌+7。約束は40日以内に果たさないと逆効果`, fx: { mood: { [dem.id]: 7 }, deal: { fid: dem.id, post } } },
            { id: 'refuse', label: 'きっぱり断る', desc: `機嫌-12・恨み。他の派閥には「ぶれない」と映る`, fx: { mood: { [dem.id]: -12 }, standing: 1 } },
          ], until: day + 6, defaultChoice: 'promise',
        });
      }
    }
    // 2. someone approaches members of the player's faction (引き抜き)
    if (myF && myF.size >= 4 && !quiet(g, p, 'ev:poach', 24) && Math.random() < 0.35) {
      const other = rows.filter((r) => r.id !== myF.id && (r.intent === 'bargain' || r.intent === 'plot') && r.ambition >= 45).sort((a, b) => b.power - a.power)[0];
      if (other) {
        const n = irnd(2, 3);
        pushEvent(g, p, {
          kind: 'poach', key: `poach:${other.id}`, party: pt.id, faction: other.id, title: `${other.name}が${myF.name}の議員に接触`,
          text: `${other.name}の${other.leaderName}氏が、${myF.name}の若手${n}人に「うちに来ないか」と声をかけている、との情報が入った。\n放っておくと、${n}人が抜けるかもしれない。`,
          choices: [
            { id: 'hold', label: '食事に誘い、引き留める', desc: '成功すれば結束が強まる', money: 2, stamina: 6, odds: clamp(0.62 + (num(p.me.standing) - 40) / 200, 0.3, 0.9), fx: { mood: { mine: 6 }, say: `${n}人は踏みとどまった。「やはり先生についていく」と言ってくれた。` }, failFx: { say: `${n}人が${other.name}に移ってしまった。`, mood: { mine: -4 }, standing: -2, lose: n } },
            { id: 'ignore', label: '好きにさせる', desc: `${n}人が抜ける可能性が高い`, fx: { say: '静観した。数日後、何人かが抜けたと聞いた。', lose: n } },
            { id: 'retaliate', label: '仕返しに、あちらの議員に声をかける', desc: '成功すれば相手の力をそぐが、恨みも深まる', stamina: 8, money: 2, odds: 0.4, fx: { say: `${other.name}の議員を引き寄せた。向こうは激怒している。`, mood: { [other.id]: -8 } }, failFx: { say: '仕返しは不発。恥をかいた。', standing: -3 } },
          ], until: day + 4, defaultChoice: 'ignore',
        });
        // the 'lose' effect is applied below in applyLose via the choice fx
      }
    }
    // 3. 密室の協議: a plot is open, or a leader race is near, and the player is a power broker
    const plot = S.plot;
    if (plot && plot.party === pt.id && plot.stage === 'open' && (role === 'leader' || role === 'exec' || (myF && myF.leader === 'player')) && !S.events.some((e) => !e.answered && e.key === `back:${plot.id}`) && !(plot.touched && plot.touched.backroom)) {
      const tgtMe = plot.targetId === 'player';
      const bname = npcName(p, g, plot.boss) || 'ある領袖';
      plot.touched = plot.touched || {};
      plot.touched.backroom = true;
      pushEvent(g, p, {
        kind: 'backroom', key: `back:${plot.id}`, party: pt.id, title: '密室の協議（料亭に領袖が集まる）',
        text: tgtMe
          ? `夜、赤坂の料亭に${bname}氏ら領袖が集まる、と聞いた。あなたの去就が話題だ。\n席に顔を出して「手打ち」を探るか、静観するか。\nここでの約束は、あとで守る必要がある。`
          : `夜、料亭で領袖たちが党首の去就を話し合う、と聞いた。あなたにも声がかかった。\nどちらの肩を持つ？`,
        choices: tgtMe ? [
          { id: 'deal', label: '席に出て、人事での配慮を約束する', desc: '擁護派+、倒閣派-。約束は40日以内に果たす', stamina: 6, odds: clamp(0.5 + (num(p.me.standing) - 40) / 160, 0.25, 0.85), fx: { plot: { S: -5, L: 5 }, deal: plot.bossFaction ? { fid: plot.bossFaction, post: pickOne(H.postsAvailable(pt)) } : null, say: '「悪いようにはしない」と約束して、場を収めた。' }, failFx: { plot: { S: 2, L: -1 }, say: '席で突き上げを受け、話はまとまらなかった。' } },
          { id: 'policy', label: '政策面で歩み寄る姿勢を見せる', desc: '倒閣派の一部が矛を収める。ただし党内には批判も', stamina: 4, odds: 0.55, fx: { plot: { S: -3, L: 3 }, rep: 1, say: '政策での譲歩を示し、数人が態度をやわらげた。' }, failFx: { plot: { S: 1, L: 0 }, say: '譲歩が足元を見られ、かえって強気に出られた。' } },
          { id: 'stay', label: '出席せず、静観する', desc: '何も動かない。数字の通りに決着する', fx: { say: '会合には出なかった。' } },
        ] : [
          { id: 'topple', label: '倒閣派に付く', desc: '勝てば恩を売れる。負ければ冷遇', fx: { plot: { S: 3, L: 0 }, say: '「次は我々の番だ」と、倒閣派に付いた。' } },
          { id: 'protect', label: '党首を支える', desc: '勝てば信頼を得る。負ければ疎まれる', fx: { plot: { S: 0, L: 3 }, say: '「いま政権を代えるべきでない」と、党首を支えた。' } },
          { id: 'stay', label: '態度を明かさない', desc: '様子見', fx: { say: '態度を明らかにしなかった。' } },
        ],
        until: day + 4, defaultChoice: 'stay',
      });
    }
  }

  // ================================================================ conflicts
  const KINDS = {
    policy: { name: '政策対立', color: '#5fb7ff' }, nomination: { name: '公認をめぐる対立', color: '#e8c25a' }, responsibility: { name: '責任論', color: '#ff8a5a' },
    coalition: { name: '連立内の摩擦', color: '#b8a0ff' }, generation: { name: '世代間の対立', color: '#5ee07a' }, region: { name: '地域間の対立', color: '#5fd7ff' }, rebel: { name: '造反', color: '#ff6b78' },
  };
  const LADDER = ['不満', '公然批判', '造反', '分裂・離党'];
  const levelOf = (h) => (h >= 80 ? 3 : h >= 55 ? 2 : h >= 30 ? 1 : 0);
  const REGIONS = ['北海道', '東北', '北関東', '南関東', '東京', '北陸信越', '東海', '近畿', '中国', '四国', '九州'];
  // foreign-policy topics (stance axis, the two camps' names)
  const FOREIGN = { cn: { name: '対中政策', pos: '対話・融和', neg: '強硬' }, us: { name: '対米関係', pos: '同盟重視', neg: '自主・自立' }, ru: { name: '対ロ政策', pos: '対話・融和', neg: '強硬' } };

  function liveCount(S, pid) { return S.conflicts.filter((c) => c.party === pid && c.status === 'live').length; }
  function mkConflict(g, p, pt, def) {
    const S = I(p);
    const c = {
      id: nid(p, 'cf'), kind: 'policy', party: pt.id, title: '', desc: '', heat: rnd(10, 20), level: 0, drive: 1, start: today(g), last: today(g), status: 'live', involves: false, log: [], resent: 0, sided: null,
      sideA: { label: '', fid: null, leader: null, n: 0 }, sideB: { label: '', fid: null, leader: null, n: 0 }, ...def,
    };
    c.level = levelOf(c.heat);
    c.log.push({ day: today(g), text: `${KINDS[c.kind].name}：${c.title}` });
    S.conflicts.push(c);
    if (S.conflicts.length > 16) { const dead = S.conflicts.findIndex((q) => q.status !== 'live'); if (dead >= 0) S.conflicts.splice(dead, 1); else S.conflicts.shift(); }
    S.cool[`cf:${pt.id}`] = today(g);
    for (const id of [c.sideA.leader, c.sideB.leader]) void id;
    return c;
  }
  function involvesPlayer(p, pt, c) {
    if (c.kind === 'coalition') { const mine = p.me.party; return !!mine && (mine === c.party || mine === pmPartyId(p)); }
    return p.me.party === pt.id;
  }
  function closeConflict(g, p, c, status, why) {
    if (c.status !== 'live') return;
    c.status = status;
    c.end = today(g);
    c.log.push({ day: today(g), text: why });
    if (status === 'resolved' && c.bill) { const b = p.diet.bills.find((x) => x.id === c.bill); if (b && b.rebel) delete b.rebel[c.party]; }
    const pt = p.parties[c.party];
    if (c.involves && pt) X.note(g, `（「${c.title}」は${status === 'resolved' ? '収まった' : status === 'faded' ? '自然と下火になった' : '決着した'}）`);
  }
  // party-level facts the generators use
  function approvalOf(g, p, pt) {
    if (isPMParty(p, pt)) return num(p.cabinet.approval, 45);
    const sup = X.natSupport(p, pt.id, X.fyNow(g)); const last = num(pt.voteShare && pt.voteShare.shugi, sup);
    return 42 + (sup - last) * 160;
  }
  function strengthOf(g, p, pt) {
    // how firmly the leadership holds: 0..1
    let s = 0.5;
    const A = approvalOf(g, p, pt);
    s += (A - 42) / 110;
    if (pt.leader === 'player') s += (num(p.me.standing) - 50) / 220;
    else { const n = npcOf(p, pt.leader); if (n) s += (num(n.traits.charisma, 50) - 55) / 250; }
    return clamp(s, 0.1, 0.95);
  }
  function pendingBills(p) { return p.diet.bills.filter((b) => b.kind === 'law' && b.policy && POLICIES[b.policy] && ['committee', 'shugi', 'sangi', 'draft'].includes(b.stage) && b.sponsor === 'cabinet'); }
  function worldTension(g) { try { if (typeof g.world === 'function') { const w = g.world(); return num(w && w.tension, 40); } } catch (e) { /* ignore */ } return 40; }

  function genConflicts(g, p, day) {
    const S = I(p);
    const focusIds = new Set([pmPartyId(p), p.me.party, ...(p.cabinet.partyIds || []), H.topOpp(p)].filter(Boolean));
    if (S.conflicts.filter((c) => c.status === 'live').length >= 4) return;
    for (const pid of focusIds) {
      const pt = p.parties[pid];
      if (!pt) continue;
      const fs = factionsOf(p, pt);
      if (fs.length < 2) continue;
      if (liveCount(S, pid) >= 2 || day - num(S.cool[`cf:${pid}`], -99) < 40) continue;
      const rows = H.factionRows(g, p, pt).filter((r) => r.size >= 3);
      if (rows.length < 2) continue;
      const lf = leaderFaction(p, pt);
      const mainstream = rows.find((r) => r.id === lf) || rows[0];
      const lead = pt.leader === 'player' ? g.state.name : npcName(p, g, pt.leader);
      const A = approvalOf(g, p, pt);
      const roll = Math.random();
      const have = (k) => S.conflicts.some((c) => c.party === pid && c.kind === k && c.status === 'live');
      const sideOf = (r) => ({ label: r.name, fid: r.id, leader: r.leader, n: r.size });
      const mainSide = () => ({ label: pt.leader === 'player' ? 'あなた（執行部）' : `${lead}執行部`, fid: lf, leader: pt.leader === 'player' ? null : pt.leader, n: mainstream.size });
      // a. policy conflict (a cabinet bill, or a foreign-policy dispute between camps)
      if (!have('policy') && roll < 0.22) {
        // foreign-policy gap between two camps?
        const withSt = rows.map((r) => ({ r, st: r.stance && r.stance.vec })).filter((q) => q.st);
        let done = false;
        if (withSt.length >= 2 && Math.random() < 0.45) {
          for (const ax of ['cn', 'us', 'ru']) {
            const hi = withSt.slice().sort((a, b) => b.st[ax] - a.st[ax])[0];
            const lo = withSt.slice().sort((a, b) => a.st[ax] - b.st[ax])[0];
            const gap = hi.st[ax] - lo.st[ax];
            const tens = worldTension(g);
            if (gap >= 0.85 && hi.r.id !== lo.r.id && Math.random() < 0.3 + (tens - 40) / 150) {
              const F = FOREIGN[ax];
              const dissent = lo.r.id === lf ? hi.r : lo.r; // the camp that is not the mainstream's
              const other = dissent === hi.r ? lo.r : hi.r;
              const campName = (r, pos) => `${r.name}（${r.stance.label}）`;
              mkConflict(g, p, pt, { kind: 'policy', title: `${F.name}をめぐる党内対立`, topic: `foreign:${ax}`, axis: ax, desc: `${F.name}をめぐり、${campName(dissent)}と${campName(other)}が対立。${F.pos}か${F.neg}かで、党内が割れている。`, sideA: sideOf(dissent), sideB: other.id === mainstream.id ? mainSide() : sideOf(other), involves: p.me.party === pid, drive: 1.1 });
              done = true; break;
            }
          }
        }
        if (!done) {
          const bills = isPMParty(p, pt) ? pendingBills(p) : [];
          const b = bills.length ? pickOne(bills) : null;
          const polId = b ? b.policy : pickOne(Object.keys(POLICIES).filter((id) => POLICIES[id].kind === 'law' && X.policyOk(g, p, id)));
          const pl = POLICIES[polId];
          if (pl) {
            const pax = H.policyAxes(polId);
            const sc = rows.map((r) => ({ r, s: H.agree(r.axes, pax) })).sort((a, b) => a.s - b.s);
            const diss = sc.find((q) => q.r.id !== lf) || sc[0];
            if (diss && diss.s < -0.05) {
              const support = sc[sc.length - 1].r;
              mkConflict(g, p, pt, { kind: 'policy', title: `「${pl.name.replace(/（[^）]*）/g, '')}」をめぐる対立`, topic: `policy:${polId}`, policy: polId, bill: b ? b.id : null, desc: `${diss.r.name}は「${pl.name.replace(/（[^）]*）/g, '')}」に慎重・反対。${support.id === lf ? mainSide().label : support.name}は推進の構え。${b ? '法案が国会に出ており、採決が近づく。' : ''}`, sideA: sideOf(diss.r), sideB: support.id === lf || support.id === mainstream.id ? mainSide() : sideOf(support), involves: p.me.party === pid, drive: 1.2 + (b ? 0.6 : 0) });
            }
          }
        }
        continue;
      }
      // b. 公認をめぐる対立 (before a general election)
      const sh = p.elections.upcoming.find((e) => e.kind === 'shugi' && e.status !== 'done');
      if (sh && sh.day - day < 80 && sh.day - day > 3 && !have('nomination') && roll < 0.34) {
        const a = rows.filter((r) => r.id !== lf)[irnd(0, Math.max(0, rows.length - 2))] || rows[1];
        const region = `${pickOne(REGIONS)}${irnd(1, 12)}区`;
        mkConflict(g, p, pt, { kind: 'nomination', title: `${region}の公認争い`, desc: `${region}の公認をめぐり、${a.name}の推す候補と、${mainSide().label}の推す候補が競り合う。「党本部の裁定に不公平感がある」との声。`, sideA: sideOf(a), sideB: mainSide(), involves: p.me.party === pid, drive: 1.3 });
        continue;
      }
      // c. responsibility (low approval, or an election loss) — policy / personnel only
      const lostElec = day - num(S.cool.elec, -999) < 40 && num(pt.voteShare && pt.voteShare.shugi, 0) > 0 && A < 38;
      if (!have('responsibility') && (A < 31 || lostElec) && roll < 0.4) {
        const a = rows.filter((r) => r.id !== lf).sort((x, y) => y.ambition - x.ambition)[0] || rows[1];
        mkConflict(g, p, pt, { kind: 'responsibility', title: lostElec ? '選挙の結果をめぐる責任論' : '支持率低迷をめぐる責任論', desc: `${a.name}が執行部の責任を問い、役員の交代や党運営の見直しを求めている。${mainSide().label}は「続投して立て直す」と主張。`, sideA: sideOf(a), sideB: mainSide(), involves: p.me.party === pid, drive: 1 + (38 - A) / 24 });
        continue;
      }
      // d. coalition friction
      const ruling = (p.cabinet.partyIds || []);
      const core = pmPartyId(p);
      if (pid !== core && ruling.includes(pid) && !have('coalition') && roll < 0.24) {
        const cp = p.parties[core];
        const dist = cp ? Math.abs(num(cp.ideology.econ) - num(pt.ideology.econ)) + Math.abs(num(cp.ideology.social) - num(pt.ideology.social)) + Math.abs(num(cp.ideology.security) - num(pt.ideology.security)) : 1;
        const topics = ['防衛費と安全保障の分担', '税制と社会保障の財源', '重要ポストの配分', '選挙協力の見返り', '看板政策の扱い'];
        const topic = pickOne(topics);
        mkConflict(g, p, pt, { kind: 'coalition', title: `連立内の摩擦（${topic}）`, topic, desc: `連立のパートナー${pt.short}が「${topic}」で不満を強めている。${cp ? cp.short : '与党第1党'}との溝が表に出てきた。`, sideA: { label: pt.name, fid: null, leader: pt.leader === 'player' ? null : pt.leader, n: X.partySeats(p, pid) }, sideB: { label: cp ? cp.name : '与党第1党', fid: null, leader: cp && cp.leader !== 'player' ? cp.leader : null, n: cp ? X.partySeats(p, core) : 0 }, involves: !!p.me.party && (p.me.party === pid || p.me.party === core), drive: 0.9 + dist * 0.25 });
        continue;
      }
      // e. generation / region
      if (!have('generation') && roll < 0.46) {
        const old = rows.filter((r) => r.leaderAge && r.leaderAge >= 64);
        if (old.length && Math.random() < 0.4) {
          const young = rows.filter((r) => r.leaderAge && r.leaderAge < 60).sort((a, b) => b.ambition - a.ambition)[0] || rows[rows.length - 1];
          const elder = old.sort((a, b) => b.leaderAge - a.leaderAge)[0];
          if (young.id !== elder.id) mkConflict(g, p, pt, { kind: 'generation', title: '世代交代を求める声', desc: `「新陳代謝を」と求める若手・中堅（${young.name}など）と、ベテラン（${elder.name}の${elder.leaderName}氏ら）が、候補者の定年や役員人事をめぐって対立。`, sideA: sideOf(young), sideB: sideOf(elder), involves: p.me.party === pid, drive: 0.8 });
        }
        continue;
      }
      if (!have('region') && roll < 0.52) {
        const a = rows.filter((r) => r.id !== lf)[0] || rows[1];
        const rg = pickOne(REGIONS);
        mkConflict(g, p, pt, { kind: 'region', title: `${rg}の党組織と本部の対立`, desc: `${rg}の党組織が、公認の優先や予算の配分を巡り本部に不満。${a.name}がその声を代弁している。`, sideA: sideOf(a), sideB: mainSide(), involves: p.me.party === pid, drive: 0.75 });
      }
    }
  }

  // one step of every live conflict (dt days)
  function stepOne(g, p, c, dt) {
    const pt = p.parties[c.party];
    if (!pt) { c.status = 'faded'; return; }
    const S = I(p);
    const day = today(g);
    c.involves = involvesPlayer(p, pt, c);
    // the leadership's grip
    const str = strengthOf(g, p, pt);
    let drive = num(c.drive, 1);
    if (c.kind === 'policy' && c.bill) {
      const b = p.diet.bills.find((x) => x.id === c.bill);
      if (!b || ['enacted', 'rejected', 'shelved'].includes(b.stage)) { c.bill = null; c.drive = Math.max(0.5, drive - 0.5); drive = c.drive; if (b && b.stage === 'enacted') c.log.push({ day, text: '法案は成立した' }); }
      else if (['shugi', 'sangi'].includes(b.stage)) drive += 0.9;
    }
    if (c.kind === 'nomination') { const sh = p.elections.upcoming.find((e) => e.kind === 'shugi' && e.status !== 'done'); if (sh) drive += clamp((45 - (sh.day - day)) / 45, 0, 1) * 1.2; else drive -= 0.5; }
    if (c.kind === 'responsibility') drive += clamp((34 - approvalOf(g, p, pt)) / 20, -0.6, 1.2);
    // foreign dispute is hotter when the world is tense
    if (c.topic && String(c.topic).startsWith('foreign:')) drive += clamp((worldTension(g) - 45) / 50, -0.3, 0.8);
    const relax = 0.75 + str * 1.5 + (c.level >= 2 ? 0.45 : 0) + (c.mediated && day - c.mediated < 12 ? 0.8 : 0);
    const xa = c.sideA.fid ? (S.fx[c.sideA.fid] || null) : null;
    const moodPush = xa ? clamp(-num(xa.mood) / 90, -0.3, 0.5) : 0;
    c.heat = clamp(num(c.heat) + (drive + moodPush + num(c.resent) * 0.03 - relax) * dt * 0.55 + gauss() * 0.5, 0, 100);
    c.resent = Math.max(0, num(c.resent) - 0.6 * dt);
    c.last = day;
    // when the player is not involved, the leadership deals with it now and then (調整・譲歩)
    if (!c.involves && c.heat > 18 && Math.random() < (c.level >= 2 ? 0.2 + 0.4 * str : 0.12 + 0.3 * str)) {
      const cut = c.level >= 2 ? rnd(10, 22) : rnd(6, 15);
      c.heat = Math.max(0, c.heat - cut);
      if (Math.random() < 0.3) c.log.push({ day, text: '執行部が調整に動いた' });
      if (c.level >= 2 && Math.random() < 0.3) { closeConflict(g, p, c, 'resolved', '執行部が譲歩して収まった'); return; }
    }
    const lv = levelOf(c.heat);
    c.drive = drive;
    if (lv > c.level) {
      c.level = lv;
      const t = LADDER[lv];
      c.log.push({ day, text: `${t}の段階に` });
      onLevelUp(g, p, pt, c, lv);
    } else if (lv < c.level) { c.level = lv; c.log.push({ day, text: `${LADDER[lv]}の段階まで収まった` }); }
    if (c.heat >= 99.5 || (c.level >= 3 && Math.random() < 0.2)) { splitConflict(g, p, c); return; }
    if (c.heat < 6 && day - c.start > 12) { closeConflict(g, p, c, 'faded', '自然と下火になった'); return; }
    if (day - c.start > 90 && c.heat < 30) { closeConflict(g, p, c, 'faded', '時間とともに下火になった'); return; }
  }
  function onLevelUp(g, p, pt, c, lv) {
    const S = I(p);
    const A = c.sideA.fid ? S.fx[c.sideA.fid] : null;
    if (A) A.mood = clamp(num(A.mood) - 2, -100, 100);
    const kn = KINDS[c.kind].name;
    if (lv === 1) {
      if (c.involves) X.note(g, `（「${c.title}」で、${c.sideA.label}が公然と批判を始めた）`);
      newsQ(g, p, `cf1:${pt.id}`, 10, `${pt.short}内で「${c.title}」。${c.sideA.label}が公然と批判`);
    } else if (lv === 2) {
      c.log.push({ day: today(g), text: '造反の動きが出た' });
      const house = 'shugi';
      const seats = Math.max(1, num(p.diet[house].seats[pt.id]));
      if (c.bill) {
        const b = p.diet.bills.find((x) => x.id === c.bill);
        if (b) { b.rebel = b.rebel || {}; b.rebel[pt.id] = clamp((num(c.sideA.n) / Math.max(1, X.partySeats(p, pt.id))) * 0.8, 0.04, 0.4); b.log.push({ day: today(g), text: `${pt.short}内で反対の動き（造反の見込み）` }); }
      }
      if (X.isRulingParty(p, pt.id)) {
        approvalShift(g, p, -1.2, `${pt.short}内の造反の動き`, 'policy');
        p.cabinet.scandal = num(p.cabinet.scandal) - 0.8;
      }
      if (c.involves) X.note(g, `（「${c.title}」が造反の段階に。${c.sideA.label}が採決で反旗を翻すかもしれない）`);
      newsQ(g, p, `cf2:${pt.id}`, 8, `${pt.short}で造反の動き：${c.title}（${c.sideA.label}）`);
      I(p).stats.rebels++;
      void house; void seats; void kn;
      // a dispute over responsibility turns into a bid to oust the leader
      if (c.kind === 'responsibility' && !S.plot && c.sideA.fid && today(g) - num(S.cool.plotEnd, -99) >= 30) {
        const q = findFaction(p, c.sideA.fid);
        if (q) {
          const rows = H.factionRows(g, p, pt);
          const lf = leaderFaction(p, pt);
          const bloc = rows.filter((r) => r.id !== lf && r.mood <= -12).map((r) => r.id);
          if (!bloc.includes(q.f.id)) bloc.unshift(q.f.id);
          if (H.startPlot(g, p, pt, q.f.leader, bloc, { slump: 0 })) { closeConflict(g, p, c, 'resolved', '党首（総理）への退陣要求に発展した'); return; }
        }
      }
    } else if (lv === 3) {
      c.log.push({ day: today(g), text: '分裂・離党の危機' });
      if (c.kind === 'coalition') {
        if (c.involves) X.note(g, `（「${c.title}」で、${pt.short}が連立からの離脱をほのめかしている！）`);
        newsQ(g, p, `cf3:${pt.id}`, 6, `${pt.name}が連立離脱をほのめかす（${c.title}）`);
      } else {
        if (c.involves) X.note(g, `（「${c.title}」が分裂の危機に！${c.sideA.label}が離党をほのめかしている）`);
        newsQ(g, p, `cf3:${pt.id}`, 6, `${pt.short}が分裂の危機。${c.sideA.label}が離党をほのめかす`);
      }
    }
    // a decision for the player when it matters to them
    if (c.involves && lv >= 1 && X.pushEvent && H.roleOf(p, pt) !== 'none' || (c.involves && c.kind === 'coalition')) {
      pushEvent(g, p, { kind: 'conflict', key: `cf:${c.id}:${lv}`, party: pt.id, title: `${c.title}：${LADDER[lv]}の段階`, text: `${c.desc}\n\n段階は「${LADDER[lv]}」。「党内」→「紛争」から、調停・譲歩などの手を打てる。放っておくと、さらに悪化するかもしれない。`, choices: [{ id: 'open', label: '紛争の画面で対応を決める', desc: '調停・譲歩・押さえ込みなどから選ぶ', fx: null }, { id: 'later', label: 'しばらく様子を見る', desc: '', fx: null }], until: today(g) + 4, defaultChoice: 'later', ref: { conflict: c.id }, openConflict: c.id });
    }
  }
  // seats move to 無所属 / a splinter party / a close opposition party
  function moveSeats(g, p, fromId, toId, n) {
    const sh = num(p.diet.shugi.seats[fromId]), sa = num(p.diet.sangi.seats[fromId]);
    const tot = Math.max(1, sh + sa);
    let ns = Math.min(sh, Math.round((n * sh) / tot));
    let nq = Math.min(sa, n - ns);
    ns = Math.min(sh, n - nq);
    for (let i = 0; i < ns; i++) X.seatMove(p, 'shugi', fromId, toId);
    for (let i = 0; i < nq; i++) X.seatMove(p, 'sangi', fromId, toId);
    return ns + nq;
  }
  const SPLINTER_NAMES = ['ドット刷新の会', '誠実フォーラム', '地域自立党', '共創の会', '新しい政治を考える会', 'ドット再生党', '市民と地方の会', '改革ドット連合', '自立と共生の党', '政策実現フォーラム'];
  const SPLINTER_COLORS = ['#e07a3a', '#3aa88a', '#8a6ad0', '#c8a030', '#4a8ad8', '#d05a7a'];
  function createSplinter(g, p, from, n, leaderNpc, why) {
    const S = I(p);
    const used = Object.keys(p.parties).filter((id) => /^sp\d+$/.test(id));
    if (used.length >= 2) return null;
    const taken = new Set(Object.values(p.parties).map((q) => q.name));
    const name = SPLINTER_NAMES.find((x) => !taken.has(x));
    if (!name) return null;
    const id = `sp${S.nextId++}`;
    const fy = X.fyNow(g);
    const pt = X.makeParty(p, id, fy, { name, short: name.length <= 5 ? name : name.slice(0, 5), color: SPLINTER_COLORS[used.length % SPLINTER_COLORS.length], ideology: { econ: clamp(num(from.ideology.econ) + gauss() * 0.4, -2, 2), social: clamp(num(from.ideology.social) + gauss() * 0.5, -2, 2), security: clamp(num(from.ideology.security) + gauss() * 0.4, -2, 2) }, platform: (from.platform || []).slice(0, 3), funds: Math.round(2e8 / ((X.ERAS[p.era] || X.ERAS.reiwa).priceRate || 1)), members: n * 600, founded: today(g), desc: `${from.name}を離れた議員らが結成した新党。${why || ''}` });
    pt.leader = leaderNpc ? leaderNpc.id : null;
    if (leaderNpc) { leaderNpc.party = id; leaderNpc.faction = null; leaderNpc.posts = (leaderNpc.posts || []).filter((q) => !(POSTS[q] && POSTS[q].kind === 'party')); }
    pt.posts = {}; pt.factions = [];
    // supporters: part of the old party's support follows
    const seatsFrom = Math.max(1, X.partySeats(p, from.id) + n);
    const share = clamp(n / seatsFrom, 0.02, 0.4);
    for (const s of SEGMENT_ORDER) {
      const b = p.support.base[s] || (p.support.base[s] = {});
      const v = num(b[from.id]);
      const take = v * share * 0.7;
      b[from.id] = Math.max(0, v - take);
      b[id] = take + 0.002;
    }
    X.refreshOpinion(p, g);
    X.news(p, g, `${from.short}を離れた議員らが新党「${name}」を結成（${n}人）`);
    X.phoneNews(g, `【新党】${from.name}の議員${n}人が離党し、新党「${name}」を結成しました。`, 'ドット新聞 政治部');
    try { X.emit(g, 'party', { kind: 'founded', party: id, player: false, splinter: true }); } catch (e) { /* ignore */ }
    return pt;
  }
  // a faction leaves its party (from a conflict or a defection)
  function partySplitOut(g, p, pt, f, n, c, why) {
    const S = I(p);
    const real = pt.real;
    n = Math.max(1, Math.min(n, Math.floor(X.partySeats(p, pt.id) * 0.12) + 2, 36));
    // the one who leads the group out is never the party's own leader (he stays: the group goes without him)
    let boss = npcOf(p, f ? f.leader : c && c.sideA.leader);
    if (!boss || boss.party !== pt.id || boss.id === pt.leader) {
      const mem = Object.values(p.npcs).filter((q) => q.party === pt.id && q.id !== pt.leader && f && q.faction === f.id).sort((a, b) => num(b.traits && b.traits.charisma, 50) - num(a.traits && a.traits.charisma, 50));
      boss = mem[0] || null;
    }
    const roll = Math.random();
    let toId = IND, kind = 'ind';
    const opps = Object.keys(p.parties).filter((id) => id !== pt.id && !X.isRulingParty(p, id) && !p.parties[id].isPlayers && !/^my\d/.test(id));
    if (n >= 5 && roll < 0.4 && boss) { const sp = createSplinter(g, p, pt, n, boss, why); if (sp) { toId = sp.id; kind = 'new'; } }
    if (kind === 'ind' && roll > 0.65 && opps.length) {
      // a party close in policy
      opps.sort((a, b) => Math.abs(num(p.parties[a].ideology.econ) - num(pt.ideology.econ)) + Math.abs(num(p.parties[a].ideology.security) - num(pt.ideology.security)) - (Math.abs(num(p.parties[b].ideology.econ) - num(pt.ideology.econ)) + Math.abs(num(p.parties[b].ideology.security) - num(pt.ideology.security))));
      toId = opps[0]; kind = 'join';
    }
    const moved = moveSeats(g, p, pt.id, toId, n);
    if (f) { f.size = Math.max(2, num(f.size) - n); }
    if (kind !== 'ind' && boss && toId !== IND) { boss.party = toId; boss.faction = null; }
    else if (boss) { boss.party = IND; boss.faction = null; }
    // the party pays: support falls
    if (X.isRulingParty(p, pt.id)) approvalShift(g, p, -(2 + moved * 0.15), `${pt.short}の分裂`, 'policy');
    partySupportShift(p, pt.id, -0.004 * Math.min(moved, 12));
    if (toId !== IND && p.parties[toId]) partySupportShift(p, toId, 0.002 * Math.min(moved, 12));
    S.stats.splits++;
    const dest = kind === 'new' ? `新党「${p.parties[toId].name}」` : kind === 'join' ? `${p.parties[toId].short}` : '無所属';
    X.news(p, g, `${pt.short}の${f ? f.name : c.sideA.label}の議員${moved}人が離党し、${dest}${kind === 'join' ? 'に合流' : kind === 'new' ? 'を結成' : 'に'}。${boss ? `${boss.name}氏ら。` : ''}`);
    logLine(g, p, `${pt.short}から${moved}人が離党（${dest}）`);
    // the coalition's majority
    afterSeatLoss(g, p, pt);
    // the player in that faction: an event
    if (f && p.me.party === pt.id && p.me.faction === f.id) {
      pushEvent(g, p, {
        kind: 'follow', key: `follow:${f.id}`, party: pt.id, title: `${f.name}が離党へ。あなたはどうする？`, from: f.name,
        text: `${f.name}の仲間${moved}人が、${dest}${kind === 'join' ? 'に合流する' : kind === 'new' ? 'を立ち上げる' : 'として党を離れる'}。\n「先生もご一緒に」と誘われている。残れば党内での立場は安泰だが、仲間とは袂を分かつことになる。`,
        choices: [{ id: 'go', label: '行動を共にする（離党）', desc: '党内の立場を失うが、仲間との絆は守れる', fx: { follow: { go: true, to: kind !== 'ind' ? toId : null } } }, { id: 'stay', label: '党に残る', desc: '評価は保たれるが、仲間の信頼を失う', fx: { follow: { go: false } } }],
        until: today(g) + 4, defaultChoice: 'stay', force: true,
      });
    }
    return moved;
  }
  function afterSeatLoss(g, p, pt) {
    const ids = p.cabinet.partyIds || [];
    if (!ids.includes(pt.id) || p.cabinet.resigned || p.cabinet.pending || p.diet.shugi.dissolved) return;
    const sum = ids.reduce((a, id) => a + num(p.diet.shugi.seats[id]), 0);
    p.flags.nejire = false;
    if (sum > p.diet.shugi.total / 2) { p.flags.nejire = ids.reduce((a, id) => a + num(p.diet.sangi.seats[id]), 0) <= p.diet.sangi.total / 2; return; }
    // the ruling side lost the 衆院 majority
    X.news(p, g, '与党が衆議院の過半数を割った（分裂による）');
    if (p.cabinet.pm === 'player') {
      pushEvent(g, p, {
        kind: 'minority', key: 'minority', party: pt.id, title: '与党が衆議院で過半数割れ',
        text: '分裂によって、与党が衆議院の過半数を失った。このままでは法案も予算も通らない。\n民意を問うか、潔く退くか、野党の協力を探るか。',
        choices: [{ id: 'dissolve', label: '衆議院を解散する', desc: '総選挙で信を問う', fx: { dissolve: '与党の過半数割れを受けて' } }, { id: 'resign', label: '内閣総辞職する', desc: '新しい総理が指名される', fx: { resign: '与党の過半数割れ' } }, { id: 'carry', label: '少数与党のまま続ける', desc: '支持率が落ち、法案は通りにくい', fx: { approval: -2, say: '野党との個別の協力に望みをつなぐことにした。' } }],
        until: today(g) + 6, defaultChoice: 'carry', force: true,
      });
    } else if (Math.random() < 0.55) {
      X.dissolveNpc ? X.dissolveNpc(g, p, '与党の過半数割れ') : (p.cabinet.pending = { kind: 'resign', day: today(g) + 2, reason: '与党の過半数割れ' });
    } else if (!p.cabinet.pending) p.cabinet.pending = { kind: 'resign', day: today(g) + 3, reason: '与党の過半数割れ' };
  }
  function splitConflict(g, p, c) {
    const pt = p.parties[c.party];
    if (!pt) { c.status = 'faded'; return; }
    if (c.kind === 'coalition') {
      // the partner leaves the coalition
      const ids = p.cabinet.partyIds || [];
      closeConflict(g, p, c, 'split', `${pt.short}が連立を離脱`);
      if (ids.includes(pt.id) && pmPartyId(p) !== pt.id) {
        p.cabinet.partyIds = ids.filter((x) => x !== pt.id);
        // a partner's ministers leave
        for (const [post, who] of Object.entries(p.cabinet.ministers || {})) {
          const n = who !== 'player' && npcOf(p, who);
          if ((n && n.party === pt.id) || (who === 'player' && p.me.party === pt.id)) {
            const m = X.pickMinister(p, pmPartyId(p), p.cabinet.ministers);
            m.posts.push(post);
            p.cabinet.ministers[post] = m.id;
            if (n) n.posts = (n.posts || []).filter((q) => q !== post);
            if (who === 'player') p.me.posts = p.me.posts.filter((q) => q !== post);
          }
        }
        approvalShift(g, p, -3, `${pt.short}の連立離脱`, 'policy');
        X.news(p, g, `${pt.name}が連立政権から離脱した（${c.title}）`);
        X.phoneNews(g, `【速報】${pt.name}が連立政権から離脱します。`, 'ドット新聞 政治部');
        try { X.emit(g, 'cabinet', { pm: p.cabinet.pm, partyIds: p.cabinet.partyIds, coalition: 'left' }); } catch (e) { /* ignore */ }
        I(p).stats.splits++;
        afterSeatLoss(g, p, p.parties[pmPartyId(p)] || pt);
      }
      return;
    }
    const f = c.sideA.fid ? factionsOf(p, pt).find((x) => x.id === c.sideA.fid) : null;
    const n = Math.max(2, Math.round((f ? num(f.size) : num(c.sideA.n)) * rnd(0.55, 0.95)));
    closeConflict(g, p, c, 'split', `${c.sideA.label}が離党`);
    partySplitOut(g, p, pt, f, n, c, `（${c.title}が発端）`);
  }
  // a faction defects on its own (from stepParty)
  function factionDefects(g, p, pt, f, x) {
    const n = Math.max(2, Math.round(num(f.size) * rnd(0.5, 0.9)));
    x.mood = -40; x.intent = 'wait'; x.ambition = clamp(num(x.ambition) - 20, 0, 100);
    partySplitOut(g, p, pt, f, n, null, '（党運営への不満から）');
  }

  // ---------------------------------------------------------------- options for the player
  function optionsFor(g, p, c) {
    const pt = p.parties[c.party];
    const out = [];
    if (!pt || c.status !== 'live') return out;
    const me = p.me;
    const role = roleOf(p, pt);
    const standing = num(me.standing);
    const isPM = me.posts.includes('pm');
    const coalMine = c.kind === 'coalition' && (me.party === pmPartyId(p) || me.party === c.party);
    const leaderish = role === 'leader' || role === 'exec' || coalMine;
    const A = c.sideA, B = c.sideB;
    const addOpt = (o) => out.push({ cost: '', odds: null, why: null, lines: [], ...o });
    const stam = (n) => (g.state.stamina < n ? '体力が足りない' : null);
    const mon = (n) => (fundsOf(g, p) < n * U(p) ? `お金（政治資金）が足りない：${fmt(n * U(p))}` : null);
    if (leaderish) {
      const authority = role === 'leader' ? 0.12 : role === 'exec' ? 0.04 : 0;
      addOpt({ id: 'mediate', name: '調停に乗り出す', desc: '双方を呼んで話を聞き、落としどころを探る', odds: clamp(0.42 + (standing - 40) / 170 + authority - c.heat / 280 + (isPM ? 0.05 : 0), 0.12, 0.88), cost: '体力8', why: stam(8), lines: ['成功：熱が-22、両派の機嫌+3', '失敗：熱+6、評価-2'] });
      addOpt({ id: 'concede', name: '相手の主張を受け入れる（譲歩）', desc: concedeDesc(c), odds: 0.95, cost: '体力4', why: stam(4) || (c.kind === 'responsibility' && role !== 'leader' ? '譲歩を決められるのは党首（総理）' : null), lines: concedeLines(c) });
      addOpt({ id: 'suppress', name: '押さえ込む（党議拘束・締めつけ）', desc: '力でねじ伏せる。その場は収まるが、恨みが残る', odds: clamp(0.5 + (standing - 50) / 160 + (role === 'leader' ? 0.12 : 0), 0.15, 0.85), cost: '体力5', why: stam(5) || (role !== 'leader' ? '締めつけを決められるのは党首' : null), lines: ['成功：熱-12。ただし恨みが残り、あとで再燃しやすい', '失敗：熱+10、' + A.label + 'の機嫌-12'] });
      if (c.level >= 2 && c.kind !== 'coalition') addOpt({ id: 'discipline', name: '造反者を処分する（厳重注意・党員資格停止）', desc: `${A.label}の一部に処分を科す。反発して離党に走る人も出る`, odds: clamp(0.5 + (standing - 50) / 150, 0.2, 0.8), cost: '体力6', why: stam(6) || (role !== 'leader' ? '処分を決められるのは党首' : null), lines: ['成功：造反者が減り、熱-20', '失敗：反発して熱+14（離党が近づく）'] });
      if (c.kind === 'coalition') addOpt({ id: 'post', name: '閣僚ポストなどで連立相手に報いる', desc: '連立の相手に重要ポストや政策での配慮を与える', odds: 0.8, cost: '体力4', why: stam(4), lines: ['熱-30。ただし与党第1党の内部に不満が出る'] });
    }
    if (standing >= 30 || role !== 'none') addOpt({ id: 'elders', name: '長老に仲裁を頼む', desc: 'OBや長老の顔でまとめてもらう（政治資金で謝礼・お車代）', odds: clamp(0.5 + (standing - 40) / 250, 0.25, 0.8), cost: `${fmt(2 * U(p))}`, why: mon(2) || stam(4), lines: ['成功：熱-28', '失敗：長老のメンツをつぶし、評価-1'] });
    if (role === 'member' || role === 'exec') {
      if (c.sideA.fid && c.sideA.fid !== p.me.faction) {
        addOpt({ id: 'side_a', name: `${A.label}の側に付く`, desc: '批判の声に同調する。党内での立場が揺れる', odds: null, cost: '', why: null, lines: [`${A.label}の機嫌+5、熱+5、評価-2`] });
      }
      addOpt({ id: 'side_b', name: `${B.label}を支える`, desc: '執行部を擁護する', odds: null, why: null, lines: ['熱-4、評価+1'] });
      if (c.bill && isPartyBillRebellable(p, c)) addOpt({ id: 'rebel', name: '採決で造反する（党議拘束に反して反対票）', desc: '党議拘束違反：評価に大きな傷。反対の声を代弁することになる', odds: null, why: null, lines: ['評価-12（党議拘束違反）、熱+10、賛成者を減らす一票'] });
    }
    if (role !== 'none' && c.level >= 2 && me.party === c.party) addOpt({ id: 'walkout', name: '離党する', desc: `党を離れる。${me.faction && me.faction === c.sideA.fid ? 'あなたの派閥の仲間も行動を共にするかもしれない' : '一人で去ることになる'}`, odds: null, why: null, lines: ['党内の地位を失い、無所属になる（のちに新党を立ち上げることも）'] });
    return out;
  }
  function isPartyBillRebellable(p, c) {
    const b = p.diet.bills.find((x) => x.id === c.bill);
    return !!b && ['committee', 'shugi', 'sangi'].includes(b.stage) && X.isNational && X.isNational(p.me) && !!p.me.party;
  }
  function concedeDesc(c) {
    if (c.kind === 'policy' && c.bill) return '問題の法案を取り下げる（先送り）か、修正に応じる';
    if (c.kind === 'policy') return '党の方針を見直し、批判する側の主張を取り入れる';
    if (c.kind === 'nomination') return '公認を相手の推す候補に譲る';
    if (c.kind === 'responsibility') return '役員を交代させるなど、責任を取る形を整える';
    if (c.kind === 'coalition') return '連立の相手の要求をのむ';
    if (c.kind === 'generation') return '候補者の定年や若手の登用を約束する';
    return '相手の言い分をのむ';
  }
  function concedeLines(c) {
    const A = c.sideA.label, B = c.sideB.label;
    if (c.kind === 'policy' && c.bill) return [`熱-40、${A}の機嫌+10、${B}の機嫌-5`, '法案は先送り（廃案扱い）になる。内閣の看板政策なら支持率にも響く'];
    if (c.kind === 'responsibility') return ['熱-40、役員を1人交代（党内の人事）', `${A}の機嫌+8、${B}の機嫌-6`];
    if (c.kind === 'generation') return ['熱-35、ベテランの機嫌-10、若手の機嫌+10'];
    return [`熱-40、${A}の機嫌+10、${B}の機嫌-5`];
  }
  function actOn(g, p, c, optId) {
    const opts = optionsFor(g, p, c);
    const o = opts.find((x) => x.id === optId);
    if (!o) return { ok: false, why: 'その手は使えない' };
    if (o.why) return { ok: false, why: o.why };
    const S = I(p);
    const pt = p.parties[c.party];
    const me = p.me;
    const day = today(g);
    const fa = c.sideA.fid ? S.fx[c.sideA.fid] : null;
    const fb = c.sideB.fid ? S.fx[c.sideB.fid] : null;
    const win = o.odds == null ? true : Math.random() < o.odds;
    const R = (ok, text, extra = {}) => ({ ok: true, success: ok, text, odds: o.odds, ...extra });
    const stamUse = (n) => { g.state.stamina = Math.max(0, g.state.stamina - n); };
    if (optId === 'mediate') {
      stamUse(8);
      if (win) { c.heat = clamp(c.heat - 22, 0, 100); c.mediated = day; if (fa) fa.mood = clamp(num(fa.mood) + 3, -100, 100); if (fb) fb.mood = clamp(num(fb.mood) + 3, -100, 100); c.log.push({ day, text: '調停が実を結んだ' }); return R(true, `${c.sideA.label}と${c.sideB.label}の言い分を聞き、落としどころを見つけた。ひとまず矛を収めてくれた。`); }
      c.heat = clamp(c.heat + 6, 0, 100); me.standing = clamp(num(me.standing) - 2, 0, 100); c.log.push({ day, text: '調停は不調に終わった' }); return R(false, '双方の溝は埋まらなかった。「調停役が力不足だ」との声も出ている。');
    }
    if (optId === 'concede') {
      stamUse(4);
      let extra = '';
      if (c.kind === 'policy' && c.bill) {
        const b = p.diet.bills.find((x) => x.id === c.bill);
        if (b && !['enacted', 'rejected', 'shelved'].includes(b.stage)) { b.stage = 'shelved'; b.result = '党内の反対で先送り'; b.closed = day; b.log.push({ day, text: '党内の反対を受け、先送りに' }); extra = `「${b.title}」は先送りになった。`; if (b.sponsor === 'cabinet') approvalShift(g, p, -0.6, '法案の先送り', 'policy'); }
      } else if (c.kind === 'responsibility' && pt && pt.leader === 'player') {
        const post = pt.posts.kanjicho ? 'kanjicho' : Object.keys(pt.posts)[0];
        if (post) { const q = fa ? findFaction(p, c.sideA.fid) : null; const m = q ? H.memberOf(g, p, pt, q.f, []) : X.pickMinister(p, pt.id, {}); H.giveParty(g, p, pt, post, m.id); extra = `${X.postName(post, X.fyNow(g), pt.id)}に${m.name}氏を起用した。`; }
      } else if (c.kind === 'coalition') { approvalShift(g, p, -0.4, '連立内の調整', 'policy'); }
      c.heat = clamp(c.heat - 40, 0, 100);
      if (fa) fa.mood = clamp(num(fa.mood) + 10, -100, 100);
      if (fb) fb.mood = clamp(num(fb.mood) - 5, -100, 100);
      me.standing = clamp(num(me.standing) - (c.kind === 'generation' ? 0 : 1), 0, 100);
      closeConflict(g, p, c, 'resolved', '譲歩で収まった');
      return R(true, `${c.sideA.label}の主張を受け入れた。${extra}対立は収まった。`);
    }
    if (optId === 'suppress') {
      stamUse(5);
      if (win) { c.heat = clamp(c.heat - 12, 0, 100); c.resent = num(c.resent) + 18; if (fa) fa.mood = clamp(num(fa.mood) - 8, -100, 100); c.log.push({ day, text: '押さえ込んだ（恨みは残る）' }); return R(true, `党議拘束をかけ、締めつけた。その場は収まったが、${c.sideA.label}の不満はくすぶっている。`); }
      c.heat = clamp(c.heat + 10, 0, 100); if (fa) fa.mood = clamp(num(fa.mood) - 12, -100, 100); c.log.push({ day, text: '押さえ込みは失敗' }); return R(false, '締めつけは逆効果だった。「強権的だ」とかえって反発が強まった。');
    }
    if (optId === 'discipline') {
      stamUse(6);
      if (win) { c.heat = clamp(c.heat - 20, 0, 100); c.sideA.n = Math.max(1, Math.round(num(c.sideA.n) * 0.7)); if (fa) fa.mood = clamp(num(fa.mood) - 14, -100, 100); me.standing = clamp(num(me.standing) + 1, 0, 100); return R(true, '造反しそうな議員に厳重注意を科した。数が減り、熱は下がった。'); }
      c.heat = clamp(c.heat + 14, 0, 100); if (fa) fa.mood = clamp(num(fa.mood) - 18, -100, 100); return R(false, '処分に反発して、離党をちらつかせる議員が増えた。');
    }
    if (optId === 'post') {
      stamUse(4);
      c.heat = clamp(c.heat - 30, 0, 100); approvalShift(g, p, -0.3, '連立相手への配慮', 'policy');
      const core = p.parties[pmPartyId(p)];
      if (core) for (const f of factionsOf(p, core)) { const x = fxOf(g, p, core, f); x.mood = clamp(num(x.mood) - 2, -100, 100); }
      c.log.push({ day, text: '連立相手に配慮した' });
      return R(true, '連立のパートナーに重要ポストと政策での配慮を約束した。与党第1党の内部には「譲りすぎだ」の声もある。');
    }
    if (optId === 'elders') {
      pay(g, p, 2 * U(p)); stamUse(4);
      if (win) { c.heat = clamp(c.heat - 28, 0, 100); c.mediated = day; c.log.push({ day, text: '長老の仲裁で収まった' }); return R(true, '長老が間に入り、「ここは収めよ」とまとめてくれた。'); }
      me.standing = clamp(num(me.standing) - 1, 0, 100); return R(false, '長老は「若い者の問題に口は出さん」と取り合わなかった。');
    }
    if (optId === 'side_a') {
      if (fa) fa.mood = clamp(num(fa.mood) + 5, -100, 100);
      c.heat = clamp(c.heat + 5, 0, 100); me.standing = clamp(num(me.standing) - 2, 0, 100); c.sided = 'a';
      return R(true, `${c.sideA.label}の側に付いた。執行部の目が冷たい。`);
    }
    if (optId === 'side_b') {
      c.heat = clamp(c.heat - 4, 0, 100); me.standing = clamp(num(me.standing) + 1, 0, 100); c.sided = 'b';
      return R(true, `${c.sideB.label}を支える側に回った。`);
    }
    if (optId === 'rebel') {
      const b = p.diet.bills.find((x) => x.id === c.bill);
      if (!b) return { ok: false, why: '法案がもうない' };
      g.vote(b.id, 'no');
      c.heat = clamp(c.heat + 10, 0, 100);
      b.rebel = b.rebel || {};
      b.rebel[c.party] = clamp(num(b.rebel[c.party]) + 1 / Math.max(10, X.partySeats(p, c.party)), 0, 0.5);
      if (fa) fa.mood = clamp(num(fa.mood) + 8, -100, 100);
      return R(true, `「${b.title}」に反対票を投じることにした（採決の日に投じられる）。党議拘束違反で、評価が下がる覚悟が必要だ。`);
    }
    if (optId === 'walkout') {
      const f = me.faction;
      const mate = f && f === c.sideA.fid ? factionsOf(p, pt).find((x) => x.id === f) : null;
      const n = mate ? Math.max(0, num(mate.size) - 1) : 0;
      S.followers = n >= 2 ? { from: pt.id, n: Math.min(n, 12), day, faction: f } : null;
      const why = X.leavePartyImpl(g, p, '離党');
      if (why) return { ok: false, why };
      closeConflict(g, p, c, 'split', 'あなたが離党');
      return R(true, `離党した。${S.followers ? `${S.followers.n}人の仲間が、あなたが新党を立ち上げれば付いていく、と言っている（15日以内）。` : ''}`);
    }
    return { ok: false, why: 'その手はまだない' };
  }
  // when the player founds a party soon after leaving with a faction: the followers come along
  function onPartyFounded(g, p, data) {
    if (!data || !data.player) return;
    const S = I(p);
    const fw = S.followers;
    if (!fw || today(g) - fw.day > 15 || !p.parties[data.party] || !p.parties[fw.from]) return;
    const moved = moveSeats(g, p, fw.from, data.party, fw.n);
    const src = p.parties[fw.from];
    const q = fw.faction ? findFaction(p, fw.faction) : null;
    if (q) q.f.size = Math.max(2, num(q.f.size) - moved);
    S.followers = null;
    if (moved > 0) {
      X.news(p, g, `${src.short}の議員${moved}人が、${g.state.name}氏の新党「${p.parties[data.party].name}」に参加`);
      X.note(g, `（${moved}人の仲間が、あなたの新党に加わった！）`);
      partySupportShift(p, fw.from, -0.003 * Math.min(moved, 10));
      afterSeatLoss(g, p, src);
    }
  }

  // ---------------------------------------------------------------- the step
  function stepConflicts(g, p, day) {
    const S = I(p);
    for (const c of S.conflicts.slice()) if (c.status === 'live') { try { stepOne(g, p, c, 3); } catch (e) { console.error('conflict', e); } }
    genConflicts(g, p, day);
    S.conflicts = S.conflicts.filter((c) => c.status === 'live' || day - num(c.end, day) < 60);
    stanceStep(g, p, day);
  }
  function conflictRow(g, p, c) {
    const pt = p.parties[c.party];
    const opts = c.status === 'live' ? optionsFor(g, p, c) : [];
    const S = I(p);
    const xa = c.sideA.fid ? S.fx[c.sideA.fid] : null;
    return {
      id: c.id, kind: c.kind, kindName: KINDS[c.kind].name, color: KINDS[c.kind].color, party: c.party, partyName: pt ? pt.name : '', partyShort: pt ? pt.short : '', title: c.title, desc: c.desc, topic: c.topic || null,
      heat: Math.round(c.heat), level: c.level, levelName: LADDER[c.level] || LADDER[0], ladder: LADDER.slice(), status: c.status, involves: !!c.involves, start: c.start, end: c.end || null,
      sideA: { ...c.sideA, mood: xa ? Math.round(xa.mood) : null }, sideB: { ...c.sideB }, bill: c.bill || null, policy: c.policy || null, log: (c.log || []).slice(-6), options: opts,
      trend: c.last ? (num(c.drive, 1) > 1 ? '悪化' : '横ばい') : '', risk: c.heat >= 75 ? '分裂の危機' : c.heat >= 50 ? '造反の恐れ' : c.heat >= 25 ? '批判が表に' : '水面下',
    };
  }

  // ================================================================ stances (親中派 / 対中強硬派 / 親米派 / 親ロ派 / 自主外交派 …)
  const STANCE_KEYS = ['cn', 'us', 'ru', 'indep'];
  const STANCE_VOICES = {
    cn_pos: { pro: ['隣国との対話を続けてこそ、経済も安全も安定する。', '貿易や観光の結びつきは大きい。関係を荒らすべきではない。'], con: ['対話ばかりでは、言うべきことが言えなくなるのでは。', '安全保障上の懸念に十分向き合っていない、という見方もある。'] },
    cn_neg: { pro: ['毅然とした姿勢が抑止になる。主権に関わることは譲れない。', '経済と安全は分けて考えるべきだ。'], con: ['対話の窓口を狭め、緊張を高めるおそれがある。', '貿易や観光に影響が出れば、暮らしにも響く。'] },
    us_pos: { pro: ['同盟を軸にしてこそ、抑止力と国際的な信頼が保てる。', '価値観を共有する国との協調が現実的だ。'], con: ['同盟に頼りすぎると、自前の外交の幅が狭まる。', '負担や要求を押しつけられるおそれがある。'] },
    ru_pos: { pro: ['隣国との対話の糸口は、手放すべきではない。', '資源や漁業など、実利の面でも関係は大切だ。'], con: ['国際社会と足並みがそろわず、孤立しかねない。', '同盟国や友好国の懸念を招く。'] },
    ru_neg: { pro: ['国際秩序を守るため、毅然と対応すべきだ。', '他の国々と歩調を合わせることが大切だ。'], con: ['経済やエネルギー、漁業などに跳ね返る。', '対話の窓口がなくなってしまう。'] },
    indep: { pro: ['特定の国に寄りすぎず、国益で判断する外交が必要だ。', '多様なパートナーを持つほうが、交渉力が増す。'], con: ['同盟の信頼が揺らぎ、安全保障が不安定になる。', '「全方位」は、どこからも信頼されない危険がある。'] },
    bal: { pro: ['どの国とも是々非々で付き合う、現実的な外交だ。'], con: ['方針が見えにくい、との声もある。'] },
    korea: { pro: ['歴史や領土の問題があっても、隣国との協調は欠かせない。', '経済でも安全保障でも、協力の余地は大きい。'], con: ['譲歩ばかりでは、国内の理解が得られない。', '主張すべきことは主張すべきだ。'] },
    korea_hawk: { pro: ['主張すべきことは毅然と主張すべきだ。'], con: ['関係の悪化は、経済や安全保障の協力にも響く。'] },
    taiwan: { pro: ['価値観を共有する地域との交流は大切だ。', '経済の結びつきも深い。'], con: ['中国との関係を悪化させるおそれがある。'] },
    multilateral: { pro: ['多くの国と連携するほうが、国際社会で安定した立場を築ける。'], con: ['どの国とも深い関係が築けないのでは、という見方もある。'] },
    nk_dialogue: { pro: ['拉致や核の問題は、対話と交渉なしには動かない。'], con: ['圧力をゆるめると、相手に利用されるおそれがある。'] },
    nk_pressure: { pro: ['制裁や圧力で、相手を交渉の席に着かせるべきだ。'], con: ['対話の窓口がなくなり、事態が動かなくなる。'] },
  };
  // the labels of R5-C (world_stance.js) → the voices above
  const LABEL_KEY = { '親中派': 'cn_pos', '対中強硬派': 'cn_neg', '親米派': 'us_pos', '親ロ派': 'ru_pos', '親ソ派': 'ru_pos', '日韓協調派': 'korea', '対韓強硬派': 'korea_hawk', '台湾重視派': 'taiwan', '国際協調派': 'multilateral', '自主外交派': 'indep', '対北朝鮮対話派': 'nk_dialogue', '対北朝鮮圧力派': 'nk_pressure', '等距離': 'bal' };
  function stanceLabel(vec, year) {
    const tags = [];
    const soviet = year < 1992;
    const R = soviet ? 'ソ' : 'ロ';
    if (vec.cn >= 0.35) tags.push({ id: 'cn_pos', name: '親中派', long: '対中融和（親中派）', w: vec.cn });
    if (vec.cn <= -0.35) tags.push({ id: 'cn_neg', name: '対中強硬派', long: '対中強硬派', w: -vec.cn });
    if (vec.us >= 0.4 && vec.indep < 0.6) tags.push({ id: 'us_pos', name: '親米派', long: '日米同盟重視（親米派）', w: vec.us });
    if (vec.ru >= 0.3) tags.push({ id: 'ru_pos', name: soviet ? '親ソ派' : '親ロ派', long: soviet ? '対ソ融和（親ソ派）' : '対ロ融和（親ロ派）', w: vec.ru });
    if (vec.ru <= -0.4) tags.push({ id: 'ru_neg', name: `対${R === 'ソ' ? 'ソ' : 'ロ'}強硬派`, long: `対${soviet ? 'ソ' : 'ロ'}強硬派`, w: -vec.ru });
    if (vec.indep >= 0.6) tags.push({ id: 'indep', name: '自主外交派', long: '自主外交派', w: vec.indep - 0.1 });
    tags.sort((a, b) => b.w - a.w);
    if (!tags.length) return { label: 'バランス型', long: 'バランス型（全方位）', tags: [], key: 'bal' };
    return { label: tags[0].name, long: tags[0].long, tags: tags.map((t) => t.name), key: tags[0].id, keys: tags.map((t) => t.id) };
  }
  const normVec = (v) => ({ cn: clamp(num(v.cn), -1, 1), us: clamp(num(v.us), -1, 1), ru: clamp(num(v.ru), -1, 1), indep: clamp(num(v.indep), 0, 1) });
  function packStance(vec, year, src) {
    const v = normVec(vec);
    const L = stanceLabel(v, year);
    return { vec: v, label: L.label, long: L.long, tags: L.tags, key: L.key, keys: L.keys || [L.key], src };
  }
  function partyBaseVec(g, p, pt) {
    const sec = num(pt.ideology && pt.ideology.security), eco = num(pt.ideology && pt.ideology.econ), soc = num(pt.ideology && pt.ideology.social);
    if (pt.id === 'jimin') return { cn: 0.0, us: 0.55, ru: -0.1, indep: 0.25 };
    if (pt.id === 'minshu') return { cn: 0.2, us: 0.3, ru: 0.0, indep: 0.45 };
    const h = (k) => (hash01(`${pt.id}:${k}`) - 0.5);
    return { cn: clamp(-sec * 0.28 + h('cn') * 0.5 + (eco < -0.8 ? 0.1 : 0), -0.9, 0.9), us: clamp(sec * 0.3 + 0.1 + h('us') * 0.4, -0.8, 0.9), ru: clamp(-sec * 0.15 + h('ru') * 0.4 + (soc < -0.5 ? 0 : 0), -0.8, 0.7), indep: clamp(0.4 - sec * 0.1 + h('in') * 0.5, 0, 1) };
  }
  // R5-C's g.foreignStance(kind, id) when it exists (kind: player | party | faction | npc | government); its vec has the dialect cn/us/ru/indep (−1..1)
  function remote(g, kind, id) {
    if (typeof g.foreignStance !== 'function') return null;
    try {
      const r = g.foreignStance(kind, id);
      if (r && typeof r === 'object') {
        const vec = r.vec || r;
        if (['cn', 'us', 'ru'].some((k) => Number.isFinite(Number(vec[k])))) return { r, vec: { cn: num(vec.cn), us: num(vec.us), ru: num(vec.ru), indep: num(vec.indep, 0.4) } };
      }
    } catch (e) { /* the local value is used */ }
    return null;
  }
  function packRemote(g, rm, src) {
    const base = packStance(rm.vec, X.polDate(g).year, src);
    const r = rm.r;
    const key = LABEL_KEY[r.label] || base.key;
    return { ...base, label: r.label || base.label, long: r.long || r.label || base.long, tags: Array.isArray(r.labels) && r.labels.length ? r.labels.map((x) => (typeof x === 'string' ? x : x.label)) : base.tags, key, keys: [key], remote: true };
  }
  function stanceOfParty(g, p, pt) {
    { const rm = remote(g, 'party', pt.id); if (rm) return packRemote(g, rm, 'party'); }
    const S = I(p);
    const st = S.stance;
    const key = `party:${pt.id}`;
    if (!obj(st[key])) st[key] = partyBaseVec(g, p, pt);
    return packStance(st[key], X.polDate(g).year, 'party');
  }
  function stanceOfFaction(g, p, pt, f) {
    { const rm = remote(g, 'faction', f.id); if (rm) return packRemote(g, rm, 'faction'); }
    const S = I(p);
    const x = S.fx[f.id];
    if (!x) return null;
    if (!obj(x.stance)) {
      const base = partyBaseVec(g, p, pt);
      x.stance = normVec({ cn: base.cn + (hash01(f.id, 11) - 0.5) * 1.3, us: base.us + (hash01(f.id, 12) - 0.5) * 0.6, ru: base.ru + (hash01(f.id, 13) - 0.5) * 0.8, indep: base.indep + (hash01(f.id, 14) - 0.5) * 0.6 });
    }
    return packStance(x.stance, X.polDate(g).year, 'faction');
  }
  function stanceOfNpc(g, p, n) {
    { const rm = remote(g, 'npc', n.id); if (rm) return packRemote(g, rm, 'npc'); }
    const q = n.faction ? findFaction(p, n.faction) : null;
    const base = q ? stanceOfFaction(g, p, q.pt, q.f).vec : n.party && p.parties[n.party] ? stanceOfParty(g, p, p.parties[n.party]).vec : { cn: 0, us: 0.3, ru: 0, indep: 0.4 };
    return packStance({ cn: base.cn + (hash01(n.id, 21) - 0.5) * 0.4, us: base.us + (hash01(n.id, 22) - 0.5) * 0.3, ru: base.ru + (hash01(n.id, 23) - 0.5) * 0.3, indep: base.indep + (hash01(n.id, 24) - 0.5) * 0.3 }, X.polDate(g).year, 'npc');
  }
  function myVec(g, p) {
    const me = p.me;
    if (!obj(me.stance)) {
      let w = 0;
      try { if (typeof g.ideology === 'function') w = num(g.ideology().axes && g.ideology().axes.world); } catch (e) { w = 0; }
      me.stance = normVec({ cn: -w * 0.5, us: 0.2 + w * 0.2, ru: -w * 0.3, indep: 0.4 });
    }
    return me.stance;
  }
  function stanceOfPlayer(g, p) { const rm = remote(g, 'player', null); if (rm) return packRemote(g, rm, 'player'); return packStance(myVec(g, p), X.polDate(g).year, 'player'); }
  // the stance the government currently follows: the PM's (a player PM: the player's)
  function stanceOfCabinet(g, p) {
    { const rm = remote(g, 'government', null); if (rm) return packRemote(g, rm, 'cabinet'); }
    const pm = p.cabinet.pm;
    if (pm === 'player') return stanceOfPlayer(g, p);
    const n = npcOf(p, pm);
    if (n) return stanceOfNpc(g, p, n);
    const pt = p.parties[pmPartyId(p)];
    return pt ? stanceOfParty(g, p, pt) : packStance({ cn: 0, us: 0.4, ru: 0, indep: 0.3 }, X.polDate(g).year, 'cabinet');
  }
  // kind: 'faction' | 'party' | 'politician' | 'player' | 'cabinet' (R5-C's g.foreignStance is used inside each when it exists)
  function stanceOf(g, kind, id) {
    const p = X.ensurePol(g);
    if (kind === 'party') return p.parties[id] ? stanceOfParty(g, p, p.parties[id]) : null;
    if (kind === 'faction') { const q = findFaction(p, id); return q ? stanceOfFaction(g, p, q.pt, q.f) : null; }
    if (kind === 'politician' || kind === 'npc') { const n = npcOf(p, id); return n ? stanceOfNpc(g, p, n) : null; }
    if (kind === 'player') return stanceOfPlayer(g, p);
    if (kind === 'cabinet') return stanceOfCabinet(g, p);
    return null;
  }
  // segments' views on foreign policy (a rough model of the voters): hawkish ones like the hard line, trade-minded ones the engagement
  const SEG_TRADE = { business: 1, selfemployed: 0.5, farmers: -0.3, employees: 0.5, urban: 0.4, young: 0.2, unions: 0, elderly: 0, rural: -0.2, families: 0, floating: 0.2 };
  // the effects of a stance: relations (per month), trade (growth %/year), opinion by segment, party standing, internal conflict.
  // R5-C's g.worldStanceEffect(vec) is used for the numbers when it returns the same fields; otherwise the local model.
  function stanceEffect(g, p, vec, opts = {}) {
    const v = normVec(vec);
    const year = X.polDate(g).year;
    const tens = worldTension(g);
    const soviet = year < 1992;
    const local = {
      relation: { cn: Math.round(v.cn * 12) / 10, us: Math.round((v.us * 0.7 - v.indep * 0.4) * 10) / 10, ru: Math.round(v.ru * 12) / 10 },
      trade: { cn: Math.round(v.cn * 8) / 100, us: Math.round((v.us * 0.04 + (v.us < 0 ? -0.02 : 0)) * 100) / 100 },
      opinion: {}, party: 0, conflict: 0, lines: [],
    };
    let tot = 0;
    for (const s of SEGMENT_ORDER) {
      const hawk = num(SEGMENTS[s].ideo.security);
      const hard = -v.cn * 0.6 - v.ru * 0.4 + v.us * 0.3;
      const tradeP = (SEG_TRADE[s] || 0) * (v.cn * 0.6 + v.us * 0.4);
      const d = (hawk * hard * (0.8 + (tens - 40) / 100) + tradeP) * 2.2;
      local.opinion[s] = Math.round(d * 10) / 10;
      tot += d * (X.segWeights(year)[s] || 0.09);
    }
    local.party = Math.round(tot * 10) / 10;
    local.conflict = Math.round(clamp(Math.abs(v.cn) * 0.5 + Math.abs(v.ru) * 0.3 + (1 - v.indep) * 0.1, 0, 1) * 100) / 100;
    const cn = v.cn, us = v.us;
    if (Math.abs(cn) >= 0.3) local.lines.push(cn > 0 ? `中国との関係が良くなる方向（月${local.relation.cn > 0 ? '+' : ''}${local.relation.cn}）。貿易は増えるが、安全保障を重視する層は不安視` : `中国との関係が冷える方向（月${local.relation.cn}）。安全保障を重視する層には支持されるが、貿易や観光に響く`);
    if (Math.abs(us) >= 0.3) local.lines.push(us > 0 ? 'アメリカとの協調が深まる。抑止力は高まるが、自前の外交の幅は狭い' : 'アメリカと距離を置く。自立は進むが、同盟への信頼が揺らぐ');
    if (Math.abs(v.ru) >= 0.3) local.lines.push(v.ru > 0 ? `${soviet ? 'ソ連' : 'ロシア'}との対話を重んじる。実利は得やすいが、国際社会との足並みに懸念` : `${soviet ? 'ソ連' : 'ロシア'}に強硬。国際社会とは足並みがそろうが、対話の窓口が狭まる`);
    if (v.indep >= 0.6) local.lines.push('自主外交：特定の国に寄りすぎない。交渉力は増すが、同盟国からは疑われやすい');
    if (!local.lines.length) local.lines.push('バランス型：どの国とも是々非々。大きな追い風も逆風もない');
    let out = local;
    if (typeof g.worldStanceEffect === 'function' && !opts.local) {
      try {
        const r = g.worldStanceEffect(v);
        if (r && typeof r === 'object') out = { ...local, remote: r, relation: obj(r.relation) ? { ...local.relation, ...r.relation } : local.relation, trade: obj(r.trade) ? { ...local.trade, ...r.trade } : local.trade, lines: Array.isArray(r.lines) && r.lines.length ? r.lines : local.lines, source: 'world' };
      } catch (e) { out = local; }
    }
    return out;
  }
  const worldId = (g, id) => (id === 'ru' && X.polDate(g).year < 1992 ? 'su' : id);
  // weekly: the government's stance shifts relations and opinion (small, bounded)
  function stanceStep(g, p, day) {
    const S = I(p);
    if (day - num(S.stanceDay, -99) < 7) return;
    S.stanceDay = day;
    // a player PM steers the government's line: R5-C keeps the override for 40 days, so it is renewed every week
    if (p.cabinet.pm === 'player' && typeof g.setForeignStance === 'function') { try { g.setForeignStance('government', null, { ...stanceOfPlayer(g, p).vec }); } catch (e) { /* ignore */ } }
    const cab = stanceOfCabinet(g, p);
    const fx = stanceEffect(g, p, cab.vec);
    // relations: only when R5-C's own effect is not in use (it would apply its own)
    if (typeof g.worldStanceEffect !== 'function' && g.state && g.state.world && obj(g.state.world.rel)) {
      const W = g.state.world;
      for (const k of ['cn', 'us', 'ru']) {
        const id = worldId(g, k);
        const d = clamp(num(fx.relation[k]) * 0.25, -0.4, 0.4);
        if (d && (W.rel[id] !== undefined || true)) W.rel[id] = clamp(num(W.rel[id]) + d, -100, 100);
      }
    }
    // trade: a small, slow push on growth (a world-kind shock, replaced each month)
    if (day - num(S.tradeDay, -99) >= 30) {
      S.tradeDay = day;
      const g1 = fx.trade.cn + fx.trade.us;
      if (Math.abs(g1) >= 0.03) {
        const abs = (X.absOfDay ? X.absOfDay(p, day) : day);
        p.economy.shocks = (p.economy.shocks || []).filter((s) => s.kind !== 'stance');
        p.economy.shocks.push({ kind: 'stance', name: '外交スタンスの影響', until: abs + 40, len: 40, growth: Math.round(clamp(g1, -0.12, 0.12) * 100) / 100, inflation: 0, unemployment: 0, yen: 0 });
      }
    }
    // opinion: the government parties' standing by segment (tiny per week; it fades like any swing)
    for (const s of SEGMENT_ORDER) {
      const d = fx.opinion[s];
      if (!d) continue;
      for (const id of p.cabinet.partyIds || []) X.addSupport(p, s, id, d * 0.0004);
    }
    // the party line: factions far from the cabinet's stance get restless
    const pt = p.parties[pmPartyId(p)];
    if (pt) for (const f of factionsOf(p, pt)) {
      const x = S.fx[f.id]; if (!x) continue;
      const st = stanceOfFaction(g, p, pt, f);
      if (!st) continue;
      const gap = Math.abs(st.vec.cn - cab.vec.cn) * 0.5 + Math.abs(st.vec.ru - cab.vec.ru) * 0.25 + Math.abs(st.vec.us - cab.vec.us) * 0.25;
      x.mood = clamp(num(x.mood) - (gap - 0.35) * 1.2, -100, 100);
    }
  }
  // the player declares a stance (presets); consequences are shown before by the UI
  const PRESETS = {
    cn_pos: { name: '対中融和（親中派）', vec: { cn: 0.7 }, desc: '対話と経済の結びつきを重んじる。中国との関係は良くなるが、対中強硬派からは警戒される' },
    cn_neg: { name: '対中強硬派', vec: { cn: -0.7 }, desc: '主権と安全を最優先に毅然と対応する。支持は得るが、貿易・観光への影響や緊張の高まりを招く' },
    us_pos: { name: '日米同盟重視（親米派）', vec: { us: 0.75, indep: 0.15 }, desc: '同盟を外交の軸に置く。抑止力と信頼は高まるが、自主外交派とは対立しやすい' },
    ru_pos: { name: '対ロ（ソ）融和', vec: { ru: 0.6 }, desc: '対話の糸口を守る。実利はあるが、国際社会との足並みに懸念' },
    ru_neg: { name: '対ロ（ソ）強硬', vec: { ru: -0.7 }, desc: '国際社会と歩調を合わせ、毅然と対応する。経済・エネルギーに跳ね返ることも' },
    indep: { name: '自主外交', vec: { indep: 0.85, us: 0.05 }, desc: '特定の国に寄りすぎず、国益で判断する。交渉力は増すが、同盟国の疑念を招く' },
    bal: { name: 'バランス型（全方位）', vec: { cn: 0, us: 0.3, ru: 0, indep: 0.4 }, desc: 'どの国とも是々非々。角は立たないが、旗色が見えにくい' },
  };
  function setMyStance(g, p, presetId) {
    const P = PRESETS[presetId];
    if (!P) return { ok: false, why: 'その外交スタンスはない' };
    const S = I(p);
    const day = today(g);
    if (day - num(S.stanceSet, -99) < 20) return { ok: false, why: `外交スタンスをたびたび変えると信用を失う（${Math.max(1, 20 - (day - S.stanceSet))}日後に変えられる）` };
    const v = { ...stanceOfPlayer(g, p).vec };
    for (const [k, val] of Object.entries(P.vec)) v[k] = val;
    p.me.stance = normVec(v);
    S.stanceSet = day;
    if (typeof g.setForeignStance === 'function') { try { g.setForeignStance('player', null, { ...p.me.stance }); } catch (e) { /* ignore */ } }
    // standing in the factions: agreeing camps like it, disagreeing camps do not
    const pt = myParty(p);
    const lines = [];
    if (pt) {
      for (const f of factionsOf(p, pt)) {
        const st = stanceOfFaction(g, p, pt, f);
        if (!st) continue;
        const gap = Math.abs(st.vec.cn - p.me.stance.cn) + Math.abs(st.vec.ru - p.me.stance.ru) * 0.5 + Math.abs(st.vec.us - p.me.stance.us) * 0.5;
        const x = fxOf(g, p, pt, f);
        if (gap < 0.5) x.mood = clamp(num(x.mood) + 2, -100, 100);
        else if (gap > 1.3) x.mood = clamp(num(x.mood) - 2, -100, 100);
      }
    }
    const fx = stanceEffect(g, p, p.me.stance);
    p.me.reputation = clamp(num(p.me.reputation) + (P.vec.indep ? 0 : 0), -100, 100);
    return { ok: true, text: `外交スタンスを「${P.name}」にした。\n${fx.lines.join('\n')}`, stance: packStance(p.me.stance, X.polDate(g).year, 'player'), effect: fx, lines };
  }
  function stanceVoices(key) {
    const k = String(key || 'bal');
    return STANCE_VOICES[k] || STANCE_VOICES.bal;
  }
  // an overview of every camp's stance in a party, for the UI
  function stanceBoard(g, pid) {
    const p = X.ensurePol(g);
    const pt = (pid && p.parties[pid]) || myParty(p) || p.parties[pmPartyId(p)];
    if (!pt) return null;
    H.ensureFactions(g, p, pt);
    const cab = stanceOfCabinet(g, p);
    const mine = stanceOfPlayer(g, p);
    return {
      party: pt.id, partyName: pt.name, partyStance: stanceOfParty(g, p, pt), cabinet: cab, me: mine, myEffect: stanceEffect(g, p, mine.vec), cabEffect: stanceEffect(g, p, cab.vec),
      factions: factionsOf(p, pt).map((f) => ({ id: f.id, name: f.name, size: f.size, leaderName: npcName(p, g, f.leader), stance: stanceOfFaction(g, p, pt, f) })),
      presets: Object.entries(PRESETS).map(([id, v]) => ({ id, name: v.name, desc: v.desc })), world: (() => { try { const w = typeof g.world === 'function' ? g.world() : null; return w ? { tension: w.tension, tensionLabel: w.tensionLabel } : null; } catch (e) { return null; } })(),
      remote: typeof g.foreignStance === 'function' || typeof g.worldStanceEffect === 'function',
    };
  }

  X.approvalShift = approvalShift;
  X.stepEvents = stepEvents;
  X.stepConflicts = stepConflicts;
  X.pushEvent = pushEvent;
  X.factionDefects = factionDefects;
  X.stanceOfFaction = stanceOfFaction;
  X.stanceOfNpc = stanceOfNpc;
  const methods = {
    conflicts(opts = {}) {
      const p = X.ensurePol(this);
      const S = I(p);
      let list = S.conflicts.slice();
      if (opts.live) list = list.filter((c) => c.status === 'live');
      if (opts.party) list = list.filter((c) => c.party === opts.party);
      if (opts.mine) { const pt = myParty(p); list = list.filter((c) => c.involves || (pt && c.party === pt.id)); }
      return list.sort((a, b) => (b.status === 'live') - (a.status === 'live') || b.heat - a.heat).map((c) => conflictRow(this, p, c));
    },
    conflictOptions(id) { const p = X.ensurePol(this); const c = I(p).conflicts.find((x) => x.id === id); return c ? optionsFor(this, p, c) : []; },
    conflictAct(id, optId) { const p = X.ensurePol(this); const c = I(p).conflicts.find((x) => x.id === id); return c ? actOn(this, p, c, optId) : { ok: false, why: 'その紛争はもうない' }; },
    intraEvents() { return eventRows(this, X.ensurePol(this)); },
    intraAnswer(id, choiceId) { return answerEvent(this, X.ensurePol(this), id, choiceId); },
    stanceOf(kind, id) { return stanceOf(this, kind, id); },
    stanceBoard(pid) { return stanceBoard(this, pid); },
    stanceEffectOf(vec) { return stanceEffect(this, X.ensurePol(this), vec || {}, {}); },
    setMyStance(presetId) { return setMyStance(this, X.ensurePol(this), presetId); },
    stanceVoices(key) { return stanceVoices(key); },
    stancePresets() { return Object.entries(PRESETS).map(([id, v]) => ({ id, name: v.name, desc: v.desc })); },
  };
  H.methods = { ...H.methods, ...methods };
  H.onPartyFounded = onPartyFounded;
  H.conflictRow = conflictRow;
  H.stanceLabel = stanceLabel;
  H.KINDS = KINDS;
  H.LADDER = LADDER;
  return H;
}
