// 賞レースのデータ その2 (owner: D2b) — 19 contests registered via registerContest (D1's schema in contests.js):
//   kamigata_kyokai 上方漫才協会大賞 · under25 UNDER 25 OWARAI CHAMPIONSHIP · imamiya 今宮子供えびすマンザイ新人コンクール ·
//   warawankai 笑わん会 · bu1 武−1グランプリ · alcoveil ネクストブレイク芸人決定戦 よしもとアルコベールグランプリ ·
//   monomanegp ものまねグランプリ 次世代ものまね芸人No.1決定戦 · loudness 笑ラウドネスGP · bs1 Bs-1グランプリ ·
//   okowa OKOWAチャンピオンシップ · t1 T-1グランプリ · yama1 山-1グランプリ · hope お笑いホープ大賞 · harvest お笑いハーベスト大賞 ·
//   kagetsu 花月大賞 · seijinshiki お笑い成人式 · biathlon お笑いバイアスロン · hyaku 100×100 · thirty1 30-1 グランプリ
// Files: contests_data2_kit.js (helpers + fallbacks), contests_data2_scenes.js (backdrops, 笑い声/恐怖メーター, boards, brackets),
//   contests_data2_flow.js (the shared round flow), contests_data2_defs1.js / _defs2.js (the defs, with sources and
//   verified / unverified facts per contest). API doc: test-output/api_contests_data2.txt.
// State: st.contests2 (lazy). Public extra: g.contests2() → { wins, log (latest 20), ids }.
import { CONTESTS } from './contests.js';
import { Game } from './game.js';
import './contests_data2_defs1.js';
import './contests_data2_defs2.js';
import { d2 } from './contests_data2_kit.js';

export const D2B_IDS = ['kamigata_kyokai', 'under25', 'imamiya', 'warawankai', 'bu1', 'alcoveil', 'monomanegp', 'loudness', 'bs1', 'okowa',
  't1', 'yama1', 'hope', 'harvest', 'kagetsu', 'seijinshiki', 'biathlon', 'hyaku', 'thirty1'];

// a status summary per contest for the notebook / screens (def.status), unless a def has its own
for (const id of D2B_IDS) {
  const def = CONTESTS[id];
  if (!def || def.status) continue;
  def.status = (g) => {
    const s = d2(g);
    const log = s.log.filter((x) => x.id === id);
    return { wins: (s.wins[id] || []).slice(), best: log.reduce((b, x) => (x.place && (!b || x.place < b) ? x.place : b), null), last: log[0] || null };
  };
}

const methods = {
  contests2() {
    const s = d2(this);
    return { wins: JSON.parse(JSON.stringify(s.wins)), log: s.log.slice(0, 20), ids: D2B_IDS.slice() };
  },
};
export function installContests2(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installContests2(Game.prototype);
