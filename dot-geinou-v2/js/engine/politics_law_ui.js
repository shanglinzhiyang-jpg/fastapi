// The bill-drafting studio (法案づくり), the tactics for a bill already before the Diet, and the legislation record (立法の記録・私の法律)
// — agent R5-D. Registered by politics_ui.js (registerLawUI(K, SECTIONS)). Only calls the g.* API of politics_law.js
// (g.billOutlook, g.billPlanOptions, g.proposeBillPlanned, g.billTactics, g.billTactic, g.legislationHistory) and politics.js.
//
// The studio shows, for the chosen policy and numbers: the cost / revenue (in 消費税 points), who gains and loses, the coalition math
// for passage (each party's yes share, the two houses, the 衆院 re-vote, つるし, 与党事前審査), the timetable against the session,
// and the tactics (国会対策・修正協議・付帯決議・委員会の進め方・事前審査の根回し) each with the change they make to the chance to pass.
// SECTIONS.lawbook = the record. K.studio(ui, policyId, params) is called by the policy browser when the player confirms the numbers.

export function registerLawUI(K, SECTIONS) {
  const { C, R, T, fit, para, card, frame, pill, hbar, cbar, ListBox, sfx, SW, SH, clamp, shade } = K;
  const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  const has = (g, k) => typeof g[k] === 'function';
  const polOf = (g) => g.pol();
  const passCol = (p) => (p >= 70 ? C.good : p >= 40 ? C.gold : C.bad);
  const gainTag = (gv) => (gv == null ? null : Math.abs(gv) < 1 ? { text: '±0', color: '#3a4066' } : gv > 0 ? { text: `+${Math.round(gv)}`, color: '#2a7a4a' } : { text: `${Math.round(gv)}`, color: '#8a2a34' });
  const dl = (g, day) => K.dateLabel(g, day).replace(/^\d+年/, '');

  function drawSummary(c, O, y0, plan, label) {
    card(c, 6, y0, SW - 12, 44, null);
    T(c, fit(c, O.title, 360, 14), 14, y0 + 4, 14, '#ffffff');
    T(c, fit(c, `${O.sponsorName}・${O.firstName}から・${O.areaName}${O.kind === 'amendment' ? '・憲法改正' : ''}`, 360, 12), 14, y0 + 23, 12, C.dim);
    T(c, '可決の見込み', 392, y0 + 4, 12, C.dim);
    T(c, `${O.passAll}%`, 392, y0 + 18, 20, passCol(O.passAll));
    hbar(c, 470, y0 + 8, 72, 8, O.passAll / 100, passCol(O.passAll));
    T(c, fit(c, O.fiscal.kind === 'none' ? '財政：負担小' : O.fiscal.kind === 'spend' ? `年${Math.round(O.fiscal.cost * 10) / 10}兆円の支出` : `年${Math.round(-O.fiscal.cost * 10) / 10}兆円の財源`, 90, 12), 452, y0 + 24, 12, O.fiscal.kind === 'spend' ? C.warn : O.fiscal.kind === 'revenue' ? C.good : C.dim);
    T(c, `日程 約${O.timetable.days}日`, 548, y0 + 8, 12, C.text);
    T(c, label || '', 548, y0 + 24, 12, C.cyan);
  }

  // ---------------------------------------------------------------- the studio
  function studioView(g, polId, params0) {
    const pl = K.POLICIES[polId];
    const S = { params: { ...(params0 || pl.defaults) }, plan: { amend: null, kokutai: {}, futai: false, strategy: 'normal', prelobby: 0 }, key: '', O: null, TAC: null, tkey: '' };
    const refresh = (needTac) => {
      const key = JSON.stringify([S.params, S.plan]);
      if (key !== S.key) { S.key = key; S.O = g.billOutlook(polId, S.params, S.plan); S.tkey = ''; }
      if (needTac && S.tkey !== key) { S.tkey = key; S.TAC = g.billPlanOptions(polId, S.params, S.plan); }
      return S.O;
    };
    const pages = (O) => {
      const rows = [
        { id: 'sum', label: '概要と財政', sub: O ? O.fiscal.label : '' },
        { id: 'who', label: '得する人・損する人', sub: O ? `全体：${O.net >= 0.5 ? '支持が広がりそう' : O.net <= -0.5 ? '反発が強そう' : '賛否が分かれそう'}` : '' },
        { id: 'vote', label: '採決の見通し（連立の数）', sub: O ? `衆${O.houses[0].pass}%・参${O.houses[1].pass}%` : '', right: O ? `${O.passAll}%` : '', rightColor: O ? passCol(O.passAll) : undefined },
        { id: 'time', label: '日程と審議', sub: O ? (O.timetable.inSession ? `会期末まであと${O.timetable.sessionLeft}日` : O.timetable.wait != null ? `次の国会まで約${O.timetable.wait}日` : '国会は開けない') : '' },
        { id: 'kokutai', label: '国会対策（根回し）', sub: Object.keys(S.plan.kokutai).filter((k) => S.plan.kokutai[k] > 0).map((k) => `${polOf(g).parties[k] ? polOf(g).parties[k].short : k}×${S.plan.kokutai[k]}`).join(' ') || '野党の国対と協議する', tag: gainOf('kokutai'), labelColor: C.cyan },
        { id: 'amend', label: '修正協議', sub: S.plan.amend && polOf(g).parties[S.plan.amend] ? `${polOf(g).parties[S.plan.amend].short}と協議する（効果は弱まる）` : '野党の主張を取り入れて賛成を得る', tag: gainOf('amend'), labelColor: C.cyan },
        { id: 'futai', label: '付帯決議', sub: S.plan.futai ? '付ける方針' : '法的拘束力のない決議を添える', tag: gainOf('futai'), labelColor: C.cyan },
        { id: 'strategy', label: '委員会の進め方', sub: (O && O.strategies.find((s) => s.id === S.plan.strategy) || {}).name || '通常の審議', labelColor: C.cyan },
      ];
      if (O && O.review) rows.push({ id: 'review', label: '与党の事前審査', sub: `通る見込み ${O.review.odds}%`, right: S.plan.prelobby ? `根回し×${S.plan.prelobby}` : '', labelColor: C.cyan });
      if (pl.params) rows.push({ id: 'params', label: '数字を調整する', sub: pl.params.map((d) => `${d.name}${num(S.params[d.key], d.def)}${d.unit}`).join('・') });
      rows.push({ id: 'submit', label: O && O.sponsor === 'cabinet' ? '▶ 閣議決定して国会へ' : '▶ この内容で提出する', sub: O && O.block ? `いまは出せない：${O.block}` : '', labelColor: C.gold, disabled: !!(O && O.block), why: O ? O.block : '' });
      return rows;
    };
    const gainOf = (id) => {
      if (!S.TAC || !S.TAC.tactics) return null;
      const L = S.TAC.tactics.filter((t) => t.id === id && t.gain != null);
      if (!L.length) return null;
      const best = L.reduce((a, t) => (t.gain > a.gain ? t : a), L[0]);
      return gainTag(best.gain);
    };
    const v = {
      title: () => `法案づくり：${pl.name}`, hint: '↑↓:項目 A:開く・決める B:もどる',
      tip: () => '提出する前に、可決の見込み・費用・日程を確かめよう。戦術を選ぶと、見込みがどう変わるか分かる',
      enter(ui) { refresh(true); v.lb = new ListBox({ items: () => { refresh(false); return pages(S.O); }, rowH: 32 }); },
      update(ui, inp) {
        v.lb.move(inp);
        if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.done(v, null); return; }
        if (!inp.pressed('a')) return;
        const it = v.lb.current();
        if (!it) return;
        if (it.disabled) { sfx('buzz'); ui.toast(it.why, C.dim); return; }
        sfx('ok');
        ui.act(async () => {
          const r = await action(ui, it.id);
          if (r === 'submitted') ui.done(v, 'submitted');
          refresh(true);
        });
      },
      draw(c, ui) {
        const O = refresh(false);
        if (!O) { card(c, 6, 30, SW - 12, 60, '法案'); para(c, '見通しを出せなかった。', 16, 56, SW - 32, 12, C.dim); return; }
        drawSummary(c, O, 28, S.plan, O.review ? `事前審査 ${O.review.odds}%` : O.held ? `つるし ${O.held.odds}%` : '');
        card(c, 6, 76, 262, SH - 101, null);
        v.lb.draw(c, 8, 78, 258, SH - 105, true, ui.t);
        const it = v.lb.current();
        const r = { x: 272, y: 76, w: SW - 278, h: SH - 101 };
        try { detail(c, ui, O, it, r); } catch (e) { console.error(e); }
      },
    };
    function detail(c, ui, O, it, r) {
      const X0 = r.x + 10, W = r.w - 20;
      const id = it ? it.id : 'sum';
      if (['kokutai', 'amend', 'futai', 'strategy', 'review'].includes(id) && !S.TAC) refresh(true);
      if (id === 'sum') {
        card(c, r.x, r.y, r.w, r.h, '概要と財政');
        let y = para(c, O.desc, X0, r.y + 24, W, 12, C.dim, 15, 2) + 3;
        T(c, fit(c, `${O.sponsorName}　${O.firstName}が先に審議　${O.ministry ? `担当：${K.postName(O.ministry, K.polDate(g).fy)}` : ''}`, W, 12), X0, y, 12, C.text); y += 15;
        if (O.sponsor === 'member') { T(c, `賛成者 ${O.need}人以上が必要（国会法56条）`, X0, y, 12, C.text); y += 15; }
        y += 2;
        T(c, '財政', X0, y, 12, C.gold); y += 15;
        T(c, fit(c, O.fiscal.label, W, 14), X0, y, 14, O.fiscal.kind === 'spend' ? C.warn : O.fiscal.kind === 'revenue' ? C.good : C.text); y += 19;
        if (O.fiscal.kind !== 'none') {
          T(c, `消費税にして約${O.fiscal.taxEq}ポイント分（予算の約${O.fiscal.ofBudget}%）`, X0, y, 12, C.dim); y += 15;
          T(c, O.fiscal.kind === 'spend' ? `赤字を増やすと、若者・無党派・経営者の評価に響く（いまの赤字 ${O.fiscal.deficitNow}兆円）` : '財源になるが、負担が増える層の反発がある', X0, y, 12, C.dim); y += 17;
        }
        if (O.eco.length) { T(c, '経済への影響（成立後、数年かけて）', X0, y, 12, C.gold); y += 15; T(c, fit(c, O.eco.map((e) => `${e.name}${e.v > 0 ? '↑' : '↓'}${Math.abs(e.v)}`).join('　'), W, 12), X0, y, 12, C.cyan); y += 17; }
        if (O.block) para(c, `× ${O.block}`, X0, Math.min(y, r.y + r.h - 32), W, 12, C.bad, 15, 2);
      } else if (id === 'who') {
        card(c, r.x, r.y, r.w, r.h, '得する人・損する人', { right: `全体 ${O.net >= 0 ? '+' : ''}${O.net}`, rightColor: O.net >= 0.5 ? C.good : O.net <= -0.5 ? C.bad : C.dim, rightW: 80 });
        const rowH = 15;
        O.segs.forEach((s, i) => {
          const yy = r.y + 24 + i * rowH;
          T(c, fit(c, s.name, 80, 12), X0, yy, 12, C.text);
          cbar(c, X0 + 84, yy + 3, W - 150, 8, s.v / 8, C.good, C.bad);
          T(c, `${s.v > 0 ? '+' : ''}${s.v}`, X0 + W - 60, yy, 12, s.v > 0 ? C.good : s.v < 0 ? C.bad : C.dim, 'right');
          T(c, `${s.w}%`, X0 + W, yy, 10, C.faint, 'right');
        });
        const vs = has(g, 'pledgeVoices') ? g.pledgeVoices(polId) : null;
        let y = r.y + 24 + O.segs.length * rowH + 4;
        if (vs && vs.pro[0] && y < r.y + r.h - 30) y = para(c, `賛成「${vs.pro[0].text}」`, X0, y, W, 12, C.good, 14, 2) + 1;
        if (vs && vs.con[0] && y < r.y + r.h - 16) para(c, `反対「${vs.con[0].text}」`, X0, y, W, 12, '#ff9aa4', 14, 2);
      } else if (id === 'vote') {
        card(c, r.x, r.y, r.w, r.h, '採決の見通し', { right: `可決 ${O.passAll}%`, rightColor: passCol(O.passAll), rightW: 90 });
        let y = r.y + 22;
        T(c, '党', X0, y, 10, C.faint); T(c, '議席', X0 + 108, y, 10, C.faint, 'right'); T(c, '賛成の見込み', X0 + 120, y, 10, C.faint); y += 12;
        for (const q of O.parties.slice(0, 7)) {
          R(c, X0, y + 2, 4, 10, q.color);
          T(c, fit(c, q.short + (q.ruling ? '（与）' : ''), 90, 12), X0 + 8, y, 12, q.ruling ? '#ffffff' : C.text);
          T(c, String(q.seats), X0 + 108, y, 12, C.dim, 'right');
          hbar(c, X0 + 120, y + 3, W - 180, 8, q.yes / 100, q.yes >= 70 ? C.good : q.yes >= 35 ? C.gold : C.bad);
          T(c, `${q.stance}${q.lobby ? '↑' : ''}`, X0 + W, y, 12, q.yes >= 70 ? C.good : q.yes >= 35 ? C.gold : C.bad, 'right');
          y += 14;
        }
        y += 4;
        for (const h of O.houses) {
          T(c, `${h.name}：賛成 約${h.yes}（${h.lo}〜${h.hi}）／過半数 ${h.need}`, X0, y, 12, C.text);
          T(c, `${h.pass}%`, X0 + W, y, 12, passCol(h.pass), 'right'); y += 14;
        }
        if (O.sim.override > 0 || O.houses[1].pass < 60) { T(c, fit(c, `参院で否決→衆院の3分の2で再可決：見込み ${O.sim.override}%`, W, 12), X0, y, 12, C.dim); y += 14; }
        if (O.review) { T(c, fit(c, `与党の事前審査（部会→政調→総務会）に通る見込み ${O.review.odds}%`, W, 12), X0, y, 12, O.review.odds >= 50 ? C.good : C.warn); y += 14; }
        if (O.held) { T(c, fit(c, `与党が委員会で棚上げ（つるし）にする見込み ${O.held.odds}%`, W, 12), X0, y, 12, C.warn); y += 14; }
      } else if (id === 'time') {
        card(c, r.x, r.y, r.w, r.h, '日程と審議');
        const t = O.timetable;
        let y = r.y + 24;
        T(c, fit(c, t.inSession ? `${t.sessionKind}の会期中：会期末まであと${t.sessionLeft}日` : t.wait != null ? `国会は閉会中：次の国会まで約${t.wait}日` : '衆議院が解散中：国会は開けない', W, 12), X0, y, 12, t.inSession ? C.good : C.warn); y += 18;
        const steps = [['提出', O.sponsor === 'member' ? '賛成者集め・事前審査' : '閣議決定'], [`${O.firstName.replace('議院', '')}委員会`, '3〜6日'], ['本会議', '1日'], ['他院の委員会', '3〜6日'], ['本会議→成立', '1日']];
        const sw = Math.floor((W - 8) / steps.length);
        steps.forEach((s, i) => {
          frame(c, X0 + i * (sw + 2), y, sw, 30, '#26346e', C.edge);
          T(c, fit(c, s[0], sw - 4, 10), X0 + i * (sw + 2) + sw / 2, y + 3, 10, '#ffffff', 'center');
          T(c, fit(c, s[1], sw - 4, 10), X0 + i * (sw + 2) + sw / 2, y + 16, 10, C.dim, 'center');
        });
        y += 40;
        T(c, `成立までのめやす：約${t.days}日${t.wait ? `（国会が開くのを待って＋${t.wait}日）` : ''}`, X0, y, 12, C.text); y += 16;
        if (t.fit != null) { T(c, `会期に間に合う見込み ${Math.round(t.fit * 100)}%`, X0, y, 12, t.fit >= 0.7 ? C.good : t.fit >= 0.35 ? C.gold : C.bad); hbar(c, X0 + 170, y + 3, W - 170, 8, t.fit, t.fit >= 0.7 ? C.good : C.gold); y += 16; }
        if (t.slot) { T(c, `審議の枠：${t.slot.used}／${t.slot.cap}（残り${t.slot.left}）`, X0, y, 12, t.slot.left > 0 ? C.text : C.warn); y += 16; }
        y = para(c, '会期中に成立しない法案は廃案になる（継続審議もある）。内閣の法案が先に審議され、議員立法は後回しになりやすい。丁寧な審議は日程を延ばす。', X0, y, W, 12, C.dim, 15, 4);
      } else if (id === 'kokutai' || id === 'amend') {
        card(c, r.x, r.y, r.w, r.h, id === 'kokutai' ? '国会対策（根回し）' : '修正協議');
        let y = para(c, id === 'kokutai' ? '野党の国会対策委員会と協議して、賛成や審議への協力を取りつける。1回ごとに接待・調整費がかかり、3回まで。相手の考えに近いほど効く。' : '案文を野党と協議して数字を譲る。賛成は増えるが、法律の効果は弱まる（1つの法案で1回）。', X0, r.y + 24, W, 12, C.dim, 15, 3) + 4;
        const L = (S.TAC && S.TAC.tactics ? S.TAC.tactics.filter((t) => t.id === id) : []);
        for (const t of L.slice(0, 5)) { T(c, fit(c, `${t.partyName}　${t.cost || ''}`, W - 60, 12), X0, y, 12, C.text); const gt = gainTag(t.gain); if (gt) pill(c, X0 + W - 40, y - 1, gt.text, gt.color, '#fff', 10); y += 16; }
        if (!L.length) T(c, '協議できる野党がない', X0, y, 12, C.dim);
        para(c, 'A：相手を選んで決める', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (id === 'futai') {
        card(c, r.x, r.y, r.w, r.h, '付帯決議');
        const t = S.TAC && S.TAC.tactics ? S.TAC.tactics.find((q) => q.id === 'futai') : null;
        let y = para(c, '「法律の運用にあたっては、○○に十分に配慮すること」という決議を、委員会で添える。法的な拘束力はないが、野党の理解を得る材料になり、政府は尊重して運用する。', X0, r.y + 24, W, 12, C.dim, 15, 4) + 6;
        T(c, S.plan.futai ? '付ける方針（A：取りやめる）' : '付けない（A：付ける方針にする）', X0, y, 12, S.plan.futai ? C.good : C.text); y += 16;
        if (t && t.gain != null) T(c, `可決の見込み：${t.gain >= 0 ? '+' : ''}${Math.round(t.gain)}ポイント`, X0, y, 12, t.gain > 0 ? C.good : C.dim);
      } else if (id === 'strategy') {
        card(c, r.x, r.y, r.w, r.h, '委員会の進め方');
        let y = r.y + 24;
        for (const s of O.strategies) {
          const t = S.TAC && S.TAC.tactics ? S.TAC.tactics.find((q) => q.id === 'strategy' && q.mode === s.id) : null;
          const on = (S.plan.strategy || 'normal') === s.id;
          T(c, `${on ? '● ' : '○ '}${s.name}`, X0, y, 12, on ? C.gold : C.text);
          const gt = t ? gainTag(t.gain) : null;
          if (gt) pill(c, X0 + W - 44, y - 1, gt.text, gt.color, '#fff', 10);
          y += 15; y = para(c, s.desc, X0 + 14, y, W - 14, 12, C.dim, 14, 2) + 3;
        }
        para(c, 'A：進め方を選ぶ', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (id === 'review') {
        card(c, r.x, r.y, r.w, r.h, '与党の事前審査');
        const rv = O.review;
        let y = para(c, '与党の議員が出す法案は、まず党の部会・政務調査会・総務会で了承を得る必要がある（事前審査）。党の方針に近く、党内の評価が高いほど通りやすい。', X0, r.y + 24, W, 12, C.dim, 15, 4) + 4;
        T(c, `通る見込み ${rv.odds}%`, X0, y, 14, rv.odds >= 50 ? C.good : C.warn); hbar(c, X0 + 130, y + 4, W - 130, 8, rv.odds / 100, rv.odds >= 50 ? C.good : C.warn); y += 22;
        T(c, `党の方針との近さ ${rv.al}　党内の評価 ${rv.standing}${rv.post ? '　役職あり' : ''}`, X0, y, 12, C.text); y += 15;
        y = para(c, rv.note, X0, y, W, 12, C.dim, 14, 3) + 3;
        T(c, `部会・政調への根回し：${S.plan.prelobby || 0}／3回（1回ごとに成功率+8%）`, X0, y, 12, C.cyan);
        para(c, 'A：根回しをする（回数を増やす）', X0, r.y + r.h - 16, W, 12, C.gold, 14, 1);
      } else if (id === 'params') {
        card(c, r.x, r.y, r.w, r.h, '数字を調整する');
        let y = r.y + 26;
        for (const d of pl.params) { T(c, d.name, X0, y, 12, C.text); T(c, `${num(S.params[d.key], d.def)}${d.unit}`, X0 + W, y, 14, C.gold, 'right'); y += 20; }
        para(c, '数字が大きいほど効果も費用も大きいが、反発も強くなる。A：調整する', X0, y + 4, W, 12, C.dim, 15, 3);
      } else if (id === 'submit') {
        card(c, r.x, r.y, r.w, r.h, '提出');
        let y = para(c, O.sponsor === 'cabinet' ? '内閣が閣議決定して国会に提出する。与党の賛成が見込める。' : `議員立法として提出する。賛成者${O.need}人以上が必要。党の了承も大切。`, X0, r.y + 26, W, 12, C.text, 16, 3) + 6;
        T(c, `可決の見込み ${O.passAll}%`, X0, y, 16, passCol(O.passAll)); y += 24;
        const plan = [];
        for (const [k, u] of Object.entries(S.plan.kokutai)) if (u > 0 && polOf(g).parties[k]) plan.push(`国会対策：${polOf(g).parties[k].short}×${u}`);
        if (S.plan.amend) plan.push(`修正協議：${polOf(g).parties[S.plan.amend] ? polOf(g).parties[S.plan.amend].short : ''}`);
        if (S.plan.futai) plan.push('付帯決議');
        if (S.plan.strategy && S.plan.strategy !== 'normal') plan.push(`進め方：${(O.strategies.find((s) => s.id === S.plan.strategy) || {}).name}`);
        if (S.plan.prelobby) plan.push(`事前審査の根回し×${S.plan.prelobby}`);
        T(c, '選んだ戦術', X0, y, 12, C.gold); y += 15;
        for (const l of plan.length ? plan : ['なし']) { T(c, fit(c, `・${l}`, W, 12), X0, y, 12, C.text); y += 14; }
        const pc = O.planCost;
        y += 4;
        T(c, `費用：${pc.money ? K.fmtMoney(pc.money) : 'なし'}　体力 ${pc.stamina}`, X0, y, 12, C.dim);
      }
    }
    async function action(ui, id) {
      const O = S.O;
      if (id === 'params') {
        const np = await ui.open(K.paramEditor(g, polId, S.params));
        if (np) S.params = np;
        return null;
      }
      if (id === 'futai') { S.plan.futai = !S.plan.futai; sfx('good'); return null; }
      if (id === 'strategy') {
        const i = await ui.menu({ title: '委員会の進め方', listTitle: '進め方', listW: 300, rowH: 36, items: O.strategies.map((s) => { const t = S.TAC && S.TAC.tactics ? S.TAC.tactics.find((q) => q.id === 'strategy' && q.mode === s.id) : null; return { label: s.name, sub: s.desc.slice(0, 24), tag: t ? gainTag(t.gain) : null, right: (S.plan.strategy || 'normal') === s.id ? '選択中' : '' }; }), detail: (c, it, r, k) => { card(c, r.x, r.y, r.w, r.h, O.strategies[k].name); para(c, O.strategies[k].desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 6); } });
        if (i >= 0) S.plan.strategy = O.strategies[i].id;
        return null;
      }
      if (id === 'review') { S.plan.prelobby = (num(S.plan.prelobby) + 1) % 4; sfx('good'); return null; }
      if (id === 'kokutai' || id === 'amend') {
        refresh(true);
        const L = S.TAC.tactics.filter((t) => t.id === id);
        if (!L.length) { ui.toast('協議できる野党がない', C.dim); return null; }
        const i = await ui.menu({
          title: id === 'kokutai' ? '国会対策：どの党に？' : '修正協議：どの党と？', listTitle: '野党', listW: 300, rowH: 36,
          items: [...L.map((t) => ({ label: t.partyName, sub: id === 'kokutai' ? `いま×${num(S.plan.kokutai[t.party])}・${t.cost}` : (S.plan.amend === t.party ? '協議する方針' : t.cost), tag: gainTag(t.gain), disabled: !!t.why, why: t.why, color: (polOf(g).parties[t.party] || {}).color })), ...(id === 'amend' && S.plan.amend ? [{ label: '協議を取りやめる' }] : []), ...(id === 'kokutai' && Object.values(S.plan.kokutai).some((u) => u > 0) ? [{ label: '根回しをすべて取りやめる' }] : [])],
          detail: (c, it, r, k) => { const t = L[k]; card(c, r.x, r.y, r.w, r.h, t ? t.name : '取りやめ'); if (t) para(c, t.desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 6); },
        });
        if (i < 0) return null;
        if (i < L.length) {
          const t = L[i];
          if (id === 'kokutai') S.plan.kokutai[t.party] = (num(S.plan.kokutai[t.party]) + 1) % 4;
          else S.plan.amend = t.party;
        } else if (id === 'amend') S.plan.amend = null;
        else S.plan.kokutai = {};
        return null;
      }
      if (id === 'submit') {
        const r = await K.submitPolicy(ui, polId, S.params, S.plan);
        return r ? 'submitted' : null;
      }
      return null;
    }
    return v;
  }
  async function studioFlow(ui, polId, params) {
    const g = ui.g;
    if (!has(g, 'billOutlook')) return K.submitPolicy(ui, polId, params, null);
    const r = await ui.open(studioView(g, polId, params));
    return r;
  }
  K.studio = studioFlow;

  // ---------------------------------------------------------------- tactics for a bill already before the Diet
  async function tacticsFlow(ui, bill) {
    const g = ui.g;
    for (let guard = 0; guard < 12; guard++) {
      const T0 = g.billTactics(bill.id);
      if (!T0 || T0.closed) { ui.toast('この法案は、もう決着している', C.dim); return; }
      const O = T0.base;
      const tac = T0.tactics.filter((t) => !t.why);
      const items = T0.tactics.map((t) => ({ label: t.name, sub: t.why || `${t.cost || ''}${t.cost ? '・' : ''}${t.desc.slice(0, 18)}`, tag: gainTag(t.gain), disabled: !!t.why, why: t.why }));
      if (!items.length) { await ui.alert('法案の戦術', 'いま打てる手はない。'); return; }
      const i = await ui.menu({
        title: `戦術：${bill.title}`, listTitle: `可決の見込み ${O ? O.passAll : '?'}%`, listW: 330, rowH: 34, items,
        detail: (c, it, r, k) => {
          const t = T0.tactics[k];
          card(c, r.x, r.y, r.w, r.h, t ? t.name : '戦術');
          if (!t) return;
          let y = para(c, t.desc, r.x + 10, r.y + 26, r.w - 20, 12, C.text, 16, 5) + 6;
          if (t.cost) { T(c, `費用：${t.cost}`, r.x + 10, y, 12, C.dim); y += 16; }
          if (t.gain != null) { T(c, `可決の見込み：${O.passAll}% → ${Math.max(0, Math.min(100, Math.round(O.passAll + t.gain)))}%`, r.x + 10, y, 12, t.gain > 0 ? C.good : t.gain < 0 ? C.bad : C.dim); y += 16; }
          if (t.odds != null) T(c, `通る見込み ${t.odds}%`, r.x + 10, y, 12, C.text);
          if (O) { const pp = O.parties.filter((q) => !q.ruling).slice(0, 4); let yy = r.y + r.h - 56; T(c, '各党の賛成の見込み', r.x + 10, yy, 11, C.faint); yy += 13; pp.forEach((q, j) => { T(c, fit(c, `${q.short} ${q.yes}%`, 70, 11), r.x + 10 + (j % 2) * 150, yy + Math.floor(j / 2) * 13, 11, q.yes >= 60 ? C.good : q.yes >= 30 ? C.gold : C.bad); }); }
        },
        tip: () => '手を打つたびに、体力・お金を使う。見込みの変化を見てから決めよう',
      });
      if (i < 0) return;
      const t = T0.tactics[i];
      if (t.why) { sfx('buzz'); ui.toast(t.why, C.dim); continue; }
      const k = await ui.confirm({ title: t.name, w: 450, text: `${t.desc}\n${t.cost ? `費用：${t.cost}\n` : ''}${t.gain != null ? `可決の見込み：${O.passAll}% → 約${Math.max(0, Math.min(100, Math.round(O.passAll + t.gain)))}%` : ''}`, choices: ['実行する', 'やめる'], index: 0, cancel: 1 });
      if (k !== 0) continue;
      const kind = t.id;
      const r = g.billTactic(bill.id, kind, { party: t.party, mode: t.mode });
      if (!r.ok) { sfx('buzz'); await ui.alert(t.name, r.why); continue; }
      sfx('good');
      await ui.alert(t.name, [...String(r.text).split('\n'), r.before != null ? `可決の見込み：${r.before}% → ${r.after}%` : ''].filter(Boolean));
    }
    void tac;
  }
  K.billTactics = tacticsFlow;

  // ---------------------------------------------------------------- the legislation record
  function lawbookView(g) {
    let H = null, HT = -99;
    const load = (ui) => { if (!H || ui.t - HT > 30) { H = g.legislationHistory(); HT = ui.t; } return H; };
    const tabs = [{ id: 'mine', label: '私の法案' }, { id: 'laws', label: '私の法律' }, { id: 'all', label: '施行中の法律' }];
    const st = { tab: 0 };
    const lbs = {};
    const rowsOf = (ui) => {
      const h = load(ui);
      if (!h) return [];
      const id = tabs[st.tab].id;
      if (id === 'mine') return h.mine.map((m) => ({ m, label: m.name, sub: `${m.sponsor === 'cabinet' ? '閣法' : '議員立法'}${m.date ? `・${m.date.replace(/^\d+年/, '')}` : ''}`, right: m.outcomeName, rightColor: m.outcome === 'enacted' ? C.good : m.outcome === 'pending' ? C.cyan : C.bad, color: m.outcome === 'enacted' ? C.good : m.outcome === 'pending' ? C.cyan : C.bad }));
      if (id === 'laws') return h.mineLaws.map((l) => ({ l, label: l.title, sub: `${l.date}・${l.sponsor}`, right: l.cost ? `年${l.cost > 0 ? '' : '+'}${Math.abs(l.cost)}兆円` : '', color: C.gold }));
      return h.laws.map((l) => ({ l, label: l.title, sub: `${l.date}・${l.byMe ? 'あなた' : l.partyName || l.sponsor}`, right: l.areaName, color: l.byMe ? C.gold : C.dim, labelColor: l.byMe ? C.gold : undefined }));
    };
    const lbFor = (ui) => { const id = tabs[st.tab].id; if (!lbs[id]) lbs[id] = new ListBox({ items: () => rowsOf(ui), rowH: 34, empty: id === 'mine' ? 'まだ法案を出していない' : id === 'laws' ? 'まだ自分の法律はない' : 'まだ法律はない' }); return lbs[id]; };
    const v = {
      bigtextList: (ui) => lbFor(ui), // [R13-F] the portrait lower screen (bigtext_polui.js)
      bigtextTabs: () => ({ items: tabs.map((t) => t.label), index: st.tab, onPick: (i) => { st.tab = i; }, skip: { x: 6, y: 70, w: SW - 12, h: 22 } }),
      title: '立法の記録', hint: '←→:タブ ↑↓:えらぶ B:もどる', tip: () => '出した法案の結果と、成立した法律の記録',
      update(ui, inp) {
        if (inp.pressed('b') || inp.pressed('menu') || inp.pressed('a') && false) { sfx('cancel'); ui.done(v, null); return; }
        if (inp.repeat('left')) { st.tab = (st.tab + tabs.length - 1) % tabs.length; sfx('cursor'); }
        if (inp.repeat('right')) { st.tab = (st.tab + 1) % tabs.length; sfx('cursor'); }
        lbFor(ui).move(inp);
      },
      draw(c, ui) {
        const h = load(ui);
        if (!h) return;
        const s = h.stats;
        card(c, 6, 28, SW - 12, 40, null);
        T(c, `提出 ${s.proposed}件　成立 ${s.enacted}　否決 ${s.rejected}　廃案・見送り ${s.shelved}　審議中 ${s.pending}`, 16, 33, 14, '#ffffff');
        T(c, `成立率 ${s.rate}%　　施行中の法律 ${s.lawsInForce}本（うち閣法 ${s.cabinetLaws}）`, 16, 51, 12, C.dim);
        const tw = Math.floor((SW - 12) / tabs.length);
        tabs.forEach((t, i) => { const on = i === st.tab; R(c, 6 + i * tw, 72, tw - 2, 18, on ? C.sel : '#10173a'); R(c, 6 + i * tw, 72, tw - 2, 1, on ? C.gold : C.edge); T(c, t.label, 6 + i * tw + (tw - 2) / 2, 74, 12, on ? '#ffffff' : C.dim, 'center'); });
        card(c, 6, 92, 300, SH - 117, null);
        const L = lbFor(ui);
        L.draw(c, 8, 94, 296, SH - 121, true, ui.t);
        const row = L.current();
        const r = { x: 310, y: 92, w: SW - 316, h: SH - 117 };
        card(c, r.x, r.y, r.w, r.h, row ? (row.m ? row.m.name : row.l.title) : '');
        if (!row) return;
        const X0 = r.x + 10, W = r.w - 20;
        let y = r.y + 26;
        if (row.m) {
          const m = row.m;
          y = para(c, m.title, X0, y, W, 12, C.text, 15, 2) + 2;
          T(c, `結果：${m.outcomeName}${m.result && m.outcome !== 'enacted' ? `（${m.result}）` : ''}`, X0, y, 14, m.outcome === 'enacted' ? C.good : m.outcome === 'pending' ? C.cyan : C.bad); y += 20;
          T(c, `${m.sponsor === 'cabinet' ? '閣法（内閣提出）' : '議員立法'}・提出 ${m.created ? dl(g, m.created) : ''}`, X0, y, 12, C.dim); y += 15;
          for (const [k, vv] of Object.entries(m.votes || {})) { if (k === 'referendum') { T(c, `国民投票：賛成 ${vv.yes}%`, X0, y, 12, C.text); y += 14; } else { T(c, `${k === 'shugi' ? '衆議院' : k === 'sangi' ? '参議院' : '再可決'}：賛成${vv.yes}・反対${vv.no}（${vv.passed ? '可決' : '否決'}）`, X0, y, 12, vv.passed ? C.text : C.bad); y += 14; } }
          if (m.tactics) { y += 2; T(c, fit(c, `戦術：${m.tactics.kokutai ? `国会対策${m.tactics.kokutai}党` : ''}${m.tactics.amend ? ' 修正協議' : ''}${m.tactics.futai ? ' 付帯決議' : ''}`, W, 12), X0, y, 12, C.cyan); y += 14; }
          if (m.cost) T(c, `財政：年${m.cost > 0 ? '' : '+'}${Math.abs(m.cost)}兆円`, X0, y, 12, C.dim);
        } else {
          const l = row.l;
          T(c, `${l.date}成立（${l.age}日前）・${l.sponsor}`, X0, y, 12, C.dim); y += 15;
          T(c, fit(c, `提出：${l.byMe ? 'あなた' : l.by || l.partyName || '内閣'}${l.partyName ? `（${l.partyName}）` : ''}`, W, 12), X0, y, 12, l.byMe ? C.gold : C.text); y += 15;
          T(c, `分野：${l.areaName}`, X0, y, 12, C.text); y += 15;
          T(c, `財政：${l.cost ? `年${l.cost > 0 ? '' : '+'}${Math.abs(l.cost)}兆円${l.cost > 0 ? 'の支出' : 'の財源'}` : '大きな負担なし'}`, X0, y, 12, C.text); y += 15;
          T(c, `効果が続く目安：${l.lasting}年`, X0, y, 12, C.dim); y += 15;
          if (l.effects) { T(c, fit(c, `経済：${l.effects}`, W, 12), X0, y, 12, C.cyan); }
        }
      },
    };
    return v;
  }
  SECTIONS.lawbook = async (ui) => { if (has(ui.g, 'legislationHistory')) await ui.open(lawbookView(ui.g)); else await ui.alert('立法の記録', 'まだ準備中です。'); };
}
