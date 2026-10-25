// 世界情勢 (world_ui): the HD screen of the world-affairs core (js/engine/world.js) and the phone app 「世界」.
// Only CALLS the cores' g.* APIs: world.js (g.world, g.worldCountry, g.diplomacy*, …), regime.js (g.war, g.warOrders,
// g.warOrder, g.warPaths, g.regimeSteps, g.regimeStep, g.regimeFlush) — all feature-detected.
//
// The screen (640x360, scene flags hd / opaque / hidesHud / isWorldUI): tabs 地図 · 国々 · 外交 · 貿易・関税 ·
// 同盟・条約 · 危機・戦争 · ニュース, a news ticker at the bottom. (Round 5: 外交 = the report rows (通信簿・外務省の助言・来日する
// 要人・交渉・国会審議・領土・ソフトパワー・世論・姿勢・年表) + the actions; 貿易・関税 = Japan's tariffs by category, partners,
// 貿易摩擦, tariff laws in the Diet, EPA / 関税交渉 with the negotiation screen.) The map is a pixel-art world (Natural Earth data, public domain,
// rasterised to 2.5° cells, Pacific-centred as Japanese maps are), coloured by the relation with Japan, by bloc or by
// alliance; capitals, crises, conflicts, the territorial disputes and the fictional ヴェルミナ海 (inset) are marked.
// Every action shows its odds, costs and consequences before it is taken; a locked one says why and the path.
// Keys: ←→ tabs (on the tab bar), ↓/A into the body, ↑↓ (←→ on the map) choose, A act, B back, MENU close.
// Taps: tabs, ×, list rows (first tap selects, second acts), map markers, the map's colour chips, modal buttons.
//
// Round 9 (R9-E): 10 tabs with icons (地図 · 国々 · 地域 · 外交 · 貿易 · 同盟 · 危機 · 推移 · 年表 · ニュース); the map has views
// (世界 / 東アジア / 東南アジア / 中東 / 欧州), status icons and a tooltip (world_ui_map.js); the detail pages show できること with odds and
// effects, crisis stages and charts (world_ui_more.js, world_uikit.js); 「大きな文字」 = a one-pane big-text layout (default on portrait
// phones), and on a portrait phone the bottom screen shows the detail in large type (world_ui_sub.js). See test-output/api_r9e.txt.
// API: g.worldScreen(tab?, opts?) → Promise (resolves when closed); openWorldScreen(g, { tab, sel, view });
//   tab: 'map' | 'countries' | 'regions' | 'diplomacy' | 'trade' | 'alliances' | 'crisis' | 'trends' | 'timeline' | 'news'. Under g.auto it does not open unless
//   g.auto.worldui. Phone app 'world' (「世界」, order 61). Test hook: window.__worldui = { scene(), open, TABS }.

import { Game } from './game.js';
import { SW, SH, clamp } from './util.js';
import { measure } from './draw.js';
import { registerPhoneApp } from './life.js';
import { phoneList, phoneInfo, appTile } from './phone.js';
// [R9-E] the drawing parts, the map and the new tabs live in their own modules
import { K, R, T, num, safe, has, sfx, n0, fit, jwrap, para, panel, gauge, relColor, relText, bar, sparkline, icon, chip } from './world_uikit.js';
import { MAP, MODES, VIEWS, grid, project, drawMapView } from './world_ui_map.js';
import { makeMore } from './world_ui_more.js';
import { SubScreen, subScreenWanted } from './world_ui_sub.js';
void fit; void gauge; void chip;
// troops given in 千人 → 「約1.6万人」 / 「約8,000人」
const troops = (k) => (num(k) >= 10 ? `約${(Math.round(num(k)) / 10).toFixed(1).replace(/\.0$/, '')}万人` : `約${n0(num(k) * 1000)}人`);
// portrait phones: the 640x360 screen is about 412x232 CSS px; the big-text layout (one pane at a time) is used there
function portraitView() { try { return typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.2; } catch (e) { return false; } }

// ================================================================ data
function roleOf(g) {
  try {
    const p = g.pol();
    const posts = (p && p.me && p.me.posts) || [];
    if (posts.includes('pm')) return { kind: 'pm', label: '内閣総理大臣' };
    if (posts.includes('minister_foreign')) return { kind: 'fm', label: '外務大臣' };
    if (posts.includes('minister_defense')) return { kind: 'dm', label: '防衛大臣' };
    if (p && p.me && (p.me.office === 'shugi' || p.me.office === 'sangi')) return { kind: 'member', label: '国会議員' };
  } catch (e) { /* no politics */ }
  return { kind: 'citizen', label: '市民' };
}
function loadData(ui) {
  const g = ui.g;
  const w = safe(() => g.world(), null);
  if (!w) return { ok: false };
  const rows = {};
  for (const c of [...w.countries, ...(w.fictional || [])]) rows[c.id] = c;
  const d0 = has(g, 'gameDate') ? safe(() => g.gameDate(), null) : null;
  const dn = d0 ? d0.year * 10000 + d0.month * 100 + d0.dom : 20260401;
  const war = has(g, 'war') ? safe(() => g.war(), null) : null;
  return {
    ok: true, w, rows, dn, war, role: roleOf(g),
    orders: has(g, 'warOrders') ? safe(() => g.warOrders(), []) : [],
    paths: has(g, 'warPaths') ? safe(() => g.warPaths(), null) : null,
    life: has(g, 'regimeLifeOver') ? safe(() => g.regimeLifeOver(), null) : null,
    markers: w.countries.filter((c) => c.pos).map((c) => ({ id: c.id, ...project(c.pos[0], c.pos[1]) })),
  };
}

// ================================================================ tabs
// Each tab: { id, label, rows(ui) → [{ key, label, sub?, right?, rightColor?, color?, header?, lock? }], draw(ui, c), act(ui, row) }
const LIST = { x: 4, y: 42, w: 248, h: 292, rh: 18 };
const DETAIL = { x: 256, y: 42, w: 380, h: 292 };
const MORE = makeMore({ drawList: (...a) => drawList(...a), LIST, DETAIL, actionsMenu: (...a) => actionsMenu(...a), diploFlow: (...a) => diploFlow(...a) }); // [R9-E]
function countryRows(ui) {
  const d = ui.data;
  const real = d.w.countries.slice().sort((a, b) => b.relation - a.relation);
  const out = [{ header: true, label: `国々（${real.length}）` }];
  for (const c of real) out.push({ key: c.id, label: c.name, right: `${c.relation}`, rightColor: relColor(c.relation), sub: c.war ? '戦争中' : !c.ties ? `国交：${c.tiesLabel}` : c.ally ? '同盟・協力' : c.sanction ? `制裁 段階${c.sanction}` : '' });
  if ((d.w.fictional || []).length) { out.push({ header: true, label: 'ヴェルミナ海の国々' }); for (const c of d.w.fictional) out.push({ key: c.id, label: c.name, right: `${c.relation}`, rightColor: relColor(c.relation), sub: c.war ? '戦争中' : '' }); }
  return out;
}
// the 地図 tab: the map with views (世界 / 東アジア / 東南アジア / 中東 / 欧州), colour modes, status icons, the tooltip,
// the ヴェルミナ海 inset and the strip of the selected country below
const MAPR = { x: MAP.X, y: MAP.Y, w: MAP.COLS * MAP.CELL, h: MAP.ROWS * MAP.CELL };
const INSET = { x: MAP.X + 4, y: MAP.Y + 146, w: 100 };
const insetPts = (fl) => (fl || []).map((f, i) => ({ id: f.id, x: INSET.x + 10, y: INSET.y + 22 + i * 13 }));
function drawMapChips(ui, c, dest, size = 10) {
  ui.chips = [];
  const h = size + 6;
  // the views (top left)
  let x = dest.x + 3;
  for (const v of VIEWS) {
    const w = measure(c, v.label, size) + 10, on = (ui.mapView || 'world') === v.id;
    R(c, x, dest.y + 3, w, h, on ? K.cyan : 'rgba(10,20,34,0.85)');
    T(c, v.label, x + w / 2, dest.y + 6, size, on ? K.ink : K.text, 'center');
    ui.chips.push({ x, y: dest.y + 3, w, h, view: v.id });
    x += w + 3;
  }
  // the colour modes (top right)
  MODES.forEach((m, i) => {
    const w = measure(c, m.label, size) + 14, xx = dest.x + dest.w - 4 - (MODES.length - i) * (w + 3);
    const on = ui.mode === m.id;
    R(c, xx, dest.y + 3, w, h, on ? K.amber : 'rgba(10,20,34,0.85)');
    T(c, m.label, xx + w / 2, dest.y + 6, size, on ? K.ink : K.text, 'center');
    ui.chips.push({ x: xx, y: dest.y + 3, w, h, id: m.id });
  });
}
function drawMapLegend(ui, c, dest, size = 10) {
  const d = ui.data;
  const leg = ui.mode === 'bloc' ? Object.values(d.w.blocs).map((b) => [b.color, b.short]) : ui.mode === 'alliance' ? [['#4f8fe8', '同盟・協力'], ['#c07040', '日本が制裁'], ['#a05050', '日本に制裁'], ['#5a6270', 'その他']] : [['#3aa86a', '良好'], ['#7cbc62', 'まずまず'], ['#c4b46a', 'ふつう'], ['#d07a46', '冷えこみ'], ['#c63c3c', '険悪']];
  const items = [...leg, ['icon:crisis', '危機'], ['icon:war', '戦争'], ['icon:dispute', '領土問題']];
  const ws = items.map(([, lab]) => measure(c, lab, size) + 16);
  const tw = ws.reduce((a, v) => a + v, 0) + 6;
  let lx = dest.x + dest.w - tw - 4;
  const ly = dest.y + dest.h - size - 8;
  R(c, lx - 3, ly - 2, tw + 2, size + 6, 'rgba(6,14,26,0.82)');
  items.forEach(([col, lab], i) => {
    if (col.startsWith('icon:')) { const id = col.slice(5); icon(c, id, lx, ly + Math.round((size - 9) / 2) + 1, 1, id === 'war' ? K.bad : K.warn); }
    else R(c, lx, ly + 2, 8, 8, col);
    T(c, lab, lx + 11, ly, size, K.text);
    lx += ws[i];
  });
}
function drawInset(ui, c) {
  const d = ui.data;
  const fx = INSET.x, fy = INSET.y;
  R(c, fx, fy, INSET.w, 58, 'rgba(6,14,26,0.88)'); R(c, fx, fy, INSET.w, 1, K.edge);
  T(c, 'ヴェルミナ海', fx + 4, fy + 2, 10, K.dim);
  (d.w.fictional || []).forEach((f, i) => { const sy = fy + 16 + i * 13; R(c, fx + 6, sy + 2, 8, 8, relColor(f.relation)); if (f.war && Math.floor(ui.t / 15) % 2) R(c, fx + 6, sy + 2, 8, 8, K.bad); T(c, f.short, fx + 18, sy, 10, ui.sel === f.id ? K.amber : K.text, 'left', INSET.w - 46); T(c, `${f.relation}`, fx + INSET.w - 6, sy, 10, relText(f.relation), 'right'); if (ui.sel === f.id) R(c, fx + 2, sy + 4, 2, 4, K.amber); });
}
const TAB_MAP = {
  id: 'map', label: '地図', icon: 'globe',
  rows: () => [],
  draw(ui, c) {
    const view = ui.mapView || 'world';
    const r = drawMapView(ui, c, MAPR, view, { labels: view !== 'world', regions: view === 'world', icons: true });
    ui.mapPts = view === 'world' ? [...r.pts, ...insetPts(ui.data.w.fictional)] : r.pts;
    if (view === 'world') drawInset(ui, c);
    drawMapChips(ui, c, MAPR);
    drawMapLegend(ui, c, MAPR);
    MORE.drawMapStrip(ui, c, 4, 258, 632, 76);
  },
};
const TAB_COUNTRIES = {
  id: 'countries', label: '国々', icon: 'flag',
  rows: (ui) => countryRows(ui),
  draw(ui, c) {
    drawList(ui, c, LIST);
    const row = ui.curRow();
    if (row && row.key) MORE.drawCountryDetail(ui, c, row.key); else panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '国々');
  },
  act: (ui, row) => (row && row.key ? actionsMenu(ui, row.key) : null),
};
const GLOBAL_DIPLO = ['dispute_action', 'ally_up', 'ally_down', 'withdraw_notice', 'abrogate', 'peace_conf', 'un_speech', 'unsc_run', 'leave_un', 'rejoin_un'];
const TAB_DIPLOMACY = {
  id: 'diplomacy', label: '外交',
  rows(ui) {
    const g = ui.g;
    const out = [{ header: true, label: `${ui.data.role.label}としてできること` }];
    out.push({ key: 'pick', label: '相手の国を選んで外交する', sub: '首脳会談・外遊・条約・制裁・援助…', right: '▶' });
    out.push({ key: 'declare', label: '宣戦布告（相手を選ぶ）', sub: '戦争への道と見込み', right: '▶', color: K.danger });
    for (const id of GLOBAL_DIPLO) {
      const pv = has(g, 'diplomacyPreview') ? safe(() => g.diplomacyPreview(id, null), null) : null;
      if (!pv) continue;
      out.push({ key: 'g:' + id, label: pv.name, lock: pv.why, right: pv.why ? '🔒' : pv.odds != null ? `${Math.round(pv.odds * 100)}%` : '○', sub: pv.why ? pv.why : pv.lines[0] || '', pv });
    }
    for (const o of ui.data.w.offers || []) out.push({ key: 'o:' + o.treaty, label: `交渉が妥結：${o.name}`, sub: '署名する／見送る', right: '!', rightColor: K.warn });
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const row = ui.curRow();
    const d = ui.data;
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, row && row.pv ? row.label : '外交の概況');
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 20;
    if (row && row.pv) {
      y += para(c, row.pv.desc, x, y, DETAIL.w - 16, 12, K.text, 16, 3) + 4;
      for (const l of row.pv.lines) y += para(c, `・${l}`, x, y, DETAIL.w - 16, 10, K.text, 13, 3);
      if (row.pv.odds != null) { T(c, `成功の見込み ${Math.round(row.pv.odds * 100)}%`, x, y + 4, 12, K.amber); y += 20; }
      if (row.lock) para(c, `🔒 ${row.lock}`, x, y + 4, DETAIL.w - 16, 10, K.lock, 13, 6);
      return;
    }
    // the overview
    const w = d.w;
    T(c, `国際的な信頼 ${w.standing}／100　世界の緊張 ${w.tension}（${w.tensionLabel}）`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 18;
    T(c, `原油価格（指数）${w.oil}　日本への脅威 ${w.threat}／100`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 18;
    T(c, `安保理：${w.unsc.member ? '非常任理事国（任期中）' : w.unsc.candidate ? '立候補中' : '理事国ではない'}　${w.unsc.member ? '' : w.unsc.nextText}`, x, y, 10, K.dim, 'left', DETAIL.w - 16); y += 16;
    T(c, '次の首脳会議', x, y, 10, K.amber); y += 14;
    for (const s0 of w.summits.slice(0, 4)) { T(c, `${s0.year}年${s0.month}月　${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`, x + 6, y, 10, K.text, 'left', DETAIL.w - 22); y += 13; }
    y += 4;
    T(c, '最近の共同声明', x, y, 10, K.amber); y += 14;
    for (const st of w.statements.slice(0, 3)) { T(c, `${st.withName}「${st.label}」`, x + 6, y, 10, K.text, 'left', DETAIL.w - 22); y += 13; }
    if (!w.statements.length) { T(c, 'まだない', x + 6, y, 10, K.faint); y += 13; }
    y += 4;
    para(c, d.role.kind === 'pm' ? '総理はすべての外交の手段を使える。首脳会談は相手国の首脳と、外遊は相手国を訪ねて。成功の見込みは関係・国際的な信頼・制裁で変わる。' : d.role.kind === 'fm' ? '外務大臣は外相会談・外遊・経済連携・援助・抗議・大使の召還などを担う。首脳会談・制裁・同盟・戦争は総理が決める。' : d.role.kind === 'dm' ? '防衛大臣は防衛協力の協定、後方支援、在外邦人の退避、同盟の強化を担う。' : '外交は総理・外務大臣・防衛大臣が行う。いまは見ることだけができる（危機の募金はだれでもできる）。', x, y, DETAIL.w - 16, 10, K.dim, 13, 5);
  },
  async act(ui, row) {
    if (!row) return;
    if (row.key === 'pick') { const id = await pickCountry(ui, '外交の相手'); if (id) await actionsMenu(ui, id); return; }
    if (row.key === 'declare') { await declareFlow(ui); return; }
    if (row.key.startsWith('g:')) { await diploFlow(ui, row.key.slice(2), null); return; }
    if (row.key.startsWith('o:')) { const t = row.key.slice(2); const k = await ui.confirm({ title: '交渉の妥結', lines: [`${row.label.replace('交渉が妥結：', '')}に署名し、国会の承認を求める？`], choices: ['署名する', '見送る', 'あとで'] }); if (k === 0 || k === 1) await ui.info('協定', [safe(() => ui.g.worldOffer(t, k === 0), '') || '']); }
  },
};
const TAB_ALLIANCES = {
  id: 'alliances', label: '同盟', icon: 'shield',
  rows(ui) {
    const w = ui.data.w;
    const out = [{ header: true, label: '日本の同盟・安全保障の協力' }];
    for (const a of w.alliances.filter((x) => x.japan)) out.push({ key: 'a:' + a.id, label: a.name, right: a.strength != null ? `${a.strength}` : '', sub: a.notice ? '終了を通告中' : { defense: '相互防衛', partnership: '協力の枠組み', collective: '集団防衛' }[a.kind] || '', a });
    out.push({ header: true, label: '日本の条約・協定' });
    for (const t of w.treaties) out.push({ key: 't:' + t.id, label: t.name, sub: { ties: '国交', peace: '平和条約', fta: '経済連携', security: '安全保障', declaration: '宣言', alliance: '同盟' }[t.kind] || '', t });
    const dietL = (safe(() => ui.g.dietTreaties(), []) || []).filter((d) => d.status === 'open' && d.kind === 'treaty');
    if (dietL.length) { out.push({ header: true, label: '国会で審議中の条約' }); for (const d of dietL) out.push({ key: 'd:' + d.id, label: d.name, right: d.stageShort, rightColor: K.warn, d }); }
    out.push({ header: true, label: '制裁' });
    for (const x of w.sanctions.byJapan) out.push({ key: 's:' + x.id, label: `日本 → ${x.name}`, right: `段階${x.level}`, rightColor: K.warn, sub: x.g7 ? 'G7と協調' : x.un ? '国連の制裁に参加' : '日本の判断' });
    for (const x of w.sanctions.onJapan) out.push({ key: 'r:' + x.id, label: `${x.name} → 日本`, right: `段階${x.level}`, rightColor: K.bad, sub: x.war ? '戦争への制裁' : '対抗措置' });
    if (!w.sanctions.byJapan.length && !w.sanctions.onJapan.length) out.push({ key: 'none', label: '（いまはない）' });
    out.push({ header: true, label: '世界の同盟' });
    for (const a of w.alliances.filter((x) => !x.japan)) out.push({ key: 'w:' + a.id, label: a.name, sub: (a.members || []).length + 'か国', a });
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const row = ui.curRow();
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, row && !row.header ? row.label : '同盟・条約', { right: row && row.a && row.a.id === 'anpo' ? 'A：強化・見直し・破棄' : '' });
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 22;
    const names = (ids) => (ids || []).map((id) => (id === 'jp' ? '日本' : (ui.data.rows[id] || {}).short || id)).join('・');
    const contents = (id) => {
      const ti = safe(() => ui.g.treatyInfo(id), null);
      if (!ti) return;
      const wd = DETAIL.w - 16;
      T(c, '得るもの', x, y, 10, K.good); y += 13;
      for (const l of ti.gives.slice(0, 4)) y += para(c, `・${l}`, x + 4, y, wd - 4, 10, K.text, 13, 2);
      y += 3; T(c, '負うもの・課題', x, y, 10, K.warn); y += 13;
      for (const l of ti.costs.slice(0, 4)) y += para(c, `・${l}`, x + 4, y, wd - 4, 10, K.text, 13, 2);
    };
    if (row && row.d) { drawDietItem(ui, c, row.d); return; }
    if (row && row.a) {
      const a = row.a;
      T(c, `加盟：${names(a.members)}`, x, y, 12, K.text, 'left', DETAIL.w - 16); y += 16;
      if (a.strength != null) { T(c, `同盟の強さ ${a.strength}／100`, x, y, 12, K.cyan); R(c, x + 130, y + 4, 200, 6, '#1a2a3a'); R(c, x + 130, y + 4, 2 * a.strength, 6, K.cyan); y += 16; }
      if (a.notice) { T(c, '終了を通告中（通告から1年で終了）', x, y, 12, K.bad); y += 16; }
      if (a.id === 'anpo') contents('anpo'); else para(c, a.desc || '', x, y, DETAIL.w - 16, 12, K.text, 16, 8);
    } else if (row && row.t) {
      T(c, `相手：${names(row.t.with)}　${row.t.by === 'history' ? 'ゲームの始まる前から' : row.t.by === 'npc' ? '政府が結んだ' : row.t.since > 0 ? `${row.t.since}日目に結んだ` : ''}`, x, y, 10, K.dim, 'left', DETAIL.w - 16); y += 16;
      contents(row.t.id);
    } else para(c, '日米安保条約は、総理（防衛大臣）が強化・見直しでき、総理は破棄（終了の通告）もできる。同盟は戦争のとき援軍になる一方、相手の戦争に巻きこまれることもある。', x, y, DETAIL.w - 16, 12, K.dim, 16, 8);
  },
  async act(ui, row) {
    if (!row) return;
    if (row.a && row.a.id === 'anpo') { const k = await ui.pick({ title: '日米安保条約', items: ['ally_up', 'ally_down', 'abrogate', 'withdraw_notice'].map((id) => { const pv = safe(() => ui.g.diplomacyPreview(id, null, id === 'abrogate' ? { treaty: 'anpo' } : {}), null) || { name: id }; return { label: pv.name, sub: pv.why || (pv.lines || [])[0] || '', lock: pv.why, id }; }) }); if (k == null || k < 0) return; const id = ['ally_up', 'ally_down', 'abrogate', 'withdraw_notice'][k]; await diploFlow(ui, id, null, id === 'abrogate' ? { treaty: 'anpo' } : {}); return; }
    if (row.t && ['fta', 'security', 'alliance', 'peace'].includes(row.t.kind)) { await diploFlow(ui, 'abrogate', null, { treaty: row.t.id }); return; }
    if (row.key.startsWith('s:')) { await diploFlow(ui, 'lift', row.key.slice(2)); }
  },
};
const TAB_CRISIS = {
  id: 'crisis', label: '危機', icon: 'crisis',
  rows(ui) {
    const d = ui.data;
    const out = [];
    if (d.war) {
      out.push({ header: true, label: `戦争：${d.war.enemyShort}（${d.war.modeName}）` });
      for (const o of d.orders) out.push({ key: 'w:' + o.id, label: o.name, lock: o.why, right: o.why ? '🔒' : '▶', sub: o.why || '', order: o, color: ['declare', 'surrender'].includes(o.id) ? K.danger : null });
    } else {
      out.push({ header: true, label: '戦争への道' });
      out.push({ key: 'declare', label: '宣戦布告（相手を選ぶ）', right: '▶', color: K.danger, sub: d.paths && d.paths.declare ? '条件と道を見る' : '' });
      out.push({ key: 'steps', label: '体制・憲法の手続き', right: '▶', sub: '9条の改正・緊急事態など' });
      for (const o of d.orders.filter((x) => x.id === 'front_go' || x.id === 'front_return')) out.push({ key: 'w:' + o.id, label: o.name, lock: o.why, right: o.why ? '🔒' : '▶', order: o });
    }
    out.push({ header: true, label: `世界の危機（${d.w.crises.length}）` });
    for (const k of d.w.crises) out.push({ key: 'k:' + k.id, label: k.title, sub: k.countryName || '', right: k.stage ? k.stage.label : '▶', rightColor: num(k.sev) >= 3 ? K.bad : num(k.sev) >= 2 ? K.warn : K.dim, k });
    if (!d.w.crises.length) out.push({ key: 'none', label: '（いまは大きな危機はない）' });
    out.push({ header: true, label: `各地の紛争（${d.w.conflicts.length}）` });
    for (const k of d.w.conflicts) out.push({ key: 'c:' + k.id, label: k.name, sub: k.japan ? '日本が関わっている' : '', right: k.japan ? '日本も' : '戦争', rightColor: K.bad, conflict: k });
    if (!d.w.conflicts.length) out.push({ key: 'none2', label: '（いまはない）' });
    if (d.w.deployments.length) { out.push({ header: true, label: `自衛隊の海外派遣（${d.w.deployments.length}）` }); for (const x of d.w.deployments) out.push({ key: 'd:' + x.id, label: x.mission, sub: x.where, right: '派遣中', rightColor: K.blue, dep: x }); }
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const d = ui.data;
    const row = ui.curRow();
    if (d.war) { drawWar(ui, c, row); return; }
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, row && !row.header ? row.label : '危機・戦争');
    const x = DETAIL.x + 8;
    let y = DETAIL.y + 22;
    if (row && row.k) { MORE.drawCrisisDetail(ui, c, row.k); return; }
    if (row && row.conflict) { MORE.drawConflictDetail(ui, c, row.conflict); return; }
    if (row && row.dep) {
      const dp = row.dep;
      T(c, dp.where, x, y, 14, K.text, 'left', DETAIL.w - 16); y += 22;
      for (const [k0, v0] of [['任務', dp.mission], ['人数', dp.personnel ? `約${n0(dp.personnel)}人` : '—'], ['根拠', dp.law || '—'], ['終わり', dp.endDate ? `${Math.floor(dp.endDate / 10000)}年${Math.floor(dp.endDate / 100) % 100}月の予定` : '決まっていない']]) { T(c, k0, x, y, 12, K.dim); y += para(c, v0, x + 54, y, DETAIL.w - 70, 12, K.text, 16, 3) + 2; }
      return;
    }
    if (d.paths) {
      const P = d.paths;
      y += para(c, P.declare ? `宣戦：${P.declare}` : '宣戦できる状態（相手を選ぶ）。', x, y, DETAIL.w - 16, 12, P.declare ? K.lock : K.good, 16, 8) + 6;
      if (P.art9) { T(c, '9条は改正ずみ：国会の承認で宣戦できる', x, y, 10, K.good, 'left', DETAIL.w - 16); y += 14; }
      if (P.amend9 && P.amend9.stage === 'referendum') { T(c, `9条の改正：国民投票を待っている（見込み 賛成${P.referendum9.yes}%）`, x, y, 10, K.warn, 'left', DETAIL.w - 16); y += 14; }
      if (P.collective) { T(c, `集団的自衛権の根拠：${P.collective}`, x, y, 10, K.cyan, 'left', DETAIL.w - 16); y += 14; }
      if (P.attack) { T(c, '武力攻撃事態：防衛出動を命じられる', x, y, 10, K.bad, 'left', DETAIL.w - 16); y += 14; }
      if (P.breakaway) { y += para(c, `（${P.breakaway}。実在の政党は戦争を決めない：進めると、党を離れて新党を結成する場面になる）`, x, y, DETAIL.w - 16, 10, K.dim, 13, 3); }
      T(c, `国会が宣戦を承認する見込み（改正後）：${Math.round(num(P.dietOdds) * 100)}%`, x, y + 4, 10, K.dim, 'left', DETAIL.w - 16);
    }
  },
  async act(ui, row) {
    if (!row) return;
    if (row.key === 'declare') { await declareFlow(ui); return; }
    if (row.key === 'steps') { await stepsFlow(ui); return; }
    if (row.key.startsWith('w:')) { await warFlow(ui, row.order); return; }
    if (row.key.startsWith('k:')) { await actionsMenu(ui, 'k:' + row.k.id, row.k.title); return; }
    if (row.key.startsWith('c:')) { await actionsMenu(ui, 'c:' + row.conflict.id, row.conflict.name); }
  },
};
function drawWar(ui, c, row) {
  const w = ui.data.war;
  const x0 = DETAIL.x, y0 = DETAIL.y;
  panel(c, x0, y0, DETAIL.w, 128, `${w.enemyName}との戦争（${ui.g.state.day - w.start}日目）`, { accent: K.danger, right: w.frontText });
  w.fronts.forEach((f, i) => {
    const y = y0 + 20 + i * 18;
    T(c, f.name, x0 + 6, y, 10, K.text, 'left', 130);
    const bx = x0 + 140, bw = 120;
    R(c, bx, y + 3, bw, 6, '#1a2a3a'); R(c, bx + bw / 2, y + 1, 1, 10, K.dim);
    const p = bx + bw / 2 + (clamp(f.control, -100, 100) / 100) * (bw / 2);
    R(c, Math.min(p, bx + bw / 2), y + 3, Math.abs(p - (bx + bw / 2)), 6, f.control >= 0 ? K.cyan : K.bad);
    T(c, `兵力 ${troops(f.own)}`, x0 + 268, y, 10, K.dim, 'left', 80);
    T(c, `${f.odds}%`, x0 + DETAIL.w - 8, y, 10, f.odds >= 50 ? K.good : K.warn, 'right');
  });
  let y = y0 + 22 + w.fronts.length * 18;
  T(c, `死者 兵士${n0(w.cas.soldiers.dead)}人・民間人${n0(w.cas.civilians.dead)}人　相手側 ${n0(w.cas.enemySoldiers + w.cas.enemyCivilians)}人`, x0 + 6, y, 10, K.text, 'left', DETAIL.w - 12); y += 13;
  T(c, `予備 ${troops(w.reserve)}・動員 段階${w.mob}・厭戦 ${Math.round(w.weariness)}・戦費 約${w.cost}兆円`, x0 + 6, y, 10, K.dim, 'left', DETAIL.w - 12); y += 13;
  T(c, `${w.allies.length ? `味方：${w.allies.map((a) => a.name).join('・')}　` : ''}${w.foes.length ? `相手側：${w.foes.map((a) => a.name).join('・')}` : ''}` || '同盟国の参戦はない', x0 + 6, y, 10, K.cyan, 'left', DETAIL.w - 12);
  // the people the player knows / the player
  const y2 = y0 + 132;
  panel(c, x0, y2, DETAIL.w, 74, '知っている人・自分', { right: w.player ? `前線（1日の危険 約${w.player.risk}%）` : '' });
  const ST = { front: '前線', called: '召集', wounded: '負傷', kia: '戦死', exempt: '免除', back: '帰還' };
  (w.known || []).slice(0, 4).forEach((k, i) => { T(c, `${k.rel}の${k.name}（${k.unit}）`, x0 + 6, y2 + 19 + i * 13, 10, k.status === 'kia' ? K.bad : K.text, 'left', 250); T(c, ST[k.status] || k.status, x0 + DETAIL.w - 8, y2 + 19 + i * 13, 10, k.status === 'kia' ? K.bad : K.dim, 'right'); });
  if (!(w.known || []).length) T(c, '（いない）', x0 + 6, y2 + 19, 10, K.faint);
  // the selected order
  const y3 = y2 + 78;
  panel(c, x0, y3, DETAIL.w, DETAIL.y + DETAIL.h - y3, row && row.order ? row.order.name : '戦況の記録');
  if (row && row.order) para(c, row.order.why ? `🔒 ${row.order.why}` : row.order.desc, x0 + 6, y3 + 19, DETAIL.w - 12, 10, row.order.why ? K.lock : K.text, 13, 5);
  else (w.log || []).slice(-5).reverse().forEach((l, i) => T(c, `・${l.text}`, x0 + 6, y3 + 19 + i * 13, 10, K.dim, 'left', DETAIL.w - 12));
}
// ================================================================ 貿易・関税 (trade and tariffs) and the richer 外交 tab
const shortCat = (n) => String(n).replace(/（.*$/, '');
const sgn = (v, d = 2) => `${num(v) >= 0 ? '+' : ''}${num(v).toFixed(d)}`;
const pc = (p) => `${Math.round(num(p) * 100)}%`;
const DIRCOL = { up: '#ff9a5a', down: '#5ad2e8', same: '#93a8bc' };
const KIND_JA = { epa: '経済連携協定', tariffs: '関税交渉', security: '防衛協力の協定', peace: '平和条約' };
const TAB_TRADE = {
  id: 'trade', label: '貿易', icon: 'money',
  rows(ui) {
    const g = ui.g;
    const t = safe(() => g.tariffs(), null);
    ui.trade = t;
    if (!t) return [{ header: true, label: '貿易・関税' }, { key: 'none', label: '（貿易の仕組みが読み込まれていない）' }];
    const out = [{ header: true, label: '概況' }];
    out.push({ key: 'over', label: '貿易と関税の概況', right: `関税収入 約${t.revenue.total}兆円` });
    out.push({ header: true, label: '日本の輸入関税（品目別）' });
    for (const c of t.cats) out.push({ key: 'c:' + c.id, label: shortCat(c.name), right: c.rateText.replace(/（.*$/, ''), rightColor: DIRCOL[c.dir], c });
    out.push({ header: true, label: '貿易相手と関税の応酬' });
    for (const p of t.partners) {
      const st = p.war > 0 ? p.warLabel : p.treaties.length ? 'EPA' : p.theirs.some((x) => x.add > 0.5) ? '相手が関税' : '';
      out.push({ key: 'p:' + p.pk, label: p.name, right: st || `関係${p.rel}`, rightColor: p.war > 1 ? K.bad : p.war > 0 ? K.warn : p.treaties.length ? K.cyan : K.dim, p });
    }
    const open = t.frictions.filter((f) => f.status === 'open');
    const negos = (safe(() => g.negotiations(), []) || []).filter((n) => n.status === 'open' && (n.kind === 'epa' || n.kind === 'tariffs'));
    const diet = (safe(() => g.dietTreaties(), []) || []).filter((d) => d.status === 'open' && (d.kind === 'law' || /経済連携/.test(d.name)));
    if (open.length || t.deals.length || negos.length || diet.length) {
      out.push({ header: true, label: '進行中' });
      for (const f of open) out.push({ key: 'f:' + f.id, label: `摩擦：${f.title}`, right: `期限${f.daysLeft}日`, rightColor: f.daysLeft <= 8 ? K.bad : K.warn, f });
      for (const d of t.deals) out.push({ key: 'dl:' + d.id, label: `提案：${d.name}から関税の協議`, right: '!', rightColor: K.warn, dl: d });
      for (const n of negos) out.push({ key: 'n:' + n.id, label: `交渉：${n.name}`, right: `第${n.round}/${n.rounds}`, rightColor: K.cyan, n });
      for (const d of diet) out.push({ key: 'd:' + d.id, label: `国会：${d.name.replace(/関税定率法等の一部を改正する法律案/, '関税改正案')}`, right: '審議中', rightColor: K.dim, d });
    }
    out.push({ header: true, label: '貿易の記録' });
    for (const e of t.ledger.slice(0, 8)) out.push({ key: 'l' + out.length, label: e.text, l: e });
    if (!t.ledger.length) out.push({ key: 'none', label: '（まだ記録はない）' });
    return out;
  },
  draw(ui, c) {
    drawList(ui, c, LIST);
    const t = ui.trade;
    const row = ui.curRow();
    const x = DETAIL.x + 8;
    const wd = DETAIL.w - 16;
    if (!t) { panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '貿易・関税'); return; }
    if (row && row.c) return drawCategory(ui, c, row.c, t);
    if (row && row.p) return drawPartner(ui, c, row.p, t);
    if (row && row.f) {
      const f = row.f;
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, f.title, { accent: K.warn, right: 'A：対応を選ぶ' });
      let y = DETAIL.y + 22;
      T(c, `相手：${f.name}　品目：${f.item}`, x, y, 12, K.text, 'left', wd); y += 20;
      y += para(c, `相手の要求：${f.ask}`, x, y, wd, 12, K.text, 16, 4) + 4;
      const thr = Object.entries(f.theirs || {}).map(([e, p]) => `${({ auto: '自動車', industrial: '工業製品', steel: '鉄鋼', farm: '農水産物' })[e] || e}に${p}%`);
      y += para(c, `応じない場合：日本の${thr.join('・')}の関税を上乗せ（期限まであと${f.daysLeft}日）`, x, y, wd, 12, K.warn, 16, 3) + 6;
      para(c, '対応：閣僚協議／要求の一部を受け入れる（譲歩）／WTO（GATT）に求める／対抗措置。それぞれ見込みと国内の反応を確かめてから決める。期限まで何もしないと、相手は関税を発動する。', x, y, wd, 10, K.dim, 13, 6);
      return;
    }
    if (row && row.dl) {
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '関税の協議の提案', { accent: K.warn, right: 'A：交渉を始める／見送る' });
      para(c, row.dl.text, x, DETAIL.y + 24, wd, 12, K.text, 16, 6);
      return;
    }
    if (row && row.n) return drawNego(ui, c, row.n);
    if (row && row.d) return drawDietItem(ui, c, row.d);
    if (row && row.l) {
      panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '貿易の記録');
      para(c, row.l.text, x, DETAIL.y + 24, wd, 12, K.text, 16, 8);
      return;
    }
    // the overview
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '貿易と関税の概況', { right: `${t.date.year}年${t.date.month}月` });
    let y = DETAIL.y + 22;
    const r = t.revenue, m = t.macro, e = t.effects;
    T(c, `関税収入 約${r.total}兆円/年${r.shareOfTax != null ? `（税収の約${r.shareOfTax}%）` : ''}`, x, y, 12, K.text, 'left', wd); y += 16;
    T(c, `歴史どおりとの差 ${sgn(r.delta, 3)}兆円　品目別の最大：${r.byCat[0] ? shortCat(r.byCat[0].name) : ''}`, x, y, 10, K.dim, 'left', wd); y += 16;
    T(c, `貿易（目安）輸出 ${m.exports}兆・輸入 ${m.imports}兆　収支 ${sgn(m.balance, 1)}兆円/年${Math.abs(m.balance - m.balanceBase) > 0.04 ? `（歴史 ${sgn(m.balanceBase, 1)}）` : ''}`, x, y, 10, K.text, 'left', wd); y += 18;
    R(c, x, y, wd, 1, K.edge); y += 5;
    T(c, '政策の影響（歴史どおりの水準との差）', x, y, 10, K.amber); y += 14;
    T(c, `物価 ${sgn(e.infl)}ポイント　成長率 ${sgn(e.growth)}ポイント　貿易収支 ${sgn(e.balance, 1)}兆円`, x, y, 12, e.infl > 0.05 || e.growth < -0.05 ? K.warn : K.text, 'left', wd); y += 16;
    if (e.exportLoss) { T(c, `相手国の報復関税による輸出の減少 約${e.exportLoss}兆円/年`, x, y, 10, K.bad, 'left', wd); y += 14; }
    const gain = t.segments.filter((s0) => s0.v > 0).slice(0, 3).map((s0) => s0.name), lose = t.segments.filter((s0) => s0.v < 0).slice(0, 3).map((s0) => s0.name);
    if (gain.length || lose.length) { T(c, `${gain.length ? `歓迎：${gain.join('・')}　` : ''}${lose.length ? `反発：${lose.join('・')}` : ''}`, x, y, 10, K.text, 'left', wd); y += 14; }
    if (t.surge.length) { T(c, `輸入が急増中：${t.surge.map((s0) => s0.name).join('・')}（緊急関税の根拠になる）`, x, y, 10, K.warn, 'left', wd); y += 14; }
    y += 4; R(c, x, y, wd, 1, K.edge); y += 5;
    T(c, 'この時代の貿易', x, y, 10, K.amber); y += 14;
    for (const b of t.background.slice(0, 3)) y += para(c, `・${b}`, x, y, wd, 10, K.text, 13, 4);
    if (t.series.length > 2) { sparkline(c, DETAIL.x + DETAIL.w - 96, DETAIL.y + 22, 86, 28, t.series.map((s0) => s0.rev), K.cyan); T(c, '関税収入', DETAIL.x + DETAIL.w - 96, DETAIL.y + 52, 10, K.faint); }
  },
  async act(ui, row) {
    if (!row) return;
    const g = ui.g;
    if (row.c) { await tariffFlow(ui, row.c); return; }
    if (row.p) { await partnerMenu(ui, row.p); return; }
    if (row.f) { await frictionFlow(ui, row.f); return; }
    if (row.dl) {
      const k = await ui.pick({ title: '関税の協議の提案', lines: [row.dl.text], items: [{ label: '交渉を始める', sub: '関税交渉（ラウンドを重ねて進める）' }, { label: '見送る', sub: '関係が少し冷える' }, { label: 'もどる' }] });
      if (k === 0) { const pk = row.dl.pk; g.tradeDealAnswer(row.dl.id, true); await negoEntry(ui, 'tariffs', (ui.trade.partners.find((p) => p.pk === pk) || {}).main); }
      else if (k === 1) await ui.result('関税の協議', g.tradeDealAnswer(row.dl.id, false));
      return;
    }
    if (row.n) { await negoFlow(ui, row.n.id); return; }
    if (row.d) { await ui.info(row.d.name, [`いまの段階：${row.d.stageName}`, ...(row.d.log || []).map((l) => `・${l.text}`)]); }
  },
};
function drawCategory(ui, c, k, t) {
  const x = DETAIL.x + 8, wd = DETAIL.w - 16;
  panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, shortCat(k.name), { right: 'A：関税率を変える' });
  let y = DETAIL.y + 22;
  T(c, `いまの関税 ${k.rateText}`, x, y, 14, DIRCOL[k.dir] === DIRCOL.same ? K.text : DIRCOL[k.dir], 'left', wd); y += 18;
  T(c, `歴史どおりなら ${k.histText}　${k.boundLabel}の上限 ${k.boundText}${k.over ? '（超過）' : ''}`, x, y, 10, k.over ? K.bad : K.dim, 'left', wd); y += 14;
  if (k.effText) { T(c, `実効：${k.effText}`, x, y, 10, K.dim, 'left', wd); y += 14; }
  T(c, `輸入に占める割合 約${k.imp}%　関税収入 約${k.revenue}兆円/年　物価への影響 ${sgn(k.price)}`, x, y, 10, K.text, 'left', wd); y += 15;
  y += para(c, `守られる人：${k.who}`, x, y, wd, 10, K.text, 13, 2) + 2;
  y += para(c, `守る理由：${k.pro[0]}`, x, y, wd, 10, K.good, 13, 2);
  y += para(c, `問題点：${k.con[0]}`, x, y, wd, 10, K.warn, 13, 2) + 2;
  if (k.pending.length) { T(c, `国会に提出中：${k.pending.map((p) => p.to).join('・')}`, x, y, 10, K.cyan, 'left', wd); y += 14; }
  R(c, x, y, wd, 1, K.edge); y += 4;
  T(c, 'これまでの歴史', x, y, 10, K.amber); y += 13;
  const rem = Math.floor((DETAIL.y + DETAIL.h - y - 4) / 13);
  for (const tl of k.timeline.slice(-Math.max(2, rem - (k.note ? 3 : 0)))) { const d = `${Math.floor(tl.date / 10000) || ''}${tl.date ? '年' : ''}`; y += para(c, `${d ? d + ' ' : ''}${tl.text}`, x, y, wd, 10, K.text, 13, 2); if (y > DETAIL.y + DETAIL.h - 20) break; }
  if (k.note && y < DETAIL.y + DETAIL.h - 20) para(c, k.note, x, y + 2, wd, 10, K.dim, 13, Math.max(1, Math.floor((DETAIL.y + DETAIL.h - y - 4) / 13)));
}
function drawPartner(ui, c, p, t) {
  const x = DETAIL.x + 8, wd = DETAIL.w - 16;
  panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, `${p.name}（日本の貿易の約${p.share}%）`, { right: 'A：関税の手段' });
  let y = DETAIL.y + 22;
  T(c, `関係 ${p.rel}　${p.warLabel}${p.treaties.length ? `　協定：${p.treaties.map((n) => n.replace(/^日本・/, '').replace(/経済連携協定|包括的/g, '')).join('・')}` : ''}`, x, y, 12, p.war > 1 ? K.bad : p.war > 0 ? K.warn : K.text, 'left', wd); y += 16;
  gauge(c, x, y + 2, 170, p.rel);
  T(c, `不満の高まり ${p.grievance}`, x + 184, y - 1, 10, p.grievance > 40 ? K.bad : K.dim); bar(c, x + 262, y + 2, 100, p.grievance, 100, p.grievance > 40 ? K.bad : K.warn); y += 16;
  T(c, `${p.name}が日本の輸出品にかけている関税（歴史の水準＋追加分）`, x, y, 10, K.amber); y += 14;
  for (const th of p.theirs) {
    T(c, th.name, x + 4, y, 10, K.text, 'left', 70);
    T(c, `${th.total}%`, x + 78, y, 10, th.add > 0.4 ? K.bad : th.add < -0.4 ? K.cyan : K.text, 'left', 44);
    T(c, th.add ? `（歴史は${th.base}%・${th.add > 0 ? '追加' : '引き下げ'}${sgn(th.add, 1)}）` : th.note || '', x + 124, y, 10, K.dim, 'left', wd - 128); y += 13;
  }
  y += 3;
  T(c, '日本が科している関税', x, y, 10, K.amber); y += 14;
  if (p.extra.length) for (const e of p.extra) { T(c, `${e.name}に追加 +${e.pts}%（あと${e.days}日）`, x + 4, y, 10, K.warn, 'left', wd - 8); y += 13; } else { T(c, '追加関税はない', x + 4, y, 10, K.faint); y += 13; }
  if (p.exempt.length) { T(c, `適用除外：${p.exempt.map((k) => (k === 'all' ? '全品目' : shortCat((t.cats.find((c0) => c0.id === k) || { name: k }).name))).join('・')}`, x + 4, y, 10, K.cyan, 'left', wd - 8); y += 13; }
  y += 3;
  para(c, '手段：関税交渉（相手の関税の引き下げ）／EPA交渉／追加関税／解除／適用除外。報復の見込みと国内の反応を確かめてから決める。', x, y, wd, 10, K.dim, 13, Math.max(1, Math.floor((DETAIL.y + DETAIL.h - y - 4) / 13)));
}
function drawDietItem(ui, c, d) {
  const x = DETAIL.x + 8, wd = DETAIL.w - 16;
  panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, d.name.slice(0, 30), { right: d.inSession ? '国会は会期中' : '国会は閉会中' });
  let y = DETAIL.y + 22;
  T(c, `いまの段階：${d.stageName}`, x, y, 12, K.amber, 'left', wd); y += 18;
  if (d.estimate) { T(c, `通過の見込み ${pc(d.estimate.pass)}　衆議院の賛成 ${d.estimate.shugi != null ? Math.round(d.estimate.shugi * 100) + '%' : '—'}　参議院 ${d.estimate.sangi != null ? Math.round(d.estimate.sangi * 100) + '%' : '—'}`, x, y, 10, K.text, 'left', wd); y += 15; }
  para(c, d.kind === 'treaty' ? '条約の承認は、衆議院から先に審議。参議院が否決・30日以内に議決しなくても、衆議院の議決が国会の議決になる（憲法61条・60条）。' : '関税は法律で定める（憲法84条）。参議院が否決しても、衆議院が出席議員の3分の2以上で再可決すれば成立する（憲法59条）。', x, y, wd, 10, K.dim, 13, 3); y += 42;
  for (const l of (d.log || []).slice().reverse().slice(0, 5)) y += para(c, `・${l.text}`, x, y, wd, 10, K.text, 13, 2);
}
function drawNego(ui, c, n) {
  const x = DETAIL.x + 8, wd = DETAIL.w - 16;
  panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, n.name, { right: 'A：交渉を続ける' });
  let y = DETAIL.y + 22;
  T(c, `${n.levelName}・第${n.round}/${n.rounds}ラウンド　相手の雰囲気 ${n.mood}　合意の見込み ${pc(n.pConclude)}`, x, y, 10, K.text, 'left', wd); y += 16;
  for (const i of n.issues.slice(0, 6)) { T(c, i.name, x + 4, y, 10, K.text, 'left', 180); T(c, `日本 ${i.mine}／要求 ${i.dem}　相手 ${i.theirs}／期待 ${i.want}`, x + 190, y, 10, K.dim, 'left', wd - 194); y += 13; }
  y += 4;
  for (const l of (n.log || []).slice(-3)) y += para(c, `・${l}`, x, y, wd, 10, K.dim, 13, 2);
}
const ISSUE_HDR = ['日本の提示', '相手の約束'];
function negoModal(ui, v) {
  const m = {
    kind: 'nego', v, idx: Math.max(0, v.moves.findIndex((mv) => !mv.why)), t: 0, rects: [],
    update(ui2, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = v.moves.length;
      if (inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui2.closeModal(m, v.moves[m.idx].id); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui2.closeModal(m, null); }
    },
    tap(ui2, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (let i = 0; i < m.rects.length; i++) if (inR(tap.x, tap.y, m.rects[i])) { if (m.idx === i) ui2.closeModal(m, v.moves[i].id); else m.idx = i; return; }
      if (!inR(tap.x, tap.y, m.box)) ui2.closeModal(m, null);
    },
    draw(ui2, c) {
      const bx = 8, by = 22, bw = SW - 16, bh = 312;
      m.box = { x: bx, y: by, w: bw, h: bh };
      R(c, bx, by, bw, bh, '#0c1828'); R(c, bx, by, bw, 2, K.amber); R(c, bx, by + bh - 1, bw, 1, K.edge); R(c, bx, by, 1, bh, K.edge); R(c, bx + bw - 1, by, 1, bh, K.edge);
      T(c, v.name, bx + 10, by + 6, 12, K.amber, 'left', 360);
      T(c, `${v.levelName}　第${v.round}／${v.rounds}ラウンド${v.over ? '（回数が尽きた）' : ''}`, bx + bw - 10, by + 7, 10, K.dim, 'right', 240);
      // the issue table
      const tx = bx + 10, ty = by + 26;
      R(c, tx, ty, 408, 14, '#0a1626');
      T(c, '項目', tx + 4, ty + 2, 10, K.dim); T(c, ISSUE_HDR[0], tx + 232, ty + 2, 10, K.cyan); T(c, ISSUE_HDR[1], tx + 312, ty + 2, 10, K.good);
      v.issues.forEach((i, k) => {
        const y = ty + 16 + k * 24;
        R(c, tx, y, 408, 22, k % 2 ? '#0e1c30' : '#0f2034');
        T(c, i.name, tx + 4, y + 2, 10, i.sacred ? K.lock : K.text, 'left', 214);
        if (i.note) T(c, i.note, tx + 4, y + 12, 8, K.faint, 'left', 214);
        for (let q = 1; q <= 3; q++) {
          const px = tx + 232 + (q - 1) * 14, py = y + 5;
          R(c, px, py, 11, 11, i.dem >= q ? K.amber : '#31465c'); R(c, px + 1, py + 1, 9, 9, q <= i.mine ? K.cyan : '#0c1828');
          const qx = tx + 312 + (q - 1) * 14;
          const locked = q > i.max;
          R(c, qx, py, 11, 11, i.want >= q ? K.amber : '#31465c'); R(c, qx + 1, py + 1, 9, 9, q <= i.theirs ? K.good : locked ? '#1a1a22' : '#0c1828');
        }
        if (i.dem === 0) T(c, '要求なし', tx + 276, y + 5, 8, K.faint, 'left', 34);
        if (i.want === 0) T(c, '—', tx + 360, y + 5, 10, K.faint);
      });
      T(c, '●＝提示・約束　黄の枠＝相手の要求／日本の期待', tx, ty + 16 + 6 * 24 + 1, 8, K.faint, 'left', 408);
      // the right side: the mood, the odds, the home reaction, the log
      const rx = bx + 430, rw = bw - 440;
      T(c, `相手の雰囲気 ${v.mood}`, rx, ty, 10, K.text); bar(c, rx + 82, ty + 3, rw - 84, v.mood, 100, v.mood < 25 ? K.bad : v.mood < 50 ? K.warn : K.good);
      T(c, `勢い ${v.momentum >= 0 ? '+' : ''}${v.momentum}`, rx, ty + 14, 10, K.dim); T(c, `合意の見込み ${pc(v.pConclude)}`, rx + 70, ty + 14, 10, v.pConclude >= 0.5 ? K.good : K.warn, 'left', rw - 72);
      T(c, `相手の満足 ${pc(v.sp)}　日本の満足 ${pc(v.sj)}`, rx, ty + 28, 10, K.dim, 'left', rw);
      let ry = ty + 46;
      for (const l of v.domestic.slice(0, 2)) ry += para(c, l, rx, ry, rw, 10, K.warn, 12, 2);
      ry += 2;
      for (const l of v.log.slice(-3)) ry += para(c, `・${l.replace(/\n/g, ' ')}`, rx, ry, rw, 10, K.dim, 12, 3);
      // the moves
      const my = ty + 16 + 6 * 24 + 14;
      R(c, tx, my - 2, bw - 20, 1, K.edge);
      m.rects = [];
      const half = Math.ceil(v.moves.length / 2);
      v.moves.forEach((mv, i) => {
        const col = i < half ? 0 : 1, row = i < half ? i : i - half;
        const mx = tx + col * 304, yy = my + row * 17;
        const sel = i === m.idx;
        R(c, mx, yy, 298, 16, sel ? K.sel : '#0d1b2e'); if (sel) R(c, mx, yy, 2, 16, K.amber);
        T(c, mv.label, mx + 8, yy + 2, 12, mv.why ? K.faint : mv.id === 'walk' ? K.warn : mv.id === 'conclude' ? K.good : K.text, 'left', 286);
        m.rects[i] = { x: mx, y: yy, w: 298, h: 16 };
      });
      const cur = v.moves[m.idx];
      if (cur) para(c, cur.why ? `いまはできない：${cur.why}` : cur.sub, tx, my + half * 17 + 2, bw - 24, 10, cur.why ? K.lock : K.dim, 12, 2);
      T(c, '↑↓手を選ぶ　A決める　B中断（交渉は残る）', bx + bw - 10, by + bh - 14, 10, K.faint, 'right');
    },
  };
  return m;
}
async function negoEntry(ui, kind, target) {
  const g = ui.g;
  const open = (safe(() => g.negotiations(), []) || []).find((n) => n.kind === kind && n.target === target && n.status === 'open');
  if (open) { await negoFlow(ui, open.id); return; }
  const pv = kind === 'epa' ? safe(() => g.diplomacyPreview('fta', target), null) : kind === 'security' ? safe(() => g.diplomacyPreview('defense_pact', target), null) : kind === 'peace' ? safe(() => g.diplomacyPreview('peace_treaty', target), null) : safe(() => g.diplomacyPreview('tariff_talks', target), null);
  if (pv && pv.why) { await whyInfo(ui, KIND_JA[kind] || '交渉', pv.why, 'x', target); return; }
  const levels = [{ id: 'official', label: '事務レベル協議から始める', sub: '体力は使わない。進みは遅めで、あとから格を上げられる' }, { id: 'fm', label: '閣僚折衝（外相会談）で始める', sub: '体力12。見込みが少し上がる（総理か外務大臣）' }, { id: 'summit', label: '首脳協議で始める', sub: '体力22。大きな合意を引き出しやすい（総理）' }];
  const k = await ui.pick({ title: `${KIND_JA[kind] || '交渉'}（${(ui.data.rows[target] || { name: target }).name || target}）`, lines: [pv ? pv.desc : '', '交渉は複数のラウンドで進む。譲歩する項目と守る項目、相手に求める項目を選び、合意の見込みが上がったら署名へ。'].filter(Boolean), items: levels.map((l) => ({ label: l.label, sub: l.sub })), w: 520 });
  if (k == null || k < 0) return;
  const r = safe(() => g.negotiationStart(kind, target, { level: levels[k].id }), null);
  if (!r || !r.ok) { await ui.info('交渉', [`始められない：${(r && r.why) || '理由は不明'}`]); return; }
  await negoFlow(ui, r.id);
}
async function negoFlow(ui, id) {
  const g = ui.g;
  for (let guard = 0; guard < 80 && !ui.closed; guard++) {
    const v = safe(() => g.negotiationView(id), null);
    if (!v) return;
    if (v.status !== 'open') { await ui.info(v.name, [v.status === 'done' || v.status === 'signed' ? '交渉は合意に至った。' : '交渉は終わった。', v.result ? v.result.text : '']); return; }
    const mid = await ui.openModal(negoModal(ui, v));
    if (!mid) return;
    const mv = v.moves.find((x) => x.id === mid);
    if (!mv) return;
    if (mv.why) { await ui.info(mv.label, ['いまはできない：', mv.why]); continue; }
    let arg = null;
    if (mv.issue) {
      const cand = v.issues.filter((i) => (mid === 'concede' ? i.mine < 3 : mid === 'press' ? i.want > 0 && i.theirs < Math.min(i.want, i.max) : i.dem > 0)).sort((a0, b0) => (mid === 'concede' ? (b0.dem - b0.mine) - (a0.dem - a0.mine) : 0));
      if (!cand.length) { await ui.info(mv.label, ['選べる項目がない。']); continue; }
      const k = await ui.pick({
        title: mv.label, lines: [mv.sub],
        items: cand.map((i) => ({ label: i.name, sub: mid === 'concede' ? `いま：${i.lv[i.mine]}${i.mine < 3 ? ` → ${i.lv[i.mine + 1]}` : ''}（相手の要求：${i.lv[i.dem]}）` : mid === 'press' ? `いま：${i.lvT[i.theirs]} → ${i.lvT[Math.min(3, i.theirs + 1)]}（上限：${i.lvT[i.max]}）` : `相手の要求：${i.lv[i.dem]}を下げさせたい`, right: mid === 'press' ? pc(i.pressOdds) : mid === 'shield' ? pc(i.shieldOdds) : '' })), w: 520,
      });
      if (k == null || k < 0) continue;
      arg = cand[k].id;
    }
    if (mid === 'walk' || mid === 'conclude') {
      const c = await ui.confirm({ title: mv.label, danger: mid === 'walk', lines: [mv.sub, mid === 'conclude' ? `【合意の見込み】${pc(v.pConclude)}　相手の満足 ${pc(v.sp)}・日本の満足 ${pc(v.sj)}` : '関係が冷え、支持率に響くことがある。相手が条件を見直して呼び戻すこともある。', ...v.domestic], choices: mid === 'walk' ? ['やめておく', '席を立つ'] : ['署名を試みる', 'やめる'], index: 0 });
      if (mid === 'walk' ? c !== 1 : c !== 0) continue;
    }
    const res = safe(() => g.negotiationMove(id, mid, arg), null);
    if (!res) continue;
    if (!res.ok) { sfx('buzz'); await ui.info(mv.label, [`できなかった：${res.why}`]); continue; }
    sfx(res.signed ? 'good' : 'ok');
    await ui.info(res.signed ? '合意・署名' : mv.label, String(res.text || '').split('\n'));
    ui.dirty();
    if (res.ended) {
      if (has(g, 'regimeFlush')) await safe(() => g.regimeFlush(), null);
      return;
    }
  }
}
async function tariffFlow(ui, cat) {
  const g = ui.g;
  const cands = safe(() => g.tariffCandidates(cat.id), []) || [];
  if (!cands.length) { await ui.info(cat.name, ['変えられる水準がない。']); return; }
  const first = safe(() => g.tariffPreview(cat.id, cands[0].rate), null);
  if (first && first.why) { await ui.info(`${shortCat(cat.name)}の関税`, ['いまはできない：', first.why, '', '（総理か、担当の大臣になれば、ここから動かせる）']); return; }
  const k = await ui.pick({ title: `${shortCat(cat.name)}の関税率（いま ${cat.rateText}）`, lines: [`歴史どおりなら ${cat.histText}`, '新しい水準を選ぶ。関税は法律で定めるので、国会の審議を経て成立する。'], items: cands.map((cd) => ({ label: cd.label, sub: cd.sub || `物価・収入・報復の見込みは次の画面で確かめる`, right: cd.rateText.replace(/（.*$/, '') })), w: 540 });
  if (k == null || k < 0) return;
  const pv = safe(() => g.tariffPreview(cat.id, cands[k].rate), null);
  if (!pv || !pv.ok) return;
  const danger = pv.over;
  const c = await ui.confirm({ title: `${danger ? '⚠ ' : ''}${shortCat(cat.name)}の関税を ${pv.toText.replace(/（.*$/, '')} に`, danger, lines: pv.lines, choices: ['国会に提出する', 'やめる'], index: 0 });
  if (c !== 0) return;
  await ui.result('関税の改正', safe(() => g.tariffSet(cat.id, cands[k].rate), null));
}
async function frictionFlow(ui, f) {
  const g = ui.g;
  const kinds = ['trade_talk', 'trade_concede', 'trade_wto', 'trade_counter'];
  const pvs = kinds.map((kd) => safe(() => g.diplomacyPreview(kd, f.crisis), null));
  const k = await ui.pick({ title: `貿易摩擦：${f.title}`, lines: [`相手の要求：${f.ask}`, `期限まであと${f.daysLeft}日。応じないと相手は関税を発動する。`], items: pvs.map((pv, i) => ({ label: pv ? pv.name : kinds[i], sub: pv ? (pv.why ? `🔒 ${pv.why}` : pv.lines[0] || pv.desc) : '', right: pv && pv.why ? '🔒' : pv && pv.odds != null ? pc(pv.odds) : '○', lock: pv && pv.why })), w: 560 });
  if (k == null || k < 0) return;
  await diploFlow(ui, kinds[k], f.crisis);
}
async function partnerMenu(ui, p) {
  const g = ui.g;
  const id = p.main;
  const items = [
    { label: '関税交渉（相手の関税の引き下げを求める）', sub: '事務レベルから閣僚・首脳へ。見返りに輸入拡大・投資を求められる', run: () => negoEntry(ui, 'tariffs', id) },
    { label: '経済連携協定（EPA）の交渉', sub: p.treaties.length ? 'すでに協定がある' : '関税を下げ、貿易と投資を広げる。農産物の扱いが争点', run: () => negoEntry(ui, 'epa', id) },
    { label: '追加関税（対抗関税）を科す', sub: '政令で6か月。報復の見込みを確かめてから', run: () => diploFlow(ui, 'tariff_extra', id) },
    { label: '追加関税・対抗措置を解除する', sub: p.extra.length ? '日本の追加関税をやめる' : '追加関税は科していない', run: () => diploFlow(ui, 'tariff_lift', id) },
    { label: '関税の適用除外（例外）にする', sub: '日本の関税引き上げの対象から外す', run: () => diploFlow(ui, 'tariff_exempt', id) },
    { label: '外交の手段をすべて見る', sub: '首脳会談・制裁・援助…', run: () => actionsMenu(ui, id) },
  ];
  const k = await ui.pick({ title: `${p.name}：関税・貿易の手段`, items: items.map((it) => ({ label: it.label, sub: it.sub })), w: 540 });
  if (k == null || k < 0) return;
  await items[k].run();
}

// ---- the richer 外交 tab: the report rows on top, the old action list below
const TAB_DIPLOMACY_BASE = TAB_DIPLOMACY;
const REPORT = [['score', '外交の通信簿'], ['advice', '外務省の助言'], ['visits', '来日する要人'], ['negos', '進行中の交渉'], ['diet', '国会で審議中の条約'], ['terr', '領土問題'], ['soft', 'ソフトパワー・文化交流'], ['opinion', '国内の世論の反応'], ['stance', '外交の姿勢（親中派・親米派…）'], ['timeline', '外交の年表']];
const TAB_DIPLOMACY2 = {
  id: 'diplomacy', label: '外交', icon: 'hand',
  rows(ui) {
    const g = ui.g;
    const out = [{ header: true, label: '外交の状況' }];
    const st = safe(() => g.diplomaticStanding(), null);
    const negos = (safe(() => g.negotiations(), []) || []).filter((n) => n.status === 'open');
    const diet = (safe(() => g.dietTreaties(), []) || []).filter((d) => d.status === 'open');
    const visits = safe(() => g.foreignVisits(), []) || [];
    ui.rep = { st, negos, diet, visits };
    const right = { score: st ? `${st.grade} ${st.score}` : '', advice: '', visits: visits.length ? `${visits.length}件` : '', negos: negos.length ? `${negos.length}件` : '', diet: diet.length ? `${diet.length}件` : '', soft: st ? `${(st.parts.find((p0) => p0.id === 'soft') || {}).value}` : '' };
    for (const [key, label] of REPORT) {
      if (key === 'negos' && !negos.length) continue;
      if (key === 'diet' && !diet.length) continue;
      if (key === 'visits' && !visits.length) continue;
      out.push({ key: 'r:' + key, label, right: right[key] || '', rightColor: key === 'visits' || key === 'negos' ? K.warn : K.dim, report: key });
    }
    for (const n of negos) out.push({ key: 'nn:' + n.id, label: `交渉：${n.name}`, right: `第${n.round}/${n.rounds}`, rightColor: K.cyan, n });
    for (const d of diet) out.push({ key: 'dd:' + d.id, label: `国会：${d.name}`, right: d.stageShort, rightColor: K.dim, d });
    const base = TAB_DIPLOMACY_BASE.rows(ui);
    return out.concat(base);
  },
  draw(ui, c) {
    const row = ui.curRow();
    if (row && (row.report || row.n || row.d)) {
      drawList(ui, c, LIST);
      if (row.n) return drawNego(ui, c, row.n);
      if (row.d) return drawDietItem(ui, c, row.d);
      return drawReport(ui, c, row.report);
    }
    TAB_DIPLOMACY_BASE.draw(ui, c);
  },
  async act(ui, row) {
    if (!row) return;
    const g = ui.g;
    if (row.n) { await negoFlow(ui, row.n.id); return; }
    if (row.d) { await ui.info(row.d.name, [`いまの段階：${row.d.stageName}`, ...(row.d.log || []).map((l) => `・${l.text}`)]); return; }
    if (row.report) {
      const k = row.report;
      if (k === 'advice') { const a = safe(() => g.mofaAdvice(), []) || []; await ui.info('外務省の助言', a.flatMap((x) => [`【${x.who}】（${x.stance}）`, x.text])); return; }
      if (k === 'visits') {
        const vs = ui.rep.visits.filter((v) => v.status === 'pending');
        if (!vs.length) { await ui.info('来日する要人', ['いま来日している要人はいない。']); return; }
        const i = await ui.pick({ title: '来日中の要人', items: vs.map((v) => ({ label: v.title, sub: `${v.kind}来日・あと${v.daysLeft}日`, right: '接遇' })), w: 480 });
        if (i >= 0) await diploFlow(ui, 'receive_visit', vs[i].country);
        return;
      }
      if (k === 'terr') { await territoryFlow(ui); return; }
      if (k === 'soft') { const id = await pickCountry(ui, '交流の相手'); if (id) await diploFlow(ui, 'soft_action', id); return; }
      if (k === 'timeline') { const tl = safe(() => g.diplomacyTimeline(24), []) || []; await ui.info('外交の年表', tl.length ? tl.map((e) => `${e.date}　${e.text}`) : ['まだ記録はない。']); return; }
      if (k === 'opinion') { const o = safe(() => g.worldOpinion(10), []) || []; await ui.info('国内の世論の反応', o.length ? o.map((e) => `${e.date}　${e.name}：${e.text}`) : ['まだ反応は記録されていない。']); return; }
      if (k === 'stance') { await stanceInfo(ui); return; }
      return;
    }
    return TAB_DIPLOMACY_BASE.act(ui, row);
  },
};
async function territoryFlow(ui) {
  const g = ui.g;
  const ids = ['northern', 'takeshima', 'senkaku'];
  const infos = ids.map((id) => safe(() => g.disputeInfo(id), null)).filter(Boolean);
  const k = await ui.pick({ title: '領土問題', lines: ['それぞれの立場と、これまでのいきさつ'], items: infos.map((d) => ({ label: d.name, sub: d.status === 'dispute' ? '解決していない' : d.status === 'partial' ? '一部が決着' : d.status === 'resolved' ? '決着' : '棚上げ', right: '▶' })).concat([{ label: '領土問題に取り組む（協議・警備・対話…）', sub: '見込みと立場を確かめてから' }]), w: 520 });
  if (k == null || k < 0) return;
  if (k === infos.length) { await diploFlow(ui, 'dispute_action', null); return; }
  const d = infos[k];
  await ui.info(d.name, [`日本の立場：${d.jp}`, `相手の立場：${d.other}`, `争点：${d.law}`, '', ...d.timeline.slice(-5).map((e) => `${e.year}年　${e.text}`)]);
}
async function stanceInfo(ui) {
  const g = ui.g;
  const info = safe(() => g.foreignStanceInfo('player'), null);
  const gov = safe(() => g.foreignStanceInfo('government'), null);
  if (!info) { await ui.info('外交の姿勢', ['姿勢の仕組みが読み込まれていない。']); return; }
  const NAMES = { china: '中国', us: '米国', russia: 'ロシア', korea: '韓国', taiwan: '台湾', eu: '欧州', asean: '東南アジア', nk: '北朝鮮' };
  const line = (v) => Object.keys(NAMES).map((k) => `${NAMES[k]}${v[k] >= 0 ? '+' : ''}${v[k]}`).join('　');
  await ui.info('外交の姿勢', [`あなた：${info.label}（${info.long}）`, info.desc, line(info.vec), '', `政権：${gov ? gov.label : '—'}　${gov ? line(gov.vec) : ''}`, '', info.effect.text, '', '姿勢は、会談・制裁・援助などの行いで少しずつ動く。政権の姿勢（総理・与党・派閥）は、各国との関係と貿易に影響する。']);
}
function drawReport(ui, c, key) {
  const g = ui.g;
  const x = DETAIL.x + 8, wd = DETAIL.w - 16;
  const rep = ui.rep || {};
  if (key === 'score') {
    const st = rep.st;
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '外交の通信簿', { right: st ? `${st.score}点・評価${st.grade}` : '' });
    if (!st) return;
    let y = DETAIL.y + 22;
    T(c, `${st.grade}　${st.label}`, x, y, 14, st.score >= 62 ? K.good : st.score >= 50 ? K.warn : K.bad); T(c, `前月比 ${sgn(st.trend, 0)}`, x + wd, y + 2, 10, st.trend >= 0 ? K.good : K.bad, 'right'); y += 22;
    for (const p of st.parts) { T(c, p.label, x, y, 10, K.text, 'left', 150); bar(c, x + 156, y + 3, 120, p.value, 100, p.value >= 60 ? K.good : p.value >= 40 ? K.warn : K.bad); T(c, `${p.value}`, x + 282, y, 10, K.text); T(c, p.desc, x + 306, y, 8, K.faint, 'left', wd - 310); y += 15; }
    if (st.history.length > 2) { sparkline(c, x, y + 8, wd, 28, st.history.map((h) => h.score), K.amber); T(c, '通信簿の推移', x, y + 40, 10, K.faint); }
    return;
  }
  if (key === 'advice') {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '外務省の助言', { right: 'A：全文を読む' });
    const a = safe(() => g.mofaAdvice(), []) || [];
    let y = DETAIL.y + 22;
    for (const it of a.slice(0, 4)) { T(c, `${it.who}（${it.stance}）`, x, y, 10, it.stance === '積極' ? K.good : K.warn, 'left', wd); y += 13; y += para(c, it.text, x + 6, y, wd - 6, 10, K.text, 13, 4) + 4; if (y > DETAIL.y + DETAIL.h - 30) break; }
    return;
  }
  if (key === 'visits') {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '来日する要人', { right: 'A：接遇する' });
    let y = DETAIL.y + 22;
    for (const v of rep.visits || []) { T(c, `${v.title}（${v.kind}来日・${v.status === 'pending' ? `あと${v.daysLeft}日` : `${v.daysLeft}日後に来日予定`}）`, x, y, 12, K.text, 'left', wd); y += 18; }
    para(c, '来日中の要人は、会談・歓迎の行事で関係を深められる。会談の成果は共同声明に残り、関係が良いほど踏みこんだ内容になる。接遇しないまま滞在が終わると、関係が少し冷える。', x, y + 4, wd, 10, K.dim, 13, 6);
    return;
  }
  if (key === 'terr') {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '領土問題', { right: 'A：くわしく・取り組む' });
    let y = DETAIL.y + 22;
    for (const id of ['northern', 'takeshima', 'senkaku']) { const d = safe(() => g.disputeInfo(id), null); if (!d) continue; T(c, `${d.name}（${d.status === 'dispute' ? '解決していない' : d.status === 'partial' ? '一部が決着' : d.status === 'resolved' ? '決着' : '棚上げ'}・協議${d.talks}回）`, x, y, 12, K.warn, 'left', wd); y += 16; y += para(c, `日本：${d.jp}`, x + 6, y, wd - 6, 10, K.text, 13, 2); y += para(c, `相手：${d.other}`, x + 6, y, wd - 6, 10, K.dim, 13, 3) + 4; }
    return;
  }
  if (key === 'soft') {
    const sp = safe(() => g.softPower(), null);
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, 'ソフトパワー・文化交流', { right: 'A：交流事業を行う' });
    if (!sp) return;
    let y = DETAIL.y + 22;
    T(c, `ソフトパワー ${sp.score}／100`, x, y, 14, K.cyan); bar(c, x + 150, y + 6, 180, sp.score, 100, K.cyan); y += 24;
    T(c, `事業の積み重ね +${sp.bonus}　団体・協会の協力 +${sp.groups}`, x, y, 10, K.dim, 'left', wd); y += 16;
    para(c, '文化の発信・留学生と青年の交流・スポーツ交流・日本語の普及・観光ビザの緩和。相手国の国民との結びつきを深め、関係と日本のイメージにじわじわ効く。援助（ODA）の積み重ねも加わる。', x, y, wd, 10, K.text, 13, 5); y += 70;
    for (const o of sp.options) { T(c, `・${o.label}`, x, y, 10, K.text, 'left', wd); y += 13; }
    return;
  }
  if (key === 'opinion') {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '国内の世論の反応', { right: 'A：一覧' });
    const o = safe(() => g.worldOpinion(5), []) || [];
    let y = DETAIL.y + 22;
    if (!o.length) para(c, 'まだ外交への反応は記録されていない。会談・条約・制裁・援助などを行うと、歓迎する層と懸念する層が表れる。', x, y, wd, 10, K.dim, 13, 4);
    for (const e of o) { T(c, `${e.date}　${e.name}`, x, y, 10, K.amber, 'left', wd); y += 13; y += para(c, e.text, x + 6, y, wd - 6, 10, K.text, 13, 3) + 3; if (y > DETAIL.y + DETAIL.h - 24) break; }
    return;
  }
  if (key === 'stance') {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '外交の姿勢（親中派・親米派…）', { right: 'A：くわしく' });
    const info = safe(() => g.foreignStanceInfo('player'), null);
    const gov = safe(() => g.foreignStanceInfo('government'), null);
    let y = DETAIL.y + 22;
    if (!info) return;
    const NAMES = { china: '中国', us: '米国', russia: 'ロシア', korea: '韓国', taiwan: '台湾', eu: '欧州', asean: 'ASEAN', nk: '北朝鮮' };
    T(c, `あなた：${info.label}（${info.long}）`, x, y, 12, K.amber, 'left', wd); y += 16;
    for (const k of Object.keys(NAMES)) { T(c, NAMES[k], x, y, 10, K.text, 'left', 64); const v = info.vec[k]; R(c, x + 70, y + 3, 160, 6, '#1a2a3a'); R(c, x + 150, y + 1, 1, 10, K.dim); R(c, Math.min(x + 150, x + 150 + (v / 100) * 80), y + 3, Math.max(1, Math.abs(v) * 0.8), 6, v >= 0 ? K.cyan : K.bad); T(c, `${v >= 0 ? '+' : ''}${v}`, x + 236, y, 10, K.dim); if (gov) { const gv = gov.vec[k]; T(c, `政権 ${gv >= 0 ? '+' : ''}${gv}`, x + 280, y, 10, K.faint, 'left', wd - 284); } y += 14; }
    y += 4;
    para(c, gov ? `政権：${gov.label}。${gov.effect.text}` : '', x, y, wd, 10, K.dim, 13, Math.max(1, Math.floor((DETAIL.y + DETAIL.h - y - 4) / 13)));
    return;
  }
  if (key === 'timeline') {
    panel(c, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, '外交の年表', { right: 'A：一覧' });
    const tl = safe(() => g.diplomacyTimeline(12), []) || [];
    let y = DETAIL.y + 22;
    if (!tl.length) para(c, 'あなたの外交の記録がここに残る（会談・条約・制裁・援助・交渉の経過）。', x, y, wd, 10, K.dim, 13, 3);
    for (const e of tl) { T(c, e.date, x, y, 10, K.amber); y += para(c, e.text, x + 62, y, wd - 62, 10, K.text, 13, 2); if (y > DETAIL.y + DETAIL.h - 16) break; }
  }
}

const TABS = [TAB_MAP, TAB_COUNTRIES, MORE.TAB_REGIONS, TAB_DIPLOMACY2, TAB_TRADE, TAB_ALLIANCES, TAB_CRISIS, MORE.TAB_TRENDS, MORE.TAB_TIMELINE, MORE.TAB_NEWS];
const TAB_LONG = { trade: '貿易・関税', alliances: '同盟・条約', crisis: '危機・戦争', regions: '地域・陣営', trends: '推移（グラフ）' };
const tabIndex = (t) => { if (typeof t === 'number') return clamp(t, 0, TABS.length - 1); const i = TABS.findIndex((x) => x.id === t); return i < 0 ? 0 : i; };

// ================================================================ lists
function drawList(ui, c, L0, wide = false) {
  void wide;
  if (ui.noList) return; // the big-text detail pane draws only the detail
  const big = !!ui.big;
  const L = big ? { ...BIG.body, rh: 32 } : L0;
  const rows = ui.rows();
  const st = ui.ls();
  const cur = rows[st.i];
  const subH = !big && cur && !cur.header && (cur.sub || cur.lock) ? 16 : 0; // the selected row's sub line (a tooltip at the bottom)
  const n = Math.max(1, Math.floor((L.h - 4 - subH) / L.rh));
  st.top = clamp(st.top || 0, 0, Math.max(0, rows.length - n));
  if (st.i < st.top) st.top = st.i;
  if (st.i >= st.top + n) st.top = st.i - n + 1;
  R(c, L.x, L.y, L.w, L.h, K.panel);
  R(c, L.x, L.y, L.w, 1, K.edge); R(c, L.x, L.y + L.h - 1, L.w, 1, K.edge);
  ui.listRect = { ...L, n };
  const fs = big ? 16 : 12, rs = big ? 14 : 10, hs = big ? 14 : 10;
  for (let k = 0; k < n && st.top + k < rows.length; k++) {
    const r = rows[st.top + k];
    const y = L.y + 2 + k * L.rh;
    const sel = st.top + k === st.i && ui.focus === 'body';
    if (r.header) { R(c, L.x + 1, y, L.w - 2, L.rh - 1, '#0a1626'); R(c, L.x + 1, y + L.rh - 2, L.w - 2, 1, 'rgba(255,181,71,0.25)'); T(c, r.label, L.x + 6, y + (L.rh - hs) / 2, hs, K.amber, 'left', L.w - 12); continue; }
    if (sel) R(c, L.x + 1, y, L.w - 2, L.rh - 1, K.sel);
    if (sel) R(c, L.x + 1, y, big ? 4 : 2, L.rh - 1, K.amber);
    const rw = r.right ? measure(c, r.right, rs) + 10 : 0;
    T(c, r.label, L.x + (big ? 12 : 8), y + (L.rh - fs) / 2, fs, r.lock ? K.faint : r.color || K.text, 'left', L.w - (big ? 24 : 16) - rw);
    if (r.right) T(c, r.right, L.x + L.w - (big ? 10 : 6), y + (L.rh - rs) / 2 + 1, rs, r.rightColor || (r.lock ? K.lock : K.dim), 'right');
    if (big) R(c, L.x + 8, y + L.rh - 1, L.w - 16, 1, 'rgba(120,160,200,0.08)');
  }
  if (rows.length > n) { const h = Math.max(10, ((L.h - subH) * n) / rows.length); R(c, L.x + L.w - 3, L.y + ((L.h - subH - h) * st.top) / Math.max(1, rows.length - n), 2, h, K.edgeHi); }
  if (subH) { const yy = L.y + L.h - subH - 1; R(c, L.x + 1, yy, L.w - 2, subH, '#0a1626'); R(c, L.x + 1, yy, L.w - 2, 1, K.edge); T(c, cur.lock ? `🔒 ${cur.lock}` : cur.sub, L.x + 6, yy + 3, 10, cur.lock ? K.lock : K.dim, 'left', L.w - 12); }
}

// ================================================================ flows (modals: confirm / pick / info)
const OPT_KEY = { crisis_statement: 'kind', crisis_fund: 'level', summit: 'topic', visit: 'topic', fm_talks: 'topic', statement: 'kind', sanction: 'level', aid: 'level', peace_treaty: 'terms', abrogate: 'treaty', peace_conf: 'terms', dispatch: 'side', tariff_extra: 'level', tariff_exempt: 'kind', receive_visit: 'topic', soft_action: 'kind', dispute_action: 'act', safeguard: 'cat' };
async function diploFlow(ui, kind, target, opts0 = {}) {
  const g = ui.g;
  let pv = safe(() => g.diplomacyPreview(kind, target, opts0), null);
  if (!pv) return;
  if (pv.why) { await whyInfo(ui, pv.name, pv.why, kind, target); return; }
  if (pv.rich && has(g, 'negotiationStart')) { await negoEntry(ui, pv.rich, target); return; }
  let opts = { ...opts0 };
  if (pv.options && pv.options.length && OPT_KEY[kind] && opts[OPT_KEY[kind]] == null) {
    const k = await ui.pick({ title: pv.name, lines: [pv.desc], items: pv.options.map((o) => ({ label: o.label, sub: o.sub })) });
    if (k == null || k < 0) return;
    opts[OPT_KEY[kind]] = pv.options[k].id;
    pv = safe(() => g.diplomacyPreview(kind, target, opts), pv);
    if (pv.why) { await whyInfo(ui, pv.name, pv.why, kind, target); return; }
  }
  const danger = ['declare', 'collective', 'dispatch', 'cut_ties', 'leave_un', 'abrogate'].includes(kind);
  const lines = [pv.desc, ...pv.lines.map((l) => `・${l}`), pv.odds != null ? `【成功の見込み】${Math.round(pv.odds * 100)}%` : null].filter(Boolean);
  const k = await ui.confirm({ title: `${danger ? '⚠ ' : ''}${pv.name}${target && ui.data.rows[target] ? `（${ui.data.rows[target].short}）` : ''}`, lines, choices: ['実行する', 'やめる'], danger });
  if (k !== 0) return;
  const res = safe(() => g.diplomacy(kind, target, opts), { ok: false, why: 'うまくいかなかった' });
  await ui.result(pv.name, res);
}
async function whyInfo(ui, title, why, kind, target) {
  // the path, not a dead end: the war's routes lead to their first step
  if (kind === 'declare' || /9条|交戦権|国軍/.test(String(why))) {
    const k = await ui.pick({ title: `${title}：いまの状態`, lines: [why], items: [{ label: '体制・憲法の手続きを見る', sub: '9条の改正・緊急事態・国軍化などの見込み' }, { label: 'もどる' }] });
    if (k === 0) await stepsFlow(ui);
    return;
  }
  await ui.info(title, ['いまはできない：', why]);
}
async function actionsMenu(ui, target, title = null) {
  const g = ui.g;
  for (let guard = 0; guard < 30 && !ui.closed; guard++) {
    let list = safe(() => g.diplomacyActions(target), []) || [];
    // [R9-E] a crisis: only the actions that fit its kind (the others would only say 「〜のときに行う」)
    if (typeof target === 'string' && target.startsWith('k:')) { const kk = (ui.data.w.crises || []).find((x) => x.id === target.slice(2)); if (kk) list = list.filter((a) => !MORE.APPLY[a.id] || MORE.APPLY[a.id].includes(kk.kind)); }
    if (!list.length) { await ui.info(title || '外交', ['この相手に使える手段はない。']); return; }
    const nm = title || (ui.data.rows[target] || {}).name || '';
    // [R9-E] a country: the full information first (treaties, alliances, the dispute with both positions)
    const isCountry = !!(ui.data.rows[target] && typeof target === 'string' && !/^[ck]:/.test(target));
    const head = isCountry ? [{ label: 'くわしい情報（条約・同盟・領土問題）', sub: '日本との条約・協定、同盟、加盟する機関、領土問題の双方の立場', right: 'ⓘ' }] : [];
    const k0 = await ui.pick({ title: `${nm}：外交の手段`, items: [...head, ...list.map((a) => ({ label: a.name, sub: a.why ? `🔒 ${a.why}` : a.lines[0] || a.desc, right: a.why ? '🔒' : a.odds != null ? `${Math.round(a.odds * 100)}%` : '○', lock: a.why }))], w: 520 });
    if (k0 == null || k0 < 0) return;
    if (isCountry && k0 === 0) { await countryInfoModal(ui, target); continue; }
    const k = k0 - head.length;
    const a = list[k];
    await diploFlow(ui, a.id, target);
    ui.dirty();
  }
}
async function countryInfoModal(ui, id) {
  const det = ui.detail(id);
  if (!det) return;
  const lines = [`${det.leader}・${det.gov || ''}`, `日本との関係 ${det.relation}（${det.relLabel}）・陣営：${det.blocName}・国交：${det.tiesLabel}`];
  if (det.real) lines.push(`GDP 約${det.gdp}兆ドル（目安）・軍事力 ${det.mil}・日本の貿易の約${det.trade}%`);
  if (det.member && det.member.length) lines.push(`加盟：${det.member.join('・')}`);
  if (det.nuclear) lines.push(det.nuclear);
  if (det.alliances && det.alliances.length) lines.push(`同盟・協力：${det.alliances.join('・')}`);
  if (det.treaties && det.treaties.length) lines.push(`日本との条約・協定：${det.treaties.join('、')}`);
  if (det.conflicts && det.conflicts.length) lines.push(`紛争：${det.conflicts.join('・')}`);
  if (det.note) lines.push('', det.note);
  if (det.dispute) lines.push('', `【${det.dispute.name}】`, ...det.dispute.lines);
  await ui.info(det.name, lines, { w: 560 });
}
async function pickCountry(ui, title, opts = {}) {
  const d = ui.data;
  const ids = [...d.w.countries.map((c) => c.id), ...(opts.fictional ? (d.w.fictional || []).map((c) => c.id) : [])];
  const k = await ui.pick({ title, items: ids.map((id) => { const r = d.rows[id]; return { label: r.name, sub: `関係 ${r.relation}・${r.blocName}${r.war ? '・戦争中' : ''}`, right: `${r.relation}`, rightColor: relColor(r.relation) }; }), w: 480 });
  return k == null || k < 0 ? null : ids[k];
}
async function declareFlow(ui) {
  const id = await pickCountry(ui, '宣戦の相手', { fictional: true });
  if (!id) return;
  const g = ui.g;
  const pv = safe(() => g.diplomacyPreview('declare', id), null);
  if (!pv) return;
  if (pv.why) { await whyInfo(ui, '宣戦布告', pv.why, 'declare', id); return; }
  const k = await ui.confirm({ title: `⚠ 宣戦布告（${ui.data.rows[id].short}）`, danger: true, lines: [pv.desc, ...pv.lines.map((l) => `・${l}`)], choices: ['やめておく', '理解したうえで宣戦する'], index: 0 });
  if (k !== 1) return;
  const k2 = await ui.confirm({ title: '最後の確認', danger: true, lines: ['本当に宣戦しますか？　多くの人の命とくらしが失われます。'], choices: ['やめておく', '宣戦する'], index: 0 });
  if (k2 !== 1) return;
  await ui.result('宣戦布告', safe(() => g.diplomacy('declare', id), null));
}
async function stepsFlow(ui) {
  const g = ui.g;
  if (!has(g, 'regimeSteps')) { await ui.info('体制', ['体制の仕組みが読み込まれていない']); return; }
  for (let guard = 0; guard < 10 && !ui.closed; guard++) {
    const steps = safe(() => g.regimeSteps(), []) || [];
    const k = await ui.pick({ title: '体制・憲法の手続き', items: steps.map((s0) => ({ label: s0.name, sub: s0.why ? `🔒 ${s0.why}` : s0.breakaway ? `進めると：${s0.breakaway}` : s0.desc, right: s0.why ? '🔒' : s0.odds != null ? `${Math.round(s0.odds * 100)}%` : '○', lock: s0.why })), w: 560 });
    if (k == null || k < 0) return;
    const s0 = steps[k];
    if (s0.why) { await ui.info(s0.name, [s0.desc, '', `いまはできない：${s0.why}`]); continue; }
    const c = await ui.confirm({ title: `${s0.auth || s0.war ? '⚠ ' : ''}${s0.name}`, danger: s0.auth || s0.war, lines: [s0.desc, s0.odds != null ? `【成功の見込み】${Math.round(s0.odds * 100)}%` : null, s0.breakaway ? `【党】${s0.breakaway}。党を離れて新党を結成してから進める。` : null, s0.auth ? '【結果】支持率・国際社会の評価・民衆の不満に重い影響がある。' : null].filter(Boolean), choices: ['やめておく', '進める'], index: 0 });
    if (c !== 1) continue;
    await ui.result(s0.name, safe(() => g.regimeStep(s0.id), null));
  }
}
const WAR_CONSEQ = {
  mobilize: '兵力が増える。暮らしと経済への負担が大きく、不満が高まる。独裁体制では、友だちや家族も召集される。',
  deploy: '予備の部隊を前線に送る。その前線で勝ちやすくなる。',
  battle: '勝てば前線が進み、負ければ押し戻される。どちらでも両国の兵士と民間人の命が失われる。',
  offensive: '戦況は動くが、毎日の死傷が増える。',
  defend: '死傷は減るが、戦況は動きにくい。',
  negotiate: '第三国を通じて停戦を探る（4〜8日）。停戦すると講和の交渉に入れる。',
  withdraw: '同盟国の戦争から手を引く。同盟国は失望する。',
  surrender: '戦争は終わるが、重い代償を払う（独裁体制は崩れ、民主制なら内閣は総辞職し、係争地を失う）。',
  front_visit: '前線の部隊を励ます。危険は小さいがゼロではない。',
  front_go: '自分も前線に立つ。毎日、戦死する危険がある。戦死すれば、この人生は終わる（セーブデータは前のまま）。',
  front_return: '前線を離れる。任務の途中なら、脱走と見なされることもある。',
};
async function warFlow(ui, o) {
  if (!o) return;
  const g = ui.g;
  if (o.why) { await ui.info(o.name, ['いまはできない：', o.why]); return; }
  if (o.id === 'declare') { await declareFlow(ui); return; }
  let opts = {};
  if (o.id === 'battle' || o.id === 'deploy' || o.id === 'front_go' || o.id === 'front_visit') {
    const w = ui.data.war;
    const k = await ui.pick({ title: o.id === 'battle' ? '作戦を行う前線' : o.id === 'deploy' ? '部隊を送る前線' : '向かう前線', items: w.fronts.map((f) => ({ label: f.name, sub: `兵力 ${troops(f.own)}・${f.control >= 0 ? '優勢' : '劣勢'}${Math.abs(f.control)}${f.today && o.id === 'battle' ? '・今日は作戦ずみ' : ''}`, right: `${f.odds}%`, rightColor: f.odds >= 50 ? K.good : K.warn })) });
    if (k == null || k < 0) return;
    opts.front = w.fronts[k].id;
    if (o.id === 'deploy') opts.n = Math.min(40, Math.max(2, Math.round(w.reserve / 2)));
  }
  const pv = (safe(() => g.warOrders(opts), []) || []).find((x) => x.id === o.id) || o;
  if (pv.why) { await ui.info(o.name, ['いまはできない：', pv.why]); return; }
  const danger = ['mobilize', 'battle', 'offensive', 'surrender', 'front_go'].includes(o.id);
  const k = await ui.confirm({ title: `${danger ? '⚠ ' : ''}${o.name}`, danger, lines: [pv.desc, '', `【結果】${WAR_CONSEQ[o.id] || ''}`], choices: danger ? ['やめておく', '命令する'] : ['命令する', 'やめる'], index: 0 });
  if (danger ? k !== 1 : k !== 0) return;
  await ui.result(o.name, safe(() => g.warOrder(o.id, opts), null));
}

// ================================================================ the scene
const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isWorldUI && !s.closed);
let tapCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = sceneOf(g);
    if (!sc || g.top !== sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
// [R9-E] the big-text layout (portrait phones by default; a header chip switches it anywhere): one pane at a time,
// 16 px rows, the detail page scaled ×1.66 with ↑↓ scrolling, modals scaled to the screen
const BIG = { head: 26, tabY: 27, tabH: 28, body: { x: 0, y: 58, w: SW, h: 272 }, footY: 332 };
const BIGZ = (SW - 8) / DETAIL.w;
const BIG_VIEWS = [{ id: 'sel', label: '選んだ国', z: 2.4 }, ...VIEWS];
class WorldScene {
  constructor(g, opts, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isWorldUI: true, t: 0, focus: opts && opts.tab ? 'body' : 'tabs', tabIdx: tabIndex(opts && opts.tab), lists: {}, modals: [], toasts: [], busy: 0, data: null, dataT: -999, mode: 'relation', tapAt: null, closed: false, tick: 0, mapCv: null, mapKey: '', details: {}, _memo: {}, mapView: (opts && opts.view) || 'world', bigView: 'sel', pane: 'list', scrollY: 0, tlFilter: 0, mapPts: null });
    bindTap(g);
    this.refresh(true);
    const w = this.data && this.data.w;
    this.sel = (opts && opts.sel) || (this.data && this.data.war && this.data.war.enemy) || (w && w.countries.find((c) => c.id === 'us') ? 'us' : w && w.countries[0] ? w.countries[0].id : null);
  }
  get tab() { return TABS[this.tabIdx]; }
  get big() { const p = this.bigPref(); return p == null ? portraitView() : !!p; }
  bigPref() { try { const f = this.g.state.world.flags; return f && f.uiBig != null ? f.uiBig : null; } catch (e) { return null; } }
  setBig(v) { try { this.g.state.world.flags.uiBig = !!v; } catch (e) { /* no state */ } this.pane = 'list'; this.scrollY = 0; sfx('cursor'); }
  mapStamp() { return `${this.mode}|${this.dataT}|${Math.floor(this.t / 20) % 2}`; }
  ls(id = this.tab.id) { return this.lists[id] || (this.lists[id] = { i: 1, top: 0 }); }
  rows() { return this._rows || []; }
  curRow() { const r = this.rows(); const st = this.ls(); return r[st.i] || null; }
  detail(id) { if (!this.details[id]) this.details[id] = safe(() => this.g.worldCountry(id), null); return this.details[id]; }
  memo(key, fn) { if (!(key in this._memo)) this._memo[key] = safe(fn, null); return this._memo[key]; }
  refresh(force = false) {
    if (!force && this.t - this.dataT < 45 && this.data) return;
    this.dataT = this.t;
    this.data = loadData(this);
    this.details = {};
    this._memo = {};
    this._rows = this.data.ok ? safe(() => this.tab.rows(this), []) || [] : [];
    const st = this.ls();
    if (st.i >= this._rows.length) st.i = Math.max(0, this._rows.length - 1);
    if (this._rows[st.i] && this._rows[st.i].header) st.i = this._rows.findIndex((r) => !r.header);
    if (st.i < 0) st.i = 0;
  }
  dirty() { this.dataT = -999; }
  setTab(i) { this.tabIdx = (i + TABS.length) % TABS.length; this.pane = 'list'; this.scrollY = 0; this.refresh(true); }
  gotoCountry(id) {
    this.setTab(TABS.indexOf(TAB_COUNTRIES));
    const j = this.rows().findIndex((r) => r.key === id);
    if (j >= 0) this.ls().i = j;
    this.focus = 'body';
    if (this.big) this.pane = 'detail';
  }
  moveRow(dir) {
    const rows = this.rows();
    const st = this.ls();
    let j = st.i;
    do { j += dir; } while (j >= 0 && j < rows.length && rows[j].header);
    if (j >= 0 && j < rows.length) { st.i = j; sfx('cursor'); return true; }
    return false;
  }
  update(g) {
    this.t++;
    for (const t of this.toasts) t.t++;
    this.toasts = this.toasts.filter((t) => t.t < 150);
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    const m = this.modals[this.modals.length - 1];
    if (m) { if (tap) m.tap(this, this.unscaleTap(tap, m), inp); m.update(this, inp); return; }
    if (this.busy > 0) return;
    this.refresh();
    if (tap && (this.big ? this.handleTapBig(tap, inp) : this.handleTap(tap, inp))) return;
    if (inp.pressed('menu')) { sfx('cancel'); this.close(); return; }
    if (this.focus === 'tabs') {
      if (inp.repeat('left')) { this.setTab(this.tabIdx - 1); sfx('cursor'); }
      else if (inp.repeat('right')) { this.setTab(this.tabIdx + 1); sfx('cursor'); }
      else if (inp.pressed('down') || inp.pressed('a')) { this.focus = 'body'; this.pane = 'list'; sfx('cursor'); }
      else if (inp.pressed('b')) { sfx('cancel'); this.close(); }
      return;
    }
    if (inp.pressed('b')) { sfx('cancel'); if (this.big && this.pane === 'detail' && this.tab.id !== 'map') { this.pane = 'list'; this.scrollY = 0; return; } this.focus = 'tabs'; return; }
    if (this.tab.id === 'map') { this.updateMap(inp); return; }
    if (this.big && this.pane === 'detail') {
      const maxS = Math.max(0, DETAIL.h * BIGZ - BIG.body.h + 8);
      if (inp.repeat('up')) { if (this.scrollY > 0) { this.scrollY = Math.max(0, this.scrollY - 40); sfx('cursor'); } return; }
      if (inp.repeat('down')) { if (this.scrollY < maxS) { this.scrollY = Math.min(maxS, this.scrollY + 40); sfx('cursor'); } return; }
      if (inp.repeat('left')) { if (this.moveRow(-1)) this.scrollY = 0; return; }
      if (inp.repeat('right')) { if (this.moveRow(1)) this.scrollY = 0; return; }
      if (inp.pressed('a')) { const r = this.curRow(); if (r && !r.header && this.tab.act) { sfx('ok'); this.act(() => this.tab.act(this, r)); } }
      return;
    }
    for (const dir of ['up', 'down']) {
      if (!inp.repeat(dir)) continue;
      if (!this.moveRow(dir === 'up' ? -1 : 1) && dir === 'up') { this.focus = 'tabs'; sfx('cursor'); }
      return;
    }
    if (inp.repeat('left')) { this.setTab(this.tabIdx - 1); sfx('cursor'); return; }
    if (inp.repeat('right')) { this.setTab(this.tabIdx + 1); sfx('cursor'); return; }
    if (inp.pressed('a')) {
      const r = this.curRow();
      if (!r || r.header) return;
      if (this.big && !this.subActive()) { sfx('ok'); this.pane = 'detail'; this.scrollY = 0; return; }
      if (this.tab.act) { sfx('ok'); this.act(() => this.tab.act(this, r)); }
    }
  }
  updateMap(inp) {
    const d = this.data;
    if (!d || !d.ok) return;
    const pts = this.mapPts && this.mapPts.length ? this.mapPts : [...d.markers, ...insetPts(d.w.fictional)];
    const cur = pts.find((p) => p.id === this.sel) || pts[0];
    if (!cur) return;
    for (const [dir, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
      if (!inp.repeat(dir)) continue;
      let best = null, bs = Infinity;
      for (const p of pts) {
        if (p.id === cur.id) continue;
        const vx = p.x - cur.x, vy = p.y - cur.y;
        const along = vx * dx + vy * dy;
        if (along <= 1) continue;
        const across = Math.abs(vx * dy) + Math.abs(vy * dx);
        const s0 = along + across * 2.2;
        if (s0 < bs) { bs = s0; best = p; }
      }
      if (best) { this.sel = best.id; sfx('cursor'); } else if (dir === 'up') { this.focus = 'tabs'; sfx('cursor'); }
      return;
    }
    if (inp.pressed('a') && this.sel) { sfx('ok'); this.act(() => this.mapMenu()); }
  }
  async mapMenu() {
    const row = this.data.rows[this.sel];
    if (!row) return;
    const VV = this.big ? BIG_VIEWS : VIEWS;
    const vKey = this.big ? 'bigView' : 'mapView';
    const vi = Math.max(0, VV.findIndex((v) => v.id === (this[vKey] || VV[0].id)));
    const nextV = VV[(vi + 1) % VV.length];
    const k = await this.pick({ title: row.name, items: [{ label: 'くわしく見る', sub: '国々のページ（関係の推移・できること）' }, { label: '外交の手段', sub: '首脳会談・条約・制裁・援助…' }, { label: `地図の範囲：${VV[vi].label} → ${nextV.label}`, sub: '世界・東アジア・東南アジア・中東・欧州' }, { label: `地図の色：${MODES.find((x) => x.id === this.mode).label} → ${MODES[(MODES.findIndex((x) => x.id === this.mode) + 1) % MODES.length].label}`, sub: '関係・陣営・同盟を切りかえる' }, { label: 'もどる' }] });
    if (k === 0) this.gotoCountry(this.sel);
    else if (k === 1) await actionsMenu(this, this.sel);
    else if (k === 2) this[vKey] = nextV.id;
    else if (k === 3) { this.mode = MODES[(MODES.findIndex((x) => x.id === this.mode) + 1) % MODES.length].id; this.mapKey = ''; }
  }
  tapMap(x, y, now) {
    for (const ch of this.chips || []) if (inR(x, y, ch)) { now.a = false; if (ch.view) { if (this.big) this.bigView = ch.view; else this.mapView = ch.view; } else { this.mode = ch.id; this.mapKey = ''; } sfx('cursor'); return true; }
    const pts = this.mapPts || [];
    let best = null, bd = this.big ? 22 : 14;
    for (const p of pts) { const dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; best = p; } }
    if (best) { this.focus = 'body'; if (this.sel !== best.id) { this.sel = best.id; now.a = false; sfx('cursor'); } return !now.a; }
    return null;
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    const { x, y } = tap;
    if (inR(x, y, { x: SW - 22, y: 0, w: 22, h: 20 })) { now.a = false; sfx('cancel'); this.close(); return true; }
    if (inR(x, y, this.bigRect)) { now.a = false; this.setBig(true); return true; }
    for (let i = 0; i < TABS.length; i++) if (inR(x, y, this.tabRects && this.tabRects[i])) { now.a = false; this.focus = 'tabs'; if (i !== this.tabIdx) { this.setTab(i); sfx('cursor'); } return true; }
    if (this.tab.id === 'map') {
      const r = this.tapMap(x, y, now);
      if (r != null) return r;
      if (y < 256) { now.a = false; return true; }
      return false;
    }
    const L = this.listRect;
    if (L && inR(x, y, L)) {
      const rows = this.rows();
      const st = this.ls();
      const j = (st.top || 0) + Math.floor((y - L.y - 2) / L.rh);
      if (j >= 0 && j < rows.length && !rows[j].header && j < (st.top || 0) + L.n) { this.focus = 'body'; if (j !== st.i) { st.i = j; now.a = false; sfx('cursor'); return true; } return false; }
      now.a = false; return true;
    }
    now.a = false;
    return true;
  }
  handleTapBig(tap, inp) {
    const now = inp.pressedNow || {};
    const { x, y } = tap;
    now.a = false;
    if (inR(x, y, this.closeRect)) { sfx('cancel'); this.close(); return true; }
    if (inR(x, y, this.bigRect)) { this.setBig(false); return true; }
    for (let i = 0; i < TABS.length; i++) if (inR(x, y, this.tabRects && this.tabRects[i])) { this.focus = 'body'; this.pane = 'list'; if (i !== this.tabIdx) { this.setTab(i); sfx('cursor'); } return true; }
    if (inR(x, y, this.backRect)) { this.pane = 'list'; this.scrollY = 0; sfx('cancel'); return true; }
    if (this.tab.id === 'map') { const r = this.tapMap(x, y, now); if (r === false) { now.a = true; return false; } return true; }
    if (this.pane === 'detail') {
      const B = BIG.body;
      const maxS = Math.max(0, DETAIL.h * BIGZ - B.h + 8);
      if (y < B.y + B.h / 3) this.scrollY = Math.max(0, this.scrollY - 60);
      else if (y > B.y + (B.h * 2) / 3) this.scrollY = Math.min(maxS, this.scrollY + 60);
      return true;
    }
    const L = this.listRect;
    if (L && inR(x, y, L)) {
      const rows = this.rows();
      const st = this.ls();
      const j = (st.top || 0) + Math.floor((y - L.y - 2) / L.rh);
      if (j >= 0 && j < rows.length && !rows[j].header && j < (st.top || 0) + L.n) { this.focus = 'body'; if (j !== st.i) { st.i = j; sfx('cursor'); } else if (this.subActive()) { if (this.tab.act) { sfx('ok'); this.act(() => this.tab.act(this, rows[j])); } } else { this.pane = 'detail'; this.scrollY = 0; sfx('ok'); } }
      return true;
    }
    return true;
  }
  async act(fn) { this.busy++; try { return await fn(); } catch (e) { console.error(e); return null; } finally { this.busy--; this.g.input.consume(); this.dirty(); } }
  openModal(m) { return new Promise((res) => { m._res = res; m.t = 0; this.modals.push(m); }); }
  closeModal(m, v) { const i = this.modals.lastIndexOf(m); if (i < 0) return; this.modals.splice(i, 1); this.g.input.consume(); m._res(v); }
  confirm(o) { return this.openModal(modal({ ...o, kind: 'confirm' })); }
  pick(o) { return this.openModal(modal({ ...o, kind: 'pick' })); }
  info(title, lines, o = {}) { return this.openModal(modal({ title, lines: [].concat(lines), choices: ['OK'], kind: 'confirm', ...o })); }
  toast(s, color = K.amber) { this.toasts.unshift({ text: String(s), t: 0, color }); if (this.toasts.length > 3) this.toasts.length = 3; }
  async result(title, r) {
    if (!r) { await this.info(title, ['うまくいかなかった。']); return; }
    if (r.ok === false) { sfx('buzz'); await this.info(title, [`できなかった：${r.why || '理由は不明'}`], { color: K.lock }); return; }
    sfx(r.success === false ? 'cancel' : 'good');
    await this.info(title, String(r.text || '実行した。').split('\n'));
    if (has(this.g, 'regimeFlush')) await safe(() => this.g.regimeFlush(), null);
    this.dirty();
    // the end of a life (the scene took the player back to the title)
    const life = has(this.g, 'regimeLifeOver') ? safe(() => this.g.regimeLifeOver(), null) : null;
    if (life || (this.g.state && this.g.state.regime && this.g.state.regime.id === 'fallen')) this.close();
  }
  // [R9-E] the bottom screen of a portrait phone (world_ui_sub.js)
  subActive() { return !!(this.sub && this.sub.box && this.sub.el.style.display === 'block'); }
  subTap() {
    if (this.closed || this.modals.length || this.busy > 0 || this.g.top !== this) return;
    if (this.focus === 'tabs') { this.focus = 'body'; sfx('cursor'); return; }
    if (this.tab.id === 'map') { if (this.sel) { sfx('ok'); this.act(() => this.mapMenu()); } return; }
    const r = this.curRow();
    if (r && !r.header && this.tab.act) { sfx('ok'); this.act(() => this.tab.act(this, r)); }
  }
  drawSub(c, b) {
    const { w, h, dpr } = b;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    R(c, 0, 0, w, h, K.bg);
    T(c, '▼ くわしく', 8, 4, 13, K.amber);
    T(c, this.tab.id === 'map' ? 'タップ：この国のメニュー' : 'タップ／A：決定', w - 8, 5, 12, K.dim, 'right');
    const z = Math.min((w - 8) / DETAIL.w, (h - 26) / DETAIL.h);
    const ox = Math.round((w - DETAIL.w * z) / 2);
    c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (ox - DETAIL.x * z), dpr * (22 - DETAIL.y * z));
    this.noList = true;
    try {
      if (this.tab.id === 'map') { if (this.sel) MORE.drawCountryDetail(this, c, this.sel); }
      else this.tab.draw(this, c);
    } catch (e) { console.error(e); } finally { this.noList = false; }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.sub) { this.sub.destroy(); this.sub = null; }
    for (const m of this.modals.splice(0)) m._res(null);
    this.g.pop(this);
    this.resolve(null);
  }
  // modals: scaled up in the big layout (z kept on the modal for the taps)
  modalZ(m) { if (!this.big || !m.box) return 1; return clamp(Math.min(1.45, (SW - 6) / m.box.w, (SH - 6) / m.box.h), 1, 1.45); }
  unscaleTap(tap, m) { const z = m._z || 1; return z === 1 ? tap : { x: (tap.x - SW / 2) / z + SW / 2, y: (tap.y - SH / 2) / z + SH / 2 }; }
  drawModals(c) {
    for (const m of this.modals) {
      R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.45)');
      const z = (m._z = this.modalZ(m));
      if (z === 1) { m.draw(this, c); continue; }
      c.save(); c.translate(SW / 2, SH / 2); c.scale(z, z); c.translate(-SW / 2, -SH / 2);
      m.draw(this, c);
      c.restore();
    }
  }
  draw(c, g) {
    void g;
    R(c, 0, 0, SW, SH, K.bg);
    const d = this.data;
    if (!d || !d.ok) { T(c, '世界情勢', 8, 3, 12, K.amber); T(c, '世界情勢の仕組み（world.js）が読み込まれていない', 20, 60, 12, K.dim); return; }
    if (this.big) this.drawBig(c); else this.drawNormal(c);
    if (subScreenWanted() && typeof document !== 'undefined') { if (!this.sub) this.sub = new SubScreen(this); this.sub.render((c2, b) => this.drawSub(c2, b)); }
    const ts = this.big ? 16 : 12;
    this.toasts.forEach((t, i) => { const w = Math.min(SW - 40, measure(c, t.text, ts) + 20); R(c, (SW - w) / 2, 300 - i * (ts + 10), w, ts + 8, 'rgba(0,0,0,0.85)'); T(c, t.text, SW / 2, 304 - i * (ts + 10), ts, t.color, 'center', w - 10); });
    this.drawModals(c);
  }
  tensionColor() { const t = this.data.w.tension; return t >= 55 ? K.bad : t >= 35 ? K.warn : K.good; }
  drawNormal(c) {
    const d = this.data;
    // header
    R(c, 0, 0, SW, 20, K.head);
    icon(c, 'globe', 6, 5, 1, K.amber);
    T(c, '世界情勢', 18, 3, 12, K.amber);
    T(c, `${d.w.date}　${d.role.label}`, 82, 4, 10, K.dim, 'left', 190);
    const tl = `${d.w.tensionLabel}・緊張${d.w.tension}`;
    T(c, tl, SW - 100, 4, 10, this.tensionColor(), 'right', 300);
    this.bigRect = { x: SW - 94, y: 2, w: 66, h: 16 };
    R(c, this.bigRect.x, 2, this.bigRect.w, 16, '#16283e'); R(c, this.bigRect.x, 2, 2, 16, K.cyan);
    T(c, '大きな文字', this.bigRect.x + 36, 4, 10, K.cyan, 'center', 60);
    T(c, '×', SW - 12, 3, 12, K.dim, 'center');
    // tabs (with icons)
    this.tabRects = [];
    const tw = SW / TABS.length;
    TABS.forEach((tb, i) => {
      const x = Math.round(i * tw), w = Math.round((i + 1) * tw) - x, on = i === this.tabIdx;
      R(c, x + 1, 21, w - 2, 18, on ? (this.focus === 'tabs' ? K.amber : K.panel2) : '#0a1424');
      if (on && this.focus !== 'tabs') R(c, x + 1, 37, w - 2, 2, K.amber);
      const alert = this.tabAlert(tb);
      const col = on && this.focus === 'tabs' ? K.ink : on ? K.amber : K.text;
      const lw = measure(c, tb.label, 12);
      const withIcon = tb.icon && lw + 14 <= w - 6;
      const cx = x + w / 2 + (withIcon ? 6 : 0);
      if (withIcon) icon(c, tb.icon, cx - lw / 2 - 12, 25, 1, on ? col : K.dim);
      T(c, tb.label, cx, 24, 12, col, 'center', w - 6);
      if (alert) R(c, x + w - 7, 23, 4, 4, K.bad);
      this.tabRects.push({ x, y: 20, w, h: 20 });
    });
    try { this.tab.draw(this, c); } catch (e) { console.error(e); }
    // ticker
    R(c, 0, 336, SW, 24, '#050b14');
    R(c, 0, 336, SW, 1, K.edge);
    const news = d.w.news.slice(0, 8).map((n) => n.text).join('　　◆　　') || d.w.summits.slice(0, 3).map((s0) => `${s0.year}年${s0.month}月　${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`).join('　　◆　　');
    const tw2 = measure(c, news, 12) + 80;
    const off = (this.t * 0.6) % Math.max(1, tw2);
    c.save(); c.beginPath(); c.rect(0, 337, 462, 22); c.clip();
    T(c, news, 8 - off, 341, 12, K.text); T(c, news, 8 - off + tw2, 341, 12, K.text);
    c.restore();
    R(c, 466, 338, 1, 20, K.edge);
    T(c, this.focus === 'tabs' ? '←→タブ　↓選ぶ　B閉じる' : this.tab.id === 'map' ? '十字で国を選ぶ　A決定　Bタブへ' : '↑↓選ぶ　←→タブ　A決定　B戻る', SW - 6, 343, 10, K.dim, 'right', 160);
  }
  tabAlert(tb) {
    const d = this.data;
    return (tb.id === 'crisis' && (d.war || d.w.crises.some((k) => k.sev >= 2))) || (tb.id === 'diplomacy' && ((d.w.offers || []).length || (d.w.diplo && d.w.diplo.visits))) || (tb.id === 'trade' && d.w.trade && (d.w.trade.frictions || d.w.trade.deals));
  }
  drawBig(c) {
    const d = this.data;
    // header
    R(c, 0, 0, SW, BIG.head, K.head);
    T(c, '世界情勢', 8, 4, 16, K.amber);
    T(c, d.w.date, 86, 6, 14, K.text);
    T(c, `緊張${d.w.tension}`, 200, 6, 14, this.tensionColor());
    this.bigRect = { x: SW - 148, y: 2, w: 104, h: 22 };
    R(c, this.bigRect.x, 2, this.bigRect.w, 22, '#16283e'); R(c, this.bigRect.x, 2, 3, 22, K.cyan);
    T(c, '文字を標準に', this.bigRect.x + 54, 5, 14, K.cyan, 'center', 96);
    this.closeRect = { x: SW - 40, y: 0, w: 40, h: BIG.head };
    T(c, '×', SW - 20, 3, 18, K.text, 'center');
    // tabs: a strip that keeps the current tab in view
    const ws = TABS.map((tb) => measure(c, tb.label, 14) + 34);
    const xs = []; let acc = 0; for (const w of ws) { xs.push(acc); acc += w; }
    const curC = xs[this.tabIdx] + ws[this.tabIdx] / 2;
    const off = clamp(curC - SW / 2, 0, Math.max(0, acc - SW));
    this.tabRects = [];
    R(c, 0, BIG.tabY, SW, BIG.tabH, '#0a1424');
    TABS.forEach((tb, i) => {
      const x = xs[i] - off, w = ws[i], on = i === this.tabIdx;
      if (x + w < 0 || x > SW) { this.tabRects.push(null); return; }
      R(c, x + 1, BIG.tabY + 1, w - 2, BIG.tabH - 2, on ? (this.focus === 'tabs' ? K.amber : K.panel2) : '#0d1a2c');
      if (on && this.focus !== 'tabs') R(c, x + 1, BIG.tabY + BIG.tabH - 3, w - 2, 3, K.amber);
      const col = on && this.focus === 'tabs' ? K.ink : on ? K.amber : K.text;
      if (tb.icon) icon(c, tb.icon, x + 8, BIG.tabY + 9, 1, on ? col : K.dim);
      T(c, tb.label, x + 21, BIG.tabY + 6, 14, col);
      if (this.tabAlert(tb)) R(c, x + w - 8, BIG.tabY + 4, 5, 5, K.bad);
      this.tabRects.push({ x, y: BIG.tabY, w, h: BIG.tabH });
    });
    if (off > 0) { R(c, 0, BIG.tabY, 14, BIG.tabH, 'rgba(7,16,28,0.9)'); T(c, '◀', 2, BIG.tabY + 7, 12, K.dim); }
    if (off < acc - SW - 1) { R(c, SW - 14, BIG.tabY, 14, BIG.tabH, 'rgba(7,16,28,0.9)'); T(c, '▶', SW - 12, BIG.tabY + 7, 12, K.dim); }
    // body
    const B = BIG.body;
    this.backRect = null;
    try {
      if (this.tab.id === 'map') this.drawBigMap(c);
      else if (this.pane === 'detail') {
        c.save();
        c.beginPath(); c.rect(B.x, B.y, B.w, B.h); c.clip();
        c.translate(4 - DETAIL.x * BIGZ, B.y + 2 - DETAIL.y * BIGZ - this.scrollY);
        c.scale(BIGZ, BIGZ);
        this.noList = true;
        try { this.tab.draw(this, c); } finally { this.noList = false; }
        c.restore();
        const maxS = Math.max(0, DETAIL.h * BIGZ - B.h + 8);
        if (maxS > 0) { const h = Math.max(20, (B.h * B.h) / (B.h + maxS)); R(c, SW - 4, B.y + ((B.h - h) * this.scrollY) / maxS, 3, h, K.edgeHi); }
      } else drawList(this, c, null);
    } catch (e) { console.error(e); }
    // footer
    R(c, 0, BIG.footY, SW, SH - BIG.footY, K.head); R(c, 0, BIG.footY, SW, 1, K.edge);
    let hint;
    if (this.focus === 'tabs') hint = '←→ タブ　↓ えらぶ　B とじる';
    else if (this.tab.id === 'map') hint = '十字 国をえらぶ　A メニュー　B タブへ';
    else if (this.subActive()) hint = '↑↓ えらぶ　A 決定　←→ タブ（くわしくは下の画面）';
    else if (this.pane === 'detail') {
      this.backRect = { x: 0, y: BIG.footY, w: 92, h: SH - BIG.footY };
      R(c, 2, BIG.footY + 3, 86, SH - BIG.footY - 6, '#16283e'); T(c, '◀ 一覧', 45, BIG.footY + 6, 14, K.text, 'center');
      hint = '↑↓ スクロール　←→ 前後　A 決定';
    } else hint = '↑↓ えらぶ　A くわしく　←→ タブ';
    T(c, hint, SW - 8, BIG.footY + 6, 14, K.dim, 'right', this.backRect ? SW - 104 : SW - 16);
  }
  drawBigMap(c) {
    const d = this.data;
    const dest = { x: 0, y: BIG.body.y, w: SW, h: 176 };
    const V = BIG_VIEWS.find((v) => v.id === this.bigView) || BIG_VIEWS[0];
    const r = drawMapView(this, c, dest, V.id === 'sel' ? { id: 'sel', z: V.z } : V.id, { labels: V.id !== 'world', regions: V.id === 'world', icons: true });
    this.mapPts = r.pts;
    // the view chips (12 px)
    this.chips = [];
    let x = 3;
    for (const v of BIG_VIEWS) {
      const w = measure(c, v.label, 12) + 12, on = this.bigView === v.id;
      if (x + w > SW - 4) break;
      R(c, x, dest.y + 3, w, 18, on ? K.cyan : 'rgba(10,20,34,0.85)');
      T(c, v.label, x + w / 2, dest.y + 6, 12, on ? K.ink : K.text, 'center');
      this.chips.push({ x, y: dest.y + 3, w, h: 18, view: v.id });
      x += w + 3;
    }
    // the selected country, in large type
    const y = dest.y + dest.h + 2;
    const row = this.sel && d.rows[this.sel];
    R(c, 0, y, SW, BIG.footY - y, K.panel);
    if (!row) return;
    const det = this.detail(this.sel);
    T(c, row.name, 8, y + 3, 16, K.amber, 'left', 300);
    T(c, det ? det.leader : '', 8, y + 23, 12, K.dim, 'left', 300);
    T(c, `${row.relation}`, SW - 150, y + 2, 24, relText(row.relation), 'right');
    T(c, row.relLabel, SW - 144, y + 4, 14, relText(row.relation), 'left', 140);
    T(c, '日本との関係', SW - 144, y + 21, 12, K.dim);
    const chipsL = [row.war ? ['戦争中', K.bad, 'war'] : null, row.ally ? ['同盟・協力', K.blue, 'ally'] : null, row.sanction ? [`日本が制裁${row.sanction}`, '#ff9a5a', 'ban'] : null, row.onJapan ? [`日本に制裁${row.onJapan}`, K.bad, 'ban'] : null, !row.ties ? [`国交：${row.tiesLabel}`, K.lock, null] : null, det && det.dispute ? [det.dispute.name, K.warn, 'dispute'] : null].filter(Boolean);
    let cx = 8;
    for (const [lab, col, ic] of chipsL) { const w = chip(c, cx, y + 40, lab, col, { icon: ic, size: 12 }); cx += w + 5; if (cx > SW - 100) break; }
    const issue = det && ((det.conflicts && det.conflicts.length ? `紛争：${det.conflicts.join('・')}` : '') || (d.w.crises.find((k) => k.country === row.id) || {}).title || det.note);
    para(c, issue || '', 8, y + (chipsL.length ? 60 : 42), SW - 16, 12, K.text, 15, chipsL.length ? 1 : 2);
  }
}
// A modal: confirm (title, lines, choices) or pick (title, lines?, items[{ label, sub, right, rightColor, lock }]).
function modal(o) {
  const m = {
    ...o, idx: o.index || 0, top: 0,
    get n() { return o.kind === 'pick' ? (o.items || []).length : (o.choices || ['OK']).length; },
    update(ui, inp) {
      m.t++;
      if (m.t < 4) return;
      const n = m.n;
      if (o.kind === 'pick') {
        if (inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
        if (inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
        if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); }
        else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, -1); }
        return;
      }
      // [R9-E] a long text scrolls with ↑↓ (the choices stay on ←→)
      if (m.over && inp.repeat('up')) { if (m.scroll > 0) { m.scroll--; sfx('cursor'); } }
      else if (m.over && inp.repeat('down')) { if (m.scroll < m.over) { m.scroll++; sfx('cursor'); } }
      else if (inp.repeat('left') || inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
      else if (inp.repeat('right') || inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); ui.closeModal(m, m.idx); }
      else if (inp.pressed('b') || inp.pressed('menu')) { sfx('cancel'); ui.closeModal(m, o.cancel != null ? o.cancel : (o.choices || ['OK']).length === 1 ? 0 : (o.choices || []).length - 1); }
    },
    tap(ui, tap, inp) {
      const now = inp.pressedNow || {};
      now.a = false;
      for (let i = 0; i < (m.rects || []).length; i++) if (inR(tap.x, tap.y, m.rects[i])) { if (m.idx === i || o.kind === 'confirm') { m.idx = i; ui.closeModal(m, i); } else m.idx = i; return; }
      if (m.over && inR(tap.x, tap.y, m.textRect)) { m.scroll = m.scroll >= m.over ? 0 : Math.min(m.over, m.scroll + 6); sfx('cursor'); return; }
      if (!inR(tap.x, tap.y, m.box)) ui.closeModal(m, o.kind === 'pick' ? -1 : o.cancel != null ? o.cancel : (o.choices || ['OK']).length - 1);
    },
    draw(ui, c) {
      const w = Math.min(SW - 40, o.w || 460);
      const x = Math.round((SW - w) / 2);
      const lines = [];
      for (const l of o.lines || []) lines.push(...jwrap(c, String(l ?? ''), w - 24, 12));
      if (o.kind !== 'pick' && lines.length > 14) { lines.length = 0; for (const l of o.lines || []) lines.push(...jwrap(c, String(l ?? ''), w - 40, 12)); } // room for ▲▼
      const pick = o.kind === 'pick';
      const rh = 28;
      const maxRows = pick ? Math.min(m.n, Math.max(3, Math.floor((SH - 80 - Math.min(lines.length, 6) * 16) / rh))) : 0;
      const maxL = pick ? 6 : 14;
      m.over = pick ? 0 : Math.max(0, lines.length - maxL);
      m.scroll = clamp(num(m.scroll), 0, m.over);
      const shownLines = lines.slice(m.scroll, m.scroll + maxL);
      const h = 26 + shownLines.length * 16 + (pick ? maxRows * rh + 8 : 38) + 6;
      const y = Math.round((SH - h) / 2);
      m.box = { x, y, w, h };
      R(c, x, y, w, h, '#0c1828');
      R(c, x, y, w, 2, o.danger ? K.danger : o.color || K.amber);
      R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
      T(c, o.title || '', x + 12, y + 7, 12, o.danger ? K.danger : o.color || K.amber, 'left', w - 24 - (m.over ? 116 : 0));
      shownLines.forEach((l, i) => T(c, l, x + 12, y + 26 + i * 16, 12, K.text, 'left', w - 24));
      m.textRect = { x, y: y + 22, w, h: shownLines.length * 16 + 4 };
      if (m.over) { if (m.scroll > 0) T(c, '▲', x + w - 16, y + 26, 12, K.amber); if (m.scroll < m.over) T(c, '▼', x + w - 16, y + 26 + (shownLines.length - 1) * 16, 12, K.amber); T(c, `${m.scroll + 1}-${m.scroll + shownLines.length}／${lines.length}行　↑↓`, x + w - 12, y + 8, 10, K.dim, 'right'); }
      else if (lines.length > shownLines.length) T(c, '…', x + w - 16, y + 26 + (shownLines.length - 1) * 16, 12, K.dim);
      m.rects = [];
      if (pick) {
        if (m.idx < m.top) m.top = m.idx;
        if (m.idx >= m.top + maxRows) m.top = m.idx - maxRows + 1;
        const y0 = y + 28 + shownLines.length * 16;
        for (let k = 0; k < maxRows && m.top + k < m.n; k++) {
          const it = o.items[m.top + k];
          const yy = y0 + k * rh;
          const sel = m.top + k === m.idx;
          R(c, x + 8, yy, w - 16, rh - 2, sel ? K.sel : '#0f2034');
          if (sel) R(c, x + 8, yy, 2, rh - 2, K.amber);
          const rw = it.right ? measure(c, it.right, 10) + 10 : 0;
          T(c, it.label, x + 16, yy + 2, 12, it.lock ? K.faint : K.text, 'left', w - 36 - rw);
          if (it.sub) T(c, it.sub, x + 16, yy + 15, 10, it.lock ? K.lock : K.dim, 'left', w - 36);
          if (it.right) T(c, it.right, x + w - 14, yy + 3, 10, it.rightColor || K.dim, 'right');
          m.rects[m.top + k] = { x: x + 8, y: yy, w: w - 16, h: rh - 2 };
        }
        if (m.n > maxRows) T(c, `${m.idx + 1}／${m.n}`, x + w - 12, y + 7, 10, K.dim, 'right');
      } else {
        const ch = o.choices || ['OK'];
        const bw = Math.min(180, Math.floor((w - 24 - (ch.length - 1) * 8) / ch.length));
        const total = ch.length * bw + (ch.length - 1) * 8;
        ch.forEach((label, i) => {
          const bx = x + Math.round((w - total) / 2) + i * (bw + 8), by = y + h - 34;
          const sel = i === m.idx;
          R(c, bx, by, bw, 26, sel ? (o.danger && i > 0 ? K.danger : K.amber) : '#16283e');
          T(c, label, bx + bw / 2, by + 6, 12, sel ? '#140c04' : K.text, 'center', bw - 8);
          m.rects[i] = { x: bx, y: by, w: bw, h: 26 };
        });
      }
    },
  };
  return m;
}

export async function openWorldScreen(g, opts = {}) {
  if (!g || !g.state || !has(g, 'world')) return null;
  if (g.auto && !g.auto.worldui) return null;
  const open = sceneOf(g);
  if (open) { if (opts.tab != null) open.setTab(tabIndex(opts.tab)); if (opts.sel) open.sel = opts.sel; return null; }
  sfx('ok');
  return new Promise((resolve) => { const sc = new WorldScene(g, opts, resolve); g.push(sc); });
}
Game.prototype.worldScreen = function worldScreen(tab, opts = {}) { return openWorldScreen(this, { ...opts, tab }); };

// ================================================================ the phone app 「世界」 (era-framed)
const APP_COLOR = '#2a6a9a';
const eraOfG = (g) => (g.state && g.state.profile && g.state.profile.era) || 'reiwa';
const FRAME = { showa: '新聞の国際面', heisei_early: 'ケータイの国際ニュース', heisei: 'ケータイの国際ニュース', reiwa: '国際ニュース' };
const short = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
async function worldApp(g) {
  if (!has(g, 'world')) { await phoneInfo(g, { title: '世界', color: APP_COLOR, lines: ['（世界情勢の仕組みが読み込まれていない）'] }); return; }
  let index = 0;
  for (;;) {
    const w = g.world();
    const war = has(g, 'war') ? g.war() : null;
    const items = [
      { id: 'screen', label: '世界情勢の画面を開く', sub: '地図・国々・外交・危機' },
      { id: 'over', label: '概況', sub: `${w.tensionLabel}・緊張${w.tension}` },
      war ? { id: 'war', label: `戦争：${war.enemyShort}`, sub: war.frontText } : null,
      { id: 'news', label: FRAME[eraOfG(g)] || '国際ニュース', sub: w.news[0] ? short(w.news[0].text, 18) : '' },
      { id: 'crises', label: '世界の危機', sub: `${w.crises.length}件・紛争${w.conflicts.length}件` },
      { id: 'summits', label: '首脳会議の予定', sub: w.summits[0] ? `${w.summits[0].year}年${w.summits[0].month}月 ${short(w.summits[0].name, 10)}` : '' },
      { id: 'countries', label: '国々と日本の関係', sub: `${w.countries.length}か国` },
      has(g, 'worldRegions') ? { id: 'regions', label: '地域ごとの情勢', sub: (safe(() => g.worldRegions(), []) || []).filter((r) => r.status !== '安定').map((r) => r.name).slice(0, 3).join('・') || 'どの地域も安定' } : null,
      has(g, 'worldTimeline') ? { id: 'timeline', label: '世界の年表', sub: (() => { const e = (safe(() => g.worldTimeline({ filter: 'real', n: 1 }), []) || [])[0]; return e ? short(`${e.date} ${e.text}`, 18) : ''; })() } : null,
      has(g, 'tariffs') ? { id: 'rates', label: '関税率の一覧', sub: `関税収入 約${safe(() => g.tariffRevenue().total, '—')}兆円/年` } : null,
      has(g, 'tariffs') ? { id: 'trade', label: '貿易と関税の動き', sub: w.trade && w.trade.frictions ? `貿易摩擦 ${w.trade.frictions}件` : '貿易摩擦はない' } : null,
      has(g, 'diplomaticStanding') ? { id: 'score', label: '外交の通信簿', sub: w.diplo ? `${w.diplo.grade}（${w.diplo.score}点）` : '' } : null,
      has(g, 'mofaAdvice') ? { id: 'advice', label: '外務省の助言', sub: '' } : null,
      has(g, 'dietTreaties') ? { id: 'diet', label: '国会で審議中の条約・関税法案', sub: `${(safe(() => g.dietTreaties(), []) || []).filter((d) => d.status === 'open').length}件` } : null,
    ].filter(Boolean);
    const i = await phoneList(g, { title: '世界', color: APP_COLOR, index, items: items.map((x) => ({ label: x.label, sub: x.sub })) });
    if (i < 0) return;
    index = i;
    const id = items[i].id;
    if (id === 'screen') { if (g.auto && !g.auto.worldui) continue; await openWorldScreen(g, { tab: 'map' }); }
    else if (id === 'over') await phoneInfo(g, { title: '概況', color: APP_COLOR, lines: [`${w.date}　世界は「${w.tensionLabel}」（緊張 ${w.tension}／100）`, `日本の国際的な信頼 ${w.standing}／100・日本への脅威 ${w.threat}／100`, `原油価格（指数）${w.oil}`, '', '陣営：', ...Object.values(w.blocs).map((b) => `・${b.name}：${b.members.map((x) => (w.countries.find((c) => c.id === x) || {}).short || x).join('・')}`), '', `日本の同盟・協力：${w.alliances.filter((a) => a.japan).map((a) => a.short || a.name).join('・') || 'なし'}`, `日本の制裁：${w.sanctions.byJapan.map((x) => `${x.name}（段階${x.level}）`).join('・') || 'なし'}`] });
    else if (id === 'war' && war) await phoneInfo(g, { title: `戦争：${war.enemyShort}`, color: APP_COLOR, lines: [war.modeName, `戦況：${war.frontText}`, ...war.fronts.map((f) => `・${f.name}：${f.control >= 0 ? '優勢' : '劣勢'}${Math.abs(f.control)}（作戦の見込み${f.odds}%）`), `死者 兵士${n0(war.cas.soldiers.dead)}人・民間人${n0(war.cas.civilians.dead)}人`, `相手側の死傷者 ${n0(war.cas.enemySoldiers + war.cas.enemyCivilians)}人`, '（命令は「世界情勢の画面」の「危機・戦争」から）'] });
    else if (id === 'news') await phoneInfo(g, { title: FRAME[eraOfG(g)] || 'ニュース', color: APP_COLOR, lines: w.news.length ? w.news.slice(0, 16).map((n) => `・${n.text}`) : ['まだニュースはない。'] });
    else if (id === 'crises') await phoneInfo(g, { title: '世界の危機', color: APP_COLOR, lines: [...(w.crises.length ? w.crises.map((k) => `・${k.title}`) : ['・いまは大きな危機はない']), '', '紛争：', ...(w.conflicts.length ? w.conflicts.map((k) => `・${k.name}`) : ['・いまはない'])] });
    else if (id === 'summits') await phoneInfo(g, { title: '首脳会議の予定', color: APP_COLOR, lines: w.summits.map((s0) => `・${s0.year}年${s0.month}月　${s0.name}${s0.hostName ? `（${s0.hostName}）` : ''}`) });
    else if (id === 'rates') {
      const t = g.tariffs();
      await phoneInfo(g, { title: '関税率の一覧', color: APP_COLOR, lines: [...t.cats.map((c) => `・${c.name.replace(/（.*$/, '')}：${c.rateText.replace(/（.*$/, '')}${c.changed ? `（歴史では${c.histText.replace(/（.*$/, '')}）` : ''}`), '', `関税収入 約${t.revenue.total}兆円/年（歴史との差 ${t.revenue.delta >= 0 ? '+' : ''}${t.revenue.delta}兆円）`, `輸出 ${t.macro.exports}兆・輸入 ${t.macro.imports}兆円　収支 ${t.macro.balance >= 0 ? '+' : ''}${t.macro.balance}兆円`] });
    }
    else if (id === 'trade') {
      const t = g.tariffs();
      const open = t.frictions.filter((f) => f.status === 'open');
      await phoneInfo(g, { title: '貿易と関税の動き', color: APP_COLOR, lines: [...(open.length ? open.map((f) => `・貿易摩擦：${f.title}（${f.name}・期限${f.daysLeft}日）`) : ['・貿易摩擦はない']), ...t.partners.filter((p) => p.war > 0).map((p) => `・${p.name}：${p.warLabel}`), '', ...(t.ledger.length ? t.ledger.slice(0, 6).map((e) => `・${e.text}`) : []), '', '画面で関税率の改正・追加関税・交渉ができる（総理・担当大臣）'] });
    }
    else if (id === 'score') {
      const st = g.diplomaticStanding();
      await phoneInfo(g, { title: '外交の通信簿', color: APP_COLOR, lines: [`${st.grade}　${st.label}（${st.score}点・前月比 ${st.trend >= 0 ? '+' : ''}${st.trend}）`, ...st.parts.map((p) => `・${p.label} ${p.value}`)] });
    }
    else if (id === 'advice') {
      const a = g.mofaAdvice();
      await phoneInfo(g, { title: '外務省の助言', color: APP_COLOR, lines: a.flatMap((x) => [`【${x.who}】`, x.text]) });
    }
    else if (id === 'diet') {
      const d = (g.dietTreaties() || []).slice(0, 6);
      await phoneInfo(g, { title: '国会で審議中', color: APP_COLOR, lines: d.length ? d.flatMap((x) => [`・${x.name}`, `　${x.stageName}${x.estimate ? `（通過の見込み ${Math.round(x.estimate.pass * 100)}%）` : ''}`]) : ['審議中の条約・関税法案はない。'] });
    }
    else if (id === 'regions') {
      const rs = g.worldRegions();
      await phoneInfo(g, { title: '地域ごとの情勢', color: APP_COLOR, lines: rs.flatMap((r) => [`【${r.name}】${r.status}（緊張${r.temp}）`, `　関係の平均 ${r.avgRel}・貿易 約${r.trade}%`, ...r.conflicts.map((x) => `　紛争：${x}`), ...r.crises.slice(0, 2).map((x) => `　危機：${x}`)]) });
    }
    else if (id === 'timeline') {
      const tl = g.worldTimeline({ n: 30 });
      await phoneInfo(g, { title: '世界の年表', color: APP_COLOR, lines: tl.length ? tl.map((e) => `${e.date}　${e.text}`) : ['まだ記録はない。'] });
    }
    else if (id === 'countries') {
      const list = w.countries.slice().sort((a, b) => b.relation - a.relation);
      const k = await phoneList(g, { title: '国々と日本の関係', color: APP_COLOR, items: list.map((c) => ({ label: short(c.name, 12), sub: `${c.relLabel}・${BLOC_SHORT(w, c.bloc)}${c.war ? '・戦争中' : ''}`, right: `${c.relation}` })) });
      if (k >= 0) { const det = g.worldCountry(list[k].id); await phoneInfo(g, { title: short(det.name, 12), color: APP_COLOR, lines: [det.leader, det.gov, `関係 ${det.relation}（${det.relLabel}）・国交：${det.tiesLabel}`, det.member && det.member.length ? `加盟：${det.member.join('・')}` : null, det.note, det.dispute ? `【${det.dispute.name}】${det.dispute.lines.join('')}` : null].filter(Boolean) }); }
    }
  }
}
const BLOC_SHORT = (w, b) => (w.blocs[b] ? w.blocs[b].short : '');
registerPhoneApp('world', {
  name: '世界', color: APP_COLOR, order: 61,
  iconHD(c, x, y) {
    appTile(c, x, y, '#1a4a72');
    // a small globe: the ocean, two land shapes, a meridian
    const cx = x + 16, cy = y + 16;
    for (let dy = -9; dy <= 9; dy++) { const hw = Math.round(Math.sqrt(81 - dy * dy)); c.fillStyle = '#4fb0e8'; c.fillRect(cx - hw, cy + dy, hw * 2, 1); }
    c.fillStyle = '#6ad08a'; c.fillRect(cx - 6, cy - 5, 5, 4); c.fillRect(cx - 4, cy - 1, 3, 5); c.fillRect(cx + 2, cy - 6, 5, 3); c.fillRect(cx + 3, cy - 3, 3, 6);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(cx, cy - 9, 1, 18); c.fillRect(cx - 9, cy, 18, 1);
  },
  badge: (g) => { try { const w = g.world(); const r = roleOf(g); const role = r.kind !== 'citizen' && r.kind !== 'member'; return (has(g, 'war') && g.war() ? 1 : 0) + (role ? Math.min(3, w.crises.filter((k) => k.sev >= 2).length + (w.offers || []).length) : 0) + (role ? Math.min(2, (w.trade && w.trade.frictions) || 0) + Math.min(1, (w.diplo && w.diplo.visits) || 0) : 0); } catch (e) { return 0; } },
  cond: (g) => has(g, 'world'),
  open: (g) => worldApp(g),
});
if (typeof window !== 'undefined') window.__worldui = { scene: () => sceneOf(window.__game), open: openWorldScreen, TABS, MAP, VIEWS, BIG, grid, project, tabIndex, flows: { countryInfoModal, negoEntry, negoFlow, tariffFlow, partnerMenu, frictionFlow, territoryFlow, stanceInfo, diploFlow, actionsMenu } };
