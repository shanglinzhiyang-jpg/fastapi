// 対外姿勢 (foreign stance): 親中派・親米派・親ロ派・対中強硬派・自主外交派… as a vector toward the foreign powers,
// for the player, parties, factions, NPC politicians and the government as a whole; and what such an orientation does
// to the relations with those countries, to trade and to opinion at home. Created by world.js (createStance(X)); it has
// no import of its own. The party-internals module (R5-D) calls g.foreignStance / g.setForeignStance / g.worldStanceEffect.
//
// RULES: fictional factions and people only. A real party's stance is NEUTRAL (0) except what its own platform says
// (the 日米同盟 is the base of the foreign policy of both 自由民主党 and 民主党: us +30). No accusation against anyone:
// the label is a plain description of an orientation (「親中派」 is the colloquial word for the 対中融和 line and is shown
// with its description) and every effect has a pro and a con voice.
//
// Stance vector: { china, us, russia, korea, taiwan, eu, asean, nk } each −100..100
//   china   +: 対中融和・経済重視（親中派） / −: 対中強硬
//   us      +: 日米同盟の重視（親米派） / −: 米国から距離（自主外交）
//   russia  +: 対ロ対話・エネルギー協力（親ロ派） / −: 対ロ強硬
//   korea   +: 日韓協調 / −: 対韓強硬
//   taiwan  +: 台湾との関係強化 / −: 慎重
//   eu      +: 欧州との連携（国際協調派） / asean +: 東南アジア重視
//   nk      +: 対北朝鮮の対話・支援 / −: 圧力・強硬

export const STANCE_KEYS = ['china', 'us', 'russia', 'korea', 'taiwan', 'eu', 'asean', 'nk'];
export const STANCE_NAMES = { china: '中国', us: '米国', russia: 'ロシア', korea: '韓国', taiwan: '台湾', eu: '欧州', asean: '東南アジア', nk: '北朝鮮' };
// the typical establishment line (the 日米同盟 at +30): only the DEVIATION from it moves the world
export const STANCE_BASE = { china: 0, us: 30, russia: 0, korea: 0, taiwan: 0, eu: 0, asean: 0, nk: 0 };
const Z = () => ({ china: 0, us: 0, russia: 0, korea: 0, taiwan: 0, eu: 0, asean: 0, nk: 0 });
// countries of each key (for the relation drift)
export const STANCE_COUNTRIES = { china: ['cn', 'h_cn'], us: ['us'], russia: ['ru', 'su', 'h_su'], korea: ['kr'], taiwan: ['tw'], eu: ['fr', 'de', 'wde', 'it', 'gb', 'h_de', 'h_it'], asean: ['id', 'ph', 'th', 'sg', 'my', 'vn'], nk: ['kp'] };

const PARTY_STANCE = {
  jimin: { us: 30 }, minshu: { us: 30 },
  tomoshibi: { china: 25, us: -30, russia: 10, korea: 30, taiwan: -5, eu: 15, asean: 20, nk: 25 },
  aozora: { china: 5, us: 35, russia: -5, korea: 10, taiwan: 20, eu: 25, asean: 25, nk: -10 },
  nichirin: { china: -45, us: 25, russia: -20, korea: -30, taiwan: 40, eu: 10, asean: 10, nk: -50 },
  nijiiro: { china: 5, us: -10, russia: -10, korea: 25, taiwan: 15, eu: 35, asean: 20, nk: 5 },
  denen: { china: 0, us: 0, russia: 5, korea: 5, taiwan: 5, eu: 0, asean: 5, nk: 0 },
};
// the orientations factions and politicians can have (fictional lines; ids are internal)
export const ARCHETYPES = {
  atlantic: { name: '日米同盟重視', vec: { china: -15, us: 55, russia: -10, korea: 10, taiwan: 25, eu: 25, asean: 15, nk: -25 } },
  engage: { name: '対中融和（経済重視）', vec: { china: 55, us: 0, russia: 10, korea: 20, taiwan: -10, eu: 15, asean: 25, nk: 10 } },
  hawk: { name: '対中強硬', vec: { china: -55, us: 30, russia: -25, korea: -15, taiwan: 45, eu: 10, asean: 15, nk: -40 } },
  independent: { name: '自主外交', vec: { china: 10, us: -10, russia: 15, korea: 15, taiwan: 0, eu: 20, asean: 25, nk: 10 } },
  multilateral: { name: '国際協調', vec: { china: 10, us: 15, russia: 5, korea: 20, taiwan: 10, eu: 40, asean: 35, nk: 0 } },
  eurasian: { name: '対ロ・エネルギー協力', vec: { china: 20, us: -10, russia: 55, korea: 5, taiwan: -5, eu: 5, asean: 15, nk: 15 } },
  centrist: { name: '等距離', vec: { china: 0, us: 15, russia: 0, korea: 5, taiwan: 5, eu: 10, asean: 10, nk: 0 } },
};
const ARCH_ORDER = ['atlantic', 'engage', 'hawk', 'independent', 'multilateral', 'centrist', 'atlantic', 'centrist', 'eurasian', 'hawk', 'engage'];
// how each segment tends to see a closer tie with each power (a tendency, −1..1; the voices below are balanced)
const SEG_PREF = {
  business: { china: 0.5, us: 0.4, russia: 0.1, korea: 0.3, taiwan: 0.2, eu: 0.4, asean: 0.5, nk: 0 },
  employees: { china: 0.2, us: 0.3, russia: 0, korea: 0.2, taiwan: 0.1, eu: 0.2, asean: 0.3, nk: 0 },
  selfemployed: { china: -0.1, us: 0.3, russia: 0, korea: -0.1, taiwan: 0.2, eu: 0, asean: 0.1, nk: -0.2 },
  elderly: { china: -0.3, us: 0.3, russia: -0.2, korea: -0.2, taiwan: 0.3, eu: 0.1, asean: 0.1, nk: -0.3 },
  young: { china: 0, us: 0.1, russia: -0.2, korea: 0.4, taiwan: 0.3, eu: 0.3, asean: 0.3, nk: -0.1 },
  families: { china: 0, us: 0.2, russia: -0.1, korea: 0.1, taiwan: 0.1, eu: 0.2, asean: 0.1, nk: -0.2 },
  farmers: { china: -0.3, us: -0.3, russia: 0, korea: 0, taiwan: 0, eu: -0.2, asean: -0.1, nk: 0 },
  rural: { china: -0.1, us: 0.1, russia: 0, korea: 0, taiwan: 0.1, eu: 0, asean: 0, nk: -0.1 },
  unions: { china: 0.1, us: -0.3, russia: 0.1, korea: 0.3, taiwan: 0, eu: 0.3, asean: 0.2, nk: 0.1 },
  urban: { china: 0.1, us: 0.2, russia: -0.1, korea: 0.2, taiwan: 0.2, eu: 0.3, asean: 0.2, nk: -0.1 },
  floating: { china: 0.05, us: 0.1, russia: -0.1, korea: 0.1, taiwan: 0.1, eu: 0.15, asean: 0.15, nk: -0.05 },
};
const SEG_LABEL = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経済界', farmers: '農林漁業', unions: '労働組合', urban: '都市住民', rural: '地方住民', floating: '無党派層' };
// the plain-language description of each orientation (shown with the label)
const LABEL_INFO = {
  china_engage: { label: '親中派', long: '対中融和派', desc: '中国との対話と経済のつながりを重んじ、対立を避けようとする立場。' },
  china_hawk: { label: '対中強硬派', long: '対中強硬派', desc: '中国の軍備の増強や海洋進出に、毅然とした対応を求める立場。' },
  us: { label: '親米派', long: '日米同盟重視', desc: '日米同盟を外交と安全保障の土台と考え、米国との協調を最優先する立場。' },
  russia: { label: '親ロ派', long: '対ロ対話・協力', desc: 'ロシアとの対話とエネルギーなどの協力を重んじる立場。' },
  korea: { label: '日韓協調派', long: '日韓協調', desc: '歴史や領土の問題を抱えつつも、韓国との協調を重んじる立場。' },
  korea_hawk: { label: '対韓強硬派', long: '対韓強硬', desc: '歴史や竹島の問題で、韓国に厳しい姿勢をとる立場。' },
  taiwan: { label: '台湾重視派', long: '台湾との関係強化', desc: '台湾との交流と協力を深めるべきだとする立場。' },
  multilateral: { label: '国際協調派', long: '欧州・アジアとの多国間協調', desc: '欧州やASEANなど多くの国との連携で、特定の大国への依存を避ける立場。' },
  independent: { label: '自主外交派', long: '自主外交', desc: '米国にも中国にも偏らず、日本の独自の判断を重んじる立場。' },
  nk_dialogue: { label: '対北朝鮮対話派', long: '対北朝鮮の対話重視', desc: '北朝鮮とは圧力より対話と交渉で拉致・核の問題を解決しようとする立場。' },
  nk_pressure: { label: '対北朝鮮圧力派', long: '対北朝鮮の圧力重視', desc: '北朝鮮には制裁など圧力を強めて譲歩を引き出そうとする立場。' },
  centrist: { label: '等距離', long: '各国と等距離', desc: '特定の国に偏らず、場面ごとに判断する立場。' },
};

const hashStr = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const full = (v) => { const o = Z(); for (const k of STANCE_KEYS) o[k] = Number.isFinite(Number(v && v[k])) ? Number(v[k]) : 0; return o; };
// The party-internals module (politics_conflict.js) uses another dialect: { cn, us, ru, indep } in −1..1 (and kr, tw, eu, asean, nk
// when it has them). Any input is read in either dialect; 'indep' (自主外交) lowers the weight of the 日米同盟 line.
export function fromAny(v) {
  if (!v || typeof v !== 'object') return Z();
  const hasNew = ['china', 'russia', 'korea', 'taiwan', 'nk'].some((k) => k in v);
  const old = !hasNew && ['cn', 'ru', 'indep', 'kr', 'tw'].some((k) => k in v);
  if (!old) return full(v);
  const f = (a, b) => { const x = v[a] != null ? v[a] : v[b]; return Number.isFinite(Number(x)) ? Number(x) * 100 : 0; };
  const o = Z();
  o.china = f('cn', 'china'); o.us = f('us', 'us') - (Number.isFinite(Number(v.indep)) ? Number(v.indep) * 20 : 0); o.russia = f('ru', 'russia'); o.korea = f('kr', 'korea'); o.taiwan = f('tw', 'taiwan'); o.eu = f('eu', 'eu'); o.asean = f('asean', 'asean'); o.nk = f('nk', 'nk');
  return o;
}
const mix = (a, b, w) => { const o = Z(); for (const k of STANCE_KEYS) o[k] = a[k] * (1 - w) + b[k] * w; return o; };

export function createStance(X) {
  const { W, clamp, num, relAdd, exists, pol, today, isPM, countryName } = X;
  const S = (g) => {
    const s = W(g);
    if (!s.stance || typeof s.stance !== 'object') s.stance = {};
    const t = s.stance;
    if (!t.over || typeof t.over !== 'object') t.over = {};
    if (!t.player || typeof t.player !== 'object') t.player = Z();
    if (!t.gov || typeof t.gov !== 'object') t.gov = null;
    if (!t.applied || typeof t.applied !== 'object') t.applied = {};
    if (t.last == null) t.last = 0;
    return t;
  };
  const r0 = (v) => Math.round(v);
  const clampVec = (v) => { const o = Z(); for (const k of STANCE_KEYS) o[k] = clamp(r0(v[k]), -100, 100); return o; };
  const archetypeOf = (key) => ARCHETYPES[ARCH_ORDER[hashStr(key) % ARCH_ORDER.length]];
  const archIdOf = (key) => ARCH_ORDER[hashStr(key) % ARCH_ORDER.length];

  function partyVec(g, id) {
    const t = S(g);
    if (t.over['party:' + id]) return full(t.over['party:' + id]);
    const base = PARTY_STANCE[id];
    if (base) return full(base);
    const p = pol(g);
    const pt = p && p.parties && p.parties[id];
    // a party the player founded follows the player's own line; others of unknown kind are neutral with the 日米同盟
    if (pt && (pt.isPlayers || pt.leader === 'player')) return mix(full({ us: 30 }), playerVec(g), 0.6);
    if (pt && pt.ideology) {
      const sec = num(pt.ideology.security), eco = num(pt.ideology.econ);
      return full({ us: 20 + sec * 12, china: -sec * 14 + eco * 4, korea: -sec * 6, taiwan: sec * 10, eu: -eco * 0, nk: -sec * 14 });
    }
    return full({ us: 30 });
  }
  function partyOfFaction(g, fid) {
    const p = pol(g);
    if (!p || !p.parties) return null;
    for (const pt of Object.values(p.parties)) if ((pt.factions || []).some((f) => f.id === fid)) return pt.id;
    return String(fid).split('_f')[0] || null;
  }
  function factionVec(g, fid) {
    const t = S(g);
    if (t.over['faction:' + fid]) return full(t.over['faction:' + fid]);
    const pid = partyOfFaction(g, fid);
    const pv = pid ? partyVec(g, pid) : full({ us: 30 });
    return mix(pv, full(archetypeOf('f:' + fid).vec), 0.66);
  }
  function npcVec(g, nid) {
    const t = S(g);
    if (t.over['npc:' + nid]) return full(t.over['npc:' + nid]);
    const p = pol(g);
    const n = p && p.npcs && p.npcs[nid];
    const pv = n && n.party ? partyVec(g, n.party) : full({ us: 30 });
    const fv = n && n.faction ? factionVec(g, n.faction) : pv;
    return mix(mix(pv, fv, 0.5), full(archetypeOf('n:' + nid).vec), 0.4);
  }
  // the player: the ideology (外交 axis, 安全保障) plus what the player has done (nudges from the diplomacy)
  function playerVec(g) {
    const t = S(g);
    if (t.over['player:player']) return full(t.over['player:player']);
    let w = 0, sec = 0;
    try {
      const id = typeof g.ideology === 'function' ? g.ideology() : null;
      if (id && id.axes) { w = num(id.axes.world); }
      const p = pol(g);
      if (p && p.me && p.me.party && p.parties && p.parties[p.me.party] && p.parties[p.me.party].ideology) sec = num(p.parties[p.me.party].ideology.security) / 2;
    } catch (e) { /* keep 0 */ }
    const base = full({ us: 30 + w * 10 + sec * 15, china: -w * 18 - sec * 18, russia: -w * 8, korea: -w * 12, taiwan: w * 8 + sec * 10, eu: -w * 12, asean: -w * 6, nk: -w * 18 - sec * 15 });
    const o = Z();
    for (const k of STANCE_KEYS) o[k] = base[k] + num(t.player[k]);
    return clampVec(o);
  }
  // the government: the PM (45%), the PM's party (30%), the PM's faction (25%) — unless another module has set it
  function governmentVec(g) {
    const t = S(g);
    if (t.gov && today(g) - num(t.gov.day) <= 40) return full(t.gov.vec);
    const p = pol(g);
    if (!p || !p.cabinet) return full({ us: 30 });
    const pm = p.cabinet.pm;
    const pid = (p.cabinet.partyIds || [])[0] || null;
    if (pm === 'player') return playerVec(g);
    const pv = pid ? partyVec(g, pid) : full({ us: 30 });
    const n = pm && p.npcs ? p.npcs[pm] : null;
    if (!n) return pv;
    const fv = n.faction ? factionVec(g, n.faction) : pv;
    const nv = npcVec(g, pm);
    return mix(mix(pv, fv, 0.45), nv, 0.45);
  }
  function stanceFor(g, kind, id) {
    let v;
    if (kind === 'player') v = playerVec(g);
    else if (kind === 'party') v = partyVec(g, id);
    else if (kind === 'faction') v = factionVec(g, id);
    else if (kind === 'npc') v = npcVec(g, id);
    else if (kind === 'government' || kind === 'cabinet') v = governmentVec(g);
    else return null;
    return clampVec(v);
  }
  // the colloquial labels (main first) of a vector
  function labelsOf(v) {
    v = full(v);
    const out = [];
    if (v.china >= 30 && v.us < 40) out.push('china_engage');
    if (v.china <= -30) out.push('china_hawk');
    if (v.us >= 40) out.push('us');
    if (v.russia >= 30) out.push('russia');
    if (v.korea >= 40) out.push('korea');
    if (v.korea <= -30) out.push('korea_hawk');
    if (v.taiwan >= 40) out.push('taiwan');
    if (v.nk >= 30) out.push('nk_dialogue');
    if (v.nk <= -40) out.push('nk_pressure');
    if (v.eu >= 30 && v.asean >= 25 && !out.length) out.push('multilateral');
    if (!out.length && v.us <= 10 && v.china >= -20 && v.china <= 40) out.push('independent');
    if (!out.length) out.push('centrist');
    return out;
  }
  const labelInfo = (id) => LABEL_INFO[id] || LABEL_INFO.centrist;
  function stanceLabel(v) { const l = labelsOf(v); return { id: l[0], label: labelInfo(l[0]).label, long: labelInfo(l[0]).long, desc: labelInfo(l[0]).desc, all: l.map((x) => ({ id: x, label: labelInfo(x).label })) }; }

  // What the stance does: the relation each country settles at (offset from the era's base, ±12), the trade with it
  // (±4%), and how the public sees it (by segment, with a pro and a con voice).
  function effect(vec, opts = {}) {
    const v = fromAny(vec);
    const dev = Z();
    for (const k of STANCE_KEYS) dev[k] = v[k] - (opts.absolute ? 0 : STANCE_BASE[k]);
    const relEq = {};
    const add = (ids, d) => { for (const id of ids) relEq[id] = (relEq[id] || 0) + d; };
    add(['cn', 'h_cn'], dev.china * 0.10 - Math.max(0, dev.taiwan) * 0.03);
    add(['us'], dev.us * 0.10 - Math.max(0, dev.china) * 0.03 - Math.max(0, dev.russia) * 0.02);
    add(['ru', 'su', 'h_su'], dev.russia * 0.10 - Math.max(0, dev.us) * 0.03);
    add(['kr'], dev.korea * 0.10);
    add(['tw'], dev.taiwan * 0.08);
    add(['cn', 'h_cn'], -Math.max(0, dev.us) * 0.02);
    add(STANCE_COUNTRIES.eu, dev.eu * 0.08);
    add(STANCE_COUNTRIES.asean, dev.asean * 0.08);
    add(['kp'], dev.nk * 0.06);
    for (const id of Object.keys(relEq)) relEq[id] = Math.round(clamp(relEq[id], -12, 12) * 10) / 10;
    const trade = {};
    const tr = (k, ids, f) => { for (const id of ids) trade[id] = Math.round(clamp(dev[k] * f, -5, 5) * 10) / 10; };
    tr('china', ['cn', 'h_cn'], 0.04); tr('us', ['us'], 0.03); tr('russia', ['ru', 'su', 'h_su'], 0.04); tr('korea', ['kr'], 0.03); tr('taiwan', ['tw'], 0.03);
    tr('eu', STANCE_COUNTRIES.eu, 0.03); tr('asean', STANCE_COUNTRIES.asean, 0.03);
    const bySeg = {};
    for (const [sg, pref] of Object.entries(SEG_PREF)) { let a = 0; for (const k of STANCE_KEYS) a += (dev[k] / 100) * pref[k]; bySeg[sg] = Math.round(clamp(a, -1, 1) * 100) / 100; }
    const rows = Object.entries(bySeg).map(([sg, x]) => ({ seg: sg, name: SEG_LABEL[sg] || sg, v: x }));
    const pros = rows.filter((r) => r.v >= 0.08).sort((a, b) => b.v - a.v).slice(0, 3);
    const cons = rows.filter((r) => r.v <= -0.08).sort((a, b) => a.v - b.v).slice(0, 3);
    const w = opts.weights || { business: 0.03, employees: 0.17, selfemployed: 0.05, elderly: 0.25, young: 0.11, families: 0.11, farmers: 0.02, rural: 0.05, unions: 0.05, urban: 0.08, floating: 0.06 };
    let net = 0, tw = 0;
    for (const r of rows) { const ww = num(w[r.seg], 0.05); net += r.v * ww; tw += ww; }
    net = tw ? net / tw : 0;
    const lb = stanceLabel(v);
    const top = STANCE_KEYS.filter((k) => Math.abs(dev[k]) >= 12).sort((a, b) => Math.abs(dev[b]) - Math.abs(dev[a])).slice(0, 3);
    const parts = top.map((k) => `${STANCE_NAMES[k]}との関係は${dev[k] > 0 ? '近づく' : '距離をおく'}方向`);
    const text = `${lb.label}（${lb.long}）：${parts.length ? parts.join('、') : 'どの国にも偏らない'}。` + (pros.length ? `${pros.map((r) => r.name).join('・')}には受け入れられやすく、` : '') + (cons.length ? `${cons.map((r) => r.name).join('・')}には懸念も出やすい。` : 'とくに強い反発はない。');
    // the dialect of politics_conflict.js: monthly drift (the push at the start: 12% of the equilibrium per month), growth per year (pts)
    const idOf = { cn: 'cn', us: 'us', ru: 'ru', kr: 'kr', tw: 'tw', kp: 'kp', eu: 'fr', asean: 'th' };
    const relation = {};
    for (const [k, id] of Object.entries(idOf)) relation[k] = Math.round((relEq[id] || 0) * 0.12 * 100) / 100;
    const gShare = (ids) => ids.reduce((a, id) => a + (X.tradeOf ? num(X.tradeOf(opts.g, id)) : 5), 0) / 100;
    const growth = {};
    for (const [k, ids] of Object.entries({ cn: ['cn'], us: ['us'], ru: ['ru', 'su'], kr: ['kr'], tw: ['tw'], eu: STANCE_COUNTRIES.eu, asean: STANCE_COUNTRIES.asean })) { const id0 = ids[0]; const tv = trade[id0] || 0; growth[k] = Math.round(tv * (opts.g ? gShare(ids.filter((i) => exists(opts.g, i))) : 0.06) * 0.36 * 0.35 * 1000) / 1000; }
    const lines = [text, ...pros.slice(0, 2).map((r) => `${r.name}：受け入れられやすい`), ...cons.slice(0, 2).map((r) => `${r.name}：懸念が出やすい`)];
    return { vec: v, dev, label: lb.label, labels: lb.all, desc: lb.desc, relEq, drift: relEq, relation, trade: growth, tradeVolume: trade, lines, opinion: { bySegment: bySeg, rows, pro: pros, con: cons, net: Math.round(net * 100) / 100, approval: Math.round(clamp(net * 3, -2, 2) * 10) / 10 }, text };
  }

  // every 10 days: the government's orientation pulls the relations toward their equilibrium (decay 0.4%/day → push 4% of the target)
  function tick(g) {
    const t = S(g);
    if (today(g) - num(t.last) < 10) return;
    t.last = today(g);
    const e = effect(governmentVec(g), { g });
    for (const [id, eq] of Object.entries(e.relEq)) {
      if (!eq || !exists(g, id)) continue;
      const d = eq * 0.04;
      if (Math.abs(d) >= 0.01) { relAdd(g, id, d); t.applied[id] = Math.round((num(t.applied[id]) * 0.96 + d) * 100) / 100; }
    }
  }
  // the player's own deeds shape the player's stance a little (diplomacy hook): key → ±points, capped
  function nudgePlayer(g, key, d) {
    if (!STANCE_KEYS.includes(key) || !d) return;
    const t = S(g);
    t.player[key] = clamp(num(t.player[key]) + d, -40, 40);
  }
  const methods = {
    foreignStance(kind = 'player', id = null) {
      const k = kind === 'politician' ? 'npc' : kind;
      const v = stanceFor(this, k, id);
      if (!v) return null;
      const lb = stanceLabel(v);
      // the numbers (−100..100) at the top level; vec = the same in the other dialect (−1..1) for politics_conflict.js
      const indep = Math.round(clamp(0.5 - (v.us - 30) / 90, 0, 1) * 100) / 100;
      return { ...v, label: lb.label, long: lb.long, labels: lb.all.map((x) => x.label), vec: { cn: v.china / 100, us: v.us / 100, ru: v.russia / 100, indep, kr: v.korea / 100, tw: v.taiwan / 100, eu: v.eu / 100, asean: v.asean / 100, nk: v.nk / 100 } };
    },
    setForeignStance(kind, id, vec) {
      const t = S(this);
      if (kind === 'politician') kind = 'npc';
      if (kind === 'government' || kind === 'cabinet') { t.gov = vec ? { vec: clampVec(fromAny(vec)), day: today(this) } : null; return true; }
      if (!['player', 'party', 'faction', 'npc'].includes(kind)) return false;
      const key = `${kind}:${kind === 'player' ? 'player' : id}`;
      if (vec == null) delete t.over[key]; else t.over[key] = clampVec(fromAny(vec));
      return true;
    },
    foreignStanceLabel(vec) { return stanceLabel(vec); },
    worldStanceEffect(vec, opts = {}) { return effect(vec, { g: this, ...opts }); },
    foreignStanceInfo(kind = 'player', id = null) {
      const v = stanceFor(this, kind === 'politician' ? 'npc' : kind, id);
      if (!v) return null;
      const lb = stanceLabel(v);
      return { kind, id, vec: v, label: lb.label, long: lb.long, desc: lb.desc, labels: lb.all, effect: effect(v, { g: this }) };
    },
  };
  return { methods, tick, effect, stanceFor, stanceLabel, labelsOf, nudgePlayer, playerVec, governmentVec, S, archIdOf, ARCHETYPES, SEG_LABEL, countryName };
}
