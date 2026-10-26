// 縦画面の「大きな文字」: the information screens (R12-U1) — ニュース · 世論の声 · 審査員名鑑. Adapters for bigtext.js (see bigtext_screens.js for the
// idea): each reads the scene on top (its public fields) and returns what to show for the SELECTED item in 18-22 px type, the tabs as big chips
// and the rows as big tappable rows. Taps call the scene's own methods (setTab / open / chipAct …) or press the same button as the pad.
import { registerBigtext, padPress, captureText, linesToBlocks, modalSpec } from './bigtext.js';
import { SECTIONS, SEC } from './news_data.js';
import { AGE_GROUPS, VOICE_AREAS } from './govt.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { return d; } };
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const k10 = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : Math.round(n).toLocaleString('ja-JP'));

// ---------------------------------------------------------------- ニュース
const NEWS_PAL = {
  paper: { light: true, pal: { bg: '#f1ebda', head: '#e6dcc4', chip: '#e2d8c0', line: '#b9ae92', ink: '#1e1d22', dim: '#5d5a52', sel: '#e3d6b4' } },
  site: { light: true, pal: { bg: '#f4f6fa', head: '#dfe6f2', chip: '#dfe6f2', line: '#c4cad8', ink: '#1a1e2a', dim: '#5a6274', sel: '#fff2b8' } },
  app: { light: true, pal: { bg: '#eef0f4', head: '#ffffff', chip: '#ffffff', line: '#d6dae2', ink: '#16181e', dim: '#5c6170', sel: '#ffe9ec' } },
};
const newsTabs = (s) => SECTIONS.map((t) => (t.id === 'top' && s.form === 'paper' ? '一面' : t.label)).concat('検索');
const FIND_CHIPS = ['あなた', '選挙', '逮捕', '優勝', '地震', '株', '台風', '新幹線', 'M-1', '五輪'];
function newsDate(s, it) {
  const g = s.g;
  if (it.real && it.dateText) return it.dateText;
  return (has(g, 'dateFull') ? safe(() => g.dateFull(it.day), '') : '') || `${it.day}日目`;
}
function ago(g, day) { const d = num(g.state.day) - num(day); return d <= 0 ? 'きょう' : d === 1 ? 'きのう' : d < 10 ? `${d}日前` : `${Math.floor(d / 10)}か月前`; }
const headOf = (it) => String(it.head || '').replace(/^【[^】]*】/, '');
function newsBody(it) {
  const h = String(it.head || '').replace(/\s/g, '');
  return it.body && String(it.body).replace(/\s/g, '') !== h ? String(it.body) : `${headOf(it)}\n\n${it.real ? '' : '続報が入りしだい、お伝えします。'}`;
}
registerBigtext({
  id: 'news',
  match: (s) => !!s.isNewsUI && !s.closed,
  key: (s) => [s.tab, s.sel[s.tabId] | 0, s.article ? s.article.key : '', s.gogai ? s.gogai.key : '', s.focus, s.rows ? s.rows.length : 0, s.q, s.findFocus ? 1 : 0, s.chipIdx | 0, s.front && s.front.top ? s.front.top.key : ''].join('|'),
  spec(s, g) {
    const form = NEWS_PAL[s.form] || NEWS_PAL.app;
    const id = s.tabId;
    const sec = SEC[id] || { col: '#4a4a5a' };
    const col = s.form === 'paper' ? '#1e1d22' : s.form === 'site' ? '#1a4a9a' : sec.col || '#e8323c';
    const base = { ...form, color: col, sid: `news:${id}` };
    const tabs = { items: newsTabs(s), index: s.tab, onPick: (i) => { s.focus = 'body'; s.article = null; if (i !== s.tab) s.setTab(i); } };
    // 号外
    if (s.gogai) {
      const it = s.gogai;
      return { ...base, sid: `news:gogai:${it.key}`, color: '#c8102e', tag: '号外', title: headOf(it), sub: `${it.from || 'ドット新聞'}　${newsDate(s, it)}`, hint: 'タップ：一面へ', blocks: [{ t: newsBody(it), s: 19 }], onTap: () => padPress(g, 'a') };
    }
    const rows = s.rows || [];
    const sel = s.sel[id] | 0;
    const items = rows.map((it) => ({ label: headOf(it), sub: `${it.from || ''}　${it.real ? it.dateText : ago(g, it.day)}`, right: it.gogai ? '号外' : it.mine ? 'あなた' : it.isNew ? 'NEW' : '', rcol: it.gogai ? '#c8102e' : '#e8323c' }));
    const list = items.length ? { items, index: sel, rows: 3, onPick: (i) => { s.focus = 'body'; s.findFocus = false; if (s.article) { s.sel[id] = i; s.open(rows[i]); } else if (sel === i) s.open(rows[i]); else s.sel[id] = i; } } : null;
    // an article open
    if (s.article) {
      const it = s.article;
      const blocks = [{ t: newsBody(it), s: 19 }];
      if (it.mine) blocks.unshift({ chips: [['あなたのことが記事になっている', '#f0a020']] });
      return { ...base, sid: `news:art:${it.key}`, tabs, tag: (SEC[it.cat] || SEC.soc).label, title: headOf(it), sub: `${it.from || ''}　${newsDate(s, it)}`, hint: `${sel + 1}／${rows.length}　タップ：もどる`, blocks, list, onTap: () => padPress(g, 'a') };
    }
    const spec = { ...base, tabs, list };
    if (id === 'find') {
      spec.tabs = [tabs, { items: [...FIND_CHIPS, '✎ ことばで'], index: s.q && FIND_CHIPS.includes(s.q) ? FIND_CHIPS.indexOf(s.q) : s.q ? FIND_CHIPS.length : -1, onPick: (i) => { s.focus = 'body'; s.chipIdx = i; s.findChip(i); } }];
      if (!s.q) { spec.title = 'ニュースを検索'; spec.blocks = [{ t: '話題のことばを選ぶか、「✎ ことばで」から自由に入力して、これまでのニュースをさがせる。「あなた」で、あなたが出た記事だけを集める。', s: 19 }]; return spec; }
    }
    if (id === 'weather' && s.wx) {
      const W = s.wx, t = W.today || {};
      spec.title = `${t.regionName || ''}　${t.label || ''}`;
      spec.sub = `最高 ${t.high}℃・最低 ${t.low}℃${t.temp != null ? `・いま ${t.temp}℃` : ''}`;
      const warns = (t.warnings || []).map((x) => (typeof x === 'string' ? x : x && (x.label || x.name))).filter(Boolean);
      const blocks = [{ kv: ['降水確率', t.pops ? t.pops.map((p) => `${p}%`).join(' / ') : `${t.pop}%`] }];
      if (warns.length) blocks.push({ kv: ['注意', warns.join('・'), '#d8303a'] });
      blocks.push({ h: 'きょうの全国' });
      for (const r of W.regions || []) blocks.push({ kv: [r.city, `${r.label || ''}　${r.high}℃／${r.low}℃　${r.pop}%`] });
      if ((W.week || []).length) { blocks.push({ h: '週間予報' }); for (const d of W.week.slice(0, 7)) blocks.push({ kv: [`${d.month}/${d.date}`, `${d.label || ''}　${d.high}／${d.low}℃　${d.pop}%`] }); }
      spec.blocks = blocks; spec.list = null;
      return spec;
    }
    if (id === 'tv') {
      spec.title = 'テレビ欄';
      const mine = [];
      for (const [rid, r] of Object.entries(g.state.regulars || {})) {
        if (!r || r.dropped || r.since == null) continue;
        const def = safe(() => require_regular(rid), null);
        if (def) mine.push(def);
      }
      spec.blocks = [{ t: 'きょうの番組表は、上の画面で6局を見比べられる。あなたが出ている番組には★がつく。', s: 19 }, ...(mine.length ? [{ h: 'あなたの番組' }, ...mine.map((t2) => ({ t: `『${t2}』`, s: 19 }))] : [])];
      spec.list = null;
      return spec;
    }
    if (!rows.length) { spec.title = id === 'find' ? `「${s.q}」の記事は見つからなかった。` : 'まだニュースはない。'; spec.blocks = []; return spec; }
    const it = rows[Math.min(sel, rows.length - 1)];
    spec.tag = (SEC[it.cat] || SEC.soc).label;
    spec.title = headOf(it);
    spec.sub = `${it.from || ''}　${newsDate(s, it)}`;
    spec.hint = `${sel + 1}／${rows.length}　タップ：よむ`;
    const blocks = [{ t: newsBody(it), s: 19 }];
    if (it.mine) blocks.unshift({ chips: [['あなたのことが記事になっている', '#f0a020']] });
    if (id === 'eco' && s.market) {
      const m = s.market;
      blocks.push({ h: '日経平均' }, { kv: ['終値', `${Math.round(m.price).toLocaleString('ja-JP')}円　${m.change >= 0 ? '+' : '−'}${(Math.abs(m.change) * 100).toFixed(2)}%`, m.change > 0 ? '#d8303a' : m.change < 0 ? '#2a6ac8' : undefined] });
    }
    spec.blocks = blocks;
    spec.onTap = () => s.open(it);
    return spec;
  },
});
// the player's own shows by id (the regulars table of life.js is not imported here: read it lazily)
let REG = null;
import('./life.js').then((m) => { REG = m.REGULARS; }).catch(() => { REG = null; });
function require_regular(id) { const d = REG && REG[id]; if (!d) return null; return typeof d.title === 'function' ? d.title() : d.title; }

// ---------------------------------------------------------------- 世論の声
const VTABS = ['声', '話題', '温度計', 'あなたへの声', 'デモ・運動'];
const STC = { pro: '#2f9a5a', con: '#d8404a', neutral: '#8a8a94' };
const STW = { pro: '賛成', con: '反対', neutral: '中立' };
function voiceBlocks(v, themeLight) {
  const col = themeLight ? '#1e1d22' : '#ffffff';
  const b = [{ t: `「${v.text}」`, s: 20, c: col }];
  if (v.reason) b.push({ gap: 4 }, { kv: ['理由', v.reason, STC[v.stance]] });
  b.push({ kv: ['話題', v.topic || v.event || '—'] });
  const eng = v.likes != null ? `いいね ${k10(v.likes)}${v.shares != null ? `・共有 ${k10(v.shares)}` : ''}` : v.res != null ? `レス ${v.res}件` : v.comments != null ? `コメント ${v.comments}件` : '';
  if (eng) b.push({ kv: ['反応', eng] });
  if (v.target === 'player') b.push({ chips: [['あなたについての声', '#f0a020']] });
  if (v.answered || v.ignored) b.push({ t: v.ignored ? '（静観した）' : '（答えた）', s: 16, c: '#8a8a94' });
  return b;
}
registerBigtext({
  id: 'voices',
  match: (s) => !!s.isVoicesUI && !s.closed,
  key: (s) => [s.tab, s.sel[s.tabId] | 0, s.focus, s.chip, s.rows ? s.rows.length : 0, JSON.stringify(s.f), s.thermo ? s.thermo.heat : '', s.modal ? `${s.modal.idx}|${s.modal.title}` : ''].join('|'),
  spec(s, g) {
    const th = s.th, light = s.themeId !== 'tv';
    if (s.modal) { return modalSpec(g, s.modal, { light, pal: { bg: th.bg, ink: th.ink, dim: th.dim, line: th.rule, sel: th.sel, chip: th.card, head: th.card }, color: th.acc }); }
    const id = s.tabId;
    const pal = { bg: th.bg, ink: th.ink, dim: th.dim, line: th.rule, sel: th.sel, chip: th.card, head: th.card };
    const base = { light, pal, color: th.acc || '#1d8af0', sid: `voices:${id}` };
    const tabs = { items: VTABS, index: s.tab, onPick: (i) => { s.focus = 'body'; s.chip = -1; if (i !== s.tab) s.setTab(i); } };
    const rows = s.rows || [];
    const sel = s.sel[id] | 0;
    const spec = { ...base, tabs };
    const pickRow = (i) => { s.focus = 'body'; s.chip = -1; if (sel === i) { padPress(g, 'a'); } else s.sel[id] = i; };
    if (id === 'tl') {
      const f = s.f;
      const labels = [`立場：${['すべて', '賛成', '反対', '中立'][f.stance]}`, `年代：${f.age ? AGE_GROUPS[f.age - 1] : 'すべて'}`, `地方：${f.region ? VOICE_AREAS[f.region - 1][0] : 'すべて'}`, `話題：${f.topic && s.trends && s.trends[f.topic - 1] ? s.trends[f.topic - 1].topic : 'すべて'}`, s.themeId === 'paper' ? '＋新しい投書' : '＋新しい声'];
      spec.tabs = [tabs, { items: labels, index: s.chip, onPick: (i) => { s.focus = 'body'; s.chip = i; s.chipAct(i); } }];
    }
    if (id === 'tl' || id === 'me') {
      spec.list = rows.length ? { items: rows.map((v) => ({ label: `「${v.text}」`, sub: `${v.job || ''}（${v.ageGroup || ''}）`, right: STW[v.stance], rcol: STC[v.stance] })), index: sel, rows: 3, onPick: pickRow } : null;
      if (!rows.length) { spec.title = id === 'me' ? 'まだあなたについての声はない' : '条件にあう声はない'; spec.blocks = [{ t: id === 'me' ? 'テレビに出る、賞レースで勝ち進む、選挙に出る、事件を起こす……ニュースになると、街の声やネットの声が集まってくる。' : '絞りこみの条件を変えてみよう。', s: 19 }]; return spec; }
      const v = rows[Math.min(sel, rows.length - 1)];
      spec.tag = STW[v.stance]; spec.color = STC[v.stance];
      spec.title = v.medium === 'letter' && v.name ? `${v.name}さん（${v.age}）` : `${v.job || ''}（${v.ageGroup || ''}）`;
      spec.sub = `${v.mediumLabel || ''}　${v.pref || ''}${v.region ? `（${v.region}）` : ''}`;
      spec.hint = 'タップ：答える';
      spec.blocks = voiceBlocks(v, light);
      spec.onTap = () => pickRow(sel);
      return spec;
    }
    if (id === 'trend') {
      spec.list = rows.length ? { items: rows.map((r) => ({ label: `${r.rank}　${r.topic}`, sub: `声${r.n}件・勢い${r.heat}`, right: r.mine ? 'あなた' : '', rcol: '#f0a020' })), index: sel, rows: 3, onPick: pickRow } : null;
      if (!rows.length) { spec.title = 'まだ話題はない'; spec.blocks = []; return spec; }
      const r = rows[Math.min(sel, rows.length - 1)];
      spec.title = r.topic; spec.sub = `声 ${r.n}件・勢い ${r.heat}`; spec.hint = 'タップ：声を見る';
      const b = [];
      for (const [k, lab] of [['pro', '賛成'], ['con', '反対'], ['neutral', '中立']]) { const pc = Math.round(((r[k] || 0) / Math.max(1, r.n)) * 100); b.push({ bar: [lab, pc / 100, STC[k], `${pc}%`] }); }
      const vs = safe(() => g.voices(3, { topic: r.topic }), []) || [];
      if (vs.length) b.push({ h: 'この話題の声' });
      for (const v of vs) b.push({ t: `「${v.text}」`, s: 18 }, { t: `${v.job}（${v.ageGroup || ''}）`, s: 15, c: th.faint });
      spec.blocks = b; spec.onTap = () => pickRow(sel);
      return spec;
    }
    if (id === 'thermo') {
      const m = s.thermo;
      spec.list = null;
      if (!m) { spec.title = '世論のしくみが読み込まれていない'; return spec; }
      spec.title = `世論の温度 ${m.heat}℃　${m.level}`; spec.color = m.color || spec.color;
      const b = [{ kv: ['内閣支持率', `${m.approval}%`] }, { kv: ['批判の声', `${m.con}%`, STC.con] }, { kv: ['応援の声', `${m.pro}%`, STC.pro] }, { kv: ['開かれているデモ', `${m.demos}件`] }];
      b.push({ t: '支持率が低く、批判の声やデモ、不祥事の話題が多いほど、温度は上がる。温度が高いと、政治の失敗が大きく取り上げられやすい。', s: 16, c: th.dim, gap: 6 });
      const me = m.me || {};
      b.push({ h: 'あなたへの温度', c: me.color });
      if (me.favor == null) b.push({ t: 'まだあなたは話題になっていない。ニュースになると、街の声が集まってくる。', s: 18 });
      else b.push({ kv: ['評判', me.level, me.color] }, { bar: ['好感', me.favor / 100, STC.pro, `${me.favor}%`] }, { kv: ['あなたの声', `${me.n}件（賛${me.pro}・否${me.con}）`] });
      b.push({ h: '年代別（＋応援／−批判）' });
      for (const r of (m.ages || []).filter((x) => x.n).slice(0, 8)) b.push({ kv: [r.key, `${r.mood > 0 ? '+' : ''}${Math.round(r.mood)}　（${r.n}件）`, r.mood >= 0 ? STC.pro : STC.con] });
      b.push({ h: '地方別' });
      for (const r of (m.regions || []).filter((x) => x.n).slice(0, 8)) b.push({ kv: [r.key, `${r.mood > 0 ? '+' : ''}${Math.round(r.mood)}　（${r.n}件）`, r.mood >= 0 ? STC.pro : STC.con] });
      spec.blocks = b;
      return spec;
    }
    // act
    const label = (r) => (r.kind === 'newDemo' ? '＋ デモ・集会を主催する' : r.kind === 'newCamp' ? '＋ 署名運動・街頭・ネットで訴える' : r.kind === 'demo' ? r.d.cause : `${r.c.label}：${r.c.cause}`);
    const subOf = (r) => (r.kind === 'demo' ? `${r.d.status === 'ended' ? '終了' : r.d.status === 'planned' ? '予定' : '開催中'}・${r.d.place}・約${k10(r.d.size)}人${r.d.joined ? '・参加した' : ''}` : r.kind === 'camp' ? `${k10(r.c.count)}／${k10(r.c.goal)}${r.c.unit}` : r.kind === 'newDemo' ? '準備にお金がかかる' : '見込みつき');
    spec.list = rows.length ? { items: rows.map((r) => ({ label: label(r), sub: subOf(r) })), index: sel, rows: 3, onPick: pickRow } : null;
    const r = rows[Math.min(sel, Math.max(0, rows.length - 1))];
    spec.title = r ? label(r) : 'デモ・運動';
    spec.hint = 'タップ：えらぶ';
    const b = [];
    if (r) b.push({ t: subOf(r), s: 19 });
    b.push({ t: 'デモや集会は、憲法21条が保障する表現の自由。署名や街頭での呼びかけ、ネットでの運動も、世論に訴える方法。人の数と勢いが大きいほど、政治と報道に響く。', s: 17, c: th.dim, gap: 8 });
    spec.blocks = b; spec.onTap = () => pickRow(sel);
    return spec;
  },
});

// ---------------------------------------------------------------- 審査員名鑑
const JPAGES = ['プロフィール', '好みの推移', 'あなたとの関係', '席の相関', '動向'];
registerBigtext({
  id: 'judges',
  match: (s) => !!s.isJudgeBook && !s.closed,
  key: (s) => [s.si, s.page, s.sel, s.focus, s.data && s.data.judges ? s.data.judges.length : 0, s.modals && s.modals.length ? `${s.modals.length}|${s.modals[s.modals.length - 1].idx}|${s.modals[s.modals.length - 1].title}` : ''].join('|'),
  spec(s, g) {
    if (s.modals && s.modals.length) { return modalSpec(g, s.modals[s.modals.length - 1], { color: '#ffd23f' }); }
    const D = s.data || { judges: [] };
    const J = D.judges || [];
    const sc = D.scope || {};
    const scopes = (s.scopes || []).map((x) => x.label);
    const p = s.cur;
    const spec = {
      sid: `judges:${s.si}:${s.page}`, color: '#ffd23f',
      tabs: [{ items: scopes, index: s.si, onPick: (i) => { s.focus = 'scope'; s.setScope(i - s.si); } }, { items: JPAGES, index: s.page, onPick: (i) => { s.page = i; s.focus = 'list'; } }],
      list: J.length ? { items: J.map((j) => ({ label: j.name, sub: `${String(j.title || '').replace(/（芸歴.*$/, '')}　${j.school || ''}`, right: j.moodWord ? '' : '' })), index: s.sel, rows: 3, onPick: (i) => { s.focus = 'list'; s.sel = i; } } : null,
    };
    if (!p) { spec.title = sc.label || '審査員名鑑'; spec.blocks = [{ t: 'この大会に審査員はいません。', s: 19 }]; return spec; }
    spec.title = p.name; spec.sub = `${D.year}年　${sc.label || ''}`; spec.tag = JPAGES[s.page];
    spec.hint = s.page === 2 ? 'タップ：たずねる' : '';
    const b = [];
    if (s.page === 0) {
      b.push({ t: String(p.title || ''), s: 17, c: '#a4acd0' });
      b.push({ kv: ['審査員歴', `${p.years + 1}年目`] }, { kv: ['いまは', `「${p.school}」`, '#ffd23f'] });
      if (p.baseSchool !== p.school) b.push({ t: `（就任時は${p.baseSchool}）`, s: 16, c: '#a4acd0' });
      b.push({ t: p.drift ? `この数年の変化：${p.drift}` : 'この数年、好みはほとんど変わっていない', s: 18 });
      b.push({ kv: ['きょうの機嫌', p.moodWord, p.mood > 0.2 ? '#5ee07a' : p.mood < -0.2 ? '#ff5d6c' : undefined] });
      if (p.goal) b.push({ h: 'いまの目標' }, { t: p.goal.label, s: 19 }, { bar: ['進み具合', Math.max(0, Math.min(1, num(p.goal.progress))), '#ffd23f', ''] }, { t: p.goal.note || '', s: 16, c: '#a4acd0' });
      const tr = p.tr || {};
      b.push({ h: '人がらの目安' });
      [['公平さ', tr.fair, 0.3, 0.97], ['流行への敏感さ', tr.open, 0.4, 1.2], ['頑固さ', tr.stub, 0, 1], ['記憶力', tr.mem, 0.5, 1.2]].forEach(([lb, v, lo, hi]) => b.push({ bar: [lb, Math.max(0.06, Math.min(1, ((v == null ? 0.5 : v) - lo) / (hi - lo))), '#ffd23f', ''] }));
      if (p.line) b.push({ t: `「${p.line}」`, s: 19, gap: 8 });
    } else if (s.page === 1) {
      const lines = captureText((c) => { if (typeof s.drawScreen === 'function') s.drawScreen(c, g); }, { x: 206, y: 72, w: 426, h: 266 });
      b.push(...linesToBlocks(lines, false));
    } else if (s.page === 2) {
      b.push({ t: String(p.thinks || ''), s: 20, c: '#ffd23f' });
      b.push({ kv: ['好意', `${Math.round(num(p.fo) * 100)}`] }, { kv: ['要求の高さ', `${Math.round(num(p.br) * 100)}`] }, { kv: ['見た回数', `${p.se}回`] }, { kv: ['機嫌', p.moodWord] });
      b.push({ h: 'これまでのコメント' });
      const cms = (p.cm || []).slice().reverse();
      if (!cms.length) b.push({ t: 'まだ、あなたのネタについて何も言っていない。', s: 18 });
      for (const m of cms.slice(0, 5)) b.push({ t: `${m[0]}日目・${m[1]}点`, s: 15, c: '#a4acd0' }, { t: `「${m[2]}」`, s: 19 });
      if ((p.fv || []).length) b.push({ h: 'お気に入り' }, { t: p.fv.map((f) => `『${f[0]}』${f[1]}点`).join('　'), s: 18 });
      spec.onTap = () => padPress(g, 'a');
    } else if (s.page === 3) {
      const M = D.corr || [], i = s.sel;
      const others = J.map((q, j) => [j, (M[i] || [])[j]]).filter(([j, v]) => j !== i && v != null).sort((a, c2) => c2[1] - a[1]);
      b.push({ t: '好みの近さ＋これまでの採点の近さ（0〜100）', s: 16, c: '#a4acd0' });
      for (const [j, v] of others) b.push({ kv: [String(J[j].name).split(' ')[0], `${v}`, v >= 66 ? '#5ee07a' : v >= 48 ? '#ffd23f' : '#ff7a8a'] });
      if (others.length) b.push({ gap: 6, t: `気が合うのは ${J[others[0][0]].name}、割れやすいのは ${J[others[others.length - 1][0]].name}。`, s: 18 });
    } else {
      const log = D.log || [];
      if (!log.length) b.push({ t: 'まだ動きはない。年が変わると、審査員の交代・引退の理由・世の中のはやりの変化がここに記録される。', s: 18 });
      for (const l of log.slice(0, 10)) b.push({ chips: [[l.k === 'seat' ? '交代' : l.k === 'panel' ? '大会' : 'はやり', l.k === 'seat' ? '#ffd23f' : l.k === 'panel' ? '#5fd7ff' : '#7fe08a']] }, { t: `${l.d}日目　${l.s}`, s: 18 });
    }
    spec.blocks = b;
    return spec;
  },
});
