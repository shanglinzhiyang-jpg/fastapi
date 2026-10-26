// 世界情勢の画面：新しいタブと読みやすい詳細 (R9-E). Created by world_ui.js with its list / flows (makeMore(ctx)).
//   地域 (regions and blocs, with a mini map), 推移 (charts: tension, standing, threat, oil, trade, relations, trade shares),
//   年表 (the real history up to the game's date + this world's events + the player's diplomacy, filters, a map marker),
//   ニュース (list + detail; the summit calendar), and the detail pages of 地図 (the strip), 国々 (relation chart, chips,
//   key facts, できること) and 危機 (stage bar, effects, できること with odds and effects).
import { measure } from './draw.js';
import { clamp } from './util.js';
import { K, R, T, num, safe, has, para, panel, section, gauge, bar, sparkline, trend, icon, chip, chipRow, stageBar, lineChart, relColor, relText, n0 } from './world_uikit.js';
import { drawMapView, baked, ring } from './world_ui_map.js';
import { drawHistImg } from './world_hist.js'; // [R14-H]

const KIND_NAME = { war: '戦争・紛争', clash: '衝突', coup: '政変', finance: '金融危機', oil: '原油高', missile: 'ミサイル・核', incident: '領海・領空', trade: '貿易摩擦', disaster: '災害', humanitarian: '人道危機', unrest: '政情不安', terror: 'テロ' };
const KIND_ICON = { war: 'war', clash: 'war', coup: 'flag', finance: 'money', oil: 'oil', missile: 'fire', incident: 'dispute', trade: 'money', disaster: 'crisis', humanitarian: 'people', unrest: 'people', terror: 'fire' };
const KIND_EFFECT = {
  war: '原油と世界の緊張が上がる。在留の日本人に危険が及ぶことがある', clash: '周りの国々の緊張が高まる。戦争に広がることもある', coup: '在留の日本人の安全と、日本企業の工場に影響が出る',
  finance: '株価と景気に下押し。円が動き、輸出企業に響く', oil: 'ガソリン・電気代・物価が上がり、景気を冷やす', missile: '日本への脅威が上がる。迎撃と警報の態勢が問われる',
  incident: '日本の主権と安全にかかわる。対応しだいで関係が冷える', trade: '関税の応酬になれば輸出が減る（「貿易・関税」で対応）', disaster: '多くの人が被災している。救助・医療・資金の支援が求められている',
  humanitarian: '多くの人の命とくらしにかかわる。国際的な支援が求められている', unrest: '治安が悪化し、在留の日本人の退避が課題になる', terror: '世界の緊張が上がり、各国が安全保障を強めている',
};
// which crisis actions apply to which kind (the rest are hidden in the detail; the A menu still lists everything)
const APPLY = {
  jdr: ['disaster', 'humanitarian'], evac: ['coup', 'war', 'unrest', 'clash'], reserve: ['oil'], coordinate: ['finance', 'trade'], donate: ['disaster', 'humanitarian', 'war', 'clash'],
  trade_talk: ['trade'], trade_concede: ['trade'], trade_wto: ['trade'], trade_counter: ['trade'],
  crisis_statement: ['war', 'clash', 'coup', 'finance', 'oil', 'missile', 'incident', 'disaster', 'humanitarian', 'unrest', 'terror'],
  crisis_fund: ['war', 'disaster', 'humanitarian', 'unrest', 'coup', 'terror', 'clash'],
};
const COUNTRY_PRIO = ['summit', 'visit', 'fm_talks', 'envoy', 'aid', 'fta', 'soft_action', 'statement', 'protest', 'sanction', 'lift', 'defense_pact', 'ties', 'recall', 'return_amb'];
const sevDots = (s) => '●'.repeat(clamp(num(s, 1), 1, 3)) + '○'.repeat(3 - clamp(num(s, 1), 1, 3));
const ymText = (n) => `${Math.floor(n / 10000)}年${Math.floor(n / 100) % 100}月`;

export function makeMore(ctx) {
  const { drawList, LIST, DETAIL } = ctx;
  const DX = DETAIL.x + 8, DW = DETAIL.w - 16;
  // ---------------------------------------------------------------- できること (the options with their odds and effects)
  // rows: [{ id, name, odds, why, lines }]; draws up to `max` rows of 2 lines; returns the height used
  function optionsBox(ui, c, x, y, w, list, max, opts = {}) {
    const role = ui.data.role;
    let h = section(c, x, y, opts.title || 'できること（A で選ぶ）', K.amber, w);
    const open = list.filter((a) => !a.why), locked = list.filter((a) => a.why);
    const show = open.concat(locked).slice(0, max);
    if (!list.length) { T(c, 'いま使える手段はない', x + 4, y + h, 10, K.faint, 'left', w - 4); return h + 14; }
    if (!open.length && role && (role.kind === 'citizen' || role.kind === 'member')) {
      h += para(c, '外交の手段は総理・外務大臣・防衛大臣が使う。いまは見ることができる（募金はだれでもできる）。', x + 4, y + h, w - 4, 10, K.dim, 13, 2);
    }
    for (const a of show) {
      if (y + h + 14 > (opts.bottom || 1e9)) break;
      const right = a.why ? '🔒' : a.odds != null ? `${Math.round(a.odds * 100)}%` : '○';
      const rc = a.why ? K.lock : a.odds == null ? K.dim : a.odds >= 0.6 ? K.good : a.odds >= 0.35 ? K.warn : K.bad;
      R(c, x, y + h, w, 26, a.why ? 'rgba(255,255,255,0.025)' : 'rgba(79,210,232,0.07)');
      R(c, x, y + h, 2, 26, a.why ? K.faint : K.cyan);
      T(c, a.name, x + 7, y + h + 1, 12, a.why ? K.faint : K.text, 'left', w - 50);
      T(c, right, x + w - 4, y + h + 2, 10, rc, 'right');
      T(c, a.why ? a.why : (a.lines && a.lines[0]) || a.desc || '', x + 7, y + h + 14, 10, a.why ? K.lock : K.dim, 'left', w - 12);
      h += 28;
    }
    return h;
  }
  function countryActions(ui, id) {
    return ui.memo(`acts:${id}`, () => {
      const list = (has(ui.g, 'diplomacyActions') ? ui.g.diplomacyActions(id) : []) || [];
      const pr = (a) => { const i = COUNTRY_PRIO.indexOf(a.id); return i < 0 ? 99 : i; };
      return list.filter((a) => a.id !== 'declare' && a.id !== 'cut_ties').sort((a, b) => (a.why ? 1 : 0) - (b.why ? 1 : 0) || pr(a) - pr(b));
    }) || [];
  }
  function crisisActions(ui, k) {
    return ui.memo(`kacts:${k.id}`, () => ((has(ui.g, 'diplomacyActions') ? ui.g.diplomacyActions('k:' + k.id) : []) || []).filter((a) => !APPLY[a.id] || APPLY[a.id].includes(k.kind))) || [];
  }
  function conflictActions(ui, cf) {
    return ui.memo(`cacts:${cf.id}`, () => (has(ui.g, 'diplomacyActions') ? ui.g.diplomacyActions('c:' + cf.id) : []) || []) || [];
  }
  const relSeries = (ui, id) => ui.memo(`rs:${id}`, () => (has(ui.g, 'worldSeries') ? ui.g.worldSeries(`rel:${id}`) : null));
  const relTrend = (ui, id) => ui.memo(`rt:${id}`, () => (has(ui.g, 'worldRelTrend') ? ui.g.worldRelTrend(id) : 0)) || 0;
  const startX = (ui) => { const h = ui.g.state && ui.g.state.world && ui.g.state.world.hist; const s = h ? h.start : 0; return s ? Math.floor(s / 10000) + ((Math.floor(s / 100) % 100) - 1) / 12 : null; };
  function statusChips(ui, row, det) {
    const d = ui.data;
    const B = d.w.blocs[row.bloc] || {};
    return [
      { label: B.short || row.blocName || '', color: B.color || K.dim },
      row.war ? { label: '戦争中', color: K.bad, icon: 'war' } : null,
      row.ally ? { label: '同盟・協力', color: K.blue, icon: 'ally' } : null,
      row.sanction ? { label: `日本が制裁 段階${row.sanction}`, color: '#ff9a5a', icon: 'ban' } : null,
      row.onJapan ? { label: `日本に制裁 段階${row.onJapan}`, color: K.bad, icon: 'ban' } : null,
      !row.ties ? { label: `国交：${row.tiesLabel}`, color: K.lock } : null,
      det && det.dispute ? { label: det.dispute.name, color: K.warn, icon: 'dispute' } : null,
      det && det.conflicts && det.conflicts.length ? { label: '紛争中', color: K.bad, icon: 'war' } : null,
      (d.w.crises || []).some((k) => k.country === row.id) ? { label: '危機', color: K.warn, icon: 'crisis' } : null,
    ].filter(Boolean);
  }
  // ---------------------------------------------------------------- the map strip
  function drawMapStrip(ui, c, x, y, w, h) {
    const d = ui.data;
    const row = ui.sel && d.rows[ui.sel];
    panel(c, x, y, w, h, row ? row.name : '国を選ぶ', { right: 'A：くわしく・外交', icon: 'flag' });
    if (!row) return;
    const det = ui.detail(ui.sel);
    T(c, det ? det.leader : '', x + 8, y + 21, 10, K.dim, 'left', 196);
    chipRow(c, x + 8, y + 35, 196, statusChips(ui, row, det), { rows: 2 });
    // the relation
    const mx = x + 214;
    T(c, '日本との関係', mx, y + 21, 10, K.dim);
    T(c, `${row.relation}`, mx, y + 33, 22, relText(row.relation));
    const nw = measure(c, `${row.relation}`, 22);
    T(c, row.relLabel, mx + nw + 6, y + 36, 12, relText(row.relation), 'left', 90);
    trend(c, mx + nw + 6, y + 51, relTrend(ui, row.id), 10);
    gauge(c, mx, y + 64, 150, row.relation);
    // the history + the issue
    const rx = x + 384, rw = w - 392;
    const rs = row.real ? relSeries(ui, row.id) : null;
    if (rs && rs.pts.length > 2) { sparkline(c, rx, y + 22, 96, 30, rs.pts.slice(-36).map((p) => p.v), K.cyan); T(c, '関係の推移', rx, y + 56, 10, K.faint); }
    const issue = det && ((det.conflicts && det.conflicts.length ? `紛争：${det.conflicts.join('・')}` : '') || (d.w.crises.find((k) => k.country === row.id) || {}).title || (det.dispute ? `${det.dispute.name}をめぐる対立` : '') || det.note);
    para(c, issue || '', rx + 106, y + 21, rw - 106, 10, K.text, 13, 4);
  }
  // ---------------------------------------------------------------- 国々: the country page
  function drawCountryDetail(ui, c, id) {
    const det = ui.detail(id);
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, det ? det.name : '', { right: 'A：外交の手段', icon: 'flag' });
    if (!det) return;
    const bottom = DETAIL.y + DETAIL.h - 4;
    let y = DETAIL.y + 21;
    // the relation, big
    T(c, `${det.relation}`, DX, y, 24, relText(det.relation));
    const nw = measure(c, `${det.relation}`, 24);
    T(c, det.relLabel, DX + nw + 6, y + 2, 12, relText(det.relation), 'left', 110);
    T(c, '日本との関係', DX + nw + 6, y + 16, 10, K.dim);
    trend(c, DX + nw + 80, y + 16, relTrend(ui, id), 10);
    gauge(c, DX + 200, y + 10, DW - 200, det.relation);
    y += 30;
    y += chipRow(c, DX, y, DW, statusChips(ui, det, det), { rows: 2 }) + 4;
    // the chart
    const rs = det.real ? relSeries(ui, id) : null;
    if (det.hist) { // [R14-H] 歴史の列強: the leader's photo and the flag, as they are
      const H = det.hist;
      R(c, DX, y, DW, 66, 'rgba(255,255,255,0.04)');
      drawHistImg(c, H.portrait, DX + 4, y + 2, 50, 62, 'cover');
      drawHistImg(c, H.flag, DX + 60, y + 5, 64, 40, 'contain');
      T(c, H.years, DX + 60, y + 49, 10, K.dim, 'left', 70);
      T(c, H.leaderName, DX + 132, y + 4, 14, K.amber, 'left', DW - 136);
      para(c, H.title || det.leader || '', DX + 132, y + 22, DW - 136, 10, K.text, 13, 2);
      para(c, '設定「歴史の列強」で参入している国', DX + 132, y + 50, DW - 170, 10, K.faint, 13, 1);
      drawHistImg(c, 'flag_jp', DX + DW - 32, y + 46, 26, 17); // 日本
      y += 70;
    } else if (rs) {
      lineChart(c, DX, y, DW, 66, [{ pts: rs.pts, color: K.cyan }], { lo: -100, hi: 100, zero: true, ticks: [-100, 0, 100], startX: startX(ui), size: 8, axisW: 22 });
      y += 70;
    }
    // key facts
    const facts = [
      ['首脳', det.leader], ['体制', det.gov || ''],
      det.real ? ['経済', `GDP 約${det.gdp}兆ドル（目安）`] : null, det.real ? ['貿易', `日本の貿易の約${det.trade}%`] : null,
      ['軍事力', `${det.mil}`], det.member && det.member.length ? ['加盟', det.member.join('・')] : null,
    ].filter(Boolean);
    for (let i = 0; i < facts.length; i += 2) {
      for (let j = 0; j < 2 && i + j < facts.length; j++) { const [k, v] = facts[i + j]; const fx = DX + j * (DW / 2); T(c, k, fx, y, 10, K.dim); T(c, v, fx + 34, y, 10, K.text, 'left', DW / 2 - 38); }
      y += 13;
    }
    y += 3;
    // できること
    if (y < bottom - 40) y += optionsBox(ui, c, DX, y, DW, countryActions(ui, id), Math.max(1, Math.floor((bottom - y - 30) / 28)), { bottom }) + 2;
    if (y < bottom - 14) para(c, det.note || '', DX, y, DW, 10, K.dim, 13, Math.floor((bottom - y) / 13));
  }
  // ---------------------------------------------------------------- 危機: a crisis / a conflict
  function drawCrisisDetail(ui, c, k) {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, k.title, { accent: K.warn, right: 'A：対応を選ぶ', icon: KIND_ICON[k.kind] || 'crisis' });
    const bottom = DETAIL.y + DETAIL.h - 4;
    let y = DETAIL.y + 22;
    let cx = DX;
    cx += chip(c, cx, y, KIND_NAME[k.kind] || '危機', K.warn, { icon: KIND_ICON[k.kind] || 'crisis' }) + 4;
    if (k.countryName) cx += chip(c, cx, y, k.countryName, K.dim) + 4;
    if (k.real) cx += chip(c, cx, y, '実際の出来事', K.cyan) + 4;
    T(c, `深刻さ ${sevDots(k.sev)}`, DX + DW, y + 1, 12, num(k.sev) >= 3 ? K.bad : num(k.sev) >= 2 ? K.warn : K.text, 'right');
    y += 20;
    const st = k.stage || (has(ui.g, 'worldCrisisStage') ? safe(() => ui.g.worldCrisisStage(k.id), null) : null);
    if (st) {
      y += section(c, DX, y, 'いまの段階', K.warn, DW);
      y += stageBar(c, DX, y, DW, st.labels, st.idx, K.warn, 12) + 4;
      if (st.text) y += para(c, st.text, DX, y, DW, 10, K.text, 13, 3) + 2;
    }
    y += section(c, DX, y, '影響', K.amber, DW);
    y += para(c, KIND_EFFECT[k.kind] || '', DX + 4, y, DW - 4, 10, K.text, 13, 2) + 4;
    if (k.handled && Object.keys(k.handled).length) { const done = Object.keys(k.handled).map((x) => ({ jdr: '援助隊', evac: '邦人退避', reserve: '備蓄放出', coord: '協調', stmt: '声明', fund: '資金協力' })[x]).filter(Boolean); if (done.length) { T(c, `日本の対応ずみ：${[...new Set(done)].join('・')}`, DX, y, 10, K.good, 'left', DW); y += 14; } }
    optionsBox(ui, c, DX, y, DW, crisisActions(ui, k), Math.max(1, Math.floor((bottom - y - 14) / 28)), { bottom });
  }
  function drawConflictDetail(ui, c, cf) {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, cf.name, { accent: K.bad, right: 'A：仲介・支援・参戦', icon: 'war' });
    const d = ui.data;
    const bottom = DETAIL.y + DETAIL.h - 4;
    let y = DETAIL.y + 22;
    T(c, cf.aName, DX, y, 14, relText((d.rows[cf.a] || {}).relation || 0), 'left', 140);
    T(c, '対', DX + DW / 2, y + 2, 12, K.dim, 'center');
    T(c, cf.bName, DX + DW, y, 14, relText((d.rows[cf.b] || {}).relation || 0), 'right', 140);
    y += 20;
    // the front: + = the first side ahead
    const bw = DW, bx = DX, mid = bx + bw / 2;
    R(c, bx, y, bw, 8, '#1a2a3a'); R(c, mid, y - 2, 1, 12, K.dim);
    const p = mid + (clamp(num(cf.front), -100, 100) / 100) * (bw / 2);
    R(c, Math.min(p, mid), y, Math.max(1, Math.abs(p - mid)), 8, K.bad);
    T(c, num(cf.front) > 8 ? `${cf.aName}が優勢` : num(cf.front) < -8 ? `${cf.bName}が優勢` : '一進一退', mid, y + 11, 10, K.dim, 'center');
    y += 26;
    const hs = ui.g.state && ui.g.state.world && ui.g.state.world.hist;
    const longWar = cf.real && cf.start === -1 && hs && cf.since && cf.since < hs.start; // a real war that began before the era start
    T(c, longWar ? `死者（推計）多数・ここ最近 +${n0(cf.dead)}人` : `死者（推計）${n0(cf.dead)}人`, DX, y, 12, K.text, 'left', DW - 110); T(c, cf.since ? `${ymText(cf.since)}から` : '', DX + DW, y + 1, 10, K.dim, 'right'); y += 16;
    if (cf.aggressor) { T(c, `攻撃を始めた側：${(d.rows[cf.aggressor] || {}).short || cf.aggressor}`, DX, y, 10, K.dim, 'left', DW); y += 14; }
    if (cf.japan) { T(c, `日本の関わり：${{ rear: '後方支援', collective: '集団的自衛権で参戦', dispatch: '派兵', mediate: '仲介' }[cf.japan.role] || cf.japan.role}`, DX, y, 10, K.warn, 'left', DW); y += 14; }
    y += 4;
    optionsBox(ui, c, DX, y, DW, conflictActions(ui, cf), Math.max(1, Math.floor((bottom - y - 14) / 28)), { bottom });
  }
  // ---------------------------------------------------------------- 地域
  const regionsOf = (ui) => ui.memo('regions', () => (has(ui.g, 'worldRegions') ? ui.g.worldRegions() : [])) || [];
  const ST_COL = { 安定: K.good, 不安定: K.warn, 緊張: '#ff9a5a', 紛争: K.bad };
  const BLOC_DESC = {
    west: (cold) => (cold ? '米国を中心とする自由主義の国々。日本は日米安保条約で西側に属する。' : 'G7の国々と米国の同盟国。民主主義と市場経済の国々。日本はこの陣営に属する。'),
    east: () => 'ソ連を中心とする社会主義の国々（ワルシャワ条約機構）。',
    nonaligned: () => '東西どちらの陣営にも属さない国々（非同盟運動など）。',
    cnru: () => '米国と対立を深める中国・ロシアと、それに近い国々。',
    other: () => '大国の対立から距離をおき、それぞれの国益で動く国々。',
  };
  const TAB_REGIONS = {
    id: 'regions', label: '地域', icon: 'region',
    rows(ui) {
      const out = [{ header: true, label: '世界の地域' }];
      for (const r of regionsOf(ui)) out.push({ key: 'g:' + r.id, label: r.name, right: r.status, rightColor: ST_COL[r.status] || K.dim, region: r });
      const fl = ui.data.w.fictional || [];
      if (fl.length) out.push({ key: 'g:vm', label: 'ヴェルミナ海', right: fl.some((f) => f.war) ? '紛争' : '—', rightColor: fl.some((f) => f.war) ? K.bad : K.dim, region: { id: 'vm', name: 'ヴェルミナ海', fictional: true } });
      out.push({ header: true, label: '陣営' });
      for (const [id, b] of Object.entries(ui.data.w.blocs)) out.push({ key: 'b:' + id, label: b.name, right: `${b.members.length}か国`, rightColor: b.color, bloc: { id, ...b } });
      return out;
    },
    draw(ui, c) {
      drawList(ui, c, LIST);
      const row = ui.curRow();
      if (row && row.bloc) return drawBloc(ui, c, row.bloc);
      const r = row && row.region;
      if (!r) { panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '地域'); return; }
      if (r.fictional) return drawVermina(ui, c);
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, r.name, { accent: ST_COL[r.status] || K.amber, right: 'A：国を選んで外交', icon: 'region' });
      let y = DETAIL.y + 21;
      const dest = { x: DX, y, w: DW, h: 104 };
      const prevSel = ui.sel;
      drawMapView(ui, c, dest, r.view === 'world' ? { id: 'pt', lat: 25, lon: -80, z: 1.3 } : r.view, { labels: true, icons: true, tooltip: false });
      void prevSel;
      y += 108;
      T(c, 'この地域の緊張', DX, y, 10, K.dim); bar(c, DX + 82, y + 3, 150, r.temp, 100, ST_COL[r.status] || K.warn); T(c, `${r.temp}・${r.status}`, DX + 238, y, 10, ST_COL[r.status] || K.text); y += 14;
      T(c, `日本との関係（平均）${r.avgRel}`, DX, y, 10, relText(r.avgRel), 'left', DW / 2); T(c, `日本の貿易に占める割合 約${r.trade}%`, DX + DW / 2, y, 10, K.text, 'left', DW / 2); y += 16;
      // the members
      let cx = DX;
      for (const id of r.ids) {
        const m = ui.data.rows[id];
        if (!m) continue;
        const lab = `${m.short} ${m.relation}`;
        const cw = measure(c, lab, 10) + 12 + (m.ally || m.war || m.sanction ? 12 : 0);
        if (cx + cw > DX + DW) { cx = DX; y += 18; }
        chip(c, cx, y, lab, relText(m.relation), { icon: m.war ? 'war' : m.ally ? 'ally' : m.sanction ? 'ban' : null });
        cx += cw + 4;
      }
      y += 20;
      const lines = [...r.conflicts.map((x) => ({ t: `紛争：${x}`, col: K.bad })), ...r.crises.slice(0, 3).map((x) => ({ t: `危機：${x}`, col: K.warn })), ...r.disputes.map((x) => ({ t: `領土問題：${x}`, col: K.warn }))];
      if (!lines.length) lines.push({ t: 'いまは大きな危機や紛争はない', col: K.good });
      for (const l of lines) { if (y > DETAIL.y + DETAIL.h - 16) break; T(c, `・${l.t}`, DX, y, 10, l.col, 'left', DW); y += 13; }
    },
    async act(ui, row) {
      if (!row) return;
      if (row.bloc) { await ui.info(row.bloc.name, [BLOC_DESC[row.bloc.id] ? BLOC_DESC[row.bloc.id](!!ui.data.w.coldWar) : '', '', `加盟・近い国：${row.bloc.members.map((id) => (ui.data.rows[id] || {}).short || id).join('・')}`]); return; }
      const r = row.region;
      if (!r) return;
      const ids = r.fictional ? (ui.data.w.fictional || []).map((f) => f.id) : r.ids;
      const items = [{ label: '地図でこの地域を見る', sub: '地図のタブで拡大する' }, ...ids.map((id) => { const m = ui.data.rows[id] || {}; return { label: m.name || id, sub: `関係 ${m.relation}・${m.blocName || ''}${m.war ? '・戦争中' : ''}`, right: `${m.relation}`, rightColor: relColor(m.relation || 0) }; })];
      const k = await ui.pick({ title: r.name, items, w: 480 });
      if (k == null || k < 0) return;
      if (k === 0) { ui.mapView = r.view === 'world' || r.fictional ? 'world' : r.view; ui.setTab(0); if (ids[0] && ui.data.rows[ids[0]] && ui.data.rows[ids[0]].pos) ui.sel = ids[0]; ui.focus = 'body'; return; }
      await ctx.actionsMenu(ui, ids[k - 1]);
    },
  };
  function drawBloc(ui, c, b) {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, b.name, { accent: b.color, right: `${b.members.length}か国` });
    let y = DETAIL.y + 22;
    y += para(c, BLOC_DESC[b.id] ? BLOC_DESC[b.id](!!ui.data.w.coldWar) : '', DX, y, DW, 12, K.text, 16, 3) + 6;
    y += section(c, DX, y, '国々（日本との関係）', b.color, DW);
    let cx = DX;
    for (const id of b.members) {
      const m = ui.data.rows[id]; if (!m) continue;
      const lab = `${m.short} ${m.relation}`; const cw = measure(c, lab, 10) + 12;
      if (cx + cw > DX + DW) { cx = DX; y += 18; }
      chip(c, cx, y, lab, relText(m.relation)); cx += cw + 4;
    }
    y += 24;
    const jp = b.id === 'west';
    para(c, jp ? '日本はこの陣営の一員。同盟国が戦争に巻きこまれると、日本も選択を迫られる。' : '世界の緊張が高まるほど、陣営どうしの対立が強まる。地図の「陣営」の色で、どの国がどこに近いかが見える。', DX, y, DW, 10, K.dim, 13, 4);
  }
  function drawVermina(ui, c) {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, 'ヴェルミナ海', { right: 'A：国を選んで外交', icon: 'region' });
    let y = DETAIL.y + 24;
    for (const f of ui.data.w.fictional || []) {
      const det = ui.detail(f.id);
      T(c, f.name, DX, y, 12, K.text, 'left', 200); T(c, `${f.relation}`, DX + DW, y, 12, relText(f.relation), 'right'); y += 16;
      gauge(c, DX, y, 160, f.relation); if (f.war) T(c, '戦争中', DX + 170, y - 3, 10, K.bad); y += 10;
      y += para(c, det ? det.note || '' : '', DX, y, DW, 10, K.dim, 13, 3) + 8;
    }
  }
  // ---------------------------------------------------------------- 推移
  const TREND_ROWS = [
    { h: '世界' }, { k: 'tension' }, { k: 'standing' }, { k: 'threat' }, { k: 'oil' },
    { h: '日本の貿易' }, { k: 'exports' }, { k: 'imports' }, { k: 'balance' },
    { h: '主な国との関係' }, { k: 'rel:multi', label: '主な国との関係（くらべる）' },
    { h: '貿易相手の割合' }, { k: 'trade:multi', label: '貿易相手の割合（くらべる）' },
  ];
  const MULTI_REL = ['us', 'cn', 'kr', 'ru', 'su', 'tw', 'kp'];
  const MULTI_TRADE = ['us', 'cn', 'kr', 'tw', 'au', 'sa', 'de', 'wde'];
  const LINE_COLS = ['#4f8fe8', '#ff6470', '#57d98a', '#ffb547', '#b48cff', '#4fd2e8', '#e8e070', '#ff9ad2'];
  function seriesOf(ui, key) {
    return ui.memo(`ser:${key}`, () => {
      if (!has(ui.g, 'worldSeries')) return null;
      if (key === 'rel:multi' || key === 'trade:multi') {
        const ids = (key === 'rel:multi' ? MULTI_REL : MULTI_TRADE).filter((id) => ui.data.rows[id]);
        const list = ids.map((id, i) => { const s = ui.g.worldSeries(`${key === 'rel:multi' ? 'rel' : 'trade'}:${id}`); return s ? { ...s, id, color: LINE_COLS[i % LINE_COLS.length], name: ui.data.rows[id].short } : null; }).filter(Boolean);
        return { multi: true, list, label: key === 'rel:multi' ? '主な国と日本の関係' : '日本の貿易に占める割合（%）', lo: key === 'rel:multi' ? -100 : 0, hi: key === 'rel:multi' ? 100 : null, unit: key === 'rel:multi' ? '' : '%', note: key === 'rel:multi' ? '−100（険悪）〜100（良好）。線が上がるほど関係が良い' : '日本の輸出入の合計に占める割合（目安）。1990年代から2000年代に、最大の相手が米国から中国に変わった' };
      }
      return ui.g.worldSeries(key);
    });
  }
  const fmtV = (s, v) => (v == null ? '—' : s && s.unit === '兆' ? `${v >= 0 && s.key === 'balance' ? '+' : ''}${Math.round(v * 10) / 10}兆円` : s && s.unit === '%' ? `${v}%` : `${v}`);
  const TAB_TRENDS = {
    id: 'trends', label: '推移', icon: 'chart',
    rows(ui) {
      const out = [];
      for (const r of TREND_ROWS) {
        if (r.h) { out.push({ header: true, label: r.h }); continue; }
        const s = seriesOf(ui, r.k);
        if (!s) continue;
        out.push({ key: 's:' + r.k, label: r.label || s.label.replace(/（[^）]*）$/, ''), right: s.multi ? '▶' : fmtV(s, s.now), rightColor: s.multi ? K.dim : r.k === 'balance' ? (num(s.now) >= 0 ? K.good : K.bad) : K.text, series: r.k });
      }
      // every country, by its relation
      out.push({ header: true, label: '国ごとの関係' });
      for (const c0 of ui.data.w.countries.slice().sort((a, b) => b.relation - a.relation)) out.push({ key: 's:rel:' + c0.id, label: c0.short, right: `${c0.relation}`, rightColor: relText(c0.relation), series: 'rel:' + c0.id });
      return out;
    },
    draw(ui, c) {
      drawList(ui, c, LIST);
      const row = ui.curRow();
      const s = row && row.series ? seriesOf(ui, row.series) : null;
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, s ? s.label : '推移', { icon: 'chart', right: s && !s.multi && s.now != null ? `いま ${fmtV(s, s.now)}` : '' });
      if (!s) return;
      let y = DETAIL.y + 22;
      const sx = startX(ui);
      if (s.multi) {
        lineChart(c, DX, y, DW, 178, s.list.map((x) => ({ pts: x.pts, color: x.color, label: x.name })), { lo: s.lo, hi: s.hi, zero: s.lo < 0, ticks: s.lo < 0 ? [-100, -50, 0, 50, 100] : null, startX: sx, startLabel: 'ゲーム開始', legend: false, size: 10 });
        y += 182;
        let cx = DX;
        for (const x of s.list) { const lab = `${x.name} ${fmtV({ unit: s.unit }, x.now)}`; const cw = measure(c, lab, 10) + 18; if (cx + cw > DX + DW) { cx = DX; y += 15; } R(c, cx, y + 4, 10, 4, x.color); T(c, lab, cx + 13, y, 10, K.text); cx += cw; }
        y += 18;
        para(c, s.note, DX, y, DW, 10, K.dim, 13, Math.max(1, Math.floor((DETAIL.y + DETAIL.h - y - 4) / 13)));
        return;
      }
      const isRel = /^rel:/.test(s.key);
      const col = isRel ? K.cyan : s.key === 'tension' || s.key === 'threat' ? K.bad : s.key === 'oil' ? K.warn : s.key === 'balance' ? K.good : K.cyan;
      lineChart(c, DX, y, DW, 178, [{ pts: s.pts, color: col }], { lo: s.lo, hi: s.hi, zero: true, ticks: isRel ? [-100, -50, 0, 50, 100] : s.lo === 0 && s.hi === 100 ? [0, 25, 50, 75, 100] : null, startX: sx, startLabel: 'ゲーム開始', size: 10, fmt: s.unit === '兆' ? (v) => `${Math.round(v)}` : undefined });
      y += 184;
      const downGood = ['tension', 'threat', 'oil', 'imports'].includes(s.key);
      T(c, 'いま', DX, y, 10, K.dim); T(c, fmtV(s, s.now), DX + 30, y - 4, 18, K.text);
      T(c, '1年前とくらべて', DX + 140, y, 10, K.dim); if (s.d1y != null) trend(c, DX + 232, y - 1, s.d1y, 12, downGood); else T(c, '—', DX + 232, y, 10, K.faint);
      T(c, `最低 ${fmtV(s, s.min)}・最高 ${fmtV(s, s.max)}`, DX + DW, y, 10, K.dim, 'right');
      y += 22;
      para(c, s.note || '', DX, y, DW, 10, K.dim, 13, Math.max(1, Math.floor((DETAIL.y + DETAIL.h - y - 4) / 13)));
    },
    act: async (ui, row) => { if (row && row.series && /^rel:[a-z]+$/.test(row.series)) await ctx.actionsMenu(ui, row.series.slice(4)); },
  };
  // ---------------------------------------------------------------- 年表
  const FILTERS = [{ id: 'all', label: 'すべて' }, { id: 'real', label: '世界の出来事' }, { id: 'japan', label: '日本の外交' }, { id: 'crisis', label: '危機・戦争・災害' }, { id: 'game', label: 'この世界の動き' }];
  const CAT_ICON = { war: 'war', econ: 'money', diplo: 'hand', politics: 'flag', disaster: 'crisis', japan: 'shield', sports: 'star', game: 'globe' };
  const CAT_COL = { war: K.bad, econ: K.warn, diplo: K.cyan, politics: K.violet, disaster: '#ff9a5a', japan: K.blue, sports: K.good, game: K.dim };
  const TAB_TIMELINE = {
    id: 'timeline', label: '年表', icon: 'clock',
    rows(ui) {
      const f = FILTERS[num(ui.tlFilter, 0) % FILTERS.length];
      const list = (has(ui.g, 'worldTimeline') ? safe(() => ui.g.worldTimeline({ filter: f.id, n: 220 }), []) : []) || [];
      const out = [{ key: 'filter', label: `しぼりこみ：${f.label}`, right: `${list.length}件 ▶`, rightColor: K.amber, filter: true }];
      let year = null;
      for (const e of list) {
        if (e.year !== year) { year = e.year; out.push({ header: true, label: `${year}年${list.some((x) => x.year === year && !x.past) ? '' : '（これまでの出来事）'}` }); }
        out.push({ key: `e${out.length}`, label: e.text, right: `${Math.floor(e.n / 100) % 100}月`, rightColor: CAT_COL[e.cat] || K.dim, ev: e, color: e.src === 'real' ? K.text : e.src === 'diplo' ? '#bcd8ff' : '#c8d2dc' });
      }
      if (!list.length) out.push({ key: 'none', label: '（まだ記録はない）' });
      return out;
    },
    draw(ui, c) {
      drawList(ui, c, LIST);
      const row = ui.curRow();
      if (row && row.filter) {
        panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '年表', { icon: 'clock', right: 'A：しぼりこみを変える' });
        let y = DETAIL.y + 24;
        y += para(c, '実際の世界の出来事（その日付までに起きたことだけ）と、この世界で起きた出来事、あなたの外交の記録をまとめた年表。', DX, y, DW, 12, K.text, 16, 4) + 8;
        FILTERS.forEach((f, i) => { const on = i === num(ui.tlFilter, 0) % FILTERS.length; chip(c, DX + (i % 2) * (DW / 2), y + Math.floor(i / 2) * 20, f.label, on ? K.amber : K.dim, { size: 12, bg: on ? 'rgba(255,181,71,0.15)' : undefined }); });
        y += 66;
        Object.entries(CAT_COL).slice(0, 8).forEach(([k, col], i) => { const lx = DX + (i % 4) * (DW / 4), ly = y + Math.floor(i / 4) * 16; icon(c, CAT_ICON[k], lx, ly, 1, col); T(c, { war: '戦争', econ: '経済', diplo: '外交', politics: '政治', disaster: '災害', japan: '日本', sports: 'スポーツ', game: 'この世界' }[k], lx + 12, ly, 10, col, 'left', DW / 4 - 14); });
        return;
      }
      const e = row && row.ev;
      if (!e) { panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '年表', { icon: 'clock' }); return; }
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, e.date, { icon: CAT_ICON[e.cat] || 'globe', accent: CAT_COL[e.cat] || K.amber, right: e.src === 'real' ? (e.past ? 'これまでの出来事' : '世界の出来事') : e.src === 'diplo' ? 'あなたの外交' : 'この世界の出来事' });
      let y = DETAIL.y + 22;
      chip(c, DX, y, e.catName || '', CAT_COL[e.cat] || K.dim, { icon: CAT_ICON[e.cat] });
      if (e.where && ui.data.rows[e.where]) chip(c, DX + DW - measure(c, ui.data.rows[e.where].short, 10) - 10, y, ui.data.rows[e.where].short, K.dim);
      y += 20;
      y += para(c, e.text, DX, y, DW, 14, K.text, 19, 5) + 6;
      const pos = e.at || (e.where && ui.data.rows[e.where] && ui.data.rows[e.where].pos) || null;
      if (pos && y < DETAIL.y + DETAIL.h - 70) {
        const dest = { x: DX, y, w: DW, h: Math.min(130, DETAIL.y + DETAIL.h - y - 6) };
        const r = drawMapView(ui, c, dest, { id: 'pt', lat: clamp(pos[0], -30, 55), lon: pos[1], z: 2.2 }, { labels: true, icons: false, tooltip: false });
        const b = baked(pos[0], pos[1]);
        const px = dest.x + (b.x - r.win.sx) * r.win.z, py = dest.y + (b.y - r.win.sy) * r.win.z;
        if (px >= dest.x && px < dest.x + dest.w && py >= dest.y && py < dest.y + dest.h) { ring(c, px, py, 6 + ((ui.t >> 4) % 2) * 2, CAT_COL[e.cat] || K.amber); R(c, px - 1, py - 1, 3, 3, CAT_COL[e.cat] || K.amber); }
      }
    },
    async act(ui, row) {
      if (!row) return;
      if (row.filter) { ui.tlFilter = (num(ui.tlFilter, 0) + 1) % FILTERS.length; ui.ls().i = 0; ui.dirty(); return; }
      if (row.ev && row.ev.where && ui.data.rows[row.ev.where] && ui.data.rows[row.ev.where].real) { const k = await ui.pick({ title: row.ev.date, lines: [row.ev.text], items: [{ label: `${ui.data.rows[row.ev.where].short}のページを見る`, sub: '国々のタブ' }, { label: 'もどる' }], w: 500 }); if (k === 0) { ui.sel = row.ev.where; ui.gotoCountry(row.ev.where); } }
    },
  };
  // ---------------------------------------------------------------- ニュース (list + detail)
  const TAB_NEWS = {
    id: 'news', label: 'ニュース', icon: 'news',
    rows(ui) {
      const w = ui.data.w;
      const out = [{ header: true, label: '世界のニュース' }];
      for (const n of w.news.slice(0, 40)) { const d = has(ui.g, 'gameDate') ? safe(() => ui.g.gameDate(n.day), null) : null; out.push({ key: 'n' + out.length, label: String(n.text).replace(/^【[^】]*】/, ''), right: d ? `${d.month}月` : '', rightColor: K.faint, news: n, date: d ? `${d.year}年${d.month}月` : `${n.day}日目` }); }
      if (!w.news.length) out.push({ key: 'none', label: '（まだニュースはない）' });
      out.push({ header: true, label: '首脳会議の予定' });
      for (const s0 of w.summits) out.push({ key: 's' + out.length, label: s0.name, right: `${s0.year}/${s0.month}`, rightColor: K.cyan, summit: s0 });
      return out;
    },
    draw(ui, c) {
      drawList(ui, c, LIST);
      const row = ui.curRow();
      if (row && row.summit) {
        const s0 = row.summit;
        panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, s0.name, { icon: 'hand', accent: K.cyan });
        let y = DETAIL.y + 24;
        T(c, `${s0.year}年${s0.month}月`, DX, y, 18, K.text); y += 26;
        if (s0.hostName) { T(c, `開催：${s0.hostName}`, DX, y, 12, K.text, 'left', DW); y += 18; }
        para(c, ui.data.role.kind === 'pm' ? '総理として出席する。議題（経済・安全保障・気候・地域の危機…）を選び、各国首脳と会談できる。成果は国際的な信頼と各国との関係に表れる。' : '日本の総理が出席する。あなたが総理なら、議題を選んで会議にのぞむ。', DX, y + 4, DW, 12, K.dim, 16, 6);
        return;
      }
      const n = row && row.news;
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, n ? row.date : 'ニュース', { icon: 'news' });
      if (!n) return;
      let y = DETAIL.y + 26;
      const tag = (String(n.text).match(/^【([^】]*)】/) || [])[1];
      if (tag) { chip(c, DX, y, tag, tag === '速報' ? K.bad : K.amber); y += 20; }
      y += para(c, String(n.text).replace(/^【[^】]*】/, ''), DX, y, DW, 14, K.text, 20, 8) + 8;
      if (n.kind === 'real') T(c, '実際の世界の出来事', DX, y, 10, K.cyan);
    },
    act: (ui, row) => (row && row.news ? ui.info('ニュース', [row.news.text]) : null),
  };
  return { drawMapStrip, drawCountryDetail, drawCrisisDetail, drawConflictDetail, TAB_REGIONS, TAB_TRENDS, TAB_TIMELINE, TAB_NEWS, optionsBox, KIND_NAME, APPLY };
}
