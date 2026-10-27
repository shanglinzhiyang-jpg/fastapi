// 選挙制度と区割り (R19) — the rules of the elections are themselves a political battlefield. politics.js holds the laws (vote_disparity 一票の格差の是正, smd_pr_ratio 小選挙区と比例の配分,
// pr_threshold 比例の足切り, dup_candidacy 重複立候補, redistrict 区割りの変更＝有利な線引き: they go through the Diet like any bill) and applies them in runShugi; this module is the rest:
// the 一票の格差 (an index that drifts up as the population moves), the lawsuit and the Supreme Court's ruling after each election (合憲 / 違憲状態 / 違憲), the fix an NPC government
// passes on its own, the gerrymander that may be exposed (a scandal for whoever drew it, see scandal.js) or struck down, and the phone app 「選挙制度」.
//
// Rules: nothing is refused for being bad (a gerrymander is an option like any other: the odds are the Diet's vote, the price is the exposure risk and the ruling, shown first);
// the indices are rough guides in the game's fictional geography (the thresholds, about 2x for the lower house and about 3x for the upper house, follow the Court's usual line).
//
// State p.flags.elec: { disparity, sangiDisparity, smdShift, prThreshold, dupBan, gerry: null | { party, by, strength, day, exposed, struck }, rulings: [{ day, house, ratio, verdict }],
//   warn: { shugi, sangi }, pending: null | { house, ratio, due }, autoFix: null | { house, day }, log: [{ day, text }], lastGerry }
// API (on Game): g.electionSystem() → the summary; the laws are proposed with g.proposeBill({ policy, params }). The phone app 「選挙制度」 (id 'senkyo', order 66.6).

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp } from './util.js';
import { onPolitics, elecOf, shugiRules, sangiRules, POLICIES, calYear, dateLabel } from './politics.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, phoneText as T } from './phone.js';

const COLOR = '#4a5fa0';
const YEAR = 120;
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const today = (g) => (g.state && g.state.day) || 1;
let rng = () => Math.random();
export const setElecRng = (f) => { rng = typeof f === 'function' ? f : () => Math.random(); };
const LIMIT = { shugi: 2.0, sangi: 3.0 };
const HOUSE = { shugi: '衆議院', sangi: '参議院' };
const VERDICT = { ok: '合憲', state: '違憲状態', unconst: '違憲' };
const pol = (g) => (typeof g.pol === 'function' ? g.pol() : null);

function ensure(g) {
  const p = pol(g);
  if (!p) return null;
  const E = elecOf(p);
  for (const k of ['disparity', 'sangiDisparity', 'smdShift', 'prThreshold']) E[k] = num(E[k]);
  E.dupBan = !!E.dupBan;
  if (!Array.isArray(E.rulings)) E.rulings = [];
  if (!Array.isArray(E.log)) E.log = [];
  if (!E.warn || typeof E.warn !== 'object') E.warn = {};
  if (E.gerry && typeof E.gerry !== 'object') E.gerry = null;
  if (!E.disparity || !E.sangiDisparity) {
    const y = calYear(g);
    // where the indices stand when the world begins (rough, by era)
    if (!E.disparity) E.disparity = y < 1994 ? 3.1 : y < 2009 ? 2.25 : y < 2013 ? 2.35 : y < 2017 ? 2.2 : 1.98;
    if (!E.sangiDisparity) E.sangiDisparity = y < 2016 ? 4.7 : 3.1;
  }
  return E;
}
const say = (g, p, E, text, o = {}) => {
  const day = today(g);
  E.log.unshift({ day, text }); if (E.log.length > 20) E.log.length = 20;
  p.news.unshift({ day, text, kind: 'politics' }); if (p.news.length > 80) p.news.length = 80;
  if (o.msg) { try { g.message({ from: 'ドット新聞 政治部', text, kind: 'news' }); } catch (e) { /* no phone */ } }
};
const isPM = (p) => p.cabinet && p.cabinet.pm === 'player';

// ======================================================================== after an election: the lawsuit
onPolitics('election', (g, d) => {
  try {
    const p = pol(g), E = p && ensure(g), e = d && d.election;
    if (!E || !e || (e.kind !== 'shugi' && e.kind !== 'sangi')) return;
    const ratio = Math.round((e.kind === 'sangi' ? E.sangiDisparity : E.disparity) * 100) / 100;
    E.pending = { house: e.kind, ratio, due: today(g) + 25 };
    // a gerrymander that has done its work at this election: if a court has struck it, it is gone now
    if (E.gerry && E.gerry.struck && e.kind === 'shugi') E.gerry = null;
  } catch (err) { console.error(err); }
});

function judge(g, p, E) {
  const P = E.pending;
  E.pending = null;
  const lim = LIMIT[P.house];
  const exposed = !!(E.gerry && E.gerry.exposed && !E.gerry.struck && P.house === 'shugi');
  let verdict = 'ok';
  if (P.ratio >= lim) verdict = E.warn[P.house] || P.ratio >= lim * 1.2 || exposed ? 'unconst' : 'state';
  E.rulings.unshift({ day: today(g), house: P.house, ratio: P.ratio, verdict });
  if (E.rulings.length > 12) E.rulings.length = 12;
  const h = HOUSE[P.house];
  if (verdict === 'ok') { E.warn[P.house] = false; say(g, p, E, `最高裁は、${h}選挙の一票の格差（${P.ratio}倍）を合憲と判断した。`); return; }
  E.warn[P.house] = true;
  p.cabinet.scandal = num(p.cabinet.scandal) - (verdict === 'unconst' ? 3 : 1.5);
  if (verdict === 'state') say(g, p, E, `最高裁は、${h}選挙の一票の格差（${P.ratio}倍）を「違憲状態」と判断した。選挙は有効だが、国会に区割りの是正を求めた。`, { msg: isPM(p) });
  else {
    say(g, p, E, `最高裁は、${h}選挙の一票の格差（${P.ratio}倍）を「違憲」と判断した。選挙そのものは「事情判決」の考え方で有効としたが、「是正を怠った」と国会を厳しく批判した。`, { msg: isPM(p) });
    if (exposed) { E.gerry.struck = true; say(g, p, E, '判決は、先の区割りの線引きにも触れ、「選挙の公正を損なう」と述べた。線引きの効果は失われる。'); }
  }
  // an NPC government fixes it by itself after a while; the player's government has to do it (the law 一票の格差の是正)
  if (!isPM(p)) E.autoFix = { house: P.house, day: today(g) + 40 + Math.floor(rng() * 60) };
}

// ======================================================================== the morning
function tick(g) {
  const p = pol(g);
  const E = p && ensure(g);
  if (!E) return;
  const day = today(g);
  // the population moves: the disparity grows a little every year
  E.disparity = Math.round((E.disparity + 0.05 / YEAR) * 10000) / 10000;
  E.sangiDisparity = Math.round((E.sangiDisparity + 0.06 / YEAR) * 10000) / 10000;
  for (const h of ['shugi', 'sangi']) if (E.warn[h] && (h === 'sangi' ? E.sangiDisparity : E.disparity) < LIMIT[h]) E.warn[h] = false;
  if (E.pending && day >= E.pending.due) judge(g, p, E);
  if (E.autoFix && day >= E.autoFix.day) {
    const h = E.autoFix.house; E.autoFix = null;
    if (!isPM(p)) {
      if (h === 'sangi') E.sangiDisparity = LIMIT.sangi * 0.93; else E.disparity = LIMIT.shugi * 0.93;
      say(g, p, E, `${HOUSE[h]}の区割りを見直す法律が成立した。一票の格差は${(h === 'sangi' ? E.sangiDisparity : E.disparity).toFixed(2)}倍に縮まる。`);
    }
  }
  // a gerrymander may be found out
  const G = E.gerry;
  if (G && !G.exposed && !G.struck && rng() < 0.006 * clamp(num(G.strength, 1), 1, 3)) {
    G.exposed = true;
    p.cabinet.scandal = num(p.cabinet.scandal) - 1.5 * G.strength;
    say(g, p, E, '新聞が、選挙区の線引きが与党に有利に行われた経過を報じた。野党は「ゲリマンダーだ」と批判している。', { msg: G.by === 'player' });
    try { if (typeof g.politicalScandal === 'function' && G.by) g.politicalScandal('gerrymander', { who: G.by, name: '区割りの恣意的な操作（ゲリマンダー）', severity: 2 + Math.min(2, G.strength - 1) }); } catch (e) { console.error(e); }
  }
}
onMorning((g) => tick(g));

// ======================================================================== the summary
function summary(g) {
  const p = pol(g), E = p && ensure(g);
  if (!p || !E) return null;
  const year = calYear(g);
  const R = shugiRules(year, p.flags), S = sangiRules(year);
  const chu = R.system === 'chusenkyoku';
  const G = E.gerry && (E.gerry.exposed || (E.gerry.by === 'player')) ? { party: (p.parties[E.gerry.party] && p.parties[E.gerry.party].short) || '', strength: E.gerry.strength, exposed: E.gerry.exposed, struck: E.gerry.struck, mine: E.gerry.by === 'player' } : null;
  const verdictNow = (h) => { const r = h === 'sangi' ? E.sangiDisparity : E.disparity; return r < LIMIT[h] ? 'ok' : E.warn[h] ? 'unconst' : 'state'; };
  return {
    year,
    shugi: { system: chu ? '中選挙区制' : '小選挙区比例代表並立制', smd: R.smd, pr: R.pr, total: R.total, threshold: E.prThreshold, dupBan: E.dupBan, smdShift: E.smdShift, disparity: Math.round(E.disparity * 100) / 100, limit: LIMIT.shugi, state: VERDICT[verdictNow('shugi')] },
    sangi: { district: S.district, pr: S.pr, list: S.list === 'hikousoku' ? '非拘束名簿式' : S.list === 'kousoku' ? '拘束名簿式' : '全国区', disparity: Math.round(E.sangiDisparity * 100) / 100, limit: LIMIT.sangi, state: VERDICT[verdictNow('sangi')] },
    rulings: E.rulings.map((r) => ({ ...r, date: dateLabel(g, r.day), house: HOUSE[r.house], verdict: VERDICT[r.verdict] })),
    pending: E.pending ? { house: HOUSE[E.pending.house], ratio: E.pending.ratio, left: Math.max(0, E.pending.due - today(g)) } : null,
    gerry: G, log: E.log.slice(0, 12).map((l) => ({ date: dateLabel(g, l.day), text: l.text })), chu,
  };
}
const METHODS = { electionSystem() { return summary(this); } };
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
if (typeof window !== 'undefined') window.__elec = { setElecRng, tick: (g) => tick(g), LIMIT };

// ======================================================================== the phone app 「選挙制度」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 8, y + 8, 16, 4, '#f4ecd8'); R(c, x + 10, y + 12, 12, 10, '#f4ecd8'); R(c, x + 13, y + 15, 6, 2, COLOR); R(c, x + 7, y + 22, 18, 3, '#f4ecd8');
}
const bar = (c, x, y, w, ratio, lim) => {
  R(c, x, y, w, 8, '#c8c2b4');
  const f = clamp(ratio / (lim * 1.6), 0, 1);
  R(c, x, y, Math.round(w * f), 8, ratio < lim ? '#3a9a5a' : ratio < lim * 1.2 ? '#d8a82e' : '#c8402e');
  R(c, x + Math.round(w * (lim / (lim * 1.6))), y - 2, 2, 12, '#333');
};
async function viewDisparity(g) {
  const s = summary(g);
  await phoneInfo(g, {
    title: '一票の格差', color: COLOR, hint: 'A/B:もどる',
    draw(c, a) {
      const x = a.x + 10, w = a.w - 20;
      let y = a.y + 8;
      const row = (name, r, lim, st) => { T(c, name, x, y, 12, '#333'); T(c, `${r.toFixed(2)}倍　${st}`, x + w, y, 11, '#555', 'right'); bar(c, x, y + 20, w, r, lim); T(c, `目安：${lim}倍`, x, y + 32, 10, '#777'); y += 56; };
      row('衆議院', s.shugi.disparity, s.shugi.limit, s.shugi.state);
      row('参議院', s.sangi.disparity, s.sangi.limit, s.sangi.state);
      T(c, '人口が動くと、格差は少しずつ広がる。', x, y, 11, '#666'); y += 16;
      T(c, '選挙のあと、最高裁が判断する。', x, y, 11, '#666'); y += 16;
      T(c, '（合憲・違憲状態・違憲）', x, y, 11, '#666'); y += 16;
      if (s.pending) T(c, `判決待ち：${s.pending.house}（${s.pending.ratio}倍）あと${s.pending.left}日`, x, y, 11, '#a06a2a');
    },
  });
}
async function viewRulings(g) {
  const s = summary(g);
  const lines = s.rulings.length ? s.rulings.map((r) => `■${r.date}　${r.house}\n一票の格差${r.ratio}倍　→ ${r.verdict}`) : ['まだ判決はない。'];
  await phoneInfo(g, { title: '最高裁の判決', color: COLOR, lines: lines.join('\n\n') });
}
async function viewSystem(g, house) {
  const s = summary(g);
  const t = house === 'shugi'
    ? `${s.shugi.system}\n小選挙区 ${s.shugi.smd}・比例 ${s.shugi.pr}（計${s.shugi.total}）\n比例の足切り：${s.shugi.threshold ? `${s.shugi.threshold}%` : 'なし'}\n重複立候補：${s.shugi.dupBan ? '禁止' : s.chu ? '―' : '認める'}`
    : `選挙区 ${s.sangi.district}・比例 ${s.sangi.pr}（半数改選）\n比例の名簿：${s.sangi.list}`;
  await phoneInfo(g, { title: `${HOUSE[house]}の制度`, color: COLOR, text: t });
}
async function viewGerry(g) {
  const s = summary(g);
  if (!s.gerry) { await phoneInfo(g, { title: '区割り', color: COLOR, text: '目立った動きはない。' }); return; }
  const G = s.gerry;
  await phoneInfo(g, { title: '区割りの線引き', color: COLOR, text: `${G.party}に有利な線引き（${['', 'やや', 'かなり', '徹底'][G.strength] || ''}）\n${G.struck ? '違憲と判断され、効果は失われた。' : G.exposed ? '露見している。判決で違憲とされれば効果を失う。' : '露見していない。ただし、毎日少しずつ露見する危険がある。'}\n\n次の総選挙で、小選挙区の議席が${G.struck ? '増えない' : '増える'}。` });
}
// the laws: [policy id, name, choices: [label, params]]
const LAWS = [
  ['vote_disparity', '一票の格差を是正する（区割りの見直し）', [['衆議院 10区', { house: 1, cuts: 10 }], ['衆議院 20区', { house: 1, cuts: 20 }], ['参議院 10区', { house: 2, cuts: 10 }], ['参議院 20区', { house: 2, cuts: 20 }]]],
  ['smd_pr_ratio', '小選挙区と比例の配分を見直す', [['比例を10増やす（小党に有利）', { shift: 10 }], ['比例を30増やす', { shift: 30 }], ['小選挙区を10増やす（大政党に有利）', { shift: -10 }], ['小選挙区を30増やす', { shift: -30 }]]],
  ['pr_threshold', '比例代表に足切りを設ける', [['5%（小党は出にくい）', { pct: 5 }], ['3%', { pct: 3 }], ['足切りをなくす', { pct: 0 }]]],
  ['dup_candidacy', '重複立候補を見直す', [['禁止する', { ban: 1 }], ['認める', { ban: 0 }]]],
  ['redistrict', '区割りを引き直す（有利な線引き）', [['やや有利に', { bias: 1 }], ['かなり有利に', { bias: 2 }], ['徹底して有利に', { bias: 3 }]]],
];
async function proposeLaw(g) {
  const i = await phoneList(g, { title: '制度を変える法案', color: COLOR, items: LAWS.map((l) => ({ label: l[1], sub: POLICIES[l[0]] ? POLICIES[l[0]].desc.slice(0, 22) + '…' : '' })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
  if (i < 0 || !LAWS[i]) return;
  const [pid, name, choices] = LAWS[i];
  const j = await phoneList(g, { title: name.length > 12 ? '内容を選ぶ' : name, color: COLOR, items: choices.map((c) => ({ label: c[0] })), hint: 'A:えらぶ　B:もどる' });
  if (j < 0 || !choices[j]) return;
  const note = pid === 'redistrict' ? '\n\n・次の総選挙で、小選挙区の議席が増える\n・露見すると「ゲリマンダー」と批判され、自分のスキャンダルになる\n・違憲と判断されると効果を失う' : '\n\n・国会で可決されて、はじめて成立する（可決の見込みは「政治」の法案で見られる）';
  const ok = await phoneConfirm(g, { title: choices[j][0], color: COLOR, text: `${pid === 'redistrict' ? '選挙区の線引きを、与党に有利になるよう引き直す。' : POLICIES[pid].desc}${note}`, choices: ['法案を出す', 'やめる'] });
  if (ok !== 0) return;
  let b = null;
  try { b = g.proposeBill({ policy: pid, params: choices[j][1] }); } catch (e) { console.error(e); }
  g.sfx(b ? 'ok' : 'buzz');
  await phoneInfo(g, { title: name.length > 12 ? '法案' : name, color: COLOR, text: b ? `「${b.title}」を国会に出した。` : `法案にできなかった。\n${g.lastPoliticsError || ''}` });
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    const s = summary(g);
    if (!s) { await phoneInfo(g, { title: '選挙制度', color: COLOR, text: 'いまは使えない。' }); return; }
    const rows = [
      { label: '一票の格差', sub: `衆${s.shugi.disparity.toFixed(2)}倍（${s.shugi.state}）・参${s.sangi.disparity.toFixed(2)}倍（${s.sangi.state}）`, run: () => viewDisparity(g) },
      { label: '衆議院の制度', sub: `${s.shugi.system}・小${s.shugi.smd}／比${s.shugi.pr}`, run: () => viewSystem(g, 'shugi') },
      { label: '参議院の制度', sub: `選挙区${s.sangi.district}／比例${s.sangi.pr}`, run: () => viewSystem(g, 'sangi') },
      { label: '最高裁の判決の記録', sub: `${s.rulings.length}件${s.pending ? `・判決待ち` : ''}`, run: () => viewRulings(g) },
      ...(s.gerry ? [{ label: '区割りの線引き', sub: s.gerry.exposed ? '露見している' : '露見していない', run: () => viewGerry(g) }] : []),
      { label: '制度を変える法案を出す', sub: '格差の是正・配分・足切り・区割り', run: () => proposeLaw(g) },
    ];
    const i = await phoneList(g, { title: '選挙制度', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('senkyo', {
  name: '選挙制度', color: COLOR, order: 66.6,
  iconHD: icon,
  cond: (g) => { try { const p = pol(g); return !!g && !!g.state && !!p && !!(p.me && (p.me.office || (p.me.posts || []).length)); } catch (e) { return false; } },
  open: (g) => openApp(g),
});
export { openApp as openElectionApp, tick as electionTick };
