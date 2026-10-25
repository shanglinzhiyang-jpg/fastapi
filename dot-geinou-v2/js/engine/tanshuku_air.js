// はねるのトびら「短縮鉄道の夜」: when the corner was on the air, and the game's year/month (owner C / R7-E).
//   CORNER                 { program, from: [2007, 4, 11], to: [2009, 6, 24], nights: 26 } (第1夜 … 第26夜「最終回」)
//   gameYM(g)              { year, month } of the game date (g.gameDate() when present, else the 10-days-a-month
//                          calendar from the era's start: showa 1987-04, heisei_early 1996-04, heisei 2004-04, reiwa 2026-04)
//   onAirYM(year, month)   true from 2007-04 through 2009-06
//   cornerOnAir(g)         onAirYM(gameYM(g))
// Pure module (no imports): programs.js and the quiz app load it with a dynamic import.

export const CORNER = Object.freeze({ program: 'はねるのトびら', station: 'fujitv', title: '短縮鉄道の夜', from: [2007, 4, 11], to: [2009, 6, 24], nights: 26 });
const ERA_START = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
const MONTH_DAYS = 10;

export function gameYM(g) {
  try {
    const d = g && typeof g.gameDate === 'function' ? g.gameDate() : null;
    if (d && Number.isFinite(d.year)) return { year: d.year, month: Math.min(12, Math.max(1, Math.round(d.month || 6))) };
  } catch (e) { /* fall back to the plain calendar */ }
  const st = (g && g.state) || {};
  const base = ERA_START[st.profile && st.profile.era] || 2026;
  const day = Number.isFinite(Number(st.day)) ? Number(st.day) : 1;
  const idx = 3 + Math.floor(Math.max(0, day - 1) / MONTH_DAYS);
  return { year: base + Math.floor(idx / 12), month: (idx % 12) + 1 };
}
export function onAirYM(year, month = 6) {
  const v = Number(year) * 100 + Number(month);
  return v >= CORNER.from[0] * 100 + CORNER.from[1] && v <= CORNER.to[0] * 100 + CORNER.to[1];
}
export const cornerOnAir = (g) => { const d = gameYM(g); return onAirYM(d.year, d.month); };
