// 政治家AI (R11-P) — the screens: 「政治家の動向」 with four tabs
//   名鑑   every NPC politician as an agent: portrait, party / faction, the career ladder with the next rung and how ready they are, positions on the 7 axes (against
//          the party line), priorities, mood, what they think of YOU and why (memories), their last acts with the reasons; A: 話を聞く (interview) / 人物像
//   動向   what the agents decided lately, newest first, each with its reason in plain Japanese
//   勢力図  党内勢力図: every named politician as a dot on a two-axis map (A: change the axes), party centroids and their trail over the years, factions and the
//          opposition's strategy
//   政局   the political "meta": which issues move votes, the national median and polarisation, the platform changes
// Registered by politics_ui.js (registerAiUI(UIK, SECTIONS)); K is its drawing kit. Everything here calls only the g.ai* API (politics_ai.js) and the optional Claude
// interview (politics_ai_claude.js). Entry points: the dashboard's 動向 tile, the 政府中枢 console list, the phone app 議員名簿 (for a politician), g.politicsScreen('ai').
// Controls like the other politics screens: ←→ tab, ↑↓ rows, A open, B back (touch: the on-screen pad).

import { registerPhoneApp } from './life.js';
import { appTile } from './phone.js';
import { AX, AXN, RUNG } from './politics_ai_text.js';
import { TOPICS, askInterview, claudeReady } from './politics_ai_claude.js';
import { aiHubSpec } from './bigtext_polai.js'; // [R12-U1] the lower screen of a portrait phone

export function registerAiUI(K, SECTIONS) {
  const { C, R, T, fit, para, card, frame, pill, pillR, hbar, cbar, ListBox, sfx, SW, SH, clamp, shade, measure, drawFaceHD, drawPartyMark, line, disc } = K;
  const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  const has = (g, k) => typeof g[k] === 'function';
  const sgn = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(num(v)))}`;
  const ATT = (v) => (v >= 32 ? '#5ee07a' : v >= 10 ? '#b8e0a0' : v > -10 ? C.dim : v > -32 ? C.warn : C.bad);

  // ---------------------------------------------------------------- small drawing helpers
  // a bipolar bar (-1..1) with a tick for the party's own position
  function bipolar(c, x, y, w, h, v, mark, col) {
    R(c, x, y, w, h, '#0c1230');
    const mid = x + Math.round(w / 2);
    R(c, mid, y - 1, 1, h + 2, C.faint);
    const k = Math.round(clamp(Math.abs(v), 0, 1) * (w / 2 - 1));
    if (k > 0) { if (v > 0) R(c, mid + 1, y + 1, k, h - 2, col); else R(c, mid - k, y + 1, k, h - 2, col); }
    if (mark != null) { const mx = mid + Math.round(clamp(mark, -1, 1) * (w / 2 - 1)); R(c, mx, y - 2, 2, h + 4, '#ffffff'); }
  }
  function ladder(c, x, y, w, pr) {
    const gap = 3, bw = Math.floor((w - gap * 5) / 6);
    for (let i = 0; i < 6; i++) {
      const bx = x + i * (bw + gap);
      const cur = i === pr.rung, past = i < pr.rung, goal = i === pr.goalRung && pr.goalRung > pr.rung;
      frame(c, bx, y, bw, 16, cur ? '#8a6a1a' : past ? '#2a4a7a' : '#10173a', goal ? C.cyan : cur ? C.gold : C.edge);
      T(c, fit(c, RUNG[i], bw - 2, 10), bx + bw / 2, y + 3, 10, cur ? '#ffffff' : past ? '#cfe0ff' : goal ? C.cyan : C.faint, 'center');
    }
  }
  // the era's look: the register of 議員名鑑 (昭和: warm paper tones), 議員名簿 (平成: teal), 政治家名鑑 (令和: the usual navy) — cards, tab bar and title follow
  const SKIN = {
    showa: { title: '議員名鑑', hub: '議員名鑑・動向', head: '#3a2c14', edge: '#9a7a3a', accent: '#f0d8a0', tab: '#2c2210', tabOn: '#5a4420' },
    heisei_early: { title: '議員名簿', hub: '議員名簿・動向', head: '#17383a', edge: '#3a8a86', accent: '#a8f0e0', tab: '#0f2a2c', tabOn: '#1f5a58' },
    heisei: { title: '議員名簿', hub: '議員名簿・動向', head: '#17383a', edge: '#3a8a86', accent: '#a8f0e0', tab: '#0f2a2c', tabOn: '#1f5a58' },
    reiwa: { title: '政治家名鑑', hub: '政治家の動向', head: null, edge: null, accent: null, tab: '#10173a', tabOn: null },
  };
  const skinOf = (g) => SKIN[(g.state && g.state.profile && g.state.profile.era) || 'reiwa'] || SKIN.reiwa;
  const cardS = (c, sk, x, y, w, h, title, o = {}) => card(c, x, y, w, h, title, { ...(sk.head ? { head: sk.head } : {}), ...(sk.edge ? { edge: sk.edge } : {}), ...(sk.accent ? { accent: sk.accent } : {}), ...o });
  const dateOf = (g, d) => K.dateLabel(g, d).replace(/^\d+年/, '');
  const since = (g, d) => { const n = Math.max(0, K.today(g) - d); const m = Math.round(n / 10); return m <= 0 ? '最近' : m < 12 ? `${m}か月前` : `${Math.round(m / 12)}年前`; };
  const partyOfRow = (r) => r.party;

  // ---------------------------------------------------------------- the 名鑑 card
  function drawAgentCard(c, g, ui, pr, r) {
    const sk = skinOf(g);
    if (!pr) { cardS(c, sk, r.x, r.y, r.w, r.h, ''); return; }
    cardS(c, sk, r.x, r.y, r.w, r.h, pr.name, { right: `${pr.rungName}${pr.ex ? '（議席なし）' : ''}`, rightW: 110, accent: '#ffffff' });
    const X0 = r.x + 8, W = r.w - 16;
    let y = r.y + 23;
    R(c, X0, y, 52, 52, '#0c1230');
    if (pr.look) drawFaceHD(c, pr.look, X0 + 1, y + 1, 1.5);
    drawPartyMark(c, g, pr.party, X0 + 58, y, 18);
    T(c, fit(c, `${pr.partyName}${pr.faction ? `・${pr.faction}` : ''}`, W - 84, 12), X0 + 80, y + 1, 12, '#ffffff');
    T(c, fit(c, `${pr.age}歳・当選${pr.wins}回・${pr.local ? '地方' : pr.house === 'sangi' ? '参議院' : '衆議院'}${pr.district ? `・${pr.district}` : ''}`, W - 60, 12), X0 + 58, y + 20, 12, C.dim);
    T(c, fit(c, pr.roles.length ? pr.roles.join('・') : '役職なし', W - 60, 12), X0 + 58, y + 35, 12, pr.roles.length ? C.gold : C.faint);
    let tx = X0 + 58;
    for (const t of pr.tags.slice(0, 2)) { tx += pill(c, tx, y + 50 - 2, t.text, t.color, '#ffffff', 10) + 4; }
    y += 57;
    // the ladder and the goal
    ladder(c, X0, y, W, pr);
    y += 19;
    T(c, fit(c, `目標：${pr.goal}`, W - 150, 12), X0, y, 12, pr.goalRung > pr.rung ? C.cyan : C.dim);
    T(c, '準備', X0 + W - 150, y, 12, C.dim); hbar(c, X0 + W - 118, y + 3, 100, 8, pr.ready / 100, pr.ready >= 60 ? C.good : pr.ready >= 40 ? C.gold : C.warn); T(c, String(pr.ready), X0 + W - 12, y, 12, C.text, 'right');
    y += 16;
    // the private side: money, connections, exposure to scandal, health
    [['資金', clamp(pr.fund / 250, 0, 1), C.gold], ['人脈', pr.con / 100, C.cyan], ['危うさ', pr.risk / 100, pr.risk >= 55 ? C.bad : pr.risk >= 35 ? C.warn : C.good], ['体調', pr.hp / 100, pr.hp >= 70 ? C.good : pr.hp >= 45 ? C.warn : C.bad]].forEach(([lab, f, col], i) => {
      const cw = Math.floor(W / 4), cx = X0 + i * cw;
      T(c, lab, cx, y, 10, C.faint); hbar(c, cx + (lab.length > 2 ? 34 : 24), y + 2, cw - (lab.length > 2 ? 42 : 32), 6, f, col);
    });
    y += 14;
    // positions (left) and the heart (right)
    const lw = 178;
    T(c, '立場（白い線＝党の立ち位置）', X0, y, 10, C.faint);
    pr.positions.forEach((q, i) => {
      const yy = y + 12 + i * 13;
      T(c, q.name, X0, yy, 12, q.strong ? '#ffffff' : C.dim);
      bipolar(c, X0 + 30, yy + 3, 76, 6, q.v, q.party, q.v >= 0 ? '#ff9a5a' : '#5fb7ff');
      T(c, fit(c, Math.abs(q.v) < 0.12 ? '中間' : q.word, lw - 112, 11), X0 + 110, yy + 1, 11, q.strong ? C.gold : C.dim);
    });
    const rx = X0 + lw + 8, rw = W - lw - 8;
    T(c, '重点課題', rx, y, 10, C.faint);
    T(c, fit(c, pr.priorities.join('・'), rw, 12), rx, y + 11, 12, C.text);
    T(c, `気持ち：${pr.moodWord}`, rx, y + 26, 12, pr.mood >= 15 ? C.good : pr.mood > -15 ? C.dim : C.warn);
    cbar(c, rx, y + 41, rw, 6, pr.mood / 100, C.good, C.bad);
    T(c, 'あなたへの印象', rx, y + 52, 10, C.faint);
    T(c, `${pr.attWord}（${sgn(pr.attitude)}）`, rx, y + 63, 12, pr.attColor);
    cbar(c, rx, y + 78, rw, 6, pr.attitude / 100, C.good, C.bad);
    const mem = pr.memory;
    T(c, fit(c, mem ? `・${mem.text}（${since(g, mem.day)}）` : '・これといった覚えはない', rw, 11), rx, y + 88, 11, mem ? (mem.w >= 0 ? '#b8e0a0' : '#ffb0a0') : C.faint);
    y += 12 + 7 * 13 + 4;
    // the last acts with their reasons
    const bottom = r.y + r.h - 4;
    if (pr.acts.length) {
      T(c, '最近の行動と理由', X0, y, 10, C.faint);
      y += 11;
      for (const a of pr.acts.slice(0, 2)) {
        if (y > bottom - 14) break;
        T(c, a.date, X0, y, 11, C.faint);
        y = para(c, a.text, X0 + 56, y - 1, W - 56, 12, C.text, 14, 2) + 2;
      }
    } else {
      T(c, '最近の目立った動きはない', X0, y, 12, C.faint);
    }
  }

  // ---------------------------------------------------------------- the interview
  async function waitFor(ui, promise, ac, title) {
    let result = null, done = false;
    promise.then((r) => { result = r; done = true; }, () => { done = true; });
    const v = {
      modal: true, hint: 'B:やめる', tip: () => 'Claudeが答えを考えている。時間がかかることもある（やめればふつうの答えになる）',
      update(u, inp) {
        if (done) { u.done(v, result); return; }
        if (inp.pressed('b') || inp.pressed('menu')) { try { ac.abort(); } catch (e) { /* ignore */ } sfx('cancel'); }
      },
      draw(c, u) {
        const w = 330, h = 78, x = Math.round((SW - w) / 2), y = 130;
        R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.5)');
        frame(c, x, y, w, h, '#151e48', C.cyan);
        T(c, title, x + 14, y + 8, 14, C.cyan);
        T(c, `考えている${'.'.repeat(1 + (Math.floor(u.t / 14) % 3))}`, x + 14, y + 34, 14, C.text);
        T(c, 'B:やめる', x + w - 12, y + h - 18, 12, C.dim, 'right');
      },
    };
    return ui.open(v);
  }
  async function interview(ui, id) {
    const g = ui.g;
    const pr = g.aiAgent(id);
    if (!pr) return;
    let idx = 0;
    for (let guard = 0; guard < 20; guard++) {
      const claude = claudeReady();
      const items = TOPICS.map((t) => ({ label: t.label, sub: '' }));
      const i = await ui.menu({
        title: `${pr.name}に話を聞く`, listTitle: '聞くこと', listW: 292, rowH: 32, items, index: idx,
        detail: (c, it, r) => {
          cardS(c, skinOf(g), r.x, r.y, r.w, r.h, `${pr.name}（${pr.partyShort}）`);
          R(c, r.x + 8, r.y + 24, 44, 44, '#0c1230');
          if (pr.look) drawFaceHD(c, pr.look, r.x + 9, r.y + 25, 1.3);
          T(c, fit(c, pr.roles[0] || `当選${pr.wins}回`, r.w - 70, 12), r.x + 58, r.y + 26, 12, C.gold);
          T(c, `気持ち：${pr.moodWord}`, r.x + 58, r.y + 42, 12, C.text);
          T(c, `あなたへの印象：${pr.attWord}`, r.x + 58, r.y + 56, 12, pr.attColor);
          let y = r.y + 76;
          y = para(c, claude ? 'Claude（あなたのAPIキー）に、この議員を演じてもらうこともできる。いつもの答えは、ゲームの中だけで作られる。' : '記者会見やぶら下がりのように、直接話を聞く。答えは、この議員の考え・気分・あなたへの印象から決まる。', r.x + 10, y, r.w - 20, 12, C.dim, 16, 5) + 4;
          if (pr.memory) para(c, `覚えていること：${pr.memory.text}`, r.x + 10, y, r.w - 20, 12, pr.memory.w >= 0 ? '#b8e0a0' : '#ffb0a0', 16, 2);
        },
        tip: () => '聞くたびに、少しだけ顔なじみになる',
      });
      if (i < 0) return;
      idx = i;
      const topic = TOPICS[i].id;
      let mode = 0;
      if (claude) {
        mode = await ui.confirm({ title: 'どうやって聞く？', w: 440, text: 'ふつうに聞くか、Claudeに議員を演じてもらうか。\nClaudeは、あなたのAPIキーで呼び出す（この1回だけ。通信できなければ、ふつうの答えになる）。', choices: ['ふつうに聞く', 'Claudeに演じてもらう', 'やめる'], index: 0, cancel: 2 });
        if (mode === 2 || mode < 0) continue;
      }
      let res;
      if (mode === 1) {
        const ac = typeof AbortController === 'function' ? new AbortController() : null;
        res = await waitFor(ui, askInterview(g, id, topic, { signal: ac ? ac.signal : undefined }), ac || { abort() {} }, `${pr.name}の答え`);
        if (!res) res = g.aiInterview(id, topic);
      } else res = g.aiInterview(id, topic);
      sfx('good');
      const lines = String(res.text || '…').split('\n');
      await ui.alert(`${pr.name}${res.by === 'claude' ? '（Claudeが演じた答え）' : ''}`, [`「${lines.join('')}」`, ...(res.notice ? [`（${res.notice}。ふつうの答えを出した）`] : [])], { w: 500, artH: 50, draw: (c, rc) => { R(c, rc.x, rc.y, 44, 44, '#0c1230'); if (pr.look) drawFaceHD(c, pr.look, rc.x + 1, rc.y + 1, 1.3); T(c, fit(c, `${pr.partyShort}・${TOPICS[i].label}`, rc.w - 56, 12), rc.x + 52, rc.y + 4, 12, C.gold); T(c, `印象 ${pr.attWord}`, rc.x + 52, rc.y + 22, 12, pr.attColor); } });
    }
  }
  async function agentMenu(ui, id) {
    const g = ui.g;
    const pr = g.aiAgent(id);
    if (!pr) return;
    const items = [
      { label: '話を聞く', sub: '記者会見・ぶら下がりのように直接聞く' },
      { label: '人物像（くわしく）', sub: '人柄・外交スタンスなど' },
      { label: 'これまでの行動と記憶', sub: '覚えていること・最近の行動を全部見る' },
      { label: 'もどる' },
    ];
    const i = await ui.menu({ title: pr.name, listTitle: pr.partyName, listW: 292, rowH: 34, items, detail: (c, it, r, k) => { cardS(c, skinOf(g), r.x, r.y, r.w, r.h, it ? it.label : ''); para(c, ['議員に話を聞く。答えは、その人の考え・気分・あなたへの印象で決まる。', '外交スタンスや人望・清廉さなど、これまでの「人物像」の画面を開く。', '議員が覚えているあなたのこと（好意・恨み）と、最近の行動の理由を一覧で見る。', ''][k] || '', r.x + 10, r.y + 26, r.w - 20, 12, C.dim, 16, 6); } });
    if (i === 0) await interview(ui, id);
    else if (i === 1) { if (has(g, 'politicianProfile')) await K.openSection(ui, 'person', { id }); else ui.toast('人物像の画面が読み込まれていない', C.dim); }
    else if (i === 2) await ui.open(historyView(g, id));
  }
  function historyView(g, id) {
    const pr = g.aiAgent(id);
    const v = {
      title: pr ? `${pr.name}：記憶と行動` : '記憶', hint: 'B:もどる', tip: () => 'あなたへの印象は、立場の近さ・党内の関係・覚えている出来事から決まる。出来事の重みは時間とともに薄れる',
      update(ui, inp) { if (inp.pressed('b') || inp.pressed('a') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); } },
      draw(c) {
        cardS(c, skinOf(g), 6, 30, SW - 12, SH - 55, pr ? `${pr.name}（${pr.partyShort}）` : '');
        if (!pr) return;
        const X0 = 16;
        let y = 54;
        T(c, `あなたへの印象：${pr.attWord}（${sgn(pr.attitude)}）`, X0, y, 14, pr.attColor); cbar(c, X0 + 250, y + 4, 200, 8, pr.attitude / 100, C.good, C.bad); y += 24;
        T(c, '覚えていること', X0, y, 12, C.gold); y += 16;
        if (!pr.memories.length) { T(c, 'これといった出来事はない', X0 + 8, y, 12, C.faint); y += 16; }
        for (const m of pr.memories.slice(0, 6)) { T(c, fit(c, `・${m.text}`, 360, 12), X0 + 8, y, 12, m.w >= 0 ? '#b8e0a0' : '#ffb0a0'); T(c, `${since(g, m.day)}　${sgn(m.w)}`, SW - 24, y, 12, C.dim, 'right'); y += 15; }
        y += 6;
        T(c, '最近の行動と理由', X0, y, 12, C.gold); y += 16;
        if (!pr.acts.length) T(c, 'まだ記録がない', X0 + 8, y, 12, C.faint);
        for (const a of pr.acts) { T(c, a.date, X0 + 8, y, 12, C.faint); y = para(c, a.text, X0 + 70, y, SW - 110, 12, C.text, 15, 2) + 3; }
        const rel = pr.relations;
        if (rel.length) { y += 4; T(c, '関係の深い人', X0, y, 12, C.gold); y += 16; T(c, fit(c, rel.map((q) => `${q.name}（${q.label}）`).join('　'), SW - 50, 12), X0 + 8, y, 12, C.text); }
      },
    };
    return v;
  }

  // ---------------------------------------------------------------- the hub
  const TABS = [{ id: 'roster', label: '名鑑' }, { id: 'log', label: '動向' }, { id: 'map', label: '勢力図' }, { id: 'meta', label: '政局' }];
  const AXIS_SETS = [[0, 2], [3, 1], [4, 6], [0, 3]]; // economy × society, external × power, environment × technology, economy × external
  const FILTERS = [['all', '全員'], ['ruling', '与党'], ['opp', '野党'], ['posts', '役職者'], ['friends', 'あなたに好意的'], ['foes', 'あなたに批判的'], ['ex', '前議員・後継']];
  function hubView(g, o = {}) {
    const st = { tab: Math.max(0, TABS.findIndex((t) => t.id === o.tab)), filter: 0, axis: 0, party: 0, sel: o.select || null };
    const lbs = {};
    const cache = { t: -99, roster: null, log: null, parties: null, meta: null };
    const prof = {};
    const load = (ui) => {
      if (ui.t - cache.t < 30 && cache.roster) return cache;
      cache.t = ui.t;
      try {
        cache.roster = g.aiAgents({ ex: true });
        cache.log = g.aiTimeline({ limit: 56 });
        cache.parties = g.aiParties();
        cache.meta = g.aiMeta();
      } catch (e) { console.error(e); }
      return cache;
    };
    const profileOf = (ui, id) => {
      const e = prof[id];
      if (e && ui.t - e.t < 30) return e.pr;
      let pr = null;
      try { pr = g.aiAgent(id); } catch (e2) { console.error(e2); }
      prof[id] = { t: ui.t, pr };
      return pr;
    };
    const filters = () => [...FILTERS, ...(cache.parties || []).filter((q) => q.n > 0).map((q) => [`p:${q.id}`, q.short])];
    const rosterRows = () => {
      const f = filters()[st.filter] || FILTERS[0];
      const P = polOf(g);
      let list = (cache.roster || []).filter((r) => (f[0] === 'ex' ? r.office == null : r.office != null));
      if (f[0] === 'ruling') list = list.filter((r) => (P.cabinet.partyIds || []).includes(r.party));
      else if (f[0] === 'opp') list = list.filter((r) => r.party !== 'ind' && !(P.cabinet.partyIds || []).includes(r.party));
      else if (f[0] === 'posts') list = list.filter((r) => r.rung >= 1);
      else if (f[0] === 'friends') list = list.filter((r) => r.att >= 20).sort((a, b) => b.att - a.att);
      else if (f[0] === 'foes') list = list.filter((r) => r.att <= -15).sort((a, b) => a.att - b.att);
      else if (f[0].startsWith('p:')) list = list.filter((r) => r.party === f[0].slice(2));
      const rows = [{ kind: 'filter', label: `表示：${f[1]}`, sub: `${list.length}人（A:切りかえ）`, labelColor: C.cyan, color: C.cyan }];
      for (const r of list) {
        rows.push({ kind: 'agent', id: r.id, label: r.name, sub: `${r.partyShort}・${r.roles[0] || `当選${r.wins}回`}`, right: r.rungName, rightColor: r.rung >= 3 ? C.gold : C.dim, color: r.color, tag: r.att >= 32 ? { text: '味方', color: '#2a7a4a' } : r.att <= -22 ? { text: '警戒', color: '#8a2a34' } : null });
      }
      if (rows.length === 1) rows.push({ kind: 'none', label: '該当する人がいない', sub: '条件を変えてみる', color: C.faint });
      return rows;
    };
    const logRows = () => {
      const rows = (cache.log || []).map((l) => ({ kind: 'log', l, label: `${l.name || '（政界）'}`, sub: l.text, right: l.date, color: l.color, icon: (c, x, y) => { R(c, x, y + 2, 18, 16, shade(l.color, -0.55)); R(c, x, y + 2, 18, 1, l.color); T(c, l.icon, x + 9, y + 3, 12, '#ffffff', 'center'); } }));
      if (!rows.length) rows.push({ kind: 'none', label: 'まだ目立った動きはない', sub: '議員たちが動くと、ここに理由つきで出る', color: C.faint });
      return rows;
    };
    const mapRows = () => (cache.parties || []).map((q) => ({ kind: 'party', q, label: q.name, sub: `議席${q.seats}・名鑑${q.n}人${q.ruling ? '・与党' : ''}`, right: q.strat ? `協調${q.strat.coop}%` : q.ruling ? '与党' : '', rightColor: C.dim, color: q.color, icon: (c, x, y) => drawPartyMark(c, g, q.id, x, y + 1, 20) }));
    const polOf = K.polOf;
    const lbFor = (ui) => {
      const id = TABS[st.tab].id;
      if (!lbs[id]) {
        const items = id === 'roster' ? rosterRows : id === 'log' ? logRows : id === 'map' ? mapRows : () => [];
        lbs[id] = new ListBox({ items, rowH: id === 'map' ? 32 : 30 });
      }
      void ui;
      return lbs[id];
    };
    const v = {
      title: () => skinOf(g).hub, focus: 'list',
      // [R12-U1] the lower screen of a portrait phone: the selected politician / row in large type (engine/bigtext_polai.js)
      bigtextKey(ui) { const L = lbFor(ui); return `${st.tab}|${L.idx}|${st.filter}|${st.axis}|${cache.roster ? cache.roster.length : 0}`; },
      bigtext(ui) { load(ui); const L = lbFor(ui); const id = TABS[st.tab].id; return aiHubSpec({ g, ui, TABS, st, L, rows: id === 'roster' ? rosterRows() : id === 'log' ? logRows() : id === 'map' ? mapRows() : [], cache, profile: (i) => profileOf(ui, i) }); },
      hint: '←→:タブ ↑↓:えらぶ A:開く B:もどる',
      tip: () => ({ roster: '議員たちは、それぞれの野心と記憶と立場で動く。名簿のAで話を聞ける', log: '議員が自分で決めたことと、その理由。サイコロではなく、立場・気分・世論から決まる', map: '点が議員。党の中心は、議員たちの立場の平均。何年もかけて、ゆっくり動く', meta: '世論が動かす争点、野党の戦略、党の公約の見直しなど、政局の流れ' }[TABS[st.tab].id]),
      enter(ui) {
        load(ui);
        if (st.sel) {
          const L = lbFor(ui);
          const rows = rosterRows();
          const k = rows.findIndex((r) => r.id === st.sel);
          if (k >= 0) L.idx = k;
        }
      },
      update(ui, inp) {
        load(ui);
        if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); return; }
        if (inp.repeat('left')) { st.tab = (st.tab + TABS.length - 1) % TABS.length; sfx('cursor'); return; }
        if (inp.repeat('right')) { st.tab = (st.tab + 1) % TABS.length; sfx('cursor'); return; }
        const L = lbFor(ui);
        L.move(inp);
        if (!inp.pressed('a')) return;
        const tab = TABS[st.tab].id;
        if (tab === 'map') {
          // A: change the two axes of the map
          st.axis = (st.axis + 1) % AXIS_SETS.length;
          sfx('ok');
          return;
        }
        const row = L.current();
        if (!row) return;
        if (tab === 'roster') {
          if (row.kind === 'filter') { st.filter = (st.filter + 1) % filters().length; L.idx = 0; sfx('ok'); return; }
          if (row.kind === 'agent') { sfx('ok'); ui.act(async () => { await agentMenu(ui, row.id); cache.t = -99; load(ui); }); }
        } else if (tab === 'log') {
          if (row.kind === 'log' && row.l.id) { sfx('ok'); ui.act(async () => { await agentMenu(ui, row.l.id); }); }
        }
      },
      draw(c, ui) {
        load(ui);
        // the tabs
        const tw = Math.floor((SW - 12) / TABS.length);
        TABS.forEach((t, i) => {
          const on = i === st.tab;
          const x = 6 + i * tw;
          const sk0 = skinOf(g);
          R(c, x, 30, tw - 2, 18, on ? (sk0.tabOn || C.sel) : sk0.tab);
          R(c, x, 30, tw - 2, 1, on ? (sk0.accent || C.gold) : (sk0.edge || C.edge));
          T(c, t.label, x + (tw - 2) / 2, 32, 12, on ? '#ffffff' : C.dim, 'center');
        });
        const tab = TABS[st.tab].id;
        const L = lbFor(ui);
        try {
          if (tab === 'roster') {
            cardS(c, skinOf(g), 6, 52, 262, SH - 77, null);
            L.draw(c, 8, 54, 258, SH - 81, true, ui.t);
            const row = L.current();
            const rect = { x: 274, y: 52, w: SW - 280, h: SH - 77 };
            if (row && row.kind === 'agent') drawAgentCard(c, g, ui, profileOf(ui, row.id), rect);
            else {
              cardS(c, skinOf(g), rect.x, rect.y, rect.w, rect.h, row && row.kind === 'filter' ? '表示の切りかえ' : '政治家名鑑');
              para(c, row && row.kind === 'filter' ? 'A：全員／与党／野党／役職者／あなたに好意的／批判的／前議員・後継者／各党…と切りかえる。' : '議員を選ぶと、野心・立場・あなたへの印象・最近の行動が見られる。', rect.x + 10, rect.y + 28, rect.w - 20, 12, C.dim, 16, 6);
              const pls = cache.parties || [];
              let y = rect.y + 80;
              T(c, '名鑑に載っている人数', rect.x + 10, y, 12, C.gold); y += 18;
              for (const q of pls.filter((z) => z.n > 0)) { T(c, fit(c, q.short, 90, 12), rect.x + 30, y, 12, C.text); R(c, rect.x + 12, y + 2, 10, 10, q.color); hbar(c, rect.x + 130, y + 3, 150, 8, q.n / Math.max(...pls.map((z) => z.n)), q.color); T(c, `${q.n}人`, rect.x + 290, y, 12, C.dim); y += 17; if (y > rect.y + rect.h - 20) break; }
            }
          } else if (tab === 'log') {
            cardS(c, skinOf(g), 6, 52, 340, SH - 77, null);
            L.draw(c, 8, 54, 336, SH - 81, true, ui.t);
            drawLogDetail(c, ui, L.current(), { x: 352, y: 52, w: SW - 358, h: SH - 77 });
          } else if (tab === 'map') {
            drawMap(c, ui, L.current());
          } else {
            drawMeta(c, ui);
          }
        } catch (e) { console.error(e); }
      },
    };
    // ---- the 動向 detail
    function drawLogDetail(c, ui, row, r) {
      if (!row || row.kind !== 'log') { cardS(c, skinOf(g), r.x, r.y, r.w, r.h, '動向'); para(c, '議員が自分で決めた動きが、新しい順に並ぶ。', r.x + 10, r.y + 28, r.w - 20, 12, C.dim, 16, 4); return; }
      const l = row.l;
      cardS(c, skinOf(g), r.x, r.y, r.w, r.h, l.name || '政界', { right: l.date, rightW: 60 });
      const pr = l.id ? profileOf(ui, l.id) : null;
      let y = r.y + 24;
      if (pr) {
        R(c, r.x + 8, y, 46, 46, '#0c1230');
        if (pr.look) drawFaceHD(c, pr.look, r.x + 9, y + 1, 1.4);
        T(c, fit(c, `${pr.partyShort}${pr.faction ? `・${pr.faction}` : ''}`, r.w - 66, 12), r.x + 60, y + 1, 12, '#ffffff');
        T(c, fit(c, pr.roles[0] || pr.rungName, r.w - 66, 12), r.x + 60, y + 17, 12, C.gold);
        T(c, `あなたへの印象：${pr.attWord}`, r.x + 60, y + 32, 12, pr.attColor);
        y += 52;
      }
      y = para(c, `${l.name ? `${l.name}氏が、` : ''}${l.text}`, r.x + 10, y + 2, r.w - 20, 13, C.text, 18, 8) + 6;
      if (pr) {
        T(c, `目標：${pr.goal}`, r.x + 10, y, 12, C.cyan); y += 16;
        T(c, `気持ち：${pr.moodWord}`, r.x + 10, y, 12, C.dim);
        para(c, 'A：この人に話を聞く・記憶を見る', r.x + 10, r.y + r.h - 18, r.w - 20, 12, C.gold, 14, 1);
      }
    }
    // ---- the 勢力図
    function drawMap(c, ui, row) {
      const pls = cache.parties || [];
      const [ax, ay] = AXIS_SETS[st.axis];
      const kx = AX[ax], ky = AX[ay];
      const px = 12, py = 72, pw = 290, ph = 236;
      cardS(c, skinOf(g), 6, 52, 304, SH - 77, `党内勢力図：${AXN[kx][0]}×${AXN[ky][0]}`, { right: 'A:軸を変える', rightW: 90 });
      R(c, px, py, pw, ph, '#080c20');
      for (let i = 1; i < 4; i++) { R(c, px + Math.round((pw * i) / 4), py, 1, ph, i === 2 ? '#2a3466' : '#141b40'); R(c, px, py + Math.round((ph * i) / 4), pw, 1, i === 2 ? '#2a3466' : '#141b40'); }
      const X = (v) => px + Math.round(((clamp(v, -1, 1) + 1) / 2) * (pw - 4)) + 2;
      const Y = (v) => py + Math.round((1 - (clamp(v, -1, 1) + 1) / 2) * (ph - 4)) + 2;
      T(c, AXN[kx][1], px + 2, py + ph - 14, 10, C.faint); T(c, AXN[kx][2], px + pw - 2, py + ph - 14, 10, C.faint, 'right');
      T(c, AXN[ky][2], px + 2, py + 2, 10, C.faint); T(c, AXN[ky][1], px + 2, py + ph - 26, 10, C.faint);
      const sel = row && row.kind === 'party' ? row.q.id : null;
      // the agents
      const P = polOf(g);
      for (const r of (cache.roster || []).filter((z) => z.office != null)) {
        const n = P.npcs[r.id];
        if (!n || !n.ai) continue;
        const col = (P.parties[r.party] || {}).color || '#8a90a6';
        const dim = sel && r.party !== sel;
        c.globalAlpha = dim ? 0.28 : 1;
        const s = r.rung >= 3 ? 5 : r.rung >= 1 ? 4 : 3;
        R(c, X(n.ai.ax[ax] / 100) - (s >> 1), Y(n.ai.ax[ay] / 100) - (s >> 1), s, s, col);
        if (r.rung >= 3) R(c, X(n.ai.ax[ax] / 100) - 3, Y(n.ai.ax[ay] / 100) - 3, 7, 1, '#ffffff');
        c.globalAlpha = 1;
      }
      // the centroids and their trail over the years
      for (const q of pls) {
        if (!q.n) continue;
        const dim = sel && q.id !== sel;
        c.globalAlpha = dim ? 0.35 : 1;
        const hx = HCOL[kx], hy = HCOL[ky];
        const trail = hx != null && hy != null ? (q.hist || []).map((h) => ({ x: h[1][hx] / 100, y: h[1][hy] / 100 })) : [];
        for (let i = 1; i < trail.length; i++) line(c, X(trail[i - 1].x), Y(trail[i - 1].y), X(trail[i].x), Y(trail[i].y), shade(q.color, -0.1));
        const cx = X(q.centroid[ax]), cy = Y(q.centroid[ay]);
        frame(c, cx - 5, cy - 5, 11, 11, shade(q.color, -0.3), '#ffffff');
        T(c, Array.from(q.short)[0], cx, cy - 6, 10, '#ffffff', 'center');
        c.globalAlpha = 1;
      }
      // the right side: the parties and the selected one's factions / strategy
      cardS(c, skinOf(g), 316, 52, SW - 322, 150, '党');
      L2.draw(c, 318, 72, SW - 326, 128, true, ui.t);
      const q = row && row.kind === 'party' ? row.q : null;
      cardS(c, skinOf(g), 316, 206, SW - 322, SH - 231, q ? `${q.short}の中` : '党の中');
      if (q) {
        let y = 228;
        const x0 = 324, w = SW - 338;
        T(c, fit(c, `名鑑${q.n}人・支持率${q.sup}%・立場のばらつき ${Math.round((q.sd[0] + q.sd[2] + q.sd[3]) / 3 * 100)}`, w, 12), x0, y, 12, C.text); y += 15;
        if (q.strat) { T(c, `対政府：協調${q.strat.coop}% 対決${q.strat.hawk}%`, x0, y, 12, C.cyan); hbar(c, x0 + 160, y + 3, w - 160, 7, q.strat.coop / 100, C.cyan); y += 15; }
        else { T(c, q.ruling ? '与党：政府を支える立場' : '', x0, y, 12, C.dim); y += 15; }
        for (const f of q.factions.slice(0, 3)) {
          if (y > SH - 40) break;
          T(c, fit(c, `${f.name}　${f.size}人`, w - 80, 12), x0, y, 12, C.text);
          cbar(c, x0 + w - 74, y + 3, 70, 6, f.mood / 100, C.good, C.bad); y += 14;
        }
        if (!q.factions.length && y < SH - 40) T(c, '派閥・グループはない', x0, y, 12, C.faint);
      }
    }
    const HCOL = { econ: 0, social: 1, world: 2 }; // columns of the yearly history row [econ, social, world]
    const L2 = new ListBox({ items: mapRows, rowH: 21 });
    lbs.map = L2; // the party list of the map tab is the tab's own list
    // ---- the 政局
    function drawMeta(c, ui) {
      const m = cache.meta;
      if (!m) { cardS(c, skinOf(g), 6, 52, SW - 12, 60, '政局'); return; }
      cardS(c, skinOf(g), 6, 52, 310, SH - 77, 'いま票を動かす争点');
      const top = m.issues.slice(0, 9);
      const mx = Math.max(1, top[0] ? top[0].sal : 1);
      top.forEach((q, i) => {
        const y = 76 + i * 25;
        T(c, fit(c, q.name, 96, 12), 16, y, 12, i < 3 ? '#ffffff' : C.text);
        hbar(c, 116, y + 3, 150, 9, q.sal / mx, i < 3 ? C.gold : '#5a78c8');
        T(c, String(q.sal), 276, y, 12, C.dim);
      });
      para(c, '世論の関心が高い争点ほど、議員は重点課題に据え、公約に掲げる。', 16, SH - 50, 292, 11, C.faint, 14, 2);
      cardS(c, skinOf(g), 322, 52, SW - 328, 118, '世論の重心と分極');
      const med = m.med;
      [[0, '経済'], [2, '社会'], [3, '外交'], [4, '環境']].forEach(([i, lab], k) => {
        const y = 76 + k * 17;
        T(c, lab, 330, y, 12, C.dim);
        bipolar(c, 366, y + 3, 150, 7, med[i], null, med[i] >= 0 ? '#ff9a5a' : '#5fb7ff');
        T(c, fit(c, Math.abs(med[i]) < 0.1 ? '中間' : med[i] < 0 ? AXN[AX[i]][1] : AXN[AX[i]][2], 90, 11), 526, y + 1, 11, C.text);
      });
      T(c, `党どうしの距離（分極）${m.pol}`, 330, 146, 12, m.pol >= 50 ? C.warn : C.text);
      hbar(c, 500, 149, SW - 512, 7, m.pol / 100, m.pol >= 50 ? C.warn : C.cyan);
      cardS(c, skinOf(g), 322, 174, SW - 328, SH - 199, '野党の戦略と党の見直し');
      let y = 196;
      const strat = Object.entries(m.strat || {});
      const pls = cache.parties || [];
      if (!strat.length) { T(c, '野党の戦略は、まだ形になっていない', 330, y, 12, C.faint); y += 16; }
      for (const [pid, s] of strat.slice(0, 4)) {
        const q = pls.find((z) => z.id === pid);
        if (!q) continue;
        T(c, fit(c, q.short, 70, 12), 330, y, 12, '#ffffff');
        T(c, '対決', 402, y, 11, C.dim); hbar(c, 428, y + 3, 120, 7, s.coop / 100, C.cyan); T(c, '協調', 554, y, 11, C.dim);
        y += 16;
      }
      y += 4;
      const lg = (cache.log || []).filter((l) => l.kind === 'meta' || l.kind === 'strat').slice(0, 2);
      for (const l of lg) { if (y > SH - 44) break; y = para(c, `${l.date}　${l.text}`, 330, y, SW - 348, 11, C.text, 14, 2) + 2; }
      if (!lg.length && y < SH - 44) para(c, '党の公約の見直しや、野党の路線変更があると、ここに出る。', 330, y, SW - 348, 11, C.faint, 14, 2);
    }
    void pillR; void measure; void disc;
    return v;
  }

  SECTIONS.ai = async (ui, o = {}) => {
    const g = ui.g;
    if (!has(g, 'aiAgents')) { await ui.alert('政治家の動向', 'このしくみは、まだ読み込まれていない。'); return; }
    await ui.open(hubView(g, o));
  };
  SECTIONS.meikan = (ui, o = {}) => SECTIONS.ai(ui, { ...o, tab: 'roster' });
  SECTIONS.interview = async (ui, o = {}) => { if (o.id) await interview(ui, o.id); };

  // ---------------------------------------------------------------- the icon and the phone app for a politician
  K.drawAiIcon = (c, x, y, col) => {
    R(c, x + 3, y + 1, 14, 18, shade(col, -0.5)); R(c, x + 4, y + 2, 12, 16, '#f4eedd'); R(c, x + 3, y + 1, 2, 18, col);
    disc(c, x + 11, y + 7, 3, '#f6c9a0'); R(c, x + 7, y + 11, 8, 5, col); R(c, x + 6, y + 17, 10, 1, '#8a8270');
  };
  const isPolitician = (g) => { const p = g.state && g.state.politics; return !!(p && p.me && (p.me.office || p.me.party)); };
  registerPhoneApp('politician_book', {
    name: '議員名簿', color: '#3a6a9a', order: 61,
    iconHD(c, x, y) { appTile(c, x, y, '#2f6a96'); K.drawAiIcon(c, x + 6, y + 4, '#5fb7ff'); },
    cond: (g) => isPolitician(g),
    open: (g) => g.politicsScreen('ai'),
  });
}
