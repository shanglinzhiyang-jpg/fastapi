// 芸の実演 (owner: C): g.perform / g.performSim over the minigames manzai / conte / rakugo / ogiri / pinneta.
// API doc: test-output/api_perform.txt. The model (score, 実力不足 events, highlights) is in perform_model.js,
// the built-in material in perform_bank.js, the stage art in perform_stage.js and the shared minigame base in
// perform_base.js.
//
//   g.perform(opts) → Promise<Result>   CONTRACT4. Resolves the ネタ (opts.neta, else g.pickNeta when the player has
//        scripts of that kind, else g.autoNeta → おまかせ), then plays the kind's minigame — or, with opts.skip / g.auto,
//        the same model without UI (performSim). Applies stage experience + small stat growth (A) and 仕上がり (B)
//        unless opts.practice (then only the ネタ's 仕上がり rises). g.auto.performScore (tests) forces a score.
//   g.performSim(opts) → Result        sync, deterministic given opts.rng; opts.power / opts.quality for rivals.
//   g.performGrowth(kind, res, o)      (extra, not in the contract) the growth step on its own — the places use it
//        after performances in minigames C does not own (e.g. 新喜劇's zukko). o: { lesson, practice, pressure, stats }
//   g.performKinds()                   → { kind: { label, minigame } } (extra)

import { Game } from './game.js';
import { clamp } from './util.js';
import { buildCtx, simulate, normKind, MINIGAME_OF, KIND_LABEL, STAT_LABEL, pinStyle } from './perform_model.js';

const fn = (g, k) => typeof g[k] === 'function';
const safe = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } };

// Which stats a performance trains (first = the main one)
export function growthStats(kind, role) {
  switch (kind) {
    case 'manzai': return role === 'boke' ? ['boke', 'ma', 'voice'] : ['tsukkomi', 'ma', 'voice'];
    case 'conte': return ['act', 'ma', role === 'boke' ? 'boke' : 'tsukkomi'];
    case 'rakugo': return ['wagei', 'ma', 'act'];
    case 'ogiri': return ['hassou', 'adlib', 'boke'];
    case 'utaneta': return ['voice', 'ma', 'boke'];
    case 'monomane': return ['mane', 'voice', 'act'];
    case 'talk': return ['wagei', 'adlib', 'ma'];
    default: return ['boke', 'hassou', 'ma'];
  }
}

const RANK_GAIN = { S: 2, A: 2, B: 1, C: 1, D: 0 };

// Stage experience (A), stat growth (A), the ネタ's 仕上がり (B). Returns a short summary string ('' if nothing).
function growth(g, kind, res, o = {}) {
  if (!g.state) return '';
  const k = normKind(kind, null);
  const rank = (res && res.rank) || 'C';
  const parts = [];
  const add = (key, n) => {
    if (!n || !fn(g, 'addComedyStat')) return;
    const before = fn(g, 'comedyStat') ? Number(safe(() => g.comedyStat(key), 0)) : 0;
    const after = Number(safe(() => g.addComedyStat(key, n, true), before));
    if (Number.isFinite(after) && after > before) parts.push(`${STAT_LABEL[key] || key}+${Math.round(after - before)}`);
  };
  const netaId = o.netaId || (res && res.netaId);
  if (netaId && fn(g, 'practiceNeta')) safe(() => g.practiceNeta(netaId, o.practice ? 6 : 3));
  if (o.practice) return '';
  const keys = o.stats || growthStats(k, o.role);
  if (o.lesson) {
    add(keys[0], rank === 'S' || rank === 'A' ? 2 : 1);
    add(keys[1], 1);
    if (rank === 'S') add(keys[2], 1);
  } else {
    if (fn(g, 'addStageExp')) safe(() => g.addStageExp(k, 1));
    add(keys[0], RANK_GAIN[rank] ? 1 : 0);
    if (RANK_GAIN[rank] >= 2) add(keys[1], 1);
    if ((o.pressure ?? 0) >= 50 || (res && res.flubs === 0 && res.blanks === 0 && rank !== 'D')) add('dokyo', (o.pressure ?? 0) >= 50 ? 1 : 0);
    if (res && res.adlib) add('adlib', 1);
  }
  return parts.length ? '芸 ' + parts.join('・') : '';
}

// Resolve the ネタ for a performance: opts.neta, g.pickNeta (when the player owns scripts of the kind), else おまかせ.
async function resolveNeta(g, opts, kind) {
  if (opts.neta) return { neta: opts.neta, picked: true };
  const lk = kind === 'pin' ? 'pin' : kind;
  const own = fn(g, 'netaList') ? (safe(() => g.netaList(lk), []) || []) : [];
  if (own.length && fn(g, 'pickNeta') && !opts.skip && !g.auto) {
    const n = await safe(() => g.pickNeta({ kind: lk, length: opts.length, title: opts.title }), null);
    if (n) return { neta: n, picked: true };
  } else if (own.length && (opts.skip || g.auto)) {
    // おまかせ: the best of the player's own scripts
    const best = own.slice().sort((a, b) => quality(g, b) - quality(g, a))[0];
    if (best) return { neta: best, picked: true };
  }
  if (fn(g, 'autoNeta')) {
    const q = clamp(40 + (opts.venue && Number(opts.venue.pressure) ? opts.venue.pressure * 0.1 : 0), 30, 70);
    const n = safe(() => g.autoNeta(lk, q), null);
    if (n) return { neta: { ...n, auto: true }, picked: true };
  }
  return { neta: null, picked: false };
}
const quality = (g, n) => (fn(g, 'netaQuality') ? Number(safe(() => g.netaQuality(n), 0)) || 0 : 0);

const methods = {
  async perform(opts = {}) {
    const unit = fn(this, 'unit') ? safe(() => this.unit(), null) : null;
    const kind = normKind(opts.kind, unit);
    const { neta } = await resolveNeta(this, opts, kind);
    const o = { ...opts, kind, neta };
    if (opts.skip || this.auto) {
      const res = this.performSim(o);
      if (this.auto && Number.isFinite(this.auto.performScore)) {
        res.score = clamp(Math.round(this.auto.performScore), 0, 100);
        res.rank = rankOf(res.score);
        res.success = res.score >= (opts.pass ?? 50);
      }
      const role = unit && unit.members ? (unit.members.find((m) => m.id === 'player') || {}).role : null;
      const sum = growth(this, kind, res, { practice: opts.practice, pressure: res && opts.venue ? opts.venue.pressure : 0, role, netaId: res.netaId });
      if (sum && !this.auto) this.notify(sum, { color: '#5ee07a' });
      return res;
    }
    const id = MINIGAME_OF[kind] || 'manzai';
    const pressure = opts.venue && Number.isFinite(Number(opts.venue.pressure)) ? Number(opts.venue.pressure) : (opts.contest ? 60 : 25);
    const difficulty = opts.difficulty ?? clamp(1 + Math.round(pressure / 25), 1, 5);
    const style = id === 'pinneta' ? pinStyle(kind, opts) : undefined;
    const res = await this.minigame(id, { ...o, difficulty, style, noPick: true, title: opts.title || undefined });
    return res;
  },
  performSim(opts = {}) {
    const ctx = buildCtx(this, opts);
    const res = simulate(ctx, { pass: opts.pass });
    return res;
  },
  performGrowth(kind, res, o = {}) { return growth(this, kind, res, o); },
  performKinds() {
    const out = {};
    for (const k of Object.keys(MINIGAME_OF)) out[k] = { label: KIND_LABEL[k], minigame: MINIGAME_OF[k] };
    return out;
  },
};
function rankOf(s) { return s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 55 ? 'B' : s >= 35 ? 'C' : 'D'; }

export { growth as performGrowth };
export function installPerform(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installPerform(Game.prototype);
