// 台本（ネタ帳）と AI審査員 (owner: B). API doc: test-output/api_neta.txt.
//   neta_lex.js    the scorer's lexicon (categories, stock phrases, markers, anachronisms)
//   neta_bank.js   the parts bank (themes, generic parts, era words, Kansai-ben) + buildAuto (おまかせ / NPC scripts)
//   neta_bank2.js  落語・大喜利・歌ネタ・ものまね・エピソードトーク・コント・ピン material
//   neta_ai.js     the local AI審査員 (scoreLocal, estimate, structureCheck, judges)
//   neta_claude.js the optional Claude scoring with the player's own API key (OFF by default)
//   neta_ui.js     the HD screens (editor, result, chooser, settings, waiting) and the phone app 「ネタ帳」
//
// CONTRACT4 (kept): g.netaList(kind?) g.neta(id) g.writeNeta(opts) g.pickNeta(opts) g.scoreNeta(netaOrId, opts)
//   g.netaQuality(netaOrId) g.practiceNeta(id, n) g.markNetaUsed(id, contestId) g.autoNeta(kind, quality?)
// Extras: g.netaFreshness(id, contestId?) g.netaRehearse(id) g.deleteNeta(id) g.saveNeta(neta) g.netaSettings()
//   g.openNetaBook() g.openNetaSettings() g.showNetaResult(netaOrId) g.netaStats()
// State: st.neta = { v, list: [Neta], nextId, settings: { dialect, kind, target }, rehearse: { day, ids: {id: n} } }
//   (lazy; old saves get it on first use; junk records are repaired or dropped).

import { Game } from './game.js';
import { clamp } from './util.js';
import { onMorning } from './life.js';
import { PEOPLE, isKansai } from './life.js';
import { regionOf } from './profile.js';
import { scoreLocal, estimate, netaHash, KINDS, AXES_BY_KIND, rankLabel, parseScript } from './neta_ai.js';
export { parseScript };
import { buildAuto, ERA_YEAR, DEFAULT_LEN, hashStr } from './neta_bank.js';
import { scoreClaude, getMode, hasKey, currentKey } from './neta_claude.js';
// [R11-J] 審査員AI: the judges are agents with memory (judges_ai.js / judges_ai_mem.js; pure, opt-in through ctx.jai)
import { jstate, initState } from './judges_ai.js';
import * as JM from './judges_ai_mem.js';
import { JUDGES as BASE_JUDGES } from './neta_ai.js';
import { openEditor, openResult, openPicker, openSettings, openWaiting, installNetaApp } from './neta_ui.js';

export const NETA_KINDS = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'エピソードトーク' };
export const ROLES = ['boke', 'tsukkomi', 'a', 'b', 'c', 'narr', 'pin', 'sage'];
export const BEATS = ['tsukami', 'setup', 'boke', 'tsukkomi', 'tenkai', 'tendon', 'fukusen', 'kaishu', 'ochi', 'makura', 'hondai', 'sage', 'answer'];
export const LIMITS = { scripts: 60, lines: 160, chars: 240, title: 24, theme: 40, setting: 120 };
const V = 1;
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, n) => Array.from(typeof v === 'string' || typeof v === 'number' ? String(v) : '').slice(0, n).join('');
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const kindOk = (k) => (NETA_KINDS[k] ? k : 'manzai');

// ------------------------------------------------------------------ state
function cleanLine(l) {
  if (!l || typeof l !== 'object') return null;
  const out = { role: ROLES.includes(l.role) ? l.role : 'boke', text: str(l.text, LIMITS.chars), beat: BEATS.includes(l.beat) ? l.beat : '' };
  if (l.twist) out.twist = true;
  if (l.src === 'bank') out.src = 'bank';
  return out;
}
export function cleanNeta(x, day = 1) {
  if (!x || typeof x !== 'object') return null;
  const n = {
    id: str(x.id, 24) || null, kind: kindOk(x.kind), title: str(x.title, LIMITS.title), theme: str(x.theme, LIMITS.theme), themeId: str(x.themeId, 24),
    setting: str(x.setting, LIMITS.setting), target: clamp(Math.round(num(x.target, DEFAULT_LEN[kindOk(x.kind)] || 240)), 10, 3600),
    lines: (Array.isArray(x.lines) ? x.lines : []).slice(0, LIMITS.lines).map(cleanLine).filter(Boolean),
    ai: x.ai && typeof x.ai === 'object' && Number.isFinite(Number(x.ai.total)) ? x.ai : null,
    practice: clamp(num(x.practice), 0, 100), peak: clamp(num(x.peak, num(x.practice)), 0, 100), practiceDay: num(x.practiceDay),
    uses: {}, created: Math.max(1, num(x.created, day)), updated: Math.max(1, num(x.updated, day)), dialect: x.dialect === 'kansai' ? 'kansai' : 'std',
  };
  if (x.chars && typeof x.chars === 'object') { n.chars = {}; for (const r of ['a', 'b', 'c']) if (x.chars[r]) n.chars[r] = str(x.chars[r], 10); }
  if (x.forContest) n.forContest = str(x.forContest, 24);
  if (x.uses && typeof x.uses === 'object') for (const [k, v] of Object.entries(x.uses)) if (k && Number.isFinite(Number(v))) n.uses[str(k, 32)] = Math.max(0, Math.round(Number(v)));
  n.length = estimate(n).sec;
  return n;
}
function ensure(g) {
  const st = g.state;
  if (!st) return { v: V, list: [], nextId: 1, settings: {}, rehearse: {} };
  let s = st.neta;
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = st.neta = { v: V, list: [], nextId: 1, settings: {}, rehearse: { day: 0, ids: {} } };
  if (s._ok === st) return s;
  // repair once per state object (old saves, other versions, hand edits)
  if (!Array.isArray(s.list)) s.list = [];
  const ids = new Set();
  let next = Math.max(1, Math.round(num(s.nextId, 1)));
  s.list = s.list.map((x) => cleanNeta(x, st.day)).filter(Boolean).map((x) => {
    if (!x.id || ids.has(x.id)) x.id = `n${next++}`;
    ids.add(x.id);
    const m = /^n(\d+)$/.exec(x.id);
    if (m) next = Math.max(next, Number(m[1]) + 1);
    return x;
  }).slice(-LIMITS.scripts);
  s.nextId = next;
  if (!s.settings || typeof s.settings !== 'object') s.settings = {};
  if (!s.rehearse || typeof s.rehearse !== 'object') s.rehearse = { day: 0, ids: {} };
  if (!s.rehearse.ids || typeof s.rehearse.ids !== 'object') s.rehearse.ids = {};
  s.v = V;
  Object.defineProperty(s, '_ok', { value: st, enumerable: false, configurable: true, writable: true });
  return s;
}
export function netaState(g) { return ensure(g); }

// ------------------------------------------------------------------ context for the scorer and the bank
export function eraOfG(g) { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_YEAR[e] ? e : 'reiwa'; }
export function yearOfG(g) {
  const d = has(g, 'gameDate') ? safe(() => g.gameDate(), null) : null;
  if (d && Number.isFinite(d.year)) return d.year;
  const day = (g && g.state && g.state.day) || 1;
  return ERA_YEAR[eraOfG(g)] + Math.floor((3 + Math.floor((day - 1) / 10)) / 12);
}
export function namesOfG(g) {
  const u = has(g, 'unit') ? safe(() => g.unit(), null) : null;
  const out = { unit: '', boke: '', tsukkomi: '', name: (g && g.state && g.state.name) || '' };
  if (u) {
    if (u.type !== 'pin' && u.name) out.unit = u.name;
    for (const m of u.members || []) { if (m.role === 'boke' && !out.boke) out.boke = m.short || m.name; if (m.role === 'tsukkomi' && !out.tsukkomi) out.tsukkomi = m.short || m.name; }
  }
  return out;
}
export function dialectOfG(g) {
  const s = ensure(g).settings;
  if (s.dialect === 'kansai' || s.dialect === 'std') return s.dialect;
  const u = has(g, 'unit') ? safe(() => g.unit(), null) : null;
  for (const m of (u && u.members) || []) if (m.id !== 'player' && PEOPLE[m.id] && safe(() => isKansai(PEOPLE[m.id]), false)) return 'kansai';
  const p = g.state && g.state.profile;
  const r = p && safe(() => regionOf(p.hometown), null);
  return r && r.dialect === 'kansai' ? 'kansai' : 'std';
}
function scoreCtx(g, x, opts = {}) {
  const list = ensure(g).list;
  const ctx = { era: eraOfG(g), year: yearOfG(g), target: Number(opts.length || opts.target) || x.target, others: list.filter((o) => o !== x && o.id !== x.id), names: namesOfG(g) };
  // [R11-J] the judge agents of this save (their tastes today and their memory of the player); old saves get them on first use
  if (g.state && !isAuto(x) && opts.jai !== false) {
    const jai = safe(() => {
      const st = g.state;
      initState(st);
      const jc = JM.ctxFor(st, { year: ctx.year, day: st.day || 1, base: BASE_JUDGES, id: x.id, kind: x.kind, hash: netaHash(x) });
      if (jc) jc.sig = jc.panel.map((j) => j.key).join(',');
      return jc;
    }, null);
    if (jai) ctx.jai = jai;
  }
  return ctx;
}

// local estimate cache (by script hash): what an unscored / edited script is worth
const EST = new Map();
function localTotal(g, x) {
  const h = netaHash(x);
  if (EST.has(h)) return EST.get(h);
  const r = safe(() => scoreLocal(x, scoreCtx(g, x)), null);
  const v = r ? r.total : 40;
  if (EST.size > 200) EST.clear();
  EST.set(h, v);
  return v;
}
const resolve = (g, n) => (typeof n === 'string' ? g.neta(n) : n && typeof n === 'object' ? n : null);
const isAuto = (x) => !!(x && (x.auto || String(x.id || '').startsWith('auto')));
// compact a result for the save (per-line notes only for lines with something to say)
function compactAi(ai, day) {
  const out = { ...ai, day };
  if (Array.isArray(out.lines) && out.lines.length > 60) out.lines = out.lines.filter((l) => l.tag || out.best.includes(l.i) || out.worst.includes(l.i)).slice(0, 60);
  return out;
}

// ------------------------------------------------------------------ methods
const methods = {
  netaList(kind) {
    const s = ensure(this);
    const want = (x) => !kind || kind === 'any' || x.kind === kind || (kind === 'double' && (x.kind === 'manzai' || x.kind === 'conte'));
    return s.list.filter(want).slice().sort((a, b) => b.updated - a.updated || b.created - a.created || String(b.id).localeCompare(String(a.id), 'en', { numeric: true }));
  },
  neta(id) { if (id == null) return null; return ensure(this).list.find((x) => x.id === id) || null; },
  netaSettings() { return ensure(this).settings; },
  netaStats() {
    const l = ensure(this).list;
    const scored = l.filter((x) => x.ai);
    return { count: l.length, scored: scored.length, best: scored.reduce((m, x) => Math.max(m, x.ai.total), 0), byKind: Object.fromEntries(Object.keys(NETA_KINDS).map((k) => [k, l.filter((x) => x.kind === k).length])) };
  },
  // Save a script (new: gets an id; existing id: replaced). Returns the stored record or null (full).
  saveNeta(n) {
    const s = ensure(this);
    const day = this.state.day;
    const x = cleanNeta({ ...n, updated: day, created: n.created || day }, day);
    if (!x) return null;
    const old = x.id ? s.list.find((o) => o.id === x.id) : null;
    if (old) {
      // keep the record's history (uses, practice) and the ai result if the script did not change
      const keepAi = old.ai && n.ai !== null && old.ai.hash === netaHash(x) ? old.ai : n.ai && n.ai.hash === netaHash(x) ? n.ai : null;
      Object.assign(old, { ...x, uses: old.uses, practice: x.practice || old.practice, peak: Math.max(old.peak || 0, x.peak || 0), practiceDay: old.practiceDay || x.practiceDay, created: old.created, ai: keepAi });
      return old;
    }
    if (s.list.length >= LIMITS.scripts) return null;
    x.id = `n${s.nextId++}`;
    x.ai = x.ai && x.ai.hash === netaHash(x) ? x.ai : null;
    s.list.push(x);
    return x;
  },
  deleteNeta(id) { const s = ensure(this); const i = s.list.findIndex((x) => x.id === id); if (i < 0) return false; s.list.splice(i, 1); return true; },

  // opts: { kind, title?, length? (target sec), forContest?, id? (edit that script), theme? }
  async writeNeta(opts = {}) {
    const s = ensure(this);
    const base = opts.id ? this.neta(opts.id) : null;
    const kind = kindOk(opts.kind && opts.kind !== 'any' && opts.kind !== 'double' ? opts.kind : base ? base.kind : s.settings.kind || 'manzai');
    if (!base && s.list.length >= LIMITS.scripts) { if (!this.auto) await this.say(`ネタ帳がいっぱいだ（${LIMITS.scripts}本まで）。古いネタを消してから書こう。`); return null; }
    const draft = base ? JSON.parse(JSON.stringify(base)) : { kind, title: str(opts.title, LIMITS.title), theme: str(opts.theme, LIMITS.theme), setting: '', target: Number(opts.length) || s.settings.target || DEFAULT_LEN[kind], lines: [], practice: 0, uses: {}, dialect: dialectOfG(this) };
    if (opts.length) draft.target = Number(opts.length);
    if (opts.forContest) draft.forContest = opts.forContest;
    s.settings.kind = kind;
    if (this.auto && !this.auto.netaui) {
      // tests / おまかせ: a script from typed text (g.auto.netaText) or from the parts bank
      let lines = null;
      if (typeof this.auto.netaText === 'string') lines = parseScript(this.auto.netaText, kind);
      if (!lines || !lines.length) { const a = buildAuto(kind, { quality: num(this.auto.netaQuality, 55), era: eraOfG(this), year: yearOfG(this), dialect: draft.dialect, names: namesOfG(this), seed: `${this.state.day}:${s.nextId}` }); lines = a.lines; draft.title = draft.title || a.title; draft.theme = draft.theme || a.theme; draft.themeId = a.themeId; draft.setting = a.setting || ''; if (a.chars) draft.chars = a.chars; }
      draft.lines = lines;
      if (!draft.title) draft.title = `${NETA_KINDS[kind]}のネタ`;
      return this.saveNeta(draft);
    }
    return openEditor(this, draft, opts);
  },

  // opts: { kind, length?, title?, forContest? } → the chosen script (or an おまかせ one), or null
  async pickNeta(opts = {}) {
    const kind = opts.kind || 'manzai';
    const list = this.netaList(kind);
    if (this.auto && !this.auto.netaui) {
      const a = this.auto.pickNeta;
      if (typeof a === 'function') return safe(() => a(list, opts), null) || null;
      if (typeof a === 'number') return list[a] || null;
      if (typeof a === 'string') return this.neta(a);
      if (a === false || !list.length) return null;
      return list.slice().sort((x, y) => this.netaQuality(y, { contest: opts.forContest }) - this.netaQuality(x, { contest: opts.forContest }))[0] || null;
    }
    return openPicker(this, { ...opts, kind, list });
  },

  // opts: { by: 'local'|'claude', show (open the result screen), fetch / key (tests), length, signal }
  async scoreNeta(n, opts = {}) {
    const x = resolve(this, n);
    const day = (this.state && this.state.day) || 1;
    if (!x) return { ...scoreLocal({ kind: 'manzai', lines: [] }), day };
    const ctx = scoreCtx(this, x, opts);
    const want = opts.by || (getMode() === 'claude' ? 'claude' : 'local');
    // [R11-J] the same script before the same panel: the judges remember it and say the same (editing it, or a new seat holder, gives a new reading)
    if (ctx.jai && !opts.fresh && want === 'local' && x.ai && x.ai.by === 'local' && x.ai.hash === netaHash(x) && x.ai.pj === ctx.jai.sig && this.neta(x.id) === x) {
      if (opts.show && !this.auto) await openResult(this, x, x.ai);
      return x.ai;
    }
    const local = scoreLocal(x, ctx);
    let ai = { ...local, day };
    if (want === 'claude') {
      const key = opts.key || currentKey();
      if (!key) ai.notice = 'APIキーが設定されていないので、ローカルAIで採点しました。';
      else if (this.auto && !opts.fetch) ai.notice = '（テスト中はClaudeに送らず、ローカルAIで採点しました）';
      else {
        const run = (signal) => scoreClaude(x, { ...ctx, kind: x.kind, local, estimate: local.stats.sec }, { key, fetch: opts.fetch, signal, timeoutMs: opts.timeoutMs });
        const r = opts.ui && !this.auto ? await openWaiting(this, run) : await run(opts.signal);
        if (r && r.ok) ai = { ...r.ai, hash: local.hash, day };
        else ai.notice = `${(r && r.notice) || 'Claudeに接続できません'}。ローカルAIで採点しました。`;
      }
    }
    if (ctx.jai) { ai.pj = ctx.jai.sig; if (!ai.mem) ai.mem = local.mem; } // [R11-J]
    if (this.neta(x.id) === x) {
      x.ai = compactAi(ai, day);
      if (ctx.jai) safe(() => JM.recordNeta(this.state, x, x.ai, { day, year: ctx.year, hash: netaHash(x) }), false); // [R11-J] remember it
    }
    if (opts.show && !this.auto) await openResult(this, x, ai);
    return ai;
  },
  showNetaResult(n) { const x = resolve(this, n); if (!x || !x.ai) return Promise.resolve(null); return openResult(this, x, x.ai); },

  // 0..100: what a performance starts from — the script (AI, or the local estimate when unscored / edited),
  // how well it is rehearsed (仕上がり) and how fresh it is. opts: { contest } (a ネタ already seen there scores lower)
  netaQuality(n, opts = {}) {
    const x = resolve(this, n);
    if (!x) return 40;
    if (isAuto(x)) return clamp(Math.round(num(x.ai && x.ai.total, num(x.quality, 45))), 0, 100);
    const base = x.ai && (!x.ai.hash || x.ai.hash === netaHash(x)) ? num(x.ai.total, 40) : localTotal(this, x);
    const p = clamp(num(x.practice), 0, 100);
    const f = this.netaFreshness(x, opts.contest).value;
    return clamp(Math.round(base * (0.62 + 0.38 * (p / 100)) * (0.55 + 0.45 * (f / 100))), 0, 100);
  },
  // → { value 0..100, label, same (uses at that contest), uses, tv }
  netaFreshness(n, contestId) {
    const x = resolve(this, n);
    if (!x) return { value: 100, label: '新ネタ', same: 0, uses: 0, tv: 0 };
    const uses = Object.values(x.uses || {}).reduce((a, b) => a + num(b), 0);
    const tv = Object.entries(x.uses || {}).filter(([k]) => /^tv/i.test(k)).reduce((a, [, b]) => a + num(b), 0);
    let v = clamp(100 - 7 * uses - 12 * tv, 25, 100);
    const same = contestId ? num((x.uses || {})[contestId]) : 0;
    if (same) v = clamp(v - 30 * same, 10, 100);
    const label = same ? '同じネタ（この大会で前にもやった）' : uses >= 4 || tv >= 2 ? '見たことある' : uses >= 1 ? 'おなじみ' : '新ネタ';
    return { value: Math.round(v), label, same, uses, tv };
  },
  // ネタ合わせ / 稽古: raises 仕上がり (diminishing); others call it with their own n
  practiceNeta(id, n = 5) {
    const x = this.neta(id);
    if (!x) return 0;
    const p = num(x.practice);
    const gain = Math.max(0, num(n)) * (1 - p / 120);
    x.practice = clamp(Math.round(p + Math.max(n > 0 ? 1 : 0, gain)), 0, 100);
    x.peak = Math.max(num(x.peak), x.practice);
    x.practiceDay = (this.state && this.state.day) || 1;
    return x.practice;
  },
  // the player's own ネタ合わせ (phone app / editor): 体力 -8, ストレス + a little, 3 times a day per script
  async netaRehearse(id) {
    const x = this.neta(id);
    if (!x) return null;
    const s = ensure(this);
    const day = this.state.day;
    if (s.rehearse.day !== day) s.rehearse = { day, ids: {} };
    const done = num(s.rehearse.ids[id]);
    if (done >= 3) return { ok: false, why: '今日はもう3回ネタ合わせした。続きは明日。' };
    if (this.state.stamina < 8) return { ok: false, why: '体力が足りない（体力8）。' };
    this.state.stamina -= 8;
    if (has(this, 'lifeTick')) safe(() => this.lifeTick('lesson'));
    const u = has(this, 'unit') ? safe(() => this.unit(), null) : null;
    const ma = has(this, 'comedyStat') ? num(safe(() => this.comedyStat('ma'), 0)) : 0;
    const pair = u && u.type !== 'pin' ? num(u.harmony, 50) / 25 : 2;
    const before = num(x.practice);
    const v = this.practiceNeta(id, Math.round(6 + ma / 20 + pair));
    s.rehearse.ids[id] = done + 1;
    if (has(this, 'addComedyStat') && (done + 1) % 3 === 0) safe(() => this.addComedyStat(x.kind === 'conte' ? 'act' : 'ma', 1, true));
    return { ok: true, before, after: v, left: 2 - done };
  },
  markNetaUsed(id, contestId) {
    const x = this.neta(id);
    if (!x || !contestId) return null;
    x.uses = x.uses || {};
    const k = str(contestId, 32);
    x.uses[k] = num(x.uses[k]) + 1;
    x.lastUsed = this.state.day;
    return x.uses[k];
  },
  // A generated script of roughly that quality (おまかせ / NPC rivals). Never stored in the player's ネタ帳.
  // opts (extension): { seed, theme (bank id), length, dialect, names }
  autoNeta(kind = 'manzai', quality = 50, opts = {}) {
    const k = kindOk(kind === 'any' || kind === 'double' ? 'manzai' : kind);
    const q = clamp(Math.round(num(quality, 50)), 0, 100);
    const day = (this.state && this.state.day) || 1;
    const seed = opts.seed != null ? opts.seed : `${k}:${q}:${day}`;
    const a = buildAuto(k, { quality: q, era: eraOfG(this), year: yearOfG(this), dialect: opts.dialect || 'std', names: opts.names || {}, seed, themeId: opts.theme, length: opts.length });
    const axes = {};
    for (const ax of AXES_BY_KIND[k]) axes[ax] = clamp(q + ((hashStr(`${seed}:${ax}`) % 15) - 7), 0, 100);
    const n = {
      id: `auto_${hashStr(String(seed)).toString(36)}`, kind: k, title: a.title, theme: a.theme, themeId: a.themeId, setting: a.setting || '', target: Number(opts.length) || DEFAULT_LEN[k],
      lines: a.lines, practice: q, uses: {}, created: day, updated: day, auto: true, quality: q,
      ai: { total: q, axes, comments: ['おまかせで組んだネタ'], judges: [], by: 'local', day, auto: true, rank: rankLabel(q) },
    };
    if (a.chars) n.chars = a.chars;
    n.length = estimate(n).sec;
    return n;
  },
  parseNetaScript(text, kind, chars) { return parseScript(text, kind, chars); },
  openNetaBook() { return installNetaApp.openBook ? installNetaApp.openBook(this) : null; },
  openNetaSettings() { return openSettings(this); },
};

export function installNeta(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installNeta(Game.prototype);
installNetaApp();

// Morning: 仕上がり fades when a script is not rehearsed for more than 10 days (1 a day, never below a third of its peak).
onMorning((g) => {
  const s = g.state && g.state.neta;
  if (!s || !Array.isArray(s.list)) return;
  const day = g.state.day;
  for (const x of s.list) {
    if (!x || !num(x.practice) || day - num(x.practiceDay) <= 10) continue;
    x.practice = Math.max(Math.round(num(x.peak) / 3), num(x.practice) - 1);
  }
});
