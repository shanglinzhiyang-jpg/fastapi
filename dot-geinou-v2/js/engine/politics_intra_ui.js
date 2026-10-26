// The 党内 hub (agent R5-D): the faction map, rivals and the 倒閣運動, internal conflicts, pledges (公約), stances toward foreign
// powers (親中派・対中強硬派・親米派・親ロ派・自主外交派…), party posts as bargaining, and the decisions the party asks of the player.
// Registered by politics_ui.js (registerIntraUI(K, SECTIONS)); K is the drawing kit of politics_ui.js. Everything here only calls the
// g.* API of politics_intra.js / politics_conflict.js / politics_pledge.js (g.intra, g.intraMoves, g.intraAct, g.conflicts,
// g.conflictAct, g.intraEvents, g.intraAnswer, g.manifesto, g.pledge*, g.stanceBoard, g.setMyStance, g.politicianProfile).
// Screens: SECTIONS.party (the hub; also 'intra'), SECTIONS.conflicts, SECTIONS.manifesto, SECTIONS.stance, SECTIONS.person.
// Controls: ←→ switch tab, ↑↓ rows, A act, B back (touch: the on-screen pad). Real parties are shown with generic factions.

export function registerIntraUI(K, SECTIONS) {
  const { C, R, T, fit, para, card, frame, pill, pillR, hbar, cbar, ListBox, sfx, SW, SH, clamp, shade, measure, drawFaceHD, drawPartyMark } = K;
  const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  const has = (g, k) => typeof g[k] === 'function';
  const polOf = (g) => g.pol();
  const sgn = (v, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(num(v) * 10 ** d) / 10 ** d)}`;
  const moodCol = (m) => (m >= 16 ? C.good : m > -14 ? C.dim : m > -34 ? C.warn : C.bad);
  const levelCol = (l) => [C.dim, C.warn, '#ff8a3a', C.bad][clamp(l, 0, 3)];
  const STAT_COL = { promised: C.dim, progress: C.cyan, fulfilled: C.good, broken: C.bad, dropped: C.bad, expired: C.faint };
  const dl = (g, day) => K.dateLabel(g, day).replace(/^\d+年/, '');
  const pctS = (v) => `${Math.round(num(v))}%`;
  const wrap = (c, s, w, size = 12) => K.wrapJ(c, s, w, size);

  // ---------------------------------------------------------------- small drawing helpers
  function pips(c, x, y, level, ladder) {
    // the escalation ladder: 不満 → 公然批判 → 造反 → 分裂・離党
    for (let i = 0; i < 4; i++) {
      const on = i <= level;
      R(c, x + i * 77, y, 74, 8, on ? levelCol(i) : '#1c2656');
      if (on) R(c, x + i * 77, y, 74, 2, shade(levelCol(i), 0.3));
    }
    void ladder;
  }
  function ladderLabels(c, x, y, ladder, level) {
    ladder.forEach((s, i) => T(c, fit(c, s, 74, 10), x + i * 77 + 37, y, 10, i === level ? C.text : C.faint, 'center'));
  }
  function bar2(c, x, y, w, S, L) {
    // two-sided bar: plotters (red) vs defenders (blue)
    const tot = Math.max(1, S + L);
    R(c, x, y, w, 10, '#0c1230');
    const sw = Math.round((S / tot) * w);
    R(c, x, y, sw, 10, '#d23a4a');
    R(c, x + sw, y, w - sw, 10, '#3a7bd5');
    R(c, x + Math.round(w / 2), y - 2, 1, 14, '#ffffff');
  }
  function stanceBars(c, x, y, w, vec) {
    const rows = [['cn', '対中', '強硬', '融和'], ['us', '対米', '自立', '同盟'], ['ru', '対ロ', '強硬', '融和']];
    rows.forEach(([k, n, neg, pos], i) => {
      const yy = y + i * 12;
      T(c, n, x, yy, 12, C.dim);
      T(c, neg, x + 34, yy + 1, 10, C.faint);
      cbar(c, x + 60, yy + 3, w - 100, 7, num(vec[k]), C.cyan, '#ff9a5a');
      T(c, pos, x + w - 34, yy + 1, 10, C.faint, 'right');
    });
    T(c, '自主', x, y + 36, 12, C.dim);
    hbar(c, x + 60, y + 39, w - 100, 7, num(vec.indep), C.gold);
  }
  function tagFor(r) {
    return r.intent === 'defect' || r.intent === 'plot' ? { text: r.intentLabel, color: '#8a2a34' } : r.intent === 'bargain' ? { text: r.intentLabel, color: '#8a6a1a' } : r.intent === 'loyal' ? { text: r.intentLabel, color: '#2a7a4a' } : { text: r.intentLabel, color: '#3a4066' };
  }
  const roleText = (ov) => (ov.role === 'leader' ? (ov.isPMParty ? `${ov.leaderTitle}・総理（あなた）` : `${ov.leaderTitle}（あなた）`) : ov.role === 'exec' ? '党役員（あなた）' : ov.role === 'member' ? '一議員（あなた）' : '党外から見ている');

  // ---------------------------------------------------------------- moves (動く)
  const FACTION_MOVES = { mine: ['rally', 'favor', 'reward', 'punish', 'placate'], other: ['placate', 'poach', 'favor', 'reward', 'punish'] };
  function drawMoveDetail(c, pv, r, extra) {
    card(c, r.x, r.y, r.w, r.h, pv ? pv.name : '動く');
    if (!pv) return;
    let y = para(c, pv.desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 4) + 6;
    if (pv.why) { y = para(c, `いまはできない：${pv.why}`, r.x + 10, y, r.w - 20, 12, C.bad, 16, 3) + 4; }
    else if (pv.odds != null) {
      T(c, `成功の見込み ${pctS(pv.odds * 100)}`, r.x + 10, y, 14, pv.odds >= 0.6 ? C.good : pv.odds >= 0.35 ? C.gold : C.bad);
      hbar(c, r.x + 150, y + 3, r.w - 162, 9, pv.odds, pv.odds >= 0.6 ? C.good : pv.odds >= 0.35 ? C.gold : C.bad); y += 22;
    }
    const cost = [pv.cost && pv.cost.stamina ? `体力${pv.cost.stamina}` : '', pv.cost && pv.cost.money ? K.fmtMoney(pv.cost.money) : ''].filter(Boolean).join('・');
    if (cost) { T(c, `費用：${cost}`, r.x + 10, y, 12, C.dim); y += 16; }
    for (const l of pv.lines || []) { if (y > r.y + r.h - 20) break; y = para(c, `・${l}`, r.x + 10, y, r.w - 20, 12, C.dim, 15, 3); }
    if (extra) para(c, extra, r.x + 10, r.y + r.h - 34, r.w - 20, 12, C.cyan, 15, 2);
  }
  async function moveFlow(ui, target, kinds, title) {
    const g = ui.g;
    for (let guard = 0; guard < 12; guard++) {
      const pvs = kinds.map((k) => g.intraMovePreview(k, target));
      const i = await ui.menu({
        title: title || '動く', listTitle: '打てる手', listW: 292, rowH: 34,
        items: pvs.map((pv) => ({ label: pv.name, sub: pv.why ? pv.why : `${pv.odds != null ? `成功${Math.round(pv.odds * 100)}%・` : ''}${pv.cost && pv.cost.stamina ? `体力${pv.cost.stamina}` : ''}${pv.cost && pv.cost.money ? `・${K.fmtMoney(pv.cost.money)}` : ''}`, disabled: !!pv.why, why: pv.why, right: pv.odds != null && !pv.why ? `${Math.round(pv.odds * 100)}%` : '', rightColor: pv.odds >= 0.6 ? C.good : pv.odds >= 0.35 ? C.gold : C.bad })),
        detail: (c, it, r, k) => drawMoveDetail(c, pvs[k], r),
        tip: () => '成功の見込みは、評価・機嫌・野心などから出した目安。失敗すると代償がある',
      });
      if (i < 0) return false;
      const pv = pvs[i];
      let opts = {};
      if (pv.options && pv.id === 'placate') {
        const j = await ui.menu({ title: '懐柔のしかた', listTitle: '手段', listW: 292, rowH: 34, items: pv.options.map((o) => ({ label: o.label, sub: o.sub })), detail: (c, it, r, k) => { const p2 = g.intraMovePreview('placate', { ...target, level: k }); drawMoveDetail(c, { ...p2, name: pv.options[k].label }, r); }, tip: () => '会食→活動費→ポストの約束の順に効くが、約束は守らないと逆効果' });
        if (j < 0) continue;
        opts = { level: j };
        target = { ...target, level: j };
      } else if (pv.options && pv.id === 'reward') {
        const j = await ui.menu({ title: 'どのポストで報いる？', listTitle: '党役員', listW: 292, rowH: 34, items: pv.options.map((o) => ({ label: o.label, sub: o.sub })), detail: (c, it, r, k) => drawMoveDetail(c, { ...pv, name: pv.options[k].label, lines: [...pv.lines, `いまの${pv.options[k].sub}の派閥は不満を持つ`] }, r), tip: () => 'ポストは限られる。与えた派閥は喜ぶが、外れた派閥は不満を持つ' });
        if (j < 0) continue;
        opts = { post: pv.options[j].post };
      }
      const pv2 = pv.id === 'placate' ? g.intraMovePreview('placate', target) : pv;
      const k = await ui.confirm({ title: pv.name, w: 440, text: `${pv.desc}\n${pv2.odds != null ? `成功の見込み ${Math.round(pv2.odds * 100)}%` : ''}\n${(pv2.lines || []).slice(0, 3).join('\n')}`, choices: ['実行する', 'やめる'], index: 0, cancel: 1, tip: '失敗しても体力・お金は戻らない' });
      if (k !== 0) continue;
      const r = g.intraAct(pv.id, target, opts);
      if (!r || !r.ok) { sfx('buzz'); await ui.alert(pv.name, (r && r.why) || 'できなかった'); continue; }
      sfx(r.success ? 'success' : 'buzz');
      await ui.alert(`${pv.name}：${r.success ? '成功' : '失敗'}`, String(r.text || '').split('\n'));
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- decisions (events)
  async function eventFlow(ui, e, D) {
    const g = ui.g;
    const i = await ui.menu({
      title: e.title, listTitle: `決断（あと${e.left}日。放っておくと「${(e.choices.find((c) => c.id === e.defaultChoice) || {}).label || '成り行き'}」）`, listW: 300, rowH: 38,
      items: e.choices.map((c) => ({ label: c.label, sub: c.why || c.desc, disabled: !!c.why, why: c.why, right: c.odds != null ? `${Math.round(c.odds * 100)}%` : '', rightColor: c.odds >= 0.6 ? C.good : c.odds >= 0.35 ? C.gold : C.bad })),
      detail: (c, it, r, k) => {
        card(c, r.x, r.y, r.w, r.h, '状況');
        let y = para(c, e.text, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 7) + 6;
        const ch = e.choices[k];
        if (ch) {
          T(c, fit(c, `▶ ${ch.label}`, r.w - 20, 12), r.x + 10, y, 12, C.gold); y += 16;
          y = para(c, ch.desc, r.x + 10, y, r.w - 20, 12, C.dim, 15, 3) + 2;
          if (ch.odds != null) { T(c, `うまくいく見込み ${Math.round(ch.odds * 100)}%`, r.x + 10, y, 12, ch.odds >= 0.6 ? C.good : C.gold); y += 15; }
          if (ch.cost) T(c, `費用：${ch.cost}`, r.x + 10, y, 12, C.dim);
        }
      },
      tip: () => '期限までに決めないと、成り行き（既定の選択）になる',
    });
    if (i < 0) return null;
    const ch = e.choices[i];
    const r = g.intraAnswer(e.id, ch.id);
    if (!r.ok) { sfx('buzz'); await ui.alert(e.title, r.why); return null; }
    sfx(r.success ? 'good' : 'buzz');
    const open = e.kind === 'conflict' && ch.id === 'open';
    if (!open && r.text) await ui.alert(e.title, String(r.text).split('\n'));
    void D;
    return open ? { openConflict: e.ref || null } : {};
  }

  // ---------------------------------------------------------------- conflicts
  async function conflictFlow(ui, cf) {
    const g = ui.g;
    if (!cf || cf.status !== 'live') { ui.toast('この紛争は、もう終わっている', C.dim); return; }
    for (let guard = 0; guard < 6; guard++) {
      const cur = g.conflicts({}).find((x) => x.id === cf.id);
      if (!cur || cur.status !== 'live') return;
      const opts = cur.options;
      if (!opts.length) { await ui.alert(cur.title, ['いまの立場では、打てる手がない。', '党首や幹部、または派閥の領袖なら調停や譲歩ができる。']); return; }
      const i = await ui.menu({
        title: cur.title, listTitle: `${cur.levelName}（熱 ${cur.heat}）`, listW: 300, rowH: 36,
        items: opts.map((o) => ({ label: o.name, sub: o.why || o.desc, disabled: !!o.why, why: o.why, right: o.odds != null && !o.why ? `${Math.round(o.odds * 100)}%` : '', rightColor: o.odds >= 0.6 ? C.good : o.odds >= 0.35 ? C.gold : C.bad })),
        detail: (c, it, r, k) => {
          const o = opts[k];
          card(c, r.x, r.y, r.w, r.h, o ? o.name : cur.title);
          if (!o) return;
          let y = para(c, o.desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 3) + 6;
          if (o.odds != null) { T(c, `成功の見込み ${Math.round(o.odds * 100)}%`, r.x + 10, y, 14, o.odds >= 0.6 ? C.good : o.odds >= 0.35 ? C.gold : C.bad); hbar(c, r.x + 160, y + 3, r.w - 172, 9, o.odds, o.odds >= 0.6 ? C.good : C.gold); y += 22; }
          if (o.cost) { T(c, `費用：${o.cost}`, r.x + 10, y, 12, C.dim); y += 16; }
          for (const l of o.lines || []) { if (y > r.y + r.h - 20) break; y = para(c, `・${l}`, r.x + 10, y, r.w - 20, 12, C.dim, 15, 3); }
          y = Math.min(y + 4, r.y + r.h - 40);
          pips(c, r.x + 10, r.y + r.h - 30, cur.level, cur.ladder);
          ladderLabels(c, r.x + 10, r.y + r.h - 18, cur.ladder, cur.level);
        },
        tip: () => '熱が25・50・75・100を超えるたび、批判→造反→分裂へ進む',
      });
      if (i < 0) return;
      const o = opts[i];
      const dangerous = ['suppress', 'discipline', 'walkout', 'rebel'].includes(o.id);
      const k = await ui.confirm({ title: o.name, w: 450, danger: dangerous, text: `${o.desc}\n${o.odds != null ? `成功の見込み ${Math.round(o.odds * 100)}%\n` : ''}${(o.lines || []).join('\n')}`, choices: ['実行する', 'やめる'], index: 1, cancel: 1 });
      if (k !== 0) continue;
      const r = g.conflictAct(cur.id, o.id);
      if (!r.ok) { sfx('buzz'); await ui.alert(o.name, r.why); continue; }
      sfx(r.success === false ? 'buzz' : 'good');
      await ui.alert(`${o.name}${r.success === false ? '：失敗' : ''}`, String(r.text).split('\n'));
      return;
    }
  }

  // ---------------------------------------------------------------- pledges
  function paramEditor(g, polId, params0) {
    const pl = K.POLICIES[polId];
    const params = { ...params0 };
    const v = {
      title: `${pl.name}：数字を決める`, idx: 0,
      hint: '↑↓:項目 ←→:数字 A:決定 B:やめる',
      tip: () => 'いまの景気と財政をふまえて、実現できる数字にしよう',
      update(ui, inp) {
        const ps = pl.params || [];
        if (inp.repeat('up')) { v.idx = (v.idx + ps.length - 1) % Math.max(1, ps.length); sfx('cursor'); }
        if (inp.repeat('down')) { v.idx = (v.idx + 1) % Math.max(1, ps.length); sfx('cursor'); }
        const d = ps[v.idx];
        if (d && inp.repeat('left')) { params[d.key] = clamp(num(params[d.key], d.def) - (d.step || 1), d.min, d.max); sfx('cursor'); }
        if (d && inp.repeat('right')) { params[d.key] = clamp(num(params[d.key], d.def) + (d.step || 1), d.min, d.max); sfx('cursor'); }
        if (inp.pressed('a')) { sfx('ok'); ui.done(v, params); } else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); }
      },
      draw(c) {
        const pv = g.policyPreview(polId, params);
        card(c, 6, 30, SW - 12, SH - 55, pl.name);
        let y = para(c, pl.desc, 16, 52, SW - 32, 12, C.dim, 16, 2) + 8;
        (pl.params || []).forEach((d, i) => {
          const sel = i === v.idx;
          if (sel) R(c, 12, y - 3, SW - 24, 36, C.sel);
          T(c, d.name, 20, y, 14, sel ? C.gold : C.text);
          T(c, `${sel ? '◀ ' : ''}${num(params[d.key], d.def)}${d.unit}${sel ? ' ▶' : ''}`, SW - 20, y, 14, '#ffffff', 'right');
          const span = Math.max(1e-9, d.max - d.min);
          R(c, 24, y + 24, SW - 48, 2, '#2a3262');
          R(c, 24 + Math.round(clamp((num(params[d.key], d.def) - d.min) / span, 0, 1) * (SW - 48)) - 3, y + 21, 7, 8, sel ? C.gold : C.cyan);
          y += 42;
        });
        const cost = num(pv && pv.cost);
        y += 4;
        T(c, cost > 0 ? `財政：年${Math.round(cost * 10) / 10}兆円の支出` : cost < 0 ? `財政：年${Math.round(-cost * 10) / 10}兆円の財源` : '財政：大きな負担はない', 20, y, 14, cost > 0 ? C.warn : cost < 0 ? C.good : C.dim);
        y += 22;
        const segs = pv ? Object.entries(pv.segments || {}).filter(([, x]) => Math.abs(x) >= 0.5).sort((a, b) => b[1] - a[1]) : [];
        T(c, `喜ぶ層：${segs.filter(([, x]) => x > 0).slice(0, 4).map(([s]) => K.SEG_SHORT[s]).join('・') || 'なし'}`, 20, y, 12, C.good); y += 16;
        T(c, `反発する層：${segs.filter(([, x]) => x < 0).slice(-4).map(([s]) => K.SEG_SHORT[s]).join('・') || 'なし'}`, 20, y, 12, '#ff9aa4');
      },
    };
    return v;
  }
  K.paramEditor = paramEditor;
  async function pledgeMenu(ui, q, D) {
    const g = ui.g;
    const mf = D.mf;
    const canEdit = mf.canEdit;
    const items = [];
    if (q.status !== 'fulfilled' && q.status !== 'broken' && q.status !== 'dropped') {
      if (mf.mine && !q.billId) items.push({ id: 'bill', label: '法案にして国会に出す', sub: canEdit ? '議員立法・閣法（法案の画面へ進む）' : '議員立法として出す', c: C.cyan });
      if (canEdit && !mf.locked) { items.push({ id: 'prio', label: q.prio >= 2 ? '重点公約を外す' : '重点公約にする', sub: '重点：実現すれば評価2倍、破れば反動も2倍' }); if (K.POLICIES[q.policy].params) items.push({ id: 'params', label: '数字を変える', sub: '費用と賛否の見込みを見ながら決める' }); items.push({ id: 'remove', label: '公約から外す', sub: mf.locked ? '' : '公示前なら、ペナルティはほとんどない', c: C.dim }); }
      if (canEdit && mf.locked) { items.push({ id: 'water', label: '数字を弱める（修正）', sub: '批判は出るが、撤回よりは傷が浅い', danger: true, disabled: !K.POLICIES[q.policy].params }); items.push({ id: 'break', label: '公約を撤回する（破る）', sub: '支持率・信用・党内の評価に響く', danger: true }); }
      if (canEdit && !mf.locked && false) items.push({ id: 'break', label: '公約を撤回する', danger: true });
    }
    items.push({ id: 'voices', label: '賛成・反対の声を見る', sub: '街の声（中立）' });
    items.push({ id: 'back', label: 'もどる' });
    const i = await ui.menu({
      title: q.name, listTitle: `${q.statusName}・${q.prio >= 2 ? '重点' : '通常'}`, listW: 300, rowH: 34,
      items: items.map((it) => ({ label: it.label, sub: it.sub, labelColor: it.danger ? '#ffb0b8' : it.c, disabled: !!it.disabled })),
      detail: (c, it, r, k) => {
        const x = items[k];
        card(c, r.x, r.y, r.w, r.h, x ? x.label : q.name);
        if (!x) return;
        if (x.id === 'break' || x.id === 'water') {
          const bp = g.pledgeBreakPreview(q.id, x.id === 'water' ? 'water' : 'drop');
          if (bp) { let y = r.y + 26; for (const l of bp.lines) y = para(c, `・${l}`, r.x + 10, y, r.w - 20, 12, C.text, 15, 3) + 2; }
        } else if (x.id === 'voices') {
          const vs = g.pledgeVoices(q.policy);
          let y = r.y + 26;
          T(c, '賛成の声', r.x + 10, y, 12, C.good); y += 15;
          for (const l of vs.pro.slice(0, 2)) y = para(c, `【${l.who}】${l.text}`, r.x + 10, y, r.w - 20, 12, C.text, 15, 2) + 2;
          y += 4; T(c, '反対の声', r.x + 10, y, 12, '#ff9aa4'); y += 15;
          for (const l of vs.con.slice(0, 3)) y = para(c, `【${l.who}】${l.text}`, r.x + 10, y, r.w - 20, 12, C.text, 15, 2) + 2;
        } else {
          let y = para(c, x.sub || '', r.x + 10, r.y + 26, r.w - 20, 12, C.dim, 16, 3) + 8;
          R(c, r.x + 10, y, r.w - 20, 1, '#2a3262'); y += 8;
          T(c, `状態：${q.statusName}${q.prio >= 2 ? '（重点）' : ''}`, r.x + 10, y, 12, C.text); y += 16;
          T(c, fit(c, `費用：${q.cost > 0 ? `年${q.cost}兆円の支出` : q.cost < 0 ? `年${-q.cost}兆円の財源` : '大きな負担なし'}`, r.w - 20, 12), r.x + 10, y, 12, q.cost > 3 ? C.warn : C.text); y += 16;
          T(c, fit(c, `期限：${q.status === 'fulfilled' ? '実現ずみ' : q.daysLeft > 0 ? `選挙まであと${q.daysLeft}日` : '期限'}${q.billId ? '・法案あり' : ''}`, r.w - 20, 12), r.x + 10, y, 12, C.text); y += 18;
          if (q.why) para(c, q.why, r.x + 10, y, r.w - 20, 12, C.dim, 15, 3);
        }
      },
    });
    if (i < 0) return;
    const it = items[i];
    if (it.disabled) return;
    if (it.id === 'bill') {
      const r = g.pledgeBill(q.id);
      if (!r.ok) { sfx('buzz'); await ui.alert('法案にする', r.why); return; }
      sfx('success'); await ui.alert('法案にした', [r.text, '国会で審議が始まる（議員立法は賛成者集めから）。']);
    } else if (it.id === 'prio') { const r = g.pledgePriority(q.id, q.prio >= 2 ? 1 : 2); if (!r.ok) { sfx('buzz'); ui.toast(r.why, C.dim); } else ui.toast(r.text, C.good); }
    else if (it.id === 'params') {
      const np = await ui.open(paramEditor(g, q.policy, q.params));
      if (np) { const r = g.pledgeParams(q.id, np); ui.toast(r.ok ? r.text : r.why, r.ok ? C.good : C.dim); }
    } else if (it.id === 'remove') { const r = g.pledgeRemove(q.id); ui.toast(r.ok ? r.text : r.why, r.ok ? C.good : C.dim); }
    else if (it.id === 'break' || it.id === 'water') {
      const bp = g.pledgeBreakPreview(q.id, it.id === 'water' ? 'water' : 'drop');
      const k = await ui.confirm({ title: it.label, danger: true, w: 470, text: `「${q.name}」\n${bp ? bp.lines.join('\n') : ''}`, choices: ['やめておく', '破る（実行する）'], index: 0, cancel: 0 });
      if (k !== 1) return;
      const r = g.pledgeBreak(q.id, it.id === 'water' ? 'water' : 'drop');
      sfx(r.ok ? 'buzz' : 'cancel'); await ui.alert('公約', r.ok ? String(r.text).split('\n') : r.why);
    } else if (it.id === 'voices') { /* shown in the detail */ }
  }
  async function addPledges(ui, D) {
    const g = ui.g;
    const mf = D.mf;
    const cur = mf.list.filter((q) => !['broken', 'dropped', 'expired'].includes(q.status)).map((q) => q.policy);
    if (!mf.mine) { ui.toast('自分の党の公約だけ編集できる', C.dim); return; }
    if (!mf.canEdit) {
      // a member proposes one policy to the leadership
      const picked = await K.policyStudio(ui, { mode: 'pick', picked: [], max: 1, title: '党の公約に提案する政策（1つ）' });
      if (!picked || !picked.length) return;
      const odds = g.pledgeProposeOdds(picked[0]);
      const k = await ui.confirm({ title: '公約に提案する', text: `「${K.POLICIES[picked[0]].name}」を党の公約に提案する。\n採用される見込み ${odds != null ? Math.round(odds * 100) : '?'}%（党内の評価と、党の方針との近さしだい）\n体力8`, choices: ['提案する', 'やめる'], index: 0, cancel: 1 });
      if (k !== 0) return;
      const r = g.pledgePropose(picked[0]);
      sfx(r.ok && r.success !== false ? 'success' : 'cancel');
      await ui.alert('提案', r.ok ? String(r.text).split('\n') : r.why);
      return;
    }
    const picked = await K.policyStudio(ui, { mode: 'pick', picked: cur.slice(), max: mf.max, title: '公約を決める（Aで入れる・外す）' });
    if (!picked) return;
    const add = picked.filter((id) => !cur.includes(id));
    const del = cur.filter((id) => !picked.includes(id));
    const out = [];
    for (const id of del) { const q = mf.list.find((x) => x.policy === id); if (q) { const r = g.pledgeRemove(q.id); out.push(r.ok ? `外した：${q.short}` : `外せない：${q.short}（${r.why}）`); } }
    for (const id of add) { const r = g.pledgeAdd(id); out.push(r.ok ? `加えた：${K.POLICIES[id].name.replace(/（[^）]*）/g, '')}` : `加えられない：${K.POLICIES[id].name.replace(/（[^）]*）/g, '')}（${r.why}）`); }
    if (out.length) await ui.alert('公約', out);
  }

  // ---------------------------------------------------------------- the hub view
  const TABS = [
    { id: 'faction', label: '勢力図' }, { id: 'rival', label: '動き' }, { id: 'conflict', label: '紛争' }, { id: 'pledge', label: '公約' },
    { id: 'stance', label: '外交' }, { id: 'post', label: '人事' }, { id: 'decide', label: '決断' },
  ];
  function hubView(g, o = {}) {
    let D = null, DT = -99;
    const st = { pid: o.party || null, tab: Math.max(0, TABS.findIndex((t) => t.id === o.tab)), sel: o.select || null, auto: !o.tab };
    const lbs = {};
    const load = (ui, force) => {
      if (!force && D && ui.t - DT < 24) return D;
      DT = ui.t;
      try {
        const ov = g.intra(st.pid);
        if (!ov) { D = null; return null; }
        D = { ov, conflicts: g.conflicts({}), events: g.intraEvents(), mf: has(g, 'manifesto') ? g.manifesto(ov.party) : null, sb: has(g, 'stanceBoard') ? g.stanceBoard(ov.party) : null };
        D.partyConflicts = D.conflicts.filter((c) => c.party === ov.party || (c.kind === 'coalition' && c.involves));
      } catch (e) { console.error(e); D = null; }
      return D;
    };
    const tabRows = (ui) => {
      const d = load(ui);
      if (!d) return [];
      const ov = d.ov;
      const tab = TABS[st.tab].id;
      const rows = [];
      if (tab === 'faction') {
        for (const f of ov.factions) rows.push({ kind: 'faction', f, label: f.name, sub: `${f.word}・領袖 ${f.leaderName}${f.leaderAge ? `（${f.leaderAge}）` : ''}`, right: `${f.size}人`, color: moodCol(f.mood), tag: f.mine ? { text: '所属', color: '#2a7a4a' } : tagFor(f), labelColor: f.mine ? C.gold : undefined });
        if (ov.parties.length > 1) rows.push({ kind: 'switch', label: '他の党の勢力図を見る', sub: `いま：${ov.short}`, labelColor: C.cyan });
        if (ov.role !== 'none') rows.push({ kind: 'self', label: '自分で動く（派閥の旗揚げ・倒閣）', sub: '派閥をつくる／党首おろしを仕掛ける', labelColor: C.gold });
      } else if (tab === 'rival') {
        if (ov.plot) rows.push({ kind: 'plot', p: ov.plot, label: ov.plot.mine ? '倒閣運動（あなたが標的）' : ov.plot.playerBoss ? '倒閣運動（あなたが首謀）' : '党首おろしの動き', sub: `${ov.plot.stageLabel}・決着まで${ov.plot.daysLeft}日`, right: `${Math.round(ov.plot.odds)}%`, rightColor: ov.plot.odds >= 50 ? C.bad : C.warn, color: C.bad, labelColor: '#ffb0b8' });
        else rows.push({ kind: 'calm', label: '倒閣の動きは、いまのところ見られない', sub: ov.tension >= 18 ? '党内の不満がたまると、動きが出る' : '党内は落ち着いている', color: C.good });
        for (const r of ov.rivals) rows.push({ kind: 'rival', r, label: r.name, sub: `${r.role}・${r.faction || '無派閥'}`, right: `脅威${r.threat}`, rightColor: r.threat >= 70 ? C.bad : r.threat >= 50 ? C.warn : C.dim, tag: tagFor(r), color: moodCol(r.mood) });
      } else if (tab === 'conflict') {
        const L = d.partyConflicts.length ? d.partyConflicts : d.conflicts;
        for (const c of L) rows.push({ kind: 'conflict', c, label: c.title, sub: `${c.partyShort}・${c.kindName}${c.status !== 'live' ? '（終了）' : ''}`, right: c.status === 'live' ? `熱${c.heat}` : '', tag: c.status === 'live' ? { text: c.levelName, color: shade(levelCol(c.level), -0.35) } : null, color: c.status === 'live' ? levelCol(c.level) : C.faint, labelColor: c.status === 'live' ? undefined : C.faint });
        if (!rows.length) rows.push({ kind: 'none', label: '党内に大きな紛争はない', sub: '政策・公認・責任論・連立・世代・地域…の対立が起きるとここに出る', color: C.good });
      } else if (tab === 'pledge') {
        const mf = d.mf;
        if (!mf) return [{ kind: 'none', label: '公約のしくみが読み込まれていない' }];
        rows.push({ kind: 'summary', label: `${mf.short}の公約（第${mf.edition}期）`, sub: `実現${mf.counts.fulfilled}・審議中${mf.counts.progress}・未着手${mf.counts.promised}・違反${mf.counts.broken}`, right: mf.locked ? '公示後' : `選挙まで${mf.daysLeft}日`, color: C.gold, labelColor: C.gold });
        for (const q of mf.list) rows.push({ kind: 'pledge', q, label: `${q.prio >= 2 ? '★' : ''}${q.short}`, sub: q.paramText || q.areaName, right: q.statusName, rightColor: STAT_COL[q.status] || C.dim, color: STAT_COL[q.status] || C.dim, tag: q.carried ? { text: '再掲', color: '#5a4a1a' } : null });
        if (mf.mine) rows.push({ kind: 'add', label: mf.canEdit ? (mf.locked ? '（公示後は公約を加えられない）' : '＋ 公約を加える・整理する') : '＋ 公約を党に提案する', sub: mf.canEdit ? `${mf.list.length}/${mf.max}件` : '採用は党の判断', labelColor: C.cyan, disabled: mf.canEdit && mf.locked });
        if (ov.parties.length > 1) rows.push({ kind: 'switch', label: '他の党の公約を見る', sub: `いま：${ov.short}`, labelColor: C.cyan });
      } else if (tab === 'stance') {
        const sb = d.sb;
        if (!sb) return [{ kind: 'none', label: '外交スタンスのしくみが読み込まれていない' }];
        rows.push({ kind: 'me', s: sb.me, label: 'あなたのスタンス', sub: sb.me.long, right: sb.me.label, rightColor: C.gold, color: C.gold, labelColor: C.gold });
        rows.push({ kind: 'cab', s: sb.cabinet, label: '内閣（総理）のスタンス', sub: sb.cabinet.long, right: sb.cabinet.label, color: C.cyan });
        rows.push({ kind: 'party', s: sb.partyStance, label: `${sb.partyName}の基本の立場`, sub: sb.partyStance.long, right: sb.partyStance.label, color: C.dim });
        for (const f of sb.factions) rows.push({ kind: 'fstance', f, s: f.stance, label: f.name, sub: `${f.size}人・${f.stance.long}`, right: f.stance.label, color: C.dim });
      } else if (tab === 'post') {
        for (const p of ov.posts) rows.push({ kind: 'post', p, label: p.label, sub: `${p.whoName}${p.faction ? `（${p.faction}）` : ''}`, right: p.claims.length ? `要求${p.claims.length}` : '', rightColor: C.warn, color: p.player ? C.gold : p.claims.length ? C.warn : C.dim, labelColor: p.player ? C.gold : undefined });
        for (const dd of ov.deals) rows.push({ kind: 'deal', d: dd, label: `約束：${dd.faction}に${dd.post}`, sub: `あと${dd.left}日で果たす`, right: `あと${dd.left}日`, rightColor: dd.left <= 10 ? C.bad : C.warn, color: C.warn });
        if (ov.mine) rows.push({ kind: 'admin', label: '党の運営', sub: '派閥に入る・党首選・入党の呼びかけ・党の資金', color: C.cyan, labelColor: C.cyan });
      } else if (tab === 'decide') {
        for (const e of d.events) rows.push({ kind: 'event', e, label: e.title, sub: `あと${e.left}日・放っておくと「${(e.choices.find((c) => c.id === e.defaultChoice) || {}).label || '成り行き'}」`, right: `${e.left}日`, rightColor: e.left <= 2 ? C.bad : C.warn, color: C.bad, labelColor: '#ffd0a0' });
        for (const l of ov.log) rows.push({ kind: 'log', l, label: l.text, sub: dl(g, l.day), color: C.faint, labelColor: C.dim });
        if (!rows.length) rows.push({ kind: 'none', label: '決断を迫られている件はない', sub: '党内で何かが起きると、ここに出る', color: C.good });
      }
      return rows;
    };
    const lbFor = (ui) => {
      const id = TABS[st.tab].id;
      if (!lbs[id]) lbs[id] = new ListBox({ items: () => tabRows(ui), rowH: id === 'decide' ? 34 : 34 });
      return lbs[id];
    };
    const v = {
      bigtextList: (ui) => lbFor(ui), // [R13-F] the portrait lower screen (bigtext_polui.js): the list and the tab chips of this view
      bigtextTabs: () => ({ items: TABS.map((t) => t.label), index: st.tab, onPick: (i) => { st.tab = i; }, skip: { x: 6, y: 78, w: SW - 12, h: 22 } }),
      title: () => `党内：${D ? D.ov.partyName : ''}`, focus: 'list',
      hint: '←→:タブ ↑↓:えらぶ A:動く・開く B:もどる',
      tip: () => {
        const t = TABS[st.tab].id;
        return { faction: '派閥は議員の集まり。人事・お金・推薦で結ばれ、党首選や倒閣運動で数がものをいう', rival: '領袖や番頭は、機会があれば党首を狙う。野心・機嫌・数から「脅威」を出している', conflict: '不満→公然批判→造反→分裂・離党。早めの調停や譲歩で収まることも', pledge: '公約は選挙での約束。破ると支持率・信用・党内の評価に響く', stance: '外交スタンスは、相手国との関係・貿易・世論・党内の対立に影響する', post: '幹事長・政調会長などの党役員は、派閥のあいだの取引でもある', decide: '期限までに決めないと、成り行きになる' }[t];
      },
      enter(ui) {
        load(ui, true);
        if (st.auto && D && D.events.length) st.tab = TABS.findIndex((t) => t.id === 'decide');
        else if (st.auto && D && D.ov.plot) st.tab = 1;
        if (st.sel && D) {
          const L = lbFor(ui);
          const rows = tabRows(ui);
          const k = rows.findIndex((r) => (r.c && r.c.id === st.sel) || (r.q && r.q.id === st.sel) || (r.f && r.f.id === st.sel));
          if (k >= 0) L.idx = k;
        }
      },
      update(ui, inp) {
        const d = load(ui);
        if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); return; }
        if (!d) return;
        if (inp.repeat('left')) { st.tab = (st.tab + TABS.length - 1) % TABS.length; sfx('cursor'); return; }
        if (inp.repeat('right')) { st.tab = (st.tab + 1) % TABS.length; sfx('cursor'); return; }
        const L = lbFor(ui);
        L.move(inp);
        if (!inp.pressed('a')) return;
        const row = L.current();
        if (!row) return;
        if (row.disabled) { sfx('buzz'); return; }
        sfx('ok');
        ui.act(async () => { await act(ui, row, d); load(ui, true); });
      },
      draw(c, ui) {
        const d = load(ui);
        if (!d) { card(c, 6, 30, SW - 12, 60, '党内'); para(c, '政党のしくみが読み込まれていない。', 16, 56, SW - 32, 12, C.dim); return; }
        drawBanner(c, ui, d);
        // tabs
        const tw = Math.floor((SW - 12) / TABS.length);
        TABS.forEach((t, i) => {
          const on = i === st.tab;
          const x = 6 + i * tw;
          R(c, x, 80, tw - 2, 18, on ? C.sel : '#10173a');
          R(c, x, 80, tw - 2, 1, on ? C.gold : C.edge);
          const badge = t.id === 'decide' ? d.events.length : t.id === 'conflict' ? d.partyConflicts.filter((q) => q.status === 'live' && q.level >= 2).length : t.id === 'rival' && d.ov.plot ? 1 : 0;
          T(c, t.label, x + (tw - 2) / 2, 82, 12, on ? '#ffffff' : C.dim, 'center');
          if (badge) R(c, x + tw - 10, 83, 5, 5, C.bad);
        });
        const L = lbFor(ui);
        card(c, 6, 100, 292, SH - 125, null);
        L.draw(c, 8, 102, 288, SH - 129, true, ui.t);
        const rect = { x: 302, y: 100, w: SW - 308, h: SH - 125 };
        try { drawDetail(c, ui, d, L.current(), rect); } catch (e) { console.error(e); }
      },
    };
    // ---- the banner
    function drawBanner(c, ui, d) {
      const ov = d.ov;
      card(c, 6, 28, SW - 12, 50, null);
      drawPartyMark(c, g, ov.party, 12, 32, 40);
      T(c, fit(c, `${ov.partyName}${ov.real ? '' : ''}`, 190, 14), 58, 31, 14, '#ffffff');
      T(c, fit(c, `${ov.leaderTitle}：${ov.leaderName}${ov.isPMParty ? '（総理）' : ''}`, 190, 12), 58, 48, 12, C.dim);
      pill(c, 58, 62, roleText(ov), ov.role === 'leader' ? '#8a6a1a' : ov.role === 'none' ? '#3a4066' : '#2a5a7a', '#ffffff', 10);
      // tension
      T(c, '党内の緊張', 262, 31, 12, C.dim);
      hbar(c, 262, 47, 110, 8, ov.tension / 100, ov.tension >= 60 ? C.bad : ov.tension >= 38 ? C.warn : C.good);
      T(c, `${ov.tensionLabel}（${ov.tension}）`, 262, 59, 12, ov.tension >= 60 ? C.bad : ov.tension >= 38 ? C.warn : C.text);
      T(c, `党内の評価 ${ov.standing}`, 380, 31, 12, C.dim);
      hbar(c, 380, 47, 90, 8, ov.standing / 100, C.gold);
      T(c, fit(c, ov.mine ? `所属：${(ov.factions.find((f) => f.mine) || { name: '無派閥' }).name}` : '（あなたの党ではない）', 100, 12), 380, 59, 12, C.text);
      // the flashpoint / the plot
      if (ov.plot) {
        R(c, 478, 31, SW - 488, 44, '#3a1018'); R(c, 478, 31, 3, 44, C.bad);
        T(c, '倒閣の動き', 486, 33, 12, C.bad);
        T(c, fit(c, `${ov.plot.bossName}氏ら・${ov.plot.stageLabel}`, SW - 500, 12), 486, 47, 12, '#ffd0d0');
        T(c, fit(c, `見込み${Math.round(ov.plot.odds)}%・あと${ov.plot.daysLeft}日`, SW - 500, 12), 486, 61, 12, '#ffffff');
      } else {
        T(c, '次の火種', 482, 31, 12, C.dim);
        if (ov.flash) { T(c, `あと${ov.flash.days}日`, SW - 12, 31, 12, C.text, 'right'); para(c, ov.flash.text, 482, 45, SW - 494, 12, C.gold, 14, 2); }
        else T(c, '特になし', 482, 47, 12, C.dim);
      }
    }
    // ---- the detail panel
    function drawDetail(c, ui, d, row, r) {
      const ov = d.ov;
      const tab = TABS[st.tab].id;
      if (!row) { card(c, r.x, r.y, r.w, r.h, ''); return; }
      const X0 = r.x + 10, W = r.w - 20;
      if (row.kind === 'faction') {
        const f = row.f;
        card(c, r.x, r.y, r.w, r.h, `${f.name}（${f.word}）`, { right: `第${f.rank}位`, rightW: 60 });
        let y = r.y + 23;
        const L = 14;
        T(c, fit(c, `領袖：${f.leaderName}${f.leaderAge ? `（${f.leaderAge}歳・当選${f.leaderWins}回）` : ''}`, W, 12), X0, y, 12, C.text); y += L;
        T(c, fit(c, `番頭：${f.bantouName || '—'}${f.bantouAge ? `（${f.bantouAge}歳）` : ''}${f.heir ? '・後継候補あり' : ''}`, W, 12), X0, y, 12, C.dim); y += L;
        T(c, fit(c, `議員 ${f.size}人（党の${f.share}%）・力関係 ${f.power}${f.funds ? `・活動費 ${K.fmtBig(f.funds)}` : ''}`, W, 12), X0, y, 12, C.text); y += L;
        hbar(c, X0, y, W, 5, clamp(f.share / 50, 0, 1), '#5a78c8'); y += 9;
        const posts = [...f.posts.party.map((p) => ov.posts.find((q) => q.post === p)).filter(Boolean).map((p) => p.label), ...f.posts.cabinet.map((p) => K.postName(p, K.polDate(g).fy)), ...(f.posts.pm ? ['総理'] : []), ...(f.posts.leader ? [ov.leaderTitle] : [])];
        T(c, fit(c, `役職：${posts.join('・') || 'なし'}`, W, 12), X0, y, 12, posts.length ? C.gold : C.dim); y += L;
        T(c, `機嫌：${f.moodWord}`, X0, y, 12, moodCol(f.mood)); cbar(c, X0 + 110, y + 3, W - 110, 7, f.mood / 100, C.good, C.bad); y += L;
        T(c, `野心 ${f.ambition}`, X0, y, 12, C.dim); hbar(c, X0 + 110, y + 3, W - 110, 7, f.ambition / 100, '#ff9a5a'); y += L;
        T(c, fit(c, `意図：${f.intentLabel}${f.demand ? `（${K.postName(f.demand.post, K.polDate(g).fy, ov.party)}を要求）` : ''}　貸し${f.owe}・恨み${f.grudge}`, W, 12), X0, y, 12, tagFor(f).color === '#3a4066' ? C.text : C.warn); y += L + 2;
        if (f.stance) { T(c, fit(c, `外交：${f.stance.long}`, W, 12), X0, y, 12, C.cyan); y += L; stanceBars(c, X0, y, W, f.stance.vec); }
      } else if (row.kind === 'rival') {
        const q = row.r;
        card(c, r.x, r.y, r.w, r.h, q.name, { right: q.role, rightW: 90 });
        const p = polOf(g);
        R(c, X0, r.y + 24, 44, 44, '#0c1230');
        const n = p.npcs[q.id];
        if (n) drawFaceHD(c, n.look, X0 + 1, r.y + 25, 1.4);
        T(c, fit(c, `${q.faction || '無派閥'}・${q.age}歳・当選${q.wins}回`, W - 54, 12), X0 + 54, r.y + 26, 12, C.text);
        T(c, fit(c, q.post ? `役職：${q.post}` : '役職なし', W - 54, 12), X0 + 54, r.y + 41, 12, q.post ? C.gold : C.dim);
        T(c, q.isPM ? '総理' : q.isBoss ? '派閥の領袖' : '', X0 + 54, r.y + 55, 12, C.cyan);
        let y = r.y + 76;
        T(c, `脅威 ${q.threat}`, X0, y, 12, q.threat >= 70 ? C.bad : C.warn); hbar(c, X0 + 80, y + 3, W - 80, 7, q.threat / 100, q.threat >= 70 ? C.bad : C.warn); y += 15;
        T(c, `野心 ${q.ambition}`, X0, y, 12, C.dim); hbar(c, X0 + 80, y + 3, W - 80, 7, q.ambition / 100, '#ff9a5a'); y += 15;
        T(c, `派閥の力 ${q.powerShare}%`, X0, y, 12, C.dim); hbar(c, X0 + 80, y + 3, W - 80, 7, q.powerShare / 50, '#5a78c8'); y += 15;
        T(c, `機嫌 ${sgn(q.mood)}`, X0, y, 12, moodCol(q.mood)); cbar(c, X0 + 80, y + 3, W - 80, 7, q.mood / 100, C.good, C.bad); y += 15;
        T(c, fit(c, `人望 ${q.charisma}・清廉さ ${q.integrity}・あなたへの恨み ${q.grudge}`, W, 12), X0, y, 12, C.text); y += 15;
        T(c, fit(c, `意図：${q.intentLabel}`, W, 12), X0, y, 12, C.text); y += 17;
        const ps = has(g, 'politicianProfile') ? g.politicianProfile(q.id) : null;
        if (ps && ps.stance) { T(c, `外交：${ps.stance.long}`, X0, y, 12, C.cyan); }
        para(c, 'A：この人に動く／くわしく', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (row.kind === 'plot') {
        const pl = row.p;
        card(c, r.x, r.y, r.w, r.h, pl.mine ? '倒閣運動：あなたが標的' : pl.playerBoss ? '倒閣運動：あなたが首謀' : '党首おろしの動き', { accent: C.bad });
        let y = r.y + 24;
        T(c, fit(c, `首謀：${pl.bossName}氏（${pl.blocNames.join('・') || '—'}）`, W, 12), X0, y, 12, C.text); y += 16;
        T(c, `段階：${pl.stageLabel}・決着まであと${pl.daysLeft}日`, X0, y, 12, C.dim); y += 18;
        T(c, `倒閣派 ${pl.S}人`, X0, y, 12, '#ff9aa4'); T(c, `擁護派 ${pl.L}人`, X0 + W, y, 12, '#8ab4ff', 'right'); y += 15;
        bar2(c, X0, y, W, pl.S, pl.L); y += 18;
        T(c, `倒閣が成功する見込み ${Math.round(pl.odds)}%`, X0, y, 16, pl.odds >= 50 ? C.bad : C.gold); y += 22;
        for (const rs of pl.reasons.slice(0, 5)) { T(c, fit(c, `${rs.v >= 0 ? '＋' : '−'} ${rs.label}`, W, 12), X0, y, 12, rs.v >= 0 ? '#ff9aa4' : '#8ab4ff'); y += 14; }
        y += 2;
        for (const l of pl.log.slice(-3).reverse()) { if (y > r.y + r.h - 30) break; T(c, fit(c, `・${dl(g, l.day)} ${l.text}`, W, 12), X0, y, 12, C.dim); y += 14; }
        para(c, 'A：対策を打つ（結集・懐柔・切り崩しなど）', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (row.kind === 'calm') {
        card(c, r.x, r.y, r.w, r.h, '党首（総理）をめぐる動き');
        let y = para(c, '倒閣運動は、支持率の低迷・派閥の不満・選挙が近いことなどが重なると起きる。', X0, r.y + 26, W, 12, C.text, 16, 4) + 6;
        y = para(c, '数字で見る党内：', X0, y, W, 12, C.gold, 16, 1);
        for (const f of ov.factions.slice(0, 5)) { T(c, fit(c, `${f.name}　機嫌 ${f.moodWord}`, W, 12), X0, y, 12, moodCol(f.mood)); y += 15; }
        if (ov.hist.length) { y += 4; T(c, '過去の動き', X0, y, 12, C.gold); y += 15; for (const h of ov.hist.slice(0, 3)) { T(c, fit(c, `・${dl(g, h.day)} ${h.bossName}氏：${{ toppled: '成功', defended: '失敗', void: '消滅' }[h.result] || h.result}`, W, 12), X0, y, 12, C.dim); y += 14; } }
      } else if (row.kind === 'conflict') {
        const cf = row.c;
        card(c, r.x, r.y, r.w, r.h, cf.kindName, { accent: cf.color, right: cf.partyShort, rightW: 70 });
        let y = r.y + 24;
        y = para(c, cf.title, X0, y, W, 14, '#ffffff', 17, 2) + 2;
        y = para(c, cf.desc, X0, y, W, 12, C.text, 15, 4) + 4;
        T(c, `熱 ${cf.heat}／100・${cf.risk}`, X0, y, 12, levelCol(cf.level)); hbar(c, X0 + 150, y + 3, W - 150, 7, cf.heat / 100, levelCol(cf.level)); y += 15;
        pips(c, X0, y, cf.level, cf.ladder); y += 10; ladderLabels(c, X0, y, cf.ladder, cf.level); y += 15;
        T(c, fit(c, `批判する側：${cf.sideA.label}（${cf.sideA.n}人${cf.sideA.mood != null ? `・機嫌${sgn(cf.sideA.mood)}` : ''}）`, W, 12), X0, y, 12, '#ff9aa4'); y += 14;
        T(c, fit(c, `執行部・主流：${cf.sideB.label}（${cf.sideB.n}人）`, W, 12), X0, y, 12, '#8ab4ff'); y += 16;
        for (const l of cf.log.slice(-3).reverse()) { if (y > r.y + r.h - 30) break; T(c, fit(c, `・${dl(g, l.day)} ${l.text}`, W, 12), X0, y, 12, C.dim); y += 14; }
        if (cf.status === 'live') para(c, cf.options.length ? `A：手を打つ（${cf.options.length}つの選択肢）` : '打てる手がない（役職か領袖の立場が要る）', X0, r.y + r.h - 16, W, 12, cf.options.length ? C.gold : C.dim, 14, 1);
      } else if (row.kind === 'pledge' || row.kind === 'summary') {
        const mf = d.mf;
        if (row.kind === 'summary') {
          card(c, r.x, r.y, r.w, r.h, '公約のまとめ', { right: mf.real ? '' : '', rightW: 10 });
          let y = r.y + 24;
          T(c, fit(c, `${mf.partyName}${mf.ruling ? '（与党）' : '（野党）'}`, W, 12), X0, y, 12, C.text); y += 16;
          T(c, `${mf.electionLabel}`, X0, y, 12, C.dim); y += 15;
          T(c, mf.locked ? '公示のあと：公約は変えられない（外すと「公約違反」）' : `公示（${mf.kojiDate}）まで公約を整理できる`, X0, y, 12, mf.locked ? C.warn : C.good); y += 18;
          T(c, `信用：${mf.credLabel}（${mf.cred}）`, X0, y, 12, mf.cred >= 5 ? C.good : mf.cred < -15 ? C.bad : C.text); cbar(c, X0 + 180, y + 3, W - 180, 7, mf.cred / 100, C.good, C.bad); y += 18;
          T(c, '費用のめやす（未実現の分）', X0, y, 12, C.gold); y += 15;
          T(c, `年${mf.cost.net}兆円（支出${mf.cost.spend}・財源${mf.cost.revenue}）`, X0, y, 12, mf.cost.net > 4 ? C.warn : C.text); y += 14;
          T(c, `消費税にして約${mf.cost.taxEq}ポイント分（1ポイント＝約${mf.cost.perPct}兆円）`, X0, y, 12, C.dim); y += 18;
          for (const h of mf.history.slice(0, 2)) { T(c, fit(c, `前回：実現${h.fulfilled}・違反${h.broken}（採点${h.score}）`, W, 12), X0, y, 12, C.dim); y += 14; }
          para(c, '公約が実現すれば支持率と信用が上がり、破れば野党が選挙で攻める。', X0, r.y + r.h - 34, W, 12, C.cyan, 15, 2);
        } else {
          const q = row.q;
          const pl = K.POLICIES[q.policy];
          card(c, r.x, r.y, r.w, r.h, q.areaName || '公約', { right: q.statusName, rightColor: STAT_COL[q.status], rightW: 70 });
          let y = r.y + 24;
          y = para(c, `${q.prio >= 2 ? '★重点　' : ''}${q.name}`, X0, y, W, 14, '#ffffff', 17, 2) + 1;
          y = para(c, pl ? pl.desc : '', X0, y, W, 12, C.dim, 15, 2) + 3;
          if (q.paramText) { T(c, fit(c, `数字：${q.paramText}`, W, 12), X0, y, 12, C.gold); y += 15; }
          T(c, fit(c, `費用：${q.cost > 0 ? `年${q.cost}兆円の支出` : q.cost < 0 ? `年${-q.cost}兆円の財源` : '大きな負担なし'}　期限：${q.status === 'fulfilled' ? '実現ずみ' : q.daysLeft > 0 ? `選挙まであと${q.daysLeft}日` : '期限'}`, W, 12), X0, y, 12, q.cost > 3 ? C.warn : C.text); y += 17;
          const vs = has(g, 'pledgeVoices') ? g.pledgeVoices(q.policy) : null;
          if (vs) {
            T(c, `喜ぶ層：${vs.gain.map((s) => s.name).join('・') || '—'}`, X0, y, 12, C.good); y += 14;
            T(c, `不満の層：${vs.lose.map((s) => s.name).join('・') || '—'}`, X0, y, 12, '#ff9aa4'); y += 16;
            if (vs.pro[0]) y = para(c, `賛成「${vs.pro[0].text}」`, X0, y, W, 12, C.text, 14, 2) + 1;
            if (vs.con[0]) y = para(c, `反対「${vs.con[0].text}」`, X0, y, W, 12, C.text, 14, 2) + 1;
          }
          if (q.why) T(c, fit(c, q.why, W, 12), X0, Math.min(y + 2, r.y + r.h - 32), 12, C.bad);
          para(c, 'A：法案にする・重点・修正・撤回など', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
        }
      } else if (row.kind === 'me' || row.kind === 'cab' || row.kind === 'party' || row.kind === 'fstance') {
        const s = row.s;
        const sb = d.sb;
        card(c, r.x, r.y, r.w, r.h, row.label, { right: s.label, rightColor: C.gold, rightW: 90 });
        let y = r.y + 24;
        T(c, fit(c, s.long, W, 14), X0, y, 14, '#ffffff'); y += 20;
        stanceBars(c, X0, y, W, s.vec); y += 60;
        const eff = row.kind === 'me' ? sb.myEffect : row.kind === 'cab' ? sb.cabEffect : g.stanceEffectOf(s.vec);
        for (const l of (eff.lines || []).slice(0, 3)) { if (y > r.y + r.h - 70) break; y = para(c, `・${l}`, X0, y, W, 12, C.text, 14, 2); }
        const vo = has(g, 'stanceVoices') ? g.stanceVoices(s.key) : null;
        if (vo && y < r.y + r.h - 50) {
          y += 2;
          y = para(c, `賛成「${vo.pro[0]}」`, X0, y, W, 12, C.good, 14, 2) + 1;
          if (y < r.y + r.h - 28) y = para(c, `反対「${vo.con[0]}」`, X0, y, W, 12, '#ff9aa4', 14, 2);
        }
        if (row.kind === 'me') para(c, 'A：外交スタンスを表明する（変えると20日は変えられない）', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
        else if (sb.remote) T(c, '※ 世界情勢のしくみの値を使用', X0, r.y + r.h - 16, 12, C.faint);
      } else if (row.kind === 'post') {
        const p = row.p;
        card(c, r.x, r.y, r.w, r.h, p.label);
        let y = r.y + 24;
        T(c, fit(c, `いま：${p.whoName}${p.faction ? `（${p.faction}）` : ''}`, W, 14), X0, y, 14, p.player ? C.gold : '#ffffff'); y += 22;
        y = para(c, { kanjicho: '幹事長：党の運営・選挙・お金を取りしきる要の役職。「党の2番目」と言われ、たいてい派閥の力関係で決まる。', seichokai: '政調会長：党の政策をまとめる。法案の事前審査の要。', somukai: '総務会長：党の意思決定機関「総務会」を仕切る。', sentai: '選対委員長：選挙の候補者選びと戦略を担う。', kokutai: '国対委員長：国会の日程や法案の扱いを他党と交渉する。' }[p.post] || '', X0, y, W, 12, C.dim, 16, 4) + 6;
        if (p.claims.length) { T(c, '要求している派閥', X0, y, 12, C.warn); y += 15; for (const q of p.claims) { T(c, fit(c, `・${q.name}（あと${Math.max(0, q.until - K.today(g))}日で不満が爆発）`, W, 12), X0, y, 12, C.text); y += 14; } y += 4; }
        else { T(c, '要求している派閥はない', X0, y, 12, C.dim); y += 18; }
        y = para(c, '役員人事は取引。与えた派閥は喜び、外れた派閥は不満を持つ。約束したポストを守らないと、信用を失う。', X0, y, W, 12, C.text, 15, 3);
        para(c, d.ov.role === 'leader' ? 'A：このポストの人事を考える' : '党首だけが決められる', X0, r.y + r.h - 16, W, 12, d.ov.role === 'leader' ? C.gold : C.dim, 14, 1);
      } else if (row.kind === 'admin') {
        card(c, r.x, r.y, r.w, r.h, '党の運営');
        para(c, '派閥・グループに入る／抜ける、党首選への立候補、議員への入党の呼びかけ、党の資金を政治資金に移す。役員人事もここから。', X0, r.y + 26, W, 12, C.text, 16, 6);
        para(c, 'A：開く', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (row.kind === 'deal') {
        card(c, r.x, r.y, r.w, r.h, '果たすべき約束');
        para(c, `${row.d.faction}に「${row.d.post}」で報いると約束した。あと${row.d.left}日で果たさなければ、機嫌が大きく下がり、恨みが残る。`, X0, r.y + 26, W, 12, C.text, 16, 6);
      } else if (row.kind === 'event') {
        const e = row.e;
        card(c, r.x, r.y, r.w, r.h, e.title, { accent: C.warn });
        let y = para(c, e.text, X0, r.y + 26, W, 12, C.text, 16, 8) + 6;
        for (const ch of e.choices.slice(0, 4)) { if (y > r.y + r.h - 34) break; T(c, fit(c, `・${ch.label}${ch.odds != null ? `（${Math.round(ch.odds * 100)}%）` : ''}`, W, 12), X0, y, 12, C.dim); y += 14; }
        para(c, `A：決断する（あと${e.left}日）`, X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (row.kind === 'log') {
        card(c, r.x, r.y, r.w, r.h, '党内の出来事');
        let y = r.y + 26;
        for (const l of ov.log) { if (y > r.y + r.h - 30) break; y = para(c, `・${dl(g, l.day)} ${l.text}`, X0, y, W, 12, C.text, 15, 2); }
      } else {
        card(c, r.x, r.y, r.w, r.h, row.label || '党内');
        para(c, row.sub || '', X0, r.y + 26, W, 12, C.dim, 16, 6);
      }
      void tab; void ui;
    }
    // ---- actions
    async function act(ui, row, d) {
      const ov = d.ov;
      if (row.kind === 'faction') {
        const f = row.f;
        const kinds = f.mine ? FACTION_MOVES.mine : FACTION_MOVES.other;
        if (ov.role === 'none') { await ui.alert(f.name, ['あなたはこの党の議員ではない。', '党に入って国会議員になると、派閥の中で動ける。']); return; }
        await moveFlow(ui, { faction: f.id }, kinds, `${f.name}に動く`);
      } else if (row.kind === 'switch') {
        const parties = ov.parties;
        const i = await ui.menu({ title: '党を選ぶ', listTitle: '派閥・グループのある党', listW: 292, rowH: 30, items: parties.map((q) => ({ label: q.name, color: q.color, right: q.id === ov.party ? '表示中' : '' })), tip: () => '他の党の勢力図・公約も見られる（動けるのは自分の党だけ）' });
        if (i >= 0) { st.pid = parties[i].id; for (const k of Object.keys(lbs)) delete lbs[k]; load(ui, true); }
      } else if (row.kind === 'self') {
        await moveFlow(ui, {}, ['found', 'plot_start'], '自分で動く');
      } else if (row.kind === 'rival') {
        const q = row.r;
        const kinds = ['expose'];
        if (ov.plot && !ov.plot.mine && !ov.plot.playerBoss) kinds.push('plot_join', 'plot_oppose');
        const i = await ui.menu({ title: q.name, listTitle: '人物', listW: 292, rowH: 34, items: [{ label: '人物像（くわしく）', sub: 'プロフィールと外交スタンス' }, { label: '動く（暴露・同調など）', sub: '弱みを突く／倒閣に同調する' }, { label: 'もどる' }], detail: (c, it, r, k) => { card(c, r.x, r.y, r.w, r.h, q.name); para(c, ['年齢・当選回数・人望・外交スタンスを見る。', '暴露は成否に大きな代償がある。相手の弱みが「政策の一貫性」か「疑惑」かは、政党による。', ''][k] || '', r.x + 10, r.y + 26, r.w - 20, 12, C.dim, 16, 6); } });
        if (i === 0) await SECTIONS.person(ui, { id: q.id });
        else if (i === 1) await moveFlow(ui, { rival: q.id, faction: q.factionId }, kinds, `${q.name}に動く`);
      } else if (row.kind === 'plot') {
        await plotMenu(ui, row.p, d);
      } else if (row.kind === 'conflict') {
        await conflictFlow(ui, row.c);
      } else if (row.kind === 'pledge') {
        await pledgeMenu(ui, row.q, d);
      } else if (row.kind === 'add') {
        await addPledges(ui, d);
      } else if (row.kind === 'me') {
        const pre = g.stancePresets();
        const sb = d.sb;
        const i = await ui.menu({
          title: '外交スタンスを表明する', listTitle: `いま：${sb.me.label}`, listW: 292, rowH: 34, items: pre.map((x) => ({ label: x.name, sub: x.desc.slice(0, 22) })),
          detail: (c, it, r, k) => { card(c, r.x, r.y, r.w, r.h, pre[k].name); let y = para(c, pre[k].desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 4) + 6; const vo = g.stanceVoices(pre[k].id); y = para(c, `賛成「${vo.pro[0]}」`, r.x + 10, y, r.w - 20, 12, C.good, 15, 3) + 2; para(c, `反対「${vo.con[0]}」`, r.x + 10, y, r.w - 20, 12, '#ff9aa4', 15, 3); },
          tip: () => '一致するスタンスの派閥は喜び、離れた派閥は不満を持つ。相手国との関係や世論にも影響する',
        });
        if (i < 0) return;
        const k = await ui.confirm({ title: pre[i].name, w: 450, text: `${pre[i].desc}\n外交スタンスを変えたあと、20日は変えられない。`, choices: ['表明する', 'やめる'], index: 0, cancel: 1 });
        if (k !== 0) return;
        const r = g.setMyStance(pre[i].id);
        sfx(r.ok ? 'good' : 'buzz');
        await ui.alert('外交スタンス', r.ok ? String(r.text).split('\n') : r.why);
      } else if (row.kind === 'fstance') {
        const f = d.ov.factions.find((x) => x.id === row.f.id);
        if (f) await moveFlow(ui, { faction: f.id }, f.mine ? FACTION_MOVES.mine : FACTION_MOVES.other, `${f.name}に動く`);
      } else if (row.kind === 'post') {
        await postMenu(ui, row.p, d);
      } else if (row.kind === 'event') {
        const res = await eventFlow(ui, row.e, d);
        if (res && res.openConflict) { st.tab = TABS.findIndex((t) => t.id === 'conflict'); const L = lbFor(ui); const cid = res.openConflict.conflict; const rows = tabRows(ui); const k = rows.findIndex((r) => r.c && r.c.id === cid); if (k >= 0) L.idx = k; }
      } else if (row.kind === 'admin') {
        await K.openSection(ui, 'partyAdmin');
      } else if (row.kind === 'log' || row.kind === 'none' || row.kind === 'calm' || row.kind === 'summary' || row.kind === 'cab' || row.kind === 'party' || row.kind === 'deal') {
        ui.toast('見るだけの項目', C.dim);
      }
    }
    async function plotMenu(ui, pl, d) {
      const ov = d.ov;
      const items = [];
      if (pl.mine) {
        items.push({ id: 'rally', label: '自分の派閥を結集する', sub: '擁護派の数を固める' });
        items.push({ id: 'placate', label: '首謀者の派閥を懐柔する', sub: '機嫌をとる・ポストを約束する' });
        items.push({ id: 'reward', label: '人事で報いる（ポストを与える）', sub: '首謀者の派閥を取り込む' });
        items.push({ id: 'poach', label: '倒閣派の派閥を切り崩す', sub: '議員を引き寄せる' });
        items.push({ id: 'punish', label: '人事で報復する', sub: '見せしめ。恨みが残る' });
        items.push({ id: 'expose', label: '首謀者の弱みを突く（暴露）', sub: '成否に大きな代償' });
        if (ov.isPMParty) items.push({ id: 'dissolve', label: '衆議院を解散して封じる', sub: '総選挙で信を問う（動きは止まる）', danger: true });
      } else if (pl.playerBoss) {
        items.push({ id: 'rally', label: '自分の派閥を結集する', sub: '倒閣派の数を固める' });
        items.push({ id: 'placate', label: '同調しそうな派閥を口説く', sub: '機嫌をとる・ポストを約束する' });
        items.push({ id: 'poach', label: '擁護派の派閥を切り崩す', sub: '議員を引き寄せる' });
        items.push({ id: 'expose', label: '党首側の人物の弱みを突く', sub: '成否に大きな代償' });
      } else {
        items.push({ id: 'plot_join', label: '倒閣派に同調する', sub: '勝てば恩を売れる／負ければ冷遇' });
        items.push({ id: 'plot_oppose', label: '党首（総理）を支える', sub: '勝てば信頼を得る／負ければ疎まれる' });
      }
      items.push({ id: 'back', label: 'もどる' });
      const i = await ui.menu({ title: '倒閣運動への対策', listTitle: `成功の見込み ${Math.round(pl.odds)}%`, listW: 300, rowH: 34, items: items.map((it) => ({ label: it.label, sub: it.sub, labelColor: it.danger ? '#ffb0b8' : undefined })), detail: (c, it, r, k) => { card(c, r.x, r.y, r.w, r.h, '現状'); let y = r.y + 26; T(c, `倒閣派 ${pl.S}人　擁護派 ${pl.L}人`, r.x + 10, y, 12, C.text); y += 16; bar2(c, r.x + 10, y, r.w - 20, pl.S, pl.L); y += 20; for (const rs of pl.reasons.slice(0, 5)) { T(c, fit(c, `${rs.v >= 0 ? '＋' : '−'} ${rs.label}`, r.w - 20, 12), r.x + 10, y, 12, rs.v >= 0 ? '#ff9aa4' : '#8ab4ff'); y += 14; } }, tip: () => '結集・懐柔・切り崩し・人事で数が動く。決着の日までに間に合わせよう' });
      if (i < 0) return;
      const it = items[i];
      if (it.id === 'back') return;
      if (it.id === 'dissolve') {
        const k = await ui.confirm({ title: '衆議院を解散する', danger: true, w: 470, text: '解散すれば倒閣の動きは止まるが、総選挙になる。\n議席を減らせば、かえって党内の責任論が強まる。', choices: ['やめておく', '解散する'], index: 0, cancel: 0 });
        if (k !== 1) return;
        const id = g.dissolve('党内の倒閣運動を封じるため');
        await ui.alert('解散', id ? '衆議院を解散した。総選挙だ。' : g.lastPoliticsError || '解散できなかった');
        return;
      }
      if (it.id === 'plot_join' || it.id === 'plot_oppose') { await moveFlow(ui, {}, [it.id], it.label); return; }
      // choose the faction to act on
      const rows = ov.factions;
      let cand = rows;
      if (it.id === 'rally') cand = rows.filter((r) => r.mine || r.mood > 8);
      else if (it.id === 'placate' || it.id === 'reward' || it.id === 'punish') cand = pl.mine ? rows.filter((r) => pl.bloc.includes(r.id) || r.id === pl.bossFaction) : rows.filter((r) => !r.mine);
      else if (it.id === 'poach') cand = rows.filter((r) => !r.mine && (pl.mine ? pl.bloc.includes(r.id) : !pl.bloc.includes(r.id)));
      if (it.id === 'expose') {
        const boss = ov.rivals.find((r) => r.id === pl.boss) || ov.rivals[0];
        if (boss) await moveFlow(ui, { rival: boss.id, faction: boss.factionId }, ['expose'], `${boss.name}に動く`);
        return;
      }
      if (!cand.length) { await ui.alert(it.label, 'その対象になる派閥がない。'); return; }
      const j = await ui.menu({ title: it.label, listTitle: '対象の派閥', listW: 292, rowH: 34, items: cand.map((r) => ({ label: r.name, sub: `${r.size}人・機嫌 ${r.moodWord}`, right: r.mine ? '所属' : '', color: moodCol(r.mood) })), tip: () => '機嫌の悪い派閥ほど、倒閣に傾きやすい' });
      if (j < 0) return;
      await moveFlow(ui, { faction: cand[j].id }, [it.id], `${cand[j].name}に動く`);
    }
    async function postMenu(ui, p, d) {
      const ov = d.ov;
      if (ov.role !== 'leader') { await ui.alert(p.label, [`いまは${p.whoName}が務めている。`, '党役員を決めるのは党首だ。党内の評価を高めると、打診が来ることもある。']); return; }
      const pt = polOf(g).parties[ov.party];
      const items = [{ id: 'player', label: `${K.playerName(g)}（自分で兼ねる）`, sub: '自分が就く' }];
      for (const f of ov.factions) items.push({ id: 'f:' + f.id, label: f.name, sub: `${f.size}人・機嫌 ${f.moodWord}${f.demand && f.demand.post === p.post ? '・このポストを要求中' : ''}`, color: moodCol(f.mood), f });
      const i = await ui.menu({ title: `${p.label}をだれに？`, listTitle: '派閥から選ぶ', listW: 300, rowH: 34, items: items.map((it) => ({ label: it.label, sub: it.sub, color: it.color })), detail: (c, it, r, k) => { card(c, r.x, r.y, r.w, r.h, '人事の効果'); const x = items[k]; let y = r.y + 26; if (x.f) { y = para(c, `${x.f.name}の機嫌 +14。いま${p.faction || '別の派閥'}が持っているなら、そちらは −8。ほかの派閥は −1。`, r.x + 10, y, r.w - 20, 12, C.text, 16, 4) + 4; y = para(c, `${x.f.name}の外交スタンス：${x.f.stance ? x.f.stance.long : '—'}`, r.x + 10, y, r.w - 20, 12, C.cyan, 15, 2); } else para(c, '自分で兼ねると、他の派閥の取り分が減らないので角は立たないが、手が回らず評価も上がらない。', r.x + 10, y, r.w - 20, 12, C.dim, 16, 4); } });
      if (i < 0) return;
      const it = items[i];
      if (it.id === 'player') { const w = g.appointPartyPost(p.post, 'player'); await ui.alert(p.label, w || '自分で兼ねることにした。'); return; }
      const r = g.intraAct('reward', { faction: it.f.id }, { post: p.post });
      if (!r.ok) { sfx('buzz'); await ui.alert(p.label, r.why); return; }
      sfx('good'); await ui.alert(p.label, String(r.text).split('\n'));
      void pt;
    }
    return v;
  }

  // ---------------------------------------------------------------- person page
  function personView(g, id) {
    const pr = g.politicianProfile(id);
    const v = {
      title: pr ? `${pr.name}（${pr.partyShort}）` : '議員', hint: 'B:もどる', tip: () => '議員の人柄・立場・外交スタンス',
      update(ui, inp) { if (inp.pressed('b') || inp.pressed('a') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); } },
      draw(c) {
        card(c, 6, 30, SW - 12, SH - 55, pr ? pr.name : '');
        if (!pr) return;
        R(c, 16, 54, 60, 60, '#0c1230');
        if (pr.look) drawFaceHD(c, pr.look, 18, 56, 1.8);
        T(c, fit(c, `${pr.partyName}${pr.faction ? `・${pr.faction}` : ''}`, 300, 14), 88, 54, 14, '#ffffff');
        T(c, `${pr.age}歳・当選${pr.wins}回・${pr.house === 'sangi' ? '参議院' : '衆議院'}`, 88, 74, 12, C.dim);
        T(c, fit(c, pr.roles.length ? pr.roles.join('・') : '役職なし', 330, 12), 88, 92, 12, C.gold);
        let y = 122;
        const bar = (label, v2, col) => { T(c, label, 20, y, 12, C.dim); hbar(c, 100, y + 3, 150, 8, v2 / 100, col); T(c, String(Math.round(v2)), 258, y, 12, C.text); y += 17; };
        bar('人望', pr.charisma, C.cyan); bar('清廉さ', pr.integrity, C.good); bar('野心', pr.ambition, '#ff9a5a');
        if (pr.mood != null) { T(c, `派閥の機嫌 ${sgn(pr.mood)}　意図：${pr.intent || '—'}　あなたへの恨み ${pr.grudge}`, 20, y, 12, C.text); y += 17; }
        if (pr.persona) { T(c, fit(c, `人柄：${pr.persona.name}（${pr.persona.desc}）`, 300, 12), 20, y, 12, C.cyan); y += 17; }
        if (pr.ideology) { T(c, fit(c, `思想の近さ：${pr.ideology.label}`, 300, 12), 20, y, 12, C.text); y += 17; }
        if (pr.stance) {
          const x0 = 340;
          T(c, `外交スタンス：${pr.stance.long}`, x0, 122, 14, C.gold);
          stanceBars(c, x0, 148, 280, pr.stance.vec);
          const vo = g.stanceVoices(pr.stance.key);
          let yy = 214;
          yy = para(c, `賛成「${vo.pro[0]}」`, x0, yy, 280, 12, C.good, 15, 3) + 2;
          para(c, `反対「${vo.con[0]}」`, x0, yy, 280, 12, '#ff9aa4', 15, 3);
        }
        para(c, '※ 登場する人物と派閥は、すべて架空のものです。', 20, SH - 52, SW - 40, 12, C.faint, 14, 1);
      },
    };
    return v;
  }

  SECTIONS.party = async (ui, o = {}) => {
    const g = ui.g;
    if (!has(g, 'intra')) { await ui.alert('党内', '党内のしくみが読み込まれていない。'); return; }
    const pt = polOf(g).parties[polOf(g).me.party];
    if (!pt && !o.party) {
      const k = await ui.confirm({ title: '党内', text: 'どの政党にも入っていない（無所属）。\n政党に入ると、派閥や党内の駆け引きに加われる。他の党の勢力図は見られる。', choices: ['他の党の勢力図を見る', '政党の一覧へ', 'もどる'], cancel: 2 });
      if (k === 1) { await K.openSection(ui, 'parties'); return; }
      if (k !== 0) return;
    }
    await ui.open(hubView(g, o));
  };
  SECTIONS.intra = SECTIONS.party;
  SECTIONS.conflicts = (ui, o = {}) => SECTIONS.party(ui, { ...o, tab: 'conflict' });
  SECTIONS.manifesto = (ui, o = {}) => SECTIONS.party(ui, { ...o, tab: 'pledge' });
  SECTIONS.stance = (ui, o = {}) => SECTIONS.party(ui, { ...o, tab: 'stance' });
  SECTIONS.person = async (ui, o = {}) => { if (has(ui.g, 'politicianProfile') && o.id) await ui.open(personView(ui.g, o.id)); };
  K.intraAlerts = (g) => {
    // lines for the dashboard: [{ text, color, run }]
    const out = [];
    if (!has(g, 'intraEvents')) return out;
    try {
      const evs = g.intraEvents();
      if (evs.length) out.push({ text: `党内で決断を迫られている：${evs[0].title}（あと${evs[0].left}日）`, color: C.warn, run: (ui) => SECTIONS.party(ui, { tab: 'decide' }) });
      const plot = g.intraPlot();
      if (plot && (plot.mine || plot.playerBoss)) out.push({ text: `倒閣の動き：${plot.bossName}氏ら（${plot.stageLabel}・見込み${Math.round(plot.odds)}%・あと${plot.daysLeft}日）`, color: C.bad, run: (ui) => SECTIONS.party(ui, { tab: 'rival' }) });
      const hot = g.conflicts({ live: true, mine: true }).filter((c) => c.level >= 2);
      if (hot.length) out.push({ text: `党内の紛争が深刻：${hot[0].title}（${hot[0].levelName}）`, color: C.bad, run: (ui) => SECTIONS.party(ui, { tab: 'conflict', select: hot[0].id }) });
    } catch (e) { console.error(e); }
    return out;
  };
}
