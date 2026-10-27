// 実績・図鑑 (R15): achievements and the 図鑑 (a record of what the player has done), as the phone app 「図鑑」.
//
// Every achievement reads the game's own state (contests, romance, politics, the clock, the world), so nothing is counted twice and
// old saves get the right answers at once. The record lives in g.state.zukan = { got: { id: day }, places: [placeId…] } (lazy, save-safe).
// Checked every morning (no message: a toast 「実績：…」 when one is reached) and when the player enters a new place (visit()).
// Some achievements are secret: their name and text stay 「？？？」 until they are reached.

import { registerPhoneApp, onMorning } from './life.js';
import { phoneList, phoneInfo } from './phone.js';
import { YEAR_DAYS } from './profile.js';
import { seasonsSeen } from './seasons.js';

const COLOR = '#c8a040';
const TOWNS = ['tokyo', 'machi', 'minato', 'nagatacho', 'kanraku', 'namba'];

// test(g, ctx) → true when reached. ctx: { rom, pol, contests, places }. Every test is wrapped (a missing piece just means "not yet").
export const ACHIEVEMENTS = [
  { id: 'first_contest', name: 'はじめての大会', desc: '賞レースの大会にエントリーした', test: (g, x) => x.entries.some((e) => e && e.status !== 'withdrawn') },
  { id: 'final', name: '決勝へ', desc: '決勝の舞台に進んだ', test: (g, x) => x.entries.some((e) => e && e.final) },
  { id: 'champion', name: '王者', desc: '大会で優勝した', test: (g, x) => x.entries.some((e) => e && e.status === 'champion') },
  { id: 'champion2', name: '二冠', desc: '大会で二度優勝した', secret: true, test: (g, x) => x.entries.filter((e) => e && e.status === 'champion').length >= 2 },
  { id: 'partner', name: 'コンビ結成', desc: 'ふたりで舞台に立った（相方）', test: (g) => { const u = g.unit && g.unit(); return !!(u && (u.type === 'combi' || u.type === 'trio')); } },
  { id: 'first_love', name: 'はじめての恋', desc: '「恋のはなし」で、気になる相手を決めた', test: (g, x) => !!x.rom && x.rom.pref !== null && x.rom.pref !== undefined && x.rom.pref !== 'off' },
  { id: 'lover', name: 'おつきあい', desc: '恋人ができた', test: (g, x) => !!x.rom && Object.values(x.rom.c || {}).some((r) => ['dating', 'cohab', 'engaged', 'married'].includes(r.st)) },
  { id: 'married', name: 'ゴールイン', desc: '結婚した', test: (g, x) => !!x.rom && Object.values(x.rom.c || {}).some((r) => r.st === 'married') },
  { id: 'parent', name: 'おやになる', desc: '子どもが生まれた', secret: true, test: (g, x) => !!x.rom && (x.rom.kids || []).length > 0 },
  { id: 'elected', name: '当選', desc: '選挙で議席を得た', test: (g, x) => !!x.pol && !!x.pol.me && !!x.pol.me.office },
  { id: 'premier', name: '総理大臣', desc: '内閣総理大臣になった', secret: true, test: (g, x) => !!x.pol && x.pol.cabinet && x.pol.cabinet.pm === 'player' },
  { id: 'licence', name: '免許証', desc: '自動車の運転免許を取った', test: (g) => { try { return !!(g.hasLicense && g.hasLicense('futsu')); } catch (e) { return false; } } },
  { id: 'all_nighter', name: '徹夜', desc: '一晩中起きていた', secret: true, test: (g) => { const c = g.state.clock; return !!(c && c.stats && c.stats.allNight >= 1); } },
  { id: 'year1', name: 'ひととせ', desc: '1年が過ぎた', test: (g) => g.state.day > YEAR_DAYS },
  { id: 'year5', name: 'ごねんめ', desc: '5年が過ぎた', test: (g) => g.state.day > YEAR_DAYS * 5 },
  { id: 'famous', name: 'ちょっと有名', desc: '知名度が500をこえた', test: (g) => Number(g.state.fame) >= 500 },
  { id: 'history', name: '歴史を見つめる', desc: '世界の歴史の列強を、設定で見守った', secret: true, test: (g) => { try { return g.histEventsOn() && g.histPowers().some((h) => h.on); } catch (e) { return false; } } },
  { id: 'ten_places', name: '行ったところ十か所', desc: '十か所の場所を訪れた', test: (g, x) => x.places.length >= 10 },
  { id: 'all_towns', name: '全部の街', desc: '六つの街すべてに行った', test: (g, x) => TOWNS.every((t) => x.places.includes(t)) },
  { id: 'seasons', name: '一年の行事', desc: '一年のうちに、季節の行事を五つ見た', secret: true, test: (g) => { try { return seasonsSeen(g) >= 5; } catch (e) { return false; } } },
  { id: 'station', name: '電車に乗る', desc: '駅に行った', test: (g, x) => x.places.some((p) => /eki|station/i.test(p)) },
];

// the record (created on first use; old saves start empty)
export function zk(g) {
  const st = g && g.state;
  if (!st) return null;
  let z = st.zukan;
  if (!z || typeof z !== 'object' || Array.isArray(z)) z = st.zukan = { got: {}, places: [] };
  if (!z.got || typeof z.got !== 'object') z.got = {};
  if (!Array.isArray(z.places)) z.places = [];
  return z;
}

// Read-only: the stored records only (g.contests() would create season state, which the 大会 flows rely on being untouched).
function ctxOf(g) {
  const z = zk(g);
  const st = g.state || {};
  const rom = st.flags && st.flags.rom ? st.flags.rom : null;
  const pol = st.politics || null;
  const entries = [];
  try { const cs = st.contests && st.contests.entries; if (cs && typeof cs === 'object') entries.push(...Object.values(cs)); } catch (e) { /* none */ }
  try { const m1 = st.m1 && st.m1.me && st.m1.me.entries; if (m1 && typeof m1 === 'object') for (const yr of Object.values(m1)) if (yr) entries.push(yr); } catch (e) { /* none */ }
  return { rom, pol, entries, places: z.places };
}

// check every achievement; reached ones are recorded and announced (one toast each). Returns the new ones.
export function checkAchievements(g) {
  const z = zk(g);
  if (!z) return [];
  const x = ctxOf(g);
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (z.got[a.id] != null) continue;
    let ok = false;
    try { ok = !!a.test(g, x); } catch (e) { ok = false; }
    if (!ok) continue;
    z.got[a.id] = g.state.day;
    fresh.push(a);
    try { g.notify(`実績：${a.name}`, { color: COLOR, life: 200 }); } catch (e) { /* no toast */ }
  }
  return fresh;
}

// the places visited (called by the watcher in ambience.js when the place changes)
export function visit(g, placeId) {
  const z = zk(g);
  if (!z || !placeId || z.places.includes(placeId)) return;
  z.places.push(placeId);
  if (z.places.length > 80) z.places.shift();
  checkAchievements(g);
}

export function summary(g) {
  const z = zk(g);
  const got = z ? Object.keys(z.got).length : 0;
  return { got, total: ACHIEVEMENTS.length, places: z ? z.places.length : 0 };
}

// ---------------------------------------------------------------- the phone app 「図鑑」
function rowsOf(g) {
  const z = zk(g) || { got: {}, places: [] };
  const s = summary(g);
  const rows = [{ header: true, label: `実績 ${s.got} / ${s.total}　行った場所 ${s.places}か所` }];
  for (const a of ACHIEVEMENTS) {
    const day = z.got[a.id];
    const hidden = a.secret && day == null;
    rows.push({
      key: a.id,
      label: day != null ? a.name : (hidden ? '？？？' : a.name),
      sub: day != null ? `${a.desc}（${Math.floor((day - 1) / YEAR_DAYS) + 1}年目）` : (hidden ? 'まだ秘密' : a.desc),
      right: day != null ? '◆' : '…',
      rightColor: day != null ? COLOR : '#6a7090',
    });
  }
  return rows;
}

async function zukanApp(g) {
  checkAchievements(g);
  for (;;) {
    const rows = rowsOf(g);
    const i = await phoneList(g, {
      title: '図鑑', color: COLOR, hint: 'A:くわしく　B:もどる',
      items: rows,
      rowH: 38,
    });
    if (i < 0 || i == null) return;
    const row = rows[i];
    if (!row || row.header) continue;
    const a = ACHIEVEMENTS.find((q) => q.id === row.key);
    if (!a) continue;
    const day = (zk(g).got || {})[a.id];
    await phoneInfo(g, {
      title: a ? (day != null ? a.name : '？？？') : '図鑑',
      color: COLOR,
      lines: day != null ? [a.desc, `達成：${Math.floor((day - 1) / YEAR_DAYS) + 1}年目（${day}日目）`] : (a.secret ? ['まだ秘密の実績。'] : ['まだ達成していない。', a.desc]),
    });
  }
}

onMorning((g) => { try { if (g && g.state) checkAchievements(g); } catch (e) { /* never block the morning */ } });

registerPhoneApp('zukan', {
  name: () => '図鑑',
  color: COLOR,
  order: 27,
  cond: (g) => !!g && !!g.state,
  open: (g) => zukanApp(g),
  icon: (ctx, x, y) => { ctx.fillStyle = COLOR; ctx.fillRect(x + 4, y + 3, 16, 18); ctx.fillStyle = '#fff6d0'; ctx.fillRect(x + 6, y + 6, 12, 2); ctx.fillRect(x + 6, y + 10, 12, 2); ctx.fillRect(x + 6, y + 14, 8, 2); },
});

