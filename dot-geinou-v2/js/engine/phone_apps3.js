// 有能アプリ その3 (owner: R7-G): nine apps that do real work in the game, each in the era's form
// (手帳 / ケータイ / スマホ). API doc: test-output/api_apps3.txt.
//   乗換案内 (時刻表)      phone_apps3_move.js   routes by 徒歩 / 電車 / バス / タクシー / 新幹線 with time, fare,
//                                               transfers; starts the trip (like the マップ app)
//   求人 (求人誌 / バイト) phone_apps3_work.js   one 日払い shift a day; a little growth; ネタの種 notes
//   動画配信 (投稿ビデオ)  phone_apps3_work.js   videos / live streams (2006〜 / 2007-12〜) or tapes to a TV 投稿コーナー
//   投資 (証券 / 株)       phone_apps3_money.js  日経平均 by real history + three companies; fees, tax, NISA (2014〜)
//   フリマ (リサイクル)    phone_apps3_money.js  sell unused もちもの / furniture (shop · auction 1999〜 · フリマ 2012-07〜)
//   メモ                   phone_apps3_tools.js  notes, pins, ネタの種 → g.writeNeta
//   ネタ時計 (ネタ録音)    phone_apps3_tools.js  stopwatch; timed run-throughs (+仕上がり), the recording, contests' 尺
//   お笑い用語             phone_apps3_tools.js  the trade's words with what they mean in this game
//   やること               phone_apps3_tools.js  today's plan from the game state + a to-do list
// Shared state / helpers: phone_apps3_kit.js (g.state.phone.apps3). The clock (g.clock) and the weather
// (g.weather) of R7-C's clock.js are used when present (feature-detected).

import { registerPhoneApp, onMorning } from './life.js';
import { appTile } from './phone.js';
import { Game } from './game.js';
import { R, disc, art, devOf, s3, part, addMemo, num, safe } from './phone_apps3_kit.js';
import { norikaeApp, norikaeTitle, COLOR as NORIKAE_COLOR, routesTo, destinations, hereOf } from './phone_apps3_move.js';
import { investApp, investTitle, INV_COLOR, investMorning, furimaApp, furimaTitle, FURIMA_COLOR, furimaMorning, quote, portfolio, marketTo } from './phone_apps3_money.js';
import { kyujinApp, kyujinTitle, JOB_COLOR, videoApp, videoTitle, VIDEO_COLOR, videoOpen, videoMorning, baitoToday, doShift } from './phone_apps3_work.js';
import { memoApp, MEMO_COLOR, timerApp, timerTitle, TIMER_COLOR, yougoApp, YOUGO_COLOR, planApp, PLAN_COLOR, planBadge } from './phone_apps3_tools.js';

export * from './phone_apps3_kit.js';
export * from './phone_apps3_move.js';
export * from './phone_apps3_money.js';
export * from './phone_apps3_work.js';
export * from './phone_apps3_tools.js';

// ======================================================================== icons (32x32 on appTile)
function iconNorikae(c, x, y, g) {
  appTile(c, x, y, NORIKAE_COLOR);
  if (devOf(g) === 'techo') {
    // a timetable book
    R(c, x + 7, y + 5, 18, 23, '#1a2a4a'); R(c, x + 8, y + 6, 16, 21, '#f6f0dc');
    R(c, x + 8, y + 6, 16, 5, '#d6463a');
    for (let i = 0; i < 4; i++) { R(c, x + 10, y + 14 + i * 3, 5, 1, '#3a3a4a'); R(c, x + 17, y + 14 + i * 3, 5, 1, '#3a3a4a'); }
    return;
  }
  // a train front with a route line
  R(c, x + 8, y + 6, 16, 18, '#f0f4f8'); R(c, x + 8, y + 6, 16, 2, '#ffffff');
  R(c, x + 10, y + 9, 12, 6, '#2a3a5a'); R(c, x + 8, y + 18, 16, 2, '#2f9a4a');
  disc(c, x + 11, y + 21, 1, '#ffd23f'); disc(c, x + 20, y + 21, 1, '#ffd23f');
  R(c, x + 10, y + 24, 2, 3, '#20232a'); R(c, x + 20, y + 24, 2, 3, '#20232a');
  R(c, x + 5, y + 27, 22, 1, '#ffffff');
}
function iconKyujin(c, x, y, g) {
  appTile(c, x, y, JOB_COLOR);
  if (devOf(g) === 'techo') {
    // a job magazine
    R(c, x + 7, y + 5, 18, 23, '#2a1a0a'); R(c, x + 8, y + 6, 16, 21, '#fff6e0');
    R(c, x + 8, y + 6, 16, 6, '#ffd23f'); art(c, x + 10, y + 7, ['#.#.###', '###.#.#', '#.#.###'], { '#': '#c0303a' });
    for (let i = 0; i < 4; i++) R(c, x + 10, y + 15 + i * 3, 12, 1, '#a89878');
    return;
  }
  // a name badge + yen coin
  R(c, x + 6, y + 8, 20, 14, '#ffffff'); R(c, x + 6, y + 8, 20, 4, '#ffd23f');
  R(c, x + 9, y + 15, 9, 1, '#3a3a4a'); R(c, x + 9, y + 18, 6, 1, '#3a3a4a');
  disc(c, x + 23, y + 23, 5, '#a07018'); disc(c, x + 23, y + 23, 4, '#f0c040');
  art(c, x + 21, y + 20, ['#.#', '.#.', '###', '.#.'], { '#': '#a07018' });
}
function iconVideo(c, x, y, g) {
  appTile(c, x, y, VIDEO_COLOR);
  if (devOf(g) === 'techo') {
    // a VHS tape
    R(c, x + 4, y + 9, 24, 15, '#20202a'); R(c, x + 7, y + 11, 18, 5, '#f0f0e8');
    disc(c, x + 11, y + 20, 2, '#6a6a76'); disc(c, x + 21, y + 20, 2, '#6a6a76');
    return;
  }
  // a play button
  R(c, x + 5, y + 8, 22, 16, '#ffffff');
  art(c, x + 13, y + 11, ['#....', '###..', '#####', '###..', '#....'], { '#': VIDEO_COLOR }, 2);
}
function iconInvest(c, x, y, g) {
  appTile(c, x, y, INV_COLOR);
  R(c, x + 5, y + 6, 22, 20, devOf(g) === 'techo' ? '#f6f0dc' : '#eef8f2');
  const pts = [[6, 22], [10, 18], [14, 20], [18, 12], [22, 15], [26, 8]];
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; for (let k = 0; k <= 8; k++) R(c, x + x0 + ((x1 - x0) * k) / 8, y + y0 + ((y1 - y0) * k) / 8, 2, 2, '#c0303a'); }
  R(c, x + 5, y + 25, 22, 1, '#2a4a40');
}
function iconFurima(c, x, y, g) {
  appTile(c, x, y, FURIMA_COLOR);
  // a box with a price tag
  R(c, x + 6, y + 12, 16, 14, '#c89858'); R(c, x + 6, y + 12, 16, 3, '#e0b878'); R(c, x + 13, y + 12, 2, 14, '#a07038');
  R(c, x + 17, y + 6, 10, 8, '#ffffff'); disc(c, x + 19, y + 10, 1, FURIMA_COLOR);
  art(c, x + 21, y + 8, ['#.#', '.#.', '###', '.#.'], { '#': '#3a3a4a' });
}
function iconMemo(c, x, y, g) {
  appTile(c, x, y, MEMO_COLOR);
  R(c, x + 7, y + 5, 18, 22, devOf(g) === 'techo' ? '#f6f0dc' : '#fffbe0');
  for (let i = 0; i < 5; i++) R(c, x + 9, y + 9 + i * 4, 14, 1, '#d8c890');
  R(c, x + 9, y + 9, 9, 1, '#5a4a2a'); R(c, x + 9, y + 13, 12, 1, '#5a4a2a');
  // a pencil
  for (let k = 0; k < 10; k++) R(c, x + 14 + k, y + 24 - k, 3, 2, k < 2 ? '#3a3a4a' : k < 3 ? '#f2c8a0' : '#e8a020');
}
function iconTimer(c, x, y, g) {
  appTile(c, x, y, TIMER_COLOR);
  if (devOf(g) === 'techo') {
    // a stopwatch
    disc(c, x + 16, y + 18, 9, '#d8d8e0'); disc(c, x + 16, y + 18, 7, '#ffffff');
    R(c, x + 14, y + 6, 4, 3, '#d8d8e0'); R(c, x + 16, y + 12, 1, 6, '#20202a'); R(c, x + 16, y + 18, 5, 1, '#d6463a');
    return;
  }
  // a microphone with a timer arc
  R(c, x + 13, y + 6, 6, 12, '#e8e8f0'); R(c, x + 13, y + 6, 6, 2, '#ffffff');
  for (let i = 8; i < 18; i += 2) R(c, x + 14, y + i, 4, 1, '#8a8a96');
  R(c, x + 10, y + 16, 1, 4, '#ffffff'); R(c, x + 21, y + 16, 1, 4, '#ffffff'); R(c, x + 11, y + 20, 10, 1, '#ffffff');
  R(c, x + 15, y + 21, 2, 4, '#ffffff'); R(c, x + 11, y + 25, 10, 2, '#ffffff');
  disc(c, x + 25, y + 8, 3, '#d6463a');
}
function iconYougo(c, x, y, g) {
  appTile(c, x, y, YOUGO_COLOR);
  // a dictionary with 「笑」
  R(c, x + 6, y + 5, 20, 23, '#3a1a0a'); R(c, x + 8, y + 6, 17, 21, '#f6ecd8');
  R(c, x + 6, y + 5, 3, 23, '#6a3a1a');
  art(c, x + 11, y + 9, ['.#.#.#.', '#######', '..#.#..', '.#####.', '...#...', '#######', '.#...#.', '#.....#'], { '#': '#a0522d' }, 1);
  R(c, x + 10, y + 22, 13, 1, '#c8b898');
}
function iconPlan(c, x, y, g) {
  appTile(c, x, y, PLAN_COLOR);
  R(c, x + 6, y + 5, 20, 22, '#ffffff');
  for (let i = 0; i < 4; i++) {
    R(c, x + 8, y + 8 + i * 5, 4, 4, '#3a3a4a'); R(c, x + 9, y + 9 + i * 5, 2, 2, '#ffffff');
    if (i < 2) { R(c, x + 9, y + 10 + i * 5, 1, 1, '#2f9a4a'); R(c, x + 10, y + 9 + i * 5, 2, 1, '#2f9a4a'); }
    R(c, x + 14, y + 9 + i * 5, 10, 2, i < 2 ? '#b8c8b0' : '#5a6a5a');
  }
}

// ======================================================================== registration
registerPhoneApp('plan', { name: 'やること', color: PLAN_COLOR, order: 30.5, iconHD: iconPlan, badge: (g) => planBadge(g), open: (g) => planApp(g) });
registerPhoneApp('norikae', { name: (g) => norikaeTitle(g), color: NORIKAE_COLOR, order: 32.5, iconHD: iconNorikae, open: (g) => norikaeApp(g) });
registerPhoneApp('kyujin', { name: (g) => kyujinTitle(g), color: JOB_COLOR, order: 33.5, iconHD: iconKyujin, open: (g) => kyujinApp(g) });
registerPhoneApp('netatimer', { name: (g) => timerTitle(g), color: TIMER_COLOR, order: 35.5, iconHD: iconTimer, open: (g) => timerApp(g) });
registerPhoneApp('toushi', { name: (g) => investTitle(g), color: INV_COLOR, order: 42.5, iconHD: iconInvest, open: (g) => investApp(g) });
registerPhoneApp('douga', { name: (g) => videoTitle(g), color: VIDEO_COLOR, order: 45.5, iconHD: iconVideo, cond: (g) => videoOpen(g), open: (g) => videoApp(g) });
registerPhoneApp('furima', { name: (g) => furimaTitle(g), color: FURIMA_COLOR, order: 65.5, iconHD: iconFurima, open: (g) => furimaApp(g) });
registerPhoneApp('yougo', { name: 'お笑い用語', color: YOUGO_COLOR, order: 77, iconHD: iconYougo, open: (g) => yougoApp(g) });
registerPhoneApp('memo', { name: 'メモ', color: MEMO_COLOR, order: 78, iconHD: iconMemo, open: (g) => memoApp(g) });

// the morning: the market moves, listings sell, videos keep getting views, tapes are judged
onMorning((g) => {
  if (!g || !g.state) return;
  s3(g);
  for (const fn of [investMorning, furimaMorning, videoMorning]) { try { fn(g); } catch (e) { console.error(e); } }
});

// ======================================================================== g.* (feature-detected by other modules)
export function installApps3(proto) {
  proto.apps3 = function apps3() { return s3(this); };
  proto.addMemo = function addMemoG(o) { return addMemo(this, typeof o === 'string' ? { text: o } : o || {}); };
  proto.marketQuote = function marketQuote(id = 'index') { return safe(() => quote(this, id), null); };
  proto.investPortfolio = function investPortfolio() { return safe(() => portfolio(this), null); };
}
installApps3(Game.prototype);
