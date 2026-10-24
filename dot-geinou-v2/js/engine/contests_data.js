// 全賞レースのデータ (owner: D2a) — 20 contests registered with D1's registerContest (contests.js):
//   THE SECOND, ダブルインパクト, THE MANZAI, NHK新人お笑い大賞, NHK新人落語大賞, NHK上方漫才コンテスト, 上方漫才大賞, 上方お笑い大賞,
//   ytv漫才新人賞, MBS新世代漫才アワード (contests_data_a.js) and 歌ネタ王決定戦, オールザッツ漫才, ツギクル芸人グランプリ, MXグランプリ,
//   IPPONグランプリ, 人志松本のすべらない話, おもしろ荘, フットンダ王決定戦, AUN, UNDER5 AWARD (contests_data_b.js).
// Shared parts (fictional names, the HD scoreboard backdrop, performing with fallbacks, standard rounds) are in contests_data_lib.js.
// The other contests of the list are D2b's (contests_data2.js), M-1 is E1's, KOC / R-1 / ABC are E2's.
// API / table of contests: test-output/api_contests_data.txt.

import { registerContest } from './contests.js';
import { defineContestsA, D2A_DEFS } from './contests_data_a.js';
import { defineContestsB, D2B_DEFS } from './contests_data_b.js';

defineContestsA(registerContest);
defineContestsB(registerContest);

// id → def of every contest this file registers (tests, the README table)
export const D2_CONTESTS = { ...D2A_DEFS, ...D2B_DEFS };
export const D2_CONTEST_IDS = Object.keys(D2_CONTESTS);
