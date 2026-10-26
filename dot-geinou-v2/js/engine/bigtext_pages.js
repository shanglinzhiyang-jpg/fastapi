// 縦画面の「大きな文字」: てちょう · 賞レース · 相方募集 / 芸人手帳 · 台本エディタ (R12-U1). Adapters for bigtext.js (see bigtext_screens.js).
import { registerBigtext, padPress, captureText, linesToBlocks, modalSpec } from './bigtext.js';
import { NOTEBOOK_TABS } from './notebook.js';
import { CONTEST_TABS, detailLines } from './contest_ui.js';
import { internals as CI } from './contests.js';
import { STYLES, ROLES } from './owarai_data.js';
import { KIND_LABEL, ROLE_LONG, BEAT_LONG } from './neta_ui_kit.js';

const safe = (fn, d = null) => { try { return fn(); } catch (e) { return d; } };
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const ell = (s, n) => { const a = Array.from(String(s == null ? '' : s)); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const GRAY = '#a4acd0';
// the modal on top of a scene of the neta kit / 賞レース / 芸人手帳 (s.modals[]) — shown by the lower screen as big rows (bigtext.js modalSpec)
const topModal = (s) => (s.modals && s.modals.length ? s.modals[s.modals.length - 1] : null);
const modalKey = (s) => { const m = topModal(s); return m ? `${s.modals.length}|${m.idx}|${m.tab == null ? '' : m.tab}|${m.title || ''}|${m.kind}` : ''; };

// ---------------------------------------------------------------- てちょう
// Page (notebook.js): blocks → lines { t, r, c, s, x, head, tag, mark }. A wrapped paragraph (same size / colour / indent) is joined again so it
// reflows in the wider room; a head line is a heading chip; a line with a right-hand text is a label / value row.
export function pageToBlocks(page) {
  const out = [];
  for (const b of page.blocks || []) {
    let para = null;
    const flush = () => { if (para) { out.push({ t: para.t, s: para.s, c: para.c, ind: para.ind }); para = null; } };
    for (const l of b.lines || []) {
      const t = l.t == null ? '' : String(l.t);
      const r = l.r == null ? '' : String(l.r);
      if (l.head) { flush(); if (t) out.push({ h: t, c: typeof l.head === 'string' ? l.head : undefined }); continue; }
      if (!t && !r) continue;
      if (r) { flush(); if (t) out.push({ kv: [t, r, l.rc] }); else out.push({ t: r, s: 18, c: l.rc }); continue; }
      const sz = (l.s || 14) <= 13 ? 16 : 18;
      const ind = Math.min(2, Math.round(num(l.x) / 12)) * 8;
      const tag = l.tag && l.tag.t ? `【${l.tag.t}】` : '';
      if (para && !tag && para.s === sz && para.c === l.c && para.ind === ind) para.t += t;
      else { flush(); para = { t: tag + t, s: sz, c: l.c, ind }; }
    }
    flush();
    out.push({ gap: 6 });
  }
  return out;
}
registerBigtext({
  id: 'notebook',
  match: (s) => !!s.isNotebook,
  key: (s) => `${s.tab}|${s.month}|${s.scroll ? s.scroll[s.tab] : 0}|${s.pages && s.pages[s.tab] ? 1 : 0}`,
  spec(s, g) {
    const tb = NOTEBOOK_TABS[s.tab] || NOTEBOOK_TABS[0];
    const tabs = { items: NOTEBOOK_TABS.map((t) => t.label), index: s.tab, color: tb.color, onPick: (i) => s.setTab(i) };
    const spec = { sid: `notebook:${tb.id}:${s.month}`, color: tb.color, title: tb.label, tag: 'てちょう', hint: s.head ? String(s.head).slice(0, 26) : '', tabs };
    const page = s.page;
    spec.blocks = page ? pageToBlocks(page) : [];
    if (tb.id === 'cal') {
      spec.tabs = [tabs, { items: ['◀ 前の月', '今月', '次の月 ▶'], index: s.month < 0 ? 0 : s.month > 0 ? 2 : 1, color: tb.color, onPick: (i) => s.setMonth(i === 0 ? s.month - 1 : i === 2 ? s.month + 1 : 0) }];
    }
    return spec;
  },
});

// ---------------------------------------------------------------- 賞レース
const CONTEST_PAL = { bg: '#110c1c', head: '#1b1330', chip: '#251a3c', line: '#3c2d5c', ink: '#f4eefc', dim: '#a99dc2', sel: '#2f2350', accent: '#ffd23f' };
const STATUS_JA = { entered: 'エントリー済み', passed: '勝ち上がり中', out: '敗退', champion: '優勝', withdrawn: '棄権' };
function contestRowSpec(s, g, row) {
  const id = s.tab.id;
  const b = [];
  let item = { label: '', sub: '', right: '' };
  let title = '', sub = '', tag = '', color = '#ffd23f';
  const dl = (cid, y) => safe(() => detailLines(g, cid, y), []) || [];
  const linesBlocks = (ls) => ls.map((l) => (l === '' ? { gap: 8 } : { t: l, s: 18 }));
  if (id === 'list') {
    if (row.filter) { title = row.label; sub = row.sub; b.push({ t: '大会の一覧の表示を切りかえる。タップで「すべて／出られる大会／エントリー中／開催中・受付中」。', s: 18 }); item = { label: row.label, sub: row.sub, color: '#5fd7ff' }; return { item, title, sub, tag, color, b, onTap: 'a' }; }
    const x = row.c;
    title = x.label; tag = x.statusLabel; sub = `${CI.KIND_LABEL[CI.kindOf(x.def)] || ''}${x.def.broadcaster ? `・${x.def.broadcaster}` : ''}`;
    color = CI.colorOf(x.def);
    b.push(...linesBlocks(dl(x.id, x.year)));
    item = { label: `${x.entry && x.entry.status !== 'withdrawn' ? '★ ' : row.el.ok ? '○ ' : '× '}${x.label}`, sub: sub + (row.el.ok ? '' : `・${row.el.why}`), right: x.statusLabel };
  } else if (id === 'entries') {
    const { e, cyc, def } = row;
    title = cyc ? cyc.label : def.name; tag = e.external ? (e.statusText || STATUS_JA[e.status] || '') : STATUS_JA[e.status] || e.status; sub = `エントリーNo.${e.no ?? '—'}　${e.unitName || ''}`; color = CI.colorOf(def);
    const today = CI.todayOf(g);
    if ((e.status === 'entered' || e.status === 'passed') && cyc && cyc.rounds[e.round]) { const rr = cyc.rounds[e.round]; const o = rr.options[num(e.picks && e.picks[e.round], 0)] || rr.options[0]; b.push({ chips: [[`次：${rr.name} ${o.day === today ? '今日' : CI.dateText(g, o.day)} ${o.venue}`, '#4a7ac8']] }); } else if (e.pending) b.push({ chips: [['結果待ち（翌朝発表）', '#e0902a']] });
    else if (e.final) b.push({ chips: [[`決勝 ${e.final.place}位`, '#e0b020']] });
    b.push(...linesBlocks(dl(row.id, row.year)));
    item = { label: title, sub: `${sub}`, right: tag };
  } else if (id === 'results') {
    const { r, def, year, e } = row;
    const cyc = CI.cycleOf(g, def, year), rr = cyc && cyc.rounds[r.round];
    const last = rr && cyc && rr.idx === cyc.rounds.length - 1;
    const res = r.withdrawn ? '棄権' : r.passed ? (last ? '優勝' : '合格') : r.place && last ? `${r.place}位` : '不合格';
    title = cyc ? cyc.label : def.name; tag = res; color = r.passed ? '#3fb86a' : r.withdrawn ? '#6a6a7a' : '#a05060';
    sub = `${r.revival ? '敗者復活戦' : rr ? rr.name : ''}　${r.day ? `${r.day}日目` : ''}　No.${e.no}`;
    if (r.place && r.of) b.push({ t: `${Math.round(r.of).toLocaleString('ja-JP')}${CI.unitWord(def)}中 ${Math.round(r.place).toLocaleString('ja-JP')}位${r.of > 60 ? '前後' : ''}`, s: 22 });
    b.push({ t: `結果：${res}`, s: 20, c: color });
    item = { label: title, sub, right: res };
  } else if (id === 'history') {
    const def = row.def;
    title = CI.contestName(def, CI.contestDate(g).year); sub = safe(() => CI.historyHead(g, def), '') || ''; color = CI.colorOf(def);
    const hs = safe(() => g.contestHistory(def.id), []) || [];
    if (!hs.length) b.push({ t: 'まだ一度も開催されていない。', s: 18 });
    for (const h of hs.slice(0, 12)) b.push({ kv: [`${h.year}年`, `${h.champion || '—'}${h.runnerUp ? `（準優勝：${h.runnerUp}）` : ''}`, h.playerPlace === 1 ? '#ffd23f' : undefined] });
    item = { label: title, sub: hs[0] ? `${hs[0].year} ${hs[0].champion}` : '—' };
  } else if (id === 'judges') {
    title = row.sc.label; sub = `${row.sc.year}年`;
    b.push({ t: row.names || '', s: 20 }, { t: 'タップで審査員名鑑をひらく。', s: 16, c: GRAY, gap: 8 });
    item = { label: title, sub: row.names };
  } else if (id === 'news') {
    const n = row.n, ls = String(n.text).split('\n');
    title = ls[0]; sub = `${n.day}日目`; tag = n.kind === 'personal' ? 'お知らせ' : '速報'; color = n.kind === 'personal' ? '#ffd23f' : '#ff3a6a';
    for (const l of ls.slice(1)) b.push({ t: l, s: 19 });
    item = { label: ls[0], sub: ls[1] || '', right: sub };
  }
  return { item, title, sub, tag, color, b };
}
registerBigtext({
  id: 'contest',
  match: (s) => !!s.isContestUI && !s.closed,
  key: (s) => `${s.tabIdx}|${s.ls().i}|${s.focus}|${s.rows().length}|${s.filter}|${s.cal ? `${s.cal.year}-${s.cal.month}-${s.cal.dom}` : ''}|${modalKey(s)}`,
  spec(s, g) {
    const mo = topModal(s);
    if (mo) { return modalSpec(g, mo, { pal: CONTEST_PAL }); }
    const id = s.tab.id;
    const tabs = { items: CONTEST_TABS.map((t) => t.label), index: s.tabIdx, onPick: (i) => { s.focus = 'body'; s.setTab(i); } };
    const base = { pal: CONTEST_PAL, sid: `contest:${id}`, color: '#ffd23f', tabs };
    if (id === 'calendar') {
      const cal = s.cal;
      const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);
      const days = ['1日ごろ', '2日', '3日', '4日', '5日', '6日', '7日', '8日', '9日', '10日'];
      const lines = captureText((c) => { if (typeof s.draw === 'function') s.draw(c, g); }, { x: 352, y: 44, w: 284, h: 288 });
      const blocks = linesToBlocks(lines.filter((l) => !/^[◀▶‹›]+$/.test(l.t)), false);
      const head = lines[0];
      return { ...base, title: head ? head.t : `${cal.year}年${cal.month}月`, tag: 'カレンダー', hint: `${cal.year}年`, tabs: [tabs, { items: months, index: cal.month - 1, onPick: (i) => { s.focus = 'body'; s.cal.month = i + 1; s.dirty && s.dirty(); } }, { items: Array.from({ length: 10 }, (_, i) => `${i + 1}`), index: cal.dom - 1, onPick: (i) => { s.focus = 'body'; s.cal.dom = i + 1; } }], blocks: blocks.slice(1), sid: `contest:cal` };
    }
    const rows = s.rows();
    const sel = s.ls().i | 0;
    if (!rows.length) {
      const empty = { entries: 'まだどの大会にもエントリーしていない。「大会一覧」から、出られる大会を探そう。', results: 'まだ結果はない。', news: '賞レースのニュースはまだない。' }[id] || '（なし）';
      return { ...base, title: s.tab.label, blocks: [{ t: empty, s: 19 }] };
    }
    const items = rows.map((r) => contestRowSpec(s, g, r).item);
    const cur = contestRowSpec(s, g, rows[Math.min(sel, rows.length - 1)]);
    return {
      ...base, color: cur.color, tag: ell(cur.tag, 12), title: cur.title, sub: cur.sub, hint: `${sel + 1}／${rows.length}　タップ：ひらく`, blocks: cur.b,
      list: { items, index: sel, rows: 3, onPick: (i) => { s.focus = 'body'; if ((s.ls().i | 0) === i) padPress(g, 'a'); else s.ls().i = i; } },
      onTap: () => { s.focus = 'body'; padPress(g, 'a'); },
    };
  },
});

// ---------------------------------------------------------------- 芸人手帳 / 相方募集 (OwScreen, owarai_ui.js)
const BOARD_STATUS = { none: '', sent: '返事待ち', replied: '返事が来た', met: '会った', formed: 'コンビ結成', ex: '元の相方', refused: 'ことわられた', declined: 'ことわった' };
registerBigtext({
  id: 'owarai',
  match: (s) => !!s.isOwaraiUI && !s.closed,
  key: (s) => `${s.tabIdx}|${s.ls().i}|${s.focus}|${s.rows().length}|${s.t >> 5}|${modalKey(s)}`,
  spec(s, g) {
    const mo = topModal(s);
    if (mo) { return modalSpec(g, mo, { pal: { bg: '#150f22', head: '#201632', chip: '#2a1e42', line: '#4a3a6a', sel: '#34264f' } }); }
    const tab = s.tab;
    const th = (s.cfg && s.cfg.theme) || {};
    const spec = { sid: `ow:${s.cfg.id}:${tab.id}`, color: '#ff7eb6', tag: typeof s.cfg.title === 'function' ? safe(() => s.cfg.title(g), '') : s.cfg.title, pal: { bg: '#150f22', head: '#201632', chip: '#2a1e42', line: '#4a3a6a', sel: '#34264f' } };
    void th;
    spec.tabs = { items: s.cfg.tabs.map((t) => t.label), index: s.tabIdx, onPick: (i) => { s.focus = 'body'; s.setTab(i); } };
    const rows = s.rows();
    const map = [];
    rows.forEach((r, i) => { if (!r.header) map.push(i); });
    const sel = s.ls().i | 0;
    const items = map.map((i) => { const r = rows[i]; return { label: r.c ? (r.c.met ? r.c.name : r.c.handle) : r.label, sub: r.c ? `${r.c.age}歳・${STYLES[r.c.style] || ''}・${ROLES[r.c.role] || ''}` : r.sub || '', right: r.right || '', rcol: r.rightColor }; });
    const at = Math.max(0, map.indexOf(sel));
    spec.list = items.length ? { items, index: at, rows: 3, onPick: (k) => { s.focus = 'body'; if (map[k] === sel) padPress(g, 'a'); else { s.ls().i = map[k]; } } } : null;
    const row = rows[sel];
    const foot = typeof tab.foot === 'function' ? safe(() => tab.foot(s), '') : '';
    if (!row || row.header) { spec.title = tab.label; spec.blocks = [{ t: foot || '', s: 18 }]; return spec; }
    const x = row.c;
    if (x) {
      spec.title = x.met ? x.name : x.handle;
      spec.sub = `${x.age}歳・${STYLES[x.style] || ''}・${ROLES[x.role] || ''}志望`;
      spec.tag = BOARD_STATUS[x.status] || x.statusLabel || '募集';
      const b = [{ t: String(x.post || ''), s: 20 }];
      if (!x.met) b.push({ t: '顔・人柄・相性は、会ってみるまでわからない。', s: 16, c: GRAY, gap: 8 });
      else {
        b.push({ h: `${x.name}（会って分かったこと）` });
        if (x.motive) b.push({ kv: ['理由', x.motive] });
        if (x.persona) b.push({ kv: ['性格', x.persona] });
        if (x.quirks && x.quirks.length) b.push({ kv: ['クセ', x.quirks.join('・')] });
        if (x.trial != null) b.push({ kv: ['ネタ合わせ', `${x.feel}（${x.trial}）`, x.trial >= 55 ? '#5ee07a' : '#ffd23f'] });
      }
      if (x.status === 'replied') b.push({ chips: [['返事が来た！　タップ：会いに行く', '#5ee07a']] });
      spec.blocks = b; spec.hint = 'タップ：えらぶ'; spec.onTap = () => { s.focus = 'body'; if (s.view === 'list') s.view = 'card'; /* the card page of the touch board is what the lower screen already shows */ padPress(g, 'a'); };
      return spec;
    }
    // any other tab: the text the tab draws in its detail area (DETAIL 244,42 392x292), read back from the draw
    spec.title = row.label || tab.label;
    spec.sub = row.sub || '';
    const lines = captureText((c) => { if (typeof tab.draw === 'function') tab.draw(s, c); }, { x: 244, y: 42, w: 392, h: 292 });
    const b = linesToBlocks(lines, false);
    if (foot) b.push({ t: foot, s: 16, c: GRAY, gap: 8 });
    spec.blocks = b; spec.hint = tab.act ? 'タップ：えらぶ' : '';
    spec.onTap = () => { s.focus = 'body'; padPress(g, 'a'); };
    return spec;
  },
});

// ---------------------------------------------------------------- 台本エディタ (EditorScene, neta_editor.js)
const isEditor = (s) => !!s.isNetaUI && !s.closed && !!s.n && Array.isArray(s.n.lines) && typeof s.roleLabel === 'function';
registerBigtext({
  id: 'neta_editor',
  match: (s) => isEditor(s),
  key: (s) => `${s.sel}|${s.n.lines.length}|${s.rev}|${s.focus}|${s.tool}|${s.live ? s.live.rev : -1}|${s.n.title || ''}|${modalKey(s)}`,
  spec(s, g) {
    const mo = topModal(s);
    if (mo) { return modalSpec(g, mo, { color: '#a98bff', roles: ROLE_LONG, beats: BEAT_LONG }); }
    const n = s.n, L = n.lines;
    const pal = s.skin && s.skin.dark === false ? { bg: '#f7efd2', head: '#ece2c0', chip: '#e4d8b0', line: '#c9bb8e', ink: '#2a2418', dim: '#6a5f46', sel: '#e8d49a' } : { bg: '#160f20', head: '#1e1529', chip: '#2a1e38', line: '#3c2d5c', sel: '#3a3060' };
    const light = !!(s.skin && s.skin.dark === false);
    const tools = typeof s.tools === 'function' ? s.tools() : [];
    const spec = {
      sid: `neta:${n.id || 'new'}`, color: '#a98bff', pal, light,
      tag: KIND_LABEL[n.kind] || 'ネタ', title: n.title || '（無題の台本）', sub: `${L.length}行`,
      tabs: tools.length ? { items: tools, index: s.focus === 'tools' ? s.tool : -1, onPick: (i) => { s.focus = 'tools'; s.tool = i; s.act(() => s.runTool(i)); } } : null,
    };
    const items = L.map((l, i) => ({ label: `${i + 1}  ${ell(l.text || '', 24)}`, sub: `${ROLE_LONG[l.role] || l.role}${l.beat ? `・${BEAT_LONG[l.beat] || l.beat}` : ''}`, right: '' }));
    spec.list = items.length ? { items, index: Math.min(s.sel, L.length - 1), rows: 3, onPick: (i) => { s.focus = 'lines'; s.sel = i; s.needEnsure = true; } } : null;
    const cur = L[s.sel];
    const b = [];
    if (cur) {
      b.push({ chips: [[s.roleLabel(cur.role), '#ff8a3d'], ...(cur.beat ? [[BEAT_LONG[cur.beat] || cur.beat, '#5a72d8']] : [])] });
      b.push({ t: cur.text || '（からっぽ）', s: 21 });
      const prev = L[s.sel - 1], next = L[s.sel + 1];
      if (prev) b.push({ t: `前：${ROLE_LONG[prev.role] || prev.role}「${ell(prev.text, 40)}」`, s: 16, c: GRAY, gap: 8 });
      if (next) b.push({ t: `次：${ROLE_LONG[next.role] || next.role}「${ell(next.text, 40)}」`, s: 16, c: GRAY });
      spec.hint = 'タップ：書きかえる';
      spec.onTap = () => { s.focus = 'lines'; s.act(() => s.editLine(s.sel)); };
    } else if (L.length) { b.push({ t: '台本の最後まで来た。タップで新しい行を足す。', s: 19 }); spec.hint = 'タップ：行を足す'; spec.onTap = () => { s.focus = 'lines'; padPress(g, 'a'); }; } else { b.push({ t: 'まだ1行もない。「部品から足す」か「自分で書く」から始めよう。', s: 19 }); }
    // the live feedback panel (running time, the laugh curve, 独自性 …) as text
    const lines = captureText((c) => { if (typeof s.drawScreen === 'function') s.drawScreen(c, g); }, { x: 432, y: 42, w: 202, h: 252 });
    if (lines.length) { b.push({ h: 'いまの出来' }); b.push(...linesToBlocks(lines, light)); }
    spec.blocks = b;
    return spec;
  },
});
