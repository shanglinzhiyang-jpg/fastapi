// 台本（ネタ帳）と AI審査員 (owner: B). Extra files (neta_ai.js, neta_ui.js …) are imported from here.
// SKELETON: stub implementations of the CONTRACT4 API; B replaces the bodies and keeps every signature.

import { Game } from './game.js';
import { clamp } from './util.js';

function ensure(st) {
  if (!st.neta || typeof st.neta !== 'object') st.neta = { list: [], nextId: 1 };
  if (!Array.isArray(st.neta.list)) st.neta.list = [];
  return st.neta;
}

const methods = {
  netaList(kind) { const n = ensure(this.state); return n.list.filter((x) => !kind || x.kind === kind).slice().reverse(); },
  neta(id) { return ensure(this.state).list.find((x) => x.id === id) || null; },
  async writeNeta() { return null; },
  async pickNeta() { return null; },
  async scoreNeta(n) { const x = typeof n === 'string' ? this.neta(n) : n; return (x && x.ai) || { total: 50, axes: {}, comments: [], judges: [], by: 'local', day: this.state.day }; },
  netaQuality(n) { const x = typeof n === 'string' ? this.neta(n) : n; if (!x) return 40; return clamp(Math.round(((x.ai && x.ai.total) || 50) * 0.7 + (x.practice || 0) * 0.3), 0, 100); },
  practiceNeta(id, n = 5) { const x = this.neta(id); if (!x) return 0; x.practice = clamp((x.practice || 0) + n, 0, 100); return x.practice; },
  markNetaUsed(id, contestId) { const x = this.neta(id); if (x) { x.uses = x.uses || {}; x.uses[contestId] = (x.uses[contestId] || 0) + 1; } },
  autoNeta(kind, quality = 50) { return { id: 'auto', kind, title: 'おまかせネタ', theme: '', setting: '', length: 240, lines: [], ai: { total: quality, axes: {}, comments: [], judges: [], by: 'local', day: this.state.day }, practice: quality, uses: {}, auto: true }; },
};

export function installNeta(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installNeta(Game.prototype);
