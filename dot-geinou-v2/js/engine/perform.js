// 芸の実演 (owner: C): g.perform / g.performSim over the minigames manzai / conte / rakugo / ogiri / pinneta.
// SKELETON: stub implementations of the CONTRACT4 API; C replaces the bodies and keeps every signature.

import { Game } from './game.js';
import { clamp } from './util.js';
import { rankFor } from './minigame.js';

function sim(g, opts = {}) {
  const power = opts.power ?? (typeof g.unitPower === 'function' ? g.unitPower(opts.kind) : 40);
  const quality = opts.quality ?? (opts.neta && typeof g.netaQuality === 'function' ? g.netaQuality(opts.neta) : 45);
  const r = typeof opts.rng === 'function' ? opts.rng() : Math.random();
  const score = clamp(Math.round(power * 0.5 + quality * 0.4 + (r - 0.5) * 20), 0, 100);
  return { score, rank: rankFor(score), laughs: Math.round(score / 8), big: Math.round(score / 30), flubs: 0, blanks: 0, overtime: 0, adlib: 0, heat: [score], parts: { neta: quality, execution: power, presence: power, timing: power, crowd: 50 }, comment: '', highlights: [] };
}

const methods = {
  async perform(opts = {}) {
    if (!opts.skip && !this.auto) {
      const r = await this.minigame('tsukkomi', { difficulty: 3, skill: 'warai', title: opts.title });
      return { ...sim(this, opts), score: r.score, rank: r.rank };
    }
    return sim(this, opts);
  },
  performSim(opts = {}) { return sim(this, opts); },
};

export function installPerform(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installPerform(Game.prototype);
