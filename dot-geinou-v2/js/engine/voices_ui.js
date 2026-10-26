// 世論の声 (R9-D): the HD voices screen (640x360), opened from the phone's 世論の声 / 投書欄 app and from the 政府中枢
// console. The look follows the year's medium: ～1994 新聞の投書欄, 1995～ ワイドショーの街の声, 2000～ 掲示板, 2010～ SNS; each
// voice card is drawn in its own medium (投書・街頭インタビュー・ワイドショー・掲示板・ブログ・SNS・動画のコメント).
// Tabs: 声（タイムライン＋絞りこみ） · 話題（トレンド） · 温度計（世論の温度・年代別・地方別・推移・あなたへの温度） ·
// あなたへの声（あなたについての声と、答えた記録） · デモ・運動（参加・主催・署名運動など）.
// Keys: ←→ tabs (on the filter row: choose a filter), ↑↓ choose, A act, B back, MENU close. Touch: tap tabs, chips, rows.
// Logic: voices_core.js (+ govt.js g.voices / demos). API doc: test-output/api_r9d.txt.
import { Game } from './game.js';
import { SW, SH, clamp, fmtMoney } from './util.js';
import { text, wrap, measure } from './draw.js';
import { audio } from './audio.js';
import { fitText } from './phone.js';
import { ERAS } from './profile.js';
import { AGE_GROUPS, VOICE_AREAS, DEMO_PLACES, DEMO_COST } from './govt.js';
import { CAMPAIGN_CAUSES, ystate } from './voices_core.js';
import { drawNewsImage } from './news_art.js';

let ASK = null;
import('./textinput.js').then((m) => { ASK = m; }).catch(() => { ASK = null; });

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* tests */ } };
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const T = (c, s, x, y, size = 12, col = '#222', align = 'left', maxW = 0) => text(c, maxW > 0 ? fitText(c, String(s), maxW, size) : String(s), x, y, { size, color: col, align, shadow: null });
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
function frame(c, x, y, w, h, col) { R(c, x, y, w, 1, col); R(c, x, y + h - 1, w, 1, col); R(c, x, y, 1, h, col); R(c, x + w - 1, y, 1, h, col); }
function para(c, s, x, y, w, size, col, lh, maxLines = 99) {
  const all = wrap(c, String(s || ''), w - size, size);
  const ls = all.slice(0, maxLines);
  if (all.length > maxLines && ls.length) ls[ls.length - 1] = fitText(c, ls[ls.length - 1] + '……', w, size);
  ls.forEach((l, i) => T(c, l, x, y + i * lh, size, col));
  return y + ls.length * lh;
}
function disc(c, cx, cy, r, col) { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } }
const hashN = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
const STC = { pro: '#2f9a5a', con: '#d8404a', neutral: '#8a8a94' };
const STW = { pro: '賛成', con: '反対', neutral: '中立' };
const k10 = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : Math.round(n).toLocaleString('ja-JP'));

// ================================================================ looks by year
const THEMES = {
  paper: { bg: '#efe8d6', ink: '#1e1d22', dim: '#5d5a52', faint: '#9a9484', rule: '#3a372f', card: '#f8f3e6', sel: '#e3d6b4', acc: '#9a2a2a', head: '#1e1d22', title: '声 ─ 読者の投書欄', sub: 'ドット新聞' },
  tv: { bg: '#111a33', ink: '#eef2ff', dim: '#a8b4d8', faint: '#6a789c', rule: '#33426a', card: '#1a2648', sel: '#2a3c70', acc: '#ffd23a', head: '#ff3a6a', title: '街の声 ─ ワイドショー', sub: 'ドットテレビ' },
  bbs: { bg: '#efefef', ink: '#111111', dim: '#555555', faint: '#999999', rule: '#bbbbbb', card: '#ffffff', sel: '#fff3c0', acc: '#1a7a1a', head: '#2a5ab0', title: '世論板 ─ ドットちゃんねる', sub: '掲示板' },
  sns: { bg: '#eef1f6', ink: '#14171f', dim: '#5b6272', faint: '#a2a8b6', rule: '#d8dce4', card: '#ffffff', sel: '#e8f2ff', acc: '#1d8af0', head: '#1d8af0', title: 'トレンドと世論', sub: '' },
};
const TABS = [{ id: 'tl', label: '声' }, { id: 'trend', label: '話題' }, { id: 'thermo', label: '温度計' }, { id: 'me', label: 'あなたへの声' }, { id: 'act', label: 'デモ・運動' }];
const BODY_Y = 58, FOOT_Y = 344;
const DEMO_CAUSES_UI = [['tax', '増税に反対する'], ['scandal', '政治とカネの問題をただす'], ['policy', '政府の政策に反対する'], ['war', '戦争に反対する'], ['speech', '表現の自由を守る'], ['disaster', '被災地への支援を求める'], ['rally', '政府を応援する']];

const sceneOf = (g) => g && g.scenes && g.scenes.find((s) => s.isVoicesUI && !s.closed);
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
function yearOf(g) { const d = safe(() => (has(g, 'gameDate') ? g.gameDate() : null), null); return d && d.year ? d.year : 2026; }

class VoicesScene {
  constructor(g, opts, resolve) {
    Object.assign(this, { g, resolve, hd: true, opaque: true, hidesHud: true, isVoicesUI: true, t: 0, tapAt: null, closed: false, tab: 0, focus: 'body', sel: {}, top: {}, hits: [], modal: null, toast: null, busy: 0, f: { stance: 0, age: 0, region: 0, topic: 0 }, chip: -1 });
    const y = yearOf(g);
    this.year = y;
    this.th = THEMES[y >= 2010 ? 'sns' : y >= 2000 ? 'bbs' : y >= 1995 ? 'tv' : 'paper'];
    this.themeId = y >= 2010 ? 'sns' : y >= 2000 ? 'bbs' : y >= 1995 ? 'tv' : 'paper';
    if (this.themeId === 'sns') this.th = { ...this.th, sub: (ERAS.reiwa && ERAS.reiwa.sns) || 'SNS' };
    bindTap(g);
    safe(() => g.voicesScan && g.voicesScan());
    if (has(g, 'voices') && !safe(() => g.voices(1).length, 0)) safe(() => g.voices(6, { fresh: true }));
    const ti = opts && opts.tab ? TABS.findIndex((t) => t.id === opts.tab) : 0;
    this.tab = ti >= 0 ? ti : 0;
    this.refresh(true);
  }
  get tabId() { return TABS[this.tab].id; }
  filters() {
    const f = this.f, o = {};
    const st = [null, 'pro', 'con', 'neutral'][f.stance];
    if (st) o.stance = st;
    if (f.age) o.ageGroup = AGE_GROUPS[f.age - 1];
    if (f.region) o.region = VOICE_AREAS[f.region - 1][0];
    if (f.topic && this.trends[f.topic - 1]) o.topic = this.trends[f.topic - 1].topic;
    return o;
  }
  refresh(force = false) {
    if (!force && this.t - (this.dataT || -999) < 45) return;
    this.dataT = this.t;
    const g = this.g;
    this.trends = has(g, 'voicesTrends') ? safe(() => g.voicesTrends(8), []) || [] : [];
    this.thermo = has(g, 'voicesThermo') ? safe(() => g.voicesThermo(), null) : null;
    const id = this.tabId;
    if (id === 'tl') this.rows = has(g, 'voices') ? safe(() => g.voices(80, this.filters()), []) || [] : [];
    else if (id === 'trend') this.rows = this.trends;
    else if (id === 'me') this.rows = has(g, 'voices') ? safe(() => g.voices(60, { target: 'player' }), []) || [] : [];
    else if (id === 'act') {
      const demos = has(g, 'demos') ? safe(() => g.demos(), []) || [] : [];
      const camps = has(g, 'voicesCampaigns') ? safe(() => g.voicesCampaigns(), []) || [] : [];
      this.rows = [{ kind: 'newDemo' }, ...demos.slice().sort((a, b) => (a.status === 'ended') - (b.status === 'ended') || b.day - a.day).slice(0, 6).map((d) => ({ kind: 'demo', d })), { kind: 'newCamp' }, ...camps.slice(0, 5).map((c) => ({ kind: 'camp', c }))];
    } else this.rows = [];
    const s = this.sel[id] | 0;
    if (s >= this.rows.length) this.sel[id] = Math.max(0, this.rows.length - 1);
  }
  setTab(i) { this.tab = (i + TABS.length) % TABS.length; this.chip = -1; this.refresh(true); sfx('cursor'); }
  cur() { return this.rows[this.sel[this.tabId] | 0] || null; }
  close() { if (this.closed) return; this.closed = true; if (this.modal) { const m = this.modal; this.modal = null; m.res(null); } this.g.pop(this); this.resolve(null); }
  // ---------------------------------------------------------------- modals (a list to pick from / lines to read)
  pick(o) { return new Promise((res) => { this.modal = { ...o, kind: 'pick', idx: o.index || 0, res }; }); }
  info(title, lines) { return new Promise((res) => { this.modal = { title, lines: [].concat(lines), kind: 'info', res }; }); }
  endModal(v) { const m = this.modal; this.modal = null; if (m) m.res(v); this.g.input.consume && this.g.input.consume(); }
  async act(fn) { this.busy++; try { await fn(); } catch (e) { console.error(e); } finally { this.busy--; this.refresh(true); } }
  // ---------------------------------------------------------------- update
  update(g) {
    this.t++;
    if (this.toast) { this.toast.t++; if (this.toast.t > 120) this.toast = null; }
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (this.t < 3) return;
    if (this.modal) { this.updateModal(inp, tap); return; }
    if (this.busy) return;
    this.refresh();
    if (tap && this.handleTap(tap, inp)) return;
    if (inp.pressed('menu')) { sfx('cancel'); this.close(); return; }
    if (this.focus === 'tabs') {
      if (inp.repeat('left')) this.setTab(this.tab - 1);
      else if (inp.repeat('right')) this.setTab(this.tab + 1);
      else if (inp.pressed('down') || inp.pressed('a')) { this.focus = 'body'; sfx('cursor'); }
      else if (inp.pressed('b')) { sfx('cancel'); this.close(); }
      return;
    }
    if (inp.pressed('b')) { this.focus = 'tabs'; this.chip = -1; sfx('cancel'); return; }
    const id = this.tabId;
    if (id === 'tl' && this.chip >= 0) {
      if (inp.repeat('left')) { this.chip = (this.chip + 4) % 5; sfx('cursor'); return; }
      if (inp.repeat('right')) { this.chip = (this.chip + 1) % 5; sfx('cursor'); return; }
      if (inp.repeat('up')) { this.focus = 'tabs'; this.chip = -1; sfx('cursor'); return; }
      if (inp.repeat('down')) { this.chip = -1; sfx('cursor'); return; }
      if (inp.pressed('a')) { this.chipAct(this.chip); return; }
      return;
    }
    if (inp.repeat('left')) { this.setTab(this.tab - 1); return; }
    if (inp.repeat('right')) { this.setTab(this.tab + 1); return; }
    const n = this.rows.length;
    if (inp.repeat('up')) { if ((this.sel[id] | 0) > 0) { this.sel[id] = (this.sel[id] | 0) - 1; sfx('cursor'); } else { if (id === 'tl') this.chip = 0; else this.focus = 'tabs'; sfx('cursor'); } return; }
    if (inp.repeat('down')) { if ((this.sel[id] | 0) < n - 1) { this.sel[id] = (this.sel[id] | 0) + 1; sfx('cursor'); } return; }
    if (inp.pressed('a')) { const r = this.cur(); if (r || id === 'thermo') { sfx('ok'); this.act(() => this.choose(r)); } }
  }
  updateModal(inp, tap) {
    const m = this.modal;
    if (tap) {
      const now = inp.pressedNow || {};
      now.a = false;
      if (m.kind === 'pick') { const i = (m.rects || []).findIndex((r) => inR(tap.x, tap.y, r)); if (i >= 0) { if (m.idx === i) { const it = m.items[i]; if (!it.lock) { sfx('ok'); this.endModal(i); } else sfx('buzz'); } else { m.idx = i; sfx('cursor'); } } else if (!inR(tap.x, tap.y, m.box)) { sfx('cancel'); this.endModal(-1); } }
      else { sfx('ok'); this.endModal(0); }
      return;
    }
    if (m.kind === 'info') { if (inp.pressed('a') || inp.pressed('b')) { sfx('ok'); this.endModal(0); } return; }
    const n = m.items.length;
    if (inp.repeat('up')) { m.idx = (m.idx + n - 1) % n; sfx('cursor'); }
    if (inp.repeat('down')) { m.idx = (m.idx + 1) % n; sfx('cursor'); }
    if (inp.pressed('b')) { sfx('cancel'); this.endModal(-1); return; }
    if (inp.pressed('a')) { const it = m.items[m.idx]; if (it && it.lock) { sfx('buzz'); this.toast = { text: it.lock, t: 0 }; return; } sfx('ok'); this.endModal(m.idx); }
  }
  chipAct(i) {
    const f = this.f;
    if (i === 0) f.stance = (f.stance + 1) % 4;
    else if (i === 1) f.age = (f.age + 1) % (AGE_GROUPS.length + 1);
    else if (i === 2) f.region = (f.region + 1) % (VOICE_AREAS.length + 1);
    else if (i === 3) f.topic = (f.topic + 1) % (Math.min(6, this.trends.length) + 1);
    else if (i === 4) { safe(() => this.g.voices(6, { fresh: true })); this.toast = { text: this.themeId === 'paper' ? '新しい投書がとどいた' : this.themeId === 'tv' ? '街の声を集めた' : '新しい声を集めた', t: 0 }; }
    this.sel.tl = 0; this.top.tl = 0;
    sfx('cursor');
    this.refresh(true);
  }
  handleTap(tap, inp) {
    const now = inp.pressedNow || {};
    for (const h of this.hits.slice().reverse()) { if (!inR(tap.x, tap.y, h)) continue; now.a = false; h.fn(); return true; }
    return false;
  }
  hit(x, y, w, h, fn) { this.hits.push({ x, y, w, h, fn }); }
  // ---------------------------------------------------------------- actions
  async choose(r) {
    const id = this.tabId, g = this.g;
    if (id === 'tl' || id === 'me') return this.answer(r);
    if (id === 'trend') {
      const k = await this.pick({ title: `話題：${r.topic}`, items: [{ label: 'この話題の声を見る', sub: `${r.n}件の声（賛成${r.proPct}%・反対${r.conPct}%）` }, { label: 'この話題について発信する', sub: '自分の考えを発信する（受けとめられる確率つき）' }, { label: 'もどる' }] });
      if (k === 0) { this.f = { stance: 0, age: 0, region: 0, topic: Math.max(1, this.trends.indexOf(r) + 1) }; this.tab = 0; this.refresh(true); }
      if (k === 1) { const v = (safe(() => g.voices(40, { topic: r.topic }), []) || [])[0]; if (v) await this.answer(v, true); }
      return;
    }
    if (id === 'act') {
      if (r.kind === 'newDemo') return this.organizeDemo();
      if (r.kind === 'demo') return this.joinDemo(r.d);
      if (r.kind === 'newCamp') return this.startCampaign();
      if (r.kind === 'camp') { const c = r.c; await this.info(`${c.label}：${c.cause}`, [`${c.status === 'active' ? 'つづけている' : c.status === 'done' ? '目標に届いた' : '目標に届かなかった'}（${k10(c.count)}／${k10(c.goal)}${c.unit}）`, `期間：${c.start}日目〜${c.end}日目`, ...(c.fx && c.fx.length ? [`結果：${c.fx.join('・')}`] : []), ...c.log.slice(-4).map((l) => `${l.day}日目　+${k10(l.add)}${c.unit}`)]); }
    }
  }
  async answer(v, postOnly = false) {
    const g = this.g;
    if (!v || !has(g, 'voicesReplyOptions')) return;
    let opts = safe(() => g.voicesReplyOptions(v.id), []) || [];
    if (postOnly) opts = opts.filter((o) => o.id !== 'ignore');
    const md = safe(() => g.voicesMedium(), { label: '発信' });
    const role = safe(() => g.voicesRole(), { label: '' });
    const items = [...opts.map((o) => ({ label: o.label, sub: o.odds != null ? `${o.desc}\n○ うまくいけば：${o.good}\n× 炎上すると：${o.bad}` : o.desc, right: o.odds != null ? `${o.odds}%` : '', lock: o.why })), { label: 'もどる' }];
    const k = await this.pick({ title: `${STW[v.stance] || ''}の声にどうする？（あなた：${role.label}・${md.label}）`, lines: [`「${v.text}」`], items, w: 560 });
    if (k == null || k < 0 || k >= opts.length) return;
    const o = opts[k];
    let words = '';
    if (o.id !== 'ignore' && ASK) {
      const w = await this.pick({ title: 'ことばは？', items: [{ label: 'おまかせ（その場のことばで）' }, { label: '自分で書く', sub: '12文字まで' }] });
      if (w === 1) { this.busy++; words = (await safe(() => ASK.askText(g, { title: `${md.label}`, value: '', max: 24, placeholder: 'あなたのことば' }), null)) || ''; this.busy--; }
      if (w < 0) return;
    }
    const res = safe(() => g.voicesRespond(v.id, o.id, { text: words }), null);
    if (!res) return;
    if (res.ok === false) { sfx('buzz'); await this.info('できなかった', [res.why || '']); return; }
    sfx(res.success === false ? 'buzz' : 'good');
    await this.info(res.success === false ? '炎上……' : o.id === 'ignore' ? '静観' : '受けとめられた', [...String(res.text || '').split('\n'), ...(res.effects && res.effects.length ? ['', res.effects.join('・')] : [])]);
  }
  async organizeDemo() {
    const g = this.g;
    const why0 = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_organize'), null) : 'しくみがない';
    if (why0) { await this.info('デモの主催', ['いまは主催できない：', why0]); return; }
    const items = DEMO_CAUSES_UI.map(([id, label]) => { const w = has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_organize', { against: id }), null) : null; return { label, sub: id === 'rally' ? '政府を応援する集会' : '政府や政策への抗議', lock: w }; });
    const i = await this.pick({ title: '何を訴える？', items: [...items, { label: 'もどる' }] });
    if (i < 0 || i >= items.length) return;
    const k = await this.pick({ title: `「${DEMO_CAUSES_UI[i][1]}」デモ・集会`, lines: [`準備のお金 ${fmtMoney(DEMO_COST)}（音響・プラカード）。公安委員会に許可を申請し、あすから開く。平和的な集会（憲法21条）。`], items: [...DEMO_PLACES.map((p) => ({ label: `${p}で主催する` })), { label: 'やめる' }] });
    if (k < 0 || k >= DEMO_PLACES.length) return;
    const r = safe(() => g.organizeDemo({ cause: DEMO_CAUSES_UI[i][1], against: DEMO_CAUSES_UI[i][0], place: DEMO_PLACES[k] }), null);
    sfx(r && r.ok ? 'good' : 'buzz');
    await this.info('デモの主催', [r && r.ok ? r.text || '主催の届け出をした。' : `できなかった：${(r && r.why) || ''}`]);
  }
  async joinDemo(d) {
    const g = this.g;
    const why = d.status === 'ended' ? 'そのデモはもう終わっている' : has(g, 'govtRefusal') ? safe(() => g.govtRefusal('demo_join', { id: d.id }), null) : 'しくみがない';
    const info = [`${d.cause}`, `場所：${d.place}・主催：${d.organiser}`, `規模：約${k10(d.size)}人（最大 約${k10(d.peak || d.size)}人）`];
    if (why) { await this.info('デモ', [...info, '', `参加できない：${why}`]); return; }
    const k = await this.pick({ title: 'デモに参加する', lines: info, items: [{ label: '参加する', sub: '集会・表現の自由（憲法21条）' }, { label: 'スピーチもする', sub: '人前で訴える（知名度があるほど注目される）' }, { label: 'やめる' }] });
    if (k !== 0 && k !== 1) return;
    const r = safe(() => g.joinDemo(d.id, { role: k === 1 ? 'speaker' : 'participant' }), null);
    sfx(r && r.ok ? 'good' : 'buzz');
    await this.info('デモ', [r && r.ok ? r.text || '参加した。' : `できなかった：${(r && r.why) || ''}`]);
  }
  async startCampaign() {
    const g = this.g;
    const opts = has(g, 'voicesCampaignOptions') ? safe(() => g.voicesCampaignOptions(), []) || [] : [];
    const i = await this.pick({ title: '世論に訴える運動', items: [...opts.map((o) => ({ label: o.label, sub: `${o.desc}\n費用 ${o.cost ? fmtMoney(o.cost) : 'なし'}・目標 ${k10(o.goal)}${o.unit}・見込み ${k10(o.expected)}${o.unit}`, right: `${o.odds}%`, lock: o.why })), { label: 'もどる' }], w: 560 });
    if (i < 0 || i >= opts.length) return;
    const j = await this.pick({ title: `${opts[i].label}：何を訴える？`, items: [...CAMPAIGN_CAUSES.map((c) => ({ label: c.label, sub: c.protest ? '政府への要望・抗議' : '呼びかけ・応援' })), { label: 'もどる' }] });
    if (j < 0 || j >= CAMPAIGN_CAUSES.length) return;
    const r = safe(() => g.voicesCampaignStart({ kind: opts[i].id, cause: CAMPAIGN_CAUSES[j].id }), null);
    sfx(r && r.ok ? 'good' : 'buzz');
    await this.info(opts[i].label, String(r && r.ok ? r.text : `できなかった：${(r && r.why) || ''}`).split('\n'));
  }
  // ---------------------------------------------------------------- draw
  draw(c) {
    const th = this.th;
    this.hits = [];
    R(c, 0, 0, SW, SH, th.bg);
    try {
      this.drawHead(c);
      this.drawTabs(c);
      const id = this.tabId;
      if (id === 'tl') this.drawTL(c);
      else if (id === 'trend') this.drawTrend(c);
      else if (id === 'thermo') this.drawThermo(c);
      else if (id === 'me') this.drawMe(c);
      else this.drawAct(c);
      this.drawFoot(c);
      if (this.modal) this.drawModal(c, this.modal);
    } catch (e) { console.error(e); }
    if (this.toast) { const w = Math.min(SW - 40, measure(c, this.toast.text, 12) + 24); R(c, (SW - w) / 2, 300, w, 22, 'rgba(0,0,0,0.85)'); T(c, this.toast.text, SW / 2, 305, 12, '#ffffff', 'center', w - 10); }
    R(c, SW - 20, 2, 18, 18, th.head); T(c, '×', SW - 11, 4, 12, '#ffffff', 'center');
    this.hit(SW - 24, 0, 24, 22, () => { sfx('cancel'); if (this.modal) this.endModal(-1); else this.close(); });
  }
  drawHead(c) {
    const th = this.th, id = this.themeId;
    const mood = this.thermo;
    if (id === 'paper') { R(c, 4, 3, 40, 30, '#1e1d22'); T(c, '声', 24, 6, 22, '#efe8d6', 'center'); T(c, th.title, 52, 4, 16, th.ink); T(c, `${th.sub}　読者のみなさんの投書から`, 52, 22, 10, th.dim); R(c, 4, 35, 612, 2, th.rule); }
    else if (id === 'tv') { R(c, 0, 0, SW, 36, '#0a0f22'); R(c, 6, 5, 64, 26, '#ff3a6a'); T(c, '街の声', 38, 10, 14, '#ffffff', 'center'); T(c, th.title, 78, 6, 16, '#ffd23a'); T(c, 'ワイドショーの街頭インタビューより', 78, 22, 10, th.dim); if (this.t % 50 < 30) { disc(c, 410, 18, 4, '#ff3a3a'); T(c, 'LIVE', 418, 12, 10, '#ff8a8a'); } }
    else if (id === 'bbs') { R(c, 0, 0, SW, 36, '#efefef'); T(c, '■ドットちゃんねる', 8, 4, 14, '#2a5ab0'); T(c, '世論板 ─ 政治・社会・芸能の話題', 8, 21, 10, '#555555'); R(c, 0, 35, SW, 1, '#bbbbbb'); }
    else { R(c, 0, 0, SW, 36, '#ffffff'); R(c, 0, 35, SW, 1, th.rule); disc(c, 20, 18, 11, '#1d8af0'); T(c, 'D', 20, 11, 12, '#ffffff', 'center'); T(c, `${th.sub}`, 38, 4, 16, th.ink); T(c, th.title, 38, 21, 10, th.dim); }
    if (mood) {
      const x = 432;
      T(c, '世論の温度', x, 4, 10, th.dim);
      R(c, x, 19, 90, 8, id === 'tv' ? '#2a3456' : '#d8d4cc');
      R(c, x, 19, Math.round(90 * mood.heat / 100), 8, mood.color);
      T(c, `${mood.level} ${mood.heat}℃`, x + 96, 16, 12, mood.color, 'left', 104);
    }
  }
  drawTabs(c) {
    const th = this.th, n = TABS.length, y = 38, w = (SW - 8) / n;
    TABS.forEach((t, i) => {
      const x = Math.round(4 + i * w), on = i === this.tab, ww = Math.round(w) - 2;
      const badge = t.id === 'me' ? (this.thermo && this.thermo.me ? this.thermo.me.n : 0) : t.id === 'act' ? safe(() => this.g.demos({ active: true }).length, 0) : 0;
      R(c, x, y, ww, 18, on ? th.head : this.themeId === 'tv' ? '#1a2648' : this.themeId === 'paper' ? th.bg : '#ffffff');
      if (this.themeId === 'paper' || this.themeId === 'bbs') frame(c, x, y, ww, 18, th.rule);
      T(c, `${t.label}${badge ? `（${badge}）` : ''}`, x + ww / 2, y + 3, 12, on ? '#ffffff' : th.ink, 'center', ww - 6);
      if (on && this.focus === 'tabs') R(c, x, y + 18, ww, 2, '#ffb547');
      this.hit(x, y, ww, 18, () => { this.focus = 'body'; if (i !== this.tab) this.setTab(i); });
    });
  }
  drawFoot(c) {
    const th = this.th;
    R(c, 0, FOOT_Y, SW, SH - FOOT_Y, this.themeId === 'tv' ? '#0a0f22' : this.themeId === 'paper' ? '#e2d8c0' : '#ffffff');
    R(c, 0, FOOT_Y, SW, 1, th.rule);
    const id = this.tabId;
    const hint = this.modal ? '↑↓：えらぶ　A：決定　B：もどる' : this.focus === 'tabs' ? '←→：タブ　↓：中へ　B：とじる' : id === 'tl' && this.chip >= 0 ? '←→：絞りこみをえらぶ　A：切りかえ　↓：声の一覧へ' : id === 'tl' || id === 'me' ? '↑↓：声　A：この声に答える　←→：タブ　↑（先頭で）：絞りこみ' : id === 'trend' ? '↑↓：話題　A：見る・発信する' : id === 'act' ? '↑↓：えらぶ　A：参加・主催・運動' : '←→：タブ　B：タブへ';
    T(c, hint, 8, FOOT_Y + 3, 10, th.dim, 'left', 520);
    if (this.rows && this.rows.length && ['tl', 'me', 'trend'].includes(id)) T(c, `${(this.sel[id] | 0) + 1}／${this.rows.length}`, SW - 8, FOOT_Y + 3, 10, th.dim, 'right');
  }
  // one voice card, in the voice's own medium
  card(c, v, x, y, w, h, on) {
    const th = this.th, m = v.medium;
    const dark = m === 'street' || m === 'widesho';
    if (m === 'letter') { R(c, x, y, w, h, '#f8f3e6'); frame(c, x, y, w, h, '#b8ad92'); R(c, x + 4, y + 4, 16, 14, '#1e1d22'); T(c, '声', x + 12, y + 5, 10, '#f8f3e6', 'center'); T(c, `${v.job}　${v.name || ''}（${v.age || ''}）　${v.pref || ''}`, x + 24, y + 5, 10, '#5d5a52', 'left', w - 80); }
    else if (dark) { R(c, x, y, w, h, '#0d1430'); frame(c, x, y, w, h, '#33426a'); R(c, x + 4, y + 4, 40, 13, m === 'widesho' ? '#ff3a6a' : '#2a6ad8'); T(c, m === 'widesho' ? 'ワイド' : '街の声', x + 24, y + 5, 10, '#ffffff', 'center'); T(c, `${v.job}（${v.ageGroup || ''}）${v.pref ? '・' + v.pref.replace(/[都府県]$/, '') : ''}`, x + 48, y + 5, 10, '#ffd23a', 'left', w - 100); R(c, x + w - 16, y + 6, 3, 10, '#c8c8d0'); disc(c, x + w - 15, y + 5, 3, '#3a3a44'); }
    else if (m === 'bbs') { R(c, x, y, w, h, '#ffffff'); frame(c, x, y, w, h, '#cccccc'); T(c, `${(hashN(v.id) % 900) + 100} ：`, x + 4, y + 4, 10, '#1a1a1a'); T(c, '名無しさん', x + 34, y + 4, 10, '#1a7a1a'); T(c, `ID:${v.bbsId || 'xxxxxx'}`, x + 96, y + 4, 10, '#555555'); if (v.res) T(c, `レス${v.res}`, x + w - 6, y + 4, 10, '#c03a3a', 'right'); }
    else if (m === 'blog') { R(c, x, y, w, h, '#fffaf2'); frame(c, x, y, w, h, '#e0cfa8'); R(c, x, y, w, 14, '#f6a04a'); T(c, `${v.job}の日記`, x + 6, y + 2, 10, '#ffffff', 'left', w - 80); if (v.comments != null) T(c, `コメント(${v.comments})`, x + w - 6, y + 2, 10, '#ffffff', 'right'); }
    else { R(c, x, y, w, h, '#ffffff'); if (this.themeId !== 'sns') frame(c, x, y, w, h, th.rule); const col = ['#f06a8a', '#4aa0f0', '#f0a040', '#5ac08a', '#9a7af0', '#f0d040'][hashN(v.handle || v.id) % 6]; disc(c, x + 12, y + 12, 8, col); R(c, x + 9, y + 9, 2, 2, '#ffffff'); R(c, x + 14, y + 9, 2, 2, '#ffffff'); T(c, m === 'video' ? '動画のコメント' : `${v.job}（${v.ageGroup || ''}）`, x + 24, y + 3, 10, th.ink, 'left', w - 150); T(c, m === 'video' ? '' : v.handle || '', x + w - 70, y + 3, 10, th.faint, 'right', 80); if (v.likes != null) T(c, `♥${k10(v.likes)}${v.shares != null && m === 'sns' ? `  ↻${k10(v.shares)}` : ''}`, x + w - 6, y + 3, 10, '#e0457a', 'right', 70); }
    // the stance stripe, the text, the reason
    R(c, x, y, 3, h, STC[v.stance] || '#888');
    const tc = dark ? '#ffffff' : '#16181e';
    if (dark) { R(c, x + 6, y + 20, w - 12, h - 24, 'rgba(20,60,160,0.55)'); }
    para(c, `「${v.text}」`, x + 8, y + 21, w - 16, 12, tc, 14, 2);
    if (on) { frame(c, x - 1, y - 1, w + 2, h + 2, '#ffb547'); frame(c, x - 2, y - 2, w + 4, h + 4, '#ffb547'); }
  }
  list(c, x0, y0, w, h, rh, drawRow) {
    const id = this.tabId, rows = this.rows;
    const vis = Math.max(1, Math.floor(h / rh));
    const s = this.sel[id] | 0;
    let top = this.top[id] | 0;
    if (s < top) top = s; if (s >= top + vis) top = s - vis + 1;
    this.top[id] = top;
    for (let i = top; i < Math.min(rows.length, top + vis); i++) {
      const y = y0 + (i - top) * rh;
      const on = s === i && this.focus === 'body' && this.chip < 0;
      drawRow(rows[i], i, x0, y, on);
      this.hit(x0, y, w, rh - 2, () => { this.focus = 'body'; this.chip = -1; if ((this.sel[id] | 0) === i) { sfx('ok'); this.act(() => this.choose(rows[i])); } else { this.sel[id] = i; sfx('cursor'); } });
    }
    if (rows.length > vis) { R(c, x0 + w + 1, y0, 2, h, this.th.rule); R(c, x0 + w + 1, y0 + (h * top) / rows.length, 2, Math.max(8, (h * vis) / rows.length), this.th.ink); }
  }
  // ---------------------------------------------------------------- tabs
  drawTL(c) {
    const th = this.th, f = this.f;
    const labels = [`立場：${['すべて', '賛成', '反対', '中立'][f.stance]}`, `年代：${f.age ? AGE_GROUPS[f.age - 1] : 'すべて'}`, `地方：${f.region ? VOICE_AREAS[f.region - 1][0] : 'すべて'}`, `話題：${f.topic && this.trends[f.topic - 1] ? this.trends[f.topic - 1].topic : 'すべて'}`, this.themeId === 'paper' ? '＋新しい投書' : '＋新しい声'];
    let x = 4;
    labels.forEach((s, i) => {
      const w = Math.min(i === 3 ? 170 : 110, Math.ceil(measure(c, s, 12)) + 14);
      const on = this.chip === i && this.focus === 'body';
      const act = (i === 0 && f.stance) || (i === 1 && f.age) || (i === 2 && f.region) || (i === 3 && f.topic);
      R(c, x, BODY_Y, w, 18, act ? th.head : this.themeId === 'tv' ? '#1a2648' : '#ffffff');
      frame(c, x, BODY_Y, w, 18, on ? '#ffb547' : th.rule);
      if (on) frame(c, x - 1, BODY_Y - 1, w + 2, 20, '#ffb547');
      T(c, s, x + w / 2, BODY_Y + 3, 12, act ? '#ffffff' : th.ink, 'center', w - 8);
      this.hit(x, BODY_Y, w, 18, () => { this.focus = 'body'; this.chip = i; this.chipAct(i); });
      x += w + 4;
    });
    const y0 = BODY_Y + 22;
    if (!this.rows.length) { T(c, '条件にあう声はない。', 200, y0 + 60, 14, th.dim, 'center'); }
    this.list(c, 4, y0, 396, FOOT_Y - y0 - 4, 54, (v, i, x, y, on) => this.card(c, v, x, y, 396, 50, on));
    this.side(c, this.cur());
  }
  side(c, v) {
    const th = this.th, x = 408, y = BODY_Y + 22, w = 228, h = FOOT_Y - y - 4;
    R(c, x, y, w, h, th.card); frame(c, x, y, w, h, th.rule);
    if (!v) { para(c, '声をえらぶと、ここにくわしく出る。A でその声に答えられる（発信・反論・無視）。', x + 8, y + 10, w - 16, 12, th.dim, 16, 6); return; }
    let yy = y + 6;
    R(c, x + 6, yy, 40, 15, STC[v.stance]); T(c, STW[v.stance], x + 26, yy + 2, 10, '#ffffff', 'center');
    T(c, v.mediumLabel || '', x + 52, yy + 2, 10, th.dim, 'left', w - 60); yy += 20;
    const who = v.medium === 'letter' && v.name ? `${v.name}さん（${v.age}）` : `${v.job || ''}（${v.ageGroup || ''}）`;
    T(c, who, x + 8, yy, 14, th.ink, 'left', w - 16); yy += 18;
    T(c, `${v.job || ''}・${v.pref || ''}（${v.region || ''}）`, x + 8, yy, 10, th.dim, 'left', w - 16); yy += 14;
    T(c, `層：${v.segName || '—'}`, x + 8, yy, 10, th.dim, 'left', w - 16); yy += 16;
    yy = para(c, `「${v.text}」`, x + 8, yy, w - 16, 12, th.ink, 15, 5) + 4;
    if (v.reason) { R(c, x + 8, yy, w - 16, 18, this.themeId === 'tv' ? '#24305a' : '#f2efe6'); T(c, `理由：${v.reason}`, x + 12, yy + 3, 12, STC[v.stance], 'left', w - 24); yy += 22; }
    T(c, `話題：${v.topic || v.event || '—'}`, x + 8, yy, 10, th.dim, 'left', w - 16); yy += 13;
    const eng = v.likes != null ? `いいね ${k10(v.likes)}${v.shares != null ? `・共有 ${k10(v.shares)}` : ''}` : v.res != null ? `レス ${v.res}件` : v.comments != null ? `コメント ${v.comments}件` : '';
    if (eng) { T(c, eng, x + 8, yy, 10, th.dim, 'left', w - 16); yy += 13; }
    if (v.target === 'player') T(c, 'あなたについての声', x + 8, yy, 10, '#f0a020');
    if (v.answered || v.ignored) T(c, v.ignored ? '（静観した）' : '（答えた）', x + w - 8, y + h - 30, 10, th.faint, 'right');
    R(c, x + 6, y + h - 20, w - 12, 16, th.head); T(c, 'A：この声に答える', x + w / 2, y + h - 18, 12, '#ffffff', 'center');
  }
  drawTrend(c) {
    const th = this.th;
    const word = (this.trends && this.trends.word) || '話題';
    T(c, `いまの${word}`, 8, BODY_Y, 12, th.ink);
    const y0 = BODY_Y + 18;
    if (!this.rows.length) { T(c, 'まだ話題はない。', 200, y0 + 60, 14, th.dim, 'center'); return; }
    const mx = Math.max(1, ...this.rows.map((r) => r.heat));
    this.list(c, 4, y0, 396, FOOT_Y - y0 - 4, 33, (r, i, x, y, on) => {
      R(c, x, y, 396, 31, on ? th.sel : th.card);
      if (on) frame(c, x, y, 396, 31, '#ffb547');
      T(c, `${r.rank}`, x + 14, y + 7, 16, r.rank <= 3 ? '#e8323c' : th.dim, 'center');
      T(c, this.themeId === 'sns' ? r.tag : r.topic, x + 30, y + 2, 12, this.themeId === 'sns' ? '#1d8af0' : th.ink, 'left', 250);
      if (r.mine) { R(c, x + 284, y + 2, 34, 13, '#f0a020'); T(c, 'あなた', x + 301, y + 3, 10, '#ffffff', 'center'); }
      T(c, `${r.n}件`, x + 390, y + 2, 10, th.dim, 'right');
      const bw = 200;
      R(c, x + 30, y + 19, Math.round(bw * r.heat / mx), 4, '#ff7a1a');
      R(c, x + 240, y + 18, 150, 6, STC.neutral);
      R(c, x + 240, y + 18, Math.round(150 * r.proPct / 100), 6, STC.pro);
      R(c, x + 390 - Math.round(150 * r.conPct / 100), y + 18, Math.round(150 * r.conPct / 100), 6, STC.con);
    });
    const r = this.cur();
    const x = 408, y = y0, w = 228, h = FOOT_Y - y - 4;
    R(c, x, y, w, h, th.card); frame(c, x, y, w, h, th.rule);
    if (!r) return;
    let yy = para(c, r.topic, x + 8, y + 6, w - 16, 14, th.ink, 17, 2) + 4;
    T(c, `声 ${r.n}件・勢い ${r.heat}`, x + 8, yy, 10, th.dim); yy += 16;
    for (const [k, lab] of [['pro', '賛成'], ['con', '反対'], ['neutral', '中立']]) { const pc = Math.round(((r[k] || 0) / Math.max(1, r.n)) * 100); T(c, lab, x + 8, yy, 10, STC[k]); R(c, x + 40, yy + 3, 140, 6, this.themeId === 'tv' ? '#24305a' : '#e4e0d8'); R(c, x + 40, yy + 3, Math.round(1.4 * pc), 6, STC[k]); T(c, `${pc}%`, x + w - 8, yy, 10, th.ink, 'right'); yy += 14; }
    yy += 4;
    const vs = safe(() => this.g.voices(3, { topic: r.topic }), []) || [];
    for (const v of vs) { if (yy > y + h - 40) break; R(c, x + 8, yy + 2, 3, 24, STC[v.stance]); yy = para(c, `「${v.text}」`, x + 14, yy, w - 22, 10, th.ink, 12, 2) + 2; T(c, `${v.job}（${v.ageGroup || ''}）`, x + 14, yy, 10, th.faint, 'left', w - 22); yy += 14; }
    R(c, x + 6, y + h - 20, w - 12, 16, th.head); T(c, 'A：声を見る・発信する', x + w / 2, y + h - 18, 12, '#ffffff', 'center');
  }
  drawThermo(c) {
    const th = this.th, m = this.thermo;
    if (!m) { T(c, '世論のしくみが読み込まれていない', SW / 2, 160, 14, th.dim, 'center'); return; }
    const y0 = BODY_Y;
    // the thermometer
    const tx = 30, ty = y0 + 8, th2 = 196;
    R(c, tx, ty, 26, th2, this.themeId === 'tv' ? '#24305a' : '#e8e4da'); frame(c, tx, ty, 26, th2, th.rule);
    disc(c, tx + 13, ty + th2 + 12, 18, m.color); disc(c, tx + 13, ty + th2 + 12, 14, m.color);
    const fh = Math.round((th2 - 4) * m.heat / 100);
    R(c, tx + 6, ty + th2 - fh, 14, fh + 4, m.color);
    for (let k = 0; k <= 100; k += 20) { const yy = ty + th2 - 2 - ((th2 - 4) * k) / 100; R(c, tx + 26, yy, 6, 1, th.rule); T(c, `${k}`, tx + 36, yy - 6, 10, th.dim); }
    T(c, m.level, 120, y0 + 10, 24, m.color);
    T(c, `世論の温度 ${m.heat}℃`, 120, y0 + 40, 14, th.ink);
    const lines = [`内閣支持率 ${m.approval}%`, `批判の声 ${m.con}%・応援の声 ${m.pro}%（最近の声）`, `開かれているデモ ${m.demos}件`];
    lines.forEach((l, i) => T(c, l, 120, y0 + 62 + i * 16, 12, th.dim, 'left', 260));
    para(c, '支持率が低く、批判の声やデモ、不祥事の話題が多いほど、温度は上がる。温度が高いと、政治の失敗が大きく取り上げられやすい。', 120, y0 + 114, 270, 10, th.faint, 13, 4);
    // history
    const hx = 120, hy = y0 + 174, hw = 270, hh = 60;
    R(c, hx, hy, hw, hh, this.themeId === 'tv' ? '#1a2648' : '#ffffff'); frame(c, hx, hy, hw, hh, th.rule);
    T(c, '温度の推移', hx + 4, hy + 2, 10, th.dim);
    const H = m.hist || [];
    if (H.length >= 2) { let prev = null; H.forEach((p, i) => { const px = hx + 6 + (i * (hw - 12)) / (H.length - 1), py = hy + hh - 4 - (num(p.heat) / 100) * (hh - 16); if (prev) { const n = Math.ceil(Math.abs(px - prev[0])) + Math.ceil(Math.abs(py - prev[1])); for (let k = 0; k <= n; k++) R(c, prev[0] + ((px - prev[0]) * k) / n, prev[1] + ((py - prev[1]) * k) / n, 1, 1, '#ff7a1a'); } prev = [px, py]; }); }
    else T(c, '朝ごとに記録される', hx + hw / 2, hy + 26, 10, th.faint, 'center');
    // the player
    const me = m.me, rx = 400, rw = 236;
    R(c, rx, y0, rw, 96, th.card); frame(c, rx, y0, rw, 96, th.rule);
    T(c, 'あなたへの温度', rx + 8, y0 + 4, 12, th.ink);
    if (me.favor == null) para(c, 'まだあなたは話題になっていない。ニュースになると、街の声が集まってくる。', rx + 8, y0 + 24, rw - 16, 12, th.dim, 15, 4);
    else {
      T(c, me.level, rx + 8, y0 + 22, 20, me.color);
      T(c, `好感 ${me.favor}%`, rx + rw - 8, y0 + 26, 14, th.ink, 'right');
      R(c, rx + 8, y0 + 52, rw - 16, 10, STC.con); R(c, rx + 8, y0 + 52, Math.round((rw - 16) * me.favor / 100), 10, STC.pro);
      T(c, `あなたについての声 ${me.n}件（賛${me.pro}・否${me.con}）`, rx + 8, y0 + 68, 10, th.dim, 'left', rw - 16);
    }
    // by age group and by region: diverging bars (応援 → right, 批判 → left)
    const bars = (title, rows, y, label) => {
      T(c, title, rx + 8, y, 10, th.ink);
      rows.forEach((r, i) => {
        const yy = y + 14 + i * 12, cx = rx + 120;
        T(c, label(r), rx + 8, yy - 1, 10, th.dim, 'left', 56);
        R(c, rx + 68, yy + 4, 160, 1, th.rule);
        const v = clamp(r.mood, -100, 100), bw = Math.round(Math.abs(v) * 0.5);
        if (v >= 0) R(c, cx, yy, bw, 8, STC.pro); else R(c, cx - bw, yy, bw, 8, STC.con);
        T(c, `${r.n}`, rx + rw - 6, yy - 1, 10, th.faint, 'right');
      });
    };
    R(c, rx, y0 + 100, rw, FOOT_Y - y0 - 104, th.card); frame(c, rx, y0 + 100, rw, FOOT_Y - y0 - 104, th.rule);
    bars('年代別（左＝批判・右＝応援）', m.ages.filter((r) => r.n).slice(0, 8), y0 + 104, (r) => r.key);
    const ny = y0 + 104 + 18 + Math.min(8, m.ages.filter((r) => r.n).length) * 12;
    if (ny < FOOT_Y - 40) bars('地方別', m.regions.filter((r) => r.n).slice(0, Math.max(0, Math.floor((FOOT_Y - 8 - ny - 14) / 12))), ny, (r) => r.key);
  }
  drawMe(c) {
    const th = this.th;
    const y0 = BODY_Y;
    if (!this.rows.length) {
      para(c, 'まだあなたについての声はない。テレビに出る、賞レースで勝ち進む、選挙に出る、事件を起こす……ニュースになると、街の声やネットの声が集まってくる。', 20, y0 + 30, 370, 12, th.dim, 17, 6);
    } else this.list(c, 4, y0, 396, FOOT_Y - y0 - 4, 54, (v, i, x, y, on) => this.card(c, v, x, y, 396, 50, on));
    const x = 408, w = 228, h = FOOT_Y - y0 - 4;
    R(c, x, y0, w, h, th.card); frame(c, x, y0, w, h, th.rule);
    const me = this.thermo && this.thermo.me;
    T(c, 'あなたの評判', x + 8, y0 + 4, 12, th.ink);
    if (me && me.favor != null) { T(c, `${me.level}（好感 ${me.favor}%）`, x + 8, y0 + 20, 14, me.color, 'left', w - 16); R(c, x + 8, y0 + 40, w - 16, 8, STC.con); R(c, x + 8, y0 + 40, Math.round((w - 16) * me.favor / 100), 8, STC.pro); }
    else T(c, 'まだ話題になっていない', x + 8, y0 + 22, 12, th.dim);
    const role = safe(() => this.g.voicesRole(), null), md = safe(() => this.g.voicesMedium(), null);
    if (role && md) T(c, `あなた：${role.label}・答えかた：${md.label}`, x + 8, y0 + 54, 10, th.dim, 'left', w - 16);
    T(c, '答えた記録', x + 8, y0 + 72, 12, th.ink);
    const reps = safe(() => this.g.voicesReplies(8), []) || [];
    let yy = y0 + 88;
    if (!reps.length) T(c, 'まだない', x + 8, yy, 10, th.faint);
    for (const r of reps) { if (yy > y0 + h - 16) break; T(c, `${r.day}日目 ${r.how === 'ignore' ? '静観' : r.ok ? '○' : '炎上'}`, x + 8, yy, 10, r.how === 'ignore' ? th.dim : r.ok ? STC.pro : STC.con); yy = para(c, `${r.topic}：${r.text}`, x + 8, yy + 12, w - 16, 10, th.ink, 12, 2) + 4; }
  }
  drawAct(c) {
    const th = this.th, g = this.g;
    const y0 = BODY_Y;
    this.list(c, 4, y0, 396, FOOT_Y - y0 - 4, 30, (r, i, x, y, on) => {
      R(c, x, y, 396, 28, on ? th.sel : th.card); if (on) frame(c, x, y, 396, 28, '#ffb547'); else frame(c, x, y, 396, 28, th.rule);
      if (r.kind === 'newDemo') { T(c, '＋ デモ・集会を主催する', x + 8, y + 7, 12, th.head); T(c, `準備 ${fmtMoney(DEMO_COST)}`, x + 388, y + 8, 10, th.dim, 'right'); }
      else if (r.kind === 'newCamp') { T(c, '＋ 署名運動・街頭・ネットで訴える', x + 8, y + 7, 12, th.head); T(c, '見込みつき', x + 388, y + 8, 10, th.dim, 'right'); }
      else if (r.kind === 'demo') { const d = r.d; R(c, x, y, 3, 28, d.status === 'ended' ? '#999' : d.stance === 'rally' ? '#2a9d8f' : '#e0457a'); T(c, d.cause, x + 8, y + 2, 12, th.ink, 'left', 300); T(c, `${d.status === 'ended' ? '終了' : d.status === 'planned' ? '予定' : '開催中'}・${d.place}・約${k10(d.size)}人${d.joined ? '・参加した' : ''}`, x + 8, y + 15, 10, th.dim, 'left', 380); }
      else { const cp = r.c; R(c, x, y, 3, 28, cp.status === 'active' ? '#1d8af0' : cp.status === 'done' ? STC.pro : '#999'); T(c, `${cp.label}：${cp.cause}`, x + 8, y + 2, 12, th.ink, 'left', 300); R(c, x + 8, y + 18, 280, 5, '#d8d4cc'); R(c, x + 8, y + 18, Math.round(280 * Math.min(1, cp.count / cp.goal)), 5, cp.status === 'short' ? '#999' : '#1d8af0'); T(c, `${k10(cp.count)}／${k10(cp.goal)}${cp.unit}`, x + 388, y + 14, 10, th.dim, 'right'); }
    });
    const x = 408, w = 228, h = FOOT_Y - y0 - 4;
    R(c, x, y0, w, h, th.card); frame(c, x, y0, w, h, th.rule);
    drawNewsImage(c, 'crowd', x + 6, y0 + 6, w - 12, 100, { mono: this.themeId === 'paper', seed: 4 });
    para(c, 'デモや集会は、憲法21条が保障する表現の自由。署名や街頭での呼びかけ、ネットでの運動も、世論に訴える方法。人の数と勢いが大きいほど、政治と報道に響く。', x + 8, y0 + 112, w - 16, 10, th.ink, 13, 9);
    const role = safe(() => g.voicesRole(), null);
    if (role) T(c, `あなた：${role.label}`, x + 8, y0 + h - 16, 10, th.dim);
  }
  drawModal(c, m) {
    R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.5)');
    const w = Math.min(600, m.w || 440);
    const x = Math.round((SW - w) / 2);
    const items = m.items || [];
    const lines = m.lines || [];
    const subN = Math.min(3, Math.max(1, ...items.map((it) => String(it.sub || '').split('\n').length)));
    const rowH = 18 + subN * 11 + 2;
    const lh = lines.length ? Math.min(5, lines.reduce((a, l) => a + wrap(c, l, w - 32, 12).length, 0)) * 15 + 6 : 0;
    const h = Math.min(330, 30 + lh + (m.kind === 'pick' ? items.length * rowH + 8 : 30));
    const y = Math.round((SH - h) / 2);
    m.box = { x, y, w, h };
    R(c, x, y, w, h, '#fbfaf6'); frame(c, x, y, w, h, '#2a2a33'); frame(c, x + 2, y + 2, w - 4, h - 4, '#c8c4b8');
    R(c, x + 3, y + 3, w - 6, 20, this.th.head); T(c, m.title || '', x + 10, y + 6, 12, '#ffffff', 'left', w - 20);
    let yy = y + 28;
    for (const l of lines) { yy = para(c, l, x + 12, yy, w - 24, 12, '#222', 15, 5); }
    if (lines.length) yy += 4;
    if (m.kind === 'info') { T(c, 'A：OK', x + w - 12, y + h - 18, 12, '#555', 'right'); return; }
    m.rects = [];
    const maxRows = Math.floor((y + h - 6 - yy) / rowH);
    const start = clamp(m.idx - maxRows + 1, 0, Math.max(0, items.length - maxRows));
    items.slice(start, start + maxRows).forEach((it, k) => {
      const i = start + k, ry = yy + k * rowH, on = i === m.idx;
      R(c, x + 8, ry, w - 16, rowH - 3, on ? '#ffe9b0' : '#ffffff'); frame(c, x + 8, ry, w - 16, rowH - 3, on ? '#e8a020' : '#ddd8cc');
      T(c, it.label, x + 14, ry + 3, 12, it.lock ? '#9a968c' : '#1a1a22', 'left', w - 90);
      if (it.right) T(c, it.right, x + w - 14, ry + 3, 14, it.lock ? '#9a968c' : '#c8102e', 'right');
      const sub = it.lock ? `🔒 ${it.lock}` : it.sub;
      if (sub) String(sub).split('\n').slice(0, subN).forEach((s2, j) => T(c, s2, x + 14, ry + 17 + j * 11, 10, it.lock ? '#a0602a' : /^×/.test(s2) ? '#b0303a' : /^○/.test(s2) ? '#2f7a4a' : '#6a6a72', 'left', w - 32));
      m.rects[i] = { x: x + 8, y: ry, w: w - 16, h: rowH - 3 };
    });
  }
}

export async function openVoicesScreen(g, opts = {}) {
  if (!g || !g.state) return null;
  if (g.auto && !g.auto.voicesui) return null;
  if (sceneOf(g)) return null;
  sfx('ok');
  return new Promise((resolve) => { const sc = new VoicesScene(g, opts, resolve); g.push(sc); });
}
Game.prototype.voicesScreen = function voicesScreen(tab, opts = {}) { return openVoicesScreen(this, { ...opts, tab }); };
if (typeof window !== 'undefined') window.__voicesui = { scene: () => sceneOf(window.__game), open: openVoicesScreen, TABS, ystate };
