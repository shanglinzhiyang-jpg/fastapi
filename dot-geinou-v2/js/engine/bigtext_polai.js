// 縦画面の「大きな文字」: 政治家の動向 (R12-U1). The hub view of politics_ai_ui.js keeps its state in a closure, so it offers two small hooks inside
// a [R12-U1] region — v.bigtextKey(ui) and v.bigtext(ui) — that call aiHubSpec() below with accessors to that state; the adapter here picks them up
// whenever the 政治画面 (isPolUI) is open on that view. Any other view of the 政治画面 has no lower screen.
import { registerBigtext, padPress } from './bigtext.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const GRAY = '#a4acd0';

registerBigtext({
  id: 'polui',
  match: (s) => { if (!s.isPolUI || s.closed) return false; const v = typeof s.top === 'function' ? s.top() : null; return !!(v && typeof v.bigtext === 'function' && !v.modal); },
  key: (s) => { const v = s.top(); return `${s.views.length}|${typeof v.bigtextKey === 'function' ? v.bigtextKey(s) : s.t >> 4}`; },
  spec: (s) => s.top().bigtext(s),
});

// S: { g, ui, TABS, st, L (the tab's ListBox), rows (the rows of the tab), cache, profile(id), skin }
export function aiHubSpec(S) {
  const { g, ui, TABS, st, L, rows, cache, profile } = S;
  const tab = TABS[st.tab].id;
  const accent = '#5fb7ff';
  const spec = {
    sid: `polai:${tab}`, color: accent, tag: '政治家の動向',
    tabs: { items: TABS.map((t) => t.label), index: st.tab, onPick: (i) => { st.tab = i; } },
  };
  const sel = L ? L.idx | 0 : 0;
  const pick = (i) => { if (!L) return; if ((L.idx | 0) === i) padPress(g, 'a'); else L.idx = i; };
  if (tab !== 'meta' && rows && rows.length) {
    spec.list = { items: rows.map((r) => ({ label: r.label, sub: r.sub, right: r.right, rcol: r.rightColor })), index: Math.min(sel, rows.length - 1), rows: 3, onPick: pick };
  }
  const row = rows ? rows[Math.min(sel, rows.length - 1)] : null;
  const b = [];
  if (tab === 'roster') {
    if (!row) { spec.title = '政治家名鑑'; spec.blocks = [{ t: '議員を選ぶと、野心・立場・あなたへの印象・最近の行動が見られる。', s: 19 }]; return spec; }
    if (row.kind === 'filter') { spec.title = row.label; spec.sub = row.sub; spec.blocks = [{ t: 'タップで「全員／与党／野党／役職者／あなたに好意的／批判的／前議員・後継者／各党」と切りかえる。', s: 19 }]; spec.onTap = () => padPress(g, 'a'); spec.hint = 'タップ：切りかえ'; return spec; }
    if (row.kind !== 'agent') { spec.title = row.label; spec.sub = row.sub; spec.blocks = []; return spec; }
    const pr = profile(row.id);
    if (!pr) { spec.title = row.label; spec.blocks = []; return spec; }
    spec.title = pr.name; spec.color = row.color || accent;
    spec.sub = `${pr.partyName}${pr.faction ? `・${pr.faction}` : ''}　${pr.rungName}${pr.ex ? '（議席なし）' : ''}`;
    spec.hint = 'タップ：話を聞く';
    b.push({ t: `${pr.age}歳・当選${pr.wins}回・${pr.local ? '地方' : pr.house === 'sangi' ? '参議院' : '衆議院'}${pr.district ? `・${pr.district}` : ''}`, s: 18 });
    b.push({ t: pr.roles.length ? pr.roles.join('・') : '役職なし', s: 18, c: pr.roles.length ? '#ffd23f' : GRAY });
    if (pr.tags && pr.tags.length) b.push({ chips: pr.tags.slice(0, 3).map((t) => [t.text, t.color]) });
    b.push({ h: '経歴と目標' }, { kv: ['目標', pr.goal || '—', pr.goalRung > pr.rung ? '#5fd7ff' : undefined] }, { bar: ['準備', num(pr.ready) / 100, pr.ready >= 60 ? '#5ee07a' : pr.ready >= 40 ? '#ffd23f' : '#ffb04a', String(pr.ready)] });
    b.push({ h: 'あなたへの印象' }, { kv: ['印象', `${pr.attWord}（${num(pr.attitude) > 0 ? '+' : ''}${Math.round(num(pr.attitude))}）`, pr.attColor] });
    if (pr.memory) b.push({ t: `・${pr.memory.text}`, s: 18, c: pr.memory.w >= 0 ? '#b8e0a0' : '#ffb0a0' });
    else b.push({ t: '・これといった覚えはない', s: 17, c: GRAY });
    b.push({ h: 'いまの様子' }, { kv: ['気持ち', pr.moodWord, pr.mood >= 15 ? '#5ee07a' : pr.mood > -15 ? undefined : '#ffb04a'] });
    b.push({ bar: ['資金', Math.min(1, num(pr.fund) / 250), '#ffd23f', ''] }, { bar: ['人脈', num(pr.con) / 100, '#5fd7ff', ''] }, { bar: ['危うさ', num(pr.risk) / 100, pr.risk >= 55 ? '#ff5d6c' : pr.risk >= 35 ? '#ffb04a' : '#5ee07a', ''] }, { bar: ['体調', num(pr.hp) / 100, pr.hp >= 70 ? '#5ee07a' : pr.hp >= 45 ? '#ffb04a' : '#ff5d6c', ''] });
    b.push({ h: '重点課題' }, { t: (pr.priorities || []).join('・') || '—', s: 18 });
    b.push({ h: '立場（党の立ち位置とくらべて）' });
    for (const q of pr.positions || []) b.push({ kv: [q.name, Math.abs(q.v) < 0.12 ? '中間' : q.word, q.strong ? '#ffd23f' : undefined] });
    if (pr.acts && pr.acts.length) { b.push({ h: '最近の行動と理由' }); for (const a of pr.acts.slice(0, 3)) b.push({ t: `${a.date}　${a.text}`, s: 17 }); }
    spec.blocks = b; spec.onTap = () => padPress(g, 'a');
    return spec;
  }
  if (tab === 'log') {
    if (!row || row.kind !== 'log') { spec.title = '動向'; spec.blocks = [{ t: row && row.sub ? row.sub : '議員が自分で決めた動きが、新しい順に並ぶ。', s: 19 }]; return spec; }
    const l = row.l, pr = l.id ? profile(l.id) : null;
    spec.title = l.name || '政界'; spec.sub = `${l.date}${pr ? `　${pr.partyShort || ''}${pr.faction ? `・${pr.faction}` : ''}` : ''}`;
    b.push({ t: `${l.name ? `${l.name}氏が、` : ''}${l.text}`, s: 20 });
    if (pr) { b.push({ h: 'この人' }, { kv: ['役職', pr.roles[0] || pr.rungName] }, { kv: ['あなたへの印象', pr.attWord, pr.attColor] }, { kv: ['目標', pr.goal] }, { kv: ['気持ち', pr.moodWord] }); spec.hint = 'タップ：話を聞く'; spec.onTap = () => padPress(g, 'a'); }
    spec.blocks = b;
    return spec;
  }
  if (tab === 'map') {
    const q = row && row.kind === 'party' ? row.q : null;
    spec.title = q ? q.name : '党内勢力図'; spec.sub = q ? `議席${q.seats}・名鑑${q.n}人${q.ruling ? '・与党' : ''}` : '';
    if (q) {
      b.push({ kv: ['支持率', `${q.sup}%`] });
      if (q.strat) b.push({ bar: ['対政府（協調）', num(q.strat.coop) / 100, '#5fd7ff', `${q.strat.coop}%`] }, { kv: ['対決', `${q.strat.hawk}%`] });
      else if (q.ruling) b.push({ t: '与党：政府を支える立場', s: 18 });
      b.push({ h: '派閥・グループ' });
      for (const f of (q.factions || []).slice(0, 5)) b.push({ kv: [f.name, `${f.size}人`, num(f.mood) >= 0 ? '#5ee07a' : '#ff7a8a'] });
      if (!(q.factions || []).length) b.push({ t: '派閥・グループはない', s: 17, c: GRAY });
    }
    b.push({ t: '点が議員。党の中心は、議員たちの立場の平均。何年もかけて、ゆっくり動く。（地図は上の画面。Aで軸を変える）', s: 16, c: GRAY, gap: 8 });
    spec.blocks = b; spec.onTap = () => padPress(g, 'a'); spec.hint = 'タップ：軸を変える';
    return spec;
  }
  // meta
  const m = cache && cache.meta;
  spec.title = '政局'; spec.list = null;
  if (!m) { spec.blocks = [{ t: '政局のデータがまだない。', s: 19 }]; return spec; }
  b.push({ h: 'いま票を動かす争点' });
  const top = (m.issues || []).slice(0, 9), mx = Math.max(1, top[0] ? top[0].sal : 1);
  top.forEach((q, i) => b.push({ bar: [q.name, q.sal / mx, i < 3 ? '#ffd23f' : '#5a78c8', String(q.sal)] }));
  b.push({ kv: ['党どうしの距離（分極）', String(m.pol), m.pol >= 50 ? '#ffb04a' : undefined] });
  const strat = Object.entries(m.strat || {});
  if (strat.length) { b.push({ h: '野党の戦略（協調↔対決）' }); for (const [pid, sv] of strat.slice(0, 4)) { const q = (cache.parties || []).find((z) => z.id === pid); if (q) b.push({ bar: [q.short, num(sv.coop) / 100, '#5fd7ff', `${sv.coop}%`] }); } }
  const lg = (cache.log || []).filter((l) => l.kind === 'meta' || l.kind === 'strat').slice(0, 3);
  for (const l of lg) b.push({ t: `${l.date}　${l.text}`, s: 17 });
  spec.blocks = b;
  return spec;
}
