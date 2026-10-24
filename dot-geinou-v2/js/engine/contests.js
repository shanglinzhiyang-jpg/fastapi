// 賞レースの土台 (owner: D1): registry, calendar, eligibility, entry, generic round runner, rivals, judges, history,
// news, rewards, the morning hook. contest_ui.js (HD screen + phone app) and places/shourace.js (venue) are D1's too.
// SKELETON: the registry and the def schema are final (D2 / E1 / E2 build on them); the g.* bodies are stubs D1 replaces.
//
// registerContest(id, def) — def schema (all fields optional unless marked *):
//   name*         '…'                       display name (current era). names: [{ from: 2017, name: 'R-1グランプリ' }, …] for renames
//   short         'M-1'                     short label (HUD / lists, ≤ 8 chars)
//   kind*         'manzai'|'conte'|'pin'|'rakugo'|'ogiri'|'utaneta'|'monomane'|'talk'|'any'|'double'   ('double' = 漫才とコント両方)
//   category      'major' | 'tv' | 'kansai' | 'newcomer' | 'agency' | 'invitational' | 'amateur' | 'special'
//   organizer     '朝日放送テレビ・吉本興業'  broadcaster '…'  venue '…' (final venue / hall text)  region 'tokyo'|'osaka'|'nagoya'|'all'
//   history*      { founded: 2001, ended: 2010 | null, gaps: [[2011, 2014]], revived: 2015 | null, note: '…', sources: ['url', …] }
//   revive        true (default): after `ended` it is held as 「復刻開催」 every year, edition numbers continuing
//   editionOf     (year) => number | null   real edition number for a year (default: count of held years since founded)
//   schedule*     { entry: { from: [month, dom], to: [month, dom] } | null, final: [month, dom] }   (dom 1..10, game month = 10 days)
//   rounds*       [{ id: 'r1', name: '1回戦', when: [month, dom] | [[m, d], [m, d] …] (several dates/venues: the player picks one),
//                    venues: ['東京', '大阪', …], length: 120 (sec), pass: 0.3 (share) | 24 (count), field: 3000 (entrants, rough),
//                    judge: 'staff'|'panel'|'audience'|'vote'|'points', judges: 7, scoring: '100点×7' (text), revival: bool (敗者復活),
//                    tv: bool (broadcast), final: bool, rounds2: … (contest-specific extras are fine), run: async (g, ctx) => result }
//   eligibility   { pro: true, amateur: true, members: [2, null] (min, max|null), unitYearsMax: 15, unitYearsMin: 16, geirekiMax: 10,
//                   geirekiMin, ageMax: 25, ageMin, agency: ['yoshimoto'] (membership required), region, invite: { fame: 2000 } (TV invitational),
//                   note: '結成15年以内（プロ・アマ問わず、2人以上）' } | (g, unit, year) => ({ ok, why })
//   fee           { pro: 2000, amateur: 2000 } | number | (g, unit, year) => yen    real entry fee (0 = free / invitation)
//   prize         10000000 (yen) | (year) => yen,  prizeText '優勝賞金1000万円'
//   perform       { kind, length (sec) } what is performed (defaults from kind / round.length)
//   news          ['…', (g, ctx) => '…', …] extra news lines (D1 also generates generic ones)
//   catchcopy     (g, ctx) => '…'           finalist catch copy
//   flow          async (g, ctx) => void    the WHOLE contest is run by the def (E1 / E2): D1's generic runner then only lists it,
//                                           reminds, and calls flow when the player chooses to go on a round day
//   entry         async (g, ctx) => entry | null   replaces the generic entry flow (エントリー用紙 etc.)
//   onMorning     (g, ctx) => void          per-contest morning work (D1 calls it every morning, errors caught)
//   status        (g) => object             summary for the notebook / screens
//   ctx = { id, def, year, edition, revival, entry, round, date }
// Rules of thumb: real names, years, fees and formats verified (comment the sources); every person fictional.

import { Game } from './game.js';
import { onMorning } from './life.js';

export const CONTESTS = {};
export function registerContest(id, def) {
  if (!id || !def) return;
  CONTESTS[id] = { id, revive: true, ...def };
}

const MONTH_DAYS = 10;
const ERA_BASE_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
// The in-game date { year, month, dom } (g.gameDate when the politics core is loaded; the same calendar otherwise).
export function contestDate(g, day) {
  try {
    if (g && typeof g.gameDate === 'function') {
      const d = day == null ? g.gameDate() : g.gameDate(day);
      if (d && Number.isFinite(d.year)) return { year: d.year, month: d.month, dom: d.dom || 1 };
    }
  } catch (e) { /* fall back */ }
  const st = g && g.state;
  const era = (st && st.profile && st.profile.era) || 'reiwa';
  const n = Math.max(0, ((day ?? (st && st.day)) || 1) - 1);
  const idx = 3 + Math.floor(n / MONTH_DAYS);
  return { year: (ERA_BASE_YEAR[era] ?? 2026) + Math.floor(idx / 12), month: (idx % 12) + 1, dom: (n % MONTH_DAYS) + 1 };
}

function ensure(st) {
  if (!st.contests || typeof st.contests !== 'object') st.contests = { entries: {}, news: [], seen: {} };
  if (!st.contests.entries || typeof st.contests.entries !== 'object') st.contests.entries = {};
  return st.contests;
}

const methods = {
  contests() { return Object.values(CONTESTS).map((def) => ({ id: def.id, def, status: 'open', edition: null, nextRound: null, entry: this.contestEntry(def.id) })); },
  contest(id) { return CONTESTS[id] || null; },
  contestEdition(id, year) {
    const def = CONTESTS[id];
    if (!def || !def.history) return null;
    const y = year ?? contestDate(this).year;
    const h = def.history;
    if (y < h.founded) return null;
    return { edition: typeof def.editionOf === 'function' ? def.editionOf(y) : y - h.founded + 1, year: y, revival: !!(h.ended && y > h.ended), label: '' };
  },
  contestEntry(id, year) { const c = ensure(this.state); const y = year ?? contestDate(this).year; return (c.entries[id] && c.entries[id][y]) || null; },
  async enterContest() { return null; },
  contestRivals(id, round, n = 10) { return Array.from({ length: n }, (_, i) => ({ name: `ライバル${i + 1}`, unit: 'combi', kind: 'manzai', power: 40 + i * 4, tags: [], agency: null })); },
  contestJudges(id, year, n = 5) { return Array.from({ length: n }, (_, i) => ({ name: `審査員${i + 1}`, title: '', taste: '' })); },
  contestHistory() { return []; },
  contestNews(text, opts = {}) { if (text) this.message({ from: 'お笑いニュース', text, kind: 'news', ...(opts.contest ? { contest: opts.contest } : {}) }); },
  contestVenue() {},
  async openContests() {},
};

export function installContests(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installContests(Game.prototype);

// D1: the real morning hook (reminders, results, digest, def.onMorning) goes here.
onMorning(() => {});
