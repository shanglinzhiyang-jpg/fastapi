// 戦時の国内と指揮 (R17-B) — what running a war is like beyond the fronts (regime.js runs the war itself: fronts, battles, numbers, talks): who commands each front
// (司令官), what the factories make (軍需生産), the policies at home (戦時国債・配給・疎開と防空・報道の統制・総動員) and the anti-war movement that grows as the war
// drags on, which the player answers in the way their regime allows (a democracy: talk, explain, restrict; a dictatorship: suppress, censor, boast).
//
// The same rules as regime.js (see its header): nothing is refused for being bad — every step shows its effects and its price first; no weapon of mass destruction and no
// choice to attack civilians exists; the human cost is numbers on every side; the commanders are fictional and anonymous in everything but a surname; the suppression
// of a protest is told abstractly (no violence is described or drawn). The peace treaty after a ceasefire already exists in world.js (講和条約): not repeated here.
//
// State g.state.warHome (lazy; one per war, made again when a new war starts):
//   { v, war: <war.start>, cmd: { land|sea|air: { name, trait, since } }, repl: { front: n }, hand: { front: day }, prod: { focus, level, since },
//     pol: { bonds|ration|evac|press|labor: day it was turned on (0 = off) }, bondDays, antiwar (0..100), awLevel, awDay, pending: null | { kind: 'antiwar', day, level },
//     cool: { id: day }, log: [{ day, text }], lastTick, ended }
// API (on Game): g.warHome() → the summary; g.warHomeActions() → [{ id, group, name, desc, lines, on?, why }]; g.warHomeAct(id, opts) → { ok, why?, text? }
//   (ids: cmd (opts { front, pick }), prod (opts { focus }), bonds ration evac press labor (a toggle: opts { on })); g.warHomeCandidates(front) → the 3 people to pick from;
//   g.warHomeRespond(choice) → the answer to the pending anti-war event. The phone app 「戦時」 (id 'senji', order 62.7) shows during a war the player leads.

import { Game } from './game.js';
import { onMorning, registerPhoneApp } from './life.js';
import { clamp } from './util.js';
import { phoneList, phoneInfo, phoneConfirm, appTile, bulletText, phoneText as T } from './phone.js';
import { RX, WAR_MODS, onRegime, registerRegimeScene, queueRegimeScene, showRegimeScene } from './regime.js';
import '../world/rule_art.js';

const { num, roll, rint, today } = RX;
const COLOR = '#4a7a5a';
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const FRONT_NAMES = { land: '陸の前線', sea: '海の前線', air: '空と防空' };
export const FRONT_KEYS = ['land', 'sea', 'air'];
export const TRAITS = {
  bold: { name: '攻勢型', desc: '攻めに強く、守りは薄い（攻勢で +5%・防衛で −3%）', mod: (w) => (w.stance === 'offense' ? 1.05 : 0.97) },
  steady: { name: '堅実型', desc: '守りに強く、攻めは鈍い（防衛で +4%・攻勢で −2%）', mod: (w) => (w.stance === 'offense' ? 0.98 : 1.04) },
  logi: { name: '補給重視型', desc: '補給と整備に強い（いつも +3%）', mod: () => 1.03 },
  tactician: { name: '作戦巧者', desc: '作戦の指揮にたける（攻勢で +4%・防衛で +1%）', mod: (w) => (w.stance === 'offense' ? 1.04 : 1.01) },
};
const TRAIT_ORDER = Object.keys(TRAITS);
const SURNAMES = ['佐伯', '岡部', '杉浦', '三宅', '広瀬', '原田', '岩崎', '大塚', '堀内', '島田', '森下', '村瀬', '安藤', '宮坂', '久保田', '西野'];
export const PROD = {
  land: { name: '陸の装備', desc: '陸の前線の戦力が上がる（段階ごとに +4%）。' },
  sea: { name: '艦艇と海上装備', desc: '海の前線の戦力が上がる（段階ごとに +4%）。' },
  air: { name: '航空機', desc: '空の前線の戦力が上がる（段階ごとに +4%）。' },
  air_def: { name: '防空と避難施設', desc: '民間人の死傷が減る（段階ごとに −8%）。' },
};
export const POLICIES = {
  bonds: { name: '戦時国債', desc: '国債で戦費をまかなう。戦力は少し上がるが、戦後にインフレの重いつけが残る。', lines: ['戦費の増え方が減る・戦力 +2%', '戦後：物価が上がり、成長が鈍る（発行した期間に応じて）', '代償：民衆の支持 −0.5（始めたとき）'] },
  ration: { name: '配給制と物価統制', desc: '食料と物資を配給にする。制裁で物が足りなくなっても、戦力が落ちにくい。', lines: ['厭戦の広がりを抑える・制裁による戦力の低下をやわらげる', '代償：不満が毎日たまる'] },
  evac: { name: '疎開と防空体制', desc: '都市の人びとを疎開させ、防空壕を整える。民間人の死傷が減る。', lines: ['民間人の死傷 −15%', '代償：不満がわずかにたまる・民衆の支持 −1（始めたとき）'] },
  press: { name: '戦時報道の統制', desc: '戦況の報道を管理して、厭戦と反戦の声を抑える。', lines: ['厭戦と反戦運動が広がりにくくなる', '代償：報道の自由度が下がる・国際社会の懸念が少しずつ増える・民主制では民衆の支持が下がる'] },
  labor: { name: '総動員（学徒・労働力）', desc: '学生や民間の労働力を軍需と兵站に動員する。戦力は上がるが、民衆に重い負担を強いる。', lines: ['戦力 +3%', '代償：不満と厭戦が毎日たまる・民衆の支持 −2（始めたとき）'] },
};
const POL_ORDER = ['bonds', 'ration', 'evac', 'press', 'labor'];
const AW_STEPS = [30, 55, 80];
const awLabel = (v) => (v >= 80 ? '全国に広がっている' : v >= 55 ? '大きな運動になっている' : v >= 30 ? '各地でデモが起きている' : v >= 12 ? '小さな声がある' : 'ほとんどない');

// ======================================================================== state
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export function candidates(g, front) {
  const h = home(g);
  const w = RX.R(g).war;
  const seed = (w ? num(w.start) : 1) * 31 + FRONT_KEYS.indexOf(front) * 7 + (h ? num(h.repl[front]) : 0) * 101 + 17;
  const r = rng(seed);
  const names = new Set();
  const out = [];
  while (out.length < 3) {
    const name = SURNAMES[Math.floor(r() * SURNAMES.length)];
    if (names.has(name)) continue;
    names.add(name);
    out.push({ name, trait: TRAIT_ORDER[(Math.floor(r() * 4) + out.length) % 4] });
  }
  // the three differ in what they are good at
  if (new Set(out.map((c) => c.trait)).size < 2) out[1].trait = TRAIT_ORDER[(TRAIT_ORDER.indexOf(out[0].trait) + 1) % 4];
  return out;
}
function fresh(g, w) {
  const h = { v: 1, war: w.start, cmd: {}, repl: { land: 0, sea: 0, air: 0 }, hand: { land: 0, sea: 0, air: 0 }, prod: { focus: null, level: 0, since: 0 }, pol: { bonds: 0, ration: 0, evac: 0, press: 0, labor: 0 }, bondDays: 0, antiwar: 0, awLevel: 0, awDay: -99, pending: null, cool: {}, log: [], lastTick: 0, ended: 0 };
  g.state.warHome = h;
  for (const f of FRONT_KEYS) { const c = candidates(g, f)[0]; h.cmd[f] = { name: c.name, trait: c.trait, since: today(g) }; }
  return h;
}
function normal(h) {
  h.antiwar = clamp(num(h.antiwar), 0, 100); h.awLevel = clamp(Math.round(num(h.awLevel)), 0, 3); h.bondDays = Math.max(0, num(h.bondDays));
  for (const k of ['awDay', 'lastTick', 'ended']) h[k] = num(h[k], k === 'awDay' ? -99 : 0);
  if (!isObj(h.cool)) h.cool = {};
  if (!Array.isArray(h.log)) h.log = [];
  if (!isObj(h.repl)) h.repl = { land: 0, sea: 0, air: 0 };
  if (!isObj(h.hand)) h.hand = { land: 0, sea: 0, air: 0 };
  if (!isObj(h.pol)) h.pol = {};
  for (const k of POL_ORDER) h.pol[k] = num(h.pol[k]);
  if (!isObj(h.prod) || (h.prod.focus && !PROD[h.prod.focus])) h.prod = { focus: null, level: 0, since: 0 };
  h.prod.level = clamp(Math.round(num(h.prod.level)), 0, 3);
  if (!isObj(h.cmd)) h.cmd = {};
  for (const f of FRONT_KEYS) if (!isObj(h.cmd[f]) || !TRAITS[h.cmd[f].trait]) { h.cmd[f] = { name: SURNAMES[0], trait: 'steady', since: 0 }; }
  if (h.pending && (!isObj(h.pending) || h.pending.kind !== 'antiwar')) h.pending = null;
  return h;
}
// the state of the war being fought now (made when a war starts), or the last one's (for the record), or null
function home(g) {
  const st = g && g.state;
  if (!st) return null;
  const w = RX.R(g).war;
  let h = st.warHome;
  if (w && w.phase === 'war') {
    if (!isObj(h) || h.war !== w.start) h = fresh(g, w);
    return normal(h);
  }
  return isObj(h) ? normal(h) : null;
}
const warOn = (g) => { const w = g && g.state ? RX.R(g).war : null; return !!(w && w.phase === 'war'); };
const logHome = (g, h, text, news = true) => { h.log.unshift({ day: today(g), text }); if (h.log.length > 40) h.log.length = 40; if (news) RX.news(g, text); };

// ======================================================================== what the war's numbers see
// the factor on each side's strength at a front
WAR_MODS.push((g, w, f) => {
  const h = g.state && isObj(g.state.warHome) ? g.state.warHome : null;
  if (!h || h.war !== w.start || h.ended) return null;
  const key = f.kind === 'home' ? 'land' : f.kind;
  let m = 1;
  const c = h.cmd && h.cmd[key];
  if (c && TRAITS[c.trait]) m *= TRAITS[c.trait].mod(w);
  if (num(h.hand[key]) > today(g) - 10) m *= 0.96; // a new commander's first days
  if (h.prod && h.prod.focus === key) m *= 1 + 0.04 * h.prod.level;
  if (num(h.pol.bonds)) m *= 1.02;
  if (num(h.pol.labor)) m *= 1.03;
  if (num(h.pol.ration) && RX.R(g).sanctions > 0) m *= 1 + Math.min(0.03, RX.R(g).sanctions * 0.01);
  return m === 1 ? null : { own: m };
});

// ======================================================================== the player's actions
const base = (g) => {
  const w = RX.R(g).war;
  if (!w || w.phase !== 'war') return '戦争のあいだだけ使える';
  if (!RX.isPM(g)) return '政権の首班のときだけ使える';
  return null;
};
const coolLeft = (g, h, id) => Math.max(0, num(h.cool[id]) - today(g));
export function actions(g) {
  const h = home(g);
  const w = RX.R(g).war;
  const on = !!(w && w.phase === 'war');
  const out = [];
  for (const f of FRONT_KEYS) {
    const c = h && h.cmd[f];
    const left = h ? coolLeft(g, h, `cmd_${f}`) : 0;
    out.push({
      id: 'cmd', front: f, group: '司令官', name: `${FRONT_NAMES[f]}の司令官`, desc: c ? `${c.name}（${TRAITS[c.trait].name}）：${TRAITS[c.trait].desc}` : '', lines: ['交代すると、新しい司令官の最初の10日は戦力が −4%', '代償：民衆の支持 −0.5・20日は続けて交代できない'],
      why: !on ? '戦争のあいだだけ使える' : base(g) || (left ? `あと${left}日は、続けて交代できない` : null),
    });
  }
  const pl = h ? coolLeft(g, h, 'prod') : 0;
  for (const k of Object.keys(PROD)) {
    out.push({
      id: 'prod', focus: k, group: '軍需生産', name: PROD[k].name, desc: PROD[k].desc, on: !!(h && h.prod.focus === k), level: h && h.prod.focus === k ? h.prod.level : 0,
      lines: ['工場を切りかえると、15日ごとに段階が上がる（最大3段階）', '代償：戦費がかさみ、民衆の負担が増える（段階ごとに不満 +0.01／日）', '重点を変えると、段階は0に戻る'],
      why: !on ? '戦争のあいだだけ使える' : base(g) || (h && h.prod.focus !== k && pl ? `あと${pl}日は、重点を変えられない` : null),
    });
  }
  for (const k of POL_ORDER) {
    out.push({ id: k, group: '国内の政策', name: POLICIES[k].name, desc: POLICIES[k].desc, lines: POLICIES[k].lines, on: !!(h && num(h.pol[k])), why: !on ? '戦争のあいだだけ使える' : base(g) });
  }
  return out;
}
export function act(g, id, opts = {}) {
  const w = RX.R(g).war;
  const why0 = base(g);
  if (why0) return { ok: false, why: why0 };
  const h = home(g);
  if (!h) return { ok: false, why: '戦争のあいだだけ使える' };
  if (id === 'cmd') {
    const f = opts.front;
    if (!FRONT_KEYS.includes(f)) return { ok: false, why: 'その前線はない' };
    const left = coolLeft(g, h, `cmd_${f}`);
    if (left) return { ok: false, why: `あと${left}日は、続けて交代できない` };
    const c = candidates(g, f)[clamp(Math.floor(num(opts.pick)), 0, 2)];
    h.cmd[f] = { name: c.name, trait: c.trait, since: today(g) };
    h.repl[f] = num(h.repl[f]) + 1; h.hand[f] = today(g); h.cool[`cmd_${f}`] = today(g) + 20;
    RX.bumpApproval(g, -0.5, 0, 'regime', '司令官の交代');
    const text = `${FRONT_NAMES[f]}の司令官が${c.name}（${TRAITS[c.trait].name}）に代わった。`;
    logHome(g, h, text, false);
    return { ok: true, text };
  }
  if (id === 'prod') {
    const k = opts.focus;
    if (!PROD[k]) return { ok: false, why: 'その生産はない' };
    if (h.prod.focus === k) return { ok: false, why: 'もう、その生産に力を入れている' };
    const left = coolLeft(g, h, 'prod');
    if (h.prod.focus && left) return { ok: false, why: `あと${left}日は、重点を変えられない` };
    h.prod = { focus: k, level: 0, since: today(g) };
    h.cool.prod = today(g) + 20;
    const text = `軍需生産の重点が「${PROD[k].name}」になった。工場の切りかえには、時間がかかる。`;
    logHome(g, h, text, false);
    return { ok: true, text };
  }
  if (POLICIES[id]) {
    const want = opts.on == null ? !num(h.pol[id]) : !!opts.on;
    if (want === !!num(h.pol[id])) return { ok: false, why: want ? 'もう実施している' : 'いまは実施していない' };
    const r = RX.R(g);
    if (want) {
      h.pol[id] = today(g);
      if (id === 'bonds') RX.bumpApproval(g, -0.5, 0, 'regime', '戦時国債');
      if (id === 'evac') RX.bumpApproval(g, -1, 0, 'regime', '疎開');
      if (id === 'press') { RX.press(g, -3, '戦時の報道統制'); if (!RX.isDict(g)) { RX.bumpApproval(g, -3, -0.3, 'regime', '報道統制'); r.unrest = clamp(r.unrest + 2, 0, 100); } }
      if (id === 'labor') RX.bumpApproval(g, -2, 0, 'regime', '総動員');
      const text = `${POLICIES[id].name}が始まった。`;
      logHome(g, h, text, id === 'press' || id === 'labor');
      return { ok: true, text };
    }
    h.pol[id] = 0;
    const text = `${POLICIES[id].name}をやめた。`;
    logHome(g, h, text, false);
    return { ok: true, text };
  }
  return { ok: false, why: 'そんな操作はない' };
}

// ======================================================================== the anti-war movement
function awOptions(g) {
  const dict = RX.isDict(g);
  return dict
    ? [
      { id: 'suppress', label: '治安機関に鎮圧させる' },
      { id: 'censor', label: '報道を統制して、声を沈める' },
      { id: 'boast', label: '戦果を大きく宣伝する', odds: 0.6 },
    ]
    : [
      { id: 'dialogue', label: '説明の場を設けて、話を聞く', odds: 0.7 },
      { id: 'appeal', label: '戦争の目的を国民に訴える', odds: clamp(0.35 + RX.approvalOf(g) / 150, 0.3, 0.75) },
      { id: 'restrict', label: 'デモを規制する' },
    ];
}
export function respond(g, choice) {
  const h = home(g);
  const w = RX.R(g).war;
  if (!h || !h.pending || !w || w.phase !== 'war') return { ok: false, why: '答える出来事はない' };
  const r = RX.R(g);
  const lv = num(h.pending.level, 1);
  h.pending = null;
  const opt = awOptions(g).find((o) => o.id === choice) || null;
  const out = (text) => ({ ok: true, text });
  const rule = g.state.rule && isObj(g.state.rule.pillars) && RX.isDict(g) ? g.state.rule : null;
  if (!opt) { // let it pass
    h.antiwar = clamp(h.antiwar + 4, 0, 100); r.unrest = clamp(r.unrest + 1.5 * lv, 0, 100);
    if (lv >= 3 && !RX.isDict(g)) RX.bumpApproval(g, -3, 0, 'regime', '広がる反戦の声');
    return out('政府は何も答えず、反戦の声は大きくなった。');
  }
  if (opt.id === 'dialogue') {
    if (roll(opt.odds)) { h.antiwar = clamp(h.antiwar - 10, 0, 100); RX.bumpApproval(g, 0.5, 0, 'regime', '説明の場'); return out('説明の場で、遺族や学生の声を聞いた。批判は残るが、対話の姿勢は評価された。'); }
    h.antiwar = clamp(h.antiwar + 3, 0, 100); return out('説明の場は、批判の応酬に終わった。溝は、むしろ深まった。');
  }
  if (opt.id === 'appeal') {
    if (roll(opt.odds)) { h.antiwar = clamp(h.antiwar - 6, 0, 100); RX.bumpApproval(g, 1, 0.1, 'regime', '戦争の目的の説明'); return out('首相は、戦争の目的を国民に訴えた。支持の声も、一定数あがった。'); }
    h.antiwar = clamp(h.antiwar + 2, 0, 100); return out('訴えは、戦死者の遺族には届かなかった。かえって反発を招いた。');
  }
  if (opt.id === 'restrict') {
    h.antiwar = clamp(h.antiwar - 12, 0, 100); RX.bumpApproval(g, -4, -0.3, 'regime', 'デモの規制'); RX.press(g, -3, 'デモの規制'); r.unrest = clamp(r.unrest + 2, 0, 100); RX.raiseIntl(g, 1, 'デモの規制');
    return out('デモは規制され、広場から人の姿が減った。だが、「言論の自由が脅かされている」という批判が上がっている。');
  }
  if (opt.id === 'suppress') {
    h.antiwar = clamp(h.antiwar - 18, 0, 100); r.unrest = clamp(r.unrest + 1, 0, 100); RX.raiseIntl(g, 3, '反戦デモの鎮圧');
    if (rule) { rule.fear = clamp(num(rule.fear) + 10, 0, 100); rule.detained = num(rule.detained) + rint(20, 120); }
    return out('治安機関が動き、デモは解散させられた。拘束された人たちの数は、公表されていない。');
  }
  if (opt.id === 'censor') {
    h.antiwar = clamp(h.antiwar - 10, 0, 100); RX.press(g, -4, '反戦の報道の統制');
    return out('反戦の動きを伝える報道は止められた。声は、街の中だけにこもった。');
  }
  if (opt.id === 'boast') {
    if (roll(opt.odds)) { h.antiwar = clamp(h.antiwar - 6, 0, 100); w.weariness = clamp(num(w.weariness) - 3, 0, 100); return out('戦果が大きく報じられ、厭戦の空気は少しやわらいだ。'); }
    h.antiwar = clamp(h.antiwar + 2, 0, 100); return out('宣伝は、前線から帰った人びとの話と食い違った。信用が落ちた。');
  }
  return { ok: false, why: 'そんな選択肢はない' };
}
const AW_TITLE = ['', '反戦のデモ', '広がる反戦運動', '戦争をやめよという声'];
const AW_PAGES = [
  null,
  ['都心の広場で、戦争に反対するデモが開かれた。', '「兄を返せ」と書いた紙を、母親たちが掲げている。'],
  ['反戦の声は、全国の町に広がっている。', '大学では集会が、駅前では署名が、毎日のように続いている。'],
  ['「戦争をやめよ」――国じゅうで、同じ声があがっている。', '参謀は言う。「このままでは、前線よりも、国内が持ちません」'],
];
registerRegimeScene('war_antiwar', async (g, data) => {
  const h = home(g);
  if (!h || !h.pending || !warOn(g)) return;
  const lv = clamp(num(h.pending.level, 1), 1, 3);
  const opts = awOptions(g).map((o) => ({ label: o.odds != null ? `${o.label}（見込み${Math.round(o.odds * 100)}%）` : o.label, value: o.id }));
  opts.push({ label: 'このまま様子を見る', value: null });
  await showRegimeScene(g, {
    art: 'demo', title: AW_TITLE[lv], sub: `反戦運動 ${Math.round(h.antiwar)}／100`, pages: AW_PAGES[lv], options: opts, prompt: 'どうする？',
    then: async (v) => { const res = respond(g, v); if (res && res.text) await RX.say(g, res.text); },
  });
});

// ======================================================================== the morning
function tick(g) {
  const r = RX.R(g);
  const w = r.war;
  if (!g.state || !w || w.phase !== 'war') return;
  const h = home(g);
  if (!h || h.lastTick >= today(g)) return;
  h.lastTick = today(g);
  // production: a level every 15 days, up to three
  if (h.prod.focus && h.prod.level < 3 && today(g) - h.prod.since >= (h.prod.level + 1) * 15) {
    h.prod.level++;
    logHome(g, h, `軍需生産（${PROD[h.prod.focus].name}）が第${h.prod.level}段階に入った。`, false);
  }
  if (h.prod.focus) { w.cost = Math.round((num(w.cost) + 0.01 * h.prod.level) * 100) / 100; r.unrest = clamp(r.unrest + 0.01 * h.prod.level, 0, 100); }
  w.civShield = clamp((num(h.pol.evac) ? 0.15 : 0) + (h.prod.focus === 'air_def' ? 0.08 * h.prod.level : 0), 0, 0.6);
  // the policies' daily part
  const dict = RX.isDict(g);
  if (num(h.pol.bonds)) { w.cost = Math.max(0, Math.round((num(w.cost) - 0.02) * 100) / 100); h.bondDays++; }
  if (num(h.pol.ration)) { r.unrest = clamp(r.unrest + 0.03, 0, 100); w.weariness = clamp(num(w.weariness) - 0.05, 0, 100); }
  if (num(h.pol.evac)) r.unrest = clamp(r.unrest + 0.01, 0, 100);
  if (num(h.pol.press)) { w.weariness = clamp(num(w.weariness) - 0.15, 0, 100); RX.press(g, -0.12, '戦時の報道統制'); r.intl = clamp(r.intl + 0.02, 0, 100); if (!dict) RX.bumpApproval(g, -0.04, 0, 'regime', '報道統制'); }
  if (num(h.pol.labor)) { r.unrest = clamp(r.unrest + 0.06, 0, 100); w.weariness = clamp(num(w.weariness) + 0.03, 0, 100); }
  // the anti-war movement
  const d = w.day || {};
  const deaths = (num(d.sd) + num(d.cd) * 2) / 400;
  h.antiwar = clamp(h.antiwar + (0.06 + num(w.weariness) / 250 + deaths - 0.03 - (num(h.pol.press) ? 0.12 : 0) - (dict ? 0.04 : 0)) * 1.4, 0, 100);
  r.unrest = clamp(r.unrest + h.antiwar / 3000, 0, 100);
  if (h.antiwar < 15) h.awLevel = 0;
  if (h.pending && today(g) - h.pending.day >= 3) respond(g, null);
  let next = -1; // the highest step reached that has not been answered yet
  AW_STEPS.forEach((v, i) => { if (i >= h.awLevel && h.antiwar >= v) next = i; });
  if (!h.pending && next >= 0 && today(g) - h.awDay >= 12) {
    h.awLevel = next + 1; h.awDay = today(g);
    h.pending = { kind: 'antiwar', day: today(g), level: h.awLevel };
    queueRegimeScene(g, 'war_antiwar', { day: today(g), level: h.awLevel }, { front: true });
    RX.news(g, h.awLevel >= 3 ? '戦争をやめよという声が、全国に広がっている' : h.awLevel === 2 ? '反戦運動が各地に広がっている' : '戦争に反対するデモが開かれた');
  }
}
onMorning((g) => { try { tick(g); } catch (e) { console.error('[war_home] morning', e); } });
onRegime('war', (g, d) => {
  try {
    if (!d || !d.war) return;
    if (d.kind === 'declare') { const h = fresh(g, d.war); logHome(g, h, '戦争が始まった。各前線に司令官が置かれた。', false); }
    if (d.kind === 'end') {
      const h = g.state.warHome;
      if (!isObj(h) || h.war !== d.war.start) return;
      h.ended = today(g);
      if (h.bondDays >= 20) RX.ecoShock(g, '戦時国債の償還', { growth: -0.3, inflation: Math.min(1.5, 0.3 + h.bondDays / 200), len: 240 });
      if (h.bondDays >= 20) logHome(g, h, '戦時国債の償還が始まり、物価が上がりはじめた。', true);
      if (isObj(d.war)) d.war.civShield = 0;
      h.pending = null;
      for (const k of POL_ORDER) h.pol[k] = 0;
    }
  } catch (e) { console.error('[war_home] event', e); }
});

// ======================================================================== the summary and the Game API
export function summary(g) {
  const h = home(g);
  if (!h) return { active: false };
  const w = RX.R(g).war;
  const on = !!(w && w.phase === 'war' && h.war === w.start);
  return {
    active: on, war: h.war,
    commanders: Object.fromEntries(FRONT_KEYS.map((f) => [f, { ...h.cmd[f], traitName: TRAITS[h.cmd[f].trait].name, desc: TRAITS[h.cmd[f].trait].desc, front: FRONT_NAMES[f] }])),
    prod: { ...h.prod, name: h.prod.focus ? PROD[h.prod.focus].name : null },
    policies: Object.fromEntries(POL_ORDER.map((k) => [k, { on: !!num(h.pol[k]), since: num(h.pol[k]), name: POLICIES[k].name }])),
    antiwar: { value: Math.round(h.antiwar), label: awLabel(h.antiwar), level: h.awLevel }, civShield: w ? num(w.civShield) : 0, pending: h.pending ? h.pending.kind : null, bondDays: h.bondDays, log: h.log.slice(0, 20),
  };
}
const METHODS = {
  warHome() { return summary(this); },
  warHomeActions() { return actions(this); },
  warHomeAct(id, opts) { return act(this, id, opts || {}); },
  warHomeCandidates(front) { return candidates(this, front); },
  warHomeRespond(choice) { return respond(this, choice); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });

// ======================================================================== the phone app 「戦時」
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function icon(c, x, y) {
  appTile(c, x, y, COLOR);
  R(c, x + 7, y + 8, 18, 3, '#e8e4d0'); R(c, x + 9, y + 11, 14, 8, '#e8e4d0'); R(c, x + 11, y + 13, 4, 4, COLOR); R(c, x + 17, y + 13, 4, 4, COLOR);
  R(c, x + 12, y + 22, 8, 3, '#e8e4d0'); R(c, x + 15, y + 19, 2, 4, '#e8e4d0');
}
async function confirmRun(g, a, opts, tail = '') {
  const ok = !a.why;
  const text = `${a.desc}\n\n${bulletText(a.lines)}${tail}${a.why ? `\n\n（${a.why}）` : ''}`;
  const i = await phoneConfirm(g, { title: a.name, color: COLOR, text, choices: ok ? ['実行する', 'やめる'] : ['もどる'] });
  if (!ok || i !== 0) return;
  const res = act(g, a.id, opts);
  if (!res.ok) { g.sfx('buzz'); await phoneInfo(g, { title: a.name, color: COLOR, text: res.why }); return; }
  g.sfx('ok');
  await phoneInfo(g, { title: a.name, color: COLOR, text: res.text });
}
async function runAction(g, a) {
  if (a.id === 'cmd') {
    const cands = candidates(g, a.front);
    const i = await phoneList(g, { title: `${FRONT_NAMES[a.front]}の司令官`, color: COLOR, items: cands.map((c) => ({ label: `${c.name}　${TRAITS[c.trait].name}`, sub: TRAITS[c.trait].desc })), hint: 'A:えらぶ　B:もどる', rowH: 40 });
    if (i < 0 || !cands[i]) return;
    return confirmRun(g, a, { front: a.front, pick: i }, `\n指名：${cands[i].name}（${TRAITS[cands[i].trait].name}）`);
  }
  if (a.id === 'prod') return confirmRun(g, a, { focus: a.focus });
  return confirmRun(g, a, { on: !a.on });
}
async function viewAntiwar(g) {
  const s = summary(g);
  await phoneInfo(g, {
    title: '反戦運動', color: COLOR,
    draw(c, a) {
      const x = a.x + 10, w = a.w - 20;
      T(c, `反戦運動　${s.antiwar.value}／100`, x, a.y + 8, 13, '#333');
      R(c, x, a.y + 28, w, 9, '#c8c2b4'); R(c, x, a.y + 28, Math.round((w * s.antiwar.value) / 100), 9, s.antiwar.value >= 55 ? '#c8402e' : s.antiwar.value >= 30 ? '#d8a82e' : '#3a9a5a');
      T(c, s.antiwar.label, x, a.y + 44, 12, '#555');
      T(c, `民間人の死傷の抑え　${Math.round(s.civShield * 100)}%`, x, a.y + 66, 11, '#555');
      T(c, '声が大きくなるほど、不満と厭戦が増える。', x, a.y + 88, 11, '#777');
      T(c, 'デモの規模が段階に達すると、対応を迫られる。', x, a.y + 104, 11, '#777');
    },
  });
}
async function openApp(g) {
  for (let guard = 0; guard < 40; guard++) {
    if (!warOn(g)) { await phoneInfo(g, { title: '戦時', color: COLOR, text: '戦争のあいだだけ使える。' }); return; }
    const s = summary(g);
    const acts = actions(g);
    const rows = [];
    for (const a of acts) {
      const sub = a.id === 'cmd' ? `${s.commanders[a.front].name}（${s.commanders[a.front].traitName}）${a.why ? `・${a.why}` : ''}`
        : a.id === 'prod' ? (a.on ? `第${a.level}段階（15日ごとに上がる）` : (a.why || a.group))
          : (a.on ? '実施中' : (a.why || '実施していない'));
      rows.push({ label: a.id === 'prod' && a.on ? `◆ ${a.name}` : a.name, sub, a, run: () => runAction(g, a) });
    }
    rows.push({ label: '反戦運動', sub: `${s.antiwar.value}／100・${s.antiwar.label}`, run: () => viewAntiwar(g) });
    const i = await phoneList(g, { title: '戦時の国内と指揮', color: COLOR, items: rows.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !rows[i]) return;
    await rows[i].run();
  }
}
registerPhoneApp('senji', {
  name: '戦時', color: COLOR, order: 62.7,
  iconHD: icon,
  cond: (g) => !!g && !!g.state && warOn(g),
  open: (g) => openApp(g),
});
export { openApp as openWarHomeApp };
