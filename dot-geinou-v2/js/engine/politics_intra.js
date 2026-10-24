// 党内の権力争い (intra-party power struggle) — engine part of agent R5-D.
//
// Installed by js/engine/politics.js (installIntra(X): X is the context of helpers politics.js passes in, so this
// file never imports politics.js and needs no registry line). State: g.state.politics.intra (saved with the game, old
// saves get the defaults on first use). Everything here is generic NPC politics: every person and faction is
// fictional ("<surname>派" / "<surname>グループ"); real parties (自民・民主) are portrayed only with such generic
// factions and never with misconduct. Content of the 暴露 move for a real party's rival is a policy flip-flop, not
// a scandal.
//
// What it does (all rate-limited; no message floods):
//  - faction map: size, posts, money, 番頭 (right-hand), mood towards the leadership, intent, demand, ambition
//  - 倒閣運動 / 党首おろし: a rival bloc plots to topple the PM / party leader (odds shown); the player defends,
//    joins, or starts one; stages whisper → open → vote
//  - moves: 結集 / 懐柔 / 切り崩し / 恩を売る / 人事で報いる / 報復 / 暴露 / 派閥の旗揚げ with visible odds
//  - 領袖の世代交代 (succession), 党役員人事 as bargaining (claims), 引き抜き, 離党の動き
// The conflicts / events / 外交スタンス live in politics_conflict.js (it extends the object returned here).

export function installIntra(X) {
  const { clamp, num, rnd, irnd, pickOne, gauss, YEAR_DAYS, ERAS, PARTY_DEFS, POSTS, PARTY_POST_ORDER, ELECTION_KINDS } = X;
  const IND = 'ind';
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const today = (g) => (g.state && g.state.day) || 1;

  // ---------------------------------------------------------------- state
  function I(p) {
    let s = p.intra;
    if (!obj(s)) s = p.intra = {};
    s.v = 1;
    for (const k of ['fx', 'par', 'cool', 'quiet', 'claims', 'stance']) if (!obj(s[k])) s[k] = {};
    for (const k of ['log', 'deals', 'conflicts', 'events', 'legis', 'hist']) if (!Array.isArray(s[k])) s[k] = [];
    if (!(s.nextId > 0)) s.nextId = 1;
    if (s.plot !== null && s.plot !== undefined && !obj(s.plot)) s.plot = null;
    if (s.plot === undefined) s.plot = null;
    if (!obj(s.stats)) s.stats = { toppled: 0, defended: 0, plotted: 0, rebels: 0, splits: 0, defected: 0 };
    return s;
  }
  const nid = (p, pre) => `${pre}${I(p).nextId++}`;
  const U = (p) => Math.round(1000000 / ((ERAS[p.era] || ERAS.reiwa).priceRate || 1)); // ¥100万 in that era's yen
  const fundsOf = (g, p) => num(p.me.funds) + num(g.state.money);
  function pay(g, p, n) {
    n = Math.round(n);
    if (n <= 0) return true;
    if (fundsOf(g, p) < n) return false;
    const f = Math.min(num(p.me.funds), n);
    p.me.funds -= f;
    g.state.money -= n - f;
    return true;
  }
  const fmt = (g, n) => X.fmtMoney(n);
  // a hash in 0..1 for stable per-id randomness
  function hash01(s, salt = 0) {
    let h = 2166136261 ^ salt;
    for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  // rate limit: true when `key` was used less than `gap` days ago (and marks it used otherwise)
  function quiet(g, p, key, gap) {
    const s = I(p);
    const d = today(g);
    if (num(s.quiet[key], -999) > d - gap) return true;
    s.quiet[key] = d;
    return false;
  }
  function newsQ(g, p, key, gap, text) { if (!quiet(g, p, `n:${key}`, gap)) X.news(p, g, text); }
  function logLine(g, p, text) { const s = I(p); s.log.unshift({ day: today(g), text }); if (s.log.length > 40) s.log.length = 40; }

  // ---------------------------------------------------------------- roles & lookups
  const isNat = (me) => me.office === 'shugi' || me.office === 'sangi';
  function myParty(p) { return p.parties[p.me.party] || null; }
  // 'leader' (党首・総裁), 'exec' (a party post), 'member' (a Diet member), 'none'
  function roleOf(p, pt) {
    const me = p.me;
    if (!pt || me.party !== pt.id) return 'none';
    if (pt.leader === 'player') return 'leader';
    if (Object.values(pt.posts || {}).includes('player')) return 'exec';
    return isNat(me) ? 'member' : 'none';
  }
  function npcName(p, g, id) { return id === 'player' ? g.state.name : (p.npcs[id] && p.npcs[id].name) || ''; }
  function npcOf(p, id) { return id && id !== 'player' ? p.npcs[id] || null : null; }
  const pmPartyId = (p) => X.cabinetPartyOfPM(p);
  const isPMParty = (p, pt) => !!pt && pmPartyId(p) === pt.id;
  function leaderFaction(p, pt) {
    if (!pt) return null;
    if (pt.leader === 'player') return p.me.faction || null;
    const n = npcOf(p, pt.leader);
    return n && n.faction ? n.faction : null;
  }
  function facWord(g, pt) { return pt.id === 'jimin' && X.polDate(g).year < 2024 ? '派' : 'グループ'; }

  // ---------------------------------------------------------------- ideology axes (7 axes of ideology.js, -1..1)
  const AX = ['econ', 'power', 'social', 'world', 'env', 'nation', 'tech'];
  function partyAxes(g, p, pid) {
    try {
      if (typeof g.ideologyOf === 'function') {
        const r = g.ideologyOf('party', pid);
        if (r && r.axes) return { ...r.axes };
      }
    } catch (e) { /* fall through */ }
    const pt = p.parties[pid];
    const a = (pt && pt.ideology) || {};
    return { econ: clamp(num(a.econ) / 2, -1, 1), power: 0, social: clamp(num(a.social) / 2, -1, 1), world: clamp(num(a.security) / 2, -1, 1), env: 0, nation: 0, tech: 0 };
  }
  function policyAxes(policyId) {
    try { if (X.policyAxes) { const r = X.policyAxes(policyId); if (r) return r; } } catch (e) { /* fall through */ }
    const pl = X.POLICIES[policyId];
    const v = (pl && pl.ideo) || {};
    return { econ: num(v.econ), social: num(v.social), world: num(v.security) };
  }
  // agreement of a faction's axes with a policy's (+ = agrees)
  function agree(axes, pax) { let s = 0; for (const k of AX) s += num(axes[k]) * num(pax[k]); return s; }

  // ---------------------------------------------------------------- factions
  function makeNpcFor(p, pt, f, def = {}) {
    const n = X.newNpc(p, { party: pt.id, house: 'shugi', office: 'shugi', faction: f.id, wins: irnd(4, 9), age: irnd(46, 62), charisma: irnd(45, 82), ambition: irnd(40, 88), ...def });
    n.office = n.house || 'shugi';
    return n;
  }
  function ensureFactions(g, p, pt) {
    if (!Array.isArray(pt.factions)) pt.factions = [];
    const seats = X.partySeats(p, pt.id);
    if (!pt.factions.length && seats >= 14) {
      // a party without factions gets two groups (主流と非主流), so the struggles have sides
      const word = 'グループ';
      const left = Math.max(2, seats - 1);
      const shares = [rnd(0.5, 0.8), rnd(0.35, 0.6)];
      pt.factions = shares.map((s, i) => {
        const boss = i === 0 && pt.leader !== 'player' && npcOf(p, pt.leader) ? npcOf(p, pt.leader) : X.newNpc(p, { party: pt.id, house: 'shugi', office: 'shugi', charisma: irnd(45, 85), wins: irnd(5, 12), age: irnd(55, 74) });
        const f = { id: `${pt.id}_f${i + 1}`, name: `${boss.name.split(' ')[0]}${word}`, leader: boss.id, size: Math.max(2, Math.round(left * 0.7 * s / (shares[0] + shares[1]))), funds: 0, kind: 'group' };
        boss.faction = f.id;
        boss.office = boss.office || 'shugi';
        return f;
      });
    }
    // a faction whose boss has left the party (a split, a defection) gets a new boss from its own members
    for (const f of pt.factions) {
      if (f.leader === 'player') continue;
      const old = npcOf(p, f.leader);
      if (old && old.party === pt.id) continue;
      const pool = Object.values(p.npcs).filter((n) => n.party === pt.id && n.faction === f.id && n.id !== f.leader && (n.office === 'shugi' || n.office === 'sangi')).sort((a, b) => num(b.wins) - num(a.wins));
      const nb = pool[0] || makeNpcFor(p, pt, f, { wins: irnd(5, 10), age: irnd(52, 68) });
      f.leader = nb.id; nb.faction = f.id;
      const sur = old ? String(old.name).split(' ')[0] : null;
      if (sur && String(f.name).startsWith(sur) && /グループ$/.test(f.name)) f.name = `${String(nb.name).split(' ')[0]}グループ`;
      const x = I(p).fx[f.id];
      if (x) { x.bantou = null; x.heir = null; }
    }
    for (const f of pt.factions) fxOf(g, p, pt, f);
  }
  function fxOf(g, p, pt, f) {
    const s = I(p);
    let x = s.fx[f.id];
    if (!obj(x)) {
      const boss = npcOf(p, f.leader);
      const base = partyAxes(g, p, pt.id);
      const axes = {};
      AX.forEach((k, i) => { axes[k] = Math.round(clamp(num(base[k]) + (hash01(f.id, i + 1) - 0.5) * (['econ', 'social', 'world', 'nation'].includes(k) ? 0.9 : 0.5), -1, 1) * 100) / 100; });
      x = s.fx[f.id] = {
        mood: Math.round(gauss() * 6) + (leaderFaction(p, pt) === f.id ? 14 : 0), ambition: clamp(Math.round((boss ? num(boss.traits.ambition, 50) : 50) + gauss() * 8), 5, 98),
        bantou: null, heir: null, axes, demand: null, owe: 0, grudge: 0, intent: 'wait', since: today(g), cohesion: Math.round(rnd(52, 78)), stance: null, lastDemand: -99, kind: f.kind || 'group',
      };
    }
    if (!x.axes || !obj(x.axes)) x.axes = Object.fromEntries(AX.map((k) => [k, 0]));
    if (!x.bantou || !p.npcs[x.bantou]) {
      const b = makeNpcFor(p, pt, f, {});
      x.bantou = b.id;
    }
    x.mood = clamp(num(x.mood), -100, 100); x.owe = clamp(num(x.owe), 0, 9); x.grudge = clamp(num(x.grudge), 0, 100); x.ambition = clamp(num(x.ambition, 50), 0, 100);
    return x;
  }
  function factionsOf(p, pt) { return (pt && pt.factions) || []; }
  function findFaction(p, fid) {
    for (const pt of Object.values(p.parties)) { const f = (pt.factions || []).find((x) => x.id === fid); if (f) return { f, pt }; }
    return null;
  }
  // posts held by the members of a faction
  function postsOfFaction(p, pt, f) {
    const out = { party: [], cabinet: [], pm: false, leader: false };
    const mine = (who) => (who === 'player' ? p.me.faction === f.id : npcOf(p, who) && npcOf(p, who).faction === f.id);
    for (const [post, who] of Object.entries(pt.posts || {})) if (who && mine(who)) out.party.push(post);
    for (const [post, who] of Object.entries(p.cabinet.ministers || {})) {
      if (!who) continue;
      const party = who === 'player' ? p.me.party : npcOf(p, who) && npcOf(p, who).party;
      if (party === pt.id && mine(who)) out.cabinet.push(post);
    }
    if (isPMParty(p, pt) && p.cabinet.pm && mine(p.cabinet.pm)) out.pm = true;
    if (pt.leader && mine(pt.leader)) out.leader = true;
    return out;
  }
  function powerOf(g, p, pt, f) {
    const x = fxOf(g, p, pt, f);
    const ps = postsOfFaction(p, pt, f);
    const boss = npcOf(p, f.leader);
    return Math.round((num(f.size) + 5 * ps.party.length + 3 * ps.cabinet.length + (ps.pm ? 10 : 0) + (ps.leader ? 8 : 0) + num(f.funds) / 10000000 + (boss ? num(boss.traits.charisma, 50) / 25 : 2) + (x.bantou ? 1.5 : 0)) * 10) / 10;
  }
  const INTENT = { loyal: '支持', wait: '様子見', bargain: 'ポストを要求', plot: '倒閣に傾く', defect: '離党も辞さない' };
  function intentOf(x) {
    const m = num(x.mood), a = num(x.ambition);
    if (m <= -62 && a >= 62) return 'defect';
    if (m <= -34 && a >= 40) return 'plot';
    if (m <= -14) return 'bargain';
    if (m >= 16) return 'loyal';
    return 'wait';
  }
  const moodWord = (m) => (m >= 35 ? '厚い信頼' : m >= 16 ? '協力的' : m > -14 ? '中立' : m > -34 ? '不満' : m > -62 ? '強い不満' : '決裂寸前');
  const moodColor = (m) => (m >= 16 ? 'good' : m > -14 ? 'dim' : m > -34 ? 'warn' : 'bad');

  // the rows the UI shows (one per faction), sorted by power
  function factionRows(g, p, pt) {
    ensureFactions(g, p, pt);
    const seatsTot = Math.max(1, X.partySeats(p, pt.id));
    const lf = leaderFaction(p, pt);
    const rows = factionsOf(p, pt).map((f) => {
      const x = fxOf(g, p, pt, f);
      const ps = postsOfFaction(p, pt, f);
      const boss = npcOf(p, f.leader);
      const bant = npcOf(p, x.bantou);
      let stance = null;
      try { stance = X.stanceOfFaction ? X.stanceOfFaction(g, p, pt, f) : null; } catch (e) { stance = null; }
      return {
        id: f.id, name: f.name, kind: f.kind || 'group', word: f.kind === 'faction' ? '派閥' : 'グループ', party: pt.id,
        leader: f.leader, leaderName: npcName(p, g, f.leader) || '（空席）', leaderAge: boss ? boss.age : null, leaderWins: boss ? boss.wins : null,
        bantou: x.bantou, bantouName: bant ? bant.name : '', bantouAge: bant ? bant.age : null,
        size: num(f.size), share: Math.round((num(f.size) / seatsTot) * 1000) / 10, funds: num(f.funds),
        posts: ps, postCount: ps.party.length + ps.cabinet.length + (ps.pm ? 1 : 0) + (ps.leader ? 1 : 0),
        power: powerOf(g, p, pt, f), mood: Math.round(x.mood), moodWord: moodWord(x.mood), moodTone: moodColor(x.mood),
        intent: x.intent, intentLabel: INTENT[x.intent] || '様子見', ambition: Math.round(x.ambition), demand: x.demand ? { ...x.demand } : null,
        owe: x.owe, grudge: Math.round(x.grudge), heir: x.heir, mine: p.me.faction === f.id, isLeaderFaction: lf === f.id,
        stance, axes: { ...x.axes }, cohesion: Math.round(x.cohesion),
      };
    });
    rows.sort((a, b) => b.power - a.power);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  // ---------------------------------------------------------------- posts and claims (党役員人事 as bargaining)
  const POST_ORDER = () => PARTY_POST_ORDER;
  function postsAvailable(pt) { return POST_ORDER().filter((x) => !(POSTS[x].parties && !POSTS[x].parties.includes(pt.id))); }
  // a member of a faction who can hold a post (the 番頭, the boss, or a generated colleague)
  function memberOf(g, p, pt, f, avoid = []) {
    const x = fxOf(g, p, pt, f);
    const pool = Object.values(p.npcs).filter((n) => n.party === pt.id && n.faction === f.id && (n.office === 'shugi' || n.office === 'sangi') && !avoid.includes(n.id));
    // prefer someone not yet holding a post
    const free = pool.filter((n) => !(n.posts || []).some((q) => POSTS[q] && POSTS[q].kind === 'party'));
    if (free.length) return pickOne(free);
    if (pool.length) return pickOne(pool);
    return makeNpcFor(p, pt, f, {});
  }
  function giveParty(g, p, pt, post, npcId) {
    const old = pt.posts[post];
    if (old && old !== 'player' && p.npcs[old]) p.npcs[old].posts = (p.npcs[old].posts || []).filter((x) => x !== post);
    if (old === 'player') p.me.posts = p.me.posts.filter((x) => x !== post);
    pt.posts[post] = npcId;
    if (npcId === 'player') { if (!p.me.posts.includes(post)) p.me.posts.push(post); }
    else if (p.npcs[npcId]) { p.npcs[npcId].posts = p.npcs[npcId].posts || []; if (!p.npcs[npcId].posts.includes(post)) p.npcs[npcId].posts.push(post); }
  }
  // After a new leader (or on a vacancy): the NPC leader gives the party posts out by the balance of power.
  function postRound(g, p, pt, why = '') {
    if (pt.leader === 'player') return;
    ensureFactions(g, p, pt);
    const fs = factionsOf(p, pt);
    if (!fs.length) return;
    const lf = leaderFaction(p, pt);
    const rows = fs.map((f) => ({ f, w: num(f.size) + (f.id === lf ? 14 : 0) + rnd(0, 6) })).sort((a, b) => b.w - a.w);
    const taken = [];
    const posts = postsAvailable(pt);
    const got = [];
    posts.forEach((post, i) => {
      // the biggest factions are served first; a faction that has already got two posts waits
      const cand = rows.find((r) => got.filter((q) => q === r.f.id).length < (i < 2 ? 1 : 2)) || rows[i % rows.length];
      const m = memberOf(g, p, pt, cand.f, taken);
      taken.push(m.id);
      giveParty(g, p, pt, post, m.id);
      got.push(cand.f.id);
    });
    // moods follow the new line-up
    for (const f of fs) {
      const x = fxOf(g, p, pt, f);
      const n = got.filter((q) => q === f.id).length;
      x.mood = clamp(num(x.mood) + (n ? 6 + n * 3 : f.id === lf ? 4 : -7), -100, 100);
      x.demand = null;
    }
    if (why) {
      const kj = pt.posts.kanjicho, sc = pt.posts.seichokai;
      const nm = (id) => (id === 'player' ? '' : p.npcs[id] ? `${p.npcs[id].name}氏` : '');
      if (!quiet(g, p, `round:${pt.id}`, 20)) X.news(p, g, `${pt.short || pt.name}の新しい執行部：${kj ? `${X.postName('kanjicho', X.fyNow(g), pt.id)}に${nm(kj)}` : ''}${sc ? `、${X.postName('seichokai', X.fyNow(g), pt.id)}に${nm(sc)}` : ''}（${why}）`);
    }
  }
  // factions' demands: a faction that is short of posts asks for one
  function claimFor(g, p, pt, f, x) {
    if (x.demand || today(g) - num(x.lastDemand, -99) < 18) return;
    const posts = postsAvailable(pt);
    const ps = postsOfFaction(p, pt, f);
    if (ps.party.length >= 1 && Math.random() < 0.7) return;
    const wanted = pickOne(posts.filter((q) => !ps.party.includes(q)).slice(0, 3)) || posts[0];
    if (!wanted) return;
    x.demand = { post: wanted, since: today(g), until: today(g) + 24 };
    x.lastDemand = today(g);
  }

  // ---------------------------------------------------------------- rivals (ambitious NPCs)
  function rivalRows(g, p, pt) {
    ensureFactions(g, p, pt);
    const rows = factionRows(g, p, pt);
    const byF = Object.fromEntries(rows.map((r) => [r.id, r]));
    const out = new Map();
    const pmId = p.cabinet.pm;
    const addNpc = (id, role, fid) => {
      const n = npcOf(p, id);
      if (!n || out.has(id) || id === pt.leader) return;
      const fr = byF[fid || n.faction] || null;
      const x = fr ? p.intra.fx[fr.id] : null;
      const amb = num(n.traits && n.traits.ambition, 50) * 0.5 + (x ? num(x.ambition) * 0.5 : 25);
      const powerShare = fr ? fr.power / Math.max(1, rows.reduce((a, r) => a + r.power, 0)) : 0.05;
      const sour = x ? clamp(-num(x.mood) / 60, 0, 1.2) : 0.2;
      const threat = clamp(Math.round(amb * 0.5 + powerShare * 140 * (0.5 + sour) - (x && x.mood > 20 ? 14 : 0)), 0, 100);
      out.set(id, {
        id, name: n.name, age: n.age, wins: n.wins, role, faction: fr ? fr.name : '', factionId: fr ? fr.id : null, ambition: Math.round(amb), threat,
        intent: fr ? fr.intent : 'wait', intentLabel: fr ? fr.intentLabel : '様子見', mood: fr ? fr.mood : 0, powerShare: Math.round(powerShare * 100),
        charisma: num(n.traits && n.traits.charisma, 50), integrity: num(n.traits && n.traits.integrity, 50),
        grudge: x ? Math.round(x.grudge) : 0, isBoss: !!(fr && fr.leader === id), isPM: id === pmId, post: (n.posts || []).filter((q) => POSTS[q]).map((q) => X.postName(q, X.fyNow(g), pt.id)).slice(0, 2).join('・'),
      });
    };
    for (const r of rows) { addNpc(r.leader, '領袖', r.id); if (r.bantou) addNpc(r.bantou, '番頭', r.id); }
    for (const [post, who] of Object.entries(pt.posts || {})) if (who && who !== 'player') addNpc(who, X.postName(post, X.fyNow(g), pt.id), null);
    const list = [...out.values()].sort((a, b) => b.threat - a.threat);
    return list.slice(0, 10);
  }

  // ---------------------------------------------------------------- the plot (倒閣運動 / 党首おろし)
  const PLOT_STAGE = { whisper: 'ひそひそ（水面下）', open: '公然化', vote: '決着' };
  function plotParty(p) { const s = I(p); return s.plot ? p.parties[s.plot.party] || null : null; }
  function supportCount(g, p, pt, plot) {
    const rows = factionRows(g, p, pt);
    const bloc = new Set(plot.bloc || []);
    const lf = leaderFaction(p, pt);
    let S = 0, L = 0;
    const seats = Math.max(1, X.partySeats(p, pt.id));
    let counted = 0;
    for (const r of rows) {
      const x = p.intra.fx[r.id];
      if (bloc.has(r.id)) { S += r.size * (0.55 + clamp(num(x.cohesion), 0, 100) / 260); }
      else if (r.id === lf || r.mood > -8) L += r.size * (r.id === lf ? 1 : 0.86);
      else { S += r.size * 0.25; L += r.size * 0.45; }
      counted += r.size;
    }
    // members outside every faction lean to the leadership
    const rest = Math.max(0, seats - counted);
    L += rest * 0.55; S += rest * 0.2;
    S += num(plot.shift && plot.shift.S);
    L += num(plot.shift && plot.shift.L);
    return { S: Math.max(0, S), L: Math.max(0, L), seats };
  }
  function plotOdds(g, p, plot) {
    const pt = p.parties[plot.party];
    if (!pt) return { odds: 0, reasons: [] };
    const { S, L } = supportCount(g, p, pt, plot);
    const share = S / Math.max(1, S + L);
    const C = p.cabinet;
    const pmT = plot.target === 'pm';
    const A = pmT ? num(C.approval, 45) : 45 + clamp(num(plot.slump, 0), -15, 15);
    const nextVote = (p.elections.upcoming || []).filter((e) => (e.kind === 'shugi' || e.kind === 'sangi') && e.status !== 'done').reduce((a, e) => Math.min(a, e.day - today(g)), 9999);
    const reasons = [];
    let z = (share - 0.5) * 7.5;
    reasons.push({ label: `倒閣派 ${Math.round(S)}人 対 擁護派 ${Math.round(L)}人`, v: Math.round((share - 0.5) * 7.5 * 10) / 10 });
    const ap = (35 - A) / 22;
    z += ap;
    reasons.push({ label: pmT ? `内閣支持率 ${Math.round(A)}%` : `党の勢い`, v: Math.round(ap * 10) / 10 });
    if (nextVote < 80) { const ev = clamp((80 - nextVote) / 80, 0, 1) * 0.5 * (A < 40 ? 1 : -0.4); z += ev; reasons.push({ label: `選挙まで${nextVote}日（「選挙の顔」を代えたい声）`, v: Math.round(ev * 10) / 10 }); }
    if (plot.stage === 'whisper') { z -= 0.35; reasons.push({ label: 'まだ水面下（数が固まっていない）', v: -0.35 }); }
    const boss = npcOf(p, plot.boss);
    const bc = plot.boss === 'player' ? (num(p.me.standing) - 40) / 80 : boss ? (num(boss.traits.charisma, 50) - 55) / 60 : 0;
    z += bc; reasons.push({ label: '首謀者の人望', v: Math.round(bc * 10) / 10 });
    const odds = clamp(1 / (1 + Math.exp(-z)), 0.03, 0.95);
    return { odds, S, L, share, reasons };
  }
  function plotInfo(g, p) {
    const s = I(p);
    const plot = s.plot;
    if (!plot) return null;
    const pt = p.parties[plot.party];
    if (!pt) return null;
    const o = plotOdds(g, p, plot);
    const day = today(g);
    const bossName = npcName(p, g, plot.boss);
    return {
      id: plot.id, party: plot.party, partyName: pt.name, target: plot.target, targetId: plot.targetId, targetName: plot.targetId === 'player' ? g.state.name : npcName(p, g, plot.targetId),
      boss: plot.boss, bossName, bossFaction: plot.bossFaction, bloc: (plot.bloc || []).slice(), blocNames: (plot.bloc || []).map((id) => { const q = findFaction(p, id); return q ? q.f.name : id; }),
      stage: plot.stage, stageLabel: PLOT_STAGE[plot.stage] || plot.stage, start: plot.start, voteAt: plot.voteAt, daysLeft: Math.max(0, plot.voteAt - day),
      S: Math.round(o.S), L: Math.round(o.L), odds: Math.round(o.odds * 1000) / 10, reasons: o.reasons, side: plot.side, log: (plot.log || []).slice(-6), mine: plot.targetId === 'player', playerBoss: plot.boss === 'player',
      text: plot.target === 'pm' ? `${bossName}氏らの「倒閣」の動き（${plot.targetId === 'player' ? 'あなたの' : ''}退陣要求）` : `${bossName}氏らの党首おろしの動き`,
    };
  }
  function plotLog(g, p, plot, text) { plot.log = plot.log || []; plot.log.push({ day: today(g), text }); if (plot.log.length > 12) plot.log.shift(); }
  // start a plot in party pt against its leader / PM. boss: npc id or 'player'; blocIds: faction ids
  function startPlot(g, p, pt, boss, bloc, opts = {}) {
    const s = I(p);
    if (s.plot) return null;
    const day = today(g);
    const pmT = isPMParty(p, pt) && p.cabinet.pm && p.cabinet.pm === pt.leader && !p.cabinet.resigned;
    const plot = {
      id: nid(p, 'pl'), party: pt.id, target: pmT ? 'pm' : 'leader', targetId: pt.leader, boss, bossFaction: boss === 'player' ? p.me.faction : (npcOf(p, boss) || {}).faction || null,
      bloc: (bloc || []).filter(Boolean), stage: 'whisper', start: day, openAt: day + irnd(4, 7), voteAt: day + irnd(14, 20), shift: { S: 0, L: 0 }, log: [], side: opts.side || 'none', slump: num(opts.slump),
      lastMove: -99, touched: {},
    };
    s.plot = plot;
    plotLog(g, p, plot, `${npcName(p, g, boss) || 'ある議員'}氏らが、水面下で動き出した`);
    s.stats.plotted++;
    const tgt = pt.leader === 'player' ? 'あなた' : npcName(p, g, pt.leader);
    if (pt.leader === 'player') {
      X.note(g, `（党内から不穏な動きが…。${npcName(p, g, boss)}氏らが${plot.target === 'pm' ? '「総理おろし」' : '党首の交代'}をにおわせている。「党内」の画面で対応を）`);
      X.phoneNews(g, `【党内の動き】${pt.name}内で、${plot.target === 'pm' ? '総理' : '党首'}の退陣を求める動きが水面下で広がっています。`, 'ドット新聞 政治部');
    } else if (!quiet(g, p, `plotnews:${pt.id}`, 25)) X.news(p, g, `${pt.short}内で${plot.target === 'pm' ? `${tgt}総理の退陣を求める` : `${tgt}${pt.leaderTitle || '党首'}の交代を求める`}動き`);
    logLine(g, p, `${pt.short}で${plot.target === 'pm' ? '倒閣' : '党首おろし'}の動き（首謀：${npcName(p, g, boss)}）`);
    return plot;
  }
  function endPlot(g, p, result, text) {
    const s = I(p);
    const plot = s.plot;
    if (!plot) return;
    plot.result = result;
    plotLog(g, p, plot, text);
    s.hist.unshift({ id: plot.id, day: today(g), party: plot.party, target: plot.target, boss: plot.boss, bossName: npcName(p, g, plot.boss), result, text, mineTarget: plot.targetId === 'player' });
    if (s.hist.length > 12) s.hist.length = 12;
    s.plot = null;
    s.cool.plotEnd = today(g);
  }
  function plotSuccess(g, p, plot) {
    const pt = p.parties[plot.party];
    const s = I(p);
    if (!pt) { endPlot(g, p, 'void', '政党が消えた'); return; }
    const bossName = npcName(p, g, plot.boss);
    const targetName = plot.targetId === 'player' ? g.state.name : npcName(p, g, plot.targetId);
    const reason = plot.target === 'pm' ? '党内の倒閣運動' : '党内の党首おろし';
    s.stats.toppled++;
    p.flags.plotBoss = plot.boss;
    for (const id of plot.bloc) { const q = findFaction(p, id); if (q) { const x = fxOf(g, p, q.pt, q.f); x.mood = clamp(num(x.mood) + 12, -100, 100); } }
    if (plot.target === 'pm') {
      if (plot.targetId === 'player') {
        X.note(g, '（党内の倒閣運動に敗れた。退陣に追い込まれる…）');
        if (!p.cabinet.pending && !p.cabinet.resigned) p.cabinet.pending = { kind: 'resign', day: today(g) + 1, reason };
      } else if (!p.cabinet.resigned && !p.cabinet.pending) { X.resignCabinet(g, p, reason); }
      X.news(p, g, `${targetName}総理が退陣へ。${bossName}氏らの動きが実った（${reason}）`);
    } else {
      if (plot.targetId === 'player') { X.note(g, '（党内の動きに押し切られ、党首を退くことになった…）'); X.stepDownLeader(g, p, reason); }
      else {
        p.flags.outgoingLeader = pt.leader;
        X.leaderRaceSoon(g, p, pt.id, today(g) + 6, reason);
        X.news(p, g, `${pt.short}の${targetName}${pt.leaderTitle || '党首'}が退陣表明。${bossName}氏らの動き。党首選へ`);
      }
    }
    X.phoneNews(g, `【党内】${pt.name}で${reason}が決着。${targetName}氏が退く見通しです。`, 'ドット新聞 政治部');
    if (plot.boss === 'player') { p.me.standing = clamp(num(p.me.standing) + 12, 0, 100); p.me.reputation = clamp(num(p.me.reputation) + 3, -100, 100); }
    endPlot(g, p, 'toppled', `${targetName}氏が退陣へ`);
  }
  function plotFail(g, p, plot) {
    const pt = p.parties[plot.party];
    const s = I(p);
    s.stats.defended++;
    const bossName = npcName(p, g, plot.boss);
    for (const id of plot.bloc) { const q = findFaction(p, id); if (q) { const x = fxOf(g, p, q.pt, q.f); x.mood = clamp(num(x.mood) + 8, -100, 100); x.grudge = clamp(num(x.grudge) + 4, 0, 100); } }
    if (plot.boss === 'player') {
      p.me.standing = clamp(num(p.me.standing) - 24, 0, 100);
      p.me.reputation = clamp(num(p.me.reputation) - 4, -100, 100);
      X.note(g, '（倒閣の動きは失敗に終わった。党内の風当たりが強い…）');
      if (pt && Math.random() < 0.3) { X.note(g, '（造反の責任を問われ、党から除名された…）'); X.leavePartyImpl(g, p, '除名'); }
    } else {
      const b = npcOf(p, plot.boss);
      if (b && pt && Math.random() < 0.45) {
        for (const [post, who] of Object.entries(pt.posts || {})) if (who === b.id) { const m = X.pickMinister(p, pt.id, {}); giveParty(g, p, pt, post, m.id); }
      }
      if (plot.targetId === 'player') { p.me.standing = clamp(num(p.me.standing) + 5, 0, 100); }
    }
    if (pt && plot.targetId !== 'player') X.news(p, g, `${pt.short}内の${plot.target === 'pm' ? '倒閣' : '党首おろし'}の動きは収まる（${bossName}氏ら）`);
    else if (plot.targetId === 'player') X.note(g, `（${bossName}氏らの動きを押し返した。党内の空気は落ち着いた）`);
    endPlot(g, p, 'defended', '動きは収まった');
  }
  // daily progress of the active plot
  function plotTick(g, p, day) {
    const s = I(p);
    const plot = s.plot;
    if (!plot) return;
    const pt = p.parties[plot.party];
    if (!pt || (pt.leader !== plot.targetId)) { endPlot(g, p, 'void', '情勢が変わった'); return; }
    if (p.cabinet.resigned && plot.target === 'pm') { endPlot(g, p, 'void', '内閣は総辞職した'); return; }
    if (p.diet.shugi.dissolved) { endPlot(g, p, 'void', '解散・総選挙で動きは止まった'); return; }
    if (plot.stage === 'whisper' && day >= plot.openAt) {
      plot.stage = 'open';
      plotLog(g, p, plot, '動きが公然化した');
      if (plot.targetId === 'player') { X.note(g, `（${npcName(p, g, plot.boss)}氏らが公然と退陣を求め始めた！決着は${X.dateLabel(g, plot.voteAt)}ごろ）`); X.phoneNews(g, `【速報】${pt.name}内で退陣要求が公然化。決着は${X.dateLabel(g, plot.voteAt)}ごろの見通しです。`, 'ドット新聞 政治部'); }
      else newsQ(g, p, `plotopen:${pt.id}`, 20, `${pt.short}内の退陣要求が公然化。${npcName(p, g, plot.boss)}氏らが会合を重ねる`);
    }
    // the bloc drifts with its factions' moods (players' moves change them)
    for (const id of plot.bloc.slice()) {
      const q = findFaction(p, id);
      if (!q) { plot.bloc = plot.bloc.filter((x) => x !== id); continue; }
      const x = fxOf(g, p, q.pt, q.f);
      if (x.mood > 12 && Math.random() < 0.15) { plot.bloc = plot.bloc.filter((y) => y !== id); plotLog(g, p, plot, `${q.f.name}が距離を置いた`); }
    }
    // factions that are in a bad mood may join
    for (const r of factionsOf(p, pt)) {
      const x = fxOf(g, p, pt, r);
      if (!plot.bloc.includes(r.id) && x.mood <= -30 && x.ambition >= 45 && r.id !== leaderFaction(p, pt) && Math.random() < 0.08) { plot.bloc.push(r.id); plotLog(g, p, plot, `${r.name}が倒閣派に加わった`); }
    }
    if (day >= plot.voteAt) {
      const o = plotOdds(g, p, plot);
      if (Math.random() < o.odds) plotSuccess(g, p, plot); else plotFail(g, p, plot);
    }
  }
  // chance that a new plot forms this step in a party
  function plotCheck(g, p, pt, rows) {
    const s = I(p);
    if (s.plot || p.diet.shugi.dissolved) return;
    if (today(g) - num(s.cool.plotEnd, -99) < 45) return;
    if (!(pmPartyId(p) === pt.id || me_in(p, pt) || pt.id === topOpp(p))) return;
    if (rows.length < 2) return;
    const pmT = isPMParty(p, pt) && p.cabinet.pm === pt.leader && !p.cabinet.resigned && !p.cabinet.pending;
    if (!pmT && p.elections.upcoming.some((e) => e.kind === 'sosaisen' && e.party === pt.id && e.status !== 'done')) return;
    const lf = leaderFaction(p, pt);
    const C = p.cabinet;
    const seats = Math.max(1, X.partySeats(p, pt.id));
    let A, slump = 0;
    if (pmT) A = num(C.approval, 45);
    else { const sup = X.natSupport(p, pt.id, X.fyNow(g)); const last = num(pt.voteShare && pt.voteShare.shugi, sup); slump = (sup - last) * 160; A = 42 + slump; }
    const sour = rows.filter((r) => r.id !== lf && r.mood <= -20 && r.ambition >= 40);
    if (!sour.length) return;
    const sourSize = sour.reduce((a, r) => a + r.size, 0);
    const chance = clamp(((38 - A) / 38) * 0.14 + (sourSize / seats) * 0.18 + (pmT && p.me.party === pt.id && pt.leader === 'player' ? 0 : 0), 0, 0.28);
    if (A > 44) return;
    if (Math.random() >= chance) return;
    // the boss: the most ambitious of the sour factions' leaders
    const bossF = sour.slice().sort((a, b) => b.ambition + (b.power / 3) - (a.ambition + (a.power / 3)))[0];
    const bloc = sour.filter((r) => r.mood <= -24).map((r) => r.id);
    if (!bloc.includes(bossF.id)) bloc.unshift(bossF.id);
    startPlot(g, p, pt, bossF.leader, bloc, { slump });
  }
  const me_in = (p, pt) => p.me.party === pt.id;
  function topOpp(p) {
    const ids = Object.keys(p.parties).filter((id) => !(p.cabinet.partyIds || []).includes(id));
    ids.sort((a, b) => X.partySeats(p, b) - X.partySeats(p, a));
    return ids[0] || null;
  }

  // ---------------------------------------------------------------- the step (every ~3 game days per party)
  function moodTarget(g, p, pt, f, x, rows, lf) {
    const C = p.cabinet;
    const pmP = isPMParty(p, pt);
    let A;
    if (pmP) A = num(C.approval, 45);
    else { const sup = X.natSupport(p, pt.id, X.fyNow(g)); const last = num(pt.voteShare && pt.voteShare.shugi, sup); A = 42 + (sup - last) * 160; }
    const tot = rows.reduce((a, r) => a + r.power, 0) || 1;
    const sizeTot = rows.reduce((a, r) => a + r.size, 0) || 1;
    const r = rows.find((q) => q.id === f.id);
    const postShare = r ? (r.postCount * 5) / Math.max(1, rows.reduce((a, q) => a + q.postCount * 5, 0)) : 0;
    const fair = postShare - num(f.size) / sizeTot;
    let t = 8 + (A - 42) * 0.75 + (f.id === lf ? 20 : 0) + fair * 42 + Math.min(6, x.owe * 2) - x.grudge * 0.22;
    // an ambitious faction outside the leader's own smells a chance when the leadership is weak; and the 選挙の顔 worry
    if (f.id !== lf && A < 40) t -= clamp((num(x.ambition) - 45) / 55, 0, 1) * (40 - A) * 0.9;
    const nextVote = (p.elections.upcoming || []).filter((e) => (e.kind === 'shugi' || e.kind === 'sangi') && e.status !== 'done').reduce((a, e) => Math.min(a, e.day - today(g)), 9999);
    if (nextVote < 110 && A < 40 && f.id !== lf) t -= (40 - A) * 0.35;
    if (x.demand && today(g) > x.demand.since + 10) t -= 9;
    if (pt.leader === 'player') t += (num(p.me.standing) - 50) * 0.08;
    // long tenure of the same leadership: fatigue
    if (pmP) t -= Math.min(10, (today(g) - num(C.formed, today(g))) / 60);
    void tot;
    return clamp(t, -80, 80);
  }
  function stepParty(g, p, pt, focus) {
    ensureFactions(g, p, pt);
    const fs = factionsOf(p, pt);
    if (!fs.length) return;
    const day = today(g);
    const rows0 = factionRows(g, p, pt);
    const lf = leaderFaction(p, pt);
    for (const f of fs) {
      const x = fxOf(g, p, pt, f);
      const t = moodTarget(g, p, pt, f, x, rows0, lf);
      x.mood = clamp(num(x.mood) + (t - num(x.mood)) * 0.13 + gauss() * 1.5, -100, 100);
      x.grudge = Math.max(0, num(x.grudge) - 0.4);
      x.cohesion = clamp(num(x.cohesion) + gauss() * 1.2 + (x.mood < -20 ? 0.8 : 0), 20, 98);
      const prev = x.intent;
      x.intent = intentOf(x);
      if (x.intent === 'bargain' || x.intent === 'plot') claimFor(g, p, pt, f, x);
      if (x.demand && day > x.demand.until) { x.demand = null; x.mood = clamp(num(x.mood) - 6, -100, 100); }
      // faction funds: a 派閥 collects dues and gives some out
      if (f.kind === 'faction' && Math.random() < 0.05) f.funds = Math.max(0, num(f.funds) + Math.round(rnd(-3, 6) * 1000000));
      if (prev !== x.intent && focus && (x.intent === 'plot' || x.intent === 'defect') && p.me.party === pt.id) {
        if (!quiet(g, p, `mood:${f.id}`, 12)) logLine(g, p, `${f.name}が${INTENT[x.intent]}（${moodWord(x.mood)}）`);
      }
    }
    // deals (promises) expire
    // defection: a faction at the end of its tether leaves (rare; the splinter logic lives in politics_conflict.js)
    if (focus || Math.random() < 0.2) {
      for (const f of fs) {
        const x = fxOf(g, p, pt, f);
        if (x.intent === 'defect' && num(f.size) >= 3 && Math.random() < 0.045 && day - num(I(p).cool[`def:${pt.id}`], -99) > 50) {
          I(p).cool[`def:${pt.id}`] = day;
          if (X.factionDefects) X.factionDefects(g, p, pt, f, x);
        }
      }
    }
    // a plot may form (the PM's party, the player's party, the biggest opposition party)
    if (focus) plotCheck(g, p, pt, factionRows(g, p, pt));
    // aging and succession
    successionCheck(g, p, pt);
  }

  // ---------------------------------------------------------------- succession (領袖の世代交代)
  function successionCheck(g, p, pt) {
    const s = I(p);
    const day = today(g);
    if (day - num(s.cool[`succ:${pt.id}`], -99) < 24) return;
    const fs = factionsOf(p, pt);
    for (const f of fs) {
      const boss = npcOf(p, f.leader);
      if (!boss) continue;
      const x = fxOf(g, p, pt, f);
      if (boss.age < 68 && !(boss.age >= 62 && x.mood < -50)) continue;
      const pr = clamp(0.015 + (boss.age - 68) * 0.012, 0.01, 0.14);
      if (Math.random() >= pr) continue;
      s.cool[`succ:${pt.id}`] = day;
      beginSuccession(g, p, pt, f, x, boss);
      return;
    }
  }
  function beginSuccession(g, p, pt, f, x, boss) {
    const bant = npcOf(p, x.bantou);
    const heir = x.heir && npcOf(p, x.heir) ? npcOf(p, x.heir) : makeNpcFor(p, pt, f, { age: irnd(44, 54), wins: irnd(3, 6), charisma: irnd(50, 85), ambition: irnd(60, 92) });
    x.heir = heir.id;
    const contest = bant && heir && Math.abs(num(bant.traits.charisma) - num(heir.traits.charisma)) < 25;
    const playerIn = p.me.faction === f.id && p.me.party === pt.id;
    const sd = { f: f.id, party: pt.id, boss: boss.id, bantou: bant ? bant.id : null, heir: heir.id, contest };
    if (playerIn && contest && X.pushEvent) {
      X.pushEvent(g, p, {
        kind: 'succession', party: pt.id, title: `${f.name}の領袖が交代へ`,
        text: `${boss.name}会長（${boss.age}歳）が高齢を理由に会長職を譲る意向を示した。\n後継は、番頭の${bant.name}氏（${bant.age}歳）と、若手の${heir.name}氏（${heir.age}歳）で割れている。\nあなたの属する${f.name}の行方がかかっている。どうする？`,
        choices: [
          { id: 'bantou', label: `${bant.name}氏（番頭）を推す`, desc: '経験と調整力を重んじる。党内の古参が安心する', fx: { succ: { ...sd, pick: 'bantou' } } },
          { id: 'heir', label: `${heir.name}氏（若手）を推す`, desc: '世代交代を印象づける。若手が活気づく', fx: { succ: { ...sd, pick: 'heir' } } },
          { id: 'stay', label: '中立を保つ', desc: '誰が勝っても角は立たないが、存在感は薄れる', fx: { succ: { ...sd, pick: 'none' } } },
        ], until: today(g) + 6, defaultChoice: 'stay',
      });
      return;
    }
    resolveSuccession(g, p, { ...sd, pick: Math.random() < 0.55 ? 'bantou' : 'heir' }, false);
  }
  function resolveSuccession(g, p, sd, playerIn) {
    const q = findFaction(p, sd.f);
    if (!q) return;
    const { f, pt } = q;
    const x = fxOf(g, p, pt, f);
    const boss = npcOf(p, sd.boss), bant = npcOf(p, sd.bantou), heir = npcOf(p, sd.heir);
    // the stronger candidate wins; the player's pick adds weight
    let wb = bant ? num(bant.traits.charisma, 50) + 12 : 0, wh = heir ? num(heir.traits.charisma, 50) + num(heir.traits.ambition, 50) * 0.15 : 0;
    if (sd.pick === 'bantou') wb += 18; else if (sd.pick === 'heir') wh += 18;
    wb += gauss() * 8; wh += gauss() * 8;
    const winner = wb >= wh ? bant : heir;
    const loser = winner === bant ? heir : bant;
    if (!winner) return;
    const old = f.name;
    const tight = Math.abs(wb - wh) < 8;
    // a contested succession can split the faction
    const split = !!loser && tight && num(f.size) >= 6 && Math.random() < 0.45;
    const oldBoss = boss;
    f.leader = winner.id;
    winner.faction = f.id;
    f.name = `${winner.name.split(' ')[0]}${f.kind === 'faction' ? '派' : 'グループ'}`;
    if (oldBoss) { oldBoss.faction = f.id; }
    if (winner === bant) x.bantou = (heir && heir !== winner ? heir.id : null); else x.heir = null;
    x.mood = clamp(num(x.mood) + (winner === heir ? 4 : 0), -100, 100);
    if (split && loser) {
      const sz = Math.max(2, Math.round(num(f.size) * rnd(0.3, 0.45)));
      f.size = Math.max(2, num(f.size) - sz);
      const nf = { id: `${pt.id}_f${(pt.factions.reduce((a, y) => Math.max(a, num(String(y.id).split('_f')[1])), 0) || 0) + 1}`, name: `${loser.name.split(' ')[0]}${f.kind === 'faction' ? '派' : 'グループ'}`, leader: loser.id, size: sz, funds: 0, kind: f.kind || 'group' };
      loser.faction = nf.id;
      pt.factions.push(nf);
      const nx = fxOf(g, p, pt, nf);
      nx.mood = -8; nx.ambition = clamp(num(nx.ambition) + 8, 0, 100); nx.axes = { ...x.axes };
      X.news(p, g, `${old}の後継争い。${winner.name}氏が会長に就き、${loser.name}氏らが分かれて${nf.name}を旗揚げ`);
      logLine(g, p, `${old}が割れる：${f.name}と${nf.name}`);
      if (p.me.faction === f.id && sd.pick === (loser === bant ? 'bantou' : 'heir') && playerIn) {
        // the player backed the loser: they go with them
        p.me.faction = nf.id; nf.size++; f.size = Math.max(1, f.size - 1);
      }
    } else {
      X.news(p, g, `${old}の会長に${winner.name}氏（${winner.age}歳）。${oldBoss ? `${oldBoss.name}氏は退任` : ''}`);
      logLine(g, p, `${old}の領袖が交代：${f.name}`);
    }
    if (playerIn && sd.pick !== 'none') {
      const won = (sd.pick === 'bantou' && winner === bant) || (sd.pick === 'heir' && winner === heir);
      p.me.standing = clamp(num(p.me.standing) + (won ? 6 : -4), 0, 100);
      X.note(g, won ? `（あなたが推した${winner.name}氏が${f.name}の新しい会長に。恩を売ることができた）` : `（あなたの推した人は敗れた。新会長の${winner.name}氏とは、少し距離ができた…）`);
      if (won) x.owe = clamp(num(x.owe) + 0, 0, 9);
    }
  }

  // ---------------------------------------------------------------- the player's moves
  // each: { name, desc, role: who may use it ('leader'|'exec'|'member'|'any'), target: 'faction'|'rival'|'plot'|'none' }
  const MOVES = {
    rally: { name: '結集', target: 'faction', stamina: 8, money: 1, desc: '会合を開いて味方を固める。派閥の結束が上がり、倒閣の動きがあれば擁護派が増える' },
    placate: { name: '懐柔', target: 'faction', stamina: 6, desc: '不満をなだめる。会食で話を聞く／活動費を支援する／ポストを約束する、から選ぶ' },
    poach: { name: '切り崩し', target: 'faction', stamina: 8, money: 2, desc: '他の派閥の議員に声をかけて、こちらに引き寄せる。露見すれば敵を増やす' },
    favor: { name: '恩を売る', target: 'faction', stamina: 5, money: 1, desc: '選挙区の応援や陳情の取り次ぎで貸しをつくる。あとの結集や倒閣対策で効く' },
    reward: { name: '人事で報いる', target: 'faction', stamina: 3, role: 'leader', desc: '党役員のポストを与えて、その派閥の支持を固める。外れた派閥は不満を持つ' },
    punish: { name: '人事で報復', target: 'faction', stamina: 3, role: 'leader', desc: '派閥の役員ポストをはずして締めつける。恐れさせるが、恨みが残り、離反や倒閣に走りやすくなる' },
    expose: { name: '暴露', target: 'rival', stamina: 10, money: 1, desc: '相手の弱みを表に出す。成功すれば力をそぐが、失敗すると反撃され信用を失う' },
    found: { name: '派閥の旗揚げ', target: 'none', stamina: 12, money: 3, desc: '自分を領袖とする派閥・グループをつくる。一定の評価と当選回数が必要' },
    plot_start: { name: '倒閣・党首おろしを仕掛ける', target: 'none', stamina: 12, money: 2, desc: '党首（総理）の退陣を求める動きを自分で起こす。数がそろえば政権が代わるが、負ければ処分もある' },
    plot_join: { name: '倒閣派に加わる', target: 'plot', stamina: 6, desc: '起きている退陣要求に同調する。成功すれば恩を売れるが、失敗すれば冷遇される' },
    plot_oppose: { name: '党首（総理）を支える', target: 'plot', stamina: 6, desc: '退陣要求を押し返す側に回る。勝てば信頼を得る' },
  };
  function onCool(g, p, kind, tid) { const k = `${kind}:${tid || ''}`; return today(g) - num(I(p).cool[k], -99) < 2; }
  function markCool(g, p, kind, tid) { I(p).cool[`${kind}:${tid || ''}`] = today(g); }
  const pct = (v) => Math.round(clamp(v, 0, 1) * 100);
  // the preview of one move: { id, name, desc, cost: {stamina, money}, odds (0..1|null), why (null if usable), lines[], options? }
  function movePreview(g, p, kind, t = {}) {
    const M = MOVES[kind];
    if (!M) return { id: kind, name: kind, why: 'そんな動きはない', odds: null, lines: [] };
    const pt = myParty(p);
    const out = { id: kind, name: M.name, desc: M.desc, cost: { stamina: M.stamina || 0, money: (M.money || 0) * U(p) }, odds: null, why: null, lines: [], target: t };
    const role = roleOf(p, pt);
    if (!pt) { out.why = '政党に入っていない'; return out; }
    if (M.role === 'leader' && role !== 'leader') { out.why = '党首（総理）でないとできない'; return out; }
    if (!isNat(p.me) && !['favor'].includes(kind)) { out.why = '国会議員でないと、党内の駆け引きは難しい'; return out; }
    if (g.state.stamina < (M.stamina || 0)) { out.why = '体力が足りない'; return out; }
    if (fundsOf(g, p) < out.cost.money) { out.why = `お金（政治資金）が足りない：${fmt(g, out.cost.money)}`; return out; }
    ensureFactions(g, p, pt);
    const S = I(p);
    const x = t.faction ? S.fx[t.faction] : null;
    const f = t.faction ? factionsOf(p, pt).find((y) => y.id === t.faction) : null;
    if (M.target === 'faction') {
      if (!f || !x) { out.why = '相手の派閥・グループを選ぶ'; return out; }
      if (onCool(g, p, kind, f.id)) { out.why = '同じ相手には、2日あけてから'; return out; }
    }
    const standing = num(p.me.standing);
    const mine = p.me.faction === f?.id;
    if (kind === 'rally') {
      if (!mine && x.mood < 8 && num(x.owe) < 1) { out.why = '縁のない派閥は結集できない（まず恩を売るか、懐柔を）'; return out; }
      out.odds = clamp(0.46 + (standing - 40) / 150 + x.mood / 220 + Math.min(2, x.owe) * 0.05, 0.2, 0.92);
      out.lines.push(`成功：${f.name}の結束↑（機嫌 ${Math.round(x.mood)} → +8）${S.plot ? '・擁護派/倒閣派の数に反映' : ''}`);
      if (x.owe >= 1) out.lines.push('貸し（恩）を1つ使って成功率が上がる');
    } else if (kind === 'placate') {
      const lv = clamp(num(t.level), 0, 2);
      const cost = [0, 3, 0][lv] * U(p);
      out.cost.money = cost;
      out.cost.stamina = [6, 6, 8][lv];
      out.odds = clamp(0.72 - x.ambition / 190 + lv * 0.08 - x.grudge / 220 + (mine ? 0.06 : 0), 0.12, 0.92);
      out.options = [{ level: 0, label: '会食を重ねて話を聞く', sub: `体力6・機嫌+4` }, { level: 1, label: '活動費を支援する', sub: `${fmt(g, 3 * U(p))}・機嫌+9` }, { level: 2, label: 'ポストや政策での配慮を約束する', sub: '約束（期限40日）・機嫌+14' }];
      out.lines.push(`${['話を聞く：機嫌+4', '活動費の支援：機嫌+9', '配慮を約束：機嫌+14（守らないと逆効果）'][lv]}`);
      if (fundsOf(g, p) < cost) out.why = `お金（政治資金）が足りない：${fmt(g, cost)}`;
    } else if (kind === 'poach') {
      if (mine) { out.why = '自分の派閥からは引き抜けない'; return out; }
      if (!p.me.faction && roleOf(p, pt) !== 'leader') { out.why = '自分の派閥・グループを持つか、党首でないと、引き抜く受け皿がない'; return out; }
      if (num(f.size) < 3) { out.why = '人数が少なすぎる'; return out; }
      out.odds = clamp(0.28 + (-x.mood) / 170 + (standing - 40) / 210 - x.grudge / 300, 0.08, 0.8);
      out.lines.push(`成功：1〜3人が${p.me.faction ? '自分の派閥' : '擁護派'}に移る・${f.name}の恨み+`);
      out.lines.push('失敗：露見して恨みを買い、評価が少し下がる');
    } else if (kind === 'favor') {
      out.odds = 0.86;
      out.lines.push(`成功：${f.name}に貸し（恩）がつく・機嫌+3`);
      out.lines.push('貸しは、結集や倒閣対策、人事の相談で使える');
    } else if (kind === 'reward') {
      const posts = postsAvailable(pt);
      const ps = postsOfFaction(p, pt, f);
      out.options = posts.map((q) => ({ post: q, label: X.postName(q, X.fyNow(g), pt.id), sub: `いまは${pt.posts[q] === 'player' ? 'あなた' : npcName(p, g, pt.posts[q]) || '空席'}`, disabled: ps.party.includes(q) })).filter((o) => !o.disabled);
      if (!out.options.length) { out.why = 'その派閥はすでに主なポストを持っている'; return out; }
      out.odds = 1;
      out.lines.push(`${f.name}の機嫌+14／現職の派閥は-8／その他は-1`);
    } else if (kind === 'punish') {
      const ps = postsOfFaction(p, pt, f);
      if (!ps.party.length) { out.why = '外すべき党のポストがない（その派閥は役職についていない）'; return out; }
      out.odds = 1;
      out.lines.push(`${f.name}の機嫌 -22・恨み+18。野心が高いと離反・倒閣に傾く（目安 ${pct((x.ambition + 20) / 160)}%）`);
      out.lines.push('ほかの派閥には「逆らえない」という印象が残る');
    } else if (kind === 'expose') {
      const rid = t.rival;
      const n = npcOf(p, rid);
      if (!n) { out.why = '相手の議員を選ぶ'; return out; }
      if (onCool(g, p, kind, rid)) { out.why = '同じ相手には、2日あけてから'; return out; }
      const real = !!(PARTY_DEFS[n.party] && PARTY_DEFS[n.party].real);
      const intel = (num(p.me.staff) * 0.03) + Math.log10(1 + num(g.state.fame)) * 0.02;
      out.odds = clamp(0.34 + intel + (50 - num(n.traits.integrity, 50)) / 260 + (standing - 40) / 400, 0.1, 0.78);
      out.material = real ? '過去の発言や方針の食い違い（政策の一貫性）' : '資金や交際にまつわる疑惑の情報';
      out.lines.push(`材料：${out.material}`);
      out.lines.push(`成功：${n.name}氏の影響力が落ちる／失敗：反撃され、あなたの評判と党内の評価が下がる`);
      if (!real) out.lines.push('世間にも伝わると、相手だけでなく党の評判も傷つく');
    } else if (kind === 'found') {
      if (p.me.faction && factionsOf(p, pt).some((y) => y.id === p.me.faction && y.leader === 'player')) { out.why = 'すでに自分の派閥・グループを率いている'; return out; }
      if (num(p.me.nationalWins) < 3) { out.why = '当選3回以上でないと、人は集まらない'; return out; }
      if (standing < 55) { out.why = '党内の評価が55以上でないと、旗揚げしても人が付いてこない'; return out; }
      const rows = factionRows(g, p, pt);
      const pool = rows.filter((r) => r.mood < 12 && r.size >= 4).reduce((a, r) => a + Math.floor(r.size * 0.2), 0);
      out.odds = clamp(0.4 + (standing - 55) / 120 + Math.min(0.2, pool / 60), 0.2, 0.9);
      out.lines.push(`集まりそうな議員：${Math.max(2, pool + irndSeed(p, 2))}人ほど（不満を抱える派閥から）`);
      out.lines.push('成功すれば、自分が領袖。番頭と活動費がついてくる');
    } else if (kind === 'plot_start') {
      if (S.plot) { out.why = 'すでに党内で退陣要求の動きがある'; return out; }
      if (pt.leader === 'player') { out.why = 'あなたが党首。自分に倒閣は仕掛けられない'; return out; }
      if (standing < 45) { out.why = '党内の評価が45以上でないと、誰も付いてこない'; return out; }
      if (num(p.me.nationalWins) < 2) { out.why = '当選2回以上でないと、動けない'; return out; }
      const rows = factionRows(g, p, pt);
      const lf = leaderFaction(p, pt);
      const bloc = rows.filter((r) => r.id !== lf && r.mood <= -10).map((r) => r.id);
      if (p.me.faction && !bloc.includes(p.me.faction) && p.me.faction !== lf) bloc.push(p.me.faction);
      const fake = { party: pt.id, target: isPMParty(p, pt) && p.cabinet.pm === pt.leader ? 'pm' : 'leader', targetId: pt.leader, boss: 'player', bloc, stage: 'whisper', shift: { S: 0, L: 0 }, slump: 0 };
      const o = plotOdds(g, p, fake);
      out.odds = o.odds * 0.9;
      out.reasons = o.reasons;
      out.lines.push(`いまの数：倒閣派 約${Math.round(o.S)}人 対 擁護派 約${Math.round(o.L)}人（水面下の段階では不利）`);
      out.lines.push('失敗すると評価が大きく下がり、除名もありうる');
    } else if (kind === 'plot_join' || kind === 'plot_oppose') {
      const pl = S.plot;
      if (!pl) { out.why = 'いま、退陣要求の動きはない'; return out; }
      if (pl.targetId === 'player') { out.why = 'あなたが標的。守る側の動きを使おう'; return out; }
      if (pl.party !== pt.id) { out.why = '別の政党の動き'; return out; }
      if (pl.boss === 'player' && kind === 'plot_join') { out.why = 'あなたが首謀者'; return out; }
      if (pl.touched && pl.touched.player) { out.why = 'もう態度を決めた'; return out; }
      const o = plotOdds(g, p, pl);
      out.odds = kind === 'plot_join' ? o.odds : 1 - o.odds;
      out.lines.push(kind === 'plot_join' ? `倒閣派が勝つ見込み ${pct(o.odds)}%：勝てば恩を売れる／負ければ冷遇` : `擁護派が勝つ見込み ${pct(1 - o.odds)}%：勝てば党首の信頼を得る`);
    }
    return out;
  }
  const irndSeed = (p, n) => (hash01(`${p.me.party}:${p.me.nationalWins}`) * n) | 0;

  function useCost(g, p, pv) {
    g.state.stamina = Math.max(0, g.state.stamina - (pv.cost.stamina || 0));
    if (pv.cost.money) pay(g, p, pv.cost.money);
  }
  function moveAct(g, p, kind, t = {}, opts = {}) {
    const pv = movePreview(g, p, kind, { ...t, level: opts.level });
    if (pv.why) return { ok: false, why: pv.why, odds: pv.odds };
    const pt = myParty(p);
    const S = I(p);
    const day = today(g);
    const f = t.faction ? factionsOf(p, pt).find((y) => y.id === t.faction) : null;
    const x = f ? S.fx[f.id] : null;
    const win = Math.random() < (pv.odds ?? 1);
    const R = (ok, text, extra = {}) => ({ ok: true, success: ok, text, odds: pv.odds, kind, ...extra });
    if (kind === 'rally') {
      useCost(g, p, pv);
      markCool(g, p, kind, f.id);
      if (x.owe >= 1 && !win) { /* the debt does not save a failure */ }
      if (win) {
        x.mood = clamp(num(x.mood) + 8, -100, 100);
        x.cohesion = clamp(num(x.cohesion) + 6, 0, 100);
        if (x.owe >= 1) x.owe = Math.max(0, x.owe - 1);
        if (S.plot && S.plot.targetId === 'player') { S.plot.shift.L += Math.max(2, num(f.size) * 0.25); plotLog(g, p, S.plot, `${f.name}を集めて結束を固めた`); }
        else if (S.plot && S.plot.boss === 'player') { S.plot.shift.S += Math.max(2, num(f.size) * 0.25); }
        return R(true, `${f.name}の議員を集めて結束を確かめた。「いざというときは頼む」という空気になった。`);
      }
      x.mood = clamp(num(x.mood) + 2, -100, 100);
      return R(false, `会合は開いたが、思うようには集まらなかった。${f.name}の出方は、まだ読めない。`);
    }
    if (kind === 'placate') {
      const lv = clamp(num(opts.level, 0), 0, 2);
      const gain = [4, 9, 14][lv];
      if (!pay(g, p, pv.cost.money)) return { ok: false, why: 'お金（政治資金）が足りない' };
      g.state.stamina = Math.max(0, g.state.stamina - pv.cost.stamina);
      markCool(g, p, kind, f.id);
      if (win) {
        x.mood = clamp(num(x.mood) + gain, -100, 100);
        x.grudge = Math.max(0, num(x.grudge) - 5);
        if (lv === 2) {
          const post = x.demand ? x.demand.post : pickOne(postsAvailable(pt));
          S.deals.push({ id: nid(p, 'dl'), fid: f.id, post, day, until: day + 40, kind: 'post' });
          if (x.demand) x.demand = null;
          return R(true, `${f.name}に「${X.postName(post, X.fyNow(g), pt.id)}で報いる」と約束した。期限は${X.dateLabel(g, day + 40)}まで。守らなければ信用を失う。`);
        }
        return R(true, `${f.name}の${npcName(p, g, f.leader)}氏と話し込んだ。ひとまず矛を収めてくれたようだ。`);
      }
      x.mood = clamp(num(x.mood) - 1, -100, 100);
      x.grudge = clamp(num(x.grudge) + 3, 0, 100);
      return R(false, `${f.name}は「そんなことでごまかされない」と取り合わなかった。`);
    }
    if (kind === 'poach') {
      useCost(g, p, pv);
      markCool(g, p, kind, f.id);
      if (win) {
        const n = Math.min(num(f.size) - 2, irnd(1, 3) + (num(p.me.standing) > 65 ? 1 : 0));
        f.size = Math.max(2, num(f.size) - n);
        const mine = p.me.faction ? factionsOf(p, pt).find((y) => y.id === p.me.faction) : null;
        if (mine) mine.size = num(mine.size) + n;
        else if (S.plot && S.plot.targetId === 'player') S.plot.shift.L += n;
        x.grudge = clamp(num(x.grudge) + 12, 0, 100);
        x.mood = clamp(num(x.mood) - 4, -100, 100);
        if (Math.random() < 0.3) X.news(p, g, `${f.name}から${n}人が引き抜かれた、と党内で話題に`);
        return R(true, `${f.name}の議員${n}人に声をかけ、${mine ? mine.name : 'こちら'}に引き寄せた。向こうの${npcName(p, g, f.leader)}氏は面白くないだろう。`, { moved: n });
      }
      x.grudge = clamp(num(x.grudge) + 10, 0, 100);
      x.mood = clamp(num(x.mood) - 3, -100, 100);
      p.me.standing = clamp(num(p.me.standing) - 2, 0, 100);
      if (Math.random() < 0.4) X.news(p, g, `${f.name}への引き抜き工作が露見、と党内でささやかれる`);
      return R(false, `引き抜きの話が漏れてしまった。${f.name}の恨みを買い、評価も少し下がった。`);
    }
    if (kind === 'favor') {
      useCost(g, p, pv);
      markCool(g, p, kind, f.id);
      if (win) {
        x.owe = clamp(num(x.owe) + 1, 0, 9);
        x.mood = clamp(num(x.mood) + 3, -100, 100);
        return R(true, `${f.name}の議員のために、選挙区の応援や陳情の取り次ぎをした。貸し（恩）が${x.owe}つになった。`);
      }
      return R(false, '間が悪く、あまり感謝されなかった。');
    }
    if (kind === 'reward') {
      const post = opts.post;
      if (!post) return { ok: false, why: 'ポストを選ぶ' };
      const m = memberOf(g, p, pt, f, []);
      const before = pt.posts[post];
      const beforeN = before && before !== 'player' ? npcOf(p, before) : null;
      g.state.stamina = Math.max(0, g.state.stamina - pv.cost.stamina);
      markCool(g, p, kind, f.id);
      giveParty(g, p, pt, post, m.id);
      x.mood = clamp(num(x.mood) + 14, -100, 100);
      x.demand = x.demand && x.demand.post === post ? null : x.demand;
      if (beforeN && beforeN.faction && beforeN.faction !== f.id) { const q = S.fx[beforeN.faction]; if (q) q.mood = clamp(num(q.mood) - 8, -100, 100); }
      for (const o of factionsOf(p, pt)) if (o.id !== f.id && (!beforeN || o.id !== beforeN.faction)) { const q = S.fx[o.id]; if (q) q.mood = clamp(num(q.mood) - 1, -100, 100); }
      S.deals = S.deals.filter((d) => !(d.fid === f.id && d.post === post));
      if (S.plot && S.plot.targetId === 'player') {
        if (S.plot.bossFaction === f.id && Math.random() < 0.55) { plotLog(g, p, S.plot, '首謀者の派閥を人事で取り込んだ'); S.plot.bloc = S.plot.bloc.filter((y) => y !== f.id); S.plot.shift.S -= 4; }
        S.plot.shift.L += 2;
      }
      return R(true, `${X.postName(post, X.fyNow(g), pt.id)}に${f.name}の${m.name}氏を起用した。${f.name}は大喜びだ。`, { post, who: m.id });
    }
    if (kind === 'punish') {
      g.state.stamina = Math.max(0, g.state.stamina - pv.cost.stamina);
      markCool(g, p, kind, f.id);
      const ps = postsOfFaction(p, pt, f);
      for (const post of ps.party) { const m = X.pickMinister(p, pt.id, {}); giveParty(g, p, pt, post, m.id); }
      x.mood = clamp(num(x.mood) - 22, -100, 100);
      x.grudge = clamp(num(x.grudge) + 18, 0, 100);
      let extra = '';
      if (x.ambition >= 55 && Math.random() < (x.ambition + 20) / 200) { x.intent = 'plot'; x.mood = Math.min(x.mood, -36); extra = `${f.name}は態度を硬くしている。反撃に出るかもしれない。`; }
      for (const o of factionsOf(p, pt)) if (o.id !== f.id) { const q = S.fx[o.id]; if (q) q.mood = clamp(num(q.mood) - 1.5, -100, 100); }
      if (S.plot && S.plot.targetId === 'player') S.plot.shift.S += 2;
      return R(true, `${f.name}のポストをはずした。見せしめだ。${extra}`, { removed: ps.party.length });
    }
    if (kind === 'expose') {
      const n = npcOf(p, t.rival);
      const real = !!(PARTY_DEFS[n.party] && PARTY_DEFS[n.party].real);
      useCost(g, p, pv);
      markCool(g, p, kind, n.id);
      const nf = n.faction ? findFaction(p, n.faction) : null;
      const nx = nf ? S.fx[nf.f.id] : null;
      if (win) {
        if (nx) { nx.mood = clamp(num(nx.mood) - 4, -100, 100); nx.ambition = clamp(num(nx.ambition) - 14, 0, 100); nx.grudge = clamp(num(nx.grudge) + 12, 0, 100); }
        n.traits.ambition = clamp(num(n.traits.ambition) - 16, 0, 100);
        n.traits.integrity = clamp(num(n.traits.integrity) - 6, 0, 100);
        if (S.plot && S.plot.boss === n.id) { S.plot.shift.S -= 8; plotLog(g, p, S.plot, `${n.name}氏の弱みが表に出た`); }
        if (real) {
          X.news(p, g, `${n.name}氏の過去の発言と現在の方針の食い違いが、党内で取り沙汰される`);
        } else {
          X.news(p, g, `${n.name}氏をめぐる資金の疑惑が報じられる`);
          X.politicalScandal ? X.politicalScandal(g, p, 'expense', { who: n.id, severity: 2 }) : null;
        }
        p.me.reputation = clamp(num(p.me.reputation) - 1, -100, 100);
        return R(true, `${n.name}氏の${real ? '発言の食い違い' : '弱み'}を表に出した。向こうの影響力は目に見えて落ちた。`, { who: n.id });
      }
      p.me.standing = clamp(num(p.me.standing) - 6, 0, 100);
      p.me.reputation = clamp(num(p.me.reputation) - 4, -100, 100);
      if (nx) { nx.grudge = clamp(num(nx.grudge) + 20, 0, 100); }
      if (Math.random() < 0.4) X.news(p, g, `${g.state.name}氏が党内の議員を中傷した、との声が出る（本人は否定）`);
      return R(false, `暴露は空振りに終わり、「汚い手を使った」と逆に非難された。評価と評判が下がった。`, { who: n.id });
    }
    if (kind === 'found') {
      useCost(g, p, pv);
      markCool(g, p, kind, 'self');
      if (!win) { p.me.standing = clamp(num(p.me.standing) - 3, 0, 100); return R(false, '人を集めようとしたが、「まだ早い」と断られた。'); }
      const rows = factionRows(g, p, pt);
      let got = 0;
      for (const r of rows.filter((q) => q.id !== p.me.faction && q.mood < 14 && q.size >= 4)) {
        const f2 = factionsOf(p, pt).find((y) => y.id === r.id);
        const k = Math.max(0, Math.min(Math.floor(f2.size * 0.2), f2.size - 3));
        if (k > 0) { f2.size -= k; got += k; S.fx[f2.id].grudge = clamp(num(S.fx[f2.id].grudge) + 6, 0, 100); }
      }
      got = Math.max(3, got + irndSeed(p, 2));
      const old = p.me.faction ? factionsOf(p, pt).find((y) => y.id === p.me.faction) : null;
      if (old) old.size = Math.max(0, num(old.size) - 1);
      const sur = (p.me.name || g.state.name || '').split(' ')[0] || g.state.name;
      const word = facWord(g, pt);
      const id = `${pt.id}_f${(pt.factions.reduce((a, y) => Math.max(a, num(String(y.id).split('_f')[1])), 0) || 0) + 1}`;
      const bs = (g.state.profile && g.state.profile.familyName) || sur;
      const nf = { id, name: `${bs}${word}`, leader: 'player', size: got, funds: word === '派' ? irnd(1, 3) * 10000000 : 0, kind: word === '派' ? 'faction' : 'group' };
      pt.factions.push(nf);
      p.me.faction = nf.id;
      const nx = fxOf(g, p, pt, nf);
      nx.mood = 12; nx.ambition = 55; nx.axes = Object.fromEntries(AX.map((k) => [k, 0]));
      X.news(p, g, `${g.state.name}議員が${nf.name}を旗揚げ（${got}人）`);
      logLine(g, p, `${nf.name}を旗揚げ（${got}人）`);
      return R(true, `${nf.name}を旗揚げした。集まったのは${got}人。番頭の${npcName(p, g, nx.bantou)}氏が支えてくれる。`, { faction: nf.id });
    }
    if (kind === 'plot_start') {
      useCost(g, p, pv);
      markCool(g, p, kind, 'self');
      const rows = factionRows(g, p, pt);
      const lf = leaderFaction(p, pt);
      const bloc = rows.filter((r) => r.id !== lf && r.mood <= -10).map((r) => r.id);
      if (p.me.faction && !bloc.includes(p.me.faction) && p.me.faction !== lf) bloc.push(p.me.faction);
      p.me.standing = clamp(num(p.me.standing) - 3, 0, 100);
      const pl = startPlot(g, p, pt, 'player', bloc, { side: 'plot' });
      if (!pl) return { ok: false, why: '動きを起こせなかった' };
      pl.touched.player = true;
      pl.shift.S += 2;
      return R(true, `水面下で動き出した。${pl.bloc.length}つの派閥に声をかけた。決着は${X.dateLabel(g, pl.voteAt)}ごろ。結集や懐柔で数を固めよう。`, { plot: pl.id });
    }
    if (kind === 'plot_join' || kind === 'plot_oppose') {
      const pl = S.plot;
      g.state.stamina = Math.max(0, g.state.stamina - pv.cost.stamina);
      pl.touched.player = kind;
      const w = Math.max(2, num(p.me.faction ? (factionsOf(p, pt).find((y) => y.id === p.me.faction) || {}).size : 1) * 0.4 + 1);
      pl.side = kind === 'plot_join' ? 'join' : 'oppose';
      if (kind === 'plot_join') { pl.shift.S += w; if (p.me.faction && !pl.bloc.includes(p.me.faction)) pl.bloc.push(p.me.faction); }
      else pl.shift.L += w;
      plotLog(g, p, pl, kind === 'plot_join' ? 'あなたが倒閣派に同調した' : 'あなたが党首を支えると表明した');
      return R(true, kind === 'plot_join' ? '倒閣派に同調した。結果しだいで、立場が大きく変わる。' : '党首を支える側に回ると表明した。');
    }
    return { ok: false, why: 'その動きはまだできない' };
  }
  // after a plot is decided, the player's side is judged
  function plotAftermath(g, p, plot, result) {
    const side = plot.touched && plot.touched.player;
    if (!side || typeof side !== 'string') return;
    const won = (side === 'plot_join' && result === 'toppled') || (side === 'plot_oppose' && result === 'defended');
    p.me.standing = clamp(num(p.me.standing) + (won ? 7 : -9), 0, 100);
    X.note(g, won ? '（あなたの読みは当たった。党内での評価が上がった）' : '（あなたの賭けは外れた。党内の風向きが冷たい…）');
  }

  // ---------------------------------------------------------------- deals (promises) and the weekly checks
  function dealsTick(g, p, day) {
    const S = I(p);
    for (const d of S.deals.slice()) {
      const q = findFaction(p, d.fid);
      if (!q) { S.deals = S.deals.filter((x) => x !== d); continue; }
      const ps = postsOfFaction(p, q.pt, q.f);
      if (ps.party.includes(d.post) || ps.cabinet.includes(d.post)) { S.deals = S.deals.filter((x) => x !== d); const x = fxOf(g, p, q.pt, q.f); x.mood = clamp(num(x.mood) + 6, -100, 100); continue; }
      if (day > d.until) {
        const x = fxOf(g, p, q.pt, q.f);
        x.mood = clamp(num(x.mood) - 22, -100, 100);
        x.grudge = clamp(num(x.grudge) + 15, 0, 100);
        S.deals = S.deals.filter((y) => y !== d);
        if (q.pt.id === p.me.party) X.note(g, `（${q.f.name}との約束を果たせなかった。「約束が違う」と不信が広がっている）`);
      }
    }
  }
  // ---------------------------------------------------------------- the tick
  function ensureAll(g, p) {
    const S = I(p);
    for (const pt of Object.values(p.parties)) ensureFactions(g, p, pt);
    S.ensured = today(g);
  }
  // party posts and faction bosses held by someone who has since left the party (a split, a defection, a retirement from the party)
  // are handed to a member of the same faction (or left to a new face), so no party is led through a stranger
  function sweepStale(g, p) {
    for (const pt of Object.values(p.parties)) { try { ensureFactions(g, p, pt); } catch (e) { /* ignore */ } }
    for (const pt of Object.values(p.parties)) {
      if (!pt.posts) continue;
      for (const [post, who] of Object.entries(pt.posts)) {
        if (!who || who === 'player') continue;
        const n = p.npcs[who];
        if (n && n.party === pt.id) continue;
        if (n) n.posts = (n.posts || []).filter((q) => q !== post);
        const f = n && n.faction ? findFaction(p, n.faction) : null;
        const fid = f ? f.f.id : null;
        const pool = Object.values(p.npcs).filter((q) => q.party === pt.id && (q.office === 'shugi' || q.office === 'sangi') && !(q.posts || []).some((x) => POSTS[x] && POSTS[x].kind === 'party') && q.id !== pt.leader);
        const same = pool.filter((q) => fid && q.faction === fid);
        const pick = (same.length ? same : pool)[0];
        if (pick) { pt.posts[post] = pick.id; pick.posts = [...(pick.posts || []), post]; }
        else { const nn = X.newNpc(p, { party: pt.id, house: 'shugi', office: 'shugi', wins: irnd(4, 9), age: irnd(50, 68) }); nn.posts = [post]; pt.posts[post] = nn.id; }
      }
    }
  }
  function tick(g, p, day, abs) {
    const S = I(p);
    if (S.ensured == null || (day - S.ensured > 30)) ensureAll(g, p);
    // yearly aging of the people in factions
    if (num(S.ageDay) <= 0) S.ageDay = day;
    if (day - S.ageDay >= YEAR_DAYS) {
      S.ageDay += YEAR_DAYS;
      for (const n of Object.values(p.npcs)) if (n.faction || (n.posts && n.posts.length)) n.age = (n.age || 55) + 1;
    }
    if (day - num(S.sweepDay, -99) >= 7) { S.sweepDay = day; try { sweepStale(g, p); } catch (e) { console.error('intra sweep', e); } }
    if (X.stepEvents) X.stepEvents(g, p, day);
    plotTick(g, p, day);
    dealsTick(g, p, day);
    if (day - num(S.lastStep, -99) >= 3) {
      S.lastStep = day;
      const me = p.me;
      const focusIds = new Set([pmPartyId(p), me.party, topOpp(p), ...(p.cabinet.partyIds || [])].filter(Boolean));
      let k = 0;
      for (const pt of Object.values(p.parties)) {
        const focus = focusIds.has(pt.id);
        // other parties get their turn about every 9 days
        if (!focus && (S.rot = (S.rot || 0) + 1) % 3) continue;
        try { stepParty(g, p, pt, focus); } catch (e) { console.error('intra step', pt.id, e); }
        if (++k > 8) break;
      }
      if (X.stepConflicts) X.stepConflicts(g, p, day);
    }
  }

  // ---------------------------------------------------------------- the next flashpoint
  function flashpoint(g, p, pt) {
    const day = today(g);
    const S = I(p);
    const out = [];
    if (S.plot && S.plot.party === pt.id) out.push({ day: S.plot.voteAt, kind: 'plot', text: `${S.plot.target === 'pm' ? '倒閣' : '党首おろし'}の決着`, prio: 9 });
    const sos = p.elections.upcoming.find((e) => e.kind === 'sosaisen' && e.party === pt.id && e.status !== 'done');
    if (sos) out.push({ day: sos.day, kind: 'leader', text: `${pt.leaderTitle || '党首'}選`, prio: 8 });
    const sh = p.elections.upcoming.filter((e) => e.kind === 'shugi' && e.status !== 'done').sort((a, b) => a.day - b.day)[0];
    if (sh) out.push({ day: sh.day, kind: 'election', text: `総選挙（公認・選挙区の調整）`, prio: 5 });
    for (const c of S.conflicts) if (c.party === pt.id && c.status === 'live' && c.level >= 1) out.push({ day: day + Math.max(1, Math.round((75 - c.heat) / Math.max(0.6, c.drive || 1.2))), kind: 'conflict', text: `${c.title}がこじれる`, prio: 6 });
    for (const d of S.deals) { const q = findFaction(p, d.fid); if (q && q.pt.id === pt.id) out.push({ day: d.until, kind: 'deal', text: `${q.f.name}への約束（${X.postName(d.post, X.fyNow(g), pt.id)}）の期限`, prio: 7 }); }
    const rows = factionRows(g, p, pt);
    const dem = rows.find((r) => r.demand);
    if (dem) out.push({ day: dem.demand.until, kind: 'demand', text: `${dem.name}の${X.postName(dem.demand.post, X.fyNow(g), pt.id)}の要求`, prio: 4 });
    const doy = X.polDate(g).doy;
    const reshuffle = (82 - doy + 120) % 120;
    if (isPMParty(p, pt) && reshuffle < 40 && reshuffle > 0) out.push({ day: day + reshuffle, kind: 'reshuffle', text: '9月の内閣改造・党役員人事', prio: 3 });
    out.sort((a, b) => a.day - b.day || b.prio - a.prio);
    const f = out[0];
    return f ? { ...f, days: Math.max(0, f.day - day), date: X.dateLabel(g, f.day) } : null;
  }

  // ---------------------------------------------------------------- overview for the UI
  function overview(g, pid) {
    const p = X.ensurePol(g);
    if (!p) return null;
    const S = I(p);
    const me = p.me;
    let pt = (pid && p.parties[pid]) || myParty(p) || p.parties[pmPartyId(p)] || p.parties[topOpp(p)] || Object.values(p.parties)[0];
    if (!pt) return null;
    ensureFactions(g, p, pt);
    const factions = factionRows(g, p, pt);
    const rivals = rivalRows(g, p, pt);
    const role = roleOf(p, pt);
    const posts = postsAvailable(pt).map((post) => {
      const who = pt.posts[post];
      const n = npcOf(p, who);
      const fr = n && n.faction ? factions.find((r) => r.id === n.faction) : who === 'player' && me.faction ? factions.find((r) => r.id === me.faction) : null;
      const claim = factions.filter((r) => r.demand && r.demand.post === post).map((r) => ({ id: r.id, name: r.name, until: r.demand.until }));
      return { post, label: X.postName(post, X.fyNow(g), pt.id), who: who || null, whoName: who === 'player' ? g.state.name : npcName(p, g, who) || '（空席）', faction: fr ? fr.name : '', factionId: fr ? fr.id : null, player: who === 'player', claims: claim };
    });
    const lf = leaderFaction(p, pt);
    const seatsTot = X.partySeats(p, pt.id);
    const C = p.cabinet;
    const tension = Math.round(clamp(factions.reduce((a, r) => a + clamp(-r.mood, 0, 100) * r.size, 0) / Math.max(1, factions.reduce((a, r) => a + r.size, 0)) * 1.4, 0, 100));
    return {
      party: pt.id, partyName: pt.name, short: pt.short, color: pt.color, real: !!pt.real, leader: pt.leader, leaderName: pt.leader === 'player' ? g.state.name : npcName(p, g, pt.leader), leaderTitle: pt.leaderTitle || '党首',
      leaderFaction: lf, role, mine: me.party === pt.id, isPMParty: isPMParty(p, pt), pmName: isPMParty(p, pt) ? (C.pm === 'player' ? g.state.name : npcName(p, g, C.pm)) : '',
      seats: seatsTot, factions, rivals, posts, tension, tensionLabel: tension >= 60 ? '一触即発' : tension >= 38 ? '緊張' : tension >= 18 ? 'ざわつき' : '安定',
      plot: plotInfo(g, p), flash: flashpoint(g, p, pt), standing: Math.round(num(me.standing)), myFaction: me.faction || null,
      deals: S.deals.filter((d) => { const q = findFaction(p, d.fid); return q && q.pt.id === pt.id; }).map((d) => { const q = findFaction(p, d.fid); return { id: d.id, faction: q.f.name, post: X.postName(d.post, X.fyNow(g), pt.id), until: d.until, left: Math.max(0, d.until - today(g)) }; }),
      log: S.log.slice(0, 8), hist: S.hist.slice(0, 5), stats: { ...S.stats },
      parties: Object.values(p.parties).filter((q) => (q.factions || []).length).map((q) => ({ id: q.id, name: q.name, short: q.short, color: q.color })),
    };
  }
  // an NPC politician's profile page
  function profile(g, id) {
    const p = X.ensurePol(g);
    if (id === 'player') return null;
    const n = npcOf(p, id);
    if (!n) return null;
    const pt = p.parties[n.party] || null;
    const fq = n.faction ? findFaction(p, n.faction) : null;
    const x = fq ? p.intra && p.intra.fx[fq.f.id] : null;
    let stance = null;
    try { stance = X.stanceOfNpc ? X.stanceOfNpc(g, p, n) : null; } catch (e) { stance = null; }
    let persona = null;
    try { persona = typeof g.npcPersona === 'function' ? g.npcPersona(id) : null; } catch (e) { persona = null; }
    let ideo = null;
    try { ideo = typeof g.ideologyOf === 'function' ? g.ideologyOf('npc', id) : null; } catch (e) { ideo = null; }
    const roles = [];
    if (p.cabinet.pm === id) roles.push('内閣総理大臣');
    for (const [post, who] of Object.entries(p.cabinet.ministers || {})) if (who === id) roles.push(X.postName(post, X.fyNow(g)));
    if (pt) for (const [post, who] of Object.entries(pt.posts || {})) if (who === id) roles.push(X.postName(post, X.fyNow(g), pt.id));
    if (pt && pt.leader === id) roles.push(pt.leaderTitle || '党首');
    if (fq && fq.f.leader === id) roles.push(`${fq.f.name}の領袖`);
    if (x && x.bantou === id) roles.push(`${fq.f.name}の番頭`);
    return {
      id, name: n.name, age: n.age, gender: n.gender, party: n.party, partyName: pt ? pt.name : '無所属', partyShort: pt ? pt.short : '無所属', color: pt ? pt.color : '#8a90a6', real: !!(pt && pt.real),
      office: n.office, house: n.house, wins: n.wins, faction: fq ? fq.f.name : '', factionId: fq ? fq.f.id : null, roles, charisma: num(n.traits.charisma), integrity: num(n.traits.integrity), ambition: num(n.traits.ambition),
      mood: x ? Math.round(x.mood) : null, intent: x ? INTENT[x.intent] : null, grudge: x ? Math.round(x.grudge) : 0, stance, persona: persona ? { name: persona.name, desc: persona.desc } : null, ideology: ideo ? { label: ideo.label, top3: ideo.top3 } : null, look: n.look,
    };
  }

  // ---------------------------------------------------------------- hooks (politics events)
  function onElectionDone(g, p, data) {
    const res = data && data.result;
    if (!res) return;
    const S = I(p);
    if (res.kind === 'shugi' || res.kind === 'sangi') {
      // a splinter party left without a seat ends (its members go to 無所属 / other parties)
      for (const id of Object.keys(p.parties)) {
        const sp = p.parties[id];
        if (!/^sp\d+$/.test(id) || !sp || sp.isPlayers || p.me.party === id || X.partySeats(p, id) > 0 || !X.retireParty) continue;
        for (const f of sp.factions || []) delete S.fx[f.id];
        for (const k of ['conflicts', 'events', 'deals']) if (Array.isArray(S[k])) S[k] = S[k].filter((x) => !x || x.party !== id);
        if (S.plot && S.plot.party === id) S.plot = null;
        const nm = sp.name;
        try { X.retireParty(g, p, id, '議席を失ったため'); X.news(p, g, `${nm}は議席を失い、活動を終えた`); } catch (e) { console.error(e); }
      }
      for (const pt of Object.values(p.parties)) {
        // faction sizes follow the new seat totals; the losers' factions are in a bad mood
        const seats = X.partySeats(p, pt.id);
        const fs = factionsOf(p, pt);
        if (!fs.length) continue;
        const sum = fs.reduce((a, f) => a + num(f.size), 0) || 1;
        const covered = pt.id === 'jimin' ? (X.polDate(g).year >= 2024 ? 0.35 : 0.85) : 0.6;
        const k = (seats * covered) / sum;
        if (Math.abs(k - 1) > 0.05) for (const f of fs) f.size = Math.max(2, Math.round(num(f.size) * k));
        const before = num(res.houseSeats && res.houseSeats.before && res.houseSeats.before[pt.id], null);
        void before;
      }
      // mood after a win / loss for the PM's party: the winner's leadership is strengthened
      const pmP = p.parties[pmPartyId(p)];
      if (pmP) {
        const share = num(res.national && res.national.share && res.national.share[pmP.id], null);
        const last = share != null ? share : null;
        for (const f of factionsOf(p, pmP)) { const x = S.fx[f.id]; if (x && last != null) x.mood = clamp(num(x.mood) + (last >= 0.36 ? 8 : last < 0.3 ? -10 : 0), -100, 100); }
      }
      if (S.plot && res.kind === 'shugi') endPlot(g, p, 'void', '総選挙で動きは止まった');
      S.cool.elec = today(g);
    }
    if (res.kind === 'sosaisen') {
      const pt = p.parties[res.party];
      if (pt) {
        // the new leader forms the executive
        const lf = res.winners && res.winners[0] ? res.winners[0].id : null;
        void lf;
        postRound(g, p, pt, pt.leader === 'player' ? '' : '党首選のあと');
        if (S.plot && S.plot.party === pt.id) endPlot(g, p, 'void', '新しい党首が選ばれた');
        // the boss of a successful plot was a candidate: if he won, his faction is happy; the losers sulk
        for (const f of factionsOf(p, pt)) { const x = S.fx[f.id]; if (!x) continue; if (f.leader === pt.leader) x.mood = clamp(num(x.mood) + 18, -100, 100); else x.mood = clamp(num(x.mood) - 4, -100, 100); }
      }
    }
  }
  function onCabinet(g, p, data) {
    const S = I(p);
    if (data && (data.reshuffle !== undefined || data.joined || data.coalition)) return;
    // a new PM: honeymoon in his party
    const pt = p.parties[pmPartyId(p)];
    if (!pt) return;
    for (const f of factionsOf(p, pt)) { const x = S.fx[f.id]; if (x) x.mood = clamp(num(x.mood) + 8, -100, 100); }
    if (S.plot && S.plot.party === pt.id && S.plot.targetId !== pt.leader) endPlot(g, p, 'void', '新しい総理が選ばれた');
  }
  function onDissolve(g, p) {
    const S = I(p);
    if (S.plot) endPlot(g, p, 'void', '解散・総選挙で動きは止まった');
  }
  function onResign(g, p, data) {
    const S = I(p);
    if (S.plot && data && data.who === 'cabinet' && S.plot.target === 'pm') { /* plotTick ends it */ }
  }
  function refs(p) {
    const out = new Set();
    const S = p.intra;
    if (!obj(S)) return out;
    for (const x of Object.values(S.fx || {})) { if (x.bantou) out.add(x.bantou); if (x.heir) out.add(x.heir); }
    if (S.plot) { if (S.plot.boss) out.add(S.plot.boss); if (S.plot.targetId) out.add(S.plot.targetId); }
    for (const c of S.conflicts || []) { if (c.sideA && c.sideA.leader) out.add(c.sideA.leader); if (c.sideB && c.sideB.leader) out.add(c.sideB.leader); }
    for (const e of S.events || []) for (const id of e.refs || []) out.add(id);
    return out;
  }

  const H = {
    I, nid, U, fundsOf, pay, fmt, quiet, newsQ, logLine, hash01, roleOf, myParty, npcOf, npcName, isNat, isPMParty, pmPartyId, leaderFaction, facWord,
    ensureFactions, ensureAll, fxOf, factionsOf, findFaction, factionRows, rivalRows, postsOfFaction, postsAvailable, memberOf, giveParty, postRound, powerOf,
    plotInfo, plotOdds, startPlot, endPlot, plotAftermath, moveAct, movePreview, MOVES, INTENT, intentOf, moodWord, AX, partyAxes, policyAxes, agree, makeNpcFor, today,
    overview, profile, flashpoint, tick, refs, onElectionDone, onCabinet, onDissolve, onResign, topOpp, beginSuccession, resolveSuccession, supportCount, stepParty,
  };
  // extend with conflicts / events / stance (politics_conflict.js calls back through X.*)
  X.H = H;
  const methods = {
    intra(pid) { return overview(this, pid); },
    intraMoves(target = {}) {
      const p = X.ensurePol(this);
      const pt = myParty(p);
      const kinds = Object.keys(MOVES);
      return kinds.map((k) => movePreview(this, p, k, target)).filter((m) => {
        const M = MOVES[m.id];
        if (!pt) return false;
        if (M.target === 'faction') return !!target.faction;
        if (M.target === 'rival') return !!target.rival;
        if (M.target === 'plot') return !!I(p).plot;
        return true;
      });
    },
    intraMovePreview(kind, target = {}) { return movePreview(this, X.ensurePol(this), kind, target); },
    intraAct(kind, target = {}, opts = {}) {
      const p = X.ensurePol(this);
      const r = moveAct(this, p, kind, target, opts);
      return r;
    },
    intraPlot() { return plotInfo(this, X.ensurePol(this)); },
    politicianProfile(id) { return profile(this, id); },
    intraPostClaims(pid) { const o = overview(this, pid); return o ? o.posts : []; },
  };
  H.methods = methods;
  return H;
}
