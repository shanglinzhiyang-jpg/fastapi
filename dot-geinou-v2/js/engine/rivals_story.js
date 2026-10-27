// ライバルコンビの物語 (R16): an act the player meets in a final again and again becomes a rival.
//
// Each finished contest year is read once from g.contestHistory (the frozen rows, so the same final is never counted twice).
// When the player reached the final — rank 1 (won over the runner-up) or rank 2 (lost to the champion) — the act they met there
// is recorded by name in g.state.rivals.list: meetings, wins, losses, and 雪辱 (a win over a rival who had beaten them).
// News (g.contestNews) at the second meeting, at a 雪辱, at the third (「ライバル」と呼ばれはじめる) and at the fifth.
// The record shows in 図鑑 (the rivals section) and two achievements (rival, revenge).
// Old saves: the years already played are recorded quietly on the first morning, so no flood of old news.

import { onMorning } from './life.js';
import { CONTESTS, isSelfRun } from './contests.js';

// the record (created on first use)
function rv(g) {
  const st = g && g.state;
  if (!st) return null;
  let r = st.rivals;
  if (!r || typeof r !== 'object' || Array.isArray(r)) r = st.rivals = { seen: {}, list: {} };
  if (!r.seen || typeof r.seen !== 'object') r.seen = {};
  if (!r.list || typeof r.list !== 'object') r.list = {};
  return r;
}

// the rivals, most meetings first (read-only: a save without the record gives [])
export function rivalsOf(g) {
  const list = g && g.state && g.state.rivals && g.state.rivals.list;
  return list && typeof list === 'object' ? Object.values(list).sort((a, b) => b.meets - a.meets || b.last - a.last) : [];
}

// the head-to-head of the player's final in one row: rank 1 beat the runner-up; rank 2 lost to the champion. Other places are not a head-to-head.
function finalOf(row) {
  if (!row) return null;
  if (row.player === 1 && row.runnerUp && row.runnerUp !== row.champion) return { rival: String(row.runnerUp), won: true };
  if (row.player === 2 && row.champion && row.champion !== row.runnerUp) return { rival: String(row.champion), won: false };
  return null;
}

const titleOf = (id) => {
  const d = CONTESTS[id] || {};
  return d.short || d.name || id;
};

// the news for this meeting, or null (the 雪辱 wins over the others)
function newsOf(rec, id, revenge) {
  const t = titleOf(id);
  if (revenge) return { kind: 'revenge', text: `${t}決勝で${rec.name}に勝ち返し、雪辱を果たした。` };
  if (rec.meets === 2) return { kind: 'again', text: `${t}決勝で、${rec.name}と再び顔を合わせた。` };
  if (rec.meets === 3) return { kind: 'rival', text: `${rec.name}は、もう「ライバル」と呼ばれはじめた。${t}決勝で3度目の対決。` };
  if (rec.meets === 5) return { kind: 'five', text: `${rec.name}との決勝対決は、通算5回目。` };
  return null;
}

// read every contest's new finished years and record the player's finals against a rival. Called every morning.
export function processRivals(g) {
  if (!g || !g.state) return;
  const quiet = !g.state.rivals; // the first look at this save: record the past without news
  const r = rv(g);
  if (!r) return;
  const entered = (g.state.contests && g.state.contests.entries) || {};
  for (const id of Object.keys(CONTESTS)) {
    if (!isSelfRun(CONTESTS[id]) && !entered[id]) continue; // the player never entered it: no final of theirs to read (and no history to build)
    let rows = [];
    try { rows = g.contestHistory(id) || []; } catch (e) { continue; }
    const from = Number(r.seen[id]) || 0;
    let top = from;
    for (const row of rows.slice().sort((a, b) => a.year - b.year)) {
      if (!(row.year > from)) continue;
      top = Math.max(top, row.year);
      const f = finalOf(row);
      if (!f) continue;
      const rec = r.list[f.rival] || (r.list[f.rival] = { name: f.rival, meets: 0, won: 0, lost: 0, revenge: 0, first: row.year, last: row.year });
      const revenge = f.won && rec.lost > 0;
      rec.meets++;
      rec.last = row.year;
      if (f.won) rec.won++; else rec.lost++;
      if (revenge) rec.revenge++;
      if (quiet) continue;
      const n = newsOf(rec, id, revenge);
      if (n) { try { g.contestNews(n.text, { contest: id, key: `rival|${rec.name}|${n.kind}|${rec.meets}`, prio: 55 }); } catch (e) { /* no news */ } }
    }
    if (top > from) r.seen[id] = top;
  }
}

onMorning((g) => { try { processRivals(g); } catch (e) { /* never block the morning */ } });
