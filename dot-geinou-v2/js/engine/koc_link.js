// キングオブコント ⇄ D1's 賞レースの土台 (owner: E2). KOC is registered with def.selfRun: true — it runs its own world
// (koc_core.js: this world's acts, every round, the history) and D1 never simulates it, posts none of its generic news and keeps
// no KOC entry. D1 reads KOC through the def's hooks (status / historyList / rivalsOf / roundsOf / scheduleOf / feeText /
// entryCount, contest_koc.js) and opens def.flow from its 「今日の予定」. This file keeps the little that is still shared:
//   ・D1's news queue (g.contestNews: its morning budget of ≤ 3 lines + digest) — KOC's news and personal notices go through it;
//   ・the D1 day number of a KOC date (status(g).entry.next.day);
//   ・old saves from before selfRun: the KOC entry KOC used to register in D1 (st.contests.entries.koc) is dropped once, so D1's
//     screens show KOC's own status (contestInfo reads status(g) only when D1 holds no entry of its own).
// Without D1 every function does nothing and KOC sends its messages itself.

const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error('[koc link]', e); return d; } };

// D1's news queue is there
export function linked(g) { return !!(g && g.state && has(g, 'contestNews')); }

// the D1 day number (g.state.day scale) of a KOC date [month, dom] of year y; `abs` converts a KOC date (koc_core absOf)
export function d1Day(g, absNow, absThen) { return g && g.state ? g.state.day + (absThen - absNow) : null; }

// old saves (before selfRun): KOC's entry registered in D1 → dropped once (KOC's own entry in st.koc is the only one)
export function migrate(g, k) {
  if (!g || !g.state || !k || k.selfRun) return;
  k.selfRun = 1;
  const c = has(g, 'contestState') ? safe(() => g.contestState(), null) : g.state.contests || null;
  if (c && c.entries && c.entries.koc) delete c.entries.koc;
  for (const Y of Object.values(k.years || {})) if (Y && Y.entry) { delete Y.entry.d1; delete Y.entry.picked; }
}
