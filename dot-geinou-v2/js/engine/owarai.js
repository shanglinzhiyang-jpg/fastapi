// お笑いの土台 (owner: A) — comedy stats, the player's act (コンビ / トリオ / ピン), 相方 (ネット / NSC), 芸歴, 実力不足.
// SKELETON: these are stub implementations of the CONTRACT4 API so the other reform modules can call them
// while A builds the real thing. A replaces the bodies and keeps every signature.

import { Game } from './game.js';
import { PEOPLE } from './life.js';
import { clamp } from './util.js';

export const COMEDY_STATS = {
  neta: 'ネタ作り', boke: 'ボケ', tsukkomi: 'ツッコミ', ma: '間・テンポ', voice: '声量・滑舌', act: '演技力',
  hassou: '発想力', wagei: '話芸', dokyo: '度胸', chara: 'キャラ・華', adlib: 'アドリブ', mane: 'ものまね',
};

function ensure(st) {
  if (!st.owarai || typeof st.owarai !== 'object') st.owarai = {};
  const o = st.owarai;
  if (!o.stats || typeof o.stats !== 'object') {
    const w = Number(st.skills && st.skills.warai) || 0;
    o.stats = {};
    for (const k of Object.keys(COMEDY_STATS)) o.stats[k] = Math.round(w * 0.5);
  }
  return o;
}

const methods = {
  owarai() { return ensure(this.state); },
  comedyStat(key, who = 'player') {
    const o = ensure(this.state);
    if (who === 'player') return Number(o.stats[key]) || 0;
    return Math.round((Number(this.state.skills && this.state.skills.warai) || 0) * 0.5);
  },
  addComedyStat(key, n) {
    const o = ensure(this.state);
    o.stats[key] = clamp((Number(o.stats[key]) || 0) + (Number(n) || 0), 0, 100);
    return o.stats[key];
  },
  unit() {
    const st = this.state;
    const P = st.partner && PEOPLE[st.partner];
    const me = { id: 'player', name: st.name, short: st.name, role: P ? 'tsukkomi' : 'pin', look: st.look, stats: { ...ensure(st).stats } };
    if (!P) return { id: 'solo', type: 'pin', name: st.name, members: [me], formed: { day: 1, year: null, month: null }, style: 'pin', harmony: 50, amateur: !st.agency, agency: st.agency || null, source: 'solo' };
    return { id: 'u_' + P.id, type: 'combi', name: `${st.name}と${P.short || P.name}`, members: [me, { id: P.id, name: P.name, short: P.short || P.name, role: 'boke', look: P.look, stats: { ...ensure(st).stats } }], formed: { day: 1, year: null, month: null }, style: 'manzai', harmony: 50, amateur: !st.agency, agency: st.agency || null, source: 'people' };
  },
  unitYears() { return 0; },
  geireki() { return 0; },
  playerAge() { return 20; },
  unitPower() {
    const s = ensure(this.state).stats;
    const v = Object.values(s).map(Number).filter(Number.isFinite);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  },
  shortfall(kind, need = 50) {
    const s = ensure(this.state).stats;
    const gaps = Object.keys(COMEDY_STATS).filter((k) => (Number(s[k]) || 0) < need).map((k) => ({ key: k, label: COMEDY_STATS[k], have: Number(s[k]) || 0, need }));
    return { ok: !gaps.length, gaps, text: gaps.length ? gaps.slice(0, 3).map((x) => `${x.label}が足りない`).join('、') : '' };
  },
  addStageExp() { const o = ensure(this.state); o.stages = (Number(o.stages) || 0) + 1; return o.stages; },
  partnerCandidates() { return []; },
  async openOwarai() {},
};

export function installOwarai(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installOwarai(Game.prototype);
