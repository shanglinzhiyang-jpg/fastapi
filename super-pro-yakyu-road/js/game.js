// スーパープロ野球ロード — one game: the state (inning, outs, count, bases, score, line score, who bats, who pitches), the rules
// that apply a plate appearance (runners, runs, outs, the end of a half / the game, walk-offs, extra innings to 12 then a draw),
// pitching changes (fatigue, the closer), the winning / losing / saving pitcher, box scores and season stats; and the
// probability model of a plate appearance used by every computer-played at-bat (simPA).
import { clamp, gauss } from './core.js';
import { pitchStuff, pname, BALANCE } from './data.js';
// the league balance, with the ball the league uses (球団運営 → 使用球: 飛ぶボール / 標準 / 飛ばないボール)
export const BALLS = { fly: { name: '飛ぶボール', hr: 1.3, hit: 1.02 }, std: { name: '標準球', hr: 1, hit: 1 }, dead: { name: '飛ばないボール', hr: 0.72, hit: 0.98 } };
const balMemo = new Map();
export const balOf = (L) => {
  const b = BALANCE[(L && L.balance) || 'normal'] || BALANCE.normal, ball = BALLS[(L && L.front && L.front.ball) || 'std'] || BALLS.std;
  const key = `${b.name}|${ball.name}`;
  if (!balMemo.has(key)) balMemo.set(key, { ...b, hr: b.hr * ball.hr, hit: b.hit * ball.hit });
  return balMemo.get(key);
};
// a club's form (球団運営: the manager, team morale): −1..+1 for batting and pitching
const modOf = (L, teamId) => (L.teams[teamId] && L.teams[teamId].mod) || { bat: 0, pit: 0 };

export const MAX_INN = 12;
const num = (v) => (Number.isFinite(v) ? v : 0);
const sideOf = (GS, team) => (GS.home === team ? 'home' : 'away');
export const battingSide = (GS) => (GS.top ? 'away' : 'home');
export const fieldingSide = (GS) => (GS.top ? 'home' : 'away');
export const batterOf = (GS, L) => { const s = battingSide(GS); return L.P[GS.lineup[s][GS.idx[s] % 9]]; };
export const pitcherOf = (GS, L) => L.P[GS.pit[fieldingSide(GS)]];
export const nextBatters = (GS, L, n = 3) => { const s = battingSide(GS); return Array.from({ length: n }, (_, k) => L.P[GS.lineup[s][(GS.idx[s] + k) % 9]]); };

function blankBox() { return { pa: 0, ab: 0, h: 0, d2: 0, d3: 0, hr: 0, rbi: 0, bb: 0, so: 0, r: 0 }; }
function blankPit() { return { outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pc: 0, bf: 0 }; }
export function seasonStats(p) {
  if (!p.s) p.s = { g: 0, pa: 0, ab: 0, h: 0, d2: 0, d3: 0, hr: 0, rbi: 0, bb: 0, so: 0, r: 0, pg: 0, gs: 0, w: 0, l: 0, sv: 0, hld: 0, outs: 0, ph: 0, er: 0, pbb: 0, pso: 0, phr: 0 };
  return p.s;
}

export function newGame(L, homeId, awayId, opts = {}) {
  const T = L.teams;
  const sp = (id) => { const t = T[id]; const rot = t.rotation; return rot[t.rot % rot.length]; };
  const GS = {
    home: homeId, away: awayId, inning: 1, top: true, outs: 0, balls: 0, strikes: 0, bases: [null, null, null],
    score: { home: 0, away: 0 }, line: { home: [], away: [] }, hits: { home: 0, away: 0 }, idx: { home: 0, away: 0 },
    lineup: { home: T[homeId].lineup.slice(0, 9), away: T[awayId].lineup.slice(0, 9) },
    pit: { home: opts.homeSP || sp(homeId), away: opts.awaySP || sp(awayId) },
    used: { home: [], away: [] }, box: {}, pbox: {}, over: false, draw: false, log: [], lead: null, dec: {}, walkoff: false, closerIn: { home: false, away: false },
  };
  GS.used.home.push(GS.pit.home); GS.used.away.push(GS.pit.away);
  GS.starter = { home: GS.pit.home, away: GS.pit.away };
  GS.line.away.push(0);
  return GS;
}
const box = (GS, id) => GS.box[id] || (GS.box[id] = blankBox());
const pbox = (GS, id) => GS.pbox[id] || (GS.pbox[id] = blankPit());
const logIt = (GS, t) => { GS.log.push(t); if (GS.log.length > 60) GS.log.shift(); };

// a run scores for the batting side; the lead is tracked for the winning / losing pitcher
function scoreRun(GS, L, runnerId, batter, earned = true) {
  const s = battingSide(GS), f = fieldingSide(GS);
  const before = GS.score[s] - GS.score[f];
  GS.score[s]++;
  GS.line[s][GS.line[s].length - 1]++;
  if (runnerId) box(GS, runnerId).r++;
  if (batter) box(GS, batter.id).rbi++;
  const pid = GS.pit[f];
  pbox(GS, pid).r++;
  if (earned) pbox(GS, pid).er++;
  const after = GS.score[s] - GS.score[f];
  if (before <= 0 && after > 0) GS.lead = { side: s, win: GS.pit[s], lose: pid };
  if (before > 0 && after <= 0) GS.lead = null;
  if (after === 0) GS.lead = null;
}
// where the runners go on a ball in play / a walk; outcome kinds: K BB HBP 1B 2B 3B HR GO FO LO PO DP
export function applyPA(GS, L, oc, rng = Math.random) {
  if (GS.over) return;
  const s = battingSide(GS), f = fieldingSide(GS);
  const bat = batterOf(GS, L), pit = pitcherOf(GS, L);
  const B = box(GS, bat.id), PB = pbox(GS, pit.id);
  const spd = (id) => (id && L.P[id] ? L.P[id].speed : 50);
  const k = oc.kind;
  B.pa++; PB.bf++;
  let text = '';
  const name = pname(bat);
  if (k === 'BB' || k === 'HBP') {
    B.bb++; PB.bb++;
    // forced runners only
    if (GS.bases[0]) { if (GS.bases[1]) { if (GS.bases[2]) scoreRun(GS, L, GS.bases[2], bat, true); GS.bases[2] = GS.bases[1]; } GS.bases[1] = GS.bases[0]; }
    GS.bases[0] = bat.id;
    text = k === 'BB' ? `${name}：フォアボール` : `${name}：デッドボール`;
  } else if (k === 'K') {
    B.ab++; B.so++; PB.so++; PB.outs++; GS.outs++;
    text = `${name}：三振`;
  } else if (k === 'HR') {
    B.ab++; B.h++; B.hr++; PB.h++; PB.hr++;
    const runners = GS.bases.filter(Boolean);
    for (const r of runners) scoreRun(GS, L, r, bat, true);
    scoreRun(GS, L, bat.id, bat, true);
    GS.bases = [null, null, null];
    text = `${name}：${runners.length === 3 ? '満塁ホームラン！' : runners.length ? `${runners.length + 1}ランホームラン！` : 'ソロホームラン！'}`;
  } else if (k === '1B' || k === '2B' || k === '3B') {
    B.ab++; B.h++; PB.h++;
    const [r1, r2, r3] = GS.bases;
    const nb = [null, null, null];
    if (k === '3B') { B.d3++; for (const r of [r3, r2, r1]) if (r) scoreRun(GS, L, r, bat); nb[2] = bat.id; text = `${name}：スリーベース！`; }
    else if (k === '2B') {
      B.d2++;
      if (r3) scoreRun(GS, L, r3, bat); if (r2) scoreRun(GS, L, r2, bat);
      if (r1) { if (rng() < 0.42 + (spd(r1) - 55) / 140) scoreRun(GS, L, r1, bat); else nb[2] = r1; }
      nb[1] = bat.id; text = `${name}：ツーベース！`;
    } else {
      if (r3) scoreRun(GS, L, r3, bat);
      if (r2) { if (rng() < 0.55 + (spd(r2) - 55) / 140 + (GS.outs === 2 ? 0.2 : 0)) scoreRun(GS, L, r2, bat); else nb[2] = r2; }
      if (r1) { if (!nb[2] && rng() < 0.27 + (spd(r1) - 55) / 160) nb[2] = r1; else nb[1] = r1; }
      nb[0] = bat.id; text = `${name}：ヒット！`;
    }
    GS.bases = nb;
  } else {
    // outs on balls in play
    B.ab++;
    let outs = 1;
    const [r1, r2, r3] = GS.bases;
    if (k === 'GO' && r1 && GS.outs < 2 && (oc.dp || rng() < 0.42 - (spd(bat.id) - 50) / 250)) {
      outs = 2; GS.bases[0] = null;
      if (GS.outs === 0) { if (r3 && rng() < 0.3) { scoreRun(GS, L, r3, null); GS.bases[2] = null; } if (r2) { GS.bases[2] = GS.bases[2] || r2; GS.bases[1] = null; } }
      text = `${name}：ゲッツー`;
    } else if (k === 'FO' && r3 && GS.outs < 2 && (oc.sf || rng() < 0.52 + (spd(r3) - 55) / 150)) {
      B.ab--; // a sacrifice fly is not an at-bat
      GS.outs++; PB.outs++;
      if (GS.outs < 3) { scoreRun(GS, L, r3, bat); GS.bases[2] = null; }
      outs = 0;
      text = `${name}：犠牲フライ`;
    } else {
      if (k === 'GO' && GS.outs < 2) { if (r3 && rng() < 0.35) { scoreRun(GS, L, r3, bat); GS.bases[2] = null; } if (r2 && !GS.bases[2] && rng() < 0.5) { GS.bases[2] = r2; GS.bases[1] = null; } }
      text = `${name}：${({ GO: 'ゴロ', FO: 'フライ', LO: 'ライナー', PO: 'ポップフライ' })[k] || 'アウト'}${oc.where ? `（${oc.where}）` : ''}`;
    }
    GS.outs += outs; PB.outs += outs;
  }
  logIt(GS, text);
  GS.lastText = text;
  GS.balls = 0; GS.strikes = 0;
  GS.idx[s]++;
  // a walk-off in the last half
  if (!GS.top && GS.inning >= 9 && GS.score.home > GS.score.away) { GS.walkoff = true; endGame(GS, L); return text; }
  if (GS.outs >= 3) endHalf(GS, L);
  return text;
}
// a ball in play worked out by physics (play.js): the batter's and every runner's end exactly as they happened.
// play = { kind: 1B 2B 3B HR GO FO LO PO DP FC, batterTo: -1 (out) | 1..4, runners: [{ i (base 0..2), to: -1 | 1..3 | 4 }],
//          where (a position), sf (a sacrifice fly), infieldHit, inside (an inside-the-park home run) }
const POS_JP = { P: 'ピッチャー', C: 'キャッチャー', '1B': 'ファースト', '2B': 'セカンド', SS: 'ショート', '3B': 'サード', LF: 'レフト', CF: 'センター', RF: 'ライト' };
export function applyPlay(GS, L, play) {
  if (GS.over) return '';
  const s = battingSide(GS);
  const bat = batterOf(GS, L), pit = pitcherOf(GS, L);
  const B = box(GS, bat.id), PB = pbox(GS, pit.id);
  const k = play.kind, hit = ['1B', '2B', '3B', 'HR'].includes(k);
  B.pa++; PB.bf++;
  if (!play.sf) B.ab++;
  if (hit) { B.h++; PB.h++; if (k === '2B') B.d2++; if (k === '3B') B.d3++; if (k === 'HR') { B.hr++; PB.hr++; } }
  const outsAdd = (play.batterTo < 0 ? 1 : 0) + play.runners.filter((r) => r.to < 0).length;
  const before = GS.outs;
  // the third out on a force (or the batter out) wipes the runs of the play; on a hit the runs that crossed count
  const runsCount = hit || before + outsAdd < 3;
  const rbiTo = k === 'DP' ? null : bat;
  const old = GS.bases.slice(), nb = [null, null, null];
  let runs = 0;
  const listed = new Set();
  for (const r of play.runners.slice().sort((a, b) => b.i - a.i)) {
    const id = old[r.i]; if (!id) continue;
    listed.add(r.i);
    if (r.to >= 4) { if (runsCount) { scoreRun(GS, L, id, rbiTo, true); runs++; } }
    else if (r.to >= 1) nb[r.to - 1] = id;
  }
  for (let i = 2; i >= 0; i--) { // a runner the play did not mention stays (or moves up out of the way)
    if (!old[i] || listed.has(i)) continue;
    let b = i; while (b < 3 && nb[b]) b++;
    if (b >= 3) { if (runsCount) { scoreRun(GS, L, old[i], rbiTo, true); runs++; } } else nb[b] = old[i];
  }
  if (play.batterTo >= 4) { scoreRun(GS, L, bat.id, bat, true); runs++; }
  else if (play.batterTo >= 1) { let b = play.batterTo - 1; while (b < 3 && nb[b]) b++; if (b < 3) nb[b] = bat.id; }
  GS.bases = nb;
  const add = Math.min(outsAdd, 3 - before);
  GS.outs += add; PB.outs += add;
  const name = pname(bat), where = play.where && POS_JP[play.where] ? `（${POS_JP[play.where]}）` : '';
  const n = runs ? `　${runs}点` : '';
  let text;
  if (k === 'HR') { const others = runs - 1; text = `${name}：${play.inside ? 'ランニングホームラン！' : others === 3 ? '満塁ホームラン！' : others ? `${others + 1}ランホームラン！` : 'ソロホームラン！'}`; }
  else if (k === '1B') text = `${name}：${play.infieldHit ? '内野安打！' : 'ヒット！'}${n}`;
  else if (k === '2B') text = `${name}：ツーベース！${n}`;
  else if (k === '3B') text = `${name}：スリーベース！${n}`;
  else if (k === 'DP') text = `${name}：ゲッツー${where}`;
  else if (k === 'FC') text = `${name}：フィルダースチョイス${n}`;
  else if (play.sf) text = `${name}：犠牲フライ${n}`;
  else text = `${name}：${({ GO: 'ゴロ', FO: 'フライ', LO: 'ライナー', PO: 'ポップフライ' })[k] || 'アウト'}${where}${n}`;
  logIt(GS, text);
  GS.lastText = text;
  GS.balls = 0; GS.strikes = 0;
  GS.idx[s]++;
  if (!GS.top && GS.inning >= 9 && GS.score.home > GS.score.away) { GS.walkoff = true; endGame(GS, L); return text; }
  if (GS.outs >= 3) endHalf(GS, L);
  return text;
}
export function endHalf(GS, L) {
  GS.outs = 0; GS.balls = 0; GS.strikes = 0; GS.bases = [null, null, null];
  if (GS.top) {
    // the home side does not bat in the 9th (or later) when it already leads
    if (GS.inning >= 9 && GS.score.home > GS.score.away) { GS.line.home.push('X'); endGame(GS, L); return; }
    GS.top = false; GS.line.home.push(0);
  } else {
    if (GS.inning >= 9 && GS.score.home !== GS.score.away) { endGame(GS, L); return; }
    if (GS.inning >= MAX_INN) { GS.draw = true; endGame(GS, L); return; }
    GS.inning++; GS.top = true; GS.line.away.push(0);
  }
}
function endGame(GS, L) {
  if (GS.over) return;
  GS.over = true;
  const hs = GS.score.home, as = GS.score.away;
  if (hs !== as) {
    const ws = hs > as ? 'home' : 'away', ls = ws === 'home' ? 'away' : 'home';
    let win = GS.lead && GS.lead.side === ws ? GS.lead.win : GS.pit[ws];
    // a starter must go 5 innings (15 outs) for the win; otherwise the reliever with the most outs gets it
    if (win === GS.starter[ws] && num((GS.pbox[win] || {}).outs) < 15) { const rel = GS.used[ws].filter((x) => x !== win); if (rel.length) win = rel.sort((a, b) => num((GS.pbox[b] || {}).outs) - num((GS.pbox[a] || {}).outs))[0]; }
    const lose = GS.lead && GS.lead.side === ws ? GS.lead.lose : GS.pit[ls];
    const fin = GS.pit[ws];
    const sv = fin !== win && Math.abs(hs - as) <= 3 && num((GS.pbox[fin] || {}).outs) >= 3 ? fin : null;
    GS.dec = { win, lose, save: sv };
  }
}
// count of pitches (interactive play calls this per pitch; simPA adds ~3.9 a PA)
export function addPitches(GS, n = 1) { const id = GS.pit[fieldingSide(GS)]; pbox(GS, id).pc += n; }
export function fatigue(GS, L, side) {
  const id = GS.pit[side], p = L.P[id], B = GS.pbox[id] || blankPit();
  const cap = p.role === 'sp' ? 45 + p.stamina * 0.85 : 12 + p.stamina * 0.35;
  return B.pc / cap;
}
// the computer manager's pitching change (also used for the player's team unless they play it themselves)
export function maybeChange(GS, L, side, force = false) {
  if (GS.over) return null;
  const t = L.teams[side === 'home' ? GS.home : GS.away];
  const fat = fatigue(GS, L, side);
  const B = GS.pbox[GS.pit[side]] || blankPit();
  const lead = GS.score[side] - GS.score[side === 'home' ? 'away' : 'home'];
  const late = GS.inning >= 9 && ((side === 'home' && GS.top) || (side === 'away' && !GS.top));
  let want = force || fat > 1 || (B.er >= 6 && B.outs < 18) || (fat > 0.8 && GS.bases.filter(Boolean).length >= 2);
  let closer = false;
  if (late && lead > 0 && lead <= 3 && !GS.closerIn[side] && t.closer && GS.pit[side] !== t.closer && !GS.used[side].includes(t.closer) && GS.outs === 0) { want = true; closer = true; }
  if (!want) return null;
  const avail = (closer ? [t.closer] : t.pen.filter((id) => id !== t.closer)).filter((id) => !GS.used[side].includes(id) && !(L.P[id].tired > 0));
  const next = avail[0] || t.pen.find((id) => !GS.used[side].includes(id));
  if (!next) return null;
  GS.pit[side] = next; GS.used[side].push(next);
  if (closer) GS.closerIn[side] = true;
  const p = L.P[next];
  logIt(GS, `ピッチャー交代：${pname(p)}`);
  return p;
}

// ---------------------------------------------------------------- the probability model of a plate appearance
export function defenseOf(GS, L) {
  const ids = GS.lineup[fieldingSide(GS)];
  const vals = ids.map((id) => L.P[id]).filter((p) => p && p.pos !== 'DH').map((p) => p.field * 0.6 + p.catch * 0.2 + p.arm * 0.2);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 55;
}
export function simPA(GS, L, rng = Math.random) {
  const bat = batterOf(GS, L), pit = pitcherOf(GS, L);
  const fat = fatigue(GS, L, fieldingSide(GS));
  const tired = Math.max(0, fat - 0.85) * 0.5;
  const stuff = pitchStuff(pit) * (1 - tired), ctrl = pit.control * (1 - tired * 0.6);
  const lr = (pit.throws === 'L') === (bat.bats === 'L') ? 1.04 : 0.97; // same side helps the pitcher a little
  const m = bat.meet, pw = bat.power;
  const BAL = balOf(L);
  const mb = modOf(L, GS[battingSide(GS)]), mp = modOf(L, GS[fieldingSide(GS)]);
  const form = mb.bat - mp.pit; // + favours the batter
  const pK = clamp(BAL.k * 0.2 * (0.62 + stuff / 190) * (1.32 - m / 150) * lr * (1 - form * 0.06), 0.05, 0.42);
  const pBB = clamp(0.072 * (1.38 - ctrl / 140) * (0.85 + m / 320), 0.02, 0.18);
  const pHBP = 0.007;
  addPitches(GS, Math.max(1, Math.round(3.9 + gauss(rng) * 1.4)));
  const r = rng();
  if (r < pK) return { kind: 'K' };
  if (r < pK + pBB) return { kind: 'BB' };
  if (r < pK + pBB + pHBP) return { kind: 'HBP' };
  // a ball in play
  const def = defenseOf(GS, L);
  const pHR = clamp(BAL.hr * 0.032 * Math.pow(pw / 58, 2.5) * (1 - (stuff - 72) / 260) / lr * (1 + form * 0.12), 0.002, 0.16);
  if (rng() < pHR) return { kind: 'HR' };
  const pHit = clamp(BAL.hit * 0.295 + (m - 55) / 380 + (bat.speed - 55) / 1300 - (stuff - 72) / 620 - (def - 58) / 650 + form * 0.025, 0.16, 0.42);
  if (rng() < pHit) {
    const x = rng();
    const p2 = 0.17 + (pw - 55) / 500, p3 = 0.018 + (bat.speed - 55) / 1400;
    return { kind: x < p3 ? '3B' : x < p3 + p2 ? '2B' : '1B' };
  }
  const y = rng(), go = 0.46 - (pw - 55) / 300;
  return { kind: y < go ? 'GO' : y < go + 0.36 ? 'FO' : y < go + 0.46 ? 'LO' : 'PO' };
}

// ---------------------------------------------------------------- after the game: season stats and the next starters
export function commitGame(GS, L) {
  for (const side of ['home', 'away']) {
    const team = side === 'home' ? GS.home : GS.away;
    const t = L.teams[team];
    for (const id of GS.lineup[side]) { const s = seasonStats(L.P[id]); s.g++; const b = GS.box[id]; if (b) for (const k of ['pa', 'ab', 'h', 'd2', 'd3', 'hr', 'rbi', 'bb', 'so', 'r']) s[k] += b[k]; }
    GS.used[side].forEach((id, i) => {
      const s = seasonStats(L.P[id]), b = GS.pbox[id] || blankPit();
      s.pg++; if (i === 0) s.gs++;
      s.outs += b.outs; s.ph += b.h; s.er += b.er; s.pbb += b.bb; s.pso += b.so; s.phr += b.hr;
      // relievers need a day; starters rest by the rotation
      if (i > 0) L.P[id].tired = b.pc > 30 ? 2 : 1;
    });
    t.rot = (t.rot + 1) % t.rotation.length;
    const my = GS.score[side], op = GS.score[side === 'home' ? 'away' : 'home'];
    t.rs += my; t.ra += op;
    if (GS.draw || my === op) { t.d++; t.last.push('D'); }
    else if (my > op) { t.w++; t.last.push('W'); t.streak = t.streak > 0 ? t.streak + 1 : 1; }
    else { t.l++; t.last.push('L'); t.streak = t.streak < 0 ? t.streak - 1 : -1; }
    if (t.last.length > 10) t.last.shift();
  }
  if (GS.dec.win) seasonStats(L.P[GS.dec.win]).w++;
  if (GS.dec.lose) seasonStats(L.P[GS.dec.lose]).l++;
  if (GS.dec.save) seasonStats(L.P[GS.dec.save]).sv++;
}
// a whole game by the computer
export function simGame(L, homeId, awayId, rng = Math.random) {
  const GS = newGame(L, homeId, awayId);
  let guard = 0;
  while (!GS.over && guard++ < 400) {
    maybeChange(GS, L, fieldingSide(GS));
    applyPA(GS, L, simPA(GS, L, rng), rng);
  }
  commitGame(GS, L);
  return GS;
}
export { sideOf };
